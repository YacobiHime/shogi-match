<template>
  <div class="shogi-dex shogi-note" role="dialog" aria-modal="true" aria-labelledby="shogi-note-title">
    <header class="shogi-dex__header">
      <button type="button" class="shogi-dex__back" @click="emit('close')">
        <span aria-hidden="true">←</span> {{ backLabel }}
      </button>
      <h1 id="shogi-note-title">やこびノート</h1>
    </header>

    <div class="shogi-note__body">
      <!-- 上段: やこび姫のひとことと、プロフィール -->
      <div class="shogi-note__hero">
        <div class="shogi-note__coach">
          <YakobiSays :lines="messages" size="xl" merged name-tag :asset-base-url="assetBaseUrl" />
        </div>

        <section class="shogi-note__card shogi-note__profile" aria-labelledby="shogi-note-profile" data-note-profile>
          <h2 id="shogi-note-profile">プロフィール</h2>
          <p class="shogi-note__affiliation">
            <span>所属</span>
            <strong>{{ affiliation ? affiliation.label : "まだ所属なし" }}</strong>
          </p>
          <p v-if="!profile.titles.length" class="shogi-note__hint">
            まだ称号がありません。タイトル画面の「大会」に挑戦して、称号を手に入れよう！
          </p>
          <ul v-else class="shogi-note__titles">
            <li v-for="title in titles" :key="title.id" data-note-title>
              <strong>{{ title.label }}</strong>
              <small>{{ title.detail }}{{ title.at ? `（${new Date(title.at).toLocaleDateString("ja-JP")}）` : "" }}</small>
            </li>
          </ul>
        </section>
      </div>

      <!-- レーティング: 数字・成績・推移と、棋力の測定 -->
      <section class="shogi-note__card shogi-note__rating-card" aria-labelledby="shogi-note-rating">
        <h2 id="shogi-note-rating">レーティング</h2>
        <div class="shogi-note__rating-grid">
          <div class="shogi-note__rating-main">
            <p class="shogi-note__rating">
              <strong>R{{ state.rating }}</strong>
              <span class="shogi-note__chip">目安 Lv.{{ nearestPreset.level }} {{ nearestPreset.label }}</span>
            </p>
            <dl class="shogi-note__tiles" data-note-record>
              <div><dt>対局</dt><dd>{{ state.games }}</dd></div>
              <div><dt>勝ち</dt><dd>{{ state.wins }}</dd></div>
              <div><dt>負け</dt><dd>{{ state.losses }}</dd></div>
              <div><dt>引き分け</dt><dd>{{ state.draws }}</dd></div>
              <div><dt>勝率</dt><dd>{{ state.games ? percent(state.wins / state.games) : "—" }}</dd></div>
            </dl>
            <p class="shogi-note__hint">平手の通常対局（対CPU）の結果だけを数えています。</p>
          </div>
          <figure class="shogi-note__trend-box">
            <template v-if="trend">
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
              <figcaption class="shogi-note__trend-note">直近{{ trend.count }}局の推移（R{{ trend.min }}〜R{{ trend.max }}）</figcaption>
            </template>
            <p v-else class="shogi-note__trend-empty">2局以上指すと、ここにレーティングの推移が出ます。</p>
          </figure>
        </div>

        <div class="shogi-note__measure-box">
          <div class="shogi-note__measure-head">
            <h3>棋力を測る</h3>
            <p class="shogi-note__hint">
              CPUと1局指すと、終局後に棋譜解析で指し手の評価値の損を調べ、レーティングと級・段の目安を診断します。
              結果は解析画面から、あなたのレーティングに設定できます。
            </p>
            <p v-if="state.measured" class="shogi-note__hint" data-note-measured>
              棋力測定で R{{ state.measured.rating }}（{{ state.measured.label }}）を設定しました（{{ measuredDate }}）。
            </p>
          </div>
          <button type="button" class="shogi-note__button shogi-note__button--primary" @click="emit('start-measure')">棋力を測る</button>
        </div>

        <div class="shogi-note__measure-box">
          <div class="shogi-note__measure-head">
            <h3>段級位を申告する</h3>
            <p class="shogi-note__hint">
              日本将棋連盟の段級位で申告すると、レーティングをその棋力に設定します。
              以降の対局は、申告ごとにCPUのレベル別の成績を記録し、表示名と実際の棋力のずれを調べるのに使います。
            </p>
            <p v-if="state.declared" class="shogi-note__hint" data-note-declared>
              申告中: {{ state.declared.label }}（{{ declaredDate }}に設定）
            </p>
          </div>
          <div class="shogi-note__declare">
            <select v-model="declareLabel" aria-label="申告する段級位">
              <option value="">段級位を選ぶ</option>
              <option v-for="grade in grades" :key="grade.label" :value="grade.label">{{ grade.label }}</option>
            </select>
            <button type="button" class="shogi-note__button" :disabled="!declareLabel" @click="declare">申告して設定</button>
          </div>
        </div>
      </section>

      <!-- 記録のカード。左に竜王戦と成績、右に戦法・囲いの使用率。狭い画面では1列。 -->
      <div class="shogi-note__grid">
        <div class="shogi-note__stack">
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

          <section v-if="levelRows.length" class="shogi-note__card" aria-labelledby="shogi-note-levels">
            <h2 id="shogi-note-levels">CPUのレベルごとの成績</h2>
            <ul class="shogi-note__rows">
              <li v-for="row in levelRows" :key="row.level">
                <span class="shogi-note__name">Lv.{{ row.level }} {{ row.label }}</span>
                <span class="shogi-note__stat">R{{ row.rating }}・{{ row.wins }}勝{{ row.losses }}敗{{ row.draws }}分</span>
              </li>
            </ul>
          </section>

          <section v-if="declaredRows.length || state.games" class="shogi-note__card" aria-labelledby="shogi-note-declared">
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
        </div>
        <div class="shogi-note__stack">
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

        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, type PropType } from "vue";
