<template>
  <div class="shogi-dex shogi-note" role="dialog" aria-modal="true" aria-labelledby="shogi-note-title">
    <header class="shogi-dex__header">
      <button type="button" class="shogi-dex__back" @click="emit('close')">
        <span aria-hidden="true">←</span> {{ backLabel }}
      </button>
      <h1 id="shogi-note-title">やこびノート</h1>
    </header>

    <div class="shogi-note__body">
      <div class="shogi-dex__speech shogi-note__intro">
        <img class="shogi-dex__chara" :src="charaUrl" alt="" aria-hidden="true">
        <p>{{ message }}</p>
      </div>

      <section class="shogi-note__card" aria-labelledby="shogi-note-profile" data-note-profile>
        <h2 id="shogi-note-profile">プロフィール</h2>
        <p class="shogi-note__affiliation">
          <span>所属</span>
          <strong>{{ affiliation ? affiliation.label : "まだ所属なし" }}</strong>
        </p>
        <h3 class="shogi-note__subhead">称号</h3>
        <p v-if="!profile.titles.length" class="shogi-note__hint">
          まだ称号がありません。対局設定の「大会」に挑戦して、称号を手に入れよう！
        </p>
        <ul v-else class="shogi-note__rows">
          <li v-for="title in titles" :key="title.id" data-note-title>
            <span class="shogi-note__name">{{ title.label }}</span>
            <span class="shogi-note__stat">{{ title.detail }}{{ title.at ? `（${new Date(title.at).toLocaleDateString("ja-JP")}）` : "" }}</span>
          </li>
        </ul>
      </section>

      <section class="shogi-note__card" aria-labelledby="shogi-note-ryuo" data-note-ryuo>
        <h2 id="shogi-note-ryuo">竜王戦</h2>
        <p class="shogi-note__affiliation">
          <span>現在</span>
          <strong>{{ career.champion ? "竜王" : `竜王戦${career.group}組` }}</strong>
        </p>
        <ul class="shogi-note__rows">
          <li><span class="shogi-note__name">参加</span><span class="shogi-note__stat">{{ career.seasons }}期（挑戦者 {{ career.challenges }}回）</span></li>
          <li><span class="shogi-note__name">竜王</span><span class="shogi-note__stat">通算{{ career.titles }}期（連続{{ career.streak }}期・最長{{ career.bestStreak }}期）</span></li>
          <li v-if="career.eternal"><span class="shogi-note__name">称号</span><span class="shogi-note__stat">永世竜王</span></li>
        </ul>
        <template v-if="career.history.length">
          <h3 class="shogi-note__subhead">これまでの成績</h3>
          <ul class="shogi-note__rows" data-note-ryuo-history>
            <li v-for="entry in recentHistory" :key="entry.no">
              <span class="shogi-note__name">第{{ entry.no }}期（{{ entry.mode === "defense" ? "防衛戦" : `${entry.startGroup}組` }}）</span>
              <span class="shogi-note__stat">{{ outcomeText(entry.outcome) }}{{ entry.promoted ? `・${entry.newGroup}組へ昇級` : "" }}{{ entry.relegated ? `・${entry.newGroup}組へ降級` : "" }}（{{ entry.wins }}勝{{ entry.losses }}敗）</span>
            </li>
          </ul>
        </template>
        <p v-else class="shogi-note__hint">まだ参加していません。タイトル画面の「大会」から、竜王戦に参加できます。</p>
      </section>

      <section class="shogi-note__card" aria-labelledby="shogi-note-rating">
        <h2 id="shogi-note-rating">レーティング</h2>
        <p class="shogi-note__rating">
          <strong>R{{ state.rating }}</strong>
          <span>目安: Lv.{{ nearestPreset.level }} {{ nearestPreset.label }}</span>
        </p>
        <p class="shogi-note__record" data-note-record>
          {{ state.games }}局 {{ state.wins }}勝{{ state.losses }}敗{{ state.draws }}引き分け
          <template v-if="state.games">（勝率{{ percent(state.wins / state.games) }}）</template>
        </p>
        <svg
          v-if="trend"
          class="shogi-note__trend"
          viewBox="0 0 300 80"
          preserveAspectRatio="none"
          role="img"
          :aria-label="`直近${trend.count}局のレーティングの推移`"
        >
          <polyline :points="trend.points" fill="none" stroke="#f1a54c" stroke-width="2" vector-effect="non-scaling-stroke" />
        </svg>
        <p v-if="trend" class="shogi-note__trend-note">直近{{ trend.count }}局（R{{ trend.min }}〜R{{ trend.max }}）</p>
        <p v-if="state.measured" class="shogi-note__hint" data-note-measured>
          棋力測定で R{{ state.measured.rating }}（{{ state.measured.label }}）を設定しました（{{ measuredDate }}）。
        </p>
        <p class="shogi-note__hint">平手の通常対局（対CPU）の結果だけを数えています。</p>
        <button type="button" class="shogi-note__measure" @click="emit('start-measure')">棋力を測る</button>
        <p class="shogi-note__hint">
          CPUと1局指すと、終局後に棋譜解析で指し手の評価値の損を調べ、レーティングと級・段の目安を診断します。
          結果は解析画面から、あなたのレーティングに設定できます。
        </p>
      </section>

      <section class="shogi-note__card" aria-labelledby="shogi-note-declare">
        <h2 id="shogi-note-declare">自己申告の棋力</h2>
        <p class="shogi-note__hint">
          日本将棋連盟の段級位で申告すると、レーティングをその棋力に設定します。
          以降の対局は、申告ごとにCPUのレベル別の成績を記録し、表示名と実際の棋力のずれを調べるのに使います。
        </p>
        <div class="shogi-note__declare">
          <select v-model="declareLabel" aria-label="申告する段級位">
            <option value="">段級位を選ぶ</option>
            <option v-for="grade in grades" :key="grade.label" :value="grade.label">{{ grade.label }}</option>
          </select>
          <button type="button" class="shogi-note__measure" :disabled="!declareLabel" @click="declare">申告して設定</button>
        </div>
        <p v-if="state.declared" class="shogi-note__hint" data-note-declared>
          申告中: {{ state.declared.label }}（{{ declaredDate }}に設定）
        </p>
        <ul v-if="declaredRows.length" class="shogi-note__rows">
          <li v-for="row in declaredRows" :key="row.level">
            <span class="shogi-note__name">Lv.{{ row.level }} {{ row.label }}</span>
            <span class="shogi-note__stat">{{ row.wins }}勝{{ row.losses }}敗{{ row.draws }}分</span>
          </li>
        </ul>
        <button v-if="state.games" type="button" class="shogi-note__copy" @click="copyRecord">{{ copied ? "コピーしました" : "戦績データをコピー" }}</button>
      </section>

      <section v-if="state.games" class="shogi-note__card" aria-labelledby="shogi-note-colors">
        <h2 id="shogi-note-colors">手番ごとの成績</h2>
        <ul class="shogi-note__rows">
          <li v-for="row in colorRows" :key="row.key">
            <span class="shogi-note__name">{{ row.label }}</span>
            <span class="shogi-note__bar" aria-hidden="true"><span :style="{ width: row.winPercent }"></span></span>
            <span class="shogi-note__stat">{{ row.text }}</span>
          </li>
        </ul>
      </section>

      <section v-for="group in usageGroups" :key="group.category" class="shogi-note__card" :aria-label="group.title">
        <h2>{{ group.title }}</h2>
        <p v-if="!group.rows.length" class="shogi-note__hint">まだ記録がありません。</p>
        <ul v-else class="shogi-note__rows">
          <li v-for="row in group.rows" :key="row.name">
            <span class="shogi-note__name">{{ row.name }}</span>
            <span class="shogi-note__bar" :title="`使用率 ${percent(row.rate)}`" aria-hidden="true">
              <span :style="{ width: percent(row.rate) }"></span>
            </span>
            <span class="shogi-note__stat">
              {{ percent(row.rate) }}・{{ row.wins }}勝{{ row.losses }}敗{{ row.draws }}分
            </span>
          </li>
        </ul>
      </section>

      <section v-if="levelRows.length" class="shogi-note__card" aria-labelledby="shogi-note-levels">
        <h2 id="shogi-note-levels">CPUのレベルごとの成績</h2>
        <ul class="shogi-note__rows">
          <li v-for="row in levelRows" :key="row.level">
            <span class="shogi-note__name">Lv.{{ row.level }} {{ row.label }}</span>
            <span class="shogi-note__stat">R{{ row.rating }}・{{ row.wins }}勝{{ row.losses }}敗{{ row.draws }}分</span>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, type PropType } from "vue";
