#!/usr/bin/env node
// 観戦する対局をエンジンが本当に指す形(docs/tournament-relay-design.mdの20章)の段階0の見積もり。
// CPU同士の自己対局で測ったLvごとの強さ(scripts/cpu-level-selfplay.mjs の --out のJSON)から、
// 名簿の棋士どうしをエンジンで指させたときの勝率を出し、いまの自動対局(Elo式)と比べる。エンジンは使わない。
//
// 比べるもの:
//   elo   … いまの自動対局。名簿のレーティングの差をそのままElo式に(ryuo-simulation.mjs。上乗せは除く)。
//   world … エンジン同士を、プレイヤーと同じ世界の物差し(Lvの差 = 0.6 × レーティングの差 ÷ 60)のLvで指させる。
//   fit   … エンジン同士の勝率がeloに合うように、倍率を選び直したLvで指させる。
//
// 使い方: node scripts/engine-world-sim.mjs --ladder <自己対局のJSON> [--worlds 12,20,28,36,42] [--seed 52] [--trials 4000]
import fs from 'node:fs';
import { createRoster } from '../src/core/ryuo-roster.mjs';
import { createRng } from '../src/core/ryuo.mjs';
import {
  GROUP_MEAN_RATING, MAX_CPU_LEVEL, MIN_CPU_LEVEL, RATING_PER_LEVEL, WORLD_BASE_RATING, WORLD_SPREAD, winProbability, worldRating,
} from '../src/core/ryuo-strength.mjs';

const option = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const ladderPath = option('ladder', '');
if (!ladderPath) throw new Error('--ladder に自己対局のJSONを渡してください');
const WORLDS = option('worlds', '12,20,28,36,42').split(',').map(Number);
const SEED = Number(option('seed', '52'));
const TRIALS = Number(option('trials', '4000'));
/** プレイヤーの棋力と世界の基準Lvの差(recommendedWorldLevel。6組の平均に7割)。 */
const PLAYER_MARGIN = 2.45;

// ---- 自己対局の強さ(Lv → レーティング)。測った点を直線でつなぎ、外は端の傾きで延ばす。
const ladder = JSON.parse(fs.readFileSync(ladderPath, 'utf8'));
const points = (ladder.ratings ?? [])
  .map(({ player, rating, se }) => ({ level: Number(/^L(\d+)$/.exec(player)?.[1]), rating, se }))
  .filter(({ level }) => Number.isFinite(level))
  .sort((a, b) => a.level - b.level);
if (points.length < 2) throw new Error('Lvの点が2つ以上いります');
function selfplay(level) {
  const at = Math.max(1, points.findIndex((point) => point.level >= level));
  const [a, b] = level <= points[0].level ? [points[0], points[1]] : level >= points.at(-1).level ? [points.at(-2), points.at(-1)] : [points[at - 1], points[at]];
  return a.rating + ((b.rating - a.rating) * (level - a.level)) / (b.level - a.level);
}
const clampLevel = (level) => Math.min(MAX_CPU_LEVEL, Math.max(MIN_CPU_LEVEL, Math.round(level)));
const levelOf = (rating, world, spread) => clampLevel(world + (spread * (rating - WORLD_BASE_RATING)) / RATING_PER_LEVEL);
const engineP = (levelA, levelB) => winProbability(selfplay(levelA), selfplay(levelB));

// ---- 名簿(組ごとの棋士のレーティング)。
const roster = createRoster({ seed: SEED, userGroup: 6 });
const members = Object.values(roster.players).filter((member) => member.group >= 1 && member.group <= 6 && Number.isFinite(member.rating));
const byGroup = Object.fromEntries([1, 2, 3, 4, 5, 6].map((group) => [group, members.filter((member) => member.group === group).map(({ rating }) => rating)]));
const holderRating = Math.max(...members.map(({ rating }) => rating));

/** 同じ組の2人を何組も取り、モデルごとの勝率を並べる(強い方から見た勝率)。 */
function pairs(rng, count = 3000) {
  const list = [];
  for (let index = 0; index < count; index += 1) {
    const group = 1 + Math.floor(rng.next() * 6);
    const pool = byGroup[group];
    const a = pool[Math.floor(rng.next() * pool.length)];
    const b = pool[Math.floor(rng.next() * pool.length)];
    if (a !== b) list.push([Math.max(a, b), Math.min(a, b)]);
  }
  return list;
}

/** eloに合うように選んだ倍率(勝率の差の2乗の平均がいちばん小さい)。 */
function fitSpread(world, list) {
  let best = { spread: WORLD_SPREAD, error: Infinity };
  for (let spread = 0.4; spread <= 2.5 + 1e-9; spread += 0.05) {
    let error = 0;
    for (const [a, b] of list) error += (engineP(levelOf(a, world, spread), levelOf(b, world, spread)) - winProbability(a, b)) ** 2;
    error /= list.length;
    if (error < best.error) best = { spread: Math.round(spread * 100) / 100, error };
  }
  return best;
}

/** 1つの組のトーナメント(人数sizeを名簿の組から無作為に)を何回も行い、いちばん強い棋士が優勝する割合。 */
function topWins(rng, group, size, probability) {
  let wins = 0;
  for (let trial = 0; trial < TRIALS; trial += 1) {
    const pool = [...byGroup[group]].sort(() => rng.next() - 0.5).slice(0, size);
    const top = Math.max(...pool);
    let round = pool;
    while (round.length > 1) {
      const next = [];
      for (let index = 0; index + 1 < round.length; index += 2) {
        const [a, b] = [round[index], round[index + 1]];
        next.push(rng.next() < probability(a, b) ? a : b);
      }
      if (round.length % 2) next.push(round.at(-1));
      round = next;
    }
    if (round[0] === top) wins += 1;
  }
  return wins / TRIALS;
}

