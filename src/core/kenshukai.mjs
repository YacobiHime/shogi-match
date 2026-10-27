// 研修会(docs/kenshukai-design.md)。入会試験でクラスが決まり、例会でF2からSまでの13クラスを上がる。
// A2に上がったら、試験なしで奨励会6級に編入できる。2回に1回の例会の4局目は、プロの先生との駒落ちの指導対局。
// 研修会員は、竜王戦の名簿・奨励会の世界とは別の架空の世界に持つ。画面・保存の仕組み・暦に依存しない(後で作る棋士モードからも呼ぶ)。
// 登場する人物はすべて架空で、実在の人物とは関係がない。
//
// 1つの挑戦(run)の流れ:
//   exam(入会試験: 受験クラスの研修会員と4局。落ちない) → reikai(例会: 1回に4局) → top(Sクラス)
//   A2に上がったら qualified(奨励会6級への編入の資格)。編入するかどうかは、画面で選ぶ(closeKenshukaiRun)。

import { USER_ID } from './ryuo.mjs';
import { createRng, gauss } from './ryuo-random.mjs';
import { newName } from './ryuo-names.mjs';
import { createRepertoire, pickGameStyle, styleEntry } from './ryuo-repertoire.mjs';
import { createCharacter } from './player-character.mjs';
import { GROUP_MEAN_RATING, tournamentLevel, worldCpuLevel } from './ryuo-strength.mjs';
import { LADDER_VERSION } from './level-ladder.mjs';
import { simulateMemberGame } from './ryuo-simulation.mjs';
import {
  addToRecord, addToSlump, bestStreak, emptyRecord, promotionProgress, promotionReached, shoreikaiScale, slumpWarning,
} from './shoreikai.mjs';

export { USER_ID };

export const KENSHUKAI_VERSION = 1;
export const KENSHUKAI_KEY = 'yacobihime:shogi-match:kenshukai:v1';

/** クラス。0がF2、10がA2(奨励会6級への編入の資格)、12がS(研修会の頂点)。 */
export const CLASSES = Object.freeze(['F2', 'F1', 'E2', 'E1', 'D2', 'D1', 'C2', 'C1', 'B2', 'B1', 'A2', 'A1', 'S']);
export const B1 = 9;
export const A2 = 10;
export const TOP = 12;
/** 受験できるクラス(F2〜C1)。 */
export const ENTRY_CLASSES = Object.freeze([0, 1, 2, 3, 4, 5, 6, 7]);
/** クラスごとの強さの目安(竜王戦の名簿と同じ尺度)。F2がR870、1つ上がるごとに+25。A2は奨励会6級(R1150)のすぐ下。 */
export const CLASS_RATINGS = Object.freeze(CLASSES.map((_, index) => 870 + 25 * index));
/** 例会1回の局数(実物どおり)。 */
export const GAMES_PER_DAY = 4;
/** 例会1回の長さ(か月。実物は月2回)。 */
export const MONTHS_PER_DAY = 0.5;
/** 指導対局は、この回数に1回の例会の4局目。 */
export const SHIDO_EVERY = 2;
/** ほかの研修会員が卒業する年齢。 */
export const GRADUATE_AGE = 21;

/** 指導対局の手合い(上手が落とす駒。learning-setup.mjsのLEARNING_HANDICAPSのid。空は平手)。クラスで決まる。 */
export function shidoHandicap(cls) {
  if (cls <= 1) return '2pieces';
  if (cls <= 3) return 'rook-lance';
  if (cls <= 5) return 'rook';
  if (cls <= 7) return 'bishop';
  if (cls <= 9) return 'lance';
  return '';
}
export const HANDICAP_LABELS = Object.freeze({
  '2pieces': '二枚落ち', 'rook-lance': '飛香落ち', rook: '飛車落ち', bishop: '角落ち', lance: '香落ち', '': '平手',
});
/** 指導対局の上手は、いまのクラスの研修会員の強さに、駒落ちのぶんを足した強さで指す(指導なので、本当の強さでは指さない)。 */
export const SHIDO_BONUS = Object.freeze({ '2pieces': 200, 'rook-lance': 160, rook: 120, bishop: 90, lance: 40, '': 20 });

/**
 * 規模(docs/kenshukai-design.mdの2章)。lowはF1へ、midはE2〜C1へ、highはB2〜Sへの昇級の規定。
 * streakは連勝、marksは[勝ち, 負けの上限]。examは入会試験の局数と、1つ上(up)・そのまま(stay)で入る勝ち数。
 * 降級点は、奨励会の同じ規模の値を使う(shoreikaiScale)。
 */
