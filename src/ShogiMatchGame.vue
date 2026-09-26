<template>
  <section
    ref="gameRoot"
    class="shogi-game"
    :class="[
      `shogi-game--${uiLayout}`,
      {
        'shogi-game--analysis': reviewMode && analysisOpen,
        'shogi-game--short': uiShort,
        'shogi-game--narrow': uiNarrow,
        'shogi-game--home': homeOpen,
      },
    ]"
    :style="uiLayoutStyle"
    aria-label="将棋対局"
  >
    <div v-if="homeOpen" class="shogi-home" aria-label="ホーム">
      <span
        v-for="star in HOME_STARS"
        :key="star.id"
        class="shogi-home__star"
        :style="star.style"
        aria-hidden="true"
      ></span>
      <span class="shogi-home__moon" aria-hidden="true"></span>
      <img
        class="shogi-home__chara"
        :src="`${assetBaseUrl}/characters/yakobihime-mini.webp?v=2`"
        alt=""
        aria-hidden="true"
      >
      <div class="shogi-home__title">
        <h1>shogi-match</h1>
      </div>
      <nav class="shogi-home__menu" aria-label="メニュー">
        <button type="button" class="shogi-home__card" @click="closeHome">
          <svg class="shogi-home__icon" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
            <g fill="#f2e3c2">
              <rect x="2" y="2" width="12" height="1" />
              <rect x="2" y="13" width="12" height="1" />
              <rect x="2" y="2" width="1" height="12" />
              <rect x="13" y="2" width="1" height="12" />
              <rect x="5" y="2" width="1" height="12" />
              <rect x="8" y="2" width="1" height="12" />
              <rect x="11" y="2" width="1" height="12" />
              <rect x="2" y="5" width="12" height="1" />
              <rect x="2" y="8" width="12" height="1" />
              <rect x="2" y="11" width="12" height="1" />
            </g>
            <g fill="#e8a04c">
              <rect x="3" y="3" width="2" height="2" />
              <rect x="12" y="9" width="2" height="2" />
            </g>
          </svg>
          <span class="shogi-home__label">対局画面</span>
        </button>
        <button type="button" class="shogi-home__card" @click="dexOpen = true">
          <svg class="shogi-home__icon" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
            <g fill="#f2e3c2">
              <rect x="2" y="3" width="5" height="10" />
              <rect x="9" y="3" width="5" height="10" />
              <rect x="7" y="2" width="2" height="12" />
            </g>
            <g fill="#e8a04c">
              <rect x="3" y="4" width="3" height="1" />
              <rect x="3" y="6" width="3" height="1" />
              <rect x="3" y="8" width="3" height="1" />
              <rect x="10" y="4" width="3" height="1" />
              <rect x="10" y="6" width="3" height="1" />
              <rect x="10" y="8" width="3" height="1" />
            </g>
          </svg>
          <span class="shogi-home__label">定跡図鑑</span>
        </button>
        <button type="button" class="shogi-home__card" disabled>
          <svg class="shogi-home__icon" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
            <g fill="#e8a04c">
              <rect x="5" y="1" width="6" height="1" />
              <rect x="4" y="2" width="8" height="2" />
              <rect x="3" y="4" width="10" height="8" />
              <rect x="4" y="12" width="8" height="2" />
              <rect x="5" y="14" width="6" height="1" />
            </g>
            <text x="8" y="11" class="shogi-home__koma-char" aria-hidden="true">飛</text>
          </svg>
          <span class="shogi-home__label">駒図鑑</span>
          <span class="shogi-home__soon">準備中</span>
        </button>
        <button type="button" class="shogi-home__card" disabled>
          <svg class="shogi-home__icon" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
            <g fill="#f2e3c2">
              <rect x="3" y="2" width="10" height="12" />
              <rect x="2" y="1" width="2" height="14" />
            </g>
            <g fill="#e8a04c">
              <rect x="6" y="4" width="6" height="1" />
              <rect x="6" y="6" width="6" height="1" />
              <rect x="6" y="8" width="6" height="1" />
              <rect x="6" y="10" width="4" height="1" />
            </g>
          </svg>
          <span class="shogi-home__label">ルール図鑑</span>
          <span class="shogi-home__soon">準備中</span>
        </button>
      </nav>
    </div>

    <ShogiOpeningDex
      v-if="dexOpen"
      :asset-base-url="assetBaseUrl"
      @close="dexOpen = false"
    />

    <header class="shogi-game__header">
      <div class="shogi-game__status" aria-live="polite">
        <strong>{{ statusText }}</strong>
        <span>{{ moveCount }}手目</span>
      </div>
      <div class="shogi-game__toolbar">
        <template v-if="!menuCollapsed">
          <button
            type="button"
            class="shogi-game__command"
            :class="reviewMode ? 'shogi-game__command--complete' : 'shogi-game__command--danger'"
            :disabled="!active"
            @click="reviewMode ? completeReview() : requestResign()"
          >{{ reviewMode ? "完了" : "投了" }}</button>
          <button
            type="button"
            class="shogi-game__command shogi-game__command--flip"
            aria-label="盤面を上下反転（ひふみんアイ）"
            :aria-pressed="boardFlipOverride"
            @click="boardFlipOverride = !boardFlipOverride"
          >ひふみんアイ</button>
        </template>
        <button
          type="button"
          class="shogi-game__command shogi-game__menu-toggle"
          :aria-expanded="settingsOpen"
          aria-haspopup="menu"
          :aria-label="menuCollapsed ? 'メニュー' : '設定'"
          @click="toggleSettings"
        >
          <svg v-if="menuCollapsed" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <rect x="3" y="4" width="14" height="2" rx="1" />
            <rect x="3" y="9" width="14" height="2" rx="1" />
            <rect x="3" y="14" width="14" height="2" rx="1" />
          </svg>
          <span v-else>設定</span>
        </button>
      </div>
      <div v-if="settingsOpen" class="shogi-game__menu-backdrop" aria-hidden="true" @click="closeSettings"></div>
      <div v-if="settingsOpen" class="shogi-game__menu" role="menu" @keydown.esc="closeSettings">
        <template v-if="menuCollapsed">
          <button
            type="button"
            role="menuitem"
            class="shogi-game__menu-item"
            :class="reviewMode ? 'shogi-game__menu-item--complete' : 'shogi-game__menu-item--danger'"
            :disabled="!active"
            @click="closeSettings(); reviewMode ? completeReview() : requestResign()"
          >{{ reviewMode ? "検討を完了する" : "投了する" }}</button>
          <button
            type="button"
            role="menuitemcheckbox"
            class="shogi-game__menu-item"
            :aria-checked="boardFlipOverride"
            @click="boardFlipOverride = !boardFlipOverride"
          >
            <span>ひふみんアイ（盤を反転）</span>
            <b>{{ boardFlipOverride ? "ON" : "OFF" }}</b>
          </button>
        </template>
        <label class="shogi-game__menu-field">
          <span>やこび姫の助言</span>
          <select v-model="coachLevel" aria-label="対局中の助言">
            <option value="off">なし</option>
            <option value="encourage">応援のみ</option>
            <option value="detailed">詳しい助言</option>
          </select>
        </label>
        <button type="button" class="shogi-game__menu-close" @click="closeSettings">閉じる</button>
      </div>
    </header>

    <div
      v-if="pregameOpen"
      class="shogi-game__pregame"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pregame-title"
    >
      <div class="shogi-game__pregame-panel">
        <!-- ホーム画面を表示する構成のときだけタイトルへ戻れる。 -->
        <button
          v-if="showHome"
          type="button"
          class="shogi-game__pregame-back"
          @click="openHome"
        >
          <span aria-hidden="true">←</span> タイトルへ戻る
        </button>
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
          <details
            v-if="normalizedMode === 'cpu'"
            class="shogi-game__pregame-field shogi-game__pregame-field--opening-tendency"
            :open="pregameTendencyOpen"
            @toggle="pregameTendencyOpen = ($event.target as HTMLDetailsElement).open"
          >
            <summary>
              <span>相手の序盤傾向</span>
              <small>{{ pregameTendencySummary }}</small>
            </summary>
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
            <small class="shogi-game__pregame-hint">初手を最優先し、その後は角道の具体的な指定を定跡より優先します。</small>
          </details>
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
        <div class="shogi-game__pregame-footer">
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
    </div>

    <section class="shogi-game__summary" aria-label="戦型">
      <div><b>先手</b><span>{{ blackFormationText }}</span></div>
      <div><b>後手</b><span>{{ whiteFormationText }}</span></div>
      <small class="shogi-game__summary-mode">{{ modeText }}</small>
    </section>

    <section class="shogi-game__opening-guide" aria-label="やこび姫補助">
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
          <select v-model="selectedCastle" aria-label="囲い" @change="announceOpeningGuide">
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
      <div v-if="strategyCompletionChoiceRequired" class="shogi-game__rook-choice shogi-game__strategy-choice">
        <span>{{ strategyCompletionPrompt }}</span>
        <div>
          <button
            v-for="choice in strategyCompletionChoices"
            :key="choice.id"
            type="button"
            @click="chooseStrategyCompletion(choice.id)"
          >{{ choice.label }}</button>
        </div>
      </div>
      <div
        v-if="nearCompletionPrompt"
        class="shogi-game__rook-choice shogi-game__strategy-choice"
      >
        <span>{{ nearCompletionPrompt.label }}までできたよ！{{ nearCompletionPrompt.definitionLabel }}まで続ける？</span>
        <div>
          <button type="button" @click="continueToFullForm">完全形まで続ける</button>
          <button type="button" @click="finishAtNearForm">ここで終える</button>
        </div>
      </div>
      <p v-if="openingGuideStatus">{{ openingGuideStatus }}</p>
    </section>

    <section v-if="uiLayout === 'wide'" class="shogi-game__kifu" aria-label="棋譜">
      <h2>棋譜</h2>
      <ol ref="kifuList">
        <li v-if="!kifuEntries.length" class="shogi-game__kifu-empty">まだ指し手はありません</li>
        <li
          v-for="entry in kifuEntries"
          :key="entry.ply"
          :class="{ 'shogi-game__kifu-current': entry.ply === currentKifuPly }"
        >
          <button
            v-if="reviewMode && !reviewCpuEnabled"
            type="button"
            @click="goToReviewLinePly(entry.ply)"
          ><small>{{ entry.ply }}</small>{{ entry.text }}</button>
          <span v-else><small>{{ entry.ply }}</small>{{ entry.text }}</span>
        </li>
      </ol>
    </section>

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

    <section class="shogi-game__coach" aria-label="やこび姫">
      <div class="shogi-game__portrait">
        <img
          class="shogi-game__character"
          :src="coachPortraitUrl"
          :data-expression="coachExpression"
          alt="助言役のやこび姫"
        >
      </div>
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
    </section>

    <div class="shogi-game__assist-actions">
      <button type="button" class="shogi-game__awakening" :disabled="!canUseHint" @click="showHint">
        閃き <small>×{{ reviewMode ? "∞" : hintsRemaining }}</small>
      </button>
      <button v-if="!reviewMode || reviewCpuEnabled" type="button" :disabled="!canUndo" @click="undoTurn">
        待った <small>×{{ reviewMode ? "∞" : undosRemaining }}</small>
      </button>
      <button
        v-if="reviewMode && !analysisOpen"
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
            <dt>目的</dt>
            <dd>{{ selectedStrategyExplanation.aim }}</dd>
          </div>
          <div>
            <dt>相性の良い囲い</dt>
            <dd>{{ selectedStrategyExplanation.castles }}</dd>
          </div>
          <div>
            <dt>コツ</dt>
            <dd>{{ selectedStrategyExplanation.tip }}</dd>
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
        <strong>{{ record.position.color === Color.BLACK ? "先手番" : "後手番" }}</strong>
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
        <button
          type="button"
          class="shogi-game__analysis-close"
          aria-label="解析を閉じる"
          @click="analysisOpen = false; analysisMenuOpen = false"
        >×</button>
      </div>
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
          @change="refreshReviewCoachAdvice()"
        >
      </div>
      <EvaluationGraph
        :points="analysisPoints"
        :current-ply="reviewNavigation.cursor"
        :total-ply="reviewNavigation.mainLine.length"
        @select="goToAnalysisPly"
      />
      <div class="shogi-game__analysis-actions">
        <div class="shogi-game__analysis-nav">
          <button type="button" aria-label="開始局面へ" :disabled="reviewCpuEnabled || reviewNavigation.cursor === 0" @click="goToAnalysisPly(0)">⏮</button>
          <button type="button" aria-label="一手戻る" :disabled="reviewCpuEnabled || reviewNavigation.cursor === 0" @click="navigateAnalysis(-1)">◀</button>
          <button type="button" aria-label="一手進む" :disabled="reviewCpuEnabled || reviewNavigation.cursor >= reviewNavigation.line.length" @click="navigateAnalysis(1)">▶</button>
          <button type="button" aria-label="最終局面へ" :disabled="reviewCpuEnabled || reviewNavigation.cursor >= reviewNavigation.line.length" @click="goToAnalysisPly(reviewNavigation.line.length)">⏭</button>
        </div>
        <div class="shogi-game__analysis-tools">
          <button type="button" :disabled="!canUseHint" @click="showHint">ヒント</button>
          <button type="button" :disabled="!analysisCurrentPoint?.bestMove" @click="showAnalysisRecommendation">推奨</button>
          <button type="button" :disabled="!analysisCurrentPoint?.pv?.length" @click="showAnalysisLine">読み</button>
          <button
            type="button"
            class="shogi-game__analysis-more"
            :aria-expanded="analysisMenuOpen"
            aria-haspopup="menu"
            @click="analysisMenuOpen = !analysisMenuOpen"
          >その他 <span aria-hidden="true">{{ analysisMenuOpen ? "▴" : "▾" }}</span></button>
        </div>
        <div v-if="analysisMenuOpen" class="shogi-game__analysis-menu" role="menu">
          <button v-if="reviewNavigation.branch" type="button" role="menuitem" @click="analysisMenuOpen = false; returnToMainLine()">本筋に戻る</button>
          <button v-if="analysisRunning" type="button" role="menuitem" @click="analysisMenuOpen = false; cancelKifuAnalysis()">解析を中止</button>
          <button v-else type="button" role="menuitem" :disabled="reviewCpuEnabled" @click="analysisMenuOpen = false; runKifuAnalysis()">再解析</button>
          <button
            v-if="!reviewCpuEnabled"
            type="button"
            role="menuitem"
            :disabled="analysisRunning || thinking || !engineReady"
            @click="analysisMenuOpen = false; startReviewCpu()"
          >ここから対CPU</button>
          <button v-else type="button" role="menuitem" @click="analysisMenuOpen = false; stopReviewCpu()">対CPU終了</button>
        </div>
      </div>
    </section>

    <div v-if="errorMessage" class="shogi-game__error" role="alert">
      <p>{{ errorMessage }}</p>
      <button type="button" aria-label="メッセージを閉じる" @click="errorMessage = ''">×</button>
    </div>

    <div
      v-if="resignConfirmOpen"
      class="shogi-game__confirm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="resign-confirm-title"
      @click.self="resignConfirmOpen = false"
    >
      <div class="shogi-game__confirm-panel">
        <h2 id="resign-confirm-title">投了しますか？</h2>
        <p>投了すると対局が終わります。</p>
        <div>
          <button type="button" class="shogi-game__confirm-danger" @click="confirmResign">投了する</button>
          <button type="button" @click="resignConfirmOpen = false">対局を続ける</button>
        </div>
      </div>
    </div>

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
          <div v-if="normalizedMode === 'cpu'">
            <dt>対戦相手</dt>
            <dd>{{ resultPresentation.opponent }}</dd>
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, toRaw, watch } from "vue";
import { Color, PieceType, Position, Record, Square, reverseColor } from "tsshogi";
import ShogiMatchBoard from "./ShogiMatchBoard.vue";
import ShogiOpeningDex from "./ShogiOpeningDex.vue";
import EvaluationGraph from "./EvaluationGraph.vue";
import {
  appendUsiMove,
  createGameRecord,
  enumerateLegalMoves,
  GameMode,
  MatchResult,
  resignationResult,
  resultAfterMove,
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
  coachAdviceForPosition,
  normalizeCoachAdviceHistory,
  pruneCoachAdviceAfterPly,
  recordCoachAdvice,
} from "./core/coach-advice-history.mjs";
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
import { chooseCpuMove, chooseNaturalMove } from "./core/cpu-move-choice.mjs";
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
  usesNaturalMoveOnly,
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
  openingCastleDistance,
  openingNearCompletion,
  openingCastleReselection,
  openingDefinitionRookStyle,
  openingDetourArrowCandidates,
  openingFollowupCount,
  openingGuideScoreLossLimit,
  openingPlanBranchMessage,
  openingPlanInterruption,
  openingPlanCandidates as getOpeningPlanCandidates,
  openingStrategyCompletionChoices,
  rangingRookStrategyChoices,
  openingUrgentResponse,
  shouldAbandonOpeningGuide,
  shouldShowOpeningFollowup,
  OPENING_CASTLE_GROUPS,
  OPENING_CASTLES,
  OPENING_GUIDE_MAX_DETOURS,
  OPENING_GUIDE_MAX_UNSAFE_TURNS,
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
  showHome: { type: Boolean, default: false },
});
const emit = defineEmits(["match-ready", "match-move", "match-end", "match-error"]);

