<template>
  <section
    class="shogi-game"
    :class="{ 'shogi-game--analysis': reviewMode && analysisOpen }"
    aria-label="将棋対局"
  >
    <header class="shogi-game__toolbar">
      <button type="button" class="shogi-game__command shogi-game__command--danger" :disabled="!active || reviewMode" @click="resign">
        投了
      </button>
      <button type="button" class="shogi-game__command shogi-game__command--settings" @click="settingsOpen = !settingsOpen">
        設定
      </button>
      <span class="shogi-game__turn">{{ moveCount }}手目</span>
    </header>

    <section class="shogi-game__player-zone shogi-game__player-zone--opponent">
      <div class="shogi-game__player-card">
        <span>{{ opponentSideLabel }}</span>
        <strong>{{ normalizedMode === "cpu" ? cpuPlayerName : whitePlayerName }}</strong>
        <small>{{ normalizedMode === "cpu" ? strengthLabel : modeText }}</small>
        <div><b>戦型</b><span>{{ opponentFormationText }}</span></div>
      </div>
      <div class="shogi-game__status" aria-live="polite">
        <strong>{{ statusText }}</strong>
        <span>{{ modeText }}・{{ moveCount }}手</span>
      </div>
      <section class="shogi-game__opening-guide" aria-label="やこび姫補助">
        <h2>やこび姫補助</h2>
        <div class="shogi-game__opening-presets">
          <button
            v-for="preset in OPENING_PRESETS"
            :key="preset.label"
            type="button"
            :class="{ 'is-selected': selectedStrategy === preset.strategyId && selectedCastle === preset.castleId }"
            @click="selectOpeningPreset(preset.strategyId, preset.castleId)"
          >
            {{ preset.label }}
          </button>
        </div>
        <div class="shogi-game__opening-selects">
          <label>
            <span>戦法</span>
            <select v-model="selectedStrategy" @change="announceOpeningGuide">
              <option value="">選択しない</option>
              <option v-for="strategy in OPENING_STRATEGIES" :key="strategy.id" :value="strategy.id">
                {{ strategy.label }}
              </option>
            </select>
          </label>
          <label>
            <span>囲い</span>
            <select v-model="selectedCastle" @change="announceOpeningGuide">
              <option value="">選択しない</option>
              <option v-for="castle in OPENING_CASTLES" :key="castle.id" :value="castle.id">
                {{ castle.label }}
              </option>
            </select>
          </label>
        </div>
        <p>{{ openingGuideStatus }}</p>
        <button
          v-if="selectedStrategy || selectedCastle"
          type="button"
          class="shogi-game__opening-clear"
          @click="clearOpeningGuide"
        >
          補助を終了
        </button>
      </section>
    </section>

    <div v-if="settingsOpen" class="shogi-game__settings">
      <div class="shogi-game__settings-title">対局設定</div>
      <div class="shogi-game__settings-grid">
        <label v-if="normalizedMode === 'cpu' && !engineUnavailable" class="shogi-game__strength">
          <span>CPU強さ</span>
          <select v-model.number="searchNodes" :disabled="!engineReady" aria-label="CPUの強さ">
            <option v-for="preset in CPU_STRENGTH_PRESETS" :key="preset.value" :value="preset.value">
              {{ preset.label }}（{{ preset.guide }}）
            </option>
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
        <label class="shogi-game__strength">
          <span>対局中の助言</span>
          <select v-model="coachLevel" aria-label="対局中の助言">
            <option value="off">なし</option>
            <option value="encourage">応援のみ</option>
            <option value="detailed">詳しい助言</option>
          </select>
        </label>
      </div>
      <div class="shogi-game__settings-actions">
        <button type="button" class="shogi-game__settings-restart" @click="restart">最初から</button>
        <button type="button" @click="settingsOpen = false">閉じる</button>
      </div>
    </div>

    <div ref="boardShell" class="shogi-game__board-shell">
      <ShogiMatchBoard
        :sfen="currentSfen"
        :last-move="lastMove"
        :allow-move="canMove"
        :enable-drag-and-drop="enableDragAndDrop"
        :flip="flipBoard"
        :mobile="mobile || boardLayout === 'portrait'"
        :layout="boardLayout"
        :asset-base-url="assetBaseUrl"
        :black-player-name="blackPlayerName"
        :white-player-name="effectiveWhitePlayerName"
        :candidates="boardCandidates"
        @usi-move="onPlayerMove"
      />
    </div>

    <section class="shogi-game__player-zone shogi-game__player-zone--player">
      <picture class="shogi-game__portrait shogi-game__portrait--advisor">
        <source
          media="(min-width: 1100px) and (min-aspect-ratio: 5/4)"
          :srcset="`${assetBaseUrl}/characters/sakurano-momoka.png`"
        >
        <img
          class="shogi-game__character"
          :src="`${assetBaseUrl}/characters/sakurano-momoka-portrait.png`"
          alt="助言役のやこび姫"
        >
      </picture>
      <div v-if="hintText || guideText" class="shogi-game__dialogue">
        <span class="shogi-game__dialogue-icon" aria-hidden="true">
          <svg viewBox="0 0 26 32" focusable="false">
            <path
              class="shogi-game__flame-outer"
              d="M13 1.5c1.1 4.8-1.6 7-3.6 9.7-2.1 2.9-3.8 5.6-3.8 9.1 0 5.8 3.8 10.2 8.9 10.2 5.8 0 9.9-4.2 9.9-10.1 0-4.8-2.7-9.2-7.2-13.5.3 3.3-.7 5.6-2.6 7.3.5-5.4-1.1-9.3-1.6-12.7Z"
            />
            <path
              class="shogi-game__flame-inner"
              d="M14.8 15.1c.2 2.1-.5 3.4-1.7 4.7-1.1 1.3-1.8 2.6-1.8 4.2 0 2.6 1.7 4.6 4.2 4.6 2.7 0 4.6-2 4.6-4.7 0-2.5-1.6-5.2-5.3-8.8Z"
            />
          </svg>
        </span>
        <span class="shogi-game__dialogue-text">{{ hintText || guideText }}</span>
      </div>
      <div class="shogi-game__assist-actions">
        <button type="button" class="shogi-game__awakening" :disabled="!canUseHint" @click="showHint">
          閃き <small>×{{ reviewMode ? "∞" : hintsRemaining }}</small>
        </button>
        <button v-if="!reviewMode" type="button" :disabled="!canUndo" @click="undoTurn">
          待った ×{{ undosRemaining }}
        </button>
        <button
          v-if="reviewMode"
          type="button"
          class="shogi-game__analysis-button"
          :disabled="thinking && !analysisRunning"
          @click="openKifuAnalysis"
        >{{ analysisRunning ? "解析中…" : analysisPoints.length ? "解析グラフ" : "棋譜解析" }}</button>
        <button
          v-if="reviewMode && reviewCpuEnabled"
          type="button"
          class="shogi-game__review-cpu-stop"
          @click="stopReviewCpu"
        >対CPU検討を終了</button>
      </div>
      <div class="shogi-game__player-card">
        <span>{{ playerSideLabel }}</span>
        <strong>{{ humanPlayerName }}</strong>
        <small>{{ normalizedMode === "cpu" ? "あなた" : modeText }}</small>
        <div><b>戦型</b><span>{{ playerFormationText }}</span></div>
      </div>
    </section>

    <section
      v-if="reviewMode && analysisOpen"
      class="shogi-game__analysis"
      aria-label="棋譜解析"
    >
      <div class="shogi-game__analysis-info">
        <span>先手:{{ blackPlayerName }}</span>
        <strong>{{ record.position.color === Color.BLACK ? "先手番" : "後手番" }}</strong>
        <div class="shogi-game__analysis-slider">
          <input
            type="range"
            min="0"
            :max="reviewNavigation.line.length"
            step="1"
            :value="reviewNavigation.cursor"
            :disabled="reviewCpuEnabled"
            aria-label="表示する局面の手数"
            @input="onReviewSliderInput"
            @change="scheduleReviewCoachAdvice()"
          >
        </div>
        <select
          :value="reviewNavigation.cursor"
          :disabled="reviewCpuEnabled"
          aria-label="表示する局面"
          @change="onAnalysisPositionSelect"
        >
          <option v-for="ply in reviewNavigation.line.length + 1" :key="ply - 1" :value="ply - 1">
            {{ analysisPositionOption(ply - 1) }}
          </option>
        </select>
        <span v-if="analysisRunning" class="shogi-game__analysis-progress">
          解析中 {{ analysisProgress }}/{{ analysisTotal }}
        </span>
      </div>
      <EvaluationGraph
        :points="analysisPoints"
        :current-ply="reviewNavigation.cursor"
        :total-ply="reviewNavigation.mainLine.length"
        @select="goToAnalysisPly"
      />
      <div class="shogi-game__analysis-actions">
        <button type="button" aria-label="開始局面へ" :disabled="reviewCpuEnabled || reviewNavigation.cursor === 0" @click="goToAnalysisPly(0)">&lt;&lt;</button>
        <button type="button" aria-label="一手戻る" :disabled="reviewCpuEnabled || reviewNavigation.cursor === 0" @click="navigateAnalysis(-1)">&lt;</button>
        <button type="button" aria-label="一手進む" :disabled="reviewCpuEnabled || reviewNavigation.cursor >= reviewNavigation.line.length" @click="navigateAnalysis(1)">&gt;</button>
        <button type="button" aria-label="最終局面へ" :disabled="reviewCpuEnabled || reviewNavigation.cursor >= reviewNavigation.line.length" @click="goToAnalysisPly(reviewNavigation.line.length)">&gt;&gt;</button>
        <button type="button" :disabled="!canUseHint" @click="showHint">ヒント</button>
        <button type="button" :disabled="!analysisCurrentPoint?.bestMove" @click="showAnalysisRecommendation">推奨</button>
        <button type="button" :disabled="!analysisCurrentPoint?.pv?.length" @click="showAnalysisLine">読み</button>
        <button type="button" @click="analysisFlip = !analysisFlip">反転</button>
        <button v-if="reviewNavigation.branch" type="button" @click="returnToMainLine">本筋</button>
        <button v-if="analysisRunning" type="button" @click="cancelKifuAnalysis">中止</button>
        <button v-else type="button" :disabled="reviewCpuEnabled" @click="runKifuAnalysis">再解析</button>
        <button
          v-if="!reviewCpuEnabled"
          type="button"
          :disabled="analysisRunning || thinking || !engineReady"
          @click="startReviewCpu"
        >ここから対CPU</button>
        <button v-else type="button" @click="stopReviewCpu">対CPU終了</button>
        <button type="button" @click="analysisOpen = false">閉じる</button>
      </div>
    </section>

    <p v-if="errorMessage" class="shogi-game__error" role="alert">{{ errorMessage }}</p>

    <div
      v-if="resultDialogOpen && result && resultPresentation"
      class="shogi-game__result"
      :class="`shogi-game__result--${resultPresentation.tone}`"
      role="dialog"
      aria-modal="true"
      aria-labelledby="match-result-title"
    >
      <div v-if="resultPresentation.tone === 'victory'" class="shogi-game__confetti" aria-hidden="true">
        <i v-for="index in 12" :key="index" />
      </div>
      <div class="shogi-game__result-panel">
        <h2 id="match-result-title">{{ resultPresentation.title }}</h2>
        <dl class="shogi-game__result-details">
          <div>
            <dt>手合割</dt>
            <dd>{{ resultPresentation.handicap }}</dd>
          </div>
          <div>
            <dt>先手戦型</dt>
            <dd>{{ resultPresentation.blackFormations }}</dd>
          </div>
          <div>
            <dt>後手戦型</dt>
            <dd>{{ resultPresentation.whiteFormations }}</dd>
          </div>
          <div>
            <dt>結果</dt>
            <dd>{{ resultPresentation.detail }}</dd>
          </div>
        </dl>
        <div class="shogi-game__result-actions">
          <button type="button" class="shogi-game__rematch" @click="restart">もう一度対局</button>
          <button type="button" class="shogi-game__analysis-button" @click="startKifuAnalysis">棋譜解析</button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Color, Record } from "tsshogi";
