<template>
  <div class="shogi-dex shogi-note" role="dialog" aria-modal="true" aria-labelledby="shogi-note-title">
    <header class="shogi-dex__header">
      <button type="button" class="shogi-dex__back" @click="emit('close')">
        <span aria-hidden="true">←</span> {{ backLabel }}
      </button>
      <h1 id="shogi-note-title">やこびノート</h1>
      <p class="shogi-note__header-rating" aria-label="いまのレーティング">
        <strong>R{{ state.rating }}</strong><span>{{ gradeName(nearestPreset.label) }}</span>
      </p>
    </header>

    <!--
      ページ全体はスクロールさせず、左（スマホでは上）のメニューで中身を切り替える。
      中身の欄だけが、収まらないときに中でスクロールする。
    -->
    <div class="shogi-note__layout">
      <nav class="shogi-note__nav" role="tablist" aria-label="ノートの項目" aria-orientation="vertical">
        <button
          v-for="item in TABS"
          :key="item.id"
          type="button"
          role="tab"
          class="shogi-note__nav-item"
          :aria-selected="tab === item.id"
          :aria-controls="`shogi-note-pane-${item.id}`"
          @click="selectTab(item.id)"
        >
          <span class="shogi-note__nav-label">{{ item.label }}</span>
          <span class="shogi-note__nav-short" aria-hidden="true">{{ item.short }}</span>
          <small class="shogi-note__nav-desc">{{ item.description }}</small>
        </button>
      </nav>

      <main class="shogi-note__pane">
        <!--
          まとめ。いちばん知りたい「いまの棋力」と「次の目標」を大きく出し、次にすること（対局する）を1つだけ主役にする。
        -->
        <section
          v-if="tab === 'summary'"
          id="shogi-note-pane-summary"
          class="shogi-note__cover"
          role="tabpanel"
          aria-labelledby="shogi-note-rank"
          data-note-profile
        >
          <div class="shogi-note__coach">
            <YakobiSays :lines="messages" size="xl" merged name-tag :asset-base-url="assetBaseUrl" />
          </div>

          <div class="shogi-note__rank">
            <p id="shogi-note-rank" class="shogi-note__eyebrow">あなたの棋力</p>
            <p class="shogi-note__rating">
              <strong>R{{ state.rating }}</strong>
              <span
                v-if="ratingDelta"
                class="shogi-note__delta"
                :class="ratingDelta > 0 ? 'shogi-note__delta--up' : 'shogi-note__delta--down'"
                :title="'前の対局からの増減'"
              >{{ ratingDelta > 0 ? `▲ +${ratingDelta}` : `▼ −${Math.abs(ratingDelta)}` }}</span>
            </p>
            <p class="shogi-note__grade">
              {{ gradeName(nearestPreset.label) }}<small>（CPU Lv.{{ nearestPreset.level }}くらい）</small>
            </p>
            <p v-if="playStreak.best" class="shogi-note__streak" data-note-streak>
              続けて遊んだ日 <b>{{ playStreak.current }}日</b><small>（いちばん長い記録 {{ playStreak.best }}日）</small>
            </p>

            <div v-if="nextGoal" class="shogi-note__goal">
              <p class="shogi-note__goal-text">
                <span>次の目標 <b>{{ gradeName(nextGoal.label) }}</b></span>
                <span>あと <b>R{{ nextGoal.remaining }}</b></span>
              </p>
              <div
                class="shogi-note__goal-bar"
                role="progressbar"
                aria-valuemin="0"
                aria-valuemax="100"
                :aria-valuenow="nextGoal.percent"
                :aria-label="`${gradeName(nextGoal.label)}まで${nextGoal.percent}%`"
              ><span :style="{ width: `${nextGoal.percent}%` }"></span></div>
            </div>
            <p v-else class="shogi-note__goal-text">いちばん上の目安に届いたよ！</p>

            <ul class="shogi-note__badges" aria-label="所属と称号">
              <li class="shogi-note__badge" :class="{ 'shogi-note__badge--group': affiliation }">
                <small>所属</small>{{ affiliation ? affiliation.label : "まだ所属なし" }}
              </li>
              <li v-for="title in otherTitles" :key="title.id" class="shogi-note__badge" :title="title.detail" data-note-title>
                {{ title.label }}
              </li>
            </ul>

            <div v-if="recentForm.length" class="shogi-note__form">
              <span class="shogi-note__form-label">最近の対局</span>
              <ol :aria-label="`最近${recentForm.length}局の結果`">
                <li
                  v-for="(outcome, index) in recentForm"
                  :key="index"
                  :class="`shogi-note__form-mark--${outcome}`"
                  :title="FORM_TEXT[outcome]"
                >{{ FORM_MARK[outcome] }}</li>
              </ol>
            </div>

            <div class="shogi-note__actions">
              <button type="button" class="shogi-note__button shogi-note__button--primary" @click="emit('start-match')">
                {{ state.games ? "対局する" : "1局指してノートを始める" }}
              </button>
              <button type="button" class="shogi-note__button" @click="emit('start-measure')">棋力を測る</button>
            </div>
          </div>

          <ul class="shogi-note__highlights" aria-label="記録のハイライト">
            <li>
              <button type="button" class="shogi-note__highlight" @click="selectTab('record')">
                <small>勝率</small>
                <strong>{{ state.games ? percent(state.wins / state.games) : "—" }}</strong>
                <span>{{ state.games ? `${state.games}局 ${state.wins}勝${state.losses}敗` : "まだ対局がありません" }}</span>
              </button>
            </li>
            <li>
              <button type="button" class="shogi-note__highlight" @click="selectTab('style')">
                <small>得意な戦法</small>
                <strong>{{ favoriteStrategy ? favoriteStrategy.label : "—" }}</strong>
                <span>{{ favoriteStrategy ? `勝率${percent(favoriteStrategy.winRate ?? 0)}・${favoriteStrategy.games}局` : "3局以上で見つかるよ" }}</span>
              </button>
            </li>
            <li>
              <button type="button" class="shogi-note__highlight" @click="selectTab('tournament')">
                <small>竜王戦</small>
                <strong>{{ career.champion ? "竜王" : `${career.group}組` }}</strong>
                <span>{{ career.seasons ? `${career.seasons}期参加` : "まだ参加していません" }}</span>
              </button>
            </li>
          </ul>
        </section>

        <!--
          能力(docs/player-abilities-design.mdの12章)。名鑑の棋士と同じ8つの能力・ランク・特殊能力を、最近の対局の中身から出す。
          主役はレーダーチャート。名鑑の棋士(ライバル・竜王・同じ組の平均)を点線で重ねて比べられる。
          横長の画面は2列(左にチャート、右にやこび姫の一言・ランク・型・特殊能力)、縦長は1列で、1画面に収める(8-3)。
          戦法の使用率は「戦型」の項目に出す。
        -->
        <section v-if="tab === 'ability'" id="shogi-note-pane-ability" class="shogi-note__panel shogi-note__panel--fit shogi-note__ability" role="tabpanel" aria-label="能力" data-note-ability>
          <div v-if="!myAbility.ready" class="shogi-note__card shogi-note__empty">
            <p>
              対局を解析すると、名鑑の棋士と同じように、あなたの能力（序盤・中盤・終盤・攻め・受け・読み・詰み・安定感）がここに出るよ。
              あと{{ myAbility.need }}手ぶんの解析で分かるよ。自由対局か竜王戦を指そう！
            </p>
            <button type="button" class="shogi-note__button shogi-note__button--primary" @click="emit('start-match')">対局する</button>
          </div>
          <template v-else>
            <div class="shogi-note__coach shogi-note__ability-coach">
              <YakobiSays :lines="abilityLines" merged :asset-base-url="assetBaseUrl" />
            </div>
            <section class="shogi-note__card shogi-note__ability-card" aria-label="あなたの能力">
              <h2>
                あなたの能力
                <small>{{ gradeName(nearestPreset.label) }}・R{{ state.rating }}</small>
              </h2>
              <div class="shogi-note__ability-compare" role="radiogroup" aria-label="比べる棋士">
                <button
                  v-for="option in abilityCompareOptions"
                  :key="option.id"
                  type="button"
                  role="radio"
                  class="shogi-note__chip"
                  :class="{ 'shogi-note__chip--on': abilityCompareId === option.id }"
                  :aria-checked="abilityCompareId === option.id"
                  :data-ability-compare="option.id"
                  @click="abilityCompareId = option.id"
                >{{ option.label }}</button>
              </div>
              <div class="shogi-note__ability-chart">
                <PlayerAbilityPanel :view="myAbility.view" :compare="abilityCompare" part="chart" />
              </div>
            </section>
            <section v-scroll-more class="shogi-note__card shogi-note__ability-details shogi-note__scroll" aria-label="能力のランクと特殊能力">
              <PlayerAbilityPanel :view="myAbility.view" :compare="abilityCompare" part="details" :openings="false" />
              <p class="shogi-note__hint" data-ability-basis>
                最近{{ myAbility.games }}局・{{ myAbility.moves }}手の解析から出した目安だよ。物差しは竜王戦（難易度{{ difficultyName(myAbility.difficulty) }}）の棋士と同じで、対局するたびに動くよ。
              </p>
            </section>
          </template>
        </section>

        <!--
          成績。横長の画面は2列(左に勝ち負け、右の上に推移、右の下に最近の対局)、
          スマホの縦は項目の中のタブ(勝ち負け・推移・最近の対局)で分ける。最近の対局は枠の中だけを動かす(8-3)。
        -->
        <section
          v-if="tab === 'record'"
          id="shogi-note-pane-record"
          class="shogi-note__panel shogi-note__panel--fit shogi-note__record"
          role="tabpanel"
          aria-label="成績"
          :data-view="recordView"
        >
          <div v-if="!state.games" class="shogi-note__card shogi-note__empty">
            <p>まだ記録がないよ。平手でCPUと対局したり、竜王戦で指したりすると、勝ち負けとレーティングの推移がここに書き込まれるよ。</p>
          </div>
          <template v-else>
            <div class="shogi-note__segmented shogi-note__narrow-only" role="tablist" aria-label="成績の切り替え">
              <button
                v-for="item in RECORD_VIEWS"
                :key="item.id"
                type="button"
                role="tab"
                :aria-selected="recordView === item.id"
                :data-record-view="item.id"
                @click="recordView = item.id"
              >{{ item.label }}</button>
            </div>
            <section v-scroll-more class="shogi-note__card shogi-note__score shogi-note__scroll" :class="{ 'shogi-note__part--off': recordView !== 'score' }" aria-labelledby="shogi-note-score" data-note-record>
              <h2 id="shogi-note-score">勝ち負け</h2>
              <div class="shogi-note__score-body">
                <div
                  class="shogi-note__ring"
                  :style="{ '--win': `${winShare}%`, '--draw': `${winShare + drawShare}%` }"
                  role="img"
                  :aria-label="`勝率${percent(state.wins / state.games)}`"
                >
                  <span><small>勝率</small>{{ percent(state.wins / state.games) }}</span>
                </div>
                <dl class="shogi-note__tiles">
                  <div><dt>対局</dt><dd>{{ state.games }}</dd></div>
                  <div class="shogi-note__tile--win"><dt>勝ち</dt><dd>{{ state.wins }}</dd></div>
                  <div class="shogi-note__tile--loss"><dt>負け</dt><dd>{{ state.losses }}</dd></div>
                  <div><dt>引き分け</dt><dd>{{ state.draws }}</dd></div>
                </dl>
              </div>
              <ul class="shogi-note__rows" aria-label="手番ごとの成績">
                <li v-for="row in colorRows" :key="row.key">
                  <span class="shogi-note__name">{{ row.label }}</span>
                  <span class="shogi-note__bar" aria-hidden="true"><span :style="{ width: row.winPercent }"></span></span>
                  <span class="shogi-note__stat">{{ row.text }}</span>
                </li>
              </ul>
              <ul v-if="eventRows.length" class="shogi-note__rows" aria-label="棋戦ごとの成績" data-note-events>
                <li v-for="row in eventRows" :key="row.key">
                  <span class="shogi-note__name">{{ row.label }}</span>
                  <span class="shogi-note__bar" aria-hidden="true"><span :style="{ width: row.winPercent }"></span></span>
                  <span class="shogi-note__stat">{{ row.text }}</span>
                </li>
              </ul>
              <p class="shogi-note__hint">平手でCPUと指した自由対局と竜王戦の結果を数えています。</p>
            </section>

            <figure class="shogi-note__card shogi-note__trend-card" :class="{ 'shogi-note__part--off': recordView !== 'trend' }">
              <h2>レーティングの推移</h2>
              <div v-if="trend" class="shogi-note__trend-box">
                <div class="shogi-note__trend-axis" aria-hidden="true"><span>R{{ trend.max }}</span><span>R{{ trend.min }}</span></div>
                <svg
                  class="shogi-note__trend"
                  viewBox="0 0 300 100"
                  preserveAspectRatio="none"
                  role="img"
                  :aria-label="`直近${trend.count}局のレーティングの推移`"
                >
                  <defs>
                    <linearGradient id="shogi-note-trend-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stop-color="#f1a54c" stop-opacity="0.45" />
                      <stop offset="100%" stop-color="#f1a54c" stop-opacity="0" />
                    </linearGradient>
                  </defs>
                  <line v-for="y in [8, 50, 92]" :key="y" x1="0" x2="300" :y1="y" :y2="y" stroke="rgba(255,252,244,0.12)" stroke-width="1" vector-effect="non-scaling-stroke" />
                  <polygon :points="`0,100 ${trend.points} 300,100`" fill="url(#shogi-note-trend-fill)" />
                  <polyline :points="trend.points" fill="none" stroke="#f1a54c" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
                </svg>
                <figcaption class="shogi-note__trend-note">直近{{ trend.count }}局（R{{ trend.min }}〜R{{ trend.max }}）</figcaption>
              </div>
              <p v-else class="shogi-note__hint">2局以上指すと、ここに推移の線が出るよ。</p>
            </figure>

            <section class="shogi-note__card shogi-note__recent" :class="{ 'shogi-note__part--off': recordView !== 'recent' }" aria-labelledby="shogi-note-recent" data-note-recent-games>
              <h2 id="shogi-note-recent">最近の対局<small class="shogi-note__count">{{ recentGames.length }}局</small></h2>
              <ol v-scroll-more class="shogi-note__games shogi-note__scroll">
                <li v-for="game in recentGames" :key="game.key" :class="`shogi-note__game--${game.outcome}`">
                  <span class="shogi-note__game-mark" aria-hidden="true">{{ game.mark }}</span>
                  <span class="shogi-note__game-body">
                    <span class="shogi-note__game-event">{{ game.event }}<small v-if="game.stage">{{ game.stage }}</small></span>
                    <span class="shogi-note__game-meta">{{ [game.date, game.opponent ? `対 ${game.opponent}` : "", FORM_TEXT[game.outcome]].filter(Boolean).join("・") }}</span>
                  </span>
                  <span class="shogi-note__game-rating">R{{ game.rating }}<small v-if="game.delta !== null">{{ game.delta >= 0 ? "+" : "−" }}{{ Math.abs(game.delta) }}</small></span>
                </li>
              </ol>
            </section>
          </template>
        </section>

        <!--
          戦型(8-3)。いちばん上に戦型(相居飛車・対抗形・相振り飛車)の割合、その下に「あなた」「相手」の戦法と囲いの使用率と勝率。
          横長とタブレットは2列、スマホの縦は「あなた」「相手」のタブ。表は5つまでで、残りは「ほか○個」。
        -->
        <section
          v-if="tab === 'style'"
          id="shogi-note-pane-style"
          class="shogi-note__panel shogi-note__panel--fit shogi-note__style"
          role="tabpanel"
          aria-label="戦型"
          :data-view="styleSide"
        >
          <div v-if="!state.games" class="shogi-note__card shogi-note__empty">
            <p>対局すると、使った戦法と囲いの使用率と勝率がここに並ぶよ。得意な戦法を見つけよう！</p>
          </div>
          <template v-else>
            <section class="shogi-note__card shogi-note__battle" aria-labelledby="shogi-note-battle" data-note-battle>
              <h2 id="shogi-note-battle">戦型<small class="shogi-note__count">{{ state.games }}局</small></h2>
              <p class="shogi-note__share" role="img" :aria-label="battleRows.map((row) => `${row.label}${row.share}%`).join('・')">
                <span
                  v-for="row in battleRows"
                  :key="row.id"
                  :class="`shogi-note__share--${row.id}`"
                  :style="{ width: `${row.share}%` }"
                ></span>
              </p>
              <ul class="shogi-note__share-legend">
                <li v-for="row in battleRows" :key="row.id">
                  <i :class="`shogi-note__share-swatch shogi-note__share--${row.id}`" aria-hidden="true"></i>
                  <b>{{ row.label }}</b> {{ row.share }}%<small>{{ row.winRate === null ? "" : `勝率${percent(row.winRate)}` }}</small>
                </li>
              </ul>
            </section>
            <div class="shogi-note__segmented shogi-note__narrow-only" role="tablist" aria-label="あなたと相手の切り替え">
              <button type="button" role="tab" :aria-selected="styleSide === 'own'" data-style-side="own" @click="styleSide = 'own'">あなた</button>
              <button type="button" role="tab" :aria-selected="styleSide === 'opponent'" data-style-side="opponent" @click="styleSide = 'opponent'">相手</button>
            </div>
            <section
              v-for="side in styleSides"
              :key="side.id"
              v-scroll-more
              class="shogi-note__card shogi-note__style-side shogi-note__scroll"
              :class="{ 'shogi-note__part--off': styleSide !== side.id }"
              :aria-label="side.title"
              :data-note-style="side.id"
            >
              <h2>{{ side.title }}</h2>
              <h3 class="shogi-note__subhead">戦法</h3>
              <p class="shogi-note__party" :aria-label="side.rook.map((row) => `${row.label}${row.share}%`).join('・')">
                <span class="shogi-note__party-bar" aria-hidden="true"><span :style="{ width: `${side.rook[0].share}%` }"></span></span>
                <span v-for="row in side.rook" :key="row.id" class="shogi-note__party-item">
                  <b>{{ row.label }}</b> {{ row.share }}%<small>{{ row.winRate === null ? "" : `勝率${percent(row.winRate)}` }}</small>
                </span>
              </p>
              <ul v-if="side.strategies.rows.length" class="shogi-note__usage" :aria-label="`${side.title}の戦法の使用率`">
                <li v-for="row in side.strategies.rows" :key="row.id">
                  <span class="shogi-note__name">
                    {{ row.label }}
                    <em v-if="row.tag === 'best'" class="shogi-note__tag shogi-note__tag--best">★得意</em>
                    <em v-else-if="row.tag === 'weak'" class="shogi-note__tag shogi-note__tag--weak">にがて</em>
                  </span>
                  <span class="shogi-note__bar" aria-hidden="true"><span :style="{ width: `${Math.max(3, row.share)}%` }"></span></span>
                  <span class="shogi-note__usage-share">{{ row.share }}%</span>
                  <span class="shogi-note__usage-stat">{{ row.stat }}</span>
                </li>
                <li v-if="side.strategies.restText" class="shogi-note__usage-rest">{{ side.strategies.restText }}</li>
              </ul>
              <p v-else class="shogi-note__hint">{{ side.strategies.empty }}</p>
              <p v-if="side.strategies.note" class="shogi-note__hint">{{ side.strategies.note }}</p>
              <h3 class="shogi-note__subhead">囲い</h3>
              <ul v-if="side.castles.rows.length" class="shogi-note__usage" :aria-label="`${side.title}の囲いの使用率`">
                <li v-for="row in side.castles.rows" :key="row.id">
                  <span class="shogi-note__name">
                    {{ row.label }}
                    <em v-if="row.tag === 'best'" class="shogi-note__tag shogi-note__tag--best">★得意</em>
                    <em v-else-if="row.tag === 'weak'" class="shogi-note__tag shogi-note__tag--weak">にがて</em>
                  </span>
                  <span class="shogi-note__bar" aria-hidden="true"><span :style="{ width: `${Math.max(3, row.share)}%` }"></span></span>
                  <span class="shogi-note__usage-share">{{ row.share }}%</span>
                  <span class="shogi-note__usage-stat">{{ row.stat }}</span>
                </li>
                <li v-if="side.castles.restText" class="shogi-note__usage-rest">{{ side.castles.restText }}</li>
              </ul>
              <p v-else class="shogi-note__hint">まだ記録がありません。</p>
            </section>
          </template>
        </section>

        <!--
          大会(docs/player-world-note-design.mdの3-2・8-3)。項目の中のタブで、棋戦(竜王戦・名人戦・研修会・奨励会の歩み)・
          賞状帳・観戦記・記録(寄せの記録・勝負メシ帳・研究ノート)に分ける。タブの名前に数を添える。
          棋戦の札は、いま(大きく)・最高・回数の同じ形。出ていない棋戦は1行の札。一覧は枠の中だけを動かす。
        -->
        <section
          v-if="tab === 'tournament'"
          id="shogi-note-pane-tournament"
          class="shogi-note__panel shogi-note__panel--fit shogi-note__tournament"
          role="tabpanel"
          aria-label="大会"
        >
          <div class="shogi-note__segmented" role="tablist" aria-label="大会の切り替え">
            <button
              v-for="item in tournamentViews"
              :key="item.id"
              type="button"
              role="tab"
              :aria-selected="tournamentView === item.id"
              :data-tournament-view="item.id"
              @click="tournamentView = item.id"
            >{{ item.label }}<small v-if="item.count !== null">{{ item.count }}</small></button>
          </div>

          <div v-if="tournamentView === 'events'" class="shogi-note__events" :style="eventGridStyle" data-note-events-view>
            <section
              :class="['shogi-note__card', 'shogi-note__event', eventClass('ryuo')]"
              :style="{ order: eventOrder.ryuo }"
              aria-labelledby="shogi-note-ryuo"
              data-note-ryuo
            >
              <h2 id="shogi-note-ryuo">竜王戦</h2>
              <template v-if="eventJoined.ryuo">
                <RyuoLadder class="shogi-note__event-ladder" :group="career.group" :champion="career.champion" />
                <dl class="shogi-note__event-stats">
                  <div class="shogi-note__event-now"><dt>いま</dt><dd>{{ career.champion ? "竜王" : `${career.group}組` }}</dd></div>
                  <div><dt>最高</dt><dd>{{ ryuoBest }}</dd></div>
                  <div><dt>参加</dt><dd>{{ career.seasons }}<small>期</small></dd><small class="shogi-note__event-sub">挑戦{{ career.challenges }}・竜王{{ career.titles }}</small></div>
                </dl>
                <p v-if="career.titles" class="shogi-note__hint">
                  連続{{ career.streak }}期・最長{{ career.bestStreak }}期{{ career.eternal ? "・永世竜王" : "" }}
                </p>
                <ol v-if="career.history.length" v-scroll-more class="shogi-note__history shogi-note__event-history shogi-note__scroll" aria-label="竜王戦のこれまでの成績" data-note-ryuo-history>
                  <li v-for="entry in recentHistory" :key="entry.no" :class="`shogi-note__history--${historyKind(entry)}`">
                    <span class="shogi-note__history-no">第{{ entry.no }}期</span>
                    <span class="shogi-note__history-group">{{ entry.mode === "defense" ? "防衛戦" : `${entry.startGroup}組` }}</span>
                    <span class="shogi-note__history-text">
                      {{ outcomeText(entry.outcome) }}{{ entry.promoted ? `・${entry.newGroup}組へ昇級` : "" }}{{ entry.relegated ? `・${entry.newGroup}組へ降級` : "" }}
                    </span>
                    <span class="shogi-note__history-record">{{ entry.wins }}勝{{ entry.losses }}敗</span>
                  </li>
                </ol>
              </template>
              <p v-else class="shogi-note__hint">まだ参加していません<span class="shogi-note__event-where">（タイトル画面の「大会」から）</span></p>
            </section>

            <section
              :class="['shogi-note__card', 'shogi-note__event', eventClass('meijin')]"
              :style="{ order: eventOrder.meijin }"
              aria-labelledby="shogi-note-meijin"
              data-note-meijin
            >
              <h2 id="shogi-note-meijin">名人戦</h2>
              <template v-if="eventJoined.meijin">
                <RyuoLadder class="shogi-note__event-ladder" kind="meijin" :meijin-class="meijinNow.cls" />
                <dl class="shogi-note__event-stats">
                  <div class="shogi-note__event-now"><dt>いま</dt><dd data-note-meijin-now>{{ meijinNow.text }}</dd></div>
                  <div><dt>最高</dt><dd>{{ meijinBest }}</dd></div>
                  <div><dt>参加</dt><dd>{{ meijinHistory.length }}<small>期</small></dd><small class="shogi-note__event-sub">名人{{ meijinCareer.titles ?? 0 }}期</small></div>
                </dl>
                <p v-if="meijinCareer.eternal" class="shogi-note__hint">永世名人</p>
                <ol v-if="meijinHistory.length" v-scroll-more class="shogi-note__history shogi-note__event-history shogi-note__scroll" aria-label="名人戦のこれまでの成績" data-note-meijin-history>
                  <li v-for="entry in recentMeijinHistory" :key="entry.no" :class="`shogi-note__history--${meijinHistoryKind(entry)}`">
                    <span class="shogi-note__history-no">第{{ entry.no }}期</span>
                    <span class="shogi-note__history-group">{{ meijinClassLabel(entry.cls) }}</span>
                    <span class="shogi-note__history-text">{{ meijinOutcome(entry.outcome) }}{{ entry.place ? `・${entry.place}位` : "" }}</span>
                    <span class="shogi-note__history-record">{{ entry.wins }}勝{{ entry.losses }}敗</span>
                  </li>
                </ol>
              </template>
              <p v-else class="shogi-note__hint">まだ参加していません<span class="shogi-note__event-where">（タイトル画面の「大会」から）</span></p>
            </section>

            <!-- 研修会の歩み(docs/kenshukai-design.md)。いまのクラスと、これまでの最高のクラス、これまでの挑戦。 -->
            <section
              :class="['shogi-note__card', 'shogi-note__event', eventClass('kenshukai')]"
              :style="{ order: eventOrder.kenshukai }"
              aria-labelledby="shogi-note-kenshukai"
              data-note-kenshukai
            >
              <h2 id="shogi-note-kenshukai">研修会</h2>
              <template v-if="eventJoined.kenshukai">
                <dl class="shogi-note__event-stats">
                  <div class="shogi-note__event-now"><dt>いま</dt><dd data-note-kenshukai-now>{{ kenshukaiNow }}</dd></div>
                  <div><dt>最高</dt><dd>{{ kenshukaiBest }}</dd></div>
                  <div><dt>挑戦</dt><dd>{{ kenshukai.history.length + (kenshukai.run ? 1 : 0) }}<small>回</small></dd><small class="shogi-note__event-sub">{{ kenshukaiGames }}局</small></div>
                </dl>
                <ol v-if="kenshukai.history.length" v-scroll-more class="shogi-note__history shogi-note__event-history shogi-note__scroll" aria-label="研修会のこれまでの挑戦" data-note-kenshukai-history>
                  <li v-for="entry in kenshukai.history.slice(0, 5)" :key="entry.id" :class="`shogi-note__history--${entry.result === 'closed' ? 'down' : 'crown'}`">
                    <span class="shogi-note__history-no">{{ entry.entry }}入会</span>
                    <span class="shogi-note__history-group">最高 {{ entry.best }}</span>
                    <span class="shogi-note__history-text">{{ KENSHUKAI_RESULT[entry.result] ?? "" }}</span>
                    <span class="shogi-note__history-record">{{ entry.wins }}勝{{ entry.losses }}敗</span>
                  </li>
                </ol>
              </template>
              <p v-else class="shogi-note__hint">まだ受験していません<span class="shogi-note__event-where">（タイトル画面の「大会」の「研修会」から）</span></p>
            </section>

            <!-- 奨励会の歩み(docs/shoreikai-design.mdの13章)。いまの段級か、四段の棋士番号と、これまでの挑戦。 -->
            <section
              :class="['shogi-note__card', 'shogi-note__event', eventClass('shoreikai')]"
              :style="{ order: eventOrder.shoreikai }"
              aria-labelledby="shogi-note-shoreikai"
              data-note-shoreikai
            >
              <h2 id="shogi-note-shoreikai">奨励会</h2>
              <template v-if="eventJoined.shoreikai">
                <dl class="shogi-note__event-stats">
                  <div class="shogi-note__event-now"><dt>いま</dt><dd data-note-shoreikai-now>{{ shoreikaiNow }}</dd></div>
                  <div><dt>最高</dt><dd>{{ shoreikaiBest }}</dd></div>
                  <div><dt>挑戦</dt><dd>{{ shoreikai.history.length + (shoreikai.run ? 1 : 0) }}<small>回</small></dd><small class="shogi-note__event-sub">{{ shoreikaiGames }}局</small></div>
                </dl>
                <p v-if="shoreikai.pro" class="shogi-note__hint">棋士番号{{ shoreikai.pro.kishiNumber }}号。{{ shoreikai.pro.entry }}で入会し、{{ shoreikai.pro.games }}局で四段{{ shoreikai.pro.mentor ? `（師匠 ${shoreikai.pro.mentor}）` : "" }}</p>
                <ol v-if="shoreikai.history.length" v-scroll-more class="shogi-note__history shogi-note__event-history shogi-note__scroll" aria-label="奨励会のこれまでの挑戦" data-note-shoreikai-history>
                  <li v-for="entry in shoreikai.history.slice(0, 5)" :key="entry.id" :class="`shogi-note__history--${entry.result === 'pro' ? 'crown' : 'down'}`">
                    <span class="shogi-note__history-no">{{ entry.entry }}入会</span>
                    <span class="shogi-note__history-group">最高 {{ entry.rank }}</span>
                    <span class="shogi-note__history-text">{{ entry.result === "pro" ? `四段・棋士番号${entry.kishiNumber}号` : "退会" }}</span>
                    <span class="shogi-note__history-record">{{ entry.wins }}勝{{ entry.losses }}敗</span>
                  </li>
                </ol>
              </template>
              <p v-else class="shogi-note__hint">まだ受験していません<span class="shogi-note__event-where">（タイトル画面の「大会」の「奨励会」から）</span></p>
            </section>
          </div>

          <section v-else-if="tournamentView === 'awards'" class="shogi-note__card shogi-note__list-card" aria-labelledby="shogi-note-awards" data-note-awards>
            <h2 id="shogi-note-awards">賞状帳<small class="shogi-note__count">{{ awards.length }}枚</small></h2>
            <ul v-if="awards.length" v-scroll-more class="shogi-note__awards shogi-note__scroll">
              <li v-for="item in shownAwards" :key="item.id">
                <button type="button" class="shogi-note__award-row" :data-note-award="item.id" @click="awardShown = item">
                  <span :class="['shogi-note__award-seal', `shogi-note__award-seal--${item.grade}`]" aria-hidden="true">{{ item.seal }}</span>
                  <span class="shogi-note__award-text">{{ awardLine(item) }}<small>{{ item.wins }}勝{{ item.losses }}敗{{ item.grade === "fight" ? "・敢闘賞" : "" }}</small></span>
                </button>
              </li>
            </ul>
            <p v-else class="shogi-note__hint">竜王戦や名人戦の期を終えると、表彰式で賞状がもらえるよ。ここにたまっていくからね。</p>
          </section>

          <!-- 観戦記(docs/title-match-day-design.mdの3章、docs/mate-finish-design.md)。大会の1局ごとに、新しい順。押すと紙面を開く。 -->
          <section v-else-if="tournamentView === 'kansenki'" class="shogi-note__card shogi-note__list-card" aria-labelledby="shogi-note-kansenki" data-note-kansenki>
            <h2 id="shogi-note-kansenki">観戦記<small class="shogi-note__count">{{ kansenki.length }}局</small></h2>
            <ul v-if="kansenki.length" v-scroll-more class="shogi-note__awards shogi-note__scroll">
              <li v-for="item in kansenki" :key="item.id">
                <button type="button" class="shogi-note__award-row" data-note-kansenki-row @click="kansenkiShown = item">
                  <span :class="['shogi-note__award-seal', item.win ? 'shogi-note__award-seal--gold' : 'shogi-note__award-seal--silver']" aria-hidden="true">{{ item.win ? "勝" : "負" }}</span>
                  <span class="shogi-note__award-text">{{ item.headline }}<small>{{ item.eventText }} {{ item.label }}</small></span>
                </button>
              </li>
            </ul>
            <p v-else class="shogi-note__hint">大会の対局を指すと、1局ごとに新聞の観戦記ができるよ。</p>
          </section>

          <div v-else class="shogi-note__records" data-note-records>
            <!-- 寄せの記録(docs/mate-finish-design.md)。大会で詰ませて勝った局の数、いちばん長い寄せ、最近の寄せ。 -->
            <section class="shogi-note__card shogi-note__list-card" aria-labelledby="shogi-note-mates" data-note-mates>
              <h2 id="shogi-note-mates">寄せの記録<small class="shogi-note__count">{{ mates.count }}局</small></h2>
              <template v-if="mates.best">
                <p class="shogi-note__mate-best" data-note-mate-best>
                  <b>{{ mates.best.plies }}手詰め</b><span>いちばん長い寄せ</span><small>{{ mateWhere(mates.best) }}</small>
                </p>
                <ol v-scroll-more class="shogi-note__mate-recent shogi-note__scroll" aria-label="最近の寄せ">
                  <li v-for="(item, index) in mates.recent" :key="`${item.at}-${index}`"><b>{{ item.plies }}手詰め</b><small>{{ mateWhere(item) }}</small></li>
                </ol>
              </template>
              <p v-else class="shogi-note__hint">大会の対局で詰ませて勝つと、最後の寄せが何手詰めだったかを、ここに残すよ。</p>
            </section>
            <!--
              勝負メシ帳(docs/title-match-day-design.mdの8-4)。タイトル戦の昼に選んだ品を、行った対局場ごとに献立の3品で並べる。
              勝った局の品は勝ちメシ(★)。まだ食べていない品も薄く出し、次に試す楽しみにする。
            -->
            <section class="shogi-note__card shogi-note__list-card" aria-labelledby="shogi-note-meals" data-note-meals>
              <h2 id="shogi-note-meals">勝負メシ帳<small class="shogi-note__count">{{ mealBook.tried }}/{{ mealBook.total }}品・勝ちメシ{{ mealBook.wins }}</small></h2>
              <ul v-if="mealBook.venues.length" v-scroll-more class="shogi-note__meals shogi-note__scroll">
                <li v-for="venue in mealBook.venues" :key="venue.venue" data-note-meal-venue>
                  <b>{{ venue.venue }}</b>
                  <span class="shogi-note__meal-items">
                    <span
                      v-for="item in venue.meals"
                      :key="item.meal"
                      :class="`shogi-note__meal--${item.state}`"
                      :aria-label="item.state === 'win' ? `${item.meal}（勝ちメシ）` : item.state === 'eaten' ? `${item.meal}（食べた）` : `${item.meal}（まだ）`"
                    ><i v-if="item.state === 'win'" aria-hidden="true">★</i>{{ item.meal }}</span>
                  </span>
                </li>
              </ul>
              <p v-else class="shogi-note__hint">タイトル戦（七番勝負）の昼休みに選んだ勝負メシが、ここに並ぶよ。勝った局の勝負メシは「勝ちメシ」の★がつくよ。</p>
            </section>
            <!-- 研究ノート(docs/tournament-relay-design.mdの24-5)。中継で残した局面を新しい順に。押すと盤で見て、中継で開ける。 -->
            <section class="shogi-note__card shogi-note__list-card" aria-labelledby="shogi-note-study" data-note-study>
              <h2 id="shogi-note-study">研究ノート<small class="shogi-note__count">{{ studyNotes.length }}局面</small></h2>
              <ul v-if="studyNotes.length" v-scroll-more class="shogi-note__awards shogi-note__scroll">
                <li v-for="note in studyNotes" :key="note.id">
                  <button type="button" class="shogi-note__award-row" data-note-study-row @click="studyShown = note">
                    <span class="shogi-note__award-seal shogi-note__award-seal--silver" aria-hidden="true">☆</span>
                    <span class="shogi-note__award-text">{{ note.moveText }}<small>{{ note.spec.label }}・☗{{ note.spec.black.name }} ☖{{ note.spec.white.name }}</small></span>
                  </button>
                </li>
              </ul>
              <p v-else class="shogi-note__hint">大会の中継の「☆ノート」で、気に入った局面を残せるよ。ここから、盤で見たり、中継をその手から見直したりできるよ。</p>
            </section>
          </div>
        </section>

        <!-- 棋士名鑑(docs/player-world-note-design.mdの3-3)。 -->
        <section v-if="tab === 'book'" id="shogi-note-pane-book" class="shogi-note__panel shogi-note__panel--fit shogi-note__panel--book" role="tabpanel" aria-label="棋士名鑑">
          <RyuoRosterBook ref="bookEl" :roster="roster" :initial-group="career.champion ? 1 : career.group" :asset-base-url="assetBaseUrl" />
        </section>

        <!--
          コレクション(docs/player-world-note-design.mdの4章・8-3)。いちばん上に印の合計と次の着せ替えまでのゲージ、
          「印のアルバム｜着せ替え」の切り替え。アルバムはページに分け、ページの切り替えは「戦法」(居飛車・振り飛車・奇襲)・
          「囲い」(居飛車・振り飛車)・「そのほか」(手筋・Lvの壁・記念)の見出しでまとめる。
          戦法・囲いは完成形の小さな盤のカード。作戦カードで使えるのにまだ組んでいないものを「挑戦できる」として先に出す。
          カードの一覧は枠の中だけを動かす。
        -->
        <section v-if="tab === 'collection'" id="shogi-note-pane-collection" class="shogi-note__panel shogi-note__panel--fit shogi-note__panel--album" role="tabpanel" aria-label="コレクション">
          <section class="shogi-note__card shogi-note__album-head" aria-labelledby="shogi-note-collection-count" data-note-collection>
            <div class="shogi-note__album-gauge">
              <h2 id="shogi-note-collection-count">集めた印<strong>{{ collectionTotal }}</strong><small>/ {{ collectionMax }}</small></h2>
              <template v-if="nextThemeView">
                <div class="shogi-note__gauge" role="progressbar" :aria-valuenow="nextThemeView.progress" aria-valuemin="0" aria-valuemax="100" :aria-label="`${nextThemeView.name}まで`">
                  <span :style="{ width: `${nextThemeView.progress}%` }"></span>
                </div>
                <p class="shogi-note__gauge-text" data-note-next-theme>
                  <img :src="nextThemeView.preview" alt="" aria-hidden="true">
                  着せ替え「{{ nextThemeView.name }}」まで、あと<b>{{ nextThemeView.remaining }}</b>個
                </p>
              </template>
              <p v-else class="shogi-note__gauge-text">着せ替えは全部使えるようになったよ！</p>
            </div>
            <div class="shogi-note__album-switch" role="tablist" aria-label="コレクションの切り替え">
              <button type="button" role="tab" :aria-selected="albumView === 'album'" data-album-view="album" @click="albumView = 'album'">印のアルバム</button>
              <button type="button" role="tab" :aria-selected="albumView === 'themes'" data-album-view="themes" @click="albumView = 'themes'">着せ替え</button>
            </div>
          </section>

          <template v-if="albumView === 'album'">
            <nav class="shogi-note__album-pages" role="tablist" aria-label="アルバムのページ">
              <div v-for="group in albumPageGroups" :key="group.label" class="shogi-note__album-group">
                <span class="shogi-note__album-group-label" aria-hidden="true">{{ group.label }}</span>
                <button
                  v-for="item in group.pages"
                  :key="item.id"
                  type="button"
                  role="tab"
                  :aria-selected="albumPage === item.id"
                  :aria-label="item.total ? `${item.name} ${item.got}/${item.total}` : item.name"
                  :data-album-page="item.id"
                  @click="chooseAlbumPage(item.id)"
                >{{ item.label }}<small v-if="item.total">{{ item.got }}/{{ item.total }}</small></button>
              </div>
            </nav>

            <!-- 戦法・囲い: 完成形の小さな盤のカード。押すと作戦カードのくわしい画面(なければ定跡図鑑)。 -->
            <section v-if="albumFormationPage" class="shogi-note__card shogi-note__album" :aria-label="albumPageLabel" data-album-cards>
              <p v-if="albumReadyCount" class="shogi-note__hint">「挑戦できる」は、作戦カードで選べるのに、まだ対局で組んでいない形だよ。押すと手順が見られるよ。</p>
              <ul v-scroll-more class="shogi-note__album-grid shogi-note__scroll">
                <li v-for="card in albumFormationCards" :key="card.key">
                  <button
                    type="button"
                    :class="['shogi-note__album-card', { 'shogi-note__album-card--got': card.got, 'shogi-note__album-card--ready': card.ready, 'shogi-note__album-card--new': card.isNew }]"
                    :data-album-card="card.key"
                    @click="openAlbumCard(card)"
                  >
                    <FormationThumb
                      class="shogi-note__album-thumb"
                      :strategy-id="card.kind === 'strategy' ? card.id : ''"
                      :castle-id="card.kind === 'castle' ? card.id : ''"
                      :silhouette="!card.got && !card.ready"
                    />
                    <span class="shogi-note__album-name">{{ card.label }}</span>
                    <small v-if="card.got" class="shogi-note__album-status">×{{ card.count }}</small>
                    <small v-else-if="card.ready" class="shogi-note__album-status shogi-note__album-status--ready">挑戦できる</small>
                    <small v-else class="shogi-note__album-status">まだ</small>
                    <em v-if="card.isNew" class="shogi-note__album-new">NEW</em>
                  </button>
                </li>
              </ul>
            </section>

            <!-- 手筋: 名前のカード。押すと手筋図鑑。 -->
            <section v-else-if="albumPage === 'tesuji'" class="shogi-note__card shogi-note__album" aria-label="手筋" data-album-tesuji>
              <p class="shogi-note__hint">対局で手筋図鑑の手筋や詰みの形を指すと、印が1つ増えるよ。</p>
              <ul v-scroll-more class="shogi-note__album-grid shogi-note__album-grid--text shogi-note__scroll">
                <li v-for="card in tesujiCards" :key="card.id">
                  <button
                    type="button"
                    :class="['shogi-note__album-card', 'shogi-note__album-card--text', { 'shogi-note__album-card--got': card.got, 'shogi-note__album-card--new': card.isNew }]"
                    :data-album-tesuji="card.id"
                    @click="emit('open-dex', { kind: 'tesuji', id: card.id })"
                  >
                    <span class="shogi-note__album-name">{{ card.label }}</span>
                    <small class="shogi-note__album-status">{{ card.got ? `×${card.count}` : "まだ" }}</small>
                    <em v-if="card.isNew" class="shogi-note__album-new">NEW</em>
                  </button>
                </li>
              </ul>
            </section>

            <!--
              教室のコツ(docs/nyumon-mode-design.mdの22-3): 12枚の文字のカード。対局で使ったカードは回数、覚えたがまだ使っていないカードは「覚えた」、
              覚えていないカードは薄く「まだ」(存在だけ見せる)。眺めるだけで、押しても画面は移らない。
            -->
            <section v-else-if="albumPage === 'tips'" class="shogi-note__card shogi-note__album" aria-label="教室のコツ" data-album-tips>
              <p class="shogi-note__hint">教室の「すぐ使えるコツ」で覚えた形を対局で使うと、回数が1つ増えるよ。</p>
              <ul v-scroll-more class="shogi-note__album-grid shogi-note__album-grid--text shogi-note__scroll">
                <li v-for="card in tipCards" :key="card.id">
                  <div
                    :class="['shogi-note__album-card', 'shogi-note__album-card--text', 'shogi-note__album-card--static', { 'shogi-note__album-card--got': card.count > 0 }]"
                    :data-album-tip="card.id"
                  >
                    <span class="shogi-note__album-name">{{ card.label }}</span>
                    <small class="shogi-note__album-status">{{ card.count ? `対局で×${card.count}` : card.learned ? "覚えた" : "まだ" }}</small>
                  </div>
                </li>
              </ul>
            </section>

            <!-- Lvの壁: 入門(24級〜16級)の9段と、10段ずつ4本の階段。次の壁を縁取り、おすすめの強さの前後に印。 -->
            <section v-else-if="albumPage === 'levels'" v-scroll-more class="shogi-note__card shogi-note__album shogi-note__scroll" aria-label="Lvの壁" data-album-levels>
              <p class="shogi-note__hint">
                CPUの各Lvに初めて勝つと、印が1つ増えるよ（レーティングの対象の対局だけ）。
                <template v-if="wall.next">次の壁は<b>Lv.{{ wall.next }}</b>。</template>
              </p>
              <div v-for="row in wall.rows" :key="row.id" class="shogi-note__wall-row">
                <p class="shogi-note__wall-label">{{ row.label }}<small>{{ row.got }}/{{ row.levels.length }}</small></p>
                <ol class="shogi-note__wall" :aria-label="`${row.label}のLv`">
                  <li
                    v-for="cell in row.levels"
                    :key="cell.level"
                    :class="{ 'shogi-note__wall--got': cell.got, 'shogi-note__wall--next': cell.next, 'shogi-note__wall--recommended': cell.recommended }"
                    :title="cell.got ? `Lv.${cell.level}に勝った` : `Lv.${cell.level}にはまだ勝っていない`"
                  >{{ cell.level }}</li>
                </ol>
              </div>
              <p class="shogi-note__wall-legend"><span class="shogi-note__wall-swatch shogi-note__wall-swatch--got"></span>勝った<span class="shogi-note__wall-swatch shogi-note__wall-swatch--next"></span>次の壁<span class="shogi-note__wall-swatch shogi-note__wall-swatch--recommended"></span>おすすめの強さ</p>
            </section>

            <!-- 記念: 印の数には入れないもの。 -->
            <section v-else v-scroll-more class="shogi-note__card shogi-note__album shogi-note__scroll" aria-label="記念" data-album-memorial>
              <dl class="shogi-note__tiles shogi-note__tiles--four">
                <div><dt>神の一手</dt><dd>{{ collection.godMoves }}<small>回</small></dd></div>
                <div data-note-predictions><dt>予想の的中</dt><dd>{{ collection.predictionsHit }}<small>回</small></dd></div>
                <div><dt>賞状</dt><dd>{{ awards.length }}<small>枚</small></dd></div>
                <div><dt>勝ったLv</dt><dd>{{ collectedLevelCount }}<small>/ {{ COLLECTION_LEVELS.length }}</small></dd></div>
              </dl>
              <template v-if="formationFanRows.length">
                <h3 class="shogi-note__subhead" data-note-fans>同じ形を得意にしている棋士</h3>
                <ul class="shogi-note__fans">
                  <li v-for="row in formationFanRows" :key="row.label">
                    <b>{{ row.label }}</b>
                    <span>{{ row.fans.map((fan) => `${fan.name}（${fan.group}組）`).join("・") }}</span>
                  </li>
                </ul>
              </template>
            </section>
          </template>

          <section v-else v-scroll-more class="shogi-note__card shogi-note__card--wide shogi-note__scroll" aria-labelledby="shogi-note-themes" data-album-themes>
            <h2 id="shogi-note-themes">着せ替え</h2>
            <div v-for="group in themeGroups" :key="group.kind" class="shogi-note__themes" role="radiogroup" :aria-label="group.label">
              <p class="shogi-note__subhead">{{ group.label }}</p>
              <ul>
                <li v-for="theme in group.themes" :key="theme.id">
                  <button
                    type="button"
                    role="radio"
                    class="shogi-note__theme"
                    :class="{ 'shogi-note__theme--locked': !theme.unlocked }"
                    :aria-checked="theme.selected"
                    :disabled="!theme.unlocked"
                    :data-theme="`${group.kind}:${theme.id}`"
                    @click="chooseTheme(group.kind, theme.id)"
                  >
                    <img :src="theme.preview" alt="" aria-hidden="true">
                    <span>{{ theme.name }}</span>
                    <small v-if="!theme.unlocked">印あと{{ theme.remaining }}個</small>
                    <small v-else-if="theme.selected">使用中</small>
                  </button>
                </li>
              </ul>
            </div>
          </section>
        </section>

        <!--
          棋力の調整に使う項目。棋力を測るのは「まとめ」のボタンだけにする(重ねて置かない。8-3)。
        -->
        <section v-if="tab === 'settings'" id="shogi-note-pane-settings" class="shogi-note__panel shogi-note__panel--fit shogi-note__settings" role="tabpanel" aria-label="設定">
          <!-- 棋力テストの答えを名前なしで送るか(公式の公開先だけ。docs/skill-assessment-design.mdの7-2)。 -->
          <section v-if="skillDataAvailable" class="shogi-note__card shogi-note__card--minor" data-note-skill-data>
            <h2>答えを送って、問題を良くする</h2>
            <p class="shogi-note__hint">
              棋力テストの答えとCPUとの対局の結果を、名前なしで送ります。<span class="shogi-note__more">みんなの答えで、問題の難しさを正しくするのに使います。</span>名前や棋譜は送りません。
            </p>
            <div class="shogi-note__declare">
              <button type="button" class="shogi-note__button" :class="{ 'shogi-note__button--ghost': skillDataConsent !== 'yes' }" :aria-pressed="skillDataConsent === 'yes'" @click="emit('skill-data-consent', 'yes')">送る</button>
              <button type="button" class="shogi-note__button" :class="{ 'shogi-note__button--ghost': skillDataConsent === 'yes' }" :aria-pressed="skillDataConsent !== 'yes'" @click="emit('skill-data-consent', 'no')">送らない</button>
            </div>
          </section>

          <section class="shogi-note__card shogi-note__card--minor">
            <h2>段級位を申告する</h2>
            <p class="shogi-note__hint">
              日本将棋連盟の段級位で申告すると、レーティングをその棋力に設定します。<span class="shogi-note__more">以降の対局は申告ごとにCPUのレベル別の成績を記録し、表示名と実際の棋力のずれを調べるのに使います。</span>
            </p>
            <p v-if="state.declared" class="shogi-note__hint" data-note-declared>
              申告中: {{ state.declared.label }}（{{ declaredDate }}に設定）
            </p>
            <p v-if="state.measured" class="shogi-note__hint" data-note-measured>
              棋力測定で R{{ state.measured.rating }}（{{ state.measured.label }}）を設定しました（{{ measuredDate }}）。<span class="shogi-note__more">棋力は「まとめ」の「棋力を測る」から測れます。</span>
            </p>
            <div class="shogi-note__declare">
              <select v-model="declareLabel" aria-label="申告する段級位">
                <option value="">段級位を選ぶ</option>
                <option v-for="grade in grades" :key="grade.label" :value="grade.label">{{ grade.label }}</option>
              </select>
              <button type="button" class="shogi-note__button" :disabled="!declareLabel" @click="declare">申告して設定</button>
            </div>
          </section>

          <!--
            CPUのレベルごとの成績。申告中なら、申告した棋力での成績を同じ札の下に続ける(札を1枚にして、小さいスマホでも1画面に収める。8-6)。
            「戦績データをコピー」は見出しの横に小さく置く。
          -->
          <section v-if="levelRows.length || declaredRows.length || state.games" class="shogi-note__card shogi-note__card--minor shogi-note__level-card" aria-labelledby="shogi-note-levels">
            <div class="shogi-note__level-head">
              <h2 id="shogi-note-levels">CPUのレベルごとの成績</h2>
              <button v-if="state.games" type="button" class="shogi-note__button shogi-note__button--ghost shogi-note__copy" data-note-copy @click="copyRecord">{{ copied ? "コピーしました" : "戦績をコピー" }}</button>
            </div>
            <div v-scroll-more class="shogi-note__level-lists shogi-note__scroll">
              <ul v-if="levelRows.length" class="shogi-note__rows">
                <li v-for="row in levelRows" :key="row.level">
                  <span class="shogi-note__name">Lv.{{ row.level }} {{ row.label }}</span>
                  <span class="shogi-note__stat">R{{ row.rating }}・{{ row.wins }}勝{{ row.losses }}敗{{ row.draws }}分</span>
                </li>
              </ul>
              <p v-else class="shogi-note__hint">レーティングに数える対局をすると、ここにLvごとの成績が出ます。</p>
              <template v-if="declaredRows.length">
                <h3 id="shogi-note-declared" class="shogi-note__subhead">申告した棋力（{{ state.declared?.label }}）での成績</h3>
                <ul class="shogi-note__rows" aria-labelledby="shogi-note-declared">
                  <li v-for="row in declaredRows" :key="row.level">
                    <span class="shogi-note__name">Lv.{{ row.level }} {{ row.label }}</span>
                    <span class="shogi-note__stat">{{ row.wins }}勝{{ row.losses }}敗{{ row.draws }}分</span>
                  </li>
                </ul>
              </template>
            </div>
          </section>
        </section>
      </main>
      <SeasonAward v-if="awardShown" :award="awardShown" :asset-base-url="assetBaseUrl" @done="awardShown = null" />
      <TitleDaySheet v-if="kansenkiShown" mode="kansenki" :article="kansenkiShown" @close="kansenkiShown = null" />
      <!-- 研究ノートの局面(24-5)。盤と、中継で開く・消す。 -->
      <div v-if="studyShown" class="shogi-note__sheet" role="dialog" aria-modal="true" aria-label="研究ノートの局面" data-note-study-sheet @click.self="studyShown = null">
        <div class="shogi-note__sheet-panel shogi-note__study">
          <h2>{{ studyShown.moveText }}</h2>
          <p class="shogi-note__hint">{{ studyShown.spec.label }}・☗{{ studyShown.spec.black.name }} ☖{{ studyShown.spec.white.name }}</p>
          <div class="shogi-note__study-board">
            <StudyBoard
              :sfen="studyShown.sfen"
              :allow-move="false"
              :enable-drag-and-drop="false"
              layout="compact"
              :asset-base-url="assetBaseUrl"
              :black-player-name="studyShown.spec.black.name"
              :white-player-name="studyShown.spec.white.name"
            />
          </div>
          <div class="shogi-note__study-actions">
            <button v-if="relayEngineFactory && studyRelayKept" type="button" class="shogi-note__button" data-note-study-relay @click="studyRelay = studyShown">中継で開く</button>
            <button type="button" class="shogi-note__button shogi-note__button--ghost" data-note-study-remove @click="removeStudy(studyShown.id)">消す</button>
            <button type="button" class="shogi-note__button shogi-note__button--ghost" @click="studyShown = null">閉じる</button>
          </div>
        </div>
      </div>
      <StudyRelay
        v-if="studyRelay && relayEngineFactory"
        :spec="studyRelay.spec"
        :start-at="studyRelay.ply"
        :asset-base-url="assetBaseUrl"
        :engine-factory="relayEngineFactory"
        @close="studyRelay = null"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, ref, watch, type PropType } from "vue";
