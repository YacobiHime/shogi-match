// 竜王戦の再現(大会モード)。画面に依存しない。
// 全員のトーナメント表を作り、プレイヤー以外の対局は棋力から自動で決める。プレイヤーの対局だけを、実際に指す。
// 制度の要点(6組のランキング戦→敗者復活→決勝トーナメント→挑戦者決定三番勝負→七番勝負)を、
// 規模を縮小して再現する簡易版で、実際の規定そのものではない。出典は docs/ryuo-sen-research.md。

import { aggregateSeasonStats } from './ryuo-stats.mjs';
import {
  GIVEN_NAMES,
  GROUP_DAN_WEIGHTS,
  GROUP_LEVEL_SPREAD,
  GROUP_MEAN_LEVEL,
  OPPONENT_STYLES,
  SURNAMES,
  WOMEN_GIVEN_NAMES,
} from './ryuo-data.mjs';

export const USER_ID = 'user';
export const CHAMPION_ID = 'champion';
export const GROUPS = Object.freeze([1, 2, 3, 4, 5, 6]);

const REAL_SIZES = Object.freeze({ 1: 16, 2: 16, 3: 16, 4: 32, 5: 32, 6: 64 });

/**
 * 規模(5段階)。組の人数・決勝トーナメントの人数・昇級(降級)枠を、割合で減らす。番勝負の数は変えない。
 * slotsは、決勝トーナメントに進む人数(組ごと)。promoteは昇級(降級)の人数。
 */
export const SCALES = Object.freeze([
  { id: 1, label: '最小', sizes: { 1: 4, 2: 4, 3: 4, 4: 4, 5: 4, 6: 8 }, slots: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 }, promote: 1 },
  { id: 2, label: '小', sizes: { 1: 4, 2: 4, 3: 4, 4: 8, 5: 8, 6: 16 }, slots: { 1: 2, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 }, promote: 1 },
  { id: 3, label: '中', sizes: { 1: 8, 2: 8, 3: 8, 4: 16, 5: 16, 6: 32 }, slots: { 1: 3, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 }, promote: 2 },
  { id: 4, label: '大', sizes: { 1: 12, 2: 12, 3: 12, 4: 24, 5: 24, 6: 48 }, slots: { 1: 4, 2: 2, 3: 1, 4: 1, 5: 1, 6: 1 }, promote: 3 },
  { id: 5, label: '実物', sizes: REAL_SIZES, slots: { 1: 5, 2: 2, 3: 1, 4: 1, 5: 1, 6: 1 }, promote: 4 },
]);

export const DIFFICULTY_LEVELS = 12;
/** 基準の難易度。2026-10-10に下へ2段階足したので、以前の5がこの7にあたる。 */
export const BASE_DIFFICULTY = 7;
const LEVELS_PER_DIFFICULTY = 4;
const SIM_ELO_PER_LEVEL = 50;
const MAX_CPU_LEVEL = 40;

export const scaleById = (id) => SCALES.find((scale) => scale.id === id) ?? SCALES[2];

/** 難易度(1〜12)での、全体のLvのずれ。7が基準で、1段階ごとに4レベル動く。 */
export function levelShift(difficulty) {
  return (Math.min(DIFFICULTY_LEVELS, Math.max(1, Math.round(difficulty))) - BASE_DIFFICULTY) * LEVELS_PER_DIFFICULTY;
}

/** 難易度での、その組の相手のLvの平均。 */
export function groupMeanLevel(group, difficulty) {
  return Math.min(MAX_CPU_LEVEL, Math.max(0, GROUP_MEAN_LEVEL[group] + levelShift(difficulty)));
}

/** おすすめの難易度。6組の相手のLvの平均が、プレイヤーの棋力(Lv)に近くなる難易度。 */
export function recommendedDifficulty(playerLevel) {
  const difficulty = Math.round((playerLevel - GROUP_MEAN_LEVEL[6]) / LEVELS_PER_DIFFICULTY + BASE_DIFFICULTY);
  return Math.min(DIFFICULTY_LEVELS, Math.max(1, difficulty));
}

// ---- 乱数(状態を保存して、続きから再現できる)

/** seedは、最初の種でも、保存した状態(`rng.state`)でもよい。後者を渡すと、続きから同じ乱数列になる。 */
export function createRng(seed) {
  let state = seed >>> 0;
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    get state() { return state; },
  };
}

function gauss(rng) {
  const u = Math.max(rng.next(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng.next());
}

function pick(rng, list) {
  return list[Math.min(list.length - 1, Math.floor(rng.next() * list.length))];
}

function weightedPick(rng, entries) {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rng.next() * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll < 0) return value;
  }
  return entries.at(-1)[0];
}

// ---- 棋士の生成

const clampLevel = (level) => Math.min(MAX_CPU_LEVEL, Math.max(3, Math.round(level)));

