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
        'shogi-game--dex-over-match': dexOverMatch,
      },
      matchStage && !homeOpen ? `shogi-game--stage-${matchStage.weight}` : '',
      matchStage?.scenery && !homeOpen ? `shogi-game--scenery-${matchStage.scenery}` : '',
      matchStage?.scenery === 'sky' && !homeOpen ? `shogi-game--sky-${matchSky}` : '',
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
        3つの入口は混ぜない(Switchのホーム画面の「種類を分けて配置する」)。区分ごとに1行にして上から積み、
        行の中のタイルは、どの画面でも横1列に並べる(区分を横に並べたり、タイルを折り返したりしない)。
        区分は枠で囲まず(囲むとごちゃつく)、行の上の小さな見出しと余白で分ける。
      -->
      <div class="shogi-title__hero">
        <h1 class="shogi-title__logo">shogi-match</h1>
        <p class="shogi-title__bubble" aria-hidden="true">{{ homeGreeting }}</p>
        <img
          class="shogi-title__chara"
          :src="`${assetBaseUrl}/characters/yakobihime-mini.webp?v=4`"
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
          <!-- 強くなる道(docs/home-roadmap-design.md)。5つの段のどこにいるかを、つぎはこれの見出しの横に見せる。 -->
          <span class="shogi-title__next-eyebrow">
            <span>つぎはこれ</span>
            <span
              class="shogi-title__road"
              role="img"
              :aria-label="`強くなる道 ${homeRoadmapState.current}/${homeRoadmapState.steps.length}：${homeRoadmapStep.label}`"
              data-home-road
            >
              <i
                v-for="step in homeRoadmapState.steps"
                :key="step.id"
                :class="{ 'is-done': step.done, 'is-current': step.current }"
              >{{ step.done ? "✓" : step.number }}</i>
            </span>
          </span>
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
            <template v-else-if="homeNextIcon === 'tournament'">
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
            </template>
            <template v-else-if="homeNextIcon === 'problems'">
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
            </template>
            <template v-else-if="homeNextIcon === 'tutorial'">
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
        <!-- 立て直しのときだけ、小さな2つ目の入口(香落ちで、連敗したLvに挑む)。主役は上の1枚(docs/home-next-adaptive-design.mdの6章)。 -->
        <button
          v-if="homeNext.handicapLevel !== undefined && homeNext.handicapLevel !== null"
          type="button"
          class="shogi-title__next-sub"
          data-next-handicap
          @click="startQuickMatch({ level: homeNext.handicapLevel, handicapId: homeNext.handicapId?.id ?? 'lance' })"
        >{{ homeNext.handicapId?.label ?? "香落ち" }}でLv.{{ homeNext.handicapLevel }}に挑む</button>
        <!-- 竜王戦の期の途中: 主役でない方(対策か続き)を、小さな2つ目の入口にする(docs/home-next-adaptive-design.mdの13-3)。 -->
        <button
          v-if="homeNext.sub"
          type="button"
          class="shogi-title__next-sub"
          :data-next-sub="homeNext.sub.id"
          @click="startHomeNextSub"
        >{{ homeNext.sub.label }}</button>

        <!--
          記録の帯の横に、プレイヤー名。押すと名前を入れる札を開く(docs/player-name-design.md)。
          入れていなければ「名前を入れる」。名前は盤の名札・対局準備・竜王戦の表とVS画面に出る。
        -->
        <div class="shogi-title__record-row">
        <button
          type="button"
          class="shogi-title__name"
          :class="{ 'shogi-title__name--empty': !playerName }"
          :aria-label="playerName ? `プレイヤー名 ${playerName}。押すと変える` : 'プレイヤー名を入れる'"
          data-player-name
          @click="openNameDialog"
        >
          <svg class="shogi-title__icon" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
            <g fill="#f1a54c">
              <rect x="10" y="2" width="2" height="2" />
              <rect x="8" y="4" width="2" height="2" />
              <rect x="6" y="6" width="2" height="2" />
              <rect x="4" y="8" width="2" height="2" />
            </g>
            <g fill="#fffcf4">
              <rect x="12" y="2" width="2" height="2" />
              <rect x="10" y="4" width="2" height="2" />
              <rect x="8" y="6" width="2" height="2" />
              <rect x="6" y="8" width="2" height="2" />
              <rect x="3" y="11" width="2" height="2" />
            </g>
          </svg>
          <span class="shogi-title__name-text">{{ playerName || "名前を入れる" }}</span>
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
            <span v-if="homeStreak.current >= 2" class="shogi-title__record-badge shogi-title__record-badge--streak" data-home-streak>続けて{{ homeStreak.current }}日</span>
          </span>
          <span class="shogi-title__record-link"><span class="shogi-title__record-link-head">やこび</span>ノート <span aria-hidden="true">›</span></span>
        </button>
        </div>

        <div class="shogi-title__groups">
          <section class="shogi-title__group shogi-title__group--play" aria-labelledby="shogi-home-play" data-home-group="play">
            <h2 id="shogi-home-play" class="shogi-title__group-title">あそぶ</h2>
            <div class="shogi-title__tiles shogi-title__tiles--play">
              <button type="button" class="shogi-title__tile" :class="homeTileClass('match')" @click="openMatchSetup('normal')">
                <span v-if="homeTile('match').recommended" class="shogi-title__tile-badge">おすすめ</span>
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
                <small class="shogi-title__desc">{{ homeTile("match").after || "設定を選んで1局" }}</small>
              </button>
              <button type="button" class="shogi-title__tile" :class="homeTileClass('tournament')" @click="openTournamentScreen">
                <span v-if="homeTile('tournament').recommended" class="shogi-title__tile-badge">おすすめ</span>
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
                <small class="shogi-title__desc">{{ homeTile("tournament").after || "竜王戦で称号を" }}</small>
              </button>
              <button type="button" class="shogi-title__tile" :class="homeTileClass('endgame')" data-endgame-tile @click="startEndgameMatch">
                <span v-if="homeTile('endgame').recommended" class="shogi-title__tile-badge">おすすめ</span>
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
                <small class="shogi-title__desc">{{ homeTile("endgame").after || "名局の終盤から" }}</small>
              </button>
            </div>
          </section>
          <section class="shogi-title__group shogi-title__group--learn" aria-labelledby="shogi-home-school" data-home-group="learn">
            <h2 id="shogi-home-school" class="shogi-title__group-title">まなぶ</h2>
            <div class="shogi-title__tiles">
              <button type="button" class="shogi-title__tile" :class="homeTileClass('tutorial')" @click="tutorialOpen = true">
                <span v-if="homeTile('tutorial').recommended" class="shogi-title__tile-badge">おすすめ</span>
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
              <button type="button" class="shogi-title__tile" :class="homeTileClass('problems')" @click="problemSetOpen = true">
                <span v-if="homeTile('problems').recommended" class="shogi-title__tile-badge">おすすめ</span>
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
                <small class="shogi-title__desc">{{ homeTile("problems").after || "詰ませ方・逃げ方" }}</small>
              </button>
            </div>
          </section>
          <section class="shogi-title__group shogi-title__group--dex" aria-labelledby="shogi-home-dex" data-home-group="dex">
            <h2 id="shogi-home-dex" class="shogi-title__group-title">しらべる</h2>
            <div class="shogi-title__tiles shogi-title__tiles--dex">
              <button
                v-for="shelf in DEX_SHELF"
                :key="shelf.kind"
                type="button"
                class="shogi-title__tile shogi-title__tile--small"
                @click="openDex(shelf.kind)"
              >
                <DexIcon class="shogi-title__icon" :kind="shelf.kind" />
                <span class="shogi-title__label">{{ shelf.label }}</span>
              </button>
            </div>
          </section>
        </div>
      </nav>
      <!-- exhibit属性で表示するデータリセット。公開ページと展示版で使う(docs/exhibit-design.md)。 -->
      <button
        v-if="exhibit"
        type="button"
        class="shogi-title__exhibit-reset"
        data-exhibit-reset
        @click="openExhibitReset"
      >データリセット</button>
    </div>

    <ShogiTutorial
      v-if="tutorialOpen"
      :auto-start="tutorialAutoStart"
      ref="tutorialView"
      :asset-base-url="assetBaseUrl"
      :match-report="tutorialReport"
      :welcome-choice="tutorialWelcomeChoice"
      :start-chapter="tutorialStartChapter"
      @close="tutorialOpen = false; tutorialReport = null; tutorialAutoStart = false; tutorialStartChapter = null"
      @open-dex="openDexFromTutorial"
      @start-match="startMatchFromTutorial"
      @grant-title="grantTutorialTitle"
    />
    <ShogiProblemSet
      v-if="problemSetOpen"
      ref="problemSetView"
      :asset-base-url="assetBaseUrl"
      :start-problem-id="problemSetStart?.id ?? ''"
      :start-review="problemSetStart?.review ?? false"
      :drill="problemSetDrill"
      @close="problemSetOpen = false"
    />
    <!-- 図鑑は教室の上に重ねて開き、閉じると教室へ戻る。 -->
    <ShogiOpeningDex
      v-if="dexOpen"
      :initial-id="openingDexInitialId"
      :asset-base-url="assetBaseUrl"
      :back-label="dexBackLabel"
      :can-play="!dexFromMatch"
      @close="dexOpen = false; openingDexInitialId = ''"
      @play-plan="playPlanFromDex"
    />
    <ShogiTournament
      v-if="tournamentOpen"
      ref="tournamentView"
      :asset-base-url="assetBaseUrl"
      :back-label="tutorialOpen ? '戻る' : 'タイトルへ戻る'"
      :career="ryuoCareer"
      :view="ryuoView"
      :default-difficulty="ryuoDefaultDifficulty"
      :user-level="ratingLevel(ratingState.rating)"
      :rating-text="`R${ratingState.rating}`"
      :start-at="tournamentStartAt"
      :from-game="tournamentFromGame"
      :ryuo-holder="ryuoHolder"
      :player-name="playerDisplayName(playerName)"
      :oshi="ryuoOshi"
      @close="tournamentOpen = false"
      @enter="enterRyuoSeason"
      :suspended-moves="suspendedRyuoMoves"
      @play="startRyuoGame"
      @resume="resumeRyuoGame"
      @open-note="tournamentOpen = false; yakobiNoteOpen = true"
      @result-seen="markRyuoResultSeen"
      :meijin-view="meijinView"
      :meijin-career="meijinCareer"
      :meijin-entry-class="meijinEntryClass"
      :meijin-rival-class="hananeJunniClass"
      :meijin-entry-no="meijinEntryNo"
      :meijin-holder-name="meijinHolderName"
      :meijin-settings="meijinCareer.settings ?? null"
      :meijin-suspended-moves="suspendedMeijinMoves"
      @meijin-enter="enterMeijinSeason"
      @meijin-play="startMeijinGame"
      @meijin-resume="resumeMeijinGame"
      @meijin-result-seen="markMeijinResultSeen"
      :awards="seasonAwards"
      :shoreikai-view="shoreikaiView"
      :shoreikai-career="shoreikaiCareer"
      :shoreikai-mentors="shoreikaiMentors"
      :shoreikai-recommended-rank="shoreikaiRecommendedRank"
      :shoreikai-suspended-moves="suspendedShoreikaiMoves"
      @shoreikai-enter="enterShoreikai"
      @shoreikai-play="startShoreikaiGame"
      @shoreikai-resume="resumeShoreikaiGame"
      @shoreikai-retry="retryShoreikai"
      @shoreikai-close="closeShoreikai"
    />
    <YakobiNote
      v-if="yakobiNoteOpen"
      ref="noteView"
      :asset-base-url="assetBaseUrl"
      :back-label="tutorialOpen ? '戻る' : 'タイトルへ戻る'"
      :state="ratingState"
      :profile="profileState"
      :career="ryuoCareer"
      :roster="ryuoRoster"
      :meijin-career="meijinCareer"
      :awards="seasonAwards"
      :unlocked-plan-ids="[...planUnlocks.unlocked]"
      @close="yakobiNoteOpen = false"
      @open-plan="openPlanFromNote"
      @open-dex="openDexFromNote"
      @start-match="startMatchFromNote"
      @start-measure="startMeasureMatch"
      @declare="declareGrade"
    />
    <ShogiReferenceDex
      v-if="referenceDexKind"
      ref="referenceDexView"
      :kind="referenceDexKind"
      :analysis-engine="dexFromMatch ? null : dexAnalysisEngine"
      :initial-id="referenceDexInitialId"
      :asset-base-url="assetBaseUrl"
      :back-label="dexBackLabel"
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
              :class="{ 'shogi-game__think-fill--busy': !analysisStage }"
              :style="analysisStage ? { width: `${measureProgressPercent}%` } : undefined"
            />
          </div>
          <small class="shogi-game__think-count">
            {{ analysisRunning ? `${ANALYSIS_STAGE_LABELS[analysisStage as keyof typeof ANALYSIS_STAGE_LABELS] ?? "解析"} ${analysisProgress}/${analysisTotal}` : "準備中" }}
          </small>
        </div>
        <span
          v-if="materialChip"
          :class="['shogi-game__material', `shogi-game__material--${materialChip.tone}`]"
          :aria-label="materialChip.aria"
          data-material-chip
        >{{ materialChip.text }}</span>
        <span>{{ moveCount }}手目</span>
      </div>
      <div
        class="shogi-game__toolbar"
        :class="{ 'shogi-game__toolbar--learning': matchKind === 'learning' }"
      >
        <!--
          検討(棋譜解析・振り返り)を終えるボタンは、次へ進む唯一の道なので、画面の幅によらずメニューにしまわずに出す。
          押すとどこへ行くかを文字で示す(ホーム・竜王戦・教室・対局準備)。
        -->
        <button
          v-if="reviewMode && !measureAnalyzing"
          type="button"
          class="shogi-game__command shogi-game__command--complete"
          :disabled="!active"
          data-review-complete
          @click="completeReview()"
        >{{ reviewCompleteLabel }}</button>
        <template v-if="!menuCollapsed && !reviewMode">
          <button
            type="button"
            class="shogi-game__command shogi-game__command--danger"
            :disabled="!active"
            @click="requestResign()"
          >投了</button>
          <button
            v-if="showHome"
            type="button"
            class="shogi-game__command"
            :disabled="!active"
            @click="suspendConfirmOpen = true"
          >中断</button>
        </template>
        <!-- 対局中・検討中に図鑑を開く。画面の幅によらずメニューにしまわない。見終わると対局へ戻る。 -->
        <button
          type="button"
          class="shogi-game__command shogi-game__dex-open"
          aria-haspopup="dialog"
          :aria-expanded="dexShelfOpen"
          data-match-dex
          @click="openDexShelf"
        ><DexIcon kind="tesuji" class="shogi-game__dex-open-icon" />図鑑</button>
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
        <template v-if="menuCollapsed && !reviewMode">
          <button
            type="button"
            role="menuitem"
            class="shogi-game__menu-item shogi-game__menu-item--danger"
            :disabled="!active"
            @click="closeSettings(); requestResign()"
          >投了する</button>
          <button
            v-if="showHome"
            type="button"
            role="menuitem"
            class="shogi-game__menu-item"
            :disabled="!active"
            @click="closeSettings(); suspendConfirmOpen = true"
          >対局を中断する</button>
        </template>
        <!-- 盤の反転は操作列からも切り替えられる。見出しのメニューにも同じ状態を表示する。 -->
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
        <button
          v-if="matchStage"
          type="button"
          role="menuitemcheckbox"
          class="shogi-game__menu-item"
          :aria-checked="broadcastEnabled"
          data-broadcast-toggle
          @click="toggleBroadcast"
        >中継（勝率と控室）<b>{{ broadcastEnabled ? "ON" : "OFF" }}</b></button>
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
            :class="{ 'shogi-game__pregame-side--cpu': side.isCpu }"
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
                  v-if="row.kind === 'plan'"
                  class="shogi-game__pregame-row shogi-game__pregame-row--plan"
                  :data-pregame-row="row.id"
                >
                  <span class="shogi-game__pregame-row-label">{{ row.label }}:</span>
                  <span class="shogi-game__pregame-value">{{ row.value }}</span>
                  <span class="shogi-game__pregame-plan-buttons">
                    <button
                      type="button"
                      class="shogi-game__pregame-change shogi-game__pregame-auto"
                      aria-label="あなたの作戦を、やこび姫におまかせする"
                      data-plan-auto
                      @click="autoPickOpeningPlan('pregame')"
                    >おまかせ</button>
                    <button
                      type="button"
                      class="shogi-game__pregame-change"
                      aria-label="あなたの作戦を変更"
                      @click="openPlanSheet('pregame')"
                    >変更</button>
                  </span>
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
                    @click="openPregameRow(row.id)"
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
              おすすめの強さ: Lv.{{ playPreset.level }} {{ playPreset.label }}
              <button
                type="button"
                class="shogi-game__pregame-change"
                :disabled="searchNodes === playPreset.value"
                @click="searchNodes = playPreset.value"
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
    <!-- 作戦カードのシート。対局準備の「あなたの作戦」と、対局中のやこび姫補助の欄から開く。 -->
    <OpeningPlanSheet
      v-if="planSheet"
      :title="planSheet === 'cpu' ? 'CPUの作戦をえらぶ' : planSheet === 'pregame' ? 'あなたの作戦をえらぶ' : '作戦をえらぶ'"
      :mode="planSheet === 'cpu' ? 'cpu' : 'player'"
      :entries="planSheetEntries"
      :selected-id="planSheet === 'cpu' ? cpuPlanId : selectedPlanId"
      :selected-castle="planSheet === 'cpu' ? cpuDetailedCastle : selectedCastle"
      :broad-options="CPU_STRATEGY_OPTIONS"
      :broad-value="cpuStrategyDetailsOpen ? '' : cpuStrategy"
      :allow-clear="Boolean(selectedStrategy || selectedCastle)"
      :show-switch="!planUnlocks.all || showAllPlans"
      :show-all="showAllPlans"
      :note="planSheet === 'game' ? '今の局面から組める作戦だけを並べているよ。' : ''"
      @choose="choosePlan"
      @clear="clearPlan"
      @auto="autoPickOpeningPlan(planSheet === 'pregame' ? 'pregame' : 'game')"
      :asset-base-url="assetBaseUrl"
      :player-color="planSheet === 'cpu' ? (selectedPlayerColor === 'black' ? 'white' : 'black') : planSheet === 'pregame' ? pregamePlayerColor : playerColorKey"
      @toggle-all="togglePlanSwitch"
      @fortune-result="onFortuneResult"
      @broad="chooseCpuBroadPlan"
      @close="closePlanSheet"
      :initial-detail-id="planSheetDetailId"
    />

    <section
      v-if="cpuColor !== null || blackFormationText !== UNDETERMINED_FORMATION || whiteFormationText !== UNDETERMINED_FORMATION"
      class="shogi-game__summary"
      :class="matchStage ? `shogi-game__summary--stage-${matchStage.weight}` : ''"
      aria-label="対戦相手と戦型"
    >
      <!--
        大会の1局は、対局の札にする(docs/match-stage-design.md)。どの大会の、どの局で、何を賭けているかを、対局中ずっと見せる。
        番勝負は星取り(○勝ち・●負け・◇この局)も出す。タイトル戦は対局場と、二日制の何日目かも出す。
      -->
      <div
        v-if="matchStage"
        class="shogi-game__stage-band"
        :class="[`shogi-game__stage-band--${matchStage.weight}`, matchStage.tone ? `shogi-game__stage-band--${matchStage.tone}` : '']"
        data-match-stage
        :data-stage-weight="matchStage.weight"
      >
        <p class="shogi-game__stage-head">
          <span class="shogi-game__stage-event">{{ matchStage.eventText }}</span>
          <strong>{{ matchStage.shortLabel ?? matchStage.label }}</strong>
          <!-- 封じ手のあとは「2日目・まとめ」のボタン。押すと1日目のまとめ(docs/title-match-day-design.md)。 -->
          <button
            v-if="stageDayText && titleDay?.seal"
            type="button"
            class="shogi-game__stage-day shogi-game__stage-day--button"
            data-stage-day
            data-day-summary-open
            @click="daySummaryOpen = true"
          >{{ stageDayText }}・まとめ</button>
          <span v-else-if="stageDayText" class="shogi-game__stage-day" data-stage-day>{{ stageDayText }}</span>
        </p>
        <p v-if="matchStage.venue" class="shogi-game__stage-venue">対局場 {{ matchStage.venue }}</p>
        <p class="shogi-game__stage-line">
          <span
            v-if="matchStage.need"
            class="shogi-game__stage-marks"
            role="img"
            :aria-label="matchStage.score ? `ここまで${matchStage.score}` : 'この局が最初'"
          >
            <i
              v-for="(mark, index) in matchStage.marks"
              :key="index"
              :class="`shogi-game__stage-mark--${mark}`"
            >{{ mark === "win" ? "○" : "●" }}</i>
            <i class="shogi-game__stage-mark--now">◇</i>
          </span>
          <b v-if="matchStage.stakes" class="shogi-game__stage-stakes">{{ matchStage.stakes }}</b>
        </p>
        <!--
          中継の勝率バー(docs/tournament-match-presence-design.mdの3章)。左が先手(青)、右が後手(赤)。数字は自分の勝率だけ。
          助言の読みの評価値から、棋譜解析の振り返りと同じ式で出す。助言が「なし」のときと、設定で中継を切ったときは出さない。
        -->
        <div
          v-if="broadcastShown"
          class="shogi-game__broadcast"
          role="meter"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="broadcastRate === null ? undefined : Math.round(broadcastRate * 100)"
          :aria-label="`AIの読みの勝率 あなた${formatWinRate(broadcastRate)}`"
          data-broadcast
        >
          <span class="shogi-game__broadcast-tag">中継</span>
          <span class="shogi-game__broadcast-bar" aria-hidden="true">
            <i class="shogi-game__broadcast-black" :style="{ width: `${broadcastBlackShare * 100}%` }"></i>
          </span>
          <span class="shogi-game__broadcast-rate">あなた {{ formatWinRate(broadcastRate) }}</span>
        </div>
        <p class="shogi-game__stage-opponent">
          <!-- 相手の顔(期の画面と同じ判子。羽音は絵)。表情は形勢で3段(docs/tournament-match-presence-design.mdの2章)。 -->
          <span
            v-if="opponentFace"
            class="shogi-game__opponent-face"
            :class="[`shogi-game__opponent-face--${opponentFace.tone}`, `shogi-game__opponent-face--${opponentFace.mood}`]"
            role="img"
            :aria-label="`${opponentFace.name}さん（${opponentFace.moodLabel}）`"
            data-opponent-face
            :data-mood="opponentFace.mood"
          ><img v-if="opponentFace.sprite" :src="opponentFace.sprite" alt="" draggable="false"><span v-else aria-hidden="true">{{ opponentFace.char }}</span></span>
          <span>対 {{ cpuColor === Color.BLACK ? "☗" : "☖" }}{{ cpuDisplayName }}</span>
        </p>
        <!--
          中継の1行。相手の一言・特殊能力の札・ほかの対局の速報を、決まった高さの1行に出す(盤の大きさを変えない)。
          押すと消える。特殊能力の札 → 相手の一言 → 速報の順に、新しいものを上書きする。
        -->
        <p
          class="shogi-game__presence-line"
          :class="presenceLine ? `shogi-game__presence-line--${presenceLine.kind} shogi-game__presence-line--${presenceLine.tone}` : ''"
          role="status"
          aria-live="polite"
          data-presence-line
          @click="presenceLine = null"
        ><span v-if="presenceLine" :key="presenceLine.id" :title="presenceLine.text">{{ presenceLine.text }}</span></p>
      </div>
      <div v-else-if="cpuColor !== null" class="shogi-game__summary-opponent">
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
      <!--
        作戦は、完成形の小さな盤が描かれた作戦カードで選ぶ(docs/opening-guide-ux-design.md)。
        通常対局で作戦を選んでいないあいだは、1行のボタンにたたむ。押すと作戦カードのシートを開く。
      -->
      <button
        v-if="openingGuideCollapsed"
        type="button"
        class="shogi-game__opening-expand"
        data-plan-open
        @click="openPlanSheet('game')"
      >
        <span>作戦を選ぶ</span>
        <small>完成形を見て作戦を選ぶと、やこび姫が手順を案内するよ</small>
      </button>
      <div v-else-if="openingGuideAvailable" class="shogi-game__opening-plan">
        <button
          type="button"
          class="shogi-game__opening-plan-card"
          data-plan-open
          :aria-label="`作戦: ${selectedPlanLabel || 'なし'}。押すと作戦を変えられるよ`"
          @click="openPlanSheet('game')"
        >
          <FormationThumb
            v-if="selectedStrategy || selectedCastle"
            class="shogi-game__opening-plan-thumb"
            :strategy-id="selectedStrategy"
            :castle-id="selectedCastle"
            :filled-squares="planFilledSquares"
          />
          <span class="shogi-game__opening-plan-text">
            <b>{{ selectedPlanLabel || "作戦なし" }}</b>
            <small v-if="planProgress && planProgress.total">完成まで、あと{{ planProgress.total - planProgress.filled }}マス</small>
            <small v-else-if="openingPlanComplete">完成！</small>
            <small v-else-if="!selectedStrategy && !selectedCastle">押すと作戦カードから選べるよ</small>
          </span>
        </button>
        <div class="shogi-game__opening-plan-actions">
          <button type="button" data-plan-auto @click="autoPickOpeningPlan('game')">おまかせ</button>
          <button
            v-if="selectedStrategy || selectedCastle"
            type="button"
            role="switch"
            class="shogi-game__opening-plan-ghosts"
            :aria-checked="planGhostsOn"
            data-plan-ghosts
            @click="togglePlanGhosts"
          >完成形を盤に出す<span aria-hidden="true">{{ planGhostsOn ? "ON" : "OFF" }}</span></button>
        </div>
      </div>
      <!-- 中断したら、理由を一言で伝え、今の局面から近い作戦を並べる。押せばすぐ続けられる。 -->
      <div v-if="planInterruption" class="shogi-game__plan-interrupt" data-plan-interruption role="status">
        <p><b>作戦を変えよう</b>{{ planInterruption.reason }}</p>
        <div>
          <button
            v-for="suggestion in planInterruption.suggestions"
            :key="`${suggestion.kind}:${suggestion.id}`"
            type="button"
            @click="chooseSuggestedPlan(suggestion.kind, suggestion.id)"
          >{{ suggestion.label }}<small>あと{{ suggestion.distance }}手</small></button>
          <button type="button" @click="openPlanSheet('game')">ほかの作戦を見る</button>
        </div>
      </div>
      <!--
        やこび姫の作戦の助言(docs/coach-plan-advice-design.md)。AIが飛車を振る手を強く勧めるときに出す。
        根拠は2手に絞って読み直した点数。「にする」で作戦カードに入れ、矢印と薄い駒で案内する。
      -->
      <div v-if="coachPlanOffer" class="shogi-game__plan-interrupt shogi-game__plan-offer" data-plan-offer role="status">
        <p><b>作戦の提案</b>{{ coachPlanOffer.label }}</p>
        <p class="shogi-game__plan-offer-basis" data-plan-offer-basis>
          <span>AIの読み</span>
          <span>飛車を振る {{ coachPlanOffer.swingText }} <b>{{ coachPlanOffer.swingScore }}</b></span>
          <span>振らない一番の手 {{ coachPlanOffer.otherText }} <b>{{ coachPlanOffer.otherScore }}</b></span>
        </p>
        <div>
          <button
            v-if="coachPlanOffer.selectable"
            type="button"
            data-plan-offer-accept
            @click="acceptCoachPlanOffer"
          >{{ coachPlanOffer.label }}にする</button>
          <button type="button" data-plan-offer-dismiss @click="dismissCoachPlanOffer">このまま指す</button>
        </div>
      </div>
      <!--
        タイトル戦の勝負メシ(docs/title-match-day-design.mdの2章)。20手を越えたら、対局場の名物から選ぶ。
        強さには関係しない。選ばずに指し続けてもよく、封じ手までに選ばなければ1品目にする。
      -->
      <div v-if="lunchOffer" class="shogi-game__plan-interrupt shogi-game__lunch-offer" data-lunch-offer role="status">
        <p><b>お昼の休憩</b>勝負メシはどれにする？</p>
        <div>
          <button v-for="meal in lunchOffer" :key="meal" type="button" data-lunch-choice @click="chooseLunch(meal)">{{ meal }}</button>
        </div>
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
      @pointerdown.capture="onBoardShellPointerDown"
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
        :player-countdown="playerCountdown"
        :candidates="boardCandidates"
        :attack-marks="boardAttackMarks"
        :float-labels="captureFloatLabels"
        :mark-squares="boardEscapeMarks"
        :risk-destinations="boardRiskDestinations"
        :ghost-pieces="planGhosts"
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
          :class="{ 'shogi-game__furigoma--shake': furigomaCallout.phase === 'shake' }"
          role="status"
          data-furigoma
          :data-furigoma-phase="furigomaCallout.phase"
          @click="landFurigoma({ skipped: true })"
        >
          <!-- 振っているあいだは、歩の面を見せずに揺らす。撒く音で、表と裏を見せる。 -->
          <span class="shogi-game__furigoma-pieces" aria-hidden="true" :key="furigomaCallout.phase">
            <img
              v-for="(face, index) in furigomaCallout.faces"
              :key="index"
              :src="furigomaPieceUrl(furigomaCallout.phase === 'shake' ? 'fu' : face)"
              :style="{ animationDelay: `${furigomaCallout.phase === 'shake' ? index * 37 : index * 70}ms` }"
              alt=""
            >
          </span>
          <strong>振り駒</strong>
          <small>{{ furigomaCallout.phase === "shake" ? "歩を5枚、振っているよ…" : furigomaCallout.text }}</small>
        </div>
      </Transition>
      <!--
        大会の大一番とタイトル戦の、開幕の札と封じ手の札(docs/match-stage-design.md)。盤の操作は妨げず、盤を触るとすぐ消える。
      -->
      <Transition name="shogi-game__callout">
        <div
          v-if="stageCard && matchStage && !checkCallout"
          :key="stageCard.id"
          class="shogi-game__stage-card"
          :class="[`shogi-game__stage-card--${stageCard.kind}`, `shogi-game__stage-card--${matchStage.weight}`]"
          role="status"
          data-stage-card
          :data-stage-card-kind="stageCard.kind"
        >
          <template v-if="stageCard.kind === 'opening'">
            <small>{{ matchStage.eventText }}</small>
            <em v-if="matchStage.longestDay" class="shogi-game__stage-card-longest" data-longest-day>将棋界の一番長い日</em>
            <strong>{{ matchStage.shortLabel ?? matchStage.label }}</strong>
            <span v-if="matchStage.venue" class="shogi-game__stage-card-venue">{{ matchStage.venue }}</span>
            <span v-if="matchStage.weight === 'title'" class="shogi-game__stage-card-sides">
              <span v-for="side in matchStage.sides" :key="side.role" :class="{ 'shogi-game__stage-card-you': side.you }">
                <em>{{ side.role }}</em>{{ side.name }}
              </span>
            </span>
            <b v-if="matchStage.stakes">{{ matchStage.stakes }}</b>
          </template>
          <template v-else-if="stageCard.kind === 'seal'">
            <i class="shogi-game__stage-envelope" aria-hidden="true"></i>
            <small>1日目はここまで</small>
            <strong>封じ手</strong>
            <span>この手を封筒にしまって、2日目に開けるよ</span>
            <em v-if="unsealView?.predicted" class="shogi-game__stage-card-predict" data-seal-predict>控室の予想は{{ unsealView.predicted }}</em>
          </template>
          <!-- 2日目の朝、立会人が封筒を開けて封じ手を読み上げる。控室の予想と同じなら「予想どおり」。 -->
          <template v-else>
            <i class="shogi-game__stage-envelope shogi-game__stage-envelope--open" aria-hidden="true"></i>
            <small>2日目の朝</small>
            <strong>封じ手の開封</strong>
            <span>{{ unsealView?.opener }}</span>
            <b data-unseal-move>{{ unsealView?.move }}</b>
            <em
              v-if="unsealView?.verdict"
              class="shogi-game__stage-card-predict"
              :class="{ 'shogi-game__stage-card-predict--hit': unsealView.matched }"
              data-unseal-verdict
            >{{ unsealView.verdict }}</em>
          </template>
        </div>
      </Transition>
      <!--
        大会の終局の判子(docs/tournament-match-presence-design.mdの6章)。勝った瞬間に盤の上へ押し、1.2秒で結果の窓へ。
        言葉は期の画面の節目の判子と同じ。盤を触ると、すぐ結果の窓へ進む。負けたときは押さない。
      -->
      <div
        v-if="finishStampShown && !resultDialogOpen"
        :key="finishStampShown.id"
        class="shogi-game__finish-stamp"
        :class="`shogi-game__finish-stamp--${finishStampShown.size}`"
        role="status"
        data-finish-stamp
      >
        <b>{{ finishStampShown.seal }}</b>
        <span v-if="finishStampShown.title">{{ finishStampShown.title }}</span>
        <i v-if="finishStampShown.confetti" class="shogi-game__confetti" aria-hidden="true">
          <i v-for="piece in 14" :key="piece" :style="{ '--piece': piece }"></i>
        </i>
      </div>
      <!-- 囲い完成の知らせ。教室の「囲いを組もう」と同じく、組み上げた瞬間をほめる。 -->
      <Transition name="shogi-game__callout">
        <div
          v-if="castleCallout && !checkCallout && !furigomaCallout && !stageCard"
          :key="castleCallout.id"
          class="shogi-game__castle-callout"
          role="status"
          data-castle-callout
        >
          <small v-if="castleCallout.first">はじめて！</small>
          <strong>{{ castleCallout.label }} 完成！</strong>
          <small>{{ castleCallout.first ? "終局後、コレクションに印がつくよ" : "玉が堅くなったね" }}</small>
        </div>
      </Transition>
    </div>

    <section class="shogi-game__coach" aria-label="やこび姫">
      <div class="shogi-game__portrait">
        <img
          ref="portraitImage"
          class="shogi-game__character"
          :src="coachPortraitUrl"
          :srcset="coachPortraitSrcsetValue"
          :sizes="coachPortraitSizesValue"
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
      閃き・待ったの隣に、ひふみんアイ・駒の利き・駒の損得を置く。
      操作列の幅が足りないときは、表示の3つを「表示補助」にまとめ、ボタンを小さくしない。
      駒の利きと駒の損得は、学習対局だけでなく、通常対局・竜王戦でも付け外しできる(押すまでは出さない。補助は本人が選ぶ)。
      棋譜解析中も、閃きと読みは、やこび姫のコメントの下の操作列に置く(通常時の閃き・待ったと同じ場所)。
    -->
    <div ref="assistActions" class="shogi-game__assist-actions">
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
      <details
        ref="assistTools"
        class="shogi-game__display-tools"
        :class="{ 'shogi-game__display-tools--collapsed': assistToolsCollapsed }"
        :open="!assistToolsCollapsed || assistToolsOpen"
        data-display-tools
        @toggle="syncAssistTools"
        @keydown.esc.stop.prevent="closeAssistTools(true)"
      >
        <summary
          class="shogi-game__display-tools-summary"
          :aria-expanded="!assistToolsCollapsed || assistToolsOpen"
          :aria-label="`表示補助${activeDisplayToolCount ? `（${activeDisplayToolCount}項目が有効）` : ''}`"
        >表示補助<small v-if="activeDisplayToolCount" class="shogi-game__display-tools-count">{{ activeDisplayToolCount }}</small><span aria-hidden="true">{{ assistToolsOpen ? '▾' : '▴' }}</span></summary>
        <div class="shogi-game__display-tools-buttons" aria-label="盤面の表示補助">
          <button
            type="button"
            class="shogi-game__assist-toggle shogi-game__command--flip"
            aria-label="盤面を上下反転（ひふみんアイ）"
            :aria-pressed="boardFlipOverride"
            data-assist-flip
            @click="boardFlipOverride = !boardFlipOverride"
          >ひふみん<wbr>アイ</button>
          <button
            type="button"
            class="shogi-game__assist-toggle shogi-game__command--attack"
            aria-label="駒の利きを表示"
            :aria-pressed="attackGuideEnabled"
            @click="attackGuideEnabled = !attackGuideEnabled"
          >駒の<wbr>利き</button>
          <!-- 駒の損得。押すと、状態表示に自分から見た駒の損得(駒得＋3など)を出し、駒を取ったマスに数字を浮かべる。 -->
          <button
            type="button"
            class="shogi-game__assist-toggle shogi-game__command--material"
            aria-label="駒の損得を表示"
            :aria-pressed="materialGuideEnabled"
            data-material-toggle
            @click="toggleMaterialGuide"
          >駒の<wbr>損得</button>
        </div>
      </details>
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

    <section
      v-if="reviewMode && analysisOpen"
      class="shogi-game__analysis"
      aria-label="棋譜解析"
    >
      <!-- 対局の振り返り。止まる局面では、盤で手を指して答え合わせする。 -->
      <div v-if="guidedReview" class="shogi-game__guided" aria-live="polite">
        <img
          class="shogi-game__guided-chara"
          :src="`${assetBaseUrl}/characters/yakobihime-mini.webp?v=4`"
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

    <!-- 対局中の図鑑の棚。ホームの「しらべる」と同じ絵と名前で選び、図鑑を閉じると対局へ戻る。 -->
    <div
      v-if="dexShelfOpen"
      class="shogi-game__confirm shogi-game__dex-shelf"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dex-shelf-title"
      data-dex-shelf
      @click.self="dexShelfOpen = false"
      @keydown.esc.stop="dexShelfOpen = false"
    >
      <div class="shogi-game__confirm-panel shogi-game__dex-shelf-panel">
        <h2 id="dex-shelf-title">図鑑でしらべる</h2>
        <p>見終わったら、この対局に戻ります。</p>
        <div class="shogi-game__dex-shelf-items">
          <button
            v-for="shelf in DEX_SHELF"
            :key="shelf.kind"
            type="button"
            class="shogi-game__dex-shelf-item"
            :data-dex-kind="shelf.kind"
            @click="openDexFromMatch(shelf.kind)"
          >
            <DexIcon class="shogi-game__dex-shelf-icon" :kind="shelf.kind" />
            <span>{{ shelf.label }}</span>
            <small>{{ shelf.desc }}</small>
          </button>
        </div>
        <button type="button" class="shogi-game__dex-shelf-close" @click="dexShelfOpen = false">対局に戻る</button>
      </div>
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
    >
      <div class="shogi-game__confirm-panel shogi-welcome">
        <img
          class="shogi-welcome__chara"
          :src="`${assetBaseUrl}/characters/yakobihime-mini.webp?v=4`"
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

    <!--
      段級位の作り直し(2026-10-22。docs/level-ladder-design.mdの4章)のあと、前の記録を移した人に1回だけ。
      数字が大きく変わって見えるので、段級位の名前が同じ(か、どれになったか)を先に言う。
    -->
    <div
      v-if="ladderNoticeOpen"
      class="shogi-game__confirm shogi-game__confirm--over-home"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ladder-notice-title"
      data-ladder-notice
      @click.self="dismissLadderNoticeDialog"
    >
      <div class="shogi-game__confirm-panel shogi-welcome">
        <img
          class="shogi-welcome__chara"
          :src="`${assetBaseUrl}/characters/yakobihime-mini.webp?v=4`"
          alt=""
          aria-hidden="true"
        >
        <h2 id="ladder-notice-title">段級位の物差しを作り直したよ</h2>
        <p>CPUの強さを、15級からアマ七段、プロまで測り直したよ。</p>
        <p v-if="ratingState.ladderNotice" class="shogi-game__ladder-notice">
          あなたは<strong>{{ ratingState.ladderNotice.afterLabel }}</strong><template v-if="ratingState.ladderNotice.beforeLabel">（前は{{ ratingState.ladderNotice.beforeLabel }}）</template>。<br>
          レーティングの数字は R{{ ratingState.ladderNotice.beforeRating }} → <strong>R{{ ratingState.ladderNotice.afterRating }}</strong> になったよ。
        </p>
        <button type="button" class="shogi-game__rematch shogi-game__rematch--primary" data-ladder-notice-ok @click="dismissLadderNoticeDialog">わかった</button>
      </div>
    </div>

    <div
      v-if="exhibitResetOpen"
      class="shogi-game__confirm shogi-game__confirm--over-home"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="exhibit-reset-title"
      data-exhibit-reset-dialog
      @click.self="exhibitResetOpen = false"
    >
      <div class="shogi-game__confirm-panel">
        <h2 id="exhibit-reset-title">記録を消して、最初からにします。</h2>
        <p>名前・成績・教室の進み具合・大会・中断した対局が消えます。音と盤・駒の見た目は残ります。</p>
        <div>
          <button type="button" class="shogi-game__confirm-danger" data-exhibit-reset-accept @click="acceptExhibitReset">最初からにする</button>
          <button ref="exhibitResetCancel" type="button" @click="exhibitResetOpen = false">やめる</button>
        </div>
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

    <!-- プレイヤー名を入れる札。ホームの上に出す。空にして決めると「あなた」に戻る。 -->
    <div
      v-if="nameDialogOpen"
      class="shogi-game__confirm shogi-game__confirm--over-home"
      role="dialog"
      aria-modal="true"
      aria-labelledby="player-name-title"
      data-player-name-dialog
      @click.self="nameDialogOpen = false"
    >
      <form class="shogi-game__confirm-panel shogi-game__name-panel" @submit.prevent="acceptPlayerName">
        <h2 id="player-name-title">プレイヤー名</h2>
        <p>盤の名札や竜王戦の表に出る名前だよ（{{ PLAYER_NAME_MAX }}文字まで）。空にすると「あなた」になるよ。</p>
        <input
          ref="nameInput"
          v-model="nameDraft"
          class="shogi-game__name-input"
          type="text"
          inputmode="text"
          autocomplete="nickname"
          enterkeyhint="done"
          :maxlength="PLAYER_NAME_MAX * 2"
          placeholder="あなた"
          aria-label="プレイヤー名"
          data-player-name-input
        >
        <div>
          <button type="submit" class="shogi-game__confirm-primary" data-player-name-save>この名前にする</button>
          <button type="button" @click="nameDialogOpen = false">やめる</button>
        </div>
      </form>
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
        <div v-if="collectionResult && (collectionResult.gained.length || collectionResult.repeated.length || collectionResult.plans.length)" class="shogi-game__result-collection" data-collection-result>
          <p class="shogi-game__result-collection-title">コレクション</p>
          <ul v-if="collectionResult.gained.length">
            <li v-for="gain in collectionResult.gained" :key="gain.label" class="shogi-game__result-collection-new">
              {{ collectionGainText(gain) }}<small v-if="gain.detail">{{ gain.detail }}</small>
            </li>
          </ul>
          <p v-if="collectionResult.repeated.length" class="shogi-game__result-collection-repeat">前にも出した形: {{ collectionResult.repeated.join("・") }}</p>
          <p v-for="theme in collectionResult.themes" :key="theme" class="shogi-game__result-collection-theme">着せ替え{{ theme }}が使えるようになったよ！（やこびノートで選べるよ）</p>
          <p v-if="collectionResult.next" class="shogi-game__result-collection-next">次の着せ替えまで、印あと{{ collectionResult.next.remaining }}個</p>
          <!-- 形を完成させて増えた作戦カード。すぐ次の対局の「あなたの作戦」で使える(ごほうびの使い道)。 -->
          <p v-if="collectionResult.plans.length" class="shogi-game__result-collection-plans" data-new-plans>
            <em>NEW</em>{{ newPlansText(collectionResult.plans) }}を覚えたね！次の対局の「あなたの作戦」で使ってみよう
          </p>
        </div>
        <!-- 次にすること。ふだんは並びに影響しない(display: contents)。スマホの横向きでは右の列にまとめる。 -->
        <div class="shogi-game__result-next">
          <!--
            次の挑戦をいちばん手前に置く。同じLvに続けて負けたときは、挑戦を続ける道を先頭に、
            強さを1つ下げる・香落ちを同じ大きさで並べる(自動では変えない)。教室と棋力測定の対局には出さない。
          -->
          <!-- 竜王戦の次の相手の対策を終えたら、本番(竜王戦の期の画面)へ。もう一度対策も小さく残す(13-5)。 -->
          <div v-if="ryuoCounter && !tutorialMatch && !measureSession" class="shogi-game__result-step" data-counter-next>
            <p>{{ ryuoCounterOpponent?.name ?? "" }}さんの対策、おつかれさま。本番は{{ ryuoCounter.label }}</p>
            <button type="button" class="shogi-game__rematch shogi-game__rematch--primary" data-counter-go @click="goToRyuoFromCounter">本番へ</button>
            <button type="button" class="shogi-game__result-step-same" data-counter-again @click="startRyuoCounter">もう一度対策</button>
          </div>
          <div v-else-if="!tutorialMatch && !measureSession && resultRetrySuggestion" class="shogi-game__result-retry" data-retry-suggestion>
            <p>Lv.{{ resultRetrySuggestion.level }}、手強いね。どうする？</p>
            <div class="shogi-game__result-retry-choices">
              <button type="button" class="shogi-game__rematch" data-rematch @click="rematch()">もう一度挑む</button>
              <button
                v-if="resultRetrySuggestion.lowerLevel !== null"
                type="button"
                @click="rematch({ level: resultRetrySuggestion.lowerLevel })"
              >Lv.{{ resultRetrySuggestion.lowerLevel }}で腕ならし</button>
              <button type="button" @click="rematch({ handicapId: resultRetrySuggestion.handicapId })">{{ resultRetrySuggestion.handicapLabel }}で挑む</button>
            </div>
          </div>
          <!-- 勝ったら、次のLvへ(香落ちで勝ったら平手へ)。同じ相手ともう一局は、小さく残す(docs/home-next-adaptive-design.mdの4-2)。 -->
          <div v-else-if="!tutorialMatch && !measureSession && resultNextStep" class="shogi-game__result-step" data-next-step>
            <p>{{ resultNextStep.reason }}</p>
            <button
              type="button"
              class="shogi-game__rematch shogi-game__rematch--primary"
              data-rematch
              data-next-step-go
              @click="resultNextStep.kind === 'up' ? rematch({ level: resultNextStep.level }) : resultNextStep.kind === 'even' ? rematch({ level: resultNextStep.level, even: true }) : rematch()"
            >{{ resultNextStep.title }}</button>
            <button v-if="resultNextStep.sameTitle" type="button" class="shogi-game__result-step-same" data-next-step-same @click="rematch()">{{ resultNextStep.sameTitle }}</button>
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
        <p
          v-if="ratingChange"
          class="shogi-game__result-rating"
          :class="{ 'shogi-game__result-rating--up': ratingChange.delta > 0 }"
          data-rating-change
        >
          R{{ ratingChange.before }} → <strong>R{{ ratingChange.after }}</strong>
          <span>{{ ratingChange.delta >= 0 ? "+" : "−" }}{{ Math.abs(ratingChange.delta) }}</span>
        </p>
        <p v-if="ryuoGame.replay" class="shogi-game__tournament-title">千日手になりました。先後を入れ替えて、指し直します。</p>
        <p v-else-if="tournamentResult.done" class="shogi-game__tournament-title">{{ tournamentResult.doneText }}</p>
        <p v-else-if="tournamentResult.next" class="shogi-game__tournament-title">次の対局: {{ tournamentResult.next }}</p>
        <div class="shogi-game__result-actions">
          <button v-if="ryuoGame.replay" type="button" class="shogi-game__rematch" @click="replayRyuoGame">指し直す</button>
          <button v-else type="button" class="shogi-game__rematch" @click="leaveToTournamentScreen">
            {{ tournamentResult.done ? "結果を見る" : tournamentResult.back }}
          </button>
          <button v-if="resultKansenki" type="button" class="shogi-game__analysis-button" data-kansenki-open @click="kansenkiShown = resultKansenki">観戦記を読む</button>
          <button type="button" class="shogi-game__analysis-button" @click="startKifuAnalysis">棋譜解析</button>
          <button type="button" class="shogi-game__analysis-button" @click="leaveFinishedMatch({ toHome: true })">{{ showHome ? "ホームへ" : "対局準備" }}</button>
        </div>
      </div>
    </div>
    <!-- タイトル戦の1日目のまとめと観戦記(docs/title-match-day-design.md)。結果の窓の上にも重ねて開く。 -->
    <TitleDaySheet v-if="daySummaryOpen && daySummaryView" mode="summary" :summary="daySummaryView" @close="daySummaryOpen = false" />
    <TitleDaySheet v-if="kansenkiShown" mode="kansenki" :article="kansenkiShown" @close="kansenkiShown = null" />

    <!--
      棋力の測定中(終局から結果が出るまで)。結果は少し遅れて出るので、測定中だと分かる大きな札を盤の上に出す。
      待ち時間には、何を測っているかをやこび姫が話す(UI_Nintendo.mdの3-6)。「盤を見ながら待つ」で札を閉じても、上の帯の細い棒は残る。
    -->
    <div
      v-if="measureAnalyzing && !measureWaitHidden"
      class="shogi-game__result shogi-game__result--measure"
      role="dialog"
      aria-modal="true"
      aria-labelledby="measure-wait-title"
      data-measure-wait
    >
      <div class="shogi-game__result-panel shogi-game__measure-wait">
        <h2 id="measure-wait-title">棋力を測定中</h2>
        <p>あなたの指した手を、1手ずつ調べています。結果はこのあと、この画面に出ます。</p>
        <div
          class="shogi-game__measure-bar"
          role="progressbar"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="analysisStage ? measureProgressPercent : undefined"
          aria-label="棋力の測定の進み具合"
        >
          <div class="shogi-game__think-track">
            <div
              class="shogi-game__think-fill"
              :class="{ 'shogi-game__think-fill--busy': !analysisStage }"
              :style="analysisStage ? { width: `${measureProgressPercent}%` } : undefined"
            />
          </div>
          <div class="shogi-game__measure-steps">
            <span>{{ measureStepText }}</span>
            <strong v-if="analysisStage">{{ measureProgressPercent }}%</strong>
          </div>
        </div>
        <p class="shogi-game__measure-tip" aria-live="polite">
          <img :src="`${assetBaseUrl}/characters/yakobihime-mini.webp?v=4`" alt="" draggable="false">
          <span>{{ MEASURE_WAIT_TIPS[measureTipIndex] }}</span>
        </p>
        <div class="shogi-game__result-actions">
          <button type="button" class="shogi-game__analysis-button" data-measure-wait-hide @click="measureWaitHidden = true">盤を見ながら待つ</button>
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
        <!--
          測れる手が足りないときは、相手の強さを近づけて、もう1局(手は持ち越して合わせて診断する)。
          最初の1局を含めて3局まで。docs/skill-measure-design.md
        -->
        <template v-if="skillDiagnosis.insufficient && measureNext">
          <p class="shogi-game__measure-rating" data-measure-short>
            <strong>まだ測りきれていません</strong>
            <span>（測れた手 {{ skillDiagnosis.count }}手／{{ MIN_MEASURED_MOVES }}手）</span>
          </p>
          <p>
            {{ (result?.moveCount ?? 0) < 40 ? "対局が短く、測れる手が少なめでした。" : "力の差が大きく、早めに形勢が決まりました。" }}相手の強さを{{ measureNext.level > measureNext.from ? "上げて" : measureNext.level < measureNext.from ? "下げて" : "そのままで" }}もう1局指すと、この対局の手と合わせて診断します。
          </p>
          <button type="button" class="shogi-game__rematch shogi-game__rematch--primary" data-measure-continue @click="continueMeasure">もう1局指す（Lv.{{ measureNext.level }}）</button>
        </template>
        <template v-else-if="skillDiagnosis.insufficient">
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
              <dd>{{ skillDiagnosis.count }}手{{ measureCarry ? `（${measureCarry.games + 1}局分）` : "" }}・平均損失{{ skillDiagnosis.averageLoss }}</dd>
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
        <!--
          はじめての案内から測った人には、竜王戦への道(docs/first-play-design.mdの5-2)。
          よく指している人は「竜王戦に出る」が主ボタン、少し指せる人は「ホームへ」(つぎはこれが練習と大会を勧める)が主ボタン。
        -->
        <template v-if="measureWelcome && showHome && !(skillDiagnosis.insufficient && measureNext)">
          <p class="shogi-game__measure-welcome" data-measure-welcome>{{ measureWelcomeLine }}</p>
          <div class="shogi-game__result-actions">
            <button
              type="button"
              class="shogi-game__rematch"
              :class="{ 'shogi-game__rematch--primary': measureWelcome === 'player' }"
              data-measure-tournament
              @click="enterTournamentFromMeasure"
            >竜王戦に出る</button>
            <button
              type="button"
              class="shogi-game__rematch"
              :class="{ 'shogi-game__rematch--primary': measureWelcome === 'some' }"
              data-measure-home
              @click="leaveFinishedMatch()"
            >ホームへ</button>
          </div>
          <div class="shogi-game__result-actions">
            <button type="button" class="shogi-game__analysis-button" @click="measureReportDismissed = true">棋譜を見る</button>
          </div>
        </template>
        <div v-else class="shogi-game__result-actions">
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
import OpeningPlanSheet, { type OpeningPlanEntry } from "./OpeningPlanSheet.vue";
import TitleDaySheet, { type DaySummaryView, type KansenkiView } from "./TitleDaySheet.vue";
import FormationThumb from "./FormationThumb.vue";
import { ALL_OPENING_PLANS, openingPlanById, openingPlanFor } from "./core/opening-catalog.mjs";
import {
  autoPickPlan,
  loadSeenPlans,
  loadShowAllPlans,
  newlyUnlockedPlans,
  openingUnlocks,
  planCompletedCount,
  saveSeenPlans,
  saveShowAllPlans,
} from "./core/opening-unlocks.mjs";
import { openingFormationGhosts, openingFormationProgress } from "./core/opening-formation.mjs";
import { loadFortunePlans } from "./core/opening-fortune.mjs";
import { mistakeReason, threatAdvice, withMistakeReason } from "./core/coach-reason.mjs";
import { opponentStyleAdvice } from "./core/coach-opponent.mjs";
import { HANANE, HANANE_SPRITE, storyMemberId } from "./core/ryuo-story.mjs";
import { lastGameMilestone } from "./core/ryuo-milestone.mjs";
import {
  formatWinRate,
  midgameMoment,
  newsDue,
  opponentLine,
  opponentMood,
  finishStamp,
  playerWinRate,
  roomComment,
  roundNews,
  traitCard,
} from "./core/match-presence.mjs";
import { byoyomiSeconds } from "./core/byoyomi.mjs";
import {
  closeShoreikaiRun,
  createShoreikaiRun,
  describeShoreikai,
  loadShoreikai,
  mentorCandidates,
  rankLabel as shoreikaiRankLabel,
  recommendedExamRank,
  recordShoreikaiGame,
  retryExam,
  saveShoreikai,
} from "./core/shoreikai.mjs";
import { eventStamp } from "./core/shoreikai-speech.mjs";
import {
  LUNCH_PLY,
  daySummary,
  emptyDay,
  lunchMenu,
  normalizeDay,
  noteDayRate,
  noteDayThink,
  opponentMeal,
  ratePoints,
  roomMembers,
  roomVoices,
  saveKansenki,
  thinkText,
  trimDay,
  unsealCard,
  writeKansenki,
} from "./core/title-day.mjs";
import {
  PLAN_CONFIRM_SEARCH,
  confirmPlanAdvice,
  loadCoachPlans,
  planAdvice,
  planSwingPraise,
  recordCoachPlan,
} from "./core/coach-plan-advice.mjs";
import { tutorialMatchOutcome } from "./core/tutorial-runner.mjs";
import EvaluationGraph from "./EvaluationGraph.vue";
import { useResponsiveLayout } from "./composables/useResponsiveLayout";
import { useAssistTools } from "./composables/useAssistTools";
import DexIcon from "./DexIcon.vue";
import { useBackNavigation } from "./composables/useBackNavigation";
import { WELCOME_CHOICES, WELCOME_MEASURE_LEVEL, WELCOME_SEEN_KEY, markWelcomeSeen, shouldShowWelcome } from "./core/welcome.mjs";
import { VOLUME_2_LAST_LESSON, homeRoadmap, roadmapTile, welcomeChoiceFrom } from "./core/home-roadmap.mjs";
import { loadProblemProgress } from "./core/problem-progress.mjs";
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
import { useByoyomi } from "./composables/match/useByoyomi";
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
import { usePlayInsightAnalysis } from "./composables/match/usePlayInsightAnalysis";
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
import { MAX_MEASURE_GAMES, MIN_MEASURED_MOVES, estimateSkill, measurableMoves, measureStatistics, nextMeasureLevel } from "./core/skill-estimate.mjs";
import { USER_ID, createRng, createSeason, describeSeason, recommendedDifficulty, recordUserGame, scaleById, withRosterAbilities } from "./core/ryuo.mjs";
import { PLAYER_NAME_MAX, loadPlayerName, playerDisplayName, savePlayerName } from "./core/player-name.mjs";
import { USER_HOLDER, applySeasonToRoster, createRoster, loadRoster, saveRoster, withStoryMembers } from "./core/ryuo-roster.mjs";
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
import { addAward, loadAwards, meijinAward, ryuoAward, shoreikaiAward } from "./core/season-award.mjs";
import { STAGE_CARD_MS, describeMatchStage, skyPhase, stageDay, stageSealPly } from "./core/match-stage.mjs";
import { currentAffiliation, grantTitle, loadProfile, saveProfile } from "./core/player-profile.mjs";
import { hasKikiGlasses, loadTutorialProgress } from "./core/tutorial-progress.mjs";
import { kingEscapeMap, unsafeDestinations } from "./core/board-insight.mjs";
import { clearExhibitRecords } from "./core/exhibit-reset.mjs";
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
  coachPortraitSizes,
  coachPortraitSrcset,
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
  formatHintPrincipalVariation,
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
import { chooseAwareMove } from "./core/aware-move-choice.mjs";
import { chooseLogicMove, usesLogicAi } from "./core/logic-ai.mjs";
import { CPU_LOGIC_AI_LEVEL } from "./core/strength-settings.mjs";
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
  openingAvailabilityForColor,
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
import { AI_PIECE_POINTS, CAPTURE_POP_MS, capturePop, materialLabel, aiMaterialTotals } from "./core/piece-points.mjs";
import { FURIGOMA_LAND_AT, createMoveSoundPlayer, loadSoundEnabled, saveSoundEnabled, selectMoveSound } from "./core/move-sound";
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
  dismissLadderNotice,
  isRatedLevel,
  gradeName,
  levelRatingText,
  loadRatingState,
  nextRatingGoal,
  recommendedLevel,
  ratingLevel,
  retrySuggestion,
  saveRatingState,
} from "./core/player-rating.mjs";
import { type PracticeDrill, type PracticeStep, recommendPlay, resultNextStep as resultNextStepFor, tournamentInvite } from "./core/play-coach.mjs";
import { counterStyle, loadCounterKey, ryuoNextPlan, ryuoNextSeasonPlan, saveCounterKey } from "./core/ryuo-next.mjs";
import {
  CLASS_LABELS, applyMeijinSeason, createMeijinSeason, describeMeijinSeason, loadMeijinCareer, loadMeijinSeason, meijinDan,
  recordMeijinGame, resumeMeijinSeason, saveMeijinCareer, saveMeijinSeason, userClass,
} from "./core/meijin.mjs";
import { applyMeijinSeasonToRoster, autoJunniYear, ensureJunniWorld, joinJunni } from "./core/junni-world.mjs";
import { enqueuePlayInsight, loadPlayInsight, recordPractice, savePlayInsight } from "./core/play-insight.mjs";
import { loadReviewProblems } from "./core/review-problems.mjs";
import { dueReviewId, loadReviewQueue } from "./core/review-queue.mjs";
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
import { loadOshi, oshiSeasonResultLine } from "./core/ryuo-oshi.mjs";
import { TESUJI_HINTS, TESUJI_NAMES, detectTesuji } from "./core/move-tesuji.mjs";
import { addRecentGame, loadRecentGames, saveRecentGames } from "./core/recent-games.mjs";
import { currentStreak, loadPlayStreak, recordPlay, savePlayStreak, streakGreeting } from "./core/play-streak.mjs";
import { discoveryPlan, loadSeenFeatures, markFeatureSeen, todayPlan } from "./core/home-extras.mjs";
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
  /** ホームにデータリセットを出す。確認後、記録を消して読み直す。公開game.htmlでは既定で有効。 */
  exhibit: { type: Boolean, default: false },
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
/**
 * 駒の損得の表示(docs/material-guide-design.md)。付けると、状態表示に自分から見た駒の損得を出し、駒を取ったマスに数字を浮かべる。
 * 付け外しは端末に覚える(補助は本人が選ぶ。U:4-1)。
 */
