<template>
  <div
    class="shogi-dex shogi-tutorial"
    :class="{ 'shogi-tutorial--lesson': view === 'lesson' }"
    role="dialog"
    aria-modal="true"
    aria-labelledby="shogi-tutorial-title"
  >
    <!-- レッスン中は見出しを1行にまとめ、盤を広くとる。スキップは見出しの右端へ置き、操作の邪魔をしない。 -->
    <header class="shogi-dex__header">
      <button type="button" class="shogi-dex__back" :aria-label="backLabel" @click="goBack">
        <span aria-hidden="true">←</span> <span class="shogi-tutorial__back-label">{{ backLabel }}</span>
      </button>
      <h1 id="shogi-tutorial-title">{{ headerTitle }}</h1>
      <!-- 利きメガネ(道具)。第2巻の「利きを見よう」で手に入れる。付けると、どのレッスンでも利きと取られるマスが見える。 -->
      <button
        v-if="view === 'lesson' && ownsGlasses"
        type="button"
        class="shogi-tutorial__glasses"
        :class="{ 'shogi-tutorial__glasses--on': glassesOn, 'shogi-tutorial__glasses--new': glassesNew }"
        :aria-pressed="glassesOn"
        aria-label="利きメガネ"
        data-kiki-glasses
        @click="toggleGlasses"
      >
        <svg viewBox="0 0 32 16" aria-hidden="true"><circle cx="8" cy="9" r="5.5" /><circle cx="24" cy="9" r="5.5" /><path d="M13.5 8.5 Q16 6.5 18.5 8.5 M2.5 8 L1 4 M29.5 8 L31 4" /></svg>
        <span>利き</span>
      </button>
      <!-- 読み上げ。押すたびにオン/オフ。既定はオフ。日本語の声がない端末では出さない。 -->
      <button
        v-if="view === 'lesson' && japaneseVoice"
        type="button"
        class="shogi-tutorial__glasses shogi-tutorial__voice"
        :class="{ 'shogi-tutorial__glasses--on': voiceOn }"
        :aria-pressed="voiceOn"
        aria-label="読み上げ"
        data-tutorial-voice
        @click="toggleVoice"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
          <path v-if="voiceOn" d="M15.5 9a4 4 0 0 1 0 6 M18 6.5a7.5 7.5 0 0 1 0 11" />
          <path v-else d="M16 9.5l5 5 M21 9.5l-5 5" />
        </svg>
        <span>声</span>
      </button>
      <button
        v-if="view === 'lesson'"
        type="button"
        class="shogi-tutorial__header-skip"
        data-tutorial-skip
        @click="skipCurrentLesson"
      >スキップ</button>
    </header>

    <!--
      地図(すごろくの道)。巻・章・レッスンを学ぶ順に1本の道に並べ、いま進めるマスを1つだけ大きく見せる。
      マスを押せばすぐレッスンが始まる。開くと、いまのマスまで自動でスクロールする。
    -->
    <section v-if="view === 'map'" ref="mapEl" class="shogi-tutorial__map" aria-label="レッスンの地図" data-tutorial-map>
      <div class="shogi-tutorial__map-hero">
        <img class="shogi-tutorial__chara" :src="charaUrl" alt="" aria-hidden="true">
        <div class="shogi-tutorial__map-hero-body">
          <p class="shogi-tutorial__speech">{{ mapMessage || shelfMessage }}</p>
          <p class="shogi-tutorial__map-total" aria-label="集めた星">
            ★ {{ map.total.stars }} / {{ map.total.maxStars }}<small>・{{ map.total.done }} / {{ map.total.total }} レッスン・メダル{{ medalCount }}</small>
          </p>
        </div>
        <button
          v-if="upcomingLesson"
          type="button"
          class="shogi-tutorial__continue"
          data-tutorial-continue
          @click="startLesson(upcomingLesson.id)"
        >
          <small>つづきから</small><span>▶ {{ upcomingLesson.title }}</span>
          <small v-if="upcomingLesson.summary" class="shogi-tutorial__continue-goal">めあて：{{ upcomingLesson.summary }}</small>
        </button>
      </div>
      <ol class="shogi-tutorial__road">
        <li
          v-for="row in map.rows"
          :key="`${row.type}-${row.id}`"
          :class="`shogi-tutorial__road-${row.type}`"
          :data-volume="row.volumeNumber"
        >
          <!-- 巻の看板 -->
          <div v-if="row.type === 'volume'" class="shogi-tutorial__world">
            <span class="shogi-tutorial__world-number">第{{ row.number }}巻</span>
            <strong>{{ row.title }}</strong>
            <span class="shogi-tutorial__meter" aria-hidden="true">
              <span :style="{ width: `${row.summary.total ? Math.round((row.summary.done / row.summary.total) * 100) : 0}%` }"></span>
            </span>
            <small>★{{ row.summary.stars }}/{{ row.summary.maxStars }}</small>
          </div>
          <!-- 章の看板 -->
          <div v-else-if="row.type === 'chapter'" class="shogi-tutorial__signpost">
            <span>第{{ row.number }}章 {{ row.title }}</span>
            <span
              v-if="row.medal"
              class="shogi-tutorial__signpost-medal"
              :class="`shogi-tutorial__signpost-medal--${row.medal.tier}`"
              :aria-label="row.medal.label"
            >●</span>
            <button
              v-if="weakCount(row.id)"
              type="button"
              class="shogi-tutorial__weak shogi-tutorial__weak--small"
              :aria-label="`にがてをもう1回（${weakCount(row.id)}問）`"
              @click="startReview(row.id)"
            >にがて{{ weakCount(row.id) }}</button>
            <button
              v-if="row.skippable"
              type="button"
              class="shogi-tutorial__skip-chapter"
              @click="skipChapterById(row.id)"
            >この章をとばす</button>
          </div>
          <!-- レッスンのマス -->
          <div v-else class="shogi-tutorial__stop" :style="{ '--lane': row.lane }">
            <button
              type="button"
              class="shogi-tutorial__node"
              :class="[`shogi-tutorial__node--${row.state}`, { 'shogi-tutorial__node--boss': row.boss }]"
              :aria-label="`${row.title}（${nodeStateText(row)}）`"
              :data-map-current="row.state === 'next' ? '' : undefined"
              :data-lesson-node="row.id"
              :disabled="row.state === 'soon'"
              @click="onNodeClick(row)"
            >
              <span class="shogi-tutorial__node-icon" aria-hidden="true">{{ row.state === "locked" ? "🔒" : row.icon }}</span>
              <span v-if="row.state === 'next'" class="shogi-tutorial__node-start" aria-hidden="true">ここから！</span>
            </button>
            <span class="shogi-tutorial__node-title">{{ row.boss ? "腕だめし" : row.title }}</span>
            <span v-if="row.state === 'cleared'" class="shogi-tutorial__node-stars" aria-hidden="true">
              <i v-for="index in 3" :key="index" :class="{ on: index <= row.stars }">★</i>
            </span>
          </div>
        </li>
      </ol>
    </section>

    <!--
      レッスン。説明は画面のどこを押しても進む(「次へ」のボタンを探して押させない)。
      盤の課題と選択問題は、正解すると自動で次へ進む。困ったら、しばらくするとヒントがそっと出る。
    -->
    <section v-else-if="view === 'lesson' && currentLesson && currentStep" class="shogi-tutorial__lesson-view" aria-label="レッスン">
      <!--
        進み具合。章のレッスンを区切りで並べ、いまのレッスンは区切りの中をステップの進み具合で塗る。
        短いレッスンが続けて流れていくことを、1本の帯で見せる。
      -->
      <div class="shogi-tutorial__track" data-tutorial-steps :aria-label="`第${chapterNumber}章 ${chapterTrack.index + 1}/${chapterTrack.count}つ目のレッスン、${stepIndex + 1}/${currentLesson.steps.length}`">
        <!-- めあて(このレッスンでできるようになること)を、いつも1行で見せる。 -->
        <span class="shogi-tutorial__track-label" data-tutorial-goal :title="chapterTitle">
          <b :class="{ 'shogi-tutorial__goal--boss': currentLesson.boss }">{{ currentLesson.boss ? "腕だめし" : "めあて" }}</b>{{ currentLesson.summary }}
        </span>
        <ol>
          <li v-for="(id, index) in chapterTrack.ids" :key="id">
            <span :style="{ width: `${trackFill(index)}%` }"></span>
          </li>
        </ol>
      </div>
      <!--
        盤のマスはクリックを止める(@click.stop)ので、画面全体はキャプチャ段階で受け取り、盤を押しても進めるようにする。
        課題の途中は進めない判定(tapToAdvance)なので、盤で指す操作は邪魔しない。
      -->
      <div ref="stageEl" class="shogi-dex__detail shogi-tutorial__stage" data-tutorial-stage @click.capture="onStageTap">
        <div v-if="boardSfen" class="shogi-dex__main">
          <div class="shogi-dex__board shogi-tutorial__board" :style="boardBoxStyle">
            <!-- 正解のはなまる。盤の上に短く出す(押した操作は止めない)。 -->
            <Transition name="shogi-tutorial__stamp">
              <div
                v-if="stamp"
                :key="stamp.key"
                class="shogi-tutorial__stamp"
                :class="{ 'shogi-tutorial__stamp--big': stamp.big }"
                aria-hidden="true"
                data-tutorial-stamp
              ><span>{{ stamp.text }}</span></div>
            </Transition>
            <!-- 格言札。いま指した手に、格言の名前を付ける。押すと次へ進む。 -->
            <div
              v-if="proverbCard"
              :key="proverbCard.id"
              class="shogi-tutorial__proverb"
              :class="`shogi-tutorial__proverb--${proverbCard.place}`"
              role="status"
              data-proverb-card
            >
              <p class="shogi-tutorial__proverb-line">{{ proverbCard.line }}</p>
              <p class="shogi-tutorial__proverb-name">{{ proverbCard.label }}</p>
              <p class="shogi-tutorial__proverb-overview">{{ proverbCard.overview }}</p>
              <p class="shogi-tutorial__proverb-foot">
                <span v-if="proverbCard.isNew" data-proverb-new><span class="shogi-tutorial__proverb-badge" aria-hidden="true">札</span>格言帳に入ったよ</span>
                <button
                  type="button"
                  class="shogi-tutorial__dex-link"
                  @click="emit('open-dex', { kind: 'tesuji', id: proverbCard.id })"
                >図鑑でくわしく</button>
              </p>
            </div>
            <ShogiMatchBoard
              :sfen="boardSfen"
              :last-move="lastMove"
              :allow-move="boardInteractive"
              :enable-drag-and-drop="true"
              :mobile="isNarrow"
              :layout="isNarrow ? 'portrait' : 'standard'"
              :asset-base-url="assetBaseUrl"
              :candidates="boardArrows"
              :mark-squares="boardMarks"
              :attack-marks="boardAttackMarks"
              :ghost-pieces="boardGhosts"
              :risk-destinations="riskDestinations"
              :float-labels="floatLabels"
              :callout="boardCallout"
              @usi-move="onBoardMove"
              @resize="onBoardResize"
            />
          </div>
        </div>
        <div ref="panelEl" class="shogi-tutorial__panel">
          <!--
            やこび姫の吹き出し。課題のときは「やってみよう」の目標として枠を琥珀色にし、
            正解・不正解の一言は同じ吹き出しの中に出す(見る場所を1つにする)。
          -->
          <div
            class="shogi-tutorial__bubble"
            :class="{
              'shogi-tutorial__bubble--task': isTaskStep && !stepSolved,
              'shogi-tutorial__bubble--good': feedback && feedbackTone === 'good',
              'shogi-tutorial__bubble--bad': feedback && feedbackTone === 'bad',
            }"
            aria-live="polite"
            data-tutorial-bubble
          >
            <img class="shogi-tutorial__chara" :src="charaUrl" alt="" aria-hidden="true">
            <div class="shogi-tutorial__bubble-body">
              <!-- 課題の種類・腕だめしの何問目か・駒取りの手数・れんぞく正解を、1行の札で並べる。 -->
              <p v-if="currentStep.dex || taskLabel || bossProgress || captureCount || buildCount || attackChips.length || insightChips.length || materialChip || streak >= 2" class="shogi-tutorial__chips">
                <span v-if="taskLabel" class="shogi-tutorial__task-label">{{ taskLabel }}</span>
                <!-- その場の図鑑: どの図鑑の項目かと、行をめくった位置。 -->
                <span v-if="currentStep.dex" class="shogi-tutorial__chip shogi-tutorial__chip--dex" data-dex-chip>
                  {{ DEX_TITLES[currentStep.dex.kind] ?? "図鑑" }}<template v-if="dexPages.length">・{{ dexPage + 1 }}/{{ dexPages.length + 1 }}</template>
                </span>
                <span v-if="bossProgress" class="shogi-tutorial__chip shogi-tutorial__chip--boss" data-boss-progress>
                  第{{ bossProgress.number }}問 / {{ bossProgress.total }}
                </span>
                <span v-if="captureCount" class="shogi-tutorial__chip" data-capture-count>
                  目標{{ captureCount.par }}手・いま{{ captureCount.used }}手
                </span>
                <span v-if="buildCount" class="shogi-tutorial__chip" data-build-count>
                  {{ buildCount.name }}：目標{{ buildCount.par }}手・いま{{ buildCount.used }}手
                </span>
                <!-- 攻めくらべ: 王手の回数と、くらべる相手(居玉)の結果・この局面の結果を並べる。 -->
                <span
                  v-for="chip in attackChips"
                  :key="chip.key"
                  class="shogi-tutorial__chip"
                  :class="chip.tone ? `shogi-tutorial__chip--${chip.tone}` : ''"
                  data-attack-chip
                >{{ chip.text }}</span>
                <!-- 形勢のものさし: 駒の点数の合計・利いているマスの数。 -->
                <span v-for="chip in insightChips" :key="chip" class="shogi-tutorial__chip" data-insight-chip>{{ chip }}</span>
                <!-- 駒得の合計。課題の中で駒の取り合いが起きたときだけ出す。 -->
                <span
                  v-if="materialChip"
                  :key="materialChip.text"
                  class="shogi-tutorial__chip shogi-tutorial__chip--material"
                  :class="`shogi-tutorial__chip--${materialChip.tone}`"
                  data-material
                >{{ materialChip.text }}</span>
                <span v-if="streak >= 2" :key="streak" class="shogi-tutorial__chip shogi-tutorial__chip--streak" data-streak>
                  {{ streak }}れんぞく！
                </span>
              </p>
              <!-- 「緑のマス」「赤い数字」などの前に、盤と同じ色の札を付ける(言葉と盤の色を同じ形で結ぶ)。 -->
              <p class="shogi-tutorial__speech">
                <template v-for="(segment, index) in speechSegments(stepSpeech ?? '')" :key="index">
                  <i v-if="segment.tone" class="shogi-tutorial__swatch" :class="`shogi-tutorial__swatch--${segment.tone}`" aria-hidden="true"></i>{{ segment.text }}
                </template>
              </p>
              <p
                v-if="feedback"
                class="shogi-tutorial__feedback"
                :class="`shogi-tutorial__feedback--${feedbackTone}`"
                role="status"
              >
                <template v-for="(segment, index) in speechSegments(feedback)" :key="index">
                  <i v-if="segment.tone" class="shogi-tutorial__swatch" :class="`shogi-tutorial__swatch--${segment.tone}`" aria-hidden="true"></i>{{ segment.text }}
                </template>
              </p>
              <!-- 駒の価値の札。値段を1行に並べる(成った駒は色を変える)。 -->
              <p v-if="currentStep.values" class="shogi-tutorial__values" data-dex-values>
                <span
                  v-for="value in currentStep.values"
                  :key="value.label"
                  :class="{ 'shogi-tutorial__value--promoted': value.promoted }"
                ><b>{{ value.label }}</b>{{ value.points }}</span>
              </p>
              <!-- 定跡: 作戦カードと同じ小さな盤。おさらいでは手順を1手ずつ動かす。 -->
              <div v-if="currentStep.formations" class="shogi-tutorial__formations" data-dex-formations>
                <figure v-for="formation in currentStep.formations" :key="formation.strategyId + formation.castleId">
                  <FormationThumb
                    :strategy-id="formation.strategyId"
                    :castle-id="formation.castleId"
                    :ply="currentStep.replay ? formationPly : null"
                  />
                  <figcaption>{{ formation.label }}</figcaption>
                </figure>
              </div>
              <p v-if="tapToAdvance || currentStep.dex" class="shogi-tutorial__tap-row">
                <button
                  v-if="currentStep.dex"
                  type="button"
                  class="shogi-tutorial__dex-link"
                  data-dex-link
                  @click="emit('open-dex', { kind: currentStep.dex.kind, id: currentStep.dex.id })"
                >図鑑でくわしく</button>
                <span v-if="tapToAdvance" class="shogi-tutorial__tap" aria-hidden="true">{{ tapLabel }} <span>▼</span></span>
              </p>
            </div>
          </div>
          <!-- 観戦: 盤を押しても1手進む。最後の手まで見ると、押すと次のステップへ進む。 -->
          <div v-if="currentStep.type === 'replay'" class="shogi-tutorial__replay">
            <p class="shogi-tutorial__replay-move">
              {{ stepState.ply > 0 ? `${stepState.ply}手目 ${replayLabel}` : "開始局面" }}
              <small>（{{ stepState.ply }}/{{ currentStep.moves.length }}）</small>
            </p>
            <div class="shogi-tutorial__replay-controls">
              <button
                type="button"
                :disabled="stepState.ply <= (currentStep.from ?? 0)"
                @click="seekReplayBy(-1)"
              ><span aria-hidden="true">◀</span> 戻る</button>
              <button
                type="button"
                class="shogi-tutorial__primary"
                :disabled="stepState.ply >= currentStep.moves.length"
                @click="seekReplayBy(1)"
              >次の手 <span aria-hidden="true">▶</span></button>
            </div>
          </div>
          <!-- 評価値の説明: 盤の局面に合わせて、対局全体の評価値グラフに今の手数を示す。 -->
          <div v-if="graphPoints.length" class="shogi-tutorial__graph">
            <EvaluationGraph
              :points="graphPoints"
              :current-ply="graphPly"
              :total-ply="currentStep.graph.moves.length"
              hide-legend
              @select="onGraphSelect"
            />
          </div>
          <p v-if="currentStep.type === 'choose' && currentStep.speech" class="shogi-tutorial__sub">{{ currentStep.speech }}</p>
          <!-- 対局の条件はレッスンで固定する。変更はさせず、内容だけ見せる。 -->
          <dl v-if="currentStep.type === 'play'" class="shogi-tutorial__conditions">
            <div v-for="condition in playConditions" :key="condition.label">
              <dt>{{ condition.label }}</dt>
              <dd>{{ condition.value }}</dd>
            </div>
          </dl>
          <div v-if="currentStep.type === 'choose'" class="shogi-tutorial__options">
            <button
              v-for="(option, index) in currentStep.options"
              :key="option"
              type="button"
              :class="{
                'shogi-tutorial__option--correct': stepSolved && index === currentStep.answer,
                'shogi-tutorial__option--wrong': wrongChoices.includes(Number(index)),
              }"
              :disabled="stepSolved || wrongChoices.includes(Number(index))"
              @click="choose(Number(index))"
            >{{ option }}</button>
          </div>
          <div v-if="hasActions" class="shogi-tutorial__actions">
            <button
              v-if="currentStep.type === 'play'"
              type="button"
              class="shogi-tutorial__primary"
              @click="startMatch"
            >対局をはじめる</button>
            <button
              v-if="stepInteractive && !stepSolved && stepState.movesUsed + stepState.ply > 0"
              type="button"
              @click="resetStep"
            >やり直す</button>
          </div>
        </div>
      </div>
      <!--
        レッスンクリアの知らせ。結果の画面へ移らず、盤の上に短く出して、同じ章の次のレッスンへ自動で続ける。
        押せば待たずに進む。地図へ戻る道も残す。
      -->
      <Transition name="shogi-tutorial__clear">
        <div v-if="stageClear" class="shogi-tutorial__clear" role="status" data-stage-clear @click="continueChain">
          <p class="shogi-tutorial__clear-title">クリア！</p>
          <p class="shogi-tutorial__clear-stars" :aria-label="`星${stageClear.stars}つ`">
            <i v-for="index in 3" :key="index" :class="{ on: index <= stageClear.stars }">★</i>
          </p>
          <p class="shogi-tutorial__clear-next">つぎは「{{ stageClear.nextTitle }}」 <span aria-hidden="true">▶</span></p>
          <button type="button" class="shogi-tutorial__clear-map" @click.stop="openMap">地図へ</button>
        </div>
      </Transition>
    </section>

    <!--
      章クリア。短いレッスンのたびに結果を挟まず、章の終わりでまとめてほめる。
      できるようになったことを並べ、次の章へすぐ進めるようにする。
    -->
    <section v-else-if="view === 'chapter' && clearedChapter" class="shogi-tutorial__chapter-clear" aria-label="章クリア" data-chapter-clear>
      <p class="shogi-tutorial__chapter-clear-eyebrow">第{{ clearedChapter.volumeNumber }}巻 第{{ clearedChapter.number }}章</p>
      <h2>「{{ clearedChapter.title }}」クリア！</h2>
      <!-- 腕だめしのメダル。判を押すように出す。 -->
      <div
        v-if="clearedChapter.medal"
        class="shogi-tutorial__medal"
        :class="`shogi-tutorial__medal--${clearedChapter.medal.tier}`"
        data-chapter-medal
      >
        <span class="shogi-tutorial__medal-disc" aria-hidden="true">{{ clearedChapter.number }}</span>
        <span>{{ clearedChapter.medal.label }}</span>
      </div>
      <p class="shogi-tutorial__chapter-clear-stars">★ {{ clearedChapter.stars }} / {{ clearedChapter.maxStars }}</p>
      <p v-if="newTitle" class="shogi-tutorial__new-title" data-new-title>
        <small>称号をもらったよ！</small>{{ newTitle.label }}<small>やこびノートの称号に記録したよ</small>
      </p>
      <div class="shogi-tutorial__bubble">
        <img class="shogi-tutorial__chara" :src="charaUrl" alt="" aria-hidden="true">
        <div class="shogi-tutorial__bubble-body">
          <p class="shogi-tutorial__speech">{{ chapterClearMessage }}</p>
        </div>
      </div>
      <!-- レッスンは札にして並べ、札のどこを押してももう一度遊べる(小さなボタンを探させない)。 -->
      <ul class="shogi-tutorial__learned-list" aria-label="できるようになったこと">
        <li v-for="entry in clearedChapter.lessons" :key="entry.id">
          <button
            type="button"
            class="shogi-tutorial__learned-tile"
            :aria-label="`${entry.title}（星${entry.stars}つ）をもう一度`"
            @click="startLesson(entry.id)"
          >
            <span class="shogi-tutorial__learned-head">
              <span class="shogi-tutorial__learned-stars" aria-hidden="true">
                <i v-for="index in 3" :key="index" :class="{ on: index <= entry.stars }">★</i>
              </span>
              <span class="shogi-tutorial__learned-again" aria-hidden="true">もう一度</span>
            </span>
            <b>{{ entry.title }}</b>
            <small v-if="entry.summary">{{ entry.summary }}</small>
          </button>
        </li>
      </ul>
      <div class="shogi-tutorial__result-actions">
        <button
          v-if="clearedChapter && weakCount(clearedChapter.id)"
          type="button"
          class="shogi-tutorial__weak"
          data-weak-review
          @click="startReview(clearedChapter.id)"
        >にがてをもう1回（{{ weakCount(clearedChapter.id) }}問）</button>
        <button v-if="nextChapterLesson" ref="nextChapterButton" type="button" class="shogi-tutorial__primary" data-next-chapter @click="startLesson(nextChapterLesson.id)">
          次の章へ：{{ nextChapterLesson.title }}
        </button>
        <button type="button" @click="openMap">地図へ</button>
      </div>
    </section>

    <!-- 結果 -->
    <!-- やこび姫の一言のあとに、星を1つずつ付ける。画面を押すと演出を飛ばせる。 -->
    <section
      v-else-if="view === 'result' && currentLesson"
      class="shogi-tutorial__result"
      aria-label="レッスンの結果"
      @click="finishReveal"
    >
      <p v-if="matchOutcomeLabel" class="shogi-tutorial__outcome" :class="`shogi-tutorial__outcome--${matchOutcome}`">
        {{ matchOutcomeLabel }}
      </p>
      <div v-if="matchComment" class="shogi-dex__speech shogi-tutorial__intro">
        <img class="shogi-dex__chara" :src="charaUrl" alt="" aria-hidden="true">
        <p>{{ matchComment }}</p>
      </div>
      <!-- 星の数より先に、このレッスンでできるようになったことを見せる。 -->
      <p v-if="currentLesson.summary && !matchComment" class="shogi-tutorial__learned" data-tutorial-learned>
        <small>できるようになったこと</small>{{ currentLesson.summary }}
      </p>
      <div
        class="shogi-tutorial__stars"
        :class="{ 'shogi-tutorial__stars--hidden': revealStage < 1 }"
        role="img"
        :aria-label="`星${resultStars}つ`"
      >
        <span
          v-for="index in 3"
          :key="index"
          :class="{ 'shogi-tutorial__star--on': index <= revealedStars }"
        >★</span>
      </div>
      <template v-if="revealStage >= 2">
        <div v-if="!matchComment" class="shogi-dex__speech shogi-tutorial__intro">
          <img class="shogi-dex__chara" :src="charaUrl" alt="" aria-hidden="true">
          <p>{{ resultMessage }}</p>
        </div>
        <p v-else class="shogi-tutorial__star-note">{{ resultMessage }}</p>
        <div class="shogi-tutorial__result-actions">
          <button v-if="followingLesson" ref="nextLessonButton" type="button" class="shogi-tutorial__primary" @click="continueAfterResult">
            次へ進む
          </button>
          <button v-if="matchComment" type="button" @click="startMatch">もう一度対局する</button>
          <button v-else type="button" @click="startLesson(currentLesson.id)">もう一度</button>
          <button type="button" @click="openMap">地図へ</button>
        </div>
      </template>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch, type PropType } from "vue";