/** 自動対局の勝率。棋力(Lv)の差を、1Lvあたり50点のレーティング差として扱う。 */
export function winProbability(levelA, levelB) {
  return 1 / (1 + 10 ** (((levelB - levelA) * SIM_ELO_PER_LEVEL) / 400));
}

function newName(rng, used, women = false) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const name = `${pick(rng, SURNAMES)}${pick(rng, women ? WOMEN_GIVEN_NAMES : GIVEN_NAMES)}`;
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
  }
  const name = `${pick(rng, SURNAMES)}${pick(rng, GIVEN_NAMES)}${used.size}`;
  used.add(name);
  return name;
}

/**
 * 1組分の棋士を作る。6組には、女流棋士・奨励会員・アマチュアを混ぜる。
 * @param {{ group: number, size: number, difficulty: number, rng: ReturnType<typeof createRng>, used: Set<string>, prefix?: string }} options
 */
export function generateGroupField({ group, size, difficulty, rng, used, prefix = `g${group}` }) {
  const mean = groupMeanLevel(group, difficulty);
  const spread = GROUP_LEVEL_SPREAD[group];
  // 6組の枠の内訳(実物は女流4・奨励会1・アマ5)。規模に合わせて、人数に比例して減らす。
  const specials = group === 6
    ? [
      ...Array(Math.max(1, Math.round(size * 5 / 72))).fill('amateur'),
      ...Array(Math.max(1, Math.round(size * 4 / 72))).fill('woman'),
      ...Array(size >= 16 ? 1 : 0).fill('shoreikai'),
    ].slice(0, Math.max(0, size - 2))
    : [];
  const players = [];
  for (let index = 0; index < size; index += 1) {
    const kind = specials[index] ?? 'pro';
    const offset = { pro: 0, amateur: -2, woman: 0.5, shoreikai: 2 }[kind];
    const style = pick(rng, OPPONENT_STYLES);
    players.push({
      id: `${prefix}-${index + 1}`,
      name: newName(rng, used, kind === 'woman'),
      dan: kind === 'amateur' ? 'アマ' : kind === 'woman' ? '女流二段' : kind === 'shoreikai' ? '奨励会三段' : weightedPick(rng, GROUP_DAN_WEIGHTS[group]),
      kind,
      group,
      level: clampLevel(mean + offset + gauss(rng) * spread),
      style: { id: style.id, label: style.label, strategy: style.strategy, castle: style.castle, rook: style.rook },
    });
  }
  return players;
}

// ---- トーナメント表(木構造)

function seedOrder(size) {
  let order = [1];
  for (let n = 2; n <= size; n *= 2) order = order.flatMap((seed) => [seed, n + 1 - seed]);
  return order;
}

const sidePid = (bracket, side) => (side ? (side.pid ?? bracket.nodes[side.from].winner) : null);

function setRounds(bracket) {
  const height = (side) => (side?.from ? bracket.nodes[side.from].round : 0);
  const visit = (side) => {
    if (!side?.from) return;
    const node = bracket.nodes[side.from];
    visit(node.a);
    visit(node.b);
    node.round = Math.max(height(node.a), height(node.b)) + 1;
  };
  visit(bracket.root);
  bracket.rounds = bracket.root?.from ? bracket.nodes[bracket.root.from].round : 0;
  return bracket;
}

/** シード順(強い順)の棋士から、標準のシードでトーナメント表を作る。人数が2の累乗でないときは、上位のシードが不戦勝になる。 */
export function buildSeededBracket(label, ids, prefix) {
  const count = ids.length;
  const nodes = {};
  if (count === 0) return { label, ids: [], nodes, root: null, rounds: 0 };
  const size = 2 ** Math.ceil(Math.log2(Math.max(count, 2)));
  let level = seedOrder(size).map((seed) => (seed <= count ? { pid: ids[seed - 1] } : null));
  let counter = 0;
  while (level.length > 1) {
    const next = [];
    for (let index = 0; index < level.length; index += 2) {
      const a = level[index];
      const b = level[index + 1];
      if (!a && !b) next.push(null);
      else if (!a) next.push(b);
      else if (!b) next.push(a);
      else {
        counter += 1;
        const id = `${prefix}-m${counter}`;
        nodes[id] = { id, a, b, winner: null, round: 0 };
        next.push({ from: id });
      }
    }
    level = next;
  }
  return setRounds({ label, ids: [...ids], nodes, root: level[0] });
}

/**
 * 決勝トーナメント(本戦)の表。上の組の上位者ほど、挑戦者決定戦に近い位置に入る。
 * 重みの小さい(弱い)2人から順に対戦させて木を作る(実際の竜王戦の、必要な勝数に合わせた重み)。
 * @param {{ pid: string, weight: number }[]} entrants 強い順
 */
