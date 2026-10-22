// 竜王への道(docs/ryuo-ux-redesign.mdの4-2)。期の状態から、いまの組の回戦 → (敗者復活戦) → 決勝トーナメント →
// 挑戦者決定戦 → 七番勝負 → 竜王、の段を作る。どの段を通ったか・いまどこか・どこで止まったか、山場の段と、そこで待つ顔。
// 画面には依存しない。期の保存形式(core/ryuo.mjs)を読むだけで、書き換えない。

import { USER_HOLDER } from './ryuo-roster.mjs';
import { HANANE } from './ryuo-story.mjs';
import { HOW_LABELS } from './ryuo-simulation.mjs';

const USER_ID = USER_HOLDER;
const sidePid = (bracket, side) => (side ? (side.pid ?? bracket.nodes[side.from]?.winner ?? null) : null);
const hasUser = (bracket, node) => sidePid(bracket, node.a) === USER_ID || sidePid(bracket, node.b) === USER_ID;

/** 組の回戦の名前。決勝は「組の決勝」。 */
function rankingRoundName(rounds, round) {
  const from = rounds - round;
  if (from === 0) return { label: '組の決勝', short: '組の決勝' };
  if (from === 1) return { label: '準決勝', short: '準決勝' };
  if (from === 2) return { label: '準々決勝', short: '準々決勝' };
  return { label: `${round}回戦`, short: `${round}回戦` };
}

/** 顔の印(名前の1文字か、絵のある人物)。 */
function faceOf(season, pid) {
  const player = season.players?.[pid];
  if (!player) return null;
  const attack = player.character?.attack ?? 0;
  return {
    id: pid,
    name: player.name,
    char: player.name.slice(0, 1),
    story: player.story ?? null,
    tone: attack >= 0.25 ? 'attack' : attack <= -0.25 ? 'defense' : 'balance',
  };
}

/** トーナメント表での、プレイヤーのその回戦の状態。 */
function bracketRoundState(bracket, round, pendingNodeId) {
  const node = Object.values(bracket.nodes).find((entry) => entry.round === round && hasUser(bracket, entry));
  if (node) {
    if (node.id === pendingNodeId && !node.winner) return 'current';
    if (node.winner === USER_ID) return 'done';
    if (node.winner) return 'lost';
    return 'todo';
  }
  // その回戦にいない: 後の回戦にいれば不戦勝(通過)。
  const later = Object.values(bracket.nodes).some((entry) => entry.round > round && hasUser(bracket, entry));
  return later ? 'done' : 'todo';
}

/**
 * 表全体(決勝トーナメント・敗者復活戦の1つの山)での状態。
 * 決勝トーナメントの根は挑戦者決定三番勝負なので、withoutRootで根を除いて数える。
 */
function bracketState(bracket, pendingNodeId, { withoutRoot = false } = {}) {
  const nodes = Object.values(bracket.nodes)
    .filter((entry) => hasUser(bracket, entry) && !(withoutRoot && entry.round === bracket.rounds));
  if (!nodes.length) return 'todo';
  if (nodes.some((entry) => entry.id === pendingNodeId && !entry.winner)) return 'current';
  if (nodes.some((entry) => entry.winner && entry.winner !== USER_ID)) return 'lost';
  return nodes.every((entry) => entry.winner === USER_ID) ? 'done' : 'current';
}

/** 番勝負の状態とスコア。 */
function seriesState(series, pendingKind, kind) {
  if (!series || (series.a !== USER_ID && series.b !== USER_ID)) return { state: 'todo', score: '' };
  const opponent = series.a === USER_ID ? series.b : series.a;
  const score = `${series.wins[USER_ID]}-${series.wins[opponent]}`;
  if (series.winner === USER_ID) return { state: 'done', score };
  if (series.winner) return { state: 'lost', score };
  return { state: pendingKind === kind ? 'current' : 'todo', score };
}

/**
 * 竜王への道。
 * - steps: 段(下から順)。state は done(通過) / current(次に指す段) / lost(ここで止まった) / skip(負けて通らなかった組の回戦) / todo(まだ) / won(竜王)。
 *   boss は山場の段、face はその段で待つ顔(いまの段は次の相手、組の決勝はライバル、七番勝負は竜王)。mark は「昇級」の印。
 * - currentIndex: いまいる段(期が終わっていれば、最後に着いた段)。
 * - lastIndex: 直前のプレイヤーの対局の段(勝ち上がりの動きの出発点)。分からなければ-1。
 * @param {any} season
 * @param {{ promote?: number }} [options] promoteは昇級の人数(規模で決まる)。
 */