import { vScrollMore } from "./composables/vScrollMore";
import { battleSplit, repertoireTable, rookSplit, usageTable } from "./core/style-usage.mjs";
import { usageRows as openingUsageRows } from "./core/opening-usage.mjs";
import RyuoLadder from "./RyuoLadder.vue";
import RyuoRosterBook from "./RyuoRosterBook.vue";
import YakobiSays from "./YakobiSays.vue";
import {
  declarableGrades,
  gradeName as gradeNameOf,
  levelRating,
  nextRatingGoal,
  RATED_EVENTS,
  ratingLevel,
  recommendedLevel,
  usageRows,
} from "./core/player-rating.mjs";
import PlayerAbilityPanel from "./PlayerAbilityPanel.vue";
import { myAbilityProfile, myRepertoire } from "./core/my-abilities.mjs";
import { difficultyName } from "./core/tournament-world.mjs";
import { ABILITIES, abilityRank, abilityValues } from "./core/player-abilities.mjs";
import { HANANE } from "./core/ryuo-story.mjs";
import { CPU_STRENGTH_PRESETS } from "./core/strength-settings.mjs";
import { currentAffiliation } from "./core/player-profile.mjs";
import { currentStreak, loadPlayStreak, streakLine } from "./core/play-streak.mjs";
import {
  ALBUM_PAGES,
  ALBUM_PAGE_GROUPS,
  COLLECTION_LEVELS,
  THEME_UNLOCKS,
  albumCards,
  albumPageId,
  albumPageOf,
  collectionCatalog,
  collectionCount,
  levelWall,
  loadCollection,
  loadCollectionSeen,
  nextThemeUnlock,
  planCardsByFormation,
  saveCollectionSeen,
  themeUnlock,
} from "./core/collection.mjs";
import { ALL_OPENING_PLANS } from "./core/opening-catalog.mjs";
import FormationThumb from "./FormationThumb.vue";
import { OPENING_CASTLES, OPENING_STRATEGIES } from "./core/opening-guide.mjs";
import { TESUJI_NAMES } from "./core/move-tesuji.mjs";
import { formationFans } from "./core/ryuo-book.mjs";
import {
  BOARD_THEMES,
  BOARD_THEME_KEY,
  DEFAULT_BOARD_THEME,
  DEFAULT_PIECE_THEME,
  PIECE_THEMES,
  PIECE_THEME_KEY,
  saveTheme,
} from "./core/themes.mjs";
import { outcomeText } from "./core/ryuo-career.mjs";
import { CLASS_LABELS, MEIJIN_OUTCOME_TEXT } from "./core/meijin.mjs";
import { junniClassOf, junniPlaceOf } from "./core/ryuo-league.mjs";
import { awardLine } from "./core/season-award.mjs";
import SeasonAward, { type SeasonAwardData } from "./SeasonAward.vue";
import TitleDaySheet, { type KansenkiView } from "./TitleDaySheet.vue";
import { loadKansenki, loadMealBook, mealBookView } from "./core/title-day.mjs";
import { loadMateRecords } from "./core/mate-finish.mjs";
import { TIP_MOMENTS, loadTipUses } from "./core/tip-moments.mjs";
import { learnedTips, loadTutorialProgress } from "./core/tutorial-progress.mjs";
import { loadNotes, removeNote, saveNotes } from "./core/relay-fun.mjs";
import { loadRelayStore, recallRelayGame } from "./core/relay-store.mjs";
import type { EngineFactory } from "./composables/match/analysisEngines";
import { loadShoreikai, rankLabel } from "./core/shoreikai.mjs";
import { classLabel as kenshukaiClassLabel, loadKenshukai } from "./core/kenshukai.mjs";