export function buildMainBracket(entrants, prefix = 'main') {
  const nodes = {};
  let items = entrants.map(({ pid, weight }, index) => ({ weight, side: { pid }, seed: index }));
  let counter = 0;
  while (items.length > 1) {
    items.sort((x, y) => x.weight - y.weight || y.seed - x.seed);
    const [first, second, ...rest] = items;
    counter += 1;
    const id = `${prefix}-m${counter}`;
    nodes[id] = { id, a: first.side, b: second.side, winner: null, round: 0 };
    items = [...rest, { weight: first.weight + second.weight, side: { from: id }, seed: Math.min(first.seed, second.seed) }];
  }
  return setRounds({ label: '決勝トーナメント', ids: entrants.map(({ pid }) => pid), nodes, root: items[0]?.side ?? null });
}

/** 決勝トーナメントの、出場者の重み(実物の「挑戦者決定戦までに必要な勝数」に対応)。 */
const MAIN_WEIGHTS = Object.freeze({
  1: [0.25, 0.125, 0.125, 0.125, 0.0625],
  2: [0.125, 0.0625],
  3: [0.0625],
  4: [0.03125],
  5: [0.015625],
  6: [0.015625],
});

const rootNodeId = (bracket) => bracket.root?.from ?? null;
const sortedNodes = (bracket) => Object.values(bracket.nodes).sort((x, y) => x.round - y.round || (x.id < y.id ? -1 : 1));

function readyNodes(bracket, { stopAtRoot = false } = {}) {
  return sortedNodes(bracket).filter((node) => (
    node.winner === null
    && !(stopAtRoot && node.id === rootNodeId(bracket))
    && sidePid(bracket, node.a) && sidePid(bracket, node.b)
  ));
}

/**
 * プレイヤー以外の対局を、棋力から自動で決めて進める。プレイヤーの対局が来たら止まる。
 * @returns {{ state: 'user', nodeId: string } | { state: 'root', nodeId: string } | { state: 'finished' }}
 */
export function advanceBracket(bracket, players, rng, userId = USER_ID, { stopAtRoot = false } = {}) {
  for (;;) {
    const ready = readyNodes(bracket, { stopAtRoot });
    if (!ready.length) break;
    for (const node of ready) {
      const a = sidePid(bracket, node.a);
      const b = sidePid(bracket, node.b);
      if (a === userId || b === userId) return { state: 'user', nodeId: node.id };
      node.winner = rng.next() < winProbability(players[a].level, players[b].level) ? a : b;
    }
  }
  const rootId = rootNodeId(bracket);
  if (!rootId) return { state: 'finished' };
  const root = bracket.nodes[rootId];
  if (root.winner !== null) return { state: 'finished' };
  return stopAtRoot && sidePid(bracket, root.a) && sidePid(bracket, root.b)
    ? { state: 'root', nodeId: rootId }
    : { state: 'finished' };
}

export function bracketChampion(bracket) {
  if (!bracket.root) return null;
  return bracket.root.pid ?? bracket.nodes[bracket.root.from].winner;
}

/** 決勝の敗者(準優勝)。 */
export function bracketRunnerUp(bracket) {
  const rootId = rootNodeId(bracket);
  if (!rootId) return null;
  const root = bracket.nodes[rootId];
  if (root.winner === null) return null;
  return [sidePid(bracket, root.a), sidePid(bracket, root.b)].find((pid) => pid !== root.winner) ?? null;
}

/** 各棋士の、この表での勝ち数と、負けた回戦(負けていなければnull)。 */
export function bracketRecords(bracket) {
  const records = {};
  for (const pid of bracket.ids) records[pid] = { wins: 0, lostRound: null };
  for (const node of Object.values(bracket.nodes)) {
    if (node.winner === null) continue;
    const a = sidePid(bracket, node.a);
    const b = sidePid(bracket, node.b);
    records[node.winner].wins += 1;
    const loser = node.winner === a ? b : a;
    records[loser].lostRound = node.round;
  }
  return records;
}

// ---- 番勝負

export function createSeries(label, a, b, need) {
  return { label, a, b, need, wins: { [a]: 0, [b]: 0 }, games: [], winner: null };
}

export function recordSeriesGame(series, winner) {
  if (series.winner !== null) return series;
  series.wins[winner] += 1;
  series.games.push({ winner });
  if (series.wins[winner] >= series.need) series.winner = winner;
  return series;
}

function simulateSeries(series, players, rng) {
  while (series.winner === null) {
    const pa = winProbability(players[series.a].level, players[series.b].level);
    recordSeriesGame(series, rng.next() < pa ? series.a : series.b);
  }
}

// ---- 組の順位、昇級・降級

/**
 * 組の最終順位(上から)。優勝、準優勝、敗者復活の勝者、それ以外(敗者復活と本戦の勝ち数、シード順)の順。
 */
