<template>
  <!--
    奨励会(docs/shoreikai-design.md)。大会の画面(ShogiTournament.vue)の中に出し、竜王戦・名人戦と同じ部品の見た目を使う。
    入口: 名札掛けと、師匠・受験級・設定・「受験する」。挑戦中: 上の帯、真ん中(試験の星取り・名札掛けと昇級までの残り・三段リーグの表)、
    下(横長は右)の次の一局の枠。終わり: 不合格(受け直す)・退会・四段の式。
  -->
  <div class="shoreikai" data-shoreikai>
    <!-- 入口 -->
    <div v-if="screen === 'entry'" class="shogi-tournament__stage shogi-tournament__stage--entry shoreikai__framed" data-shoreikai-screen="entry">
      <header class="shogi-tournament__topbar shoreikai__topbar">
        <button type="button" class="shogi-tournament__topbar-back" :aria-label="backLabel" data-shoreikai-back @click="emit('back')">
          <span aria-hidden="true">←</span><span class="shogi-tournament__topbar-back-text">{{ backLabel }}</span>
        </button>
        <span class="shogi-tournament__seal" aria-hidden="true">奨</span>
        <div class="shogi-tournament__topbar-title">
          <h1 id="shogi-tournament-title">奨励会</h1>
          <p class="shogi-tournament__topbar-sub">{{ careerText }}</p>
        </div>
      </header>
      <div class="shogi-tournament__mapwrap shoreikai__mapwrap">
        <div class="shoreikai__dojo">
          <ShoreikaiNameboard :columns="previewColumns" preview />
          <div class="shogi-tournament__logo shoreikai__logo">
            <span class="shogi-tournament__seal" aria-hidden="true">奨</span>
            <strong>奨励会</strong>
            <span class="shogi-tournament__logo-no">入会試験から、四段（プロ）へ</span>
          </div>
        </div>
      </div>
      <section class="shogi-tournament__hud" aria-label="受験">
        <p class="shogi-tournament__goal-box" data-shoreikai-goal><small>目標</small><span>{{ transfer ? "研修会から6級に編入して、三段リーグを抜け、四段（プロ棋士）になる" : "入会試験に合格して、三段リーグを抜け、四段（プロ棋士）になる" }}</span></p>
        <p class="shogi-tournament__tip-line shoreikai__tip" data-shoreikai-talk>
          <img class="shogi-tournament__tip-face" :src="charaUrl" alt="" draggable="false">
          <span class="shogi-tournament__tip-text">{{ entryLine }}</span>
        </p>
        <div class="shogi-tournament__entry-settings">
          <p>
            <small>{{ mentor ? `師匠 ${mentor.name}${mentor.dan}` : "師匠" }}</small>
            <span data-shoreikai-summary>{{ settingsSummary }}</span>
          </p>
          <button type="button" class="shogi-tournament__sub" data-shoreikai-change @click="settingsOpen = true">変える</button>
        </div>
        <button type="button" class="shogi-tournament__start" data-shoreikai-enter @click="enter">{{ transfer ? "6級に編入する" : "受験する" }}</button>
      </section>

      <div v-if="settingsOpen" class="shogi-tournament__sheet" role="dialog" aria-modal="true" :aria-label="transfer ? '編入の設定' : '受験の設定'" data-shoreikai-settings @click.self="settingsOpen = false">
        <div class="shogi-tournament__sheet-panel shogi-tournament__detail">
          <h2>{{ transfer ? "編入の設定" : "受験の設定" }}</h2>
          <p class="shogi-tournament__tip-line shoreikai__tip">
            <img class="shogi-tournament__tip-face" :src="charaUrl" alt="" draggable="false">
            <span class="shogi-tournament__tip-text">{{ settingTalk }}</span>
          </p>
          <ul class="shogi-tournament__settings">
            <li v-for="row in settingRows" :key="row.id">
              <button
                type="button"
                class="shogi-tournament__setting"
                :data-shoreikai-row="row.id"
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
        @select="onPick"
        @close="picker = ''"
      />
    </div>

    <!-- 挑戦中(入会試験・例会・三段リーグ) -->
    <div v-else-if="screen === 'run' && view" class="shogi-tournament__stage shogi-tournament__stage--shoreikai" data-shoreikai-screen="run" :data-shoreikai-phase="view.phase">
      <header class="shogi-tournament__topbar shoreikai__topbar">
        <button type="button" class="shogi-tournament__topbar-back" :aria-label="backLabel" data-shoreikai-back @click="emit('back')">
          <span aria-hidden="true">←</span><span class="shogi-tournament__topbar-back-text">{{ backLabel }}</span>
        </button>
        <span class="shogi-tournament__seal" aria-hidden="true">奨</span>
        <div class="shogi-tournament__topbar-title">
          <h1 id="shogi-tournament-title">{{ runTitle }}</h1>
          <p class="shogi-tournament__topbar-sub" data-shoreikai-sub>{{ runSub }}</p>
        </div>
      </header>

      <section class="shoreikai__main" :aria-label="runTitle">
        <!-- 入会試験: 一次・二次の星取り -->
        <template v-if="view.phase === 'exam' && view.exam">
          <div class="shogi-tournament__stagehead">
            <h2>入会試験（{{ view.rankLabel }}）</h2>
            <p>{{ view.exam.stage === 1 ? "一次試験：受験者どうしで、4勝で通過・3敗で不合格" : "二次試験：奨励会員と3局。1勝で合格" }}</p>
          </div>
          <div class="shoreikai__exam" data-shoreikai-exam>
            <p :class="['shoreikai__exam-row', { 'is-current': view.exam.stage === 1 }]">
              <b>一次</b>
              <span class="shoreikai__marks" :aria-label="`一次試験 ${view.exam.wins}勝${view.exam.losses}敗`">
                <i v-for="(mark, index) in examFirstMarks" :key="index" :class="`is-${mark}`">{{ markText(mark) }}</i>
              </span>
              <small>{{ view.exam.stage === 1 ? `あと${4 - view.exam.wins}勝で通過` : "通過" }}</small>
            </p>
            <p :class="['shoreikai__exam-row', { 'is-current': view.exam.stage === 2, 'is-later': view.exam.stage === 1 }]">
              <b>二次</b>
              <span class="shoreikai__marks" aria-label="二次試験">
                <i v-for="(mark, index) in examSecondMarks" :key="index" :class="`is-${mark}`">{{ markText(mark) }}</i>
              </span>
              <small>{{ view.exam.stage === 2 ? "1勝で合格" : "一次を通過したら" }}</small>
            </p>
          </div>
          <ShoreikaiNameboard class="shoreikai__board" :columns="view.board" />
        </template>

        <!-- 例会: 名札掛けと、昇級までの残り -->
        <template v-else-if="view.phase === 'reikai'">
          <ShoreikaiNameboard class="shoreikai__board" :columns="view.board" :moved="moved" />
          <div class="shoreikai__progress" data-shoreikai-progress>
            <p class="shoreikai__progress-head">
              <b>{{ view.word }}まで あと{{ view.progress?.winsLeft }}勝</b>
              <small>{{ view.progress?.mark }}{{ view.progress ? `・${view.progress.streakGoal}連勝` : "" }}で{{ view.nextRankLabel }}へ</small>
            </p>
            <p class="shoreikai__pips" :aria-label="`いまの成績 ${view.progress?.record}`">
              <span class="shoreikai__pips-wins">
                <i v-for="index in view.progress?.markWins ?? 0" :key="`w${index}`" :class="{ 'is-on': index <= (view.progress?.wins ?? 0) }">○</i>
              </span>
              <span class="shoreikai__pips-losses">
                <i v-for="index in view.progress?.markLosses ?? 0" :key="`l${index}`" :class="{ 'is-on': index <= (view.progress?.losses ?? 0) }">●</i>
              </span>
              <span class="shoreikai__pips-note">{{ progressNote }}</span>
            </p>
            <p v-if="view.day" class="shoreikai__today" data-shoreikai-today>
              <small>第{{ view.day.no }}回例会</small>
              <i v-for="(result, index) in view.day.results" :key="index" :class="`is-${result}`">{{ markText(result) }}</i>
              <i v-for="index in 2 - view.day.results.length" :key="`n${index}`" class="is-later">・</i>
            </p>
          </div>
          <ul v-if="feed.length" class="shoreikai__feed" aria-label="奨励会の便り" data-shoreikai-feed>
            <li v-for="item in feed" :key="`${item.month}-${item.text}`" :class="`is-${item.tone}`">{{ item.text }}</li>
          </ul>
        </template>

        <!-- 三段リーグ -->
        <template v-else-if="view.phase === 'league' && view.league">
          <div class="shogi-tournament__stagehead">
            <h2>第{{ view.league.term }}期 三段リーグ</h2>
            <p>{{ view.league.rounds }}局。上位{{ view.league.promote }}名が四段。{{ view.league.promote + 1 }}位は次点（2回で四段）</p>
          </div>
          <p :class="['meijin__outlook', `meijin__outlook--${view.league.outlook}`]" data-shoreikai-outlook>
            <b>{{ OUTLOOK_TAG[view.league.outlook] ?? "" }}</b>{{ outlookText }}
          </p>
          <div class="shoreikai__table">
          <MeijinLeagueTable
            :rows="view.league.rows"
            :rounds="view.league.rounds"
            :current-round="view.league.round"
            :lines="{ promote: view.league.promote, point: 0, relegate: 0 }"
            :you-name="playerName"
            promote-text="ここまで 四段"
            jiten-text="ここまで 次点"
          />
          </div>
        </template>
      </section>

      <section
        v-if="view.pending"
        :class="['shogi-tournament__hud', { 'shogi-tournament__hud--boss': view.pending.stakes.boss }]"
        aria-label="次の対局"
        data-pending
        data-shoreikai-pending
      >
        <div class="shogi-tournament__hud-head">
          <button type="button" class="shogi-tournament__hud-face" :aria-label="`${opponent?.name}のくわしい情報`" data-shoreikai-opponent @click="detailOpen = true">
            <img v-if="opponentSprite" :src="opponentSprite" alt="" draggable="false">
            <span v-else :class="`shogi-tournament__hud-face--${opponentTone}`">{{ opponent?.name.slice(0, 1) }}</span>
          </button>
          <div class="shogi-tournament__hud-info">
            <p class="shogi-tournament__hud-role">
              <span v-if="view.pending.stakes.boss" class="shogi-tournament__boss-tag">山場</span>
              <span v-if="opponent?.story === 'hanane'" class="shogi-tournament__rival-tag">ライバル</span>
              <span v-else-if="opponent?.peer" class="shogi-tournament__rival-tag shoreikai__peer-tag">同期</span>
              {{ view.pending.label }}
            </p>
            <p class="shogi-tournament__hud-name">{{ opponent?.name }} <small>{{ opponent?.dan }}・{{ opponent?.age }}歳</small></p>
            <p class="shogi-tournament__hud-chips">
              <span class="shogi-tournament__chip">Lv.{{ opponent?.level }}</span>
              <span v-if="favorite" class="shogi-tournament__chip shogi-tournament__chip--opening">{{ favorite }}</span>
              <span class="shogi-tournament__chip">{{ view.pending.color === "black" ? "あなたが先手" : "あなたが後手" }}</span>
            </p>
          </div>
        </div>
        <p class="shoreikai__stakes" data-shoreikai-stakes>
          <b v-if="view.pending.stakes.win">勝てば {{ view.pending.stakes.win }}</b>
          <span v-else>{{ view.pending.stakes.goal }}</span>
          <small>{{ view.pending.stakes.text }}</small>
        </p>
        <button v-if="ability" type="button" class="shogi-tournament__hud-ability" :aria-label="`${opponent?.name}の能力。押すとくわしく`" data-shoreikai-ability @click="detailOpen = true">
          <RadarChart class="shogi-tournament__mini-radar" :axes="radarAxes" bare aria-hidden="true" />
          <ul class="shogi-tournament__mini-ranks" aria-hidden="true">
            <li v-for="item in ability.abilities" :key="item.key">
              <span>{{ item.label }}</span>
              <b :class="['player-ability__rank', `player-ability__rank--${item.rank}`]">{{ item.rank }}</b>
            </li>
          </ul>
          <span class="shogi-tournament__mini-specials">
            <span
              v-for="chip in ability.specials.slice(0, 3)"
              :key="chip.id"
              :class="['player-ability__chip', `player-ability__chip--${chip.tier}`]"
            >{{ SPECIAL_MARK[chip.tier] }}{{ chip.label }}</span>
            <span class="shogi-tournament__mini-more">くわしく ›</span>
          </span>
        </button>
        <p class="shogi-tournament__tip-line shoreikai__tip" data-shoreikai-tip>
          <img class="shogi-tournament__tip-face" :src="talkFace" alt="" draggable="false">
          <span class="shogi-tournament__tip-text">{{ talkLine }}</span>
        </p>
        <button v-if="suspendedMoves !== null" type="button" class="shogi-tournament__start shogi-tournament__start--resume" data-shoreikai-resume @click="emit('resume')">
          対局を再開<small>中断した対局（{{ suspendedMoves }}手目まで）</small>
        </button>
        <button v-else type="button" class="shogi-tournament__start" data-shoreikai-play @click="versusOpen = true">対局する</button>
      </section>

      <RyuoVersus
        v-if="versusOpen && view.pending"
        :asset-base-url="assetBaseUrl"
        :label="view.pending.label"
        :you="view.pending.color === 'white' ? 'white' : 'black'"
        :rating-text="ratingText"
        :you-name="playerName"
        :opponent="versusOpponent"
        :win="view.pending.stakes.win ? `勝てば ${view.pending.stakes.win}` : view.pending.stakes.goal"
        :boss="view.pending.stakes.boss"
        @done="startPlay"
      />
      <div v-if="detailOpen && opponent" class="shogi-tournament__sheet" role="dialog" aria-modal="true" aria-label="相手のくわしい情報" @click.self="detailOpen = false">
        <div class="shogi-tournament__sheet-panel shogi-tournament__detail">
          <h2>{{ opponent.name }} <small>{{ opponent.dan }}・{{ opponent.age }}歳</small></h2>
          <PlayerAbilityPanel v-if="ability" :view="ability" />
          <button type="button" class="shogi-tournament__sub shogi-tournament__sheet-close" @click="detailOpen = false">閉じる</button>
        </div>
      </div>
    </div>

    <!-- 不合格・退会・四段 -->
    <div v-else-if="view" class="shogi-tournament__stage shogi-tournament__stage--entry shoreikai__framed" :data-shoreikai-screen="view.phase">
      <header class="shogi-tournament__topbar shoreikai__topbar">
        <button type="button" class="shogi-tournament__topbar-back" :aria-label="backLabel" data-shoreikai-back @click="emit('back')">
          <span aria-hidden="true">←</span><span class="shogi-tournament__topbar-back-text">{{ backLabel }}</span>
        </button>
        <span class="shogi-tournament__seal" aria-hidden="true">奨</span>
        <div class="shogi-tournament__topbar-title">
          <h1 id="shogi-tournament-title">奨励会</h1>
          <p class="shogi-tournament__topbar-sub">{{ endSub }}</p>
        </div>
      </header>
      <div class="shogi-tournament__mapwrap shoreikai__mapwrap">
        <div v-if="view.phase === 'pro'" class="shoreikai__menjo" data-shoreikai-menjo>
          <span class="shoreikai__menjo-seal" aria-hidden="true">四段</span>
          <strong>四段昇段</strong>
          <span>棋士番号 第{{ view.kishiNumber }}号</span>
          <small>{{ view.games }}局 {{ view.wins }}勝{{ view.losses }}敗・最長{{ view.bestStreak }}連勝</small>
        </div>
        <ShoreikaiNameboard v-else class="shoreikai__board shoreikai__board--end" :columns="view.board" />
      </div>
      <section class="shogi-tournament__hud" aria-label="結果" data-shoreikai-end>
        <p class="meijin__stamp" :class="view.phase === 'pro' ? 'meijin__stamp--promote' : ''" data-shoreikai-stamp>{{ endStamp }}</p>
        <p class="shogi-tournament__hud-name">{{ endHeadline }}</p>
        <p v-if="mentorText" class="shoreikai__quote" data-shoreikai-mentor><b>師匠 {{ view.mentor?.name }}{{ view.mentor?.dan }}</b>「{{ mentorText }}」</p>
        <p v-if="view.phase === 'pro'" class="shoreikai__quote shoreikai__quote--rival" data-shoreikai-hanane><b>天鷺羽音 四段</b>「{{ HANANE_SHOREIKAI_LINES.pro }}」</p>
        <template v-if="view.phase === 'failed'">
          <p class="shogi-tournament__tip-line shoreikai__tip">
            <img class="shogi-tournament__tip-face" :src="charaUrl" alt="" draggable="false">
            <span class="shogi-tournament__tip-text">惜しかったね。すぐに受け直せるよ。研修会でA2に上がれば、試験なしで6級に編入する道もあるよ</span>
          </p>
          <button type="button" class="shogi-tournament__start" data-shoreikai-retry @click="emit('retry', view.exam?.rank ?? 0)">{{ view.rankLabel }}で受け直す</button>
          <div class="shoreikai__next">
            <button v-if="(view.exam?.rank ?? 0) > 0" type="button" class="shogi-tournament__sub" data-shoreikai-retry-lower @click="emit('retry', (view.exam?.rank ?? 1) - 1)">{{ lowerRankLabel }}で受け直す</button>
            <button type="button" class="shogi-tournament__sub" data-shoreikai-go="kenshukai" @click="emit('go', 'kenshukai')">研修会へ</button>
          </div>
        </template>
        <template v-else-if="view.phase === 'pro'">
          <button type="button" class="shogi-tournament__start" data-shoreikai-ceremony @click="emit('ceremony')">免状を受け取る</button>
          <div class="shoreikai__next">
            <button type="button" class="shogi-tournament__sub" data-shoreikai-go="ryuo" @click="emit('go', 'ryuo')">竜王戦へ</button>
            <button type="button" class="shogi-tournament__sub" data-shoreikai-go="meijin" @click="emit('go', 'meijin')">名人戦へ</button>
          </div>
        </template>
        <template v-else>
          <p class="shogi-tournament__tip-line shoreikai__tip">
            <img class="shogi-tournament__tip-face" :src="charaUrl" alt="" draggable="false">
            <span class="shogi-tournament__tip-text">ここまで、本当によく頑張ったね。指した将棋は、ぜんぶあなたの力になってるよ</span>
          </p>
          <button type="button" class="shogi-tournament__start" data-shoreikai-again @click="emit('close-run')">もう一度、受験から</button>
        </template>
      </section>
    </div>

    <!-- 対局から戻ったときの判子(昇級・合格・三段・降級点など)。押すと閉じ、操作は止めない。 -->
    <button
      v-if="stamp && stampOpen && !revealOpen"
      type="button"
      :class="['shogi-tournament__milestone', `shogi-tournament__milestone--${stamp.weight}`, { 'shoreikai__stamp--soft': stamp.tone === 'soft' }]"
      role="status"
      aria-live="polite"
      data-shoreikai-event
      @click="stampOpen = false"
    >
      <span class="shogi-tournament__milestone-seal" aria-hidden="true">{{ stamp.seal }}</span>
      <span class="shogi-tournament__milestone-text">
        <strong>{{ stamp.title }}</strong>
        <small>{{ stamp.sub }}</small>
      </span>
    </button>

    <!--
      三段リーグ最終日の結果発表(13章)。四段を争った人の最終日の結果を1人ずつ明かし、最後に四段が決まる。押すと全部出す。
    -->
    <div v-if="revealOpen && view?.lastTerm" class="shogi-tournament__sheet shoreikai__reveal" role="dialog" aria-modal="true" aria-label="三段リーグ最終日の結果" data-shoreikai-reveal @click="revealAll">
      <div class="shogi-tournament__sheet-panel shoreikai__reveal-panel">
        <h2>第{{ view.lastTerm.term }}期 三段リーグ 最終日</h2>
        <ol class="shoreikai__reveal-list">
          <li
            v-for="(row, index) in revealRows"
            :key="row.id"
            :class="{ 'is-shown': index < revealStep, 'is-you': row.you, 'is-pro': row.promoted && index < revealStep }"
            data-shoreikai-reveal-row
          >
            <span class="shoreikai__reveal-name">{{ row.you ? playerName : row.name }}</span>
            <span class="shoreikai__reveal-before">{{ row.before }}勝</span>
            <span class="shoreikai__reveal-last">
              <i v-for="(result, at) in row.last" :key="at" :class="`is-${result}`">{{ index < revealStep ? markText(result) : "？" }}</i>
            </span>
            <span class="shoreikai__reveal-total">{{ index < revealStep ? `${row.wins}勝${row.losses}敗` : "" }}</span>
            <b v-if="index < revealStep && row.promoted" class="shoreikai__reveal-tag">四段</b>
            <b v-else-if="index < revealStep && row.jiten" class="shoreikai__reveal-tag shoreikai__reveal-tag--jiten">次点</b>
          </li>
        </ol>
        <p v-if="revealDone" class="shoreikai__reveal-result" data-shoreikai-reveal-result>{{ revealResult }}</p>
        <button v-if="revealDone" type="button" class="shogi-tournament__start" data-shoreikai-reveal-close @click.stop="closeReveal">{{ view.lastTerm.promoted ? "四段の式へ" : "次の期へ" }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, type PropType } from "vue";
