<template>
  <!--
    回戦ごとの観戦(docs/tournament-relay-design.mdの13-2)。竜王戦の期の対局を、期の順の回戦に並べ、勝敗を伏せて1つずつめくる。
    対局の札を押すと中継。「結果を見る」で勝敗の判子をめくり、「次の回戦へ」。「結果まで進める」で最後まで飛ぶ。最後は竜王の発表。
    観戦の期(分身が出る、もしもの期)は最初の回戦から、本番の期で敗退したときは、自分の最後の対局より後の回戦から。
  -->
  <div class="ryuo-watch" role="dialog" aria-modal="true" :aria-label="heading" data-ryuo-watch>
    <header class="ryuo-watch__head">
      <button type="button" class="ryuo-watch__close" aria-label="観戦を閉じる" data-watch-close @click="emit('close')">
        <span aria-hidden="true">←</span><span>閉じる</span>
      </button>
      <div class="ryuo-watch__title">
        <h2>{{ heading }}</h2>
        <p>{{ subheading }}</p>
      </div>
      <p class="ryuo-watch__count" :aria-label="`${steps.length}回戦のうち${Math.min(revealed, steps.length)}回戦の結果を見た`">
        <b>{{ Math.min(viewIndex + 1, steps.length) }}</b>/{{ steps.length }}
      </p>
    </header>

    <!-- 回戦の道のり(済みは✓の緑、いま見ている回戦は琥珀、最後は竜王の発表)。見るだけの飾り。見返すのは、回戦の名前の横の◁▷。 -->
    <ol class="ryuo-watch__dots" aria-hidden="true">
      <li
        v-for="(step, index) in steps"
        :key="step.id"
        :class="['ryuo-watch__dot', { 'ryuo-watch__dot--done': index < revealed, 'ryuo-watch__dot--now': index === viewIndex }]"
      >{{ index < revealed ? "✓" : "" }}</li>
      <li :class="['ryuo-watch__dot', 'ryuo-watch__dot--crown', { 'ryuo-watch__dot--now': finaleShown }]">竜</li>
    </ol>

    <main class="ryuo-watch__body">
      <!-- 分身の札(観戦の期の始め)。 -->
      <section v-if="spectator && viewIndex === 0 && (avatarView || avatarNote)" class="ryuo-watch__avatar" data-watch-avatar>
        <p><b>あなたの分身</b>{{ avatarView?.type ?? "能力は平均" }}<small v-if="avatarNote">{{ avatarNote }}</small></p>
        <button v-if="avatarView" type="button" class="ryuo-watch__sub" data-watch-avatar-more @click="avatarOpen = !avatarOpen">{{ avatarOpen ? "とじる" : "能力" }}</button>
        <div v-if="avatarOpen && avatarView" class="ryuo-watch__avatar-panel"><PlayerAbilityPanel :view="avatarView" /></div>
      </section>

      <template v-if="!finaleShown && currentStep">
        <div class="ryuo-watch__step-row">
          <button type="button" class="ryuo-watch__nav" aria-label="前の回戦を見返す" :disabled="viewIndex === 0" data-watch-prev @click="viewIndex -= 1">◁</button>
          <h3 class="ryuo-watch__step" data-watch-step>{{ currentStep.label }}</h3>
          <button type="button" class="ryuo-watch__nav" aria-label="次の回戦" :disabled="viewIndex >= revealed" data-watch-forward @click="viewIndex += 1">▷</button>
        </div>
        <ul class="ryuo-watch__games">
          <li v-for="entry in currentStep.entries" :key="entry.key">
            <button type="button" class="ryuo-watch__game" :data-watch-entry="entry.key" @click="emit('watch', entry)">
              <span class="ryuo-watch__tags">
                <i v-if="entry.tags.self" class="ryuo-watch__tag ryuo-watch__tag--self">分身</i>
                <i v-if="entry.tags.rival" class="ryuo-watch__tag ryuo-watch__tag--rival">ライバル</i>
                <i v-if="entry.tags.father" class="ryuo-watch__tag ryuo-watch__tag--rival">天鷺善彦</i>
                <i v-if="entry.tags.oshi" class="ryuo-watch__tag ryuo-watch__tag--oshi">推し</i>
                <i v-if="seen.includes(entry.key)" class="ryuo-watch__tag">視聴済み</i>
              </span>
              <span v-for="side in (['black', 'white'] as const)" :key="side" :class="['ryuo-watch__player', resultClass(entry, side)]">
                <i class="ryuo-watch__mark" aria-hidden="true">{{ markOf(entry, side) }}</i>
                {{ side === "black" ? "☗" : "☖" }}{{ entry[side].name }}<small>{{ entry[side].dan }}</small>
              </span>
              <span class="ryuo-watch__go" aria-hidden="true">観る ›</span>
            </button>
          </li>
        </ul>
        <p class="ryuo-watch__hint">{{ stepRevealed ? "勝った棋士に○。次の回戦へ進もう。" : "勝敗はまだ伏せてあるよ。中継を見てから、結果をめくろう。" }}</p>
      </template>

      <!-- 竜王の発表。 -->
      <section v-else-if="finaleShown" class="ryuo-watch__finale" data-watch-finale>
        <p class="ryuo-watch__crown" aria-hidden="true">竜</p>
        <p v-for="line in finale.lines" :key="line" class="ryuo-watch__finale-line">{{ line }}</p>
        <button type="button" class="ryuo-watch__sub" data-watch-review @click="viewIndex = steps.length - 1">回戦を見返す</button>
      </section>
      <p v-else class="ryuo-watch__hint">見られる対局がないよ。</p>
    </main>

    <footer class="ryuo-watch__foot">
      <button v-if="!finaleShown && !stepRevealed && revealed < steps.length" type="button" class="ryuo-watch__skip" data-watch-skip @click="revealAll">結果まで進める</button>
      <button v-if="finaleShown" type="button" class="ryuo-watch__main" data-watch-done @click="emit('close')">観戦を終える</button>
      <button v-else-if="!stepRevealed" type="button" class="ryuo-watch__main" data-watch-reveal @click="revealCurrent">結果を見る</button>
      <button v-else type="button" class="ryuo-watch__main" data-watch-next @click="goNext">{{ viewIndex + 1 >= steps.length ? "竜王の発表へ" : "次の回戦へ" }}</button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, type PropType } from "vue";