export function computeStandings(ranking, revivalBlocks, levels) {
  const records = bracketRecords(ranking);
  const champion = bracketChampion(ranking);
  const runnerUp = bracketRunnerUp(ranking);
  const revivalWins = {};
  const revivalWinners = [];
  for (const block of revivalBlocks) {
    for (const [pid, record] of Object.entries(bracketRecords(block))) revivalWins[pid] = record.wins;
    const winner = bracketChampion(block);
    if (winner) revivalWinners.push(winner);
  }
  const head = [champion, runnerUp, ...revivalWinners].filter(Boolean);
  const seedIndex = (pid) => ranking.ids.indexOf(pid);
  const rest = ranking.ids
    .filter((pid) => !head.includes(pid))
    .sort((x, y) => (
      (revivalWins[y] ?? 0) - (revivalWins[x] ?? 0)
      || records[y].wins - records[x].wins
      || (levels[y] ?? 0) - (levels[x] ?? 0)
      || seedIndex(x) - seedIndex(y)
    ));
  return [...head, ...rest];
}

/**
 * 敗者復活戦の枠(勝者の人数)。昇級(1組は決勝トーナメント進出)の枠のうち、ランキング戦の優勝・準優勝を除いた数。
 * 枠が残らない小さな規模でも、降級がある組には1名分を残す(降級を免れるための、残留の救済)。
 */
export function revivalSlots(group, scale) {
  const slots = group === 1 ? scale.slots[1] - 2 : scale.promote - 2;
  if (slots > 0) return slots;
  return group < 6 ? 1 : 0;
}

/**
 * 敗者復活戦の表を作る。ランキング戦で決勝の前に負けた棋士が出る。
 * 1組は負けた回戦ごと(準決勝敗者、準々決勝敗者…)、2組以下は成績順に交互に分けた表で、それぞれ1名が勝ち上がる。
 */
export function buildRevivalBlocks(group, ranking, slotCount, levels, prefix) {
  if (slotCount <= 0) return [];
  const records = bracketRecords(ranking);
  const pool = ranking.ids.filter((pid) => records[pid].lostRound !== null && records[pid].lostRound < ranking.rounds);
  let groups = [];
  if (group === 1) {
    const rounds = [...new Set(pool.map((pid) => records[pid].lostRound))].sort((x, y) => y - x);
    groups = rounds.slice(0, slotCount).map((round) => pool.filter((pid) => records[pid].lostRound === round));
  } else {
    const ordered = [...pool].sort((x, y) => records[y].wins - records[x].wins || (levels[y] ?? 0) - (levels[x] ?? 0));
    groups = Array.from({ length: Math.min(slotCount, ordered.length) }, () => []);
    ordered.forEach((pid, index) => {
      const lane = index % groups.length;
      const row = Math.floor(index / groups.length);
      // 蛇行に分けて、各表の強さをそろえる。
      groups[row % 2 === 0 ? lane : groups.length - 1 - lane].push(pid);
    });
  }
  return groups.filter((ids) => ids.length > 0).map((ids, index) => {
    const sorted = [...ids].sort((x, y) => (levels[y] ?? 0) - (levels[x] ?? 0));
    return buildSeededBracket(group === 1 ? `出場者決定戦 ${index + 3}位決定` : `昇級者決定戦 ${'ABCD'[index] ?? index + 1}`, sorted, `${prefix}-r${index + 1}`);
  });
}

export function resultRoundLabel(bracket, round, { series = false } = {}) {
  const from = bracket.rounds - round;
  if (from === 0) return series ? '挑戦者決定三番勝負' : '決勝';
  if (from === 1) return '準決勝';
  if (from === 2) return '準々決勝';
  return `${round}回戦`;
}

// ---- シーズン

function userDanFor(career) {
  if ((career?.titles ?? 0) >= 2 || career?.eternal) return '九段';
  if ((career?.titles ?? 0) >= 1) return '八段';
  if ((career?.bestGroup ?? 6) <= 1) return '七段';
  if ((career?.bestGroup ?? 6) <= 2) return '六段';
  return '四段';
}

export const userDan = userDanFor;

/**
 * シーズン(1期)を始める。プレイヤーの最初の対局、または終了まで、プレイヤー以外の対局を自動で進める。
 * @param {{
 *   no: number, mode: 'challenge' | 'defense', group: number,
 *   settings: { difficulty: number, scale: number, revival: boolean },
 *   userLevel: number, career?: object, seed?: number, userName?: string,
 * }} options
 */
