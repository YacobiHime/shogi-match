// やこび姫の助言の強化・段階1(N1 最善手の翻訳・N4 見逃し・N5 相手のミス)と段階2・3(N3 終盤の方針・N6 格言)が、
// 1局に何回出るかを数える開発用スクリプト。
// 図鑑の代表局と低いレベルの自動対局(棋譜解析ベンチマークと同じ棋譜)の平手の局面を、両方の側から見る。
// 各局面を対局画面の助言と同じ読み(上位5手・6万局面)で読み、指された手を「プレイヤーの手」(N4)・「CPUの手」(N5)として扱う。
// 悪手判定の読み(20万局面)は、この読みで代える(数の目安を見るため)。設計は docs/coach-advice-expansion-design.md。
// 使い方: npx vite-node scripts/coach-insight-report.mjs -- [--nodes 60000] [--games 0]
import { benchmarkGames } from "./lib/kifu-benchmark-games.mjs";
import { STANDARD_SFEN, createNodeEngine, search } from "./lib/node-engine.mjs";
import { settleMultiPvCandidates } from "../src/core/match-assists.mjs";
import { flipSideToMove } from "../src/core/engine-mate-check.mjs";
import { appendUsiMove, createGameRecord } from "../src/game-state";
import {
  INSIGHT_INTERVAL_PLIES,
  SLIP_MAX_PER_GAME,
  endgamePolicyAdvice,
  isEndgame,
  meaningAdvice,
  missedChanceAdvice,
  moveMeaning,
  opponentSlipAdvice,
  proverbAdvice,
} from "../src/core/coach-insight.mjs";
import { INSIGHT_MARGIN } from "../src/core/coach-advice.mjs";

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}
const nodes = Number(option("nodes", "60000"));
const limit = Number(option("games", "0"));
const FIRST_PLY = 10;

const comparable = (score) => {
  if (score?.type === "cp") return score.value;
  if (score?.type === "mate") return score.value > 0 ? 100000 - score.value : -100000 - score.value;
  return undefined;
};
const negate = (score) => (score ? { type: score.type, value: -score.value } : null);

