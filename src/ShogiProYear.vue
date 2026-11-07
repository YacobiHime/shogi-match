<template>
  <!--
    棋士の1年(docs/pro-year-design.md)。大会の画面(ShogiTournament.vue)の中に出し、研修会・団体戦と同じ部品の見た目を使う。
    入口: 12の棋戦の札と設定、「デビューする」。1年: 下の欄に次の対局の札(「次の対局日へ」「対局する」「分身に任せる」)、
    上に月のカレンダー・棋戦の一覧・成績のタブ。日のマスを押すとその日の対局、棋戦を押すと段階ごとの表。年度の終わりはまとめと「次の年度へ」。
  -->
  <div class="shoreikai pro-year" data-pro-year>
    <!-- 入口 -->
    <div v-if="!state" class="shogi-tournament__stage shogi-tournament__stage--entry shoreikai__framed" data-pro-year-screen="entry">
      <header class="shogi-tournament__topbar shoreikai__topbar">
        <button type="button" class="shogi-tournament__topbar-back" :aria-label="backLabel" data-pro-back @click="emit('back')">
          <span aria-hidden="true">←</span><span class="shogi-tournament__topbar-back-text">{{ backLabel }}</span>
        </button>
        <span class="shogi-tournament__seal" aria-hidden="true">棋</span>
        <div class="shogi-tournament__topbar-title">
          <h1 id="shogi-tournament-title">棋士の1年</h1>
          <p class="shogi-tournament__topbar-sub">{{ PRO_YEAR_TEXT.entrySub }}</p>
        </div>
      </header>
      <div class="shogi-tournament__mapwrap pro-year__mapwrap">
        <div class="pro-year__intro" data-pro-intro>
          <p class="pro-year__lead">{{ PRO_YEAR_TEXT.lead }}</p>
          <ul class="pro-year__chips" aria-label="1年の棋戦">
            <li v-for="event in PRO_EVENTS" :key="event.id" class="pro-year__chip" :style="{ '--event-color': event.color }">
              <span class="pro-year__chip-dot" aria-hidden="true"></span>
              <span>{{ event.name }}</span>
              <small>{{ event.kind === "title" ? "タイトル" : "棋戦" }}</small>
            </li>
          </ul>
        </div>
      </div>
      <section class="shogi-tournament__hud" aria-label="デビュー">
        <p class="shogi-tournament__goal-box"><small>目標</small><span>{{ PRO_YEAR_TEXT.goal }}</span></p>
        <p class="shogi-tournament__tip-line shoreikai__tip" data-pro-talk>
          <img class="shogi-tournament__tip-face pro-year__sprite" :src="hananeSprite" alt="" draggable="false">
          <span class="shogi-tournament__tip-text">{{ PRO_YEAR_TEXT.hananeEntry }}</span>
        </p>
        <div class="shogi-tournament__entry-settings">
          <p>
            <small>設定</small>
            <span data-pro-summary>{{ settingsSummary }}</span>
          </p>
          <button type="button" class="shogi-tournament__sub" data-pro-change @click="settingsOpen = true">変える</button>
        </div>
        <button type="button" class="shogi-tournament__start" data-pro-enter @click="enter">デビューする</button>
      </section>

      <div v-if="settingsOpen" class="shogi-tournament__sheet" role="dialog" aria-modal="true" aria-label="デビューの設定" data-pro-settings @click.self="settingsOpen = false">
        <div class="shogi-tournament__sheet-panel shogi-tournament__detail">
          <h2>デビューの設定</h2>
          <ul class="shogi-tournament__settings">
            <li v-for="row in settingRows" :key="row.id">
              <button
                type="button"
                class="shogi-tournament__setting"
                :data-pro-row="row.id"
                :aria-label="`${row.label}: ${row.value}。押すと変更`"
                @click="picker = row.id"
              >
                <span class="shogi-tournament__setting-label">{{ row.label }}</span>
                <span class="shogi-tournament__setting-value">{{ row.value }}<small v-if="row.note">{{ row.note }}</small></span>
                <span class="shogi-tournament__setting-change" aria-hidden="true">変更</span>
              </button>
            </li>
          </ul>
          <button type="button" class="shogi-tournament__sub shogi-tournament__sheet-close" @click="settingsOpen = false">閉じる</button>
        </div>
      </div>
      <PregamePicker
        v-if="pickerConfig"
        :title="pickerConfig.title"
        :sections="pickerConfig.sections"
        :note="pickerConfig.note"
        :action="picker === 'difficulty' ? MEASURE_PICKER_ACTION : null"
        @select="onPick"
        @close="picker = ''"
        @action="picker = ''; emit('measure')"
      />
    </div>

    <!-- 1年 -->
    <div v-else-if="view" class="shogi-tournament__stage shogi-tournament__stage--shoreikai" :data-pro-year-screen="view.yearDone ? 'summary' : 'year'">
      <header class="shogi-tournament__topbar shoreikai__topbar">
        <button type="button" class="shogi-tournament__topbar-back" :aria-label="backLabel" data-pro-back @click="emit('back')">
          <span aria-hidden="true">←</span><span class="shogi-tournament__topbar-back-text">{{ backLabel }}</span>
        </button>
        <span class="shogi-tournament__seal" aria-hidden="true">棋</span>
        <div class="shogi-tournament__topbar-title">
          <h1 id="shogi-tournament-title">{{ view.fy }}年度 棋士の1年</h1>
          <p class="shogi-tournament__topbar-sub" data-pro-sub>{{ yearSub }}</p>
        </div>
      </header>

      <section class="shoreikai__main pro-year__main" :class="{ 'pro-year__main--wide': wide, 'pro-year__main--goals': goals.length || bigGame }" aria-label="1年">
        <!-- 今年の目標と次の大一番(13-3の7・8。いつも上に出し、遠くの目当てを見せる。D:5-2) -->
        <div v-if="goals.length || bigGame" class="pro-year__goalbar" data-pro-goals>
          <ul v-if="goals.length" class="pro-year__goal-list" aria-label="今年の目標">
            <li v-for="goal in goals" :key="goal.id" class="pro-year__goal" :class="{ 'pro-year__goal--done': goal.done }" :data-pro-goal="goal.id">
              <span class="pro-year__goal-mark" aria-hidden="true">{{ goal.done ? "✓" : "◎" }}</span>
              <span class="pro-year__goal-text"><b>{{ goal.label }}</b><small>{{ goal.done ? "達成" : goal.text }}</small></span>
              <span class="pro-year__goal-bar" aria-hidden="true"><i :style="{ width: `${Math.round(goal.ratio * 100)}%` }"></i></span>
            </li>
          </ul>
          <p v-if="bigGame" class="pro-year__bigone" data-pro-bigone>
            <small>{{ bigGame.kind === "fixed" && bigGame.weeks <= 0 ? "大一番の週" : "次の大一番" }}</small>
            <template v-if="bigGame.kind === 'fixed'"><b>{{ bigGame.label }}<span v-if="bigGame.opponent"> 対 {{ nameText(bigGame.opponent) }}</span></b><em>{{ bigGame.whenText }}</em></template>
            <b v-else>{{ bigGame.text }}</b>
          </p>
        </div>

        <div v-if="!wide" class="pro-year__tabs" role="tablist" aria-label="見るもの">
          <button v-for="item in tabs" :key="item.id" type="button" role="tab" :aria-selected="tab === item.id" :data-pro-tab="item.id" @click="tab = item.id">{{ item.label }}</button>
        </div>

        <!-- 今週(13章。画面の主役。1週の行動を選んで進める) -->
        <div v-show="wide || tab === 'week'" class="pro-year__weekpanel" data-pro-week>
          <template v-if="week">
            <!-- 先週の将棋ニュース(14-3の3)。押すと紙面。 -->
            <button v-if="week.news" type="button" class="pro-year__news" data-pro-news @click="newsOpen = week.news">
              <span class="pro-year__news-mast">週刊 将棋ニュース<small>第{{ week.news.number }}週</small></span>
              <b class="pro-year__news-head">{{ week.news.headline }}</b>
              <span v-if="week.news.lead || week.news.lines[0]" class="pro-year__news-lead">{{ week.news.lead || week.news.lines[0] }}</span>
              <span class="pro-year__news-more" aria-hidden="true">紙面を開く ›</span>
            </button>
            <!-- 取材の依頼(14-3の5)。行動の枠を使わない。 -->
            <button v-if="week.interview" type="button" class="pro-year__interview" data-pro-interview @click="interviewOpen = true">
              <span class="pro-year__interview-icon" aria-hidden="true">記</span>
              <span><b>取材の依頼</b><small>{{ week.interview.reporter }}「{{ week.interview.question }}」</small></span>
              <span class="pro-year__interview-go">答える</span>
            </button>
            <div class="pro-year__week-head">
              <h2>第{{ week.number }}週<small>{{ shortDate(week.start) }}〜{{ shortDate(week.end) }}</small></h2>
              <p class="pro-year__condition" :data-pro-condition="week.condition">
                <small>調子</small>
                <span class="pro-year__cond-dots" aria-hidden="true"><i v-for="n in 5" :key="n" :class="{ on: n <= week.condition + 1 }"></i></span>
                <b>{{ week.conditionLabel }}</b>
              </p>
            </div>
            <ol class="pro-year__strip" aria-label="今週の7日">
              <li
                v-for="day in week.days"
                :key="day.date"
                class="pro-year__strip-day"
                :class="{ 'is-past': day.past, 'is-today': day.today, 'is-out': !day.inYear, 'is-sun': day.dow === '日', 'is-sat': day.dow === '土' }"
              >
                <small>{{ day.dow }}</small><b>{{ Number(day.date.slice(8)) }}</b>
                <span v-if="day.game" class="pro-year__strip-mark pro-year__strip-mark--game">局</span>
                <span v-else-if="day.festival" class="pro-year__strip-mark pro-year__strip-mark--festival">祭</span>
                <span v-else-if="day.study" class="pro-year__strip-mark pro-year__strip-mark--study">研</span>
              </li>
            </ol>
            <ul v-if="week.games.length" class="pro-year__week-games" aria-label="今週の対局">
              <li v-for="game in week.games" :key="game.id" class="pro-year__week-game" :data-pro-week-game="game.id">
                <span class="pro-year__weight" :class="`pro-year__weight--${game.weight}`">{{ WEIGHTS[game.weight as keyof typeof WEIGHTS]?.label ?? "" }}</span>
                <span class="pro-year__week-game-text"><b>{{ game.dateText }}</b>{{ game.label }}{{ game.twoDay ? "（2日制）" : "" }}<small>対 {{ nameText(game.opponent) }}</small></span>
                <span class="pro-year__stars" :aria-label="`対策 ★${game.stars}`">{{ "★".repeat(game.stars) }}<i>{{ "☆".repeat(Math.max(0, (week.prep?.cap ?? 1) - game.stars)) }}</i></span>
              </li>
            </ul>
            <p v-else class="pro-year__week-free">今週は公式戦がないよ。行動を2つ選べるよ。</p>
            <h3 class="pro-year__subhead">今週の行動<small>{{ week.slots ? `（${week.slots}つ）` : "" }}</small></h3>
            <p v-if="!week.slots" class="pro-year__week-free">対局が続く週。行動はお休み。</p>
            <div v-else class="pro-year__slots">
              <button
                v-for="index in week.slots"
                :key="index"
                type="button"
                class="pro-year__slot"
                :class="{ 'pro-year__slot--set': slotAction(index - 1), 'pro-year__slot--lock': week.applied }"
                :disabled="week.applied"
                :data-pro-slot="index - 1"
                @click="slotSheet = index - 1"
              >
                <span class="pro-year__slot-icon" aria-hidden="true">{{ slotAction(index - 1)?.icon ?? "＋" }}</span>
                <span class="pro-year__slot-text">
                  <b>{{ slotAction(index - 1) ? actionTitle(slotAction(index - 1)) : "行動を選ぶ" }}</b>
                  <small>{{ slotAction(index - 1)?.effect ?? (index === 1 ? "研究・休む・研究会・まつり" : "選ばなければ何もしない") }}</small>
                </span>
              </button>
            </div>
            <!-- 分身の1行(14-3の2)。押すと分身のシート。 -->
            <button type="button" class="pro-year__avatar-row" data-pro-avatar @click="avatarOpen = true">
              <span class="pro-year__slot-icon pro-year__avatar-icon" aria-hidden="true">分</span>
              <span class="pro-year__slot-text">
                <b>分身　いちばん高い {{ week.avatar.top.label }} Lv{{ week.avatar.top.level }}<template v-if="week.avatar.grew">・今週 <i class="pro-year__gain">{{ week.avatar.grew.label }}＋{{ week.avatar.grew.gain }}</i></template></b>
                <small v-if="week.avatar.closest">{{ week.avatar.closest.label }} Lv{{ week.avatar.closest.level + 1 }} まで あと{{ week.avatar.closest.need }}</small>
                <span class="pro-year__avatar-bar" aria-hidden="true"><i :style="{ width: `${Math.round((week.avatar.closest?.ratio ?? 1) * 100)}%` }"></i></span>
              </span>
            </button>
            <div v-if="!week.news && week.lastWeek?.lines?.length" class="pro-year__lastweek" data-pro-lastweek>
              <h3 class="pro-year__subhead">先週のまとめ<small>（第{{ week.lastWeek.number }}週）</small></h3>
              <ul><li v-for="(line, index) in week.lastWeek.lines" :key="index">{{ line }}</li></ul>
            </div>
          </template>
          <p v-else class="pro-year__week-free">年度が終わったよ。まとめを見てね。</p>
        </div>

        <div v-show="wide || tab !== 'week'" class="pro-year__side">
          <div v-if="wide" class="pro-year__tabs" role="tablist" aria-label="見るもの">
            <button v-for="item in sideTabs" :key="item.id" type="button" role="tab" :aria-selected="sideTab === item.id" :data-pro-tab="item.id" @click="tab = item.id">{{ item.label }}</button>
          </div>

        <!-- 月のカレンダー -->
        <div v-show="sideTab === 'calendar'" class="pro-year__calendar" data-pro-calendar>
          <div class="pro-year__month-bar">
            <button type="button" class="pro-year__month-step" aria-label="前の月" data-pro-month="prev" :disabled="!canPrev" @click="stepMonth(-1)">‹</button>
            <h2 class="pro-year__month-title" aria-live="polite">{{ month.title }}</h2>
            <button type="button" class="pro-year__month-step" aria-label="次の月" data-pro-month="next" :disabled="!canNext" @click="stepMonth(1)">›</button>
          </div>
          <div class="pro-year__grid" role="grid" :aria-label="month.title">
            <div class="pro-year__weekdays" role="row">
              <span v-for="(day, index) in WEEKDAY_LABELS" :key="day" role="columnheader" :class="{ 'pro-year__weekday--sun': index === 0, 'pro-year__weekday--sat': index === 6 }">{{ day }}</span>
            </div>
            <div v-for="(week, row) in month.weeks" :key="row" class="pro-year__week" role="row">
              <button
                v-for="cell in week"
                :key="cell.date"
                type="button"
                role="gridcell"
                class="pro-year__day"
                :class="{
                  'pro-year__day--out': !cell.inMonth,
                  'pro-year__day--today': cell.today,
                  'pro-year__day--past': cell.past,
                  'pro-year__day--busy': cell.items.length > 0,
                }"
                :disabled="!cell.inMonth"
                :aria-label="dayAria(cell)"
                :data-pro-day="cell.date"
                @click="openDay(cell.date)"
              >
                <span class="pro-year__day-no">{{ cell.day }}</span>
                <span v-if="cell.inMonth" class="pro-year__marks">
                  <span
                    v-for="(item, index) in cellMarks(cell)"
                    :key="index"
                    class="pro-year__mark"
                    :class="[`pro-year__mark--${item.kind}`, item.result ? `pro-year__mark--${item.result}` : '']"
                    :style="{ '--event-color': item.color }"
                  >{{ markText(item) }}</span>
                </span>
              </button>
            </div>
          </div>
          <p class="pro-year__legend" aria-hidden="true">
            <span class="pro-year__mark pro-year__mark--user" style="--event-color: #f5cba7">対局</span>自分の対局
            <span class="pro-year__mark pro-year__mark--plan" style="--event-color: #f5cba7">予定</span>勝ち残れば
            <span class="pro-year__mark pro-year__mark--title">★</span>タイトル戦
            <span class="pro-year__mark pro-year__mark--rival">羽音</span>の対局
            <span class="pro-year__mark pro-year__mark--study">研</span>研究会
            <span class="pro-year__mark pro-year__mark--festival">祭</span>将棋まつり
          </p>
        </div>

          <!-- 棋戦の一覧 -->
          <ul v-show="sideTab === 'events'" class="pro-year__events" aria-label="棋戦" data-pro-events>
            <li v-for="event in view.events" :key="event.id">
              <button type="button" class="pro-year__event" :style="{ '--event-color': event.color }" :data-pro-event="event.id" @click="openEvent(event.id)">
                <span class="pro-year__event-bar" aria-hidden="true"></span>
                <span class="pro-year__event-text">
                  <strong>{{ event.name }}</strong>
                  <small v-if="event.holder">{{ event.holder.you ? `${playerName}（あなた）` : event.holder.name }}{{ event.short }}</small>
                  <small v-else>一般棋戦</small>
                </span>
                <span class="pro-year__event-status" :class="statusClass(event.status)">{{ event.status?.text ?? (event.id === "jt" ? "タイトルを取ると招待" : "出場なし") }}</span>
              </button>
            </li>
          </ul>

          <!-- 成績 -->
          <div v-show="sideTab === 'record'" class="pro-year__record" data-pro-record>
            <div class="pro-year__stats">
              <p><small>今年度</small><b>{{ view.record.wins }}勝{{ view.record.losses }}敗</b></p>
              <p><small>連勝</small><b>{{ view.record.streak }}<small>（最高 {{ view.record.best }}）</small></b></p>
              <p><small>順位戦</small><b>{{ view.cls }}</b></p>
              <p><small>タイトル</small><b>{{ view.titles.length ? view.titles.join("・") : "なし" }}</b></p>
            </div>
            <p v-if="view.rival" class="pro-year__rival" data-pro-rival>
              <img class="pro-year__rival-face pro-year__sprite" :src="hananeSprite" alt="" draggable="false">
              <span>{{ view.rival.name }}　今年度 {{ view.rival.wins }}勝{{ view.rival.losses }}敗<small>あなたとの対戦 {{ view.rival.vs.wins }}勝{{ view.rival.vs.losses }}敗</small></span>
            </p>
            <!-- 研究会(10-2の5) -->
            <template v-if="view.study">
              <h3 class="pro-year__subhead">研究会<small>（第1・第3水曜）</small></h3>
              <ul class="pro-year__study" data-pro-study>
                <li v-for="member in view.study.members" :key="member.id" :class="{ 'pro-year__study--next': member.id === view.study.next?.id }">
                  <span>{{ member.name }}<small>{{ member.dan }}</small></span>
                  <b>{{ member.record.w }}勝{{ member.record.l }}敗{{ member.record.d ? `${member.record.d}分` : "" }}</b>
                </li>
              </ul>
            </template>
            <!-- 記録のランキング(14-3の4)。10位の外なら近い目当て(D:5-6)。 -->
            <h3 class="pro-year__subhead">記録のランキング<small>（今年度）</small></h3>
            <div class="pro-year__ranks" data-pro-ranks>
              <section v-for="kind in view.records" :key="kind.id" class="pro-year__rank">
                <b>{{ kind.label }}</b>
                <ol>
                  <li v-for="row in kind.top" :key="row.id" :class="{ 'pro-year__ranking--you': row.you }"><small>{{ row.rank }}位</small><span>{{ row.you ? `${playerName}（あなた）` : row.name }}</span><b>{{ row.value }}</b></li>
                  <li v-if="kind.you" class="pro-year__ranking--you"><small>{{ kind.you.rank }}位</small><span>{{ playerName }}（あなた）</span><b>{{ kind.you.value }}</b></li>
                </ol>
                <small v-if="kind.near" class="pro-year__rank-near">{{ kind.near }}</small>
              </section>
            </div>
            <!-- ファンレター(14-3の6) -->
            <h3 class="pro-year__subhead">ファンレター<small>（{{ view.letters.length }}通）</small></h3>
            <ul class="pro-year__letters" data-pro-letters>
              <li v-for="(letter, index) in view.letters" :key="index" class="pro-year__letter"><span class="pro-year__letter-env" aria-hidden="true">✉</span><span>{{ letter.text }}<small>{{ letter.from }}より（ファン{{ letter.mark }}人）</small></span></li>
              <li v-if="view.nextLetter" class="pro-year__letter pro-year__letter--next"><span class="pro-year__letter-env" aria-hidden="true">？</span><span>ファンが{{ view.nextLetter.mark }}人になると、次の手紙が届くよ<small>あと{{ view.nextLetter.need }}人</small></span></li>
            </ul>
            <!-- お金と研究の道具(10-2の3・4。次の道具まで「あと○万円」が見える。D:5-2) -->
            <h3 class="pro-year__subhead">お金と研究の道具</h3>
            <div class="pro-year__wallet" data-pro-wallet>
              <p class="pro-year__money"><small>持っているお金</small><b data-pro-money>{{ moneyText(view.wallet.money) }}</b></p>
              <p class="pro-year__money-line">
                今年度の獲得 <b>{{ moneyText(view.wallet.earned) }}</b>
                <small>対局料 {{ moneyText(view.wallet.mine.fee) }}・賞金 {{ moneyText(view.wallet.mine.prize) }}・謝礼 {{ moneyText(view.wallet.mine.gig) }}</small>
              </p>
              <p class="pro-year__gear-now">ファン：<b data-pro-fans>{{ view.wallet.fans }}人</b><small>将棋まつりの謝礼が増えるよ</small></p>
              <p class="pro-year__gear-now">研究の道具：<b>{{ view.wallet.gearName || "まだない" }}</b><small v-if="view.wallet.gearPrep">{{ view.wallet.gearPrep }}</small></p>
              <div v-if="view.wallet.next" class="pro-year__gear-next" data-pro-gear>
                <span class="pro-year__gear-name">次は<b>{{ view.wallet.next.name }}</b>（{{ moneyText(view.wallet.next.price) }}）<small>{{ view.wallet.next.prep }}</small></span>
                <span class="pro-year__gear-bar" aria-hidden="true"><i :style="{ width: `${Math.min(100, (view.wallet.money / view.wallet.next.price) * 100)}%` }"></i></span>
                <button type="button" class="pro-year__gear-buy" :disabled="!view.wallet.next.affordable" data-pro-buy-gear @click="emit('life', { kind: 'buy-gear' })">
                  {{ view.wallet.next.affordable ? "買う" : `あと${moneyText(view.wallet.next.need)}` }}
                </button>
              </div>
              <p v-else class="pro-year__gear-now"><small>研究の道具は、ぜんぶそろったよ。</small></p>
            </div>
            <h3 class="pro-year__subhead">獲得賞金・対局料ランキング<small>（今年度）</small></h3>
            <ol class="pro-year__ranking" data-pro-ranking>
              <li v-for="row in view.wallet.top" :key="row.id" :class="{ 'pro-year__ranking--you': row.you, 'pro-year__ranking--rival': row.story === 'hanane' }">
                <small>{{ row.rank }}位</small><span>{{ row.you ? `${playerName}（あなた）` : row.name }}</span><b>{{ moneyText(row.amount) }}</b>
              </li>
              <li v-if="view.wallet.near.length" class="pro-year__ranking-gap" aria-hidden="true">…</li>
              <li v-for="row in view.wallet.near" :key="`near-${row.id}`" :class="{ 'pro-year__ranking--you': row.you, 'pro-year__ranking--rival': row.story === 'hanane' }">
                <small>{{ row.rank }}位</small><span>{{ row.you ? `${playerName}（あなた）` : row.name }}</span><b>{{ moneyText(row.amount) }}</b>
              </li>
            </ol>
            <template v-if="view.kigou.length">
              <h3 class="pro-year__subhead">揮毫帳<small>（{{ view.kigou.length }}枚）</small></h3>
              <ul class="pro-year__kigou" data-pro-kigou>
                <li v-for="(item, index) in view.kigou" :key="index"><b>{{ item.word }}</b><small>{{ shortDate(item.date) }} {{ item.place }}</small></li>
              </ul>
            </template>
            <h3 class="pro-year__subhead">できごと</h3>
            <ul class="pro-year__log">
              <li v-if="!view.log.length" class="pro-year__log-empty">まだ何もないよ。最初の対局へ。</li>
              <li v-for="(item, index) in view.log" :key="index" :class="`pro-year__log--${item.kind}`">
                <small>{{ shortDate(item.date) }}</small><span>{{ item.text }}</span>
              </li>
            </ul>
            <template v-if="view.history.length">
              <h3 class="pro-year__subhead">これまでの年度</h3>
              <ul class="pro-year__log">
                <li v-for="item in view.history" :key="item.fy"><small>{{ item.fy }}年度</small><span>{{ item.wins }}勝{{ item.losses }}敗{{ item.titles.length ? `・${item.titles.join("・")}` : "" }}{{ item.money ? `・獲得${moneyText(item.money.earned)}（${item.money.rank}位）` : "" }}{{ item.awards.length ? `・${item.awards.join("・")}` : "" }}</span></li>
              </ul>
            </template>
          </div>
        </div>
      </section>

      <section class="shogi-tournament__hud" aria-label="次の対局">
        <!-- 年度のまとめ -->
        <div v-if="view.yearDone && view.summary" class="pro-year__summary" data-pro-summary-card>
          <p class="pro-year__summary-head">{{ view.summary.fy }}年度のまとめ</p>
          <p class="pro-year__summary-main">{{ view.summary.wins }}勝{{ view.summary.losses }}敗<small>勝率 {{ rateText(view.summary.rate) }}</small></p>
          <p v-if="view.summary.titles.length" class="pro-year__summary-title">{{ view.summary.titles.join("・") }} 獲得</p>
          <p v-if="view.summary.awards.length" class="pro-year__awards">
            <span v-for="award in view.summary.awards" :key="award" class="pro-year__award">{{ award }}</span>
          </p>
          <p v-if="view.summary.junni" class="pro-year__summary-line">順位戦 {{ CLASS_NAMES[view.summary.junni.cls] }} {{ view.summary.junni.wins }}勝{{ view.summary.junni.losses }}敗（{{ view.summary.junni.place }}位）{{ view.summary.junni.promoted ? "・昇級" : "" }}</p>
          <p v-if="view.summary.rival" class="pro-year__summary-line">{{ view.summary.rival.name }} {{ view.summary.rival.wins }}勝{{ view.summary.rival.losses }}敗・直接対決 {{ view.summary.rival.meetings[0] }}勝{{ view.summary.rival.meetings[1] }}敗</p>
          <p v-if="view.summary.money" class="pro-year__summary-line" data-pro-summary-money>獲得賞金・対局料 {{ moneyText(view.summary.money.earned) }}（{{ view.summary.money.rank }}位）</p>
          <!-- 今年の見出し(14-3の3) -->
          <ul v-if="view.summary.headlines?.length" class="pro-year__summary-heads" data-pro-summary-heads>
            <li v-for="item in view.summary.headlines" :key="item.number"><small>第{{ item.number }}週</small>{{ item.headline }}</li>
          </ul>
          <!-- 今年の目標の判子(達成・あと一歩・届かず。13-3の7。G:3) -->
          <ul v-if="view.summary.goals?.length" class="pro-year__goal-stamps" data-pro-goal-stamps>
            <li v-for="goal in view.summary.goals" :key="goal.id" :class="`pro-year__goal-stamp--${goal.stamp}`">
              <span class="pro-year__goal-seal" aria-hidden="true">{{ STAMP_TEXT[goal.stamp as keyof typeof STAMP_TEXT] }}</span>
              <span>{{ goal.label }}<small>{{ goal.text }}</small></span>
            </li>
          </ul>
        </div>
        <!-- 仕事の日の札(14-3の1)。遊ぶか、さっと済ませる。 -->
        <div v-else-if="view.work && !view.pending" class="pro-year__workcard" data-pro-workcard>
          <p class="pro-year__next-head"><b>{{ view.work.dateText }}</b><span>{{ view.work.client }}</span><span class="pro-year__work-tag">仕事</span></p>
          <p class="pro-year__work-title">{{ view.work.label }}</p>
          <p class="pro-year__work-note">{{ view.work.note }}<template v-if="view.work.gameLabel">（{{ view.work.gameLabel }}）</template></p>
          <p class="pro-year__work-terms">
            <span><b>{{ view.work.best.fee === view.work.quick.fee ? `${view.work.best.fee}万円` : `最大${view.work.best.fee}万円` }}</b></span>
            <span><b>ファン＋{{ view.work.best.fans }}</b></span>
            <span><b class="pro-year__gain">{{ view.work.bestGrow }}</b></span>
          </p>
        </div>
        <!-- 次の対局 -->
        <div v-else-if="view.pending" class="pro-year__next" :style="{ '--event-color': pendingColor }" data-pro-next>
          <p class="pro-year__next-head">
            <b>{{ view.pending.dateText }}</b><span>{{ view.pending.label }}</span>
            <span v-if="view.pending.gameId && view.pending.weight" class="pro-year__weight" :class="`pro-year__weight--${view.pending.weight}`">{{ WEIGHTS[view.pending.weight as keyof typeof WEIGHTS]?.label ?? "" }}</span>
          </p>
          <p class="pro-year__next-vs">
            <span>対 <strong>{{ view.pending.opponent?.name }}</strong><small>{{ view.pending.opponent?.dan }}</small></span>
            <small class="pro-year__next-stakes">{{ view.pending.stakes?.text }}</small>
          </p>
          <!-- 週の研究と調子が効くところ(13-3の3。閃きの増減を数字で見せる。D:4-2) -->
          <p v-if="view.pending.gameId" class="pro-year__prep pro-year__prep--week" data-pro-pending-week>
            <b>対策 {{ view.pending.stars ? "★".repeat(view.pending.stars) : "なし" }}</b>
            <span>調子 {{ CONDITION_LABELS[view.pending.condition ?? 2] }}</span>
            <span v-if="view.pending.starsHit">作戦が当たった！</span>
            <span v-if="view.pending.hintBonus">閃き {{ view.pending.hintBonus > 0 ? "＋" : "−" }}{{ Math.abs(view.pending.hintBonus) }}</span>
          </p>
          <!-- 研究仲間(研究会で指した相手。道具がなくても。10-2の5) -->
          <p v-if="view.pending.studyMate" class="pro-year__prep pro-year__prep--mate" data-pro-study-mate>
            <b>{{ STUDY_TEXT.mate }}</b>
            <span>研究会で{{ view.pending.studyMate.wins }}勝{{ view.pending.studyMate.losses }}敗</span>
            <span v-if="view.pending.studyMate.repertoire && !view.pending.prep">得意：{{ view.pending.studyMate.repertoire }}</span>
          </p>
          <!-- 事前研究(研究の道具を持っていれば。10-2の4) -->
          <p v-if="view.pending.prep" class="pro-year__prep" data-pro-prep>
            <b>事前研究</b>
            <span>得意：{{ view.pending.prep.repertoire }}</span>
            <span v-if="view.pending.prep.plan">読み：{{ view.pending.prep.plan }}</span>
            <span v-if="view.pending.prep.attack">{{ view.pending.prep.attack }}{{ view.pending.prep.abilities.length ? `・${view.pending.prep.abilities.join("・")}` : "" }}</span>
          </p>
        </div>
        <p class="shogi-tournament__tip-line shoreikai__tip" data-pro-run-talk>
          <img class="shogi-tournament__tip-face pro-year__sprite" :src="talkSprite" alt="" draggable="false">
          <span class="shogi-tournament__tip-text">{{ runLine }}</span>
        </p>
        <template v-if="view.yearDone">
          <button type="button" class="shogi-tournament__start" data-pro-next-year @click="emit('next-year')">次の年度へ</button>
        </template>
        <template v-else-if="view.work && !view.pending">
          <div class="shogi-tournament__actions shogi-tournament__actions--two pro-year__advance">
            <button type="button" class="shogi-tournament__sub" data-pro-work-quick @click="emit('life', { kind: 'work-quick' })">さっと済ませる<small>{{ view.work.quick.fee }}万円・{{ view.work.quickGrow }}</small></button>
            <button type="button" class="shogi-tournament__start" data-pro-work-play @click="playWork">{{ view.work.play }}</button>
          </div>
        </template>
        <!-- 公式戦の3つの指し方(13-3の5・6)。既定は重さで決め(小は勝負どころから)、その1つだけ琥珀色。分身には勝率の見込み(D:2-1) -->
        <template v-else-if="view.pending && view.pending.gameId && !suspendedMoves">
          <div class="pro-year__ways" data-pro-ways>
            <button type="button" :class="wayClass('full')" data-pro-play @click="playWithScene()">最初から指す<small>レーティングに数える</small></button>
            <button type="button" :class="wayClass('cut')" data-pro-cut @click="playCut">勝負どころから<small>40手目ごろから</small></button>
            <button type="button" class="shogi-tournament__sub" data-pro-auto @click="openAuto">分身に任せる<small v-if="autoChance !== null">勝つ見込み {{ autoChance }}%</small></button>
          </div>
        </template>
        <template v-else-if="view.pending">
          <div class="shogi-tournament__actions shogi-tournament__actions--two">
            <!-- 研究会の練習対局は、分身に任せない(帰ってもよい。D:9-2)。まつりの指導対局は、やめるとまつりへ戻る。 -->
            <button v-if="view.pending.kind === 'study'" type="button" class="shogi-tournament__sub" data-pro-leave-study @click="emit('life', { kind: 'leave-study' })">{{ STUDY_TEXT.leave }}</button>
            <button v-else-if="view.pending.kind === 'shidou'" type="button" class="shogi-tournament__sub" data-pro-cancel-shidou @click="emit('life', { kind: 'cancel-shidou' })">まつりへ戻る</button>
            <button v-else type="button" class="shogi-tournament__sub" data-pro-auto @click="openAuto">分身に任せる</button>
            <button type="button" class="shogi-tournament__start" data-pro-play @click="suspendedMoves ? emit('resume') : playWithScene()">
              {{ suspendedMoves ? `対局を再開（${suspendedMoves}手目から）` : view.pending.kind === "study" ? "練習対局を指す" : view.pending.kind === "shidou" ? "指導対局を指す" : "対局する" }}
            </button>
          </div>
        </template>
        <template v-else>
          <!-- 1週ずつ進める(13-3の1)。研究会・まつりは週の行動で選ぶ。急ぐ人は、次の対局の週までおまかせ(13-3の10。D:9-2) -->
          <div class="shogi-tournament__actions shogi-tournament__actions--two pro-year__advance">
            <button type="button" class="shogi-tournament__sub" data-pro-auto-weeks @click="emit('life', { kind: 'auto-weeks' })">対局の週までおまかせ</button>
            <button type="button" class="shogi-tournament__start" data-pro-advance @click="emit('life', { kind: 'week-advance' })">
              {{ week?.applied ? "週の続きを進める" : "この週を進める" }}
            </button>
          </div>
        </template>
      </section>

      <!-- 将棋ニュースの紙面(14-3の3)。 -->
      <div v-if="newsOpen" class="shogi-tournament__sheet" role="dialog" aria-modal="true" aria-label="将棋ニュース" data-pro-news-sheet @click.self="newsOpen = null">
        <div class="shogi-tournament__sheet-panel pro-year__paper">
          <p class="pro-year__paper-mast"><b>週刊 将棋ニュース</b><span>第{{ newsOpen.number }}週 {{ shortDate(newsOpen.start) }}〜{{ shortDate(newsOpen.end) }}</span></p>
          <h2 class="pro-year__paper-head">{{ newsOpen.headline }}</h2>
          <p v-if="newsOpen.lead" class="pro-year__paper-lead">{{ newsOpen.lead }}</p>
          <ul v-if="newsOpen.lines.length" class="pro-year__paper-lines">
            <li v-for="(line, index) in newsOpen.lines" :key="index">{{ line }}</li>
          </ul>
          <p v-if="newsOpen.record" class="pro-year__paper-record">{{ newsOpen.record }}</p>
          <p v-if="newsOpen.letter" class="pro-year__letter"><span class="pro-year__letter-env" aria-hidden="true">✉</span><span>{{ newsOpen.letter.text }}<small>ファンレター・{{ newsOpen.letter.from }}より</small></span></p>
          <p v-if="newsOpen.hanane" class="pro-year__paper-hanane"><img class="pro-year__sprite" :src="hananeSprite" alt="" draggable="false"><span>{{ newsOpen.hanane }}</span></p>
          <button type="button" class="shogi-tournament__sub shogi-tournament__sheet-close" data-pro-news-close @click="newsOpen = null">閉じる</button>
        </div>
      </div>

      <!-- 取材(14-3の5)。どの答えでもファン＋15。 -->
      <div v-if="interviewOpen && week?.interview" class="shogi-tournament__sheet" role="dialog" aria-modal="true" aria-label="取材" data-pro-interview-sheet @click.self="interviewOpen = false">
        <div class="shogi-tournament__sheet-panel shogi-tournament__detail pro-year__sheet">
          <p class="pro-year__interview-reporter">{{ week.interview.reporter }}</p>
          <h2>「{{ week.interview.question }}」</h2>
          <ul class="pro-year__actions">
            <li v-for="answer in week.interview.answers" :key="answer.id">
              <button type="button" class="pro-year__action" :data-pro-answer="answer.id" @click="answerInterview(answer.id)">
                <span class="pro-year__slot-icon" aria-hidden="true">{{ answer.icon }}</span>
                <span class="pro-year__slot-text"><b>{{ answer.text }}</b><small>{{ answer.label }}</small><em>ファン＋{{ INTERVIEW_FANS }}</em></span>
              </button>
            </li>
          </ul>
          <p class="shogi-tournament__text">答えは来週の将棋ニュースに載るよ。</p>
          <div class="shogi-tournament__actions shogi-tournament__actions--two">
            <button type="button" class="shogi-tournament__sub" data-pro-answer="none" @click="answerInterview(null)">今は答えない</button>
            <button type="button" class="shogi-tournament__sub" @click="interviewOpen = false">閉じる</button>
          </div>
        </div>
      </div>

      <!-- 分身のシート(14-3の2)。 -->
      <div v-if="avatarOpen && week" class="shogi-tournament__sheet" role="dialog" aria-modal="true" aria-label="分身の能力" data-pro-avatar-sheet @click.self="avatarOpen = false">
        <div class="shogi-tournament__sheet-panel shogi-tournament__detail pro-year__sheet">
          <h2>分身の能力<small>点線は今週のはじめ</small></h2>
          <div class="pro-year__radar"><RadarChart :axes="avatarAxes" :compare="avatarBefore" bare /></div>
          <ul class="pro-year__abars">
            <li v-for="row in week.avatar.rows" :key="row.key" :class="{ 'pro-year__abar--up': row.up }">
              <span>{{ row.label }}</span><b>Lv{{ row.level }}{{ row.up ? " ↑" : "" }}</b>
              <span class="pro-year__abar-track" aria-hidden="true"><i :style="{ width: `${Math.round(row.ratio * 100)}%` }"></i></span>
              <small>{{ row.level >= 10 ? "最高" : `次まで ${row.need}` }}</small>
            </li>
          </ul>
          <p class="shogi-tournament__text">分身に任せる・勝負どころからの強さ ＋{{ week.avatar.edge }}。自分で指すときの強さは、あなたの腕のまま。任せた対局では育たないよ。</p>
          <button type="button" class="shogi-tournament__sub shogi-tournament__sheet-close" @click="avatarOpen = false">閉じる</button>
        </div>
      </div>

      <!-- 勝負どころの局面を作っているあいだ(13-3の6。待つあいだもやめられる。UD:5-3) -->
      <div v-if="cutBusy" class="shogi-tournament__sheet" role="dialog" aria-modal="true" aria-label="控室で準備しています" data-pro-cut-busy>
        <div class="shogi-tournament__sheet-panel shogi-tournament__detail pro-year__sheet pro-year__cut-busy">
          <h2>控室で準備しています</h2>
          <p class="shogi-tournament__text">分身と{{ nameText(view.pending?.opponent) }}が、勝負どころまで指しているよ。数秒〜十数秒かかるよ。</p>
          <span class="pro-year__cut-spinner" aria-hidden="true"></span>
          <button type="button" class="shogi-tournament__sub" data-pro-cut-cancel @click="emit('cut-cancel')">やめる</button>
        </div>
      </div>

      <!-- 行動を選ぶシート(13-3の2。効き目を先に見せる。UD:5-1) -->
      <div v-if="slotSheet !== null && week" class="shogi-tournament__sheet" role="dialog" aria-modal="true" aria-label="行動を選ぶ" data-pro-action-sheet @click.self="slotSheet = null">
        <div class="shogi-tournament__sheet-panel shogi-tournament__detail pro-year__sheet">
          <h2>行動を選ぶ<small>（{{ slotSheet + 1 }}つめ）</small></h2>
          <ul class="pro-year__actions">
            <li v-for="item in week.actions" :key="item.id">
              <p v-if="item.work && item.id === firstWorkId" class="pro-year__action-head">今週の仕事の依頼（1つまで）</p>
              <button
                type="button"
                class="pro-year__action"
                :class="{ 'pro-year__action--now': week.chosen[slotSheet] === item.id }"
                :disabled="actionTaken(item.id)"
                :data-pro-action="item.id"
                @click="pickAction(item.id)"
              >
                <span class="pro-year__slot-icon" aria-hidden="true">{{ item.icon }}</span>
                <span class="pro-year__slot-text">
                  <b>{{ actionTitle(item) }}</b>
                  <small>{{ item.note }}</small>
                  <em>{{ actionTaken(item.id) ? "もう1つの枠で選んでいるよ" : item.effect }}</em>
                  <i v-if="item.grow" class="pro-year__gain">{{ item.grow }}</i>
                </span>
              </button>
            </li>
            <li v-if="week.lockedWork">
              <p v-if="!firstWorkId" class="pro-year__action-head">今週の仕事の依頼</p>
              <button type="button" class="pro-year__action pro-year__action--lock" disabled data-pro-action-locked>
                <span class="pro-year__slot-icon" aria-hidden="true">{{ week.lockedWork.icon }}</span>
                <span class="pro-year__slot-text"><b>{{ week.lockedWork.label }}</b><small>ファン{{ KAISETSU_FANS }}人か、本戦・リーグ入りで開く（あと{{ week.lockedWork.need }}人）</small></span>
              </button>
            </li>
          </ul>
          <p v-if="firstWorkId" class="pro-year__action-tip">仕事をすると、お金とファンが増えて、分身も育つよ！</p>
          <div class="shogi-tournament__actions shogi-tournament__actions--two">
            <button type="button" class="shogi-tournament__sub" data-pro-action="none" @click="pickAction(null)">何もしない</button>
            <button type="button" class="shogi-tournament__sub" @click="slotSheet = null">閉じる</button>
          </div>
        </div>
      </div>

      <!-- 今年の目標を選ぶ(13-3の7。おすすめの3つを先に選んでおく。UD:5-2) -->
      <div v-if="goalSheetOpen" class="shogi-tournament__sheet" role="dialog" aria-modal="true" aria-label="今年の目標" data-pro-goal-sheet>
        <div class="shogi-tournament__sheet-panel shogi-tournament__detail pro-year__sheet">
          <h2>{{ view.fy }}年度の目標を3つ選ぼう</h2>
          <p class="shogi-tournament__text">年度の終わりに、達成した目標に判子を押すよ。◎はやこび姫のおすすめ。</p>
          <ul class="pro-year__goal-choices">
            <li v-for="goal in goalChoiceList" :key="goal.id">
              <button
                type="button"
                class="pro-year__goal-choice"
                :aria-pressed="goalPick.includes(goal.id)"
                :disabled="!goalPick.includes(goal.id) && goalPick.length >= GOAL_PICK"
                :data-pro-goal-choice="goal.id"
                @click="toggleGoal(goal.id)"
              >
                <span class="pro-year__goal-check" aria-hidden="true">{{ goalPick.includes(goal.id) ? "✓" : "" }}</span>
                <span class="pro-year__slot-text"><b>{{ goal.label }}<i v-if="goal.recommended"> ◎</i></b><small>{{ goal.note }}</small></span>
                <span class="pro-year__goal-level" :aria-label="`難しさ${goal.level}`">{{ "★".repeat(goal.level) }}</span>
              </button>
            </li>
          </ul>
          <button type="button" class="shogi-tournament__start" :disabled="goalPick.length !== GOAL_PICK" data-pro-goal-start @click="startGoals">
            {{ goalPick.length === GOAL_PICK ? "この3つで始める" : `あと${GOAL_PICK - goalPick.length}つ選んでね` }}
          </button>
        </div>
      </div>

      <!-- 目標を達成したときの判子(G:3) -->
      <p v-if="goalToast" class="pro-year__goal-toast" role="status" data-pro-goal-toast>
        <span class="pro-year__goal-seal" aria-hidden="true">達</span>目標達成！ {{ goalToast }}
      </p>

      <!-- その日の対局 -->
      <div v-if="dayOpen" class="shogi-tournament__sheet" role="dialog" aria-modal="true" :aria-label="dayOpen.dateText" data-pro-day-sheet @click.self="dayDate = ''">
        <div class="shogi-tournament__sheet-panel shogi-tournament__detail pro-year__sheet">
          <h2>{{ dayOpen.dateText }}</h2>
          <p v-if="!dayOpen.games.length && !dayPlans.length && !dayOpen.study && !dayOpen.festival" class="shogi-tournament__text">この日は、見ておきたい対局がないよ。</p>
          <p v-if="dayOpen.festival" class="pro-year__day-study pro-year__day-festival" data-pro-day-festival>
            <b>{{ dayOpen.festival.name }}</b>{{ dayOpen.festival.place }}
            <small v-if="dayOpen.festival.fee !== null">謝礼 {{ moneyText(dayOpen.festival.fee) }}・ファン＋{{ dayOpen.festival.fans }}</small>
            <small v-else>次の公式戦の前なら、「寄り道」から行けるよ。</small>
          </p>
          <p v-if="dayOpen.study" class="pro-year__day-study" data-pro-day-study>
            <b>研究会</b>{{ dayOpen.study.members.join("・") }}
            <small v-if="dayOpen.study.result">練習対局 {{ dayOpen.study.result.opponent }}に{{ dayOpen.study.result.r === "win" ? "勝ち" : dayOpen.study.result.r === "loss" ? "負け" : "引き分け" }}</small>
            <small v-else>次の公式戦の前なら、「寄り道」から参加できるよ。</small>
          </p>
          <ul class="pro-year__day-games">
            <li v-for="game in dayOpen.games" :key="game.id" class="pro-year__day-game" :class="{ 'pro-year__day-game--you': game.user }" :style="{ '--event-color': game.color }">
              <small>{{ game.label }}{{ game.twoDay ? "（2日制）" : "" }}</small>
              <span>
                <b :class="{ 'pro-year__winner': game.winner?.id === game.a?.id }">{{ nameText(game.a) }}</b>
                <i>{{ game.winner ? (game.winner.id === game.a?.id ? "○-●" : "●-○") : "対" }}</i>
                <b :class="{ 'pro-year__winner': game.winner?.id === game.b?.id }">{{ nameText(game.b) }}</b>
                <button v-if="game.watch" type="button" class="pro-year__watch" :data-pro-watch="game.id" @click="watchGame(game.id)">▶ 観戦</button>
              </span>
            </li>
            <li v-for="(plan, index) in dayPlans" :key="`plan-${index}`" class="pro-year__day-game pro-year__day-game--plan" :style="{ '--event-color': plan.color }">
              <small>{{ plan.label }}</small><span>{{ plan.kind === "title" ? "この日ごろに指す予定だよ" : "勝ち残っていれば、この日ごろに指すよ" }}</span>
            </li>
          </ul>
          <button type="button" class="shogi-tournament__sub shogi-tournament__sheet-close" @click="dayDate = ''">閉じる</button>
        </div>
      </div>

      <!-- 将棋まつりの画面(10-2の6)。行ったら、まつりを終えるまで重ねる(指導対局を指しているあいだは閉じる)。 -->
      <ProFestival
        v-if="view.festival && !view.pending"
        ref="festivalEl"
        :festival="view.festival"
        :player-name="playerName"
        :asset-base-url="assetBaseUrl"
        @life="emit('life', $event)"
      />

      <!--
        棋戦の画面(10-2の1)。全画面で重ね、期の切り替え・段階のタブ・竜王戦と同じトーナメント表(RyuoBracket)・番勝負の星・リーグ表。
        決着した棋士どうしの対局は、札の▶と星の「観戦」で中継を開く(10-2の2)。
      -->
      <div v-if="eventOpen" class="pro-year__event-screen" role="dialog" aria-modal="true" :aria-label="eventOpen.name" data-pro-event-sheet :style="{ '--event-color': eventOpen.color }">
        <header class="pro-year__event-head">
          <button type="button" class="shogi-tournament__topbar-back" data-pro-event-close @click="eventId = ''">
            <span aria-hidden="true">←</span><span class="shogi-tournament__topbar-back-text">戻る</span>
          </button>
          <div class="pro-year__event-heading">
            <h2>{{ eventOpen.name }}</h2>
            <small>{{ eventOpen.holder ? `${eventOpen.holder.you ? playerName : eventOpen.holder.name}${proEvent(eventOpen.id)?.short ?? ""}` : "一般棋戦" }}{{ shownCycle?.champion ? `・${shownCycle.champion.you ? playerName : shownCycle.champion.name}が${eventKind === "title" ? "獲得" : "優勝"}` : "" }}</small>
          </div>
        </header>
        <div v-if="eventOpen.cycles.length > 1" class="pro-year__tabs pro-year__tabs--small" role="tablist" aria-label="期">
          <button
            v-for="(cycle, index) in eventOpen.cycles"
            :key="cycle.id"
            type="button"
            role="tab"
            :aria-selected="cycleIndex === index"
            :data-pro-cycle="cycle.id"
            @click="selectCycle(index)"
          >{{ cycle.label.replace("に始まった期", "の期") }}{{ cycle.withUser ? "" : "（観戦）" }}</button>
        </div>
        <div v-if="shownCycle" class="pro-year__tabs pro-year__tabs--small pro-year__stage-tabs" role="tablist" aria-label="段階">
          <button
            v-for="(stage, index) in shownCycle.stages"
            :key="index"
            type="button"
            role="tab"
            :aria-selected="stageIndex === index"
            :class="{ 'pro-year__stage-tab--now': stage.started && !stage.done, 'pro-year__stage-tab--you': stage.you }"
            :data-pro-stage="index"
            @click="selectStage(index)"
          >{{ stage.label }}<small>{{ stage.done ? "済" : stage.started ? "いま" : "" }}</small></button>
        </div>
        <section v-if="shownStage" class="pro-year__event-body" :aria-label="shownStage.label">
          <p class="pro-year__stage-info">
            <span>{{ shownStage.period }}</span>
            <b v-if="shownStage.you" :class="{ 'pro-year__stage-you--out': shownStage.out }">{{ shownStage.out ? "あなたは敗退" : shownStage.done ? "あなたが出た段階" : "あなたが出ている" }}</b>
          </p>
          <p v-if="!shownStage.started" class="pro-year__stage-empty">まだ始まっていないよ。{{ shownStage.period }}に始まるよ。</p>
          <!-- トーナメント表(竜王戦と同じ)。記録を作るブロックが2つ以上あれば、ブロックのタブ -->
          <template v-else-if="shownStage.brackets?.length">
            <div v-if="shownStage.brackets.length > 1" class="pro-year__tabs pro-year__tabs--small" role="tablist" aria-label="ブロック">
              <button
                v-for="(bracket, index) in shownStage.brackets"
                :key="bracket.name"
                type="button"
                role="tab"
                :aria-selected="bracketIndex === index"
                :data-pro-bracket="bracket.name"
                @click="bracketIndex = Number(index)"
              >{{ bracket.name || "トーナメント" }}{{ bracket.you ? "（あなた）" : bracket.rival ? "（羽音）" : "" }}</button>
            </div>
            <div class="pro-year__bracket" data-pro-bracket-view>
              <RyuoBracket
                :key="`${shownCycle?.id}-${stageIndex}-${bracketIndex}`"
                :view="shownBracket.view"
                :rival-id="rivalId"
                :watchable="true"
                @watch="watchNode"
              />
            </div>
            <p v-if="shownStage.others?.length" class="pro-year__others">
              ほかのブロック：<span v-for="other in shownStage.others" :key="other.name">{{ other.name }} {{ other.winner ? nameText(other.winner) : "…" }}</span>
            </p>
          </template>
          <!-- 番勝負の星 -->
          <div v-else-if="shownStage.series" class="pro-year__series-box" data-pro-series>
            <p class="pro-year__series">
              <span :class="{ 'pro-year__winner': shownStage.series.wins[0] >= shownStage.series.need }">{{ nameText(shownStage.series.a) }}</span>
              <b>{{ shownStage.series.wins[0] }} - {{ shownStage.series.wins[1] }}</b>
              <span :class="{ 'pro-year__winner': shownStage.series.wins[1] >= shownStage.series.need }">{{ nameText(shownStage.series.b) }}</span>
            </p>
            <ol class="pro-year__hoshi">
              <li v-for="no in shownStage.series.maxGames" :key="no" :class="{ 'pro-year__hoshi--empty': !seriesGame(no) }">
                <small>第{{ no }}局</small>
                <template v-if="seriesGame(no)">
                  <span class="pro-year__hoshi-date">{{ seriesGame(no)!.date }}</span>
                  <b>{{ seriesGame(no)!.winner ? (seriesGame(no)!.winner === "a" ? "○" : "●") : "…" }}</b>
                  <span class="pro-year__hoshi-color">{{ seriesGame(no)!.aColor === "black" ? "先" : "後" }}</span>
                  <button v-if="seriesGame(no)!.watch" type="button" class="pro-year__watch" :data-pro-watch="seriesGame(no)!.id" @click="watchGame(seriesGame(no)!.id)">▶ 観戦</button>
                </template>
                <span v-else class="pro-year__hoshi-date">―</span>
              </li>
            </ol>
            <p class="pro-year__note">○●は{{ nameText(shownStage.series.a) }}から見た星。{{ shownStage.series.need }}勝で決まり。</p>
          </div>
          <!-- リーグ -->
          <div v-else-if="shownStage.groups" class="pro-year__tables">
            <table v-for="group in shownStage.groups" :key="group.name" class="team-battle__table">
              <caption v-if="group.name">{{ group.name }}</caption>
              <tbody>
                <tr v-for="row in group.rows" :key="row.id" :class="{ 'team-battle__row--you': row.you }">
                  <td>{{ row.rank }}</td><td>{{ nameText(row) }}</td><td>{{ row.wins }}勝{{ row.losses }}敗</td>
                </tr>
              </tbody>
            </table>
          </div>
          <!-- 順位戦 -->
          <table v-else-if="shownStage.rows" class="team-battle__table">
            <caption>{{ shownStage.cls }}・上位{{ shownStage.promote }}人が昇級</caption>
            <tbody>
              <tr v-for="row in shownStage.rows" :key="row.id" :class="{ 'team-battle__row--you': row.you }">
                <td>{{ row.rank }}</td><td>{{ nameText(row) }}</td><td>{{ row.wins }}勝{{ row.losses }}敗</td>
              </tr>
            </tbody>
          </table>
          <!-- 前の版の保存(表の最初の並びがない): 対局の並び -->
          <div v-else-if="shownStage.block" class="pro-year__block">
            <small v-if="shownStage.blockCount > 1">{{ shownStage.block.name }}（{{ shownStage.blockCount }}ブロックの1つ）</small>
            <ul>
              <li v-for="(game, gameIndex) in shownStage.block.games" :key="gameIndex" :class="{ 'team-battle__row--you': game.a?.you || game.b?.you }">
                <span :class="{ 'pro-year__winner': game.winner === 'a' }">{{ nameText(game.a) }}</span>
                <i>{{ game.winner ? (game.winner === "a" ? "○-●" : "●-○") : "対" }}</i>
                <span :class="{ 'pro-year__winner': game.winner === 'b' }">{{ nameText(game.b) }}</span>
              </li>
            </ul>
          </div>
          <p v-if="shownStage.done && shownStage.winners?.length && !shownStage.series" class="pro-year__winners">勝ち上がり：{{ shownStage.winners.slice(0, 8).map(nameText).join("・") }}{{ shownStage.winners.length > 8 ? " ほか" : "" }}</p>
        </section>
      </div>

      <!-- 分身に任せる確認(UD:5-2。取り消せない。はじめに「自分で指す」を選んでおく) -->
      <div v-if="autoOpen" class="shogi-tournament__sheet" role="dialog" aria-modal="true" aria-label="分身に任せる" data-pro-auto-sheet @click.self="autoOpen = false">
        <div class="shogi-tournament__sheet-panel shogi-tournament__detail">
          <h2>この対局を分身に任せる？</h2>
          <p class="shogi-tournament__text">{{ PRO_YEAR_TEXT.autoNote }}</p>
          <div class="shogi-tournament__actions shogi-tournament__actions--two">
            <button ref="autoCancel" type="button" class="shogi-tournament__sub" data-pro-auto-cancel @click="autoOpen = false">自分で指す</button>
            <button type="button" class="shogi-tournament__start" data-pro-auto-confirm @click="confirmAuto">分身に任せる</button>
          </div>
        </div>
      </div>
    </div>
    <!-- 物語の場面(デビューの日・羽音との公式戦・タイトル戦の前夜。docs/pro-year-design.mdの12章) -->
    <NovelScene
      v-if="storyScene"
      ref="sceneEl"
      :scene="storyScene"
      :asset-base-url="assetBaseUrl"
      data-pro-scene
      @done="closeScene"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type PropType } from "vue";
