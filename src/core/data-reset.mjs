/**
 * データリセットの種類(docs/data-reset-design.md)。すべてを消す「最初から」のほかに、大会・最近の対局・レーティング・
 * 教室・問題集・脳トレ・コレクション・物語を分けて消せる。画面に依存しない。
 * 鍵の名前はここに直接書く(各モジュールを読み込むと、ホームの最初に読むJSが重くなるため)。鍵が変わったらここも直す
 * (data-reset.test.mjsが、各モジュールの鍵と食い違っていないかを確かめる)。
 */

import { clearExhibitRecords } from "./exhibit-reset.mjs";

const Y = "yacobihime:shogi-match:";

/**
 * 種類ごとの消す鍵。erasesは確認の窓の「消えるもの」、keepsは「残るもの」。
 * snapshotsは、中断した対局の保存(match-persistence)も消すか: "tournament"は大会の対局のときだけ、"all"はどれも。
 * @typedef {{ id: string, label: string, summary: string, erases: string, keeps: string, keys: readonly string[], snapshots?: "tournament" | "all" }} ResetGroup
 * @type {readonly ResetGroup[]}
 */
export const RESET_GROUPS = Object.freeze([
  Object.freeze({
    id: "tournament",
    label: "大会の進み具合",
    summary: "竜王戦・名人戦・奨励会・研修会・団体戦・棋士の1年を最初から",
    erases: "竜王戦・名人戦の期と経歴、奨励会・研修会の挑戦、団体戦、棋士の1年、棋士の世界（名簿・順位戦）、大会の難易度、推しと予想、中継の記録、大会の中断した対局",
    keeps: "賞状・観戦記・勝負メシ帳・研究ノート、物語の読んだ話、レーティング・コレクションは残ります。",
    keys: Object.freeze([
      `${Y}ryuo-season`, `${Y}ryuo-career`, `${Y}ryuo-roster`, `${Y}ryuo-counter:v1`, `${Y}ryuo-oshi`, `${Y}ryuo-prediction`,
      `${Y}ryuo-watch:v1`, `${Y}meijin-season`, `${Y}meijin-career`, `${Y}shoreikai:v1`, `${Y}kenshukai:v1`,
      `${Y}tournament-world:v1`, `${Y}engine-game:v1`, `${Y}relay:v1`, `${Y}relay-view:v1`, `${Y}relay-predict:v1`, `${Y}relay-quiz:v1`,
      `${Y}team-battle:v1`, `${Y}pro-year:v1`,
    ]),
    snapshots: "tournament",
  }),
  Object.freeze({
    id: "recent",
    label: "最近の対局の記録",
    summary: "勝ち負けの記録・弱点の見立て・自分の対局の棋譜",
    erases: "最近の対局の勝ち負けと中身（弱点の見立て・自分の能力の元）、弱点の練習の記録、続けて遊んだ日、自分の対局の棋譜",
    keeps: "レーティング・大会・教室・コレクションは残ります。",
    keys: Object.freeze([`${Y}recent-games:v1`, `${Y}play-insight:v1`, `${Y}coach-weakness:v1`, `${Y}play-streak:v1`, `${Y}my-games:v1`]),
  }),
  Object.freeze({
    id: "rating",
    label: "レーティングと棋力",
    summary: "レーティング（R）と棋力の見立てをはじめに戻す",
    erases: "レーティング（R）と段級位、棋力テスト・測定の見立て（棋力カルテ）",
    keeps: "対局の記録・大会・教室・コレクションは残ります。おすすめの強さは、はじめの強さに戻ります。",
    keys: Object.freeze([`${Y}player-rating`, `${Y}skill-profile:v1`]),
  }),
  Object.freeze({
    id: "tutorial",
    label: "将棋教室",
    summary: "レッスンの進み具合・メダル・コツ",
    erases: "教室のレッスンの進み具合・メダル・称号、にがての記録、格言帳、利きメガネ、コツを使った回数",
    keeps: "問題集・脳トレ・対局の記録は残ります。",
    keys: Object.freeze([`${Y}tutorial:v1`, `${Y}tutorial-weak:v1`, `${Y}tutorial-proverbs:v1`, `${Y}tutorial-kiki-glasses:v1`, `${Y}tip-uses:v1`]),
  }),
  Object.freeze({
    id: "problems",
    label: "問題集",
    summary: "解いた記録・解く時間・復習",
    erases: "問題集の解いた記録と解く時間（自己ベスト）、復習の予定、対局から作った問題",
    keeps: "教室・脳トレ・対局の記録は残ります。",
    keys: Object.freeze(["shogi-match:problem-set:v1", `${Y}review-queue:v1`, `${Y}review-problems:v1`]),
  }),
  Object.freeze({
    id: "brain",
    label: "脳トレ",
    summary: "記録・判子のカレンダー・記憶の宮殿",
    erases: "脳トレの記録と判子のカレンダー、毎日のプログラムの進み具合、記憶の宮殿と場所法の学校",
    keeps: "教室・問題集・対局の記録は残ります。",
    keys: Object.freeze([`${Y}brain-training:v2`, `${Y}brain-training:v1`, `${Y}memory-palace:v1`]),
  }),
  Object.freeze({
    id: "collection",
    label: "コレクションと思い出",
    summary: "印のアルバム・着せ替え・賞状・観戦記",
    erases: "コレクションの印と着せ替えの解放、寄せの記録、賞状帳、観戦記、勝負メシ帳、研究ノート、占いで出た作戦",
    keeps: "レーティング・大会の進み具合・教室は残ります。",
    keys: Object.freeze([
      `${Y}collection:v1`, `${Y}collection-seen:v1`, `${Y}mate-finish:v1`, `${Y}awards`, `${Y}kansenki:v1`, `${Y}meal-book:v1`,
      `${Y}relay-notes:v1`, `${Y}opening-fortune:v1`, `${Y}coach-plans:v1`,
    ]),
  }),
  // 物語(docs/story-mode-design.mdの3章の10)。ノベルの場面の読んだ印(既読)も、ここで消す。
  Object.freeze({
    id: "story",
    label: "物語",
    summary: "開いた話・読んだ話と、場面の読んだ印",
    erases: "物語の開いた話・読んだ話、ノベルの場面の読んだ印（既読の早送りと、飛ばす前のあらすじの印）",
    keeps: "大会の進み具合・名前・場面の文字の速さは残ります。",
    keys: Object.freeze([`${Y}story:v1`, `${Y}novel-read:v1`]),
  }),
  Object.freeze({
    id: "all",
    label: "すべて（最初から）",
    summary: "名前も成績も、全部消して最初から",
    erases: "名前・成績・教室・問題集・脳トレ・大会・コレクション・中断した対局のすべて",
    keeps: "音と盤・駒の見た目は残ります。",
    keys: Object.freeze([]),
    snapshots: "all",
  }),
]);