import {
  USAGE_CATEGORIES,
  declarableGrades,
  levelRating,
  recommendedLevel,
  usageRows,
} from "./core/player-rating.mjs";
import { CPU_STRENGTH_PRESETS } from "./core/strength-settings.mjs";
import { currentAffiliation } from "./core/player-profile.mjs";
import { outcomeText } from "./core/ryuo-career.mjs";

type Tally = { wins: number; losses: number; draws: number };
type RatingState = {
  rating: number;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  levels: { [level: string]: Tally };
  colors: { [color: string]: Tally };
  usage: { [category: string]: { [name: string]: Tally } };
  measured: { rating: number; label: string; at: number } | null;
  declared: { label: string; level: number; at: number } | null;
  declaredLevels: { [label: string]: { [level: string]: Tally } };
  history: { rating: number }[];
};

type ProfileState = {
  titles: { id: string; label: string; detail: string; rank: number; at: number }[];
};
type RyuoCareer = {
  group: number; seasons: number; champion: boolean; titles: number; streak: number; bestStreak: number;
  challenges: number; eternal: boolean;
  history: { no: number; mode: string; startGroup: number; newGroup: number; outcome: string; wins: number; losses: number; promoted: boolean; relegated: boolean }[];
};

const props = defineProps({
  assetBaseUrl: { type: String, default: "." },
  backLabel: { type: String, default: "タイトルへ戻る" },
  state: { type: Object as PropType<RatingState>, required: true },
  profile: { type: Object as PropType<ProfileState>, default: () => ({ titles: [] }) },
  career: {
    type: Object as PropType<RyuoCareer>,
    default: () => ({ group: 6, seasons: 0, champion: false, titles: 0, streak: 0, bestStreak: 0, challenges: 0, eternal: false, history: [] }),
  },
});
const emit = defineEmits(["close", "start-measure", "declare"]);

