<template>
  <!--
    名人戦(順位戦から名人へ。docs/meijin-design.mdの7章)。大会の画面(ShogiTournament.vue)の中に出し、竜王戦と同じ部品の見た目を使う。
    入口: 五重塔と、この期の目標・設定・「出場する」。期の画面: 上の帯、リーグ表(名人戦七番勝負の間は番勝負)、次の一局の枠。結果: 判子と次の期へ。
  -->
  <div class="meijin" data-meijin>
    <!-- 入口 -->
    <div v-if="screen === 'entry'" class="shogi-tournament__stage shogi-tournament__stage--entry meijin__framed" data-meijin-screen="entry">
      <header class="shogi-tournament__topbar meijin__topbar">
        <button type="button" class="shogi-tournament__topbar-back" :aria-label="backLabel" data-meijin-back @click="topBack">
          <span aria-hidden="true">←</span><span class="shogi-tournament__topbar-back-text">{{ backLabel }}</span>
        </button>
        <span class="shogi-tournament__seal" aria-hidden="true">名</span>
        <div class="shogi-tournament__topbar-title">
          <h1 id="shogi-tournament-title">名人戦</h1>
          <p class="shogi-tournament__topbar-sub">{{ career.no ? careerText : "順位戦から名人へ" }}</p>
        </div>
      </header>
      <div class="shogi-tournament__mapwrap">
        <MeijinPagoda :current="entryClass" :holder-name="holderName" :headroom="110" />
        <div class="shogi-tournament__logo" data-meijin-logo>
          <span class="shogi-tournament__seal" aria-hidden="true">名</span>
          <strong>名人戦</strong>
          <span class="shogi-tournament__logo-no">第{{ inProgress ? view?.no : entryNo }}期 順位戦から名人へ</span>
        </div>
      </div>
      <section class="shogi-tournament__hud" aria-label="エントリー">
        <template v-if="inProgress">
          <p class="shogi-tournament__hud-role">進行中の順位戦</p>
          <p class="shogi-tournament__hud-name">{{ view?.title }} <small>{{ seasonSub }}</small></p>
          <button type="button" class="shogi-tournament__start" data-meijin-continue @click="screen = 'season'">続きから参加する</button>
        </template>
        <template v-else>
          <p class="shogi-tournament__goal-box" data-meijin-goal><small>この期の目標</small><span>{{ entryGoal }}</span></p>
          <p class="shogi-tournament__tip-line meijin__tip" data-meijin-talk>
            <img class="shogi-tournament__tip-face" :src="charaUrl" alt="" draggable="false">
            <span class="shogi-tournament__tip-text">{{ entryTalk }}</span>
          </p>
          <div class="shogi-tournament__entry-settings">
            <p><small>設定</small><span data-meijin-summary>{{ settingsSummary }}</span></p>
            <button type="button" class="shogi-tournament__sub" data-meijin-change @click="settingsOpen = true">変える</button>
          </div>
          <button type="button" class="shogi-tournament__start" data-meijin-enter @click="enter">出場する</button>
        </template>
      </section>

      <div v-if="settingsOpen" class="shogi-tournament__sheet" role="dialog" aria-modal="true" aria-label="設定" data-meijin-settings @click.self="settingsOpen = false">
        <div class="shogi-tournament__sheet-panel shogi-tournament__detail">
          <h2>設定</h2>
          <ul class="shogi-tournament__settings">
            <li v-for="row in settingRows" :key="row.id">
              <button
                type="button"
                class="shogi-tournament__setting"
                :data-meijin-row="row.id"
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

    <!-- 期の画面 -->
    <div v-else-if="screen === 'season' && view" class="shogi-tournament__stage shogi-tournament__stage--meijin" data-meijin-screen="season">
      <header class="shogi-tournament__topbar meijin__topbar">
        <button type="button" class="shogi-tournament__topbar-back" :aria-label="backLabel" data-meijin-back @click="topBack">
          <span aria-hidden="true">←</span><span class="shogi-tournament__topbar-back-text">{{ backLabel }}</span>
        </button>
        <span class="shogi-tournament__seal" aria-hidden="true">名</span>
        <div class="shogi-tournament__topbar-title">
          <h1 id="shogi-tournament-title">{{ view.title }}</h1>
          <p class="shogi-tournament__topbar-sub">{{ seasonSub }}</p>
        </div>
      </header>

      <section class="meijin__main" :aria-label="showSeries ? '名人戦七番勝負' : `${view.clsLabel}の順位表`">
        <div class="shogi-tournament__stagehead">
          <h2>{{ showSeries ? "名人戦七番勝負" : `${view.clsLabel} 順位戦` }}</h2>
          <p data-meijin-goal-line>{{ showSeries ? seriesNote : goalLine }}</p>
        </div>
        <p v-if="view.outlook.text && !showSeries" :class="['meijin__outlook', `meijin__outlook--${view.outlook.status}`]" data-meijin-outlook>
          <b>{{ OUTLOOK_TAG[view.outlook.status] ?? "" }}</b>{{ view.outlook.text }}
        </p>
        <p v-if="view.playoff && !showSeries" class="meijin__outlook" data-meijin-playoff>
          <b>プレーオフ</b>{{ view.playoff.names.join(" → ") }}(順位の下から勝ち抜き)
        </p>
        <RyuoSeries
          v-if="showSeries && view.series"
          class="meijin__series"
          :series="[view.series]"
          :holder="view.holder"
          :stages="[]"
          :you-name="playerName"
          :next-color="view.pending?.kind === 'finals' ? view.pending.color : ''"
          :defense="view.mode === 'defense'"
          title-name="名人"
          :journey-steps="journeySteps"
        />
        <MeijinLeagueTable
          v-else
          class="meijin__table"
          :rows="view.rows"
          :rounds="view.rounds"
          :current-round="view.round"
          :lines="view.lines"
          :class-id="view.cls"
          :you-name="playerName"
        />
      </section>

      <section
        v-if="view.pending"
        :class="['shogi-tournament__hud', { 'shogi-tournament__hud--boss': view.pending.stakes.boss }]"
        aria-label="次の対局"
        data-pending
        data-meijin-pending
      >
        <div class="shogi-tournament__hud-head">
          <button type="button" class="shogi-tournament__hud-face" :aria-label="`${view.pending.opponent.name}のくわしい情報`" data-meijin-opponent @click="detailOpen = true">
            <img v-if="opponentSprite" :src="opponentSprite" alt="" draggable="false">
            <span v-else :class="`shogi-tournament__hud-face--${opponentTone}`">{{ view.pending.opponent.name.slice(0, 1) }}</span>
          </button>
          <div class="shogi-tournament__hud-info">
            <p class="shogi-tournament__hud-role">
              <span v-if="view.pending.stakes.boss" class="shogi-tournament__boss-tag">山場</span>
              <span v-if="view.pending.opponent.story === 'hanane'" class="shogi-tournament__rival-tag">ライバル</span>
              {{ view.pending.label }}
            </p>
            <p class="shogi-tournament__hud-name">{{ view.pending.opponent.name }} <small>{{ view.pending.opponent.dan }}</small></p>
            <p class="shogi-tournament__hud-chips">
              <span class="shogi-tournament__chip">Lv.{{ view.pending.opponent.level }}</span>
              <span v-if="favorite" class="shogi-tournament__chip shogi-tournament__chip--opening">{{ favorite }}</span>
              <span v-if="opponentRecord" class="shogi-tournament__chip" data-meijin-opponent-record>{{ opponentRecord }}</span>
              <span class="shogi-tournament__chip">{{ view.pending.color === "black" ? "あなたが先手" : "あなたが後手" }}</span>
            </p>
          </div>
          <div v-if="view.pending.kind === 'finals' && view.series" class="shogi-tournament__hud-score">
            <strong>{{ view.series.wins.me }}<i>-</i>{{ view.series.wins.them }}</strong>
            <small>第{{ view.series.nextNo }}局</small>
          </div>
        </div>
        <!-- 相手の能力(竜王戦の次の一局と同じ形)。押すと、くわしい情報を開く。 -->
        <button v-if="ability" type="button" class="shogi-tournament__hud-ability" :aria-label="`${view.pending.opponent.name}の能力。押すとくわしく`" data-meijin-ability @click="detailOpen = true">
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
        <!-- 広い画面では、空いた高さに相手の得意戦法(使用率)を出す。 -->
        <ul v-if="ability?.openings?.length" class="shogi-tournament__hud-openings" aria-label="相手の得意戦法" data-meijin-openings>
          <li v-for="row in ability.openings.slice(0, 3)" :key="row.id">
            <span>{{ row.label }}</span>
            <span class="shogi-tournament__hud-openings-bar" aria-hidden="true"><span :class="`shogi-tournament__hud-openings-fill--${row.rook}`" :style="{ width: `${Math.max(4, row.share)}%` }" /></span>
            <b>{{ row.share }}%</b>
          </li>
        </ul>
        <p class="shogi-tournament__tip-line meijin__tip" data-meijin-tip>
          <img class="shogi-tournament__tip-face" :src="charaUrl" alt="" draggable="false">
          <span class="shogi-tournament__tip-text">{{ tipLine }}</span>
        </p>
        <button v-if="suspendedMoves !== null" type="button" class="shogi-tournament__start shogi-tournament__start--resume" data-meijin-resume @click="emit('resume')">
          対局を再開<small>中断した対局（{{ suspendedMoves }}手目まで）</small>
        </button>
        <button v-else type="button" class="shogi-tournament__start" data-meijin-play @click="versusOpen = true">{{ playText }}</button>
      </section>
      <section v-else-if="view.result" class="shogi-tournament__hud" aria-label="この期の結果">
        <p class="shogi-tournament__hud-role">この期の対局は、すべて終わりました</p>
        <p class="shogi-tournament__hud-name">{{ resultHeadline }} <small>{{ view.result.wins }}勝{{ view.result.losses }}敗</small></p>
        <button type="button" class="shogi-tournament__start" data-meijin-to-result @click="screen = 'result'">結果を見る</button>
      </section>

      <RyuoVersus
        v-if="versusOpen && view.pending"
        :asset-base-url="assetBaseUrl"
        :label="view.pending.label"
        :you="view.pending.color === 'white' ? 'white' : 'black'"
        :rating-text="ratingText"
        :you-name="playerName"
        :opponent="versusOpponent"
        :win="view.pending.stakes.text"
        :boss="view.pending.stakes.boss"
        @done="startPlay"
      />
      <div v-if="detailOpen && view.pending" class="shogi-tournament__sheet" role="dialog" aria-modal="true" aria-label="相手のくわしい情報" @click.self="detailOpen = false">
        <div class="shogi-tournament__sheet-panel shogi-tournament__detail">
          <h2>{{ view.pending.opponent.name }} <small>{{ view.pending.opponent.dan }}</small></h2>
          <PlayerAbilityPanel v-if="ability" :view="ability" />
          <button type="button" class="shogi-tournament__sub shogi-tournament__sheet-close" @click="detailOpen = false">閉じる</button>
        </div>
      </div>
    </div>

    <!-- 結果 -->
    <div v-else-if="screen === 'result' && view?.result" class="shogi-tournament__stage shogi-tournament__stage--entry meijin__framed" data-meijin-screen="result">
      <header class="shogi-tournament__topbar meijin__topbar">
        <button type="button" class="shogi-tournament__topbar-back" :aria-label="backLabel" data-meijin-back @click="topBack">
          <span aria-hidden="true">←</span><span class="shogi-tournament__topbar-back-text">{{ backLabel }}</span>
        </button>
        <span class="shogi-tournament__seal" aria-hidden="true">名</span>
        <div class="shogi-tournament__topbar-title">
          <h1 id="shogi-tournament-title">名人戦</h1>
          <p class="shogi-tournament__topbar-sub">{{ view.title }}の結果</p>
        </div>
      </header>
      <div class="shogi-tournament__mapwrap">
        <MeijinPagoda :current="entryClass" :holder-name="holderName" :headroom="110" />
        <div class="shogi-tournament__logo">
          <span class="shogi-tournament__seal" aria-hidden="true">名</span>
          <strong>{{ view.title }}</strong>
        </div>
      </div>
      <section class="shogi-tournament__hud" aria-label="この期の結果" data-meijin-result>
        <p class="meijin__stamp" :class="`meijin__stamp--${view.result.outcome}`" data-meijin-stamp>{{ resultHeadline }}</p>
        <p class="shogi-tournament__hud-name">{{ view.clsLabel }} <small>{{ view.result.wins }}勝{{ view.result.losses }}敗{{ view.result.place ? `・${view.result.place}位` : "" }}</small></p>
        <p class="meijin__record" aria-label="今期の成績">
          <i v-for="game in view.userGames" :key="`${game.kind}-${game.round}`" :class="game.win ? 'is-win' : 'is-loss'">{{ game.win ? "○" : "●" }}</i>
        </p>
        <p class="shogi-tournament__goal-box"><small>次の期</small><span>{{ nextText }}</span></p>
        <button type="button" class="shogi-tournament__start" data-meijin-next @click="emit('ceremony')">表彰式へ</button>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, type PropType } from "vue";
