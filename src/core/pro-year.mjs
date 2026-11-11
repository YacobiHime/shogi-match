// 棋士の1年(docs/pro-year-design.md)。新四段として4月1日から1年度を過ごし、カレンダーの対局日に、
// 八大タイトルと一般棋戦の対局を指す。棋戦の1回り(期)は年度をまたぐので、期ごとに段階(予選・本戦・リーグ・番勝負)と
// 時期を持ち、日付の順に進める。プレイヤーの対局の日が来たら止まり、記録を待つ。画面・保存の仕組みに依存しない。
// 名簿(棋士の世界)は読むだけで書き戻さない(竜王戦・名人戦の期とは別の暦。docs/meijin-design.mdの13章の案B)。

import { createRng, pick } from './ryuo-random.mjs';
import { simulateMemberGame } from './ryuo-simulation.mjs';
import { matchBracket } from './ryuo-stages.mjs';
import { stageVenue } from './match-stage.mjs';
import { pickGameStyle } from './ryuo-repertoire.mjs';
import { HANANE, YOSHIHIKO, hananeBeforeLine } from './ryuo-story.mjs';
import { MAX_CPU_LEVEL, isRealWorld, recommendedWorldLevel, winProbability, worldCpuLevel, worldRating } from './ryuo-strength.mjs';
import { CLASS_RULES } from './meijin.mjs';
import { GEAR, STUDY_SIZE, STUDY_TEXT, gameFee, gearPrep, nextGear, prizeOf, studyDaysBetween, studyDaysOfMonth, studyHananeLine } from './pro-life.mjs';
import { repertoireText } from './ryuo-repertoire.mjs';
import {
  CONDITION_DEFAULT, CONDITION_LABELS, WEEK_ACTIONS, autoActions, autoRatingBonus, clampCondition, conditionAfterGame, conditionHintBonus,
  GOAL_DEFS, GOAL_PICK, WEIGHTS, goalStamp, prepCap, researched, starsFor, weekNumber, weekRange, weekSlots,
} from './pro-week.mjs';
import {
  FESTIVAL_EVENTS, KIGOU_BOOK_MAX, KIGOU_FANS, SHIDOU_FANS, SIMUL_FANS, festivalDays, festivalFee, kigouWords, shidouGuest, simulGuests, simulPartners, talkFans,
} from './pro-festival.mjs';
import { AVATAR_GAINS, avatarEdge, avatarView, emptyAvatar, gainAvatar, gainsText, mergeGains } from './pro-avatar.mjs';
import { KAISETSU_FANS, WORKS, workDef, workOffers, workReward, workScoreText } from './pro-work.mjs';
import {
  INTERVIEW_FANS, NEWS_WEIGHT, RECORD_KINDS, buildNews, fanLettersBetween, interviewFor, isStreakMark, isWinsMark, nextLetter, recordRanking, recordValueText, yearHeadlines,
} from './pro-news.mjs';
import { careerRoad, danFor, nextDanHint, ryuoGroupAfter } from './pro-career.mjs';
import {
  BOND_DEFS, BOND_MEET, BOND_ROLES, BOND_SMALL, addBond, bondLevel, bondNext, emptyBonds, hasPerk, markBondScene, peerPerk, pickPeople, roleOf,
} from './pro-bonds.mjs';

export const PRO_YEAR_KEY = 'yacobihime:shogi-match:pro-year:v1';
/** プレイヤーのid(名簿の'user'と同じ)。 */
export const PRO_USER_ID = 'user';

/**
 * 棋戦の定義(3章の4)。月は、期の始まりの年度の4月を0として数える(12は翌年度の4月)。
 * 段階の形: blocks(予選のブロック。size人のトーナメントがblocks個、各ブロックの優勝者が次へ)、knockout(トーナメント)、
 * league(総当たり。groups組)、series(番勝負。needで勝ち)、junni(順位戦。プレイヤーのクラス)、groups(竜王戦の組)。
 */
export const PRO_EVENTS = Object.freeze([
  {
    id: 'eio', name: '叡王戦', short: '叡王', color: '#a9c1d9', kind: 'title',
    stages: [
      { id: 'q', label: '段位別予選', type: 'blocks', size: 8, blocks: 12, from: 2, to: 8 },
      { id: 'main', label: '本戦トーナメント', type: 'knockout', size: 16, from: 9, to: 11 },
      { id: 'title', label: '叡王戦五番勝負', type: 'series', need: 3, from: 12, to: 14, title: true },
    ],
  },
  {
    id: 'meijin', name: '名人戦', short: '名人', color: '#c39bd3', kind: 'title',
    stages: [
      { id: 'junni', label: '順位戦', type: 'junni', from: 2, to: 11 },
      { id: 'title', label: '名人戦七番勝負', type: 'series', need: 4, from: 12, to: 14, title: true, twoDay: true },
    ],
  },
  {
    id: 'kisei', name: '棋聖戦', short: '棋聖', color: '#82e0aa', kind: 'title',
    stages: [
      { id: 'q1', label: '一次予選', type: 'blocks', size: 8, blocks: 8, from: 1, to: 5 },
      { id: 'q2', label: '二次予選', type: 'blocks', size: 4, blocks: 8, from: 6, to: 9 },
      { id: 'main', label: '決勝トーナメント', type: 'knockout', size: 16, from: 10, to: 13 },
      { id: 'title', label: '棋聖戦五番勝負', type: 'series', need: 3, from: 14, to: 15, title: true },
    ],
  },
  {
    id: 'oi', name: '王位戦', short: '王位', color: '#85c1e9', kind: 'title',
    stages: [
      { id: 'q', label: '予選', type: 'blocks', size: 8, blocks: 8, from: 3, to: 9 },
      { id: 'league', label: '挑戦者決定リーグ', type: 'league', size: 6, groups: 2, groupNames: ['紅組', '白組'], from: 10, to: 13 },
      { id: 'playoff', label: '挑戦者決定戦', type: 'series', need: 1, from: 14, to: 14 },
      { id: 'title', label: '王位戦七番勝負', type: 'series', need: 4, from: 15, to: 17, title: true, twoDay: true },
    ],
  },
  {
    id: 'oza', name: '王座戦', short: '王座', color: '#f7dc6f', kind: 'title',
    stages: [
      { id: 'q1', label: '一次予選', type: 'blocks', size: 8, blocks: 8, from: 4, to: 8 },
      { id: 'q2', label: '二次予選', type: 'blocks', size: 4, blocks: 4, from: 9, to: 11 },
      { id: 'main', label: '挑戦者決定トーナメント', type: 'knockout', size: 16, from: 12, to: 16 },
      { id: 'title', label: '王座戦五番勝負', type: 'series', need: 3, from: 17, to: 18, title: true },
    ],
  },
  {
    id: 'ryuo', name: '竜王戦', short: '竜王', color: '#f1948a', kind: 'title',
    stages: [
      { id: 'ranking', label: 'ランキング戦', type: 'groups', size: 16, from: 8, to: 14 },
      { id: 'main', label: '決勝トーナメント', type: 'knockout', size: 8, from: 14, to: 16 },
      { id: 'title', label: '竜王戦七番勝負', type: 'series', need: 4, from: 18, to: 20, title: true, twoDay: true },
    ],
  },
  {
    id: 'osho', name: '王将戦', short: '王将', color: '#f0b27a', kind: 'title',
    stages: [
      { id: 'q1', label: '一次予選', type: 'blocks', size: 8, blocks: 6, from: 9, to: 12 },
      { id: 'q2', label: '二次予選', type: 'blocks', size: 4, blocks: 3, from: 12, to: 16 },
      { id: 'league', label: '挑戦者決定リーグ', type: 'league', size: 7, groups: 1, groupNames: ['王将リーグ'], from: 16, to: 19 },
      { id: 'title', label: '王将戦七番勝負', type: 'series', need: 4, from: 21, to: 23, title: true, twoDay: true },
    ],
  },
  {
    id: 'kio', name: '棋王戦', short: '棋王', color: '#76d7c4', kind: 'title',
    stages: [
      { id: 'q', label: '予選', type: 'blocks', size: 8, blocks: 8, from: 0, to: 1 },
      { id: 'main', label: '挑戦者決定トーナメント', type: 'knockout', size: 16, from: 2, to: 8 },
      { id: 'title', label: '棋王戦五番勝負', type: 'series', need: 3, from: 10, to: 11, title: true },
    ],
  },
  {
    id: 'nhk', name: 'NHK杯', short: 'NHK杯', color: '#e6b0aa', kind: 'open', broadcast: true,
    stages: [
      { id: 'q', label: '予選', type: 'blocks', size: 8, blocks: 8, from: 5, to: 9 },
      { id: 'main', label: '本戦トーナメント', type: 'knockout', size: 32, from: 12, to: 23, broadcast: true },
    ],
  },
  {
    id: 'asahi', name: '朝日杯', short: '朝日杯', color: '#f5cba7', kind: 'open',
    stages: [
      { id: 'q1', label: '一次予選', type: 'blocks', size: 8, blocks: 8, from: 2, to: 5 },
      { id: 'q2', label: '二次予選', type: 'blocks', size: 4, blocks: 4, from: 6, to: 8 },
      { id: 'main', label: '本戦トーナメント', type: 'knockout', size: 16, from: 9, to: 10 },
    ],
  },
  {
    id: 'shinjin', name: '新人王戦', short: '新人王', color: '#abebc6', kind: 'open', young: true,
    stages: [
      { id: 'main', label: 'トーナメント', type: 'knockout', size: 16, from: 0, to: 5, young: true },
      { id: 'final', label: '決勝三番勝負', type: 'series', need: 2, from: 6, to: 6 },
    ],
  },
  {
    id: 'jt', name: 'JT杯', short: 'JT杯', color: '#aed6f1', kind: 'open', invitational: true,
    stages: [
      { id: 'main', label: 'トーナメント', type: 'knockout', size: 8, from: 2, to: 7, invitational: true },
    ],
  },
]);
export const proEvent = (id) => PRO_EVENTS.find((event) => event.id === id) ?? null;

/** 画面の言葉(U:4。羽音は敬語と「！」なし)。 */
export const PRO_YEAR_TEXT = Object.freeze({
  entrySub: '新四段として、4月1日から',
  lead: '新四段として、4月1日から1年を過ごすよ。カレンダーの対局日に、12の棋戦を指していこう。',
  goal: '予選を勝ち抜き、タイトル戦の舞台へ',
  hananeEntry: '私も今年から四段。同じ予選から始まるよ。上の舞台で会おう。',
  autoNote: '分身が、あなたの強さで指して、勝ち負けを決めるよ。早く進むけれど、この対局は自分では指せなくなるよ。レーティングには数えないよ。',
  game: '目の前の1局に集中しよう。いってらっしゃい！',
  bigGame: '勝てば次の舞台が見えてくる大一番だよ。落ち着いていこう！',
  titleGame: 'タイトル戦の舞台だよ！ ここまで来たんだね。',
  yearDone: '1年おつかれさま！ 次の年度も、いっしょに勝ち上がろう。',
  yearDoneTitle: 'タイトルを取った1年だね！ 次の年度は、防衛と次のタイトルだよ。',
  noMore: '今年度の対局は、もうないよ。年度の終わりまで進もう。',
});
/** タイトル(番勝負のある棋戦)。 */
export const TITLE_EVENTS = Object.freeze(PRO_EVENTS.filter((event) => event.kind === 'title').map((event) => event.id));

// ---- 日付(UTC。曜日も本物の暦)

