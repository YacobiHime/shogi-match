// 棋士の1年(docs/pro-year-design.md)。新四段として4月1日から1年度を過ごし、カレンダーの対局日に、
// 八大タイトルと一般棋戦の対局を指す。棋戦の1回り(期)は年度をまたぐので、期ごとに段階(予選・本戦・リーグ・番勝負)と
// 時期を持ち、日付の順に進める。プレイヤーの対局の日が来たら止まり、記録を待つ。画面・保存の仕組みに依存しない。
// 名簿(棋士の世界)は読むだけで書き戻さない(竜王戦・名人戦の期とは別の暦。docs/meijin-design.mdの13章の案B)。

import { createRng, pick } from './ryuo-random.mjs';
import { simulateMemberGame } from './ryuo-simulation.mjs';
import { pickGameStyle } from './ryuo-repertoire.mjs';
import { HANANE, YOSHIHIKO, hananeBeforeLine } from './ryuo-story.mjs';
import { MAX_CPU_LEVEL, isRealWorld, recommendedWorldLevel, worldCpuLevel, worldRating } from './ryuo-strength.mjs';
import { CLASS_RULES } from './meijin.mjs';

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
          countRecord(state, winner, aWins ? b : a);
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
  if (def.title) {
    state.titles[event.id] = stage.winners[0] ?? cycle.holder;
    closeCycle(cycle, stage.winners[0] ?? cycle.holder);
    return;
  }
  if (stage.index === event.stages.length - 1) {
    closeCycle(cycle, stage.winners[0] ?? null);
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
    countRecord(state, aWins ? a : b, aWins ? b : a);
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
  stage.winners = [stage.cls === 'A' && place === 1 ? PRO_USER_ID : junniAWinner(state, rng)];
  finishStage(state, cycle, stage, rng);
}

/** 順位の行(勝ち数、同じなら前の期の順位=並びの順)。 */
function junniRows(state, stage) {
  return stage.members
    .map((id, order) => ({ id, order, wins: stage.wins[id] ?? 0, losses: stage.losses[id] ?? 0 }))
    .sort((a, b) => b.wins - a.wins || a.order - b.order);
}

/** A級の1位(プレイヤーのいないA級は、総当たりを勝率で決める)。 */
function junniAWinner(state, rng) {
  const members = (state.junni.A ?? []).filter((id) => state.players[id]);
  const wins = Object.fromEntries(members.map((id) => [id, 0]));
  for (let i = 0; i < members.length; i += 1) {
    for (let j = i + 1; j < members.length; j += 1) {
      const aWins = simulateMemberGame(rng, state.players[members[i]], state.players[members[j]]).aWins;
      wins[aWins ? members[i] : members[j]] += 1;
    }
  }
  return members.sort((a, b) => wins[b] - wins[a])[0] ?? null;
}

export const CLASS_NAMES = Object.freeze({ A: 'A級', B1: 'B級1組', B2: 'B級2組', C1: 'C級1組', C2: 'C級2組' });

// ---- 記録

function countRecord(state, winner, loser) {
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
  }
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
    const aWins = simulateMemberGame(rng, state.players[game.a], state.players[game.b], { big }).aWins;
    game.winner = aWins ? 'a' : 'b';
    countRecord(state, aWins ? game.a : game.b, aWins ? game.b : game.a);
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

/** プレイヤーの対局の相手・Lv・先後・戦法。 */
function setPending(state, game, rng) {
  const opponentId = game.a === PRO_USER_ID ? game.b : game.a;
  const opponent = state.players[opponentId];
  const world = Number.isFinite(state.settings?.world) ? state.settings.world : recommendedWorldLevel(state.userLevel ?? 20);
  // 相手のLv(大会の世界の物差し)は、棋士の写しに書かず、pendingに持つ(保存から戻しても同じ。対局画面は`proYearSeason`で付ける)。
  const level = isRealWorld(world) && opponent.story === YOSHIHIKO ? MAX_CPU_LEVEL : worldCpuLevel(opponent.rating, world);
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
  const opponent = state.players[state.pending.opponentId];
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
  if (state.pending || state.yearDone) return state;
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
export function recordProGame(source, outcome) {
  const state = structuredClone(source);
  const pending = state.pending;
  if (!pending) return { state, replay: false };
  if (outcome === 'draw') {
    state.pending = { ...pending, color: pending.color === 'black' ? 'white' : 'black', replay: true };
    return { state, replay: true };
  }
  const rng = createRng(state.rng);
  const game = state.games[pending.gameId];
  let won = outcome === 'win';
  if (outcome === 'auto') {
    won = simulateMemberGame(rng, state.players[PRO_USER_ID], state.players[pending.opponentId]).aWins;
    game.auto = true;
  }
  game.winner = (game.a === PRO_USER_ID) === won ? 'a' : 'b';
  countRecord(state, won ? PRO_USER_ID : pending.opponentId, won ? pending.opponentId : PRO_USER_ID);
  // 羽音との通算(年度をまたいで数える。対局前の羽音の一言に使う)。
  if (state.players[pending.opponentId]?.story === HANANE) {
    const vs = state.user.vsHanane ?? { wins: 0, losses: 0 };
    state.user.vsHanane = won ? { ...vs, wins: vs.wins + 1 } : { ...vs, losses: vs.losses + 1 };
  }
  state.pending = null;
  state.lastGame = { id: game.id, won, auto: outcome === 'auto' };
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
  return { state, replay: false, won, game: { ...game }, milestones, champions };
}

// ---- 年度

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
  return { fy: state.fy, wins: mine.w, losses: mine.l, rate, best: mine.best, awards, titles, junni: state.user.junniResult ?? null, rival };
}

