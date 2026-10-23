// 竜王戦の物語の人物。名簿の乱数の棋士とは別に、決まった名前・強さ・個性・台詞を持つ。
// - 天鷺羽音(あまさぎ はのん): プレイヤーのライバル。三段リーグを突破した新四段の女子高生。
// - 天鷺善彦(あまさぎ よしひこ): 羽音の父。史上最強と言われる、竜王を含む六冠のオールラウンダー。絵と台詞はない。
// 登場する人物はすべて架空。設計は docs/hanane-rival-design.md。画面に依存しない。

import { GROUP_MEAN_RATING, GROUP_RATING_SPREAD } from './ryuo-strength.mjs';
import { styleEntry } from './ryuo-repertoire.mjs';
import { defaultCastleShares } from './opening-usage.mjs';
import { balanceDevs, styleAttackOf } from './player-abilities.mjs';
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

/** 善彦のレーティング(名簿でいちばん強い。実物の棋士レーティングの1位(約2120〜2150)に合わせた)。 */
export const YOSHIHIKO_RATING = 2130;
/** 最初の名簿で、善彦が持つタイトル(竜王を含む六冠)。王将と叡王は、ほかの棋士が持つ。 */
export const YOSHIHIKO_TITLES = Object.freeze(['ryuo', 'meijin', 'oi', 'oza', 'kio', 'kisei']);

/** 使用率の表(先手・後手が同じ)と、戦法ごとの囲いを目録のまま使った、使用率の形。 */
function fixedUsage(black, white = black) {
  const castles = {};
  for (const id of new Set([...Object.keys(black), ...Object.keys(white)])) castles[id] = defaultCastleShares(id);
  return { black, white, castles };
}

/**
 * 人物の定義。characterは名簿の棋士と同じ形(player-character.mjs)。abilitiesは、能力の平均からの差(player-abilities.mjs)。
 * 物語の人物も、能力の配分は重みつきの平均が0になるように直す(強さそのものはレーティングと、羽音の補正で決める)。
 */
export const STORY_PEOPLE = Object.freeze({
  [HANANE]: Object.freeze({
    name: '天鷺羽音',
    reading: 'あまさぎ はのん',
    age: 17,
    // 序盤は並み、読み・詰み・終盤がずば抜ける(late-bloom)。若く、調子の波はまだある。
    abilities: { opening: -12, middle: 0, ending: 9, attack: 1, defense: -2, reading: 12, mate: 10, stability: -6 },
    repertoire: {
      party: 'static',
      styles: ['aigakari', 'kakugawari'],
      usage: fixedUsage(
        { aigakari: 40, 'kakugawari-kg': 22, kakugawari: 10, yagura: 10, ibisha: 12, 'kakugawari-45': 6 },
        { aigakari: 36, 'kakugawari-kg': 16, kakugawari: 8, yagura: 12, gangi: 14, ibisha: 14 },
      ),
    },
    character: { traits: [{ id: 'deep-reading', degree: 2 }, { id: 'tsume', degree: 2 }, { id: 'late-bloom', degree: 2 }] },
    // 名鑑では、段位と年齢で言い分ける(hananeIntro)。ここは最初の立場のときの紹介。
    intro: '三段リーグを突破したばかりの新四段。高校に通う、天鷺善彦の娘。読みの深さ・速さ・正確さがずば抜けていて、力戦でも崩れない。',
  }),
  [YOSHIHIKO]: Object.freeze({
    name: '天鷺善彦',
    reading: 'あまさぎ よしひこ',
    // 娘の羽音がまだ高校生なので、40代前半。
    age: 43,
    // 羽生善治を参考にしたオールラウンダー。武器は、中盤の形勢判断(大局観)と、深く正確な読み。ほかもA以上で、穴がない。
    abilities: { opening: -6, middle: 6, ending: 2, attack: -5, defense: -4, reading: 6, mate: -2, stability: 4 },
    repertoire: {
      party: 'both',
      styles: ['kakugawari-kg', 'yagura', 'shiken-mino'],
      // いちばん多い戦法でも2割ほど。居飛車7割・振り飛車3割で、戦法を選ばない。
      usage: fixedUsage(
        { 'kakugawari-kg': 20, yagura: 16, aigakari: 14, kakugawari: 6, gangi: 6, ibisha: 8, shiken: 12, sangen: 8, gokigen: 6, mukai: 4 },
        { 'kakugawari-kg': 14, yagura: 16, aigakari: 14, kakugawari: 4, gangi: 12, ibisha: 10, shiken: 12, sangen: 8, gokigen: 6, mukai: 4 },
      ),
    },
    character: { traits: [{ id: 'grand-view', degree: 1 }, { id: 'demon-reading', degree: 1 }, { id: 'comeback', degree: 1 }] },
    // 史上最強と言われる通算の記録(竜王を除くタイトルの期数)。竜王はryuoで持つ。
    titleCounts: { meijin: 9, oi: 12, eio: 3, oza: 17, kio: 11, osho: 9, kisei: 13 },
    ryuo: 6,
    totalRecord: { wins: 1300, losses: 400 },
    intro: '史上最強と言われる、竜王を含む六冠の棋士。居飛車も振り飛車も指すオールラウンダーで、形勢判断と深く正確な読みが武器。天鷺羽音の父。',
  }),
});

