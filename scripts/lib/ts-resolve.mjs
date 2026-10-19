// 開発用スクリプトから、拡張子なしで書かれたsrc/のTypeScriptモジュールを読めるようにするNodeの解決フック。
// node --experimental-strip-types --import ./scripts/lib/ts-register.mjs で使う。
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && !/\.[cm]?[jt]s$/.test(specifier) && context.parentURL?.startsWith("file:")) {
    const candidate = new URL(`${specifier}.ts`, context.parentURL);
    if (fs.existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
  }
  return nextResolve(specifier, context);
}

// Node 22の型除去だけでは、型としてのみ使われた通常importが残る。
// 計測でもViteと同じく未使用の型importを除き、既存のTSソースを実行する。
export async function load(url, context, nextLoad) {
  if (url.startsWith("file:") && url.endsWith(".ts")) {
    const source = fs.readFileSync(fileURLToPath(url), "utf8");
    return {
      format: "module", shortCircuit: true,
      source: ts.transpileModule(source, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
      }).outputText,
    };
  }
  return nextLoad(url, context);
}
