<template>
  <!--
    封じ手のあとの休憩(docs/seal-break-design.mdの2-3)。ボクシングのラウンドの合間のように、対局を止めてひと息つく全画面。
    ① 封じ手の札 → ② 1日目のまとめ(必ず出す・やこび姫の助言つき) → ③ ノベルの場面(台本があるときだけ) → ④ 2日目を始める／ここで中断。
    対局の盤は後ろで暗くしておく。段は親が保存し(リロード・中断のあとも続く)、ここは見せ方と進め方だけ。
  -->
  <div class="seal-break" role="dialog" aria-modal="true" aria-labelledby="seal-break-title" data-seal-break :data-seal-step="step">
    <NovelScene
      v-if="step === 'novel' && scene"
      ref="novelEl"
      :scene="scene"
      :asset-base-url="assetBaseUrl"
      data-seal-novel
      @done="go('ready')"
    />
    <section v-else class="seal-break__panel">
      <header class="seal-break__head">
        <h2 id="seal-break-title">1日目 終了</h2>
        <ol class="seal-break__steps" aria-label="休憩の段">
          <li v-for="item in stepItems" :key="item.id" :class="{ 'seal-break__step--now': item.id === step, 'seal-break__step--done': item.done }">
            <span aria-hidden="true"></span>{{ item.label }}
          </li>
        </ol>
      </header>

      <!-- ① 封じ手の札。1.8秒で次へ、押せばすぐ次へ。 -->
      <button v-if="step === 'card'" type="button" class="seal-break__card" data-seal-card @click="go('summary')">
        <i class="seal-break__envelope" aria-hidden="true"></i>
        <small>{{ card?.event }}</small>
        <strong>封じ手</strong>
        <span>1日目はここまで。あなたの手を封筒にしまって、立会人に渡したよ。2日目の朝に開けるよ</span>
        <em v-if="card?.predicted" data-seal-card-predict>控室の予想は{{ card.predicted }}</em>
        <small class="seal-break__tap">押すと次へ</small>
      </button>

      <!-- ② 1日目のまとめ。必ず出す。「次へ」は出してから少しのあいだ押せない(読まずに飛ばさないための短い溜め)。 -->
      <template v-else-if="step === 'summary'">
        <div class="seal-break__body" data-seal-summary>
          <TitleDaySheet v-if="summary" mode="summary" :summary="summary" :advice="advice" embedded :asset-base-url="assetBaseUrl" />
          <p v-else class="seal-break__empty">1日目のまとめを作れなかったよ。</p>
        </div>
        <button type="button" class="seal-break__next" :disabled="!nextReady" data-seal-summary-next @click="go(scene ? 'novel' : 'ready')">次へ</button>
      </template>

      <!-- ④ 2日目へ。 -->
      <div v-else class="seal-break__ready" data-seal-ready>
        <p>一晩たって、2日目の朝。立会人が封筒を開けて、対局が再開するよ。</p>
        <button type="button" class="seal-break__start" data-seal-start @click="emit('start')">2日目を始める</button>
        <button v-if="canSuspend" type="button" class="seal-break__suspend" data-seal-suspend @click="emit('suspend')">ここで中断</button>
        <button type="button" class="seal-break__back" data-seal-review @click="go('summary')">1日目のまとめをもう一度見る</button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch, type PropType } from "vue";
import NovelScene from "./NovelScene.vue";
import TitleDaySheet, { type DaySummaryView } from "./TitleDaySheet.vue";
import { STAGE_CARD_MS } from "./core/match-stage.mjs";

type Step = "card" | "summary" | "novel" | "ready";
/** まとめの「次へ」を押せるまで(ミリ秒。docs/seal-break-design.mdの4章)。 */
const NEXT_LOCK_MS = 1000;

const props = defineProps({
  step: { type: String as PropType<Step>, default: "card" },
  card: { type: Object as PropType<{ predicted: string; event: string } | null>, default: null },
  summary: { type: Object as PropType<DaySummaryView | null>, default: null },
  advice: { type: Array as PropType<string[]>, default: () => [] },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  scene: { type: Object as PropType<any>, default: null },
  canSuspend: { type: Boolean, default: true },
  assetBaseUrl: { type: String, default: "." },
});
const emit = defineEmits<{ step: [step: Step]; start: []; suspend: [] }>();

const novelEl = ref<{ goBack: () => boolean } | null>(null);
const nextReady = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;

const stepItems = computed(() => {
  const order: { id: Step; label: string }[] = [
    { id: "card", label: "封じ手" },
    { id: "summary", label: "ふりかえり" },
    ...(props.scene ? [{ id: "novel" as Step, label: "夜" }] : []),
    { id: "ready", label: "2日目へ" },
  ];
  const at = order.findIndex(({ id }) => id === props.step);
  return order.map((item, index) => ({ ...item, done: index < at }));
});

function go(step: Step) {
  if (step === "novel" && !props.scene) step = "ready";
  emit("step", step);
}

watch(() => props.step, (step) => {
  clearTimeout(timer);
  nextReady.value = false;
  if (step === "card") timer = setTimeout(() => go("summary"), STAGE_CARD_MS);
  else if (step === "summary") timer = setTimeout(() => { nextReady.value = true; }, NEXT_LOCK_MS);
}, { immediate: true });
onBeforeUnmount(() => clearTimeout(timer));