export const KENSHUKAI_SCALES = Object.freeze([
  Object.freeze({
    id: 'mini', label: 'みじかい', note: '勝率7割でD2からA2まで約45局',
    low: { streak: 2, marks: [[3, 1]] },
    mid: { streak: 3, marks: [[4, 1], [5, 2]] },
    high: { streak: 3, marks: [[5, 1], [6, 2]] },
    exam: { games: 4, up: 4, stay: 2 },
    perClass: 5,
  }),
  Object.freeze({
    id: 'short', label: '短め', note: '勝率7割でD2からA2まで約60局',
    low: { streak: 3, marks: [[4, 1], [5, 2]] },
    mid: { streak: 4, marks: [[6, 2], [8, 3]] },
    high: { streak: 4, marks: [[7, 2], [9, 3]] },
    exam: { games: 4, up: 4, stay: 2 },
    perClass: 6,
  }),
  Object.freeze({
    id: 'real', label: '実物どおり', note: '勝率7割でD2からA2まで約130局',
    low: { streak: 5, marks: [[7, 3]] },
    mid: { streak: 6, marks: [[9, 3]] },
    high: { streak: 8, marks: [[12, 4]] },
    exam: { games: 8, up: 7, stay: 4 },
    perClass: 8,
  }),
]);
export const DEFAULT_SCALE = 'mini';
export const kenshukaiScale = (id) => KENSHUKAI_SCALES.find((scale) => scale.id === id) ?? KENSHUKAI_SCALES[0];

export const DEFAULT_SETTINGS = Object.freeze({
  difficulty: 9,
  scale: DEFAULT_SCALE,
  shido: true,
  coachLevel: 'detailed',
  hintLimit: 3,
  undoLimit: 3,
  byoyomi: 0,
});

/** 観戦の記録(世界の出来事)を残す数。 */
const FEED_LIMIT = 24;
/** 例会で、同じ相手と続けて当たらないために覚えておく数。 */
const RECENT_OPPONENTS = 6;
/** 指導対局の先生の候補の数(挑戦を始めたときに、竜王戦の名簿から写す)。 */
const TEACHER_POOL = 10;

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
export const classLabel = (cls) => CLASSES[clamp(Math.round(cls), 0, TOP)] ?? '';

// ---- 昇級の規定

/** そのクラスから上がるときの規定(上がった先のクラスで決まる)。 */
export function promotionRule(scale, cls) {
  const next = cls + 1;
  if (next <= 1) return scale.low;
  if (next <= 7) return scale.mid;
  return scale.high;
}

const emptySlump = () => ({ wins: 0, losses: 0 });

/**
 * 入会試験の成績で入るクラス(受験クラスから1つ上・そのまま・1つ下)。落ちない(研修会は奨励会の安全網。docs/kenshukai-design.mdの4章)。
 * @param {{ exam: { up: number, stay: number } }} scale
 * @param {number} cls 受験クラス
 * @param {number} wins
 */
export function examJoinClass(scale, cls, wins) {
  const delta = wins >= scale.exam.up ? 1 : wins >= scale.exam.stay ? 0 : -1;
  return clamp(cls + delta, 0, ENTRY_CLASSES[ENTRY_CLASSES.length - 1] + 1);
}

/**
 * 世界の物差しを持たない前の挑戦で、研修会員の強さ(名簿の尺度)を、相手のLvに換算する。研修会員はどれも6組の平均より300以上低く、そのままでは
 * 全員が勝率8割の下限に張り付くので、6組の平均のまわりに縮めて写す(docs/kenshukai-design.mdの7章)。F2は勝率8割、Sは6割くらい。
 * @param {number} rating
 * @param {number} difficulty
 * @param {number} userLevel
 */
export function kenshukaiLevel(rating, difficulty, userLevel) {
  const center = (CLASS_RATINGS[0] + CLASS_RATINGS[TOP]) / 2;
  const scaled = GROUP_MEAN_RATING[6] + (rating - center) * 0.6;
  return tournamentLevel(scaled, difficulty, Number.isFinite(userLevel) ? userLevel : 20);
}

/**
 * 棋力(Lv)からのおすすめの受験クラス。強いほど上のクラスから受ける(近道。ただし試験の相手も強い)。
 * 今の表(50段階)のLv。アマ初段(Lv25)でE2、アマ二段でE1、三段でD1、四段でC2、五段でC1から。
 * @param {number} userLevel
 */
export function recommendedEntryClass(userLevel) {
  const level = Number.isFinite(userLevel) ? userLevel : 0;
  if (level >= 37) return 7;
  if (level >= 34) return 6;
  if (level >= 31) return 5;
  if (level >= 29) return 4;
  if (level >= 27) return 3;
  if (level >= 25) return 2;
  if (level >= 21) return 1;
  return 0;
}

// ---- 研修会の世界(研修会員の名簿)

/** そのクラスの、ふつうの年齢(小学生から高校生まで)。 */
function classAge(rng, cls) {
  return clamp(10 + cls * 0.45 + gauss(rng) * 1.8, 7, 20);
}

/**
 * 研修会員を1人作る。強さはクラスの目安のまわり。才能は、これからの伸び(1か月の伸び)に効く。
 * @param {any} world
 * @param {{ next(): number }} rng
 * @param {Set<string>} used
 * @param {{ cls: number, age: number, talent?: number }} options
 */
