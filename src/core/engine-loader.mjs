const ENGINE_PROFILES = Object.freeze({
  builtin: Object.freeze({
    scriptPath: './vendor/yaneuraou.js',
    globalName: 'YaneuraOu',
  }),
  halfkpNoEval: Object.freeze({
    scriptPath: './vendor/yaneuraou.halfkp.noeval.js',
    globalName: 'YaneuraOu_HalfKP_noeval',
  }),
});

const scriptPromisesByDocument = new WeakMap();
const DEFAULT_LOADER_TIMEOUT_MS = 30_000;

/**
 * classic script形式のEmscriptenローダーを一度だけ読み込み、ファクトリ関数を返す。
 */
export async function loadEngineFactory(
  profileName,
  {
    documentObject = globalThis.document,
    globalObject = globalThis,
    engineBaseUrl = '.',
    loaderTimeoutMs = DEFAULT_LOADER_TIMEOUT_MS,
  } = {}
) {
  const profile = ENGINE_PROFILES[profileName];
  if (!profile) throw new Error(`不明なエンジンプロファイルです: ${profileName}`);

  if (typeof globalObject[profile.globalName] === 'function') {
    return globalObject[profile.globalName];
  }
  if (!documentObject?.head) {
    throw new Error('エンジンローダーを読み込むdocumentがありません');
  }
  if (!Number.isInteger(loaderTimeoutMs) || loaderTimeoutMs < 1) {
    throw new Error('loaderTimeoutMsは1以上の整数にしてください');
  }
  let scriptPromises = scriptPromisesByDocument.get(documentObject);
  if (!scriptPromises) {
    scriptPromises = new Map();
    scriptPromisesByDocument.set(documentObject, scriptPromises);
  }

  if (!scriptPromises.has(profileName)) {
    const promise = new Promise((resolve, reject) => {
      const script = documentObject.createElement('script');
      script.src = documentObject.baseURI
        ? new URL(profile.scriptPath, new URL(engineBaseUrl, documentObject.baseURI)).href
        : profile.scriptPath;
      script.async = true;
      const timeoutId = setTimeout(() => {
        reject(new Error(
          `エンジンローダーの取得が${loaderTimeoutMs / 1000}秒以内に完了しませんでした: ${profile.scriptPath}`
        ));
      }, loaderTimeoutMs);
      script.onload = () => {
        clearTimeout(timeoutId);
        const factory = globalObject[profile.globalName];
        if (typeof factory === 'function') {
          resolve(factory);
        } else {
          reject(new Error(`${profile.globalName} が公開されませんでした`));
        }
      };
      script.onerror = () => {
        clearTimeout(timeoutId);
        reject(new Error(`エンジンローダーを取得できません: ${profile.scriptPath}`));
      };
      documentObject.head.appendChild(script);
    });
    scriptPromises.set(profileName, promise);
  }

  try {
    return await scriptPromises.get(profileName);
  } catch (error) {
    scriptPromises.delete(profileName);
    throw error;
  }
}

/**
 * NNUE指定時はHalfKP noeval版を主系統、内蔵評価版をフォールバック先にする。
 */
export async function loadEngineFactories(
  nnuePath,
  { onFallback = null, ...loaderOptions } = {}
) {
  const fallbackFactory = await loadEngineFactory('builtin', loaderOptions);
  if (!nnuePath) {
    return { factory: fallbackFactory, fallbackFactory: null, useNnue: false };
  }

  try {
    const factory = await loadEngineFactory('halfkpNoEval', loaderOptions);
    return { factory, fallbackFactory, useNnue: true };
  } catch (cause) {
    const error = cause instanceof Error ? cause : new Error(String(cause));
    if (onFallback) onFallback({ path: nnuePath, error, stage: 'loader' });
    return { factory: fallbackFactory, fallbackFactory: null, useNnue: false };
  }
}

export { ENGINE_PROFILES };
