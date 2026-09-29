import { describe, expect, it } from "vitest";
import { createBackNavigationGuard } from "./useBackNavigation";

/** pushStateとback()だけを持つ履歴。back()の結果はpopstateとして手動で届ける。 */
function fakeHistory(initialState: unknown = null) {
  const entries: unknown[] = [initialState];
  let index = 0;
  return {
    get state() { return entries[index]; },
    get length() { return entries.length; },
    get index() { return index; },
    pushState(state: unknown) {
      entries.splice(index + 1);
      entries.push(state);
      index += 1;
    },
    back() { index -= 1; },
    /** ブラウザの戻るボタン。 */
    pressBack() { index -= 1; return entries[index]; },
  };
}

describe("createBackNavigationGuard", () => {
  it("戻れる画面では見張りを積み、戻るでアプリ内を1段戻して積み直す", () => {
    const history = fakeHistory();
    const screens = ["home", "pregame", "tutorial-volume"];
    const guard = createBackNavigationGuard(history, {
      canGoBack: () => screens.length > 1,
      goBack: () => { screens.pop(); },
    });
    guard.sync();
    expect(history.index).toBe(1);

    guard.handlePopState(history.pressBack());
    expect(screens).toEqual(["home", "pregame"]);
    expect(history.index).toBe(1);

    guard.handlePopState(history.pressBack());
    expect(screens).toEqual(["home"]);
    // ホームへ戻ったら見張りを積まず、次の戻るで元のページへ出る。
    expect(history.index).toBe(0);
  });

  it("アプリ内の操作で戻れなくなったら見張りを外し、そのpopstateは無視する", () => {
    const history = fakeHistory();
    let canGoBack = true;
    let goBackCount = 0;
    const guard = createBackNavigationGuard(history, {
      canGoBack: () => canGoBack,
      goBack: () => { goBackCount += 1; },
    });
    guard.sync();
    canGoBack = false;
    guard.sync();
    expect(history.index).toBe(0);
    guard.handlePopState(history.state);
    expect(goBackCount).toBe(0);
    expect(history.index).toBe(0);
  });

  it("見張りを外している途中に戻れる画面へ入ったら、popstateの後で積み直す", () => {
    const history = fakeHistory();
    let canGoBack = true;
    const guard = createBackNavigationGuard(history, { canGoBack: () => canGoBack, goBack: () => {} });
    guard.sync();
    canGoBack = false;
    guard.sync();
    canGoBack = true;
    guard.sync();
    expect(history.index).toBe(0);
    guard.handlePopState(history.state);
    expect(history.index).toBe(1);
  });

  it("リロード後は既存の見張りを使い、二重に積まない", () => {
    const history = fakeHistory({ shogiMatchBackGuard: true });
    const guard = createBackNavigationGuard(history, { canGoBack: () => true, goBack: () => {} });
    guard.sync();
    expect(history.length).toBe(1);
  });
});