function createMember(world, rng, used, { cls, age, talent = gauss(rng) * 35 }) {
  const id = `k${world.nextId}`;
  world.nextId += 1;
  const rating = Math.round(CLASS_RATINGS[cls] + gauss(rng) * 12);
  const repertoire = createRepertoire(rng, 6);
  const style = styleEntry(repertoire.styles[0]);
  const woman = rng.next() < 0.3;
  const member = {
    id,
    name: newName(rng, used, { women: woman, age }),
    kind: 'kenshukai',
    woman,
    cls,
    dan: `${classLabel(cls)}クラス`,
    rating,
    talent: Math.round(talent),
    age: Math.round(age * 12) / 12,
    joined: world.month,
    repertoire,
    style,
    character: createCharacter(rng, { rating, age, style }),
  };
  used.add(member.name);
  return member;
}

function setClass(member, cls) {
  member.cls = cls;
  member.dan = `${classLabel(cls)}クラス`;
}

/** 研修会の世界を作る。クラスごとに規模の人数。 */
export function createWorld(rng, scale) {
  const world = { nextId: 1, month: 0, members: {}, transfers: 0, feed: [] };
  const used = new Set();
  for (let cls = 0; cls <= TOP; cls += 1) {
    // 上のクラスほど少し少なく(奨励会へ移っていくため)。
    const count = cls >= A2 ? Math.max(2, scale.perClass - 2) : scale.perClass;
    for (let index = 0; index < count; index += 1) {
      const member = createMember(world, rng, used, { cls, age: classAge(rng, cls) });
      world.members[member.id] = member;
    }
  }
  return world;
}

const usedNames = (world) => new Set(Object.values(world.members).map(({ name }) => name));
const membersOf = (world) => Object.values(world.members);

function addFeed(world, text, tone = 'plain') {
  world.feed = [{ month: Math.floor(world.month), text, tone }, ...(world.feed ?? [])].slice(0, FEED_LIMIT);
}

/** 1か月の伸び(才能で決まる。伸び悩む人もいる)。 */
export const monthlyGrowth = (talent) => clamp(2.2 + talent / 18, -0.5, 6);
/** ほかの研修会員が、1か月のうちに上がる確率(強さが次のクラスの目安を越えているとき)。 */
const NPC_PROMOTE_CHANCE = 0.4;
/** 強さがクラスの目安を大きく下回ったときに、1か月のうちに下がる確率。 */
const NPC_DEMOTE_CHANCE = 0.12;
/** A2・A1・Sの人が、1か月のうちに奨励会へ編入していなくなる確率(上のクラスほど早く移る)。 */
const NPC_TRANSFER_CHANCE = Object.freeze([0.06, 0.12, 0.25]);
/** 入会の頻度(か月)。 */
const ENTRY_EVERY_MONTHS = 3;

/** ほかの研修会員の1か月(伸び・昇級・降級・編入・卒業)。 */
function memberMonth(world, rng, member) {
  member.age += 1 / 12;
  member.rating += monthlyGrowth(member.talent);
  if (member.cls < TOP && member.rating >= CLASS_RATINGS[member.cls + 1] - 5 && rng.next() < NPC_PROMOTE_CHANCE) {
    setClass(member, member.cls + 1);
    if (member.peer) addFeed(world, `同期の${member.name}さんが${member.dan}に昇級`, 'peer');
    else if (member.cls === B1 && member.woman) addFeed(world, `${member.name}さんがB1に昇級。女流棋士2級の資格を得た`, 'plain');
  } else if (member.cls > 0 && member.rating < CLASS_RATINGS[member.cls] - 60 && rng.next() < NPC_DEMOTE_CHANCE) {
    setClass(member, member.cls - 1);
  }
  if (member.cls >= A2 && rng.next() < NPC_TRANSFER_CHANCE[member.cls - A2]) {
    delete world.members[member.id];
    world.transfers += 1;
    addFeed(world, `${member.peer ? '同期の' : ''}${member.name}さんが、奨励会6級に編入`, member.peer ? 'peer' : 'pro');
    return;
  }
  if (member.age >= GRADUATE_AGE) {
    delete world.members[member.id];
    if (member.peer) addFeed(world, `同期の${member.name}さんが、研修会を卒業`, 'peer');
  }
}

/** 時間が進む。ほかの研修会員が伸び、上がり、奨励会へ移り、卒業する。3か月ごとに新しく入会がある。 */
function ageWorld(world, scale, rng, months) {
  const before = Math.floor(world.month);
  world.month += months;
  const after = Math.floor(world.month);
  for (let month = before + 1; month <= after; month += 1) {
    for (const member of membersOf(world)) memberMonth(world, rng, member);
    if (month % ENTRY_EVERY_MONTHS !== 0) continue;
    const used = usedNames(world);
    const target = scale.perClass * (TOP + 1) - 6;
    const count = Math.max(2, target - membersOf(world).length);
    for (let index = 0; index < count; index += 1) {
      const roll = rng.next();
      const cls = roll < 0.35 ? 0 : roll < 0.6 ? 1 : roll < 0.78 ? 2 : roll < 0.9 ? 3 : 4;
      const member = createMember(world, rng, used, { cls, age: classAge(rng, cls) - 0.5 });
      world.members[member.id] = member;
    }
    addFeed(world, `新しく${count}名が入会`, 'plain');
  }
}