const errorMessage = ref("");
const record = ref<Record>(createRecord());
const currentSfen = ref(record.value.position.sfen);
const lastMove = ref("");
const active = ref(false);
const matchStarted = ref(false);
const pregameOpen = ref(true);
const homeOpen = ref(props.showHome);
const dexOpen = ref(false);
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
const boardFlipOverride = ref(false);
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
const strategyCompletionLocked = ref(false);
const castleCompletionLocked = ref(false);
// 囲いの距離を縮める安全な手が見つからなかった手番の連続数。同じ手番を二重に数えない。
const openingGuideUnsafeTurns = ref(0);
let openingGuideUnsafeCountedPly = -1;
const castleSuggestions = ref<{ id: string; label: string; distance: number }[]>([]);
const strategySuggestions = ref<{ id: string; label: string; distance: number }[]>([]);
// 「ほぼ完成形」で続行・終了を選んだ囲いと形。同じ形では再度聞かない。
const castleNearCompletionHandled = ref("");
const strategyNearCompletionHandled = ref("");
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
const gameRoot = ref<HTMLElement | null>(null);
const kifuList = ref<HTMLElement | null>(null);
// wide: 盤を中央、左右に情報欄。side: 盤の右に情報欄1列。stack: 縦に積む。
const uiLayout = ref<"wide" | "side" | "stack">("stack");
const uiFontPx = ref(15);
const uiBoardSize = ref({ width: 0, height: 0 });
const uiShort = ref(false);
const uiNarrow = ref(false);
const menuCollapsed = computed(() => uiLayout.value !== "wide");
const uiLayoutStyle = computed(() => ({
  "--ui-font": `${uiFontPx.value}px`,
  "--board-w": `${Math.floor(uiBoardSize.value.width)}px`,
  "--board-h": `${Math.floor(uiBoardSize.value.height)}px`,
}));
const resignConfirmOpen = ref(false);
const analysisMenuOpen = ref(false);
const pregameTendencyOpen = ref(false);
const advisedCoachTopics = new Set<string>();
const coachAdviceLastShownAt = new Map<string, number>();
let playerTurnScore: { type: "cp" | "mate"; value: number } | undefined;
let playerTurnScoreHistoryLength = -1;
type EngineEvaluation = { type: "cp" | "mate"; value: number };
type RecordedCoachAdvice = {
  ply: number;
  sfen: string;
  key: string;
  text: string;
  topic?: string;
};
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
let matchGeneration = 0;
let cpuSearchRunning = false;
let cpuSearchGeneration = -1;
let enginePromise: Promise<void> | null = null;
let idleCoachTimer: ReturnType<typeof setTimeout> | undefined;
let idleCoachGeneration = 0;
let engine: ShogiEngine | null = null;
let moveHistory: string[] = [];
let coachAdviceHistory: RecordedCoachAdvice[] = [];
let displayingStructuredCoachAdvice = false;
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

// 盤描画の外枠寸法（src/renderer/view/primitive/board/params.ts）。どれも9x9の盤は878x960。
const BOARD_FRAMES = {
  standard: { width: 1471, height: 959 },
  compact: { width: 1088, height: 1015 },
  portrait: { width: 878, height: 1168 },
} as const;
type BoardFrameName = keyof typeof BOARD_FRAMES;
// 縦積みで盤以外（見出し・戦型・助言・補助・操作ボタン）に要る高さの見積もり。文字サイズ基準。
// 横並びと比べて盤が大きくなる方を選ぶためだけに使い、実際の盤の枠は残りの高さから決める。
const STACK_RESERVED_EM = 18;
const STACK_ANALYSIS_RESERVED_EM = 25;
// 横並びの情報欄1列の最小幅。2列分以上余れば盤を中央に置く。
const SIDE_COLUMN_MIN_EM = 17;
const WIDE_COLUMNS_MIN_EM = 33;