import MeijinPagoda from "./MeijinPagoda.vue";
import MeijinLeagueTable, { type LeagueRow } from "./MeijinLeagueTable.vue";
import RyuoSeries, { type SeriesView } from "./RyuoSeries.vue";
import RyuoVersus from "./RyuoVersus.vue";
import PlayerAbilityPanel from "./PlayerAbilityPanel.vue";
import RadarChart from "./RadarChart.vue";
import PregamePicker, { type PickerSection, type PickerValue } from "./PregamePicker.vue";
import { CLASS_LABELS, CLASS_RULES, MEIJIN_OUTCOME_TEXT, MEIJIN_SCALES, meijinGoalLine, meijinScale } from "./core/meijin.mjs";
import { DIFFICULTY_LEVELS } from "./core/ryuo.mjs";
import { HANANE_SPRITE } from "./core/ryuo-story.mjs";
import { LEARNING_ASSIST_LIMITS } from "./core/learning-setup.mjs";
import { memberAbilityView } from "./core/ryuo-book.mjs";

type Brief = { id: string; name: string; dan: string; level: number; story?: string | null; character?: { attack: number } | null; style?: { label?: string } | null; repertoire?: unknown };
type Pending = {
  kind: string; round: number; opponentId: string; color: string; label: string; style: { label?: string } | null;
  opponent: Brief; stakes: { outlook: string; text: string; boss: boolean };
};
export type MeijinView = {
  no: number; title: string; mode: string; cls: string; clsLabel: string; phase: string; round: number; rounds: number;
  lines: { promote: number; point: number; relegate: number }; rows: LeagueRow[];
  me: { wins: number; losses: number; place: number } | null;
  outlook: { status: string; text: string };
  pending: Pending | null; holder: Brief | null;
  playoff: { names: string[] } | null; series: SeriesView | null;
  userGames: { kind: string; round: number; win: boolean }[];
  result: { cls: string; wins: number; losses: number; place: number | null; outcome: string } | null;
  resultSeen: boolean;
  settings: Settings;
};
type Settings = { difficulty: number; scale: string; coachLevel: string; hintLimit: number; undoLimit: number };