/**
 * 例会の、ほかの研修会員どうしの対局(回ごとに、クラスの近い人どうし)。結果は速報に使う。
 * busyは回ごとの、プレイヤーと当たる人(その回は指さない)。
 * @returns {{ round: number, a: string, b: string, winner: string }[]}
 */
function playDay(world, rng, busy = []) {
  const games = [];
  const pool = membersOf(world);
  for (let round = 0; round < GAMES_PER_DAY; round += 1) {
    const players = pool.filter((member) => member.id !== busy[round]);
    const order = players.map((member) => ({ member, key: member.cls + rng.next() * 1.6 })).sort((a, b) => a.key - b.key).map(({ member }) => member);
    for (let index = 0; index + 1 < order.length; index += 2) {
      const a = order[index];
      const b = order[index + 1];
      games.push({ round, a: a.id, b: b.id, winner: simulateMemberGame(rng, a, b).aWins ? a.id : b.id });
    }
  }
  return games;
}

// ---- 1つの挑戦(run)

const players = (run) => ({ ...run.world.members, ...(run.guests ?? {}) });
/** 対局画面などが使う、相手の表(研修会員と指導対局の先生)。保存のあとに付け直す。 */
function link(run) {
  run.players = players(run);
  return run;
}

/**
 * 指導対局の先生の候補(竜王戦の名簿の棋士。物語の人物は除く)。挑戦を始めたときに写しておく(名簿が変わっても、この挑戦は変わらない)。
 * 名簿がなければ空(指導対局は研修会員との対局に代わる)。
 * @param {any} roster
 * @param {{ next(): number }} rng
 */
function teacherPool(roster, rng) {
  const pros = Object.values(roster?.players ?? {}).filter((member) => member.kind === 'pro' && !member.story);
  const picked = [];
  while (picked.length < TEACHER_POOL && pros.length) picked.push(pros.splice(Math.floor(rng.next() * pros.length), 1)[0]);
  return picked.map((member) => ({
    id: `t-${member.id}`,
    name: member.name,
    kind: 'teacher',
    dan: member.dan,
    age: member.age,
    rating: member.rating,
    style: member.style ?? null,
    repertoire: member.repertoire ? structuredClone(member.repertoire) : null,
    character: member.character ? structuredClone(member.character) : null,
  }));
}

/** プレイヤーの1局の相手を決め、Lvと戦法と先後と手合いを付ける。 */
function setPending(run, rng, { opponentId, kind, label, eventText, stakes, others = [], userLevel, handicap = '' }) {
  const all = players(run);
  const opponent = all[opponentId];
  const rating = kind === 'shido' ? CLASS_RATINGS[run.cls] + SHIDO_BONUS[handicap] : opponent.rating;
  // 世界の物差しを持つ挑戦は、会の中の差を残す(いちばん下のクラスを基準。docs/tournament-strength-spread-design.mdの4-4)。
  opponent.level = Number.isFinite(run.settings.world)
    ? worldCpuLevel(rating, run.settings.world, CLASS_RATINGS[0])
    : kenshukaiLevel(rating, run.settings.difficulty, userLevel);
  // 駒落ちでは、下手(プレイヤー)が先手の側に座り、上手が先に指す。駒落ちの戦法は、CPUにまかせる。
  const color = handicap ? 'black' : rng.next() < 0.5 ? 'black' : 'white';
  const style = handicap ? null : opponent.repertoire
    ? pickGameStyle(rng, opponent.repertoire, { color: color === 'black' ? 'white' : 'black' })
    : opponent.style ?? null;
  run.pending = {
    kind, opponentId, color, style, label, eventText, stakes, others: { games: others },
    handicap, handicapLabel: kind === 'shido' ? HANDICAP_LABELS[handicap] : '',
  };
}

/** 入会試験の相手(受験クラスの研修会員から、局数ぶん。少なければ1つ上下からも)。 */
function examOpponents(world, rng, cls, games) {
  let pool = membersOf(world).filter((member) => member.cls === cls);
  if (pool.length < games) pool = membersOf(world).filter((member) => Math.abs(member.cls - cls) <= 1);
  const picked = [];
  const left = [...pool];
  while (picked.length < games && left.length) picked.push(left.splice(Math.floor(rng.next() * left.length), 1)[0].id);
  // 研修会員が少ないときは、同じ人ともう一度。
  while (picked.length < games && pool.length) picked.push(pool[picked.length % pool.length].id);
  return picked;
}

