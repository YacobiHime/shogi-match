"use strict";

const PROBE_TIMEOUT_MS = 30_000;
let probeStarted = false;

function waitForLine(instance, command, expectedLine, label) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error(`${label}が期限内にありませんでした`)), PROBE_TIMEOUT_MS);
    const listener = (line) => {
      if (line !== expectedLine) return;
      clearTimeout(timeoutId);
      resolve();
    };
    instance.addMessageListener(listener);
    instance.postMessage(command);
  });
}

self.onmessage = async (event) => {
  if (event.data?.type !== "probe" || probeStarted) return;
  probeStarted = true;
  const requestId = event.data.requestId;
  const scriptUrl = new URL("./yaneuraou.js?v=20260727-2", self.location.href).href;
  let instance = null;
  try {
    self.importScripts(scriptUrl);
    if (typeof self.YaneuraOu !== "function") throw new Error("YaneuraOuが公開されませんでした");
    instance = await self.YaneuraOu({
      // pthread側へ常に文字列の実URLを渡し、Blob URL経由の孫Worker生成を避ける。
      mainScriptUrlOrBlob: scriptUrl,
      locateFile: (path) => new URL(path, scriptUrl).href,
    });
    await waitForLine(instance, "usi", "usiok", "usi応答");
    await waitForLine(instance, "isready", "readyok", "isready応答");
    self.postMessage({
      type: "probe-result",
      requestId,
      ok: true,
      crossOriginIsolated: self.crossOriginIsolated === true,
      scriptUrl,
    });
  } catch (cause) {
    const error = cause instanceof Error ? cause : new Error(String(cause));
    self.postMessage({
      type: "probe-result",
      requestId,
      ok: false,
      crossOriginIsolated: self.crossOriginIsolated === true,
      scriptUrl,
      error: error.message,
    });
  } finally {
    try { instance?.postMessage("quit"); } catch { /* 起動前の失敗では終了指示できない。 */ }
  }
};
