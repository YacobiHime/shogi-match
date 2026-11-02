// 団体戦(docs/team-battle-design.md)。羽音と組んで出る、高校の団体戦(全国高校将棋団体戦)とプロの早指し団体戦。
// 画面・保存の仕組み・暦に依存しない。研修会(kenshukai.mjs)と同じく、1つの大会(run)を作って、プレイヤーの1局ずつ進める。
// 仲間とほかのチームの対局は、レーティングの勝率(ryuo-simulation.mjsのsimulateMemberGame)で決める。

import { createRng, gauss, pick } from './ryuo-random.mjs';
import { newName } from './ryuo-names.mjs';
import { createRepertoire, pickGameStyle, repertoireText, styleEntry } from './ryuo-repertoire.mjs';
import { createCharacter } from './player-character.mjs';
import { simulateMemberGame } from './ryuo-simulation.mjs';
import { HANANE, YOSHIHIKO, STORY_PEOPLE, storyCharacter, storyMemberId } from './ryuo-story.mjs';
import { ABILITIES, abilityValues } from './player-abilities.mjs';
import { GROUP_MEAN_RATING, MAX_CPU_LEVEL, isRealWorld, recommendedWorldLevel, worldCpuLevel, WORLD_BASE_RATING } from './ryuo-strength.mjs';
import { levelGradeName } from './tournament-world.mjs';

export const TEAM_BATTLE_KEY = 'yacobihime:shogi-match:team-battle:v1';

/** 自分のチームの3人のid(大会の中だけのid)。 */
export const TEAM_USER_ID = 'user';
export const TEAM_HANANE_ID = 'hanane';
export const TEAM_MOMOKA_ID = 'momoka';
/** 自分のチーム。 */
export const USER_TEAM = 'T0';

/**
 * 高校の団体戦の、自分たちの学校(羽音と百花が通う)。燈ヶ丘(ともりがおか)高校(ノベルと同じ舞台。docs/novel-reference.mdの2章)。
 * 読み仮名は、はじめて出る誘いの場面に添える(docs/team-battle-design.mdの13章)。
 */
export const SCHOOL_NAME = '燈ヶ丘高校';
/** 学校の名前の読み。 */
export const SCHOOL_READING = 'ともりがおか';
/** 高校の選手のレーティングの真ん中。研修会のクラス(870〜1170)の上のほう。自分の相手のLvは、これを世界の基準にする。 */
export const SCHOOL_BASE = 1000;
/** 羽音は高校生の中では飛び抜けて強い(ほぼ勝つ。4章の7)。 */
export const SCHOOL_HANANE_RATING = SCHOOL_BASE + 450;
/** 百花は学校の選手の真ん中より少し下。 */
export const SCHOOL_MOMOKA_RATING = SCHOOL_BASE - 40;

/** 席の名前(高校。実力順に固定)。 */
export const SCHOOL_SEATS = Object.freeze(['主将', '副将', '三将']);

/**
 * 形式。高校は実物の全国高等学校将棋選手権の形(3人・2勝・スイス方式4回戦・決勝トーナメント16校)、
 * プロはABEMAトーナメントの形(3人・5本先取・3チームの予選リーグ・本戦8チーム)。
 */
export const TEAM_FORMATS = Object.freeze({
  school: Object.freeze({
    id: 'school',
    name: '全国高校将棋団体戦',
    short: '高校の団体戦',
    note: '羽音・百花と3人で。地区大会から全国へ。3局のうち2勝で勝ち',
    teams: 48,
    games: 3,
    winsToTake: 2,
    swissRounds: 4,
    swissPass: 3,
    swissFail: 2,
    knockout: 16,
    byoyomi: 0,
  }),
  pro: Object.freeze({
    id: 'pro',
    name: '早指し団体戦',
    short: 'プロの団体戦',
    note: '羽音と、選んだ棋士と3人で。9本勝負の5本先取',
    teams: 12,
    games: 9,
    winsToTake: 5,
    perPlayerMax: 3,
    leagueSize: 3,
    leagueAdvance: 2,
    knockout: 8,
    byoyomi: 30,
  }),
});
export const TEAM_FORMAT_IDS = Object.freeze(Object.keys(TEAM_FORMATS));
export const teamFormat = (id) => TEAM_FORMATS[id] ?? TEAM_FORMATS.school;

/**
 * 高校の団体戦の段階(docs/team-battle-design.mdの15章)。地区大会で決勝に進めば県大会、県大会で優勝すれば全国大会。
 * meanは、その段階のほかの学校の選手の真ん中(全国より弱い。地区大会は易しく、全国に近づくほど強くなる。D:4-4)。
 * placeBaseは最高成績の比べ方(小さいほど良い。全国1〜99、県大会100番台、地区大会200番台)。
 */
export const SCHOOL_STAGES = Object.freeze([
  Object.freeze({
    id: 'district', name: '地区大会', short: '地区', teams: 8, advance: 2, mean: SCHOOL_BASE - 120, spread: 70, placeBase: 200,
    rounds: Object.freeze(['1回戦', '準決勝', '決勝']), places: Object.freeze(['ベスト8', 'ベスト4', '準優勝']),
  }),
  Object.freeze({
    id: 'prefecture', name: '県大会', short: '県', teams: 8, advance: 1, mean: SCHOOL_BASE - 60, spread: 60, placeBase: 100,
    rounds: Object.freeze(['準々決勝', '準決勝', '決勝']), places: Object.freeze(['ベスト8', 'ベスト4', '準優勝']),
  }),
  Object.freeze({ id: 'national', name: '全国大会', short: '全国', placeBase: 0 }),
]);
export const SCHOOL_STAGE_IDS = Object.freeze(SCHOOL_STAGES.map((stage) => stage.id));
const schoolStageInfo = (id) => SCHOOL_STAGES.find((stage) => stage.id === id) ?? SCHOOL_STAGES[2];
/** 県の4つの地区(はじめが燈ヶ丘高校の地区)。県の名前は出さない(15章の捨てるもの)。 */
export const SCHOOL_DISTRICTS = Object.freeze(['中部', '東部', '西部', '北部']);
/** 大会の段階(高校。前の版の大会は段階を持たないので全国大会)。プロはnull。 */
export const teamStageOf = (run) => (run?.format === 'school' ? (run.stage ?? 'national') : null);

/** トーナメントの回戦の名前(大きさごと)。 */
const KO_ROUND_NAMES = Object.freeze({
  16: ['1回戦', '2回戦', '準決勝', '決勝'],
  8: ['準々決勝', '準決勝', '決勝'],
});
/** 結果の言い方(トーナメントで負けた回戦ごと)。 */
const KO_PLACES = Object.freeze({
  16: ['ベスト16', 'ベスト8', 'ベスト4', '準優勝'],
  8: ['ベスト8', 'ベスト4', '準優勝'],
});
/** 種の並び(1位と最下位が決勝まで当たらない)。 */
const SEED_ORDER = Object.freeze({
  16: [1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11],
  8: [1, 8, 4, 5, 2, 7, 3, 6],
});

// 架空の学校の名前。実在の学校と重なりにくいよう、風景の言葉と終わりの形を組み合わせる。
const SCHOOL_HEADS = Object.freeze([
  '白鷺', '青葉', '東雲', '若葉', '星見', '鳴海', '朝凪', '清流', '松風', '月見', '浜風', '光陵', '楓', '曙', '白樺',
  '常盤', '菜の花', '天神', '北辰', '若竹', '雪見', '碧水', '朱雀', '紅葉', '富士見', '水城', '稲穂', '葵', '藤波', '桐生',
  '桜川', '霧島', '春日', '夕凪', '銀杏', '翠嶺', '蒼風', '花園', '鷹巣', '千鳥', '瑞穂', '久遠', '明星', '野分', '早瀬',
  '琴音', '萌黄', '岬',
]);
const SCHOOL_TAILS = Object.freeze(['高校', '高校', '高校', 'ヶ丘高校', '台高校', '学園高校', '学院高校']);
const PREFECTURES = Object.freeze([
  '北海道', '青森', '岩手', '宮城', '秋田', '山形', '福島', '茨城', '栃木', '群馬', '埼玉', '千葉', '東京', '神奈川', '新潟', '富山',
  '石川', '福井', '山梨', '長野', '岐阜', '静岡', '愛知', '三重', '滋賀', '京都', '大阪', '兵庫', '奈良', '和歌山', '鳥取', '島根',
  '岡山', '広島', '山口', '徳島', '香川', '愛媛', '高知', '福岡', '佐賀', '長崎', '熊本', '大分', '宮崎', '鹿児島', '沖縄',
]);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const other = (side) => (side === 'a' ? 'b' : 'a');

// ---- 棋士

/** 高校生の選手を1人作る。 */
function createStudent(run, rng, used, rating) {
  const id = `s${run.nextId}`;
  run.nextId += 1;
  const grade = 1 + Math.floor(rng.next() * 3);
  const age = 15 + grade;
  const repertoire = createRepertoire(rng, 6);
  const style = styleEntry(repertoire.styles[0]);
  const woman = rng.next() < 0.25;
  const member = {
    id,
    name: newName(rng, used, { women: woman, age }),
    kind: 'student',
    dan: `${grade}年`,
    rating: Math.round(rating),
    age,
    repertoire,
    style,
    character: createCharacter(rng, { rating, age, style }),
  };
  run.players[id] = member;
  return member;
}

