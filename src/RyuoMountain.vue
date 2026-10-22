<template>
  <div ref="scrollEl" class="ryuo-mountain" data-mountain @click="skip">
    <!--
      竜王への道の山の地図(docs/ryuo-ui-renewal-design.mdの5-2)。麓の将棋会館から、頂上の竜王の座(金屏風と将棋盤)まで、
      段を点線の道でつなぐ。いまの段に自分の駒とやこび姫、次の相手の顔、山場の段に扇子、頂上の横にいまの竜王。
      図は幅390の座標で描き、画面ではそのまま拡大・縮小する。山は図の外まで伸ばし、広い画面でも端が切れないようにする。
    -->
    <svg
      class="ryuo-mountain__svg"
      :viewBox="`0 0 ${layout.width} ${layout.height}`"
      :style="{ aspectRatio: `${layout.width} / ${layout.height}` }"
      role="img"
      :aria-label="ariaLabel"
      shape-rendering="crispEdges"
    >
      <defs>
        <!-- 顔の枠の中だけに、ドット絵の頭を出す。 -->
        <clipPath id="ryuo-mountain-face-clip"><rect x="-15" y="-15" width="30" height="30" /></clipPath>
      </defs>
      <g aria-hidden="true">
        <rect v-for="star in stars" :key="star.id" :x="star.x" :y="star.y" :width="star.size" :height="star.size" :fill="star.color" class="ryuo-mountain__star" :style="{ animationDelay: `${star.delay}s` }" />
        <polygon v-for="layer in layers" :key="layer.fill" :points="layer.points" :fill="layer.fill" />

        <!-- 麓の将棋会館(ランキング戦の舞台)。 -->
        <g v-if="kaikan" class="ryuo-mountain__kaikan">
          <rect :x="kaikan.x" :y="kaikan.y - 66" width="64" height="66" fill="#8a98a8" />
          <rect :x="kaikan.x" :y="kaikan.y - 66" width="64" height="3" fill="#a9b6c4" />
          <template v-for="window in kaikan.windows" :key="window.id">
            <rect :x="window.x" :y="window.y" width="10" height="10" :fill="window.lit ? '#ffd27a' : '#3b4a5c'" />
          </template>
          <rect :x="kaikan.x + 24" :y="kaikan.y - 16" width="16" height="16" fill="#ffd27a" />
          <rect :x="kaikan.x + 2" :y="kaikan.y - 84" width="60" height="15" fill="#fffcf4" />
          <text :x="kaikan.x + 32" :y="kaikan.y - 72" text-anchor="middle" class="ryuo-mountain__sign">将棋会館</text>
        </g>

        <!-- 道(四角い点線)。通った区間は橙。 -->
        <rect
          v-for="dot in pathDots"
          :key="dot.id"
          :x="dot.x - 3"
          :y="dot.y - 3"
          width="6"
          height="6"
          :fill="dot.passed ? '#f1a54c' : 'rgba(255, 252, 244, 0.55)'"
          :class="{ 'ryuo-mountain__dot--glow': dot.glow }"
        />

        <!-- 頂上: 竜王の座(就位式の金屏風と、七番勝負の将棋盤)。 -->
        <g :transform="`translate(${summit.x}, ${summit.y + 14})`" :class="{ 'ryuo-mountain__summit--glow': glowCrown }">
          <rect v-for="panel in BYOBU" :key="panel.x" :x="panel.x" :y="panel.y" width="14" :height="panel.h" :fill="panel.fill" />
          <rect v-for="panel in BYOBU" :key="`t${panel.x}`" :x="panel.x" :y="panel.y" width="14" height="4" fill="#fff1b0" />
          <rect x="-51" y="0" width="100" height="5" fill="#7a4a1a" />
          <rect x="-15" y="4" width="30" height="18" fill="#d9a95a" />
          <rect x="-15" y="4" width="30" height="3" fill="#f0c879" />
          <rect x="-15" y="22" width="30" height="5" fill="#7a4a1a" />
          <rect v-for="line in BAN_LINES" :key="line.id" :x="line.x" :y="line.y" :width="line.w" :height="line.h" fill="#7a4a1a" />
          <rect x="-46" y="12" width="22" height="12" fill="#8a2f3a" />
          <rect x="24" y="12" width="22" height="12" fill="#8a2f3a" />
        </g>

        <!-- 山場の段の扇子。 -->
        <g v-for="fan in fans" :key="fan.key" :transform="`translate(${fan.x}, ${fan.y - 30})`">
          <rect x="-16" y="-2" width="32" height="4" fill="#e0745e" />
          <rect x="-13" y="-6" width="26" height="4" fill="#e0745e" />
          <rect x="-9" y="-10" width="18" height="4" fill="#ffd27a" />
          <rect x="-5" y="-13" width="10" height="3" fill="#ffd27a" />
          <rect x="-2" y="2" width="4" height="8" fill="#3b1e1a" />
        </g>
      </g>

      <!-- 段。 -->
      <g v-for="node in nodes" :key="node.key" :class="['ryuo-mountain__node', `ryuo-mountain__node--${node.state}`]" :data-mountain-step="node.key" :data-state="node.state">
        <template v-if="node.key !== 'ryuo'">
          <rect :x="node.x - node.w / 2 + 3" :y="node.y - node.h / 2 + 4" :width="node.w" :height="node.h" fill="#0b1320" opacity="0.55" />
          <rect
            :x="node.x - node.w / 2"
            :y="node.y - node.h / 2"
            :width="node.w"
            :height="node.h"
            :fill="NODE_FILL[node.state] ?? NODE_FILL.todo"
            :stroke="node.boss ? '#e0745e' : node.state === 'todo' || node.state === 'skip' ? '#8fa3b6' : '#fffcf4'"
            stroke-width="3"
            :class="{ 'ryuo-mountain__pulse': pulsing && node.index === road.currentIndex }"
          />
        </template>
        <text :x="node.x" :y="node.labelY" text-anchor="middle" :class="['ryuo-mountain__label', { 'ryuo-mountain__label--gold': node.key === 'ryuo' || node.key === 'finals' }]">{{ node.short }}</text>
        <text v-if="node.score" :x="node.x" :y="node.labelY + 14" text-anchor="middle" class="ryuo-mountain__label ryuo-mountain__label--gold">{{ node.score }}</text>
        <text v-if="node.state === 'lost'" :x="node.x" :y="node.labelY + 14" text-anchor="middle" class="ryuo-mountain__label ryuo-mountain__label--out">ここまで</text>
        <text v-else-if="node.mark && node.state !== 'done'" :x="node.x" :y="node.labelY + 14" text-anchor="middle" class="ryuo-mountain__label ryuo-mountain__label--gold">{{ node.mark }}</text>
      </g>

      <!-- 勝って登った直後: 倒した段に「突破」の判子(5-4)。 -->
      <g v-if="stampAt" :transform="`translate(${stampAt.x}, ${stampAt.y}) rotate(-10)`" aria-hidden="true">
        <g class="ryuo-mountain__stamp">
          <rect x="-29" y="-15" width="58" height="30" fill="#0b1320" transform="translate(3, 3)" />
          <rect x="-29" y="-15" width="58" height="30" fill="#c4604c" stroke="#fffcf4" stroke-width="3" />
          <text x="0" y="6" text-anchor="middle" class="ryuo-mountain__stamp-text">突破</text>
        </g>
      </g>

      <!-- 顔(次の相手・ライバル・いまの竜王)。次の相手の顔を押すと、くわしい情報。 -->
      <g
        v-for="face in faces"
        :key="face.key"
        :transform="`translate(${face.x}, ${face.y})`"
        :class="['ryuo-mountain__face', { 'ryuo-mountain__face--button': face.opponent }]"
        :role="face.opponent ? 'button' : undefined"
        :tabindex="face.opponent ? 0 : undefined"
        :aria-label="face.opponent ? `${face.name}のくわしい情報` : undefined"
        @click.stop="face.opponent && emit('open-opponent')"
        @keydown.enter.prevent="face.opponent && emit('open-opponent')"
      >
        <rect x="-16" y="-16" width="35" height="35" fill="#0b1320" />
        <rect x="-18" y="-18" width="36" height="36" :fill="face.sprite ? '#d8d0ff' : FACE_FILL[face.tone] ?? FACE_FILL.balance" stroke="#fffcf4" stroke-width="3" />
        <image v-if="face.sprite" :href="face.sprite" x="-15" y="-14" width="30" height="66" preserveAspectRatio="xMidYMin meet" clip-path="url(#ryuo-mountain-face-clip)" class="ryuo-mountain__sprite" />
        <text v-else x="0" y="7" text-anchor="middle" :class="['ryuo-mountain__face-char', { 'ryuo-mountain__face-char--dark': face.tone === 'balance' }]">{{ face.char }}</text>
        <g v-if="face.bubble" :transform="`translate(${face.bubbleLeft ? -112 : 24}, -12)`">
          <rect x="0" y="0" width="88" height="24" fill="#fffcf4" stroke="#0b1320" stroke-width="2" />
          <text x="44" y="17" text-anchor="middle" class="ryuo-mountain__bubble">{{ face.bubble }}</text>
        </g>
      </g>

      <!-- やこび姫と、自分の駒(将棋の駒の形)。 -->
      <image v-if="piece" :href="yakobiUrl" :x="piece.x + (piece.x > layout.width / 2 ? 18 : -46)" :y="piece.y - 50" width="28" height="52" class="ryuo-mountain__sprite" preserveAspectRatio="xMidYMin meet" />
      <g v-if="piece" ref="pieceEl" class="ryuo-mountain__piece" :transform="`translate(${pieceAt.x}, ${pieceAt.y})`">
        <polygon points="0,-34 13,-29 16,0 -16,0 -13,-29" fill="#0b1320" transform="translate(3, 3)" />
        <polygon points="0,-34 13,-29 16,0 -16,0 -13,-29" :fill="piece.won ? '#f1a54c' : '#fffcf4'" />
        <text x="0" y="-8" text-anchor="middle" class="ryuo-mountain__piece-char">自</text>
      </g>
    </svg>
    <ol class="ryuo-mountain__sr">
      <li v-for="node in nodes" :key="node.key">{{ node.label }}: {{ STATE_TEXT[node.state] }}{{ node.score ? ` ${node.score}` : "" }}</li>
    </ol>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, type PropType } from "vue";