import ShogiMatchBoard from "./ShogiMatchBoard.vue";
import EvaluationGraph from "./EvaluationGraph.vue";
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
import {
  createFormationState,
  detectFormationSnapshot,
  formationNamesFromSnapshot,
  formationNamesFromState,
  updateFormationState,
} from "./core/formation-tracker.mjs";
import {
  getCandidateRiskAdvice,
  getCoachAdvice,
  getMoveFeedback,
  isSideToMoveInCheck,
  scoreForPlayer,
} from "./core/coach-advice.mjs";
import { createCoachAdviceScheduler } from "./core/coach-advice-scheduler.mjs";
import { getIdleCoachAdvice, IDLE_COACH_DELAY_MS } from "./core/idle-coach-advice.mjs";
import {
  formatHintMove,
  getHintMoves,
  getHintSearchSettings,
  hintScoreForArrow,
} from "./core/match-assists.mjs";
import { selectMoveByRank } from "./core/move-selection.mjs";
import { detectStrictMateThreat } from "./core/mate-threat";
import {
  classifyAnalyzedMove,
  formatAnalysisScore,
  scoreForBlack,
  scoreToGraphValue,
} from "./core/kifu-analysis.mjs";
import {
  CPU_STRENGTH_PRESETS,
  getStrengthSearchSettings,
  usesRandomLegalMove,
} from "./core/strength-settings.mjs";
import {
  appendReviewMove,
  createReviewNavigation,
  moveReviewCursor,
  returnReviewToMainLine,
  visibleReviewMoves,
} from "./core/review-navigation.mjs";
import {
  nextOpeningPlanMove,
  OPENING_CASTLES,
  OPENING_PRESETS,
  OPENING_STRATEGIES,
} from "./core/opening-guide.mjs";
import hiraganaFormationMaster from "./data/hiragana_suisho_formations.json";

const INITIAL_GUIDE_TEXT = "一緒に頑張ろう！";
const UNDO_GUIDE_TEXT = "もう一度、落ち着いて考えてみよう！";

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
  handicapName: { type: String, default: "" },
  hintCount: { type: Number, default: 3 },
  undoCount: { type: Number, default: 3 },
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
const resultDialogOpen = ref(false);
const reviewMode = ref(false);
const reviewNavigation = ref(createReviewNavigation());
type AnalysisPoint = {
  ply: number;
  graphValue: number;
  label: string;
  scoreLabel: string;
  bestMove?: string;
  pv?: string[];
  score?: { type: "cp" | "mate"; value: number };
  secondScore?: { type: "cp" | "mate"; value: number };
  annotation?: {
    kind: "blunder" | "mistake" | "dubious" | "good" | "brilliant";
    label: string;
    mover: "black" | "white";
  } | null;
};
const analysisOpen = ref(false);
const analysisRunning = ref(false);
const analysisProgress = ref(0);
const analysisTotal = ref(0);
const analysisPoints = ref<AnalysisPoint[]>([]);
const analysisFlip = ref(false);
const reviewCpuEnabled = ref(false);
const hintsRemaining = ref(Math.max(0, Math.trunc(props.hintCount)));
const undosRemaining = ref(Math.max(0, Math.trunc(props.undoCount)));
const hintCandidates = ref<{ usi: string; score?: number }[]>([]);
const hintText = ref("");
const guideText = ref(INITIAL_GUIDE_TEXT);
const selectedStrategy = ref("");
const selectedCastle = ref("");
const formationState = ref(createFormationState());
const searchNodes = ref(normalizeNodes(props.engineNodes));
const cpuStrategy = ref("random");
const coachLevel = ref<"off" | "encourage" | "detailed">("detailed");
const settingsOpen = ref(false);
const boardLayout = ref<"standard" | "compact" | "portrait">("standard");
const boardShell = ref<HTMLElement | null>(null);
const advisedCoachTopics = new Set<string>();
const coachAdviceLastShownAt = new Map<string, number>();
let playerTurnScore: { type: "cp" | "mate"; value: number } | undefined;
let playerTurnScoreHistoryLength = -1;
let cpuTimer: ReturnType<typeof setTimeout> | undefined;
let idleCoachTimer: ReturnType<typeof setTimeout> | undefined;
let idleCoachGeneration = 0;
let engine: ShogiEngine | null = null;
let moveHistory: string[] = [];
let boardResizeObserver: ResizeObserver | undefined;
let reviewCoachGeneration = 0;
let analysisGeneration = 0;
let reviewCpuGeneration = 0;
let reviewCoachQueue: Promise<void> = Promise.resolve();
let dedicatedCoachQueue: Promise<void> = Promise.resolve();
let dedicatedCoachRunning = false;

// 助言は対局AIより軽く保つ。局面評価は数万ノードで十分であり、
// 人間最高峰プリセット（48万ノード）相当の探索を毎手行わない。
const COACH_SEARCH_BUDGET = {
  standard: { nodes: 60000, maxTimeMs: 1500, mateTimeMs: 800, threatNodes: 12000 },
  compact: { nodes: 30000, maxTimeMs: 900, mateTimeMs: 500, threatNodes: 6000 },
} as const;

function coachSearchBudget() {
  return COACH_SEARCH_BUDGET[
    props.mobile || boardLayout.value === "portrait" ? "compact" : "standard"
  ];
}

function updateResponsiveLayout() {
  if (!boardShell.value) return;
  const width = boardShell.value.clientWidth;
  const height = boardShell.value.clientHeight;
  const layouts = [
    { name: "standard" as const, width: 1471, height: 959 },
    { name: "compact" as const, width: 1088, height: 1015 },
    { name: "portrait" as const, width: 878, height: 1168 },
  ].filter(({ name }) =>
    name !== "standard"
    || !window.matchMedia("(min-width: 1100px) and (min-aspect-ratio: 5/4)").matches
  );
  boardLayout.value = layouts.reduce((best, candidate) => {
    const bestScale = Math.min(width / best.width, height / best.height);
    const candidateScale = Math.min(width / candidate.width, height / candidate.height);
    const bestArea = best.width * best.height * bestScale * bestScale;
    const candidateArea = candidate.width * candidate.height * candidateScale * candidateScale;
    return candidateArea > bestArea ? candidate : best;
  }).name;
}

