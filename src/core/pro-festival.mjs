// 将棋まつり(docs/pro-year-design.mdの10-2の6)。年3回、架空の町のまつりに招かれ、4つの催し(駒落ち指導対局・ぐるぐる指導対局・
// トークショー・揮毫)をして、謝礼とファンをもらう。日付・参加者・台本・謝礼の表だけを持つ純粋な処理(盤と指し手は festival-simul.mjs)。
// 羽音の台詞は敬語と「！」なし(docs/hanane-character.md)。

import { createRng, pick } from './ryuo-random.mjs';
import { CPU_STRENGTH_PRESETS } from './strength-settings.mjs';

const pad2 = (value) => String(value).padStart(2, '0');
/** 種から決まる並べかえ(フィッシャー–イェーツ)。 */
function shuffled(rng, list) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(rng.next() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}
const dayOfWeek = (text) => new Date(`${text}T00:00:00Z`).getUTCDay();

/** 年3回のまつり。日付は、期の始まりの年度の中(5月3日・8月の第1土曜・11月3日)。町は架空。 */
export const FESTIVALS = Object.freeze([
  { id: 'spring', name: 'みなと町 将棋まつり', place: '港の見える市民ホール', month: 5, day: 3 },
  { id: 'summer', name: 'しらかば高原 将棋まつり', place: '高原の野外ステージ', month: 8, weekday: 6 },
  { id: 'autumn', name: 'さくら城下 将棋まつり', place: 'お城の前の広場', month: 11, day: 3 },
].map((entry) => Object.freeze(entry)));

/**
 * その年度のまつりの日(自分の公式戦の日は翌日)。
 * @param {number} fy 年度
 * @param {Set<string>} [busy] 自分の公式戦の日
 */
