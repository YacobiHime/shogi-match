<template>
  <div class="shogi-dex" role="dialog" aria-modal="true" aria-labelledby="shogi-reference-dex-title">
    <header class="shogi-dex__header">
      <button type="button" class="shogi-dex__back" @click="emit('close')">
        <span aria-hidden="true">←</span> {{ backLabel }}
      </button>
      <h1 id="shogi-reference-dex-title">{{ dex.title }}</h1>
    </header>

    <!-- 小さい画面では一覧をハンバーガーメニューにまとめる。 -->
    <button
      v-if="isNarrow"
      type="button"
      class="shogi-dex__list-toggle"
      :aria-expanded="listOpen"
      aria-controls="shogi-reference-dex-list"
      @click="listOpen = !listOpen"
    >
      <span aria-hidden="true">☰</span>
      <span>{{ dex.listLabel }}</span>
      <small v-if="selectedEntry">現在：{{ selectedEntry.label }}</small>
    </button>

    <div ref="bodyEl" class="shogi-dex__body">
      <nav
        id="shogi-reference-dex-list"
        class="shogi-dex__list"
        :class="{ 'shogi-dex__list--open': listOpen }"
        :aria-label="dex.listLabel"
      >
        <button
          v-if="isNarrow"
          type="button"
          class="shogi-dex__list-close"
          @click="listOpen = false"
        >✕ 閉じる</button>
        <section v-for="group in groups" :key="group.id" class="shogi-dex__group">
          <h2>{{ group.label }}</h2>
          <ul>
            <li v-for="item in group.items" :key="item.id">
              <button
                type="button"
                :class="{ 'shogi-dex__item--active': item.id === selectedId }"
                @click="selectItem(item.id)"
              >
                <span>{{ item.label }}</span>
              </button>
            </li>
          </ul>
        </section>
      </nav>

      <section v-if="selectedEntry" ref="detailEl" class="shogi-dex__detail">
        <div class="shogi-dex__main">
          <button
            v-if="returnEntry"
            type="button"
            class="shogi-reference-dex__return"
            @click="returnToTable"
          >
            <span aria-hidden="true">←</span> {{ returnEntry.label }}へ戻る
          </button>
          <div class="shogi-dex__detail-head">
            <h2>{{ selectedEntry.label }}</h2>
            <span v-if="kind === 'tesuji' && sideToMove === 'white'" class="shogi-dex__side-note">後手番の局面</span>
            <span v-if="flipped && !selectedEntry.table" class="shogi-dex__side-note">後手から見た盤面</span>
            <button
              v-if="!selectedEntry.table"
              type="button"
              class="shogi-dex__flip"
              :aria-pressed="flipped"
              @click="flipped = !flipped"
            ><span aria-hidden="true">⇅</span> 盤を反転</button>
          </div>
          <table v-if="selectedEntry.table" class="shogi-reference-dex__tiers">
            <caption>点数は駒得の目安（局面によって変わるよ）。駒を押すと説明が見られるよ</caption>
            <tbody>
              <tr v-for="row in selectedEntry.table" :key="row.tier">
                <th scope="row" :class="`shogi-reference-dex__tier shogi-reference-dex__tier--${tierClass(row.tier)}`">
                  {{ row.tier }}
                </th>
                <td>
                  <ul>
                    <li
                      v-for="piece in row.pieces"
                      :key="piece.label"
                      class="shogi-reference-dex__tier-piece"
                      :title="piece.label"
                    >
                      <span class="shogi-reference-dex__piece-images">
                        <button
                          v-for="image in piece.images"
                          :key="image"
                          type="button"
                          class="shogi-reference-dex__piece-link"
                          :aria-label="`${pieceEntryLabel(image)}の説明を見る`"
                          @click="openPieceEntry(image)"
                        >
                          <img :src="pieceImageUrl(image)" alt="" draggable="false">
                        </button>
                      </span>
                      <span class="shogi-reference-dex__points">{{ piece.points }}<small v-if="piece.points !== '∞'">点</small></span>
                    </li>
                  </ul>
                </td>
              </tr>
            </tbody>
          </table>
          <section v-if="selectedEntry.aiTable" class="shogi-reference-dex__ai" aria-labelledby="shogi-reference-dex-ai-title">
            <h3 id="shogi-reference-dex-ai-title">{{ selectedEntry.aiTable.title }}</h3>
            <p>{{ selectedEntry.aiTable.note }}</p>
            <ol>
              <li v-for="piece in aiPieces" :key="piece.label" :title="piece.label">
                <span class="shogi-reference-dex__ai-bar" :style="{ width: `${piece.ratio * 100}%` }" aria-hidden="true"></span>
                <span class="shogi-reference-dex__piece-images">
                  <button
                    v-for="image in piece.images"
                    :key="image"
                    type="button"
                    class="shogi-reference-dex__piece-link"
                    :aria-label="`${pieceEntryLabel(image)}の説明を見る`"
                    @click="openPieceEntry(image)"
                  >
                    <img :src="pieceImageUrl(image)" alt="" draggable="false">
                  </button>
                </span>
                <strong>{{ piece.value }}</strong>
                <small>歩×{{ piece.relative }}</small>
              </li>
            </ol>
          </section>
          <template v-else>
            <p v-if="kifu && selectedEntry.kifuTitle" class="shogi-reference-dex__kifu-head">
              <strong>{{ selectedEntry.kifuTitle }}</strong>
            </p>
            <div class="shogi-dex__stage">
              <!-- 棋譜は、小さい画面では盤の横の矢印だけで前後できる。 -->
              <button
                v-if="kifu && isNarrow"
                type="button"
                class="shogi-dex__stage-nav"
                aria-label="前の局面へ戻る"
                :disabled="stepIndex === 0"
                @click="stepIndex -= 1"
              >◀</button>
              <!--
                棋譜では、盤の上下にその側の対局者の名前と評価値、盤の下に今の手を出す。
                上下の欄は高さを固定し、盤の大きさが変わらないようにする。棋譜でない項目では枠を使わない。
              -->
              <div :class="kifu ? 'shogi-reference-dex__board-frame' : 'shogi-reference-dex__board-passthrough'">
                <div v-if="kifu" class="shogi-reference-dex__player-bar shogi-reference-dex__player-bar--top">
                  <span class="shogi-reference-dex__player-name">{{ playerBars.top.side }} {{ playerBars.top.name }}</span>
                  <span class="shogi-reference-dex__player-eval">{{ playerBars.top.evaluation }}</span>
                </div>
                <div class="shogi-dex__board">
                  <ShogiMatchBoard
                    :sfen="boardSfen"
                    :flip="flipped"
                    :last-move="currentStep?.lastMove ?? ''"
                    :allow-move="false"
                    :enable-drag-and-drop="false"
                    :mobile="isNarrow"
                    :layout="isNarrow ? 'portrait' : 'standard'"
                    :asset-base-url="assetBaseUrl"
                    :candidates="boardArrows"
                    :mark-squares="kifu ? [] : marks"
                  />
                </div>
                <div v-if="kifu" class="shogi-reference-dex__player-bar shogi-reference-dex__player-bar--bottom">
                  <span class="shogi-reference-dex__player-eval">{{ playerBars.bottom.evaluation }}</span>
                  <span class="shogi-reference-dex__player-name">{{ playerBars.bottom.side }} {{ playerBars.bottom.name }}</span>
                </div>
                <p v-if="kifu" class="shogi-reference-dex__move-caption" aria-live="polite">{{ moveCaption }}</p>
              </div>
              <button
                v-if="kifu && isNarrow"
                type="button"
                class="shogi-dex__stage-nav"
                aria-label="次の局面へ進む"
                :disabled="stepIndex >= lastStep"
                @click="stepIndex += 1"
              >▶</button>
            </div>
          </template>
          <template v-if="kifu">
            <div v-if="!isNarrow" class="shogi-dex__controls">
              <button type="button" :disabled="stepIndex === 0" @click="stepIndex = 0">最初へ</button>
              <button type="button" :disabled="stepIndex === 0" @click="stepIndex -= 1">◀ 戻る</button>
              <span class="shogi-dex__step-count">{{ stepIndex }}/{{ lastStep }}手目</span>
              <button type="button" :disabled="stepIndex >= lastStep" @click="stepIndex += 1">進む ▶</button>
              <button type="button" :disabled="stepIndex >= lastStep" @click="stepIndex = lastStep">最後へ</button>
            </div>
            <!--
              棋譜の解説と、AIの解析から選んだ一言は、やこび姫が話す。
              解説の有無で盤や操作ボタンの位置が動かないよう、欄の高さは固定し、長い解説は欄の中でスクロールする。
            -->
            <div class="shogi-reference-dex__kifu-comment" aria-live="polite">
              <img
                :class="{ 'shogi-reference-dex__kifu-comment-chara--idle': !stepComment }"
                :src="`${assetBaseUrl}/characters/yakobihime-mini.webp?v=2`"
                alt=""
                aria-hidden="true"
              >
              <p v-if="stepComment">{{ stepComment }}</p>
            </div>
          </template>
          <ul v-if="legend.length" class="shogi-reference-dex__legend" aria-label="盤面の色の意味">
            <li v-for="item in legend" :key="item.tone">
              <span :class="`shogi-reference-dex__swatch shogi-reference-dex__swatch--${item.tone}`" aria-hidden="true"></span>
              {{ item.label }}
            </li>
          </ul>
        </div>

        <div class="shogi-dex__explanation-col">
          <nav v-if="kifu && highlights.length" class="shogi-reference-dex__highlights" aria-label="この対局の見せ場">
            <span class="shogi-reference-dex__highlights-label">見せ場</span>
            <button
              v-for="item in highlights"
              :key="`${item.ply}-${item.label}`"
              type="button"
              :class="{ 'shogi-reference-dex__highlight--ai': item.ai }"
              :aria-current="stepIndex === item.ply ? 'step' : undefined"
              @click="stepIndex = item.ply"
            >
              <small v-if="item.ai">AI</small>{{ item.ply }}手目 {{ item.label }}
            </button>
          </nav>
          <section v-if="kifu && analysisEngine" class="shogi-reference-dex__analysis" aria-labelledby="shogi-reference-dex-analysis-title">
            <div class="shogi-reference-dex__analysis-head">
              <h3 id="shogi-reference-dex-analysis-title">将棋AIの解析</h3>
              <button
                v-if="analysisPoints.length"
                type="button"
                class="shogi-reference-dex__arrow-toggle"
                :aria-pressed="showBestArrow"
                @click="showBestArrow = !showBestArrow"
              >最善手の矢印</button>
              <button v-if="analysisRunning" type="button" class="shogi-reference-dex__analysis-start" @click="cancelAnalysis">中止</button>
              <button
                v-else
                type="button"
                class="shogi-reference-dex__analysis-start"
                :disabled="nextAnalysisLevel === null"
                @click="nextAnalysisLevel !== null && startAnalysis(nextAnalysisLevel)"
              >{{ analysisButtonLabel }}</button>
            </div>
            <!-- 解析の進み具合。全体を確認→怪しい手を読み直し→大事な局面を深読みの段階ごとに出す。 -->
            <p v-if="analysisRunning" class="shogi-reference-dex__analysis-note" aria-live="polite">
              {{ levelLabel(runningLevel) }}で解析中
              <template v-if="analysisStage">
                <br>{{ ANALYSIS_STAGE_LABELS[analysisStage as keyof typeof ANALYSIS_STAGE_LABELS] }} {{ analysisProgress }}/{{ analysisTotal }}局面
              </template>
            </p>
            <p v-else-if="analysisLevel >= 0" class="shogi-reference-dex__analysis-note">
              解析の深さ：{{ levelLabel(analysisLevel) }}（1局面あたり{{ formatNodeCount(levelNodes(analysisLevel)) }}局面を読む）
            </p>
            <p v-if="analysisError" class="shogi-reference-dex__analysis-note" role="alert">{{ analysisError }}</p>
            <template v-if="analysisPoints.length">
              <div class="shogi-reference-dex__graph">
                <EvaluationGraph
                  :points="analysisPoints"
                  :current-ply="stepIndex"
                  :total-ply="lastStep"
                  @select="stepIndex = $event"
                />
              </div>
              <dl v-if="currentPoint" class="shogi-reference-dex__analysis-detail">
                <div>
                  <dt>評価値</dt>
                  <dd>
                    {{ currentPoint.scoreLabel }}
                    <span
                      v-if="currentPoint.annotation"
                      :class="`shogi-reference-dex__annotation shogi-reference-dex__annotation--${currentPoint.annotation.kind}`"
                    >{{ currentStep?.label }}は「{{ currentPoint.annotation.label }}」</span>
                  </dd>
                </div>
                <div v-if="bestMoveLabel">
                  <dt>最善手</dt>
                  <dd>{{ bestMoveLabel }}</dd>
                </div>
                <div v-if="pvLabel">
                  <dt>読み筋</dt>
                  <dd>{{ pvLabel }}</dd>
                </div>
              </dl>
              <p v-else class="shogi-reference-dex__analysis-note">この局面はまだ解析していないよ。</p>
            </template>
            <p v-else-if="!analysisRunning" class="shogi-reference-dex__analysis-note">
              評価値のグラフと、局面ごとの最善手・読み筋が見られるよ。
            </p>
          </section>
          <div class="shogi-dex__explanation">
            <div class="shogi-dex__speech">
              <img
                class="shogi-dex__chara"
                :src="`${assetBaseUrl}/characters/yakobihime-mini.webp?v=2`"
                alt=""
                aria-hidden="true"
              >
              <p>{{ selectedEntry.overview }}</p>
            </div>
            <dl>
              <div v-for="[label, text] in selectedEntry.rows" :key="label">
                <dt>{{ label }}</dt>
                <dd>{{ text }}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import ShogiMatchBoard from "./ShogiMatchBoard.vue";