import EvaluationGraph from "./EvaluationGraph.vue";
import ShogiMatchBoard from "./ShogiMatchBoard.vue";
import { formatHintMove } from "./core/match-assists.mjs";
import { appendUsiMove, createGameRecord } from "./game-state";
import { attackMap } from "./core/learning-setup.mjs";
import { controlCount, kingEscapeMap, unsafeDestinations } from "./core/board-insight.mjs";
import { CAPTURE_POP_MS, capturePop, materialLabel, materialSwing, materialTotals } from "./core/piece-points.mjs";
import { createMoveSoundPlayer, moveSoundForUsi } from "./core/move-sound";
import { OPENING_CASTLES, OPENING_STRATEGIES } from "./core/opening-guide.mjs";
import { CPU_STRENGTH_PRESETS } from "./core/strength-settings.mjs";
import { TUTORIAL_LESSONS, TUTORIAL_TITLE, TUTORIAL_VOLUMES, tutorialLesson } from "./core/tutorial-curriculum.mjs";
import { loadPlayStreak, recordPlay, savePlayStreak } from "./core/play-streak.mjs";
import {
  INTERACTIVE_STEP_TYPES,
  STANDARD_SFEN,
  TUTORIAL_AUTO_ADVANCE_MS,
  TUTORIAL_IDLE_HINT_MS,
  TUTORIAL_TAP_GUARD_MS,
  attemptTutorialChoice,
  buildMissingTargets,
  choiceAdvanceDelay,
  attemptTutorialMove,
  autoAdvancesOnSolve,
  createStepState,
  lessonStars,
  matchLessonComment,
  matchLessonStars,
  replayMoveLabel,
  replaySpeech,
  seekReplay,
  tutorialGraphPly,
  tutorialGraphPoints,
  tutorialHint,
  tutorialMatchSettings,
  tutorialStepMarks,
} from "./core/tutorial-runner.mjs";
import {
  chapterWeakSteps,
  clearWeakSteps,
  hasKikiGlasses,
  loadKikiGlassesOn,
  loadWeakSteps,
  recordLessonWeakSteps,
  saveWeakSteps,
  weakReviewLesson,
  loadTutorialProgress,
  nextLesson,
  recordLessonCleared,
  recordLessonSkipped,
  saveKikiGlassesOn,
  saveTutorialProgress,
  recordProverb,
} from "./core/tutorial-progress.mjs";
import { referenceDexEntries } from "./core/reference-dex.mjs";
import {
  chapterPosition,
  chapterSummary,
  earnedVolumeTitles,
  firstLessonOfNextChapter,
  nextLessonInChapter,
  tutorialMap,
} from "./core/tutorial-map.mjs";
import {
  attackResultLabel,
  attackStepHint,
  attemptAttackMove,
  attemptProblemMove,
  createAttackState,
  createProblemState,
  problemStepHint,
  recordTutorialProblem,
  tutorialProblem,
  tutorialProblemSpeech,
} from "./core/tutorial-problem.mjs";
import FormationThumb from "./FormationThumb.vue";
import { openingFormationSteps } from "./core/opening-formation.mjs";
import { placeCallout, speechSegments, splitLeadPhrase, stepCallout } from "./core/tutorial-callout.mjs";
import { loadTutorialVoiceOn, pickJapaneseVoice, saveTutorialVoiceOn, voiceText } from "./core/tutorial-voice.mjs";

type Lesson = (typeof TUTORIAL_LESSONS)[number] & { steps?: any[]; comingSoon?: boolean; summary?: string; boss?: boolean; review?: boolean };
type VolumeTitle = { id: string; label: string; detail: string; rank: number };
type Volume = (typeof TUTORIAL_VOLUMES)[number];

export type TutorialMatchReport = {
  lessonId: string;
  outcome: "win" | "lose" | "draw";
  reason: string;
  assistsUsed: number;
};

const props = defineProps({
  assetBaseUrl: { type: String, default: "." },
  // 教室の対局を終えて戻ってきたときの結果。あれば結果画面から始める。
  matchReport: { type: Object as PropType<TutorialMatchReport | null>, default: null },
  /** タイトル画面の「将棋教室のつづき」から開いたとき、本棚を通さずに次のレッスンを始める。 */
  autoStart: { type: Boolean, default: false },
});
const emit = defineEmits(["close", "open-dex", "start-match", "grant-title"]);

const volumes = TUTORIAL_VOLUMES as unknown as Volume[];
const lessons = TUTORIAL_LESSONS as unknown as Lesson[];
const storage = typeof localStorage === "undefined" ? null : localStorage;
const progress = ref(loadTutorialProgress(storage));
// ===== 道具: 利きメガネ =====
/** 「利きを見よう」の最後で手に入れた(レッスンを終える前でも、手に入れた場面から使える)。 */
const toolGranted = ref(false);
const ownsGlasses = computed(() => toolGranted.value || hasKikiGlasses(progress.value));
const glassesOn = ref(loadKikiGlassesOn(storage));
/** 手に入れたばかりで、まだ押していない。ボタンをそっと光らせる。 */
const glassesNew = ref(false);
const glassesActive = computed(() => ownsGlasses.value && glassesOn.value);
let glassesExplained = false;
function toggleGlasses() {
  glassesOn.value = !glassesOn.value;
  glassesNew.value = false;
  saveKikiGlassesOn(storage, glassesOn.value);
  // 色の意味は、この画面で初めてかけたときだけ一言で伝える(UI_Nintendo_Design.mdの6-2)。
  if (glassesOn.value && !glassesExplained) {
    glassesExplained = true;
    setFeedback("利きメガネ：青い数字は君の駒、赤い数字は相手の駒が見張っている数。赤い輪のマスへ動かすと取られるよ。", "info");
  }
}

/** この画面を開いてから新しく手に入れた巻の称号。章クリアの画面で知らせる。 */
const newTitle = ref<VolumeTitle | null>(null);
function updateProgress(next: typeof progress.value) {
  const before = new Set(earnedVolumeTitles(volumes, lessons, progress.value).map(({ id }: VolumeTitle) => id));
  progress.value = next;
  saveTutorialProgress(storage, next);
  // 巻を終えたら称号を渡す(保存は対局画面の称号に任せる)。
  for (const title of earnedVolumeTitles(volumes, lessons, next) as VolumeTitle[]) {
    if (before.has(title.id)) continue;
    newTitle.value = title;
    emit("grant-title", title);
  }
}
// 前の版で終えていた巻にも渡す(同じ称号は上書きになるだけ)。
onMounted(() => {
  for (const title of earnedVolumeTitles(volumes, lessons, progress.value)) emit("grant-title", title);
});

// 駒音。対局画面と同じ音を、指した手と観戦で進めた手に鳴らす。
const moveSounds = createMoveSoundPlayer(() => props.assetBaseUrl);
onMounted(() => moveSounds.preload());
function playMoveSoundFor(sfen: string, usi: string) {
  const kind = moveSoundForUsi(sfen, usi);
  if (kind) moveSounds.play(kind);
}

// ===== 読み上げ(16-10) =====
/** 端末の日本語の声。なければ読み上げのボタンを出さない。 */
const synth = typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
const japaneseVoice = shallowRef<SpeechSynthesisVoice | null>(null);
const voiceOn = ref(loadTutorialVoiceOn(storage));
function refreshVoices() {
  japaneseVoice.value = synth ? pickJapaneseVoice(synth.getVoices()) : null;
}
onMounted(() => {
  refreshVoices();
  synth?.addEventListener?.("voiceschanged", refreshVoices);
});
onBeforeUnmount(() => {
  synth?.removeEventListener?.("voiceschanged", refreshVoices);
  synth?.cancel();
});
/** 吹き出しの文を読み上げる。前の読み上げは止める(重ねない)。 */
function speak(text: string) {
  if (!synth || !voiceOn.value || !japaneseVoice.value || !text) return;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(voiceText(text));
  utterance.voice = japaneseVoice.value;
  utterance.lang = japaneseVoice.value.lang;
  utterance.rate = 1.05;
  synth.speak(utterance);
}
function toggleVoice() {
  voiceOn.value = !voiceOn.value;
  saveTutorialVoiceOn(storage, voiceOn.value);
  if (voiceOn.value) speak([stepSpeech.value, feedbackVoice.value].filter(Boolean).join(" "));
  else synth?.cancel();
}

const view = ref<"map" | "lesson" | "chapter" | "result">("map");
const lessonId = ref("");
const charaUrl = computed(() => `${props.assetBaseUrl}/characters/yakobihime-mini.webp?v=2`);

// 狭い画面では縦長レイアウトの盤に切り替える。
const narrowMediaQuery = typeof window !== "undefined" && window.matchMedia
  // 縦長の狭い画面だけ縦長の盤にする。スマホの横向きは、横長の盤の横に台詞を置く。
  ? window.matchMedia("(max-width: 56rem) and (orientation: portrait), (max-width: 30rem)")
  : null;
const isNarrow = ref(Boolean(narrowMediaQuery?.matches));
function onNarrowChange(event: MediaQueryListEvent) { isNarrow.value = event.matches; }
onMounted(() => narrowMediaQuery?.addEventListener("change", onNarrowChange));
onBeforeUnmount(() => narrowMediaQuery?.removeEventListener("change", onNarrowChange));

/*
 * 盤の枠を、描かれる盤と同じ大きさにする。枠が残りの高さいっぱいに伸びると、縦横比を保って
 * 縮んだ盤との間に隙間ができ、台詞が盤から離れる。台詞欄の高さを引いた残りに盤の縦横比で収める。
 */
const stageEl = ref<HTMLElement | null>(null);
const panelEl = ref<HTMLElement | null>(null);
const boardBoxStyle = ref<Record<string, string>>({});
// 盤の縦横比は描画後に盤から受け取る。初期値は標準レイアウトの比。
const boardAspect = ref(1471 / 959);
function onBoardResize({ width, height }: { width: number; height: number }) {
  if (width > 0 && height > 0 && Math.abs(width / height - boardAspect.value) > 0.005) boardAspect.value = width / height;
}
function layoutBoardBox() {
  const stage = stageEl.value;
  if (!stage) return;
  const style = getComputedStyle(stage);
  const innerWidth = stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const innerHeight = stage.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
  // 横に並べる画面(スマホの横向き)では、台詞の欄の幅を引いた残りに、縦に並べる画面では高さを引いた残りに収める。
  const row = style.flexDirection === "row";
  const panelHeight = panelEl.value?.offsetHeight ?? 0;
  const panelWidth = panelEl.value?.offsetWidth ?? 0;
  const gap = parseFloat(row ? style.columnGap : style.rowGap) || 0;
  // 台詞が長くても盤が小さくなりすぎないようにする。
  const minHeight = Math.min(320, window.innerHeight * 0.42);
  const availableHeight = row ? innerHeight : Math.max(minHeight, innerHeight - panelHeight - gap);
  const availableWidth = row ? Math.max(1, innerWidth - panelWidth - gap) : innerWidth;
  const width = Math.max(1, Math.floor(Math.min(availableWidth, availableHeight * boardAspect.value)));
  const height = Math.max(1, Math.floor(width / boardAspect.value));
  boardBoxStyle.value = { width: `${width}px`, height: `${height}px` };
}
const boardBoxObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => layoutBoardBox()) : null;
watch([stageEl, panelEl], ([stage, panel]) => {
  boardBoxObserver?.disconnect();
  if (stage) boardBoxObserver?.observe(stage);
  if (panel) boardBoxObserver?.observe(panel);
  layoutBoardBox();
});
watch(boardAspect, layoutBoardBox);
onBeforeUnmount(() => boardBoxObserver?.disconnect());