type Tally = { wins: number; losses: number; draws: number };
type GameOutcome = "win" | "loss" | "draw";
type RatingState = {
  ladder: number;
  ladderNotice: { beforeRating: number; afterRating: number; beforeLabel: string; afterLabel: string } | null;
  rating: number;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  levels: { [level: string]: Tally };
  colors: { [color: string]: Tally };
  events: { [event: string]: Tally };
  usage: { [category: string]: { [name: string]: Tally } };
  measured: { rating: number; label: string; at: number } | null;
  declared: { label: string; level: number; at: number } | null;
  declaredLevels: { [label: string]: { [level: string]: Tally } };
  history: HistoryRecord[];
  /** レーティングの幅(棋力測定・申告のあとだけ。player-rating.mjs)。 */
  deviation: number | null;
};
/** レーティングの記録。対局の結果には、棋戦・相手・段階も付く(棋戦を記録する前の対局は、自由対局)。 */
type HistoryRecord = {
  rating: number; outcome?: string; at?: number; opponentLevel?: number; event?: string; opponent?: string; stage?: string;
};

type ProfileState = {
  titles: { id: string; label: string; detail: string; rank: number; at: number }[];
};
type HistoryEntry = {
  no: number; mode: string; startGroup: number; newGroup: number; outcome: string; wins: number; losses: number; promoted: boolean; relegated: boolean;
};
type RyuoCareer = {
  group: number; seasons: number; champion: boolean; titles: number; streak: number; bestStreak: number;
  challenges: number; eternal: boolean;
  history: HistoryEntry[];
};
type MeijinHistoryEntry = { no: number; cls: string; wins: number; losses: number; place: number | null; outcome: string; next: string | null };
type MeijinCareer = { no: number; best: string; titles: number; eternal: boolean; history: MeijinHistoryEntry[] };
type UsageRow = { name: string; wins: number; losses: number; draws: number; games: number; rate: number };