export function createSeason({ no, mode, group, settings, userLevel, career, seed = Date.now(), userName = 'あなた' }) {
  const scale = scaleById(settings.scale);
  const rng = createRng(seed);
  const used = new Set([userName]);
  const season = {
    version: 2,
    id: seed,
    no,
    mode,
    startGroup: group,
    settings: { ...settings, scale: scale.id },
    players: {},
    phase: 'ranking',
    ranking: null,
    revival: [],
    standings: [],
    qualifiedFromGroup: [],
    qualified: [],
    main: null,
    playoff: null,
    finals: null,
    champion: null,
    defender: null,
    mainEntrants: [],
    pending: null,
    userGames: [],
    analysis: {},
    analysisQueue: [],
    result: null,
    rngState: 0,
  };
  season.players[USER_ID] = {
    id: USER_ID, name: userName, dan: userDanFor(career), kind: 'user', group, level: Math.round(userLevel), style: null,
  };
  const championLevel = clampLevel(groupMeanLevel(1, settings.difficulty) + 2);
  if (mode === 'defense') {
    season.champion = USER_ID;
    season.defender = USER_ID;
  } else {
    season.champion = CHAMPION_ID;
    season.defender = CHAMPION_ID;
    season.players[CHAMPION_ID] = {
      id: CHAMPION_ID, name: newName(rng, used), dan: '竜王', kind: 'pro', group: 1, level: championLevel,
      style: pickStyle(rng),
    };
  }
  if (mode === 'challenge') {
    const field = generateGroupField({ group, size: scale.sizes[group] - 1, difficulty: settings.difficulty, rng, used });
    for (const player of field) season.players[player.id] = player;
    const ids = Object.keys(season.players).filter((pid) => season.players[pid].group === group && pid !== CHAMPION_ID);
    const seedLevels = levelsOf(season);
    ids.sort((x, y) => seedLevels[y] - seedLevels[x]);
    season.ranking = buildSeededBracket(`${group}組ランキング戦`, ids, 'rk');
  } else {
    season.phase = 'prepare-defense';
  }
  season.used = [...used];
  return drive(season, rng);
}

function pickStyle(rng) {
  const style = pick(rng, OPPONENT_STYLES);
  return { id: style.id, label: style.label, strategy: style.strategy, castle: style.castle, rook: style.rook };
}

/**
 * 組み合わせと順位の同点処理に使う、各棋士の棋力。プレイヤーは、実際の棋力ではなく、組の平均として扱う
 * (棋力が低くても、毎回、組でいちばん強い相手に当たらないように)。
 */
const levelsOf = (season) => Object.fromEntries(Object.entries(season.players).map(([pid, player]) => [
  pid,
  pid === USER_ID ? groupMeanLevel(season.startGroup, season.settings.difficulty) : player.level,
]));

/** プレイヤーの組以外の組の、決勝トーナメント進出者を、自動で決める。 */
function simulateGroupQualifiers(season, group, rng) {
  const scale = scaleById(season.settings.scale);
  const used = new Set(season.used);
  const field = generateGroupField({ group, size: scale.sizes[group], difficulty: season.settings.difficulty, rng, used, prefix: `o${group}` });
  season.used = [...used];
  for (const player of field) season.players[player.id] = player;
  const ids = field.map(({ id }) => id).sort((x, y) => season.players[y].level - season.players[x].level);
  const ranking = buildSeededBracket(`${group}組`, ids, `o${group}rk`);
  advanceBracket(ranking, season.players, rng);
  const levels = levelsOf(season);
  const blocks = season.settings.revival ? buildRevivalBlocks(group, ranking, group === 1 ? scale.slots[1] - 2 : 0, levels, `o${group}`) : [];
  for (const block of blocks) advanceBracket(block, season.players, rng);
  return computeStandings(ranking, blocks, levels).slice(0, scale.slots[group]);
}

function buildMainFor(season, userGroupQualified, rng) {
  const entrants = [];
  for (const group of GROUPS) {
    const qualified = group === season.startGroup && userGroupQualified
      ? userGroupQualified
      : simulateGroupQualifiers(season, group, rng);
    qualified.forEach((pid, rank) => entrants.push({ pid, weight: MAIN_WEIGHTS[group][rank] ?? MAIN_WEIGHTS[group].at(-1), group, rank }));
  }
  season.qualified = entrants.map(({ pid }) => pid);
  season.mainEntrants = entrants.map(({ pid, group, rank }) => ({ pid, group, rank }));
  return buildMainBracket(entrants);
}

function seriesPendingFor(season, series, kind) {
  const userSide = series.a === USER_ID ? 'a' : 'b';
  const opponent = userSide === 'a' ? series.b : series.a;
  const gameNo = series.games.length + 1;
  return { kind, phase: season.phase, opponentId: opponent, gameNo, need: series.need, wins: { user: series.wins[USER_ID], opponent: series.wins[opponent] } };
}

/** 次のプレイヤーの対局の設定(手番は振り駒)。 */
function setPending(season, pending, rng) {
  // 対局の名前(例: 6組ランキング戦 2回戦)。結果の画面で、どこで敗退したかを示すのに使う。
  const label = pendingLabelFor(season, pending);
  const previous = season.userGames.at(-1);
  const sameSeries = pending.kind !== 'game' && previous && previous.phase === pending.phase && previous.seriesGame;
  // 番勝負は、1局目だけ振り駒で、あとは先後を入れ替える。
  const color = sameSeries ? (previous.color === 'black' ? 'white' : 'black') : (rng.next() < 0.5 ? 'black' : 'white');
  season.pending = { ...pending, color, label };
}