const normalizedMode = computed<GameMode>(() => props.mode === "local" ? "local" : "cpu");
const humanColor = computed(() => props.playerColor === "white" ? Color.WHITE : Color.BLACK);
const moveCount = computed(() => record.value.current.ply);
const flipBoard = computed(() => (
  normalizedMode.value === "cpu" && humanColor.value === Color.WHITE
) !== (reviewMode.value && analysisFlip.value));
const analysisCurrentPoint = computed(() =>
  analysisPoints.value.find(({ ply }) => ply === reviewNavigation.value.cursor)
);
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
const strengthLabel = computed(() =>
  CPU_STRENGTH_PRESETS.find(({ value }) => value === searchNodes.value)?.label ?? "ふつう"
);
const canMove = computed(() =>
  active.value &&
  !thinking.value &&
  (reviewMode.value
    ? (!reviewCpuEnabled.value || record.value.position.color === humanColor.value)
    : normalizedMode.value === "local" || record.value.position.color === humanColor.value)
);
const canUseHint = computed(() =>
  canMove.value
  && engineReady.value
  && (reviewMode.value || hintsRemaining.value > 0)
  && (!reviewMode.value || enumerateLegalMoves(record.value.position).length > 0)
);
const canUndo = computed(() =>
  active.value
  && !thinking.value
  && (reviewMode.value || undosRemaining.value > 0)
  && (reviewMode.value
    ? reviewNavigation.value.line.length > 0
    : normalizedMode.value === "local" ? moveHistory.length > 0 : moveHistory.length >= 2)
  && (reviewMode.value || normalizedMode.value === "local" || record.value.position.color === humanColor.value)
);
const statusText = computed(() => {
  if (reviewMode.value && reviewCpuEnabled.value) {
    return thinking.value ? `${props.cpuPlayerName}が考えています…` : "対CPU検討中です";
  }
  if (reviewMode.value) return "棋譜解析中です";
  if (result.value) {
    if (!result.value.winner) return "引き分け";
    return result.value.winner === Color.BLACK ? "先手の勝ち" : "後手の勝ち";
  }
  if (normalizedMode.value === "cpu" && !engineReady.value) return "やねうら王を起動中…";
  if (thinking.value) return `${props.cpuPlayerName}が考えています…`;
  return record.value.position.color === Color.BLACK ? "先手番です" : "後手番です";
});
const resultPresentation = computed(() => {
  if (!result.value) return null;
  const loser = result.value.winner === Color.BLACK ? "後手" : "先手";
  const finalMove = formatFinalMove(result.value);
  const prefix = finalMove
    ? `${finalMove}まで${result.value.moveCount}手で`
    : `${result.value.moveCount}手で`;
  const detail = ({
    checkmate: `${prefix}${loser}の詰み`,
    resignation: `${prefix}${loser}投了`,
    repetition: `${prefix}千日手成立`,
    "perpetual-check": `${prefix}${loser}の反則負け（連続王手の千日手）`,
  } as const)[result.value.reason];
  const common = {
    detail,
    handicap: props.handicapName.trim()
      || (props.initialSfen === STANDARD_SFEN ? "平手" : "その他"),
    blackFormations: formationNamesFromState(formationState.value, "black").join("・") || "未判定",
    whiteFormations: formationNamesFromState(formationState.value, "white").join("・") || "未判定",
  };
  if (!result.value.winner) {
    return {
      tone: "draw",
      title: "引き分け",
      ...common,
    };
  }
  if (normalizedMode.value === "local") {
    return {
      tone: "victory",
      title: result.value.winner === Color.BLACK ? "先手勝利" : "後手勝利",
      ...common,
    };
  }
  const playerWon = result.value.winner === humanColor.value;
  return playerWon
    ? { tone: "victory", title: "勝利", ...common }
    : { tone: "defeat", title: "敗北", ...common };
});
const blackFormationText = computed(() => formationTextForColor(Color.BLACK));
const whiteFormationText = computed(() => formationTextForColor(Color.WHITE));
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
const openingPlanCandidate = computed(() => {
  // currentSfen is intentionally read here so the non-ref move history is reconsidered after every move.
  const sfen = currentSfen.value;
  if (
    reviewMode.value
    || !active.value
    || !canMove.value
    || (!selectedStrategy.value && !selectedCastle.value)
  ) return null;
  const playerIsBlack = humanColor.value === Color.BLACK;
  const playerMoves = moveHistory.filter((_, index) => (index % 2 === 0) === playerIsBlack);
  return nextOpeningPlanMove({
    strategyId: selectedStrategy.value,
    castleId: selectedCastle.value,
    color: playerIsBlack ? "black" : "white",
    playedMoves: playerMoves,
    legalMoves: enumerateLegalMoves(record.value.position).map(({ usi }) => usi),
    detectedFormations: formationNamesForColor(sfen, humanColor.value),
  });
});
const boardCandidates = computed(() => (
  hintCandidates.value.length
    ? hintCandidates.value
    : openingPlanCandidate.value ? [{ usi: openingPlanCandidate.value.usi }] : []
));
const openingGuideStatus = computed(() => {
  if (!selectedStrategy.value && !selectedCastle.value) return "作りたい戦法と囲いを選んでね。";
  if (reviewMode.value) return "道しるべは対局中に表示するよ。";
  if (!canMove.value) return "あなたの手番になったら、次の一手を矢印で示すよ。";
  if (!openingPlanCandidate.value) return "形が完成したか、今の局面では予定手を指せないみたい。";
  const phase = openingPlanCandidate.value.phase === "strategy" ? "戦法" : "囲い";
  return `${phase}の次の一手：${formatHintMove(openingPlanCandidate.value.usi, currentSfen.value)}`;
});

function selectedOpeningLabel() {
  const strategy = OPENING_STRATEGIES.find(({ id }) => id === selectedStrategy.value)?.label;
  const castle = OPENING_CASTLES.find(({ id }) => id === selectedCastle.value)?.label;
  return [strategy, castle].filter(Boolean).join("＋");
}

function announceOpeningGuide() {
  const label = selectedOpeningLabel();
  if (label && coachLevel.value !== "off") {
    guideText.value = `${label}を目指そう。盤の矢印を参考にしてね！`;
  }
}

function selectOpeningPreset(strategyId: string, castleId: string) {
  selectedStrategy.value = strategyId;
  selectedCastle.value = castleId;
  announceOpeningGuide();
}

function clearOpeningGuide() {
  selectedStrategy.value = "";
  selectedCastle.value = "";
  if (coachLevel.value !== "off") guideText.value = "補助を終了したよ。";
}

function formationNamesForColor(sfen: string, color: Color): string[] {
  const key = color === Color.BLACK ? "black" : "white";
  if (!reviewMode.value) return formationNamesFromState(formationState.value, key);
  return formationNamesFromSnapshot(
    detectFormationSnapshot(sfen, hiraganaFormationMaster),
    key,
  );
}

function formationTextForColor(color: Color): string {
  const key = color === Color.BLACK ? "black" : "white";
  const names = formationNamesFromState(formationState.value, key, 3);
  return names.length ? names.join("・") : "まだ未判定";
}

function observeFormations(sfen: string) {
  formationState.value = updateFormationState(
    formationState.value,
    detectFormationSnapshot(sfen, hiraganaFormationMaster),
  );
}

function formatFinalMove(matchResult: MatchResult): string {
  const lastMove = matchResult.moves.at(-1);
  if (!lastMove) return "";
  try {
    const beforeLast = createGameRecord(props.initialSfen);
    for (const move of matchResult.moves.slice(0, -1)) appendUsiMove(beforeLast, move);
    return formatHintMove(lastMove, beforeLast.position.sfen)
      .replace(/^[1-9]/, (file) => "０１２３４５６７８９"[Number(file)]);
  } catch {
    return lastMove;
  }
}

function normalizeNodes(value: number): number {
  const nodes = Number.isFinite(value) ? value : 30000;
  return CPU_STRENGTH_PRESETS.map(({ value: preset }) => preset).reduce(
    (nearest, candidate) =>
      Math.abs(candidate - nodes) < Math.abs(nearest - nodes) ? candidate : nearest,
    30000,
  );
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
  observeFormations(currentSfen.value);
}

function displayCoachAdvice(advice: { key: string; text: string; topic?: string }): boolean {
  const lastShownAt = coachAdviceLastShownAt.get(advice.key);
  if (lastShownAt !== undefined && moveCount.value - lastShownAt < 8) return false;
  coachAdviceLastShownAt.set(advice.key, moveCount.value);
  if (advice.topic) advisedCoachTopics.add(advice.topic);
  guideText.value = advice.text;
  return true;
}

const coachAdviceScheduler = createCoachAdviceScheduler({ display: displayCoachAdvice });

function showCoachAdvice(advice?: { key: string; text: string; topic?: string } | null) {
  coachAdviceScheduler.present(advice);
}

function updateCoachAdvice(
  cpuScore?: { type: "cp" | "mate"; value: number },
  moveFeedback?: { key: string; text: string } | null,
) {
  const cpuColor = humanColor.value === Color.BLACK ? Color.WHITE : Color.BLACK;
  const score = scoreForPlayer(cpuScore, cpuColor, humanColor.value, 1);
  playerTurnScore = score;
  playerTurnScoreHistoryLength = score ? moveHistory.length : -1;
  if (coachLevel.value === "off") {
    guideText.value = "";
    return;
  }
  if (moveFeedback) {
    showCoachAdvice(moveFeedback);
    return;
  }
  const opponentColor = humanColor.value === Color.BLACK ? Color.WHITE : Color.BLACK;
  const playerFormations = formationNamesForColor(currentSfen.value, humanColor.value);
  const advice = getCoachAdvice({
    level: coachLevel.value,
    score,
    moveCount: moveCount.value,
    inCheck: isSideToMoveInCheck(currentSfen.value),
    opponentFormations: formationNamesForColor(currentSfen.value, opponentColor),
    playerFormations,
    advisedTopics: advisedCoachTopics,
  });
  showCoachAdvice(advice);
}

function currentEnginePosition() {
  const base = props.initialSfen === STANDARD_SFEN ? "startpos" : `sfen ${props.initialSfen}`;
  return `${base}${moveHistory.length ? ` moves ${moveHistory.join(" ")}` : ""}`;
}

async function analyzeCoachPosition(nodes: number, maxTimeMs: number, multiPv = 1) {
  if (!engine) return [];
  engine.setPosition(currentEnginePosition());
  engine.applyStrengthOptions({ multiPv });
  const analysis = await engine.go({ nodes, maxTimeMs });
  return analysis.candidates;
}

function updateCoachAdviceFromPlayerScore(
  score?: { type: "cp" | "mate"; value: number },
  moveFeedback?: { key: string; text: string } | null,
  storeMoveBaseline = true,
) {
  if (storeMoveBaseline) {
    playerTurnScore = score;
    playerTurnScoreHistoryLength = score ? moveHistory.length : -1;
  }
  if (coachLevel.value === "off") {
    guideText.value = "";
    return;
  }
  if (moveFeedback) {
    showCoachAdvice(moveFeedback);
    return;
  }
  const opponentColor = humanColor.value === Color.BLACK ? Color.WHITE : Color.BLACK;
  const playerFormations = formationNamesForColor(currentSfen.value, humanColor.value);
  const advice = getCoachAdvice({
    level: coachLevel.value,
    score,
    moveCount: moveCount.value,
    inCheck: isSideToMoveInCheck(currentSfen.value),
    opponentFormations: formationNamesForColor(currentSfen.value, opponentColor),
    playerFormations,
    advisedTopics: advisedCoachTopics,
  });
  showCoachAdvice(advice);
}

async function updateDedicatedCoachAdvice(
  moveFeedback?: { key: string; text: string } | null,
) {
  if (!engine || !active.value || reviewMode.value || coachLevel.value === "off") return;
  const analyzedHistoryLength = moveHistory.length;
  const analyzedSideToMove = record.value.position.color;
  const budget = coachSearchBudget();
  const candidates = await analyzeCoachPosition(
    budget.nodes,
    budget.maxTimeMs,
    coachLevel.value === "detailed" ? 5 : 1,
  );
  if (!active.value || moveHistory.length !== analyzedHistoryLength) return;
  const normalizedCandidates = candidates.map((candidate) => ({
    ...candidate,
    score: scoreForPlayer(
      candidate.score,
      analyzedSideToMove,
      humanColor.value,
    ),
  }));
  let score = normalizedCandidates.find((candidate) => candidate.rank === 1)?.score;
  // 明確な勝勢だけ専用詰み探索で確認する。軽い優勢局面ごとに実行しない。
  if (coachLevel.value === "detailed" && score?.type === "cp" && score.value >= 2500) {
    engine.setPosition(currentEnginePosition());
    const movetime = budget.mateTimeMs;
    const mate = await engine.goMate({ movetime, maxTimeMs: movetime + 300 });
    if (mate.status === "mate") score = { type: "mate", value: mate.moves.length };
  }
  if (!active.value || moveHistory.length !== analyzedHistoryLength) return;
  const inCheck = isSideToMoveInCheck(currentSfen.value);
  const mateThreat = coachLevel.value === "detailed" && !inCheck
    ? detectStrictMateThreat(currentSfen.value, 7, budget.threatNodes).isThreat
    : false;
  const riskAdvice = coachLevel.value === "detailed"
    ? getCandidateRiskAdvice(normalizedCandidates, { inCheck, mateThreat })
    : null;
  updateCoachAdviceFromPlayerScore(score, moveFeedback ?? riskAdvice, false);
}

