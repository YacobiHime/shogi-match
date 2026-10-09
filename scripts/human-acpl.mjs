// プロ棋士の代表局の指し手を、CPUのレベル測定(cpu-humanlike-report.mjs)と同じ基準で採点する開発用スクリプト。
// 平均損失(1手1000で打ち切り)を、序盤〜中盤(既定は6〜60手目)の手について求め、CPUのLvと並べて比べる。
// 使い方: node scripts/human-acpl.mjs [--from 6] [--to 60] [--nodes 30000] [--eras modern|all]
import { Position, RecordMetadataKey, importKIF } from "tsshogi";
import {
  AMANO_SOHO_KIFU, FUJII_SOTA_29_WINS_KIFU, HABU_YOSHIHARU_52GIN_KIFU, KOYAMA_REO_ENTRANCE_KIFU,
  MASUDA_KOZO_KYO_OCHI_KIFU, NAKAHARA_MAKOTO_MEIJIN_KIFU, OHASHI_SOKEI_SANSA_KIFU,
  OYAMA_YASUHARU_FIRST_MEIJIN_KIFU, TANIGAWA_KOJI_YOUNGEST_MEIJIN_KIFU,
} from "../src/data/reference-kifu.mjs";
import { comparableScore } from "../src/core/move-selection.mjs";
import { createNodeEngine, search } from "./lib/node-engine.mjs";

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}
const from = Number(option("from", "6"));
const to = Number(option("to", "60"));
const nodes = Number(option("nodes", "30000"));
const eras = option("eras", "modern");
const CAP = 1000;
const DECIDED = 1500;

const GAMES = [
  { name: "小山怜央(2023)", kif: KOYAMA_REO_ENTRANCE_KIFU, modern: true },
  { name: "藤井聡太(2017)", kif: FUJII_SOTA_29_WINS_KIFU, modern: true },
  { name: "羽生善治(1989)", kif: HABU_YOSHIHARU_52GIN_KIFU, modern: true },
  { name: "谷川浩司(1983)", kif: TANIGAWA_KOJI_YOUNGEST_MEIJIN_KIFU, modern: true },
  { name: "中原誠(1972)", kif: NAKAHARA_MAKOTO_MEIJIN_KIFU, modern: false },
  { name: "大山康晴(1952)", kif: OYAMA_YASUHARU_FIRST_MEIJIN_KIFU, modern: false },
  { name: "升田幸三(1956、香落ち)", kif: MASUDA_KOZO_KYO_OCHI_KIFU, modern: false, skip: true },
  { name: "天野宗歩(1845)", kif: AMANO_SOHO_KIFU, modern: false },
  { name: "大橋宗桂(1607)", kif: OHASHI_SOKEI_SANSA_KIFU, modern: false },
].filter((game) => !game.skip && (eras === "all" || game.modern));

const engine = await createNodeEngine();
const rows = [];
for (const game of GAMES) {
  const record = importKIF(game.kif);
  if (record instanceof Error) throw record;
  record.goto(0);
  const steps = [];
  for (const node of record.moves) {
    if (node.ply > 0) record.goForward();
    if (node.ply > 0 && !node.move?.usi) break;
    steps.push({ sfen: record.position.sfen, move: "" });
    if (node.ply > 0) steps[node.ply - 1].move = node.move.usi;
  }
  const losses = [];
  for (let ply = from; ply <= Math.min(to, steps.length - 1); ply += 1) {
    const { sfen, move } = steps[ply - 1] ?? {};
    if (!move) continue;
    const best = await search(engine, sfen, { nodes, multiPv: 1 });
    const bestScore = comparableScore(best.candidates.find(({ rank }) => rank === 1)?.score);
    const played = await search(engine, sfen, { nodes, multiPv: 1, searchMoves: [move] });
    const playedScore = comparableScore(played.candidates.find(({ rank }) => rank === 1)?.score);
    if (bestScore === undefined || playedScore === undefined || Math.abs(bestScore) >= DECIDED) continue;
    losses.push(Math.min(CAP, Math.max(0, bestScore - playedScore)));
  }
  const mean = losses.reduce((sum, value) => sum + value, 0) / Math.max(1, losses.length);
  rows.push({ name: game.name, moves: losses.length, mean: Math.round(mean) });
  console.error(`${game.name}: ${losses.length}手 平均損失${Math.round(mean)}`);
}
engine.quit();
const total = rows.reduce((sum, row) => sum + row.moves, 0);
const weighted = rows.reduce((sum, row) => sum + row.mean * row.moves, 0) / Math.max(1, total);
console.log(`プロ棋士${rows.length}局、${from}〜${to}手目、基準${nodes.toLocaleString()}nodes、評価値±${DECIDED}以上の局面は除く`);
console.log(`全体の平均損失: ${Math.round(weighted)}(${total}手)`);
process.exit(0);
