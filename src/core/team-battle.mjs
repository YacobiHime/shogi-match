// 団体戦(docs/team-battle-design.md)。羽音と組んで出る、高校の団体戦(全国高校将棋団体戦)とプロの早指し団体戦。
// 画面・保存の仕組み・暦に依存しない。研修会(kenshukai.mjs)と同じく、1つの大会(run)を作って、プレイヤーの1局ずつ進める。
// 仲間とほかのチームの対局は、レーティングの勝率(ryuo-simulation.mjsのsimulateMemberGame)で決める。

import { createRng, gauss, pick } from './ryuo-random.mjs';
import { newName } from './ryuo-names.mjs';
import { createRepertoire, pickGameStyle, styleEntry } from './ryuo-repertoire.mjs';
import { createCharacter } from './player-character.mjs';
import { simulateMemberGame } from './ryuo-simulation.mjs';
import { HANANE, YOSHIHIKO, STORY_PEOPLE, storyCharacter, storyMemberId } from './ryuo-story.mjs';
import { ABILITIES, abilityValues } from './player-abilities.mjs';
import { MAX_CPU_LEVEL, isRealWorld, recommendedWorldLevel, worldCpuLevel, WORLD_BASE_RATING } from './ryuo-strength.mjs';

export const TEAM_BATTLE_KEY = 'yacobihime:shogi-match:team-battle:v1';

/** 自分のチームの3人のid(大会の中だけのid)。 */
export const TEAM_USER_ID = 'user';
export const TEAM_HANANE_ID = 'hanane';
export const TEAM_MOMOKA_ID = 'momoka';
/** 自分のチーム。 */
export const USER_TEAM = 'T0';

/** 高校の団体戦の、自分たちの学校(ノベルの設定。羽音と百花が通う)。 */
export const SCHOOL_NAME = '燈ヶ丘高校';
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
    note: '羽音・百花と3人で。3局のうち2勝で勝ち',
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

