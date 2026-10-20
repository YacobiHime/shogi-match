/**
 * はじめて遊ぶ人への案内。ホームを最初に開いたとき、将棋をどのくらい知っているかを聞き、
 * 教室・対局・棋力測定のどれから始めるかを案内する。
 */

import { EXHIBIT_KEEP_KEYS } from "./exhibit-reset.mjs";

export const WELCOME_SEEN_KEY = "yacobihime:shogi-match:welcome:v1";

// このアプリが端末に残す鍵の先頭。どれか1つでもあれば、もう遊んだことのある人とみなす。
const APP_KEY_PREFIXES = ["yacobihime:shogi-match:", "shogi-match:", "shogi-match-"];

export const WELCOME_CHOICES = Object.freeze([
  Object.freeze({ id: "beginner", label: "はじめて", description: "駒の動かし方から、教室でいっしょに覚えよう" }),
  Object.freeze({ id: "rules", label: "ルールは分かる", description: "やこび姫の助言つきで、CPUと指してみよう" }),
  Object.freeze({ id: "player", label: "ふだん指している", description: "1局指して、棋力を測ってみよう" }),
]);

function hasAppData(storage) {
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    // 端末の設定(音・盤と駒の見た目)は、遊んだ記録に数えない(展示の「最初から」のあとにも案内を出す)。
    if (!key || key === WELCOME_SEEN_KEY || EXHIBIT_KEEP_KEYS.includes(key)) continue;
    if (APP_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) return true;
  }
  return false;
}

/** 案内を出すか。案内を見たことがなく、遊んだ記録も何もない端末だけで出す。保存できない環境では出さない。 */
export function shouldShowWelcome(storage) {
  try {
    if (!storage) return false;
    if (storage.getItem(WELCOME_SEEN_KEY)) return false;
    return !hasAppData(storage);
  } catch {
    return false;
  }
}

/** 案内を閉じた。選んだ道も残しておく。 */
export function markWelcomeSeen(storage, choice = "", now = Date.now()) {
  try {
    storage?.setItem(WELCOME_SEEN_KEY, JSON.stringify({ choice, at: now }));
  } catch {
    // 保存できない環境では、次に開いたときにまた案内する。
  }
}
