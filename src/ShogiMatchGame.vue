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
    <div v-if="homeOpen" class="shogi-home shogi-home--title" aria-label="ホーム">
      <span
        v-for="star in HOME_STARS"
        :key="star.id"
        class="shogi-home__star"
        :style="star.style"
        aria-hidden="true"
      ></span>
      <span class="shogi-home__moon" aria-hidden="true"></span>
      <!--
        タイトル画面。いまの状態に合った「つぎはこれ」を1枚だけ大きく出し、その下に記録の帯と、
        あそぶ・まなぶ・しらべるの3つの入口を並べる。広い画面ではタイトルとやこび姫を左の列に置く。
      -->
      <div class="shogi-title__hero">
        <h1 class="shogi-title__logo">shogi-match</h1>
        <p class="shogi-title__bubble" aria-hidden="true">{{ homeGreeting }}</p>
        <img
          class="shogi-title__chara"
          :src="`${assetBaseUrl}/characters/yakobihime-mini.webp?v=2`"
          alt=""
          aria-hidden="true"
        >
      </div>
      <nav class="shogi-title__menu" aria-label="メニュー">
        <button
          type="button"
          class="shogi-title__next"
          :data-next="homeNext.id"
          @click="startHomeNext"
        >
          <span class="shogi-title__next-eyebrow">つぎはこれ</span>
          <span class="shogi-title__next-icon" aria-hidden="true">
            <template v-if="homeNext.id === 'resume'">
              <svg class="shogi-title__icon" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
                <g fill="#f1a54c">
                  <rect x="4" y="2" width="2" height="12" />
                  <rect x="7" y="3" width="2" height="10" />
                  <rect x="9" y="4" width="2" height="8" />
                  <rect x="11" y="5" width="2" height="6" />
                </g>
              </svg>
            </template>
            <template v-else-if="homeNext.id === 'tutorial'">
              <svg class="shogi-title__icon" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
                <g fill="#f1a54c">
                  <rect x="1" y="5" width="14" height="1" />
                  <rect x="3" y="4" width="10" height="1" />
                  <rect x="6" y="3" width="4" height="1" />
                  <rect x="12" y="6" width="1" height="4" />
                </g>
                <g fill="#fffcf4">
                  <rect x="4" y="7" width="8" height="5" />
                  <rect x="3" y="12" width="10" height="1" />
                </g>
                <g fill="#f1a54c">
                  <rect x="6" y="9" width="4" height="1" />
                </g>
              </svg>
            </template>
            <template v-else>
              <svg class="shogi-title__icon" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
                <g fill="#fffcf4">
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
                <g fill="#f1a54c">
                  <rect x="3" y="3" width="2" height="2" />
                  <rect x="12" y="9" width="2" height="2" />
                </g>
              </svg>
            </template>
          </span>
          <span class="shogi-title__next-label">{{ homeNext.label }}</span>
          <small class="shogi-title__next-desc">{{ homeNext.description }}</small>
          <span class="shogi-title__next-go" aria-hidden="true">▶ はじめる</span>
        </button>

        <!-- 記録の帯。いまの棋力と所属を見せ、押すとやこびノートを開く。 -->
        <button type="button" class="shogi-title__record" @click="yakobiNoteOpen = true">
          <svg class="shogi-title__icon" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
            <g fill="#f1a54c">
              <rect x="3" y="1" width="10" height="14" />
            </g>
            <g fill="#fffcf4">
              <rect x="4" y="2" width="8" height="12" />
            </g>
            <g fill="#1d303f">
              <rect x="5" y="10" width="2" height="2" />
              <rect x="8" y="7" width="2" height="5" />
              <rect x="11" y="4" width="1" height="8" />
            </g>
          </svg>
          <span class="shogi-title__record-main">
            <strong>R{{ ratingState.rating }}</strong>
            <span>{{ recommendedStrengthPreset.label.replace(/程度$/, "") }}</span>
            <span v-if="homeAffiliation" class="shogi-title__record-badge">{{ homeAffiliation }}</span>
          </span>
          <span class="shogi-title__record-link">やこびノート <span aria-hidden="true">›</span></span>
        </button>

        <div class="shogi-title__groups">
          <section class="shogi-title__group" aria-labelledby="shogi-home-play">
            <h2 id="shogi-home-play" class="shogi-title__group-title">あそぶ</h2>
            <div class="shogi-title__tiles">
              <button type="button" class="shogi-title__tile" @click="openMatchSetup('normal')">
                <svg class="shogi-title__icon" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
                  <g fill="#fffcf4">
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
                  <g fill="#f1a54c">
                    <rect x="3" y="3" width="2" height="2" />
                    <rect x="12" y="9" width="2" height="2" />
                  </g>
                </svg>
                <span class="shogi-title__label">自由対局</span>
                <small class="shogi-title__desc">設定を選んで1局</small>
              </button>
              <button type="button" class="shogi-title__tile" @click="openTournamentScreen">
                <svg class="shogi-title__icon" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
                  <g fill="#f1a54c">
                    <rect x="4" y="2" width="8" height="1" />
                    <rect x="4" y="3" width="8" height="4" />
                    <rect x="2" y="3" width="2" height="1" />
                    <rect x="12" y="3" width="2" height="1" />
                    <rect x="5" y="7" width="6" height="1" />
                    <rect x="7" y="8" width="2" height="3" />
                    <rect x="5" y="11" width="6" height="2" />
                  </g>
                </svg>
                <span class="shogi-title__label">大会</span>
                <small class="shogi-title__desc">竜王戦で称号を</small>
              </button>
              <button type="button" class="shogi-title__tile" data-endgame-tile @click="startEndgameMatch">
                <svg class="shogi-title__icon" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
                  <g fill="#f1a54c">
                    <rect x="7" y="1" width="2" height="2" />
                    <rect x="6" y="3" width="4" height="2" />
                    <rect x="5" y="5" width="6" height="6" />
                    <rect x="4" y="11" width="8" height="2" />
                  </g>
                  <g fill="#fffcf4">
                    <rect x="2" y="13" width="12" height="2" />
                    <rect x="7" y="7" width="2" height="2" />
                  </g>
                </svg>
                <span class="shogi-title__label">終盤戦</span>
                <small class="shogi-title__desc">名局の終盤から</small>
              </button>
            </div>
          </section>
          <section class="shogi-title__group" aria-labelledby="shogi-home-school">
            <h2 id="shogi-home-school" class="shogi-title__group-title">まなぶ</h2>
            <div class="shogi-title__tiles">
              <button type="button" class="shogi-title__tile" @click="tutorialOpen = true">
                <svg class="shogi-title__icon" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
                  <g fill="#f1a54c">
                    <rect x="1" y="5" width="14" height="1" />
                    <rect x="3" y="4" width="10" height="1" />
                    <rect x="6" y="3" width="4" height="1" />
                    <rect x="12" y="6" width="1" height="4" />
                  </g>
                  <g fill="#fffcf4">
                    <rect x="4" y="7" width="8" height="5" />
                    <rect x="3" y="12" width="10" height="1" />
                  </g>
                  <g fill="#f1a54c">
                    <rect x="6" y="9" width="4" height="1" />
                  </g>
                </svg>
                <span class="shogi-title__label">将棋教室</span>
                <small class="shogi-title__desc">ルールから戦法まで</small>
              </button>
              <button type="button" class="shogi-title__tile" @click="problemSetOpen = true">
                <svg class="shogi-title__icon" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
                  <g fill="#fffcf4">
                    <rect x="5" y="2" width="6" height="1" />
                    <rect x="4" y="3" width="2" height="2" />
                    <rect x="10" y="3" width="2" height="3" />
                    <rect x="8" y="6" width="3" height="1" />
                    <rect x="7" y="7" width="2" height="3" />
                  </g>
                  <g fill="#f1a54c">
                    <rect x="7" y="12" width="2" height="2" />
                  </g>
                </svg>
                <span class="shogi-title__label">問題集</span>
                <small class="shogi-title__desc">詰ませ方・逃げ方</small>
              </button>
            </div>
          </section>
          <section class="shogi-title__group shogi-title__group--dex" aria-labelledby="shogi-home-dex">
            <h2 id="shogi-home-dex" class="shogi-title__group-title">しらべる</h2>
            <div class="shogi-title__tiles shogi-title__tiles--dex">
              <button type="button" class="shogi-title__tile shogi-title__tile--small" @click="referenceDexKind = 'piece'">
                <svg class="shogi-title__icon" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
                  <g fill="#f1a54c">
                    <rect x="5" y="1" width="6" height="1" />
                    <rect x="4" y="2" width="8" height="2" />
                    <rect x="3" y="4" width="10" height="8" />
                    <rect x="4" y="12" width="8" height="2" />
                    <rect x="5" y="14" width="6" height="1" />
                  </g>
                  <text x="8" y="11" class="shogi-home__koma-char" aria-hidden="true">飛</text>
                </svg>
                <span class="shogi-title__label">駒図鑑</span>
              </button>
              <button type="button" class="shogi-title__tile shogi-title__tile--small" @click="referenceDexKind = 'tesuji'">
                <svg class="shogi-title__icon" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
                  <g fill="#fffcf4">
                    <rect x="3" y="2" width="10" height="12" />
                    <rect x="2" y="1" width="2" height="14" />
                  </g>
                  <g fill="#f1a54c">
                    <rect x="6" y="4" width="6" height="1" />
                    <rect x="6" y="6" width="6" height="1" />
                    <rect x="6" y="8" width="6" height="1" />
                    <rect x="6" y="10" width="4" height="1" />
                  </g>
                </svg>
                <span class="shogi-title__label">手筋図鑑</span>
              </button>
              <button type="button" class="shogi-title__tile shogi-title__tile--small" @click="dexOpen = true">
                <svg class="shogi-title__icon" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
                  <g fill="#fffcf4">
                    <rect x="2" y="3" width="5" height="10" />
                    <rect x="9" y="3" width="5" height="10" />
                    <rect x="7" y="2" width="2" height="12" />
                  </g>
                  <g fill="#f1a54c">
                    <rect x="3" y="4" width="3" height="1" />
                    <rect x="3" y="6" width="3" height="1" />
                    <rect x="3" y="8" width="3" height="1" />
                    <rect x="10" y="4" width="3" height="1" />
                    <rect x="10" y="6" width="3" height="1" />
                    <rect x="10" y="8" width="3" height="1" />
                  </g>
                </svg>
                <span class="shogi-title__label">定跡図鑑</span>
              </button>
              <button type="button" class="shogi-title__tile shogi-title__tile--small" @click="referenceDexKind = 'world'">
                <svg class="shogi-title__icon" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
                  <g fill="#f1a54c">
                    <rect x="3" y="2" width="10" height="5" />
                    <rect x="1" y="3" width="2" height="3" />
                    <rect x="13" y="3" width="2" height="3" />
                    <rect x="5" y="7" width="6" height="2" />
                    <rect x="7" y="9" width="2" height="2" />
                    <rect x="4" y="11" width="8" height="2" />
                  </g>
                  <g fill="#fffcf4">
                    <rect x="7" y="3" width="2" height="3" />
                    <rect x="3" y="13" width="10" height="1" />
                  </g>
                </svg>
                <span class="shogi-title__label">将棋界図鑑</span>
              </button>
              <button type="button" class="shogi-title__tile shogi-title__tile--small" @click="referenceDexKind = 'glossary'">
                <svg class="shogi-title__icon" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
                  <g fill="#f1a54c">
                    <rect x="3" y="1" width="10" height="14" />
                  </g>
                  <g fill="#fffcf4">
                    <rect x="4" y="2" width="8" height="12" />
                    <rect x="13" y="3" width="2" height="2" />
                    <rect x="13" y="7" width="2" height="2" />
                    <rect x="13" y="11" width="2" height="2" />
                  </g>
                  <g fill="#1d303f">
                    <rect x="5" y="4" width="4" height="1" />
                    <rect x="5" y="6" width="6" height="1" />
                    <rect x="5" y="8" width="6" height="1" />
                    <rect x="5" y="10" width="5" height="1" />
                  </g>
                </svg>
                <span class="shogi-title__label">用語辞典</span>
              </button>
            </div>
          </section>
        </div>
      </nav>
    </div>

    <ShogiTutorial
      v-if="tutorialOpen"
      ref="tutorialView"
      :asset-base-url="assetBaseUrl"
      :match-report="tutorialReport"
      @close="tutorialOpen = false; tutorialReport = null"
      @open-dex="openDexFromTutorial"
      @start-match="startMatchFromTutorial"
    />
    <ShogiProblemSet
      v-if="problemSetOpen"
      ref="problemSetView"
      :asset-base-url="assetBaseUrl"
      @close="problemSetOpen = false"
    />
    <!-- 図鑑は教室の上に重ねて開き、閉じると教室へ戻る。 -->
    <ShogiOpeningDex
      v-if="dexOpen"
      :initial-id="openingDexInitialId"
      :asset-base-url="assetBaseUrl"
      :back-label="tutorialOpen ? '戻る' : 'タイトルへ戻る'"
      @close="dexOpen = false; openingDexInitialId = ''"
    />
    <ShogiTournament
      v-if="tournamentOpen"
      ref="tournamentView"
      :asset-base-url="assetBaseUrl"
      :back-label="tutorialOpen ? '戻る' : 'タイトルへ戻る'"
      :career="ryuoCareer"
      :view="ryuoView"
      :default-difficulty="ryuoDefaultDifficulty"
      :user-level="recommendedStrengthPreset.level"
      :rating-text="`R${ratingState.rating}`"
      :start-at="tournamentStartAt"
      :oshi="ryuoOshi"
      @close="tournamentOpen = false"
      @enter="enterRyuoSeason"
      @play="startRyuoGame"
      @open-note="tournamentOpen = false; yakobiNoteOpen = true"
      @result-seen="markRyuoResultSeen"
    />
    <YakobiNote
      v-if="yakobiNoteOpen"
      :asset-base-url="assetBaseUrl"
      :back-label="tutorialOpen ? '戻る' : 'タイトルへ戻る'"
      :state="ratingState"
      :profile="profileState"
      :career="ryuoCareer"
      :roster="ryuoRoster"
      @close="yakobiNoteOpen = false"
      @start-match="startMatchFromNote"
      @start-measure="startMeasureMatch"
      @declare="declareGrade"
    />
    <ShogiReferenceDex
      v-if="referenceDexKind"
      ref="referenceDexView"
      :kind="referenceDexKind"
      :analysis-engine="dexAnalysisEngine"
      :initial-id="referenceDexInitialId"
      :asset-base-url="assetBaseUrl"
      :back-label="tutorialOpen ? '戻る' : 'タイトルへ戻る'"
      @close="referenceDexKind = ''"
    />

    <header class="shogi-game__header">
      <div
        class="shogi-game__status"
        :class="{ 'shogi-game__status--check': sideToMoveInCheck && !reviewMode }"
        aria-live="polite"
      >
        <strong>{{ statusText }}</strong>
        <div
          v-if="cpuThinkingShown"
          class="shogi-game__think"
          role="progressbar"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="cpuSearchGauge ? cpuGaugePercent : undefined"
          :aria-label="cpuSearchGauge
            ? `読んだ局面 ${formatNodeCount(Math.floor(cpuSearchGauge.nodes))}／${formatNodeCount(cpuSearchGauge.target)}`
            : '考え中'"
        >
          <div class="shogi-game__think-track">
            <div
              class="shogi-game__think-fill"
              :class="{ 'shogi-game__think-fill--busy': !cpuSearchGauge }"
              :style="cpuSearchGauge ? { width: `${cpuGaugePercent}%` } : undefined"
            />
          </div>
          <small v-if="cpuSearchGauge" class="shogi-game__think-count">
            {{ formatNodeCount(Math.floor(cpuSearchGauge.nodes)) }}／{{ formatNodeCount(cpuSearchGauge.target) }}
          </small>
        </div>
        <div
          v-if="measureAnalyzing"
          class="shogi-game__think"
          role="progressbar"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="measureProgressPercent"
          aria-label="棋力の測定の進み具合"
          data-measuring
        >
          <div class="shogi-game__think-track">
            <div
              class="shogi-game__think-fill"
              :class="{ 'shogi-game__think-fill--busy': !analysisRunning }"
              :style="analysisRunning ? { width: `${measureProgressPercent}%` } : undefined"
            />
          </div>
          <small class="shogi-game__think-count">
            {{ analysisRunning ? `${ANALYSIS_STAGE_LABELS[analysisStage as keyof typeof ANALYSIS_STAGE_LABELS] ?? "解析"} ${analysisProgress}/${analysisTotal}` : "準備中" }}
          </small>
        </div>
        <span>{{ moveCount }}手目</span>
      </div>
      <div
        class="shogi-game__toolbar"
        :class="{ 'shogi-game__toolbar--learning': matchKind === 'learning' }"
      >
        <template v-if="!menuCollapsed">
          <button
            v-if="!(reviewMode && measureAnalyzing)"
            type="button"
            class="shogi-game__command"
            :class="reviewMode ? 'shogi-game__command--complete' : 'shogi-game__command--danger'"
            :disabled="!active"
            @click="reviewMode ? completeReview() : requestResign()"
          >{{ reviewMode ? "完了" : "投了" }}</button>
          <button
            v-if="showHome && !reviewMode"
            type="button"
            class="shogi-game__command"
            :disabled="!active"
            @click="suspendConfirmOpen = true"
          >中断</button>
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
            v-if="!(reviewMode && measureAnalyzing)"
            type="button"
            role="menuitem"
            class="shogi-game__menu-item"
            :class="reviewMode ? 'shogi-game__menu-item--complete' : 'shogi-game__menu-item--danger'"
            :disabled="!active"
            @click="closeSettings(); reviewMode ? completeReview() : requestResign()"
          >{{ reviewMode ? "検討を完了する" : "投了する" }}</button>
          <button
            v-if="showHome && !reviewMode"
            type="button"
            role="menuitem"
            class="shogi-game__menu-item"
            :disabled="!active"
            @click="closeSettings(); suspendConfirmOpen = true"
          >対局を中断する</button>
        </template>
        <!-- 盤の反転（ひふみんアイ）は、どの画面の形でもこのメニューから切り替える。 -->
        <button
          type="button"
          role="menuitemcheckbox"
          class="shogi-game__menu-item"
          aria-label="盤面を上下反転（ひふみんアイ）"
          :aria-checked="boardFlipOverride"
          @click="boardFlipOverride = !boardFlipOverride"
        >盤を反転（ひふみんアイ）<b>{{ boardFlipOverride ? "ON" : "OFF" }}</b></button>
        <button
          v-if="matchKind === 'learning'"
          type="button"
          role="menuitemcheckbox"
          class="shogi-game__menu-item"
          :aria-checked="movementArrowsEnabled"
          @click="movementArrowsEnabled = !movementArrowsEnabled"
        >選んだ駒の動きを矢印で表示<b>{{ movementArrowsEnabled ? "ON" : "OFF" }}</b></button>
        <button
          type="button"
          role="menuitemcheckbox"
          class="shogi-game__menu-item"
          :aria-checked="soundEnabled"
          data-sound-toggle
          @click="toggleSound"
        >効果音<b>{{ soundEnabled ? "ON" : "OFF" }}</b></button>
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
        <header class="shogi-game__pregame-titlebar">
          <!-- ホーム画面を表示する構成のときだけタイトルへ戻れる。 -->
          <button
            v-if="showHome"
            type="button"
            class="shogi-game__pregame-back"
            aria-label="タイトルへ戻る"
            @click="openHome"
          >
            <span aria-hidden="true">←</span><span class="shogi-game__pregame-back-label">タイトル</span>
          </button>
          <h2 id="pregame-title">対局設定</h2>
        </header>
        <div class="shogi-game__pregame-body">
          <div class="shogi-game__pregame-kind">
            <div class="shogi-game__segmented" role="radiogroup" aria-label="対局の種類">
              <button
                v-for="kind in MATCH_KIND_OPTIONS"
                :key="kind.value"
                type="button"
                role="radio"
                :aria-checked="matchKind === kind.value"
                @click="matchKind = kind.value"
              >
                {{ kind.label }}
              </button>
            </div>
            <small>{{ MATCH_KIND_OPTIONS.find(({ value }) => value === matchKind)?.description }}</small>
          </div>

          <!-- 開始局面で下に出る項目が変わるため、学習対局では最初に選ばせる。 -->
          <div v-if="matchKind === 'learning'" class="shogi-game__pregame-section shogi-game__pregame-start-type">
            <span id="pregame-start-type" class="shogi-game__pregame-row-label">開始局面</span>
            <div class="shogi-game__checks" role="radiogroup" aria-labelledby="pregame-start-type">
              <button
                v-for="option in LEARNING_START_OPTIONS"
                :key="option.value"
                type="button"
                role="radio"
                class="shogi-game__check"
                :aria-checked="learningStartType === option.value"
                @click="learningStartType = option.value as LearningStartType"
              >
                <span class="shogi-game__check-box" aria-hidden="true"></span>
                {{ option.label }}
              </button>
            </div>
          </div>

          <section
            v-for="side in pregameSides"
            :key="side.color"
            class="shogi-game__pregame-section shogi-game__pregame-side"
            :aria-label="side.label"
          >
            <div class="shogi-game__pregame-side-head">
              <span class="shogi-game__pregame-side-label">{{ side.label }}<small v-if="side.role">{{ side.role }}</small></span>
              <img
                class="shogi-game__pregame-avatar"
                :src="pregameKingImageUrl(side.color)"
                alt=""
                draggable="false"
              />
              <span class="shogi-game__pregame-name">
                <strong>{{ side.name }}</strong>
                <small v-if="side.detail">{{ side.detail }}</small>
              </span>
              <!-- 手番（駒落ちでは駒を落とす側）を入れ替える。 -->
              <button
                v-if="side.color === 'white' && normalizedMode === 'cpu'"
                type="button"
                class="shogi-game__pregame-swap"
                :aria-label="pregameUsesHandicap ? '上手と下手を入れ替える' : '先手と後手を入れ替える'"
                :title="pregameUsesHandicap ? '上手と下手を入れ替える' : '先手と後手を入れ替える'"
                @click="swapPregameColors"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M7 3v14M7 3 3 7M7 3l4 4M17 21V7M17 21l-4-4M17 21l4-4" />
                </svg>
              </button>
            </div>
            <div v-if="side.rows.length" class="shogi-game__pregame-rows">
              <template v-for="row in side.rows" :key="row.id">
                <div
                  v-if="row.kind === 'switch'"
                  class="shogi-game__pregame-row"
                  :class="{ 'shogi-game__pregame-row--fresh': pregameFreshRows.has(row.id) }"
                  :data-pregame-row="row.id"
                >
                  <span v-if="pregameFreshRows.has(row.id)" class="shogi-game__pregame-fresh" aria-hidden="true"></span>
                  <span class="shogi-game__pregame-row-label">{{ row.label }}</span>
                  <button
                    type="button"
                    role="switch"
                    class="shogi-game__switch"
                    :aria-checked="row.checked"
                    :aria-label="row.label"
                    @click="toggleCpuStrategyDetails"
                  ><span aria-hidden="true"></span></button>
                </div>
                <div
                  v-else
                  class="shogi-game__pregame-row"
                  :class="{ 'shogi-game__pregame-row--fresh': pregameFreshRows.has(row.id) }"
                  :data-pregame-row="row.id"
                >
                  <span v-if="pregameFreshRows.has(row.id)" class="shogi-game__pregame-fresh" aria-hidden="true"></span>
                  <span class="shogi-game__pregame-row-label">{{ row.label }}:</span>
                  <span class="shogi-game__pregame-value" :class="{ 'shogi-game__pregame-value--muted': row.disabled }">{{ row.value }}</span>
                  <button
                    type="button"
                    class="shogi-game__pregame-change"
                    :disabled="row.disabled"
                    :aria-label="`${side.label}の${row.label}を変更`"
                    @click="pregamePicker = row.id"
                  >変更</button>
                </div>
              </template>
            </div>
          </section>

          <section class="shogi-game__pregame-section" aria-label="対局の条件">
            <div class="shogi-game__pregame-rows">
              <div
                v-for="row in pregameCommonRows"
                :key="row.id"
                class="shogi-game__pregame-row"
                :class="{ 'shogi-game__pregame-row--fresh': pregameFreshRows.has(row.id) }"
                :data-pregame-row="row.id"
              >
                <span v-if="pregameFreshRows.has(row.id)" class="shogi-game__pregame-fresh" aria-hidden="true"></span>
                <span class="shogi-game__pregame-row-label">{{ row.label }}:</span>
                <span class="shogi-game__pregame-value">{{ row.value }}</span>
                <button
                  type="button"
                  class="shogi-game__pregame-change"
                  :aria-label="`${row.label}を変更`"
                  @click="pregamePicker = row.id"
                >変更</button>
              </div>
            </div>
            <p
              v-if="learningFormationMessage"
              class="shogi-game__pregame-message"
              :class="{ 'shogi-game__pregame-message--error': learningStartBlocked }"
              role="status"
            >{{ learningFormationMessage }}</p>
            <p v-if="ratingRecommendation" class="shogi-game__pregame-message" data-rating-recommendation>
              あなたのレーティング: R{{ ratingState.rating }}（{{ nearestRatingLabel }}・{{ ratingState.games }}局）。
              おすすめの強さ: Lv.{{ recommendedStrengthPreset.level }} {{ recommendedStrengthPreset.label }}
              <button
                type="button"
                class="shogi-game__pregame-change"
                :disabled="searchNodes === recommendedStrengthPreset.value"
                @click="searchNodes = recommendedStrengthPreset.value"
              >おすすめにする</button>
            </p>
            <p v-if="pregameUsesHandicap" class="shogi-game__pregame-message">
              駒を落とす側（上手）は後手です。後手の欄の入れ替えボタンで、上手と下手を入れ替えられます。
            </p>
            <p v-if="matchKind === 'learning'" class="shogi-game__pregame-message">
              対局中は「駒の利き」ボタンで、各マスに利いている駒の数を表示できます。
              選んだ駒が動ける方向の矢印は、メニューの「選んだ駒の動きを矢印で表示」で切り替えられます。
            </p>
          </section>
        </div>
        <div class="shogi-game__pregame-footer">
          <p v-if="normalizedMode === 'cpu'" class="shogi-game__pregame-note">
            {{ engineUnavailable ? "簡易CPUで対局します" : engineReady ? "準備できました" : "対局AIを準備しています…" }}
          </p>
          <button
            type="button"
            class="shogi-game__pregame-start"
            :disabled="(normalizedMode === 'cpu' && !engineReady && !engineUnavailable) || learningStartBlocked"
            @click="beginMatch"
          >
            {{ normalizedMode === "cpu" && !engineReady && !engineUnavailable ? "準備中…" : "対局開始" }}
          </button>
        </div>
      </div>
      <PregamePicker
        v-if="pregamePickerConfig"
        :title="pregamePickerConfig.title"
        :sections="pregamePickerConfig.sections"
        :note="pregamePickerConfig.note"
        @select="onPregamePick"
        @close="pregamePicker = ''"
      />
    </div>

    <section
      v-if="cpuColor !== null || blackFormationText !== UNDETERMINED_FORMATION || whiteFormationText !== UNDETERMINED_FORMATION"
      class="shogi-game__summary"
      aria-label="対戦相手と戦型"
    >
      <div v-if="cpuColor !== null" class="shogi-game__summary-opponent">
        <b>対戦相手</b>
        <span>{{ cpuColor === Color.BLACK ? "☗" : "☖" }}{{ cpuDisplayName }}<small v-if="cpuStrengthLabel">{{ cpuStrengthLabel }}</small></span>
      </div>
      <!-- 戦型は決まってから出す。「未判定」を並べて画面の上を埋めない。 -->
      <div v-if="blackFormationText !== UNDETERMINED_FORMATION"><b>先手</b><span>{{ blackFormationText }}</span></div>
      <div v-if="whiteFormationText !== UNDETERMINED_FORMATION"><b>後手</b><span>{{ whiteFormationText }}</span></div>
    </section>

    <section
      v-if="openingGuideAvailable || matchKind === 'learning'"
      class="shogi-game__opening-guide"
      :class="{ 'shogi-game__opening-guide--collapsed': openingGuideCollapsed }"
      aria-label="やこび姫補助"
    >
      <h2>やこび姫補助</h2>
      <p v-if="!openingGuideAvailable" class="shogi-game__opening-guide-note">駒落ちや完成形からの対局では、定跡の道しるべはお休みだよ。</p>
      <!-- 通常対局で作戦を選んでいないあいだは、1行のボタンにたたむ。選ぶと開き、飛車の振り先などの選択も隠さない。 -->
      <button
        v-if="openingGuideCollapsed"
        type="button"
        class="shogi-game__opening-expand"
        :aria-expanded="false"
        @click="openingGuideExpanded = true"
      >
        <span>作戦を選ぶ</span>
        <small>戦法・囲いを選ぶと、やこび姫が手順を案内するよ</small>
      </button>
      <div v-else-if="openingGuideAvailable" class="shogi-game__opening-selects">
        <div class="shogi-game__opening-strategy-field">
          <label>
            <span>戦法</span>
            <select
              v-model="selectedStrategy"
              aria-label="戦法"
              :disabled="strategySelectLocked"
              @change="announceOpeningGuide"
            >
              <option value="">{{ strategySelectLocked ? "囲いと一体のため選べません" : "選択しない" }}</option>
              <optgroup v-for="group in groupedOpeningStrategies" :key="group.id" :label="group.label">
                <option
                  v-for="strategy in group.options"
                  :key="strategy.id"
                  :value="strategy.id"
                  :disabled="strategy.disabled"
                >
                  {{ strategy.optionLabel }}
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
          <select
            v-model="selectedCastle"
            aria-label="囲い"
            :disabled="castleSelectLocked"
            @change="announceOpeningGuide"
          >
            <option value="">{{ castleSelectLocked ? castleSelectionLockedLabel : "選択しない" }}</option>
            <optgroup v-for="group in groupedOpeningCastles" :key="group.id" :label="group.label">
              <option
                v-for="castle in group.options"
                :key="castle.id"
                :value="castle.id"
                :disabled="castle.disabled"
              >
                {{ castle.optionLabel }}
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

    <div
      ref="boardShell"
      class="shogi-game__board-shell"
      :class="boardImpact ? `shogi-game__board-shell--impact-${boardImpact.stage}` : ''"
      :data-impact="boardImpact?.stage"
      @pointerdown.capture="releaseImpactHold"
    >
      <span v-if="boardImpact" :key="boardImpact.id" class="shogi-game__board-impact" aria-hidden="true"></span>
      <ShogiMatchBoard
        :sfen="currentSfen"
        :last-move="lastMove"
        :allow-move="canMove"
        :enable-drag-and-drop="enableDragAndDrop"
        :flip="flipBoard"
        :mobile="mobile || boardLayout === 'portrait'"
        :layout="boardLayout"
        :asset-base-url="assetBaseUrl"
        :black-player-name="effectiveBlackPlayerName"
        :white-player-name="effectiveWhitePlayerName"
        :black-player-detail="cpuColor === Color.BLACK ? cpuStrengthLabel : ''"
        :white-player-detail="cpuColor === Color.WHITE ? cpuStrengthLabel : ''"
        :candidates="boardCandidates"
        :attack-marks="boardAttackMarks"
        :movement-arrows="matchKind === 'learning' && movementArrowsEnabled && matchStarted && !pregameOpen"
        @usi-move="onPlayerMove"
      />
      <Transition name="shogi-game__callout">
        <div
          v-if="checkCallout"
          :key="checkCallout.id"
          class="shogi-game__check-callout"
          :class="{ 'shogi-game__check-callout--defend': checkCallout.checkedIsHuman }"
          role="status"
        >
          <strong>王手！</strong>
          <small v-if="checkCallout.explain">{{ checkCallout.explain }}</small>
        </div>
      </Transition>
      <Transition name="shogi-game__callout">
        <div
          v-if="furigomaCallout && !checkCallout"
          :key="furigomaCallout.id"
          class="shogi-game__furigoma"
          role="status"
          data-furigoma
        >
          <span class="shogi-game__furigoma-pieces" aria-hidden="true">
            <img
              v-for="(face, index) in furigomaCallout.faces"
              :key="index"
              :src="furigomaPieceUrl(face)"
              :style="{ animationDelay: `${index * 70}ms` }"
              alt=""
            >
          </span>
          <strong>振り駒</strong>
          <small>{{ furigomaCallout.text }}</small>
        </div>
      </Transition>
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
        <span class="shogi-game__dialogue-text"><template
          v-for="(segment, index) in dialogueSegments"
          :key="index"
        ><ruby v-if="segment.ruby">{{ segment.text }}<rt>{{ segment.ruby }}</rt></ruby><template
          v-else
        >{{ segment.text }}</template></template></span>
      </div>
    </section>

    <!--
      対局中の操作列は、閃き・待った（学習対局は駒の利きも）だけにする。盤の反転や動きの矢印は見出しのメニューにしまう。
      棋譜解析中も、閃きと読みは、やこび姫のコメントの下の操作列に置く(通常時の閃き・待ったと同じ場所)。
    -->
    <div class="shogi-game__assist-actions">
      <button
        type="button"
        class="shogi-game__awakening"
        :disabled="!canUseHint"
        @click="showHint"
      >
        閃き <small>×{{ reviewMode ? "∞" : formatAssistCount(hintsRemaining) }}</small>
      </button>
      <!-- 感想戦。押すと、盤で指した手に対局相手のCPUが同じ強さで応える。もう一度押すとやめる。 -->
      <button
        v-if="reviewMode && !guidedReview"
        type="button"
        class="shogi-game__kansousen"
        :aria-pressed="reviewCpuEnabled"
        :disabled="!reviewCpuEnabled && !canStartKansousen"
        @click="toggleKansousen"
      >{{ reviewCpuEnabled ? "感想戦終了" : "感想戦" }}</button>
      <button v-if="!reviewMode || reviewCpuEnabled" type="button" :disabled="!canUndo" @click="undoTurn">
        待った <small>×{{ reviewMode ? "∞" : formatAssistCount(undosRemaining) }}</small>
      </button>
      <button
        v-if="matchKind === 'learning'"
        type="button"
        class="shogi-game__assist-toggle shogi-game__command--attack"
        aria-label="駒の利きを表示"
        :aria-pressed="attackGuideEnabled"
        @click="attackGuideEnabled = !attackGuideEnabled"
      >駒の<wbr>利き</button>
      <button
        v-if="reviewMode && !analysisOpen"
        type="button"
        class="shogi-game__analysis-button"
        :disabled="thinking && !analysisRunning"
        @click="openKifuAnalysis"
      >{{ analysisRunning ? "解析中…" : analysisPoints.length ? "解析グラフ" : "棋譜解析" }}</button>
      <button
        v-if="reviewMode && !analysisOpen && !reviewCpuEnabled"
        type="button"
        class="shogi-game__guided-start shogi-game__guided-start--inline"
        @click="startGuidedReview"
      >▶ 対局を振り返る</button>
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
      <!-- 対局の振り返り。止まる局面では、盤で手を指して答え合わせする。 -->
      <div v-if="guidedReview" class="shogi-game__guided" aria-live="polite">
        <img
          class="shogi-game__guided-chara"
          :src="`${assetBaseUrl}/characters/yakobihime-mini.webp?v=2`"
          alt=""
          aria-hidden="true"
        >
        <div class="shogi-game__guided-body">
          <p class="shogi-game__guided-move">
            <span v-if="guidedReview.phase === 'waiting'">解析中 {{ analysisProgress }}/{{ analysisTotal }}</span>
            <span v-else-if="guidedReview.phase === 'quiz'" class="shogi-game__guided-badge">考えてみよう</span>
            <span v-else-if="guidedReview.phase === 'done'" class="shogi-game__guided-badge">おしまい</span>
            <template v-else>{{ guidedReview.moveLabel || "開始局面" }}</template>
          </p>
          <p class="shogi-game__guided-text">{{ guidedReview.text }}</p>
          <div class="shogi-game__guided-actions">
            <template v-if="guidedReview.phase === 'quiz'">
              <button type="button" @click="revealGuidedReviewAnswer()">答えを見る</button>
              <button type="button" @click="nextGuidedReviewStep">とばす</button>
            </template>
            <button
              v-else-if="guidedReview.phase === 'answer' || (guidedReview.phase === 'paused' && guidedReview.text)"
              type="button"
              class="shogi-game__guided-primary"
              @click="nextGuidedReviewStep"
            >続ける ▶</button>
            <button
              v-else-if="guidedReview.phase === 'playing' || guidedReview.phase === 'paused'"
              type="button"
              @click="toggleGuidedReviewPause"
            >{{ guidedReview.phase === "playing" ? "一時停止" : "再開 ▶" }}</button>
            <!-- やり直しの単位を小さくする。負けた対局では、敗着の答え合わせのあとと振り返りの最後に、その局面から指し直せる。 -->
            <button
              v-if="guidedRetryPly !== null && (guidedReview.phase === 'done' || (guidedReview.phase === 'answer' && guidedReview.quiz?.type === 'losing'))"
              type="button"
              :class="{ 'shogi-game__guided-primary': guidedReview.phase === 'done' }"
              data-retry-from-losing
              @click="retryFromPly(guidedRetryPly)"
            >敗着の前から指し直す</button>
            <button v-if="guidedReview.phase === 'done'" type="button" :class="{ 'shogi-game__guided-primary': guidedRetryPly === null }" @click="startGuidedReview">もう一度</button>
            <button
              v-if="guidedReview.phase !== 'done'"
              type="button"
              class="shogi-game__guided-speed"
              :aria-label="`振り返りの速さ: ${guidedReviewSpeedLabel}。押すと切り替える`"
              @click="cycleGuidedReviewSpeed"
            >速さ: {{ guidedReviewSpeedLabel }}</button>
            <button type="button" @click="stopGuidedReview">{{ guidedReview.phase === "done" ? "閉じる" : "やめる" }}</button>
          </div>
        </div>
      </div>
      <button
        v-else
        type="button"
        class="shogi-game__guided-start"
        :disabled="reviewCpuEnabled"
        @click="startGuidedReview"
      ><span aria-hidden="true">▶</span> 対局を振り返る</button>
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
        <button
          v-if="reviewBranchFrom !== null"
          type="button"
          class="shogi-game__analysis-branch"
          :title="`${reviewBranchFrom + 1}手目から分岐中。押すと本筋に戻る`"
          :aria-label="`${reviewBranchFrom + 1}手目から分岐中。本筋に戻る`"
          @click="returnToMainLine"
        >分岐中・本筋へ</button>
        <span v-if="analysisRunning" class="shogi-game__analysis-progress">
          {{ ANALYSIS_STAGE_LABELS[analysisStage as keyof typeof ANALYSIS_STAGE_LABELS] ?? "解析中" }} {{ analysisProgress }}/{{ analysisTotal }}
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
      <!-- 棋力診断は、棋力測定の対局では常に出す。ほかの解析では、グラフの高さを奪わないよう「その他」から開いた人だけに出す。 -->
      <div v-if="skillDiagnosis && (measureSession || skillDiagnosisVisible)" class="shogi-game__skill" data-skill-diagnosis>
        <template v-if="skillDiagnosis.insufficient">
          <strong>棋力診断</strong>
          <span>測れる手が足りません（{{ skillDiagnosis.count }}手）。もう少し長く指した対局で診断できます。</span>
        </template>
        <template v-else>
          <strong>棋力診断: R{{ skillDiagnosis.rating }}（{{ skillDiagnosis.label }}）</strong>
          <span>
            あなたの{{ skillDiagnosis.count }}手の平均損失は{{ skillDiagnosis.averageLoss }}。
            R{{ skillDiagnosis.ratingLow }}〜R{{ skillDiagnosis.ratingHigh }}の範囲の目安です{{ skillDiagnosis.reliability === "reference" ? "（手数が少ない参考値）" : "" }}。
          </span>
          <!-- レーティングへの設定は、やこびノートの棋力測定の対局だけ。ほかの解析では、診断を表示するだけにする。 -->
          <button v-if="measureSession" type="button" :disabled="ratingState.rating === skillDiagnosis.rating" @click="applySkillDiagnosis">
            {{ ratingState.rating === skillDiagnosis.rating ? "設定済み" : "この棋力をレーティングに設定" }}
          </button>
        </template>
      </div>
      <div class="shogi-game__analysis-actions">
        <div class="shogi-game__analysis-nav">
          <button type="button" aria-label="開始局面へ" :disabled="reviewCpuEnabled || reviewNavigation.cursor === 0" @click="goToAnalysisPly(0)">⏮</button>
          <button type="button" aria-label="一手戻る" :disabled="reviewCpuEnabled || reviewNavigation.cursor === 0" @click="navigateAnalysis(-1)">◀</button>
          <button type="button" aria-label="一手進む" :disabled="reviewCpuEnabled || reviewNavigation.cursor >= reviewNavigation.line.length" @click="navigateAnalysis(1)">▶</button>
          <button type="button" aria-label="最終局面へ" :disabled="reviewCpuEnabled || reviewNavigation.cursor >= reviewNavigation.line.length" @click="goToAnalysisPly(reviewNavigation.line.length)">⏭</button>
        </div>
        <div class="shogi-game__analysis-tools">
          <button
            type="button"
            class="shogi-game__analysis-more"
            :aria-expanded="analysisMenuOpen"
            aria-haspopup="menu"
            @click="analysisMenuOpen = !analysisMenuOpen"
          >その他 <span aria-hidden="true">{{ analysisMenuOpen ? "▴" : "▾" }}</span></button>
        </div>
        <div v-if="analysisMenuOpen" class="shogi-game__analysis-menu" role="menu">
          <button
            type="button"
            role="menuitemcheckbox"
            :aria-checked="boardFlipOverride"
            @click="boardFlipOverride = !boardFlipOverride"
          >ひふみんアイ（盤を反転）：{{ boardFlipOverride ? "ON" : "OFF" }}</button>
          <button
            v-if="skillDiagnosis && !measureSession"
            type="button"
            role="menuitemcheckbox"
            :aria-checked="skillDiagnosisVisible"
            @click="skillDiagnosisVisible = !skillDiagnosisVisible"
          >棋力診断：{{ skillDiagnosisVisible ? "表示中" : "非表示" }}</button>
          <button v-if="reviewNavigation.branch" type="button" role="menuitem" @click="analysisMenuOpen = false; returnToMainLine()">本筋に戻る</button>
          <button
            v-if="result?.reason === 'resignation'"
            type="button"
            role="menuitem"
            :disabled="reviewCpuEnabled || !engineReady || analysisRunning"
            @click="analysisMenuOpen = false; goToAnalysisPly(reviewNavigation.mainLine.length); explainReviewResignation()"
          >投了の理由</button>
          <button v-if="analysisRunning" type="button" role="menuitem" @click="analysisMenuOpen = false; cancelKifuAnalysis()">解析を中止</button>
          <label class="shogi-game__analysis-level shogi-game__analysis-level--menu">
            <span>解析レベル</span>
            <select v-model.number="analysisLevelChoice" :disabled="analysisRunning">
              <option v-for="(level, index) in KIFU_ANALYSIS_LEVELS" :key="level.label" :value="index">
                {{ index + 1 }}. {{ level.label }}{{ index <= analyzedLevel ? "（解析済み）" : "" }}
              </option>
            </select>
          </label>
          <button
            v-if="!analysisRunning"
            type="button"
            role="menuitem"
            :disabled="reviewCpuEnabled || analysisLevelChoice <= analyzedLevel"
            @click="analysisMenuOpen = false; runKifuAnalysis()"
          >{{ analyzedLevel < 0 ? "このレベルで解析" : analysisLevelChoice <= analyzedLevel ? "このレベルは解析済み" : "このレベルで読み直す" }}</button>
          <button
            type="button"
            role="menuitem"
            :disabled="reviewCpuEnabled || (!analysisCurrentPoint?.pv?.length && !canAnalyzeReviewPosition)"
            @click="analysisMenuOpen = false; showAnalysisLine()"
          >最善の読み筋</button>
          <button
            type="button"
            role="menuitem"
            :disabled="!canPlaceReviewLine"
            @click="analysisMenuOpen = false; placeReviewLine()"
          >読み筋を盤に並べる</button>
        </div>
      </div>
    </section>

    <div v-if="errorMessage" class="shogi-game__error" role="alert">
      <p>{{ errorMessage }}</p>
      <button type="button" aria-label="メッセージを閉じる" @click="errorMessage = ''">×</button>
    </div>

    <div
      v-if="suspendConfirmOpen"
      class="shogi-game__confirm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="suspend-confirm-title"
      @click.self="suspendConfirmOpen = false"
    >
      <div class="shogi-game__confirm-panel">
        <h2 id="suspend-confirm-title">対局を中断します。</h2>
        <p>ここまでを保存してホームへ戻ります。ホームの「対局を再開」から続けられます。</p>
        <div>
          <button type="button" @click="suspendMatch">中断する</button>
          <button type="button" @click="suspendConfirmOpen = false">対局を続ける</button>
        </div>
      </div>
    </div>

    <!-- はじめて遊ぶ人への案内。将棋をどのくらい知っているかで、教室・対局・棋力測定へ案内する。 -->
    <div
      v-if="welcomeOpen && homeOpen"
      class="shogi-game__confirm shogi-game__confirm--over-home"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
      @click.self="dismissWelcome"
    >
      <div class="shogi-game__confirm-panel shogi-welcome">
        <img
          class="shogi-welcome__chara"
          :src="`${assetBaseUrl}/characters/yakobihime-mini.webp?v=2`"
          alt=""
          aria-hidden="true"
        >
        <h2 id="welcome-title">ようこそ！</h2>
        <p>わたしはやこび姫。将棋はどのくらい知ってる？ 合わせて、はじめの一歩を案内するね。</p>
        <ul class="shogi-welcome__choices">
          <li v-for="choice in WELCOME_CHOICES" :key="choice.id">
            <button type="button" @click="chooseWelcome(choice.id)">
              <strong>{{ choice.label }}</strong>
              <small>{{ choice.description }}</small>
            </button>
          </li>
        </ul>
        <button type="button" class="shogi-welcome__skip" @click="dismissWelcome">自分で選ぶ</button>
      </div>
    </div>

    <div
      v-if="discardSuspendedPending"
      class="shogi-game__confirm shogi-game__confirm--over-home"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="discard-suspended-title"
      @click.self="discardSuspendedPending = null"
    >
      <div class="shogi-game__confirm-panel">
        <h2 id="discard-suspended-title">中断した対局があります</h2>
        <p>新しく始めると、中断した対局は消えます。</p>
        <div>
          <button type="button" class="shogi-game__confirm-danger" @click="acceptDiscardSuspended">新しく始める</button>
          <button type="button" @click="discardSuspendedPending = null">やめる</button>
        </div>
      </div>
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
        <h2 id="resign-confirm-title">投了します。</h2>
        <p>この対局は負けになります。</p>
        <div>
          <button type="button" class="shogi-game__confirm-danger" @click="confirmResign">投了する</button>
          <button type="button" @click="resignConfirmOpen = false">対局を続ける</button>
        </div>
      </div>
    </div>

    <div
      v-if="resultDialogOpen && result && resultPresentation && !ryuoGame"
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
        <!-- 勝ち負けの次に知りたい、決まり手とレーティングの増減だけを大きく出す。対局の記録は折りたたむ。 -->
        <p class="shogi-game__result-lead">{{ resultPresentation.detail }}</p>
        <p v-if="resultPresentation.cheer" class="shogi-game__result-cheer">{{ resultPresentation.cheer }}</p>
        <p
          v-if="ratingChange"
          class="shogi-game__result-rating"
          :class="{ 'shogi-game__result-rating--up': ratingChange.delta > 0 }"
          data-rating-change
        >
          R{{ ratingChange.before }} → <strong>R{{ ratingChange.after }}</strong>
          <span>{{ ratingChange.delta >= 0 ? "+" : "−" }}{{ Math.abs(ratingChange.delta) }}</span>
        </p>
        <!-- 次の級・段までの残り。下がったときも帯だけ出し、強調しない。 -->
        <p v-if="resultGradeUp" class="shogi-game__result-grade-up" data-grade-up>{{ resultGradeUp }}に上がったよ！</p>
        <div v-if="resultNextGoal" class="shogi-game__result-goal" data-next-goal>
          <p>
            <span>次の目標 <b>{{ gradeName(resultNextGoal.label) }}</b></span>
            <span>あと <b>R{{ resultNextGoal.remaining }}</b></span>
          </p>
          <div
            class="shogi-game__result-goal-bar"
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-valuenow="resultNextGoal.percent"
            :aria-label="`${gradeName(resultNextGoal.label)}まで${resultNextGoal.percent}%`"
          ><span :style="{ width: `${resultNextGoal.percent}%` }"></span></div>
        </div>
        <details class="shogi-game__result-record">
          <summary>対局の記録</summary>
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
          </dl>
        </details>
        <!-- この対局で手に入った印と、使えるようになった着せ替え。次の着せ替えまでの残りも見せる。 -->
        <div v-if="collectionResult && (collectionResult.gained.length || collectionResult.repeated.length)" class="shogi-game__result-collection" data-collection-result>
          <p class="shogi-game__result-collection-title">コレクション</p>
          <ul v-if="collectionResult.gained.length">
            <li v-for="gain in collectionResult.gained" :key="gain.label" class="shogi-game__result-collection-new">{{ collectionGainText(gain) }}</li>
          </ul>
          <p v-if="collectionResult.repeated.length" class="shogi-game__result-collection-repeat">組んだ形: {{ collectionResult.repeated.join("・") }}</p>
          <p v-for="theme in collectionResult.themes" :key="theme" class="shogi-game__result-collection-theme">着せ替え{{ theme }}が使えるようになったよ！（やこびノートで選べるよ）</p>
          <p v-if="collectionResult.next" class="shogi-game__result-collection-next">次の着せ替えまで、印あと{{ collectionResult.next.remaining }}個</p>
        </div>
        <!--
          次の挑戦をいちばん手前に置く。同じLvに続けて負けたときは、挑戦を続ける道を先頭に、
          強さを1つ下げる・香落ちを同じ大きさで並べる(自動では変えない)。教室と棋力測定の対局には出さない。
        -->
        <div v-if="!tutorialMatch && !measureSession && resultRetrySuggestion" class="shogi-game__result-retry" data-retry-suggestion>
          <p>Lv.{{ resultRetrySuggestion.level }}、手強いね。どうする？</p>
          <div class="shogi-game__result-retry-choices">
            <button type="button" class="shogi-game__rematch" data-rematch @click="rematch()">もう一度挑む</button>
            <button
              v-if="resultRetrySuggestion.lowerLevel !== null"
              type="button"
              @click="rematch({ level: resultRetrySuggestion.lowerLevel })"
            >Lv.{{ resultRetrySuggestion.lowerLevel }}で腕ならし</button>
            <button type="button" @click="rematch({ handicapId: 'lance' })">香落ちで挑む</button>
          </div>
        </div>
        <button
          v-else-if="!tutorialMatch && !measureSession"
          type="button"
          class="shogi-game__rematch shogi-game__rematch--primary"
          data-rematch
          @click="rematch()"
        >もう一局</button>
        <button type="button" class="shogi-game__guided-start shogi-game__guided-start--result" @click="startGuidedReview">
          <span aria-hidden="true">▶</span> 対局を振り返る
        </button>
        <div class="shogi-game__result-actions">
          <!-- 教室の対局は、やこび姫の一言と★を見に教室へ戻る。 -->
          <button v-if="tutorialMatch" type="button" class="shogi-game__rematch" @click="returnToTutorial">教室へ戻る</button>
          <button v-else type="button" class="shogi-game__rematch" @click="leaveFinishedMatch()">{{ showHome ? "ホームへ" : "対局準備" }}</button>
          <button type="button" class="shogi-game__analysis-button" @click="startKifuAnalysis">棋譜解析</button>
        </div>
        <label class="shogi-game__analysis-level">
          <span>解析レベル</span>
          <select v-model.number="analysisLevelChoice">
            <option v-for="(level, index) in KIFU_ANALYSIS_LEVELS" :key="level.label" :value="index">
              {{ index + 1 }}. {{ level.label }}
            </option>
          </select>
        </label>
      </div>
    </div>
    <div
      v-if="resultDialogOpen && result && resultPresentation && ryuoGame"
      class="shogi-game__result"
      :class="`shogi-game__result--${resultPresentation.tone}`"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tournament-result-title"
      data-tournament-result
    >
      <div v-if="resultPresentation.tone === 'victory'" class="shogi-game__confetti" aria-hidden="true">
        <i v-for="index in 12" :key="index" />
      </div>
      <div class="shogi-game__result-panel">
        <h2 id="tournament-result-title">{{ resultPresentation.title }}</h2>
        <p class="shogi-game__tournament-name">{{ ryuoGame.label }}</p>
        <p class="shogi-game__tournament-name">{{ ryuoOpponent ? `対 ${ryuoOpponent.name} ${ryuoOpponent.dan}` : "" }}</p>
        <p v-if="ryuoGame.replay" class="shogi-game__tournament-title">千日手になりました。先後を入れ替えて、指し直します。</p>
        <p v-else-if="ryuoView?.result" class="shogi-game__tournament-title">
          {{ ryuoView.result.outcome === "champion" ? "竜王になりました！" : "この期の対局は、すべて終わりました。" }}
        </p>
        <p v-else-if="ryuoView?.pending" class="shogi-game__tournament-title">次の対局: {{ ryuoView.pending.label }}</p>
        <div class="shogi-game__result-actions">
          <button v-if="ryuoGame.replay" type="button" class="shogi-game__rematch" @click="replayRyuoGame">指し直す</button>
          <button v-else type="button" class="shogi-game__rematch" @click="leaveToTournamentScreen">
            {{ ryuoView?.result ? "結果を見る" : "トーナメント表へ" }}
          </button>
          <button type="button" class="shogi-game__analysis-button" @click="startKifuAnalysis">棋譜解析</button>
          <button type="button" class="shogi-game__analysis-button" @click="leaveFinishedMatch({ toHome: true })">{{ showHome ? "ホームへ" : "対局準備" }}</button>
        </div>
      </div>
    </div>

    <div
      v-if="measureReportOpen && skillDiagnosis"
      class="shogi-game__result shogi-game__result--measure"
      role="dialog"
      aria-modal="true"
      aria-labelledby="measure-result-title"
      data-measure-report
    >
      <div class="shogi-game__result-panel">
        <h2 id="measure-result-title">棋力測定の結果</h2>
        <template v-if="skillDiagnosis.insufficient">
          <p>測れる手が足りませんでした（{{ skillDiagnosis.count }}手）。もう少し長く指した対局で、もう一度測ってみてください。</p>
        </template>
        <template v-else>
          <p class="shogi-game__measure-rating">
            <strong>R{{ skillDiagnosis.rating }}</strong>
            <span>（{{ skillDiagnosis.label }}）</span>
          </p>
          <p class="shogi-game__measure-range">
            R{{ skillDiagnosis.ratingLow }}〜R{{ skillDiagnosis.ratingHigh }}の範囲の目安{{ skillDiagnosis.reliability === "reference" ? "（手数が少ない参考値）" : "" }}
          </p>
          <dl v-if="measureStats" class="shogi-game__result-details">
            <div>
              <dt>対局</dt>
              <dd>{{ resultPresentation?.title }}・{{ result?.moveCount }}手（{{ resultPresentation?.opponent }}）</dd>
            </div>
            <div>
              <dt>測った手</dt>
              <dd>{{ skillDiagnosis.count }}手・平均損失{{ skillDiagnosis.averageLoss }}</dd>
            </div>
            <div v-for="phase in measureStats.phases" :key="phase.key">
              <dt>{{ phase.label }}</dt>
              <dd>{{ phase.averageLoss === null ? "測れる手なし" : `平均損失${phase.averageLoss}（${phase.count}手）` }}</dd>
            </div>
            <div>
              <dt>悪手</dt>
              <dd>
                大悪手{{ measureStats.kinds.blunder }}・悪手{{ measureStats.kinds.mistake }}・疑問手{{ measureStats.kinds.dubious }}
              </dd>
            </div>
            <div>
              <dt>好手</dt>
              <dd>好手{{ measureStats.kinds.good }}・神の一手{{ measureStats.kinds.brilliant }}</dd>
            </div>
            <div v-if="measureStats.worst">
              <dt>一番の悪手</dt>
              <dd>{{ measureStats.worst.label }}（損失{{ measureStats.worst.loss }}）</dd>
            </div>
          </dl>
          <button
            type="button"
            class="shogi-game__rematch"
            :disabled="ratingState.rating === skillDiagnosis.rating"
            @click="applySkillDiagnosis"
          >{{ ratingState.rating === skillDiagnosis.rating ? "レーティングに設定済み" : "この棋力をレーティングに設定" }}</button>
        </template>
        <div class="shogi-game__result-actions">
          <button type="button" class="shogi-game__analysis-button" @click="measureReportDismissed = true">棋譜を見る</button>
          <button type="button" class="shogi-game__rematch" @click="leaveFinishedMatch()">{{ showHome ? "ホームへ" : "対局準備" }}</button>
        </div>
        <p class="shogi-game__measure-note">評価値の損から求めた目安です。解析の探索量や対局の内容で動きます。</p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, toRaw, watch, type Ref } from "vue";
