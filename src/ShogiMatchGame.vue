<template>
  <section
    class="shogi-game"
    :class="{
      'shogi-game--analysis': reviewMode && analysisOpen,
      'shogi-game--rook-choice': rangingRookChoiceRequired,
    }"
    aria-label="将棋対局"
  >
    <header class="shogi-game__toolbar">
      <button
        type="button"
        class="shogi-game__command"
        :class="reviewMode ? 'shogi-game__command--complete' : 'shogi-game__command--danger'"
        :disabled="!active"
        @click="reviewMode ? completeReview() : resign()"
      >
        {{ reviewMode ? "完了" : "投了" }}
      </button>
      <button type="button" class="shogi-game__command shogi-game__command--settings" @click="toggleSettings">
        設定
      </button>
      <span class="shogi-game__turn">{{ moveCount }}手目</span>
    </header>

    <div
      v-if="pregameOpen"
      class="shogi-game__pregame"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pregame-title"
    >
      <div class="shogi-game__pregame-panel">
        <div class="shogi-game__pregame-heading">
          <span>対局準備</span>
          <h2 id="pregame-title">対局条件を選んでね</h2>
        </div>
        <div class="shogi-game__pregame-grid">
          <label v-if="normalizedMode === 'cpu'" class="shogi-game__pregame-field">
            <span>敵の強さ</span>
            <select v-model.number="searchNodes" aria-label="対局前の敵の強さ">
              <option v-for="preset in CPU_STRENGTH_PRESETS" :key="preset.value" :value="preset.value">
                Lv.{{ preset.level }} {{ preset.label }}
              </option>
            </select>
          </label>
          <div v-if="normalizedMode === 'cpu'" class="shogi-game__pregame-field">
            <span>相手の作戦</span>
            <div class="shogi-game__strategy-setting">
              <select v-if="!cpuStrategyDetailsOpen" v-model="cpuStrategy" aria-label="対局前の相手の作戦">
                <option value="random">おまかせ</option>
                <option value="static">居飛車</option>
                <option value="ranging">振り飛車</option>
                <option value="surprise">奇襲戦法</option>
              </select>
              <div v-else class="shogi-game__strategy-details">
                <label>
                  <span>戦法</span>
                  <select v-model="cpuDetailedStrategy" aria-label="対局前の相手の戦法を指定">
                    <option value="">指定なし</option>
                    <optgroup v-for="group in cpuDetailedStrategyGroups" :key="group.id" :label="group.label">
                      <option v-for="strategy in group.options" :key="strategy.id" :value="strategy.id">
                        {{ strategy.label }}
                      </option>
                    </optgroup>
                  </select>
                </label>
                <label>
                  <span>囲い</span>
                  <select v-model="cpuDetailedCastle" aria-label="対局前の相手の囲いを指定">
                    <option value="">指定なし</option>
                    <optgroup v-for="group in cpuDetailedCastleGroups" :key="group.id" :label="group.label">
                      <option v-for="castle in group.options" :key="castle.id" :value="castle.id">
                        {{ castle.label }}
                      </option>
                    </optgroup>
                  </select>
                </label>
              </div>
              <button type="button" class="shogi-game__strategy-toggle" @click="toggleCpuStrategyDetails">
                {{ cpuStrategyDetailsOpen ? "戻る" : "詳しく設定" }}
              </button>
            </div>
          </div>
          <div v-if="normalizedMode === 'cpu'" class="shogi-game__pregame-field shogi-game__pregame-field--opening-tendency">
            <span>相手の序盤傾向</span>
            <div class="shogi-game__opening-tendency">
              <label>
                <span>角道</span>
                <select v-model="cpuBishopPreference" aria-label="対局前の相手の角道">
                  <option value="">選択しない</option>
                  <option value="open">開けたまま</option>
                  <option value="open-close">開けてから閉じる</option>
                  <option value="exchange">CPUから角交換</option>
                  <option value="invite-exchange">こちらからの角交換を待つ</option>
                  <option value="closed">閉じたまま指す</option>
                </select>
              </label>
              <label>
                <span>飛車</span>
                <select v-model="cpuRookPreference" aria-label="対局前の相手の飛車の方針">
                  <option value="">選択しない</option>
                  <option value="rook-pawn">飛車先を優先</option>
                  <option value="static">居飛車を維持</option>
                  <option value="ranging">振り飛車を目指す</option>
                  <option value="adaptive">相手を見て決める</option>
                </select>
              </label>
              <label>
                <span>指し方</span>
                <select v-model="cpuTempoPreference" aria-label="対局前の相手の序盤の指し方">
                  <option value="">選択しない</option>
                  <option value="balanced">バランス型</option>
                  <option value="aggressive">積極的</option>
                  <option value="patient">じっくり</option>
                  <option value="castle-first">囲い優先</option>
                  <option value="attack-first">攻め優先</option>
                </select>
              </label>
            </div>
            <small>初手を最優先し、その後は角道の具体的な指定を定跡より優先します。</small>
          </div>
          <div
            v-if="normalizedMode === 'cpu'"
            class="shogi-game__pregame-field shogi-game__pregame-field--turn"
          >
            <label class="shogi-game__pregame-control">
              <span>自分の手番</span>
              <select v-model="selectedPlayerColor" aria-label="対局前の自分の手番">
                <option value="black">先手</option>
                <option value="white">後手</option>
              </select>
            </label>
            <label
              v-if="selectedPlayerColor === 'white'"
              class="shogi-game__pregame-control shogi-game__pregame-control--sub"
            >
              <span>相手の初手</span>
              <select v-model="cpuFirstMove" aria-label="対局前の相手の初手">
                <option value="random">おまかせ</option>
                <option value="bishop-diagonal">角道を開ける（7六歩）</option>
                <option value="rook-pawn">飛車先を突く（2六歩）</option>
                <option value="center-pawn">中央の歩を突く（5六歩）</option>
              </select>
            </label>
          </div>
          <label class="shogi-game__pregame-field">
            <span>やこび姫の助言</span>
            <select v-model="coachLevel" aria-label="対局前の助言設定">
              <option value="off">なし</option>
              <option value="encourage">応援のみ</option>
              <option value="detailed">詳しい助言</option>
            </select>
          </label>
        </div>
        <p v-if="normalizedMode === 'cpu'" class="shogi-game__pregame-note">
          {{ engineUnavailable ? "簡易CPUで対局します" : engineReady ? "準備できました" : "対局AIを準備しています…" }}
        </p>
        <button
          type="button"
          class="shogi-game__pregame-start"
          :disabled="normalizedMode === 'cpu' && !engineReady && !engineUnavailable"
          @click="beginMatch"
        >
          {{ normalizedMode === "cpu" && !engineReady && !engineUnavailable ? "準備中…" : "対局開始" }}
        </button>
      </div>
    </div>

    <section class="shogi-game__player-zone shogi-game__player-zone--opponent">
      <div class="shogi-game__match-summary" aria-live="polite">
        <div class="shogi-game__match-summary-status">
          <strong>{{ statusText }}</strong>
          <span>{{ modeText }}・{{ moveCount }}手</span>
        </div>
        <div class="shogi-game__formation-summary">
          <div><b>先手・戦型</b><span>{{ blackFormationText }}</span></div>
          <div><b>後手・戦型</b><span>{{ whiteFormationText }}</span></div>
        </div>
      </div>
      <section class="shogi-game__opening-guide shogi-game__opening-guide--primary" aria-label="やこび姫補助">
        <h2>やこび姫補助</h2>
        <div class="shogi-game__opening-selects">
          <div class="shogi-game__opening-strategy-field">
            <label>
              <span>戦法</span>
              <select v-model="selectedStrategy" aria-label="戦法" @change="announceOpeningGuide">
                <option value="">選択しない</option>
                <optgroup v-for="group in groupedOpeningStrategies" :key="group.id" :label="group.label">
                  <option
                    v-for="strategy in group.options"
                    :key="strategy.id"
                    :value="strategy.id"
                    :disabled="strategy.disabled"
                  >
                    {{ strategy.label }}
                  </option>
                </optgroup>
              </select>
            </label>
            <button
              v-if="selectedStrategyExplanation"
              type="button"
              class="shogi-game__opening-explanation-trigger"
              :aria-label="`${selectedStrategyDefinition?.label}の解説`"
              @click="strategyExplanationOpen = true"
            >解説</button>
          </div>
          <label>
            <span>囲い</span>
            <select v-model="selectedCastle" @change="announceOpeningGuide">
              <option value="">選択しない</option>
              <optgroup v-for="group in groupedOpeningCastles" :key="group.id" :label="group.label">
                <option
                  v-for="castle in group.options"
                  :key="castle.id"
                  :value="castle.id"
                  :disabled="castle.disabled"
                >
                  {{ castle.label }}
                </option>
              </optgroup>
            </select>
          </label>
        </div>
        <div v-if="rangingRookChoiceRequired" class="shogi-game__rook-choice">
          <span>この囲いでは、先に飛車を振る場所を選んでね</span>
          <div>
            <button
              v-for="choice in rangingRookChoices"
              :key="choice.id"
              type="button"
              @click="chooseRangingRookStrategy(choice.id)"
            >{{ choice.label }}</button>
          </div>
        </div>
        <p v-if="openingGuideStatus">{{ openingGuideStatus }}</p>
      </section>
    </section>

    <div v-if="settingsOpen" class="shogi-game__settings">
      <div class="shogi-game__settings-title">対局設定</div>
      <div class="shogi-game__settings-grid">
        <label class="shogi-game__strength">
          <span>やこび姫の助言</span>
          <select v-model="coachLevel" aria-label="対局中の助言">
            <option value="off">なし</option>
            <option value="encourage">応援のみ</option>
            <option value="detailed">詳しい助言</option>
          </select>
        </label>
      </div>
      <div class="shogi-game__settings-actions">
        <button type="button" @click="closeSettings">閉じる</button>
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
          :srcset="coachPortraitUrl"
        >
        <img
          class="shogi-game__character"
          :src="coachPortraitUrl"
          :data-expression="coachExpression"
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
        <button v-if="!reviewMode || reviewCpuEnabled" type="button" :disabled="!canUndo" @click="undoTurn">
          待った ×{{ reviewMode ? "∞" : undosRemaining }}
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
    </section>

    <section class="shogi-game__opening-guide shogi-game__opening-guide--portrait" aria-label="やこび姫補助">
      <h2>やこび姫補助</h2>
      <div class="shogi-game__opening-selects">
        <div class="shogi-game__opening-strategy-field">
          <label>
            <span>戦法</span>
            <select v-model="selectedStrategy" aria-label="戦法" @change="announceOpeningGuide">
              <option value="">選択しない</option>
              <optgroup v-for="group in groupedOpeningStrategies" :key="group.id" :label="group.label">
                <option
                  v-for="strategy in group.options"
                  :key="strategy.id"
                  :value="strategy.id"
                  :disabled="strategy.disabled"
                >
                  {{ strategy.label }}
                </option>
              </optgroup>
            </select>
          </label>
          <button
            v-if="selectedStrategyExplanation"
            type="button"
            class="shogi-game__opening-explanation-trigger"
            :aria-label="`${selectedStrategyDefinition?.label}の解説`"
            @click="strategyExplanationOpen = true"
          >解説</button>
        </div>
        <label>
          <span>囲い</span>
          <select v-model="selectedCastle" @change="announceOpeningGuide">
            <option value="">選択しない</option>
            <optgroup v-for="group in groupedOpeningCastles" :key="group.id" :label="group.label">
              <option
                v-for="castle in group.options"
                :key="castle.id"
                :value="castle.id"
                :disabled="castle.disabled"
              >
                {{ castle.label }}
              </option>
            </optgroup>
          </select>
        </label>
      </div>
      <div v-if="rangingRookChoiceRequired" class="shogi-game__rook-choice">
        <span>この囲いでは、先に飛車を振る場所を選んでね</span>
        <div>
          <button
            v-for="choice in rangingRookChoices"
            :key="choice.id"
            type="button"
            @click="chooseRangingRookStrategy(choice.id)"
          >{{ choice.label }}</button>
        </div>
      </div>
      <p v-if="openingGuideStatus">{{ openingGuideStatus }}</p>
    </section>

    <div
      v-if="strategyExplanationOpen && selectedStrategyDefinition && selectedStrategyExplanation"
      class="shogi-game__opening-explanation"
      role="dialog"
      aria-modal="true"
      aria-labelledby="opening-explanation-title"
      @click.self="strategyExplanationOpen = false"
    >
      <article class="shogi-game__opening-explanation-panel">
        <small>戦法解説</small>
        <h2 id="opening-explanation-title">{{ selectedStrategyDefinition.label }}</h2>
        <p>{{ selectedStrategyExplanation.overview }}</p>
        <dl>
          <div>
            <dt>狙い</dt>
            <dd>{{ selectedStrategyExplanation.aim }}</dd>
          </div>
          <div>
            <dt>相性の良い囲い</dt>
            <dd>{{ selectedStrategyExplanation.castles }}</dd>
          </div>
          <div>
            <dt>形ができた後</dt>
            <dd>{{ selectedStrategyExplanation.followup }}</dd>
          </div>
          <div>
            <dt>注意点</dt>
            <dd>{{ selectedStrategyExplanation.caution }}</dd>
          </div>
        </dl>
        <button type="button" @click="strategyExplanationOpen = false">閉じる</button>
      </article>
    </div>

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
          <button type="button" class="shogi-game__rematch" @click="openPregame">対局準備</button>
          <button type="button" class="shogi-game__analysis-button" @click="startKifuAnalysis">棋譜解析</button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Color, PieceType, Position, Record, Square, reverseColor } from "tsshogi";
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
import {
  coachAdvicePriority,
  createCoachAdviceScheduler,
} from "./core/coach-advice-scheduler.mjs";
import {
  COACH_EXPRESSION_ASSET_VERSION,
  COACH_EXPRESSION_FILES,
  coachExpressionFilename,
  coachExpressionForText,
} from "./core/coach-expression.mjs";
import { getIdleCoachAdvice, IDLE_COACH_DELAY_MS } from "./core/idle-coach-advice.mjs";
import {
  formatHintMove,
  getHintMoves,
  getHintSearchSettings,
  getIdleCoachSearchSettings,
  getOpeningFollowupSearchSettings,
  getOpeningGuideSafetySearchSettings,
  hintMoveAssessment,
  hintScoreForArrow,
} from "./core/match-assists.mjs";
import { selectMoveByRank } from "./core/move-selection.mjs";
import { detectStrictMateThreat, findMateInOne } from "./core/mate-threat";
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
  rewindReviewMoves,
  returnReviewToMainLine,
  visibleReviewMoves,
} from "./core/review-navigation.mjs";
import {
  availableOpeningDefinitions,
  chooseAdaptiveOpeningMove,
  chooseSafeOpeningMove,
  filterOpeningCompatibleCandidates,
  inferOpeningRookStyle,
  isOpeningGuideExpired,
  isOpeningPlanComplete,
  nextOpeningPlanMove,
  openingCanonicalFollowupCandidates as getOpeningCanonicalFollowupCandidates,
  openingDefinitionRookStyle,
  openingDetourArrowCandidates,
  openingFollowupCount,
  openingGuideScoreLossLimit,
  openingPlanBranchMessage,
  openingPlanInterruption,
  openingPlanCandidates as getOpeningPlanCandidates,
  rangingRookStrategyChoices,
  openingUrgentResponse,
  shouldAbandonOpeningGuide,
  shouldShowOpeningFollowup,
  OPENING_CASTLE_GROUPS,
  OPENING_CASTLES,
  OPENING_STRATEGIES,
} from "./core/opening-guide.mjs";
import {
  CPU_OPENING_STRATEGY_IDS,
  configuredCpuBishopMove,
  configuredCpuFirstMove,
  cpuMoveMatchesBishopPreference,
  selectCpuOpeningRepertoire,
  shouldForceConfiguredCpuOpening,
  shouldUseCpuOpening,
} from "./core/cpu-opening-repertoire.mjs";
import { createPositionAnalysisCache } from "./core/position-analysis-cache.mjs";
import { openingExplanation } from "./core/opening-explanations.mjs";
import { selectMoveSound, type MoveSoundKind } from "./core/move-sound";
import {
  clearMatchSnapshot,
  loadMatchSnapshot,
  matchSnapshotKey,
  saveMatchSnapshot,
} from "./core/match-persistence.mjs";
import hiraganaFormationMaster from "./data/hiragana_suisho_formations.json";

