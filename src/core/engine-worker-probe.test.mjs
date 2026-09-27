import { describe, expect, it, vi } from "vitest";
import { engineWorkerProbeUrl, probeWorkerEngine } from "./engine-worker-probe.mjs";

class SuccessfulWorker {
  static instances = [];

  constructor(url, options) {
    this.url = url;
    this.options = options;
    this.terminated = false;
    SuccessfulWorker.instances.push(this);
  }

  postMessage(message) {
    queueMicrotask(() => this.onmessage({
      data: {
        type: "probe-result",
        requestId: message.requestId,
        ok: true,
        crossOriginIsolated: true,
      },
    }));
  }

  terminate() {
    this.terminated = true;
  }
}

describe("engine worker probe", () => {
  it("builds a real static URL instead of a blob URL", () => {
    const url = engineWorkerProbeUrl("./assets/", { baseURI: "https://example.test/game.html" });
    expect(url).toBe("https://example.test/assets/vendor/engine-worker-probe.js?v=20260927-1");
    expect(url).not.toMatch(/^blob:/);
  });

  it("starts a classic worker and returns its diagnostics", async () => {
    SuccessfulWorker.instances = [];
    const result = await probeWorkerEngine({
      engineBaseUrl: "./",
      documentObject: { baseURI: "https://example.test/game.html" },
      WorkerClass: SuccessfulWorker,
      timeoutMs: 100,
    });
    const worker = SuccessfulWorker.instances[0];
    expect(worker.options).toEqual({ type: "classic", name: "shogi-engine-probe" });
    expect(worker.url).toBe(result.workerUrl);
    expect(result.crossOriginIsolated).toBe(true);
    expect(worker.terminated).toBe(true);
  });

  it("terminates a worker that does not answer", async () => {
    vi.useFakeTimers();
    class SilentWorker extends SuccessfulWorker {
      postMessage() {}
    }
    const promise = probeWorkerEngine({
      documentObject: { baseURI: "https://example.test/game.html" },
      WorkerClass: SilentWorker,
      timeoutMs: 10,
    });
    const rejection = expect(promise).rejects.toThrow("期限内に完了しませんでした");
    await vi.advanceTimersByTimeAsync(10);
    await rejection;
    vi.useRealTimers();
  });
});
