/**
 * 展示モードの「最初から」。次の来場者のために、端末に残した記録をすべて消す(docs/exhibit-design.md)。
 * 消すのは、このゲームが使う保存の鍵(3種類の書き方がある)だけ。展示する人が決めた端末の設定(音・盤と駒の見た目)は残す。
 * 画面に依存しない。
 */

/** このゲームの保存の鍵の頭。 */
const APP_KEY_PREFIXES = Object.freeze(["yacobihime:shogi-match:", "shogi-match:", "shogi-match-", "shogiMatch"]);

/** 「最初から」でも残す鍵(展示する人の設定)。 */
export const EXHIBIT_KEEP_KEYS = Object.freeze([
  "yacobihime:shogi-match:sound",
  "shogi-match-board-theme",
  "shogi-match-piece-theme",
]);

/** このゲームの保存の鍵か。 */
export function isAppStorageKey(key) {
  return typeof key === "string" && APP_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/**
 * 記録を消す。消した鍵の一覧を返す。読めない・消せない保存は飛ばす(展示を止めない)。
 * @param {Storage | null | undefined} storage
 * @returns {string[]}
 */
export function clearExhibitRecords(storage) {
  const removed = [];
  try {
    if (!storage) return removed;
    const keys = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (isAppStorageKey(key) && !EXHIBIT_KEEP_KEYS.includes(key)) keys.push(key);
    }
    for (const key of keys) {
      try {
        storage.removeItem(key);
        removed.push(key);
      } catch {
        // 消せない鍵は飛ばす。
      }
    }
  } catch {
    // 保存が使えない環境では、何もしない。
  }
  return removed;
}
