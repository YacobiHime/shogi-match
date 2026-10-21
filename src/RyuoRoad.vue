<template>
  <div class="ryuo-road" data-road @click="skip">
    <!--
      竜王への道(docs/ryuo-ux-redesign.mdの4-2)。いまの組の回戦から竜王まで、段を左から右へ並べる。
      いまの段に自分の駒(「自」)と次の相手の顔、山場の段に待つ顔(組の決勝のライバル、七番勝負の竜王)、昇級の印。
      対局から戻ったときは、駒が前の段から登り、通った線が金に光る(押すと飛ばす。動きを減らす設定では、光る線だけ)。
      根の要素の前にコメントを置くと、開発時に親から渡したclassが付かないので、中に書く。
    -->
    <ol ref="listEl" class="ryuo-road__steps" aria-label="竜王への道">
      <li
        v-for="(step, index) in road.steps"
        :key="step.key"
        :ref="(el) => setStepEl(index, el)"
        :class="[
          'ryuo-road__step',
          `ryuo-road__step--${step.state}`,
          {
            'ryuo-road__step--boss': step.boss,
            'ryuo-road__step--glow': glowFrom <= index && index <= glowTo,
            'ryuo-road__step--here': index === road.currentIndex,
          },
        ]"
        :aria-current="index === road.currentIndex ? 'step' : undefined"
        :data-road-step="step.key"
        :data-state="step.state"
      >
        <span class="ryuo-road__node" :class="{ 'ryuo-road__node--pulse': pulsing && index === road.currentIndex }">
          <img v-if="step.face?.story === 'hanane'" class="ryuo-road__sprite" :src="hananeUrl" alt="" draggable="false">
          <span v-else-if="step.face" :class="['ryuo-road__face', `ryuo-road__face--${step.face.tone}`]">{{ step.face.char }}</span>
          <span v-else-if="step.key === 'ryuo'" class="ryuo-road__crown">竜</span>
          <span v-else class="ryuo-road__dot"></span>
          <span
            v-if="index === road.currentIndex"
            :ref="setPieceEl"
            class="ryuo-road__piece"
            :class="{ 'ryuo-road__piece--won': step.state === 'won' }"
            aria-hidden="true"
          >自</span>
        </span>
        <span class="ryuo-road__label">{{ step.short }}</span>
        <small v-if="step.score" class="ryuo-road__score">{{ step.score }}</small>
        <small v-if="step.state === 'lost'" class="ryuo-road__note ryuo-road__note--out">ここまで</small>
        <small v-else-if="step.mark" class="ryuo-road__note ryuo-road__note--mark">{{ step.mark }}</small>
        <span class="ryuo-road__sr">{{ STATE_TEXT[step.state] }}{{ step.face ? `・${step.face.name}` : "" }}</span>
      </li>
    </ol>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, type ComponentPublicInstance, type PropType } from "vue";
import { HANANE_SPRITE } from "./core/ryuo-story.mjs";
import { createMoveSoundPlayer } from "./core/move-sound";

type Step = {
  key: string; label: string; short: string; /** done・current・lost・skip・todo・won */ state: string;
  boss: boolean; mark: string; score: string;
  face: null | { id: string; name: string; char: string; story: string | null; tone: string };
};
export type RoadView = { steps: Step[]; currentIndex: number; lastIndex: number };

const props = defineProps({
  road: { type: Object as PropType<RoadView>, required: true },
  assetBaseUrl: { type: String, default: "." },
  /** 対局から戻ったところ。前の段から、いまの段へ登る動きを1回だけ見せる。 */
  animate: { type: Boolean, default: false },
  /** 直前の対局に勝ったか(番勝負など、同じ段にとどまるときの跳ねと音に使う)。 */
  lastWin: { type: Boolean, default: false },
});
const emit = defineEmits<{ played: [] }>();

/** 登る動きの長さ(ms)。Game_Nintendo_Implementation.mdの3-1「ふつうの回戦に勝つ」(小)。 */
const CLIMB_MS = 600;
/** 通った線が光っている長さ(ms)。動きと合わせて1.5秒以内。 */
const GLOW_MS = 1100;
const STATE_TEXT: Record<string, string> = { done: "通過", current: "いまの段", lost: "ここまで", skip: "通らない", todo: "", won: "到達" };

const hananeUrl = computed(() => `${props.assetBaseUrl}/characters/${HANANE_SPRITE.file}?v=${HANANE_SPRITE.version}`);
const listEl = ref<HTMLElement | null>(null);
const pieceEl = ref<HTMLElement | null>(null);
const stepEls: (HTMLElement | null)[] = [];
function setStepEl(index: number, el: Element | ComponentPublicInstance | null) {
  stepEls[index] = el instanceof HTMLElement ? el : null;
}
function setPieceEl(el: Element | ComponentPublicInstance | null) {
  pieceEl.value = el instanceof HTMLElement ? el : null;
}
const glowFrom = ref(Infinity);
const glowTo = ref(-Infinity);
const pulsing = ref(false);
const timers: ReturnType<typeof setTimeout>[] = [];