function finishSeason(season) {
  const user = USER_ID;
  const startGroup = season.startGroup;
  const reachedFinals = season.finals && season.finals.a !== undefined && (season.finals.a === user || season.finals.b === user);
  const wonFinals = reachedFinals && season.finals.winner === user;
  let outcome;
  if (wonFinals) outcome = 'champion';
  else if (reachedFinals) outcome = season.mode === 'defense' ? 'defense-lost' : 'finals-lost';
  else if (season.playoff && (season.playoff.a === user || season.playoff.b === user)) outcome = 'playoff-lost';
  else if (season.main && season.qualified.includes(user)) outcome = 'main-out';
  else outcome = 'ranking-out';
  const standingIndex = season.standings.indexOf(user);
  const scale = scaleById(season.settings.scale);
  const promote = season.mode === 'challenge' && startGroup > 1 && standingIndex >= 0 && standingIndex < scale.promote;
  const relegate = season.mode === 'challenge' && startGroup < 6 && standingIndex >= 0
    && standingIndex >= season.standings.length - scale.promote && !promote;
  let newGroup = startGroup;
  if (reachedFinals) newGroup = 1;
  else if (promote) newGroup = Math.max(1, startGroup - 1);
  else if (relegate) newGroup = Math.min(6, startGroup + 1);
  const wins = season.userGames.filter((game) => game.win).length;
  // どの段階まで進んで、どこで敗退したか。
  const path = [];
  const exitText = (bracket, pid, { series = false } = {}) => {
    const record = bracketRecords(bracket)[pid];
    if (bracketChampion(bracket) === pid) return '優勝';
    if (bracketRunnerUp(bracket) === pid) return '準優勝（決勝で敗退）';
    return record.lostRound !== null ? `${resultRoundLabel(bracket, record.lostRound, { series })}で敗退` : '';
  };
  if (season.ranking?.ids.includes(user)) path.push({ stage: 'ranking', label: season.ranking.label, text: exitText(season.ranking, user) });
  for (const block of season.revival) {
    if (block.ids.includes(user)) path.push({ stage: 'revival', label: block.label, text: exitText(block, user) });
  }
  if (season.main?.ids.includes(user)) {
    const record = bracketRecords(season.main)[user];
    path.push({
      stage: 'main',
      label: '決勝トーナメント',
      text: record.lostRound !== null ? `${resultRoundLabel(season.main, record.lostRound, { series: true })}で敗退` : '勝ち上がり（挑戦者決定三番勝負へ）',
    });
  }
  if (season.playoff && (season.playoff.a === user || season.playoff.b === user)) {
    path.push({
      stage: 'playoff', label: season.playoff.label,
      text: season.playoff.winner === user ? `${season.playoff.wins[user]}勝で挑戦者に` : `${season.playoff.wins[user]}勝${season.playoff.games.length - season.playoff.wins[user]}敗で敗退`,
    });
  }
  if (reachedFinals) {
    const losses = season.finals.games.length - season.finals.wins[user];
    path.push({
      stage: 'finals', label: season.finals.label,
      text: wonFinals ? `${season.finals.wins[user]}勝${losses}敗で、竜王に` : `${season.finals.wins[user]}勝${losses}敗で敗退`,
    });
  }
  const lastLoss = [...season.userGames].reverse().find((game) => !game.win);
  season.result = {
    path,
    exitLabel: outcome === 'champion' ? '' : (lastLoss?.label ?? ''),
    outcome,
    startGroup,
    newGroup,
    promoted: promote && newGroup < startGroup,
    relegated: relegate && newGroup > startGroup,
    challenger: reachedFinals && season.mode === 'challenge',
    champion: season.champion,
    wonTitle: outcome === 'champion',
    wins,
    losses: season.userGames.length - wins,
    standing: standingIndex >= 0 ? standingIndex + 1 : null,
  };
  season.phase = 'done';
  season.pending = null;
}