function fitBoardFrame(names: BoardFrameName[], width: number, height: number) {
  const fits = names.map((name) => {
    const frame = BOARD_FRAMES[name];
    const scale = Math.max(0, Math.min(width / frame.width, height / frame.height));
    return { name, scale, width: frame.width * scale, height: frame.height * scale };
  });
  const best = fits.reduce((a, b) => (b.scale > a.scale ? b : a));
  // 盤の大きさがほぼ同じなら、駒台が場所を取らないcompactを優先する。
  const compact = fits.find(({ name }) => name === "compact");
  return compact && compact.scale >= best.scale * 0.9 ? compact : best;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function updateUiLayout() {
  const root = gameRoot.value;
  if (!root) return;
  const width = root.clientWidth;
  const height = root.clientHeight;
  if (!width || !height) return;
  const analysis = reviewMode.value && analysisOpen.value;

  // 横並び: 盤を高さいっぱいに置き、残りの横幅を情報欄にする。
  const sideFont = clampNumber(Math.min(height / 50, width / 70), 13, 20);
  const sidePad = sideFont * 0.6;
  const sideBoard = fitBoardFrame(
    ["compact", "standard"],
    width - sideFont * SIDE_COLUMN_MIN_EM - sidePad * 3,
    height - sidePad * 2,
  );

  // 縦積み: 盤を横幅いっぱいに置き、盤以外の高さを先に確保する。
  const stackFont = clampNumber(Math.min(width / 26, height / 46), 13, 18);
  const stackPad = stackFont * 0.45;
  const stackBoard = fitBoardFrame(
    ["portrait", "compact", "standard"],
    width - stackPad * 2,
    height - stackPad * 2 - stackFont * (analysis ? STACK_ANALYSIS_RESERVED_EM : STACK_RESERVED_EM),
  );

  if (sideBoard.scale > stackBoard.scale) {
    const sideSpace = width - sideBoard.width - sidePad * 3;
    uiLayout.value = sideSpace >= sideFont * WIDE_COLUMNS_MIN_EM ? "wide" : "side";
    uiFontPx.value = Math.round(sideFont * 10) / 10;
    uiBoardSize.value = { width: sideBoard.width, height: sideBoard.height };
    boardLayout.value = sideBoard.name;
    uiShort.value = height < 560;
    uiNarrow.value = false;
  } else {
    uiLayout.value = "stack";
    uiFontPx.value = Math.round(stackFont * 10) / 10;
    uiBoardSize.value = { width: stackBoard.width, height: stackBoard.height };
    uiShort.value = height < 700;
    uiNarrow.value = width < 600;
    updateStackBoardFrame();
  }
}

// 縦積みでは盤の行が残りの高さを受け持つため、実際の枠の寸法から駒台の配置を選ぶ。
function updateStackBoardFrame() {
  const shell = boardShell.value;
  if (uiLayout.value !== "stack" || !shell) return;
  const { clientWidth, clientHeight } = shell;
  if (!clientWidth || !clientHeight) return;
  boardLayout.value = fitBoardFrame(["portrait", "compact", "standard"], clientWidth, clientHeight).name;
}

const kifuEntries = computed(() => {
  if (uiLayout.value !== "wide") return [];
  try {
    if (reviewMode.value) {
      const lineRecord = createGameRecord(props.initialSfen);
      for (const move of reviewNavigation.value.line) {
        if (!appendUsiMove(lineRecord, move)) break;
      }
      return lineRecord.moves.slice(1).map((entry) => ({ ply: entry.ply, text: entry.displayText }));
    }
    // recordは差し替えで更新されるが、同一インスタンスへの追加にも追従させる。
    void currentSfen.value;
    return toRaw(record.value).moves.slice(1).map((entry) => ({ ply: entry.ply, text: entry.displayText }));
  } catch {
    return [];
  }
});
const currentKifuPly = computed(() => (reviewMode.value ? reviewNavigation.value.cursor : moveCount.value));

function goToReviewLinePly(ply: number) {
  navigateAnalysis(ply - reviewNavigation.value.cursor);
}

const pregameTendencySummary = computed(() => {
  const labels = [
    cpuBishopPreference.value && "角道",
    cpuRookPreference.value && "飛車",
    cpuTempoPreference.value && "指し方",
  ].filter(Boolean);
  return labels.length ? `${labels.join("・")}を指定中` : "指定なし";
});

function requestResign() {
  if (!active.value || reviewMode.value) return;
  resignConfirmOpen.value = true;
}

function confirmResign() {
  resignConfirmOpen.value = false;
  resign();
}

const normalizedMode = computed<GameMode>(() => props.mode === "local" ? "local" : "cpu");
const humanColor = computed(() => activePlayerColor.value === "white" ? Color.WHITE : Color.BLACK);
const moveCount = computed(() => record.value.current.ply);
const flipBoard = computed(() => (
  normalizedMode.value === "cpu" && humanColor.value === Color.WHITE
) !== boardFlipOverride.value);
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
  const handicap = props.handicapName.trim()
    || (props.initialSfen === STANDARD_SFEN ? "平手" : "その他");
  const opponentPreset = normalizedMode.value === "cpu"
    ? CPU_STRENGTH_PRESETS.find((preset) => preset.value === searchNodes.value)
    : undefined;
  const common = {
    detail,
    handicap,
    opponent: opponentPreset
      ? `${props.cpuPlayerName.trim() || "CPU"} Lv.${opponentPreset.level} ${opponentPreset.label}`
      : props.cpuPlayerName.trim() || "CPU",
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
const strategyPhaseComplete = computed(() => {
  const sfen = currentSfen.value;
  if (!selectedStrategy.value || reviewMode.value || !active.value) return false;
  if (strategyCompletionLocked.value) return true;
  const playerIsBlack = humanColor.value === Color.BLACK;
  const playerMoves = moveHistory.filter((_, index) => (index % 2 === 0) === playerIsBlack);
  const opponentMoves = moveHistory.filter((_, index) => (index % 2 === 0) !== playerIsBlack);
  const opponentColor = playerIsBlack ? Color.WHITE : Color.BLACK;
  return isOpeningPlanComplete({
    strategyId: selectedStrategy.value,
    color: playerIsBlack ? "black" : "white",
    playedMoves: playerMoves,
    opponentMoves,
    detectedFormations: formationNamesForColor(sfen, humanColor.value),
    opponentFormations: formationNamesForColor(sfen, opponentColor),
    currentSfen: sfen,
  });
});
const castlePhaseComplete = computed(() => {
  const sfen = currentSfen.value;
  if (!selectedCastle.value || reviewMode.value || !active.value) return false;
  if (castleCompletionLocked.value) return true;
  const playerIsBlack = humanColor.value === Color.BLACK;
  const opponentColor = playerIsBlack ? Color.WHITE : Color.BLACK;
  return isOpeningPlanComplete({
    castleId: selectedCastle.value,
    color: playerIsBlack ? "black" : "white",
    playedMoves: moveHistory.filter((_, index) => (index % 2 === 0) === playerIsBlack),
    opponentMoves: moveHistory.filter((_, index) => (index % 2 === 0) !== playerIsBlack),
    detectedFormations: formationNamesForColor(sfen, humanColor.value),
    opponentFormations: formationNamesForColor(sfen, opponentColor),
    currentSfen: sfen,
  });
});
watch(strategyPhaseComplete, (complete) => {
  if (complete) strategyCompletionLocked.value = true;
}, { flush: "sync" });
watch(castlePhaseComplete, (complete) => {
  if (complete) castleCompletionLocked.value = true;
}, { flush: "sync" });
const strategyCompletionChoices = computed(() => openingStrategyCompletionChoices(
  selectedStrategy.value,
  availableOpeningStrategies.value.map(({ id }) => id),
));
const strategyCompletionChoiceRequired = computed(() => (
  strategyPhaseComplete.value
  && Boolean(selectedStrategyDefinition.value?.completionChoices?.strategyIds?.length)
));
const strategyCompletionPrompt = computed(() => (
  selectedStrategyDefinition.value?.completionChoices?.prompt
  ?? "次に目指す戦法を選んでね"
));
const OPENING_STRATEGY_GROUPS = [
  { id: "ibisha", label: "居飛車/基本戦法" },
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
  // 戦法に届かなくなったとき、近い戦法を残り手数つきで先頭に並べる。
  const suggested = strategySuggestions.value.flatMap(({ id, label, distance }) => {
    const strategy = OPENING_STRATEGIES.find((entry) => entry.id === id);
    return strategy ? [{ ...strategy, label: `${label}（あと${distance}手）`, disabled: false }] : [];
  });
  const groups = groupOpeningStrategies(
    OPENING_STRATEGIES
      // 完成後ボタンから選んだ内部派生も、選択中はプルダウンへ表示する。
      .filter(({ id, guideSelectable }) => guideSelectable !== false || id === selectedStrategy.value)
      .map((strategy) => ({
        ...strategy,
        // 進行中の補助は、相手の応手を待つ一時的な局面でも解除しない。
        // 中断後も、現在局面から到達できる別案だけを選択可能にする。
        disabled: strategy.id !== selectedStrategy.value
          && !availableIds.has(strategy.id),
      })),
  );
  return suggested.length
    ? [{ id: "suggested", label: "今の局面から近い戦法", options: suggested }, ...groups]
    : groups;
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
  const groups = groupOpeningCastles(OPENING_CASTLES.map((castle) => ({
      ...castle,
      disabled: castle.id !== selectedCastle.value
        && !availableIds.has(castle.id),
    })));
  // 囲いに届かなくなったとき、近い囲いを残り手数つきで先頭に並べる。
  const suggested = castleSuggestions.value.flatMap(({ id, label, distance }) => {
    const castle = OPENING_CASTLES.find((entry) => entry.id === id);
    return castle ? [{ ...castle, label: `${label}（あと${distance}手）`, disabled: false }] : [];
  });
  return suggested.length
    ? [{ id: "suggested", label: "今の局面から近い囲い", options: suggested }, ...groups]
    : groups;
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
const playerColorKey = computed(() => (humanColor.value === Color.BLACK ? "black" : "white"));
// 戦法が済んで(または未選択で)、囲いを組んでいる段階か。
const castleGuidePhaseActive = computed(() => (
  Boolean(selectedCastle.value)
  && !castlePhaseComplete.value
  && (!selectedStrategy.value || strategyPhaseComplete.value)
));
// 戦法・囲いの「ほぼ完成形」に達したとき、完全形まで続けるか選ばせる。戦法の段階を先に聞く。
const nearCompletionPrompt = computed(() => {
  const sfen = currentSfen.value;
  // 振り飛車用の囲いでは、先に飛車の振り先を選ばせてから聞く。
  if (
    openingGuideAbandoned.value || openingPlanExpired.value || rangingRookChoiceRequired.value
  ) return null;
  const candidates = [
    selectedStrategy.value && !strategyPhaseComplete.value
      ? { kind: "strategy" as const, id: selectedStrategy.value, handled: strategyNearCompletionHandled.value }
      : null,
    castleGuidePhaseActive.value
      ? { kind: "castle" as const, id: selectedCastle.value, handled: castleNearCompletionHandled.value }
      : null,
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const near = openingNearCompletion({
      kind: candidate.kind,
      id: candidate.id,
      color: playerColorKey.value,
      currentSfen: sfen,
    });
    const key = near ? `${candidate.id}:${near.id}` : "";
    if (near && candidate.handled !== key) return { ...near, kind: candidate.kind, key };
    // 戦法の段階ではほぼ完成形でなくても、囲いの確認へは進まない。
    if (candidate.kind === "strategy") return null;
  }
  return null;
});
const nearCompletionChoiceRequired = computed(() => Boolean(nearCompletionPrompt.value));
watch(nearCompletionChoiceRequired, (required) => {
  const near = nearCompletionPrompt.value;
  if (!required || !near || coachLevel.value === "off") return;
  guideText.value = `${near.label}までできたよ！${near.definitionLabel}まで続ける？それともここで終える？`;
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
    || strategyCompletionChoiceRequired.value
    || nearCompletionChoiceRequired.value
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
    completedPhases: {
      strategy: strategyCompletionLocked.value,
      castle: castleCompletionLocked.value,
    },
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
    completedPhases: {
      strategy: strategyCompletionLocked.value,
      castle: castleCompletionLocked.value,
    },
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
  if (strategyCompletionChoiceRequired.value) {
    return strategyCompletionChoices.value.length
      ? strategyCompletionPrompt.value
      : "この局面から続けられる派生戦法がないみたい。別の戦法を選び直そう。";
  }
  if (nearCompletionPrompt.value) {
    return `${nearCompletionPrompt.value.label}までできたよ。${nearCompletionPrompt.value.definitionLabel}まで続けるか選んでね`;
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
      ? "棒銀が完成したね！AI候補に加え、1五銀・3五銀の定跡手から歩交換まで案内するよ。"
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
  strategyCompletionLocked.value = false;
  castleCompletionLocked.value = false;
  resetOpeningFollowup();
  resetOpeningGuideSafety();
  // 選び直したら、形作りの期限と寄り道の数え直しを始める。
  openingGuideStartedAtPly.value = moveHistory.length;
  openingGuideDetourCount.value = 0;
  openingGuideUnsafeTurns.value = 0;
  openingGuideUnsafeCountedPly = -1;
  castleSuggestions.value = [];
  strategySuggestions.value = [];
  castleNearCompletionHandled.value = "";
  strategyNearCompletionHandled.value = "";
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

function markNearCompletionHandled(near: { kind: "strategy" | "castle"; key: string }) {
  if (near.kind === "strategy") strategyNearCompletionHandled.value = near.key;
  else castleNearCompletionHandled.value = near.key;
}

function continueToFullForm() {
  const near = nearCompletionPrompt.value;
  if (!near) return;
  markNearCompletionHandled(near);
  if (coachLevel.value !== "off") {
    guideText.value = near.remaining
      ? `よし、${near.definitionLabel}まであと${near.remaining}手だよ！`
      : `${near.definitionLabel}を目指そう！`;
  }
  scheduleOpeningGuideSafety();
  persistMatchState();
}

function finishAtNearForm() {
  const near = nearCompletionPrompt.value;
  if (!near) return;
  markNearCompletionHandled(near);
  if (near.kind === "strategy") strategyCompletionLocked.value = true;
  else castleCompletionLocked.value = true;
  if (coachLevel.value !== "off") {
    guideText.value = near.kind === "strategy"
      ? `${near.label}で戦法は完成にしよう！`
      : `${near.label}で囲いは完成にしよう！ここからは局面に合わせて指そう。`;
  }
  scheduleOpeningGuideSafety();
  scheduleOpeningFollowupCandidates();
  persistMatchState();
}

/** 距離の縮まない手番が続いたときに囲いの補助を外し、近い囲いを提案する。 */
function abandonCastleGuide(prefix: string) {
  const playerIsBlack = humanColor.value === Color.BLACK;
  const { castleSuggestions: suggestions, message } = openingCastleReselection({
    castleId: selectedCastle.value,
    strategyId: selectedStrategy.value,
    color: playerColorKey.value,
    playedMoves: moveHistory.filter((_, index) => (index % 2 === 0) === playerIsBlack),
    currentSfen: currentSfen.value,
  });
  selectedCastle.value = "";
  castleCompletionLocked.value = false;
  openingGuideDetourCount.value = 0;
  openingGuideUnsafeTurns.value = 0;
  castleSuggestions.value = suggestions;
  openingGuideDecision.value = null;
  openingGuideDetourCandidates.value = [];
  if (coachLevel.value !== "off") guideText.value = `${prefix}${message}`;
}

function chooseStrategyCompletion(strategyId: string) {
  const choice = strategyCompletionChoices.value.find(({ id }) => id === strategyId);
  if (!choice) return;
  const previous = selectedStrategyDefinition.value?.label;
  selectedStrategy.value = strategyId;
  announceOpeningGuide();
  if (coachLevel.value !== "off") {
    guideText.value = `${previous ?? "基本の形"}ができたね。次は${choice.label}を目指そう！`;
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

// ホーム画面の装飾(星)の配置。left/topはパーセント、色は夜空の配色に合わせる。
const HOME_STARS = [
  { id: "s1", style: "left:9%;top:16%;width:12px;height:12px;color:#f2e3c2;" },
  { id: "s2", style: "left:16%;top:38%;width:8px;height:8px;color:#e8a04c;" },
  { id: "s3", style: "left:24%;top:10%;width:6px;height:6px;color:#cfc8f0;" },
  { id: "s4", style: "left:33%;top:26%;width:8px;height:8px;color:#f2e3c2;" },
  { id: "s5", style: "left:52%;top:12%;width:6px;height:6px;color:#e8a04c;" },
  { id: "s6", style: "left:63%;top:22%;width:12px;height:12px;color:#f2e3c2;" },
  { id: "s7", style: "left:72%;top:8%;width:8px;height:8px;color:#cfc8f0;" },
  { id: "s8", style: "left:84%;top:30%;width:8px;height:8px;color:#e8a04c;" },
  { id: "s9", style: "left:90%;top:14%;width:14px;height:14px;color:#f2e3c2;" },
  { id: "s10", style: "left:12%;top:70%;width:8px;height:8px;color:#e8a04c;" },
  { id: "s11", style: "left:70%;top:74%;width:10px;height:10px;color:#f2e3c2;" },
  { id: "s12", style: "left:88%;top:66%;width:8px;height:8px;color:#cfc8f0;" },
];

function closeHome() {
  // 「対局画面」は常に対局準備から始める。openPregameが中断保存を破棄する。
  openPregame();
  homeOpen.value = false;
}

function openHome() {
  homeOpen.value = true;
}

function openPregame() {
  matchGeneration += 1;
  if (cpuTimer) clearTimeout(cpuTimer);
  cpuTimer = undefined;
  if (cpuSearchRunning) engine?.stop();
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
  resignConfirmOpen.value = false;
  analysisMenuOpen.value = false;
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

function strategyMove(): { usi: string; phase: "strategy" | "castle" } | undefined {
  // 駒落ちや途中局面では平手用定跡を当てはめない。
  if (props.initialSfen !== STANDARD_SFEN) return undefined;
  const { cpuIsBlack, cpuMoves, cpuColor: configuredCpuColor } = currentCpuOpeningTurn();
  const legalMoveDetails = enumerateLegalMoves(record.value.position);
  const legalMoves = legalMoveDetails.map(({ usi }) => usi);
  const requestedFirstMove = configuredCpuFirstMove({
    configuredFirstMove: cpuFirstMove.value,
    cpuColor: configuredCpuColor,
    cpuMoveCount: cpuMoves.length,
    legalMoves,
  });
  if (requestedFirstMove) return { usi: requestedFirstMove, phase: "strategy" };
  const requestedBishopMove = configuredCpuBishopMove({
    bishopPreference: cpuBishopPreference.value,
    cpuColor: configuredCpuColor,
    cpuMoves,
    legalMoves,
    legalMoveDetails,
  });
  if (requestedBishopMove) return { usi: requestedBishopMove, phase: "strategy" };
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
  if (urgent) return { usi: urgent.usi, phase: "strategy" as const };
  const planMove = nextOpeningPlanMove({
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
  });
  return planMove ? { usi: planMove.usi, phase: planMove.phase === "castle" ? "castle" as const : "strategy" as const } : undefined;
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
    boardFlipOverride: boardFlipOverride.value,
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
    strategyCompletionLocked: strategyCompletionLocked.value,
    castleCompletionLocked: castleCompletionLocked.value,
    castleNearCompletionHandled: castleNearCompletionHandled.value,
    strategyNearCompletionHandled: strategyNearCompletionHandled.value,
    coachAdviceHistory,
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
    boardFlipOverride.value = snapshot.boardFlipOverride === true;
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
    strategyCompletionLocked.value = snapshot.strategyCompletionLocked === true;
    castleCompletionLocked.value = snapshot.castleCompletionLocked === true;
    castleNearCompletionHandled.value = typeof snapshot.castleNearCompletionHandled === "string"
      ? snapshot.castleNearCompletionHandled
      : "";
    strategyNearCompletionHandled.value = typeof snapshot.strategyNearCompletionHandled === "string"
      ? snapshot.strategyNearCompletionHandled
      : "";
    coachAdviceHistory = normalizeCoachAdviceHistory(snapshot.coachAdviceHistory, moves.length);
    result.value = restoredResult;
    resultDialogOpen.value = Boolean(restoredResult);
    matchStarted.value = true;
    pregameOpen.value = false;
    homeOpen.value = false;
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

function displayCoachAdvice(advice: {
  key: string;
  text: string;
  topic?: string;
  sfen?: string;
  ply?: number;
}): boolean {
  const lastShownAt = coachAdviceLastShownAt.get(advice.key);
  if (
    lastShownAt !== undefined && moveCount.value - lastShownAt < 8
    && coachAdvicePriority(advice) < 100
  ) return false;
  coachAdviceLastShownAt.set(advice.key, moveCount.value);
  if (advice.topic) advisedCoachTopics.add(advice.topic);
  displayingStructuredCoachAdvice = true;
  try {
    guideText.value = advice.text;
  } finally {
    displayingStructuredCoachAdvice = false;
  }
  if (
    !reviewMode.value && typeof advice.sfen === "string"
    && typeof advice.ply === "number" && Number.isInteger(advice.ply) && advice.ply >= 0
  ) {
    coachAdviceHistory = recordCoachAdvice(coachAdviceHistory, advice as RecordedCoachAdvice);
    persistMatchState();
  }
  return true;
}

const coachAdviceScheduler = createCoachAdviceScheduler({ display: displayCoachAdvice });

function showCoachAdvice(advice?: { key: string; text: string; topic?: string } | null) {
  coachAdviceScheduler.present(advice ? {
    ...advice,
    sfen: currentSfen.value,
    ply: moveCount.value,
  } : advice);
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

/** CPUの「見落とし」判定用に、通常探索の直後へ直列で行う追加探索。 */
function cpuOversightVerifier(enginePosition: string, isCurrent: () => boolean) {
  return async (searchMoves: string[], nodes: number) => {
    if (!engine || !isCurrent()) return undefined;
    engine.applyStrengthOptions({ multiPv: searchMoves.length });
    engine.setPosition(enginePosition);
    return engine.go({ nodes, maxTimeMs: 3000, searchMoves });
  };
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
    || nearCompletionChoiceRequired.value
    || (!selectedStrategy.value && !selectedCastle.value)
  ) return;

  // 完成後は候補手表示へ完全に移行し、序盤計画・寄り道判定へ戻さない。
  if (openingPlanComplete.value) return;

  const playerIsBlack = humanColor.value === Color.BLACK;
  const playerMoves = moveHistory.filter((_, index) => (index % 2 === 0) === playerIsBlack);
  const opponentMoves = moveHistory.filter((_, index) => (index % 2 === 0) !== playerIsBlack);
  const legalMoves = enumerateLegalMoves(record.value.position).map(({ usi }) => usi);
  const interruption = openingPlanInterruption({
    completedPhases: {
      strategy: strategyCompletionLocked.value,
      castle: castleCompletionLocked.value,
    },
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
    legalMoves,
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
    if (interruption.clearStrategy) strategyCompletionLocked.value = false;
    if (interruption.clearCastle) castleCompletionLocked.value = false;
    openingGuideStartedAtPly.value = moveHistory.length;
    openingGuideDetourCount.value = 0;
    openingGuideUnsafeTurns.value = 0;
    openingGuideAbandoned.value = false;
    castleSuggestions.value = "castleSuggestions" in interruption
      ? interruption.castleSuggestions
      : [];
    strategySuggestions.value = "strategySuggestions" in interruption
      ? interruption.strategySuggestions
      : [];
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
      if (
        castleGuidePhaseActive.value
        && (planned?.phase === "castle" || planBlocked)
        && openingGuideUnsafeCountedPly !== historyLength
      ) {
        openingGuideUnsafeCountedPly = historyLength;
        openingGuideUnsafeTurns.value = choice.source === "ai" ? openingGuideUnsafeTurns.value + 1 : 0;
        if (openingGuideUnsafeTurns.value >= OPENING_GUIDE_MAX_UNSAFE_TURNS) {
          abandonCastleGuide("安全に囲いを進められる手が続けて見つからなかったね。");
          return;
        }
      }
      openingGuideDecision.value = {
        usi: choice.usi,
        source: choice.source,
        phase: plannedOptions.find(({ usi }) => usi === choice.usi)?.phase ?? planned?.phase,
      };
      if (choice.source === "ai" && planned) {
        openingGuideDetourCandidates.value = openingDetourArrowCandidates(
          planned.usi,
          compatibleCandidates,
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
  if (showRecordedCoachAdvice()) {
    reviewCoachGeneration += 1;
    thinking.value = false;
    return;
  }
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

function showRecordedCoachAdvice(): boolean {
  if (!reviewMode.value || coachLevel.value === "off") return false;
  const advice = coachAdviceForPosition(coachAdviceHistory, currentSfen.value) as RecordedCoachAdvice | null;
  if (!advice) return false;
  if (advice.topic) advisedCoachTopics.add(advice.topic);
  guideText.value = advice.text;
  return true;
}

function refreshReviewCoachAdvice({ analyze = true } = {}): boolean {
  if (!reviewMode.value || reviewCpuEnabled.value) return false;
  coachAdviceScheduler.reset();
  reviewCoachGeneration += 1;
  if (coachLevel.value === "off") {
    guideText.value = "";
    return false;
  }
  if (showRecordedCoachAdvice()) {
    thinking.value = false;
    return true;
  }
  guideText.value = "この局面を見てみよう。";
  if (analyze && !analysisRunning.value) scheduleReviewCoachAdvice();
  return false;
}

function finish(matchResult: MatchResult) {
  matchGeneration += 1;
  if (cpuTimer) clearTimeout(cpuTimer);
  cpuTimer = undefined;
  if (cpuSearchRunning) engine?.stop();
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
  // 囲いを組む段階では、完成形までの距離が縮まなかった手だけを寄り道として数える。
  const castleDistanceBefore = actor === "player" && !reviewMode.value
    && castleGuidePhaseActive.value && !openingGuideAbandoned.value
    && !openingPlanExpired.value && !nearCompletionChoiceRequired.value
    ? openingCastleDistance({
        castleId: selectedCastle.value,
        color: playerColorKey.value,
        currentSfen: currentSfen.value,
      })
    : null;
  const movedWhileInCheck = castleDistanceBefore ? isSideToMoveInCheck(currentSfen.value) : false;
  const move = active.value ? record.value.position.createMoveByUSI(usi) : null;
  if (!move || !record.value.append(move)) return false;
  syncPosition(usi);
  moveHistory.push(usi);
  if (castleDistanceBefore && !castleDistanceBefore.unreachable) {
    const castleDistanceAfter = openingCastleDistance({
      castleId: selectedCastle.value,
      color: playerColorKey.value,
      currentSfen: currentSfen.value,
    });
    if (castleDistanceAfter && !castleDistanceAfter.unreachable
      && castleDistanceAfter.distance < castleDistanceBefore.distance) {
      openingGuideDetourCount.value = 0;
    } else if (!movedWhileInCheck) {
      openingGuideDetourCount.value += 1;
      if (shouldAbandonOpeningGuide(openingGuideDetourCount.value)) {
        const castleLabel = OPENING_CASTLES.find(({ id }) => id === selectedCastle.value)?.label ?? "囲い";
        abandonCastleGuide(`${OPENING_GUIDE_MAX_DETOURS}手続けて${castleLabel}が近づかなかったね。`);
      }
    }
  }
  if (actor === "player") {
    const enemyCamp = move.color === Color.BLACK ? move.to.rank <= 3 : move.to.rank >= 7;
    playerMoveFlair = {
      historyLength: moveHistory.length,
      wasPromotion: move.promote,
      wasEnemyCampDrop: usi.includes("*") && enemyCamp,
    };
    // 囲いの段階は上の距離判定で数え済みなので、ここでは戦法の寄り道だけを数える。
    if (!castleDistanceBefore && followedOpeningDecision?.source === "ai") {
      openingGuideDetourCount.value += 1;
      if (shouldAbandonOpeningGuide(openingGuideDetourCount.value)) {
        selectedStrategy.value = "";
        selectedCastle.value = "";
        openingGuideAbandoned.value = true;
        guideText.value = coachLevel.value === "off"
          ? ""
          : "3手寄り道したけれど、この形へ戻るのは難しそうだね。ここで中断して、別の戦法や囲いを選び直そう！";
      }
    } else if (!castleDistanceBefore && followedOpeningDecision?.source === "plan") {
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
  strategyCompletionLocked.value = false;
  castleCompletionLocked.value = false;
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
    coachAdviceHistory = pruneCoachAdviceAfterPly(coachAdviceHistory, moveHistory.length);
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
  openingGuideUnsafeTurns.value = 0;
  openingGuideUnsafeCountedPly = -1;
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
  refreshReviewCoachAdvice({ analyze: false });
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
  refreshReviewCoachAdvice();
}

function returnToMainLine() {
  if (reviewCpuEnabled.value) return;
  coachAdviceScheduler.reset();
  reviewNavigation.value = returnReviewToMainLine(reviewNavigation.value);
  rebuildRecord(visibleReviewMoves(reviewNavigation.value));
  hintCandidates.value = [];
  hintText.value = "";
  guideText.value = coachLevel.value === "off" ? "" : "本筋の局面に戻したよ！";
  refreshReviewCoachAdvice();
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
      const strength = getStrengthSearchSettings(searchNodes.value);
      const legalMoves = enumerateLegalMoves(record.value.position).map(({ usi: moveUsi }) => moveUsi);
      let search;
      let verify;
      if (!usesNaturalMoveOnly(searchNodes.value) && engine && engineReady.value) {
        const enginePosition = currentEnginePosition();
        engine.applyStrengthOptions({ multiPv: strength.multiPv });
        engine.setPosition(enginePosition);
        search = await engine.go({
          nodes: strength.nodes,
          maxTimeMs: 8000,
        });
        if (generation !== reviewCpuGeneration || !reviewCpuEnabled.value) return;
        verify = cpuOversightVerifier(
          enginePosition,
          () => generation === reviewCpuGeneration && reviewCpuEnabled.value,
        );
      }
      const choice = await chooseCpuMove({
        strength,
        sfen: record.value.position.sfen,
        legalMoves,
        moveHistory,
        search,
        verify,
      });
      if (generation !== reviewCpuGeneration || !reviewCpuEnabled.value) return;
      const usi = choice?.move ?? "";
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
  const generation = matchGeneration;
  cpuTimer = setTimeout(async () => {
    cpuTimer = undefined;
    try {
      // 操作を妨げずに走らせた助言探索と、CPU本体の探索を同じエンジン上で競合させない。
      await dedicatedCoachQueue;
      if (generation !== matchGeneration) return;
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
      const openingPlanMove = strategyMove();
      const openingMove = openingPlanMove?.usi;
      const openingMovePhase = openingPlanMove?.phase ?? "strategy";
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
      const strength = getStrengthSearchSettings(searchNodes.value);
      const allowedCpuMoveList = allowedCpuMoves.map(({ usi: moveUsi }) => moveUsi);
      const naturalCpuMove = async () => (await chooseCpuMove({
        strength,
        sfen: record.value.position.sfen,
        legalMoves: allowedCpuMoveList,
        moveHistory,
      }))?.move ?? "";
      // Lv0でも、対局設定で指定された序盤の作戦手は優先する。
      if (allowedOpeningMove && usesNaturalMoveOnly(searchNodes.value)) {
        usi = allowedOpeningMove;
      } else if (usesNaturalMoveOnly(searchNodes.value)) {
        usi = await naturalCpuMove();
      } else if (engine && engineReady.value) {
        engine.applyStrengthOptions({ multiPv: strength.multiPv });
        const base = props.initialSfen === STANDARD_SFEN
          ? "startpos"
          : `sfen ${props.initialSfen}`;
        const enginePosition = `${base}${moveHistory.length ? ` moves ${moveHistory.join(" ")}` : ""}`;
        engine.setPosition(enginePosition);
        cpuSearchRunning = true;
        cpuSearchGeneration = generation;
        const search = await engine.go({
          nodes: strength.nodes,
          maxTimeMs: 60000,
          searchMoves: [...allowedCpuMoveIds],
        });
        if (cpuSearchGeneration === generation) cpuSearchRunning = false;
        if (generation !== matchGeneration) return;
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
          if (generation !== matchGeneration) return;
        }
        // MultiPVの候補数は合法手より少ないため、作戦の定跡手が候補に入っていない
        // 局面でも専用探索で評価してから、AI最善手との比較を行う。
        let searchedCandidates = search.candidates;
        if (
          allowedOpeningMove && !forceConfiguredOpening
          && !searchedCandidates.some(({ move }) => move === allowedOpeningMove)
        ) {
          engine.setPosition(enginePosition);
          cpuSearchRunning = true;
          cpuSearchGeneration = generation;
          const forced = await engine.go({
            nodes: strength.nodes,
            maxTimeMs: 60000,
            searchMoves: [allowedOpeningMove],
          });
          if (cpuSearchGeneration === generation) cpuSearchRunning = false;
          if (generation !== matchGeneration) return;
          const forcedCandidate = forced.candidates.find(({ rank }) => rank === 1);
          if (forcedCandidate) {
            searchedCandidates = [
              ...searchedCandidates,
              { ...forcedCandidate, rank: strength.multiPv + 1, move: allowedOpeningMove },
            ];
          }
        }
        // 作戦手の評価差許容は、やこび姫補助と同じ戦法・囲いの基準に合わせる。
        // ただし強いCPUほどAI最善を優先するため、探索設定の上限は超えない。
        const planScoreLimit = Math.min(
          openingGuideScoreLossLimit(cpuOpeningPlan?.strategyId ?? "", openingMovePhase),
          strength.maxScoreLoss,
        );
        const safeOpening = allowedOpeningMove && !forceConfiguredOpening
          ? chooseSafeOpeningMove(allowedOpeningMove, searchedCandidates, planScoreLimit)
          : null;
        const selection = forceConfiguredOpening && allowedOpeningMove
          ? { move: allowedOpeningMove }
          : safeOpening
          ? {
            move: safeOpening.usi,
            rank: searchedCandidates.find(({ move }) => move === safeOpening.usi)?.rank ?? 1,
            }
          : await chooseCpuMove({
            strength,
            sfen: record.value.position.sfen,
            legalMoves: allowedCpuMoveList,
            moveHistory,
            search,
            verify: async (searchMoves: string[], nodes: number) => {
              cpuSearchRunning = true;
              cpuSearchGeneration = generation;
              try {
                return await cpuOversightVerifier(
                  enginePosition,
                  () => generation === matchGeneration,
                )(searchMoves, nodes);
              } finally {
                if (cpuSearchGeneration === generation) cpuSearchRunning = false;
              }
            },
          });
        if (generation !== matchGeneration) return;
        usi = selection?.move ?? "";
        selectedCpuScore = searchedCandidates.find(
          (candidate) => candidate.move === usi,
        )?.score;
      } else {
        // エンジンが利用できない簡易CPUでは評価比較ができないため、合法な定跡手を優先する。
        usi = allowedOpeningMove ?? await naturalCpuMove();
      }
      if (generation !== matchGeneration) return;
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
      if (generation !== matchGeneration) return;
      thinking.value = false;
      const message = error instanceof Error ? error.message : String(error);
      errorMessage.value = `やねうら王の思考に失敗しました: ${message}`;
      emit("match-error", { message });
      const fallbackOpeningMove = strategyMove();
      const fallbackUsi = fallbackOpeningMove?.usi ?? chooseNaturalMove({
        sfen: record.value.position.sfen,
        legalMoves: enumerateLegalMoves(record.value.position).map(({ usi: moveUsi }) => moveUsi),
        moveHistory,
      })?.move;
      if (fallbackUsi && applyMove(fallbackUsi, "cpu") && active.value) {
        updateCoachAdvice();
        schedulePostCpuAssists();
      }
    } finally {
      if (cpuSearchGeneration === generation) cpuSearchRunning = false;
    }
  }, Math.max(0, props.cpuDelayMs));
}

async function initializeEngine() {
  if ((normalizedMode.value !== "cpu" && !reviewMode.value) || engineReady.value) return;
  if (enginePromise) return enginePromise;
  enginePromise = (async () => {
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
    engine?.quit();
    engine = null;
    const message = error instanceof Error ? error.message : String(error);
    const isolationHint = globalThis.crossOriginIsolated === false
      ? " SharedArrayBufferを使うにはCOOP/COEPヘッダーが必要です。" : "";
    errorMessage.value = `やねうら王を起動できないため簡易CPUで続行します: ${message}${isolationHint}`;
    engineUnavailable.value = true;
    emit("match-error", { message });
    scheduleCpuMove();
  }
  })();
  try { await enginePromise; } finally { enginePromise = null; }
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
  showRecordedCoachAdvice();
}

async function startKifuAnalysis() {
  enterAnalysisMode("棋譜を最初から調べてみるね！");
  analysisOpen.value = true;
  await initializeEngine();
  await runKifuAnalysis();
}

function openKifuAnalysis() {
  analysisOpen.value = true;
  showRecordedCoachAdvice();
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
      if (!showRecordedCoachAdvice()) {
        guideText.value = coachLevel.value === "off"
          ? ""
          : "棋譜解析が終わったよ。グラフから気になる局面を選んでね！";
      }
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
  refreshReviewCoachAdvice();
}

function restart() {
  matchGeneration += 1;
  if (cpuTimer) clearTimeout(cpuTimer);
  cpuTimer = undefined;
  if (cpuSearchRunning) engine?.stop();
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
  resignConfirmOpen.value = false;
  analysisMenuOpen.value = false;
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
  boardFlipOverride.value = false;
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
  coachAdviceHistory = [];
  strategyExplanationOpen.value = false;
  openingGuideStartedAtPly.value = 0;
  openingGuideDetourCount.value = 0;
  openingGuideUnsafeTurns.value = 0;
  openingGuideUnsafeCountedPly = -1;
  castleSuggestions.value = [];
  strategySuggestions.value = [];
  castleNearCompletionHandled.value = "";
  strategyNearCompletionHandled.value = "";
  openingGuideAbandoned.value = false;
  openingPlanCompletionLocked.value = false;
  strategyCompletionLocked.value = false;
  castleCompletionLocked.value = false;
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
    if (matchStarted.value) {
      selectedStrategy.value = "";
      selectedCastle.value = "";
      restart();
    }
  },
);
watch(() => props.playerColor, (value) => {
  activePlayerColor.value = normalizePlayerColor(value);
  selectedPlayerColor.value = activePlayerColor.value;
  if (matchStarted.value) {
    selectedStrategy.value = "";
    selectedCastle.value = "";
    restart();
  }
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
  boardFlipOverride,
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
  strategyCompletionLocked,
  castleCompletionLocked,
  castleNearCompletionHandled,
  strategyNearCompletionHandled,
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
watch(guideText, (text) => {
  if (
    displayingStructuredCoachAdvice || restoringSavedMatch || reviewMode.value
    || !matchStarted.value || pregameOpen.value || !text || hintText.value
  ) return;
  coachAdviceHistory = recordCoachAdvice(coachAdviceHistory, {
    ply: moveCount.value,
    sfen: currentSfen.value,
    key: "guide-message",
    text,
  });
  persistMatchState();
}, { flush: "sync" });
watch(coachLevel, (level) => {
  cancelPlayerIdleAdvice();
  coachAdviceScheduler.reset();
  coachAdviceLastShownAt.clear();
  guideText.value = level === "off" ? "" : INITIAL_GUIDE_TEXT;
  if (reviewMode.value && !reviewCpuEnabled.value && !analysisRunning.value && level !== "off") {
    refreshReviewCoachAdvice();
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
function handleGlobalKeydown(event: KeyboardEvent) {
  if (event.key !== "Escape") return;
  settingsOpen.value = false;
  resignConfirmOpen.value = false;
  analysisMenuOpen.value = false;
}
// 盤以外の欄の構成が変わると盤に使える高さも変わる。
watch(() => reviewMode.value && analysisOpen.value, () => nextTick(updateUiLayout));
// 棋譜欄は最新手（検討中は表示中の手）が見えるように追従する。
// scrollIntoViewは overflow:hidden の祖先まで動かすため、一覧だけをスクロールする。
watch([currentKifuPly, () => kifuEntries.value.length], () => nextTick(() => {
  const list = kifuList.value;
  const current = list?.querySelector<HTMLElement>(".shogi-game__kifu-current");
  if (!list || !current) return;
  const top = current.offsetTop; // 一覧は position: relative なので一覧基準の位置になる。
  if (top < list.scrollTop) list.scrollTop = top;
  else if (top + current.offsetHeight > list.scrollTop + list.clientHeight) {
    list.scrollTop = top + current.offsetHeight - list.clientHeight;
  }
}));
onBeforeUnmount(() => {
  matchGeneration += 1;
  cancelPlayerIdleAdvice();
  coachAdviceScheduler.reset();
  analysisGeneration += 1;
  reviewCoachGeneration += 1;
  reviewCpuGeneration += 1;
  if (cpuTimer) clearTimeout(cpuTimer);
  cpuTimer = undefined;
  engine?.quit();
  boardResizeObserver?.disconnect();
  if (typeof window !== "undefined") {
    window.removeEventListener("pagehide", handlePageHide);
    window.removeEventListener("keydown", handleGlobalKeydown);
  }
});
onMounted(() => {
  for (const filename of Object.values(COACH_EXPRESSION_FILES)) {
    const portrait = new Image();
    portrait.src = `${props.assetBaseUrl}/characters/${filename}?v=${COACH_EXPRESSION_ASSET_VERSION}`;
  }
  ensureMoveSounds();
  updateUiLayout();
  boardResizeObserver = new ResizeObserver((entries) => {
    if (entries.some(({ target }) => target === gameRoot.value)) updateUiLayout();
    else updateStackBoardFrame();
  });
  if (gameRoot.value) boardResizeObserver.observe(gameRoot.value);
  if (boardShell.value) boardResizeObserver.observe(boardShell.value);
  window.addEventListener("keydown", handleGlobalKeydown);
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
/*
 * 画面構成は updateUiLayout() が実寸から決める。
 *   --wide  : 盤を中央に置き、左に戦型・補助・棋譜、右に操作・やこび姫。
 *   --side  : 盤の右に情報欄を1列で置く（タブレット横・スマホ横）。
 *   --stack : 縦に積み、操作ボタンを最下段に置く（スマホ縦・タブレット縦）。
 * 文字サイズ --ui-font も同じ関数が決めるため、ここでは em を基準に寸法を指定する。
 */
.shogi-game {
  --night: #1d3343;
  --night-deep: #142736;
  --slate: #2e4a60;
  --slate-light: #3b5a70;
  --amber: #f5a645;
  --ivory: #fffdf4;
  --lavender: #d7ceff;
  --muted: #becbd2;
  --gold: var(--amber);
  --ink: var(--ivory);
  --panel: rgba(20, 39, 54, 0.94);
  --line: rgba(245, 166, 69, 0.5);
  box-sizing: border-box;
  position: relative;
  display: grid;
  gap: 0.6em;
  width: 100%;
  height: 100dvh;
  min-height: 0;
  margin: 0;
  padding: 0.6em;
  overflow: hidden;
  color: var(--ink);
  background:
    radial-gradient(circle at 8% 18%, rgba(245, 166, 69, 0.16) 0 2px, transparent 3px),
    radial-gradient(circle at 91% 13%, rgba(215, 206, 255, 0.18) 0 2px, transparent 3px),
    radial-gradient(circle at 83% 78%, rgba(255, 253, 244, 0.13) 0 1px, transparent 2px),
    linear-gradient(135deg, transparent 0 68%, rgba(46, 74, 96, 0.18) 68% 100%),
    var(--night);
  font-family: "Yu Gothic", "Hiragino Kaku Gothic ProN", sans-serif;
  font-size: var(--ui-font, 15px);
  line-height: 1.45;
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}
.shogi-game *,
.shogi-game *::before,
.shogi-game *::after {
  box-sizing: border-box;
}

/* ===== 共通部品 ===== */
.shogi-game button {
  min-height: 2.6em;
  padding: 0.45em 0.9em;
  border: 1px solid rgba(245, 166, 69, 0.68);
  border-radius: 0.3em;
  color: var(--ivory);
  background: var(--slate);
  box-shadow: 0 2px 0 rgba(10, 25, 35, 0.72);
  font-family: inherit;
  font-size: 1em;
  font-weight: 700;
  line-height: 1.15;
  cursor: pointer;
  touch-action: manipulation;
  transition: border-color 120ms ease, background-color 120ms ease, transform 120ms ease;
}
@media (hover: hover) {
  .shogi-game button:not(:disabled):hover {
    border-color: var(--amber);
    background-color: var(--slate-light);
    transform: translateY(-1px);
  }
}
.shogi-game button:disabled {
  border-color: rgba(174, 184, 189, 0.28);
  color: rgba(255, 253, 244, 0.45);
  background: #263e50;
  box-shadow: none;
  cursor: not-allowed;
}
.shogi-game button:focus-visible,
.shogi-game select:focus-visible,
.shogi-game input:focus-visible,
.shogi-game summary:focus-visible {
  outline: 2px solid var(--lavender);
  outline-offset: 2px;
}
.shogi-game select {
  font-family: inherit;
}
/* iOSは16px未満の入力欄にフォーカスすると画面を拡大するため、タッチ端末では下限を設ける。 */
@media (pointer: coarse) {
  .shogi-game select {
    font-size: max(16px, 1em) !important;
  }
}
.shogi-game__summary,
.shogi-game__status,
.shogi-game__dialogue,
.shogi-game__opening-guide,
.shogi-game__kifu {
  border: 1px solid var(--line);
  border-left: 3px solid var(--amber);
  color: var(--ivory);
  background: var(--panel);
}

/* ===== 見出し・操作 ===== */
.shogi-game__header {
  position: relative;
  z-index: 30;
  display: flex;
  grid-area: header;
  gap: 0.45em;
  align-items: stretch;
  min-width: 0;
}
.shogi-game__status {
  display: flex;
  flex: 1 1 auto;
  gap: 0.6em;
  align-items: center;
  min-width: 0;
  min-height: 2.6em;
  padding: 0.3em 0.7em;
}
.shogi-game__status strong {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.shogi-game__status span {
  flex: none;
  color: var(--amber);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.shogi-game__toolbar {
  display: flex;
  flex: none;
  gap: 0.45em;
}
.shogi-game__command {
  min-width: 0;
  padding-inline: 0.8em;
  white-space: nowrap;
}
.shogi-game__command--danger {
  border-color: rgba(245, 166, 69, 0.82);
  background: #735036;
}
.shogi-game__command--complete {
  border-color: var(--amber);
  color: var(--night-deep) !important;
  background: var(--amber) !important;
  box-shadow: 0 2px 0 #a96924;
}
.shogi-game button.shogi-game__command--flip[aria-pressed="true"] {
  border-color: var(--lavender);
  color: var(--night-deep);
  background: var(--lavender);
  box-shadow: 0 2px 0 #736c98, inset 0 0 0 2px var(--night-deep);
}
.shogi-game__menu-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.8em;
  padding-inline: 0.65em;
  border-color: rgba(215, 206, 255, 0.62) !important;
}
.shogi-game__menu-toggle svg {
  display: block;
  width: 1.35em;
  height: 1.35em;
  fill: currentColor;
}
.shogi-game__menu-toggle[aria-expanded="true"] {
  border-color: var(--lavender) !important;
  background: var(--slate-light);
}
.shogi-game__menu-backdrop {
  position: fixed;
  z-index: 40;
  inset: 0;
}
.shogi-game__menu {
  position: absolute;
  z-index: 41;
  top: calc(100% + 0.4em);
  right: 0;
  display: grid;
  gap: 0.55em;
  width: min(19em, calc(100vw - 1.2em));
  padding: 0.8em;
  border: 1px solid rgba(245, 166, 69, 0.72);
  border-top: 3px solid var(--amber);
  border-radius: 0.3em;
  background: rgba(20, 39, 54, 0.98);
  box-shadow: 0 0.8em 2em rgba(7, 18, 26, 0.55);
  animation: shogi-menu-in 140ms ease-out both;
}
.shogi-game__menu-item {
  display: flex;
  gap: 0.6em;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 2.9em !important;
  text-align: left;
}
.shogi-game__menu-item b {
  color: var(--muted);
  font-size: 0.85em;
}
.shogi-game__menu-item[aria-checked="true"] b {
  color: var(--lavender);
}
.shogi-game__menu-item--danger {
  background: #735036 !important;
}
.shogi-game__menu-item--complete {
  color: var(--night-deep) !important;
  background: var(--amber) !important;
}
.shogi-game__menu-field {
  display: grid;
  gap: 0.3em;
  color: var(--amber);
  font-size: 0.9em;
  font-weight: 700;
}
.shogi-game__menu-field select {
  width: 100%;
  min-height: 2.6em;
  padding: 0.3em 0.5em;
  border: 1px solid rgba(245, 166, 69, 0.6);
  border-radius: 0.2em;
  color: var(--ivory);
  background: var(--night-deep);
  font-size: 1.1em;
}
.shogi-game__menu-close {
  justify-self: end;
  min-width: 6em;
}
@keyframes shogi-menu-in {
  from { opacity: 0; transform: translateY(-0.3em); }
}

/* ===== 戦型 ===== */
.shogi-game__summary {
  display: flex;
  grid-area: summary;
  gap: 0.3em 1em;
  align-items: baseline;
  min-width: 0;
  padding: 0.3em 0.7em;
  font-size: 0.88em;
}
.shogi-game__summary > div {
  display: flex;
  flex: 1 1 0;
  gap: 0.45em;
  align-items: baseline;
  min-width: 0;
}
.shogi-game__summary b {
  flex: none;
  color: var(--amber);
  font-size: 0.9em;
}
.shogi-game__summary span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.shogi-game__summary-mode {
  display: none;
  color: var(--muted);
}

/* ===== やこび姫補助 ===== */
.shogi-game__opening-guide {
  display: flex;
  grid-area: guide;
  flex-direction: column;
  gap: 0.45em;
  min-width: 0;
  min-height: 0;
  padding: 0.5em 0.6em;
  overflow: auto;
  overscroll-behavior: contain;
  background: rgba(20, 39, 54, 0.96);
}
.shogi-game__opening-guide h2,
.shogi-game__kifu h2 {
  margin: 0;
  color: var(--amber);
  font-size: 0.95em;
  text-align: center;
}
.shogi-game__opening-selects {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.45em;
}
.shogi-game__opening-selects label {
  display: grid;
  gap: 0.2em;
  min-width: 0;
  color: var(--amber);
  font-size: 0.82em;
  font-weight: 700;
}
.shogi-game__opening-selects select {
  width: 100%;
  min-width: 0;
  min-height: 2.5em;
  padding: 0.3em 0.4em;
  border: 1px solid rgba(245, 166, 69, 0.6);
  border-radius: 0.2em;
  color: var(--ivory);
  background: var(--night-deep);
  font-size: 1.15em;
  font-weight: 400;
}
.shogi-game__opening-strategy-field {
  position: relative;
  min-width: 0;
}
.shogi-game__opening-strategy-field > label {
  height: 100%;
}
.shogi-game .shogi-game__opening-explanation-trigger {
  position: absolute;
  z-index: 1;
  top: -0.2em;
  right: 0;
  min-height: 1.7em;
  padding: 0.1em 0.6em;
  border-color: rgba(215, 206, 255, 0.6);
  border-radius: 0.2em;
  color: #f7f1ff;
  background: rgba(46, 74, 96, 0.9);
  box-shadow: none;
  font-size: 0.75em;
}
.shogi-game__rook-choice {
  display: grid;
  gap: 0.4em;
  padding: 0.5em;
  border: 1px solid rgba(244, 216, 144, 0.65);
  color: var(--ivory);
  background: rgba(96, 54, 22, 0.34);
  font-size: 0.9em;
}
.shogi-game__rook-choice > span {
  color: #f4d890;
  font-weight: 700;
}
.shogi-game__rook-choice > div {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(6.5em, 1fr));
  gap: 0.4em;
}
.shogi-game .shogi-game__rook-choice button {
  min-width: 0;
  min-height: 2.5em;
  padding: 0.35em 0.4em;
  border-color: rgba(85, 191, 233, 0.72);
  color: #f7f5ff;
  background: rgba(22, 83, 112, 0.82);
}
.shogi-game .shogi-game__rook-choice button:first-child {
  border-color: #f0b45e;
  background: rgba(124, 68, 24, 0.9);
}
.shogi-game__opening-guide p {
  margin: 0;
  padding: 0.45em 0.6em;
  border-left: 3px solid var(--lavender);
  color: var(--ivory);
  background: rgba(46, 74, 96, 0.58);
  font-size: 0.92em;
  line-height: 1.5;
}

/* ===== 棋譜（PC） ===== */
.shogi-game__kifu {
  display: flex;
  grid-area: kifu;
  flex-direction: column;
  gap: 0.35em;
  min-width: 0;
  min-height: 0;
  padding: 0.5em 0.6em;
}
.shogi-game__kifu ol {
  position: relative;
  display: grid;
  flex: 1 1 auto;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-content: start;
  gap: 1px 0.3em;
  min-height: 0;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  list-style: none;
  font-size: 0.92em;
}
.shogi-game__kifu li > span,
.shogi-game .shogi-game__kifu li > button {
  display: flex;
  gap: 0.5em;
  align-items: baseline;
  justify-content: flex-start;
  width: 100%;
  min-height: 0;
  padding: 0.2em 0.45em;
  border: 0;
  border-radius: 0.2em;
  color: inherit;
  background: transparent;
  box-shadow: none;
  font-weight: 400;
  line-height: 1.4;
  text-align: left;
  white-space: nowrap;
}
.shogi-game__kifu small {
  min-width: 1.8em;
  color: var(--muted);
  font-size: 0.85em;
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.shogi-game .shogi-game__kifu-current > * {
  color: var(--ivory);
  background: rgba(245, 166, 69, 0.24);
  font-weight: 700;
}
.shogi-game__kifu-empty {
  grid-column: 1 / -1;
  padding: 0.3em 0.45em;
  color: var(--muted);
}

/* ===== 盤 ===== */
.shogi-game__board-shell {
  position: relative;
  grid-area: board;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.shogi-game__board-shell .shogi-match-theme-controls {
  display: none;
}

/* ===== やこび姫 ===== */
.shogi-game__coach {
  position: relative;
  display: flex;
  grid-area: coach;
  gap: 0.5em;
  align-items: flex-end;
  min-width: 0;
  min-height: 0;
}
.shogi-game__portrait {
  flex: none;
  overflow: hidden;
  pointer-events: none;
}
.shogi-game__character {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center top;
}
.shogi-game__dialogue {
  position: relative;
  z-index: 1;
  display: flex;
  flex: 1 1 auto;
  gap: 0.55em;
  align-items: center;
  min-width: 0;
  min-height: 3.2em;
  max-height: 100%;
  padding: 0.55em 0.75em;
  overflow: auto;
  overscroll-behavior: contain;
  line-height: 1.5;
}
.shogi-game__dialogue-icon {
  display: inline-flex;
  flex: none;
  width: 1.2em;
  height: 1.5em;
  filter: drop-shadow(0 0 0.25rem rgba(245, 166, 69, 0.45));
}
.shogi-game__dialogue-icon svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}
.shogi-game__flame-outer { fill: var(--amber); }
.shogi-game__flame-inner { fill: var(--ivory); }
.shogi-game__dialogue-text {
  min-width: 0;
  overflow-wrap: anywhere;
}
.shogi-game__assist-actions {
  display: flex;
  grid-area: actions;
  flex-wrap: wrap;
  gap: 0.5em;
  min-width: 0;
}
.shogi-game__assist-actions > button {
  flex: 1 1 6em;
  min-width: 0;
  min-height: 3em;
  padding: 0.4em 0.5em;
  font-size: 1.02em;
  white-space: nowrap;
}
.shogi-game__assist-actions small {
  margin-left: 0.15em;
  font-size: 0.8em;
  opacity: 0.85;
}
.shogi-game .shogi-game__awakening {
  border-color: var(--amber);
  color: var(--night-deep);
  background: var(--amber);
  box-shadow: 0 2px 0 #a96924;
}
.shogi-game .shogi-game__awakening:disabled {
  border-color: rgba(174, 184, 189, 0.28);
  color: rgba(255, 253, 244, 0.45);
  background: #263e50;
  box-shadow: none;
}
.shogi-game .shogi-game__analysis-button {
  border-color: rgba(215, 206, 255, 0.62);
  background: var(--slate);
}

/* ===== 棋譜解析 ===== */
.shogi-game__analysis {
  position: relative;
  z-index: 5;
  display: grid;
  grid-area: analysis;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  gap: 0.3em;
  min-width: 0;
  min-height: 0;
  padding: 0.4em 0.5em;
  border: 1px solid var(--amber);
  border-radius: 0.3em;
  color: var(--night-deep);
  background: var(--ivory);
  font-size: 0.92em;
}
.shogi-game__analysis-info {
  display: flex;
  gap: 0.5em;
  align-items: center;
  min-width: 0;
}
.shogi-game__analysis-info strong {
  flex: none;
}
.shogi-game__analysis-info select {
  flex: 1 1 auto;
  min-width: 0;
  max-width: 18em;
  min-height: 2.2em;
  border: 1px solid #6b7a86;
  border-radius: 0.2em;
  color: var(--night-deep);
  background: #fff;
  font-size: 1em;
}
.shogi-game__analysis-progress {
  color: #a74316;
  font-weight: 700;
  white-space: nowrap;
}
.shogi-game .shogi-game__analysis-close {
  flex: none;
  min-width: 2.3em;
  min-height: 2.3em;
  margin-left: auto;
  padding: 0;
  border-color: var(--slate);
  color: var(--night-deep);
  background: #fff;
  box-shadow: none;
  font-size: 1.1em;
}
.shogi-game__analysis-slider input[type="range"] {
  width: 100%;
  height: 1.4em;
  margin: 0;
  accent-color: var(--amber);
  cursor: ew-resize;
  touch-action: pan-x;
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
.shogi-game__analysis-actions {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35em;
  justify-content: space-between;
}
.shogi-game__analysis-nav,
.shogi-game__analysis-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3em;
}
.shogi-game .shogi-game__analysis-actions button {
  min-width: 2.6em;
  min-height: 2.4em;
  padding: 0.2em 0.6em;
  border-color: var(--slate);
  color: var(--night-deep);
  background: #fff;
  box-shadow: none;
}
.shogi-game .shogi-game__analysis-actions button:disabled {
  border-color: #bbb;
  color: #aaa;
  background: #eee;
}
.shogi-game__analysis-menu {
  position: absolute;
  z-index: 6;
  right: 0;
  bottom: calc(100% + 0.3em);
  display: grid;
  gap: 0.3em;
  min-width: 11em;
  padding: 0.45em;
  border: 1px solid var(--slate);
  border-radius: 0.3em;
  background: #fff;
  box-shadow: 0 0.5em 1.5em rgba(7, 18, 26, 0.35);
  animation: shogi-menu-in 140ms ease-out both;
}
.shogi-game .shogi-game__analysis-menu button {
  width: 100%;
  text-align: left;
}

/* ===== レイアウト: 縦積み ===== */
.shogi-game--stack {
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: auto auto minmax(0, 1fr) auto auto auto;
  grid-template-areas: "header" "summary" "board" "coach" "guide" "actions";
  gap: 0.45em;
  padding: 0.45em;
  padding-bottom: max(0.45em, env(safe-area-inset-bottom));
}
.shogi-game--stack.shogi-game--analysis {
  grid-template-rows: auto auto minmax(0, 1fr) minmax(0, 13em) auto auto;
  grid-template-areas: "header" "summary" "board" "analysis" "coach" "actions";
}
.shogi-game--stack .shogi-game__opening-guide h2 {
  display: none;
}
/* 補助は内容の高さに合わせ、盤が残りを使う。飛車選択などが出たら盤の方を縮める。 */
.shogi-game--stack .shogi-game__opening-guide {
  max-height: 20em;
}
.shogi-game--stack .shogi-game__portrait {
  width: 4em;
  height: 4.4em;
  border-bottom: 2px solid var(--amber);
}
.shogi-game--stack .shogi-game__dialogue {
  min-height: 4.4em;
  max-height: 5.6em;
}
.shogi-game--stack.shogi-game--analysis .shogi-game__opening-guide {
  display: none;
}
.shogi-game--stack.shogi-game--analysis .shogi-game__dialogue {
  min-height: 3em;
  max-height: 4.6em;
}
.shogi-game--stack.shogi-game--analysis .shogi-game__portrait {
  display: none;
}
/* 縦の余裕が少ない端末では、補助の選択欄を横並びの見出し付き1行にする。 */
.shogi-game--stack.shogi-game--short .shogi-game__opening-selects label {
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.35em;
  align-items: center;
}
.shogi-game--stack.shogi-game--short .shogi-game__opening-explanation-trigger {
  top: auto;
  right: auto;
  bottom: calc(100% + 0.2em);
  left: 0;
}
.shogi-game--stack.shogi-game--short .shogi-game__opening-strategy-field:has(.shogi-game__opening-explanation-trigger) {
  margin-top: 1.2em;
}
.shogi-game--stack.shogi-game--short .shogi-game__dialogue {
  min-height: 3.6em;
  max-height: 4.6em;
}
.shogi-game--stack.shogi-game--short .shogi-game__portrait {
  width: 3.4em;
  height: 3.6em;
}

/* ===== レイアウト: 横並び（情報欄1列） ===== */
.shogi-game--side {
  grid-template-columns: var(--board-w) minmax(0, 34em);
  grid-template-rows: auto auto auto minmax(0, 1fr) auto;
  grid-template-areas: "board header" "board summary" "board guide" "board coach" "board actions";
  justify-content: center;
}
.shogi-game--side .shogi-game__board-shell,
.shogi-game--wide .shogi-game__board-shell {
  height: var(--board-h);
  align-self: center;
}
.shogi-game--side .shogi-game__opening-guide {
  max-height: 22em;
}
.shogi-game--side.shogi-game--analysis {
  grid-template-rows: auto auto minmax(0, 1fr) auto auto;
  grid-template-areas: "board header" "board summary" "board analysis" "board coach" "board actions";
}
.shogi-game--side.shogi-game--analysis .shogi-game__opening-guide {
  display: none;
}
.shogi-game--side.shogi-game--short {
  gap: 0.4em;
  padding: 0.4em;
}
.shogi-game--side.shogi-game--short .shogi-game__opening-guide h2 {
  display: none;
}
/* 低い横画面では、補助を内容の高さまで広げつつ台詞欄の最低限の高さを残す。 */
.shogi-game--side.shogi-game--short {
  grid-template-rows: auto auto minmax(0, max-content) minmax(3.8em, 1fr) auto;
}
.shogi-game--side.shogi-game--short.shogi-game--analysis {
  grid-template-rows: auto auto minmax(0, 1fr) minmax(3.8em, auto) auto;
}
.shogi-game--side.shogi-game--short .shogi-game__opening-guide {
  max-height: none;
}
.shogi-game--side.shogi-game--short .shogi-game__assist-actions > button {
  min-height: 2.6em;
}

/* 立ち絵を欄いっぱいに表示し、台詞を下に重ねる（PC・タブレット横）。 */
.shogi-game--wide .shogi-game__coach,
.shogi-game--side:not(.shogi-game--short):not(.shogi-game--analysis) .shogi-game__coach {
  min-height: 6em;
}
.shogi-game--wide .shogi-game__portrait,
.shogi-game--side:not(.shogi-game--short):not(.shogi-game--analysis) .shogi-game__portrait {
  position: absolute;
  z-index: 0;
  inset: 0;
}
.shogi-game--wide .shogi-game__portrait::after,
.shogi-game--side:not(.shogi-game--short):not(.shogi-game--analysis) .shogi-game__portrait::after {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 0 55%, rgba(20, 39, 54, 0.6) 100%);
  content: "";
}
.shogi-game--wide .shogi-game__dialogue,
.shogi-game--side:not(.shogi-game--short):not(.shogi-game--analysis) .shogi-game__dialogue {
  max-height: 60%;
}
.shogi-game--side.shogi-game--short .shogi-game__portrait,
.shogi-game--side.shogi-game--analysis .shogi-game__portrait {
  width: 3.4em;
  height: 3.8em;
  border-bottom: 2px solid var(--amber);
}
.shogi-game--side.shogi-game--short .shogi-game__dialogue,
.shogi-game--side.shogi-game--analysis .shogi-game__dialogue {
  min-height: 3.8em;
  max-height: 100%;
}
.shogi-game--side.shogi-game--short .shogi-game__coach {
  align-self: stretch;
  align-items: stretch;
}
.shogi-game--side.shogi-game--short .shogi-game__portrait {
  align-self: flex-end;
}

/* ===== レイアウト: PC（盤を中央） ===== */
.shogi-game--wide {
  grid-template-columns: minmax(0, 30em) var(--board-w) minmax(0, 30em);
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  grid-template-areas:
    "summary board header"
    "guide board coach"
    "kifu board coach"
    "kifu board actions";
  justify-content: center;
}
.shogi-game--wide.shogi-game--analysis {
  grid-template-areas:
    "summary board header"
    "guide board coach"
    "analysis board coach"
    "analysis board actions";
}
.shogi-game--wide.shogi-game--analysis .shogi-game__kifu {
  display: none;
}
.shogi-game--wide .shogi-game__header {
  flex-wrap: wrap;
}
.shogi-game--wide .shogi-game__status {
  flex-basis: 100%;
}
.shogi-game--wide .shogi-game__toolbar {
  flex: 1 1 auto;
}
.shogi-game--wide .shogi-game__toolbar > button {
  flex: 1 1 auto;
}
.shogi-game--wide .shogi-game__summary {
  flex-direction: column;
  align-items: stretch;
  gap: 0.3em;
  padding: 0.5em 0.7em;
  font-size: 0.95em;
}
.shogi-game--wide .shogi-game__summary span {
  white-space: normal;
}
.shogi-game--wide .shogi-game__summary-mode {
  display: block;
  order: -1;
}
.shogi-game--wide .shogi-game__opening-guide {
  max-height: 26em;
}

/* ===== 補助ダイアログ ===== */
.shogi-game__error {
  position: absolute;
  z-index: 90;
  top: 3.8em;
  left: 50%;
  display: flex;
  gap: 0.5em;
  align-items: flex-start;
  width: min(34em, calc(100% - 1.2em));
  padding: 0.55em 0.55em 0.55em 0.9em;
  border: 1px solid var(--amber);
  border-radius: 0.3em;
  color: var(--ivory);
  background: #604634;
  box-shadow: 0 0.6em 1.6em rgba(7, 18, 26, 0.5);
  font-size: 0.88em;
  transform: translateX(-50%);
}
.shogi-game__error p {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
}
.shogi-game .shogi-game__error button {
  flex: none;
  min-width: 2.2em;
  min-height: 2.2em;
  padding: 0;
}
.shogi-game__confirm,
.shogi-game__opening-explanation {
  position: absolute;
  z-index: 95;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 1em;
  background: rgba(7, 18, 26, 0.72);
  backdrop-filter: blur(0.2rem);
}
.shogi-game__confirm-panel {
  width: min(22em, 100%);
  padding: 1.2em;
  border: 1px solid rgba(245, 166, 69, 0.78);
  border-top: 4px solid var(--amber);
  border-radius: 0.3em;
  background: var(--slate);
  box-shadow: 0 1em 2.5em rgba(7, 18, 26, 0.58);
  text-align: center;
}
.shogi-game__confirm-panel h2 {
  margin: 0 0 0.4em;
  font-size: 1.3em;
}
.shogi-game__confirm-panel p {
  margin: 0 0 1em;
  color: var(--muted);
}
.shogi-game__confirm-panel > div {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6em;
}
.shogi-game .shogi-game__confirm-danger {
  background: #735036;
}
.shogi-game__opening-explanation-panel {
  width: min(31em, 100%);
  max-height: calc(100% - 1em);
  overflow-y: auto;
  padding: 1.1em;
  border: 1px solid rgba(245, 166, 69, 0.78);
  border-top: 4px solid var(--amber);
  color: var(--ivory);
  background: var(--slate);
  box-shadow: 0 1em 2.5em rgba(7, 18, 26, 0.58);
}
.shogi-game__opening-explanation-panel small {
  color: var(--amber);
  font-weight: 700;
}
.shogi-game__opening-explanation-panel h2 {
  margin: 0.15em 0 0.7em;
  color: var(--ivory);
}
.shogi-game__opening-explanation-panel p {
  margin: 0 0 0.8em;
  line-height: 1.7;
}
.shogi-game__opening-explanation-panel dl {
  display: grid;
  gap: 0.55em;
  margin: 0;
}
.shogi-game__opening-explanation-panel dl > div {
  padding: 0.65em;
  border-left: 3px solid var(--lavender);
  background: rgba(20, 39, 54, 0.72);
}
.shogi-game__opening-explanation-panel dt {
  margin-bottom: 0.2em;
  color: var(--amber);
  font-weight: 800;
}
.shogi-game__opening-explanation-panel dd {
  margin: 0;
  line-height: 1.6;
}
.shogi-game__opening-explanation-panel > button {
  display: block;
  min-width: 7em;
  margin: 0.9em 0 0 auto;
}

/* ===== 対局準備 ===== */
.shogi-game__pregame {
  position: absolute;
  z-index: 100;
  inset: 0;
  display: grid;
  place-items: center;
  padding: clamp(0.6em, 3vw, 2.5em);
  background: rgba(20, 39, 54, 0.96);
  backdrop-filter: blur(0.4rem);
}
.shogi-game__pregame-panel {
  width: min(46em, 100%);
  max-height: 100%;
  padding: clamp(0.9em, 3vw, 2em);
  overflow: auto;
  overscroll-behavior: contain;
  border: 1px solid rgba(245, 166, 69, 0.72);
  border-top: 4px solid var(--amber);
  border-radius: 0.3em;
  color: var(--ivory);
  background: var(--slate);
  box-shadow: 0 1.2em 3em rgba(7, 18, 26, 0.52);
}
.shogi-game .shogi-game__pregame-back {
  min-height: 2.2em;
  margin-bottom: 0.8em;
  padding: 0.3em 0.9em;
  border: 1px solid rgba(242, 227, 194, 0.5);
  border-radius: 999px;
  color: #f2e3c2;
  background: transparent;
  box-shadow: none;
  font-size: 0.85em;
}
.shogi-game__pregame-heading {
  margin-bottom: 1.1em;
  text-align: center;
}
.shogi-game__pregame-heading > span {
  color: var(--amber);
  font-size: 0.82em;
  font-weight: 700;
  letter-spacing: 0.18em;
}
.shogi-game__pregame-heading h2 {
  margin: 0.3em 0 0;
  font-size: 1.6em;
}
.shogi-game__pregame-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8em;
}
.shogi-game__pregame-field {
  display: grid;
  gap: 0.4em;
  align-content: start;
  min-width: 0;
  padding: 0.75em;
  border: 1px solid rgba(215, 206, 255, 0.24);
  border-radius: 0.2em;
  background: rgba(20, 39, 54, 0.58);
}
.shogi-game__pregame-field span {
  color: var(--amber);
  font-weight: 700;
}
.shogi-game__pregame-field select {
  width: 100%;
  min-height: 2.8em;
  padding: 0.4em 0.6em;
  border: 1px solid rgba(245, 166, 69, 0.68);
  border-radius: 0.15em;
  color: var(--night-deep);
  background: var(--ivory);
  font-size: 1em;
}
.shogi-game__pregame-control {
  display: grid;
  gap: 0.4em;
  min-width: 0;
}
.shogi-game__pregame-control--sub {
  padding-top: 0.65em;
  border-top: 1px solid rgba(240, 196, 95, 0.3);
}
.shogi-game__strategy-setting {
  display: grid;
  gap: 0.6em;
  min-width: 0;
}
.shogi-game .shogi-game__strategy-toggle {
  justify-self: end;
  min-height: 2.2em;
  padding: 0.25em 0.7em;
  font-size: 0.82em;
  white-space: nowrap;
}
.shogi-game__strategy-details,
.shogi-game__opening-tendency {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9em, 1fr));
  gap: 0.55em;
}
.shogi-game__strategy-details label,
.shogi-game__opening-tendency label {
  display: grid;
  gap: 0.28em;
  min-width: 0;
}
.shogi-game__strategy-details label > span,
.shogi-game__opening-tendency label > span {
  font-size: 0.82em;
  opacity: 0.9;
}
.shogi-game__pregame-field--opening-tendency {
  grid-column: 1 / -1;
}
.shogi-game__pregame-field--opening-tendency > summary {
  display: flex;
  gap: 0.6em;
  align-items: baseline;
  justify-content: space-between;
  list-style: none;
  cursor: pointer;
}
.shogi-game__pregame-field--opening-tendency > summary::-webkit-details-marker {
  display: none;
}
.shogi-game__pregame-field--opening-tendency > summary::after {
  color: var(--amber);
  content: "▾";
}
.shogi-game__pregame-field--opening-tendency[open] > summary::after {
  content: "▴";
}
.shogi-game__pregame-field--opening-tendency > summary small {
  flex: 1 1 auto;
  color: var(--muted);
  font-size: 0.85em;
  text-align: right;
}
.shogi-game__pregame-hint {
  color: var(--muted);
  font-size: 0.8em;
}
.shogi-game__pregame-footer {
  display: grid;
  justify-items: center;
  gap: 0.7em;
  margin-top: 1em;
}
.shogi-game__pregame-note {
  margin: 0;
  color: var(--muted);
  text-align: center;
}
.shogi-game .shogi-game__pregame-start {
  width: min(18em, 100%);
  min-height: 3.1em;
  border-color: var(--amber);
  color: var(--night-deep);
  background: var(--amber);
  box-shadow: 0 3px 0 #a96924;
  font-size: 1.1em;
  font-weight: 800;
}
.shogi-game--narrow .shogi-game__pregame-grid {
  grid-template-columns: minmax(0, 1fr);
  gap: 0.5em;
}
.shogi-game--narrow .shogi-game__pregame-field {
  padding: 0.55em 0.65em;
}
.shogi-game--narrow .shogi-game__pregame-heading {
  margin-bottom: 0.7em;
}
.shogi-game--narrow .shogi-game__pregame-heading h2 {
  font-size: 1.35em;
}
/* 対局準備の下端に開始ボタンを固定し、長い設定でも押しやすくする。 */
.shogi-game--narrow .shogi-game__pregame-footer,
.shogi-game--short .shogi-game__pregame-footer {
  position: sticky;
  bottom: calc(-1 * clamp(0.9em, 3vw, 2em));
  margin-inline: calc(-1 * clamp(0.9em, 3vw, 2em));
  padding: 0.6em clamp(0.9em, 3vw, 2em) clamp(0.9em, 3vw, 2em);
  background: linear-gradient(180deg, rgba(46, 74, 96, 0) 0, var(--slate) 0.8em);
}

/* ===== 終局 ===== */
.shogi-game__result {
  position: absolute;
  z-index: 100;
  inset: 0;
  display: grid;
  overflow: hidden;
  place-items: center;
  padding: 1em;
  background: rgba(14, 29, 40, 0.86);
  backdrop-filter: blur(0.35rem);
  animation: result-backdrop-in 360ms ease-out both;
}
.shogi-game__result-panel {
  position: relative;
  width: min(32em, 100%);
  max-height: 100%;
  overflow: auto;
  padding: clamp(1.2em, 4vw, 2.8em);
  border: 1px solid var(--result-accent);
  border-top-width: 4px;
  border-radius: 0.3em;
  color: var(--ivory);
  background: var(--night-deep);
  box-shadow: 0 1.2em 3.2em rgba(7, 18, 26, 0.62);
  text-align: center;
  animation: result-panel-in 620ms cubic-bezier(0.2, 1.3, 0.3, 1) both;
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
  margin: 0;
  color: var(--ivory);
  font-size: clamp(2.6em, 12vmin, 4.6em);
  line-height: 1;
  letter-spacing: 0.12em;
  text-indent: 0.12em;
  text-shadow: 0 0.15rem 0 var(--slate);
}
.shogi-game__result--defeat h2 {
  animation: result-defeat-pulse 2.2s ease-in-out infinite;
}
.shogi-game__result-details {
  display: grid;
  gap: 0.45em;
  margin: 1.2em 0 1.3em;
  text-align: left;
}
.shogi-game__result-details > div {
  display: grid;
  grid-template-columns: 5.5em minmax(0, 1fr);
  gap: 0.75em;
  padding: 0.5em 0.65em;
  border-bottom: 1px solid rgba(245, 166, 69, 0.3);
  background: rgba(46, 74, 96, 0.35);
}
.shogi-game__result-details dt {
  color: var(--result-accent);
  font-weight: 700;
}
.shogi-game__result-details dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
}
.shogi-game .shogi-game__rematch {
  border-color: var(--amber);
  background: #735036;
}
.shogi-game__result-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(8em, 1fr));
  gap: 0.65em;
}
.shogi-game__result-actions button {
  min-width: 0;
  min-height: 3em;
}
.shogi-game--short .shogi-game__result-details {
  margin: 0.8em 0;
}
.shogi-game--short .shogi-game__result-details > div {
  padding-block: 0.3em;
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
  background: var(--amber);
  animation: result-confetti-fall 2.8s ease-in infinite;
}
.shogi-game__confetti i:nth-child(3n) { background: var(--lavender); }
.shogi-game__confetti i:nth-child(3n + 1) { background: var(--ivory); }
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
  .shogi-game__confetti i,
  .shogi-game__menu,
  .shogi-game__analysis-menu {
    animation: none;
  }
}

/* ===== ホーム画面(原型) ===== */
/* 縦画面メディアクエリの portrait 補助表示(display: grid)より優先させる。 */
/* ホーム画面では対局UIを隠す。定跡図鑑はホームから開くため例外。 */
.shogi-game--home > :not(.shogi-home):not(.shogi-dex) { display: none !important; }
.shogi-home {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 40px;
  padding: 24px;
  overflow: hidden;
  background: #1d2b3a;
  color: var(--ink, #fff8ec);
  font-family: "Courier New", "Hiragino Kaku Gothic ProN", "Yu Gothic", monospace;
}
.shogi-home__star { position: absolute; pointer-events: none; }
.shogi-home__star::before,
.shogi-home__star::after {
  content: "";
  position: absolute;
  background: currentColor;
}
.shogi-home__star::before {
  left: 33%;
  top: 0;
  width: 34%;
  height: 100%;
}
.shogi-home__star::after {
  left: 0;
  top: 33%;
  width: 100%;
  height: 34%;
}
.shogi-home__moon {
  position: absolute;
  right: 12%;
  top: 10%;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #f2e3c2;
  box-shadow: inset -12px -6px 0 0 #1d2b3a;
}
.shogi-home__chara {
  position: absolute;
  left: 50%;
  bottom: 3vh;
  height: clamp(130px, 26vh, 220px);
  width: auto;
  pointer-events: none;
  image-rendering: pixelated;
  animation: shogi-home-chara-float 4.5s ease-in-out infinite;
}
/* 中央寄せはアニメーションのtransformと競合するため、keyframes側で行う。 */
@keyframes shogi-home-chara-float {
  0%,
  100% {
    transform: translateX(-50%) translateY(0);
  }
  50% {
    transform: translateX(-50%) translateY(-8px);
  }
}
.shogi-home__title { text-align: center; }
.shogi-home__title h1 {
  margin: 0;
  font-size: clamp(36px, 7vw, 64px);
  letter-spacing: 0.06em;
  font-weight: 700;
  color: #f6f2e8;
  text-shadow: 3px 3px 0 #14212e;
}
.shogi-home__menu {
  display: grid;
  grid-template-columns: repeat(4, minmax(120px, 180px));
  gap: clamp(12px, 2.5vw, 28px);
}
.shogi-home__card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 22px 10px 18px;
  border: 2px solid rgba(242, 227, 194, 0.4);
  border-radius: 8px;
  background: rgba(37, 58, 77, 0.9);
  box-shadow: 4px 4px 0 rgba(16, 26, 36, 0.8);
  color: #f6f2e8;
  font: inherit;
  cursor: pointer;
}
.shogi-home__card:not(:disabled):hover {
  border-color: #e8a04c;
  transform: translate(-1px, -1px);
  box-shadow: 5px 5px 0 rgba(16, 26, 36, 0.8);
}
.shogi-home__card:disabled { cursor: default; opacity: 0.72; }
.shogi-home__icon { width: 56px; height: 56px; }
.shogi-home__label { font-size: 16px; font-weight: 700; letter-spacing: 0.08em; }
.shogi-home__soon {
  position: absolute;
  right: 6px;
  top: 6px;
  padding: 2px 6px;
  border-radius: 4px;
  background: #e8a04c;
  color: #1d2b3a;
  font-size: 10px;
  font-weight: 700;
}
.shogi-home__koma-char {
  font-size: 9px;
  font-weight: 700;
  fill: #1d2b3a;
  text-anchor: middle;
  font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif;
}
@media (max-width: 640px) {
  .shogi-home { gap: 28px; }
  .shogi-home__menu { grid-template-columns: repeat(2, minmax(120px, 1fr)); width: 100%; max-width: 360px; }
  .shogi-home__icon { width: 44px; height: 44px; }
}
</style>
