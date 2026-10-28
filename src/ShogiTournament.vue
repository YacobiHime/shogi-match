<template>
  <div :class="screen === 'select' ? 'shogi-home shogi-home--title shogi-tournament-home' : 'shogi-dex shogi-tournament'" role="dialog" aria-modal="true" aria-labelledby="shogi-tournament-title">
    <!--
      大会の選択。竜王戦と名人戦を同格のタイトル戦として、同じ枠・同じ大きさのタイルに並べる。
      記録と、準備中の「プロへの道」は別のグループに置く。
    -->
    <template v-if="screen === 'select'">
      <span v-for="star in HOME_STARS" :key="star.id" class="shogi-home__star" :style="star.style" aria-hidden="true"></span>
      <span class="shogi-home__moon" aria-hidden="true"></span>
      <button type="button" class="shogi-dex__back shogi-tournament__home-back" @click="emit('close')">
        <span aria-hidden="true">←</span> {{ backLabel }}
      </button>
      <div class="shogi-title__hero" data-screen="select">
        <h1 id="shogi-tournament-title" class="shogi-title__logo">大会</h1>
        <p class="shogi-title__bubble" aria-hidden="true">どの大会に参加する？</p>
        <img class="shogi-title__chara" :src="charaUrl" alt="" aria-hidden="true">
      </div>
      <nav class="shogi-title__menu" aria-label="大会">
        <div class="shogi-title__groups">
          <section class="shogi-title__group" aria-labelledby="shogi-tournament-titles">
            <h2 id="shogi-tournament-titles" class="shogi-title__group-title">タイトル戦</h2>
            <!-- 名人戦(順位戦から名人へ。docs/meijin-design.md)。順位戦と名人戦は1つの大会にまとめた。 -->
            <div class="shogi-title__tiles shogi-tournament__title-tiles" data-title-tournaments>
              <button type="button" class="shogi-title__tile" data-tournament="ryuo" @click="chooseRyuo">
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
                <span class="shogi-title__label">竜王戦</span>
                <small class="shogi-title__desc">{{ ryuoCardNote }}</small>
              </button>
              <button type="button" class="shogi-title__tile" data-tournament="meijin" @click="chooseMeijin">
                <svg class="shogi-title__icon" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
                  <g fill="#f1a54c">
                    <rect x="7" y="1" width="2" height="2" />
                    <rect x="4" y="3" width="8" height="1" />
                    <rect x="6" y="4" width="4" height="2" />
                    <rect x="3" y="6" width="10" height="1" />
                    <rect x="5" y="7" width="6" height="2" />
                    <rect x="2" y="9" width="12" height="1" />
                    <rect x="4" y="10" width="8" height="3" />
                    <rect x="1" y="13" width="14" height="1" />
                  </g>
                </svg>
                <span class="shogi-title__label">名人戦</span>
                <small class="shogi-title__desc">{{ meijinCardNote }}</small>
              </button>
            </div>
          </section>
          <section class="shogi-title__group" aria-labelledby="shogi-tournament-record">
            <h2 id="shogi-tournament-record" class="shogi-title__group-title">記録</h2>
            <div class="shogi-title__tiles shogi-tournament__soon-tiles">
              <button type="button" class="shogi-title__tile" data-award-book @click="bookOpen = true">
                <svg class="shogi-title__icon" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
                  <g fill="#f1a54c">
                    <rect x="2" y="3" width="12" height="10" />
                  </g>
                  <g fill="#172632">
                    <rect x="9" y="5" width="1" height="6" />
                    <rect x="6" y="5" width="1" height="4" />
                  </g>
                  <rect x="4" y="9" width="2" height="2" fill="#c4604c" />
                </svg>
                <span class="shogi-title__label">賞状帳</span>
                <small class="shogi-title__desc">{{ awards.length ? `${awards.length}枚` : "期を終えるともらえる" }}</small>
              </button>
            </div>
          </section>
          <section class="shogi-title__group" aria-labelledby="shogi-tournament-road">
            <h2 id="shogi-tournament-road" class="shogi-title__group-title">プロへの道</h2>
            <div class="shogi-title__tiles shogi-tournament__soon-tiles">
              <!-- 研修会(docs/kenshukai-design.md)と奨励会(docs/shoreikai-design.md)。研修会でA2に上がると、奨励会6級に編入できる。 -->
              <button
                v-for="item in ROAD"
                :key="item.id"
                type="button"
                class="shogi-title__tile"
                :data-tournament="item.id"
                @click="item.id === 'shoreikai' ? chooseShoreikai() : chooseKenshukai()"
              >
                <svg class="shogi-title__icon" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
                  <g fill="#f1a54c">
                    <rect x="2" y="11" width="4" height="3" />
                    <rect x="6" y="8" width="4" height="6" />
                    <rect x="10" y="4" width="4" height="10" />
                  </g>
                </svg>
                <span class="shogi-title__label">{{ item.label }}</span>
                <small class="shogi-title__desc">{{ item.id === "shoreikai" ? shoreikaiCardNote : kenshukaiCardNote }}</small>
              </button>
            </div>
          </section>
        </div>
      </nav>
    </template>

    <template v-else>
      <!-- 期の画面は、上の帯を1本にする(戻るボタンは期の画面の帯に置く。docs/ryuo-stages-design.mdの5章)。 -->
      <header v-if="screen !== 'season' && screen !== 'meijin' && screen !== 'shoreikai' && screen !== 'kenshukai'" class="shogi-dex__header">
        <button type="button" class="shogi-dex__back" @click="goBack">
          <span aria-hidden="true">←</span> {{ backText }}
        </button>
        <h1 id="shogi-tournament-title">竜王戦</h1>
      </header>

      <!--
        ページ全体はスクロールさせない。どの画面も、ドット絵の山の地図(真ん中。地図だけが中で動く)と、
        下(横長の画面では右)の枠に分け、いちばん大事なボタン(出場する・対局する・次の期へ)はいつも見えるようにする。
      -->
      <div class="shogi-tournament__body shogi-tournament__body--stage">
        <!--
          節目の判子(4-5)。組優勝・挑戦権・突破など、重さに合わせて大きさを変える。押すと閉じ、操作は止めない(画面全体は覆わない)。
          竜王になったときと、昇級・降級は、結果の画面の判子で見せる。
        -->
        <button
          v-if="milestoneOpen && view?.milestone"
          type="button"
          :class="['shogi-tournament__milestone', `shogi-tournament__milestone--${view.milestone.weight}`]"
          role="status"
          aria-live="polite"
          data-milestone
          @click="milestoneOpen = false"
        >
          <span class="shogi-tournament__milestone-seal" aria-hidden="true">{{ view.milestone.seal }}</span>
          <span class="shogi-tournament__milestone-text">
            <strong>{{ view.milestone.title }}</strong>
            <small>{{ view.milestone.sub }}</small>
          </span>
        </button>

        <div ref="mainEl" class="shogi-tournament__main">
        <ShogiKenshukai
          v-if="screen === 'kenshukai'"
          ref="kenshukaiEl"
          :view="kenshukaiView"
          :career="kenshukaiCareer"
          :recommended-class="kenshukaiRecommendedClass"
          :default-difficulty="defaultDifficulty"
          :usual-world="Boolean(world)"
          :user-level="userLevel"
          :asset-base-url="assetBaseUrl"
          :player-name="playerName"
          :rating-text="ratingText"
          :suspended-moves="kenshukaiSuspendedMoves"
          :from-game="kenshukaiFromGame"
          :shoreikai-busy="shoreikaiBusy"
          :shoreikai-failed="kenshukaiFromFailed"
          @enter="emit('kenshukai-enter', $event)"
          @play="emit('kenshukai-play')"
          @resume="emit('kenshukai-resume')"
          @transfer="transferToShoreikai"
          @close-run="emit('kenshukai-close')"
          @ceremony="openCeremony(`kenshukai-${kenshukaiView?.runId ?? 0}-S`)"
          @back="backToSelect"
        />
        <ShogiShoreikai
          v-else-if="screen === 'shoreikai'"
          ref="shoreikaiEl"
          :view="shoreikaiView"
          :career="shoreikaiCareer"
          :mentors="shoreikaiMentors"
          :recommended-rank="shoreikaiRecommendedRank"
          :default-difficulty="defaultDifficulty"
          :usual-world="Boolean(world)"
          :user-level="userLevel"
          :asset-base-url="assetBaseUrl"
          :player-name="playerName"
          :rating-text="ratingText"
          :suspended-moves="shoreikaiSuspendedMoves"
          :from-game="shoreikaiFromGame"
          @enter="emit('shoreikai-enter', $event)"
          @play="emit('shoreikai-play')"
          @resume="emit('shoreikai-resume')"
          @retry="emit('shoreikai-retry', $event)"
          @close-run="emit('shoreikai-close')"
          @ceremony="openCeremony(`shoreikai-${shoreikaiView?.runId ?? 0}`)"
          @go="leaveShoreikaiTo"
          @back="backToSelect"
        />
        <ShogiMeijin
          v-else-if="screen === 'meijin'"
          ref="meijinEl"
          :view="meijinView"
          :career="meijinCareer"
          :entry-class="meijinEntryClass"
          :rival-class="meijinRivalClass"
          :entry-no="meijinEntryNo"
          :holder-name="meijinHolderName"
          :default-difficulty="defaultDifficulty"
          :usual-world="Boolean(world)"
          :user-level="userLevel"
          :last-settings="meijinSettings"
          :asset-base-url="assetBaseUrl"
          :player-name="playerName"
          :rating-text="ratingText"
          :suspended-moves="meijinSuspendedMoves"
          :open-season="meijinFromGame"
          @enter="emit('meijin-enter', $event)"
          @play="emit('meijin-play')"
          @resume="emit('meijin-resume')"
          @result-seen="emit('meijin-result-seen')"
          @ceremony="openCeremony(`meijin-${meijinView?.no ?? 0}`)"
          :relay-available="Boolean(relayEngineFactory)"
          @relay="openRelayList('meijin', $event)"
          @back="backToSelect"
        />
        <!--
          竜王戦の入口(docs/ryuo-ui-renewal-design.mdの5-1)。山の全景の上に題字と期。開くと、カメラが頂上の竜王から麓の自分まで降りる。
          下の枠に、この期の目標・やこび姫の一言・設定の要約・「出場する」。設定と説明は、押すと重ねて開く(必要な人だけ。U:6-1)。
        -->
        <div v-if="screen === 'ryuo'" class="shogi-tournament__stage shogi-tournament__stage--entry" data-screen="ryuo">
          <div class="shogi-tournament__mapwrap">
            <RyuoMountain :road="entryMapRoad" :asset-base-url="assetBaseUrl" intro :headroom="120" />
            <div class="shogi-tournament__logo" data-entry-logo>
              <span class="shogi-tournament__seal" aria-hidden="true">竜</span>
              <strong>竜王戦</strong>
              <span class="shogi-tournament__logo-no">第{{ inProgress && !reEntry ? seasonNo : entry.no }}期</span>
            </div>
            <ol class="shogi-tournament__banzuke" aria-label="番付">
              <li v-for="row in banzuke(career.champion ? 0 : career.group)" :key="row.key" :class="{ 'shogi-tournament__banzuke--you': row.you }">
                {{ row.label }}<span v-if="row.you" class="shogi-tournament__banzuke-you">あなた</span>
              </li>
            </ol>
          </div>

          <section class="shogi-tournament__hud" aria-label="エントリー">
            <template v-if="inProgress && !reEntry">
              <p class="shogi-tournament__hud-role">進行中の大会</p>
              <p class="shogi-tournament__hud-name">{{ view?.title }} <small>{{ view?.phaseText }}</small></p>
              <button type="button" class="shogi-tournament__sub" @click="reEntry = true">破棄して、新しくエントリー</button>
              <button type="button" class="shogi-tournament__start" data-tournament-continue @click="screen = 'season'">続きから参加する</button>
            </template>
            <template v-else>
              <p class="shogi-tournament__goal-box" data-entry-form><small>この期の目標</small><span data-entry-goal>{{ entryGoal }}</span></p>
              <button type="button" class="shogi-tournament__tip-line" data-entry-about @click="openGuide">
                <img class="shogi-tournament__tip-face" :src="charaUrl" alt="" draggable="false">
                <span class="shogi-tournament__tip-text">{{ talkLines[0] }}</span>
                <span class="shogi-tournament__tip-more">竜王戦ってなに？</span>
              </button>
              <div class="shogi-tournament__entry-settings">
                <p>
                  <small>{{ settingsCustomized ? "設定" : "おすすめの設定" }}</small>
                  <span data-entry-summary>{{ settingsSummary }}</span>
                </p>
                <button type="button" class="shogi-tournament__sub" data-entry-change @click="settingsOpen = true">変える</button>
              </div>
              <button type="button" class="shogi-tournament__start" data-tournament-enter @click="enter">出場する</button>
            </template>
          </section>

          <!-- 設定(対局準備と同じ「項目: 値 [変更]」の行。行のどこを押しても選択シートを開く。U:2-2 同じ操作)。 -->
          <div v-if="settingsOpen" class="shogi-tournament__sheet" role="dialog" aria-modal="true" aria-label="設定" data-entry-settings @click.self="settingsOpen = false">
            <div class="shogi-tournament__sheet-panel shogi-tournament__detail">
              <h2>設定</h2>
              <YakobiSays :lines="talkLines" size="sm" :asset-base-url="assetBaseUrl" />
              <ul v-if="settingsOpen" class="shogi-tournament__settings">
                <li v-for="row in entryRows" :key="row.id">
                  <button
                    type="button"
                    class="shogi-tournament__setting"
                    :data-entry-row="row.id"
                    :aria-label="`${row.label}: ${row.value}。押すと変更`"
                    @click="entryPicker = row.id"
                  >
                    <span class="shogi-tournament__setting-label">{{ row.label }}</span>
                    <span class="shogi-tournament__setting-value">{{ row.value }}<small v-if="row.note">{{ row.note }}</small></span>
                    <span class="shogi-tournament__setting-change" aria-hidden="true">変更</span>
                  </button>
                </li>
              </ul>
              <!-- 「対局: 観戦」のときは、指す分身の能力を見せる(17章)。 -->
              <template v-if="watchMode">
                <PlayerAbilityPanel v-if="avatarProfile?.ready" :view="avatarProfile.view" data-watch-avatar-panel />
                <p v-else class="shogi-tournament__hint" data-watch-avatar-note>{{ avatarNoteText }}</p>
              </template>
              <button type="button" class="shogi-tournament__sub shogi-tournament__sheet-close" @click="settingsOpen = false">閉じる</button>
            </div>
          </div>

          <!-- 竜王戦の説明(やこび姫が順に話す)。入口の上に重ねて開く。 -->
          <div v-if="guideOpen" class="shogi-tournament__sheet" role="dialog" aria-modal="true" aria-label="竜王戦ってなに？" data-guide>
            <aside class="shogi-tournament__coach shogi-tournament__sheet-panel" aria-label="やこび姫の竜王戦ガイド">
              <YakobiSays :lines="[guideLines[guidePage]]" size="xl" merged name-tag :asset-base-url="assetBaseUrl" />
              <div class="shogi-tournament__pager">
                <button type="button" :disabled="guidePage === 0" @click="guidePage -= 1">前へ</button>
                <span aria-live="polite">{{ guidePage + 1 }} / {{ guideLines.length }}</span>
                <button v-if="guidePage < guideLines.length - 1" type="button" @click="guidePage += 1">次へ</button>
                <button v-else type="button" data-guide-close @click="guideOpen = false">わかった</button>
              </div>
              <ol class="shogi-tournament__chapters" aria-label="説明の目次">
                <li v-for="(title, index) in GUIDE_TITLES" :key="title">
                  <button type="button" :aria-current="guidePage === index ? 'step' : undefined" @click="guidePage = index">{{ title }}</button>
                </li>
              </ol>
              <button type="button" class="shogi-tournament__sub shogi-tournament__sheet-close" @click="guideOpen = false">閉じる</button>
            </aside>
          </div>
          <PregamePicker
            v-if="entryPickerConfig"
            :title="entryPickerConfig.title"
            :sections="entryPickerConfig.sections"
            :note="entryPickerConfig.note"
            @select="onEntryPick"
            @close="entryPicker = ''"
          />
        </div>

        <!--
          竜王戦の期の画面(docs/ryuo-ui-renewal-design.mdの5-2、docs/ryuo-stages-design.md)。ドット絵の山の地図(竜王への道)、
          いま見ている段階(① 組のトーナメント・② 決勝トーナメント・③ 番勝負)の表、次の一局の枠。
          上の帯は1本: 戻る・期と推しの段・段階の道のり(押すと、その段階の表)・予想。
          狭い画面では地図と表をタブで切り替え、広い画面(幅1200px以上の横長)では、真ん中の列に横長の地図と、その下に表、右に次の一局。
          相手の能力は次の一局の枠にいつも出し、くわしい情報(使用率・経歴・やこび姫の話・予想)は、押すと下から重ねて開く。
        -->
        <div
          v-else-if="screen === 'season' && view"
          :class="['shogi-tournament__stage', {
            'shogi-tournament__stage--table-open': tableOpen,
            'shogi-tournament__stage--series': stages && viewStageIndex === 2,
          }]"
          data-screen="season"
        >
          <header class="shogi-tournament__topbar">
            <button type="button" class="shogi-tournament__topbar-back" :aria-label="backText" data-season-back @click="goBack">
              <span aria-hidden="true">←</span><span class="shogi-tournament__topbar-back-text">{{ backText }}</span>
            </button>
            <span class="shogi-tournament__seal" aria-hidden="true">竜</span>
            <div class="shogi-tournament__topbar-title">
              <h1 id="shogi-tournament-title" data-phase>{{ seasonHeading }}</h1>
              <p v-if="oshiStep" class="shogi-tournament__oshi" data-oshi-step><span aria-hidden="true">★</span>{{ oshiStep }}</p>
              <p v-else class="shogi-tournament__topbar-sub">{{ view.phaseText }}</p>
            </div>
            <!-- 段階の道のり。済みは緑の✓、いまは琥珀。押すと、その段階の表を見る(まだの段階は下見)。 -->
            <nav v-if="stages" class="shogi-tournament__steps" aria-label="竜王戦の段階" data-stage-steps>
              <template v-for="(stage, index) in stages.stages" :key="stage.key">
                <span v-if="index > 0" :class="['shogi-tournament__step-link', { 'shogi-tournament__step-link--done': stage.status === 'done' || stage.status === 'current' }]" aria-hidden="true"></span>
                <button
                  type="button"
                  :class="['shogi-tournament__step', `shogi-tournament__step--${stage.status}`, {
                    'shogi-tournament__step--viewing': index === viewStageIndex,
                    'shogi-tournament__step--arrived': arrivedFromGame && stages.arrived && stage.status === 'current',
                  }]"
                  :aria-pressed="index === viewStageIndex"
                  :aria-current="stage.status === 'current' ? 'step' : undefined"
                  :data-stage-step="stage.key"
                  @click="showStage(index)"
                >
                  <i aria-hidden="true">{{ stage.status === "done" ? "✓" : index + 1 }}</i>
                  <span class="shogi-tournament__step-long">{{ stage.label }}</span>
                  <span class="shogi-tournament__step-short">{{ stage.short }}</span>
                </button>
              </template>
            </nav>
            <button v-if="predictionOptions" type="button" class="shogi-tournament__icon-btn shogi-tournament__icon-btn--wide" data-prediction-open @click="sheet = 'predict'">予想</button>
            <!-- ほかの棋士の対局の中継(docs/tournament-relay-design.mdの7章)。 -->
            <button v-if="relayEngineFactory" type="button" class="shogi-tournament__icon-btn shogi-tournament__icon-btn--wide" data-relay-open @click="openRelayList('ryuo')">中継</button>
          </header>

          <!--
            地図とトーナメント表の切り替え。表も竜王戦の大事な情報なので、小さな印の奥に隠さず、地図と並ぶタブにする。
            表を見ている間も、下の次の一局の枠(相手と「対局する」)は残す。広い画面では表を地図の横にいつも出し、タブは出さない。
          -->
          <div class="shogi-tournament__view-switch" role="tablist" aria-label="地図と表の切り替え">
            <button type="button" role="tab" :aria-selected="!tableOpen" data-view-map @click="tableOpen = false">竜王への道</button>
            <button type="button" role="tab" :aria-selected="tableOpen" data-table-open @click="tableOpen = true">トーナメント表</button>
          </div>

          <div class="shogi-tournament__mapwrap">
            <RyuoMountain
              v-if="view.road"
              :road="view.road"
              :asset-base-url="assetBaseUrl"
              :animate="climbPending"
              :last-win="view.lastGame?.win ?? false"
              :muted="Boolean(celebration)"
              :glow-crown="celebration === 'challenger' || celebration === 'crown'"
              :opponent="opponentFace"
              :stage-labels="stages?.stages.map(({ label }) => label) ?? []"
              :stage-current="stages?.current ?? -1"
              :stage-shorts="stages?.stages.map(({ short }) => short) ?? []"
              :wide="pcWide"
              @played="climbPending = false"
              @open-opponent="sheet = 'opponent'"
            />
            <!--
              地図の上の知らせ: 羽音の一言(羽音と指した直後)、大番狂わせ、次の相手の勝ち上がり方。
              対局から戻ったときだけ出し、押すと消す(地図を隠し続けない)。勝ち上がり方は、くわしい情報のシートにもある。
            -->
            <button v-if="newsOpen && hasNews" type="button" class="shogi-tournament__mapnotes" aria-label="知らせを閉じる" data-mapnotes @click="newsOpen = false">
              <div v-if="view.lastGame?.rivalLine" class="shogi-tournament__mapnote shogi-tournament__rival-after" data-rival-after>
                <YakobiSays person="hanane" :lines="[view.lastGame.rivalLine]" size="sm" name-tag :notice="view.lastGame.rivalNotice" :asset-base-url="assetBaseUrl" />
              </div>
              <p v-if="view.upset" class="shogi-tournament__mapnote shogi-tournament__upset" data-upset>{{ view.upset }}</p>
              <p v-if="view.pending?.arrival" class="shogi-tournament__mapnote shogi-tournament__arrival" data-arrival>{{ view.pending.arrival }}</p>
            </button>
          </div>

          <!-- 次の一局の枠。相手の顔(押すとくわしい情報)、棋風の札、勝てば/負ければ、やこび姫の1行、「対局する」。 -->
          <section
            v-if="view.pending"
            :class="['shogi-tournament__hud', { 'shogi-tournament__hud--boss': view.pending.stakes?.boss }]"
            aria-label="次の対局"
            data-pending
          >
            <div class="shogi-tournament__hud-head">
              <button type="button" class="shogi-tournament__hud-face" :aria-label="`${view.pending.opponent.name}のくわしい情報`" data-opponent @click="sheet = 'opponent'">
                <img v-if="opponentSprite" :src="opponentSprite" alt="" draggable="false">
                <span v-else :class="`shogi-tournament__hud-face--${opponentStyleTone}`">{{ view.pending.opponent.name.slice(0, 1) }}</span>
              </button>
              <div class="shogi-tournament__hud-info">
                <p class="shogi-tournament__hud-role">
                  <span v-if="view.pending.stakes?.boss" class="shogi-tournament__boss-tag" data-boss>山場</span>
                  <span v-if="view.pending.rival?.story === 'hanane'" class="shogi-tournament__rival-tag" data-rival-tag>ライバル</span>
                  {{ hudRole }}
                </p>
                <p class="shogi-tournament__hud-name">{{ view.pending.opponent.name }} <small>{{ view.pending.opponent.dan }}</small></p>
                <p class="shogi-tournament__hud-chips" data-opponent-ability-line>
                  <span v-for="chip in hudChips" :key="chip.text" :class="`shogi-tournament__chip shogi-tournament__chip--${chip.kind}`">{{ chip.text }}</span>
                </p>
              </div>
              <div v-if="view.pending.kind !== 'game'" class="shogi-tournament__hud-score" :aria-label="`${view.pending.wins.user}勝${view.pending.wins.opponent}敗`">
                <strong>{{ view.pending.wins.user }}<i>-</i>{{ view.pending.wins.opponent }}</strong>
                <small>第{{ view.pending.gameNo }}局</small>
              </div>
            </div>
            <!--
              相手の能力(レーダーチャートの形と8つのランク)と特殊能力の札。作戦を考える大事な手がかりなので、いつも出す。
              押すと、使用率・棋風・経歴までのくわしい情報を開く。
            -->
            <button
              v-if="opponentAbility"
              type="button"
              class="shogi-tournament__hud-ability"
              :aria-label="`${view.pending.opponent.name}の能力。押すとくわしく`"
              data-hud-ability
              @click="sheet = 'opponent'"
            >
              <RadarChart class="shogi-tournament__mini-radar" :axes="opponentRadar" bare aria-hidden="true" />
              <ul class="shogi-tournament__mini-ranks" aria-hidden="true">
                <li v-for="item in opponentAbility.abilities" :key="item.key">
                  <span>{{ item.label }}</span>
                  <b :class="['player-ability__rank', `player-ability__rank--${item.rank}`]">{{ item.rank }}</b>
                </li>
              </ul>
              <span class="shogi-tournament__mini-specials" data-hud-specials>
                <span
                  v-for="chip in opponentAbility.specials.slice(0, 3)"
                  :key="chip.id"
                  :class="['player-ability__chip', `player-ability__chip--${chip.tier}`]"
                >{{ SPECIAL_MARK[chip.tier] }}{{ chip.label }}</span>
                <span class="shogi-tournament__mini-more">くわしく ›</span>
              </span>
            </button>
            <!-- この一局に賭けているもの(core/ryuo-stakes.mjs)。 -->
            <div v-if="view.pending.stakes" class="shogi-tournament__stakes" data-stakes>
              <p class="shogi-tournament__stakes-goal" data-stakes-goal>{{ view.pending.stakes.goal }}</p>
              <dl>
                <div class="shogi-tournament__stakes-win"><dt>勝てば</dt><dd data-stakes-win>{{ view.pending.stakes.win }}</dd></div>
                <div class="shogi-tournament__stakes-lose"><dt>負ければ</dt><dd data-stakes-lose>{{ view.pending.stakes.lose }}</dd></div>
              </dl>
            </div>
            <!-- やこび姫の作戦の手がかり(2行まで)。押すと、続き(やこび姫の話)を開く。 -->
            <!-- 広い画面では、空いた高さに相手の得意戦法(使用率)を出す。作戦を考える手がかり。 -->
            <ul v-if="opponentAbility?.openings?.length" class="shogi-tournament__hud-openings" aria-label="相手の得意戦法" data-hud-openings>
              <li v-for="row in opponentAbility.openings.slice(0, 3)" :key="row.id">
                <span>{{ row.label }}</span>
                <span class="shogi-tournament__hud-openings-bar" aria-hidden="true"><span :class="`shogi-tournament__hud-openings-fill--${row.rook}`" :style="{ width: `${Math.max(4, row.share)}%` }" /></span>
                <b>{{ row.share }}%</b>
              </li>
            </ul>
            <button type="button" class="shogi-tournament__tip-line" data-tip data-coach-more @click="sheet = 'coach'">
              <img class="shogi-tournament__tip-face" :src="charaUrl" alt="" draggable="false">
              <span class="shogi-tournament__tip-text">{{ tipLine }}</span>
              <span class="shogi-tournament__tip-more">もっと聞く</span>
            </button>
            <!-- 中断したこの対局があれば、「対局を再開」(VS画面は出さず、すぐ盤へ)。 -->
            <button v-if="suspendedMoves !== null" type="button" class="shogi-tournament__start shogi-tournament__start--resume" data-tournament-resume @click="emit('resume')">
              対局を再開<small>中断した対局（{{ suspendedMoves }}手目まで）</small>
            </button>
            <!-- 観戦の期(13-6)は、「観戦する」で分身の対局の中継を開く。「結果だけ見る」は中継を開かずに進める。 -->
            <div v-else-if="spectating" class="shogi-tournament__hud-row shogi-tournament__watch-row">
              <button type="button" class="shogi-tournament__sub" data-watch-skip @click="watchAvatarGame(false)">結果だけ見る</button>
              <button type="button" class="shogi-tournament__start" data-watch-play @click="versusOpen = true">{{ playText }}</button>
            </div>
            <button v-else type="button" class="shogi-tournament__start" data-tournament-play @click="versusOpen = true">{{ playText }}</button>
          </section>
          <section v-else-if="view.result" class="shogi-tournament__hud" aria-label="この期の結果">
            <p class="shogi-tournament__hud-role">この期の対局は、すべて終わりました</p>
            <p class="shogi-tournament__hud-name">{{ outcomeHeadline }} <small>{{ view.result.wins }}勝{{ view.result.losses }}敗</small></p>
            <button type="button" class="shogi-tournament__start" data-to-result @click="screen = 'result'">結果と統計を見る</button>
          </section>

          <!-- 対局の直前のVS画面(5-3)。少しして、または押すと、盤へ。 -->
          <RyuoVersus
            v-if="versusOpen && view.pending"
            :asset-base-url="assetBaseUrl"
            :label="view.pending.label"
            :you="view.pending.color === 'white' ? 'white' : 'black'"
            :rating-text="ratingText"
            :you-name="spectating ? `${playerName}の分身` : playerName"
            :opponent="versusOpponent"
            :win="view.pending.stakes?.win ?? ''"
            :boss="Boolean(view.pending.stakes?.boss)"
            @done="startPlay"
          />

          <!-- くわしい情報のシート。下から重ねて開く。 -->
          <div v-if="sheet" class="shogi-tournament__sheet" role="dialog" aria-modal="true" :aria-label="SHEET_TITLE[sheet]" data-detail-sheet @click.self="sheet = ''">
            <div class="shogi-tournament__sheet-panel shogi-tournament__detail">
              <h2>{{ sheet === "opponent" && view.pending ? `${view.pending.opponent.name} ${view.pending.opponent.dan}` : SHEET_TITLE[sheet] }}</h2>
              <template v-if="sheet === 'opponent' && view.pending">
                <YakobiSays
                  v-if="view.pending.rival?.line"
                  class="shogi-tournament__rival-says"
                  person="hanane"
                  :lines="[view.pending.rival.line]"
                  size="md"
                  bust
                  data-rival-before
                  :asset-base-url="assetBaseUrl"
                />
                <p v-if="view.pending.arrival" class="shogi-tournament__hint">{{ view.pending.arrival }}</p>
                <dl class="shogi-tournament__tiles shogi-tournament__tiles--three">
                  <div><dt>相手の棋力</dt><dd>Lv.{{ view.pending.opponent.level }}</dd></div>
                  <div><dt>得意戦法</dt><dd class="shogi-tournament__tile-text">{{ opponentFavorite }}</dd></div>
                  <div><dt>手番</dt><dd class="shogi-tournament__tile-text">{{ view.pending.color === "black" ? "先手" : "後手" }}</dd><span class="shogi-tournament__tile-note">振り駒</span></div>
                </dl>
                <PlayerAbilityPanel v-if="opponentAbility" :view="opponentAbility" data-tournament-opponent-ability />
                <dl class="shogi-tournament__profile" data-tournament-opponent-profile>
                  <div v-if="opponentProfile.repertoire"><dt>戦型</dt><dd>{{ opponentProfile.repertoire }}</dd></div>
                  <div><dt>棋風</dt><dd>{{ opponentProfile.style }}</dd></div>
                  <div v-if="opponentProfile.strengths.length"><dt>得意</dt><dd>{{ opponentProfile.strengths.join("・") }}</dd></div>
                  <div v-if="opponentProfile.weaknesses.length"><dt>苦手</dt><dd>{{ opponentProfile.weaknesses.join("・") }}</dd></div>
                  <div v-if="opponentProfile.titles"><dt>タイトル</dt><dd>{{ opponentProfile.titles }}</dd></div>
                  <div v-if="opponentProfile.junni"><dt>順位戦</dt><dd>{{ opponentProfile.junni }}</dd></div>
                  <div v-if="opponentProfile.lastSeason"><dt>昨年度</dt><dd>{{ opponentProfile.lastSeason }}</dd></div>
                  <div><dt>対戦</dt><dd>{{ opponentProfile.vsUser }}</dd></div>
                </dl>
                <!-- 相手のこの期の対局を、中継で見て対策を考える(docs/tournament-relay-design.mdの7章)。 -->
                <button
                  v-if="opponentRelayCount && relayEngineFactory"
                  type="button"
                  class="shogi-tournament__sub relay-open"
                  data-opponent-relay
                  @click="sheet = ''; openRelayList('ryuo', view.pending.opponent.id)"
                >{{ view.pending.opponent.name }}さんの対局を見る<small>この期 {{ opponentRelayCount }}局</small></button>
              </template>
              <aside v-else-if="sheet === 'coach'" class="shogi-tournament__coach" aria-label="やこび姫" data-coach>
                <YakobiSays :lines="seasonSays" size="md" merged :asset-base-url="assetBaseUrl" />
              </aside>
              <!--
                組優勝の予想。ランキング戦の1局目が決まる前だけ選べる。当たっても見返りは小さく(記録に残るだけ)、
                肩入れする理由にする。自分自身に賭けてもよい。
              -->
              <section v-else-if="sheet === 'predict' && predictionOptions" class="shogi-tournament__predict-box" data-prediction>
                <p class="shogi-tournament__hint">{{ view.startGroup }}組ランキング戦を勝ち抜くのは誰かな？ 当たると、やこびノートのコレクションに記録されるよ。</p>
                <div class="shogi-tournament__predict">
                  <select v-model="predictionPick" aria-label="組優勝の予想">
                    <option value="" disabled>棋士を選んでね</option>
                    <option v-for="option in predictionOptions" :key="option.id" :value="option.id">{{ option.name }}</option>
                  </select>
                  <button type="button" :disabled="!predictionPick" @click="choosePrediction(); sheet = ''">予想する</button>
                </div>
              </section>
              <ul v-if="view.series.length && sheet !== 'predict'" class="shogi-tournament__series" aria-label="番勝負">
                <li v-for="series in view.series" :key="series.key" :class="{ 'shogi-tournament__series--done': series.winner }">
                  <span class="shogi-tournament__series-label">{{ series.label }}</span>
                  <span class="shogi-tournament__series-name">{{ series.a?.name }}</span>
                  <strong class="shogi-tournament__series-score">{{ series.wins.a }} - {{ series.wins.b }}</strong>
                  <span class="shogi-tournament__series-name">{{ series.b?.name }}</span>
                </li>
              </ul>
              <button type="button" class="shogi-tournament__sub shogi-tournament__sheet-close" data-sheet-close @click="sheet = ''">閉じる</button>
            </div>
          </div>

          <!--
            いま見ている段階の表(docs/ryuo-stages-design.mdの3・4章)。①②は試合の札の表、③は番勝負。
            狭い画面では「トーナメント表」のタブで地図の場所に出し、広い画面では地図の横にいつも出す。表は枠の中で動かす(U:7-5)。
          -->
          <section
            v-if="stages"
            :class="['shogi-tournament__tables', { 'shogi-tournament__tables--open': tableOpen }]"
            :aria-label="viewedStage?.label ?? 'トーナメント表'"
            data-tables
          >
            <div class="shogi-tournament__stagehead">
              <h2><span aria-hidden="true">{{ ["①", "②", "③"][viewStageIndex] }}</span>{{ viewedStage?.label }}</h2>
              <p data-stage-note>{{ stageNote }}</p>
            </div>
            <div v-if="viewStageIndex === 0 && stages.group.length > 1" class="shogi-tournament__tabs shogi-tournament__bracket-tabs" role="tablist" aria-label="どの表を見るか">
              <button
                v-for="table in stages.group"
                :key="table.key"
                type="button"
                role="tab"
                :aria-selected="table.key === groupTable?.key"
                :data-bracket-tab="table.key"
                @click="groupChoice = table.key"
              >{{ table.label }}</button>
            </div>
            <RyuoBracket
              v-if="viewStageIndex === 0 && groupTable && groupTable.view.matches.length"
              :key="`g-${groupTable.key}`"
              class="shogi-tournament__bracket"
              :view="groupTable.view"
              :oshi-id="oshi?.id ?? ''"
              :rival-id="view.rivalId ?? ''"
              :watchable="Boolean(relayEngineFactory)"
              @watch="watchMatch"
            />
            <p v-else-if="viewStageIndex === 0" class="shogi-tournament__stage-empty">各組のランキング戦は、決勝トーナメントの組み合わせが決まると見られます。</p>
            <RyuoBracket
              v-if="viewStageIndex === 1 && stages.final.matches.length"
              :key="`f-${stages.final.preview ? 'preview' : 'main'}`"
              class="shogi-tournament__bracket"
              :view="stages.final"
              :oshi-id="oshi?.id ?? ''"
              :rival-id="view.rivalId ?? ''"
              :watchable="Boolean(relayEngineFactory) && !stages.final.preview"
              @watch="watchMatch"
            />
            <RyuoSeries
              v-if="viewStageIndex === 2"
              class="shogi-tournament__series-view"
              :series="stages.series"
              :holder="stages.holder"
              :stages="stages.stages"
              :you-name="playerName"
              :next-color="view.pending?.kind !== 'game' ? view.pending?.color ?? '' : ''"
              :defense="view.mode === 'defense'"
            />
          </section>
        </div>

        <!--
          期の結果(docs/ryuo-ui-renewal-design.mdの5-5)。山の全景で今期どこまで登ったか、左の番付で来期の組(昇級・竜王は判子)。
          下の枠に、数字の札3枚・次の期の目標・やこび姫の一言・「次の期へ」。統計とレーダーチャートと解説は「くわしく」の奥。
        -->
        <div v-else-if="screen === 'result' && view?.result" class="shogi-tournament__stage shogi-tournament__stage--result" data-screen="result" data-result-screen>
          <div class="shogi-tournament__mapwrap">
            <RyuoMountain v-if="view.road" :road="view.road" :asset-base-url="assetBaseUrl" :glow-crown="groupMove.kind === 'crown'" :headroom="110" />
            <div class="shogi-tournament__result-head">
              <p class="shogi-tournament__eyebrow">{{ view.title }}の結果</p>
              <p class="shogi-tournament__headline">{{ outcomeHeadline }}</p>
              <p v-if="oshiStep" class="shogi-tournament__oshi" data-oshi-step><span aria-hidden="true">★</span>{{ oshiStep }}</p>
            </div>
            <ol class="shogi-tournament__banzuke" :aria-label="`番付。${groupMove.from}から${groupMove.to}（${groupMove.label}）`">
              <li v-for="row in banzuke(groupMove.kind === 'crown' ? 0 : view.result.newGroup)" :key="row.key" :class="{ 'shogi-tournament__banzuke--you': row.you }">
                {{ row.label }}<span v-if="row.you" class="shogi-tournament__banzuke-you">あなた</span>
                <strong
                  v-if="row.you && (groupMove.kind === 'up' || groupMove.kind === 'crown' || groupMove.kind === 'down')"
                  :class="['shogi-tournament__move-label', `shogi-tournament__move-label--${groupMove.kind}`, { 'shogi-tournament__move-label--stamp': resultStamp }]"
                  data-move-label
                >{{ groupMove.kind === 'crown' ? groupMove.label : `${groupMove.to}へ${groupMove.label}` }}</strong>
              </li>
            </ol>
          </div>

          <section class="shogi-tournament__hud" aria-label="結果">
            <dl class="shogi-tournament__result-cards" data-stats>
              <div><dd>{{ view.result.wins }}勝{{ view.result.losses }}敗</dd><dt>戦績</dt></div>
              <div><dd>{{ bestAxisLabel || "—" }}</dd><dt>いちばん光った</dt></div>
              <div><dd>{{ stats.longestWinStreak }}連勝</dd><dt>最長</dt></div>
            </dl>
            <p class="shogi-tournament__next-goal" data-next-goal><small>次の期</small>{{ entryGoalLine({ mode: entry.mode, group: entry.group, scale: scale }) }}</p>
            <button type="button" class="shogi-tournament__tip-line" data-result-more @click="resultDetailOpen = true">
              <img class="shogi-tournament__tip-face" :src="charaUrl" alt="" draggable="false">
              <span class="shogi-tournament__tip-text">{{ resultSays[0] }}</span>
              <span class="shogi-tournament__tip-more">くわしく</span>
            </button>
            <div class="shogi-tournament__hud-row">
              <button type="button" class="shogi-tournament__sub" data-result-table @click="screen = 'season'">表を見る</button>
              <button type="button" class="shogi-tournament__sub" @click="emit('open-note')">ノートを見る</button>
            </div>
            <!-- 敗退したあとの対局を、回戦ごとに観戦する(13章)。 -->
            <button v-if="afterWatchCount" type="button" class="shogi-tournament__sub relay-open" data-watch-after @click="watchTarget = 'after'">
              このあとの対局を観戦<small>{{ afterWatchRevealed >= afterWatchCount ? "見届けた" : `${afterWatchCount}回戦` }}</small>
            </button>
            <button type="button" class="shogi-tournament__start" data-award-open @click="openCeremony(`ryuo-${seasonNo}`)">表彰式へ</button>
          </section>

          <!-- くわしい結果(統計・レーダーチャート・やこび姫の解説)。 -->
          <div v-if="resultDetailOpen" class="shogi-tournament__sheet" role="dialog" aria-modal="true" aria-label="くわしい結果" data-result-detail @click.self="resultDetailOpen = false">
            <div class="shogi-tournament__sheet-panel shogi-tournament__detail">
              <h2>{{ outcomeHeadline }}</h2>
              <p class="shogi-tournament__text">{{ outcomeDetail }}</p>
              <p v-if="bestAxis" class="shogi-tournament__best" data-best-axis>{{ bestAxis }}</p>
              <ul v-if="view.result.titles?.length" class="shogi-tournament__titles">
                <li v-for="title in view.result.titles" :key="title.id"><strong>{{ title.label }}</strong><small>{{ title.detail }}</small></li>
              </ul>
              <ol class="shogi-tournament__path">
                <li v-for="step in view.result.path" :key="step.stage + step.label"><span>{{ step.label }}</span><strong>{{ step.text }}</strong></li>
              </ol>
              <YakobiSays v-if="view.lastGame?.rivalLine" person="hanane" :lines="[view.lastGame.rivalLine]" size="md" bust name-tag :notice="view.lastGame.rivalNotice" :asset-base-url="assetBaseUrl" data-rival-after />
              <aside class="shogi-tournament__coach" aria-label="やこび姫の解説" data-commentary>
                <YakobiSays size="xl" name-tag :asset-base-url="assetBaseUrl" :lines="[...resultSays, ...commentarySays]">
                  <div class="yakobi-says__bubble shogi-tournament__result-talk">
                    <p v-for="line in resultSays" :key="line">{{ line }}</p>
                  </div>
                  <p v-for="line in view.stats.commentary" :key="line.title" class="yakobi-says__bubble">
                    <strong>{{ line.title }}</strong>
                    <small>{{ line.text }}</small>
                  </p>
                </YakobiSays>
              </aside>
              <section class="shogi-tournament__radar" aria-label="レーダーチャート">
                <h3>この期のあなた</h3>
                <RadarChart :axes="view.stats.radar" />
                <p v-if="view.stats.pending" class="shogi-tournament__hint" data-analyzing>やこび姫が対局を解析しています（あと{{ view.stats.pending }}局）。終わると、点数が出ます。</p>
                <p v-else class="shogi-tournament__hint">外側ほど得意。「—」は、データが足りない項目です。</p>
              </section>
              <dl class="shogi-tournament__tiles">
                <div v-for="tile in statTiles" :key="tile.label">
                  <dt>{{ tile.label }}</dt>
                  <dd>{{ tile.value }}</dd>
                  <span v-if="tile.note" class="shogi-tournament__tile-note">{{ tile.note }}</span>
                </div>
              </dl>
              <button type="button" class="shogi-tournament__sub shogi-tournament__sheet-close" @click="resultDetailOpen = false">閉じる</button>
            </div>
          </div>
        </div>
        </div>

      </div>
    </template>

    <!-- 賞状帳(docs/season-award-design.md)。古い順に並べ、押すとその賞状を開く。 -->
    <div v-if="bookOpen" class="shogi-tournament__sheet" role="dialog" aria-modal="true" aria-label="賞状帳" data-award-list @click.self="bookOpen = false">
      <div class="shogi-tournament__sheet-panel shogi-tournament__detail">
        <h2>賞状帳</h2>
        <ul v-if="awards.length" class="shogi-tournament__awards">
          <li v-for="item in [...awards].reverse()" :key="item.id">
            <button type="button" class="shogi-tournament__award-row" :data-award-row="item.id" @click="openBookAward(item)">
              <span :class="['shogi-tournament__award-seal', `shogi-tournament__award-seal--${item.grade}`]" aria-hidden="true">{{ item.seal }}</span>
              <span class="shogi-tournament__award-text">{{ awardLine(item) }}<small>{{ item.wins }}勝{{ item.losses }}敗{{ item.grade === "fight" ? "・敢闘賞" : "" }}</small></span>
            </button>
          </li>
        </ul>
        <p v-else class="shogi-tournament__text">竜王戦や名人戦の期を終えると、表彰式で賞状がもらえるよ。ここにたまっていくからね。</p>
        <button type="button" class="shogi-tournament__sub shogi-tournament__sheet-close" @click="bookOpen = false">閉じる</button>
      </div>
    </div>
    <!-- 回戦ごとの観戦(docs/tournament-relay-design.mdの13章)。中継の画面はこの上に重ねる。 -->
    <RyuoWatch
      v-if="watchTarget && watchSeason"
      :season="watchSeason"
      :revealed="watchRevealed"
      :oshi-id="oshi?.id ?? ''"
      :seen="relaySeen"
      @reveal="emit('watch-progress', String(watchSeason.id), $event)"
      @watch="openWatchEntry"
      @close="watchTarget = null"
    />
    <!-- 対局中継の一覧と、中継の画面(docs/tournament-relay-design.md)。大会の画面の上に重ねる。 -->
    <RelayGameList
      v-if="relayList && !relayEntry"
      :entries="relayList.event === 'meijin' ? meijinRelayGameList : ryuoRelayGameList"
      :seen="relaySeen"
      :focus-id="relayList.playerId"
      @watch="relayEntry = $event"
      @all="relayList = { ...relayList, playerId: '' }"
      @close="relayList = null"
    />
    <RelayViewer
      v-if="relayEntry && relayEngineFactory"
      :spec="relayEntry"
      :pool="relayPool"
      :oshi-id="oshi?.id ?? ''"
      :next-id="relayNextId"
      :asset-base-url="assetBaseUrl"
      :engine-factory="relayEngineFactory"
      :compact="compact"
      :news="relayNews"
      @seen="noteRelaySeen"
      @close="relayEntry = null"
    />
    <SeasonAward
      v-if="awardShown"
      :award="awardShown"
      :ceremony="awardCeremony"
      :button-text="awardCeremony ? (screen === 'kenshukai' ? '研修会へ' : '大会の選択へ') : '閉じる'"
      :asset-base-url="assetBaseUrl"
      @done="finishAward"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type PropType } from "vue";