/** 百花(高校の団体戦の3人目)。将棋はまだ初心者に近いが、楽しそうに攻める。 */
function momokaMember(rng) {
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

function buildSchoolTeams(run, rng, order) {
  const usedNames = new Set();
  const schoolNames = new Set();
  const prefectures = [...PREFECTURES];
  run.teams[USER_TEAM] = { id: USER_TEAM, name: SCHOOL_NAME, area: '', members: order, you: true };
  for (let index = 1; index < TEAM_FORMATS.school.teams; index += 1) {
    const id = `T${index}`;
    const area = prefectures.splice(Math.floor(rng.next() * prefectures.length), 1)[0] ?? '';
    // 学校の強さは真ん中のまわりに散らし、選手は学校の強さのまわり。席は実力順(1章)。
    const mean = SCHOOL_BASE + gauss(rng) * 70;
    const members = [0, 1, 2]
      .map(() => createStudent(run, rng, usedNames, mean + gauss(rng) * 45))
      .sort((a, b) => b.rating - a.rating)
      .map((member) => member.id);
    run.teams[id] = { id, name: schoolName(rng, schoolNames), area, members };
  }
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
    // 仲間の局は、30〜110手目のどこかで速報にする(種で決める)。
    if (isUserMatch(match)) game.reveal = 30 + Math.floor(rng.next() * 81);
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
  return Object.keys(run.teams).filter((id) => run.swiss.status[id] === 'active');
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
  const ranked = Object.keys(run.teams).sort((x, y) => {
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

function startKnockout(run, rng, seeds, { paired = false } = {}) {
  const size = run.format === 'school' ? TEAM_FORMATS.school.knockout : TEAM_FORMATS.pro.knockout;
  // pairedは、並び順のまま2つずつ組む(プロの本戦)。そうでなければ種の並び(1位と最下位から)。
  const slots = paired ? seeds.slice(0, size) : SEED_ORDER[size].map((seed) => seeds[seed - 1] ?? null);
  run.ko = { size, slots, rounds: [] };
  run.phase = 'ko';
  startKnockoutRound(run, rng, slots);
}

function startKnockoutRound(run, rng, entrants) {
  const index = run.ko.rounds.length;
  const name = KO_ROUND_NAMES[run.ko.size][index] ?? `${index + 1}回戦`;
  const round = [];
  let mine = null;
  for (let slot = 0; slot < entrants.length; slot += 2) {
    const [x, y] = [entrants[slot], entrants[slot + 1]];
    if (!x || !y) {
      round.push({ bye: x ?? y });
      continue;
    }
    const [a, b] = y === USER_TEAM ? [y, x] : [x, y];
    const match = newMatch(run, { stage: 'ko', round: index + 1, label: `本戦 ${name}`, a, b });
    if (run.format === 'school') match.label = `決勝トーナメント ${name}`;
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
    run.champion = winners[0] ?? null;
    finishRun(run);
    return;
  }
  startKnockoutRound(run, rng, winners);
}

/** 大会の結果(自分のチームの成績)。 */
function finishRun(run) {
  run.phase = 'done';
  run.current = null;
  run.pending = null;
  run.result = userPlace(run);
}

/** 自分のチームの成績の言い方。 */
export function userPlace(run) {
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
  const final = isFinal(match);
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
    if (match.winner) closeUserMatch(run, rng);
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
 * プレイヤーの1局を記録する。引き分け(千日手)は先後を入れ替えて指し直す。
 * @param {any} source
 * @param {'win' | 'loss' | 'draw'} outcome
 * @returns {{ run: any, replay?: boolean, match: any, decided: boolean, teamWon: boolean | null, clinched: boolean }}
 */
export function recordTeamGame(source, outcome) {
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
  // 自分の局で試合が決まったか(決勝点)。高校は、ほかの2局が1勝1敗のときに自分の局が決める。
  const otherWins = run.format === 'school'
    ? match.games.filter((entry) => !entry.user && entry.winner === side).length : null;
  setGameWinner(run, match, game, outcome === 'win' ? side : other(side));
  const decided = Boolean(match.winner);
  const clinched = decided && !before && match.winner === side && outcome === 'win'
    && (run.format === 'pro' || otherWins === 1);
  const finished = { ...match, games: match.games.map((entry) => ({ ...entry })) };
  const rng = createRng(run.rng);
  run.pending = null;
  if (decided) closeUserMatch(run, rng);
  // 高校は、次の自分の試合が始まっていれば、自分の局の相手をすぐ付ける。
  preparePending(run, rng);
  run.rng = rng.state;
  return { run, match: finished, decided, teamWon: decided ? finished.winner === side : null, clinched };
}

// ---- 大会を作る

/**
 * 団体戦の大会を作る。
 * @param {{ format: 'school' | 'pro', seed: number, settings?: any, roster?: any, userName?: string, userLevel?: number,
 *   userSeat?: number, draftPick?: string | null }} options
 */
export function createTeamRun({ format, seed, settings = {}, roster = null, userName = '', userLevel = 20, userSeat = RECOMMENDED_SCHOOL_SEAT, draftPick = null }) {
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
    phase: formatId === 'school' ? 'swiss' : 'league',
    current: null,
    pending: null,
    result: null,
    champion: null,
    order: null,
    draftReason: '',
  };
  run.players[TEAM_USER_ID] = userMember(userName, formatId);
  run.players[TEAM_HANANE_ID] = hananeMember(roster, formatId);
  if (formatId === 'school') {
    run.players[TEAM_MOMOKA_ID] = momokaMember(rng);
    run.order = schoolOrder(userSeat);
    buildSchoolTeams(run, rng, run.order);
    run.swiss = { round: 0, records: {}, status: Object.fromEntries(Object.keys(run.teams).map((id) => [id, 'active'])), rounds: [] };
    startSwissRound(run, rng);
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
  return {
    id: match.id,
    label: match.label,
    stage: match.stage,
    us: teamCard(run, us),
    them: teamCard(run, them),
    score: { us: match.score[side], them: match.score[other(side)] },
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
  return Object.keys(run.teams)
    .map((id) => ({ team: teamCard(run, id), ...swissRecord(run, id), status: run.swiss.status[id] }))
    .sort((x, y) => y.w - x.w || x.l - y.l || y.boards - x.boards);
}

/** トーナメント表の回戦ごとの札。 */
export function knockoutView(run) {
  if (!run.ko) return null;
  return {
    size: run.ko.size,
    rounds: run.ko.rounds.map((round, index) => ({
      name: KO_ROUND_NAMES[run.ko.size][index] ?? `${index + 1}回戦`,
      matches: round.map((entry) => entry.bye ? { bye: teamCard(run, entry.bye) } : matchView(run, run.matches[entry.match])),
    })),
    champion: run.champion ? teamCard(run, run.champion) : null,
  };
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
    result: run.result,
    champion: run.champion ? teamCard(run, run.champion) : null,
    draftReason: run.draftReason ?? '',
  };
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