import ShoreikaiNameboard, { type NameboardColumn } from "./ShoreikaiNameboard.vue";
import MeijinLeagueTable from "./MeijinLeagueTable.vue";
import RyuoVersus from "./RyuoVersus.vue";
import PlayerAbilityPanel from "./PlayerAbilityPanel.vue";
import RadarChart from "./RadarChart.vue";
import PregamePicker, { type PickerSection, type PickerValue } from "./PregamePicker.vue";
import { DEFAULT_SETTINGS, EXAM_RANKS, RANKS, SHOREIKAI_SCALES, describeShoreikai, shoreikaiScale } from "./core/shoreikai.mjs";
import { HANANE_SHOREIKAI_LINES, entryTalk, eventStamp, examRankTalk, mentorLine, mentorMoment, pendingTip } from "./core/shoreikai-speech.mjs";
import { DIFFICULTY_LEVELS } from "./core/ryuo.mjs";
import { HANANE_SPRITE } from "./core/ryuo-story.mjs";
import { LEARNING_ASSIST_LIMITS } from "./core/learning-setup.mjs";
import { BYOYOMI_CHOICES, byoyomiLabel, byoyomiSeconds } from "./core/byoyomi.mjs";
import { memberAbilityView } from "./core/ryuo-book.mjs";
import { createMoveSoundPlayer } from "./core/move-sound";