const props = defineProps({
  view: { type: Object as PropType<MeijinView | null>, default: null },
  career: { type: Object as PropType<{ no: number; best: string; titles: number; eternal: boolean; history?: unknown[] }>, required: true },
  /** 次の期(か進行中の期)のプレイヤーのクラス。名人ならmeijin。 */
  entryClass: { type: String as PropType<"C2" | "C1" | "B2" | "B1" | "A" | "meijin">, default: "C2" },
  entryNo: { type: Number, default: 1 },
  holderName: { type: String, default: "" },
  defaultDifficulty: { type: Number, default: 9 },
  lastSettings: { type: Object as PropType<Partial<Settings> | null>, default: null },
  assetBaseUrl: { type: String, default: "." },
  playerName: { type: String, default: "あなた" },
  ratingText: { type: String, default: "" },
  suspendedMoves: { type: Number as PropType<number | null>, default: null },
  /** 対局から戻ったとき。進行中の期の画面を直接開く(大会の選択から来たときは、入口の五重塔から)。 */
  openSeason: { type: Boolean, default: false },
});
const emit = defineEmits<{
  enter: [settings: Settings];
  play: [];
  resume: [];
  "result-seen": [];
  back: [];
  /** 結果の「表彰式へ」。賞状は大会の画面が出し、終えたら大会の選択へ。 */
  ceremony: [];
}>();