function setExamPending(run, rng, userLevel) {
  const exam = run.exam;
  const index = exam.results.length;
  const wins = exam.results.filter((result) => result === 'win').length;
  const scale = kenshukaiScale(run.settings.scale);
  const last = index === exam.games - 1;
  const left = exam.games - index;
  const winsForUp = Math.max(0, scale.exam.up - wins);
  const winsForStay = Math.max(0, scale.exam.stay - wins);
  // 1つ上にまだ届くなら上を、届かなければ受験クラスのまま入るまでの勝ち数を言う。
  const goal = winsForUp <= left
    ? `あと${winsForUp}勝で${classLabel(exam.cls + 1)}から`
    : winsForStay > 0 ? `あと${winsForStay}勝で${classLabel(exam.cls)}から` : `${classLabel(exam.cls)}から入るのは決まり`;
  setPending(run, rng, {
    opponentId: exam.opponents[index], kind: 'exam', userLevel,
    label: `入会試験 ${index + 1}局目`,
    eventText: `研修会 入会試験（${classLabel(exam.cls)}受験）`,
    stakes: {
      text: `入会試験 ${wins}勝${index - wins}敗（${exam.games}局の成績で入るクラスが決まる）`,
      win: last && wins + 1 >= scale.exam.up ? `${classLabel(exam.cls + 1)}で入会` : '',
      goal,
      boss: last,
    },
  });
}

/**
 * 例会の研修会員の相手を決める(count人)。同じクラスに同期がいれば優先して当てる(同期対決)。クラスは1つ上下まで。最近の相手は避ける。
 */
function pickDayOpponents(run, rng, count) {
  const world = run.world;
  const recent = run.recent ?? [];
  let pool = membersOf(world).filter((member) => Math.abs(member.cls - run.cls) <= 1);
  if (pool.length < count) pool = membersOf(world).filter((member) => Math.abs(member.cls - run.cls) <= 2);
  if (pool.length < count) pool = membersOf(world);
  while (pool.length < count) {
    const member = createMember(world, rng, usedNames(world), { cls: Math.min(run.cls, TOP), age: classAge(rng, run.cls) });
    world.members[member.id] = member;
    pool.push(member);
  }
  const fresh = pool.filter((member) => !recent.includes(member.id));
  const candidates = fresh.length >= count ? fresh : pool;
  const picked = [];
  const peer = candidates.find((member) => member.peer && member.cls === run.cls && !recent.slice(0, 3).includes(member.id));
  if (peer && rng.next() < 0.6) picked.push(peer.id);
  while (picked.length < count) {
    const left = candidates.filter((member) => !picked.includes(member.id));
    if (!left.length) break;
    // 同じクラスを多めに。
    const weights = left.map((member) => (member.cls === run.cls ? 3 : 1));
    let roll = rng.next() * weights.reduce((sum, value) => sum + value, 0);
    let chosen = left[left.length - 1];
    for (let index = 0; index < left.length; index += 1) {
      roll -= weights[index];
      if (roll <= 0) { chosen = left[index]; break; }
    }
    picked.push(chosen.id);
  }
  return picked;
}

/** 例会の賭けているもの(「あと2勝で昇級」「勝てばC1に昇級」)。 */
function dayStakes(run) {
  const scale = kenshukaiScale(run.settings.scale);
  const rule = promotionRule(scale, run.cls);
  const progress = promotionProgress(rule, run.record);
  const afterWin = run.cls < TOP && promotionReached(rule, addToRecord(rule, run.record, true));
  const next = classLabel(run.cls + 1);
  const warning = run.cls > 0 && slumpWarning(shoreikaiScale(scale.id), run.slump);
  return {
    text: `${classLabel(run.cls)}クラス・${progress.record}${progress.streak >= 2 ? `・${progress.streak}連勝中` : ''}`,
    win: afterWin ? (run.cls + 1 === A2 && !run.qualified ? 'A2に昇級（奨励会編入の資格）' : run.cls + 1 === TOP ? 'Sクラスに昇級' : `${next}に昇級`) : '',
    goal: afterWin ? '' : `昇級まであと${progress.winsLeft}勝`,
    boss: Boolean(afterWin) || warning,
    warning: warning ? (run.point ? 'あと1つ負けると降級' : 'あと1つ負けると降級点') : '',
  };
}

/** 例会を1回始める(時間が進み、相手と、指導対局があればその先生を決める)。 */
function startDay(run, rng, userLevel) {
  const scale = kenshukaiScale(run.settings.scale);
  const world = run.world;
  ageWorld(world, scale, rng, MONTHS_PER_DAY);
  run.age += MONTHS_PER_DAY;
  run.dayNo += 1;
  const teachers = run.teachers ?? [];
  const shido = Boolean(run.settings.shido) && teachers.length > 0 && run.dayNo % SHIDO_EVERY === 0;
  const opponents = pickDayOpponents(run, rng, shido ? GAMES_PER_DAY - 1 : GAMES_PER_DAY);
  let teacherId = null;
  if (shido) {
    const teacher = teachers[Math.floor(rng.next() * teachers.length)];
    teacherId = teacher.id;
    // 先生は、指したあとも結果の画面で名前を出せるよう、挑戦の中に残す(多くて候補の数まで)。
    run.guests = { ...(run.guests ?? {}), [teacher.id]: structuredClone(teacher) };
  }
  const kinds = opponents.map(() => 'game');
  if (teacherId) {
    opponents.push(teacherId);
    kinds.push('shido');
  }
  const others = playDay(world, rng, opponents);
  run.day = { no: run.dayNo, opponents, kinds, results: [], others };
  link(run);
  setDayPending(run, rng, userLevel);
}