export type ShoreikaiView = NonNullable<ReturnType<typeof describeShoreikai>>;
type Mentor = { id: string; name: string; dan: string; age: number; party: string; partyLabel: string; styleLabel: string; repertoire: string };
type Settings = { difficulty: number; scale: string; ageLimit: boolean; coachLevel: string; hintLimit: number; undoLimit: number; byoyomi: number };
type Career = {
  history: { result: string; kishiNumber: number | null }[]; pro: { kishiNumber: number } | null; settings?: Partial<Settings>;
  /** 研修会でA2以上に上がって得た、6級への編入の資格(docs/kenshukai-design.md)。 */
  transfer?: { from: string; label: string } | null;
};

const props = defineProps({
  view: { type: Object as PropType<ShoreikaiView | null>, default: null },
  career: { type: Object as PropType<Career>, required: true },
  mentors: { type: Array as PropType<Mentor[]>, default: () => [] },
  recommendedRank: { type: Number, default: 0 },
  defaultDifficulty: { type: Number, default: 9 },
  assetBaseUrl: { type: String, default: "." },
  playerName: { type: String, default: "あなた" },
  ratingText: { type: String, default: "" },
  suspendedMoves: { type: Number as PropType<number | null>, default: null },
  /** 対局から戻ってきた(判子と最終日の結果発表を出す)。 */
  fromGame: { type: Boolean, default: false },
  backLabel: { type: String, default: "大会の選択へ" },
});
const emit = defineEmits<{
  enter: [payload: { settings: Settings; examRank: number; mentorId: string; transfer?: boolean }];
  play: [];
  resume: [];
  retry: [rank: number];
  "close-run": [];
  ceremony: [];
  go: [target: "ryuo" | "meijin" | "kenshukai"];
  back: [];
}>();