const charaUrl = computed(() => `${props.assetBaseUrl}/characters/yakobihime-mini.webp?v=4`);
const inProgress = computed(() => Boolean(props.view && !props.view.result));
/**
 * 画面は3つで、入口(五重塔)が名人戦の中の起点。期の画面と結果は入口の1つ先で、左上の戻るは入口へ、
 * 入口の戻るは大会の選択へ(どの画面も同じ場所に、行き先を書いた戻るを置く。docs/meijin-design.mdの15章)。
 */
const screen = ref<"entry" | "season" | "result">(
  props.view?.result && !props.view.resultSeen ? "result" : props.openSeason && props.view && !props.view.result ? "season" : "entry",
);
const backLabel = computed(() => (screen.value === "entry" ? "大会の選択へ" : "五重塔へ"));
/** 左上の戻る。入口なら大会の選択へ、ほかは入口へ。 */
function topBack() {
  if (screen.value === "entry") {
    emit("back");
    return;
  }
  if (screen.value === "result") emit("result-seen");
  screen.value = "entry";
}

// ---- 入口と設定
const settingsOpen = ref(false);
const picker = ref("");
const difficulty = ref(props.lastSettings?.difficulty ?? props.defaultDifficulty);
const scale = ref(props.lastSettings?.scale ?? "full");
const coachLevel = ref(props.lastSettings?.coachLevel ?? "detailed");
const hintLimit = ref(props.lastSettings?.hintLimit ?? 3);
const undoLimit = ref(props.lastSettings?.undoLimit ?? 3);
const COACH_OPTIONS = [
  { value: "off", label: "なし" },
  { value: "encourage", label: "応援のみ" },
  { value: "detailed", label: "詳しい助言" },
];
const assistText = (value: number) => LEARNING_ASSIST_LIMITS.find((item) => item.value === value)?.label ?? String(value);
const entryRounds = computed(() => {
  const cls = props.entryClass === "meijin" ? "A" : props.entryClass;
  return meijinScale(scale.value).rounds ?? CLASS_RULES[cls].rounds;
});
const entryGoal = computed(() => meijinGoalLine(props.entryClass === "meijin" ? null : props.entryClass, entryRounds.value));
const entryTalk = computed(() => {
  switch (props.entryClass) {
    case "C2": return "新四段は、C級2組から。同じ勝ち数なら順位が上の人が上になるから、1局も落とせないね。羽音さんも同じクラスだよ";
    case "A": return "A級は10人の総当たり。1位になれば名人への挑戦！ 将棋界でいちばん長い1年だよ";
    case "meijin": return "名人として、A級を勝ち抜いた挑戦者を迎え撃とう";
    default: return `${CLASS_LABELS[props.entryClass]}。1つずつ上がっていけば、いつか名人に届くよ`;
  }
});
const careerText = computed(() => {
  const best = props.career.best === "meijin" ? "名人" : CLASS_LABELS[props.career.best as keyof typeof CLASS_LABELS] ?? "";
  return `参加${props.career.history?.length ?? props.career.no}期・最高 ${best}${props.career.titles ? `・名人${props.career.titles}期` : ""}${props.career.eternal ? "・永世名人" : ""}`;
});
const settingsSummary = computed(() => [
  `難易度 ${difficulty.value}`,
  `規模 ${meijinScale(scale.value).label}`,
  `助言 ${COACH_OPTIONS.find((item) => item.value === coachLevel.value)?.label ?? ""}`,
].join("・"));
const settingRows = computed(() => [
  { id: "difficulty", label: "難易度", value: String(difficulty.value), note: `おすすめ ${props.defaultDifficulty}` },
  { id: "scale", label: "規模", value: meijinScale(scale.value).label, note: `1期 ${entryRounds.value}局` },
  { id: "coach", label: "やこび姫の助言", value: COACH_OPTIONS.find((item) => item.value === coachLevel.value)?.label ?? "", note: "" },
  { id: "assist", label: "閃き・待った", value: `閃き${assistText(hintLimit.value)}・待った${assistText(undoLimit.value)}`, note: "" },
]);
const pickerConfig = computed<{ title: string; sections: PickerSection[]; note: string } | null>(() => {
  const single = (title: string, key: string, value: PickerValue, options: { value: PickerValue; label: string; description?: string }[], note = "") => (
    { title, note, sections: [{ key, value, groups: [{ options }] }] }
  );
  switch (picker.value) {
    case "difficulty":
      return single("難易度", "difficulty", difficulty.value, Array.from({ length: DIFFICULTY_LEVELS }, (_, index) => ({
        value: index + 1, label: String(index + 1), description: index + 1 === props.defaultDifficulty ? "おすすめ" : "",
      })), "数字が大きいほど、相手が強くなるよ。");
    case "scale":
      return single("規模", "scale", scale.value, MEIJIN_SCALES.map((item) => ({
        value: item.id, label: item.label, description: item.rounds ? `1期${item.rounds}局` : "C級10局・B級1組12局・A級9局",
      })), "昇級と降級の人数は変わらないよ。局数が少ないほど、1敗が重くなる。");
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
    default:
      return null;
  }
});
function onPick(key: string, value: PickerValue) {
  if (key === "difficulty") difficulty.value = Number(value);
  else if (key === "scale") scale.value = String(value);
  else if (key === "coach") coachLevel.value = String(value);
  else if (key === "hint") hintLimit.value = Number(value);
  else if (key === "undo") undoLimit.value = Number(value);
  if ((pickerConfig.value?.sections.length ?? 0) <= 1) picker.value = "";
}
function enter() {
  emit("enter", { difficulty: difficulty.value, scale: scale.value, coachLevel: coachLevel.value, hintLimit: hintLimit.value, undoLimit: undoLimit.value });
  settingsOpen.value = false;
  screen.value = "season";
}

