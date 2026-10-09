<template>
  <div :class="screen === 'select' ? 'shogi-home shogi-tournament-home' : 'shogi-dex shogi-tournament'" role="dialog" aria-modal="true" aria-labelledby="shogi-tournament-title">
    <!-- 大会の選択: タイトル画面と同じデザイン・ボタンの配置 -->
    <template v-if="screen === 'select'">
      <span v-for="star in HOME_STARS" :key="star.id" class="shogi-home__star" :style="star.style" aria-hidden="true"></span>
      <span class="shogi-home__moon" aria-hidden="true"></span>
      <button type="button" class="shogi-dex__back shogi-tournament__home-back" @click="emit('close')">
        <span aria-hidden="true">←</span> {{ backLabel }}
      </button>
      <div class="shogi-home__hero" data-screen="select">
        <div class="shogi-home__title">
          <h1 id="shogi-tournament-title">大会</h1>
        </div>
        <p class="shogi-home__bubble" aria-hidden="true">どの大会に参加する？</p>
        <img class="shogi-home__chara" :src="charaUrl" alt="" aria-hidden="true">
      </div>
      <nav class="shogi-home__menu" aria-label="大会">
        <section class="shogi-home__group" aria-labelledby="shogi-tournament-titles">
          <h2 id="shogi-tournament-titles" class="shogi-home__group-title">タイトル戦</h2>
          <p class="shogi-home__group-note">予選から勝ち上がって、タイトルを目指そう</p>
          <div class="shogi-home__cards">
            <button type="button" class="shogi-home__card" data-tournament="ryuo" @click="chooseRyuo">
              <svg class="shogi-home__icon" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
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
              <span class="shogi-home__label">竜王戦</span>
              <small class="shogi-home__desc">{{ ryuoCardNote }}</small>
            </button>
            <button v-for="item in COMING_SOON" :key="item.id" type="button" class="shogi-home__card" disabled>
              <svg class="shogi-home__icon" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
                <g fill="#fffcf4">
                  <rect x="3" y="3" width="10" height="1" />
                  <rect x="3" y="7" width="10" height="1" />
                  <rect x="3" y="11" width="10" height="1" />
                  <rect x="3" y="3" width="1" height="9" />
                  <rect x="12" y="3" width="1" height="9" />
                </g>
              </svg>
              <span class="shogi-home__label">{{ item.label }}</span>
              <small class="shogi-home__desc">準備中</small>
            </button>
          </div>
        </section>
        <section class="shogi-home__group" aria-labelledby="shogi-tournament-road">
          <h2 id="shogi-tournament-road" class="shogi-home__group-title">プロへの道</h2>
          <p class="shogi-home__group-note">研修会から奨励会、プロ棋士へ</p>
          <div class="shogi-home__cards">
            <button v-for="item in ROAD" :key="item.id" type="button" class="shogi-home__card" disabled>
              <svg class="shogi-home__icon" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
                <g fill="#f1a54c">
                  <rect x="2" y="11" width="4" height="3" />
                  <rect x="6" y="8" width="4" height="6" />
                  <rect x="10" y="4" width="4" height="10" />
                </g>
              </svg>
              <span class="shogi-home__label">{{ item.label }}</span>
              <small class="shogi-home__desc">準備中</small>
            </button>
          </div>
        </section>
      </nav>
    </template>

    <template v-else>
      <header class="shogi-dex__header">
        <button type="button" class="shogi-dex__back" @click="goBack">
          <span aria-hidden="true">←</span> {{ backText }}
        </button>
        <h1 id="shogi-tournament-title">竜王戦</h1>
      </header>

      <!-- 竜王戦: やこび姫の説明(左)と、エントリー(右) -->
      <div v-if="screen === 'ryuo'" class="shogi-tournament__body shogi-tournament__body--two" data-screen="ryuo">
        <div class="shogi-tournament__col">
          <section class="shogi-tournament__card" aria-labelledby="shogi-ryuo-about" data-guide>
            <h2 id="shogi-ryuo-about">やこび姫の竜王戦ガイド</h2>
            <YakobiSays :lines="guideLines" size="lg" :asset-base-url="assetBaseUrl" />
          </section>
        </div>

        <div class="shogi-tournament__col">
          <section class="shogi-tournament__card" aria-labelledby="shogi-ryuo-status">
            <h2 id="shogi-ryuo-status">あなたの竜王戦</h2>
            <ul class="shogi-tournament__facts" data-ryuo-status>
              <li><span>現在</span><strong>{{ career.champion ? "竜王" : `竜王戦${career.group}組` }}</strong></li>
              <li><span>参加</span><strong>{{ career.seasons }}期</strong></li>
              <li><span>竜王</span><strong>通算{{ career.titles }}期（連続{{ career.streak }}期）</strong></li>
              <li v-if="career.eternal"><span>称号</span><strong>永世竜王</strong></li>
            </ul>
          </section>

          <section v-if="inProgress && !reEntry" class="shogi-tournament__card" aria-labelledby="shogi-ryuo-progress">
            <h2 id="shogi-ryuo-progress">進行中の大会</h2>
            <YakobiSays :lines="[`${view?.title}（${view?.phaseText}）の途中だよ。続きから、いっしょに行こう！`]" size="sm" :asset-base-url="assetBaseUrl" />
            <div class="shogi-tournament__actions">
              <button type="button" class="shogi-tournament__start" data-tournament-continue @click="screen = 'season'">続きから参加する</button>
              <button type="button" class="shogi-tournament__sub" @click="reEntry = true">破棄して、新しくエントリー</button>
            </div>
          </section>

          <section v-else class="shogi-tournament__card" aria-labelledby="shogi-ryuo-entry" data-entry-form>
            <h2 id="shogi-ryuo-entry">エントリー設定</h2>

            <div class="shogi-tournament__field">
              <span id="entry-difficulty">難易度</span>
              <div class="shogi-tournament__choices shogi-tournament__choices--ten" role="radiogroup" aria-labelledby="entry-difficulty">
                <button
                  v-for="level in DIFFICULTY_STEPS"
                  :key="level"
                  type="button"
                  role="radio"
                  :aria-checked="level === difficulty"
                  :class="{ 'shogi-tournament__recommended': level === defaultDifficulty }"
                  @click="difficulty = level"
                >{{ level }}</button>
              </div>
            </div>
            <div class="shogi-tournament__says" data-difficulty-note>
              <YakobiSays :lines="[difficultyLine]" size="sm" :asset-base-url="assetBaseUrl" />
            </div>

            <div class="shogi-tournament__field">
              <span id="entry-scale">規模</span>
              <div class="shogi-tournament__choices shogi-tournament__choices--five" role="radiogroup" aria-labelledby="entry-scale">
                <button
                  v-for="item in SCALES"
                  :key="item.id"
                  type="button"
                  role="radio"
                  :aria-checked="item.id === scale"
                  @click="scale = item.id"
                >{{ item.id }} {{ item.label }}</button>
              </div>
            </div>
            <div class="shogi-tournament__says" data-scale-note>
              <YakobiSays :lines="[scaleLine]" size="sm" :asset-base-url="assetBaseUrl" />
            </div>

            <label class="shogi-tournament__check">
              <input v-model="revival" type="checkbox">
              <span>敗者復活戦を行う</span>
            </label>
            <div class="shogi-tournament__says">
              <YakobiSays :lines="[entryRevivalLine(revival)]" size="sm" :asset-base-url="assetBaseUrl" />
            </div>

            <div class="shogi-tournament__field">
              <span id="entry-coach">やこび姫の助言</span>
              <div class="shogi-tournament__choices shogi-tournament__choices--three" role="radiogroup" aria-labelledby="entry-coach">
                <button
                  v-for="item in COACH_OPTIONS"
                  :key="item.value"
                  type="button"
                  role="radio"
                  :aria-checked="item.value === coachLevel"
                  @click="coachLevel = item.value"
                >{{ item.label }}</button>
              </div>
            </div>
            <div class="shogi-tournament__selects">
              <label class="shogi-tournament__select">
                <span>閃きの回数</span>
                <select v-model.number="hintLimit" aria-label="閃きの回数">
                  <option v-for="item in LEARNING_ASSIST_LIMITS" :key="item.value" :value="item.value">{{ item.label }}</option>
                </select>
              </label>
              <label class="shogi-tournament__select">
                <span>待ったの回数</span>
                <select v-model.number="undoLimit" aria-label="待ったの回数">
                  <option v-for="item in LEARNING_ASSIST_LIMITS" :key="item.value" :value="item.value">{{ item.label }}</option>
                </select>
              </label>
            </div>
            <div class="shogi-tournament__says">
              <YakobiSays :lines="[coachLine]" size="sm" :asset-base-url="assetBaseUrl" />
            </div>

            <button type="button" class="shogi-tournament__start" data-tournament-enter @click="enter">大会に参加する</button>
          </section>
        </div>
      </div>

      <!-- 竜王戦: トーナメント表と、次の対局 -->
      <div v-else-if="screen === 'season' && view" class="shogi-tournament__body shogi-tournament__body--season" data-screen="season">
        <div class="shogi-tournament__top">
          <section class="shogi-tournament__card shogi-tournament__status" aria-label="進行">
            <h2>{{ view.title }}</h2>
            <p class="shogi-tournament__phase" data-phase>{{ view.mode === "defense" && view.phase !== "done" ? "防衛戦" : view.phaseText }}</p>
            <YakobiSays :lines="phaseLines" size="md" :asset-base-url="assetBaseUrl" />
            <ul v-for="series in view.series" :key="series.key" class="shogi-tournament__facts">
              <li>
                <span>{{ series.label }}</span>
                <strong>
                  {{ series.a?.name }} {{ series.wins.a }} - {{ series.wins.b }} {{ series.b?.name }}
                  <template v-if="series.winner">→ {{ series.winner === series.a?.id ? series.a?.name : series.b?.name }}の勝ち</template>
                </strong>
              </li>
            </ul>
            <button v-if="view.result" type="button" class="shogi-tournament__start" data-to-result @click="screen = 'result'">結果と統計を見る</button>
          </section>

          <section v-if="view.pending" class="shogi-tournament__card" aria-label="次の対局" data-pending>
            <h2>次の対局</h2>
            <p class="shogi-tournament__phase">{{ view.pending.label }}</p>
            <div class="shogi-tournament__opponent">
              <strong>{{ view.pending.opponent.name }} <small>{{ view.pending.opponent.dan }}</small></strong>
              <dl>
                <div><dt>棋力</dt><dd>Lv.{{ view.pending.opponent.level }}</dd></div>
                <div><dt>得意戦法</dt><dd>{{ view.pending.opponent.style?.label ?? "—" }}</dd></div>
                <div><dt>あなたの手番</dt><dd>{{ view.pending.color === "black" ? "先手" : "後手" }}（振り駒）</dd></div>
                <div v-if="view.pending.kind !== 'game'">
                  <dt>ここまで</dt>
                  <dd>あなた {{ view.pending.wins.user }} - {{ view.pending.wins.opponent }} 相手（{{ view.pending.need }}勝で勝ち）</dd>
                </div>
              </dl>
            </div>
            <YakobiSays :lines="opponentSays" size="md" :asset-base-url="assetBaseUrl" />
            <button type="button" class="shogi-tournament__start" data-tournament-play @click="emit('play')">対局開始</button>
          </section>
        </div>

        <section class="shogi-tournament__card shogi-tournament__tables" aria-label="トーナメント表">
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
          <TournamentTree
            v-if="activeTable?.tree"
            :key="activeTable.key"
            :tree="activeTable.tree"
            :finals="activeTable.key === 'main' && view.defender ? { defender: view.defender, winner: finalsWinner } : null"
            :root-badge="activeTable.key === 'main' ? '' : rootBadge(activeTable)"
          />
        </section>
      </div>

      <!-- 竜王戦: 結果・統計・解説(やこび姫が話す) -->
      <div v-else-if="screen === 'result' && view?.result" class="shogi-tournament__body shogi-tournament__body--result" data-screen="result" data-result-screen>
        <section class="shogi-tournament__card shogi-tournament__headline" aria-label="結果">
          <h2>{{ view.title }}の結果</h2>
          <div class="shogi-tournament__headline-grid">
            <YakobiSays :lines="resultSays" size="lg" :asset-base-url="assetBaseUrl" />
            <div>
              <p class="shogi-tournament__big">{{ outcomeHeadline }}</p>
              <p class="shogi-tournament__text">{{ outcomeDetail }}</p>
              <ul class="shogi-tournament__path">
                <li v-for="step in view.result.path" :key="step.stage + step.label"><span>{{ step.label }}</span><strong>{{ step.text }}</strong></li>
              </ul>
              <ul v-if="view.result.titles?.length" class="shogi-tournament__titles">
                <li v-for="title in view.result.titles" :key="title.id"><strong>{{ title.label }}を獲得！</strong><small>{{ title.detail }}</small></li>
              </ul>
            </div>
          </div>
        </section>

        <section class="shogi-tournament__card shogi-tournament__radar" aria-label="レーダーチャート">
          <h2>この期のあなた</h2>
          <YakobiSays :lines="radarSays" size="sm" :asset-base-url="assetBaseUrl" />
          <RadarChart :axes="view.stats.radar" />
          <p v-if="view.stats.pending" class="shogi-tournament__hint" data-analyzing>対局を解析しています（あと{{ view.stats.pending }}局）。終わると、点数が出ます。</p>
        </section>

        <section class="shogi-tournament__card shogi-tournament__stats" aria-label="統計" data-stats>
          <h2>統計</h2>
          <dl class="shogi-tournament__statlist">
            <div><dt>戦績</dt><dd>{{ stats.games }}局 {{ stats.wins }}勝{{ stats.losses }}敗（勝率{{ percent(stats.winRate) }}）</dd></div>
            <div><dt>最長連勝</dt><dd>{{ stats.longestWinStreak }}連勝</dd></div>
            <div><dt>先手 / 後手</dt><dd>先手 {{ stats.black.wins }}勝{{ stats.black.games - stats.black.wins }}敗 / 後手 {{ stats.white.wins }}勝{{ stats.white.games - stats.white.wins }}敗</dd></div>
            <div><dt>居飛車 / 振り飛車</dt><dd>居飛車 {{ stats.vsStatic.wins }}勝{{ stats.vsStatic.games - stats.vsStatic.wins }}敗 / 振り飛車 {{ stats.vsRanging.wins }}勝{{ stats.vsRanging.games - stats.vsRanging.wins }}敗</dd></div>
            <div v-if="stats.analyzed"><dt>平均損失</dt><dd>{{ stats.averageLoss }}（{{ stats.moves }}手を測定）</dd></div>
            <div v-if="stats.analyzed"><dt>悪手</dt><dd>大悪手{{ stats.kinds.blunder }}・悪手{{ stats.kinds.mistake }}・疑問手{{ stats.kinds.dubious }}（大きな損 {{ percent(stats.bigRate) }}）</dd></div>
            <div v-if="stats.analyzed"><dt>好手</dt><dd>好手{{ stats.kinds.good }}・神の一手{{ stats.kinds.brilliant }}</dd></div>
            <div v-if="stats.averagePlies"><dt>平均手数</dt><dd>{{ stats.averagePlies }}手</dd></div>
          </dl>
        </section>

        <section class="shogi-tournament__card shogi-tournament__commentary" aria-label="解説" data-commentary>
          <h2>やこび姫の解説</h2>
          <YakobiSays size="md" :asset-base-url="assetBaseUrl" :lines="commentarySays">
            <p v-for="line in view.stats.commentary" :key="line.title" class="yakobi-says__bubble">
              <strong>{{ line.title }}</strong>
              <small>{{ line.text }}</small>
            </p>
          </YakobiSays>
        </section>

        <div class="shogi-tournament__footer">
          <button type="button" class="shogi-tournament__sub" @click="screen = 'season'">トーナメント表を見る</button>
          <button type="button" class="shogi-tournament__sub" @click="emit('open-note')">やこびノートで見る</button>
          <button type="button" class="shogi-tournament__start" data-back-to-select @click="backToSelect">大会選択へ</button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, type PropType } from "vue";
