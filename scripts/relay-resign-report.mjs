// 中継の棋譜の終わり方を測る(docs/tournament-relay-design.mdの15章)。Nodeのエンジンで何局か作り、投了・詰みの手数と、
// 投了した局面の形勢(投了した側から見た評価値)、最後に表示される形勢を出す。
// 使い方: node scripts/relay-resign-report.mjs [局数=12] [読む局面数=6000] [quality(pro|空)]
import './lib/ts-register.mjs';
import { createNodeEngine } from './lib/node-engine.mjs';

const { playRelayGame, blackWinRate } = await import('../src/core/relay-game.mjs');
const formationMaster = (await import('../src/data/hiragana_suisho_formations.json', { with: { type: 'json' } })).default;

const count = Number(process.argv[2] ?? 12);
const nodes = Number(process.argv[3] ?? 6000);
const quality = process.argv[4] ?? '';
const HOWS = ['opening', 'middle', 'ending', 'comeback', 'recover'];
const engine = await createNodeEngine();
const rows = [];
for (let index = 0; index < count; index += 1) {
  const winner = index % 2 ? 'white' : 'black';
  const how = HOWS[index % HOWS.length];
  const spec = { key: `measure:${index}`, seed: 1000 + index * 7919, winner, how, story: null, quality, event: 'ryuo', kind: 'game', black: {}, white: {} };
  engine.newGame();
  const search = ({ moves, multiPv, searchMoves }) => {
    engine.applyStrengthOptions({ multiPv: Math.max(1, multiPv) });
    engine.setPosition(`startpos${moves.length ? ` moves ${moves.join(' ')}` : ''}`);
    return engine.go({ nodes, maxTimeMs: 4000, ...(searchMoves ? { searchMoves } : {}) });
  };
  const started = Date.now();
  const game = await playRelayGame({ spec, search, formationMaster });
  const last = game.entries.at(-1);
  const sign = winner === 'black' ? 1 : -1;
  // 最後の手のあとの、勝者から見た形勢と勝率。
  const winnerEval = (last?.eval ?? 0) * sign;
  const winnerRate = Math.round((winner === 'black' ? blackWinRate(last?.eval ?? 0) : 1 - blackWinRate(last?.eval ?? 0)) * 100);
  const maxLoserLead = Math.max(...game.entries.slice(-12).map((entry) => -entry.eval * sign));
  const row = { index, how, winner, reason: game.end.reason, plies: game.end.plies, winnerEval, winnerRate, loserLeadLast12: maxLoserLead, seconds: Math.round((Date.now() - started) / 1000) };
  row.tail = game.entries.slice(-16).map((entry) => entry.eval * sign).join(","); row.marks = game.entries.slice(-16).map((entry) => entry.mark || "-").join(",");
  // 敗者が大きくリードした最初の手(どちらの手で、何の印で、どれだけ損をしたか)。
  const swing = game.entries.findIndex((entry) => -entry.eval * sign > 2000);
  if (swing >= 0) row.swing = game.entries.slice(Math.max(0, swing - 3), swing + 1).map((entry, at) => `${swing - 3 + at}:${(swing - 3 + at) % 2 ? 'W' : 'B'}${entry.mark || '-'}(${entry.eval * sign},loss${entry.loss})`).join(' ');
  rows.push(row);
  console.log(JSON.stringify(row));
}
const bad = rows.filter((row) => row.winnerRate < 85);
console.log(`投了のときに勝者の勝率が85%未満: ${bad.length}/${rows.length}`);
process.exit(0);