import RyuoBracket, { type BracketView } from "./RyuoBracket.vue";
import RyuoSeries, { type SeriesView } from "./RyuoSeries.vue";
import RadarChart from "./RadarChart.vue";
import PlayerAbilityPanel from "./PlayerAbilityPanel.vue";
import RyuoMountain, { type RoadView } from "./RyuoMountain.vue";
import RyuoVersus from "./RyuoVersus.vue";
import ShogiMeijin, { type MeijinView } from "./ShogiMeijin.vue";
import ShogiShoreikai, { type ShoreikaiView } from "./ShogiShoreikai.vue";
import ShogiKenshukai, { type KenshukaiView } from "./ShogiKenshukai.vue";
import RelayGameList from "./RelayGameList.vue";
import RelayViewer from "./RelayViewer.vue";
import { meijinRelayGames, relayGamesOf, relayRoundNews, ryuoRelayGames } from "./core/relay-games.mjs";
import { stepsAfterElimination, userWonSeason, watchSteps } from "./core/ryuo-watch.mjs";
import RyuoWatch from "./RyuoWatch.vue";
import { loadRelayStore } from "./core/relay-store.mjs";
import type { EngineFactory } from "./composables/match/analysisEngines";
import { CLASSES as KENSHUKAI_CLASSES } from "./core/kenshukai.mjs";
import YakobiSays from "./YakobiSays.vue";
import SeasonAward, { type SeasonAwardData } from "./SeasonAward.vue";
import { awardLine } from "./core/season-award.mjs";
import PregamePicker, { type PickerSection, type PickerValue } from "./PregamePicker.vue";
import { DIFFICULTY_LEVELS, SCALES, entryGoalLine, entryRoad, scaleById } from "./core/ryuo.mjs";
import { GROUP_MEAN_RATING, MAX_CPU_LEVEL, MIN_CPU_LEVEL, worldExactLevel } from "./core/ryuo-strength.mjs";
import { rankTag, resolveWorld } from "./core/tournament-world.mjs";
import { HANANE_SPRITE } from "./core/ryuo-story.mjs";
import { bestAxisLine } from "./core/ryuo-milestone.mjs";
import { createMoveSoundPlayer } from "./core/move-sound";
import { nextEntry, outcomeText } from "./core/ryuo-career.mjs";
import {
  entryCoachLine,
  entryDifficultyLine,
  entryRevivalLine,
  entryScaleLine,
  lastGameLines,
  opponentLines,
  resultLines,
  ryuoGuideLines,
  seasonPhaseLines,
  entryByoyomiLine,
} from "./core/ryuo-speech.mjs";
import { BYOYOMI_CHOICES, byoyomiLabel, byoyomiSeconds } from "./core/byoyomi.mjs";
import { LEARNING_ASSIST_LIMITS } from "./core/learning-setup.mjs";
import { describeCharacter } from "./core/player-character.mjs";
import { repertoireText } from "./core/ryuo-repertoire.mjs";
import { memberAbilityView, vsUserText } from "./core/ryuo-book.mjs";
import {
  loadPrediction,
  oshiSeasonLine,
  oshiSeasonStatus,
  oshiStepText,
  predictionChoices,
  predictionLine,
  predictionOutcome,
  savePrediction,
} from "./core/ryuo-oshi.mjs";
import { loadCollection, recordPredictionHit, saveCollection } from "./core/collection.mjs";