import PregamePicker, { type PickerSection, type PickerValue } from "./PregamePicker.vue";
import RyuoBracket from "./RyuoBracket.vue";
import RadarChart from "./RadarChart.vue";
import { KAISETSU_FANS } from "./core/pro-work.mjs";
import { INTERVIEW_FANS } from "./core/pro-news.mjs";
import ProFestival from "./ProFestival.vue";
import NovelScene from "./NovelScene.vue";
import { proYearScene, proYearSceneDue } from "./core/pro-year-story.mjs";
import { MEASURE_PICKER_ACTION } from "./core/skill-estimate.mjs";
import { difficultyName, difficultyOptions } from "./core/tournament-world.mjs";
import { LEARNING_ASSIST_LIMITS } from "./core/learning-setup.mjs";
import { BYOYOMI_CHOICES, byoyomiLabel } from "./core/byoyomi.mjs";
import { GROUP_MEAN_RATING, WORLD_BASE_RATING } from "./core/ryuo-strength.mjs";
import { STUDY_TEXT, moneyText } from "./core/pro-life.mjs";
import {
  CLASS_NAMES, PRO_EVENTS, PRO_YEAR_TEXT, dayView, eventView, goalChoices, goalProgress, monthView, nextBigGame, previewNextGame, proEvent, proYearRelayGame, proYearTalk, proYearView, weekView,
  yearEnd, yearStart,
} from "./core/pro-year.mjs";
import { CONDITION_LABELS, GOAL_PICK, WEIGHTS } from "./core/pro-week.mjs";

