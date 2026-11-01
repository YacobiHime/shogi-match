// 棋士の暮らし(docs/pro-year-design.mdの10章)。棋士の1年の、公式戦のあいだの日の遊び(研究会・将棋まつり)と、
// 対局料・賞金・研究の道具の表。日付と表だけを持つ純粋な処理で、1年の進め方(pro-year.mjs)からも画面からも呼ぶ。
// 金額はゲームの値(実物は非公表のものが多い。単位は万円)。

import { describeCharacter, specialAbilityChips, attackStyleLabel } from './player-character.mjs';
import { repertoireText } from './ryuo-repertoire.mjs';

// ---- 対局料と賞金(10-2の3)

/** 竜王戦のランキング戦の組ごとの対局料(上の組ほど高い)。 */
export const GROUP_FEES = Object.freeze({ 1: 20, 2: 16, 3: 12, 4: 9, 5: 7, 6: 5 });
/** 順位戦のクラスごとの対局料。 */
export const JUNNI_FEES = Object.freeze({ C2: 8, C1: 12, B2: 18, B1: 26, A: 40 });

/**
 * 1局の対局料(勝っても負けても、1局ごと。両者に出る)。
 * @param {{ type: string, title?: boolean, need?: number, cls?: string | null, group?: number | null }} stage
 */
export function gameFee({ type, title = false, need = 1, cls = null, group = null }) {
  if (type === 'blocks') return 5;
  if (type === 'groups') return GROUP_FEES[group ?? 6] ?? 5;
  if (type === 'knockout') return 10;
  if (type === 'league') return 20;
  if (type === 'junni') return JUNNI_FEES[cls ?? 'C2'] ?? 8;
  if (type === 'series') return title ? (need >= 4 ? 100 : 60) : 20;
  return 0;
}

/** 賞金(タイトル獲得・優勝)。 */
export const PRIZES = Object.freeze({
  ryuo: 3000, meijin: 2000, eio: 1000, kisei: 800, oi: 800, oza: 800, osho: 800, kio: 800,
  asahi: 500, nhk: 400, jt: 400, shinjin: 150,
});
export const prizeOf = (eventId) => PRIZES[eventId] ?? 0;

/** 金額の言葉(「1,234万円」)。 */
export const moneyText = (value) => `${Math.round(Number(value) || 0).toLocaleString('ja-JP')}万円`;

// ---- 研究の道具(10-2の4)

/** 研究の道具。買うと、次の公式戦の札に「事前研究」が出る(D:5-1 ご褒美の使い道)。 */
export const GEAR = Object.freeze([
  { level: 1, name: '研究用のノートパソコン', price: 30, prep: '相手の得意戦法が分かる' },
  { level: 2, name: '研究用のデスクトップ', price: 80, prep: 'この対局の作戦と囲いの読みが当たる' },
  { level: 3, name: '研究用の高性能パソコン', price: 200, prep: '相手の特殊能力と棋風まで分かる' },
]);

/**
 * 次に買える道具と、それまでの残り(D:5-2 あと少しが見える)。
 * @param {number} gear いま持っている段(0〜3)
 * @param {number} money 持っているお金
 */
export function nextGear(gear, money) {
  const item = GEAR.find((entry) => entry.level === (gear ?? 0) + 1) ?? null;
  if (!item) return null;
  return { ...item, need: Math.max(0, item.price - (money ?? 0)), affordable: (money ?? 0) >= item.price };
}

/**
 * 事前研究(次の公式戦の札)。道具の段で、分かることが増える。
 * @param {number} gear
 * @param {any} opponent 1年の棋士の写し(repertoire・character)
 * @param {{ label?: string } | null} style この対局の相手の作戦(pending.style)
 * @returns {{ gear: number, repertoire: string, plan: string, attack: string, abilities: string[] } | null}
 */
export function gearPrep(gear, opponent, style) {
  if (!gear || !opponent) return null;
  const prep = { gear, repertoire: '', plan: '', attack: '', abilities: /** @type {string[]} */ ([]) };
  prep.repertoire = opponent.repertoire ? repertoireText(opponent.repertoire) : opponent.style?.label ?? '';
  if (gear >= 2) prep.plan = style?.label ?? '';
  if (gear >= 3) {
    prep.attack = opponent.character ? describeCharacter(opponent.character).style : attackStyleLabel(NaN);
    prep.abilities = specialAbilityChips(opponent.character).map((chip) => chip.label);
  }
  return prep;
}

