// 「理由で指す」棋士(docs/disciple-mode-design.mdの34章)を何局も指させて数える(段階E1の測る道具)。
// 考える順番のどの段で決めたかの内訳・何もない局面の手の内訳・1手の時間・手数・勝ち負け・戦法熟練度でエンジンが指した手の数。
// --judge を付けると、エンジンで各手の損(最善との差)も測る(遅い)。
// --show を付けると、1局目の手と理由を1手ずつ出す。
// 使い方: npx vite-node scripts/reason-ai-report.mjs -- [--games 6] [--black 30-30-30-30] [--white 30-30-30-30] [--mastery 40] [--judge] [--show]
import { Position } from 'tsshogi';
import { createNodeEngine } from './lib/node-engine.mjs';
import { createGameRecord, appendUsiMove, enumerateLegalMoves, STANDARD_SFEN } from '../src/game-state';
import { chooseFollowMove, chooseReasonMove, reasonProfile, REASON_TEXT } from '../src/core/reason-move.mjs';
import { createBookTracker, followUpTurn, noteBook } from '../src/core/strategy-mastery.mjs';
import { nextOpeningPlanMove } from '../src/core/opening-guide.mjs';
import { rankedCandidates } from '../src/core/relay-game.mjs';
import { createRng } from '../src/core/ryuo.mjs';

const args = process.argv.slice(2);
const option = (key, fallback) => {
  const index = args.indexOf(`--${key}`);
  return index >= 0 ? args[index + 1] : fallback;
};
const games = Number(option('games', 6));
const levelsOf = (text) => {
  const [reading, plan, steady, mate] = String(text).split('-').map(Number);
  return { reading, plan, steady, mate };
};
const players = { black: levelsOf(option('black', '30-30-30-30')), white: levelsOf(option('white', '30-30-30-30')) };
const mastery = Number(option('mastery', 40));
const judge = args.includes('--judge');
const show = args.includes('--show');
/** 戦法と囲い(居飛車の棒銀と、振り飛車の四間飛車)。先後を入れ替えて指す。 */
const PLANS = [{ strategyId: 'bougin', castleId: 'funagakoi' }, { strategyId: 'shiken', castleId: 'mino' }];

const engine = await createNodeEngine();
const search = async ({ moves, nodes, multiPv = 1 }) => {
  engine.applyStrengthOptions({ multiPv: Math.max(1, multiPv) });
  await engine.setSearchThreads(1);
  engine.setPosition(`startpos${moves.length ? ` moves ${moves.join(' ')}` : ''}`);
  return engine.go({ nodes, maxTimeMs: 20000 });
};
const bestOf = (read) => rankedCandidates(read)[0]?.move ?? null;

const tally = {};
const quiet = {};
const times = [];
let follows = 0;
let skippedTotal = 0;
let movesTotal = 0;
const results = { black: 0, white: 0, draw: 0 };
const losses = { black: [], white: [] };
const positionKey = (sfen) => sfen.split(' ').slice(0, 3).join(' ');