import { Color, Move, PieceType, Position, Record, Square, promotedPieceType, reverseColor } from "tsshogi";
import ShogiMatchBoard from "./ShogiMatchBoard.vue";
import type ShogiReferenceDexComponent from "./ShogiReferenceDex.vue";
import type ShogiTutorialComponent from "./ShogiTutorial.vue";
import type ShogiProblemSetComponent from "./ShogiProblemSet.vue";
import PregamePicker, { type PickerSection, type PickerValue } from "./PregamePicker.vue";
import { tutorialMatchOutcome } from "./core/tutorial-runner.mjs";
import EvaluationGraph from "./EvaluationGraph.vue";
import { useResponsiveLayout } from "./composables/useResponsiveLayout";
import { useBackNavigation } from "./composables/useBackNavigation";
import { WELCOME_CHOICES, markWelcomeSeen, shouldShowWelcome } from "./core/welcome.mjs";
import {
  type AnalysisPoint,
  type EngineFactory,
  analysisEngineCount,
  createExtraEngines,
  engineLane,
  movesPosition,
  releaseEngines,
} from "./composables/match/analysisEngines";
import { useCpuSearchGauge } from "./composables/match/useCpuSearchGauge";
import { useDexAnalysisEngine } from "./composables/match/useDexAnalysisEngine";
import { useGuidedReview } from "./composables/match/useGuidedReview";
import {
  type PregameRow,
  assistLimitOptions,
  COACH_LEVEL_OPTIONS,
  CPU_BISHOP_OPTIONS,
  CPU_FIRST_MOVE_OPTIONS,
  CPU_ROOK_OPTIONS,
  CPU_STRATEGY_OPTIONS,
  CPU_TEMPO_OPTIONS,
  handicapOptions,
  LEARNING_START_OPTIONS,
  openingLabel,
  openingPickerGroups,
  optionLabel,
  strengthOptions,
} from "./composables/match/pregameOptions";
import { useRyuoStatsAnalysis } from "./composables/match/useRyuoStatsAnalysis";
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
import { capGodMoves, judgeGodMove, moveContext } from "./core/god-move.mjs";
import { estimateSkill, measureStatistics } from "./core/skill-estimate.mjs";
import { createSeason, describeSeason, recommendedDifficulty, recordUserGame, scaleById } from "./core/ryuo.mjs";
import { applySeasonToRoster, createRoster, loadRoster, saveRoster } from "./core/ryuo-roster.mjs";
import { applyCharacter, characterSituation, summarizeTraitMoments } from "./core/player-character.mjs";
import { comparableScore } from "./core/move-selection.mjs";
import {
  applySeason,
  loadCareer,
  loadSeason,
  nextEntry,
  saveCareer,
  saveSeason,
} from "./core/ryuo-career.mjs";
import { currentAffiliation, grantTitle, loadProfile, saveProfile } from "./core/player-profile.mjs";
import { loadTutorialProgress } from "./core/tutorial-progress.mjs";
import { findTurningPoints, turningPointText } from "./core/turning-points.mjs";
import {
  ANALYSIS_STAGE_LABELS,
  analysisPointsFromResults,
  analyzeKifuStaged,
} from "./core/kifu-analysis-pipeline.mjs";
import {
  KIFU_ANALYSIS_LEVELS,
  formatNodeCount,
  formatPrincipalVariation,
  kifuAnalysisPlan,
  loadAnalysisLevel,
  positionAnalysisBudget,
  saveAnalysisLevel,
} from "./core/reference-kifu-analysis.mjs";
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
  shouldDisplayCoachAdvice,
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
  coachTextSegments,
} from "./core/coach-expression.mjs";
import {
  advanceTurningPoints,
  classifyMoveQuality,
  createTurningPointState,
  getMovePraise,
  materialGain,
  movePraiseNeedsMateThreatCheck,
  rewindTurningPointState,
} from "./core/move-praise.mjs";
import { getIdleCoachAdvice, IDLE_COACH_DELAY_MS } from "./core/idle-coach-advice.mjs";
import {
  formatHintMove,
  formatSpokenMove,
  getHintMoves,
  getHintSearchSettings,
  getIdleCoachSearchSettings,
  getMateCheckSearchSettings,
  getMoveJudgeSearchSettings,
  getOpeningFollowupSearchSettings,
  getOpeningGuideSafetySearchSettings,
  getPraiseBaselineSearchSettings,
  hintMoveAssessment,
  hintScoreForArrow,
} from "./core/match-assists.mjs";
import {
  flipSideToMove,
  mateCheckResultFromCandidate,
  parseMateScore,
} from "./core/engine-mate-check.mjs";
import { canBlunder, chooseCpuMove, chooseNaturalMove, isBlunderChoice } from "./core/cpu-move-choice.mjs";
import { chooseLogicMove, usesLogicAi } from "./core/logic-ai.mjs";
import { createAssistSearchControl } from "./core/assist-search-control.mjs";
import { findMateInOne } from "./core/mate-threat";
import {
  classifyAnalyzedMove,
  formatAnalysisScore,
  scoreForBlack,
  scoreToGraphValue,
} from "./core/kifu-analysis.mjs";
import {
  CPU_STRENGTH_PRESETS,
  getStrengthSearchSettings,
  DEFAULT_STRENGTH_VALUE,
  normalizeStrengthValue,
  strengthPresetFor,
  usesNaturalMoveOnly,
} from "./core/strength-settings.mjs";
import {
  appendReviewMove,
  createReviewNavigation,
  isOnReviewMainLine,
  moveReviewCursor,
  previewReviewLine,
  reviewBranchStart,
  rewindReviewMoves,
  returnReviewToMainLine,
  visibleReviewMoves,
} from "./core/review-navigation.mjs";
import { explainResignation, resignationSearchSettings } from "./core/resignation-explanation.mjs";
import {
  availableOpeningDefinitions,
  chooseAdaptiveOpeningMove,
  chooseSafeOpeningMove,
  filterOpeningCompatibleCandidates,
  inferOpeningRookStyle,
  isOpeningGuideExpired,
  isOpeningPlanComplete,
  isStandaloneOpening,
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
  openingPlanParallelCandidates,
  openingStrategyCompletionChoices,
  rangingRookStrategyChoices,
  openingUrgentResponse,
  selectBestOpeningPlan,
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
  adaptCpuOpeningPlan,
  createAdaptiveCpuPlan,
  configuredCpuBishopMove,
  configuredCpuFirstMove,
  cpuMoveMatchesBishopPreference,
  randomOpeningCombinationRate,
  selectCpuOpeningRepertoire,
  selectRandomOpeningCombination,
  shouldForceConfiguredCpuOpening,
  shouldUseCpuOpening,
} from "./core/cpu-opening-repertoire.mjs";
import { createPositionAnalysisCache } from "./core/position-analysis-cache.mjs";
import { openingExplanation } from "./core/opening-explanations.mjs";
import {
  LEARNING_ASSIST_LIMITS,
  LEARNING_HANDICAPS,
  assistAllowance,
  attackMap,
  buildFormationStart,
  formatAssistCount,
  learningStartPosition,
  normalizeAssistLimit,
} from "./core/learning-setup.mjs";
import { createMoveSoundPlayer, loadSoundEnabled, saveSoundEnabled, selectMoveSound } from "./core/move-sound";
import { IMPACT_STAGE, finishImpact, impactStopMs, moveImpact, praiseImpactStage } from "./core/move-impact.mjs";
import {
  clearMatchSnapshot,
  loadMatchSnapshot,
  matchSnapshotKey,
  persistedResult,
  recordAndFormationsFromMoves,
  savedMatchNumber,
  saveMatchSnapshot,
} from "./core/match-persistence.mjs";
import {
  applyDeclaredGrade,
  applyMeasuredRating,
  applyRatedGame,
  gradeName,
  levelRatingText,
  loadRatingState,
  nextRatingGoal,
  recommendedLevel,
  retrySuggestion,
  saveRatingState,
} from "./core/player-rating.mjs";
import { furigomaMessage, throwFurigoma } from "./core/furigoma.mjs";
import {
  collectionCatalog,
  loadCollection,
  newlyUnlockedThemes,
  nextThemeUnlock,
  recordMatchCollection,
  saveCollection,
} from "./core/collection.mjs";
import { themeName } from "./core/themes.mjs";
import { loadOshi } from "./core/ryuo-oshi.mjs";
import hiraganaFormationMaster from "./data/hiragana_suisho_formations.json";