/** いまの段が見えるよう、道を横に送る(ページはスクロールさせない)。 */
function centerCurrent() {
  const list = listEl.value;
  const step = stepEls[props.road.currentIndex];
  if (!list || !step) return;
  list.scrollLeft = Math.max(0, step.offsetLeft - (list.clientWidth - step.offsetWidth) / 2);
}

function reducedMotion() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** 動きを終わらせる(押したとき・時間が来たとき)。 */
function finish() {
  timers.splice(0).forEach(clearTimeout);
  const piece = pieceEl.value;
  if (piece) {
    piece.style.transition = "none";
    piece.style.transform = "";
  }
  glowFrom.value = Infinity;
  glowTo.value = -Infinity;
  pulsing.value = false;
}
function skip() {
  if (timers.length) finish();
}

function play() {
  const { lastIndex, currentIndex, steps } = props.road;
  if (lastIndex < 0 || currentIndex < 0) return;
  const from = steps[lastIndex];
  const climbed = currentIndex > lastIndex && from?.state === "done";
  const stayed = currentIndex === lastIndex;
  if (!climbed && !stayed && currentIndex <= lastIndex) return;
  if (climbed || (stayed && props.lastWin)) {
    createMoveSoundPlayer(() => props.assetBaseUrl).play("climb");
  }
  if (stayed) {
    // 番勝負・決勝トーナメントの途中: 同じ段で跳ねる(勝ったときだけ)。
    if (props.lastWin) {
      pulsing.value = true;
      timers.push(setTimeout(finish, CLIMB_MS));
    }
    return;
  }
  // 勝って登ったときだけ、通った線を金に光らせる(負けて敗者復活戦へ回るときは、駒が移るだけ)。
  if (climbed) {
    glowFrom.value = lastIndex + 1;
    glowTo.value = currentIndex;
  }
  timers.push(setTimeout(finish, GLOW_MS));
  const piece = pieceEl.value;
  const fromEl = stepEls[lastIndex]?.querySelector(".ryuo-road__node");
  const toEl = stepEls[currentIndex]?.querySelector(".ryuo-road__node");
  if (!piece || !fromEl || !toEl || reducedMotion()) return;
  // FLIP: いったん前の段の位置に置いてから、いまの段へ動かす。
  const dx = fromEl.getBoundingClientRect().left - toEl.getBoundingClientRect().left;
  piece.style.transition = "none";
  piece.style.transform = `translateX(${dx}px)`;
  void piece.offsetWidth;
  piece.style.transition = `transform ${CLIMB_MS}ms cubic-bezier(0.3, 0.7, 0.4, 1.15)`;
  piece.style.transform = "";
}

onMounted(async () => {
  await nextTick();
  centerCurrent();
  if (props.animate) {
    play();
    emit("played");
  }
});
onBeforeUnmount(() => timers.splice(0).forEach(clearTimeout));
</script>