const props = defineProps({
  assetBaseUrl: { type: String, default: "." },
  backLabel: { type: String, default: "タイトルへ戻る" },
  /** 開いたときの項目(大会の結果の画面からは「大会」)。空なら最後に開いた項目。覚えている項目は変えない。 */
  initialTab: { type: String, default: "" },
  state: { type: Object as PropType<RatingState>, required: true },
  profile: { type: Object as PropType<ProfileState>, default: () => ({ titles: [] }) },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  roster: { type: Object as PropType<any>, default: null },
  career: {
    type: Object as PropType<RyuoCareer>,
    default: () => ({ group: 6, seasons: 0, champion: false, titles: 0, streak: 0, bestStreak: 0, challenges: 0, eternal: false, history: [] }),
  },
  /** 名人戦のキャリア(プレイヤーの歩み。meijin.mjs)。 */
  meijinCareer: { type: Object as PropType<MeijinCareer>, default: () => ({ no: 0, best: "C2", titles: 0, eternal: false, history: [] }) },
  /** 賞状帳(core/season-award.mjs。古い順)。 */
  awards: { type: Array as PropType<SeasonAwardData[]>, default: () => [] },
  /** 作戦カードで使える作戦のid(コレクションの「挑戦できる」)。 */
  unlockedPlanIds: { type: Array as PropType<string[]>, default: () => [] },
  /** 最近の対局の中身の要約(play-insight.mjsのgames)。能力の項目に使う。 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  insightGames: { type: Array as PropType<any[]>, default: () => [] },
  /** 竜王戦の難易度(能力の物差し)。期を始めていなければnull(おすすめを使う)。 */
  ryuoDifficulty: { type: Number as PropType<number | null>, default: null },
  /** 世界の物差し(6組の平均を指させるLv。core/tournament-world.mjs)。あれば、能力の全体の高さをこれで出す。 */
  ryuoWorld: { type: Number as PropType<number | null>, default: null },
  /** 棋力テストの答えを送るかの同意('yes'・'no'・'')と、送れる場所で開いているか(core/skill-data.mjs)。 */
  skillDataConsent: { type: String, default: "" },
  skillDataAvailable: { type: Boolean, default: false },
  /** 中継の棋譜を作るエンジン(研究ノートから中継を開くのに使う。24-5)。 */
  relayEngineFactory: { type: Function as PropType<() => Promise<EngineFactory>>, default: null },
});
const emit = defineEmits<{
  close: [];
  "start-match": [];
  "start-measure": [];
  declare: [grade: unknown];
  "skill-data-consent": [value: "yes" | "no"];
  /** コレクションのカードから、作戦カードのくわしい画面を開く(対局準備へ)。 */
  "open-plan": [planId: string];
  /** コレクションのカードから、定跡図鑑・手筋図鑑を開く。 */
  "open-dex": [target: { kind: string; id: string }];
}>();

/** ノートの項目。最後に開いた項目を、この端末で覚えておく。 */
const TABS = [
  { id: "summary", label: "まとめ", short: "まとめ", description: "いまの棋力と次の目標" },
  { id: "ability", label: "能力", short: "能力", description: "得意と苦手のレーダーチャート" },
  { id: "record", label: "成績", short: "成績", description: "勝ち負けと推移" },
  { id: "style", label: "戦型", short: "戦型", description: "得意な戦法・囲いと使用率" },
  { id: "tournament", label: "大会", short: "大会", description: "棋戦の歩み・賞状・観戦記" },
  { id: "book", label: "棋士名鑑", short: "名鑑", description: "棋士と、あなたとの対戦" },
  { id: "collection", label: "コレクション", short: "コレクション", description: "集めた印と着せ替え" },
  { id: "settings", label: "設定", short: "設定", description: "段級位の申告と、Lvごとの成績" },
] as const;
type TabId = typeof TABS[number]["id"];
const TAB_STORAGE_KEY = "yacobihime:shogi-match:note-tab";
function loadTab(): TabId {
  try {
    // 前の版の「竜王戦」の項目は、「大会」として開く。
    const saved = localStorage.getItem(TAB_STORAGE_KEY) === "ryuo" ? "tournament" : localStorage.getItem(TAB_STORAGE_KEY);
    return TABS.some(({ id }) => id === saved) ? saved as TabId : "summary";
  } catch {
    return "summary";
  }
}
const tab = ref<TabId>(TABS.some(({ id }) => id === props.initialTab) ? props.initialTab as TabId : loadTab());
function selectTab(id: TabId) {
  tab.value = id;
  try {
    localStorage.setItem(TAB_STORAGE_KEY, id);
  } catch {
    // 保存できなくても、タブは切り替わる。
  }
}

/*
 * コレクション(core/collection.mjs)。開いたときに端末の保存から読む。
 * 着せ替えは、ここで選ぶと保存し、開いている盤にも知らせる(core/themes.mjsのsaveTheme)。
 */
const COLLECTION_CATALOG = collectionCatalog({ strategies: OPENING_STRATEGIES, castles: OPENING_CASTLES });
const collection = ref(loadCollection(safeStorage()));
const collectedLevelCount = computed(() => COLLECTION_LEVELS.filter((level) => collection.value.levels[level]).length);
const collectionTotal = computed(() => collectionCount(collection.value));
const TESUJI_IDS = Object.keys(TESUJI_NAMES);
const collectionMax = COLLECTION_CATALOG.length + TESUJI_IDS.length + COLLECTION_LEVELS.length;
/** 組んだ戦法・囲いごとに、それを得意にしている棋士(上の組から3人まで)。名鑑がないときは出さない。 */
const formationFanRows = computed(() => COLLECTION_CATALOG
  .filter(({ label }) => collection.value.formations[label])
  .map((entry) => ({ label: entry.label, fans: formationFans(props.roster, { kind: entry.kind, id: entry.id }) }))
  .filter(({ fans }) => fans.length)
  .slice(0, 8));

// ---- アルバム(docs/player-world-note-design.mdの4章)
/** 印のアルバムか、着せ替えか。 */
const albumView = ref<"album" | "themes">("album");
const ALBUM_PAGE_KEY = "yacobihime:shogi-match:note-album-page";
const albumPage = ref((() => {
  try {
    return albumPageId(localStorage.getItem(ALBUM_PAGE_KEY));
  } catch {
    return "static";
  }
})());
function chooseAlbumPage(id: string) {
  albumPage.value = id;
  try {
    localStorage.setItem(ALBUM_PAGE_KEY, id);
  } catch {
    // 覚えられなくても、ページは切り替わる。
  }
}
/** 最後にコレクションを開いた時刻。これより後に初めて取った印に「NEW」を付ける(このノートを開いている間は付けたまま)。 */
const collectionSeenAt = loadCollectionSeen(safeStorage());
watch(tab, (id) => {
  if (id === "collection") saveCollectionSeen(safeStorage());
}, { immediate: true });
/** 作戦カードで使える戦法・囲い(「挑戦できる」と、押したときに開く作戦カード)。 */
const playable = computed(() => planCardsByFormation(ALL_OPENING_PLANS, props.unlockedPlanIds));
const FORMATION_PAGES = new Set(["static", "ranging", "surprise", "castle-static", "castle-ranging"]);
const albumFormationPage = computed(() => FORMATION_PAGES.has(albumPage.value));
const albumFormationCards = computed(() => (albumFormationPage.value
  ? albumCards(collection.value, COLLECTION_CATALOG, albumPage.value, { playable: playable.value, seenAt: collectionSeenAt })
  : []));
const albumReadyCount = computed(() => albumFormationCards.value.filter(({ ready }) => ready).length);
const albumPageLabel = computed(() => ALBUM_PAGES.find(({ id }) => id === albumPage.value)?.name ?? "");
const tesujiCards = computed(() => TESUJI_IDS.map((id) => {
  const got = collection.value.tesuji?.[id];
  return {
    id, label: TESUJI_NAMES[id as keyof typeof TESUJI_NAMES], got: Boolean(got), count: got?.count ?? 0,
    isNew: Boolean(got && collectionSeenAt && got.firstAt > collectionSeenAt),
  };
}));
/** 教室のコツ(22-3)。使った回数は対局画面が残し(tip-moments.mjs)、覚えたかは教室の記録で決める。ノートを開くたびに読む。 */
const tipUses = loadTipUses(safeStorage());
const tipsLearned = new Set(learnedTips(loadTutorialProgress(safeStorage())));
const tipCards = TIP_MOMENTS.map(({ id, short }) => ({ id, label: short, count: tipUses[id] ?? 0, learned: tipsLearned.has(id) }));
const wall = computed(() => levelWall(collection.value, { recommended: props.state.games ? recommendedLevel(props.state.rating) : null }));
/** ページの切り替えに、取った数と全部の数を添える(記念は数えない)。 */
const albumPageTabs = computed(() => ALBUM_PAGES.map((page) => {
  if (FORMATION_PAGES.has(page.id)) {
    const cards = COLLECTION_CATALOG.filter((entry) => albumPageOf(entry) === page.id);
    return { ...page, total: cards.length, got: cards.filter(({ label }) => collection.value.formations[label]).length };
  }
  if (page.id === "tesuji") return { ...page, total: TESUJI_IDS.length, got: TESUJI_IDS.filter((id) => collection.value.tesuji?.[id]).length };
  if (page.id === "levels") return { ...page, total: COLLECTION_LEVELS.length, got: collectedLevelCount.value };
  if (page.id === "tips") return { ...page, total: tipCards.length, got: tipCards.filter(({ count }) => count > 0).length };
  return { ...page, total: 0, got: 0 };
}));
/** ページの切り替えを、見出し(戦法・囲い・そのほか)ごとにまとめる。 */
const albumPageGroups = computed(() => ALBUM_PAGE_GROUPS.map((label) => ({ label, pages: albumPageTabs.value.filter((page) => page.group === label) })));
/** 戦法・囲いのカードを押した。作戦カードがあれば、その作戦のくわしい画面(手順の再生と「この作戦にする」)。なければ定跡図鑑。 */
function openAlbumCard(card: { kind: string; id: string; planId: string }) {
  if (card.planId) emit("open-plan", card.planId);
  else emit("open-dex", { kind: "opening", id: card.id });
}
/** 次に使えるようになる着せ替えと、そこまでのゲージ(前の着せ替えから次までの割合)。 */
const nextThemeView = computed(() => {
  const next = nextThemeUnlock(collection.value);
  if (!next) return null;
  const count = collectionTotal.value;
  const needs = Object.values(THEME_UNLOCKS).flatMap((table) => Object.values(table) as number[]);
  const previous = Math.max(0, ...needs.filter((need) => need <= count));
  const kind = (["board", "piece"] as const).find((name) => (Object.values(THEME_UNLOCKS[name]) as number[]).includes(next.need)) ?? "board";
  const id = Object.entries(THEME_UNLOCKS[kind]).find(([, need]) => need === next.need)?.[0] ?? "";
  const theme = (kind === "board" ? BOARD_THEMES : PIECE_THEMES).find((entry) => entry.id === id);
  const preview = kind === "board" ? `${assetBase.value}/board/${(theme as { file?: string } | undefined)?.file ?? ""}` : `${assetBase.value}/piece/${id}/black_king2.webp`;
  return {
    name: theme?.name ?? "",
    preview,
    remaining: next.remaining,
    progress: Math.round(((count - previous) / Math.max(1, next.need - previous)) * 100),
  };
});
function safeStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
const selectedThemes = ref({
  board: safeStorage()?.getItem(BOARD_THEME_KEY) || DEFAULT_BOARD_THEME,
  piece: safeStorage()?.getItem(PIECE_THEME_KEY) || DEFAULT_PIECE_THEME,
});
const assetBase = computed(() => props.assetBaseUrl.replace(/\/$/, ""));
const themeGroups = computed(() => ([
  { kind: "board" as const, label: "盤", themes: BOARD_THEMES.map((theme) => ({ ...theme, preview: `${assetBase.value}/board/${theme.file}` })) },
  { kind: "piece" as const, label: "駒", themes: PIECE_THEMES.map((theme) => ({ ...theme, preview: `${assetBase.value}/piece/${theme.id}/black_king2.webp` })) },
]).map((group) => ({
  ...group,
  themes: group.themes.map((theme) => {
    const unlock = themeUnlock(collection.value, group.kind, theme.id);
    return { ...theme, unlocked: unlock.unlocked, remaining: unlock.remaining, selected: selectedThemes.value[group.kind] === theme.id };
  }),
})));
function chooseTheme(kind: "board" | "piece", id: string) {
  if (!themeUnlock(collection.value, kind, id).unlocked) return;
  selectedThemes.value = { ...selectedThemes.value, [kind]: id };
  saveTheme(kind, id);
}

/**
 * 続けて遊んだ日(core/play-streak.mjs)。1局指す・1問解く・レッスンを終えると数える。
 * 週に1日はおやすみしても続く。途切れても、いちばん長い記録は残る。
 */
const playStreak = (() => {
  const saved = loadPlayStreak(safeStorage());
  return { current: currentStreak(saved).current, best: saved.best };
})();
const playStreakLine = streakLine(currentStreak(loadPlayStreak(safeStorage())));

const measuredDate = computed(() => {
  const at = props.state.measured?.at;
  return at ? new Date(at).toLocaleDateString("ja-JP") : "";
});
const affiliation = computed(() => currentAffiliation(props.profile));
/** 所属に使った称号のほかの称号を、高いものから並べる。 */
const otherTitles = computed(() => [...props.profile.titles]
  .filter((title) => title.id !== affiliation.value?.id)
  .sort((a, b) => b.rank - a.rank || a.at - b.at));
const recentHistory = computed(() => [...props.career.history].reverse().slice(0, 8));
/** 成績の行の色分け: 竜王・昇級・降級・そのほか。 */
function historyKind(entry: HistoryEntry) {
  if (entry.outcome === "champion") return "crown";
  if (entry.promoted) return "up";
  if (entry.relegated || entry.outcome === "defense-lost") return "down";
  return "stay";
}
// ---- 名人戦の歩み(大会の項目)。いまのクラスと順位は、名簿の順位戦の世界(roster.junni)から読む。
const meijinHistory = computed(() => props.meijinCareer.history ?? []);
const recentMeijinHistory = computed(() => [...meijinHistory.value].reverse().slice(0, 8));
const meijinClassLabel = (cls: string) => (cls === "meijin" ? "名人" : CLASS_LABELS[cls as keyof typeof CLASS_LABELS] ?? cls);
const meijinOutcome = (outcome: string) => MEIJIN_OUTCOME_TEXT[outcome as keyof typeof MEIJIN_OUTCOME_TEXT] ?? outcome;
const meijinNow = computed(() => {
  const world = props.roster?.junni;
  const cls = world ? junniClassOf(world, "user") : null;
  if (!cls || cls === "F") return { cls: "", text: "—" };
  if (cls === "meijin") return { cls, text: "名人" };
  return { cls, text: `${meijinClassLabel(cls)} ${junniPlaceOf(world, "user")}位` };
});
const meijinBest = computed(() => (meijinHistory.value.length ? meijinClassLabel(props.meijinCareer.best) : "—"));
/** 成績の行の色分け: 名人・昇級・降級(降級点)・そのほか。 */
function meijinHistoryKind(entry: MeijinHistoryEntry) {
  if (["meijin", "defend"].includes(entry.outcome)) return "crown";
  if (["promote", "challenger"].includes(entry.outcome)) return "up";
  if (["demote", "point", "lost-title"].includes(entry.outcome)) return "down";
  return "stay";
}

// ---- 賞状帳(大会の項目の「賞状」)。新しい順に全部(一覧は枠の中で動かす)。押すと賞状を開く(動かさない)。
const shownAwards = computed(() => [...props.awards].reverse());
const awardShown = ref<SeasonAwardData | null>(null);
// ---- 奨励会の歩み(大会の項目)。保存から読む(対局画面と同じキー)。
const shoreikai = ref(loadShoreikai(typeof localStorage === "undefined" ? null : localStorage));
const shoreikaiNow = computed(() => {
  const run = shoreikai.value.run;
  if (run?.phase === "exam" || run?.phase === "failed") return `${rankLabel(run.exam?.rank ?? run.rank)}受験`;
  if (run?.phase === "reikai" || run?.phase === "league") return rankLabel(run.rank);
  return shoreikai.value.pro ? "四段" : "—";
});
const shoreikaiGames = computed(() => (shoreikai.value.run?.games?.length ?? 0)
  + shoreikai.value.history.reduce((sum: number, entry: { games: number }) => sum + (entry.games ?? 0), 0));
// ---- 研修会の歩み(大会の項目)。保存から読む(対局画面と同じキー)。
const kenshukai = ref(loadKenshukai(typeof localStorage === "undefined" ? null : localStorage));
const KENSHUKAI_RESULT: Record<string, string> = { transfer: "奨励会6級に編入", top: "Sクラス", closed: "終えた" };
const kenshukaiNow = computed(() => {
  const run = kenshukai.value.run;
  if (run?.phase === "exam") return `${kenshukaiClassLabel(run.exam.cls)}受験`;
  if (run) return kenshukaiClassLabel(run.cls);
  return "—";
});
const kenshukaiBest = computed(() => {
  const run = kenshukai.value.run;
  const best = Math.max(kenshukai.value.best ?? -1, run && run.phase !== "exam" ? run.best : -1);
  return best >= 0 ? kenshukaiClassLabel(best) : "—";
});
const kenshukaiGames = computed(() => (kenshukai.value.run?.games?.length ?? 0)
  + kenshukai.value.history.reduce((sum: number, entry: { games: number }) => sum + (entry.games ?? 0), 0));
// ---- 観戦記(大会の項目の「観戦記」)。新しい順に全部。
const kansenki = ref<(KansenkiView & { id: string; win?: boolean })[]>(loadKansenki(typeof localStorage === "undefined" ? null : localStorage));
/** 寄せの記録(docs/mate-finish-design.md)。 */
const mates = loadMateRecords(typeof localStorage === "undefined" ? null : localStorage);
/** どの対局の寄せか(「第3期 竜王戦 決勝トーナメント 2回戦・対 中村大輔」)。 */
function mateWhere(item: { eventText?: string; label?: string; opponent?: string }) {
  return [[item.eventText, item.label].filter(Boolean).join(" "), item.opponent ? `対 ${item.opponent}` : ""].filter(Boolean).join("・");
}
const kansenkiShown = ref<KansenkiView | null>(null);
/** 勝負メシ帳(対局場ごとの献立の3品と、勝ちメシ)。 */
const mealBook = mealBookView(loadMealBook(typeof localStorage === "undefined" ? null : localStorage));

// ---- 研究ノート(24-5)。中継で残した局面。盤は開いたときに読み込む(重い部品なので)。
const StudyBoard = defineAsyncComponent(() => import("./ShogiMatchBoard.vue"));
const StudyRelay = defineAsyncComponent(() => import("./RelayViewer.vue"));
const noteStorage = () => (typeof localStorage === "undefined" ? null : localStorage);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const studyNotes = ref<any[]>(loadNotes(noteStorage()));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const studyShown = ref<any | null>(null);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const studyRelay = ref<any | null>(null);
/** 中継の棋譜がまだ残っているか(残っていれば、その手から中継を開ける)。 */
const studyRelayKept = computed(() => Boolean(studyShown.value && recallRelayGame(loadRelayStore(noteStorage()), studyShown.value.spec.key).game));
function removeStudy(id: string) {
  studyNotes.value = removeNote(studyNotes.value, id);
  saveNotes(noteStorage(), studyNotes.value);
  studyShown.value = null;
}