function scheduleDedicatedCoachAdvice(
  moveFeedback?: { key: string; text: string } | null,
) {
  dedicatedCoachQueue = dedicatedCoachQueue
    .catch(() => undefined)
    .then(async () => {
      dedicatedCoachRunning = true;
      try {
        await updateDedicatedCoachAdvice(moveFeedback);
      } finally {
        dedicatedCoachRunning = false;
      }
    })
    .catch(() => undefined);
}

function cancelPlayerIdleAdvice() {
  idleCoachGeneration += 1;
  if (idleCoachTimer) {
    clearTimeout(idleCoachTimer);
    idleCoachTimer = undefined;
  }
}

function candidateGivesCheck(usi: string): boolean {
  try {
    const preview = createGameRecord(props.initialSfen);
    for (const move of moveHistory) appendUsiMove(preview, move);
    return appendUsiMove(preview, usi) && isSideToMoveInCheck(preview.position.sfen);
  } catch {
    return false;
  }
}

function schedulePlayerIdleAdvice() {
  cancelPlayerIdleAdvice();
  if (
    !active.value || reviewMode.value || normalizedMode.value !== "cpu"
    || coachLevel.value !== "detailed" || !engineReady.value
    || record.value.position.color !== humanColor.value
  ) return;
  const generation = idleCoachGeneration;
  const historyLength = moveHistory.length;
  idleCoachTimer = setTimeout(() => {
    idleCoachTimer = undefined;
    dedicatedCoachQueue = dedicatedCoachQueue
      .catch(() => undefined)
      .then(async () => {
        if (
          generation !== idleCoachGeneration || !active.value || reviewMode.value
          || moveHistory.length !== historyLength
          || record.value.position.color !== humanColor.value
        ) return;
        dedicatedCoachRunning = true;
        try {
          const candidates = await analyzeCoachPosition(20000, 800, 3);
          if (
            generation !== idleCoachGeneration || !active.value || reviewMode.value
            || moveHistory.length !== historyLength
            || record.value.position.color !== humanColor.value
          ) return;
          const best = candidates.find((candidate) => candidate.rank === 1);
          if (!best?.move || best.score?.type === "mate") return;
          const move = record.value.position.createMoveByUSI(best.move);
          if (!move) return;
          showCoachAdvice(getIdleCoachAdvice({
            usi: best.move,
            formattedMove: formatHintMove(best.move, currentSfen.value),
            pieceType: move.pieceType,
            capturedPieceType: move.capturedPieceType ?? "",
            toRank: move.to.rank,
            color: move.color,
            lastMove: lastMove.value,
            givesCheck: candidateGivesCheck(best.move),
          }));
        } finally {
          engine?.applyStrengthOptions({ multiPv: 1 });
          dedicatedCoachRunning = false;
        }
      })
      .catch(() => undefined);
  }, IDLE_COACH_DELAY_MS);
}

function scheduleReviewCoachAdvice() {
  if (!reviewMode.value || reviewCpuEnabled.value || analysisRunning.value || coachLevel.value === "off") return;
  const generation = ++reviewCoachGeneration;
  reviewCoachQueue = reviewCoachQueue.catch(() => undefined).then(async () => {
    if (generation !== reviewCoachGeneration || !reviewMode.value || !engineReady.value) return;
    thinking.value = true;
    try {
      const budget = coachSearchBudget();
      const analyzedSideToMove = record.value.position.color;
      const candidates = await analyzeCoachPosition(
        budget.nodes,
        budget.maxTimeMs,
        coachLevel.value === "detailed" ? 5 : 1,
      );
      if (generation !== reviewCoachGeneration || !reviewMode.value) return;
      const normalizedCandidates = candidates.map((candidate) => ({
        ...candidate,
        score: scoreForPlayer(candidate.score, analyzedSideToMove, humanColor.value),
      }));
      const score = normalizedCandidates.find((candidate) => candidate.rank === 1)?.score;
      const inCheck = isSideToMoveInCheck(currentSfen.value);
      const isPlayerTurn = analyzedSideToMove === humanColor.value;
      const mateThreat = coachLevel.value === "detailed" && isPlayerTurn && !inCheck
        ? detectStrictMateThreat(currentSfen.value, 7, budget.threatNodes).isThreat
        : false;
      const riskAdvice = coachLevel.value === "detailed" && isPlayerTurn
        ? getCandidateRiskAdvice(normalizedCandidates, { inCheck, mateThreat })
        : null;
      updateCoachAdviceFromPlayerScore(score, riskAdvice);
    } finally {
      if (generation === reviewCoachGeneration) thinking.value = false;
    }
  });
}

function finish(matchResult: MatchResult) {
  cancelPlayerIdleAdvice();
  active.value = false;
  thinking.value = false;
  result.value = matchResult;
  resultDialogOpen.value = true;
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
  if (!reviewMode.value) {
    emit("match-move", { usi, actor, moveCount: moveCount.value, sfen: currentSfen.value });
    const terminalResult = resultAfterMove(record.value);
    if (terminalResult) finish(terminalResult);
  }
  return true;
}