const pct = (value) => `${Math.round(value * 100)}%`;
const rng = createRng(SEED);

// ---- 自己対局の1局(Lvの組ごとの、1局の時間・手数・終わり方)。時間は1コアでの値(並列で指したときの1局ずつ)。
const games = (ladder.games ?? []).filter((game) => !game.error);
if (games.length) {
  const reasons = {};
  for (const game of games) reasons[game.reason] = (reasons[game.reason] ?? 0) + 1;
  console.log(`自己対局 ${games.length}局。終わり方: ${Object.entries(reasons).map(([reason, count]) => `${reason} ${count}(${pct(count / games.length)})`).join('、')}`);
  console.log('');
  console.log('| 組 | 局数 | 1局の時間(秒、平均・最大) | 手数(平均) |');
  console.log('| --- | ---: | ---: | ---: |');
  const groups = new Map();
  for (const game of games) {
    const key = [game.black, game.white].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))).join('-');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(game);
  }
  for (const [key, list] of [...groups.entries()].sort(([a], [b]) => Number(a.split('-')[0].slice(1)) - Number(b.split('-')[0].slice(1)))) {
    const seconds = list.map((game) => (game.ms ?? 0) / 1000);
    console.log(`| ${key} | ${list.length} | ${Math.round(seconds.reduce((a, b) => a + b, 0) / list.length)}・${Math.round(Math.max(...seconds))} | ${Math.round(list.reduce((sum, game) => sum + game.plies, 0) / list.length)} |`);
  }
  console.log('');
}
const list = pairs(rng);
console.log(`自己対局の強さ: ${points.map(({ level, rating, se }) => `L${level}=${Math.round(rating)}(±${Math.round(se ?? 0)})`).join(' ')}`);
console.log(`名簿: ${members.length}人、竜王のレーティング${holderRating}、組の平均 ${Object.entries(GROUP_MEAN_RATING).map(([g, r]) => `${g}組${r}`).join(' ')}`);
console.log('');
console.log('| 世界の基準Lv | 倍率(fit) | 同じ組の2人の勝率(強い方) elo / world / fit | 6組32人で最強が優勝 elo / world / fit | 1組8人で最強が優勝 elo / world / fit | 竜王vs1組の平均 elo / world / fit | 端(Lv1・49)に当たる棋士 world / fit |');
console.log('| ---: | ---: | --- | --- | --- | --- | --- |');
for (const world of WORLDS) {
  const { spread } = fitSpread(world, list);
  const models = {
    elo: (a, b) => winProbability(a, b),
    world: (a, b) => engineP(levelOf(a, world, WORLD_SPREAD), levelOf(b, world, WORLD_SPREAD)),
    fit: (a, b) => engineP(levelOf(a, world, spread), levelOf(b, world, spread)),
  };
  const mean = (probability) => list.reduce((sum, [a, b]) => sum + probability(a, b), 0) / list.length;
  const clamped = (s) => members.filter(({ rating }) => {
    const raw = Math.round(world + (s * (rating - WORLD_BASE_RATING)) / RATING_PER_LEVEL);
    return raw < MIN_CPU_LEVEL || raw > MAX_CPU_LEVEL;
  }).length / members.length;
  const row = (fn) => ['elo', 'world', 'fit'].map((key) => pct(fn(models[key]))).join(' / ');
  console.log(`| ${world} | ${spread} | ${row(mean)} | ${row((p) => topWins(rng, 6, Math.min(32, byGroup[6].length), p))} | ${row((p) => topWins(rng, 1, Math.min(8, byGroup[1].length), p))} | ${row((p) => p(holderRating, GROUP_MEAN_RATING[1]))} | ${pct(clamped(WORLD_SPREAD))} / ${pct(clamped(spread))} |`);
}

// 分身(プレイヤーの棋力のLv)の勝率。いまの自動対局は、分身のレーティング(worldRating)と相手のレーティングのElo式。
// エンジンで指すと、分身のLvと相手のLv(世界の物差し)の自己対局の強さの差。プレイヤー自身が指したときの見込みは1Lv=R60。
console.log('');
console.log('| 世界の基準Lv | 分身のLv | 相手 | いまの自動対局 | エンジン(world) | プレイヤー自身(1Lv=R60) |');
console.log('| ---: | ---: | --- | ---: | ---: | ---: |');
for (const world of WORLDS) {
  const level = clampLevel(world + PLAYER_MARGIN);
  const avatarRating = worldRating(world + PLAYER_MARGIN, world);
  for (const [label, rating] of [['6組の平均', GROUP_MEAN_RATING[6]], ['1組の平均', GROUP_MEAN_RATING[1]], ['竜王', holderRating]]) {
    const opponent = levelOf(rating, world, WORLD_SPREAD);
    const exact = world + (WORLD_SPREAD * (rating - WORLD_BASE_RATING)) / RATING_PER_LEVEL;
    console.log(`| ${world} | ${level} | ${label}(Lv${opponent}) | ${pct(winProbability(avatarRating, rating))} | ${pct(engineP(level, opponent))} | ${pct(winProbability((world + PLAYER_MARGIN) * RATING_PER_LEVEL, exact * RATING_PER_LEVEL))} |`);
  }
}