/**
 * 「大会の進み具合」を、大会ごとに分けて消す(docs/data-reset-design.mdの6章)。棋士の世界(名簿・順位戦)・大会の難易度・
 * 推し・中継の記録はどの大会でも使うので、ここでは消さない(「大会すべて」で消す)。中断した対局は、その大会の対局だけ消す。
 * @typedef {ResetGroup & { events: readonly string[] }} TournamentPart
 * @type {readonly TournamentPart[]}
 */
const PART_KEEPS = "ほかの大会、棋士の世界（名簿・順位戦）、賞状・観戦記、レーティング・コレクションは残ります。";
export const TOURNAMENT_PARTS = Object.freeze([
  Object.freeze({
    id: "tournament:ryuo", label: "竜王戦", summary: "竜王戦の期と経歴",
    erases: "竜王戦の期と経歴、期の途中の続き、観戦の記録、勝敗の予想、竜王戦の中断した対局",
    keeps: PART_KEEPS,
    keys: Object.freeze([`${Y}ryuo-season`, `${Y}ryuo-career`, `${Y}ryuo-counter:v1`, `${Y}ryuo-watch:v1`, `${Y}ryuo-prediction`, `${Y}engine-game:v1`]),
    snapshots: "tournament", events: Object.freeze(["ryuo"]),
  }),
  Object.freeze({
    id: "tournament:meijin", label: "名人戦", summary: "名人戦の期と経歴",
    erases: "名人戦の期と経歴、名人戦の中断した対局",
    keeps: `${PART_KEEPS}順位戦のクラスは棋士の世界に残ります（最初に戻すには、大会の選択の「棋士の世界を最初に戻す」）。`,
    keys: Object.freeze([`${Y}meijin-season`, `${Y}meijin-career`, `${Y}engine-game:v1`]),
    snapshots: "tournament", events: Object.freeze(["meijin"]),
  }),
  Object.freeze({
    id: "tournament:shoreikai", label: "奨励会", summary: "奨励会の挑戦と経歴",
    erases: "奨励会の挑戦と経歴、奨励会の中断した対局", keeps: PART_KEEPS,
    keys: Object.freeze([`${Y}shoreikai:v1`]), snapshots: "tournament", events: Object.freeze(["shoreikai"]),
  }),
  Object.freeze({
    id: "tournament:kenshukai", label: "研修会", summary: "研修会の挑戦と経歴",
    erases: "研修会の挑戦と経歴、研修会の中断した対局", keeps: PART_KEEPS,
    keys: Object.freeze([`${Y}kenshukai:v1`]), snapshots: "tournament", events: Object.freeze(["kenshukai"]),
  }),
  Object.freeze({
    id: "tournament:team", label: "団体戦", summary: "団体戦の大会と記録",
    erases: "団体戦の大会と記録（羽音に誘われる場面からやり直し）、団体戦の中断した対局", keeps: PART_KEEPS,
    keys: Object.freeze([`${Y}team-battle:v1`]), snapshots: "tournament", events: Object.freeze(["team"]),
  }),
  Object.freeze({
    id: "tournament:pro-year", label: "棋士の1年", summary: "棋士の1年の暦と記録",
    erases: "棋士の1年の暦・対局・賞金と暮らしの記録、棋士の1年の中断した対局", keeps: PART_KEEPS,
    keys: Object.freeze([`${Y}pro-year:v1`]), snapshots: "tournament", events: Object.freeze(["pro-year"]),
  }),
]);