import TournamentTree from "./TournamentTree.vue";
import RadarChart from "./RadarChart.vue";
import YakobiSays from "./YakobiSays.vue";
import { DIFFICULTY_LEVELS, SCALES, groupMeanLevel, scaleById } from "./core/ryuo.mjs";
import { nextEntry, outcomeText } from "./core/ryuo-career.mjs";
import {
  entryCoachLine,
  entryDifficultyLine,
  entryRevivalLine,
  entryScaleLine,
  opponentLines,
  resultLines,
  ryuoGuideLines,
  seasonPhaseLines,
} from "./core/ryuo-speech.mjs";
import { LEARNING_ASSIST_LIMITS } from "./core/learning-setup.mjs";

type Career = {
  group: number; seasons: number; champion: boolean; titles: number; streak: number; eternal: boolean;
  settings: { scale: number; revival: boolean; coachLevel: string; hintLimit: number; undoLimit: number };
};
type Brief = { id: string; name: string; dan: string; level: number; style?: { label: string; rook?: string } | null };
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
  };
  result: null | {
    outcome: string; startGroup: number; newGroup: number; promoted: boolean; relegated: boolean; challenger: boolean;
    wins: number; losses: number; standing: number | null; exitLabel: string; path: { stage: string; label: string; text: string }[];
    titles?: { id: string; label: string; detail: string }[];
  };
  defender: Brief | null;
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
  defaultDifficulty: { type: Number, default: 5 },
  /** プレイヤーの棋力の目安(CPUのLv)。やこび姫が、相手の強さを話すのに使う。 */
  userLevel: { type: Number, default: 20 },
  ratingText: { type: String, default: "" },
  startAt: { type: String as PropType<"select" | "season">, default: "select" },
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