/** 人物の個性(能力の配分と、それから決めた棋風を含む)。 */
export function storyCharacter(story) {
  const person = STORY_PEOPLE[story];
  const abilities = balanceDevs(person.abilities);
  return { attack: styleAttackOf(abilities), traits: person.character.traits.map((trait) => ({ ...trait })), abilities };
}

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
    character: storyCharacter(story),
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
    added.push(storyMember(roster, YOSHIHIKO, { group: 1, rating: YOSHIHIKO_RATING, dan: '九段' }));
  }
  if (!storyMemberId(roster, HANANE)) {
    const group = userIsChampion ? 1 : userGroup;
    added.push(storyMember(roster, HANANE, { group, rating: hananeRating(group), dan: hananeDan(group) }));
  }
  for (const member of added) placeJunni(roster, member, member.story === YOSHIHIKO ? 'A' : 'C2');
  if (fresh) {
    const father = roster.players[storyMemberId(roster, YOSHIHIKO)];
    if (father && roster.titles) crownYoshihiko(roster, father, { withRyuo: !userIsChampion });
  }
  return added;
}

/** 善彦が続けて持っていたことにする、最近の期の数。 */
const YOSHIHIKO_REIGN = 3;

/**
 * 最初の名簿で、善彦に六冠(竜王・名人・王位・王座・棋王・棋聖)を持たせる。プレイヤーが竜王のときは、竜王を除く五冠。
 * 履歴の最近3期を善彦のものに書き換え、その期を持っていたことになっていた棋士の期数を減らす(通算の期数は人物の決まりのまま)。
 */
