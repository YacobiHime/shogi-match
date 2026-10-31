/**
 * データリセットの種類(docs/data-reset-design.md)。すべてを消す「最初から」のほかに、大会・最近の対局・レーティング・
 * 教室・問題集・脳トレ・コレクションを分けて消せる。画面に依存しない。
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
    summary: "竜王戦・名人戦・奨励会・研修会を最初から",
    erases: "竜王戦・名人戦の期と経歴、奨励会・研修会の挑戦、棋士の世界（名簿・順位戦）、大会の難易度、推しと予想、中継の記録、大会の中断した対局",
    keeps: "賞状・観戦記・勝負メシ帳・研究ノートと、レーティング・コレクションは残ります。",
    keys: Object.freeze([
      `${Y}ryuo-season`, `${Y}ryuo-career`, `${Y}ryuo-roster`, `${Y}ryuo-counter:v1`, `${Y}ryuo-oshi`, `${Y}ryuo-prediction`,
      `${Y}ryuo-watch:v1`, `${Y}meijin-season`, `${Y}meijin-career`, `${Y}shoreikai:v1`, `${Y}kenshukai:v1`,
      `${Y}tournament-world:v1`, `${Y}engine-game:v1`, `${Y}relay:v1`, `${Y}relay-view:v1`, `${Y}relay-predict:v1`, `${Y}relay-quiz:v1`,
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

/** idから種類。 */
export const resetGroup = (id) => RESET_GROUPS.find((group) => group.id === id) ?? null;

/** 中断した対局の保存の鍵か(match-persistence.mjsのmatchSnapshotKey。ページの場所はencodeURIComponentで「%2F」から始まる)。 */
export const isMatchSnapshotKey = (key) => typeof key === "string" && key.startsWith(`${Y}%2F`);

/** 中断した対局の保存が、大会(竜王戦・名人戦・奨励会・研修会)の対局か。読めない保存は大会の対局とみなさない。 */
function isTournamentSnapshot(storage, key) {
  try {
    const value = JSON.parse(storage.getItem(key) ?? "null");
    return Boolean(value?.ryuoGame);
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
        if (isMatchSnapshotKey(key) && (group.snapshots === "all" || isTournamentSnapshot(storage, key))) targets.add(/** @type {string} */ (key));
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
