<template>
  <!--
    研修会(docs/kenshukai-design.md)。大会の画面(ShogiTournament.vue)の中に出し、奨励会(ShogiShoreikai.vue)と同じ部品の見た目を使う。
    入口: 名札掛けと、受験クラス・設定・「受験する」。挑戦中: 上の帯、真ん中(試験の星取り・名札掛けと昇級までの残り)、
    下(横長は右)の次の一局の枠。A2に上がったら編入の札。Sに上がったら頂点の画面(修了証・編入・終える)。
  -->
  <div class="shoreikai kenshukai" data-kenshukai>
    <!-- 入口 -->
    <div v-if="screen === 'entry'" class="shogi-tournament__stage shogi-tournament__stage--entry shoreikai__framed" data-kenshukai-screen="entry">
      <header class="shogi-tournament__topbar shoreikai__topbar">
        <button type="button" class="shogi-tournament__topbar-back" :aria-label="backLabel" data-kenshukai-back @click="emit('back')">
          <span aria-hidden="true">←</span><span class="shogi-tournament__topbar-back-text">{{ backLabel }}</span>
        </button>
        <span class="shogi-tournament__seal" aria-hidden="true">研</span>
        <div class="shogi-tournament__topbar-title">
          <h1 id="shogi-tournament-title">研修会</h1>
          <p class="shogi-tournament__topbar-sub">{{ careerText }}</p>
        </div>
      </header>
      <div class="shogi-tournament__mapwrap shoreikai__mapwrap">
        <div class="shoreikai__dojo">
          <ShoreikaiNameboard :columns="previewColumns" :top-rank="TOP" direction="右ほど上のクラス" preview />
          <div class="shogi-tournament__logo shoreikai__logo">
            <span class="shogi-tournament__seal" aria-hidden="true">研</span>
            <strong>研修会</strong>
            <span class="shogi-tournament__logo-no">F2から、A2・Sクラスへ</span>
          </div>
        </div>
      </div>
      <section class="shogi-tournament__hud" aria-label="受験">
        <p class="shogi-tournament__goal-box" data-kenshukai-goal><small>目標</small><span>クラスを上げて、A2で奨励会への編入の資格を得る</span></p>
        <p class="shogi-tournament__tip-line shoreikai__tip" data-kenshukai-talk>
          <img class="shogi-tournament__tip-face" :src="charaUrl" alt="" draggable="false">
          <span class="shogi-tournament__tip-text">{{ entryLine }}</span>
        </p>
        <div class="shogi-tournament__entry-settings">
          <p>
            <small>受験の設定</small>
            <span data-kenshukai-summary>{{ settingsSummary }}</span>
          </p>
          <button type="button" class="shogi-tournament__sub" data-kenshukai-change @click="settingsOpen = true">変える</button>
        </div>
        <button type="button" class="shogi-tournament__start" data-kenshukai-enter @click="enter">受験する</button>
      </section>

      <div v-if="settingsOpen" class="shogi-tournament__sheet" role="dialog" aria-modal="true" aria-label="受験の設定" data-kenshukai-settings @click.self="settingsOpen = false">
        <div class="shogi-tournament__sheet-panel shogi-tournament__detail">
          <h2>受験の設定</h2>
          <p class="shogi-tournament__tip-line shoreikai__tip">
            <img class="shogi-tournament__tip-face" :src="charaUrl" alt="" draggable="false">
            <span class="shogi-tournament__tip-text">{{ settingTalk }}</span>
          </p>
          <ul class="shogi-tournament__settings">
            <li v-for="row in settingRows" :key="row.id">
              <button
                type="button"
                class="shogi-tournament__setting"
                :data-kenshukai-row="row.id"
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

    <!-- 挑戦中(入会試験・例会) -->
    <div v-else-if="screen === 'run' && view" class="shogi-tournament__stage shogi-tournament__stage--shoreikai" data-kenshukai-screen="run" :data-kenshukai-phase="view.phase">
      <header class="shogi-tournament__topbar shoreikai__topbar">
        <button type="button" class="shogi-tournament__topbar-back" :aria-label="backLabel" data-kenshukai-back @click="emit('back')">
          <span aria-hidden="true">←</span><span class="shogi-tournament__topbar-back-text">{{ backLabel }}</span>
        </button>
        <span class="shogi-tournament__seal" aria-hidden="true">研</span>
        <div class="shogi-tournament__topbar-title">
          <h1 id="shogi-tournament-title">{{ runTitle }}</h1>
          <p class="shogi-tournament__topbar-sub" data-kenshukai-sub>{{ runSub }}</p>
        </div>
      </header>

      <section class="shoreikai__main" :aria-label="runTitle">
        <!-- 入会試験: 4局(実物どおりは8局)の星取り -->
        <template v-if="view.phase === 'exam'">
          <div class="shogi-tournament__stagehead">
            <h2>入会試験（{{ view.exam.label }}受験）</h2>
            <p>{{ view.exam.games }}局の成績で入るクラスが決まる。落ちることはないよ</p>
          </div>
          <div class="shoreikai__exam" data-kenshukai-exam>
            <p class="shoreikai__exam-row is-current">
              <b>試験</b>
              <span class="shoreikai__marks" :aria-label="`入会試験 ${view.exam.wins}勝${view.exam.losses}敗`">
                <i v-for="(mark, index) in examMarks" :key="index" :class="`is-${mark}`">{{ markText(mark) }}</i>
              </span>
            </p>
            <ul class="kenshukai__join" aria-label="入るクラス">
              <li :class="{ 'is-on': view.exam.wins >= view.exam.up }"><b>{{ view.exam.up }}勝以上</b>{{ view.exam.upLabel }}から</li>
              <li :class="{ 'is-on': view.exam.wins >= view.exam.stay && view.exam.wins < view.exam.up }"><b>{{ view.exam.stay }}勝以上</b>{{ view.exam.label }}から</li>
              <li><b>それより下</b>{{ view.exam.downLabel }}から</li>
            </ul>
          </div>
          <ShoreikaiNameboard class="shoreikai__board" :columns="view.board" :top-rank="TOP" direction="右ほど上のクラス" />
        </template>

        <!-- 例会: 編入の札、名札掛けと、昇級までの残り -->
        <template v-else>
          <div v-if="view.qualified" class="kenshukai__transfer" data-kenshukai-transfer>
            <p><b>奨励会6級への編入の資格</b><small>{{ shoreikaiBusy ? "奨励会の挑戦を終えたら、編入できるよ" : "試験なしで6級から。研修会でSクラスを目指してもいい" }}</small></p>
            <button type="button" class="shogi-tournament__sub" :disabled="shoreikaiBusy" data-kenshukai-transfer-go @click="emit('transfer')">編入する</button>
          </div>
          <ShoreikaiNameboard class="shoreikai__board" :columns="view.board" :moved="moved" :top-rank="TOP" direction="右ほど上のクラス" />
          <div class="shoreikai__progress" data-kenshukai-progress>
            <p class="shoreikai__progress-head">
              <b>昇級まで あと{{ view.progress?.winsLeft }}勝</b>
              <small>{{ view.progress?.mark }}{{ view.progress ? `・${view.progress.streakGoal}連勝` : "" }}で{{ view.nextClassLabel }}へ</small>
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
            <p v-if="view.day" class="shoreikai__today kenshukai__today" data-kenshukai-today>
              <small>第{{ view.day.no }}回例会</small>
              <span v-for="(kind, index) in view.day.kinds" :key="index" class="kenshukai__today-slot">
                <i :class="`is-${view.day.results[index] ?? 'later'}`">{{ view.day.results[index] ? markText(view.day.results[index]) : "・" }}</i>
                <small v-if="kind === 'shido'" class="kenshukai__shido-mark">指導</small>
              </span>
            </p>
          </div>
          <ul v-if="feed.length" class="shoreikai__feed" aria-label="研修会の便り" data-kenshukai-feed>
            <li v-for="item in feed" :key="`${item.month}-${item.text}`" :class="`is-${item.tone}`">{{ item.text }}</li>
          </ul>
        </template>
      </section>

      <section
        v-if="view.pending"
        :class="['shogi-tournament__hud', { 'shogi-tournament__hud--boss': view.pending.stakes.boss }]"
        aria-label="次の対局"
        data-pending
        data-kenshukai-pending
      >
        <div class="shogi-tournament__hud-head">
          <button type="button" class="shogi-tournament__hud-face" :aria-label="`${opponent?.name}のくわしい情報`" data-kenshukai-opponent @click="detailOpen = true">
            <span :class="`shogi-tournament__hud-face--${opponentTone}`">{{ opponent?.name.slice(0, 1) }}</span>
          </button>
          <div class="shogi-tournament__hud-info">
            <p class="shogi-tournament__hud-role">
              <span v-if="view.pending.stakes.boss" class="shogi-tournament__boss-tag">山場</span>
              <span v-if="view.pending.kind === 'shido'" class="shogi-tournament__rival-tag kenshukai__shido-tag">指導対局</span>
              <span v-else-if="opponent?.peer" class="shogi-tournament__rival-tag shoreikai__peer-tag">同期</span>
              {{ view.pending.label }}
            </p>
            <p class="shogi-tournament__hud-name">{{ opponent?.name }} <small>{{ opponent?.dan }}・{{ opponent?.age }}歳</small></p>
            <p class="shogi-tournament__hud-chips">
              <span class="shogi-tournament__chip">Lv.{{ opponent?.level }}</span>
              <span v-if="rankTag(opponent?.level ?? NaN, userLevel)" class="shogi-tournament__chip" :class="rankTag(opponent?.level ?? NaN, userLevel) === '格上' ? 'shogi-tournament__chip--rank-up' : 'shogi-tournament__chip--rank-down'" data-rank-tag>{{ rankTag(opponent?.level ?? NaN, userLevel) }}</span>
              <span v-if="view.pending.kind === 'shido'" class="shogi-tournament__chip shogi-tournament__chip--opening" data-kenshukai-handicap>{{ view.pending.handicapLabel }}</span>
              <span v-else-if="favorite" class="shogi-tournament__chip shogi-tournament__chip--opening">{{ favorite }}</span>
              <span class="shogi-tournament__chip">{{ colorText }}</span>
            </p>
          </div>
        </div>
        <p class="shoreikai__stakes" data-kenshukai-stakes>
          <b v-if="view.pending.stakes.win">勝てば {{ view.pending.stakes.win }}</b>
          <span v-else>{{ view.pending.stakes.goal }}</span>
          <small>{{ view.pending.stakes.text }}</small>
        </p>
        <button v-if="ability" type="button" class="shogi-tournament__hud-ability" :aria-label="`${opponent?.name}の能力。押すとくわしく`" data-kenshukai-ability @click="detailOpen = true">
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
        <p class="shogi-tournament__tip-line shoreikai__tip" data-kenshukai-tip>
          <img class="shogi-tournament__tip-face" :src="charaUrl" alt="" draggable="false">
          <span class="shogi-tournament__tip-text">{{ tipLine }}</span>
        </p>
        <button v-if="suspendedMoves !== null" type="button" class="shogi-tournament__start shogi-tournament__start--resume" data-kenshukai-resume @click="emit('resume')">
          対局を再開<small>中断した対局（{{ suspendedMoves }}手目まで）</small>
        </button>
        <button v-else type="button" class="shogi-tournament__start" data-kenshukai-play @click="versusOpen = true">対局する</button>
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

    <!-- Sクラス(研修会の頂点) -->
    <div v-else-if="view" class="shogi-tournament__stage shogi-tournament__stage--entry shoreikai__framed" data-kenshukai-screen="top">
      <header class="shogi-tournament__topbar shoreikai__topbar">
        <button type="button" class="shogi-tournament__topbar-back" :aria-label="backLabel" data-kenshukai-back @click="emit('back')">
          <span aria-hidden="true">←</span><span class="shogi-tournament__topbar-back-text">{{ backLabel }}</span>
        </button>
        <span class="shogi-tournament__seal" aria-hidden="true">研</span>
        <div class="shogi-tournament__topbar-title">
          <h1 id="shogi-tournament-title">研修会</h1>
          <p class="shogi-tournament__topbar-sub">Sクラス・{{ view.games }}局 {{ view.wins }}勝{{ view.losses }}敗</p>
        </div>
      </header>
      <div class="shogi-tournament__mapwrap shoreikai__mapwrap">
        <div class="shoreikai__menjo" data-kenshukai-menjo>
          <span class="shoreikai__menjo-seal" aria-hidden="true">S</span>
          <strong>修了証</strong>
          <span>研修会 Sクラス</span>
          <small>{{ view.entryLabel }}クラスで入会・{{ view.games }}局 {{ view.wins }}勝{{ view.losses }}敗・最長{{ view.bestStreak }}連勝</small>
          <small v-if="view.shido.games">指導対局 {{ view.shido.wins }}勝{{ view.shido.games - view.shido.wins }}敗</small>
        </div>
      </div>
      <section class="shogi-tournament__hud" aria-label="結果" data-kenshukai-end>
        <p class="meijin__stamp meijin__stamp--promote" data-kenshukai-stamp>Sクラス昇級</p>
        <p class="shogi-tournament__hud-name">研修会の頂点に立った</p>
        <p class="shogi-tournament__tip-line shoreikai__tip">
          <img class="shogi-tournament__tip-face" :src="charaUrl" alt="" draggable="false">
          <span class="shogi-tournament__tip-text">{{ topTalk }}</span>
        </p>
        <button type="button" class="shogi-tournament__start" data-kenshukai-ceremony @click="emit('ceremony')">修了証を受け取る</button>
        <div class="shoreikai__next">
          <button type="button" class="shogi-tournament__sub" :disabled="shoreikaiBusy" data-kenshukai-top-transfer @click="emit('transfer')">奨励会へ編入</button>
          <button type="button" class="shogi-tournament__sub" data-kenshukai-close @click="emit('close-run')">研修会を終える</button>
        </div>
      </section>
    </div>

    <!-- 対局から戻ったときの判子(入会・昇級・A2・S・降級点など)。押すと閉じ、操作は止めない。 -->
    <button
      v-if="stamp && stampOpen"
      type="button"
      :class="['shogi-tournament__milestone', `shogi-tournament__milestone--${stamp.weight}`, { 'shoreikai__stamp--soft': stamp.tone === 'soft' }]"
      role="status"
      aria-live="polite"
      data-kenshukai-event
      @click="stampOpen = false"
    >
      <span class="shogi-tournament__milestone-seal" aria-hidden="true">{{ stamp.seal }}</span>
      <span class="shogi-tournament__milestone-text">
        <strong>{{ stamp.title }}</strong>
        <small>{{ stamp.sub }}</small>
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { difficultyName, difficultyOptions, rankTag } from "./core/tournament-world.mjs";
import { computed, onMounted, ref, watch, type PropType } from "vue";
import ShoreikaiNameboard, { type NameboardColumn } from "./ShoreikaiNameboard.vue";
import RyuoVersus from "./RyuoVersus.vue";
import PlayerAbilityPanel from "./PlayerAbilityPanel.vue";
import RadarChart from "./RadarChart.vue";
import PregamePicker, { type PickerSection, type PickerValue } from "./PregamePicker.vue";
import { MEASURE_PICKER_ACTION } from "./core/skill-estimate.mjs";
import { CLASSES, CLASS_RATINGS, DEFAULT_SETTINGS, ENTRY_CLASSES, KENSHUKAI_SCALES, TOP, describeKenshukai, kenshukaiScale } from "./core/kenshukai.mjs";
import { entryClassTalk, entryTalk, eventStamp, pendingTip, transferTalk } from "./core/kenshukai-speech.mjs";
import { LEARNING_ASSIST_LIMITS } from "./core/learning-setup.mjs";
import { BYOYOMI_CHOICES, byoyomiLabel, byoyomiSeconds } from "./core/byoyomi.mjs";
import { memberAbilityView } from "./core/ryuo-book.mjs";
import { createMoveSoundPlayer } from "./core/move-sound";

