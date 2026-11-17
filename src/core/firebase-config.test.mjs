import { describe, expect, it } from "vitest";
import { FIREBASE_WEB_CONFIG, firebaseLoginConfig } from "./firebase-config.mjs";

describe("認証ページと同じサイトでFirebaseの認証状態を扱う", () => {
  it.each(["shogi-64125.web.app", "shogi-64125.firebaseapp.com"])("%sでは認証の枠と戻り先も同じホスト", (hostname) => {
    expect(firebaseLoginConfig(hostname)).toEqual({ ...FIREBASE_WEB_CONFIG, authDomain: hostname });
  });
  it.each(["localhost", "127.0.0.1", "example.com", "shogi-64125.web.app.example.com", ""])("%sをOAuthの戻り先に採用しない", (hostname) => {
    expect(firebaseLoginConfig(hostname)).toEqual(FIREBASE_WEB_CONFIG);
  });
  it("公開用の共通設定を変更しない", () => {
    firebaseLoginConfig("shogi-64125.web.app");
    expect(FIREBASE_WEB_CONFIG.authDomain).toBe("shogi-64125.firebaseapp.com");
  });
});