import { HANANE_SPRITE } from "./core/ryuo-story.mjs";
import { createMoveSoundPlayer } from "./core/move-sound";
import { mountainLayers, mountainLayout } from "./core/ryuo-mountain-layout.mjs";
import type { RoadView } from "./RyuoRoad.vue";

const props = defineProps({
  road: { type: Object as PropType<RoadView>, required: true },
  assetBaseUrl: { type: String, default: "." },
  /** 対局から戻ったところ。前の段から、いまの段へ跳ぶ動きを1回だけ見せる。 */
  animate: { type: Boolean, default: false },
  /** 直前の対局に勝ったか(番勝負など、同じ段にとどまるときの跳ねと音に使う)。 */
  lastWin: { type: Boolean, default: false },
  /** 登る音を鳴らさない(判子の音を鳴らす節目のとき。重い方だけ鳴らす。Game_Nintendo_Implementation.mdの3-3)。 */
  muted: { type: Boolean, default: false },
  /** 頂上(竜王の座)を光らせる(挑戦権を得たとき・竜王になったとき)。 */
  glowCrown: { type: Boolean, default: false },
  /** 次の相手の顔(期の画面の`opponentFace`)。いまの段の横に置く。 */
  opponent: { type: Object as PropType<{ name: string; char: string; tone: string; story: string | null } | null>, default: null },
});
const emit = defineEmits<{ played: []; "open-opponent": [] }>();

