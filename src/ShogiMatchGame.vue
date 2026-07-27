<template>
  <section class="shogi-game" aria-label="将棋対局">
    <header class="shogi-game__toolbar">
      <button type="button" class="shogi-game__command shogi-game__command--danger" :disabled="!active" @click="resign">
        投了
      </button>
      <button type="button" class="shogi-game__command shogi-game__command--settings" @click="settingsOpen = !settingsOpen">
        設定
      </button>
      <span class="shogi-game__turn">{{ moveCount }}手目</span>
    </header>

    <section class="shogi-game__player-zone shogi-game__player-zone--opponent">
      <img
        class="shogi-game__character shogi-game__character--opponent"
        :src="`${assetBaseUrl}/characters/mifune-hane.png`"
        alt=""
      >
      <div class="shogi-game__player-card">
        <span>{{ opponentSideLabel }}</span>
        <strong>{{ normalizedMode === "cpu" ? cpuPlayerName : whitePlayerName }}</strong>
        <small>{{ normalizedMode === "cpu" ? strengthLabel : modeText }}</small>
        <div><b>戦形</b>{{ opponentFormationText }}</div>
      </div>
      <div class="shogi-game__status" aria-live="polite">
        <strong>{{ statusText }}</strong>
        <span>{{ modeText }}・{{ moveCount }}手</span>
      </div>
    </section>

    <div v-if="settingsOpen" class="shogi-game__settings">
      <div class="shogi-game__settings-title">対局設定</div>
      <div class="shogi-game__settings-grid">
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
      </div>
    </div>

    <div class="shogi-game__board-shell">
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
    </div>

    <section class="shogi-game__player-zone shogi-game__player-zone--player">
      <img
        class="shogi-game__character shogi-game__character--player"
        :src="`${assetBaseUrl}/characters/sakurano-momoka.png`"
        alt=""
      >
      <div class="shogi-game__dialogue">
        {{ hintText || guideText }}
      </div>
      <div class="shogi-game__assist-actions">
        <button type="button" class="shogi-game__awakening" :disabled="!canUseHint" @click="showHint">
          棋桜覚醒 <small>×{{ hintsRemaining }}</small>
        </button>
        <button type="button" :disabled="!canUndo" @click="undoTurn">待った ×{{ undosRemaining }}</button>
        <button type="button" @click="restart">最初から</button>
      </div>
      <div class="shogi-game__player-card">
        <span>{{ playerSideLabel }}</span>
        <strong>{{ humanPlayerName }}</strong>
        <small>{{ normalizedMode === "cpu" ? "あなた" : modeText }}</small>
        <div><b>戦形</b>{{ playerFormationText }}</div>
      </div>
    </section>

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
import {
  detectHiraganaSuishoFormations,
  findNewHiraganaSuishoFormations,
  invertHiraganaSuishoSfen,
} from "./core/hiragana-suisho-formations.mjs";
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
const settingsOpen = ref(false);
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
const humanPlayerName = computed(() =>
  humanColor.value === Color.BLACK ? props.blackPlayerName : props.whitePlayerName
);
const playerSideLabel = computed(() =>
  normalizedMode.value === "cpu"
    ? (humanColor.value === Color.BLACK ? "先手" : "後手")
    : "先手"
);
const opponentSideLabel = computed(() =>
  normalizedMode.value === "cpu"
    ? (humanColor.value === Color.BLACK ? "後手" : "先手")
    : "後手"
);
const strengthLabel = computed(() => ({
  1000: "入門",
  10000: "やさしい",
  30000: "ふつう",
  100000: "強い",
  300000: "かなり強い",
}[searchNodes.value] ?? "ふつう"));
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
  if (thinking.value) return `${props.cpuPlayerName}が考えています…`;
  return record.value.position.color === Color.BLACK ? "先手番です" : "後手番です";
});
const blackFormationText = computed(() => formationTextForColor(currentSfen.value, Color.BLACK));
const whiteFormationText = computed(() => formationTextForColor(currentSfen.value, Color.WHITE));
const playerFormationText = computed(() =>
  normalizedMode.value === "cpu" && humanColor.value === Color.WHITE
    ? whiteFormationText.value
    : blackFormationText.value
);
const opponentFormationText = computed(() =>
  normalizedMode.value === "cpu" && humanColor.value === Color.WHITE
    ? blackFormationText.value
    : whiteFormationText.value
);

