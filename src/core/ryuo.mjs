// 竜王戦の再現(大会モード)。画面に依存しない。
// 全員のトーナメント表を作り、プレイヤー以外の対局は棋力から自動で決める。プレイヤーの対局だけを、実際に指す。
// 制度の要点(6組のランキング戦→敗者復活→決勝トーナメント→挑戦者決定三番勝負→七番勝負)を、
// 規模を縮小して再現する簡易版で、実際の規定そのものではない。出典は docs/ryuo-sen-research.md。

import { aggregateSeasonStats } from './ryuo-stats.mjs';
import { createRng } from './ryuo-random.mjs';
import { USER_HOLDER, createRoster, seasonEntry, selectParticipants } from './ryuo-roster.mjs';
import { HANANE, HANANE_RIVAL_RUN_RATING, YOSHIHIKO, hananeAfterLine, hananeBeforeLine, hananeCoachIntro, hananeGrudgeBonus, yoshihikoCoachIntro } from './ryuo-story.mjs';
import { gameRecordOf, simulateMemberGame } from './ryuo-simulation.mjs';
import { matchBracket, seasonStages, seriesView, winsToPlayoff } from './ryuo-stages.mjs';
import { matchStakes, seasonGoalLine } from './ryuo-stakes.mjs';
import { opponentArrivalLine, previewRoad, seasonRoad } from './ryuo-road.mjs';
import { lastGameMilestone, latestUpsetLine } from './ryuo-milestone.mjs';
import { pickGameStyle } from './ryuo-repertoire.mjs';
import { LADDER_VERSION } from './level-ladder.mjs';
import {
  BASE_DIFFICULTY,
  DIFFICULTY_LEVELS,
  GROUP_MEAN_RATING,
  groupMeanLevel,
  levelToRating,
  ratingToLevel,
  recommendedDifficulty,
  tournamentLevel,
  winProbability,
  worldCpuLevel,
  worldRating,
} from './ryuo-strength.mjs';

export { BASE_DIFFICULTY, DIFFICULTY_LEVELS, createRng, groupMeanLevel, recommendedDifficulty, winProbability };

/**
 * 期の保存形式。3から、棋士はレーティング(rating)を持ち、Lvは難易度から換算した値になった。
 * 4から、棋士は名簿(ryuo-roster.mjs)の棋士で、idは名簿のid。各組の出場者(fields)を、期の始めに決めて持つ。
 * 5で、難易度を下へ2段階足した(14段階)。版4の期は、同じ強さになるよう難易度を2つずらして読み込む。
 */
export const SEASON_VERSION = 5;

/** プレイヤーのid。名簿の竜王がプレイヤーのときの値(USER_HOLDER)と同じ。 */
export const USER_ID = USER_HOLDER;
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

export const scaleById = (id) => SCALES.find((scale) => scale.id === id) ?? SCALES[2];

// ---- 棋士

/**
 * 期で使う棋士。強さはレーティングで持ち、Lvは、その期の難易度で換算した、実際に指すときの値。
 * 新しい期は棋力も渡し、おすすめの勝率と手動の番号順を合わせる。旧保存のLvは読み込み時に変えない。
 * 羽音は、一度プレイヤーに負けていれば、プレイヤーと指すときだけ強くなる(Lvにだけ足し、自動対局のレーティングは変えない)。
 */
function seasonPlayer(roster, id, settings, userLevel = null) {
  const entry = seasonEntry(roster, id);
  const rating = entry.rating + hananeGrudgeBonus(entry, entry.vsUser);
  return { ...entry, level: seasonLevelFor(rating, settings, userLevel) };
}

/**
 * 期の設定で、名簿のレーティングratingの棋士を指させるLv。世界の物差し(settings.world)を持つ期は、棋士の差を残す
 * (docs/tournament-strength-spread-design.md)。持たない前の期は、前の換算のまま(おすすめは勝率6〜8割に収める)。
 * @param {number} rating
 * @param {{ difficulty: number, world?: number, worldSpread?: number, recommended?: boolean }} settings
 * @param {number | null} [userLevel]
 */