// ===== にがてをもう1回 =====
/** レッスンでまちがえた課題の記録。章クリアの画面と地図の章の看板から、章の苦手だけを解き直せる。 */
const weakSteps = ref<Record<string, number[]>>(loadWeakSteps(storage, lessons));
function updateWeakSteps(next: Record<string, number[]>) {
  weakSteps.value = next;
  saveWeakSteps(storage, next);
}
function weakCount(chapterId: string) {
  return chapterWeakSteps(lessons, weakSteps.value, chapterId).length;
}
/** 遊んでいる「にがてをもう1回」(章の苦手だけを並べたレッスン)。 */
const reviewLesson = ref<Lesson | null>(null);
/** このレッスンの回で、まちがえた課題の番号。最後まで遊んだら苦手の記録を置き換える。 */
let runMissed = new Set<number>();
/** にがてをもう1回で、まちがえずに解いた課題(苦手から消す)。 */
let reviewSolved: { lessonId: string; index: number }[] = [];
/** にがてをもう1回の結果。章クリアの画面で知らせる。 */
const reviewResult = ref<{ cleared: number; left: number } | null>(null);
function startReview(chapterId: string) {
  const lesson = weakReviewLesson(lessons, weakSteps.value, chapterId) as Lesson | null;
  if (!lesson) return;
  reviewLesson.value = lesson;
  startLesson(lesson.id);
}

const currentLesson = computed(() => {
  if (!lessonId.value) return null;
  if (lessonId.value.startsWith("review:")) return reviewLesson.value?.id === lessonId.value ? reviewLesson.value : null;
  return tutorialLesson(lessonId.value) as Lesson | null;
});
const headerTitle = computed(() => {
  if ((view.value === "lesson" || view.value === "result") && currentLesson.value) return currentLesson.value.title;
  if (view.value === "chapter") return "章クリア！";
  return TUTORIAL_TITLE;
});
const backLabel = computed(() => (view.value === "map" ? "タイトルへ戻る" : "地図へ"));
function goBack() {
  if (view.value === "map") emit("close");
  else openMap();
}
// ブラウザの戻るからも、ヘッダーの戻るボタンと同じ段だけ戻す。
defineExpose({ goBack });

// ===== 地図(すごろくの道) =====
const upcomingLesson = computed(() => nextLesson(lessons, progress.value) as Lesson | null);
const map = computed(() => tutorialMap(volumes, lessons, progress.value));
/** 集めた腕だめしのメダルの数。 */
const medalCount = computed(() => map.value.rows.filter((row: any) => row.type === "chapter" && row.medal).length);
const shelfMessage = computed(() => {
  if (!Object.keys(progress.value.lessons).length) return "ようこそ、やこび姫の将棋教室へ！ 光っているマスから始めよう。";
  return upcomingLesson.value ? "おかえり！ 光っているマスから続けよう。" : "全部のレッスンを終えたね！ 好きなマスで、もう一度遊べるよ。";
});
/** 閉じたマスを押したときなど、やこび姫が一言だけかける。 */
const mapMessage = ref("");
const mapEl = ref<HTMLElement | null>(null);
function nodeStateText(row: { state: string; stars: number }) {
  return ({
    cleared: `クリア・★${row.stars}`, skipped: "とばした", next: "ここから", open: "遊べる", locked: "まだ閉じている", soon: "準備中",
  } as Record<string, string>)[row.state] ?? "";
}
function onNodeClick(row: { id: string; state: string }) {
  if (row.state === "locked") {
    mapMessage.value = "そのマスは、光っているマスを終えると遊べるよ。";
    return;
  }
  startLesson(row.id);
}
function openMap() {
  clearStepTimers();
  clearChain();
  reviewResult.value = null;
  newTitle.value = null;
  mapMessage.value = "";
  view.value = "map";
  // いま進めるマスが見える位置まで、地図をスクロールする。
  void nextTick(() => {
    mapEl.value?.querySelector("[data-map-current]")?.scrollIntoView({ block: "center" });
  });
}
function skipChapterById(chapterId: string) {
  let next = progress.value;
  for (const lesson of lessons.filter((entry) => entry.chapterId === chapterId)) {
    if (!lesson.comingSoon) next = recordLessonSkipped(next, lesson.id);
  }
  updateProgress(next);
}

// ===== 続けて進める(同じ章のレッスンは結果の画面を挟まない) =====
/** レッスンクリアの知らせ。出ている間に押すか、少し待つと次のレッスンが始まる。 */
const STAGE_CLEAR_MS = 1700;
const stageClear = ref<{ stars: number; nextId: string; nextTitle: string } | null>(null);
let chainTimer: ReturnType<typeof setTimeout> | undefined;
function clearChain() {
  clearTimeout(chainTimer);
  chainTimer = undefined;
  stageClear.value = null;
}
onBeforeUnmount(clearChain);
function continueChain() {
  const next = stageClear.value;
  clearChain();
  if (next) startLesson(next.nextId);
}
/** 章クリアの画面に出す章。 */
const clearedChapterId = ref("");
const clearedChapter = computed(() => (clearedChapterId.value ? chapterSummary(volumes, lessons, progress.value, clearedChapterId.value) : null));
const nextChapterLesson = computed(() => {
  const last = clearedChapter.value?.lessons.at(-1);
  return last ? firstLessonOfNextChapter(lessons, last.id) as Lesson | null : null;
});
const chapterClearMessage = computed(() => {
  const chapter = clearedChapter.value;
  if (!chapter) return "";
  const review = reviewResult.value;
  if (review) {
    if (!review.left) {
      if (!review.cleared) return "この章の苦手はもうないよ。";
      return `にがて克服！ ${review.cleared === 1 ? "まちがえずに解けたね" : `${review.cleared}問とも、まちがえずに解けたね`}。この章の苦手はもうないよ。`;
    }
    return `${review.cleared}問克服！ あと${review.left}問。まちがえた問題は、もう一度挑戦できるよ。`;
  }
  if (chapter.stars >= chapter.maxStars) return "全部★3つ！ 完ぺきだね。この章でできるようになったことを、見てみよう。";
  const medal = chapter.medal;
  if (medal?.tier === "gold") return "腕だめしは、まちがいなしの金メダル！ この章でできるようになったことを並べたよ。";
  if (medal) return `腕だめしは${medal.label}！ まちがえずに解けたら金メダルだよ。札を押すと、もう一度挑戦できるよ。`;
  return "章クリア、おめでとう！ できるようになったことを並べたよ。★が足りないところは、「もう一度」で取り直せるよ。";
});
const nextChapterButton = ref<HTMLButtonElement | null>(null);
function showChapterClear(chapterId: string) {
  clearStepTimers();
  clearChain();
  clearedChapterId.value = chapterId;
  view.value = "chapter";
  void nextTick(() => nextChapterButton.value?.focus());
}
/**
 * レッスンを終えたあと。同じ章に次のレッスンがあれば、知らせを出して続けて始める。章の最後なら、章クリアの画面へ。
 * stars が null のとき(スキップ・対局の結果のあと)は、知らせを出さずにすぐ進む。
 */
function continueAfter(lesson: Lesson, stars: number | null) {
  const next = nextLessonInChapter(lessons, lesson.id) as Lesson | null;
  if (!next) {
    showChapterClear(lesson.chapterId);
    return;
  }
  if (stars === null) {
    startLesson(next.id);
    return;
  }
  stageClear.value = { stars, nextId: next.id, nextTitle: next.title };
  chainTimer = setTimeout(continueChain, STAGE_CLEAR_MS);
}

/** 見出しの進み具合: 章のレッスンの区切りと、いまのレッスンの中のステップ。 */
const chapterTrack = computed(() => chapterPosition(lessons, lessonId.value));
const chapterInfo = computed(() => {
  const lesson = currentLesson.value;
  if (!lesson) return null;
  return chapterSummary(volumes, lessons, progress.value, lesson.chapterId);
});
const chapterNumber = computed(() => chapterInfo.value?.number ?? 0);
const chapterTitle = computed(() => (chapterInfo.value ? `第${chapterInfo.value.number}章 ${chapterInfo.value.title}` : ""));
function trackFill(index: number) {
  if (index < chapterTrack.value.index) return 100;
  if (index > chapterTrack.value.index) return 0;
  if (stageClear.value) return 100;
  const steps = currentLesson.value?.steps?.length ?? 1;
  return Math.round((stepIndex.value / steps) * 100);
}

// ===== レッスン =====
const stepIndex = ref(0);
const stepState = ref<any>({ sfen: "", square: "", movesUsed: 0, ply: 0, solved: false });
const stepSolved = ref(false);
const mistakes = ref(0);
const hints = ref(0);
const hintLevel = ref(0);
const feedback = ref("");
const feedbackTone = ref<"good" | "bad" | "info">("info");
/** 読み上げる一言。盤の上に最初の一句を出したときも、読み上げは文の全部を読む。 */
const feedbackVoice = ref("");
const lastMove = ref("");
const resultStars = ref(0);
/** このステップでまちがえた・ヒントを見た回数(問題集の記録の「一発で解けたか」と、れんぞく正解に使う)。 */
const stepMisses = ref(0);
/** まちがえずに続けて解いた課題の数。2つ以上で「2れんぞく！」と知らせる(何が良かったかを数で見せる)。 */
const streak = ref(0);
/** 駒得の合計(このステップの中)。駒を取ったら＋、取られたら−。取り合いが起きたら札を出す。 */
const materialTotal = ref(0);
const materialSeen = ref(false);
/** 盤に浮かべている駒得の数字。 */
const floatLabels = ref<{ id: string | number; file: number; rank: number; text: string; tone: "good" | "bad"; big: boolean }[]>([]);
let floatSeq = 0;
let floatTimers: ReturnType<typeof setTimeout>[] = [];
function clearFloats() {
  for (const timer of floatTimers) clearTimeout(timer);
  floatTimers = [];
  floatLabels.value = [];
}
onBeforeUnmount(clearFloats);
/**
 * 駒を取った手なら、取ったマスに＋N(先手が取った)・−N(後手が取った)を浮かべ、合計に足す。
 * delayは相手の応手のように、少し遅れて盤に出る手の数字を合わせるため(合計はすぐ足す)。
 */
function popCapture(sfen: string, usi: string, delay = 0) {
  const pop = capturePop(sfen, usi, "black", (floatSeq += 1));
  if (!pop) return;
  materialTotal.value += pop.points;
  materialSeen.value = true;
  const show = () => {
    floatLabels.value = [...floatLabels.value, pop];
    floatTimers.push(setTimeout(() => {
      floatLabels.value = floatLabels.value.filter(({ id }) => id !== pop.id);
    }, CAPTURE_POP_MS));
  };
  if (delay) floatTimers.push(setTimeout(show, delay));
  else show();
}
/** 指した手の後の局面。 */
function applyUsi(sfen: string, usi: string) {
  const record = createGameRecord(sfen);
  return appendUsiMove(record, usi) ? record.position.sfen : sfen;
}
/** 攻めくらべの結果(「3手で詰み」「詰まない」)。 */
const attackOutcome = ref("");
/** 詰ませたあと、詰みの理由として玉の逃げ道を見せる。 */
const mateShown = ref(false);
/**
 * 正解・取り返しの瞬間に盤の上へ出す一言(「両取り！」「取られる！」)。ステップが変わるか、局面を戻すと消す。
 */
const momentCallout = ref<{ at: string; text: string; tone: "good" | "bad" } | null>(null);
/**
 * 格言札(16-5)。課題を解き終えたら、いま指した手の格言を盤の上に出す。初めての格言は格言帳(手筋図鑑の★)に入れる。
 * placeは札を出す位置。いま動かした駒を隠さないよう、駒が盤の上半分なら下に出す。
 */
const proverbCard = ref<{ id: string; label: string; overview: string; line: string; isNew: boolean; place: "top" | "bottom" } | null>(null);
const TESUJI_ENTRIES = new Map(referenceDexEntries("tesuji").map((entry: any) => [entry.id, entry]));
function showProverbCard(step: any, at: string) {
  const entry: any = TESUJI_ENTRIES.get(step.proverb);
  if (!entry) return null;
  const { isNew } = recordProverb(storage, entry.id);
  const rank = at ? at.charCodeAt(1) - 96 : 9;
  proverbCard.value = {
    id: entry.id,
    label: entry.label,
    overview: entry.overview,
    line: step.proverbLine ?? "いま君が指した手が、これ！",
    isNew,
    place: rank <= 4 ? "bottom" : "top",
  };
  const callout = at ? stepCallout(step, { phase: "proverb", moved: at }) : null;
  if (callout) momentCallout.value = { ...callout, tone: "good" };
  return proverbCard.value;
}
/** 取り返しの再生中。盤を触れなくし、押すと待たずに戻す。 */
const refuting = ref(false);
let refuteRestore: (() => void) | null = null;

const currentStep = computed(() => currentLesson.value?.steps?.[stepIndex.value] ?? null);
const isProblemStep = computed(() => currentStep.value?.type === "problem");
const stepInteractive = computed(() => INTERACTIVE_STEP_TYPES.includes(currentStep.value?.type));
const boardSfen = computed(() => stepState.value.sfen);
const boardInteractive = computed(() => stepInteractive.value && !stepSolved.value && !stageClear.value && !refuting.value);
const problemHint = computed(() => (
  isProblemStep.value && hintLevel.value ? problemStepHint(currentStep.value, stepState.value, hintLevel.value) : null
));
/** 詰ませる課題(詰将棋・詰ませる問題・攻めくらべ)。ヒントの1段目と詰んだあとに、玉の逃げ道を見せる。 */
const isMateTask = computed(() => {
  const step = currentStep.value;
  if (step?.type === "mate" || step?.type === "attack-test") return true;
  return step?.type === "problem" && problemKind.value !== "escape";
});
/** 攻めくらべの2段目のヒントの矢印。詰み探索を使うので、ヒントを出すときだけ求める。 */
const attackHintArrow = computed(() => (
  currentStep.value?.type === "attack-test" && hintLevel.value >= 2 ? attackStepHint(currentStep.value, stepState.value) : ""
));
const hintView = computed(() => {
  if (!hintLevel.value || !currentStep.value) return { marks: [], arrows: [] };
  const step = currentStep.value;
  if (step.type === "attack-test") return { marks: [], arrows: attackHintArrow.value ? [attackHintArrow.value] : [] };
  // 1段目は「見方」(利きの地図・玉の逃げ道)だけを見せ、答えのマスは2段目で見せる。
  if ((step.type === "find-move" || step.type === "mate") && hintLevel.value === 1) return { marks: [], arrows: [] };
  if (problemHint.value) {
    const square = problemHint.value.square;
    return {
      marks: square ? [{ file: Number(square[0]), rank: square.charCodeAt(1) - 96, tone: "key" }] : [],
      arrows: problemHint.value.arrow ? [problemHint.value.arrow] : [],
    };
  }
  return tutorialHint(currentStep.value, stepState.value, hintLevel.value);
});
const boardMarks = computed(() => {
  if (!currentStep.value || !boardSfen.value) return [];
  const step = currentStep.value;
  const marks = step.type === "problem"
    ? []
    : tutorialStepMarks(
      step.type === "move-piece" ? { ...step, pieceSquare: stepState.value.square } : step,
      boardSfen.value,
    );
  const merged = new Map(marks.map((mark: any) => [`${mark.file}${mark.rank}`, mark]));
  for (const mark of escapeMarks.value) merged.set(`${mark.file}${mark.rank}`, mark);
  for (const mark of hintView.value.marks) merged.set(`${mark.file}${mark.rank}`, mark);
  return [...merged.values()];
});
/** 玉の逃げ道を見せる玉。ステップの指定か、詰ませたあと・詰ませる課題の1段目のヒント。 */
const escapeColors = computed<("black" | "white")[]>(() => {
  const step = currentStep.value;
  if (!step) return [];
  if (step.escapeMap) return step.escapeMap === "both" ? ["white", "black"] : [step.escapeMap];
  if (isMateTask.value && (mateShown.value || hintLevel.value === 1)) return ["white"];
  return [];
});
/**
 * 玉の逃げ道。逃げられるマスは緑(大事なマス)、相手の駒が利いているマスは×(先手の利きは青、後手の利きは赤)。
 * 玉の味方がふさいでいるマスは印を付けない。
 */
const escapeMarks = computed(() => {
  if (!boardSfen.value) return [];
  return escapeColors.value.flatMap((color) => (kingEscapeMap(boardSfen.value, color)?.squares ?? []).flatMap(({ square, state }) => {
    const tone = state === "open" ? "key" : state === "covered" ? (color === "white" ? "covered" : "danger") : "";
    return tone ? [{ file: Number(square[0]), rank: square.charCodeAt(1) - 96, tone }] : [];
  }));
});
/**
 * 利きの地図。レッスンが指定したとき(kiki)、利きメガネをかけているとき、盤で指す課題の1段目のヒント(見方)で出す。
 * "black"／"white"は片方の駒の利きだけを見せる。
 */
const kikiMode = computed(() => {
  const step = currentStep.value;
  if (!step || !boardSfen.value) return "";
  if (step.kiki) return step.kiki;
  if (glassesActive.value) return "both";
  if (step.type === "find-move" && hintLevel.value === 1 && !stepSolved.value) return "both";
  return "";
});
const boardAttackMarks = computed(() => {
  const mode = kikiMode.value;
  if (!mode) return [];
  return attackMap(boardSfen.value).flatMap((mark: { file: number; rank: number; black: number; white: number }) => {
    const black = mode === "white" ? 0 : mark.black;
    const white = mode === "black" ? 0 : mark.white;
    return black || white ? [{ ...mark, black, white }] : [];
  });
});
/** 利きメガネ・dangerのステップで、駒を選んだときに取られるマスを赤い輪で見せる。 */
const riskDestinations = computed(() => {
  const step = currentStep.value;
  if (!boardInteractive.value || !(step?.danger || glassesActive.value)) return null;
  const sfen = boardSfen.value;
  return (source: string) => unsafeDestinations(sfen, source);
});
/** 囲いを組もうの完成形。まだそろっていないマスに薄く駒を描く(腕だめしでは描かない)。 */
const boardGhosts = computed(() => {
  const step = currentStep.value;
  if (step?.type !== "build" || step.hideTarget || !boardSfen.value) return [];
  return buildMissingTargets(step, boardSfen.value).map(([square, kind]: [string, string]) => ({
    file: Number(square[0]), rank: square.charCodeAt(1) - 96, kind,
  }));
});
/** 駒得の合計の札。観戦は先手から見た損得を、手数に合わせて計算し直す。 */
const materialChip = computed(() => {
  const step = currentStep.value;
  if (step?.type === "replay") {
    const swing = materialSwing(step.sfen ?? STANDARD_SFEN, step.moves.slice(0, stepState.value.ply));
    if (!swing) return null;
    const label = materialLabel(swing);
    return { ...label, text: `▲先手 ${label.text}` };
  }
  return materialSeen.value ? materialLabel(materialTotal.value) : null;
});
/** 形勢のものさしの札(駒の点数の合計・利いているマスの数)。 */
const insightChips = computed(() => {
  const step = currentStep.value;
  if (!step || !boardSfen.value) return [];
  const chips: string[] = [];
  if (step.material) {
    const totals = materialTotals(boardSfen.value);
    chips.push(`駒の点数 ▲${totals.black}・△${totals.white}`);
  }
  if (step.control) {
    const counts = controlCount(boardSfen.value);
    chips.push(`利いているマス ▲${counts.black}・△${counts.white}`);
  }
  return chips;
});
/** 囲いを組もうの手数。 */
const buildCount = computed(() => (
  currentStep.value?.type === "build" ? { name: currentStep.value.name, par: currentStep.value.par, used: stepState.value.movesUsed } : null
));
/** 攻めくらべの札。くらべる相手(居玉)の結果と、王手の回数か、この局面の結果。 */
const ATTACK_CHECKS = 5;
const attackChips = computed(() => {
  const step = currentStep.value;
  if (step?.type !== "attack-test") return [];
  const chips: { key: string; text: string; tone: string }[] = [];
  if (step.compareTo) chips.push({ key: "compare", text: `${step.compareTo.label}：${step.compareTo.result}`, tone: "" });
  if (attackOutcome.value) chips.push({ key: "result", text: `${step.label}：${attackOutcome.value}`, tone: "result" });
  else if (step.expect === "mate") chips.push({ key: "goal", text: `${step.label}を${step.plies}手で詰ませよう`, tone: "" });
  else chips.push({ key: "checks", text: `王手 ${stepState.value.checks ?? 0}/${step.maxChecks ?? ATTACK_CHECKS}`, tone: "" });
  return chips;
});
/**
 * 盤の上のひとこと(16-3)。見るマスのそばに1つだけ出す。正解・取り返しの一言があればそれを、
 * なければ課題・説明の見るところ(ねらう駒・大事なマス・玉の逃げ道の数)を、ステップのデータから自動で作る。
 */