// ---- 研究会(10-2の5)

const pad2 = (value) => String(value).padStart(2, '0');
const dayOfWeek = (text) => new Date(`${text}T00:00:00Z`).getUTCDay();
const shiftDay = (text, days) => {
  const date = new Date(`${text}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
};

/** 研究会の顔ぶれ(羽音と、同期の若手2人)の人数。 */
export const STUDY_SIZE = 3;

/**
 * その月の研究会の日(第1・第3水曜。自分の公式戦がある日は、翌日の木曜)。
 * @param {number} year
 * @param {number} month 1〜12
 * @param {Set<string>} [busy] 自分の公式戦の日(2日制の1日目も)
 * @returns {string[]}
 */
export function studyDaysOfMonth(year, month, busy = new Set()) {
  const first = `${year}-${pad2(month)}-01`;
  const firstWednesday = shiftDay(first, (3 - dayOfWeek(first) + 7) % 7);
  return [firstWednesday, shiftDay(firstWednesday, 14)].map((day) => (busy.has(day) ? shiftDay(day, 1) : day));
}

/**
 * fromより後、untilより前の研究会の日(多くて月2回)。
 * @param {string} from この日は含まない
 * @param {string} until この日は含まない
 * @param {Set<string>} [busy]
 */
export function studyDaysBetween(from, until, busy = new Set()) {
  const days = [];
  let year = Number(from.slice(0, 4));
  let month = Number(from.slice(5, 7));
  for (let guard = 0; guard < 24; guard += 1) {
    for (const day of studyDaysOfMonth(year, month, busy)) if (day > from && day < until) days.push(day);
    if (`${year}-${pad2(month)}-31` >= until) break;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return days;
}

/** 研究会の言葉(羽音は敬語と「！」なし。docs/hanane-character.md)。 */
export const STUDY_TEXT = Object.freeze({
  label: '研究会 練習対局',
  eventText: '研究会',
  stakes: '公式戦には数えない練習対局',
  /** デビューの日の羽音の誘い(名前は同期の2人)。 */
  invite: (names) => `ねえ、研究会やらない？ 私と、同期の${names.join('と')}で。第1・第3水曜の「研」の日。気が向いたら来て。`,
  detour: '寄り道',
  join: '参加する',
  leave: '今日は帰る',
  coach: '研究会の練習対局だよ。公式戦には数えないから、試したい作戦を指してみよう！',
  mate: '研究仲間',
});

/** 研究会の対局のあとの羽音の一言(勝ち・負け・引き分け。相手が羽音かどうかで変える)。 */
export function studyHananeLine({ won, draw = false, vsHanane = false, count = 0 }) {
  const lines = draw
    ? ['引き分けか。ここ、あとで並べ直そう。', '決着つかなかったね。続きは次の研究会で。']
    : won
      ? vsHanane
        ? ['……今日は君の勝ちだね。いまの順番、あとで一緒に並べよう。', 'へえ、そう来るんだ。次の研究会までに考えておくよ。', '悔しいけど、いい手だった。次は勝つから。']
        : ['へえ、勝ったんだ。どこが良かったか、あとで聞かせて。', 'なるほど。その作戦、公式戦でも使えるでしょ。', 'いい内容だったね。私も見てたよ。']
      : vsHanane
        ? ['今日は私の勝ち。どこで傾いたか、一緒に見よう。', 'まぁ、研究会だから。公式戦で同じ手を指さなければいいよ。', '惜しかったよ。途中までは君のほうが良かったでしょ。']
        : ['負けちゃったか。でも、研究会で負けるのは得だよ。公式戦で同じ負け方をしないから。', 'ここで試せてよかったでしょ。次の公式戦で生きるよ。', '気にしなくていいよ。どこを直すか、もう分かってるでしょ。'];
  return lines[Math.abs(count) % lines.length];
}
