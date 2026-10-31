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

      <section class="shoreikai__main pro-year__main" :class="{ 'pro-year__main--wide': wide }" aria-label="1年">
        <div v-if="!wide" class="pro-year__tabs" role="tablist" aria-label="見るもの">
          <button v-for="item in tabs" :key="item.id" type="button" role="tab" :aria-selected="tab === item.id" :data-pro-tab="item.id" @click="tab = item.id">{{ item.label }}</button>
        </div>

        <!-- 月のカレンダー -->
        <div v-show="wide || tab === 'calendar'" class="pro-year__calendar" data-pro-calendar>
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
            <span class="pro-year__mark pro-year__mark--rival">羽</span>羽音
          </p>
        </div>

        <div v-show="wide || tab !== 'calendar'" class="pro-year__side">
          <div v-if="wide" class="pro-year__tabs" role="tablist" aria-label="見るもの">
            <button v-for="item in sideTabs" :key="item.id" type="button" role="tab" :aria-selected="sideTab === item.id" :data-pro-tab="item.id" @click="tab = item.id">{{ item.label }}</button>
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
                <li v-for="item in view.history" :key="item.fy"><small>{{ item.fy }}年度</small><span>{{ item.wins }}勝{{ item.losses }}敗{{ item.titles.length ? `・${item.titles.join("・")}` : "" }}{{ item.awards.length ? `・${item.awards.join("・")}` : "" }}</span></li>
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
        </div>
        <!-- 次の対局 -->
        <div v-else-if="view.pending" class="pro-year__next" :style="{ '--event-color': pendingColor }" data-pro-next>
          <p class="pro-year__next-head"><b>{{ view.pending.dateText }}</b><span>{{ view.pending.label }}</span></p>
          <p class="pro-year__next-vs">
            <span>対 <strong>{{ view.pending.opponent?.name }}</strong><small>{{ view.pending.opponent?.dan }}</small></span>
            <small class="pro-year__next-stakes">{{ view.pending.stakes?.text }}</small>
          </p>
        </div>
        <p class="shogi-tournament__tip-line shoreikai__tip" data-pro-run-talk>
          <img class="shogi-tournament__tip-face pro-year__sprite" :src="talkSprite" alt="" draggable="false">
          <span class="shogi-tournament__tip-text">{{ runLine }}</span>
        </p>
        <template v-if="view.yearDone">
          <button type="button" class="shogi-tournament__start" data-pro-next-year @click="emit('next-year')">次の年度へ</button>
        </template>
        <template v-else-if="view.pending">
          <div class="shogi-tournament__actions shogi-tournament__actions--two">
            <button type="button" class="shogi-tournament__sub" data-pro-auto @click="openAuto">分身に任せる</button>
            <button type="button" class="shogi-tournament__start" data-pro-play @click="suspendedMoves ? emit('resume') : emit('play')">
              {{ suspendedMoves ? `対局を再開（${suspendedMoves}手目から）` : "対局する" }}
            </button>
          </div>
        </template>
        <button v-else type="button" class="shogi-tournament__start" data-pro-advance @click="emit('advance')">
          {{ nextPreview ? `次の対局日へ（${nextPreview.dateText.replace(/\(.\)$/, "")}）` : "年度の終わりへ" }}
        </button>
      </section>

      <!-- その日の対局 -->
      <div v-if="dayOpen" class="shogi-tournament__sheet" role="dialog" aria-modal="true" :aria-label="dayOpen.dateText" data-pro-day-sheet @click.self="dayDate = ''">
        <div class="shogi-tournament__sheet-panel shogi-tournament__detail pro-year__sheet">
          <h2>{{ dayOpen.dateText }}</h2>
          <p v-if="!dayOpen.games.length && !dayPlans.length" class="shogi-tournament__text">この日は、見ておきたい対局がないよ。</p>
          <ul class="pro-year__day-games">
            <li v-for="game in dayOpen.games" :key="game.id" class="pro-year__day-game" :class="{ 'pro-year__day-game--you': game.user }" :style="{ '--event-color': game.color }">
              <small>{{ game.label }}{{ game.twoDay ? "（2日制）" : "" }}</small>
              <span>
                <b :class="{ 'pro-year__winner': game.winner?.id === game.a?.id }">{{ nameText(game.a) }}</b>
                <i>{{ game.winner ? (game.winner.id === game.a?.id ? "○-●" : "●-○") : "対" }}</i>
                <b :class="{ 'pro-year__winner': game.winner?.id === game.b?.id }">{{ nameText(game.b) }}</b>
              </span>
            </li>
            <li v-for="(plan, index) in dayPlans" :key="`plan-${index}`" class="pro-year__day-game pro-year__day-game--plan" :style="{ '--event-color': plan.color }">
              <small>{{ plan.label }}</small><span>勝ち残っていれば、この日に指すよ</span>
            </li>
          </ul>
          <button type="button" class="shogi-tournament__sub shogi-tournament__sheet-close" @click="dayDate = ''">閉じる</button>
        </div>
      </div>

      <!-- 棋戦の表 -->
      <div v-if="eventOpen" class="shogi-tournament__sheet" role="dialog" aria-modal="true" :aria-label="eventOpen.name" data-pro-event-sheet @click.self="eventId = ''">
        <div class="shogi-tournament__sheet-panel shogi-tournament__detail pro-year__sheet" :style="{ '--event-color': eventOpen.color }">
          <h2 class="pro-year__event-title">{{ eventOpen.name }}<small v-if="eventOpen.holder">{{ eventOpen.holder.you ? playerName : eventOpen.holder.name }}</small></h2>
          <section v-for="cycle in eventOpen.cycles" :key="cycle.id" class="pro-year__cycle">
            <h3>{{ cycle.label }}<small v-if="!cycle.withUser">（観戦）</small><small v-if="cycle.champion">・{{ cycle.champion.you ? playerName : cycle.champion.name }}が{{ eventKind === "title" ? "獲得" : "優勝" }}</small></h3>
            <ol class="pro-year__stages">
              <li v-for="(stage, index) in cycle.stages" :key="index" class="pro-year__stage" :class="{ 'pro-year__stage--done': stage.done, 'pro-year__stage--now': stage.started && !stage.done }">
                <p class="pro-year__stage-head"><b>{{ stage.label }}</b><small>{{ stage.period }}・{{ stage.done ? "終わり" : stage.started ? "いま" : "これから" }}</small></p>
                <!-- 番勝負 -->
                <p v-if="stage.series" class="pro-year__series">
                  <span>{{ nameText(stage.series.a) }}</span>
                  <b>{{ stage.series.wins[0] }} - {{ stage.series.wins[1] }}</b>
                  <span>{{ nameText(stage.series.b) }}</span>
                </p>
                <!-- リーグ -->
                <div v-else-if="stage.groups" class="pro-year__tables">
                  <table v-for="group in stage.groups" :key="group.name" class="team-battle__table">
                    <caption v-if="group.name">{{ group.name }}</caption>
                    <tbody>
                      <tr v-for="row in group.rows" :key="row.id" :class="{ 'team-battle__row--you': row.you }">
                        <td>{{ row.rank }}</td><td>{{ nameText(row) }}</td><td>{{ row.wins }}勝{{ row.losses }}敗</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <!-- 順位戦 -->
                <table v-else-if="stage.rows" class="team-battle__table">
                  <caption>{{ stage.cls }}・上位{{ stage.promote }}人が昇級</caption>
                  <tbody>
                    <tr v-for="row in stage.rows" :key="row.id" :class="{ 'team-battle__row--you': row.you }">
                      <td>{{ row.rank }}</td><td>{{ nameText(row) }}</td><td>{{ row.wins }}勝{{ row.losses }}敗</td>
                    </tr>
                  </tbody>
                </table>
                <!-- トーナメント・予選のブロック -->
                <div v-else-if="stage.block" class="pro-year__block">
                  <small v-if="stage.blockCount > 1">{{ stage.block.name }}（{{ stage.blockCount }}ブロックの1つ）</small>
                  <ul>
                    <li v-for="(game, gameIndex) in stage.block.games" :key="gameIndex" :class="{ 'team-battle__row--you': game.a?.you || game.b?.you }">
                      <span :class="{ 'pro-year__winner': game.winner === 'a' }">{{ nameText(game.a) }}</span>
                      <i>{{ game.winner ? (game.winner === "a" ? "○-●" : "●-○") : "対" }}</i>
                      <span :class="{ 'pro-year__winner': game.winner === 'b' }">{{ nameText(game.b) }}</span>
                    </li>
                  </ul>
                </div>
                <p v-if="stage.done && stage.winners?.length && !stage.series" class="pro-year__winners">勝ち上がり：{{ stage.winners.slice(0, 8).map(nameText).join("・") }}{{ stage.winners.length > 8 ? " ほか" : "" }}</p>
              </li>
            </ol>
          </section>
          <button type="button" class="shogi-tournament__sub shogi-tournament__sheet-close" @click="eventId = ''">閉じる</button>
        </div>
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
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type PropType } from "vue";
import PregamePicker, { type PickerSection, type PickerValue } from "./PregamePicker.vue";
import { MEASURE_PICKER_ACTION } from "./core/skill-estimate.mjs";
import { difficultyName, difficultyOptions } from "./core/tournament-world.mjs";
import { LEARNING_ASSIST_LIMITS } from "./core/learning-setup.mjs";
import { BYOYOMI_CHOICES, byoyomiLabel } from "./core/byoyomi.mjs";
import { GROUP_MEAN_RATING, WORLD_BASE_RATING } from "./core/ryuo-strength.mjs";
import {
  CLASS_NAMES, PRO_EVENTS, PRO_YEAR_TEXT, dayView, eventView, monthView, previewNextGame, proEvent, proYearTalk, proYearView, yearEnd, yearStart,
} from "./core/pro-year.mjs";

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
  suspendedMoves: { type: Number as PropType<number | null>, default: null },
  backLabel: { type: String, default: "大会の選択へ" },
});
const emit = defineEmits<{
  measure: [];
  enter: [payload: { settings: Settings }];
  advance: [];
  play: [];
  resume: [];
  auto: [];
  "next-year": [];
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
const talkSprite = computed(() => (view.value?.pending?.hananeLine ? hananeSprite.value : yakobiSprite.value));
const runLine = computed(() => {
  const current = view.value;
  if (!current) return "";
  const pending = current.pending;
  if (pending?.hananeLine) return pending.hananeLine;
  if (pending) return pending.kind === "finals" ? PRO_YEAR_TEXT.titleGame : pending.stakes?.boss ? PRO_YEAR_TEXT.bigGame : PRO_YEAR_TEXT.game;
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
  { id: "calendar", label: "カレンダー" },
  { id: "events", label: "棋戦" },
  { id: "record", label: "成績" },
] as const;
const sideTabs = tabs.filter((item) => item.id !== "calendar");
const tab = ref<"calendar" | "events" | "record">("calendar");
const sideTab = computed(() => (tab.value === "calendar" ? "events" : tab.value));
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
  const order: { [kind: string]: number } = { user: 0, title: 1, rival: 2, plan: 3 };
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
  if (item.kind === "title") return "★";
  if (item.kind === "rival") return "羽";
  const short = item.short ?? proEvent(item.event)?.short ?? "";
  if (item.kind === "user" && item.result) return `${item.result === "win" ? "○" : "●"}${short}`;
  return short;
};
const dayAria = (cell: Cell) => {
  if (!cell.inMonth) return "";
  const parts = cell.items.map((item) => (item.kind === "user" ? `自分の対局 ${item.label}` : item.kind === "title" ? `タイトル戦 ${item.label}` : item.kind === "rival" ? `羽音の対局` : `勝ち残れば ${item.label}`));
  return `${Number(cell.date.slice(5, 7))}月${cell.day}日${cell.today ? "（今日）" : ""}${parts.length ? `。${parts.join("、")}` : ""}`;
};

// その日
const dayDate = ref("");
const dayOpen = computed(() => (props.state && dayDate.value ? dayView(props.state, dayDate.value) : null));
const dayPlans = computed(() => month.value.weeks.flat().find((cell) => cell.date === dayDate.value)?.items.filter((item) => item.kind === "plan") ?? []);
function openDay(date: string) {
  dayDate.value = date;
}

// 棋戦の表
const eventId = ref("");
const eventOpen = computed(() => (props.state && eventId.value ? eventView(props.state, eventId.value) : null));
const eventKind = computed(() => proEvent(eventId.value)?.kind ?? "");
function openEvent(id: string) {
  eventId.value = id;
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
function goBack() {
  if (picker.value) picker.value = "";
  else if (settingsOpen.value) settingsOpen.value = false;
  else if (autoOpen.value) autoOpen.value = false;
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
.shogi-game .pro-year__main--wide { grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); }
.shogi-game .pro-year__side { display: grid; grid-template-rows: minmax(0, 1fr); min-height: 0; }
.shogi-game .pro-year__main--wide .pro-year__side { grid-template-rows: auto minmax(0, 1fr); gap: 0.4rem; }
.shogi-game .pro-year__tabs { display: flex; gap: 0.3rem; }
.shogi-game .pro-year__tabs button {
  min-height: 40px; padding: 0.2rem 0.9rem; border: 0.1rem solid rgba(255, 252, 244, 0.35); border-radius: 999px;
  color: #fffcf4; background: transparent; font: inherit; font-size: 0.85rem; font-weight: 800; cursor: pointer;
}
.shogi-game .pro-year__tabs button[aria-selected="true"] { color: #172632; background: var(--amber, #f1a54c); border-color: var(--amber, #f1a54c); }
/* カレンダー */
.shogi-game .pro-year__calendar { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; gap: 0.3rem; min-height: 0; }
.shogi-game .pro-year__month-bar { display: grid; grid-template-columns: 44px minmax(0, 1fr) 44px; align-items: center; }
.shogi-game .pro-year__month-title { margin: 0; color: #fffcf4; font-size: 1.05rem; text-align: center; }
.shogi-game .pro-year__month-step {
  width: 44px; height: 40px; border: 0.1rem solid rgba(255, 252, 244, 0.35); border-radius: 0.6rem;
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
