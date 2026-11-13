/**
 * ログインのページの小さな決まり(docs/cloud-sync-design.mdの5章)。画面とSDKに依存しない(テストのため分ける)。
 */

/**
 * 戻り先の道。同じサイトの道(「/」で始まり「//」で始まらない、改行や「\」のないもの)だけ受け付け、ほかは「./」。
 * @param {string | null | undefined} value
 */
export function safeReturnPath(value) {
  const path = String(value ?? "");
  if (!path.startsWith("/") || path.startsWith("//") || /[\\\s]/.test(path) || path.length > 400) return "./";
  return path;
}

/** 失敗の一言(Firebaseのエラーの番号から)。窓を閉じたなど、言わなくてよいときは空。 */
export function loginErrorText(code) {
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request" || code === "auth/user-cancelled") return "";
  if (code === "auth/popup-blocked") return "ログインの窓が止められたよ。もう一度押してね。";
  if (["auth/operation-not-allowed", "auth/configuration-not-found", "auth/invalid-api-key", "auth/unauthorized-domain", "auth/admin-restricted-operation"].includes(code)) {
    return "Googleログインの準備がまだできていないよ。いまは引き継ぎコードを使ってね。";
  }
  if (code === "auth/network-request-failed" || code === "auth/timeout") return "通信できなかったよ。インターネットにつないで、もう一度ためしてね。";
  if (code === "app/storage") return "この端末に保存できなかったよ。ブラウザの設定で保存を許してね。";
  return "ログインできなかったよ。少し待って、もう一度ためしてね。";
}

/** 対局画面から開くログインのページの道(戻り先つき)。 */
export function loginPageUrl(location) {
  const back = `${location.pathname}${location.search}`;
  return new URL(`auth.html?return=${encodeURIComponent(back)}`, location.href).toString();
}