// ---- 戻る操作(ブラウザの戻る)。重ねて開いたもの(賞状・名鑑のくわしい情報)から閉じる。閉じたら真。
const bookEl = ref<{ goBack: () => boolean } | null>(null);
function goBack() {
  if (studyRelay.value) {
    studyRelay.value = null;
    return true;
  }
  if (studyShown.value) {
    studyShown.value = null;
    return true;
  }
  if (kansenkiShown.value) {
    kansenkiShown.value = null;
    return true;
  }
  if (awardShown.value) {
    awardShown.value = null;
    return true;
  }
  return Boolean(bookEl.value?.goBack());
}
defineExpose({ goBack });

const grades = declarableGrades();
const declareLabel = ref("");
function declare() {
  const grade = grades.find(({ label }) => label === declareLabel.value);
  if (grade) emit("declare", grade);
}
const declaredDate = computed(() => {
  const at = props.state.declared?.at;
  return at ? new Date(at).toLocaleDateString("ja-JP") : "";
});
/** 申告中の段級位に対する、CPUのレベル別の成績(対局したレベルだけ)。 */
const declaredRows = computed(() => {
  const label = props.state.declared?.label;
  const tally = label ? props.state.declaredLevels?.[label] : undefined;
  if (!tally) return [];
  return CPU_STRENGTH_PRESETS
    .filter((preset) => tally[preset.level] && tally[preset.level].wins + tally[preset.level].losses + tally[preset.level].draws > 0)
    .map((preset) => ({ ...preset, ...tally[preset.level] }));
});
const copied = ref(false);
/** 戦績を、表示名の調整に使えるよう、JSONでクリップボードへコピーする。 */
async function copyRecord() {
  const { declared, declaredLevels, levels, colors, games, wins, losses, draws, rating } = props.state;
  const text = JSON.stringify({ rating, games, wins, losses, draws, declared, declaredLevels, levels, colors });
  try {
    await navigator.clipboard.writeText(text);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2500);
  } catch {
    window.prompt("戦績データをコピーしてください", text);
  }
}
const percent = (ratio: number) => `${Math.round(ratio * 100)}%`;
/** 「14級程度」を、表紙では「14級」と短く出す。 */
const gradeName = (label: string) => gradeNameOf(label);

const nearestPreset = computed(() => {
  const level = recommendedLevel(props.state.rating);
  return CPU_STRENGTH_PRESETS.find((preset) => preset.level === level)!;
});

/** 次の目標と、そこまでの残り。計算は結果画面と共通(core/player-rating.mjs)。 */
const nextGoal = computed(() => nextRatingGoal(props.state.rating));

// ===== 能力(docs/player-abilities-design.mdの12章) =====
const myAbility = computed(() => myAbilityProfile({
  games: props.insightGames,
  playerLevel: ratingLevel(props.state.rating),
  difficulty: props.ryuoDifficulty,
  world: props.ryuoWorld,
  // 得意戦法(組んだ戦法・囲いの回数から。分身もこれで指す。docs/tournament-relay-design.mdの28章)。
  repertoire: myRepertoire({ formations: collection.value.formations, catalog: COLLECTION_CATALOG }),
}));
/** 名鑑の棋士の能力を、比べる形(軸ごとの値とランク)にする。 */
function abilitiesOf(values: { [key: string]: number }) {
  return ABILITIES.map(({ key }) => ({ key, value: values[key], rank: abilityRank(values[key]) }));
}
/** 比べる棋士の候補。同じ組の平均・ライバルの羽音・竜王。名簿がまだなければ比べない。 */
const abilityCompareOptions = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const players: any[] = props.roster ? Object.values(props.roster.players ?? {}) : [];
  const withAbilities = players.filter((member) => member?.character?.abilities);
  const options: { id: string; label: string; values: { [key: string]: number } | null }[] = [];
  const group = props.career.champion ? 1 : props.career.group;
  const sameGroup = withAbilities.filter((member) => member.group === group);
  if (sameGroup.length) {
    const all = sameGroup.map((member) => abilityValues(member) as { [key: string]: number });
    options.push({
      id: "group",
      label: `${group}組の平均`,
      values: Object.fromEntries(ABILITIES.map(({ key }) => [key, Math.round(all.reduce((total, values) => total + values[key], 0) / all.length)])),
    });
  }
  const rival = withAbilities.find((member) => member.id === HANANE);
  if (rival) options.push({ id: "rival", label: `ライバル ${rival.name}`, values: abilityValues(rival) });
  const holder = props.roster?.holder && props.roster.holder !== "user" ? props.roster.players?.[props.roster.holder] : null;
  if (holder?.character?.abilities && holder.id !== HANANE) options.push({ id: "holder", label: `竜王 ${holder.name}`, values: abilityValues(holder) });
  return options.length ? [{ id: "none", label: "比べない", values: null }, ...options] : [];
});
const abilityCompareChoice = ref("group");
/** 選んでいる比べる棋士。候補にないとき(名簿が変わったなど)は、候補のいちばん目(同じ組の平均)。 */
const abilityCompareId = computed({
  get: () => (abilityCompareOptions.value.some(({ id }) => id === abilityCompareChoice.value)
    ? abilityCompareChoice.value
    : abilityCompareOptions.value[1]?.id ?? "none"),
  set: (id: string) => { abilityCompareChoice.value = id; },
});
const abilityCompare = computed(() => {
  const option = abilityCompareOptions.value.find(({ id }) => id === abilityCompareId.value);
  return option?.values ? { label: option.label, abilities: abilitiesOf(option.values) } : null;
});
/** やこび姫の一言。いちばんの武器と、伸びしろ(何をすれば伸びるか)。 */
const abilityLines = computed(() => {
  const profile = myAbility.value;
  if (!profile.ready) return [];
  const lines: string[] = [];
  if (profile.best) lines.push(`いちばんの武器は${profile.best.label}（${profile.best.rank}）！ ${profile.view.type === "バランス型" ? "" : `${profile.view.type}の棋士だね。`}`);
  else lines.push("どの能力も同じくらい。バランス型だね！");
  if (profile.worst) lines.push(`伸びしろは${profile.worst.label}（${profile.worst.rank}）。${profile.worst.hint}`);
  if (profile.missing.length) lines.push(`${profile.missing.join("・")}は、これからの対局の解析で分かるよ。`);
  return lines;
});

/** 対局の結果だけを、古い順に並べたもの(申告・測定の記録は除く)。 */
const gameHistory = computed(() => props.state.history.filter(
  (entry): entry is { rating: number; outcome: GameOutcome } =>
    entry.outcome === "win" || entry.outcome === "loss" || entry.outcome === "draw",
));
/** 前の対局からのレーティングの増減。直前の記録が対局の結果のときだけ出す。 */
const ratingDelta = computed(() => {
  const history = props.state.history;
  const last = history[history.length - 1];
  const before = history[history.length - 2];
  if (!last || !before || !gameHistory.value.includes(last as { rating: number; outcome: GameOutcome })) return 0;
  return Math.round(last.rating - before.rating);
});
const FORM_MARK: Record<GameOutcome, string> = { win: "勝", loss: "負", draw: "分" };
const FORM_TEXT: Record<GameOutcome, string> = { win: "勝ち", loss: "負け", draw: "引き分け" };
/** 最近10局の勝ち負け(古い順)。 */
const recentForm = computed(() => gameHistory.value.slice(-10).map((entry) => entry.outcome));

/** 勝率の輪の、勝ち・引き分けの割合(%)。 */
const winShare = computed(() => (props.state.games ? (props.state.wins / props.state.games) * 100 : 0));
const drawShare = computed(() => (props.state.games ? (props.state.draws / props.state.games) * 100 : 0));

/** やこび姫のひとこと。全体の様子と、得意な戦法(3局以上で、いちばん勝率の高いもの)と、次の目標。 */
const messages = computed(() => {
  const { games, wins, rating } = props.state;
  if (!games) return ["ここは、あなたの対局の記録をまとめるノートだよ。", "1局指すと、レーティングや得意な戦法が書き込まれていくよ！"];
  if (games < 5) return [`まだ${games}局だけど、もう書き込みが始まったよ。`, "たくさん指して、ノートを育てよう！"];
  const lines = [`${games}局で${wins}勝！ 今のレーティングはR${rating}だよ。`];
  const best = usageRows(props.state, "rook")
    .filter((row: UsageRow) => row.games >= 3)
    .sort((a: UsageRow, b: UsageRow) => b.wins / b.games - a.wins / a.games)[0];
  if (best) lines.push(`いちばん勝てているのは「${best.name}」。勝率${percent(best.wins / best.games)}だよ！`);
  // 次の目標(「○級まで、あとR○」)は、すぐ下のゲージに書いてあるので、台詞では繰り返さない(1画面に収める。8-3)。
  if (playStreakLine) lines.push(playStreakLine);
  return lines;
});

const trend = computed(() => {
  const ratings = props.state.history.map((entry) => entry.rating);
  if (ratings.length < 2) return null;
  const min = Math.min(...ratings);
  const max = Math.max(...ratings);
  const span = Math.max(1, max - min);
  const points = ratings.map((value, index) => {
    const x = (index / (ratings.length - 1)) * 300;
    const y = 92 - ((value - min) / span) * 84;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return { points, min, max, count: ratings.length };
});

function tallyText({ wins, losses, draws }: Tally) {
  return `${wins}勝${losses}敗${draws}分`;
}
const colorRows = computed(() => (["black", "white"] as const).map((key) => {
  const tally = props.state.colors?.[key] ?? { wins: 0, losses: 0, draws: 0 };
  const games = tally.wins + tally.losses + tally.draws;
  return {
    key,
    label: key === "black" ? "先手" : "後手",
    winPercent: percent(games ? tally.wins / games : 0),
    text: `${games ? `勝率${percent(tally.wins / games)}・` : ""}${tallyText(tally)}`,
  };
}));

/** 棋戦ごとの成績。指したことのある棋戦だけ出す。 */
const eventRows = computed(() => RATED_EVENTS.map(({ id, label }) => {
  const tally = props.state.events?.[id] ?? { wins: 0, losses: 0, draws: 0 };
  const games = tally.wins + tally.losses + tally.draws;
  return {
    key: id,
    label,
    games,
    winPercent: percent(games ? tally.wins / games : 0),
    text: `${games ? `勝率${percent(tally.wins / games)}・` : ""}${tallyText(tally)}`,
  };
}).filter(({ games }) => games > 0));

const EVENT_LABEL: Record<string, string> = Object.fromEntries(RATED_EVENTS.map(({ id, label }) => [id, label]));
/** 最近の対局の数(枠の中で動かして見る)。 */
const RECENT_GAME_LIMIT = 30;
/** 最近の対局(新しい順)。棋戦・段階・相手・結果と、終局後のレーティング。 */
const recentGames = computed(() => {
  const history = props.state.history;
  return history
    .map((entry, index) => ({ entry, before: history[index - 1] }))
    .filter(({ entry }) => entry.outcome === "win" || entry.outcome === "loss" || entry.outcome === "draw")
    .slice(-RECENT_GAME_LIMIT)
    .reverse()
    .map(({ entry, before }, index) => ({
      key: `${entry.at ?? 0}-${index}`,
      event: EVENT_LABEL[entry.event ?? "free"] ?? EVENT_LABEL.free,
      stage: entry.stage ?? "",
      opponent: [entry.opponent, Number.isFinite(entry.opponentLevel) ? `Lv.${entry.opponentLevel}` : ""].filter(Boolean).join(" "),
      outcome: entry.outcome as GameOutcome,
      mark: FORM_MARK[entry.outcome as GameOutcome],
      rating: Math.round(entry.rating),
      delta: before ? Math.round(entry.rating - before.rating) : null,
      date: entry.at ? new Date(entry.at).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" }) : "",
    }));
});

// ---- 戦型(8-3)。使用率と勝率の表は core/style-usage.mjs。
/** まとめに出す得意な戦法(振り飛車の戦法の中で「★得意」の札が付いたもの)。 */
const favoriteStrategy = computed(() => usageTable(props.state, "rook").rows.find((row) => row.tag === "best") ?? null);
const battleRows = computed(() => battleSplit(props.state));
/** 1行の右の数(局数と勝率)。 */
function usageStat(row: { games: number; winRate: number | null }) {
  return `${row.games}局${row.winRate === null ? "" : `・勝率${percent(row.winRate)}`}`;
}
function restLine(rest: { count: number; games: number }) {
  return rest.count ? `ほか${rest.count}個（${rest.games}局）` : "";
}
/** 自分の戦法: コレクションで組んだ回数からの、くわしい戦法の使用率(なければ振り飛車の戦法の記録)。 */
const ownStrategies = computed(() => {
  const repertoire = myRepertoire({ formations: collection.value.formations, catalog: COLLECTION_CATALOG });
  if (repertoire) {
    const table = repertoireTable(openingUsageRows(repertoire.usage), repertoire.games);
    return {
      rows: table.rows.map((row) => ({ ...row, tag: "", stat: `${row.games}回` })),
      restText: table.rest.count ? `ほか${table.rest.count}個（${table.rest.share}%）` : "",
      empty: "",
      note: "くわしい戦法は、対局で組んだ回数から数えているよ。",
    };
  }
  const table = usageTable(props.state, "rook");
  return {
    rows: table.rows.map((row) => ({ ...row, stat: usageStat(row) })),
    restText: restLine(table.rest),
    empty: "作戦を3回組むと、四間飛車や角換わりのような、くわしい戦法の使用率が出るよ。",
    note: "",
  };
});
const styleSides = computed(() => {
  const opponentRook = usageTable(props.state, "opponentRook");
  const castles = (category: string) => {
    const table = usageTable(props.state, category);
    return { rows: table.rows.map((row) => ({ ...row, stat: usageStat(row) })), restText: restLine(table.rest) };
  };
  return [
    { id: "own", title: "あなた", rook: rookSplit(props.state, "own"), strategies: ownStrategies.value, castles: castles("castle") },
    {
      id: "opponent",
      title: "相手",
      rook: rookSplit(props.state, "opponent"),
      strategies: {
        rows: opponentRook.rows.map((row) => ({ ...row, stat: usageStat(row) })),
        restText: restLine(opponentRook.rest),
        empty: "相手の振り飛車の戦法は、まだ記録がありません。",
        note: opponentRook.rows.length ? "勝率は、その戦法の相手にあなたが勝った割合だよ。" : "",
      },
      castles: castles("opponentCastle"),
    },
  ];
});

// ---- 項目の中のタブ(8-3)。ノートを閉じるまで覚えておく(同じ項目に戻ったとき同じタブ)。
const RECORD_VIEWS = [
  { id: "score", label: "勝ち負け" },
  { id: "trend", label: "推移" },
  { id: "recent", label: "最近の対局" },
] as const;
const recordView = ref<typeof RECORD_VIEWS[number]["id"]>("score");
const styleSide = ref<"own" | "opponent">("own");
const tournamentView = ref<"events" | "awards" | "kansenki" | "records">("events");
const tournamentViews = computed(() => [
  { id: "events" as const, label: "棋戦", count: null },
  { id: "awards" as const, label: "賞状", count: props.awards.length },
  { id: "kansenki" as const, label: "観戦記", count: kansenki.value.length },
  { id: "records" as const, label: "記録", count: null },
]);

/** 横長の広い画面(2列に並べる)。名鑑と同じ境目。 */
const WIDE_QUERY = "(orientation: landscape) and (min-width: 700px)";
const wideMedia = typeof window !== "undefined" && window.matchMedia ? window.matchMedia(WIDE_QUERY) : null;
const wide = ref(Boolean(wideMedia?.matches));
const onWideChange = () => { wide.value = Boolean(wideMedia?.matches); };
wideMedia?.addEventListener("change", onWideChange);
onBeforeUnmount(() => wideMedia?.removeEventListener("change", onWideChange));

// ---- 棋戦の札(大会の項目の「棋戦」)。出た棋戦は大きな札を先に、出ていない棋戦は1行の札を後に並べる。
const EVENT_IDS = ["ryuo", "meijin", "kenshukai", "shoreikai"] as const;
type EventId = typeof EVENT_IDS[number];
const eventJoined = computed<Record<EventId, boolean>>(() => ({
  ryuo: props.career.seasons > 0 || props.career.history.length > 0,
  meijin: meijinHistory.value.length > 0 || Boolean(meijinNow.value.cls),
  kenshukai: kenshukai.value.history.length > 0 || Boolean(kenshukai.value.run),
  shoreikai: shoreikai.value.history.length > 0 || Boolean(shoreikai.value.run) || Boolean(shoreikai.value.pro),
}));
const eventOrder = computed(() => {
  const order = [...EVENT_IDS.filter((id) => eventJoined.value[id]), ...EVENT_IDS.filter((id) => !eventJoined.value[id])];
  return Object.fromEntries(order.map((id, index) => [id, index])) as Record<EventId, number>;
});
/** 出た棋戦の札の数が奇数のとき、横に2つ並べる画面では、最後の大きな札を横いっぱいにする。1行の札はいつも横いっぱい。 */
function eventClass(id: EventId) {
  if (!eventJoined.value[id]) return "shogi-note__event--none shogi-note__event--span";
  const joined = EVENT_IDS.filter((key) => eventJoined.value[key]);
  return joined.length % 2 === 1 && joined[joined.length - 1] === id ? "shogi-note__event--span" : "";
}
/** 札の段の高さ。大きな札の段は残りの高さを分け合い、1行の札の段は中身の高さ。 */
const eventGridStyle = computed(() => {
  const columns = wide.value ? 2 : 1;
  const full = EVENT_IDS.filter((id) => eventJoined.value[id]).length;
  const none = EVENT_IDS.length - full;
  const rows = [
    ...Array(Math.ceil(full / columns)).fill("minmax(min-content, 1fr)"),
    ...Array(none).fill("auto"),
  ];
  return { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gridTemplateRows: rows.join(" ") };
});
/** 竜王戦のいちばん上の組(竜王になっていれば竜王)。 */
const ryuoBest = computed(() => {
  if (props.career.titles || props.career.champion) return "竜王";
  const groups = [props.career.group, ...props.career.history.flatMap((entry) => [entry.startGroup, entry.newGroup])].filter((group) => Number.isFinite(group) && group > 0);
  return groups.length ? `${Math.min(...groups)}組` : "—";
});
/** 奨励会のいちばん上の段級(四段になっていれば四段)。これまでの挑戦の記録は段級の名前なので、段級の番号に引き直して比べる。 */
const shoreikaiBest = computed(() => {
  if (shoreikai.value.pro) return "四段";
  const rankOf = (label: string) => Array.from({ length: 30 }, (_, rank) => rank).find((rank) => rankLabel(rank) === label) ?? -1;
  const run = shoreikai.value.run;
  const ranks = [
    ...shoreikai.value.history.map((entry: { rank: string }) => rankOf(entry.rank)),
    run && run.phase !== "exam" && run.phase !== "failed" ? run.best ?? run.rank : -1,
  ].filter((rank) => rank >= 0);
  return ranks.length ? rankLabel(Math.max(...ranks)) : "—";
});

const levelRows = computed(() => CPU_STRENGTH_PRESETS
  .filter((preset) => {
    const tally = props.state.levels?.[preset.level];
    return tally && tally.wins + tally.losses + tally.draws > 0;
  })
  .map((preset) => ({ ...preset, ...props.state.levels[preset.level], rating: levelRating(preset.level) })));
</script>

<style>
/* やこびノート。夜空の紺に、やこび姫のドット絵の色(クリーム・橙・ラベンダー)を合わせる。
 * 表紙をいちばん大きく、タブの中のカードは控えめにして、見る順番をはっきりさせる。 */
.shogi-game .shogi-dex.shogi-note {
  --note-gold: #f1a54c;
  --note-gold-shadow: #b57c39;
  --note-lavender: #d8d0ff;
  --note-panel: #2c4359;
  --note-deep: #172632;
  --note-shadow: #121e29;
  --note-line: rgba(255, 252, 244, 0.16);
  --note-muted: rgba(255, 252, 244, 0.7);
  --note-control: 2.9rem;
  --note-mincho: "Yu Mincho", "YuMincho", "Hiragino Mincho ProN", "Noto Serif JP", serif;
  background: #1e2d3d;
  font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Yu Gothic", "Meiryo", sans-serif;
}
.shogi-game .shogi-note__header-rating {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  margin: 0 0 0 auto;
  font-weight: 800;
}
.shogi-game .shogi-note__header-rating strong { color: var(--note-gold); font-size: 1.35rem; }
.shogi-game .shogi-note__header-rating span { color: var(--note-muted); }

/* ===== 画面の骨組み =====
 * ページ全体はスクロールさせない。スマホは上にメニュー、広い画面は左にメニューを置き、
 * 中身の欄（.shogi-note__pane）だけが、収まらないときに中でスクロールする。 */
.shogi-game .shogi-note__layout {
  flex: 1;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 0.7rem;
  width: min(100%, 82rem);
  min-height: 0;
  margin: 0 auto;
  margin-bottom: 0.5rem;
  box-sizing: border-box;
  padding: 0.7rem clamp(0.6rem, 2vw, 1.5rem) 0.8rem;
  font-size: var(--dex-text);
}
/* 項目が横に並ぶ画面では、収まらない分を次の行へ折り返す(「コレクション」が切れないように)。 */
.shogi-game .shogi-note__nav {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(5.6rem, 1fr));
  gap: 0.35rem;
}
.shogi-game .shogi-note__nav-item {
  display: grid;
  align-content: center;
  justify-items: center;
  min-width: 0;
  min-height: 2.9rem;
  padding: 0.3rem 0.2rem;
  border: 2px solid rgba(255, 252, 244, 0.35);
  border-radius: 0.7rem;
  color: #fffcf4;
  background: rgba(255, 252, 244, 0.06);
  box-shadow: 0 3px 0 var(--note-shadow);
  font: inherit;
  cursor: pointer;
}
.shogi-game .shogi-note__nav .shogi-note__nav-item[aria-selected="true"] {
  border-color: var(--note-gold);
  color: var(--note-deep);
  background: var(--note-gold);
  box-shadow: 0 3px 0 var(--note-gold-shadow);
}
.shogi-game .shogi-note__nav-item:active { box-shadow: none; transform: translateY(3px); }
.shogi-game .shogi-note__nav-label { font-weight: 800; white-space: nowrap; }
.shogi-game .shogi-note__nav-desc { display: none; }
.shogi-game .shogi-note__pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.shogi-game .shogi-note__pane > * { flex: none; }
.shogi-game .shogi-note__pane > .shogi-note__cover {
  flex: 1 0 auto;
  box-sizing: border-box;
  align-content: space-evenly;
}
.shogi-game .shogi-note__nav-short { display: none; }
/* スマホでは見出しの帯が2行にならないよう、レーティングは「まとめ」にだけ出す。項目は4列2段で、短い名前にする。 */
@media (max-width: 599px) {
  .shogi-game .shogi-note__header-rating { display: none; }
  .shogi-game .shogi-note__nav { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.3rem; }
  .shogi-game .shogi-note__nav-item { min-height: 2.75rem; padding: 0.2rem 0.1rem; }
  .shogi-game .shogi-note__nav-label { display: none; }
  .shogi-game .shogi-note__nav-short { display: block; font-size: 0.85em; font-weight: 800; letter-spacing: -0.02em; white-space: nowrap; }
}
@media (min-width: 900px) {
  .shogi-game .shogi-note__layout {
    font-size: clamp(15px, min(1.25vw, 2.2vh), 26px);
    width: min(100%, 74em);
    grid-template-columns: 13.5em minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
    gap: 1.2rem;
    padding-top: 1rem;
  }
  .shogi-game .shogi-note__nav { grid-template-columns: minmax(0, 1fr); align-content: start; gap: 0.5rem; }
  .shogi-game .shogi-note__nav-item {
    justify-items: start;
    gap: 0.15rem;
    min-height: 3.8rem;
    padding: 0.6rem 1rem;
    text-align: left;
  }
  .shogi-game .shogi-note__nav-label { font-size: 1.1em; }
  .shogi-game .shogi-note__nav-desc { display: block; color: var(--note-muted); font-size: 0.75em; }
  .shogi-game .shogi-note__nav .shogi-note__nav-item[aria-selected="true"] .shogi-note__nav-desc { color: rgba(23, 38, 50, 0.75); }
}

/* ===== 項目を1画面に収める(docs/player-world-note-design.mdの8-3) =====
 * 項目の欄は中身の欄の高さいっぱいに置き、一覧(最近の対局・棋士・賞状・カードなど)だけが枠の中で動く。
 * 欄の高さが足りない小さな画面では、項目の欄ごと中身の欄の中で動く(今までどおり)。 */
.shogi-game .shogi-note__pane > .shogi-note__panel--fit { flex: 1 1 0; min-height: 0; box-sizing: border-box; }
.shogi-game .shogi-note__panel.shogi-note__panel--fit { align-items: stretch; align-content: stretch; }
.shogi-game .shogi-note__scroll { min-height: 0; overflow-y: auto; overscroll-behavior: contain; align-content: start; }
/* 下に続きがあるあいだ、下の端を薄くして続きを見せる(説明の文で言わない。UD:6-1。印はvScrollMore)。 */
.shogi-game .shogi-note__scroll[data-more="true"] {
  -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 1.8rem), rgba(0, 0, 0, 0.2));
  mask-image: linear-gradient(to bottom, #000 calc(100% - 1.8rem), rgba(0, 0, 0, 0.2));
}
/* 項目の中のタブ(アルバムの切り替えと同じ形)。 */
.shogi-game .shogi-note__segmented {
  display: grid;
  grid-auto-columns: minmax(0, 1fr);
  grid-auto-flow: column;
  padding: 0.2rem;
  border-radius: 999px;
  background: var(--note-deep);
}
.shogi-game .shogi-note__segmented button {
  min-width: 0;
  min-height: 44px;
  padding: 0 0.4rem;
  border: 0;
  border-radius: 999px;
  color: inherit;
  background: transparent;
  box-shadow: none;
  font: inherit;
  font-weight: 800;
  white-space: nowrap;
  cursor: pointer;
}
.shogi-game .shogi-note__segmented button[aria-selected="true"] { color: #172632; background: var(--note-gold); }
.shogi-game .shogi-note__segmented small { margin-left: 0.3em; font-size: 0.8em; opacity: 0.85; }
/* 項目の中のタブは、スマホの縦だけで使う(広い画面は並べて全部見せる)。 */
.shogi-game .shogi-note__narrow-only { display: none; }
@media (orientation: portrait) and (max-width: 759px) {
  .shogi-game .shogi-note__narrow-only { display: grid; }
  .shogi-game .shogi-note__part--off { display: none !important; }
}

/* 能力: 縦長は1列(一言・チャート・ランク)、横長は2列(左にチャート、右に一言とランク)。 */
.shogi-game .shogi-note__panel.shogi-note__ability {
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: auto minmax(11rem, 1fr) auto;
  grid-template-areas: "coach" "chart" "details";
  gap: 0.6rem;
}
.shogi-game .shogi-note__ability > .shogi-note__empty { grid-area: auto; align-self: start; }
.shogi-game .shogi-note__ability-coach { grid-area: coach; }
.shogi-game .shogi-note__ability-card { grid-area: chart; grid-template-rows: auto auto minmax(0, 1fr); gap: 0.5rem; min-height: 0; }
.shogi-game .shogi-note__ability-chart { min-height: 0; }
.shogi-game .shogi-note__ability-details { grid-area: details; gap: 0.5rem; }
@media (orientation: landscape) and (min-width: 700px) {
  .shogi-game .shogi-note__ability-details { align-self: start; max-height: 100%; }
}
/* スマホの縦: チャートを大きく取るため、目安の説明(補足の文)を省く(U:7-5の③)。 */
@media (orientation: portrait) and (max-width: 759px) {
  .shogi-game .shogi-note__ability-details [data-ability-basis] { display: none; }
  .shogi-game .shogi-note__ability-card,
  .shogi-game .shogi-note__ability-details { padding: 0.7rem 0.8rem; }
}
@media (orientation: landscape) and (min-width: 700px) {
  .shogi-game .shogi-note__panel.shogi-note__ability {
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
    grid-template-areas: "chart coach" "chart details";
  }
}

/* 成績: スマホの縦はタブで1つずつ、タブレットの縦は上に2枚と下に最近の対局、横長は左に勝ち負けと右に推移・最近の対局。 */
.shogi-game .shogi-note__panel.shogi-note__record { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); gap: 0.6rem; }
.shogi-game .shogi-note__record > .shogi-note__empty { align-self: start; }
.shogi-game .shogi-note__record > .shogi-note__card { min-height: 0; }
.shogi-game .shogi-note__recent { grid-template-rows: auto minmax(0, 1fr); }
.shogi-game .shogi-note__record .shogi-note__trend-card { grid-template-rows: auto minmax(0, 1fr); }
.shogi-game .shogi-note__record .shogi-note__trend-box { height: 100%; box-sizing: border-box; }
@media (orientation: portrait) and (min-width: 760px) {
  .shogi-game .shogi-note__panel.shogi-note__record {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
    grid-template-areas: "score trend" "recent recent";
  }
}
@media (orientation: landscape) and (min-width: 700px) {
  .shogi-game .shogi-note__panel.shogi-note__record {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) minmax(0, 1.25fr);
    grid-template-areas: "score trend" "score recent";
  }
  .shogi-game .shogi-note__record .shogi-note__trend-box { grid-template-rows: minmax(3rem, 1fr) auto; }
}
@media (min-width: 700px) {
  .shogi-game .shogi-note__record .shogi-note__score { grid-area: score; }
  .shogi-game .shogi-note__record .shogi-note__trend-card { grid-area: trend; }
  .shogi-game .shogi-note__record .shogi-note__recent { grid-area: recent; }
  .shogi-game .shogi-note__record .shogi-note__trend { min-height: 3rem; }
}