import EvaluationGraph from "./EvaluationGraph.vue";
import { formatAnalysisScore } from "./core/kifu-analysis.mjs";
import {
  KIFU_ANALYSIS_LEVELS,
  analysisComment,
  analysisHighlights,
  findTurningPoint,
  formatAnalysisMove,
  formatNodeCount,
  formatPrincipalVariation,
  kifuAnalysisBudget,
} from "./core/reference-kifu-analysis.mjs";
import { ANALYSIS_STAGE_LABELS } from "./core/kifu-analysis-pipeline.mjs";
import {
  REFERENCE_DEX_KINDS,
  referenceDexEntries,
  referenceDexGroups,
  referenceEntryKifu,
  referenceEntryMarks,
  referenceEntrySfen,
  referencePieceImageEntryId,
} from "./core/reference-dex.mjs";

type ReferenceDexKind = "piece" | "tesuji" | "world";
type TierRow = { tier: string; pieces: { label: string; images: string[]; points: number | string }[] };
type AiTable = { title: string; note: string; pieces: { label: string; images: string[]; value: number }[] };
type ReferenceEntry = {
  id: string;
  label: string;
  table?: TierRow[];
  aiTable?: AiTable;
  overview: string;
  rows: [string, string][];
  arrows?: string[];
  kifu?: string;
  kifuTitle?: string;
  flip?: boolean;
};
type KifuStep = { sfen: string; label: string; lastMove: string; comment: string; highlight: string };
type Kifu = { black: string; white: string; ending: string; winner: "" | "black" | "white"; steps: KifuStep[] };
/** 図鑑の棋譜を段階解析する。resultsは深く読み直すときに前の結果を引き継ぐための配列で、解析が書き足す。 */
type AnalysisEngine = {
  analyze(options: {
    steps: KifuStep[];
    level: number;
    results: unknown[];
    isCancelled: () => boolean;
    onProgress: (progress: { stage: string; done: number; total: number }) => void;
    onPoints: (points: AnalysisPoint[]) => void;
  }): Promise<unknown>;
  stop(): void;
};
type AnalysisPoint = {
  ply: number;
  graphValue: number;
  label: string;
  scoreLabel: string;
  bestMove?: string;
  pv: string[];
  score?: { type: "cp" | "mate"; value: number };
  annotation: {
    kind: "blunder" | "mistake" | "dubious" | "good" | "brilliant";
    label: string;
    mover: "black" | "white";
    bestGap?: number;
    strength?: number;
  } | null;
};

