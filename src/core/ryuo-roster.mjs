// 竜王戦に出る架空の棋士の名簿。期をまたいで残り、毎期の結果で更新する。
// - 組の昇級・降級、竜王の交代
// - 棋界の1年(ryuo-league.mjs): 年間の成績、順位戦、竜王以外のタイトル戦、昇段、将棋大賞
// - プレイヤーとの対戦成績
// - 年齢と強さの変化、引退、新四段の加入、6組の特別枠(アマ・女流・奨励会員)の入れ替え
// 登場する棋士はすべて架空で、実在の棋士とは関係がない。設計は docs/tournament-design.md の「名簿」。

import { GROUP_DAN_WEIGHTS, SPECIAL_RATING_OFFSET } from './ryuo-data.mjs';
import { GROUP_MEAN_RATING, GROUP_RATING_SPREAD } from './ryuo-strength.mjs';
import { createRng, gauss, weightedPick } from './ryuo-random.mjs';
import { ageCharacter, createCharacter, withAbilities } from './player-character.mjs';
import { newName } from './ryuo-names.mjs';
import { HANANE, STORY_PEOPLE, YOSHIHIKO, YOSHIHIKO_RATING, addStoryMembers, storyCharacter, storyMemberId } from './ryuo-story.mjs';
import { createRepertoire, styleEntry, withUsage } from './ryuo-repertoire.mjs';
import { driftUsage } from './opening-usage.mjs';
import {
  DAN_ORDER,
  assignJunni,
  careerSummary,
  createRecord,
  heldTitles,
  playLeagueYear,
  raiseDan,
  seedLeagueHistory,
  settleLeague,
} from './ryuo-league.mjs';

export { DAN_ORDER };

export const ROSTER_STORAGE_KEY = 'yacobihime:shogi-match:ryuo-roster';
/**
 * 名簿の保存形式。2から、得意戦法・成績・順位戦・タイトル・将棋大賞・プレイヤーとの対戦成績を持つ。
 * 3から、棋士は能力の配分(character.abilities)・金の特殊能力・戦法と囲いの使用率(repertoire.usage)・先後と戦法ごとの成績を持つ。
 * 版2は、レーティング・特徴・得意戦法から能力と使用率を作って移す(migrateRoster)。1は作り直す。
 */
export const ROSTER_VERSION = 3;
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

const WOMEN_DAN_WEIGHTS = [['女流初段', 15], ['女流二段', 30], ['女流三段', 30], ['女流四段', 15], ['女流五段', 10]];

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

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
    name: newName(rng, used, { women: kind === 'woman', age: memberAge }),
    kind,
    group,
    dan: dan ?? (kind === 'pro' ? initialDan(rng, group, memberAge) : specialDan(rng, kind)),
    rating: Math.round(rating ?? (GROUP_MEAN_RATING[group] + SPECIAL_RATING_OFFSET[kind] + gauss(rng) * GROUP_RATING_SPREAD[group])),
    age: memberAge,
    since: roster.season,
    ryuo: 0,
    titleCounts: {},
    awards: [],
    record: createRecord(),
    junni: null,
  };
  // 得意戦法(居飛車党・振り飛車党・両方)。styleは、いちばんの得意戦法。
  member.repertoire = createRepertoire(rng, group);
  member.style = styleEntry(member.repertoire.styles[0]);
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
  const roster = {
    version: ROSTER_VERSION, season: 0, nextId: 1, players: {}, holder: USER_HOLDER, history: [], retired: 0, ratingMean: 0, ratingSd: 0,
    titles: {}, titleHistory: [], awards: [], vsUser: {}, lastYear: null,
  };
  const used = new Set();
  // 名簿の竜王は、天鷺善彦(竜王を含む六冠。履歴を作ったあとに加える)。プレイヤーが竜王なら、善彦は1組の棋士。
  // 物語の人物(羽音・善彦)の分を、その組の乱数の棋士から減らす。竜王の善彦は、組の枠を使わない。
  const storyGroups = userIsChampion ? [1, 1] : [userGroup];
  for (const group of GROUPS) {
    const count = rosterTarget(group, userIsChampion ? 1 : userGroup, !userIsChampion) - storyGroups.filter((g) => g === group).length;
    for (let index = 0; index < count; index += 1) createMember(roster, rng, used, { group });
  }
  addSpecials(roster, rng, used);
  // 順位戦のクラスと、過去のタイトル戦・通算勝数の履歴を作り、実績に合わせて段位を上げる。
  assignJunni(roster, rng);
  seedLeagueHistory(roster, rng, { ageDrift });
  // 物語の人物は、履歴を作ったあとに加える(通算の記録は人物の決まりのまま。善彦は竜王を含む六冠)。
  roster.holder = USER_HOLDER;
  addStoryMembers(roster, { userGroup, userIsChampion, fresh: true });
  roster.ratingMean = Math.round(proMean(roster));
  roster.ratingSd = Math.round(proSd(roster));
  return roster;
}