const charaUrl = computed(() => `${props.assetBaseUrl}/characters/yakobihime-mini.webp?v=2`);
const inProgress = computed(() => Boolean(props.view && !props.view.result));
const screen = ref<"select" | "ryuo" | "season" | "result">(
  props.startAt === "season" && props.view ? (props.view.result ? "result" : "season") : "select",
);
const reEntry = ref(false);
const tableChoice = ref<string | null>(null);

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
}
defineExpose({ goBack });

// ---- エントリー設定
const DIFFICULTY_STEPS = Array.from({ length: DIFFICULTY_LEVELS }, (_, index) => index + 1);
const COACH_OPTIONS = [
  { value: "off", label: "なし" },
  { value: "encourage", label: "応援のみ" },
  { value: "detailed", label: "詳しい助言" },
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

// ---- やこび姫のセリフ
const guideLines = computed(() => [
  entry.value.mode === "defense"
    ? "竜王として、防衛戦に臨もう！ 挑戦者との七番勝負だよ。"
    : `第${entry.value.no}期竜王戦、${entry.value.group}組から参加だね！`,
  ...ryuoGuideLines(),
]);
const difficultyLine = computed(() => entryDifficultyLine({
  group: entry.value.group, meanLevel: meanLevel.value, difficulty: difficulty.value,
  recommended: props.defaultDifficulty, ratingText: props.ratingText,
}));
const scaleLine = computed(() => entryScaleLine(scaleById(scale.value).label, scaleNote.value));
const coachLine = computed(() => entryCoachLine({ coachLevel: coachLevel.value, hintLimit: hintLimit.value, undoLimit: undoLimit.value }));
const phaseLines = computed(() => seasonPhaseLines(props.view));
const opponentSays = computed(() => (
  props.view?.pending ? opponentLines(props.view.pending.opponent, props.userLevel, props.view.pending) : []
));
const resultSays = computed(() => resultLines(props.view?.result ? { ...props.view.result } : null));
const radarSays = computed(() => (
  props.view?.stats.pending
    ? ["いま、対局を解析しているよ。ちょっと待っててね。"]
    : ["これが、この期のあなたのレーダーチャート！ 外側ほど、得意ってことだよ。"]
));
/** 解説の表情を決めるための、セリフの文字列。 */
const commentarySays = computed(() => (props.view?.stats.commentary ?? []).map((line) => `${line.title} ${line.text}`));

function enter() {
  emit("enter", {
    difficulty: difficulty.value, scale: scale.value, revival: revival.value,
    coachLevel: coachLevel.value, hintLimit: hintLimit.value, undoLimit: undoLimit.value,
  });
  reEntry.value = false;
  tableChoice.value = null;
  screen.value = "season";
}

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
const stats = computed(() => props.view!.stats.summary);
const percent = (ratio: number | null) => (ratio === null ? "—" : `${Math.round(ratio * 100)}%`);
</script>

<style>
/*
 * ボタンと入力の寸法をそろえる。
 *   --tr-control: 選択肢のボタン・セレクト・タブの高さ
 *   --tr-action:  大きな操作ボタン(参加・対局開始など)の高さ
 * 選択肢の並びは、グリッドで等分して、幅もそろえる。
 */
.shogi-game .shogi-tournament {
  --tr-control: 2.75rem;
  --tr-action: 3.25rem;
  --tr-gap: 0.5rem;
}
.shogi-game .shogi-tournament__body {
  flex: 1;
  display: grid;
  align-content: start;
  gap: 0.8rem;
  width: min(100%, 78rem);
  margin: 0 auto;
  overflow-y: auto;
  padding: 0.8rem clamp(0.8rem, 3vw, 2rem) 1.5rem;
  font-size: var(--dex-text);
}
.shogi-game .shogi-tournament__body--two { grid-template-columns: minmax(0, 1fr); }
.shogi-game .shogi-tournament__col { display: grid; align-content: start; gap: 0.8rem; min-width: 0; }
@media (min-width: 900px) {
  .shogi-game .shogi-tournament__body--two { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; }
}
.shogi-game .shogi-tournament__top { display: grid; gap: 0.8rem; grid-template-columns: minmax(0, 1fr); }
@media (min-width: 900px) {
  .shogi-game .shogi-tournament__top { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; }
}
.shogi-game .shogi-tournament__card {
  display: grid;
  gap: 0.6rem;
  align-content: start;
  min-width: 0;
  padding: 0.8rem 1rem;
  border: 1px solid rgba(255, 252, 244, 0.35);
  border-left: 6px solid #f1a54c;
  border-radius: 0.5rem;
  background: rgba(29, 48, 63, 0.8);
}
.shogi-game .shogi-tournament__card h2 {
  margin: 0;
  color: #f1a54c;
  font-size: 1em;
  letter-spacing: 0.1em;
}
.shogi-game .shogi-tournament__text { margin: 0; line-height: 1.7; }
.shogi-game .shogi-tournament__facts { display: grid; gap: 0.3rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .shogi-tournament__facts li { display: grid; grid-template-columns: 5.5em minmax(0, 1fr); gap: 0.2rem 0.8rem; }
.shogi-game .shogi-tournament__facts li span { color: rgba(255, 252, 244, 0.75); }

/* エントリー: 項目名と選択肢を、同じ幅の2列にそろえる */
.shogi-game .shogi-tournament__field {
  display: grid;
  grid-template-columns: 8em minmax(0, 1fr);
  align-items: center;
  gap: 0.4rem 0.8rem;
}
.shogi-game .shogi-tournament__field > span { font-weight: 700; }
.shogi-game .shogi-tournament__choices { display: grid; gap: var(--tr-gap); }
.shogi-game .shogi-tournament__choices--ten { grid-template-columns: repeat(10, minmax(0, 1fr)); }
.shogi-game .shogi-tournament__choices--five { grid-template-columns: repeat(5, minmax(0, 1fr)); }
.shogi-game .shogi-tournament__choices--three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.shogi-game .shogi-tournament__choices button,
.shogi-game .shogi-tournament__tabs button {
  box-sizing: border-box;
  min-width: 0;
  height: var(--tr-control);
  padding: 0 0.3rem;
  border: 1px solid rgba(255, 252, 244, 0.5);
  border-radius: 0.4rem;
  color: #fffcf4;
  background: transparent;
  font: inherit;
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
.shogi-game .shogi-tournament__select { display: grid; gap: 0.3rem; font-weight: 700; }
.shogi-game .shogi-tournament__select select {
  box-sizing: border-box;
  width: 100%;
  height: var(--tr-control);
  padding: 0 0.6rem;
  border: 1px solid rgba(255, 252, 244, 0.5);
  border-radius: 0.4rem;
  color: #fffcf4;
  background: #1d303f;
  font: inherit;
  font-weight: 400;
}
.shogi-game .shogi-tournament__check {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-height: var(--tr-control);
  font-weight: 700;
}
.shogi-game .shogi-tournament__check input { width: 1.3em; height: 1.3em; }
.shogi-game .shogi-tournament__says { min-width: 0; }
.shogi-game .shogi-tournament__hint { margin: 0; color: rgba(255, 252, 244, 0.7); font-size: 0.85em; line-height: 1.6; }

/* 大きな操作ボタンは、すべて同じ高さと幅(列いっぱい)にする */
.shogi-game .shogi-tournament__actions { display: grid; gap: var(--tr-gap); }
.shogi-game .shogi-tournament__start,
.shogi-game .shogi-tournament__sub {
  box-sizing: border-box;
  display: block;
  width: 100%;
  height: var(--tr-action);
  padding: 0 1rem;
  border-radius: 0.6rem;
  font: inherit;
  font-size: 1.05em;
  cursor: pointer;
}
.shogi-game .shogi-tournament__start { border: 2px solid #f1a54c; color: #172632; background: #f1a54c; font-weight: 800; }
.shogi-game .shogi-tournament__sub { border: 2px solid rgba(255, 252, 244, 0.6); color: #fffcf4; background: transparent; font-weight: 700; }

.shogi-game .shogi-tournament__phase { margin: 0; font-weight: 700; }
.shogi-game .shogi-tournament__opponent { display: grid; gap: 0.3rem; }
.shogi-game .shogi-tournament__opponent strong { font-size: 1.2em; }
.shogi-game .shogi-tournament__opponent strong small { margin-left: 0.4rem; color: rgba(255, 252, 244, 0.8); }
.shogi-game .shogi-tournament__opponent dl { display: grid; gap: 0.25rem; margin: 0; }
.shogi-game .shogi-tournament__opponent dl div { display: grid; grid-template-columns: 7em minmax(0, 1fr); gap: 0.8rem; }
.shogi-game .shogi-tournament__opponent dt { color: rgba(255, 252, 244, 0.75); }
.shogi-game .shogi-tournament__opponent dd { margin: 0; }
.shogi-game .shogi-tournament__tabs { display: flex; flex-wrap: wrap; gap: var(--tr-gap); }
.shogi-game .shogi-tournament__tabs button { min-width: 9rem; padding: 0 1rem; }

/* 結果 */
.shogi-game .shogi-tournament__body--result { grid-template-columns: minmax(0, 1fr); }
@media (min-width: 900px) {
  .shogi-game .shogi-tournament__body--result { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; }
  .shogi-game .shogi-tournament__headline,
  .shogi-game .shogi-tournament__commentary,
  .shogi-game .shogi-tournament__footer { grid-column: 1 / -1; }
}
.shogi-game .shogi-tournament__headline-grid { display: grid; gap: 1rem; grid-template-columns: minmax(0, 1fr); }
@media (min-width: 760px) {
  .shogi-game .shogi-tournament__headline-grid { grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); align-items: start; }
}
.shogi-game .shogi-tournament__big { margin: 0 0 0.4rem; font-size: 1.8em; font-weight: 800; }
.shogi-game .shogi-tournament__path { display: grid; gap: 0.25rem; margin: 0.4rem 0 0; padding: 0; list-style: none; }
.shogi-game .shogi-tournament__path li { display: grid; grid-template-columns: 10em minmax(0, 1fr); gap: 0.2rem 1rem; }
.shogi-game .shogi-tournament__path li span { color: rgba(255, 252, 244, 0.75); }
.shogi-game .shogi-tournament__titles { display: grid; gap: 0.4rem; margin: 0.6rem 0 0; padding: 0; list-style: none; }
.shogi-game .shogi-tournament__titles li { display: grid; gap: 0.1rem; }
.shogi-game .shogi-tournament__titles small { color: rgba(255, 252, 244, 0.8); }
.shogi-game .shogi-tournament__radar { justify-items: center; }
.shogi-game .shogi-tournament__radar h2 { justify-self: start; }
.shogi-game .shogi-tournament__radar .yakobi-says { justify-self: stretch; }
.shogi-game .shogi-tournament__statlist { display: grid; gap: 0.4rem; margin: 0; }
.shogi-game .shogi-tournament__statlist div { display: grid; grid-template-columns: 8.5em minmax(0, 1fr); gap: 0.6rem; }
.shogi-game .shogi-tournament__statlist dt { color: rgba(255, 252, 244, 0.75); }
.shogi-game .shogi-tournament__statlist dd { margin: 0; }
.shogi-game .shogi-tournament__footer { display: grid; gap: var(--tr-gap); grid-template-columns: minmax(0, 1fr); }
@media (min-width: 700px) {
  .shogi-game .shogi-tournament__footer { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

/* 狭い画面: 項目名を選択肢の上に置き、10段階の難易度は5つずつ2段にする */
@media (max-width: 600px) {
  .shogi-game .shogi-tournament__field { grid-template-columns: minmax(0, 1fr); }
  .shogi-game .shogi-tournament__choices--ten { grid-template-columns: repeat(5, minmax(0, 1fr)); }
  .shogi-game .shogi-tournament__choices--five { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .shogi-game .shogi-tournament__path li { grid-template-columns: minmax(0, 1fr); }
  .shogi-game .shogi-tournament__statlist div { grid-template-columns: minmax(0, 1fr); gap: 0; }
  .shogi-game .shogi-tournament__tabs button { min-width: 0; flex: 1 1 calc(50% - var(--tr-gap)); }
}

/* 大会の選択(タイトル画面と同じ見た目)。どの段も、同じ大きさのカードを、3列の同じ位置に並べる。 */
.shogi-game .shogi-tournament-home .shogi-home__cards {
  grid-auto-flow: row;
  grid-template-columns: repeat(3, clamp(96px, 26vw, 130px));
  grid-auto-columns: auto;
  grid-auto-rows: 1fr;
}
.shogi-game .shogi-tournament-home .shogi-home__card { min-height: 7.5rem; align-content: center; }
.shogi-game .shogi-tournament__home-back {
  position: absolute;
  top: 0.8rem;
  left: 0.8rem;
  z-index: 1;
}
</style>