function crownYoshihiko(roster, father, { withRyuo }) {
  for (const title of YOSHIHIKO_TITLES) {
    if (title === 'ryuo' && !withRyuo) continue;
    const entries = (roster.titleHistory ?? []).filter((entry) => entry.title === title);
    const rewritten = entries.slice(-YOSHIHIKO_REIGN);
    const before = entries.at(-YOSHIHIKO_REIGN - 1) ?? null;
    rewritten.forEach((entry, index) => {
      const previous = entry.holder !== father.id ? roster.players[entry.holder] : null;
      if (previous) {
        if (title === 'ryuo') previous.ryuo = Math.max(0, (previous.ryuo ?? 0) - 1);
        else if (previous.titleCounts?.[title]) previous.titleCounts[title] -= 1;
      }
      Object.assign(entry, { holder: father.id, name: father.name, changed: index === 0 ? before?.holder !== father.id : false });
    });
    if (title === 'ryuo') roster.holder = father.id;
    else roster.titles[title] = father.id;
  }
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
 * 勝敗と対戦歴だけで選ぶので、個別の指し手・読み筋・研究内容を決めつけない。
 */
export const HANANE_LINES = Object.freeze({
  first: ['天鷺羽音。……よろしく。', '天鷺羽音です。あなたと指すの、楽しみにしてた。'],
  againAhead: ['また当たったね。今日もよろしく。', '今日も、勝つつもりで来たよ。'],
  againGrudge: ['前に負けたの、忘れてないよ。今日は勝ちたい。', 'また指せるね。今度は、私が勝つから。'],
  won: ['ありがとうございました。……また指そう。', '今日は私の勝ちだね。次も、よろしく。'],
  firstLoss: ['……負けました。あなたとの対局、忘れない。次は勝つから。'],
  lost: ['……負けました。もう一度、考え直さないと。', '悔しいけど、今日はあなたの勝ち。また指してくれる？'],
  champion: ['ここまで来たんだね。……私も、追いつくから。'],
  father: ['父さんと指すと、いつも考えさせられる。簡単には勝たせてくれないよ。'],
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

/**
 * 羽音のいまの立場の言葉。段位・タイトル・棋士になってからの期数で変わる(七段なのに「新四段」と言わない)。
 * @param {{ dan?: string, held?: string[], rookie?: boolean }} [standing]
 *   danは段位(竜王を持てば「竜王」)、heldは持っているタイトルの名前、rookieは棋士になって1期以内か。
 */
export function hananeStanding({ dan = '四段', held = [], rookie = true } = {}) {
  const titles = held.length ? held : dan === '竜王' ? ['竜王'] : [];
  if (titles.length >= 2) return `${titles.join('・')}の${titles.length}冠を持つ、若きタイトル保持者`;
  if (titles.length === 1) return `${titles[0]}のタイトルを持つ、若きタイトル保持者`;
  if (dan === '四段') return rookie ? '三段リーグを突破したばかりの新四段' : '若手の四段';
  if (dan === '五段' || dan === '六段') return `勢いに乗る若手の${dan}`;
  if (/段$/.test(dan)) return `トップ棋士に名を連ねる${dan}`;
  return '若手棋士';
}

/**
 * 名鑑に出す羽音の紹介。立場(hananeStanding)と、高校生かどうか(年齢)で変わる。
 * @param {{ dan?: string, held?: string[], rookie?: boolean, age?: number }} [standing]
 */
export function hananeIntro({ age = STORY_PEOPLE[HANANE].age, ...standing } = {}) {
  const school = age <= 18 ? '高校に通う、' : '';
  return `${hananeStanding(standing)}。${school}天鷺善彦の娘。読みの深さ・速さ・正確さがずば抜けていて、力戦でも崩れない。`;
}

/**
 * やこび姫が、羽音と当たる対局の前に言う紹介(攻略の手がかりつき)。羽音は自分の弱点を言わない。
 * @param {{ wins: number, losses: number } | null} vsUser
 * @param {{ dan?: string, held?: string[], rookie?: boolean }} [standing] 羽音のいまの立場(hananeStanding)
 */
export function hananeCoachIntro(vsUser, standing = {}) {
  if (!vsUser || !(vsUser.wins + vsUser.losses)) {
    return `次の相手は天鷺羽音さん。天鷺善彦さんの娘で、${hananeStanding(standing)}だよ。読みがすごく深くて、力戦でも崩れない。終盤ほど強くなるから、序盤のうちにリードを取ろう。`;
  }
  if (vsUser.wins > 0) return '羽音さん、前の負けが悔しかったみたい。今日も本気で来るよ。序盤でリードを取って、終盤は1手ずつ確かめよう。';
  return 'また羽音さんだね。終盤の正確さは折り紙つき。勝負は序盤だよ。';
}

/**
 * やこび姫が、善彦と当たる対局の前に言う紹介(攻略の手がかりつき)。羽音と対局したことがあれば、羽音の言葉を添える。
 * @param {boolean} metHanane
 * @param {string[]} [held] 善彦がいま持っているタイトル
 */
export function yoshihikoCoachIntro(metHanane, held = []) {
  const crown = held.length >= 2 ? `${held.length}冠の` : held.length === 1 ? `${held[0]}の` : '';
  const lines = `${crown}天鷺善彦さんは、羽音さんのお父さん。史上最強って言われる人だよ。形勢判断と読みに穴がなくて、劣勢からでもひっくり返してくる。最後まで気をゆるめないで。`;
  return metHanane ? `${lines}羽音さんは「${HANANE_LINES.father[0]}」って言ってた。` : lines;
}
