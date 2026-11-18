// 分身の表示勝率61%と、実際の自動対局の抽選確率・勝敗分布を照合する（調査のみ）。
// node scripts/pro-auto-probability-audit.mjs [局数（各条件、既定100000）]
import { createRoster } from '../src/core/ryuo-roster.mjs';
import { YOSHIHIKO } from '../src/core/ryuo-story.mjs';
import { simulateMemberGame } from '../src/core/ryuo-simulation.mjs';
import { createRng } from '../src/core/ryuo-random.mjs';
import { winProbability } from '../src/core/ryuo-strength.mjs';

const games = Number(process.argv[2] ?? 100000);
if (!Number.isSafeInteger(games) || games < 1) throw new Error('局数は正の整数で指定してください');
const roster = createRoster({ seed: 11, userGroup: 6 });
const opponent = Object.values(roster.players).find(player => player.story === YOSHIHIKO);
// 調子・研究・成長を足した後の実効レーティング差を「61%」に合わせる。
const user = { id: 'user', name: '検証用', kind: 'pro', rating: opponent.rating + 400 * Math.log10(0.61 / 0.39) };
console.log(JSON.stringify({ displayedPercent: Math.round(winProbability(user.rating, opponent.rating) * 100), gamesPerCase: games, seed: 20261118 }));
const cases = [
  ['善彦・先後ランダム', opponent, {}],
  ['善彦・自分が先手', opponent, { aColor: 'black' }],
  ['善彦・自分が後手', opponent, { aColor: 'white' }],
  ['能力は同じで名前を変更', { ...opponent, name: '匿名', story: null }, {}],
  ['善彦の特殊能力のみ無し', { ...opponent, character: { ...opponent.character, traits: [] } }, {}],
  ['補正能力なしの相手', { ...opponent, character: null, repertoire: null }, {}],
];
for (const [label, member, options] of cases) {
  const rng = createRng(20261118);
  let wins = 0;
  let expected = 0;
  let min = 1;
  let max = 0;
  for (let index = 0; index < games; index += 1) {
    const result = simulateMemberGame(rng, user, member, options);
    wins += Number(result.aWins);
    expected += result.probability;
    min = Math.min(min, result.probability);
    max = Math.max(max, result.probability);
  }
  console.log(JSON.stringify({ label, games, wins, observed: wins / games, actualMean: expected / games, actualMin: min, actualMax: max }));
}
