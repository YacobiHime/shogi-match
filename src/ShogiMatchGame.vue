<template>
  <section class="shogi-game" aria-label="将棋対局">
    <header class="shogi-game__header">
      <div>
        <strong>{{ statusText }}</strong>
        <span class="shogi-game__meta">{{ modeText }}・{{ moveCount }}手</span>
      </div>
      <div class="shogi-game__actions">
        <label v-if="normalizedMode === 'cpu' && !engineUnavailable" class="shogi-game__strength">
          <span>CPU強さ</span>
          <select v-model.number="searchNodes" :disabled="!engineReady" aria-label="CPUの強さ">
            <option :value="1000">入門（約1〜2手先）</option>
            <option :value="10000">やさしい（約2〜4手先）</option>
            <option :value="30000">ふつう（約4〜6手先）</option>
            <option :value="100000">強い（約6〜8手先）</option>
            <option :value="300000">かなり強い（約8〜10手先）</option>
          </select>
        </label>
        <label v-if="normalizedMode === 'cpu'" class="shogi-game__strength">
          <span>相手の作戦</span>
          <select v-model="cpuStrategy" aria-label="相手の作戦">
            <option value="random">おまかせ</option>
            <option value="ibisha">居飛車</option>
            <option value="shiken">四間飛車</option>
            <option value="sangen">三間飛車</option>
            <option value="nakabisha">中飛車</option>
            <option value="yagura">矢倉</option>
          </select>
        </label>
        <span v-else-if="normalizedMode === 'cpu'" class="shogi-game__strength">
          簡易CPU（強さ変更不可）
        </span>
        <button type="button" :disabled="!canUseHint" @click="showHint">ヒント（残り{{ hintsRemaining }}）</button>
        <button type="button" :disabled="!canUndo" @click="undoTurn">待った（残り{{ undosRemaining }}）</button>
        <button type="button" :disabled="!active" @click="resign">投了</button>
        <button type="button" @click="restart">最初から</button>
      </div>
    </header>

    <ShogiMatchBoard
      :sfen="currentSfen"
      :last-move="lastMove"
      :allow-move="canMove"
      :enable-drag-and-drop="enableDragAndDrop"
      :flip="flipBoard"
      :mobile="mobile"
      :asset-base-url="assetBaseUrl"
      :black-player-name="blackPlayerName"
      :white-player-name="effectiveWhitePlayerName"
      :candidates="hintCandidates"
      @usi-move="onPlayerMove"
    />

    <aside class="shogi-game__guide" aria-label="やこび姫の戦形ガイド">
      <strong>やこび姫</strong><span>{{ guideText }}</span>
    </aside>
    <p v-if="hintText" class="shogi-game__hint" role="status">{{ hintText }}</p>
    <p v-if="errorMessage" class="shogi-game__error" role="alert">{{ errorMessage }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { Color, Record } from "tsshogi";
import ShogiMatchBoard from "./ShogiMatchBoard.vue";
import {
  appendUsiMove,
  createGameRecord,
  enumerateLegalMoves,
  GameMode,
  MatchResult,
  resignationResult,
  resultAfterMove,
  selectCpuMove,
  STANDARD_SFEN,
} from "./game-state";
import { ShogiEngine } from "./core/engine.js";
import { loadEngineFactories } from "./core/engine-loader.mjs";
import { findNewFormationCallouts } from "./core/formation-callouts.mjs";
import { findNewHiraganaSuishoFormations } from "./core/hiragana-suisho-formations.mjs";
import { formatHintMove, getHintMoves } from "./core/match-assists.mjs";
import { selectMoveByRank } from "./core/move-selection.mjs";
import hiraganaFormationMaster from "./data/hiragana_suisho_formations.json";

const formationCalloutMaster = {
  version: 1,
  initial_speech: "戦形が見えたら知らせるね！",
  undo_speech: "もう一度、盤面を見てみよう！",
  callouts: [
    { callout_id: "bogin", name: "棒銀", speech: "棒銀！" },
    { callout_id: "gold_yagura", name: "金矢倉囲い", speech: "金矢倉囲い！" },
    { callout_id: "right_shiken", name: "右四間飛車", speech: "右四間飛車！" },
  ],
};

const props = defineProps({
  mode: { type: String as () => GameMode, default: "cpu" },
  playerColor: { type: String, default: "black" },
  initialSfen: { type: String, default: STANDARD_SFEN },
  assetBaseUrl: { type: String, default: "." },
  blackPlayerName: { type: String, default: "先手" },
  whitePlayerName: { type: String, default: "後手" },
  cpuPlayerName: { type: String, default: "CPU" },
  cpuDelayMs: { type: Number, default: 350 },
  engineBaseUrl: { type: String, default: "." },
  engineNodes: { type: Number, default: 30000 },
  hintCount: { type: Number, default: 3 },
  undoCount: { type: Number, default: 1 },
  mobile: { type: Boolean, default: false },
  enableDragAndDrop: { type: Boolean, default: true },
});
const emit = defineEmits(["match-ready", "match-move", "match-end", "match-error"]);

const errorMessage = ref("");
const record = ref<Record>(createRecord());
const currentSfen = ref(record.value.position.sfen);
const lastMove = ref("");
const active = ref(true);
const thinking = ref(false);
const engineReady = ref(false);
const engineUnavailable = ref(false);
const result = ref<MatchResult | null>(null);
const hintsRemaining = ref(Math.max(0, Math.trunc(props.hintCount)));
const undosRemaining = ref(Math.max(0, Math.trunc(props.undoCount)));
const hintCandidates = ref<{ usi: string; score?: string }[]>([]);
const hintText = ref("");
const guideText = ref(formationCalloutMaster.initial_speech);
const searchNodes = ref(normalizeNodes(props.engineNodes));
const cpuStrategy = ref("random");
const announcedFormations = new Set<string>();
let cpuTimer: ReturnType<typeof setTimeout> | undefined;
let engine: ShogiEngine | null = null;
let moveHistory: string[] = [];

const normalizedMode = computed<GameMode>(() => props.mode === "local" ? "local" : "cpu");
const humanColor = computed(() => props.playerColor === "white" ? Color.WHITE : Color.BLACK);
const moveCount = computed(() => record.value.current.ply);
const flipBoard = computed(() => normalizedMode.value === "cpu" && humanColor.value === Color.WHITE);
const effectiveWhitePlayerName = computed(() =>
  normalizedMode.value === "cpu" && humanColor.value === Color.BLACK
    ? props.cpuPlayerName
    : props.whitePlayerName,
);
const modeText = computed(() => normalizedMode.value === "cpu" ? "CPU対局" : "ローカル対局");
const canMove = computed(() =>
  active.value &&
  !thinking.value &&
  (normalizedMode.value === "local" || record.value.position.color === humanColor.value)
);
const canUseHint = computed(() => canMove.value && engineReady.value && hintsRemaining.value > 0);
const canUndo = computed(() =>
  active.value
  && !thinking.value
  && undosRemaining.value > 0
  && (normalizedMode.value === "local" ? moveHistory.length > 0 : moveHistory.length >= 2)
  && (normalizedMode.value === "local" || record.value.position.color === humanColor.value)
);
const statusText = computed(() => {
  if (result.value) {
    if (!result.value.winner) return "引き分け";
    return result.value.winner === Color.BLACK ? "先手の勝ち" : "後手の勝ち";
  }
  if (normalizedMode.value === "cpu" && !engineReady.value) return "やねうら王を起動中…";
  return record.value.position.color === Color.BLACK ? "先手番です" : "後手番です";
});

function normalizeNodes(value: number): number {
  const nodes = Number.isFinite(value) ? value : 30000;
  return [1000, 10000, 30000, 100000, 300000].reduce(
    (nearest, candidate) =>
      Math.abs(candidate - nodes) < Math.abs(nearest - nodes) ? candidate : nearest,
    30000,
  );
}

function strengthSearchSettings(nodes: number) {
  if (nodes <= 1000) return { multiPv: 10, moveRank: { min: 5, max: 10 } };
  if (nodes <= 10000) return { multiPv: 7, moveRank: { min: 3, max: 7 } };
  if (nodes <= 30000) return { multiPv: 5, moveRank: { min: 2, max: 5 } };
  if (nodes <= 100000) return { multiPv: 3, moveRank: { min: 1, max: 3 } };
  return { multiPv: 1, moveRank: { min: 1, max: 1 } };
}

const STRATEGY_MOVES: { [key: string]: { black: string[]; white: string[] } } = {
  ibisha: {
    black: ["2g2f", "2f2e", "3i3h", "3h2g"],
    white: ["8c8d", "8d8e", "7a7b", "7b8c"],
  },
  shiken: {
    black: ["7g7f", "2h6h", "6g6f", "3i4h"],
    white: ["3c3d", "8b4b", "4c4d", "3a4b"],
  },
  sangen: {
    black: ["7g7f", "2h7h", "6g6f", "3i4h"],
    white: ["3c3d", "8b3b", "3a4b", "4a3b"],
  },
  nakabisha: {
    black: ["5g5f", "2h5h", "7g7f", "3i4h"],
    white: ["5c5d", "8b5b", "3c3d", "3a4b"],
  },
  yagura: {
    black: ["7g7f", "2g2f", "3i4h", "4i5h", "5i6h", "6i7h", "4h3g"],
    white: ["3c3d", "8c8d", "7a6b", "6a5b", "5a4b", "4a3b", "6b7c"],
  },
};

function strategyMove(): string | undefined {
  const plan = STRATEGY_MOVES[cpuStrategy.value];
  if (!plan) return undefined;
  const cpuIsBlack = humanColor.value === Color.WHITE;
  const cpuMoves = moveHistory.filter((_, index) => (index % 2 === 0) === cpuIsBlack);
  const desired = plan[cpuIsBlack ? "black" : "white"][cpuMoves.length];
  if (!desired) return undefined;
  return enumerateLegalMoves(record.value.position).some((move) => move.usi === desired)
    ? desired
    : undefined;
}

function createRecord(): Record {
  try {
    errorMessage.value = "";
    return createGameRecord(props.initialSfen);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errorMessage.value = message;
    emit("match-error", { message });
    return createGameRecord();
  }
}

function syncPosition(usi = "") {
  currentSfen.value = record.value.position.sfen;
  lastMove.value = usi;
}

function announceFormation() {
  const direct = findNewFormationCallouts(currentSfen.value, formationCalloutMaster, announcedFormations);
  const detailed = findNewHiraganaSuishoFormations(
    currentSfen.value, hiraganaFormationMaster, announcedFormations,
  );
  const found = direct[0] ?? detailed[0];
  if (!found) return;
  const key = "callout_id" in found ? found.callout_id : `hiragana:${found.name}`;
  announcedFormations.add(key);
  guideText.value = "speech" in found ? found.speech : `「${found.name}」の戦形だね！`;
}

function finish(matchResult: MatchResult) {
  active.value = false;
  thinking.value = false;
  result.value = matchResult;
  emit("match-end", matchResult);
  if (window.parent !== window) {
    window.parent.postMessage({
      type: "shogi-match:result",
      version: 1,
      matchId: new URLSearchParams(window.location.search).get("match_id") ?? "",
      result: matchResult,
    }, window.location.origin);
  }
}

function applyMove(usi: string, actor: "player" | "cpu") {
  if (!active.value || !appendUsiMove(record.value, usi)) return false;
  syncPosition(usi);
  moveHistory.push(usi);
  hintCandidates.value = [];
  hintText.value = "";
  announceFormation();
  emit("match-move", { usi, actor, moveCount: moveCount.value, sfen: currentSfen.value });
  const terminalResult = resultAfterMove(record.value);
  if (terminalResult) finish(terminalResult);
  return true;
}

async function showHint() {
  if (!canUseHint.value || !engine) return;
  thinking.value = true;
  hintText.value = "やこび姫が候補手を考えています…";
  try {
    const base = props.initialSfen === STANDARD_SFEN ? "startpos" : `sfen ${props.initialSfen}`;
    engine.setPosition(`${base}${moveHistory.length ? ` moves ${moveHistory.join(" ")}` : ""}`);
    engine.applyStrengthOptions({ multiPv: 3 });
    const search = await engine.go({
      nodes: searchNodes.value,
      maxTimeMs: 60000,
    });
    const moves = getHintMoves(search, 3);
    hintCandidates.value = moves.map(({ rank, move }) => ({
      usi: move, score: rank === 1 ? "本命" : `候補${rank}`,
    }));
    hintText.value = `おすすめは ${formatHintMove(moves[0].move, currentSfen.value)} だよ！`;
    hintsRemaining.value -= 1;
  } catch (error) {
    hintText.value = `ヒントを出せませんでした: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    engine?.applyStrengthOptions({ multiPv: 1 });
    thinking.value = false;
  }
}

function rebuildRecord(moves: string[]) {
  const next = createGameRecord(props.initialSfen);
  for (const move of moves) appendUsiMove(next, move);
  record.value = next;
  moveHistory = [...moves];
  syncPosition(moveHistory.at(-1) ?? "");
}

function undoTurn() {
  if (!canUndo.value) return;
  if (cpuTimer) clearTimeout(cpuTimer);
  const removeCount = normalizedMode.value === "cpu" && moveHistory.length >= 2 ? 2 : 1;
  rebuildRecord(moveHistory.slice(0, -removeCount));
  undosRemaining.value -= 1;
  hintCandidates.value = [];
  hintText.value = "";
  guideText.value = formationCalloutMaster.undo_speech;
}

function onPlayerMove(usi: string) {
  if (!canMove.value || !applyMove(usi, "player")) return;
  scheduleCpuMove();
}

async function scheduleCpuMove() {
  if (
    !active.value ||
    normalizedMode.value !== "cpu" ||
    record.value.position.color === humanColor.value
  ) return;
  if (!engineReady.value && !engineUnavailable.value) return;
  thinking.value = true;
  cpuTimer = setTimeout(async () => {
    try {
      let usi = "";
      if (engine && engineReady.value) {
        const strength = strengthSearchSettings(searchNodes.value);
        engine.applyStrengthOptions({ multiPv: strength.multiPv });
        const openingMove = strategyMove();
        const base = props.initialSfen === STANDARD_SFEN
          ? "startpos"
          : `sfen ${props.initialSfen}`;
        engine.setPosition(`${base}${moveHistory.length ? ` moves ${moveHistory.join(" ")}` : ""}`);
        const search = await engine.go({
          nodes: searchNodes.value,
          maxTimeMs: 60000,
          searchMoves: openingMove ? [openingMove] : undefined,
        });
        usi = selectMoveByRank(search, strength.moveRank).move;
      } else {
        usi = selectCpuMove(record.value.position)?.usi ?? "";
      }
      thinking.value = false;
      if (!usi) {
        const terminalResult = resultAfterMove(record.value);
        if (terminalResult) finish(terminalResult);
        return;
      }
      applyMove(usi, "cpu");
    } catch (error) {
      thinking.value = false;
      const message = error instanceof Error ? error.message : String(error);
      errorMessage.value = `やねうら王の思考に失敗しました: ${message}`;
      emit("match-error", { message });
      const move = selectCpuMove(record.value.position);
      if (move) applyMove(move.usi, "cpu");
    }
  }, Math.max(0, props.cpuDelayMs));
}

async function initializeEngine() {
  if (normalizedMode.value !== "cpu" || engineReady.value) return;
  try {
    const factories = await loadEngineFactories(null, { engineBaseUrl: props.engineBaseUrl });
    engine = new ShogiEngine({ factory: factories.factory });
    await engine.init();
    await engine.ready();
    engine.newGame();
    engineReady.value = true;
    scheduleCpuMove();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errorMessage.value = `やねうら王を起動できないため簡易CPUで続行します: ${message}`;
    engineUnavailable.value = true;
    emit("match-error", { message });
    scheduleCpuMove();
  }
}

function resign() {
  if (active.value) finish(resignationResult(record.value));
}

function restart() {
  if (cpuTimer) clearTimeout(cpuTimer);
  record.value = createRecord();
  active.value = true;
  thinking.value = false;
  result.value = null;
  moveHistory = [];
  hintsRemaining.value = Math.max(0, Math.trunc(props.hintCount));
  undosRemaining.value = Math.max(0, Math.trunc(props.undoCount));
  hintCandidates.value = [];
  hintText.value = "";
  guideText.value = formationCalloutMaster.initial_speech;
  announcedFormations.clear();
  syncPosition();
  emit("match-ready", { mode: normalizedMode.value, sfen: currentSfen.value });
  initializeEngine();
  scheduleCpuMove();
}

watch(
  () => [props.initialSfen, props.mode, props.playerColor],
  () => restart(),
);
watch(() => props.engineNodes, (value) => {
  searchNodes.value = normalizeNodes(value);
});
onBeforeUnmount(() => {
  if (cpuTimer) clearTimeout(cpuTimer);
  engine?.quit();
});

queueMicrotask(() => {
  emit("match-ready", { mode: normalizedMode.value, sfen: currentSfen.value });
  initializeEngine();
  scheduleCpuMove();
});
</script>

<style>
.shogi-game {
  box-sizing: border-box;
  display: block;
  width: 100%;
  max-width: 960px;
  margin: 0 auto;
  color: #20180d;
  font-family: system-ui, sans-serif;
}
.shogi-game__header {
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border: 1px solid #b99b6b;
  border-radius: 0.6rem;
  background: #fff8e8;
}
.shogi-game__meta {
  display: block;
  margin-top: 0.2rem;
  color: #695b48;
  font-size: 0.85rem;
}
.shogi-game__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.shogi-game__strength {
  display: flex;
  gap: 0.35rem;
  align-items: center;
  color: #695b48;
  font-size: 0.85rem;
}
.shogi-game__strength select {
  box-sizing: border-box;
  width: 7.5rem;
  min-height: 2.5rem;
  padding: 0.4rem 0.55rem;
  border: 1px solid #876d45;
  border-radius: 0.4rem;
  background: white;
  color: #20180d;
  font: inherit;
}
.shogi-game__guide,
.shogi-game__hint {
  display: flex;
  gap: 0.65rem;
  margin: 0.75rem 0 0;
  padding: 0.75rem 1rem;
  border-radius: 0.6rem;
  background: #fff8e8;
}
.shogi-game__guide strong {
  white-space: nowrap;
  color: #a33a24;
}
.shogi-game__hint {
  background: #eef7df;
}
.shogi-game button {
  min-height: 2.5rem;
  padding: 0.45rem 0.85rem;
  border: 1px solid #876d45;
  border-radius: 0.4rem;
  background: white;
  color: inherit;
  cursor: pointer;
}
.shogi-game button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}
.shogi-game__error {
  padding: 0.75rem;
  color: #991b1b;
  background: #fee2e2;
}
@media (max-width: 540px) {
  .shogi-game__header {
    align-items: stretch;
    flex-direction: column;
  }
  .shogi-game__actions button {
    flex: 1;
  }
  .shogi-game__strength {
    width: 100%;
  }
  .shogi-game__strength select {
    flex: 1;
  }
}
</style>
