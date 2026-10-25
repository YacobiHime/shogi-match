<template>
  <!--
    棋士の能力値(パワプロの基本能力に当たる)。主役はレーダーチャートとランクの文字(U:4。数字を読まなくても、何が得意か分かる)。
    その下に、特殊能力の札(金・青・赤)と、戦法の使用率。名鑑と、竜王戦の次の相手の札で共通に使う。
  -->
  <div class="player-ability" :class="{ 'player-ability--compact': compact }" data-player-ability>
    <div class="player-ability__main">
      <RadarChart class="player-ability__radar" :axes="radarAxes" :value-offset="20" :compare="compareValues" />
      <ul class="player-ability__ranks" :class="{ 'player-ability__ranks--compare': compare }" aria-label="能力のランク">
        <li v-for="(item, index) in view.abilities" :key="item.key" :title="item.hint">
          <span class="player-ability__label">{{ item.label }}</span>
          <b class="player-ability__rank" :class="`player-ability__rank--${item.rank}`" :data-rank="item.rank">{{ item.rank }}</b>
          <span class="player-ability__value">{{ item.value }}</span>
          <span v-if="compare" class="player-ability__compare-rank" :aria-label="`${compare.label}は${compare.abilities[index]?.rank}`">{{ compare.abilities[index]?.rank }}</span>
        </li>
      </ul>
    </div>
    <!-- 比べる相手がいるときの凡例。線の形(実線・点線)と名前で区別する。 -->
    <p v-if="compare" class="player-ability__legend" data-ability-legend>
      <span class="player-ability__legend-own">{{ ownLabel }}</span>
      <span class="player-ability__legend-compare">{{ compare.label }}</span>
    </p>
    <p v-if="view.type" class="player-ability__type">{{ view.type }}</p>
    <ul v-if="view.specials.length" class="player-ability__specials" aria-label="特殊能力">
      <li v-for="chip in view.specials" :key="chip.id" :data-special="chip.tier">
        <span class="player-ability__chip" :class="`player-ability__chip--${chip.tier}`">{{ TIER_MARK[chip.tier] }}{{ chip.label }}</span>
        <small v-if="!compact && chip.hint">{{ chip.hint }}</small>
      </li>
    </ul>
    <div v-if="view.openings.length" class="player-ability__openings" data-player-openings>
      <p v-if="view.staticShare !== null" class="player-ability__party">
        <span class="player-ability__party-bar" aria-hidden="true">
          <span class="player-ability__party-static" :style="{ width: `${view.staticShare}%` }" />
        </span>
        <span>居飛車 {{ view.staticShare }}%・振り飛車 {{ 100 - view.staticShare }}%</span>
      </p>
      <ul class="player-ability__usage" aria-label="戦法の使用率">
        <li v-for="row in shownOpenings" :key="row.id">
          <span class="player-ability__usage-label">{{ row.label }}</span>
          <span class="player-ability__usage-bar" aria-hidden="true">
            <span :class="`player-ability__usage-fill--${row.rook}`" :style="{ width: `${Math.max(4, row.share)}%` }" />
          </span>
          <span class="player-ability__usage-share">{{ row.share }}%</span>
          <small v-if="!compact && (row.castles.length || row.record)" class="player-ability__usage-note">
            {{ [row.castles.map((castle) => `${castle.label} ${castle.share}%`).join("・"), row.record ? `通算${row.record}` : ""].filter(Boolean).join("　") }}
          </small>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, type PropType } from "vue";
import RadarChart from "./RadarChart.vue";

type AbilityView = {
  abilities: { key: string; label: string; hint: string; value: number; rank: string }[];
  type: string;
  specials: { id: string; tier: string; label: string; hint: string }[];
  staticShare: number | null;
  openings: { id: string; label: string; rook: string; share: number; castles: { id: string; label: string; share: number }[]; record: string }[];
};

const props = defineProps({
  view: { type: Object as PropType<AbilityView>, required: true },
  /** 次の相手の札など、狭い場所に出すとき。特殊能力の説明と囲いを省き、戦法は3つまで。 */
  compact: { type: Boolean, default: false },
  /** 比べる相手(やこびノートの自分の能力)。レーダーチャートに点線で重ね、ランクを横に小さく並べる。 */
  compare: { type: Object as PropType<{ label: string; abilities: { key: string; value: number; rank: string }[] } | null>, default: null },
  /** 比べるときの、自分の名前(凡例)。 */
  ownLabel: { type: String, default: "あなた" },
});

/** 札の頭の印(色だけに頼らず、形でも区別する)。 */
const TIER_MARK: Record<string, string> = Object.freeze({ gold: "★", blue: "＋", red: "−" });
const radarAxes = computed(() => props.view.abilities.map(({ key, label, value }) => ({ key, label, value })));
const compareValues = computed(() => (props.compare ? props.view.abilities.map(({ key }) => props.compare?.abilities.find((item) => item.key === key)?.value ?? null) : null));
const shownOpenings = computed(() => props.view.openings.slice(0, props.compact ? 3 : 6));
</script>

