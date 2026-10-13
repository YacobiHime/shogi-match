// 竜王戦に出る架空の棋士の名簿。期をまたいで残り、毎期の結果で更新する。
// - 組の昇級・降級、竜王の交代、昇段(竜王戦の昇段規定と、勝数規定の近似)
// - 年齢と強さの変化、引退、新四段の加入、6組の特別枠(アマ・女流・奨励会員)の入れ替え
// 登場する棋士はすべて架空で、実在の棋士とは関係がない。設計は docs/tournament-design.md の「名簿」。

import {
  CHAMPION_RATING,
  GIVEN_NAMES,
  GROUP_DAN_WEIGHTS,
  OPPONENT_STYLES,
  SPECIAL_RATING_OFFSET,
  SURNAMES,
  WOMEN_GIVEN_NAMES,
} from './ryuo-data.mjs';
import { GROUP_MEAN_RATING, GROUP_RATING_SPREAD } from './ryuo-strength.mjs';
import { createRng, gauss, pick, weightedPick } from './ryuo-random.mjs';
import { ageCharacter, createCharacter } from './player-character.mjs';

export const ROSTER_STORAGE_KEY = 'yacobihime:shogi-match:ryuo-roster';
export const ROSTER_VERSION = 1;
/** 竜王がプレイヤーのときの、名簿の竜王(holder)の値。 */
export const USER_HOLDER = 'user';
const GROUPS = [1, 2, 3, 4, 5, 6];

/**
 * 名簿の組の人数(竜王とプレイヤーを含む定員)。1〜5組は実物の定員。
 * 6組は、実物の約70名のうち、毎期入れ替わる特別枠(10名)を除いた棋士の数で、上限はない。
 */
export const ROSTER_GROUP_SIZES = Object.freeze({ 1: 16, 2: 16, 3: 16, 4: 32, 5: 32, 6: 54 });
/** 6組の特別枠。実物は女流4・奨励会1・アマ5。毎期、6組に残った人を入れ替える。 */
export const SPECIAL_SLOTS = Object.freeze({ amateur: 5, woman: 4, shoreikai: 1 });
/** 竜王戦に出た奨励会三段が、その期のうちに四段になる確率(仮の値)。 */
const SHOREIKAI_PROMOTION = 0.3;
/** 1期あたりの新四段の人数の範囲。実物は三段リーグから年4名ほどで、引退の人数に合わせて名簿の人数を保つ。 */
export const MIN_NEW_PROS = 2;
export const MAX_NEW_PROS = 8;

export const DAN_ORDER = Object.freeze(['四段', '五段', '六段', '七段', '八段', '九段']);
/**
 * 勝数規定などによる、1期あたりの昇段の確率(強さが平均の棋士)。強い棋士ほど上がりやすい。
 * 四段から五段まで数年、七段から八段は十年ほどかかる、という目安に合わせた仮の値。八段から九段は、強い棋士(R1700以上)だけ。
 */
const DAN_UP_CHANCE = Object.freeze({ 四段: 0.25, 五段: 0.18, 六段: 0.12, 七段: 0.04, 八段: 0.05 });
const WOMEN_DAN_WEIGHTS = [['女流初段', 15], ['女流二段', 30], ['女流三段', 30], ['女流四段', 15], ['女流五段', 10]];

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

