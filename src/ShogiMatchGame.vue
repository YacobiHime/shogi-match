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
        <section class="shogi-home__group" aria-labelledby="shogi-home-school">
          <h2 id="shogi-home-school" class="shogi-home__group-title">入門</h2>
          <div class="shogi-home__cards">
            <button type="button" class="shogi-home__card shogi-home__card--school" @click="tutorialOpen = true">
              <svg class="shogi-home__icon" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
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
              <span class="shogi-home__label">やこび姫の将棋教室</span>
              <small class="shogi-home__desc">ルールから戦法まで楽しく学ぼう</small>
            </button>
          </div>
        </section>
        <section class="shogi-home__group" aria-labelledby="shogi-home-match">
          <h2 id="shogi-home-match" class="shogi-home__group-title">対局</h2>
          <div class="shogi-home__cards">
            <button type="button" class="shogi-home__card" @click="openMatchSetup('normal')">
              <svg class="shogi-home__icon" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
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
              <span class="shogi-home__label">通常対局</span>
              <small class="shogi-home__desc">平手でCPUと真剣勝負</small>
            </button>
            <button type="button" class="shogi-home__card" @click="openMatchSetup('learning')">
              <svg class="shogi-home__icon" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
                <g fill="#fffcf4">
                  <rect x="2" y="3" width="12" height="9" />
                  <rect x="7" y="12" width="2" height="2" />
                  <rect x="4" y="14" width="8" height="1" />
                </g>
                <g fill="#f1a54c">
                  <rect x="4" y="5" width="2" height="2" />
                  <rect x="7" y="5" width="2" height="2" />
                  <rect x="10" y="5" width="2" height="2" />
                  <rect x="4" y="8" width="8" height="2" />
                </g>
              </svg>
              <span class="shogi-home__label">学習対局</span>
              <small class="shogi-home__desc">駒落ちや完成形から練習</small>
            </button>
          </div>
        </section>
        <section class="shogi-home__group" aria-labelledby="shogi-home-dex">
          <h2 id="shogi-home-dex" class="shogi-home__group-title">図鑑</h2>
          <p class="shogi-home__group-note">盤面付きでいろんな解説を収録</p>
          <div class="shogi-home__cards shogi-home__cards--dex">
            <button type="button" class="shogi-home__card" @click="referenceDexKind = 'piece'">
              <svg class="shogi-home__icon" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
                <g fill="#f1a54c">
                  <rect x="5" y="1" width="6" height="1" />
                  <rect x="4" y="2" width="8" height="2" />
                  <rect x="3" y="4" width="10" height="8" />
                  <rect x="4" y="12" width="8" height="2" />
                  <rect x="5" y="14" width="6" height="1" />
                </g>
                <text x="8" y="11" class="shogi-home__koma-char" aria-hidden="true">飛</text>
              </svg>
              <span class="shogi-home__label">駒図鑑</span>
              <small class="shogi-home__desc">動き・役割・弱点</small>
            </button>
            <button type="button" class="shogi-home__card" @click="referenceDexKind = 'tesuji'">
              <svg class="shogi-home__icon" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
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
              <span class="shogi-home__label">手筋図鑑</span>
              <small class="shogi-home__desc">格言と使いどころ</small>
            </button>
            <button type="button" class="shogi-home__card" @click="dexOpen = true">
              <svg class="shogi-home__icon" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
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
              <span class="shogi-home__label">定跡図鑑</span>
              <small class="shogi-home__desc">戦法と囲いの手順</small>
            </button>
            <button type="button" class="shogi-home__card" @click="referenceDexKind = 'world'">
              <svg class="shogi-home__icon" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
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
              <span class="shogi-home__label">将棋界図鑑</span>
              <small class="shogi-home__desc">歴史と名棋士</small>
            </button>
          </div>
        </section>
      </nav>
    </div>

    <ShogiOpeningDex
      v-if="dexOpen"
      :asset-base-url="assetBaseUrl"
      @close="dexOpen = false"
    />
    <ShogiTutorial
      v-if="tutorialOpen"
      :asset-base-url="assetBaseUrl"
      :match-report="tutorialReport"
      @close="tutorialOpen = false; tutorialReport = null"
      @open-dex="openDexFromTutorial"
      @start-match="startMatchFromTutorial"
    />
    <!-- 図鑑は教室の上に重ねて開き、閉じると教室へ戻る。 -->
    <ShogiReferenceDex
      v-if="referenceDexKind"
      :kind="referenceDexKind"
      :initial-id="referenceDexInitialId"
      :asset-base-url="assetBaseUrl"
      @close="referenceDexKind = ''"
    />

    <header class="shogi-game__header">
      <div class="shogi-game__status" aria-live="polite">
        <strong>{{ statusText }}</strong>
        <span>{{ moveCount }}手目</span>
      </div>
      <div
        class="shogi-game__toolbar"
        :class="{ 'shogi-game__toolbar--learning': matchKind === 'learning' }"
      >
        <template v-if="!menuCollapsed">
          <button
            type="button"
            class="shogi-game__command"
            :class="reviewMode ? 'shogi-game__command--complete' : 'shogi-game__command--danger'"
            :disabled="!active"
            @click="reviewMode ? completeReview() : requestResign()"
          >{{ reviewMode ? "完了" : "投了" }}</button>
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
        <div class="shogi-game__match-kind" role="radiogroup" aria-label="対局の種類">
          <button
            v-for="kind in MATCH_KIND_OPTIONS"
            :key="kind.value"
            type="button"
            role="radio"
            :aria-checked="matchKind === kind.value"
            :class="{ 'shogi-game__match-kind--active': matchKind === kind.value }"
            @click="matchKind = kind.value"
          >
            <strong>{{ kind.label }}</strong>
            <small>{{ kind.description }}</small>
          </button>
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
          <div v-if="normalizedMode === 'cpu' && !pregameUsesCustomStart" class="shogi-game__pregame-field">
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
                  <select
                    v-model="cpuDetailedStrategy"
                    aria-label="対局前の相手の戦法を指定"
                    :disabled="cpuStrategySelectLocked"
                  >
                    <option value="">{{ cpuStrategySelectLocked ? "囲いと一体のため選べません" : "指定なし" }}</option>
                    <optgroup v-for="group in cpuDetailedStrategyGroups" :key="group.id" :label="group.label">
                      <option v-for="strategy in group.options" :key="strategy.id" :value="strategy.id">
                        {{ strategy.label }}
                      </option>
                    </optgroup>
                  </select>
                </label>
                <label>
                  <span>囲い</span>
                  <select
                    v-model="cpuDetailedCastle"
                    aria-label="対局前の相手の囲いを指定"
                    :disabled="cpuCastleSelectLocked"
                  >
                    <option value="">{{ cpuCastleSelectLocked ? "戦法と一体のため選べません" : "指定なし" }}</option>
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
            v-if="normalizedMode === 'cpu' && !pregameUsesCustomStart"
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
            v-if="normalizedMode === 'cpu' && !(matchKind === 'learning' && learningStartType === 'handicap')"
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
              v-if="selectedPlayerColor === 'white' && !pregameUsesCustomStart"
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
          <template v-if="matchKind === 'learning'">
            <div class="shogi-game__pregame-field shogi-game__pregame-field--learning">
              <span>開始局面</span>
              <div class="shogi-game__learning-start">
                <select v-model="learningStartType" aria-label="学習対局の開始局面">
                  <option value="standard">平手の初期局面</option>
                  <option value="handicap">駒落ち</option>
                  <option value="formation">戦法・囲いが完成した局面</option>
                </select>
                <div v-if="learningStartType === 'handicap'" class="shogi-game__opening-tendency">
                  <label>
                    <span>駒落ち</span>
                    <select v-model="learningHandicapId" aria-label="駒落ちの種類">
                      <option v-for="handicap in LEARNING_HANDICAPS" :key="handicap.id" :value="handicap.id">
                        {{ handicap.label }}
                      </option>
                    </select>
                  </label>
                  <label>
                    <span>駒を落とす側</span>
                    <select v-model="learningHandicapGiver" aria-label="駒を落とす側">
                      <option value="cpu">相手（自分は下手）</option>
                      <option value="player">自分（自分は上手）</option>
                    </select>
                  </label>
                </div>
                <div v-if="learningStartType === 'formation'" class="shogi-game__learning-plans">
                  <fieldset
                    v-for="side in LEARNING_PLAN_SIDES"
                    :key="side.id"
                    class="shogi-game__learning-plan"
                  >
                    <legend>{{ side.label }}</legend>
                    <label>
                      <span>戦法</span>
                      <select
                        :value="side.id === 'player' ? learningPlayerStrategy : learningOpponentStrategy"
                        :aria-label="`${side.label}の完成させる戦法`"
                        @change="setLearningPlan(side.id, 'strategy', ($event.target as HTMLSelectElement).value)"
                      >
                        <option value="">選択しない</option>
                        <optgroup
                          v-for="group in (side.id === 'player' ? learningPlayerPlanOptions : learningOpponentPlanOptions).strategies"
                          :key="group.id"
                          :label="group.label"
                        >
                          <option v-for="strategy in group.options" :key="strategy.id" :value="strategy.id">
                            {{ strategy.optionLabel }}
                          </option>
                        </optgroup>
                      </select>
                    </label>
                    <label>
                      <span>囲い</span>
                      <select
                        :value="side.id === 'player' ? learningPlayerCastle : learningOpponentCastle"
                        :aria-label="`${side.label}の完成させる囲い`"
                        :disabled="isStandaloneOpening(side.id === 'player' ? learningPlayerStrategy : learningOpponentStrategy, 'strategy')"
                        @change="setLearningPlan(side.id, 'castle', ($event.target as HTMLSelectElement).value)"
                      >
                        <option value="">
                          {{ isStandaloneOpening(side.id === "player" ? learningPlayerStrategy : learningOpponentStrategy, "strategy") ? "戦法に含む" : "選択しない" }}
                        </option>
                        <optgroup
                          v-for="group in (side.id === 'player' ? learningPlayerPlanOptions : learningOpponentPlanOptions).castles"
                          :key="group.id"
                          :label="group.label"
                        >
                          <option v-for="castle in group.options" :key="castle.id" :value="castle.id">
                            {{ castle.optionLabel }}
                          </option>
                        </optgroup>
                      </select>
                    </label>
                  </fieldset>
                </div>
                <small
                  v-if="learningFormationMessage"
                  :class="{ 'shogi-game__learning-error': learningStartBlocked }"
                  role="status"
                >{{ learningFormationMessage }}</small>
              </div>
            </div>
            <div class="shogi-game__pregame-field shogi-game__pregame-field--assist">
              <span>閃き・待ったの回数</span>
              <div class="shogi-game__opening-tendency">
                <label>
                  <span>閃き</span>
                  <select v-model.number="learningHintLimit" aria-label="閃きの回数">
                    <option v-for="limit in LEARNING_ASSIST_LIMITS" :key="limit.value" :value="limit.value">
                      {{ limit.label }}
                    </option>
                  </select>
                </label>
                <label>
                  <span>待った</span>
                  <select v-model.number="learningUndoLimit" aria-label="待ったの回数">
                    <option v-for="limit in LEARNING_ASSIST_LIMITS" :key="limit.value" :value="limit.value">
                      {{ limit.label }}
                    </option>
                  </select>
                </label>
              </div>
              <small>対局中は「駒の利き」ボタンで、各マスに利いている駒の数を表示できます。</small>
            </div>
          </template>
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
            :disabled="(normalizedMode === 'cpu' && !engineReady && !engineUnavailable) || learningStartBlocked"
            @click="beginMatch"
          >
            {{ normalizedMode === "cpu" && !engineReady && !engineUnavailable ? "準備中…" : "対局開始" }}
          </button>
        </div>
      </div>
    </div>

    <section class="shogi-game__summary" aria-label="対戦相手と戦型">
      <div v-if="cpuColor !== null" class="shogi-game__summary-opponent">
        <b>対戦相手</b>
        <span>{{ cpuColor === Color.BLACK ? "☗" : "☖" }}{{ cpuDisplayName }}<small v-if="cpuStrengthLabel">{{ cpuStrengthLabel }}</small></span>
      </div>
      <div><b>先手</b><span>{{ blackFormationText }}</span></div>
      <div><b>後手</b><span>{{ whiteFormationText }}</span></div>
    </section>

    <section class="shogi-game__opening-guide" aria-label="やこび姫補助">
      <h2>やこび姫補助</h2>
      <p v-if="!openingGuideAvailable" class="shogi-game__opening-guide-note">駒落ちや完成形からの対局では、定跡の道しるべはお休みだよ。</p>
      <div v-if="openingGuideAvailable" class="shogi-game__opening-selects">
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
        :black-player-name="effectiveBlackPlayerName"
        :white-player-name="effectiveWhitePlayerName"
        :black-player-detail="cpuColor === Color.BLACK ? cpuStrengthLabel : ''"
        :white-player-detail="cpuColor === Color.WHITE ? cpuStrengthLabel : ''"
        :candidates="boardCandidates"
        :attack-marks="boardAttackMarks"
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
        <span class="shogi-game__dialogue-text"><template
          v-for="(segment, index) in dialogueSegments"
          :key="index"
        ><ruby v-if="segment.ruby">{{ segment.text }}<rt>{{ segment.ruby }}</rt></ruby><template
          v-else
        >{{ segment.text }}</template></template></span>
      </div>
    </section>

    <!-- 棋譜解析中は、閃きを解析パネルの操作列へ移す。 -->
    <div v-if="!(reviewMode && analysisOpen && !reviewCpuEnabled)" class="shogi-game__assist-actions">
      <button
        v-if="!(reviewMode && analysisOpen)"
        type="button"
        class="shogi-game__awakening"
        :disabled="!canUseHint"
        @click="showHint"
      >
        閃き <small>×{{ reviewMode ? "∞" : formatAssistCount(hintsRemaining) }}</small>
      </button>
      <button v-if="!reviewMode || reviewCpuEnabled" type="button" :disabled="!canUndo" @click="undoTurn">
        待った <small>×{{ reviewMode ? "∞" : formatAssistCount(undosRemaining) }}</small>
      </button>
      <button
        type="button"
        class="shogi-game__assist-toggle shogi-game__command--flip"
        aria-label="盤面を上下反転（ひふみんアイ）"
        :aria-pressed="boardFlipOverride"
        @click="boardFlipOverride = !boardFlipOverride"
      >ひふみん<wbr>アイ</button>
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
          <button type="button" class="shogi-game__analysis-awakening" :disabled="!canUseHint" @click="showHint">閃き</button>
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
          <button
            type="button"
            role="menuitemcheckbox"
            :aria-checked="boardFlipOverride"
            @click="boardFlipOverride = !boardFlipOverride"
          >ひふみんアイ（盤を反転）：{{ boardFlipOverride ? "ON" : "OFF" }}</button>
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
          <!-- 教室の対局は、やこび姫の一言と★を見に教室へ戻る。 -->
          <button v-if="tutorialMatch" type="button" class="shogi-game__rematch" @click="returnToTutorial">教室へ戻る</button>
          <button v-else type="button" class="shogi-game__rematch" @click="openPregame">対局準備</button>
          <button type="button" class="shogi-game__analysis-button" @click="startKifuAnalysis">棋譜解析</button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, toRaw, watch, type Ref } from "vue";
