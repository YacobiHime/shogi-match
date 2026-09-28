const DEFAULT_TIMEOUT_MS = 35_000;
const PROBE_ENTRY_PATH = "vendor/engine-worker-probe.js?v=20260927-1";

export function engineWorkerProbeUrl(
  engineBaseUrl = ".",
  documentObject = globalThis.document,
) {
  if (!documentObject?.baseURI) throw new Error("Worker URLの基準となるdocumentがありません");
  const baseUrl = new URL(engineBaseUrl, documentObject.baseURI);
  return new URL(PROBE_ENTRY_PATH, baseUrl).href;
}

export function probeWorkerEngine({
  engineBaseUrl = ".",
  documentObject = globalThis.document,
  WorkerClass = globalThis.Worker,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  if (typeof WorkerClass !== "function") return Promise.reject(new Error("Web Workerを利用できません"));
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
    return Promise.reject(new Error("timeoutMsは1以上の整数にしてください"));
  }
  const workerUrl = engineWorkerProbeUrl(engineBaseUrl, documentObject);
  return new Promise((resolve, reject) => {
    const worker = new WorkerClass(workerUrl, { type: "classic", name: "shogi-engine-probe" });
    const requestId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    const finish = (result, error) => {
      clearTimeout(timeoutId);
      worker.terminate();
      if (error) reject(error);
      else resolve({ ...result, workerUrl });
    };
    const timeoutId = setTimeout(
      () => finish(null, new Error("Workerエンジンの疎通確認が期限内に完了しませんでした")),
      timeoutMs,
    );
    worker.onmessage = (event) => {
      const result = event.data;
      if (result?.type !== "probe-result" || result.requestId !== requestId) return;
      if (result.ok) finish(result);
      else finish(null, new Error(result.error || "Workerエンジンの起動に失敗しました"));
    };
    worker.onerror = (event) => finish(null, new Error(event.message || "Workerの読み込みに失敗しました"));
    worker.postMessage({ type: "probe", requestId });
  });
}

export { PROBE_ENTRY_PATH };