const boardCallout = computed(() => {
  const step = currentStep.value;
  if (!step || !boardSfen.value || stageClear.value) return null;
  const callout = momentCallout.value
    ?? (stepSolved.value || refuting.value
      ? null
      : stepCallout(step, {
        sfen: boardSfen.value,
        marks: boardMarks.value,
        mateTask: isMateTask.value,
        movesUsed: stepState.value.movesUsed,
        speech: stepSpeech.value,
      }));
  if (!callout) return null;
  const anchors = "anchors" in callout && callout.anchors ? callout.anchors : callout.at;
  const placement = placeCallout(anchors, callout.text, { marks: boardMarks.value, sfen: boardSfen.value, avoid: boardAttackMarks.value });
  return placement ? { ...placement, text: callout.text, tone: "tone" in callout ? callout.tone : "" } : null;
});
/** 指した手の行き先のマス("7f+"・"P*5e"の"7f"・"5e")。 */
function usiDestination(usi: string) {
  return usi.replace("+", "").slice(-2);
}
const boardArrows = computed(() => (
  [...(currentStep.value?.type === "explain" ? currentStep.value.arrows ?? [] : []), ...hintView.value.arrows]
    .map((usi: string) => ({ usi, guideKind: "plan" as const }))
));
/** 課題のステップ(盤で指す・選択問題)。吹き出しを目標の見た目にする。 */
const isTaskStep = computed(() => stepInteractive.value || currentStep.value?.type === "choose");
/** 吹き出しの上に出す、課題の種類。 */
const taskLabel = computed(() => {
  if (!isTaskStep.value || stepSolved.value) return "";
  const step = currentStep.value;
  if (step?.type === "capture") return "駒取りゲーム";
  if (step?.type === "build") return step.drop ? "駒を並べよう" : "囲いを組もう";
  if (step?.type === "attack-test") return "攻めくらべ";
  if (step?.type === "problem") return problemKind.value === "escape" ? "逃げてみよう" : "詰ませてみよう";
  if (step?.type === "mate") return "詰ませてみよう";
  return step?.type === "choose" ? "クイズ" : "やってみよう";
});
const problemKind = computed(() => (isProblemStep.value ? tutorialProblem(currentStep.value)?.kind ?? "" : ""));
/** 答える課題の種類(腕だめしの問題数を数える)。 */
const TASK_STEP_TYPES = new Set(["move-piece", "find-move", "mate", "choose", "capture", "problem", "build", "attack-test"]);
/** 腕だめしの何問目か。腕だめしでは、課題の数と、いま何問目かを見せる(山場の進み具合)。 */
const bossProgress = computed(() => {
  const lesson = currentLesson.value;
  if (!lesson?.boss || !isTaskStep.value) return null;
  const tasks = (lesson.steps ?? []).map((step: any, index: number) => ({ step, index }))
    .filter(({ step }: { step: any }) => TASK_STEP_TYPES.has(step.type));
  return { number: tasks.findIndex(({ index }: { index: number }) => index === stepIndex.value) + 1, total: tasks.length };
});
/** 駒取りゲームの手数。目標(最短)と、いま何手か。 */
const captureCount = computed(() => (
  currentStep.value?.type === "capture" ? { par: currentStep.value.par, used: stepState.value.movesUsed } : null
));
/**
 * 画面を押すと進められるか。説明・図鑑の案内はいつでも、観戦は1手ずつ、課題は正解したあと(自動で進むのを待たずに進める)。
 * 対局のステップは「対局をはじめる」だけで進む。
 */
const tapToAdvance = computed(() => {
  const type = currentStep.value?.type;
  if (type === "explain" || type === "replay") return true;
  return isTaskStep.value && stepSolved.value;
});
const tapLabel = computed(() => {
  const step = currentStep.value;
  if (step?.type === "replay" && stepState.value.ply < step.moves.length) return "タップで次の手";
  if (dexPage.value < dexPages.value.length) return "タップで次の行";
  return stepIndex.value >= (currentLesson.value?.steps?.length ?? 0) - 1 ? "タップでレッスン完了" : "タップで次へ";
});
const hasActions = computed(() => {
  const type = currentStep.value?.type;
  return type === "play"
    || (stepInteractive.value && !stepSolved.value && stepState.value.movesUsed + stepState.value.ply > 0);
});
/** 選択問題でまちがえた選択肢。押せなくして、残りから選べるようにする。 */
const wrongChoices = ref<number[]>([]);
// 正解した押下や、続けて押した誤操作で、次のステップまで飛ばないようにする。
let lastTapAt = 0;
let solvedAt = 0;
/** 画面を押したとき。ボタンは各自の動きにまかせ、それ以外の場所を押したら進める。 */
function onStageTap(event: MouseEvent) {
  if ((event.target as HTMLElement | null)?.closest("button, select, a, input, summary")) return;
  advanceByTap();
}
function advanceByTap() {
  if (stageClear.value) {
    continueChain();
    return;
  }
  // 取り返しの再生中に押したら、待たずに局面を戻す。
  if (refuting.value) {
    refuteRestore?.();
    return;
  }
  const step = currentStep.value;
  if (!step || !tapToAdvance.value) return;
  const now = Date.now();
  if (now - lastTapAt < TUTORIAL_TAP_GUARD_MS || now - solvedAt < 400) return;
  lastTapAt = now;
  if (step.type === "replay" && stepState.value.ply < step.moves.length) seekReplayBy(1);
  else if (dexPage.value < dexPages.value.length) dexPage.value += 1;
  else advance();
}
/** キーボードでも進められる(Enter・スペース・→)。ボタンにフォーカスがあるときは、ボタンを押す動きにまかせる。 */
function onTutorialKeydown(event: KeyboardEvent) {
  if (view.value !== "lesson" || !["Enter", " ", "ArrowRight"].includes(event.key)) return;
  if ((event.target as HTMLElement | null)?.closest("button, select, input, textarea")) return;
  event.preventDefault();
  advanceByTap();
}
onMounted(() => window.addEventListener("keydown", onTutorialKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onTutorialKeydown));
/** 盤の課題で、しばらく操作がなければ、そっとヒントを出す(★には数えない)。 */
let idleHintTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleIdleHint() {
  clearTimeout(idleHintTimer);
  if (!stepInteractive.value || stepSolved.value) return;
  const index = stepIndex.value;
  idleHintTimer = setTimeout(() => {
    if (view.value !== "lesson" || stepIndex.value !== index || stepSolved.value || hintLevel.value > 0) return;
    hintLevel.value = 1;
    setFeedback(problemHint.value?.text || idleHintText(currentStep.value), "info");
  }, TUTORIAL_IDLE_HINT_MS);
}
onBeforeUnmount(() => clearTimeout(idleHintTimer));
/** しばらく操作がないときのヒントの一言。答えではなく、見方を渡す。 */
function idleHintText(step: any) {
  if (isMateTask.value) return "玉の逃げ道（緑のマス）を、全部ふさぐ王手を考えてみよう。";
  if (step?.type === "find-move") return "利きを見てみよう。青い数字が君の駒、赤い数字が相手の駒の利きだよ。";
  if (step?.type === "build") return "緑のマスに、薄く見えている駒を動かそう。";
  return "光っているマスに注目してみてね。";
}
// ===== その場の図鑑(16-4) =====
const DEX_TITLES: Record<string, string> = { piece: "駒図鑑", tesuji: "手筋図鑑", opening: "定跡図鑑", glossary: "用語辞典", world: "将棋界図鑑" };
/** 図鑑の行。押すたびに1行ずつめくる(0は図鑑の一言)。 */
const dexPage = ref(0);
const dexPages = computed<{ title: string; text: string }[]>(() => currentStep.value?.pages ?? []);
/** 定跡のおさらいで、小さな盤に描く手数。ステップを開くと0から完成形まで1手ずつ進める。 */
const formationPly = ref<number | null>(null);
const FORMATION_REPLAY_MS = 800;
let formationTimer: ReturnType<typeof setInterval> | undefined;
function startFormationReplay(step: any) {
  clearInterval(formationTimer);
  formationPly.value = null;
  if (!step?.replay || !step.formations?.length) return;
  const { strategyId, castleId } = step.formations[0];
  const total = openingFormationSteps(strategyId, castleId).steps.length;
  formationPly.value = 0;
  formationTimer = setInterval(() => {
    const next = (formationPly.value ?? 0) + 1;
    formationPly.value = next;
    if (next >= total) clearInterval(formationTimer);
  }, FORMATION_REPLAY_MS);
}
onBeforeUnmount(() => clearInterval(formationTimer));
const stepSpeech = computed(() => {
  const step = currentStep.value;
  const page = dexPage.value > 0 ? dexPages.value[dexPage.value - 1] : null;
  if (page) return `${page.title}：${page.text}`;
  if (step?.type === "replay") return replaySpeech(step, stepState.value.ply);
  if (step?.type === "problem") return tutorialProblemSpeech(step);
  return step?.question ?? step?.speech;
});
// ステップが変わったら(観戦は1手ごとにも)吹き出しの文を読み上げ、レッスンを離れたら止める。
watch(
  () => (view.value === "lesson" ? `${lessonId.value}:${stepIndex.value}:${stepSpeech.value ?? ""}` : ""),
  (key) => {
    if (key) speak(stepSpeech.value ?? "");
    else synth?.cancel();
  },
);
const replayLabel = computed(() => (
  currentStep.value?.type === "replay" ? replayMoveLabel(currentStep.value, stepState.value.ply) : ""
));
const graphPoints = computed(() => tutorialGraphPoints(currentStep.value));
const graphPly = computed(() => tutorialGraphPly(currentStep.value, stepState.value));
// 観戦中はグラフを押した手数へ盤を動かす（再生できる範囲の中だけ）。
function onGraphSelect(ply: number) {
  if (currentStep.value?.type === "replay") seekReplayTo(ply);
}
function seekReplayBy(delta: number) {
  seekReplayTo(stepState.value.ply + delta);
}
function seekReplayTo(ply: number) {
  const step = currentStep.value;
  if (step?.type !== "replay") return;
  const before = stepState.value;
  stepState.value = seekReplay(step, before, ply);
  // 1手進めたときだけ駒音を鳴らし、駒を取った手なら先手から見た駒得の数字を浮かべる。
  if (stepState.value.ply === before.ply + 1) {
    playMoveSoundFor(before.sfen, step.moves[before.ply]);
    const pop = capturePop(before.sfen, step.moves[before.ply], "black", (floatSeq += 1));
    if (pop) {
      floatLabels.value = [...floatLabels.value, pop];
      floatTimers.push(setTimeout(() => { floatLabels.value = floatLabels.value.filter(({ id }) => id !== pop.id); }, CAPTURE_POP_MS));
    }
  }
  stepSolved.value = stepState.value.solved;
  lastMove.value = step.moves[stepState.value.ply - 1] ?? "";
}

// 正解のあとに自動で次へ進めるタイマーと、詰将棋で相手の応手の駒音を少し遅らせるタイマー。
let stepTimers: ReturnType<typeof setTimeout>[] = [];
function clearStepTimers() {
  for (const timer of stepTimers) clearTimeout(timer);
  stepTimers = [];
}
onBeforeUnmount(clearStepTimers);

/**
 * 正解のはなまる。盤の上に短く出す(操作は止めない)。大事な瞬間は少し大きく見せる(Game_Nintendo_Implementation.mdの3-1)。
 */
const stamp = ref<{ text: string; key: number; big: boolean } | null>(null);
let stampTimer: ReturnType<typeof setTimeout> | undefined;
const STAMP_MS = 900;
function showStamp(text: string, big = false) {
  clearTimeout(stampTimer);
  stamp.value = { text, key: Date.now(), big };
  stampTimer = setTimeout(() => { stamp.value = null; }, STAMP_MS);
}
onBeforeUnmount(() => clearTimeout(stampTimer));

function loadStep(index: number) {
  clearStepTimers();
  stepIndex.value = index;
  const step = currentLesson.value?.steps?.[index];
  stepState.value = step?.type === "problem"
    ? createProblemState(step)
    : step?.type === "attack-test" ? createAttackState(step) : createStepState(step);
  stepSolved.value = false;
  clearFloats();
  materialTotal.value = 0;
  materialSeen.value = false;
  attackOutcome.value = "";
  mateShown.value = false;
  refuting.value = false;
  refuteRestore = null;
  momentCallout.value = null;
  proverbCard.value = null;
  dexPage.value = 0;
  startFormationReplay(step);
  // 道具を手に入れる場面。判を押して、見出しにボタンを出す(ごほうびはすぐ使えるように)。
  if (step?.tool === "kiki-glasses" && !ownsGlasses.value) {
    toolGranted.value = true;
    glassesNew.value = true;
    showStamp("メガネGET！", true);
  }
  stepMisses.value = 0;
  hintLevel.value = 0;
  feedback.value = "";
  feedbackVoice.value = "";
  wrongChoices.value = [];
  scheduleIdleHint();
  // 棋譜の途中から始めるステップは、直前の手を強調する。
  const played = step?.type === "replay" ? step.moves.slice(0, step.from ?? 0) : (step?.sfen ? [] : step?.moves ?? []);
  lastMove.value = played.at(-1) ?? "";
}
function startLesson(id: string) {
  clearChain();
  if (!id.startsWith("review:")) reviewResult.value = null;
  newTitle.value = null;
  lessonId.value = id;
  mistakes.value = 0;
  hints.value = 0;
  streak.value = 0;
  runMissed = new Set();
  reviewSolved = [];
  view.value = "lesson";
  loadStep(0);
}
function resetStep() {
  loadStep(stepIndex.value);
}
function setFeedback(text: string, tone: "good" | "bad" | "info", voice = text) {
  feedback.value = text;
  feedbackTone.value = tone;
  feedbackVoice.value = voice;
  speak(voice);
}
/** まちがえたとき。★の計算と、ステップのまちがいに数え、れんぞくを途切れさせる。ヒントを1段ずつ強くする。 */
function countMiss() {
  mistakes.value += 1;
  stepMisses.value += 1;
  streak.value = 0;
  hintLevel.value = Math.min(2, hintLevel.value + 1);
}
/** 正解のほめ言葉(何が良かったか)。課題に書いたpraiseがなければ、種類ごとの一言にする。 */
function praiseFor(step: any) {
  if (step.praise) return step.praise;
  if (step.type === "mate") return "詰み！ 玉の逃げ道を全部ふさげたね。";
  if (step.type === "build") return `${step.name}、完成！`;
  if (step.type === "move-piece") return "着いたね！ 駒の動き、ばっちり。";
  return "正解！ いい手を見つけたね。";
}
/**
 * 課題に正解したとき。ほめ言葉・はなまる・れんぞくを出し、読む時間をとってから自動で次へ進む。
 * delayを省くと、盤の課題の標準の時間で進む。nullなら自動では進まず、画面を押して進む(長い解説を読ませるとき)。
 */