/** 状態を進める。プレイヤーの対局が来るか、シーズンが終わるまで。 */
function drive(season, rng) {
  for (let guard = 0; guard < 1000; guard += 1) {
    if (season.phase === 'ranking') {
      const advanced = advanceBracket(season.ranking, season.players, rng);
      if (advanced.state === 'user') {
        const node = season.ranking.nodes[advanced.nodeId];
        const opponent = sidePid(season.ranking, node.a) === USER_ID ? sidePid(season.ranking, node.b) : sidePid(season.ranking, node.a);
        setPending(season, { kind: 'game', phase: 'ranking', nodeId: advanced.nodeId, opponentId: opponent }, rng);
        break;
      }
      const scale = scaleById(season.settings.scale);
      const levels = levelsOf(season);
      const slotCount = revivalSlots(season.startGroup, scale);
      season.revival = season.settings.revival ? buildRevivalBlocks(season.startGroup, season.ranking, slotCount, levels, 'rv') : [];
      season.phase = 'revival';
      continue;
    }
    if (season.phase === 'revival') {
      let pendingUser = false;
      for (const block of season.revival) {
        const advanced = advanceBracket(block, season.players, rng);
        if (advanced.state === 'user') {
          const node = block.nodes[advanced.nodeId];
          const opponent = sidePid(block, node.a) === USER_ID ? sidePid(block, node.b) : sidePid(block, node.a);
          setPending(season, { kind: 'game', phase: 'revival', nodeId: advanced.nodeId, blockIndex: season.revival.indexOf(block), opponentId: opponent }, rng);
          pendingUser = true;
          break;
        }
      }
      if (pendingUser) break;
      // 勝敗が同じ人の中では、プレイヤーを下位に置く(初戦と敗者復活戦の初戦で負ければ、降級になる)。
      season.standings = computeStandings(season.ranking, season.revival, { ...levelsOf(season), [USER_ID]: -1 });
      const scale = scaleById(season.settings.scale);
      season.qualifiedFromGroup = season.standings.slice(0, scale.slots[season.startGroup]);
      season.phase = 'main-setup';
      continue;
    }
    if (season.phase === 'prepare-defense') {
      season.main = buildMainFor(season, null, rng);
      season.phase = 'main';
      continue;
    }
    if (season.phase === 'main-setup') {
      season.main = buildMainFor(season, season.qualifiedFromGroup, rng);
      season.phase = 'main';
      continue;
    }
    if (season.phase === 'main') {
      const advanced = advanceBracket(season.main, season.players, rng, USER_ID, { stopAtRoot: true });
      if (advanced.state === 'user') {
        const node = season.main.nodes[advanced.nodeId];
        const opponent = sidePid(season.main, node.a) === USER_ID ? sidePid(season.main, node.b) : sidePid(season.main, node.a);
        setPending(season, { kind: 'game', phase: 'main', nodeId: advanced.nodeId, opponentId: opponent }, rng);
        break;
      }
      const root = season.main.nodes[rootNodeId(season.main)];
      season.playoff = createSeries('挑戦者決定三番勝負', sidePid(season.main, root.a), sidePid(season.main, root.b), 2);
      season.phase = 'playoff';
      continue;
    }
    if (season.phase === 'playoff') {
      const series = season.playoff;
      if (series.winner === null && (series.a === USER_ID || series.b === USER_ID)) {
        setPending(season, seriesPendingFor(season, series, 'playoff'), rng);
        break;
      }
      simulateSeries(series, season.players, rng);
      season.main.nodes[rootNodeId(season.main)].winner = series.winner;
      const challenger = series.winner;
      season.finals = createSeries('竜王戦七番勝負', season.champion, challenger, 4);
      // 竜王が防衛側(a)、挑戦者がb。
      season.phase = 'finals';
      continue;
    }
    if (season.phase === 'finals') {
      const series = season.finals;
      if (series.winner === null && (series.a === USER_ID || series.b === USER_ID)) {
        setPending(season, seriesPendingFor(season, series, 'finals'), rng);
        break;
      }
      simulateSeries(series, season.players, rng);
      season.champion = series.winner;
      finishSeason(season);
      continue;
    }
    if (season.phase === 'done') break;
  }
  season.rngState = rng.state;
  return season;
}

/**
 * プレイヤーの対局の結果を記録して、シーズンを進める。
 * @param {object} season
 * @param {'win' | 'loss'} outcome
 */
export function recordUserGame(season, outcome) {
  const next = structuredClone(season);
  const pending = next.pending;
  if (!pending) return next;
  const rng = createRng(next.rngState);
  const win = outcome === 'win';
  const opponent = pending.opponentId;
  next.userGames.push({
    phase: pending.phase, opponentId: opponent, win, color: pending.color, seriesGame: pending.kind !== 'game',
    label: pending.label ?? '',
  });
  next.pending = null;
  if (pending.kind === 'game') {
    const bracket = pending.phase === 'ranking' ? next.ranking : pending.phase === 'revival' ? next.revival[pending.blockIndex] : next.main;
    bracket.nodes[pending.nodeId].winner = win ? USER_ID : opponent;
  } else {
    const series = pending.kind === 'playoff' ? next.playoff : next.finals;
    recordSeriesGame(series, win ? USER_ID : opponent);
  }
  return drive(next, rng);
}

// ---- 表示用

const playerBrief = (season, pid) => {
  const player = season.players[pid];
  return player ? { id: pid, name: player.name, dan: player.dan, level: player.level, kind: player.kind, style: player.style } : null;
};

export function playerView(season, pid) {
  return playerBrief(season, pid);
}

/**
 * 画面に木の形で描くための、トーナメント表の構造。
 * 葉(棋士)の順に左から並べ、各試合は、勝ち上がった2つの枝を結ぶ。labelsは、葉に添える短い文字(例: 1組優勝)。
 */
function treeView(season, bracket, labels = {}, pendingNodeId = null) {
  if (!bracket?.root) return null;
  const leafIds = [];
  const collect = (side) => {
    if (side.pid) leafIds.push(side.pid);
    else {
      const node = bracket.nodes[side.from];
      collect(node.a);
      collect(node.b);
    }
  };
  collect(bracket.root);
  const leaves = Object.fromEntries(leafIds.map((pid) => [pid, { ...playerBrief(season, pid), label: labels[pid] ?? '' }]));
  const nodes = Object.fromEntries(Object.values(bracket.nodes).map((node) => [
    node.id, { id: node.id, a: node.a, b: node.b, winner: node.winner, round: node.round },
  ]));
  return { root: bracket.root, rounds: bracket.rounds, leaves, nodes, pendingNodeId };
}