type Settings = { difficulty: number; coachLevel: string; hintLimit: number; undoLimit: number; byoyomi: number };
type Card = { id: string; name: string; dan?: string; you?: boolean } | null | undefined;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cell = { date: string; day: number; inMonth: boolean; today: boolean; past: boolean; items: any[] };

const props = defineProps({
  /** 棋士の1年の状態(core/pro-year.mjs)。なければ入口。 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  state: { type: Object as PropType<any>, default: null },
  /** 前に選んだ設定(入口の初期値)。 */
  lastSettings: { type: Object as PropType<Partial<Settings> | null>, default: null },
  defaultDifficulty: { type: Number, default: 9 },
  world: { type: Object as PropType<{ level: number; difficulty: number; playerLevel: number; at: number } | null>, default: null },
  recommendedDifficulty: { type: Number as PropType<number | null>, default: null },
  userLevel: { type: Number, default: NaN },
  assetBaseUrl: { type: String, default: "." },
  playerName: { type: String, default: "あなた" },
  /** 百花の呼び方(player-name.mjsのmomokaCallName。空なら名前に「さん」)。 */
  momokaCall: { type: String, default: "" },
  suspendedMoves: { type: Number as PropType<number | null>, default: null },
  /** 「勝負どころから指す」の局面を作っているあいだ。 */
  cutBusy: { type: Boolean, default: false },
  backLabel: { type: String, default: "戻る" },
});
const emit = defineEmits<{
  measure: [];
  enter: [payload: { settings: Settings }];
  advance: [];
  play: [];
  /** 勝負どころから指す(13-3の6)。 */
  cut: [];
  "cut-cancel": [];
  resume: [];
  auto: [];
  "next-year": [];
  /** 暮らしの操作(研究の道具を買う・研究会・将棋まつり。10章)。 */
  life: [action: { kind: string; [key: string]: unknown }];
  /** 中継で観戦する対局(relay-games.mjsの項目と同じ形)。大会の画面が中継を開く。 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  watch: [entry: any];
  back: [];
}>();

const hananeSprite = computed(() => `${props.assetBaseUrl}/characters/hanane-mini.webp?v=1`);
const yakobiSprite = computed(() => `${props.assetBaseUrl}/characters/yakobihime-mini.webp?v=4`);
const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

// ---- 入口の設定(団体戦・研修会と同じ並び)
const settingsOpen = ref(false);
const picker = ref("");
const last = props.lastSettings ?? {};
const difficulty = ref(props.defaultDifficulty);
watch(() => props.defaultDifficulty, (next, previous) => {
  if (difficulty.value === previous) difficulty.value = next;
});
const coachLevel = ref(String(last.coachLevel ?? "detailed"));
const hintLimit = ref(Number(last.hintLimit ?? 3));
const undoLimit = ref(Number(last.undoLimit ?? 3));
const byoyomi = ref(Number(last.byoyomi ?? 0));
const COACH_OPTIONS = [
  { value: "off", label: "なし" },
  { value: "encourage", label: "応援のみ" },
  { value: "detailed", label: "詳しい助言" },
];
const assistText = (value: number) => LEARNING_ASSIST_LIMITS.find((item) => item.value === value)?.label ?? String(value);
const difficultyChoices = computed(() => difficultyOptions({
  stored: props.world, playerLevel: props.userLevel, base: WORLD_BASE_RATING,
  bottom: { label: "6組", rating: GROUP_MEAN_RATING[6] }, top: { label: "1組", rating: GROUP_MEAN_RATING[1] },
  recommended: props.recommendedDifficulty ?? props.defaultDifficulty,
}));
const settingsSummary = computed(() => [`難易度 ${difficultyName(difficulty.value)}`, `秒読み ${byoyomiLabel(byoyomi.value)}`].join("・"));
const settingRows = computed(() => [
  { id: "difficulty", label: "難易度", value: difficultyName(difficulty.value), note: difficultyChoices.value.find((option) => option.value === difficulty.value)?.description ?? "" },
  { id: "coach", label: "やこび姫の助言", value: COACH_OPTIONS.find((item) => item.value === coachLevel.value)?.label ?? "", note: "" },
  { id: "assist", label: "閃き・待った", value: `閃き${assistText(hintLimit.value)}・待った${assistText(undoLimit.value)}`, note: "" },
  { id: "byoyomi", label: "秒読みの演出", value: byoyomiLabel(byoyomi.value), note: "" },
]);
const pickerConfig = computed<{ title: string; sections: PickerSection[]; note: string } | null>(() => {
  const single = (title: string, key: string, value: PickerValue, options: { value: PickerValue; label: string; description?: string }[], note = "") => (
    { title, note, sections: [{ key, value, groups: [{ options }] }] }
  );
  switch (picker.value) {
    case "difficulty":
      return single("難易度", "difficulty", difficulty.value, difficultyChoices.value, "数字が大きいほど、相手が強くなるよ。世界は竜王戦・名人戦と同じ。");
    case "coach":
      return single("やこび姫の助言", "coach", coachLevel.value, COACH_OPTIONS);
    case "assist":
      return {
        title: "閃き・待った",
        note: "",
        sections: [
          { key: "hint", label: "閃き", value: hintLimit.value, groups: [{ options: LEARNING_ASSIST_LIMITS.map((item) => ({ value: item.value, label: item.label })) }] },
          { key: "undo", label: "待った", value: undoLimit.value, groups: [{ options: LEARNING_ASSIST_LIMITS.map((item) => ({ value: item.value, label: item.label })) }] },
        ],
      };
    case "byoyomi":
      return single("秒読みの演出", "byoyomi", byoyomi.value, BYOYOMI_CHOICES.map((item) => ({ value: item.value, label: item.label })), "0秒になっても負けにはならないよ。");
    default:
      return null;
  }
});
function onPick(key: string, value: PickerValue) {
  if (key === "difficulty") difficulty.value = Number(value);
  else if (key === "coach") coachLevel.value = String(value);
  else if (key === "hint") hintLimit.value = Number(value);
  else if (key === "undo") undoLimit.value = Number(value);
  else if (key === "byoyomi") byoyomi.value = Number(value);
  if ((pickerConfig.value?.sections.length ?? 0) <= 1) picker.value = "";
}
function enter() {
  settingsOpen.value = false;
  emit("enter", { settings: { difficulty: difficulty.value, coachLevel: coachLevel.value, hintLimit: hintLimit.value, undoLimit: undoLimit.value, byoyomi: byoyomi.value } });
}

// ---- 1年
const view = computed(() => (props.state ? proYearView(props.state) : null));
const nextPreview = computed(() => (props.state ? previewNextGame(props.state) : null));
const yearSub = computed(() => {
  const current = view.value;
  if (!current) return "";
  return `${current.dateText}・${current.record.wins}勝${current.record.losses}敗・${current.cls}`;
});
const pendingColor = computed(() => {
  const pending = props.state?.pending;
  return pending ? proEvent(props.state.games[pending.gameId]?.event)?.color ?? "#f1a54c" : "#f1a54c";
});
// ---- 今週(docs/pro-year-design.mdの13章)
const week = computed(() => (props.state ? weekView(props.state) : null));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WeekAction = { id: string; label: string; icon: string; note: string; effect: string; target?: Card; name?: string; dateText?: string };
const slotAction = (index: number): WeekAction | null => {
  const id = week.value?.chosen?.[index];
  return id ? (week.value?.actions.find((item: WeekAction) => item.id === id) ?? null) : null;
};
/** 行動の名前(研究は相手の名前、研究会・まつりは日付つき)。 */
const actionTitle = (item: WeekAction | null) => {
  if (!item) return "";
  if (item.id === "research") return `研究：${nameText(item.target)}`;
  if (item.id === "festival") return `${item.name ?? item.label}（${item.dateText ?? ""}）`;
  if (item.id === "study") return `研究会（${item.dateText ?? ""}）`;
  if (item.id.startsWith("work-")) return `${item.label}（${item.dateText ?? ""}）`;
  return item.label;
};
const slotSheet = ref<number | null>(null);
/** 行動のシートで、仕事の依頼の見出しを出す最初の行。 */
const firstWorkId = computed(() => week.value?.actions.find((item: { work?: string }) => item.work)?.id ?? "");

// ---- ニュース・取材・分身・仕事(14章)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const newsOpen = ref<any>(null);
const interviewOpen = ref(false);
const avatarOpen = ref(false);
function answerInterview(id: string | null) {
  interviewOpen.value = false;
  emit("life", { kind: "interview", answer: id });
}
/** 分身のレーダーチャート(Lv×10)と、今週のはじめの点線。 */
const avatarAxes = computed(() => (week.value?.avatar.rows ?? []).map((row: { key: string; label: string; level: number }) => ({ key: row.key, label: row.label, value: row.level * 10 })));
const avatarBefore = computed(() => (week.value?.avatar.rows ?? []).map((row: { before: number }) => row.before * 10));
/** 仕事を遊ぶ。解説は中継の画面の次の一手で(大会の画面が開く)、指導と詰将棋は対局画面が受け持つ。 */
function playWork() {
  const work = view.value?.work;
  if (!work || !props.state) return;
  if (work.id === "kaisetsu") {
    const entry = work.game ? proYearRelayGame(props.state, work.game) : null;
    if (entry) emit("watch", { ...entry, job: { title: "大盤解説の仕事", quizzes: 5 } });
    else emit("life", { kind: "work-quick" });
    return;
  }
  emit("life", { kind: "work-play" });
}
/** 研究会とまつりは週に1回(もう1つの枠で選んでいたら選べない)。 */
const actionTaken = (id: string) => (id === "study" || id === "festival")
  && (week.value?.chosen ?? []).some((item: string | null, index: number) => item === id && index !== slotSheet.value);
function pickAction(id: string | null) {
  if (slotSheet.value === null) return;
  emit("life", { kind: "week-action", slot: slotSheet.value, action: id });
  slotSheet.value = null;
}
/** 公式戦の既定の指し方(小の対局は勝負どころから、中と大は最初から)。 */
const defaultWay = computed(() => WEIGHTS[(view.value?.pending?.weight ?? "mid") as keyof typeof WEIGHTS]?.way ?? "full");
const wayClass = (way: "full" | "cut") => (defaultWay.value === way ? "shogi-tournament__start" : "shogi-tournament__sub");
/** 分身が勝つ見込み(世界の物差しの勝率。分身に任せるの材料)。 */
const autoChance = computed(() => {
  const value = Number(view.value?.pending?.autoChance);
  return Number.isFinite(value) ? Math.round(value * 100) : null;
});
function playCut() {
  // 節目の場面(羽音との初手合・タイトル戦の前夜)は、指し方によらず対局の前に見せる。
  const due = props.state ? proYearSceneDue(props.state) : null;
  if (due && due.key !== "pro-debut") openScene(due, () => emit("cut"));
  else emit("cut");
}
const STAMP_TEXT = { done: "達成", near: "あと一歩", miss: "届かず" } as const;

// ---- 今年の目標と次の大一番(13-3の7・8)
const goals = computed(() => (props.state ? goalProgress(props.state) : []));
const bigGame = computed(() => (props.state ? nextBigGame(props.state) : null));
const goalChoiceList = computed(() => (props.state ? goalChoices(props.state) : []));
const goalSheetOpen = computed(() => Boolean(props.state && !props.state.yearDone && !props.state.pending && !props.state.festival && !props.state.work && props.state.goals?.fy !== props.state.fy));
const goalPick = ref<string[]>([]);
watch(goalSheetOpen, (open) => {
  if (open) goalPick.value = goalChoiceList.value.filter((goal: { recommended: boolean }) => goal.recommended).map((goal: { id: string }) => goal.id).slice(0, GOAL_PICK);
}, { immediate: true });
function toggleGoal(id: string) {
  goalPick.value = goalPick.value.includes(id) ? goalPick.value.filter((item) => item !== id) : [...goalPick.value, id].slice(0, GOAL_PICK);
}
function startGoals() {
  if (goalPick.value.length === GOAL_PICK) emit("life", { kind: "set-goals", ids: [...goalPick.value] });
}
// 目標を新しく達成したら、判子を少しのあいだ出す(読み込んだときは出さない)。
const goalToast = ref("");
let goalToastTimer: ReturnType<typeof setTimeout> | null = null;
watch(() => goals.value.filter((goal: { done: boolean }) => goal.done).map((goal: { id: string }) => goal.id), (now, before) => {
  if (!before || props.state?.yearDone) return;
  const fresh = goals.value.filter((goal: { id: string; done: boolean }) => goal.done && !before.includes(goal.id));
  if (!fresh.length || !now.length) return;
  goalToast.value = fresh.map((goal: { label: string }) => `「${goal.label}」`).join("");
  if (goalToastTimer) clearTimeout(goalToastTimer);
  goalToastTimer = setTimeout(() => {
    goalToast.value = "";
  }, 3200);
});
onBeforeUnmount(() => {
  if (goalToastTimer) clearTimeout(goalToastTimer);
});
const festivalEl = ref<{ goBack: () => boolean } | null>(null);
/** 羽音が話す行(公式戦の前の一言・研究会の誘いと練習対局のあとの一言)。 */
const hananeTalks = computed(() => Boolean(view.value?.pending?.hananeLine || (!view.value?.pending && view.value?.study?.talk)));
const talkSprite = computed(() => (hananeTalks.value ? hananeSprite.value : yakobiSprite.value));
const runLine = computed(() => {
  const current = view.value;
  if (!current) return "";
  const pending = current.pending;
  if (pending?.hananeLine) return pending.hananeLine;
  if (pending?.kind === "study") return `研究会の日だよ。今日は${nameText(pending.opponent)}と練習対局。公式戦には数えないから、試したい作戦を指してみよう！`;
  if (pending?.kind === "shidou") return pending.coachLine ?? "";
  if (pending) return pending.kind === "finals" ? PRO_YEAR_TEXT.titleGame : pending.stakes?.boss ? PRO_YEAR_TEXT.bigGame : PRO_YEAR_TEXT.game;
  if (current.study?.talk) return current.study.talk;
  return proYearTalk(current, nextPreview.value);
});
const rateText = (rate: number) => rate.toFixed(3).replace(/^0/, "");
const shortDate = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8))}`;
const nameText = (card: Card) => (card ? (card.you ? props.playerName : card.name) : "（不戦）");
const statusClass = (status: { alive?: boolean; won?: boolean; waiting?: boolean } | null) => {
  if (!status) return "pro-year__event-status--none";
  if (status.won) return "pro-year__event-status--won";
  if (status.waiting) return "pro-year__event-status--waiting";
  return status.alive ? "pro-year__event-status--alive" : "pro-year__event-status--out";
};

// タブ(狭い画面はカレンダー・棋戦・成績。広い画面は、カレンダーを左にいつも出し、右で棋戦と成績を切り替える。U:7-5)
const tabs = [
  { id: "week", label: "今週" },
  { id: "calendar", label: "カレンダー" },
  { id: "events", label: "棋戦" },
  { id: "record", label: "成績" },
] as const;
const sideTabs = tabs.filter((item) => item.id !== "week");
const tab = ref<"week" | "calendar" | "events" | "record">("week");
const sideTab = computed(() => (tab.value === "week" ? "calendar" : tab.value));
const wide = ref(false);
let wideQuery: MediaQueryList | null = null;
const syncWide = () => {
  wide.value = Boolean(wideQuery?.matches);
};
onMounted(() => {
  if (typeof window === "undefined" || !window.matchMedia) return;
  wideQuery = window.matchMedia("(min-width: 980px) and (min-aspect-ratio: 1/1)");
  syncWide();
  wideQuery.addEventListener?.("change", syncWide);
});
onBeforeUnmount(() => wideQuery?.removeEventListener?.("change", syncWide));

// 月(いまの日付の月から。進めたら、その月へついていく)
const monthKey = ref("");
watch(() => props.state?.date, (date) => {
  if (date) monthKey.value = date.slice(0, 7);
}, { immediate: true });
const month = computed(() => {
  const [year, value] = (monthKey.value || "2026-04").split("-").map(Number);
  return props.state ? monthView(props.state, year, value) : { year, month: value, title: "", weeks: [] as Cell[][] };
});
const canPrev = computed(() => Boolean(props.state) && `${monthKey.value}-01` > yearStart(props.state.fy - 1));
const canNext = computed(() => Boolean(props.state) && `${monthKey.value}-01` < yearEnd(props.state.fy + 1).slice(0, 8) + "01");
function stepMonth(delta: number) {
  const [year, value] = monthKey.value.split("-").map(Number);
  const total = year * 12 + (value - 1) + delta;
  monthKey.value = `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}