const charaUrl = computed(() => `${props.assetBaseUrl}/characters/yakobihime-mini.webp?v=4`);
const screen = computed(() => {
  const phase = props.view?.phase;
  if (!phase) return "entry";
  return phase === "exam" || phase === "reikai" || phase === "league" ? "run" : "end";
});
const markText = (mark: string | null) => (mark === "win" ? "○" : mark === "loss" ? "●" : mark === "rest" ? "休" : "");
const OUTLOOK_TAG: Record<string, string> = { clinched: "決定", self: "自力", others: "他力", out: "" };
const SPECIAL_MARK: Record<string, string> = Object.freeze({ gold: "★", blue: "＋", red: "−" });

// ---- 入口と設定
const settingsOpen = ref(false);
const picker = ref("");
const last = props.career.settings ?? {};
const mentorId = ref(props.mentors[0]?.id ?? "");
watch(() => props.mentors, (list) => {
  if (!list.some((item) => item.id === mentorId.value)) mentorId.value = list[0]?.id ?? "";
});
const examRank = ref(props.recommendedRank);
const difficulty = ref(props.defaultDifficulty);
watch(() => props.defaultDifficulty, (next, previous) => {
  if (difficulty.value === previous) difficulty.value = next;
});
const scale = ref(String(last.scale ?? DEFAULT_SETTINGS.scale));
const ageLimit = ref(Boolean(last.ageLimit ?? DEFAULT_SETTINGS.ageLimit));
const coachLevel = ref(String(last.coachLevel ?? DEFAULT_SETTINGS.coachLevel));
const hintLimit = ref(Number(last.hintLimit ?? DEFAULT_SETTINGS.hintLimit));
const undoLimit = ref(Number(last.undoLimit ?? DEFAULT_SETTINGS.undoLimit));
const byoyomi = ref(byoyomiSeconds(last));
const mentor = computed(() => props.mentors.find((item) => item.id === mentorId.value) ?? null);
const COACH_OPTIONS = [
  { value: "off", label: "なし" },
  { value: "encourage", label: "応援のみ" },
  { value: "detailed", label: "詳しい助言" },
];
const assistText = (value: number) => LEARNING_ASSIST_LIMITS.find((item) => item.value === value)?.label ?? String(value);
const settingTopic = ref("intro");
const careerText = computed(() => {
  if (props.career.pro) return `棋士番号${props.career.pro.kishiNumber}号の棋士`;
  const tries = props.career.history.length;
  return tries ? `これまでの挑戦 ${tries}回` : "入会試験から、四段（プロ）へ";
});
/** 研修会からの編入の資格(あれば、入口は受験ではなく編入の形)。 */
const transfer = computed(() => props.career.transfer ?? null);
const entryLine = computed(() => (transfer.value
  ? `${transfer.value.label}からの編入だね。試験なしで6級から！ 師匠を選んでね`
  : entryTalk({ pro: props.career.pro, runs: props.career.history.length })));