function formationTextForColor(sfen: string, color: Color): string {
  let perspective = color === Color.BLACK ? sfen : invertHiraganaSuishoSfen(sfen);
  const fields = perspective.split(/\s+/);
  fields[1] = "w";
  perspective = fields.join(" ");
  const names = [...new Set(
    detectHiraganaSuishoFormations(perspective, hiraganaFormationMaster)
      .map((formation) => formation.name),
  )].slice(0, 3);
  return names.length ? names.join("・") : "まだ未判定";
}

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
  --gold: #d8ad55;
  --ink: #fff8ec;
  --panel: rgba(38, 17, 24, 0.92);
  box-sizing: border-box;
  position: relative;
  display: block;
  width: 100%;
  max-width: 1040px;
  margin: 0 auto;
  padding: clamp(0.5rem, 1.6vw, 1.25rem);
  overflow: hidden;
  border: 1px solid rgba(255, 216, 140, 0.45);
  border-radius: 1rem;
  color: var(--ink);
  background:
    radial-gradient(circle at 12% 20%, rgba(255, 226, 230, 0.78) 0 7%, transparent 22%),
    radial-gradient(circle at 90% 10%, rgba(255, 182, 194, 0.7) 0 5%, transparent 24%),
    linear-gradient(145deg, #861f38 0%, #d8495c 38%, #f5969e 66%, #6e1831 100%);
  box-shadow: inset 0 0 5rem rgba(39, 3, 15, 0.55), 0 1rem 3rem rgba(0, 0, 0, 0.38);
  font-family: "Yu Mincho", "Hiragino Mincho ProN", serif;
}
.shogi-game::before {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, transparent 49%, rgba(255,255,255,.08) 50%, transparent 51%),
    linear-gradient(0deg, transparent 49%, rgba(255,255,255,.06) 50%, transparent 51%);
  background-size: 5rem 5rem;
  content: "";
  opacity: 0.35;
  pointer-events: none;
}
.shogi-game > * {
  position: relative;
  z-index: 1;
}
.shogi-game__toolbar {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  padding: 0.25rem 0.5rem 0.65rem;
}
.shogi-game button {
  min-height: 2.65rem;
  padding: 0.5rem 1rem;
  border: 2px solid #f0cb70;
  border-radius: 0.5rem;
  color: white;
  background: linear-gradient(#6f2c32, #3f151d);
  box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.45), 0 0.25rem 0.55rem rgba(0, 0, 0, 0.35);
  font: 700 1rem/1 "Yu Mincho", serif;
  cursor: pointer;
}
.shogi-game button:disabled {
  cursor: not-allowed;
  filter: grayscale(0.65);
  opacity: 0.45;
}
.shogi-game__command {
  min-width: 8rem;
  clip-path: polygon(10% 0, 90% 0, 100% 50%, 90% 100%, 10% 100%, 0 50%);
}
.shogi-game__command--danger {
  background: linear-gradient(#d96734, #9d261d);
}
.shogi-game__command--settings {
  background: linear-gradient(#0788bc, #075074);
}
.shogi-game__turn {
  margin-left: auto;
  padding: 0.55rem 0.85rem;
  border: 1px solid var(--gold);
  border-radius: 0.35rem;
  background: var(--panel);
  font-weight: 700;
}
.shogi-game__player-zone {
  position: relative;
  display: grid;
  min-height: 9rem;
  align-items: end;
}
.shogi-game__player-zone--opponent {
  grid-template-columns: minmax(15rem, 0.9fr) minmax(12rem, 1.3fr);
  padding-right: clamp(9rem, 25vw, 17rem);
}
.shogi-game__player-zone--player {
  grid-template-columns: minmax(10rem, 1fr) minmax(12rem, 1fr);
  gap: 0.7rem;
  min-height: 13rem;
  padding-left: clamp(8rem, 24vw, 16rem);
  padding-top: 0.7rem;
}
.shogi-game__character {
  position: absolute;
  z-index: 0;
  width: clamp(10rem, 28vw, 18rem);
  height: clamp(14rem, 36vw, 24rem);
  object-fit: contain;
  object-position: center top;
  pointer-events: none;
  filter: drop-shadow(0 0.65rem 0.6rem rgba(20, 0, 8, 0.48));
}
.shogi-game__character--opponent {
  right: 0;
  bottom: -0.8rem;
}
.shogi-game__character--player {
  bottom: -2.4rem;
  left: -1.1rem;
}
.shogi-game__player-card,
.shogi-game__status,
.shogi-game__dialogue {
  z-index: 1;
  box-sizing: border-box;
  border: 2px solid var(--gold);
  background: var(--panel);
  box-shadow: inset 0 0 1.5rem rgba(110, 34, 53, 0.35);
}
.shogi-game__player-card {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 0.3rem 0.6rem;
  align-items: center;
  min-width: 0;
  padding: 0.7rem 0.9rem;
}
.shogi-game__player-card > span,
.shogi-game__player-card > small {
  color: #e7d8cf;
}
.shogi-game__player-card > div {
  grid-column: 1 / -1;
  overflow: hidden;
  padding-top: 0.45rem;
  border-top: 1px solid rgba(216, 173, 85, 0.55);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.shogi-game__player-card b {
  margin-right: 0.7rem;
  color: #f4d890;
}
.shogi-game__status {
  display: flex;
  min-height: 5.2rem;
  padding: 0.8rem 1rem;
  flex-direction: column;
  justify-content: center;
  text-align: center;
}
.shogi-game__status strong {
  min-height: 1.5rem;
  overflow: hidden;
  line-height: 1.5rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.shogi-game__status span {
  margin-top: 0.25rem;
  color: #d5c3bd;
  font-size: 0.85rem;
}
.shogi-game__settings {
  margin: 0.55rem 0;
  padding: 0.8rem;
  border: 2px solid var(--gold);
  border-radius: 0.45rem;
  background: rgba(24, 13, 18, 0.96);
}
.shogi-game__settings-title {
  margin-bottom: 0.6rem;
  color: #f4d890;
  font-weight: 700;
}
.shogi-game__settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
}
.shogi-game__strength {
  display: flex;
  gap: 0.55rem;
  align-items: center;
  justify-content: space-between;
}
.shogi-game__strength select {
  box-sizing: border-box;
  width: min(13rem, 65%);
  min-height: 2.5rem;
  padding: 0.4rem 0.55rem;
  border: 1px solid var(--gold);
  border-radius: 0.4rem;
  background: #fff9ea;
  color: #2b1618;
  font: inherit;
}
.shogi-game__board-shell {
  padding: 0.45rem;
  border: 3px solid var(--gold);
  background: rgba(27, 9, 14, 0.88);
  box-shadow: 0 0.6rem 1.4rem rgba(25, 0, 8, 0.55);
}
.shogi-game__board-shell .shogi-match-theme-controls {
  display: none;
}
.shogi-game__dialogue {
  grid-column: 1 / -1;
  min-height: 5.8rem;
  padding: 0.85rem 1rem;
}
.shogi-game__assist-actions {
  z-index: 1;
  display: flex;
  gap: 0.55rem;
  align-items: center;
  flex-wrap: wrap;
}
.shogi-game__awakening {
  border-color: #f5a8ff !important;
  background: linear-gradient(135deg, #3826ad, #b421c0) !important;
  text-shadow: 0 0 0.5rem white;
}
.shogi-game__error {
  margin: 0.7rem 0 0;
  padding: 0.75rem;
  border: 1px solid #ff8d8d;
  color: #fff;
  background: rgba(110, 10, 20, 0.94);
}
@media (max-width: 780px) {
  .shogi-game__player-zone--opponent {
    grid-template-columns: 1fr;
    gap: 0.55rem;
    padding-right: clamp(7rem, 24vw, 11rem);
  }
  .shogi-game__player-zone--player {
    grid-template-columns: 1fr;
    padding-left: clamp(7rem, 24vw, 11rem);
  }
  .shogi-game__settings-grid {
    grid-template-columns: 1fr;
  }
  .shogi-game__dialogue {
    grid-column: auto;
  }
}
@media (max-width: 540px) {
  .shogi-game {
    padding: 0.4rem;
    border-radius: 0;
  }
  .shogi-game__toolbar {
    gap: 0.4rem;
    padding-inline: 0;
  }
  .shogi-game__command {
    min-width: 6.5rem;
  }
  .shogi-game__turn {
    padding-inline: 0.5rem;
    font-size: 0.85rem;
  }
  .shogi-game__player-zone {
    min-height: 7.4rem;
  }
  .shogi-game__player-zone--opponent {
    padding-right: 6.7rem;
  }
  .shogi-game__player-zone--player {
    min-height: 15rem;
    padding-left: 6.7rem;
  }
  .shogi-game__character {
    width: 8.5rem;
    height: 13rem;
  }
  .shogi-game__player-card {
    grid-template-columns: auto 1fr;
    padding: 0.55rem;
  }
  .shogi-game__player-card > small {
    display: none;
  }
  .shogi-game__status {
    min-height: 3.8rem;
    padding: 0.5rem;
  }
  .shogi-game__assist-actions {
    grid-column: 1 / -1;
  }
  .shogi-game__assist-actions button {
    flex: 1;
    padding-inline: 0.45rem;
    font-size: 0.82rem;
  }
}
</style>