import PlayerAbilityPanel from "./PlayerAbilityPanel.vue";
import { stepsAfterElimination, watchFinale, watchSteps } from "./core/ryuo-watch.mjs";

const props = defineProps({
  /** 終わった竜王戦の期(観戦の期か、本番の期)。 */
  season: { type: Object as PropType<any>, required: true },
  /** 結果をめくった回戦の数。 */
  revealed: { type: Number, default: 0 },
  oshiId: { type: String, default: "" },
  /** 視聴済みの対局の鍵。 */
  seen: { type: Array as PropType<string[]>, default: () => [] },
  /** 分身の能力(PlayerAbilityPanelの形)と、ひとこと(対局が足りないときなど)。 */
  avatarView: { type: Object as PropType<any>, default: null },
  avatarNote: { type: String, default: "" },
});
const emit = defineEmits<{ close: []; reveal: [count: number]; watch: [entry: any] }>();

const spectator = computed(() => Boolean(props.season?.spectator));
const steps = computed(() => {
  const all = watchSteps(props.season, { oshiId: props.oshiId || null });
  return spectator.value ? all : stepsAfterElimination(props.season, all);
});
const heading = computed(() => `第${props.season?.no ?? 1}期 竜王戦 ${spectator.value ? "観戦" : "このあとの対局"}`);
const subheading = computed(() => (spectator.value
  ? "分身が出る、もしもの期（本番の記録には残らないよ）"
  : "あなたの敗退後の対局。誰が竜王になるか、見届けよう"));
const finale = computed(() => watchFinale(props.season));

const viewIndex = ref(Math.min(props.revealed, steps.value.length));
const avatarOpen = ref(false);
const currentStep = computed(() => steps.value[viewIndex.value] ?? null);
const finaleShown = computed(() => viewIndex.value >= steps.value.length && steps.value.length > 0 && props.revealed >= steps.value.length);
const stepRevealed = computed(() => viewIndex.value < props.revealed);
/** めくった瞬間の判子の動き(その回戦だけ)。 */
const justRevealed = ref(-1);

function markOf(entry: any, side: "black" | "white") {
  if (!stepRevealed.value) return "？";
  return entry.winner === side ? "○" : "●";
}
function resultClass(entry: any, side: "black" | "white") {
  if (!stepRevealed.value) return "";
  return [entry.winner === side ? "ryuo-watch__player--win" : "ryuo-watch__player--loss", justRevealed.value === viewIndex.value ? "ryuo-watch__player--stamp" : ""];
}
function revealCurrent() {
  justRevealed.value = viewIndex.value;
  emit("reveal", Math.max(props.revealed, viewIndex.value + 1));
}
function goNext() {
  viewIndex.value = Math.min(steps.value.length, viewIndex.value + 1);
}
function revealAll() {
  emit("reveal", steps.value.length);
  viewIndex.value = steps.value.length;
}
</script>