export function festivalDays(fy, busy = new Set()) {
  return FESTIVALS.map((festival) => {
    let date = `${fy}-${pad2(festival.month)}-${pad2(festival.day ?? 1)}`;
    if (festival.weekday !== undefined) {
      const shift = (festival.weekday - dayOfWeek(date) + 7) % 7;
      date = `${fy}-${pad2(festival.month)}-${pad2(1 + shift)}`;
    }
    if (busy.has(date)) {
      const next = new Date(`${date}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      date = `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())}`;
    }
    return { ...festival, date };
  });
}

/** 4つの催し(どれをやっても、飛ばしてもよい)。 */
export const FESTIVAL_EVENTS = Object.freeze([
  { id: 'shidou', label: '駒落ち指導対局', note: 'あなたが上手。勝ち負けより、楽しんでもらおう' },
  { id: 'simul', label: 'ぐるぐる指導対局', note: '3人を相手に、盤を回りながら1手ずつ' },
  { id: 'talk', label: 'トークショー', note: '司会の質問に答える。ゲストは羽音' },
  { id: 'kigou', label: '揮毫', note: '色紙に、好きな言葉を書く' },
].map((entry) => Object.freeze(entry)));

/** 謝礼(万円): 基本20万円(ファンが多いほど増える。多くて＋20)＋催しごとに5万円。 */
export function festivalFee(fans, doneCount) {
  const base = 20 + Math.min(20, Math.floor(Math.max(0, fans) / 100) * 5);
  return base + 5 * Math.max(0, doneCount);
}

// ---- 参加者(架空のアマチュア)

const KIDS = ['そうた', 'ゆいな', 'はると', 'みお', 'りく', 'ひなた', 'こはる', 'ゆうま', 'さくら', 'いつき', 'あおい', 'れん'];
const GRADES = ['小学2年', '小学3年', '小学4年', '小学5年', '小学6年', '中学1年', '中学2年'];
const ADULTS = ['会社員の田中さん', '大学生の森さん', '将棋教室の先生の川口さん', 'まつりの実行委員の小野さん', '定年後に始めた松井さん'];

/** 段級位の名前(「10級」)。 */
const gradeOf = (level) => (CPU_STRENGTH_PRESETS[Math.max(0, Math.min(49, Math.round(level)))]?.label ?? '').replace('程度', '');

/** 駒落ちの手合ごとの、参加者のLvの差(あなたのLvから引く)。 */
export const SHIDOU_HANDICAPS = Object.freeze([
  { id: '2pieces', label: '二枚落ち', gap: 10 },
  { id: '4pieces', label: '四枚落ち', gap: 14 },
  { id: '6pieces', label: '六枚落ち', gap: 18 },
].map((entry) => Object.freeze(entry)));

/**
 * 駒落ち指導対局の参加者(まつりごとに決まる)。強い人ほど少ない駒落ち。
 * @param {{ seed: number }} festival
 * @param {number} userLevel あなたのLv
 */
export function shidouGuest(festival, userLevel) {
  const rng = createRng((festival.seed ?? 1) + 101);
  const handicap = pick(rng, SHIDOU_HANDICAPS);
  const level = Math.max(2, Math.min(30, Math.round((userLevel ?? 20) - handicap.gap)));
  const adult = rng.next() < 0.35;
  const name = adult ? pick(rng, ADULTS) : `${pick(rng, GRADES)}の${pick(rng, KIDS)}さん`;
  return { id: 'guest', name, kind: 'amateur', dan: gradeOf(level), level, handicap: handicap.id, handicapLabel: handicap.label, rating: 0, story: null };
}

/**
 * ぐるぐる指導対局の3人(まつりごとに決まる)。ロジックAIで指す子どもたち(エンジンを使わない)。
 * logicは`chooseLogicMove`のLv(1〜10)。
 * @param {{ seed: number }} festival
 */
export function simulGuests(festival) {
  const rng = createRng((festival.seed ?? 1) + 202);
  const names = shuffled(rng, KIDS).slice(0, 3);
  const plans = [
    { logic: 2.4, level: 5, handicap: '6pieces', handicapLabel: '六枚落ち' },
    { logic: 4.9, level: 7, handicap: '6pieces', handicapLabel: '六枚落ち' },
    { logic: 9, level: 9, handicap: '4pieces', handicapLabel: '四枚落ち' },
  ];
  return plans.map((plan, index) => ({ ...plan, name: `${pick(rng, GRADES)}の${names[index]}さん`, grade: gradeOf(plan.level) }));
}

/** 指導対局のファン(勝ち負けより、楽しんでもらう。参加者が勝つと大喜び)。 */
export const SHIDOU_FANS = Object.freeze({ guestWon: 40, userWon: 25, draw: 30 });
/** ぐるぐる指導のファン(1局ごと)と、全員に勝ったときの上乗せ。 */
export const SIMUL_FANS = Object.freeze({ perBoard: 10, sweep: 20 });
/** 揮毫のファン。 */
export const KIGOU_FANS = 15;

// ---- トークショー

/** 会場の反応(答えで変わる)と、ファン。 */
export const REACTIONS = Object.freeze({
  laugh: { text: '（会場が笑いに包まれた）', fans: 20 },
  applause: { text: '（大きな拍手が起きた）', fans: 15 },
  stir: { text: '（会場がどよめいた）', fans: 10 },
});

/** 司会の質問と、3つの答え(会場の反応・羽音の返し)。 */
export const TALK_QUESTIONS = Object.freeze([
  {
    q: 'プロになって、いちばん変わったことは何ですか？',
    answers: [
      { text: '朝ごはんを食べるようになりました', reaction: 'laugh', hanane: 'へえ、前は食べてなかったんだ。', face: 'smile' },
      { text: '一局の重さです。負けると、次の日まで考えます', reaction: 'applause', hanane: '分かる。私も、そういう日はずっと盤の前にいる。', face: 'neutral' },
      { text: '羽音さんに勝つことしか考えていません', reaction: 'stir', hanane: '……それ、ここで言うこと？ まぁ、受けて立つけど。', face: 'gentle' },
    ],
  },
  {
    q: 'お休みの日は、何をしていますか？',
    answers: [
      { text: '詰将棋を解いています', reaction: 'applause', hanane: '休みの日まで。君らしいね。', face: 'smile' },
      { text: 'ひたすら寝ています', reaction: 'laugh', hanane: 'それも大事でしょ。頭は寝てるあいだに整理されるから。', face: 'gentle' },
      { text: '羽音さんと研究会です', reaction: 'stir', hanane: '休みの日に呼んでるつもりはないけど。……まぁ、来るなら来て。', face: 'neutral' },
    ],
  },
  {
    q: '好きな戦法を教えてください。',
    answers: [
      { text: '居飛車の本格派です', reaction: 'applause', hanane: '正統派だね。私は、ちょっと崩したほうが楽しいけど。', face: 'neutral' },
      { text: 'その日の気分で決めます', reaction: 'laugh', hanane: '気分で指して勝てるなら、いちばん強いよ。', face: 'smile' },
      { text: '言ったら研究されるので、秘密です', reaction: 'stir', hanane: '研究会で全部見てるから、私には意味ないよ。', face: 'gentle' },
    ],
  },
  {
    q: '将棋を始めたきっかけは？',
    answers: [
      { text: '家の押し入れで、古い盤を見つけて', reaction: 'applause', hanane: 'へえ。私は気づいたら、もう家に盤があった。', face: 'neutral' },
      { text: '友達に負けたのが悔しくて', reaction: 'laugh', hanane: '負けず嫌いなんだ。……私もだけど。', face: 'smile' },
      { text: '覚えていません。気づいたら指していました', reaction: 'stir', hanane: 'それ、私と同じだ。', face: 'gentle' },
    ],
  },
  {
    q: '会場の子どもたちに、ひとことお願いします。',
    answers: [
      { text: '負けた日は、たくさん悔しがってください', reaction: 'applause', hanane: 'いいこと言うね。悔しいのは、強くなる途中ってことだから。', face: 'gentle' },
      { text: '将棋は、おやつを食べながらでも強くなれます', reaction: 'laugh', hanane: '果物なら、私も賛成。', face: 'smile' },
      { text: 'いつか、プロの対局室で待っています', reaction: 'stir', hanane: '……ちょっと格好つけすぎじゃない？ でも、いいと思う。', face: 'neutral' },
    ],
  },
  {
    q: '羽音さんの印象を教えてください。',
    answers: [
      { text: '読みが速くて、いつも驚かされます', reaction: 'applause', hanane: '褒めても、手加減はしないよ。', face: 'neutral' },
      { text: 'マヨネーズが苦手な人です', reaction: 'laugh', hanane: 'それ、ここで言うこと？ ……事実だけど。', face: 'worried' },
      { text: 'いちばんのライバルです', reaction: 'stir', hanane: 'そう。だから、次も負けない。', face: 'gentle' },
    ],
  },
].map((entry) => Object.freeze(entry)));

/** トークショーの質問の数。 */
export const TALK_COUNT = 3;

/**
 * トークショーの場面(NovelSceneの形。答えの行は`choices`で、選ぶと返しの行が続く)。質問はまつりごとに3つ。
 * @param {{ seed: number, name: string }} festival
 * @param {string} playerName
 */
export function talkScene(festival, playerName) {
  const rng = createRng((festival.seed ?? 1) + 303);
  const order = shuffled(rng, TALK_QUESTIONS.map((_, index) => index)).slice(0, TALK_COUNT);
  const you = playerName || 'あなた';
  const lines = [
    { who: 'narration', face: 'neutral', name: '', text: `${festival.name}のステージ。客席はいっぱいだ。` },
    { who: 'host', face: 'neutral', name: '司会', text: `それでは、トークショーを始めます。${you}四段と、ゲストの天鷺羽音四段です。` },
    { who: 'hanane', face: 'neutral', name: '羽音', text: 'よろしく。……こういうの、あんまり慣れてないけど。' },
  ];
  for (const index of order) {
    const question = TALK_QUESTIONS[index];
    lines.push({
      who: 'host', face: 'neutral', name: '司会', text: question.q,
      choices: question.answers.map((answer) => ({
        label: answer.text,
        value: answer.reaction,
        reply: [
          { who: 'you', face: 'neutral', name: you, text: `「${answer.text}」` },
          { who: 'narration', face: 'neutral', name: '', text: REACTIONS[answer.reaction].text },
          { who: 'hanane', face: answer.face, name: '羽音', text: answer.hanane },
        ],
      })),
    });
  }
  lines.push({ who: 'host', face: 'neutral', name: '司会', text: 'おふたり、ありがとうございました。もう一度、大きな拍手を。' });
  lines.push({ who: 'hanane', face: 'smile', name: '羽音', text: '……楽しかった。君、話すの上手いね。' });
  return { id: `talk-${festival.seed}`, title: `${festival.name} トークショー`, background: 'venue', cast: ['hanane'], lines };
}

/** トークショーのファン(答えの反応の合計。答えなかった質問は0)。 */
export function talkFans(reactions) {
  return (reactions ?? []).reduce((sum, id) => sum + (REACTIONS[id]?.fans ?? 0), 0);
}

// ---- 揮毫

/** 揮毫の言葉。needは、タイトル獲得・棋戦優勝の回数(はじめは3つ。D:5-1 ご褒美の使い道)。 */
export const KIGOU_WORDS = Object.freeze([
  { word: '平常心', need: 0, note: 'いつもの心で' },
  { word: '一歩前へ', need: 0, note: '一手ずつ、前へ' },
  { word: '感謝', need: 0, note: '指してくれる人に' },
  { word: '挑戦', need: 1, note: '上の舞台へ' },
  { word: '不動心', need: 2, note: '動じない心' },
  { word: '百折不撓', need: 3, note: '何度でも立ち上がる' },
  { word: '玲瓏', need: 4, note: '曇りのない心' },
].map((entry) => Object.freeze(entry)));

/** 書ける言葉(足りない言葉は、あと何回で書けるか)。 */
export function kigouWords(crowns) {
  return KIGOU_WORDS.map((entry) => ({ ...entry, open: (crowns ?? 0) >= entry.need, left: Math.max(0, entry.need - (crowns ?? 0)) }));
}

/** 揮毫帳の、多くて残す枚数。 */
export const KIGOU_BOOK_MAX = 60;