const charaUrl = computed(() => `${props.assetBaseUrl}/characters/yakobihime-mini.webp?v=2`);
const measuredDate = computed(() => {
  const at = props.state.measured?.at;
  return at ? new Date(at).toLocaleDateString("ja-JP") : "";
});
const affiliation = computed(() => currentAffiliation(props.profile));
/** 称号は高いものから、大会の成績は新しいものから並べる。 */
const titles = computed(() => [...props.profile.titles].sort((a, b) => b.rank - a.rank || a.at - b.at));
const recentHistory = computed(() => [...props.career.history].reverse().slice(0, 8));
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

const nearestPreset = computed(() => {
  const level = recommendedLevel(props.state.rating);
  return CPU_STRENGTH_PRESETS.find((preset) => preset.level === level)!;
});

const message = computed(() => {
  const { games, wins, rating } = props.state;
  if (!games) return "ここは、あなたの対局の記録をまとめるノートだよ。対局すると、レーティングや得意な戦法が書き込まれていくよ！";
  if (games < 5) return `まだ${games}局だけど、もう書き込みが始まったよ。たくさん指して、ノートを育てよう！`;
  return `${games}局で${wins}勝！ 今のレーティングはR${rating}。ノートを見て、得意な戦法と苦手な戦法を確かめよう！`;
});

