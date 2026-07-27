<template>
  <section class="shogi-game" aria-label="将棋対局">
    <header class="shogi-game__header">
      <div>
        <strong>{{ statusText }}</strong>
        <span class="shogi-game__meta">{{ modeText }}・{{ moveCount }}手</span>
      </div>
      <div class="shogi-game__actions">
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
      @usi-move="onPlayerMove"
    />

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
  GameMode,
  MatchResult,
  resignationResult,
  resultAfterMove,
  selectCpuMove,
  STANDARD_SFEN,
} from "./game-state";
import { ShogiEngine } from "./core/engine.js";
import { loadEngineFactories } from "./core/engine-loader.mjs";

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
const statusText = computed(() => {
  if (result.value) {
    if (!result.value.winner) return "引き分け";
    return result.value.winner === Color.BLACK ? "先手の勝ち" : "後手の勝ち";
  }
  if (normalizedMode.value === "cpu" && !engineReady.value) return "やねうら王を起動中…";
  if (thinking.value) return `${props.cpuPlayerName}が考えています…`;
  return record.value.position.color === Color.BLACK ? "先手番です" : "後手番です";
});

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
  emit("match-move", { usi, actor, moveCount: moveCount.value, sfen: currentSfen.value });
  const terminalResult = resultAfterMove(record.value);
  if (terminalResult) finish(terminalResult);
  return true;
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
        const base = props.initialSfen === STANDARD_SFEN
          ? "startpos"
          : `sfen ${props.initialSfen}`;
        engine.setPosition(`${base}${moveHistory.length ? ` moves ${moveHistory.join(" ")}` : ""}`);
        usi = (await engine.go({
          nodes: Math.max(1, Math.trunc(props.engineNodes)),
          maxTimeMs: 5000,
        })).move;
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
  syncPosition();
  emit("match-ready", { mode: normalizedMode.value, sfen: currentSfen.value });
  initializeEngine();
  scheduleCpuMove();
}

watch(
  () => [props.initialSfen, props.mode, props.playerColor],
  () => restart(),
);
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
  gap: 0.5rem;
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
}
</style>