const props = defineProps({
  kind: { type: String as () => ReferenceDexKind, required: true },
  // 教室などから開いたとき、最初に表示する項目。
  initialId: { type: String, default: "" },
  assetBaseUrl: { type: String, default: "." },
  // 教室から重ねて開いたときは教室へ戻るため、「戻る」とだけ表示する。
  backLabel: { type: String, default: "タイトルへ戻る" },
  // 代表局を解析する将棋AI。対局画面のエンジンを1局面ずつ借りる。ないときは解析を出さない。
  analysisEngine: { type: Object as () => AnalysisEngine | null, default: null },
});
const emit = defineEmits(["close"]);

const LEGEND_LABELS = {
  reach: "駒が動けるマス",
  target: "ねらう駒・危ない駒",
  key: "大事なマス",
} as const;

const dex = computed(() => REFERENCE_DEX_KINDS[props.kind]);
const entries = computed(() => referenceDexEntries(props.kind) as ReferenceEntry[]);
const groups = computed(() => referenceDexGroups(props.kind));
const initialEntryId = () => (
  entries.value.some(({ id }) => id === props.initialId) ? props.initialId : entries.value[0]?.id ?? ""
);
const selectedId = ref(initialEntryId());
const listOpen = ref(false);
watch(() => [props.kind, props.initialId], () => { selectedId.value = initialEntryId(); });