export type KenshukaiView = NonNullable<ReturnType<typeof describeKenshukai>>;
type Settings = { difficulty: number; scale: string; shido: boolean; coachLevel: string; hintLimit: number; undoLimit: number; byoyomi: number };
type Career = { history: { result: string; best: string }[]; best: number | null; settings?: Partial<Settings> };

const props = defineProps({
  view: { type: Object as PropType<KenshukaiView | null>, default: null },
  career: { type: Object as PropType<Career>, required: true },
  recommendedClass: { type: Number, default: 0 },
  defaultDifficulty: { type: Number, default: 9 },
  /** 世界の物差しが決まっているか(core/tournament-world.mjs)。決まっていれば、defaultDifficultyは「いつもの世界」の番号。 */
  usualWorld: { type: Boolean, default: false },
  /** 保存した世界の物差し(難易度の選択肢の強さの目安に使う)。 */
  world: { type: Object as PropType<{ level: number; difficulty: number; playerLevel: number; at: number } | null>, default: null },
  /** いまの棋力からのおすすめの番号。 */
  recommendedDifficulty: { type: Number as PropType<number | null>, default: null },
  /** プレイヤーの棋力(Lv)。次の相手の「格上」「格下」の札に使う。 */
  userLevel: { type: Number, default: NaN },
  assetBaseUrl: { type: String, default: "." },
  playerName: { type: String, default: "あなた" },
  ratingText: { type: String, default: "" },
  suspendedMoves: { type: Number as PropType<number | null>, default: null },
  /** 対局から戻ってきた(判子を出す)。 */
  fromGame: { type: Boolean, default: false },
  /** 奨励会の挑戦の途中(編入は、それを終えてから)。 */
  shoreikaiBusy: { type: Boolean, default: false },
  /** 奨励会の入会試験に落ちたところから来た(入口の一言を変える)。 */
  shoreikaiFailed: { type: Boolean, default: false },
  backLabel: { type: String, default: "大会の選択へ" },
});
const emit = defineEmits<{
  /** 難易度のシートの「棋力を測る」(docs/first-play-design.mdの13章)。 */
  measure: [];
  enter: [payload: { settings: Settings; entryClass: number }];
  play: [];
  resume: [];
  transfer: [];
  "close-run": [];
  ceremony: [];
  back: [];
}>();

