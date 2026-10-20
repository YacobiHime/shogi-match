// 竜王戦の物語の人物。名簿の乱数の棋士とは別に、決まった名前・強さ・個性・台詞を持つ。
// - 天鷺羽音(あまさぎ はのん): プレイヤーのライバル。三段リーグを突破した新四段の女子高生。
// - 天鷺善彦(あまさぎ よしひこ): 羽音の父。史上最強と言われる名人。絵と台詞はない。
// 登場する人物はすべて架空。設計は docs/hanane-rival-design.md。画面に依存しない。

import { CHAMPION_RATING } from './ryuo-data.mjs';
import { GROUP_MEAN_RATING, GROUP_RATING_SPREAD } from './ryuo-strength.mjs';
import { styleEntry } from './ryuo-repertoire.mjs';
import { JUNNI_CLASSES, JUNNI_SIZES, createRecord } from './ryuo-league.mjs';

export const HANANE = 'hanane';
export const YOSHIHIKO = 'yoshihiko';

/** 羽音の強さ: その組の平均より、ばらつきの2倍上(組のおよそ上位2%。6組なら2組の平均に近い)。 */
export const HANANE_RATING_SIGMA = 2;
/**
 * プレイヤーと同じランキング戦の表で、羽音がほかの棋士と指す自動対局だけに足すレーティング。
 * ライバルは勝ち上がってきて、組の決勝で待つ(山場。D:4-4)。プレイヤーとの対局と、ほかの組・棋界の1年には足さない。
 */
export const HANANE_RIVAL_RUN_RATING = 120;
/** 一度プレイヤーに負けたあと(「絶対に許さないリスト」のあと)、プレイヤーとの対局で上乗せするレーティング。重ねない。 */
export const HANANE_GRUDGE_RATING = 40;

/** 羽音の絵。37×80ドットを8倍にした、劣化のない透過webp。差し替えたらversionを上げる。 */
export const HANANE_SPRITE = Object.freeze({ file: 'hanane-mini.webp', version: 1, dots: { width: 37, height: 80 } });
/** やこび姫の絵(yakobihime-mini.webp)の縦のドット数。並べるときに、1ドットの大きさをそろえる。 */
export const YAKOBIHIME_SPRITE_DOTS = 53;

/** 人物の定義。characterは名簿の棋士と同じ形(player-character.mjs)。 */
export const STORY_PEOPLE = Object.freeze({
  [HANANE]: Object.freeze({
    name: '天鷺羽音',
    reading: 'あまさぎ はのん',
    age: 17,
    repertoire: { party: 'static', styles: ['aigakari', 'kakugawari'] },
    character: { attack: 0, traits: [{ id: 'deep-reading', degree: 2 }, { id: 'tsume', degree: 2 }, { id: 'late-bloom', degree: 2 }] },
    intro: '三段リーグを突破した新四段の女子高生。天鷺善彦名人の娘。読みの深さ・速さ・正確さがずば抜けていて、力戦でも崩れない。',
  }),
  [YOSHIHIKO]: Object.freeze({
    name: '天鷺善彦',
    reading: 'あまさぎ よしひこ',
    age: 52,
    repertoire: { party: 'both', styles: ['kakugawari', 'yagura', 'shiken-mino'] },
    character: { attack: 0, traits: [{ id: 'deep-reading', degree: 2 }, { id: 'opening-study', degree: 2 }, { id: 'middle-strong', degree: 2 }] },
    // 史上最強と言われる通算の記録(竜王を除くタイトルの期数)。竜王はryuoで持つ。
    titleCounts: { meijin: 12, oi: 13, eio: 3, oza: 19, kio: 13, osho: 12, kisei: 16 },
    ryuo: 7,
    totalRecord: { wins: 1480, losses: 430 },
    intro: '史上最強と言われる名人。天鷺羽音の父。',
  }),
});

/** 物語の人物の名簿のid。いなければnull。 */
export function storyMemberId(roster, story) {
  return Object.values(roster?.players ?? {}).find((member) => member.story === story)?.id ?? null;
}

