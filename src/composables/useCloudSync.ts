/**
 * Googleアカウントでの同期の進め方(docs/cloud-sync-design.mdの3章)。対局画面(ShogiMatchGame.vue)の準備の最初に呼ぶ。
 * - 開いたとき・戻ってきたとき：クラウドの見出しを読んで、することを決める(cloud-sync.mjsのdecideSync)。
 * - 遊んでいるあいだ：60秒ごとに記録の指紋を見て、変わっていて3分たっていれば送る。画面が隠れたときは、変わっていればすぐ送る。
 * - 受け取ったら、置き換えてページを読み直す(引き継ぎと同じ)。
 * 画面(シートの段・ホームの状態)は、返す値を見て描く。
 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from "vue";
import { applySave, collectSave, decodeSave, encodeSave, summarizeSave, summaryLines } from "../core/save-transfer.mjs";
import {
  CLOUD_SYNC_TEXT, CloudSyncError, HIDDEN_PUSH_INTERVAL_MS, PAUSE_MS, PUSH_INTERVAL_MS, RETURN_CHECK_MS, TICK_MS,
  canUseCloudSync, clearCloudState, decideSync, deleteCloudSave, downloadCloudSave, headSummary, headSummaryLines, isFreshSave,
  loadCloudState, readCloudHead, refreshSession, saveCloudState, saveFingerprint, syncStatusText, uploadCloudSave,
} from "../core/cloud-sync.mjs";
import { canUseSaveCloud, sweepTransferCodes } from "../core/save-cloud.mjs";
import { isLocalHost } from "../core/firebase-config.mjs";
import { loginPageUrl } from "../auth/login-text.mjs";

type CloudState = NonNullable<ReturnType<typeof loadCloudState>>;
type CloudHead = NonNullable<Awaited<ReturnType<typeof readCloudHead>>>;
type Session = Awaited<ReturnType<typeof refreshSession>>;
export type CloudSyncStatus = "off" | "idle" | "syncing" | "choose" | "paused" | "offline";
export type CloudChoice = { first: boolean; head: CloudHead; localLines: string[]; cloudLines: string[]; cloudBroken: boolean };

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * @param options.enabled ホームのある表示(単体のページ)だけで同期する。小説などに埋め込んだときは動かない。
 * @param options.onChoose どちらを使うか聞く必要ができたとき(ホームならシートを開く)。
 */