const INITIAL_GUIDE_TEXT = "一緒に頑張ろう！";
const UNDO_GUIDE_TEXT = "もう一度、落ち着いて考えてみよう！";

type MoveSoundTemplates = { [K in MoveSoundKind]: HTMLAudioElement };
let moveSoundTemplates: MoveSoundTemplates | null = null;

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
const active = ref(false);
const matchStarted = ref(false);
const pregameOpen = ref(true);
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
const reviewCpuStartedAtPly = ref(0);
const hintsRemaining = ref(Math.max(0, Math.trunc(props.hintCount)));
const undosRemaining = ref(Math.max(0, Math.trunc(props.undoCount)));
const hintCandidates = ref<{ usi: string; score?: number }[]>([]);
const openingFollowupCandidates = ref<{ usi: string; score?: number }[]>([]);
const openingFollowupRemaining = ref(0);
const openingFollowupStarted = ref(false);
type OpeningGuideDecision = {
  usi: string;
  source: "plan" | "urgent" | "ai";
  phase?: "strategy" | "castle";
  reason?: string;
};
const openingGuideDecision = ref<OpeningGuideDecision | null>(null);
const openingGuideDetourCandidates = ref<{
  usi: string;
  score?: number;
  guideKind: "unsafe-plan" | "ai";
}[]>([]);
const openingGuideSafetyLoading = ref(false);
const openingGuideStartedAtPly = ref(0);
const openingGuideDetourCount = ref(0);
const openingGuideAbandoned = ref(false);
// 一度完成した計画は、攻撃や駒組みの進展で完成形が崩れても再開しない。
const openingPlanCompletionLocked = ref(false);
const openingGuideBranchNotice = ref("");
const openingGuideBranchNoticePly = ref(-1);
const hintText = ref("");
const guideText = ref(INITIAL_GUIDE_TEXT);
const activeCoachText = computed(() => hintText.value || guideText.value);
const coachExpression = computed(() => coachExpressionForText(activeCoachText.value));
const coachPortraitUrl = computed(() => (
  `${props.assetBaseUrl}/characters/${coachExpressionFilename(activeCoachText.value)}?v=${COACH_EXPRESSION_ASSET_VERSION}`
));
const selectedStrategy = ref("");
const selectedCastle = ref("");
const strategyExplanationOpen = ref(false);
const formationState = ref(createFormationState());
const searchNodes = ref(normalizeNodes(props.engineNodes));
const cpuStrategy = ref("random");
const cpuDetailedStrategy = ref("ibisha");
const cpuDetailedCastle = ref("funagakoi");
const cpuFirstMove = ref("random");
const cpuBishopPreference = ref("");
const cpuRookPreference = ref("");
const cpuTempoPreference = ref("");
const cpuStrategyDetailsOpen = ref(false);
const coachLevel = ref<"off" | "encourage" | "detailed">("detailed");
const settingsOpen = ref(false);
const activePlayerColor = ref<"black" | "white">(normalizePlayerColor(props.playerColor));
const selectedPlayerColor = ref<"black" | "white">(activePlayerColor.value);
const boardLayout = ref<"standard" | "compact" | "portrait">("standard");
const boardShell = ref<HTMLElement | null>(null);
const advisedCoachTopics = new Set<string>();
const coachAdviceLastShownAt = new Map<string, number>();
let playerTurnScore: { type: "cp" | "mate"; value: number } | undefined;
let playerTurnScoreHistoryLength = -1;
type EngineEvaluation = { type: "cp" | "mate"; value: number };
let latestHintAnalysis: {
  historyLength: number;
  candidates: { rank: number; move: string; score?: EngineEvaluation }[];
} | undefined;
let playerMoveHintAssessment: {
  historyLength: number;
  beforeScore: EngineEvaluation;
  afterScore: EngineEvaluation;
} | undefined;
let playerMoveFlair: {
  historyLength: number;
  wasPromotion: boolean;
  wasEnemyCampDrop: boolean;
} | undefined;
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
let openingFollowupGeneration = 0;
let openingFollowupLoading = false;
let openingGuideSafetyGeneration = 0;
let cpuOpeningPlan: { strategyId: string; castleId: string; label: string } | null = null;
const positionAnalysisCache = createPositionAnalysisCache();
let restoringSavedMatch = false;

function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

