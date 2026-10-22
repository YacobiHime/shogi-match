<template>
  <div :class="screen === 'select' ? 'shogi-home shogi-home--title shogi-tournament-home' : 'shogi-dex shogi-tournament'" role="dialog" aria-modal="true" aria-labelledby="shogi-tournament-title">
    <!--
      大会の選択。タイトル画面と同じ部品（.shogi-title__*）で、参加できる竜王戦を1枚だけ大きく出し、
      準備中の大会は小さな押せないタイルにする。
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
        <button type="button" class="shogi-title__next" data-tournament="ryuo" @click="chooseRyuo">
          <span class="shogi-title__next-eyebrow">タイトル戦</span>
          <span class="shogi-title__next-icon" aria-hidden="true">
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
          </span>
          <span class="shogi-title__next-label">竜王戦</span>
          <small class="shogi-title__next-desc">{{ ryuoCardNote }}</small>
          <span class="shogi-title__next-go" aria-hidden="true">▶ 参加する</span>
        </button>
        <div class="shogi-title__groups">
          <section class="shogi-title__group" aria-labelledby="shogi-tournament-titles">
            <h2 id="shogi-tournament-titles" class="shogi-title__group-title">タイトル戦</h2>
            <div class="shogi-title__tiles shogi-tournament__soon-tiles">
              <button v-for="item in COMING_SOON" :key="item.id" type="button" class="shogi-title__tile" disabled>
                <svg class="shogi-title__icon" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
                  <g fill="#fffcf4">
                    <rect x="3" y="3" width="10" height="1" />
                    <rect x="3" y="7" width="10" height="1" />
                    <rect x="3" y="11" width="10" height="1" />
                    <rect x="3" y="3" width="1" height="9" />
                    <rect x="12" y="3" width="1" height="9" />
                  </g>
                </svg>
                <span class="shogi-title__label">{{ item.label }}</span>
                <small class="shogi-title__desc">準備中</small>
              </button>
            </div>
          </section>
          <section class="shogi-title__group" aria-labelledby="shogi-tournament-road">
            <h2 id="shogi-tournament-road" class="shogi-title__group-title">プロへの道</h2>
            <div class="shogi-title__tiles shogi-tournament__soon-tiles">
              <button v-for="item in ROAD" :key="item.id" type="button" class="shogi-title__tile" disabled>
                <svg class="shogi-title__icon" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
                  <g fill="#f1a54c">
                    <rect x="2" y="11" width="4" height="3" />
                    <rect x="6" y="8" width="4" height="6" />
                    <rect x="10" y="4" width="4" height="10" />
                  </g>
                </svg>
                <span class="shogi-title__label">{{ item.label }}</span>
                <small class="shogi-title__desc">準備中</small>
              </button>
            </div>
          </section>
        </div>
      </nav>
    </template>

    <template v-else>
      <header class="shogi-dex__header">
        <button type="button" class="shogi-dex__back" @click="goBack">
          <span aria-hidden="true">←</span> {{ backText }}
        </button>
        <h1 id="shogi-tournament-title">竜王戦</h1>
      </header>

      <!--
        ページ全体はスクロールさせない。上に大会の帯、真ん中に中身の欄(収まらないときだけ中でスクロール)、
        下に操作の帯を置き、いちばん大事なボタン(参加する・対局開始など)はいつも見えるようにする。
      -->
      <div class="shogi-tournament__body">
        <!-- どの画面も、上に大会の帯(印・期・いまの段階・勝ち上がりの道のり)を置く -->
        <section class="shogi-tournament__banner" aria-label="竜王戦の道のり">
          <span class="shogi-tournament__seal" aria-hidden="true">竜</span>
          <div class="shogi-tournament__banner-title">
            <h2>{{ bannerTitle }}</h2>
            <p data-phase>{{ bannerSub }}</p>
            <!-- 推しの棋士のいまの段(4-7)。小さく、期の画面と結果だけ。 -->
            <p v-if="oshiStep && screen !== 'ryuo'" class="shogi-tournament__oshi" data-oshi-step><span aria-hidden="true">★</span>{{ oshiStep }}</p>
          </div>
          <!-- 竜王への道(RyuoRoad.vue)。入口では組の階段を見せるので、期が始まってから出す。 -->
          <RyuoRoad
            v-if="screen !== 'ryuo' && view?.road"
            class="shogi-tournament__route"
            :road="view.road"
            :asset-base-url="assetBaseUrl"
            :animate="climbPending"
            :last-win="view.lastGame?.win ?? false"
            :muted="Boolean(celebration)"
            :glow-crown="celebration === 'challenger' || celebration === 'crown'"
            @played="climbPending = false"
          />
        </section>

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
        <!--
          竜王戦の入口(docs/ryuo-ux-redesign.mdの4-1)。1画面・1ボタン: この期の目標と組の階段、やこび姫の一言、
          おすすめの設定(1行。「変える」で行を開く)。竜王戦の説明は「竜王戦ってなに？」で開く(必要な人だけ。U:6-1)。
        -->
        <div
          v-if="screen === 'ryuo'"
          class="shogi-tournament__layout shogi-tournament__layout--entry"
          data-screen="ryuo"
        >
          <div class="shogi-tournament__col">
            <section v-if="inProgress && !reEntry" class="shogi-tournament__card" aria-labelledby="shogi-ryuo-progress">
              <h2 id="shogi-ryuo-progress">進行中の大会</h2>
              <YakobiSays :lines="[`${view?.title}（${view?.phaseText}）の途中だよ。続きから、いっしょに行こう！`]" size="md" :asset-base-url="assetBaseUrl" />
              <p class="shogi-tournament__hint">下の「続きから参加する」で、竜王戦へ戻ります。</p>
            </section>

            <section v-else class="shogi-tournament__card shogi-tournament__entry" aria-labelledby="shogi-ryuo-entry" data-entry-form>
              <p class="shogi-tournament__eyebrow" id="shogi-ryuo-entry">この期の目標</p>
              <p class="shogi-tournament__goal" data-entry-goal>{{ entryGoal }}</p>
              <RyuoLadder :group="career.group" :champion="career.champion" />
              <YakobiSays :lines="talkLines" size="md" :asset-base-url="assetBaseUrl" />
              <div class="shogi-tournament__entry-settings">
                <p>
                  <small>{{ settingsCustomized ? "設定" : "おすすめの設定" }}</small>
                  <span data-entry-summary>{{ settingsSummary }}</span>
                </p>
                <button
                  type="button"
                  class="shogi-tournament__sub"
                  :aria-expanded="settingsOpen"
                  data-entry-change
                  @click="settingsOpen = !settingsOpen"
                >{{ settingsOpen ? "閉じる" : "変える" }}</button>
              </div>
              <!-- 設定は対局準備と同じ「項目: 値 [変更]」の行。行のどこを押しても選択シートを開く(U:2-2 同じ操作)。 -->
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
              <button type="button" class="shogi-tournament__about" data-entry-about @click="openGuide">竜王戦ってなに？</button>
            </section>
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
          竜王戦の期の画面(docs/ryuo-ux-redesign.mdの4-2・4-3)。主役は次の一局(VSの札)。タブはやめ、縦に積む。
          トーナメント表は、広い画面では右の列にいつも出し、狭い画面では「トーナメント表を見る」で重ねて開く。
        -->
        <div
          v-else-if="screen === 'season' && view"
          class="shogi-tournament__layout shogi-tournament__layout--season"
          :class="{ 'shogi-tournament__layout--table-open': tableOpen }"
          data-screen="season"
        >
          <div class="shogi-tournament__col">
            <!-- ライバル(天鷺羽音)と指した直後の、羽音の一言。次の対局を決める前に読めるよう、いちばん上に置く。 -->
            <section v-if="view.lastGame?.rivalLine" class="shogi-tournament__card shogi-tournament__rival-after" aria-label="天鷺羽音の一言" data-rival-after>
              <YakobiSays person="hanane" :lines="[view.lastGame.rivalLine]" size="md" bust name-tag :notice="view.lastGame.rivalNotice" :asset-base-url="assetBaseUrl" />
            </section>
            <!-- ほかの棋士の大番狂わせ(4-7)。直前に指した回戦のものだけ、1行で。 -->
            <p v-if="view.upset" class="shogi-tournament__upset" data-upset>{{ view.upset }}</p>
            <section
              v-if="view.pending"
              :class="['shogi-tournament__card', 'shogi-tournament__match', { 'shogi-tournament__match--boss': view.pending.stakes?.boss }]"
              aria-label="次の対局"
              data-pending
            >
              <h2>
                <span v-if="view.pending.stakes?.boss" class="shogi-tournament__boss-tag" data-boss>山場</span>
                <span class="shogi-tournament__match-label">{{ view.pending.label }}</span>
              </h2>
              <div class="shogi-tournament__vs">
                <div class="shogi-tournament__player shogi-tournament__player--you">
                  <span class="shogi-tournament__seal-face shogi-tournament__seal-face--you" aria-hidden="true">自</span>
                  <span class="shogi-tournament__color">{{ view.pending.color === "black" ? "先手" : "後手" }}</span>
                  <strong>あなた</strong>
                  <small>{{ ratingText }}</small>
                </div>
                <div class="shogi-tournament__vs-mid">
                  <template v-if="view.pending.kind !== 'game'">
                    <span class="shogi-tournament__score">{{ view.pending.wins.user }}<i>-</i>{{ view.pending.wins.opponent }}</span>
                    <small>第{{ view.pending.gameNo }}局・{{ view.pending.need }}勝先取</small>
                  </template>
                  <span v-else class="shogi-tournament__vs-mark">VS</span>
                </div>
                <div class="shogi-tournament__player" data-opponent>
                  <span v-if="opponentSprite" class="shogi-tournament__seal-face shogi-tournament__seal-face--sprite" aria-hidden="true">
                    <img :src="opponentSprite" alt="" draggable="false">
                  </span>
                  <span v-else :class="['shogi-tournament__seal-face', `shogi-tournament__seal-face--${opponentStyleTone}`]" aria-hidden="true">{{ view.pending.opponent.name.slice(0, 1) }}</span>
                  <span class="shogi-tournament__color">{{ view.pending.color === "black" ? "後手" : "先手" }}</span>
                  <span v-if="view.pending.rival?.story === 'hanane'" class="shogi-tournament__rival-tag" data-rival-tag>ライバル</span>
                  <strong>{{ view.pending.opponent.name }}</strong>
                  <small>{{ view.pending.opponent.dan }}<template v-if="opponentProfile.style">・{{ opponentProfile.style }}</template></small>
                  <small v-if="opponentAbilitySummary" class="shogi-tournament__player-ability" data-opponent-ability-line>{{ opponentAbilitySummary }}</small>
                </div>
              </div>
              <!-- 相手が前の回戦をどう勝ってきたか(自動対局の勝ち方。D:8-3)。 -->
              <p v-if="view.pending.arrival" class="shogi-tournament__arrival" data-arrival>{{ view.pending.arrival }}</p>
              <!-- この一局に賭けているもの(core/ryuo-stakes.mjs)。目標まであと何勝と、勝てば・負ければ。 -->
              <div v-if="view.pending.stakes" class="shogi-tournament__stakes" data-stakes>
                <p class="shogi-tournament__stakes-goal" data-stakes-goal>{{ view.pending.stakes.goal }}</p>
                <dl>
                  <div class="shogi-tournament__stakes-win"><dt>勝てば</dt><dd data-stakes-win>{{ view.pending.stakes.win }}</dd></div>
                  <div class="shogi-tournament__stakes-lose"><dt>負ければ</dt><dd data-stakes-lose>{{ view.pending.stakes.lose }}</dd></div>
                </dl>
              </div>
              <!-- ライバルの一言(1文だけ。操作は増やさない)。 -->
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
              <!-- やこび姫の作戦の手がかり(1行)。続きは「もっと聞く」。 -->
              <div class="shogi-tournament__tip" data-tip>
                <YakobiSays :lines="[tipLine]" size="sm" :asset-base-url="assetBaseUrl" />
                <button type="button" class="shogi-tournament__sub" :aria-expanded="coachOpen" data-coach-more @click="coachOpen = !coachOpen">
                  {{ coachOpen ? "閉じる" : "もっと聞く" }}
                </button>
              </div>
              <aside v-if="coachOpen" class="shogi-tournament__coach" aria-label="やこび姫" data-coach>
                <YakobiSays :lines="seasonSays" size="md" merged :asset-base-url="assetBaseUrl" />
              </aside>
              <dl class="shogi-tournament__tiles shogi-tournament__tiles--three">
                <div><dt>相手の棋力</dt><dd>Lv.{{ view.pending.opponent.level }}</dd></div>
                <div><dt>得意戦法</dt><dd class="shogi-tournament__tile-text">{{ opponentFavorite }}</dd></div>
                <div><dt>手番</dt><dd class="shogi-tournament__tile-text">{{ view.pending.color === "black" ? "先手" : "後手" }}</dd><span class="shogi-tournament__tile-note">振り駒</span></div>
              </dl>
              <!-- 相手の能力(ランクとレーダーチャート)。作戦の手がかりになるので、くわしい情報より先に見せる。 -->
              <details v-if="opponentAbility" class="shogi-tournament__profile-box" data-tournament-opponent-ability>
                <summary>{{ view.pending.opponent.name }}の能力（{{ opponentAbilitySummary }}）</summary>
                <PlayerAbilityPanel :view="opponentAbility" compact />
              </details>
              <details class="shogi-tournament__profile-box">
                <summary>{{ view.pending.opponent.name }}の、くわしい情報</summary>
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
              </details>
            </section>

            <section v-else-if="view.result" class="shogi-tournament__card" aria-label="この期の結果">
              <h2>この期の対局は、すべて終わりました</h2>
              <p class="shogi-tournament__lead">{{ outcomeHeadline }}（{{ view.result.wins }}勝{{ view.result.losses }}敗）</p>
            </section>

            <section v-if="view.series.length" class="shogi-tournament__card" aria-label="番勝負">
              <h2>番勝負</h2>
              <ul class="shogi-tournament__series">
                <li v-for="series in view.series" :key="series.key" :class="{ 'shogi-tournament__series--done': series.winner }">
                  <span class="shogi-tournament__series-label">{{ series.label }}</span>
                  <span class="shogi-tournament__series-name">{{ series.a?.name }}</span>
                  <strong class="shogi-tournament__series-score">{{ series.wins.a }} - {{ series.wins.b }}</strong>
                  <span class="shogi-tournament__series-name">{{ series.b?.name }}</span>
                </li>
              </ul>
            </section>

            <!--
              組優勝の予想。ランキング戦の1局目が決まる前だけ選べる。当たっても見返りは小さく(記録に残るだけ)、
              肩入れする理由にする。自分自身に賭けてもよい。
            -->
            <section v-if="predictionOptions" class="shogi-tournament__card" aria-labelledby="shogi-ryuo-predict" data-prediction>
              <h2 id="shogi-ryuo-predict">組優勝を予想しよう</h2>
              <p class="shogi-tournament__hint">{{ view.startGroup }}組ランキング戦を勝ち抜くのは誰かな？ 当たると、やこびノートのコレクションに記録されるよ。</p>
              <div class="shogi-tournament__predict">
                <select v-model="predictionPick" aria-label="組優勝の予想">
                  <option value="" disabled>棋士を選んでね</option>
                  <option v-for="option in predictionOptions" :key="option.id" :value="option.id">{{ option.name }}</option>
                </select>
                <button type="button" :disabled="!predictionPick" @click="choosePrediction">予想する</button>
              </div>
            </section>

            <button type="button" class="shogi-tournament__sub shogi-tournament__table-open" data-table-open @click="tableOpen = true">トーナメント表を見る</button>
          </div>

          <section
            class="shogi-tournament__card shogi-tournament__tables"
            :role="tableOpen ? 'dialog' : undefined"
            :aria-modal="tableOpen ? 'true' : undefined"
            aria-label="トーナメント表"
            data-tables
          >
            <div class="shogi-tournament__tables-head">
              <div class="shogi-tournament__tabs" role="tablist">
                <button
                  v-for="table in view.tables"
                  :key="table.key"
                  type="button"
                  role="tab"
                  :aria-selected="table.key === activeTableKey"
                  @click="tableChoice = table.key"
                >{{ tableTab(table) }}</button>
              </div>
              <button type="button" class="shogi-tournament__sub shogi-tournament__table-close" data-table-close @click="tableOpen = false">閉じる</button>
            </div>
            <TournamentTree
              v-if="activeTable?.tree"
              :key="activeTable.key"
              :tree="activeTable.tree"
              :finals="activeTable.key === 'main' && view.defender ? { defender: view.defender, winner: finalsWinner } : null"
              :root-badge="activeTable.key === 'main' ? '' : rootBadge(activeTable)"
              :mark-id="oshi?.id ?? ''"
              :rival-id="view.rivalId ?? ''"
            />
          </section>
        </div>

        <!-- 竜王戦: 結果・統計・解説(やこび姫が話す) -->
        <div v-else-if="screen === 'result' && view?.result" class="shogi-tournament__layout shogi-tournament__layout--result" data-screen="result" data-result-screen>
          <section :class="['shogi-tournament__card', 'shogi-tournament__verdict', `shogi-tournament__verdict--${groupMove.kind}`]" aria-label="結果">
            <div class="shogi-tournament__verdict-main">
              <p class="shogi-tournament__eyebrow">{{ view.title }}の結果</p>
              <p class="shogi-tournament__headline">{{ outcomeHeadline }}</p>
              <p class="shogi-tournament__text">{{ outcomeDetail }}</p>
              <ul v-if="view.result.titles?.length" class="shogi-tournament__titles">
                <li v-for="title in view.result.titles" :key="title.id"><strong>{{ title.label }}</strong><small>{{ title.detail }}</small></li>
              </ul>
            </div>
            <div class="shogi-tournament__move" :aria-label="`${groupMove.from}から${groupMove.to}（${groupMove.label}）`">
              <span class="shogi-tournament__move-from">{{ groupMove.from }}</span>
              <span class="shogi-tournament__move-arrow" aria-hidden="true">→</span>
              <span class="shogi-tournament__move-to">{{ groupMove.to }}</span>
              <strong
                :class="['shogi-tournament__move-label', { 'shogi-tournament__move-label--stamp': resultStamp }]"
                data-move-label
              >{{ groupMove.label }}</strong>
            </div>
            <p v-if="bestAxis" class="shogi-tournament__best" data-best-axis>{{ bestAxis }}</p>
            <p class="shogi-tournament__next-goal" data-next-goal><small>次の期</small>{{ entryGoalLine({ mode: entry.mode, group: entry.group, scale: scale }) }}</p>
            <ol class="shogi-tournament__path">
              <li v-for="step in view.result.path" :key="step.stage + step.label"><span>{{ step.label }}</span><strong>{{ step.text }}</strong></li>
            </ol>
          </section>

          <section v-if="view.lastGame?.rivalLine" class="shogi-tournament__card shogi-tournament__rival-after" aria-label="天鷺羽音の一言" data-rival-after>
            <YakobiSays person="hanane" :lines="[view.lastGame.rivalLine]" size="md" bust name-tag :notice="view.lastGame.rivalNotice" :asset-base-url="assetBaseUrl" />
          </section>
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

          <div class="shogi-tournament__col">
            <section class="shogi-tournament__card shogi-tournament__radar" aria-label="レーダーチャート">
              <h2>この期のあなた</h2>
              <RadarChart :axes="view.stats.radar" />
              <p v-if="view.stats.pending" class="shogi-tournament__hint" data-analyzing>やこび姫が対局を解析しています（あと{{ view.stats.pending }}局）。終わると、点数が出ます。</p>
              <p v-else class="shogi-tournament__hint">外側ほど得意。「—」は、データが足りない項目です。</p>
            </section>

            <section class="shogi-tournament__card" aria-label="統計" data-stats>
              <h2>統計</h2>
              <dl class="shogi-tournament__tiles">
                <div v-for="tile in statTiles" :key="tile.label">
                  <dt>{{ tile.label }}</dt>
                  <dd>{{ tile.value }}</dd>
                  <span v-if="tile.note" class="shogi-tournament__tile-note">{{ tile.note }}</span>
                </div>
              </dl>
            </section>
          </div>

        </div>
        </div>

        <!-- 操作の帯。画面ごとに、いちばん大事なボタンを右に大きく置く。 -->
        <footer class="shogi-tournament__actionbar">
          <template v-if="screen === 'ryuo'">
            <p class="shogi-tournament__actionbar-note">
              <strong>{{ career.champion ? "竜王" : `${career.group}組` }}</strong>
              <span>参加{{ career.seasons }}期・竜王{{ career.titles }}期</span>
            </p>
            <template v-if="inProgress && !reEntry">
              <button type="button" class="shogi-tournament__sub" @click="reEntry = true">破棄して、新しくエントリー</button>
              <button type="button" class="shogi-tournament__start" data-tournament-continue @click="screen = 'season'">続きから参加する</button>
            </template>
            <button v-else type="button" class="shogi-tournament__start" data-tournament-enter @click="enter">大会に参加する</button>
          </template>
          <template v-else-if="screen === 'season' && view">
            <p v-if="view.pending" class="shogi-tournament__actionbar-note">
              <strong>{{ view.pending.label }}</strong>
              <span>対 {{ view.pending.opponent.name }} {{ view.pending.opponent.dan }}</span>
            </p>
            <button v-if="view.pending" type="button" class="shogi-tournament__start" data-tournament-play @click="emit('play')">対局する</button>
            <button v-else-if="view.result" type="button" class="shogi-tournament__start" data-to-result @click="screen = 'result'">結果と統計を見る</button>
          </template>
          <template v-else-if="screen === 'result' && view?.result">
            <button type="button" class="shogi-tournament__sub" data-result-table @click="screen = 'season'">表を見る</button>
            <button type="button" class="shogi-tournament__sub" @click="emit('open-note')">ノートを見る</button>
            <button type="button" class="shogi-tournament__start" data-next-season @click="toNextSeason">次の期へ</button>
          </template>
        </footer>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, type PropType } from "vue";