// 狭い画面では縦長レイアウトの盤に切り替え、駒を見やすくする。
const narrowMediaQuery = typeof window !== "undefined" && window.matchMedia
  ? window.matchMedia("(max-width: 56rem)")
  : null;
const isNarrow = ref(Boolean(narrowMediaQuery?.matches));
function onNarrowChange(event: MediaQueryListEvent) {
  isNarrow.value = event.matches;
  if (!event.matches) listOpen.value = false;
}
onMounted(() => narrowMediaQuery?.addEventListener("change", onNarrowChange));
onBeforeUnmount(() => narrowMediaQuery?.removeEventListener("change", onNarrowChange));

const selectedEntry = computed(() => entries.value.find(({ id }) => id === selectedId.value) ?? null);
const sfen = computed(() => (selectedEntry.value ? referenceEntrySfen(selectedEntry.value) : ""));
// 盤の向きは項目ごとの既定（flip）で開き、利用者が反転できる。
const flipped = ref(false);
watch(selectedEntry, (entry) => { flipped.value = Boolean(entry?.flip); }, { immediate: true });
const sideToMove = computed(() => (sfen.value.split(" ")[1] === "w" ? "white" : "black"));
const marks = computed(() => (selectedEntry.value ? referenceEntryMarks(selectedEntry.value) : []));
const arrows = computed(() => (selectedEntry.value?.arrows ?? []).map((usi) => ({ usi, guideKind: "plan" as const })));

// 代表局の棋譜は初期局面から1手ずつ並べる。項目を選び直したら初期局面へ戻す。
const kifu = computed(() => (selectedEntry.value ? referenceEntryKifu(selectedEntry.value) as Kifu | null : null));
const stepIndex = ref(0);
const lastStep = computed(() => Math.max(0, (kifu.value?.steps.length ?? 1) - 1));
const currentStep = computed(() => kifu.value?.steps[Math.min(stepIndex.value, lastStep.value)] ?? null);
const boardSfen = computed(() => currentStep.value?.sfen ?? sfen.value);
watch(selectedId, () => {
  stepIndex.value = 0;
  cancelAnalysis();
  analysisPoints.value = [];
  analysisResults = [];
  analysisError.value = "";
  analysisDone.value = false;
  analysisLevel.value = -1;
});

// 代表局を開始局面から1局面ずつ将棋AIで解析し、評価値グラフと最善手・読み筋を出す。
const analysisPoints = ref<AnalysisPoint[]>([]);
const analysisRunning = ref(false);
const analysisProgress = ref(0);
const analysisError = ref("");
// 最後まで解析し終えたときだけ、形勢の分かれ目やAIの見せ場を出す。途中では分かれ目が決まらない。
const analysisDone = ref(false);
const showBestArrow = ref(true);
let analysisGeneration = 0;
// 最後まで解析し終えた深さ（KIFU_ANALYSIS_LEVELSの番号）。まだなら-1。
const analysisLevel = ref(-1);
const runningLevel = ref(0);
const analysisStage = ref("");
const analysisTotal = ref(0);
// 局面ごとの読みの結果。深く読み直すときは、前の深さの読みを残したまま書き足す。
let analysisResults: unknown[] = [];
const mobileLayout = () => isNarrow.value;
const levelLabel = (level: number) => KIFU_ANALYSIS_LEVELS[level]?.label ?? "";
const levelNodes = (level: number) => kifuAnalysisBudget(level, mobileLayout()).nodes;
// 次に押したときの深さ。最後まで解析していなければ、途中で止めた深さから読み直す。いちばん深く読み終えたらnull。
const nextAnalysisLevel = computed(() => {
  const next = analysisLevel.value + 1;
  if (analysisRunning.value) return null;
  if (analysisLevel.value < 0) return 0;
  return next < KIFU_ANALYSIS_LEVELS.length ? next : null;
});
const analysisButtonLabel = computed(() => {
  const next = nextAnalysisLevel.value;
  if (next === null) return "いちばん深く解析済み";
  if (next === 0) return "将棋AIで解析";
  return `深く解析（${levelLabel(next)}）`;
});
const currentPoint = computed(() => analysisPoints.value.find(({ ply }) => ply === stepIndex.value) ?? null);
const bestMoveLabel = computed(() => {
  const point = currentPoint.value;
  if (!point?.bestMove || !currentStep.value) return "";
  try {
    return formatAnalysisMove(point.bestMove, currentStep.value.sfen);
  } catch {
    return point.bestMove;
  }
});
const pvLabel = computed(() => {
  const point = currentPoint.value;
  if (!point?.pv.length || !currentStep.value) return "";
  try {
    return formatPrincipalVariation(point.pv, currentStep.value.sfen);
  } catch {
    return "";
  }
});