/** idから種類(大会ごとの種類も)。 */
export const resetGroup = (id) => RESET_GROUPS.find((group) => group.id === id) ?? TOURNAMENT_PARTS.find((part) => part.id === id) ?? null;

/** 中断した対局の保存の鍵か(match-persistence.mjsのmatchSnapshotKey。ページの場所はencodeURIComponentで「%2F」から始まる)。 */
export const isMatchSnapshotKey = (key) => typeof key === "string" && key.startsWith(`${Y}%2F`);

/**
 * 中断した対局の保存が、大会の対局か。eventsを渡すと、その大会の対局だけ(竜王戦は印がないことがある)。
 * 読めない保存は大会の対局とみなさない。
 * @param {Storage} storage
 * @param {string} key
 * @param {readonly string[]} [events]
 */
function isTournamentSnapshot(storage, key, events) {
  try {
    const value = JSON.parse(storage.getItem(key) ?? "null");
    if (!value?.ryuoGame) return false;
    return !events || events.includes(value.ryuoGame.event ?? "ryuo");
  } catch {
    return false;
  }
}

/**
 * 種類を選んで消す。消した鍵の一覧を返す。「すべて」は展示の「最初から」と同じ(音・盤と駒の見た目は残す)。
 * 読めない・消せない保存は飛ばす。
 * @param {Storage | null | undefined} storage
 * @param {string} id
 * @returns {string[]}
 */
export function resetData(storage, id) {
  const group = resetGroup(id);
  if (!group || !storage) return [];
  if (group.id === "all") return clearExhibitRecords(storage);
  const targets = new Set(group.keys);
  if (group.snapshots) {
    try {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (isMatchSnapshotKey(key) && (group.snapshots === "all" || isTournamentSnapshot(storage, key, /** @type {any} */ (group).events))) targets.add(/** @type {string} */ (key));
      }
    } catch {
      // 一覧が読めない環境では、中断した対局はそのまま。
    }
  }
  const removed = [];
  for (const key of targets) {
    try {
      if (storage.getItem(key) === null) continue;
      storage.removeItem(key);
      removed.push(key);
    } catch {
      // 消せない鍵は飛ばす。
    }
  }
  return removed;
}