const charaUrl = computed(() => `${props.assetBaseUrl}/characters/yakobihime-mini.webp?v=4`);
const screen = computed(() => {
  const phase = props.view?.phase;
  if (!phase) return "entry";
  return phase === "top" ? "top" : "run";
});
const markText = (mark: string | null) => (mark === "win" ? "○" : mark === "loss" ? "●" : "");
const SPECIAL_MARK: Record<string, string> = Object.freeze({ gold: "★", blue: "＋", red: "−" });

// ---- 入口と設定
const settingsOpen = ref(false);
const picker = ref("");
const last = props.career.settings ?? {};
const entryClass = ref(props.recommendedClass);
const difficulty = ref(props.defaultDifficulty);
watch(() => props.defaultDifficulty, (next, previous) => {
  if (difficulty.value === previous) difficulty.value = next;
});
const scale = ref(String(last.scale ?? DEFAULT_SETTINGS.scale));
const shido = ref(Boolean(last.shido ?? DEFAULT_SETTINGS.shido));
const coachLevel = ref(String(last.coachLevel ?? DEFAULT_SETTINGS.coachLevel));
const hintLimit = ref(Number(last.hintLimit ?? DEFAULT_SETTINGS.hintLimit));
const undoLimit = ref(Number(last.undoLimit ?? DEFAULT_SETTINGS.undoLimit));
const byoyomi = ref(byoyomiSeconds(last));
const COACH_OPTIONS = [
  { value: "off", label: "なし" },
  { value: "encourage", label: "応援のみ" },
  { value: "detailed", label: "詳しい助言" },
];
const assistText = (value: number) => LEARNING_ASSIST_LIMITS.find((item) => item.value === value)?.label ?? String(value);
const settingTopic = ref("intro");
const careerText = computed(() => {
  const best = props.career.best;
  if (best !== null && best !== undefined) return `これまでの最高 ${CLASSES[best]}クラス`;
  return "F2から、A2・Sクラスへ";
});
const entryLine = computed(() => entryTalk({ best: props.career.best ?? null, runs: props.career.history.length, shoreikaiFailed: props.shoreikaiFailed }));
const settingTalk = computed(() => {
  if (settingTopic.value === "class") return entryClassTalk(entryClass.value, props.recommendedClass);
  if (settingTopic.value === "shido") return shido.value ? "2回に1回の例会で、プロの先生と駒落ちで指すよ。勝ち負けも昇級に数えるんだ" : "指導対局はなし。4局とも研修会の子たちと指すよ";
  if (settingTopic.value === "scale") return `${kenshukaiScale(scale.value).label}は、${kenshukaiScale(scale.value).note}が目安だよ`;
  return "受験するクラスを選んでね。上のクラスほどA2に近いけど、試験の相手が強くなるよ";
});
const settingsSummary = computed(() => [
  `${CLASSES[entryClass.value]}受験`,
  `難易度 ${difficultyName(difficulty.value)}`,
  kenshukaiScale(scale.value).label,
  ...(shido.value ? [] : ["指導対局なし"]),
].join("・"));
const settingRows = computed(() => [
  { id: "class", label: "受験クラス", value: CLASSES[entryClass.value], note: entryClass.value === props.recommendedClass ? "おすすめ" : `おすすめは${CLASSES[props.recommendedClass]}` },
  {
    id: "difficulty", label: "難易度", value: difficultyName(difficulty.value),
    note: difficultyChoices.value.find((option) => option.value === difficulty.value)?.description ?? "",
  },
  { id: "scale", label: "規模", value: kenshukaiScale(scale.value).label, note: kenshukaiScale(scale.value).note },
  { id: "shido", label: "指導対局", value: shido.value ? "あり" : "なし", note: shido.value ? "2回に1回の例会で、プロと駒落ち" : "" },
  { id: "coach", label: "やこび姫の助言", value: COACH_OPTIONS.find((item) => item.value === coachLevel.value)?.label ?? "", note: "" },
  { id: "assist", label: "閃き・待った", value: `閃き${assistText(hintLimit.value)}・待った${assistText(undoLimit.value)}`, note: "" },
  { id: "byoyomi", label: "秒読みの演出", value: byoyomiLabel(byoyomi.value), note: byoyomi.value ? "0秒になっても負けにはならない" : "" },
]);
/** 難易度の選択肢(竜王戦と同じ世界。番号ごとにF2とSクラスの段級位。docs/tournament-strength-spread-design.mdの8・9章)。 */
const difficultyChoices = computed(() => difficultyOptions({
  stored: props.world, playerLevel: props.userLevel, base: CLASS_RATINGS[0],
  bottom: { label: "F2", rating: CLASS_RATINGS[0] }, top: { label: "S", rating: CLASS_RATINGS[CLASSES.length - 1] },
  recommended: props.recommendedDifficulty ?? props.defaultDifficulty,
}));
const pickerConfig = computed<{ title: string; sections: PickerSection[]; note: string } | null>(() => {
  const single = (title: string, key: string, value: PickerValue, options: { value: PickerValue; label: string; description?: string }[], note = "") => (
    { title, note, sections: [{ key, value, groups: [{ options }] }] }
  );
  switch (picker.value) {
    case "class":
      return single("受験クラス", "class", entryClass.value, ENTRY_CLASSES.map((cls) => ({
        value: cls, label: CLASSES[cls], description: cls === props.recommendedClass ? "おすすめ" : cls > props.recommendedClass ? "近道・試験の相手が強い" : "じっくり",
      })), "上のクラスほどA2に近い。試験の相手は、受験するクラスの研修会員だよ。");
    case "difficulty":
      return single("難易度", "difficulty", difficulty.value, difficultyChoices.value,
        "数字が大きいほど、相手が強くなるよ。いちばん上の「本物」は、実際の大会と同じ強さ。世界は竜王戦・名人戦と同じだよ。");
    case "scale":
      return single("規模", "scale", scale.value, KENSHUKAI_SCALES.map((item) => ({ value: item.id, label: item.label, description: item.note })), "昇級の規定と入会試験の局数が変わるよ。");
    case "shido":
      return single("指導対局", "shido", String(shido.value), [
        { value: "true", label: "あり", description: "2回に1回の例会の4局目。プロの先生と駒落ち" },
        { value: "false", label: "なし", description: "4局とも研修会員と平手" },
      ]);
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
  if (key === "class") { entryClass.value = Number(value); settingTopic.value = "class"; }
  else if (key === "difficulty") difficulty.value = Number(value);
  else if (key === "scale") { scale.value = String(value); settingTopic.value = "scale"; }
  else if (key === "shido") { shido.value = value === "true"; settingTopic.value = "shido"; }
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
      difficulty: difficulty.value, scale: scale.value, shido: shido.value, coachLevel: coachLevel.value,
      hintLimit: hintLimit.value, undoLimit: undoLimit.value, byoyomi: byoyomi.value,
    },
    entryClass: entryClass.value,
  });
}
/** 入口の名札掛け(飾り)。クラスごとに、規模の人数の名札。 */
const previewColumns = computed<NameboardColumn[]>(() => {
  const size = kenshukaiScale(scale.value);
  return CLASSES.map((label, rank) => ({
    rank,
    label,
    tags: Array.from({ length: rank >= 10 ? Math.max(2, size.perClass - 2) : size.perClass }, (_, index) => ({ id: `${rank}-${index}`, name: "", you: false, peer: false, rival: false })),
  }));
});