<style>
.shogi-game .ryuo-watch {
  position: fixed;
  inset: 0;
  z-index: 110;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  gap: 0.5rem;
  box-sizing: border-box;
  padding: max(8px, env(safe-area-inset-top)) 16px max(10px, env(safe-area-inset-bottom));
  color: #fffcf4;
  background: #142231;
  font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Yu Gothic", "Meiryo", sans-serif;
}
.shogi-game .ryuo-watch__head { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 0.6rem; align-items: center; width: min(100%, 44rem); margin: 0 auto; }
.shogi-game .ryuo-watch__close {
  display: inline-flex; gap: 0.3rem; align-items: center; min-height: 44px; padding: 0 0.7rem;
  border: 1px solid rgba(255, 252, 244, 0.3); border-radius: 0.45rem; color: #fffcf4; background: transparent; font: inherit; font-weight: 800; cursor: pointer;
}
.shogi-game .ryuo-watch__title { min-width: 0; }
.shogi-game .ryuo-watch__title h2 { margin: 0; font-size: 1.05rem; font-weight: 900; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.shogi-game .ryuo-watch__title p { margin: 0; color: #9fb3c8; font-size: 0.78rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.shogi-game .ryuo-watch__count { margin: 0; color: #9fb3c8; font-variant-numeric: tabular-nums; }
.shogi-game .ryuo-watch__count b { color: #f1a54c; font-size: 1.2rem; }
.shogi-game .ryuo-watch__dots { display: flex; flex-wrap: wrap; gap: 0.25rem; justify-content: center; width: min(100%, 44rem); margin: 0 auto; padding: 0; list-style: none; }
.shogi-game .ryuo-watch__dot {
  display: grid; place-items: center; box-sizing: border-box; width: 1.15rem; height: 1.15rem;
  border: 2px solid rgba(255, 252, 244, 0.25); border-radius: 50%; color: #172632; font-size: 0.6rem; font-weight: 900;
}
.shogi-game .ryuo-watch__dot--done { border-color: #7fb07a; background: #7fb07a; }
.shogi-game .ryuo-watch__dot--now { border-color: #f1a54c; box-shadow: 0 0 0 2px rgba(241, 165, 76, 0.45); }
.shogi-game .ryuo-watch__dot--crown { border-color: #e6c15c; color: #e6c15c; }
.shogi-game .ryuo-watch__body { display: grid; align-content: start; gap: 0.5rem; width: min(100%, 44rem); min-height: 0; margin: 0 auto; overflow-y: auto; overscroll-behavior: contain; }
.shogi-game .ryuo-watch__avatar { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.4rem; align-items: center; padding: 0.5rem 0.7rem; border: 1px solid rgba(216, 208, 255, 0.5); border-radius: 0.5rem; background: rgba(216, 208, 255, 0.08); }
.shogi-game .ryuo-watch__avatar p { display: grid; margin: 0; font-weight: 800; }
.shogi-game .ryuo-watch__avatar b { color: #d8d0ff; font-size: 0.78rem; }
.shogi-game .ryuo-watch__avatar small { color: #c9d6e6; font-size: 0.78rem; font-weight: 600; }
.shogi-game .ryuo-watch__avatar-panel { grid-column: 1 / -1; }
.shogi-game .ryuo-watch__sub { min-height: 40px; padding: 0 0.8rem; border: 1px solid rgba(255, 252, 244, 0.3); border-radius: 0.4rem; color: #fffcf4; background: transparent; font: inherit; font-weight: 800; cursor: pointer; }
.shogi-game .ryuo-watch__step-row { display: grid; grid-template-columns: 44px minmax(0, 1fr) 44px; gap: 0.4rem; align-items: center; }
.shogi-game .ryuo-watch__step { margin: 0; color: #f1a54c; font-size: 1.15rem; font-weight: 900; text-align: center; }
.shogi-game .ryuo-watch__nav { width: 44px; height: 44px; padding: 0; border: 1px solid rgba(255, 252, 244, 0.3); border-radius: 0.45rem; color: #fffcf4; background: transparent; font: inherit; font-weight: 900; cursor: pointer; }
.shogi-game .ryuo-watch__nav:disabled { opacity: 0.35; cursor: default; }
.shogi-game .ryuo-watch__games { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 19rem), 1fr)); gap: 0.4rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .ryuo-watch__game {
  display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: "tags go" "black go" "white go"; gap: 0.1rem 0.5rem; align-items: center;
  width: 100%; min-height: 44px; padding: 0.45rem 0.6rem; border: 1px solid rgba(255, 252, 244, 0.18); border-radius: 0.45rem;
  color: #fffcf4; background: rgba(255, 252, 244, 0.05); font: inherit; text-align: left; cursor: pointer;
}
.shogi-game .ryuo-watch__game:focus-visible { outline: 2px solid #f1a54c; outline-offset: 1px; }
.shogi-game .ryuo-watch__tags { grid-area: tags; display: flex; flex-wrap: wrap; gap: 0.25rem; min-height: 0.2rem; }
.shogi-game .ryuo-watch__tag { padding: 0 0.3rem; border-radius: 0.25rem; color: #172632; background: #9fb3c8; font-size: 0.72rem; font-style: normal; font-weight: 900; }
.shogi-game .ryuo-watch__tag--self { color: #172632; background: #f1a54c; }
.shogi-game .ryuo-watch__tag--rival { color: #fffcf4; background: #8a5ad1; }
.shogi-game .ryuo-watch__tag--oshi { color: #172632; background: #d8d0ff; }
.shogi-game .ryuo-watch__player { display: flex; gap: 0.35rem; align-items: baseline; font-weight: 800; }
.shogi-game .ryuo-watch__player:nth-of-type(2) { grid-area: black; }
.shogi-game .ryuo-watch__player:nth-of-type(3) { grid-area: white; }
.shogi-game .ryuo-watch__player small { color: #9fb3c8; font-size: 0.75rem; }
.shogi-game .ryuo-watch__mark { display: inline-grid; place-items: center; width: 1.2rem; color: #9fb3c8; font-style: normal; }
.shogi-game .ryuo-watch__player--win .ryuo-watch__mark { color: #f1a54c; }
.shogi-game .ryuo-watch__player--loss { opacity: 0.55; }
.shogi-game .ryuo-watch__player--stamp .ryuo-watch__mark { animation: ryuo-watch-stamp 320ms cubic-bezier(0.2, 0.9, 0.3, 1.3) both; }
@keyframes ryuo-watch-stamp {
  from { opacity: 0; transform: scale(2.4); }
  to { opacity: 1; transform: scale(1); }
}
.shogi-game .ryuo-watch__go { grid-area: go; padding: 0.2rem 0.5rem; border-radius: 0.35rem; color: #172632; background: #f1a54c; font-size: 0.85rem; font-weight: 900; }
.shogi-game .ryuo-watch__hint { margin: 0; color: #c9d6e6; font-size: 0.85rem; text-align: center; }
.shogi-game .ryuo-watch__finale { display: grid; gap: 0.5rem; justify-items: center; padding: 1.2rem 0.5rem; text-align: center; }
.shogi-game .ryuo-watch__crown {
  display: grid; place-items: center; width: 4.2rem; height: 4.2rem; margin: 0; border: 4px solid #c4604c; border-radius: 0.5rem;
  color: #c4604c; background: #fbf6e6; font-family: "Yu Mincho", "YuMincho", "Hiragino Mincho ProN", "Noto Serif JP", serif; font-size: 2.4rem; font-weight: 900; rotate: -6deg;
  animation: ryuo-watch-stamp 360ms cubic-bezier(0.2, 0.9, 0.3, 1.3) both;
}
.shogi-game .ryuo-watch__finale-line { margin: 0; font-size: 1rem; font-weight: 800; }
.shogi-game .ryuo-watch__finale-line:first-of-type { color: #e6c15c; font-size: 1.3rem; font-weight: 900; }
.shogi-game .ryuo-watch__foot { display: flex; gap: 0.5rem; width: min(100%, 44rem); margin: 0 auto; }
.shogi-game .ryuo-watch__main {
  flex: 1; min-height: 52px; border: 0; border-radius: 0.8rem; color: #172632; background: #f1a54c; box-shadow: 0 4px 0 #b06a1c;
  font: inherit; font-size: 1.1rem; font-weight: 900; cursor: pointer;
}
.shogi-game .ryuo-watch__skip { min-height: 52px; padding: 0 0.9rem; border: 1px solid rgba(255, 252, 244, 0.3); border-radius: 0.8rem; color: #fffcf4; background: transparent; font: inherit; font-weight: 800; cursor: pointer; }
@media (prefers-reduced-motion: reduce) {
  .shogi-game .ryuo-watch__player--stamp .ryuo-watch__mark,
  .shogi-game .ryuo-watch__crown { animation: none; }
}
</style>
