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
        <!-- 用語辞典は項目が多いため、見出しと解説から検索できるようにする。 -->
        <div v-if="searchable" class="shogi-reference-dex__search">
          <input
            v-model="searchQuery"
            type="search"
            placeholder="用語を探す（例: つめろ）"
            aria-label="用語を探す"
            enterkeyhint="search"
          >
          <p v-if="!groups.length" class="shogi-reference-dex__search-empty">見つからなかったよ。</p>
        </div>
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
            <span v-if="(kind === 'tesuji' || kind === 'glossary') && sideToMove === 'white'" class="shogi-dex__side-note">後手番の局面</span>
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
                @click="stepBy(-1)"
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
                    :last-move="boardLastMove"
                    :allow-move="Boolean(kifu) || tsumePlayable"
                    :enable-drag-and-drop="false"
                    :mobile="isNarrow"
                    :layout="isNarrow ? 'portrait' : 'standard'"
                    :asset-base-url="assetBaseUrl"
                    :candidates="boardArrows"
                    :mark-squares="kifu ? [] : tsumeProblem ? tsumeMarks : marks"
                    @usi-move="onBoardMove"
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
                :disabled="stepIndex >= lineEnd"
                @click="stepBy(1)"
              >▶</button>
            </div>
          </template>
          <!-- 詰将棋の名作は、盤で実際に解ける。玉方の手は正解手順から自動で指す。 -->
          <section v-if="tsumeProblem && tsumeState" class="shogi-reference-dex__tsume" aria-labelledby="shogi-reference-dex-tsume-title">
            <h3 id="shogi-reference-dex-tsume-title">『将棋図巧』を解いてみよう</h3>
            <div class="shogi-reference-dex__tsume-picker" role="group" aria-label="問題を選ぶ">
              <button
                v-for="problem in tsumeProblems"
                :key="problem.id"
                type="button"
                :aria-pressed="problem.id === tsumeProblem.id"
                @click="selectTsume(problem.id)"
              >{{ problem.title }}</button>
            </div>
            <div class="shogi-reference-dex__kifu-comment" aria-live="polite">
              <img
                :src="`${assetBaseUrl}/characters/yakobihime-mini.webp?v=2`"
                alt=""
                aria-hidden="true"
              >
              <p :class="`shogi-reference-dex__tsume-message--${tsumeTone}`">{{ tsumeMessage }}</p>
            </div>
            <div class="shogi-dex__controls">
              <button type="button" :disabled="tsumeState.step === 0 && !tsumeState.solved" @click="resetTsume">最初から</button>
              <span class="shogi-dex__step-count">{{ tsumeState.solved ? tsumeProblem.plies : tsumeState.step * 2 }}/{{ tsumeProblem.plies }}手</span>
              <button type="button" :disabled="tsumeState.solved || tsumeHintShown" @click="showTsumeHint">ヒント</button>
              <button type="button" :aria-expanded="tsumeAnswerOpen" @click="tsumeAnswerOpen = !tsumeAnswerOpen">
                {{ tsumeAnswerOpen ? "答えを隠す" : "答えを見る" }}
              </button>
            </div>
            <ol v-if="tsumeAnswerOpen" class="shogi-reference-dex__tsume-answer">
              <li v-for="(label, index) in tsumeAnswer" :key="index"><small>{{ index + 1 }}</small>{{ label }}</li>
            </ol>
          </section>
          <template v-if="kifu">
            <div v-if="!isNarrow" class="shogi-dex__controls">
              <button type="button" :disabled="stepIndex === 0 && onMainLine" @click="goToPly(0)">最初へ</button>
              <button type="button" :disabled="stepIndex === 0" @click="stepBy(-1)">◀ 戻る</button>
              <span class="shogi-dex__step-count">{{ onMainLine ? `${stepIndex}/${lastStep}手目` : `分岐 ${stepIndex}手目` }}</span>
              <button type="button" :disabled="stepIndex >= lineEnd" @click="stepBy(1)">進む ▶</button>
              <button type="button" :disabled="stepIndex >= lineEnd" @click="goToLineEnd">最後へ</button>
            </div>
            <!-- 盤で本筋と違う手を指すと分岐になる。分岐中は、本筋へ戻るボタンを出す。 -->
            <div v-if="nav.branch" class="shogi-reference-dex__branch-bar">
              <span>{{ (branchStart ?? 0) + 1 }}手目から分岐中</span>
              <button type="button" @click="returnToMainLine">本筋に戻る</button>
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
              :aria-current="onMainLine && stepIndex === item.ply ? 'step' : undefined"
              @click="goToPly(item.ply)"
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
              <template v-else>
                <!-- 解析レベルは解析を始める前に選ぶ。深いレベルで読み直すときは、前の読みを残して書き足す。 -->
                <select v-model.number="chosenLevel" class="shogi-reference-dex__level-select" aria-label="解析レベル">
                  <option v-for="(level, index) in KIFU_ANALYSIS_LEVELS" :key="level.label" :value="index">
                    {{ index + 1 }}. {{ level.label }}
                  </option>
                </select>
                <button
                  type="button"
                  class="shogi-reference-dex__analysis-start"
                  :disabled="chosenLevel <= analysisLevel"
                  @click="startAnalysis(chosenLevel)"
                >{{ analysisButtonLabel }}</button>
              </template>
            </div>
            <!-- 解析の進み具合。全体を確認→怪しい手を読み直し→大事な局面を深読みの段階ごとに出す。 -->
            <p v-if="analysisRunning" class="shogi-reference-dex__analysis-note" aria-live="polite">
              {{ levelLabel(runningLevel) }}で解析中
              <template v-if="analysisStage">
                <br>{{ ANALYSIS_STAGE_LABELS[analysisStage as keyof typeof ANALYSIS_STAGE_LABELS] }} {{ analysisProgress }}/{{ analysisTotal }}局面
              </template>
            </p>
            <p v-else-if="analysisLevel >= 0" class="shogi-reference-dex__analysis-note">
              解析レベル：{{ levelLabel(analysisLevel) }}（1局面あたり{{ formatNodeCount(levelNodes(analysisLevel)) }}局面を読む）
            </p>
            <p v-if="analysisError" class="shogi-reference-dex__analysis-note" role="alert">{{ analysisError }}</p>
            <!-- 分岐の局面の候補手。読み筋は盤に並べて、1手ずつ進められる。 -->
            <div v-if="branchPosition" class="shogi-reference-dex__branch" aria-live="polite">
              <h4>分岐の局面のAIの候補手</h4>
              <p v-if="!branchCandidateRows.length" class="shogi-reference-dex__analysis-note">
                {{ positionAnalysis?.error || (analysisRunning ? "全体の解析が終わったら読むよ。" : "AIが読んでいるよ…") }}
              </p>
              <ol v-else>
                <li v-for="row in branchCandidateRows" :key="row.rank">
                  <strong>{{ row.move }}</strong>
                  <span class="shogi-reference-dex__branch-score">{{ row.score }}</span>
                  <small>{{ row.line }}</small>
                  <button type="button" class="shogi-reference-dex__line-button" @click="previewLine(row.pv)">盤に並べる</button>
                </li>
              </ol>
            </div>
            <!-- 投了の理由。投了図を深く読み、詰み筋や形勢の差を説明する。 -->
            <div v-if="atResignation && analysisEngine.searchPosition" class="shogi-reference-dex__resign" aria-live="polite">
              <h4>投了の理由</h4>
              <template v-if="resignation?.explanation">
                <p>{{ resignation.explanation.text }}</p>
                <p v-if="resignation.explanation.pvLabel" class="shogi-reference-dex__resign-line">
                  読み筋：{{ resignation.explanation.pvLabel }}
                  <button type="button" class="shogi-reference-dex__line-button" @click="previewLine(resignation.explanation.pv)">手順を盤に並べる</button>
                </p>
              </template>
              <p v-else-if="resignation?.error" class="shogi-reference-dex__analysis-note" role="alert">{{ resignation.error }}</p>
              <button
                v-else
                type="button"
                class="shogi-reference-dex__analysis-start"
                :disabled="resignation?.loading || analysisRunning"
                @click="explainCurrentResignation"
              >{{ resignation?.loading ? "AIが投了図を読んでいるよ…" : "投了の理由をAIに聞く" }}</button>
            </div>
            <template v-if="analysisPoints.length">
              <div class="shogi-reference-dex__graph">
                <EvaluationGraph
                  :points="analysisPoints"
                  :current-ply="onMainLine ? stepIndex : branchStart ?? stepIndex"
                  :total-ply="lastStep"
                  @select="goToPly($event)"
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
                  <dd>
                    {{ pvLabel }}
                    <button type="button" class="shogi-reference-dex__line-button" @click="previewLine(currentPoint.pv)">盤に並べる</button>
                  </dd>
                </div>
              </dl>
              <p v-else-if="onMainLine" class="shogi-reference-dex__analysis-note">この局面はまだ解析していないよ。</p>
            </template>
            <p v-else-if="!analysisRunning" class="shogi-reference-dex__analysis-note">
              評価値のグラフと、局面ごとの最善手・読み筋が見られるよ。盤の駒を動かすと「こう指したら？」も試せるよ。
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
            <nav v-if="relatedEntries.length" class="shogi-reference-dex__related" aria-label="関連する用語">
              <span class="shogi-reference-dex__related-label">関連する用語</span>
              <button
                v-for="item in relatedEntries"
                :key="item.id"
                type="button"
                @click="jumpToEntry(item.id)"
              >{{ item.label }}</button>
            </nav>
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
import { formatAnalysisScore, scoreForBlack } from "./core/kifu-analysis.mjs";
import { appendUsiMove, createGameRecord } from "./game-state";
import {
  appendReviewMove,
  createReviewNavigation,
  isOnReviewMainLine,
  moveReviewCursor,
  previewReviewLine,
  returnReviewToMainLine,
  reviewBranchStart,
  visibleReviewMoves,
} from "./core/review-navigation.mjs";
import { explainResignation, resignationSearchSettings } from "./core/resignation-explanation.mjs";
import {
  KIFU_ANALYSIS_LEVELS,
  analysisComment,
  analysisHighlights,
  findTurningPoint,
  formatAnalysisMove,
  formatNodeCount,
  formatPrincipalVariation,
  kifuAnalysisBudget,
  loadAnalysisLevel,
  positionAnalysisBudget,
  saveAnalysisLevel,
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
import { judgeProblemMove, lineSfens, problemHint, problemQuestion } from "./core/problem-set.mjs";
import { formatHintMove } from "./core/match-assists.mjs";

type ReferenceDexKind = "piece" | "tesuji" | "world" | "glossary";
type TierRow = { tier: string; pieces: { label: string; images: string[]; points: number | string }[] };
type AiTable = { title: string; note: string; pieces: { label: string; images: string[]; value: number }[] };
type TsumeProblem = { id: string; number: number; title: string; sfen: string; line: readonly string[]; plies: number };
/** stepは攻め方が正解した回数。sfenはその局面。 */
type TsumeState = { sfen: string; step: number; solved: boolean; lastMove: string };
type SquareMark = { file: number; rank: number; tone: "reach" | "target" | "key" };
type ReferenceEntry = {
  id: string;
  tsume?: { problem: TsumeProblem; note: string }[];
  label: string;
  table?: TierRow[];
  aiTable?: AiTable;
  overview: string;
  rows: [string, string][];
  arrows?: string[];
  kifu?: string;
  kifuTitle?: string;
  flip?: boolean;
  related?: string[];
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
  /** 1局面だけ読む。分岐させた局面や投了図の解析に使う。 */
  searchPosition?(options: { sfen: string; nodes: number; maxTimeMs: number; multiPv: number }): Promise<{ candidates?: Candidate[] }>;
  stop(): void;
};
type Candidate = { rank: number; move: string; pv?: string[]; score?: { type: "cp" | "mate"; value: number } };
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
// 用語辞典だけ、一覧を検索で絞り込める。
const searchable = computed(() => props.kind === "glossary");
const searchQuery = ref("");
watch(() => props.kind, () => { searchQuery.value = ""; });
const groups = computed(() => referenceDexGroups(props.kind, searchable.value ? searchQuery.value : ""));
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
/*
 * 棋譜の並べ方は対局後の振り返りと同じ。盤で本筋と違う手を指すと分岐になり、「こう指したらどうなったか」を試せる。
 * 本筋の局面では棋譜の解説と全局面の解析を、分岐の局面ではその場で読んだ候補手を出す。
 */
const mainMoves = computed(() => (kifu.value?.steps ?? []).slice(1).map(({ lastMove }) => lastMove));
const startNavigation = () => ({ ...createReviewNavigation(mainMoves.value), cursor: 0 });
const nav = ref(startNavigation());
const stepIndex = computed(() => nav.value.cursor);
const lineEnd = computed(() => nav.value.line.length);
const lastStep = computed(() => Math.max(0, (kifu.value?.steps.length ?? 1) - 1));
const onMainLine = computed(() => isOnReviewMainLine(nav.value));
const branchStart = computed(() => reviewBranchStart(nav.value));
const currentStep = computed(() => (
  onMainLine.value ? kifu.value?.steps[Math.min(stepIndex.value, lastStep.value)] ?? null : null
));
/** 分岐の局面。本筋の上ではnull。 */
const branchPosition = computed(() => {
  const steps = kifu.value?.steps;
  if (onMainLine.value || !steps) return null;
  const record = createGameRecord(steps[0].sfen);
  const moves = visibleReviewMoves(nav.value);
  let before = record.position.sfen;
  for (const move of moves) {
    before = record.position.sfen;
    if (!appendUsiMove(record, move)) break;
  }
  const lastMove = moves.at(-1) ?? "";
  let label = lastMove;
  try {
    label = formatAnalysisMove(lastMove, before);
  } catch { /* 表記できない手はUSIのまま出す */ }
  return { sfen: record.position.sfen, lastMove, label };
});
const boardSfen = computed(() => (
  branchPosition.value?.sfen ?? currentStep.value?.sfen ?? tsumeState.value?.sfen ?? sfen.value
));
const boardLastMove = computed(() => (
  branchPosition.value?.lastMove ?? currentStep.value?.lastMove ?? tsumeState.value?.lastMove ?? ""
));
/** 本筋のply手目へ移る。分岐していたら本筋に戻す。 */
function goToPly(ply: number) {
  const main = returnReviewToMainLine(nav.value);
  nav.value = { ...main, cursor: Math.max(0, Math.min(main.line.length, Math.trunc(ply))) };
}
/** 今の並び(本筋か分岐)の上で、前後へ動く。 */
function stepBy(delta: number) {
  nav.value = moveReviewCursor(nav.value, delta);
}
function goToLineEnd() {
  nav.value = { ...nav.value, cursor: nav.value.line.length };
}
/** 盤で指した手。詰将棋なら解答として判定する。棋譜では、本筋と同じなら進み、違えば分岐する。 */
function onBoardMove(usi: string) {
  if (tsumeProblem.value) {
    playTsumeMove(usi);
    return;
  }
  nav.value = appendReviewMove(nav.value, usi);
}

/*
 * 詰将棋。攻め方の手が正解手順と同じなら、玉方の応手を自動で指す。違う手は指させず、局面をそのまま保つ。
 * ヒントは1回目で動かす先のマス、2回目で正解の矢印を出す。
 */
const tsumeEntries = computed(() => selectedEntry.value?.tsume ?? []);
const tsumeProblems = computed(() => tsumeEntries.value.map(({ problem }) => problem));
const tsumeId = ref("");
const tsumeProblem = computed(() => (
  tsumeProblems.value.find(({ id }) => id === tsumeId.value) ?? tsumeProblems.value[0] ?? null
));
const tsumeState = ref<TsumeState | null>(null);
const tsumeHintShown = ref(false);
const tsumeAnswerOpen = ref(false);
const tsumeMessage = ref("");
const tsumeTone = ref<"info" | "good" | "bad">("info");
const tsumePlayable = computed(() => Boolean(tsumeProblem.value && tsumeState.value && !tsumeState.value.solved));
/** 作者の手順を「▲4五角打」「△4五桂」のように、先手・後手の印を付けて並べる。 */
const tsumeAnswer = computed(() => {
  const problem = tsumeProblem.value;
  if (!problem) return [];
  const sfens = lineSfens(problem.sfen, [...problem.line]);
  return problem.line.map((usi, index) => `${index % 2 === 0 ? "▲" : "△"}${formatHintMove(usi, sfens[index])}`);
});
const tsumeHintView = computed(() => (
  tsumeProblem.value && tsumeState.value && tsumePlayable.value && tsumeHintShown.value
    ? problemHint(tsumeProblem.value, tsumeState.value.sfen, tsumeState.value.step)
    : null
));
const tsumeMarks = computed((): SquareMark[] => {
  const square = tsumeHintView.value?.square;
  return square ? [{ file: Number(square[0]), rank: square.charCodeAt(1) - 96, tone: "key" }] : [];
});
function resetTsume() {
  const problem = tsumeProblem.value;
  tsumeState.value = problem ? { sfen: problem.sfen, step: 0, solved: false, lastMove: "" } : null;
  tsumeHintShown.value = false;
  tsumeAnswerOpen.value = false;
  const note = tsumeEntries.value.find((entry) => entry.problem === problem)?.note ?? "";
  tsumeMessage.value = problem ? `${problemQuestion(problem)}${note ? ` ${note}` : ""} 後手の手は自動で指されるよ。` : "";
  tsumeTone.value = "info";
}
function selectTsume(id: string) {
  tsumeId.value = id;
  resetTsume();
}
watch(selectedId, () => {
  tsumeId.value = "";
  resetTsume();
}, { immediate: true });
function showTsumeHint() {
  tsumeHintShown.value = true;
  const hint = tsumeHintView.value;
  if (!hint) return;
  tsumeMessage.value = hint.text;
  tsumeTone.value = "info";
}
/** 判定は将棋問題集と同じ。作者の手順どおりなら玉方の応手を自動で指し、違う手は指させずに局面を保つ。 */
function playTsumeMove(usi: string) {
  const problem = tsumeProblem.value;
  const state = tsumeState.value;
  if (!problem || !state || state.solved) return;
  const result = judgeProblemMove(problem, usi, state.sfen, state.step);
  tsumeMessage.value = result.speech;
  if (!result.correct) {
    tsumeTone.value = "bad";
    return;
  }
  tsumeHintShown.value = false;
  tsumeTone.value = result.solved ? "good" : "info";
  tsumeState.value = result.next
    ? { sfen: result.next.sfen, step: result.next.step, solved: false, lastMove: result.line.at(-1) ?? usi }
    : { sfen: lineSfens(state.sfen, result.line).at(-1) ?? state.sfen, step: state.step, solved: true, lastMove: usi };
}
/** 分岐を消して、分岐が始まった本筋の局面へ戻る。 */
function returnToMainLine() {
  goToPly(branchStart.value ?? stepIndex.value);
}
/** 読み筋を分岐として盤に並べ、1手目まで進める。▶で1手ずつ進められる。 */
function previewLine(moves: string[] | undefined) {
  if (!moves?.length) return;
  nav.value = previewReviewLine(nav.value, moves);
}
watch(selectedId, () => {
  nav.value = startNavigation();
  resignation.value = null;
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
// 解析を始める前に選ぶレベル。前回選んだレベルを覚えておく(対局後の振り返りと共通)。
const chosenLevel = ref(loadAnalysisLevel());
watch(chosenLevel, (level) => saveAnalysisLevel(level));
const analysisButtonLabel = computed(() => {
  if (analysisLevel.value < 0) return "将棋AIで解析";
  if (chosenLevel.value <= analysisLevel.value) return "解析済み";
  return "このレベルで読み直す";
});
const currentPoint = computed(() => (
  onMainLine.value ? analysisPoints.value.find(({ ply }) => ply === stepIndex.value) ?? null : null
));
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
  if (branchPosition.value) return branchComment.value;
  if (atResignation.value && resignation.value?.explanation) return resignation.value.explanation.text;
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
  const score = branchPosition.value ? branchScore.value : currentPoint.value?.score;
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
  if (branchPosition.value) return `分岐 ${stepIndex.value}手目 ${branchPosition.value.label}`;
  const step = currentStep.value;
  if (!step || stepIndex.value === 0) return "開始局面";
  const from = /^([1-9])([a-i])/.exec(step.lastMove);
  const origin = from ? `(${from[1]}${from[2].charCodeAt(0) - 96})` : "";
  const ending = stepIndex.value === lastStep.value && kifu.value?.ending ? `　まで、${kifu.value.ending}` : "";
  return `${stepIndex.value}手目 ${step.label}${origin}${ending}`;
});
const boardArrows = computed(() => {
  if (tsumeProblem.value) return [];
  if (!kifu.value) return arrows.value;
  const best = branchPosition.value ? branchBest.value?.move : currentPoint.value?.bestMove;
  return showBestArrow.value && best ? [{ usi: best, guideKind: "ai" as const }] : [];
});

/*
 * 分岐の局面は、動かすたびにその場でAIに読ませる。続けて指したときは前の読みを止め、最後の局面だけを読む。
 * 全局面の解析中は、解析が終わるまで待たせないよう読まない。
 */
const positionAnalysis = ref<{ sfen: string; loading: boolean; candidates: Candidate[]; error: string } | null>(null);
let positionGeneration = 0;
let positionTimer: ReturnType<typeof setTimeout> | null = null;
async function analyzeBranchPosition(target: string) {
  const engine = props.analysisEngine;
  if (!engine?.searchPosition || analysisRunning.value) return;
  const generation = ++positionGeneration;
  positionAnalysis.value = { sfen: target, loading: true, candidates: [], error: "" };
  try {
    const result = await engine.searchPosition({ sfen: target, ...positionAnalysisBudget(mobileLayout()) });
    if (generation !== positionGeneration) return;
    positionAnalysis.value = { sfen: target, loading: false, candidates: result.candidates ?? [], error: "" };
  } catch (error) {
    if (generation !== positionGeneration) return;
    positionAnalysis.value = { sfen: target, loading: false, candidates: [], error: error instanceof Error ? error.message : String(error) };
  }
}
watch(() => branchPosition.value?.sfen ?? "", (target) => {
  if (positionTimer) clearTimeout(positionTimer);
  positionGeneration += 1;
  if (positionAnalysis.value?.loading) props.analysisEngine?.stop();
  positionAnalysis.value = null;
  if (!target) return;
  positionTimer = setTimeout(() => analyzeBranchPosition(target), 350);
});
onBeforeUnmount(() => { if (positionTimer) clearTimeout(positionTimer); });
const branchCandidates = computed(() => (
  positionAnalysis.value?.sfen === branchPosition.value?.sfen ? positionAnalysis.value?.candidates ?? [] : []
));
const branchBest = computed(() => branchCandidates.value.find(({ rank }) => rank === 1) ?? null);
const branchSide = computed(() => (branchPosition.value?.sfen.split(" ")[1] === "w" ? "white" : "black"));
const branchScore = computed(() => scoreForBlack(branchBest.value?.score, branchSide.value));
/** 分岐の候補手を、手・評価値(先手から見た値)・読み筋の表記にする。 */
const branchCandidateRows = computed(() => {
  const position = branchPosition.value;
  if (!position) return [];
  return [...branchCandidates.value].sort((left, right) => left.rank - right.rank).map((candidate) => {
    let move = candidate.move;
    let line = "";
    try {
      move = formatAnalysisMove(candidate.move, position.sfen);
      line = formatPrincipalVariation(candidate.pv ?? [candidate.move], position.sfen);
    } catch { /* 表記できない手はUSIのまま出す */ }
    return {
      rank: candidate.rank,
      move,
      line,
      pv: candidate.pv?.length ? candidate.pv : [candidate.move],
      score: formatAnalysisScore(scoreForBlack(candidate.score, branchSide.value)),
    };
  });
});
const branchComment = computed(() => {
  if (!branchPosition.value) return "";
  const analysis = positionAnalysis.value;
  const start = branchStart.value ?? 0;
  const lead = `${start + 1}手目から分岐した局面だよ。`;
  if (!props.analysisEngine?.searchPosition) return `${lead}盤の駒を動かして、いろいろ試してみてね。`;
  if (analysisRunning.value) return `${lead}全体の解析が終わったら、この局面もAIが読むよ。`;
  if (!analysis || analysis.loading) return `${lead}AIがこの局面を読んでいるよ…`;
  if (analysis.error) return `${lead}AIの読みに失敗したよ：${analysis.error}`;
  const best = branchCandidateRows.value[0];
  if (!best) return `${lead}この局面では指せる手がないみたい。`;
  const side = branchSide.value === "black" ? "先手" : "後手";
  return `${lead}AIの読みでは、ここで${side}は${best.move}が一番（${best.score}）。読み筋は ${best.line} だよ。`;
});

/*
 * 投了の理由。最後の局面が投了なら、その局面を深く読み、詰みがあるか・形勢の差がどれだけあるかを話す。
 * 読み筋は「手順を盤に並べる」で分岐として並べられる。
 */
const atResignation = computed(() => (
  onMainLine.value && Boolean(kifu.value) && kifu.value?.ending === "投了" && stepIndex.value === lastStep.value
));
const resignation = ref<{ loading: boolean; error: string; explanation: ReturnType<typeof explainResignation> } | null>(null);
async function explainCurrentResignation() {
  const engine = props.analysisEngine;
  const final = kifu.value?.steps.at(-1);
  const winner = kifu.value?.winner;
  if (!engine?.searchPosition || !final || !winner || resignation.value?.loading) return;
  const entryId = selectedId.value;
  resignation.value = { loading: true, error: "", explanation: null };
  try {
    const result = await engine.searchPosition({ sfen: final.sfen, ...resignationSearchSettings(mobileLayout()) });
    if (selectedId.value !== entryId) return;
    resignation.value = {
      loading: false,
      error: "",
      explanation: explainResignation({
        sfen: final.sfen,
        candidates: result.candidates ?? [],
        loser: winner === "black" ? "white" : "black",
        names: { black: kifu.value?.black, white: kifu.value?.white },
      }),
    };
  } catch (error) {
    if (selectedId.value !== entryId) return;
    resignation.value = { loading: false, error: error instanceof Error ? error.message : String(error), explanation: null };
  }
}

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
  const deeper = analysisLevel.value >= 0 && level > analysisLevel.value;
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

// 表の駒や関連する用語から別の項目へ飛んだとき、元の項目とスクロール位置を覚えておき、ワンタップで戻れるようにする。
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
/** 今の項目とスクロール位置を覚えてから、別の項目を開く。 */
function jumpToEntry(id: string) {
  returnPoint.value = {
    id: selectedId.value,
    scroll: [bodyEl.value?.scrollTop ?? 0, detailEl.value?.scrollTop ?? 0],
  };
  selectedId.value = id;
  setScroll([0, 0]);
}
function openPieceEntry(image: string) {
  const id = referencePieceImageEntryId(image);
  if (id) jumpToEntry(id);
}
// 用語辞典の関連する用語へ移るときも、元の項目へワンタップで戻れるようにする。
const relatedEntries = computed(() => (selectedEntry.value?.related ?? [])
  .map((id) => entries.value.find((entry) => entry.id === id))
  .filter((entry): entry is ReferenceEntry => Boolean(entry)));
function returnToTable() {
  const point = returnPoint.value;
  if (!point) return false;
  returnPoint.value = null;
  selectedId.value = point.id;
  setScroll(point.scroll);
  return true;
}
// ブラウザの戻るでは、飛ぶ前の項目へ戻り、それ以外は図鑑を閉じる。
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
.shogi-game .shogi-reference-dex__tsume {
  display: grid;
  gap: 0.5rem;
}
.shogi-game .shogi-reference-dex__tsume h3 {
  margin: 0;
  color: #f1a54c;
  font-size: 0.9rem;
}
.shogi-game .shogi-reference-dex__tsume-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.shogi-game .shogi-dex .shogi-reference-dex__tsume-picker button {
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
.shogi-game .shogi-dex .shogi-reference-dex__tsume-picker button[aria-pressed="true"] {
  color: #172632;
  background: #f1a54c;
}
.shogi-game .shogi-reference-dex__kifu-comment p.shogi-reference-dex__tsume-message--good {
  border-color: #6fcf8a;
  background: rgba(111, 207, 138, 0.16);
}
.shogi-game .shogi-reference-dex__kifu-comment p.shogi-reference-dex__tsume-message--bad {
  border-color: #e07a6a;
  background: rgba(224, 122, 106, 0.14);
}
.shogi-game .shogi-reference-dex__tsume-answer {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(7.5rem, 1fr));
  gap: 0.2rem 0.8rem;
  margin: 0;
  padding: 0.5rem 0.75rem;
  list-style: none;
  border: 1px solid rgba(255, 252, 244, 0.2);
  border-radius: 0.4rem;
  font-size: var(--dex-text);
}
.shogi-game .shogi-reference-dex__tsume-answer small {
  display: inline-block;
  min-width: 1.6rem;
  opacity: 0.6;
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
.shogi-game .shogi-reference-dex__level-select {
  min-height: 2.2rem;
  padding: 0.2rem 0.5rem;
  border: 1px solid rgba(255, 252, 244, 0.5);
  border-radius: 0.4rem;
  color: #fffcf4;
  background: #172632;
  font: inherit;
  font-size: 0.85rem;
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
/* 分岐中の表示。盤の下の操作の続きに置き、本筋へ戻るボタンを添える。 */
.shogi-game .shogi-reference-dex__branch-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 0.7rem;
  align-items: center;
  justify-content: center;
  margin: 0.35rem 0 0;
  font-size: 0.85rem;
  color: #f1a54c;
  font-weight: 700;
}
.shogi-game .shogi-reference-dex__branch-bar button {
  min-height: 2rem;
  padding: 0.2rem 0.8rem;
  border: 1px solid #f1a54c;
  border-radius: 999px;
  color: #172632;
  background: #f1a54c;
  font: 700 0.85rem/1.2 inherit;
  font-family: inherit;
  cursor: pointer;
}
/* 分岐の候補手と投了の理由。読み筋は折り返し、並べるボタンは小さく添える。 */
.shogi-game .shogi-reference-dex__branch,
.shogi-game .shogi-reference-dex__resign {
  display: grid;
  gap: 0.35rem;
  padding: 0.5rem 0.6rem;
  border-left: 3px solid #f1a54c;
  border-radius: 0.3rem;
  background: rgba(241, 165, 76, 0.08);
}
.shogi-game .shogi-reference-dex__branch h4,
.shogi-game .shogi-reference-dex__resign h4 {
  margin: 0;
  color: #f1a54c;
  font-size: 0.9rem;
}
.shogi-game .shogi-reference-dex__branch ol {
  display: grid;
  gap: 0.35rem;
  margin: 0;
  padding-left: 1.2rem;
  font-size: 0.88rem;
}
.shogi-game .shogi-reference-dex__branch li small {
  display: block;
  opacity: 0.85;
  overflow-wrap: anywhere;
}
.shogi-game .shogi-reference-dex__branch-score {
  margin-left: 0.4rem;
  color: #f1a54c;
  font-variant-numeric: tabular-nums;
}
.shogi-game .shogi-reference-dex__resign p {
  margin: 0;
  font-size: 0.88rem;
  overflow-wrap: anywhere;
}
.shogi-game .shogi-dex .shogi-reference-dex__analysis button.shogi-reference-dex__line-button {
  min-height: 1.7rem;
  margin-left: 0.3rem;
  padding: 0.1rem 0.6rem;
  color: #fffcf4;
  background: transparent;
  border-color: rgba(255, 252, 244, 0.5);
  font-size: 0.78rem;
  vertical-align: middle;
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
.shogi-game .shogi-reference-dex__search {
  margin: 0.3rem 0.3rem 0.2rem;
}
.shogi-game .shogi-dex .shogi-reference-dex__search input {
  box-sizing: border-box;
  width: 100%;
  min-height: 2.3rem;
  padding: 0.3rem 0.7rem;
  border: 1px solid rgba(255, 252, 244, 0.5);
  border-radius: 0.45rem;
  color: #fffcf4;
  background: rgba(255, 252, 244, 0.08);
  /* iOSで入力欄にフォーカスしたとき拡大されないよう、16px以上にする。 */
  font: 500 1rem/1.3 inherit;
  font-family: inherit;
}
.shogi-game .shogi-reference-dex__search input::placeholder {
  color: rgba(255, 252, 244, 0.55);
}
.shogi-game .shogi-reference-dex__search-empty {
  margin: 0.5rem 0.2rem 0;
  font-size: 0.8rem;
  opacity: 0.8;
}
.shogi-game .shogi-reference-dex__related {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
  margin-top: 0.8rem;
  padding-top: 0.6rem;
  border-top: 1px solid rgba(255, 252, 244, 0.2);
}
.shogi-game .shogi-reference-dex__related-label {
  width: 100%;
  color: #f1a54c;
  font-size: 0.8rem;
  font-weight: 700;
}
.shogi-game .shogi-dex .shogi-reference-dex__related button {
  min-height: 2rem;
  padding: 0.2rem 0.7rem;
  border: 1px solid rgba(255, 252, 244, 0.5);
  border-radius: 999px;
  color: #fffcf4;
  background: rgba(255, 252, 244, 0.08);
  font: 600 0.8rem/1.2 inherit;
  font-family: inherit;
  cursor: pointer;
}
.shogi-game .shogi-dex .shogi-reference-dex__related button:hover {
  background: rgba(255, 252, 244, 0.18);
}
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