export function seasonRoad(season, { promote = 1 } = {}) {
  const pending = season.pending ?? null;
  const steps = [];
  const pendingNode = (phase) => (pending?.kind === 'game' && pending.phase === phase ? pending.nodeId : null);
  const opponentFace = pending ? faceOf(season, pending.opponentId) : null;
  const rivalId = Object.keys(season.players ?? {}).find((pid) => season.players[pid]?.story === HANANE) ?? null;

  if (season.mode !== 'defense' && season.ranking) {
    const bracket = season.ranking;
    // 昇級が決まる段: その回戦に残っている人数が、昇級の人数以下になったところ(組の決勝に出れば2位以内、など)。
    let markRound = bracket.rounds + 1;
    for (let round = 1; round <= bracket.rounds; round += 1) {
      if (2 ** (bracket.rounds - round + 1) <= promote) { markRound = round; break; }
    }
    // ライバルが表の反対の山で勝ち残っていれば、組の決勝で待つ顔にする(いつか戦う相手が見えている)。
    const rivalAlive = rivalId && Object.values(bracket.nodes).some((node) => (sidePid(bracket, node.a) === rivalId || sidePid(bracket, node.b) === rivalId))
      && !Object.values(bracket.nodes).some((node) => node.winner && node.winner !== rivalId && (sidePid(bracket, node.a) === rivalId || sidePid(bracket, node.b) === rivalId));
    for (let round = 1; round <= bracket.rounds; round += 1) {
      const final = round === bracket.rounds;
      steps.push({
        key: `ranking-${round}`,
        phase: 'ranking',
        round,
        ...rankingRoundName(bracket.rounds, round),
        state: bracketRoundState(bracket, round, pendingNode('ranking')),
        boss: final,
        face: null,
        mark: season.startGroup > 1 && round === markRound ? '昇級' : '',
        score: '',
      });
    }
    // 組の途中で負けたら、その先の回戦は通らない(skip)。まだ負けていなければ、組の決勝にライバルの顔を置く。
    const lostAt = steps.findIndex((step) => step.state === 'lost');
    if (lostAt >= 0) steps.forEach((step, index) => { if (index > lostAt && step.state === 'todo') step.state = 'skip'; });
    else if (rivalAlive && season.startGroup > 1 && steps.at(-1).state === 'todo') steps.at(-1).face = faceOf(season, rivalId);
    const userBlock = (season.revival ?? []).find((block) => Object.values(block.nodes).some((node) => hasUser(block, node)));
    if (userBlock) {
      steps.push({
        key: 'revival', phase: 'revival', round: 0, label: '敗者復活戦', short: '敗者復活',
        state: bracketState(userBlock, pendingNode('revival')), boss: false, face: null, mark: '', score: '',
      });
    }
    const markInMain = season.startGroup > 1 && markRound > bracket.rounds;
    steps.push({
      key: 'main', phase: 'main', round: 0, label: '決勝トーナメント', short: '決勝T',
      state: season.main ? bracketState(season.main, pendingNode('main'), { withoutRoot: true }) : 'todo', boss: false, face: null,
      mark: markInMain ? '昇級' : '', score: '',
    });
    // 決勝トーナメントの最後まで勝てば挑戦者決定戦に出る(表の根は番勝負なので、決勝トーナメントの段は通過にする)。
    const playoff = seriesState(season.playoff, pending?.kind, 'playoff');
    if (playoff.state !== 'todo' && steps.at(-1).state !== 'lost') steps.at(-1).state = 'done';
    steps.push({ key: 'playoff', phase: 'playoff', round: 0, label: '挑戦者決定三番勝負', short: '挑戦者決定戦', ...playoff, boss: true, face: null, mark: '' });
  }
  const finals = seriesState(season.finals, pending?.kind, 'finals');
  const defense = season.mode === 'defense';
  // 七番勝負で待つのは竜王(防衛戦では、挑戦者)。
  const finalsFaceId = defense
    ? (season.finals ? (season.finals.a === USER_ID ? season.finals.b : season.finals.a) : null)
    : (season.finals?.a ?? season.defender ?? null);
  steps.push({
    key: 'finals', phase: 'finals', round: 0, label: defense ? '防衛戦 七番勝負' : '竜王戦七番勝負', short: '七番勝負',
    ...finals, boss: true, face: finalsFaceId && finalsFaceId !== USER_ID ? faceOf(season, finalsFaceId) : null, mark: '',
  });
  const crowned = season.phase === 'done' && season.champion === USER_ID;
  steps.push({
    key: 'ryuo', phase: 'done', round: 0, label: defense ? '竜王防衛' : '竜王', short: defense ? '防衛' : '竜王',
    state: crowned ? 'won' : 'todo', boss: true, face: null, mark: '', score: '',
  });

  // いまの段に、次の相手の顔を置く。
  let currentIndex = steps.findIndex((step) => step.state === 'current');
  if (currentIndex >= 0 && opponentFace) steps[currentIndex] = { ...steps[currentIndex], face: opponentFace };
  if (currentIndex < 0) {
    // 期が終わっている: 竜王になったか、止まった段か、最後に通った段。
    const won = steps.findIndex((step) => step.state === 'won');
    const lost = steps.map((step) => step.state).lastIndexOf('lost');
    const done = steps.map((step) => step.state).lastIndexOf('done');
    currentIndex = won >= 0 ? won : Math.max(lost, done);
  }
  return { steps, currentIndex, lastIndex: lastGameIndex(season, steps) };
}