type Career = {
  group: number; seasons: number; champion: boolean; titles: number; streak: number; eternal: boolean;
  settings: { scale: number; revival: boolean; coachLevel: string; hintLimit: number; undoLimit: number; byoyomi?: number; watch?: boolean };
};
type Brief = {
  id: string; name: string; dan: string; level: number; style?: { label: string; rook?: string } | null; story?: string | null;
  character?: { attack: number; traits: { id: string; degree: number }[] } | null;
  repertoire?: { party: string; styles: string[] } | null;
  profile?: { held: string[]; former: string[]; totalTitles: number; junni: string | null; season: { wins: number; losses: number } | null } | null;
  vsUser?: { wins: number; losses: number; streak: number; lastWin: boolean | null } | null;
};
type Table = { key: string; title: string };
type Summary = {
  games: number; wins: number; losses: number; winRate: number | null; longestWinStreak: number;
  black: { games: number; wins: number }; white: { games: number; wins: number };
  vsStatic: { games: number; wins: number }; vsRanging: { games: number; wins: number };
  analyzed: number; moves: number; averageLoss: number | null; bigRate: number | null; averagePlies: number | null;
  kinds: { blunder: number; mistake: number; dubious: number; good: number; brilliant: number };
};
type View = {
  title: string; mode: string; startGroup: number; phase: string; phaseText: string; resultSeen: boolean;
  tables: Table[];
  /** 3つの段階(core/ryuo-stages.mjs、describeSeasonのstages)。 */
  stages?: {
    current: number;
    /** 直前の対局で、次の段階に進んだ。 */
    arrived: boolean;
    stages: { key: string; label: string; short: string; status: string; wins: number; losses: number; index: number }[];
    rule: { group: number; size: number; slots: number; promote: number; entrants: number };
    group: { key: string; label: string; group: number; own: boolean; view: BracketView }[];
    final: BracketView & { preview: boolean; hopeWins: number | null; hopeLabel: string };
    series: SeriesView[];
    holder: { id: string; name: string; dan: string; profile?: { held?: string[] } | null } | null;
  };
  series: { key: string; label: string; need: number; a: Brief | null; b: Brief | null; wins: { a: number; b: number }; winner: string | null }[];
  pending: null | {
    label: string; kind: string; color: string; need: number; gameNo: number; wins: { user: number; opponent: number }; opponent: Brief;
    rival?: null | { story: string; line: string; coach: string; grudge: boolean };
    /** この一局に賭けているもの(core/ryuo-stakes.mjs)。 */
    stakes?: null | { win: string; lose: string; goal: string; boss: boolean };
    /** 相手が前の回戦をどう勝ってきたか(core/ryuo-road.mjs)。 */
    arrival?: string;
  };
  road?: RoadView;
  milestone?: null | { kind: string; weight: string; seal: string; title: string; sub: string; line: string };
  upset?: string;
  rivalId?: string | null;
  result: null | {
    outcome: string; startGroup: number; newGroup: number; promoted: boolean; relegated: boolean; challenger: boolean;
    wins: number; losses: number; standing: number | null; exitLabel: string; path: { stage: string; label: string; text: string }[];
    titles?: { id: string; label: string; detail: string }[];
    oshiLine?: string;
  };
  defender: Brief | null;
  lastGame?: null | {
    win: boolean; label: string; opponent: Brief | null; traitMoments: { id: string; ply: number }[];
    rivalLine?: string; rivalNotice?: boolean;
  };
  stats: {
    radar: { key: string; label: string; value: number | null }[]; summary: Summary; pending: number;
    commentary: { title: string; text: string }[];
  };
};

const props = defineProps({
  assetBaseUrl: { type: String, default: "." },
  backLabel: { type: String, default: "タイトルへ戻る" },
  career: { type: Object as PropType<Career>, required: true },
  view: { type: Object as PropType<View | null>, default: null },
  defaultDifficulty: { type: Number, default: 7 },
  /** プレイヤーの棋力の目安(CPUのLv)。やこび姫が、相手の強さを話すのに使う。 */
  userLevel: { type: Number, default: 20 },
  ratingText: { type: String, default: "" },
  /** 開いたときの画面。ryuoは竜王戦の入口(期の途中なら期の画面)。棋力測定の結果の「竜王戦に出る」から。 */
  startAt: { type: String as PropType<"select" | "season" | "meijin" | "ryuo" | "shoreikai" | "kenshukai">, default: "select" },
  /** いまの竜王(プレイヤーが竜王ならnull)。入口の山で、七番勝負に顔を出す。 */
  ryuoHolder: { type: Object as PropType<{ id: string; name: string; attack?: number; story?: string | null } | null>, default: null },
  /** プレイヤー名(タイトル画面で入れる。入れていなければ「あなた」)。VS画面に出す。 */
  playerName: { type: String, default: "あなた" },
  /** 竜王戦の対局から戻ったところ。竜王への道で、前の段から登る動きを1回だけ見せる。 */
  fromGame: { type: Boolean, default: false },
  /** 推しの棋士(core/ryuo-oshi.mjs)。やこび姫が、期の中での様子を知らせる。 */
  oshi: { type: Object as PropType<{ id: string; name: string } | null>, default: null },
  /** 中断した、この期の次の一局の手数(なければnull)。あれば「対局する」を「対局を再開」にする。 */
  suspendedMoves: { type: Number as PropType<number | null>, default: null },
  // ---- 世界の物差し(core/tournament-world.mjs。docs/tournament-strength-spread-design.md)
  /** いまの棋力からのおすすめの番号(defaultDifficultyは、世界があれば「いつもの世界」の番号)。 */
  recommendedDifficulty: { type: Number as PropType<number | null>, default: null },
  /** 保存した世界の物差し。なければ、はじめての大会(おすすめで決める)。 */
  world: { type: Object as PropType<{ level: number; difficulty: number; playerLevel: number; at: number } | null>, default: null },
  /** 世界を決めたときからの棋力のずれ(強くなった・弱くなった・2期続けて降級した)。 */
  worldReview: { type: Object as PropType<{ kind: "grown" | "dropped" | "struggling"; delta: number } | null>, default: null },
  // ---- 名人戦(docs/meijin-design.md)
  meijinView: { type: Object as PropType<MeijinView | null>, default: null },
  meijinCareer: { type: Object as PropType<{ no: number; best: string; titles: number; eternal: boolean }>, default: () => ({ no: 0, best: "C2", titles: 0, eternal: false }) },
  meijinEntryClass: { type: String as PropType<"C2" | "C1" | "B2" | "B1" | "A" | "meijin">, default: "C2" },
  /** 羽音のいまの順位戦のクラス(同じクラスなら、入口で一言添える)。 */
  meijinRivalClass: { type: String, default: "" },
  meijinEntryNo: { type: Number, default: 1 },
  meijinHolderName: { type: String, default: "" },
  meijinSettings: { type: Object as PropType<Record<string, unknown> | null>, default: null },
  meijinSuspendedMoves: { type: Number as PropType<number | null>, default: null },
  /** 賞状帳(core/season-award.mjs。古い順)。期が終わったときに、対局画面が足す。 */
  awards: { type: Array as PropType<SeasonAwardData[]>, default: () => [] },
  // ---- 奨励会(docs/shoreikai-design.md)
  shoreikaiView: { type: Object as PropType<ShoreikaiView | null>, default: null },
  shoreikaiCareer: { type: Object as PropType<{ history: { result: string; kishiNumber: number | null }[]; pro: { kishiNumber: number } | null; settings?: Record<string, unknown> }>, default: () => ({ history: [], pro: null }) },
  shoreikaiMentors: { type: Array as PropType<{ id: string; name: string; dan: string; age: number; party: string; partyLabel: string; styleLabel: string; repertoire: string }[]>, default: () => [] },
  shoreikaiRecommendedRank: { type: Number, default: 0 },
  shoreikaiSuspendedMoves: { type: Number as PropType<number | null>, default: null },
  // ---- 研修会(docs/kenshukai-design.md)
  kenshukaiView: { type: Object as PropType<KenshukaiView | null>, default: null },
  kenshukaiCareer: { type: Object as PropType<{ history: { result: string; best: string }[]; best: number | null; settings?: Record<string, unknown> }>, default: () => ({ history: [], best: null }) },
  kenshukaiRecommendedClass: { type: Number, default: 0 },
  kenshukaiSuspendedMoves: { type: Number as PropType<number | null>, default: null },
  // ---- 対局中継(docs/tournament-relay-design.md)。期の保存の形(見られる対局を集める)と、棋譜を作るエンジン。
  ryuoSeason: { type: Object as PropType<any>, default: null },
  /** 回戦ごとの観戦の保存(観戦の期と、期ごとのめくった数。core/ryuo-watch-store.mjs)。 */
  ryuoWatch: { type: Object as PropType<any>, default: null },
  /** 分身の能力(core/my-abilities.mjsのmyAbilityProfile)。 */
  avatarProfile: { type: Object as PropType<any>, default: null },
  /** いまの期が、エントリーの「対局: 観戦」で始めた期(分身が指す。17章)。「対局する」が「観戦する」になる。 */
  spectating: { type: Boolean, default: false },
  meijinSeason: { type: Object as PropType<any>, default: null },
  relayEngineFactory: { type: Function as PropType<() => Promise<EngineFactory>>, default: null },
  /** スマホ・タブレット縦(中継の棋譜を作る読みの量を減らす)。 */
  compact: { type: Boolean, default: false },
});
const emit = defineEmits<{
  close: [];
  enter: [settings: { difficulty: number; scale: number; revival: boolean; coachLevel: string; hintLimit: number; undoLimit: number; byoyomi: number; watch: boolean }];
  "watch-progress": [seasonId: string, revealed: number];
  /** 観戦の期の、分身の次の一局を決める。 */
  "watch-play": [];
  play: [];
  resume: [];
  "open-note": [];
  "result-seen": [];
  "meijin-enter": [settings: { difficulty: number; scale: string; coachLevel: string; hintLimit: number; undoLimit: number; byoyomi: number }];
  "meijin-play": [];
  "meijin-resume": [];
  "meijin-result-seen": [];
  "shoreikai-enter": [payload: { settings: Record<string, unknown>; examRank: number; mentorId: string }];
  "shoreikai-play": [];
  "shoreikai-resume": [];
  "shoreikai-retry": [rank: number];
  "shoreikai-close": [];
  "kenshukai-enter": [payload: { settings: Record<string, unknown>; entryClass: number }];
  "kenshukai-play": [];
  "kenshukai-resume": [];
  "kenshukai-transfer": [];
  "kenshukai-close": [];
}>();

const HOME_STARS = [
  { id: "t1", style: "left:9%;top:16%;width:12px;height:12px;color:#fffcf4;" },
  { id: "t2", style: "left:16%;top:38%;width:8px;height:8px;color:#f1a54c;" },
  { id: "t3", style: "left:24%;top:10%;width:6px;height:6px;color:#d7d1fd;" },
  { id: "t4", style: "left:52%;top:12%;width:6px;height:6px;color:#f1a54c;" },
  { id: "t5", style: "left:63%;top:22%;width:12px;height:12px;color:#fffcf4;" },
  { id: "t6", style: "left:84%;top:30%;width:8px;height:8px;color:#f1a54c;" },
  { id: "t7", style: "left:12%;top:70%;width:8px;height:8px;color:#f1a54c;" },
  { id: "t8", style: "left:88%;top:66%;width:8px;height:8px;color:#d7d1fd;" },
];
const ROAD = [{ id: "kenshukai", label: "研修会" }, { id: "shoreikai", label: "奨励会" }];

const charaUrl = computed(() => `${props.assetBaseUrl}/characters/yakobihime-mini.webp?v=4`);
const inProgress = computed(() => Boolean(props.view && !props.view.result));
const screen = ref<"select" | "ryuo" | "season" | "result" | "meijin" | "shoreikai" | "kenshukai">(
  props.startAt === "kenshukai" ? "kenshukai"
  : props.startAt === "shoreikai" ? "shoreikai"
  : props.startAt === "meijin" ? "meijin"
    : props.startAt === "season" && props.view ? (props.view.result ? "result" : "season")
      : props.startAt === "ryuo" ? (props.view && !props.view.result ? "season" : "ryuo")
        : "select",
);
const meijinEl = ref<{ goBack: () => boolean } | null>(null);
// ---- 奨励会(docs/shoreikai-design.md)
const shoreikaiEl = ref<{ goBack: () => boolean } | null>(null);
/** 対局から奨励会へ戻ってきた(判子と最終日の結果発表を1回だけ出す)。大会の選択から選び直したら出さない。 */
const shoreikaiFromGame = ref(props.fromGame && props.startAt === "shoreikai");
const shoreikaiCardNote = computed(() => {
  const view = props.shoreikaiView;
  if (view && (view.phase === "exam" || view.phase === "reikai" || view.phase === "league")) return `${view.rankLabel}・挑戦中`;
  if (props.shoreikaiCareer.pro) return `棋士番号${props.shoreikaiCareer.pro.kishiNumber}号`;
  return "入会試験から四段へ";
});
function chooseShoreikai() {
  shoreikaiFromGame.value = false;
  screen.value = "shoreikai";
}
/** 四段の式から竜王戦・名人戦へ。挑戦を終えて(経歴に残して)から移る。入会試験に落ちたところからは、研修会へ(挑戦は残す)。 */
function leaveShoreikaiTo(target: "ryuo" | "meijin" | "kenshukai") {
  if (target === "kenshukai") {
    chooseKenshukai({ fromFailed: true });
    return;
  }
  emit("shoreikai-close");
  if (target === "meijin") chooseMeijin();
  else chooseRyuo();
}
// ---- 研修会(docs/kenshukai-design.md)
const kenshukaiEl = ref<{ goBack: () => boolean } | null>(null);
/** 対局から研修会へ戻ってきた(判子を1回だけ出す)。 */
const kenshukaiFromGame = ref(props.fromGame && props.startAt === "kenshukai");
/** 奨励会の入会試験に落ちたところから来た。 */
const kenshukaiFromFailed = ref(false);
/** 奨励会の挑戦の途中(研修会からの編入は、それを終えてから)。 */
const shoreikaiBusy = computed(() => ["exam", "reikai", "league"].includes(props.shoreikaiView?.phase ?? ""));
const kenshukaiCardNote = computed(() => {
  const view = props.kenshukaiView;
  if (view?.phase === "exam") return `${view.exam.label}受験・挑戦中`;
  if (view?.phase === "top") return "Sクラス・研修会の頂点";
  if (view) return `${view.classLabel}クラス・挑戦中`;
  const best = props.kenshukaiCareer.best;
  if (best !== null && best !== undefined) return `最高 ${KENSHUKAI_CLASSES[best]}クラス`;
  return "F2からA2・Sクラスへ";
});
function chooseKenshukai({ fromFailed = false }: { fromFailed?: boolean } = {}) {
  kenshukaiFromGame.value = false;
  kenshukaiFromFailed.value = fromFailed;
  screen.value = "kenshukai";
}
/** 研修会から奨励会6級へ編入する。研修会の挑戦を閉じ、奨励会の入口(編入の形)へ。 */
function transferToShoreikai() {
  if (shoreikaiBusy.value) return;
  emit("kenshukai-transfer");
  shoreikaiFromGame.value = false;
  screen.value = "shoreikai";
}
/** 名人戦の札の小さな説明(いまのクラス・期・名人の期数)。 */
const meijinCardNote = computed(() => {
  const cls = props.meijinEntryClass === "meijin" ? "名人" : ({ C2: "C級2組", C1: "C級1組", B2: "B級2組", B1: "B級1組", A: "A級" } as Record<string, string>)[props.meijinEntryClass] ?? "";
  const progress = props.meijinView && !props.meijinView.result ? "・進行中" : "";
  return props.meijinCareer.no || progress ? `${cls}${progress}` : "順位戦から名人へ";
});
/** 対局から名人戦へ戻ってきた(期の画面から開く)。大会の選択から選び直したら、入口の五重塔から。 */
const meijinFromGame = ref(props.fromGame && props.startAt === "meijin");
/** 名人戦を選ぶ。 */
function chooseMeijin() {
  meijinFromGame.value = false;
  screen.value = "meijin";
}
const reEntry = ref(false);
/** 竜王への道の、登る動きをまだ見せていない。 */
const climbPending = ref(props.fromGame);
/** 対局から戻ったところ(観戦の期は、分身の対局の中継を閉じたところ)。節目の一言と段階の光りを出す。 */
const arrivedFromGame = ref(props.fromGame);
/** 中身の欄。画面を切り替えたら、上から見せる。 */
const mainEl = ref<HTMLElement | null>(null);
watch(screen, () => {
  if (mainEl.value) mainEl.value.scrollTop = 0;
}, { flush: "post" });