const pad = (value) => String(value).padStart(2, '0');
const toDate = (text) => new Date(`${text}T00:00:00Z`);
const fromDate = (date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
export const addDays = (text, days) => {
  const date = toDate(text);
  date.setUTCDate(date.getUTCDate() + days);
  return fromDate(date);
};
export const weekdayOf = (text) => toDate(text).getUTCDay();
const WEEKDAYS = Object.freeze(['日', '月', '火', '水', '木', '金', '土']);
/** 「6月12日(木)」。 */
export const dateLabel = (text) => {
  const date = toDate(text);
  return `${date.getUTCMonth() + 1}月${date.getUTCDate()}日(${WEEKDAYS[date.getUTCDay()]})`;
};
/** その日を含む年度(4月はじまり)。 */
export const fiscalYearOf = (text) => {
  const date = toDate(text);
  return date.getUTCMonth() >= 3 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
};
/** 期の始まりの年度baseから数えたk番目の月の1日。 */
function monthStart(base, offset) {
  const total = 3 + offset;
  return `${base + Math.floor(total / 12)}-${pad((total % 12) + 1)}-01`;
}
function monthEnd(base, offset) {
  return addDays(monthStart(base, offset + 1), -1);
}
/** 平日に寄せる(土曜は金曜、日曜は月曜)。 */
function weekday(text) {
  const day = weekdayOf(text);
  if (day === 6) return addDays(text, -1);
  if (day === 0) return addDays(text, 1);
  return text;
}
/** 次の平日(翌日から)。 */
function nextWeekday(text) {
  let day = addDays(text, 1);
  while (weekdayOf(day) === 0 || weekdayOf(day) === 6) day = addDays(day, 1);
  return day;
}
/** 日曜に寄せる(NHK杯の放送)。 */
function sunday(text) {
  const day = weekdayOf(text);
  return addDays(text, day === 0 ? 0 : 7 - day);
}
/** 年度の最後の日。 */
export const yearEnd = (fy) => `${fy + 1}-03-31`;
export const yearStart = (fy) => `${fy}-04-01`;

// ---- 棋士

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** 名簿の棋士を、この1年の写しにする(小さく)。 */
function copyMember(member) {
  return {
    id: member.id,
    name: member.name,
    kind: member.kind,
    dan: member.dan,
    group: member.group ?? 6,
    rating: member.rating,
    age: member.age,
    story: member.story ?? null,
    style: member.style ?? null,
    repertoire: member.repertoire ?? null,
    character: member.character ?? null,
  };
}

const pros = (state) => Object.values(state.players).filter((member) => member.kind === 'pro' && member.id !== PRO_USER_ID);
const byRating = (list) => [...list].sort((a, b) => b.rating - a.rating || String(a.id).localeCompare(String(b.id)));
const isRookie = (member) => member.dan === '四段';

// ---- 期と段階

/** 期の段階の時期(その期の始まりの年度baseから)。 */
function stageWindow(cycle, stageDef) {
  return { start: monthStart(cycle.base, stageDef.from), end: monthEnd(cycle.base, stageDef.to) };
}

/** プレイヤーが出られる棋戦か(JT杯は招待なのでタイトル保持者だけ。新人王戦は六段まで)。 */
function eligible(state, event) {
  if (event.invitational) return Object.values(state.titles).includes(PRO_USER_ID);
  if (event.young) return ['四段', '五段', '六段'].includes(state.players[PRO_USER_ID]?.dan ?? '四段');
  return true;
}

/** 期のid。 */
const cycleId = (event, base) => `${event}-${base}`;

/** 期を作る(まだ段階は始めない)。プレイヤーが出るのは、デビューの日より後に始まった期だけ(3章の3)。 */
function makeCycle(state, event, base) {
  const first = stageWindow({ base }, event.stages[0]);
  return {
    id: cycleId(event.id, base),
    event: event.id,
    base,
    stage: -1,
    stages: [],
    holder: null,
    champion: null,
    done: false,
    withUser: first.start >= state.debut && eligible(state, event),
    entry: first.start >= state.debut ? Math.min(state.user.seeds?.[event.id] ?? 0, event.stages.length - 1) : null,
  };
}

/** 段階に出す棋士の数(予選のブロックは人数×ブロック数)。 */
const stageSize = (def) => (def.type === 'blocks' ? def.size * def.blocks : def.type === 'league' ? def.size * (def.groups ?? 1) : def.size ?? 0);

/** 期のこれまでの段階に出た棋士。 */
const cycleUsed = (cycle) => new Set(cycle.stages.flatMap((stage) => stage.entrants ?? []));

/**
 * 段階の出場者。最初の段階は、上の段階のシードに回す強い棋士を除いた、下のほうの棋士(新四段はシードにしない)。
 * あとの段階は、前の段階の勝ち上がりと、まだ出ていない強い棋士(タイトル保持者は番勝負で待つので除く)。
 */
function stageEntrants(state, cycle, index, previous, rng) {
  const event = proEvent(cycle.event);
  const def = event.stages[index];
  const holder = event.kind === 'title' ? cycle.holder : null;
  const userIn = cycle.withUser && cycle.entry === index;
  // 羽音はプレイヤーと同じ日にデビューするので、デビュー前に始まった期には出ない。
  const beforeDebut = stageWindow(cycle, event.stages[0]).start < state.debut;
  const all = pros(state).filter((member) => member.id !== holder && !(beforeDebut && member.story === HANANE));
  if (def.young) {
    const young = all.filter((member) => member.age <= 26 && ['四段', '五段', '六段'].includes(member.dan));
    const pickList = byRating(young).slice(0, def.size - (userIn ? 1 : 0)).map((member) => member.id);
    return userIn ? [PRO_USER_ID, ...pickList] : pickList;
  }
  if (def.invitational) {
    const holders = new Set(Object.values(state.titles).filter(Boolean));
    const invited = byRating(all.filter((member) => holders.has(member.id))).map((member) => member.id);
    for (const member of byRating(all)) {
      if (invited.length >= def.size) break;
      if (!invited.includes(member.id)) invited.push(member.id);
    }
    const userInvited = holders.has(PRO_USER_ID) && cycle.withUser;
    return userInvited ? [PRO_USER_ID, ...invited.slice(0, def.size - 1)] : invited.slice(0, def.size);
  }
  if (def.type === 'groups') {
    // 竜王戦の組: 組ごとに16人(多い組は強い順から。プレイヤーの組にはプレイヤー)。
    const groups = {};
    for (let group = 1; group <= 6; group += 1) {
      const members = byRating(all.filter((member) => (member.group ?? 6) === group));
      const userGroup = userIn && state.user.group === group;
      const ids = members.slice(0, def.size - (userGroup ? 1 : 0)).map((member) => member.id);
      groups[group] = userGroup ? [...ids, PRO_USER_ID] : ids;
    }
    return groups;
  }
  if (def.type === 'junni') return null;
  const size = stageSize(def);
  if (index === 0) {
    // 上の段階のシードに回す数だけ、強い棋士を残す(新四段は残さない)。
    const reserve = event.stages.slice(1).reduce((sum, later) => sum + (later.type === 'series' ? 0 : Math.max(0, stageSize(later) - qualifierCount(event.stages[event.stages.indexOf(later) - 1]))), 0);
    const strong = new Set(byRating(all.filter((member) => !isRookie(member))).slice(0, reserve).map((member) => member.id));
    const pool = byRating(all.filter((member) => !strong.has(member.id))).reverse();
    const chosen = pool.slice(0, size - (userIn ? 1 : 0)).map((member) => member.id);
    // 羽音(新四段)は、プレイヤーと同じ年のデビューなので、いつも予選から出る。
    const hanane = all.find((member) => member.story === HANANE);
    if (hanane && !chosen.includes(hanane.id) && !strong.has(hanane.id)) chosen[chosen.length - 1] = hanane.id;
    return shuffle(rng, userIn ? [PRO_USER_ID, ...chosen] : chosen);
  }
  const used = cycleUsed(cycle);
  const seeds = byRating(all.filter((member) => !used.has(member.id))).slice(0, Math.max(0, size - previous.length - (userIn ? 1 : 0))).map((member) => member.id);
  return [...previous, ...(userIn ? [PRO_USER_ID] : []), ...seeds];
}

/** 段階の勝ち上がりの数。 */
function qualifierCount(def) {
  if (!def) return 0;
  if (def.type === 'blocks') return def.blocks;
  if (def.type === 'league') return def.groups ?? 1;
  if (def.type === 'groups') return 8;
  return 1;
}

function shuffle(rng, list) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng.next() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

/** 段階の回戦の日(時期の中に均等に。平日。NHK杯の本戦は日曜の放送)。 */
function roundDates(window, rounds, { broadcast = false, spacing = 0 } = {}) {
  const span = Math.max(1, (toDate(window.end) - toDate(window.start)) / 86400000);
  return Array.from({ length: rounds }, (_, index) => {
    const offset = spacing ? Math.min(span, index * spacing) : Math.floor(((index + 0.5) * span) / rounds);
    const date = addDays(window.start, offset);
    return broadcast ? sunday(date) : weekday(date);
  });
}

/** 段階を始める(出場者と回戦の日を決め、最初の回戦の対局を作る)。 */
function startStage(state, cycle, index, rng) {
  const event = proEvent(cycle.event);
  const def = event.stages[index];
  const previous = index > 0 ? cycle.stages[index - 1]?.winners ?? [] : [];
  const window = stageWindow(cycle, def);
  // 前の段階が長引いて、時期の始めを過ぎてから始まるときは、翌日からにする(過ぎた日に対局を置かない)。
  if (window.start <= state.date) {
    window.start = addDays(state.date, 1);
    if (window.end <= window.start) window.end = addDays(window.start, 14);
  }
  const stage = { index, id: def.id, type: def.type, label: def.label, start: window.start, end: window.end, rounds: [], winners: [], done: false };
  cycle.stage = index;
  cycle.stages[index] = stage;
  if (def.type === 'blocks' || def.type === 'knockout' || def.type === 'groups') {
    const entrants = stageEntrants(state, cycle, index, previous, rng);
    if (def.type === 'groups') {
      stage.blocks = Object.entries(entrants).map(([group, ids]) => ({ name: `${group}組`, alive: shuffle(rng, ids), group: Number(group) }));
    } else if (def.type === 'blocks') {
      const ids = entrants;
      stage.blocks = Array.from({ length: def.blocks }, (_, block) => ({ name: `${String.fromCharCode(65 + block)}ブロック`, alive: ids.slice(block * def.size, (block + 1) * def.size) }));
    } else {
      stage.blocks = [{ name: '', alive: padBracket(shuffle(rng, entrants), def.size) }];
    }
    stage.entrants = stage.blocks.flatMap((block) => block.alive).filter(Boolean);
    stage.user = stage.entrants.includes(PRO_USER_ID);
    // 次が挑戦者決定・決勝の番勝負(タイトル戦でない)なら、2人が残ったところで止める(新人王戦の決勝三番勝負)。
    const nextDef = event.stages[index + 1];
    if (nextDef?.type === 'series' && !nextDef.title && stage.blocks.length === 1) stage.finalists = true;
    const size = Math.max(...stage.blocks.map((block) => block.alive.length));
    const count = Math.max(1, Math.ceil(Math.log2(Math.max(2, size))) - (stage.finalists ? 1 : 0));
    stage.dates = roundDates(window, count, { broadcast: Boolean(def.broadcast) });
    // 対局の歩み([先, 後, 勝った人])。記録を作るブロックだけ。
    stage.blocks.forEach((block) => { block.history = []; });
    openKnockoutRound(state, cycle, stage, rng);
  } else if (def.type === 'league') {
    const entrants = stageEntrants(state, cycle, index, previous, rng);
    const groups = def.groups ?? 1;
    stage.groups = Array.from({ length: groups }, (_, group) => {
      const members = entrants.filter((_, i) => i % groups === group);
      return { name: def.groupNames?.[group] ?? '', members, wins: Object.fromEntries(members.map((id) => [id, 0])), losses: Object.fromEntries(members.map((id) => [id, 0])), schedule: roundRobin(members) };
    });
    stage.entrants = entrants;
    stage.user = entrants.includes(PRO_USER_ID);
    const count = Math.max(...stage.groups.map((group) => group.schedule.length));
    stage.dates = roundDates(window, count);
    openLeagueRound(state, cycle, stage);
  } else if (def.type === 'series') {
    const [a, b] = def.title ? [cycle.holder, previous[0]] : previous.slice(0, 2);
    stage.series = { a, b, need: def.need, wins: { [a]: 0, [b]: 0 }, twoDay: Boolean(def.twoDay) };
    stage.entrants = [a, b].filter(Boolean);
    stage.user = stage.entrants.includes(PRO_USER_ID);
    const maxGames = def.need * 2 - 1;
    stage.dates = roundDates(window, maxGames, { spacing: maxGames > 1 ? Math.max(3, Math.floor(((toDate(window.end) - toDate(window.start)) / 86400000) / maxGames)) : 0 });
    if (!a || !b || a === b) {
      // 相手がいない(挑戦者が決まらなかった)ときは、保持者の防衛。
      stage.winners = [a ?? b];
      finishStage(state, cycle, stage, rng);
      return;
    }
    openSeriesGame(state, cycle, stage);
  } else if (def.type === 'junni') {
    startJunni(state, cycle, stage, rng);
  }
}

/** トーナメントの表を2の累乗にそろえる(足りない分は不戦勝)。 */
function padBracket(ids, size) {
  const slots = Array.from({ length: size }, (_, index) => ids[index] ?? null);
  return slots;
}

/** 総当たりの組み合わせ(円の回し方)。 */
function roundRobin(members) {
  const list = members.length % 2 ? [...members, null] : [...members];
  const rounds = [];
  for (let round = 0; round < list.length - 1; round += 1) {
    const pairs = [];
    for (let index = 0; index < list.length / 2; index += 1) {
      const a = list[index];
      const b = list[list.length - 1 - index];
      if (a && b) pairs.push([a, b]);
    }
    rounds.push(pairs);
    list.splice(1, 0, list.pop());
  }
  return rounds;
}

// ---- 対局

function addGame(state, { cycle, stage, round, a, b, date, block = 0, twoDay = false }) {
  const id = `g${state.nextGame}`;
  state.nextGame += 1;
  const game = { id, cycle: cycle.id, event: cycle.event, stage: stage.index, round, a, b, date, winner: null };
  if (block) game.k = block;
  if (twoDay) game.twoDay = true;
  // 名前の札(「棋聖戦 一次予選 Bブロック 1回戦」)は、プレイヤーの対局にだけ持たせる(ほかは`gameLabel`で作る。保存を小さく)。
  if (a === PRO_USER_ID || b === PRO_USER_ID) {
    game.user = true;
    game.label = gameLabel(state, game);
  }
  state.games[id] = game;
  stage.rounds[round] ??= [];
  stage.rounds[round].push(id);
  return game;
}

/**
 * 対局の名前の札(「棋聖戦 一次予選 Bブロック 1回戦」)。
 * @param {any} state
 * @param {any} game
 */
export function gameLabel(state, game) {
  if (game.label) return game.label;
  const event = proEvent(game.event);
  const def = event?.stages[game.stage];
  if (!def) return event?.name ?? '';
  const stage = state.cycles[game.cycle]?.stages[game.stage];
  if (def.type === 'series') return `${def.label} 第${game.round + 1}局`;
  if (def.type === 'junni') return `名人戦 順位戦 ${CLASS_NAMES[stage?.cls] ?? ''} ${game.round + 1}回戦`;
  if (def.type === 'league') {
    const group = stage?.groups?.length > 1 ? stage.groups[game.k ?? 0]?.name : '';
    return `${event.name} ${def.label}${group ? ` ${group}` : ''} ${game.round + 1}回戦`;
  }
  const block = def.type === 'knockout' ? '' : stage?.blocks?.[game.k ?? 0]?.name ?? '';
  return `${event.name} ${def.label}${block ? ` ${block}` : ''} ${roundName({ type: def.type, finalists: stage?.finalists }, game.round, stage?.dates?.length ?? game.round + 1)}`;
}

/**
 * 回戦の日を決める。前の回戦が長引いて日が過ぎていたら次の平日へ。プレイヤーが指す回戦は、
 * プレイヤーのほかの対局(2日制は前の日も)と重ならない日へずらす(3章の5)。
 */
function roundDate(state, stage, round, { withUser = false, twoDay = false } = {}) {
  let date = stage.dates[round];
  if (date <= state.date) date = nextWeekday(state.date);
  if (withUser) {
    const busy = new Set();
    for (const game of Object.values(state.games)) {
      if (!game.user) continue;
      busy.add(game.date);
      if (game.twoDay) busy.add(addDays(game.date, -1));
    }
    const clash = (day) => busy.has(day) || (twoDay && busy.has(addDays(day, -1)));
    for (let guard = 0; guard < 30 && clash(date); guard += 1) date = nextWeekday(twoDay ? addDays(date, 1) : date);
  }
  stage.dates[round] = date;
  return date;
}

/** 回戦の名前(2人が残ったところで止めるトーナメントは、最後の回戦が準決勝)。 */
function roundName(stage, round, total) {
  const left = total - round + (stage.finalists ? 1 : 0);
  if (stage.type === 'series') return `第${round + 1}局`;
  if (stage.type === 'league' || stage.type === 'junni') return `${round + 1}回戦`;
  if (left === 1) return stage.type === 'blocks' ? 'ブロック決勝' : '決勝';
  if (left === 2 && stage.type !== 'blocks') return '準決勝';
  return `${round + 1}回戦`;
}

function openKnockoutRound(state, cycle, stage, rng) {
  const round = stage.rounds.length;
  const total = stage.dates.length;
  const withUser = stage.blocks.some((block) => block.alive.includes(PRO_USER_ID));
  const date = roundDate(state, stage, round, { withUser });
  stage.blocks.forEach((block, blockIndex) => {
    // 対局の記録を作るのは、プレイヤーと羽音のいるブロックと、本戦(1つの表)だけ。ほかのブロックは、回戦を閉じるときに勝ち負けだけ決める。
    block.track ??= stage.type === 'knockout' || block.alive.some((id) => id === PRO_USER_ID || state.players[id]?.story === HANANE);
    if (!block.track) return;
    // トーナメント表(10-2の1)のために、最初の並びを残す(記録を作るブロックだけ)。
    if (round === 0 && !block.slots) block.slots = [...block.alive];
    for (let index = 0; index < block.alive.length; index += 2) {
      const [a, b] = [block.alive[index], block.alive[index + 1]];
      if (a && b) addGame(state, { cycle, stage, round, a, b, date, block: blockIndex });
    }
  });
  stage.rounds[round] ??= [];
  void total;
}

function closeKnockoutRound(state, cycle, stage, rng) {
  const round = stage.rounds.length - 1;
  const games = (stage.rounds[round] ?? []).map((id) => state.games[id]);
  for (const block of stage.blocks) {
    const winners = [];
    for (let index = 0; index < block.alive.length; index += 2) {
      const [a, b] = [block.alive[index], block.alive[index + 1]];
      if (a && b) {
        const game = games.find((entry) => entry.a === a && entry.b === b);
        let winner;
        if (game) {
          winner = game.winner === 'b' ? b : a;
          // プレイヤーが負けたら、その日に「敗退」を残す(段階の終わりを待たない。終局の窓に出す)。
          if (game.user && winner !== PRO_USER_ID) {
            const event = proEvent(cycle.event);
            noteMilestone(state, { event: event.id, kind: 'out', text: `${event.name} ${stage.label}で敗退` });
            stage.userOut = true;
          }
        } else {
          const aWins = simulateMemberGame(rng, state.players[a], state.players[b]).aWins;
          winner = aWins ? a : b;
          countRecord(state, winner, aWins ? b : a, feeOf(cycle, stage, block.group));
        }
        winners.push(winner);
        if (block.track) block.history.push([a, b, winner]);
      } else winners.push(a ?? b ?? null);
    }
    block.alive = winners;
  }
  const alive = Math.max(...stage.blocks.map((block) => block.alive.filter(Boolean).length));
  if (alive <= (stage.finalists ? 2 : 1)) {
    const def = proEvent(cycle.event).stages[stage.index];
    stage.winners = stage.finalists ? stage.blocks[0].alive.filter(Boolean) : stage.blocks.map((block) => block.alive.find(Boolean)).filter(Boolean);
    // 竜王戦: 組の優勝者6人と、1組・2組の準優勝の2人が決勝トーナメントへ。
    if (def.type === 'groups') {
      for (const block of stage.blocks.filter((entry) => entry.group <= 2)) {
        const final = block.history.at(-1);
        if (final) stage.winners.push(final[2] === final[0] ? final[1] : final[0]);
      }
    }
    finishStage(state, cycle, stage, rng);
    return;
  }
  openKnockoutRound(state, cycle, stage, rng);
}

function openLeagueRound(state, cycle, stage) {
  const round = stage.rounds.length;
  const withUser = stage.groups.some((group) => (group.schedule[round] ?? []).some((pair) => pair.includes(PRO_USER_ID)));
  const date = roundDate(state, stage, round, { withUser });
  stage.groups.forEach((group, groupIndex) => {
    for (const [a, b] of group.schedule[round] ?? []) addGame(state, { cycle, stage, round, a, b, date, block: groupIndex });
  });
  stage.rounds[round] ??= [];
}

function closeLeagueRound(state, cycle, stage, rng) {
  const round = stage.rounds.length - 1;
  for (const id of stage.rounds[round] ?? []) {
    const game = state.games[id];
    const group = stage.groups.find((entry) => entry.members.includes(game.a));
    const [winner, loser] = game.winner === 'b' ? [game.b, game.a] : [game.a, game.b];
    group.wins[winner] += 1;
    group.losses[loser] += 1;
  }
  if (round + 1 < stage.dates.length) {
    openLeagueRound(state, cycle, stage);
    return;
  }
  stage.winners = stage.groups.map((group) => leagueRows(state, group)[0]?.id).filter(Boolean);
  finishStage(state, cycle, stage, rng);
}

/** リーグの順位(勝ち数、同じなら強い順。プレーオフは省いた)。 */
function leagueRows(state, group) {
  return [...group.members]
    .map((id) => ({ id, wins: group.wins[id] ?? 0, losses: group.losses[id] ?? 0 }))
    .sort((a, b) => b.wins - a.wins || a.losses - b.losses || (state.players[b.id]?.rating ?? 0) - (state.players[a.id]?.rating ?? 0));
}

function openSeriesGame(state, cycle, stage) {
  const round = stage.rounds.length;
  const { a, b } = stage.series;
  const twoDay = stage.series.twoDay;
  const date = roundDate(state, stage, round, { withUser: a === PRO_USER_ID || b === PRO_USER_ID, twoDay });
  addGame(state, { cycle, stage, round, a: round % 2 ? b : a, b: round % 2 ? a : b, date, twoDay });
}

function closeSeriesGame(state, cycle, stage, rng) {
  const round = stage.rounds.length - 1;
  const game = state.games[stage.rounds[round][0]];
  const winner = game.winner === 'b' ? game.b : game.a;
  stage.series.wins[winner] += 1;
  if (stage.series.wins[winner] >= stage.series.need) {
    stage.winners = [winner];
    finishStage(state, cycle, stage, rng);
    return;
  }
  if (round + 1 >= stage.dates.length) {
    stage.winners = [winner];
    finishStage(state, cycle, stage, rng);
    return;
  }
  openSeriesGame(state, cycle, stage);
}

/** 段階が終わった。次の段階は、その時期になったら始める(期の最後なら、タイトル・優勝を決める)。 */
function finishStage(state, cycle, stage, rng) {
  stage.done = true;
  const event = proEvent(cycle.event);
  const def = event.stages[stage.index];
  const userIn = Boolean(stage.user);
  const userWon = stage.winners.includes(PRO_USER_ID);
  if (userIn && stage.type !== 'junni') {
    if (!(stage.userOut && !userWon)) noteMilestone(state, {
      event: event.id,
      kind: userWon ? 'advance' : 'out',
      text: userWon
        ? def.title ? `${event.short}を獲得` : stage.index === event.stages.length - 1 ? `${event.name} 優勝` : `${event.name} ${stage.label}を突破`
        : `${event.name} ${stage.label}で敗退`,
    });
    // 次の期のシード(3章の10): 本戦・リーグ以上に入ったら、次の期は1つ上の段階から。
    if (!def.title && stage.index > 0) {
      state.user.seeds = { ...(state.user.seeds ?? {}), [event.id]: Math.max(state.user.seeds?.[event.id] ?? 0, Math.min(stage.index, event.stages.length - 2)) };
    }
  }
  // 竜王戦の組: ランキング戦で決勝に進めば、次の年度は1つ上の組(15-3の5)。
  if (def.type === 'groups' && userIn && cycle.withUser) {
    const block = stage.blocks.find((entry) => (entry.slots ?? []).includes(PRO_USER_ID));
    const final = block?.history?.at(-1);
    const group = block?.group ?? state.user.group;
    const reached = Boolean(final && final.slice(0, 2).includes(PRO_USER_ID) && block.alive.filter(Boolean).length <= 1);
    const next = ryuoGroupAfter(group, reached);
    state.user.ryuoResult = { group, next, promoted: next < group, base: cycle.base };
    if (next < group) noteMilestone(state, { event: event.id, kind: 'advance', text: `竜王戦 ${group}組で昇級（来期は${next}組）` });
  }
  if (def.title) {
    state.titles[event.id] = stage.winners[0] ?? cycle.holder;
    closeCycle(cycle, stage.winners[0] ?? cycle.holder);
    awardPrize(state, cycle);
    return;
  }
  if (stage.index === event.stages.length - 1) {
    closeCycle(cycle, stage.winners[0] ?? null);
    awardPrize(state, cycle);
    return;
  }
  // 次の段階は、その時期の始めに始める(runが拾う)。番勝負の保持者は、そのときのタイトル保持者。
  const nextDef = event.stages[stage.index + 1];
  if (nextDef.title) cycle.holder = state.titles[event.id] ?? cycle.holder;
}

/** 期の終わり。出場者の一覧は、次の段階のシードを選ぶためだけのものなので消す(保存を小さく)。 */
function closeCycle(cycle, champion) {
  cycle.champion = champion;
  cycle.done = true;
  for (const stage of cycle.stages) if (stage) delete stage.entrants;
}

// ---- 順位戦(名人戦)

/** 順位戦の世界(名簿の順位戦の世界を写す。プレイヤーのクラスは、名人戦に出ていればそこ、なければC級2組)。 */
function junniClasses(roster) {
  const classes = {};
  for (const [cls, ids] of Object.entries(roster?.junni?.classes ?? {})) classes[cls] = ids.filter((id) => roster.players?.[id]);
  return classes;
}

function startJunni(state, cycle, stage, rng) {
  const cls = cycle.withUser ? state.user.cls : null;
  const members = cls ? [...(state.junni[cls] ?? [])] : [];
  if (cls && !members.includes(PRO_USER_ID)) members.push(PRO_USER_ID);
  stage.cls = cls;
  stage.members = members;
  stage.user = Boolean(cls);
  stage.wins = Object.fromEntries(members.map((id) => [id, 0]));
  stage.losses = Object.fromEntries(members.map((id) => [id, 0]));
  stage.met = { [PRO_USER_ID]: [] };
  const rounds = cls ? CLASS_RULES[cls]?.rounds ?? 10 : 0;
  stage.dates = roundDates({ start: stage.start, end: stage.end }, Math.max(1, rounds));
  if (!cls) {
    // プレイヤーがいない期(デビュー前): A級の1位だけ決める。
    stage.winners = [junniAWinner(state, rng)];
    finishStage(state, cycle, stage, rng);
    return;
  }
  openJunniRound(state, cycle, stage, rng);
}

function openJunniRound(state, cycle, stage, rng) {
  const round = stage.rounds.length;
  // プレイヤーの相手(まだ当たっていない、同じクラスの棋士)。ほかの棋士どうしは結果だけ(閉じるときに数える)。
  const met = stage.met[PRO_USER_ID];
  const choices = stage.members.filter((id) => id !== PRO_USER_ID && !met.includes(id));
  const hanane = choices.find((id) => state.players[id]?.story === HANANE);
  // 羽音とは、期の後半(6割の回戦)に必ず1度当たる(名人戦と同じ)。
  const target = Math.floor((stage.dates.length - 1) * 0.6);
  const others = choices.filter((id) => id !== hanane);
  const opponent = hanane && round >= target ? hanane : pick(rng, others.length ? others : choices);
  const date = roundDate(state, stage, round, { withUser: Boolean(opponent) });
  if (opponent) {
    met.push(opponent);
    const userFirst = rng.next() < 0.5;
    addGame(state, { cycle, stage, round, a: userFirst ? PRO_USER_ID : opponent, b: userFirst ? opponent : PRO_USER_ID, date });
  }
  stage.rounds[round] ??= [];
}

function closeJunniRound(state, cycle, stage, rng) {
  const round = stage.rounds.length - 1;
  const busy = new Set();
  for (const id of stage.rounds[round] ?? []) {
    const game = state.games[id];
    const [winner, loser] = game.winner === 'b' ? [game.b, game.a] : [game.a, game.b];
    stage.wins[winner] += 1;
    stage.losses[loser] += 1;
    busy.add(game.a);
    busy.add(game.b);
  }
  // ほかの棋士どうし: 残りを組にして、勝率で勝ち負けだけ決める。
  const rest = shuffle(rng, stage.members.filter((id) => !busy.has(id)));
  for (let index = 0; index + 1 < rest.length; index += 2) {
    const [a, b] = [rest[index], rest[index + 1]];
    const aWins = simulateMemberGame(rng, state.players[a], state.players[b]).aWins;
    stage.wins[aWins ? a : b] += 1;
    stage.losses[aWins ? b : a] += 1;
    countRecord(state, aWins ? a : b, aWins ? b : a, gameFee({ type: 'junni', cls: stage.cls }));
  }
  if (round + 1 < stage.dates.length) {
    openJunniRound(state, cycle, stage, rng);
    return;
  }
  // 期の終わり: プレイヤーのクラスの順位と昇級。A級の1位が名人戦の挑戦者。
  const rows = junniRows(state, stage);
  const rules = CLASS_RULES[stage.cls];
  const place = rows.findIndex((row) => row.id === PRO_USER_ID) + 1;
  const promoted = rules?.promote && place <= rules.promote;
  stage.result = { place, promoted: Boolean(promoted), size: rows.length };
  state.user.junniResult = { cls: stage.cls, place, promoted: Boolean(promoted), wins: stage.wins[PRO_USER_ID], losses: stage.losses[PRO_USER_ID] };
  noteMilestone(state, {
    event: 'meijin', kind: promoted ? 'advance' : 'plain',
    text: `順位戦 ${CLASS_NAMES[stage.cls]} ${stage.wins[PRO_USER_ID]}勝${stage.losses[PRO_USER_ID]}敗（${place}位）${promoted ? '・昇級' : ''}`,
  });
  // A級の1位が名人戦の挑戦者(プレイヤーがA級なら、そのリーグの1位。ほかのクラスなら、A級を勝率で決める)。
  stage.winners = [stage.cls === 'A' ? rows[0].id : junniAWinner(state, rng, { count: true })];
  finishStage(state, cycle, stage, rng);
}

/** 順位の行(勝ち数、同じなら前の期の順位=並びの順)。 */
function junniRows(state, stage) {
  return stage.members
    .map((id, order) => ({ id, order, wins: stage.wins[id] ?? 0, losses: stage.losses[id] ?? 0 }))
    .sort((a, b) => b.wins - a.wins || a.order - b.order);
}

/**
 * A級の1位(プレイヤーのいないA級は、総当たりを勝率で決める)。count=trueは、その総当たりを年間成績と対局料に数える
 * (この年度のA級の対局。デビュー前の期は数えない)。
 */
function junniAWinner(state, rng, { count = false } = {}) {
  const members = (state.junni.A ?? []).filter((id) => state.players[id]);
  const wins = Object.fromEntries(members.map((id) => [id, 0]));
  for (let i = 0; i < members.length; i += 1) {
    for (let j = i + 1; j < members.length; j += 1) {
      const aWins = simulateMemberGame(rng, state.players[members[i]], state.players[members[j]]).aWins;
      wins[aWins ? members[i] : members[j]] += 1;
      if (count) countRecord(state, aWins ? members[i] : members[j], aWins ? members[j] : members[i], gameFee({ type: 'junni', cls: 'A' }));
    }
  }
  return members.sort((a, b) => wins[b] - wins[a])[0] ?? null;
}

export const CLASS_NAMES = Object.freeze({ A: 'A級', B1: 'B級1組', B2: 'B級2組', C1: 'C級1組', C2: 'C級2組' });

// ---- 記録

/** 年間成績と対局料(1局ごとに両者へ。10-2の3)。 */
function countRecord(state, winner, loser, fee = 0) {
  for (const [id, won] of [[winner, true], [loser, false]]) {
    const record = (state.year.records[id] ??= { w: 0, l: 0, streak: 0, best: 0 });
    if (won) {
      record.w += 1;
      record.streak += 1;
      record.best = Math.max(record.best, record.streak);
    } else {
      record.l += 1;
      record.streak = 0;
    }
    if (fee) earn(state, id, fee, 'fee');
  }
}

/**
 * 年間の獲得(対局料・賞金・謝礼)を数える。プレイヤーは財布にも入る(研究の道具を買う)。
 * @param {any} state
 * @param {string} id
 * @param {number} amount 万円
 * @param {'fee' | 'prize' | 'gig'} kind
 */
function earn(state, id, amount, kind) {
  if (!id || !amount) return;
  const year = state.year;
  year.earn ??= {};
  year.earn[id] = (year.earn[id] ?? 0) + amount;
  if (id !== PRO_USER_ID) return;
  year.mine ??= { fee: 0, prize: 0, gig: 0 };
  year.mine[kind] = (year.mine[kind] ?? 0) + amount;
  state.user.money = (state.user.money ?? 0) + amount;
}

/** 段階の1局の対局料(竜王戦の組は、ブロックの組。順位戦はクラス)。 */
function feeOf(cycle, stage, group = null) {
  const def = proEvent(cycle.event).stages[stage.index];
  return gameFee({ type: def.type, title: Boolean(def.title), need: def.need, cls: stage.cls ?? null, group });
}

/** 期の優勝・タイトルの賞金(10-2の3)。 */
function awardPrize(state, cycle) {
  if (cycle.champion) earn(state, cycle.champion, prizeOf(cycle.event), 'prize');
}

function noteMilestone(state, item) {
  state.logSeq = (state.logSeq ?? 0) + 1;
  state.log = [...(state.log ?? []), { ...item, date: state.date, n: state.logSeq }].slice(-60);
}

// ---- 進める

/** いま決められる次の出来事(始まっていない段階の始まり・決まっていない回戦)。 */
function nextAction(state) {
  let best = null;
  const consider = (date, item) => {
    if (!best || date < best.date || (date === best.date && item.order < best.order)) best = { date, ...item };
  };
  for (const cycle of Object.values(state.cycles)) {
    if (cycle.done) continue;
    const event = proEvent(cycle.event);
    const stage = cycle.stages[cycle.stage];
    if (!stage || stage.done) {
      const index = cycle.stage + 1;
      const def = event.stages[index];
      if (!def) continue;
      // 前の段階が終わっていなければ、まだ。
      if (index > 0 && !cycle.stages[index - 1]?.done) continue;
      consider(stageWindow(cycle, def).start, { kind: 'start', cycle: cycle.id, index, order: 0 });
      continue;
    }
    const round = stage.rounds.length - 1;
    if (round < 0) continue;
    consider(stage.dates[round], { kind: 'round', cycle: cycle.id, stage: stage.index, round, order: 1 });
  }
  return best;
}

/** 回戦の対局を決める。プレイヤーの対局が残っていれば、それを返す(止まる)。 */
function playRound(state, cycle, stage, round, rng) {
  let userGame = null;
  for (const id of stage.rounds[round] ?? []) {
    const game = state.games[id];
    if (game.winner) continue;
    if (game.user) {
      userGame = game;
      continue;
    }
    const big = stage.type === 'series' && proEvent(cycle.event).stages[stage.index].title;
    const result = simulateMemberGame(rng, state.players[game.a], state.players[game.b], { big });
    const aWins = result.aWins;
    game.winner = aWins ? 'a' : 'b';
    // 観戦(10-2の2)のための、まねの記録(先手・勝ち方・形勢の線。先手から見た値)。
    const sign = result.aColor === 'black' ? 1 : -1;
    game.rec = { b: result.aColor === 'black' ? 'a' : 'b', how: result.how, s: (result.phases ?? []).map((value) => value * sign + 0) };
    countRecord(state, aWins ? game.a : game.b, aWins ? game.b : game.a, feeOf(cycle, stage, stage.blocks?.[game.k ?? 0]?.group ?? null));
  }
  if (userGame) return userGame;
  closeRound(state, cycle, stage, rng);
  return null;
}

function closeRound(state, cycle, stage, rng) {
  if (stage.type === 'series') closeSeriesGame(state, cycle, stage, rng);
  else if (stage.type === 'league') closeLeagueRound(state, cycle, stage, rng);
  else if (stage.type === 'junni') closeJunniRound(state, cycle, stage, rng);
  else closeKnockoutRound(state, cycle, stage, rng);
}

/**
 * 日付の順に進める。プレイヤーの対局の日に来たら止まり、pendingを付ける。untilの日(含む)まで進めたら止まる。
 * @returns {boolean} プレイヤーの対局で止まったら真
 */
function run(state, until, rng) {
  for (let guard = 0; guard < 20000; guard += 1) {
    if (state.pending) return true;
    const action = nextAction(state);
    if (!action || action.date > until) {
      state.date = until > state.date ? until : state.date;
      return false;
    }
    if (action.date > state.date) state.date = action.date;
    const cycle = state.cycles[action.cycle];
    if (action.kind === 'start') {
      startStage(state, cycle, action.index, rng);
      continue;
    }
    const stage = cycle.stages[action.stage];
    const userGame = playRound(state, cycle, stage, action.round, rng);
    if (userGame) {
      setPending(state, userGame, rng);
      return true;
    }
  }
  return false;
}

/** 相手のLv(大会の世界の物差し。本物の世界の善彦はいつもLv49)。 */
function levelOf(state, opponent) {
  const world = Number.isFinite(state.settings?.world) ? state.settings.world : recommendedWorldLevel(state.userLevel ?? 20);
  return isRealWorld(world) && opponent.story === YOSHIHIKO ? MAX_CPU_LEVEL : worldCpuLevel(opponent.rating, world);
}

/**
 * 棋士の1年の途中で難易度(世界)を変える(docs/tournament-strength-spread-design.mdの11章)。次の公式戦の相手のLvも付け直す。
 * 対局料や名簿のレーティングは変えない(強さの物差しだけ)。
 * @param {any} source
 * @param {{ difficulty: number, world: number }} next
 */
export function retuneProYearWorld(source, { difficulty, world }) {
  if (!source?.settings) return source;
  const state = structuredClone(source);
  state.settings = { ...state.settings, difficulty, world };
  // 公式戦と研究会の練習対局の相手(まつりの指導対局のお客は、手合いで決まるので変えない)。
  const opponent = state.pending?.opponentId && state.pending.kind !== 'shidou' ? state.players[state.pending.opponentId] : null;
  if (opponent) state.pending.level = levelOf(state, opponent);
  return state;
}

/** プレイヤーの対局の相手・Lv・先後・戦法。 */
function setPending(state, game, rng) {
  const opponentId = game.a === PRO_USER_ID ? game.b : game.a;
  const opponent = state.players[opponentId];
  // 相手のLv(大会の世界の物差し)は、棋士の写しに書かず、pendingに持つ(保存から戻しても同じ。対局画面は`proYearSeason`で付ける)。
  const level = levelOf(state, opponent);
  // 番勝負は、局ごとに先後を入れ替える(第1局は振り駒)。ほかは振り駒。
  const color = game.a === PRO_USER_ID ? 'black' : 'white';
  const style = opponent.repertoire ? pickGameStyle(rng, opponent.repertoire, { color: color === 'black' ? 'white' : 'black' }) : opponent.style ?? null;
  const event = proEvent(game.event);
  const cycle = state.cycles[game.cycle];
  const stage = cycle.stages[game.stage];
  const def = event.stages[game.stage];
  // 同じ回戦のほかの対局(もう決まっている。対局中の速報に使う。多くて12局)。
  const others = (stage.rounds[game.round] ?? []).map((id) => state.games[id])
    .filter((entry) => entry && entry.id !== game.id && entry.winner)
    .slice(0, 12)
    .map((entry) => ({ a: entry.a, b: entry.b, winner: entry.winner === 'a' ? entry.a : entry.b }));
  state.pending = {
    kind: def.title ? 'finals' : 'game',
    gameId: game.id,
    // 持ち時間の決まり(time-control.mjsのPRO_EVENT_RULES)を引く、棋戦と段階のid。
    eventId: game.event,
    stageId: def.id,
    opponentId,
    level,
    color,
    style,
    label: game.label,
    eventText: event.name,
    titleName: event.short,
    twoDay: Boolean(game.twoDay),
    date: game.date,
    stakes: { text: stakesText(state, cycle, stage, def), goal: '', win: '', boss: Boolean(def.title || def.type === 'series' || /決勝$/.test(game.label)) },
    // 番勝負は、これまでの星(タイトル戦の札と肩書。対局画面の`season.finals`)。
    series: stage.series ? {
      a: stage.series.a, b: stage.series.b, need: stage.series.need, wins: { ...stage.series.wins },
      games: stage.rounds.flat().map((id) => state.games[id]).filter((entry) => entry?.winner).map((entry) => ({ winner: entry.winner === 'a' ? entry.a : entry.b })),
    } : null,
    others: { games: others },
  };
  // 調子と対策★(13-3の3・4)。研究した戦法を相手が指してきたら「研究どおり」(閃きを1回足す)。
  const stars = starsFor(state.prep, opponentId);
  const hit = stars >= 1 && Boolean(style?.label) && Boolean(opponent.repertoire) && repertoireText(opponent.repertoire).includes(style.label);
  state.pending.prep = { stars, hit };
  state.pending.condition = clampCondition(state.condition ?? CONDITION_DEFAULT);
  // 羽音と会った週の閃き・羽音との絆の段5(15-3の2・3)。
  const vsHanane = opponent?.story === HANANE;
  const hananeBonus = vsHanane ? Math.min(1, state.user.hananeHint ?? 0) + (hasPerk(state, 'hanane') ? 1 : 0) : 0;
  state.pending.hintBonus = conditionHintBonus(state.pending.condition) + (hit ? 1 : 0) + hananeBonus;
  if (hananeBonus) state.pending.hananeBonus = hananeBonus;
  state.pending.weight = gameWeight(state, game);
}

function stakesText(state, cycle, stage, def) {
  const event = proEvent(cycle.event);
  if (def.title) return `${event.short}のタイトルをかけて`;
  if (def.type === 'series') return def.need === 1 ? '勝てば挑戦者' : `${def.need}勝で${event.kind === 'open' ? '優勝' : '挑戦者'}`;
  if (def.type === 'junni') return `${CLASS_NAMES[stage.cls]}・昇級は上位${CLASS_RULES[stage.cls]?.promote ?? 0}人`;
  const next = event.stages[stage.index + 1];
  if (!next) return '勝ち抜けば優勝';
  return next.title ? '勝ち抜けば挑戦者' : `勝ち抜けば${next.label}へ`;
}

/**
 * 対局画面の期の形(`tournamentSeasonOf`が返す。pending・相手のLvを付けた棋士・設定)。
 * @param {any} state
 */
export function proYearSeason(state) {
  if (!state?.pending) return state ?? null;
  // 将棋まつりの指導対局の相手は、1年の棋士でない(参加者。pending.guest)。
  const opponent = state.players[state.pending.opponentId] ?? state.pending.guest ?? null;
  return {
    ...state,
    no: state.fy,
    finals: state.pending.kind === 'finals' ? state.pending.series : null,
    players: { ...state.players, [state.pending.opponentId]: { ...opponent, level: state.pending.level } },
  };
}

/**
 * 次のプレイヤーの対局まで進める(あいだの対局はすべて決まる)。対局がなければ年度の終わりまで。
 * @returns {any} 新しい状態
 */
export function advanceToNextGame(source) {
  const state = structuredClone(source);
  // まつりの途中は進めない(まつりを終えてから)。
  if (state.pending || state.yearDone || state.festival) return state;
  const rng = createRng(state.rng);
  const stopped = run(state, yearEnd(state.fy), rng);
  if (!stopped) {
    state.date = yearEnd(state.fy);
    state.yearDone = true;
    state.summary = yearSummary(state);
  }
  state.rng = rng.state;
  return state;
}

/**
 * プレイヤーの対局を記録する(千日手は指し直し)。auto=trueは、分身に任せた(世界の物差しの分身の強さの勝率で決める)。
 * @param {any} source
 * @param {'win' | 'loss' | 'draw' | 'auto'} outcome
 */
/** 絆を足す(段が上がったら週のまとめの1行。場面は次に今週の画面を開いたとき。15-3の3)。 */
function bond(state, id, amount) {
  if (!id || !state.bonds?.[id]) return null;
  const { bonds, up } = addBond(state.bonds, id, amount);
  state.bonds = bonds;
  if (up) noteWeek(state, 'bond', `${nameOf(state, id)}との絆が段${up.to}に`);
  return up;
}

/** 自分の段位を実績に合わせる(上がったらニュースと週のまとめ。15-3の5)。 */
function checkDan(state) {
  const me = state.players[PRO_USER_ID];
  if (!me) return null;
  const before = me.dan ?? '四段';
  const after = danFor({ dan: before, group: state.user.group, cls: state.user.cls, titles: state.user.titleCounts ?? {}, sinceWins: state.user.sinceWins ?? 0 });
  if (after === before) return null;
  me.dan = after;
  state.user.sinceWins = 0;
  state.user.danLog = [...(state.user.danLog ?? []), { dan: after, date: state.date, fy: state.fy }].slice(-10);
  noteEvent(state, { kind: 'danUp', dan: after, name: state.userName || 'あなた' });
  noteWeek(state, 'dan', `${after}に昇段`);
  bond(state, state.people?.mentor, BOND_SMALL);
  return { from: before, to: after };
}

export function recordProGame(source, outcome, { way = 'full' } = {}) {
  const state = structuredClone(source);
  const pending = state.pending;
  // 研究会・将棋まつりの対局(公式戦でない)は、それぞれの記録(`recordStudyGame`など)で。
  if (!pending?.gameId) return { state, replay: false };
  if (outcome === 'draw') {
    state.pending = { ...pending, color: pending.color === 'black' ? 'white' : 'black', replay: true };
    return { state, replay: true };
  }
  const rng = createRng(state.rng);
  const game = state.games[pending.gameId];
  let won = outcome === 'win';
  if (outcome === 'auto') {
    // 分身の強さに、調子と対策を足す(13-3の3・4)。
    const me = state.players[PRO_USER_ID];
    const bonus = autoRatingBonus(state.condition ?? CONDITION_DEFAULT, pending.prep?.stars ?? 0) + avatarEdge(state.avatar);
    won = simulateMemberGame(rng, { ...me, rating: me.rating + bonus }, state.players[pending.opponentId]).aWins;
    game.auto = true;
  }
  game.winner = (game.a === PRO_USER_ID) === won ? 'a' : 'b';
  const gameCycle = state.cycles[game.cycle];
  const gameStage = gameCycle.stages[game.stage];
  // 対局料は、分身に任せた局にも出る(棋士として出た局のため。10-2の3)。
  const fee = feeOf(gameCycle, gameStage, gameStage.blocks?.[game.k ?? 0]?.group ?? null);
  const moneyBefore = state.user.money ?? 0;
  countRecord(state, won ? PRO_USER_ID : pending.opponentId, won ? pending.opponentId : PRO_USER_ID, fee);
  // 羽音との通算(年度をまたいで数える。対局前の羽音の一言に使う)。
  if (state.players[pending.opponentId]?.story === HANANE) {
    const vs = state.user.vsHanane ?? { wins: 0, losses: 0 };
    state.user.vsHanane = won ? { ...vs, wins: vs.wins + 1 } : { ...vs, losses: vs.losses + 1 };
  }
  state.pending = null;
  state.lastGame = { id: game.id, won, auto: outcome === 'auto' };
  // 公式戦で当たった同期・兄弟子との絆(15-3の2)。羽音と会って足した閃きは、この1局で使い切る。
  if (roleOf(state.people, pending.opponentId) && roleOf(state.people, pending.opponentId) !== 'mentor') bond(state, pending.opponentId, BOND_SMALL);
  if (state.players[pending.opponentId]?.story === HANANE) state.user.hananeHint = 0;
  // 調子(1局で−1・二日制は−2・勝てば＋1)と対策(同じ相手との番勝負の続きだけ残す)。13-3の3・4。
  const conditionBefore = clampCondition(state.condition ?? CONDITION_DEFAULT);
  state.condition = conditionAfterGame(conditionBefore, { won, twoDay: Boolean(game.twoDay) });
  const seriesGoesOn = Boolean(gameStage.series) && !gameStage.done;
  if (!seriesGoesOn) state.prep = { id: null, stars: 0 };
  noteWeek(state, 'game', `${game.label} ${nameOf(state, pending.opponentId)}に${won ? '勝ち' : '負け'}${outcome === 'auto' ? '（分身）' : way === 'cut' ? '（勝負どころから）' : ''}`);
  // 分身は、あなたが指した対局から学ぶ(任せた対局では育たない。14-3の2)。
  if (outcome !== 'auto') grow(state, mergeGains(way === 'cut' ? AVATAR_GAINS.gameCut : AVATAR_GAINS.gameFull, won ? AVATAR_GAINS.gameWin : {}));
  // ニュースの出来事(14-3の3)。
  const record = state.year.records[PRO_USER_ID] ?? { w: 0, streak: 0 };
  const isHanane = state.players[pending.opponentId]?.story === HANANE;
  if (isHanane) noteEvent(state, { kind: 'hanane', won });
  else if (won && record.w === 1 && !(state.history ?? []).length) noteEvent(state, { kind: 'firstWin' });
  else if (won && isStreakMark(record.streak)) noteEvent(state, { kind: 'streak', streak: record.streak, where: '' });
  else if (won && isWinsMark(record.w)) noteEvent(state, { kind: 'winsMark', wins: record.w });
  else noteEvent(state, { kind: won ? 'win' : 'loss', label: game.label });
  const challengeBefore = userInTitleSeries(state);
  const logBefore = state.logSeq ?? 0;
  const doneBefore = new Set(Object.values(state.cycles).filter((cycle) => cycle.done).map((cycle) => cycle.id));
  // その回戦のほかの対局はもう決まっているので、回戦を閉じて先へ。
  const cycle = state.cycles[game.cycle];
  const stage = cycle.stages[game.stage];
  closeRound(state, cycle, stage, rng);
  state.rng = rng.state;
  // この1局で決まった節目(予選突破・敗退・タイトル獲得)と、優勝した棋戦(賞状)。
  const milestones = (state.log ?? []).filter((item) => (item.n ?? 0) > logBefore);
  const champions = Object.values(state.cycles)
    .filter((entry) => entry.done && !doneBefore.has(entry.id) && entry.champion === PRO_USER_ID)
    .map((entry) => {
      const mine = Object.values(state.games).filter((item) => item.cycle === entry.id && item.user && item.winner);
      const wins = mine.filter((item) => (item.winner === 'a') === (item.a === PRO_USER_ID)).length;
      const event = proEvent(entry.event);
      return { cycle: entry.id, event: entry.event, name: event.name, short: event.short, title: event.kind === 'title', fy: state.fy, wins, losses: mine.length - wins };
    });
  // タイトル獲得・棋戦優勝の回数(揮毫の言葉が増える。10-2の6)。
  if (champions.length) state.user.crowns = (state.user.crowns ?? 0) + champions.length;
  // 昇段(勝数規定・タイトル。15-3の5)。
  if (won) state.user.sinceWins = (state.user.sinceWins ?? 0) + 1;
  for (const champion of champions) if (champion.title) state.user.titleCounts = { ...(state.user.titleCounts ?? {}), [champion.event]: (state.user.titleCounts?.[champion.event] ?? 0) + 1 };
  // 棋戦優勝の回数(やこびノートの札と称号。17章)。
  // 同時に持ったタイトルの数のいちばん多いとき(称号の「○冠」。17章)。
  if (champions.some((champion) => champion.title)) {
    const holding = TITLE_EVENTS.filter((id) => state.titles[id] === PRO_USER_ID).length;
    state.user.bestCrowns = Math.max(Number(state.user.bestCrowns) || 0, holding);
  }
  for (const champion of champions) if (!champion.title) state.user.cupCounts = { ...(state.user.cupCounts ?? {}), [champion.event]: (state.user.cupCounts?.[champion.event] ?? 0) + 1 };
  checkDan(state);
  // 節目のニュース(優勝・タイトル・挑戦・本戦入り・昇級)。
  for (const champion of champions) noteEvent(state, champion.title ? { kind: 'crown', short: champion.short } : { kind: 'champion', name: champion.name });
  // 師匠への報告(優勝・タイトル・本戦入り)。
  if (champions.length || milestones.some((item) => item.kind === 'advance')) bond(state, state.people?.mentor, BOND_SMALL);
  if (!champions.length) {
    if (!challengeBefore && userInTitleSeries(state)) noteEvent(state, { kind: 'challenge', name: proEvent(game.event)?.name ?? '' });
    for (const item of milestones) {
      if (item.kind !== 'advance') continue;
      if (/昇級/.test(item.text)) noteEvent(state, { kind: 'promote', text: /竜王戦/.test(item.text) ? item.text.replace(/（.*）$/, '') : '' });
      else if (/突破/.test(item.text)) noteEvent(state, { kind: 'mainStage', text: item.text.replace(/を突破$/, '突破') });
    }
  }
  // この1局で達成した今年の目標(その場で判子。13-3の7)。
  const goalsDone = markGoals(state);
  return { state, replay: false, won, game: { ...game }, milestones, champions, fee, earned: (state.user.money ?? 0) - moneyBefore, goalsDone };
}

// ---- 研究会(10-2の5)

/** 研究会の顔ぶれ(羽音と、同期の若手2人。若い四段から)。 */
function studyMembers(state) {
  const hanane = Object.values(state.players).find((member) => member.story === HANANE);
  const young = pros(state).filter((member) => !member.story)
    .sort((a, b) => Number(isRookie(b)) - Number(isRookie(a)) || (a.age ?? 99) - (b.age ?? 99) || String(a.id).localeCompare(String(b.id)));
  return [hanane?.id, ...young.map((member) => member.id)].filter(Boolean).slice(0, STUDY_SIZE);
}
const emptyStudy = (state) => ({ members: studyMembers(state), turn: 0, records: {}, log: [], last: '', talk: null });

/** 自分の公式戦の日(2日制は1日目も。研究会はこの日を避ける)。 */
function userBusy(state) {
  const busy = new Set();
  for (const game of Object.values(state.games)) {
    if (!game.user) continue;
    busy.add(game.date);
    if (game.twoDay) busy.add(addDays(game.date, -1));
  }
  return busy;
}

/** 次の研究会の相手(順番に回る)。 */
const studyOpponentId = (state) => {
  const members = state.study?.members ?? [];
  return members.length ? members[(state.study.turn ?? 0) % members.length] : null;
};

/**
 * 寄り道の研究会(次の公式戦の前にあれば。10-2の5)。行かなくても何も失わない(D:9-2)。
 * @param {any} state
 * @param {{ date: string } | null} [preview] 次の公式戦の見込み(`previewNextGame`)。なければ年度の終わりまで
 */
export function studyOffer(state, preview = null) {
  if (!state?.study || state.pending || state.yearDone || state.festival) return null;
  const until = preview?.date ?? addDays(yearEnd(state.fy), 1);
  const from = state.study.last > state.date ? state.study.last : state.date;
  const date = studyDaysBetween(from, until, userBusy(state))[0];
  const opponentId = studyOpponentId(state);
  if (!date || !opponentId) return null;
  return { kind: 'study', date, dateText: dateLabel(date), opponent: card(state, opponentId), members: state.study.members.map((id) => card(state, id)) };
}

/**
 * 研究会に参加する: その日まで進めて(あいだの対局は決まる)、研究会の1人と平手の練習対局(公式の成績・対局料には入らない)。
 * @param {any} source
 * @param {string} date
 */
export function joinStudy(source, date) {
  const state = structuredClone(source);
  if (!state.study || state.pending || state.yearDone || !date || date <= state.date) return state;
  const rng = createRng(state.rng);
  // その日より前に自分の公式戦があれば、そこで止まる(研究会は次の公式戦の前だけなので、ふつうは起きない)。
  if (run(state, date, rng)) {
    state.rng = rng.state;
    return state;
  }
  openStudy(state, date, rng);
  state.rng = rng.state;
  return state;
}

/** 研究会の練習対局を始める(その日まで進めてから)。 */
function openStudy(state, date, rng) {
  state.date = date;
  const opponentId = studyOpponentId(state);
  const opponent = state.players[opponentId];
  const color = (state.study.turn ?? 0) % 2 === 0 ? 'black' : 'white';
  const style = opponent.repertoire ? pickGameStyle(rng, opponent.repertoire, { color: color === 'black' ? 'white' : 'black' }) : opponent.style ?? null;
  state.pending = {
    kind: 'study', gameId: null, opponentId, level: levelOf(state, opponent), color, style,
    label: STUDY_TEXT.label, eventText: STUDY_TEXT.eventText, titleName: '', twoDay: false, date,
    stakes: { text: STUDY_TEXT.stakes, goal: '', win: '', boss: false }, coachLine: STUDY_TEXT.coach, series: null, others: { games: [] },
  };
}

/** 研究会の練習対局をやめて帰る(その日の研究会は終わり)。 */
export function leaveStudy(source) {
  const state = structuredClone(source);
  if (state.pending?.kind !== 'study') return state;
  state.study.last = state.pending.date;
  state.pending = null;
  return state;
}

/**
 * 研究会の練習対局を記録する(公式の成績・対局料には入らない)。千日手は引き分けのまま。
 * @param {any} source
 * @param {'win' | 'loss' | 'draw'} outcome
 */
export function recordStudyGame(source, outcome) {
  const state = structuredClone(source);
  const pending = state.pending;
  if (pending?.kind !== 'study') return { state, won: false, line: '', text: '' };
  const id = pending.opponentId;
  const record = (state.study.records[id] ??= { w: 0, l: 0, d: 0 });
  if (outcome === 'win') record.w += 1;
  else if (outcome === 'loss') record.l += 1;
  else record.d += 1;
  const count = state.study.turn ?? 0;
  state.study.turn = count + 1;
  state.study.last = pending.date;
  state.study.log = [...(state.study.log ?? []), { date: pending.date, id, r: outcome }].slice(-24);
  const line = studyHananeLine({ won: outcome === 'win', draw: outcome === 'draw', vsHanane: state.players[id]?.story === HANANE, count });
  state.study.talk = { date: pending.date, line };
  state.pending = null;
  const text = `研究会で${nameOf(state, id)}に${outcome === 'win' ? '勝ち' : outcome === 'loss' ? '負け' : '引き分け'}`;
  noteMilestone(state, { event: 'study', kind: 'plain', text });
  noteWeek(state, 'study', text);
  // 研究会の経験は、同期との絆の段5で2倍(15-3の3)。指した相手との絆＋1。
  const studyGains = mergeGains(AVATAR_GAINS.study, outcome === 'win' ? AVATAR_GAINS.studyWin : {});
  grow(state, peerPerk(state) ? mergeGains(studyGains, studyGains) : studyGains);
  bond(state, id, BOND_SMALL);
  return { state, won: outcome === 'win', line, text };
}

/** 研究仲間の成績(公式戦で当たると、次の対局の札に出す。道具がなくても)。 */
function studyMate(state, id) {
  const record = state.study?.records?.[id];
  if (!record) return null;
  const member = state.players[id];
  return { wins: record.w, losses: record.l, draws: record.d ?? 0, repertoire: member?.repertoire ? repertoireText(member.repertoire) : member?.style?.label ?? '' };
}

// ---- 将棋まつり(10-2の6)

/** 文字列から決まる数(まつりの種)。 */
function festivalSeed(state, date) {
  let hash = 2166136261 ^ (state.seed ?? 0);
  for (const ch of date) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
  return hash >>> 0;
}

/** その年度のまつりの日(自分の公式戦の日は翌日)。 */
const yearFestivals = (state) => festivalDays(state.fy, userBusy(state));

/**
 * 寄り道の将棋まつり(次の公式戦の前にあれば)。行かなくても何も失わない(D:9-2)。
 * @param {any} state
 * @param {{ date: string } | null} [preview]
 */
export function festivalOffer(state, preview = null) {
  if (!state || state.pending || state.yearDone || state.festival) return null;
  const until = preview?.date ?? addDays(yearEnd(state.fy), 1);
  const visited = new Set((state.festivals ?? []).map((item) => item.date));
  const festival = yearFestivals(state).find((item) => item.date > state.date && item.date < until && !visited.has(item.date));
  if (!festival) return null;
  return { kind: 'festival', id: festival.id, date: festival.date, dateText: dateLabel(festival.date), name: festival.name, place: festival.place };
}

/**
 * 将棋まつりに行く: その日まで進めて(あいだの対局は決まる)、まつりの画面(催しを選ぶ)。
 * @param {any} source
 * @param {string} date
 */
export function joinFestival(source, date) {
  const state = structuredClone(source);
  if (state.pending || state.yearDone || state.festival || !date || date <= state.date) return state;
  const festival = yearFestivals(state).find((item) => item.date === date);
  if (!festival) return state;
  const rng = createRng(state.rng);
  if (run(state, date, rng)) {
    state.rng = rng.state;
    return state;
  }
  state.rng = rng.state;
  openFestival(state, festival);
  return state;
}

function openFestival(state, festival) {
  state.date = festival.date;
  state.festival = { id: festival.id, name: festival.name, place: festival.place, date: festival.date, seed: festivalSeed(state, festival.date), done: {}, fans: 0, startFans: state.user.fans ?? 0 };
}

/** まつりのファンを足す(まつりの記録と、あなたのファン)。 */
function addFans(state, fans) {
  state.festival.fans += fans;
  state.user.fans = (state.user.fans ?? 0) + fans;
}

/** 駒落ち指導対局を始める(あなたが上手=後手で先に指す。レーティングには数えない)。 */
export function startShidou(source) {
  const state = structuredClone(source);
  const festival = state.festival;
  if (!festival || state.pending || festival.done.shidou) return state;
  const guest = shidouGuest(festival, state.userLevel ?? 20);
  state.pending = {
    kind: 'shidou', gameId: null, opponentId: guest.id, guest, level: guest.level, color: 'white', style: null,
    handicap: guest.handicap, handicapGiver: 'player',
    label: `指導対局（${guest.handicapLabel}）`, eventText: festival.name, titleName: '', twoDay: false, date: festival.date,
    stakes: { text: '勝ち負けより、楽しんでもらおう', goal: '', win: '', boss: false },
    coachLine: `${guest.name}との指導対局だよ。あなたが上手で先に指すよ。勝ち負けより、楽しんでもらおう！`,
    series: null, others: { games: [] },
  };
  return state;
}

/**
 * 指導対局の結果(あなたから見た勝ち負け)。勝っても負けてもファンが増える(参加者が勝つと大喜び)。
 * @param {any} source
 * @param {'win' | 'loss' | 'draw'} outcome
 */
export function recordShidou(source, outcome) {
  const state = structuredClone(source);
  const pending = state.pending;
  // 指導の仕事の対局(14-3の1)。勝ち負けによらず同じ謝礼。
  if (pending?.kind === 'shidou' && pending.work) {
    state.pending = null;
    const settled = settleWork(state, { score: 0 });
    const text = outcome === 'loss' ? `${pending.guest?.name ?? 'お客'}が大喜び` : `${pending.guest?.name ?? 'お客'}と指導対局`;
    return { state, fans: settled.fans, text: `${text}・謝礼 ${settled.fee}万円` };
  }
  if (pending?.kind !== 'shidou' || !state.festival) return { state, fans: 0, text: '' };
  const fans = outcome === 'loss' ? SHIDOU_FANS.guestWon : outcome === 'win' ? SHIDOU_FANS.userWon : SHIDOU_FANS.draw;
  state.festival.done.shidou = { r: outcome, fans, name: pending.guest?.name ?? '' };
  addFans(state, fans);
  state.pending = null;
  const text = outcome === 'loss' ? `${pending.guest?.name ?? '参加者'}が大喜び` : `${pending.guest?.name ?? '参加者'}と指導対局`;
  return { state, fans, text };
}

/** 指導対局をやめる(始める前に戻る)。 */
export function cancelShidou(source) {
  const state = structuredClone(source);
  // 指導の仕事の対局をやめたら、仕事の札へ戻る(state.workは残る)。
  if (state.pending?.kind === 'shidou') state.pending = null;
  return state;
}

/**
 * まつりの催しの結果(ぐるぐる指導・トークショー・揮毫)。
 * @param {any} source
 * @param {'simul' | 'talk' | 'kigou'} id
 * @param {{ wins?: number, losses?: number, draws?: number, reactions?: string[], word?: string }} result
 */
export function recordFestivalEvent(source, id, result) {
  const state = structuredClone(source);
  const festival = state.festival;
  if (!festival || festival.done[id]) return { state, fans: 0 };
  let fans = 0;
  if (id === 'simul') {
    const boards = (result.wins ?? 0) + (result.losses ?? 0) + (result.draws ?? 0);
    fans = SIMUL_FANS.perBoard * boards + ((result.wins ?? 0) >= 3 ? SIMUL_FANS.sweep : 0);
    festival.done.simul = { wins: result.wins ?? 0, losses: result.losses ?? 0, draws: result.draws ?? 0, fans };
  } else if (id === 'talk') {
    fans = talkFans(result.reactions);
    festival.done.talk = { reactions: [...(result.reactions ?? [])], fans };
  } else if (id === 'kigou') {
    const word = kigouWords(state.user.crowns).find((entry) => entry.open && entry.word === result.word)?.word;
    if (!word) return { state, fans: 0 };
    fans = KIGOU_FANS;
    festival.done.kigou = { word, fans };
    state.kigou = [...(state.kigou ?? []), { date: festival.date, word, place: festival.name }].slice(-KIGOU_BOOK_MAX);
  } else {
    return { state, fans: 0 };
  }
  addFans(state, fans);
  return { state, fans };
}

/** まつりを終える: 謝礼(基本＋催しごと。ファンが多いほど基本が増える)を受け取り、1年の画面へ戻る。 */
export function finishFestival(source) {
  const state = structuredClone(source);
  const festival = state.festival;
  if (!festival || state.pending) return { state, fee: 0, fans: 0 };
  const done = Object.keys(festival.done);
  const fee = festivalFee(festival.startFans ?? 0, done.length);
  earn(state, PRO_USER_ID, fee, 'gig');
  state.festivals = [...(state.festivals ?? []), { date: festival.date, id: festival.id, fee, fans: festival.fans, done }].slice(-30);
  noteMilestone(state, { event: 'festival', kind: 'plain', text: `${festival.name}（謝礼 ${fee}万円・ファン＋${festival.fans}）` });
  state.festival = null;
  // 遠出の疲れで調子が1段下がる(13-3の2)。
  state.condition = clampCondition((state.condition ?? CONDITION_DEFAULT) - 1);
  noteWeek(state, 'festival', `${festival.name}（謝礼 ${fee}万円）`);
  grow(state, AVATAR_GAINS.festival);
  return { state, fee, fans: festival.fans };
}

/** まつりの画面の形(催しの札・いまの謝礼の見込み・参加者・揮毫の言葉)。 */
function festivalView(state) {
  const festival = state.festival;
  if (!festival) return null;
  const done = Object.keys(festival.done);
  return {
    name: festival.name,
    place: festival.place,
    date: festival.date,
    dateText: dateLabel(festival.date),
    fans: festival.fans,
    fee: festivalFee(festival.startFans ?? 0, done.length),
    feePerEvent: 5,
    events: FESTIVAL_EVENTS.map((entry) => ({ ...entry, done: festival.done[entry.id] ?? null })),
    guest: shidouGuest(festival, state.userLevel ?? 20),
    simul: simulGuests(festival),
    // ぐるぐる指導で一緒に回る棋士2人(11章)。
    simulPartners: simulPartners(festival, Object.values(state.players ?? {}).filter((member) => member?.id !== PRO_USER_ID)),
    words: kigouWords(state.user.crowns),
    seed: festival.seed,
  };
}

// ---- 年度

/** 年度の記録(年間成績・獲得の合計・プレイヤーの獲得の内訳)。 */
const emptyYear = () => ({ records: {}, earn: {}, mine: { fee: 0, prize: 0, gig: 0 } });

/**
 * 年間の獲得賞金・対局料の順位(10-2の3)。上位の行と、自分の近く(自分と前後1人。D:5-6 少し上の目標)。
 * @returns {{ top: any[], near: any[], rank: number, size: number, amount: number }}
 */
export function earningsRanking(state, { top = 10 } = {}) {
  const earn = state?.year?.earn ?? {};
  const ids = Object.keys(state?.players ?? {}).filter((id) => state.players[id]?.kind === 'pro' || id === PRO_USER_ID);
  const rows = ids
    .map((id) => ({ id, name: nameOf(state, id), amount: earn[id] ?? 0, you: id === PRO_USER_ID, story: state.players[id]?.story ?? null }))
    .sort((a, b) => b.amount - a.amount || Number(b.you) - Number(a.you) || String(a.id).localeCompare(String(b.id)))
    .map((row, index) => ({ ...row, rank: index + 1 }));
  const index = rows.findIndex((row) => row.you);
  const near = index >= top ? rows.slice(Math.max(top, index - 1), index + 2) : [];
  return { top: rows.slice(0, top), near, rank: index + 1, size: rows.length, amount: earn[PRO_USER_ID] ?? 0 };
}

/**
 * 研究の道具を買う(10-2の4)。お金が足りなければ、そのまま返す。
 * @param {any} source
 * @returns {{ state: any, bought: any | null }}
 */
export function buyGear(source) {
  const state = structuredClone(source);
  const item = nextGear(state.user.gear ?? 0, state.user.money ?? 0);
  if (!item?.affordable) return { state, bought: null };
  state.user.money -= item.price;
  state.user.gear = item.level;
  noteMilestone(state, { event: 'life', kind: 'plain', text: `${item.name}を買った` });
  return { state, bought: GEAR.find((entry) => entry.level === item.level) ?? null };
}

/** 年度の期を作る(その年度に始まる期)。 */
function openYear(state, fy, rng) {
  for (const event of PRO_EVENTS) {
    const id = cycleId(event.id, fy);
    if (!state.cycles[id]) {
      const cycle = makeCycle(state, event, fy);
      cycle.holder = state.titles[event.id] ?? null;
      state.cycles[id] = cycle;
    }
  }
}

/** 年度のまとめ(年間成績・将棋大賞の記録部門・順位戦)。 */
export function yearSummary(state) {
  const records = state.year.records;
  const mine = records[PRO_USER_ID] ?? { w: 0, l: 0, streak: 0, best: 0 };
  const others = Object.entries(records).filter(([id]) => id !== PRO_USER_ID).map(([, record]) => record);
  const max = (key) => Math.max(0, ...others.map(key));
  const games = mine.w + mine.l;
  const rate = games ? mine.w / games : 0;
  const awards = [];
  if (games && games >= max((record) => record.w + record.l)) awards.push('最多対局賞');
  if (mine.w && mine.w >= max((record) => record.w)) awards.push('最多勝利賞');
  if (games >= 30 && rate >= max((record) => (record.w + record.l >= 30 ? record.w / (record.w + record.l) : 0))) awards.push('勝率一位賞');
  if (mine.best && mine.best >= max((record) => record.best)) awards.push('連勝賞');
  const titles = Object.entries(state.titles).filter(([, holder]) => holder === PRO_USER_ID).map(([id]) => proEvent(id)?.short ?? id);
  // 同期の羽音の1年(年間成績と、この年度の直接対決)。
  const hanane = Object.values(state.players).find((member) => member.story === HANANE);
  let rival = null;
  if (hanane) {
    const record = records[hanane.id] ?? { w: 0, l: 0 };
    const meetings = Object.values(state.games).filter((game) => game.user && game.winner && game.date >= yearStart(state.fy) && [game.a, game.b].includes(hanane.id));
    const won = meetings.filter((game) => (game.winner === 'a') === (game.a === PRO_USER_ID)).length;
    rival = { name: hanane.name, wins: record.w, losses: record.l, meetings: [won, meetings.length - won] };
  }
  const ranking = earningsRanking(state);
  const money = { ...(state.year.mine ?? { fee: 0, prize: 0, gig: 0 }), earned: ranking.amount, rank: ranking.rank, size: ranking.size, top10: ranking.rank <= 10 };
  if (money.top10 && money.earned > 0) awards.push('獲得賞金ランキング10位以内');
  // 今年の目標の判子(達成・あと一歩・届かず)。
  const goals = state.goals?.ids?.length ? goalProgress({ ...state, yearDone: true }).map((goal) => ({ ...goal, stamp: goalStamp(goal) })) : [];
  const headlines = yearHeadlines((state.news ?? []).filter((item) => item.fy === state.fy));
  // 棋士の歩みの行(15-3の7): 段・クラス・組・優勝した棋戦と、来期に決まる昇段の見込み。
  const champions = Object.values(state.cycles)
    .filter((cycle) => cycle.done && cycle.champion === PRO_USER_ID && proEvent(cycle.event)?.kind !== 'title' && Object.values(state.games).some((game) => game.cycle === cycle.id && game.user && game.date >= yearStart(state.fy)))
    .map((cycle) => proEvent(cycle.event).name);
  const dan = state.players[PRO_USER_ID]?.dan ?? '四段';
  const junni = state.user.junniResult ?? null;
  const ryuo = state.user.ryuoResult ?? null;
  const nextCls = junni?.promoted ? NEXT_CLASS[junni.cls] ?? junni.cls : state.user.cls;
  const nextGroup = ryuo?.next ?? state.user.group;
  const projected = danFor({ dan, group: nextGroup, cls: nextCls, titles: state.user.titleCounts ?? {}, sinceWins: state.user.sinceWins ?? 0 });
  const startDan = state.user.danAtStart ?? dan;
  return {
    fy: state.fy, wins: mine.w, losses: mine.l, rate, best: mine.best, awards, titles, junni, rival, money, goals, headlines,
    dan: projected, danUp: projected !== startDan ? { from: startDan, to: projected } : null,
    cls: state.user.cls, clsText: `${CLASS_NAMES[state.user.cls] ?? ''}${junni?.promoted ? ' 昇級' : ''}`, group: ryuo?.group ?? state.user.group, groupUp: Boolean(ryuo?.promoted), champions,
  };
}

const NEXT_CLASS = Object.freeze({ C2: 'C1', C1: 'B2', B2: 'B1', B1: 'A', A: 'A' });

/** 次の年度へ(順位戦のクラス・竜王戦の組・シードを持ち越す)。 */
export function startNextYear(source) {
  const state = structuredClone(source);
  if (!state.yearDone) return state;
  const rng = createRng(state.rng);
  const result = state.user.junniResult;
  if (result?.promoted) state.user.cls = NEXT_CLASS[result.cls] ?? result.cls;
  state.user.junniResult = null;
  // 竜王戦の組(ランキング戦の結果)と、それで決まる昇段(15-3の5)。
  if (state.user.ryuoResult) state.user.group = state.user.ryuoResult.next;
  state.user.ryuoResult = null;
  state.history = [...(state.history ?? []), state.summary].slice(-20);
  state.fy += 1;
  state.date = yearStart(state.fy);
  state.year = emptyYear();
  state.yearDone = false;
  state.summary = null;
  // 終わった期の対局は消す(表の要約は段階に残る)。
  for (const [id, game] of Object.entries(state.games)) {
    if (state.cycles[game.cycle]?.done && game.date < yearStart(state.fy)) delete state.games[id];
  }
  for (const [id, cycle] of Object.entries(state.cycles)) {
    if (cycle.done && cycle.base < state.fy - 1) delete state.cycles[id];
  }
  openYear(state, state.fy, rng);
  // 新しい年度の週と目標(目標は年度の始めに選び直す。13-3の7)。
  state.goals = null;
  state.prep = { id: null, stars: 0 };
  state.interview = null;
  state.news = [];
  state.week = newWeek(state, state.date);
  state.user.danAtStart = state.players[PRO_USER_ID]?.dan ?? '四段';
  checkDan(state);
  state.rng = rng.state;
  return state;
}

/**
 * 棋士の1年を始める(新四段のデビュー)。
 * @param {{ seed: number, fiscalYear: number, roster: any, settings?: any, userLevel?: number, userName?: string, userGroup?: number, mentorName?: string }} options
 */
export function createProYear({ seed, fiscalYear, roster, settings = {}, userLevel = 20, userName = '', userGroup = 6, mentorName = '' }) {
  const rng = createRng(seed);
  const players = {};
  for (const member of Object.values(roster?.players ?? {})) {
    if (member.kind === 'pro') players[member.id] = copyMember(member);
  }
  const world = Number.isFinite(settings.world) ? settings.world : recommendedWorldLevel(userLevel);
  players[PRO_USER_ID] = {
    id: PRO_USER_ID, name: userName || 'あなた', kind: 'pro', dan: '四段', group: userGroup, rating: worldRating(userLevel, world), age: 18, story: null, you: true,
  };
  // 羽音は、プレイヤーと同じ年度の新四段(3章の13)。竜王戦の組と順位戦のクラスもプレイヤーと同じところから。
  const hanane = Object.values(players).find((member) => member.story === HANANE);
  if (hanane) {
    hanane.dan = '四段';
    hanane.group = clamp(Math.round(userGroup), 1, 6);
  }
  const fresh = new Set([PRO_USER_ID, hanane?.id].filter(Boolean));
  const titles = {};
  for (const event of TITLE_EVENTS) {
    const holder = event === 'ryuo' ? roster?.holder : roster?.titles?.[event];
    titles[event] = holder && !fresh.has(holder) && players[holder] ? holder : byRating(Object.values(players).filter((member) => !fresh.has(member.id)))[0]?.id ?? null;
  }
  const junniWorld = junniClasses(roster);
  const userClass = Object.entries(junniWorld).find(([, ids]) => ids.includes(PRO_USER_ID))?.[0] ?? 'C2';
  for (const cls of Object.keys(junniWorld)) junniWorld[cls] = junniWorld[cls].filter((id) => !fresh.has(id));
  if (hanane) junniWorld[userClass] = [...(junniWorld[userClass] ?? []), hanane.id];
  const state = {
    version: 1,
    seed,
    rng: 0,
    startFy: fiscalYear,
    fy: fiscalYear,
    debut: yearStart(fiscalYear),
    // 準備のあいだは、前の年度の始めから(デビュー前の対局を日付の順に決める)。
    date: yearStart(fiscalYear - 1),
    userName,
    userLevel,
    settings: { ...settings, world },
    players,
    titles,
    junni: junniWorld,
    user: { cls: userClass, group: clamp(Math.round(userGroup), 1, 6), seeds: {}, money: 0, gear: 0, fans: 0, crowns: 0, sinceWins: 0, titleCounts: {}, danAtStart: '四段' },
    cycles: {},
    games: {},
    nextGame: 1,
    pending: null,
    year: emptyYear(),
    yearDone: false,
    summary: null,
    history: [],
    log: [],
  };
  // デビュー前に始まった期(前の年度)から作る。番勝負やリーグは、この年度の中を日付どおりに進む。
  openYear(state, fiscalYear - 1, rng);
  openYear(state, fiscalYear, rng);
  run(state, addDays(state.debut, -1), rng);
  state.date = state.debut;
  state.year = emptyYear();
  state.user.money = 0;
  state.study = emptyStudy(state);
  // 5人(師匠・兄弟子・同期3人)と絆(15-3の1・3)。
  state.people = pickPeople(state.players, { seed, mentorName, studyMembers: state.study.members, userId: PRO_USER_ID });
  state.bonds = emptyBonds(state.people);
  state.log = [];
  state.condition = CONDITION_DEFAULT;
  state.prep = { id: null, stars: 0 };
  // 分身・ニュース・ファンレター・取材・仕事(14章)。
  state.avatar = emptyAvatar();
  state.news = [];
  state.letters = [];
  state.interview = null;
  state.work = null;
  state.week = newWeek(state, state.debut);
  state.rng = rng.state;
  return state;
}

// ---- 1週を選んで過ごす(13章)

/**
 * 新しい週。行動は、先週選んだもの(carry)を持ち越して始める(16-3の1)。
 * 実際の行動は、週を見る・選ぶ・進めるときに`seedWeek`が今週に合わせて入れる。
 * @param {any} state
 * @param {string} date
 * @param {(string | null)[] | null} [carry] 先週の行動(なければ、おすすめで始める)
 */
function newWeek(state, date, carry = null) {
  const range = weekRange(date, state.fy);
  return {
    start: range.start, end: range.end, actions: [], carry: Array.isArray(carry) ? [...carry] : null, seeded: false, marks: [], applied: false, stops: [], log: [], cond0: clampCondition(state.condition ?? CONDITION_DEFAULT),
    events: [], gains: {}, fans0: state.user?.fans ?? 0, quote: null,
  };
}

/** 今週の出来事(ニュースの見出しの元。14-3の3)。 */
function noteEvent(state, event) {
  if (!state.week) return;
  state.week.events = [...(state.week.events ?? []), event].slice(-20);
}

/** 分身に経験を足す(14-3の2)。Lvが上がった能力は週のまとめの1行に。 */
function grow(state, gains) {
  if (!gains || !Object.keys(gains).length) return [];
  const { avatar, ups } = gainAvatar(state.avatar, gains);
  state.avatar = avatar;
  if (state.week) state.week.gains = mergeGains(state.week.gains, gains);
  for (const up of ups) noteWeek(state, 'avatar', `分身の${up.label}がLv${up.to}に`);
  return ups;
}

/** どれかのタイトル戦の本戦・リーグに入ったか(解説の仕事が開く条件の1つ。目標の判定と同じ)。 */
function reachedMainStage(state) {
  return Object.values(state.games).some((game) => game.user && proEvent(game.event)?.kind === 'title'
    && ['knockout', 'league'].includes(proEvent(game.event)?.stages?.[game.stage]?.type));
}

/** プレイヤーがタイトルの番勝負に出ているか(挑戦が決まったかの判定)。 */
function userInTitleSeries(state) {
  return Object.values(state.cycles).some((cycle) => {
    const stage = cycle.stages?.[cycle.stage];
    return !cycle.done && stage?.started !== false && proEvent(cycle.event)?.stages?.[stage?.index ?? -1]?.title
      && (stage.series?.a === PRO_USER_ID || stage.series?.b === PRO_USER_ID);
  });
}

/** 解説の仕事が開いているか(ファン300人か、本戦・リーグ入り)。 */
function kaisetsuOpen(state) {
  return (state.user?.fans ?? 0) >= KAISETSU_FANS || reachedMainStage(state);
}

/** 解説の仕事で見る注目局(この2週に決着した、ほかの棋士どうしの対局。タイトル戦を先に)。 */
function kaisetsuGame(state, weekStart) {
  const from = addDays(weekStart, -14);
  const games = Object.values(state.games).filter((game) => !game.user && game.winner && game.rec && game.date >= from && game.date < weekStart);
  const titleOf = (game) => (proEvent(game.event)?.stages?.[game.stage]?.title ? 1 : 0);
  return games.sort((a, b) => titleOf(b) - titleOf(a) || b.date.localeCompare(a.date) || String(a.id).localeCompare(String(b.id)))[0] ?? null;
}

/** 今週の出来事を1行残す(週のまとめ)。 */
function noteWeek(state, kind, text) {
  if (!state.week) return;
  state.week.log = [...(state.week.log ?? []), { kind, text }].slice(-12);
}

/** 週の中のプレイヤーの公式戦(決まっていないもの。見込みの次の対局も入れる)。 */
function weekUserGames(state, preview) {
  const { start, end } = state.week;
  const games = Object.values(state.games).filter((game) => game.user && !game.winner && game.date >= start && game.date <= end)
    .map((game) => ({ id: game.id, date: game.date, label: game.label, opponentId: game.a === PRO_USER_ID ? game.b : game.a, twoDay: Boolean(game.twoDay) }));
  if (preview && preview.date >= start && preview.date <= end && !games.some((game) => game.id === preview.gameId)) {
    games.push({ id: preview.gameId, date: preview.date, label: preview.label, opponentId: preview.opponentId, twoDay: Boolean(preview.twoDay) });
  }
  return games.sort((a, b) => a.date.localeCompare(b.date));
}

/** 今週の研究会の日(行けるもの)。 */
function weekStudyDay(state) {
  if (!state.study?.members?.length) return null;
  const { start, end } = state.week;
  const from = [addDays(start, -1), state.study.last ?? '', addDays(state.date, -1)].sort().pop();
  return studyDaysBetween(from, addDays(end, 1), userBusy(state)).find((day) => day >= start && day <= end && day >= state.date) ?? null;
}

/** 今週の将棋まつり(行けるもの)。 */
function weekFestival(state) {
  const { start, end } = state.week;
  const visited = new Set((state.festivals ?? []).map((item) => item.date));
  return yearFestivals(state).find((item) => item.date >= start && item.date <= end && item.date >= state.date && !visited.has(item.date)) ?? null;
}

/**
 * 絆の場面を見た印(15-3の4)。
 * @param {any} source
 * @param {string} id 人のid
 * @param {number} level 段
 */
export function seeBondScene(source, id, level) {
  if (!source?.bonds?.[id]) return source;
  return { ...source, bonds: markBondScene(source.bonds, id, level) };
}

/** 5人の札(人の1行とシート。15-3の1・3)。 */
export function peopleView(state) {
  return BOND_ROLES.map((role) => {
    const id = state?.people?.[role];
    if (!id || !state.players?.[id]) return null;
    const points = state.bonds?.[id]?.points ?? 0;
    const level = bondLevel(points);
    const next = bondNext(points);
    const def = BOND_DEFS[role];
    return {
      role, id, rel: def.rel, name: nameOf(state, id), dan: state.players[id].dan ?? '', story: state.players[id].story ?? null, icon: def.icon || nameOf(state, id).slice(0, 1),
      level, points, next, perk: def.perk, perkOn: level >= 5, meet: def.meet, effect: def.effect,
      // 次の場面まで(段2〜5のうち場面のある段)。
      nextScene: def.scenes.find((at) => at > level) ?? null,
    };
  }).filter(Boolean);
}

/**
 * 今週の画面の形(13-3の1・2・9)。
 * @param {any} state
 */
export function weekView(source) {
  if (!source?.week || source.yearDone) return null;
  // 前の進め方(次の対局日へ)で週を越えていたら、今の日の週として見る。
  const state = source.week.end < source.date && !source.pending ? { ...source, week: newWeek(source, source.date, carryOf(source.week)) } : source;
  const week = state.week;
  const preview = state.pending?.gameId
    ? { date: state.pending.date, label: state.pending.label, opponentId: state.pending.opponentId, gameId: state.pending.gameId, twoDay: state.pending.twoDay }
    : previewNextGame(state);
  const games = weekUserGames(state, preview);
  const slots = weekSlots(games.reduce((sum, game) => sum + (game.twoDay ? 2 : 1), 0));
  const study = weekStudyDay(state);
  const festival = weekFestival(state);
  const nextOpponent = preview?.opponentId ?? null;
  const gear = state.user.gear ?? 0;
  const stars = nextOpponent ? starsFor(state.prep, nextOpponent) : 0;
  const capExtra = hasPerk(state, 'senior') ? 1 : 0;
  const condition = clampCondition(state.condition ?? CONDITION_DEFAULT);
  const actions = [];
  // 右の効き目と、分身の経験(14-3の2)。
  const avatarText = (gains) => (gains ? `分身：${gainsText(gains)}` : '');
  if (nextOpponent) actions.push({ ...WEEK_ACTIONS.research, target: card(state, nextOpponent), effect: stars >= prepCap(gear, capExtra) ? `対策 ★${stars}（いまの道具では上限）` : `対策 ★${stars} → ★${researched(state.prep, nextOpponent, gear, capExtra).stars}`, full: stars >= prepCap(gear, capExtra), grow: avatarText(AVATAR_GAINS.research) });
  actions.push({ ...WEEK_ACTIONS.rest, effect: condition >= CONDITION_LABELS.length - 1 ? '調子はもういちばん上' : `調子 ${CONDITION_LABELS[condition]} → ${CONDITION_LABELS[clampCondition(condition + 1)]}`, grow: avatarText(AVATAR_GAINS.rest) });
  if (study) actions.push({ ...WEEK_ACTIONS.study, date: study, dateText: dateLabel(study), effect: '研究仲間の対策 ★1', grow: avatarText(AVATAR_GAINS.study) });
  if (festival) actions.push({ ...WEEK_ACTIONS.festival, date: festival.date, dateText: dateLabel(festival.date), name: festival.name, effect: '謝礼とファン・調子−1', grow: avatarText(AVATAR_GAINS.festival) });
  // 仕事の依頼(14-3の1)。週に1つまで。
  const slotsNow = weekSlots(games.reduce((sum, game) => sum + (game.twoDay ? 2 : 1), 0));
  const open = kaisetsuOpen(state);
  const featured = open ? kaisetsuGame(state, week.start) : null;
  const offers = workOffers({ weekStart: week.start, seed: state.seed ?? 0, kaisetsuOpen: open, kaisetsuGame: featured, slots: slotsNow, lastWeek: week.end >= yearEnd(state.fy) });
  const works = [];
  for (const id of offers) {
    const def = WORKS[id];
    const date = addDays(weekRange(week.start, state.fy).monday, def.day);
    if (date < state.date || date > week.end || games.some((game) => game.date === date)) continue;
    const best = workReward(id, { score: def.scoreMax });
    const quick = workReward(id, { quick: true });
    works.push({
      id: `work-${id}`, work: id, label: def.title, icon: def.icon, note: `${def.client}・${def.note}`, date, dateText: dateLabel(date),
      effect: best.fee === quick.fee ? `${best.fee}万円・ファン＋${best.fans}` : `最大${best.fee}万円・ファン＋${quick.fans}〜`,
      grow: avatarText(def.gains), game: id === 'kaisetsu' ? featured?.id ?? null : null,
    });
  }
  actions.push(...works);
  // 人に会う(15-3の2)。週に1人まで。
  const meets = [];
  for (const role of BOND_ROLES) {
    const id = state.people?.[role];
    if (!id || !state.players[id]) continue;
    const def = BOND_DEFS[role];
    const points = state.bonds?.[id]?.points ?? 0;
    let effect = def.effect;
    if (role === 'senior') effect = nextOpponent ? `${nameOf(state, nextOpponent)}の対策 ★＋1` : '研究（次の相手が決まっていない）';
    else if ((role === 'mentor' || role.startsWith('peer')) && condition >= CONDITION_LABELS.length - 1) effect = '調子はもういちばん上';
    else if (role === 'hanane' && (state.user.hananeHint ?? 0) > 0) effect = '羽音戦の閃き＋1（もう足してある）';
    meets.push({
      id: `meet-${role}`, meet: role, person: card(state, id), label: `${def.rel}：${nameOf(state, id)}`, icon: def.icon || nameOf(state, id).slice(0, 1), note: def.meet,
      effect, grow: `${avatarText(def.gains)}・絆＋${BOND_MEET}`, rel: def.rel, level: bondLevel(points), next: bondNext(points),
    });
  }
  actions.push(...meets);
  // 解説の仕事の鍵(開く前だけ。あと何人で開くか。D:5-2)。
  const lockedWork = !open && offers.length ? { id: 'kaisetsu', label: WORKS.kaisetsu.title, icon: WORKS.kaisetsu.icon, need: KAISETSU_FANS - (state.user.fans ?? 0) } : null;
  const days = weekRange(week.start, state.fy).days.map((date) => ({
    date,
    dow: '日月火水木金土'[weekdayOf(date)],
    inYear: date >= yearStart(state.fy) && date <= yearEnd(state.fy),
    past: date < state.date,
    today: date === state.date,
    game: games.some((game) => game.date === date || (game.twoDay && addDays(game.date, -1) === date)),
    study: study === date,
    festival: festival?.date === date,
  }));
  return {
    number: weekNumber(week.start, state.fy),
    start: week.start,
    end: week.end,
    startText: dateLabel(week.start),
    endText: dateLabel(week.end),
    days,
    games: games.map((game) => ({ ...game, dateText: dateLabel(game.date), opponent: card(state, game.opponentId), stars: starsFor(state.prep, game.opponentId), weight: state.games[game.id] ? gameWeight(state, state.games[game.id]) : 'mid' })),
    slots,
    // 今週の行動(まだ選び直していなければ、先週の持ち越しとおまかせで埋めた形。16-3の1)。
    ...weekChoice(week, { slots, actions, condition, stars, cap: prepCap(gear, capExtra), canResearch: Boolean(nextOpponent) }),
    applied: Boolean(week.applied),
    actions,
    condition,
    conditionLabel: CONDITION_LABELS[condition],
    hintBonus: conditionHintBonus(condition),
    prep: nextOpponent ? { opponent: card(state, nextOpponent), stars, cap: prepCap(gear, capExtra) } : null,
    lastWeek: state.lastWeek ?? null,
    lockedWork,
    avatar: avatarView(state.avatar, week.gains ?? {}),
    people: peopleView(state),
    news: (state.news ?? []).at(-1) ?? null,
    interview: state.interview ?? null,
    work: state.work ?? null,
    // 自分の公式戦がもう残っていない・残りが順位戦だけ(年度を締められる。15-3の6)。
    seasonOver: !preview && !state.pending && !state.festival && !state.work,
    closable: closableKind(state, preview),
    weeksLeft: Math.max(0, Math.ceil(((toDate(yearEnd(state.fy)) - toDate(week.end)) / 86400000) / 7)),
  };
}

/** 週に1つまでの行動の仲間(研究会・まつりはそれぞれ1回、仕事と人に会うは種類で1つ)。同じ仲間ならtrue。 */
function sameKind(a, b) {
  if (!a || !b) return false;
  if (a === b) return a === 'study' || a === 'festival' || a.startsWith('work-') || a.startsWith('meet-');
  if (a.startsWith('work-') && b.startsWith('work-')) return true;
  return a.startsWith('meet-') && b.startsWith('meet-');
}

/**
 * 今週の行動の形(16-3の1)。選び直していない週は、先週の行動(`carry`。前の保存では週の`actions`)を同じ順に入れ、
 * 今週に選べないものと足りない枠は、おまかせの決まり(13-3の10)で埋める。
 * 印は、先週と同じ`carry`・おまかせで入れた`auto`・はじめの週のおすすめ`recommend`・自分で選んだ`null`。
 * @param {any} week
 * @param {{ slots: number, actions: { id: string }[], condition: number, stars: number, cap: number, canResearch: boolean }} options
 * @returns {{ chosen: (string | null)[], marks: (string | null)[], carried: 'carry' | 'recommend' | null }}
 */
function weekChoice(week, { slots, actions, condition, stars, cap, canResearch }) {
  if (week.seeded || week.applied) {
    const chosen = Array.from({ length: slots }, (_, index) => week.actions?.[index] ?? null);
    const marks = Array.from({ length: slots }, (_, index) => week.marks?.[index] ?? null);
    return { chosen, marks, carried: carriedKind(marks) };
  }
  const prev = Array.isArray(week.carry) ? week.carry : week.actions?.length ? week.actions : null;
  const ids = new Set(actions.map((item) => item.id));
  const chosen = [];
  const marks = [];
  for (let index = 0; index < slots; index += 1) {
    const action = prev ? prev[index] : undefined;
    if (prev && action === null && index < prev.length) {
      // 「何もしない」も持ち越す(選んだのは遊ぶ人。N:3-4)。
      chosen.push(null);
      marks.push('carry');
    } else if (action && ids.has(action) && !chosen.some((item) => sameKind(item, action))) {
      chosen.push(action);
      marks.push('carry');
    } else {
      chosen.push(undefined);
      marks.push(prev ? 'auto' : 'recommend');
    }
  }
  const auto = autoActions({ slots, condition, stars, cap, canResearch });
  // 持ち越した行動の効き目を先に数えてから、空いた枠をおまかせで埋める。
  let cond = condition;
  let star = stars;
  for (const action of chosen) {
    if (action === 'rest') cond += 1;
    if (action === 'research') star += 1;
  }
  for (let index = 0; index < slots; index += 1) {
    if (chosen[index] !== undefined) continue;
    const next = autoActions({ slots: 1, condition: cond, stars: star, cap, canResearch })[0] ?? auto[index] ?? 'rest';
    chosen[index] = ids.has(next) ? next : ids.has('rest') ? 'rest' : null;
    if (chosen[index] === 'rest') cond += 1;
    if (chosen[index] === 'research') star += 1;
  }
  return { chosen, marks, carried: carriedKind(marks) };
}

/** 見出しの印(全部が先週と同じなら「先週と同じ」、はじめの週なら「おすすめ」)。 */
function carriedKind(marks) {
  if (!marks.length) return null;
  if (marks.every((mark) => mark === 'recommend')) return 'recommend';
  if (marks.some((mark) => mark === 'carry' || mark === 'auto')) return 'carry';
  return null;
}

/** 今週の行動を、見えている形(持ち越し・おまかせ)のまま決めて書き込む。選ぶ・進める前に呼ぶ。 */
function seedWeek(state) {
  const week = state.week;
  if (!week || week.seeded || week.applied) return;
  const view = weekView(state);
  if (!view) return;
  week.actions = [...view.chosen];
  week.marks = [...view.marks];
  week.seeded = true;
}

/**
 * 行動の札を押す(16-3の2)。押した行動が新しい枠に入り、枠がいっぱいなら、いちばん古い(①)ほかの行動が押し出される。
 * 研究と休むは2つの枠に入れられる(2回押すと2つ、もう1回押すと外れる)。ほかの行動は、もう入っていれば外れる。
 * 研究会・まつり・仕事・人に会うのような週に1つまでの行動は、同じ仲間の前のものと入れ替わる。
 * @param {any} source
 * @param {string} action
 */
export function pushWeekAction(source, action) {
  const state = structuredClone(source);
  if (!state.week || state.week.applied) return state;
  seedWeek(state);
  const view = weekView(state);
  if (!view || !view.slots || !view.actions.some((item) => item.id === action)) return state;
  const max = action === 'research' || action === 'rest' ? view.slots : 1;
  let list = state.week.actions.slice(0, view.slots).filter(Boolean);
  if (list.filter((item) => item === action).length >= max) list = list.filter((item) => item !== action);
  else {
    list = list.filter((item) => !sameKind(item, action));
    if (list.length >= view.slots) list.splice(list.findIndex((item) => item !== action), 1);
    list.push(action);
  }
  state.week.actions = Array.from({ length: view.slots }, (_, index) => list[index] ?? null);
  state.week.marks = [];
  return state;
}

/**
 * 今週の行動を全部空ける(「何もしない」)。
 * @param {any} source
 */
export function clearWeekActions(source) {
  const state = structuredClone(source);
  if (!state.week || state.week.applied) return state;
  seedWeek(state);
  state.week.actions = state.week.actions.map(() => null);
  state.week.marks = [];
  return state;
}

/**
 * 今週の行動を選ぶ(週を進める前なら何度でも選び直せる。13-2の画面の設計メモ)。nullで枠を空ける。
 * @param {any} source
 * @param {number} slot
 * @param {string | null} action
 */
export function chooseWeekAction(source, slot, action) {
  const state = structuredClone(source);
  if (!state.week || state.week.applied) return state;
  seedWeek(state);
  const view = weekView(state);
  if (!view || slot < 0 || slot >= view.slots) return state;
  if (action && !view.actions.some((item) => item.id === action)) return state;
  // 研究会とまつりは週に1回(同じ日に2つは行けない)。
  if (action && (action === 'study' || action === 'festival') && state.week.actions.some((item, index) => item === action && index !== slot)) return state;
  // 仕事は週に1つまで(14-3の1)。
  if (action?.startsWith('work-') && state.week.actions.some((item, index) => String(item ?? '').startsWith('work-') && index !== slot)) return state;
  // 人に会うのは週に1人まで(15-3の2)。
  if (action?.startsWith('meet-') && state.week.actions.some((item, index) => String(item ?? '').startsWith('meet-') && index !== slot)) return state;
  const actions = [...state.week.actions];
  actions[slot] = action ?? null;
  state.week.actions = actions.slice(0, view.slots);
  state.week.marks = [];
  return state;
}

/** 週の行動を、週の始めにまとめて効かせる(研究・休む)。研究会とまつりは、その日に止まる。 */
function applyWeek(state, view) {
  const week = state.week;
  week.cond0 = clampCondition(state.condition ?? CONDITION_DEFAULT);
  const chosen = (week.actions ?? []).slice(0, view.slots).filter(Boolean);
  const gear = state.user.gear ?? 0;
  const capExtra = hasPerk(state, 'senior') ? 1 : 0;
  const target = view.prep?.opponent?.id ?? null;
  // 師匠との絆の段5: 大一番の週の始めに、師匠の電話で調子＋1(15-3の3)。
  if (hasPerk(state, 'mentor') && (view.games ?? []).some((game) => game.weight === 'big')) {
    state.condition = clampCondition((state.condition ?? CONDITION_DEFAULT) + 1);
    noteWeek(state, 'bond', `${nameOf(state, state.people.mentor)}から電話（調子＋1）`);
  }
  for (const action of chosen) {
    if (String(action).startsWith('meet-')) {
      const role = String(action).slice(5);
      const id = state.people?.[role];
      if (!id) continue;
      if (role === 'senior') {
        if (target) state.prep = researched(state.prep, target, gear, capExtra);
      } else if (role === 'hanane') state.user.hananeHint = 1;
      else state.condition = clampCondition((state.condition ?? CONDITION_DEFAULT) + 1);
      noteWeek(state, 'meet', `${BOND_DEFS[role].rel}の${nameOf(state, id)}と会う${role === 'senior' && target ? `（${nameOf(state, target)}の対策 ★${state.prep.stars}）` : ''}`);
      grow(state, BOND_DEFS[role].gains);
      bond(state, id, BOND_MEET);
    } else if (action === 'research' && target) {
      state.prep = researched(state.prep, target, gear, capExtra);
      noteWeek(state, 'research', `研究 → ${nameOf(state, target)}の対策 ★${state.prep.stars}`);
      grow(state, AVATAR_GAINS.research);
    } else if (action === 'rest') {
      state.condition = clampCondition((state.condition ?? CONDITION_DEFAULT) + 1);
      noteWeek(state, 'rest', '休む');
      grow(state, AVATAR_GAINS.rest);
    } else if (String(action).startsWith('work-')) {
      const item = view.actions.find((entry) => entry.id === action);
      if (item) week.stops.push({ kind: 'work', date: item.date, work: item.work, game: item.game ?? null });
    } else if (action === 'study') {
      const item = view.actions.find((entry) => entry.id === 'study');
      if (item) week.stops.push({ kind: 'study', date: item.date });
    } else if (action === 'festival') {
      const item = view.actions.find((entry) => entry.id === 'festival');
      if (item) week.stops.push({ kind: 'festival', date: item.date });
    }
  }
  week.stops.sort((a, b) => a.date.localeCompare(b.date));
  week.applied = true;
}

const HANANE_NEWS_LINES = Object.freeze([
  '記事、少し大げさね。次の対局で決着をつける。',
  '新聞、見たよ。浮かれてる暇はないでしょ。',
  'その記事、切り抜いておいた。追いつかれる前に、もっと上へ行くから。',
]);

/** 週の将棋ニュースを作って残す。ファンレター・取材の依頼もここで決める(14-3の3・5・6)。 */
function writeNews(state, week, lines) {
  const number = weekNumber(week.start, state.fy);
  const seed = festivalSeed(state, `news-${week.start}`);
  const events = [...(week.events ?? [])];
  // ファンの節目(手紙が届く)。
  const letters = fanLettersBetween(week.fans0 ?? 0, state.user.fans ?? 0, seed).map((letter) => ({ ...letter, fy: state.fy, week: number }));
  if (letters.length) {
    state.letters = [...(state.letters ?? []), ...letters].slice(-20);
    events.push({ kind: 'fansMark', fans: letters.at(-1).mark });
  }
  // 記録の1行(自分が10位以内の部門)。
  const records = state.year?.records ?? {};
  const ranks = RECORD_KINDS.map((kind) => ({ kind, row: recordRanking(records, kind.id, PRO_USER_ID).you })).filter((item) => item.row);
  const record = ranks.length ? `記録：${ranks.slice(0, 2).map((item) => `${item.kind.label.replace(/（.*）/, '')} ${item.row.rank}位（${recordValueText(item.kind.id, item.row.value)}）`).join('・')}` : '';
  // ふつうの週は、棋界の話題(勝率の1位など)。
  const leader = recordRanking(records, 'wins', PRO_USER_ID).top[0];
  const world = leader ? `${nameOf(state, leader.id)}、今年度${leader.value}勝で勝数の首位` : '';
  const you = `${state.userName || 'あなた'}${state.players[PRO_USER_ID]?.dan ?? '四段'}`;
  const news = buildNews({ number, start: week.start, end: week.end, events, lines, you, world, quote: week.quote ?? null, letter: letters.at(-1) ?? null, record });
  if (news.mine) news.hanane = HANANE_NEWS_LINES[seed % HANANE_NEWS_LINES.length];
  state.news = [...(state.news ?? []), { ...news, fy: state.fy }].slice(-60);
  // 取材の依頼(次の週。答えなければその週で消える)。
  const worth = [...events].sort((a, b) => (NEWS_WEIGHT[b.kind] ?? 0) - (NEWS_WEIGHT[a.kind] ?? 0)).find((event) => interviewFor(event, seed));
  state.interview = worth ? { ...interviewFor(worth, seed), week: number + 1 } : null;
}

/** 週を閉じて、まとめを残し、次の週へ(年度の終わりなら年度のまとめ)。 */
function closeWeek(state) {
  const week = state.week;
  const lines = (week.log ?? []).map((item) => item.text);
  const cond1 = clampCondition(state.condition ?? CONDITION_DEFAULT);
  if (cond1 !== week.cond0) lines.push(`調子 ${CONDITION_LABELS[week.cond0]} → ${CONDITION_LABELS[cond1]}`);
  // 羽音とタイトル戦の結果(あれば)。
  for (const game of Object.values(state.games)) {
    if (game.user || !game.winner || game.date < week.start || game.date > week.end) continue;
    const winner = game.winner === 'a' ? game.a : game.b;
    const hanane = [game.a, game.b].find((id) => state.players[id]?.story === HANANE);
    if (hanane) lines.push(`羽音 ${gameLabel(state, game)} ${winner === hanane ? '勝ち' : '負け'}`);
    else if (proEvent(game.event)?.stages[game.stage]?.title) lines.push(`${proEvent(game.event).name} ${nameOf(state, winner)}の勝ち`);
  }
  state.lastWeek = { number: weekNumber(week.start, state.fy), lines: lines.slice(0, 4) };
  writeNews(state, week, lines);
  if (week.end >= yearEnd(state.fy)) {
    state.date = yearEnd(state.fy);
    state.yearDone = true;
    state.summary = yearSummary(state);
    return;
  }
  state.date = addDays(week.end, 1);
  state.week = newWeek(state, state.date, carryOf(week));
}

/** 次の週へ持ち越す行動。枠の少ない週(対局のある週)のあとも、その前に選んでいた2つめを覚えておく。 */
function carryOf(week) {
  const actions = (week?.actions ?? []).slice();
  const before = Array.isArray(week?.carry) ? week.carry : [];
  return [...actions, ...before.slice(actions.length)];
}

/**
 * 今週を進める(13-3の1)。研究会・まつり・自分の公式戦の日で止まり、終わったらもう一度呼ぶと続きから進む。
 * @param {any} source
 * @returns {any} 新しい状態(週が終わったら次の週。lastWeekにまとめ)
 */
export function advanceWeek(source) {
  const state = structuredClone(source);
  if (state.pending || state.yearDone || state.festival || state.work) return state;
  if (!state.week?.start || state.week.end < state.date) state.week = newWeek(state, state.date, carryOf(state.week));
  const rng = createRng(state.rng);
  if (!state.week.applied) {
    seedWeek(state);
    applyWeek(state, weekView(state));
  }
  const week = state.week;
  for (const stop of week.stops) {
    if (stop.done) continue;
    if (stop.date < state.date) {
      stop.done = true;
      continue;
    }
    if (run(state, stop.date, rng)) {
      state.rng = rng.state;
      return state;
    }
    stop.done = true;
    if (stop.kind === 'study') openStudy(state, stop.date, rng);
    else if (stop.kind === 'work') openWork(state, stop);
    else {
      const festival = yearFestivals(state).find((item) => item.date === stop.date);
      if (festival) openFestival(state, festival);
    }
    state.rng = rng.state;
    return state;
  }
  if (run(state, week.end, rng)) {
    state.rng = rng.state;
    return state;
  }
  state.rng = rng.state;
  closeWeek(state);
  return state;
}

/**
 * 次の自分の公式戦の週まで、おまかせで進める(13-3の10)。対局の日で止まる。
 * @param {any} source
 */
export function autoWeeks(source) {
  let state = source;
  for (let guard = 0; guard < 60; guard += 1) {
    if (state.pending || state.yearDone || state.festival || state.work) return state;
    if (!state.week?.applied) {
      const view = weekView(state);
      const actions = autoActions({
        slots: view.slots,
        condition: view.condition,
        stars: view.prep?.stars ?? 0,
        cap: view.prep?.cap ?? 1,
        canResearch: Boolean(view.prep),
      });
      state = structuredClone(state);
      state.week.actions = actions;
      state.week.marks = [];
      state.week.seeded = true;
    }
    state = advanceWeek(state);
  }
  return state;
}

/**
 * 年度を締められるか(15-3の6)。自分の公式戦がもうない('over')か、ほかの棋戦はすべて敗退していて、この年度に残るのが順位戦だけ('junni')。
 * @param {any} state
 * @param {any} [preview] 次の自分の対局の見込み(weekViewで出したもの)
 * @returns {'over' | 'junni' | null}
 */
function closableKind(state, preview) {
  if (!state || state.pending || state.festival || state.work || state.yearDone) return null;
  if (!preview) return 'over';
  if (state.games[preview.gameId] && state.games[preview.gameId].event !== 'meijin') return null;
  const fyEnd = yearEnd(state.fy);
  for (const cycle of Object.values(state.cycles)) {
    if (!cycle.withUser || cycle.done || cycle.event === 'meijin') continue;
    const status = userStatus(state, cycle);
    if (!status?.alive) continue;
    if (status.waiting && stageWindow(cycle, proEvent(cycle.event).stages[cycle.entry ?? 0]).start > fyEnd) continue;
    return null;
  }
  return 'junni';
}

/**
 * 年度を締める(15-3の6)。残りの週は世界だけ進め(順位戦の残りは分身に任せる)、年度のまとめへ。
 * ニュースは残りの大きな出来事を1枚(「年度末の将棋界」)にまとめる。
 * @param {any} source
 */
export function closeYearEarly(source) {
  const view = weekView(source);
  if (!view?.closable) return source;
  const from = source.date;
  const number = weekNumber(source.week?.start ?? from, source.fy);
  let state = source;
  let auto = 0;
  for (let guard = 0; guard < 200 && !state.yearDone; guard += 1) {
    state = advanceToNextGame(state);
    if (state.pending?.gameId) {
      state = recordProGame(state, 'auto').state;
      auto += 1;
    } else if (state.pending) state = { ...state, pending: null };
  }
  state = structuredClone(state);
  const lines = [];
  for (const cycle of Object.values(state.cycles)) {
    const event = proEvent(cycle.event);
    if (!cycle.done || !cycle.champion) continue;
    const last = Object.values(state.games).filter((game) => game.cycle === cycle.id && game.winner).map((game) => game.date).sort().pop();
    if (!last || last < from) continue;
    lines.push(event.kind === 'title' ? `${event.name}、${nameOf(state, cycle.champion)}が${event.short}に` : `${event.name}、${nameOf(state, cycle.champion)}が優勝`);
  }
  if (auto) lines.unshift(`順位戦の残り${auto}局は分身が指した`);
  state.news = [...(state.news ?? []), {
    number, start: from, end: yearEnd(state.fy), headline: '年度末の将棋界', lead: `${dateLabel(from)}から年度の終わりまでの、将棋界の結果。`, lines: lines.slice(0, 4),
    record: '', letter: null, hanane: '', kind: 'world', mine: false, weight: 0, fy: state.fy, closed: true,
  }].slice(-60);
  state.interview = null;
  state.date = yearEnd(state.fy);
  state.yearDone = true;
  state.summary = { ...yearSummary(state), closedEarly: from, autoGames: auto };
  return state;
}

/**
 * 年度のまとめのあとの「棋士の世界に残す」を選んだ印(15-3の8)。名簿を書くのは対局画面(pro-writeback.mjs)。
 * @param {any} source
 * @param {{ keep: boolean, always?: boolean, items?: { ok: boolean, text: string }[] }} choice
 */
export function markWriteBack(source, { keep, always = false, items = [] }) {
  if (!source?.yearDone || !source.summary) return source;
  return {
    ...source,
    summary: { ...source.summary, writeBack: keep ? 'kept' : 'skipped', writeBackItems: keep ? items : [] },
    settings: { ...(source.settings ?? {}), writeBack: always ? 'always' : (source.settings?.writeBack === 'always' && keep ? 'always' : null) },
  };
}

// ---- 棋士の仕事(14-3の1)

/** 仕事の日: その日で止まり、仕事の札を出す(遊ぶか、さっと済ませる)。 */
function openWork(state, stop) {
  const def = workDef(stop.work);
  if (!def) return;
  state.date = stop.date;
  state.work = { id: def.id, date: stop.date, dateText: dateLabel(stop.date), game: stop.game ?? null, seed: festivalSeed(state, `work-${stop.date}`) };
}

/** 仕事の札の形。 */
export function workView(state) {
  const work = state?.work;
  const def = work ? workDef(work.id) : null;
  if (!def) return null;
  const best = workReward(def.id, { score: def.scoreMax });
  const quick = workReward(def.id, { quick: true });
  const game = work.game ? state.games[work.game] : null;
  return {
    ...work, label: def.title, icon: def.icon, client: def.client, note: def.note, play: def.play, scoreMax: def.scoreMax,
    best, quick, bestGrow: gainsText(best.gains), quickGrow: gainsText(quick.gains),
    gameLabel: game ? `${gameLabel(state, game)} ${nameOf(state, game.a)}－${nameOf(state, game.b)}` : '',
  };
}

/**
 * 仕事を終える(遊んだ出来か、さっと済ませた)。謝礼・ファン・分身の経験(14-3の1)。指導の仕事は指導対局の記録から呼ぶ。
 * @param {any} source
 * @param {{ score?: number, quick?: boolean }} [result]
 */
export function finishWork(source, result = {}) {
  const state = structuredClone(source);
  return { state, ...settleWork(state, result) };
}

function settleWork(state, { score = 0, quick = false } = {}) {
  const work = state.work;
  const def = work ? workDef(work.id) : null;
  if (!def) return { fee: 0, fans: 0, ups: [], text: '' };
  const reward = workReward(def.id, { score, quick });
  earn(state, PRO_USER_ID, reward.fee, 'gig');
  state.user.fans = (state.user.fans ?? 0) + reward.fans;
  const ups = grow(state, reward.gains);
  const scoreText = quick ? 'さっと済ませた' : workScoreText(def.id, reward.score);
  const text = `${def.title}${scoreText ? `（${scoreText}）` : ''} 謝礼 ${reward.fee}万円・ファン＋${reward.fans}`;
  noteWeek(state, 'work', text);
  noteMilestone(state, { event: 'work', kind: 'plain', text });
  // 解説の仕事のはじめては、ニュースの見出し(14-3の3)。
  state.user.works = { ...(state.user.works ?? {}), [def.id]: (state.user.works?.[def.id] ?? 0) + 1 };
  if (def.id === 'kaisetsu' && state.user.works.kaisetsu === 1) noteEvent(state, { kind: 'kaisetsuDebut' });
  else noteEvent(state, { kind: 'work', text: `${def.title}の仕事` });
  state.work = null;
  return { fee: reward.fee, fans: reward.fans, ups, text };
}

/** 指導の仕事の対局(将棋サロンのお客。あなたが上手の駒落ち。まつりの指導対局と同じ流れ)。 */
export function startWorkShidou(source) {
  const state = structuredClone(source);
  const work = state.work;
  if (work?.id !== 'shidou' || state.pending) return state;
  const guest = shidouGuest({ seed: work.seed }, state.userLevel ?? 20);
  state.pending = {
    kind: 'shidou', work: true, gameId: null, opponentId: guest.id, guest, level: guest.level, color: 'white', style: null,
    handicap: guest.handicap, handicapGiver: 'player',
    label: `指導対局（${guest.handicapLabel}）`, eventText: WORKS.shidou.client, titleName: '', twoDay: false, date: work.date,
    stakes: { text: '勝ち負けより、楽しんでもらおう', goal: '', win: '', boss: false },
    coachLine: `${guest.name}との指導対局だよ。あなたが上手で先に指すよ。勝ち負けより、楽しんでもらおう！`,
    series: null, others: { games: [] },
  };
  return state;
}

// ---- 取材(14-3の5)

/**
 * 取材に答える(どの答えでもファン＋15。答えは次のニュースの記事に載る)。nullで答えずに閉じる。
 * @param {any} source
 * @param {string | null} answerId
 */
export function answerInterview(source, answerId) {
  const state = structuredClone(source);
  const interview = state.interview;
  if (!interview) return state;
  const answer = interview.answers?.find((item) => item.id === answerId);
  state.interview = null;
  if (!answer) return state;
  state.user.fans = (state.user.fans ?? 0) + INTERVIEW_FANS;
  if (state.week) state.week.quote = answer.text;
  noteWeek(state, 'interview', `取材に答えた（ファン＋${INTERVIEW_FANS}）`);
  return state;
}

// ---- 対局の重さ・今年の目標・次の大一番(13-3の5・7・8)

const opponentOf = (game) => (game.a === PRO_USER_ID ? game.b : game.a);

/**
 * 対局の重さ(small・mid・big)。大一番は番勝負・挑戦者決定戦・決勝・リーグと順位戦の最終局・羽音との公式戦。
 * 小は予選のブロックの決勝より前の回戦。
 * @param {any} state
 * @param {any} game
 */
export function gameWeight(state, game) {
  const event = proEvent(game?.event ?? String(game?.cycle ?? '').split('-')[0]);
  const def = event?.stages?.[game.stage];
  if (!def) return 'mid';
  if (state.players[opponentOf(game)]?.story === HANANE) return 'big';
  if (def.title || def.type === 'series' || /決勝$/.test(game.label ?? '')) return 'big';
  const stage = state.cycles[game.cycle]?.stages?.[game.stage];
  const rounds = stage?.dates?.length ?? 0;
  if ((def.type === 'league' || def.type === 'junni') && rounds && game.round >= rounds - 1) return 'big';
  if (def.type === 'blocks' && game.round < Math.log2(def.size) - 1) return 'small';
  return 'mid';
}

/** その期の自分の勝ち数(年度の中の対局)。 */
function userWinsIn(state, cycleId, stageIndex = null) {
  return Object.values(state.games).filter((game) => game.user && game.winner && game.cycle === cycleId && (stageIndex === null || game.stage === stageIndex)
    && (game.winner === 'a') === (game.a === PRO_USER_ID)).length;
}

/** 今年度の自分の公式戦(決着したもの)。 */
const yearUserGames = (state) => Object.values(state.games).filter((game) => game.user && game.winner && game.date >= yearStart(state.fy) && game.date <= yearEnd(state.fy));

/** 今年の勝ち数の目標(はじめての年度は15、次の年度からは前の年度より3つ多く。40まで)。 */
function winsTarget(state) {
  const last = state.history?.at(-1);
  return last ? Math.min(40, Math.max(15, (last.wins ?? 0) + 3)) : 15;
}

/**
 * 年度の始めに選ぶ目標の候補(13-3の7)。おすすめに印(はじめての年度は易しめ)。
 * @param {any} state
 */
export function goalChoices(state) {
  if (!state) return [];
  const shinjin = state.cycles[`shinjin-${state.fy}`];
  const list = [];
  const add = (id, extra = {}) => list.push({ id, ...GOAL_DEFS[id], ...extra });
  add('junniPromote', { note: `${CLASS_NAMES[state.user.cls] ?? ''}で上位に入る` });
  add('junniWinning');
  if (shinjin?.withUser) {
    add('shinjinBest4');
    add('shinjinWin');
  }
  add('mainStage');
  add('challenge');
  add('wins', { target: winsTarget(state), label: `年間${winsTarget(state)}勝` });
  add('rate');
  if (Object.values(state.players).some((member) => member.story === HANANE)) add('hanane');
  add('money');
  const first = !(state.history ?? []).length;
  const recommended = first ? ['junniPromote', shinjin?.withUser ? 'shinjinBest4' : 'junniWinning', 'wins'] : ['junniPromote', 'mainStage', 'wins'];
  return list.map((goal) => ({ ...goal, recommended: recommended.includes(goal.id) }));
}

/**
 * 今年の目標を決める(3つ。年度の途中では変えない)。
 * @param {any} source
 * @param {string[]} ids
 */
export function setYearGoals(source, ids) {
  const state = structuredClone(source);
  const choices = goalChoices(state);
  const picked = [...new Set(ids)].filter((id) => choices.some((goal) => goal.id === id)).slice(0, GOAL_PICK);
  if (picked.length !== GOAL_PICK || state.goals?.fy === state.fy) return state;
  state.goals = { fy: state.fy, ids: picked, target: { wins: winsTarget(state) }, done: {} };
  return state;
}

/**
 * 目標の進み具合(上の帯と年度のまとめ)。年度の終わりに決まる目標(勝率・羽音・賞金)は、年度の終わりまで達成にしない。
 * @param {any} state
 * @returns {{ id: string, label: string, text: string, ratio: number, done: boolean }[]}
 */
export function goalProgress(state) {
  const goals = state?.goals;
  if (!goals?.ids?.length || goals.fy !== state.fy) return [];
  const records = state.year?.records?.[PRO_USER_ID] ?? { w: 0, l: 0 };
  const games = records.w + records.l;
  const end = Boolean(state.yearDone);
  const junniStage = state.cycles[`meijin-${state.fy}`]?.stages?.[0] ?? null;
  const jw = junniStage?.wins?.[PRO_USER_ID] ?? 0;
  const jl = junniStage?.losses?.[PRO_USER_ID] ?? 0;
  const shinjin = state.cycles[`shinjin-${state.fy}`];
  const sw = shinjin ? userWinsIn(state, shinjin.id) : 0;
  const mine = yearUserGames(state);
  const reachedMain = mine.some((game) => {
    const event = proEvent(game.event);
    const type = event?.stages?.[game.stage]?.type;
    return event?.kind === 'title' && ['knockout', 'league'].includes(type);
  }) || Object.values(state.games).some((game) => game.user && !game.winner && proEvent(game.event)?.kind === 'title' && ['knockout', 'league'].includes(proEvent(game.event)?.stages?.[game.stage]?.type));
  const challenged = Object.values(state.games).some((game) => game.user && game.date >= yearStart(state.fy) && proEvent(game.event)?.stages?.[game.stage]?.title);
  const hanane = mine.filter((game) => state.players[opponentOf(game)]?.story === HANANE);
  const hw = hanane.filter((game) => (game.winner === 'a') === (game.a === PRO_USER_ID)).length;
  const ranking = earningsRanking(state);
  return goals.ids.map((id) => {
    const def = GOAL_DEFS[id] ?? { label: id };
    let text = '';
    let ratio = 0;
    let done = Boolean(goals.done?.[id]);
    if (id === 'junniPromote') {
      text = `${jw}勝${jl}敗`;
      ratio = Math.min(1, jw / 8);
      done ||= Boolean(junniStage?.result?.promoted);
    } else if (id === 'junniWinning') {
      text = `${jw}勝${jl}敗`;
      ratio = Math.min(1, jw / 6);
      done ||= jw >= 6;
    } else if (id === 'shinjinBest4' || id === 'shinjinWin') {
      text = shinjin?.champion === PRO_USER_ID ? '優勝' : sw >= 3 ? '決勝進出' : sw >= 2 ? 'ベスト4' : sw >= 1 ? 'ベスト8' : 'これから';
      ratio = id === 'shinjinBest4' ? Math.min(1, sw / 2) : shinjin?.champion === PRO_USER_ID ? 1 : Math.min(0.9, sw / 5);
      done ||= id === 'shinjinBest4' ? sw >= 2 : shinjin?.champion === PRO_USER_ID;
    } else if (id === 'mainStage') {
      text = reachedMain ? '本戦・リーグ入り' : 'まだ予選';
      ratio = reachedMain ? 1 : 0;
      done ||= reachedMain;
    } else if (id === 'challenge') {
      text = challenged ? 'タイトル挑戦' : 'まだ';
      ratio = challenged ? 1 : reachedMain ? 0.5 : 0;
      done ||= challenged;
    } else if (id === 'wins') {
      const target = goals.target?.wins ?? 15;
      text = `${records.w}/${target}勝`;
      ratio = Math.min(1, records.w / target);
      done ||= records.w >= target;
    } else if (id === 'rate') {
      const rate = games ? records.w / games : 0;
      text = games ? `勝率${rate.toFixed(3).replace(/^0/, '')}（${games}局）` : 'まだ0局';
      ratio = Math.min(1, rate / 0.6);
      done ||= end && games >= 10 && rate >= 0.6;
    } else if (id === 'hanane') {
      text = `${hw}勝${hanane.length - hw}敗`;
      ratio = hanane.length ? (hw > hanane.length - hw ? 1 : hw * 2 === hanane.length ? 0.75 : 0.5) : 0;
      done ||= end && hw > hanane.length - hw;
    } else if (id === 'money') {
      text = ranking.rank ? `${ranking.rank}位（${ranking.amount}万円）` : 'まだ';
      ratio = ranking.rank ? Math.min(1, 30 / ranking.rank) : 0;
      done ||= end && ranking.rank > 0 && ranking.rank <= 30;
    }
    return { id, label: id === 'wins' ? `年間${goals.target?.wins ?? 15}勝` : def.label, text, ratio, done };
  });
}

/** 新しく達成した目標に印を付けて返す(その場の判子)。 */
function markGoals(state) {
  if (!state.goals?.ids?.length) return [];
  const fresh = goalProgress(state).filter((goal) => goal.done && !state.goals.done?.[goal.id]);
  state.goals.done = { ...(state.goals.done ?? {}), ...Object.fromEntries(fresh.map((goal) => [goal.id, state.date])) };
  return fresh;
}

/**
 * 次の大一番(13-3の8)。決まっている大一番がなければ「勝ち進めば」の一言。
 * @param {any} state
 */
export function nextBigGame(state) {
  if (!state || state.yearDone) return null;
  const preview = state.pending?.gameId ? state.games[state.pending.gameId] : null;
  const candidates = Object.values(state.games).filter((game) => game.user && !game.winner && game.date >= state.date);
  if (preview && !candidates.includes(preview)) candidates.push(preview);
  const big = candidates.filter((game) => gameWeight(state, game) === 'big').sort((a, b) => a.date.localeCompare(b.date))[0];
  if (big) {
    const weeks = weekNumber(big.date, state.fy) - weekNumber(state.date, state.fy);
    return { kind: 'fixed', label: big.label, opponent: card(state, opponentOf(big)), date: big.date, dateText: dateLabel(big.date), weeks, whenText: weeks <= 0 ? '今週' : `あと${weeks}週` };
  }
  // 予選のブロックを勝ち抜けば、次が本戦・リーグ・挑戦者決定戦のもの。
  let best = null;
  for (const cycle of Object.values(state.cycles)) {
    if (cycle.done || !cycle.withUser) continue;
    const stage = cycle.stages[cycle.stage];
    const event = proEvent(cycle.event);
    const def = event.stages[stage?.index ?? -1];
    if (!stage || stage.done || def?.type !== 'blocks') continue;
    const block = (stage.blocks ?? []).find((entry) => entry.alive?.includes(PRO_USER_ID));
    if (!block) continue;
    const next = event.stages[stage.index + 1];
    if (!next) continue;
    const rest = Math.max(1, Math.log2(def.size) - userWinsIn(state, cycle.id, stage.index));
    if (!best || rest < best.rest) best = { kind: 'reach', rest, text: `${event.short}${next.label}入りまで あと${rest}勝` };
  }
  return best;
}

// ---- 画面の形

const nameOf = (state, id) => (id === PRO_USER_ID ? state.userName || 'あなた' : state.players[id]?.name ?? '');
const card = (state, id) => (id ? { id, name: nameOf(state, id), dan: state.players[id]?.dan ?? '', you: id === PRO_USER_ID, story: state.players[id]?.story ?? null } : null);

/** プレイヤーのいまの位置(棋戦の一覧の1行)。 */
function userStatus(state, cycle) {
  if (!cycle.withUser) return null;
  const event = proEvent(cycle.event);
  for (let index = cycle.stages.length - 1; index >= 0; index -= 1) {
    const stage = cycle.stages[index];
    if (!stage?.user) continue;
    // 段階の途中で負けた(トーナメント・予選のブロック)。
    if (stage.userOut) return { text: `${stage.label}で敗退`, alive: false };
    if (!stage.done) return { text: `${stage.label}`, alive: true };
    if (stage.winners.includes(PRO_USER_ID)) {
      if (event.stages[index].title) return { text: `${event.short}獲得`, alive: false, won: true };
      if (index === event.stages.length - 1) return { text: '優勝', alive: false, won: true };
      return { text: `${stage.label}突破`, alive: true };
    }
    if (stage.type === 'junni') return { text: `${CLASS_NAMES[stage.cls]} ${stage.result?.place ?? ''}位`, alive: false };
    return { text: `${stage.label}で敗退`, alive: false };
  }
  const first = event.stages[cycle.entry ?? 0];
  const start = stageWindow(cycle, first).start;
  return { text: `${first.label}から ${Number(start.slice(5, 7))}/${Number(start.slice(8))}〜`, alive: true, waiting: true };
}

/**
 * 1年の画面の形: 日付・次の対局・棋戦の一覧(この年度にかかる期)・成績・タイトル保持者。
 */
export function proYearView(state) {
  if (!state) return null;
  const fyStart = yearStart(state.fy);
  const fyEnd = yearEnd(state.fy);
  const events = PRO_EVENTS.map((event) => {
    const cycles = Object.values(state.cycles).filter((cycle) => cycle.event === event.id).sort((a, b) => a.base - b.base);
    const active = cycles.filter((cycle) => {
      const first = stageWindow(cycle, event.stages[0]).start;
      const last = stageWindow(cycle, event.stages.at(-1)).end;
      return first <= fyEnd && last >= fyStart;
    });
    const mine = active.find((cycle) => cycle.withUser) ?? null;
    return {
      id: event.id,
      name: event.name,
      short: event.short,
      color: event.color,
      kind: event.kind,
      holder: event.kind === 'title' ? card(state, state.titles[event.id]) : null,
      status: mine ? userStatus(state, mine) : null,
      cycles: active.map((cycle) => cycle.id),
    };
  });
  const record = state.year.records[PRO_USER_ID] ?? { w: 0, l: 0, streak: 0, best: 0 };
  const hanane = Object.values(state.players).find((member) => member.story === HANANE) ?? null;
  const vsHanane = state.user.vsHanane ?? { wins: 0, losses: 0 };
  const official = Boolean(state.pending?.gameId);
  const pending = state.pending ? {
    ...state.pending,
    dateText: dateLabel(state.pending.date),
    opponent: card(state, state.pending.opponentId),
    // 羽音と当たる日は、対局の前に羽音の一言(3章の13)。
    hananeLine: official && state.players[state.pending.opponentId]?.story === HANANE ? hananeBeforeLine(vsHanane) : '',
    // 事前研究(研究の道具を持っていれば。10-2の4)と、研究仲間の成績(10-2の5)。公式戦だけ。
    prep: official ? gearPrep(state.user.gear ?? 0, state.players[state.pending.opponentId], state.pending.style) : null,
    // 週の研究で積んだ対策の★と、作戦が当たったか(13-3の3)。
    stars: official ? state.pending.prep?.stars ?? 0 : 0,
    // 分身に任せたときの勝つ見込み(調子と対策を足した分身の強さ。13-3の5。選ぶ材料で、決めるのは自動対局)。
    autoChance: official && state.players[PRO_USER_ID] && state.players[state.pending.opponentId]
      ? winProbability(state.players[PRO_USER_ID].rating + autoRatingBonus(state.condition ?? CONDITION_DEFAULT, state.pending.prep?.stars ?? 0) + avatarEdge(state.avatar), state.players[state.pending.opponentId].rating)
      : null,
    starsHit: official ? Boolean(state.pending.prep?.hit) : false,
    studyMate: official ? studyMate(state, state.pending.opponentId) : null,
  } : null;
  const hananeRecord = hanane ? state.year.records[hanane.id] ?? { w: 0, l: 0 } : null;
  return {
    fy: state.fy,
    date: state.date,
    dateText: dateLabel(state.date),
    pending,
    yearDone: state.yearDone,
    summary: state.summary,
    record: { wins: record.w, losses: record.l, streak: record.streak, best: record.best },
    cls: CLASS_NAMES[state.user.cls] ?? state.user.cls,
    group: state.user.group,
    events,
    log: [...(state.log ?? [])].slice(-6).reverse(),
    titles: TITLE_EVENTS.filter((id) => state.titles[id] === PRO_USER_ID).map((id) => proEvent(id).short),
    rival: hanane ? { id: hanane.id, name: hanane.name, wins: hananeRecord.w, losses: hananeRecord.l, vs: vsHanane } : null,
    lastGame: lastGameView(state),
    history: [...(state.history ?? [])].reverse(),
    wallet: walletView(state),
    study: studyView(state),
    festival: festivalView(state),
    kigou: [...(state.kigou ?? [])].reverse(),
    // 記録のランキング・ファンレター・分身・今の仕事(14章)。
    records: RECORD_KINDS.map((kind) => {
      const ranking = recordRanking(state.year.records ?? {}, kind.id, PRO_USER_ID);
      const row = (item) => ({ rank: item.rank, id: item.id, name: nameOf(state, item.id), you: item.id === PRO_USER_ID, value: recordValueText(kind.id, item.value) });
      return { ...kind, top: ranking.top.map(row), you: ranking.you && !ranking.top.some((item) => item.id === PRO_USER_ID) ? row(ranking.you) : null, near: ranking.near };
    }),
    letters: [...(state.letters ?? [])].reverse(),
    nextLetter: nextLetter(state.user.fans ?? 0),
    avatar: avatarView(state.avatar, state.week?.gains ?? {}),
    work: workView(state),
    interview: state.interview ?? null,
    news: [...(state.news ?? [])].filter((item) => item.fy === state.fy).reverse(),
    // 5人と絆(15-3の1・3)。
    people: peopleView(state),
    // 段位と棋士の歩み(15-3の5・7)。
    dan: state.players[PRO_USER_ID]?.dan ?? '四段',
    nextDan: nextDanHint({ dan: state.players[PRO_USER_ID]?.dan ?? '四段', group: state.user.group, cls: state.user.cls, sinceWins: state.user.sinceWins ?? 0 }),
    road: careerRoad(state.history ?? [], state.yearDone ? null : {
      fy: state.fy, wins: record.w, losses: record.l, dan: state.players[PRO_USER_ID]?.dan ?? '四段', clsText: CLASS_NAMES[state.user.cls] ?? '', group: state.user.group,
      titles: TITLE_EVENTS.filter((id) => state.titles[id] === PRO_USER_ID).map((id) => proEvent(id).short), champions: [],
      headlines: yearHeadlines((state.news ?? []).filter((item) => item.fy === state.fy)),
    }),
  };
}

/** 研究会(顔ぶれと成績・今日の羽音の一言・デビューの日の誘い)。 */
function studyView(state) {
  const study = state.study;
  if (!study) return null;
  const members = study.members.map((id) => ({ ...card(state, id), record: study.records[id] ?? { w: 0, l: 0, d: 0 } }));
  const names = members.filter((member) => member.story !== HANANE).map((member) => member.name);
  const invite = !study.turn && !study.last && state.date === state.debut && !state.lastGame ? STUDY_TEXT.invite(names) : '';
  return {
    members,
    games: (study.log ?? []).length,
    talk: study.talk?.date === state.date ? study.talk.line : invite,
    next: card(state, studyOpponentId(state)),
  };
}

/** 財布(持っているお金・今年度の獲得と内訳・順位・研究の道具と次の道具)。 */
function walletView(state) {
  const money = state.user.money ?? 0;
  const gear = state.user.gear ?? 0;
  const ranking = earningsRanking(state);
  return {
    money,
    mine: { ...(state.year.mine ?? { fee: 0, prize: 0, gig: 0 }) },
    earned: ranking.amount,
    rank: ranking.rank,
    size: ranking.size,
    top: ranking.top,
    near: ranking.near,
    gear,
    gearName: GEAR.find((entry) => entry.level === gear)?.name ?? '',
    gearPrep: GEAR.find((entry) => entry.level === gear)?.prep ?? '',
    next: nextGear(gear, money),
    fans: state.user.fans ?? 0,
  };
}

/** いちばん最近の自分の対局(分身に任せた対局も)。 */
function lastGameView(state) {
  const game = state.lastGame ? state.games[state.lastGame.id] : null;
  if (!game) return null;
  return { date: game.date, label: gameLabel(state, game), won: state.lastGame.won, auto: state.lastGame.auto, opponent: card(state, game.a === PRO_USER_ID ? game.b : game.a) };
}

/**
 * 下の欄のやこび姫の一言(対局のない日)。今日の対局の結果・節目、それから次の対局日。
 * @param {ReturnType<typeof proYearView>} view
 * @param {{ dateText: string, label: string } | null} preview 次の対局日の見込み
 */
export function proYearTalk(view, preview) {
  if (!view) return '';
  if (view.yearDone) return view.summary?.titles?.length ? PRO_YEAR_TEXT.yearDoneTitle : PRO_YEAR_TEXT.yearDone;
  const today = (view.log ?? []).filter((item) => item.date === view.date);
  const last = view.lastGame && view.lastGame.date === view.date ? view.lastGame : null;
  const parts = [];
  const milestone = today.find((item) => item.kind === 'advance') ?? today[0];
  if (milestone) parts.push(milestone.kind === 'advance' ? `${milestone.text}！` : `${milestone.text}。`);
  else if (last) parts.push(last.auto ? `分身が${last.won ? '勝った' : '負けちゃった'}よ。` : last.won ? '勝ったね！' : '負けちゃったね。');
  const next = preview ? `次は${preview.dateText.replace(/\(.\)$/, '')}の${preview.label.replace(/ .*$/, '')}だよ。` : PRO_YEAR_TEXT.noMore;
  if (!parts.length && preview) return `次の対局は${preview.dateText}の${preview.label}だよ。`;
  return `${parts.join('')}${next}`;
}

/**
 * 次の対局日の見込み(「次の対局日へ」のボタンに出す)。同じ状態から進めた結果なので、実際に進めたときと同じ。
 * @returns {{ date: string, dateText: string, label: string } | null} 年度の終わりまで対局がなければnull
 */
export function previewNextGame(state) {
  if (!state || state.pending || state.yearDone) return null;
  const next = advanceToNextGame(state);
  if (!next.pending) return null;
  return { date: next.pending.date, dateText: dateLabel(next.pending.date), label: next.pending.label, opponentId: next.pending.opponentId, gameId: next.pending.gameId, twoDay: next.pending.twoDay };
}

/**
 * まだ始まっていない段階の見込みの日(カレンダーの「予定」。デビューの日に何も印がないと、1年の見通しが立たないため。D:2-2)。
 * プレイヤーが入る段階は回戦の日を「予定」、タイトル戦の番勝負は最低限の局数の日を★(予定)にする。
 * 日の割り当ては段階を始めるとき(`startStage`)と同じ式なので、始まればほぼ同じ日に組まれる(前の段階が長引けばずれる)。
 * @returns {Map<string, any[]>} 日付ごとの印
 */
function projectedItems(state) {
  const byDate = new Map();
  const add = (date, item) => {
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(item);
  };
  for (const cycle of Object.values(state.cycles)) {
    if (cycle.done) continue;
    const current = cycle.stages[cycle.stage];
    if (current && !current.done) continue;
    const index = cycle.stage + 1;
    const event = proEvent(cycle.event);
    const def = event.stages[index];
    if (!def) continue;
    const userEnters = cycle.withUser && cycle.entry === index;
    if (!def.title && !userEnters) continue;
    const window = stageWindow(cycle, def);
    if (window.start <= state.date) {
      window.start = addDays(state.date, 1);
      if (window.end <= window.start) window.end = addDays(window.start, 14);
    }
    const nextDef = event.stages[index + 1];
    const finalists = def.type === 'knockout' && nextDef?.type === 'series' && !nextDef.title;
    let dates;
    if (def.type === 'series') {
      const maxGames = def.need * 2 - 1;
      const span = (toDate(window.end) - toDate(window.start)) / 86400000;
      dates = roundDates(window, maxGames, { spacing: maxGames > 1 ? Math.max(3, Math.floor(span / maxGames)) : 0 }).slice(0, def.need);
    } else {
      const rounds = def.type === 'junni' ? CLASS_RULES[state.user.cls]?.rounds ?? 10
        : def.type === 'league' ? (def.size % 2 ? def.size : def.size - 1)
          : Math.max(1, Math.ceil(Math.log2(Math.max(2, def.size))) - (finalists ? 1 : 0));
      dates = roundDates(window, rounds, { broadcast: Boolean(def.broadcast) });
    }
    dates.forEach((day, round) => {
      if (def.title) {
        add(day, { kind: 'title', plan: true, event: event.id, color: event.color, label: `${def.label} 第${round + 1}局（予定）` });
        if (def.twoDay) add(addDays(day, -1), { kind: 'title', plan: true, event: event.id, color: event.color, label: `${def.label} 第${round + 1}局 1日目（予定）` });
      } else {
        add(day, { kind: 'plan', event: event.id, short: def.type === 'junni' ? '順位' : event.short, color: event.color, label: `${event.name} ${def.label}（予定）` });
      }
    });
  }
  return byDate;
}

/** カレンダーのマスの印(その日の対局)。kind: user(自分の対局)・title(タイトル戦)・rival(羽音)・plan(自分が勝ち残っていれば指す日)。 */
function dayItems(state, date, projected = null) {
  const items = [...(projected?.get(date) ?? [])];
  for (const game of Object.values(state.games)) {
    const days = game.twoDay ? [addDays(game.date, -1), game.date] : [game.date];
    if (!days.includes(date)) continue;
    const event = proEvent(game.event);
    const def = event.stages[game.stage];
    if (game.user) items.push({ kind: 'user', event: event.id, short: def.type === 'junni' ? '順位' : event.short, color: event.color, label: game.label, result: game.winner ? ((game.winner === 'a') === (game.a === PRO_USER_ID) ? 'win' : 'loss') : null, game: game.id });
    else if (def.title) items.push({ kind: 'title', event: event.id, color: event.color, label: gameLabel(state, game), game: game.id });
    else if (state.players[game.a]?.story === HANANE || state.players[game.b]?.story === HANANE) items.push({ kind: 'rival', event: event.id, color: event.color, label: gameLabel(state, game), game: game.id });
  }
  // まだ組まれていない、勝ち残っていれば指す日(いまの段階の後の回戦)。
  for (const cycle of Object.values(state.cycles)) {
    const stage = cycle.stages[cycle.stage];
    if (!stage || stage.done || !stage.user) continue;
    const alive = stage.type === 'junni' || stage.type === 'league'
      || (stage.blocks ?? []).some((block) => block.alive.includes(PRO_USER_ID));
    if (!alive) continue;
    stage.dates.forEach((day, round) => {
      if (day === date && round >= stage.rounds.length) {
        const event = proEvent(cycle.event);
        items.push({ kind: 'plan', event: event.id, short: stage.type === 'junni' ? '順位' : event.short, color: event.color, label: `${event.name} ${stage.label}（予定）` });
      }
    });
  }
  return items;
}

/** その月の研究会と将棋まつりの印(デビューの後。行った日は結果、これからの日は予定)。 */
function studyItems(state, year, month) {
  const byDate = new Map();
  if (!state.study) return byDate;
  const log = new Map((state.study.log ?? []).map((item) => [item.date, item]));
  for (const date of studyDaysOfMonth(year, month, userBusy(state))) {
    if (date < state.debut) continue;
    const done = log.get(date);
    // 寄り道に出せるのは明日から(今日の研究会は、参加したものだけ)。
    const today = state.pending?.kind === 'study' && state.pending.date === date;
    if (!done && !today && date <= state.date) continue;
    byDate.set(date, [{ kind: 'study', short: '研', color: '#c9b6e4', label: '研究会', result: done ? done.r : null }]);
  }
  // 将棋まつり(行った日と、これからの日)。
  const visited = new Map((state.festivals ?? []).map((item) => [item.date, item]));
  const fy = fiscalYearOf(`${year}-${pad(month)}-01`);
  for (const festival of festivalDays(fy, userBusy(state))) {
    if (Number(festival.date.slice(5, 7)) !== month || festival.date < state.debut) continue;
    const went = visited.has(festival.date) || state.festival?.date === festival.date;
    if (!went && festival.date <= state.date) continue;
    byDate.set(festival.date, [...(byDate.get(festival.date) ?? []), { kind: 'festival', short: '祭', color: '#f5b7b1', label: festival.name, went }]);
  }
  return byDate;
}

/** 月のカレンダー(週ごとの7マス。日曜はじまり)。 */
export function monthView(state, year, month) {
  const first = `${year}-${pad(month)}-01`;
  const start = addDays(first, -weekdayOf(first));
  const weeks = [];
  let day = start;
  const projected = projectedItems(state);
  const study = studyItems(state, year, month);
  for (let week = 0; week < 6; week += 1) {
    const row = [];
    for (let index = 0; index < 7; index += 1) {
      const inMonth = day.slice(0, 7) === first.slice(0, 7);
      row.push({ date: day, day: Number(day.slice(8)), inMonth, today: day === state.date, past: day < state.date, items: inMonth ? [...dayItems(state, day, projected), ...(study.get(day) ?? [])] : [] });
      day = addDays(day, 1);
    }
    weeks.push(row);
    if (day.slice(0, 7) !== first.slice(0, 7) && week >= 3) break;
  }
  return { year, month, title: `${year}年${month}月`, weeks };
}

/** その日の対局の一覧。 */
export function dayView(state, date) {
  return {
    date,
    dateText: dateLabel(date),
    games: Object.values(state.games).filter((game) => game.date === date || (game.twoDay && addDays(game.date, -1) === date)).map((game) => {
      const event = proEvent(game.event);
      return {
        id: game.id,
        event: event.id,
        color: event.color,
        label: gameLabel(state, game),
        a: card(state, game.a),
        b: card(state, game.b),
        winner: game.winner ? card(state, game.winner === 'a' ? game.a : game.b) : null,
        user: Boolean(game.user),
        watch: canWatchGame(game),
        twoDay: Boolean(game.twoDay),
      };
    }).sort((x, y) => Number(y.user) - Number(x.user)),
    // 研究会の日なら、顔ぶれと、行った日は結果(10-2の5)。将棋まつりの日なら、名前と会場(10-2の6)。
    study: dayStudy(state, date),
    festival: dayFestival(state, date),
  };
}

function dayFestival(state, date) {
  const item = festivalDays(fiscalYearOf(date), userBusy(state)).find((entry) => entry.date === date);
  if (!item || date < state.debut) return null;
  const went = (state.festivals ?? []).find((entry) => entry.date === date) ?? null;
  return { name: item.name, place: item.place, fee: went?.fee ?? null, fans: went?.fans ?? null };
}

function dayStudy(state, date) {
  const item = studyItems(state, Number(date.slice(0, 4)), Number(date.slice(5, 7))).get(date)?.find((entry) => entry.kind === 'study');
  if (!item) return null;
  const done = (state.study.log ?? []).find((entry) => entry.date === date) ?? null;
  return {
    members: state.study.members.map((id) => nameOf(state, id)),
    result: done ? { opponent: nameOf(state, done.id), r: done.r } : null,
  };
}

/** 棋戦の表(この年度にかかる期の段階ごと)。トーナメントは自分のブロックと勝ち上がり、リーグは表、番勝負は星。 */
export function eventView(state, eventId) {
  const event = proEvent(eventId);
  if (!event) return null;
  const view = proYearView(state).events.find((entry) => entry.id === eventId);
  const cycles = view.cycles.map((id) => state.cycles[id]);
  return {
    id: event.id,
    name: event.name,
    color: event.color,
    holder: view.holder,
    cycles: cycles.map((cycle) => ({
      id: cycle.id,
      label: `${cycle.base}年度に始まった期`,
      withUser: cycle.withUser,
      champion: card(state, cycle.champion),
      stages: event.stages.map((def, index) => {
        const stage = cycle.stages[index];
        const window = stageWindow(cycle, def);
        // 今年度の外の時期は「前年度」「来年度」を添える(同じ4月が2つ並んでも分かるように)。
        const when = window.start < yearStart(state.fy) ? '前年度 ' : window.start > yearEnd(state.fy) ? '来年度 ' : '';
        const base = {
          label: def.label, type: def.type, title: Boolean(def.title),
          period: `${when}${dateLabel(window.start).replace(/日\(.\)$/, '日')}〜${dateLabel(window.end).replace(/日\(.\)$/, '日')}`,
          started: Boolean(stage), done: Boolean(stage?.done), you: Boolean(stage?.user), out: Boolean(stage?.userOut),
        };
        if (!stage) return base;
        return { ...base, ...stageDetail(state, cycle, stage, def) };
      }),
    })),
  };
}

function stageDetail(state, cycle, stage, def) {
  if (stage.type === 'series') {
    const games = (stage.rounds ?? []).flat().map((id) => state.games[id]).filter(Boolean);
    const seriesA = stage.series.a;
    return {
      series: {
        a: card(state, stage.series.a),
        b: card(state, stage.series.b),
        wins: [stage.series.wins[stage.series.a] ?? 0, stage.series.wins[stage.series.b] ?? 0],
        need: stage.series.need,
        maxGames: stage.series.need * 2 - 1,
        // 局ごとの星(aから見た○●)・日付・aの先後・観戦できるか。
        games: games.map((game, index) => ({
          no: index + 1,
          id: game.id,
          date: dateLabel(game.date),
          winner: game.winner ? ((game.winner === 'a' ? game.a : game.b) === seriesA ? 'a' : 'b') : null,
          aColor: game.a === seriesA ? 'black' : 'white',
          watch: canWatchGame(game),
        })),
      },
      winners: stage.winners.map((id) => card(state, id)),
    };
  }
  if (stage.type === 'league') {
    return {
      groups: stage.groups.map((group) => ({
        name: group.name,
        rows: leagueRows(state, group).map((row, index) => ({ rank: index + 1, ...card(state, row.id), wins: row.wins, losses: row.losses })),
      })),
      winners: stage.winners.map((id) => card(state, id)),
    };
  }
  if (stage.type === 'junni') {
    if (!stage.cls) return { winners: stage.winners.map((id) => card(state, id)) };
    const rows = junniRows(state, stage);
    const mine = rows.findIndex((row) => row.id === PRO_USER_ID);
    return {
      cls: CLASS_NAMES[stage.cls],
      promote: CLASS_RULES[stage.cls]?.promote ?? 0,
      rows: rows.map((row, index) => ({ rank: index + 1, ...card(state, row.id), wins: row.wins, losses: row.losses }))
        .filter((_, index) => index < 6 || Math.abs(index - mine) <= 2),
      winners: stage.winners.map((id) => card(state, id)),
    };
  }
  // トーナメント・ブロック: 竜王戦と同じトーナメント表(記録を作るブロックだけ。自分・羽音のブロックが先)。
  const blocks = stage.blocks ?? [];
  const brackets = blocks
    .filter((block) => block.track && block.slots)
    .map((block) => ({ name: block.name, ...blockBracket(state, cycle, stage, def, block) }))
    .sort((x, y) => Number(y.you) - Number(x.you) || Number(y.rival) - Number(x.rival));
  // 記録を作らないブロックは、勝ち上がった人の名前だけ(決まったら)。
  const advanced = blocks.filter((block) => !block.track).map((block) => {
    const alive = block.alive.filter(Boolean);
    return { name: block.name, winner: alive.length === 1 ? card(state, alive[0]) : null };
  });
  const mineIndex = blocks.findIndex((block) => (block.history ?? []).some((game) => game[0] === PRO_USER_ID || game[1] === PRO_USER_ID) || block.alive.includes(PRO_USER_ID));
  const shown = blocks[mineIndex >= 0 ? mineIndex : 0];
  const pendingRound = (stage.rounds.at(-1) ?? []).map((id) => state.games[id]).filter((game) => game && !game.winner && blocks.indexOf(shown) >= 0
    && [game.a, game.b].some((pid) => shown.alive.includes(pid)));
  return {
    block: shown ? {
      name: shown.name,
      games: [
        ...(shown.history ?? []).map(([a, b, winner]) => ({ a: card(state, a), b: card(state, b), winner: winner === a ? 'a' : 'b' })),
        ...pendingRound.map((game) => ({ a: card(state, game.a), b: card(state, game.b), winner: null })),
      ],
    } : null,
    blockCount: blocks.length,
    brackets,
    others: advanced,
    winners: stage.winners.map((id) => card(state, id)),
  };
}

/** 文字列の種(中継の項目のseed。`relay-game.mjs`の`relaySeed`と同じ考え方の小さなハッシュ。棋譜の処理を読み込まないため)。 */
function textSeed(text) {
  let hash = 2166136261;
  for (const char of String(text)) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** 観戦できる対局か(決着した、自分の出ない、まねの記録のある対局)。 */
const canWatchGame = (game) => Boolean(game && !game.user && game.winner && game.rec);

/**
 * 記録を作るブロックの、竜王戦と同じ形のトーナメント表(`ryuo-stages.mjs`の`matchBracket`の形。`RyuoBracket.vue`に渡す)。
 * 最初の並び(slots)と対局の歩み(history)から、試合の札を組み直す。空き(null)は不戦勝で次の回戦へ上がる。
 * 2人で止める表(新人王戦)の決勝は、次の段階の三番勝負の勝者。
 */
function blockBracket(state, cycle, stage, def, block) {
  const nodes = {};
  const gameIds = {};
  let count = 0;
  let sides = block.slots.map((pid) => (pid ? { pid } : null));
  let round = 0;
  const history = block.history ?? [];
  const games = Object.values(state.games).filter((game) => game.cycle === cycle.id && game.stage === stage.index);
  const pidOf = (side) => side?.pid ?? nodes[side?.from]?.winner ?? null;
  while (sides.length > 1) {
    round += 1;
    const next = [];
    for (let index = 0; index < sides.length; index += 2) {
      const [x, y] = [sides[index], sides[index + 1]];
      if (x && y) {
        const id = `${block.name || 'main'}-${round}-${index / 2}`;
        count += 1;
        const node = { id, round, a: x, b: y, winner: null, game: null };
        nodes[id] = node;
        const [pa, pb] = [pidOf(x), pidOf(y)];
        if (pa && pb) {
          const done = history.find(([a, b]) => (a === pa && b === pb) || (a === pb && b === pa));
          if (done) node.winner = done[2];
          const game = games.find((entry) => (entry.a === pa && entry.b === pb) || (entry.a === pb && entry.b === pa));
          if (game) gameIds[id] = game.id;
        }
        next.push({ from: id });
      } else next.push(x ?? y ?? null);
    }
    sides = next;
  }
  const root = sides[0]?.from ? { from: sides[0].from } : null;
  // 2人で止めた表は、決勝を次の段階(決勝三番勝負)の勝者で埋める。
  if (stage.finalists && root && !nodes[root.from].winner) {
    const final = cycle.stages[stage.index + 1];
    if (final?.done) nodes[root.from].winner = final.winners[0] ?? null;
  }
  const total = round;
  const roundLabel = (value) => (stage.finalists && value === total ? '決勝三番勝負' : roundName({ type: def.type, finalists: stage.finalists }, value - 1, total - (stage.finalists ? 1 : 0)));
  const pendingGame = state.pending ? state.games[state.pending.gameId] : null;
  const pendingNodeId = pendingGame && pendingGame.cycle === cycle.id && pendingGame.stage === stage.index
    ? Object.keys(gameIds).find((id) => gameIds[id] === pendingGame.id) ?? null
    : null;
  const view = root ? matchBracket({ nodes, root, rounds: total }, {
    brief: (pid) => ({ name: nameOf(state, pid), dan: state.players[pid]?.dan ?? '', story: state.players[pid]?.story ?? null }),
    roundLabel,
    pendingNodeId,
  }) : { rounds: [], matches: [], leafCount: 0, userNext: null };
  void count;
  // 観戦できる試合(札の▶)と、その対局のid。
  const watch = Object.fromEntries(Object.entries(gameIds).filter(([, id]) => canWatchGame(state.games[id])));
  return {
    view,
    watch,
    you: block.slots.includes(PRO_USER_ID),
    rival: block.slots.some((pid) => state.players[pid]?.story === HANANE),
  };
}

/**
 * 観戦(10-2の2)の中継の項目(`relay-games.mjs`の項目と同じ形)。決着した、自分の出ない、まねの記録のある対局だけ。
 * @param {any} state
 * @param {string} gameId
 */
export function proYearRelayGame(state, gameId) {
  const game = state?.games?.[gameId];
  if (!canWatchGame(game)) return null;
  const event = proEvent(game.event);
  const def = event.stages[game.stage];
  const stage = state.cycles[game.cycle]?.stages[game.stage];
  const blackId = game.rec.b === 'a' ? game.a : game.b;
  const whiteId = blackId === game.a ? game.b : game.a;
  const winnerId = game.winner === 'a' ? game.a : game.b;
  const held = (id) => TITLE_EVENTS.filter((eventId) => state.titles[eventId] === id).map((eventId) => proEvent(eventId).short);
  const relayPlayer = (id) => {
    const player = state.players[id];
    return {
      id, name: player?.name ?? '', dan: player?.dan ?? '', rating: player?.rating ?? 0, level: null, story: player?.story ?? null,
      kind: 'pro', age: player?.age ?? null, character: player?.character ?? null, repertoire: player?.repertoire ?? null, held: held(id),
    };
  };
  const key = `pro-year:${state.seed}:${game.cycle}:${game.id}`;
  const series = stage?.series && def.type === 'series' ? (() => {
    const ids = stage.rounds.flat();
    const before = ids.slice(0, ids.indexOf(game.id)).map((id) => state.games[id]).filter((entry) => entry?.winner);
    const wins = { [stage.series.a]: 0, [stage.series.b]: 0 };
    for (const entry of before) wins[entry.winner === 'a' ? entry.a : entry.b] += 1;
    return { holder: stage.series.a === blackId ? 'black' : 'white', need: stage.series.need, wins: { black: wins[blackId] ?? 0, white: wins[whiteId] ?? 0 } };
  })() : null;
  // 二日制のタイトル戦だけ二日制の持ち時間(中継のfinals)。ほかの番勝負は1日の大一番。
  const kind = def.title && def.twoDay ? 'finals' : def.type === 'series' ? 'playoff' : 'game';
  const players = [blackId, whiteId].map((id) => state.players[id]);
  return {
    key, event: 'pro-year', kind, label: gameLabel(state, game), section: 'pro-year', order: 0, round: game.round + 1,
    weight: def.title ? 'title' : def.type === 'series' || /決勝$/.test(gameLabel(state, game)) ? 'big' : 'plain',
    // 大会の規模(docs/tournament-relay-design.mdの48章)。一次予選は小さく、本戦・リーグは大きい。
    scale: def.title ? 'title' : def.type === 'series' || /決勝$/.test(gameLabel(state, game)) ? 'big'
      : def.type === 'blocks' ? (def.id === 'q1' ? 'local' : 'small') : def.type === 'junni' ? 'mid' : 'upper',
    venue: def.title ? stageVenue('ryuo', state.fy, game.round + 1) : '', gameNo: def.type === 'series' ? game.round + 1 : 0,
    seed: textSeed(key), series, quality: '', titleName: def.title ? event.short : '',
    black: relayPlayer(blackId), white: relayPlayer(whiteId),
    winner: winnerId === blackId ? 'black' : 'white',
    openings: { black: null, white: null }, castles: { black: null, white: null },
    story: Array.isArray(game.rec.s) && game.rec.s.length ? game.rec.s : null,
    how: game.rec.how ?? 'ending',
    noNews: true,
    tags: {
      rival: players.some((player) => player?.story === HANANE),
      father: players.some((player) => player?.story === YOSHIHIKO),
      oshi: false, next: false, self: false, current: false,
    },
  };
}

// ---- 保存

/** 勝ち方の短い番号(保存を小さくする)。`ryuo-simulation.mjs`の`classifyWin`の値。 */
const HOW_CODES = Object.freeze(['opening', 'middle', 'ending', 'comeback', 'recover']);

/**
 * 保存の形(棋士は名前・強さ・段位・組・年齢・人物だけ。棋風と得意戦法は、読むときに名簿から付け直す)。
 * @param {any} state
 */
export function packProYear(state) {
  if (!state) return null;
  const players = Object.fromEntries(Object.values(state.players).map((member) => [member.id, {
    n: member.name, r: member.rating, d: member.dan, g: member.group, a: member.age, s: member.story ?? null, k: member.kind, ...(member.you ? { y: 1 } : {}),
  }]));
  // 対局は[番号, 期, 段階, 回戦, 先, 後, 日, 勝ち(0まだ・1先・2後), 印(1自分・2二日制・4分身), 組, 名前の札(自分の対局だけ)]。
  const games = Object.values(state.games).map((game) => {
    const row = [Number(String(game.id).slice(1)), game.cycle, game.stage, game.round, game.a, game.b, game.date,
      game.winner === 'a' ? 1 : game.winner === 'b' ? 2 : 0, (game.user ? 1 : 0) | (game.twoDay ? 2 : 0) | (game.auto ? 4 : 0), game.k ?? 0];
    if (game.user) row.push(game.label ?? '');
    // 観戦のまねの記録: [先手(0=a・1=b), 勝ち方, 形勢の線…]。
    else if (game.rec) row.push('', [game.rec.b === 'b' ? 1 : 0, HOW_CODES.indexOf(game.rec.how), ...(game.rec.s ?? [])]);
    return row;
  });
  return { ...state, players, games };
}

/**
 * 保存から戻す。名簿にいる棋士は、棋風・得意戦法・戦法を名簿から付け直す(強さは保存のまま。名簿から外れた棋士はそのまま)。
 * @param {any} packed
 * @param {any} roster
 */
export function unpackProYear(packed, roster) {
  if (!packed || packed.version !== 1) return null;
  const players = {};
  for (const [id, entry] of Object.entries(packed.players ?? {})) {
    const source = roster?.players?.[id];
    players[id] = { id, name: entry.n, rating: entry.r, dan: entry.d, group: entry.g, age: entry.a, story: entry.s, kind: entry.k ?? 'pro' };
    if (entry.y) players[id].you = true;
    else Object.assign(players[id], { style: source?.style ?? null, repertoire: source?.repertoire ?? null, character: source?.character ?? null });
  }
  const games = {};
  for (const row of Array.isArray(packed.games) ? packed.games : []) {
    if (!Array.isArray(row)) continue;
    const [number, cycle, stage, round, a, b, date, won, flags, k, label, rec] = row;
    const game = { id: `g${number}`, cycle, event: String(cycle).split('-')[0], stage, round, a, b, date, winner: won === 1 ? 'a' : won === 2 ? 'b' : null };
    if (k) game.k = k;
    if (flags & 2) game.twoDay = true;
    if (flags & 4) game.auto = true;
    if (flags & 1) {
      game.user = true;
      game.label = label ?? '';
    } else if (Array.isArray(rec)) {
      game.rec = { b: rec[0] === 1 ? 'b' : 'a', how: HOW_CODES[rec[1]] ?? 'ending', s: rec.slice(2) };
    }
    games[game.id] = game;
  }
  // 暮らしの記録のない前の保存は、0で埋める(版はそのまま。10-2の7)。
  const user = { money: 0, gear: 0, fans: 0, crowns: 0, sinceWins: 0, titleCounts: {}, ...(packed.user ?? {}) };
  // 段位の記録のない前の保存(15-3の5): 年度の始めの段は今の段。
  user.danAtStart ??= players[PRO_USER_ID]?.dan ?? '四段';
  const year = { ...emptyYear(), ...(packed.year ?? {}) };
  const restored = { ...packed, players, games, user, year };
  if (!restored.study) restored.study = emptyStudy(restored);
  // 5人と絆のない前の保存(15-3の9): 5人を選び、全員段1から。
  if (!restored.people) restored.people = pickPeople(players, { seed: restored.seed ?? 0, studyMembers: restored.study.members ?? [], userId: PRO_USER_ID });
  if (!restored.bonds) restored.bonds = emptyBonds(restored.people);
  for (const id of Object.values(restored.people)) if (id && !restored.bonds[id]) restored.bonds[id] = { points: 0, seen: [] };
  // 週の形のない前の保存は、今の日の週から(13-3の12)。
  if (!Number.isFinite(restored.condition)) restored.condition = CONDITION_DEFAULT;
  if (!restored.prep) restored.prep = { id: null, stars: 0 };
  if (!restored.week?.start) restored.week = newWeek(restored, restored.date);
  // 分身・ニュースのない前の保存(14-3の7)。
  if (!restored.avatar?.exp) restored.avatar = emptyAvatar();
  if (!Array.isArray(restored.news)) restored.news = [];
  if (!Array.isArray(restored.letters)) restored.letters = [];
  if (restored.interview === undefined) restored.interview = null;
  if (restored.work === undefined) restored.work = null;
  return restored;
}

/**
 * @param {Storage | null | undefined} storage
 * @param {any} [roster]
 */
export function loadProYear(storage, roster = null) {
  try {
    return unpackProYear(JSON.parse(storage?.getItem(PRO_YEAR_KEY) ?? 'null'), roster);
  } catch {
    return null;
  }
}

/** @param {Storage | null | undefined} storage */
export function saveProYear(storage, state) {
  try {
    if (state) storage?.setItem(PRO_YEAR_KEY, JSON.stringify(packProYear(state)));
    else storage?.removeItem(PRO_YEAR_KEY);
  } catch {
    // 保存できなくても遊べる。
  }
}