function setDayPending(run, rng, userLevel) {
  const day = run.day;
  const index = day.results.length;
  const opponentId = day.opponents[index] ?? day.opponents[0];
  const shido = day.kinds[index] === 'shido';
  const handicap = shido ? shidoHandicap(run.cls) : '';
  setPending(run, rng, {
    opponentId, kind: shido ? 'shido' : 'reikai', userLevel, handicap,
    label: shido ? `第${day.no}回例会 ${index + 1}局目・指導対局（${HANDICAP_LABELS[handicap]}）` : `第${day.no}回例会 ${index + 1}局目`,
    eventText: `研修会 ${classLabel(run.cls)}クラス`,
    stakes: dayStakes(run),
    others: day.others.filter((game) => game.round === index).map(({ a, b, winner }) => ({ a, b, winner })),
  });
}

/**
 * 新しい挑戦を始める(入会試験から)。
 * @param {{ seed: number, settings: any, entryClass: number, userName?: string, userLevel: number, roster?: any }} input
 */
export function createKenshukaiRun({ seed, settings, entryClass, userName = 'あなた', userLevel, roster = null }) {
  const rng = createRng(seed);
  const merged = { ...DEFAULT_SETTINGS, ...settings };
  const scale = kenshukaiScale(merged.scale);
  const cls = clamp(Math.round(entryClass), ENTRY_CLASSES[0], ENTRY_CLASSES[ENTRY_CLASSES.length - 1]);
  const world = createWorld(rng, scale);
  const run = {
    version: KENSHUKAI_VERSION,
    id: seed,
    settings: { ...merged, scale: scale.id },
    userName,
    phase: 'exam',
    cls,
    entryClass: cls,
    best: cls,
    // 年齢(か月)。研修会の子たちと同じくらいから。
    age: Math.round(classAge(rng, cls) * 12),
    record: emptyRecord(),
    slump: emptySlump(),
    point: false,
    qualified: false,
    dayNo: 0,
    day: null,
    recent: [],
    exam: { cls, games: scale.exam.games, results: [], opponents: examOpponents(world, rng, cls, scale.exam.games) },
    peers: [],
    games: [],
    history: [{ day: 0, kind: 'exam', text: `${classLabel(cls)}クラスで入会試験を受験` }],
    events: [],
    teachers: teacherPool(roster, rng),
    guests: {},
    resultSeen: false,
    world,
    rng: 0,
    pending: null,
  };
  link(run);
  setExamPending(run, rng, userLevel);
  run.rng = rng.state;
  return link(run);
}

/** 入会試験を終えた。成績で入るクラスが決まり、同じ日に入会した2人が同期になる。 */
function joinFromExam(run, rng, userLevel) {
  const scale = kenshukaiScale(run.settings.scale);
  const exam = run.exam;
  const wins = exam.results.filter((result) => result === 'win').length;
  const cls = examJoinClass(scale, exam.cls, wins);
  const used = usedNames(run.world);
  run.peers = [];
  for (const talent of [40, 0]) {
    const member = createMember(run.world, rng, used, { cls, age: clamp(run.age / 12 + gauss(rng) * 0.8, 7, 20), talent });
    member.peer = true;
    run.world.members[member.id] = member;
    run.peers.push(member.id);
  }
  run.phase = 'reikai';
  run.cls = cls;
  run.joinClass = cls;
  run.best = cls;
  const delta = cls - exam.cls;
  const text = `${classLabel(cls)}クラスで入会（${wins}勝${exam.games - wins}敗）`;
  run.events.push({ kind: 'join', cls, delta, text });
  run.history.push({ day: run.dayNo, kind: 'join', text: `入会試験 ${wins}勝${exam.games - wins}敗。${classLabel(cls)}クラスで入会` });
  startDay(run, rng, userLevel);
}

/**
 * プレイヤーの1局を記録する。入会試験・例会を進め、次の1局を決める。
 * @param {any} run
 * @param {'win' | 'loss'} outcome
 * @param {{ userLevel: number }} options userLevelは、いまの棋力(相手のLvをおすすめに合わせる)
 */