import TournamentTree from "./TournamentTree.vue";
import RadarChart from "./RadarChart.vue";
import PlayerAbilityPanel from "./PlayerAbilityPanel.vue";
import RyuoLadder from "./RyuoLadder.vue";
import RyuoRoad, { type RoadView } from "./RyuoRoad.vue";
import YakobiSays from "./YakobiSays.vue";
import PregamePicker, { type PickerSection, type PickerValue } from "./PregamePicker.vue";
import { DIFFICULTY_LEVELS, SCALES, entryGoalLine, groupMeanLevel, scaleById } from "./core/ryuo.mjs";
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
} from "./core/ryuo-speech.mjs";
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
  settings: { scale: number; revival: boolean; coachLevel: string; hintLimit: number; undoLimit: number };
};
type Brief = {
  id: string; name: string; dan: string; level: number; style?: { label: string; rook?: string } | null; story?: string | null;
  character?: { attack: number; traits: { id: string; degree: number }[] } | null;
  repertoire?: { party: string; styles: string[] } | null;
  profile?: { held: string[]; former: string[]; totalTitles: number; junni: string | null; season: { wins: number; losses: number } | null } | null;
  vsUser?: { wins: number; losses: number; streak: number; lastWin: boolean | null } | null;
};
type Tree = {
  root: { pid?: string; from?: string }; rounds: number;
  nodes: Record<string, { id: string; a: { pid?: string; from?: string }; b: { pid?: string; from?: string }; winner: string | null; round: number }>;
  leaves: Record<string, Brief & { label?: string }>; pendingNodeId: string | null;
};
type Table = { key: string; title: string; tree: Tree | null };
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
  startAt: { type: String as PropType<"select" | "season">, default: "select" },
  /** 竜王戦の対局から戻ったところ。竜王への道で、前の段から登る動きを1回だけ見せる。 */
  fromGame: { type: Boolean, default: false },
  /** 推しの棋士(core/ryuo-oshi.mjs)。やこび姫が、期の中での様子を知らせる。 */
  oshi: { type: Object as PropType<{ id: string; name: string } | null>, default: null },
});
const emit = defineEmits<{
  close: [];
  enter: [settings: { difficulty: number; scale: number; revival: boolean; coachLevel: string; hintLimit: number; undoLimit: number }];
  play: [];
  "open-note": [];
  "result-seen": [];
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
const COMING_SOON = [{ id: "junni", label: "順位戦" }, { id: "meijin", label: "名人戦" }];
const ROAD = [{ id: "kenshukai", label: "研修会" }, { id: "shoreikai", label: "奨励会" }];

const charaUrl = computed(() => `${props.assetBaseUrl}/characters/yakobihime-mini.webp?v=4`);
const inProgress = computed(() => Boolean(props.view && !props.view.result));
const screen = ref<"select" | "ryuo" | "season" | "result">(
  props.startAt === "season" && props.view ? (props.view.result ? "result" : "season") : "select",
);
const reEntry = ref(false);
/** 竜王への道の、登る動きをまだ見せていない。 */
const climbPending = ref(props.fromGame);
const tableChoice = ref<string | null>(null);
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
  coachOpen.value = false;
}

