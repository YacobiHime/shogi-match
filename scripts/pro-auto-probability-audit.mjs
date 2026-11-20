// 分身の旧表示61%の調査と、修正後の表示61%に対する抽選の一致を照合する。
// node scripts/pro-auto-probability-audit.mjs [局数（各条件、既定100000）]
import { createRoster } from '../src/core/ryuo-roster.mjs';
import { YOSHIHIKO } from '../src/core/ryuo-story.mjs';
import { simulateMemberGame } from '../src/core/ryuo-simulation.mjs';
import { createRng } from '../src/core/ryuo-random.mjs';
import { winProbability } from '../src/core/ryuo-strength.mjs';
import { proAutoChance, simulateProAutoGame } from '../src/core/pro-auto-game.mjs';

const games = Number(process.argv[2] ?? 100000);
if (!Number.isSafeInteger(games) || games < 1) throw new Error('局数は正の整数で指定してください');
const roster = createRoster({ seed: 11, userGroup: 6 });
const opponent = Object.values(roster.players).find(player => player.story === YOSHIHIKO);
// 調子・研究・成長を足した後の実効レーティング差を「61%」に合わせる。
const user = { id: 'user', name: '検証用', kind: 'pro', rating: opponent.rating + 400 * Math.log10(0.61 / 0.39) };
console.log(JSON.stringify({ legacyDisplayedPercent: Math.round(winProbability(user.rating, opponent.rating) * 100), gamesPerCase: games, seed: 20261118 }));
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


// 修正後の入口を使い、表示が61%となる強さで表示と抽選を照合する。
for (const color of ['black', 'white']) {
  const state = {
    rng: 20261118, condition: 2,
    players: { user: { ...user }, [opponent.id]: opponent },
    pending: { gameId: 'audit', opponentId: opponent.id, color, prep: { stars: 0 } },
    games: { audit: { a: color === 'black' ? 'user' : opponent.id, b: color === 'black' ? opponent.id : 'user' } },
  };
  let low = opponent.rating - 400;
  let high = opponent.rating + 400;
  for (let i = 0; i < 45; i += 1) {
    state.players.user.rating = (low + high) / 2;
    if (proAutoChance(state) < 0.61) low = state.players.user.rating;
    else high = state.players.user.rating;
  }
  const rng = createRng(20261118);
  let wins = 0;
  let expected = 0;
  let maxDifference = 0;
  for (let i = 0; i < games; i += 1) {
    state.rng = rng.state;
    const shown = proAutoChance(state);
    const result = simulateProAutoGame(state, rng);
    expected += shown;
    wins += Number(result.aWins);
    maxDifference = Math.max(maxDifference, Math.abs(shown - result.probability));
    if (result.aColor !== color) throw new Error('対局の先後が一致しません');
  }
  console.log(JSON.stringify({ label: `修正後の表示61%・${color}`, games, wins, observed: wins / games, displayedMean: expected / games, maxDifference }));
  if (maxDifference > 1e-12) throw new Error('表示と抽選の確率が一致しません');
}