const entry = computed(() => nextEntry(props.career));
const ryuoCardNote = computed(() => {
  const { career } = props;
  const status = career.champion ? "竜王" : `${career.group}組`;
  const progress = inProgress.value ? "・進行中" : "";
  return `${status}・参加${career.seasons}期${career.titles ? `・竜王${career.titles}期` : ""}${progress}`;
});

/** 竜王戦を選ぶ。進行中なら表へ、見ていない結果があれば結果へ、そうでなければ、説明とエントリーへ。 */
function chooseRyuo() {
  if (props.view && !props.view.result) screen.value = "season";
  else if (props.view?.result && !props.view.resultSeen) screen.value = "result";
  else screen.value = "ryuo";
  talkTopic.value = "intro";
  settingsOpen.value = false;
  guideOpen.value = false;
  tableOpen.value = false;
  sheet.value = "";
}

const backText = computed(() => (screen.value === "result" ? "大会選択へ" : "大会の選択へ"));
/**
 * 戻る操作。重ねて開いたもの(くわしい情報・トーナメント表・説明)があれば、まずそれを閉じる。
 * 結果は見終えたことにして、大会の選択へ。ほかの画面も、大会の選択へ。選択の画面なら、閉じる。
 */
function goBack() {
  if (relayEntry.value) {
    relayEntry.value = null;
    return;
  }
  if (relayList.value) {
    relayList.value = null;
    return;
  }
  if (watchTarget.value) {
    watchTarget.value = null;
    return;
  }
  if (awardShown.value) {
    awardShown.value = null;
    awardCeremony.value = false;
  } else if (bookOpen.value) bookOpen.value = false;
  else if (sheet.value) sheet.value = "";
  else if (resultDetailOpen.value) resultDetailOpen.value = false;
  else if (settingsOpen.value) settingsOpen.value = false;
  else if (tableOpen.value) tableOpen.value = false;
  else if (guideOpen.value) guideOpen.value = false;
  else if (screen.value === "meijin" && meijinEl.value?.goBack()) return;
  else if (screen.value === "shoreikai" && shoreikaiEl.value?.goBack()) return;
  else if (screen.value === "kenshukai" && kenshukaiEl.value?.goBack()) return;
  else if (screen.value === "select") emit("close");
  else backToSelect();
}
function backToSelect() {
  if (screen.value === "result") emit("result-seen");
  screen.value = "select";
  reEntry.value = false;
  viewStage.value = null;
  groupChoice.value = null;
  tableOpen.value = false;
}
defineExpose({ goBack });

// ---- 対局中継(docs/tournament-relay-design.md)。決着した棋士どうしの対局を、解説つきで見る。
const ryuoRelayGameList = computed(() => (props.ryuoSeason ? ryuoRelayGames(props.ryuoSeason, { oshiId: props.oshi?.id ?? null }) : []));
const meijinRelayGameList = computed(() => (props.meijinSeason ? meijinRelayGames(props.meijinSeason, { oshiId: props.oshi?.id ?? null }) : []));
/** 一覧(どの大会か、棋士を決めて開いたときはその棋士のid)。 */
const relayList = ref<{ event: "ryuo" | "meijin"; playerId: string } | null>(null);
/** いま見ている中継の対局(relay-games.mjsの項目)。 */
const relayEntry = ref<any>(null);
const relaySeen = ref<string[]>([]);
function relayStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
function openRelayList(event: "ryuo" | "meijin", playerId = "") {
  relaySeen.value = loadRelayStore(relayStorage()).seen;
  relayList.value = { event, playerId: playerId || "" };
}
function noteRelaySeen(key: string) {
  if (!relaySeen.value.includes(key)) relaySeen.value = [...relaySeen.value, key];
}
/** トーナメント表の札を押した。決着した棋士どうしの試合なら、その中継を開く。 */
function watchMatch(matchId: string) {
  const found = ryuoRelayGameList.value.find((item) => item.key.endsWith(`:${matchId}`));
  if (found) relayEntry.value = found;
}
/** 次の相手の、この期の対局の数。 */
const opponentRelayCount = computed(() => {
  const id = props.view?.pending?.opponent?.id;
  return id ? relayGamesOf(ryuoRelayGameList.value, id).length : 0;
});
/** 中継の解説者を選ぶ棋士(見ている大会の期の棋士)。 */
const relayPool = computed(() => {
  const key = relayEntry.value?.key ?? "";
  const season = [props.ryuoSeason, props.ryuoWatch?.season, props.meijinSeason]
    .find((item) => item && key.startsWith(`${relayEntry.value?.event}:${item.id}:`));
  return Object.values(season?.players ?? {});
});
/** 同じ回戦のほかの結果(中継の運営のコメント)。 */
const relayNews = computed(() => (relayEntry.value && !relayEntry.value.noNews
  ? relayRoundNews(relayEntry.value.event === "meijin" ? meijinRelayGameList.value : ryuoRelayGameList.value, relayEntry.value)
  : []));
// ---- 回戦ごとの観戦(13章)
/** 開いている観戦(分身が出る観戦の期か、本番の期の敗退後)。 */
const watchTarget = ref<"after" | null>(null);
const watchSeason = computed(() => props.ryuoSeason);
const watchRevealed = computed(() => Number(props.ryuoWatch?.progress?.[String(watchSeason.value?.id)] ?? 0));
/** 本番の期で敗退したとき、観戦できる回戦の数(竜王になった期・終わっていない期は0)。 */
const afterWatchSteps = computed(() => {
  const season = props.ryuoSeason;
  if (!season || season.phase !== "done" || (season.spectator && !season.live) || userWonSeason(season)) return [];
  return stepsAfterElimination(season, watchSteps(season, { oshiId: props.oshi?.id ?? null }));
});
const afterWatchCount = computed(() => afterWatchSteps.value.length);
const afterWatchRevealed = computed(() => Number(props.ryuoWatch?.progress?.[String(props.ryuoSeason?.id)] ?? 0));
const avatarNoteText = computed(() => {
  const need = props.avatarProfile?.need;
  return need ? `まだ対局の解析が少ないので、分身の能力は平均だよ（あと${need}手ぶんの解析で個性が出るよ）。` : "分身の能力は、あなたの対局から出すよ。";
});
/** 中継を閉じたら、対局から戻ったときと同じく、竜王への道を登る(結果を見せる)。 */
const arrivalPending = ref(false);
/**
 * 観戦の期の「観戦する」(VS画面のあと)・「結果だけ見る」。分身の次の一局を決め、その中継を開く。
 * 中継を閉じたら(結果だけ見るときはすぐ)、対局から戻ったときと同じ演出で結果を見せる。
 */
async function watchAvatarGame(withRelay: boolean) {
  versusOpen.value = false;
  const before = new Set(ryuoRelayGameList.value.filter((item) => item.tags?.self).map((item) => item.key));
  emit("watch-play");
  await nextTick();
  const entry = withRelay && props.relayEngineFactory
    ? ryuoRelayGameList.value.find((item) => item.tags?.self && !before.has(item.key)) ?? null
    : null;
  if (entry) {
    relaySeen.value = loadRelayStore(relayStorage()).seen;
    arrivalPending.value = true;
    relayEntry.value = entry;
  } else arriveFromGame();
}
watch(relayEntry, (now, before) => {
  if (!now && before && arrivalPending.value) {
    arrivalPending.value = false;
    arriveFromGame();
  }
});
/** 観戦の中から中継を開く。めくる前の結果を見せないよう、同じ回戦のほかの結果(運営の帯)は出さない。 */
function openWatchEntry(entry: any) {
  relaySeen.value = loadRelayStore(relayStorage()).seen;
  relayEntry.value = { ...entry, noNews: true };
}
const relayNextId = computed(() => (relayEntry.value?.event === "meijin" ? props.meijinSeason : props.ryuoSeason)?.pending?.opponentId ?? "");

// ---- 入口の山(期が始まる前の竜王への道)と番付
/** 入口の山。進行中の期があれば、その期の道。なければ、次の期の道(規模を変えると段の数も変わる)。 */
const entryMapRoad = computed<RoadView>(() => (
  inProgress.value && !reEntry.value && props.view?.road
    ? props.view.road
    : entryRoad({ mode: entry.value.mode, group: entry.value.group, scale: scale.value, holder: props.ryuoHolder })
));
/** 進行中の期の番号(第◯期竜王戦の◯)。 */
const seasonNo = computed(() => Number(props.view?.title.match(/第(\d+)期/)?.[1] ?? entry.value.no));
/** 番付(竜王・1組〜6組)。youは自分の組(0なら竜王)。 */
function banzuke(you: number) {
  return [0, 1, 2, 3, 4, 5, 6].map((group) => ({ key: group, label: group ? `${group}組` : "竜王", you: group === you }));
}

// ---- エントリー設定
const DIFFICULTY_STEPS = Array.from({ length: DIFFICULTY_LEVELS }, (_, index) => index + 1);
/** 強さの山のいちばん上(名簿でいちばん強い棋士の目安。docs/rating-realism-design.md)。 */
const TOP_RATING = 2130;
const COACH_OPTIONS = [
  { value: "off", label: "なし" },
  { value: "encourage", label: "応援のみ" },
  { value: "detailed", label: "詳しい助言" },
];
const REVIVAL_OPTIONS = [
  { value: true, label: "あり" },
  { value: false, label: "なし" },
];
const difficulty = ref(props.defaultDifficulty);
// おすすめを選んでいた場合は、次の期も新しい棋力に合わせる。手動で選んだ番号は保つ。
watch(() => props.defaultDifficulty, (next, previous) => {
  if (difficulty.value === previous) difficulty.value = next;
});
const scale = ref(props.career.settings.scale);
const revival = ref(props.career.settings.revival);
const coachLevel = ref(props.career.settings.coachLevel);
const hintLimit = ref(props.career.settings.hintLimit);
const undoLimit = ref(props.career.settings.undoLimit);
const byoyomi = ref(byoyomiSeconds(props.career.settings));
/** 対局: 自分で指すか、観戦(分身が指し、中継で見る。17章)か。 */
const watchMode = ref(Boolean(props.career.settings.watch));
const PLAY_OPTIONS = [
  { value: "self", label: "自分で指す" },
  { value: "watch", label: "観戦（分身が指す）" },
];

/** 選んでいる番号での世界の基準Lv(6組の平均を指させるLv)。入口で「大会に参加する」を押したとき、この世界を保存する。 */
const worldLevel = computed(() => resolveWorld({ stored: props.world, playerLevel: props.userLevel, difficulty: difficulty.value }).level);
const levelIn = (rating: number) => Math.min(MAX_CPU_LEVEL, Math.max(MIN_CPU_LEVEL, Math.round(worldExactLevel(rating, worldLevel.value))));
const meanLevel = computed(() => levelIn(GROUP_MEAN_RATING[entry.value.group as keyof typeof GROUP_MEAN_RATING]));
/** 強さの山(1行)。6組の平均・1組の平均・竜王(いちばん上)のLvと、あなたのLv。 */
const mountain = computed(() => ({
  six: levelIn(GROUP_MEAN_RATING[6]), one: levelIn(GROUP_MEAN_RATING[1]), top: levelIn(TOP_RATING), you: Math.round(props.userLevel),
}));
const scaleNote = computed(() => {
  const item = scaleById(scale.value);
  const group = entry.value.group;
  const slots = Object.values(item.slots).reduce((sum, count) => sum + count, 0);
  if (entry.value.mode === "defense") return "防衛戦は、挑戦者との七番勝負だけ（先に4勝）。挑戦者の強さは、難易度で決まるよ。";
  return `${group}組は${item.sizes[group]}名のトーナメント。決勝トーナメントは${slots}名。昇級・降級は各${item.promote}名だよ。`
    + "番勝負の数は変わらないよ。";
});
/** 規模の要点。行の下に、短く出す。 */
const scaleMeta = computed(() => {
  const item = scaleById(scale.value);
  if (entry.value.mode === "defense") return "防衛戦は七番勝負だけ";
  const slots = Object.values(item.slots).reduce((sum, count) => sum + count, 0);
  return `${entry.value.group}組${item.sizes[entry.value.group]}名・決勝トーナメント${slots}名・昇級と降級は各${item.promote}名`;
});

// ---- やこび姫のセリフ
// エントリーでは、やこび姫がこの期のひとことを話す。設定を変えると、その設定について話す。
// 竜王戦の説明は、「竜王戦ってなに？」で開くシートで、1つずつ話す(必要な人だけ。U:6-1)。
type TalkTopic = "intro" | "difficulty" | "scale" | "revival" | "coach" | "byoyomi";
// 世界を決めたときから棋力が動いた(強くなった・苦しい)ときは、入口で最初にその一言を出す(4-3)。
const talkTopic = ref<TalkTopic>(props.worldReview ? "difficulty" : "intro");
/** 説明の各ページの見出し(目次)。guideLinesと同じ順・同じ数。 */
const GUIDE_TITLES = ["はじめに", "竜王戦とは", "出場できる人", "ランキング戦", "決勝トーナメント", "番勝負", "永世竜王"];
const guidePage = ref(0);
const guideOpen = ref(false);
function openGuide() {
  guidePage.value = 0;
  guideOpen.value = true;
}
const guideLines = computed(() => [
  entry.value.mode === "defense"
    ? "竜王として、防衛戦に臨もう！ 挑戦者との七番勝負だよ。"
    : "竜王戦のこと、順に説明するね。知りたいところだけ、目次から読んでもいいよ。",
  ...ryuoGuideLines(),
]);
const difficultyLine = computed(() => entryDifficultyLine({
  group: entry.value.group, meanLevel: meanLevel.value, difficulty: difficulty.value,
  recommended: props.defaultDifficulty, ratingText: props.ratingText,
  usual: Boolean(props.world), mountain: { one: mountain.value.one, top: mountain.value.top }, review: props.worldReview,
}));
const scaleLine = computed(() => entryScaleLine(scaleById(scale.value).label, scaleNote.value));
const coachLine = computed(() => entryCoachLine({ coachLevel: coachLevel.value, hintLimit: hintLimit.value, undoLimit: undoLimit.value }));
const talkLines = computed(() => {
  switch (talkTopic.value) {
    case "difficulty": return [difficultyLine.value];
    case "scale": return [scaleLine.value];
    case "revival": return [entryRevivalLine(revival.value)];
    case "coach": return [coachLine.value];
    case "byoyomi": return [entryByoyomiLine(byoyomi.value)];
    default: return [introLine.value];
  }
});
/** 入口のやこび姫のひとこと。目標(上の1行)を、気持ちの言葉で言い直す。 */
const introLine = computed(() => {
  // 世界の物差しを決める前の、前から遊んでいる人には、上の組が強くなったことを一度だけ先に伝える(4-6)。
  const notice = !props.world && props.career.seasons ? "棋士の強さの差を、本物の棋界に近づけたよ。上の組ほど、ぐっと強くなるよ！ " : "";
  return `${notice}${introGoalLine.value}`;
});
const introGoalLine = computed(() => {
  const { no, mode, group } = entry.value;
  if (mode === "defense") return `第${no}期は、竜王として防衛戦！ 挑戦者を迎え撃とう！`;
  if (group === 1) return `第${no}期は1組から。決勝トーナメントに出て、竜王への挑戦者をめざそう！`;
  if (!props.career.seasons) return `第${no}期竜王戦、${group}組からのスタートだね！ まずは昇級をめざそう。いっしょにがんばろう！`;
  return `第${no}期は${group}組から。めざせ昇級！ 一局ずつ、勝ち上がろう！`;
});
/** 入口の、この期の目標(1行)。 */
const entryGoal = computed(() => entryGoalLine({ mode: entry.value.mode, group: entry.value.group, scale: scale.value }));
/** 設定の要約(1行)。初めての人は、そのまま「大会に参加する」を押せばよい。 */
const settingsSummary = computed(() => [
  ...(watchMode.value ? ["観戦"] : []),
  `難易度${difficulty.value}`,
  `規模 ${SCALES.find((item) => item.id === scale.value)?.label ?? ""}`,
  `敗者復活${revival.value ? "あり" : "なし"}`,
  coachLevel.value === "off" ? "助言なし" : COACH_OPTIONS.find((item) => item.value === coachLevel.value)?.label ?? "",
  ...(byoyomi.value ? [`秒読み${byoyomiLabel(byoyomi.value)}`] : []),
].join("・"));
/** おすすめ(前の期の設定と、おすすめの難易度)から変えたか。 */
const settingsCustomized = computed(() => (
  difficulty.value !== props.defaultDifficulty
  || scale.value !== props.career.settings.scale
  || revival.value !== props.career.settings.revival
  || coachLevel.value !== props.career.settings.coachLevel
  || hintLimit.value !== props.career.settings.hintLimit
  || undoLimit.value !== props.career.settings.undoLimit
  || byoyomi.value !== byoyomiSeconds(props.career.settings)
  || watchMode.value !== Boolean(props.career.settings.watch)
));
const phaseLines = computed(() => seasonPhaseLines(props.view));
/** 次の相手の棋風と特徴(得意・苦手)。 */
const opponentProfile = computed(() => {
  const opponent = props.view?.pending?.opponent;
  const career = opponent?.profile;
  const titles = career?.held?.length
    ? `${career.held.join("・")}（通算${career.totalTitles}期）`
    : career?.totalTitles ? `${career.former.join("・")}（通算${career.totalTitles}期）` : "";
  return {
    ...describeCharacter(opponent?.character ?? null),
    repertoire: repertoireText(opponent?.repertoire ?? null),
    titles,
    junni: career?.junni ?? "",
    lastSeason: career?.season && (career.season.wins || career.season.losses) ? `${career.season.wins}勝${career.season.losses}敗` : "",
    vsUser: opponent ? vsUserText(opponent.vsUser ?? null) : "",
  };
});
/** 次の相手の能力値・特殊能力・使用率(core/ryuo-book.mjs)。能力のない古い期の棋士はnull。 */
const opponentAbility = computed(() => memberAbilityView(props.view?.pending?.opponent ?? null));
/** 能力の見出しに添える、いちばん高い能力といちばん低い能力。 */
const opponentAbilitySummary = computed(() => {
  const abilities = opponentAbility.value?.abilities ?? [];
  if (!abilities.length) return "";
  const sorted = [...abilities].sort((a, b) => b.value - a.value);
  return `${sorted[0].label}${sorted[0].rank}・${sorted.at(-1)!.label}${sorted.at(-1)!.rank}`;
});
/** 得意戦法の札。使用率があれば、いちばん多い戦法と割合。 */
const opponentFavorite = computed(() => {
  const top = opponentAbility.value?.openings?.[0];
  return top ? `${top.label} ${top.share}%` : props.view?.pending?.opponent?.style?.label ?? "—";
});
/** 次の相手の顔の色(棋風): 攻め(朱)・受け(藍)・バランス(金)。色だけでなく、名前の1文字でも見分ける。 */
const opponentStyleTone = computed(() => {
  const attack = props.view?.pending?.opponent?.character?.attack ?? 0;
  return attack >= 0.25 ? "attack" : attack <= -0.25 ? "defense" : "balance";
});
/** 次の相手の顔の絵。いまは羽音だけ。ほかの棋士のミニキャラのドット絵が増えたら、ここで返す。 */
const opponentSprite = computed(() => (
  props.view?.pending?.opponent?.story === "hanane"
    ? `${props.assetBaseUrl}/characters/${HANANE_SPRITE.file}?v=${HANANE_SPRITE.version}`
    : ""
));
const opponentSays = computed(() => (
  props.view?.pending
    ? [...(props.view.pending.rival?.coach ? [props.view.pending.rival.coach] : []), ...opponentLines(props.view.pending.opponent, props.userLevel, props.view.pending)]
    : []
));
const resultSays = computed(() => [
  ...resultLines(props.view?.result ? { ...props.view.result } : null),
  // 推しの棋士の、この期の結果(ほかの組でも、期の終わりに分かる)。
  ...(props.view?.result?.oshiLine ? [props.view.result.oshiLine] : []),
]);
/** 表の画面のやこび姫: いまの段階と、次の相手について。期が終わっていれば、結果について。 */
const lastGameSays = computed(() => lastGameLines(props.view?.lastGame ?? null));
const seasonSays = computed(() => {
  const lines = [...lastGameSays.value, ...phaseLines.value, ...opponentSays.value];
  return [...(lines.length ? lines : resultSays.value), ...cheerSays.value];
});
/**
 * 次の一局の、やこび姫の1行。ライバルの一言を先に。最初の期は、いまの段階の説明(竜王戦の説明を場面ごとに分けたもの。U:6-1)。
 * 2期目からは、相手の能力の穴から作戦の手がかり。
 */