/** 跳ぶ動きの長さ(ms)。Game_Nintendo_Implementation.mdの3-1「ふつうの回戦に勝つ」(小)。 */
const CLIMB_MS = 600;
/** 通った道が光っている長さ(ms)。動きと合わせて1.5秒以内。 */
const GLOW_MS = 1100;
const STATE_TEXT: Record<string, string> = { done: "通過", current: "いまの段", lost: "ここまで", skip: "通らない", todo: "まだ", won: "到達" };
const NODE_FILL: Record<string, string> = { done: "#f1a54c", current: "#fffcf4", lost: "#5d6f80", skip: "#1b2a42", todo: "#1b2a42", won: "#f1a54c" };
/** 顔の色: 攻め(朱)・受け(藍)・バランス(金)。名前の1文字でも見分ける。 */
const FACE_FILL: Record<string, string> = { attack: "#c4604c", defense: "#3d6fa5", balance: "#d9b860" };
const BYOBU = Array.from({ length: 6 }, (_, index) => ({
  x: -48 + index * 16, y: -44 + (index % 2) * 3, h: 44 - (index % 2) * 3, fill: index % 2 ? "#e8b84a" : "#f6cf63",
}));
const BAN_LINES = [1, 2, 3].flatMap((k) => [
  { id: `v${k}`, x: -15 + k * 7.5, y: 7, w: 1, h: 14 },
  { id: `h${k}`, x: -13, y: 4 + k * 4.5, w: 26, h: 1 },
]);