// 対局のほかの画面は、開いたときに読み込む。最初に読むJSを小さくして、起動を速くするため。
// 読み込みは import() の呼び出しごとに1回だけで、prefetchScreens() で先に読んでおける。
const loadOpeningDex = () => import("./ShogiOpeningDex.vue");
const loadReferenceDex = () => import("./ShogiReferenceDex.vue");
const loadTutorial = () => import("./ShogiTutorial.vue");
const loadProblemSet = () => import("./ShogiProblemSet.vue");
const loadYakobiNote = () => import("./YakobiNote.vue");
const loadTournament = () => import("./ShogiTournament.vue");
const ShogiOpeningDex = defineAsyncComponent(loadOpeningDex);
const ShogiReferenceDex = defineAsyncComponent(loadReferenceDex);
const ShogiTutorial = defineAsyncComponent(loadTutorial);
const ShogiProblemSet = defineAsyncComponent(loadProblemSet);
const YakobiNote = defineAsyncComponent(loadYakobiNote);
const ShogiTournament = defineAsyncComponent(loadTournament);
const SCREEN_LOADERS = [loadTutorial, loadProblemSet, loadOpeningDex, loadReferenceDex, loadYakobiNote, loadTournament];

/** ホームを出したあと、手が空いたときに他の画面を先に読み込み、開くときに待たせないようにする。 */
function prefetchScreens() {
  const run = () => {
    for (const load of SCREEN_LOADERS) load().catch(() => {});
  };
  const idle = (globalThis as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
  if (idle) idle(run, { timeout: 5000 });
  else setTimeout(run, 2000);
}

const INITIAL_GUIDE_TEXT = "一緒に頑張ろう！";
const UNDO_GUIDE_TEXT = "もう一度、落ち着いて考えてみよう！";

let cancelDeferredCoachPortraitPreload: (() => void) | undefined;

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

// 学習対局では駒落ちや戦型完成局面から始めるため、実際の開始局面を別に持つ。
type MatchKind = "normal" | "learning" | "tournament";
type LearningStartType = "standard" | "handicap" | "formation";
const matchKind = ref<MatchKind>("normal");
const matchInitialSfen = ref(props.initialSfen);
const learningStartType = ref<LearningStartType>("standard");
const learningHandicapId = ref("bishop");
const learningHandicapGiver = ref<"cpu" | "player">("cpu");
const learningPlayerStrategy = ref("");
const learningPlayerCastle = ref("");
const learningOpponentStrategy = ref("");
const learningOpponentCastle = ref("");
const learningHintLimit = ref(3);
const learningUndoLimit = ref(3);
const learningStartLabel = ref("");
const attackGuideEnabled = ref(false);
// 学習対局で、選んだ駒の動ける方向を矢印で見せるか。駒を選んだときだけ出るので、学習対局では最初からオンにする。
const movementArrowsEnabled = ref(true);

/** 棋譜の手番号が先手の手か。駒落ちでは上手（後手）から指し始める。 */
function isBlackMoveIndex(index: number) {
  const blackFirst = matchInitialSfen.value.trim().split(/\s+/)[1] !== "w";
  return (index % 2 === 0) === blackFirst;
}

function matchHintAllowance() {
  if (matchKind.value === "tournament") return assistAllowance(Number(ryuoSeason.value?.settings?.hintLimit ?? 3));
  return matchKind.value === "learning"
    ? assistAllowance(learningHintLimit.value)
    : Math.max(0, Math.trunc(props.hintCount));
}

function matchUndoAllowance() {
  if (matchKind.value === "tournament") return assistAllowance(Number(ryuoSeason.value?.settings?.undoLimit ?? 3));
  return matchKind.value === "learning"
    ? assistAllowance(learningUndoLimit.value)
    : Math.max(0, Math.trunc(props.undoCount));
}

const errorMessage = ref("");
// 深い反応性はそのままに、型だけtsshogiのRecordとして扱う（ref<Record>だとクラスの型が外れ、Recordを受け取る関数へ渡せない）。
const record = ref(createRecord()) as Ref<Record>;
const currentSfen = ref(record.value.position.sfen);
const lastMove = ref("");
const active = ref(false);
const matchStarted = ref(false);
const pregameOpen = ref(true);
const homeOpen = ref(props.showHome);
// はじめて遊ぶ人への案内。ホームのある表示で、遊んだ記録が何もない端末だけで出す。
const welcomeOpen = ref(props.showHome && shouldShowWelcome(typeof localStorage === "undefined" ? null : localStorage));
const dexOpen = ref(false);
const yakobiNoteOpen = ref(false);
const tournamentOpen = ref(false);
const openingDexInitialId = ref("");
// 駒図鑑・手筋図鑑・将棋界図鑑のうち、開いているもの。
const referenceDexKind = ref<"" | "piece" | "tesuji" | "world" | "glossary">("");
const referenceDexInitialId = ref("");
// やこび姫の将棋教室を開いているか。
const tutorialOpen = ref(false);
const tutorialView = ref<InstanceType<typeof ShogiTutorialComponent> | null>(null);
const referenceDexView = ref<InstanceType<typeof ShogiReferenceDexComponent> | null>(null);
// やこび姫の将棋問題集を開いているか。
const problemSetOpen = ref(false);
const problemSetView = ref<InstanceType<typeof ShogiProblemSetComponent> | null>(null);
// 教室のレッスンから始めた対局。終局後は教室へ戻り、reportで★を付ける。
type TutorialMatchReport = { lessonId: string; outcome: "win" | "lose" | "draw"; reason: string; assistsUsed: number };
const tutorialMatch = ref<{ lessonId: string; playerColor: "black" | "white"; report: TutorialMatchReport | null } | null>(null);
const tutorialReport = ref<TutorialMatchReport | null>(null);
const thinking = ref(false);
const engineReady = ref(false);
const engineUnavailable = ref(false);
const result = ref<MatchResult | null>(null);
const resultDialogOpen = ref(false);
// 通常対局(平手・対CPU)の結果で更新するプレイヤーのレーティング。
const ratingState = ref(loadRatingState(browserStorage()));
// プレイヤーのプロフィール(大会で得た称号と成績)。
const profileState = ref(loadProfile(browserStorage()));
// 大会の設定と、進行中の大会。
// 竜王戦(大会)。キャリア(いま何組か、竜王の期数)と、進行中の期は、1局ごとに端末へ保存する。
type RyuoGame = { opponentId: string; label: string; outcome?: "win" | "loss"; replay?: boolean };
const ryuoCareer = ref(loadCareer(browserStorage()));
/** 竜王戦に出る架空の棋士の名簿。期をまたいで残り、期が終わるたびに更新する。最初の期に作る。 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ryuoRoster = shallowRef<any>(loadRoster(browserStorage()));
/** 推しの棋士(やこびノートの棋士名鑑で選ぶ)。大会の画面を開くたびに読み直す。 */
const ryuoOshi = ref<{ id: string; name: string } | null>(null);
watch(tournamentOpen, (open) => {
  if (!open) return;
  const id = loadOshi(browserStorage());
  const name = id ? (ryuoSeason.value?.players?.[id]?.name ?? ryuoRoster.value?.players?.[id]?.name ?? "") : "";
  ryuoOshi.value = id && name ? { id, name } : null;
}, { immediate: true });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ryuoSeason = ref<any>(loadSeason(browserStorage()));
/** いま指している大会の対局。保存した対局と一緒に、リロードしても復元する。 */
const ryuoGame = ref<RyuoGame | null>(null);
/** 大会の対局での、CPUの手ごとの選び方と、働いていた特徴(対局後に、特徴が出た場面を示すため)。 */
let ryuoCpuMoves: { ply: number; kind: string; traits: string[] }[] = [];
const ryuoView = computed(() => (ryuoSeason.value ? describeSeason(ryuoSeason.value) : null));
const ryuoOpponent = computed(() => (ryuoGame.value ? ryuoSeason.value?.players?.[ryuoGame.value.opponentId] ?? null : null));
const tournamentStartAt = ref<"select" | "season">("select");
/** 大会の難易度のおすすめ。6組の相手の平均が、レーティングに近いLvになる難易度。 */
const ryuoDefaultDifficulty = computed(() => recommendedDifficulty(recommendedStrengthPreset.value.level));
const tournamentView = ref<{ goBack: () => void } | null>(null);
/** 直近の対局で変動したレーティング。リロードで復元した終局画面では出さない。 */
const ratingChange = ref<{ before: number; after: number; delta: number } | null>(null);
/** 棋力測定の対局か。終局後に自動で棋譜解析を始め、棋力を診断する。 */
const measureMode = ref(false);
/** 棋力測定の結果の表示中(測定対局の終局から、対局準備・ホームへ戻るまで)。 */
const measureSession = ref(false);
/** 棋力測定の解析中。完了ボタンを隠し、「測定中」を表示する。 */
const measureAnalyzing = ref(false);
const measureProgressPercent = computed(() => (
  analysisTotal.value ? Math.round((analysisProgress.value / analysisTotal.value) * 100) : 0
));
const measureReportDismissed = ref(false);
/** 棋力測定以外の解析で、棋力診断を表示するか。「その他」メニューから切り替える。 */
const skillDiagnosisVisible = ref(false);
/** レーティングに近いLvの段級位の表示名。 */
const nearestRatingLabel = computed(() => recommendedStrengthPreset.value.label);
const recommendedStrengthPreset = computed(() => {
  const level = recommendedLevel(ratingState.value.rating);
  return CPU_STRENGTH_PRESETS.find((preset) => preset.level === level)!;
});
const reviewMode = ref(false);
const reviewNavigation = ref(createReviewNavigation());
const analysisOpen = ref(false);
const analysisRunning = ref(false);
const analysisProgress = ref(0);
const analysisTotal = ref(0);
// 棋譜解析の段階。全局面を軽く読む(scan)、怪しい手を読み直す(review)、大事な局面を深く読む(focus)。
const analysisStage = ref("");
// 解析を始める前に選ぶ解析レベル(5段階)。前回選んだレベルを覚えておく(図鑑と共通)。
const analysisLevelChoice = ref(loadAnalysisLevel());
watch(analysisLevelChoice, (level) => saveAnalysisLevel(level));
// 最後まで解析し終えたレベル。まだなら-1。同じ棋譜を深いレベルで読み直すときは、前の読みを残して書き足す。
const analyzedLevel = ref(-1);
let gameAnalysisResults: { key: string; results: unknown[] } | null = null;
const analysisPoints = ref<AnalysisPoint[]>([]);
const analysisVisible = computed(() => reviewMode.value && analysisOpen.value);
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
const dialogueSegments = computed(() => coachTextSegments(activeCoachText.value));
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
const kifuList = ref<HTMLElement | null>(null);
const {
  boardLayout,
  boardShell,
  gameRoot,
  menuCollapsed,
  uiLayout,
  uiLayoutStyle,
  uiNarrow,
  uiShort,
} = useResponsiveLayout({ analysisVisible });
const resignConfirmOpen = ref(false);
// 中断した対局(保存済み)。ホームの「対局を再開」から続ける。リロードしても残る。
const suspendedMatch = ref<{ moves: number } | null>(null);
const suspendConfirmOpen = ref(false);
/** 中断した対局を消して新しく始める前の確認。承諾したら、保留した開始処理を行う。 */
const discardSuspendedPending = ref<(() => void) | null>(null);
const analysisMenuOpen = ref(false);
// 対局準備で開いている選択シート。空なら閉じている。
const pregamePicker = ref("");
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
  usi: string;
  wasPromotion: boolean;
  wasEnemyCampDrop: boolean;
  fromHint: boolean;
  trivial: boolean;
  sacrifice: boolean;
  obvious: boolean;
  materialGain: number;
} | undefined;
type PraiseCandidate = { rank: number; move: string; score?: EngineEvaluation };
// 好手・詰めろ受けの判定用に、プレイヤー手番開始時の解析を1局面分だけ保持する。
let playerMoveBaseline: {
  historyLength: number;
  shallow: PraiseCandidate[];
  deep: PraiseCandidate[];
  mateThreat: boolean;
} | undefined;
let playerMoveBaselineGeneration = 0;
let turningPointState = createTurningPointState();
let lastCpuCapture: { historyLength: number; pieceType: string } | undefined;
let cpuTimer: ReturnType<typeof setTimeout> | undefined;
let matchGeneration = 0;
let cpuSearchRunning = false;
let cpuSearchGeneration = -1;
let enginePromise: Promise<void> | null = null;
let idleCoachTimer: ReturnType<typeof setTimeout> | undefined;
let idleCoachGeneration = 0;
let engine: ShogiEngine | null = null;
// 棋譜解析で追加のエンジンを作るためのファクトリ。
let engineFactory: EngineFactory | null = null;
/** エンジンの生成関数を読み込む。対局・棋譜解析・図鑑・竜王戦の統計で共通。 */
async function ensureEngineFactory(): Promise<EngineFactory> {
  if (!engineFactory) engineFactory = (await loadEngineFactories(null, { engineBaseUrl: props.engineBaseUrl })).factory;
  return engineFactory!;
}
let moveHistory: string[] = [];
let coachAdviceHistory: RecordedCoachAdvice[] = [];
let displayingStructuredCoachAdvice = false;
let reviewCoachGeneration = 0;
let analysisGeneration = 0;
let reviewCpuGeneration = 0;
let reviewCoachQueue: Promise<void> = Promise.resolve();
let dedicatedCoachQueue: Promise<void> = Promise.resolve();
let openingFollowupGeneration = 0;
let openingFollowupLoading = false;
let openingGuideSafetyGeneration = 0;
type CpuOpeningPlan = {
  strategyId: string;
  castleId: string;
  label: string;
  adaptCastle?: boolean;
  adaptStrategy?: boolean;
  castleStance?: string;
  exchangeHandled?: boolean;
  switchedFrom?: string;
};
let cpuOpeningPlan: CpuOpeningPlan | null = null;
/** CPUが大きな悪手を指した手数。1局の回数と間隔の制限に使い、待ったで戻した分は数えない。 */
let cpuBlunderPlies: number[] = [];
const positionAnalysisCache = createPositionAnalysisCache();
const assistSearchControl = createAssistSearchControl();
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
// 人間最高峰プリセット（72万ノード）相当の探索を毎手行わない。
const COACH_SEARCH_BUDGET = {
  standard: { nodes: 60000, maxTimeMs: 1500 },
  compact: { nodes: 30000, maxTimeMs: 900 },
} as const;

function coachSearchBudget() {
  return COACH_SEARCH_BUDGET[
    props.mobile || boardLayout.value === "portrait" ? "compact" : "standard"
  ];
}