/** 次の年度へ(順位戦のクラス・竜王戦の組・シードを持ち越す)。 */
export function startNextYear(source) {
  const state = structuredClone(source);
  if (!state.yearDone) return state;
  const rng = createRng(state.rng);
  const result = state.user.junniResult;
  if (result?.promoted) state.user.cls = { C2: 'C1', C1: 'B2', B2: 'B1', B1: 'A', A: 'A' }[result.cls] ?? result.cls;
  state.user.junniResult = null;
  state.history = [...(state.history ?? []), state.summary].slice(-20);
  state.fy += 1;
  state.date = yearStart(state.fy);
  state.year = { records: {} };
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
  state.rng = rng.state;
  return state;
}

/**
 * 棋士の1年を始める(新四段のデビュー)。
 * @param {{ seed: number, fiscalYear: number, roster: any, settings?: any, userLevel?: number, userName?: string, userGroup?: number }} options
 */
export function createProYear({ seed, fiscalYear, roster, settings = {}, userLevel = 20, userName = '', userGroup = 6 }) {
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
    user: { cls: userClass, group: clamp(Math.round(userGroup), 1, 6), seeds: {} },
    cycles: {},
    games: {},
    nextGame: 1,
    pending: null,
    year: { records: {} },
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
  state.year = { records: {} };
  state.log = [];
  state.rng = rng.state;
  return state;
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
  const pending = state.pending ? {
    ...state.pending,
    dateText: dateLabel(state.pending.date),
    opponent: card(state, state.pending.opponentId),
    // 羽音と当たる日は、対局の前に羽音の一言(3章の13)。
    hananeLine: state.players[state.pending.opponentId]?.story === HANANE ? hananeBeforeLine(vsHanane) : '',
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
  return { date: next.pending.date, dateText: dateLabel(next.pending.date), label: next.pending.label };
}

/** カレンダーのマスの印(その日の対局)。kind: user(自分の対局)・title(タイトル戦)・rival(羽音)・plan(自分が勝ち残っていれば指す日)。 */
function dayItems(state, date) {
  const items = [];
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

/** 月のカレンダー(週ごとの7マス。日曜はじまり)。 */
export function monthView(state, year, month) {
  const first = `${year}-${pad(month)}-01`;
  const start = addDays(first, -weekdayOf(first));
  const weeks = [];
  let day = start;
  for (let week = 0; week < 6; week += 1) {
    const row = [];
    for (let index = 0; index < 7; index += 1) {
      const inMonth = day.slice(0, 7) === first.slice(0, 7);
      row.push({ date: day, day: Number(day.slice(8)), inMonth, today: day === state.date, past: day < state.date, items: inMonth ? dayItems(state, day) : [] });
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
        twoDay: Boolean(game.twoDay),
      };
    }).sort((x, y) => Number(y.user) - Number(x.user)),
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
        const base = { label: def.label, type: def.type, period: `${when}${dateLabel(window.start).replace(/日\(.\)$/, '日')}〜${dateLabel(window.end).replace(/日\(.\)$/, '日')}`, started: Boolean(stage), done: Boolean(stage?.done) };
        if (!stage) return base;
        return { ...base, ...stageDetail(state, stage) };
      }),
    })),
  };
}

function stageDetail(state, stage) {
  if (stage.type === 'series') {
    const games = (stage.rounds ?? []).flat().map((id) => state.games[id]).filter(Boolean);
    return {
      series: {
        a: card(state, stage.series.a),
        b: card(state, stage.series.b),
        wins: [stage.series.wins[stage.series.a] ?? 0, stage.series.wins[stage.series.b] ?? 0],
        need: stage.series.need,
        games: games.map((game) => ({ date: dateLabel(game.date), winner: game.winner ? (game.winner === 'a' ? game.a : game.b) === stage.series.a ? 'a' : 'b' : null })),
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
  // トーナメント・ブロック: 自分のいるブロック(なければ1つ目)の対局の歩みと、勝ち上がった人。
  const blocks = stage.blocks ?? [];
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
    winners: stage.winners.map((id) => card(state, id)),
  };
}

// ---- 保存

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
    const [number, cycle, stage, round, a, b, date, won, flags, k, label] = row;
    const game = { id: `g${number}`, cycle, event: String(cycle).split('-')[0], stage, round, a, b, date, winner: won === 1 ? 'a' : won === 2 ? 'b' : null };
    if (k) game.k = k;
    if (flags & 2) game.twoDay = true;
    if (flags & 4) game.auto = true;
    if (flags & 1) {
      game.user = true;
      game.label = label ?? '';
    }
    games[game.id] = game;
  }
  return { ...packed, players, games };
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