const hananeUrl = computed(() => `${props.assetBaseUrl}/characters/${HANANE_SPRITE.file}?v=${HANANE_SPRITE.version}`);
const yakobiUrl = computed(() => `${props.assetBaseUrl}/characters/yakobihime-mini.webp?v=4`);
const layout = computed(() => mountainLayout(props.road.steps.length));
const layers = computed(() => mountainLayers(layout.value.height));
const summit = computed(() => layout.value.points.at(-1)!);

/** 星(位置は決まった並び。画面を開くたびに変わらない)。 */
const stars = computed(() => {
  let seed = 7;
  const next = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const colors = ["#fffcf4", "#f1a54c", "#d8d0ff"];
  return Array.from({ length: 34 }, (_, id) => ({
    id, x: Math.round(next() * 780) - 195, y: Math.round(next() * Math.min(420, layout.value.height * 0.5)),
    size: next() < 0.3 ? 3 : 4, color: colors[id % 3], delay: Math.round(next() * 30) / 10,
  }));
});

const nodes = computed(() => props.road.steps.map((step, index) => {
  const { x, y } = layout.value.points[index];
  const boss = step.boss && step.key !== "ryuo";
  const w = boss ? 42 : 34;
  return {
    ...step, index, x, y, boss, w, h: Math.round(w * 0.62),
    labelY: step.key === "ryuo" ? y + 48 : y + 26,
  };
}));

/** 麓の将棋会館(ランキング戦があるときだけ)。 */
const kaikan = computed(() => {
  if (!props.road.steps[0]?.key.startsWith("ranking")) return null;
  const first = layout.value.points[0];
  const x = first.x - 92 < -10 ? first.x + 34 : first.x - 92;
  const y = layout.value.height - 26;
  const windows = [];
  for (let floor = 0; floor < 3; floor += 1) {
    for (let col = 0; col < 3; col += 1) windows.push({ id: `${floor}-${col}`, x: x + 6 + col * 18, y: y - 60 + floor * 20, lit: (floor + col) % 3 !== 0 });
  }
  return { x, y, windows };
});

const fans = computed(() => nodes.value.filter((node) => node.boss && node.key !== "finals"));

/** 道の点。段と段の間に、等間隔で四角を置く。 */
const pathDots = computed(() => {
  const dots: { id: string; x: number; y: number; passed: boolean; glow: boolean }[] = [];
  const points = layout.value.points;
  for (let index = 0; index < points.length - 1; index += 1) {
    const a = points[index];
    const b = points[index + 1];
    const parts = Math.max(2, Math.floor(Math.hypot(b.x - a.x, b.y - a.y) / 13));
    for (let k = 1; k < parts; k += 1) {
      dots.push({
        id: `${index}-${k}`,
        x: Math.round(a.x + ((b.x - a.x) * k) / parts),
        y: Math.round(a.y + ((b.y - a.y) * k) / parts),
        // 負けて通らなかった組の回戦(skip)へ向かう道は、通ったことにしない。
        passed: index < props.road.currentIndex && props.road.steps[index].state !== "skip" && props.road.steps[index + 1].state !== "skip",
        glow: glowFrom.value <= index + 1 && index + 1 <= glowTo.value,
      });
    }
  }
  return dots;
});

/** 顔: いまの段の次の相手、組の決勝のライバル(まだ当たっていないとき)、頂上の横のいまの竜王。 */
const faces = computed(() => {
  const list: { key: string; x: number; y: number; name: string; char: string; tone: string; sprite: string; opponent: boolean; bubble: string; bubbleLeft: boolean }[] = [];
  const current = nodes.value[props.road.currentIndex];
  const spriteOf = (story: string | null | undefined) => (story === "hanane" ? hananeUrl.value : "");
  if (current && current.state === "current" && props.opponent) {
    const right = current.x < layout.value.width / 2;
    const x = current.x + (right ? 48 : -48);
    list.push({
      key: "opponent", x, y: current.y - 4, name: props.opponent.name, char: props.opponent.char, tone: props.opponent.tone,
      // 吹き出しは、段から遠い側(外側)に出す。上の段の名前と重ならないように。
      sprite: spriteOf(props.opponent.story), opponent: true, bubble: "次の相手！", bubbleLeft: !right,
    });
  }
  for (const node of nodes.value) {
    if (!node.face || node.index === props.road.currentIndex) continue;
    if (node.key === "finals") {
      list.push({ key: "ryuo", x: summit.value.x + 70, y: summit.value.y - 8, name: node.face.name, char: node.face.char, tone: node.face.tone, sprite: spriteOf(node.face.story), opponent: false, bubble: "", bubbleLeft: false });
    } else if (node.state === "todo") {
      const left = node.x > layout.value.width / 2;
      list.push({ key: node.key, x: node.x + (left ? 42 : -42), y: node.y - 14, name: node.face.name, char: node.face.char, tone: node.face.tone, sprite: spriteOf(node.face.story), opponent: false, bubble: "", bubbleLeft: false });
    }
  }
  return list;
});