// ---- 挑戦中
const runTitle = computed(() => {
  const view = props.view;
  if (!view) return "研修会";
  if (view.phase === "exam") return "入会試験";
  return `研修会 ${view.classLabel}クラス`;
});
const runSub = computed(() => {
  const view = props.view;
  if (!view) return "";
  if (view.phase === "exam") return `${view.exam.label}受験・${view.exam.wins}勝${view.exam.losses}敗`;
  return `${view.progress?.record ?? ""}${view.point ? "・降級点" : ""}${view.qualified ? "・奨励会編入の資格" : ""}`;
});
const examMarks = computed(() => {
  const exam = props.view?.exam;
  if (!exam) return [];
  return Array.from({ length: exam.games }, (_, index) => exam.results[index] ?? (index === exam.results.length ? "now" : "later"));
});
const progressNote = computed(() => {
  const progress = props.view?.progress;
  if (!progress) return "";
  const loss = progress.lossesLeft > 0 ? `負けはあと${progress.lossesLeft}つまで` : "もう負けられない";
  return `${progress.record}${progress.streak >= 2 ? `・${progress.streak}連勝中` : ""}・${loss}`;
});
const feed = computed(() => (props.view?.feed ?? []).slice(0, 3));
const opponent = computed(() => props.view?.pending?.opponent ?? null);
const ability = computed(() => memberAbilityView(opponent.value));
const radarAxes = computed(() => (ability.value?.abilities ?? []).map(({ key, label, value }) => ({ key, label, value })));
const favorite = computed(() => ability.value?.openings?.[0] ? `${ability.value.openings[0].label} ${ability.value.openings[0].share}%` : opponent.value?.style?.label ?? "");
const opponentTone = computed(() => {
  const attack = opponent.value?.character?.attack ?? 0;
  return attack >= 0.25 ? "attack" : attack <= -0.25 ? "defense" : "balance";
});
/** 先後の札。駒落ちは、上手(先生)が先に指す。 */
const colorText = computed(() => {
  const pending = props.view?.pending;
  if (pending?.kind === "shido" && pending.handicap) return "先生が先に指す";
  return pending?.color === "black" ? "あなたが先手" : "あなたが後手";
});
const tipLine = computed(() => pendingTip(props.view));
const versusOpen = ref(false);
const detailOpen = ref(false);
const versusOpponent = computed(() => ({
  name: opponent.value?.name ?? "", char: opponent.value?.name.slice(0, 1) ?? "", tone: opponentTone.value, sprite: "",
  dan: opponent.value?.dan ?? "", style: props.view?.pending?.kind === "shido" ? props.view.pending.handicapLabel : favorite.value.split(" ")[0] ?? "",
}));
function startPlay() {
  versusOpen.value = false;
  emit("play");
}
const topTalk = computed(() => (props.shoreikaiBusy
  ? "Sクラス、研修会のいちばん上だよ！ 奨励会の挑戦を終えたら、編入できるよ"
  : transferTalk(props.view)));