/** 直前のプレイヤーの対局の段。ランキング戦は回戦(round)を記録した対局だけ分かる。 */
function lastGameIndex(season, steps) {
  const game = season.userGames?.at(-1);
  if (!game) return -1;
  if (game.phase === 'ranking') return game.round ? steps.findIndex((step) => step.key === `ranking-${game.round}`) : -1;
  const key = game.phase === 'revival' ? 'revival' : game.phase === 'main' ? 'main' : game.phase;
  return steps.findIndex((step) => step.key === key);
}

/**
 * 期が始まる前の竜王への道(入口の山の全景。docs/ryuo-ui-renewal-design.mdの5-1)。どの段もまだで、いちばん下の段がいまの段。
 * 七番勝負には、いまの竜王の顔(わかれば)。
 * @param {{ mode: 'challenge' | 'defense', group: number, rounds: number, promote?: number,
 *   holder?: { id: string, name: string, attack?: number, story?: string | null } | null }} entry
 *   roundsはランキング戦の回戦の数、holderはいまの竜王(プレイヤーが竜王ならnull)。
 */
export function previewRoad({ mode, group, rounds, promote = 1, holder = null }) {
  const steps = [];
  const blank = { state: 'todo', face: null, mark: '', score: '', round: 0 };
  if (mode !== 'defense') {
    let markRound = rounds + 1;
    for (let round = 1; round <= rounds; round += 1) {
      if (2 ** (rounds - round + 1) <= promote) { markRound = round; break; }
    }
    for (let round = 1; round <= rounds; round += 1) {
      steps.push({ ...blank, key: `ranking-${round}`, phase: 'ranking', round, ...rankingRoundName(rounds, round), boss: round === rounds, mark: group > 1 && round === markRound ? '昇級' : '' });
    }
    steps.push({ ...blank, key: 'main', phase: 'main', label: '決勝トーナメント', short: '決勝T', boss: false, mark: group > 1 && markRound > rounds ? '昇級' : '' });
    steps.push({ ...blank, key: 'playoff', phase: 'playoff', label: '挑戦者決定三番勝負', short: '挑戦者決定戦', boss: true });
  }
  const attack = holder?.attack ?? 0;
  const face = holder && mode !== 'defense'
    ? { id: holder.id, name: holder.name, char: holder.name.slice(0, 1), story: holder.story ?? null, tone: attack >= 0.25 ? 'attack' : attack <= -0.25 ? 'defense' : 'balance' }
    : null;
  steps.push({ ...blank, key: 'finals', phase: 'finals', label: mode === 'defense' ? '防衛戦 七番勝負' : '竜王戦七番勝負', short: '七番勝負', boss: true, face });
  steps.push({ ...blank, key: 'ryuo', phase: 'done', label: mode === 'defense' ? '竜王防衛' : '竜王', short: mode === 'defense' ? '防衛' : '竜王', boss: true });
  steps[0] = { ...steps[0], state: 'current' };
  return { steps, currentIndex: 0, lastIndex: -1 };
}

/** 勝ち方を、「〜で勝ち上がってきた」の形に。 */
const HOW_ARRIVAL = Object.freeze({
  opening: '序盤のリードを守りきって',
  middle: '中盤で抜け出して',
  ending: '終盤の競り合いを制して',
  comeback: '終盤の逆転で',
  recover: '序盤の不利をはね返して',
});

/**
 * 次の相手が、直前の回戦をどう勝ってきたか(自動対局の勝ち方。D:8-3 肩入れする理由)。
 * 分からないとき(1回戦・シード・番勝負)は空。
 */
export function opponentArrivalLine(season) {
  const pending = season.pending;
  if (!pending || pending.kind !== 'game') return '';
  const bracket = pending.phase === 'ranking' ? season.ranking : pending.phase === 'revival' ? season.revival?.[pending.blockIndex] : season.main;
  if (!bracket) return '';
  const pid = pending.opponentId;
  const won = Object.values(bracket.nodes)
    .filter((node) => node.winner === pid && node.game?.how && HOW_LABELS[node.game.how])
    .sort((a, b) => b.round - a.round)[0];
  const name = season.players?.[pid]?.name;
  if (!won || !name) return '';
  return `${name}さんは、前の回戦を${HOW_ARRIVAL[won.game.how]}勝ち上がってきたよ。`;
}
