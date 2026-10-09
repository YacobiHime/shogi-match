<template>
  <div class="shogi-dex shogi-tournament" role="dialog" aria-modal="true" aria-labelledby="shogi-tournament-title">
    <header class="shogi-dex__header">
      <button type="button" class="shogi-dex__back" @click="goBack">
        <span aria-hidden="true">←</span> {{ screen === "select" ? backLabel : "大会の選択へ" }}
      </button>
      <h1 id="shogi-tournament-title">{{ headerTitle }}</h1>
    </header>

    <!-- 大会の選択 -->
    <div v-if="screen === 'select'" class="shogi-tournament__body" data-screen="select">
      <div class="shogi-dex__speech shogi-tournament__intro">
        <img class="shogi-dex__chara" :src="charaUrl" alt="" aria-hidden="true">
        <p>どの大会に参加する？ 実際のプロ棋士のように、予選から勝ち上がって、タイトルを目指そう！</p>
      </div>
      <section class="shogi-tournament__card" aria-labelledby="shogi-tournament-list">
        <h2 id="shogi-tournament-list">大会を選ぶ</h2>
        <div class="shogi-tournament__list">
          <button type="button" class="shogi-tournament__option" data-tournament="ryuo" @click="screen = view && !view.result ? 'season' : 'ryuo'">
            <strong>竜王戦</strong>
            <small>6組のランキング戦から、決勝トーナメント、七番勝負へ。竜王を目指す大会。</small>
            <small class="shogi-tournament__earned">{{ careerLine }}</small>
            <small v-if="view && !view.result" class="shogi-tournament__progress">進行中: {{ view.title }}（{{ view.phaseText }}）</small>
          </button>
          <button v-for="item in comingSoon" :key="item.id" type="button" class="shogi-tournament__option" disabled>
            <strong>{{ item.label }}</strong>
            <small>{{ item.note }}</small>
            <small>準備中です。</small>
          </button>
        </div>
      </section>
    </div>

    <!-- 竜王戦: 説明とエントリー -->
    <div v-else-if="screen === 'ryuo'" class="shogi-tournament__body" data-screen="ryuo">
      <div class="shogi-dex__speech shogi-tournament__intro">
        <img class="shogi-dex__chara" :src="charaUrl" alt="" aria-hidden="true">
        <p>{{ entry.mode === "defense" ? "竜王として、防衛戦に臨もう！ 挑戦者との七番勝負だよ。" : `第${entry.no}期竜王戦、${entry.group}組から参加するよ！` }}</p>
      </div>

      <section class="shogi-tournament__card" aria-labelledby="shogi-ryuo-about">
        <h2 id="shogi-ryuo-about">竜王戦とは</h2>
        <p class="shogi-tournament__text">
          将棋界の8つのタイトル戦の1つ。全棋士に加えて、女流棋士・奨励会員・アマチュアも出場できる。
          6つの組のランキング戦から勝ち上がり、各組の上位者による決勝トーナメントで挑戦者を決め、
          竜王との七番勝負（先に4勝）で竜王を決める。
        </p>
        <ol class="shogi-tournament__flow">
          <li><strong>ランキング戦</strong>（6組から）: 組ごとのトーナメント。優勝・準優勝は昇級する。</li>
          <li><strong>敗者復活戦</strong>: 負けた人の再挑戦。勝つと昇級、負け続けると降級する。</li>
          <li><strong>決勝トーナメント</strong>: 各組の上位者が出場。上の組ほど有利な位置から始まる。</li>
          <li><strong>挑戦者決定三番勝負</strong>: 2勝すると、竜王への挑戦者になる。</li>
          <li><strong>竜王戦七番勝負</strong>: 4勝で竜王。竜王になれば、次の期は防衛戦。連続5期か通算7期で、永世竜王。</li>
        </ol>
        <p class="shogi-tournament__hint">制度の要点を縮めて再現した簡易版で、登場する棋士はすべて架空です。何度か参加すると、昇級して組が上がります。</p>
      </section>

      <section class="shogi-tournament__card" aria-labelledby="shogi-ryuo-status">
        <h2 id="shogi-ryuo-status">あなたの竜王戦</h2>
        <ul class="shogi-tournament__facts" data-ryuo-status>
          <li><span>現在</span><strong>{{ career.champion ? "竜王" : `竜王戦${career.group}組` }}</strong></li>
          <li><span>参加</span><strong>{{ career.seasons }}期</strong></li>
          <li><span>竜王</span><strong>通算{{ career.titles }}期（連続{{ career.streak }}期）</strong></li>
          <li v-if="career.eternal"><span>称号</span><strong>永世竜王</strong></li>
        </ul>
      </section>

      <section v-if="view?.result" class="shogi-tournament__card" aria-labelledby="shogi-ryuo-last" data-last-season>
        <h2 id="shogi-ryuo-last">前回の期</h2>
        <p class="shogi-tournament__text">{{ view.title }}: {{ outcomeHeadline }}（{{ view.result.wins }}勝{{ view.result.losses }}敗）</p>
        <button type="button" class="shogi-tournament__sub" @click="screen = 'season'">トーナメント表と結果を見る</button>
      </section>

      <section v-if="view && !view.result && !reEntry" class="shogi-tournament__card" aria-labelledby="shogi-ryuo-progress">
        <h2 id="shogi-ryuo-progress">進行中の大会</h2>
        <p class="shogi-tournament__text">{{ view.title }}（{{ view.phaseText }}）の途中です。</p>
        <button type="button" class="shogi-tournament__start" data-tournament-continue @click="screen = 'season'">続きから参加する</button>
        <button type="button" class="shogi-tournament__sub" @click="reEntry = true">破棄して、新しくエントリーする</button>
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
        <p class="shogi-tournament__hint" data-difficulty-note>
          {{ entry.group }}組の相手の平均: Lv.{{ Math.round(meanLevel) }}（強い人は Lv.{{ Math.min(40, Math.round(meanLevel + 5)) }}前後）。
          点線の数字が、あなたのレーティング（{{ ratingText }}）に合ったおすすめです。
        </p>

        <div class="shogi-tournament__field">
          <span id="entry-scale">規模</span>
          <div class="shogi-tournament__choices" role="radiogroup" aria-labelledby="entry-scale">
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
        <p class="shogi-tournament__hint" data-scale-note>{{ scaleNote }}</p>

        <label class="shogi-tournament__check">
          <input v-model="revival" type="checkbox">
          <span>敗者復活戦を行う（負けても、もう一度チャンスがある）</span>
        </label>

        <div class="shogi-tournament__field">
          <span id="entry-coach">やこび姫の助言</span>
          <div class="shogi-tournament__choices" role="radiogroup" aria-labelledby="entry-coach">
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
        <label class="shogi-tournament__field">
          <span>閃きの回数</span>
          <select v-model.number="hintLimit" aria-label="閃きの回数">
            <option v-for="item in LEARNING_ASSIST_LIMITS" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </label>
        <label class="shogi-tournament__field">
          <span>待ったの回数</span>
          <select v-model.number="undoLimit" aria-label="待ったの回数">
            <option v-for="item in LEARNING_ASSIST_LIMITS" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </label>

        <button type="button" class="shogi-tournament__start" data-tournament-enter @click="enter">大会に参加する</button>
      </section>
    </div>

    <!-- 竜王戦: トーナメント表と、次の対局 -->
    <div v-else-if="screen === 'season' && view" class="shogi-tournament__body" data-screen="season">
      <section class="shogi-tournament__card shogi-tournament__status" aria-label="進行">
        <h2>{{ view.title }}</h2>
        <p class="shogi-tournament__phase" data-phase>{{ view.mode === "defense" && view.phase !== "done" ? "防衛戦" : view.phaseText }}</p>
      </section>

      <!-- 結果 -->
      <section v-if="view.result" class="shogi-tournament__card shogi-tournament__result" aria-label="結果" data-season-result>
        <h2>{{ outcomeHeadline }}</h2>
        <p class="shogi-tournament__text">{{ outcomeDetail }}</p>
        <ul v-if="view.result.titles?.length" class="shogi-tournament__titles">
          <li v-for="title in view.result.titles" :key="title.id"><strong>{{ title.label }}</strong><small>{{ title.detail }}</small></li>
        </ul>
        <button type="button" class="shogi-tournament__start" data-next-season @click="nextSeason">次の期へ</button>
        <button type="button" class="shogi-tournament__sub" @click="emit('open-note')">やこびノートで見る</button>
      </section>

      <!-- 次の対局 -->
      <section v-else-if="view.pending" class="shogi-tournament__card" aria-label="次の対局" data-pending>
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
        <button type="button" class="shogi-tournament__start" data-tournament-play @click="emit('play')">対局開始</button>
      </section>

      <!-- 番勝負 -->
      <section v-for="series in view.series" :key="series.key" class="shogi-tournament__card" :aria-label="series.label">
        <h2>{{ series.label }}</h2>
        <p class="shogi-tournament__text">
          {{ series.a?.name }}（{{ series.a?.dan }}）{{ series.wins.a }} - {{ series.wins.b }} {{ series.b?.name }}（{{ series.b?.dan }}）
          <strong v-if="series.winner">　→ {{ series.winner === series.a?.id ? series.a?.name : series.b?.name }}の勝ち</strong>
        </p>
      </section>

      <!-- トーナメント表 -->
      <section v-for="table in view.tables" :key="table.key" class="shogi-tournament__card" :aria-label="table.title">
        <details :open="table.key === currentTableKey">
          <summary><h2>{{ table.title }}</h2></summary>
          <div v-for="round in table.rounds" :key="round.round" class="shogi-tournament__round">
            <h3>{{ round.label }}</h3>
            <ul>
              <li
                v-for="match in round.matches"
                :key="match.id"
                :class="{ 'shogi-tournament__match--user': match.user }"
              >
                <span :class="{ 'shogi-tournament__winner': match.winner && match.winner === match.a?.id }">
                  {{ match.a ? `${match.a.name} ${match.a.dan}` : "（未定）" }}
                </span>
                <b>{{ matchMark(match) }}</b>
                <span :class="{ 'shogi-tournament__winner': match.winner && match.winner === match.b?.id }">
                  {{ match.b ? `${match.b.name} ${match.b.dan}` : "（未定）" }}
                </span>
              </li>
            </ul>
          </div>
        </details>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, type PropType } from "vue";
