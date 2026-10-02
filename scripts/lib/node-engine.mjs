// 開発用スクリプトで、ブラウザと同じWASMエンジンをNode上で動かす共通処理。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Square, handPieceTypes } from "tsshogi";
import { ShogiEngine } from "../../src/core/engine.js";

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const STANDARD_SFEN = "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1";

/** 再現できる乱数(mulberry32)。 */
export function seededRandom(initial) {
  let state = initial >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** tsshogiの局面から合法手をUSIで列挙する。 */
export function legalMoves(position) {
  const moves = new Set();
  const add = (move) => {
    if (move && position.isValidMove(move)) moves.add(move.usi);
  };
  for (const from of position.board.listNonEmptySquares()) {
    if (position.board.at(from)?.color !== position.color) continue;
    for (const to of Square.all) {
      const move = position.createMove(from, to);
      add(move);
      add(move?.withPromote() ?? null);
    }
  }
  for (const pieceType of handPieceTypes) {
    if (position.hand(position.color).count(pieceType) < 1) continue;
    for (const to of Square.all) add(position.createMove(pieceType, to));
  }
  return [...moves];
}

/** Emscriptenのブラウザ向け資産読込をNodeで動かすため、一時ディレクトリへ補正版を置く。 */
export async function createNodeEngine() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shogi-match-engine-"));
  process.on("exit", () => fs.rmSync(dir, { recursive: true, force: true }));
  for (const file of ["yaneuraou.wasm", "yaneuraou.data", "yaneuraou.worker.js"]) {
    fs.copyFileSync(path.join(projectRoot, "vendor", file), path.join(dir, file));
  }
  const source = fs.readFileSync(path.join(projectRoot, "vendor", "yaneuraou.js"), "utf8");
  const hook = "u=A.getPreloadedPackage?A.getPreloadedPackage(f,g):null";
  if (!source.includes(hook)) throw new Error("エンジンローダーの形式が想定と異なります");
  const dataPath = JSON.stringify(path.join(dir, "yaneuraou.data"));
  const prefix = "globalThis.location=globalThis.location||{pathname:\"/engine/\",href:\"file:///engine/\"};"
    + `globalThis.__shogiMatchPreload=function(){var b=require("fs").readFileSync(${dataPath});`
    + "return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);};\n";
  fs.writeFileSync(path.join(dir, "yaneuraou.js"), prefix + source.replace(
    hook,
    "u=(A.getPreloadedPackage||globalThis.__shogiMatchPreload)?(A.getPreloadedPackage||globalThis.__shogiMatchPreload)(f,g):null",
  ));
  const require = createRequire(pathToFileURL(path.join(dir, "package.json")));
  const YaneuraOu = require(path.join(dir, "yaneuraou.js"));
  const wasmBinary = fs.readFileSync(path.join(dir, "yaneuraou.wasm"));
  const engine = new ShogiEngine({
    factory: (options = {}) => YaneuraOu({
      ...options,
      wasmBinary,
      locateFile: (file) => path.join(dir, file),
    }),
  });
  await engine.init();
  await engine.ready();
  engine.newGame();
  return engine;
}

export async function search(engine, sfen, { nodes, multiPv, searchMoves, searchThreads = 1 }) {
  engine.applyStrengthOptions({ multiPv });
  await engine.setSearchThreads(searchThreads);
  engine.setPosition(sfen);
  return engine.go({ nodes, maxTimeMs: 20000, ...(searchMoves ? { searchMoves } : {}) });
}

/**
 * PCのネイティブUSIエンジン(水匠5など)を、ブラウザ版と同じShogiEngineで操作する。
 * 棋譜解析の基準データ作りに使う。評価関数はエンジンと同じフォルダのeval/から読む。
 */
export async function createNativeEngine(enginePath, { threads = 4, hashMb = 256 } = {}) {
  const { spawn } = await import("node:child_process");
  const { createInterface } = await import("node:readline");
  const engine = new ShogiEngine({
    factory: async () => {
      const child = spawn(enginePath, [], { cwd: path.dirname(enginePath), stdio: ["pipe", "pipe", "ignore"] });
      process.on("exit", () => child.kill());
      const listeners = [];
      createInterface({ input: child.stdout }).on("line", (line) => listeners.forEach((listener) => listener(line)));
      return {
        postMessage: (command) => child.stdin.write(`${command}\n`),
        addMessageListener: (listener) => listeners.push(listener),
      };
    },
  });
  await engine.init();
  engine.setOption("Threads", threads);
  engine.setOption("USI_Hash", hashMb);
  await engine.ready();
  engine.newGame();
  return engine;
}
