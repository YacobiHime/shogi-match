// 師匠の1年の崩れ方の見立て(docs/disciple-mode-design.mdの33-5)を、弟子の本局を何局も指して数える。
// 分類の偏り(どれかに寄りすぎていないか)・印にならなかった手の割合・作戦負けの区間の出かたを見る。
// 使い方: npx vite-node scripts/disciple-cause-report.mjs -- [--games 8] [--disciple tsumugi]
import { createNodeEngine } from './lib/node-engine.mjs';
import { playEngineGame } from '../src/core/engine-game.mjs';
import { createDiscipleRun, watchSpec } from '../src/core/disciple-run.mjs';
import { CAUSE_RULES, REVIEW_CAUSE_ORDER, classifyMove, planSection, reviewMarks, winChanceOf } from '../src/core/disciple-causes.mjs';
import { MARK_MIN_LOSS, discipleWatchMoves } from '../src/core/disciple-strength.mjs';

const args = process.argv.slice(2);
const option = (key, fallback) => {
  const index = args.indexOf(`--${key}`);
  return index >= 0 ? args[index + 1] : fallback;
};
const games = Number(option('games', 8));
const discipleIds = String(option('disciple', 'minato,tsumugi,ao')).split(',');

const engine = await createNodeEngine();
const search = async ({ moves, nodes, multiPv, searchMoves }) => {
  engine.applyStrengthOptions({ multiPv: Math.max(1, multiPv) });
  await engine.setSearchThreads(1);
  engine.setPosition(`startpos${moves.length ? ` moves ${moves.join(' ')}` : ''}`);
  return engine.go({ nodes, maxTimeMs: 20000, ...(searchMoves ? { searchMoves } : {}) });
};

const tally = Object.fromEntries(REVIEW_CAUSE_ORDER.map((id) => [id, 0]));
let candidates = 0;
let unclassified = 0;
let sections = 0;
let marks = 0;
let timeTags = 0;
for (let index = 0; index < games; index += 1) {
  const discipleId = discipleIds[index % discipleIds.length];
  // 入会試験の局を作る(3ターン目)。
  let state = createDiscipleRun({ seed: 1000 + index, discipleId });
  state = { ...state, turn: 3 };
  const made = watchSpec(state, {});
  if (!made) continue;
  const game = await playEngineGame({ spec: made.spec, search });
  if (!game) continue;
  const side = made.side === 'white' ? 'white' : 'black';
  const sign = side === 'black' ? 1 : -1;
  const pov = (at) => (at >= 0 ? sign * (Number(game.entries[at]?.eval) || 0) : 0);
  // 印の候補と同じ決まり(250点以上、かつ勝つ見込みが12%以上落ちた弟子の手)。
  const big = discipleWatchMoves(game.entries, side)
    .filter((move) => move.loss >= MARK_MIN_LOSS && winChanceOf(pov(move.ply - 2)) - winChanceOf(pov(move.ply - 1)) >= CAUSE_RULES.winDrop);
  candidates += big.length;
  for (const move of big) {
    const judged = classifyMove(game.entries, side, move.ply);
    if (!judged) unclassified += 1;
    else {
      tally[judged.cause] += 1;
      if (judged.tags.includes('time')) timeTags += 1;
    }
  }
  if (planSection(game.entries, side)) sections += 1;
  const shown = reviewMarks(game.entries, side, { dan: 1 });
  marks += shown.length;
  console.log(`${index + 1}/${games} ${discipleId} ${game.entries.length}手 ${game.end.winner === side ? '勝ち' : '負け'} 崩れた手${big.length} 印${shown.length}: ${shown.map((mark) => `${mark.ply}${mark.cause}${mark.alt ? `/${mark.alt}` : ''}`).join(' ')}`);
}
console.log('\n崩れた手(250点以上・勝つ見込み12%以上落ちた弟子の手)', candidates, '分類できなかった', unclassified);
for (const id of REVIEW_CAUSE_ORDER) console.log(`  ${id.padEnd(9)} ${tally[id]}`);
console.log('秒読みの背景', timeTags, '作戦負けの区間', sections, `/${games}局`, '印の数', marks);
process.exit(0);
