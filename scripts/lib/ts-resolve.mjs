// 開発用スクリプトから、拡張子なしで書かれたsrc/のTypeScriptモジュールを読めるようにするNodeの解決フック。
// node --experimental-strip-types --import ./scripts/lib/ts-register.mjs で使う。
import fs from "node:fs";
import { fileURLToPath } from "node:url";

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && !/\.[cm]?[jt]s$/.test(specifier) && context.parentURL?.startsWith("file:")) {
    const candidate = new URL(`${specifier}.ts`, context.parentURL);
    if (fs.existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
  }
  return nextResolve(specifier, context);
}