/** 自分の駒の位置(いまの段。竜王になったら頂上)。 */
const piece = computed(() => {
  const node = nodes.value[props.road.currentIndex];
  if (!node) return null;
  return { x: node.x, y: node.key === "ryuo" ? node.y - 30 : node.y - node.h / 2, won: node.state === "won" };
});
const pieceAt = ref({ x: piece.value?.x ?? 0, y: piece.value?.y ?? 0 });

const ariaLabel = computed(() => {
  const node = nodes.value[props.road.currentIndex];
  return node ? `竜王への道。いまは${node.label}（${STATE_TEXT[node.state]}）` : "竜王への道";
});

// ---- 跳ぶ動き(対局から戻ったとき)
const scrollEl = ref<HTMLElement | null>(null);
const pieceEl = ref<SVGGElement | null>(null);
const glowFrom = ref(Infinity);
const glowTo = ref(-Infinity);
const pulsing = ref(false);
/** 「突破」の判子を押す段の位置(勝って登ったときだけ)。 */
const stampAt = ref<{ x: number; y: number } | null>(null);
let frame = 0;
const timers: ReturnType<typeof setTimeout>[] = [];

function reducedMotion() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}
/** 動きを終わらせる(押したとき・時間が来たとき)。 */
function finish() {
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  timers.splice(0).forEach(clearTimeout);
  if (piece.value) pieceAt.value = { x: piece.value.x, y: piece.value.y };
  glowFrom.value = Infinity;
  glowTo.value = -Infinity;
  pulsing.value = false;
}
function skip() {
  if (frame || timers.length) finish();
}

/** いまの段が見えるよう、地図を上下に送る(ページはスクロールさせない)。 */
function centerCurrent() {
  const box = scrollEl.value;
  const node = nodes.value[props.road.currentIndex];
  if (!box || !node) return;
  const scale = box.scrollHeight / layout.value.height;
  box.scrollTop = Math.max(0, node.y * scale - box.clientHeight * 0.55);
}

function play() {
  const { lastIndex, currentIndex, steps } = props.road;
  if (lastIndex < 0 || currentIndex < 0 || !piece.value) return;
  const climbed = currentIndex > lastIndex && steps[lastIndex]?.state === "done";
  const stayed = currentIndex === lastIndex;
  if (!climbed && !stayed && currentIndex <= lastIndex) return;
  if (!props.muted && (climbed || (stayed && props.lastWin))) createMoveSoundPlayer(() => props.assetBaseUrl).play("climb");
  if (stayed) {
    // 番勝負・決勝トーナメントの途中: 同じ段で跳ねる(勝ったときだけ)。
    if (props.lastWin) {
      pulsing.value = true;
      timers.push(setTimeout(finish, CLIMB_MS));
    }
    return;
  }
  // 勝って登ったときだけ、通った道を光らせる(負けて敗者復活戦へ回るときは、駒が移るだけ)。
  if (climbed) {
    glowFrom.value = lastIndex + 1;
    glowTo.value = currentIndex;
    stampAt.value = { x: nodes.value[lastIndex].x + 8, y: nodes.value[lastIndex].y - 4 };
  }
  timers.push(setTimeout(finish, GLOW_MS));
  if (reducedMotion()) return;
  const from = nodes.value[lastIndex];
  const to = piece.value;
  const start = { x: from.x, y: from.y - from.h / 2 };
  const began = performance.now();
  // 弧を描いて跳ぶ(高さは段の差より少し上)。
  const lift = Math.abs(to.y - start.y) / 2 + 40;
  const step = (now: number) => {
    const t = Math.min(1, (now - began) / CLIMB_MS);
    const ease = 1 - (1 - t) ** 3;
    pieceAt.value = {
      x: start.x + (to.x - start.x) * ease,
      y: start.y + (to.y - start.y) * ease - Math.sin(Math.PI * ease) * lift,
    };
    frame = t < 1 ? requestAnimationFrame(step) : 0;
  };
  pieceAt.value = start;
  frame = requestAnimationFrame(step);
}

