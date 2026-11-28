// 師匠の1年の「研究」(作戦の熟練度を上げる)と稽古の釣り合いを、育成を自動で最後まで進めて比べる(docs/disciple-mode-design.mdの49-15)。
// どの方針も、体力が減ったら休み、例会・入会試験は結果だけ見る(観戦しない局なので、熟練度は49-15の足し方で効く)。
//   train: いちばん低い能力を稽古する(研究しない)
//   mix:   N回に1回、いちばん指す作戦を研究する(残りは train と同じ)
//   research: 熟練度が上限になるまで研究ばかり(上限のあとは train)
// 比べるのは、研修会の入会・奨励会の編入・四段になった割合と早さ、終わったときの評価。
// 使い方: npx vite-node scripts/disciple-research-balance.mjs -- [--runs 60] [--every 3]
import { DISCIPLES, STAT_KEYS } from '../src/core/disciple-strength.mjs';
import { chooseAction, chooseWords, createDiscipleRun, playEvent, turnKind } from '../src/core/disciple-run.mjs';
import { bookHeadline } from '../src/core/disciple-plans.mjs';

const args = process.argv.slice(2);
const option = (key, fallback) => {
  const index = args.indexOf(`--${key}`);
  return index >= 0 ? args[index + 1] : fallback;
};
const runs = Number(option('runs', 60));
const every = Number(option('every', 3));
const TRAIN_FOR = { reading: 'jissen', plan: 'kifu', steady: 'fast', mate: 'tsume' };

function play(policy, seed, discipleId) {
  let s = createDiscipleRun({ seed, discipleId });
  let free = 0;
  let researched = 0;
  for (let i = 0; i < 900 && !s.end; i += 1) {
    const kind = turnKind(s);
    if (kind === 'free') {
      free += 1;
      const head = bookHeadline(s.planBook);
      const mastery = head ? s.planBook.cards[head.id]?.mastery ?? 0 : 100;
      const research = policy === 'research' ? mastery < 100 : policy === 'mix' ? free % every === 0 && mastery < 100 : false;
      if (s.stamina < 45) s = chooseAction(s, { kind: 'rest' }).state;
      else if (research && head) {
        s = chooseAction(s, { kind: 'research', card: head.id }).state;
        researched += 1;
      } else {
        const weakest = STAT_KEYS.reduce((a, b) => (s.stats[b] < s.stats[a] ? b : a));
        s = chooseAction(s, { kind: 'train', id: TRAIN_FOR[weakest] }).state;
      }
    } else if (kind === 'exam' || kind === 'reikai') s = playEvent(s, { plan: { opening: 'own', ending: 'wait' } }).state;
    else if (kind === 'words') s = chooseWords(s, 'review').state;
    else break;
  }
  return { end: s.end, turn: s.turn, kenshukai: Boolean(s.kenshukai && s.kenshukai.phase !== 'exam'), shoreikai: Boolean(s.shoreikai), researched };
}

const RANK_POINTS = { S: 5, A: 4, B: 3, C: 2, D: 1, E: 0 };
for (const policy of ['train', 'mix', 'research']) {
  const rows = [];
  for (let index = 0; index < runs; index += 1) rows.push(play(policy, 1000 + index, DISCIPLES[index % DISCIPLES.length].id));
  const rate = (test) => Math.round((100 * rows.filter(test).length) / rows.length);
  const pros = rows.filter((row) => row.end?.kind === 'pro');
  const avgTurn = pros.length ? Math.round(pros.reduce((sum, row) => sum + row.turn, 0) / pros.length) : '-';
  const rank = rows.reduce((sum, row) => sum + (RANK_POINTS[row.end?.rank] ?? 0), 0) / rows.length;
  const researched = Math.round(rows.reduce((sum, row) => sum + row.researched, 0) / rows.length);
  console.log(`${policy}: 研修会に入る${rate((row) => row.kenshukai || row.shoreikai)}%・奨励会${rate((row) => row.shoreikai)}%・四段${rate((row) => row.end?.kind === 'pro')}%（四段になったターン平均${avgTurn}）・評価の平均${rank.toFixed(2)}・研究${researched}回`);
}
process.exit(0);