function bracketView(season, bracket, { series = false, labels = {}, pendingNodeId = null } = {}) {
  if (!bracket?.root) return { title: bracket?.label ?? '', rounds: [], tree: null };
  const rounds = [];
  for (const node of sortedNodes(bracket)) {
    const a = sidePid(bracket, node.a);
    const b = sidePid(bracket, node.b);
    const isRoot = node.id === rootNodeId(bracket);
    const row = rounds.find((entry) => entry.round === node.round)
      ?? (rounds.push({ round: node.round, label: resultRoundLabel(bracket, node.round, { series }), matches: [] }), rounds.at(-1));
    row.matches.push({
      id: node.id, a: a ? playerBrief(season, a) : null, b: b ? playerBrief(season, b) : null, winner: node.winner,
      user: a === USER_ID || b === USER_ID, final: isRoot,
    });
  }
  return { title: bracket.label, rounds, tree: treeView(season, bracket, labels, pendingNodeId) };
}

const PHASE_TEXT = Object.freeze({
  ranking: 'ランキング戦', revival: '敗者復活戦', 'main-setup': '決勝トーナメント', main: '決勝トーナメント',
  playoff: '挑戦者決定三番勝負', finals: '竜王戦七番勝負', done: '終了', 'prepare-defense': '防衛戦',
});

/**
 * 画面に出す内容。トーナメント表(進行中の段階まで)、次の対局の相手、結果。
 */
export function describeSeason(season) {
  const tables = [];
  const pending = season.pending;
  const pendingNode = (phase, blockIndex) => (
    pending?.kind === 'game' && pending.phase === phase && (blockIndex === undefined || pending.blockIndex === blockIndex) ? pending.nodeId : null
  );
  if (season.ranking) tables.push({ key: 'ranking', ...bracketView(season, season.ranking, { pendingNodeId: pendingNode('ranking') }) });
  season.revival.forEach((block, index) => tables.push({
    key: `revival-${index}`, ...bracketView(season, block, { pendingNodeId: pendingNode('revival', index) }),
  }));
  if (season.main) {
    const labels = Object.fromEntries((season.mainEntrants ?? []).map(({ pid, group, rank }) => [pid, `${group}組${rank === 0 ? '優勝' : `${rank + 1}位`}`]));
    tables.push({ key: 'main', ...bracketView(season, season.main, { series: true, labels, pendingNodeId: pendingNode('main') }) });
  }
  const seriesViews = [];
  for (const [key, series] of [['playoff', season.playoff], ['finals', season.finals]]) {
    if (!series) continue;
    seriesViews.push({
      key, label: series.label, need: series.need,
      a: playerBrief(season, series.a), b: playerBrief(season, series.b),
      wins: { a: series.wins[series.a], b: series.wins[series.b] }, winner: series.winner,
    });
  }
  const pendingView = season.pending
    ? { ...season.pending, opponent: playerBrief(season, season.pending.opponentId), label: pendingLabel(season) }
    : null;
  return {
    title: `第${season.no}期竜王戦`,
    mode: season.mode,
    startGroup: season.startGroup,
    phase: season.phase,
    phaseText: season.phase === 'ranking' || season.phase === 'revival'
      ? `${season.startGroup}組${PHASE_TEXT[season.phase]}`
      : PHASE_TEXT[season.phase],
    tables,
    series: seriesViews,
    pending: pendingView,
    result: season.result,
    resultSeen: season.resultSeen === true,
    champion: season.champion ? playerBrief(season, season.champion) : null,
    defender: season.defender ? playerBrief(season, season.defender) : null,
    stats: aggregateSeasonStats({
      records: season.analysis ?? {},
      games: season.userGames.map(({ win, color, label }) => ({ win, color, label })),
      pending: season.analysisQueue?.length ?? 0,
    }),
  };
}

function pendingLabelFor(season, pending) {
  if (pending.kind === 'playoff') return `挑戦者決定三番勝負 第${pending.gameNo}局`;
  if (pending.kind === 'finals') return `竜王戦七番勝負 第${pending.gameNo}局`;
  const bracket = pending.phase === 'ranking' ? season.ranking : pending.phase === 'revival' ? season.revival[pending.blockIndex] : season.main;
  const node = bracket.nodes[pending.nodeId];
  const round = resultRoundLabel(bracket, node.round);
  if (pending.phase === 'ranking') return `${season.startGroup}組ランキング戦 ${round}`;
  if (pending.phase === 'revival') return `${bracket.label} ${round}`;
  return `決勝トーナメント ${round}`;
}

const pendingLabel = (season) => season.pending.label ?? pendingLabelFor(season, season.pending);