export function recordKenshukaiGame(run, outcome, { userLevel }) {
  if (!run?.pending) return run;
  const next = structuredClone({ ...run, players: undefined });
  const rng = createRng(next.rng);
  const win = outcome === 'win';
  const pending = next.pending;
  const opponent = players(next)[pending.opponentId];
  next.events = [];
  next.games.push({
    day: next.dayNo, kind: pending.kind, opponentId: pending.opponentId, name: opponent?.name ?? '', dan: opponent?.dan ?? '',
    cls: next.cls, handicap: pending.handicap ?? '', win,
  });
  next.pending = null;
  if (pending.kind === 'exam') {
    next.exam.results.push(win ? 'win' : 'loss');
    if (next.exam.results.length >= next.exam.games) joinFromExam(next, rng, userLevel);
    else setExamPending(next, rng, userLevel);
  } else {
    recordDayGame(next, rng, win, opponent, pending, userLevel);
  }
  next.rng = rng.state;
  return link(next);
}

function recordDayGame(run, rng, win, opponent, pending, userLevel) {
  const scale = kenshukaiScale(run.settings.scale);
  const world = run.world;
  run.day.results.push(win ? 'win' : 'loss');
  if (pending.kind === 'shido' && win) run.events.push({ kind: 'shido-win', text: `${opponent?.name ?? ''}${opponent?.dan ?? ''}に${pending.handicapLabel}で勝った` });
  if (pending.kind !== 'shido') run.recent = [opponent?.id, ...run.recent].filter(Boolean).slice(0, RECENT_OPPONENTS);
  // プレイヤーに勝った研修会員は、少し自信をつける(強さが少し伸びる)。
  if (opponent && world.members[opponent.id] && !win) world.members[opponent.id].rating += 2;
  const rule = promotionRule(scale, run.cls);
  run.record = addToRecord(rule, run.record, win);
  const slump = run.cls > 0 ? addToSlump(shoreikaiScale(scale.id), run.slump, win, run.point) : { slump: emptySlump(), event: null };
  run.slump = slump.slump;
  if (slump.event === 'point') {
    run.point = true;
    run.events.push({ kind: 'point', text: '降級点' });
  } else if (slump.event === 'clear') {
    run.point = false;
    run.events.push({ kind: 'clear', text: '降級点が消えた' });
  } else if (slump.event === 'demote') {
    run.point = false;
    run.cls -= 1;
    run.record = emptyRecord();
    run.events.push({ kind: 'demote', cls: run.cls, text: `${classLabel(run.cls)}クラスに降級` });
    run.history.push({ day: run.dayNo, kind: 'demote', text: `${classLabel(run.cls)}クラスに降級` });
  }
  const reached = slump.event === 'demote' || run.cls >= TOP ? null : promotionReached(rule, run.record);
  if (reached) {
    run.cls += 1;
    run.best = Math.max(run.best, run.cls);
    run.record = emptyRecord();
    run.slump = emptySlump();
    run.point = false;
    run.events.push({ kind: 'promote', cls: run.cls, mark: reached, text: `${classLabel(run.cls)}クラスに昇級（${reached}）` });
    run.history.push({ day: run.dayNo, kind: 'promote', text: `${classLabel(run.cls)}クラスに昇級（${reached}）` });
    if (run.cls >= A2 && !run.qualified) {
      run.qualified = true;
      run.events.push({ kind: 'qualify', text: '奨励会6級への編入の資格' });
      run.history.push({ day: run.dayNo, kind: 'qualify', text: 'A2クラスに昇級。奨励会6級への編入の資格を得た' });
    }
    if (run.cls >= TOP) {
      run.phase = 'top';
      run.pending = null;
      run.events.push({ kind: 'top', text: 'Sクラスに昇級' });
      run.history.push({ day: run.dayNo, kind: 'top', text: 'Sクラスに昇級。研修会の頂点' });
      return;
    }
  }
  if (run.day.results.length >= GAMES_PER_DAY) startDay(run, rng, userLevel);
  else setDayPending(run, rng, userLevel);
}

// ---- 画面に出す形

/** 名札掛け(クラスごとの列に名札)。自分・同期には印。 */
export function nameboard(run) {
  if (!run?.world) return [];
  const columns = CLASSES.map((label, rank) => ({ rank, label, tags: [] }));
  for (const member of membersOf(run.world)) {
    columns[clamp(member.cls, 0, TOP)].tags.push({ id: member.id, name: member.name, you: false, peer: Boolean(member.peer), rival: false, rating: member.rating });
  }
  if (run.phase === 'reikai' || run.phase === 'top') {
    columns[clamp(run.cls, 0, TOP)].tags.push({ id: USER_ID, name: run.userName, you: true, peer: false, rival: false, rating: 0 });
  }
  for (const column of columns) column.tags.sort((a, b) => Number(b.you) - Number(a.you) || b.rating - a.rating);
  return columns;
}

/** 相手の札に出す形。 */
function opponentBrief(member) {
  if (!member) return null;
  return {
    id: member.id,
    name: member.name,
    dan: member.dan,
    age: Math.floor(member.age ?? 0),
    level: member.level ?? null,
    rating: member.rating,
    kind: member.kind,
    story: null,
    peer: Boolean(member.peer),
    style: member.style ?? null,
    character: member.character ?? null,
    repertoire: member.repertoire ?? null,
  };
}