/* 戦型: いちばん上に戦型の割合、その下に「あなた」「相手」(スマホの縦はタブ)。 */
.shogi-game .shogi-note__panel.shogi-note__style { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto auto minmax(0, 1fr); gap: 0.6rem; }
.shogi-game .shogi-note__style > .shogi-note__empty { align-self: start; }
.shogi-game .shogi-note__style-side { gap: 0.55rem; min-height: 0; }
@media (orientation: landscape), (min-width: 760px) {
  .shogi-game .shogi-note__panel.shogi-note__style { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); }
  .shogi-game .shogi-note__style .shogi-note__battle,
  .shogi-game .shogi-note__style > .shogi-note__empty { grid-column: 1 / -1; }
}
.shogi-game .shogi-note__battle { gap: 0.5rem; }
.shogi-game .shogi-note__share { display: flex; height: 0.9rem; margin: 0; overflow: hidden; border-radius: 999px; background: var(--note-deep); }
.shogi-game .shogi-note__share > span { height: 100%; }
.shogi-game .shogi-note__share--static { background: #4d8ac4; }
.shogi-game .shogi-note__share--opposed { background: var(--note-gold); }
.shogi-game .shogi-note__share--ranging { background: #c56a5f; }
.shogi-game .shogi-note__share-legend { display: flex; flex-wrap: wrap; gap: 0.2rem 1.1rem; margin: 0; padding: 0; list-style: none; font-size: 0.88em; }
.shogi-game .shogi-note__share-swatch { display: inline-block; width: 0.8rem; height: 0.8rem; margin-right: 0.3rem; border-radius: 0.2rem; vertical-align: -0.05em; }
.shogi-game .shogi-note__share-legend small,
.shogi-game .shogi-note__party small { margin-left: 0.35em; color: var(--note-muted); }
.shogi-game .shogi-note__party { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.2rem 1rem; margin: 0; font-size: 0.88em; }
.shogi-game .shogi-note__party-bar { display: block; flex: 1 0 100%; height: 0.6rem; overflow: hidden; border-radius: 999px; background: #c56a5f; }
.shogi-game .shogi-note__party-bar span { display: block; height: 100%; background: #4d8ac4; }
/* 表の列(名前・棒・％・局数と勝率)は、行どうしでそろえる(subgrid)。 */
.shogi-game .shogi-note__usage {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(2rem, 1fr) 2.7em auto;
  gap: 0.35rem 0.6rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.shogi-game .shogi-note__usage li { display: grid; grid-column: 1 / -1; grid-template-columns: subgrid; align-items: center; }
.shogi-game .shogi-note__usage .shogi-note__bar { grid-column: auto; grid-row: auto; }
.shogi-game .shogi-note__usage-share { font-size: 0.9em; font-variant-numeric: tabular-nums; font-weight: 800; text-align: right; }
.shogi-game .shogi-note__usage-stat { color: var(--note-muted); font-size: 0.8em; text-align: right; white-space: nowrap; }
.shogi-game .shogi-note__usage .shogi-note__usage-rest { display: block; color: var(--note-muted); font-size: 0.8em; }
.shogi-game .shogi-note__style-side .shogi-note__subhead { margin: 0.2rem 0 0; }
.shogi-game .shogi-note__usage .shogi-note__tag { display: inline-block; white-space: nowrap; }
/* スマホの縦はタブに「あなた」「相手」と出ているので、札の見出しは省く。 */
@media (orientation: portrait) and (max-width: 759px) {
  .shogi-game .shogi-note__style-side > h2 { display: none; }
}

/* 大会: 上にタブ、下に選んだもの。棋戦の札は大きな札が残りの高さを分け、これまでの成績は札の中の枠で動く。 */
.shogi-game .shogi-note__panel.shogi-note__tournament { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); gap: 0.6rem; }
.shogi-game .shogi-note__events { display: grid; gap: 0.6rem; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
.shogi-game .shogi-note__card.shogi-note__event { display: flex; flex-direction: column; gap: 0.5rem; min-height: 0; padding: 0.75rem 0.9rem; }
.shogi-game .shogi-note__event--span { grid-column: 1 / -1; }
.shogi-game .shogi-note__card.shogi-note__event--none { flex-direction: row; flex-wrap: wrap; align-items: baseline; gap: 0.2rem 0.9rem; padding: 0.55rem 0.9rem; }
.shogi-game .shogi-note__event-stats { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr) minmax(0, 1fr); gap: 0.4rem; margin: 0; }
.shogi-game .shogi-note__event-stats > div { display: grid; align-content: start; gap: 0.05rem; min-width: 0; padding: 0.35rem 0.6rem; border-radius: 0.5rem; background: var(--note-deep); }
.shogi-game .shogi-note__event-stats dt { color: var(--note-muted); font-size: 0.75em; font-weight: 700; }
.shogi-game .shogi-note__event-stats dd { margin: 0; overflow-wrap: anywhere; font-size: 1.15em; font-weight: 900; line-height: 1.2; }
.shogi-game .shogi-note__event-stats dd small { margin-left: 0.1rem; font-size: 0.6em; }
.shogi-game .shogi-note__event-stats .shogi-note__event-now dd { color: var(--note-gold); font-size: 1.45em; }
.shogi-game .shogi-note__event-sub { color: var(--note-muted); font-size: 0.72em; font-weight: 700; }
.shogi-game .shogi-note__event-history { flex: 1 1 0; min-height: 2.6rem; contain: size; }
/* スマホ: 出ていない棋戦の行き方の補足は省き、1行に収める(U:7-5の③)。いまの位置の字も少し小さく。 */
/* 背の低い縦の画面: 階段は省く(いまの位置は「いま」の札で分かる)。これまでの成績を広く取る。 */
@media (orientation: portrait) and (max-height: 700px) {
  .shogi-game .shogi-note__event-ladder { display: none; }
}
@media (max-width: 599px) {
  .shogi-game .shogi-note__event-where { display: none; }
  .shogi-game .shogi-note__event-stats .shogi-note__event-now dd { font-size: 1.2em; }
  .shogi-game .shogi-note__event-stats > div { padding: 0.3rem 0.45rem; }
}
.shogi-game .shogi-note__event-history li { padding: 0.3rem 0.6rem; font-size: 0.85em; }
/* 棋戦の札の階段は低くする(自分の位置が分かれば足りる)。 */
.shogi-game .shogi-note__event-ladder { flex: none; padding-top: 1.2rem; }
.shogi-game .shogi-note__event-ladder .ryuo-ladder__step { font-size: 0.72em; }
.shogi-game .shogi-note__event-ladder .ryuo-ladder__step--ryuo { height: 2.3rem; }
.shogi-game .shogi-note__event-ladder .ryuo-ladder__step--g1 { height: 2.1rem; }
.shogi-game .shogi-note__event-ladder .ryuo-ladder__step--g2 { height: 1.9rem; }
.shogi-game .shogi-note__event-ladder .ryuo-ladder__step--g3 { height: 1.75rem; }
.shogi-game .shogi-note__event-ladder .ryuo-ladder__step--g4 { height: 1.6rem; }
.shogi-game .shogi-note__event-ladder .ryuo-ladder__step--g5 { height: 1.45rem; }
.shogi-game .shogi-note__event-ladder .ryuo-ladder__step--g6 { height: 1.3rem; }
/* 一覧の札(賞状・観戦記・記録): 見出しの下の一覧が残りの高さで動く。 */
.shogi-game .shogi-note__card.shogi-note__list-card { display: flex; flex-direction: column; gap: 0.6rem; min-height: 0; }
.shogi-game .shogi-note__list-card > .shogi-note__scroll { flex: 1 1 0; min-height: 3rem; contain: size; }
.shogi-game .shogi-note__records { display: grid; grid-template-columns: minmax(0, 1fr); grid-auto-rows: minmax(min-content, 1fr); gap: 0.6rem; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
@media (min-width: 700px) {
  .shogi-game .shogi-note__records { grid-template-columns: repeat(3, minmax(0, 1fr)); grid-auto-rows: minmax(0, 1fr); }
}

/* 棋士名鑑: 名鑑の札を欄の高さいっぱいに置く。 */
.shogi-game .shogi-note__panel.shogi-note__panel--book.shogi-note__panel--fit { grid-template-rows: minmax(0, 1fr); }

/* コレクション: 上のゲージとページの切り替えは動かさず、カードの一覧だけが動く。 */
.shogi-game .shogi-note__panel.shogi-note__panel--album.shogi-note__panel--fit { display: flex; flex-direction: column; gap: 0.6rem; }
.shogi-game .shogi-note__panel--album.shogi-note__panel--fit > * { flex: none; }
.shogi-game .shogi-note__panel--album.shogi-note__panel--fit > :last-child { flex: 1 1 0; min-height: 6rem; }
.shogi-game .shogi-note__card.shogi-note__album { display: flex; flex-direction: column; gap: 0.5rem; }
.shogi-game .shogi-note__album > .shogi-note__album-grid { flex: 1 1 0; min-height: 4rem; contain: size; padding-top: 0.5rem; }
/* 背の低い画面: 印の数と「印のアルバム｜着せ替え」を1行にし、「挑戦できる」の説明(補足)を省いて、カードの枠を広く取る。 */
@media (max-height: 700px) {
  .shogi-game .shogi-note__album-head { grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); align-items: center; gap: 0.4rem 0.8rem; padding: 0.6rem 0.8rem; }
  .shogi-game .shogi-note__album-head .shogi-note__gauge-text { font-size: 0.8em; }
  .shogi-game .shogi-note__album-head .shogi-note__gauge-text img { width: 1.6rem; height: 1.6rem; }
  .shogi-game .shogi-note__album-switch button { min-height: 44px; font-size: 0.88em; }
  .shogi-game .shogi-note__album > .shogi-note__hint:first-child { display: none; }
  .shogi-game .shogi-note__card.shogi-note__album { padding: 0.5rem 0.6rem; }
}

/* 設定: 札は縦に並べ、レベルごとの成績の札が残りの高さに収まる(一覧は枠の中で動く)。広い画面は2列。 */
.shogi-game .shogi-note__level-head { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; }
.shogi-game .shogi-note__level-head .shogi-note__copy { flex: none; height: auto; min-height: 44px; padding: 0 0.8rem; font-size: 0.85em; }
.shogi-game .shogi-note__level-lists { display: grid; align-content: start; gap: 0.6rem; }
.shogi-game .shogi-note__settings > .shogi-note__level-card { display: flex; flex-direction: column; min-height: 0; }
.shogi-game .shogi-note__level-card .shogi-note__level-lists { flex: 1 1 0; min-height: 4.5rem; contain: size; }
@media (max-width: 759px) {
  .shogi-game .shogi-note__panel.shogi-note__settings { display: flex; flex-direction: column; gap: 0.6rem; }
  .shogi-game .shogi-note__settings > * { flex: none; }
  .shogi-game .shogi-note__settings > .shogi-note__level-card { flex: 1 1 0; }
  .shogi-game .shogi-note__settings .shogi-note__card { padding: 0.75rem 0.85rem; gap: 0.5rem; }
}
@media (min-width: 760px) {
  .shogi-game .shogi-note__panel.shogi-note__settings { grid-template-rows: auto minmax(0, 1fr); align-content: stretch; align-items: start; }
  .shogi-game .shogi-note__settings > .shogi-note__level-card { grid-column: 2; grid-row: 1 / span 2; align-self: stretch; }
}
/* 背の低い画面(小さいスマホ・横向きのスマホ): 説明の続き(補足)を省き、札の余白を詰めて1画面に収める(U:7-5の③)。 */
@media (orientation: portrait) and (max-height: 700px), (orientation: landscape) and (max-height: 500px) {
  .shogi-game .shogi-note__settings .shogi-note__more,
  .shogi-game .shogi-note__settings [data-note-measured] { display: none; }
  .shogi-game .shogi-note__panel.shogi-note__settings { gap: 0.45rem; }
  .shogi-game .shogi-note__settings .shogi-note__card { padding: 0.55rem 0.75rem; gap: 0.35rem; }
  .shogi-game .shogi-note__settings .shogi-note__hint { line-height: 1.4; }
}
/* 送る・送らないは、同じ幅で横に並べる(片方だけ細くならない)。 */
.shogi-game .shogi-note__settings .shogi-note__declare .shogi-note__button { justify-self: stretch; width: 100%; }

/* ===== 表紙 ===== */
.shogi-game .shogi-note__cover {
  display: grid;
  gap: 1rem;
  grid-template-columns: minmax(0, 1fr);
  padding: clamp(0.9rem, 2.5vw, 1.4rem);
  border: 2px solid var(--note-gold);
  border-radius: 1rem;
  background:
    radial-gradient(circle at 92% 12%, rgba(241, 165, 76, 0.16) 0 3px, transparent 4px),
    radial-gradient(circle at 70% 85%, rgba(215, 209, 253, 0.16) 0 2px, transparent 3px),
    #263d52;
  box-shadow: 0 5px 0 var(--note-gold-shadow);
}
@media (min-width: 1000px) {
  .shogi-game .shogi-note__cover { grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); align-items: center; }
  .shogi-game .shogi-note__highlights { grid-column: 1 / -1; }
}
.shogi-game .shogi-note__highlights {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.6rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.shogi-game .shogi-note__highlight {
  display: grid;
  gap: 0.15em;
  justify-items: start;
  width: 100%;
  height: 100%;
  min-width: 0;
  padding: 0.7em 0.9em;
  border: 2px solid rgba(255, 252, 244, 0.25);
  border-radius: 0.7rem;
  color: #fffcf4;
  background: var(--note-deep);
  box-shadow: 0 3px 0 var(--note-shadow);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.shogi-game .shogi-note__highlight:active { box-shadow: none; transform: translateY(3px); }
@media (hover: hover) {
  .shogi-game .shogi-note__highlight:hover { border-color: var(--note-gold); }
}
.shogi-game .shogi-note__highlight small { color: var(--note-gold); font-size: 0.78em; font-weight: 800; }
.shogi-game .shogi-note__highlight strong {
  max-width: 100%;
  overflow: hidden;
  font-size: 1.35em;
  font-weight: 900;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.shogi-game .shogi-note__highlight span { color: var(--note-muted); font-size: 0.75em; }
@media (max-width: 599px) {
  .shogi-game .shogi-note__highlights { gap: 0.4rem; }
  .shogi-game .shogi-note__highlight { padding: 0.55em 0.6em; }
  .shogi-game .shogi-note__highlight strong { font-size: 1.05em; }
  .shogi-game .shogi-note__highlight span { font-size: 0.68em; }
}
.shogi-game .shogi-note__coach { min-width: 0; }
.shogi-game .shogi-note__rank { display: grid; gap: 0.6rem; min-width: 0; }
.shogi-game .shogi-note__eyebrow {
  margin: 0;
  color: var(--note-gold);
  font-size: 0.85em;
  font-weight: 800;
  letter-spacing: 0.12em;
}
.shogi-game .shogi-note__rating {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.3rem 0.8rem;
  margin: 0;
}
.shogi-game .shogi-note__rating strong {
  font-size: clamp(2.8rem, 2rem + 3vw, 4.2rem);
  font-weight: 900;
  line-height: 1;
  letter-spacing: 0.02em;
  text-shadow: 0 3px 0 var(--note-shadow);
}
.shogi-game .shogi-note__delta {
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  font-size: 0.95em;
  font-weight: 800;
}
.shogi-game .shogi-note__delta--up { color: var(--note-deep); background: var(--note-gold); }
.shogi-game .shogi-note__delta--down { color: var(--note-deep); background: var(--note-lavender); }
.shogi-game .shogi-note__grade {
  margin: 0;
  font-size: 1.5em;
  font-weight: 800;
}
.shogi-game .shogi-note__grade small {
  margin-left: 0.4rem;
  color: var(--note-muted);
  font-size: 0.55em;
  font-weight: 600;
}
.shogi-game .shogi-note__goal { display: grid; gap: 0.35rem; }
.shogi-game .shogi-note__goal-text {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.2rem 1rem;
  margin: 0;
  color: var(--note-muted);
  font-size: 0.9em;
}
.shogi-game .shogi-note__goal-text b { color: #fffcf4; font-size: 1.1em; }
.shogi-game .shogi-note__goal-bar {
  height: 0.9rem;
  overflow: hidden;
  border: 2px solid var(--note-deep);
  border-radius: 999px;
  background: var(--note-deep);
}
.shogi-game .shogi-note__goal-bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: repeating-linear-gradient(135deg, var(--note-gold) 0 10px, #f6bb6e 10px 20px);
  animation: shogi-note-goal-fill 700ms cubic-bezier(0.2, 0.9, 0.3, 1) both;
  transform-origin: left center;
}
@keyframes shogi-note-goal-fill {
  from { transform: scaleX(0); }
}
@media (prefers-reduced-motion: reduce) {
  .shogi-game .shogi-note__goal-bar span { animation: none; }
}
.shogi-game .shogi-note__badges { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .shogi-note__badge {
  padding: 0.25rem 0.75rem;
  border: 2px solid var(--note-gold);
  border-radius: 999px;
  color: var(--note-gold);
  font-size: 0.85em;
  font-weight: 800;
}
.shogi-game .shogi-note__badge small { margin-right: 0.4rem; color: var(--note-muted); font-weight: 700; }
.shogi-game .shogi-note__badge--group { color: var(--note-deep); background: var(--note-gold); }
.shogi-game .shogi-note__badge--group small { color: rgba(23, 38, 50, 0.75); }
.shogi-game .shogi-note__form { display: flex; flex-wrap: wrap; align-items: center; gap: 0.3rem 0.7rem; }
.shogi-game .shogi-note__form-label { color: var(--note-muted); font-size: 0.85em; font-weight: 700; }
.shogi-game .shogi-note__form ol { display: flex; gap: 0.25rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .shogi-note__form li {
  display: grid;
  place-items: center;
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 50%;
  font-size: 0.8em;
  font-weight: 900;
  line-height: 1;
}
.shogi-game .shogi-note__form-mark--win { color: var(--note-deep); background: var(--note-gold); }
.shogi-game .shogi-note__form-mark--loss { color: var(--note-deep); background: var(--note-lavender); }
.shogi-game .shogi-note__form-mark--draw { color: #fffcf4; background: #445c6d; }
/* 「対局する」と「棋力を測る」は、スマホでも縦に積まず横に並べ、2つとも1画面に入れる(U:7-5の①)。 */
.shogi-game .shogi-note__actions { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 0.6rem; margin-top: 0.2rem; }
@media (max-width: 599px) {
  .shogi-game .shogi-note__actions { gap: 0.4rem; }
  .shogi-game .shogi-note__actions .shogi-note__button { padding: 0 0.5rem; }
  /* 下の3枚の近道は、小さな文(補足)を省く(U:7-5の③)。 */
  .shogi-game .shogi-note__highlight span { display: none; }
}

/* ===== ボタン ===== */
.shogi-game .shogi-note__button,
.shogi-game .shogi-note__declare select {
  box-sizing: border-box;
  height: var(--note-control);
  border-radius: 0.6rem;
  font: inherit;
}
/* 研究ノートの局面(24-5)。ノートの上に重ねる。盤は枠の幅に合わせて描く(横にはみ出さない)。 */
.shogi-game .shogi-note__sheet {
  position: fixed; inset: 0; z-index: 110; display: grid; place-items: center;
  padding: max(12px, env(safe-area-inset-top)) 16px max(12px, env(safe-area-inset-bottom)); background: rgba(10, 18, 30, 0.72);
}
.shogi-game .shogi-note__study {
  box-sizing: border-box; display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.5rem; width: min(100%, 26rem); max-height: 100%;
  overflow-y: auto; padding: 0.9rem; border-radius: 0.8rem; color: #fffcf4; background: #172632;
}
.shogi-game .shogi-note__study h2 { margin: 0; font-size: 1.05rem; }
.shogi-game .shogi-note__study .shogi-note__hint { margin: 0; }
.shogi-game .shogi-note__study-board { min-width: 0; }
/* 「中継で開く」を上に大きく、「消す」「閉じる」はその下に横に並べる。 */
.shogi-game .shogi-note__study-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.4rem; }
.shogi-game .shogi-note__study-actions .shogi-note__button { width: 100%; min-height: 44px; }
.shogi-game .shogi-note__study-actions [data-note-study-relay] { grid-column: 1 / -1; }
.shogi-game .shogi-note__button {
  width: 100%;
  padding: 0 1rem;
  border: 2px solid rgba(255, 252, 244, 0.55);
  color: #fffcf4;
  background: rgba(255, 252, 244, 0.06);
  box-shadow: 0 3px 0 var(--note-shadow);
  font-weight: 800;
  white-space: nowrap;
  cursor: pointer;
}
.shogi-game .shogi-note__button--primary {
  border-color: var(--note-gold);
  color: var(--note-deep);
  background: var(--note-gold);
  box-shadow: 0 4px 0 var(--note-gold-shadow);
  font-size: 1.05em;
}
.shogi-game .shogi-note__button:not(:disabled):active { box-shadow: none; transform: translateY(3px); }
.shogi-game .shogi-note__button--ghost { justify-self: start; width: auto; border-width: 1px; font-weight: 700; }
.shogi-game .shogi-note__button:disabled { opacity: 0.45; cursor: default; }

/* ===== タブ ===== */

/* ===== カード ===== */
.shogi-game .shogi-note__panel {
  display: grid;
  gap: 1rem;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  /* 終わったあとに変形を残さない(backwards)。残すと、中で重ねて開くシートの位置の基準が、この欄になってしまう。 */
  animation: shogi-note-panel-in 160ms ease-out backwards;
}
@media (min-width: 760px) {
  .shogi-game .shogi-note__panel { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  /* 棋士名鑑は1列(一覧と、くわしい情報を並べるのは名鑑の中)。 */
  .shogi-game .shogi-note__panel.shogi-note__panel--book { grid-template-columns: minmax(0, 1fr); }
  .shogi-game .shogi-note__panel > .shogi-note__empty,
  .shogi-game .shogi-note__panel > .shogi-note__pair,
  .shogi-game .shogi-note__panel > .shogi-note__card--wide { grid-column: 1 / -1; }
}
@keyframes shogi-note-panel-in {
  from { opacity: 0; transform: translateY(6px); }
}
@media (prefers-reduced-motion: reduce) {
  .shogi-game .shogi-note__panel { animation: none; }
}
.shogi-game .shogi-note__card {
  display: grid;
  align-content: start;
  gap: 0.75rem;
  min-width: 0;
  margin: 0;
  padding: 1rem 1.1rem;
  border: 2px solid #3b5570;
  border-radius: 0.8rem;
  background: var(--note-panel);
}
.shogi-game .shogi-note__card--minor { border-color: rgba(59, 85, 112, 0.7); background: rgba(44, 67, 89, 0.6); }
.shogi-game .shogi-note__card h2 {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin: 0;
  color: var(--note-gold);
  font-size: 0.95em;
  letter-spacing: 0.08em;
}
.shogi-game .shogi-note__card h2::before {
  content: "";
  width: 0.5rem;
  height: 0.5rem;
  background: var(--note-gold);
}
.shogi-game .shogi-note__empty p { margin: 0; line-height: 1.7; }
.shogi-game .shogi-note__pair { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr)); }
.shogi-game .shogi-note__subhead { margin: 0.3rem 0 0; color: rgba(255, 252, 244, 0.8); font-size: 0.9em; }
.shogi-game .shogi-note__hint { margin: 0; color: var(--note-muted); font-size: 0.8em; line-height: 1.6; }
/* 寄せの記録。いちばん長い寄せを大きく、最近の寄せを小さく並べる。 */
.shogi-game .shogi-note__mate-best { display: flex; flex-wrap: wrap; gap: 0.2em 0.6em; align-items: baseline; margin: 0; }
.shogi-game .shogi-note__mate-best b { color: #f1a54c; font-size: 1.6em; font-weight: 900; }
.shogi-game .shogi-note__mate-best span { font-weight: 800; }
.shogi-game .shogi-note__mate-best small,
.shogi-game .shogi-note__mate-recent small { color: var(--note-muted); font-size: 0.8em; }
.shogi-game .shogi-note__mate-recent { display: grid; gap: 0.2em; margin: 0.4em 0 0; padding: 0; list-style: none; }
.shogi-game .shogi-note__mate-recent li { display: flex; flex-wrap: wrap; gap: 0 0.6em; align-items: baseline; }
.shogi-game .shogi-note__mate-recent b { min-width: 4.5em; font-weight: 800; }
/* 能力。名鑑の棋士と同じ部品(PlayerAbilityPanel)に、比べる棋士を選ぶ札を添える。 */
.shogi-game .shogi-note__ability-card h2 small { margin-left: 0.5em; color: var(--note-muted); font-size: 0.75em; font-weight: 700; }
.shogi-game .shogi-note__ability-compare { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.shogi-game .shogi-note__chip {
  min-height: var(--note-control);
  padding: 0 0.8rem;
  border: 2px solid #3b5570;
  border-radius: 999px;
  color: inherit;
  background: var(--note-deep);
  box-shadow: none;
  font: inherit;
  font-size: 0.88em;
  font-weight: 800;
  cursor: pointer;
}
.shogi-game .shogi-note__chip--on { border-color: #8fc5ff; color: #172632; background: #8fc5ff; }

.shogi-game .shogi-note__fans { display: grid; gap: 0.35rem; margin: 0; padding: 0; list-style: none; font-size: 0.88em; }
.shogi-game .shogi-note__fans li { display: grid; grid-template-columns: minmax(6rem, auto) minmax(0, 1fr); gap: 0.6rem; }
.shogi-game .shogi-note__fans b { color: var(--note-gold); }

/* 続けて遊んだ日。棋力の下に小さく出す(数字で急かさない)。 */
.shogi-game .shogi-note__streak { margin: 0.2rem 0 0; color: var(--note-muted); font-size: 0.85em; }
.shogi-game .shogi-note__streak b { color: var(--note-gold); }
.shogi-game .shogi-note__streak small { margin-left: 0.3rem; }

/* コレクション */
.shogi-game .shogi-note__count { margin-left: auto; color: var(--note-muted); font-size: 0.85em; letter-spacing: 0; }
/* ===== コレクション(アルバム) ===== */
.shogi-game .shogi-note__panel.shogi-note__panel--album { grid-template-columns: minmax(0, 1fr); }
/* いちばん上: 印の合計・次の着せ替えまでのゲージ・「印のアルバム｜着せ替え」。 */
.shogi-game .shogi-note__album-head { gap: 0.6rem; }
.shogi-game .shogi-note__album-gauge { display: grid; gap: 0.4rem; }
.shogi-game .shogi-note__album-gauge h2 { display: flex; align-items: baseline; gap: 0.3rem; }
.shogi-game .shogi-note__album-gauge h2 strong { margin-left: 0.4rem; color: #fffcf4; font-size: 1.6em; }
.shogi-game .shogi-note__album-gauge h2 small { color: var(--note-muted); font-size: 0.8em; }
.shogi-game .shogi-note__gauge { height: 0.8rem; overflow: hidden; border-radius: 999px; background: var(--note-deep); }
.shogi-game .shogi-note__gauge span { display: block; height: 100%; min-width: 0.8rem; border-radius: inherit; background: var(--note-gold); }
.shogi-game .shogi-note__gauge-text { display: flex; align-items: center; gap: 0.5rem; margin: 0; font-size: 0.9em; font-weight: 700; }
.shogi-game .shogi-note__gauge-text img { width: 2.2rem; height: 2.2rem; object-fit: cover; border-radius: 0.25rem; }
.shogi-game .shogi-note__gauge-text b { margin: 0 0.15em; color: var(--note-gold); font-size: 1.2em; }
.shogi-game .shogi-note__album-switch { display: grid; grid-template-columns: 1fr 1fr; gap: 0; padding: 0.2rem; border-radius: 999px; background: var(--note-deep); }
.shogi-game .shogi-note__album-switch button,
.shogi-game .shogi-note__album-pages button {
  min-height: var(--note-control);
  border: 0;
  border-radius: 999px;
  color: inherit;
  background: transparent;
  box-shadow: none;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}
.shogi-game .shogi-note__album-switch button[aria-selected="true"],
.shogi-game .shogi-note__album-pages button[aria-selected="true"] { color: #172632; background: var(--note-gold); }
/* ページ: 見出し(戦法・囲い・そのほか)ごとにまとめ、取った数と全部の数を添える。 */
.shogi-game .shogi-note__album-pages { display: flex; flex-wrap: wrap; gap: 0.35rem 1rem; }
.shogi-game .shogi-note__album-group { display: flex; flex-wrap: wrap; align-items: center; gap: 0.3rem; }
.shogi-game .shogi-note__album-group-label { margin-right: 0.15rem; color: var(--note-muted); font-size: 0.75em; font-weight: 800; letter-spacing: 0.08em; }
.shogi-game .shogi-note__album-pages button { display: inline-flex; align-items: baseline; gap: 0.3rem; padding: 0 0.85rem; border: 2px solid #3b5570; background: var(--note-deep); }
.shogi-game .shogi-note__album-pages button small { font-size: 0.78em; opacity: 0.8; }
.shogi-game .shogi-note__album-pages button[aria-selected="true"] { border-color: var(--note-gold); }
/* カード: 完成形の小さな盤と名前。取ったものは金の縁、挑戦できるものは点線の縁、まだのものは薄く。 */
.shogi-game .shogi-note__album-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(7.2rem, 1fr)); gap: 0.5rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .shogi-note__album-card {
  position: relative;
  display: grid;
  justify-items: center;
  align-content: start;
  gap: 0.25rem;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 0.45rem 0.35rem 0.5rem;
  border: 2px solid #33465e;
  border-radius: 0.5rem;
  color: var(--note-muted);
  background: var(--note-deep);
  box-shadow: none;
  font: inherit;
  cursor: pointer;
}
.shogi-game .shogi-note__album-thumb { width: 100%; height: auto; }
.shogi-game .shogi-note__album-card:not(.shogi-note__album-card--got):not(.shogi-note__album-card--ready) .shogi-note__album-thumb { opacity: 0.55; }
.shogi-game .shogi-note__album-name {
  display: -webkit-box;
  min-height: 2.5em;
  overflow: hidden;
  font-size: 0.82em;
  font-weight: 800;
  line-height: 1.25;
  text-align: center;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.shogi-game .shogi-note__album-status { font-size: 0.75em; font-weight: 800; }
.shogi-game .shogi-note__album-card--got { border-color: var(--note-gold); color: #fffcf4; }
.shogi-game .shogi-note__album-card--got .shogi-note__album-status { color: var(--note-gold); }
.shogi-game .shogi-note__album-card--ready { border-style: dashed; border-color: var(--note-lavender); color: #fffcf4; }
.shogi-game .shogi-note__album-status--ready { padding: 0.05rem 0.5rem; border-radius: 999px; color: #172632; background: var(--note-lavender); }
.shogi-game .shogi-note__album-new {
  position: absolute;
  top: -0.45rem;
  right: -0.3rem;
  padding: 0.05rem 0.4rem;
  border-radius: 0.3rem;
  color: #fffcf4;
  background: #c4604c;
  font-size: 0.7em;
  font-style: normal;
  font-weight: 900;
}
.shogi-game .shogi-note__album-card--new { animation: shogi-note-album-new 0.9s ease-in-out 2; }
@keyframes shogi-note-album-new {
  50% { box-shadow: 0 0 0 4px rgba(241, 165, 76, 0.45); }
}
.shogi-game .shogi-note__album-grid--text { grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr)); }
.shogi-game .shogi-note__album-card--text { min-height: 4.2rem; align-content: center; }
.shogi-game .shogi-note__album-card--text .shogi-note__album-name { min-height: 0; font-size: 0.95em; }
/* 眺めるだけのカード(教室のコツ)。押せないので、指の形にしない。 */
.shogi-game .shogi-note__album-card--static { cursor: default; }
/* Lvの壁: 10段ずつ4本の階段。 */
.shogi-game .shogi-note__wall-row { display: grid; grid-template-columns: 4.2rem minmax(0, 1fr); align-items: center; gap: 0.5rem; }
.shogi-game .shogi-note__wall-label { display: grid; margin: 0; font-weight: 800; }
.shogi-game .shogi-note__wall-label small { color: var(--note-muted); font-size: 0.75em; }
.shogi-game .shogi-note__wall { display: grid; grid-template-columns: repeat(10, minmax(0, 1fr)); gap: 0.25rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .shogi-note__wall li {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 2.1rem;
  border: 1px dashed var(--note-line);
  border-radius: 0.3rem;
  color: var(--note-muted);
  font-size: 0.78em;
  font-weight: 800;
}
.shogi-game .shogi-note__wall .shogi-note__wall--got { border: 1px solid var(--note-gold); color: var(--note-deep); background: var(--note-gold); }
.shogi-game .shogi-note__wall .shogi-note__wall--next { border: 2px solid #fffcf4; color: #fffcf4; }
.shogi-game .shogi-note__wall .shogi-note__wall--recommended::after {
  content: "";
  position: absolute;
  bottom: 0.15rem;
  width: 0.35rem;
  height: 0.35rem;
  border-radius: 50%;
  background: var(--note-lavender);
}
.shogi-game .shogi-note__wall-legend { display: flex; flex-wrap: wrap; align-items: center; gap: 0.3rem 0.8rem; margin: 0; color: var(--note-muted); font-size: 0.8em; }
.shogi-game .shogi-note__wall-swatch { display: inline-block; width: 0.9rem; height: 0.9rem; margin-right: 0.25rem; border-radius: 0.2rem; vertical-align: middle; }
.shogi-game .shogi-note__wall-swatch--got { background: var(--note-gold); }
.shogi-game .shogi-note__wall-swatch--next { border: 2px solid #fffcf4; box-sizing: border-box; }
.shogi-game .shogi-note__wall-swatch--recommended { width: 0.5rem; height: 0.5rem; border-radius: 50%; background: var(--note-lavender); }
/* スマホ縦: カードは3列。ページの切り替えは小さく。 */
@media (max-width: 599px) {
  .shogi-game .shogi-note__album-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.35rem; }
  .shogi-game .shogi-note__album-grid--text { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .shogi-game .shogi-note__album-card { padding: 0.35rem 0.2rem 0.4rem; }
  .shogi-game .shogi-note__album-name { font-size: 0.74em; }
  .shogi-game .shogi-note__album-pages button { min-height: 2.75rem; padding: 0 0.65rem; font-size: 0.88em; }
  .shogi-game .shogi-note__wall-row { grid-template-columns: 3.2rem minmax(0, 1fr); gap: 0.3rem; }
  .shogi-game .shogi-note__wall { gap: 0.15rem; }
}
@media (prefers-reduced-motion: reduce) {
  .shogi-game .shogi-note__album-card--new { animation: none; }
}
.shogi-game .shogi-note__themes ul {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(6.5rem, 1fr));
  gap: 0.45rem;
  margin: 0.35rem 0 0;
  padding: 0;
  list-style: none;
}
.shogi-game .shogi-note__theme {
  display: grid;
  justify-items: center;
  gap: 0.2rem;
  width: 100%;
  min-height: 0;
  padding: 0.45rem 0.3rem;
  border: 2px solid transparent;
  border-radius: 0.5rem;
  color: inherit;
  background: var(--note-deep);
  font-size: 0.8em;
}
.shogi-game .shogi-note__theme img {
  width: 3rem;
  height: 3rem;
  object-fit: cover;
  border-radius: 0.25rem;
}
.shogi-game .shogi-note__theme[aria-checked="true"] { border-color: var(--note-gold); }
.shogi-game .shogi-note__theme small { color: var(--note-muted); font-size: 0.85em; }
.shogi-game .shogi-note__theme--locked img { filter: grayscale(1) brightness(0.55); }
.shogi-game .shogi-note__theme:disabled { opacity: 1; cursor: default; }

/* 勝ち負け: 勝率の輪と、数のタイル */
.shogi-game .shogi-note__score-body { display: flex; flex-wrap: wrap; align-items: center; gap: 1rem; }
.shogi-game .shogi-note__ring {
  display: grid;
  flex: none;
  place-items: center;
  width: 7.5rem;
  height: 7.5rem;
  border-radius: 50%;
  background: conic-gradient(var(--note-gold) 0 var(--win), #8a93a0 var(--win) var(--draw), var(--note-lavender) var(--draw) 100%);
}
.shogi-game .shogi-note__ring span {
  display: grid;
  place-items: center;
  width: 72%;
  height: 72%;
  border-radius: 50%;
  background: var(--note-panel);
  font-size: 1.5em;
  font-weight: 900;
  line-height: 1.1;
}
.shogi-game .shogi-note__ring small { color: var(--note-muted); font-size: 0.45em; font-weight: 700; }
.shogi-game .shogi-note__tiles { display: grid; flex: 1 1 12rem; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.5rem; margin: 0; }
.shogi-game .shogi-note__tiles--four { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.shogi-game .shogi-note__tiles > div {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
  padding: 0.5rem 0.7rem;
  border-radius: 0.5rem;
  background: var(--note-deep);
}
.shogi-game .shogi-note__tiles dt { color: var(--note-muted); font-size: 0.75em; font-weight: 700; white-space: nowrap; }
.shogi-game .shogi-note__tiles dd { margin: 0; font-size: 1.35em; font-weight: 900; line-height: 1.2; }
.shogi-game .shogi-note__tiles dd small { margin-left: 0.1rem; font-size: 0.6em; }
.shogi-game .shogi-note__tile--win { box-shadow: inset 4px 0 0 var(--note-gold); }
.shogi-game .shogi-note__tile--loss { box-shadow: inset 4px 0 0 var(--note-lavender); }

/* レーティングの推移 */
.shogi-game .shogi-note__trend-box {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  grid-template-rows: minmax(8rem, 1fr) auto;
  gap: 0.3rem 0.5rem;
  padding: 0.7rem 0.8rem;
  border-radius: 0.5rem;
  background: var(--note-deep);
}
.shogi-game .shogi-note__trend-axis {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  color: rgba(255, 252, 244, 0.6);
  font-size: 0.72em;
  text-align: right;
}
.shogi-game .shogi-note__trend { display: block; width: 100%; height: 100%; min-height: 8rem; }
.shogi-game .shogi-note__trend-note { grid-column: 2; color: var(--note-muted); font-size: 0.78em; }

/* 竜王戦の成績 */
.shogi-game .shogi-note__history { display: grid; gap: 0.35rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .shogi-note__history li {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.6rem;
  padding: 0.45rem 0.7rem;
  border-left: 4px solid rgba(255, 252, 244, 0.35);
  border-radius: 0.4rem;
  background: var(--note-deep);
  font-size: 0.9em;
}
/* 賞状帳の行(大会の画面の賞状帳と同じ形)。左の小さな判子の色は賞状の格。 */
.shogi-game .shogi-note__awards { display: grid; gap: 0.35rem; margin: 0; padding: 0; list-style: none; }
/* 勝負メシ帳。対局場ごとに1行、献立の3品を札で並べる(★勝ちメシ・食べた・まだは薄く)。 */
.shogi-game .shogi-note__meals { display: grid; gap: 0.35rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .shogi-note__meals li {
  display: grid;
  gap: 0.25rem;
  padding: 0.45rem 0.7rem;
  border-radius: 0.3rem;
  background: var(--note-deep);
  font-size: 0.9em;
}
.shogi-game .shogi-note__meals b { color: var(--note-muted); font-size: 0.85em; }
.shogi-game .shogi-note__meal-items { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.shogi-game .shogi-note__meal-items > span {
  padding: 0.1rem 0.5rem;
  border: 1px solid var(--note-line);
  border-radius: 0.3rem;
}
.shogi-game .shogi-note__meal--win { border-color: var(--note-gold) !important; color: var(--note-gold); font-weight: 800; }
.shogi-game .shogi-note__meal--win i { margin-right: 0.2em; font-style: normal; }
.shogi-game .shogi-note__meal--eaten { color: var(--ivory, #fffcf4); }
.shogi-game .shogi-note__meal--new { color: var(--note-muted); border-style: dashed !important; opacity: 0.75; }
.shogi-game .shogi-note__award-row {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  width: 100%;
  min-height: 52px;
  padding: 0.4rem 0.7rem;
  border: 0;
  border-radius: 0.3rem;
  color: inherit;
  background: var(--note-deep);
  box-shadow: none;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.shogi-game .shogi-note__award-seal {
  flex: none;
  display: grid;
  place-items: center;
  width: 2.2rem;
  height: 2.2rem;
  border: 2px solid #fffcf4;
  border-radius: 0.3rem;
  background: #5d6f80;
  font-family: var(--note-mincho);
  font-weight: 900;
}
.shogi-game .shogi-note__award-seal--gold { background: #c9962e; }
.shogi-game .shogi-note__award-seal--silver { background: #8c98a6; }
.shogi-game .shogi-note__award-seal--red { background: #c4604c; }
.shogi-game .shogi-note__award-text { display: grid; gap: 0.1rem; min-width: 0; font-weight: 800; }
.shogi-game .shogi-note__award-text small { color: var(--note-muted); font-size: 0.8em; }
.shogi-game .shogi-note__history li.shogi-note__history--crown { border-left-color: var(--note-gold); background: rgba(241, 165, 76, 0.14); }
.shogi-game .shogi-note__history li.shogi-note__history--up { border-left-color: var(--note-gold); }
.shogi-game .shogi-note__history li.shogi-note__history--down { border-left-color: var(--note-lavender); }
.shogi-game .shogi-note__history-no { font-weight: 800; }
.shogi-game .shogi-note__history-group { color: var(--note-gold); font-weight: 700; }
.shogi-game .shogi-note__history-text { overflow-wrap: anywhere; }
.shogi-game .shogi-note__history-record { white-space: nowrap; }

/* 最近の対局(棋戦・段階・相手・結果) */
.shogi-game .shogi-note__games { display: grid; gap: 0.45rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .shogi-note__games li {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.7rem;
}
.shogi-game .shogi-note__game-mark {
  display: grid;
  place-items: center;
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 50%;
  font-size: 0.8em;
  font-weight: 900;
  line-height: 1;
}
.shogi-game .shogi-note__game--win .shogi-note__game-mark { color: var(--note-deep); background: var(--note-gold); }
.shogi-game .shogi-note__game--loss .shogi-note__game-mark { color: var(--note-deep); background: var(--note-lavender); }
.shogi-game .shogi-note__game--draw .shogi-note__game-mark { color: #fffcf4; background: #445c6d; }
.shogi-game .shogi-note__game-body { display: grid; min-width: 0; }
.shogi-game .shogi-note__game-event { font-weight: 700; overflow-wrap: anywhere; }
.shogi-game .shogi-note__game-event small { margin-left: 0.5em; color: var(--note-muted); font-weight: 400; }
.shogi-game .shogi-note__game-meta { color: var(--note-muted); font-size: 0.85em; overflow-wrap: anywhere; }
.shogi-game .shogi-note__game-rating { font-weight: 700; text-align: right; white-space: nowrap; }
.shogi-game .shogi-note__game-rating small { display: block; color: var(--note-muted); font-size: 0.8em; font-weight: 400; }

/* 使用率・成績の行 */
.shogi-game .shogi-note__rows { display: grid; gap: 0.6rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .shogi-note__rows li {
  display: grid;
  grid-template-columns: minmax(6rem, 1fr) minmax(3rem, 1fr) auto;
  align-items: center;
  gap: 0.25rem 0.7rem;
}
.shogi-game .shogi-note__rows li:not(:has(.shogi-note__bar)) { grid-template-columns: 1fr auto; }
.shogi-game .shogi-note__rows--style li { grid-template-columns: minmax(0, 1fr) auto; }
.shogi-game .shogi-note__rows--style .shogi-note__bar { grid-column: 1 / -1; grid-row: 2; }
.shogi-game .shogi-note__name { font-weight: 700; overflow-wrap: anywhere; }
.shogi-game .shogi-note__stat { font-size: 0.85em; text-align: right; white-space: nowrap; }
.shogi-game .shogi-note__bar { height: 0.6rem; overflow: hidden; border-radius: 999px; background: var(--note-deep); }
.shogi-game .shogi-note__bar span { display: block; height: 100%; border-radius: inherit; background: var(--note-gold); }
.shogi-game .shogi-note__tag {
  margin-left: 0.4rem;
  padding: 0.05rem 0.5rem;
  border-radius: 999px;
  font-size: 0.72em;
  font-style: normal;
  font-weight: 800;
  vertical-align: 0.1em;
}
.shogi-game .shogi-note__tag--best { color: var(--note-deep); background: var(--note-gold); }
.shogi-game .shogi-note__tag--weak { color: var(--note-deep); background: var(--note-lavender); }

/* 設定 */
.shogi-game .shogi-note__declare { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 0.5rem; }
.shogi-game .shogi-note__declare select {
  width: 100%;
  padding: 0 0.6rem;
  border: 2px solid rgba(255, 252, 244, 0.4);
  color: #fffcf4;
  background: var(--note-deep);
}
@media (max-width: 520px) {
  .shogi-game .shogi-note__rows li,
  .shogi-game .shogi-note__rows li:not(:has(.shogi-note__bar)) { grid-template-columns: 1fr auto; }
  .shogi-game .shogi-note__bar { grid-column: 1 / -1; grid-row: 2; }
  .shogi-game .shogi-note__tiles--four { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .shogi-game .shogi-note__history li { grid-template-columns: auto auto minmax(0, 1fr); }
  .shogi-game .shogi-note__history-record { grid-column: 3; justify-self: end; }
  .shogi-game .shogi-note__ring { width: 6.2rem; height: 6.2rem; }
}
/* ===== 背の低い画面(2026-10 レスポンシブの見直し) =====
 * まとめは1画面に収める。縦長の小さなスマホは、メニューとすき間を詰め、文字を少し小さくする。
 * 横長の背の低い画面(スマホの横向き)は、広い画面と同じく左にメニューを置き、表紙を左右2列にする。 */
@media (orientation: portrait) and (max-height: 700px) {
  .shogi-game .shogi-note__layout { gap: 0.5rem; padding-top: 0.5rem; }
  .shogi-game .shogi-note__nav-item { min-height: 2.75rem; }
  .shogi-game .shogi-note__cover { gap: 0.5rem; padding: 0.7rem; }
  .shogi-game .shogi-note__rating strong { font-size: 2.2rem; }
  /* 「対局する」と「棋力を測る」は縦に積まず横に並べ、2つとも1画面に入れる(UI_Nintendo_Implementation.md 7-5の1)。 */
  .shogi-game .shogi-note__actions { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); }
  .shogi-game .shogi-note__grade { font-size: 1.2em; }
  .shogi-game .shogi-note__coach img { max-height: 4.5rem; }
  /* 成績: 勝率の輪を小さくし、数のタイルと横に並べる。 */
  .shogi-game .shogi-note__ring { width: 5.2rem; height: 5.2rem; }
  .shogi-game .shogi-note__score-body { flex-wrap: nowrap; gap: 0.7rem; }
  .shogi-game .shogi-note__tiles dd { font-size: 1.1em; }
  /* 下の3つの近道は、上のメニューと同じ行き先なので、背の低い画面では省く。 */
  .shogi-game .shogi-note__highlights { display: none; }
  /* 棋力の欄の行の間を詰め、「対局する」まで1画面に入れる(8-3)。 */
  .shogi-game .shogi-note__rank { gap: 0.35rem; }
  .shogi-game .shogi-note__form li { width: 1.45rem; height: 1.45rem; }
}
@media (orientation: landscape) and (max-height: 500px) and (max-width: 899px) {
  .shogi-game .shogi-note__highlights { display: none; }
  .shogi-game .shogi-note__ring { width: 5.2rem; height: 5.2rem; }
  .shogi-game .shogi-note__score-body { flex-wrap: nowrap; gap: 0.7rem; }
  .shogi-game .shogi-note__card { padding: 0.7rem 0.8rem; gap: 0.5rem; }
  .shogi-game .shogi-note__layout {
    grid-template-columns: 8.5rem minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
    gap: 0.7rem;
    padding: 0.5rem 0.8rem;
  }
  /* 7つの項目を縦に収めつつ、押せる高さは44px以上にする(UI_Nintendo_Implementation.md 7-4)。 */
  .shogi-game .shogi-note__nav { grid-template-columns: minmax(0, 1fr); align-content: start; gap: 0.15rem; }
  .shogi-game .shogi-note__nav-item { min-height: 2.75rem; padding: 0.2rem 0.6rem; justify-items: start; }
  .shogi-game .shogi-note__cover {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
    align-items: center;
    gap: 0.6rem 1rem;
    padding: 0.7rem 0.9rem;
  }
  .shogi-game .shogi-note__highlights { grid-column: 1 / -1; }
  .shogi-game .shogi-note__rating strong { font-size: 2.3rem; }
  .shogi-game .shogi-note__grade { font-size: 1.15em; }
  .shogi-game .shogi-note__coach img { max-height: 4.5rem; }
  .shogi-game .shogi-note__rank { gap: 0.35rem; }
  .shogi-game .shogi-note__form li { width: 1.45rem; height: 1.45rem; }
}
</style>