/** マスの印(自分の対局を先に。羽音とタイトル戦は1日に1つ。多くて3つ。くわしくはその日のシートで)。 */
const cellMarks = (cell: Cell) => {
  const order: { [kind: string]: number } = { user: 0, festival: 1, title: 2, study: 3, rival: 4, plan: 5 };
  const seen = new Set<string>();
  return [...cell.items].sort((a, b) => order[a.kind] - order[b.kind]).filter((item) => {
    const key = item.kind === "user" || item.kind === "plan" ? `${item.kind}-${item.event}` : item.kind;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 3);
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const markText = (item: any) => {
  // タイトル戦は、どのタイトルか分かるように★のあとに名前(「★名人」)。
  if (item.kind === "title") return `★${proEvent(item.event)?.short ?? ""}`;
  if (item.kind === "rival") return "羽音";
  if (item.kind === "study") return item.result ? `${item.result === "win" ? "○" : item.result === "loss" ? "●" : "△"}研` : "研";
  if (item.kind === "festival") return "祭";
  const short = item.short ?? proEvent(item.event)?.short ?? "";
  if (item.kind === "user" && item.result) return `${item.result === "win" ? "○" : "●"}${short}`;
  return short;
};
const dayAria = (cell: Cell) => {
  if (!cell.inMonth) return "";
  const parts = cell.items.map((item) => (item.kind === "user" ? `自分の対局 ${item.label}` : item.kind === "title" ? `タイトル戦 ${item.label}` : item.kind === "rival" ? `羽音の対局`
    : item.kind === "study" ? "研究会" : item.kind === "festival" ? item.label : `勝ち残れば ${item.label}`));
  return `${Number(cell.date.slice(5, 7))}月${cell.day}日${cell.today ? "（今日）" : ""}${parts.length ? `。${parts.join("、")}` : ""}`;
};

// その日
const dayDate = ref("");
const dayOpen = computed(() => (props.state && dayDate.value ? dayView(props.state, dayDate.value) : null));
const dayPlans = computed(() => month.value.weeks.flat().find((cell) => cell.date === dayDate.value)?.items.filter((item) => item.kind === "plan" || item.plan) ?? []);
function openDay(date: string) {
  dayDate.value = date;
}

// 棋戦の表
const eventId = ref("");
const eventOpen = computed(() => (props.state && eventId.value ? eventView(props.state, eventId.value) : null));
const eventKind = computed(() => proEvent(eventId.value)?.kind ?? "");
const cycleIndex = ref(0);
const stageIndex = ref(0);
const bracketIndex = ref(0);
const shownCycle = computed(() => eventOpen.value?.cycles[cycleIndex.value] ?? null);
const shownStage = computed(() => shownCycle.value?.stages[stageIndex.value] ?? null);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const shownBracket = computed<any>(() => shownStage.value?.brackets?.[bracketIndex.value] ?? shownStage.value?.brackets?.[0] ?? null);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rivalId = computed(() => (Object.values(props.state?.players ?? {}) as any[]).find((member) => member?.story === "hanane")?.id ?? "");
/** 期のはじめに見せる段階(自分がいま出ている段階 → いま進んでいる段階 → 最後に始まった段階)。 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function defaultStage(cycle: any) {
  const stages = cycle?.stages ?? [];
  const pick = [
    stages.findIndex((stage: any) => stage.started && !stage.done && stage.you),
    stages.findIndex((stage: any) => stage.started && !stage.done),
    stages.map((stage: any) => stage.started).lastIndexOf(true),
  ].find((index) => index >= 0);
  return pick ?? 0;
}
function selectCycle(index: number) {
  cycleIndex.value = index;
  stageIndex.value = defaultStage(eventOpen.value?.cycles[index]);
  bracketIndex.value = 0;
}
function selectStage(index: number) {
  stageIndex.value = index;
  bracketIndex.value = 0;
}
function openEvent(id: string) {
  eventId.value = id;
  const cycles = eventOpen.value?.cycles ?? [];
  // 自分がいま出ている期 → 進んでいる期 → 新しい期。
  const mine = cycles.findIndex((cycle: any) => cycle.stages.some((stage: any) => stage.started && !stage.done && stage.you));
  const running = cycles.findIndex((cycle: any) => cycle.stages.some((stage: any) => stage.started && !stage.done));
  selectCycle(mine >= 0 ? mine : running >= 0 ? running : Math.max(0, cycles.length - 1));
}
const seriesGame = (no: number) => shownStage.value?.series?.games.find((game: { no: number }) => game.no === no) ?? null;
/** 対局を観戦する(中継の項目にして、大会の画面へ渡す)。 */
function watchGame(gameId: string) {
  const entry = props.state ? proYearRelayGame(props.state, gameId) : null;
  if (entry) emit("watch", entry);
}
/** トーナメント表の札の▶。 */
function watchNode(nodeId: string) {
  const gameId = shownBracket.value?.watch?.[nodeId];
  if (gameId) watchGame(gameId);
}

// 分身に任せる
const autoOpen = ref(false);
const autoCancel = ref<HTMLButtonElement | null>(null);
function openAuto() {
  autoOpen.value = true;
  void nextTick(() => autoCancel.value?.focus());
}
function confirmAuto() {
  autoOpen.value = false;
  emit("auto");
}

/** 戻る操作。重ねて開いたものを閉じたら真。 */
// ---- 物語の場面(12章)。デビューの日はすぐ、羽音との公式戦とタイトル戦の前夜は「対局する」を押したときに1回だけ。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const storyScene = ref<any>(null);
let sceneKey = "";
let afterScene: (() => void) | null = null;
const sceneEl = ref<{ goBack: () => boolean } | null>(null);
function openScene(due: { key: string; id: string; vars: Record<string, string> }, then: (() => void) | null) {
  sceneKey = due.key;
  afterScene = then;
  storyScene.value = proYearScene(due.id, { playerName: props.playerName, momokaCall: props.momokaCall, vars: due.vars });
}
/** 場面を読み終えた(飛ばしても同じ)。見た印をつけ、物語のサブに開く。 */
function closeScene() {
  storyScene.value = null;
  emit("life", { kind: "scene", key: sceneKey });
  const then = afterScene;
  afterScene = null;
  then?.();
}
function playWithScene() {
  const due = props.state ? proYearSceneDue(props.state) : null;
  if (due && due.key !== "pro-debut") openScene(due, () => emit("play"));
  else emit("play");
}
watch(() => props.state, (state) => {
  if (storyScene.value || !state) return;
  const due = proYearSceneDue(state);
  if (due?.key === "pro-debut") openScene(due, null);
}, { immediate: true });

function goBack() {
  if (storyScene.value) {
    if (!sceneEl.value?.goBack()) closeScene();
    return true;
  }
  if (festivalEl.value?.goBack()) return true;
  if (picker.value) picker.value = "";
  else if (settingsOpen.value) settingsOpen.value = false;
  else if (autoOpen.value) autoOpen.value = false;
  else if (newsOpen.value) newsOpen.value = null;
  else if (interviewOpen.value) interviewOpen.value = false;
  else if (avatarOpen.value) avatarOpen.value = false;
  else if (slotSheet.value !== null) slotSheet.value = null;
  else if (eventId.value) eventId.value = "";
  else if (dayDate.value) dayDate.value = "";
  else return false;
  return true;
}
defineExpose({ goBack });
</script>

<style>
/* 棋士の1年: 研修会・団体戦の画面の部品(ShogiShoreikai.vue・ShogiTeamBattle.vue・ShogiTournament.vue)を使い、カレンダーと棋戦の表を足す。 */
.shogi-game .pro-year__mapwrap { display: grid; place-items: center; padding: 0.6rem; overflow-y: auto; }
.shogi-game .pro-year__intro { display: grid; gap: 0.6rem; width: min(100%, 40rem); }
.shogi-game .pro-year__lead { margin: 0; color: #fffcf4; font-weight: 800; text-align: center; }
.shogi-game .pro-year__chips { display: grid; grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr)); gap: 0.35rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .pro-year__chip {
  display: flex; align-items: center; gap: 0.35rem; padding: 0.35rem 0.5rem; border-radius: 0.6rem;
  color: #fffcf4; background: rgba(43, 70, 91, 0.9); font-size: 0.85rem; font-weight: 800;
}
.shogi-game .pro-year__chip small { margin-left: auto; color: #cfd8de; font-size: 0.66rem; font-weight: 700; }
.shogi-game .pro-year__chip-dot { width: 0.7rem; height: 0.7rem; flex: none; border-radius: 50%; background: var(--event-color); }
.shogi-game .pro-year__sprite { image-rendering: pixelated; object-fit: cover; object-position: 50% 0; }
.shogi-game .pro-year__main { display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 0.5rem; min-height: 0; padding: 0.5rem 0.6rem; overflow: hidden; }
.shogi-game .pro-year__main--wide { grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr); grid-template-rows: minmax(0, 1fr); }
.shogi-game .pro-year__main--goals { grid-template-rows: auto auto minmax(0, 1fr); }
.shogi-game .pro-year__main--wide.pro-year__main--goals { grid-template-rows: auto minmax(0, 1fr); }
.shogi-game .pro-year__main--wide .pro-year__goalbar { grid-column: 1 / -1; }
/* 今年の目標と次の大一番の帯(13-3の7・8) */
.shogi-game .pro-year__goalbar { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: stretch; }
.shogi-game .pro-year__goal-list { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.3rem; flex: 3 1 24rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .pro-year__goal { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 0 0.3rem; padding: 0.2rem 0.4rem; border: 0.08rem solid rgba(255, 255, 255, 0.18); border-radius: 0.5rem; background: rgba(23, 38, 50, 0.85); }
.shogi-game .pro-year__goal--done { border-color: #86d4a9; background: rgba(39, 174, 96, 0.18); }
.shogi-game .pro-year__goal-mark { color: var(--amber, #f1a54c); font-weight: 900; }
.shogi-game .pro-year__goal--done .pro-year__goal-mark { color: #86d4a9; }
.shogi-game .pro-year__goal-text { display: grid; min-width: 0; line-height: 1.2; }
.shogi-game .pro-year__goal-text b { overflow: hidden; font-size: 0.74rem; text-overflow: ellipsis; white-space: nowrap; }
.shogi-game .pro-year__goal-text small { color: #cfd8de; font-size: 0.66rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.shogi-game .pro-year__goal-bar { grid-column: 1 / -1; height: 0.2rem; margin-top: 0.15rem; border-radius: 999px; background: rgba(255, 255, 255, 0.14); overflow: hidden; }
.shogi-game .pro-year__goal-bar i { display: block; height: 100%; background: var(--amber, #f1a54c); }
.shogi-game .pro-year__goal--done .pro-year__goal-bar i { background: #86d4a9; }
.shogi-game .pro-year__bigone { display: flex; flex-wrap: wrap; align-items: center; gap: 0.1rem 0.45rem; flex: 1 1 14rem; margin: 0; padding: 0.25rem 0.5rem; border: 0.1rem solid #e9c46a; border-radius: 0.5rem; background: rgba(233, 196, 106, 0.12); font-size: 0.78rem; }
.shogi-game .pro-year__bigone small { padding: 0 0.4rem; border-radius: 999px; color: #172632; background: #e9c46a; font-size: 0.66rem; font-weight: 900; }
.shogi-game .pro-year__bigone b { min-width: 0; }
.shogi-game .pro-year__bigone em { margin-left: auto; color: #e9c46a; font-style: normal; font-weight: 900; }
/* 今週(13章) */
.shogi-game .pro-year__weekpanel { display: flex; flex-direction: column; gap: 0.4rem; min-height: 0; overflow: auto; overscroll-behavior: contain; }
.shogi-game .pro-year__week-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 0.2rem 0.6rem; }
.shogi-game .pro-year__week-head h2 { margin: 0; color: var(--amber, #f1a54c); font-size: 1.05rem; }
.shogi-game .pro-year__week-head h2 small { margin-left: 0.4rem; color: #cfd8de; font-size: 0.75rem; }
.shogi-game .pro-year__condition { display: flex; align-items: center; gap: 0.35rem; margin: 0; font-size: 0.8rem; }
.shogi-game .pro-year__condition small { color: #cfd8de; }
.shogi-game .pro-year__cond-dots { display: inline-flex; gap: 0.15rem; }
.shogi-game .pro-year__cond-dots i { width: 0.55rem; height: 0.55rem; border-radius: 50%; background: rgba(255, 255, 255, 0.2); }
.shogi-game .pro-year__cond-dots i.on { background: #86d4a9; }
.shogi-game .pro-year__condition[data-pro-condition="0"] .pro-year__cond-dots i.on,
.shogi-game .pro-year__condition[data-pro-condition="1"] .pro-year__cond-dots i.on { background: #f5b7b1; }
.shogi-game .pro-year__strip { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 0.2rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .pro-year__strip-day { display: grid; justify-items: center; gap: 0.05rem; padding: 0.2rem 0 0.25rem; border-radius: 0.4rem; background: rgba(255, 255, 255, 0.07); line-height: 1.15; }
.shogi-game .pro-year__strip-day small { color: #cfd8de; font-size: 0.66rem; }
.shogi-game .pro-year__strip-day b { font-size: 0.85rem; }
.shogi-game .pro-year__strip-day.is-sun small { color: #f5b7b1; }
.shogi-game .pro-year__strip-day.is-sat small { color: #aed6f1; }
.shogi-game .pro-year__strip-day.is-past { opacity: 0.45; }
.shogi-game .pro-year__strip-day.is-out { opacity: 0.25; }
.shogi-game .pro-year__strip-day.is-today { outline: 0.12rem solid var(--amber, #f1a54c); }
.shogi-game .pro-year__strip-mark { padding: 0 0.25rem; border-radius: 0.25rem; color: #172632; font-size: 0.66rem; font-weight: 900; }
.shogi-game .pro-year__strip-mark--game { background: var(--amber, #f1a54c); }
.shogi-game .pro-year__strip-mark--study { background: #c9b6e4; }
.shogi-game .pro-year__strip-mark--festival { background: #f5b7b1; }
.shogi-game .pro-year__week-games { display: grid; gap: 0.25rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .pro-year__week-game { display: flex; align-items: center; gap: 0.4rem; padding: 0.3rem 0.45rem; border: 0.08rem solid rgba(241, 165, 76, 0.6); border-radius: 0.5rem; background: rgba(23, 38, 50, 0.85); }
.shogi-game .pro-year__week-game-text { display: flex; flex-wrap: wrap; gap: 0 0.35rem; align-items: baseline; flex: 1; min-width: 0; font-size: 0.8rem; }
.shogi-game .pro-year__week-game-text b { color: var(--amber, #f1a54c); }
.shogi-game .pro-year__week-game-text small { color: #cfd8de; }
.shogi-game .pro-year__weight { flex: none; padding: 0.05rem 0.4rem; border-radius: 999px; color: #172632; background: #aed6f1; font-size: 0.68rem; font-weight: 900; white-space: nowrap; }
.shogi-game .pro-year__weight--small { background: #d5dbdf; }
.shogi-game .pro-year__weight--big { background: #f5b7b1; }
.shogi-game .pro-year__stars { flex: none; color: #e9c46a; font-size: 0.8rem; letter-spacing: -0.05em; }
.shogi-game .pro-year__stars i { color: rgba(255, 255, 255, 0.3); font-style: normal; }
.shogi-game .pro-year__week-free { margin: 0; color: #cfd8de; font-size: 0.8rem; }
.shogi-game .pro-year__slots { display: grid; grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr)); gap: 0.35rem; }
.shogi-game .pro-year__slot,
.shogi-game .pro-year__action {
  display: flex; align-items: center; gap: 0.5rem; width: 100%; min-height: 3rem; padding: 0.35rem 0.55rem; border: 0.1rem dashed rgba(255, 255, 255, 0.4); border-radius: 0.6rem;
  color: inherit; background: rgba(255, 255, 255, 0.05); text-align: left; cursor: pointer;
}
.shogi-game .pro-year__slot--set,
.shogi-game .pro-year__action--now { border-style: solid; border-color: var(--amber, #f1a54c); background: rgba(241, 165, 76, 0.14); }
.shogi-game .pro-year__slot--lock { cursor: default; opacity: 0.85; }
.shogi-game .pro-year__action:disabled { cursor: default; opacity: 0.45; }
.shogi-game .pro-year__slot-icon { display: grid; flex: none; place-items: center; width: 2rem; height: 2rem; border-radius: 0.4rem; color: #172632; background: var(--amber, #f1a54c); font-weight: 900; }
.shogi-game .pro-year__slot-text { display: grid; flex: 1; min-width: 0; line-height: 1.25; }
.shogi-game .pro-year__slot-text b { font-size: 0.85rem; }
.shogi-game .pro-year__slot-text small { color: #cfd8de; font-size: 0.72rem; }
.shogi-game .pro-year__slot-text em { color: #86d4a9; font-size: 0.74rem; font-style: normal; font-weight: 800; }
.shogi-game .pro-year__actions,
.shogi-game .pro-year__goal-choices { display: grid; gap: 0.35rem; margin: 0 0 0.6rem; padding: 0; list-style: none; }
.shogi-game .pro-year__lastweek ul { margin: 0; padding-left: 1.1rem; font-size: 0.78rem; }
.shogi-game .pro-year__goal-choice { display: flex; align-items: center; gap: 0.5rem; width: 100%; padding: 0.35rem 0.55rem; border: 0.1rem solid rgba(255, 255, 255, 0.25); border-radius: 0.6rem; color: inherit; background: rgba(255, 255, 255, 0.05); text-align: left; cursor: pointer; }
.shogi-game .pro-year__goal-choice[aria-pressed="true"] { border-color: var(--amber, #f1a54c); background: rgba(241, 165, 76, 0.16); }
.shogi-game .pro-year__goal-choice:disabled { cursor: default; opacity: 0.45; }
.shogi-game .pro-year__goal-choice i { color: var(--amber, #f1a54c); font-style: normal; }
.shogi-game .pro-year__goal-check { display: grid; flex: none; place-items: center; width: 1.4rem; height: 1.4rem; border: 0.1rem solid var(--amber, #f1a54c); border-radius: 0.3rem; color: var(--amber, #f1a54c); font-weight: 900; }
.shogi-game .pro-year__goal-level { flex: none; color: #e9c46a; font-size: 0.75rem; }
.shogi-game .pro-year__goal-stamps { display: grid; gap: 0.2rem; margin: 0.3rem 0 0; padding: 0; list-style: none; font-size: 0.8rem; }
.shogi-game .pro-year__goal-stamps li { display: flex; align-items: center; gap: 0.4rem; }
.shogi-game .pro-year__goal-stamps small { margin-left: 0.4rem; color: #cfd8de; }
.shogi-game .pro-year__goal-seal { display: inline-grid; flex: none; place-items: center; min-width: 2.6rem; padding: 0.05rem 0.3rem; border: 0.12rem solid currentColor; border-radius: 0.3rem; color: #e74c3c; font-size: 0.7rem; font-weight: 900; transform: rotate(-6deg); }
.shogi-game .pro-year__goal-stamp--near .pro-year__goal-seal { color: #e9c46a; }
.shogi-game .pro-year__goal-stamp--miss .pro-year__goal-seal { color: #95a5a6; }
/* ニュース・取材・分身・仕事(14章) */
.shogi-game .pro-year__weekpanel > * { flex: none; }
.shogi-game .shogi-tournament__hud .pro-year__advance .shogi-tournament__start,
.shogi-game .shogi-tournament__hud .pro-year__advance .shogi-tournament__sub { min-width: 0; font-size: 0.95rem; letter-spacing: 0; line-height: 1.25; white-space: normal; }
.shogi-game .pro-year__news {
  display: grid; gap: 0.15rem; width: 100%; padding: 0.45rem 0.6rem 0.45rem 0.75rem; border: 0.08rem solid #cbbd9c; border-left: 0.35rem solid #c2493a; border-radius: 0.5rem;
  color: #1d303f; background: #f6f0e1; text-align: left; cursor: pointer;
}
.shogi-game .pro-year__news-mast { display: flex; align-items: baseline; gap: 0.4rem; color: #8a6a3a; font-size: 0.66rem; font-weight: 900; letter-spacing: 0.1em; }
.shogi-game .pro-year__news-mast small { margin-left: auto; color: #6b7c88; letter-spacing: 0; }
.shogi-game .pro-year__news-head { font-family: "Hiragino Mincho ProN", "Yu Mincho", serif; font-size: 1rem; line-height: 1.3; }
.shogi-game .pro-year__news-lead { color: #3c4f5c; font-size: 0.74rem; font-weight: 700; }
.shogi-game .pro-year__news-more { justify-self: end; color: #c2493a; font-size: 0.68rem; font-weight: 900; }
.shogi-game .pro-year__interview {
  display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 0.5rem; width: 100%; padding: 0.4rem 0.55rem;
  border: 0.12rem solid #8fd0e8; border-radius: 0.6rem; color: inherit; background: rgba(143, 208, 232, 0.12); text-align: left; cursor: pointer;
}
.shogi-game .pro-year__interview span { display: grid; min-width: 0; font-size: 0.8rem; }
.shogi-game .pro-year__interview small { overflow: hidden; color: #cfd8de; font-size: 0.7rem; text-overflow: ellipsis; white-space: nowrap; }
.shogi-game .pro-year__interview-icon { display: grid !important; place-items: center; width: 2rem; height: 2rem; border-radius: 50%; color: #172632; background: #8fd0e8; font-weight: 900; }
.shogi-game .pro-year__interview-go { padding: 0.2rem 0.6rem; border: 0.08rem solid rgba(255, 255, 255, 0.4); border-radius: 0.4rem; font-weight: 900; }
.shogi-game .pro-year__interview-reporter { margin: 0; color: #526878; font-size: 0.8rem; font-weight: 800; }
.shogi-game .pro-year__avatar-row {
  display: flex; align-items: center; gap: 0.5rem; width: 100%; padding: 0.35rem 0.55rem; border: 0.08rem solid rgba(255, 255, 255, 0.18); border-radius: 0.6rem;
  color: inherit; background: rgba(23, 38, 50, 0.85); text-align: left; cursor: pointer;
}
.shogi-game .pro-year__avatar-icon { background: #3d5a70; color: #fffcf4; }
.shogi-game .pro-year__avatar-bar { display: block; height: 0.3rem; margin-top: 0.2rem; border-radius: 999px; background: rgba(255, 255, 255, 0.15); overflow: hidden; }
.shogi-game .pro-year__avatar-bar i { display: block; height: 100%; background: #7bd3a8; }
.shogi-game .pro-year__gain { color: #7bd3a8; font-style: normal; font-weight: 900; }
.shogi-game .pro-year__action .pro-year__gain { font-size: 0.72rem; }
.shogi-game .pro-year__action-head { margin: 0.2rem 0 0.15rem; color: #8a6a3a; font-size: 0.75rem; font-weight: 900; }
.shogi-game .pro-year__action--lock { opacity: 0.5; }
.shogi-game .pro-year__action-tip { margin: 0 0 0.5rem; color: #526878; font-size: 0.78rem; font-weight: 800; }
.shogi-game .pro-year__workcard { display: grid; gap: 0.25rem; padding: 0.45rem 0.6rem; border: 0.12rem solid #8fd0e8; border-radius: 0.8rem; background: rgba(23, 38, 50, 0.9); }
.shogi-game .pro-year__workcard p { margin: 0; }
.shogi-game .pro-year__work-tag { padding: 0 0.4rem; border-radius: 0.3rem; color: #172632; background: #8fd0e8; font-size: 0.7rem; font-weight: 900; }
.shogi-game .pro-year__work-title { font-size: 1.05rem; font-weight: 900; }
.shogi-game .pro-year__work-note { color: #cfd8de; font-size: 0.78rem; font-weight: 700; }
.shogi-game .pro-year__work-terms { display: flex; flex-wrap: wrap; gap: 0.3rem 0.8rem; font-size: 0.8rem; }
.shogi-game .shogi-tournament__hud .pro-year__workcard ~ .shogi-tournament__actions small { display: block; font-size: 0.66rem; font-weight: 700; }
.shogi-game .pro-year__paper { display: grid; gap: 0.55rem; max-height: 88vh; overflow-y: auto; padding: 0.9rem; color: #1d303f; background: #f6f0e1; }
.shogi-game .pro-year__paper p { margin: 0; }
.shogi-game .pro-year__paper-mast { display: flex; align-items: baseline; gap: 0.5rem; padding-bottom: 0.35rem; border-bottom: 0.2rem double #1d303f; font-family: "Hiragino Mincho ProN", "Yu Mincho", serif; }
.shogi-game .pro-year__paper-mast b { font-size: 1.2rem; }
.shogi-game .pro-year__paper-mast span { margin-left: auto; color: #6b7c88; font-size: 0.72rem; }
.shogi-game .pro-year__paper-head { margin: 0; font-family: "Hiragino Mincho ProN", "Yu Mincho", serif; font-size: 1.35rem; line-height: 1.3; }
.shogi-game .pro-year__paper-lead { font-size: 0.85rem; font-weight: 700; line-height: 1.6; }
.shogi-game .pro-year__paper-lines { display: grid; gap: 0.2rem; margin: 0; padding: 0.4rem 0 0; border-top: 0.06rem solid #cbbd9c; list-style: none; font-size: 0.8rem; font-weight: 700; }
.shogi-game .pro-year__paper-lines li::before { content: "■ "; color: #c2493a; }
.shogi-game .pro-year__paper-record { padding: 0.3rem 0.5rem; border: 0.06rem solid #cbbd9c; border-radius: 0.4rem; font-size: 0.78rem; font-weight: 800; }
.shogi-game .pro-year__paper-hanane { display: flex; align-items: center; gap: 0.5rem; padding: 0.35rem 0.5rem; border-left: 0.2rem solid #7bd3a8; background: #fff; font-size: 0.82rem; font-weight: 800; }
.shogi-game .pro-year__paper-hanane img { width: 2rem; height: 2.6rem; flex: none; }
.shogi-game .pro-year__paper .shogi-tournament__sub { color: #1d303f; background: #e9e2d2; border-color: #cfc4ad; }
.shogi-game .pro-year__letter { display: flex; gap: 0.5rem; align-items: flex-start; padding: 0.4rem 0.55rem; border: 0.08rem dashed #c2493a; border-radius: 0.5rem; color: #1d303f; background: #fff; font-size: 0.78rem; font-weight: 700; }
.shogi-game .pro-year__letter small { display: block; color: #6b7c88; font-size: 0.68rem; }
.shogi-game .pro-year__letter-env { display: grid; flex: none; place-items: center; width: 2rem; height: 1.5rem; border-radius: 0.2rem; color: #c2493a; background: #f2c9c2; font-weight: 900; }
.shogi-game .pro-year__letter--next { opacity: 0.6; }
.shogi-game .pro-year__letters { display: grid; gap: 0.35rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .pro-year__ranks { display: grid; grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr)); gap: 0.4rem; }
.shogi-game .pro-year__rank { display: grid; gap: 0.15rem; padding: 0.4rem 0.5rem; border: 0.08rem solid rgba(255, 255, 255, 0.18); border-radius: 0.5rem; background: rgba(23, 38, 50, 0.85); font-size: 0.78rem; }
.shogi-game .pro-year__rank > b { color: var(--amber, #f1a54c); }
.shogi-game .pro-year__rank ol { display: grid; gap: 0.1rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .pro-year__rank li { display: grid; grid-template-columns: 2.2rem minmax(0, 1fr) auto; gap: 0.3rem; }
.shogi-game .pro-year__rank li span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.shogi-game .pro-year__rank-near { color: var(--amber, #f1a54c); font-weight: 800; }
.shogi-game .pro-year__radar { display: grid; justify-items: center; }
.shogi-game .pro-year__radar svg { width: min(100%, 15rem); height: auto; }
.shogi-game .pro-year__abars { display: grid; gap: 0.3rem; margin: 0 0 0.5rem; padding: 0; list-style: none; }
.shogi-game .pro-year__abars li { display: grid; grid-template-columns: 3.6rem 3rem minmax(0, 1fr) 4rem; align-items: center; gap: 0.4rem; font-size: 0.8rem; font-weight: 800; }
.shogi-game .pro-year__abar-track { height: 0.55rem; border-radius: 999px; background: #e1d9c6; overflow: hidden; }
.shogi-game .pro-year__abar-track i { display: block; height: 100%; background: #3aa37a; }
.shogi-game .pro-year__abars small { color: #526878; text-align: right; }
.shogi-game .pro-year__abar--up b, .shogi-game .pro-year__abar--up span:first-child { color: #2f7a5a; }
.shogi-game .pro-year__summary-heads { display: grid; gap: 0.15rem; margin: 0.25rem 0 0; padding: 0; list-style: none; font-size: 0.8rem; font-weight: 800; }
.shogi-game .pro-year__summary-heads small { margin-right: 0.4rem; color: #cfd8de; }
/* 公式戦の3つの指し方(13-3の5・6) */
.shogi-game .pro-year__ways { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.35rem; }
.shogi-game .pro-year__ways button,
.shogi-game .shogi-tournament__hud .pro-year__ways .shogi-tournament__start,
.shogi-game .shogi-tournament__hud .pro-year__ways .shogi-tournament__sub {
  display: grid; align-content: center; gap: 0.05rem; width: auto; min-width: 0; min-height: 3.2rem; margin: 0; padding: 0.3rem 0.35rem;
  font-size: 0.92rem; letter-spacing: 0; line-height: 1.2; white-space: normal;
}
.shogi-game .pro-year__ways small { font-size: 0.66rem; font-weight: 700; opacity: 0.85; }
.shogi-game .pro-year__cut-busy { display: grid; justify-items: center; gap: 0.6rem; text-align: center; }
.shogi-game .pro-year__cut-spinner { width: 2.2rem; height: 2.2rem; border: 0.25rem solid rgba(255, 255, 255, 0.2); border-top-color: var(--amber, #f1a54c); border-radius: 50%; animation: pro-year-spin 0.9s linear infinite; }
@keyframes pro-year-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .shogi-game .pro-year__cut-spinner { animation-duration: 3s; } }
.shogi-game .pro-year__goal-toast {
  position: absolute; top: 4.5rem; left: 50%; z-index: 30; display: flex; align-items: center; gap: 0.5rem; margin: 0; padding: 0.5rem 0.9rem; border: 0.12rem solid #e74c3c; border-radius: 0.7rem;
  color: #172632; background: #fdf6e3; font-weight: 900; transform: translateX(-50%); animation: pro-year-toast 0.35s ease-out; pointer-events: none;
}
@keyframes pro-year-toast { from { opacity: 0; transform: translate(-50%, -0.6rem) scale(1.1); } }
@media (prefers-reduced-motion: reduce) { .shogi-game .pro-year__goal-toast { animation: none; } }
.shogi-game .pro-year__side { display: grid; grid-template-rows: minmax(0, 1fr); min-height: 0; }
.shogi-game .pro-year__main--wide .pro-year__side { grid-template-rows: auto minmax(0, 1fr); gap: 0.4rem; }
.shogi-game .pro-year__tabs { display: flex; gap: 0.3rem; }
.shogi-game .pro-year__tabs button {
  min-height: 44px; padding: 0.2rem 0.9rem; border: 0.1rem solid rgba(255, 252, 244, 0.35); border-radius: 999px;
  color: #fffcf4; background: transparent; font: inherit; font-size: 0.85rem; font-weight: 800; cursor: pointer;
}
.shogi-game .pro-year__tabs button[aria-selected="true"] { color: #172632; background: var(--amber, #f1a54c); border-color: var(--amber, #f1a54c); }
/* カレンダー */
.shogi-game .pro-year__calendar { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; gap: 0.3rem; min-height: 0; }
.shogi-game .pro-year__month-bar { display: grid; grid-template-columns: 44px minmax(0, 1fr) 44px; align-items: center; }
.shogi-game .pro-year__month-title { margin: 0; color: #fffcf4; font-size: 1.05rem; text-align: center; }
.shogi-game .pro-year__month-step {
  width: 44px; height: 44px; border: 0.1rem solid rgba(255, 252, 244, 0.35); border-radius: 0.6rem;
  color: #fffcf4; background: rgba(43, 70, 91, 0.9); font: inherit; font-size: 1.3rem; font-weight: 900; cursor: pointer;
}
.shogi-game .pro-year__month-step:disabled { opacity: 0.35; cursor: default; }
.shogi-game .pro-year__grid { display: grid; grid-auto-rows: minmax(0, 1fr); grid-template-rows: auto; gap: 0.15rem; min-height: 0; }
.shogi-game .pro-year__weekdays, .shogi-game .pro-year__week { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 0.15rem; }
.shogi-game .pro-year__weekdays span { color: #cfd8de; font-size: 0.72rem; font-weight: 800; text-align: center; }
.shogi-game .pro-year__weekdays .pro-year__weekday--sun { color: #f5a3a3; }
.shogi-game .pro-year__weekdays .pro-year__weekday--sat { color: #a9c8f0; }
.shogi-game .pro-year__day {
  display: grid; grid-template-rows: auto minmax(0, 1fr); align-content: start; gap: 0.1rem; min-width: 0; min-height: 44px; padding: 0.15rem;
  border: 0.08rem solid rgba(255, 252, 244, 0.14); border-radius: 0.4rem; color: #fffcf4; background: rgba(23, 38, 50, 0.7);
  font: inherit; text-align: left; cursor: pointer; overflow: hidden;
}
.shogi-game .pro-year__day--out { visibility: hidden; }
.shogi-game .pro-year__day--past { background: rgba(23, 38, 50, 0.45); }
.shogi-game .pro-year__day--past .pro-year__day-no { color: #8a99a6; }
.shogi-game .pro-year__day--today { border: 0.14rem solid var(--amber, #f1a54c); }
.shogi-game .pro-year__day-no { font-size: 0.72rem; font-weight: 800; line-height: 1.1; }
.shogi-game .pro-year__marks { display: grid; align-content: start; gap: 0.1rem; min-width: 0; }
.shogi-game .pro-year__mark {
  display: inline-block; min-width: 0; max-width: 100%; padding: 0 0.2rem; overflow: hidden; border-radius: 0.3rem;
  font-size: 0.6rem; font-weight: 900; line-height: 1.35; text-overflow: clip; white-space: nowrap;
}
.shogi-game .pro-year__mark--user { color: #172632; background: var(--event-color); box-shadow: inset 0 0 0 0.08rem rgba(23, 38, 50, 0.6); }
.shogi-game .pro-year__mark--loss { opacity: 0.6; }
.shogi-game .pro-year__mark--plan { color: #fffcf4; border: 0.08rem dashed var(--event-color); }
.shogi-game .pro-year__mark--title { color: #172632; background: #e9c46a; }
.shogi-game .pro-year__mark--rival { color: #172632; background: #86d4a9; }
.shogi-game .pro-year__legend { display: flex; flex-wrap: wrap; align-items: center; gap: 0.2rem 0.4rem; margin: 0; color: #cfd8de; font-size: 0.68rem; }
.shogi-game .pro-year__legend .pro-year__mark { margin-left: 0.3rem; }
/* 棋戦の一覧 */
.shogi-game .pro-year__events { display: grid; align-content: start; gap: 0.3rem; min-height: 0; margin: 0; padding: 0; overflow-y: auto; list-style: none; }
.shogi-game .pro-year__event {
  display: grid; grid-template-columns: 0.4rem minmax(0, 1fr) auto; align-items: center; gap: 0.5rem; width: 100%; min-height: 44px;
  padding: 0.3rem 0.6rem 0.3rem 0.3rem; border: 0.08rem solid rgba(255, 252, 244, 0.2); border-radius: 0.6rem;
  color: #fffcf4; background: rgba(43, 70, 91, 0.9); font: inherit; text-align: left; cursor: pointer;
}
.shogi-game .pro-year__event-bar { align-self: stretch; border-radius: 0.2rem; background: var(--event-color); }
.shogi-game .pro-year__event-text { display: grid; min-width: 0; }
.shogi-game .pro-year__event-text strong { font-size: 0.9rem; }
.shogi-game .pro-year__event-text small { overflow: hidden; color: #cfd8de; font-size: 0.7rem; text-overflow: ellipsis; white-space: nowrap; }
.shogi-game .pro-year__event-status { max-width: 11rem; padding: 0.1rem 0.45rem; border-radius: 999px; font-size: 0.72rem; font-weight: 900; text-align: right; }
.shogi-game .pro-year__event-status--alive { color: #172632; background: #86d4a9; }
.shogi-game .pro-year__event-status--waiting { color: #fffcf4; border: 0.08rem dashed rgba(255, 252, 244, 0.5); }
.shogi-game .pro-year__event-status--won { color: #172632; background: #e9c46a; }
.shogi-game .pro-year__event-status--out, .shogi-game .pro-year__event-status--none { color: #8a99a6; }
/* 成績 */
.shogi-game .pro-year__record { display: grid; align-content: start; gap: 0.45rem; min-height: 0; overflow-y: auto; color: #fffcf4; }
.shogi-game .pro-year__stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.35rem; }
.shogi-game .pro-year__stats p { display: grid; margin: 0; padding: 0.35rem 0.5rem; border-radius: 0.6rem; background: rgba(43, 70, 91, 0.9); }
.shogi-game .pro-year__stats small { color: #cfd8de; font-size: 0.7rem; }
.shogi-game .pro-year__stats b { font-size: 1rem; }
.shogi-game .pro-year__stats b small { margin-left: 0.2rem; }
.shogi-game .pro-year__rival { display: flex; align-items: center; gap: 0.5rem; margin: 0; padding: 0.35rem 0.5rem; border-radius: 0.6rem; background: rgba(134, 212, 169, 0.15); font-size: 0.85rem; font-weight: 800; }
.shogi-game .pro-year__rival span { display: grid; }
.shogi-game .pro-year__rival small { color: #cfd8de; font-size: 0.72rem; }
.shogi-game .pro-year__rival-face { width: 2.2rem; height: 2.2rem; flex: none; border-radius: 50%; background: #2b465b; }
.shogi-game .pro-year__subhead { margin: 0.2rem 0 0; color: var(--amber, #f1a54c); font-size: 0.85rem; }
.shogi-game .pro-year__log { display: grid; gap: 0.2rem; margin: 0; padding: 0; list-style: none; font-size: 0.82rem; }
.shogi-game .pro-year__log li { display: grid; grid-template-columns: 3.6rem minmax(0, 1fr); gap: 0.4rem; }
.shogi-game .pro-year__log small { color: #cfd8de; }
.shogi-game .pro-year__log--advance span { color: #86d4a9; font-weight: 800; }
.shogi-game .pro-year__log-empty { color: #cfd8de; grid-template-columns: 1fr !important; }
/* お金と研究の道具 */
.shogi-game .pro-year__wallet { display: grid; gap: 0.3rem; padding: 0.45rem 0.55rem; border-radius: 0.6rem; background: rgba(43, 70, 91, 0.9); }
.shogi-game .pro-year__wallet p { margin: 0; }
.shogi-game .pro-year__money { display: flex; align-items: baseline; justify-content: space-between; gap: 0.5rem; }
.shogi-game .pro-year__money small { color: #cfd8de; font-size: 0.72rem; }
.shogi-game .pro-year__money b { color: #e9c46a; font-size: 1.2rem; }
.shogi-game .pro-year__money-line { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 0.3rem; font-size: 0.82rem; }
.shogi-game .pro-year__money-line small, .shogi-game .pro-year__gear-now small { flex-basis: 100%; }
.shogi-game .pro-year__money-line small, .shogi-game .pro-year__gear-now small, .shogi-game .pro-year__gear-name small { color: #cfd8de; font-size: 0.7rem; }
.shogi-game .pro-year__gear-now { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 0.3rem; font-size: 0.82rem; }
.shogi-game .pro-year__gear-next { display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: "name buy" "bar buy"; align-items: center; gap: 0.25rem 0.5rem; }
.shogi-game .pro-year__gear-name { grid-area: name; display: grid; font-size: 0.8rem; }
.shogi-game .pro-year__gear-bar { grid-area: bar; display: block; height: 0.45rem; overflow: hidden; border-radius: 999px; background: rgba(23, 38, 50, 0.9); }
.shogi-game .pro-year__gear-bar i { display: block; height: 100%; border-radius: inherit; background: #e9c46a; }
.shogi-game .pro-year__gear-buy {
  grid-area: buy; min-width: 5.5rem; min-height: 44px; padding: 0.2rem 0.7rem; border: 0; border-radius: 999px;
  color: #172632; background: var(--amber, #f1a54c); font: inherit; font-size: 0.8rem; font-weight: 900; cursor: pointer;
}
.shogi-game .pro-year__gear-buy:disabled { color: #cfd8de; background: rgba(23, 38, 50, 0.9); cursor: default; }
.shogi-game .pro-year__subhead small { margin-left: 0.3rem; color: #cfd8de; font-size: 0.7rem; }
.shogi-game .pro-year__ranking { display: grid; gap: 0.15rem; margin: 0; padding: 0; list-style: none; font-size: 0.8rem; }
.shogi-game .pro-year__ranking li { display: grid; grid-template-columns: 2.6rem minmax(0, 1fr) auto; gap: 0.4rem; padding: 0.1rem 0.35rem; border-radius: 0.3rem; }
.shogi-game .pro-year__ranking li span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.shogi-game .pro-year__ranking small { color: #cfd8de; }
.shogi-game .pro-year__ranking--you { color: #172632; background: var(--amber, #f1a54c); font-weight: 900; }
.shogi-game .pro-year__ranking--you small { color: #172632; }
.shogi-game .pro-year__ranking--rival { box-shadow: inset 0.2rem 0 0 #86d4a9; }
.shogi-game .pro-year__ranking-gap { color: #cfd8de; text-align: center; grid-template-columns: 1fr !important; }
.shogi-game .pro-year__prep { display: flex; flex-wrap: wrap; gap: 0.1rem 0.5rem; align-items: baseline; margin: 0.25rem 0 0; font-size: 0.75rem; }
.shogi-game .pro-year__prep b { padding: 0 0.4rem; border-radius: 999px; color: #172632; background: #a9c1d9; font-size: 0.68rem; }
/* 研究会 */
.shogi-game .pro-year__mark--study { color: #172632; background: #c9b6e4; }
.shogi-game .pro-year__study { display: grid; gap: 0.15rem; margin: 0; padding: 0; list-style: none; font-size: 0.82rem; }
.shogi-game .pro-year__study li { display: flex; justify-content: space-between; gap: 0.5rem; padding: 0.15rem 0.4rem; border-radius: 0.35rem; background: rgba(201, 182, 228, 0.12); }
.shogi-game .pro-year__study small { margin-left: 0.3rem; color: #cfd8de; font-size: 0.7rem; }
.shogi-game .pro-year__study--next { box-shadow: inset 0.2rem 0 0 #c9b6e4; }
.shogi-game .pro-year__prep--mate b { background: #c9b6e4; }
.shogi-game .pro-year__day-study { display: grid; gap: 0.1rem; margin: 0.3rem 0; padding: 0.35rem 0.5rem; border-left: 0.35rem solid #c9b6e4; border-radius: 0.4rem; background: rgba(201, 182, 228, 0.12); font-size: 0.85rem; }
.shogi-game .pro-year__day-study b { margin-right: 0.4rem; }
.shogi-game .pro-year__day-study small { color: #cfd8de; font-size: 0.75rem; }
/* 将棋まつり */
.shogi-game .pro-year__mark--festival { color: #fffcf4; background: #c0392b; }
.shogi-game .pro-year__day-festival { border-left-color: #c0392b; background: rgba(192, 57, 43, 0.14); }
.shogi-game .pro-year__kigou { display: grid; grid-template-columns: repeat(auto-fill, minmax(7.5rem, 1fr)); gap: 0.3rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .pro-year__kigou li { display: grid; padding: 0.3rem 0.45rem; border: 0.12rem solid #d4af37; border-radius: 0.3rem; color: #1b1b1b; background: #fbf8f0; }
.shogi-game .pro-year__kigou b { font-family: "Yu Mincho", "Hiragino Mincho ProN", serif; font-size: 1rem; }
.shogi-game .pro-year__kigou small { overflow: hidden; color: #5d6d7e; font-size: 0.66rem; text-overflow: ellipsis; white-space: nowrap; }
/* 寄り道 */
/* 下の欄 */
.shogi-game .pro-year__next { padding: 0.45rem 0.6rem; border: 0.12rem solid var(--event-color); border-radius: 0.8rem; background: rgba(23, 38, 50, 0.9); }
.shogi-game .pro-year__next-head { display: flex; flex-wrap: wrap; gap: 0.1rem 0.6rem; align-items: baseline; margin: 0; }
.shogi-game .pro-year__next-head b { color: var(--amber, #f1a54c); }
.shogi-game .pro-year__next-head span { font-size: 0.82rem; font-weight: 800; }
.shogi-game .pro-year__next-vs { display: flex; flex-wrap: wrap; gap: 0.1rem 0.6rem; align-items: baseline; justify-content: space-between; margin: 0.2rem 0 0; }
.shogi-game .pro-year__next-vs strong { font-size: 1.05rem; }
.shogi-game .pro-year__next-vs small { margin-left: 0.3rem; color: #cfd8de; font-size: 0.75rem; }
.shogi-game .pro-year__next-stakes { color: #86d4a9 !important; font-weight: 800; }
.shogi-game .pro-year__summary { display: grid; gap: 0.15rem; padding: 0.5rem 0.7rem; border: 0.12rem solid #e9c46a; border-radius: 0.8rem; background: rgba(23, 38, 50, 0.9); }
.shogi-game .pro-year__summary p { margin: 0; }
.shogi-game .pro-year__summary-head { color: var(--amber, #f1a54c); font-size: 0.85rem; font-weight: 900; }
.shogi-game .pro-year__summary-main { font-size: 1.4rem; font-weight: 900; }
.shogi-game .pro-year__summary-main small { margin-left: 0.5rem; color: #cfd8de; font-size: 0.8rem; }
.shogi-game .pro-year__summary-title { color: #e9c46a; font-weight: 900; }
.shogi-game .pro-year__summary-line { font-size: 0.82rem; }
.shogi-game .pro-year__awards { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.shogi-game .pro-year__award { padding: 0.05rem 0.5rem; border-radius: 999px; color: #172632; background: #e9c46a; font-size: 0.75rem; font-weight: 900; }
/* シート */
.shogi-game .pro-year__sheet { max-height: min(88vh, 46rem); overflow-y: auto; }
/* 棋戦の画面(全画面) */
.shogi-game .pro-year__event-screen {
  position: fixed; inset: 0; z-index: 60; display: grid; grid-template-rows: auto auto auto minmax(0, 1fr); gap: 0.4rem;
  padding: 0.6rem; color: #fffcf4; background: #172632;
}
.shogi-game .pro-year__event-head { display: flex; align-items: center; gap: 0.6rem; min-width: 0; padding-left: 0.4rem; border-left: 0.4rem solid var(--event-color); }
.shogi-game .pro-year__event-heading { display: grid; min-width: 0; }
.shogi-game .pro-year__event-heading h2 { margin: 0; font-size: 1.15rem; }
.shogi-game .pro-year__event-heading small { overflow: hidden; color: #cfd8de; font-size: 0.78rem; text-overflow: ellipsis; white-space: nowrap; }
.shogi-game .pro-year__tabs--small { flex-wrap: wrap; }
.shogi-game .pro-year__tabs--small button { min-height: 44px; padding: 0.15rem 0.7rem; font-size: 0.8rem; }
.shogi-game .pro-year__stage-tabs button small { margin-left: 0.3rem; font-size: 0.66rem; opacity: 0.85; }
.shogi-game .pro-year__stage-tab--you { box-shadow: inset 0 -0.18rem 0 var(--amber, #f1a54c); }
.shogi-game .pro-year__event-body { display: grid; grid-template-rows: auto auto minmax(0, 1fr) auto; align-content: start; gap: 0.4rem; min-height: 0; overflow-y: auto; }
.shogi-game .pro-year__stage-info { display: flex; flex-wrap: wrap; gap: 0.2rem 0.8rem; margin: 0; color: #cfd8de; font-size: 0.8rem; }
.shogi-game .pro-year__stage-info b { color: var(--amber, #f1a54c); }
.shogi-game .pro-year__stage-info .pro-year__stage-you--out { color: #8a99a6; }
.shogi-game .pro-year__event-body > .team-battle__table, .shogi-game .pro-year__event-body .pro-year__tables { max-width: 44rem; }
.shogi-game .pro-year__stage-empty { margin: 1rem 0; color: #cfd8de; text-align: center; }
.shogi-game .pro-year__bracket { min-height: min(60vh, 32rem); height: 100%; }
.shogi-game .pro-year__bracket .ryuo-bracket { height: 100%; }
.shogi-game .pro-year__others { display: flex; flex-wrap: wrap; gap: 0.2rem 0.7rem; margin: 0; color: #cfd8de; font-size: 0.75rem; }
.shogi-game .pro-year__series-box { display: grid; align-content: start; gap: 0.5rem; }
.shogi-game .pro-year__series-box .pro-year__series { font-size: 1rem; }
.shogi-game .pro-year__hoshi { display: grid; grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr)); gap: 0.35rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .pro-year__hoshi li { display: grid; grid-template-columns: auto 1fr auto; grid-template-areas: "no no color" "date mark mark" "watch watch watch"; align-items: center; gap: 0.1rem 0.3rem; padding: 0.35rem 0.5rem; border-radius: 0.5rem; background: rgba(43, 70, 91, 0.7); }
.shogi-game .pro-year__hoshi li small { grid-area: no; color: #cfd8de; font-size: 0.72rem; }
.shogi-game .pro-year__hoshi-date { grid-area: date; font-size: 0.78rem; }
.shogi-game .pro-year__hoshi li b { grid-area: mark; font-size: 1.2rem; text-align: right; }
.shogi-game .pro-year__hoshi-color { grid-area: color; color: #cfd8de; font-size: 0.72rem; }
.shogi-game .pro-year__hoshi li .pro-year__watch { grid-area: watch; }
.shogi-game .pro-year__hoshi--empty { opacity: 0.5; }
.shogi-game .pro-year__note { margin: 0; color: #cfd8de; font-size: 0.75rem; }
.shogi-game .pro-year__watch {
  min-height: 36px; padding: 0.1rem 0.6rem; border: 0.1rem solid rgba(255, 252, 244, 0.45); border-radius: 999px;
  color: #fffcf4; background: rgba(43, 70, 91, 0.95); font: inherit; font-size: 0.75rem; font-weight: 800; cursor: pointer;
}
.shogi-game .pro-year__day-games { display: grid; gap: 0.35rem; margin: 0.4rem 0; padding: 0; list-style: none; }
.shogi-game .pro-year__day-game { display: grid; gap: 0.1rem; padding: 0.35rem 0.5rem; border-left: 0.35rem solid var(--event-color); border-radius: 0.4rem; background: rgba(43, 70, 91, 0.6); }
.shogi-game .pro-year__day-game small { color: #cfd8de; font-size: 0.72rem; }
.shogi-game .pro-year__day-game span { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: baseline; font-size: 0.88rem; }
.shogi-game .pro-year__day-game i { color: #cfd8de; font-style: normal; font-size: 0.75rem; }
.shogi-game .pro-year__day-game--you { box-shadow: inset 0 0 0 0.1rem var(--amber, #f1a54c); }
.shogi-game .pro-year__day-game--plan { border-left-style: dashed; }
.shogi-game .pro-year__winner { color: var(--amber, #f1a54c); }
.shogi-game .pro-year__event-title { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: baseline; border-left: 0.4rem solid var(--event-color); padding-left: 0.4rem; }
.shogi-game .pro-year__event-title small { color: #cfd8de; font-size: 0.8rem; }
.shogi-game .pro-year__cycle h3 { margin: 0.5rem 0 0.25rem; font-size: 0.9rem; }
.shogi-game .pro-year__cycle h3 small { color: #cfd8de; font-size: 0.75rem; }
.shogi-game .pro-year__stages { display: grid; gap: 0.35rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .pro-year__stage { padding: 0.35rem 0.5rem; border-radius: 0.5rem; background: rgba(43, 70, 91, 0.45); }
.shogi-game .pro-year__stage--now { box-shadow: inset 0 0 0 0.1rem #86d4a9; }
.shogi-game .pro-year__stage-head { display: flex; flex-wrap: wrap; gap: 0.1rem 0.5rem; align-items: baseline; margin: 0; }
.shogi-game .pro-year__stage-head small { color: #cfd8de; font-size: 0.72rem; }
.shogi-game .pro-year__series { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); gap: 0.4rem; margin: 0.25rem 0 0; font-size: 0.88rem; }
.shogi-game .pro-year__series span:last-child { text-align: right; }
.shogi-game .pro-year__tables { display: grid; grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr)); gap: 0.4rem; margin-top: 0.25rem; }
.shogi-game .pro-year__block { display: grid; gap: 0.15rem; margin-top: 0.25rem; }
.shogi-game .pro-year__block small { color: #cfd8de; font-size: 0.72rem; }
.shogi-game .pro-year__block ul { display: grid; gap: 0.15rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .pro-year__block li { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); gap: 0.3rem; padding: 0.1rem 0.3rem; border-radius: 0.3rem; font-size: 0.8rem; }
.shogi-game .pro-year__block li span:last-child { text-align: right; }
.shogi-game .pro-year__block i { color: #cfd8de; font-style: normal; font-size: 0.72rem; }
.shogi-game .pro-year__winners { margin: 0.2rem 0 0; color: #cfd8de; font-size: 0.75rem; }
@media (min-width: 700px) {
  .shogi-game .pro-year__day { min-height: 3.4rem; }
  .shogi-game .pro-year__day-no { font-size: 0.85rem; }
  .shogi-game .pro-year__mark { font-size: 0.7rem; }
}
@media (prefers-reduced-motion: reduce) {
  .shogi-game .pro-year__day { transition: none; }
}
</style>