const MATERIAL_GUIDE_KEY = "yacobihime:shogi-match:material-guide:v1";
const materialGuideEnabled = ref((() => {
  try {
    return browserStorage()?.getItem(MATERIAL_GUIDE_KEY) === "1";
  } catch {
    return false;
  }
})());
function toggleMaterialGuide() {
  materialGuideEnabled.value = !materialGuideEnabled.value;
  try {
    if (materialGuideEnabled.value) browserStorage()?.setItem(MATERIAL_GUIDE_KEY, "1");
    else browserStorage()?.removeItem(MATERIAL_GUIDE_KEY);
  } catch {
    // 覚えられなくても、この場では使う。
  }
}
/**
 * 状態表示の駒の損得の札。盤の上と持ち駒の点数(piece-points.mjsのaiMaterialTotals)を、自分と相手で比べる。
 * 二人で指すときは先手から見る。振り返りでは、見ている局面の損得。
 */
const materialChip = computed(() => {
  if (!materialGuideEnabled.value || !matchStarted.value || pregameOpen.value) return null;
  const local = normalizedMode.value === "local";
  const side = local || humanColor.value !== Color.WHITE ? "black" : "white";
  const totals = aiMaterialTotals(currentSfen.value);
  const diff = totals[side] - totals[side === "black" ? "white" : "black"];
  const label = materialLabel(diff);
  const text = diff === 0 ? "駒の損得 ±0" : `${local ? "先手 " : ""}${label.text}`;
  return { text, tone: label.tone, aria: `${local ? "先手から見た" : "あなたから見た"}${text}` };
});
// 学習対局で、選んだ駒の動ける方向を矢印で見せるか。駒を選んだときだけ出るので、学習対局では最初からオンにする。
const movementArrowsEnabled = ref(true);