/** 名簿の棋士を、この大会の写しにする(名簿が変わっても、この大会は変わらない)。 */
function copyRosterMember(member, id = `p-${member.id}`) {
  return {
    id,
    rosterId: member.id,
    name: member.name,
    kind: 'pro',
    dan: member.dan,
    rating: member.rating,
    age: member.age,
    story: member.story ?? null,
    repertoire: member.repertoire ? structuredClone(member.repertoire) : null,
    style: member.style ?? null,
    character: member.character ? structuredClone(member.character) : null,
    titles: member.titleCounts ? Object.keys(member.titleCounts) : [],
  };
}

/** 羽音(名簿にいれば名簿の写し、いなければ人物の設定から)。高校ではレーティングを高校生の尺度に置く。 */
function hananeMember(roster, format) {
  const rosterId = storyMemberId(roster, HANANE);
  const base = rosterId ? copyRosterMember(roster.players[rosterId], TEAM_HANANE_ID) : {
    id: TEAM_HANANE_ID,
    name: STORY_PEOPLE[HANANE].name,
    kind: 'pro',
    dan: '四段',
    rating: WORLD_BASE_RATING + 120,
    age: STORY_PEOPLE[HANANE].age,
    story: HANANE,
    repertoire: structuredClone(STORY_PEOPLE[HANANE].repertoire),
    style: styleEntry(STORY_PEOPLE[HANANE].repertoire.styles[0]),
    character: storyCharacter(HANANE),
    titles: [],
  };
  base.story = HANANE;
  if (format === 'school') {
    base.rating = SCHOOL_HANANE_RATING;
    base.dan = '2年';
  }
  return base;
}

/**
 * 百花の棋風と得意戦法を決める種。物語の人物なので、どの大会でも同じ百花にする(羽音と同じ。仲間のステータスで毎回違うと人物がぶれる。16章)。
 * 楽しそうに攻める初心者に合う種を選んだ(いちばん得意は寄せ、次が発想、苦手は大局観。速攻・大舞台に弱い・優勢で緩むの特徴)。
 */
const MOMOKA_SEED = 20260500;

/** 百花(高校の団体戦の3人目)。将棋はまだ初心者に近いが、楽しそうに攻める。 */
function momokaMember() {
  const rng = createRng(MOMOKA_SEED);
  const repertoire = createRepertoire(rng, 6);
  const style = styleEntry(repertoire.styles[0]);
  const character = createCharacter(rng, { rating: SCHOOL_MOMOKA_RATING, age: 16, style });
  character.attack = 0.5;
  return {
    id: TEAM_MOMOKA_ID,
    name: '桜乃百花',
    kind: 'student',
    dan: '2年',
    rating: SCHOOL_MOMOKA_RATING,
    age: 16,
    story: 'momoka',
    repertoire,
    style,
    character,
  };
}

/** プレイヤー(対局は自分で指すので、強さは持たない)。 */
function userMember(userName, format) {
  return { id: TEAM_USER_ID, name: userName || 'あなた', kind: format === 'school' ? 'student' : 'pro', dan: format === 'school' ? '2年' : '', rating: null, you: true };
}

// ---- オーダー(高校)

/**
 * 高校のオーダー(席の順のid)。自分の席だけを選び、羽音は残りの上、百花は残りの下に座る(4章の2)。
 * @param {number} userSeat 0=主将 1=副将 2=三将
 */
export function schoolOrder(userSeat = 1) {
  const seat = clamp(Math.round(Number(userSeat) || 0), 0, 2);
  const order = [null, null, null];
  order[seat] = TEAM_USER_ID;
  const free = [0, 1, 2].filter((index) => index !== seat);
  order[free[0]] = TEAM_HANANE_ID;
  order[free[1]] = TEAM_MOMOKA_ID;
  return order;
}
/** 羽音のおすすめの席(主将 羽音・副将 君・三将 百花)。 */
export const RECOMMENDED_SCHOOL_SEAT = 1;

// ---- ドラフト(プロ)

/** プロの名簿の棋士(物語の人物の羽音は除く)。強い順。 */
function rosterPros(roster) {
  return Object.values(roster?.players ?? {})
    .filter((member) => member.kind === 'pro' && member.story !== HANANE)
    .sort((a, b) => b.rating - a.rating || String(a.id).localeCompare(String(b.id)));
}

/** プロの団体戦のリーダー(名簿の強い順に11人。善彦がいれば必ず入る)。 */
export function draftLeaders(roster) {
  const pros = rosterPros(roster);
  const leaders = pros.slice(0, TEAM_FORMATS.pro.teams - 1);
  const yoshihiko = pros.find((member) => member.story === YOSHIHIKO);
  if (yoshihiko && !leaders.includes(yoshihiko)) leaders[leaders.length - 1] = yoshihiko;
  return leaders;
}

/** ドラフトの候補(リーダーと羽音を除く名簿の棋士。強い順に、多すぎないよう16人まで)。 */
export function draftCandidates(roster, limit = 16) {
  const leaders = new Set(draftLeaders(roster).map((member) => member.id));
  return rosterPros(roster).filter((member) => !leaders.has(member.id)).slice(0, limit);
}

/**
 * 羽音に任せたときのドラフト(4章の5)。プレイヤーの能力のいちばん低い項目が高い棋士を選び、その理由を言う。
 * 能力が分からないときは、いちばん強い棋士。羽音は敬語と「！」を使わない。
 * @param {any[]} candidates 名簿の棋士
 * @param {Record<string, number> | null} [myValues] プレイヤーの能力(ABILITY_KEYSの値)
 * @returns {{ id: string, reason: string } | null}
 */
export function hananeDraftPick(candidates, myValues = null) {
  if (!candidates?.length) return null;
  const known = myValues ? ABILITIES.filter(({ key }) => Number.isFinite(myValues[key])) : [];
  if (!known.length) {
    const best = candidates[0];
    return { id: best.id, reason: `${best.name}さんにした。いま空いている中で、いちばん強いから。迷うより確かでしょ。` };
  }
  const weakest = [...known].sort((a, b) => myValues[a.key] - myValues[b.key])[0];
  const chosen = [...candidates].sort((a, b) =>
    abilityValues(b)[weakest.key] - abilityValues(a)[weakest.key] || b.rating - a.rating)[0];
  return {
    id: chosen.id,
    reason: `${chosen.name}さんにした。君は${weakest.label}が少し苦手そうだから、${weakest.label}の強い人がいいと思って。`,
  };
}

// ---- チームを作る

function schoolName(rng, used) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const name = `${pick(rng, SCHOOL_HEADS)}${pick(rng, SCHOOL_TAILS)}`;
    if (!used.has(name) && name !== SCHOOL_NAME) {
      used.add(name);
      return name;
    }
  }
  const name = `${pick(rng, SCHOOL_HEADS)}高校${used.size}`;
  used.add(name);
  return name;
}

/** 同じ大会で、選手の名前と学校の名前は重ねない(段階ごとに学校を足すので、いまの大会から集める)。 */
const usedPlayerNames = (run) => new Set(Object.values(run.players).map((member) => member.name));
const usedSchoolNames = (run) => new Set(Object.values(run.teams).map((team) => team.name));

/**
 * 1つの学校を足す。学校の強さは真ん中(mean)のまわりに散らし、選手は学校の強さのまわり。席は実力順(1章)。
 * @param {any} run
 * @param {{ next(): number }} rng
 * @param {{ id: string, area: string, mean: number, spread: number, usedNames: Set<string>, schoolNames: Set<string> }} options
 */
function addSchool(run, rng, { id, area, mean, spread, usedNames, schoolNames }) {
  const center = mean + gauss(rng) * spread;
  const members = [0, 1, 2]
    .map(() => createStudent(run, rng, usedNames, center + gauss(rng) * 45))
    .sort((a, b) => b.rating - a.rating)
    .map((member) => member.id);
  run.teams[id] = { id, name: schoolName(rng, schoolNames), area, members };
  return id;
}

/** 全国大会のほかの47校(都道府県の代表)。自分たちの学校と合わせて48校。 */
function buildNationalTeams(run, rng) {
  const usedNames = usedPlayerNames(run);
  const schoolNames = usedSchoolNames(run);
  const prefectures = [...PREFECTURES];
  const ids = [USER_TEAM];
  for (let index = 1; index < TEAM_FORMATS.school.teams; index += 1) {
    const area = prefectures.splice(Math.floor(rng.next() * prefectures.length), 1)[0] ?? '';
    ids.push(addSchool(run, rng, { id: `T${index}`, area, mean: SCHOOL_BASE, spread: 70, usedNames, schoolNames }));
  }
  return ids;
}

/** 全国大会の学校のid(前の版の大会は、段階を持たないので全部の学校)。 */
const nationalIds = (run) => run.stageTeams?.national ?? Object.keys(run.teams);

function shuffleInPlace(rng, list) {
  for (let index = list.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng.next() * (index + 1));
    [list[index], list[swap]] = [list[swap], list[index]];
  }
  return list;
}

/** 地区大会(15章の2)。同じ地区の8校のトーナメント。組み合わせは無作為。 */
function startDistrict(run, rng) {
  const info = schoolStageInfo('district');
  const usedNames = usedPlayerNames(run);
  const schoolNames = usedSchoolNames(run);
  const ids = [USER_TEAM];
  for (let index = 1; index < info.teams; index += 1) {
    ids.push(addSchool(run, rng, { id: `D${index}`, area: '', mean: info.mean, spread: info.spread, usedNames, schoolNames }));
  }
  shuffleInPlace(rng, ids);
  run.stage = 'district';
  run.stageTeams = { ...(run.stageTeams ?? {}), district: [...ids] };
  startKnockout(run, rng, ids, { paired: true, size: info.teams, stage: 'district' });
}

/**
 * 県大会(15章の3)。4つの地区の1位・2位の8校。1回戦は、ある地区の1位と別の地区の2位
 * (同じ地区の2校は決勝まで当たらない)。first・secondは自分の地区の1位・2位。
 */