function addSpecials(roster, rng, used) {
  for (const [kind, slots] of Object.entries(SPECIAL_SLOTS)) {
    for (let index = 0; index < slots; index += 1) createMember(roster, rng, used, { group: 6, kind });
  }
}

/**
 * 物語の人物を加えた名簿を返す(保存してあった、人物のいない名簿のため)。いれば同じ名簿を返す。
 * タイトルの記録は書き換えない(善彦は名人を持たずにA級に入る)。
 * @param {any} roster
 * @param {{ userGroup?: number, userIsChampion?: boolean }} options
 */
export function withStoryMembers(roster, options) {
  if (!roster || (storyMemberId(roster, HANANE) && storyMemberId(roster, YOSHIHIKO))) return roster;
  const next = structuredClone(roster);
  addStoryMembers(next, options);
  return next;
}

/**
 * 組から、この期に出る棋士を選ぶ。6組は、特別枠を人数に比例して混ぜる(実物は約70名中10名)。
 * 羽音は、組にいれば必ず出る(プレイヤーのライバルなので)。
 */
export function selectParticipants(roster, group, size, rng) {
  const all = groupMembers(roster, group).sort((a, b) => (a.id < b.id ? -1 : 1));
  const rival = size > 1 ? all.find((member) => member.story === HANANE) : null;
  if (rival) return [rival.id, ...selectFrom(all.filter((member) => member !== rival), group, size - 1, rng)];
  return selectFrom(all, group, size, rng);
}

function selectFrom(pool, group, size, rng) {
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
    story: member.story ?? null,
    dan: isHolder(roster, id) ? '竜王' : member.dan,
    kind: member.kind,
    group: member.group,
    rating: member.rating,
    style: { ...member.style },
    repertoire: structuredClone(member.repertoire ?? { party: 'static', styles: [member.style.id] }),
    ryuo: member.ryuo,
    age: member.age,
    character: structuredClone(member.character ?? { attack: 0, traits: [] }),
    // 紹介用の実績(タイトル・順位戦・成績・将棋大賞)と、プレイヤーとの対戦成績。
    profile: careerSummary(roster, member),
    vsUser: roster.vsUser?.[id] ? { ...roster.vsUser[id] } : null,
  };
}