const backText = computed(() => (screen.value === "result" ? "大会選択へ" : "大会の選択へ"));
/** 戻る操作。結果は見終えたことにして、大会の選択へ。ほかの画面も、大会の選択へ。選択の画面なら、閉じる。 */
function goBack() {
  if (screen.value === "select") emit("close");
  else backToSelect();
}
function backToSelect() {
  if (screen.value === "result") emit("result-seen");
  screen.value = "select";
  reEntry.value = false;
  tableChoice.value = null;
  tableOpen.value = false;
}
defineExpose({ goBack });

// ---- 大会の帯: 期・段階と、勝ち上がりの道のり
const bannerTitle = computed(() => {
  if (screen.value === "ryuo") return `第${entry.value.no}期 竜王戦`;
  return props.view?.title.replace(/竜王戦$/, " 竜王戦") ?? "竜王戦";
});
const bannerSub = computed(() => {
  if (screen.value === "ryuo") return entry.value.mode === "defense" ? "竜王として、防衛戦に臨む" : `${entry.value.group}組からエントリー`;
  if (screen.value === "result") return "結果";
  const view = props.view;
  if (!view) return "";
  return view.mode === "defense" && view.phase !== "done" ? "防衛戦" : view.phaseText;
});
// ---- エントリー設定
const DIFFICULTY_STEPS = Array.from({ length: DIFFICULTY_LEVELS }, (_, index) => index + 1);
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
const scale = ref(props.career.settings.scale);
const revival = ref(props.career.settings.revival);
const coachLevel = ref(props.career.settings.coachLevel);
const hintLimit = ref(props.career.settings.hintLimit);
const undoLimit = ref(props.career.settings.undoLimit);