<style>
.shogi-game .ryuo-road { min-width: 0; }
.shogi-game .ryuo-road__steps {
  position: relative;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(4.4rem, 1fr);
  margin: 0;
  padding: 0.9rem 0 0.1rem;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
  list-style: none;
}
.shogi-game .ryuo-road__steps::-webkit-scrollbar { display: none; }
.shogi-game .ryuo-road__step {
  position: relative;
  display: grid;
  justify-items: center;
  align-content: start;
  gap: 0.2rem;
  padding: 0 0.15rem;
  color: rgba(255, 252, 244, 0.6);
  font-size: 0.76em;
  font-weight: 700;
  line-height: 1.3;
  text-align: center;
}
/* 段と段を結ぶ線。通った段までを金にする。 */
.shogi-game .ryuo-road__step::before {
  content: "";
  position: absolute;
  top: 0.95rem;
  right: 50%;
  width: 100%;
  height: 3px;
  background: rgba(255, 252, 244, 0.22);
}
.shogi-game .ryuo-road__step:first-child::before { display: none; }
.shogi-game .ryuo-road__step--done::before,
.shogi-game .ryuo-road__step--current::before,
.shogi-game .ryuo-road__step--lost::before,
.shogi-game .ryuo-road__step--won::before { background: #f1a54c; }
.shogi-game .ryuo-road__step--glow::before { animation: ryuo-road-glow 1100ms ease-out; }
@keyframes ryuo-road-glow {
  0% { background: #fffcf4; box-shadow: 0 0 0 2px rgba(255, 226, 154, 0.9); }
  100% { background: #f1a54c; box-shadow: 0 0 0 0 rgba(255, 226, 154, 0); }
}
.shogi-game .ryuo-road__node {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  width: 1.9rem;
  height: 1.9rem;
}
.shogi-game .ryuo-road__dot {
  box-sizing: border-box;
  width: 0.95rem;
  height: 0.95rem;
  border: 2px solid rgba(255, 252, 244, 0.55);
  background: #172632;
}
.shogi-game .ryuo-road__step--done .ryuo-road__dot { border-color: #f1a54c; background: #f1a54c; }
.shogi-game .ryuo-road__step--lost .ryuo-road__dot { border-color: rgba(255, 252, 244, 0.6); background: #5d6f80; }
/* 山場の段は、印を一回り大きく、朱の縁にする。 */
.shogi-game .ryuo-road__step--boss .ryuo-road__dot { width: 1.25rem; height: 1.25rem; border-color: #c4604c; transform: rotate(45deg); }
.shogi-game .ryuo-road__step--boss.ryuo-road__step--done .ryuo-road__dot { background: #c4604c; }
.shogi-game .ryuo-road__face,
.shogi-game .ryuo-road__crown {
  box-sizing: border-box;
  display: grid;
  place-items: center;
  width: 1.9rem;
  height: 1.9rem;
  border: 2px solid #fffcf4;
  border-radius: 0.3rem;
  color: #fffcf4;
  box-shadow: 2px 2px 0 #121e29;
  font-family: "Yu Mincho", "YuMincho", "Hiragino Mincho ProN", "Noto Serif JP", serif;
  font-size: 1.05rem;
  font-weight: 800;
  line-height: 1;
}
.shogi-game .ryuo-road__face--attack { background: #c4604c; }
.shogi-game .ryuo-road__face--defense { background: #3d6fa5; }
.shogi-game .ryuo-road__face--balance { color: #172632; background: #d9b860; }
.shogi-game .ryuo-road__crown { border-color: #f1a54c; background: #c4604c; }
.shogi-game .ryuo-road__step--won .ryuo-road__crown { box-shadow: 0 0 0 3px #f1a54c; }
.shogi-game .ryuo-road__sprite { height: 2.3rem; width: auto; margin-top: -0.4rem; image-rendering: pixelated; }
/* まだ遠い段の顔は、少し沈める(いつか戦う相手が見えている)。 */
.shogi-game .ryuo-road__step--todo .ryuo-road__face,
.shogi-game .ryuo-road__step--todo .ryuo-road__sprite,
.shogi-game .ryuo-road__step--todo .ryuo-road__crown { opacity: 0.7; }
/* 負けて通らなかった組の回戦は、薄く、線を点線にする。 */
.shogi-game .ryuo-road__step--skip { opacity: 0.4; }
.shogi-game .ryuo-road__step--skip::before { background: repeating-linear-gradient(90deg, rgba(255, 252, 244, 0.5) 0 4px, transparent 4px 8px); }
.shogi-game .ryuo-road__step--here { color: #fffcf4; }
.shogi-game .ryuo-road__step--done { color: rgba(255, 252, 244, 0.85); }
.shogi-game .ryuo-road__step--won { color: #f1a54c; }
/* 自分の駒(将棋の駒の形)。いまの段の印の上に乗る。 */
.shogi-game .ryuo-road__piece {
  position: absolute;
  bottom: 78%;
  left: 50%;
  z-index: 2;
  display: grid;
  place-items: center;
  width: 1.35rem;
  height: 1.55rem;
  margin-left: -0.675rem;
  padding-top: 0.15rem;
  box-sizing: border-box;
  clip-path: polygon(50% 0, 88% 16%, 100% 100%, 0 100%, 12% 16%);
  color: #172632;
  background: #fffcf4;
  font-family: "Yu Mincho", "YuMincho", "Hiragino Mincho ProN", "Noto Serif JP", serif;
  font-size: 0.78rem;
  font-weight: 900;
  line-height: 1;
  filter: drop-shadow(0 2px 0 #121e29);
}
.shogi-game .ryuo-road__piece--won { background: #f1a54c; }
.shogi-game .ryuo-road__node--pulse { animation: ryuo-road-pulse 600ms ease-out; }
@keyframes ryuo-road-pulse {
  0% { transform: scale(1); }
  35% { transform: scale(1.25); }
  100% { transform: scale(1); }
}
.shogi-game .ryuo-road__label { overflow-wrap: anywhere; }
/* 読み上げだけに出す、段の状態。 */
.shogi-game .ryuo-road__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
.shogi-game .ryuo-road__score { color: #f1a54c; font-size: 1.05em; font-variant-numeric: tabular-nums; }
.shogi-game .ryuo-road__note {
  padding: 0 0.4rem;
  border-radius: 0.15rem;
  font-size: 0.9em;
  font-weight: 800;
  white-space: nowrap;
}
.shogi-game .ryuo-road__note--mark { color: #172632; background: #f1a54c; }
.shogi-game .ryuo-road__note--out { color: #172632; background: #a9b6c4; }
@media (prefers-reduced-motion: reduce) {
  .shogi-game .ryuo-road__node--pulse { animation: none; }
  .shogi-game .ryuo-road__piece { transition: none !important; }
}
</style>