import RyuoLadder from "./RyuoLadder.vue";
import YakobiSays from "./YakobiSays.vue";
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
type HistoryEntry = {
  no: number; mode: string; startGroup: number; newGroup: number; outcome: string; wins: number; losses: number; promoted: boolean; relegated: boolean;
};
type RyuoCareer = {
  group: number; seasons: number; champion: boolean; titles: number; streak: number; bestStreak: number;
  challenges: number; eternal: boolean;
  history: HistoryEntry[];
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

const measuredDate = computed(() => {
  const at = props.state.measured?.at;
  return at ? new Date(at).toLocaleDateString("ja-JP") : "";
});
const affiliation = computed(() => currentAffiliation(props.profile));
/** 称号は高いものから、大会の成績は新しいものから並べる。 */
const titles = computed(() => [...props.profile.titles].sort((a, b) => b.rank - a.rank || a.at - b.at));
const recentHistory = computed(() => [...props.career.history].reverse().slice(0, 8));
/** 成績の行の色分け: 竜王・昇級・降級・そのほか。 */
function historyKind(entry: HistoryEntry) {
  if (entry.outcome === "champion") return "crown";
  if (entry.promoted) return "up";
  if (entry.relegated || entry.outcome === "defense-lost") return "down";
  return "stay";
}
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

/** やこび姫のひとこと。全体の様子と、得意な戦法(3局以上で、いちばん勝率の高いもの)。 */
const messages = computed(() => {
  const { games, wins, rating } = props.state;
  if (!games) return ["ここは、あなたの対局の記録をまとめるノートだよ。", "対局すると、レーティングや得意な戦法が書き込まれていくよ！"];
  if (games < 5) return [`まだ${games}局だけど、もう書き込みが始まったよ。`, "たくさん指して、ノートを育てよう！"];
  const lines = [`${games}局で${wins}勝！ 今のレーティングはR${rating}だよ。`];
  const best = usageRows(props.state, "rook")
    .filter((row: { games: number }) => row.games >= 3)
    .sort((a: { wins: number; games: number }, b: { wins: number; games: number }) => b.wins / b.games - a.wins / a.games)[0];
  if (best) lines.push(`いちばん勝てているのは「${best.name}」。勝率${percent(best.wins / best.games)}だよ！`);
  lines.push("ノートを見て、得意な戦法と苦手な戦法を確かめよう！");
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
/* やこびノート。竜王戦の画面と同じく、ドット絵のやこび姫の配色(紺・スレート・クリーム・橙・ラベンダー)で、
 * グラデーションを使わない平らな面と、角の立った枠にそろえる。 */
.shogi-game .shogi-dex.shogi-note {
  --note-gold: #f1a54c;
  --note-lavender: #d8d0ff;
  --note-panel: #2c4359;
  --note-deep: #172632;
  --note-shadow: #121e29;
  --note-line: rgba(255, 252, 244, 0.16);
  --note-control: 2.75rem;
  --note-mincho: "Yu Mincho", "YuMincho", "Hiragino Mincho ProN", "Noto Serif JP", serif;
  background: #1e2d3d;
  font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Yu Gothic", "Meiryo", sans-serif;
}
.shogi-game .shogi-note__body {
  flex: 1;
  display: grid;
  align-content: start;
  gap: 1rem;
  width: min(100%, 76rem);
  margin: 0 auto;
  box-sizing: border-box;
  overflow-y: auto;
  padding: 1rem clamp(0.8rem, 3vw, 2rem) 2rem;
  font-size: var(--dex-text);
}
.shogi-game .shogi-note__hero { display: grid; gap: 1rem; grid-template-columns: minmax(0, 1fr); align-items: stretch; }
@media (min-width: 860px) {
  .shogi-game .shogi-note__hero { grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); }
}
.shogi-game .shogi-note__coach {
  padding: 1.1rem 1.1rem 1.5rem;
  border: 2px solid var(--note-lavender);
  border-radius: 0.2rem;
  background: var(--note-panel);
  box-shadow: 4px 4px 0 var(--note-shadow);
}
.shogi-game .shogi-note__card {
  display: grid;
  align-content: start;
  gap: 0.75rem;
  min-width: 0;
  padding: 1rem 1.1rem;
  border: 2px solid #3b5570;
  border-radius: 0.2rem;
  background: var(--note-panel);
}
.shogi-game .shogi-note__card h2 {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin: 0;
  color: var(--note-gold);
  font-size: 0.95em;
  letter-spacing: 0.12em;
}
.shogi-game .shogi-note__card h2::before {
  content: "";
  width: 0.5rem;
  height: 0.5rem;
  background: var(--note-gold);
}
.shogi-game .shogi-note__affiliation {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.2rem 0.8rem;
  margin: 0;
}
.shogi-game .shogi-note__affiliation span { color: rgba(255, 252, 244, 0.7); font-weight: 700; }
.shogi-game .shogi-note__affiliation strong { font-family: var(--note-mincho); font-size: 2em; line-height: 1.2; }
.shogi-game .shogi-note__titles { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .shogi-note__titles li {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
  padding: 0.45rem 0.9rem;
  border-radius: 0.15rem;
  color: #172632;
  background: var(--note-gold);
  box-shadow: 3px 3px 0 var(--note-shadow);
}
.shogi-game .shogi-note__titles strong { font-family: var(--note-mincho); font-size: 1.15em; }
.shogi-game .shogi-note__titles small { font-size: 0.75em; }
.shogi-game .shogi-note__subhead { margin: 0.3rem 0 0; color: rgba(255, 252, 244, 0.8); font-size: 0.9em; }

/* レーティング */
.shogi-game .shogi-note__rating-grid { display: grid; gap: 1rem; grid-template-columns: minmax(0, 1fr); }
@media (min-width: 860px) {
  .shogi-game .shogi-note__rating-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: stretch; }
}
.shogi-game .shogi-note__rating-main { display: grid; align-content: start; gap: 0.7rem; }
.shogi-game .shogi-note__rating { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem 1rem; margin: 0; }
.shogi-game .shogi-note__rating strong { font-size: clamp(2.4rem, 1.8rem + 2vw, 3.4rem); font-weight: 800; line-height: 1; letter-spacing: 0.02em; }
.shogi-game .shogi-note__chip {
  padding: 0.2rem 0.8rem;
  border: 2px solid var(--note-gold);
  border-radius: 0.15rem;
  color: var(--note-gold);
  font-weight: 700;
}
.shogi-game .shogi-note__tiles { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0.5rem; margin: 0; }
.shogi-game .shogi-note__tiles--four { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.shogi-game .shogi-note__tiles > div {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
  padding: 0.5rem 0.6rem;
  border-radius: 0.15rem;
  background: var(--note-deep);
}
.shogi-game .shogi-note__tiles dt { color: rgba(255, 252, 244, 0.65); font-size: 0.75em; font-weight: 700; white-space: nowrap; }
.shogi-game .shogi-note__tiles dd { margin: 0; font-size: 1.3em; font-weight: 800; line-height: 1.2; }
.shogi-game .shogi-note__tiles dd small { margin-left: 0.1rem; font-size: 0.6em; }
.shogi-game .shogi-note__trend-box {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  grid-template-rows: minmax(7rem, 1fr) auto;
  gap: 0.3rem 0.5rem;
  margin: 0;
  padding: 0.7rem 0.8rem;
  border-radius: 0.15rem;
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
.shogi-game .shogi-note__trend { display: block; width: 100%; height: 100%; min-height: 7rem; }
.shogi-game .shogi-note__trend-note { grid-column: 2; color: rgba(255, 252, 244, 0.7); font-size: 0.78em; }
.shogi-game .shogi-note__trend-empty { grid-column: 1 / -1; align-self: center; margin: 0; color: rgba(255, 252, 244, 0.6); text-align: center; }
.shogi-game .shogi-note__measure-box {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
  gap: 0.6rem 1.2rem;
  padding-top: 0.9rem;
  border-top: 1px solid var(--note-line);
}
@media (min-width: 760px) {
  .shogi-game .shogi-note__measure-box { grid-template-columns: minmax(0, 1fr) 22rem; }
}
.shogi-game .shogi-note__measure-head { display: grid; gap: 0.25rem; min-width: 0; }
.shogi-game .shogi-note__measure-head h3 { margin: 0; font-size: 1em; }
/* 操作ボタンとセレクトは、同じ高さにそろえる */
.shogi-game .shogi-note__button,
.shogi-game .shogi-note__declare select {
  box-sizing: border-box;
  height: var(--note-control);
  border-radius: 0.2rem;
  font: inherit;
}
.shogi-game .shogi-note__button {
  width: 100%;
  padding: 0 1rem;
  border: 2px solid rgba(255, 252, 244, 0.6);
  color: #fffcf4;
  background: transparent;
  font-weight: 800;
  white-space: nowrap;
  cursor: pointer;
}
.shogi-game .shogi-note__button--primary {
  border-color: #f1a54c;
  color: #172632;
  background: var(--note-gold);
  box-shadow: 0 0.2rem 0 #b06a1c;
}
.shogi-game .shogi-note__button--ghost { justify-self: start; width: auto; border-width: 1px; font-weight: 700; }
.shogi-game .shogi-note__button:disabled { opacity: 0.45; cursor: default; }
.shogi-game .shogi-note__declare { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 0.5rem; }
.shogi-game .shogi-note__declare select {
  width: 100%;
  padding: 0 0.6rem;
  border: 2px solid rgba(255, 252, 244, 0.4);
  color: #fffcf4;
  background: var(--note-deep);
}
.shogi-game .shogi-note__hint { margin: 0; color: rgba(255, 252, 244, 0.7); font-size: 0.8em; line-height: 1.6; }

/* 記録のカードは、段組みで詰めて並べる */
.shogi-game .shogi-note__grid { display: grid; gap: 1rem; grid-template-columns: minmax(0, 1fr); align-items: start; }
@media (min-width: 860px) {
  .shogi-game .shogi-note__grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
}
.shogi-game .shogi-note__stack { display: grid; gap: 1rem; min-width: 0; }

/* 竜王戦の成績 */
.shogi-game .shogi-note__history { display: grid; gap: 0.35rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .shogi-note__history li {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.6rem;
  padding: 0.4rem 0.6rem;
  border-left: 3px solid rgba(255, 252, 244, 0.35);
  border-radius: 0.15rem;
  background: var(--note-deep);
  font-size: 0.9em;
}
.shogi-game .shogi-note__history li.shogi-note__history--crown { border-left-color: var(--note-gold); background: rgba(241, 165, 76, 0.14); }
.shogi-game .shogi-note__history li.shogi-note__history--up { border-left-color: var(--note-gold); }
.shogi-game .shogi-note__history li.shogi-note__history--down { border-left-color: var(--note-lavender); }
.shogi-game .shogi-note__history-no { font-weight: 800; }
.shogi-game .shogi-note__history-group { color: var(--note-gold); font-weight: 700; }
.shogi-game .shogi-note__history-text { overflow-wrap: anywhere; }
.shogi-game .shogi-note__history-record { white-space: nowrap; }

/* 使用率・成績の行 */
.shogi-game .shogi-note__rows { display: grid; gap: 0.5rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .shogi-note__rows li {
  display: grid;
  grid-template-columns: minmax(6rem, 1fr) minmax(3rem, 1fr) auto;
  align-items: center;
  gap: 0.2rem 0.7rem;
}
.shogi-game .shogi-note__rows li:not(:has(.shogi-note__bar)) { grid-template-columns: 1fr auto; }
.shogi-game .shogi-note__name { font-weight: 700; overflow-wrap: anywhere; }
.shogi-game .shogi-note__stat { font-size: 0.85em; text-align: right; white-space: nowrap; }
.shogi-game .shogi-note__bar { height: 0.55rem; background: var(--note-deep); overflow: hidden; }
.shogi-game .shogi-note__bar span { display: block; height: 100%; background: var(--note-gold); }
@media (max-width: 520px) {
  .shogi-game .shogi-note__rows li,
  .shogi-game .shogi-note__rows li:not(:has(.shogi-note__bar)) { grid-template-columns: 1fr auto; }
  .shogi-game .shogi-note__bar { grid-column: 1 / -1; grid-row: 2; }
  .shogi-game .shogi-note__tiles { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .shogi-game .shogi-note__tiles--four { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .shogi-game .shogi-note__declare { grid-template-columns: minmax(0, 1fr); }
  .shogi-game .shogi-note__history li { grid-template-columns: auto auto minmax(0, 1fr); }
  .shogi-game .shogi-note__history-record { grid-column: 3; justify-self: end; }
}
</style>