/** 羽音が入る組のレーティング。 */
export function hananeRating(group) {
  return Math.round(GROUP_MEAN_RATING[group] + HANANE_RATING_SIGMA * GROUP_RATING_SPREAD[group]);
}

/** 新四段が、その組にいるときの段位(竜王戦の昇段規定: 2組で六段、1組で七段)。 */
function hananeDan(group) {
  if (group === 1) return '七段';
  if (group === 2) return '六段';
  return '四段';
}

function storyMember(roster, story, { group, rating, dan }) {
  const person = STORY_PEOPLE[story];
  const id = `r${roster.nextId}`;
  roster.nextId += 1;
  const member = {
    id,
    story,
    name: person.name,
    kind: 'pro',
    group,
    dan,
    rating,
    age: person.age,
    since: roster.season,
    ryuo: person.ryuo ?? 0,
    titleCounts: { ...(person.titleCounts ?? {}) },
    awards: [],
    record: createRecord(),
    junni: null,
    repertoire: structuredClone(person.repertoire),
    character: structuredClone(person.character),
  };
  member.style = styleEntry(member.repertoire.styles[0]);
  if (person.totalRecord) member.record.total = { ...person.totalRecord };
  roster.players[id] = member;
  return member;
}

/**
 * 物語の人物を名簿に加える(いなければ)。加えた人物を返す。
 * 羽音はプレイヤーの組(プレイヤーが竜王なら1組)、善彦は1組。順位戦は、羽音がC級2組、善彦がA級。
 * fresh(最初の名簿)なら、善彦に名人を持たせる。保存してあった名簿では、タイトルの記録を書き換えない。
 * @param {any} roster
 * @param {{ userGroup?: number, userIsChampion?: boolean, fresh?: boolean }} [options]
 */
export function addStoryMembers(roster, { userGroup = 6, userIsChampion = false, fresh = false } = {}) {
  const added = [];
  if (!storyMemberId(roster, YOSHIHIKO)) {
    added.push(storyMember(roster, YOSHIHIKO, { group: 1, rating: CHAMPION_RATING, dan: '九段' }));
  }
  if (!storyMemberId(roster, HANANE)) {
    const group = userIsChampion ? 1 : userGroup;
    added.push(storyMember(roster, HANANE, { group, rating: hananeRating(group), dan: hananeDan(group) }));
  }
  for (const member of added) placeJunni(roster, member, member.story === YOSHIHIKO ? 'A' : 'C2');
  if (fresh) {
    const father = roster.players[storyMemberId(roster, YOSHIHIKO)];
    if (father && roster.titles) {
      roster.titles.meijin = father.id;
      const last = [...(roster.titleHistory ?? [])].reverse().find(({ title }) => title === 'meijin');
      if (last) Object.assign(last, { holder: father.id, name: father.name, changed: false });
    }
  }
  return added;
}

/**
 * 順位戦のクラスに入れる。定員を超えたクラスは、いちばん弱い人(名人と物語の人物を除く)を1つ下へ送り、
 * C級2組まで順に定員をそろえる。C級2組からあふれたら、いちばん年上の人をフリークラスへ(最初の名簿の決まりと同じ)。
 */
function placeJunni(roster, member, cls) {
  member.junni = cls;
  const movable = (list) => list.filter((other) => other.id !== roster.titles?.meijin && !other.story);
  for (let index = JUNNI_CLASSES.indexOf(cls); index < JUNNI_CLASSES.length - 1; index += 1) {
    const current = JUNNI_CLASSES[index];
    const inClass = Object.values(roster.players).filter((other) => other.kind === 'pro' && other.junni === current);
    if (inClass.length <= JUNNI_SIZES[current]) break;
    const candidates = movable(inClass).sort(current === 'C2' ? (a, b) => b.age - a.age : (a, b) => a.rating - b.rating);
    if (candidates[0]) candidates[0].junni = JUNNI_CLASSES[index + 1];
  }
}

