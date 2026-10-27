<template>
  <!--
    タイトル戦の二日制(docs/title-match-day-design.md)。封じ手のあとの「1日目のまとめ」と、終局後の「観戦記」。
    重ねて開くシートで、対局は止めない。背景を押すか「閉じる」で閉じる(戻る操作も同じ)。
  -->
  <div class="title-day" role="dialog" aria-modal="true" :aria-label="mode === 'summary' ? '1日目のまとめ' : '観戦記'" data-title-day @click.self="emit('close')">
    <section v-if="mode === 'summary' && summary" class="title-day__panel" data-day-summary>
      <header class="title-day__head">
        <small>{{ summary.heading }}</small>
        <h2>{{ summary.title }}</h2>
        <span v-if="summary.venue">{{ summary.venue }}</span>
      </header>
      <div v-if="summary.rate !== null" class="title-day__rate" data-day-rate>
        <p><b>形勢</b><span>あなた <strong>{{ summary.rate }}%</strong></span></p>
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" role="img" :aria-label="`1日目の勝率の移り変わり。封じ手のときあなた${summary.rate}%`">
          <rect x="0" y="0" width="100" height="20" class="title-day__rate-up" />
          <line x1="0" y1="20" x2="100" y2="20" class="title-day__rate-mid" />
          <polyline :points="summary.points" class="title-day__rate-line" />
          <line :x1="cursorX" y1="0" :x2="cursorX" y2="40" class="title-day__rate-cursor" />
        </svg>
        <small>上ほどあなたが良い。中継の勝率と同じ読み。縦の線は、下の盤の局面</small>
      </div>
      <!--
        盤でふりかえる(docs/title-match-day-design.mdの9章)。ここまでの局面を1手ずつ戻して見る。指せない盤で、対局の盤は動かさない。
        形勢が動いたところ(勝率の記録のとなりどうしの差が大きいところ)を押すと、その局面へ飛ぶ。どちらの手が悪いかは言わない。
      -->
      <div v-if="review" class="title-day__review" data-day-review>
        <h3>盤でふりかえる</h3>
        <div class="title-day__review-board">
          <ShogiMatchBoard
            :sfen="review.sfens[cursor] ?? review.sfens[0]"
            :last-move="cursor > 0 ? review.moves[cursor - 1]?.usi ?? '' : ''"
            :allow-move="false"
            :enable-drag-and-drop="false"
            :flip="review.flip"
            layout="compact"
            :asset-base-url="assetBaseUrl"
            :black-player-name="review.blackName"
            :white-player-name="review.whiteName"
          />
        </div>
        <p class="title-day__review-move" data-day-review-move aria-live="polite">
          {{ cursor > 0 ? `${cursor}手目 ${review.moves[cursor - 1]?.text ?? ""}` : "開始局面" }}<small>／{{ review.moves.length }}手</small>
        </p>
        <div class="title-day__review-nav">
          <button type="button" aria-label="開始局面へ" :disabled="cursor === 0" @click="cursor = 0">⏮</button>
          <button type="button" aria-label="一手戻る" :disabled="cursor === 0" data-day-review-prev @click="cursor -= 1">◀</button>
          <button type="button" aria-label="一手進む" :disabled="cursor >= review.moves.length" data-day-review-next @click="cursor += 1">▶</button>
          <button type="button" aria-label="いまの局面へ" :disabled="cursor >= review.moves.length" @click="cursor = review.moves.length">⏭</button>
        </div>
        <input
          type="range"
          min="0"
          :max="review.moves.length"
          :value="cursor"
          aria-label="ふりかえる局面の手数"
          @input="cursor = Number(($event.target as HTMLInputElement).value)"
        >
        <div v-if="review.highlights.length" class="title-day__review-points" data-day-review-points>
          <span>形勢が動いたところ</span>
          <button v-for="point in review.highlights" :key="point.ply" type="button" @click="cursor = point.ply">
            {{ point.label }}<b>あなた {{ point.delta > 0 ? "+" : "−" }}{{ Math.abs(point.delta) }}%</b>
          </button>
        </div>
      </div>
      <dl class="title-day__facts">
        <div><dt>戦型</dt><dd>{{ summary.formationText }}</dd></div>
        <div><dt>駒の損得</dt><dd>{{ summary.materialText }}</dd></div>
        <div><dt>考えた時間</dt><dd>{{ summary.thinkText }}</dd></div>
        <div v-if="summary.mealText"><dt>勝負メシ</dt><dd>{{ summary.mealText }}</dd></div>
      </dl>
      <h3>控室の声</h3>
      <ul class="title-day__voices" data-day-voices>
        <li v-for="voice in summary.voices" :key="voice.role">
          <b>{{ voice.role }}</b><span class="title-day__voice-name">{{ voice.name }}</span>
          <p>「{{ voice.text }}」</p>
        </li>
      </ul>
      <p v-if="summary.sealText" class="title-day__seal" data-day-seal>
        <span>封じ手</span><b>{{ summary.sealText }}</b>
        <small v-if="summary.predictedText">控室の予想 {{ summary.predictedText }}</small>
      </p>
      <button type="button" class="title-day__close" data-day-close @click="emit('close')">対局へ戻る</button>
    </section>
    <article v-else-if="mode === 'kansenki' && article" class="title-day__panel title-day__paper" data-kansenki>
      <small class="title-day__paper-event">{{ article.eventText }} {{ article.label }}</small>
      <h2 class="title-day__paper-headline">{{ article.headline }}</h2>
      <p v-for="(paragraph, index) in article.paragraphs" :key="index">{{ paragraph }}</p>
      <button type="button" class="title-day__close" data-kansenki-close @click="emit('close')">閉じる</button>
    </article>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, type PropType } from "vue";