import { DIFFICULTY_LEVELS, SCALES, groupMeanLevel, scaleById } from "./core/ryuo.mjs";
import { nextEntry, outcomeText } from "./core/ryuo-career.mjs";
import { LEARNING_ASSIST_LIMITS } from "./core/learning-setup.mjs";

type Career = {
  group: number; seasons: number; champion: boolean; titles: number; streak: number; eternal: boolean;
  settings: { scale: number; revival: boolean; coachLevel: string; hintLimit: number; undoLimit: number };
};
type Brief = { id: string; name: string; dan: string; level: number; style?: { label: string } | null };
type Match = { id: string; a: Brief | null; b: Brief | null; winner: string | null; user: boolean; final: boolean };
type View = {
  title: string; mode: string; startGroup: number; phase: string; phaseText: string;
  tables: { key: string; title: string; rounds: { round: number; label: string; matches: Match[] }[] }[];
  series: { key: string; label: string; need: number; a: Brief | null; b: Brief | null; wins: { a: number; b: number }; winner: string | null }[];
  pending: null | {
    label: string; kind: string; color: string; need: number; wins: { user: number; opponent: number }; opponent: Brief;
  };
  result: null | {
    outcome: string; startGroup: number; newGroup: number; promoted: boolean; relegated: boolean;
    wins: number; losses: number; standing: number | null; titles?: { id: string; label: string; detail: string }[];
  };
};