export function useCloudSync(options: { enabled: boolean; onChoose?: () => void }) {
  const hasWindow = typeof window !== "undefined";
  const initial = hasWindow && options.enabled ? loadCloudState(storage()) : null;
  const hostname = hasWindow ? window.location.hostname : "";
  const secure = hasWindow && window.isSecureContext && Boolean(globalThis.crypto?.subtle);
  /** ログインのボタンを出すか(公式の公開先だけ。エミュレーターではログインのページを直接開く)。 */
  const usable = hasWindow && options.enabled && canUseCloudSync({ hostname, secure, emulator: isLocalHost(hostname) && Boolean(initial?.emulator) });
  const state = shallowRef<CloudState | null>(usable ? initial : null);
  const status = ref<CloudSyncStatus>(state.value ? "idle" : "off");
  /** シートに出す最後の一言(通常・不可)。 */
  const message = ref("");
  /** ホームに数秒出す一言(読み込んだ・ログインした・ログアウトした)。 */
  const toast = ref("");
  const choice = shallowRef<CloudChoice | null>(null);
  /** 開いた直後の記録(各画面が書く前)。「この端末が変わったか」はこれで決める(3章)。 */
  const startEntries = state.value ? collectSave(storage()).entries : null;

  let session: Session | null = null;
  let running: Promise<void> | null = null;
  let lastPushAt = 0;
  let pausedUntil = 0;
  let hiddenAt = 0;
  let timer = 0;
  let toastTimer = 0;

  const signedIn = computed(() => Boolean(state.value));
  const savedAt = computed(() => state.value?.base?.at ?? 0);
  const statusText = computed(() => (state.value ? syncStatusText(status.value, savedAt.value) : ""));

  function persist(next: CloudState | null = state.value) {
    if (next) saveCloudState(storage(), next);
    // 同じ形でも描き直すよう、新しい入れ物にする。
    state.value = next ? { ...next } : null;
  }

  function showToast(text: string) {
    toast.value = text;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { toast.value = ""; }, 8000);
  }

  function signOutLocally(text: string) {
    clearCloudState(storage());
    state.value = null;
    session = null;
    choice.value = null;
    status.value = "off";
    message.value = text;
    if (text) showToast(text);
  }

  async function ensureSession(): Promise<Session> {
    const current = state.value;
    if (!current) throw new CloudSyncError("signed-out");
    if (session && session.expiresAt > Date.now()) return session;
    const before = current.refreshToken;
    session = await refreshSession(current);
    if (current.refreshToken !== before) persist(current);
    return session;
  }

  function handleError(cause: unknown) {
    const reason = cause instanceof CloudSyncError ? cause.reason : "offline";
    const text = (CLOUD_SYNC_TEXT.errors as Record<string, string>)[reason] ?? CLOUD_SYNC_TEXT.errors.offline;
    if (reason === "signed-out") {
      signOutLocally(text);
      return;
    }
    message.value = text;
    if (reason === "busy" || reason === "denied" || reason === "too-large") {
      pausedUntil = Date.now() + PAUSE_MS;
      status.value = "paused";
    } else if (reason === "offline") {
      status.value = "offline";
    }
  }

  /** いまの記録を送る。expectは前に読んだ見出し(その版のときだけ書く)。 */
  async function push(expect: CloudHead | null) {
    const current = state.value;
    if (!current) return;
    const live = await ensureSession();
    const bundle = collectSave(storage());
    const hash = saveFingerprint(bundle.entries);
    const saved = await uploadCloudSave(current, live, {
      text: encodeSave(bundle),
      hash,
      summary: headSummary(summarizeSave(bundle)),
      expect,
    });
    lastPushAt = Date.now();
    const notice = current.notice;
    persist({ ...current, base: { rev: saved.rev, updateTime: saved.updateTime, hash, at: saved.at, parts: saved.parts }, notice: "" });
    status.value = "idle";
    choice.value = null;
    message.value = "";
    if (notice === "signed-in") showToast(CLOUD_SYNC_TEXT.signedInPushed);
  }

  /** クラウドの記録を受け取って置き換え、ページを読み直す。 */
  async function pull(head: CloudHead) {
    const current = state.value;
    if (!current) return;
    const live = await ensureSession();
    const got = await downloadCloudSave(current, live, head);
    const decoded = decodeSave(got.text);
    if (decoded.ok === false) throw new CloudSyncError("broken");
    const result = applySave(storage(), decoded.bundle);
    if (!result.ok) {
      message.value = CLOUD_SYNC_TEXT.errors.apply;
      status.value = "idle";
      return;
    }
    const after = saveFingerprint(collectSave(storage()).entries);
    persist({
      ...current,
      base: { rev: got.head.rev, updateTime: got.head.updateTime, hash: after, at: got.head.at, parts: got.head.parts },
      notice: current.notice === "signed-in" ? "signed-in-pulled" : "pulled",
      pulledAt: Date.now(),
    });
    // 確認の窓は閉じないまま読み直す(閉じると戻る操作の見張りのhistory.back()が走り、読み直しが取り消される)。
    window.location.reload();
    // 読み直すまで、ほかの同期を始めない。
    await new Promise(() => undefined);
  }

  function askChoice(head: CloudHead, first: boolean) {
    const local = collectSave(storage());
    choice.value = {
      first,
      head,
      localLines: summaryLines({ ...summarizeSave(local), at: state.value?.changedAt ?? 0 }),
      cloudLines: headSummaryLines(head),
      cloudBroken: false,
    };
    status.value = "choose";
    options.onChoose?.();
  }

  /** クラウドを見て、することを決めて行う。 */
  function check(reason: "start" | "return" | "manual"): Promise<void> {
    if (!state.value) return Promise.resolve();
    if (running) return running;
    if (reason !== "manual" && Date.now() < pausedUntil) return Promise.resolve();
    running = (async () => {
      const before = status.value;
      status.value = "syncing";
      try {
        const live = await ensureSession();
        const current = state.value;
        if (!current) return;
        const head = await readCloudHead(current, live);
        const entries = reason === "start" && startEntries ? startEntries : collectSave(storage()).entries;
        const localHash = saveFingerprint(entries);
        let action = decideSync({ head, base: current.base, localHash, localFresh: isFreshSave(entries) });
        // 読み込んだ直後にまた受け取ることになったら(指紋が合わないなど)、繰り返さずに聞く。
        if (action === "pull" && Date.now() - (current.pulledAt ?? 0) < 20_000) action = "choose";
        if (action === "gone") {
          signOutLocally(CLOUD_SYNC_TEXT.gone);
          return;
        }
        if (action === "push") {
          await push(head);
          if (reason === "manual") message.value = CLOUD_SYNC_TEXT.synced;
          return;
        }
        if (action === "pull" && head) {
          await pull(head);
          return;
        }
        if (action === "choose" && head) {
          askChoice(head, !current.base);
          return;
        }
        if (action === "adopt" && head) {
          persist({ ...current, base: { rev: head.rev, updateTime: head.updateTime, hash: head.hash, at: head.at, parts: head.parts } });
        }
        status.value = "idle";
        choice.value = null;
        if (reason === "manual") message.value = CLOUD_SYNC_TEXT.synced;
        if (current.notice === "signed-in") {
          persist({ ...(state.value ?? current), notice: "" });
          showToast(CLOUD_SYNC_TEXT.signedIn);
        }
      } catch (cause) {
        if (cause instanceof CloudSyncError && cause.reason === "broken" && state.value) {
          // クラウドの記録が読めない。この端末の記録で保存し直せるようにする。
          const current = state.value;
          const head = await ensureSession().then((live) => readCloudHead(current, live)).catch(() => null);
          if (head) {
            askChoice(head, !current.base);
            choice.value = choice.value ? { ...choice.value, cloudBroken: true } : null;
            message.value = CLOUD_SYNC_TEXT.errors.broken;
            return;
          }
        }
        handleError(cause);
        if (status.value === "syncing") status.value = before === "syncing" ? "idle" : before;
      } finally {
        running = null;
        if (status.value === "syncing") status.value = "idle";
      }
    })();
    return running;
  }

  /** 指紋を見て、変わっていれば送る(遊んでいるあいだと、画面が隠れたとき)。 */
  function tick(hidden: boolean) {
    const current = state.value;
    if (!current || running || status.value === "choose" || Date.now() < pausedUntil) return;
    if (!current.base) {
      // まだ一度も合わせていない(開いたときに通信できなかった)。見出しから見直す。
      if (!hidden) void check("return");
      return;
    }
    const entries = collectSave(storage()).entries;
    const hash = saveFingerprint(entries);
    if (hash === current.base.hash) return;
    if (!current.changedAt || current.changedHash !== hash) persist({ ...current, changedAt: Date.now(), changedHash: hash });
    if (Date.now() - lastPushAt < (hidden ? HIDDEN_PUSH_INTERVAL_MS : PUSH_INTERVAL_MS)) return;
    const base = current.base;
    running = (async () => {
      status.value = "syncing";
      try {
        await push({ rev: base.rev, updateTime: base.updateTime, parts: base.parts ?? 1, at: base.at, device: "", size: 0, summary: "", hash: base.hash });
      } catch (cause) {
        if (cause instanceof CloudSyncError && cause.reason === "conflict") {
          running = null;
          await check("return");
          return;
        }
        handleError(cause);
      } finally {
        running = null;
        if (status.value === "syncing") status.value = "idle";
      }
    })();
  }

  function onVisibility() {
    if (!state.value) return;
    if (document.visibilityState === "hidden") {
      hiddenAt = Date.now();
      tick(true);
    } else if (hiddenAt && Date.now() - hiddenAt >= RETURN_CHECK_MS) {
      hiddenAt = 0;
      void check("return");
    } else {
      hiddenAt = 0;
    }
  }

  onMounted(() => {
    if (!hasWindow || !options.enabled) return;
    // 受け取られなかった引き継ぎコードの預け物を消す(docs/save-transfer-design.mdの6章)。開いた直後の通信と重ねない。
    if (canUseSaveCloud({ hostname, secure })) window.setTimeout(() => { void sweepTransferCodes(storage()).catch(() => 0); }, 5000);
    if (!state.value) return;
    const notice = state.value.notice;
    if (notice === "pulled" || notice === "signed-in-pulled") {
      showToast(notice === "pulled" ? CLOUD_SYNC_TEXT.pulled : CLOUD_SYNC_TEXT.signedInPulled);
      persist({ ...state.value, notice: "" });
    }
    void check("start");
    timer = window.setInterval(() => tick(false), TICK_MS);
    document.addEventListener("visibilitychange", onVisibility);
  });
  onBeforeUnmount(() => {
    window.clearInterval(timer);
    window.clearTimeout(toastTimer);
    if (hasWindow) document.removeEventListener("visibilitychange", onVisibility);
  });

  /** ログインのページへ移る(戻り先は今のページ)。 */
  function signIn() {
    window.location.href = loginPageUrl(window.location);
  }

  function signOut() {
    signOutLocally(CLOUD_SYNC_TEXT.signedOut);
  }

  async function syncNow() {
    message.value = "";
    pausedUntil = 0;
    await check("manual");
  }

  /** どちらを使うかの答え。 */
  async function useLocal() {
    const asked = choice.value;
    if (!asked) return;
    status.value = "syncing";
    try {
      await push(asked.head);
    } catch (cause) {
      if (cause instanceof CloudSyncError && cause.reason === "conflict") {
        // 聞いているあいだに、ほかの端末がまた保存した。見直して聞き直す。
        status.value = "idle";
        await check("return");
        return;
      }
      handleError(cause);
      if (status.value === "syncing") status.value = "choose";
    }
  }

  async function useCloud() {
    const asked = choice.value;
    if (!asked || asked.cloudBroken) return;
    status.value = "syncing";
    try {
      await pull(asked.head);
    } catch (cause) {
      handleError(cause);
      if (status.value === "syncing") status.value = "choose";
    }
  }

  /** クラウドの記録を消して、ログアウトする。 */
  async function deleteCloud() {
    const current = state.value;
    if (!current) return;
    status.value = "syncing";
    try {
      const live = await ensureSession();
      await deleteCloudSave(current, live);
      signOutLocally(CLOUD_SYNC_TEXT.deleted);
    } catch (cause) {
      handleError(cause);
      if (status.value === "syncing") status.value = "idle";
    }
  }

  return {
    usable,
    signedIn,
    state,
    status,
    statusText,
    savedAt,
    message,
    toast,
    choice,
    signIn,
    signOut,
    syncNow,
    useLocal,
    useCloud,
    deleteCloud,
  };
}

export type CloudSyncApi = ReturnType<typeof useCloudSync>;