const matchStorage = browserStorage();
const matchStorageKey = typeof window === "undefined"
  ? ""
  : matchSnapshotKey({
      pathname: window.location.pathname,
      matchId: new URLSearchParams(window.location.search).get("match_id") ?? "",
    });

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
const humanColor = computed(() => activePlayerColor.value === "white" ? Color.WHITE : Color.BLACK);
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
    ? reviewCpuEnabled.value && moveHistory.length - reviewCpuStartedAtPly.value >= 2
    : normalizedMode.value === "local" ? moveHistory.length > 0 : moveHistory.length >= 2)
  && (reviewMode.value || normalizedMode.value === "local" || record.value.position.color === humanColor.value)
);
const statusText = computed(() => {
  if (!matchStarted.value) return "対局条件を選んでください";
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
function openingGuideLegalMoves(): string[] {
  const fields = currentSfen.value.split(" ");
  if (fields.length < 2) return [];
  fields[1] = humanColor.value === Color.BLACK ? "b" : "w";
  try {
    return enumerateLegalMoves(createGameRecord(fields.join(" ")).position).map(({ usi }) => usi);
  } catch {
    return [];
  }
}
function availableOpeningOptions(kind: "strategy" | "castle") {
  const sfen = currentSfen.value;
  const playerIsBlack = humanColor.value === Color.BLACK;
  const playerMoves = moveHistory.filter((_, index) => (index % 2 === 0) === playerIsBlack);
  const currentFormations = formationNamesFromSnapshot(
    detectFormationSnapshot(sfen, hiraganaFormationMaster),
    playerIsBlack ? "black" : "white",
  );
  const committedRookStyle = inferOpeningRookStyle({
    color: playerIsBlack ? "black" : "white",
    playedMoves: playerMoves,
    currentSfen: sfen,
  });
  const selectedCounterpartStyle = kind === "strategy"
    ? openingDefinitionRookStyle(selectedCastle.value, "castle")
    : openingDefinitionRookStyle(selectedStrategy.value, "strategy");
  return availableOpeningDefinitions({
    definitions: kind === "strategy" ? OPENING_STRATEGIES : OPENING_CASTLES,
    kind,
    color: playerIsBlack ? "black" : "white",
    playedMoves: playerMoves,
    moveHistory,
    legalMoves: openingGuideLegalMoves(),
    // 過去に一度成立した形ではなく、現在の盤面だけで利用可否を決める。
    detectedFormations: currentFormations,
    currentSfen: sfen,
    // 実際の着手による確定を優先し、未確定なら選択中の相方へ合わせる。
    rookStyle: committedRookStyle ?? selectedCounterpartStyle,
  });
}
const availableOpeningStrategies = computed(() => availableOpeningOptions("strategy"));
const availableOpeningCastles = computed(() => availableOpeningOptions("castle"));
const rangingRookChoiceRequired = computed(() => (
  openingDefinitionRookStyle(selectedCastle.value, "castle") === "ranging"
  && openingDefinitionRookStyle(selectedStrategy.value, "strategy") !== "ranging"
));
const rangingRookChoices = computed(() => rangingRookStrategyChoices(
  selectedCastle.value,
  availableOpeningStrategies.value.map(({ id }) => id),
));
const OPENING_STRATEGY_GROUPS = [
  { id: "ibisha", label: "居飛車／単独作戦" },
  { id: "aigakari", label: "相居飛車／相掛かり" },
  { id: "yokofudori", label: "相居飛車／横歩取り" },
  { id: "yagura", label: "相居飛車／矢倉" },
  { id: "kakugawari", label: "相居飛車／角換わり" },
  { id: "gangi", label: "相居飛車／雁木" },
  { id: "anti-ranging", label: "対抗型／居飛車側" },
  { id: "shiken", label: "四間飛車" },
  { id: "sangen", label: "三間飛車" },
  { id: "nakabisha", label: "中飛車" },
  { id: "mukai", label: "向かい飛車" },
  { id: "special", label: "奇襲・特殊戦法" },
];
function groupOpeningStrategies<T extends (typeof OPENING_STRATEGIES)[number]>(options: T[]) {
  return OPENING_STRATEGY_GROUPS.map((group) => ({
    ...group,
    options: options.filter(({ family }) => family === group.id),
  })).filter(({ options: groupOptions }) => groupOptions.length);
}
const groupedOpeningStrategies = computed(() => {
  const availableIds = new Set(availableOpeningStrategies.value.map(({ id }) => id));
  return groupOpeningStrategies(
    OPENING_STRATEGIES
      .filter(({ guideSelectable }) => guideSelectable !== false)
      .map((strategy) => ({
        ...strategy,
        // 進行中の補助は、相手の応手を待つ一時的な局面でも解除しない。
        // 中断後も、現在局面から到達できる別案だけを選択可能にする。
        disabled: strategy.id !== selectedStrategy.value
          && !availableIds.has(strategy.id),
      })),
  );
});
const cpuDetailedStrategyGroups = computed(() => {
  const cpuColor = selectedPlayerColor.value === "black" ? "white" : "black";
  const supported = new Set(CPU_OPENING_STRATEGY_IDS);
  return groupOpeningStrategies(OPENING_STRATEGIES.filter(({ id, availability }) => (
    supported.has(id)
    && (!availability?.colors || availability.colors.includes(cpuColor))
  )));
});
function groupOpeningCastles<T extends (typeof OPENING_CASTLES)[number]>(options: T[]) {
  return OPENING_CASTLE_GROUPS.map((group) => ({
    ...group,
    options: options.filter(({ menuGroup }) => menuGroup === group.id),
  })).filter(({ options: groupOptions }) => groupOptions.length);
}
const cpuDetailedCastleGroups = computed(() => {
  const strategyStyle = openingDefinitionRookStyle(cpuDetailedStrategy.value, "strategy");
  return groupOpeningCastles(OPENING_CASTLES.filter(({ id }) => {
    const castleStyle = openingDefinitionRookStyle(id, "castle") ?? "both";
    return !strategyStyle || castleStyle === strategyStyle || castleStyle === "both";
  }));
});
const groupedOpeningCastles = computed(() => {
  const availableIds = new Set(availableOpeningCastles.value.map(({ id }) => id));
  return groupOpeningCastles(OPENING_CASTLES.map((castle) => ({
      ...castle,
      disabled: castle.id !== selectedCastle.value
        && !availableIds.has(castle.id),
    })));
});
const selectedStrategyDefinition = computed(() => (
  OPENING_STRATEGIES.find(({ id }) => id === selectedStrategy.value) ?? null
));
const selectedStrategyExplanation = computed(() => openingExplanation(selectedStrategy.value));
const OPENING_GUIDE_MAX_PLIES = 40;
const openingPlanExpired = computed(() => {
  // currentSfenを購読し、非refのmoveHistoryが進むたび再評価する。
  currentSfen.value;
  return Boolean(selectedStrategy.value || selectedCastle.value)
    && isOpeningGuideExpired(
      moveHistory.length,
      openingGuideStartedAtPly.value,
      OPENING_GUIDE_MAX_PLIES,
    );
});
const openingPlanCandidates = computed(() => {
  // currentSfen is intentionally read here so the non-ref move history is reconsidered after every move.
  const sfen = currentSfen.value;
  if (
    reviewMode.value
    || !active.value
    || !canMove.value
    || openingGuideAbandoned.value
    || openingPlanCompletionLocked.value
    || openingPlanExpired.value
    || rangingRookChoiceRequired.value
    || (!selectedStrategy.value && !selectedCastle.value)
  ) return [];
  const playerIsBlack = humanColor.value === Color.BLACK;
  const playerMoves = moveHistory.filter((_, index) => (index % 2 === 0) === playerIsBlack);
  const opponentMoves = moveHistory.filter((_, index) => (index % 2 === 0) !== playerIsBlack);
  const opponentColor = humanColor.value === Color.BLACK ? Color.WHITE : Color.BLACK;
  return getOpeningPlanCandidates({
    strategyId: selectedStrategy.value,
    castleId: selectedCastle.value,
    color: playerIsBlack ? "black" : "white",
    playedMoves: playerMoves,
    opponentMoves,
    moveHistory,
    legalMoves: enumerateLegalMoves(record.value.position).map(({ usi }) => usi),
    detectedFormations: formationNamesForColor(sfen, humanColor.value),
    opponentFormations: formationNamesForColor(sfen, opponentColor),
    currentSfen: sfen,
  });
});
const openingPlanCandidate = computed(() => openingPlanCandidates.value[0] ?? null);
const openingPlanCurrentlyComplete = computed(() => {
  const sfen = currentSfen.value;
  if (reviewMode.value || !active.value || (!selectedStrategy.value && !selectedCastle.value)) {
    return false;
  }
  const playerIsBlack = humanColor.value === Color.BLACK;
  const playerMoves = moveHistory.filter((_, index) => (index % 2 === 0) === playerIsBlack);
  const opponentMoves = moveHistory.filter((_, index) => (index % 2 === 0) !== playerIsBlack);
  const opponentColor = humanColor.value === Color.BLACK ? Color.WHITE : Color.BLACK;
  return isOpeningPlanComplete({
    strategyId: selectedStrategy.value,
    castleId: selectedCastle.value,
    color: playerIsBlack ? "black" : "white",
    playedMoves: playerMoves,
    opponentMoves,
    detectedFormations: formationNamesForColor(sfen, humanColor.value),
    opponentFormations: formationNamesForColor(sfen, opponentColor),
    currentSfen: sfen,
  });
});
watch(openingPlanCurrentlyComplete, (complete) => {
  if (complete) openingPlanCompletionLocked.value = true;
}, { flush: "sync" });
const openingPlanComplete = computed(() => (
  openingPlanCompletionLocked.value || openingPlanCurrentlyComplete.value
));
const openingPlanSettled = computed(() => openingPlanComplete.value || openingPlanExpired.value);
const openingFollowupEligible = computed(() => shouldShowOpeningFollowup({
  strategyId: selectedStrategy.value,
  castleId: selectedCastle.value,
  planComplete: openingPlanComplete.value,
  planExpired: openingPlanExpired.value,
}));
const openingCanonicalFollowupCandidates = computed(() => {
  const sfen = currentSfen.value;
  if (!canMove.value || !openingFollowupEligible.value) return [];
  return getOpeningCanonicalFollowupCandidates({
    strategyId: selectedStrategy.value,
    color: humanColor.value === Color.BLACK ? "black" : "white",
    currentSfen: sfen,
    legalMoves: enumerateLegalMoves(record.value.position).map(({ usi }) => usi),
  });
});
const openingCombinedFollowupCandidates = computed(() => {
  const seen = new Set<string>();
  return [
    ...openingCanonicalFollowupCandidates.value,
    ...openingFollowupCandidates.value,
  ].filter(({ usi }) => {
    if (seen.has(usi)) return false;
    seen.add(usi);
    return true;
  });
});
const boardCandidates = computed(() => {
  if (hintCandidates.value.length) return hintCandidates.value;
  if (openingGuideDetourCandidates.value.length) return openingGuideDetourCandidates.value;
  if (openingGuideDecision.value) {
    return [{
      usi: openingGuideDecision.value.usi,
      guideKind: openingGuideDecision.value.source,
    }];
  }
  return openingCombinedFollowupCandidates.value;
});
const openingGuideStatus = computed(() => {
  if (!selectedStrategy.value && !selectedCastle.value) return "";
  if (rangingRookChoiceRequired.value) {
    return rangingRookChoices.value.length
      ? "四間飛車が基本だよ。三間・中・向かい飛車も、今の局面から選べるよ！"
      : "この局面から選べる振り先がないみたい。別の囲いを選び直そう。";
  }
  if (reviewMode.value) return "道しるべは対局中に表示するよ。";
  if (!canMove.value) return "あなたの手番になったら、次の一手を矢印で示すよ。";
  if (openingGuideAbandoned.value) {
    return "この形へ戻るのは難しそう。別の戦法や囲いを選び直そう！";
  }
  if (openingGuideSafetyLoading.value) return "予定手が安全か確認しているよ…";
  if (openingGuideDecision.value?.source === "urgent") {
    return `先に受けよう：${formatHintMove(openingGuideDecision.value.usi, currentSfen.value)}`;
  }
  if (openingGuideDecision.value?.source === "ai") {
    return openingGuideDetourCandidates.value.length >= 4
      ? "黄色は危険な定跡手、赤色は安全を優先したAI候補3手だよ。"
      : `安全な寄り道：${formatHintMove(openingGuideDecision.value.usi, currentSfen.value)}`;
  }
  if (openingCanonicalFollowupCandidates.value.length) {
    return openingCanonicalFollowupCandidates.value[0]?.kind === "silver-advance"
      ? "原始棒銀が完成したね！AI候補に加え、1五銀・3五銀の定跡手から歩交換まで案内するよ。"
      : "AI候補に加え、定跡手で飛車先の歩交換まで案内するよ。";
  }
  if (openingFollowupCandidates.value.length) {
    return openingFollowupRemaining.value > 0
      ? `完成後の候補手を3手表示中（あと${openingFollowupRemaining.value}回）`
      : "完成後の候補手を3手表示中（今回で最後）";
  }
  if (openingPlanExpired.value) return "形作りはここまで。ここからは局面に合わせて指そう！";
  if (openingFollowupEligible.value && openingFollowupLoading) {
    return "戦法が完成したね。次の3手を考えているよ…";
  }
  if (openingFollowupEligible.value && openingFollowupStarted.value) return "戦法が完成したね！";
  if (openingPlanComplete.value && selectedCastle.value) {
    return selectedStrategy.value ? "戦法と囲いが完成したね！" : "囲いが完成したね！";
  }
  if (!openingGuideDecision.value) return "形が完成したか、今の局面では予定手を指せないみたい。";
  const phase = openingGuideDecision.value.phase === "strategy" ? "戦法" : "囲い";
  return `${phase}の次の一手：${formatHintMove(openingGuideDecision.value.usi, currentSfen.value)}`;
});

function selectedOpeningLabel() {
  const strategy = OPENING_STRATEGIES.find(({ id }) => id === selectedStrategy.value)?.label;
  const castle = OPENING_CASTLES.find(({ id }) => id === selectedCastle.value)?.label;
  return [strategy, castle].filter(Boolean).join("＋");
}

function announceOpeningGuide() {
  strategyExplanationOpen.value = false;
  openingPlanCompletionLocked.value = false;
  resetOpeningFollowup();
  resetOpeningGuideSafety();
  openingGuideStartedAtPly.value = moveHistory.length;
  openingGuideDetourCount.value = 0;
  openingGuideAbandoned.value = false;
  openingGuideBranchNotice.value = "";
  openingGuideBranchNoticePly.value = -1;
  // 既に完成形の局面で戦法・囲いを選んだ場合も、その完成状態を保持する。
  if (openingPlanCurrentlyComplete.value) openingPlanCompletionLocked.value = true;
  const label = selectedOpeningLabel();
  if (label && coachLevel.value !== "off") {
    guideText.value = `${label}を目指そう。盤の矢印を参考にしてね！`;
  }
  scheduleOpeningGuideSafety();
  scheduleOpeningFollowupCandidates();
}

function chooseRangingRookStrategy(strategyId: string) {
  const choice = rangingRookChoices.value.find(({ id }) => id === strategyId);
  if (!choice) return;
  selectedStrategy.value = strategyId;
  announceOpeningGuide();
  if (coachLevel.value !== "off") {
    const castle = OPENING_CASTLES.find(({ id }) => id === selectedCastle.value)?.label;
    guideText.value = `${choice.label}に振ってから、${castle ?? "囲い"}を組もう！`;
  }
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

function normalizePlayerColor(value: string): "black" | "white" {
  return value === "white" ? "white" : "black";
}

function toggleSettings() {
  settingsOpen.value = !settingsOpen.value;
}

function closeSettings() {
  settingsOpen.value = false;
}

function toggleCpuStrategyDetails() {
  cpuStrategyDetailsOpen.value = !cpuStrategyDetailsOpen.value;
  cpuOpeningPlan = null;
}

function beginMatch() {
  activePlayerColor.value = selectedPlayerColor.value;
  matchStarted.value = true;
  pregameOpen.value = false;
  restart();
}

function openPregame() {
  if (cpuTimer) clearTimeout(cpuTimer);
  cancelPlayerIdleAdvice();
  coachAdviceScheduler.reset();
  analysisGeneration += 1;
  reviewCoachGeneration += 1;
  reviewCpuGeneration += 1;
  if (analysisRunning.value) engine?.stop();
  active.value = false;
  thinking.value = false;
  matchStarted.value = false;
  pregameOpen.value = true;
  settingsOpen.value = false;
  resultDialogOpen.value = false;
  reviewMode.value = false;
  analysisOpen.value = false;
  discardPersistedMatch();
}

function configuredCpuOpeningStrategy(): string {
  return cpuStrategyDetailsOpen.value
    ? (cpuDetailedStrategy.value || cpuStrategy.value)
    : cpuStrategy.value;
}

function currentCpuOpeningTurn() {
  const cpuIsBlack = humanColor.value === Color.WHITE;
  const cpuMoves = moveHistory.filter((_, index) => (index % 2 === 0) === cpuIsBlack);
  return {
    cpuIsBlack,
    cpuMoves,
    cpuColor: cpuIsBlack ? "black" as const : "white" as const,
  };
}

function strategyMove(): string | undefined {
  // 駒落ちや途中局面では平手用定跡を当てはめない。
  if (props.initialSfen !== STANDARD_SFEN) return undefined;
  const { cpuIsBlack, cpuMoves, cpuColor: configuredCpuColor } = currentCpuOpeningTurn();
  const legalMoves = enumerateLegalMoves(record.value.position).map(({ usi }) => usi);
  const requestedFirstMove = configuredCpuFirstMove({
    configuredFirstMove: cpuFirstMove.value,
    cpuColor: configuredCpuColor,
    cpuMoveCount: cpuMoves.length,
    legalMoves,
  });
  if (requestedFirstMove) return requestedFirstMove;
  const requestedBishopMove = configuredCpuBishopMove({
    bishopPreference: cpuBishopPreference.value,
    cpuColor: configuredCpuColor,
    cpuMoves,
    legalMoves,
  });
  if (requestedBishopMove) return requestedBishopMove;
  if (!shouldUseCpuOpening({
    ply: moveHistory.length,
    cpuMoveCount: cpuMoves.length,
    inCheck: isSideToMoveInCheck(currentSfen.value),
    lastMoveWasCapture: Boolean(record.value.current.move?.capturedPieceType),
  })) return undefined;
  if (!cpuOpeningPlan) {
    const selectedPlan = selectCpuOpeningRepertoire({
      configuredStrategy: configuredCpuOpeningStrategy(),
      cpuColor: configuredCpuColor,
      moves: moveHistory,
      bishopPreference: cpuBishopPreference.value,
      rookPreference: cpuRookPreference.value,
      tempoPreference: cpuTempoPreference.value,
    });
    cpuOpeningPlan = cpuStrategyDetailsOpen.value && cpuDetailedCastle.value
      ? {
          ...selectedPlan,
          castleId: cpuDetailedCastle.value,
          label: [
            OPENING_STRATEGIES.find(({ id }) => id === selectedPlan.strategyId)?.label,
            OPENING_CASTLES.find(({ id }) => id === cpuDetailedCastle.value)?.label,
          ].filter(Boolean).join("＋"),
        }
      : selectedPlan;
  }
  const cpuColor = cpuIsBlack ? Color.BLACK : Color.WHITE;
  const opponentMoves = moveHistory.filter((_, index) => (index % 2 === 0) !== cpuIsBlack);
  const opponentColor = cpuColor === Color.BLACK ? Color.WHITE : Color.BLACK;
  // 定跡の予定手より、飛車先を破られないための3二金／7八金を優先する。
  const urgent = openingUrgentResponse({
    strategyId: cpuOpeningPlan.strategyId,
    color: cpuIsBlack ? "black" : "white",
    moveHistory,
    legalMoves,
  });
  if (urgent) return urgent.usi;
  return nextOpeningPlanMove({
    strategyId: cpuOpeningPlan.strategyId,
    castleId: cpuOpeningPlan.castleId,
    color: cpuIsBlack ? "black" : "white",
    playedMoves: cpuMoves,
    opponentMoves,
    moveHistory,
    legalMoves,
    detectedFormations: formationNamesForColor(currentSfen.value, cpuColor),
    opponentFormations: formationNamesForColor(currentSfen.value, opponentColor),
    currentSfen: currentSfen.value,
  })?.usi;
}

function cpuMovesAllowedByBishopSetting() {
  const { cpuColor } = currentCpuOpeningTurn();
  const legal = enumerateLegalMoves(record.value.position);
  const allowed = legal.filter((move) => cpuMoveMatchesBishopPreference({
    bishopPreference: cpuBishopPreference.value,
    cpuColor,
    usi: move.usi,
    pieceType: move.pieceType,
    capturedPieceType: move.capturedPieceType ?? "",
  }));
  // 王手回避などで指定を守る合法手が一つもない場合だけ、対局続行を優先する。
  return allowed.length ? allowed : legal;
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

function savedMatchNumber(value: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, Math.trunc(value)))
    : fallback;
}

function recordAndFormationsFromMoves(moves: string[]) {
  const nextRecord = createGameRecord(props.initialSfen);
  let nextFormationState = createFormationState();
  nextFormationState = updateFormationState(
    nextFormationState,
    detectFormationSnapshot(nextRecord.position.sfen, hiraganaFormationMaster),
  );
  for (const move of moves) {
    if (!appendUsiMove(nextRecord, move)) throw new Error("保存棋譜に不正な指し手があります。");
    nextFormationState = updateFormationState(
      nextFormationState,
      detectFormationSnapshot(nextRecord.position.sfen, hiraganaFormationMaster),
    );
  }
  return { nextRecord, nextFormationState };
}

function persistedResult(value: unknown, moves: string[], finalSfen: string): MatchResult | null {
  if (value === null || value === undefined) return null;
  if (!value || typeof value !== "object") throw new Error("保存された終局結果が不正です。");
  const candidate = value as MatchResult;
  const outcomes = ["black-win", "white-win", "draw"];
  const reasons = ["checkmate", "resignation", "repetition", "perpetual-check"];
  const validWinner = candidate.winner === Color.BLACK
    || candidate.winner === Color.WHITE
    || candidate.winner === null;
  const sameMoves = Array.isArray(candidate.moves)
    && candidate.moves.length === moves.length
    && candidate.moves.every((move, index) => move === moves[index]);
  if (
    !outcomes.includes(candidate.outcome)
    || !reasons.includes(candidate.reason)
    || !validWinner
    || candidate.moveCount !== moves.length
    || candidate.finalSfen !== finalSfen
    || !sameMoves
  ) throw new Error("保存された終局結果が棋譜と一致しません。");
  return candidate;
}

function persistMatchState() {
  if (
    restoringSavedMatch || !matchStorage || !matchStorageKey
    || !matchStarted.value || pregameOpen.value || reviewMode.value
  ) return;
  saveMatchSnapshot(matchStorage, matchStorageKey, {
    initialSfen: props.initialSfen,
    mode: normalizedMode.value,
    moves: [...moveHistory],
    active: active.value,
    result: result.value,
    activePlayerColor: activePlayerColor.value,
    selectedPlayerColor: selectedPlayerColor.value,
    searchNodes: searchNodes.value,
    cpuStrategy: cpuStrategy.value,
    cpuDetailedStrategy: cpuDetailedStrategy.value,
    cpuDetailedCastle: cpuDetailedCastle.value,
    cpuFirstMove: cpuFirstMove.value,
    cpuBishopPreference: cpuBishopPreference.value,
    cpuRookPreference: cpuRookPreference.value,
    cpuTempoPreference: cpuTempoPreference.value,
    cpuStrategyDetailsOpen: cpuStrategyDetailsOpen.value,
    coachLevel: coachLevel.value,
    selectedStrategy: selectedStrategy.value,
    selectedCastle: selectedCastle.value,
    hintsRemaining: hintsRemaining.value,
    undosRemaining: undosRemaining.value,
    openingGuideStartedAtPly: openingGuideStartedAtPly.value,
    openingGuideDetourCount: openingGuideDetourCount.value,
    openingGuideAbandoned: openingGuideAbandoned.value,
    openingPlanCompletionLocked: openingPlanCompletionLocked.value,
  });
}

function discardPersistedMatch() {
  clearMatchSnapshot(matchStorage, matchStorageKey);
}

function restorePersistedMatch(): boolean {
  const snapshot = loadMatchSnapshot(matchStorage, matchStorageKey, {
    initialSfen: props.initialSfen,
    mode: normalizedMode.value,
  });
  if (!snapshot) return false;
  restoringSavedMatch = true;
  try {
    if (
      !Array.isArray(snapshot.moves)
      || snapshot.moves.length > 1000
      || snapshot.moves.some((move: unknown) => typeof move !== "string" || move.length > 8)
    ) throw new Error("保存棋譜が不正です。");
    const moves = snapshot.moves as string[];
    const { nextRecord, nextFormationState } = recordAndFormationsFromMoves(moves);
    const restoredResult = persistedResult(snapshot.result, moves, nextRecord.position.sfen);
    if (snapshot.active !== true && !restoredResult) throw new Error("保存された対局状態が不正です。");

    record.value = nextRecord;
    moveHistory = [...moves];
    formationState.value = nextFormationState;
    currentSfen.value = nextRecord.position.sfen;
    lastMove.value = moves.at(-1) ?? "";
    activePlayerColor.value = snapshot.activePlayerColor === "white" ? "white" : "black";
    selectedPlayerColor.value = snapshot.selectedPlayerColor === "white"
      ? "white"
      : activePlayerColor.value;
    searchNodes.value = normalizeNodes(snapshot.searchNodes);
    cpuStrategy.value = typeof snapshot.cpuStrategy === "string" ? snapshot.cpuStrategy : "random";
    cpuDetailedStrategy.value = typeof snapshot.cpuDetailedStrategy === "string"
      ? snapshot.cpuDetailedStrategy
      : "ibisha";
    cpuDetailedCastle.value = typeof snapshot.cpuDetailedCastle === "string"
      ? snapshot.cpuDetailedCastle
      : "funagakoi";
    cpuFirstMove.value = typeof snapshot.cpuFirstMove === "string" ? snapshot.cpuFirstMove : "random";
    cpuBishopPreference.value = [
      "", "open", "open-close", "exchange", "invite-exchange", "closed",
    ].includes(snapshot.cpuBishopPreference)
      ? snapshot.cpuBishopPreference
      : "";
    cpuRookPreference.value = ["", "rook-pawn", "static", "ranging", "adaptive"].includes(snapshot.cpuRookPreference)
      ? snapshot.cpuRookPreference
      : "";
    cpuTempoPreference.value = ["", "balanced", "aggressive", "patient", "castle-first", "attack-first"].includes(snapshot.cpuTempoPreference)
      ? snapshot.cpuTempoPreference
      : "";
    cpuStrategyDetailsOpen.value = snapshot.cpuStrategyDetailsOpen === true;
    coachLevel.value = ["off", "encourage", "detailed"].includes(snapshot.coachLevel)
      ? snapshot.coachLevel
      : "detailed";
    selectedStrategy.value = typeof snapshot.selectedStrategy === "string"
      ? snapshot.selectedStrategy
      : "";
    selectedCastle.value = typeof snapshot.selectedCastle === "string" ? snapshot.selectedCastle : "";
    hintsRemaining.value = savedMatchNumber(snapshot.hintsRemaining, props.hintCount, 0, props.hintCount);
    undosRemaining.value = savedMatchNumber(snapshot.undosRemaining, props.undoCount, 0, props.undoCount);
    openingGuideStartedAtPly.value = savedMatchNumber(snapshot.openingGuideStartedAtPly, 0, 0, moves.length);
    openingGuideDetourCount.value = savedMatchNumber(snapshot.openingGuideDetourCount, 0, 0, 3);
    openingGuideAbandoned.value = snapshot.openingGuideAbandoned === true;
    openingPlanCompletionLocked.value = snapshot.openingPlanCompletionLocked === true;
    result.value = restoredResult;
    resultDialogOpen.value = Boolean(restoredResult);
    matchStarted.value = true;
    pregameOpen.value = false;
    active.value = snapshot.active === true && !restoredResult;
    thinking.value = false;
    guideText.value = coachLevel.value === "off" ? "" : "前の局面から対局を再開したよ！";
    return true;
  } catch {
    discardPersistedMatch();
    return false;
  } finally {
    restoringSavedMatch = false;
  }
}

function displayCoachAdvice(advice: { key: string; text: string; topic?: string }): boolean {
  const lastShownAt = coachAdviceLastShownAt.get(advice.key);
  if (
    lastShownAt !== undefined && moveCount.value - lastShownAt < 8
    && coachAdvicePriority(advice) < 100
  ) return false;
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
  const base = props.initialSfen === STANDARD_SFEN ? "startpos" : props.initialSfen;
  return `${base}${moveHistory.length ? ` moves ${moveHistory.join(" ")}` : ""}`;
}

async function analyzeCoachPosition(nodes: number, maxTimeMs: number, multiPv = 1) {
  if (!engine) return [];
  const positionKey = currentEnginePosition();
  const cached = positionAnalysisCache.get(positionKey, { nodes, multiPv });
  if (cached) return cached;
  engine.setPosition(positionKey);
  engine.applyStrengthOptions({ multiPv });
  const analysis = await engine.go({ nodes, maxTimeMs });
  positionAnalysisCache.set(positionKey, analysis.candidates, { nodes, multiPv });
  return analysis.candidates;
}

async function analyzeOpeningFollowupPosition() {
  const settings = getOpeningFollowupSearchSettings(
    props.mobile || boardLayout.value === "portrait",
  );
  return analyzeCoachPosition(settings.nodes, settings.maxTimeMs, settings.multiPv);
}

function resetOpeningGuideSafety() {
  openingGuideSafetyGeneration += 1;
  openingGuideSafetyLoading.value = false;
  openingGuideDecision.value = null;
  openingGuideDetourCandidates.value = [];
}

function scheduleOpeningGuideSafety() {
  const generation = ++openingGuideSafetyGeneration;
  openingGuideSafetyLoading.value = false;
  openingGuideDecision.value = null;
  openingGuideDetourCandidates.value = [];
  if (
    !active.value || reviewMode.value || normalizedMode.value !== "cpu"
    || record.value.position.color !== humanColor.value
    || openingGuideAbandoned.value
    || rangingRookChoiceRequired.value
    || (!selectedStrategy.value && !selectedCastle.value)
  ) return;

  // 完成後は候補手表示へ完全に移行し、序盤計画・寄り道判定へ戻さない。
  if (openingPlanComplete.value) return;

  const playerIsBlack = humanColor.value === Color.BLACK;
  const playerMoves = moveHistory.filter((_, index) => (index % 2 === 0) === playerIsBlack);
  const opponentMoves = moveHistory.filter((_, index) => (index % 2 === 0) !== playerIsBlack);
  const interruption = openingPlanInterruption({
    strategyId: selectedStrategy.value,
    castleId: selectedCastle.value,
    color: playerIsBlack ? "black" : "white",
    playedMoves: playerMoves,
    opponentMoves,
    moveHistory,
    detectedFormations: formationNamesForColor(currentSfen.value, humanColor.value),
    opponentFormations: formationNamesForColor(
      currentSfen.value,
      humanColor.value === Color.BLACK ? Color.WHITE : Color.BLACK,
    ),
    currentSfen: currentSfen.value,
  });
  if (interruption) {
    if (interruption.requiresReselection) {
      if (interruption.clearStrategy) selectedStrategy.value = "";
      if (interruption.clearCastle) selectedCastle.value = "";
    } else {
      const fallback = OPENING_STRATEGIES.find(({ id }) => id === interruption.fallbackStrategyId);
      selectedStrategy.value = fallback?.guideSelectable === false ? "" : interruption.fallbackStrategyId;
    }
    openingPlanCompletionLocked.value = false;
    openingGuideStartedAtPly.value = moveHistory.length;
    openingGuideDetourCount.value = 0;
    openingGuideAbandoned.value = false;
    guideText.value = coachLevel.value === "off" ? "" : interruption.message;
    if (selectedStrategy.value || selectedCastle.value) scheduleOpeningGuideSafety();
    return;
  }

  const branchMessage = openingPlanBranchMessage({
    strategyId: selectedStrategy.value,
    color: playerIsBlack ? "black" : "white",
    playedMoves: playerMoves,
    opponentMoves,
  });
  if (
    branchMessage
    && branchMessage !== openingGuideBranchNotice.value
    && coachLevel.value !== "off"
  ) {
    openingGuideBranchNotice.value = branchMessage;
    openingGuideBranchNoticePly.value = moveHistory.length;
    guideText.value = branchMessage;
  }

  const legalMoves = enumerateLegalMoves(record.value.position).map(({ usi }) => usi);
  const urgent = openingUrgentResponse({
    strategyId: selectedStrategy.value,
    color: humanColor.value === Color.BLACK ? "black" : "white",
    moveHistory,
    legalMoves,
  });
  if (urgent) {
    openingGuideDecision.value = { ...urgent, source: "urgent" };
    if (coachLevel.value !== "off") guideText.value = urgent.reason;
    return;
  }

  const plannedOptions = openingPlanCandidates.value;
  const planned = plannedOptions[0] ?? null;
  const planBlocked = plannedOptions.length === 0 && !openingPlanSettled.value;
  if (!planned && !planBlocked) return;
  if (!engineReady.value || !engine) {
    if (planned) openingGuideDecision.value = { ...planned, source: "plan" };
    return;
  }

  const historyLength = moveHistory.length;
  openingGuideSafetyLoading.value = true;
  dedicatedCoachQueue = dedicatedCoachQueue
    .catch(() => undefined)
    .then(async () => {
      if (
        generation !== openingGuideSafetyGeneration || !active.value || reviewMode.value
        || moveHistory.length !== historyLength
        || record.value.position.color !== humanColor.value
      ) return;
      const settings = getOpeningGuideSafetySearchSettings(
        props.mobile || boardLayout.value === "portrait",
      );
      let candidates = await analyzeCoachPosition(
        settings.nodes,
        settings.maxTimeMs,
        settings.multiPv,
      );
      if (
        generation !== openingGuideSafetyGeneration || !active.value || reviewMode.value
        || moveHistory.length !== historyLength
        || record.value.position.color !== humanColor.value
      ) return;
      if (planned && !plannedOptions.some(({ usi }) => candidates.some(({ move }) => move === usi))) {
        engine!.setPosition(currentEnginePosition());
        engine!.applyStrengthOptions({ multiPv: 1 });
        const forced = await engine!.go({
          nodes: settings.forcedNodes,
          maxTimeMs: settings.forcedMaxTimeMs,
          searchMoves: [planned.usi],
        });
        const forcedCandidate = forced.candidates.find(({ rank }) => rank === 1);
        if (forcedCandidate) {
          candidates = [
            ...candidates,
            { ...forcedCandidate, rank: settings.multiPv + 1, move: planned.usi },
          ];
        }
      }
      if (
        generation !== openingGuideSafetyGeneration || !active.value || reviewMode.value
        || moveHistory.length !== historyLength
        || record.value.position.color !== humanColor.value
      ) return;
      const playerMoves = moveHistory.filter((_, index) => (index % 2 === 0) === playerIsBlack);
      const compatibleCandidates = filterOpeningCompatibleCandidates({
        strategyId: selectedStrategy.value,
        color: playerIsBlack ? "black" : "white",
        playedMoves: playerMoves,
        plannedMoves: plannedOptions,
        candidates,
      });
      const choice = plannedOptions.length
        ? chooseAdaptiveOpeningMove(
            plannedOptions,
            compatibleCandidates,
            openingGuideScoreLossLimit(selectedStrategy.value, planned.phase),
          )
        : compatibleCandidates
            .filter(({ rank, move }) => Number.isInteger(rank) && typeof move === "string")
            .sort((left, right) => left.rank - right.rank)
            .map(({ move }) => ({ usi: move, source: "ai" as const }))[0];
      if (!choice) return;
      openingGuideDecision.value = {
        usi: choice.usi,
        source: choice.source,
        phase: plannedOptions.find(({ usi }) => usi === choice.usi)?.phase ?? planned?.phase,
      };
      if (choice.source === "ai" && planned) {
        openingGuideDetourCandidates.value = openingDetourArrowCandidates(
          planned.usi,
          candidates,
          3,
        ).map(({ usi, source, score }) => ({
          usi,
          guideKind: source === "unsafe-plan" ? "unsafe-plan" : "ai",
          score: hintScoreForArrow(score),
        }));
      }
      if (
        choice.source === "ai"
        && coachLevel.value !== "off"
        && openingGuideBranchNoticePly.value !== historyLength
      ) {
        if (planBlocked || !planned) {
          guideText.value = `予定の形へすぐ進めないから、まずは${formatHintMove(choice.usi, currentSfen.value)}で局面を整えよう。`;
        } else {
          const plannedText = formatHintMove(planned.usi, currentSfen.value);
          const scoreLoss = typeof choice.scoreLoss === "number" && Number.isFinite(choice.scoreLoss)
            ? choice.scoreLoss
            : undefined;
          const riskText = scoreLoss !== undefined
            ? `AI最善手より評価が約${(scoreLoss / 100).toFixed(1)}点下がり`
            : "AIの上位候補にも入らず";
          guideText.value = `黄色の${plannedText}が定跡手だよ。でも今はその手だと${riskText}、形作りを続ける間に駒損や攻め込みを許す危険があるよ。赤いAI候補3手から安全な寄り道を選ぼう！`;
        }
      }
    })
    .catch(() => {
      if (planned && generation === openingGuideSafetyGeneration) {
        openingGuideDecision.value = { ...planned, source: "plan" };
      }
    })
    .finally(() => {
      if (generation === openingGuideSafetyGeneration) openingGuideSafetyLoading.value = false;
    });
}

function resetOpeningFollowup() {
  openingFollowupGeneration += 1;
  openingFollowupLoading = false;
  openingFollowupCandidates.value = [];
  openingFollowupRemaining.value = 0;
  openingFollowupStarted.value = false;
}

function scheduleOpeningFollowupCandidates() {
  if (
    !engineReady.value || !engine || !active.value || reviewMode.value
    || normalizedMode.value !== "cpu" || record.value.position.color !== humanColor.value
    || openingGuideAbandoned.value
    || !openingFollowupEligible.value || openingFollowupLoading
    || openingGuideSafetyLoading.value || openingGuideDecision.value
    || openingFollowupCandidates.value.length > 0
  ) return;
  if (!openingFollowupStarted.value) {
    openingFollowupStarted.value = true;
    openingFollowupRemaining.value = openingFollowupCount();
  }
  if (openingFollowupRemaining.value <= 0) return;

  const generation = openingFollowupGeneration;
  const historyLength = moveHistory.length;
  openingFollowupLoading = true;
  dedicatedCoachQueue = dedicatedCoachQueue
    .catch(() => undefined)
    .then(async () => {
      if (
        generation !== openingFollowupGeneration || !active.value || reviewMode.value
        || moveHistory.length !== historyLength
        || record.value.position.color !== humanColor.value
      ) return;
      // 自動表示は閃きと同じ3候補。閃き未満の負荷で、通常助言より深く読む。
      const candidates = await analyzeOpeningFollowupPosition();
      if (
        generation !== openingFollowupGeneration || !active.value || reviewMode.value
        || moveHistory.length !== historyLength
        || record.value.position.color !== humanColor.value
      ) return;
      const moves = getHintMoves({
        move: candidates.find(({ rank }) => rank === 1)?.move ?? "",
        candidates,
      }, 3);
      openingFollowupCandidates.value = moves.map(({ move, score }) => ({
        usi: move,
        score: hintScoreForArrow(score),
      }));
      openingFollowupRemaining.value -= 1;
      if (coachLevel.value !== "off") {
        guideText.value = "戦法が完成したね！この先はAIの候補手を3手示すよ。";
      }
    })
    .catch(() => undefined)
    .finally(() => {
      if (generation === openingFollowupGeneration) openingFollowupLoading = false;
    });
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
  const mateThreatResult = coachLevel.value === "detailed" && !inCheck
    ? detectStrictMateThreat(currentSfen.value, 7, budget.threatNodes)
    : null;
  const mateThreat = mateThreatResult?.isThreat ?? false;
  const bestMove = candidates.find((candidate) => candidate.rank === 1)?.move;
  const riskAdvice = coachLevel.value === "detailed"
    ? getCandidateRiskAdvice(normalizedCandidates, {
        inCheck,
        mateThreat,
        mateThreatChecked: mateThreatResult !== null && !mateThreatResult.exhausted,
        moveCount: moveCount.value,
        ...(bestMove ? bestMoveTacticalContext(bestMove) : {}),
      })
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

function schedulePostCpuAssists() {
  const historyLength = moveHistory.length;
  // WASMエンジンはメインスレッドで動く。CPUの駒を描画した次のフレームまで待ってから、
  // 必要な序盤補助だけを短時間で解析する。
  requestAnimationFrame(() => {
    setTimeout(() => {
      if (
        !active.value || reviewMode.value || moveHistory.length !== historyLength
        || record.value.position.color !== humanColor.value
      ) return;
      if (coachLevel.value === "detailed" && findMateInOne(currentSfen.value)) {
        showCoachAdvice(getCoachAdvice({
          level: coachLevel.value,
          score: { type: "mate", value: 1 },
        }));
      }
      scheduleOpeningGuideSafety();
      scheduleOpeningFollowupCandidates();
      schedulePlayerIdleAdvice();
    }, 0);
  });
}

function sideToMoveRookCaptureTargets(position: Position): Set<string> {
  return new Set(enumerateLegalMoves(position)
    .filter(({ capturedPieceType }) => capturedPieceType === PieceType.ROOK)
    .map(({ to }) => to.usi));
}

function sideToMoveHasCheckingMove(position: Position): boolean {
  return enumerateLegalMoves(position).some((candidate) => {
    const next = position.clone();
    const move = next.createMoveByUSI(candidate.usi);
    return Boolean(move && next.doMove(move) && next.checked);
  });
}

function bestMoveTacticalContext(usi: string) {
  const position = record.value.position;
  const move = position.createMoveByUSI(usi);
  if (!move) return {};

  // 相手が今すぐ実行できる合法手だけを脅威として扱う。
  const opponentPosition = position.clone();
  opponentPosition.setColor(reverseColor(position.color));
  const threatenedRooks = sideToMoveRookCaptureTargets(opponentPosition);
  const rookUnderThreat = threatenedRooks.size > 0;
  const opponentHasCheckingMove = sideToMoveHasCheckingMove(opponentPosition);

  const preview = position.clone();
  const applied = preview.doMove(preview.createMoveByUSI(usi)!);
  const givesCheck = applied && preview.checked;
  const movedThreatenedRook = move.from instanceof Square && threatenedRooks.has(move.from.usi);
  const rookCaptureTargetsAfterMove = applied
    ? sideToMoveRookCaptureTargets(preview)
    : new Set<string>();
  const bestMoveSavesRook = movedThreatenedRook
    && applied
    && !rookCaptureTargetsAfterMove.has(move.to.usi);
  const ownCamp = move.color === Color.BLACK ? move.to.rank >= 7 : move.to.rank <= 3;
  const enemyCamp = move.color === Color.BLACK ? move.to.rank <= 3 : move.to.rank >= 7;
  const bestMoveIsDefensive = !move.capturedPieceType && (
    move.pieceType === PieceType.KING
    || (ownCamp && (move.pieceType === PieceType.GOLD || move.pieceType === PieceType.SILVER))
  );

  return {
    bestMoveIsKingMove: move.pieceType === PieceType.KING,
    bestMoveGivesCheck: givesCheck,
    bestMoveIsDefensive,
    bestMoveIsAttacking: Boolean(
      givesCheck || move.capturedPieceType || move.promote || enemyCamp,
    ),
    rookUnderThreat,
    bestMoveSavesRook,
    opponentHasCheckingMove,
  };
}

function moveSoundUrl(fileName: string): string {
  return `${props.assetBaseUrl.replace(/\/$/, "")}/audio/${fileName}`;
}

function ensureMoveSounds(): MoveSoundTemplates | null {
  if (moveSoundTemplates || typeof Audio === "undefined") return moveSoundTemplates;
  moveSoundTemplates = {
    normal: new Audio(moveSoundUrl("komaoto_normal.mp3")),
    strong: new Audio(moveSoundUrl("komaoto_strong.mp3")),
  };
  for (const audio of Object.values(moveSoundTemplates)) {
    audio.preload = "auto";
    audio.load();
  }
  return moveSoundTemplates;
}

function playMoveSound(kind: MoveSoundKind) {
  const template = ensureMoveSounds()?.[kind];
  if (!template) return;
  const audio = template.cloneNode(true) as HTMLAudioElement;
  void audio.play().catch(() => undefined);
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
          // 閃きと同じ高精度の解析結果を共有し、異なる手を勧めない。
          const settings = getIdleCoachSearchSettings(
            props.mobile || boardLayout.value === "portrait",
          );
          const candidates = await analyzeCoachPosition(
            settings.nodes,
            settings.maxTimeMs,
            settings.multiPv,
          );
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
      const mateThreatResult = coachLevel.value === "detailed" && isPlayerTurn && !inCheck
        ? detectStrictMateThreat(currentSfen.value, 7, budget.threatNodes)
        : null;
      const mateThreat = mateThreatResult?.isThreat ?? false;
      const bestMove = candidates.find((candidate) => candidate.rank === 1)?.move;
      const riskAdvice = coachLevel.value === "detailed" && isPlayerTurn
        ? getCandidateRiskAdvice(normalizedCandidates, {
            inCheck,
            mateThreat,
            mateThreatChecked: mateThreatResult !== null && !mateThreatResult.exhausted,
            moveCount: moveCount.value,
            ...(bestMove ? bestMoveTacticalContext(bestMove) : {}),
          })
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
  persistMatchState();
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
  const detourCandidate = actor === "player"
    ? openingGuideDetourCandidates.value.find(({ usi: candidateUsi }) => candidateUsi === usi)
    : undefined;
  const followedOpeningDecision = actor === "player" && openingGuideDecision.value?.usi === usi
    ? openingGuideDecision.value
    : detourCandidate
      ? {
          usi,
          source: detourCandidate.guideKind === "ai" ? "ai" as const : "plan" as const,
          phase: openingGuideDecision.value?.phase,
        }
      : null;
  const reusedHint = actor === "player" && latestHintAnalysis?.historyLength === moveHistory.length
    ? hintMoveAssessment(latestHintAnalysis.candidates, usi)
    : null;
  const move = active.value ? record.value.position.createMoveByUSI(usi) : null;
  if (!move || !record.value.append(move)) return false;
  syncPosition(usi);
  moveHistory.push(usi);
  if (actor === "player") {
    const enemyCamp = move.color === Color.BLACK ? move.to.rank <= 3 : move.to.rank >= 7;
    playerMoveFlair = {
      historyLength: moveHistory.length,
      wasPromotion: move.promote,
      wasEnemyCampDrop: usi.includes("*") && enemyCamp,
    };
    if (followedOpeningDecision?.source === "ai") {
      openingGuideDetourCount.value += 1;
      if (shouldAbandonOpeningGuide(openingGuideDetourCount.value)) {
        selectedStrategy.value = "";
        selectedCastle.value = "";
        openingGuideAbandoned.value = true;
        guideText.value = coachLevel.value === "off"
          ? ""
          : "3手寄り道したけれど、この形へ戻るのは難しそうだね。ここで中断して、別の戦法や囲いを選び直そう！";
      }
    } else if (followedOpeningDecision?.source === "plan") {
      // 予定手へ復帰できたら、寄り道の連続数を数え直す。
      openingGuideDetourCount.value = 0;
    }
    playerMoveHintAssessment = reusedHint ? {
      historyLength: moveHistory.length,
      beforeScore: reusedHint.beforeScore,
      afterScore: reusedHint.afterScore,
    } : undefined;
    latestHintAnalysis = undefined;
  }
  resetOpeningGuideSafety();
  hintCandidates.value = [];
  openingFollowupCandidates.value = [];
  hintText.value = "";
  if (!reviewMode.value) {
    emit("match-move", { usi, actor, moveCount: moveCount.value, sfen: currentSfen.value });
    const terminalResult = resultAfterMove(record.value);
    playMoveSound(selectMoveSound(
      move.capturedPieceType,
      terminalResult?.reason === "checkmate" || isSideToMoveInCheck(currentSfen.value),
    ));
    if (terminalResult) finish(terminalResult);
    else persistMatchState();
  }
  return true;
}

async function showHint() {
  if (!canUseHint.value || !engine) return;
  thinking.value = true;
  hintText.value = "やこび姫が候補手を考えています…";
  try {
    await dedicatedCoachQueue.catch(() => undefined);
    const hintSearch = getHintSearchSettings(props.mobile || boardLayout.value === "portrait");
    const candidates = await analyzeCoachPosition(
      hintSearch.nodes,
      hintSearch.maxTimeMs,
      hintSearch.multiPv,
    );
    latestHintAnalysis = {
      historyLength: moveHistory.length,
      candidates: candidates
        .filter(({ rank, move, score }) => (
          Number.isInteger(rank) && typeof move === "string"
          && (score?.type === "cp" || score?.type === "mate")
          && Number.isFinite(score.value)
        ))
        .map(({ rank, move, score }) => ({
          rank,
          move,
          score: score as EngineEvaluation,
        })),
    };
    const hintBestScore = latestHintAnalysis.candidates.find(({ rank }) => rank === 1)?.score;
    if (!reviewMode.value && record.value.position.color === humanColor.value && hintBestScore) {
      playerTurnScore = hintBestScore;
      playerTurnScoreHistoryLength = moveHistory.length;
    }
    const search = { move: candidates.find(({ rank }) => rank === 1)?.move ?? "", candidates };
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
  const { nextRecord, nextFormationState } = recordAndFormationsFromMoves(moves);
  record.value = nextRecord;
  formationState.value = nextFormationState;
  moveHistory = [...moves];
  syncPosition(moveHistory.at(-1) ?? "");
}

function undoTurn() {
  if (!canUndo.value) return;
  cancelPlayerIdleAdvice();
  coachAdviceScheduler.reset();
  if (cpuTimer) clearTimeout(cpuTimer);
  if (reviewMode.value) reviewCpuGeneration += 1;
  openingPlanCompletionLocked.value = false;
  const removeCount = (reviewMode.value && reviewCpuEnabled.value)
    || (!reviewMode.value && normalizedMode.value === "cpu" && moveHistory.length >= 2)
    ? 2
    : 1;
  if (reviewMode.value) {
    reviewNavigation.value = rewindReviewMoves(
      reviewNavigation.value,
      removeCount,
      reviewCpuStartedAtPly.value,
    );
    rebuildRecord(visibleReviewMoves(reviewNavigation.value));
  } else {
    rebuildRecord(moveHistory.slice(0, -removeCount));
  }
  if (openingPlanCurrentlyComplete.value) openingPlanCompletionLocked.value = true;
  if (!reviewMode.value) undosRemaining.value -= 1;
  playerTurnScore = undefined;
  playerTurnScoreHistoryLength = -1;
  latestHintAnalysis = undefined;
  playerMoveHintAssessment = undefined;
  playerMoveFlair = undefined;
  hintCandidates.value = [];
  resetOpeningFollowup();
  resetOpeningGuideSafety();
  openingGuideDetourCount.value = 0;
  openingGuideAbandoned.value = false;
  hintText.value = "";
  guideText.value = coachLevel.value === "off" ? "" : UNDO_GUIDE_TEXT;
  if (reviewMode.value) {
    scheduleReviewCpuMove();
  } else {
    scheduleOpeningGuideSafety();
    schedulePlayerIdleAdvice();
    persistMatchState();
  }
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
  reviewCpuStartedAtPly.value = moveHistory.length;
  reviewCpuEnabled.value = true;
  analysisOpen.value = false;
  hintCandidates.value = [];
  hintText.value = "";
  guideText.value = coachLevel.value === "off"
    ? ""
    : "ここから相手をするね。閃きと待ったは何度でも使えるよ！";
  scheduleReviewCpuMove();
}

function stopReviewCpu() {
  if (!reviewCpuEnabled.value) return;
  coachAdviceScheduler.reset();
  reviewCpuEnabled.value = false;
  reviewCpuStartedAtPly.value = 0;
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
          { maxScoreLoss: strength.maxScoreLoss, scoreTemperature: strength.scoreTemperature, bestMoveRate: strength.bestMoveRate },
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
      const reusedHintAssessment = playerMoveHintAssessment?.historyLength === playerMoveHistoryLength
        ? playerMoveHintAssessment
        : undefined;
      playerMoveHintAssessment = undefined;
      const moveFlair = playerMoveFlair?.historyLength === playerMoveHistoryLength
        ? playerMoveFlair
        : undefined;
      playerMoveFlair = undefined;
      const comparableBeforeScore = reusedHintAssessment?.beforeScore
        ?? (playerTurnScoreHistoryLength === playerMoveHistoryLength - 1
          ? playerTurnScore
          : undefined);
      const openingMove = strategyMove();
      const allowedCpuMoves = cpuMovesAllowedByBishopSetting();
      const allowedCpuMoveIds = new Set(allowedCpuMoves.map(({ usi: moveUsi }) => moveUsi));
      const allowedOpeningMove = openingMove && allowedCpuMoveIds.has(openingMove)
        ? openingMove
        : undefined;
      const cpuOpeningTurn = currentCpuOpeningTurn();
      const forceConfiguredOpening = shouldForceConfiguredCpuOpening({
        configuredFirstMove: cpuFirstMove.value,
        bishopPreference: cpuBishopPreference.value,
        openingMove: allowedOpeningMove,
        cpuColor: cpuOpeningTurn.cpuColor,
        cpuMoveCount: cpuOpeningTurn.cpuMoves.length,
        cpuMoves: cpuOpeningTurn.cpuMoves,
      });
      // 入門だけは定跡の形を優先する。それ以外は定跡手も探索で安全確認する。
      if (allowedOpeningMove && usesRandomLegalMove(searchNodes.value)) {
        usi = allowedOpeningMove;
      } else if (usesRandomLegalMove(searchNodes.value)) {
        usi = allowedCpuMoves[Math.floor(Math.random() * allowedCpuMoves.length)]?.usi ?? "";
      } else if (engine && engineReady.value) {
        const strength = getStrengthSearchSettings(searchNodes.value);
        engine.applyStrengthOptions({ multiPv: strength.multiPv });
        const base = props.initialSfen === STANDARD_SFEN
          ? "startpos"
          : `sfen ${props.initialSfen}`;
        engine.setPosition(`${base}${moveHistory.length ? ` moves ${moveHistory.join(" ")}` : ""}`);
        const search = await engine.go({
          nodes: strength.nodes,
          maxTimeMs: 60000,
          searchMoves: [...allowedCpuMoveIds],
        });
        const bestCpuScore = search.candidates.find((candidate) => candidate.rank === 1)?.score;
        moveFeedback = getMoveFeedback({
          level: coachLevel.value,
          beforeScore: comparableBeforeScore,
          // 閃き候補を指した場合は、深さの違う再探索と混ぜず同じ探索内で比較する。
          afterScore: reusedHintAssessment?.afterScore ?? scoreForPlayer(
              bestCpuScore,
              record.value.position.color,
              humanColor.value,
            ),
          wasPromotion: moveFlair?.wasPromotion,
          wasEnemyCampDrop: moveFlair?.wasEnemyCampDrop,
        });
        // この評価は、CPU着手ではなく直前のプレイヤー着手に対するもの。
        // CPUの駒を動かす前に表示を確定し、相手の手への反応に見えないようにする。
        if (moveFeedback) {
          showCoachAdvice(moveFeedback);
          await nextTick();
        }
        const safeOpening = allowedOpeningMove && !forceConfiguredOpening
          ? chooseSafeOpeningMove(allowedOpeningMove, search.candidates, Math.min(250, strength.maxScoreLoss))
          : null;
        const selection = forceConfiguredOpening && allowedOpeningMove
          ? { move: allowedOpeningMove }
          : safeOpening
          ? {
              move: safeOpening.usi,
              rank: search.candidates.find(({ move }) => move === safeOpening.usi)?.rank ?? 1,
            }
          : selectMoveByRank(
              search,
              strength.moveRank,
              Math.random,
              { maxScoreLoss: strength.maxScoreLoss, scoreTemperature: strength.scoreTemperature, bestMoveRate: strength.bestMoveRate },
            );
        usi = selection.move;
        selectedCpuScore = search.candidates.find(
          (candidate) => candidate.move === selection.move,
        )?.score;
      } else {
        // エンジンが利用できない簡易CPUでは評価比較ができないため、合法な定跡手を優先する。
        usi = allowedOpeningMove
          ?? allowedCpuMoves[Math.floor(Math.random() * allowedCpuMoves.length)]?.usi
          ?? "";
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
        schedulePostCpuAssists();
      }
      thinking.value = false;
    } catch (error) {
      thinking.value = false;
      const message = error instanceof Error ? error.message : String(error);
      errorMessage.value = `やねうら王の思考に失敗しました: ${message}`;
      emit("match-error", { message });
      const fallbackOpeningMove = strategyMove();
      const fallbackUsi = fallbackOpeningMove ?? selectCpuMove(record.value.position)?.usi;
      if (fallbackUsi && applyMove(fallbackUsi, "cpu") && active.value) {
        updateCoachAdvice();
        schedulePostCpuAssists();
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
    scheduleOpeningGuideSafety();
    scheduleOpeningFollowupCandidates();
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

function completeReview() {
  if (!reviewMode.value) return;
  openPregame();
}

function enterAnalysisMode(message = "棋譜を一緒に振り返ってみよう！") {
  if (cpuTimer) clearTimeout(cpuTimer);
  cancelPlayerIdleAdvice();
  coachAdviceScheduler.reset();
  reviewCpuGeneration += 1;
  reviewCpuEnabled.value = false;
  reviewCpuStartedAtPly.value = 0;
  resultDialogOpen.value = false;
  reviewMode.value = true;
  reviewNavigation.value = createReviewNavigation(moveHistory);
  active.value = true;
  thinking.value = false;
  hintCandidates.value = [];
  resetOpeningFollowup();
  resetOpeningGuideSafety();
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
  reviewCpuStartedAtPly.value = 0;
  analysisGeneration += 1;
  if (analysisRunning.value) engine?.stop();
  matchStarted.value = true;
  pregameOpen.value = false;
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
  latestHintAnalysis = undefined;
  playerMoveHintAssessment = undefined;
  playerMoveFlair = undefined;
  cpuOpeningPlan = null;
  positionAnalysisCache.clear();
  moveHistory = [];
  selectedStrategy.value = "";
  selectedCastle.value = "";
  strategyExplanationOpen.value = false;
  openingGuideStartedAtPly.value = 0;
  openingGuideDetourCount.value = 0;
  openingGuideAbandoned.value = false;
  openingPlanCompletionLocked.value = false;
  openingGuideBranchNotice.value = "";
  openingGuideBranchNoticePly.value = -1;
  resetOpeningFollowup();
  resetOpeningGuideSafety();
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
  scheduleOpeningGuideSafety();
  schedulePlayerIdleAdvice();
  persistMatchState();
}

watch(
  () => [props.initialSfen, props.mode],
  () => {
    if (matchStarted.value) restart();
  },
);
watch(() => props.playerColor, (value) => {
  activePlayerColor.value = normalizePlayerColor(value);
  selectedPlayerColor.value = activePlayerColor.value;
  if (matchStarted.value) restart();
});
watch(() => props.engineNodes, (value) => {
  searchNodes.value = normalizeNodes(value);
});
watch([
  cpuStrategy,
  cpuDetailedStrategy,
  cpuDetailedCastle,
  cpuFirstMove,
  cpuBishopPreference,
  cpuRookPreference,
  cpuTempoPreference,
  cpuStrategyDetailsOpen,
], () => {
  cpuOpeningPlan = null;
});
watch([
  activePlayerColor,
  selectedPlayerColor,
  searchNodes,
  cpuStrategy,
  cpuDetailedStrategy,
  cpuDetailedCastle,
  cpuFirstMove,
  cpuBishopPreference,
  cpuRookPreference,
  cpuTempoPreference,
  cpuStrategyDetailsOpen,
  coachLevel,
  selectedStrategy,
  selectedCastle,
  hintsRemaining,
  undosRemaining,
  openingGuideStartedAtPly,
  openingGuideDetourCount,
  openingGuideAbandoned,
  openingPlanCompletionLocked,
], persistMatchState);
watch([selectedPlayerColor, cpuDetailedStrategy], () => {
  const detailedOptions = cpuDetailedStrategyGroups.value.flatMap(({ options }) => options);
  if (cpuDetailedStrategy.value && !detailedOptions.some(({ id }) => id === cpuDetailedStrategy.value)) {
    cpuDetailedStrategy.value = detailedOptions[0]?.id ?? "ibisha";
  }
  const castleOptions = cpuDetailedCastleGroups.value.flatMap(({ options }) => options);
  if (cpuDetailedCastle.value && !castleOptions.some(({ id }) => id === cpuDetailedCastle.value)) {
    cpuDetailedCastle.value = castleOptions[0]?.id ?? "funagakoi";
  }
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
function handlePageHide() {
  persistMatchState();
}
onBeforeUnmount(() => {
  cancelPlayerIdleAdvice();
  coachAdviceScheduler.reset();
  analysisGeneration += 1;
  reviewCoachGeneration += 1;
  reviewCpuGeneration += 1;
  if (cpuTimer) clearTimeout(cpuTimer);
  engine?.quit();
  boardResizeObserver?.disconnect();
  if (typeof window !== "undefined") window.removeEventListener("pagehide", handlePageHide);
});
onMounted(() => {
  for (const filename of Object.values(COACH_EXPRESSION_FILES)) {
    const portrait = new Image();
    portrait.src = `${props.assetBaseUrl}/characters/${filename}?v=${COACH_EXPRESSION_ASSET_VERSION}`;
  }
  ensureMoveSounds();
  updateResponsiveLayout();
  boardResizeObserver = new ResizeObserver(updateResponsiveLayout);
  if (boardShell.value) boardResizeObserver.observe(boardShell.value);
  window.addEventListener("pagehide", handlePageHide);
});

const restoredPersistedMatch = restorePersistedMatch();
queueMicrotask(() => {
  observeFormations(currentSfen.value);
  if (restoredPersistedMatch) {
    emit("match-ready", { mode: normalizedMode.value, sfen: currentSfen.value, restored: true });
  }
  initializeEngine();
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
.shogi-game__command--complete {
  color: #25151a;
  background: linear-gradient(#f7d58b, #d49a43);
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
  display: flex;
  max-height: 100%;
  min-width: 0;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.6rem;
  overflow: auto;
  border: 2px solid var(--gold);
  background: linear-gradient(155deg, rgba(69, 29, 40, 0.98), rgba(34, 18, 23, 0.98));
  box-shadow: inset 0 0 1.5rem rgba(110, 34, 53, 0.42);
}
.shogi-game__opening-guide--portrait {
  display: none;
}
.shogi-game__opening-guide h2 {
  margin: 0;
  color: #f4d890;
  font-size: 0.9rem;
  text-align: center;
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
.shogi-game__opening-strategy-field {
  position: relative;
  min-width: 0;
}
.shogi-game__opening-strategy-field > label {
  height: 100%;
}
.shogi-game__opening-explanation-trigger {
  position: absolute;
  z-index: 1;
  top: 0;
  right: 0;
  min-width: 2.5rem !important;
  min-height: 1.15rem !important;
  padding: 0.05rem 0.32rem !important;
  border-color: rgba(215, 206, 255, 0.6) !important;
  border-radius: 0.15rem !important;
  color: #f7f1ff !important;
  background: rgba(46, 74, 96, 0.9) !important;
  box-shadow: none !important;
  font-size: 0.65rem !important;
  line-height: 1 !important;
}
.shogi-game__opening-explanation {
  position: absolute;
  z-index: 95;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(7, 18, 26, 0.78);
  backdrop-filter: blur(0.2rem);
}
.shogi-game__opening-explanation-panel {
  width: min(31rem, 100%);
  max-height: calc(100% - 1rem);
  overflow-y: auto;
  padding: 1.1rem;
  border: 1px solid rgba(245, 166, 69, 0.78);
  border-top: 4px solid var(--amber);
  color: var(--ivory);
  background: var(--slate);
  box-shadow: 0 1rem 2.5rem rgba(7, 18, 26, 0.58);
}
.shogi-game__opening-explanation-panel small {
  color: var(--amber);
  font-weight: 700;
}
.shogi-game__opening-explanation-panel h2 {
  margin: 0.15rem 0 0.7rem;
  color: var(--ivory);
}
.shogi-game__opening-explanation-panel p {
  margin: 0 0 0.8rem;
  line-height: 1.7;
}
.shogi-game__opening-explanation-panel dl {
  display: grid;
  gap: 0.55rem;
  margin: 0;
}
.shogi-game__opening-explanation-panel dl > div {
  padding: 0.65rem;
  border-left: 3px solid var(--lavender);
  background: rgba(20, 39, 54, 0.72);
}
.shogi-game__opening-explanation-panel dt {
  margin-bottom: 0.2rem;
  color: var(--amber);
  font-weight: 800;
}
.shogi-game__opening-explanation-panel dd {
  margin: 0;
  line-height: 1.6;
}
.shogi-game__opening-explanation-panel > button {
  display: block;
  min-width: 7rem;
  margin: 0.9rem 0 0 auto;
  padding: 0.5rem 0.9rem;
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
.shogi-game__rook-choice {
  display: grid;
  gap: 0.35rem;
  padding: 0.45rem;
  border: 1px solid rgba(244, 216, 144, 0.65);
  color: #fff8ee;
  background: rgba(96, 54, 22, 0.34);
  font-size: 0.72rem;
}
.shogi-game__rook-choice > span {
  color: #f4d890;
  font-weight: 700;
}
.shogi-game__rook-choice > div {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.3rem;
}
.shogi-game__rook-choice button {
  min-width: 0;
  padding: 0.3rem 0.25rem;
  border: 1px solid rgba(85, 191, 233, 0.72);
  border-radius: 0.2rem;
  color: #f7f5ff;
  background: rgba(22, 83, 112, 0.82);
  font: inherit;
  cursor: pointer;
}
.shogi-game__rook-choice button:first-child {
  border-color: #f0b45e;
  background: rgba(124, 68, 24, 0.9);
}
.shogi-game__opening-guide p {
  margin: 0;
  padding: 0.4rem 0.5rem;
  border-left: 3px solid #55bfe9;
  color: #f7eee8;
  background: rgba(7, 80, 116, 0.23);
  font-size: 0.74rem;
  line-height: 1.35;
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
.shogi-game__portrait--advisor .shogi-game__character {
  object-position: center top;
}
.shogi-game__match-summary,
.shogi-game__player-card,
.shogi-game__status,
.shogi-game__dialogue {
  z-index: 1;
  box-sizing: border-box;
  border: 2px solid var(--gold);
  background: var(--panel);
  box-shadow: inset 0 0 1.5rem rgba(110, 34, 53, 0.35);
}
.shogi-game__match-summary {
  z-index: 1;
  display: grid;
  min-width: 0;
  gap: 0.45rem;
  padding: 0.55rem 0.7rem;
}
.shogi-game__match-summary-status {
  display: flex;
  min-width: 0;
  gap: 0.5rem;
  align-items: baseline;
  justify-content: space-between;
}
.shogi-game__match-summary-status strong {
  min-width: 0;
  overflow: hidden;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.shogi-game__match-summary-status span {
  flex: none;
  color: #d5c3bd;
  font-size: 0.75rem;
}
.shogi-game__formation-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
  padding-top: 0.4rem;
  border-top: 1px solid rgba(216, 173, 85, 0.55);
}
.shogi-game__formation-summary > div {
  display: grid;
  min-width: 0;
  gap: 0.1rem;
}
.shogi-game__formation-summary b {
  color: #f4d890;
  font-size: 0.68rem;
}
.shogi-game__formation-summary span {
  min-width: 0;
  overflow: hidden;
  font-size: 0.76rem;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
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
.shogi-game__pregame {
  position: absolute;
  z-index: 100;
  inset: 0;
  display: grid;
  place-items: center;
  padding: clamp(1rem, 4vw, 3rem);
  background:
    radial-gradient(circle at 72% 24%, rgba(255, 169, 185, 0.32), transparent 35%),
    linear-gradient(135deg, rgba(26, 10, 16, 0.96), rgba(105, 28, 47, 0.96));
  backdrop-filter: blur(0.25rem);
}
.shogi-game__pregame-panel {
  width: min(44rem, 100%);
  padding: clamp(1.2rem, 3vw, 2.25rem);
  border: 2px solid var(--gold);
  border-radius: 1rem;
  color: #fff5e8;
  background: linear-gradient(160deg, rgba(62, 26, 36, 0.98), rgba(31, 15, 21, 0.98));
  box-shadow: 0 1.2rem 3.5rem rgba(0, 0, 0, 0.48), inset 0 0 2rem rgba(255, 183, 197, 0.08);
}
.shogi-game__pregame-heading {
  margin-bottom: 1.25rem;
  text-align: center;
}
.shogi-game__pregame-heading > span {
  color: #f4d890;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.18em;
}
.shogi-game__pregame-heading h2 {
  margin: 0.35rem 0 0;
  font-size: clamp(1.35rem, 3vw, 2rem);
}
.shogi-game__pregame-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
}
.shogi-game__pregame-field {
  display: grid;
  gap: 0.4rem;
  min-width: 0;
  padding: 0.75rem;
  border: 1px solid rgba(240, 196, 95, 0.58);
  border-radius: 0.55rem;
  background: rgba(16, 8, 12, 0.38);
}
.shogi-game__pregame-field span {
  color: #f7d88f;
  font-weight: 700;
}
.shogi-game__pregame-field select {
  box-sizing: border-box;
  width: 100%;
  min-height: 2.8rem;
  padding: 0.45rem 0.6rem;
  border: 1px solid #d9a84f;
  border-radius: 0.4rem;
  color: #2b1618;
  background: #fff9ea;
  font: inherit;
}
.shogi-game__pregame-control {
  display: grid;
  gap: 0.4rem;
  min-width: 0;
}
.shogi-game__pregame-control--sub {
  padding-top: 0.65rem;
  border-top: 1px solid rgba(240, 196, 95, 0.3);
}
.shogi-game__strategy-setting {
  display: grid;
  gap: 0.65rem;
  min-width: 0;
}
.shogi-game__strategy-setting select {
  width: 100% !important;
}
.shogi-game__strategy-toggle {
  justify-self: end;
  min-width: 4.7rem;
  margin-top: 0.15rem;
  padding: 0.28rem 0.55rem !important;
  white-space: nowrap;
  font-size: 0.78rem !important;
  opacity: 0.9;
}
.shogi-game__strategy-details {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
}
.shogi-game__strategy-details label {
  display: grid;
  gap: 0.28rem;
  min-width: 0;
}
.shogi-game__strategy-details label > span {
  font-size: 0.78rem;
  font-weight: 600;
  opacity: 0.86;
}
.shogi-game__pregame-field--opening-tendency {
  grid-column: 1 / -1;
}
.shogi-game__opening-tendency {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.55rem;
}
.shogi-game__opening-tendency label {
  display: grid;
  gap: 0.28rem;
  min-width: 0;
}
.shogi-game__opening-tendency label > span {
  font-size: 0.78rem;
  font-weight: 600;
  opacity: 0.86;
}
.shogi-game__pregame-field--opening-tendency > small {
  color: #d5c3bd;
  font-size: 0.75rem;
}
.shogi-game__pregame-note {
  min-height: 1.5rem;
  margin: 1rem 0 0;
  color: #dccbc5;
  text-align: center;
}
.shogi-game__pregame-start {
  display: block;
  width: min(18rem, 100%);
  min-height: 3.25rem;
  margin: 1rem auto 0;
  border-color: #ffe39b !important;
  color: #fff9e9 !important;
  background: linear-gradient(#ae3f58, #681d31) !important;
  box-shadow: 0 0 1.1rem rgba(255, 166, 184, 0.28);
  font-size: 1.1rem !important;
  font-weight: 800;
}
.shogi-game__settings {
  position: absolute;
  z-index: 20;
  top: 4.5rem;
  right: 1rem;
  width: min(20rem, calc(100% - 2rem));
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
  grid-template-columns: 1fr;
  gap: 0.65rem;
}
.shogi-game__settings-actions {
  display: flex;
  gap: 0.6rem;
  justify-content: flex-end;
  margin-top: 0.8rem;
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
.shogi-game__strength .shogi-game__strategy-setting {
  width: min(20rem, 72%);
}
.shogi-game__strength--strategy {
  align-items: start;
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
  .shogi-game__pregame {
    padding: 0.65rem;
  }
  .shogi-game__pregame-panel {
    max-height: 100%;
    padding: 0.9rem;
    overflow: auto;
  }
  .shogi-game__pregame-heading {
    margin-bottom: 0.7rem;
  }
  .shogi-game__pregame-grid {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
  .shogi-game__pregame-field {
    grid-template-columns: 8rem minmax(0, 1fr);
    align-items: center;
    padding: 0.45rem 0.55rem;
  }
  .shogi-game__pregame-field--turn {
    grid-template-columns: 1fr;
  }
  .shogi-game__pregame-field--opening-tendency {
    grid-template-columns: 1fr;
  }
  .shogi-game__opening-tendency {
    grid-template-columns: 1fr;
  }
  .shogi-game__pregame-control {
    grid-template-columns: 8rem minmax(0, 1fr);
    align-items: center;
  }
  .shogi-game__pregame-note {
    margin-top: 0.65rem;
  }
  .shogi-game__pregame-start {
    min-height: 2.8rem;
    margin-top: 0.65rem;
  }
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
    grid-template-rows: auto minmax(0, 1fr);
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
  .shogi-game__player-zone--opponent .shogi-game__match-summary {
    grid-column: 1;
    grid-row: 1;
  }
  .shogi-game__opening-guide {
    display: flex;
    grid-column: 1;
    grid-row: 2;
    align-self: end;
    max-height: 100%;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.6rem;
    overflow: auto;
    border: 2px solid var(--gold);
    background: linear-gradient(155deg, rgba(69, 29, 40, 0.98), rgba(34, 18, 23, 0.98));
    box-shadow: inset 0 0 1.5rem rgba(110, 34, 53, 0.42);
  }
  .shogi-game__opening-guide h2 {
    margin: 0;
    color: #f4d890;
    font-size: 0.9rem;
    text-align: center;
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
    padding: 0.4rem 0.5rem;
    border-left: 3px solid #55bfe9;
    color: #f7eee8;
    background: rgba(7, 80, 116, 0.23);
    font-size: 0.74rem;
    line-height: 1.35;
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
    grid-template-columns: minmax(0, 0.85fr) minmax(0, 0.75fr) minmax(12rem, 1.25fr);
    min-height: 0;
    padding-right: 0;
  }
  .shogi-game__match-summary {
    grid-column: 1 / 3;
    grid-row: 1;
    align-self: stretch;
  }
  .shogi-game__opening-guide {
    grid-column: 3;
    grid-row: 1;
    align-self: stretch;
    gap: 0.25rem;
    padding: 0.35rem;
  }
  .shogi-game__opening-guide h2 {
    font-size: 0.72rem;
  }
  .shogi-game__opening-selects {
    gap: 0.25rem;
  }
  .shogi-game__opening-selects label,
  .shogi-game__opening-guide p {
    font-size: 0.68rem;
  }
  .shogi-game__opening-selects select {
    padding: 0.18rem;
  }
  .shogi-game__opening-guide p {
    padding: 0.22rem 0.35rem;
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
    grid-template-rows: 3.25rem 9.5rem minmax(0, 1fr) 6.5rem;
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
    grid-template-rows: 4.5rem minmax(0, 1fr);
    min-height: 0;
    padding-right: 0;
  }
  .shogi-game__match-summary {
    grid-column: 1 / -1;
    padding: 0.35rem 0.5rem;
    gap: 0.25rem;
  }
  .shogi-game__match-summary-status strong {
    font-size: 0.85rem;
  }
  .shogi-game__formation-summary {
    gap: 0.4rem;
    padding-top: 0.25rem;
  }
  .shogi-game__player-zone--player {
    grid-template-columns: minmax(0, 1fr) 4.8rem;
    grid-template-rows: 1fr;
    min-height: 0;
    padding-left: 4.5rem;
  }
  .shogi-game__portrait {
    width: 4.25rem;
    height: 4.5rem;
  }
  .shogi-game__portrait--advisor {
    width: 4.5rem;
    height: 6.5rem;
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
    grid-column: 2;
    grid-row: 1;
    flex-direction: column;
    flex-wrap: nowrap;
    gap: 0.2rem;
  }
  .shogi-game__assist-actions button {
    flex: 1;
    min-height: 0;
    padding: 0.2rem 0.3rem;
    font-size: 0.72rem;
  }
  .shogi-game__dialogue {
    display: flex;
    grid-column: 1;
    grid-row: 1;
    gap: 0.35rem;
    min-height: 0;
    max-height: none;
    padding: 0.4rem 0.5rem;
    overflow: auto;
    font-size: 0.78rem;
    line-height: 1.25;
  }
  .shogi-game__dialogue-icon {
    width: 1rem;
    height: 1.3rem;
  }
  .shogi-game__opening-guide {
    grid-column: 1 / -1;
    grid-row: 2;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-rows: auto minmax(0, 1fr);
    gap: 0.2rem 0.35rem;
    padding: 0.3rem;
  }
  .shogi-game__opening-guide h2 {
    display: none;
  }
  .shogi-game__opening-selects {
    grid-column: 1;
    grid-row: 1;
  }
  .shogi-game__opening-guide p {
    grid-column: 1 / -1;
    grid-row: 2;
    min-height: 0;
    overflow: auto;
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
  .shogi-game {
    grid-template-rows: 5.5rem 9.5rem minmax(0, 1fr) 6.5rem;
  }
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
@media (min-width: 541px) and (max-width: 899px) and (max-height: 500px) {
  .shogi-game {
    grid-template-rows: 3.25rem 4.25rem minmax(0, 1fr) 5.5rem;
  }
  .shogi-game__player-zone--opponent {
    grid-template-columns: minmax(0, 0.7fr) minmax(0, 0.65fr) minmax(15rem, 1.5fr);
    grid-template-rows: minmax(0, 1fr);
    overflow: hidden;
  }
  .shogi-game__opening-guide {
    height: auto;
    min-height: 0;
    max-height: 100%;
    gap: 0.12rem;
    padding: 0.18rem 0.3rem;
  }
  .shogi-game__opening-guide h2 {
    display: none;
  }
  .shogi-game__opening-selects label,
  .shogi-game__opening-guide p {
    font-size: 0.62rem;
  }
  .shogi-game__opening-guide p {
    padding: 0.12rem 0.25rem;
    line-height: 1.15;
  }
  .shogi-game__player-zone--player {
    padding-left: 5rem;
  }
  .shogi-game__portrait--advisor {
    width: 5rem;
    height: 5.5rem;
  }
  .shogi-game__dialogue {
    padding: 0.3rem 0.5rem;
    font-size: 0.75rem;
  }
  .shogi-game__assist-actions {
    gap: 0.2rem;
  }
  .shogi-game__assist-actions button {
    min-height: 1.6rem;
    padding: 0.15rem 0.25rem;
    font-size: 0.7rem;
  }
}
.shogi-game__opening-guide.shogi-game__opening-guide--portrait {
  display: none;
}
@media (max-aspect-ratio: 5/4) {
  .shogi-game:not(.shogi-game--analysis) {
    grid-template-rows: 3.5rem 5.5rem minmax(0, 1fr) 10rem 5rem;
  }
  .shogi-game:not(.shogi-game--analysis).shogi-game--rook-choice {
    grid-template-rows: 3.5rem 5rem minmax(0, 1fr) 9rem 9rem;
  }
  .shogi-game:not(.shogi-game--analysis) .shogi-game__player-zone--opponent {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .shogi-game:not(.shogi-game--analysis) .shogi-game__opening-guide--primary {
    display: none;
  }
  .shogi-game:not(.shogi-game--analysis) .shogi-game__opening-guide.shogi-game__opening-guide--portrait {
    display: grid;
    grid-column: 1;
    grid-row: 5;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto auto minmax(0, 1fr);
    gap: 0.2rem;
    align-self: stretch;
    min-height: 0;
    padding: 0.3rem;
    overflow-y: auto;
  }
  .shogi-game__opening-guide--portrait h2 {
    display: none;
  }
  .shogi-game__opening-guide--portrait .shogi-game__opening-selects {
    grid-column: 1;
    grid-row: 1;
  }
  .shogi-game__opening-guide--portrait .shogi-game__opening-selects label {
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
  }
  .shogi-game__opening-guide--portrait .shogi-game__rook-choice {
    grid-column: 1;
    grid-row: 2;
  }
  .shogi-game__opening-guide--portrait .shogi-game__rook-choice button {
    min-height: 1.8rem;
  }
  .shogi-game__opening-guide--portrait p {
    grid-column: 1;
    grid-row: 3;
    min-height: 0;
    overflow: visible;
    padding: 0.2rem 0.35rem;
    font-size: 0.68rem;
    line-height: 1.2;
  }
}
@media (max-width: 540px) and (max-aspect-ratio: 5/4) {
  .shogi-game:not(.shogi-game--analysis) {
    grid-template-rows: 3.25rem 4.5rem minmax(0, 1fr) 6.5rem 4.5rem;
  }
  .shogi-game:not(.shogi-game--analysis) .shogi-game__player-zone--opponent {
    grid-template-rows: minmax(0, 1fr);
  }
  .shogi-game:not(.shogi-game--analysis).shogi-game--rook-choice {
    grid-template-rows: 3.25rem 4.5rem minmax(0, 1fr) 6rem 9rem;
  }
}
@media (max-width: 360px) and (max-aspect-ratio: 5/4) {
  .shogi-game:not(.shogi-game--analysis) {
    grid-template-rows: 5.5rem 4.5rem minmax(0, 1fr) 6.5rem 4.5rem;
  }
  .shogi-game:not(.shogi-game--analysis).shogi-game--rook-choice {
    grid-template-rows: 5.5rem 4.5rem minmax(0, 1fr) 6rem 9rem;
  }
}

/* Night-magic theme — based on the supplied navy, amber, ivory and lavender palette. */
.shogi-game {
  --night: #1d3343;
  --night-deep: #142736;
  --slate: #2e4a60;
  --slate-light: #3b5a70;
  --amber: #f5a645;
  --ivory: #fffdf4;
  --lavender: #d7ceff;
  --gold: var(--amber);
  --ink: var(--ivory);
  --panel: rgba(20, 39, 54, 0.94);
  border: 0;
  color: var(--ink);
  background:
    radial-gradient(circle at 8% 18%, rgba(245, 166, 69, 0.16) 0 2px, transparent 3px),
    radial-gradient(circle at 91% 13%, rgba(215, 206, 255, 0.18) 0 2px, transparent 3px),
    radial-gradient(circle at 83% 78%, rgba(255, 253, 244, 0.13) 0 1px, transparent 2px),
    var(--night);
  box-shadow: none;
  font-family: "Yu Gothic", "Hiragino Kaku Gothic ProN", sans-serif;
}
.shogi-game::before {
  background: linear-gradient(135deg, transparent 0 68%, rgba(46, 74, 96, 0.18) 68% 100%);
  opacity: 1;
}
.shogi-game button {
  border: 1px solid rgba(245, 166, 69, 0.68);
  border-radius: 0.2rem;
  color: var(--ivory);
  background: var(--slate);
  box-shadow: 0 2px 0 rgba(10, 25, 35, 0.72);
  font-family: inherit;
  text-shadow: none;
  transition: border-color 120ms ease, background-color 120ms ease, transform 120ms ease;
}
.shogi-game button:not(:disabled):hover {
  border-color: var(--amber);
  background: var(--slate-light);
  transform: translateY(-1px);
}
.shogi-game button:focus-visible,
.shogi-game select:focus-visible,
.shogi-game input:focus-visible {
  outline: 2px solid var(--lavender);
  outline-offset: 2px;
}
.shogi-game button:disabled {
  border-color: rgba(174, 184, 189, 0.28);
  color: rgba(255, 253, 244, 0.45);
  background: #263e50;
  box-shadow: none;
  filter: none;
}
.shogi-game__command {
  clip-path: none;
}
.shogi-game__command--danger {
  border-color: rgba(245, 166, 69, 0.82);
  background: #735036;
}
.shogi-game__command--complete {
  border-color: var(--amber);
  color: var(--night-deep);
  background: var(--amber);
  box-shadow: 0 2px 0 #a96924;
}
.shogi-game__command--settings,
.shogi-game__analysis-button {
  border-color: rgba(215, 206, 255, 0.62) !important;
  background: var(--slate) !important;
  box-shadow: 0 2px 0 rgba(10, 25, 35, 0.72) !important;
}
.shogi-game__turn {
  border: 1px solid rgba(245, 166, 69, 0.72);
  border-radius: 0.2rem;
  color: var(--amber);
  background: var(--night-deep);
}
.shogi-game__match-summary,
.shogi-game__player-card,
.shogi-game__status,
.shogi-game__dialogue,
.shogi-game__opening-guide {
  border: 1px solid rgba(245, 166, 69, 0.5);
  border-left: 3px solid var(--amber);
  color: var(--ivory);
  background: var(--panel);
  box-shadow: none;
}
.shogi-game__opening-guide {
  background: rgba(20, 39, 54, 0.96);
}
.shogi-game__opening-guide h2,
.shogi-game__opening-selects label,
.shogi-game__formation-summary b,
.shogi-game__player-card b,
.shogi-game__settings-title,
.shogi-game__pregame-heading > span,
.shogi-game__pregame-field span {
  color: var(--amber);
}
.shogi-game__player-card > span,
.shogi-game__player-card > small,
.shogi-game__match-summary-status span,
.shogi-game__status span,
.shogi-game__pregame-note {
  color: #becbd2;
}
.shogi-game__player-card > div,
.shogi-game__formation-summary {
  border-top-color: rgba(245, 166, 69, 0.35);
}
.shogi-game__opening-selects select,
.shogi-game__strength select {
  border: 1px solid rgba(245, 166, 69, 0.6);
  border-radius: 0.15rem;
  color: var(--ivory);
  background: var(--night-deep);
}
.shogi-game__opening-guide p {
  border-left-color: var(--lavender);
  color: var(--ivory);
  background: rgba(46, 74, 96, 0.58);
}
.shogi-game__board-shell {
  padding: 0.3rem;
  border: 1px solid rgba(245, 166, 69, 0.64);
  background: var(--night-deep);
  box-shadow: 0 0.45rem 1.2rem rgba(8, 20, 29, 0.38);
}
.shogi-game__pregame {
  background: rgba(20, 39, 54, 0.96);
  backdrop-filter: blur(0.4rem);
}
.shogi-game__pregame-panel {
  border: 1px solid rgba(245, 166, 69, 0.72);
  border-top: 4px solid var(--amber);
  border-radius: 0.3rem;
  color: var(--ivory);
  background: var(--slate);
  box-shadow: 0 1.2rem 3rem rgba(7, 18, 26, 0.52);
}
.shogi-game__pregame-field {
  border: 1px solid rgba(215, 206, 255, 0.24);
  border-radius: 0.2rem;
  background: rgba(20, 39, 54, 0.58);
}
.shogi-game__pregame-field select {
  border: 1px solid rgba(245, 166, 69, 0.68);
  border-radius: 0.15rem;
  color: var(--night-deep);
  background: var(--ivory);
}
.shogi-game__pregame-start {
  border-color: var(--amber) !important;
  color: var(--night-deep) !important;
  background: var(--amber) !important;
  box-shadow: 0 3px 0 #a96924 !important;
}
.shogi-game__settings {
  border: 1px solid rgba(245, 166, 69, 0.72);
  border-top: 3px solid var(--amber);
  border-radius: 0.2rem;
  background: rgba(20, 39, 54, 0.98);
  box-shadow: 0 0.8rem 2rem rgba(7, 18, 26, 0.5);
}
.shogi-game__rematch {
  border-color: var(--amber) !important;
  background: #735036 !important;
  box-shadow: 0 2px 0 rgba(10, 25, 35, 0.72) !important;
}
.shogi-game__awakening {
  border-color: var(--amber) !important;
  color: var(--night-deep) !important;
  background: var(--amber) !important;
  box-shadow: 0 2px 0 #a96924 !important;
  text-shadow: none;
}
.shogi-game__flame-outer { fill: var(--amber); }
.shogi-game__flame-inner { fill: var(--ivory); }
.shogi-game__dialogue-icon {
  filter: drop-shadow(0 0 0.25rem rgba(245, 166, 69, 0.45));
}
.shogi-game__analysis {
  border-color: var(--amber);
  color: var(--night-deep);
  background: var(--ivory);
}
.shogi-game__analysis-info,
.shogi-game__analysis-info select {
  color: var(--night-deep);
}
.shogi-game__analysis-slider input[type="range"] {
  accent-color: var(--amber);
}
.shogi-game__analysis-actions button {
  border-color: var(--slate);
  color: var(--night-deep);
  background: var(--ivory);
  box-shadow: none;
}
.shogi-game__result {
  background: rgba(14, 29, 40, 0.86);
}
.shogi-game__result-panel {
  border-width: 1px;
  border-top-width: 4px;
  border-radius: 0.3rem;
  color: var(--ivory);
  background: var(--night-deep);
  box-shadow: 0 1.2rem 3.2rem rgba(7, 18, 26, 0.62);
}
.shogi-game__result--victory {
  --result-accent: var(--amber);
  --result-glow: rgba(245, 166, 69, 0.18);
}
.shogi-game__result--defeat {
  --result-accent: #d7ceff;
  --result-glow: rgba(215, 206, 255, 0.16);
}
.shogi-game__result--draw {
  --result-accent: #aeb8bd;
  --result-glow: rgba(174, 184, 189, 0.14);
}
.shogi-game__result h2 {
  color: var(--ivory);
  text-shadow: 0 0.15rem 0 var(--slate);
}
.shogi-game__result-details > div {
  border-bottom-color: rgba(245, 166, 69, 0.3);
  background: rgba(46, 74, 96, 0.35);
}
.shogi-game__confetti i { background: var(--amber); }
.shogi-game__confetti i:nth-child(3n) { background: var(--lavender); }
.shogi-game__confetti i:nth-child(3n + 1) { background: var(--ivory); }
.shogi-game__error {
  border-color: #f5a645;
  background: #604634;
}
@media (min-width: 900px) and (min-aspect-ratio: 5/4) {
  .shogi-game { --panel: rgba(20, 39, 54, 0.94); }
  .shogi-game button:disabled {
    border-color: rgba(174, 184, 189, 0.28);
    color: rgba(255, 253, 244, 0.45);
    background: #263e50;
  }
}
@media (min-width: 1100px) and (min-aspect-ratio: 5/4) {
  .shogi-game__portrait--advisor {
    background: linear-gradient(180deg, rgba(29, 51, 67, 0.02) 0 42%, rgba(29, 51, 67, 0.36) 68%, rgba(20, 39, 54, 0.82) 100%);
  }
  .shogi-game__opening-guide {
    border: 1px solid rgba(245, 166, 69, 0.5);
    border-left: 3px solid var(--amber);
    background: rgba(20, 39, 54, 0.96);
    box-shadow: none;
  }
  .shogi-game__opening-guide h2,
  .shogi-game__opening-selects label { color: var(--amber); }
  .shogi-game__opening-selects select {
    border-color: rgba(245, 166, 69, 0.6);
    color: var(--ivory);
    background: var(--night-deep);
  }
  .shogi-game__opening-guide p {
    border-left-color: var(--lavender);
    color: var(--ivory);
    background: rgba(46, 74, 96, 0.58);
  }
}
</style>