/** プレイヤーとの対局で使う羽音のレーティングの上乗せ。一度プレイヤーに負けていれば、+40。 */
export function hananeGrudgeBonus(member, vsUser) {
  return member?.story === HANANE && (vsUser?.wins ?? 0) > 0 ? HANANE_GRUDGE_RATING : 0;
}

// ---- 台詞

/**
 * 羽音の台詞。場面ごとに候補を並べ、対局の回数で順に回す(同じ文を続けて出さない)。
 * 書き方: 短く平らに話す。感嘆符を使わない。プレイヤーは「あなた」。
 */
export const HANANE_LINES = Object.freeze({
  first: ['天鷺羽音。……よろしく。', 'あなたの棋譜、少しだけ見た。規則性は、まだ見えない。'],
  againAhead: ['同じ形なら、同じ結果になるよ。', '前の対局、もう一度並べてきた。今日も同じ手順で行く。'],
  againGrudge: ['リストの名前は、まだ消してない。', '今日は、手を緩めない。'],
  won: ['読み通り。……どう、当たってる？', '受け取ってばかりじゃいられないでしょ？ 次はあなたの番。'],
  firstLoss: ['これは絶対に許さないリスト。勿論、あなたの名前も入っている。今後、あなたとの勝負で手を緩める気は無い。'],
  lost: ['私は、自分が一番だと思ったことなんて、一度も無いよ。', 'その手、確率で言えば低かった。でも、正しかった。'],
  champion: ['願いを全部叶えられるのは突き抜けた天才だけだよ。残念だけど、私はそうじゃない。……だから、次は私が勝つ。'],
  father: ['父さんの将棋は、規則性が見えない。だから強いんだと思う。'],
});

const pick = (lines, count) => lines[Math.abs(count) % lines.length];

/**
 * 対局前の羽音の一言。vsUserは、これまでのプレイヤーとの対戦成績(プレイヤーから見た勝ち・負け)。
 * @param {{ wins: number, losses: number } | null | undefined} vsUser
 */
export function hananeBeforeLine(vsUser) {
  const wins = vsUser?.wins ?? 0;
  const losses = vsUser?.losses ?? 0;
  if (!wins && !losses) return pick(HANANE_LINES.first, 0);
  if (wins > 0) return pick(HANANE_LINES.againGrudge, wins + losses);
  return pick(HANANE_LINES.againAhead, losses);
}

/**
 * 対局後の羽音の一言。userWonは、この対局でプレイヤーが勝ったか。vsUserは、この対局を数える前の対戦成績。
 * @param {{ userWon: boolean, vsUser?: { wins: number, losses: number } | null }} options
 */
export function hananeAfterLine({ userWon, vsUser }) {
  const wins = vsUser?.wins ?? 0;
  const losses = vsUser?.losses ?? 0;
  if (!userWon) return pick(HANANE_LINES.won, losses);
  return wins === 0 ? HANANE_LINES.firstLoss[0] : pick(HANANE_LINES.lost, wins);
}

/** やこび姫が、羽音と当たる対局の前に言う紹介(攻略の手がかりつき)。羽音は自分の弱点を言わない。 */
export function hananeCoachIntro(vsUser) {
  if (!vsUser || !(vsUser.wins + vsUser.losses)) {
    return '次の相手は天鷺羽音さん。天鷺名人の娘で、三段リーグを突破したばかりの新四段だよ。読みがすごく深くて、力戦でも崩れない。終盤ほど強くなるから、序盤のうちにリードを取ろう。';
  }
  if (vsUser.wins > 0) return '羽音さん、前に負けてから本気だよ。序盤でリードを取って、終盤は1手ずつ確かめよう。';
  return 'また羽音さんだね。終盤の正確さは折り紙つき。勝負は序盤だよ。';
}

/** やこび姫が、善彦と当たる対局の前に言う紹介。羽音と対局したことがあれば、羽音の言葉を添える。 */
export function yoshihikoCoachIntro(metHanane) {
  const lines = '天鷺善彦名人は、羽音さんのお父さん。史上最強って言われる人だよ。';
  return metHanane ? `${lines}羽音さんは「${HANANE_LINES.father[0]}」って言ってた。` : lines;
}