import { Color, PieceType, Position, Record, Square, promotedPieceType, reverseColor } from "tsshogi";
import ShogiMatchBoard from "./ShogiMatchBoard.vue";
import ShogiOpeningDex from "./ShogiOpeningDex.vue";
import ShogiReferenceDex from "./ShogiReferenceDex.vue";
import ShogiTutorial from "./ShogiTutorial.vue";
import { tutorialLesson } from "./core/tutorial-curriculum.mjs";
import { tutorialMatchOutcome } from "./core/tutorial-runner.mjs";
import EvaluationGraph from "./EvaluationGraph.vue";
import { useResponsiveLayout } from "./composables/useResponsiveLayout";
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
import { chooseCpuMove, chooseNaturalMove } from "./core/cpu-move-choice.mjs";
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
  normalizeStrengthValue,
  strengthPresetFor,
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
import { createMoveSoundPlayer, selectMoveSound } from "./core/move-sound";
import {
  clearMatchSnapshot,
  loadMatchSnapshot,
  matchSnapshotKey,
  persistedResult,
  recordAndFormationsFromMoves,
  savedMatchNumber,
  saveMatchSnapshot,
} from "./core/match-persistence.mjs";
import hiraganaFormationMaster from "./data/hiragana_suisho_formations.json";

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
type MatchKind = "normal" | "learning";
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