const meanLevel = computed(() => groupMeanLevel(entry.value.group, difficulty.value));
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
type TalkTopic = "intro" | "difficulty" | "scale" | "revival" | "coach";
const talkTopic = ref<TalkTopic>("intro");
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
}));
const scaleLine = computed(() => entryScaleLine(scaleById(scale.value).label, scaleNote.value));
const coachLine = computed(() => entryCoachLine({ coachLevel: coachLevel.value, hintLimit: hintLimit.value, undoLimit: undoLimit.value }));
const talkLines = computed(() => {
  switch (talkTopic.value) {
    case "difficulty": return [difficultyLine.value];
    case "scale": return [scaleLine.value];
    case "revival": return [entryRevivalLine(revival.value)];
    case "coach": return [coachLine.value];
    default: return [introLine.value];
  }
});
/** 入口のやこび姫のひとこと。目標(上の1行)を、気持ちの言葉で言い直す。 */
const introLine = computed(() => {
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
  `難易度${difficulty.value}`,
  `規模 ${SCALES.find((item) => item.id === scale.value)?.label ?? ""}`,
  `敗者復活${revival.value ? "あり" : "なし"}`,
  coachLevel.value === "off" ? "助言なし" : COACH_OPTIONS.find((item) => item.value === coachLevel.value)?.label ?? "",
].join("・"));
/** おすすめ(前の期の設定と、おすすめの難易度)から変えたか。 */
const settingsCustomized = computed(() => (
  difficulty.value !== props.defaultDifficulty
  || scale.value !== props.career.settings.scale
  || revival.value !== props.career.settings.revival
  || coachLevel.value !== props.career.settings.coachLevel
  || hintLimit.value !== props.career.settings.hintLimit
  || undoLimit.value !== props.career.settings.undoLimit
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
  return (props.fromGame ? props.view?.milestone?.line : "")
    || props.view?.pending?.rival?.coach
    || (firstSeason ? phaseLines.value[0] : ability)
    || ability
    || phaseLines.value[0]
    || opponentSays.value[0]
    || "";
});
const coachOpen = ref(false);

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
onMounted(() => {
  if (milestoneOpen.value) {
    milestoneTimers.push(
      setTimeout(() => soundPlayer.play("stamp"), STAMP_SOUND_AT),
      setTimeout(() => { milestoneOpen.value = false; }, MILESTONE_SHOW_MS),
    );
  } else if (props.fromGame && props.view?.result && (groupMove.value.kind === "up" || groupMove.value.kind === "crown")) {
    resultStamp.value = true;
    milestoneTimers.push(
      setTimeout(() => soundPlayer.play("stamp"), RESULT_STAMP_SOUND_AT),
      setTimeout(() => { resultStamp.value = false; }, MILESTONE_SHOW_MS),
    );
  }
});
onBeforeUnmount(() => milestoneTimers.splice(0).forEach(clearTimeout));
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
  { id: "difficulty", label: "難易度", value: String(difficulty.value), note: `相手の平均 Lv.${Math.round(meanLevel.value)}・おすすめ ${props.defaultDifficulty}` },
  { id: "scale", label: "規模", value: SCALES.find((item) => item.id === scale.value)?.label ?? "", note: scaleMeta.value },
  { id: "revival", label: "敗者復活戦", value: REVIVAL_OPTIONS.find((item) => item.value === revival.value)?.label ?? "", note: "" },
  { id: "coach", label: "やこび姫の助言", value: COACH_OPTIONS.find((item) => item.value === coachLevel.value)?.label ?? "", note: "" },
  { id: "assist", label: "閃き・待った", value: `閃き${assistText(hintLimit.value)}・待った${assistText(undoLimit.value)}`, note: "" },
]);
const entryPickerConfig = computed<{ title: string; sections: PickerSection[]; note: string } | null>(() => {
  const single = (title: string, key: string, value: PickerValue, options: { value: PickerValue; label: string; description?: string }[], note = "") => (
    { title, note, sections: [{ key, value, groups: [{ options }] }] }
  );
  switch (entryPicker.value) {
    case "difficulty":
      return single("難易度", "difficulty", difficulty.value, DIFFICULTY_STEPS.map((level) => ({
        value: level, label: String(level), description: level === props.defaultDifficulty ? "おすすめ" : "",
      })), "数字が大きいほど、相手が強くなるよ。");
    case "scale":
      return single("規模", "scale", scale.value, SCALES.map((item) => ({ value: item.id, label: item.label })));
    case "revival":
      return single("敗者復活戦", "revival", String(revival.value), REVIVAL_OPTIONS.map((item) => ({ value: String(item.value), label: item.label })));
    case "coach":
      return single("やこび姫の助言", "coach", coachLevel.value, COACH_OPTIONS.map((item) => ({ value: item.value, label: item.label })));
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
    coachLevel: coachLevel.value, hintLimit: hintLimit.value, undoLimit: undoLimit.value,
  });
  reEntry.value = false;
  tableChoice.value = null;
  settingsOpen.value = false;
  screen.value = "season";
}
/** 結果を見終えて、次の期の入口へ。 */
function toNextSeason() {
  emit("result-seen");
  reEntry.value = false;
  tableChoice.value = null;
  talkTopic.value = "intro";
  screen.value = "ryuo";
}