import ShogiMatchBoard from "./ShogiMatchBoard.vue";

/** ふりかえりの盤。sfensは0手目からの局面、movesは1手目からの指し手、highlightsは形勢が動いたところ。 */
export type DayReviewView = {
  sfens: string[];
  moves: { usi: string; text: string }[];
  highlights: { ply: number; label: string; delta: number }[];
  flip: boolean;
  blackName: string;
  whiteName: string;
};
export type DaySummaryView = {
  title: string;
  heading: string;
  venue: string;
  rate: number | null;
  points: string;
  formationText: string;
  materialText: string;
  thinkText: string;
  mealText: string;
  voices: { role: string; name: string; text: string }[];
  sealText: string;
  predictedText: string;
  review: DayReviewView | null;
};
export type KansenkiView = { headline: string; paragraphs: string[]; eventText: string; label: string };

const props = defineProps({
  mode: { type: String as PropType<"summary" | "kansenki">, required: true },
  summary: { type: Object as PropType<DaySummaryView | null>, default: null },
  article: { type: Object as PropType<KansenkiView | null>, default: null },
  assetBaseUrl: { type: String, default: "." },
});
const emit = defineEmits<{ close: [] }>();
const review = computed(() => props.summary?.review ?? null);
/** ふりかえる局面の手数。開いたときは、いちばん新しい局面。 */
const cursor = ref(review.value?.moves.length ?? 0);
watch(() => review.value?.moves.length ?? 0, (length) => { cursor.value = Math.min(cursor.value, length); });
const cursorX = computed(() => ((cursor.value / Math.max(1, review.value?.moves.length ?? 1)) * 100).toFixed(1));
</script>