/** 棋譜の手番号が先手の手か。駒落ちでは上手（後手）から指し始める。 */
function isBlackMoveIndex(index: number) {
  const blackFirst = matchInitialSfen.value.trim().split(/\s+/)[1] !== "w";
  return (index % 2 === 0) === blackFirst;
}

function matchHintAllowance() {
  return matchKind.value === "learning"
    ? assistAllowance(learningHintLimit.value)
    : Math.max(0, Math.trunc(props.hintCount));
}

function matchUndoAllowance() {
  return matchKind.value === "learning"
    ? assistAllowance(learningUndoLimit.value)
    : Math.max(0, Math.trunc(props.undoCount));
}

const errorMessage = ref("");
const record = ref<Record>(createRecord());
const currentSfen = ref(record.value.position.sfen);
const lastMove = ref("");
const active = ref(false);
const matchStarted = ref(false);
const pregameOpen = ref(true);
const homeOpen = ref(props.showHome);
const dexOpen = ref(false);
// 駒図鑑・手筋図鑑・将棋界図鑑のうち、開いているもの。
const referenceDexKind = ref<"" | "piece" | "tesuji" | "world">("");
const referenceDexInitialId = ref("");
// やこび姫の将棋教室を開いているか。
const tutorialOpen = ref(false);
// 教室のレッスンから始めた対局。終局後は教室へ戻り、reportで★を付ける。
type TutorialMatchReport = { lessonId: string; outcome: "win" | "lose" | "draw"; reason: string; assistsUsed: number };
const tutorialMatch = ref<{ lessonId: string; playerColor: "black" | "white"; report: TutorialMatchReport | null } | null>(null);
const tutorialReport = ref<TutorialMatchReport | null>(null);
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
  usi: string;
  wasPromotion: boolean;
  wasEnemyCampDrop: boolean;
  fromHint: boolean;
  trivial: boolean;
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
// 人間最高峰プリセット（48万ノード）相当の探索を毎手行わない。
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
const analysisCurrentPoint = computed(() =>
  analysisPoints.value.find(({ ply }) => ply === reviewNavigation.value.cursor)
);
// CPU対局ではCPU側の名前にレベルを添え、棋力の説明を2行目に出す。
const cpuColor = computed(() => (normalizedMode.value === "cpu" ? reverseColor(humanColor.value) : null));
const cpuStrengthPreset = computed(() => strengthPresetFor(searchNodes.value));
const cpuDisplayName = computed(() => {
  const name = props.cpuPlayerName.trim() || "CPU";
  return cpuStrengthPreset.value ? `${name} Lv.${cpuStrengthPreset.value.level}` : name;
});
const cpuStrengthLabel = computed(() => cpuStrengthPreset.value?.label ?? "");
const effectiveBlackPlayerName = computed(() =>
  cpuColor.value === Color.BLACK ? cpuDisplayName.value : props.blackPlayerName,
);
const effectiveWhitePlayerName = computed(() =>
  cpuColor.value === Color.WHITE ? cpuDisplayName.value : props.whitePlayerName,
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
    return castle ? [{ ...castle, label: `${label}（あと${distance}手）`, disabled: false }] : [];
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

function formationTextForColor(color: Color): string {
  const key = color === Color.BLACK ? "black" : "white";
  const names = formationNamesFromState(formationState.value, key, 3);
  return names.length ? names.join("・") : "まだ未判定";
}

function observeFormations(sfen: string) {
  formationState.value = updateFormationState(
    formationState.value,
    formationSnapshotForSfen(sfen),
  );
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

function openMatchSetup(kind: MatchKind) {
  matchKind.value = kind;
  closeHome();
}

/** 教室のレッスンから、関連する図鑑の項目を開く。 */
function openDexFromTutorial({ kind, id }: { kind: string; id?: string }) {
  if (kind === "opening") {
    dexOpen.value = true;
    return;
  }
  if (kind === "piece" || kind === "tesuji" || kind === "world") {
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
function startMatchFromTutorial({ lessonId, preset }: {
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
    lastMoveWasCapture: Boolean(record.value.current.move?.capturedPieceType),
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
    },
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
  matchKind.value = snapshot.matchKind === "learning" ? "learning" : "normal";
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
  tutorialMatch.value = matchKind.value === "learning" ? restoredTutorialMatch(snapshot.tutorial) : null;
  settingsBeforeTutorial = tutorialMatch.value && snapshot.settingsBeforeTutorial && typeof snapshot.settingsBeforeTutorial === "object"
    ? snapshot.settingsBeforeTutorial
    : null;
}

function restoredTutorialMatch(value: unknown): typeof tutorialMatch.value {
  if (!value || typeof value !== "object") return null;
  const { lessonId, playerColor, report } = value as { [key: string]: any };
  if (typeof lessonId !== "string" || !tutorialLesson(lessonId)) return null;
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
      const choice = plannedOptions.length
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
  updateCoachAdviceFromPlayerScore(score, moveFeedback ?? riskAdvice, false);
}

function scheduleDedicatedCoachAdvice(
  moveFeedback?: { key: string; text: string } | null,
) {
  dedicatedCoachQueue = dedicatedCoachQueue
    .catch(() => undefined)
    .then(async () => {
      await updateDedicatedCoachAdvice(moveFeedback);
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

const moveSounds = createMoveSoundPlayer(() => props.assetBaseUrl);

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
  moveSounds.play(selectMoveSound(
    move.capturedPieceType,
    terminalResult?.reason === "checkmate" || isSideToMoveInCheck(currentSfen.value),
  ));
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
  const assistSearchInterrupted = !reviewMode.value && assistSearchControl.interrupt();
  if (assistSearchInterrupted) engine?.stop();
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
        // setPositionが「position sfen」を付けるため、SFENだけを渡す。
        const enginePosition = currentEnginePosition();
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
        // 閃き候補を指した場合は、深さの違う再探索と混ぜず同じ探索内で比較する。
        const playerAfterScore = reusedHintAssessment?.afterScore ?? scoreForPlayer(
          bestCpuScore,
          record.value.position.color,
          humanColor.value,
        );
        moveFeedback = getMoveFeedback({
          level: coachLevel.value,
          beforeScore: comparableBeforeScore,
          afterScore: playerAfterScore,
          wasPromotion: moveFlair?.wasPromotion,
          wasEnemyCampDrop: moveFlair?.wasEnemyCampDrop,
        });
        // 悪手の指摘を最優先し、それ以外では好手や形勢の転換点を褒める。
        const mistake = moveFeedback && /move-(blunder|mistake)/.test(moveFeedback.key);
        const praise = await playerMovePraise({
          historyLength: playerMoveHistoryLength,
          flair: moveFlair,
          beforeScore: comparableBeforeScore,
          afterScore: playerAfterScore,
          fallback: moveFeedback,
          cpuCandidates: search.candidates,
          generation,
        });
        if (!mistake) moveFeedback = praise;
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
        // 低レベルほど倍率を大きくし、多少評価が下がっても決めた作戦の形を作り続ける。
        const planScoreLimit = Math.min(
          openingGuideScoreLossLimit(cpuOpeningPlan?.strategyId ?? "", openingMovePhase)
            * strength.openingPlanScoreScale,
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
  // 教室の対局を振り返ったあとは、教室の結果画面へ戻る。
  if (tutorialMatch.value?.report) {
    returnToTutorial();
    return;
  }
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
    const base = matchInitialSfen.value === STANDARD_SFEN
      ? "startpos"
      : matchInitialSfen.value;
    const replay = createGameRecord(matchInitialSfen.value);
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
  playerMoveBaseline = undefined;
  playerMoveBaselineGeneration += 1;
  lastCpuCapture = undefined;
  turningPointState = createTurningPointState();
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
  /* 配色はやこび姫のドット絵の色に合わせる。 */
  --night: #1d303f;
  --night-deep: #172632;
  --slate: #2b465b;
  --slate-light: #445c6d;
  --amber: #f1a54c;
  --amber-shadow: #b57c39;
  --ivory: #fffcf4;
  --lavender: #d7d1fd;
  --peach: #fbd6bc;
  --rust: #e3914e;
  --muted: rgba(255, 252, 244, 0.72);
  --gold: var(--amber);
  --ink: var(--ivory);
  --panel: rgba(23, 38, 50, 0.94);
  --line: rgba(241, 165, 76, 0.5);
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
    radial-gradient(circle at 8% 18%, rgba(241, 165, 76, 0.16) 0 2px, transparent 3px),
    radial-gradient(circle at 91% 13%, rgba(215, 209, 253, 0.18) 0 2px, transparent 3px),
    radial-gradient(circle at 83% 78%, rgba(255, 252, 244, 0.13) 0 1px, transparent 2px),
    linear-gradient(135deg, transparent 0 68%, rgba(43, 70, 91, 0.18) 68% 100%),
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
  border: 1px solid rgba(241, 165, 76, 0.68);
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
  border-color: rgba(255, 252, 244, 0.2);
  color: rgba(255, 252, 244, 0.45);
  background: rgba(43, 70, 91, 0.5);
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
  border-color: var(--rust);
  color: var(--peach) !important;
}
.shogi-game__command--complete {
  border-color: var(--amber);
  color: var(--night-deep) !important;
  background: var(--amber) !important;
  box-shadow: 0 2px 0 var(--amber-shadow);
}
.shogi-game button.shogi-game__command--flip[aria-pressed="true"] {
  border-color: var(--lavender);
  color: var(--night-deep);
  background: var(--lavender);
  box-shadow: 0 2px 0 rgba(23, 38, 50, 0.6), inset 0 0 0 2px var(--night-deep);
}
.shogi-game__menu-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.8em;
  padding-inline: 0.65em;
  border-color: rgba(215, 209, 253, 0.62) !important;
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
  border: 1px solid rgba(241, 165, 76, 0.72);
  border-top: 3px solid var(--amber);
  border-radius: 0.3em;
  background: rgba(23, 38, 50, 0.98);
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
  border-color: var(--rust) !important;
  color: var(--peach) !important;
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
  border: 1px solid rgba(241, 165, 76, 0.6);
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
/* 盤上の名前欄は盤と一緒に縮むため、読める大きさの対戦相手表示をここにも置く。 */
.shogi-game__summary {
  flex-wrap: wrap;
}
.shogi-game .shogi-game__summary-opponent {
  flex: 1 1 100%;
}
.shogi-game__summary-opponent small {
  margin-left: 0.5em;
  color: var(--muted);
  font-size: 0.92em;
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
  background: rgba(23, 38, 50, 0.96);
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
  border: 1px solid rgba(241, 165, 76, 0.6);
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
  border-color: rgba(215, 209, 253, 0.6);
  border-radius: 0.2em;
  color: var(--ivory);
  background: rgba(43, 70, 91, 0.9);
  box-shadow: none;
  font-size: 0.75em;
}
.shogi-game__rook-choice {
  display: grid;
  gap: 0.4em;
  padding: 0.5em;
  border: 1px solid rgba(241, 165, 76, 0.55);
  color: var(--ivory);
  background: rgba(43, 70, 91, 0.6);
  font-size: 0.9em;
}
.shogi-game__rook-choice > span {
  color: var(--amber);
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
  border-color: rgba(215, 209, 253, 0.6);
  color: var(--ivory);
  background: var(--slate);
}
.shogi-game .shogi-game__rook-choice button:first-child {
  border-color: var(--amber);
  color: var(--night-deep);
  background: var(--amber);
}
.shogi-game__opening-guide p {
  margin: 0;
  padding: 0.45em 0.6em;
  border-left: 3px solid var(--lavender);
  color: var(--ivory);
  background: rgba(43, 70, 91, 0.58);
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
  background: var(--slate);
  box-shadow: inset 3px 0 0 var(--amber);
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
  /* 盤内の名前札・時計（z-index 30）が、見出しから開くメニューより手前に出ないようにする。 */
  isolation: isolate;
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
  filter: drop-shadow(0 0 0.25rem rgba(241, 165, 76, 0.45));
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
.shogi-game__dialogue-text rt {
  font-size: 0.55em;
  color: var(--muted);
}
.shogi-game__assist-actions {
  display: flex;
  grid-area: actions;
  flex-wrap: wrap;
  gap: 0.5em;
  min-width: 0;
}
/* ボタンは同じ幅に並べ、狭いときは「閃き／×3」「ひふみん／アイ」のように区切りで2行にする。 */
.shogi-game__assist-actions > button {
  flex: 1 1 0;
  min-width: 0;
  min-height: 3em;
  padding: 0.4em 0.3em;
  font-size: 1.02em;
  line-height: 1.15;
  white-space: normal;
  word-break: keep-all;
}
/* ひふみんアイ・駒の利きは、閃き・待ったと同じ並びの切り替えボタンにする。 */
.shogi-game .shogi-game__assist-actions > .shogi-game__assist-toggle {
  font-size: 0.9em;
}
.shogi-game .shogi-game__assist-actions > .shogi-game__assist-toggle[aria-pressed="true"] {
  border-color: var(--lavender);
  color: var(--night-deep);
  background: var(--lavender);
  box-shadow: 0 2px 0 rgba(23, 38, 50, 0.6), inset 0 0 0 2px var(--night-deep);
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
  box-shadow: 0 2px 0 var(--amber-shadow);
}
.shogi-game .shogi-game__awakening:disabled {
  border-color: rgba(255, 252, 244, 0.2);
  color: rgba(255, 252, 244, 0.45);
  background: rgba(43, 70, 91, 0.5);
  box-shadow: none;
}
.shogi-game .shogi-game__analysis-button {
  border-color: rgba(215, 209, 253, 0.62);
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
  border: 1px solid var(--slate);
  border-radius: 0.2em;
  color: var(--night-deep);
  background: #fff;
  font-size: 1em;
}
.shogi-game__analysis-progress {
  color: var(--slate);
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
/* 矢印と解析の操作を1列にまとめ、評価値グラフの高さを確保する。 */
.shogi-game__analysis-actions {
  position: relative;
  display: flex;
  flex-wrap: nowrap;
  gap: 0.3em;
  min-width: 0;
}
.shogi-game__analysis-nav,
.shogi-game__analysis-tools {
  display: flex;
  flex: 1 1 0;
  flex-wrap: nowrap;
  gap: 0.2em;
  min-width: 0;
}
.shogi-game__analysis-nav {
  flex-grow: 0.85;
}
.shogi-game__analysis-tools {
  flex-grow: 2;
}
/* 「その他」は▾まで収まるよう、ほかの操作より少し広くする。 */
.shogi-game .shogi-game__analysis-actions .shogi-game__analysis-more {
  flex-grow: 1.5;
  padding-inline: 0.1em;
  font-size: 0.94em;
}
.shogi-game .shogi-game__analysis-actions button {
  flex: 1 1 0;
  min-width: 0;
  min-height: 2.4em;
  padding: 0.2em 0.25em;
  white-space: nowrap;
  border-color: var(--slate);
  color: var(--night-deep);
  background: #fff;
  box-shadow: none;
}
.shogi-game .shogi-game__analysis-actions .shogi-game__analysis-awakening:not(:disabled) {
  border-color: var(--amber);
  background: #fff3df;
  font-weight: 700;
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
  background: linear-gradient(180deg, transparent 0 55%, rgba(23, 38, 50, 0.6) 100%);
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
  flex-wrap: nowrap;
  align-items: stretch;
  gap: 0.3em;
  padding: 0.5em 0.7em;
  font-size: 0.95em;
}
.shogi-game--wide .shogi-game__summary span {
  white-space: normal;
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
  border-color: var(--rust);
  color: var(--ivory);
  background: var(--slate);
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
  border: 1px solid rgba(241, 165, 76, 0.78);
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
  border-color: var(--rust);
  color: var(--night-deep);
  background: var(--rust);
}
.shogi-game__opening-explanation-panel {
  width: min(31em, 100%);
  max-height: calc(100% - 1em);
  overflow-y: auto;
  padding: 1.1em;
  border: 1px solid rgba(241, 165, 76, 0.78);
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
  background: rgba(23, 38, 50, 0.72);
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
  background: rgba(23, 38, 50, 0.96);
  backdrop-filter: blur(0.4rem);
}
.shogi-game__pregame-panel {
  width: min(46em, 100%);
  max-height: 100%;
  padding: clamp(0.9em, 3vw, 2em);
  overflow: auto;
  overscroll-behavior: contain;
  border: 1px solid rgba(241, 165, 76, 0.72);
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
  border: 1px solid rgba(255, 252, 244, 0.5);
  border-radius: 999px;
  color: #fffcf4;
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
  border: 1px solid rgba(215, 209, 253, 0.24);
  border-radius: 0.2em;
  background: rgba(23, 38, 50, 0.58);
}
.shogi-game__pregame-field span {
  color: var(--amber);
  font-weight: 700;
}
.shogi-game__pregame-field select {
  width: 100%;
  min-height: 2.8em;
  padding: 0.4em 0.6em;
  border: 1px solid rgba(241, 165, 76, 0.68);
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
  border-top: 1px solid rgba(241, 165, 76, 0.3);
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
  box-shadow: 0 3px 0 var(--amber-shadow);
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
  background: linear-gradient(180deg, rgba(43, 70, 91, 0) 0, var(--slate) 0.8em);
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
  background: rgba(23, 38, 50, 0.86);
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
  --result-glow: rgba(241, 165, 76, 0.18);
}
.shogi-game__result--defeat {
  --result-accent: var(--lavender);
  --result-glow: rgba(215, 209, 253, 0.16);
}
.shogi-game__result--draw {
  --result-accent: rgba(255, 252, 244, 0.7);
  --result-glow: rgba(255, 252, 244, 0.12);
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
  border-bottom: 1px solid rgba(241, 165, 76, 0.3);
  background: rgba(43, 70, 91, 0.35);
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
  color: var(--night-deep);
  background: var(--amber);
  box-shadow: 0 2px 0 var(--amber-shadow);
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
  gap: 32px;
  /* 下部のキャラクターの分を空け、メニューがキャラクターに重ならないようにする。 */
  padding: 24px 24px clamp(150px, 27vh, 250px);
  overflow: hidden;
  background: #1d303f;
  color: var(--ink, #fffcf4);
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
  background: #fffcf4;
  box-shadow: inset -12px -6px 0 0 #1d303f;
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
  color: #fffcf4;
  text-shadow: 3px 3px 0 #172632;
}
.shogi-home__menu {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: flex-start;
  gap: clamp(16px, 3vw, 40px);
}
.shogi-home__group {
  display: grid;
  gap: 10px;
}
.shogi-home__group-title {
  margin: 0;
  padding-left: 4px;
  color: #e8a04c;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.24em;
}
.shogi-home__cards {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(118px, 160px);
  gap: clamp(10px, 2vw, 20px);
}
.shogi-home__group-note {
  margin: -6px 0 0;
  padding-left: 4px;
  color: #cfd8de;
  font-size: 12px;
}
.shogi-home__desc {
  color: #cfd8de;
  font-size: 11px;
  line-height: 1.4;
  text-align: center;
}
.shogi-home__card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 22px 10px 18px;
  border: 2px solid rgba(255, 252, 244, 0.4);
  border-radius: 8px;
  background: rgba(43, 70, 91, 0.9);
  box-shadow: 4px 4px 0 rgba(23, 38, 50, 0.8);
  color: #fffcf4;
  font: inherit;
  cursor: pointer;
}
.shogi-home__card:not(:disabled):hover {
  border-color: #f1a54c;
  transform: translate(-1px, -1px);
  box-shadow: 5px 5px 0 rgba(23, 38, 50, 0.8);
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
  background: #f1a54c;
  color: #1d303f;
  font-size: 10px;
  font-weight: 700;
}
.shogi-home__koma-char {
  font-size: 9px;
  font-weight: 700;
  fill: #1d303f;
  text-anchor: middle;
  font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif;
}
@media (max-width: 640px) {
  /* 下部のキャラクターと重ならないよう、メニューを上側へ寄せる。 */
  .shogi-home { gap: 24px; padding-bottom: clamp(140px, 26vh, 220px); }
  .shogi-home__label { font-size: 13px; letter-spacing: 0.02em; white-space: nowrap; }
  .shogi-home__menu { flex-direction: column; align-items: stretch; width: 100%; max-width: 380px; gap: 18px; }
  .shogi-home__cards { grid-auto-columns: minmax(0, 1fr); }
  /* 図鑑の4枚は、狭い画面では2列2段に並べる。 */
  .shogi-home__cards--dex { grid-auto-flow: row; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  /* メニューが縦に長くなるため、月をタイトルと重ならない右上へ寄せる。 */
  .shogi-home__moon { top: 3%; right: 6%; width: 32px; height: 32px; box-shadow: inset -9px -4px 0 0 #1d303f; }
  /* 入門・対局・図鑑の3段が収まるよう、カードは「アイコン＋名前・説明」の横並びにする。 */
  .shogi-home__card {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-rows: auto auto;
    column-gap: 10px;
    row-gap: 2px;
    align-items: center;
    justify-items: start;
    padding: 8px 10px;
    text-align: left;
  }
  .shogi-home__icon { grid-row: 1 / 3; width: 36px; height: 36px; }
  .shogi-home__desc { text-align: left; }
}
@media (max-width: 640px) and (max-height: 760px) {
  .shogi-home { gap: 14px; padding-bottom: 104px; }
  .shogi-home__chara { height: 92px; bottom: 8px; }
  .shogi-home__icon { width: 32px; height: 32px; }
}
/* ===== 学習対局 ===== */
.shogi-game__match-kind {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
  margin-bottom: 0.85rem;
}
.shogi-game .shogi-game__match-kind button {
  display: grid;
  gap: 0.15rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid rgba(245, 166, 69, 0.45);
  color: var(--ivory, #fff8ec);
  background: rgba(20, 39, 54, 0.58);
  text-align: left;
}
.shogi-game .shogi-game__match-kind button.shogi-game__match-kind--active {
  border-color: var(--amber, #f5a645);
  color: var(--night-deep, #14212e);
  background: var(--amber, #f5a645);
}
.shogi-game__match-kind small {
  font-size: 0.72rem;
  opacity: 0.85;
}
.shogi-game__pregame-field--learning,
.shogi-game__pregame-field--assist {
  grid-column: 1 / -1;
}
.shogi-game__learning-start {
  display: grid;
  gap: 0.6rem;
  min-width: 0;
}
.shogi-game__learning-start .shogi-game__opening-tendency {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.shogi-game__pregame-field--assist .shogi-game__opening-tendency {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.shogi-game__learning-plans {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
}
.shogi-game__learning-plan {
  display: grid;
  gap: 0.4rem;
  min-width: 0;
  margin: 0;
  padding: 0.5rem 0.6rem 0.6rem;
  border: 1px solid rgba(215, 206, 255, 0.24);
  border-radius: 0.2rem;
}
.shogi-game__learning-plan legend {
  padding: 0 0.3rem;
  color: var(--amber, #f5a645);
  font-weight: 700;
}
.shogi-game__learning-plan label {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
}
.shogi-game__learning-plan label > span {
  font-size: 0.78rem;
  font-weight: 600;
  opacity: 0.86;
}
.shogi-game__learning-start > small,
.shogi-game__pregame-field--assist > small {
  color: #d5c3bd;
  font-size: 0.75rem;
}
.shogi-game__learning-start > small.shogi-game__learning-error {
  color: #ffb4a8;
  font-weight: 700;
}
.shogi-game__toolbar--learning .shogi-game__turn {
  grid-column: 1 / -1;
}
.shogi-game .shogi-game__command--attack[aria-pressed="true"],
.shogi-game .shogi-game__command--flip[aria-pressed="true"] {
  box-shadow: inset 0 0 0 2px var(--amber, #f5a645);
}
</style>