const tipLine = computed(() => {
  const ability = opponentSays.value.find((line) => line.startsWith("能力は"));
  const firstSeason = !props.career.seasons;
  // 対局から戻った直後の節目は、やこび姫がまず喜ぶ(4-5)。
  return (arrivedFromGame.value ? props.view?.milestone?.line : "")
    || props.view?.pending?.rival?.coach
    || (firstSeason ? phaseLines.value[0] : ability)
    || ability
    || phaseLines.value[0]
    || opponentSays.value[0]
    || "";
});
/** 地図の上の知らせ(羽音の一言・大番狂わせ・勝ち上がり方)。対局から戻ったときだけ出す。 */
const newsOpen = ref(props.fromGame);
const hasNews = computed(() => Boolean(props.view?.lastGame?.rivalLine || props.view?.upset || props.view?.pending?.arrival));
/** 期の画面で重ねて開く、くわしい情報のシート(相手・やこび姫の話・予想)。 */
type Sheet = "" | "opponent" | "coach" | "predict";
const sheet = ref<Sheet>("");
const SHEET_TITLE: Record<Exclude<Sheet, "">, string> = { opponent: "次の相手", coach: "やこび姫", predict: "組優勝を予想しよう" };
/** 期の画面の上の帯の見出し(例: 第3期 6組ランキング戦)。 */
const stageTitle = computed(() => {
  const view = props.view;
  if (!view) return "";
  const phase = view.mode === "defense" && view.phase !== "done" ? "防衛戦" : view.phaseText;
  return `${view.title.replace(/竜王戦$/, "")} ${phase}`;
});
/** 次の一局の枠の見出し(例: 準々決勝の相手、竜王戦七番勝負 第3局)。 */
const hudRole = computed(() => {
  const pending = props.view?.pending;
  if (!pending) return "";
  return pending.kind === "game" ? `${pending.label.split(" ").at(-1)}の相手` : pending.label;
});
/**
 * 次の相手の札: 棋風と、いちばんよく指す戦法。能力の高い・低いは、すぐ下のランクの並びで見えるので札にしない。
 */
const hudChips = computed(() => {
  const chips: { text: string; kind: string }[] = [];
  // 世界の物差しで、上の組の棋士は強い。2Lv以上の差があれば、色だけでなく文字で先に知らせる(U:7-3)。
  const tag = props.view?.pending ? rankTag(props.view.pending.opponent.level, props.userLevel) : null;
  if (tag) chips.push({ text: tag, kind: tag === "格上" ? "rank-up" : "rank-down" });
  if (opponentProfile.value.style) chips.push({ text: opponentProfile.value.style, kind: opponentStyleTone.value });
  const top = opponentAbility.value?.openings?.[0];
  if (top) chips.push({ text: `${top.label} ${top.share}%`, kind: "opening" });
  return chips;
});
/** 次の一局の枠の小さなレーダーチャート(形だけ。軸の名前とランクは横の並びで読む)。 */
const opponentRadar = computed(() => (opponentAbility.value?.abilities ?? []).map(({ key, label, value }) => ({ key, label, value })));
/** 特殊能力の札の頭の印(PlayerAbilityPanel.vueと同じ。色だけに頼らず、形でも区別する)。 */
const SPECIAL_MARK: Record<string, string> = Object.freeze({ gold: "★", blue: "＋", red: "−" });
/** 対局の直前のVS画面。閉じたら(時間が来るか押すと)対局を始める。 */
const versusOpen = ref(false);
function startPlay() {
  versusOpen.value = false;
  if (props.spectating) {
    void watchAvatarGame(true);
    return;
  }
  emit("play");
}
/** VS画面の相手。 */
const versusOpponent = computed(() => {
  const opponent = props.view?.pending?.opponent;
  return {
    name: opponent?.name ?? "", char: opponent?.name.slice(0, 1) ?? "", tone: opponentStyleTone.value, sprite: opponentSprite.value,
    dan: opponent?.dan ?? "", style: opponentProfile.value.style ?? "",
  };
});
/** 山の地図に置く、次の相手の顔。 */
const opponentFace = computed(() => {
  const opponent = props.view?.pending?.opponent;
  return opponent ? { name: opponent.name, char: opponent.name.slice(0, 1), tone: opponentStyleTone.value, story: opponent.story ?? null } : null;
});

// ---- 節目(core/ryuo-milestone.mjs。docs/ryuo-ux-redesign.mdの4-5・4-6)
/** 節目の札を出している長さ(ms)。動きは1.5秒以内に終わり、読むために少し残す。押せばすぐ閉じる。 */
const MILESTONE_SHOW_MS = 3200;
/** 判子が紙に着く時刻(ms)。CSSの判子の動き(遅れ450ms・長さ260msの7割)に合わせて、音を鳴らす。 */
const STAMP_SOUND_AT = 630;
/** 結果の画面の判子が着く時刻(ms)。CSSの遅れ300ms・長さ260msの7割。 */
const RESULT_STAMP_SOUND_AT = 480;
const soundPlayer = createMoveSoundPlayer(() => props.assetBaseUrl);
/** 期の画面の節目の札。対局から戻ったときに1回だけ(期が終わったときは、結果の画面の判子で見せる)。 */
const milestoneOpen = ref(props.fromGame && Boolean(props.view?.milestone) && !props.view?.result);
/** 結果の画面の判子を押す(昇級・竜王のときだけ。降級や残留は静かに。D:7-1)。 */
const resultStamp = ref(false);
/** いま見せている節目の種類(道の竜王の段を光らせ、登る音を判子の音に譲るのに使う)。 */
const celebration = computed(() => {
  if (milestoneOpen.value) return props.view?.milestone?.kind ?? "";
  return resultStamp.value ? props.view?.milestone?.kind ?? "result" : "";
});
const milestoneTimers: ReturnType<typeof setTimeout>[] = [];
/** 対局から戻ったときの判子(節目の札か、結果の画面の判子)。 */
function playArrivalStamp() {
  if (milestoneOpen.value) {
    milestoneTimers.push(
      setTimeout(() => soundPlayer.play("stamp"), STAMP_SOUND_AT),
      setTimeout(() => { milestoneOpen.value = false; }, MILESTONE_SHOW_MS),
    );
  } else if (arrivedFromGame.value && props.view?.result && (groupMove.value.kind === "up" || groupMove.value.kind === "crown")) {
    resultStamp.value = true;
    milestoneTimers.push(
      setTimeout(() => soundPlayer.play("stamp"), RESULT_STAMP_SOUND_AT),
      setTimeout(() => { resultStamp.value = false; }, MILESTONE_SHOW_MS),
    );
  }
}
onMounted(playArrivalStamp);
/**
 * 観戦の期で、分身の対局の中継を閉じた(結果だけ見るときは、すぐ)。対局から戻ったときと同じく、
 * 竜王への道を登り、知らせと節目の判子を出す。期が終われば結果の画面へ(13-6)。
 */
function arriveFromGame() {
  arrivedFromGame.value = true;
  climbPending.value = true;
  newsOpen.value = true;
  if (props.view?.result) screen.value = "result";
  milestoneOpen.value = Boolean(props.view?.milestone) && !props.view?.result;
  playArrivalStamp();
}
onBeforeUnmount(() => milestoneTimers.splice(0).forEach(clearTimeout));
/** 期の結果の、くわしい情報(統計・レーダーチャート・解説)。 */
const resultDetailOpen = ref(false);
/** 期のいちばん光った項目(レーダーチャートでいちばん高い項目)。 */
const bestAxisLabel = computed(() => (
  [...(props.view?.stats?.radar ?? [])].filter(({ value }) => typeof value === "number").sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0]?.label ?? ""
));
/** 期のできたこと(1行)。 */
const bestAxis = computed(() => bestAxisLine(props.view?.stats?.radar ?? []));

// ---- 応援(推しの棋士と、組優勝の予想)。core/ryuo-oshi.mjs
const storage = (() => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
})();
const prediction = ref(loadPrediction(storage));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const seasonView = computed(() => props.view as any);
/** 予想できる棋士。この期の予想がまだで、ランキング戦の1局目が決まる前だけ。 */
const predictionOptions = computed(() => (
  prediction.value?.season === props.view?.title ? null : predictionChoices(seasonView.value)
));
const predictionPick = ref("");
function choosePrediction() {
  const option = predictionOptions.value?.find(({ id }) => id === predictionPick.value);
  if (!option || !props.view) return;
  prediction.value = { season: props.view.title, pid: option.id, name: option.name, counted: false };
  savePrediction(storage, prediction.value);
}
const predictionResult = computed(() => predictionOutcome(seasonView.value, prediction.value));
/** 当たったら一度だけ、コレクションに記録する(印には数えない)。 */
function countPredictionHit() {
  const current = prediction.value;
  if (predictionResult.value !== "hit" || !current || current.counted) return;
  saveCollection(storage, recordPredictionHit(loadCollection(storage)));
  prediction.value = { ...current, counted: true };
  savePrediction(storage, prediction.value);
}
watch(predictionResult, countPredictionHit, { immediate: true });

// ---- エントリー設定の行と選択シート(対局準備と同じ形)。「変える」で開く。
const settingsOpen = ref(false);
const entryPicker = ref("");
const assistText = (value: number) => LEARNING_ASSIST_LIMITS.find((item) => item.value === value)?.label ?? String(value);
const entryRows = computed(() => [
  { id: "play", label: "対局", value: watchMode.value ? PLAY_OPTIONS[1].label : PLAY_OPTIONS[0].label, note: watchMode.value ? "あなたの能力の分身が指し、中継で見る" : "" },
  { id: "difficulty", label: "難易度", value: String(difficulty.value), note: `6組 Lv.${mountain.value.six} → 1組 Lv.${mountain.value.one} → 竜王 Lv.${mountain.value.top}（あなた Lv.${mountain.value.you}）` },
  { id: "scale", label: "規模", value: SCALES.find((item) => item.id === scale.value)?.label ?? "", note: scaleMeta.value },
  { id: "revival", label: "敗者復活戦", value: REVIVAL_OPTIONS.find((item) => item.value === revival.value)?.label ?? "", note: "" },
  { id: "coach", label: "やこび姫の助言", value: COACH_OPTIONS.find((item) => item.value === coachLevel.value)?.label ?? "", note: "" },
  { id: "assist", label: "閃き・待った", value: `閃き${assistText(hintLimit.value)}・待った${assistText(undoLimit.value)}`, note: "" },
  { id: "byoyomi", label: "秒読みの演出", value: byoyomiLabel(byoyomi.value), note: byoyomi.value ? "0秒になっても負けにはならない" : "" },
]);
/** 難易度の選択肢の説明。いつもの世界と、いまの棋力からのおすすめ。 */
function difficultyDescription(level: number) {
  const labels = [];
  if (props.world && level === props.world.difficulty) labels.push("いつもの世界");
  if (level === (props.recommendedDifficulty ?? props.defaultDifficulty)) labels.push("いまのあなたのおすすめ（6組の平均に7割）");
  return labels.join("・");
}
const entryPickerConfig = computed<{ title: string; sections: PickerSection[]; note: string } | null>(() => {
  const single = (title: string, key: string, value: PickerValue, options: { value: PickerValue; label: string; description?: string }[], note = "") => (
    { title, note, sections: [{ key, value, groups: [{ options }] }] }
  );
  switch (entryPicker.value) {
    case "difficulty":
      return single("難易度", "difficulty", difficulty.value, DIFFICULTY_STEPS.map((level) => ({
        value: level, label: String(level), description: difficultyDescription(level),
      })), "数字が大きいほど、どの棋士も強くなるよ。選んだ世界は、次の期からも使うよ。");
    case "scale":
      return single("規模", "scale", scale.value, SCALES.map((item) => ({ value: item.id, label: item.label })));
    case "revival":
      return single("敗者復活戦", "revival", String(revival.value), REVIVAL_OPTIONS.map((item) => ({ value: String(item.value), label: item.label })));
    case "coach":
      return single("やこび姫の助言", "coach", coachLevel.value, COACH_OPTIONS.map((item) => ({ value: item.value, label: item.label })));
    case "play":
      return single("対局", "play", watchMode.value ? "watch" : "self", PLAY_OPTIONS.map((item) => ({ value: item.value, label: item.label })),
        "観戦にすると、あなたの対局から出した能力を持つ分身が指し、あなたは「観戦する」で中継を見るよ。組・竜王・称号・賞状は、ふつうの期と同じに数えるよ。レーティングには数えないよ。");
    case "byoyomi":
      return single("秒読みの演出", "byoyomi", byoyomi.value, BYOYOMI_CHOICES.map((item) => ({ value: item.value, label: item.label })), "10秒から音で知らせるよ。0秒になっても負けにはならないよ。");
    case "assist":
      return {
        title: "閃き・待った",
        note: "",
        sections: [
          { key: "hint", label: "閃き", value: hintLimit.value, groups: [{ options: LEARNING_ASSIST_LIMITS.map((item) => ({ value: item.value, label: item.label })) }] },
          { key: "undo", label: "待った", value: undoLimit.value, groups: [{ options: LEARNING_ASSIST_LIMITS.map((item) => ({ value: item.value, label: item.label })) }] },
        ],
      };
    default:
      return null;
  }
});
function onEntryPick(key: string, value: PickerValue) {
  if (key === "difficulty") { difficulty.value = Number(value); talkTopic.value = "difficulty"; }
  else if (key === "scale") { scale.value = value as typeof scale.value; talkTopic.value = "scale"; }
  else if (key === "revival") { revival.value = value === "true"; talkTopic.value = "revival"; }
  else if (key === "coach") { coachLevel.value = String(value); talkTopic.value = "coach"; }
  else if (key === "hint") { hintLimit.value = Number(value); talkTopic.value = "coach"; }
  else if (key === "undo") { undoLimit.value = Number(value); talkTopic.value = "coach"; }
  else if (key === "byoyomi") { byoyomi.value = Number(value); talkTopic.value = "byoyomi"; }
  else if (key === "play") watchMode.value = value === "watch";
  // 1項目だけのシートは、選んだら閉じる。
  if ((entryPickerConfig.value?.sections.length ?? 0) <= 1) entryPicker.value = "";
}
/** 推しの棋士のいまの段(帯に小さく出す)。 */
const oshiStep = computed(() => (props.oshi && props.view ? oshiStepText(oshiSeasonStatus(seasonView.value, props.oshi.id), props.oshi.name) : ""));
const cheerSays = computed(() => {
  const lines: string[] = [];
  if (props.oshi) lines.push(oshiSeasonLine(oshiSeasonStatus(seasonView.value, props.oshi.id), props.oshi.name));
  if (prediction.value?.season === props.view?.title) lines.push(predictionLine(prediction.value!, predictionResult.value));
  return lines;
});
/** 解説の表情を決めるための、セリフの文字列。 */
const commentarySays = computed(() => (props.view?.stats.commentary ?? []).map((line) => `${line.title} ${line.text}`));

function enter() {
  emit("enter", {
    difficulty: difficulty.value, scale: scale.value, revival: revival.value,
    coachLevel: coachLevel.value, hintLimit: hintLimit.value, undoLimit: undoLimit.value, byoyomi: byoyomi.value, watch: watchMode.value,
  });
  reEntry.value = false;
  viewStage.value = null;
  groupChoice.value = null;
  settingsOpen.value = false;
  screen.value = "season";
}
// ---- 表彰式と賞状帳(docs/season-award-design.md)
/** 開いている賞状。表彰式(期の結果から)なら、閉じると期を見終えて大会の選択へ。 */
const awardShown = ref<SeasonAwardData | null>(null);
const awardCeremony = ref(false);
const bookOpen = ref(false);
/** 期の結果の「表彰式へ」。賞状がなければ(保存できない環境など)、そのまま大会の選択へ。 */
function openCeremony(id: string) {
  const award = props.awards.find((item) => item.id === id) ?? null;
  if (!award) {
    finishCeremony();
    return;
  }
  awardShown.value = award;
  awardCeremony.value = true;
}
function openBookAward(award: SeasonAwardData) {
  awardShown.value = award;
  awardCeremony.value = false;
}
function finishAward() {
  const ceremony = awardCeremony.value;
  awardShown.value = null;
  awardCeremony.value = false;
  if (ceremony) finishCeremony();
}
/** 表彰式を終えた。期の結果は見終えたことにして、大会の選択へ(次の期は、そこから自分で選ぶ)。 */
function finishCeremony() {
  // 研修会の修了証は、受け取ったあとも頂点の画面に戻る(編入するか、終えるかを選ぶ)。
  if (screen.value === "kenshukai") return;
  if (screen.value === "shoreikai") {
    // 四段の免状を受け取ったら、挑戦を終えて(経歴に残して)大会の選択へ。
    emit("shoreikai-close");
    screen.value = "select";
    return;
  }
  if (screen.value === "meijin") {
    emit("meijin-result-seen");
    screen.value = "select";
    return;
  }
  backToSelect();
}

// ---- トーナメント表: 期の画面の「表」で重ねて開く。
const tableOpen = ref(false);
// 次の一局が変わったら、開いていた表とくわしい情報を閉じる。
watch(() => props.view?.pending?.label, () => {
  tableOpen.value = false;
  sheet.value = "";
  viewStage.value = null;
  groupChoice.value = null;
});

// ---- 3つの段階(docs/ryuo-stages-design.md)
/** PCの配置(幅1200px以上の横長。CSSの同じ条件と合わせる)。地図を横長にして、表の上に置く。 */
const PC_WIDE_QUERY = "(min-width: 1200px) and (min-aspect-ratio: 4/3)";
const pcWideList = typeof matchMedia === "function" ? matchMedia(PC_WIDE_QUERY) : null;
const pcWide = ref(Boolean(pcWideList?.matches));
const syncPcWide = () => { pcWide.value = Boolean(pcWideList?.matches); };
onMounted(() => pcWideList?.addEventListener("change", syncPcWide));
onBeforeUnmount(() => pcWideList?.removeEventListener("change", syncPcWide));
const stages = computed(() => props.view?.stages ?? null);
/** 見ている段階。nullなら、いまの段階。段階の道のりを押すと替わる。 */
const viewStage = ref<number | null>(null);
const viewStageIndex = computed(() => viewStage.value ?? stages.value?.current ?? 0);
const viewedStage = computed(() => stages.value?.stages[viewStageIndex.value] ?? null);
/** 段階の道のりを押したとき。狭い画面では、地図から表に切り替える。 */
function showStage(index: number) {
  viewStage.value = index === stages.value?.current ? null : index;
  tableOpen.value = true;
}
/** ①で見る表(ランキング戦・昇級者決定戦・ほかの組)。選んでいなければ、いま指している表。 */
const groupChoice = ref<string | null>(null);
const groupTable = computed(() => {
  const tables = stages.value?.group ?? [];
  const chosen = tables.find(({ key }) => key === groupChoice.value);
  if (chosen) return chosen;
  const pending = props.view?.pending as { phase?: string; blockIndex?: number } | null | undefined;
  if (pending?.phase === "revival") return tables.find(({ key }) => key === `revival-${pending.blockIndex ?? 0}`) ?? tables[0] ?? null;
  return tables.find(({ key }) => key === "ranking") ?? tables[0] ?? null;
});
/** 段階の見出しの一言(その段階で何を目指すか)。 */
const stageNote = computed(() => {
  const data = stages.value;
  if (!data) return "";
  const { rule } = data;
  const defense = props.view?.mode === "defense";
  if (viewStageIndex.value === 0) {
    if (defense) return "竜王は出ない。各組の上位が、決勝トーナメントに進む。";
    const move = rule.group === 1 ? "" : `上位${rule.promote}名は${rule.group - 1}組へ昇級。`;
    const slots = rule.group === 1 ? `上位${rule.slots}名が決勝トーナメントへ。` : rule.slots > 1 ? `上位${rule.slots}名が決勝トーナメントへ。` : "優勝で決勝トーナメントへ。";
    return `${rule.group}組の${rule.size}名のトーナメント。${slots}${move}`;
  }
  if (viewStageIndex.value === 1) {
    const final = data.final;
    if (final.preview && final.hopeLabel && final.hopeWins !== null) {
      return `各組の上位${rule.entrants}名のトーナメント(まだ組み合わせの枠だけ)。${final.hopeLabel}なら、挑戦者決定三番勝負まで${final.hopeWins}勝。`;
    }
    return `各組の上位${rule.entrants}名のトーナメント。上の組ほどシードで有利。勝ち抜くと挑戦者決定三番勝負へ。`;
  }
  return defense
    ? "挑戦者決定三番勝負の勝者が、竜王のあなたに七番勝負で挑む。先に4勝した方が竜王。"
    : "挑戦者決定三番勝負(先に2勝)で挑戦権を取り、竜王と七番勝負(先に4勝)。";
});
/** 上の帯の見出し(例: 第3期 竜王戦)。 */
const seasonHeading = computed(() => (props.view?.title ?? "").replace(/^(第\d+期)/, "$1 "));
/** 「対局する」の文字。番勝負では「第3局を指す」。 */
const playText = computed(() => {
  const pending = props.view?.pending;
  if (props.spectating) return pending && pending.kind !== "game" ? `第${pending.gameNo}局を観戦` : "観戦する";
  return pending && pending.kind !== "game" ? `第${pending.gameNo}局を指す` : "対局する";
});