// ---- トーナメント表: 狭い画面では「トーナメント表を見る」で重ねて開く。広い画面では右の列にいつも出す。
const tableOpen = ref(false);
// 次の一局が変わったら、開いていた表とやこび姫の話を閉じる。
watch(() => props.view?.pending?.label, () => {
  tableOpen.value = false;
  coachOpen.value = false;
});

// ---- トーナメント表
const currentTableKey = computed(() => {
  const phase = props.view?.phase;
  if (phase === "revival") return props.view?.tables.find(({ key }) => key.startsWith("revival"))?.key ?? "ranking";
  if (phase === "main" || phase === "main-setup" || phase === "playoff" || phase === "finals" || phase === "done") {
    return props.view?.tables.find(({ key }) => key === "main") ? "main" : "ranking";
  }
  return "ranking";
});
const activeTableKey = computed(() => (
  props.view?.tables.some(({ key }) => key === tableChoice.value) ? tableChoice.value : currentTableKey.value
));
const activeTable = computed(() => props.view?.tables.find(({ key }) => key === activeTableKey.value) ?? null);
const finalsWinner = computed(() => props.view?.series.find(({ key }) => key === "finals")?.winner ?? null);
function tableTab(table: Table) {
  if (table.key === "ranking") return `${props.view?.startGroup}組ランキング戦`;
  if (table.key === "main") return "決勝トーナメント";
  return table.title;
}
/** ランキング戦の表は、決勝の上に、優勝の札を付ける。 */
function rootBadge(table: Table) {
  return table.key === "ranking" ? "優勝" : "";
}

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
.shogi-game .shogi-dex.shogi-tournament {
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
.shogi-game .shogi-tournament__layout { display: grid; gap: 1rem; align-items: start; grid-template-columns: minmax(0, 1fr); }
.shogi-game .shogi-tournament__col { display: grid; align-content: start; gap: 1rem; min-width: 0; }
@media (min-width: 900px) {
  .shogi-game .shogi-tournament__body {
    font-size: clamp(15px, min(1.15vw, 2vh), 24px);
    width: min(100%, 78em);
  }
  /* 期の画面は、左右の列を中身の欄の高さにそろえ、列ごとに中でスクロールする。 */
  .shogi-game .shogi-tournament__main:has(.shogi-tournament__layout--season) { overflow: hidden; }
  .shogi-game .shogi-tournament__layout--season {
    height: 100%;
    grid-template-rows: minmax(0, 1fr);
    align-items: stretch;
  }
  /* トーナメント表を大きく見せるため、右の列を広くする。 */
  .shogi-game .shogi-tournament__layout--season { grid-template-columns: minmax(19em, 4fr) minmax(0, 8fr); }
  /* トーナメント表のカードは右の列いっぱいに広げ、表は残りの高さいっぱいに拡大する。 */
  .shogi-game .shogi-tournament__layout--season > .shogi-tournament__tables {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .shogi-game .shogi-tournament__layout--season > .shogi-tournament__tables .shogi-tree {
    --tree-fit: both;
    flex: 1 1 0;
    min-height: 0;
  }
  .shogi-game .shogi-tournament__layout--season > * {
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  /* 広い画面では、表はいつも右の列にあるので、開く・閉じるボタンはいらない。 */
  .shogi-game .shogi-tournament__sub.shogi-tournament__table-open,
  .shogi-game .shogi-tournament__sub.shogi-tournament__table-close { display: none; }
  .shogi-game .shogi-tournament__layout--result { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .shogi-game .shogi-tournament__verdict { grid-column: 1 / -1; }
}

/* ---- 操作の帯。いちばん大事なボタンを右端に大きく置き、左に今の状況を短く出す。 */
.shogi-game .shogi-tournament__actionbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--tr-gap);
  padding: 0.6rem 0.8rem;
  border: 2px solid rgba(241, 165, 76, 0.55);
  border-radius: 0.9rem;
  background: var(--tr-deep);
  box-shadow: 0 4px 0 var(--tr-shadow);
}
.shogi-game .shogi-tournament__actionbar:empty { display: none; }
.shogi-game .shogi-tournament__actionbar-note {
  display: grid;
  gap: 0.05rem;
  min-width: 0;
  margin: 0 auto 0 0;
  line-height: 1.3;
}
.shogi-game .shogi-tournament__actionbar-note strong { color: var(--tr-gold); font-size: 1.1em; }
.shogi-game .shogi-tournament__actionbar-note span { color: rgba(255, 252, 244, 0.75); font-size: 0.85em; }
.shogi-game .shogi-tournament__actionbar .shogi-tournament__start,
.shogi-game .shogi-tournament__actionbar .shogi-tournament__sub {
  width: auto;
  flex: 0 1 auto;
  min-width: 9em;
}
.shogi-game .shogi-tournament__actionbar .shogi-tournament__start { min-width: 14em; font-size: 1.15em; }
@media (max-width: 600px) {
  .shogi-game .shogi-tournament__actionbar { padding: 0.5rem; border-radius: 0.7rem; }
  .shogi-game .shogi-tournament__actionbar-note { flex: 1 1 100%; grid-auto-flow: column; justify-content: start; gap: 0.6rem; align-items: baseline; }
  .shogi-game .shogi-tournament__actionbar .shogi-tournament__start,
  .shogi-game .shogi-tournament__actionbar .shogi-tournament__sub { flex: 1 1 0; min-width: 0; }
}

/* ---- 相手のくわしい情報(折りたたみ) */
.shogi-game .shogi-tournament__profile-box summary {
  padding: 0.4rem 0.2rem;
  color: rgba(255, 252, 244, 0.8);
  font-size: 0.9em;
  font-weight: 700;
  cursor: pointer;
}

/* ---- 大会の帯 */
.shogi-game .shogi-tournament__banner {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  grid-template-areas: "seal title" "route route";
  align-items: center;
  gap: 0.6rem 1rem;
  padding: 0.6rem 1rem 0.7rem;
  border: 2px solid var(--tr-gold);
  border-radius: 0.9rem;
  background: var(--tr-panel);
  box-shadow: 0 4px 0 var(--tr-shadow);
}
@media (min-width: 900px) {
  .shogi-game .shogi-tournament__banner {
    grid-template-columns: auto minmax(0, 0.7fr) minmax(0, 2.6fr);
    grid-template-areas: "seal title route";
  }
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
.shogi-game .shogi-tournament__banner-title { grid-area: title; min-width: 0; }
.shogi-game .shogi-tournament__banner-title h2 {
  margin: 0;
  color: #fffcf4;
  font-family: var(--tr-mincho);
  font-size: 1.6em;
  font-weight: 800;
  letter-spacing: 0.1em;
  line-height: 1.2;
}
.shogi-game .shogi-tournament__banner-title p { margin: 0.25rem 0 0; color: var(--tr-gold); font-weight: 700; }
/* 竜王への道(RyuoRoad.vue)。帯の下の段(広い画面では右)に置き、収まらないときは道だけを横に送る。 */
/* contain: 道の幅で帯の列が広がらないようにする(道は自分の中で横に送る)。 */
.shogi-game .shogi-tournament__route { grid-area: route; min-width: 0; contain: inline-size; }

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
.shogi-game .shogi-tournament__sub { border: 2px solid rgba(255, 252, 244, 0.55); color: #fffcf4; background: transparent; font-weight: 700; }
/* 指を置いたままでも(全体のボタンの:hoverより優先して)、主役・脇役・選んだ項目の色を保つ。 */
.shogi-game .shogi-tournament__start:not(:disabled):hover { border-color: #f6bb6e; color: #172632; background: #f6bb6e; }
.shogi-game .shogi-tournament__sub:not(:disabled):hover { border-color: #f1a54c; color: #fffcf4; background: rgba(255, 252, 244, 0.08); }
.shogi-game .shogi-tournament__choices button[aria-checked="true"]:hover,
.shogi-game .shogi-tournament__tabs button[aria-selected="true"]:hover,
.shogi-game .shogi-tournament__chapters button[aria-current="step"]:hover { border-color: #f1a54c; color: #172632; background: #f1a54c; }
/*
 * 狭い画面の期の画面: タブを使わず、次の対局から縦に積む(中身の欄がスクロールする)。
 * トーナメント表は「トーナメント表を見る」で、画面いっぱいに重ねて開く(地図と同じく、表は枠の中で動かす)。
 */
@media (max-width: 899px) {
  .shogi-game .shogi-tournament__layout--season > .shogi-tournament__tables { display: none; }
  .shogi-game .shogi-tournament__layout--table-open > .shogi-tournament__tables {
    position: fixed;
    inset: 0;
    z-index: 30;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: max(0.7rem, env(safe-area-inset-top)) 0.7rem max(0.7rem, env(safe-area-inset-bottom));
    border: 0;
    border-radius: 0;
    background: #1e2d3d;
  }
  .shogi-game .shogi-tournament__layout--table-open > .shogi-tournament__tables .shogi-tree {
    --tree-fit: both;
    flex: 1 1 0;
    min-height: 0;
  }
}
.shogi-game .shogi-tournament__tables-head { display: flex; align-items: flex-start; gap: var(--tr-gap); }
.shogi-game .shogi-tournament__tables-head .shogi-tournament__tabs { flex: 1 1 auto; min-width: 0; }
.shogi-game .shogi-tournament__tables-head .shogi-tournament__sub { flex: 0 0 auto; width: auto; height: var(--tr-control); }

/* ---- 次の対局: あなた VS 相手 */
.shogi-game .shogi-tournament__match-label { color: #fffcf4; letter-spacing: 0.05em; }
.shogi-game .shogi-tournament__vs {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 0.6rem;
  padding: 1rem 0.6rem;
  border-radius: 0.2rem;
  background: var(--tr-deep);
}
.shogi-game .shogi-tournament__player { display: grid; justify-items: center; gap: 0.2rem; min-width: 0; text-align: center; }
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
.shogi-game .shogi-tournament__player strong {
  font-family: var(--tr-mincho);
  font-size: clamp(1.25rem, 0.9rem + 1.2vw, 1.9rem);
  font-weight: 800;
  line-height: 1.2;
  overflow-wrap: anywhere;
}
.shogi-game .shogi-tournament__player small { color: rgba(255, 252, 244, 0.8); font-weight: 700; }
.shogi-game .shogi-tournament__color {
  padding: 0.05rem 0.6rem;
  border-radius: 0.15rem;
  color: #172632;
  background: #fffcf4;
  font-size: 0.75em;
  font-weight: 800;
}
.shogi-game .shogi-tournament__player:not(.shogi-tournament__player--you) .shogi-tournament__color { color: #fffcf4; background: #172632; box-shadow: 0 0 0 1px #fffcf4 inset; }
.shogi-game .shogi-tournament__vs-mid { display: grid; justify-items: center; gap: 0.2rem; }
.shogi-game .shogi-tournament__vs-mark {
  color: var(--tr-gold);
  font-family: var(--tr-mincho);
  font-size: 1.6em;
  font-style: italic;
  font-weight: 800;
}
.shogi-game .shogi-tournament__score { font-size: 2em; font-weight: 800; line-height: 1; white-space: nowrap; }
.shogi-game .shogi-tournament__score i { margin: 0 0.3rem; color: rgba(255, 252, 244, 0.5); font-style: normal; }
.shogi-game .shogi-tournament__vs-mid small { color: var(--tr-gold); font-size: 0.75em; font-weight: 700; white-space: nowrap; }
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

/* ---- 結果 */
.shogi-game .shogi-tournament__verdict {
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem 1.5rem;
  border-color: var(--tr-gold);
}
@media (min-width: 760px) {
  .shogi-game .shogi-tournament__verdict { grid-template-columns: minmax(0, 1fr) auto; align-items: center; }
  .shogi-game .shogi-tournament__path { grid-column: 1 / -1; }
}
/* 結果の種類は、枠の色で分ける(竜王・昇級は橙、降級はラベンダー)。 */
.shogi-game .shogi-tournament__verdict--crown,
.shogi-game .shogi-tournament__verdict--up { border-color: var(--tr-gold); }
.shogi-game .shogi-tournament__verdict--down { border-color: var(--tr-lavender); }
.shogi-game .shogi-tournament__verdict-main { display: grid; gap: 0.4rem; min-width: 0; }
.shogi-game .shogi-tournament__eyebrow { margin: 0; color: var(--tr-gold); font-weight: 800; letter-spacing: 0.12em; }
.shogi-game .shogi-tournament__headline {
  margin: 0;
  font-family: var(--tr-mincho);
  font-size: clamp(1.7rem, 1.1rem + 2vw, 2.8rem);
  font-weight: 800;
  line-height: 1.2;
}
.shogi-game .shogi-tournament__move {
  display: grid;
  grid-template-columns: auto auto auto;
  align-items: center;
  justify-content: center;
  gap: 0.3rem 0.8rem;
  padding: 0.8rem 1.2rem;
  border-radius: 0.2rem;
  background: var(--tr-deep);
  text-align: center;
}
.shogi-game .shogi-tournament__move-from,
.shogi-game .shogi-tournament__move-to { font-family: var(--tr-mincho); font-size: 1.8em; font-weight: 800; }
.shogi-game .shogi-tournament__move-from { color: rgba(255, 252, 244, 0.6); }
.shogi-game .shogi-tournament__move-arrow { color: rgba(255, 252, 244, 0.6); font-size: 1.4em; }
.shogi-game .shogi-tournament__move-label {
  grid-column: 1 / -1;
  justify-self: center;
  padding: 0.1rem 1rem;
  border-radius: 0.15rem;
  color: #172632;
  background: #fffcf4;
  letter-spacing: 0.2em;
}
.shogi-game .shogi-tournament__verdict--crown .shogi-tournament__move-label,
.shogi-game .shogi-tournament__verdict--up .shogi-tournament__move-label { background: var(--tr-gold); }
.shogi-game .shogi-tournament__verdict--down .shogi-tournament__move-label { background: var(--tr-lavender); }
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
  .shogi-game .shogi-tournament__banner { padding: 0.8rem 0.9rem 0.9rem; }
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

/* 大会の選択。タイトル画面の部品を使い、準備中のタイルは、どの段も同じ大きさで同じ列に並べる。 */
.shogi-game .shogi-tournament-home .shogi-tournament__soon-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.shogi-game .shogi-tournament-home .shogi-title__tile:disabled { opacity: 0.55; box-shadow: none; }
/* 左上の戻るボタンと、タイトルが重ならないよう、上を空ける。 */
.shogi-game .shogi-home.shogi-home--title.shogi-tournament-home { padding-top: max(4rem, env(safe-area-inset-top)); }
.shogi-game .shogi-tournament-home .shogi-title__logo {
  font-family: var(--tr-mincho, "Yu Mincho", "Hiragino Mincho ProN", serif);
  letter-spacing: 0.12em;
}
/* 操作の帯(スマホ): 主役のボタンを1段目に広げ、脇役のボタンを2段目に並べる。 */
@media (max-width: 600px) {
  .shogi-game .shogi-tournament__actionbar .shogi-tournament__start { flex: 1 1 100%; order: -1; }
}
.shogi-game .shogi-tournament__home-back {
  position: absolute;
  top: 0.8rem;
  left: 0.8rem;
  z-index: 1;
}
/* 大会の帯は、狭い画面では詰める。竜王への道は、横に送って見る。 */
@media (max-width: 899px) {
  .shogi-game .shogi-tournament__banner {
    gap: 0.35rem 0.7rem;
    padding: 0.45rem 0.7rem 0.5rem;
  }
  .shogi-game .shogi-tournament__banner .shogi-tournament__seal { width: 2.2rem; height: 2.2rem; font-size: 1.2rem; }
  .shogi-game .shogi-tournament__banner h2 { font-size: 1.05rem; }
}
/* 背の低いスマホの縦向き: 対局のカードを詰める。 */
@media (max-width: 899px) and (orientation: portrait) and (max-height: 700px) {
  .shogi-game .shogi-tournament__vs { padding: 0.5rem 0.4rem; }
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
  .shogi-game .shogi-tournament__banner { grid-area: banner; grid-template-areas: "seal title"; }
  .shogi-game .shogi-tournament__banner .shogi-tournament__route { display: none; }
  .shogi-game .shogi-tournament__main { grid-area: main; }
  .shogi-game .shogi-tournament__actionbar {
    grid-area: action;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-end;
    align-self: end;
  }
  .shogi-game .shogi-tournament__actionbar-note { flex: none; grid-auto-flow: row; margin: 0; }
  .shogi-game .shogi-tournament__actionbar .shogi-tournament__start,
  .shogi-game .shogi-tournament__actionbar .shogi-tournament__sub { flex: none; width: 100%; min-width: 0; }
  .shogi-game .shogi-tournament__layout--entry,
  .shogi-game .shogi-tournament__layout--season { gap: 0.4rem; }
  .shogi-game .shogi-tournament__card { padding: 0.55rem 0.7rem; }
  .shogi-game .shogi-tournament__vs { padding: 0.4rem 0.5rem; }
  .shogi-game .shogi-tournament__setting { min-height: 2.4rem; padding: 0.25rem 0.6rem; }
  .shogi-game .shogi-tournament__settings { gap: 0.3rem; }
  .shogi-game .shogi-tournament__coach img { max-height: 8rem; width: auto; }
}

/* ===== 竜王戦の入口・次の一局(docs/ryuo-ux-redesign.mdの段階1) ===== */
/* 入口は、どの画面の大きさでも1列。目標・階段・ひとこと・設定の要約・参加ボタンだけ(U:1-1 1画面1目的)。 */
.shogi-game .shogi-tournament__layout--entry { grid-template-columns: minmax(0, 40em); justify-content: center; }
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

/* 次の一局の顔(判子のような四角)。いまは名前の1文字。羽音はミニキャラの絵。ほかの棋士の絵が増えたら、同じ枠に入れる。 */
.shogi-game .shogi-tournament__seal-face {
  box-sizing: border-box;
  display: grid;
  place-items: center;
  width: 3.4rem;
  height: 3.4rem;
  overflow: hidden;
  border: 2px solid #fffcf4;
  border-radius: 0.4rem;
  color: #fffcf4;
  box-shadow: 3px 3px 0 var(--tr-shadow);
  font-family: var(--tr-mincho);
  font-size: 1.7rem;
  font-weight: 800;
  line-height: 1;
}
/* 棋風の色: 攻め(朱)・受け(藍)・バランス(金)。名前の文字と棋風の文でも分かるので、色だけに頼らない。 */
.shogi-game .shogi-tournament__seal-face--you { color: #172632; background: #fffcf4; border-color: var(--tr-gold); }
.shogi-game .shogi-tournament__seal-face--attack { background: var(--tr-red); }
.shogi-game .shogi-tournament__seal-face--defense { background: #3d6fa5; }
.shogi-game .shogi-tournament__seal-face--balance { color: #172632; background: #d9b860; }
.shogi-game .shogi-tournament__seal-face--sprite { align-items: end; background: var(--tr-panel); }
.shogi-game .shogi-tournament__seal-face--sprite img { width: auto; height: 160%; margin-bottom: -60%; image-rendering: pixelated; }
.shogi-game .shogi-tournament__player-ability { font-size: 0.8em; }
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

/* 山場の一局(組の決勝・番勝負・ライバル戦)。朱の太い枠と札で、ふだんの一局と見分ける。 */
.shogi-game .shogi-tournament__match--boss { border: 3px solid var(--tr-red); box-shadow: 0 4px 0 var(--tr-shadow); }
.shogi-game .shogi-tournament__match--boss .shogi-tournament__vs { background: #2a1f2a; }
.shogi-game .shogi-tournament__boss-tag {
  padding: 0.05rem 0.6rem;
  border-radius: 0.15rem;
  color: #fffcf4;
  background: var(--tr-red);
  letter-spacing: 0.15em;
}
.shogi-game .shogi-tournament__match--boss h2::before { display: none; }

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
@media (max-width: 600px) {
  .shogi-game .shogi-tournament__seal-face { width: 2.8rem; height: 2.8rem; font-size: 1.4rem; }
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
/* 結果の画面の、昇級・竜王の判子。 */
.shogi-game .shogi-tournament__move-label--stamp { animation: tr-stamp-flat 260ms cubic-bezier(0.2, 0.9, 0.3, 1.2) 300ms both; }
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
/* 推しの棋士のいまの段。 */
.shogi-game .shogi-tournament__banner-title .shogi-tournament__oshi {
  overflow: hidden;
  margin-top: 0.15rem;
  color: var(--tr-lavender);
  font-size: 0.8em;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.shogi-game .shogi-tournament__oshi span { margin-right: 0.25rem; color: var(--tr-lavender); }
@media (prefers-reduced-motion: reduce) {
  .shogi-game .shogi-tournament__milestone,
  .shogi-game .shogi-tournament__milestone-seal,
  .shogi-game .shogi-tournament__move-label--stamp { animation: none; }
}
</style>