/** 棋譜の手番号が先手の手か。駒落ちでは上手（後手）から指し始める。 */
function isBlackMoveIndex(index: number) {
  const blackFirst = matchInitialSfen.value.trim().split(/\s+/)[1] !== "w";
  return (index % 2 === 0) === blackFirst;
}

function matchHintAllowance() {
  if (matchKind.value === "tournament") return assistAllowance(Number(tournamentSeasonOf(ryuoGame.value)?.settings?.hintLimit ?? 3));
  return matchKind.value === "learning"
    ? assistAllowance(learningHintLimit.value)
    : Math.max(0, Math.trunc(props.hintCount));
}

function matchUndoAllowance() {
  if (matchKind.value === "tournament") return assistAllowance(Number(tournamentSeasonOf(ryuoGame.value)?.settings?.undoLimit ?? 3));
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
// 図鑑を開いたら、見たことを残す(つぎはこれの「まだ見ていない遊び」に使う)。
watch(dexOpen, (open) => { if (open) noteFeatureSeen("opening-dex"); });
watch(referenceDexKind, (kind) => { if (kind) noteFeatureSeen(kind); });
const referenceDexInitialId = ref("");
/*
 * 図鑑の棚。ホームの「しらべる」と対局中の「図鑑」で同じ並び・同じ絵を使う。
 * 対局中に開いた図鑑は対局の上に重ね、閉じると対局へ戻る。対局のエンジンは借りない(代表局のAI解析は出さない)。
 * 定跡図鑑の戦法占いからは対局を始めない(指している対局が消えるため)。
 */
const DEX_SHELF = [
  { kind: "piece", label: "駒図鑑", desc: "駒の動き" },
  { kind: "tesuji", label: "手筋図鑑", desc: "うまい指し方" },
  { kind: "opening", label: "定跡図鑑", desc: "戦法と囲い" },
  { kind: "world", label: "将棋界図鑑", desc: "棋士とタイトル" },
  { kind: "glossary", label: "用語辞典", desc: "ことばの意味" },
] as const;
type DexKind = (typeof DEX_SHELF)[number]["kind"];
const dexShelfOpen = ref(false);
const dexFromMatch = ref(false);
const dexOverMatch = computed(() => dexFromMatch.value && (dexOpen.value || Boolean(referenceDexKind.value)));
const dexBackLabel = computed(() => (tutorialOpen.value ? "戻る" : dexFromMatch.value ? "対局へ戻る" : "タイトルへ戻る"));
watch(() => dexOpen.value || Boolean(referenceDexKind.value), (open) => { if (!open) dexFromMatch.value = false; });
watch(homeOpen, (open) => { if (open) dexShelfOpen.value = false; });
function openDex(kind: DexKind) {
  openDexFromTutorial({ kind });
}
function openDexShelf() {
  closeSettings();
  closeAssistTools();
  dexShelfOpen.value = true;
  void nextTick(() => {
    (gameRoot.value?.querySelector("[data-dex-shelf] button") as HTMLElement | null)?.focus();
  });
}
function openDexFromMatch(kind: DexKind) {
  dexShelfOpen.value = false;
  dexFromMatch.value = true;
  openDex(kind);
}
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
/** 段級位の作り直しの知らせ。ホームで、はじめての案内が出ていないときに1回だけ出す。 */
const ladderNoticeOpen = computed(() => props.showHome && homeOpen.value && !welcomeOpen.value && Boolean(ratingState.value.ladderNotice));
function dismissLadderNoticeDialog() {
  ratingState.value = dismissLadderNotice(ratingState.value);
  saveRatingState(browserStorage(), ratingState.value);
}
/** 自由対局の中身の記録(core/play-insight.mjs)。見立ての内容の強さと、弱点の練習に使う。 */
const playInsight = ref(loadPlayInsight(browserStorage()));
/** 復習の期日が来た問題と、「あなたの対局から」の問題のID。「つぎはこれ」の練習に使う。タイトル画面を開くたびに読み直す。 */
const homeReviewDueId = ref<string | null>(null);
const homeReviewProblemIds = ref<Set<string>>(new Set());
// プレイヤーのプロフィール(大会で得た称号と成績)。
const profileState = ref(loadProfile(browserStorage()));
// 大会の設定と、進行中の大会。
// 竜王戦(大会)。キャリア(いま何組か、竜王の期数)と、進行中の期は、1局ごとに端末へ保存する。
/** 大会の対局。eventは大会(竜王戦か名人戦)。省くと竜王戦。 */
type MatchStage = NonNullable<ReturnType<typeof describeMatchStage>>;
type RyuoGame = {
  opponentId: string;
  label: string;
  outcome?: "win" | "loss";
  replay?: boolean;
  event?: "ryuo" | "meijin" | "shoreikai";
  /** 対局を始めたときの舞台(docs/match-stage-design.md)。終局後に期が次の局へ進んでも、この局の札のまま。 */
  stage?: MatchStage | null;
  /** タイトル戦(二日制)の記録。勝率・考えた時間・勝負メシ・封じ手(docs/title-match-day-design.md)。 */
  day?: ReturnType<typeof emptyDay>;
};
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
// 前の版で始めた期の棋士には、名簿の能力の配分と使用率を写す(能力は、その期の対局から効く)。
const ryuoSeason = ref<any>(withRosterAbilities(loadSeason(browserStorage()), ryuoRoster.value));
/** いま指している大会の対局。保存した対局と一緒に、リロードしても復元する。 */
const ryuoGame = ref<RyuoGame | null>(null);
/** 大会の対局での、CPUの手ごとの選び方と、働いていた特徴(対局後に、特徴が出た場面を示すため)。 */
let ryuoCpuMoves: { ply: number; kind: string; traits: string[] }[] = [];
const ryuoView = computed(() => (ryuoSeason.value ? describeSeason(ryuoSeason.value) : null));
const ryuoOpponent = computed(() => (ryuoGame.value ? tournamentSeasonOf(ryuoGame.value)?.players?.[ryuoGame.value.opponentId] ?? null : null));
/*
 * 大会の相手を生きて見せる・ほかの対局の速報(docs/tournament-match-presence-design.mdの2章と4章)。
 * 顔の表情は、助言の読みのプレイヤーから見た評価値で決める(助言が「なし」なら、ふつうの顔のまま)。
 */
const PRESENCE_LINE_MS = { speech: 2500, trait: 3500, news: 6000, room: 4000 } as const;
const presenceScore = ref<EngineEvaluation | null>(null);
const presenceLine = ref<{ id: number; kind: "speech" | "trait" | "news" | "room"; tone: string; text: string } | null>(null);
/** 中継(勝率バーと控室の一言)を出すか。設定のメニューで切り替え、端末に覚える。 */
const BROADCAST_KEY = "yacobihime:shogi-match:broadcast:v1";
function loadBroadcastEnabled() {
  try {
    return browserStorage()?.getItem(BROADCAST_KEY) !== "off";
  } catch {
    return true;
  }
}
const broadcastEnabled = ref(loadBroadcastEnabled());
function toggleBroadcast() {
  broadcastEnabled.value = !broadcastEnabled.value;
  try {
    browserStorage()?.setItem(BROADCAST_KEY, broadcastEnabled.value ? "on" : "off");
  } catch {
    // 保存できない環境では、この画面のあいだだけ切り替える。
  }
}
/** 名人戦の空の段(手数で暮れる)。 */
const matchSky = computed(() => skyPhase(moveCount.value));
/** 勝って終局したときの判子。期の結果を記録したときの節目から決める。 */
const FINISH_STAMP_MS = 1200;
const FINISH_STAMP_SOUND_AT = 300;
const finishStampShown = ref<null | { id: number; seal: string; title: string; size: string; confetti: boolean }>(null);
let finishMilestone: ReturnType<typeof lastGameMilestone> = null;
let finishCrowned = false;
let roomSaid: string[] = [];
let roomWinRate: number | null = null;
let presenceTimer: ReturnType<typeof setTimeout> | undefined;
let opponentSaid: string[] = [];
let traitCardsShown: string[] = [];
let matchNews: ReturnType<typeof roundNews> = [];
let matchNewsShown = 0;
const tournamentOpponent = computed(() => (matchStage.value && !reviewMode.value ? ryuoOpponent.value : null));
const opponentFace = computed(() => {
  const opponent = tournamentOpponent.value;
  if (!opponent?.name) return null;
  const attack = opponent.character?.attack ?? 0;
  const mood = opponentMood(presenceScore.value);
  return {
    name: opponent.name,
    char: opponent.name.slice(0, 1),
    tone: attack >= 0.25 ? "attack" : attack <= -0.25 ? "defense" : "balance",
    sprite: opponent.story === HANANE ? `${props.assetBaseUrl}/characters/${HANANE_SPRITE.file}?v=${HANANE_SPRITE.version}` : "",
    mood,
    moodLabel: mood === "confident" ? "余裕の表情" : mood === "troubled" ? "苦しい表情" : "落ち着いた表情",
  };
});
const broadcastShown = computed(() => Boolean(tournamentOpponent.value) && coachLevel.value !== "off" && broadcastEnabled.value);
const broadcastRate = computed(() => playerWinRate(presenceScore.value));
/** 先手の勝率(バーの青い部分)。まだ読んでいないときは半分。 */
const broadcastBlackShare = computed(() => {
  const rate = broadcastRate.value;
  if (rate === null) return 0.5;
  return humanColor.value === Color.WHITE ? 1 - rate : rate;
});
function showPresence(kind: "speech" | "trait" | "news" | "room", text: string, tone = "") {
  if (!text) return;
  // 特殊能力の札は、相手の一言や速報で上書きしない(出ているあいだは待つ)。
  if (presenceLine.value?.kind === "trait" && kind !== "trait") return;
  clearTimeout(presenceTimer);
  presenceLine.value = { id: Date.now(), kind, tone, text };
  presenceTimer = setTimeout(() => { presenceLine.value = null; }, PRESENCE_LINE_MS[kind]);
}
function sayOpponent(moment: "start" | "ahead" | "behind" | "win" | "loss") {
  const opponent = tournamentOpponent.value;
  if (!opponent) return;
  showPresence("speech", `${opponent.name}「${opponentLine(moment, opponent)}」`);
}
function resetPresence() {
  clearTimeout(presenceTimer);
  presenceLine.value = null;
  presenceScore.value = null;
  opponentSaid = [];
  traitCardsShown = [];
  matchNews = [];
  matchNewsShown = 0;
  roomSaid = [];
  roomWinRate = null;
  finishStampShown.value = null;
  finishMilestone = null;
  finishCrowned = false;
}
/** 大会の終局。勝ちは判子を押して1.2秒で結果の窓へ、負けは感想戦を勧める(判子は押さない)。 */
function showFinishStamp(win: boolean, { event, weight }: { event: string; weight: string }) {
  const stamp = finishStamp({ win, milestone: finishMilestone, event, crowned: finishCrowned, weight });
  if (!stamp) {
    if (coachLevel.value !== "off") showCoachAdvice({ key: "tournament-loss-review", text: "悔しいね…。感想戦で、どこが分かれ目だったか見てみよう！" });
    return;
  }
  finishStampShown.value = { id: Date.now(), ...stamp };
  clearTimeout(resultRevealTimer);
  resultRevealTimer = setTimeout(revealResult, FINISH_STAMP_MS);
  setTimeout(() => {
    if (finishStampShown.value) moveSounds.play("stamp");
  }, FINISH_STAMP_SOUND_AT);
}
/** 大会の1局を始めたとき(リロードで戻ったときは、あいさつしない)。 */
function startPresence({ greet = true }: { greet?: boolean } = {}) {
  resetPresence();
  const game = ryuoGame.value;
  if (!game) return;
  matchNews = roundNews({
    event: game.event === "meijin" || game.event === "shoreikai" ? game.event : "ryuo",
    season: tournamentSeasonOf(game),
    oshiId: ryuoOshi.value?.id ?? null,
  });
  if (greet) sayOpponent("start");
  // 大一番とタイトル戦は、控室が「注目の一局」と始める(相手のあいさつのあとに出す)。
  const opening = broadcastShown.value ? roomComment({ ply: 0, winRate: null, weight: matchStage.value?.weight ?? "plain" }) : null;
  if (opening) {
    roomSaid = [opening.key];
    setTimeout(() => {
      if (tournamentOpponent.value) showPresence("room", opening.text);
    }, PRESENCE_LINE_MS.speech);
  }
}
/** 助言の読みの評価値が出たら、相手の表情を変え、形勢が傾いた最初に相手が一言いう。 */
function notePresenceScore(score?: EngineEvaluation | null) {
  if (!tournamentOpponent.value) return;
  presenceScore.value = score ?? null;
  noteTitleDayRate(score ?? null);
  const moment = midgameMoment(score ?? null, opponentSaid);
  if (moment) {
    opponentSaid = [...opponentSaid, moment];
    sayOpponent(moment);
    return;
  }
  noteRoomComment();
}
/** 控室の一言。前に控室が見たときから勝率が10%動いた・中盤や終盤に入った、などを1回ずつ。 */
function noteRoomComment() {
  if (!broadcastShown.value) return;
  const winRate = broadcastRate.value;
  const comment = roomComment({
    ply: moveHistory.length,
    winRate,
    previousWinRate: roomWinRate,
    inCheck: isSideToMoveInCheck(currentSfen.value),
    lastMoveText: record.value.current.displayText ?? "",
    lastMoverIsPlayer: record.value.position.color !== humanColor.value,
    said: roomSaid,
    weight: matchStage.value?.weight ?? "plain",
  });
  roomWinRate = winRate;
  if (!comment) return;
  roomSaid = [...roomSaid, comment.key];
  showPresence("room", comment.text);
}
/** CPUの1手で特殊能力が出たら、札を出す。苦手が出たときは、やこび姫が添える。 */
function notePresenceCpuMove(move: { ply: number; kind: string; traits: string[] }) {
  const opponent = tournamentOpponent.value;
  if (!opponent) return;
  const card = traitCard(move, { character: opponent.character ?? null, name: opponent.name, shown: traitCardsShown });
  if (!card) return;
  traitCardsShown = [...traitCardsShown, card.id];
  showPresence("trait", card.text, card.tier);
  if (card.coach && coachLevel.value !== "off") showCoachAdvice({ key: `opponent-weakness-${card.id}`, text: card.coach });
}
/** プレイヤーの手番が来たら、20手ごとにほかの対局の速報を1件出す。 */
function tickPresenceNews() {
  if (!tournamentOpponent.value) return;
  const item = newsDue(matchNews, moveHistory.length, matchNewsShown);
  if (!item) return;
  matchNewsShown += 1;
  showPresence("news", item.text, item.tone);
}
// 終局したら、相手があいさつする(千日手・持将棋は言わない)。
watch(result, (value) => {
  if (!value || value.winner === null || !tournamentOpponent.value) return;
  sayOpponent(value.winner === humanColor.value ? "loss" : "win");
});
/** いま指している大会の1局の舞台(対局の札・開幕の札・名札の肩書。docs/match-stage-design.md)。 */
const matchStage = computed(() => (matchKind.value === "tournament" && matchStarted.value ? ryuoGame.value?.stage ?? null : null));

// ---- 名人戦(順位戦から名人へ。docs/meijin-design.md)。竜王戦とは別々の暦で進む。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const meijinCareer = ref<any>(loadMeijinCareer(browserStorage()));
// 順位戦の世界は名簿に1つ(docs/player-world-note-design.mdの2章)。前の保存(名人戦のキャリアのleague)は、ここで名簿へ移す。
{
  const migrated = ensureJunniWorld(ryuoRoster.value, meijinCareer.value);
  if (migrated.changed) {
    ryuoRoster.value = migrated.roster;
    meijinCareer.value = migrated.career;
    saveRoster(browserStorage(), ryuoRoster.value);
    saveMeijinCareer(browserStorage(), meijinCareer.value);
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const meijinSeason = shallowRef<any>((() => {
  const saved = loadMeijinSeason(browserStorage());
  return saved ? resumeMeijinSeason(saved) : null;
})());
const meijinView = computed(() => describeMeijinSeason(meijinSeason.value));
/** 次の期(か進行中の期)のプレイヤーのクラス。名人ならmeijin。 */
const meijinEntryClass = computed(() => {
  const season = meijinSeason.value;
  if (season && season.phase !== "done") return season.mode === "defense" ? "meijin" : season.cls;
  const world = ryuoRoster.value?.junni;
  if (!world) return "C2";
  return world.holder === USER_ID ? "meijin" : userClass(world) ?? "C2";
});
/** 羽音のいまの順位戦のクラス(名人戦の入口で「羽音さんも同じクラスだよ」と言うか)。 */
const hananeJunniClass = computed(() => {
  const roster = ryuoRoster.value;
  const id = storyMemberId(roster, HANANE);
  const world = roster?.junni;
  if (!id || !world) return "";
  if (world.holder === id) return "meijin";
  return (Object.entries(world.classes ?? {}) as [string, string[]][]).find(([, ids]) => ids.includes(id))?.[0] ?? "";
});
/** 次の期(か進行中の期)の番号。期の番号は順位戦の世界のもの(名人戦に出る前の自動の期も数える)。 */
const meijinEntryNo = computed(() => (
  meijinSeason.value && meijinSeason.value.phase !== "done" ? meijinSeason.value.no : (ryuoRoster.value?.junni?.no ?? meijinCareer.value.no) + 1
));
/** いまの名人の名前(プレイヤーが名人なら空)。 */
const meijinHolderName = computed(() => {
  const season = meijinSeason.value && meijinSeason.value.phase !== "done" ? meijinSeason.value : null;
  const holder = season?.league?.holder ?? ryuoRoster.value?.junni?.holder ?? null;
  if (!holder || holder === USER_ID) return "";
  return meijinSeason.value?.players?.[holder]?.name ?? ryuoRoster.value?.players?.[holder]?.name ?? "";
});
/** 大会の対局の期(竜王戦・名人戦・奨励会の挑戦)。 */
function tournamentSeasonOf(game: RyuoGame | null) {
  if (game?.event === "shoreikai") return shoreikaiCareer.value.run;
  return game?.event === "meijin" ? meijinSeason.value : ryuoSeason.value;
}
/**
 * 竜王戦の次の相手の対策(学習対局。docs/home-next-adaptive-design.mdの13-5)。レーティングにも竜王戦にも数えない。
 * 相手の棋風と特殊能力・得意戦法で指し、盤の名札に「（対策）」を添える。
 */
const ryuoCounter = ref<{ opponentId: string; label: string; key: string } | null>(null);
const ryuoCounterOpponent = computed(() => (ryuoCounter.value ? ryuoSeason.value?.players?.[ryuoCounter.value.opponentId] ?? null : null));
/** 対策をした次の一局の印(期と次の一局の組)。 */
const ryuoCounterDoneKey = ref(loadCounterKey(browserStorage()));
const tournamentStartAt = ref<"select" | "season" | "meijin" | "ryuo" | "shoreikai">("select");
/** いまの竜王(名簿の竜王。プレイヤーが竜王ならnull)。竜王戦の入口の山で、七番勝負に顔を出す。 */
const ryuoHolder = computed(() => {
  const roster = ryuoRoster.value;
  const player = roster && roster.holder !== USER_HOLDER ? roster.players?.[roster.holder] : null;
  return player ? { id: roster.holder, name: player.name, attack: player.character?.attack ?? 0, story: player.story ?? null } : null;
});
/** 竜王戦の対局から戻ったところ。竜王への道で、前の段から登る動きを見せる。 */
const tournamentFromGame = ref(false);
/** 大会の難易度のおすすめ。1局あたり勝率7割を目安にする難易度。 */
const ryuoDefaultDifficulty = computed(() => recommendedDifficulty(ratingLevel(ratingState.value.rating)));
const tournamentView = ref<{ goBack: () => void } | null>(null);
const noteView = ref<{ goBack: () => boolean } | null>(null);
/** 直近の対局で変動したレーティング。リロードで復元した終局画面では出さない。 */
const ratingChange = ref<{ before: number; after: number; delta: number } | null>(null);
/** 棋力測定の対局か。終局後に自動で棋譜解析を始め、棋力を診断する。 */
const measureMode = ref(false);
/** 棋力測定の結果の表示中(測定対局の終局から、対局準備・ホームへ戻るまで)。 */
const measureSession = ref(false);
/** 棋力測定の解析中。完了ボタンを隠し、「測定中」を表示する。 */
const measureAnalyzing = ref(false);
/**
 * 棋力の測定の進み具合(0〜100)。解析の3段階(全体を確認→怪しい手を読み直し→大事な局面を深読み)を、
 * 時間のかかり方に合わせた幅で1本の棒にまとめる。段階が変わっても棒が戻らない。
 */
const MEASURE_STAGE_SPANS: { [stage: string]: [number, number] } = { scan: [0, 60], review: [60, 85], focus: [85, 100] };
const measureProgressPercent = computed(() => {
  const [from, to] = MEASURE_STAGE_SPANS[analysisStage.value] ?? [0, 0];
  const ratio = analysisTotal.value ? Math.min(1, analysisProgress.value / analysisTotal.value) : 0;
  return Math.round(from + (to - from) * ratio);
});
/** 測定中の札の、いまの段階(例: 全体を確認 1/3)。 */
const measureStepText = computed(() => {
  const keys = Object.keys(MEASURE_STAGE_SPANS);
  const index = keys.indexOf(analysisStage.value);
  if (index < 0) return "準備中…";
  return `${ANALYSIS_STAGE_LABELS[analysisStage.value as keyof typeof ANALYSIS_STAGE_LABELS]}（${index + 1}/${keys.length}）`;
});
/** 測定中の札を閉じたか(「盤を見ながら待つ」)。測定対局が終わるたびに戻す。 */
const measureWaitHidden = ref(false);
/** 測定中に、やこび姫が話すこと(何を測っているか)。順番に替える。 */
const MEASURE_WAIT_TIPS = Object.freeze([
  "1手ごとに、いちばん良い手と比べて、評価値をどれだけ損したかを調べているよ。",
  "損が小さい手が多いほど、強いっていう目安になるんだ。",
  "形勢に大きな差がついたあとの手は、数えないよ。勝負が決まった後の手は、比べにくいからね。",
  "結果は目安だよ。何局か測ると、だんだん本当の棋力に近づくよ。",
]);
const MEASURE_TIP_MS = 6000;
const measureTipIndex = ref(0);
let measureTipTimer: ReturnType<typeof setInterval> | undefined;
watch(measureAnalyzing, (analyzing) => {
  if (measureTipTimer) clearInterval(measureTipTimer);
  measureTipTimer = undefined;
  if (!analyzing) return;
  measureTipIndex.value = 0;
  measureTipTimer = setInterval(() => {
    measureTipIndex.value = (measureTipIndex.value + 1) % MEASURE_WAIT_TIPS.length;
  }, MEASURE_TIP_MS);
});
onBeforeUnmount(() => { if (measureTipTimer) clearInterval(measureTipTimer); });
const measureReportDismissed = ref(false);
/**
 * はじめての案内から始めた棋力測定の答え(少し指せる・よく指している)。測れたら、結果をそのままレーティングにし、
 * 結果の画面に竜王戦への道を出す(docs/first-play-design.mdの5-2)。対局準備・ホームへ戻ると捨てる。
 */
const measureWelcome = ref<"" | "some" | "player">("");
/**
 * 測れる手が足りなかった測定対局から持ち越した手と、その対局の数。次の測定対局の手と合わせて診断する。
 * 測定の対局を続けている間だけ持ち、対局準備・ホームへ戻ると捨てる(docs/skill-measure-design.md)。
 */
const measureCarry = ref<{ moves: { loss: number; standing: number }[]; games: number } | null>(null);
/** 棋力測定以外の解析で、棋力診断を表示するか。「その他」メニューから切り替える。 */
const skillDiagnosisVisible = ref(false);
/** レーティングに近いLvの段級位の表示名。 */
const nearestRatingLabel = computed(() => recommendedStrengthPreset.value.label);
/** レーティングに近いLv(段級位の目安・棋力測定・竜王戦の難易度の初期値に使う)。 */
const recommendedStrengthPreset = computed(() => {
  const level = recommendedLevel(ratingState.value.rating);
  return CPU_STRENGTH_PRESETS.find((preset) => preset.level === level)!;
});
/**
 * 次の対局の見立て(core/play-coach.mjs。docs/home-next-adaptive-design.md)。勝ち越せそうな相手のLvと、勧める理由。
 * 「つぎはこれ」の対局・対局準備のおすすめ・終盤戦の相手に使う。
 */
const playPlan = computed(() => recommendPlay(ratingState.value, {
  insight: playInsight.value,
  reviewDueId: homeReviewDueId.value,
  problemIds: homeReviewProblemIds.value,
  reward: homeReward.value,
  tutorialLessons: homeTutorialProgress.value.lessons,
}));
const playPreset = computed(() => CPU_STRENGTH_PRESETS.find((preset) => preset.level === playPlan.value.level)!);
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
/*
 * 立ち絵は、表示幅に合う大きさの版を読む(スマホ・タブレットの縦向きでは小さい版。core/coach-expression.mjs)。
 * 表示幅を測ってsizesに渡し、画面の倍率と合わせてブラウザに選ばせる。先読みも同じsizesで行う。
 */
const portraitImage = ref<HTMLImageElement | null>(null);
const portraitWidth = ref(0);
const coachPortraitSrcsetValue = computed(() => coachPortraitSrcset(props.assetBaseUrl, coachExpressionFilename(activeCoachText.value)));
const coachPortraitSizesValue = computed(() => coachPortraitSizes(portraitWidth.value));
let portraitObserver: ResizeObserver | undefined;
const selectedStrategy = ref("");
const selectedCastle = ref("");
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
  uiFontPx,
  uiNarrow,
  uiShort,
} = useResponsiveLayout({ analysisVisible });
const assistActions = ref<HTMLElement | null>(null);
const primaryAssistCount = computed(() => {
  let count = 1; // 閃き
  if (reviewMode.value && !guidedReview.value) count += 1; // 感想戦
  if (!reviewMode.value || reviewCpuEnabled.value) count += 1; // 待った
  if (reviewMode.value && !analysisOpen.value) {
    count += 1; // 棋譜解析
    if (!reviewCpuEnabled.value) count += 1; // 対局を振り返る
  }
  return count;
});
const {
  tools: assistTools,
  collapsed: assistToolsCollapsed,
  open: assistToolsOpen,
  close: closeAssistTools,
  sync: syncAssistTools,
} = useAssistTools(assistActions, uiFontPx, primaryAssistCount);
const activeDisplayToolCount = computed(() => Number(boardFlipOverride.value) + Number(attackGuideEnabled.value) + Number(materialGuideEnabled.value));
watch([homeOpen, pregameOpen, reviewMode], () => closeAssistTools());

const resignConfirmOpen = ref(false);
// 中断した対局(保存済み)。ホームの「対局を再開」から続ける。リロードしても残る。
// 竜王戦の対局なら、相手(ryuoOpponentId)も持つ。竜王戦の画面の次の一局の枠からも再開できる。
const suspendedMatch = ref<{ moves: number; ryuoOpponentId: string | null; event?: "ryuo" | "meijin" | "shoreikai" } | null>(null);
const suspendConfirmOpen = ref(false);
/** 中断した対局を消して新しく始める前の確認。承諾したら、保留した開始処理を行う。 */
const discardSuspendedPending = ref<(() => void) | null>(null);
/** プレイヤー名(core/player-name.mjs)。入れていなければ空。 */
const playerName = ref(loadPlayerName(browserStorage()));
const nameDialogOpen = ref(false);
const nameDraft = ref("");
const nameInput = ref<HTMLInputElement | null>(null);
function openNameDialog() {
  nameDraft.value = playerName.value;
  nameDialogOpen.value = true;
  void nextTick(() => nameInput.value?.focus());
}
/** 「この名前にする」。保存し、進めている竜王戦の期の表の名前も替える。 */
function acceptPlayerName() {
  playerName.value = savePlayerName(browserStorage(), nameDraft.value);
  nameDialogOpen.value = false;
  const season = ryuoSeason.value;
  const user = season?.players?.[USER_ID];
  if (season && user) {
    const renamed = { ...season, players: { ...season.players, [USER_ID]: { ...user, name: playerDisplayName(playerName.value) } } };
    ryuoSeason.value = renamed;
    saveSeason(browserStorage(), renamed);
  }
}
/** 賞状帳(core/season-award.mjs、docs/season-award-design.md)。竜王戦・名人戦の期が終わったら、賞状を1枚足す。 */
const seasonAwards = ref(loadAwards(browserStorage()));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function awardRyuoSeason(season: any) {
  seasonAwards.value = addAward(browserStorage(), ryuoAward(season, { playerName: playerDisplayName(playerName.value) }));
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function awardMeijinSeason(season: any) {
  const nextClass = meijinCareer.value.history?.find((entry: { no: number }) => entry.no === season.no)?.next ?? null;
  seasonAwards.value = addAward(browserStorage(), meijinAward(season, { playerName: playerDisplayName(playerName.value), classLabels: CLASS_LABELS, nextClass }));
}
// 賞状帳を作る前に終えて、まだ結果を見ていない期にも、表彰式で賞状を渡す。
if (ryuoSeason.value?.phase === "done" && ryuoSeason.value.result) awardRyuoSeason(ryuoSeason.value);
if (meijinSeason.value?.phase === "done" && meijinSeason.value.result) awardMeijinSeason(meijinSeason.value);
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
  /** 指した手が当たる手筋(move-tesuji.mjs)。手筋の名前でほめるのに使う。 */
  tesuji: string[];
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
    // タイトル戦では、タイトルを持っている相手に段位の代わりに肩書を付ける(「○○ 竜王」)。
    const role = matchStage.value?.opponentRole;
    const rank = role && role !== "挑戦者" ? role : ryuoOpponent.value.dan;
    return `${ryuoOpponent.value.name} ${rank} Lv.${ryuoOpponent.value.level}`;
  }
  if (ryuoCounterOpponent.value) {
    return `${ryuoCounterOpponent.value.name} ${ryuoCounterOpponent.value.dan}（対策） Lv.${ryuoCounterOpponent.value.level}`;
  }
  const name = props.cpuPlayerName.trim() || "CPU";
  return cpuStrengthPreset.value ? `${name} Lv.${cpuStrengthPreset.value.level}` : name;
});
const cpuStrengthLabel = computed(() => (
  (matchKind.value === "tournament" && ryuoOpponent.value) || ryuoCounterOpponent.value ? "" : cpuStrengthPreset.value?.label ?? ""
));
// CPUとの対局では、プレイヤーの側の名札に、タイトル画面で入れたプレイヤー名を出す(入れていなければ先手・後手の表示名)。
// タイトル戦の防衛戦では、プレイヤーの名札にも肩書を付ける(「やこび 竜王」)。
const stageUserName = computed(() => {
  const role = matchStage.value?.userRole;
  return role && role !== "挑戦者" ? `${playerName.value || "あなた"} ${role}` : playerName.value;
});
const effectiveBlackPlayerName = computed(() =>
  cpuColor.value === Color.BLACK
    ? cpuDisplayName.value
    : cpuColor.value === Color.WHITE && stageUserName.value ? stageUserName.value : props.blackPlayerName,
);
const effectiveWhitePlayerName = computed(() =>
  cpuColor.value === Color.WHITE
    ? cpuDisplayName.value
    : cpuColor.value === Color.BLACK && stageUserName.value ? stageUserName.value : props.whitePlayerName,
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
 * 振り駒の知らせ。ホームからすぐ始める対局で、盤の上に歩5枚と先後を短く出す(docs/game-improvement-plan.mdの1-2)。
 * 音が鳴るときは、歩を振る音(約1.9秒)のあいだ駒を揺らし、駒台に撒く音(FURIGOMA_LAND_AT)で表と裏を見せる。
 * 知らせを押すか、どちらかが指すと、振る音を止めて撒く音だけを鳴らし、すぐ結果を見せる(演出は飛ばせる)。
 * 音を消しているときは、振らずにすぐ結果を見せる(待たせない)。盤の操作は妨げない(先手ならすぐ指せる)。
 */
const FURIGOMA_SHOW_MS = 1800;
const furigomaCallout = ref<{ id: number; faces: ("fu" | "to")[]; text: string; phase: "shake" | "land" } | null>(null);
let furigomaTimer: ReturnType<typeof setTimeout> | undefined;
let furigomaShakeAudio: HTMLAudioElement | null = null;
/** 振り始めたときの手数(対局を始めて盤が初期局面に戻る変化は、指した手に数えない)。 */
let furigomaStartPly = 0;
function stopFurigomaShake() {
  furigomaShakeAudio?.pause();
  furigomaShakeAudio = null;
}
function showFurigoma(toss: ReturnType<typeof throwFurigoma>) {
  clearTimeout(furigomaTimer);
  stopFurigomaShake();
  furigomaStartPly = moveCount.value;
  furigomaShakeAudio = moveSounds.play("furigoma");
  const shaking = furigomaShakeAudio !== null;
  furigomaCallout.value = { id: Date.now(), faces: toss.faces, text: furigomaMessage(toss), phase: shaking ? "shake" : "land" };
  furigomaTimer = shaking
    ? setTimeout(() => landFurigoma(), FURIGOMA_LAND_AT)
    : setTimeout(() => { furigomaCallout.value = null; }, FURIGOMA_SHOW_MS);
}
/** 駒を撒いて、表と裏を見せる。skippedなら、振る音を止めて撒く音だけを鳴らす。 */
function landFurigoma({ skipped = false } = {}) {
  const callout = furigomaCallout.value;
  if (!callout || callout.phase !== "shake") return;
  clearTimeout(furigomaTimer);
  if (skipped) {
    stopFurigomaShake();
    moveSounds.play("furigoma-land");
  }
  // 飛ばさなかったときは、振る音がそのまま撒く音まで鳴る。
  furigomaShakeAudio = null;
  furigomaCallout.value = { ...callout, phase: "land" };
  furigomaTimer = setTimeout(() => { furigomaCallout.value = null; }, FURIGOMA_SHOW_MS);
}
// 振っているあいだに指したら(先手のプレイヤー・後手のCPU)、すぐ結果を見せる。
watch(moveCount, (ply) => {
  if (ply > furigomaStartPly) landFurigoma({ skipped: true });
});
/**
 * 大会の舞台の札(docs/match-stage-design.md)。大一番とタイトル戦の開幕に、どの局で何を賭けているかを盤の上に出す。
 * タイトル戦(二日制)は、1日目の終わりの手数を越えて最初にプレイヤーが指した手を封じ手にし、2日目へ進める。
 * どちらも盤の操作は妨げない(盤を触ると消える)。
 */
const stageCard = ref<{ id: number; kind: "opening" | "seal" | "unseal" } | null>(null);
let stageCardTimer: ReturnType<typeof setTimeout> | undefined;
function showStageCard(kind: "opening" | "seal" | "unseal") {
  clearTimeout(stageCardTimer);
  stageCard.value = { id: Date.now(), kind };
  stageCardTimer = setTimeout(hideStageCard, STAGE_CARD_MS);
}
function hideStageCard() {
  clearTimeout(stageCardTimer);
  const sealed = stageCard.value?.kind === "seal";
  stageCard.value = null;
  // 封じ手の札のあとは、2日目の朝の「封じ手の開封」へ続ける(盤を触って閉じたときも)。
  if (sealed && active.value && unsealView.value) showStageCard("unseal");
}
const stageDayText = computed(() => stageDay(matchStage.value, moveCount.value, activePlayerColor.value));
watch(moveCount, (ply, previous) => {
  const stage = matchStage.value;
  if (!stage?.twoDay || reviewMode.value || !active.value) return;
  // 待ったで戻したら、戻した手数より後の記録(封じ手も)を消す。
  if (previous !== undefined && ply < previous) updateTitleDay((day) => trimDay(day, ply));
  if (previous === ply - 1) {
    // 指したのがプレイヤーなら(指したあとは相手の手番)、考えた時間を残す。
    if (thinkStartedAt && record.value.position.color !== humanColor.value) {
      const elapsed = thinkElapsed();
      updateTitleDay((day) => noteDayThink(day, ply, elapsed));
    }
    if (ply === stageSealPly(activePlayerColor.value)) sealTitleDay(ply);
  }
  if (record.value.position.color === humanColor.value) startThink();
  else thinkStartedAt = 0;
});

// ---- タイトル戦の二日制(docs/title-match-day-design.md): 1日目のまとめ・封じ手の開封・勝負メシ・観戦記
/** いまの局の記録。タイトル戦(二日制)だけ。 */
const titleDay = computed(() => (matchStage.value?.twoDay ? ryuoGame.value?.day ?? null : null));
const daySummaryOpen = ref(false);
const kansenkiShown = ref<KansenkiView | null>(null);
/** 終えた局の観戦記(結果の窓の「観戦記を読む」)。 */
const resultKansenki = ref<KansenkiView | null>(null);
/** 控室の第1候補(助言の読みの最善手)。封じ手の前の局面のものを、封じ手予想にする。 */
let roomPick: { ply: number; move: string } | null = null;
function updateTitleDay(change: (day: ReturnType<typeof emptyDay>) => ReturnType<typeof emptyDay>) {
  const game = ryuoGame.value;
  if (!game?.day) return;
  ryuoGame.value = { ...game, day: change(game.day) };
}
function resetTitleDay() {
  roomPick = null;
  daySummaryOpen.value = false;
  kansenkiShown.value = null;
  resultKansenki.value = null;
  startThink();
}
// 考えた時間(手番が来てから指すまで)。画面を隠しているあいだは数えない。
let thinkStartedAt = 0;
let thinkHiddenAt = 0;
let thinkHiddenMs = 0;
function startThink() {
  thinkStartedAt = Date.now();
  thinkHiddenMs = 0;
  thinkHiddenAt = typeof document !== "undefined" && document.hidden ? thinkStartedAt : 0;
}
function thinkElapsed() {
  const now = Date.now();
  return Math.max(0, now - thinkStartedAt - thinkHiddenMs - (thinkHiddenAt ? now - thinkHiddenAt : 0));
}
function onThinkVisibility() {
  if (!thinkStartedAt) return;
  if (document.hidden) thinkHiddenAt = Date.now();
  else if (thinkHiddenAt) {
    thinkHiddenMs += Date.now() - thinkHiddenAt;
    thinkHiddenAt = 0;
  }
}
if (typeof document !== "undefined") document.addEventListener("visibilitychange", onThinkVisibility);
onBeforeUnmount(() => {
  if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onThinkVisibility);
});
/** 手番ごとの勝率(中継と同じ式)を残す。 */
function noteTitleDayRate(score: EngineEvaluation | null) {
  if (!titleDay.value || !score) return;
  const rate = playerWinRate(score);
  if (rate === null) return;
  updateTitleDay((day) => noteDayRate(day, moveHistory.length, rate * 100));
}
/** ply手目の手の言葉(▲4五歩)。usiは、その手数で指した手(か、指さなかった予想の手)。 */
function dayMoveText(ply: number, usi: string) {
  if (!usi || ply < 1) return "";
  try {
    const texts = formatHintPrincipalVariation([...moveHistory.slice(0, ply - 1), usi], matchInitialSfen.value, ply).split(" → ");
    return texts.length === ply ? `${ply % 2 === 1 ? "▲" : "△"}${texts[ply - 1]}` : "";
  } catch {
    return "";
  }
}
const dayFormation = (color: Color) => {
  const text = formationTextForColor(color);
  return text === UNDETERMINED_FORMATION ? "" : text;
};
/** 封じ手。予想・駒の損得・戦型をそのときの形で残し、勝負メシを選んでいなければ1品目にする。 */
function sealTitleDay(ply: number) {
  const move = moveHistory[ply - 1] ?? "";
  const predicted = roomPick && roomPick.ply === ply - 1 ? roomPick.move : "";
  const venue = matchStage.value?.venue ?? "";
  updateTitleDay((day) => ({
    ...day,
    meal: day.meal || lunchMenu(venue)[0],
    seal: { ply, move, predicted, material: playerMaterialBalance(), black: dayFormation(Color.BLACK), white: dayFormation(Color.WHITE) },
  }));
  showStageCard("seal");
}
/** 控室の顔ぶれ(立会人・解説・観戦記者)。名簿の架空の棋士から選ぶ。 */
const dayMembers = computed(() => roomMembers({
  roster: ryuoRoster.value,
  opponentId: ryuoGame.value?.opponentId ?? "",
  oshiId: ryuoOshi.value?.id ?? null,
  seed: `${matchStage.value?.eventText ?? ""}:${matchStage.value?.label ?? ""}`,
}));
const unsealView = computed(() => {
  const seal = titleDay.value?.seal;
  if (!seal) return null;
  const witness = dayMembers.value.witness;
  const predicted = seal.predicted ? dayMoveText(seal.ply, seal.predicted) : "";
  return {
    ...unsealCard({ witness: witness ? `${witness.name}${witness.dan}` : "", moveText: dayMoveText(seal.ply, seal.move), predictedText: predicted }),
    predicted,
  };
});
/** 勝負メシの札。20手を越えたら、選ぶか封じ手まで出す。 */
const lunchOffer = computed(() => {
  const day = titleDay.value;
  if (!day || day.meal || day.seal || !active.value || result.value || moveCount.value <= LUNCH_PLY) return null;
  return lunchMenu(matchStage.value?.venue ?? "");
});
function chooseLunch(meal: string) {
  const venue = matchStage.value?.venue ?? "";
  updateTitleDay((day) => ({ ...day, meal }));
  const opponent = ryuoOpponent.value;
  if (opponent) showPresence("news", `昼食休憩：${opponent.name}さんは${opponentMeal(venue, opponent.id)}を注文`);
  persistMatchState();
}
const daySummaryView = computed<DaySummaryView | null>(() => {
  const day = titleDay.value;
  const stage = matchStage.value;
  const seal = day?.seal;
  if (!day || !stage || !seal) return null;
  const summary = daySummary({ day, untilPly: seal.ply });
  const you = playerDisplayName(playerName.value);
  const opponentName = ryuoOpponent.value?.name ?? "相手";
  const theirMeal = opponentMeal(stage.venue, ryuoGame.value?.opponentId ?? "");
  const longest = summary.longest;
  const longestText = longest ? `${longest.ply}手目 ${dayMoveText(longest.ply, moveHistory[longest.ply - 1] ?? "")}` : "";
  return {
    heading: `${stage.eventText} ${stage.shortLabel ?? stage.label}・封じ手まで${seal.ply}手`,
    venue: stage.venue,
    rate: summary.rate,
    points: ratePoints(summary.rates, seal.ply),
    formationText: seal.black && seal.white ? `先手 ${seal.black} 対 後手 ${seal.white}` : "定跡を離れた力戦",
    materialText: `あなたから見て ${materialLabel(seal.material).text}`,
    thinkText: `合計 ${thinkText(summary.thinkTotal)}${longest && longest.ms >= 30000 ? `・いちばん長いのは${longestText}（${thinkText(longest.ms)}）` : ""}`,
    mealText: day.meal ? `あなた ${day.meal}・${opponentName}さん ${theirMeal}` : "",
    voices: roomVoices({
      summary, members: dayMembers.value, userColor: activePlayerColor.value, formations: { black: seal.black, white: seal.white },
      material: seal.material, userName: you, opponentName, meal: day.meal, opponentMeal: theirMeal, longestText,
    }),
    sealText: dayMoveText(seal.ply, seal.move),
    predictedText: unsealView.value?.predicted ?? "",
  };
});
/** タイトル戦の終局で、観戦記を書いて残す(やこびノートの「大会」で読み返せる)。 */
function writeTitleKansenki(win: boolean, plies: number) {
  const game = ryuoGame.value;
  const stage = matchStage.value;
  const day = titleDay.value;
  if (!game || !stage?.twoDay || !day) return;
  const marks = [...stage.marks, win ? "win" : "loss"];
  const wins = marks.filter((mark) => mark === "win").length;
  const decided = finishMilestone?.kind === "crown" ? (finishMilestone.seal === "防衛" ? "竜王防衛" : "竜王獲得")
    : finishCrowned ? (stage.userRole === "名人" ? "名人防衛" : "名人獲得") : "";
  const label = stage.shortLabel ?? stage.label;
  const text = writeKansenki({
    eventText: stage.eventText, label, venue: stage.venue, userName: playerDisplayName(playerName.value),
    opponentName: ryuoOpponent.value?.name ?? "相手", userColor: activePlayerColor.value,
    formations: { black: dayFormation(Color.BLACK), white: dayFormation(Color.WHITE) }, day,
    opponentMeal: opponentMeal(stage.venue, game.opponentId),
    sealText: day.seal ? dayMoveText(day.seal.ply, day.seal.move) : "",
    predictedText: unsealView.value?.predicted ?? "",
    win, plies, decided, score: `${wins}勝${marks.length - wins}敗`,
    moveText: (ply: number) => dayMoveText(ply, moveHistory[ply - 1] ?? ""),
  });
  const entry = { id: `${stage.eventText}:${label}:${Date.now()}`, at: Date.now(), eventText: stage.eventText, label, venue: stage.venue, win, ...text };
  saveKansenki(browserStorage(), entry);
  resultKansenki.value = entry;
}
onBeforeUnmount(() => clearTimeout(stageCardTimer));
/*
 * 大会の秒読みの演出(エントリー設定の「秒読みの演出」。docs/tournament-match-presence-design.mdの7章)。
 * プレイヤーの手番だけ、自分の名札に残り秒の輪を出す。閃き・図鑑・開幕の札のあいだは止め、0秒でも負けにはしない。
 */
