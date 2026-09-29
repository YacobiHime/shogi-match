import { onBeforeUnmount, onMounted, watch } from "vue";

// 履歴に積む見張りの印。リロード後もこの印で、見張りが既にあると分かる。
const GUARD_KEY = "shogiMatchBackGuard";

type HistoryLike = Pick<History, "state" | "pushState" | "back">;

type BackNavigationOptions = {
  /** アプリ内で1段戻れる画面にいるか。 */
  canGoBack: () => boolean;
  /** アプリ内で1段戻る。 */
  goBack: () => void;
};

/**
 * ブラウザの戻る操作を、アプリ内で1段戻る操作に置き換える。
 * 戻れる画面にいる間だけ履歴へ見張りを1つ積み、戻るで見張りが外れたらアプリ内で戻して積み直す。
 * 戻れる画面がなくなったら見張りを外し、次の戻るで元のページへ戻れるようにする。
 */
export function createBackNavigationGuard(history: HistoryLike, { canGoBack, goBack }: BackNavigationOptions) {
  let guarded = Boolean(history.state?.[GUARD_KEY]);
  // 見張りを外すために呼んだback()の結果を待っている間は、次のpopstateを無視する。
  let removing = false;

  function sync() {
    if (removing) return;
    if (canGoBack() && !guarded) {
      history.pushState({ [GUARD_KEY]: true }, "");
      guarded = true;
    } else if (!canGoBack() && guarded) {
      removing = true;
      guarded = false;
      history.back();
    }
  }

  function handlePopState(state: unknown) {
    if (removing) {
      removing = false;
      sync();
      return;
    }
    // 進む操作で見張りへ戻った場合。
    if ((state as { [GUARD_KEY]?: boolean } | null)?.[GUARD_KEY]) {
      guarded = true;
      sync();
      return;
    }
    guarded = false;
    if (canGoBack()) goBack();
    sync();
  }

  return { sync, handlePopState };
}

/** 画面の状態に合わせて見張りを出し入れし、ブラウザの戻るをアプリ内の戻るへつなぐ。 */
export function useBackNavigation(options: BackNavigationOptions & { enabled: boolean }) {
  if (!options.enabled || typeof window === "undefined") return;
  const guard = createBackNavigationGuard(window.history, options);
  const onPopState = (event: PopStateEvent) => guard.handlePopState(event.state);
  watch(options.canGoBack, () => guard.sync());
  onMounted(() => {
    window.addEventListener("popstate", onPopState);
    guard.sync();
  });
  onBeforeUnmount(() => window.removeEventListener("popstate", onPopState));
}