const settingTalk = computed(() => {
  if (settingTopic.value === "rank") return examRankTalk(examRank.value, props.recommendedRank);
  if (settingTopic.value === "mentor" && mentor.value) return `${mentor.value.name}${mentor.value.dan}は${mentor.value.partyLabel}。${mentorLine(mentor.value, "enter")}`;
  if (settingTopic.value === "age") return ageLimit.value ? "年齢制限ありだね。21歳までに初段、26歳までに四段。最後のリーグで勝ち越せば延長だよ" : "年齢制限はなし。自分のペースで、四段をめざそう";
  if (settingTopic.value === "scale") return `${shoreikaiScale(scale.value).label}は、${shoreikaiScale(scale.value).note}が目安だよ`;
  return "師匠と受験級を選んでね。受験級は、上の級ほど四段に近いけど、試験の相手が強くなるよ";
});
const settingsSummary = computed(() => [
  transfer.value ? "6級に編入" : `${RANKS[examRank.value]}受験`,
  `難易度${difficulty.value}`,
  shoreikaiScale(scale.value).label,
  ...(ageLimit.value ? ["年齢制限あり"] : []),
].join("・"));
const settingRows = computed(() => [
  { id: "mentor", label: "師匠", value: mentor.value ? `${mentor.value.name}${mentor.value.dan}` : "なし", note: mentor.value ? `${mentor.value.partyLabel}・${mentor.value.age}歳` : "" },
  ...(transfer.value ? [] : [{ id: "rank", label: "受験級", value: RANKS[examRank.value], note: examRank.value === props.recommendedRank ? "おすすめ" : `おすすめは${RANKS[props.recommendedRank]}` }]),
  { id: "difficulty", label: "難易度", value: String(difficulty.value), note: `おすすめ ${props.defaultDifficulty}（勝率6〜8割が目安）` },
  { id: "scale", label: "規模", value: shoreikaiScale(scale.value).label, note: shoreikaiScale(scale.value).note },
  { id: "age", label: "年齢制限", value: ageLimit.value ? "あり" : "なし", note: ageLimit.value ? "21歳までに初段・26歳までに四段" : "" },
  { id: "coach", label: "やこび姫の助言", value: COACH_OPTIONS.find((item) => item.value === coachLevel.value)?.label ?? "", note: "" },
  { id: "assist", label: "閃き・待った", value: `閃き${assistText(hintLimit.value)}・待った${assistText(undoLimit.value)}`, note: "" },
  { id: "byoyomi", label: "秒読みの演出", value: byoyomiLabel(byoyomi.value), note: byoyomi.value ? "0秒になっても負けにはならない" : "" },
]);
const pickerConfig = computed<{ title: string; sections: PickerSection[]; note: string } | null>(() => {
  const single = (title: string, key: string, value: PickerValue, options: { value: PickerValue; label: string; description?: string }[], note = "") => (
    { title, note, sections: [{ key, value, groups: [{ options }] }] }
  );
  switch (picker.value) {
    case "mentor":
      return single("師匠", "mentor", mentorId.value, props.mentors.map((item) => ({
        value: item.id, label: `${item.name} ${item.dan}`, description: `${item.partyLabel}・${item.age}歳・${item.repertoire}`,
      })), "入会には、四段以上の棋士の推薦が要るんだ。師匠は、節目ごとに声をかけてくれるよ。");
    case "rank":
      return single("受験級", "rank", examRank.value, EXAM_RANKS.map((rank) => ({
        value: rank, label: RANKS[rank], description: rank === props.recommendedRank ? "おすすめ" : rank > props.recommendedRank ? "近道・試験の相手が強い" : "じっくり",
      })), "上の級ほど四段に近い。試験の相手は、受験する級の強さだよ。");
    case "difficulty":
      return single("難易度", "difficulty", difficulty.value, Array.from({ length: DIFFICULTY_LEVELS }, (_, index) => ({
        value: index + 1, label: String(index + 1), description: index + 1 === props.defaultDifficulty ? "おすすめ・勝率6〜8割が目安" : "",
      })), "数字が大きいほど、相手が強くなるよ。");
    case "scale":
      return single("規模", "scale", scale.value, SHOREIKAI_SCALES.map((item) => ({ value: item.id, label: item.label, description: item.note })), "昇級の規定と三段リーグの局数が変わるよ。");
    case "age":
      return single("年齢制限", "age", String(ageLimit.value), [{ value: "false", label: "なし" }, { value: "true", label: "あり", description: "21歳までに初段・26歳までに四段" }]);
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
      return single("秒読みの演出", "byoyomi", byoyomi.value, BYOYOMI_CHOICES.map((item) => ({ value: item.value, label: item.label })), "10秒から音で知らせるよ。0秒になっても負けにはならないよ。");
    default:
      return null;
  }
});
function onPick(key: string, value: PickerValue) {
  if (key === "mentor") { mentorId.value = String(value); settingTopic.value = "mentor"; }
  else if (key === "rank") { examRank.value = Number(value); settingTopic.value = "rank"; }
  else if (key === "difficulty") difficulty.value = Number(value);
  else if (key === "scale") { scale.value = String(value); settingTopic.value = "scale"; }
  else if (key === "age") { ageLimit.value = value === "true"; settingTopic.value = "age"; }
  else if (key === "coach") coachLevel.value = String(value);
  else if (key === "hint") hintLimit.value = Number(value);
  else if (key === "undo") undoLimit.value = Number(value);
  else if (key === "byoyomi") byoyomi.value = Number(value);
  if ((pickerConfig.value?.sections.length ?? 0) <= 1) picker.value = "";
}
function enter() {
  settingsOpen.value = false;
  emit("enter", {
    settings: {
      difficulty: difficulty.value, scale: scale.value, ageLimit: ageLimit.value, coachLevel: coachLevel.value,
      hintLimit: hintLimit.value, undoLimit: undoLimit.value, byoyomi: byoyomi.value,
    },
    examRank: transfer.value ? 0 : examRank.value,
    mentorId: mentorId.value,
    transfer: Boolean(transfer.value),
  });
}
/** 入口の名札掛け(飾り)。段級ごとに、規模の人数の名札。 */
const previewColumns = computed<NameboardColumn[]>(() => {
  const size = shoreikaiScale(scale.value);
  return RANKS.slice(0, 9).map((label, rank) => ({
    rank,
    label,
    tags: Array.from({ length: rank === 8 ? size.league.size : size.perRank }, (_, index) => ({ id: `${rank}-${index}`, name: "", you: false, peer: false, rival: rank === 8 && index === 0 })),
  }));
});