export function seasonLevelFor(rating, settings, userLevel = null) {
  if (Number.isFinite(settings?.world)) {
    // worldSpreadは確かめのまね(scripts/tournament-career-sim.mjs)だけが渡す。画面からの期は既定の倍率。
    return worldCpuLevel(rating, /** @type {number} */ (settings.world), undefined, Number.isFinite(settings.worldSpread) ? settings.worldSpread : undefined);
  }
  return typeof settings?.recommended === 'boolean' && Number.isFinite(userLevel)
    ? tournamentLevel(rating, settings.difficulty, /** @type {number} */ (userLevel)) : ratingToLevel(rating, settings.difficulty);
}

/** プレイヤーを、期の設定の物差しで名簿の尺度のレーティングに直す(表示と目安。自動対局には使わない)。 */
export function seasonUserRating(userLevel, settings) {
  return Number.isFinite(settings?.world)
    ? worldRating(userLevel, /** @type {number} */ (settings.world)) : levelToRating(userLevel, settings.difficulty);
}
/** 期の中で使う棋士の写しと、難易度での実際に指すLv(名人戦の順位戦でも使う。core/meijin.mjs)。 */
export const seasonPlayerOf = seasonPlayer;

/**
 * 能力の配分と使用率を持たない、前の版で始めた期の棋士の写しに、名簿の能力と使用率を写す(名簿は版3へ移したもの)。
 * 足すものがなければ、同じ期を返す。
 */