onMounted(async () => {
  await nextTick();
  centerCurrent();
  if (props.animate) {
    play();
    emit("played");
  }
});
onBeforeUnmount(finish);
</script>

<style>
.shogi-game .ryuo-mountain {
  position: relative;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  background: linear-gradient(#0f1828, #1c2c45 60%, #243755);
  scrollbar-width: thin;
}
.shogi-game .ryuo-mountain__svg {
  display: block;
  width: 100%;
  max-width: 34rem;
  height: auto;
  margin: 0 auto;
  overflow: visible;
}
.shogi-game .ryuo-mountain__star { animation: ryuo-mountain-twinkle 3.2s steps(2) infinite; }
@keyframes ryuo-mountain-twinkle { 50% { opacity: 0.35; } }
.shogi-game .ryuo-mountain__sign { font-size: 11px; font-weight: 900; fill: #1a2433; }
.shogi-game .ryuo-mountain__label {
  font-size: 12px;
  font-weight: 800;
  fill: #fffcf4;
  stroke: #0b1320;
  stroke-width: 3px;
  paint-order: stroke;
}
.shogi-game .ryuo-mountain__node--todo .ryuo-mountain__label,
.shogi-game .ryuo-mountain__node--skip .ryuo-mountain__label { fill: #9fb3c8; }
.shogi-game .ryuo-mountain__node--skip { opacity: 0.45; }
.shogi-game .ryuo-mountain__label--gold { fill: #ffd27a; }
.shogi-game .ryuo-mountain__label--out { fill: #a9b6c4; }
.shogi-game .ryuo-mountain__node--ryuo .ryuo-mountain__label { font-size: 14px; }
.shogi-game .ryuo-mountain__face-char { font-size: 18px; font-weight: 900; fill: #fffcf4; }
.shogi-game .ryuo-mountain__face-char--dark { fill: #1a2433; }
.shogi-game .ryuo-mountain__face--button { cursor: pointer; }
.shogi-game .ryuo-mountain__face--button:focus-visible { outline: 3px solid #d8d0ff; }
.shogi-game .ryuo-mountain__bubble { font-size: 12px; font-weight: 800; fill: #1a2433; }
.shogi-game .ryuo-mountain__sprite { image-rendering: pixelated; }
.shogi-game .ryuo-mountain__stamp { transform-box: fill-box; transform-origin: center; animation: ryuo-mountain-stamp 260ms cubic-bezier(0.2, 0.9, 0.3, 1.2) 450ms both; }
@keyframes ryuo-mountain-stamp {
  0% { opacity: 0; transform: scale(2.2); }
  70% { opacity: 1; transform: scale(0.92); }
  100% { opacity: 1; transform: scale(1); }
}
.shogi-game .ryuo-mountain__stamp-text { font-size: 16px; font-weight: 900; fill: #fffcf4; }
.shogi-game .ryuo-mountain__piece-char { font-size: 15px; font-weight: 900; fill: #1a2433; }
.shogi-game .ryuo-mountain__piece { animation: ryuo-mountain-bob 2.4s ease-in-out infinite; }
@keyframes ryuo-mountain-bob { 50% { translate: 0 -3px; } }
.shogi-game .ryuo-mountain__dot--glow { animation: ryuo-mountain-glow 1100ms ease-out; }
@keyframes ryuo-mountain-glow { 0% { fill: #fffcf4; } 100% { fill: #f1a54c; } }
.shogi-game .ryuo-mountain__pulse { animation: ryuo-mountain-pulse 600ms ease-out; transform-box: fill-box; transform-origin: center; }
@keyframes ryuo-mountain-pulse { 35% { transform: scale(1.3); } }
.shogi-game .ryuo-mountain__summit--glow { animation: ryuo-mountain-crown 700ms ease-in-out 2; }
@keyframes ryuo-mountain-crown { 50% { filter: drop-shadow(0 0 6px #ffd27a) brightness(1.25); } }
/* 読み上げだけに出す、段の一覧。 */
.shogi-game .ryuo-mountain__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
@media (prefers-reduced-motion: reduce) {
  .shogi-game .ryuo-mountain__star,
  .shogi-game .ryuo-mountain__piece,
  .shogi-game .ryuo-mountain__pulse,
  .shogi-game .ryuo-mountain__summit--glow,
  .shogi-game .ryuo-mountain__stamp { animation: none; }
}
</style>