/** プレイヤーとの対戦成績を足す。streakはプレイヤーから見た連勝(+)・連敗(-)。 */
function recordVsUser(roster, season) {
  roster.vsUser ??= {};
  for (const game of season.userGames ?? []) {
    if (!roster.players[game.opponentId]) continue;
    const entry = roster.vsUser[game.opponentId] ?? { wins: 0, losses: 0, streak: 0, lastNo: null, lastWin: null };
    if (game.win) entry.wins += 1;
    else entry.losses += 1;
    entry.streak = game.win ? Math.max(0, entry.streak) + 1 : Math.min(0, entry.streak) - 1;
    entry.lastNo = season.no;
    entry.lastWin = game.win;
    roster.vsUser[game.opponentId] = entry;
  }
}

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
  next.titleHistory = [...(next.titleHistory ?? []), {
    no: season.no, title: 'ryuo', holder: next.holder, name: next.holder === USER_HOLDER ? null : next.players[next.holder]?.name ?? null, changed: previous !== next.holder,
  }];
  recordVsUser(next, season);

  // 棋界の1年: 年間の成績、順位戦、竜王以外のタイトル戦、昇段(勝数規定・順位戦・タイトル)、将棋大賞。
  next.lastYear = { no: season.no, ...playLeagueYear(next, season, rng) };

  // 年齢と強さの変化。個性も少しずつ変わる。
  for (const member of members(next)) {
    member.age += 1;
    if (member.kind === 'pro' || member.kind === 'woman') member.rating = Math.round(member.rating + ageDrift(member.age) + gauss(rng) * 30);
    // 物語の人物の個性と使用率は決まりのまま(変えない)。ほかの棋士は、使用率も流行で少し動く。
    if (member.character && !member.story) member.character = ageCharacter(rng, member.character, member);
    if (member.repertoire?.usage && !member.story) member.repertoire = { ...member.repertoire, usage: driftUsage(rng, member.repertoire.usage) };
  }

  // 引退と、特別枠の入れ替え。アマチュアは1期限り。奨励会員は、四段になれば棋士として残る。
  // 女流棋士は、昇級して5組以上にいれば残る(6組に残ったら、次の期は別の女流棋士が出る)。
  for (const member of members(next)) {
    // タイトルを持っている棋士と、物語の人物は引退しない。
    if (member.story || isHolder(next, member.id) || heldTitles(next, member.id).length) continue;
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
  // 順位戦の定員をそろえ(新四段はC級2組)、実績に合わせて段位を上げる。
  settleLeague(next);

  // 尺度を保つ。棋士の平均とばらつきが、最初の名簿からずれないように、全員を同じ式で直す(順位は変わらない)。
  // 毎期のゆらぎが積み重なって、強い棋士がどこまでも強くなるのを防ぐ。
  const mean = proMean(next);
  const ratio = next.ratingSd / Math.max(1, proSd(next));
  for (const member of members(next)) member.rating = Math.round(next.ratingMean + (member.rating - mean) * ratio);
  return next;
}

/**
 * 版2の名簿を版3へ移す。棋士ごとに、レーティング・特徴・得意戦法から、能力の配分・金の特殊能力・使用率を作る
 * (名簿のidから決まる乱数で作るので、何度移しても同じになる)。物語の人物は、人物の決まり(年齢・能力・使用率・特殊能力)にそろえる。
 * タイトルと履歴は書き換えない(善彦の六冠は、新しく作る名簿だけ)。
 */
export function migrateRoster(roster) {
  if (!roster || roster.version === ROSTER_VERSION) return roster;
  const next = structuredClone(roster);
  for (const member of members(next)) {
    const rng = createRng((hashId(member.id) ^ 0x2545f491) >>> 0);
    if (member.story) {
      refreshStoryMember(member);
      continue;
    }
    member.repertoire = withUsage(rng, member.repertoire ?? { party: 'static', styles: [member.style?.id ?? 'aigakari'] });
    member.character = withAbilities(rng, member.character, member);
  }
  next.version = ROSTER_VERSION;
  return next;
}

function hashId(id) {
  let hash = 0;
  for (const char of String(id)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}

/** 物語の人物を、人物の決まりにそろえる(保存してあった名簿のため)。善彦の年齢は、加わってからの年数を保って43歳からにする。 */
function refreshStoryMember(member) {
  const person = STORY_PEOPLE[member.story];
  if (!person) return;
  const years = Math.max(0, (member.age ?? person.age) - (member.story === YOSHIHIKO ? 52 : person.age));
  if (member.story === YOSHIHIKO) {
    member.age = person.age + years;
    member.rating = Math.max(member.rating, YOSHIHIKO_RATING);
  }
  member.repertoire = structuredClone(person.repertoire);
  member.style = styleEntry(member.repertoire.styles[0]);
  member.character = storyCharacter(member.story);
}

export function loadRoster(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(ROSTER_STORAGE_KEY) ?? 'null');
    if (!parsed || !parsed.players || typeof parsed.players !== 'object') return null;
    if (parsed.version === 2) return migrateRoster(parsed);
    if (parsed.version !== ROSTER_VERSION) return null;
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