for (let game = 0; game < games; game += 1) {
  const rng = createRng(4242 + game);
  const random = () => rng.next();
  const plans = game % 2 === 0 ? { black: PLANS[0], white: PLANS[1] } : { black: PLANS[1], white: PLANS[0] };
  const record = createGameRecord(STANDARD_SFEN);
  const moves = [];
  const seen = new Map();
  let tracker = createBookTracker();
  let winner = 'draw';
  for (let ply = 0; ply < 220; ply += 1) {
    const side = ply % 2 === 0 ? 'black' : 'white';
    const sfen = record.position.sfen;
    const legal = enumerateLegalMoves(record.position).map((move) => move.usi);
    if (!legal.length) {
      winner = side === 'black' ? 'white' : 'black';
      break;
    }
    const own = moves.filter((_, index) => (index % 2 === 0 ? 'black' : 'white') === side);
    const other = moves.filter((_, index) => (index % 2 === 0 ? 'black' : 'white') !== side);
    let planMove = null;
    try {
      planMove = nextOpeningPlanMove({
        strategyId: plans[side].strategyId, castleId: plans[side].castleId, color: side, playedMoves: own, opponentMoves: other,
        moveHistory: moves, legalMoves: legal, detectedFormations: [], opponentFormations: [], currentSfen: sfen,
      })?.usi ?? null;
    } catch {
      planMove = null;
    }
    if (planMove && !legal.includes(planMove)) planMove = null;
    tracker = noteBook(tracker, side, { planMove, ownMoves: own.length });
    const profile = reasonProfile(players[side]);
    const started = Date.now();
    const follow = followUpTurn(tracker, side, own.length, mastery);
    let choice = follow
      ? await chooseFollowMove({ sfen, moves, profile, nodes: follow.nodes, search, legal, bestOf })
      : null;
    if (!choice) choice = chooseReasonMove({ sfen, profile, planMove, random });
    const elapsed = Date.now() - started;
    if (!choice) break;
    // 千日手にしない(4回目の局面になる手は、ほかの手に替える)。
    const probe = createGameRecord(sfen);
    appendUsiMove(probe, choice.move);
    if ((seen.get(positionKey(probe.position.sfen)) ?? 0) >= 3) {
      const other = legal.find((usi) => usi !== choice.move);
      if (other) choice = { ...choice, move: other, stage: 'quiet', reason: 'natural' };
    }
    if (choice.stage !== 'follow' && choice.stage !== 'mate') times.push(elapsed);
    if (choice.stage === 'follow') follows += 1;
    tally[choice.stage] = (tally[choice.stage] ?? 0) + 1;
    if (show && game === 0) console.log(`${ply + 1} ${side === 'black' ? '▲' : '△'}${choice.move} ${choice.stage}/${REASON_TEXT[choice.reason] ?? choice.reason}${choice.skipped?.length ? ` 飛ばした:${choice.skipped.join(',')}` : ''}`);
    if (choice.stage === 'quiet' || choice.stage === 'shape' || choice.stage === 'read') quiet[choice.reason] = (quiet[choice.reason] ?? 0) + 1;
    skippedTotal += choice.skipped?.length ? 1 : 0;
    movesTotal += 1;
    if (judge) {
      const read = await search({ moves, nodes: 20000, multiPv: 1 });
      const best = rankedCandidates(read)[0];
      if (best && best.move !== choice.move) {
        const single = await search({ moves: [...moves, choice.move], nodes: 20000, multiPv: 1 });
        const after = rankedCandidates(single)[0];
        if (after) losses[side].push(Math.max(0, best.value + after.value));
      } else losses[side].push(0);
    }
    if (!appendUsiMove(record, choice.move)) break;
    moves.push(choice.move);
    const key = positionKey(record.position.sfen);
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  results[winner] += 1;
  console.log(`${game + 1}/${games} ${plans.black.strategyId}対${plans.white.strategyId} ${moves.length}手 ${winner === 'draw' ? '持将棋' : winner === 'black' ? '先手勝ち' : '後手勝ち'}`);
  void Position;
}

const median = (list) => (list.length ? [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)] : 0);
console.log('\n段の内訳');
for (const [stage, count] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`  ${stage.padEnd(8)} ${count} (${Math.round((count / movesTotal) * 100)}%)`);
console.log('読み・形・何もない局面の手の理由');
for (const [reason, count] of Object.entries(quiet).sort((a, b) => b[1] - a[1])) console.log(`  ${(REASON_TEXT[reason] ?? reason).padEnd(8)} ${count}`);
console.log('1手の時間(理由の手) 中央', median(times), 'ms 最大', Math.max(0, ...times), 'ms');
console.log('研究の続き(エンジン)', follows, '確かめを飛ばした手', skippedTotal, '/', movesTotal);
console.log('勝ち負け', results);
if (judge) for (const side of ['black', 'white']) console.log(`損の平均(${side}) ${Math.round(losses[side].reduce((a, b) => a + b, 0) / Math.max(1, losses[side].length))}`);
process.exit(0);
