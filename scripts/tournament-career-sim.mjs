#!/usr/bin/env node
// 世界の物差し(docs/tournament-strength-spread-design.md)の確かめ。プレイヤーに竜王戦を何期も指させ、
// 居場所(どの組に落ち着くか)・竜王を取る見込み・1局ごとの勝率を測る。勝ち負けは、指すLvの差からEloの式(1Lv=R60)で決める。
//
// 使い方: node scripts/tournament-career-sim.mjs [--careers 40] [--seasons 20] [--level 20] [--scale 3] [--spread 0.6] [--growth 0,0.3,0.5]
import { createCareer, applySeason, nextEntry } from '../src/core/ryuo-career.mjs';
import { USER_ID, createRng, createSeason, recordUserGame, scaleById } from '../src/core/ryuo.mjs';
import { applySeasonToRoster, createRoster } from '../src/core/ryuo-roster.mjs';
import { recommendedDifficulty, recommendedWorldLevel, winProbability } from '../src/core/ryuo-strength.mjs';

const option = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? Number(process.argv[index + 1]) : fallback;
};
const CAREERS = option('careers', 40);
const SEASONS = option('seasons', 20);
const START_LEVEL = option('level', 20);
const SCALE = option('scale', 3);
const SPREAD = option('spread', NaN);
const GROWTHS = String(process.argv[process.argv.indexOf('--growth') + 1] ?? '').includes(',') ? process.argv[process.argv.indexOf('--growth') + 1].split(',').map(Number) : [0, 0.3, 0.5];

/**
 * 1人のキャリア。growthは1期ごとの棋力の伸び(Lv)。世界は最初の期におすすめで決め、そのまま使い続ける。
 * @returns {{ groups: number[], titleSeason: number | null, firstTitle: number | null, games: { phase: string, group: number, win: number }[] }}
 */
function career(seed, growth) {
  const rng = createRng(seed);
  let level = START_LEVEL;
  const difficulty = recommendedDifficulty(level);
  const world = recommendedWorldLevel(level);
  let state = createCareer();
  let roster = createRoster({ seed, userGroup: 6 });
  const groups = [];
  const games = [];
  let firstTitle = null;
  for (let no = 1; no <= SEASONS; no += 1) {
    const entry = nextEntry(state);
    let season = createSeason({
      ...entry, settings: { difficulty, scale: SCALE, revival: true, world, ...(Number.isFinite(SPREAD) ? { worldSpread: SPREAD } : {}) }, userLevel: level, career: state, roster, seed: seed * 100 + no,
    });
    let guard = 0;
    while (season.phase !== 'done' && guard < 400) {
      const opponent = season.players[season.pending.opponentId];
      const p = winProbability(level * 60, opponent.level * 60);
      const won = rng.next() < p;
      games.push({ phase: season.phase, group: entry.group, win: p });
      season = recordUserGame(season, won ? 'win' : 'loss');
      guard += 1;
    }
    const applied = applySeason(state, season);
    state = applied.career;
    if (state.champion && firstTitle === null) firstTitle = no;
    roster = applySeasonToRoster(roster, season, { userGroup: state.group, promote: scaleById(SCALE).promote });
    groups.push(state.champion ? 0 : state.group);
    level += growth;
  }
  return { groups, firstTitle, games, titles: state.titles };
}

for (const growth of GROWTHS) {
  const results = Array.from({ length: CAREERS }, (_, index) => career(1000 + index, growth));
  const at = (season) => {
    const counts = new Map();
    for (const { groups } of results) counts.set(groups[season - 1], (counts.get(groups[season - 1]) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([group, count]) => `${group === 0 ? '竜王' : `${group}組`}${Math.round((count / CAREERS) * 100)}%`).join(' ');
  };
  const titled = (seasons) => results.filter(({ firstTitle }) => firstTitle !== null && firstTitle <= seasons).length / CAREERS;
  const winBy = (filter) => {
    const list = results.flatMap(({ games }) => games).filter(filter);
    return list.length ? `${Math.round((list.reduce((sum, game) => sum + game.win, 0) / list.length) * 100)}%(${list.length}局)` : '—';
  };
  console.log(`\n■ 差${Number.isFinite(SPREAD) ? SPREAD : '既定'}倍・棋力Lv${START_LEVEL}から、1期ごとに+${growth}Lv(${CAREERS}人×${SEASONS}期、規模${scaleById(SCALE).label})`);
  for (const season of [1, 3, 5, 10, 20].filter((value) => value <= SEASONS)) console.log(`  ${season}期のあと: ${at(season)}`);
  console.log(`  竜王を取った人: 5期まで${Math.round(titled(5) * 100)}%・10期まで${Math.round(titled(10) * 100)}%・${SEASONS}期まで${Math.round(titled(SEASONS) * 100)}%`);
  console.log(`  1局の見込み勝率: 6組${winBy((game) => game.phase === 'ranking' && game.group === 6)}・3組${winBy((game) => game.phase === 'ranking' && game.group === 3)}・1組${winBy((game) => game.phase === 'ranking' && game.group === 1)}・決勝T${winBy((game) => game.phase === 'main')}・番勝負${winBy((game) => game.phase === 'finals' || game.phase === 'playoff')}`);
}
void USER_ID;