const trend = computed(() => {
  const ratings = props.state.history.map((entry) => entry.rating);
  if (ratings.length < 2) return null;
  const min = Math.min(...ratings);
  const max = Math.max(...ratings);
  const span = Math.max(1, max - min);
  const points = ratings.map((value, index) => {
    const x = (index / (ratings.length - 1)) * 300;
    const y = 74 - ((value - min) / span) * 68;
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

const USAGE_TITLES: { [category: string]: string } = {
  rook: "あなたの戦法",
  castle: "あなたの囲い",
  battle: "戦型",
  opponentRook: "相手の戦法",
  opponentCastle: "相手の囲い",
};
const USAGE_LIMIT = 8;
const usageGroups = computed(() => USAGE_CATEGORIES.map((category: string) => ({
  category,
  title: USAGE_TITLES[category],
  rows: usageRows(props.state, category).slice(0, USAGE_LIMIT),
})));

const levelRows = computed(() => CPU_STRENGTH_PRESETS
  .filter((preset) => {
    const tally = props.state.levels?.[preset.level];
    return tally && tally.wins + tally.losses + tally.draws > 0;
  })
  .map((preset) => ({ ...preset, ...props.state.levels[preset.level], rating: levelRating(preset.level) })));
</script>

<style>
.shogi-game .shogi-note__body {
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
.shogi-game .shogi-note__intro { margin: 0; }
.shogi-game .shogi-note__card {
  padding: 0.8rem 1rem;
  border: 1px solid rgba(255, 252, 244, 0.35);
  border-left: 6px solid #f1a54c;
  border-radius: 0.5rem;
  background: rgba(29, 48, 63, 0.8);
}
.shogi-game .shogi-note__card h2 {
  margin: 0 0 0.5rem;
  color: #f1a54c;
  font-size: 1em;
  letter-spacing: 0.1em;
}
.shogi-game .shogi-note__affiliation {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.2rem 0.8rem;
  margin: 0;
}
.shogi-game .shogi-note__affiliation strong { font-size: 1.4em; }
.shogi-game .shogi-note__subhead {
  margin: 0.8rem 0 0.4rem;
  color: rgba(255, 252, 244, 0.8);
  font-size: 0.9em;
}
.shogi-game .shogi-note__rating {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.3rem 1rem;
  margin: 0;
}
.shogi-game .shogi-note__rating strong { font-size: 2.2em; line-height: 1.1; }
.shogi-game .shogi-note__record { margin: 0.3rem 0 0; }
.shogi-game .shogi-note__trend {
  display: block;
  width: 100%;
  height: 4.5rem;
  margin-top: 0.6rem;
  border-bottom: 1px solid rgba(255, 252, 244, 0.35);
}
.shogi-game .shogi-note__measure {
  display: block;
  margin-top: 0.7rem;
  padding: 0.6rem 1.2rem;
  border: 2px solid #f1a54c;
  border-radius: 0.6rem;
  color: #172632;
  background: #f1a54c;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}
.shogi-game .shogi-note__declare {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}
.shogi-game .shogi-note__declare select {
  min-height: 2.4rem;
  padding: 0 0.6rem;
  border: 1px solid rgba(255, 252, 244, 0.5);
  border-radius: 0.4rem;
  color: #fffcf4;
  background: #1d303f;
  font: inherit;
}
.shogi-game .shogi-note__declare .shogi-note__measure { margin-top: 0; }
.shogi-game .shogi-note__measure:disabled { opacity: 0.5; cursor: default; }
.shogi-game .shogi-note__copy {
  margin-top: 0.6rem;
  padding: 0.4rem 0.9rem;
  border: 1px solid rgba(255, 252, 244, 0.6);
  border-radius: 0.4rem;
  color: #fffcf4;
  background: transparent;
  font: inherit;
  cursor: pointer;
}
.shogi-game .shogi-note__trend-note,
.shogi-game .shogi-note__hint {
  margin: 0.3rem 0 0;
  color: rgba(255, 252, 244, 0.7);
  font-size: 0.8em;
}
.shogi-game .shogi-note__rows {
  display: grid;
  gap: 0.45rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.shogi-game .shogi-note__rows li {
  display: grid;
  grid-template-columns: minmax(6rem, 1fr) minmax(3rem, 1fr) auto;
  align-items: center;
  gap: 0.2rem 0.7rem;
}
.shogi-game .shogi-note__rows li:not(:has(.shogi-note__bar)) { grid-template-columns: 1fr auto; }
.shogi-game .shogi-note__name { font-weight: 700; overflow-wrap: anywhere; }
.shogi-game .shogi-note__stat { font-size: 0.85em; text-align: right; white-space: nowrap; }
.shogi-game .shogi-note__bar {
  height: 0.6rem;
  border-radius: 999px;
  background: rgba(255, 252, 244, 0.15);
  overflow: hidden;
}
.shogi-game .shogi-note__bar span {
  display: block;
  height: 100%;
  background: #f1a54c;
}
@media (max-width: 520px) {
  .shogi-game .shogi-note__rows li,
  .shogi-game .shogi-note__rows li:not(:has(.shogi-note__bar)) { grid-template-columns: 1fr auto; }
  .shogi-game .shogi-note__bar { grid-column: 1 / -1; grid-row: 2; }
}
</style>