const games = benchmarkGames().filter(({ steps }) => steps[0]?.sfen === STANDARD_SFEN);
const engine = await createNodeEngine();
const totals = { insight: 0, missedMate: 0, missedCapture: 0, slip: 0, policy: 0, proverb: 0, sides: 0 };
const kinds = new Map();
const policyKinds = new Map();
/** 手番の側が、相手に2手続けて指させると7手以内に詰まされるか(詰めろの確かめと同じ形)。 */
async function mateThreatOf(sfen) {
  const result = await search(engine, flipSideToMove(sfen), { nodes, multiPv: 1 });
  const best = result.candidates.find(({ rank }) => rank === 1);
  return best?.score?.type === "mate" && best.score.value > 0 && best.score.value <= 7;
}
for (const game of limit ? games.slice(0, limit) : games) {
  const reads = [];
  for (let ply = FIRST_PLY; ply < game.steps.length; ply += 1) {
    const result = await search(engine, game.steps[ply].sfen, { nodes, multiPv: 5 });
    reads[ply] = settleMultiPvCandidates(result.candidates, result.completedCandidates ?? []);
  }
  const lastInsight = { black: -Infinity, white: -Infinity };
  const lastPolicy = { black: -Infinity, white: -Infinity };
  const said = { black: [], white: [] };
  const slips = { black: 0, white: 0 };
  const lines = [];
  for (let ply = FIRST_PLY; ply < game.steps.length - 1; ply += 1) {
    const sfen = game.steps[ply].sfen;
    const color = sfen.split(" ")[1] === "w" ? "white" : "black";
    const played = game.steps[ply + 1].lastMove;
    const candidates = reads[ply] ?? [];
    const best = candidates.find(({ rank }) => rank === 1);
    const bestValue = comparable(best?.score);
    if (!best || bestValue === undefined) continue;
    // N1: 最善手が2位より300点以上良い(8手に1回まで)。詰みの局面は数えない(getCandidateRiskAdviceと同じ)。
    if (Math.abs(bestValue) < 50000) {
      const second = comparable(candidates.find(({ rank }) => rank === 2)?.score);
      const gap = second !== undefined && bestValue - second >= INSIGHT_MARGIN && ply - lastInsight[color] >= INSIGHT_INTERVAL_PLIES;
      const insight = gap ? meaningAdvice(moveMeaning(sfen, best.move)) : null;
      if (insight) {
        totals.insight += 1;
        lastInsight[color] = ply;
        const kind = insight.key.replace(/^candidate-evaluation-cliff-/, "").replace(/-.*$/, "");
        kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
        lines.push(`${ply}手目 ${color === "black" ? "先手" : "後手"} N1 ${insight.text}`);
      }
    }
    // N3: 終盤の「攻めるか、受けるか」。王手の局面と詰みの局面は数えない。
    const record = createGameRecord(sfen);
    if (isEndgame(sfen, ply) && !record.position.checked && Math.abs(bestValue) < 50000) {
      const mateThreat = await mateThreatOf(sfen);
      const preview = createGameRecord(sfen);
      const bestGivesCheck = appendUsiMove(preview, best.move) && preview.position.checked;
      const allowed = mateThreat || ply - lastPolicy[color] >= INSIGHT_INTERVAL_PLIES;
      let bestGivesMateThreat = null;
      if (allowed && !mateThreat && !bestGivesCheck) {
        const after = createGameRecord(sfen);
        if (appendUsiMove(after, best.move)) bestGivesMateThreat = await mateThreatOf(after.position.sfen);
      }
      // 対局画面の bestMoveIsDefensive(玉の手・自陣の金銀の手)に近い見分けとして、最善手の種類の「守る」を使う。
      const defensive = moveMeaning(sfen, best.move)?.kind === "defend";
      const policy = allowed ? endgamePolicyAdvice({ mateThreat, bestGivesCheck, bestGivesMateThreat, bestIsDefensive: defensive, playerScore: best.score }) : null;
      if (policy) {
        totals.policy += 1;
        if (!policy.key.startsWith("endgame-threat")) lastPolicy[color] = ply;
        policyKinds.set(policy.key, (policyKinds.get(policy.key) ?? 0) + 1);
        lines.push(`${ply}手目 ${color === "black" ? "先手" : "後手"} N3 ${policy.text}`);
      }
    }
    // N6: 格言(1局に1回ずつ)。
    const proverb = proverbAdvice({ sfen, ply, color, bestMove: best.move, lastPlayerMove: game.steps[ply - 1]?.lastMove ?? "", said: said[color] });
    if (proverb) {
      said[color].push(proverb.proverb);
      totals.proverb += 1;
      lines.push(`${ply}手目 ${color === "black" ? "先手" : "後手"} N6 ${proverb.text}`);
    }
    // N4: 指された手を、プレイヤーの手として見る(指す前と指したあとの読み)。
    const next = (reads[ply + 1] ?? []).find(({ rank }) => rank === 1);
    const missed = next ? missedChanceAdvice({
      sfenBefore: sfen, playedUsi: played, before: best.score, after: negate(next.score), beforePv: best.pv ?? [],
    }) : null;
    if (missed) {
      if (missed.key.startsWith("move-missed-mate")) totals.missedMate += 1;
      else totals.missedCapture += 1;
      lines.push(`${ply}手目 ${color === "black" ? "先手" : "後手"} N4 ${missed.text}`);
    }
    // N5: 指された手を、CPUの手として見る(読みの最善と、選んだ手の評価)。
    const chosen = candidates.find(({ move }) => move === played);
    if (chosen && chosen.move !== best.move && slips[color] < SLIP_MAX_PER_GAME) {
      const slip = opponentSlipAdvice({
        best: best.score, selected: chosen.score, sfenAfter: game.steps[ply + 1].sfen, reply: chosen.pv?.[1] ?? "",
      });
      if (slip) {
        slips[color] += 1;
        totals.slip += 1;
        lines.push(`${ply}手目 ${color === "black" ? "先手" : "後手"} N5 ${slip.text}`);
      }
    }
  }
  totals.sides += 2;
  console.log(`${game.id}(${game.steps.length - 1}手): ${lines.length}回${lines.length ? `\n  ${lines.join("\n  ")}` : ""}`);
}
const per = (count) => (count / Math.max(1, totals.sides)).toFixed(2);
console.log(`\n${totals.sides / 2}局(${totals.sides}人分)、1人1局あたり:`);
console.log(`  N1 最善手の翻訳: ${per(totals.insight)}回`);
console.log(`  N4 見逃し: 詰み${per(totals.missedMate)}回・タダの駒${per(totals.missedCapture)}回`);
console.log(`  N5 相手のミス(CPUの手として): ${per(totals.slip)}回`);
console.log(`  N1の種類: ${[...kinds].map(([kind, count]) => `${kind} ${count}`).join("・")}`);
console.log(`  N3 終盤の方針: ${per(totals.policy)}回(${[...policyKinds].map(([kind, count]) => `${kind} ${count}`).join("・")})`);
console.log(`  N6 格言: ${per(totals.proverb)}回`);
process.exit(0);