// やこび姫の一言。棋譜に書いた解説を優先し、ない局面ではAIの解析から話す。
const turningPly = computed(() => (
  analysisDone.value ? findTurningPoint(analysisPoints.value, kifu.value?.winner ?? "") : null
));
const stepComment = computed(() => {
  const step = currentStep.value;
  if (!step || !kifu.value) return "";
  if (step.comment) return step.comment;
  return analysisComment(currentPoint.value, {
    moveLabel: step.label,
    names: { black: kifu.value.black, white: kifu.value.white },
    winner: kifu.value.winner,
    turningPly: turningPly.value,
  });
});
// 見せ場の一覧。棋譜のしおりに、AIが選んだ形勢の分かれ目と好手を加える。
const highlights = computed(() => {
  const steps = kifu.value?.steps ?? [];
  const fromKifu = steps.flatMap((step, ply) => (step.highlight ? [{ ply, label: step.highlight, ai: false }] : []));
  const fromAi = analysisDone.value
    ? analysisHighlights(analysisPoints.value, kifu.value?.winner ?? "")
      .filter(({ ply }: { ply: number }) => !fromKifu.some((item) => item.ply === ply))
      .map((item: { ply: number; label: string }) => ({ ...item, ai: true }))
    : [];
  return [...fromKifu, ...fromAi].sort((left, right) => left.ply - right.ply);
});
// 盤の上下に出す対局者の欄。盤を反転したら上下を入れ替える。評価値はその側から見た値。
function sideEvaluation(sign: 1 | -1) {
  const score = currentPoint.value?.score;
  if (!score) return "評価値 -";
  const value = score.value * sign;
  if (score.type === "mate") return value > 0 ? `${value}手で詰ませる` : `${-value}手で詰まされる`;
  return formatAnalysisScore({ type: "cp", value });
}
const playerBars = computed(() => {
  const black = { side: "先手", name: kifu.value?.black ?? "", evaluation: sideEvaluation(1) };
  const white = { side: "後手", name: kifu.value?.white ?? "", evaluation: sideEvaluation(-1) };
  return flipped.value ? { top: black, bottom: white } : { top: white, bottom: black };
});
// 盤の下に出す今の手。「5手目 ▲４八銀(39)」のように、動かした駒の元の升を添える。
const moveCaption = computed(() => {
  const step = currentStep.value;
  if (!step || stepIndex.value === 0) return "開始局面";
  const from = /^([1-9])([a-i])/.exec(step.lastMove);
  const origin = from ? `(${from[1]}${from[2].charCodeAt(0) - 96})` : "";
  const ending = stepIndex.value === lastStep.value && kifu.value?.ending ? `　まで、${kifu.value.ending}` : "";
  return `${stepIndex.value}手目 ${step.label}${origin}${ending}`;
});
const boardArrows = computed(() => {
  if (!kifu.value) return arrows.value;
  const best = currentPoint.value?.bestMove;
  return showBestArrow.value && best ? [{ usi: best, guideKind: "ai" as const }] : [];
});

/*
 * levelの深さで解析する。2回目以降（深く解析）は、前の深さの読みを残したまま深い読みを書き足し、
 * 読み直した局面から順に新しい結果へ置き換える。前の結果が全局面そろっているので、
 * 形勢の分かれ目や見せ場は読み直しの途中でも出したままにする。
 */
async function startAnalysis(level = 0) {
  const engine = props.analysisEngine;
  const steps = kifu.value?.steps;
  if (!engine || !steps || analysisRunning.value) return;
  const generation = ++analysisGeneration;
  const deeper = level > 0 && analysisLevel.value >= 0;
  analysisRunning.value = true;
  runningLevel.value = level;
  analysisStage.value = "";
  analysisProgress.value = 0;
  analysisTotal.value = 0;
  analysisError.value = "";
  if (!deeper) {
    analysisResults = [];
    analysisPoints.value = [];
    analysisDone.value = false;
  }
  try {
    await engine.analyze({
      steps,
      level,
      results: analysisResults,
      isCancelled: () => generation !== analysisGeneration,
      onProgress: ({ stage, done, total }) => {
        if (generation !== analysisGeneration) return;
        analysisStage.value = stage;
        analysisProgress.value = done;
        analysisTotal.value = total;
      },
      onPoints: (points: AnalysisPoint[]) => {
        if (generation === analysisGeneration) analysisPoints.value = points;
      },
    });
    if (generation === analysisGeneration) {
      analysisDone.value = true;
      analysisLevel.value = level;
    }
  } catch (error) {
    if (generation === analysisGeneration) {
      analysisError.value = error instanceof Error ? error.message : String(error);
    }
  } finally {
    if (generation === analysisGeneration) analysisRunning.value = false;
  }
}
function cancelAnalysis() {
  if (!analysisRunning.value) return;
  analysisGeneration += 1;
  analysisRunning.value = false;
  props.analysisEngine?.stop();
}
onBeforeUnmount(cancelAnalysis);
const legend = computed(() => {
  if (kifu.value) return [];
  const tones = new Set(marks.value.map(({ tone }: { tone: keyof typeof LEGEND_LABELS }) => tone));
  return (Object.keys(LEGEND_LABELS) as (keyof typeof LEGEND_LABELS)[])
    .filter((tone) => tones.has(tone))
    .map((tone) => ({ tone, label: LEGEND_LABELS[tone] }));
});