// ---- 対局から戻ったとき(判子・名札の掛け替え)
const sounds = createMoveSoundPlayer(() => props.assetBaseUrl);
const stamp = computed(() => (props.fromGame ? eventStamp(props.view?.events ?? []) : null));
const stampOpen = ref(true);
const moved = computed(() => props.fromGame && (props.view?.events ?? []).some((event) => event.kind === "promote"));
onMounted(() => {
  if (!props.fromGame) return;
  const current = stamp.value;
  if (current) setTimeout(() => sounds.play(moved.value ? "nameplate" : current.tone === "good" ? "stamp" : "nameplate"), 450);
});

/** 戻る操作。重ねて開いたものを閉じたら真。何も開いていなければ偽(大会の選択へ戻る)。 */
function goBack() {
  if (picker.value) picker.value = "";
  else if (settingsOpen.value) settingsOpen.value = false;
  else if (detailOpen.value) detailOpen.value = false;
  else if (versusOpen.value) versusOpen.value = false;
  else return false;
  return true;
}
defineExpose({ goBack });
</script>

<style>
/* 研修会: 奨励会の画面(ShogiShoreikai.vue)の部品をそのまま使い、研修会だけのものを足す。 */
.shogi-game .kenshukai__join { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.3rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .kenshukai__join li {
  display: grid;
  gap: 0.1rem;
  padding: 0.35rem 0.45rem;
  border-radius: 0.4rem;
  background: #172632;
  color: #9fb3c8;
  font-size: 0.82em;
  font-weight: 700;
}
.shogi-game .kenshukai__join li b { color: #fffcf4; }
.shogi-game .kenshukai__join li.is-on { box-shadow: inset 0 0 0 2px #f1a54c; color: #fffcf4; }
.shogi-game .kenshukai__transfer {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 0.8rem;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.7rem;
  border: 2px solid #c9962e;
  border-radius: 0.5rem;
  background: #2a2016;
  color: #fffcf4;
}
.shogi-game .kenshukai__transfer p { display: grid; gap: 0.1rem; margin: 0; }
.shogi-game .kenshukai__transfer b { color: #ffd27a; }
.shogi-game .kenshukai__transfer small { color: #d7c7a6; }
.shogi-game .kenshukai__transfer button { flex: 0 0 auto; width: auto; min-width: 8rem; min-height: 44px; }
.shogi-game .kenshukai__today { flex-wrap: wrap; }
.shogi-game .kenshukai__today-slot { display: inline-flex; gap: 0.15rem; align-items: center; }
.shogi-game .kenshukai__today .is-later { color: #9fb3c8; }
.shogi-game .kenshukai__shido-mark { color: #ffb08e; font-size: 0.75em; font-weight: 800; }
.shogi-game .kenshukai__shido-tag { background: #8e5a2b !important; color: #fffcf4 !important; }
</style>