function solveStep(
  text: string,
  { delay = TUTORIAL_AUTO_ADVANCE_MS as number | null, stampText = "正解", big = false, at = "", lead: splitLead = true } = {},
) {
  stepSolved.value = true;
  solvedAt = Date.now();
  clearTimeout(idleHintTimer);
  hintLevel.value = 0;
  if (stepMisses.value === 0) streak.value += 1;
  // まちがえた課題は苦手に残す。にがてをもう1回で、まちがえずに解けたら苦手から消す。
  const origin = currentStep.value?.origin;
  if (stepMisses.value > 0) runMissed.add(stepIndex.value);
  else if (origin) reviewSolved.push(origin);
  // 動かした駒のそばに、ほめ言葉の最初の一句を出し、吹き出しには続きだけを出す(読み上げは全部読む)。
  const { lead, rest } = at && splitLead ? splitLeadPhrase(text) : { lead: "", rest: text };
  const solvedCallout = lead ? stepCallout(currentStep.value, { phase: "solved", moved: at, lead }) : null;
  momentCallout.value = solvedCallout ? { ...solvedCallout, tone: "good" } : null;
  // 格言札(16-5)。まちがえても、解き終えたら出す。押すまで次へ進めない(札を読む時間をとる)。
  const card = currentStep.value?.proverb ? showProverbCard(currentStep.value, at) : null;
  // 札を出すときは、盤の上の一言が「この手！」になるので、吹き出しにはほめ言葉を全部出す。
  setFeedback(lead && !card ? rest : text, "good", card ? `${text} ${card.line}「${card.label}」。${card.overview}` : text);
  showStamp(stampText, big);
  if (delay === null || card) return;
  const index = stepIndex.value;
  stepTimers.push(setTimeout(() => {
    if (view.value === "lesson" && stepIndex.value === index) advance();
  }, delay));
}
function onBoardMove(usi: string) {
  const step = currentStep.value;
  if (!step || stepSolved.value) return;
  scheduleIdleHint();
  if (step.type === "problem") {
    onProblemMove(step, usi);
    return;
  }
  if (step.type === "attack-test") {
    onAttackMove(step, usi);
    return;
  }
  const before = stepState.value.sfen;
  const result: any = attemptTutorialMove(step, stepState.value, usi);
  if (result.outcome === "wrong") {
    // 囲いに使わない駒を動かそうとしたときは、まちがいに数えず、使う駒を伝える(不可の分類)。
    if (result.reason === "not-castle-piece") {
      setFeedback(step.drop ? "持ち駒を選んで、薄く見えているマスに打とう。" : "囲いに使うのは、薄く見えている駒だよ。その駒を動かしてね。", "info");
      return;
    }
    if (result.reason === "wrong-square") {
      countMiss();
      const name = PIECE_LABELS[usi[0]] ?? "その駒";
      setFeedback(result.expected ? `${name}は${squareLabel(result.expected)}に置こう。薄く見えている${name}のマスだよ。` : `${name}はもう並べ終わったよ。`, "bad");
      return;
    }
    countMiss();
    if (result.reason === "refuted") {
      playRefutation(before, usi, result.refutation);
      return;
    }
    const reason = ({
      illegal: "その手は指せないよ。駒の動きをもう一度確かめてみよう！",
      "other-piece": step.type === "capture" ? "動かせるのは、最初に置いてあった駒だけだよ。" : "動かす駒がちがうよ。光っている駒を動かしてね。",
      "too-many-moves": "手数を使い切っちゃった。最初からもう一度やってみよう！",
      stuck: "残りの駒にもう届かないね。最初からもう一度やってみよう！",
      "smaller-gain": "それも駒得だけど、もっと高い駒が取れるよ。ねらわれている駒をよく見てみよう！",
      "no-gain": "いまは駒を取るチャンス！ 取って得をする駒を探そう。",
      "no-threat": "その手だと、相手は何もしなくても詰まないよ。次に詰ませる形を作ろう！",
      "check-not-threat": "王手は受けられちゃう。王手をしないで、次に詰ませる形（詰めろ）を作ろう！",
    } as Record<string, string>)[result.reason ?? ""] ?? "おしい！ もう一度考えてみよう。";
    setFeedback(reason, "bad");
    stepState.value = result.state;
    return;
  }
  stepState.value = result.state;
  lastMove.value = usi;
  playMoveSoundFor(before, usi);
  popCapture(before, usi);
  if (result.reply) {
    const reply = result.reply;
    const afterMine = applyBefore(before, usi);
    lastMove.value = reply;
    // 相手の応手の駒音と駒得の数字は、自分の手と重ならないよう少し遅らせる。
    stepTimers.push(setTimeout(() => playMoveSoundFor(afterMine, reply), 350));
    popCapture(afterMine, reply, 350);
    if (result.outcome === "continue") {
      const replyText = formatHintMove(reply, afterMine);
      setFeedback(
        step.type === "mate"
          ? `相手は${replyText}と応じたよ。続けて詰ませよう！`
          : step.untilGain
            ? (result.next === "gain"
              ? `相手は${replyText}。ねらっている駒を取って、駒得しよう！`
              : `相手は${replyText}。手筋の続きを指そう！`)
            : `相手は${replyText}と取り返したよ。続けて指そう！`,
        "info",
      );
    }
  }
  if (result.outcome === "continue") {
    if (result.reply) {
      // 台詞は上で出した。
    } else if (step.type === "capture") {
      setFeedback(result.captured ? `取った！ のこり${result.left}枚。` : `${stepState.value.movesUsed}手目。赤いマスの駒をねらおう！`, "info");
    } else if (step.type === "build") {
      setFeedback(result.placed ? `カチッ！ のこり${result.left}マス。` : `${stepState.value.movesUsed}手目。薄く見えている駒のマスへ動かそう！`, "info");
    } else {
      setFeedback("その調子！ 続けて動かそう。", "info");
    }
    hintLevel.value = 0;
    return;
  }
  if (step.type === "capture") {
    // 最短の手数で取りきれたら「最短！」。手数が多いときはクリアにして、★の計算でまちがい1回に数える。
    const best = result.movesUsed <= result.par;
    if (!best) {
      mistakes.value += 1;
      stepMisses.value += 1;
    }
    // 取った駒の値段の合計を、点数を集める遊びとして伝える(値段の説明は第2巻でする)。
    const score = `全部で＋${materialTotal.value}！ `;
    const text = best
      ? `最短の${result.movesUsed}手！ ${score}${praiseFor(step)}`
      : `全部取れたね！ ${score}${result.movesUsed}手かかったけど、最短は${result.par}手。もう一度やると、近道が見つかるかも。`;
    solveStep(text, { stampText: best ? "最短！" : "正解", big: best, delay: best ? 1600 : 2600, at: usiDestination(usi), lead: false });
    return;
  }
  if (step.type === "build") {
    // 目標の手数で組めたら「最短！」。手数が多いときはクリアにして、★の計算でまちがい1回に数える。
    const best = result.movesUsed <= result.par;
    if (!best) {
      mistakes.value += 1;
      stepMisses.value += 1;
    }
    const text = best
      ? `最短の${result.movesUsed}手！ ${praiseFor(step)}`
      : `${result.movesUsed}手で組めたね。最短は${result.par}手だよ。${praiseFor(step)}`;
    solveStep(text, { stampText: "完成！", big: true, delay: Math.max(1800, choiceAdvanceDelay(text)), at: usiDestination(usi), lead: false });
    return;
  }
  if (step.type === "mate") mateShown.value = true;
  // 駒得するまで指す課題は、最後に合計の損得を言う(何が良かったかを数字で伝える)。
  const gainNote = step.untilGain ? `合計${materialLabel(result.swing ?? 0).text.replace(/^駒得 /, "")}の駒得！ ` : "";
  const text = `${gainNote}${praiseFor(step)}${sacrificeNote()}`;
  solveStep(text, {
    stampText: step.type === "mate" ? "詰み！" : "正解",
    big: step.type === "mate",
    delay: choiceAdvanceDelay(text),
    at: usiDestination(usi),
  });
}
/** 台詞で呼ぶ駒の名前と、マスの名前(「6九」)。 */
const PIECE_LABELS: Record<string, string> = { P: "歩", L: "香車", N: "桂馬", S: "銀", G: "金", B: "角", R: "飛車", K: "玉" };
const RANK_KANJI = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
function squareLabel(square: string) {
  return `${square[0]}${RANK_KANJI[square.charCodeAt(1) - 96]}`;
}
/** 駒を捨てて詰ませたとき(合計が駒損)に添える一言。格言「終盤は駒の損得より速度」につなぐ。 */
function sacrificeNote() {
  return materialSeen.value && materialTotal.value < 0 ? " 駒損でも、詰ませれば勝ち！ 終盤は駒の損得より速さだよ。" : "";
}
/**
 * 取り返しの再生。取られる場所へ動かしたまちがいで、指した手と相手の取り返しを見せてから、局面を戻す。
 * 押せば待たずに戻す(演出で待たせない)。
 */
const REFUTE_REPLY_MS = 450;
const REFUTE_RESET_MS = 1300;
function playRefutation(before: string, usi: string, refutation: { reply: string; square: string; kind?: "drop" | "mate" }) {
  const original = stepState.value;
  const totalBefore = materialTotal.value;
  const seenBefore = materialSeen.value;
  const index = stepIndex.value;
  const afterMine = applyUsi(before, usi);
  const afterReply = applyUsi(afterMine, refutation.reply);
  refuting.value = true;
  const refuteCallout = stepCallout(currentStep.value, { phase: "refute", refuteSquare: refutation.square, refuteKind: refutation.kind ?? "" });
  momentCallout.value = refuteCallout ? { ...refuteCallout, tone: "bad" } : null;
  playMoveSoundFor(before, usi);
  popCapture(before, usi);
  stepState.value = { ...original, sfen: afterMine };
  lastMove.value = usi;
  const replyText = formatHintMove(refutation.reply, afterMine);
  setFeedback(
    refutation.kind === "drop"
      ? `あっ、${replyText}と打たれて、両取りになっちゃう！ 打ち込まれる隙が残っていたね。`
      : refutation.kind === "mate"
        ? `あっ、${replyText}で詰まされちゃう！ 相手の次の手を考えて受けよう。`
        : `あっ、${replyText}と取られちゃう！ 相手の利きがあるマスだったね。`,
    "bad",
  );
  const restore = () => {
    if (!refuting.value || stepIndex.value !== index) return;
    refuting.value = false;
    refuteRestore = null;
    momentCallout.value = null;
    stepState.value = original;
    lastMove.value = "";
    materialTotal.value = totalBefore;
    materialSeen.value = seenBefore;
  };
  refuteRestore = restore;
  stepTimers.push(setTimeout(() => {
    if (!refuting.value || stepIndex.value !== index) return;
    playMoveSoundFor(afterMine, refutation.reply);
    popCapture(afterMine, refutation.reply);
    stepState.value = { ...original, sfen: afterReply };
    lastMove.value = refutation.reply;
  }, REFUTE_REPLY_MS));
  stepTimers.push(setTimeout(restore, REFUTE_REPLY_MS + REFUTE_RESET_MS));
}
/** 攻めくらべ。王手だけを指せる。居玉は詰ませ、囲いは詰まないことを確かめる。 */
function onAttackMove(step: any, usi: string) {
  const before = stepState.value.sfen;
  const result = attemptAttackMove(step, stepState.value, usi);
  if (result.outcome === "wrong") {
    // 王手でない手は、まちがいに数えず、王手で攻めるよう促す(不可の分類)。
    if (result.reason === "not-check") {
      setFeedback("王手で攻めてみよう！ 王手は、次に玉を取れる手のことだよ。", "info");
      return;
    }
    countMiss();
    setFeedback(result.reason === "escapes" ? "その王手だと、玉に逃げられちゃう。別の王手を探そう！" : "その手は指せないよ。", "bad");
    return;
  }
  playMoveSoundFor(before, usi);
  popCapture(before, usi);
  stepState.value = result.state;
  lastMove.value = usi;
  const afterMine = applyUsi(before, usi);
  if (result.reply) {
    const reply = result.reply;
    lastMove.value = reply;
    stepTimers.push(setTimeout(() => playMoveSoundFor(afterMine, reply), 350));
    popCapture(afterMine, reply, 350);
  }
  if (result.outcome === "continue") {
    setFeedback(`王手！ 相手は${formatHintMove(result.reply ?? "", afterMine)}。続けて王手しよう！`, "info");
    hintLevel.value = 0;
    return;
  }
  if (result.mated) {
    attackOutcome.value = attackResultLabel({ mated: true, checks: result.state.checks });
    mateShown.value = true;
    solveStep(praiseFor(step), { stampText: "詰み！", big: true, delay: null, at: usiDestination(usi), lead: false });
    return;
  }
  attackOutcome.value = attackResultLabel({ mated: false, checks: result.state.checks });
  const compare = step.compareTo ? `${step.compareTo.label}は${step.compareTo.result}だったのに、` : "";
  solveStep(
    `${step.label}は詰まなかった！ ${compare}同じ攻めでも、囲いがあるとびくともしないね。`,
    { stampText: "詰まない！", big: true, delay: null },
  );
}
/** 問題集の問題。判定と台詞は問題集と同じ。相手の応手は、自分の手の音のあとに鳴らす。 */
function onProblemMove(step: any, usi: string) {
  const before = stepState.value.sfen;
  const result = attemptProblemMove(step, stepState.value, usi);
  if (result.outcome === "wrong") {
    countMiss();
    setFeedback(result.speech || "おしい！ もう一度考えてみよう。", "bad");
    return;
  }
  playMoveSoundFor(before, usi);
  popCapture(before, usi);
  stepState.value = result.state;
  lastMove.value = usi;
  if (result.reply) {
    const reply = result.reply;
    const afterMine = applyBefore(before, usi);
    lastMove.value = reply;
    stepTimers.push(setTimeout(() => playMoveSoundFor(afterMine, reply), 350));
    popCapture(afterMine, reply, 350);
  }
  if (result.outcome === "continue") {
    // 逃げる問題で答えが決まったとき(続きの1手を指す前)も、正解のはなまるを押す。
    const answered = result.speech.startsWith("正解");
    setFeedback(result.speech, answered ? "good" : "info");
    if (answered) showStamp("正解");
    hintLevel.value = 0;
    return;
  }
  // 解いた問題は、問題集の記録にも付ける(まちがえず、ヒントも見ずに解けたら「一発」)。
  recordTutorialProblem(storage, step, { firstTry: stepMisses.value === 0 && hintLevel.value === 0 });
  const mate = problemKind.value !== "escape";
  if (mate) mateShown.value = true;
  // 問題集の解説は、なぜ詰むか・なぜ逃げられるかを伝える長い文なので、自動では進めない。
  solveStep(`${result.speech}${mate ? sacrificeNote() : ""}`, { stampText: mate ? "詰み！" : "正解", big: mate, delay: null });
}
// 相手の応手を表示するため、自分の手を指した直後の局面を作る。
function applyBefore(sfen: string, usi: string) {
  const state = attemptTutorialMove({ type: "find-move", answers: [usi] }, { ...stepState.value, sfen }, usi);
  return state.state.sfen;
}
function choose(index: number) {
  const step = currentStep.value;
  if (!step || stepSolved.value) return;
  if (attemptTutorialChoice(step, index) === "correct") {
    // 解説を読む時間をとってから、自動で次へ進む。画面を押せば待たずに進める。
    solveStep(`正解！ ${step.explanation ?? ""}`, { delay: choiceAdvanceDelay(step.explanation ?? "") });
  } else {
    mistakes.value += 1;
    stepMisses.value += 1;
    streak.value = 0;
    wrongChoices.value = [...wrongChoices.value, index];
    setFeedback("ちがうみたい。ほかのを選んでみよう！", "bad");
  }
}
function finishLesson() {
  const lesson = currentLesson.value;
  if (!lesson) return;
  if (lesson.review) {
    finishReview(lesson);
    return;
  }
  // 最後まで遊んだ回の結果で、このレッスンの苦手を置き換える。
  updateWeakSteps(recordLessonWeakSteps(weakSteps.value, lesson.id, [...runMissed]));
  const stars = lessonStars({ mistakes: mistakes.value, hints: hints.value });
  updateProgress(recordLessonCleared(progress.value, lesson.id, stars));
  // レッスンを終えたら、続けて遊んだ日に数える。
  savePlayStreak(storage, recordPlay(loadPlayStreak(storage)));
  continueAfter(lesson, stars);
}
function advance() {
  clearStepTimers();
  const lesson = currentLesson.value;
  if (!lesson?.steps) return;
  if (stepIndex.value >= lesson.steps.length - 1) finishLesson();
  else loadStep(stepIndex.value + 1);
}
/** にがてをもう1回を終えたとき。まちがえずに解いた課題を苦手から消し、章クリアの画面へ戻る。★は付けない。 */
function finishReview(lesson: Lesson) {
  const before = weakCount(lesson.chapterId);
  updateWeakSteps(clearWeakSteps(weakSteps.value, reviewSolved));
  const left = weakCount(lesson.chapterId);
  savePlayStreak(storage, recordPlay(loadPlayStreak(storage)));
  reviewResult.value = { cleared: before - left, left };
  showChapterClear(lesson.chapterId);
}
function skipCurrentLesson() {
  const lesson = currentLesson.value;
  if (!lesson) return;
  if (lesson.review) {
    showChapterClear(lesson.chapterId);
    return;
  }
  updateProgress(recordLessonSkipped(progress.value, lesson.id));
  continueAfter(lesson, null);
}
// 対局ステップ。条件はレッスンで固定し、クリアと★は終局後に決める。
const playStep = computed(() => currentLesson.value?.steps?.find(({ type }: { type: string }) => type === "play") ?? null);
function openingLabel(strategyId?: string, castleId?: string) {
  const strategy = OPENING_STRATEGIES.find(({ id }: { id: string }) => id === strategyId)?.label;
  const castle = OPENING_CASTLES.find(({ id }: { id: string }) => id === castleId)?.label;
  return [strategy, castle].filter(Boolean).join("＋") || "おまかせ";
}
function assistLimitLabel(limit: number) {
  return limit < 0 ? "無制限" : `${limit}回`;
}
const playConditions = computed(() => {
  const step = currentStep.value;
  if (step?.type !== "play") return [];
  const settings = tutorialMatchSettings(step.preset);
  const cpu = CPU_STRENGTH_PRESETS.find(({ level }) => level === settings.cpuLevel);
  return [
    { label: "手番", value: settings.playerColor === "white" ? "後手（あなた）" : "先手（あなた）" },
    ...(settings.startType === "formation"
      ? [
        { label: "あなたの形", value: openingLabel(settings.playerStrategy, settings.playerCastle) },
        { label: "相手の形", value: openingLabel(settings.opponentStrategy, settings.opponentCastle) },
      ]
      : []),
    { label: "相手", value: cpu ? `CPU Lv${cpu.level}（${cpu.label}）` : "CPU" },
    { label: "閃き・待った", value: `閃き${assistLimitLabel(settings.hintLimit)}・待った${assistLimitLabel(settings.undoLimit)}` },
  ];
});
function startMatch() {
  const lesson = currentLesson.value;
  const step = playStep.value;
  if (!lesson || !step) return;
  emit("start-match", { lessonId: lesson.id, preset: tutorialMatchSettings(step.preset) });
}