async function showHint() {
  if (!canUseHint.value || !engine) return;
  thinking.value = true;
  hintText.value = "やこび姫が候補手を考えています…";
  try {
    const base = props.initialSfen === STANDARD_SFEN ? "startpos" : `sfen ${props.initialSfen}`;
    engine.setPosition(`${base}${moveHistory.length ? ` moves ${moveHistory.join(" ")}` : ""}`);
    const hintSearch = getHintSearchSettings(props.mobile || boardLayout.value === "portrait");
    engine.applyStrengthOptions({ multiPv: hintSearch.multiPv });
    const search = await engine.go({
      nodes: hintSearch.nodes,
      maxTimeMs: hintSearch.maxTimeMs,
    });
    const moves = getHintMoves(search, 3);
    hintCandidates.value = moves.map(({ move, score }) => ({
      usi: move, score: hintScoreForArrow(score),
    }));
    hintText.value = `おすすめは ${formatHintMove(moves[0].move, currentSfen.value)} だよ！`;
    if (!reviewMode.value) hintsRemaining.value -= 1;
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
  cancelPlayerIdleAdvice();
  coachAdviceScheduler.reset();
  if (cpuTimer) clearTimeout(cpuTimer);
  const removeCount = !reviewMode.value && normalizedMode.value === "cpu" && moveHistory.length >= 2 ? 2 : 1;
  rebuildRecord(moveHistory.slice(0, -removeCount));
  if (!reviewMode.value) undosRemaining.value -= 1;
  playerTurnScore = undefined;
  playerTurnScoreHistoryLength = -1;
  hintCandidates.value = [];
  hintText.value = "";
  guideText.value = coachLevel.value === "off" ? "" : UNDO_GUIDE_TEXT;
  schedulePlayerIdleAdvice();
}

function onReviewSliderInput(event: Event) {
  if (reviewCpuEnabled.value) return;
  const target = event.target as HTMLInputElement;
  const cursor = Math.max(0, Math.min(
    reviewNavigation.value.line.length,
    Math.trunc(Number(target.value)),
  ));
  reviewNavigation.value = moveReviewCursor(
    reviewNavigation.value,
    cursor - reviewNavigation.value.cursor,
  );
  rebuildRecord(visibleReviewMoves(reviewNavigation.value));
  hintCandidates.value = [];
  hintText.value = "";
}

function onAnalysisPositionSelect(event: Event) {
  if (reviewCpuEnabled.value) return;
  goToAnalysisPly(Number((event.target as HTMLSelectElement).value));
}

function analysisPositionOption(ply: number): string {
  const point = analysisPoints.value.find((candidate) => candidate.ply === ply);
  return point?.label ?? (ply === 0 ? "開始局面" : `${ply}手目`);
}

function showAnalysisRecommendation() {
  const point = analysisCurrentPoint.value;
  if (!point?.bestMove) return;
  hintCandidates.value = [{ usi: point.bestMove }];
  hintText.value = `推奨手は ${formatHintMove(point.bestMove, currentSfen.value)} だよ！`;
}

function showAnalysisLine() {
  const point = analysisCurrentPoint.value;
  if (!point?.pv?.length) return;
  try {
    const variation = createGameRecord(currentSfen.value);
    const labels: string[] = [];
    for (const move of point.pv.slice(0, 6)) {
      labels.push(formatHintMove(move, variation.position.sfen));
      if (!appendUsiMove(variation, move)) break;
    }
    hintText.value = `読み筋: ${labels.join(" → ")}`;
  } catch {
    hintText.value = `読み筋: ${point.pv.slice(0, 6).join(" → ")}`;
  }
}

function navigateAnalysis(delta: number) {
  if (reviewCpuEnabled.value) return;
  reviewNavigation.value = moveReviewCursor(reviewNavigation.value, delta);
  rebuildRecord(visibleReviewMoves(reviewNavigation.value));
  hintCandidates.value = [];
  hintText.value = "";
  scheduleReviewCoachAdvice();
}

function returnToMainLine() {
  if (reviewCpuEnabled.value) return;
  coachAdviceScheduler.reset();
  reviewNavigation.value = returnReviewToMainLine(reviewNavigation.value);
  rebuildRecord(visibleReviewMoves(reviewNavigation.value));
  hintCandidates.value = [];
  hintText.value = "";
  guideText.value = coachLevel.value === "off" ? "" : "本筋の局面に戻したよ！";
  scheduleReviewCoachAdvice();
}

function onPlayerMove(usi: string) {
  if (!canMove.value || !applyMove(usi, "player")) return;
  cancelPlayerIdleAdvice();
  // プレイヤーが指したら裏の助言探索を中断し、CPU本体へエンジンを明け渡す。
  if (!reviewMode.value && dedicatedCoachRunning) engine?.stop();
  if (reviewMode.value) {
    reviewNavigation.value = appendReviewMove(reviewNavigation.value, usi);
    if (reviewCpuEnabled.value) {
      scheduleReviewCpuMove();
    } else {
      scheduleReviewCoachAdvice();
    }
  } else {
    scheduleCpuMove();
  }
}

function startReviewCpu() {
  if (!reviewMode.value || !engineReady.value || analysisRunning.value || thinking.value) return;
  coachAdviceScheduler.reset();
  reviewCoachGeneration += 1;
  reviewCpuGeneration += 1;
  reviewCpuEnabled.value = true;
  analysisOpen.value = false;
  hintCandidates.value = [];
  hintText.value = "";
  guideText.value = coachLevel.value === "off"
    ? ""
    : "ここから相手をするね。閃きは何度でも使えるよ！";
  scheduleReviewCpuMove();
}

function stopReviewCpu() {
  if (!reviewCpuEnabled.value) return;
  coachAdviceScheduler.reset();
  reviewCpuEnabled.value = false;
  reviewCpuGeneration += 1;
  if (cpuTimer) {
    clearTimeout(cpuTimer);
    cpuTimer = undefined;
  }
  if (thinking.value) engine?.stop();
  thinking.value = false;
  guideText.value = coachLevel.value === "off" ? "" : "対CPU検討を終了したよ。";
}

function scheduleReviewCpuMove() {
  if (
    !reviewMode.value || !reviewCpuEnabled.value || !active.value
    || record.value.position.color === humanColor.value || thinking.value
  ) return;
  const generation = reviewCpuGeneration;
  thinking.value = true;
  cpuTimer = setTimeout(async () => {
    try {
      if (
        generation !== reviewCpuGeneration || !reviewCpuEnabled.value
        || record.value.position.color === humanColor.value
      ) return;
      let usi = "";
      if (usesRandomLegalMove(searchNodes.value)) {
        usi = selectCpuMove(record.value.position)?.usi ?? "";
      } else if (engine && engineReady.value) {
        const strength = getStrengthSearchSettings(searchNodes.value);
        engine.applyStrengthOptions({ multiPv: strength.multiPv });
        engine.setPosition(currentEnginePosition());
        const search = await engine.go({
          nodes: strength.nodes,
          maxTimeMs: 8000,
        });
        if (generation !== reviewCpuGeneration || !reviewCpuEnabled.value) return;
        usi = selectMoveByRank(
          search,
          strength.moveRank,
          Math.random,
          { maxScoreLoss: strength.maxScoreLoss },
        ).move;
      } else {
        usi = selectCpuMove(record.value.position)?.usi ?? "";
      }
      if (!usi) {
        reviewCpuEnabled.value = false;
        guideText.value = coachLevel.value === "off" ? "" : "この局面はもう指せる手がないね。";
        return;
      }
      if (applyMove(usi, "cpu")) {
        reviewNavigation.value = appendReviewMove(reviewNavigation.value, usi);
        guideText.value = coachLevel.value === "off" ? "" : "相手が指したよ。じっくり考えてみよう！";
      }
    } catch (error) {
      if (generation !== reviewCpuGeneration) return;
      const message = error instanceof Error ? error.message : String(error);
      errorMessage.value = `対CPU検討の思考に失敗しました: ${message}`;
    } finally {
      if (generation === reviewCpuGeneration) thinking.value = false;
    }
  }, Math.max(0, props.cpuDelayMs));
}

async function scheduleCpuMove() {
  if (
    !active.value ||
    reviewMode.value ||
    normalizedMode.value !== "cpu" ||
    record.value.position.color === humanColor.value
  ) return;
  if (!engineReady.value && !engineUnavailable.value) return;
  thinking.value = true;
  cpuTimer = setTimeout(async () => {
    try {
      // 操作を妨げずに走らせた助言探索と、CPU本体の探索を同じエンジン上で競合させない。
      await dedicatedCoachQueue;
      if (!active.value || reviewMode.value || record.value.position.color === humanColor.value) {
        thinking.value = false;
        return;
      }
      let usi = "";
      let selectedCpuScore: { type: "cp" | "mate"; value: number } | undefined;
      let moveFeedback: { key: string; text: string } | null = null;
      const playerMoveHistoryLength = moveHistory.length;
      const comparableBeforeScore = playerTurnScoreHistoryLength === playerMoveHistoryLength - 1
        ? playerTurnScore
        : undefined;
      if (usesRandomLegalMove(searchNodes.value)) {
        usi = selectCpuMove(record.value.position)?.usi ?? "";
      } else if (engine && engineReady.value) {
        const strength = getStrengthSearchSettings(searchNodes.value);
        const openingMove = strategyMove();
        engine.applyStrengthOptions({ multiPv: strength.multiPv });
        const base = props.initialSfen === STANDARD_SFEN
          ? "startpos"
          : `sfen ${props.initialSfen}`;
        engine.setPosition(`${base}${moveHistory.length ? ` moves ${moveHistory.join(" ")}` : ""}`);
        const search = await engine.go({
          nodes: strength.nodes,
          maxTimeMs: 60000,
        });
        const bestCpuScore = search.candidates.find((candidate) => candidate.rank === 1)?.score;
        moveFeedback = getMoveFeedback({
          level: coachLevel.value,
          beforeScore: comparableBeforeScore,
          afterScore: scoreForPlayer(
            bestCpuScore,
            record.value.position.color,
            humanColor.value,
          ),
        });
        // この評価は、CPU着手ではなく直前のプレイヤー着手に対するもの。
        // CPUの駒を動かす前に表示を確定し、相手の手への反応に見えないようにする。
        if (moveFeedback) {
          showCoachAdvice(moveFeedback);
          await nextTick();
        }
        const selection = selectMoveByRank(
          search,
          strength.moveRank,
          Math.random,
          { maxScoreLoss: strength.maxScoreLoss, preferredMove: openingMove },
        );
        usi = selection.move;
        selectedCpuScore = search.candidates.find(
          (candidate) => candidate.rank === selection.rank,
        )?.score;
      } else {
        usi = selectCpuMove(record.value.position)?.usi ?? "";
      }
      if (!usi) {
        thinking.value = false;
        const terminalResult = resultAfterMove(record.value);
        if (terminalResult) finish(terminalResult);
        return;
      }
      if (applyMove(usi, "cpu") && active.value) {
        updateCoachAdvice(selectedCpuScore);
        thinking.value = false;
        scheduleDedicatedCoachAdvice();
        schedulePlayerIdleAdvice();
      }
      thinking.value = false;
    } catch (error) {
      thinking.value = false;
      const message = error instanceof Error ? error.message : String(error);
      errorMessage.value = `やねうら王の思考に失敗しました: ${message}`;
      emit("match-error", { message });
      const move = selectCpuMove(record.value.position);
      if (move && applyMove(move.usi, "cpu") && active.value) {
        updateCoachAdvice();
        schedulePlayerIdleAdvice();
      }
    }
  }, Math.max(0, props.cpuDelayMs));
}

async function initializeEngine() {
  if ((normalizedMode.value !== "cpu" && !reviewMode.value) || engineReady.value) return;
  try {
    const factories = await loadEngineFactories(null, { engineBaseUrl: props.engineBaseUrl });
    engine = new ShogiEngine({ factory: factories.factory });
    await engine.init();
    await engine.ready();
    engine.newGame();
    engineReady.value = true;
    scheduleCpuMove();
    schedulePlayerIdleAdvice();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errorMessage.value = `やねうら王を起動できないため簡易CPUで続行します: ${message}`;
    engineUnavailable.value = true;
    emit("match-error", { message });
    scheduleCpuMove();
  }
}

function resign() {
  if (active.value && !reviewMode.value) finish(resignationResult(record.value));
}

function enterAnalysisMode(message = "棋譜を一緒に振り返ってみよう！") {
  if (cpuTimer) clearTimeout(cpuTimer);
  cancelPlayerIdleAdvice();
  coachAdviceScheduler.reset();
  reviewCpuGeneration += 1;
  reviewCpuEnabled.value = false;
  resultDialogOpen.value = false;
  reviewMode.value = true;
  reviewNavigation.value = createReviewNavigation(moveHistory);
  active.value = true;
  thinking.value = false;
  hintCandidates.value = [];
  hintText.value = "";
  guideText.value = coachLevel.value === "off" ? "" : message;
}

async function startKifuAnalysis() {
  enterAnalysisMode("棋譜を最初から調べてみるね！");
  analysisOpen.value = true;
  await initializeEngine();
  await runKifuAnalysis();
}

function openKifuAnalysis() {
  analysisOpen.value = true;
  if (analysisPoints.value.length === 0 && !analysisRunning.value) void runKifuAnalysis();
}

async function runKifuAnalysis() {
  if (!engine || !engineReady.value || analysisRunning.value || reviewCpuEnabled.value) return;
  const generation = ++analysisGeneration;
  analysisRunning.value = true;
  analysisProgress.value = 0;
  analysisTotal.value = reviewNavigation.value.mainLine.length + 1;
  analysisOpen.value = true;
  analysisPoints.value = [];
  reviewCoachGeneration += 1;
  engine.stop();
  try {
    // 同じUSIエンジンを使う助言探索を止めてから、棋譜解析へ専有させる。
    await Promise.all([
      dedicatedCoachQueue.catch(() => undefined),
      reviewCoachQueue.catch(() => undefined),
    ]);
    if (generation !== analysisGeneration || !reviewMode.value) return;
    thinking.value = true;
    const moves = [...reviewNavigation.value.mainLine];
    const base = props.initialSfen === STANDARD_SFEN
      ? "startpos"
      : `sfen ${props.initialSfen}`;
    const replay = createGameRecord(props.initialSfen);
    const positions = [{ sideToMove: replay.position.color, label: "開始局面" }];
    for (let index = 0; index < moves.length; index += 1) {
      const label = (() => {
        try {
          return `${index + 1}手目 ${formatHintMove(moves[index], replay.position.sfen)}`;
        } catch {
          return `${index + 1}手目`;
        }
      })();
      appendUsiMove(replay, moves[index]);
      positions.push({
        sideToMove: replay.position.color,
        label,
      });
    }
    analysisTotal.value = positions.length;
    const compact = props.mobile || boardLayout.value === "portrait";
    engine.applyStrengthOptions({ multiPv: 2 });
    for (let ply = 0; ply < positions.length; ply += 1) {
      if (generation !== analysisGeneration || !reviewMode.value) break;
      const prefixMoves = moves.slice(0, ply);
      engine.setPosition(`${base}${prefixMoves.length ? ` moves ${prefixMoves.join(" ")}` : ""}`);
      const search = await engine.go({
        nodes: compact ? 6000 : 12000,
        maxTimeMs: compact ? 800 : 1200,
      });
      if (generation !== analysisGeneration || !reviewMode.value) break;
      const bestCandidate = search.candidates.find((candidate) => candidate.rank === 1);
      const secondCandidate = search.candidates.find((candidate) => candidate.rank === 2);
      const rawScore = bestCandidate?.score;
      const score = scoreForBlack(rawScore, positions[ply].sideToMove);
      const secondScore = scoreForBlack(secondCandidate?.score, positions[ply].sideToMove);
      const graphValue = scoreToGraphValue(score);
      if (score && graphValue !== undefined) {
        const previous = analysisPoints.value.at(-1);
        const annotation = ply > 0 && previous
          ? classifyAnalyzedMove({
              ply,
              playedMove: moves[ply - 1],
              bestMove: previous.bestMove,
              beforeBestScore: previous.score,
              beforeSecondScore: previous.secondScore,
              afterScore: score,
            })
          : null;
        analysisPoints.value.push({
          ply,
          graphValue,
          label: positions[ply].label,
          scoreLabel: formatAnalysisScore(score),
          bestMove: bestCandidate?.move,
          pv: bestCandidate?.pv,
          score,
          secondScore,
          annotation,
        });
      }
      analysisProgress.value = ply + 1;
      await nextTick();
    }
    if (generation === analysisGeneration && analysisProgress.value === analysisTotal.value) {
      guideText.value = coachLevel.value === "off"
        ? ""
        : "棋譜解析が終わったよ。グラフから気になる局面を選んでね！";
    }
  } catch (error) {
    if (generation === analysisGeneration) {
      const message = error instanceof Error ? error.message : String(error);
      errorMessage.value = `棋譜解析に失敗しました: ${message}`;
    }
  } finally {
    analysisRunning.value = false;
    thinking.value = false;
  }
}

function cancelKifuAnalysis() {
  if (!analysisRunning.value) return;
  coachAdviceScheduler.reset();
  analysisGeneration += 1;
  engine?.stop();
  guideText.value = coachLevel.value === "off" ? "" : "棋譜解析を中止したよ。";
}

function goToAnalysisPly(ply: number) {
  if (reviewCpuEnabled.value) return;
  const mainLine = reviewNavigation.value.mainLine;
  const cursor = Math.max(0, Math.min(mainLine.length, Math.trunc(ply)));
  reviewNavigation.value = {
    ...reviewNavigation.value,
    line: [...mainLine],
    cursor,
    branch: false,
  };
  rebuildRecord(mainLine.slice(0, cursor));
  hintCandidates.value = [];
  hintText.value = "";
  if (!analysisRunning.value) scheduleReviewCoachAdvice();
}

function restart() {
  if (cpuTimer) clearTimeout(cpuTimer);
  cancelPlayerIdleAdvice();
  coachAdviceScheduler.reset();
  reviewCpuGeneration += 1;
  reviewCpuEnabled.value = false;
  analysisGeneration += 1;
  if (analysisRunning.value) engine?.stop();
  settingsOpen.value = false;
  record.value = createRecord();
  active.value = true;
  thinking.value = false;
  result.value = null;
  resultDialogOpen.value = false;
  reviewMode.value = false;
  analysisOpen.value = false;
  analysisRunning.value = false;
  analysisProgress.value = 0;
  analysisTotal.value = 0;
  analysisPoints.value = [];
  analysisFlip.value = false;
  reviewCoachGeneration += 1;
  reviewNavigation.value = createReviewNavigation();
  playerTurnScore = undefined;
  playerTurnScoreHistoryLength = -1;
  moveHistory = [];
  hintsRemaining.value = Math.max(0, Math.trunc(props.hintCount));
  undosRemaining.value = Math.max(0, Math.trunc(props.undoCount));
  hintCandidates.value = [];
  hintText.value = "";
  guideText.value = coachLevel.value === "off" ? "" : INITIAL_GUIDE_TEXT;
  advisedCoachTopics.clear();
  coachAdviceLastShownAt.clear();
  formationState.value = createFormationState();
  syncPosition();
  emit("match-ready", { mode: normalizedMode.value, sfen: currentSfen.value });
  initializeEngine();
  scheduleCpuMove();
  schedulePlayerIdleAdvice();
}

watch(
  () => [props.initialSfen, props.mode, props.playerColor],
  () => restart(),
);
watch(() => props.engineNodes, (value) => {
  searchNodes.value = normalizeNodes(value);
});
watch(coachLevel, (level) => {
  cancelPlayerIdleAdvice();
  coachAdviceScheduler.reset();
  coachAdviceLastShownAt.clear();
  guideText.value = level === "off" ? "" : INITIAL_GUIDE_TEXT;
  if (reviewMode.value && !reviewCpuEnabled.value && !analysisRunning.value && level !== "off") {
    scheduleReviewCoachAdvice();
  } else if (
    level !== "off" && engineReady.value && active.value && !thinking.value
    && record.value.position.color === humanColor.value
  ) {
    scheduleDedicatedCoachAdvice();
    if (level === "detailed") schedulePlayerIdleAdvice();
  }
});
onBeforeUnmount(() => {
  cancelPlayerIdleAdvice();
  coachAdviceScheduler.reset();
  analysisGeneration += 1;
  reviewCoachGeneration += 1;
  reviewCpuGeneration += 1;
  if (cpuTimer) clearTimeout(cpuTimer);
  engine?.quit();
  boardResizeObserver?.disconnect();
});
onMounted(() => {
  updateResponsiveLayout();
  boardResizeObserver = new ResizeObserver(updateResponsiveLayout);
  if (boardShell.value) boardResizeObserver.observe(boardShell.value);
});

queueMicrotask(() => {
  observeFormations(currentSfen.value);
  emit("match-ready", { mode: normalizedMode.value, sfen: currentSfen.value });
  initializeEngine();
  scheduleCpuMove();
});
</script>

<style>
:host {
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}
.shogi-game {
  --gold: #d8ad55;
  --ink: #fff8ec;
  --panel: rgba(38, 17, 24, 0.92);
  box-sizing: border-box;
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 20rem;
  grid-template-rows: auto minmax(0, 0.8fr) minmax(0, 1.2fr);
  width: 100%;
  max-width: none;
  height: 100dvh;
  min-height: 0;
  margin: 0 auto;
  padding: clamp(0.5rem, 1.6vw, 1.25rem);
  overflow: hidden;
  border: 1px solid rgba(255, 216, 140, 0.45);
  border-radius: 0;
  color: var(--ink);
  background:
    radial-gradient(circle at 12% 20%, rgba(255, 226, 230, 0.78) 0 7%, transparent 22%),
    radial-gradient(circle at 90% 10%, rgba(255, 182, 194, 0.7) 0 5%, transparent 24%),
    linear-gradient(145deg, #861f38 0%, #d8495c 38%, #f5969e 66%, #6e1831 100%);
  box-shadow: inset 0 0 5rem rgba(39, 3, 15, 0.55), 0 1rem 3rem rgba(0, 0, 0, 0.38);
  font-family: "Yu Mincho", "Hiragino Mincho ProN", serif;
}
.shogi-game *,
.shogi-game *::before,
.shogi-game *::after {
  box-sizing: border-box;
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
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  gap: 0.75rem;
  align-items: center;
  padding: 0.25rem 0.5rem 0.65rem;
  grid-column: 2;
  grid-row: 1;
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
  width: 100%;
  min-width: 0;
  clip-path: polygon(10% 0, 90% 0, 100% 50%, 90% 100%, 10% 100%, 0 50%);
}
.shogi-game__command--danger {
  background: linear-gradient(#d96734, #9d261d);
}
.shogi-game__command--settings {
  background: linear-gradient(#0788bc, #075074);
}
.shogi-game__turn {
  margin-left: 0;
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
  grid-column: 2;
  grid-row: 2;
  grid-template-columns: 1fr;
  gap: 0.5rem;
  min-height: 0;
  padding-right: 0;
}
.shogi-game__opening-guide {
  display: none;
}
.shogi-game__player-zone--player {
  grid-column: 2;
  grid-row: 3;
  grid-template-columns: 1fr;
  gap: 0.45rem;
  min-height: 0;
  padding: 0.5rem 0 0;
  align-content: end;
}
.shogi-game__portrait {
  position: absolute;
  z-index: 0;
  width: clamp(9rem, 24vw, 15rem);
  height: clamp(8rem, 20vw, 11rem);
  overflow: hidden;
  pointer-events: none;
}
.shogi-game__character {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  image-rendering: auto;
}
.shogi-game__portrait--advisor {
  bottom: 0;
  left: 0;
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
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.7rem;
  align-items: start;
  padding-top: 0.45rem;
  border-top: 1px solid rgba(216, 173, 85, 0.55);
  line-height: 1.4;
}
.shogi-game__player-card > div > span {
  min-width: 0;
  overflow-wrap: anywhere;
}
.shogi-game__player-card b {
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
  position: absolute;
  z-index: 20;
  top: 4.5rem;
  right: 1rem;
  width: min(36rem, calc(100% - 2rem));
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
.shogi-game__settings-actions {
  display: flex;
  gap: 0.6rem;
  justify-content: flex-end;
  margin-top: 0.8rem;
}
.shogi-game__settings-restart {
  border-color: #e6a66f !important;
  background: linear-gradient(#9b4a32, #57251e) !important;
}
.shogi-game__settings-actions button {
  min-width: 6.5rem;
  padding: 0.55rem 1rem;
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
  grid-column: 1;
  grid-row: 1 / 4;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  padding: 0.45rem;
  overflow: hidden;
  border: 3px solid var(--gold);
  background: rgba(27, 9, 14, 0.88);
  box-shadow: 0 0.6rem 1.4rem rgba(25, 0, 8, 0.55);
}
.shogi-game__board-shell .shogi-match-theme-controls {
  display: none;
}
.shogi-game__dialogue {
  display: flex;
  gap: 0.65rem;
  align-items: center;
  min-height: 3.5rem;
  max-height: 5rem;
  overflow: auto;
  padding: 0.85rem 1rem;
}
.shogi-game__dialogue-icon {
  display: inline-flex;
  width: 1.45rem;
  height: 1.8rem;
  flex: 0 0 auto;
  filter: drop-shadow(0 0 0.3rem rgba(62, 176, 255, 0.9));
}
.shogi-game__dialogue-icon svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}
.shogi-game__flame-outer {
  fill: #237be8;
}
.shogi-game__flame-inner {
  fill: #9deaff;
}
.shogi-game__dialogue-text {
  min-width: 0;
}
.shogi-game__assist-actions {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
  align-items: center;
}
.shogi-game__assist-actions button {
  min-width: 0;
  padding-inline: 0.35rem;
  font-size: 0.86rem;
}
.shogi-game__assist-actions > .shogi-game__analysis-button {
  grid-column: 1 / -1;
}
.shogi-game__analysis-button {
  border-color: #78d4ff !important;
  background: linear-gradient(#285f82, #173247) !important;
  box-shadow: 0 0 .8rem rgba(66, 181, 255, .3) !important;
}
.shogi-game__analysis {
  z-index: 2;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  width: 100%;
  min-width: 0;
  min-height: 0;
  padding: 0;
  overflow: hidden;
  border: 2px solid #e8842c;
  border-radius: 0;
  color: #111;
  background: #fff8e7;
  box-shadow: none;
  font-family: Arial, "Yu Gothic", sans-serif;
}
.shogi-game.shogi-game--analysis {
  grid-template-rows: auto minmax(0, 1fr) minmax(15rem, 30vh);
  row-gap: 0;
  padding-block: 0;
}
.shogi-game--analysis .shogi-game__board-shell {
  grid-row: 1 / 3;
  padding-block: 0;
}
.shogi-game--analysis .shogi-game__analysis {
  grid-column: 1;
  grid-row: 3;
}
.shogi-game__analysis .evaluation-graph {
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  min-height: 0;
  overflow: hidden;
}
.shogi-game__analysis .evaluation-graph__svg {
  height: 100%;
  min-height: 0;
  aspect-ratio: auto;
}
.shogi-game__analysis .evaluation-graph__selection {
  display: none;
}
.shogi-game__analysis-info {
  display: flex;
  min-width: 0;
  min-height: 1.6rem;
  gap: .35rem;
  align-items: center;
  padding: 0 .15rem;
  color: #111;
  font-size: .82rem;
  white-space: nowrap;
}
.shogi-game__analysis-info strong {
  font-size: .82rem;
}
.shogi-game__analysis-info select {
  min-width: 8rem;
  max-width: 15rem;
  height: 1.45rem;
  border: 1px solid #666;
  border-radius: 0;
  color: #111;
  background: #fff;
  font: .78rem Arial, sans-serif;
}
.shogi-game__analysis-slider {
  min-width: 4rem;
  flex: 1;
}
.shogi-game__analysis-slider input[type="range"] {
  width: 100%;
  height: 1.2rem;
  margin: 0;
  accent-color: #1d43e8;
  cursor: ew-resize;
  vertical-align: middle;
  touch-action: pan-x;
}
.shogi-game__analysis-progress {
  color: #a74316;
  font-weight: 700;
}
.shogi-game__analysis-actions {
  display: flex;
  gap: .25rem;
  justify-content: flex-start;
  margin-top: 0;
  flex-wrap: wrap;
}
.shogi-game__analysis-actions button {
  min-width: 2.2rem;
  min-height: 1.8rem;
  padding: .15rem .55rem;
  border: 1px solid #888;
  border-radius: .1rem;
  color: #111;
  background: linear-gradient(#fff, #e9e9e9);
  box-shadow: none;
  font: 700 .8rem/1 Arial, "Yu Gothic", sans-serif;
  text-shadow: none;
}
.shogi-game .shogi-game__analysis-actions button:disabled {
  border-color: #bbb;
  color: #aaa;
  background: #eee;
  opacity: 1;
}
.shogi-game__player-zone--player .shogi-game__player-card {
  margin-left: 6.5rem;
}
.shogi-game__awakening {
  border-color: #fff0a6 !important;
  background: linear-gradient(135deg, #6f3d08 0%, #d99b22 45%, #fff0a0 58%, #a65d08 100%) !important;
  box-shadow:
    inset 0 0 0 2px rgba(83, 42, 0, 0.7),
    0 0 0.75rem rgba(255, 193, 59, 0.7) !important;
  color: #fffbea !important;
  text-shadow: 0 1px 2px #4a2600, 0 0 0.45rem #fff3ad;
}
.shogi-game__error {
  margin: 0.7rem 0 0;
  padding: 0.75rem;
  border: 1px solid #ff8d8d;
  color: #fff;
  background: rgba(110, 10, 20, 0.94);
}
.shogi-game__result {
  position: absolute;
  z-index: 100;
  inset: 0;
  display: grid;
  overflow: hidden;
  place-items: center;
  padding: 1.5rem;
  background: rgba(9, 3, 7, 0.78);
  backdrop-filter: blur(0.35rem);
  animation: result-backdrop-in 360ms ease-out both;
}
.shogi-game__result-panel {
  position: relative;
  width: min(32rem, 92vw);
  padding: clamp(1.8rem, 5vw, 3.5rem);
  border: 3px solid var(--result-accent);
  border-radius: 1rem;
  color: #fff8ec;
  background:
    radial-gradient(circle at 50% 5%, var(--result-glow), transparent 55%),
    linear-gradient(155deg, rgba(63, 24, 34, 0.98), rgba(24, 10, 16, 0.98));
  box-shadow:
    inset 0 0 2.5rem var(--result-glow),
    0 0 0 1px rgba(255, 255, 255, 0.22),
    0 1.2rem 4rem rgba(0, 0, 0, 0.65),
    0 0 2.5rem var(--result-glow);
  text-align: center;
  animation: result-panel-in 620ms cubic-bezier(0.2, 1.3, 0.3, 1) both;
}
.shogi-game__result--victory {
  --result-accent: #ffe17a;
  --result-glow: rgba(255, 198, 43, 0.38);
}
.shogi-game__result--defeat {
  --result-accent: #c97782;
  --result-glow: rgba(142, 30, 48, 0.34);
}
.shogi-game__result--draw {
  --result-accent: #c8b9d9;
  --result-glow: rgba(147, 123, 178, 0.28);
}
.shogi-game__result h2 {
  margin: 0;
  color: #fff;
  font-size: clamp(3.3rem, 10vw, 6.5rem);
  line-height: 1;
  letter-spacing: 0.12em;
  text-indent: 0.12em;
  text-shadow: 0 0 1.4rem var(--result-accent), 0 0.18rem 0 #541d25;
}
.shogi-game__result--defeat h2 {
  animation: result-defeat-pulse 2.2s ease-in-out infinite;
}
.shogi-game__result-details {
  display: grid;
  gap: 0.5rem;
  margin: 1.35rem 0 1.5rem;
  text-align: left;
}
.shogi-game__result-details > div {
  display: grid;
  grid-template-columns: 5.5rem minmax(0, 1fr);
  gap: 0.75rem;
  padding: 0.55rem 0.65rem;
  border-bottom: 1px solid rgba(255, 225, 122, 0.32);
  background: rgba(16, 7, 11, 0.28);
}
.shogi-game__result-details dt {
  color: var(--result-accent);
  font-weight: 700;
}
.shogi-game__result-details dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  color: #fff8ec;
}
.shogi-game__rematch {
  border-color: var(--result-accent) !important;
  background: linear-gradient(#7a3540, #42151e) !important;
  box-shadow: 0 0 1.2rem var(--result-glow) !important;
}
.shogi-game__result-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
  gap: 0.65rem;
}
.shogi-game__result-actions button {
  min-width: 0;
  padding: 0.7rem 0.55rem;
}
.shogi-game__confetti {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.shogi-game__confetti i {
  position: absolute;
  top: -8%;
  left: 50%;
  width: 0.65rem;
  height: 1.15rem;
  background: #ffe17a;
  animation: result-confetti-fall 2.8s ease-in infinite;
}
.shogi-game__confetti i:nth-child(3n) { background: #ff7f9b; }
.shogi-game__confetti i:nth-child(3n + 1) { background: #fff4c2; }
.shogi-game__confetti i:nth-child(1) { left: 8%; animation-delay: -0.4s; }
.shogi-game__confetti i:nth-child(2) { left: 16%; animation-delay: -1.9s; }
.shogi-game__confetti i:nth-child(3) { left: 25%; animation-delay: -0.8s; }
.shogi-game__confetti i:nth-child(4) { left: 34%; animation-delay: -2.3s; }
.shogi-game__confetti i:nth-child(5) { left: 42%; animation-delay: -1.2s; }
.shogi-game__confetti i:nth-child(6) { left: 49%; animation-delay: -2.6s; }
.shogi-game__confetti i:nth-child(7) { left: 57%; animation-delay: -0.2s; }
.shogi-game__confetti i:nth-child(8) { left: 65%; animation-delay: -1.6s; }
.shogi-game__confetti i:nth-child(9) { left: 73%; animation-delay: -2.1s; }
.shogi-game__confetti i:nth-child(10) { left: 81%; animation-delay: -0.7s; }
.shogi-game__confetti i:nth-child(11) { left: 89%; animation-delay: -1.4s; }
.shogi-game__confetti i:nth-child(12) { left: 95%; animation-delay: -2.5s; }
@keyframes result-backdrop-in {
  from { opacity: 0; }
}
@keyframes result-panel-in {
  from { transform: scale(0.65) translateY(2rem); opacity: 0; }
}
@keyframes result-defeat-pulse {
  50% { opacity: 0.72; text-shadow: 0 0 0.7rem var(--result-accent); }
}
@keyframes result-confetti-fall {
  0% { transform: translateY(-10vh) rotate(0deg); opacity: 0; }
  12% { opacity: 1; }
  100% { transform: translateY(115vh) rotate(720deg); opacity: 0.25; }
}
@media (prefers-reduced-motion: reduce) {
  .shogi-game__result,
  .shogi-game__result-panel,
  .shogi-game__result h2,
  .shogi-game__confetti i {
    animation: none;
  }
}
@media (max-width: 780px) {
  .shogi-game__settings-grid {
    grid-template-columns: 1fr;
  }
}
@media (min-width: 900px) and (min-aspect-ratio: 5/4) {
  .shogi-game {
    --panel: #2b171d;
  }
  .shogi-game__portrait--advisor {
    width: 8rem;
    height: 9rem;
  }
  .shogi-game__assist-actions,
  .shogi-game__player-zone--player .shogi-game__player-card {
    margin-left: 8.5rem;
  }
  .shogi-game__assist-actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .shogi-game button:disabled {
    border-color: #8f6d68;
    color: #c7b4b1;
    background: #5a3b43;
    filter: grayscale(0.35);
    opacity: 1;
  }
}
@media (min-width: 1100px) and (min-aspect-ratio: 5/4) {
  .shogi-game {
    grid-template-columns:
      minmax(13rem, 1fr)
      minmax(40rem, 68rem)
      minmax(15rem, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
    gap: 0.65rem;
    padding: 0.75rem;
  }
  .shogi-game__toolbar {
    grid-column: 3;
    grid-row: 1;
    gap: 0.45rem;
    padding: 0 0 0.1rem;
  }
  .shogi-game__toolbar button,
  .shogi-game__turn {
    min-width: 0;
    padding-inline: 0.55rem;
  }
  .shogi-game__board-shell {
    grid-column: 2;
    grid-row: 1 / -1;
    padding: 0.25rem;
  }
  .shogi-game__player-zone--opponent,
  .shogi-game__player-zone--player {
    min-height: 0;
    gap: 0.55rem;
    padding: 0;
    overflow: hidden;
    align-content: stretch;
    align-items: stretch;
  }
  .shogi-game__player-zone--opponent {
    grid-column: 1;
    grid-row: 1 / -1;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto auto minmax(0, 1fr);
    align-content: start;
  }
  .shogi-game__player-zone--player {
    grid-column: 3;
    grid-row: 2;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) auto auto auto;
    isolation: isolate;
  }
  .shogi-game__portrait--advisor {
    position: absolute;
    z-index: 0;
    inset: 0;
    width: 100%;
    height: 100%;
    min-height: 0;
    background:
      linear-gradient(180deg, rgba(43, 23, 29, 0.02) 0 42%, rgba(43, 23, 29, 0.32) 68%, rgba(43, 23, 29, 0.72) 100%);
  }
  .shogi-game__portrait--advisor .shogi-game__character {
    object-fit: cover;
    object-position: center top;
  }
  .shogi-game__dialogue,
  .shogi-game__assist-actions,
  .shogi-game__player-zone--player .shogi-game__player-card {
    position: relative;
    z-index: 2;
  }
  .shogi-game__player-zone--opponent .shogi-game__player-card {
    grid-column: 1;
    grid-row: 1;
  }
  .shogi-game__player-zone--opponent .shogi-game__status {
    grid-column: 1;
    grid-row: 2;
  }
  .shogi-game__opening-guide {
    display: flex;
    grid-column: 1;
    grid-row: 3;
    min-height: 0;
    flex-direction: column;
    gap: 0.55rem;
    padding: 0.8rem;
    overflow: auto;
    border: 2px solid var(--gold);
    background: linear-gradient(155deg, rgba(69, 29, 40, 0.98), rgba(34, 18, 23, 0.98));
    box-shadow: inset 0 0 1.5rem rgba(110, 34, 53, 0.42);
  }
  .shogi-game__opening-guide h2 {
    margin: 0;
    color: #f4d890;
    font-size: 1rem;
    text-align: center;
  }
  .shogi-game__opening-presets {
    display: grid;
    gap: 0.35rem;
  }
  .shogi-game__opening-presets button,
  .shogi-game__opening-clear {
    min-width: 0;
    padding: 0.45rem 0.35rem;
    border-radius: 0.35rem;
    font-size: 0.78rem;
    line-height: 1.25;
  }
  .shogi-game__opening-presets button.is-selected {
    color: #281219;
    background: linear-gradient(#f8e1a0, #c79237);
    box-shadow: 0 0 0.55rem rgba(244, 216, 144, 0.45);
  }
  .shogi-game__opening-selects {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.4rem;
  }
  .shogi-game__opening-selects label {
    display: grid;
    min-width: 0;
    gap: 0.2rem;
    color: #f4d890;
    font-size: 0.75rem;
  }
  .shogi-game__opening-selects select {
    width: 100%;
    min-width: 0;
    padding: 0.35rem 0.2rem;
    border: 1px solid var(--gold);
    color: #fff8ee;
    background: #25151a;
    font: inherit;
  }
  .shogi-game__opening-guide p {
    margin: 0;
    padding: 0.55rem;
    border-left: 3px solid #55bfe9;
    color: #f7eee8;
    background: rgba(7, 80, 116, 0.23);
    font-size: 0.78rem;
    line-height: 1.45;
  }
  .shogi-game__opening-clear {
    margin-top: auto;
  }
  .shogi-game__dialogue {
    grid-column: 1;
    grid-row: 2;
    max-height: none;
  }
  .shogi-game__assist-actions {
    grid-column: 1;
    grid-row: 3;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    margin-left: 0;
  }
  .shogi-game__player-zone--player .shogi-game__player-card {
    grid-column: 1;
    grid-row: 4;
    margin-left: 0;
  }
  .shogi-game--analysis {
    grid-template-rows: auto minmax(0, 1fr) minmax(15rem, 31vh);
  }
  .shogi-game--analysis .shogi-game__board-shell {
    grid-column: 2;
    grid-row: 1 / 3;
  }
  .shogi-game--analysis .shogi-game__player-zone--opponent {
    grid-row: 1 / -1;
  }
  .shogi-game--analysis .shogi-game__player-zone--player {
    grid-row: 2 / -1;
  }
  .shogi-game--analysis .shogi-game__analysis {
    grid-column: 2;
    grid-row: 3;
  }
}
@media (max-width: 899px), (max-aspect-ratio: 5/4) {
  .shogi-game {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: 3.5rem 5.5rem minmax(0, 1fr) 8.75rem;
    height: 100dvh;
    padding: 0.5rem;
  }
  .shogi-game__toolbar {
    grid-column: 1;
    grid-row: 1;
  }
  .shogi-game__player-zone--opponent {
    grid-column: 1;
    grid-row: 2;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    min-height: 0;
    padding-right: 0;
  }
  .shogi-game__board-shell {
    grid-column: 1;
    grid-row: 3;
  }
  .shogi-game__player-zone--player {
    grid-column: 1;
    grid-row: 4;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-rows: minmax(0, 1fr) auto;
    min-height: 0;
    padding-left: 6.5rem;
  }
  .shogi-game__portrait--advisor {
    width: 6.5rem;
    height: 8.75rem;
  }
  .shogi-game__dialogue {
    grid-column: 1;
    grid-row: 1;
    min-height: 0;
    max-height: none;
    padding: 0.55rem 0.75rem;
  }
  .shogi-game__player-zone--player .shogi-game__player-card {
    grid-column: 1;
    grid-row: 2;
    margin-left: 0;
    padding: 0.45rem 0.65rem;
  }
  .shogi-game__assist-actions {
    display: flex;
    margin-left: 0;
    grid-column: 2;
    grid-row: 1 / 3;
    flex-direction: column;
    flex-wrap: nowrap;
    align-items: stretch;
  }
  .shogi-game__assist-actions button {
    min-height: 2.35rem;
    padding: 0.4rem 0.75rem;
  }
  .shogi-game--analysis {
    grid-template-rows: 3.5rem 5.5rem minmax(0, 1fr) minmax(15rem, 28vh) 8.75rem;
  }
  .shogi-game--analysis .shogi-game__analysis {
    grid-column: 1;
    grid-row: 4;
  }
  .shogi-game--analysis .shogi-game__board-shell {
    grid-column: 1;
    grid-row: 3;
  }
  .shogi-game--analysis .shogi-game__player-zone--player {
    grid-row: 5;
  }
}
@media (min-width: 541px) and (max-aspect-ratio: 5/4) {
  .shogi-game {
    grid-template-rows: 3.5rem 5.5rem minmax(0, 1fr) 10rem;
  }
  .shogi-game__player-zone--player {
    padding-left: 9rem;
  }
  .shogi-game__portrait--advisor {
    width: 9rem;
    height: 10rem;
  }
  .shogi-game__assist-actions {
    width: 5rem;
    gap: 0.25rem;
    justify-self: end;
  }
  .shogi-game__assist-actions button {
    min-height: 1.8rem;
    padding: 0.25rem 0.3rem;
    font-size: 0.75rem;
    line-height: 1.1;
  }
  .shogi-game__assist-actions button small {
    font-size: 0.68rem;
  }
}
@media (max-width: 540px) {
  .shogi-game__analysis-info {
    flex-wrap: wrap;
    gap: .15rem .3rem;
  }
  .shogi-game__analysis-slider {
    order: 3;
    min-width: 100%;
  }
  .shogi-game {
    grid-template-rows: 3.25rem 4.5rem minmax(0, 1fr) 3.4rem;
    padding: 0.4rem;
    border-radius: 0;
  }
  .shogi-game--analysis {
    grid-template-rows: 3.25rem 4.5rem minmax(0, 1fr) minmax(15rem, 32vh) 3.4rem;
  }
  .shogi-game__toolbar {
    gap: 0.4rem;
    padding-inline: 0;
  }
  .shogi-game__command {
    min-width: 5.25rem;
    padding-inline: 0.65rem;
  }
  .shogi-game__turn {
    padding-inline: 0.5rem;
    font-size: 0.85rem;
  }
  .shogi-game__player-zone {
    min-height: 0;
  }
  .shogi-game__player-zone--opponent {
    grid-template-columns: minmax(0, 1fr) minmax(0, 0.85fr);
    min-height: 0;
    padding-right: 0;
  }
  .shogi-game__player-zone--player {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: 1fr;
    min-height: 0;
    padding-left: 3.6rem;
  }
  .shogi-game__portrait {
    width: 4.25rem;
    height: 4.5rem;
  }
  .shogi-game__portrait--advisor {
    width: 3.6rem;
    height: 3.4rem;
  }
  .shogi-game__character {
    object-position: center;
  }
  .shogi-game__player-card {
    grid-template-columns: auto 1fr;
    min-width: 0;
    padding: 0.55rem;
    font-size: 0.85rem;
  }
  .shogi-game__player-card > small {
    display: none;
  }
  .shogi-game__status {
    min-height: 3.25rem;
    padding: 0.5rem;
  }
  .shogi-game__assist-actions {
    grid-column: 1;
    grid-row: 1;
    flex-direction: row;
    flex-wrap: nowrap;
  }
  .shogi-game__assist-actions button {
    flex: 1;
    padding-inline: 0.45rem;
    font-size: 0.82rem;
  }
  .shogi-game__dialogue {
    display: none;
  }
  .shogi-game__player-zone--player .shogi-game__player-card {
    display: none;
  }
  .shogi-game__strength {
    min-width: 0;
    font-size: 0.85rem;
  }
  .shogi-game__strength select {
    min-width: 0;
    width: 62%;
  }
}
@media (max-width: 360px) {
  .shogi-game__toolbar {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .shogi-game__command {
    width: 100%;
    min-width: 0;
  }
  .shogi-game__turn {
    grid-column: 1 / -1;
    margin-left: 0;
    text-align: center;
  }
  .shogi-game__player-zone--opponent,
  .shogi-game__player-zone--player {
    padding-right: 0;
    padding-left: 0;
  }
  .shogi-game__player-zone--player {
    padding-left: 4.5rem;
    padding-right: 0;
  }
  .shogi-game__portrait {
    width: 5rem;
  }
}
</style>