<style>
.shogi-game .title-day {
  position: fixed;
  inset: 0;
  /* 結果の窓(z-index 100)の上に重ねる。 */
  z-index: 110;
  display: grid;
  place-items: center;
  padding: max(12px, env(safe-area-inset-top)) 16px max(12px, env(safe-area-inset-bottom));
  background: rgba(10, 18, 30, 0.72);
}
.shogi-game .title-day__panel {
  box-sizing: border-box;
  display: grid;
  /* 盤は枠の幅に合わせて描くので、列の幅を中身(盤)で広げない(横にはみ出さない)。 */
  grid-template-columns: minmax(0, 1fr);
  gap: 0.55rem;
  width: min(34rem, 100%);
  max-height: 100%;
  overflow-y: auto;
  padding: 1rem 1.1rem;
  border: 2px solid #c9962e;
  border-radius: 0.6rem;
  background: #1d303f;
  color: #fffcf4;
  box-shadow: 0 10px 0 rgba(0, 0, 0, 0.35);
}
.shogi-game .title-day__head { display: grid; gap: 0.1rem; }
.shogi-game .title-day__head small,
.shogi-game .title-day__head span { color: rgba(255, 252, 244, 0.72); font-size: 0.82em; }
.shogi-game .title-day__head h2,
.shogi-game .title-day h3 { margin: 0; color: #e6c15c; }
.shogi-game .title-day__head h2 { font-size: 1.3rem; }
.shogi-game .title-day h3 { font-size: 1rem; }
.shogi-game .title-day__rate { display: grid; gap: 0.25rem; }
.shogi-game .title-day__rate p { display: flex; justify-content: space-between; margin: 0; }
.shogi-game .title-day__rate strong { font-size: 1.25em; }
.shogi-game .title-day__rate svg { width: 100%; height: 3.6rem; border-radius: 0.3rem; background: rgba(200, 67, 58, 0.18); }
.shogi-game .title-day__rate-up { fill: rgba(61, 111, 165, 0.32); }
.shogi-game .title-day__rate-mid { stroke: rgba(255, 252, 244, 0.5); stroke-width: 0.4; stroke-dasharray: 2 2; }
.shogi-game .title-day__rate-line { fill: none; stroke: #fffcf4; stroke-width: 1.4; vector-effect: non-scaling-stroke; stroke-linejoin: round; }
.shogi-game .title-day__rate small { color: rgba(255, 252, 244, 0.65); font-size: 0.75em; }
.shogi-game .title-day__rate-cursor { stroke: #e6c15c; stroke-width: 1.2; vector-effect: non-scaling-stroke; }
/* 盤でふりかえる。盤は指せない(見るだけ)。着せ替えの選択は出さない。 */
.shogi-game .title-day__review { display: grid; gap: 0.35rem; }
.shogi-game .title-day__review-board { min-width: 0; height: min(42vh, 24rem); overflow: hidden; }
.shogi-game .title-day__review-board .shogi-match-theme-controls { display: none; }
.shogi-game .title-day__review-move { display: flex; gap: 0.4em; align-items: baseline; justify-content: center; margin: 0; font-weight: 800; }
.shogi-game .title-day__review-move small { color: rgba(255, 252, 244, 0.65); font-weight: 600; }
.shogi-game .title-day__review-nav { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.4rem; }
.shogi-game .title-day__review-nav button,
.shogi-game .title-day__review-points button {
  min-height: 44px;
  border: 1px solid rgba(230, 193, 92, 0.6);
  border-radius: 0.4rem;
  color: #fffcf4;
  background: rgba(255, 252, 244, 0.08);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.shogi-game .title-day__review-nav button:disabled { opacity: 0.4; cursor: default; }
.shogi-game .title-day__review input[type="range"] { width: 100%; min-height: 32px; accent-color: #e6c15c; }
.shogi-game .title-day__review-points { display: grid; gap: 0.3rem; }
.shogi-game .title-day__review-points > span { color: #e6c15c; font-size: 0.85em; font-weight: 700; }
.shogi-game .title-day__review-points button { display: flex; gap: 0.6em; align-items: center; justify-content: space-between; padding: 0.3rem 0.6rem; text-align: left; }
.shogi-game .title-day__review-points b { flex: none; font-variant-numeric: tabular-nums; }
.shogi-game .title-day__facts { display: grid; gap: 0.25rem; margin: 0; }
.shogi-game .title-day__facts div { display: grid; grid-template-columns: 5.5em 1fr; gap: 0.5rem; }
.shogi-game .title-day__facts dt { color: #f1a54c; font-weight: 700; }
.shogi-game .title-day__facts dd { margin: 0; }
.shogi-game .title-day__voices { display: grid; gap: 0.45rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .title-day__voices li { padding: 0.45rem 0.6rem; border-radius: 0.4rem; background: rgba(255, 252, 244, 0.08); }
.shogi-game .title-day__voices b { margin-right: 0.4em; padding: 0.05em 0.4em; border-radius: 0.3em; background: #e6c15c; color: #172632; font-size: 0.78em; }
.shogi-game .title-day__voice-name { font-weight: 700; }
.shogi-game .title-day__voices p { margin: 0.2rem 0 0; line-height: 1.5; }
.shogi-game .title-day__seal { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.5rem; margin: 0; padding: 0.5rem 0.6rem; border: 1px dashed rgba(230, 193, 92, 0.7); border-radius: 0.4rem; }
.shogi-game .title-day__seal span { color: #e6c15c; font-weight: 700; }
.shogi-game .title-day__seal b { font-size: 1.15em; }
.shogi-game .title-day__seal small { color: rgba(255, 252, 244, 0.72); }
.shogi-game .title-day__close {
  justify-self: center;
  min-width: 11rem;
  min-height: 44px;
  padding: 0.5rem 1.2rem;
  border: 0;
  border-radius: 0.5rem;
  background: #f1a54c;
  color: #172632;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}
/* 観戦記は新聞の紙面(白い紙に明朝の見出し)。 */
.shogi-game .title-day__paper {
  border-color: #b9ab86;
  background: #fbf8ef;
  color: #2a2016;
  font-family: "Yu Mincho", "YuMincho", "Hiragino Mincho ProN", "Noto Serif JP", serif;
}
.shogi-game .title-day__paper-event { color: #7a6a4a; }
.shogi-game .title-day__paper-headline { margin: 0; padding-bottom: 0.4rem; border-bottom: 3px double #2a2016; font-size: 1.35rem; line-height: 1.4; }
.shogi-game .title-day__paper p { margin: 0; line-height: 1.8; text-indent: 1em; }
.shogi-game .title-day__paper .title-day__close { font-family: inherit; }
</style>