const props = defineProps({
  assetBaseUrl: { type: String, default: "." },
  backLabel: { type: String, default: "タイトルへ戻る" },
  career: { type: Object as PropType<Career>, required: true },
  view: { type: Object as PropType<View | null>, default: null },
  defaultDifficulty: { type: Number, default: 5 },
  ratingText: { type: String, default: "" },
  startAt: { type: String as PropType<"select" | "season">, default: "select" },
});
const emit = defineEmits<{
  close: [];
  enter: [settings: { difficulty: number; scale: number; revival: boolean; coachLevel: string; hintLimit: number; undoLimit: number }];
  play: [];
  "open-note": [];
}>();

const charaUrl = computed(() => `${props.assetBaseUrl}/characters/yakobihime-mini.webp?v=2`);
const screen = ref<"select" | "ryuo" | "season">(props.startAt === "season" && props.view ? "season" : "select");
const reEntry = ref(false);
const comingSoon = [
  { id: "junni", label: "順位戦", note: "C級2組から、A級・名人挑戦を目指す大会。" },
  { id: "meijin", label: "名人戦", note: "名人と挑戦者の七番勝負。" },
];

const headerTitle = computed(() => (screen.value === "select" ? "大会" : "竜王戦"));
/** 戻る操作。選択の画面に戻り、選択の画面なら閉じる。 */
function goBack() {
  if (screen.value === "select") emit("close");
  else {
    screen.value = "select";
    reEntry.value = false;
  }
}
defineExpose({ goBack });