/**
 * 画面に出す形。phaseごとに、いま何をしていて、次の1局は何で、あと何勝で上がるか。
 * @param {any} run
 */
export function describeKenshukai(run) {
  if (!run) return null;
  const scale = kenshukaiScale(run.settings.scale);
  const all = players(run);
  const pending = run.pending ? { ...run.pending, opponent: opponentBrief(all[run.pending.opponentId]) } : null;
  const rule = run.cls < TOP ? promotionRule(scale, run.cls) : null;
  const progress = rule ? promotionProgress(rule, run.record) : null;
  const examWins = run.exam.results.filter((result) => result === 'win').length;
  const wins = run.games.filter((game) => game.win).length;
  const shidoGames = run.games.filter((game) => game.kind === 'shido');
  return {
    runId: run.id,
    phase: run.phase,
    cls: run.cls,
    classLabel: classLabel(run.cls),
    nextClassLabel: classLabel(run.cls + 1),
    bestLabel: classLabel(run.best),
    entryLabel: classLabel(run.entryClass),
    qualified: run.qualified,
    settings: run.settings,
    scale: { id: scale.id, label: scale.label },
    exam: {
      cls: run.exam.cls,
      label: classLabel(run.exam.cls),
      games: run.exam.games,
      results: run.exam.results,
      wins: examWins,
      losses: run.exam.results.length - examWins,
      up: scale.exam.up,
      stay: scale.exam.stay,
      upLabel: classLabel(run.exam.cls + 1),
      downLabel: classLabel(Math.max(0, run.exam.cls - 1)),
    },
    progress,
    rule: rule ? { streak: rule.streak, marks: rule.marks.map(([w, l]) => `${w}勝${l}敗`) } : null,
    point: run.point,
    slumpWarning: run.cls > 0 && run.cls < TOP && slumpWarning(shoreikaiScale(scale.id), run.slump),
    day: run.day ? { no: run.day.no, results: run.day.results, kinds: run.day.kinds } : null,
    pending,
    board: nameboard(run),
    peers: run.peers.map((id) => run.world.members[id]).filter(Boolean).map((member) => ({ id: member.id, name: member.name, dan: member.dan, cls: member.cls })),
    feed: run.world.feed ?? [],
    history: run.history,
    events: run.events,
    games: run.games.length,
    wins,
    losses: run.games.length - wins,
    shido: { games: shidoGames.length, wins: shidoGames.filter((game) => game.win).length },
    bestStreak: bestStreak(run.games),
    resultSeen: run.resultSeen,
  };
}

// ---- キャリアと保存

/** 研修会のキャリア(いまの挑戦と、これまでの挑戦の要約)。bestは、これまでにいちばん上がったクラス。 */
export function createKenshukaiCareer() {
  return { version: KENSHUKAI_VERSION, ladder: LADDER_VERSION, settings: { ...DEFAULT_SETTINGS }, run: null, history: [], best: null };
}

/**
 * 挑戦を終える(奨励会へ編入・研修会を終える)。要約を残す。
 * @param {ReturnType<typeof createKenshukaiCareer>} career
 * @param {{ transfer?: boolean }} [options] transferは、奨励会6級に編入した(A2以上のとき)
 */
export function closeKenshukaiRun(career, { transfer = false } = {}) {
  const run = career.run;
  if (!run) return career;
  const wins = run.games.filter((game) => game.win).length;
  const summary = {
    id: run.id,
    result: transfer && run.qualified ? 'transfer' : run.phase === 'top' ? 'top' : 'closed',
    best: classLabel(run.best),
    entry: classLabel(run.joinClass ?? run.entryClass),
    games: run.games.length,
    wins,
    losses: run.games.length - wins,
    days: run.dayNo,
  };
  const best = career.best === null || career.best === undefined ? run.best : Math.max(career.best, run.best);
  return {
    ...career,
    run: null,
    best,
    history: [summary, ...career.history.filter((item) => item.id !== run.id)].slice(0, 20),
  };
}

export function loadKenshukai(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(KENSHUKAI_KEY) ?? 'null');
    if (!parsed || parsed.version !== KENSHUKAI_VERSION) return createKenshukaiCareer();
    const career = { ...createKenshukaiCareer(), ...parsed, ladder: LADDER_VERSION, settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) } };
    if (career.run?.world?.members) link(career.run);
    else career.run = null;
    return career;
  } catch {
    return createKenshukaiCareer();
  }
}

/** 保存する(相手の表playersは、世界から付け直せるので保存しない)。 */
export function saveKenshukai(storage, career) {
  try {
    storage?.setItem(KENSHUKAI_KEY, JSON.stringify(career, (key, value) => (key === 'players' ? undefined : value)));
  } catch {
    // 保存できない環境でも、この挑戦は続けられる。
  }
}