function startPrefecture(run, rng, first, second) {
  const info = schoolStageInfo('prefecture');
  const usedNames = usedPlayerNames(run);
  const schoolNames = usedSchoolNames(run);
  const [home, ...others] = SCHOOL_DISTRICTS;
  for (const id of [first, second]) if (id !== USER_TEAM) run.teams[id].area = `${home}地区`;
  const pairs = others.map((district, index) => [1, 2]
    .map((n) => addSchool(run, rng, { id: `P${index * 2 + n}`, area: `${district}地区`, mean: info.mean, spread: info.spread, usedNames, schoolNames }))
    .sort((x, y) => teamStrength(run, y) - teamStrength(run, x)));
  const [b, c, d] = pairs;
  const slots = [first, b[1], c[0], d[1], b[0], second, d[0], c[1]];
  run.stage = 'prefecture';
  run.stageTeams = { ...(run.stageTeams ?? {}), prefecture: [...slots] };
  startKnockout(run, rng, slots, { paired: true, size: info.teams, stage: 'prefecture' });
}

/** 全国大会(今までの高校の団体戦)。48校のスイス方式4回戦から。 */
function startNational(run, rng) {
  const ids = buildNationalTeams(run, rng);
  run.stage = 'national';
  run.stageTeams = { ...(run.stageTeams ?? {}), national: ids };
  run.phase = 'swiss';
  run.swiss = { round: 0, records: {}, status: Object.fromEntries(ids.map((id) => [id, 'active'])), rounds: [] };
  startSwissRound(run, rng);
}

function buildProTeams(run, rng, roster, draftPickId) {
  const leaders = draftLeaders(roster);
  const leaderIds = new Set(leaders.map((member) => member.id));
  const pool = rosterPros(roster).filter((member) => !leaderIds.has(member.id));
  // 自分のチーム: プレイヤー(リーダー)・羽音・ドラフトの1人。
  const picked = pool.find((member) => member.id === draftPickId) ?? pool[0];
  const userTeam = [TEAM_USER_ID, TEAM_HANANE_ID];
  if (picked) {
    const copy = copyRosterMember(picked);
    run.players[copy.id] = copy;
    userTeam.push(copy.id);
    pool.splice(pool.indexOf(picked), 1);
  }
  run.teams[USER_TEAM] = { id: USER_TEAM, name: `チーム${run.userName || 'やこび'}`, members: userTeam, you: true };
  // ほかの11チーム: リーダーが、残りから2人ずつ(スネーク。強さに少しのぶれ)。
  const teams = leaders.map((leader, index) => {
    const copy = copyRosterMember(leader);
    run.players[copy.id] = copy;
    return { id: `T${index + 1}`, name: `チーム${leader.name}`, members: [copy.id], leader: copy.id };
  });
  for (let pickRound = 0; pickRound < 2; pickRound += 1) {
    const order = pickRound === 0 ? [...teams].reverse() : teams;
    for (const team of order) {
      if (!pool.length) break;
      const window = pool.slice(0, Math.min(pool.length, 4));
      const chosen = window[Math.floor(rng.next() * window.length)];
      pool.splice(pool.indexOf(chosen), 1);
      const copy = copyRosterMember(chosen);
      run.players[copy.id] = copy;
      team.members.push(copy.id);
    }
  }
  for (const team of teams) run.teams[team.id] = team;
}

// ---- 試合

/** 2つのチームの試合を作る(まだ指さない)。 */
function newMatch(run, { stage, round, label, a, b }) {
  const id = `m${run.nextMatch}`;
  run.nextMatch += 1;
  const match = { id, stage, round, label, a, b, games: [], score: { a: 0, b: 0 }, winner: null, used: { a: {}, b: {} } };
  run.matches[id] = match;
  return match;
}

const teamOf = (run, side, match) => run.teams[match[side]];
/** 決勝の試合か(大舞台。「決勝トーナメント 1回戦」は含めない)。 */
const isFinal = (match) => /(^|\s)決勝$/.test(match.label);
const isUserMatch = (match) => match.a === USER_TEAM || match.b === USER_TEAM;
const userSide = (match) => (match.a === USER_TEAM ? 'a' : 'b');

/** 1局を決める(aWins)。大舞台(決勝)は少しぶれる。 */
function decideGame(run, rng, aId, bId, big = false) {
  return simulateMemberGame(rng, run.players[aId], run.players[bId], { big }).aWins;
}

function finishIfDecided(run, match) {
  const need = teamFormat(run.format).winsToTake;
  if (match.winner) return;
  if (run.format === 'school') {
    // 3局とも決まってから(1局目だけで決めない)。
    if (match.games.length >= TEAM_FORMATS.school.games && match.games.every((game) => game.winner)) {
      match.winner = match.score.a > match.score.b ? 'a' : 'b';
    }
    return;
  }
  if (match.score.a >= need) match.winner = 'a';
  else if (match.score.b >= need) match.winner = 'b';
}

function setGameWinner(run, match, game, winner) {
  game.winner = winner;
  match.score[winner] += 1;
  finishIfDecided(run, match);
}

/** 仲間の局を知らせる手数(自分の対局の手数。docs/team-battle-design.mdの19章の1)。 */
export const REVEAL_MIN_PLY = 28;
export const REVEAL_MAX_PLY = 80;

/** 高校の試合の3局。自分の席はあとで指し、仲間の局は決めておいて対局の途中に知らせる(4章の9)。 */
function playSchoolMatch(run, rng, match) {
  const a = teamOf(run, 'a', match).members;
  const b = teamOf(run, 'b', match).members;
  const big = isFinal(match);
  for (let seat = 0; seat < 3; seat += 1) {
    const game = { seat, a: a[seat], b: b[seat], winner: null };
    match.games.push(game);
    if (game.a === TEAM_USER_ID || game.b === TEAM_USER_ID) {
      game.user = true;
      continue;
    }
    // 仲間の局は、28〜80手目のどこかで速報にする(種で決める。自分の対局のあいだに届くように。19章の1)。
    if (isUserMatch(match)) game.reveal = REVEAL_MIN_PLY + Math.floor(rng.next() * (REVEAL_MAX_PLY - REVEAL_MIN_PLY + 1));
    setGameWinner(run, match, game, decideGame(run, rng, game.a, game.b, big) ? 'a' : 'b');
  }
}

/** プロの試合で、次の局に出す棋士(まだ3局指していない人。ほかのチームは無作為に)。 */
function availableMembers(run, match, side) {
  const max = TEAM_FORMATS.pro.perPlayerMax;
  return teamOf(run, side, match).members.filter((id) => (match.used[side][id] ?? 0) < max);
}

function nextProGame(run, match, aId, bId) {
  const game = { no: match.games.length + 1, a: aId, b: bId, winner: null };
  match.games.push(game);
  match.used.a[aId] = (match.used.a[aId] ?? 0) + 1;
  match.used.b[bId] = (match.used.b[bId] ?? 0) + 1;
  return game;
}

/** ほかのチームどうしのプロの試合を、5勝まで決める。 */
function playProMatchAuto(run, rng, match) {
  const big = isFinal(match);
  while (!match.winner) {
    const a = pick(rng, availableMembers(run, match, 'a'));
    const b = pick(rng, availableMembers(run, match, 'b'));
    const game = nextProGame(run, match, a, b);
    setGameWinner(run, match, game, decideGame(run, rng, a, b, big) ? 'a' : 'b');
  }
}

/** 試合を決める(自分のチームの試合は、自分の局の前まで)。 */
function playMatch(run, rng, match) {
  if (run.format === 'school') playSchoolMatch(run, rng, match);
  else if (!isUserMatch(match)) playProMatchAuto(run, rng, match);
}

// ---- 予選(高校: スイス方式)

function swissRecord(run, teamId) {
  run.swiss.records[teamId] ??= { w: 0, l: 0, boards: 0, opps: [] };
  return run.swiss.records[teamId];
}

function swissActive(run) {
  return nationalIds(run).filter((id) => run.swiss.status[id] === 'active');
}