/** 戻る操作。封じ手の札ならまとめへ、まとめと夜の場面なら④へ。④では何もしない(対局から離れない)。いつもtrue。 */
function goBack() {
  if (props.step === "card") go("summary");
  else if (props.step === "novel") {
    if (!novelEl.value?.goBack()) go("ready");
  } else if (props.step === "summary") go(props.scene ? "novel" : "ready");
  return true;
}
defineExpose({ goBack });
</script>

<style>
.shogi-game .seal-break {
  position: fixed;
  inset: 0;
  /* 結果の窓(100)・1日目のまとめのシート(110)より上。 */
  z-index: 120;
  display: grid;
  place-items: center;
  padding: max(12px, env(safe-area-inset-top)) 16px max(12px, env(safe-area-inset-bottom));
  background: radial-gradient(circle at 50% 30%, rgba(30, 48, 66, 0.94), rgba(6, 10, 16, 0.97));
  color: #fffcf4;
}
.shogi-game .seal-break__panel {
  box-sizing: border-box;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 0.6rem;
  width: min(36rem, 100%);
  max-height: 100%;
  min-height: 0;
}
.shogi-game .seal-break__head { display: grid; gap: 0.4rem; justify-items: center; }
.shogi-game .seal-break__head h2 { margin: 0; color: #e6c15c; font-size: clamp(1.5rem, 6vw, 2.2rem); letter-spacing: 0.2em; }
.shogi-game .seal-break__steps { display: flex; flex-wrap: wrap; gap: 0.4rem 0.9rem; justify-content: center; margin: 0; padding: 0; list-style: none; font-size: 0.82rem; color: rgba(255, 252, 244, 0.6); }
.shogi-game .seal-break__steps li { display: inline-flex; gap: 0.3rem; align-items: center; }
.shogi-game .seal-break__steps span { width: 0.6rem; height: 0.6rem; border: 2px solid currentColor; border-radius: 50%; }
.shogi-game .seal-break__step--done span { background: currentColor; }
.shogi-game .seal-break__step--now { color: #f1a54c; font-weight: 800; }
.shogi-game .seal-break__step--now span { background: #f1a54c; }
.shogi-game .seal-break__card {
  display: grid;
  gap: 0.45rem;
  justify-items: center;
  align-self: center;
  padding: 1.6rem 1.2rem;
  border: 2px solid #c9962e;
  border-radius: 0.8rem;
  color: #fffcf4;
  background: #1d303f;
  font: inherit;
  text-align: center;
  cursor: pointer;
}
.shogi-game .seal-break__card strong { color: #e6c15c; font-size: 2rem; letter-spacing: 0.3em; }
.shogi-game .seal-break__card span { max-width: 22rem; line-height: 1.6; }
.shogi-game .seal-break__card em { color: #f1a54c; font-style: normal; font-weight: 700; }
.shogi-game .seal-break__card small { color: rgba(255, 252, 244, 0.7); }
.shogi-game .seal-break__tap { font-size: 0.75rem; }
.shogi-game .seal-break__envelope {
  position: relative;
  width: 4.4rem;
  height: 2.9rem;
  border-radius: 0.2rem;
  background: #f4ecd8;
  box-shadow: inset 0 0 0 2px #c9962e;
  animation: seal-break-drop 0.5s ease-out;
}
.shogi-game .seal-break__envelope::before {
  content: "";
  position: absolute;
  inset: 0 0 auto;
  height: 60%;
  background: linear-gradient(to bottom right, transparent 49%, #d9c9a2 50%) left / 50% 100% no-repeat,
    linear-gradient(to bottom left, transparent 49%, #d9c9a2 50%) right / 50% 100% no-repeat;
}
.shogi-game .seal-break__envelope::after {
  content: "封";
  position: absolute;
  right: 0.35rem;
  bottom: 0.25rem;
  color: #b4342c;
  font-weight: 900;
  font-size: 0.9rem;
}
@keyframes seal-break-drop { from { transform: translateY(-1.2rem); opacity: 0; } to { transform: none; opacity: 1; } }
.shogi-game .seal-break__body {
  min-height: 0;
  overflow-y: auto;
  border: 2px solid #c9962e;
  border-radius: 0.6rem;
  background: #1d303f;
}
.shogi-game .seal-break__empty { margin: 1rem; }
.shogi-game .seal-break__next,
.shogi-game .seal-break__start {
  justify-self: center;
  min-width: 12rem;
  min-height: 48px;
  padding: 0.5rem 1.4rem;
  border: 0;
  border-radius: 0.6rem;
  color: #172632;
  background: #f1a54c;
  font: inherit;
  font-size: 1.05rem;
  font-weight: 900;
  cursor: pointer;
}
.shogi-game .seal-break__next:disabled { opacity: 0.45; cursor: default; }
.shogi-game .seal-break__start { min-width: 15rem; min-height: 56px; font-size: 1.2rem; }
.shogi-game .seal-break__ready { display: grid; gap: 0.8rem; justify-items: center; align-self: center; text-align: center; }
.shogi-game .seal-break__ready p { max-width: 24rem; margin: 0; line-height: 1.6; }
.shogi-game .seal-break__suspend,
.shogi-game .seal-break__back {
  min-height: 44px;
  padding: 0.3rem 1.2rem;
  border: 1px solid rgba(230, 193, 92, 0.6);
  border-radius: 0.5rem;
  color: #fffcf4;
  background: rgba(255, 252, 244, 0.08);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.shogi-game .seal-break__back { border-color: transparent; background: none; color: rgba(255, 252, 244, 0.75); text-decoration: underline; }
@media (prefers-reduced-motion: reduce) {
  .shogi-game .seal-break__envelope { animation: none; }
}
</style>
