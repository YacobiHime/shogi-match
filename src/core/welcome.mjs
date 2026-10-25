/**
 * はじめて遊ぶ人への案内。ホームを最初に開いたとき、将棋をどのくらい知っているかを聞き、
 * いちばん早く大会を楽しめる道へ案内する(docs/first-play-design.md)。
 * 札は易しい順の1本の物差し: はじめて → 教室の第1巻、ルールは分かる → 教室の始める場所を1問で決める、
 * 少し指せる → 棋力測定からホームの「つぎはこれ」、よく指している → 棋力測定から竜王戦。
 */

import { EXHIBIT_KEEP_KEYS } from "./exhibit-reset.mjs";

export const WELCOME_SEEN_KEY = "yacobihime:shogi-match:welcome:v1";

// このアプリが端末に残す鍵の先頭。どれか1つでもあれば、もう遊んだことのある人とみなす。
const APP_KEY_PREFIXES = ["yacobihime:shogi-match:", "shogi-match:", "shogi-match-"];

export const WELCOME_CHOICES = Object.freeze([
  Object.freeze({ id: "beginner", label: "はじめて", description: "駒の動かし方から、教室でいっしょに覚えよう" }),
  Object.freeze({ id: "rules", label: "ルールは分かる", description: "戦法や囲いはまだ。教室の、ちょうどいいところから" }),
  Object.freeze({ id: "some", label: "少し指せる", description: "戦法も少し分かる。1局指して、棋力を測ろう" }),
  Object.freeze({ id: "player", label: "よく指している", description: "定跡も分かる。棋力を測って、大会に挑もう" }),
]);

/**
 * 棋力測定から始める答え(docs/first-play-design.mdの5章)。最初の相手は、続けて出す「どのくらい指せる？」の札で選ぶ
 * (skill-estimate.mjsのMEASURE_START_CHOICES。前は1級のLv24に決めていて、強すぎた)。
 */
export const WELCOME_MEASURE_CHOICES = Object.freeze(["some", "player"]);

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