/** 同じ成績どうし、まだ当たっていない学校と組む。余ったら下の成績へ。自分の学校の相手は無作為(種)。 */
function pairSwiss(run, rng) {
  const groups = new Map();
  for (const id of swissActive(run)) {
    const record = swissRecord(run, id);
    const key = `${record.w}-${record.l}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(id);
  }
  const keys = [...groups.keys()].sort((x, y) => {
    const [xw, xl] = x.split('-').map(Number);
    const [yw, yl] = y.split('-').map(Number);
    return yw - xw || xl - yl;
  });
  const pairs = [];
  let carry = [];
  for (const key of keys) {
    const list = [...carry, ...groups.get(key)];
    carry = [];
    // 混ぜてから組む(同じ相手を避ける)。
    for (let index = list.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(rng.next() * (index + 1));
      [list[index], list[swap]] = [list[swap], list[index]];
    }
    while (list.length >= 2) {
      const first = list.shift();
      const opps = swissRecord(run, first).opps;
      let partner = list.findIndex((id) => !opps.includes(id));
      if (partner < 0) partner = 0;
      pairs.push([first, list.splice(partner, 1)[0]]);
    }
    carry = list;
  }
  // 最後に1校余ったら、その学校は不戦勝(48校なら起きない)。
  return { pairs, bye: carry[0] ?? null };
}

function applySwissResult(run, match) {
  const format = TEAM_FORMATS.school;
  for (const side of ['a', 'b']) {
    const record = swissRecord(run, match[side]);
    record.opps.push(match[other(side)]);
    record.boards += match.score[side];
    if (match.winner === side) record.w += 1;
    else record.l += 1;
    if (record.w >= format.swissPass) run.swiss.status[match[side]] = 'pass';
    else if (record.l >= format.swissFail) run.swiss.status[match[side]] = 'out';
  }
}

/** 予選の次の回戦を組み、ほかの試合を決める。自分の学校が残っていれば、自分の試合を待つ。 */
function startSwissRound(run, rng) {
  run.swiss.round += 1;
  const { pairs, bye } = pairSwiss(run, rng);
  const round = [];
  for (const [a, b] of pairs) {
    const [first, second] = b === USER_TEAM ? [b, a] : [a, b];
    const match = newMatch(run, { stage: 'swiss', round: run.swiss.round, label: `予選${run.swiss.round}回戦`, a: first, b: second });
    round.push(match.id);
    playMatch(run, rng, match);
  }
  if (bye) {
    const record = swissRecord(run, bye);
    record.w += 1;
    if (record.w >= TEAM_FORMATS.school.swissPass) run.swiss.status[bye] = 'pass';
  }
  run.swiss.rounds.push(round);
  // 自分の試合がなければ(自分は通過か敗退)、この回戦はすぐ決まる。
  const mine = round.map((id) => run.matches[id]).find(isUserMatch);
  if (!mine) closeSwissRound(run, rng);
  else run.current = mine.id;
}

function closeSwissRound(run, rng) {
  const round = run.swiss.rounds.at(-1) ?? [];
  for (const id of round) applySwissResult(run, run.matches[id]);
  run.current = null;
  const format = TEAM_FORMATS.school;
  const active = swissActive(run);
  if (run.swiss.round < format.swissRounds && active.length >= 2) {
    startSwissRound(run, rng);
    return;
  }
  // 予選の終わり。4回戦で決まらなかった学校は敗退。3勝の学校が16校に足りなければ、2勝の学校から勝ち局の多い順(4章の3)。
  for (const id of active) run.swiss.status[id] = 'out';
  const ranked = nationalIds(run).sort((x, y) => {
    const rx = swissRecord(run, x);
    const ry = swissRecord(run, y);
    return ry.w - rx.w || rx.l - ry.l || ry.boards - rx.boards || teamStrength(run, y) - teamStrength(run, x);
  });
  const passed = ranked.filter((id) => run.swiss.status[id] === 'pass');
  for (const id of ranked) {
    if (passed.length >= format.knockout) break;
    if (!passed.includes(id) && swissRecord(run, id).w >= format.swissPass - 1) {
      passed.push(id);
      run.swiss.status[id] = 'pass';
      run.swiss.extra = [...(run.swiss.extra ?? []), id];
    }
  }
  const seeds = ranked.filter((id) => passed.includes(id)).slice(0, format.knockout);
  startKnockout(run, rng, seeds);
}

function teamStrength(run, teamId) {
  return run.teams[teamId].members.reduce((sum, id) => sum + (run.players[id]?.rating ?? SCHOOL_BASE), 0);
}

// ---- 予選(プロ: 3チームのリーグ)

function startLeagues(run, rng) {
  const ids = Object.keys(run.teams);
  const others = ids.filter((id) => id !== USER_TEAM);
  for (let index = others.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng.next() * (index + 1));
    [others[index], others[swap]] = [others[swap], others[index]];
  }
  const all = [USER_TEAM, ...others];
  const size = TEAM_FORMATS.pro.leagueSize;
  run.leagues = [];
  for (let index = 0; index < all.length; index += size) {
    const teams = all.slice(index, index + size);
    // 1日目 A-B、2日目 A-C、3日目 B-C(自分のチームはAに置くので、先に2試合)。
    const order = [[0, 1], [0, 2], [1, 2]];
    run.leagues.push({ id: String.fromCharCode(65 + run.leagues.length), teams, days: order.map(([x, y]) => [teams[x], teams[y]]), matches: [] });
  }
  run.leagueDay = 0;
  startLeagueDay(run, rng);
}

function startLeagueDay(run, rng) {
  const day = run.leagueDay;
  let mine = null;
  for (const league of run.leagues) {
    const pair = league.days[day];
    if (!pair) continue;
    const match = newMatch(run, { stage: 'league', round: day + 1, label: `予選リーグ${league.id} 第${day + 1}試合`, a: pair[0], b: pair[1] });
    league.matches.push(match.id);
    if (isUserMatch(match)) mine = match;
    else playMatch(run, rng, match);
  }
  run.current = mine?.id ?? null;
  if (!mine) closeLeagueDay(run, rng);
}

function closeLeagueDay(run, rng) {
  run.current = null;
  run.leagueDay += 1;
  if (run.leagueDay < 3) {
    startLeagueDay(run, rng);
    return;
  }
  // 予選の終わり。各リーグの上位2チームが本戦。A1-B2、B1-A2、C1-D2、D1-C2(実物の本戦の組み方)。
  const tables = run.leagues.map((league) => leagueTable(run, league));
  const seeds = [];
  for (let index = 0; index < tables.length; index += 2) {
    const [x, y] = [tables[index], tables[index + 1] ?? tables[index]];
    seeds.push([x[0].team, y[1].team], [y[0].team, x[1].team]);
  }
  for (const table of tables) for (const row of table) run.leagueStatus[row.team] = row.rank <= TEAM_FORMATS.pro.leagueAdvance ? 'pass' : 'out';
  startKnockout(run, rng, seeds.flat(), { paired: true });
}

/** リーグの順位(勝ち試合 → 局の得失点 → 直接対決 → チームの強さ)。 */
export function leagueTable(run, league) {
  const rows = league.teams.map((team) => ({ team, w: 0, l: 0, gw: 0, gl: 0 }));
  const row = (team) => rows.find((entry) => entry.team === team);
  for (const id of league.matches) {
    const match = run.matches[id];
    if (!match?.winner) continue;
    for (const side of ['a', 'b']) {
      const entry = row(match[side]);
      entry.gw += match.score[side];
      entry.gl += match.score[other(side)];
      if (match.winner === side) entry.w += 1;
      else entry.l += 1;
    }
  }
  const beat = (x, y) => league.matches.some((id) => {
    const match = run.matches[id];
    return match?.winner && match[match.winner] === x && match[other(match.winner)] === y;
  });
  rows.sort((x, y) => y.w - x.w || (y.gw - y.gl) - (x.gw - x.gl) || (beat(x.team, y.team) ? -1 : beat(y.team, x.team) ? 1 : 0)
    || teamStrength(run, y.team) - teamStrength(run, x.team));
  return rows.map((entry, index) => ({ ...entry, rank: index + 1 }));
}

// ---- 本戦トーナメント

/**
 * トーナメントを始める。pairedは、並び順のまま2つずつ組む(プロの本戦・地区大会・県大会)。そうでなければ種の並び(1位と最下位から)。
 * stageは高校の地区大会・県大会(回戦の名前と、試合の名前の頭「地区大会 1回戦」)。
 * @param {any} run
 * @param {{ next(): number }} rng
 * @param {(string | null)[]} seeds
 * @param {{ paired?: boolean, size?: number, stage?: 'district' | 'prefecture' | null }} [options]
 */
function startKnockout(run, rng, seeds, { paired = false, size = 0, stage = null } = {}) {
  const koSize = size || (run.format === 'school' ? TEAM_FORMATS.school.knockout : TEAM_FORMATS.pro.knockout);
  const slots = paired ? seeds.slice(0, koSize) : SEED_ORDER[koSize].map((seed) => seeds[seed - 1] ?? null);
  const info = stage ? schoolStageInfo(stage) : null;
  run.ko = { size: koSize, slots, rounds: [], ...(info?.rounds ? { stage, names: [...info.rounds], prefix: info.name } : {}) };
  run.phase = 'ko';
  startKnockoutRound(run, rng, slots);
}

function startKnockoutRound(run, rng, entrants) {
  const index = run.ko.rounds.length;
  const name = (run.ko.names ?? KO_ROUND_NAMES[run.ko.size])[index] ?? `${index + 1}回戦`;
  const prefix = run.ko.prefix ?? (run.format === 'school' ? '決勝トーナメント' : '本戦');
  const round = [];
  let mine = null;
  for (let slot = 0; slot < entrants.length; slot += 2) {
    const [x, y] = [entrants[slot], entrants[slot + 1]];
    if (!x || !y) {
      round.push({ bye: x ?? y });
      continue;
    }
    const [a, b] = y === USER_TEAM ? [y, x] : [x, y];
    const match = newMatch(run, { stage: 'ko', round: index + 1, label: `${prefix} ${name}`, a, b });
    round.push({ match: match.id });
    if (isUserMatch(match)) mine = match;
    playMatch(run, rng, match);
  }
  run.ko.rounds.push(round);
  run.current = mine?.id ?? null;
  if (!mine) closeKnockoutRound(run, rng);
}

function knockoutWinners(run, round) {
  return round.map((entry) => entry.bye ?? (() => {
    const match = run.matches[entry.match];
    return match[match.winner];
  })());
}

function closeKnockoutRound(run, rng) {
  run.current = null;
  const round = run.ko.rounds.at(-1);
  const winners = knockoutWinners(run, round);
  if (winners.length <= 1) {
    if (run.ko.stage) {
      closeSchoolStage(run, rng);
      return;
    }
    run.champion = winners[0] ?? null;
    finishRun(run);
    return;
  }
  startKnockoutRound(run, rng, winners);
}

/** トーナメントで自分の学校が負けた回戦(負けていなければ-1)。 */
function koLostAt(run, ko) {
  return (ko?.rounds ?? []).findIndex((round) => round.some((entry) => {
    const match = entry.match ? run.matches[entry.match] : null;
    return match && isUserMatch(match) && match.winner && match[match.winner] !== USER_TEAM;
  }));
}

/**
 * 地区大会・県大会の終わり(15章の2・3)。結果を段階の記録に残し、勝ち抜けば次の段階、負けていれば大会の終わり。
 * 地区大会は決勝に進んだ2校(決勝で負けても2位で通過)、県大会は優勝の1校が次へ。
 */
function closeSchoolStage(run, rng) {
  const ko = run.ko;
  const info = schoolStageInfo(ko.stage);
  const finalEntry = ko.rounds.at(-1)?.[0];
  const final = finalEntry?.match ? run.matches[finalEntry.match] : null;
  const champion = final ? final[final.winner] : finalEntry?.bye ?? null;
  const runnerUp = final ? final[other(final.winner)] : null;
  const advanced = info.advance >= 2 ? [champion, runnerUp].includes(USER_TEAM) : champion === USER_TEAM;
  const lostAt = koLostAt(run, ko);
  const label = advanced
    ? (info.advance >= 2 ? (champion === USER_TEAM ? '1位で通過' : '2位で通過') : '優勝')
    : info.places[lostAt] ?? info.places[0];
  run.stageLog = [...(run.stageLog ?? []), { id: ko.stage, ko, champion, runnerUp, advanced, label }];
  // 段階の終わりの表彰式(20章)。試合の結果発表のあと、団体戦の画面で見る。
  run.ceremony = { stage: ko.stage, seen: false };
  if (!advanced) {
    finishRun(run);
    return;
  }
  if (ko.stage === 'district') startPrefecture(run, rng, champion, runnerUp);
  else startNational(run, rng);
}

/** 大会の結果(自分のチームの成績)。 */
function finishRun(run) {
  run.phase = 'done';
  run.current = null;
  run.pending = null;
  run.result = userPlace(run);
  // 大会の終わりの表彰式(20章)。地区大会・県大会で終わったときは、その段階の表彰式がもう決まっている。
  const stage = teamStageOf(run) ?? 'pro';
  if (!(run.ceremony && !run.ceremony.seen && run.ceremony.stage === stage)) run.ceremony = { stage, seen: false };
}

/** 表彰式を見た(20章)。 */
export function markTeamCeremonySeen(source) {
  if (!source?.ceremony || source.ceremony.seen) return source;
  return { ...source, ceremony: { ...source.ceremony, seen: true } };
}

/** 自分のチームの成績の言い方。 */
export function userPlace(run) {
  const stage = teamStageOf(run);
  if (stage === 'district' || stage === 'prefecture') {
    // 地区大会・県大会で負けて終わった(15章の7)。
    const info = schoolStageInfo(stage);
    const lostAt = Math.max(0, koLostAt(run, run.ko));
    const label = info.places[lostAt] ?? info.places[0];
    return { place: info.placeBase + (label === '準優勝' ? 2 : 2 ** (info.places.length - lostAt)), label: `${info.name} ${label}` };
  }
  if (run.champion === USER_TEAM) return { place: 1, label: '優勝' };
  const size = run.ko?.size ?? 0;
  const lostAt = (run.ko?.rounds ?? []).findIndex((round) => round.some((entry) => {
    const match = entry.match ? run.matches[entry.match] : null;
    return match && isUserMatch(match) && match.winner && match[match.winner] !== USER_TEAM;
  }));
  if (lostAt >= 0) {
    const label = KO_PLACES[size][lostAt] ?? 'ベスト16';
    return { place: label === '準優勝' ? 2 : 2 ** (KO_PLACES[size].length - lostAt), label };
  }
  if (run.format === 'school') {
    const record = run.swiss?.records?.[USER_TEAM];
    return { place: 99, label: `予選敗退（${record?.w ?? 0}勝${record?.l ?? 0}敗）` };
  }
  return { place: 99, label: '予選敗退' };
}

// ---- プレイヤーの1局

/** プレイヤーの次の1局の相手を決め、Lvと戦法と先後を付ける(研修会のsetPendingと同じ形)。 */
function setPending(run, rng, match, game) {
  const side = userSide(match);
  const opponentId = side === 'a' ? game.b : game.a;
  const opponent = run.players[opponentId];
  const world = Number.isFinite(run.settings?.world) ? run.settings.world : recommendedWorldLevel(run.userLevel ?? 20);
  const base = run.format === 'school' ? SCHOOL_BASE : WORLD_BASE_RATING;
  opponent.level = isRealWorld(world) && opponent.story === YOSHIHIKO ? MAX_CPU_LEVEL : worldCpuLevel(opponent.rating, world, base);
  const color = rng.next() < 0.5 ? 'black' : 'white';
  const style = opponent.repertoire
    ? pickGameStyle(rng, opponent.repertoire, { color: color === 'black' ? 'white' : 'black' })
    : opponent.style ?? null;
  const format = teamFormat(run.format);
  const us = run.teams[USER_TEAM].name;
  const them = run.teams[match[other(side)]].name;
  const seatText = run.format === 'school' ? `${SCHOOL_SEATS[game.seat]}戦` : `第${game.no}局`;
  // 大一番は県大会の決勝と全国大会(プロは本戦)の決勝。地区大会の決勝は、負けても県大会に出られるので大一番にしない。
  const final = isFinal(match) && teamStageOf(run) !== 'district';
  run.pending = {
    kind: 'team',
    opponentId,
    color,
    style,
    label: `${match.label} ${seatText}`,
    eventText: format.name,
    matchId: match.id,
    stakes: { text: `${us} 対 ${them}`, goal: '', win: '', boss: final },
    others: { games: [] },
    teamBoards: run.format === 'school' ? schoolBoardsFor(run, match) : [],
  };
}

/** 対局画面の速報に使う、仲間の局(自分の局は除く)。 */
function schoolBoardsFor(run, match) {
  const side = userSide(match);
  return match.games.filter((game) => !game.user).map((game) => ({
    seat: game.seat,
    seatName: SCHOOL_SEATS[game.seat],
    us: side === 'a' ? game.a : game.b,
    them: side === 'a' ? game.b : game.a,
    won: game.winner === side,
    reveal: game.reveal ?? 60,
  }));
}

/** いまの自分のチームの試合(なければnull)。 */
export function currentTeamMatch(run) {
  return run?.current ? run.matches[run.current] ?? null : null;
}

/** プロの試合で、まだ指せる自分のチームの棋士。 */
export function userTeamAvailable(run) {
  const match = currentTeamMatch(run);
  if (!match || run.format !== 'pro') return [];
  return availableMembers(run, match, userSide(match));
}

/**
 * プロの試合の次の局に、自分のチームから出す棋士を決める(1人最大3局)。相手チームの棋士はそのあと発表する(直前の発表)。
 * プレイヤーなら対局を待つ(run.pending)。仲間なら結果だけ決める。
 * @returns {{ run: any, game: any } | null}
 */
export function chooseTeamPlayer(source, memberId) {
  const run = structuredClone(source);
  const match = currentTeamMatch(run);
  if (!match || run.format !== 'pro' || match.winner || run.pending) return null;
  const side = userSide(match);
  if (!availableMembers(run, match, side).includes(memberId)) return null;
  const rng = createRng(run.rng);
  const opp = pick(rng, availableMembers(run, match, other(side)));
  const game = side === 'a' ? nextProGame(run, match, memberId, opp) : nextProGame(run, match, opp, memberId);
  if (memberId === TEAM_USER_ID) {
    game.user = true;
    setPending(run, rng, match, game);
  } else {
    const big = isFinal(match);
    setGameWinner(run, match, game, decideGame(run, rng, game.a, game.b, big) ? 'a' : 'b');
    if (match.winner) {
      const before = { phase: run.phase, stage: teamStageOf(run) };
      const finished = { ...match, games: match.games.map((entry) => ({ ...entry })) };
      closeUserMatch(run, rng);
      run.finale = finaleRecord(run, finished, { before });
    }
  }
  run.rng = rng.state;
  return { run, game };
}

/**
 * 羽音に任せたときの、次に出す棋士(4章の6)。勝負どころ(どちらかが4勝)はプレイヤー、ほかはまだ指していない人から
 * (同じならプレイヤー・羽音・ドラフトの棋士の順)。
 */
export function hananeNextPlayer(run) {
  const match = currentTeamMatch(run);
  if (!match || run.format !== 'pro') return null;
  const side = userSide(match);
  const available = availableMembers(run, match, side);
  if (!available.length) return null;
  const need = TEAM_FORMATS.pro.winsToTake;
  const clutch = match.score.a === need - 1 || match.score.b === need - 1;
  if (clutch && available.includes(TEAM_USER_ID)) return TEAM_USER_ID;
  const members = run.teams[USER_TEAM].members;
  return [...available].sort((x, y) => (match.used[side][x] ?? 0) - (match.used[side][y] ?? 0)
    || members.indexOf(x) - members.indexOf(y))[0];
}

/** 自分の試合が決まったあと、大会を先へ進める。 */
function closeUserMatch(run, rng) {
  run.pending = null;
  if (run.phase === 'swiss') closeSwissRound(run, rng);
  else if (run.phase === 'league') closeLeagueDay(run, rng);
  else if (run.phase === 'ko') closeKnockoutRound(run, rng);
}

/**
 * 高校の試合の3局が、どの順に終わり、どの局でチームの勝ち負けが決まったか(19章の4)。
 * 仲間の局は知らせる手数(reveal)、自分の局は終局の手数(userPly)で並べる。知らせる手数が自分の終局より前の局は、
 * 自分より先に終わった。プロは指した順。
 * @param {{ user?: boolean, won: boolean, reveal?: number | null }[]} rows 席(局)の順
 * @param {{ userPly?: number, need?: number, format?: 'school' | 'pro' }} [options] userPlyがなければ、仲間はみな先に終わった
 * @returns {{ order: number[], decidedBy: number | null, teamWon: boolean | null }}
 */
export function decisionOrder(rows, { userPly = Infinity, need = 2, format = 'school' } = {}) {
  const at = (row, index) => {
    if (format === 'pro') return index;
    if (row.user) return userPly - 0.5;
    return Number.isFinite(row.reveal) ? row.reveal : -1;
  };
  const order = rows.map((row, index) => index).sort((x, y) => at(rows[x], x) - at(rows[y], y) || x - y);
  let wins = 0;
  let losses = 0;
  for (const index of order) {
    if (rows[index].won) wins += 1;
    else losses += 1;
    if (wins >= need) return { order, decidedBy: index, teamWon: true };
    if (losses >= need) return { order, decidedBy: index, teamWon: false };
  }
  return { order, decidedBy: null, teamWon: null };
}

/** 試合のあとに大会がどうなったか(結果発表の最後の一言。19章の7)。 */
function afterText(run, before) {
  if (run.phase === 'done') return run.result?.label ?? '';
  const stage = teamStageOf(run);
  if (stage && before.stage && stage !== before.stage) {
    const log = (run.stageLog ?? []).at(-1);
    return `${schoolStageInfo(before.stage).name}を${log?.label ?? '通過'}。${schoolStageInfo(stage).name}へ進む`;
  }
  if (before.phase === 'swiss' && run.phase === 'ko') return '予選を通過。決勝トーナメントへ進む';
  if (before.phase === 'league' && run.phase === 'ko') return '予選リーグを通過。本戦へ進む';
  const next = currentTeamMatch(run);
  return next ? `次は${next.label}` : '';
}

/**
 * まだ見ていない結果発表(run.finale。19章の8)。試合が決まったあと(大会を進めたあと)に作る。
 * @param {any} run 試合を記録して、大会を進めたあとの大会
 * @param {any} match 決まった試合(写し)
 * @param {{ before: { phase: string, stage: string | null }, userPly?: number | null }} options
 */
function finaleRecord(run, match, { before, userPly = null }) {
  const side = userSide(match);
  const need = teamFormat(run.format).winsToTake;
  const rows = match.games.map((game) => ({
    seat: game.seat ?? null,
    no: game.no ?? null,
    us: side === 'a' ? game.a : game.b,
    them: side === 'a' ? game.b : game.a,
    won: game.winner === side,
    user: Boolean(game.user),
    reveal: Number.isFinite(game.reveal) ? game.reveal : null,
  }));
  const { decidedBy, teamWon } = decisionOrder(rows, { userPly: Number.isFinite(userPly) ? userPly : Infinity, need, format: run.format });
  return {
    id: match.id,
    format: run.format,
    label: match.label,
    us: match[side],
    them: match[other(side)],
    rows,
    userPly: run.format === 'school' && Number.isFinite(userPly) ? userPly : null,
    score: { us: match.score[side], them: match.score[other(side)] },
    teamWon: teamWon ?? match.winner === side,
    decidedBy,
    after: afterText(run, before),
    seen: false,
  };
}

/** 結果発表を見た(団体戦の画面の「団体戦へ」)。 */
export function markTeamFinaleSeen(source) {
  if (!source?.finale || source.finale.seen) return source;
  return { ...source, finale: { ...source.finale, seen: true } };
}

/**
 * プレイヤーの1局を記録する。引き分け(千日手)は先後を入れ替えて指し直す。
 * 高校は、自分の局の手数(ply)で、仲間の局が自分より先に終わったかを決める(決勝点と結果発表の順番。19章の4)。
 * @param {any} source
 * @param {'win' | 'loss' | 'draw'} outcome
 * @param {{ ply?: number }} [options]
 * @returns {{ run: any, replay?: boolean, match: any, decided: boolean, teamWon: boolean | null, clinched: boolean }}
 */
export function recordTeamGame(source, outcome, { ply } = {}) {
  const run = structuredClone(source);
  const match = currentTeamMatch(run);
  if (!match || !run.pending) return { run, match, decided: false, teamWon: null, clinched: false };
  if (outcome === 'draw') {
    run.pending.color = run.pending.color === 'black' ? 'white' : 'black';
    run.pending.replay = true;
    return { run, replay: true, match, decided: false, teamWon: null, clinched: false };
  }
  const side = userSide(match);
  const game = match.games.find((entry) => entry.user && !entry.winner);
  const before = match.winner;
  setGameWinner(run, match, game, outcome === 'win' ? side : other(side));
  const decided = Boolean(match.winner);
  const finished = { ...match, games: match.games.map((entry) => ({ ...entry })) };
  // 自分の局で試合が決まったか(決勝点)。高校は、自分の終局までに知らせた仲間の局と合わせて、2勝目になったとき(19章の4)。
  const userIndex = match.games.indexOf(game);
  const order = decided ? decisionOrder(finished.games.map((entry) => ({ user: Boolean(entry.user), won: entry.winner === side, reveal: entry.reveal })), {
    userPly: Number.isFinite(ply) ? ply : Infinity, need: teamFormat(run.format).winsToTake, format: run.format,
  }) : null;
  const clinched = decided && (run.format === 'pro' ? !before && match.winner === side && outcome === 'win'
    : order?.decidedBy === userIndex && order?.teamWon === true);
  const rng = createRng(run.rng);
  const stageBefore = { phase: run.phase, stage: teamStageOf(run) };
  run.pending = null;
  if (decided) {
    closeUserMatch(run, rng);
    run.finale = finaleRecord(run, finished, { before: stageBefore, userPly: Number.isFinite(ply) ? ply : null });
  }
  // 高校は、次の自分の試合が始まっていれば、自分の局の相手をすぐ付ける。
  preparePending(run, rng);
  run.rng = rng.state;
  return { run, match: finished, decided, teamWon: decided ? finished.winner === side : null, clinched };
}

// ---- 大会を作る

/**
 * 団体戦の大会を作る。
 * @param {{ format: 'school' | 'pro', seed: number, settings?: any, roster?: any, userName?: string, userLevel?: number,
 *   userSeat?: number, draftPick?: string | null, draftReason?: string, startStage?: 'district' | 'national' }} options
 */
export function createTeamRun({ format, seed, settings = {}, roster = null, userName = '', userLevel = 20, userSeat = RECOMMENDED_SCHOOL_SEAT, draftPick = null, draftReason = '', startStage = 'district' }) {
  const formatId = TEAM_FORMATS[format] ? format : 'school';
  const rng = createRng(seed);
  const run = {
    version: 1,
    id: `team-${formatId}-${seed}`,
    format: formatId,
    seed,
    userName,
    userLevel,
    settings: { byoyomi: TEAM_FORMATS[formatId].byoyomi, ...settings },
    players: {},
    teams: {},
    matches: {},
    nextId: 1,
    nextMatch: 1,
    phase: formatId === 'school' ? 'ko' : 'league',
    current: null,
    pending: null,
    result: null,
    champion: null,
    order: null,
    draftReason: formatId === 'pro' ? draftReason : '',
    seen: [],
  };
  run.players[TEAM_USER_ID] = userMember(userName, formatId);
  run.players[TEAM_HANANE_ID] = hananeMember(roster, formatId);
  if (formatId === 'school') {
    run.players[TEAM_MOMOKA_ID] = momokaMember();
    run.order = schoolOrder(userSeat);
    run.teams[USER_TEAM] = { id: USER_TEAM, name: SCHOOL_NAME, area: '', members: run.order, you: true };
    run.stageLog = [];
    // 地区大会から(15章の1)。startStageは、全国大会から始める大会(テストと、前の版と同じ形の確かめ)。
    if (startStage === 'national') startNational(run, rng);
    else startDistrict(run, rng);
  } else {
    buildProTeams(run, rng, roster, draftPick);
    run.leagueStatus = {};
    startLeagues(run, rng);
  }
  // 自分の試合の自分の局(高校)は、すぐ相手が決まる。プロは「次は誰が指す？」を待つ。
  preparePending(run, rng);
  run.rng = rng.state;
  return run;
}

/** 高校の自分の試合が始まったら、自分の局の相手を付ける(プロは棋士を選んでから)。 */
function preparePending(run, rng) {
  const match = currentTeamMatch(run);
  if (!match || run.pending || run.format !== 'school') return;
  const game = match.games.find((entry) => entry.user && !entry.winner);
  if (game) setPending(run, rng, match, game);
}

/**
 * 記録のあとに呼ぶ。次の自分の試合が始まっていれば、自分の局の相手を付ける。
 * @returns {any} 新しいrun
 */
export function prepareNextTeamGame(source) {
  const run = structuredClone(source);
  const rng = createRng(run.rng);
  preparePending(run, rng);
  run.rng = rng.state;
  return run;
}

// ---- 画面の形

const memberCard = (run, id) => {
  const member = run.players[id];
  return member ? { id, name: member.name, dan: member.dan, story: member.story ?? null, you: id === TEAM_USER_ID, rating: member.rating } : null;
};

/** チームの札(3人と席)。 */
export function teamCard(run, teamId) {
  const team = run.teams[teamId];
  if (!team) return null;
  return {
    id: team.id,
    name: team.name,
    area: team.area ?? '',
    you: Boolean(team.you),
    members: team.members.map((id, index) => ({ ...memberCard(run, id), seat: run.format === 'school' ? SCHOOL_SEATS[index] : index === 0 ? 'リーダー' : '' })),
  };
}

/** 試合の札(席ごと・局ごとの顔合わせと結果)。 */
export function matchView(run, match, { revealAll = true } = {}) {
  if (!match) return null;
  const side = isUserMatch(match) ? userSide(match) : 'a';
  const us = match[side];
  const them = match[other(side)];
  // 自分の局の前は、仲間の局の結果を伏せる(対局の途中の速報で知らせる。4章の9)。星の数も見えている局だけ。
  const shown = (game) => Boolean(game.winner) && (revealAll || game.user);
  const score = revealAll ? { us: match.score[side], them: match.score[other(side)] } : {
    us: match.games.filter((game) => shown(game) && game.winner === side).length,
    them: match.games.filter((game) => shown(game) && game.winner !== side).length,
  };
  return {
    id: match.id,
    label: match.label,
    stage: match.stage,
    us: teamCard(run, us),
    them: teamCard(run, them),
    score,
    winner: match.winner ? (match[match.winner] === us ? 'us' : 'them') : null,
    need: teamFormat(run.format).winsToTake,
    games: match.games.map((game) => ({
      seat: game.seat !== undefined ? SCHOOL_SEATS[game.seat] : `第${game.no}局`,
      us: memberCard(run, side === 'a' ? game.a : game.b),
      them: memberCard(run, side === 'a' ? game.b : game.a),
      user: Boolean(game.user),
      result: game.winner && (revealAll || game.user) ? (game.winner === side ? 'win' : 'loss') : null,
    })),
  };
}

/** 予選の成績表(高校)。自分の学校と、上の学校。 */
export function swissTable(run) {
  if (!run.swiss) return [];
  return nationalIds(run)
    .map((id) => ({ team: teamCard(run, id), ...swissRecord(run, id), status: run.swiss.status[id] }))
    .sort((x, y) => y.w - x.w || x.l - y.l || y.boards - x.boards);
}

/** 1つのトーナメントの回戦ごとの札(地区大会・県大会・全国の決勝トーナメント・プロの本戦)。 */
function knockoutViewOf(run, ko, champion = null) {
  if (!ko) return null;
  const names = ko.names ?? KO_ROUND_NAMES[ko.size] ?? [];
  return {
    size: ko.size,
    stage: ko.stage ?? null,
    rounds: ko.rounds.map((round, index) => ({
      name: names[index] ?? `${index + 1}回戦`,
      matches: round.map((entry) => entry.bye ? { bye: teamCard(run, entry.bye) } : matchView(run, run.matches[entry.match])),
    })),
    champion: champion ? teamCard(run, champion) : null,
  };
}

/** トーナメント表の回戦ごとの札(全国の決勝トーナメントとプロの本戦。地区大会・県大会のあいだはnull)。 */
export function knockoutView(run) {
  if (!run.ko || run.ko.stage) return null;
  return knockoutViewOf(run, run.ko, run.champion);
}

/**
 * 高校の3つの段階の道(15章の9)。stateは済んだ(done)・負けて終わった(out)・いまの段階(current)・まだ(next)。
 * labelは結果(「1位で通過」「ベスト4」)。プロはnull。
 */
export function teamStagesView(run) {
  if (run?.format !== 'school') return null;
  const stage = teamStageOf(run);
  const reached = SCHOOL_STAGE_IDS.indexOf(stage);
  // 前の版の大会(全国大会から始めた)は、地区大会・県大会を通っていない。
  const legacy = !run.stage;
  return SCHOOL_STAGES.map((info, index) => {
    const log = (run.stageLog ?? []).find((entry) => entry.id === info.id);
    if (log) return { id: info.id, name: info.name, short: info.short, state: log.advanced ? 'done' : 'out', label: log.label };
    if (index < reached || legacy && index < 2) return { id: info.id, name: info.name, short: info.short, state: 'skipped', label: '' };
    if (info.id !== stage) return { id: info.id, name: info.name, short: info.short, state: 'next', label: '' };
    if (run.phase === 'done') {
      const won = run.champion === USER_TEAM;
      return { id: info.id, name: info.name, short: info.short, state: won ? 'done' : 'out', label: won ? '優勝' : (run.result?.label ?? '') };
    }
    return { id: info.id, name: info.name, short: info.short, state: 'current', label: '' };
  });
}

/**
 * 表のタブ(進んだ段階だけ。15章の9)。typeは、トーナメント(ko)・スイス方式の表(swiss)・リーグ(leagues)。
 * currentは、はじめに開くタブ(いまの段階)。
 */
export function teamTablesView(run) {
  if (!run) return { tabs: [], current: '' };
  if (run.format === 'pro') {
    const knockout = knockoutView(run);
    return {
      tabs: [
        { id: 'qualify', label: '予選', type: 'leagues', knockout: null, disabled: false },
        { id: 'ko', label: '本戦', type: 'ko', knockout, disabled: !knockout },
      ],
      current: knockout ? 'ko' : 'qualify',
    };
  }
  const tabs = [];
  for (const id of ['district', 'prefecture']) {
    const log = (run.stageLog ?? []).find((entry) => entry.id === id);
    const ko = log?.ko ?? (run.ko?.stage === id ? run.ko : null);
    if (ko) tabs.push({ id, label: schoolStageInfo(id).name, type: 'ko', knockout: knockoutViewOf(run, ko, log?.champion ?? null), disabled: false });
  }
  if (run.swiss) {
    const knockout = knockoutView(run);
    tabs.push({ id: 'qualify', label: run.stage ? '全国予選' : '予選', type: 'swiss', knockout: null, disabled: false });
    tabs.push({ id: 'ko', label: run.stage ? '全国決勝T' : '決勝トーナメント', type: 'ko', knockout, disabled: !knockout });
  }
  const stage = teamStageOf(run);
  const current = stage === 'district' || stage === 'prefecture' ? stage : (knockoutView(run) ? 'ko' : 'qualify');
  return { tabs, current };
}

/** 大会全体の画面の形。 */
export function teamRunView(run) {
  if (!run) return null;
  const format = teamFormat(run.format);
  const match = currentTeamMatch(run);
  return {
    id: run.id,
    format: format.id,
    name: format.name,
    short: format.short,
    phase: run.phase,
    team: teamCard(run, USER_TEAM),
    next: match ? matchView(run, match, { revealAll: run.format === 'pro' }) : null,
    pending: run.pending,
    available: userTeamAvailable(run),
    swiss: run.format === 'school' ? { round: run.swiss?.round ?? 0, table: swissTable(run), record: run.swiss?.records?.[USER_TEAM] ?? { w: 0, l: 0, boards: 0 } } : null,
    leagues: run.format === 'pro' ? (run.leagues ?? []).map((league) => ({
      id: league.id,
      you: league.teams.includes(USER_TEAM),
      table: leagueTable(run, league).map((row) => ({ ...row, team: teamCard(run, row.team) })),
    })) : null,
    knockout: knockoutView(run),
    stage: teamStageOf(run),
    stageName: run.format === 'school' ? schoolStageInfo(teamStageOf(run)).name : '',
    stages: teamStagesView(run),
    tables: teamTablesView(run),
    result: run.result,
    champion: run.champion ? teamCard(run, run.champion) : null,
    draftReason: run.draftReason ?? '',
    seen: [...(run.seen ?? [])],
    members: Object.fromEntries((run.teams[USER_TEAM]?.members ?? []).map((id) => [id, teamMemberStatus(run, id)])),
  };
}

/**
 * どの選手のステータスも出す(仲間は16章、相手の学校の選手は20章)。相手は学校の名前・地区と、あなたとの対戦成績、羽音の一言を足す。
 * 今の自分の試合で、まだ知らせていない局は数えない。
 * @param {any} run
 * @param {string} playerId
 */
export function teamPlayerStatus(run, playerId) {
  const team = Object.values(run?.teams ?? {}).find((entry) => entry.members.includes(playerId));
  if (!team) return null;
  if (team.id === USER_TEAM) return teamMemberStatus(run, playerId);
  const member = run.players?.[playerId];
  if (!member) return null;
  const index = team.members.indexOf(playerId);
  let wins = 0;
  let losses = 0;
  let vsWins = 0;
  let vsLosses = 0;
  for (const match of Object.values(run.matches)) {
    if (match.a !== team.id && match.b !== team.id) continue;
    if (run.format === 'school' && match.id === run.current && isUserMatch(match)) continue;
    const side = match.a === team.id ? 'a' : 'b';
    for (const game of match.games) {
      if ((side === 'a' ? game.a : game.b) !== playerId || !game.winner) continue;
      if (game.winner === side) wins += 1;
      else losses += 1;
      if ((side === 'a' ? game.b : game.a) === TEAM_USER_ID) {
        if (game.winner === side) vsWins += 1;
        else vsLosses += 1;
      }
    }
  }
  const next = run.pending?.opponentId === playerId;
  return {
    id: playerId,
    name: member.name,
    you: false,
    rival: true,
    story: member.story ?? null,
    school: team.name,
    area: team.area ?? '',
    seat: run.format === 'school' ? SCHOOL_SEATS[index] ?? '' : index === 0 ? 'リーダー' : '',
    dan: member.dan ?? '',
    record: { wins, losses },
    recordText: wins + losses ? `この大会 ${wins}勝${losses}敗` : 'この大会は、まだ指していない',
    // vsWinsはこの選手があなたに勝った数。あなたから見た成績で書く。
    vsText: vsWins + vsLosses ? `あなたとの対局 あなたの${vsLosses}勝${vsWins}敗` : '',
    strength: strengthText(run.format, member.rating),
    repertoire: member.repertoire ? repertoireText(member.repertoire) : '',
    line: rivalLine(member, { next }),
    profile: {
      rating: member.rating, kind: member.kind, age: member.age, story: member.story ?? null,
      character: member.character ?? null, repertoire: member.repertoire ?? null, style: member.style ?? null,
    },
  };
}

/** 相手の選手への羽音の一言(いちばん強い能力と弱い能力から。敬語と「！」なし。20章)。 */
function rivalLine(member, { next = false } = {}) {
  if (!member.character?.abilities) return '';
  const values = abilityValues(member);
  const sorted = [...ABILITIES].sort((a, b) => values[b.key] - values[a.key]);
  const best = sorted[0];
  const worst = sorted.at(-1);
  const head = next ? '君の次の相手。' : '';
  if (member.story === YOSHIHIKO) return `羽音「${head}……父さんだね。${best.label}も${worst.label}も、全部が強い。正面からいくしかないでしょ」`;
  return `羽音「${head}${member.name}さんは${best.label}が強い。${worst.label}が弱いから、そこを突けばいい」`;
}

/**
 * 仲間のステータス(docs/team-battle-design.mdの16章)。この大会の成績・強さの目安(段級位)・棋風と得意戦法・一言と、
 * 能力の形を作るための写し(profile。名鑑と同じmemberAbilityViewに渡す)。自分は強さを持たないので、プレイヤーのLv。
 * 自分の局の前の高校の試合は、仲間の結果をまだ数えない(対局の途中の速報で知らせる。4章の9)。
 * @param {any} run
 * @param {string} memberId
 */
export function teamMemberStatus(run, memberId) {
  const member = run?.players?.[memberId];
  const team = run?.teams?.[USER_TEAM];
  if (!member || !team?.members.includes(memberId)) return null;
  const index = team.members.indexOf(memberId);
  let wins = 0;
  let losses = 0;
  for (const match of Object.values(run.matches)) {
    if (!isUserMatch(match)) continue;
    if (run.format === 'school' && match.id === run.current && !match.winner) continue;
    const side = userSide(match);
    for (const game of match.games) {
      if ((side === 'a' ? game.a : game.b) !== memberId || !game.winner) continue;
      if (game.winner === side) wins += 1;
      else losses += 1;
    }
  }
  const you = memberId === TEAM_USER_ID;
  return {
    id: memberId,
    name: member.name,
    you,
    story: member.story ?? null,
    seat: run.format === 'school' ? SCHOOL_SEATS[index] ?? '' : index === 0 ? 'リーダー' : '',
    dan: member.dan ?? '',
    record: { wins, losses },
    recordText: wins + losses ? `この大会 ${wins}勝${losses}敗` : 'この大会は、まだ指していない',
    strength: you ? (Number.isFinite(run.userLevel) ? `${levelGradeName(run.userLevel)}くらい` : '') : strengthText(run.format, member.rating),
    repertoire: member.repertoire ? repertoireText(member.repertoire) : '',
    line: you ? '' : memberLine(run, member),
    profile: you ? null : {
      rating: member.rating, kind: member.kind, age: member.age, story: member.story ?? null,
      character: member.character ?? null, repertoire: member.repertoire ?? null, style: member.style ?? null,
    },
  };
}

/**
 * 出場の前のチームの3人のステータス(出場の画面で顔を押したとき。docs/team-battle-design.mdの17章の3)。
 * 大会を作る前なので成績はない。羽音と百花は大会でも同じ人物(羽音は名簿の写し、百花は決まった種)。
 * @param {{ format: 'school' | 'pro', roster?: any, userSeat?: number, draftPick?: string | null, userName?: string, userLevel?: number, world?: number | null }} options
 */
export function teamEntryMembers({ format, roster = null, userSeat = RECOMMENDED_SCHOOL_SEAT, draftPick = null, userName = '', userLevel = 20, world = null }) {
  const formatId = format === 'pro' ? 'pro' : 'school';
  const run = {
    format: formatId, players: {}, teams: {}, matches: {}, current: null, userLevel,
    settings: Number.isFinite(world) ? { world } : {},
  };
  run.players[TEAM_USER_ID] = userMember(userName, formatId);
  run.players[TEAM_HANANE_ID] = hananeMember(roster, formatId);
  /** @type {string[]} */
  let members;
  if (formatId === 'school') {
    run.players[TEAM_MOMOKA_ID] = momokaMember();
    members = schoolOrder(userSeat);
  } else {
    members = [TEAM_USER_ID, TEAM_HANANE_ID];
    const picked = rosterPros(roster).find((member) => member.id === draftPick);
    if (picked) {
      const copy = copyRosterMember(picked);
      run.players[copy.id] = copy;
      members.push(copy.id);
    }
  }
  run.teams[USER_TEAM] = { id: USER_TEAM, members, you: true };
  return members.map((id) => teamMemberStatus(run, id)).filter(Boolean);
}

/**
 * 仲間の強さの言い方(16章の2)。段級位にすると、世界の難易度で羽音が「22級」のように見えてしまうので、
 * 高校は高校生の中での位置、プロは竜王戦の組で言う(ドラフトの候補と同じ言い方)。
 * @param {string} format
 * @param {number} rating
 */
function strengthText(format, rating) {
  if (!Number.isFinite(rating)) return '';
  if (format === 'school') {
    const diff = rating - SCHOOL_BASE;
    if (diff >= 300) return '高校生で飛び抜けて強い';
    if (diff >= 100) return '全国の上位校の主将くらい';
    if (diff >= -20) return '全国大会の学校くらい';
    if (diff >= -90) return '県大会の学校くらい';
    return '地区大会の学校くらい';
  }
  const groups = Object.entries(GROUP_MEAN_RATING).sort((a, b) => b[1] - a[1]);
  return `竜王戦${groups.find(([, mean]) => rating >= mean - 40)?.[0] ?? groups.at(-1)?.[0] ?? 6}組くらい`;
}

/**
 * 自分への羽音の一言(自分の能力のいちばん得意・苦手から。my-abilities.mjsのmyAbilityProfileのbest・worst)。
 * @param {{ best?: { label: string } | null, worst?: { label: string } | null } | null} profile
 */
export function teamUserLine(profile) {
  if (profile?.best && profile?.worst) return `羽音「君は${profile.best.label}が得意。${profile.worst.label}は、私たちで補うから」`;
  if (profile?.best) return `羽音「君は${profile.best.label}が得意。そこで勝負すればいい」`;
  return '羽音「君の将棋は、これから見せてもらう」';
}

/** 仲間への一言(いちばん高い能力と低い能力から。羽音は敬語と「！」を使わない。羽音自身のことは百花が言う)。 */
function memberLine(run, member) {
  if (!member.character?.abilities) return '';
  const values = abilityValues(member);
  const sorted = [...ABILITIES].sort((a, b) => values[b.key] - values[a.key]);
  const best = sorted[0];
  const worst = sorted.at(-1);
  if (member.story === HANANE) {
    return run.format === 'school'
      ? `百花「羽音ちゃんは${best.label}がすごいんだよ！ ……${worst.label}は、ちょっとだけ苦手みたい」`
      : `羽音「私？ ${best.label}には自信がある。${worst.label}は……まあ、君がいるから」`;
  }
  if (member.id === TEAM_MOMOKA_ID) return `羽音「百花は${best.label}がいい。${worst.label}は、これから覚えればいい」`;
  return `羽音「${member.name}さんは${best.label}が強い。${worst.label}は、ほかの2人で補えばいい」`;
}

/** 見た節目の場面を覚える(同じ大会で2回は出さない。docs/team-battle-design.mdの3章)。 */
export function markTeamScene(run, id) {
  if (!run || !id || (run.seen ?? []).includes(id)) return run;
  return { ...run, seen: [...(run.seen ?? []), id] };
}

/** 自分のチームのこれまでの試合(新しい順でなく、指した順)。 */
export function userMatches(run) {
  return Object.values(run?.matches ?? {}).filter(isUserMatch).map((match) => matchView(run, match));
}

// ---- 保存

/** 経歴(大会の記録)。 */
export function emptyTeamCareer() {
  return { version: 1, current: null, invited: { school: false, pro: false }, history: [], best: {} };
}

/** 大会の結果を経歴に足す(終わった大会を外す)。 */
export function finishTeamRun(career, run, at = Date.now()) {
  const next = { ...emptyTeamCareer(), ...career, current: null };
  if (!run?.result) return next;
  const record = { format: run.format, place: run.result.place, label: run.result.label, at, team: run.teams[USER_TEAM]?.name ?? '' };
  next.history = [...(next.history ?? []), record].slice(-30);
  const best = next.best?.[run.format];
  next.best = { ...(next.best ?? {}), [run.format]: !best || record.place < best.place ? { place: record.place, label: record.label } : best };
  return next;
}

/** 大会を途中でやめる(棄権。docs/tournament-withdraw-design.md)。経歴に「棄権」と残し、いまの大会を外す。 */
export function withdrawTeamRun(career, at = Date.now()) {
  const run = career?.current;
  if (!run) return career;
  const next = { ...emptyTeamCareer(), ...career, current: null };
  next.history = [...(next.history ?? []), { format: run.format, place: 99, label: '棄権', at, team: run.teams?.[USER_TEAM]?.name ?? '' }].slice(-30);
  return next;
}

/**
 * @param {Storage | null | undefined} storage
 */
export function loadTeamBattle(storage) {
  try {
    const raw = storage?.getItem(TEAM_BATTLE_KEY);
    if (!raw) return emptyTeamCareer();
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1) return emptyTeamCareer();
    return { ...emptyTeamCareer(), ...parsed };
  } catch {
    return emptyTeamCareer();
  }
}

/**
 * @param {Storage | null | undefined} storage
 * @param {any} career
 */
export function saveTeamBattle(storage, career) {
  try {
    storage?.setItem(TEAM_BATTLE_KEY, JSON.stringify(career));
  } catch {
    // 保存できなくても遊べる。
  }
}