// ---- 結果
const outcomeHeadline = computed(() => (props.view?.result ? outcomeText(props.view.result.outcome) : ""));
const outcomeDetail = computed(() => {
  const result = props.view?.result;
  if (!result) return "";
  const record = `${result.wins}勝${result.losses}敗`;
  if (result.outcome === "champion") return `${record}。竜王になりました。次の期は防衛戦です。`;
  if (result.outcome === "defense-lost") return `${record}。竜王の座を明け渡し、次の期は1組から挑戦します。`;
  const move = result.promoted ? `${result.startGroup}組から${result.newGroup}組へ昇級。`
    : result.relegated ? `${result.startGroup}組から${result.newGroup}組へ降級。`
      : result.newGroup === 1 && result.startGroup > 1 ? "挑戦者になったので、次の期は1組です。"
        : `次の期も${result.newGroup}組です。`;
  const standing = result.standing ? `組の最終順位は${result.standing}位。` : "";
  return `${record}。${standing}${move}`;
});
/** 組の動き。結果の画面に「6組 → 5組 昇級」のように大きく出す。 */
const groupMove = computed(() => {
  const view = props.view;
  const result = view?.result;
  if (!view || !result) return { from: "", to: "", label: "", kind: "stay" };
  const from = view.mode === "defense" ? "竜王" : `${result.startGroup}組`;
  if (result.outcome === "champion") return { from, to: "竜王", label: view.mode === "defense" ? "防衛" : "竜王獲得", kind: "crown" };
  const to = `${result.newGroup}組`;
  if (result.outcome === "defense-lost") return { from, to, label: "失冠", kind: "down" };
  if (result.promoted || result.newGroup < result.startGroup) return { from, to, label: "昇級", kind: "up" };
  if (result.relegated) return { from, to, label: "降級", kind: "down" };
  return { from, to, label: "残留", kind: "stay" };
});
const stats = computed(() => props.view!.stats.summary);
const percent = (ratio: number | null) => (ratio === null ? "—" : `${Math.round(ratio * 100)}%`);
const tally = ({ games, wins }: { games: number; wins: number }) => (games ? `${wins}勝${games - wins}敗` : "—");
/** 統計を、数字の大きなタイルにする。解析が済んだ局があるときだけ、指し手の質を出す。 */
const statTiles = computed(() => {
  const s = stats.value;
  const tiles: { label: string; value: string; note?: string }[] = [
    { label: "戦績", value: `${s.wins}勝${s.losses}敗`, note: `${s.games}局` },
    { label: "勝率", value: percent(s.winRate) },
    { label: "最長連勝", value: `${s.longestWinStreak}連勝` },
    { label: "先手", value: tally(s.black) },
    { label: "後手", value: tally(s.white) },
    { label: "対居飛車", value: tally(s.vsStatic) },
    { label: "対振り飛車", value: tally(s.vsRanging) },
  ];
  if (s.analyzed) {
    tiles.push(
      { label: "平均損失", value: String(s.averageLoss ?? "—"), note: `${s.moves}手を測定` },
      { label: "悪手", value: `${s.kinds.blunder + s.kinds.mistake}`, note: `大悪手${s.kinds.blunder}・疑問手${s.kinds.dubious}` },
      { label: "好手", value: `${s.kinds.good + s.kinds.brilliant}`, note: `神の一手${s.kinds.brilliant}` },
      { label: "大きな損", value: percent(s.bigRate), note: "損失300以上の割合" },
    );
  }
  if (s.averagePlies) tiles.push({ label: "平均手数", value: `${s.averagePlies}手` });
  return tiles;
});
</script>

<style>
/*
 * 竜王戦の画面。
 *   色: ドット絵のやこび姫と同じ、紺の地・スレートの面・クリームの文字・橙の強調・ラベンダーの差し色。
 *       グラデーションと光る影は使わず、平らな面と角の立った枠、ずらした影にする。
 *       竜王戦の朱(--tr-red)は、竜王の印(帯の「竜」と七番勝負の札)だけに使う。
 *   ボタンと入力の寸法をそろえる。
 *     --tr-control: 選択肢のボタン・セレクト・タブの高さ
 *     --tr-action:  大きな操作ボタン(参加・対局開始など)の高さ
 *   選択肢の並びは、グリッドで等分して、幅もそろえる。
 */
/* 色と大きさの変数。大会の選択の上に開く賞状帳(と賞状)でも使う。 */
.shogi-game .shogi-dex.shogi-tournament,
.shogi-game .shogi-tournament-home .shogi-tournament__sheet {
  --tr-control: 2.75rem;
  --tr-action: 3.25rem;
  --tr-gap: 0.5rem;
  --tr-red: #c4604c;
  --tr-gold: #f1a54c;
  --tr-lavender: #d8d0ff;
  --tr-panel: #2c4359;
  --tr-deep: #172632;
  --tr-shadow: #121e29;
  --tr-line: rgba(255, 252, 244, 0.16);
  --tr-mincho: "Yu Mincho", "YuMincho", "Hiragino Mincho ProN", "Noto Serif JP", serif;
}
.shogi-game .shogi-dex.shogi-tournament {
  background: #1e2d3d;
  font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Yu Gothic", "Meiryo", sans-serif;
}
/*
 * 画面の骨組み。ページ全体はスクロールさせず、上から「大会の帯」「中身の欄」「操作の帯」の3段にする。
 * 中身の欄だけが、収まらないときに中でスクロールする。広い画面では、左右の列がそれぞれ中でスクロールする。
 */
.shogi-game .shogi-tournament__body {
  flex: 1;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 0.7rem;
  width: min(100%, 80rem);
  min-height: 0;
  margin: 0 auto;
  box-sizing: border-box;
  overflow: hidden;
  padding: 0.7rem clamp(0.6rem, 2vw, 1.5rem) max(0.7rem, env(safe-area-inset-bottom));
  font-size: var(--dex-text);
}
.shogi-game .shogi-tournament__main {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
@media (min-width: 900px) {
  .shogi-game .shogi-tournament__body {
    font-size: clamp(15px, min(1.15vw, 2vh), 24px);
    width: min(100%, 78em);
  }
}

/* ---- 相手のくわしい情報(折りたたみ) */
.shogi-game .shogi-tournament__profile-box summary {
  padding: 0.4rem 0.2rem;
  color: rgba(255, 252, 244, 0.8);
  font-size: 0.9em;
  font-weight: 700;
  cursor: pointer;
}
.shogi-game .shogi-tournament__seal {
  grid-area: seal;
  display: grid;
  place-items: center;
  width: 2.8em;
  height: 2.8em;
  border: 2px solid #fffcf4;
  border-radius: 0.4rem;
  color: #fffcf4;
  background: var(--tr-red);
  box-shadow: 3px 3px 0 var(--tr-shadow);
  font-family: var(--tr-mincho);
  font-size: 1.5em;
  font-weight: 800;
  line-height: 1;
}

/* ---- カード */
.shogi-game .shogi-tournament__card {
  display: grid;
  gap: 0.8rem;
  align-content: start;
  min-width: 0;
  padding: 1rem 1.1rem;
  border: 2px solid #3b5570;
  border-radius: 0.8rem;
  background: var(--tr-panel);
}
.shogi-game .shogi-tournament__card h2 {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem 0.6rem;
  margin: 0;
  color: var(--tr-gold);
  font-size: 0.95em;
  letter-spacing: 0.12em;
}
.shogi-game .shogi-tournament__card h2::before {
  content: "";
  width: 0.5rem;
  height: 0.5rem;
  background: var(--tr-gold);
}
.shogi-game .shogi-tournament__text { margin: 0; line-height: 1.7; }
.shogi-game .shogi-tournament__lead { margin: 0; font-size: 1.2em; font-weight: 800; }
.shogi-game .shogi-tournament__hint { margin: 0; color: rgba(255, 252, 244, 0.7); font-size: 0.85em; line-height: 1.6; }

/* ---- やこび姫(解説役) */
.shogi-game .shogi-tournament__coach {
  display: grid;
  align-content: start;
  gap: 0.9rem;
  min-width: 0;
  padding: 1.1rem;
  border: 2px solid var(--tr-lavender);
  border-radius: 0.8rem;
  background: var(--tr-panel);
}
.shogi-game .shogi-tournament__coach .yakobi-says { padding-bottom: 0.5rem; }
.shogi-game .shogi-tournament__pager {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 5rem minmax(0, 1fr);
  align-items: center;
  gap: var(--tr-gap);
  text-align: center;
  font-weight: 700;
}
.shogi-game .shogi-tournament__pager--single { grid-template-columns: minmax(0, 1fr); }
.shogi-game .shogi-tournament__pager button:disabled { opacity: 0.35; cursor: default; }
.shogi-game .shogi-tournament__result-talk { display: grid; gap: 0.45rem; padding: 0.8rem 1rem; }
.shogi-game .shogi-tournament__result-talk p { margin: 0; }
.shogi-game .shogi-tournament__chapters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin: 0;
  padding: 0.9rem 0 0;
  border-top: 1px solid var(--tr-line);
  list-style: none;
}
.shogi-game .shogi-tournament__chapters button {
  box-sizing: border-box;
  min-height: 2.2rem;
  padding: 0.2rem 0.8rem;
  border: 1px solid rgba(255, 252, 244, 0.25);
  border-radius: 999px;
  color: rgba(255, 252, 244, 0.85);
  background: var(--tr-deep);
  font: inherit;
  font-size: 0.9em;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
}
.shogi-game .shogi-tournament__chapters button[aria-current="step"] { border-color: var(--tr-gold); color: #172632; background: var(--tr-gold); }
.shogi-game .shogi-tournament__inline-says { display: none; }
@media (max-width: 899px) {
  .shogi-game .shogi-tournament__inline-says { display: block; }
  .shogi-game .shogi-tournament__chapters { display: none; }
}

/* ---- タイル(数字を大きく見せる) */
.shogi-game .shogi-tournament__tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(7.5rem, 1fr));
  gap: var(--tr-gap);
  margin: 0;
}
.shogi-game .shogi-tournament__tiles--three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.shogi-game .shogi-tournament__tiles > div {
  display: grid;
  align-content: start;
  gap: 0.15rem;
  min-width: 0;
  padding: 0.55rem 0.7rem;
  border-radius: 0.15rem;
  background: var(--tr-deep);
}
.shogi-game .shogi-tournament__tiles dt { color: rgba(255, 252, 244, 0.65); font-size: 0.78em; font-weight: 700; }
.shogi-game .shogi-tournament__tiles dd { margin: 0; font-size: 1.35em; font-weight: 800; line-height: 1.25; overflow-wrap: anywhere; }
.shogi-game .shogi-tournament__tiles dd small { margin-left: 0.1rem; font-size: 0.6em; }
.shogi-game .shogi-tournament__tiles dd.shogi-tournament__tile-text { font-size: 1em; }
.shogi-game .shogi-tournament__tile-note { color: var(--tr-gold); font-size: 0.75em; font-weight: 700; }

/* ---- 次の相手の棋風と特徴 */
.shogi-game .shogi-tournament__profile {
  display: grid;
  gap: 0.3rem;
  margin: 0;
  padding: 0.55rem 0.7rem;
  border-radius: 0.15rem;
  background: var(--tr-deep);
}
.shogi-game .shogi-tournament__profile > div {
  display: grid;
  grid-template-columns: 4.5em minmax(0, 1fr);
  gap: 0.6rem;
  align-items: baseline;
}
.shogi-game .shogi-tournament__profile dt { color: rgba(255, 252, 244, 0.65); font-size: 0.78em; font-weight: 700; }
.shogi-game .shogi-tournament__profile dd { margin: 0; font-weight: 700; overflow-wrap: anywhere; }

/* ---- エントリー: 項目名と選択肢を、同じ幅の2列にそろえる */
.shogi-game .shogi-tournament__row {
  display: grid;
  grid-template-columns: 7.5em minmax(0, 1fr);
  align-items: center;
  gap: 0.4rem 0.8rem;
  padding-top: 0.8rem;
  border-top: 1px solid var(--tr-line);
}
.shogi-game .shogi-tournament__row-label { font-weight: 800; }
.shogi-game .shogi-tournament__row-meta { grid-column: 2; margin: 0; color: rgba(255, 252, 244, 0.72); font-size: 0.82em; }
.shogi-game .shogi-tournament__row-meta strong { color: var(--tr-gold); }
.shogi-game .shogi-tournament__choices { display: grid; gap: var(--tr-gap); }
.shogi-game .shogi-tournament__choices--ten { grid-template-columns: repeat(14, minmax(0, 1fr)); }
.shogi-game .shogi-tournament__choices--five { grid-template-columns: repeat(5, minmax(0, 1fr)); }
.shogi-game .shogi-tournament__choices--three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.shogi-game .shogi-tournament__choices--two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.shogi-game .shogi-tournament__choices button,
.shogi-game .shogi-tournament__tabs button,
.shogi-game .shogi-tournament__pager button {
  box-sizing: border-box;
  min-width: 0;
  height: var(--tr-control);
  padding: 0 0.3rem;
  border: 2px solid rgba(255, 252, 244, 0.4);
  border-radius: 0.2rem;
  color: #fffcf4;
  background: var(--tr-deep);
  font: inherit;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
}
.shogi-game .shogi-tournament__choices button[aria-checked="true"],
.shogi-game .shogi-tournament__tabs button[aria-selected="true"] {
  border-color: #f1a54c;
  color: #172632;
  background: #f1a54c;
  font-weight: 800;
}
.shogi-game .shogi-tournament__choices button.shogi-tournament__recommended { border-style: dashed; border-color: #f1a54c; }
.shogi-game .shogi-tournament__selects { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--tr-gap); }
.shogi-game .shogi-tournament__select {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.5rem;
  font-weight: 700;
}
.shogi-game .shogi-tournament__select select {
  box-sizing: border-box;
  width: 100%;
  height: var(--tr-control);
  padding: 0 0.6rem;
  border: 2px solid rgba(255, 252, 244, 0.4);
  border-radius: 0.2rem;
  color: #fffcf4;
  background: var(--tr-deep);
  font: inherit;
}

/* 大きな操作ボタンは、すべて同じ高さと幅(列いっぱい)にする */
.shogi-game .shogi-tournament__actions { display: grid; gap: var(--tr-gap); }
.shogi-game .shogi-tournament__actions--two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.shogi-game .shogi-tournament__start,
.shogi-game .shogi-tournament__sub {
  box-sizing: border-box;
  display: block;
  width: 100%;
  height: var(--tr-action);
  padding: 0 1rem;
  border-radius: 0.7rem;
  font: inherit;
  font-size: 1.05em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}
