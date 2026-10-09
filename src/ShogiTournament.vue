<template>
  <div class="shogi-dex shogi-tournament" role="dialog" aria-modal="true" aria-labelledby="shogi-tournament-title">
    <header class="shogi-dex__header">
      <button type="button" class="shogi-dex__back" @click="emit('close')">
        <span aria-hidden="true">←</span> {{ backLabel }}
      </button>
      <h1 id="shogi-tournament-title">大会</h1>
    </header>

    <div class="shogi-tournament__body">
      <div class="shogi-dex__speech shogi-tournament__intro">
        <img class="shogi-dex__chara" :src="charaUrl" alt="" aria-hidden="true">
        <p>大会に挑戦して、称号を手に入れよう！ 今は、プロ棋士への道の最初の関門「研修会入会試験」に挑戦できるよ。</p>
      </div>

      <section class="shogi-tournament__card" aria-labelledby="shogi-tournament-pick">
        <h2 id="shogi-tournament-pick">挑戦する大会</h2>
        <div class="shogi-tournament__list" role="radiogroup" aria-label="挑戦する大会">
          <button
            v-for="item in TOURNAMENTS"
            :key="item.id"
            type="button"
            role="radio"
            class="shogi-tournament__option"
            :aria-checked="item.id === tournamentId"
            @click="tournamentId = item.id"
          >
            <strong>{{ item.label }}</strong>
            <small>{{ item.description }}</small>
            <small v-if="earned(item.id)" class="shogi-tournament__earned">獲得済み: {{ earned(item.id) }}</small>
          </button>
        </div>
      </section>

      <section class="shogi-tournament__card" aria-labelledby="shogi-tournament-settings">
        <h2 id="shogi-tournament-settings">設定</h2>
        <div class="shogi-tournament__field">
          <span id="shogi-tournament-games">対局数</span>
          <div class="shogi-tournament__choices" role="radiogroup" aria-labelledby="shogi-tournament-games">
            <button
              v-for="count in definition.gameOptions"
              :key="count"
              type="button"
              role="radio"
              :aria-checked="count === games"
              @click="games = count"
            >{{ count === 1 ? "1局（短縮）" : `${count}局` }}</button>
          </div>
        </div>
        <label class="shogi-tournament__field">
          <span>相手の強さ</span>
          <select v-model.number="baseLevel" aria-label="相手の強さ（基準のレベル）">
            <option v-for="preset in CPU_STRENGTH_PRESETS" :key="preset.level" :value="preset.level">
              Lv.{{ preset.level }} {{ preset.label }}
            </option>
          </select>
        </label>
        <p class="shogi-tournament__hint">基準のレベルです。局が進むほど、基準より少しずつ強い相手になります。</p>
        <p class="shogi-tournament__summary" data-tournament-summary>{{ summary }}</p>
        <button type="button" class="shogi-tournament__start" data-tournament-start @click="start">大会に挑戦する</button>
      </section>

      <section class="shogi-tournament__card" aria-labelledby="shogi-tournament-titles">
        <h2 id="shogi-tournament-titles">あなたの称号</h2>
        <p v-if="!profile.titles.length" class="shogi-tournament__hint">まだ称号がありません。</p>
        <ul v-else class="shogi-tournament__titles">
          <li v-for="title in titles" :key="title.id">
            <strong>{{ title.label }}</strong>
            <small>{{ title.detail }}</small>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, type PropType } from "vue";
import { TOURNAMENTS, createTournamentRun, examPassLine, tournamentById } from "./core/tournament.mjs";
import { CPU_STRENGTH_PRESETS } from "./core/strength-settings.mjs";

type ProfileState = {
  titles: { id: string; label: string; detail: string; rank: number; at: number }[];
  history: { id: string; label: string; passed: boolean; record: string; grade: string | null; at: number }[];
};

const props = defineProps({
  assetBaseUrl: { type: String, default: "." },
  backLabel: { type: String, default: "タイトルへ戻る" },
  profile: { type: Object as PropType<ProfileState>, default: () => ({ titles: [], history: [] }) },
});
const emit = defineEmits<{
  close: [];
  start: [settings: { id: string; total: number; baseLevel: number }];
}>();

const charaUrl = computed(() => `${props.assetBaseUrl}/characters/yakobihime-mini.webp?v=2`);
const tournamentId = ref(TOURNAMENTS[0].id);
const definition = computed(() => tournamentById(tournamentId.value) ?? TOURNAMENTS[0]);
const games = ref(TOURNAMENTS[0].defaultGames);
const baseLevel = ref(TOURNAMENTS[0].defaultLevel);

const titles = computed(() => [...props.profile.titles].sort((a, b) => b.rank - a.rank || a.at - b.at));
/** 大会で、これまでに獲得した最も高い称号。 */
function earned(id: string) {
  const grades = props.profile.history.filter((entry) => entry.id === id && entry.passed && entry.grade);
  if (!grades.length) return "";
  const best = grades.some((entry) => entry.grade === "F1") ? "F1" : "F2";
  return `研修会 ${best}クラス`;
}

const summary = computed(() => {
  const run = createTournamentRun({ id: definition.value.id, total: games.value, baseLevel: baseLevel.value });
  const opponents = run.levels.map((level) => `Lv.${level}`).join("→");
  const sweep = run.total >= 3 ? "全勝するとF1クラスで入会できます。" : "";
  return `先手と後手を入れ替えて${run.total}局指します（相手は${opponents}）。`
    + `${examPassLine(run.total)}勝以上で合格し、研修会F2クラスで入会します。${sweep}`
    + "これはこのゲームの簡易版で、実際の試験の規定ではありません。";
});

function start() {
  emit("start", { id: definition.value.id, total: games.value, baseLevel: baseLevel.value });
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
.shogi-game .shogi-tournament__option[aria-checked="true"] {
  border-color: #f1a54c;
  background: rgba(241, 165, 76, 0.14);
}
.shogi-game .shogi-tournament__option small { color: rgba(255, 252, 244, 0.8); }
.shogi-game .shogi-tournament__option .shogi-tournament__earned { color: #f1a54c; font-weight: 700; }
.shogi-game .shogi-tournament__field {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem 0.8rem;
  margin-bottom: 0.6rem;
}
.shogi-game .shogi-tournament__field > span { min-width: 6em; font-weight: 700; }
.shogi-game .shogi-tournament__choices { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.shogi-game .shogi-tournament__choices button {
  min-height: 2.4rem;
  padding: 0 0.9rem;
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
.shogi-game .shogi-tournament__field select {
  min-height: 2.4rem;
  padding: 0 0.6rem;
  border: 1px solid rgba(255, 252, 244, 0.5);
  border-radius: 0.4rem;
  color: #fffcf4;
  background: #1d303f;
  font: inherit;
}
.shogi-game .shogi-tournament__hint { margin: 0.2rem 0 0.4rem; color: rgba(255, 252, 244, 0.7); font-size: 0.85em; }
.shogi-game .shogi-tournament__summary { margin: 0.4rem 0 0.8rem; line-height: 1.6; }
.shogi-game .shogi-tournament__start {
  display: block;
  width: 100%;
  min-height: 3rem;
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
.shogi-game .shogi-tournament__titles {
  display: grid;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.shogi-game .shogi-tournament__titles li { display: grid; gap: 0.1rem; }
.shogi-game .shogi-tournament__titles small { color: rgba(255, 252, 244, 0.8); }
</style>