<style>
.shogi-game .player-ability { display: grid; gap: 0.6rem; min-width: 0; container-type: inline-size; }
.shogi-game .player-ability__main { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.4rem 0.8rem; align-items: center; }
.shogi-game .player-ability__radar { max-width: 19rem; justify-self: center; }
/* 小さく描くので、レーダーチャートの文字を図の単位で大きくする(画面で約11〜13px)。 */
.shogi-game .player-ability__radar .shogi-radar__label { font-size: 19px; }
.shogi-game .player-ability__radar .shogi-radar__value { font-size: 17px; }
.shogi-game .player-ability__ranks { display: grid; gap: 0.15rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .player-ability__ranks li { display: grid; grid-template-columns: 3.4em 1.7em 2em; align-items: center; gap: 0.3rem; }
.shogi-game .player-ability__label { font-size: 0.85em; font-weight: 700; }
.shogi-game .player-ability__rank {
  display: grid;
  place-items: center;
  height: 1.55em;
  border-radius: 0.2rem;
  color: #172632;
  background: #8fa3b6;
  font-size: 1.05em;
  font-weight: 900;
}
/* 高いランクほど濃く、明るく。文字でも読めるので、色だけに頼らない。 */
.shogi-game .player-ability__rank--S { background: #f1a54c; box-shadow: 0 0 0 2px #fff3d6 inset; }
.shogi-game .player-ability__rank--A { background: #f1a54c; }
.shogi-game .player-ability__rank--B { background: #e6c88c; }
.shogi-game .player-ability__rank--C { background: #b9d18e; }
.shogi-game .player-ability__rank--D { background: #8ec5cf; }
.shogi-game .player-ability__rank--E { background: #a9b6c4; }
.shogi-game .player-ability__rank--F,
.shogi-game .player-ability__rank--G { color: #fffcf4; background: #55697d; }
.shogi-game .player-ability__value { color: rgba(255, 252, 244, 0.75); font-size: 0.82em; font-variant-numeric: tabular-nums; text-align: right; }
.shogi-game .player-ability__ranks--compare li { grid-template-columns: 3.4em 1.7em 2em 1.4em; }
.shogi-game .player-ability__compare-rank { color: #8fc5ff; font-size: 0.85em; font-weight: 900; text-align: center; }
.shogi-game .player-ability__legend { display: flex; flex-wrap: wrap; gap: 0.3rem 1rem; margin: 0; font-size: 0.82em; }
.shogi-game .player-ability__legend span::before { display: inline-block; width: 1.6em; margin-right: 0.35em; vertical-align: middle; border-top: 3px solid #f1a54c; content: ""; }
.shogi-game .player-ability__legend-compare::before { border-top-style: dashed !important; border-top-color: #8fc5ff !important; }
.shogi-game .player-ability__type { margin: 0; color: #f1a54c; font-size: 0.85em; font-weight: 800; }
.shogi-game .player-ability__specials { display: grid; gap: 0.3rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .player-ability--compact .player-ability__specials { display: flex; flex-wrap: wrap; }
.shogi-game .player-ability__specials li { display: grid; gap: 0.1rem; }
.shogi-game .player-ability__specials small { color: rgba(255, 252, 244, 0.7); font-size: 0.78em; line-height: 1.4; }
.shogi-game .player-ability__chip {
  justify-self: start;
  padding: 0.12rem 0.55rem;
  border-radius: 999px;
  font-size: 0.82em;
  font-weight: 800;
}
.shogi-game .player-ability__chip--gold { color: #172632; background: linear-gradient(135deg, #ffe29a, #f1a54c); }
.shogi-game .player-ability__chip--blue { color: #fffcf4; background: #2f6fa8; }
.shogi-game .player-ability__chip--red { color: #fffcf4; background: #a8463f; }
.shogi-game .player-ability__party { display: grid; gap: 0.2rem; margin: 0; font-size: 0.8em; }
.shogi-game .player-ability__party-bar,
.shogi-game .player-ability__usage-bar { display: block; height: 0.5rem; overflow: hidden; border-radius: 999px; background: rgba(255, 252, 244, 0.14); }
.shogi-game .player-ability__party-bar { background: #a8463f; }
.shogi-game .player-ability__party-static { display: block; height: 100%; background: #2f6fa8; }
.shogi-game .player-ability__usage { display: grid; gap: 0.3rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .player-ability__usage li { display: grid; grid-template-columns: minmax(0, 9.5em) minmax(3rem, 1fr) 2.6em; align-items: center; gap: 0.1rem 0.5rem; }
.shogi-game .player-ability__usage-label { overflow: hidden; font-size: 0.85em; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.shogi-game .player-ability__usage-bar span { display: block; height: 100%; border-radius: 999px; }
.shogi-game .player-ability__usage-fill--static { background: #4d8ac4; }
.shogi-game .player-ability__usage-fill--ranging { background: #c56a5f; }
.shogi-game .player-ability__usage-share { font-size: 0.82em; font-variant-numeric: tabular-nums; text-align: right; }
.shogi-game .player-ability__usage-note { grid-column: 1 / -1; color: rgba(255, 252, 244, 0.65); font-size: 0.75em; }
/* 置き場所の幅で並べ方を変える(名鑑はタブレットでも狭いので、画面の幅ではなく、この欄の幅で決める)。 */
@container (max-width: 34rem) {
  .shogi-game .player-ability__main { grid-template-columns: minmax(0, 1fr); }
  .shogi-game .player-ability__radar { max-width: 100%; }
  .shogi-game .player-ability__ranks { grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 0.8rem; justify-self: center; }
}
</style>