const careerLine = computed(() => {
  const { career } = props;
  const status = career.champion ? "竜王" : `竜王戦${career.group}組`;
  return `${status}・参加${career.seasons}期・竜王通算${career.titles}期${career.eternal ? "・永世竜王" : ""}`;
});

const entry = computed(() => nextEntry(props.career));

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
  if (entry.value.mode === "defense") return "防衛戦は、挑戦者との七番勝負だけです（先に4勝）。挑戦者の強さは、難易度で決まります。";
  return `${group}組は${item.sizes[group]}名のトーナメント。決勝トーナメントは${slots}名。昇級・降級は各${item.promote}名。`
    + "番勝負（三番勝負・七番勝負）の数は変わりません。";
});

function enter() {
  emit("enter", {
    difficulty: difficulty.value, scale: scale.value, revival: revival.value,
    coachLevel: coachLevel.value, hintLimit: hintLimit.value, undoLimit: undoLimit.value,
  });
  reEntry.value = false;
  screen.value = "season";
}

// ---- 進行の画面
const currentTableKey = computed(() => {
  const phase = props.view?.phase;
  if (phase === "revival") return props.view?.tables.find(({ key }) => key.startsWith("revival"))?.key ?? "ranking";
  if (phase === "main" || phase === "main-setup" || phase === "playoff" || phase === "finals") return "main";
  return "ranking";
});

function matchMark(match: Match) {
  if (!match.winner) return "－";
  return match.winner === match.a?.id ? "○－●" : "●－○";
}

const outcomeHeadline = computed(() => {
  const outcome = props.view?.result?.outcome;
  return outcome ? outcomeText(outcome) : "";
});
const outcomeDetail = computed(() => {
  const result = props.view?.result;
  if (!result) return "";
  const record = `${result.wins}勝${result.losses}敗`;
  if (result.outcome === "champion") return `${record}。おめでとう！ 竜王になりました。次の期は防衛戦です。`;
  if (result.outcome === "defense-lost") return `${record}。竜王の座を明け渡し、次の期は1組から挑戦します。`;
  const move = result.promoted ? `${result.startGroup}組から${result.newGroup}組へ昇級！`
    : result.relegated ? `${result.startGroup}組から${result.newGroup}組へ降級…`
      : result.newGroup === 1 && result.startGroup > 1 ? "挑戦者になったので、次の期は1組です。"
        : `次の期も${result.newGroup}組です。`;
  return `${record}。${move}`;
});

