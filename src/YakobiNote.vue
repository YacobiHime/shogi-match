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
                <strong>{{ favoriteStrategy ? favoriteStrategy.name : "—" }}</strong>
                <span>{{ favoriteStrategy ? `勝率${percent(favoriteStrategy.winRate)}・${favoriteStrategy.games}局` : "3局以上で見つかるよ" }}</span>
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
        -->
        <section v-if="tab === 'ability'" id="shogi-note-pane-ability" class="shogi-note__panel" role="tabpanel" aria-label="能力" data-note-ability>
          <div v-if="!myAbility.ready" class="shogi-note__card shogi-note__empty">
            <p>
              対局を解析すると、名鑑の棋士と同じように、あなたの能力（序盤・中盤・終盤・攻め・受け・読み・詰み・安定感）がここに出るよ。
              あと{{ myAbility.need }}手ぶんの解析で分かるよ。自由対局か竜王戦を指そう！
            </p>
            <button type="button" class="shogi-note__button shogi-note__button--primary" @click="emit('start-match')">対局する</button>
          </div>
          <template v-else>
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
              <PlayerAbilityPanel :view="myAbility.view" :compare="abilityCompare" />
            </section>
            <div class="shogi-note__coach shogi-note__ability-coach">
              <YakobiSays :lines="abilityLines" merged :asset-base-url="assetBaseUrl" />
            </div>
            <p class="shogi-note__hint" data-ability-basis>
              最近{{ myAbility.games }}局・{{ myAbility.moves }}手の解析から出した目安だよ。物差しは竜王戦（難易度{{ myAbility.difficulty }}）の棋士と同じで、対局するたびに動くよ。
            </p>
          </template>
        </section>

        <!-- 成績 -->
        <section v-if="tab === 'record'" id="shogi-note-pane-record" class="shogi-note__panel shogi-note__panel--fill" role="tabpanel" aria-label="成績">
          <div v-if="!state.games" class="shogi-note__card shogi-note__empty">
            <p>まだ記録がないよ。平手でCPUと対局したり、竜王戦で指したりすると、勝ち負けとレーティングの推移がここに書き込まれるよ。</p>
          </div>
          <template v-else>
            <section class="shogi-note__card shogi-note__score" aria-labelledby="shogi-note-score" data-note-record>
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

            <figure class="shogi-note__card shogi-note__trend-card">
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

            <section class="shogi-note__card shogi-note__card--wide" aria-labelledby="shogi-note-recent" data-note-recent-games>
              <h2 id="shogi-note-recent">最近の対局</h2>
              <ol class="shogi-note__games">
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

        <!-- 戦法: 自分の戦法・囲い・戦型を勝率で比べ、得意とにがてに札を付ける。相手の戦法・囲いはその下に小さく。 -->
        <section v-if="tab === 'style'" id="shogi-note-pane-style" class="shogi-note__panel shogi-note__panel--style" role="tabpanel" aria-label="戦法">
          <div v-if="!state.games" class="shogi-note__card shogi-note__empty">
            <p>対局すると、使った戦法と囲いの勝率がここに並ぶよ。得意な戦法を見つけよう！</p>
          </div>
          <template v-else>
            <section
              v-for="group in ownUsageGroups"
              :key="group.category"
              class="shogi-note__card"
              :aria-label="group.title"
            >
              <h2>{{ group.title }}</h2>
              <p v-if="!group.rows.length" class="shogi-note__hint">まだ記録がありません。</p>
              <ul v-else class="shogi-note__rows shogi-note__rows--style">
                <li v-for="row in group.rows" :key="row.name">
                  <span class="shogi-note__name">
                    {{ row.name }}
                    <em v-if="row.tag === 'best'" class="shogi-note__tag shogi-note__tag--best">★得意</em>
                    <em v-else-if="row.tag === 'weak'" class="shogi-note__tag shogi-note__tag--weak">にがて</em>
                  </span>
                  <span class="shogi-note__bar" :title="`勝率 ${percent(row.winRate)}`" aria-hidden="true">
                    <span :style="{ width: percent(row.winRate) }"></span>
                  </span>
                  <span class="shogi-note__stat">勝率{{ percent(row.winRate) }}・{{ row.wins }}勝{{ row.losses }}敗{{ row.draws ? `${row.draws}分` : "" }}</span>
                </li>
              </ul>
            </section>
            <div class="shogi-note__pair">
              <section
                v-for="group in opponentUsageGroups"
                :key="group.category"
                class="shogi-note__card shogi-note__card--minor"
                :aria-label="group.title"
              >
                <h2>{{ group.title }}</h2>
                <p v-if="!group.rows.length" class="shogi-note__hint">まだ記録がありません。</p>
                <ul v-else class="shogi-note__rows">
                  <li v-for="row in group.rows" :key="row.name">
                    <span class="shogi-note__name">{{ row.name }}</span>
                    <span class="shogi-note__stat">{{ row.games }}局・{{ row.wins }}勝{{ row.losses }}敗{{ row.draws ? `${row.draws}分` : "" }}</span>
                  </li>
                </ul>
              </section>
            </div>
          </template>
        </section>

        <!--
          大会(docs/player-world-note-design.mdの3-2)。竜王戦と名人戦の歩みと、賞状帳。
        -->
        <section v-if="tab === 'tournament'" id="shogi-note-pane-tournament" class="shogi-note__panel" role="tabpanel" aria-label="大会">
          <section class="shogi-note__card" aria-labelledby="shogi-note-ryuo" data-note-ryuo>
            <h2 id="shogi-note-ryuo">竜王戦</h2>
            <RyuoLadder :group="career.group" :champion="career.champion" />
            <dl class="shogi-note__tiles shogi-note__tiles--four">
              <div><dt>現在</dt><dd>{{ career.champion ? "竜王" : `${career.group}組` }}</dd></div>
              <div><dt>参加</dt><dd>{{ career.seasons }}<small>期</small></dd></div>
              <div><dt>挑戦者</dt><dd>{{ career.challenges }}<small>回</small></dd></div>
              <div><dt>竜王</dt><dd>{{ career.titles }}<small>期</small></dd></div>
            </dl>
            <p v-if="career.titles" class="shogi-note__hint">
              連続{{ career.streak }}期・最長{{ career.bestStreak }}期{{ career.eternal ? "・永世竜王" : "" }}
            </p>
            <template v-if="career.history.length">
              <h3 class="shogi-note__subhead">これまでの成績</h3>
              <ol class="shogi-note__history" data-note-ryuo-history>
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
            <p v-else class="shogi-note__hint">まだ参加していません。タイトル画面の「大会」から、竜王戦に参加できます。</p>
          </section>
          <section class="shogi-note__card" aria-labelledby="shogi-note-meijin" data-note-meijin>
            <h2 id="shogi-note-meijin">名人戦</h2>
            <RyuoLadder kind="meijin" :meijin-class="meijinNow.cls" />
            <dl class="shogi-note__tiles shogi-note__tiles--four">
              <div><dt>現在</dt><dd data-note-meijin-now>{{ meijinNow.text }}</dd></div>
              <div><dt>参加</dt><dd>{{ meijinHistory.length }}<small>期</small></dd></div>
              <div><dt>最高</dt><dd>{{ meijinBest }}</dd></div>
              <div><dt>名人</dt><dd>{{ meijinCareer.titles ?? 0 }}<small>期</small></dd></div>
            </dl>
            <p v-if="meijinCareer.eternal" class="shogi-note__hint">永世名人</p>
            <template v-if="meijinHistory.length">
              <h3 class="shogi-note__subhead">これまでの成績</h3>
              <ol class="shogi-note__history" data-note-meijin-history>
                <li v-for="entry in recentMeijinHistory" :key="entry.no" :class="`shogi-note__history--${meijinHistoryKind(entry)}`">
                  <span class="shogi-note__history-no">第{{ entry.no }}期</span>
                  <span class="shogi-note__history-group">{{ meijinClassLabel(entry.cls) }}</span>
                  <span class="shogi-note__history-text">{{ meijinOutcome(entry.outcome) }}{{ entry.place ? `・${entry.place}位` : "" }}</span>
                  <span class="shogi-note__history-record">{{ entry.wins }}勝{{ entry.losses }}敗</span>
                </li>
              </ol>
            </template>
            <p v-else class="shogi-note__hint">まだ参加していません。タイトル画面の「大会」から、名人戦に参加できます。</p>
          </section>
          <!-- 研修会の歩み(docs/kenshukai-design.md)。いまのクラスと、これまでの最高のクラス、これまでの挑戦。 -->
          <section class="shogi-note__card" aria-labelledby="shogi-note-kenshukai" data-note-kenshukai>
            <h2 id="shogi-note-kenshukai">研修会</h2>
            <dl class="shogi-note__tiles shogi-note__tiles--four">
              <div><dt>現在</dt><dd data-note-kenshukai-now>{{ kenshukaiNow }}</dd></div>
              <div><dt>最高</dt><dd>{{ kenshukaiBest }}</dd></div>
              <div><dt>挑戦</dt><dd>{{ kenshukai.history.length + (kenshukai.run ? 1 : 0) }}<small>回</small></dd></div>
              <div><dt>対局</dt><dd>{{ kenshukaiGames }}<small>局</small></dd></div>
            </dl>
            <template v-if="kenshukai.history.length">
              <h3 class="shogi-note__subhead">これまでの挑戦</h3>
              <ol class="shogi-note__history" data-note-kenshukai-history>
                <li v-for="entry in kenshukai.history.slice(0, 5)" :key="entry.id" :class="`shogi-note__history--${entry.result === 'closed' ? 'down' : 'crown'}`">
                  <span class="shogi-note__history-no">{{ entry.entry }}入会</span>
                  <span class="shogi-note__history-group">最高 {{ entry.best }}</span>
                  <span class="shogi-note__history-text">{{ KENSHUKAI_RESULT[entry.result] ?? "" }}</span>
                  <span class="shogi-note__history-record">{{ entry.wins }}勝{{ entry.losses }}敗</span>
                </li>
              </ol>
            </template>
            <p v-else-if="!kenshukai.run" class="shogi-note__hint">まだ受験していません。タイトル画面の「大会」の「研修会」から、入会試験を受けられます。</p>
          </section>
          <!-- 奨励会の歩み(docs/shoreikai-design.mdの13章)。いまの段級か、四段の棋士番号と、これまでの挑戦。 -->
          <section class="shogi-note__card" aria-labelledby="shogi-note-shoreikai" data-note-shoreikai>
            <h2 id="shogi-note-shoreikai">奨励会</h2>
            <dl class="shogi-note__tiles shogi-note__tiles--four">
              <div><dt>現在</dt><dd data-note-shoreikai-now>{{ shoreikaiNow }}</dd></div>
              <div><dt>挑戦</dt><dd>{{ shoreikai.history.length + (shoreikai.run ? 1 : 0) }}<small>回</small></dd></div>
              <div><dt>対局</dt><dd>{{ shoreikaiGames }}<small>局</small></dd></div>
              <div><dt>棋士番号</dt><dd>{{ shoreikai.pro ? shoreikai.pro.kishiNumber : "—" }}</dd></div>
            </dl>
            <p v-if="shoreikai.pro" class="shogi-note__hint">{{ shoreikai.pro.entry }}で入会し、{{ shoreikai.pro.games }}局で四段{{ shoreikai.pro.mentor ? `（師匠 ${shoreikai.pro.mentor}）` : "" }}</p>
            <template v-if="shoreikai.history.length">
              <h3 class="shogi-note__subhead">これまでの挑戦</h3>
              <ol class="shogi-note__history" data-note-shoreikai-history>
                <li v-for="entry in shoreikai.history.slice(0, 5)" :key="entry.id" :class="`shogi-note__history--${entry.result === 'pro' ? 'crown' : 'down'}`">
                  <span class="shogi-note__history-no">{{ entry.entry }}入会</span>
                  <span class="shogi-note__history-group">最高 {{ entry.rank }}</span>
                  <span class="shogi-note__history-text">{{ entry.result === "pro" ? `四段・棋士番号${entry.kishiNumber}号` : "退会" }}</span>
                  <span class="shogi-note__history-record">{{ entry.wins }}勝{{ entry.losses }}敗</span>
                </li>
              </ol>
            </template>
            <p v-else-if="!shoreikai.run" class="shogi-note__hint">まだ受験していません。タイトル画面の「大会」の「奨励会」から、入会試験を受けられます。</p>
          </section>
          <section class="shogi-note__card shogi-note__card--wide" aria-labelledby="shogi-note-awards" data-note-awards>
            <h2 id="shogi-note-awards">賞状帳<small class="shogi-note__count">{{ awards.length }}枚</small></h2>
            <ul v-if="awards.length" class="shogi-note__awards">
              <li v-for="item in shownAwards" :key="item.id">
                <button type="button" class="shogi-note__award-row" :data-note-award="item.id" @click="awardShown = item">
                  <span :class="['shogi-note__award-seal', `shogi-note__award-seal--${item.grade}`]" aria-hidden="true">{{ item.seal }}</span>
                  <span class="shogi-note__award-text">{{ awardLine(item) }}<small>{{ item.wins }}勝{{ item.losses }}敗{{ item.grade === "fight" ? "・敢闘賞" : "" }}</small></span>
                </button>
              </li>
            </ul>
            <p v-else class="shogi-note__hint">竜王戦や名人戦の期を終えると、表彰式で賞状がもらえるよ。ここにたまっていくからね。</p>
            <button v-if="awards.length > AWARD_PREVIEW" type="button" class="shogi-note__button shogi-note__button--ghost" data-note-awards-all @click="allAwards = !allAwards">
              {{ allAwards ? "新しい3枚だけ見る" : `すべて見る（${awards.length}枚）` }}
            </button>
          </section>
          <!-- 観戦記(docs/title-match-day-design.mdの3章)。タイトル戦の1局ごとに、新しい順。押すと紙面を開く。 -->
          <section class="shogi-note__card shogi-note__card--wide" aria-labelledby="shogi-note-kansenki" data-note-kansenki>
            <h2 id="shogi-note-kansenki">観戦記<small class="shogi-note__count">{{ kansenki.length }}局</small></h2>
            <ul v-if="kansenki.length" class="shogi-note__awards">
              <li v-for="item in shownKansenki" :key="item.id">
                <button type="button" class="shogi-note__award-row" data-note-kansenki-row @click="kansenkiShown = item">
                  <span :class="['shogi-note__award-seal', item.win ? 'shogi-note__award-seal--gold' : 'shogi-note__award-seal--silver']" aria-hidden="true">{{ item.win ? "勝" : "負" }}</span>
                  <span class="shogi-note__award-text">{{ item.headline }}<small>{{ item.eventText }} {{ item.label }}</small></span>
                </button>
              </li>
            </ul>
            <p v-else class="shogi-note__hint">竜王戦や名人戦のタイトル戦（七番勝負）を指すと、1局ごとに新聞の観戦記ができるよ。</p>
            <button v-if="kansenki.length > AWARD_PREVIEW" type="button" class="shogi-note__button shogi-note__button--ghost" @click="allKansenki = !allKansenki">
              {{ allKansenki ? "新しい3局だけ見る" : `すべて見る（${kansenki.length}局）` }}
            </button>
          </section>
        </section>

        <!-- 棋士名鑑(docs/player-world-note-design.mdの3-3)。 -->
        <section v-if="tab === 'book'" id="shogi-note-pane-book" class="shogi-note__panel shogi-note__panel--book" role="tabpanel" aria-label="棋士名鑑">
          <RyuoRosterBook ref="bookEl" :roster="roster" :initial-group="career.champion ? 1 : career.group" :asset-base-url="assetBaseUrl" />
        </section>

        <!--
          コレクション(docs/player-world-note-design.mdの4章)。いちばん上に印の合計と次の着せ替えまでのゲージ、
          「印のアルバム｜着せ替え」の切り替え。アルバムはページ(居飛車・振り飛車・奇襲・囲い・手筋・Lvの壁・記念)に分け、
          戦法・囲いは完成形の小さな盤のカード。作戦カードで使えるのにまだ組んでいないものを「挑戦できる」として先に出す。
        -->
        <section v-if="tab === 'collection'" id="shogi-note-pane-collection" class="shogi-note__panel shogi-note__panel--album" role="tabpanel" aria-label="コレクション">
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
              <button
                v-for="item in albumPageTabs"
                :key="item.id"
                type="button"
                role="tab"
                :aria-selected="albumPage === item.id"
                :data-album-page="item.id"
                @click="chooseAlbumPage(item.id)"
              >{{ item.label }}<small v-if="item.total">{{ item.got }}/{{ item.total }}</small></button>
            </nav>

            <!-- 戦法・囲い: 完成形の小さな盤のカード。押すと作戦カードのくわしい画面(なければ定跡図鑑)。 -->
            <section v-if="albumFormationPage" class="shogi-note__card shogi-note__album" :aria-label="albumPageLabel" data-album-cards>
              <p v-if="albumReadyCount" class="shogi-note__hint">「挑戦できる」は、作戦カードで選べるのに、まだ対局で組んでいない形だよ。押すと手順が見られるよ。</p>
              <ul class="shogi-note__album-grid">
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
              <ul class="shogi-note__album-grid shogi-note__album-grid--text">
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

            <!-- Lvの壁: 入門(24級〜16級)の9段と、10段ずつ4本の階段。次の壁を縁取り、おすすめの強さの前後に印。 -->
            <section v-else-if="albumPage === 'levels'" class="shogi-note__card shogi-note__album" aria-label="Lvの壁" data-album-levels>
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
            <section v-else class="shogi-note__card shogi-note__album" aria-label="記念" data-album-memorial>
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

          <section v-else class="shogi-note__card shogi-note__card--wide" aria-labelledby="shogi-note-themes" data-album-themes>
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

        <!-- 棋力の調整に使う項目。 -->
        <section v-if="tab === 'settings'" id="shogi-note-pane-settings" class="shogi-note__panel" role="tabpanel" aria-label="設定">
          <section class="shogi-note__card shogi-note__card--minor">
            <h2>棋力を測る</h2>
            <p class="shogi-note__hint">
              CPUと1局指すと、終局後に指し手を解析して、レーティングと級・段の目安を診断します。
              結果は解析画面から、あなたのレーティングに設定できます。
            </p>
            <p v-if="state.measured" class="shogi-note__hint" data-note-measured>
              棋力測定で R{{ state.measured.rating }}（{{ state.measured.label }}）を設定しました（{{ measuredDate }}）。
            </p>
            <button type="button" class="shogi-note__button shogi-note__button--ghost" @click="emit('start-measure')">棋力を測る</button>
          </section>

          <section class="shogi-note__card shogi-note__card--minor">
            <h2>段級位を申告する</h2>
            <p class="shogi-note__hint">
              日本将棋連盟の段級位で申告すると、レーティングをその棋力に設定します。
              以降の対局は申告ごとにCPUのレベル別の成績を記録し、表示名と実際の棋力のずれを調べるのに使います。
            </p>
            <p v-if="state.declared" class="shogi-note__hint" data-note-declared>
              申告中: {{ state.declared.label }}（{{ declaredDate }}に設定）
            </p>
            <div class="shogi-note__declare">
              <select v-model="declareLabel" aria-label="申告する段級位">
                <option value="">段級位を選ぶ</option>
                <option v-for="grade in grades" :key="grade.label" :value="grade.label">{{ grade.label }}</option>
              </select>
              <button type="button" class="shogi-note__button" :disabled="!declareLabel" @click="declare">申告して設定</button>
            </div>
          </section>

          <section v-if="levelRows.length" class="shogi-note__card shogi-note__card--minor" aria-labelledby="shogi-note-levels">
            <h2 id="shogi-note-levels">CPUのレベルごとの成績</h2>
            <ul class="shogi-note__rows">
              <li v-for="row in levelRows" :key="row.level">
                <span class="shogi-note__name">Lv.{{ row.level }} {{ row.label }}</span>
                <span class="shogi-note__stat">R{{ row.rating }}・{{ row.wins }}勝{{ row.losses }}敗{{ row.draws }}分</span>
              </li>
            </ul>
          </section>

          <section v-if="declaredRows.length || state.games" class="shogi-note__card shogi-note__card--minor" aria-labelledby="shogi-note-declared">
            <h2 id="shogi-note-declared">申告した棋力での成績</h2>
            <ul v-if="declaredRows.length" class="shogi-note__rows">
              <li v-for="row in declaredRows" :key="row.level">
                <span class="shogi-note__name">Lv.{{ row.level }} {{ row.label }}</span>
                <span class="shogi-note__stat">{{ row.wins }}勝{{ row.losses }}敗{{ row.draws }}分</span>
              </li>
            </ul>
            <p v-else class="shogi-note__hint">段級位を申告すると、ここにCPUのレベル別の成績が出ます。</p>
            <button v-if="state.games" type="button" class="shogi-note__button shogi-note__button--ghost" @click="copyRecord">{{ copied ? "コピーしました" : "戦績データをコピー" }}</button>
          </section>
        </section>
      </main>
      <SeasonAward v-if="awardShown" :award="awardShown" :asset-base-url="assetBaseUrl" @done="awardShown = null" />
      <TitleDaySheet v-if="kansenkiShown" mode="kansenki" :article="kansenkiShown" @close="kansenkiShown = null" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, type PropType } from "vue";
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
import { myAbilityProfile } from "./core/my-abilities.mjs";
import { ABILITIES, abilityRank, abilityValues } from "./core/player-abilities.mjs";
import { HANANE } from "./core/ryuo-story.mjs";
import { CPU_STRENGTH_PRESETS } from "./core/strength-settings.mjs";
import { currentAffiliation } from "./core/player-profile.mjs";
import { currentStreak, loadPlayStreak, streakLine } from "./core/play-streak.mjs";
import {
  ALBUM_PAGES,
  COLLECTION_LEVELS,
  THEME_UNLOCKS,
  albumCards,
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
import { loadKansenki } from "./core/title-day.mjs";
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
});
const emit = defineEmits<{
  close: [];
  "start-match": [];
  "start-measure": [];
  declare: [grade: unknown];
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
  { id: "style", label: "戦法", short: "戦法", description: "得意な戦法と囲い" },
  { id: "tournament", label: "大会", short: "大会", description: "竜王戦・名人戦と賞状帳" },
  { id: "book", label: "棋士名鑑", short: "名鑑", description: "棋士と、あなたとの対戦" },
  { id: "collection", label: "コレクション", short: "コレクション", description: "集めた印と着せ替え" },
  { id: "settings", label: "設定", short: "設定", description: "棋力の測定と申告" },
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
const tab = ref<TabId>(loadTab());
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
    const saved = localStorage.getItem(ALBUM_PAGE_KEY);
    return ALBUM_PAGES.some(({ id }) => id === saved) ? saved as string : "static";
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
const FORMATION_PAGES = new Set(["static", "ranging", "surprise", "castle"]);
const albumFormationPage = computed(() => FORMATION_PAGES.has(albumPage.value));
const albumFormationCards = computed(() => (albumFormationPage.value
  ? albumCards(collection.value, COLLECTION_CATALOG, albumPage.value, { playable: playable.value, seenAt: collectionSeenAt })
  : []));
const albumReadyCount = computed(() => albumFormationCards.value.filter(({ ready }) => ready).length);
const albumPageLabel = computed(() => ALBUM_PAGES.find(({ id }) => id === albumPage.value)?.label ?? "");
const tesujiCards = computed(() => TESUJI_IDS.map((id) => {
  const got = collection.value.tesuji?.[id];
  return {
    id, label: TESUJI_NAMES[id as keyof typeof TESUJI_NAMES], got: Boolean(got), count: got?.count ?? 0,
    isNew: Boolean(got && collectionSeenAt && got.firstAt > collectionSeenAt),
  };
}));
const wall = computed(() => levelWall(collection.value, { recommended: props.state.games ? recommendedLevel(props.state.rating) : null }));
/** ページの切り替えに、取った数と全部の数を添える(記念は数えない)。 */
const albumPageTabs = computed(() => ALBUM_PAGES.map((page) => {
  if (FORMATION_PAGES.has(page.id)) {
    const cards = COLLECTION_CATALOG.filter((entry) => albumPageOf(entry) === page.id);
    return { ...page, total: cards.length, got: cards.filter(({ label }) => collection.value.formations[label]).length };
  }
  if (page.id === "tesuji") return { ...page, total: TESUJI_IDS.length, got: TESUJI_IDS.filter((id) => collection.value.tesuji?.[id]).length };
  if (page.id === "levels") return { ...page, total: COLLECTION_LEVELS.length, got: collectedLevelCount.value };
  return { ...page, total: 0, got: 0 };
}));
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

// ---- 賞状帳(大会の項目)。新しい順に3枚、「すべて見る」で全部。押すと賞状を開く(動かさない)。
const AWARD_PREVIEW = 3;
const allAwards = ref(false);
const shownAwards = computed(() => [...props.awards].reverse().slice(0, allAwards.value ? undefined : AWARD_PREVIEW));
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
// ---- 観戦記(大会の項目)。賞状帳と同じく、新しい順に3局、「すべて見る」で全部。
const kansenki = ref<(KansenkiView & { id: string; win?: boolean })[]>(loadKansenki(typeof localStorage === "undefined" ? null : localStorage));
const allKansenki = ref(false);
const shownKansenki = computed(() => kansenki.value.slice(0, allKansenki.value ? undefined : AWARD_PREVIEW));
const kansenkiShown = ref<KansenkiView | null>(null);

// ---- 戻る操作(ブラウザの戻る)。重ねて開いたもの(賞状・名鑑のくわしい情報)から閉じる。閉じたら真。
const bookEl = ref<{ goBack: () => boolean } | null>(null);
function goBack() {
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
  if (nextGoal.value) lines.push(`${gradeName(nextGoal.value.label)}まで、あとR${nextGoal.value.remaining}。いっしょにがんばろう！`);
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
const RECENT_GAME_LIMIT = 8;
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

const USAGE_LIMIT = 8;
/** 「得意」「にがて」の札を付けるのに要る対局数。 */
const TAG_MIN_GAMES = 3;
function usageGroup(category: string, title: string) {
  const rows = (usageRows(props.state, category) as UsageRow[]).slice(0, USAGE_LIMIT)
    .map((row) => ({ ...row, winRate: row.games ? row.wins / row.games : 0, tag: "" as "" | "best" | "weak" }));
  const tagged = rows.filter((row) => row.games >= TAG_MIN_GAMES);
  const best = tagged.reduce<typeof rows[number] | null>((top, row) => (!top || row.winRate > top.winRate ? row : top), null);
  if (best && best.winRate >= 0.5) best.tag = "best";
  for (const row of tagged) if (row !== best && row.winRate < 0.5) row.tag = "weak";
  return { category, title, rows };
}
/** まとめに出す得意な戦法。戦法の中で「★得意」の札が付いたもの。 */
const favoriteStrategy = computed(() => usageGroup("rook", "").rows.find((row) => row.tag === "best") ?? null);
const ownUsageGroups = computed(() => [
  usageGroup("rook", "あなたの戦法"),
  usageGroup("castle", "あなたの囲い"),
  usageGroup("battle", "戦型"),
]);
const opponentUsageGroups = computed(() => [
  usageGroup("opponentRook", "相手の戦法"),
  usageGroup("opponentCastle", "相手の囲い"),
]);

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
.shogi-game .shogi-note__pane > .shogi-note__cover,
.shogi-game .shogi-note__pane > .shogi-note__panel--fill {
  flex: 1 0 auto;
  box-sizing: border-box;
}
.shogi-game .shogi-note__pane > .shogi-note__cover { align-content: space-evenly; }
.shogi-game .shogi-note__panel.shogi-note__panel--fill { align-items: stretch; }
.shogi-game .shogi-note__panel--fill > .shogi-note__card { align-content: start; }
.shogi-game .shogi-note__panel--fill .shogi-note__trend-card { grid-template-rows: auto minmax(0, 1fr); }
.shogi-game .shogi-note__panel--fill .shogi-note__trend-box { height: 100%; box-sizing: border-box; }
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
.shogi-game .shogi-note__actions { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 0.6rem; margin-top: 0.2rem; }

/* ===== ボタン ===== */
.shogi-game .shogi-note__button,
.shogi-game .shogi-note__declare select {
  box-sizing: border-box;
  height: var(--note-control);
  border-radius: 0.6rem;
  font: inherit;
}
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
/* ページ: 取った数と全部の数を添える。 */
.shogi-game .shogi-note__album-pages { display: flex; flex-wrap: wrap; gap: 0.35rem; }
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
  .shogi-game .shogi-note__declare { grid-template-columns: minmax(0, 1fr); }
  .shogi-game .shogi-note__history li { grid-template-columns: auto auto minmax(0, 1fr); }
  .shogi-game .shogi-note__history-record { grid-column: 3; justify-self: end; }
  .shogi-game .shogi-note__actions { grid-template-columns: minmax(0, 1fr); }
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
}
</style>