// ===== 結果 =====
const matchResult = ref<TutorialMatchReport | null>(null);
const matchOutcome = computed(() => matchResult.value?.outcome ?? "");
const matchOutcomeLabel = computed(() => (
  matchResult.value ? ({ win: "勝ち！", lose: "負け", draw: "引き分け" })[matchResult.value.outcome] : ""
));
const matchComment = computed(() => (
  matchResult.value ? matchLessonComment(matchResult.value, playStep.value?.comments) : ""
));
// 0: 一言だけ / 1: 星を1つずつ付けている / 2: 付け終わり（ボタンを出す）
const revealStage = ref(2);
const revealedStars = ref(0);
let revealTimers: ReturnType<typeof setTimeout>[] = [];
function clearRevealTimers() {
  for (const timer of revealTimers) clearTimeout(timer);
  revealTimers = [];
}
function finishReveal() {
  if (revealStage.value >= 2) return;
  clearRevealTimers();
  revealedStars.value = resultStars.value;
  revealStage.value = 2;
}
function showResult(stars: number, report: TutorialMatchReport | null) {
  const lesson = currentLesson.value;
  if (!lesson) return;
  clearRevealTimers();
  resultStars.value = stars;
  matchResult.value = report;
  updateProgress(recordLessonCleared(progress.value, lesson.id, stars));
  // レッスンを終えたら、続けて遊んだ日に数える。
  savePlayStreak(storage, recordPlay(loadPlayStreak(storage)));
  view.value = "result";
  revealedStars.value = 0;
  revealStage.value = 0;
  // 対局のあとは、やこび姫の一言を読む時間を取ってから星を付ける。待たせないよう、星は短い間隔で付ける。
  const start = report ? 1200 : 200;
  revealTimers.push(setTimeout(() => { revealStage.value = 1; }, start));
  for (let index = 1; index <= stars; index += 1) {
    revealTimers.push(setTimeout(() => { revealedStars.value = index; }, start + index * 280));
  }
  revealTimers.push(setTimeout(() => { revealStage.value = 2; }, start + stars * 280 + 250));
}
onBeforeUnmount(clearRevealTimers);
/** 結果のボタンが出たら「次のレッスン」にフォーカスし、Enterだけでも進めるようにする。 */
const nextLessonButton = ref<HTMLButtonElement | null>(null);
watch(revealStage, (stage) => {
  if (stage >= 2) void nextTick(() => nextLessonButton.value?.focus());
});
onMounted(() => {
  const report = props.matchReport;
  // タイトル画面の「将棋教室のつづき」からは、地図を通さずに次のレッスンを始める。
  if (!report && props.autoStart && upcomingLesson.value) {
    startLesson(upcomingLesson.value.id);
    return;
  }
  if (!report || !tutorialLesson(report.lessonId)) {
    // 地図を開いたら、いま進めるマスが見える位置までスクロールする。
    void nextTick(() => mapEl.value?.querySelector("[data-map-current]")?.scrollIntoView({ block: "center" }));
    return;
  }
  lessonId.value = report.lessonId;
  showResult(matchLessonStars(report), report);
});
/** 対局のレッスンの結果から、次へ進む(同じ章の次のレッスンか、章クリア)。 */
function continueAfterResult() {
  if (currentLesson.value) continueAfter(currentLesson.value, null);
}
const followingLesson = computed(() => {
  const index = lessons.findIndex(({ id }) => id === lessonId.value);
  return lessons.slice(index + 1).find((lesson) => !lesson.comingSoon) ?? null;
});
const resultMessage = computed(() => {
  if (matchResult.value) {
    if (matchResult.value.outcome !== "win") return "最後まで指したから★1つ！ 勝つと★2つ、閃きも待ったも使わずに勝つと★3つだよ。";
    return resultStars.value >= 3
      ? "閃きも待ったも使わずに勝ったから★3つ！ 完ぺきだね！"
      : "勝ったから★2つ！ 次は閃きも待ったも使わずに★3つを目指そう。";
  }
  return ([
    "",
    "クリアおめでとう！ まちがえたところは、もう一度やってみると覚えられるよ。",
    "よくできました！ あと少しで満点だったね。",
    "満点！ 完ぺきだね、すごい！",
  ])[resultStars.value];
});
</script>