.shogi-game .shogi-tournament__start {
  border: 2px solid #f1a54c;
  color: #172632;
  background: #f1a54c;
  font-weight: 800;
  box-shadow: 0 0.25rem 0 #b06a1c;
}
/* 中断した対局の再開。何手目までかを、ボタンの中の2行目に小さく出す。 */
.shogi-game .shogi-tournament__start--resume { display: grid; place-content: center; gap: 0.15rem; line-height: 1.2; }
.shogi-game .shogi-tournament__start--resume small { font-size: 0.62em; font-weight: 700; }
.shogi-game .shogi-tournament__sub { border: 2px solid rgba(255, 252, 244, 0.55); color: #fffcf4; background: transparent; font-weight: 700; }
/* 指を置いたままでも(全体のボタンの:hoverより優先して)、主役・脇役・選んだ項目の色を保つ。 */
.shogi-game .shogi-tournament__start:not(:disabled):hover { border-color: #f6bb6e; color: #172632; background: #f6bb6e; }
.shogi-game .shogi-tournament__sub:not(:disabled):hover { border-color: #f1a54c; color: #fffcf4; background: rgba(255, 252, 244, 0.08); }
.shogi-game .shogi-tournament__choices button[aria-checked="true"]:hover,
.shogi-game .shogi-tournament__tabs button[aria-selected="true"]:hover,
.shogi-game .shogi-tournament__chapters button[aria-current="step"]:hover { border-color: #f1a54c; color: #172632; background: #f1a54c; }
/* ライバル(天鷺羽音)の札と一言。色は羽音の目の黄色(升の強調ではないので、盤の色の決まりの対象外)。 */
.shogi-game .shogi-tournament__rival-tag {
  padding: 0 0.5rem;
  color: #1e2d3d;
  background: #d4a93a;
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.08em;
}
.shogi-game .shogi-tournament__rival-says { margin-top: 0.6rem; }
.shogi-game .shogi-tournament__rival-after { padding-bottom: 0.9rem; }
.shogi-game .shogi-tournament__predict { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.shogi-game .shogi-tournament__predict select {
  flex: 1 1 10rem;
  min-height: 2.6rem;
  padding: 0 0.6rem;
  border: 2px solid #3b5570;
  border-radius: 0.4rem;
  color: #fffcf4;
  background: #172632;
  font: inherit;
}
.shogi-game .shogi-tournament__series { display: grid; gap: 0.4rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .shogi-tournament__series li {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 0.6rem;
  padding: 0.4rem 0.6rem;
  border-radius: 0.15rem;
  background: var(--tr-deep);
}
.shogi-game .shogi-tournament__series-label { color: rgba(255, 252, 244, 0.7); font-size: 0.85em; }
.shogi-game .shogi-tournament__series-name { font-weight: 700; text-align: center; overflow-wrap: anywhere; }
.shogi-game .shogi-tournament__series-score { color: var(--tr-gold); font-size: 1.15em; white-space: nowrap; }
.shogi-game .shogi-tournament__tabs { display: flex; flex-wrap: wrap; gap: var(--tr-gap); }
.shogi-game .shogi-tournament__tabs button { min-width: 10rem; padding: 0 1rem; }
@media (min-width: 760px) {
  .shogi-game .shogi-tournament__path { grid-column: 1 / -1; }
}
.shogi-game .shogi-tournament__eyebrow { margin: 0; color: var(--tr-gold); font-weight: 800; letter-spacing: 0.12em; }
.shogi-game .shogi-tournament__headline {
  margin: 0;
  font-family: var(--tr-mincho);
  font-size: clamp(1.7rem, 1.1rem + 2vw, 2.8rem);
  font-weight: 800;
  line-height: 1.2;
}
.shogi-game .shogi-tournament__path {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
  gap: var(--tr-gap);
  margin: 0;
  padding: 0;
  list-style: none;
}
.shogi-game .shogi-tournament__path li {
  display: grid;
  gap: 0.15rem;
  padding: 0.5rem 0.7rem;
  border-left: 3px solid var(--tr-gold);
  border-radius: 0.15rem;
  background: var(--tr-deep);
}
.shogi-game .shogi-tournament__path li span { color: rgba(255, 252, 244, 0.7); font-size: 0.82em; }
.shogi-game .shogi-tournament__titles { display: flex; flex-wrap: wrap; gap: var(--tr-gap); margin: 0.2rem 0 0; padding: 0; list-style: none; }
.shogi-game .shogi-tournament__titles li {
  display: grid;
  gap: 0.05rem;
  padding: 0.4rem 0.9rem;
  border-radius: 0.15rem;
  color: #172632;
  background: var(--tr-gold);
  box-shadow: 3px 3px 0 var(--tr-shadow);
}
.shogi-game .shogi-tournament__titles small { font-size: 0.75em; }
.shogi-game .shogi-tournament__radar { justify-items: center; }
.shogi-game .shogi-tournament__radar h2 { justify-self: start; }

/* 狭い画面: 項目名を選択肢の上に置き、10段階の難易度は5つずつ2段にする */
@media (max-width: 600px) {
  .shogi-game .shogi-tournament__seal { width: 2.8rem; height: 2.8rem; font-size: 1.5rem; }
  .shogi-game .shogi-tournament__row { grid-template-columns: minmax(0, 1fr); }
  .shogi-game .shogi-tournament__row-meta { grid-column: 1; }
  .shogi-game .shogi-tournament__choices--ten { grid-template-columns: repeat(7, minmax(0, 1fr)); }
  .shogi-game .shogi-tournament__choices--five button { padding: 0; }
  .shogi-game .shogi-tournament__actions--two { grid-template-columns: minmax(0, 1fr); }
  .shogi-game .shogi-tournament__tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .shogi-game .shogi-tournament__tiles--three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .shogi-game .shogi-tournament__series li { grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); }
  .shogi-game .shogi-tournament__series-label { grid-column: 1 / -1; }
  .shogi-game .shogi-tournament__tabs button { min-width: 0; flex: 1 1 calc(50% - var(--tr-gap)); }
}

/* 大会の選択。タイトル戦の2枚は同じ大きさで横並びにする。記録と準備中の大会は別の段。 */
.shogi-game .shogi-tournament-home .shogi-tournament__title-tiles,
.shogi-game .shogi-tournament-home .shogi-tournament__soon-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.shogi-game .shogi-tournament-home .shogi-title__tile:disabled { opacity: 0.55; box-shadow: none; }
/* 左上の戻るボタンと、タイトルが重ならないよう、上を空ける。 */
.shogi-game .shogi-home.shogi-home--title.shogi-tournament-home { padding-top: max(4rem, env(safe-area-inset-top)); }
.shogi-game .shogi-tournament-home .shogi-title__logo {
  font-family: var(--tr-mincho, "Yu Mincho", "Hiragino Mincho ProN", serif);
  letter-spacing: 0.12em;
}
.shogi-game .shogi-tournament__home-back {
  position: absolute;
  top: 0.8rem;
  left: 0.8rem;
  z-index: 1;
}
/* 背の低いスマホの縦向き: 対局のカードを詰める。 */
@media (max-width: 899px) and (orientation: portrait) and (max-height: 700px) {
  .shogi-game .shogi-tournament__card { padding-block: 0.6rem; }
}

/* ---- エントリー設定の行(対局準備と同じ「項目: 値 [変更]」)。行のどこを押しても選択シートを開く。 */
.shogi-game .shogi-tournament__settings {
  display: grid;
  gap: 0.45rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.shogi-game .shogi-tournament__setting {
  display: grid;
  grid-template-columns: minmax(6.5em, auto) minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  min-height: 3rem;
  padding: 0.45rem 0.7rem;
  border: 1px solid rgba(255, 252, 244, 0.25);
  border-radius: 0.6rem;
  color: #fffcf4;
  background: var(--tr-deep);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.shogi-game .shogi-tournament__setting-label {
  color: rgba(255, 252, 244, 0.75);
  font-size: 0.88em;
  font-weight: 700;
}
.shogi-game .shogi-tournament__setting-value {
  display: grid;
  min-width: 0;
  font-weight: 800;
}
.shogi-game .shogi-tournament__setting-value small {
  overflow: hidden;
  color: rgba(255, 252, 244, 0.65);
  font-size: 0.78em;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 難易度の行の強さの山は、竜王とあなたのLvまで見えないと意味がないので、折り返す。 */
.shogi-game .shogi-tournament__setting[data-entry-row="difficulty"] .shogi-tournament__setting-value small {
  white-space: normal;
}
.shogi-game .shogi-tournament__setting-change {
  padding: 0.2rem 0.7rem;
  border-radius: 999px;
  color: #172632;
  background: var(--tr-gold);
  font-size: 0.82em;
  font-weight: 800;
}
/*
 * 背の低い横長の画面(スマホの横向き)。上下に帯を積むと中身が入らないので、
 * 大会の帯と操作の帯を左の列に、中身を右の列に置く。道のりは省き、カードは詰める。
 */
@media (max-height: 500px) and (orientation: landscape) {
  .shogi-game .shogi-tournament__body {
    grid-template-columns: minmax(12rem, 30%) minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
    grid-template-areas: "banner main" "action main";
    gap: 0.5rem 0.7rem;
    padding-top: 0.45rem;
    padding-bottom: max(0.45rem, env(safe-area-inset-bottom));
  }
  .shogi-game .shogi-tournament__main { grid-area: main; }
  .shogi-game .shogi-tournament__card { padding: 0.55rem 0.7rem; }
  .shogi-game .shogi-tournament__setting { min-height: 2.4rem; padding: 0.25rem 0.6rem; }
  .shogi-game .shogi-tournament__settings { gap: 0.3rem; }
  .shogi-game .shogi-tournament__coach img { max-height: 8rem; width: auto; }
}
.shogi-game .shogi-tournament__goal {
  margin: 0;
  color: #fffcf4;
  font-size: 1.2em;
  font-weight: 800;
  line-height: 1.5;
}
.shogi-game .shogi-tournament__entry-settings {
  display: flex;
  align-items: center;
  gap: var(--tr-gap);
  padding: 0.5rem 0.5rem 0.5rem 0.8rem;
  border-radius: 0.6rem;
  background: var(--tr-deep);
}
.shogi-game .shogi-tournament__entry-settings p { display: grid; flex: 1 1 auto; gap: 0.1rem; min-width: 0; margin: 0; font-weight: 700; }
.shogi-game .shogi-tournament__entry-settings small { color: rgba(255, 252, 244, 0.65); font-size: 0.78em; }
.shogi-game .shogi-tournament__entry-settings .shogi-tournament__sub,
.shogi-game .shogi-tournament__tip .shogi-tournament__sub {
  flex: 0 0 auto;
  width: auto;
  height: var(--tr-control);
  font-size: 0.92em;
}
.shogi-game .shogi-tournament__about {
  justify-self: center;
  min-height: var(--tr-control);
  padding: 0 0.8rem;
  border: 0;
  color: var(--tr-lavender);
  background: transparent;
  font: inherit;
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 0.2em;
  cursor: pointer;
}
/* 竜王戦の説明のシート。入口の上に重ねる。 */
.shogi-game .shogi-tournament__sheet {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: grid;
  place-items: center;
  padding: max(0.8rem, env(safe-area-inset-top)) 0.8rem max(0.8rem, env(safe-area-inset-bottom));
  background: rgba(10, 18, 26, 0.72);
}
.shogi-game .shogi-tournament__sheet-panel {
  box-sizing: border-box;
  width: min(100%, 40rem);
  max-height: 100%;
  overflow-y: auto;
  box-shadow: 0 6px 0 var(--tr-shadow);
}
/* 賞状帳の行。左の小さな判子の色は賞状の格(金・銀・朱・敢闘は灰青)。 */
.shogi-game .shogi-tournament__awards { display: grid; gap: 0.4rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .shogi-tournament__award-row {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  width: 100%;
  min-height: 52px;
  padding: 0.4rem 0.7rem;
  border: 2px solid #33465e;
  border-radius: 0.6rem;
  color: #fffcf4;
  background: #172632;
  box-shadow: none;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.shogi-game .shogi-tournament__award-seal {
  flex: none;
  display: grid;
  place-items: center;
  width: 2.2rem;
  height: 2.2rem;
  border: 2px solid #fffcf4;
  border-radius: 0.3rem;
  background: #5d6f80;
  font-family: var(--tr-mincho);
  font-weight: 900;
}
.shogi-game .shogi-tournament__award-seal--gold { background: #c9962e; }
.shogi-game .shogi-tournament__award-seal--silver { background: #8c98a6; }
.shogi-game .shogi-tournament__award-seal--red { background: var(--tr-red); }
.shogi-game .shogi-tournament__award-text { display: grid; gap: 0.1rem; min-width: 0; font-weight: 900; }
.shogi-game .shogi-tournament__award-text small { color: #9fb3c8; font-size: 0.8em; font-weight: 800; }
.shogi-game .shogi-tournament__arrival { margin: 0; color: rgba(255, 252, 244, 0.8); font-size: 0.85em; font-weight: 700; text-align: center; }

/* この一局に賭けているもの。勝てば(金)・負ければ(灰)を並べ、目標まであと何勝を上に1行。 */
.shogi-game .shogi-tournament__stakes { display: grid; gap: 0.45rem; }
.shogi-game .shogi-tournament__stakes-goal { margin: 0; color: var(--tr-lavender); font-weight: 800; text-align: center; }
.shogi-game .shogi-tournament__stakes dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--tr-gap); margin: 0; }
.shogi-game .shogi-tournament__stakes dl > div {
  display: grid;
  align-content: start;
  gap: 0.1rem;
  min-width: 0;
  padding: 0.45rem 0.7rem;
  border-left: 4px solid rgba(255, 252, 244, 0.35);
  border-radius: 0.2rem;
  background: var(--tr-deep);
}
.shogi-game .shogi-tournament__stakes dt { color: rgba(255, 252, 244, 0.65); font-size: 0.78em; font-weight: 700; }
.shogi-game .shogi-tournament__stakes dd { margin: 0; font-weight: 800; line-height: 1.35; overflow-wrap: anywhere; }
.shogi-game .shogi-tournament__stakes-win { border-left-color: var(--tr-gold) !important; }
.shogi-game .shogi-tournament__stakes-win dd { color: var(--tr-gold); font-size: 1.12em; }
.shogi-game .shogi-tournament__stakes-lose dd { color: rgba(255, 252, 244, 0.78); }
.shogi-game .shogi-tournament__boss-tag {
  padding: 0.05rem 0.6rem;
  border-radius: 0.15rem;
  color: #fffcf4;
  background: var(--tr-red);
  letter-spacing: 0.15em;
}

/* やこび姫の作戦の手がかり(1行)と「もっと聞く」。 */
.shogi-game .shogi-tournament__tip { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: var(--tr-gap); }

/* 期の結果の、次の期の目標。 */
.shogi-game .shogi-tournament__next-goal {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.2rem 0.7rem;
  margin: 0;
  padding: 0.5rem 0.8rem;
  border-left: 3px solid var(--tr-lavender);
  border-radius: 0.15rem;
  background: var(--tr-deep);
  font-weight: 700;
}
.shogi-game .shogi-tournament__next-goal small { color: var(--tr-lavender); font-weight: 800; }
@media (min-width: 760px) {
  .shogi-game .shogi-tournament__next-goal { grid-column: 1 / -1; }
}

/* ===== 竜王戦の節目(docs/ryuo-ux-redesign.mdの段階3) ===== */
/* 節目の札。画面の上の方に浮かべ、下の操作の帯は覆わない。押すと閉じる。 */
.shogi-game .shogi-tournament__milestone {
  position: fixed;
  top: 28%;
  left: 50%;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 1rem;
  width: max-content;
  max-width: calc(100vw - 2rem);
  padding: 0.9rem 1.4rem 0.9rem 1rem;
  border: 3px solid var(--tr-gold);
  border-radius: 0.9rem;
  color: #fffcf4;
  background: var(--tr-deep);
  box-shadow: 0 6px 0 var(--tr-shadow), 0 0 0 100vmax rgba(10, 18, 26, 0.35);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transform: translateX(-50%);
  animation: tr-milestone-in 200ms ease-out 350ms both;
}
.shogi-game .shogi-tournament__milestone:hover { color: #fffcf4; background: var(--tr-deep); }
.shogi-game .shogi-tournament__milestone-seal {
  flex: none;
  display: grid;
  place-items: center;
  width: 4.2rem;
  height: 4.2rem;
  border: 3px solid #fffcf4;
  border-radius: 0.5rem;
  color: #fffcf4;
  background: var(--tr-red);
  font-family: var(--tr-mincho);
  font-size: 1.45rem;
  font-weight: 900;
  line-height: 1;
  transform: rotate(-6deg);
  animation: tr-stamp 260ms cubic-bezier(0.2, 0.9, 0.3, 1.2) 450ms both;
}
.shogi-game .shogi-tournament__milestone-text { display: grid; gap: 0.2rem; }
.shogi-game .shogi-tournament__milestone-text strong { font-family: var(--tr-mincho); font-size: 1.5em; font-weight: 800; line-height: 1.25; }
.shogi-game .shogi-tournament__milestone-text small { color: var(--tr-gold); font-size: 0.95em; font-weight: 800; }
/* 重さ: 中(突破・残留)は小さく、最大(竜王)は金の判子。 */
.shogi-game .shogi-tournament__milestone--mid { border-color: rgba(255, 252, 244, 0.6); }
.shogi-game .shogi-tournament__milestone--mid .shogi-tournament__milestone-seal { width: 3.4rem; height: 3.4rem; font-size: 1.15rem; }
.shogi-game .shogi-tournament__milestone--mid .shogi-tournament__milestone-text strong { font-size: 1.25em; }
.shogi-game .shogi-tournament__milestone--max .shogi-tournament__milestone-seal { width: 5rem; height: 5rem; color: #172632; background: var(--tr-gold); font-size: 1.8rem; }
@keyframes tr-milestone-in {
  from { opacity: 0; transform: translateX(-50%) translateY(0.6rem); }
  to { opacity: 1; transform: translateX(-50%); }
}
@keyframes tr-stamp {
  0% { opacity: 0; transform: scale(2.4) rotate(-14deg); }
  70% { opacity: 1; transform: scale(0.92) rotate(-5deg); }
  100% { opacity: 1; transform: scale(1) rotate(-6deg); }
}
@keyframes tr-stamp-flat {
  0% { opacity: 0; transform: scale(2.4); }
  70% { opacity: 1; transform: scale(0.92); }
  100% { opacity: 1; transform: scale(1); }
}
/* 期のできたこと。 */
.shogi-game .shogi-tournament__best { grid-column: 1 / -1; margin: 0; color: var(--tr-gold); font-weight: 800; }
/* 大番狂わせの一言。 */
.shogi-game .shogi-tournament__upset {
  margin: 0;
  padding: 0.5rem 0.8rem;
  border-left: 4px solid var(--tr-lavender);
  border-radius: 0.2rem;
  background: var(--tr-panel);
  font-size: 0.9em;
  font-weight: 700;
}
.shogi-game .shogi-tournament__oshi span { margin-right: 0.25rem; color: var(--tr-lavender); }
@media (prefers-reduced-motion: reduce) {
  .shogi-game .shogi-tournament__milestone,
.shogi-game .shogi-tournament__milestone-seal { animation: none; }
}

/* ===== 期の画面: ドット絵の山の地図と、次の一局の枠(docs/ryuo-ui-renewal-design.mdの5-2) ===== */
.shogi-game .shogi-tournament__body.shogi-tournament__body--stage {
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  grid-template-areas: "main";
  width: 100%;
  padding: 0;
  gap: 0;
}
.shogi-game .shogi-tournament__main:has(> .shogi-tournament__stage) { overflow: hidden; }
.shogi-game .shogi-tournament__stage {
  display: grid;
  /* 列は画面の幅に固定する(トーナメント表の横幅で、画面が横に広がらないように)。 */
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr) auto;
  grid-template-areas: "top" "map" "hud";
  height: 100%;
  min-height: 0;
  background: #121c2e;
}
.shogi-game .shogi-tournament__topbar {
  grid-area: top;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.6rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 2px solid #22344c;
  background: #0f1828;
}
/* 期の画面の戻る(上の帯を1本にしたので、ここに置く)。狭い画面では矢印だけ。 */
.shogi-game .shogi-tournament__topbar-back {
  flex: none;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  min-width: 44px;
  min-height: 44px;
  padding: 0 0.8rem;
  border: 2px solid #4b6585;
  border-radius: 999px;
  color: #fffcf4;
  background: transparent;
  box-shadow: none;
  font: inherit;
  font-size: 0.85em;
  font-weight: 800;
  cursor: pointer;
}
.shogi-game .shogi-tournament__topbar-sub { margin: 0.1rem 0 0; overflow: hidden; color: #9fb3c8; font-size: 0.78em; font-weight: 800; text-overflow: ellipsis; white-space: nowrap; }
/* 段階の道のり。済みは緑の✓、いまは琥珀。見ている段階は白い縁。狭い画面では2行目に横いっぱい。 */
.shogi-game .shogi-tournament__steps { order: 5; display: flex; flex: 1 0 100%; align-items: center; gap: 0.3rem; }
.shogi-game .shogi-tournament__step {
  display: flex;
  flex: 1 1 0;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-width: 0;
  min-height: 44px;
  padding: 0 0.6rem;
  border: 2px solid #33465e;
  border-radius: 999px;
  color: #9fb3c8;
  background: transparent;
  box-shadow: none;
  font: inherit;
  font-size: 0.82em;
  font-weight: 900;
  white-space: nowrap;
  cursor: pointer;
}
.shogi-game .shogi-tournament__step i { display: grid; flex: none; place-items: center; width: 1.4rem; height: 1.4rem; border-radius: 50%; color: #fffcf4; background: #2b3d55; font-size: 0.8em; font-style: normal; }
.shogi-game .shogi-tournament__step--done { color: #fffcf4; }
.shogi-game .shogi-tournament__step--done i { background: #3f7d5a; }
.shogi-game .shogi-tournament__step--current { border-color: #f1a54c; color: #172632; background: #f1a54c; box-shadow: 0 3px 0 #b06a1c; }
.shogi-game .shogi-tournament__step--current i { color: #f1a54c; background: #172632; }
.shogi-game .shogi-tournament__step--watch { border-style: dashed; }

/* 次の段階に進んだ直後: いまの段階を3回だけ光らせる(段階の解放。G:2-2)。 */
.shogi-game .shogi-tournament__step--arrived { animation: shogi-tournament-step-arrive 0.7s ease-in-out 3; }
@keyframes shogi-tournament-step-arrive {
  50% { box-shadow: 0 3px 0 #b06a1c, 0 0 0 6px rgba(255, 210, 122, 0.55); transform: scale(1.06); }
}
@media (prefers-reduced-motion: reduce) {
  .shogi-game .shogi-tournament__step--arrived { animation: none; }
}
.shogi-game .shogi-tournament__step--viewing:not(.shogi-tournament__step--current) { border-color: #fffcf4; color: #fffcf4; }
.shogi-game .shogi-tournament__step-long { display: none; overflow: hidden; text-overflow: ellipsis; }
.shogi-game .shogi-tournament__step-link { flex: 0 0 0.6rem; height: 3px; background: repeating-linear-gradient(90deg, #4b6585 0 4px, transparent 4px 7px); }
.shogi-game .shogi-tournament__step-link--done { background: #3f7d5a; }
@media (max-width: 599px) {
  .shogi-game .shogi-tournament__topbar-back-text { display: none; }
  /* スマホ縦: 1行目は戻る・見出し・予想、2行目に段階の道のり。竜の判子は省く。 */
  .shogi-game .shogi-tournament__topbar { padding-block: 0.4rem; }
  .shogi-game .shogi-tournament__topbar .shogi-tournament__seal { display: none; }
  .shogi-game .shogi-tournament__step { padding: 0 0.4rem; font-size: 0.78em; }
}
/* 背の低い横長(スマホ横): 段階の道のりを見出しと同じ行に(短い名前)。 */
@media (max-height: 500px) and (orientation: landscape) {
  .shogi-game .shogi-tournament__topbar { flex-wrap: nowrap; padding-block: 0.3rem; }
  .shogi-game .shogi-tournament__topbar .shogi-tournament__seal,
  .shogi-game .shogi-tournament__topbar-back-text { display: none; }
  .shogi-game .shogi-tournament__steps { order: 0; flex: 1 1 auto; }
}
.shogi-game .shogi-tournament__topbar .shogi-tournament__seal { width: 2.4rem; height: 2.4rem; font-size: 1.2rem; }
.shogi-game .shogi-tournament__topbar-title { flex: 1; min-width: 0; }
.shogi-game .shogi-tournament__topbar-title h1 { margin: 0; overflow: hidden; color: #fffcf4; font-size: 1.05em; font-weight: 900; text-overflow: ellipsis; white-space: nowrap; }
.shogi-game .shogi-tournament__topbar-title .shogi-tournament__oshi { margin: 0.1rem 0 0; overflow: hidden; color: var(--tr-lavender); font-size: 0.78em; font-weight: 800; text-overflow: ellipsis; white-space: nowrap; }
.shogi-game .shogi-tournament__icon-btn {
  flex: none;
  display: grid;
  place-items: center;
  width: var(--tr-control);
  height: var(--tr-control);
  border: 2px solid #4b6585;
  border-radius: 0.6rem;
  color: #fffcf4;
  background: var(--tr-deep);
  box-shadow: 0 3px 0 var(--tr-shadow);
  font: inherit;
  font-weight: 900;
  cursor: pointer;
}
.shogi-game .shogi-tournament__icon-btn--wide { width: auto; padding: 0 0.8rem; color: var(--tr-gold); }
.shogi-game .shogi-tournament__mapwrap { grid-area: map; position: relative; display: grid; min-height: 0; }
.shogi-game .shogi-tournament__mapwrap > .ryuo-mountain { height: 100%; }
/* 地図の上の知らせ(白い吹き出し)。 */
.shogi-game .shogi-tournament__mapnotes {
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  right: 0.5rem;
  display: grid;
  justify-items: start;
  gap: 0.35rem;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.shogi-game .shogi-tournament__mapnote {
  max-width: 26rem;
  margin: 0;
  padding: 0.4rem 0.65rem;
  border-radius: 0.6rem;
  color: #1a2433;
  background: #fffcf4;
  box-shadow: 3px 3px 0 var(--tr-lavender);
  font-size: 0.78em;
  font-weight: 800;
  line-height: 1.45;
}
.shogi-game .shogi-tournament__mapnote.shogi-tournament__upset { border-left: 4px solid var(--tr-red); }
.shogi-game .shogi-tournament__mapnote.shogi-tournament__rival-after { padding: 0.2rem 0.4rem; color: inherit; background: rgba(23, 38, 50, 0.92); box-shadow: 3px 3px 0 #d4a93a; }
/* 次の一局の枠。 */
.shogi-game .shogi-tournament__hud {
  grid-area: hud;
  display: grid;
  /* 行は中身の高さ(ボタンのmin-heightまで縮んで、中身が重ならないように)。 */
  grid-auto-rows: max-content;
  gap: 0.55rem;
  padding: 0.75rem 0.85rem max(0.75rem, env(safe-area-inset-bottom));
  border-top: 3px solid #fffcf4;
  background: var(--tr-deep);
  box-shadow: 0 -4px 0 var(--tr-shadow);
}
.shogi-game .shogi-tournament__hud--boss { border-top-color: var(--tr-red); }
.shogi-game .shogi-tournament__hud-head { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 0.75rem; }
.shogi-game .shogi-tournament__hud-face {
  display: grid;
  place-items: center;
  width: 4rem;
  height: 4rem;
  overflow: hidden;
  padding: 0;
  border: 3px solid #fffcf4;
  border-radius: 0.45rem;
  color: #fffcf4;
  background: #d8d0ff;
  box-shadow: 3px 3px 0 var(--tr-shadow);
  font: inherit;
  cursor: pointer;
}
.shogi-game .shogi-tournament__hud-face img { align-self: start; width: 100%; margin-top: 6%; image-rendering: pixelated; }
.shogi-game .shogi-tournament__hud-face span { display: grid; place-items: center; width: 100%; height: 100%; font-family: var(--tr-mincho); font-size: 2rem; font-weight: 900; }
.shogi-game .shogi-tournament__hud-face--attack { background: var(--tr-red); }
.shogi-game .shogi-tournament__hud-face--defense { background: #3d6fa5; }
.shogi-game .shogi-tournament__hud-face--balance { color: #172632; background: #d9b860; }
.shogi-game .shogi-tournament__hud-info { display: grid; gap: 0.15rem; min-width: 0; }
.shogi-game .shogi-tournament__hud-role { display: flex; flex-wrap: wrap; align-items: center; gap: 0.35rem; margin: 0; color: var(--tr-gold); font-size: 0.8em; font-weight: 800; }
.shogi-game .shogi-tournament__hud-name { margin: 0; color: #fffcf4; font-size: 1.45em; font-weight: 900; line-height: 1.15; overflow-wrap: anywhere; }
.shogi-game .shogi-tournament__hud-name small { font-size: 0.55em; font-weight: 700; }
.shogi-game .shogi-tournament__hud-chips { display: flex; flex-wrap: wrap; gap: 0.3rem; margin: 0.1rem 0 0; }
.shogi-game .shogi-tournament__chip { padding: 0.05rem 0.5rem; border-radius: 999px; color: #fffcf4; background: #55697d; font-size: 0.75em; font-weight: 800; }
.shogi-game .shogi-tournament__chip--rank-up { color: #fff; background: #c0392b; }
.shogi-game .shogi-tournament__chip--rank-down { color: #fff; background: #1f8a4c; }
.shogi-game .shogi-tournament__chip--attack { background: var(--tr-red); }
.shogi-game .shogi-tournament__chip--defense { background: #3d6fa5; }
.shogi-game .shogi-tournament__chip--balance,
.shogi-game .shogi-tournament__chip--best { color: #172632; background: var(--tr-gold); }
.shogi-game .shogi-tournament__hud-score { display: grid; justify-items: center; }
.shogi-game .shogi-tournament__hud-score strong { color: #fffcf4; font-size: 1.9em; font-weight: 900; line-height: 1; white-space: nowrap; }
.shogi-game .shogi-tournament__hud-score i { margin: 0 0.2rem; color: rgba(255, 252, 244, 0.5); font-style: normal; }
.shogi-game .shogi-tournament__hud-score small { color: var(--tr-gold); font-size: 0.75em; font-weight: 800; }
/* 枠の中の勝てば/負ければは、1行ずつの札にして高さを詰める。 */
.shogi-game .shogi-tournament__hud .shogi-tournament__stakes { gap: 0.3rem; }
.shogi-game .shogi-tournament__hud .shogi-tournament__stakes-goal { text-align: left; font-size: 0.8em; }
.shogi-game .shogi-tournament__hud .shogi-tournament__stakes dl > div { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 0.4rem; padding: 0.3rem 0.6rem; }
.shogi-game .shogi-tournament__hud .shogi-tournament__stakes dd { font-size: 0.95em; }
/* やこび姫の1行(2行まで)。行ごと押すと、続きを開く。 */
.shogi-game .shogi-tournament__tip-line {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.55rem;
  width: 100%;
  min-height: 3rem;
  padding: 0.35rem 0.6rem 0.35rem 0.4rem;
  border: 0;
  border-radius: 0.6rem;
  color: #1d303f;
  background: #fffcf4;
  box-shadow: 3px 3px 0 var(--tr-lavender);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.shogi-game .shogi-tournament__tip-face { height: 2.4rem; image-rendering: pixelated; }
.shogi-game .shogi-tournament__tip-text {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  font-size: 0.85em;
  font-weight: 700;
  line-height: 1.45;
}
.shogi-game .shogi-tournament__tip-more { color: #5b3fd1; font-size: 0.78em; font-weight: 900; white-space: nowrap; }
.shogi-game .shogi-tournament__tip-line:hover { background: #fffcf4; }
.shogi-game .shogi-tournament__hud .shogi-tournament__start { box-shadow: 0 0.3rem 0 #b06a1c; font-size: 1.25em; letter-spacing: 0.1em; }
/* くわしい情報のシート。 */
.shogi-game .shogi-tournament__detail { display: grid; gap: 0.8rem; padding: 1rem 1.1rem; border: 2px solid var(--tr-lavender); border-radius: 0.8rem; background: var(--tr-panel); }
.shogi-game .shogi-tournament__detail h2 { margin: 0; color: var(--tr-gold); font-size: 1.1em; }
/*
 * 地図とトーナメント表の切り替え(地図の上の空に浮かべるタブ)。押せる高さは44px以上(U:7-4)。
 * 選んでいる側は白地に濃い文字で、色だけでなく塗りの有無でも分かる。
 */
.shogi-game .shogi-tournament__view-switch {
  grid-area: map;
  z-index: 3;
  align-self: start;
  justify-self: center;
  display: flex;
  gap: 0.25rem;
  margin-top: 0.5rem;
  padding: 0.25rem;
  border: 2px solid #4b6585;
  border-radius: 999px;
  background: rgba(15, 24, 40, 0.92);
  box-shadow: 0 3px 0 var(--tr-shadow);
}
.shogi-game .shogi-tournament__view-switch button {
  min-height: 44px;
  padding: 0 1rem;
  border: 0;
  border-radius: 999px;
  color: #fffcf4;
  background: transparent;
  box-shadow: none;
  font: inherit;
  font-size: 0.9em;
  font-weight: 900;
  white-space: nowrap;
  cursor: pointer;
}
.shogi-game .shogi-tournament__view-switch button[aria-selected="true"] { color: #172632; background: #fffcf4; }
@media (hover: hover) {
  .shogi-game .shogi-tournament__view-switch button:not([aria-selected="true"]):hover { background: rgba(255, 252, 244, 0.14); }
}
/* 知らせの吹き出しは、切り替えのタブの下から出す。 */
.shogi-game .shogi-tournament__stage .shogi-tournament__mapnotes { top: 4rem; }
/* トーナメント表: 狭い画面では、タブで選んだときだけ地図の場所に出す(地図は下で描いたまま)。 */
.shogi-game .shogi-tournament__stage > .shogi-tournament__tables {
  grid-area: map;
  z-index: 2;
  display: none;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  padding: 4.2rem 0.6rem 0.6rem;
  background: #1e2d3d;
}
.shogi-game .shogi-tournament__stage > .shogi-tournament__tables--open { display: flex; }
.shogi-game .shogi-tournament__stage > .shogi-tournament__tables .shogi-tournament__tabs button { min-height: var(--tr-control); }
/* 段階の見出し(「① 6組ランキング戦」と一言)。表は残りの高さいっぱい。 */
.shogi-game .shogi-tournament__stage > .shogi-tournament__tables { container-type: inline-size; }
.shogi-game .shogi-tournament__stagehead h2 { margin: 0; color: #fffcf4; font-size: 1.15em; font-weight: 900; }
.shogi-game .shogi-tournament__stagehead h2 span { margin-right: 0.4rem; color: #f1a54c; }
.shogi-game .shogi-tournament__stagehead p { margin: 0.2rem 0 0; color: #9fb3c8; font-size: 0.8em; line-height: 1.5; }
.shogi-game .shogi-tournament__bracket-tabs { flex-wrap: nowrap; overflow-x: auto; }
.shogi-game .shogi-tournament__bracket-tabs button { flex: none; min-width: 0; padding: 0 0.9rem; white-space: nowrap; }
.shogi-game .shogi-tournament__bracket { flex: 1 1 0; min-height: 0; }
.shogi-game .shogi-tournament__series-view { flex: 1 1 0; min-height: 0; overflow-y: auto; }
.shogi-game .shogi-tournament__stage-empty { margin: 1rem 0; color: #9fb3c8; }
/*
 * 次の一局の枠の、相手の能力。左にレーダーチャートの形、右に8つのランク、下に特殊能力の札。
 * 全体が1つのボタンで、押すとくわしい情報を開く(「くわしく ›」で押せることを示す)。
 */
.shogi-game .shogi-tournament__hud-ability {
  display: grid;
  grid-template-columns: 4.6rem minmax(0, 1fr);
  grid-template-areas: "radar ranks" "specials specials";
  align-items: center;
  gap: 0.3rem 0.6rem;
  padding: 0.4rem 0.6rem;
  border: 2px solid #4b6585;
  border-radius: 0.6rem;
  color: #fffcf4;
  background: rgba(255, 252, 244, 0.06);
  box-shadow: none;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
@media (hover: hover) {
  .shogi-game .shogi-tournament__hud-ability:hover { border-color: var(--tr-gold); background: rgba(255, 252, 244, 0.1); }
}
.shogi-game .shogi-tournament__mini-radar { grid-area: radar; width: 100%; height: auto; }
.shogi-game .shogi-tournament__mini-ranks {
  grid-area: ranks;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.15rem 0.7rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.shogi-game .shogi-tournament__mini-ranks li { display: flex; align-items: center; justify-content: space-between; gap: 0.3rem; min-width: 0; }
.shogi-game .shogi-tournament__mini-ranks span { overflow: hidden; font-size: 0.78em; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.shogi-game .shogi-tournament__mini-ranks b { flex: none; width: 1.55em; height: 1.3em; font-size: 0.85em; }
.shogi-game .shogi-tournament__mini-specials { grid-area: specials; display: flex; flex-wrap: wrap; align-items: center; gap: 0.3rem; }
.shogi-game .shogi-tournament__mini-specials .player-ability__chip { font-size: 0.75em; }
.shogi-game .shogi-tournament__mini-more { margin-left: auto; color: var(--tr-gold); font-size: 0.8em; font-weight: 800; white-space: nowrap; }
.shogi-game .shogi-tournament__chip--opening { color: #172632; background: #c9d6e6; }
/* 相手の得意戦法(使用率)。狭い画面では出さない(地図の高さを残す)。 */
.shogi-game .shogi-tournament__hud-openings { display: none; gap: 0.3rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .shogi-tournament__hud-openings li { display: grid; grid-template-columns: minmax(0, 8.5em) minmax(3rem, 1fr) 2.6em; align-items: center; gap: 0.5rem; color: #fffcf4; font-size: 0.8em; }
.shogi-game .shogi-tournament__hud-openings li > span:first-child { overflow: hidden; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.shogi-game .shogi-tournament__hud-openings b { text-align: right; font-variant-numeric: tabular-nums; }
.shogi-game .shogi-tournament__hud-openings-bar { display: block; height: 0.5rem; overflow: hidden; border-radius: 999px; background: rgba(255, 252, 244, 0.14); }
.shogi-game .shogi-tournament__hud-openings-bar span { display: block; height: 100%; border-radius: 999px; }
.shogi-game .shogi-tournament__hud-openings-fill--static { background: #4d8ac4; }
.shogi-game .shogi-tournament__hud-openings-fill--ranging { background: #c56a5f; }
@media (min-width: 900px) and (min-height: 700px) {
  .shogi-game .shogi-tournament__hud-openings { display: grid; }
}
/*
 * 枠が広いとき(タブレット縦)は、ランクを4列にして低くする。間延びしないよう、列の幅を決めて左に寄せる。
 * 画面の幅ではなく、この欄の幅で決める(広い画面でも、右の列の中では狭い)。
 */
.shogi-game .shogi-tournament__hud[data-pending] { container-type: inline-size; }
@container (min-width: 36rem) {
  .shogi-game .shogi-tournament__mini-ranks { grid-template-columns: repeat(4, minmax(0, 6.5rem)); column-gap: 1.2rem; }
}
/*
 * 縦長の画面で表を見ているときは、表に高さを譲る: 能力の欄とやこび姫の1行をたたむ(相手の名前・札・「対局する」は残す。
 * 地図に戻すと、また出る)。
 */
@media (max-width: 1199px) and (orientation: portrait) {
  .shogi-game .shogi-tournament__stage--table-open .shogi-tournament__hud-ability,
  .shogi-game .shogi-tournament__stage--table-open .shogi-tournament__hud[data-pending] .shogi-tournament__tip-line { display: none; }
}
/*
 * 背の低い画面(スマホ横、小さいスマホの縦): 能力のランクを4列にし、レーダーチャートの横に札を並べて低くする。
 * やこび姫の1行は省く(地図の高さを残すため)。スマホ横では、さらに相手の顔を小さくする。
 */
@media (max-height: 500px) and (orientation: landscape), (max-height: 700px) and (orientation: portrait) {
  .shogi-game .shogi-tournament__hud-ability { grid-template-columns: 3.4rem minmax(0, 1fr); grid-template-areas: "radar ranks" "radar specials"; padding: 0.3rem 0.5rem; }
  .shogi-game .shogi-tournament__mini-ranks { grid-template-columns: repeat(4, minmax(0, 1fr)); column-gap: 0.4rem; }
  .shogi-game .shogi-tournament__mini-ranks span { font-size: 0.7em; }
  .shogi-game .shogi-tournament__hud[data-pending] .shogi-tournament__tip-line { display: none; }
}
@media (max-height: 500px) and (orientation: landscape) {
  .shogi-game .shogi-tournament__hud[data-pending] .shogi-tournament__hud-face { width: 3.6rem; height: 3.6rem; }
}
/* 広い画面・横長の画面: 左に地図、右に次の一局の枠。 */
@media (min-width: 900px), (orientation: landscape) and (max-height: 600px) {
  .shogi-game .shogi-tournament__stage {
    grid-template-columns: minmax(0, 1fr) minmax(19rem, 26rem);
    grid-template-rows: auto minmax(0, 1fr);
    grid-template-areas: "top top" "map hud";
  }
  /* 次の一局の枠は上から詰め、「対局する」はいちばん下に固定する(段階が変わっても位置が動かない)。 */
  .shogi-game .shogi-tournament__hud {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    border-top: 0;
    border-left: 3px solid #fffcf4;
    box-shadow: -4px 0 0 var(--tr-shadow);
  }
  .shogi-game .shogi-tournament__hud--boss { border-left-color: var(--tr-red); }
  .shogi-game .shogi-tournament__hud-face { width: 5rem; height: 5rem; }
  .shogi-game .shogi-tournament__hud[data-pending] > .shogi-tournament__start { margin-top: auto; }
}

/*
 * もっと広い画面: 真ん中の列に横長の地図と、その下に段階の表、右に次の一局の枠(U:7-5「いつも見たいものは横に出す」)。
 * 地図は山の空から始まるので、上の帯の下に置くと空が帯に続いて見える。
 * ①②の表は高さを使うので、地図は上の帯(画面の高さの約3割)。③の番勝負は中身の高さだけで、残りを地図に回す。
 */
@media (min-width: 1200px) and (min-aspect-ratio: 4/3) {
  .shogi-game .shogi-tournament__stage:not(.shogi-tournament__stage--entry):not(.shogi-tournament__stage--result) {
    grid-template-columns: minmax(0, 1fr) minmax(21rem, 26rem);
    grid-template-rows: auto clamp(12rem, 28vh, 20rem) minmax(0, 1fr);
    grid-template-areas: "top top" "map hud" "table hud";
  }
  .shogi-game .shogi-tournament__stage--series:not(.shogi-tournament__stage--entry):not(.shogi-tournament__stage--result) {
    grid-template-rows: auto minmax(12rem, 1fr) minmax(0, max-content);
  }
  .shogi-game .shogi-tournament__stage--series > .shogi-tournament__tables { padding-bottom: 0.8rem; }
  .shogi-game .shogi-tournament__stage--series .shogi-tournament__series-view { flex: 0 1 auto; }
  /* 番勝負の札は控えめな高さにして、上の地図に高さを回す。 */
  .shogi-game .shogi-tournament__stage--series .ryuo-series__bout { min-height: clamp(7rem, 17vh, 12rem); }
  .shogi-game .shogi-tournament__stage--series .ryuo-series__game { min-height: clamp(4.5rem, 10vh, 7.5rem); }
  .shogi-game .shogi-tournament__stage > .shogi-tournament__mapwrap { border-left: 3px solid #0f1828; }
  .shogi-game .shogi-tournament__stage > .shogi-tournament__tables { border-top: 3px solid #0f1828; }
  .shogi-game .shogi-tournament__view-switch { display: none; }
  /* 段階の道のりは、上の帯の真ん中に1行で(フルの名前)。 */
  .shogi-game .shogi-tournament__steps { order: 0; flex: 0 1 auto; margin: 0 auto; }
  .shogi-game .shogi-tournament__step { flex: 0 1 auto; padding: 0 0.9rem; }
  .shogi-game .shogi-tournament__step-long { display: inline; }
  .shogi-game .shogi-tournament__step-short { display: none; }
  .shogi-game .shogi-tournament__step-link { flex-basis: 1.6rem; }
  .shogi-game .shogi-tournament__topbar-title { flex: 0 1 auto; }
  .shogi-game .shogi-tournament__stage .shogi-tournament__mapnotes { top: 0.5rem; }
  .shogi-game .shogi-tournament__stage > .shogi-tournament__tables {
    grid-area: table;
    display: flex;
    padding-top: 0.6rem;
    border-left: 3px solid #0f1828;
  }
}

/* ===== 入口と結果: 山の全景と番付(docs/ryuo-ui-renewal-design.mdの5-1・5-5) ===== */
.shogi-game .shogi-tournament__stage--entry,
.shogi-game .shogi-tournament__stage--result { grid-template-rows: minmax(0, 1fr) auto; grid-template-areas: "map" "hud"; }
/* 題字。山の上に重ねる。 */
.shogi-game .shogi-tournament__logo {
  position: absolute;
  top: 0.8rem;
  left: 0;
  right: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.2rem 0.7rem;
  pointer-events: none;
}
.shogi-game .shogi-tournament__logo .shogi-tournament__seal { width: 3rem; height: 3rem; font-size: 1.6rem; }
.shogi-game .shogi-tournament__logo strong {
  color: #fffcf4;
  font-family: var(--tr-mincho);
  font-size: clamp(2.6rem, 2rem + 3vw, 3.6rem);
  font-weight: 900;
  letter-spacing: 0.12em;
  line-height: 1.1;
  text-shadow: 0 4px 0 var(--tr-red), 0 8px 0 var(--tr-shadow);
}
.shogi-game .shogi-tournament__logo-no { flex-basis: 100%; text-align: center; color: var(--tr-gold); font-size: 1.05em; font-weight: 900; text-shadow: 0 2px 0 var(--tr-shadow); }
/* 番付(竜王・1組〜6組)。山の左に、木の札のように縦に並べる。 */
.shogi-game .shogi-tournament__banzuke {
  position: absolute;
  left: 0.5rem;
  bottom: 0.6rem;
  display: grid;
  gap: 0.25rem;
  margin: 0;
  padding: 0.35rem;
  border: 2px solid #fffcf4;
  background: #5a3a1e;
  box-shadow: 3px 3px 0 var(--tr-shadow);
  list-style: none;
}
.shogi-game .shogi-tournament__banzuke li {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  min-width: 3.4rem;
  padding: 0.12rem 0.45rem;
  color: #1a2433;
  background: #efe3c6;
  box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.15);
  font-size: 0.82em;
  font-weight: 900;
}
.shogi-game .shogi-tournament__banzuke li.shogi-tournament__banzuke--you { background: var(--tr-gold); }
.shogi-game .shogi-tournament__banzuke-you { font-size: 0.78em; }
.shogi-game .shogi-tournament__banzuke .shogi-tournament__move-label {
  position: absolute;
  left: calc(100% + 0.5rem);
  top: 50%;
  padding: 0.15rem 0.7rem;
  border: 3px solid #fffcf4;
  color: #fffcf4;
  background: var(--tr-red);
  box-shadow: 3px 3px 0 var(--tr-shadow);
  font-size: 1.15em;
  letter-spacing: 0.05em;
  white-space: nowrap;
  transform: translateY(-50%) rotate(-8deg);
}
.shogi-game .shogi-tournament__banzuke .shogi-tournament__move-label--crown { color: #172632; background: var(--tr-gold); }
.shogi-game .shogi-tournament__banzuke .shogi-tournament__move-label--down { color: #172632; background: var(--tr-lavender); }
.shogi-game .shogi-tournament__banzuke .shogi-tournament__move-label--stamp { animation: tr-banzuke-stamp 260ms cubic-bezier(0.2, 0.9, 0.3, 1.2) 300ms both; }
@keyframes tr-banzuke-stamp {
  0% { opacity: 0; transform: translateY(-50%) rotate(-8deg) scale(2.2); }
  70% { opacity: 1; transform: translateY(-50%) rotate(-8deg) scale(0.92); }
  100% { opacity: 1; transform: translateY(-50%) rotate(-8deg) scale(1); }
}
/* 入口の枠。 */
.shogi-game .shogi-tournament__goal-box {
  display: grid;
  gap: 0.1rem;
  margin: 0;
  padding: 0.45rem 0.7rem;
  border: 2px solid var(--tr-gold);
  border-radius: 0.6rem;
  color: #fffcf4;
  font-weight: 900;
  line-height: 1.45;
}
.shogi-game .shogi-tournament__goal-box small { color: var(--tr-gold); font-size: 0.75em; }
.shogi-game .shogi-tournament__hud .shogi-tournament__entry-settings { padding: 0.35rem 0.35rem 0.35rem 0.7rem; background: rgba(255, 252, 244, 0.06); font-size: 0.88em; }
.shogi-game .shogi-tournament__hud-row { display: flex; gap: var(--tr-gap); }
.shogi-game .shogi-tournament__hud-row .shogi-tournament__sub { flex: 1 1 0; width: auto; height: var(--tr-control); font-size: 0.9em; }
/* 観戦の期の「結果だけ見る」(1)と「観戦する」(2)。主役は「観戦する」(13-6)。 */
.shogi-game .shogi-tournament__watch-row { align-items: stretch; }
.shogi-game .shogi-tournament__watch-row .shogi-tournament__sub { flex: 1 1 0; min-width: 0; height: auto; }
.shogi-game .shogi-tournament__watch-row .shogi-tournament__start { flex: 2 1 0; min-width: 0; margin: 0; }
/* 結果の見出し(山の上)と、数字の札。 */
.shogi-game .shogi-tournament__result-head { position: absolute; top: 0.7rem; left: 0; right: 0; display: grid; justify-items: center; gap: 0.15rem; text-align: center; pointer-events: none; }
.shogi-game .shogi-tournament__result-head .shogi-tournament__headline { color: #fffcf4; font-size: clamp(1.8rem, 1.3rem + 2.5vw, 2.6rem); text-shadow: 0 3px 0 var(--tr-red), 0 6px 0 var(--tr-shadow); }
.shogi-game .shogi-tournament__result-head .shogi-tournament__oshi { margin: 0; color: var(--tr-lavender); font-size: 0.8em; font-weight: 800; }
.shogi-game .shogi-tournament__result-cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--tr-gap); margin: 0; }
.shogi-game .shogi-tournament__result-cards > div { display: grid; justify-items: center; padding: 0.4rem 0.3rem; border: 2px solid #4b6585; border-radius: 0.6rem; background: rgba(255, 252, 244, 0.05); }
.shogi-game .shogi-tournament__result-cards dd { margin: 0; color: var(--tr-gold); font-size: 1.15em; font-weight: 900; }
.shogi-game .shogi-tournament__result-cards dt { color: rgba(255, 252, 244, 0.75); font-size: 0.72em; font-weight: 700; }
.shogi-game .shogi-tournament__detail .shogi-tournament__radar { display: grid; justify-items: center; gap: 0.4rem; }
.shogi-game .shogi-tournament__detail .shogi-tournament__radar h3 { justify-self: start; margin: 0; color: var(--tr-gold); font-size: 0.95em; }
/* 狭い画面では、番付を小さくする。 */
@media (max-width: 600px) {
  .shogi-game .shogi-tournament__banzuke { gap: 0.15rem; padding: 0.25rem; font-size: 0.85em; }
  .shogi-game .shogi-tournament__banzuke li { min-width: 2.9rem; padding: 0.05rem 0.35rem; }
}
@media (min-width: 900px), (orientation: landscape) and (max-height: 600px) {
  .shogi-game .shogi-tournament__stage--entry,
  .shogi-game .shogi-tournament__stage--result { grid-template-rows: minmax(0, 1fr); grid-template-areas: "map hud"; }
}
@media (prefers-reduced-motion: reduce) {
  .shogi-game .shogi-tournament__banzuke .shogi-tournament__move-label--stamp { animation: none; }
}
</style>