// 盤で選んだ駒の書体に合わせて、表の駒画像を表示する。
function pieceTheme() {
  try {
    return localStorage.getItem("shogi-match-piece-theme") || "hitomoji_wood";
  } catch {
    return "hitomoji_wood";
  }
}
const theme = pieceTheme();
function pieceImageUrl(name: string) {
  return `${props.assetBaseUrl.replace(/\/$/, "")}/piece/${theme}/${name}.webp`;
}
// 将棋AIの点数を大きい順に並べ、歩を1とした倍率と棒の長さを添える。
const aiPieces = computed(() => {
  const table = selectedEntry.value?.aiTable;
  if (!table) return [];
  const pawn = table.pieces.find(({ label }) => label === "歩兵")?.value ?? 90;
  const max = Math.max(...table.pieces.map(({ value }) => value));
  return [...table.pieces]
    .sort((left, right) => right.value - left.value)
    .map((piece) => ({
      ...piece,
      ratio: piece.value / max,
      relative: Number((piece.value / pawn).toFixed(1)),
    }));
});

function tierClass(tier: string) {
  return tier === "別格" ? "top" : tier.toLowerCase();
}

function selectItem(id: string) {
  selectedId.value = id;
  returnPoint.value = null;
  // 一覧から選んだらメニューを閉じる。
  listOpen.value = false;
}

// 表の駒から説明へ飛んだとき、元の表とスクロール位置を覚えておき、ワンタップで戻れるようにする。
// スクロールするのは、広い画面では詳細、狭い画面では本文全体。
const bodyEl = ref<HTMLElement | null>(null);
const detailEl = ref<HTMLElement | null>(null);
const returnPoint = ref<{ id: string; scroll: [number, number] } | null>(null);
const returnEntry = computed(() => entries.value.find(({ id }) => id === returnPoint.value?.id) ?? null);
watch(() => [props.kind, props.initialId], () => { returnPoint.value = null; });

function setScroll([body, detail]: [number, number]) {
  nextTick(() => {
    if (bodyEl.value) bodyEl.value.scrollTop = body;
    if (detailEl.value) detailEl.value.scrollTop = detail;
  });
}
function pieceEntryLabel(image: string) {
  const id = referencePieceImageEntryId(image);
  return entries.value.find((entry) => entry.id === id)?.label ?? "";
}
function openPieceEntry(image: string) {
  const id = referencePieceImageEntryId(image);
  if (!id) return;
  returnPoint.value = {
    id: selectedId.value,
    scroll: [bodyEl.value?.scrollTop ?? 0, detailEl.value?.scrollTop ?? 0],
  };
  selectedId.value = id;
  setScroll([0, 0]);
}
function returnToTable() {
  const point = returnPoint.value;
  if (!point) return false;
  returnPoint.value = null;
  selectedId.value = point.id;
  setScroll(point.scroll);
  return true;
}
// ブラウザの戻るでは、駒の説明から表へ戻り、それ以外は図鑑を閉じる。
function goBack() {
  if (!returnToTable()) emit("close");
}
defineExpose({ goBack });
</script>