// ---- 挑戦中
const runTitle = computed(() => {
  const view = props.view;
  if (!view) return "奨励会";
  if (view.phase === "exam") return "入会試験";
  if (view.phase === "league") return "三段リーグ";
  return `奨励会 ${view.rankLabel}`;
});
const runSub = computed(() => {
  const view = props.view;
  if (!view) return "";
  const age = view.ageLimit ? `・${view.age}歳` : "";
  if (view.phase === "exam" && view.exam) return `${view.rankLabel}・${view.exam.stage === 1 ? `一次 ${view.exam.wins}勝${view.exam.losses}敗` : "二次"}`;
  if (view.phase === "league" && view.league) {
    const me = view.league.rows.find((row) => row.you);
    return `第${view.league.term}期 ${Math.min(view.league.round + 1, view.league.rounds)}/${view.league.rounds}局${me ? `・${me.wins}勝${me.losses}敗・${me.place}位` : ""}${view.jiten ? `・次点${view.jiten}回` : ""}${age}`;
  }
  return `${view.progress?.record ?? ""}${view.point ? "・降級点" : ""}${age}`;
});
const examFirstMarks = computed(() => {
  const exam = props.view?.exam;
  if (!exam) return [];
  return Array.from({ length: 6 }, (_, index) => exam.results[index] ?? (index === exam.results.length && exam.stage === 1 ? "now" : "later"));
});
const examSecondMarks = computed(() => {
  const exam = props.view?.exam;
  if (!exam) return [];
  return Array.from({ length: 3 }, (_, index) => exam.secondResults[index] ?? (index === exam.secondResults.length && exam.stage === 2 ? "now" : "later"));
});
const progressNote = computed(() => {
  const progress = props.view?.progress;
  if (!progress) return "";
  const loss = progress.lossesLeft > 0 ? `負けはあと${progress.lossesLeft}つまで` : "もう負けられない";
  return `${progress.record}${progress.streak >= 2 ? `・${progress.streak}連勝中` : ""}・${loss}`;
});
const feed = computed(() => (props.view?.feed ?? []).slice(0, 3));
const outlookText = computed(() => {
  switch (props.view?.league?.outlook) {
    case "clinched": return "四段が決まりました！";
    case "self": return "全部勝てば、自力で四段";
    case "others": return "全部勝って、ほかの結果を待つ";
    default: return "今期は届かない。順位を上げて来期へ";
  }
});
const opponent = computed(() => props.view?.pending?.opponent ?? null);
const ability = computed(() => memberAbilityView(opponent.value));
const radarAxes = computed(() => (ability.value?.abilities ?? []).map(({ key, label, value }) => ({ key, label, value })));
const favorite = computed(() => ability.value?.openings?.[0] ? `${ability.value.openings[0].label} ${ability.value.openings[0].share}%` : opponent.value?.style?.label ?? "");
const opponentTone = computed(() => {
  const attack = opponent.value?.character?.attack ?? 0;
  return attack >= 0.25 ? "attack" : attack <= -0.25 ? "defense" : "balance";
});
const opponentSprite = computed(() => (
  opponent.value?.story === "hanane" ? `${props.assetBaseUrl}/characters/${HANANE_SPRITE.file}?v=${HANANE_SPRITE.version}` : ""
));
/** 次の一局の枠の一言。対局から戻ったときは、師匠が声をかける(昇級・合格・三段リーグ入り)。羽音の便りもここに出す。 */
const talkMentor = computed(() => {
  if (!props.fromGame) return "";
  const moment = mentorMoment(props.view?.events ?? []);
  return moment ? mentorLine(props.view?.mentor ?? null, moment) : "";
});
const hananeTalk = computed(() => {
  const view = props.view;
  if (!view) return "";
  if (view.phase === "league" && view.league?.round === 0 && view.events.some((event) => event.kind === "league-entry")) return HANANE_SHOREIKAI_LINES.league;
  if (view.phase === "reikai" && view.hanane.dan === "三段" && view.games < 4) return HANANE_SHOREIKAI_LINES.first;
  const promoted = view.feed.find((item) => item.tone === "rival");
  if (promoted && view.phase === "reikai" && view.games < 12) return HANANE_SHOREIKAI_LINES.promoted;
  return "";
});
const talkLine = computed(() => {
  if (talkMentor.value) return `師匠「${talkMentor.value}」`;
  if (hananeTalk.value) return `天鷺羽音「${hananeTalk.value}」`;
  return pendingTip(props.view);
});
const talkFace = computed(() => (hananeTalk.value && !talkMentor.value
  ? `${props.assetBaseUrl}/characters/${HANANE_SPRITE.file}?v=${HANANE_SPRITE.version}`
  : charaUrl.value));
const versusOpen = ref(false);
const detailOpen = ref(false);
const versusOpponent = computed(() => ({
  name: opponent.value?.name ?? "", char: opponent.value?.name.slice(0, 1) ?? "", tone: opponentTone.value, sprite: opponentSprite.value,
  dan: opponent.value?.dan ?? "", style: favorite.value.split(" ")[0] ?? "",
  // 羽音は、VS画面だけ立ち絵(全身)。
  portrait: opponentSprite.value ? "neutral" : "",
}));
function startPlay() {
  versusOpen.value = false;
  emit("play");
}

// ---- 対局から戻ったとき(判子・名札の掛け替え・最終日の結果発表)
const sounds = createMoveSoundPlayer(() => props.assetBaseUrl);
const stamp = computed(() => (props.fromGame ? eventStamp(props.view?.events ?? []) : null));
const stampOpen = ref(true);
const moved = computed(() => props.fromGame && (props.view?.events ?? []).some((event) => event.kind === "promote"));
const revealOpen = ref(false);
const revealStep = ref(0);
let revealTimer: ReturnType<typeof setInterval> | undefined;
type RevealRow = { id: string; name: string; you: boolean; before: number; last: string[]; wins: number; losses: number; place: number; promoted: boolean; jiten: boolean };
const revealRows = computed(() => (props.view?.lastTerm?.reveal ?? []) as RevealRow[]);
const revealDone = computed(() => revealStep.value >= revealRows.value.length);
const revealResult = computed(() => {
  const term = props.view?.lastTerm;
  if (!term) return "";
  if (term.promoted) return term.byJiten ? "次点2回で、四段昇段！" : `${term.place}位で、四段昇段！`;
  if (term.jiten) return `次点（${props.view?.jiten}回目）。あと一歩！`;
  return `${term.wins}勝${term.losses}敗・${term.place}位。来期へ！`;
});
const reducedMotion = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
function startReveal() {
  revealOpen.value = true;
  revealStep.value = 0;
  clearInterval(revealTimer);
  if (reducedMotion) {
    revealAll();
    return;
  }
  revealTimer = setInterval(() => {
    revealStep.value += 1;
    if (revealDone.value) clearInterval(revealTimer);
  }, 800);
}
function revealAll() {
  clearInterval(revealTimer);
  revealStep.value = props.view?.lastTerm?.reveal.length ?? 0;
}
function closeReveal() {
  revealOpen.value = false;
}
onMounted(() => {
  if (!props.fromGame) return;
  if (props.view?.termJustEnded) startReveal();
  const current = stamp.value;
  if (current) setTimeout(() => sounds.play(moved.value ? "nameplate" : current.tone === "good" ? "stamp" : "nameplate"), 450);
});
onBeforeUnmount(() => clearInterval(revealTimer));