// ---- 期の画面
const OUTLOOK_TAG: Record<string, string> = { clinched: "決定", self: "自力", others: "他力", out: "" };
const showSeries = computed(() => Boolean(props.view?.series) && (props.view?.phase === "title" || props.view?.phase === "done"));
const goalLine = computed(() => (props.view ? meijinGoalLine(props.view.cls, props.view.rounds) : ""));
const seasonSub = computed(() => {
  const view = props.view;
  if (!view) return "";
  if (view.mode === "defense") return "名人の防衛戦";
  return `${view.clsLabel} ${Math.min(view.round + (view.pending ? 1 : 0), view.rounds)}/${view.rounds}局${view.me ? `・${view.me.wins}勝${view.me.losses}敗` : ""}`;
});
const seriesNote = computed(() => (props.view?.mode === "defense" ? "A級の1位を迎えて、名人を守ろう。先に4勝で防衛" : "A級1位として、名人に挑む。先に4勝で名人"));
const journeySteps = computed(() => {
  const view = props.view;
  if (!view) return null;
  if (view.mode === "defense") return [{ key: "group", label: "順位戦", record: "—", note: "名人は指さない", state: "watch" }];
  return [{ key: "group", label: "A級順位戦", record: `${view.me?.wins ?? 0}勝${view.me?.losses ?? 0}敗`, note: "1位で挑戦", state: "done" }];
});
const ability = computed(() => memberAbilityView(props.view?.pending?.opponent ?? null));
const radarAxes = computed(() => (ability.value?.abilities ?? []).map(({ key, label, value }) => ({ key, label, value })));
const SPECIAL_MARK: Record<string, string> = Object.freeze({ gold: "★", blue: "＋", red: "−" });
/** 次の相手の今期の成績(リーグ表の行から)。 */
const opponentRecord = computed(() => {
  const row = props.view?.pending?.kind === "league" ? props.view.rows.find((item) => item.next) : null;
  return row ? `今期 ${row.wins}勝${row.losses}敗` : "";
});
const favorite = computed(() => ability.value?.openings?.[0] ? `${ability.value.openings[0].label} ${ability.value.openings[0].share}%` : props.view?.pending?.opponent?.style?.label ?? "");
const opponentTone = computed(() => {
  const attack = props.view?.pending?.opponent?.character?.attack ?? 0;
  return attack >= 0.25 ? "attack" : attack <= -0.25 ? "defense" : "balance";
});
const opponentSprite = computed(() => (
  props.view?.pending?.opponent?.story === "hanane" ? `${props.assetBaseUrl}/characters/${HANANE_SPRITE.file}?v=${HANANE_SPRITE.version}` : ""
));
const tipLine = computed(() => {
  const pending = props.view?.pending;
  if (!pending) return "";
  if (pending.opponent.story === "hanane") return "羽音さんとの一局。昇級争いの大事な相手だよ。序盤でリードを取ろう";
  if (pending.kind === "playoff") return "プレーオフは1局勝負。勝てば名人への挑戦だよ";
  if (pending.kind === "finals") return "名人戦七番勝負。1局ずつ、自分の将棋を指そう";
  const status = props.view?.outlook.status;
  const aim = status === "self" ? "勝ち続ければ、自力で昇級！" : status === "clinched" ? "昇級は決まった。順位を上げて、来期に弾みをつけよう" : status === "out" ? "1局でも多く勝って、来期の順位を上げよう" : "まずは目の前の1勝。ほかの結果は、あとからついてくるよ";
  return `${favorite.value ? `相手の得意は${favorite.value.split(" ")[0]}。` : ""}${aim}`;
});
const playText = computed(() => (props.view?.pending?.kind === "finals" && props.view.series ? `第${props.view.series.nextNo}局を指す` : "対局する"));
const versusOpen = ref(false);
const detailOpen = ref(false);
const versusOpponent = computed(() => {
  const opponent = props.view?.pending?.opponent;
  return {
    name: opponent?.name ?? "", char: opponent?.name.slice(0, 1) ?? "", tone: opponentTone.value, sprite: opponentSprite.value,
    dan: opponent?.dan ?? "", style: favorite.value.split(" ")[0] ?? "",
  };
});
function startPlay() {
  versusOpen.value = false;
  emit("play");
}