<style>
.shogi-game .shogi-reference-dex__kifu-head {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem 0.8rem;
  margin: 0 0 0.4rem;
  font-size: 0.85rem;
}
.shogi-game .shogi-reference-dex__kifu-head strong {
  color: #f1a54c;
}
/* 盤の上下の対局者欄と今の手。高さを固定し、盤はその残りの高さに合わせる。 */
.shogi-game .shogi-reference-dex__board-passthrough {
  display: contents;
}
.shogi-game .shogi-reference-dex__board-frame {
  --player-bar: 1.7rem;
  --move-caption: 1.6rem;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  max-width: 100%;
}
.shogi-game .shogi-reference-dex__board-frame > .shogi-dex__board {
  height: calc(100% - var(--player-bar) * 2 - var(--move-caption));
}
.shogi-game .shogi-reference-dex__player-bar {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  height: var(--player-bar);
  padding: 0 0.5rem;
  overflow: hidden;
  color: #172632;
  background: #fde9b8;
  font-size: 0.85rem;
  font-weight: 700;
  white-space: nowrap;
}
.shogi-game .shogi-reference-dex__player-bar--top {
  border-radius: 0.3rem 0.3rem 0 0;
}
.shogi-game .shogi-reference-dex__player-bar--bottom {
  border-radius: 0 0 0.3rem 0.3rem;
}
.shogi-game .shogi-reference-dex__player-name {
  overflow: hidden;
  text-overflow: ellipsis;
}
.shogi-game .shogi-reference-dex__player-eval {
  flex: none;
  font-variant-numeric: tabular-nums;
}
.shogi-game .shogi-reference-dex__move-caption {
  flex: none;
  height: var(--move-caption);
  margin: 0;
  overflow: hidden;
  line-height: var(--move-caption);
  text-align: center;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 0.9rem;
  font-weight: 700;
}
@media (max-width: 56rem) {
  .shogi-game .shogi-reference-dex__board-frame {
    flex: 1;
    height: auto;
  }
  .shogi-game .shogi-reference-dex__board-frame > .shogi-dex__board {
    width: 100%;
    height: auto;
  }
}
/* 解説の欄は3行分（狭い画面では4行分）の高さで固定する。 */
.shogi-game .shogi-reference-dex__kifu-comment {
  --comment-lines: 3;
  display: flex;
  flex: none;
  gap: 0.6rem;
  align-items: flex-end;
  height: calc(var(--dex-text) * 1.6 * var(--comment-lines) + 1.1rem);
}
.shogi-game .shogi-reference-dex__kifu-comment-chara--idle {
  opacity: 0.45;
}
.shogi-game .shogi-reference-dex__kifu-comment img {
  flex: none;
  height: 3.6rem;
  width: auto;
  pointer-events: none;
  image-rendering: pixelated;
}
.shogi-game .shogi-reference-dex__kifu-comment p {
  flex: 1;
  margin: 0;
  padding: 0.5rem 0.75rem;
  border: 1px solid rgba(241, 165, 76, 0.7);
  border-radius: 0.6rem 0.6rem 0.6rem 0;
  background: rgba(255, 252, 244, 0.1);
  font-size: var(--dex-text);
  line-height: 1.6;
  max-height: 100%;
  box-sizing: border-box;
  overflow-y: auto;
}
@media (max-width: 56rem) {
  .shogi-game .shogi-reference-dex__kifu-comment {
    --comment-lines: 4;
  }
}
.shogi-game .shogi-reference-dex__highlights {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
}
.shogi-game .shogi-reference-dex__highlights-label {
  color: #f1a54c;
  font-size: 0.8rem;
  font-weight: 700;
}
.shogi-game .shogi-dex .shogi-reference-dex__highlights button {
  min-height: 2rem;
  padding: 0.2rem 0.7rem;
  border: 1px solid #f1a54c;
  border-radius: 999px;
  color: #fffcf4;
  background: rgba(241, 165, 76, 0.18);
  font: 700 0.8rem/1.2 inherit;
  font-family: inherit;
  cursor: pointer;
}
.shogi-game .shogi-dex .shogi-reference-dex__highlights button.shogi-reference-dex__highlight--ai {
  border-style: dashed;
  background: transparent;
}
.shogi-game .shogi-dex .shogi-reference-dex__highlights button[aria-current="step"] {
  color: #172632;
  background: #f1a54c;
}
.shogi-game .shogi-reference-dex__highlights small {
  margin-right: 0.3rem;
  font-size: 0.7rem;
  opacity: 0.8;
}
.shogi-game .shogi-reference-dex__analysis {
  display: grid;
  gap: 0.45rem;
  padding: 0.6rem 0.7rem;
  border: 1px solid rgba(255, 252, 244, 0.3);
  border-radius: 0.5rem;
  background: rgba(255, 252, 244, 0.05);
}
.shogi-game .shogi-reference-dex__analysis-head {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  align-items: center;
  justify-content: space-between;
}
.shogi-game .shogi-reference-dex__analysis-head h3 {
  margin: 0 auto 0 0;
  font-size: 1rem;
}
.shogi-game .shogi-dex .shogi-reference-dex__analysis button {
  min-height: 2.2rem;
  padding: 0.25rem 0.85rem;
  border: 1px solid #f1a54c;
  border-radius: 999px;
  color: #172632;
  background: #f1a54c;
  font: 700 0.85rem/1.2 inherit;
  font-family: inherit;
  cursor: pointer;
}
.shogi-game .shogi-dex .shogi-reference-dex__analysis button:disabled {
  cursor: default;
  opacity: 0.55;
}
.shogi-game .shogi-dex .shogi-reference-dex__analysis button.shogi-reference-dex__arrow-toggle {
  color: #fffcf4;
  background: transparent;
  border-color: rgba(255, 252, 244, 0.5);
}
.shogi-game .shogi-dex .shogi-reference-dex__analysis button.shogi-reference-dex__arrow-toggle[aria-pressed="true"] {
  color: #172632;
  background: #f1a54c;
  border-color: #f1a54c;
}
.shogi-game .shogi-reference-dex__analysis-note {
  margin: 0;
  font-size: 0.85rem;
  opacity: 0.85;
}
.shogi-game .shogi-reference-dex__graph .evaluation-graph__svg {
  height: 8rem;
}
/* グラフの下の手数と評価値は、暗い背景の上で読める色にする。 */
.shogi-game .shogi-reference-dex__graph .evaluation-graph__selection {
  color: #fffcf4;
}
.shogi-game .shogi-reference-dex__graph .evaluation-graph__selection span {
  color: #f1a54c;
}
/* 凡例の記号は色付きの文字なので、グラフと同じ明るい地の上に置く。 */
.shogi-game .shogi-reference-dex__graph .evaluation-graph__legend {
  overflow-x: auto;
  background: #fffcf4;
}
.shogi-game .shogi-reference-dex__analysis-detail {
  display: grid;
  gap: 0.3rem;
  margin: 0;
  font-size: 0.9rem;
}
.shogi-game .shogi-reference-dex__analysis-detail div {
  display: grid;
  grid-template-columns: 4.2rem minmax(0, 1fr);
  gap: 0.4rem;
}
.shogi-game .shogi-reference-dex__analysis-detail dt {
  color: #f1a54c;
  font-weight: 700;
}
.shogi-game .shogi-reference-dex__analysis-detail dd {
  margin: 0;
  overflow-wrap: anywhere;
}
.shogi-game .shogi-reference-dex__annotation {
  display: inline-block;
  margin-left: 0.3rem;
  padding: 0 0.4rem;
  border-radius: 0.25rem;
  color: #172632;
  font-size: 0.8rem;
  font-weight: 700;
}
.shogi-game .shogi-reference-dex__annotation--brilliant { background: #e9a6e9; }
.shogi-game .shogi-reference-dex__annotation--good { background: #6ee7b7; }
.shogi-game .shogi-reference-dex__annotation--dubious { background: #fff38a; }
.shogi-game .shogi-reference-dex__annotation--mistake { background: #f6c560; }
.shogi-game .shogi-reference-dex__annotation--blunder { background: #ff8a5c; }
.shogi-game .shogi-reference-dex__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.9rem;
  margin: 0.5rem 0 0;
  padding: 0;
  list-style: none;
  font-size: 0.8rem;
}
.shogi-game .shogi-reference-dex__legend li {
  display: flex;
  gap: 0.35rem;
  align-items: center;
}
.shogi-game .shogi-reference-dex__swatch {
  display: inline-block;
  width: 0.95rem;
  height: 0.95rem;
  border-radius: 0.2rem;
}
.shogi-game .shogi-reference-dex__swatch--reach {
  background: radial-gradient(circle, rgba(29, 78, 216, 0.95) 0 30%, transparent 34%), rgba(96, 165, 250, 0.35);
}
.shogi-game .shogi-reference-dex__swatch--target { background: rgba(220, 38, 38, 0.6); }
.shogi-game .shogi-reference-dex__swatch--key {
  background: rgba(68, 204, 68, 0.65);
  box-shadow: inset 0 0 0 2px rgba(34, 153, 34, 0.9);
}
.shogi-game .shogi-reference-dex__tiers {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0 0.4rem;
}
.shogi-game .shogi-reference-dex__tiers caption {
  margin-bottom: 0.2rem;
  font-size: 0.8rem;
  text-align: left;
  opacity: 0.85;
}
.shogi-game .shogi-reference-dex__tier {
  width: 3.4rem;
  border-radius: 0.35rem 0 0 0.35rem;
  color: #14212e;
  font-size: 1.25rem;
  font-weight: 800;
  text-align: center;
}
.shogi-game .shogi-reference-dex__tier--top { background: #f6d365; }
.shogi-game .shogi-reference-dex__tier--s { background: #f28b82; }
.shogi-game .shogi-reference-dex__tier--a { background: #f7b267; }
.shogi-game .shogi-reference-dex__tier--b { background: #fde68a; }
.shogi-game .shogi-reference-dex__tier--c { background: #a7f3d0; }
.shogi-game .shogi-reference-dex__tier--d { background: #bfdbfe; }
.shogi-game .shogi-reference-dex__tiers td {
  padding: 0.35rem;
  border-radius: 0 0.35rem 0.35rem 0;
  background: rgba(255, 252, 244, 0.08);
}
.shogi-game .shogi-reference-dex__tiers ul {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.shogi-game .shogi-reference-dex__tier-piece {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  padding: 0.25rem 0.5rem 0.25rem 0.3rem;
  border: 1px solid rgba(241, 165, 76, 0.55);
  border-radius: 0.3rem;
  background: rgba(255, 252, 244, 0.92);
}
.shogi-game .shogi-reference-dex__piece-images {
  position: relative;
  z-index: 1;
  display: inline-flex;
  flex: none;
  gap: 0.1rem;
}
.shogi-game .shogi-reference-dex__piece-images img {
  display: block;
  width: 2.3rem;
  height: 2.5rem;
  object-fit: contain;
  user-select: none;
}
/* 駒画像そのものを押せるようにし、共通のボタン装飾は外す。 */
.shogi-game button.shogi-reference-dex__piece-link {
  min-height: 0;
  padding: 0;
  border: 0;
  border-radius: 0.25rem;
  background: transparent;
  box-shadow: none;
}
@media (hover: hover) {
  .shogi-game button.shogi-reference-dex__piece-link:not(:disabled):hover {
    background: rgba(241, 165, 76, 0.28);
    transform: translateY(-1px);
  }
}
.shogi-game button.shogi-reference-dex__piece-link:active {
  background: rgba(241, 165, 76, 0.4);
}
.shogi-game .shogi-dex button.shogi-reference-dex__return {
  align-self: flex-start;
  min-height: 2.4rem;
  padding: 0.3rem 0.9rem;
  border-radius: 999px;
  font-size: 0.85rem;
}
.shogi-game .shogi-reference-dex__ai {
  margin-top: 0.9rem;
}
.shogi-game .shogi-reference-dex__ai h3 {
  margin: 0 0 0.2rem;
  font-size: 1rem;
}
.shogi-game .shogi-reference-dex__ai p {
  margin: 0 0 0.45rem;
  font-size: 0.8rem;
  opacity: 0.85;
}
.shogi-game .shogi-reference-dex__ai ol {
  display: grid;
  gap: 0.3rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.shogi-game .shogi-reference-dex__ai li {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 0.5rem;
  align-items: center;
  overflow: hidden;
  padding: 0.2rem 0.55rem 0.2rem 0.3rem;
  border-radius: 0.3rem;
  background: rgba(255, 252, 244, 0.92);
  color: #14212e;
}
.shogi-game .shogi-reference-dex__ai li .shogi-reference-dex__piece-images img {
  width: 1.9rem;
  height: 2.05rem;
}
.shogi-game .shogi-reference-dex__ai-bar {
  position: absolute;
  inset: 0 auto 0 0;
  background: rgba(241, 165, 76, 0.4);
}
.shogi-game .shogi-reference-dex__ai li strong,
.shogi-game .shogi-reference-dex__ai li small {
  position: relative;
  z-index: 1;
}
.shogi-game .shogi-reference-dex__ai li strong {
  font-size: 1.05rem;
}
.shogi-game .shogi-reference-dex__ai li small {
  min-width: 3.6rem;
  text-align: right;
  opacity: 0.75;
}
.shogi-game .shogi-reference-dex__points {
  color: #c2410c;
  font-size: 1.15rem;
  font-weight: 800;
  text-align: right;
}
.shogi-game .shogi-reference-dex__points small {
  margin-left: 0.1rem;
  font-size: 0.7rem;
}
</style>