// ---- 終わり(不合格・退会・四段)
const endSub = computed(() => {
  const view = props.view;
  if (!view) return "";
  if (view.phase === "pro") return `四段昇段・棋士番号${view.kishiNumber}号`;
  if (view.phase === "failed") return `入会試験（${view.rankLabel}）`;
  return `最高 ${RANKS[Math.max(0, Math.min(9, view.rank))]}`;
});
const endStamp = computed(() => ({ pro: "四段昇段", failed: "不合格", retired: "退会" } as Record<string, string>)[props.view?.phase ?? ""] ?? "");
const endHeadline = computed(() => {
  const view = props.view;
  if (!view) return "";
  if (view.phase === "pro") return `${view.games}局を指して、プロ棋士に`;
  if (view.phase === "failed") return `${view.exam?.stage === 2 ? "二次試験" : "一次試験"}で届かなかった`;
  return `${view.games}局 ${view.wins}勝${view.losses}敗`;
});
const mentorText = computed(() => {
  const phase = props.view?.phase;
  if (phase === "pro") return mentorLine(props.view?.mentor ?? null, "pro");
  if (phase === "failed") return mentorLine(props.view?.mentor ?? null, "fail");
  if (phase === "retired") return mentorLine(props.view?.mentor ?? null, "retired");
  return "";
});
const lowerRankLabel = computed(() => RANKS[Math.max(0, (props.view?.exam?.rank ?? 1) - 1)]);

/** 戻る操作。重ねて開いたものを閉じたら真。何も開いていなければ偽(大会の選択へ戻る)。 */
function goBack() {
  if (revealOpen.value) closeReveal();
  else if (picker.value) picker.value = "";
  else if (settingsOpen.value) settingsOpen.value = false;
  else if (detailOpen.value) detailOpen.value = false;
  else if (versusOpen.value) versusOpen.value = false;
  else return false;
  return true;
}
defineExpose({ goBack });
</script>