function newName(rng, used, women = false) {
  for (let attempt = 0; attempt < 400; attempt += 1) {
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

function pickStyle(rng) {
  const style = pick(rng, OPPONENT_STYLES);
  return { id: style.id, label: style.label, strategy: style.strategy, castle: style.castle, rook: style.rook };
}

/** 最初の名簿の年齢。上の組は働き盛り、6組は若手とベテランに分かれる。 */
function initialAge(rng, group, kind) {
  if (kind === 'amateur') return Math.round(clamp(30 + gauss(rng) * 10, 18, 60));
  if (kind === 'woman') return Math.round(clamp(27 + gauss(rng) * 6, 18, 45));
  if (kind === 'shoreikai') return Math.round(clamp(22 + gauss(rng) * 2, 18, 26));
  const [mean, spread] = group === 1 ? [34, 7] : group <= 3 ? [37, 9] : group <= 5 ? [40, 11]
    : (rng.next() < 0.5 ? [24, 3] : [55, 8]);
  return Math.round(clamp(mean + gauss(rng) * spread, 18, 72));
}

/**
 * 最初の名簿の段位。組の分布に、年齢(棋士として過ごした年数)の分を足す。
 * 竜王戦の昇段規定に合わせ、2組は六段以上、1組は七段以上にする。
 */
function initialDan(rng, group, age) {
  const base = DAN_ORDER.indexOf(weightedPick(rng, GROUP_DAN_WEIGHTS[group]));
  let index = base;
  if (age >= 55 && rng.next() < 0.7) index += 2;
  else if (age >= 45 && rng.next() < 0.6) index += 1;
  if (age <= 23) index = Math.min(index, 1);
  // 年齢で足すのは八段まで。九段は、組の分布で選ばれたときだけ。
  index = Math.max(base === 5 && age > 23 ? 5 : 0, Math.min(index, 4));
  if (group <= 2) index = Math.max(index, 2);
  if (group === 1) index = Math.max(index, 3);
  return DAN_ORDER[index];
}

function specialDan(rng, kind) {
  if (kind === 'amateur') return 'アマ';
  if (kind === 'shoreikai') return '奨励会三段';
  return weightedPick(rng, WOMEN_DAN_WEIGHTS);
}

function createMember(roster, rng, used, { group, kind = 'pro', rating, age, dan }) {
  const memberAge = age ?? initialAge(rng, group, kind);
  const id = `r${roster.nextId}`;
  roster.nextId += 1;
  const member = {
    id,
    name: newName(rng, used, kind === 'woman'),
    kind,
    group,
    dan: dan ?? (kind === 'pro' ? initialDan(rng, group, memberAge) : specialDan(rng, kind)),
    rating: Math.round(rating ?? (GROUP_MEAN_RATING[group] + SPECIAL_RATING_OFFSET[kind] + gauss(rng) * GROUP_RATING_SPREAD[group])),
    age: memberAge,
    since: roster.season,
    ryuo: 0,
    style: pickStyle(rng),
  };
  // 棋風と特徴。強さ・年齢・得意戦法に合わせて決める。
  member.character = createCharacter(rng, member);
  roster.players[id] = member;
  return member;
}

const usedNames = (roster) => new Set(Object.values(roster.players).map(({ name }) => name));
const isHolder = (roster, id) => roster.holder === id;
const members = (roster) => Object.values(roster.players);
const groupMembers = (roster, group) => members(roster).filter((member) => member.group === group && !isHolder(roster, member.id));
const proRatings = (roster) => members(roster).filter(({ kind }) => kind === 'pro').map(({ rating }) => rating);
const proMean = (roster) => {
  const ratings = proRatings(roster);
  return ratings.reduce((sum, rating) => sum + rating, 0) / Math.max(1, ratings.length);
};
const proSd = (roster) => {
  const ratings = proRatings(roster);
  const mean = proMean(roster);
  return Math.sqrt(ratings.reduce((sum, rating) => sum + (rating - mean) ** 2, 0) / Math.max(1, ratings.length));
};

/**
 * 組の、竜王とプレイヤーを除いた名簿の人数。プレイヤーがいる組は1名、名簿の竜王がいる1組は1名減らす。
 * プレイヤーが竜王のときは、userGroupを1とする。
 */
export function rosterTarget(group, userGroup, holderInRoster) {
  return ROSTER_GROUP_SIZES[group] - (group === userGroup ? 1 : 0) - (group === 1 && holderInRoster ? 1 : 0);
}

/**
 * 最初の名簿を作る。
 * @param {{ seed: number, userGroup?: number, userIsChampion?: boolean }} options
 */
export function createRoster({ seed, userGroup = 6, userIsChampion = false }) {
  const rng = createRng((seed ^ 0x9e3779b9) >>> 0);
  const roster = { version: ROSTER_VERSION, season: 0, nextId: 1, players: {}, holder: USER_HOLDER, history: [], retired: 0, ratingMean: 0, ratingSd: 0 };
  const used = new Set();
  if (!userIsChampion) {
    const holder = createMember(roster, rng, used, { group: 1, rating: CHAMPION_RATING, age: Math.round(clamp(30 + gauss(rng) * 4, 21, 45)), dan: '九段' });
    holder.ryuo = 1 + Math.floor(rng.next() * 3);
    roster.holder = holder.id;
  }
  for (const group of GROUPS) {
    const count = rosterTarget(group, userIsChampion ? 1 : userGroup, !userIsChampion);
    for (let index = 0; index < count; index += 1) createMember(roster, rng, used, { group });
  }
  addSpecials(roster, rng, used);
  roster.ratingMean = Math.round(proMean(roster));
  roster.ratingSd = Math.round(proSd(roster));
  return roster;
}

function addSpecials(roster, rng, used) {
  for (const [kind, slots] of Object.entries(SPECIAL_SLOTS)) {
    for (let index = 0; index < slots; index += 1) createMember(roster, rng, used, { group: 6, kind });
  }
}

/** 組から、この期に出る棋士を選ぶ。6組は、特別枠を人数に比例して混ぜる(実物は約70名中10名)。 */
export function selectParticipants(roster, group, size, rng) {
  const pool = groupMembers(roster, group).sort((a, b) => (a.id < b.id ? -1 : 1));
  const take = (list, count) => {
    const copy = [...list];
    const chosen = [];
    while (chosen.length < count && copy.length) chosen.push(copy.splice(Math.floor(rng.next() * copy.length), 1)[0]);
    return chosen;
  };
  if (group !== 6) return take(pool, size).map(({ id }) => id);
  const quota = {
    amateur: Math.max(1, Math.round(size * 5 / 72)),
    woman: Math.max(1, Math.round(size * 4 / 72)),
    shoreikai: size >= 16 ? 1 : 0,
  };
  const chosen = [];
  for (const [kind, count] of Object.entries(quota)) {
    chosen.push(...take(pool.filter((member) => member.kind === kind), Math.min(count, Math.max(0, size - 2 - chosen.length))));
  }
  const rest = pool.filter((member) => !chosen.includes(member));
  chosen.push(...take(rest.filter(({ kind }) => kind === 'pro'), size - chosen.length));
  if (chosen.length < size) chosen.push(...take(rest.filter((member) => !chosen.includes(member)), size - chosen.length));
  return chosen.map(({ id }) => id);
}

/** 期の中で使う、棋士の写し。竜王は段位の代わりに「竜王」と書く。 */
export function seasonEntry(roster, id) {
  const member = roster.players[id];
  return {
    id,
    name: member.name,
    dan: isHolder(roster, id) ? '竜王' : member.dan,
    kind: member.kind,
    group: member.group,
    rating: member.rating,
    style: { ...member.style },
    ryuo: member.ryuo,
    character: structuredClone(member.character ?? { attack: 0, traits: [] }),
  };
}

const raiseDan = (member, dan) => {
  if (member.kind !== 'pro') return;
  if (DAN_ORDER.indexOf(dan) > DAN_ORDER.indexOf(member.dan)) member.dan = dan;
};

/** 年齢による、1期あたりの強さの変化。20代前半まで伸び、30代後半から下がる。 */
export function ageDrift(age) {
  if (age <= 22) return 35;
  if (age <= 26) return 20;
  if (age <= 30) return 8;
  if (age <= 35) return 0;
  if (age <= 42) return -8;
  if (age <= 50) return -15;
  return -22;
}

/** 引退の確率。下位の組で、60歳を過ぎると増える。 */
function retireChance(member) {
  if (member.kind !== 'pro') return 0;
  if (member.age >= 75) return 1;
  if (member.age < 60 || member.group < 5) return 0;
  return clamp(0.15 + (member.age - 60) * 0.05, 0, 1);
}

/**
 * 終わった期の結果を名簿に反映した、新しい名簿を返す。同じ期を2度反映しない。
 * @param {ReturnType<typeof createRoster>} roster
 * @param {object} season 終わった期(phase: 'done')
 * @param {{ userGroup: number, promote: number }} options userGroupは、反映後のプレイヤーの組。promoteは、昇級・降級の人数。
 */
export function applySeasonToRoster(roster, season, { userGroup, promote }) {
  if (!roster || season.phase !== 'done' || roster.season >= season.no) return roster;
  const next = structuredClone(roster);
  const rng = createRng((Number(season.id) ^ 0x5bd1e995) >>> 0);
  const used = usedNames(next);
  const inRoster = (id) => Boolean(next.players[id]);
  const moveTo = (id, group) => {
    const member = next.players[id];
    member.group = group;
    if (group <= 2) raiseDan(member, '六段');
    if (group === 1) raiseDan(member, '七段');
  };

  // 組の昇級・降級。ランキング戦の順位の上位が昇級、下位が降級する。
  for (const group of GROUPS) {
    const standings = group === season.startGroup && season.mode === 'challenge' ? season.standings : season.groupStandings?.[group];
    if (!standings?.length) continue;
    const up = group > 1 ? standings.slice(0, promote) : [];
    const down = group < 6 ? standings.slice(-promote).filter((id) => !up.includes(id)) : [];
    for (const id of up) if (inRoster(id)) moveTo(id, group - 1);
    for (const id of down) if (inRoster(id)) moveTo(id, group + 1);
  }

  // 挑戦者は七段に。3組以下からの挑戦者は、次期は1組。
  const challenger = season.finals?.b;
  if (challenger && inRoster(challenger)) {
    raiseDan(next.players[challenger], '七段');
    if (next.players[challenger].group >= 3) moveTo(challenger, 1);
  }

  // 竜王の交代。前の竜王は、次期は1組。
  const previous = next.holder;
  const winner = season.champion;
  if (winner && winner !== 'user' && inRoster(winner)) {
    const member = next.players[winner];
    member.ryuo += 1;
    member.group = 1;
    raiseDan(member, member.ryuo >= 2 ? '九段' : '八段');
    next.holder = winner;
  } else if (winner === 'user') {
    next.holder = USER_HOLDER;
  }
  if (previous !== next.holder && previous !== USER_HOLDER && inRoster(previous)) next.players[previous].group = 1;
  next.history.push({ no: season.no, holder: next.holder, name: next.holder === USER_HOLDER ? null : next.players[next.holder]?.name ?? null });

  // 年齢と強さの変化、勝数規定による昇段(強い棋士ほど、早く上がる)。
  for (const member of members(next)) {
    member.age += 1;
    if (member.kind === 'pro' || member.kind === 'woman') member.rating = Math.round(member.rating + ageDrift(member.age) + gauss(rng) * 30);
    if (member.character) member.character = ageCharacter(rng, member.character, member);
    if (member.kind !== 'pro' || isHolder(next, member.id)) continue;
    const index = DAN_ORDER.indexOf(member.dan);
    const chance = (DAN_UP_CHANCE[member.dan] ?? 0) * clamp(1 + (member.rating - 1450) / 400, 0.4, 2);
    if (index === 4 && member.rating < 1700) continue;
    if (index >= 0 && index < 5 && rng.next() < chance) member.dan = DAN_ORDER[index + 1];
  }

  // 引退と、特別枠の入れ替え。アマチュアは1期限り。奨励会員は、四段になれば棋士として残る。
  // 女流棋士は、昇級して5組以上にいれば残る(6組に残ったら、次の期は別の女流棋士が出る)。
  for (const member of members(next)) {
    if (isHolder(next, member.id)) continue;
    if (member.kind === 'shoreikai' && rng.next() < SHOREIKAI_PROMOTION) {
      Object.assign(member, { kind: 'pro', dan: '四段', since: season.no });
      continue;
    }
    const leaves = member.kind === 'amateur' || member.kind === 'shoreikai' || (member.kind === 'woman' && member.group === 6);
    if (leaves || rng.next() < retireChance(member)) {
      if (!leaves) next.retired += 1;
      delete next.players[member.id];
    }
  }
  next.season = season.no;

  // 組の人数をそろえる。多い組は弱い順に下へ、少ない組は下の組の強い順に上へ。
  const holderInRoster = next.holder !== USER_HOLDER;
  const effectiveUserGroup = holderInRoster ? userGroup : 1;
  for (let group = 1; group <= 5; group += 1) {
    const target = rosterTarget(group, effectiveUserGroup, holderInRoster);
    let current = groupMembers(next, group).sort((a, b) => b.rating - a.rating);
    while (current.length > target) {
      current.at(-1).group = group + 1;
      current = current.slice(0, -1);
    }
    while (current.length < target) {
      const below = groupMembers(next, group + 1).filter(({ kind }) => kind === 'pro').sort((a, b) => b.rating - a.rating)[0];
      if (!below) break;
      moveTo(below.id, group);
      current.push(below);
    }
  }

  // 新四段の加入。6組の棋士が定員に戻るように、2〜8名の範囲で決める(実物は年4名ほど)。
  const sixth = groupMembers(next, 6).filter(({ kind }) => kind === 'pro').length;
  const newcomers = clamp(rosterTarget(6, effectiveUserGroup, holderInRoster) - sixth, MIN_NEW_PROS, MAX_NEW_PROS);
  for (let index = 0; index < newcomers; index += 1) {
    createMember(next, rng, used, {
      group: 6, rating: 1330 + gauss(rng) * 70, age: 18 + Math.floor(rng.next() * 6), dan: '四段',
    });
  }
  addSpecials(next, rng, used);

  // 尺度を保つ。棋士の平均とばらつきが、最初の名簿からずれないように、全員を同じ式で直す(順位は変わらない)。
  // 毎期のゆらぎが積み重なって、強い棋士がどこまでも強くなるのを防ぐ。
  const mean = proMean(next);
  const ratio = next.ratingSd / Math.max(1, proSd(next));
  for (const member of members(next)) member.rating = Math.round(next.ratingMean + (member.rating - mean) * ratio);
  return next;
}

export function loadRoster(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(ROSTER_STORAGE_KEY) ?? 'null');
    if (!parsed || parsed.version !== ROSTER_VERSION || !parsed.players || typeof parsed.players !== 'object') return null;
    // 個性を持つ前に作った名簿には、棋士ごとに決まった種から個性を足す。
    for (const member of Object.values(parsed.players)) {
      if (member && !member.character) {
        const seed = [...String(member.id)].reduce((hash, char) => (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0, 7);
        member.character = createCharacter(createRng(seed), member);
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveRoster(storage, roster) {
  try {
    if (roster) storage?.setItem(ROSTER_STORAGE_KEY, JSON.stringify(roster));
    else storage?.removeItem(ROSTER_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