<style>
.shogi-game .shogi-tutorial__shelf,
.shogi-game .shogi-tutorial__map,
.shogi-game .shogi-tutorial__chapter-clear,
.shogi-game .shogi-tutorial__result {
  flex: 1;
  overflow-y: auto;
  padding: 0.8rem clamp(0.8rem, 3vw, 2rem) 1.5rem;
  font-size: var(--dex-text);
}
.shogi-game .shogi-tutorial__intro {
  max-width: 48rem;
  margin: 0 auto 0.8rem;
}
/* 次に進む先を示す、画面でいちばん目立つボタン。押すと影の分だけ沈む。 */
.shogi-game .shogi-tutorial__continue {
  display: block;
  width: min(100%, 40rem);
  min-height: 3.2rem;
  margin: 0 auto 1.1rem;
  padding: 0.75rem 1rem;
  border: 2px solid #f1a54c;
  border-radius: 0.8rem;
  color: #172632;
  background: #f1a54c;
  box-shadow: 0 4px 0 #b57c39;
  font: inherit;
  font-size: 1.05em;
  font-weight: 800;
  cursor: pointer;
}
.shogi-game .shogi-tutorial__continue::before {
  content: "▶";
  margin-right: 0.5em;
  font-size: 0.85em;
}
.shogi-game .shogi-tutorial__continue:active {
  box-shadow: 0 1px 0 #b57c39;
  transform: translateY(3px);
}
.shogi-game .shogi-tutorial__meter {
  display: block;
  height: 0.45rem;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255, 252, 244, 0.18);
}
.shogi-game .shogi-tutorial__meter > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #f1a54c;
  transition: width 200ms ease;
}
.shogi-game .shogi-tutorial__skip-chapter,
.shogi-game .shogi-tutorial__skip {
  padding: 0.25rem 0.7rem;
  border: 1px solid rgba(255, 252, 244, 0.45);
  border-radius: 999px;
  color: #fffcf4;
  background: transparent;
  font: inherit;
  font-size: 0.8em;
  cursor: pointer;
}
.shogi-game .shogi-tutorial__lesson {
  display: flex;
  gap: 0.7rem;
  align-items: center;
  width: 100%;
  padding: 0.55rem 0.8rem;
  border: 1px solid rgba(255, 252, 244, 0.3);
  border-radius: 0.5rem;
  color: #fffcf4;
  background: rgba(29, 48, 63, 0.75);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.shogi-game .shogi-tutorial__lesson:disabled {
  cursor: default;
  opacity: 0.55;
}
.shogi-game .shogi-tutorial__lesson--next {
  border-color: #f1a54c;
  box-shadow: 0 0 0 2px rgba(241, 165, 76, 0.45);
}
.shogi-game .shogi-tutorial__lesson--cleared .shogi-tutorial__lesson-badge {
  color: #f6d365;
}
.shogi-game .shogi-tutorial__lesson--skipped {
  opacity: 0.8;
}
.shogi-game .shogi-tutorial__lesson-badge {
  flex: none;
  min-width: 3.2em;
  color: #f1a54c;
  font-weight: 800;
  text-align: center;
}
.shogi-game .shogi-tutorial__lesson-text {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
}
.shogi-game .shogi-tutorial__lesson-text small {
  font-size: 0.8em;
  opacity: 0.8;
}
.shogi-game .shogi-tutorial__lesson-view {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}
/*
 * レッスン画面。台詞を盤の横に置くと視線が左右に離れて読みにくいので、画面の幅によらず
 * 台詞と操作を盤の真下に付けて置く。盤の枠の大きさはスクリプトで盤に合わせ、余った高さは台詞の下に残す。
 */
.shogi-game .shogi-tutorial .shogi-tutorial__stage {
  flex: 1 1 auto;
  flex-direction: column;
  justify-content: flex-start;
  gap: 0.25rem;
  min-height: 0;
  padding: 0.4rem clamp(0.5rem, 2vw, 1.5rem) 0.6rem;
  overflow-y: auto;
}
.shogi-game .shogi-tutorial .shogi-tutorial__stage > .shogi-dex__main {
  flex: none;
  align-items: center;
  min-width: 0;
}
.shogi-game .shogi-tutorial .shogi-tutorial__stage .shogi-dex__board {
  flex: none;
  max-width: 100%;
  aspect-ratio: auto;
}
.shogi-game .shogi-tutorial .shogi-tutorial__panel {
  flex: none;
  width: min(100%, 44rem);
  min-width: 0;
  align-self: center;
}
.shogi-game .shogi-tutorial__panel .shogi-dex__explanation {
  display: grid;
  gap: 0.45rem;
  padding: 0.5rem 0.7rem;
  font-size: var(--dex-text);
}
.shogi-game .shogi-tutorial__panel .shogi-dex__speech {
  align-items: center;
  margin: 0;
}
.shogi-game .shogi-tutorial__panel .shogi-dex__chara {
  height: clamp(52px, 8vh, 80px);
}
.shogi-game .shogi-tutorial__sub {
  margin: 0;
  opacity: 0.85;
}
/* 選択肢は、収まるだけ横に並べる(縦に積むと盤が小さくなるため)。長い選択肢は自然に折り返す。 */
.shogi-game .shogi-tutorial__options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 9rem), 1fr));
  gap: 0.45rem;
}
.shogi-game .shogi-tutorial__options button,
.shogi-game .shogi-tutorial__actions button,
.shogi-game .shogi-tutorial__result-actions button {
  min-height: 2.6em;
  padding: 0.45rem 0.8rem;
  border: 1px solid rgba(255, 252, 244, 0.5);
  border-radius: 0.45rem;
  color: #fffcf4;
  background: rgba(29, 48, 63, 0.9);
  font: inherit;
  cursor: pointer;
}
.shogi-game .shogi-tutorial__options button:disabled {
  cursor: default;
  opacity: 0.6;
}
.shogi-game .shogi-tutorial .shogi-tutorial__options button.shogi-tutorial__option--correct:disabled {
  border-color: #6ee7b7;
  opacity: 1;
  background: rgba(16, 185, 129, 0.35);
}
.shogi-game .shogi-tutorial__graph .evaluation-graph__svg {
  height: 8.5rem;
}
/* グラフの下の手数と評価値は、暗いパネルの上で読める色にする。 */
.shogi-game .shogi-tutorial__graph .evaluation-graph__selection {
  color: #f8fafc;
  font-size: 0.85rem;
}
.shogi-game .shogi-tutorial__graph .evaluation-graph__selection span {
  color: #fde68a;
}
.shogi-game .shogi-tutorial__replay {
  display: grid;
  gap: 0.45rem;
}
.shogi-game .shogi-tutorial__replay-move {
  margin: 0;
  font-weight: 800;
}
.shogi-game .shogi-tutorial__replay-move small {
  font-weight: 400;
  opacity: 0.75;
}
.shogi-game .shogi-tutorial__replay-controls {
  display: flex;
  gap: 0.45rem;
}
.shogi-game .shogi-tutorial__replay-controls button {
  flex: 1 1 0;
  min-height: 2.6em;
  padding: 0.45rem 0.8rem;
  border: 1px solid rgba(255, 252, 244, 0.5);
  border-radius: 0.45rem;
  color: #fffcf4;
  background: rgba(29, 48, 63, 0.9);
  font: inherit;
  cursor: pointer;
}
.shogi-game .shogi-tutorial__replay-controls button:disabled {
  cursor: default;
  opacity: 0.45;
}
.shogi-game .shogi-tutorial__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}
.shogi-game .shogi-tutorial__actions button {
  flex: 1 1 6em;
}
.shogi-game .shogi-tutorial .shogi-tutorial__primary {
  border-color: #f1a54c;
  color: #172632;
  background: #f1a54c;
  font-weight: 800;
}
.shogi-game .shogi-tutorial__feedback {
  margin: 0;
  padding: 0.45rem 0.7rem;
  border-radius: 0.4rem;
  font-weight: 700;
}
/* 正解は明るい緑の札で、出た瞬間に小さく弾ませる。 */
.shogi-game .shogi-tutorial__feedback--good {
  color: #10281b;
  background: #8fdcaa;
  box-shadow: 0 3px 0 #4e9d6c;
  animation: shogi-tutorial-feedback-pop 260ms cubic-bezier(0.3, 1.5, 0.5, 1) both;
}
.shogi-game .shogi-tutorial__feedback--good::before {
  content: "◎ ";
}
/* 間違いは責める感じにならないよう、赤ではなく落ち着いた薄紫にする。 */
.shogi-game .shogi-tutorial__feedback--bad {
  border-left: 4px solid #d7d1fd;
  background: rgba(215, 209, 253, 0.16);
}
@keyframes shogi-tutorial-feedback-pop {
  0% { transform: scale(0.85); opacity: 0; }
  100% { transform: none; opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .shogi-game .shogi-tutorial__feedback--good { animation: none; }
}
.shogi-game .shogi-tutorial__feedback--info { background: rgba(96, 165, 250, 0.22); }
.shogi-game .shogi-tutorial__skip {
  justify-self: end;
  opacity: 0.75;
}
.shogi-game .shogi-tutorial__result {
  display: grid;
  align-content: start;
  justify-items: center;
  gap: 1rem;
}
.shogi-game .shogi-tutorial__stars {
  display: flex;
  gap: 0.4rem;
  font-size: clamp(2.5rem, 8vw, 4rem);
  color: rgba(255, 252, 244, 0.25);
  transition: opacity 300ms ease;
}
.shogi-game .shogi-tutorial__stars--hidden {
  opacity: 0;
}
.shogi-game .shogi-tutorial__star--on {
  color: #f6d365;
  text-shadow: 0 0 0.6rem rgba(246, 211, 101, 0.6);
  animation: shogi-tutorial-star-pop 450ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes shogi-tutorial-star-pop {
  0% { transform: scale(0.2) rotate(-30deg); opacity: 0; }
  70% { transform: scale(1.3) rotate(8deg); opacity: 1; }
  100% { transform: scale(1) rotate(0); }
}
@media (prefers-reduced-motion: reduce) {
  .shogi-game .shogi-tutorial__star--on { animation: none; }
}
.shogi-game .shogi-tutorial__outcome {
  margin: 0;
  font-size: clamp(1.8rem, 6vw, 2.8rem);
  font-weight: 900;
  letter-spacing: 0.1em;
}
.shogi-game .shogi-tutorial__outcome--win { color: #f6d365; }
.shogi-game .shogi-tutorial__outcome--lose { color: #93c5fd; }
.shogi-game .shogi-tutorial__outcome--draw { color: #fffcf4; }
.shogi-game .shogi-tutorial__star-note {
  max-width: 40rem;
  margin: 0;
  text-align: center;
  font-weight: 700;
}
.shogi-game .shogi-tutorial__conditions {
  display: grid;
  gap: 0.3rem;
  margin: 0;
  padding: 0.6rem 0.8rem;
  border: 1px solid rgba(241, 165, 76, 0.55);
  border-radius: 0.5rem;
  background: rgba(29, 48, 63, 0.7);
}
.shogi-game .shogi-tutorial__conditions div {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem 0.8rem;
}
.shogi-game .shogi-tutorial__conditions dt {
  min-width: 6.5em;
  color: #f1a54c;
  font-weight: 700;
}
.shogi-game .shogi-tutorial__conditions dd {
  margin: 0;
}
.shogi-game .shogi-tutorial__result-actions {
  display: grid;
  gap: 0.5rem;
  width: min(100%, 26rem);
}
/* ===== レッスン画面(2026-10 作り直し) ===== */
/*
 * 見出し: レッスン中は1行にまとめる。狭い画面では戻るボタンを矢印だけにし、題名は1行で切る。
 * スキップは見出しの右端の小さなボタンにする(押し間違えにくく、操作の邪魔をしない)。
 */
.shogi-game .shogi-tutorial .shogi-dex__header {
  flex-wrap: nowrap;
  gap: 0.6rem;
  padding: 0.4rem 0.7rem;
}
.shogi-game .shogi-tutorial .shogi-dex__header h1 {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 1.1rem;
  letter-spacing: 0.06em;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.shogi-game .shogi-tutorial .shogi-dex__back {
  min-height: 2.4rem;
  padding: 0.3rem 0.8rem;
}
.shogi-game .shogi-tutorial__header-skip {
  flex: none;
  min-height: 2.2rem;
  padding: 0.2rem 0.8rem;
  border: 1px solid rgba(255, 252, 244, 0.35);
  border-radius: 999px;
  color: rgba(255, 252, 244, 0.75);
  background: transparent;
  font: inherit;
  font-size: 0.82rem;
  cursor: pointer;
}
@media (max-width: 40rem) {
  .shogi-game .shogi-tutorial .shogi-tutorial__back-label {
    display: none;
  }
}
/* 画面のどこを押しても進む説明では、押せることを指の形で示す。 */
.shogi-game .shogi-tutorial__stage {
  cursor: default;
}
.shogi-game .shogi-tutorial--lesson .shogi-tutorial__stage:has(.shogi-tutorial__tap) {
  cursor: pointer;
}
/* やこび姫の吹き出し。立ち絵を大きくし、文字も大きく読みやすくする。 */
.shogi-game .shogi-tutorial__bubble {
  display: flex;
  align-items: flex-end;
  gap: 0.7rem;
  padding: 0.65rem 0.9rem;
  border: 2px solid rgba(255, 252, 244, 0.3);
  border-radius: 1rem;
  background: rgba(23, 38, 50, 0.92);
  transition: border-color 160ms ease, background-color 160ms ease;
}
.shogi-game .shogi-tutorial__bubble--task {
  border-color: #f1a54c;
  box-shadow: 0 0 0 3px rgba(241, 165, 76, 0.18);
}
.shogi-game .shogi-tutorial__bubble--good {
  border-color: #6ee7b7;
  background: rgba(16, 64, 52, 0.92);
}
.shogi-game .shogi-tutorial__bubble--bad {
  border-color: rgba(215, 209, 253, 0.8);
  animation: shogi-tutorial-nudge 260ms ease;
}
@keyframes shogi-tutorial-nudge {
  0%, 100% { transform: translateX(0); }
  30% { transform: translateX(-4px); }
  60% { transform: translateX(3px); }
}
.shogi-game .shogi-tutorial__chara {
  flex: none;
  height: clamp(72px, 11vh, 108px);
  width: auto;
  pointer-events: none;
  image-rendering: pixelated;
}
.shogi-game .shogi-tutorial__bubble-body {
  display: grid;
  flex: 1;
  gap: 0.3rem;
  min-width: 0;
}
.shogi-game .shogi-tutorial__task-label {
  justify-self: start;
  margin: 0;
  padding: 0.05rem 0.6rem;
  border-radius: 999px;
  color: #172632;
  background: #f1a54c;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}
.shogi-game .shogi-tutorial__speech {
  margin: 0;
  font-size: clamp(1rem, 2.4vw, 1.15rem);
  font-weight: 700;
  line-height: 1.6;
}
.shogi-game .shogi-tutorial__bubble .shogi-tutorial__feedback {
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  font-weight: 800;
}
.shogi-game .shogi-tutorial__bubble .shogi-tutorial__feedback--good { color: #6ee7b7; }
.shogi-game .shogi-tutorial__bubble .shogi-tutorial__feedback--bad { color: #d7d1fd; }
.shogi-game .shogi-tutorial__bubble .shogi-tutorial__feedback--info { color: #93c5fd; }
.shogi-game .shogi-tutorial__bubble .shogi-tutorial__feedback--good::before { content: none; }
/* 「図鑑でくわしく」と「タップで次へ」を1行に並べる。リンクは左、進め方の案内は右。 */
.shogi-game .shogi-tutorial__tap-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 0.8rem;
  align-items: center;
  justify-content: flex-end;
  justify-self: stretch;
  margin: 0;
}
.shogi-game .shogi-tutorial__dex-link {
  margin-right: auto;
  min-height: 2.2rem;
  padding: 0.2rem 0.2rem;
  border: 0;
  background: none;
  color: #93c5fd;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 0.2em;
  cursor: pointer;
}
.shogi-game .shogi-tutorial__dex-link:focus-visible {
  outline: 2px solid #93c5fd;
  outline-offset: 2px;
}
.shogi-game .shogi-tutorial__chip--dex {
  border-color: rgba(147, 197, 253, 0.6);
  color: #bfdbfe;
}
/* 駒の価値の札。駒の名前と値段を1行に並べ、せまい画面では折り返す。 */
.shogi-game .shogi-tutorial__values {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin: 0;
}
.shogi-game .shogi-tutorial__values span {
  display: inline-flex;
  gap: 0.2rem;
  align-items: baseline;
  padding: 0.15rem 0.45rem;
  border-radius: 0.4rem;
  background: #fffcf4;
  color: #2a211d;
  font-weight: 800;
}
.shogi-game .shogi-tutorial__values b {
  font-size: 1.05em;
}
.shogi-game .shogi-tutorial__values .shogi-tutorial__value--promoted {
  background: #fde2e1;
  color: #8f1d12;
}
/* 定跡の小さな盤。作戦カードと同じ部品を、名前を添えて並べる。 */
.shogi-game .shogi-tutorial__formations {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.shogi-game .shogi-tutorial__formations figure {
  display: grid;
  gap: 0.15rem;
  justify-items: center;
  width: 7.5rem;
  margin: 0;
}
.shogi-game .shogi-tutorial__formations figcaption {
  color: #fffcf4;
  font-size: 0.8rem;
  font-weight: 700;
}
.shogi-game .shogi-tutorial__tap {
  margin: 0;
  color: rgba(255, 252, 244, 0.7);
  font-size: 0.8rem;
  font-weight: 700;
}
.shogi-game .shogi-tutorial__tap span {
  display: inline-block;
  color: #f1a54c;
  animation: shogi-tutorial-tap 1s ease-in-out infinite;
}
@keyframes shogi-tutorial-tap {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(3px); }
}
.shogi-game .shogi-tutorial .shogi-tutorial__options button.shogi-tutorial__option--wrong:disabled {
  opacity: 0.4;
  text-decoration: line-through;
}
.shogi-game .shogi-tutorial__panel {
  display: grid;
  gap: 0.5rem;
}
/* 結果: できるようになったこと。 */
.shogi-game .shogi-tutorial__learned {
  display: grid;
  gap: 0.15rem;
  margin: 0;
  padding: 0.6rem 1rem;
  border: 2px solid #f1a54c;
  border-radius: 0.8rem;
  font-size: 1.1rem;
  font-weight: 800;
  text-align: center;
}
.shogi-game .shogi-tutorial__learned small {
  color: #f1a54c;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
}
@media (prefers-reduced-motion: reduce) {
  .shogi-game .shogi-tutorial__bubble--bad,
  .shogi-game .shogi-tutorial__tap span {
    animation: none;
  }
}
/* ===== 地図(すごろくの道) ===== */
.shogi-game .shogi-tutorial__map {
  scroll-behavior: smooth;
}
/* 上: やこび姫と、集めた星と、「つづきから」。 */
.shogi-game .shogi-tutorial__map-hero {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: end;
  gap: 0.4rem 0.8rem;
  width: min(100%, 36rem);
  margin: 0 auto 1rem;
}
.shogi-game .shogi-tutorial__map-hero-body {
  display: grid;
  gap: 0.25rem;
  padding: 0.6rem 0.8rem;
  border: 2px solid rgba(255, 252, 244, 0.3);
  border-radius: 1rem;
  background: rgba(23, 38, 50, 0.92);
}
.shogi-game .shogi-tutorial__map-total {
  margin: 0;
  color: #f1a54c;
  font-weight: 800;
}
.shogi-game .shogi-tutorial__map-total small {
  color: rgba(255, 252, 244, 0.7);
  font-weight: 600;
}
.shogi-game .shogi-tutorial__map-hero .shogi-tutorial__continue {
  grid-column: 1 / -1;
  display: grid;
  gap: 0.1rem;
  width: 100%;
  margin: 0;
  text-align: center;
}
.shogi-game .shogi-tutorial__map-hero .shogi-tutorial__continue::before {
  content: none;
}
.shogi-game .shogi-tutorial__map-hero .shogi-tutorial__continue small {
  font-size: 0.75em;
  letter-spacing: 0.08em;
}
/* 道。巻の看板、章の看板、レッスンのマスを縦に並べ、マスは左右にくねらせる。 */
.shogi-game .shogi-tutorial__road {
  display: grid;
  justify-items: center;
  gap: 0.35rem;
  width: min(100%, 36rem);
  margin: 0 auto;
  padding: 0 0 3rem;
  list-style: none;
}
.shogi-game .shogi-tutorial__road > li {
  display: grid;
  justify-items: center;
  width: 100%;
}
.shogi-game .shogi-tutorial__road-volume {
  margin-top: 1.4rem;
}
.shogi-game .shogi-tutorial__road-volume:first-child {
  margin-top: 0;
}
.shogi-game .shogi-tutorial__world {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.25rem 0.7rem;
  width: 100%;
  box-sizing: border-box;
  padding: 0.75rem 1rem;
  border-radius: 1rem;
  color: #172632;
  background: linear-gradient(135deg, #f6bd70, #f1a54c);
  box-shadow: 0 4px 0 #b57c39;
}
.shogi-game .shogi-tutorial__world-number {
  padding: 0.1rem 0.55rem;
  border-radius: 999px;
  color: #fffcf4;
  background: #172632;
  font-size: 0.78rem;
  font-weight: 800;
}
.shogi-game .shogi-tutorial__world strong {
  font-size: 1.1rem;
}
.shogi-game .shogi-tutorial__world small {
  font-weight: 800;
}
.shogi-game .shogi-tutorial__world .shogi-tutorial__meter {
  grid-column: 1 / -1;
  height: 0.45rem;
  margin: 0;
  background: rgba(23, 38, 50, 0.25);
}
.shogi-game .shogi-tutorial__world .shogi-tutorial__meter > span {
  background: #172632;
}
.shogi-game .shogi-tutorial__road-chapter {
  margin: 0.9rem 0 0.2rem;
}
.shogi-game .shogi-tutorial__signpost {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.4rem 0.7rem;
  padding: 0.3rem 0.9rem;
  border: 2px solid rgba(241, 165, 76, 0.55);
  border-radius: 999px;
  color: #f1a54c;
  background: rgba(23, 38, 50, 0.85);
  font-size: 0.9rem;
  font-weight: 800;
}
.shogi-game .shogi-tutorial__signpost .shogi-tutorial__skip-chapter {
  min-height: 1.8rem;
  padding: 0 0.6rem;
  font-size: 0.75rem;
}
/* レッスンのマス。--laneで左右にずらし、道をくねらせる。 */
.shogi-game .shogi-tutorial__stop {
  display: grid;
  justify-items: center;
  gap: 0.5rem;
  width: 7rem;
  padding: 0.35rem 0;
  transform: translateX(calc((var(--lane, 2) - 2) * min(11vw, 4.2rem)));
}
.shogi-game .shogi-tutorial__node {
  position: relative;
  display: grid;
  place-items: center;
  width: 3.9rem;
  height: 3.6rem;
  padding: 0;
  border: 0;
  border-radius: 50%;
  color: #fffcf4;
  background: #2b465b;
  box-shadow: 0 5px 0 #172632;
  font: inherit;
  cursor: pointer;
  transition: transform 120ms ease;
}
.shogi-game .shogi-tutorial__node:active:not(:disabled) {
  box-shadow: 0 1px 0 #172632;
  transform: translateY(4px);
}
.shogi-game .shogi-tutorial__node-icon {
  font-size: 1.45rem;
  font-weight: 900;
  line-height: 1;
}
.shogi-game .shogi-tutorial__node--cleared {
  color: #172632;
  background: #f1a54c;
  box-shadow: 0 5px 0 #b57c39;
}
.shogi-game .shogi-tutorial__node--next {
  width: 4.6rem;
  height: 4.3rem;
  color: #172632;
  background: #fffcf4;
  box-shadow: 0 5px 0 #b57c39, 0 0 0 6px rgba(241, 165, 76, 0.35);
  animation: shogi-tutorial-node-pulse 1.6s ease-in-out infinite;
}
.shogi-game .shogi-tutorial__node--open {
  border: 3px solid #f1a54c;
}
.shogi-game .shogi-tutorial__node--skipped {
  border: 2px dashed rgba(255, 252, 244, 0.45);
  color: rgba(255, 252, 244, 0.75);
}
.shogi-game .shogi-tutorial__node--locked {
  color: rgba(255, 252, 244, 0.6);
  background: #1f3343;
  box-shadow: 0 5px 0 #121e29;
}
.shogi-game .shogi-tutorial__node--locked .shogi-tutorial__node-icon {
  font-size: 1.05rem;
  filter: grayscale(1);
  opacity: 0.7;
}
.shogi-game .shogi-tutorial__node--soon {
  opacity: 0.45;
  cursor: default;
}
@keyframes shogi-tutorial-node-pulse {
  0%, 100% { box-shadow: 0 5px 0 #b57c39, 0 0 0 4px rgba(241, 165, 76, 0.35); }
  50% { box-shadow: 0 5px 0 #b57c39, 0 0 0 10px rgba(241, 165, 76, 0.15); }
}
/* 「ここから！」の吹き出し。 */
.shogi-game .shogi-tutorial__node-start {
  position: absolute;
  bottom: calc(100% + 0.45rem);
  left: 50%;
  padding: 0.15rem 0.6rem;
  border-radius: 0.5rem;
  color: #172632;
  background: #f1a54c;
  font-size: 0.78rem;
  font-weight: 900;
  white-space: nowrap;
  transform: translateX(-50%);
  animation: shogi-tutorial-tap 1s ease-in-out infinite;
}
.shogi-game .shogi-tutorial__node-start::after {
  content: "";
  position: absolute;
  top: 100%;
  left: 50%;
  border: 0.35rem solid transparent;
  border-top-color: #f1a54c;
  transform: translateX(-50%);
}
.shogi-game .shogi-tutorial__road-lesson:has(.shogi-tutorial__node--next) {
  margin-top: 1.6rem;
}
.shogi-game .shogi-tutorial__node-title {
  max-width: 7rem;
  color: rgba(255, 252, 244, 0.9);
  font-size: 0.8rem;
  font-weight: 700;
  line-height: 1.3;
  text-align: center;
}
.shogi-game .shogi-tutorial__node--locked + .shogi-tutorial__node-title {
  color: rgba(255, 252, 244, 0.45);
}
.shogi-game .shogi-tutorial__node-stars,
.shogi-game .shogi-tutorial__clear-stars,
.shogi-game .shogi-tutorial__learned-stars {
  display: flex;
  gap: 0.05rem;
  margin: 0;
  font-style: normal;
}
.shogi-game .shogi-tutorial__node-stars i,
.shogi-game .shogi-tutorial__clear-stars i,
.shogi-game .shogi-tutorial__learned-stars i {
  color: rgba(255, 252, 244, 0.2);
  font-style: normal;
}
.shogi-game .shogi-tutorial__node-stars i.on,
.shogi-game .shogi-tutorial__clear-stars i.on,
.shogi-game .shogi-tutorial__learned-stars i.on {
  color: #f6d365;
}
.shogi-game .shogi-tutorial__node-stars {
  font-size: 0.75rem;
}

/* ===== レッスンの見出しの進み具合(章の帯) ===== */
.shogi-game .shogi-tutorial__track {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: min(100% - 1.4rem, 44rem);
  margin: 0.4rem auto 0.1rem;
}
.shogi-game .shogi-tutorial__track-label {
  flex: none;
  max-width: 45%;
  overflow: hidden;
  color: rgba(255, 252, 244, 0.75);
  font-size: 0.78rem;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.shogi-game .shogi-tutorial__track ol {
  display: flex;
  flex: 1;
  gap: 0.25rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.shogi-game .shogi-tutorial__track li {
  flex: 1;
  height: 0.5rem;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255, 252, 244, 0.18);
}
.shogi-game .shogi-tutorial__track li span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #f1a54c;
  transition: width 240ms ease;
}

/* ===== レッスンクリアの知らせ ===== */
.shogi-game .shogi-tutorial__lesson-view {
  position: relative;
}
.shogi-game .shogi-tutorial__clear {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 0.4rem;
  background: rgba(10, 20, 28, 0.62);
  cursor: pointer;
}
.shogi-game .shogi-tutorial__clear-title {
  margin: 0;
  color: #f1a54c;
  font-size: clamp(2.4rem, 9vw, 3.6rem);
  font-weight: 900;
  letter-spacing: 0.12em;
  text-shadow: 0 4px 0 #172632;
  animation: shogi-tutorial-clear-pop 360ms cubic-bezier(0.3, 1.5, 0.5, 1) both;
}
.shogi-game .shogi-tutorial__clear-stars {
  font-size: 2rem;
}
.shogi-game .shogi-tutorial__clear-stars i.on {
  animation: shogi-tutorial-clear-pop 320ms cubic-bezier(0.3, 1.6, 0.5, 1) both;
}
.shogi-game .shogi-tutorial__clear-stars i.on:nth-child(2) { animation-delay: 120ms; }
.shogi-game .shogi-tutorial__clear-stars i.on:nth-child(3) { animation-delay: 240ms; }
.shogi-game .shogi-tutorial__clear-next {
  margin: 0.3rem 0 0;
  padding: 0.45rem 1rem;
  border-radius: 999px;
  color: #172632;
  background: #fffcf4;
  font-weight: 800;
}
.shogi-game .shogi-tutorial__clear-map {
  min-height: 2.2rem;
  margin-top: 0.4rem;
  padding: 0.2rem 0.9rem;
  border: 1px solid rgba(255, 252, 244, 0.5);
  border-radius: 999px;
  color: #fffcf4;
  background: transparent;
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
}
@keyframes shogi-tutorial-clear-pop {
  0% { opacity: 0; transform: scale(0.5); }
  100% { opacity: 1; transform: scale(1); }
}
.shogi-game .shogi-tutorial__clear-enter-active { transition: opacity 160ms ease; }
.shogi-game .shogi-tutorial__clear-leave-active { transition: opacity 120ms ease; }
.shogi-game .shogi-tutorial__clear-enter-from,
.shogi-game .shogi-tutorial__clear-leave-to { opacity: 0; }

/* ===== 章クリア ===== */
.shogi-game .shogi-tutorial__chapter-clear {
  display: grid;
  align-content: start;
  justify-items: center;
  gap: 0.7rem;
}
.shogi-game .shogi-tutorial__chapter-clear > * {
  width: min(100%, 36rem);
}
.shogi-game .shogi-tutorial__chapter-clear-eyebrow {
  margin: 0.6rem 0 0;
  color: rgba(255, 252, 244, 0.7);
  font-weight: 700;
  text-align: center;
}
.shogi-game .shogi-tutorial__chapter-clear h2 {
  margin: 0;
  color: #f1a54c;
  font-size: clamp(1.4rem, 5vw, 2rem);
  text-align: center;
  animation: shogi-tutorial-clear-pop 360ms cubic-bezier(0.3, 1.5, 0.5, 1) both;
}
.shogi-game .shogi-tutorial__chapter-clear-stars {
  margin: 0;
  color: #f6d365;
  font-size: 1.4rem;
  font-weight: 900;
  text-align: center;
}
.shogi-game .shogi-tutorial__learned-list {
  display: grid;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.shogi-game .shogi-tutorial__learned-tile {
  display: grid;
  align-content: start;
  gap: 0.15rem;
  width: 100%;
  height: 100%;
  padding: 0.45rem 0.65rem 0.5rem;
  border: 1px solid rgba(255, 252, 244, 0.18);
  border-radius: 0.7rem;
  color: #fffcf4;
  background: rgba(43, 70, 91, 0.6);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.shogi-game .shogi-tutorial__learned-tile:hover,
.shogi-game .shogi-tutorial__learned-tile:focus-visible {
  border-color: rgba(241, 165, 76, 0.8);
  background: rgba(55, 88, 113, 0.75);
}
.shogi-game .shogi-tutorial__learned-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.3rem;
}
.shogi-game .shogi-tutorial__learned-again {
  color: rgba(255, 252, 244, 0.6);
  font-size: 0.7rem;
  white-space: nowrap;
}
.shogi-game .shogi-tutorial__learned-tile b {
  display: -webkit-box;
  overflow: hidden;
  font-size: 0.95rem;
  line-height: 1.3;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.shogi-game .shogi-tutorial__learned-tile small {
  display: block;
  color: rgba(255, 252, 244, 0.75);
  font-size: 0.8rem;
}
@media (prefers-reduced-motion: reduce) {
  .shogi-game .shogi-tutorial__node--next,
  .shogi-game .shogi-tutorial__node-start,
  .shogi-game .shogi-tutorial__clear-title,
  .shogi-game .shogi-tutorial__clear-stars i.on,
  .shogi-game .shogi-tutorial__chapter-clear h2 {
    animation: none;
  }
}
/*
 * 背の低い横長の画面(スマホの横向き)。盤の下に台詞を置くと盤が小さくなりすぎるので、
 * 横長の盤を左に、台詞と操作を右に並べる(将棋教室と問題集で共通)。
 */
@media (orientation: landscape) and (max-height: 560px) {
  .shogi-game .shogi-tutorial .shogi-tutorial__stage {
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 0.8rem;
    overflow: hidden;
    padding-block: 0.3rem;
  }
  .shogi-game .shogi-tutorial .shogi-tutorial__panel {
    width: min(44%, 26rem);
    max-height: 100%;
    align-self: center;
    overflow-y: auto;
  }
  .shogi-game .shogi-tutorial__chara { height: clamp(56px, 18vh, 80px); }
  .shogi-game .shogi-tutorial__speech { font-size: 0.98rem; }
  .shogi-game .shogi-tutorial__track { margin-top: 0.25rem; }
}
/*
 * 章クリアのレッスンの一覧。11レッスンある章でもスクロールせずに見られるよう、
 * レッスンが5つ以上の章は解説を省いた小さな札にして、列を増やす。
 */
.shogi-game .shogi-tutorial__learned-list {
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr));
}
.shogi-game .shogi-tutorial__chapter-clear:has(.shogi-tutorial__learned-list li:nth-child(5)) > * {
  width: min(100%, 52rem);
}
.shogi-game .shogi-tutorial__learned-list:has(li:nth-child(5)) {
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 9.5rem), 1fr));
}
.shogi-game .shogi-tutorial__learned-list:has(li:nth-child(5)) small { display: none; }
@media (max-width: 600px), (max-height: 600px) {
  .shogi-game .shogi-tutorial__learned-list,
  .shogi-game .shogi-tutorial__learned-list:has(li:nth-child(5)) {
    grid-template-columns: repeat(auto-fill, minmax(6.4rem, 1fr));
    gap: 0.3rem;
  }
  .shogi-game .shogi-tutorial__learned-list small { display: none; }
  .shogi-game .shogi-tutorial__learned-tile { padding: 0.3rem 0.45rem 0.35rem; gap: 0.05rem; }
  .shogi-game .shogi-tutorial__learned-tile b { font-size: 0.82rem; }
  .shogi-game .shogi-tutorial__learned-stars { font-size: 0.8rem; }
  .shogi-game .shogi-tutorial__learned-again { font-size: 0.62rem; }
  .shogi-game .shogi-tutorial__chapter-clear { gap: 0.45rem; padding-top: 0.5rem; padding-bottom: 0.6rem; }
  .shogi-game .shogi-tutorial__chapter-clear-eyebrow { margin-top: 0; font-size: 0.8rem; }
  .shogi-game .shogi-tutorial__chapter-clear-stars { font-size: 1.15rem; }
  .shogi-game .shogi-tutorial__chapter-clear .shogi-tutorial__bubble { padding: 0.45rem 0.7rem; }
  .shogi-game .shogi-tutorial__chapter-clear .shogi-tutorial__chara { height: 3.6rem; }
  .shogi-game .shogi-tutorial__chapter-clear .shogi-tutorial__speech { font-size: 0.9rem; }
  .shogi-game .shogi-tutorial__chapter-clear .shogi-tutorial__result-actions { gap: 0.35rem; }
}
/*
 * 背の低い横長の画面(スマホの横向き)では、見出し・やこび姫・次へのボタンを左に、
 * レッスンの札を右に並べる。
 */
@media (orientation: landscape) and (max-height: 500px) {
  .shogi-game .shogi-tutorial__chapter-clear {
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
    grid-auto-flow: row dense;
    align-content: center;
    column-gap: 1rem;
    row-gap: 0.35rem;
  }
  .shogi-game .shogi-tutorial__chapter-clear > *,
  .shogi-game .shogi-tutorial__chapter-clear:has(.shogi-tutorial__learned-list li:nth-child(5)) > * {
    grid-column: 1;
    width: 100%;
  }
  .shogi-game .shogi-tutorial__chapter-clear h2 { font-size: 1.35rem; }
  .shogi-game .shogi-tutorial__chapter-clear:has(.shogi-tutorial__learned-list li:nth-child(1)) > .shogi-tutorial__learned-list {
    grid-column: 2;
    grid-row: 1 / span 6;
    align-self: center;
  }
  .shogi-game .shogi-tutorial__chapter-clear .shogi-tutorial__speech { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 3; }
  .shogi-game .shogi-tutorial__chapter-clear .shogi-tutorial__result-actions button { min-height: 2.4rem; padding-block: 0.3rem; }
}

/* ===== 2026-10-18 教室の大改良 ===== */
.shogi-game .shogi-tutorial {
  /* 巻ごとの色(地図の看板)。第1巻から順に、琥珀・緑・朱・青・桃。 */
  --volume-1: #f1a54c;
  --volume-2: #86d4a9;
  --volume-3: #f08a6c;
  --volume-4: #8fb5f7;
  --volume-5: #f3a3c8;
  --medal-gold: #f6d365;
  --medal-silver: #d5dde6;
  --medal-bronze: #d9925f;
  /* はなまる。先生の赤ペンのような朱色。盤の升の強調ではないので、升の色の決まりとは別。 */
  --stamp-ink: #e2553b;
  --boss: #b8433f;
  /* 駒得の札。盤に浮かべる数字(BoardView.vueのfloat-label)と同じ色にする。 */
  --material-good: #1f8a4c;
  --material-bad: #c0392b;
}
/* めあて。見出しの帯の左に、いつも1行で出す。 */
.shogi-game .shogi-tutorial__track-label b {
  margin-right: 0.4em;
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
  color: #172632;
  background: #f1a54c;
  font-size: 0.72rem;
}
.shogi-game .shogi-tutorial__track-label {
  max-width: 62%;
  color: rgba(255, 252, 244, 0.92);
}
.shogi-game .shogi-tutorial__track-label b.shogi-tutorial__goal--boss {
  color: #fffcf4;
  background: var(--boss);
}
/* 正解のはなまる。盤の上のまん中に、ぽんと押して、すぐ消える。操作は止めない。 */
.shogi-game .shogi-tutorial__board {
  position: relative;
}
/*
 * 格言札。盤の上に、いま指した駒を隠さない側(上か下)へ出す。名前を大きく、図鑑の一言を添える。
 * はなまる(z-index 40)より下、盤の部品より上。
 */
.shogi-game .shogi-tutorial__proverb {
  position: absolute;
  left: 50%;
  z-index: 38;
  display: grid;
  gap: 0.25rem;
  width: min(92%, 24rem);
  box-sizing: border-box;
  padding: 0.7rem 0.9rem 0.5rem;
  border: 3px solid #7c2d12;
  border-radius: 0.8rem;
  background: #fffaf0;
  color: #2a211d;
  box-shadow: 0 0.4rem 1.2rem rgba(0, 0, 0, 0.35);
  transform: translateX(-50%);
  animation: shogi-tutorial-proverb-in 240ms cubic-bezier(0.3, 1.4, 0.5, 1) both;
}
.shogi-game .shogi-tutorial__proverb--top { top: 4%; }
.shogi-game .shogi-tutorial__proverb--bottom { bottom: 4%; }
.shogi-game .shogi-tutorial__proverb p {
  margin: 0;
}
.shogi-game .shogi-tutorial__proverb-line {
  color: #9a3412;
  font-size: 0.85rem;
  font-weight: 800;
}
.shogi-game .shogi-tutorial__proverb-name {
  font-size: 1.45rem;
  font-weight: 900;
  line-height: 1.25;
  letter-spacing: 0.04em;
}
.shogi-game .shogi-tutorial__proverb-overview {
  font-size: 0.92rem;
  line-height: 1.5;
}
.shogi-game .shogi-tutorial__proverb-foot {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem 0.8rem;
  align-items: center;
  justify-content: space-between;
  font-size: 0.85rem;
  font-weight: 800;
  color: #166534;
}
/* 手筋図鑑の一覧に付く「札」の印と同じ形。 */
.shogi-game .shogi-tutorial__proverb-badge {
  margin-right: 0.3em;
  padding: 0 0.25em;
  border: 1px solid #d97706;
  border-radius: 0.2em;
  color: #b45309;
  font-size: 0.85em;
}
.shogi-game .shogi-tutorial__proverb .shogi-tutorial__dex-link {
  margin-left: auto;
  color: #1d4ed8;
}
@keyframes shogi-tutorial-proverb-in {
  from { opacity: 0; transform: translateX(-50%) rotate(-3deg) scale(0.8); }
  to { opacity: 1; transform: translateX(-50%) rotate(0) scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .shogi-game .shogi-tutorial__proverb { animation: none; }
}
.shogi-game .shogi-tutorial__stamp {
  position: absolute;
  inset: 0;
  /* 盤の中の部品(駒・矢印・成る選択は最大30)より上に出す。 */
  z-index: 40;
  display: grid;
  place-items: center;
  pointer-events: none;
}
.shogi-game .shogi-tutorial__stamp span {
  display: grid;
  place-items: center;
  min-width: 5.5rem;
  height: 5.5rem;
  padding: 0 0.8rem;
  border: 0.32rem solid var(--stamp-ink);
  border-radius: 999px;
  color: var(--stamp-ink);
  background: rgba(255, 252, 244, 0.88);
  box-shadow: 0 0.3rem 0 rgba(23, 38, 50, 0.35);
  font-size: 1.7rem;
  font-weight: 900;
  letter-spacing: 0.04em;
  line-height: 1;
  white-space: nowrap;
  transform: rotate(-8deg);
  animation: shogi-tutorial-stamp 420ms cubic-bezier(0.3, 1.6, 0.5, 1) both;
}
.shogi-game .shogi-tutorial__stamp--big span {
  min-width: 7rem;
  height: 7rem;
  font-size: 2.1rem;
}
@keyframes shogi-tutorial-stamp {
  0% { opacity: 0; transform: rotate(-8deg) scale(1.8); }
  60% { opacity: 1; transform: rotate(-8deg) scale(0.92); }
  100% { opacity: 1; transform: rotate(-8deg) scale(1); }
}
.shogi-game .shogi-tutorial__stamp-leave-active { transition: opacity 180ms ease; }
.shogi-game .shogi-tutorial__stamp-leave-to { opacity: 0; }
/* 課題の札。課題の種類・腕だめしの何問目か・駒取りの手数・れんぞくを1行に並べる。 */
.shogi-game .shogi-tutorial__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin: 0;
}
.shogi-game .shogi-tutorial__chips .shogi-tutorial__task-label {
  justify-self: auto;
}
.shogi-game .shogi-tutorial__chip {
  padding: 0.05rem 0.55rem;
  border: 1px solid rgba(255, 252, 244, 0.4);
  border-radius: 999px;
  color: #fffcf4;
  font-size: 0.78rem;
  font-weight: 800;
  white-space: nowrap;
}
.shogi-game .shogi-tutorial__chip--boss {
  border-color: var(--boss);
  background: var(--boss);
}
.shogi-game .shogi-tutorial__chip--streak {
  border-color: #6ee7b7;
  color: #10281b;
  background: #8fdcaa;
  animation: shogi-tutorial-feedback-pop 260ms cubic-bezier(0.3, 1.5, 0.5, 1) both;
}
/* 章クリアのメダル。 */
.shogi-game .shogi-tutorial__medal {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  margin: 0;
  color: var(--medal-color);
  font-size: 1.2rem;
  font-weight: 900;
  animation: shogi-tutorial-clear-pop 420ms 200ms cubic-bezier(0.3, 1.6, 0.5, 1) both;
}
.shogi-game .shogi-tutorial__medal--gold { --medal-color: var(--medal-gold); }
.shogi-game .shogi-tutorial__medal--silver { --medal-color: var(--medal-silver); }
.shogi-game .shogi-tutorial__medal--bronze { --medal-color: var(--medal-bronze); }
.shogi-game .shogi-tutorial__medal-disc {
  display: grid;
  place-items: center;
  width: 3.2rem;
  height: 3.2rem;
  border: 0.25rem solid rgba(23, 38, 50, 0.35);
  border-radius: 50%;
  color: #172632;
  background: radial-gradient(circle at 35% 30%, #fffcf4 0 12%, var(--medal-color) 13%);
  box-shadow: 0 0.25rem 0 rgba(10, 20, 28, 0.6);
  font-size: 1.3rem;
}
.shogi-game .shogi-tutorial__new-title {
  display: grid;
  gap: 0.1rem;
  margin: 0;
  padding: 0.55rem 1rem;
  border: 2px solid var(--medal-gold);
  border-radius: 0.8rem;
  background: rgba(246, 211, 101, 0.12);
  color: var(--medal-gold);
  font-size: 1.15rem;
  font-weight: 900;
  text-align: center;
  animation: shogi-tutorial-clear-pop 420ms 420ms cubic-bezier(0.3, 1.6, 0.5, 1) both;
}
.shogi-game .shogi-tutorial__new-title small {
  color: rgba(255, 252, 244, 0.8);
  font-size: 0.75rem;
  font-weight: 700;
}
/* 地図: 巻の色。 */
.shogi-game .shogi-tutorial__road > li[data-volume="1"] { --volume: var(--volume-1); }
.shogi-game .shogi-tutorial__road > li[data-volume="2"] { --volume: var(--volume-2); }
.shogi-game .shogi-tutorial__road > li[data-volume="3"] { --volume: var(--volume-3); }
.shogi-game .shogi-tutorial__road > li[data-volume="4"] { --volume: var(--volume-4); }
.shogi-game .shogi-tutorial__road > li[data-volume="5"] { --volume: var(--volume-5); }
.shogi-game .shogi-tutorial__road .shogi-tutorial__world {
  background: var(--volume);
  box-shadow: 0 4px 0 rgba(10, 20, 28, 0.55);
}
.shogi-game .shogi-tutorial__road .shogi-tutorial__signpost {
  border-color: color-mix(in srgb, var(--volume) 70%, transparent);
  color: var(--volume);
}
.shogi-game .shogi-tutorial__signpost-medal {
  font-size: 1.1rem;
  line-height: 1;
  text-shadow: 0 1px 0 rgba(10, 20, 28, 0.8);
}
.shogi-game .shogi-tutorial__signpost-medal--gold { color: var(--medal-gold); }
.shogi-game .shogi-tutorial__signpost-medal--silver { color: var(--medal-silver); }
.shogi-game .shogi-tutorial__signpost-medal--bronze { color: var(--medal-bronze); }
/* 地図: 腕だめしのマス。道のまん中に、大きな角の丸い札で置く(山場)。 */
.shogi-game .shogi-tutorial__node--boss {
  width: 5rem;
  height: 4.4rem;
  border-radius: 1.1rem;
}
.shogi-game .shogi-tutorial__node--boss.shogi-tutorial__node--locked,
.shogi-game .shogi-tutorial__node--boss.shogi-tutorial__node--open {
  background: #4a2a33;
  box-shadow: 0 5px 0 #24141a;
}
.shogi-game .shogi-tutorial__node--boss.shogi-tutorial__node--next {
  color: #fffcf4;
  background: var(--boss);
  box-shadow: 0 5px 0 #6e2522, 0 0 0 6px rgba(184, 67, 63, 0.35);
}
.shogi-game .shogi-tutorial__node--boss.shogi-tutorial__node--cleared {
  background: var(--medal-gold);
}
.shogi-game .shogi-tutorial__road-lesson:has(.shogi-tutorial__node--boss) .shogi-tutorial__node-title {
  color: #f6a39f;
  font-weight: 900;
}
.shogi-game .shogi-tutorial__continue-goal {
  font-weight: 700;
  opacity: 0.85;
}
@media (prefers-reduced-motion: reduce) {
  .shogi-game .shogi-tutorial__stamp span,
  .shogi-game .shogi-tutorial__chip--streak,
  .shogi-game .shogi-tutorial__medal,
  .shogi-game .shogi-tutorial__new-title {
    animation: none;
  }
}
/* ===== 2026-10-18 見える化（利きメガネ・駒得の数字・攻めくらべ） ===== */
/* 利きメガネ。スキップの左に置く。かけているときは青く塗る(先手の利きの色)。 */
.shogi-game .shogi-tutorial__glasses {
  display: inline-flex;
  flex: none;
  gap: 0.3rem;
  align-items: center;
  min-height: 2.2rem;
  margin-left: auto;
  padding: 0.2rem 0.75rem;
  border: 1px solid rgba(255, 252, 244, 0.45);
  border-radius: 999px;
  color: #fffcf4;
  background: transparent;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 800;
  cursor: pointer;
}
.shogi-game .shogi-tutorial__glasses + .shogi-tutorial__header-skip {
  margin-left: 0.4rem;
}
.shogi-game .shogi-tutorial__glasses svg {
  width: 1.5rem;
  height: 0.8rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
}
.shogi-game .shogi-tutorial__glasses--on {
  border-color: #1d4ed8;
  background: #1d4ed8;
}
/* 読み上げのボタン。メガネと同じ形にし、並んだときは間を詰める。せまい画面では印だけにして、見出しの文字を残す。 */
@media (max-width: 480px) {
  .shogi-game .shogi-tutorial__voice span {
    display: none;
  }
}
.shogi-game .shogi-tutorial__glasses + .shogi-tutorial__voice {
  margin-left: 0.4rem;
}
.shogi-game .shogi-tutorial__voice svg {
  width: 1.15rem;
  height: 1.15rem;
}
/*
 * 吹き出しの色の札。「緑のマス」などの言葉の前に、盤の印と同じ色相の小さな札を付ける
 * (AGENTS.mdの盤面の色の表。図鑑の凡例と同じ色)。
 */
.shogi-game .shogi-tutorial__swatch {
  display: inline-block;
  width: 0.85em;
  height: 0.85em;
  margin: 0 0.15em 0 0.1em;
  border-radius: 0.18em;
  vertical-align: -0.08em;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.25);
}
.shogi-game .shogi-tutorial__swatch--key {
  background: rgba(68, 204, 68, 0.75);
  box-shadow: inset 0 0 0 2px rgba(34, 153, 34, 0.95);
}
.shogi-game .shogi-tutorial__swatch--reach {
  background: radial-gradient(circle, rgba(29, 78, 216, 0.95) 0 30%, transparent 34%), rgba(96, 165, 250, 0.45);
}
.shogi-game .shogi-tutorial__swatch--target { background: rgba(220, 38, 38, 0.7); }
.shogi-game .shogi-tutorial__swatch--black { background: rgba(37, 99, 235, 0.75); }
.shogi-game .shogi-tutorial__swatch--white { background: rgba(220, 38, 38, 0.75); }
.shogi-game .shogi-tutorial__swatch--risk {
  border-radius: 50%;
  background: transparent;
  box-shadow: inset 0 0 0 2.5px rgba(220, 38, 38, 0.95);
}
.shogi-game .shogi-tutorial__swatch--danger,
.shogi-game .shogi-tutorial__swatch--covered {
  background:
    linear-gradient(45deg, transparent 40%, currentColor 41% 59%, transparent 60%),
    linear-gradient(-45deg, transparent 40%, currentColor 41% 59%, transparent 60%);
}
.shogi-game .shogi-tutorial__swatch--danger { color: rgba(220, 38, 38, 0.95); }
.shogi-game .shogi-tutorial__swatch--covered { color: rgba(37, 99, 235, 0.95); }
/* 手に入れたばかりのメガネは、押すまでそっと光らせる。 */
.shogi-game .shogi-tutorial__glasses--new {
  animation: shogi-tutorial-glasses-glow 1.6s ease-in-out infinite;
}
@keyframes shogi-tutorial-glasses-glow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(96, 165, 250, 0); }
  50% { box-shadow: 0 0 0 5px rgba(96, 165, 250, 0.55); }
}
/* 駒得の札。符号と言葉を必ず添え、色だけに頼らない。 */
.shogi-game .shogi-tutorial__chip--material {
  animation: shogi-tutorial-feedback-pop 260ms cubic-bezier(0.3, 1.5, 0.5, 1) both;
}
.shogi-game .shogi-tutorial__chip--good {
  border-color: var(--material-good);
  background: var(--material-good);
}
.shogi-game .shogi-tutorial__chip--bad {
  border-color: var(--material-bad);
  background: var(--material-bad);
}
.shogi-game .shogi-tutorial__chip--even {
  border-color: rgba(255, 252, 244, 0.4);
  background: rgba(255, 252, 244, 0.16);
}
/* 攻めくらべの結果。くらべる相手の結果と並べて、この局面の結果を強く出す。 */
.shogi-game .shogi-tutorial__chip--result {
  border-color: #fffcf4;
  color: #172632;
  background: #fffcf4;
}
@media (prefers-reduced-motion: reduce) {
  .shogi-game .shogi-tutorial__glasses--new,
  .shogi-game .shogi-tutorial__chip--material {
    animation: none;
  }
}
/* にがてをもう1回。章クリアの画面では次の章のボタンの前に、地図では章の看板の中に小さく出す。 */
.shogi-game .shogi-tutorial__weak {
  min-height: 2.6rem;
  padding: 0.35rem 1rem;
  border: 2px solid #f3a3c8;
  border-radius: 999px;
  color: #172632;
  background: #f3a3c8;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}
.shogi-game .shogi-tutorial__weak--small {
  min-height: 1.8rem;
  padding: 0.1rem 0.6rem;
  font-size: 0.78em;
}
</style>