<style>
.shogi-game .shoreikai { display: contents; }
.shogi-game .shoreikai__tip { cursor: default; }
.shogi-game .shoreikai__topbar .shogi-tournament__topbar-back-text { display: inline; }
.shogi-game .shogi-tournament__stage.shoreikai__framed { grid-template-rows: auto minmax(0, 1fr) auto; grid-template-areas: "top" "map" "hud"; }
.shogi-game .shogi-tournament__stage--shoreikai { grid-template-rows: auto minmax(0, 1fr) auto; grid-template-areas: "top" "map" "hud"; }
/* 入口と終わりの画面: 道場の板(名札掛け)を、夕方の会館の色の上に置く。 */
.shogi-game .shoreikai__mapwrap { display: grid; place-items: center; padding: 0.6rem; container-type: size; background: linear-gradient(180deg, #2b3d58 0%, #3d3a4f 55%, #5a4632 100%); }
.shogi-game .shoreikai__dojo { display: grid; gap: 0.6rem; width: min(100%, 40rem); }
.shogi-game .shoreikai__logo { position: static; justify-self: center; }
.shogi-game .shoreikai__main {
  grid-area: map;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
  min-height: 0;
  padding: 0.6rem;
  overflow-y: auto;
  background: #1e2d3d;
  /* 名札掛けの名札の大きさは、この枠の広さで決める(ShoreikaiNameboard.vueのcqw・cqh)。 */
  container-type: size;
}
.shogi-game .shoreikai__board { flex: none; }
/* 三段リーグの表は、残りの高さいっぱいに(枠が中だけ動く。U:7-5)。中身でつぶれないよう、下限を付ける。 */
.shogi-game .shoreikai__table { display: flex; flex: 1 1 auto; min-height: 12rem; }
.shogi-game .shoreikai__table > .meijin-table { flex: 1 1 auto; }
.shogi-game .shoreikai__main:has(.shoreikai__table) { overflow: hidden; }
.shogi-game .shoreikai__board--end { width: min(100%, 40rem); }
.shogi-game .shoreikai__exam { display: grid; gap: 0.4rem; }
.shogi-game .shoreikai__exam-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  align-items: center;
  margin: 0;
  padding: 0.45rem 0.7rem;
  border-radius: 0.5rem;
  background: #172632;
  color: #fffcf4;
  font-weight: 800;
}
.shogi-game .shoreikai__exam-row.is-current { box-shadow: inset 0 0 0 2px #f1a54c; }
.shogi-game .shoreikai__exam-row.is-later { opacity: 0.6; }
.shogi-game .shoreikai__exam-row small { color: #9fb3c8; }
.shogi-game .shoreikai__marks { display: inline-flex; gap: 0.25rem; }
.shogi-game .shoreikai__marks i,
.shogi-game .shoreikai__today i {
  display: inline-grid;
  place-items: center;
  width: 1.6em;
  height: 1.6em;
  border-radius: 0.3em;
  background: rgba(159, 179, 200, 0.12);
  font-style: normal;
  font-weight: 900;
}
.shogi-game .shoreikai__marks .is-win,
.shogi-game .shoreikai__today .is-win { color: #172632; background: #f1a54c; }
.shogi-game .shoreikai__marks .is-loss,
.shogi-game .shoreikai__today .is-loss { color: #fffcf4; background: #5d6f80; }
.shogi-game .shoreikai__marks .is-now { box-shadow: inset 0 0 0 2px #f1a54c; }
.shogi-game .shoreikai__progress {
  display: grid;
  gap: 0.3rem;
  padding: 0.5rem 0.7rem;
  border-radius: 0.5rem;
  background: #172632;
  color: #fffcf4;
}
.shogi-game .shoreikai__progress p { margin: 0; }
.shogi-game .shoreikai__progress-head { display: flex; flex-wrap: wrap; gap: 0.2rem 0.6rem; align-items: baseline; }
.shogi-game .shoreikai__progress-head b { color: #f1a54c; font-size: 1.15em; }
.shogi-game .shoreikai__progress-head small { color: #9fb3c8; }
.shogi-game .shoreikai__pips { display: flex; flex-wrap: wrap; gap: 0.3rem 0.8rem; align-items: center; }
.shogi-game .shoreikai__pips i { font-style: normal; font-weight: 900; color: rgba(159, 179, 200, 0.35); }
.shogi-game .shoreikai__pips-wins i.is-on { color: #f1a54c; }
.shogi-game .shoreikai__pips-losses i.is-on { color: #e0745e; }
.shogi-game .shoreikai__pips-note { color: #9fb3c8; font-size: 0.82em; }
.shogi-game .shoreikai__today { display: flex; gap: 0.3rem; align-items: center; }
.shogi-game .shoreikai__today small { margin-right: 0.2rem; color: #9fb3c8; }
.shogi-game .shoreikai__feed { display: grid; gap: 0.2rem; margin: 0; padding: 0; list-style: none; color: #d7dfe8; font-size: 0.82em; }
.shogi-game .shoreikai__feed li { padding: 0.2rem 0.5rem; border-left: 3px solid #5d6f80; }
.shogi-game .shoreikai__feed .is-rival { border-color: #e6c15c; color: #ffe39a; }
.shogi-game .shoreikai__feed .is-peer { border-color: #3d6fa5; }
.shogi-game .shoreikai__peer-tag { background: #3d6fa5 !important; color: #fffcf4 !important; }
.shogi-game .shoreikai__stakes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.15rem 0.6rem;
  align-items: baseline;
  margin: 0;
  color: #fffcf4;
  font-weight: 800;
}
.shogi-game .shoreikai__stakes b { color: #ffb08e; }
.shogi-game .shoreikai__stakes small { color: #9fb3c8; font-weight: 700; }
.shogi-game .shoreikai__quote { margin: 0; color: #fffcf4; font-size: 0.9em; line-height: 1.5; }
.shogi-game .shoreikai__quote b { display: block; color: #9fb3c8; font-size: 0.85em; }
.shogi-game .shoreikai__quote--rival b { color: #e6c15c; }
.shogi-game .shoreikai__next { display: flex; gap: 0.5rem; }
.shogi-game .shoreikai__next button,
.shogi-game .shoreikai__wide { flex: 1 1 0; min-height: 44px; }
/* 四段の免状(画面の上の飾り。本物の免状は「免状を受け取る」で賞状帳に)。 */
.shogi-game .shoreikai__menjo {
  display: grid;
  gap: 0.35rem;
  justify-items: center;
  padding: 1.2rem 2rem;
  border: 6px double #c9962e;
  border-radius: 0.3rem;
  background: #fbf6e6;
  color: #2a2016;
  box-shadow: 0 10px 0 rgba(0, 0, 0, 0.35);
  font-family: "Yu Mincho", "YuMincho", "Hiragino Mincho ProN", "Noto Serif JP", serif;
}
.shogi-game .shoreikai__menjo strong { font-size: 2rem; letter-spacing: 0.2em; }
.shogi-game .shoreikai__menjo span { font-weight: 800; }
.shogi-game .shoreikai__menjo small { color: #6b5a3a; }
.shogi-game .shoreikai__menjo-seal {
  display: grid;
  place-items: center;
  width: 3.2rem;
  height: 3.2rem;
  border: 3px solid #c4604c;
  border-radius: 0.3rem;
  color: #c4604c;
  font-weight: 900;
  rotate: -6deg;
}
.shogi-game .shoreikai__stamp--soft .shogi-tournament__milestone-seal { background: #5d6f80; }
/* 最終日の結果発表。 */
.shogi-game .shoreikai__reveal { cursor: pointer; }
.shogi-game .shoreikai__reveal-panel {
  display: grid;
  gap: 0.6rem;
  width: min(30rem, 100%);
  padding: 1rem;
  border: 2px solid #c9962e;
  border-radius: 0.6rem;
  background: #1e2d3d;
  color: #fffcf4;
}
.shogi-game .shoreikai__reveal-panel h2 { margin: 0; }
.shogi-game .shoreikai__reveal-list { display: grid; gap: 0.3rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .shoreikai__reveal-list li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto 4.6em 2.6em;
  gap: 0.5rem;
  align-items: center;
  padding: 0.35rem 0.5rem;
  border-radius: 0.4rem;
  background: rgba(159, 179, 200, 0.1);
  font-weight: 800;
}
.shogi-game .shoreikai__reveal-list li.is-you { box-shadow: inset 0 0 0 2px #f1a54c; }
.shogi-game .shoreikai__reveal-list li.is-pro { background: rgba(196, 96, 76, 0.35); }
.shogi-game .shoreikai__reveal-list li.is-shown .shoreikai__reveal-last i { animation: shoreikai-flip 0.3s ease-out 1; }
.shogi-game .shoreikai__reveal-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.shogi-game .shoreikai__reveal-before,
.shogi-game .shoreikai__reveal-total { color: #9fb3c8; font-variant-numeric: tabular-nums; }
.shogi-game .shoreikai__reveal-last { display: inline-flex; gap: 0.2rem; }
.shogi-game .shoreikai__reveal-last i { display: inline-grid; place-items: center; width: 1.5em; height: 1.5em; border-radius: 0.3em; background: #0f1828; font-style: normal; }
.shogi-game .shoreikai__reveal-last .is-win { color: #f1a54c; }
.shogi-game .shoreikai__reveal-tag { padding: 0.05rem 0.3rem; border-radius: 0.3rem; color: #fffcf4; background: #c4604c; font-size: 0.8em; text-align: center; }
.shogi-game .shoreikai__reveal-tag--jiten { background: #5d6f80; }
.shogi-game .shoreikai__reveal-result { margin: 0; color: #ffd27a; font-size: 1.3em; font-weight: 900; text-align: center; }
@keyframes shoreikai-flip {
  0% { transform: rotateX(90deg); }
  100% { transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .shogi-game .shoreikai__reveal-list li.is-shown .shoreikai__reveal-last i { animation: none; }
}
/* 竜王戦の広い画面の配置(地図・表・枠の3行)は使わない。名人戦と同じ2行。 */
@media (min-width: 1200px) and (min-aspect-ratio: 4/3) {
  .shogi-game .shogi-tournament__stage.shogi-tournament__stage--shoreikai:not(.shogi-tournament__stage--entry):not(.shogi-tournament__stage--result) {
    grid-template-rows: auto minmax(0, 1fr);
    grid-template-areas: "top top" "map hud";
  }
}
@media (min-width: 900px), (orientation: landscape) and (max-height: 600px) {
  .shogi-game .shogi-tournament__stage--shoreikai { grid-template-rows: auto minmax(0, 1fr); grid-template-areas: "top top" "map hud"; }
  .shogi-game .shogi-tournament__stage.shoreikai__framed { grid-template-rows: auto minmax(0, 1fr); grid-template-areas: "top top" "map hud"; }
}
</style>