// ---- 結果
const resultHeadline = computed(() => MEIJIN_OUTCOME_TEXT[props.view?.result?.outcome as keyof typeof MEIJIN_OUTCOME_TEXT] ?? "");
const nextText = computed(() => {
  if (props.entryClass === "meijin") return "名人として、防衛戦へ";
  return `${CLASS_LABELS[props.entryClass]}で、第${props.entryNo}期の順位戦`;
});

/** 戻る操作。重ねて開いたものを閉じるか、入口へ戻したら真。入口なら偽(大会の選択へ戻る)。 */
function goBack() {
  if (picker.value) picker.value = "";
  else if (settingsOpen.value) settingsOpen.value = false;
  else if (detailOpen.value) detailOpen.value = false;
  else if (versusOpen.value) versusOpen.value = false;
  else if (screen.value !== "entry") topBack();
  else return false;
  return true;
}
defineExpose({ goBack });
</script>

<style>
.shogi-game .meijin { display: contents; }
.shogi-game .meijin__tip { cursor: default; }
/* 上の帯は3つの画面で同じ。戻るは、狭い画面でも行き先の文字を出す(竜王戦の帯より中身が少ない)。 */
.shogi-game .meijin__topbar .shogi-tournament__topbar-back-text { display: inline; }
.shogi-game .shogi-tournament__stage.meijin__framed { grid-template-rows: auto minmax(0, 1fr) auto; grid-template-areas: "top" "map" "hud"; }
/* 期の画面: 上の帯、真ん中にリーグ表(番勝負)、下(横長は右)に次の一局の枠。 */
.shogi-game .shogi-tournament__stage--meijin { grid-template-areas: "top" "map" "hud"; }
.shogi-game .meijin__main {
  grid-area: map;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
  min-height: 0;
  padding: 0.6rem;
  background: #1e2d3d;
}
.shogi-game .meijin__table { flex: 1 1 0; }
.shogi-game .meijin__series { flex: 1 1 0; min-height: 0; overflow-y: auto; }
.shogi-game .meijin__outlook {
  margin: 0;
  padding: 0.35rem 0.6rem;
  border-radius: 0.5rem;
  color: #fffcf4;
  background: #172632;
  font-size: 0.85em;
  font-weight: 800;
}
.shogi-game .meijin__outlook b { margin-right: 0.45rem; padding: 0 0.4rem; border-radius: 0.3rem; color: #172632; background: #9fb3c8; }
.shogi-game .meijin__outlook--self b,
.shogi-game .meijin__outlook--clinched b { background: #f1a54c; }
.shogi-game .meijin__outlook--out b { display: none; }
.shogi-game .meijin__stamp {
  justify-self: start;
  margin: 0;
  padding: 0.2rem 0.9rem;
  border: 3px solid #fffcf4;
  color: #fffcf4;
  background: #5d6f80;
  box-shadow: 3px 3px 0 #0b1320;
  font-size: 1.5em;
  font-weight: 900;
  rotate: -4deg;
}
.shogi-game .meijin__stamp--promote,
.shogi-game .meijin__stamp--meijin,
.shogi-game .meijin__stamp--defend,
.shogi-game .meijin__stamp--challenger { background: #c4604c; }
.shogi-game .meijin__record { display: flex; flex-wrap: wrap; gap: 0.2rem; margin: 0; font-size: 1.1em; font-weight: 900; }
.shogi-game .meijin__record .is-win { color: #f1a54c; }
.shogi-game .meijin__record .is-loss { color: #8094a8; }
@media (min-width: 900px), (orientation: landscape) and (max-height: 600px) {
  .shogi-game .shogi-tournament__stage--meijin { grid-template-areas: "top top" "map hud"; }
  .shogi-game .shogi-tournament__stage.meijin__framed { grid-template-rows: auto minmax(0, 1fr); grid-template-areas: "top top" "map hud"; }
}
@media (min-width: 1200px) and (min-aspect-ratio: 4/3) {
  .shogi-game .shogi-tournament__stage.shogi-tournament__stage--meijin:not(.shogi-tournament__stage--entry):not(.shogi-tournament__stage--result) {
    grid-template-rows: auto minmax(0, 1fr);
    grid-template-areas: "top top" "map hud";
  }
}
</style>