function nextSeason() {
  reEntry.value = false;
  difficulty.value = props.defaultDifficulty;
  screen.value = "ryuo";
}
</script>

<style>
.shogi-game .shogi-tournament__body {
  flex: 1;
  display: grid;
  align-content: start;
  gap: 0.8rem;
  width: min(100%, 52rem);
  margin: 0 auto;
  overflow-y: auto;
  padding: 0.8rem clamp(0.8rem, 3vw, 2rem) 1.5rem;
  font-size: var(--dex-text);
}
.shogi-game .shogi-tournament__intro { margin: 0; }
.shogi-game .shogi-tournament__card {
  padding: 0.8rem 1rem;
  border: 1px solid rgba(255, 252, 244, 0.35);
  border-left: 6px solid #f1a54c;
  border-radius: 0.5rem;
  background: rgba(29, 48, 63, 0.8);
}
.shogi-game .shogi-tournament__card h2 {
  margin: 0 0 0.5rem;
  color: #f1a54c;
  font-size: 1em;
  letter-spacing: 0.1em;
}
.shogi-game .shogi-tournament__card details > summary { cursor: pointer; list-style: none; }
.shogi-game .shogi-tournament__card details > summary h2 { display: inline; margin: 0; }
.shogi-game .shogi-tournament__card details[open] > summary { margin-bottom: 0.5rem; }
.shogi-game .shogi-tournament__list { display: grid; gap: 0.5rem; }
.shogi-game .shogi-tournament__option {
  display: grid;
  gap: 0.25rem;
  padding: 0.7rem 0.9rem;
  border: 2px solid rgba(255, 252, 244, 0.35);
  border-radius: 0.5rem;
  color: #fffcf4;
  background: rgba(255, 252, 244, 0.06);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.shogi-game .shogi-tournament__option:disabled { cursor: default; opacity: 0.5; }
.shogi-game .shogi-tournament__option:not(:disabled):hover { border-color: #f1a54c; }
.shogi-game .shogi-tournament__option small { color: rgba(255, 252, 244, 0.8); }
.shogi-game .shogi-tournament__option .shogi-tournament__earned { color: #f1a54c; font-weight: 700; }
.shogi-game .shogi-tournament__option .shogi-tournament__progress { color: #8fd18f; font-weight: 700; }
.shogi-game .shogi-tournament__text { margin: 0 0 0.6rem; line-height: 1.7; }
.shogi-game .shogi-tournament__flow { margin: 0 0 0.6rem; padding-left: 1.3rem; line-height: 1.7; }
.shogi-game .shogi-tournament__facts {
  display: grid;
  gap: 0.3rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.shogi-game .shogi-tournament__facts li { display: flex; gap: 1rem; }
.shogi-game .shogi-tournament__facts li span { min-width: 4em; color: rgba(255, 252, 244, 0.75); }
.shogi-game .shogi-tournament__field {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem 0.8rem;
  margin-bottom: 0.4rem;
}
.shogi-game .shogi-tournament__field > span { min-width: 7em; font-weight: 700; }
.shogi-game .shogi-tournament__choices { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.shogi-game .shogi-tournament__choices button {
  min-height: 2.4rem;
  min-width: 2.4rem;
  padding: 0 0.8rem;
  border: 1px solid rgba(255, 252, 244, 0.5);
  border-radius: 0.4rem;
  color: #fffcf4;
  background: transparent;
  font: inherit;
  cursor: pointer;
}
.shogi-game .shogi-tournament__choices button[aria-checked="true"] {
  border-color: #f1a54c;
  color: #172632;
  background: #f1a54c;
  font-weight: 800;
}
.shogi-game .shogi-tournament__choices button.shogi-tournament__recommended { border-style: dashed; border-color: #f1a54c; }
.shogi-game .shogi-tournament__choices--ten button { min-width: 2.2rem; padding: 0 0.5rem; }
.shogi-game .shogi-tournament__field select {
  min-height: 2.4rem;
  padding: 0 0.6rem;
  border: 1px solid rgba(255, 252, 244, 0.5);
  border-radius: 0.4rem;
  color: #fffcf4;
  background: #1d303f;
  font: inherit;
}
.shogi-game .shogi-tournament__check { display: flex; align-items: center; gap: 0.5rem; margin: 0.6rem 0; }
.shogi-game .shogi-tournament__check input { width: 1.2em; height: 1.2em; }
.shogi-game .shogi-tournament__hint { margin: 0.2rem 0 0.7rem; color: rgba(255, 252, 244, 0.7); font-size: 0.85em; line-height: 1.6; }
.shogi-game .shogi-tournament__start {
  display: block;
  width: 100%;
  min-height: 3rem;
  margin-top: 0.4rem;
  padding: 0.6rem 1.2rem;
  border: 2px solid #f1a54c;
  border-radius: 0.6rem;
  color: #172632;
  background: #f1a54c;
  font: inherit;
  font-size: 1.1em;
  font-weight: 800;
  cursor: pointer;
}
.shogi-game .shogi-tournament__sub {
  display: block;
  width: 100%;
  min-height: 2.6rem;
  margin-top: 0.5rem;
  padding: 0.4rem 1rem;
  border: 1px solid rgba(255, 252, 244, 0.6);
  border-radius: 0.5rem;
  color: #fffcf4;
  background: transparent;
  font: inherit;
  cursor: pointer;
}
.shogi-game .shogi-tournament__phase { margin: 0 0 0.5rem; font-weight: 700; }
.shogi-game .shogi-tournament__opponent strong { font-size: 1.2em; }
.shogi-game .shogi-tournament__opponent strong small { margin-left: 0.4rem; color: rgba(255, 252, 244, 0.8); }
.shogi-game .shogi-tournament__opponent dl { display: grid; gap: 0.25rem; margin: 0.5rem 0; }
.shogi-game .shogi-tournament__opponent dl div { display: flex; gap: 0.8rem; }
.shogi-game .shogi-tournament__opponent dt { min-width: 6em; color: rgba(255, 252, 244, 0.75); }
.shogi-game .shogi-tournament__opponent dd { margin: 0; }
.shogi-game .shogi-tournament__titles { display: grid; gap: 0.4rem; margin: 0 0 0.6rem; padding: 0; list-style: none; }
.shogi-game .shogi-tournament__titles li { display: grid; gap: 0.1rem; }
.shogi-game .shogi-tournament__titles small { color: rgba(255, 252, 244, 0.8); }
.shogi-game .shogi-tournament__round h3 { margin: 0.6rem 0 0.3rem; font-size: 0.9em; color: rgba(255, 252, 244, 0.85); }
.shogi-game .shogi-tournament__round ul { display: grid; gap: 0.2rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .shogi-tournament__round li {
  display: grid;
  grid-template-columns: 1fr 3.4em 1fr;
  align-items: center;
  gap: 0.3rem;
  padding: 0.15rem 0.4rem;
  border-radius: 0.3rem;
  font-size: 0.85em;
}
.shogi-game .shogi-tournament__round li b { text-align: center; color: rgba(255, 252, 244, 0.7); font-weight: 400; }
.shogi-game .shogi-tournament__round li span:last-child { text-align: right; }
.shogi-game .shogi-tournament__match--user { background: rgba(241, 165, 76, 0.18); }
.shogi-game .shogi-tournament__winner { font-weight: 800; color: #f1a54c; }
</style>