export function withRosterAbilities(season, roster) {
  if (!season?.players || !roster?.players) return season;
  const missing = Object.keys(season.players).filter((id) => id !== USER_ID && roster.players[id] && !season.players[id].character?.abilities);
  if (!missing.length) return season;
  const next = structuredClone(season);
  for (const id of missing) {
    next.players[id].character = structuredClone(roster.players[id].character);
    next.players[id].repertoire = structuredClone(roster.players[id].repertoire);
  }
  return next;
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

/** シード順(1から)の、トーナメント表の左右の半分(0か1)。 */
export function seedHalf(seed, count) {
  const size = 2 ** Math.ceil(Math.log2(Math.max(count, 2)));
  return seedOrder(size).indexOf(seed) < size / 2 ? 0 : 1;
}

/**
 * 羽音とプレイヤーが同じ組なら、2人がトーナメント表の反対の半分に入るよう、羽音を第1か第2シードに置く。
 * 2人とも勝ち進めば、組の決勝で当たる(山場)。ほかの棋士の順番は変えない。
 * @param {string[]} ids 強い順
 * @param {string | null} rivalId
 * @param {string} userId
 */
export function placeRival(ids, rivalId, userId) {
  if (!rivalId || !ids.includes(rivalId) || !ids.includes(userId) || ids.length < 2) return ids;
  const rest = ids.filter((id) => id !== rivalId);
  const candidates = [[rivalId, ...rest], [rest[0], rivalId, ...rest.slice(1)]];
  const apart = (list) => seedHalf(list.indexOf(rivalId) + 1, list.length) !== seedHalf(list.indexOf(userId) + 1, list.length);
  return candidates.find(apart) ?? candidates[0];
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
  // プレイヤーのいる表では、ライバル(羽音)が勝ち上がりやすい(ryuo-story.mjsのHANANE_RIVAL_RUN_RATING)。
  const rivalRun = bracket.ids?.includes(userId);
  const ratingOf = (member) => member.rating + (rivalRun && member.story === HANANE ? HANANE_RIVAL_RUN_RATING : 0);
  const finalId = rootNodeId(bracket);
  for (;;) {
    const ready = readyNodes(bracket, { stopAtRoot });
    if (!ready.length) break;
    // プレイヤーの試合が見つかっても、同じ回戦のほかの試合は先に決め切る。
    // 対局中に「速報」として少しずつ見せるため(docs/tournament-match-presence-design.mdの4章)。
    let userNode = null;
    for (const node of ready) {
      const a = sidePid(bracket, node.a);
      const b = sidePid(bracket, node.b);
      if (a === userId || b === userId) {
        userNode ??= node;
        continue;
      }
      // 能力の配分で、序盤・中盤・終盤と形勢を進めて決める(ryuo-simulation.mjs)。決勝は大事な対局。
      const result = simulateMemberGame(rng, players[a], players[b], { ratingOf, big: node.id === finalId });
      node.winner = result.aWins ? a : b;
      node.game = gameRecordOf(result, a, b);
    }
    if (userNode) return { state: 'user', nodeId: userNode.id };
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

/**
 * 番勝負の1局を記録する。gameは、先手(black)・戦法(openings)・勝ち方(how)の内訳(あれば)。
 * @param {any} series
 * @param {string} winner
 * @param {{ black?: string, openings?: Record<string, string | null>, how?: string | null } | null} [game]
 */
export function recordSeriesGame(series, winner, game = null) {
  if (series.winner !== null) return series;
  series.wins[winner] += 1;
  series.games.push({ winner, ...(game ?? {}) });
  if (series.wins[winner] >= series.need) series.winner = winner;
  return series;
}

/** 番勝負を自動で指す。先後は1局ごとに入れ替える(1局目のaの手番は振り駒)。大事な対局。 */
function simulateSeries(series, players, rng) {
  let aColor = series.games.length ? null : rng.next() < 0.5 ? 'black' : 'white';
  while (series.winner === null) {
    const last = series.games.at(-1);
    if (aColor === null) aColor = last?.black ? (last.black === series.a ? 'white' : 'black') : rng.next() < 0.5 ? 'black' : 'white';
    const result = simulateMemberGame(rng, players[series.a], players[series.b], { big: true, aColor });
    recordSeriesGame(series, result.aWins ? series.a : series.b, gameRecordOf(result, series.a, series.b));
    aColor = aColor === 'black' ? 'white' : 'black';
  }
}

// ---- 組の順位、昇級・降級

/**
 * 組の最終順位(上から)。優勝、準優勝、敗者復活の勝者、それ以外(敗者復活と本戦の勝ち数、シード順)の順。
 */
export function computeStandings(ranking, revivalBlocks, strengths) {
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
      || (strengths[y] ?? 0) - (strengths[x] ?? 0)
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
export function buildRevivalBlocks(group, ranking, slotCount, strengths, prefix) {
  if (slotCount <= 0) return [];
  const records = bracketRecords(ranking);
  const pool = ranking.ids.filter((pid) => records[pid].lostRound !== null && records[pid].lostRound < ranking.rounds);
  let groups = [];
  if (group === 1) {
    const rounds = [...new Set(pool.map((pid) => records[pid].lostRound))].sort((x, y) => y - x);
    groups = rounds.slice(0, slotCount).map((round) => pool.filter((pid) => records[pid].lostRound === round));
  } else {
    const ordered = [...pool].sort((x, y) => records[y].wins - records[x].wins || (strengths[y] ?? 0) - (strengths[x] ?? 0));
    groups = Array.from({ length: Math.min(slotCount, ordered.length) }, () => []);
    ordered.forEach((pid, index) => {
      const lane = index % groups.length;
      const row = Math.floor(index / groups.length);
      // 蛇行に分けて、各表の強さをそろえる。
      groups[row % 2 === 0 ? lane : groups.length - 1 - lane].push(pid);
    });
  }
  return groups.filter((ids) => ids.length > 0).map((ids, index) => {
    const sorted = [...ids].sort((x, y) => (strengths[y] ?? 0) - (strengths[x] ?? 0));
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
 *   settings: { difficulty: number, scale: number, revival: boolean, recommended?: boolean, world?: number },
 *   userLevel: number, career?: object, roster?: object, seed?: number, userName?: string,
 * }} options
 */
export function createSeason({ no, mode, group, settings, userLevel, career, roster, seed = Date.now(), userName = 'あなた' }) {
  const scale = scaleById(settings.scale);
  const rng = createRng(seed);
  const members = roster ?? createRoster({ seed, userGroup: group, userIsChampion: mode === 'defense' });
  const season = {
    version: SEASON_VERSION,
    ladder: LADDER_VERSION,
    id: seed,
    no,
    mode,
    startGroup: group,
    settings: { ...settings, scale: scale.id },
    players: {},
    fields: {},
    groupStandings: {},
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
  // プレイヤーのレーティングは、棋力(Lv)をこの難易度で棋士の尺度に直した値。自動対局には使わない(表示と目安)。
  season.players[USER_ID] = {
    id: USER_ID, name: userName, dan: userDanFor(career), kind: 'user', group,
    level: Math.round(userLevel), rating: seasonUserRating(userLevel, settings), style: null,
  };
  const holder = mode === 'defense' || members.holder === USER_HOLDER ? USER_ID : members.holder;
  season.champion = holder;
  season.defender = holder;
  if (holder !== USER_ID) season.players[holder] = seasonPlayer(members, holder, settings, userLevel);
  // 各組の出場者を、名簿から選ぶ(竜王は出ない)。プレイヤーの組は、プレイヤーの分を1名減らす。
  for (const g of GROUPS) {
    const userHere = mode === 'challenge' && g === group;
    const ids = selectParticipants(members, g, scale.sizes[g] - (userHere ? 1 : 0), rng);
    for (const id of ids) season.players[id] = seasonPlayer(members, id, settings, userLevel);
    season.fields[g] = userHere ? [...ids, USER_ID] : ids;
  }
  if (mode === 'challenge') {
    const strengths = strengthsOf(season);
    const sorted = [...season.fields[group]].sort((x, y) => strengths[y] - strengths[x]);
    const rivalId = sorted.find((pid) => season.players[pid]?.story === HANANE) ?? null;
    season.ranking = buildSeededBracket(`${group}組ランキング戦`, placeRival(sorted, rivalId, USER_ID), 'rk');
  } else {
    season.phase = 'prepare-defense';
  }
  return drive(season, rng);
}

/**
 * 組み合わせと順位の同点処理に使う、各棋士の棋力。プレイヤーは、実際の棋力ではなく、組の平均として扱う
 * (棋力が低くても、毎回、組でいちばん強い相手に当たらないように)。
 */
const strengthsOf = (season) => Object.fromEntries(Object.entries(season.players).map(([pid, player]) => [
  pid,
  pid === USER_ID ? GROUP_MEAN_RATING[season.startGroup] : player.rating,
]));

/** プレイヤーの組以外の組の、決勝トーナメント進出者を、自動で決める。 */
function simulateGroupQualifiers(season, group, rng) {
  const scale = scaleById(season.settings.scale);
  const ids = [...season.fields[group]].sort((x, y) => season.players[y].rating - season.players[x].rating);
  const ranking = buildSeededBracket(`${group}組`, ids, `o${group}rk`);
  advanceBracket(ranking, season.players, rng);
  const strengths = strengthsOf(season);
  const blocks = season.settings.revival ? buildRevivalBlocks(group, ranking, group === 1 ? scale.slots[1] - 2 : 0, strengths, `o${group}`) : [];
  for (const block of blocks) advanceBracket(block, season.players, rng);
  // 名簿の年間成績に数えるので、表を残す。
  season.groupBrackets = { ...(season.groupBrackets ?? {}), [`${group}`]: ranking };
  blocks.forEach((block, index) => { season.groupBrackets[`${group}-r${index + 1}`] = block; });
  const standings = computeStandings(ranking, blocks, strengths);
  // 名簿の昇級・降級に使うので、全員の順位を残す。
  season.groupStandings[group] = standings;
  return standings.slice(0, scale.slots[group]);
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
  // 相手は、戦法と囲いの使用率から、この1局の戦法を選ぶ(相手の手番の使用率。opening-usage.mjs)。
  const opponent = season.players[pending.opponentId];
  const style = opponent?.repertoire
    ? pickGameStyle(rng, opponent.repertoire, { color: color === 'black' ? 'white' : 'black' })
    : opponent?.style ?? null;
  season.pending = { ...pending, color, label, style };
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
      const strengths = strengthsOf(season);
      const slotCount = revivalSlots(season.startGroup, scale);
      season.revival = season.settings.revival ? buildRevivalBlocks(season.startGroup, season.ranking, slotCount, strengths, 'rv') : [];
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
      season.standings = computeStandings(season.ranking, season.revival, { ...strengthsOf(season), [USER_ID]: -Infinity });
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
 * @param {{ game?: object | null }} [options] gameは、自動対局の記録(分身の対局。先手・戦法・囲い・展開・勝ち方)
 */
export function recordUserGame(season, outcome, { game: simulated = null } = {}) {
  const next = structuredClone(season);
  const pending = next.pending;
  if (!pending) return next;
  const rng = createRng(next.rngState);
  const win = outcome === 'win';
  const opponent = pending.opponentId;
  // 回戦(round)は、竜王への道の勝ち上がりの動きの出発点に使う(core/ryuo-road.mjs)。
  const pendingBracket = pending.kind !== 'game' ? null
    : pending.phase === 'ranking' ? next.ranking : pending.phase === 'revival' ? next.revival[pending.blockIndex] : next.main;
  next.userGames.push({
    phase: pending.phase, opponentId: opponent, win, color: pending.color, seriesGame: pending.kind !== 'game',
    label: pending.label ?? '',
    round: pendingBracket?.nodes[pending.nodeId]?.round ?? 0,
  });
  next.pending = null;
  // 相手の成績の内訳(先後・戦法)のために、この対局の先手と、相手の戦法を残す。
  const game = simulated ?? {
    black: pending.color === 'black' ? USER_ID : opponent,
    how: null,
    openings: { [opponent]: pending.style?.opening ?? null },
  };
  if (pending.kind === 'game') {
    const bracket = pending.phase === 'ranking' ? next.ranking : pending.phase === 'revival' ? next.revival[pending.blockIndex] : next.main;
    bracket.nodes[pending.nodeId].winner = win ? USER_ID : opponent;
    bracket.nodes[pending.nodeId].game = game;
  } else {
    const series = pending.kind === 'playoff' ? next.playoff : next.finals;
    recordSeriesGame(series, win ? USER_ID : opponent, game);
  }
  return drive(next, rng);
}

// ---- 観戦の期(分身。docs/tournament-relay-design.mdの13章)

/**
 * 分身(プレイヤーの能力を持った棋士)が出る、観戦の期。本番の記録(キャリア・名簿・称号)には数えない。名簿は読むだけ(写しを使う)。
 * liveなら、ふつうの期と同じく分身の次の一局で止めて返す(「観戦する」で1局ずつ進める。13-6)。
 * liveでなければ、分身の対局もほかの棋士と同じ自動対局で決め、最後まで進めて返す(前の版の観戦の期と、テスト)。
 * @param {{
 *   no: number, mode: 'challenge' | 'defense', group: number,
 *   settings: { difficulty: number, scale: number, revival: boolean, world?: number },
 *   avatar: { rating: number, character: any }, career?: object, roster: object, seed?: number, userName?: string, live?: boolean,
 * }} options
 */
export function createSpectatorSeason({ no, mode, group, settings, avatar, career, roster, seed = Date.now(), userName = 'あなた', live = true }) {
  let season = createSeason({
    no, mode, group, settings, userLevel: 0, career, roster: structuredClone(roster), seed, userName,
  });
  season.spectator = true;
  if (live) season.live = true;
  season.players[USER_ID] = {
    ...season.players[USER_ID], kind: 'avatar', rating: avatar.rating, character: structuredClone(avatar.character ?? { abilities: {}, traits: [] }),
  };
  if (live) return season;
  for (let guard = 0; guard < 200 && season.pending; guard += 1) season = playSpectatorGame(season);
  return season;
}

/**
 * 観戦の期の、分身の次の一局を決めて記録する(ほかの棋士と同じ自動対局。結果は期の種と局の数で決まる)。
 * 決めた対局は、ほかの棋士の対局と同じく中継に並ぶ(relay-games.mjsのtags.self)。
 * @param {any} season 観戦の期
 */
export function playSpectatorGame(season) {
  if (!season?.pending) return season;
  const pending = season.pending;
  const count = season.userGames?.length ?? 0;
  const rng = createRng(((Number(season.id) || 0) ^ 0x6a09e667 ^ Math.imul(count + 1, 0x9e3779b1)) >>> 0);
  const me = season.players[USER_ID];
  const opponent = season.players[pending.opponentId];
  const result = simulateMemberGame(rng, me, opponent, { big: pending.kind !== 'game', aColor: pending.color });
  const game = gameRecordOf(result, USER_ID, pending.opponentId);
  const next = recordUserGame(season, result.aWins ? 'win' : 'loss', { game });
  next.spectator = true;
  if (season.live) next.live = true;
  return next;
}

// ---- 表示用

function lastGameView(season) {
  const game = season.userGames?.at(-1);
  if (!game) return null;
  const view = { win: game.win, label: game.label ?? '', opponent: playerBrief(season, game.opponentId), traitMoments: game.traitMoments ?? [] };
  // ライバル(羽音)との対局なら、羽音の一言。この対局を数える前の対戦成績で選ぶ。
  if (season.players[game.opponentId]?.story === HANANE) {
    const before = vsUserSoFar(season, game.opponentId, season.userGames.length - 1);
    view.rivalLine = hananeAfterLine({ userWon: game.win, vsUser: before });
    // 初めて羽音に勝ったあとの再戦の決意は、注目の一言にする。
    view.rivalNotice = game.win && before.wins === 0;
  }
  return view;
}

/** プレイヤーとその相手の、これまでの対戦成績(期の始めの記録に、この期のcount局目までを足す)。 */
function vsUserSoFar(season, pid, count = season.userGames.length) {
  const base = season.players[pid]?.vsUser ?? null;
  const games = season.userGames.slice(0, count).filter((game) => game.opponentId === pid);
  return {
    wins: (base?.wins ?? 0) + games.filter(({ win }) => win).length,
    losses: (base?.losses ?? 0) + games.filter(({ win }) => !win).length,
  };
}

/** 次の対局の相手がライバル(羽音)なら、羽音の一言と、やこび姫の紹介。善彦なら、やこび姫の紹介だけ。 */
function rivalPendingView(season) {
  const pid = season.pending?.opponentId;
  if (pid && season.players[pid]?.story === YOSHIHIKO) {
    const hananeId = Object.keys(season.players).find((id) => season.players[id]?.story === HANANE);
    const met = hananeId ? vsUserSoFar(season, hananeId).wins + vsUserSoFar(season, hananeId).losses > 0 : false;
    return { story: YOSHIHIKO, line: '', coach: yoshihikoCoachIntro(met, season.players[pid]?.profile?.held ?? []), grudge: false };
  }
  if (!pid || season.players[pid]?.story !== HANANE) return null;
  const vsUser = vsUserSoFar(season, pid);
  const hanane = season.players[pid];
  const standing = { dan: hanane.dan, held: hanane.profile?.held ?? [], rookie: hanane.rookie ?? hanane.dan === '四段' };
  return { story: HANANE, line: hananeBeforeLine(vsUser), coach: hananeCoachIntro(vsUser, standing), grudge: vsUser.wins > 0 };
}

const playerBrief = (season, pid) => {
  const player = season.players[pid];
  return player ? {
    id: pid, name: player.name, dan: player.dan, level: player.level, rating: player.rating, kind: player.kind, style: player.style, story: player.story ?? null,
    character: player.character ?? null, repertoire: player.repertoire ?? null, age: player.age ?? null,
    profile: player.profile ?? null, vsUser: player.vsUser ?? null,
  } : null;
};

export function playerView(season, pid) {
  return playerBrief(season, pid);
}

function bracketView(season, bracket, { series = false } = {}) {
  if (!bracket?.root) return { title: bracket?.label ?? '', rounds: [] };
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
  return { title: bracket.label, rounds };
}

const PHASE_TEXT = Object.freeze({
  ranking: 'ランキング戦', revival: '敗者復活戦', 'main-setup': '決勝トーナメント', main: '決勝トーナメント',
  playoff: '挑戦者決定三番勝負', finals: '竜王戦七番勝負', done: '終了', 'prepare-defense': '防衛戦',
});

/**
 * 画面に出す内容。トーナメント表(進行中の段階まで)、次の対局の相手、結果。
 */
export function describeSeason(season) {
  // 回戦ごとの試合の一覧(推しの棋士の段の判定などに使う。画面の表は、下のstages)。
  const tables = [];
  if (season.ranking) tables.push({ key: 'ranking', ...bracketView(season, season.ranking) });
  season.revival.forEach((block, index) => tables.push({ key: `revival-${index}`, ...bracketView(season, block) }));
  if (season.main) tables.push({ key: 'main', ...bracketView(season, season.main, { series: true }) });
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
    ? {
      ...season.pending, opponent: playerBrief(season, season.pending.opponentId), label: pendingLabel(season), rival: rivalPendingView(season),
      stakes: pendingStakes(season),
      arrival: opponentArrivalLine(season),
    }
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
    // 竜王への道(core/ryuo-road.mjs)。
    road: seasonRoad(season, { promote: scaleById(season.settings.scale).promote }),
    // 直前の対局の節目(突破・組優勝・挑戦権・竜王)と、同じ回戦の大番狂わせ(core/ryuo-milestone.mjs)。
    milestone: lastGameMilestone(season, { promote: scaleById(season.settings.scale).promote }),
    upset: latestUpsetLine(season),
    series: seriesViews,
    // 3つの段階(① 組のトーナメント・② 決勝トーナメント・③ 番勝負。core/ryuo-stages.mjs、docs/ryuo-stages-design.md)。
    stages: stagesView(season),
    pending: pendingView,
    // 直前のプレイヤーの対局(相手と、相手の特徴が出た場面)。
    lastGame: lastGameView(season),
    // ライバル(羽音)のid。この期に出ていなければnull。トーナメント表の印に使う。
    rivalId: Object.keys(season.players).find((pid) => season.players[pid]?.story === HANANE) ?? null,
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

/** 決勝トーナメントの札に添える、組と順位(例: 1組優勝・2組2位)。 */
const mainSlotLabel = (group, rank) => `${group}組${rank === 0 ? '優勝' : `${rank + 1}位`}`;

/**
 * 決勝トーナメントがまだ決まっていないときの下見。規模の設定の出場枠(各組の優勝者と上位)で、組み合わせの枠だけを作る。
 * プレイヤーの組の優勝の枠には、そこから挑戦者決定戦までに要る勝ち数を添える。
 */
function previewMain(season, brief) {
  const scale = scaleById(season.settings.scale);
  const entrants = [];
  for (const group of GROUPS) {
    for (let rank = 0; rank < (scale.slots[group] ?? 1); rank += 1) {
      entrants.push({ pid: `slot-${group}-${rank}`, weight: MAIN_WEIGHTS[group][rank] ?? MAIN_WEIGHTS[group].at(-1), group, rank });
    }
  }
  const bracket = buildMainBracket(entrants, 'preview');
  const labels = Object.fromEntries(entrants.map(({ pid, group, rank }) => [pid, mainSlotLabel(group, rank)]));
  const hope = season.mode === 'challenge' ? `slot-${season.startGroup}-0` : null;
  const view = matchBracket(bracket, {
    brief: (pid) => (pid.startsWith('slot-') ? { name: '？', dan: '' } : brief(pid)),
    roundLabel: (round) => resultRoundLabel(bracket, round, { series: true }),
    labels,
  });
  for (const match of view.matches) {
    for (const slot of [match.top, match.bottom]) slot.hope = slot.pid === hope;
  }
  return { ...view, preview: true, hopeWins: hope ? winsToPlayoff(bracket, hope) : null, hopeLabel: hope ? labels[hope] : '' };
}

/**
 * 3つの段階の一覧と、段階ごとの表・番勝負(docs/ryuo-stages-design.md)。
 * ①は、プレイヤーの組のランキング戦と昇級者決定戦(出場者決定戦)、決まっていればほかの組の表も。②は決勝トーナメント(まだなら下見)。
 */
function stagesView(season) {
  const brief = (pid) => playerBrief(season, pid);
  const pending = season.pending;
  const pendingNode = (phase, blockIndex) => (
    pending?.kind === 'game' && pending.phase === phase && (blockIndex === undefined || pending.blockIndex === blockIndex) ? pending.nodeId : null
  );
  const tableOf = (bracket, options = {}) => matchBracket(bracket, {
    brief, roundLabel: (round) => resultRoundLabel(bracket, round, { series: options.series === true }), ...options,
  });
  const group = [];
  if (season.ranking) group.push({ key: 'ranking', label: 'ランキング戦', group: season.startGroup, own: true, view: tableOf(season.ranking, { pendingNodeId: pendingNode('ranking') }) });
  season.revival.forEach((block, index) => group.push({
    key: `revival-${index}`, label: block.label, group: season.startGroup, own: true,
    view: tableOf(block, { pendingNodeId: pendingNode('revival', index) }),
  }));
  // ほかの組の表(決勝トーナメントの組み合わせが決まると、各組の結果が分かる)。
  for (const [key, bracket] of Object.entries(season.groupBrackets ?? {})) {
    const [g, block] = key.split('-');
    group.push({ key: `group-${key}`, label: block ? `${g}組 ${bracket.label}` : `${g}組`, group: Number(g), own: false, view: tableOf(bracket) });
  }
  const labels = Object.fromEntries((season.mainEntrants ?? []).map(({ pid, group: g, rank }) => [pid, mainSlotLabel(g, rank)]));
  const final = season.main
    ? { ...tableOf(season.main, { series: true, labels, pendingNodeId: pendingNode('main') }), preview: false, hopeWins: null, hopeLabel: '' }
    : previewMain(season, brief);
  const scale = scaleById(season.settings.scale);
  return {
    ...seasonStages(season),
    // 段階の見出しの一言に使う、プレイヤーの組の決まり(人数・決勝トーナメントへの枠・昇級の人数)。
    rule: { group: season.startGroup, size: scale.sizes[season.startGroup] ?? 0, slots: scale.slots[season.startGroup] ?? 1, promote: scale.promote, entrants: Object.values(scale.slots).reduce((sum, n) => sum + n, 0) },
    group,
    final,
    series: [['playoff', season.playoff], ['finals', season.finals]]
      .map(([key, series]) => seriesView(series, { brief, key }))
      .filter(Boolean),
    // 七番勝負の相手(竜王)。番勝負の前でも、頂上で待つ人として出す。
    holder: season.defender ? brief(season.defender) : null,
  };
}

/**
 * 次の一局に賭けているもの(勝てば・負ければ・目標まであと何勝)。ライバル(羽音)との一局も山場にする(core/ryuo-stakes.mjs)。
 * @returns {ReturnType<typeof matchStakes> | null}
 */
export function pendingStakes(season) {
  const pending = season.pending;
  if (!pending) return null;
  const scale = scaleById(season.settings.scale);
  const group = season.startGroup;
  const base = { mode: season.mode, group, promote: scale.promote, groupSlots: scale.slots[group] ?? 1, revivalEnabled: Boolean(season.settings.revival) };
  let stakes;
  if (pending.kind === 'game') {
    const bracket = pending.phase === 'ranking' ? season.ranking : pending.phase === 'revival' ? season.revival[pending.blockIndex] : season.main;
    const node = bracket?.nodes?.[pending.nodeId];
    const round = node?.round ?? 1;
    const rounds = bracket?.rounds ?? 1;
    const slotCount = revivalSlots(group, scale);
    stakes = matchStakes({
      ...base, phase: pending.phase, round, rounds,
      // 1組の敗者復活戦(出場者決定戦)は、遅い回戦で負けた人だけが出る。
      revivalReachable: slotCount > 0 && round < rounds && (group !== 1 || round >= rounds - slotCount),
      revivalPromotes: group === 1 || scale.promote - 2 > 0,
    });
  } else {
    stakes = matchStakes({ ...base, phase: pending.kind, need: pending.need, winsUser: pending.wins?.user ?? 0, winsOpponent: pending.wins?.opponent ?? 0 });
  }
  const rival = season.players[pending.opponentId]?.story === HANANE;
  return { ...stakes, boss: stakes.boss || rival };
}

/** 期の目標の1行(入口と、期の結果の「次の期」)。 */
/**
 * 次の期の入口に出す、竜王への道(山の全景)。ランキング戦の回戦の数は、組の人数(規模で決まる)から。
 * @param {{ mode: 'challenge' | 'defense', group: number, scale: number,
 *   holder?: { id: string, name: string, attack?: number, story?: string | null } | null }} entry
 */
export function entryRoad({ mode, group, scale: scaleId, holder = null }) {
  const scale = scaleById(scaleId);
  const rounds = Math.max(1, Math.ceil(Math.log2(scale.sizes[group] ?? 2)));
  return previewRoad({ mode, group, rounds, promote: scale.promote, holder });
}

export function entryGoalLine({ mode, group, scale: scaleId }) {
  const scale = scaleById(scaleId);
  return seasonGoalLine({ mode, group, promote: scale.promote, groupSlots: scale.slots[group] ?? 1 });
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
