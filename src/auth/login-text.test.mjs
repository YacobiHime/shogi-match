import { describe, expect, it } from "vitest";
import { loginErrorText, loginPageUrl, safeReturnPath } from "./login-text.mjs";

describe("ログインのページの小さな決まり(docs/cloud-sync-design.mdの5章)", () => {
  it("戻り先は同じサイトの道だけ受け付ける", () => {
    expect(safeReturnPath("/game.html?mode=cpu")).toBe("/game.html?mode=cpu");
    expect(safeReturnPath("/")).toBe("/");
    expect(safeReturnPath("//evil.example.com/")).toBe("./");
    expect(safeReturnPath("https://evil.example.com/")).toBe("./");
    expect(safeReturnPath("/\\evil")).toBe("./");
    expect(safeReturnPath("/a b")).toBe("./");
    expect(safeReturnPath(null)).toBe("./");
  });

  it("窓を閉じたときは何も言わず、準備がまだのときは引き継ぎコードを勧める", () => {
    expect(loginErrorText("auth/popup-closed-by-user")).toBe("");
    expect(loginErrorText("auth/operation-not-allowed")).toMatch(/準備がまだ/);
    expect(loginErrorText("auth/configuration-not-found")).toMatch(/準備がまだ/);
    expect(loginErrorText("auth/popup-blocked")).toMatch(/もう一度押して/);
    expect(loginErrorText("auth/network-request-failed")).toMatch(/通信/);
    expect(loginErrorText("auth/whatever")).toMatch(/ログインできなかった/);
  });

  it("ログインのページの道は、今のページを戻り先にする", () => {
    const url = loginPageUrl({ pathname: "/game.html", search: "?mode=cpu", href: "https://shogi-64125.web.app/game.html?mode=cpu" });
    expect(url).toBe("https://shogi-64125.web.app/auth.html?return=%2Fgame.html%3Fmode%3Dcpu");
  });
});