const { byoyomiState } = useByoyomi({
  seconds: () => (matchKind.value === "tournament" ? byoyomiSeconds(tournamentSeasonOf(ryuoGame.value)?.settings) : 0),
  shown: () => active.value && !result.value && !reviewMode.value && normalizedMode.value === "cpu"
    && record.value.position.color === humanColor.value,
  paused: () => thinking.value || guidedMateReplyPending.value || dexFromMatch.value || dexShelfOpen.value || Boolean(stageCard.value)
    || daySummaryOpen.value,
  turnKey: () => moveCount.value,
  play: (kind) => moveSounds.play(kind),
});
const playerCountdown = computed(() => (
  byoyomiState.value ? { color: humanColor.value === Color.BLACK ? "black" as const : "white" as const, ...byoyomiState.value } : null
));
function furigomaPieceUrl(face: "fu" | "to") {
  const name = face === "fu" ? "black_pawn" : "black_prom_pawn";
  return `${props.assetBaseUrl.replace(/\/$/, "")}/piece/${pregamePieceThemeId.value}/${name}.webp`;
}
onBeforeUnmount(() => {
  clearTimeout(furigomaTimer);
  stopFurigomaShake();
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

/** 終局画面の「次の目標」。レーティングが動いた対局(平手の自由対局と竜王戦)だけ出す。 */
const resultNextGoal = computed(() => (ratingChange.value ? nextRatingGoal(ratingState.value.rating) : null));
/** この対局で級・段の目安が上がったら、その名前。 */
const resultGradeUp = computed(() => {
  const change = ratingChange.value;
  if (!change || change.after <= change.before) return "";
  const labelOf = (rating: number) => CPU_STRENGTH_PRESETS.find(({ level }) => level === recommendedLevel(rating))?.label ?? "";
  const after = labelOf(change.after);
  return after !== labelOf(change.before) ? gradeName(after) : "";
});
/**
 * 勝ったときの次の一歩(core/play-coach.mjsのresultNextStep)。平手の通常対局で勝ったら1つ上、香落ちで勝ったら平手。
 * 終盤戦・敗着の前から(学習対局の局面から)は今のまま「もう一局」。
 */
const resultNextStep = computed(() => {
  if (!result.value?.winner || result.value.winner !== humanColor.value || ryuoGame.value) return null;
  const level = cpuStrengthLevel();
  // 立て直しの駒落ち(香落ち・飛車落ち)で勝ったら、次は平手で。
  const retryHandicap = matchKind.value === "learning" && learningStartType.value === "handicap" && learningHandicapGiver.value === "cpu"
    ? ({ lance: "香落ち", rook: "飛車落ち" } as { [id: string]: string })[learningHandicapId.value] ?? ""
    : "";
  const rated = Boolean(ratingChange.value);
  // Lv0(練習相手)は、平手の通常対局のときだけ、勝ったら15級へ(学習対局のLv0は今のまま)。
  if (level === 0 && !retryHandicap && matchKind.value !== "normal") return null;
  return resultNextStepFor({
    won: true, rated, level, handicapLabel: retryHandicap, firstWin: rated && level !== undefined && (ratingState.value.levels?.[level]?.wins ?? 0) === 1,
  });
});
/** 同じLvに続けて負けたときの、選べる提案(強さを2つ下げる・香落ち)。自動では変えない。 */
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
// アヒル囲い・右玉のように戦法と囲いが一体の定義を選んだら、相方は選べなくする。
const strategySelectLocked = computed(() => isStandaloneOpening(selectedCastle.value, "castle"));
const castleSelectLocked = computed(() => isStandaloneOpening(selectedStrategy.value, "strategy"));
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

/** 作戦カードの名前。カードに名前がなければ戦法の名前(囲いだけのカードは囲いの名前)。 */
function openingPlanTitle(plan: { name?: string; strategyId: string; castles: readonly string[] }) {
  return plan.name
    ?? OPENING_STRATEGIES.find(({ id }) => id === plan.strategyId)?.label
    ?? OPENING_CASTLES.find(({ id }) => id === plan.castles[0])?.label
    ?? "";
}

function selectedOpeningLabel() {
  const strategy = OPENING_STRATEGIES.find(({ id }) => id === selectedStrategy.value)?.label;
  const castle = OPENING_CASTLES.find(({ id }) => id === selectedCastle.value)?.label;
  return [strategy, castle].filter(Boolean).join("＋");
}

function announceOpeningGuide() {
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
const CASTLE_LABELS = new Set(COLLECTION_CATALOG.filter(({ kind }) => kind === "castle").map(({ label }) => label));
const matchFormationNames = new Set<string>();
const matchTesuji = new Set<string>();
let matchGodMoves = 0;
const collectionResult = ref<{
  gained: { kind: "strategy" | "castle" | "tesuji" | "level"; label: string; detail: string }[];
  repeated: string[];
  themes: string[];
  next: { need: number; remaining: number } | null;
  // この対局で新しく使えるようになった作戦カード(やこび姫補助)の名前。
  plans: string[];
} | null>(null);
function recordCollection(won: boolean) {
  collectionResult.value = null;
  if (normalizedMode.value !== "cpu") return;
  for (const name of formationNamesFromState(formationState.value, playerColorKey.value)) matchFormationNames.add(name);
  const level = cpuStrengthLevel();
  const before = loadCollection(browserStorage());
  const recorded = recordMatchCollection(before, {
    formations: [...matchFormationNames],
    tesuji: [...matchTesuji],
    tesujiNames: TESUJI_NAMES,
    wonLevel: won && ratingChange.value && level !== undefined ? level : null,
    godMoves: matchGodMoves,
    catalog: COLLECTION_CATALOG,
  });
  saveCollection(browserStorage(), recorded.state);
  type PlanFormations = { [label: string]: { count: number } };
  const newPlans = newlyUnlockedPlans(
    planUnlocksFor(before.formations as PlanFormations),
    planUnlocksFor(recorded.state.formations as PlanFormations),
  )
    .filter(({ group }) => group !== "castle");
  planCollectionVersion.value += 1;
  collectionResult.value = {
    plans: newPlans.map(openingPlanTitle),
    // 初めて手に入った形には、どんな形かを一言添える(何が良かったかを伝える称賛にする)。
    gained: recorded.gained.map((gain) => ({ ...gain, detail: collectionGainDetail(gain) })),
    repeated: recorded.repeated,
    themes: newlyUnlockedThemes(before, recorded.state).map(({ kind, id }) => `${kind === "board" ? "盤" : "駒"}「${themeName(kind, id)}」`),
    next: recorded.gained.length ? nextThemeUnlock(recorded.state) : null,
  };
}
/** 増えた作戦の名前。多いときは3つまで並べて、残りは数で言う。 */
function newPlansText(names: string[]) {
  const shown = names.slice(0, 3).join("・");
  return names.length > 3 ? `${shown}ほか${names.length - 3}つの作戦` : shown;
}
/** 初めて手に入った形の一言。戦法・囲いは定跡図鑑の解説、手筋は手筋の一言から。 */
function collectionGainDetail(gain: { kind: string; label: string }) {
  if (gain.kind === "tesuji") {
    const id = Object.entries(TESUJI_NAMES).find(([, name]) => name === gain.label)?.[0];
    return id ? TESUJI_HINTS[id as keyof typeof TESUJI_HINTS] : "";
  }
  if (gain.kind === "strategy" || gain.kind === "castle") {
    const entry = COLLECTION_CATALOG.find(({ label }) => label === gain.label);
    return entry ? openingExplanation(entry.id)?.overview ?? "" : "";
  }
  return "";
}
/** 終局画面の「この対局で手に入った印」。初めてのものだけ一言にし、前にも組んだものは名前を並べる。 */
function collectionGainText(gain: { kind: string; label: string }) {
  if (gain.kind === "level") return `${gain.label}にはじめて勝った！`;
  return gain.kind === "tesuji" ? `${gain.label}をはじめて指した！` : `${gain.label}をはじめて組んだ！`;
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

const learningFormationResult = computed(() => {
  if (matchKind.value !== "learning" || learningStartType.value !== "formation") return null;
  const playerColor = selectedPlayerColor.value === "white" ? "white" : "black";
  const opponentColor = playerColor === "black" ? "white" : "black";
  return buildFormationStart({
    [playerColor]: { strategyId: learningPlayerStrategy.value, castleId: learningPlayerCastle.value },
    [opponentColor]: { strategyId: learningOpponentStrategy.value, castleId: learningOpponentCastle.value },
  });
});
/*
 * 教室の見える化を対局でも同じ見た目で出す(docs/nyumon-mode-design.mdの14章)。対局の種類(学習・通常・竜王戦)は問わない。
 * - 利きメガネ(教室で手に入れる道具)を持っていて、「駒の利き」を付けているとき、駒を選ぶと取られるマスに赤い輪を出す。
 * - 「駒の利き」を付けているとき、自分の玉が王手されたら、玉の逃げ道(緑)と相手の利き(×)を出す。
 * - 詰んだ局面を見ているとき(終局後・検討中)は、詰んだ玉のまわりに印を出す(詰みの理由)。
 */
const ownsKikiGlasses = ref(hasKikiGlasses(loadTutorialProgress(browserStorage())));
const attackGuideVisible = computed(() => (
  attackGuideEnabled.value && matchStarted.value && !pregameOpen.value
));
const boardRiskDestinations = computed(() => {
  if (!attackGuideVisible.value || !ownsKikiGlasses.value || reviewMode.value) return null;
  const sfen = currentSfen.value;
  return (source: string) => unsafeDestinations(sfen, source);
});
const boardEscapeMarks = computed(() => {
  if (!matchStarted.value || pregameOpen.value) return [];
  const position = createGameRecord(currentSfen.value).position;
  if (!position.checked) return [];
  const turn = position.color === Color.BLACK ? "black" : "white";
  const mated = enumerateLegalMoves(position).length === 0;
  const ownKingInCheck = attackGuideVisible.value && !reviewMode.value && position.color === humanColor.value;
  if (!mated && !ownKingInCheck) return [];
  return (kingEscapeMap(currentSfen.value, turn)?.squares ?? []).flatMap(({ square, state }) => {
    const tone = state === "open" ? "key" : state === "covered" ? (turn === "white" ? "covered" : "danger") : "";
    return tone ? [{ file: Number(square[0]), rank: square.charCodeAt(1) - 96, tone: tone as "key" | "covered" | "danger" }] : [];
  });
});

/*
 * 囲い完成の知らせ。対CPUの対局で、プレイヤーが定跡図鑑の囲いを完成させた瞬間に出す。1局で同じ囲いは1回だけ。
 * 初めての囲いなら、終局後にコレクションの印がつくことを添える。
 */
const CASTLE_CALLOUT_MS = 1600;
const castleCallout = ref<{ id: number; label: string; first: boolean } | null>(null);
let castleCalloutTimer: ReturnType<typeof setTimeout> | undefined;
function showCastleCallout(label: string) {
  const first = !loadCollection(browserStorage()).formations?.[label];
  clearTimeout(castleCalloutTimer);
  castleCallout.value = { id: Date.now(), label, first };
  castleCalloutTimer = setTimeout(() => { castleCallout.value = null; }, CASTLE_CALLOUT_MS);
}

const boardAttackMarks = computed(() => (
  attackGuideVisible.value ? attackMap(currentSfen.value) : []
));
const learningStartBlocked = computed(() => (
  learningFormationResult.value !== null && !learningFormationResult.value.ok
));
// 平手以外の開始局面では、平手用の定跡（やこび姫補助・CPUの定跡）を当てはめない。
const openingGuideAvailable = computed(() => matchInitialSfen.value === STANDARD_SFEN);
/** 通常対局で作戦を選んでいないあいだは、補助の欄を1行のボタンにたたむ。学習対局ではいつも開く。 */
const openingGuideCollapsed = computed(() =>
  openingGuideAvailable.value &&
  matchKind.value !== "learning" &&
  !selectedStrategy.value &&
  !selectedCastle.value
);
const pregameUsesCustomStart = computed(() => (
  matchKind.value === "learning" && learningStartType.value !== "standard"
));

// ===== 作戦カード(docs/opening-guide-ux-design.md) =====
/** 開いている作戦カードのシート。対局準備から開くか、対局中の補助の欄から開くか。 */
const planSheet = ref<"" | "pregame" | "game" | "cpu">("");
const showAllPlans = ref(loadShowAllPlans(browserStorage()));
/** もう見た作戦(NEWを外す)。まだ一度もシートを開いていなければnull。 */
const seenPlanIds = ref<Set<string> | null>(loadSeenPlans(browserStorage()));
/** 対局で形を完成させたら読み直す(コレクションの印から解放を計算するため)。 */
const planCollectionVersion = ref(0);
/** 戦法占いで出た作戦。まだ使えない段でも使える(占いのごほうび)。 */
const fortunePlanIds = ref<string[]>(loadFortunePlans(browserStorage()));
/** 作戦の助言で「にする」を押した作戦。占いと同じく、まだ使えない段でも使える。 */
const coachPlanIds = ref<string[]>(loadCoachPlans(browserStorage()));
function onFortuneResult() {
  fortunePlanIds.value = loadFortunePlans(browserStorage());
}
/** 初段相当以上の人は、最初から全部の作戦を使える(安全網)。 */
const PLAN_ALL_LEVEL = CPU_STRENGTH_PRESETS.find(({ label }) => label.includes("初段"))?.level ?? 32;
const planFormations = computed(() => {
  void planCollectionVersion.value;
  void pregameOpen.value;
  return loadCollection(browserStorage()).formations as { [label: string]: { count: number } };
});
function planUnlocksFor(formations: { [label: string]: { count: number } }) {
  const ryuoTally = (ratingState.value.events as { [event: string]: { wins: number; losses: number; draws: number } } | undefined)?.ryuo;
  const ryuoGames = ryuoTally ? ryuoTally.wins + ryuoTally.losses + ryuoTally.draws : 0;
  return openingUnlocks({
    formations,
    tutorialProgress: homeTutorialProgress.value,
    ryuoPlayed: ryuoGames > 0 || ryuoCareer.value.seasons > 0,
    welcomeChoice: homeWelcomeChoice.value,
    strong: ratingState.value.games > 0 && recommendedLevel(ratingState.value.rating) >= PLAN_ALL_LEVEL,
    showAll: showAllPlans.value,
    extraIds: [...fortunePlanIds.value, ...coachPlanIds.value],
  });
}
const planUnlocks = computed(() => planUnlocksFor(planFormations.value));

/**
 * 今の局面から組める戦法・囲い。対局準備では、手番の色で使えない戦法(先手だけの戦法など)だけを外す。
 * 対局中は今の補助の欄と同じ判定を、選んでいる相方の作戦に縛られずに行う(カードは戦法と囲いを組で替えるため)。
 */
function planAvailability(context: "pregame" | "game") {
  if (context === "pregame") {
    const color = pregamePlayerColor.value;
    const usable = (definition: (typeof OPENING_STRATEGIES)[number] | (typeof OPENING_CASTLES)[number]) => {
      const colors = openingAvailabilityForColor(definition, color)?.colors;
      return !colors || colors.includes(color);
    };
    return {
      strategies: new Set(OPENING_STRATEGIES.filter(usable).map(({ id }) => id)),
      castles: new Set(OPENING_CASTLES.filter(usable).map(({ id }) => id)),
    };
  }
  const { committedRookStyle, currentFormations, legalMoves, playerIsBlack, playerMoves, sfen } = openingAvailabilityContext.value;
  const available = (kind: "strategy" | "castle") => new Set(availableOpeningDefinitions({
    definitions: kind === "strategy" ? OPENING_STRATEGIES : OPENING_CASTLES,
    kind,
    color: playerIsBlack ? "black" : "white",
    playedMoves: playerMoves,
    moveHistory,
    legalMoves,
    detectedFormations: currentFormations,
    currentSfen: sfen,
    rookStyle: committedRookStyle,
  }).map(({ id }) => id));
  const strategies = available("strategy");
  const castles = available("castle");
  // 選んでいる作戦は、相手を待つ一時的な局面でもカードから消さない。
  if (selectedStrategy.value) strategies.add(selectedStrategy.value);
  if (selectedCastle.value) castles.add(selectedCastle.value);
  return { strategies, castles };
}
function planEntries(context: "pregame" | "game"): OpeningPlanEntry[] {
  const unlocks = planUnlocks.value;
  const formations = planFormations.value;
  const { strategies, castles: castleIds } = planAvailability(context);
  const seen = seenPlanIds.value;
  return ALL_OPENING_PLANS.flatMap((plan) => {
    if (plan.strategyId && !strategies.has(plan.strategyId)) return [];
    const castles = plan.castles.filter((id) => castleIds.has(id));
    // 囲いだけのカードと矢倉のカードは、囲いが組めなければ外す。
    if ((!plan.strategyId || plan.name) && !castles.length) return [];
    const locked = !unlocks.unlocked.has(plan.id);
    return [{
      plan,
      castles,
      locked,
      condition: unlocks.condition(plan.id),
      isNew: !locked && seen !== null && !seen.has(plan.id),
      count: planCompletedCount(plan, formations),
    }];
  });
}
/**
 * CPUの作戦カード。CPUが指せる戦法(cpu-opening-repertoire.mjs)と、CPUの手番の色で使える作戦だけを並べる。
 * 相手の作戦なので、解放の段とは関係なく全部選べる。
 */
const cpuPlanEntries = computed<OpeningPlanEntry[]>(() => {
  const cpuColor = selectedPlayerColor.value === "black" ? "white" : "black";
  const supported = new Set<string>(CPU_OPENING_STRATEGY_IDS);
  const usable = (definition: (typeof OPENING_STRATEGIES)[number] | (typeof OPENING_CASTLES)[number]) => {
    const colors = openingAvailabilityForColor(definition, cpuColor)?.colors;
    return !colors || colors.includes(cpuColor);
  };
  const strategies = new Set(OPENING_STRATEGIES.filter((definition) => supported.has(definition.id) && usable(definition)).map(({ id }) => id));
  const castleIds = new Set(OPENING_CASTLES.filter(usable).map(({ id }) => id));
  return ALL_OPENING_PLANS.flatMap((plan) => {
    if (plan.strategyId && !strategies.has(plan.strategyId)) return [];
    const castles = plan.castles.filter((id) => castleIds.has(id));
    if ((!plan.strategyId || plan.name) && !castles.length) return [];
    return [{ plan, castles, locked: false, condition: "", isNew: false, count: 0 }];
  });
});
const planSheetEntries = computed(() => {
  if (planSheet.value === "cpu") return cpuPlanEntries.value;
  return planSheet.value ? planEntries(planSheet.value) : [];
});
const selectedPlanId = computed(() => openingPlanFor(selectedStrategy.value, selectedCastle.value)?.id ?? "");
const cpuPlanId = computed(() => (
  cpuStrategyDetailsOpen.value ? openingPlanFor(cpuDetailedStrategy.value, cpuDetailedCastle.value)?.id ?? "" : ""
));
/** 作戦の名前。カードの名前があればそれを(「矢倉」)、なければ戦法＋囲い。 */
function openingPairLabel(strategyId: string, castleId: string) {
  const plan = openingPlanFor(strategyId, castleId);
  if (plan?.name && castleId === plan.castles[0]) return plan.name;
  const strategy = OPENING_STRATEGIES.find(({ id }) => id === strategyId)?.label;
  const castle = OPENING_CASTLES.find(({ id }) => id === castleId)?.label;
  return [strategy, castle].filter(Boolean).join("＋");
}
/** 補助の欄・対局準備の行に出す、あなたの作戦の名前。 */
const selectedPlanLabel = computed(() => openingPairLabel(selectedStrategy.value, selectedCastle.value));

function markPlansSeen() {
  const ids = new Set([...(seenPlanIds.value ?? []), ...planUnlocks.value.unlocked]);
  seenPlanIds.value = ids;
  saveSeenPlans(browserStorage(), ids);
}
function openPlanSheet(context: "pregame" | "game" | "cpu") {
  // 初めて開いたときは、いま使える作戦を全部見たことにする(最初からNEWだらけにしない)。
  if (seenPlanIds.value === null) markPlansSeen();
  // 図鑑の戦法占いで出た作戦も、使えるようにしておく。
  onFortuneResult();
  planSheet.value = context;
}
/** コレクションのカードから開くときの、最初に開く作戦のくわしい画面(手順の再生と「この作戦にする」)。 */
const planSheetDetailId = ref("");
/**
 * やこびノートのコレクションのカードから、その作戦のくわしい画面を開く。対局準備の作戦カードとして開くので、
 * 「この作戦にする」で選んで、そのまま対局を始められる。
 */
function openPlanFromNote(planId: string) {
  confirmDiscardSuspended(() => {
    yakobiNoteOpen.value = false;
    closeHome();
    planSheetDetailId.value = planId;
    openPlanSheet("pregame");
  });
}
/** やこびノートのコレクションから、定跡図鑑・手筋図鑑を開く(ノートは閉じる。戻る操作で図鑑から先に閉じられるように)。 */
function openDexFromNote(target: { kind: string; id: string }) {
  yakobiNoteOpen.value = false;
  openDexFromTutorial(target);
}
function closePlanSheet() {
  planSheetDetailId.value = "";
  if (!planSheet.value) return;
  const context = planSheet.value;
  planSheet.value = "";
  // CPUの作戦カードは解放と関係なく全部並べるので、見たことにはしない。
  if (context !== "cpu") markPlansSeen();
}
function togglePlanSwitch(on: boolean) {
  showAllPlans.value = on;
  saveShowAllPlans(browserStorage(), on);
}
function applyPlan(planId: string, castleId: string, context: "pregame" | "game" | "cpu") {
  const plan = openingPlanById(planId);
  if (!plan) return;
  if (context === "cpu") {
    cpuStrategyDetailsOpen.value = true;
    cpuDetailedStrategy.value = plan.strategyId;
    cpuDetailedCastle.value = plan.strategyId && !plan.name ? castleId : plan.castles[0] ?? "";
    cpuOpeningPlan = null;
    return;
  }
  selectedStrategy.value = plan.strategyId;
  selectedCastle.value = plan.strategyId && !plan.name ? castleId : plan.castles[0] ?? "";
  if (context === "game") announceOpeningGuide();
}
function choosePlan(planId: string, castleId: string) {
  const context = planSheet.value || "game";
  closePlanSheet();
  applyPlan(planId, castleId, context);
}
function clearPlan() {
  const context = planSheet.value || "game";
  closePlanSheet();
  selectedStrategy.value = "";
  selectedCastle.value = "";
  if (context === "game") {
    announceOpeningGuide();
    if (coachLevel.value !== "off") guideText.value = "作戦なしで指そう。困ったら、いつでも作戦を選べるよ！";
  }
}
/** CPUの作戦を、大まかな方針(おまかせ・居飛車・振り飛車・奇襲戦法)にする。細かい戦法はCPUが局面を見て選ぶ。 */
function chooseCpuBroadPlan(value: string) {
  closePlanSheet();
  cpuStrategyDetailsOpen.value = false;
  cpuStrategy.value = value;
  cpuOpeningPlan = null;
}
/** 相手が振り飛車と分かっているか。対局中は相手の指し手から、対局準備ではCPUの作戦の指定から。 */
function opponentRangingFor(context: "pregame" | "game") {
  if (context === "pregame") {
    return cpuStrategyDetailsOpen.value
      ? openingDefinitionRookStyle(cpuDetailedStrategy.value, "strategy") === "ranging"
      : cpuStrategy.value === "ranging";
  }
  const playerIsBlack = humanColor.value === Color.BLACK;
  return inferOpeningRookStyle({
    color: playerIsBlack ? "white" : "black",
    playedMoves: moveHistory.filter((_, index) => isBlackMoveIndex(index) !== playerIsBlack),
    currentSfen: currentSfen.value,
  }) === "ranging";
}
/** おまかせ。使える作戦から、やこび姫が1枚を選んで入れる(まだ完成させたことのない作戦を優先)。 */
function autoPickOpeningPlan(context: "pregame" | "game") {
  const entries = planEntries(context).filter(({ locked }) => !locked);
  const picked = autoPickPlan({
    plans: entries.map(({ plan }) => plan),
    formations: planFormations.value,
    opponentRanging: opponentRangingFor(context),
  });
  if (planSheet.value) closePlanSheet();
  if (!picked) return;
  const castles = entries.find(({ plan }) => plan.id === picked.id)?.castles ?? [];
  applyPlan(picked.id, castles[0] ?? "", context);
  if (context === "game" && coachLevel.value !== "off") {
    guideText.value = `やこび姫のおまかせは「${selectedPlanLabel.value}」！盤の矢印と薄い駒を目指して指そう。`;
  }
}

/** 完成形の駒を盤に薄く出すか。保存した選択がなければ、強くなる道の5段目より前の人と学習対局で出す。 */
const PLAN_GHOSTS_KEY = "yacobihime:shogi-match:plan-ghosts:v1";
function loadPlanGhostsPreference() {
  try {
    const value = browserStorage()?.getItem(PLAN_GHOSTS_KEY);
    return value === "on" || value === "off" ? value : "";
  } catch {
    return "";
  }
}
const planGhostsPreference = ref(loadPlanGhostsPreference());
const planGhostsOn = computed(() => (
  planGhostsPreference.value
    ? planGhostsPreference.value === "on"
    : matchKind.value === "learning" || homeRoadmapState.value.current < 5
));
function togglePlanGhosts() {
  planGhostsPreference.value = planGhostsOn.value ? "off" : "on";
  try {
    browserStorage()?.setItem(PLAN_GHOSTS_KEY, planGhostsPreference.value);
  } catch {
    // 保存できない環境では、この画面のあいだだけ切り替える。
  }
}
/** 作戦の進み具合(完成形のうち、もう駒が着いたマス)。完成したら0にする。 */
const planProgress = computed(() => {
  if (!selectedStrategy.value && !selectedCastle.value) return null;
  if (!openingGuideAvailable.value || openingPlanComplete.value) return null;
  return openingFormationProgress({
    strategyId: selectedStrategy.value,
    castleId: selectedCastle.value,
    color: playerColorKey.value,
    sfen: currentSfen.value,
  });
});
const planFilledSquares = computed(() => planProgress.value?.filledSquares ?? null);
const planGhosts = computed(() => {
  if (!planGhostsOn.value || !planProgress.value || reviewMode.value || !active.value) return [];
  return openingFormationGhosts({
    strategyId: selectedStrategy.value,
    castleId: selectedCastle.value,
    color: playerColorKey.value,
    sfen: currentSfen.value,
  });
});
/** 中断したときの「作戦を変えよう」の札。今の局面から近い作戦を、残り手数つきで並べる。 */
const planInterruption = computed(() => {
  if (!openingGuideAvailable.value || reviewMode.value) return null;
  const suggestions = [
    ...strategySuggestions.value.map((entry) => ({ ...entry, kind: "strategy" as const })),
    ...castleSuggestions.value.map((entry) => ({ ...entry, kind: "castle" as const })),
  ].slice(0, 3);
  if (!suggestions.length && !openingGuideAbandoned.value) return null;
  const reason = openingGuideAbandoned.value
    ? "この形へ戻るのは難しそう。"
    : strategySuggestions.value.length
      ? "この戦法は続けられなくなったよ。"
      : "この囲いは組めなくなったよ。";
  return { reason, suggestions };
});
/**
 * 定跡図鑑の戦法占いの結果から対局へ。「この作戦で指す」は通常対局の「あなたの作戦」に入れ、
 * 「完成形から指してみる」は学習対局の完成形から始める。どちらも対局準備で強さなどを決めてから始める。
 */
function playPlanFromDex(planId: string, practice: boolean) {
  const plan = openingPlanById(planId);
  if (!plan) return;
  onFortuneResult();
  // 中断した対局を消す確認はホームの上に出すので、先に図鑑と教室を閉じる。
  dexOpen.value = false;
  openingDexInitialId.value = "";
  tutorialOpen.value = false;
  confirmDiscardSuspended(() => {
    matchKind.value = practice ? "learning" : "normal";
    closeHome();
    if (practice) {
      learningStartType.value = "formation";
      learningPlayerStrategy.value = plan.strategyId;
      learningPlayerCastle.value = plan.castles[0] ?? "";
    } else {
      applyPlan(plan.id, plan.castles[0] ?? "", "pregame");
    }
  });
}
function chooseSuggestedPlan(kind: "strategy" | "castle", id: string) {
  if (kind === "strategy") selectedStrategy.value = id;
  else selectedCastle.value = id;
  announceOpeningGuide();
}

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
  const challenge = preset.level > playPreset.value.level && !beatenLevels.value.has(preset.level);
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

/** あなたの作戦。平手から始める対局で、作戦カードのシートで選ぶ(既定は「なし」)。 */
function playerPlanRows(): PregameRow[] {
  if (pregameUsesCustomStart.value) return [];
  return [{ kind: "plan", id: "playerPlan", label: "あなたの作戦", value: selectedPlanLabel.value || "なし" }];
}

function cpuPlanRows(): PregameRow[] {
  if (pregameUsesCustomStart.value) return [];
  // CPUの作戦は、大まかな方針(おまかせ・居飛車・振り飛車・奇襲戦法)か、作戦カードの1枚を、作戦カードのシートで選ぶ。
  const rows: PregameRow[] = [{
    kind: "pick",
    id: "cpuPlan",
    label: "作戦",
    value: cpuStrategyDetailsOpen.value
      ? openingPairLabel(cpuDetailedStrategy.value, cpuDetailedCastle.value) || optionLabel(CPU_STRATEGY_OPTIONS, cpuStrategy.value)
      : optionLabel(CPU_STRATEGY_OPTIONS, cpuStrategy.value),
  }];
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
    : local ? [] : [...playerPlanRows(), ...learningPlanRows("player")];
  return {
    color,
    label: color === "black" ? "先手" : "後手",
    role: pregameUsesHandicap.value ? (color === "white" ? "上手" : "下手") : "",
    isCpu,
    name: local
      ? (color === "black" ? props.blackPlayerName : props.whitePlayerName)
      : isCpu ? (props.cpuPlayerName.trim() || "CPU") : playerDisplayName(playerName.value),
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
  if (id === "strength") {
    // 41個を、級・段・プロの3つに分けて並べる(docs/level-ladder-design.mdの5章)。同じ名前の段は、Rと成績で見分ける。
    const band = (from: number, to: number) => strengthPickerOptions.value.filter((_, level) => level >= from && level <= to);
    return single("CPUの強さ", searchNodes.value, [
      { label: "級（Lv.0〜15）", options: band(0, 15) },
      { label: "アマ段（Lv.16〜35）", options: band(16, 35) },
      { label: "プロ（Lv.36〜40）", options: band(36, 40) },
    ]);
  }
  if (id === "cpuFirstMove") return single("CPUの初手", cpuFirstMove.value, [{ options: CPU_FIRST_MOVE_OPTIONS }]);
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

/** 対局準備の行の［変更］。作戦の行は作戦カードのシート、ほかは選択シートを開く。 */
function openPregameRow(id: string) {
  if (id === "cpuPlan") openPlanSheet("cpu");
  else pregamePicker.value = id;
}

function onPregamePick(key: string, value: PickerValue) {
  const text = String(value);
  if (key === "strength") searchNodes.value = Number(value);
  else if (key === "cpuFirstMove") cpuFirstMove.value = text;
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
  difficulty: number; scale: number; revival: boolean; coachLevel: string; hintLimit: number; undoLimit: number; byoyomi: number;
}) {
  const career = ryuoCareer.value;
  const entry = nextEntry(career);
  const seed = Date.now();
  if (!ryuoRoster.value) {
    ryuoRoster.value = createRoster({ seed, userGroup: entry.group, userIsChampion: entry.mode === "defense" });
    saveRoster(browserStorage(), ryuoRoster.value);
  } else {
    // 物語の人物(羽音・善彦)がいない、前の版の名簿には、次の期の始めに加える。
    const withStory = withStoryMembers(ryuoRoster.value, { userGroup: entry.group, userIsChampion: entry.mode === "defense" });
    if (withStory !== ryuoRoster.value) {
      ryuoRoster.value = withStory;
      saveRoster(browserStorage(), withStory);
    }
  }
  const season = createSeason({
    ...entry,
    settings: { ...settings, recommended: settings.difficulty === ryuoDefaultDifficulty.value },
    userLevel: ratingLevel(ratingState.value.rating),
    career,
    roster: ryuoRoster.value,
    seed,
    userName: playerDisplayName(playerName.value),
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
  awardRyuoSeason(season);
  // 推しの棋士の、この期の組の順位(ほかの組でも、期の終わりには順位が決まっている)。名簿を進める前に控える。
  const oshiId = loadOshi(browserStorage());
  const oshiBefore = oshiId ? ryuoRoster.value?.players?.[oshiId] ?? null : null;
  const oshiStandings: string[] | undefined = oshiBefore
    ? (oshiBefore.group === season.startGroup && season.mode === "challenge" ? season.standings : season.groupStandings?.[oshiBefore.group])
    : undefined;
  const oshiRank = oshiStandings ? oshiStandings.indexOf(oshiId) : -1;
  if (ryuoRoster.value) {
    ryuoRoster.value = applySeasonToRoster(ryuoRoster.value, season, { userGroup: career.group, promote: scaleById(season.settings.scale).promote });
    // 名人戦に出る前は、棋界の1年で順位戦と名人戦も1期進む(出たあとは、名人戦を指したときだけ進む)。
    ryuoRoster.value = autoJunniYear(ryuoRoster.value, createRng((Number(season.id) ^ 0x5bd1e995) >>> 0)).roster;
    saveRoster(browserStorage(), ryuoRoster.value);
  }
  let profile = profileState.value;
  for (const title of titles) profile = grantTitle(profile, title);
  profileState.value = profile;
  saveProfile(browserStorage(), profile);
  const oshiAfter = oshiBefore ? ryuoRoster.value?.players?.[oshiId] ?? null : null;
  const oshiLine = oshiBefore
    ? oshiSeasonResultLine({
      name: oshiBefore.name,
      beforeGroup: oshiBefore.group,
      afterGroup: oshiAfter ? oshiAfter.group : null,
      rank: oshiRank >= 0 ? oshiRank : null,
      champion: season.champion === oshiId,
    })
    : "";
  ryuoSeason.value = { ...season, applied: true, result: { ...season.result, titles, oshiLine } };
  saveSeason(browserStorage(), ryuoSeason.value);
}

const rawRyuoSeason = () => JSON.parse(JSON.stringify(ryuoSeason.value));

/**
 * 中断した竜王戦の対局が、いまの期の次の一局と同じ相手なら、その手数。竜王戦の画面の次の一局の枠で「対局を再開」にする。
 * ほかの対局を中断しているときはnull(「対局する」で、確認のうえ新しく始める)。
 */
const suspendedRyuoMoves = computed(() => {
  const suspended = suspendedMatch.value;
  const pending = ryuoSeason.value?.pending;
  return suspended?.ryuoOpponentId && (suspended.event ?? "ryuo") === "ryuo" && pending && suspended.ryuoOpponentId === pending.opponentId ? suspended.moves : null;
});
/** 名人戦の画面で「対局を再開」を押したとき。 */
function resumeMeijinGame() {
  tournamentOpen.value = false;
  resumeSuspendedMatch();
}
/** 竜王戦の画面で「対局を再開」を押したとき。大会の画面を閉じて、中断した対局を続ける(VS画面は出さない)。 */
function resumeRyuoGame() {
  tournamentOpen.value = false;
  resumeSuspendedMatch();
}

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
  const season = tournamentSeasonOf(ryuoGame.value);
  const pending = season?.pending;
  const opponent = pending ? season.players[pending.opponentId] : null;
  if (!pending || !opponent) return;
  matchInitialSfen.value = props.initialSfen;
  selectedPlayerColor.value = pending.color;
  activePlayerColor.value = pending.color;
  learningStartLabel.value = "";
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
  const game: RyuoGame = ryuoGame.value ?? { opponentId: opponent.id, label: "" };
  const event = game.event === "meijin" || game.event === "shoreikai" ? game.event : "ryuo";
  const stakesView = event === "shoreikai" ? shoreikaiView.value : event === "meijin" ? meijinView.value : ryuoView.value;
  const stage = describeMatchStage({
    event,
    season,
    label: game.label,
    userName: playerName.value,
    stakes: stakesView?.pending?.stakes ?? null,
  });
  ryuoGame.value = { ...game, outcome: undefined, replay: false, stage, day: stage?.twoDay ? emptyDay() : undefined };
  resetTitleDay();
  ryuoCpuMoves = [];
  matchStarted.value = true;
  pregameOpen.value = false;
  scheduleDeferredCoachPortraitPreload();
  restart();
  startPresence();
  // 大一番とタイトル戦は、開幕の札とやこび姫の一言で始める。ふだんの1局は、相手の棋風と特殊能力から戦い方を一言。
  const opponentLine = opponentStyleAdvice(opponent.character, opponent.name);
  if (stage?.coachLine && coachLevel.value !== "off") guideText.value = stage.coachLine;
  // 最初の形勢の一言に上書きされないよう、助言の順番待ちを通して6秒は見せる。
  else if (opponentLine && coachLevel.value !== "off") showCoachAdvice(opponentLine);
  if (stage && stage.weight !== "plain") showStageCard("opening");
  // 対局準備で選んだ作戦は、始めた瞬間にやこび姫が目指す形を伝える。
  if (openingGuideAvailable.value && (selectedStrategy.value || selectedCastle.value)) announceOpeningGuide();
}

/**
 * 竜王戦の次の相手の対策(docs/home-next-adaptive-design.mdの13-5)。相手のLv・棋風・特殊能力と、相手の手番でいちばん多い戦法で、
 * 本番と同じ手番の学習対局を始める。レーティングにも竜王戦にも数えない。対策をしたことは、次の一局の印で覚える。
 */
function startRyuoCounter() {
  const season = ryuoSeason.value;
  const pending = ryuoView.value?.pending;
  const opponent = pending ? season?.players?.[pending.opponentId] : null;
  if (!season || !pending || !opponent) return;
  confirmDiscardSuspended(() => {
    yakobiNoteOpen.value = false;
    tournamentOpen.value = false;
    openPregame();
    settingsBeforePractice = captureMatchSettings();
    homeOpen.value = false;
    void initializeEngine();
    matchKind.value = "learning";
    learningStartType.value = "standard";
    coachLevel.value = ["off", "encourage", "detailed"].includes(season.settings.coachLevel) ? season.settings.coachLevel : "detailed";
    const color = pending.color === "white" ? "white" : "black";
    // 本番と同じく、自分の作戦の指定はしない(作戦カードは対局中に開ける)。
    selectedStrategy.value = "";
    selectedCastle.value = "";
    const plan = homeRyuoPlan.value;
    ryuoCounter.value = { opponentId: opponent.id, label: pending.label ?? "", key: plan?.key ?? "" };
    if (plan?.key) {
      ryuoCounterDoneKey.value = plan.key;
      saveCounterKey(browserStorage(), plan.key);
    }
    selectedPlayerColor.value = color;
    searchNodes.value = CPU_STRENGTH_PRESETS.find(({ level }) => level === opponent.level)?.value ?? DEFAULT_STRENGTH_VALUE;
    cpuStrategy.value = "random";
    cpuFirstMove.value = "random";
    cpuBishopPreference.value = "";
    cpuRookPreference.value = "";
    cpuTempoPreference.value = "";
    const style = counterStyle(ryuoView.value?.pending?.opponent ?? opponent, color)?.style ?? null;
    cpuStrategyDetailsOpen.value = Boolean(style);
    if (style) {
      cpuDetailedStrategy.value = style.strategy;
      cpuDetailedCastle.value = style.castle;
    }
    beginMatch();
  });
}
/** 竜王戦の期の画面を開く(つぎはこれの「続きを指す」、対策の終局の「本番へ」)。 */
function openRyuoSeasonScreen() {
  tournamentStartAt.value = ryuoSeason.value?.pending ? "season" : "select";
  tournamentFromGame.value = false;
  tournamentOpen.value = true;
  if (ryuoSeason.value?.analysisQueue?.length) void ryuoStats.processQueue();
}
/** 対策の対局を終えて、本番(竜王戦の期の画面)へ。 */
function goToRyuoFromCounter() {
  leaveFinishedMatch();
  openRyuoSeasonScreen();
}

/** 終局を大会に記録する。勝敗は、トーナメント表を進める。千日手(引き分け)は、先後を入れ替えて指し直す。 */
function recordRyuoOutcome(matchResult: MatchResult) {
  if (ryuoGame.value?.event === "shoreikai") {
    recordShoreikaiOutcome(matchResult);
    return;
  }
  if (ryuoGame.value?.event === "meijin") {
    recordMeijinOutcome(matchResult);
    return;
  }
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
  finishMilestone = lastGameMilestone(next, { promote: scaleById(next.settings.scale).promote });
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
  storage: browserStorage,
  onInsight: (insight) => { playInsight.value = insight; },
});

// ---- 自由対局の中身の記録のための、裏の解析(docs/home-next-adaptive-design.mdの5章)。対局中は止める。
const playInsightAnalysis = usePlayInsightAnalysis({
  storage: browserStorage,
  engineFactory: ensureEngineFactory,
  compact: () => props.mobile || boardLayout.value === "portrait",
  paused: () => active.value,
  onUpdated: (insight) => { playInsight.value = insight; },
});

/** 結果の画面を見終えた。次に竜王戦を選ぶと、次の期のエントリーになる。 */
function markRyuoResultSeen() {
  const season = ryuoSeason.value;
  if (!season || season.resultSeen) return;
  ryuoSeason.value = { ...season, resultSeen: true };
  saveSeason(browserStorage(), ryuoSeason.value);
}

/** 大会の対局の終局画面の文(竜王戦か名人戦)。 */
const tournamentResult = computed(() => {
  if (ryuoGame.value?.event === "shoreikai") {
    const view = shoreikaiView.value;
    const phase = view?.phase;
    const done = phase === "pro" || phase === "retired" || phase === "failed";
    return {
      done,
      doneText: phase === "pro" ? "四段昇段！ プロ棋士になりました！" : phase === "failed" ? "入会試験は不合格でした。すぐに受け直せます。" : "奨励会を退会しました。",
      next: view?.pending?.label ?? "",
      back: "奨励会へ戻る",
    };
  }
  if (ryuoGame.value?.event === "meijin") {
    const view = meijinView.value;
    return {
      done: Boolean(view?.result),
      doneText: view?.result?.outcome === "meijin" ? "名人になりました！" : "この期の対局は、すべて終わりました。",
      next: view?.pending?.label ?? "",
      back: "名人戦へ戻る",
    };
  }
  return {
    done: Boolean(ryuoView.value?.result),
    doneText: ryuoView.value?.result?.outcome === "champion" ? "竜王になりました！" : "この期の対局は、すべて終わりました。",
    next: ryuoView.value?.pending?.label ?? "",
    back: "竜王戦へ戻る",
  };
});

/** 大会の対局から離れて、トーナメント表(大会の画面)へ戻る。 */
function leaveToTournamentScreen() {
  leaveFinishedMatch();
}

/** 千日手の指し直し。先後を入れ替えて、同じ相手と指す。 */
function replayRyuoGame() {
  startRyuoMatch();
}

// ---- 名人戦の期と対局
/** 名人戦の期を始める(大会の画面の「出場する」)。名簿がなければ作る(竜王戦と同じ名簿を使う)。 */
function enterMeijinSeason(settings: { difficulty: number; scale: string; coachLevel: string; hintLimit: number; undoLimit: number; byoyomi: number }) {
  const seed = Date.now();
  if (!ryuoRoster.value) {
    ryuoRoster.value = createRoster({ seed, userGroup: ryuoCareer.value.group });
    saveRoster(browserStorage(), ryuoRoster.value);
  }
  // 順位戦の世界にプレイヤーを入れる(初めてならC級2組の最後)。期は世界の写しで指し、終わったら名簿へ書き戻す。
  const migrated = ensureJunniWorld(ryuoRoster.value, meijinCareer.value);
  ryuoRoster.value = joinJunni(migrated.roster);
  saveRoster(browserStorage(), ryuoRoster.value);
  const career = migrated.career;
  const world = ryuoRoster.value.junni;
  meijinSeason.value = createMeijinSeason({
    no: (world.no ?? 0) + 1, league: world, roster: ryuoRoster.value, settings: { ...settings, recommended: settings.difficulty === ryuoDefaultDifficulty.value },
    userLevel: ratingLevel(ratingState.value.rating), userName: playerDisplayName(playerName.value), userDan: meijinDan(career), seed,
  });
  saveMeijinSeason(browserStorage(), meijinSeason.value);
  meijinCareer.value = { ...career, settings: { ...settings, recommended: settings.difficulty === ryuoDefaultDifficulty.value } };
  saveMeijinCareer(browserStorage(), meijinCareer.value);
}
/** 名人戦の期の結果を見終えた。次に名人戦を選ぶと、次の期の入口になる。 */
function markMeijinResultSeen() {
  const season = meijinSeason.value;
  if (!season || season.resultSeen) return;
  meijinSeason.value = { ...season, resultSeen: true };
  saveMeijinSeason(browserStorage(), meijinSeason.value);
}
function startMeijinGame() {
  confirmDiscardSuspended(startMeijinGameNow);
}
function startMeijinGameNow() {
  const season = meijinSeason.value;
  const pending = season?.pending;
  if (!season || !pending) return;
  tournamentOpen.value = false;
  openPregame();
  matchKind.value = "tournament";
  homeOpen.value = false;
  void initializeEngine();
  coachLevel.value = ["off", "encourage", "detailed"].includes(season.settings.coachLevel) ? season.settings.coachLevel : "detailed";
  ryuoGame.value = { opponentId: pending.opponentId, label: pending.label ?? "", event: "meijin" };
  startRyuoMatch();
}
/** 名人戦の終局を期に記録する。千日手は、先後を入れ替えて指し直す。期が終わったら、キャリアに足す。 */
function recordMeijinOutcome(matchResult: MatchResult) {
  const game = ryuoGame.value;
  const season = meijinSeason.value;
  if (!game || !season?.pending) return;
  if (!matchResult.winner) {
    const next = structuredClone(season);
    next.pending.color = next.pending.color === "black" ? "white" : "black";
    meijinSeason.value = next;
    saveMeijinSeason(browserStorage(), next);
    ryuoGame.value = { ...game, replay: true };
    return;
  }
  const outcome = matchResult.winner === humanColor.value ? "win" : "loss";
  const next = recordMeijinGame(season, outcome);
  finishCrowned = outcome === "win" && season.pending.kind === "finals" && next.phase === "done" && next.finals?.winner === USER_ID;
  meijinSeason.value = next;
  saveMeijinSeason(browserStorage(), next);
  ryuoGame.value = { ...game, outcome, replay: false };
  if (next.phase === "done") {
    meijinCareer.value = applyMeijinSeason(meijinCareer.value, next);
    saveMeijinCareer(browserStorage(), meijinCareer.value);
    awardMeijinSeason(next);
    // 順位戦の世界を1期進めて名簿へ書き戻す(名人・クラス・対戦成績。名鑑と竜王戦の紹介も同じ世界を読む)。
    if (ryuoRoster.value) {
      ryuoRoster.value = applyMeijinSeasonToRoster(ryuoRoster.value, next);
      saveRoster(browserStorage(), ryuoRoster.value);
    }
  }
}
/** 中断した名人戦の対局が、いまの期の次の一局と同じ相手なら、その手数。 */
const suspendedMeijinMoves = computed(() => {
  const suspended = suspendedMatch.value;
  const pending = meijinSeason.value?.pending;
  return suspended?.event === "meijin" && suspended.ryuoOpponentId && pending && suspended.ryuoOpponentId === pending.opponentId ? suspended.moves : null;
});

// ---- 奨励会(docs/shoreikai-design.md)。入会試験から四段まで。挑戦(run)は1つずつ、端末に保存する(竜王戦・名人戦とは別の暦)。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const shoreikaiCareer = shallowRef<any>(loadShoreikai(browserStorage()));
const shoreikaiView = computed(() => describeShoreikai(shoreikaiCareer.value.run));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setShoreikaiCareer(career: any) {
  shoreikaiCareer.value = career;
  saveShoreikai(browserStorage(), career);
}
/** 推薦してくれる師匠の候補(竜王戦の名簿の年長の棋士から3人。挑戦のたびに変わる)。 */
const shoreikaiMentors = computed(() => mentorCandidates(ryuoRoster.value, (shoreikaiCareer.value.history?.length ?? 0) + 1));
/** おすすめの受験級(いまの棋力から)。 */
const shoreikaiRecommendedRank = computed(() => recommendedExamRank(ratingLevel(ratingState.value.rating)));
/** 中断した奨励会の対局が、いまの次の一局と同じ相手なら、その手数。 */
const suspendedShoreikaiMoves = computed(() => {
  const suspended = suspendedMatch.value;
  const pending = shoreikaiCareer.value.run?.pending;
  return suspended?.event === "shoreikai" && suspended.ryuoOpponentId && pending && suspended.ryuoOpponentId === pending.opponentId ? suspended.moves : null;
});
/** 入口の「受験する」。師匠の候補を出すため、名簿がなければ作る(竜王戦・名人戦と同じ名簿)。 */
function enterShoreikai({ settings, examRank, mentorId }: { settings: { [key: string]: unknown }; examRank: number; mentorId: string }) {
  if (!ryuoRoster.value) {
    ryuoRoster.value = createRoster({ seed: Date.now(), userGroup: ryuoCareer.value.group });
    saveRoster(browserStorage(), ryuoRoster.value);
  }
  const mentor = shoreikaiMentors.value.find((item) => item.id === mentorId) ?? shoreikaiMentors.value[0] ?? null;
  const run = createShoreikaiRun({
    seed: Date.now(),
    settings: { ...settings, recommended: settings.difficulty === ryuoDefaultDifficulty.value },
    examRank,
    mentor,
    userName: playerDisplayName(playerName.value),
    userLevel: ratingLevel(ratingState.value.rating),
  });
  setShoreikaiCareer({ ...shoreikaiCareer.value, settings: { ...settings }, run });
}
function startShoreikaiGame() {
  confirmDiscardSuspended(startShoreikaiGameNow);
}
function startShoreikaiGameNow() {
  const run = shoreikaiCareer.value.run;
  const pending = run?.pending;
  if (!run || !pending) return;
  tournamentOpen.value = false;
  openPregame();
  matchKind.value = "tournament";
  homeOpen.value = false;
  void initializeEngine();
  coachLevel.value = ["off", "encourage", "detailed"].includes(run.settings.coachLevel) ? run.settings.coachLevel : "detailed";
  ryuoGame.value = { opponentId: pending.opponentId, label: pending.label ?? "", event: "shoreikai" };
  startRyuoMatch();
}
/** 奨励会の画面で「対局を再開」を押したとき。 */
function resumeShoreikaiGame() {
  tournamentOpen.value = false;
  resumeSuspendedMatch();
}
/** 入会試験に落ちたあと、受け直す(受験級を選び直せる)。 */
function retryShoreikai(rank: number) {
  const run = shoreikaiCareer.value.run;
  if (!run || run.phase !== "failed") return;
  setShoreikaiCareer({ ...shoreikaiCareer.value, run: retryExam(run, rank, { userLevel: ratingLevel(ratingState.value.rating) }) });
}
/** 四段・退会の挑戦を終えて、経歴に残す(次は入口から)。 */
function closeShoreikai() {
  const run = shoreikaiCareer.value.run;
  if (!run || (run.phase !== "pro" && run.phase !== "retired")) return;
  setShoreikaiCareer(closeShoreikaiRun(shoreikaiCareer.value));
}
/** 奨励会の終局を挑戦に記録する。千日手は、先後を入れ替えて指し直す。四段になったら免状を賞状帳に足す。 */
function recordShoreikaiOutcome(matchResult: MatchResult) {
  const game = ryuoGame.value;
  const run = shoreikaiCareer.value.run;
  if (!game || !run?.pending) return;
  if (!matchResult.winner) {
    const next = { ...run, pending: { ...run.pending, color: run.pending.color === "black" ? "white" : "black" } };
    setShoreikaiCareer({ ...shoreikaiCareer.value, run: next });
    ryuoGame.value = { ...game, replay: true };
    return;
  }
  const outcome = matchResult.winner === humanColor.value ? "win" : "loss";
  const next = recordShoreikaiGame(run, outcome, { userLevel: ratingLevel(ratingState.value.rating) });
  // 終局の判子は、昇級・合格・三段・四段のときだけ(期の画面の判子と同じ言葉)。負けたときは押さない。
  const stamp = eventStamp(next.events);
  finishMilestone = outcome === "win" && stamp?.tone === "good"
    ? { kind: "shoreikai", weight: stamp.weight, seal: stamp.seal, title: stamp.title, sub: stamp.sub, line: "" }
    : null;
  setShoreikaiCareer({ ...shoreikaiCareer.value, run: next });
  ryuoGame.value = { ...game, outcome, replay: false };
  if (next.phase === "pro") {
    const wins = next.games.filter((item: { win: boolean }) => item.win).length;
    seasonAwards.value = addAward(browserStorage(), shoreikaiAward({
      id: next.id, kishiNumber: next.kishiNumber, entryRank: shoreikaiRankLabel(next.entryRank),
      wins, losses: next.games.length - wins, mentor: next.mentor ? `${next.mentor.name}${next.mentor.dan}` : "",
    }, { playerName: playerDisplayName(playerName.value) }));
  }
}

function beginMatch() {
  ownsKikiGlasses.value = hasKikiGlasses(loadTutorialProgress(browserStorage()));
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
 * 練習(竜王戦の対策・苦手な戦型)で、CPUの戦法を一時的に変える前の対局設定。練習の対局を離れたら戻す
 * (あとの「対局する」が、練習の相手の戦法のまま始まらないように)。
 */
let settingsBeforePractice: { [key: string]: unknown } | null = null;

/** やこびノートの「対局する」。ノートを閉じて、通常対局の対局準備を開く。 */
function startMatchFromNote() {
  confirmDiscardSuspended(() => {
    yakobiNoteOpen.value = false;
    matchKind.value = "normal";
    closeHome();
  });
}
/**
 * やこびノートから、棋力測定の対局を対局準備を通さずに始める。
 * 平手・先手・作戦おまかせ・助言なしで、CPUの強さはレーティングに近いレベルにする。
 */
function startMeasureMatch() {
  noteFeatureSeen("measure");
  confirmDiscardSuspended(() => startMeasureMatchNow());
}
/**
 * 測定の対局を始める。続けて測るとき(continueMeasure)は、相手のLvと、前の対局から持ち越した手を渡す。
 * @param options.level 相手のLv(省くとレーティングに近いLv)
 * @param options.carry 持ち越した手と対局の数
 */
function startMeasureMatchNow(options: {
  level?: number;
  carry?: { moves: { loss: number; standing: number }[]; games: number };
  /** はじめての案内の答え(少し指せる・よく指している)。続けて測るときは、前の対局のものを引き継ぐ。 */
  welcome?: "some" | "player";
} = {}) {
  yakobiNoteOpen.value = false;
  openPregame();
  measureWelcome.value = options.welcome ?? (options.carry ? measureWelcome.value : "");
  measureCarry.value = options.carry ?? null;
  settingsBeforeMeasure = captureMatchSettings();
  matchKind.value = "normal";
  searchNodes.value = (options.level === undefined
    ? recommendedStrengthPreset.value
    : CPU_STRENGTH_PRESETS.find((preset) => preset.level === options.level) ?? recommendedStrengthPreset.value).value;
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
  // ルールは分かる: 教室で、始める場所を1手詰めの1問で決める。少し指せる・よく指している: 1級くらいの相手と棋力測定。
  if (choice === "beginner" || choice === "rules") openTutorialLesson();
  else if (choice === "some" || choice === "player") {
    noteFeatureSeen("measure");
    startMeasureMatchNow({ level: WELCOME_MEASURE_LEVEL, welcome: choice });
  }
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
function startQuickMatch(options: { level?: number; handicapId?: string; attackGuide?: boolean } = {}) {
  confirmDiscardSuspended(() => {
    yakobiNoteOpen.value = false;
    openPregame();
    const level = options.level ?? playPlan.value.level;
    searchNodes.value = (CPU_STRENGTH_PRESETS.find((preset) => preset.level === level) ?? playPreset.value).value;
    homeOpen.value = false;
    void initializeEngine();
    if (options.handicapId) {
      // 香落ち(CPUが上手)の学習対局。上手が先に指すので、振り駒はしない。
      matchKind.value = "learning";
      learningStartType.value = "handicap";
      learningHandicapId.value = options.handicapId;
      learningHandicapGiver.value = "cpu";
      beginMatch();
      return;
    }
    // 弱点の練習「駒の利きを見ながら対局」は、平手の学習対局で、駒の利きを付けて始める。
    matchKind.value = options.attackGuide ? "learning" : "normal";
    if (options.attackGuide) {
      learningStartType.value = "standard";
      attackGuideEnabled.value = true;
    }
    const toss = throwFurigoma();
    selectedPlayerColor.value = toss.playerColor;
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
  noteFeatureSeen("endgame");
  confirmDiscardSuspended(() => { void startEndgameNow(); });
}
async function startEndgameNow({ excludeSfen = "", ownOnly = false } = {}) {
  const { endgameIntro, endgameSources, pickEndgameStart, sourceFromRecentGame } = await import("./core/endgame-start.mjs");
  // 名局に、最近の自分の対局(終局まで指したもの)も加えて選ぶ。弱点の練習(ownOnly)では、自分の対局から選ぶ(選べなければ名局も)。
  const ownSources = loadRecentGames(browserStorage()).map(sourceFromRecentGame).filter((source) => source !== null);
  const start = (ownOnly ? pickEndgameStart(ownSources, { excludeSfen }) : null)
    ?? pickEndgameStart([...endgameSources(), ...ownSources], { excludeSfen });
  if (!start) return;
  yakobiNoteOpen.value = false;
  stopGuidedReview();
  openPregame();
  matchKind.value = "normal";
  searchNodes.value = playPreset.value.value;
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
function rematch(options: { level?: number; handicapId?: string; even?: boolean } = {}) {
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
  } else if (options.even) {
    // 香落ちで勝ったあとの「平手で挑む」。通常対局に戻し、先後は振り駒。
    matchKind.value = "normal";
    const toss = throwFurigoma();
    selectedPlayerColor.value = toss.playerColor;
    void initializeEngine();
    beginMatch();
    showFurigoma(toss);
    return;
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
/** 大会の画面を、竜王戦か名人戦の入口で開く(期の途中なら、その期の画面)。 */
function openTournamentAt(startAt: "ryuo" | "meijin" | "shoreikai") {
  tournamentStartAt.value = startAt;
  tournamentFromGame.value = false;
  tournamentOpen.value = true;
  if (ryuoSeason.value?.analysisQueue?.length) void ryuoStats.processQueue();
}
function openTournamentScreen() {
  tournamentStartAt.value = "select";
  tournamentFromGame.value = false;
  tournamentOpen.value = true;
  // 前に終えた対局の解析が残っていれば、続きを解析する。
  if (ryuoSeason.value?.analysisQueue?.length) void ryuoStats.processQueue();
}

/** 教室のレッスンから、関連する図鑑の項目を開く。 */
/** 将棋教室の巻を終えたときの称号。称号の保存は対局画面が持つので、教室からは知らせだけ受け取る(同じ称号は上書き)。 */
function grantTutorialTitle(title: { id: string; label: string; detail?: string; rank?: number }) {
  profileState.value = grantTitle(profileState.value, title);
  saveProfile(browserStorage(), profileState.value);
}

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
  suspendedMatch.value = { moves: moveHistory.length, ryuoOpponentId: ryuoGame.value?.opponentId ?? null, event: ryuoGame.value?.event ?? "ryuo" };
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

// ===== 展示モードの「最初から」 =====
const exhibitResetOpen = ref(false);
const exhibitResetCancel = ref<HTMLButtonElement | null>(null);
function openExhibitReset() {
  exhibitResetOpen.value = true;
  // 取り消せない操作なので、最初のフォーカスは「やめる」(UI_Nintendo_Implementation.mdの3-1)。
  void nextTick(() => exhibitResetCancel.value?.focus());
}
/**
 * 記録を消して、ページを読み直す(画面の状態も、来場者が来る前に戻す)。
 * 確認は閉じないまま読み直す。閉じると、戻る操作の見張りを外すhistory.back()が走り、読み直しが取り消される。
 */
function acceptExhibitReset() {
  clearExhibitRecords(browserStorage());
  try {
    clearExhibitRecords(typeof sessionStorage === "undefined" ? null : sessionStorage);
  } catch {
    // セッションの保存が使えなくても、読み直す。
  }
  window.location.reload();
}

/** 教室で終えた(クリアかスキップした)レッスンの数。タイトル画面を開くたび、教室を閉じるたびに読み直す。 */
const homeLessonsDone = ref(0);
/** 強くなる道(core/home-roadmap.mjs)を決める記録。タイトル画面を開くたびに読み直す。 */
const homeTutorialProgress = ref(loadTutorialProgress(browserStorage()));
const homeProblemsSolved = ref(0);
/** あと少しのご褒美(docs/home-next-adaptive-design.mdの15章): 勝ったことのあるLvと、次の着せ替えまでの印の残り。 */
const homeReward = ref<{ wonLevels: number[]; themeRemaining: number | null }>({ wonLevels: [], themeRemaining: null });
/** 開いたことのある遊び(まだ見ていない遊びの紹介に使う)。 */
const seenFeatures = ref<string[]>(loadSeenFeatures(browserStorage()));
function noteFeatureSeen(id: string) {
  if (markFeatureSeen(browserStorage(), id)) seenFeatures.value = loadSeenFeatures(browserStorage());
}
const homeWelcomeChoice = ref("");
/** 続けて遊んだ日(core/play-streak.mjs)。タイトル画面の記録の帯とやこび姫の一言に使う。 */
const homeStreak = ref(currentStreak(loadPlayStreak(browserStorage())));
function refreshHomeProgress() {
  homeTutorialProgress.value = loadTutorialProgress(browserStorage());
  homeLessonsDone.value = Object.keys(homeTutorialProgress.value.lessons).length;
  homeProblemsSolved.value = Object.keys(loadProblemProgress(browserStorage()).solved).length;
  homeWelcomeChoice.value = welcomeChoiceFrom(browserStorage(), WELCOME_SEEN_KEY);
  homeStreak.value = currentStreak(loadPlayStreak(browserStorage()));
  const collection = loadCollection(browserStorage());
  homeReward.value = {
    wonLevels: Object.keys(collection.levels ?? {}).map(Number).filter(Number.isFinite),
    themeRemaining: nextThemeUnlock(collection)?.remaining ?? null,
  };
  refreshPlayInsight();
  // 終えた対局の中身の解析が残っていれば、ホームにいるあいだに続ける。
  if (playInsight.value.queue.length) void playInsightAnalysis.processQueue();
}
function refreshPlayInsight() {
  const store = browserStorage();
  playInsight.value = loadPlayInsight(store);
  homeReviewProblemIds.value = new Set(loadReviewProblems(store).map((problem: { id: string }) => problem.id));
  homeReviewDueId.value = dueReviewId(loadReviewQueue(store));
}
watch([homeOpen, tutorialOpen, problemSetOpen, welcomeOpen], ([home, tutorial, problems]) => {
  if (home && !tutorial && !problems) refreshHomeProgress();
}, { immediate: true });

/**
 * 強くなる道。5つの段のどこにいるかを、保存してある記録だけで決める(docs/home-roadmap-design.md)。
 * つぎはこれ・入口のおすすめ・薄くする入口・やこび姫の一言は、いまの段から決める。
 */
/** 竜王戦で指したことがあるか(竜王戦のレーティングの対局か、終えた期がある)。 */
const homeRyuoPlayed = computed(() => {
  const ryuoTally = (ratingState.value.events as { [event: string]: { wins: number; losses: number; draws: number } } | undefined)?.ryuo;
  const ryuoGames = ryuoTally ? ryuoTally.wins + ryuoTally.losses + ryuoTally.draws : 0;
  return ryuoGames > 0 || ryuoCareer.value.seasons > 0;
});
const homeRoadmapState = computed(() => {
  return homeRoadmap({
    tutorialProgress: homeTutorialProgress.value,
    ratedGames: ratingState.value.games,
    problemsSolved: homeProblemsSolved.value,
    ryuoPlayed: homeRyuoPlayed.value,
    welcomeChoice: homeWelcomeChoice.value,
    measured: Boolean(ratingState.value.measured),
  });
});
const homeRoadmapStep = computed(() => homeRoadmapState.value.steps[homeRoadmapState.value.current - 1]);
function homeTile(id: string) {
  return roadmapTile(id, homeRoadmapState.value.current);
}
function homeTileClass(id: string) {
  const tile = homeTile(id);
  return { "shogi-title__tile--later": tile.dim, "shogi-title__tile--recommended": tile.recommended };
}

type HomeNext = {
  id: "resume" | "tutorial" | "match" | "tournament" | "ryuo-entry" | "meijin-entry" | "ryuo-season" | "ryuo-counter" | "problems" | "practice" | "discover";
  label: string; description: string;
  /** 立て直しのときの「香落ちで挑む」のLv。 */
  handicapLevel?: number | null;
  /** 立て直しの駒落ち(15級は飛車落ち、ほかは香落ち)。 */
  handicapId?: { id: string; label: string } | null;
  /** 竜王戦の期の途中の、主役でない方の小さな入口(対策か続き)。 */
  sub?: { id: "ryuo-season" | "ryuo-counter"; label: string } | null;
};
/** 竜王戦の期の途中の「つぎはこれ」(対策か続き。docs/home-next-adaptive-design.mdの13-3)。 */
const homeRyuoPlan = computed(() => {
  const season = ryuoSeason.value;
  const pending = ryuoView.value?.pending;
  if (!season || !pending || season.phase === "done") return null;
  const last = season.userGames?.at(-1) ?? null;
  return ryuoNextPlan({
    pending,
    seasonId: String(season.id ?? ""),
    gamesPlayed: season.userGames?.length ?? 0,
    lastGame: last ? { win: Boolean(last.win), opponentId: last.opponentId } : null,
    counterDone: ryuoCounterDoneKey.value !== "" && ryuoCounterDoneKey.value === `${season.id}:${pending.opponentId}:${pending.label ?? ""}`,
  });
});
/**
 * タイトル画面の「つぎはこれ」。中断した対局があれば再開を最優先にし、それ以外は強くなる道のいまの段の行き先にする。
 */
const homeNext = computed<HomeNext>(() => {
  if (suspendedMatch.value) {
    const what = suspendedMatch.value.ryuoOpponentId
      ? ({ meijin: "名人戦の対局", shoreikai: "奨励会の対局" } as { [key: string]: string })[suspendedMatch.value.event ?? ""] ?? "竜王戦の対局"
      : "対局";
    return { id: "resume", label: "対局を再開", description: `中断した${what}（${suspendedMatch.value.moves}手目まで）` };
  }
  // 竜王戦の期の途中: 次の相手の対策か、続きを指すか。主役でない方を小さな入口にする。
  const ryuo = homeRyuoPlan.value;
  if (ryuo) {
    return ryuo.main === "counter"
      ? { id: "ryuo-counter", label: ryuo.counter.title, description: ryuo.counter.reason, sub: { id: "ryuo-season", label: ryuo.continue.sub } }
      : { id: "ryuo-season", label: ryuo.continue.title, description: ryuo.continue.reason, sub: { id: "ryuo-counter", label: ryuo.counter.sub } };
  }
  // 大会への誘い(竜王戦に出よう・名人戦に出よう)。大会は主役なので、強くなる道の段を待たずに勧める。
  const invite = homeInvite.value;
  if (invite) return { id: invite.id === "meijin" ? "meijin-entry" : "ryuo-entry", label: invite.title, description: invite.reason };
  const plan = playPlan.value;
  const preset = playPreset.value;
  switch (homeRoadmapState.value.current) {
    case 1:
      return homeLessonsDone.value
        ? { id: "tutorial", label: "将棋教室のつづき", description: `${homeLessonsDone.value}レッスン終わったよ。駒の動きを覚えて、第1巻を終えよう` }
        : { id: "tutorial", label: "将棋教室ではじめる", description: "駒の動かし方から、やこび姫といっしょに覚えよう" };
    case 2:
      return { id: "match", label: "はじめての対局", description: `Lv.${preset.level} ${preset.label}の相手と、振り駒ですぐ始める。困ったら、やこび姫が助言するよ` };
    case 3: {
      const volume2Done = ["cleared", "skipped"].includes(homeTutorialProgress.value.lessons?.[VOLUME_2_LAST_LESSON]?.status ?? "");
      return volume2Done
        ? { id: "problems", label: "問題集で詰ませよう", description: `詰将棋を解いて、玉のつかまえ方を身につけよう（${homeProblemsSolved.value}問解いたよ）` }
        : { id: "tutorial", label: "教室で詰みを覚えよう", description: "将棋教室の第2巻で、三手の読みと玉のつかまえ方を覚えよう" };
    }
    case 4:
      return { id: "tournament", label: "竜王戦に出よう", description: "6組から、トーナメントを勝ち上がって竜王をめざそう" };
    default:
      // 5段目: 実力と実績の見立て(初勝利の次・立て直し・連勝の挑戦・復習の1問・弱点の練習・昇級をかけた一局・ふだんの対局)。
      // 理由を1行で添える。
      // 竜王戦の期を終えたばかりなら、次の期へ。
      if (homeNextSeason.value) return { id: "tournament", label: homeNextSeason.value.title, description: homeNextSeason.value.reason };
      if (plan.practice) return { id: "practice", label: plan.title, description: plan.reason };
      // ふだんの対局の場面だけ: まだ見ていない遊び(今日1局以上指したあと、3局ごと)と、その日初めての「今日の1局」。
      if (plan.kind === "normal") {
        const discover = homeDiscovery.value;
        if (discover) return { id: "discover", label: discover.title, description: discover.reason };
        const today = todayPlan({
          playedToday: homeStreak.value.playedToday,
          streak: homeStreak.value.current,
          level: plan.level,
          everPlayed: ratingState.value.games > 0,
        });
        if (today) return { id: "match", label: today.title, description: today.reason, handicapLevel: plan.handicapLevel, handicapId: plan.handicapId ?? null };
      }
      return { id: "match", label: plan.title, description: plan.reason, handicapLevel: plan.handicapLevel, handicapId: plan.handicapId ?? null };
  }
});
/**
 * 「つぎはこれ」の将棋教室と、はじめての案内の「はじめて」。本棚を通さずに、次のレッスンをすぐ始める。
 * タイトル画面の「将棋教室」のタイルからは、今までどおり本棚を開く。
 */
const tutorialAutoStart = ref(false);
/** はじめての案内の答え。教室の最初の問いの「おすすめ」に使う。教室を開く直前に読み直す(案内で選んだ直後でも反映する)。 */
const tutorialWelcomeChoice = ref("");
watch(tutorialOpen, (open) => {
  if (open) tutorialWelcomeChoice.value = welcomeChoiceFrom(browserStorage(), WELCOME_SEEN_KEY);
}, { immediate: true });
function openTutorialLesson() {
  tutorialAutoStart.value = true;
  tutorialOpen.value = true;
}
/** 「つぎはこれ」の弱点の練習で開く教室の章(docs/first-play-design.mdの6-1)。教室を閉じたら捨てる。 */
const tutorialStartChapter = ref<{ chapterId: string; fromLessonId?: string } | null>(null);
/** まだ見ていない遊びの紹介(15章)。 */
const homeDiscovery = computed(() => discoveryPlan({
  seen: seenFeatures.value,
  games: ratingState.value.games,
  playedToday: homeStreak.value.playedToday,
  measured: Boolean(ratingState.value.measured),
}));
/** まだ見ていない遊びを開く。 */
function openDiscovery(id: string) {
  if (id === "endgame") startEndgameMatch();
  else if (id === "opening-dex") dexOpen.value = true;
  else if (id === "measure") startMeasureMatch();
  else if (id === "piece" || id === "tesuji" || id === "world" || id === "glossary") referenceDexKind.value = id;
}
/** 「つぎはこれ」の絵。弱点の練習は、行き先(教室・問題集)の絵にする。 */
const homeNextIcon = computed(() => {
  const { id } = homeNext.value;
  if (["tournament", "ryuo-entry", "meijin-entry", "ryuo-season", "ryuo-counter"].includes(id)) return "tournament";
  const via = id === "practice" ? playPlan.value.practice?.via : "";
  if (id === "problems" || via === "problems") return "problems";
  if (id === "tutorial" || via === "tutorial") return "tutorial";
  return id;
});
/** 大会への誘い(docs/first-play-design.mdの6-2)。 */
const homeInvite = computed(() => tournamentInvite({
  ryuoEntered: homeRyuoPlayed.value || Boolean(ryuoSeason.value),
  ryuoSeasons: ryuoCareer.value.seasons ?? 0,
  meijinEntered: (meijinCareer.value?.no ?? 0) > 0 || Boolean(meijinSeason.value),
  measured: Boolean(ratingState.value.measured),
  ratedGames: ratingState.value.games,
  lastPractice: playInsight.value.practice,
  grade: recommendedStrengthPreset.value.label,
  difficulty: ryuoDefaultDifficulty.value,
}));
/** 竜王戦の期を終えたあとの「次の期へ」(直前のレーティングの対局が竜王戦のとき)。 */
const homeNextSeason = computed(() => {
  const season = ryuoSeason.value;
  const lastRated = ratingState.value.history?.filter((entry: { opponentLevel?: number }) => Number.isFinite(entry?.opponentLevel)).at(-1);
  return ryuoNextSeasonPlan({
    inSeason: Boolean(season?.pending) && season?.phase !== "done",
    lastRatedEvent: lastRated?.event ?? "",
    seasons: ryuoCareer.value.seasons ?? 0,
    group: ryuoCareer.value.group ?? 6,
    ryuo: ryuoCareer.value.champion === true,
  });
});
function startHomeNextSub() {
  const sub = homeNext.value.sub;
  if (sub?.id === "ryuo-counter") startRyuoCounter();
  else if (sub?.id === "ryuo-season") openRyuoSeasonScreen();
}
function startHomeNext() {
  if (homeNext.value.id === "resume") resumeSuspendedMatch();
  else if (homeNext.value.id === "ryuo-counter") startRyuoCounter();
  else if (homeNext.value.id === "ryuo-season") openRyuoSeasonScreen();
  else if (homeNext.value.id === "discover" && homeDiscovery.value) openDiscovery(homeDiscovery.value.id);
  else if (homeNext.value.id === "tutorial") openTutorialLesson();
  else if (homeNext.value.id === "tournament") openTournamentScreen();
  else if (homeNext.value.id === "ryuo-entry") openTournamentAt("ryuo");
  else if (homeNext.value.id === "meijin-entry") openTournamentAt("meijin");
  else if (homeNext.value.id === "problems") problemSetOpen.value = true;
  else if (homeNext.value.id === "practice" && playPlan.value.practice) startPractice(playPlan.value.practice);
  else startQuickMatch();
}
/** 問題集を開いたときに、すぐ出す問題(「つぎはこれ」の復習の1問・詰みの解き直し)。 */
const problemSetStart = ref<{ id: string; review: boolean } | null>(null);
/** 問題集を開いたときの5問の練習(「つぎはこれ」の弱点の練習。docs/first-play-design.mdの6-1)。 */
const problemSetDrill = ref<PracticeDrill | null>(null);
watch(problemSetOpen, (open) => {
  if (!open) {
    problemSetStart.value = null;
    problemSetDrill.value = null;
  }
});
/**
 * 「つぎはこれ」の練習(docs/home-next-adaptive-design.mdの4章(ウ)(エ))。始めたことを記録し、次の2局は対局を勧める。
 * 弱点の練習は、行き先(docs/first-play-design.mdの6-1)が教室の章ならその章、問題集なら5問の練習。今までの練習は次のとおり。
 * - review・mate: 問題集のその1問
 * - ending: 自分の最近の対局の終盤から指す
 * - free: 「駒の利き」を付けた学習対局(同じLv。レーティングの対象外)
 * - opening: 学習対局の対局準備で、作戦カードを選ぶ
 */
function startPractice(practice: PracticeStep) {
  const insight = recordPractice(loadPlayInsight(browserStorage()), { kind: practice.kind, games: ratingState.value.games, via: practice.via });
  savePlayInsight(browserStorage(), insight);
  playInsight.value = insight;
  if (practice.via === "tutorial" && practice.chapterId) {
    // 教室の章: その章のまだクリアしていないレッスンをすぐ始める。
    tutorialStartChapter.value = { chapterId: practice.chapterId, fromLessonId: practice.fromLessonId };
    tutorialOpen.value = true;
  } else if (practice.via === "problems" && practice.drill) {
    // 問題集の5問。
    problemSetDrill.value = practice.drill;
    problemSetOpen.value = true;
  } else if (practice.kind === "review" || practice.kind === "mate") {
    problemSetStart.value = practice.problemId ? { id: practice.problemId, review: practice.kind === "review" } : null;
    problemSetOpen.value = true;
  } else if (practice.kind === "ending") {
    confirmDiscardSuspended(() => { void startEndgameNow({ ownOnly: true }); });
  } else if (practice.kind === "free") {
    startQuickMatch({ attackGuide: true });
  } else if (practice.kind === "matchup") {
    // 苦手な戦型: その戦法を指すCPUと、おすすめの強さで学習対局(振り駒)。
    confirmDiscardSuspended(() => startMatchupPractice(practice.rook === "static" ? "static" : "ranging"));
  } else {
    confirmDiscardSuspended(() => {
      matchKind.value = "learning";
      learningStartType.value = "standard";
      closeHome();
      openPlanSheet("pregame");
    });
  }
}
/**
 * 苦手な戦型の練習(docs/home-next-adaptive-design.mdの14章)。CPUの戦法の傾向を「居飛車」か「振り飛車」にした、
 * おすすめの強さの学習対局(振り駒)。レーティングには数えない。CPUの設定は、練習の対局を離れたら戻す。
 */
function startMatchupPractice(rook: "static" | "ranging") {
  yakobiNoteOpen.value = false;
  openPregame();
  settingsBeforePractice = captureMatchSettings();
  searchNodes.value = playPreset.value.value;
  homeOpen.value = false;
  void initializeEngine();
  matchKind.value = "learning";
  learningStartType.value = "standard";
  cpuStrategy.value = "random";
  cpuStrategyDetailsOpen.value = false;
  cpuRookPreference.value = rook;
  const toss = throwFurigoma();
  selectedPlayerColor.value = toss.playerColor;
  beginMatch();
  showFurigoma(toss);
}
/** やこび姫の吹き出し。「つぎはこれ」に合わせて一言かける。 */
const homeGreeting = computed(() => {
  if (homeNext.value.id === "resume") return "さっきの対局、続きをしよう！";
  const ryuoName = ryuoView.value?.pending?.opponent?.name ?? "";
  if (homeNext.value.id === "ryuo-counter") return `${ryuoName}さんの対策、いっしょにしよう！`;
  if (homeNext.value.id === "ryuo-season") return `次は${ryuoName}さんとの一局だね！`;
  if (homeNext.value.id === "practice") return "いっしょに練習しよう！";
  if (homeNext.value.id === "discover") return "ほかにも遊べるよ！";
  if (homeNext.value.id === "ryuo-entry") return "腕だめしに、竜王戦に出てみよう！";
  if (homeNext.value.id === "meijin-entry") return "次は名人戦！ 順位戦を勝ち抜こう";
  if (homeNext.value.label === "今日の1局") return homeStreak.value.current >= 1 ? "今日も1局、指そう！" : "おかえり！ 待ってたよ";
  switch (homeRoadmapState.value.current) {
    case 1: return homeLessonsDone.value ? "今日も教室で練習しよう！" : "はじめまして！ いっしょに覚えよう";
    case 2: return "駒の動き、覚えたね！ CPUと指してみよう";
    case 3: return "次は、玉のつかまえ方を覚えよう！";
    case 4: return "腕だめしに、竜王戦に出てみよう！";
    default: return streakGreeting(homeStreak.value) || "今日はなにをする？";
  }
});
const homeAffiliation = computed(() => currentAffiliation(profileState.value)?.label ?? "");

/*
 * ブラウザの戻るで、手前に重なった画面から1段ずつ閉じる。対局準備はホームへ戻る。
 * 対局中と振り返り中は、保存を消さないよう対局画面から離れない。ホームでは元のページへ戻る。
 */
function navigateBack() {
  if (welcomeOpen.value && homeOpen.value) {
    // 初回の案内は、選択肢か「自分で選ぶ」を押すまで残す。戻るで回答済みにしない。
    return;
  } else if (kansenkiShown.value) {
    kansenkiShown.value = null;
  } else if (daySummaryOpen.value) {
    daySummaryOpen.value = false;
  } else if (assistToolsCollapsed.value && assistToolsOpen.value) {
    closeAssistTools(true);
  } else if (ladderNoticeOpen.value) {
    dismissLadderNoticeDialog();
  } else if (exhibitResetOpen.value) {
    exhibitResetOpen.value = false;
  } else if (discardSuspendedPending.value) {
    discardSuspendedPending.value = null;
  } else if (nameDialogOpen.value) {
    nameDialogOpen.value = false;
  } else if (tournamentOpen.value) {
    // 大会の画面は、中の画面(説明・トーナメント表)から、大会の選択へ、そして閉じる、の順に戻る。
    if (tournamentView.value) tournamentView.value.goBack();
    else tournamentOpen.value = false;
  } else if (yakobiNoteOpen.value) {
    // やこびノートは、重ねて開いたもの(賞状・棋士名鑑のくわしい情報)から閉じる。
    if (!noteView.value?.goBack()) yakobiNoteOpen.value = false;
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
  } else if (dexShelfOpen.value) {
    dexShelfOpen.value = false;
  } else if (suspendConfirmOpen.value) {
    suspendConfirmOpen.value = false;
  } else if (resignConfirmOpen.value) {
    resignConfirmOpen.value = false;
  } else if (planSheet.value) {
    closePlanSheet();
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
  canGoBack: () => !homeOpen.value || (welcomeOpen.value && homeOpen.value) || ladderNoticeOpen.value || exhibitResetOpen.value || Boolean(discardSuspendedPending.value) || nameDialogOpen.value || tournamentOpen.value || tutorialOpen.value || problemSetOpen.value || dexOpen.value || yakobiNoteOpen.value || Boolean(referenceDexKind.value),
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
  ryuoCounter.value = null;
  // 大会の対局準備はないので、対局準備を開くときは通常対局へ戻す。
  if (matchKind.value === "tournament") matchKind.value = "normal";
  suspendedMatch.value = null;
  suspendConfirmOpen.value = false;
  measureMode.value = false;
  measureSession.value = false;
  measureWelcome.value = "";
  measureAnalyzing.value = false;
  measureCarry.value = null;
  if (settingsBeforeMeasure) restoreMatchSettings(settingsBeforeMeasure);
  settingsBeforeMeasure = null;
  if (settingsBeforePractice) restoreMatchSettings(settingsBeforePractice);
  settingsBeforePractice = null;
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
  const previous = currentSfen.value;
  const formationsBefore = new Set(matchFormationNames);
  currentSfen.value = record.value.position.sfen;
  lastMove.value = usi;
  observeFormations(currentSfen.value);
  if (usi) {
    showCapturePop(previous, usi);
    // この手で初めて組めた囲いを知らせる(開始局面ですでに組んである囲いや、復元では出さない)。
    const castle = [...matchFormationNames].find((name) => !formationsBefore.has(name) && CASTLE_LABELS.has(name));
    if (castle) showCastleCallout(castle);
  }
}

/*
 * 対局の駒得の数字。AI用の値で、取ったマスに緑の「＋540」、取られたら赤の「−495」などを浮かべる。
 * 成った駒は、持ち駒になる元の駒の値段で数える(piece-points.mjs)。直前の局面から指した手のときだけ出す(復元・待ったでは出さない)。
 */
const captureFloatLabels = ref<{ id: number; file: number; rank: number; text: string; tone: "good" | "bad"; big: boolean }[]>([]);
let captureFloatSeq = 0;
function showCapturePop(previous: string, usi: string) {
  // 学習対局ではいつも、ほかの対局では「駒の損得」を付けているときに出す。
  if ((matchKind.value !== "learning" && !materialGuideEnabled.value) || !matchStarted.value || reviewMode.value || !previous) return;
  // 直前の局面からこの手を指した結果が、いまの局面と同じときだけ出す。
  const check = createGameRecord(previous);
  if (!appendUsiMove(check, usi) || check.position.sfen.split(" ")[0] !== record.value.position.sfen.split(" ")[0]) return;
  const side = humanColor.value === Color.WHITE ? "white" : "black";
  captureFloatSeq += 1;
  const pop = capturePop(previous, usi, side, captureFloatSeq, AI_PIECE_POINTS, AI_PIECE_POINTS.B);
  if (!pop) return;
  const label = { id: captureFloatSeq, file: pop.file, rank: pop.rank, text: pop.text, tone: pop.tone, big: pop.big };
  captureFloatLabels.value = [...captureFloatLabels.value, label];
  setTimeout(() => {
    captureFloatLabels.value = captureFloatLabels.value.filter(({ id }) => id !== label.id);
  }, CAPTURE_POP_MS);
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
    ryuoCounter: ryuoCounter.value,
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
  const savedEvent = savedRyuo?.event === "meijin" || savedRyuo?.event === "shoreikai" ? savedRyuo.event : "ryuo";
  const restoredRyuo: RyuoGame | null = snapshot.matchKind === "tournament" && savedRyuo
    && typeof savedRyuo.opponentId === "string" && tournamentSeasonOf({ opponentId: "", label: "", event: savedEvent })?.players?.[savedRyuo.opponentId]
    ? {
      opponentId: savedRyuo.opponentId,
      label: typeof savedRyuo.label === "string" ? savedRyuo.label : "",
      outcome: savedRyuo.outcome === "win" || savedRyuo.outcome === "loss" ? savedRyuo.outcome : undefined,
      replay: savedRyuo.replay === true,
      event: savedEvent,
      stage: savedRyuo.stage && typeof savedRyuo.stage === "object" && ["plain", "big", "title"].includes(savedRyuo.stage.weight)
        ? savedRyuo.stage
        : null,
      day: savedRyuo.stage?.twoDay ? normalizeDay(savedRyuo.day) : undefined,
    }
    : null;
  matchKind.value = snapshot.matchKind === "learning" ? "learning" : restoredRyuo ? "tournament" : "normal";
  ryuoGame.value = restoredRyuo;
  const savedCounter = snapshot.ryuoCounter;
  ryuoCounter.value = matchKind.value === "learning" && savedCounter && typeof savedCounter.opponentId === "string"
    && ryuoSeason.value?.players?.[savedCounter.opponentId]
    ? { opponentId: savedCounter.opponentId, label: String(savedCounter.label ?? ""), key: String(savedCounter.key ?? "") }
    : null;
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
  attackGuideEnabled.value = learning.attackGuide === true;
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
    const savedRyuo = snapshot.matchKind === "tournament" ? snapshot.ryuoGame : null;
    suspendedMatch.value = {
      moves: Array.isArray(snapshot.moves) ? snapshot.moves.length : 0,
      ryuoOpponentId: typeof savedRyuo?.opponentId === "string" ? savedRyuo.opponentId : null,
      event: savedRyuo?.event === "meijin" || savedRyuo?.event === "shoreikai" ? savedRyuo.event : "ryuo",
    };
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
    if (matchKind.value === "tournament" && ryuoGame.value) startPresence({ greet: false });
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
  // 詳しい助言では、このあと助言の読みでもう一度評価するので、浅いCPUの評価値は表情と中継に使わない(バーが跳ねないように)。
  if (coachLevel.value === "encourage") notePresenceScore(score);
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
    materialBalance: playerMaterialBalance(),
  });
  showCoachAdvice(advice);
}

/** プレイヤーから見た駒の損得(図鑑のAI用の駒の値段。「駒の損得」の札と同じ数え方)。形勢の一言の方針に使う。 */
function playerMaterialBalance() {
  const totals = aiMaterialTotals(currentSfen.value);
  return humanColor.value === Color.WHITE ? totals.white - totals.black : totals.black - totals.white;
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
async function judgeSearch(positionKey: string): Promise<{ score?: EngineEvaluation; pv: string[] }> {
  if (!engine) return { pv: [] };
  const settings = getMoveJudgeSearchSettings(props.mobile || boardLayout.value === "portrait");
  engine.setPosition(positionKey);
  engine.applyStrengthOptions({ multiPv: 1 });
  const search = await engine.go({ nodes: settings.nodes, maxTimeMs: settings.maxTimeMs });
  const best = search.candidates.find((candidate) => candidate.rank === 1);
  return { score: best?.score as EngineEvaluation | undefined, pv: best?.pv ?? [] };
}
async function judgeSearchScore(positionKey: string): Promise<EngineEvaluation | undefined> {
  return (await judgeSearch(positionKey)).score;
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
  // 着手後の読み筋の1手目は、相手のいちばんの応手。悪手の理由を言うのに使う(coach-reason.mjs)。
  const afterSearch = await judgeSearch(afterKey);
  const after = scoreForPlayer(afterSearch.score, sideAfter, humanColor.value);
  if (!isCurrent() || !before || !after) return null;
  return { before, after, afterPv: afterSearch.pv };
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
  if (coachLevel.value !== "off" && !reviewMode.value) notePresenceScore(score);
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
    materialBalance: playerMaterialBalance(),
  });
  showCoachAdvice(advice);
}

/**
 * エンジン所有権を持つ呼び出し元専用。待ち行列へは積まず、通常探索で連続王手詰みを調べる。
 */
async function engineMateCheck(
  sfen: string,
  options: { nodes: number; maxTimeMs: number; maxPly?: number },
): Promise<({ status: "mate"; plies: number } | { status: "no-mate" | "unknown" }) & {
  /** 読んだ局面のいちばんの手(手番側から見た評価)。相手の狙いを言うのに使う。 */
  best?: { move: string; score?: EngineEvaluation; pv: string[] };
}> {
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
    return {
      ...mateCheckResultFromCandidate(sfen, best, maxPly),
      best: best?.move ? { move: best.move, score: best.score as EngineEvaluation | undefined, pv: best.pv ?? [] } : undefined,
    };
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
  // タイトル戦の封じ手予想は、この読みの最善手(控室の第1候補)。
  if (bestMove) roomPick = { ply: analyzedHistoryLength, move: bestMove };
  const riskAdvice = coachLevel.value === "detailed"
    ? getCandidateRiskAdvice(normalizedCandidates, {
        inCheck,
        mateThreat,
        mateThreatChecked: mateThreatResult !== null && mateThreatResult.status !== "unknown",
        moveCount: moveCount.value,
        ...(bestMove ? bestMoveTacticalContext(bestMove) : {}),
      })
    : null;
  // 順番: 悪手の指摘 → 詰み・王手・詰めろ・評価の崖 → 相手の狙い → 作戦の助言(とほめる一言) → ほかの危険の知らせ。
  const urgentAdvice = riskAdvice && URGENT_RISK_ADVICE.test(riskAdvice.key) ? riskAdvice : null;
  // 相手の狙い: 手番を入れ替えた局面(詰めろの確かめ)で、相手がいちばん指したい手が大きな駒を取る手なら言う。
  const threatLine = coachLevel.value === "detailed" && !moveFeedback && !urgentAdvice && threatSfen && mateThreatResult?.best
    ? threatAdvice({
        threatSfen,
        threatMove: mateThreatResult.best.move,
        threatPv: mateThreatResult.best.pv,
        threatScore: mateThreatResult.best.score ?? null,
        playerScore: score ?? null,
        playerColor: humanColor.value === Color.WHITE ? "white" : "black",
      })
    : null;
  let planLine: { key: string; text: string; topic?: string } | null = null;
  if (coachLevel.value === "detailed" && !moveFeedback && !urgentAdvice && !threatLine) {
    planLine = coachPlanPraise();
    if (!planLine) {
      const rookUnderThreat = bestMove ? Boolean(bestMoveTacticalContext(bestMove).rookUnderThreat) : false;
      const offered = await offerCoachPlan(normalizedCandidates, { inCheck, mateThreat, rookUnderThreat }, analyzedHistoryLength);
      if (!active.value || moveHistory.length !== analyzedHistoryLength) return;
      planLine = offered;
    }
  }
  const chosen = moveFeedback ?? urgentAdvice ?? threatLine ?? planLine ?? riskAdvice;
  // 大会の相手の表情と中継は、この助言の読みの評価値で動かす(riskOnlyでも)。
  notePresenceScore(score);
  if (riskOnly) {
    if (chosen) showCoachAdvice(chosen);
    return;
  }
  updateCoachAdviceFromPlayerScore(score, chosen, false);
}

/** 作戦の助言より先に出す危険の知らせ(詰み・王手・詰めろ・評価の崖)。 */
const URGENT_RISK_ADVICE = /^(forced-mate-loss|king-in-check|mate-risk|candidate-evaluation-cliff)/;
/** 作戦の提案の札。駒を動かしたら閉じる。 */
const coachPlanOffer = ref<null | {
  planId: string;
  label: string;
  historyLength: number;
  selectable: boolean;
  swingText: string;
  swingScore: string;
  otherText: string;
  otherScore: string;
}>(null);
/** 直前に出した提案。次の手番で、その作戦へ飛車を振っていたらほめる。 */
let lastPlanAdvice: { advice: NonNullable<ReturnType<typeof planAdvice>>; sfen: string; historyLength: number } | null = null;
// 駒を動かしたら(待ったで戻しても)札を閉じる。moveHistoryは反応しないので、棋譜の手数で見る。
watch(moveCount, () => {
  if (coachPlanOffer.value && coachPlanOffer.value.historyLength !== moveHistory.length) coachPlanOffer.value = null;
});
watch([reviewMode, active], () => { coachPlanOffer.value = null; });
function formatPlanScore(score?: { type: string; value: number } | null) {
  if (!score) return "—";
  if (score.type === "mate") return score.value > 0 ? `詰み${score.value}手` : `被詰み${Math.abs(score.value)}手`;
  return `${score.value >= 0 ? "+" : ""}${Math.trunc(score.value)}`;
}
/** 提案のあと、プレイヤーがその作戦の筋へ飛車を振っていたら、ほめる一言を返す(1回だけ)。 */
function coachPlanPraise() {
  const last = lastPlanAdvice;
  if (!last || moveHistory.length < last.historyLength + 1) return null;
  lastPlanAdvice = null;
  const praise = planSwingPraise(last.advice, {
    sfen: last.sfen,
    usi: moveHistory[last.historyLength] ?? "",
    color: humanColor.value === Color.WHITE ? "white" : "black",
  });
  return praise;
}
/**
 * 飛車を振る提案。浅い読みで条件を満たしたら、2手に絞って深く読み直して確かめ、札と台詞を用意する。
 * 呼び出し元(助言の順番待ち)の中で読むので、CPUの探索とは重ならない。
 */
async function offerCoachPlan(
  candidates: { rank: number; move: string; score?: { type: "cp" | "mate"; value: number } }[],
  { inCheck, mateThreat, rookUnderThreat }: { inCheck: boolean; mateThreat: boolean; rookUnderThreat: boolean },
  historyLength: number,
) {
  if (!engine || !openingGuideAvailable.value || normalizedMode.value !== "cpu") return null;
  const color = humanColor.value === Color.WHITE ? "white" : "black";
  const opponentColor = humanColor.value === Color.BLACK ? Color.WHITE : Color.BLACK;
  const sfen = currentSfen.value;
  const proposal = planAdvice({
    candidates,
    sfen,
    color,
    moveCount: moveCount.value,
    inCheck,
    mateThreat,
    rookUnderThreat,
    selectedStrategy: selectedStrategy.value,
    opponentFormations: formationNamesForColor(sfen, opponentColor),
    advisedTopics: advisedCoachTopics,
  });
  if (!proposal) return null;
  const budget = PLAN_CONFIRM_SEARCH[props.mobile || boardLayout.value === "portrait" ? "compact" : "standard"];
  const sideToMove = record.value.position.color;
  engine.applyStrengthOptions({ multiPv: 2 });
  engine.setPosition(currentEnginePosition());
  const { value: search, interrupted } = await assistSearchControl.run(
    () => engine!.go({ ...budget, searchMoves: [proposal.swingMove, proposal.otherMove] }),
  );
  if (interrupted || !active.value || moveHistory.length !== historyLength) return null;
  const advice = confirmPlanAdvice(proposal, search.candidates.map((candidate) => ({
    move: candidate.move,
    score: scoreForPlayer(candidate.score, sideToMove, humanColor.value),
  })));
  if (!advice) return null;
  coachPlanOffer.value = {
    planId: advice.swing.planId,
    label: advice.swing.label,
    historyLength,
    selectable: planEntries("game").some(({ plan }) => plan.id === advice.swing.planId),
    swingText: formatHintMove(advice.swingMove, sfen),
    swingScore: formatPlanScore(advice.swingScore),
    otherText: formatHintMove(advice.otherMove, sfen),
    otherScore: formatPlanScore(advice.otherScore),
  };
  lastPlanAdvice = { advice, sfen, historyLength };
  return { key: advice.key, topic: advice.topic, text: advice.text };
}
/** 「◯◯にする」。作戦カードに入れ、まだ使えない段でも使えるようにする。 */
function acceptCoachPlanOffer() {
  const offer = coachPlanOffer.value;
  if (!offer) return;
  coachPlanOffer.value = null;
  coachPlanIds.value = recordCoachPlan(browserStorage(), offer.planId);
  const entry = planEntries("game").find(({ plan }) => plan.id === offer.planId);
  if (!entry) return;
  applyPlan(entry.plan.id, entry.castles[0] ?? "", "game");
  if (coachLevel.value !== "off") guideText.value = `${offer.label}でいこう！ 盤の矢印と薄い駒を目指して指そう。`;
}
function dismissCoachPlanOffer() {
  coachPlanOffer.value = null;
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
    tesuji: flair?.tesuji ?? [],
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
      tickPresenceNews();
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
function onBoardShellPointerDown() {
  releaseImpactHold();
  hideStageCard();
}
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
  // 棋力測定を続けているときは、前の測定対局から持ち越した手も合わせて診断する。
  const carried = measureSession.value ? measureCarry.value?.moves ?? [] : [];
  return estimateSkill(analysisPoints.value, humanColor.value === Color.WHITE ? "white" : "black", carried);
});
/**
 * 測れる手が足りなかったときに、続けて指す測定対局の相手(Lv)。勝ったら強く、負けたら弱くする。
 * 最初の1局を含めて MAX_MEASURE_GAMES 局まで。
 */
const measureNext = computed(() => {
  if (!measureSession.value || !skillDiagnosis.value?.insufficient) return null;
  if ((measureCarry.value?.games ?? 0) + 1 >= MAX_MEASURE_GAMES) return null;
  const from = cpuStrengthLevel();
  if (from === undefined) return null;
  const winner = result.value?.winner;
  const outcome = !winner ? "draw" : winner === humanColor.value ? "win" : "loss";
  return { from, level: nextMeasureLevel({ level: from, outcome }) };
});
/** 「もう1局指す」。この対局の測れた手を持ち越して、相手のLvを変えた測定対局を始める。 */
function continueMeasure() {
  const next = measureNext.value;
  if (!next) return;
  const color = humanColor.value === Color.WHITE ? "white" : "black";
  const carry = {
    moves: [...(measureCarry.value?.moves ?? []), ...measurableMoves(analysisPoints.value, color)],
    games: (measureCarry.value?.games ?? 0) + 1,
  };
  startMeasureMatchNow({ level: next.level, carry });
}
const measureStats = computed(() => (
  measureSession.value && skillDiagnosis.value && !skillDiagnosis.value.insufficient
    ? measureStatistics(analysisPoints.value, humanColor.value === Color.WHITE ? "white" : "black")
    : null
));
const measureReportOpen = computed(() => (
  measureSession.value && !measureReportDismissed.value && Boolean(skillDiagnosis.value)
));
// はじめての案内から測ったときは、測れたらすぐレーティングにする(押し忘れても大会の難易度がずれないように)。
watch(skillDiagnosis, (diagnosis) => {
  if (!measureSession.value || !measureWelcome.value || !diagnosis || diagnosis.insufficient) return;
  if (ratingState.value.rating !== diagnosis.rating) applySkillDiagnosis();
});
/** はじめての案内から測った人への1行。棋力と、竜王戦のちょうどいい難易度。 */
const measureWelcomeLine = computed(() => {
  if (!measureWelcome.value) return "";
  const diagnosis = skillDiagnosis.value;
  const grade = diagnosis && !diagnosis.insufficient ? gradeName(diagnosis.label ?? "") : "";
  const difficulty = ryuoDefaultDifficulty.value;
  return grade
    ? `あなたは${grade}くらい。竜王戦は難易度${difficulty}がちょうどいいよ`
    : `測りきれなかったけど、竜王戦は難易度${difficulty}から始められるよ`;
});
/** 棋力測定の結果から、竜王戦の入口を開く(難易度は、測った棋力に合わせた初期値)。 */
function enterTournamentFromMeasure() {
  leaveFinishedMatch({ toHome: true });
  tournamentStartAt.value = "ryuo";
  tournamentFromGame.value = false;
  tournamentOpen.value = true;
}
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

/**
 * 平手の対CPUの棋戦(自由対局と竜王戦)をレーティングとやこびノートに数える。学習対局・駒落ち・教室の対局は数えない。
 * 竜王戦の相手の強さは、棋士のLvで決まる(startRyuoMatch)。
 */
function recordRatedGame(matchResult: MatchResult) {
  ratingChange.value = null;
  const level = cpuStrengthLevel();
  const tournament = matchKind.value === "tournament" && Boolean(ryuoGame.value);
  const rated = (matchKind.value === "normal" || tournament)
    && normalizedMode.value === "cpu"
    && !tutorialMatch.value
    && matchInitialSfen.value === STANDARD_SFEN
    // Lv0(駒の動きを覚えたて)は練習相手で、レーティングに数えない(docs/level-ladder-design.md)。
    && isRatedLevel(level);
  // 竜王戦の千日手は、先後を入れ替えて指し直す(recordRyuoOutcome)ので、指し直した対局の結果だけを数える。
  if (!rated || (tournament && !matchResult.winner)) return;
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
    event: tournament ? ryuoGame.value?.event ?? "ryuo" : "free",
    opponent: tournament ? ryuoOpponent.value?.name : undefined,
    stage: tournament ? ryuoGame.value?.label : undefined,
  });
  ratingState.value = applied.state;
  ratingChange.value = { before: applied.before, after: applied.after, delta: applied.delta };
  saveRatingState(browserStorage(), applied.state);
  // 自由対局は、中身を裏で解析して、見立てと弱点の練習に使う(竜王戦は大会の統計で解析する)。
  if (!tournament) {
    const insight = enqueuePlayInsight(loadPlayInsight(browserStorage()), { moves: [...moveHistory], color, outcome, level });
    savePlayInsight(browserStorage(), insight);
    playInsight.value = insight;
    void playInsightAnalysis.processQueue();
  }
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
  // 平手・対CPUで終局まで指した対局は、終盤戦の開始局面に使えるよう残す(短い対局は残さない)。
  if (normalizedMode.value === "cpu" && matchInitialSfen.value === STANDARD_SFEN && matchResult.winner) {
    saveRecentGames(browserStorage(), addRecentGame(loadRecentGames(browserStorage()), {
      moves: [...moveHistory],
      winner: matchResult.winner === Color.BLACK ? "black" : "white",
      opponent: matchKind.value === "tournament" ? cpuDisplayName.value : `Lv.${cpuStrengthLevel() ?? ""}`,
    }));
  }
  // 1局指し終えたら、続けて遊んだ日に数える(すぐ投了した対局は数えない)。
  if (matchResult.moveCount >= 2) savePlayStreak(browserStorage(), recordPlay(loadPlayStreak(browserStorage())));
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
  const stageWeight = matchStage.value?.weight ?? "plain";
  const tournamentEvent = ryuoGame.value?.event ?? "ryuo";
  const tournamentFinish = matchKind.value === "tournament" && Boolean(ryuoGame.value) && Boolean(matchResult.winner);
  finishMilestone = null;
  finishCrowned = false;
  recordRyuoOutcome(matchResult);
  if (tournamentFinish) writeTitleKansenki(outcome === "win", matchResult.moveCount);
  if (tournamentFinish) showFinishStamp(outcome === "win", { event: tournamentEvent, weight: stageWeight });
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
    measureWaitHidden.value = false;
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
  const sfenBeforeMove = currentSfen.value;
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
      tesuji: detectTesuji({ sfenBefore: sfenBeforeMove, usi }),
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
  // コレクションのために、プレイヤーが指した手筋(手筋図鑑の項目)を控える。
  if (actor === "player" && !reviewMode.value && normalizedMode.value === "cpu") {
    for (const id of detectTesuji({ sfenBefore: sfenBeforeMove, usi, checkmate: terminalResult?.reason === "checkmate" })) {
      matchTesuji.add(id);
    }
  }
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
      // ロジックAIのLvは、感想戦でもロジックAIで応じる(エンジンは使わない)。今の表には、ロジックAIのLvはない。
      const logicLevel = usesLogicAi(CPU_LOGIC_AI_LEVEL);
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
        ? chooseLogicMove({ sfen: record.value.position.sfen, legalMoves, level: CPU_LOGIC_AI_LEVEL ?? 10, moveHistory })
        : strength.logicHybrid
        ? (await chooseAwareMove({ strength, sfen: record.value.position.sfen, legalMoves, moveHistory, search, verify, probe }))
          ?? chooseLogicMove({ sfen: record.value.position.sfen, legalMoves, moveHistory, level: 10 })
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
      if (getStrengthSearchSettings(searchNodes.value).logicHybrid) {
        const fallback = chooseLogicMove({ sfen: record.value.position.sfen,
          legalMoves: enumerateLegalMoves(record.value.position).map(({ usi }) => usi), moveHistory, level: 10 });
        if (fallback && applyMove(fallback.move, "cpu")) reviewNavigation.value = appendReviewMove(reviewNavigation.value, fallback.move);
      }
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
      let judged: { before: EngineEvaluation; after: EngineEvaluation; afterPv: string[] } | null = null;
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
          // 悪手のときは、相手のいちばんの応手から「なぜ悪いか」を1つ添える。
          moveFeedback = withMistakeReason(getMoveFeedback({
            level: coachLevel.value,
            beforeScore: judged.before,
            afterScore: judged.after,
            wasPromotion: moveFlair.wasPromotion,
            wasEnemyCampDrop: moveFlair.wasEnemyCampDrop,
          }), mistakeReason({
            sfenAfter: record.value.position.sfen,
            playedUsi: moveHistory[moveHistory.length - 1] ?? "",
            pv: judged.afterPv,
            playerColor: humanColor.value === Color.WHITE ? "white" : "black",
          }));
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
      // 対策の練習対局でも、相手の棋風と特徴で指す。
      const cpuCharacter = ryuoGame.value ? ryuoOpponent.value?.character ?? null : ryuoCounterOpponent.value?.character ?? null;
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
        // ロジックAIのLvは、ロジックAIで指す(今の表にはない)。上の探索は、直前のプレイヤーの手への助言にだけ使う。
        const logicLevel = usesLogicAi(CPU_LOGIC_AI_LEVEL);
        if (
          !logicLevel && !selectionStrength.logicHybrid
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
        // 新しい選び方では、作戦手の専用評価も不足候補の評価と同じ1回にまとめる。
        // 作戦手の評価差許容は、やこび姫補助と同じ戦法・囲いの基準に合わせる。
        // ただし強いCPUほどAI最善を優先するため、探索設定の上限は超えない。
        // 低レベルほど倍率を大きくし、多少評価が下がっても決めた作戦の形を作り続ける。
        const planScoreLimit = Math.min(
          openingGuideScoreLossLimit(cpuOpeningPlan?.strategyId ?? "", openingMovePhase)
            * strength.openingPlanScoreScale,
          strength.maxScoreLoss,
        );
        const safeOpening = allowedOpeningMove && !forceConfiguredOpening && !logicLevel && !selectionStrength.logicHybrid
          ? chooseSafeOpeningMove(allowedOpeningMove, searchedCandidates, planScoreLimit)
          : null;
        let selection = forceConfiguredOpening && allowedOpeningMove
          ? { move: allowedOpeningMove }
          : logicLevel
          ? chooseLogicMove({
            sfen: record.value.position.sfen,
            legalMoves: allowedCpuMoveList,
            level: CPU_LOGIC_AI_LEVEL ?? 10,
            moveHistory,
            planMove: allowedOpeningMove ?? null,
          })
          : safeOpening
          ? {
            move: safeOpening.usi,
            rank: searchedCandidates.find(({ move }) => move === safeOpening.usi)?.rank ?? 1,
            }
          : await (selectionStrength.logicHybrid ? chooseAwareMove : chooseCpuMove)({
            strength: selectionStrength,
            sfen: record.value.position.sfen,
            legalMoves: allowedCpuMoveList,
            moveHistory,
            search: { ...search, candidates: searchedCandidates },
            ...(selectionStrength.logicHybrid ? { planMove: allowedOpeningMove ?? null, planScoreLossLimit: planScoreLimit } : {}),
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
        if (!selection && selectionStrength.logicHybrid) selection = chooseLogicMove({
          sfen: record.value.position.sfen, legalMoves: allowedCpuMoveList, level: 10, moveHistory, planMove: allowedOpeningMove ?? null,
        });
        usi = selection?.move ?? "";
        if (cpuCharacter && usi) {
          const kind = (selection as { kind?: string } | null)?.kind ?? "opening";
          const cpuMoveRecord = { ply: moveHistory.length, kind, traits: selectionStrength.activeTraits ?? [] };
          ryuoCpuMoves = [...ryuoCpuMoves.filter(({ ply }) => ply < moveHistory.length), cpuMoveRecord];
          notePresenceCpuMove(cpuMoveRecord);
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
        usi = forceConfiguredOpening && allowedOpeningMove ? allowedOpeningMove
          : usesLogicAi(CPU_LOGIC_AI_LEVEL) || strength.logicHybrid
          ? chooseLogicMove({
            sfen: record.value.position.sfen,
            legalMoves: allowedCpuMoveList,
            level: CPU_LOGIC_AI_LEVEL ?? 10,
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
      const hybridFallback = getStrengthSearchSettings(searchNodes.value).logicHybrid;
      const fallbackAllowed = cpuMovesAllowedByBishopSetting().map(({ usi }) => usi);
      const fallbackPlan = fallbackOpeningMove && fallbackAllowed.includes(fallbackOpeningMove.usi) ? fallbackOpeningMove.usi : null;
      const fallbackTurn = currentCpuOpeningTurn();
      const forceFallbackOpening = shouldForceConfiguredCpuOpening({
        configuredFirstMove: cpuFirstMove.value, bishopPreference: cpuBishopPreference.value, openingMove: fallbackPlan,
        cpuColor: fallbackTurn.cpuColor, cpuMoveCount: fallbackTurn.cpuMoves.length, cpuMoves: fallbackTurn.cpuMoves,
      });
      const fallbackUsi = hybridFallback
        ? forceFallbackOpening && fallbackPlan ? fallbackPlan : chooseLogicMove({
          sfen: record.value.position.sfen, legalMoves: fallbackAllowed, moveHistory, level: 10, planMove: fallbackPlan,
        })?.move
        : fallbackOpeningMove?.usi ?? chooseNaturalMove({
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

/** 検討を終えるボタンの文字。押すと行く先を書く(completeReview・leaveFinishedMatchと同じ分かれ方)。 */
const reviewCompleteLabel = computed(() => {
  if (tutorialMatch.value?.report) return "完了して教室へ";
  if (props.showHome && ryuoGame.value) return ({ meijin: "完了して名人戦へ", shoreikai: "完了して奨励会へ" } as { [key: string]: string })[ryuoGame.value.event ?? ""] ?? "完了して竜王戦へ";
  return props.showHome ? "完了してホームへ" : "完了して対局準備へ";
});

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
  const backEvent = ryuoGame.value?.event;
  stopGuidedReview();
  openPregame();
  if (props.showHome) openHome();
  if (backToTournament) {
    tournamentStartAt.value = backEvent === "meijin" ? "meijin" : backEvent === "shoreikai" ? "shoreikai" : "season";
    tournamentFromGame.value = true;
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
  hideStageCard();
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
  matchTesuji.clear();
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
  resetPresence();
  coachPlanOffer.value = null;
  lastPlanAdvice = null;
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
  closeAssistTools();
  exhibitResetOpen.value = false;
  settingsOpen.value = false;
  resignConfirmOpen.value = false;
  analysisMenuOpen.value = false;
}
function preloadCoachPortraits(fileNames: string[]) {
  for (const filename of fileNames) {
    const portrait = new Image();
    // 表示と同じ版を選ばせるため、srcsetとsizesを先に与えてからsrcを入れる。
    portrait.sizes = coachPortraitSizesValue.value;
    portrait.srcset = coachPortraitSrcset(props.assetBaseUrl, filename);
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
  portraitObserver?.disconnect();
  engine?.quit();
  ryuoStats.dispose();
  playInsightAnalysis.dispose();
  if (typeof window !== "undefined") {
    window.removeEventListener("pagehide", handlePageHide);
    window.removeEventListener("keydown", handleGlobalKeydown);
  }
});
onMounted(() => {
  if (typeof ResizeObserver !== "undefined" && portraitImage.value) {
    portraitObserver = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect.width ?? 0;
      // 隠れている間(幅0)は、前の値か見当のままにする。
      if (width > 0) portraitWidth.value = width;
    });
    portraitObserver.observe(portraitImage.value);
  }
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