const kifuEntries = computed(() => {
  if (uiLayout.value !== "wide") return [];
  try {
    if (reviewMode.value) {
      const lineRecord = createGameRecord(matchInitialSfen.value);
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
// 分岐の局面には本筋の解析結果を使わない(読みは、その場で読み直す)。
const analysisCurrentPoint = computed(() => (
  isOnReviewMainLine(reviewNavigation.value)
    ? analysisPoints.value.find(({ ply }) => ply === reviewNavigation.value.cursor)
    : undefined
));
const reviewBranchFrom = computed(() => reviewBranchStart(reviewNavigation.value));
/** 読みで、解析済みでない局面(分岐など)をその場で読めるか。 */
const canAnalyzeReviewPosition = computed(() => (
  reviewMode.value && engineReady.value && !thinking.value && !analysisRunning.value && !reviewCpuEnabled.value
));
// CPU対局ではCPU側の名前にレベルを添え、棋力の説明を2行目に出す。
const cpuColor = computed(() => (normalizedMode.value === "cpu" ? reverseColor(humanColor.value) : null));
const cpuStrengthPreset = computed(() => strengthPresetFor(searchNodes.value));
const cpuDisplayName = computed(() => {
  // 大会では、対戦相手の棋士の名前と段位を出す。
  if (matchKind.value === "tournament" && ryuoOpponent.value) {
    return `${ryuoOpponent.value.name} ${ryuoOpponent.value.dan} Lv.${ryuoOpponent.value.level}`;
  }
  const name = props.cpuPlayerName.trim() || "CPU";
  return cpuStrengthPreset.value ? `${name} Lv.${cpuStrengthPreset.value.level}` : name;
});
const cpuStrengthLabel = computed(() => (
  matchKind.value === "tournament" && ryuoOpponent.value ? "" : cpuStrengthPreset.value?.label ?? ""
));
const effectiveBlackPlayerName = computed(() =>
  cpuColor.value === Color.BLACK ? cpuDisplayName.value : props.blackPlayerName,
);
const effectiveWhitePlayerName = computed(() =>
  cpuColor.value === Color.WHITE ? cpuDisplayName.value : props.whitePlayerName,
);
/** 振り返りの詰みの問題で、相手の応手を指すまでの間。盤を触らせない。 */
const guidedMateReplyPending = ref(false);
const canMove = computed(() =>
  active.value &&
  !thinking.value &&
  !guidedMateReplyPending.value &&
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
/*
 * CPUの思考の進み具合。探索中だけ、読んだ局面数(nodes)と予定の局面数(target)を持つ。
 * エンジンの途中経過は読みが1段深くなるたびにしか届かないため、合間は最後の探索速度から進み具合を見積もり、
 * ゲージを滑らかに進める。見積もりは予定の99%で止め、探索が終わったら100%にする。
 */
const { cpuSearchGauge, cpuGaugePercent, startCpuGauge, updateCpuGauge, finishCpuGauge } = useCpuSearchGauge(thinking);
/** 「CPUが考えています」を出す場面か。探索しないレベルでも、流れるゲージで考え中を表す。 */
const cpuThinkingShown = computed(() => {
  if (!matchStarted.value || !thinking.value) return false;
  if (reviewMode.value) return reviewCpuEnabled.value;
  if (result.value) return false;
  return !(normalizedMode.value === "cpu" && !engineReady.value);
});
const statusText = computed(() => {
  if (!matchStarted.value) return "対局条件を選んでください";
  if (reviewMode.value && reviewCpuEnabled.value) {
    return thinking.value ? `${props.cpuPlayerName}が考えています…` : "感想戦中です";
  }
  if (reviewMode.value && measureAnalyzing.value) return "棋力を測定中です…";
  if (reviewMode.value) return "棋譜解析中です";
  if (result.value) {
    if (!result.value.winner) return "引き分け";
    return result.value.winner === Color.BLACK ? "先手の勝ち" : "後手の勝ち";
  }
  if (normalizedMode.value === "cpu" && !engineReady.value) return "やねうら王を起動中…";
  if (thinking.value) return `${props.cpuPlayerName}が考えています…`;
  // CPU対局では先手・後手ではなく「あなた」「相手」で手番を示す。
  if (cpuColor.value !== null) {
    if (record.value.position.color !== humanColor.value) return `${cpuDisplayName.value}の番です`;
    return sideToMoveInCheck.value ? "王手！ 玉を守ろう" : "あなたの番です";
  }
  const side = record.value.position.color === Color.BLACK ? "先手番です" : "後手番です";
  return sideToMoveInCheck.value ? `王手！ ${side}` : side;
});
/** 手番の側の玉に王手がかかっているか。 */
const sideToMoveInCheck = computed(() => matchStarted.value && !result.value && isSideToMoveInCheck(currentSfen.value));
/**
 * 王手がかかった瞬間に盤の上へ短く出す知らせ。駒音（強い音）と同時に、見た目でも伝える。
 * 意味の説明は最初の数回だけ添え、慣れたら「王手！」だけにする。
 */
const CHECK_EXPLAIN_LIMIT = 3;
const CHECK_EXPLAIN_KEY = "shogi-match-check-explained";
const checkCallout = ref<{ id: number; checkedIsHuman: boolean; explain: string } | null>(null);
let checkCalloutTimer: ReturnType<typeof setTimeout> | undefined;
watch(sideToMoveInCheck, (inCheck) => {
  if (!inCheck || !active.value || reviewMode.value) return;
  const checkedIsHuman = cpuColor.value === null || record.value.position.color === humanColor.value;
  let explained = 0;
  try {
    explained = Number(matchStorage?.getItem(CHECK_EXPLAIN_KEY)) || 0;
    if (explained < CHECK_EXPLAIN_LIMIT) matchStorage?.setItem(CHECK_EXPLAIN_KEY, String(explained + 1));
  } catch {
    explained = CHECK_EXPLAIN_LIMIT;
  }
  const explain = explained >= CHECK_EXPLAIN_LIMIT
    ? ""
    : checkedIsHuman
      ? "玉がねらわれているよ。逃げるか、守ろう"
      : "相手の玉をねらったよ";
  checkCallout.value = { id: Date.now(), checkedIsHuman, explain };
  clearTimeout(checkCalloutTimer);
  checkCalloutTimer = setTimeout(() => { checkCallout.value = null; }, explain ? 2000 : 1300);
});
onBeforeUnmount(() => clearTimeout(checkCalloutTimer));
/**
 * 振り駒の知らせ。ホームからすぐ始める対局で、盤の上に歩5枚と先後を短く出す。
 * 盤の操作は妨げない(先手ならすぐ指せる)。
 */
const FURIGOMA_SHOW_MS = 1800;
const furigomaCallout = ref<{ id: number; faces: ("fu" | "to")[]; text: string } | null>(null);
let furigomaTimer: ReturnType<typeof setTimeout> | undefined;
function showFurigoma(toss: ReturnType<typeof throwFurigoma>) {
  furigomaCallout.value = { id: Date.now(), faces: toss.faces, text: furigomaMessage(toss) };
  clearTimeout(furigomaTimer);
  furigomaTimer = setTimeout(() => { furigomaCallout.value = null; }, FURIGOMA_SHOW_MS);
}
function furigomaPieceUrl(face: "fu" | "to") {
  const name = face === "fu" ? "black_pawn" : "black_prom_pawn";
  return `${props.assetBaseUrl.replace(/\/$/, "")}/piece/${pregamePieceThemeId.value}/${name}.webp`;
}
onBeforeUnmount(() => clearTimeout(furigomaTimer));
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
    || learningStartLabel.value
    || (matchInitialSfen.value === STANDARD_SFEN ? "平手" : "その他");
  const common = {
    detail,
    handicap,
    opponent: [cpuDisplayName.value, cpuStrengthLabel.value].filter(Boolean).join(" "),
    blackFormations: formationNamesFromState(formationState.value, "black").join("・") || "未判定",
    whiteFormations: formationNamesFromState(formationState.value, "white").join("・") || "未判定",
  };
  if (!result.value.winner) {
    return {
      tone: "draw",
      title: "引き分け",
      cheer: "",
      ...common,
    };
  }
  if (normalizedMode.value === "local") {
    return {
      tone: "victory",
      title: result.value.winner === Color.BLACK ? "先手勝利" : "後手勝利",
      cheer: "",
      ...common,
    };
  }
  const playerWon = result.value.winner === humanColor.value;
  // 負けたときは責めずに次にすることを、指し直して勝ったときは何を越えたかを一言添える。
  const retried = learningStartLabel.value === RETRY_START_LABEL;
  return playerWon
    ? { tone: "victory", title: "勝利", cheer: retried ? "さっきの分かれ道、今度は越えたね！" : "", ...common }
    : { tone: "defeat", title: "敗北", cheer: "どこで分かれたか、いっしょに見てみよう。", ...common };
});

/** 終局画面の「次の目標」。レーティングが動いた対局(平手の通常対局)だけ出す。 */
const resultNextGoal = computed(() => (ratingChange.value ? nextRatingGoal(ratingState.value.rating) : null));
/** この対局で級・段の目安が上がったら、その名前。 */
const resultGradeUp = computed(() => {
  const change = ratingChange.value;
  if (!change || change.after <= change.before) return "";
  const labelOf = (rating: number) => CPU_STRENGTH_PRESETS.find(({ level }) => level === recommendedLevel(rating))?.label ?? "";
  const after = labelOf(change.after);
  return after !== labelOf(change.before) ? gradeName(after) : "";
});
/** 同じLvに続けて負けたときの、選べる提案(強さを1つ下げる・香落ち)。自動では変えない。 */
const resultRetrySuggestion = computed(() => {
  if (!ratingChange.value || !result.value?.winner || result.value.winner === humanColor.value) return null;
  const level = cpuStrengthLevel();
  return level === undefined ? null : retrySuggestion(ratingState.value, level);
});
const blackFormationText = computed(() => formationTextForColor(Color.BLACK));
const whiteFormationText = computed(() => formationTextForColor(Color.WHITE));
const FORMATION_SNAPSHOT_CACHE_LIMIT = 4;
const formationSnapshotCache = new Map<string, ReturnType<typeof detectFormationSnapshot>>();
function formationSnapshotForSfen(sfen: string) {
  const cached = formationSnapshotCache.get(sfen);
  if (cached) {
    formationSnapshotCache.delete(sfen);
    formationSnapshotCache.set(sfen, cached);
    return cached;
  }
  const snapshot = detectFormationSnapshot(sfen, hiraganaFormationMaster);
  formationSnapshotCache.set(sfen, snapshot);
  while (formationSnapshotCache.size > FORMATION_SNAPSHOT_CACHE_LIMIT) {
    formationSnapshotCache.delete(formationSnapshotCache.keys().next().value!);
  }
  return snapshot;
}
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
const openingAvailabilityContext = computed(() => {
  const sfen = currentSfen.value;
  const playerIsBlack = humanColor.value === Color.BLACK;
  const playerMoves = moveHistory.filter((_, index) => isBlackMoveIndex(index) === playerIsBlack);
  return {
    sfen,
    playerIsBlack,
    playerMoves,
    legalMoves: openingGuideLegalMoves(),
    currentFormations: formationNamesFromSnapshot(
      formationSnapshotForSfen(sfen),
      playerIsBlack ? "black" : "white",
    ),
    committedRookStyle: inferOpeningRookStyle({
      color: playerIsBlack ? "black" : "white",
      playedMoves: playerMoves,
      currentSfen: sfen,
    }),
  };
});
function availableOpeningOptions(kind: "strategy" | "castle") {
  const {
    committedRookStyle,
    currentFormations,
    legalMoves,
    playerIsBlack,
    playerMoves,
    sfen,
  } = openingAvailabilityContext.value;
  const selectedCounterpartStyle = kind === "strategy"
    ? openingDefinitionRookStyle(selectedCastle.value, "castle")
    : openingDefinitionRookStyle(selectedStrategy.value, "strategy");
  return availableOpeningDefinitions({
    definitions: kind === "strategy" ? OPENING_STRATEGIES : OPENING_CASTLES,
    kind,
    color: playerIsBlack ? "black" : "white",
    playedMoves: playerMoves,
    moveHistory,
    legalMoves,
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
  const playerMoves = moveHistory.filter((_, index) => isBlackMoveIndex(index) === playerIsBlack);
  const opponentMoves = moveHistory.filter((_, index) => isBlackMoveIndex(index) !== playerIsBlack);
  const opponentColor = playerIsBlack ? Color.WHITE : Color.BLACK;
  return isOpeningPlanComplete({
    strategyId: selectedStrategy.value,
    castleId: "",
    color: playerIsBlack ? "black" : "white",
    playedMoves: playerMoves,
    opponentMoves,
    detectedFormations: formationNamesForColor(sfen, humanColor.value),
    opponentFormations: formationNamesForColor(sfen, opponentColor),
    currentSfen: sfen,
    // 一体型の戦法でも、戦法段階の完成は内蔵の囲いと分けて判定する。
    completedPhases: { castle: true },
  });
});
const castlePhaseComplete = computed(() => {
  const sfen = currentSfen.value;
  if (reviewMode.value || !active.value) return false;
  const integratedCastle = OPENING_STRATEGIES.find(({ id }) => id === selectedStrategy.value)
    ?.integratedCastle;
  if (!selectedCastle.value && !integratedCastle) return false;
  if (castleCompletionLocked.value) return true;
  const playerIsBlack = humanColor.value === Color.BLACK;
  const opponentColor = playerIsBlack ? Color.WHITE : Color.BLACK;
  return isOpeningPlanComplete({
    strategyId: selectedStrategy.value,
    castleId: selectedCastle.value,
    completedPhases: { strategy: true },
    color: playerIsBlack ? "black" : "white",
    playedMoves: moveHistory.filter((_, index) => isBlackMoveIndex(index) === playerIsBlack),
    opponentMoves: moveHistory.filter((_, index) => isBlackMoveIndex(index) !== playerIsBlack),
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
  { id: "aigakari", label: "対居飛車／相掛かり" },
  { id: "yokofudori", label: "対居飛車／横歩取り" },
  { id: "yagura", label: "対居飛車／矢倉" },
  { id: "kakugawari", label: "対居飛車／角換わり" },
  { id: "gangi", label: "対居飛車／雁木" },
  { id: "anti-ranging", label: "対振り飛車／居飛車側" },
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
    const suggestionLabel = `${label}（あと${distance}手）`;
    return strategy ? [{ ...strategy, label: suggestionLabel, optionLabel: suggestionLabel, disabled: false }] : [];
  });
  const groups = groupOpeningStrategies(
    OPENING_STRATEGIES
      // 完成後ボタンから選んだ内部派生も、選択中はプルダウンへ表示する。
      .filter(({ id, guideSelectable }) => guideSelectable !== false || id === selectedStrategy.value)
      .map((strategy) => ({
        ...strategy,
        optionLabel: strategy.integrated ? `${strategy.label}（囲い込み）` : strategy.label,
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
      optionLabel: castle.integrated ? `${castle.label}（戦法込み）` : castle.label,
      disabled: castle.id !== selectedCastle.value
        && !availableIds.has(castle.id),
    })));
  // 囲いに届かなくなったとき、近い囲いを残り手数つきで先頭に並べる。
  const suggested = castleSuggestions.value.flatMap(({ id, label, distance }) => {
    const castle = OPENING_CASTLES.find((entry) => entry.id === id);
    const suggestionLabel = `${label}（あと${distance}手）`;
    return castle ? [{ ...castle, label: suggestionLabel, optionLabel: suggestionLabel, disabled: false }] : [];
  });
  return suggested.length
    ? [{ id: "suggested", label: "今の局面から近い囲い", options: suggested }, ...groups]
    : groups;
});
// アヒル囲い・右玉のように戦法と囲いが一体の定義を選んだら、相方は選べなくする。
const strategySelectLocked = computed(() => isStandaloneOpening(selectedCastle.value, "castle"));
const castleSelectLocked = computed(() => isStandaloneOpening(selectedStrategy.value, "strategy"));
const cpuStrategySelectLocked = computed(() => isStandaloneOpening(cpuDetailedCastle.value, "castle"));
const cpuCastleSelectLocked = computed(() => isStandaloneOpening(cpuDetailedStrategy.value, "strategy"));
// 復元や自動切り替えで組み合わせられない対が揃った場合も、後から設定した側を優先する。
function exclusiveOpeningWatch(
  own: typeof selectedStrategy,
  counterpart: typeof selectedStrategy,
  ownKind: "strategy" | "castle",
) {
  const counterpartKind = ownKind === "strategy" ? "castle" : "strategy";
  watch(own, (id) => {
    if (!id || !counterpart.value) return;
    if (isStandaloneOpening(id, ownKind) || isStandaloneOpening(counterpart.value, counterpartKind)) {
      counterpart.value = "";
    }
  }, { flush: "sync" });
}
exclusiveOpeningWatch(selectedStrategy, selectedCastle, "strategy");
exclusiveOpeningWatch(selectedCastle, selectedStrategy, "castle");
exclusiveOpeningWatch(cpuDetailedStrategy, cpuDetailedCastle, "strategy");
exclusiveOpeningWatch(cpuDetailedCastle, cpuDetailedStrategy, "castle");
const selectedStrategyDefinition = computed(() => (
  OPENING_STRATEGIES.find(({ id }) => id === selectedStrategy.value) ?? null
));
// 一体型の戦法では、囲い欄に内蔵の囲いを表示する。
const castleSelectionLockedLabel = computed(() => {
  const label = selectedStrategyDefinition.value?.integratedCastleLabel;
  return label ? `戦法に含む（${label}）` : "戦法に含む";
});
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
// 囲いが未完成で、戦法と並行して組んでいる段階か。
const castleGuideInProgress = computed(() => (
  Boolean(selectedCastle.value) && !castlePhaseComplete.value
));
// 戦法が済んで(または未選択で)、囲いだけを組んでいる段階か。
// 戦法と並行している間は戦法手で囲いが近づかないのが自然なので、寄り道として数えない。
const castleGuidePhaseActive = computed(() => (
  castleGuideInProgress.value
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
    castleGuideInProgress.value
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
  const playerMoves = moveHistory.filter((_, index) => isBlackMoveIndex(index) === playerIsBlack);
  const opponentMoves = moveHistory.filter((_, index) => isBlackMoveIndex(index) !== playerIsBlack);
  const opponentColor = humanColor.value === Color.BLACK ? Color.WHITE : Color.BLACK;
  // 戦法と囲いの次の一手を並べ、安全確認のエンジン評価で良い方を案内する。
  return openingPlanParallelCandidates({
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
  const playerMoves = moveHistory.filter((_, index) => isBlackMoveIndex(index) === playerIsBlack);
  const opponentMoves = moveHistory.filter((_, index) => isBlackMoveIndex(index) !== playerIsBlack);
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
  if (openingPlanComplete.value && (selectedCastle.value || castleSelectLocked.value)) {
    return selectedStrategy.value || strategySelectLocked.value
      ? "戦法と囲いが完成したね！"
      : "囲いが完成したね！";
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
    playedMoves: moveHistory.filter((_, index) => isBlackMoveIndex(index) === playerIsBlack),
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
    formationSnapshotForSfen(sfen),
    key,
  );
}

const UNDETERMINED_FORMATION = "まだ未判定";
function formationTextForColor(color: Color): string {
  const key = color === Color.BLACK ? "black" : "white";
  const names = formationNamesFromState(formationState.value, key, 3);
  return names.length ? names.join("・") : UNDETERMINED_FORMATION;
}

function observeFormations(sfen: string) {
  formationState.value = updateFormationState(
    formationState.value,
    formationSnapshotForSfen(sfen),
  );
  // 囲いは局面ごとに上書きされるので、対局中に一度でも組んだものをコレクション用に控える。
  if (active.value && !reviewMode.value && normalizedMode.value === "cpu") {
    for (const name of formationNamesFromState(formationState.value, playerColorKey.value)) matchFormationNames.add(name);
  }
}

/*
 * コレクション(core/collection.mjs)。対局で組んだ戦法・囲い、初めて勝ったLv、神の一手を印として残す。
 * 対CPUの対局すべてが対象で、Lvの壁だけはレーティングの対象の対局で数える。
 */
const COLLECTION_CATALOG = collectionCatalog({ strategies: OPENING_STRATEGIES, castles: OPENING_CASTLES });
const matchFormationNames = new Set<string>();
let matchGodMoves = 0;
const collectionResult = ref<{
  gained: { kind: "strategy" | "castle" | "level"; label: string }[];
  repeated: string[];
  themes: string[];
  next: { need: number; remaining: number } | null;
} | null>(null);
function recordCollection(won: boolean) {
  collectionResult.value = null;
  if (normalizedMode.value !== "cpu") return;
  for (const name of formationNamesFromState(formationState.value, playerColorKey.value)) matchFormationNames.add(name);
  const level = cpuStrengthLevel();
  const before = loadCollection(browserStorage());
  const recorded = recordMatchCollection(before, {
    formations: [...matchFormationNames],
    wonLevel: won && ratingChange.value && level !== undefined ? level : null,
    godMoves: matchGodMoves,
    catalog: COLLECTION_CATALOG,
  });
  saveCollection(browserStorage(), recorded.state);
  collectionResult.value = {
    gained: recorded.gained,
    repeated: recorded.repeated,
    themes: newlyUnlockedThemes(before, recorded.state).map(({ kind, id }) => `${kind === "board" ? "盤" : "駒"}「${themeName(kind, id)}」`),
    next: recorded.gained.length ? nextThemeUnlock(recorded.state) : null,
  };
}
/** 終局画面の「この対局で手に入った印」。初めてのものだけ一言にし、前にも組んだものは名前を並べる。 */
function collectionGainText(gain: { kind: string; label: string }) {
  return gain.kind === "level" ? `${gain.label}にはじめて勝った！` : `${gain.label}をはじめて組んだ！`;
}

function formatFinalMove(matchResult: MatchResult): string {
  const lastMove = matchResult.moves.at(-1);
  if (!lastMove) return "";
  try {
    const beforeLast = createGameRecord(matchInitialSfen.value);
    for (const move of matchResult.moves.slice(0, -1)) appendUsiMove(beforeLast, move);
    return formatHintMove(lastMove, beforeLast.position.sfen)
      .replace(/^[1-9]/, (file) => "０１２３４５６７８９"[Number(file)]);
  } catch {
    return lastMove;
  }
}

// 旧版の識別値も、同じ段級位の表示名を持つレベルへ対応付ける。
function normalizeNodes(value: number): number {
  return normalizeStrengthValue(value);
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

const learningFormationResult = computed(() => {
  if (matchKind.value !== "learning" || learningStartType.value !== "formation") return null;
  const playerColor = selectedPlayerColor.value === "white" ? "white" : "black";
  const opponentColor = playerColor === "black" ? "white" : "black";
  return buildFormationStart({
    [playerColor]: { strategyId: learningPlayerStrategy.value, castleId: learningPlayerCastle.value },
    [opponentColor]: { strategyId: learningOpponentStrategy.value, castleId: learningOpponentCastle.value },
  });
});
const boardAttackMarks = computed(() => (
  matchKind.value === "learning" && attackGuideEnabled.value && matchStarted.value && !pregameOpen.value
    ? attackMap(currentSfen.value)
    : []
));
const learningStartBlocked = computed(() => (
  learningFormationResult.value !== null && !learningFormationResult.value.ok
));
// 平手以外の開始局面では、平手用の定跡（やこび姫補助・CPUの定跡）を当てはめない。
const openingGuideAvailable = computed(() => matchInitialSfen.value === STANDARD_SFEN);
/** 通常対局の作戦欄を開いたか。学習対局ではいつも開く。 */
const openingGuideExpanded = ref(false);
const openingGuideCollapsed = computed(() =>
  openingGuideAvailable.value &&
  matchKind.value !== "learning" &&
  !openingGuideExpanded.value &&
  !selectedStrategy.value &&
  !selectedCastle.value
);
const pregameUsesCustomStart = computed(() => (
  matchKind.value === "learning" && learningStartType.value !== "standard"
));

type LearningPlanGroup = { id: string; label: string; options: { id: string; optionLabel: string }[] };

function learningPlanOptions(color: "black" | "white"): {
  strategies: LearningPlanGroup[];
  castles: LearningPlanGroup[];
} {
  const strategies = OPENING_STRATEGIES.filter(({ guideSelectable, availability }) => (
    guideSelectable !== false && (!availability?.colors || availability.colors.includes(color))
  ));
  return {
    strategies: groupOpeningStrategies(strategies.map((strategy) => ({
      ...strategy,
      optionLabel: strategy.integrated ? `${strategy.label}（囲い込み）` : strategy.label,
      disabled: false,
    }))),
    castles: groupOpeningCastles(OPENING_CASTLES.map((castle) => ({
      ...castle,
      optionLabel: castle.integrated ? `${castle.label}（戦法込み）` : castle.label,
      disabled: false,
    }))),
  };
}
const learningPlayerPlanOptions = computed(() => learningPlanOptions(
  selectedPlayerColor.value === "white" ? "white" : "black",
));
const learningOpponentPlanOptions = computed(() => learningPlanOptions(
  selectedPlayerColor.value === "white" ? "black" : "white",
));

const MATCH_KIND_OPTIONS = [
  { value: "normal" as const, label: "通常対局", description: "平手でいつもどおり対局" },
  { value: "learning" as const, label: "学習対局", description: "開始局面や補助を自由に設定" },
];
const LEARNING_PLAN_SIDES = [
  { id: "player" as const, label: "自分" },
  { id: "opponent" as const, label: "相手" },
];
const learningFormationMessage = computed(() => {
  const formation = learningFormationResult.value;
  if (!formation) return "";
  return formation.ok
    ? `両者の形が完成した局面（準備に${formation.moves.length}手）から始めるよ。`
    : formation.message;
});

/** 一体型を選んだら、相方の欄を空にする。 */
function setLearningPlan(side: "player" | "opponent", kind: "strategy" | "castle", value: string) {
  const strategy = side === "player" ? learningPlayerStrategy : learningOpponentStrategy;
  const castle = side === "player" ? learningPlayerCastle : learningOpponentCastle;
  if (kind === "strategy") {
    strategy.value = value;
    if (isStandaloneOpening(value, "strategy")) castle.value = "";
  } else {
    castle.value = value;
    if (isStandaloneOpening(value, "castle")) strategy.value = "";
  }
}

// ===== 対局準備の表示 =====
/** 強さの選択シート用。各Lvにレーティングと、これまでの対戦成績を添える。 */
/*
 * 強さの選択肢。おすすめより強い相手のうち、まだ勝っていないLvには「初めて勝つと★」を添える(悪魔の釜)。
 * ★はコレクションのLvの壁で、レーティングの計算は変えない。
 */
const beatenLevels = computed(() => {
  void pregameOpen.value;
  return new Set(Object.keys(loadCollection(browserStorage()).levels).map(Number));
});
const strengthPickerOptions = computed(() => CPU_STRENGTH_PRESETS.map((preset, index) => {
  const record = levelRatingText(ratingState.value, preset.level);
  const challenge = preset.level > recommendedStrengthPreset.value.level && !beatenLevels.value.has(preset.level);
  return {
    ...strengthOptions[index],
    description: challenge ? `${record}・初めて勝つと★` : record,
  };
}));

const pregameUsesHandicap = computed(() => matchKind.value === "learning" && learningStartType.value === "handicap");
// 駒落ちでは、駒を落とす側（上手）が後手になる。
const pregamePlayerColor = computed<"black" | "white">(() => (
  pregameUsesHandicap.value
    ? (learningHandicapGiver.value === "player" ? "white" : "black")
    : selectedPlayerColor.value
));

function swapPregameColors() {
  if (pregameUsesHandicap.value) {
    learningHandicapGiver.value = learningHandicapGiver.value === "player" ? "cpu" : "player";
  } else {
    selectedPlayerColor.value = selectedPlayerColor.value === "black" ? "white" : "black";
  }
}

function learningPlanRows(side: "player" | "opponent"): PregameRow[] {
  if (!(matchKind.value === "learning" && learningStartType.value === "formation")) return [];
  const options = side === "player" ? learningPlayerPlanOptions.value : learningOpponentPlanOptions.value;
  const strategy = side === "player" ? learningPlayerStrategy.value : learningOpponentStrategy.value;
  const castle = side === "player" ? learningPlayerCastle.value : learningOpponentCastle.value;
  const castleLocked = isStandaloneOpening(strategy, "strategy");
  return [
    { kind: "pick", id: `plan:${side}:strategy`, label: "戦法", value: openingLabel(options.strategies, strategy, "選択しない") },
    {
      kind: "pick", id: `plan:${side}:castle`, label: "囲い",
      value: castleLocked ? "戦法に含む" : openingLabel(options.castles, castle, "選択しない"),
      disabled: castleLocked,
    },
  ];
}

function cpuPlanRows(): PregameRow[] {
  if (pregameUsesCustomStart.value) return [];
  const rows: PregameRow[] = [
    { kind: "switch", id: "cpuDetails", label: "戦法・囲いを指定", checked: cpuStrategyDetailsOpen.value },
  ];
  if (cpuStrategyDetailsOpen.value) {
    rows.push(
      {
        kind: "pick", id: "cpuDetailedStrategy", label: "戦法",
        value: cpuStrategySelectLocked.value
          ? "囲いと一体"
          : openingLabel(cpuDetailedStrategyGroups.value, cpuDetailedStrategy.value, "指定なし"),
        disabled: cpuStrategySelectLocked.value,
      },
      {
        kind: "pick", id: "cpuDetailedCastle", label: "囲い",
        value: cpuCastleSelectLocked.value
          ? "戦法と一体"
          : openingLabel(cpuDetailedCastleGroups.value, cpuDetailedCastle.value, "指定なし"),
        disabled: cpuCastleSelectLocked.value,
      },
    );
  } else {
    rows.push({ kind: "pick", id: "cpuStrategy", label: "作戦", value: optionLabel(CPU_STRATEGY_OPTIONS, cpuStrategy.value) });
  }
  rows.push({ kind: "pick", id: "tendency", label: "序盤傾向", value: pregameTendencySummary.value });
  if (selectedPlayerColor.value === "white") {
    rows.push({ kind: "pick", id: "cpuFirstMove", label: "初手", value: optionLabel(CPU_FIRST_MOVE_OPTIONS, cpuFirstMove.value) });
  }
  return rows;
}

// 盤で選んだ駒の書体で、先手は玉、後手は王の駒を正位置の画像で表す。
function pregamePieceTheme() {
  try {
    return localStorage.getItem("shogi-match-piece-theme") || "hitomoji_wood";
  } catch {
    return "hitomoji_wood";
  }
}
const pregamePieceThemeId = ref(pregamePieceTheme());
watch(pregameOpen, (open) => { if (open) pregamePieceThemeId.value = pregamePieceTheme(); });
function pregameKingImageUrl(color: "black" | "white") {
  const name = color === "black" ? "black_king2" : "black_king";
  return `${props.assetBaseUrl.replace(/\/$/, "")}/piece/${pregamePieceThemeId.value}/${name}.webp`;
}

const pregameSides = computed(() => (["black", "white"] as const).map((color) => {
  const local = normalizedMode.value === "local";
  const isCpu = !local && color !== pregamePlayerColor.value;
  const rows: PregameRow[] = isCpu
    ? [
      { kind: "pick", id: "strength", label: "強さ", value: optionLabel(strengthOptions, searchNodes.value) },
      ...cpuPlanRows(),
      ...learningPlanRows("opponent"),
    ]
    : local ? [] : learningPlanRows("player");
  return {
    color,
    label: color === "black" ? "先手" : "後手",
    role: pregameUsesHandicap.value ? (color === "white" ? "上手" : "下手") : "",
    isCpu,
    name: local
      ? (color === "black" ? props.blackPlayerName : props.whitePlayerName)
      : isCpu ? (props.cpuPlayerName.trim() || "CPU") : "あなた",
    // CPUの強さは下の「強さ」の行に出す。駒落ちでは上手・下手の別を添える。
    detail: pregameUsesHandicap.value ? (color === "white" ? "駒を落とす側" : "駒を落とされる側") : "",
    rows,
  };
}));

/** レーティングの対象になる設定(平手の通常対局で、対CPU)のときだけ、おすすめの強さを案内する。 */
const ratingRecommendation = computed(() => (
  matchKind.value === "normal" && normalizedMode.value === "cpu" && !tutorialMatch.value
));

const pregameCommonRows = computed(() => {
  const rows: { id: string; label: string; value: string }[] = [];

  if (matchKind.value === "learning") {
    if (pregameUsesHandicap.value) {
      rows.push({ id: "handicap", label: "手合割", value: optionLabel(handicapOptions, learningHandicapId.value) });
    }
    rows.push(
      { id: "hintLimit", label: "閃き", value: optionLabel(assistLimitOptions, learningHintLimit.value) },
      { id: "undoLimit", label: "待った", value: optionLabel(assistLimitOptions, learningUndoLimit.value) },
    );
  }
  rows.push({ id: "coach", label: "やこび姫の助言", value: optionLabel(COACH_LEVEL_OPTIONS, coachLevel.value) });
  return rows;
});

/*
 * 設定を変えて新しく現れた行を、しばらく矢印と点滅で強調する。
 * 開始局面を選ぶと離れた先手・後手の欄に行が増えるため、見える位置までスクロールもする。
 */
const PREGAME_FRESH_MS = 3000;
const pregameFreshRows = ref(new Set<string>());
let pregameFreshTimer: ReturnType<typeof setTimeout> | undefined;
const pregameRowIds = computed(() => [
  ...pregameSides.value.flatMap(({ rows }) => rows.map(({ id }) => id)),
  ...pregameCommonRows.value.map(({ id }) => id),
]);
watch(pregameRowIds, (ids, previous) => {
  if (!pregameOpen.value || !previous) return;
  const added = ids.filter((id) => !previous.includes(id));
  if (!added.length) return;
  pregameFreshRows.value = new Set(added);
  if (pregameFreshTimer) clearTimeout(pregameFreshTimer);
  pregameFreshTimer = setTimeout(() => { pregameFreshRows.value = new Set(); }, PREGAME_FRESH_MS);
  void nextTick(() => {
    gameRoot.value?.querySelector(`[data-pregame-row="${added[0]}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });
});
onBeforeUnmount(() => { if (pregameFreshTimer) clearTimeout(pregameFreshTimer); });

const LEARNING_PLAN_PICKER = /^plan:(player|opponent):(strategy|castle)$/;

/** 開いている選択シートの見出しと項目。 */
const pregamePickerConfig = computed<{ title: string; sections: PickerSection[]; note: string } | null>(() => {
  const id = pregamePicker.value;
  const single = (title: string, value: PickerValue, groups: PickerSection["groups"], note = "") => ({
    title, note, sections: [{ key: id, value, groups }],
  });
  if (id === "strength") return single("CPUの強さ", searchNodes.value, [{ options: strengthPickerOptions.value }]);
  if (id === "cpuStrategy") return single("CPUの作戦", cpuStrategy.value, [{ options: CPU_STRATEGY_OPTIONS }]);
  if (id === "cpuFirstMove") return single("CPUの初手", cpuFirstMove.value, [{ options: CPU_FIRST_MOVE_OPTIONS }]);
  if (id === "cpuDetailedStrategy") {
    return single("CPUの戦法", cpuDetailedStrategy.value, openingPickerGroups(cpuDetailedStrategyGroups.value, "指定なし"));
  }
  if (id === "cpuDetailedCastle") {
    return single("CPUの囲い", cpuDetailedCastle.value, openingPickerGroups(cpuDetailedCastleGroups.value, "指定なし"));
  }
  if (id === "tendency") {
    return {
      title: "CPUの序盤傾向",
      note: "初手を最優先し、その後は角道の具体的な指定を定跡より優先します。",
      sections: [
        { key: "bishop", label: "角道", value: cpuBishopPreference.value, groups: [{ options: CPU_BISHOP_OPTIONS }] },
        { key: "rook", label: "飛車", value: cpuRookPreference.value, groups: [{ options: CPU_ROOK_OPTIONS }] },
        { key: "tempo", label: "指し方", value: cpuTempoPreference.value, groups: [{ options: CPU_TEMPO_OPTIONS }] },
      ],
    };
  }
  if (id === "handicap") return single("手合割", learningHandicapId.value, [{ options: handicapOptions }]);
  if (id === "hintLimit") return single("閃きの回数", learningHintLimit.value, [{ options: assistLimitOptions }]);
  if (id === "undoLimit") return single("待ったの回数", learningUndoLimit.value, [{ options: assistLimitOptions }]);
  if (id === "coach") return single("やこび姫の助言", coachLevel.value, [{ options: COACH_LEVEL_OPTIONS }]);
  const plan = LEARNING_PLAN_PICKER.exec(id);
  if (plan) {
    const side = plan[1] as "player" | "opponent";
    const kind = plan[2] as "strategy" | "castle";
    const options = side === "player" ? learningPlayerPlanOptions.value : learningOpponentPlanOptions.value;
    const value = kind === "strategy"
      ? (side === "player" ? learningPlayerStrategy.value : learningOpponentStrategy.value)
      : (side === "player" ? learningPlayerCastle.value : learningOpponentCastle.value);
    return single(
      `${side === "player" ? "自分" : "相手"}の完成させる${kind === "strategy" ? "戦法" : "囲い"}`,
      value,
      openingPickerGroups(kind === "strategy" ? options.strategies : options.castles, "選択しない"),
    );
  }
  return null;
});

function onPregamePick(key: string, value: PickerValue) {
  const text = String(value);
  if (key === "strength") searchNodes.value = Number(value);
  else if (key === "cpuStrategy") cpuStrategy.value = text;
  else if (key === "cpuFirstMove") cpuFirstMove.value = text;
  else if (key === "cpuDetailedStrategy") cpuDetailedStrategy.value = text;
  else if (key === "cpuDetailedCastle") cpuDetailedCastle.value = text;
  else if (key === "bishop") cpuBishopPreference.value = text;
  else if (key === "rook") cpuRookPreference.value = text;
  else if (key === "tempo") cpuTempoPreference.value = text;
  else if (key === "handicap") learningHandicapId.value = text;
  else if (key === "hintLimit") learningHintLimit.value = Number(value);
  else if (key === "undoLimit") learningUndoLimit.value = Number(value);
  else if (key === "coach") coachLevel.value = text as typeof coachLevel.value;
  else {
    const plan = LEARNING_PLAN_PICKER.exec(key);
    if (plan) setLearningPlan(plan[1] as "player" | "opponent", plan[2] as "strategy" | "castle", text);
  }
  // 1項目だけのシートは、選んだら閉じる。
  if ((pregamePickerConfig.value?.sections.length ?? 0) <= 1) pregamePicker.value = "";
}

/** 大会の画面で「大会に参加する」を押したとき。新しい期を始める(進行中の期は破棄する)。 */
function enterRyuoSeason(settings: {
  difficulty: number; scale: number; revival: boolean; coachLevel: string; hintLimit: number; undoLimit: number;
}) {
  const career = ryuoCareer.value;
  const entry = nextEntry(career);
  const seed = Date.now();
  if (!ryuoRoster.value) {
    ryuoRoster.value = createRoster({ seed, userGroup: entry.group, userIsChampion: entry.mode === "defense" });
    saveRoster(browserStorage(), ryuoRoster.value);
  }
  const season = createSeason({
    ...entry,
    settings,
    userLevel: recommendedStrengthPreset.value.level,
    career,
    roster: ryuoRoster.value,
    seed,
  });
  ryuoSeason.value = season;
  saveSeason(browserStorage(), season);
  const { difficulty: _difficulty, ...saved } = settings;
  void _difficulty;
  ryuoCareer.value = { ...career, settings: saved };
  saveCareer(browserStorage(), ryuoCareer.value);
  finalizeRyuoSeason();
}

/** 終わった期を、キャリア(組・竜王の期数)と、プロフィール(称号)に反映する。1期につき1回だけ。 */
function finalizeRyuoSeason() {
  const season = ryuoSeason.value;
  if (!season || season.phase !== "done" || season.applied) return;
  const { career, titles } = applySeason(ryuoCareer.value, season);
  ryuoCareer.value = career;
  saveCareer(browserStorage(), career);
  if (ryuoRoster.value) {
    ryuoRoster.value = applySeasonToRoster(ryuoRoster.value, season, { userGroup: career.group, promote: scaleById(season.settings.scale).promote });
    saveRoster(browserStorage(), ryuoRoster.value);
  }
  let profile = profileState.value;
  for (const title of titles) profile = grantTitle(profile, title);
  profileState.value = profile;
  saveProfile(browserStorage(), profile);
  ryuoSeason.value = { ...season, applied: true, result: { ...season.result, titles } };
  saveSeason(browserStorage(), ryuoSeason.value);
}

const rawRyuoSeason = () => JSON.parse(JSON.stringify(ryuoSeason.value));

/** 大会の画面で「対局開始」を押したとき。対局設定を通さずに、次の1局を始める。 */
function startRyuoGame() {
  confirmDiscardSuspended(startRyuoGameNow);
}
function startRyuoGameNow() {
  const season = ryuoSeason.value;
  const pending = season?.pending;
  if (!season || !pending) return;
  const label = ryuoView.value?.pending?.label ?? "";
  tournamentOpen.value = false;
  openPregame();
  matchKind.value = "tournament";
  homeOpen.value = false;
  void initializeEngine();
  coachLevel.value = ["off", "encourage", "detailed"].includes(season.settings.coachLevel) ? season.settings.coachLevel : "detailed";
  ryuoGame.value = { opponentId: pending.opponentId, label };
  startRyuoMatch();
}

/** 保留中の大会の対局を始める。相手の棋力・得意戦法・囲いと、手番(振り駒)は、シーズンが決めている。 */
function startRyuoMatch() {
  const season = ryuoSeason.value;
  const pending = season?.pending;
  const opponent = pending ? season.players[pending.opponentId] : null;
  if (!pending || !opponent) return;
  matchInitialSfen.value = props.initialSfen;
  selectedPlayerColor.value = pending.color;
  activePlayerColor.value = pending.color;
  learningStartLabel.value = "";
  attackGuideEnabled.value = false;
  selectedStrategy.value = "";
  selectedCastle.value = "";
  searchNodes.value = CPU_STRENGTH_PRESETS.find(({ level }) => level === opponent.level)?.value ?? DEFAULT_STRENGTH_VALUE;
  cpuStrategy.value = "random";
  cpuFirstMove.value = "random";
  cpuBishopPreference.value = "";
  cpuRookPreference.value = "";
  cpuTempoPreference.value = "";
  // 得意戦法と囲いは、詳細の指定として渡す(囲いと一体の戦法は、囲いが空)。
  // この1局の戦法は、シーズンが得意戦法の中から選んでいる(古い期は、いちばんの得意戦法)。
  const gameStyle = pending.style ?? opponent.style;
  cpuStrategyDetailsOpen.value = Boolean(gameStyle);
  if (gameStyle) {
    cpuDetailedStrategy.value = gameStyle.strategy;
    cpuDetailedCastle.value = gameStyle.castle;
  }
  ryuoGame.value = { ...(ryuoGame.value ?? { opponentId: opponent.id, label: "" }), outcome: undefined, replay: false };
  ryuoCpuMoves = [];
  matchStarted.value = true;
  pregameOpen.value = false;
  scheduleDeferredCoachPortraitPreload();
  restart();
}

/** 終局を大会に記録する。勝敗は、トーナメント表を進める。千日手(引き分け)は、先後を入れ替えて指し直す。 */
function recordRyuoOutcome(matchResult: MatchResult) {
  const game = ryuoGame.value;
  const season = ryuoSeason.value;
  if (!game || !season?.pending) return;
  if (!matchResult.winner) {
    const next = rawRyuoSeason();
    next.pending.color = next.pending.color === "black" ? "white" : "black";
    ryuoSeason.value = next;
    saveSeason(browserStorage(), next);
    ryuoGame.value = { ...game, replay: true };
    return;
  }
  const outcome = matchResult.winner === humanColor.value ? "win" : "loss";
  const next = recordUserGame(rawRyuoSeason(), outcome);
  // 相手の特徴が手の選び方に表れた場面を、この対局の記録に残す(大会の画面で、やこび姫が話す)。
  const last = next.userGames[next.userGames.length - 1];
  if (last) last.traitMoments = summarizeTraitMoments(ryuoCpuMoves);
  ryuoCpuMoves = [];
  // この対局を、統計のために、あとで別のエンジンで解析する(保存しておき、リロードしても続ける)。
  next.analysisQueue = [...(next.analysisQueue ?? []), {
    seasonId: next.id,
    index: next.userGames.length - 1,
    moves: [...moveHistory],
    color: humanColor.value === Color.WHITE ? "white" : "black",
    win: outcome === "win",
    opponentId: game.opponentId,
  }];
  ryuoSeason.value = next;
  saveSeason(browserStorage(), next);
  ryuoGame.value = { ...game, outcome, replay: false };
  finalizeRyuoSeason();
  void ryuoStats.processQueue();
}

// ---- 大会の統計のための、対局の裏での解析。対局用のエンジンとは別の、軽いエンジンで読む。
const ryuoStats = useRyuoStatsAnalysis({
  season: ryuoSeason,
  saveSeason: (season) => saveSeason(browserStorage(), season),
  engineFactory: ensureEngineFactory,
  compact: () => props.mobile || boardLayout.value === "portrait",
});

/** 結果の画面を見終えた。次に竜王戦を選ぶと、次の期のエントリーになる。 */
function markRyuoResultSeen() {
  const season = ryuoSeason.value;
  if (!season || season.resultSeen) return;
  ryuoSeason.value = { ...season, resultSeen: true };
  saveSeason(browserStorage(), ryuoSeason.value);
}

/** 大会の対局から離れて、トーナメント表(大会の画面)へ戻る。 */
function leaveToTournamentScreen() {
  leaveFinishedMatch();
}

/** 千日手の指し直し。先後を入れ替えて、同じ相手と指す。 */
function replayRyuoGame() {
  startRyuoMatch();
}

function beginMatch() {
  if (matchKind.value === "learning") {
    const start = learningStartPosition({
      startType: learningStartType.value,
      handicapId: learningHandicapId.value,
      handicapGiver: learningHandicapGiver.value,
      playerColor: selectedPlayerColor.value,
      formationSfen: learningFormationResult.value?.ok ? learningFormationResult.value.sfen : "",
      standardSfen: props.initialSfen,
    });
    matchInitialSfen.value = start.sfen;
    activePlayerColor.value = start.playerColor === "white" ? "white" : "black";
    learningStartLabel.value = start.label;
    if (start.sfen !== STANDARD_SFEN) {
      selectedStrategy.value = "";
      selectedCastle.value = "";
    }
  } else {
    matchInitialSfen.value = props.initialSfen;
    activePlayerColor.value = selectedPlayerColor.value;
    learningStartLabel.value = "";
    attackGuideEnabled.value = false;
  }
  matchStarted.value = true;
  pregameOpen.value = false;
  scheduleDeferredCoachPortraitPreload();
  restart();
}

// ホーム画面の装飾(星)の配置。left/topはパーセント、色は夜空の配色に合わせる。
const HOME_STARS = [
  { id: "s1", style: "left:9%;top:16%;width:12px;height:12px;color:#fffcf4;" },
  { id: "s2", style: "left:16%;top:38%;width:8px;height:8px;color:#f1a54c;" },
  { id: "s3", style: "left:24%;top:10%;width:6px;height:6px;color:#d7d1fd;" },
  { id: "s4", style: "left:33%;top:26%;width:8px;height:8px;color:#fffcf4;" },
  { id: "s5", style: "left:52%;top:12%;width:6px;height:6px;color:#f1a54c;" },
  { id: "s6", style: "left:63%;top:22%;width:12px;height:12px;color:#fffcf4;" },
  { id: "s7", style: "left:72%;top:8%;width:8px;height:8px;color:#d7d1fd;" },
  { id: "s8", style: "left:84%;top:30%;width:8px;height:8px;color:#f1a54c;" },
  { id: "s9", style: "left:90%;top:14%;width:14px;height:14px;color:#fffcf4;" },
  { id: "s10", style: "left:12%;top:70%;width:8px;height:8px;color:#f1a54c;" },
  { id: "s11", style: "left:70%;top:74%;width:10px;height:10px;color:#fffcf4;" },
  { id: "s12", style: "left:88%;top:66%;width:8px;height:8px;color:#d7d1fd;" },
];

function closeHome() {
  // 対局は常に対局準備から始める。openPregameが中断保存を破棄する。
  openPregame();
  homeOpen.value = false;
  void initializeEngine();
}

/** やこびノートで自己申告した段級位を、レーティングに設定する。 */
function declareGrade(grade: { label: string; level: number }) {
  ratingState.value = applyDeclaredGrade(ratingState.value, grade);
  saveRatingState(browserStorage(), ratingState.value);
}

/** 棋力測定の前の対局設定。測定の対局を離れたら戻す。 */
let settingsBeforeMeasure: { [key: string]: unknown } | null = null;

/**
 * やこびノートから、棋力測定の対局を対局準備を通さずに始める。
 * 平手・先手・作戦おまかせ・助言なしで、CPUの強さはレーティングに近いレベルにする。
 */
/** やこびノートの「対局する」。ノートを閉じて、通常対局の対局準備を開く。 */
function startMatchFromNote() {
  confirmDiscardSuspended(() => {
    yakobiNoteOpen.value = false;
    matchKind.value = "normal";
    closeHome();
  });
}
function startMeasureMatch() {
  confirmDiscardSuspended(startMeasureMatchNow);
}
function startMeasureMatchNow() {
  yakobiNoteOpen.value = false;
  openPregame();
  settingsBeforeMeasure = captureMatchSettings();
  matchKind.value = "normal";
  searchNodes.value = recommendedStrengthPreset.value.value;
  selectedPlayerColor.value = "black";
  selectedStrategy.value = "";
  selectedCastle.value = "";
  cpuStrategy.value = "random";
  cpuStrategyDetailsOpen.value = false;
  cpuFirstMove.value = "random";
  cpuBishopPreference.value = "";
  cpuRookPreference.value = "";
  cpuTempoPreference.value = "";
  coachLevel.value = "off";
  measureMode.value = true;
  homeOpen.value = false;
  void initializeEngine();
  beginMatch();
}

/** はじめての案内で選んだ道へ進む。 */
function chooseWelcome(choice: string) {
  markWelcomeSeen(browserStorage(), choice);
  welcomeOpen.value = false;
  if (choice === "beginner") tutorialOpen.value = true;
  else if (choice === "rules") startQuickMatch();
  else if (choice === "player") startMeasureMatch();
}

/** 案内を閉じて、ホームから自分で選ぶ。 */
function dismissWelcome() {
  markWelcomeSeen(browserStorage(), "skip");
  welcomeOpen.value = false;
}

/**
 * ホームの「つぎはこれ：対局する」。対局準備を開かず、おすすめの強さ・平手で、先後は振り駒で決めてすぐ始める。
 * ほかの設定(助言・作戦など)は、前に対局準備で選んだものを使う。設定を選びたいときは「自由対局」のタイルから。
 */
function startQuickMatch() {
  confirmDiscardSuspended(() => {
    yakobiNoteOpen.value = false;
    openPregame();
    matchKind.value = "normal";
    searchNodes.value = recommendedStrengthPreset.value.value;
    const toss = throwFurigoma();
    selectedPlayerColor.value = toss.playerColor;
    homeOpen.value = false;
    void initializeEngine();
    beginMatch();
    showFurigoma(toss);
  });
}

/** 「敗着の前から指し直す」で始めた対局の開始局面の名前。終局画面の「もう一局」で同じ局面から始め直す目印にもする。 */
const RETRY_START_LABEL = "敗着の前から";
/** 終盤戦の開始局面の名前。終局画面の「もう一局」で、別の名局の終盤を選ぶ目印にもする。 */
const ENDGAME_START_LABEL = "終盤戦";

/**
 * タイトル画面の「終盤戦」。名局の終盤の局面から、おすすめの強さのCPUとすぐ1局指す(core/endgame-start.mjs)。
 * 代表局の棋譜は重いので、押したときに読み込む。平手の初期局面ではないので、レーティングの対象にはならない。
 */
function startEndgameMatch() {
  confirmDiscardSuspended(() => { void startEndgameNow(); });
}
async function startEndgameNow({ excludeSfen = "" } = {}) {
  const { endgameIntro, endgameSources, pickEndgameStart } = await import("./core/endgame-start.mjs");
  const start = pickEndgameStart(endgameSources(), { excludeSfen });
  if (!start) return;
  yakobiNoteOpen.value = false;
  stopGuidedReview();
  openPregame();
  matchKind.value = "normal";
  searchNodes.value = recommendedStrengthPreset.value.value;
  homeOpen.value = false;
  void initializeEngine();
  startPositionMatch(start.sfen, start.playerColor, ENDGAME_START_LABEL);
  // 持つ側と実戦の勝ち負けは、助言の設定によらず伝える(どちらを持ったか分からないと遊べないため)。
  guideText.value = endgameIntro(start);
}

/**
 * 局面から始める対局。対局の種類と設定は変えず、開始局面だけを差し替える。
 * 平手の初期局面ではないので、レーティングの対象にはならない(recordRatedGame)。
 */
function startPositionMatch(sfen: string, playerColor: "black" | "white", label: string) {
  matchInitialSfen.value = sfen;
  activePlayerColor.value = playerColor;
  learningStartLabel.value = label;
  selectedStrategy.value = "";
  selectedCastle.value = "";
  attackGuideEnabled.value = false;
  matchStarted.value = true;
  pregameOpen.value = false;
  scheduleDeferredCoachPortraitPreload();
  restart();
}

/**
 * 終局画面の「もう一局」。対局準備を通さず、直前と同じ設定ですぐ次の対局を始める。
 * - 平手の通常対局では先後を入れ替える。
 * - levelを渡すとCPUの強さを、handicapIdを渡すと学習対局の駒落ち(CPUが上手)に変えて始める。
 * - 「敗着の前から」の対局は、同じ局面から始め直す。
 */
function rematch(options: { level?: number; handicapId?: string } = {}) {
  if (learningStartLabel.value === ENDGAME_START_LABEL && !options.handicapId) {
    void startEndgameNow({ excludeSfen: matchInitialSfen.value });
    return;
  }
  const retrySfen = learningStartLabel.value === RETRY_START_LABEL ? matchInitialSfen.value : "";
  const previousColor = activePlayerColor.value;
  const alternate = matchKind.value === "normal" && !retrySfen && !options.handicapId;
  stopGuidedReview();
  openPregame();
  if (options.level !== undefined) {
    const preset = CPU_STRENGTH_PRESETS.find(({ level }) => level === options.level);
    if (preset) searchNodes.value = preset.value;
  }
  if (options.handicapId) {
    matchKind.value = "learning";
    learningStartType.value = "handicap";
    learningHandicapId.value = options.handicapId;
    learningHandicapGiver.value = "cpu";
  } else if (alternate) {
    selectedPlayerColor.value = previousColor === "black" ? "white" : "black";
  }
  void initializeEngine();
  if (retrySfen) startPositionMatch(retrySfen, previousColor, RETRY_START_LABEL);
  else beginMatch();
}

/** 振り返りの「敗着の前から指し直す」。本筋のply手目までの局面から、同じ相手・同じ手番で指し直す。 */
function retryFromPly(ply: number) {
  const moves = reviewNavigation.value.mainLine.slice(0, Math.max(0, ply));
  const { nextRecord } = recordAndFormationsFromMoves(matchInitialSfen.value, moves, hiraganaFormationMaster);
  const sfen = nextRecord.position.sfen;
  const playerColor = activePlayerColor.value;
  stopGuidedReview();
  openPregame();
  void initializeEngine();
  startPositionMatch(sfen, playerColor, RETRY_START_LABEL);
}

function openMatchSetup(kind: MatchKind) {
  confirmDiscardSuspended(() => {
    matchKind.value = kind;
    closeHome();
  });
}

/** タイトル画面の「大会」。大会の画面を開く。 */
function openTournamentScreen() {
  tournamentStartAt.value = "select";
  tournamentOpen.value = true;
  // 前に終えた対局の解析が残っていれば、続きを解析する。
  if (ryuoSeason.value?.analysisQueue?.length) void ryuoStats.processQueue();
}

/** 教室のレッスンから、関連する図鑑の項目を開く。 */
function openDexFromTutorial({ kind, id }: { kind: string; id?: string }) {
  if (kind === "opening") {
    openingDexInitialId.value = id ?? "";
    dexOpen.value = true;
    return;
  }
  if (kind === "piece" || kind === "tesuji" || kind === "world" || kind === "glossary") {
    referenceDexInitialId.value = id ?? "";
    referenceDexKind.value = kind;
  }
}

/** 教室の固定条件で上書きする対局設定。 */
function tutorialOverriddenSettings(): { [key: string]: Ref<any> } {
  return {
    matchKind, searchNodes, coachLevel, selectedPlayerColor, selectedStrategy, selectedCastle,
    learningStartType, learningHandicapId, learningHandicapGiver,
    learningPlayerStrategy, learningPlayerCastle, learningOpponentStrategy, learningOpponentCastle,
    learningHintLimit, learningUndoLimit, attackGuideEnabled,
    cpuStrategy, cpuDetailedStrategy, cpuDetailedCastle, cpuFirstMove,
    cpuBishopPreference, cpuRookPreference, cpuTempoPreference, cpuStrategyDetailsOpen,
  };
}

/** 上書き前の設定を控える。リロードしても戻せるよう、中断保存にも入れる。 */
let settingsBeforeTutorial: { [key: string]: unknown } | null = null;
function captureMatchSettings() {
  return Object.fromEntries(Object.entries(tutorialOverriddenSettings()).map(([key, entry]) => [key, entry.value]));
}
function restoreMatchSettings(saved: { [key: string]: unknown }) {
  for (const [key, entry] of Object.entries(tutorialOverriddenSettings())) {
    // 保存値は型が同じときだけ戻す。
    if (key in saved && typeof saved[key] === typeof entry.value) entry.value = saved[key];
  }
}

/** 教室の「対局をはじめる」から、レッスンで決めた条件のまま対局準備を通さずに始める。 */
function startMatchFromTutorial(request: Parameters<typeof startMatchFromTutorialNow>[0]) {
  confirmDiscardSuspended(() => startMatchFromTutorialNow(request));
}

function startMatchFromTutorialNow({ lessonId, preset }: {
  lessonId: string;
  preset: {
    startType: LearningStartType;
    handicapId?: string;
    playerStrategy?: string;
    playerCastle?: string;
    opponentStrategy?: string;
    opponentCastle?: string;
    playerColor: "black" | "white";
    cpuLevel: number;
    hintLimit: number;
    undoLimit: number;
    attackGuide: boolean;
    coachLevel: "off" | "encourage" | "detailed";
  };
}) {
  // 前の対局を片付けてから、教室の条件で上書きする。
  openPregame();
  settingsBeforeTutorial = captureMatchSettings();
  matchKind.value = "learning";
  learningStartType.value = preset.startType;
  if (preset.handicapId) learningHandicapId.value = preset.handicapId;
  learningHandicapGiver.value = "cpu";
  learningPlayerStrategy.value = preset.playerStrategy ?? "";
  learningPlayerCastle.value = preset.playerCastle ?? "";
  learningOpponentStrategy.value = preset.opponentStrategy ?? "";
  learningOpponentCastle.value = preset.opponentCastle ?? "";
  learningHintLimit.value = normalizeAssistLimit(preset.hintLimit);
  learningUndoLimit.value = normalizeAssistLimit(preset.undoLimit);
  attackGuideEnabled.value = preset.attackGuide;
  coachLevel.value = preset.coachLevel;
  searchNodes.value = CPU_STRENGTH_PRESETS.find(({ level }) => level === preset.cpuLevel)?.value
    ?? CPU_STRENGTH_PRESETS[0].value;
  selectedPlayerColor.value = preset.playerColor;
  selectedStrategy.value = "";
  selectedCastle.value = "";
  cpuStrategy.value = "random";
  cpuStrategyDetailsOpen.value = false;
  cpuFirstMove.value = "random";
  cpuBishopPreference.value = "";
  cpuRookPreference.value = "";
  cpuTempoPreference.value = "";
  tutorialMatch.value = { lessonId, playerColor: preset.playerColor, report: null };
  tutorialReport.value = null;
  tutorialOpen.value = false;
  homeOpen.value = false;
  void initializeEngine();
  beginMatch();
}

/** 教室の対局を終え、やこび姫の一言と★の結果画面へ戻る。 */
function returnToTutorial() {
  const report = tutorialMatch.value?.report ?? null;
  openPregame();
  tutorialReport.value = report;
  homeOpen.value = true;
  tutorialOpen.value = true;
}

function tutorialMatchReport(matchResult: MatchResult, lessonId: string, playerColor: "black" | "white"): TutorialMatchReport {
  const used = (allowance: number, remaining: number) => (Number.isFinite(allowance) ? Math.max(0, allowance - remaining) : 0);
  return {
    lessonId,
    outcome: tutorialMatchOutcome(matchResult, playerColor),
    reason: matchResult.reason,
    assistsUsed: used(matchHintAllowance(), hintsRemaining.value) + used(matchUndoAllowance(), undosRemaining.value),
  };
}

/** 対局を保存してホームへ戻る。盤の状態は消し、再開は保存した対局から復元する。 */
function suspendMatch() {
  suspendConfirmOpen.value = false;
  if (!props.showHome || !active.value || reviewMode.value || !matchStarted.value) return;
  matchGeneration += 1;
  if (cpuTimer) clearTimeout(cpuTimer);
  cpuTimer = undefined;
  if (cpuSearchRunning) engine?.stop();
  cancelPlayerIdleAdvice();
  coachAdviceScheduler.reset();
  suspendedMatch.value = { moves: moveHistory.length };
  persistMatchState();
  active.value = false;
  thinking.value = false;
  matchStarted.value = false;
  settingsOpen.value = false;
  resignConfirmOpen.value = false;
  openHome();
}

/** 中断した対局を、保存した状態から続ける。 */
function resumeSuspendedMatch() {
  if (!suspendedMatch.value) return;
  suspendedMatch.value = null;
  if (!restorePersistedMatch({ resume: true })) {
    errorMessage.value = "中断した対局を読み込めませんでした。";
    return;
  }
  // 保存した状態から、中断の印を外す。
  persistMatchState();
  void initializeEngine();
  // エンジンが準備済みなら、初期化を待たずにCPUの手番などを再開する。
  if (engineReady.value) {
    scheduleCpuMove();
    scheduleOpeningGuideSafety();
    schedulePlayerIdleAdvice();
  }
}

/** 中断した対局があるときは、新しく始める前に確認する。 */
function confirmDiscardSuspended(proceed: () => void) {
  if (!suspendedMatch.value) {
    proceed();
    return;
  }
  discardSuspendedPending.value = proceed;
}
function acceptDiscardSuspended() {
  const proceed = discardSuspendedPending.value;
  discardSuspendedPending.value = null;
  suspendedMatch.value = null;
  proceed?.();
}

function openHome() {
  measureMode.value = false;
  homeOpen.value = true;
}

/** 教室で終えた(クリアかスキップした)レッスンの数。タイトル画面を開くたび、教室を閉じるたびに読み直す。 */
const homeLessonsDone = ref(0);
function refreshHomeProgress() {
  homeLessonsDone.value = Object.keys(loadTutorialProgress(browserStorage()).lessons).length;
}
watch([homeOpen, tutorialOpen], ([home, tutorial]) => {
  if (home && !tutorial) refreshHomeProgress();
}, { immediate: true });

/** 対局を始める前の人(教室を始めた人、通常対局が3局未満の人)には、教室を先に案内する。 */
const HOME_TUTORIAL_GAMES = 3;
type HomeNext = { id: "resume" | "tutorial" | "match"; label: string; description: string };
/** タイトル画面の「つぎはこれ」。中断した対局、教室のつづき、対局の順に、いまの状態に合うものを1つ選ぶ。 */
const homeNext = computed<HomeNext>(() => {
  if (suspendedMatch.value) {
    return { id: "resume", label: "対局を再開", description: `中断した対局（${suspendedMatch.value.moves}手目まで）` };
  }
  const games = ratingState.value.games;
  if (games === 0 && homeLessonsDone.value === 0) {
    return { id: "tutorial", label: "将棋教室ではじめる", description: "駒の動かし方から、やこび姫といっしょに覚えよう" };
  }
  if (homeLessonsDone.value > 0 && games < HOME_TUTORIAL_GAMES) {
    return { id: "tutorial", label: "将棋教室のつづき", description: `${homeLessonsDone.value}レッスン終わったよ。次のレッスンへ進もう` };
  }
  const preset = recommendedStrengthPreset.value;
  return { id: "match", label: "対局する", description: `Lv.${preset.level} ${preset.label}の相手と、振り駒ですぐ始める` };
});
function startHomeNext() {
  if (homeNext.value.id === "resume") resumeSuspendedMatch();
  else if (homeNext.value.id === "tutorial") tutorialOpen.value = true;
  else startQuickMatch();
}
/** やこび姫の吹き出し。「つぎはこれ」に合わせて一言かける。 */
const homeGreeting = computed(() => ({
  resume: "さっきの対局、続きをしよう！",
  tutorial: homeLessonsDone.value ? "今日も教室で練習しよう！" : "はじめまして！ いっしょに覚えよう",
  match: "今日はなにをする？",
})[homeNext.value.id]);
const homeAffiliation = computed(() => currentAffiliation(profileState.value)?.label ?? "");

/*
 * ブラウザの戻るで、手前に重なった画面から1段ずつ閉じる。対局準備はホームへ戻る。
 * 対局中と振り返り中は、保存を消さないよう対局画面から離れない。ホームでは元のページへ戻る。
 */
function navigateBack() {
  if (welcomeOpen.value && homeOpen.value) {
    dismissWelcome();
  } else if (discardSuspendedPending.value) {
    discardSuspendedPending.value = null;
  } else if (tournamentOpen.value) {
    // 大会の画面は、中の画面(説明・トーナメント表)から、大会の選択へ、そして閉じる、の順に戻る。
    if (tournamentView.value) tournamentView.value.goBack();
    else tournamentOpen.value = false;
  } else if (yakobiNoteOpen.value) {
    yakobiNoteOpen.value = false;
  } else if (referenceDexKind.value) {
    // 駒の説明へ飛んできたときは、先に元の表へ戻す。
    if (referenceDexView.value) referenceDexView.value.goBack();
    else referenceDexKind.value = "";
  } else if (dexOpen.value) {
    dexOpen.value = false;
    openingDexInitialId.value = "";
  } else if (tutorialOpen.value) {
    if (tutorialView.value) tutorialView.value.goBack();
    else tutorialOpen.value = false;
  } else if (problemSetOpen.value) {
    if (problemSetView.value) problemSetView.value.goBack();
    else problemSetOpen.value = false;
  } else if (homeOpen.value) {
    // ホームが最下段。
  } else if (suspendConfirmOpen.value) {
    suspendConfirmOpen.value = false;
  } else if (resignConfirmOpen.value) {
    resignConfirmOpen.value = false;
  } else if (strategyExplanationOpen.value) {
    strategyExplanationOpen.value = false;
  } else if (analysisMenuOpen.value) {
    analysisMenuOpen.value = false;
  } else if (settingsOpen.value) {
    closeSettings();
  } else if (pregamePicker.value) {
    pregamePicker.value = "";
  } else if (pregameOpen.value) {
    openHome();
  } else if (guidedReview.value) {
    stopGuidedReview();
  } else if (reviewMode.value && analysisOpen.value) {
    analysisOpen.value = false;
  }
}

// ホームを出す単体表示のときだけ、ブラウザの戻るをアプリ内の戻るにする。埋め込み先の履歴には触れない。
useBackNavigation({
  enabled: props.showHome,
  canGoBack: () => !homeOpen.value || (welcomeOpen.value && homeOpen.value) || Boolean(discardSuspendedPending.value) || tournamentOpen.value || tutorialOpen.value || problemSetOpen.value || dexOpen.value || yakobiNoteOpen.value || Boolean(referenceDexKind.value),
  goBack: navigateBack,
});

function openPregame() {
  matchGeneration += 1;
  cancelResultReveal();
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
  ryuoGame.value = null;
  // 大会の対局準備はないので、対局準備を開くときは通常対局へ戻す。
  if (matchKind.value === "tournament") matchKind.value = "normal";
  suspendedMatch.value = null;
  suspendConfirmOpen.value = false;
  measureMode.value = false;
  measureSession.value = false;
  measureAnalyzing.value = false;
  if (settingsBeforeMeasure) restoreMatchSettings(settingsBeforeMeasure);
  settingsBeforeMeasure = null;
  // 教室の対局から離れたら、教室の固定条件を元の設定へ戻す。
  if (tutorialMatch.value) {
    if (settingsBeforeTutorial) restoreMatchSettings(settingsBeforeTutorial);
    settingsBeforeTutorial = null;
    tutorialMatch.value = null;
  }
}

/** 選択中の強さのLv。戦法の出現比率と囲い選びの傾向に使う。 */
function cpuStrengthLevel() {
  return CPU_STRENGTH_PRESETS.find((preset) => preset.value === searchNodes.value)?.level;
}

function configuredCpuOpeningStrategy(): string {
  return cpuStrategyDetailsOpen.value
    ? (cpuDetailedStrategy.value || cpuStrategy.value)
    : cpuStrategy.value;
}

function currentCpuOpeningTurn() {
  const cpuIsBlack = humanColor.value === Color.WHITE;
  const cpuMoves = moveHistory.filter((_, index) => isBlackMoveIndex(index) === cpuIsBlack);
  return {
    cpuIsBlack,
    cpuMoves,
    cpuColor: cpuIsBlack ? "black" as const : "white" as const,
  };
}

function strategyMove(): { usi: string; phase: "strategy" | "castle" } | undefined {
  // 駒落ちや途中局面では平手用定跡を当てはめない。
  if (matchInitialSfen.value !== STANDARD_SFEN) return undefined;
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
    // 開始局面や投了などの特殊な手は、駒を取った手ではない。
    lastMoveWasCapture: record.value.current.move instanceof Move && Boolean(record.value.current.move.capturedPieceType),
  })) return undefined;
  if (!cpuOpeningPlan) cpuOpeningPlan = randomCpuOpeningCombination(cpuMoves, configuredCpuColor, legalMoves);
  if (!cpuOpeningPlan) {
    const selectedPlan = selectCpuOpeningRepertoire({
      configuredStrategy: configuredCpuOpeningStrategy(),
      cpuColor: configuredCpuColor,
      moves: moveHistory,
      bishopPreference: cpuBishopPreference.value,
      rookPreference: cpuRookPreference.value,
      tempoPreference: cpuTempoPreference.value,
      level: cpuStrengthLevel(),
    });
    // 戦法と囲いが一体の定義は、もう片方と組み合わせない。
    const castleSpecified = cpuStrategyDetailsOpen.value && Boolean(cpuDetailedCastle.value);
    const castleOnly = isStandaloneOpening(cpuDetailedCastle.value, "castle");
    cpuOpeningPlan = castleSpecified && !isStandaloneOpening(selectedPlan.strategyId, "strategy")
      ? {
          ...selectedPlan,
          strategyId: castleOnly ? "" : selectedPlan.strategyId,
          castleId: cpuDetailedCastle.value,
          label: [
            castleOnly ? undefined : OPENING_STRATEGIES.find(({ id }) => id === selectedPlan.strategyId)?.label,
            OPENING_CASTLES.find(({ id }) => id === cpuDetailedCastle.value)?.label,
          ].filter(Boolean).join("＋"),
        }
      // 詳しく指定しなかった囲い・戦法は、相手の指し手を見て組み替える。
      : createAdaptiveCpuPlan(selectedPlan, {
          adaptCastle: !castleSpecified,
          adaptStrategy: !(cpuStrategyDetailsOpen.value && cpuDetailedStrategy.value),
        });
  }
  cpuOpeningPlan = adaptCpuOpeningPlan({
    plan: cpuOpeningPlan,
    cpuColor: configuredCpuColor,
    cpuMoves,
    opponentMoves: moveHistory.filter((_, index) => isBlackMoveIndex(index) !== cpuIsBlack),
    currentSfen: currentSfen.value,
    level: cpuStrengthLevel(),
  }) ?? cpuOpeningPlan;
  const cpuColor = cpuIsBlack ? Color.BLACK : Color.WHITE;
  const opponentMoves = moveHistory.filter((_, index) => isBlackMoveIndex(index) !== cpuIsBlack);
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

/**
 * 「おまかせ」で細かい指定がない場合、登録済みの戦法・囲いから現在の局面で成立するものを組み合わせる。
 * 低レベルほど高い確率で選び、選ばなかった場合は従来の主要な作戦から選ぶ。
 */
function randomCpuOpeningCombination(cpuMoves: string[], color: "black" | "white", legalMoves: string[]) {
  if (
    cpuStrategyDetailsOpen.value || cpuStrategy.value !== "random"
    || cpuBishopPreference.value || cpuTempoPreference.value
    || (cpuRookPreference.value && cpuRookPreference.value !== "adaptive")
  ) return null;
  if (Math.random() >= randomOpeningCombinationRate(strengthPresetFor(searchNodes.value).skill)) return null;
  const cpuColor = color === "black" ? Color.BLACK : Color.WHITE;
  const opponentColor = color === "black" ? "white" : "black";
  const opponentMoves = moveHistory.filter((_, index) => isBlackMoveIndex(index) !== (color === "black"));
  const context = {
    color,
    playedMoves: cpuMoves,
    moveHistory,
    legalMoves,
    detectedFormations: formationNamesForColor(currentSfen.value, cpuColor),
    currentSfen: currentSfen.value,
    rookStyle: inferOpeningRookStyle({ color, playedMoves: cpuMoves, currentSfen: currentSfen.value }),
  };
  return selectRandomOpeningCombination({
    strategies: availableOpeningDefinitions({ ...context, definitions: OPENING_STRATEGIES, kind: "strategy" }),
    castles: availableOpeningDefinitions({ ...context, definitions: OPENING_CASTLES, kind: "castle" }),
    opponentRookStyle: inferOpeningRookStyle({
      color: opponentColor,
      playedMoves: opponentMoves,
      currentSfen: currentSfen.value,
    }),
  });
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
    return createGameRecord(matchInitialSfen.value);
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

function persistMatchState() {
  if (
    restoringSavedMatch || !matchStorage || !matchStorageKey
    || !matchStarted.value || pregameOpen.value || reviewMode.value
  ) return;
  saveMatchSnapshot(matchStorage, matchStorageKey, {
    initialSfen: props.initialSfen,
    mode: normalizedMode.value,
    matchKind: matchKind.value,
    startSfen: matchInitialSfen.value,
    learning: {
      startType: learningStartType.value,
      handicapId: learningHandicapId.value,
      handicapGiver: learningHandicapGiver.value,
      playerStrategy: learningPlayerStrategy.value,
      playerCastle: learningPlayerCastle.value,
      opponentStrategy: learningOpponentStrategy.value,
      opponentCastle: learningOpponentCastle.value,
      hintLimit: learningHintLimit.value,
      undoLimit: learningUndoLimit.value,
      startLabel: learningStartLabel.value,
      attackGuide: attackGuideEnabled.value,
      movementArrows: movementArrowsEnabled.value,
    },
    suspended: suspendedMatch.value !== null,
    ryuoGame: ryuoGame.value,
    tutorial: tutorialMatch.value,
    settingsBeforeTutorial: tutorialMatch.value ? settingsBeforeTutorial : null,
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
    // おまかせで組んだ作戦をリロード後も引き継ぐ。
    cpuOpeningPlan,
    cpuBlunderPlies: cpuBlunderPlies.filter((ply) => ply < moveHistory.length),
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

function restoreLearningSettings(snapshot: { [key: string]: any }) {
  const savedRyuo = snapshot.ryuoGame;
  const restoredRyuo: RyuoGame | null = snapshot.matchKind === "tournament" && savedRyuo
    && typeof savedRyuo.opponentId === "string" && ryuoSeason.value?.players?.[savedRyuo.opponentId]
    ? {
      opponentId: savedRyuo.opponentId,
      label: typeof savedRyuo.label === "string" ? savedRyuo.label : "",
      outcome: savedRyuo.outcome === "win" || savedRyuo.outcome === "loss" ? savedRyuo.outcome : undefined,
      replay: savedRyuo.replay === true,
    }
    : null;
  matchKind.value = snapshot.matchKind === "learning" ? "learning" : restoredRyuo ? "tournament" : "normal";
  ryuoGame.value = restoredRyuo;
  // 保存時の開始局面で棋譜を再生する。不正なSFENは復元全体を取り消す。
  const startSfen = typeof snapshot.startSfen === "string" ? snapshot.startSfen : props.initialSfen;
  createGameRecord(startSfen);
  matchInitialSfen.value = startSfen;
  const learning = snapshot.learning && typeof snapshot.learning === "object" ? snapshot.learning : {};
  const text = (value: unknown) => typeof value === "string" ? value : "";
  learningStartType.value = ["standard", "handicap", "formation"].includes(learning.startType)
    ? learning.startType
    : "standard";
  learningHandicapId.value = LEARNING_HANDICAPS.some(({ id }) => id === learning.handicapId)
    ? learning.handicapId
    : "bishop";
  learningHandicapGiver.value = learning.handicapGiver === "player" ? "player" : "cpu";
  learningPlayerStrategy.value = text(learning.playerStrategy);
  learningPlayerCastle.value = text(learning.playerCastle);
  learningOpponentStrategy.value = text(learning.opponentStrategy);
  learningOpponentCastle.value = text(learning.opponentCastle);
  learningHintLimit.value = normalizeAssistLimit(learning.hintLimit);
  learningUndoLimit.value = normalizeAssistLimit(learning.undoLimit);
  learningStartLabel.value = text(learning.startLabel);
  attackGuideEnabled.value = matchKind.value === "learning" && learning.attackGuide === true;
  // 保存のない以前の対局でも、学習対局の既定どおりオンにする。
  movementArrowsEnabled.value = learning.movementArrows !== false;
  tutorialMatch.value = matchKind.value === "learning" ? restoredTutorialMatch(snapshot.tutorial) : null;
  settingsBeforeTutorial = tutorialMatch.value && snapshot.settingsBeforeTutorial && typeof snapshot.settingsBeforeTutorial === "object"
    ? snapshot.settingsBeforeTutorial
    : null;
}

function restoredTutorialMatch(value: unknown): typeof tutorialMatch.value {
  if (!value || typeof value !== "object") return null;
  const { lessonId, playerColor, report } = value as { [key: string]: any };
  // レッスンがあるかは教室の画面が確かめる。ここで教室のデータを読むと、最初に読むJSが重くなる。
  if (typeof lessonId !== "string" || !/^[\w-]{1,40}$/.test(lessonId)) return null;
  const color = playerColor === "white" ? "white" : "black";
  const validReport = report && typeof report === "object" && ["win", "lose", "draw"].includes(report.outcome)
    ? {
      lessonId,
      outcome: report.outcome as TutorialMatchReport["outcome"],
      reason: typeof report.reason === "string" ? report.reason.slice(0, 40) : "",
      assistsUsed: Number.isFinite(report.assistsUsed) ? Math.max(0, Math.trunc(report.assistsUsed)) : 0,
    }
    : null;
  return { lessonId, playerColor: color, report: validReport };
}

function restoredCpuOpeningPlan(value: unknown): typeof cpuOpeningPlan {
  if (!value || typeof value !== "object") return null;
  const { strategyId, castleId, label, adaptCastle, adaptStrategy, castleStance, exchangeHandled, switchedFrom } = value as { [key: string]: unknown };
  if (typeof strategyId !== "string" || typeof castleId !== "string" || typeof label !== "string") return null;
  if (strategyId && !OPENING_STRATEGIES.some(({ id }) => id === strategyId)) return null;
  if (castleId && !OPENING_CASTLES.some(({ id }) => id === castleId)) return null;
  if (!strategyId && !castleId) return null;
  // 相手に合わせた囲いの組み替えや角換わりへの切り替えの状態も、作戦と一緒に戻す。
  return {
    strategyId,
    castleId,
    label: label.slice(0, 80),
    adaptCastle: adaptCastle === true,
    adaptStrategy: adaptStrategy === true,
    castleStance: castleStance === "static" || castleStance === "ranging" ? castleStance : undefined,
    exchangeHandled: exchangeHandled === true,
    switchedFrom: typeof switchedFrom === "string" ? switchedFrom.slice(0, 40) : undefined,
  };
}

function discardPersistedMatch() {
  clearMatchSnapshot(matchStorage, matchStorageKey);
}

/**
 * 保存した対局を復元する。中断した対局は、ホームの「対局を再開」が押されるまで復元せず、再開の案内だけを出す。
 */
function restorePersistedMatch({ resume = false } = {}): boolean {
  const snapshot = loadMatchSnapshot(matchStorage, matchStorageKey, {
    initialSfen: props.initialSfen,
    mode: normalizedMode.value,
  });
  if (!snapshot) return false;
  if (snapshot.suspended === true && props.showHome && !resume) {
    suspendedMatch.value = { moves: Array.isArray(snapshot.moves) ? snapshot.moves.length : 0 };
    return false;
  }
  restoringSavedMatch = true;
  try {
    if (
      !Array.isArray(snapshot.moves)
      || snapshot.moves.length > 1000
      || snapshot.moves.some((move: unknown) => typeof move !== "string" || move.length > 8)
    ) throw new Error("保存棋譜が不正です。");
    const moves = snapshot.moves as string[];
    restoreLearningSettings(snapshot);
    const { nextRecord, nextFormationState } = recordAndFormationsFromMoves(
      matchInitialSfen.value,
      moves,
      hiraganaFormationMaster,
    );
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
    cpuOpeningPlan = restoredCpuOpeningPlan(snapshot.cpuOpeningPlan);
    cpuBlunderPlies = Array.isArray(snapshot.cpuBlunderPlies)
      ? snapshot.cpuBlunderPlies.filter((ply: unknown) => Number.isInteger(ply) && (ply as number) >= 0 && (ply as number) < moves.length)
      : [];
    coachLevel.value = ["off", "encourage", "detailed"].includes(snapshot.coachLevel)
      ? snapshot.coachLevel
      : "detailed";
    selectedStrategy.value = typeof snapshot.selectedStrategy === "string"
      ? snapshot.selectedStrategy
      : "";
    selectedCastle.value = typeof snapshot.selectedCastle === "string" ? snapshot.selectedCastle : "";
    hintsRemaining.value = savedMatchNumber(snapshot.hintsRemaining, matchHintAllowance(), 0, matchHintAllowance());
    undosRemaining.value = savedMatchNumber(snapshot.undosRemaining, matchUndoAllowance(), 0, matchUndoAllowance());
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
  if (!shouldDisplayCoachAdvice({
    advice,
    review: reviewMode.value,
    currentSfen: currentSfen.value,
    moveCount: moveCount.value,
    lastShownAt: coachAdviceLastShownAt.get(advice.key),
  })) return false;
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
  const base = matchInitialSfen.value === STANDARD_SFEN ? "startpos" : matchInitialSfen.value;
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

/** CPUの危険の見積もり用に、候補手の先の局面を読む追加探索。通常探索の直後へ直列で行う。 */
function cpuRiskProbe(enginePosition: string, isCurrent: () => boolean) {
  return async (moves: string[], { nodes, multiPv }: { nodes: number, multiPv: number }) => {
    if (!engine || !isCurrent()) return undefined;
    engine.applyStrengthOptions({ multiPv });
    engine.setPosition(`${enginePosition}${enginePosition.includes(" moves ") ? "" : " moves"} ${moves.join(" ")}`);
    return engine.go({ nodes, maxTimeMs: 1500 });
  };
}

async function analyzeCoachPosition(nodes: number, maxTimeMs: number, multiPv = 1) {
  if (!engine) return [];
  const positionKey = currentEnginePosition();
  const cached = positionAnalysisCache.get(positionKey, { nodes, multiPv });
  if (cached) return cached;
  engine.setPosition(positionKey);
  engine.applyStrengthOptions({ multiPv });
  const { value: analysis, interrupted } = await assistSearchControl.run(
    () => engine!.go({ nodes, maxTimeMs }),
  );
  if (interrupted) return [];
  positionAnalysisCache.set(positionKey, analysis.candidates, { nodes, multiPv });
  return analysis.candidates;
}

/**
 * 悪手判定の読み。着手の前後の局面を、同じ深さ(getMoveJudgeSearchSettings)で読む。
 * 着手前の局面は、プレイヤーの手番の間に読んでおく(moveJudgeBefore)。間に合わなかったときは、
 * 着手後の局面と一緒に、相手の思考時間として読む。
 */
let moveJudgeBefore: { positionKey: string; score?: EngineEvaluation } | undefined;
function enginePositionAt(ply: number) {
  const base = matchInitialSfen.value === STANDARD_SFEN ? "startpos" : matchInitialSfen.value;
  const moves = moveHistory.slice(0, ply);
  return `${base}${moves.length ? ` moves ${moves.join(" ")}` : ""}`;
}
async function judgeSearchScore(positionKey: string): Promise<EngineEvaluation | undefined> {
  if (!engine) return undefined;
  const settings = getMoveJudgeSearchSettings(props.mobile || boardLayout.value === "portrait");
  engine.setPosition(positionKey);
  engine.applyStrengthOptions({ multiPv: 1 });
  const search = await engine.go({ nodes: settings.nodes, maxTimeMs: settings.maxTimeMs });
  return search.candidates.find((candidate) => candidate.rank === 1)?.score as EngineEvaluation | undefined;
}
/** プレイヤーの手番の間に、着手前の局面を悪手判定の深さで読んでおく。詳しい助言のときだけ。 */
function scheduleMoveJudgeBaseline() {
  if (
    !engine || !engineReady.value || !active.value || reviewMode.value
    || normalizedMode.value !== "cpu" || coachLevel.value !== "detailed"
    || record.value.position.color !== humanColor.value
  ) return;
  const historyLength = moveHistory.length;
  const positionKey = currentEnginePosition();
  if (moveJudgeBefore?.positionKey === positionKey) return;
  const stale = () => (
    !active.value || reviewMode.value || moveHistory.length !== historyLength
    || record.value.position.color !== humanColor.value
  );
  dedicatedCoachQueue = dedicatedCoachQueue
    .catch(() => undefined)
    .then(async () => {
      if (stale()) return;
      const { value: score, interrupted } = await assistSearchControl.run(() => judgeSearchScore(positionKey));
      if (interrupted || stale()) return;
      moveJudgeBefore = { positionKey, score: scoreForPlayer(score, humanColor.value, humanColor.value) };
    })
    .catch(() => undefined);
}
/**
 * 直前のプレイヤーの着手を、悪手判定の深さで読んで評価する(CPUの手番の、CPUの探索の直前に呼ぶ)。
 * 返す評価値は、どちらもプレイヤー視点。読めなかったときはnull。
 */
async function judgePlayerMove(isCurrent: () => boolean) {
  if (!engine || !engineReady.value || coachLevel.value !== "detailed" || moveHistory.length < 1) return null;
  const beforeKey = enginePositionAt(moveHistory.length - 1);
  const afterKey = currentEnginePosition();
  const sideAfter = record.value.position.color;
  let before = moveJudgeBefore?.positionKey === beforeKey ? moveJudgeBefore.score : undefined;
  if (!before) {
    before = scoreForPlayer(await judgeSearchScore(beforeKey), reverseColor(sideAfter), humanColor.value);
    if (!isCurrent()) return null;
  }
  const after = scoreForPlayer(await judgeSearchScore(afterKey), sideAfter, humanColor.value);
  if (!isCurrent() || !before || !after) return null;
  return { before, after };
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
  const playerMoves = moveHistory.filter((_, index) => isBlackMoveIndex(index) === playerIsBlack);
  const opponentMoves = moveHistory.filter((_, index) => isBlackMoveIndex(index) !== playerIsBlack);
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
      // 戦法と囲いを評価値で比べるため、上位候補に入らなかった各フェーズの先頭の予定手も評価する。
      const unscoredPlans = ["strategy", "castle"]
        .filter((phase) => !plannedOptions.some((option) => (
          option.phase === phase && candidates.some(({ move }) => move === option.usi)
        )))
        .map((phase) => plannedOptions.find((option) => option.phase === phase)?.usi)
        .filter((usi): usi is string => Boolean(usi));
      if (unscoredPlans.length) {
        engine!.setPosition(currentEnginePosition());
        engine!.applyStrengthOptions({ multiPv: unscoredPlans.length });
        const { value: forced, interrupted } = await assistSearchControl.run(
          () => engine!.go({
            nodes: settings.forcedNodes,
            maxTimeMs: settings.forcedMaxTimeMs,
            searchMoves: unscoredPlans,
          }),
        );
        if (interrupted) return;
        const forcedCandidates = forced.candidates
          .filter(({ move }) => unscoredPlans.includes(move) && !candidates.some((entry) => entry.move === move))
          .sort((left, right) => left.rank - right.rank);
        candidates = [
          ...candidates,
          ...forcedCandidates.map((candidate, index) => ({
            ...candidate,
            rank: settings.multiPv + index + 1,
          })),
        ];
      }
      if (
        generation !== openingGuideSafetyGeneration || !active.value || reviewMode.value
        || moveHistory.length !== historyLength
        || record.value.position.color !== humanColor.value
      ) return;
      const playerMoves = moveHistory.filter((_, index) => isBlackMoveIndex(index) === playerIsBlack);
      const compatibleCandidates = filterOpeningCompatibleCandidates({
        strategyId: selectedStrategy.value,
        color: playerIsBlack ? "black" : "white",
        playedMoves: playerMoves,
        plannedMoves: plannedOptions,
        candidates,
      });
      const phaseOfPlan = (usi: string | null) => (
        plannedOptions.find((option) => option.usi === usi)?.phase ?? planned?.phase
      );
      const bestPlanUsi = selectBestOpeningPlan(plannedOptions, compatibleCandidates);
      const choice: { usi: string; source: "plan" | "ai"; scoreLoss?: number } | null | undefined = plannedOptions.length
        ? chooseAdaptiveOpeningMove(
            plannedOptions,
            compatibleCandidates,
            (usi: string | null) => openingGuideScoreLossLimit(selectedStrategy.value, phaseOfPlan(usi)),
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
      // 危険な定跡手として示すのは、戦法・囲いのうち評価を比べて選んだ予定手。
      const unsafePlanUsi = bestPlanUsi ?? planned?.usi;
      if (choice.source === "ai" && unsafePlanUsi) {
        openingGuideDetourCandidates.value = openingDetourArrowCandidates(
          unsafePlanUsi,
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
        if (planBlocked || !unsafePlanUsi) {
          guideText.value = `予定の形へすぐ進めないから、まずは${formatHintMove(choice.usi, currentSfen.value)}で局面を整えよう。`;
        } else {
          const plannedText = formatHintMove(unsafePlanUsi, currentSfen.value);
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

/**
 * エンジン所有権を持つ呼び出し元専用。待ち行列へは積まず、通常探索で連続王手詰みを調べる。
 */
async function engineMateCheck(
  sfen: string,
  options: { nodes: number; maxTimeMs: number; maxPly?: number },
): Promise<{ status: "mate"; plies: number } | { status: "no-mate" | "unknown" }> {
  if (!engine || !engineReady.value) return { status: "unknown" };
  const maxPly = options.maxPly ?? 7;
  try {
    engine.setPosition(sfen);
    engine.applyStrengthOptions({ multiPv: 1 });
    const { value: search, interrupted } = await assistSearchControl.run(
      () => engine!.go({ nodes: options.nodes, maxTimeMs: options.maxTimeMs }),
    );
    if (interrupted) return { status: "unknown" };
    const best = search.candidates.find((candidate) => candidate.rank === 1);
    return mateCheckResultFromCandidate(sfen, best, maxPly);
  } catch {
    return { status: "unknown" };
  }
}

/**
 * プレイヤーの手番に、局面を読み直して助言する。詳しい助言では、詰み筋・評価の崖・飛車の危機などの注意を出す。
 * riskOnly: CPU着手の直後に、すでに形勢の助言を出したとき。注意すべきことがあるときだけ出す。
 * ここで読んだ評価値は、悪手判定の基準(playerTurnScore)にはしない。悪手判定は、着手の前後をCPU本体の
 * 同じ深さの探索で比べるため、深さの違う評価値を混ぜると、悪手でない手を悪手と言ってしまう。
 */
async function updateDedicatedCoachAdvice(
  moveFeedback?: { key: string; text: string } | null,
  { riskOnly = false }: { riskOnly?: boolean } = {},
) {
  if (!engine || !active.value || reviewMode.value || coachLevel.value === "off") return;
  if (record.value.position.color !== humanColor.value) return;
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
  // 通常探索がまだmateを返していない明確な勝勢だけ、短時間の通常探索で再確認する。
  if (coachLevel.value === "detailed" && score?.type === "cp" && score.value >= 2500) {
    const mate = await engineMateCheck(currentSfen.value, {
      ...getMateCheckSearchSettings(props.mobile || boardLayout.value === "portrait"),
      maxPly: 7,
    });
    if (mate.status === "mate") score = { type: "mate", value: mate.plies };
  }
  if (!active.value || moveHistory.length !== analyzedHistoryLength) return;
  const inCheck = isSideToMoveInCheck(currentSfen.value);
  const threatSfen = coachLevel.value === "detailed" && !inCheck
    ? flipSideToMove(currentSfen.value)
    : null;
  const mateThreatResult = threatSfen
    ? await engineMateCheck(threatSfen, {
        ...getMateCheckSearchSettings(props.mobile || boardLayout.value === "portrait"),
        maxPly: 7,
      })
    : null;
  const mateThreat = mateThreatResult?.status === "mate";
  const bestMove = candidates.find((candidate) => candidate.rank === 1)?.move;
  const riskAdvice = coachLevel.value === "detailed"
    ? getCandidateRiskAdvice(normalizedCandidates, {
        inCheck,
        mateThreat,
        mateThreatChecked: mateThreatResult !== null && mateThreatResult.status !== "unknown",
        moveCount: moveCount.value,
        ...(bestMove ? bestMoveTacticalContext(bestMove) : {}),
      })
    : null;
  if (riskOnly) {
    if (moveFeedback ?? riskAdvice) showCoachAdvice(moveFeedback ?? riskAdvice);
    return;
  }
  updateCoachAdviceFromPlayerScore(score, moveFeedback ?? riskAdvice, false);
}

function scheduleDedicatedCoachAdvice(
  moveFeedback?: { key: string; text: string } | null,
  options: { riskOnly?: boolean } = {},
) {
  dedicatedCoachQueue = dedicatedCoachQueue
    .catch(() => undefined)
    .then(async () => {
      try {
        await updateDedicatedCoachAdvice(moveFeedback, options);
      } finally {
        engine?.applyStrengthOptions({ multiPv: 1 });
      }
    })
    .catch(() => undefined);
}

/**
 * 好手・神の一手・詰めろ受けを判定するため、プレイヤー手番の開始時に短時間だけ解析する。
 * CPU着手の描画後に、定跡安全確認の後ろへ直列で積む。
 */
function schedulePlayerMoveBaseline() {
  const generation = ++playerMoveBaselineGeneration;
  playerMoveBaseline = undefined;
  if (
    !engine || !engineReady.value || !active.value || reviewMode.value
    || normalizedMode.value !== "cpu" || coachLevel.value !== "detailed"
    || record.value.position.color !== humanColor.value
  ) return;
  const historyLength = moveHistory.length;
  const stale = () => (
    generation !== playerMoveBaselineGeneration || !active.value || reviewMode.value
    || moveHistory.length !== historyLength || record.value.position.color !== humanColor.value
  );
  dedicatedCoachQueue = dedicatedCoachQueue
    .catch(() => undefined)
    .then(async () => {
      if (stale()) return;
      const settings = getPraiseBaselineSearchSettings(
        props.mobile || boardLayout.value === "portrait",
      );
      const shallow = await analyzeCoachPosition(
        settings.shallow.nodes,
        settings.shallow.maxTimeMs,
        settings.shallow.multiPv,
      );
      if (stale()) return;
      const deep = await analyzeCoachPosition(
        settings.deep.nodes,
        settings.deep.maxTimeMs,
        settings.deep.multiPv,
      );
      if (stale()) return;
      const threatSfen = moveHistory.length >= 20 ? flipSideToMove(currentSfen.value) : null;
      const mateSettings = getMateCheckSearchSettings(
        props.mobile || boardLayout.value === "portrait",
      );
      const mateThreat = threatSfen
        ? await engineMateCheck(threatSfen, { ...mateSettings, maxPly: 7 })
        : null;
      if (stale()) return;
      const pick = (candidates: typeof shallow) => candidates.map(({ rank, move, score }) => ({
        rank,
        move,
        score: score as EngineEvaluation | undefined,
      }));
      playerMoveBaseline = {
        historyLength,
        shallow: pick(shallow),
        deep: pick(deep),
        mateThreat: mateThreat?.status === "mate",
      };
    })
    .catch(() => undefined)
    .finally(() => {
      engine?.applyStrengthOptions({ multiPv: 1 });
    });
}

/** 直前のプレイヤー着手について、好手・詰めろ・駒得・形勢の転換点を判定する。 */
async function playerMovePraise(options: {
  historyLength: number;
  flair?: NonNullable<typeof playerMoveFlair>;
  beforeScore?: EngineEvaluation;
  afterScore?: EngineEvaluation;
  fallback: { key: string; text: string } | null;
  cpuCandidates: Array<{ rank: number; score?: EngineEvaluation }>;
  generation: number;
}) {
  const {
    historyLength, flair, beforeScore, afterScore, fallback, cpuCandidates, generation,
  } = options;
  const turning = advanceTurningPoints(turningPointState, {
    ply: historyLength,
    afterScore,
    beforeScore,
  });
  turningPointState = turning.state;
  if (coachLevel.value === "off") return null;
  const baseline = playerMoveBaseline?.historyLength === historyLength - 1
    ? playerMoveBaseline
    : undefined;
  playerMoveBaseline = undefined;
  const detailed = coachLevel.value === "detailed";
  const quality = detailed && flair && baseline && !flair.fromHint && !flair.trivial
    ? classifyMoveQuality({
        move: flair.usi,
        deepCandidates: baseline.deep,
        shallowCandidates: baseline.shallow,
        sacrifice: flair.sacrifice,
        obvious: flair.obvious,
      })
    : null;
  const cpuMatePly = parseMateScore(cpuCandidates.find(({ rank }) => rank === 1));
  // CPU本体の探索結果を流用し、追加探索なしで詰めろを受けきったか判定する。
  const defendedMateThreat = Boolean(
    detailed && baseline?.mateThreat && !(cpuMatePly && cpuMatePly <= 7),
  );
  const praiseOptions = {
    level: coachLevel.value,
    historyLength,
    beforeScore,
    afterScore,
    quality,
    defendedMateThreat,
    materialGain: flair?.materialGain ?? 0,
    turningAdvice: turning.advice,
    fallback,
  };
  let gaveMateThreat = false;
  if (movePraiseNeedsMateThreatCheck(praiseOptions)) {
    const threatSfen = flipSideToMove(currentSfen.value);
    if (threatSfen && engine && engineReady.value) {
      const settings = getMateCheckSearchSettings(
        props.mobile || boardLayout.value === "portrait",
      );
      cpuSearchRunning = true;
      cpuSearchGeneration = generation;
      try {
        const result = await engineMateCheck(threatSfen, { ...settings, maxPly: 7 });
        gaveMateThreat = result.status === "mate";
      } finally {
        if (cpuSearchGeneration === generation) cpuSearchRunning = false;
      }
    }
  }
  return getMovePraise({
    ...praiseOptions,
    gaveMateThreat,
  });
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
    const preview = createGameRecord(matchInitialSfen.value);
    for (const move of moveHistory) appendUsiMove(preview, move);
    return appendUsiMove(preview, usi) && isSideToMoveInCheck(preview.position.sfen);
  } catch {
    return false;
  }
}

/**
 * CPUの着手を描画したあと、プレイヤーの手番に行う補助を、エンジンの待ち行列へ積む。
 * hadScore: CPUの選んだ手の評価値があり、形勢の助言をすでに出したか。
 *   Lv0〜10(ロジックAI)や、わざと候補外の手を選んだときは評価値がないため、読み直して形勢の助言を出す。
 */
function schedulePostCpuAssists(hadScore = false) {
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
      if (coachLevel.value === "detailed" || (coachLevel.value !== "off" && !hadScore)) {
        scheduleDedicatedCoachAdvice(null, { riskOnly: hadScore });
      }
      scheduleMoveJudgeBaseline();
      schedulePlayerMoveBaseline();
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

/** 効果音のオン/オフ。教室・問題集も同じ保存(SOUND_ENABLED_KEY)に従う。 */
const soundEnabled = ref(loadSoundEnabled(browserStorage()));
function toggleSound() {
  soundEnabled.value = !soundEnabled.value;
  saveSoundEnabled(browserStorage(), soundEnabled.value);
}
const moveSounds = createMoveSoundPlayer(() => props.assetBaseUrl, { enabled: () => soundEnabled.value });

/*
 * 止め(ヒットストップ)と盤の光り(core/move-impact.mjsの段階)。
 * 止めるのは「次に起きること」(CPUの応手を盤に出す、結果画面を出す)の開始だけで、プレイヤーの入力は止めない。
 * 止めの間に盤を触ったら、止めを打ち切る。
 */
let impactHoldUntil = 0;
let impactHoldRelease: (() => void) | null = null;
function holdForImpact(stage: number) {
  const ms = impactStopMs(stage);
  if (ms > 0) impactHoldUntil = Math.max(impactHoldUntil, performance.now() + ms);
}
function waitForImpactHold(): Promise<void> {
  const wait = impactHoldUntil - performance.now();
  if (wait <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(done, wait);
    function done() {
      clearTimeout(timer);
      impactHoldRelease = null;
      impactHoldUntil = 0;
      resolve();
    }
    impactHoldRelease = done;
  });
}
/** 神の一手と詰みで、盤の縁を光らせる(升の色は変えない)。 */
const BOARD_IMPACT_MS = 900;
const boardImpact = ref<{ id: number; stage: number } | null>(null);
let boardImpactTimer: ReturnType<typeof setTimeout> | undefined;
function showBoardImpact(stage: number) {
  if (stage < IMPACT_STAGE.GOD) return;
  boardImpact.value = { id: Date.now(), stage };
  clearTimeout(boardImpactTimer);
  boardImpactTimer = setTimeout(() => { boardImpact.value = null; }, BOARD_IMPACT_MS);
}
/** 詰みのあと、止めてから結果画面を出す。 */
let resultRevealTimer: ReturnType<typeof setTimeout> | undefined;
let resultRevealSound: "win" | "lose" | null = null;
function revealResult() {
  clearTimeout(resultRevealTimer);
  resultRevealTimer = undefined;
  if (resultRevealSound) moveSounds.play(resultRevealSound);
  resultRevealSound = null;
  resultDialogOpen.value = true;
}
/** 止めと、結果画面を出す予約を取り消す。新しい対局を始めるとき・対局準備へ戻るときに呼ぶ。 */
function cancelResultReveal() {
  clearTimeout(resultRevealTimer);
  resultRevealTimer = undefined;
  resultRevealSound = null;
  impactHoldUntil = 0;
  impactHoldRelease?.();
}
/** 止めの間に盤を触ったら、止めを打ち切る。 */
function releaseImpactHold() {
  impactHoldUntil = 0;
  impactHoldRelease?.();
  if (resultRevealTimer) revealResult();
}
onBeforeUnmount(() => {
  clearTimeout(boardImpactTimer);
  clearTimeout(resultRevealTimer);
});

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
      const threatSfen = coachLevel.value === "detailed" && isPlayerTurn && !inCheck
        ? flipSideToMove(currentSfen.value)
        : null;
      const mateThreatResult = threatSfen
        ? await engineMateCheck(threatSfen, {
            ...getMateCheckSearchSettings(props.mobile || boardLayout.value === "portrait"),
            maxPly: 7,
          })
        : null;
      if (generation !== reviewCoachGeneration || !reviewMode.value) return;
      const mateThreat = mateThreatResult?.status === "mate";
      const bestMove = candidates.find((candidate) => candidate.rank === 1)?.move;
      const riskAdvice = coachLevel.value === "detailed" && isPlayerTurn
        ? getCandidateRiskAdvice(normalizedCandidates, {
            inCheck,
            mateThreat,
            mateThreatChecked: mateThreatResult !== null && mateThreatResult.status !== "unknown",
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

/*
 * 解析が終わった本筋で、勝負の決め手と敗着の手に来たら、やこび姫がひとこと言う。
 * 決め手と敗着は、終局の勝者と解析した評価値の推移から決める。
 */
/** 解析を終えた、CPUとの対局での棋力診断。対人と、解析中・未解析では出さない。 */
const skillDiagnosis = computed(() => {
  if (!reviewMode.value || reviewCpuEnabled.value || analysisRunning.value || analyzedLevel.value < 0) return null;
  if (normalizedMode.value !== "cpu" || !analysisPoints.value.length) return null;
  return estimateSkill(analysisPoints.value, humanColor.value === Color.WHITE ? "white" : "black");
});
const measureStats = computed(() => (
  measureSession.value && skillDiagnosis.value && !skillDiagnosis.value.insufficient
    ? measureStatistics(analysisPoints.value, humanColor.value === Color.WHITE ? "white" : "black")
    : null
));
const measureReportOpen = computed(() => (
  measureSession.value && !measureReportDismissed.value && Boolean(skillDiagnosis.value)
));
function applySkillDiagnosis() {
  const diagnosis = skillDiagnosis.value;
  if (!diagnosis || diagnosis.insufficient || diagnosis.rating === undefined) return;
  ratingState.value = applyMeasuredRating(ratingState.value, { rating: diagnosis.rating, label: diagnosis.label });
  saveRatingState(browserStorage(), ratingState.value);
}

const turningPoints = computed(() => {
  const winner = result.value?.winner;
  if (analysisRunning.value || !winner) return { decisive: null, losing: null };
  return findTurningPoints(analysisPoints.value, winner === Color.BLACK ? "black" : "white");
});
function turningPointAdvice(): string {
  if (!isOnReviewMainLine(reviewNavigation.value)) return "";
  const ply = reviewNavigation.value.cursor;
  const kind = ply === turningPoints.value.decisive ? "decisive" : ply === turningPoints.value.losing ? "losing" : "";
  if (!kind) return "";
  const winner = result.value?.winner;
  const playerWon = normalizedMode.value === "cpu" && winner ? winner === humanColor.value : null;
  return turningPointText(kind, { playerWon });
}

function showRecordedCoachAdvice(): boolean {
  if (!reviewMode.value || coachLevel.value === "off") return false;
  const turning = turningPointAdvice();
  if (turning) {
    guideText.value = turning;
    return true;
  }
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

/** 平手の通常対局(対CPU)だけをレーティングに数える。学習対局・駒落ち・教室の対局は数えない。 */
function recordRatedGame(matchResult: MatchResult) {
  ratingChange.value = null;
  const level = cpuStrengthLevel();
  const rated = matchKind.value === "normal"
    && normalizedMode.value === "cpu"
    && !tutorialMatch.value
    && matchInitialSfen.value === STANDARD_SFEN
    && level !== undefined;
  if (!rated) return;
  const outcome = !matchResult.winner ? "draw" : matchResult.winner === humanColor.value ? "win" : "loss";
  // やこびノートの統計用に、プレイヤーの手番と、終局時点の戦型・戦法・囲いを控える。
  const color = humanColor.value === Color.WHITE ? "white" : "black";
  const own = formationState.value[color];
  const other = formationState.value[color === "white" ? "black" : "white"];
  const applied = applyRatedGame(ratingState.value, {
    opponentLevel: level,
    outcome,
    color,
    profile: {
      battle: formationState.value.battle,
      rook: own.rook,
      castle: own.castle,
      opponentRook: other.rook,
      opponentCastle: other.castle,
    },
  });
  ratingState.value = applied.state;
  ratingChange.value = { before: applied.before, after: applied.after, delta: applied.delta };
  saveRatingState(browserStorage(), applied.state);
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
  // 詰みで決まったときは、止めてから結果画面を出す。勝ちは長く、負けは短く(core/move-impact.mjs)。
  const outcome = !matchResult.winner
    ? "draw"
    : normalizedMode.value === "local" ? "none" : matchResult.winner === humanColor.value ? "win" : "loss";
  const finishing = finishImpact({ reason: matchResult.reason, outcome });
  cancelResultReveal();
  resultRevealSound = finishing.sound;
  if (finishing.stopMs > 0) {
    if (outcome !== "loss") showBoardImpact(IMPACT_STAGE.FINISH);
    resultRevealTimer = setTimeout(revealResult, finishing.stopMs);
  } else {
    revealResult();
  }
  recordRatedGame(matchResult);
  recordCollection(outcome === "win");
  recordRyuoOutcome(matchResult);
  const measuring = measureMode.value && matchKind.value === "normal" && normalizedMode.value === "cpu" && !tutorialMatch.value;
  measureMode.value = false;
  measureSession.value = measuring;
  measureReportDismissed.value = false;
  if (tutorialMatch.value) {
    const { lessonId, playerColor } = tutorialMatch.value;
    tutorialMatch.value = { lessonId, playerColor, report: tutorialMatchReport(matchResult, lessonId, playerColor) };
  }
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
  // 棋力測定の対局は、続けて棋譜解析を始め、解析のあとに棋力を診断する。
  if (measuring) {
    measureAnalyzing.value = true;
    void startKifuAnalysis().finally(() => { measureAnalyzing.value = false; });
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
  const legalMoveCountBefore = actor === "player" && !reviewMode.value
    ? enumerateLegalMoves(record.value.position.clone()).length
    : 0;
  // 神の一手の判定で、捨て駒を見つけにくさとして加点し、駒を取る・逃げるといった当たり前の手を除く。
  const contextBefore = actor === "player" && !reviewMode.value && coachLevel.value === "detailed"
    ? moveContext(currentSfen.value, usi, moveHistory.at(-1) ?? "")
    : null;
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
  if (actor === "cpu") {
    lastCpuCapture = move.capturedPieceType
      ? { historyLength: moveHistory.length, pieceType: move.capturedPieceType }
      : undefined;
  }
  if (actor === "player") {
    const enemyCamp = move.color === Color.BLACK ? move.to.rank <= 3 : move.to.rank >= 7;
    const previousMove = moveHistory.at(-2) ?? "";
    // USIの3・4文字目が移動先（駒打ちも同じ位置）。
    const recapture = Boolean(move.capturedPieceType) && previousMove.slice(2, 4) === move.to.usi;
    const destinationAttacked = Boolean(move.capturedPieceType) && enumerateLegalMoves(record.value.position.clone())
      .some(({ to }) => to.usi === move.to.usi);
    playerMoveFlair = {
      historyLength: moveHistory.length,
      usi,
      wasPromotion: move.promote,
      wasEnemyCampDrop: usi.includes("*") && enemyCamp,
      fromHint: Boolean(reusedHint),
      // 取り返しや合法手がほぼ無い局面の最善手は、褒めるほどの選択ではない。
      trivial: recapture || (legalMoveCountBefore > 0 && legalMoveCountBefore <= 2),
      sacrifice: contextBefore?.sacrifice ?? false,
      obvious: contextBefore?.obvious ?? false,
      materialGain: move.capturedPieceType
        ? materialGain({
            capturedPieceType: move.capturedPieceType,
            moverPieceType: move.promote ? promotedPieceType(move.pieceType) : move.pieceType,
            destinationAttacked,
            opponentPreviousCapture: lastCpuCapture?.historyLength === moveHistory.length - 1
              ? lastCpuCapture.pieceType
              : undefined,
          })
        : 0,
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
  const terminalResult = resultAfterMove(record.value);
  // 棋譜検討中の分岐や「ここから対CPU」でも、実際に指した手には駒音を鳴らす。
  const givesCheck = isSideToMoveInCheck(currentSfen.value);
  const impact = moveImpact({
    capturedPieceType: move.capturedPieceType ?? null,
    promote: move.promote,
    drop: usi.includes("*"),
    check: givesCheck,
    checkmate: terminalResult?.reason === "checkmate",
  });
  moveSounds.play(selectMoveSound(
    move.capturedPieceType,
    terminalResult?.reason === "checkmate" || givesCheck,
    { promote: move.promote, drop: usi.includes("*") },
  ));
  // プレイヤーの王手・大駒を取る手は、CPUの応手を出す前に一瞬止める。
  if (actor === "player" && !reviewMode.value) holdForImpact(impact.stage);
  if (!reviewMode.value) {
    emit("match-move", { usi, actor, moveCount: moveCount.value, sfen: currentSfen.value });
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
    hintText.value = `最善手は${formatSpokenMove(moves[0].move, currentSfen.value)}だよ！`;
    if (!reviewMode.value) hintsRemaining.value -= 1;
  } catch (error) {
    hintText.value = `ヒントを出せませんでした: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    engine?.applyStrengthOptions({ multiPv: 1 });
    thinking.value = false;
  }
}

function rebuildRecord(moves: string[]) {
  const { nextRecord, nextFormationState } = recordAndFormationsFromMoves(
    matchInitialSfen.value,
    moves,
    hiraganaFormationMaster,
  );
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
  playerMoveBaseline = undefined;
  playerMoveBaselineGeneration += 1;
  lastCpuCapture = undefined;
  turningPointState = rewindTurningPointState(turningPointState, moveHistory.length);
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
    schedulePlayerMoveBaseline();
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
  // 分岐の局面には、本筋の解析の表記を使わない。
  const from = reviewBranchFrom.value;
  if (from !== null && ply > from) return `${ply}手目（分岐）`;
  const point = analysisPoints.value.find((candidate) => candidate.ply === ply);
  return point?.label ?? (ply === 0 ? "開始局面" : `${ply}手目`);
}

/*
 * 振り返りの今の局面の最善手と読み筋。本筋で解析済みなら棋譜解析の結果を使い、
 * 分岐などの解析していない局面は、その場で読む。読み筋は「読み筋を並べる」で使えるよう覚えておく。
 */
const reviewLine = ref<{ sfen: string; pv: string[] } | null>(null);
/** 振り返りの探索は、助言の探索と同じ順番待ちに並べ、同じエンジンで探索を重ねない。 */
function enqueueReviewSearch<T>(task: () => Promise<T>): Promise<T> {
  const run = Promise.all([
    reviewCoachQueue.catch(() => undefined),
    dedicatedCoachQueue.catch(() => undefined),
  ]).then(task);
  reviewCoachQueue = run.then(() => undefined, () => undefined);
  return run;
}
async function reviewPositionLine(): Promise<{ bestMove: string; pv: string[] } | null> {
  const point = analysisCurrentPoint.value;
  if (point?.bestMove) return { bestMove: point.bestMove, pv: point.pv?.length ? point.pv : [point.bestMove] };
  if (!canAnalyzeReviewPosition.value || !engine) return null;
  const sfen = currentSfen.value;
  thinking.value = true;
  hintText.value = "やこび姫がこの局面を読んでいるよ…";
  try {
    const budget = positionAnalysisBudget(props.mobile || boardLayout.value === "portrait");
    const candidates = await enqueueReviewSearch(() => (
      currentSfen.value === sfen ? analyzeCoachPosition(budget.nodes, budget.maxTimeMs, 1) : Promise.resolve([])
    ));
    if (currentSfen.value !== sfen) return null;
    const best = candidates.find(({ rank }) => rank === 1);
    if (!best?.move) {
      hintText.value = "この局面はうまく読めなかったよ。";
      return null;
    }
    return { bestMove: best.move, pv: best.pv?.length ? best.pv : [best.move] };
  } catch (error) {
    hintText.value = `この局面を読めませんでした: ${error instanceof Error ? error.message : String(error)}`;
    return null;
  } finally {
    engine?.applyStrengthOptions({ multiPv: 1 });
    thinking.value = false;
  }
}

async function showAnalysisLine() {
  const line = await reviewPositionLine();
  if (!line) return;
  reviewLine.value = { sfen: currentSfen.value, pv: line.pv };
  let labels = line.pv.slice(0, 6).join(" → ");
  try {
    labels = formatPrincipalVariation(line.pv, currentSfen.value, 6);
  } catch { /* 表記できない手はUSIのまま出す */ }
  hintText.value = `読み筋: ${labels}（その他の「読み筋を盤に並べる」で並べられるよ）`;
}

/** 直前に出した読み筋(読み・投了の理由)を、今の局面から分岐として並べる。▶で1手ずつ進められる。 */
function placeReviewLine() {
  const line = reviewLine.value;
  if (reviewCpuEnabled.value || !line || line.sfen !== currentSfen.value || !line.pv.length) return;
  coachAdviceScheduler.reset();
  reviewNavigation.value = previewReviewLine(reviewNavigation.value, line.pv);
  rebuildRecord(visibleReviewMoves(reviewNavigation.value));
  hintCandidates.value = [];
  hintText.value = "読み筋を盤に並べたよ。▶で1手ずつ進めてみてね。";
  refreshReviewCoachAdvice();
}
const canPlaceReviewLine = computed(() => (
  !reviewCpuEnabled.value && Boolean(reviewLine.value?.pv.length) && reviewLine.value?.sfen === currentSfen.value
));

/*
 * 投了の理由。投了で終わった対局の最終局面を開いたら、投了図を深く読んで、詰み筋や形勢の差を話す。
 * 1局につき1回だけ読み、読み筋は「読み筋を並べる」で並べられる。
 */
const resignationExplanation = ref<ReturnType<typeof explainResignation> | null>(null);
let resignationRequested = false;
watch(result, () => {
  resignationExplanation.value = null;
  resignationRequested = false;
});
const atResignedPosition = computed(() => (
  reviewMode.value && result.value?.reason === "resignation" && !reviewCpuEnabled.value
  && isOnReviewMainLine(reviewNavigation.value)
  && reviewNavigation.value.cursor === reviewNavigation.value.mainLine.length
));
function showResignationExplanation() {
  const explanation = resignationExplanation.value;
  if (!explanation || !atResignedPosition.value) return;
  reviewLine.value = { sfen: currentSfen.value, pv: explanation.pv };
  hintText.value = explanation.pvLabel
    ? `${explanation.text} 読み筋: ${explanation.pvLabel}`
    : explanation.text;
}
function explainReviewResignation() {
  const finished = result.value;
  if (!atResignedPosition.value || !finished?.winner || !engine || !engineReady.value) return;
  // 棋譜解析は始めるときに探索を止めるので、途中で止められた浅い読みで説明しないよう、解析の後に読む。
  if (analysisRunning.value) return;
  if (resignationExplanation.value) {
    showResignationExplanation();
    return;
  }
  if (resignationRequested) return;
  resignationRequested = true;
  const sfen = currentSfen.value;
  const loser = finished.winner === Color.BLACK ? "white" : "black";
  enqueueReviewSearch(async () => {
    if (!atResignedPosition.value || currentSfen.value !== sfen || analysisRunning.value) {
      resignationRequested = false;
      return;
    }
    const settings = resignationSearchSettings(props.mobile || boardLayout.value === "portrait");
    const candidates = await analyzeCoachPosition(settings.nodes, settings.maxTimeMs, settings.multiPv);
    if (!candidates.length) {
      resignationRequested = false;
      return;
    }
    resignationExplanation.value = explainResignation({ sfen, candidates, loser });
    showResignationExplanation();
  })
  .catch(() => { resignationRequested = false; })
  .finally(() => engine?.applyStrengthOptions({ multiPv: 1 }));
}
watch([atResignedPosition, analysisRunning], ([atResigned, running]) => {
  if (atResigned && !running) explainReviewResignation();
});

function navigateAnalysis(delta: number) {
  if (reviewCpuEnabled.value) return;
  reviewNavigation.value = moveReviewCursor(reviewNavigation.value, delta);
  rebuildRecord(visibleReviewMoves(reviewNavigation.value));
  hintCandidates.value = [];
  hintText.value = "";
  refreshReviewCoachAdvice();
}

function returnToMainLine() {
  // 感想戦中に本筋へ戻るときは、感想戦をやめてから戻る。
  if (reviewCpuEnabled.value) stopReviewCpu();
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
  const assistSearchInterrupted = !reviewMode.value && assistSearchControl.interrupt();
  if (assistSearchInterrupted) engine?.stop();
  if (reviewMode.value) {
    reviewNavigation.value = appendReviewMove(reviewNavigation.value, usi);
    if (guidedReview.value) {
      // 振り返り中は、問題の答え合わせだけをする。問題以外で指したら一時停止する。
      if (guidedReview.value.phase === "quiz") checkGuidedReviewMove(usi);
      else if (guidedReview.value.phase === "playing") toggleGuidedReviewPause();
      return;
    }
    if (reviewCpuEnabled.value) {
      scheduleReviewCpuMove();
    } else {
      scheduleReviewCoachAdvice();
    }
  } else {
    scheduleCpuMove();
  }
}

/*
 * 感想戦。検討中に盤で指した手に、対局相手のCPUが対局と同じ強さで応える。
 * 押した時点で相手の手番なら、すぐに相手が指す。待ったは感想戦を始めた局面まで何度でも使える。
 */
const canStartKansousen = computed(() => (
  reviewMode.value && engineReady.value && !analysisRunning.value && !guidedReview.value
));
function toggleKansousen() {
  if (reviewCpuEnabled.value) stopReviewCpu();
  else void startReviewCpu();
}

async function startReviewCpu() {
  if (!canStartKansousen.value || reviewCpuEnabled.value) return;
  coachAdviceScheduler.reset();
  // 助言の探索を止め、エンジンが空いてから相手に指させる。
  reviewCoachGeneration += 1;
  engine?.stop();
  await reviewCoachQueue.catch(() => undefined);
  if (!canStartKansousen.value || reviewCpuEnabled.value) return;
  thinking.value = false;
  reviewCpuGeneration += 1;
  reviewCpuStartedAtPly.value = moveHistory.length;
  reviewCpuEnabled.value = true;
  analysisMenuOpen.value = false;
  hintCandidates.value = [];
  hintText.value = "";
  const cpuTurn = record.value.position.color !== humanColor.value;
  guideText.value = coachLevel.value === "off"
    ? ""
    : cpuTurn
      ? `感想戦を始めるよ。${props.cpuPlayerName}ならどう指すかな？`
      : `感想戦を始めるよ。指してみてね、${props.cpuPlayerName}ならどう応えるか見せるよ！`;
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
  guideText.value = coachLevel.value === "off" ? "" : "感想戦を終えたよ。";
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
      // Lv1〜10は、感想戦でもロジックAIで応じる(エンジンは使わない)。
      const logicLevel = usesLogicAi(cpuStrengthPreset.value.level);
      let search;
      let verify;
      let probe;
      if (!logicLevel && !usesNaturalMoveOnly(searchNodes.value) && engine && engineReady.value) {
        const enginePosition = currentEnginePosition();
        engine.applyStrengthOptions({ multiPv: strength.multiPv });
        await engine.setSearchThreads(strength.searchThreads);
        engine.setPosition(enginePosition);
        startCpuGauge(strength.nodes);
        search = await engine.go({
          nodes: strength.nodes,
          maxTimeMs: 8000,
          onNodes: updateCpuGauge,
        });
        finishCpuGauge();
        if (generation !== reviewCpuGeneration || !reviewCpuEnabled.value) return;
        verify = cpuOversightVerifier(
          enginePosition,
          () => generation === reviewCpuGeneration && reviewCpuEnabled.value,
        );
        probe = cpuRiskProbe(
          enginePosition,
          () => generation === reviewCpuGeneration && reviewCpuEnabled.value,
        );
      }
      const choice = logicLevel
        ? chooseLogicMove({ sfen: record.value.position.sfen, legalMoves, level: cpuStrengthPreset.value.level, moveHistory })
        : await chooseCpuMove({
          strength,
          sfen: record.value.position.sfen,
          legalMoves,
          moveHistory,
          search,
          verify,
          probe,
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
        guideText.value = coachLevel.value === "off" ? "" : `${props.cpuPlayerName}ならこう指すよ。次はあなたの番！`;
      }
    } catch (error) {
      if (generation !== reviewCpuGeneration) return;
      const message = error instanceof Error ? error.message : String(error);
      errorMessage.value = `感想戦の思考に失敗しました: ${message}`;
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
      // 悪手判定は、着手の前後を同じ深さで読んで比べる。この読みは、相手の思考時間として、CPUの探索の前に行う。
      // 悪手・かち込みは、相手が考えている間に伝える。
      // プレイヤーが指した直後だけ読む(CPUが先手の初手や、リロードで再開したCPUの手番では読まない)。
      let judged: { before: EngineEvaluation; after: EngineEvaluation } | null = null;
      let shownFeedbackKey = "";
      if (moveFlair) {
        cpuSearchRunning = true;
        cpuSearchGeneration = generation;
        try {
          judged = await judgePlayerMove(() => generation === matchGeneration);
        } catch {
          judged = null;
        } finally {
          if (cpuSearchGeneration === generation) cpuSearchRunning = false;
        }
        if (generation !== matchGeneration) return;
        if (judged) {
          moveFeedback = getMoveFeedback({
            level: coachLevel.value,
            beforeScore: judged.before,
            afterScore: judged.after,
            wasPromotion: moveFlair.wasPromotion,
            wasEnemyCampDrop: moveFlair.wasEnemyCampDrop,
          });
          if (moveFeedback) {
            showCoachAdvice(moveFeedback);
            shownFeedbackKey = moveFeedback.key;
          }
        }
      }
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
      // 竜王戦の相手は、棋風と、この場面で働く特徴を強さ設定に反映する(探索の前は探索量、探索のあとは手の選び方)。
      const baseStrength = getStrengthSearchSettings(searchNodes.value);
      const cpuCharacter = ryuoGame.value ? ryuoOpponent.value?.character ?? null : null;
      const cpuSituation = cpuCharacter
        ? characterSituation({ sfen: record.value.position.sfen, ply: moveHistory.length })
        : null;
      const characterStrength = (advantage?: number) => (cpuCharacter && cpuSituation
        ? applyCharacter(baseStrength, cpuCharacter, { ...cpuSituation, advantage }, { skill: cpuStrengthPreset.value.skill })
        : baseStrength);
      const strength = characterStrength();
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
        cpuSearchRunning = true;
        cpuSearchGeneration = generation;
        // Lv40だけ2スレッドで読む。ほかのレベルは校正どおり1スレッドに戻す。
        await engine.setSearchThreads(strength.searchThreads);
        // setPositionが「position sfen」を付けるため、SFENだけを渡す。
        const enginePosition = currentEnginePosition();
        engine.setPosition(enginePosition);
        startCpuGauge(strength.nodes);
        const search = await engine.go({
          nodes: strength.nodes,
          maxTimeMs: 60000,
          searchMoves: [...allowedCpuMoveIds],
          onNodes: updateCpuGauge,
        });
        finishCpuGauge();
        if (cpuSearchGeneration === generation) cpuSearchRunning = false;
        if (generation !== matchGeneration) return;
        const bestCpuScore = search.candidates.find((candidate) => candidate.rank === 1)?.score;
        // 形勢で働く特徴(劣勢でも崩れない・優勢で緩む)は、探索の評価値(CPUの手番から見た値)で決める。
        const selectionStrength = characterStrength(comparableScore(bestCpuScore));
        // 閃き候補を指した場合は、深さの違う再探索と混ぜず同じ探索内で比較する。
        const playerAfterScore = reusedHintAssessment?.afterScore ?? scoreForPlayer(
          bestCpuScore,
          record.value.position.color,
          humanColor.value,
        );
        // 悪手判定の読みができなかったときだけ、CPU本体の探索の評価値で比べる。
        if (!judged) {
          moveFeedback = getMoveFeedback({
            level: coachLevel.value,
            beforeScore: comparableBeforeScore,
            afterScore: playerAfterScore,
            wasPromotion: moveFlair?.wasPromotion,
            wasEnemyCampDrop: moveFlair?.wasEnemyCampDrop,
          });
        }
        // 悪手の指摘を最優先し、それ以外では好手や形勢の転換点を褒める。
        const mistake = moveFeedback && /move-(blunder|mistake)/.test(moveFeedback.key);
        const praise = await playerMovePraise({
          historyLength: playerMoveHistoryLength,
          flair: moveFlair,
          beforeScore: judged?.before ?? comparableBeforeScore,
          afterScore: judged?.after ?? playerAfterScore,
          fallback: moveFeedback,
          cpuCandidates: search.candidates,
          generation,
        });
        if (!mistake) moveFeedback = praise;
      // この評価は、CPU着手ではなく直前のプレイヤー着手に対するもの。
      // CPUの駒を動かす前に表示を確定し、相手の手への反応に見えないようにする。
        if (moveFeedback && moveFeedback.key !== shownFeedbackKey) {
          showCoachAdvice(moveFeedback);
          // ほめ言葉は、何が良かったかを読めるよう、CPUの応手を出す前に止める。神の一手は盤も光らせる。
          const praiseStage = praiseImpactStage(moveFeedback.key);
          holdForImpact(praiseStage);
          showBoardImpact(praiseStage);
          if (praiseStage === IMPACT_STAGE.GOD) {
            moveSounds.play("god");
            matchGodMoves += 1;
          }
          await nextTick();
          if (generation !== matchGeneration) return;
        }
        // MultiPVの候補数は合法手より少ないため、作戦の定跡手が候補に入っていない
        // 局面でも専用探索で評価してから、AI最善手との比較を行う。
        let searchedCandidates = search.candidates;
        // Lv1〜10はロジックAIで指す。上の探索は、直前のプレイヤーの手への助言にだけ使う。
        const logicLevel = usesLogicAi(cpuStrengthPreset.value.level);
        if (
          !logicLevel
          && allowedOpeningMove && !forceConfiguredOpening
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
        // 低レベルほど倍率を大きくし、多少評価が下がっても決めた作戦の形を作り続ける。
        const planScoreLimit = Math.min(
          openingGuideScoreLossLimit(cpuOpeningPlan?.strategyId ?? "", openingMovePhase)
            * strength.openingPlanScoreScale,
          strength.maxScoreLoss,
        );
        const safeOpening = allowedOpeningMove && !forceConfiguredOpening && !logicLevel
          ? chooseSafeOpeningMove(allowedOpeningMove, searchedCandidates, planScoreLimit)
          : null;
        const selection = forceConfiguredOpening && allowedOpeningMove
          ? { move: allowedOpeningMove }
          : logicLevel
          ? chooseLogicMove({
            sfen: record.value.position.sfen,
            legalMoves: allowedCpuMoveList,
            level: cpuStrengthPreset.value.level,
            moveHistory,
            planMove: allowedOpeningMove ?? null,
          })
          : safeOpening
          ? {
            move: safeOpening.usi,
            rank: searchedCandidates.find(({ move }) => move === safeOpening.usi)?.rank ?? 1,
            }
          : await chooseCpuMove({
            strength: selectionStrength,
            sfen: record.value.position.sfen,
            legalMoves: allowedCpuMoveList,
            moveHistory,
            search,
            blunderAllowed: canBlunder(selectionStrength, cpuBlunderPlies, moveHistory.length),
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
            probe: async (moves: string[], options: { nodes: number, multiPv: number }) => {
              cpuSearchRunning = true;
              cpuSearchGeneration = generation;
              try {
                return await cpuRiskProbe(enginePosition, () => generation === matchGeneration)(moves, options);
              } finally {
                if (cpuSearchGeneration === generation) cpuSearchRunning = false;
              }
            },
          });
        if (generation !== matchGeneration) return;
        usi = selection?.move ?? "";
        if (cpuCharacter && usi) {
          const kind = (selection as { kind?: string } | null)?.kind ?? "opening";
          ryuoCpuMoves = [...ryuoCpuMoves.filter(({ ply }) => ply < moveHistory.length), {
            ply: moveHistory.length, kind, traits: selectionStrength.activeTraits ?? [],
          }];
        }
        if (isBlunderChoice(selection)) {
          cpuBlunderPlies = [...cpuBlunderPlies.filter((ply) => ply < moveHistory.length), moveHistory.length];
        }
        selectedCpuScore = searchedCandidates.find(
          (candidate) => candidate.move === usi,
        )?.score;
      } else {
        // エンジンが利用できない簡易CPUでは評価比較ができないため、合法な定跡手を優先する。
        // Lv1〜10は、エンジンがなくてもロジックAIで指せる。
        usi = usesLogicAi(cpuStrengthPreset.value.level)
          ? chooseLogicMove({
            sfen: record.value.position.sfen,
            legalMoves: allowedCpuMoveList,
            level: cpuStrengthPreset.value.level,
            moveHistory,
            planMove: allowedOpeningMove ?? null,
          })?.move ?? ""
          : allowedOpeningMove ?? await naturalCpuMove();
      }
      if (generation !== matchGeneration) return;
      if (!usi) {
        thinking.value = false;
        const terminalResult = resultAfterMove(record.value);
        if (terminalResult) finish(terminalResult);
        return;
      }
      await waitForImpactHold();
      if (generation !== matchGeneration) return;
      if (applyMove(usi, "cpu") && active.value) {
        updateCoachAdvice(selectedCpuScore);
        thinking.value = false;
        schedulePostCpuAssists(selectedCpuScore !== undefined);
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

// 図鑑の棋譜解析（force）では、対局の形式によらずエンジンを起動する。
async function initializeEngine({ force = false } = {}) {
  if ((!force && normalizedMode.value !== "cpu" && !reviewMode.value) || engineReady.value) return;
  if (enginePromise) return enginePromise;
  enginePromise = (async () => {
   try {
    engine = new ShogiEngine({ factory: await ensureEngineFactory() });
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

const dexAnalysisEngine = useDexAnalysisEngine({
  mainEngine: async () => {
    await initializeEngine({ force: true });
    if (!engine || !engineReady.value) throw new Error("将棋AIを起動できませんでした。");
    return engine;
  },
  waitForCoachSearches: () => Promise.all([
    dedicatedCoachQueue.catch(() => undefined),
    reviewCoachQueue.catch(() => undefined),
  ]),
  engineFactory: () => engineFactory,
  compact: () => props.mobile || boardLayout.value === "portrait",
});

function resign() {
  if (active.value && !reviewMode.value) finish(resignationResult(record.value));
}

function completeReview() {
  if (!reviewMode.value) return;
  // 教室の対局を振り返ったあとは、教室の結果画面へ戻る。
  if (tutorialMatch.value?.report) {
    returnToTutorial();
    return;
  }
  leaveFinishedMatch();
}

/** 終わった対局から離れる。ホーム画面がある表示ならホームへ、なければ対局準備へ戻る。保存はどちらも消す。 */
function leaveFinishedMatch({ toHome = false }: { toHome?: boolean } = {}) {
  // 竜王戦の対局は、対局や検討を終えたら、ホームではなく竜王戦の画面(トーナメント表)へ戻る。
  const backToTournament = !toHome && props.showHome && Boolean(ryuoGame.value);
  stopGuidedReview();
  openPregame();
  if (props.showHome) openHome();
  if (backToTournament) {
    tournamentStartAt.value = "season";
    tournamentOpen.value = true;
  }
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

// 棋譜解析の間だけ追加する、局面を並行して読むエンジン。
let analysisEngines: ShogiEngine[] = [];
function releaseAnalysisEngines() {
  releaseEngines(analysisEngines);
  analysisEngines = [];
}

async function runKifuAnalysis() {
  if (!engine || !engineReady.value || analysisRunning.value || reviewCpuEnabled.value) return;
  const generation = ++analysisGeneration;
  analysisRunning.value = true;
  analysisProgress.value = 0;
  analysisStage.value = "";
  analysisTotal.value = reviewNavigation.value.mainLine.length + 1;
  analysisOpen.value = true;
  const level = analysisLevelChoice.value;
  const resultsKey = `${matchInitialSfen.value} ${reviewNavigation.value.mainLine.join(" ")}`;
  // 同じ棋譜をもう一度解析するときは、前の読みを引き継ぎ、グラフも出したまま読み直す。
  if (gameAnalysisResults?.key !== resultsKey) {
    gameAnalysisResults = { key: resultsKey, results: [] };
    analysisPoints.value = [];
    analyzedLevel.value = -1;
  }
  const previousResults = gameAnalysisResults.results;
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
    const base = matchInitialSfen.value === STANDARD_SFEN
      ? "startpos"
      : matchInitialSfen.value;
    const replay = createGameRecord(matchInitialSfen.value);
    const steps = [{ sfen: replay.position.sfen, lastMove: "", label: "" }];
    for (const move of moves) {
      const label = (() => {
        try {
          return formatHintMove(move, replay.position.sfen);
        } catch {
          return "";
        }
      })();
      appendUsiMove(replay, move);
      steps.push({ sfen: replay.position.sfen, lastMove: move, label });
    }
    analysisTotal.value = steps.length;
    const compact = props.mobile || boardLayout.value === "portrait";
    const cancelled = () => generation !== analysisGeneration || !reviewMode.value;
    // 千日手を正しく判定できるよう、初期局面からの手順で読ませる。
    const laneFor = (laneEngine: ShogiEngine) => engineLane(laneEngine, (_sfen, ply) => movesPosition(base, moves, ply));
    analysisEngines = await createExtraEngines(engineFactory, analysisEngineCount(compact) - 1);
    if (cancelled()) return;
    let completed = false;
    await analyzeKifuStaged({
      steps,
      lanes: [engine, ...analysisEngines].map(laneFor),
      plan: kifuAnalysisPlan(level, compact),
      results: previousResults,
      isCancelled: cancelled,
      onProgress: ({ stage, done, total }) => {
        if (cancelled()) return;
        analysisStage.value = stage;
        analysisProgress.value = done;
        analysisTotal.value = total;
        completed = stage === "focus" && done === total;
      },
      onResults: (results, contexts) => {
        if (cancelled()) return;
        // 神の一手は1局で上位3手まで。外れた手は好手として残す。
        analysisPoints.value = analysisPointsFromResults(steps, results, contexts);
      },
    });
    if (generation === analysisGeneration && completed) {
      analyzedLevel.value = Math.max(analyzedLevel.value, level);
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
    if (generation === analysisGeneration) releaseAnalysisEngines();
    analysisRunning.value = false;
    thinking.value = false;
  }
}

function cancelKifuAnalysis() {
  if (!analysisRunning.value) return;
  coachAdviceScheduler.reset();
  analysisGeneration += 1;
  engine?.stop();
  releaseAnalysisEngines();
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

/*
 * 対局の振り返り。棋譜解析の結果から台本を作り、開始局面から1手ずつ自動で並べる。
 * 敗着や見逃した詰みの前では止まり、盤で手を指して考えさせる。決め手などの手では、説明してから止まる。
 * 解析がまだなら、解析を走らせて終わるのを待ってから始める。
 */
const {
  guidedReview,
  guidedRetryPly,
  guidedReviewSpeedLabel,
  cycleGuidedReviewSpeed,
  clearGuidedReviewTimer,
  startGuidedReview,
  toggleGuidedReviewPause,
  nextGuidedReviewStep,
  revealGuidedReviewAnswer,
  checkGuidedReviewMove,
  stopGuidedReview,
} = useGuidedReview({
  storage: browserStorage,
  reviewMode,
  reviewNavigation,
  analysisPoints,
  analysisOpen,
  analysisMenuOpen,
  analysisRunning,
  analyzedLevel,
  matchInitialSfen,
  currentSfen,
  hintCandidates,
  hintText,
  guideText,
  guidedMateReplyPending,
  playerColor: () => (humanColor.value === Color.WHITE ? "white" : "black"),
  winnerColor: () => {
    const winner = result.value?.winner;
    return winner === Color.BLACK ? "black" : winner === Color.WHITE ? "white" : null;
  },
  enterAnalysisMode,
  initializeEngine: () => initializeEngine(),
  runKifuAnalysis,
  rebuildRecord,
  applyMove,
  invalidateReviewCoach: () => { reviewCoachGeneration += 1; },
});

function restart() {
  matchGeneration += 1;
  cancelResultReveal();
  stopGuidedReview();
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
  skillDiagnosisVisible.value = false;
  analysisRunning.value = false;
  analysisProgress.value = 0;
  analysisTotal.value = 0;
  analysisPoints.value = [];
  analyzedLevel.value = -1;
  gameAnalysisResults = null;
  boardFlipOverride.value = false;
  reviewCoachGeneration += 1;
  reviewNavigation.value = createReviewNavigation();
  matchFormationNames.clear();
  matchGodMoves = 0;
  collectionResult.value = null;
  playerTurnScore = undefined;
  playerTurnScoreHistoryLength = -1;
  latestHintAnalysis = undefined;
  playerMoveHintAssessment = undefined;
  playerMoveFlair = undefined;
  playerMoveBaseline = undefined;
  playerMoveBaselineGeneration += 1;
  lastCpuCapture = undefined;
  turningPointState = createTurningPointState();
  cpuOpeningPlan = null;
  cpuBlunderPlies = [];
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
  hintsRemaining.value = matchHintAllowance();
  undosRemaining.value = matchUndoAllowance();
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
      matchKind.value = "normal";
      matchInitialSfen.value = props.initialSfen;
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
  // 復元中は保存済みの作戦を消さない。復元処理の中で判定できるよう同期で実行する。
  if (restoringSavedMatch) return;
  cpuOpeningPlan = null;
}, { flush: "sync" });
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
  attackGuideEnabled,
  movementArrowsEnabled,
  castleNearCompletionHandled,
  strategyNearCompletionHandled,
], persistMatchState);
watch([selectedPlayerColor, cpuDetailedStrategy], () => {
  const detailedOptions = cpuDetailedStrategyGroups.value.flatMap(({ options }) => options);
  if (cpuDetailedStrategy.value && !detailedOptions.some(({ id }) => id === cpuDetailedStrategy.value)) {
    cpuDetailedStrategy.value = detailedOptions[0]?.id ?? "ibisha";
  }
  if (isStandaloneOpening(cpuDetailedStrategy.value, "strategy")) {
    cpuDetailedCastle.value = "";
    return;
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
function preloadCoachPortraits(fileNames: string[]) {
  for (const filename of fileNames) {
    const portrait = new Image();
    portrait.src = `${props.assetBaseUrl}/characters/${filename}?v=${COACH_EXPRESSION_ASSET_VERSION}`;
  }
}
function scheduleDeferredCoachPortraitPreload() {
  if (cancelDeferredCoachPortraitPreload || typeof window === "undefined") return;
  const fileNames = Object.entries(COACH_EXPRESSION_FILES)
    .filter(([expression]) => expression !== "neutral")
    .map(([, filename]) => filename);
  const load = () => {
    cancelDeferredCoachPortraitPreload = undefined;
    preloadCoachPortraits(fileNames);
  };
  const requestIdleCallback = window.requestIdleCallback?.bind(window);
  if (requestIdleCallback) {
    const idleId = requestIdleCallback(load, { timeout: 2000 });
    cancelDeferredCoachPortraitPreload = () => window.cancelIdleCallback(idleId);
  } else {
    const timeoutId = window.setTimeout(load, 0);
    cancelDeferredCoachPortraitPreload = () => window.clearTimeout(timeoutId);
  }
}
// 盤以外の欄の構成が変わると盤に使える高さも変わる。
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
  clearGuidedReviewTimer();
  cancelPlayerIdleAdvice();
  coachAdviceScheduler.reset();
  analysisGeneration += 1;
  reviewCoachGeneration += 1;
  reviewCpuGeneration += 1;
  if (cpuTimer) clearTimeout(cpuTimer);
  cpuTimer = undefined;
  cancelDeferredCoachPortraitPreload?.();
  cancelDeferredCoachPortraitPreload = undefined;
  engine?.quit();
  ryuoStats.dispose();
  if (typeof window !== "undefined") {
    window.removeEventListener("pagehide", handlePageHide);
    window.removeEventListener("keydown", handleGlobalKeydown);
  }
});
onMounted(() => {
  preloadCoachPortraits([COACH_EXPRESSION_FILES.neutral]);
  if (matchStarted.value) scheduleDeferredCoachPortraitPreload();
  moveSounds.preload();
  window.addEventListener("keydown", handleGlobalKeydown);
  window.addEventListener("pagehide", handlePageHide);
  // ホームのない埋め込みでは、ほかの画面を開かないので読まない。
  if (props.showHome) prefetchScreens();
});

const restoredPersistedMatch = restorePersistedMatch();
queueMicrotask(() => {
  observeFormations(currentSfen.value);
  if (restoredPersistedMatch) {
    emit("match-ready", { mode: normalizedMode.value, sfen: currentSfen.value, restored: true });
  }
  if (restoredPersistedMatch || !homeOpen.value || reviewMode.value) {
    void initializeEngine();
  }
});
</script>

<!-- 対局画面のスタイルは量が多いので、別のファイルに分けている。 -->
<style src="./ShogiMatchGame.css"></style>
