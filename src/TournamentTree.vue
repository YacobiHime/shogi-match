<template>
  <!--
    表は、置かれた枠の大きさに合わせて拡大・縮小する(MIN_SCALE〜MAX_SCALE)。
    それより小さくしないと収まらないときは、読める大きさのまま、枠の中でスクロールする。
  -->
  <div ref="frame" class="shogi-tree" data-tree>
    <div class="shogi-tree__stage" :style="{ width: `${layout.width * scale}px`, height: `${layout.height * scale}px` }">
    <!-- 段の名前(1回戦〜決勝)。横に送っても、左に残す。 -->
    <div class="shogi-tree__rows" aria-hidden="true">
      <span v-for="row in layout.rows" :key="row.round" class="shogi-tree__row" :style="{ top: `${row.y * scale}px`, fontSize: `${0.68 * Math.min(scale, 1.5)}rem` }">{{ row.label }}</span>
    </div>
    <div
      class="shogi-tree__canvas"
      :style="{ width: `${layout.width}px`, height: `${layout.height}px`, transform: `scale(${scale})` }"
    >
      <svg class="shogi-tree__lines" :width="layout.width" :height="layout.height" aria-hidden="true">
        <polyline
          v-for="edge in orderedEdges"
          :key="edge.id"
          :class="['shogi-tree__edge', { 'shogi-tree__edge--won': edge.won, 'shogi-tree__edge--next': edge.next }]"
          :points="edge.points.map(([x, y]) => `${x},${y}`).join(' ')"
          fill="none"
        />
        <circle
          v-for="node in layout.nodes"
          :key="node.id"
          :class="['shogi-tree__node', { 'shogi-tree__node--decided': node.decided, 'shogi-tree__node--pending': node.pending }]"
          :cx="node.x"
          :cy="node.y"
          :r="node.pending ? 6 : 3.5"
        />
        <circle v-if="layout.finals" :class="['shogi-tree__node', { 'shogi-tree__node--decided': layout.finals.decided }]" :cx="layout.finals.x" :cy="layout.finals.y" r="4" />
      </svg>

      <!-- 次の対局。ここで、あなたと相手の線がぶつかる。 -->
      <div
        v-if="pendingNode && opponentId"
        class="shogi-tree__vs"
        :style="{ left: `${pendingNode.x}px`, top: `${pendingNode.y}px` }"
        data-tree-next
      >VS</div>

      <!-- 決勝(挑戦者決定三番勝負)と、七番勝負の札 -->
      <template v-if="finals">
        <div class="shogi-tree__badge shogi-tree__badge--gold" :style="{ left: `${layout.rootX}px`, top: `${layout.rootY - rowHeight / 2}px` }">決勝三番勝負</div>
        <div v-if="layout.finals" class="shogi-tree__badge shogi-tree__badge--red" :style="{ left: `${layout.finals.x}px`, top: `${layout.finals.y - 14}px` }">七番勝負</div>
      </template>
      <div v-else-if="rootBadge" class="shogi-tree__badge shogi-tree__badge--gold" :style="{ left: `${layout.rootX}px`, top: `${layout.rootY - 18}px` }">{{ rootBadge }}</div>

      <div
        v-for="leaf in layout.leaves"
        :key="leaf.pid"
        :class="['shogi-tree__leaf', {
          'shogi-tree__leaf--user': leaf.pid === userId,
          'shogi-tree__leaf--opponent': leaf.pid === opponentId,
          'shogi-tree__leaf--out': lost.has(leaf.pid),
          'shogi-tree__leaf--mark': markId && leaf.pid === markId,
          'shogi-tree__leaf--rival': rivalId && leaf.pid === rivalId,
        }]"
        :style="{ left: `${leaf.x}px`, top: `${leaf.y}px`, width: `${leafWidth - 6}px`, height: `${leafHeight}px` }"
        :title="`${player(leaf.pid)?.name} ${player(leaf.pid)?.dan} Lv.${player(leaf.pid)?.level ?? ''}`"
      >
        <small class="shogi-tree__tag">{{ player(leaf.pid)?.label }}</small>
        <span class="shogi-tree__name"><b v-if="markId && leaf.pid === markId" class="shogi-tree__mark" aria-label="推し">★</b><b v-if="rivalId && leaf.pid === rivalId" class="shogi-tree__rival" aria-label="ライバル">◆</b>{{ player(leaf.pid)?.name }}</span>
        <small class="shogi-tree__dan">{{ shortDan(player(leaf.pid)?.dan) }}</small>
      </div>
      <div
        v-if="layout.defender && finals"
        class="shogi-tree__leaf shogi-tree__leaf--champion"
        :style="{ left: `${layout.defender.x}px`, top: `${layout.defender.y}px`, width: `${leafWidth - 6}px`, height: `${leafHeight}px` }"
      >
        <small class="shogi-tree__tag">{{ finals.defenderLabel ?? "竜王" }}</small>
        <span class="shogi-tree__name">{{ finals.defender.name }}</span>
        <small class="shogi-tree__dan">{{ shortDan(finals.defender.dan) }}</small>
      </div>
    </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, type PropType } from "vue";
import { layoutTree } from "./core/ryuo-tree-layout.mjs";

type Brief = { id: string; name: string; dan: string; level: number; label?: string };
type Tree = {
  root: { pid?: string; from?: string }; rounds: number;
  nodes: Record<string, { id: string; a: { pid?: string; from?: string }; b: { pid?: string; from?: string }; winner: string | null; round: number }>;
  leaves: Record<string, Brief>; pendingNodeId: string | null;
};

const props = defineProps({
  tree: { type: Object as PropType<Tree>, required: true },
  /** 七番勝負(防衛側の竜王と、決勝の勝者)。決勝トーナメントの表で使う。 */
  finals: { type: Object as PropType<{ defender: Brief; winner: string | null; defenderLabel?: string } | null>, default: null },
  rootBadge: { type: String, default: "" },
  userId: { type: String, default: "user" },
  /** 印を付ける棋士(推しの棋士)。 */
  markId: { type: String, default: "" },
  /** ライバル(天鷺羽音)の棋士。推しの★とは別の印(◆)を付ける。 */
  rivalId: { type: String, default: "" },
});

const rowHeight = 44;
/** 左に空けて、段の名前を置く幅。 */
const GUTTER = 54;
// 人数が多い表は、葉を細くして、横に長くなりすぎないようにする。
const leafWidth = computed(() => (Object.keys(props.tree.leaves).length > 16 ? 40 : 52));
const leafHeight = 124;
const layout = computed(() => layoutTree(props.tree, {
  leafWidth: leafWidth.value,
  rowHeight,
  leafHeight,
  gutter: GUTTER,
  top: props.finals ? rowHeight + 40 : 44,
  finals: props.finals ? { defender: props.finals.defender.id, winner: props.finals.winner } : null,
}));
/** 拡大・縮小の範囲。小さすぎると名前が読めないので、MIN_SCALEより小さくはせず、枠の中でスクロールさせる。 */
const MIN_SCALE = 0.9;
const MAX_SCALE = 2.2;
const frame = ref<HTMLElement | null>(null);
const frameSize = ref({ width: 0, height: 0 });
let frameObserver: ResizeObserver | undefined;
onMounted(() => {
  // 枠の高さが決まっているとき(親が --tree-fit: both を指定したとき)だけ、高さにも合わせる。
  // 高さが中身で決まる枠で高さに合わせると、縮めるたびに枠も縮み、表がどこまでも小さくなるため。
  const measure = () => {
    const el = frame.value;
    if (!el) return;
    const fitHeight = getComputedStyle(el).getPropertyValue("--tree-fit").trim() === "both";
    frameSize.value = { width: el.clientWidth, height: fitHeight ? el.clientHeight : 0 };
  };
  // 表が枠より広いときは、自分の名前(次の対局があれば、その試合)が見える位置まで横に送っておく。
  // 枠の大きさが決まってから(タブで表を開いたときなど)送るので、最初に大きさを測れたときに1回だけ行う。
  let scrolled = false;
  const scrollToUser = () => {
    const el = frame.value;
    if (scrolled || !el || !el.clientWidth) return;
    scrolled = true;
    const you = layout.value.leaves.find((leaf) => leaf.pid === props.userId);
    const x = pendingNode.value && opponentId.value ? pendingNode.value.x : you?.x;
    if (x !== undefined && el.scrollWidth > el.clientWidth) {
      el.scrollLeft = Math.max(0, x * scale.value - el.clientWidth / 2);
    }
  };
  const measureAndScroll = () => {
    measure();
    void nextTick(scrollToUser);
  };
  measureAndScroll();
  frameObserver = new ResizeObserver(measureAndScroll);
  if (frame.value) frameObserver.observe(frame.value);
});
onBeforeUnmount(() => frameObserver?.disconnect());
/** 枠の幅と高さの両方に収まる倍率。枠の高さが決まっていない(0)ときは、幅だけで決める。 */
const scale = computed(() => {
  const { width, height } = frameSize.value;
  if (!width) return 1;
  const fit = Math.min(width / layout.value.width, height ? height / layout.value.height : Infinity);
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, fit));
});
const player = (pid: string) => props.tree.leaves[pid];
/** 線は、灰色・勝ち上がり(琥珀)・次の対局(朱)の順に重ねる。 */
const orderedEdges = computed(() => {
  const rank = (edge: { won: boolean; next: boolean }) => (edge.next ? 2 : edge.won ? 1 : 0);
  return [...layout.value.edges].sort((a, b) => rank(a) - rank(b));
});
const pidOf = (side: { pid?: string; from?: string }) => side.pid ?? (side.from ? props.tree.nodes[side.from].winner : null);
/** 次の対局(保留中の試合)。 */
const pendingNode = computed(() => layout.value.nodes.find((node) => node.pending) ?? null);
/** 次の対局の相手。あなたの試合のときだけ。 */
const opponentId = computed(() => {
  const node = props.tree.pendingNodeId ? props.tree.nodes[props.tree.pendingNodeId] : null;
  if (!node) return "";
  const pids = [pidOf(node.a), pidOf(node.b)];
  if (!pids.includes(props.userId)) return "";
  return pids.find((pid) => pid && pid !== props.userId) ?? "";
});
/** 葉の幅に収まるよう、長い段位(女流二段・奨励会三段)を縮める。 */
const shortDan = (dan = "") => dan.replace("奨励会", "奨").replace("女流", "女");
/** 負けた棋士(表のどこかの試合で敗れた人)。 */
const lost = computed(() => {
  const set = new Set<string>();
  for (const node of Object.values(props.tree.nodes)) {
    if (node.winner === null) continue;
    for (const side of [node.a, node.b]) {
      const pid = pidOf(side);
      if (pid && pid !== node.winner) set.add(pid);
    }
  }
  return set;
});
</script>

<style>
.shogi-game .shogi-tree { overflow: auto; overscroll-behavior: contain; }
.shogi-game .shogi-tree__stage { position: relative; margin: 0 auto; }
.shogi-game .shogi-tree__canvas { position: absolute; top: 0; left: 0; transform-origin: 0 0; }
.shogi-game .shogi-tree__lines { position: absolute; inset: 0; }
.shogi-game .shogi-tree {
  --tree-line: rgba(255, 252, 244, 0.4);
  --tree-won: #f1a54c;
  /* 次の対局(朱)。プレイヤー(琥珀)と推し(薄紫)と見分けられる色にする。 */
  --tree-next: #ef7d62;
}
/* 段の名前。表を横に送っても、左に残る(sticky)。 */
.shogi-game .shogi-tree__rows { position: sticky; left: 0; z-index: 2; width: 0; height: 0; }
.shogi-game .shogi-tree__row {
  position: absolute;
  left: 4px;
  padding: 0.1rem 0.45rem;
  border: 1px solid rgba(255, 252, 244, 0.25);
  border-radius: 999px;
  color: rgba(255, 252, 244, 0.9);
  background: rgba(23, 38, 50, 0.92);
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1.3;
  white-space: nowrap;
  transform: translateY(-50%);
}
.shogi-game .shogi-tree__edge { stroke: var(--tree-line); stroke-width: 1.5; }
/* 勝者の線。縦と横の線の角がつながって見えるよう、端を四角にする。 */
.shogi-game .shogi-tree__edge--won { stroke: var(--tree-won); stroke-width: 3.5; stroke-linecap: square; }
.shogi-game .shogi-tree__edge--next { stroke: var(--tree-next); stroke-width: 3.5; stroke-linecap: square; }
.shogi-game .shogi-tree__node { fill: rgba(255, 252, 244, 0.35); }
.shogi-game .shogi-tree__node--decided { fill: var(--tree-won); }
.shogi-game .shogi-tree__node--pending { fill: #d8d0ff; stroke: #fffcf4; stroke-width: 2; animation: shogi-tree-pulse 1.4s ease-in-out infinite; }
@keyframes shogi-tree-pulse { 50% { opacity: 0.45; } }
/* 次の対局の札。あなたと相手の線が、ここでぶつかる。 */
.shogi-game .shogi-tree__vs {
  position: absolute;
  padding: 0.1rem 0.45rem;
  border-radius: 0.3rem;
  color: #fffcf4;
  background: var(--tree-next);
  box-shadow: 0 0 0 2px #172632;
  font-size: 0.8rem;
  font-weight: 900;
  letter-spacing: 0.06em;
  line-height: 1.2;
  transform: translate(-50%, -50%);
  animation: shogi-tree-vs 1.6s ease-in-out infinite;
}
@keyframes shogi-tree-vs { 50% { transform: translate(-50%, -50%) scale(1.12); } }
@media (prefers-reduced-motion: reduce) {
  .shogi-game .shogi-tree__vs,
  .shogi-game .shogi-tree__node--pending { animation: none; }
}
.shogi-game .shogi-tree__badge {
  position: absolute;
  padding: 0.15rem 0.7rem;
  border-radius: 0.2rem;
  color: #fffcf4;
  font-size: 0.8rem;
  font-weight: 700;
  white-space: nowrap;
  transform: translate(-50%, -50%);
}
.shogi-game .shogi-tree__badge--gold { color: #172632; background: #f1a54c; }
.shogi-game .shogi-tree__badge--red { background: #c4604c; }
.shogi-game .shogi-tree__leaf {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  padding: 0.2rem 0;
  border: 1px solid rgba(255, 252, 244, 0.4);
  border-radius: 0.15rem;
  background: #172632;
  box-sizing: border-box;
  transform: translateX(-50%);
  overflow: hidden;
}
.shogi-game .shogi-tree__leaf--user { border: 2px solid #f1a54c; background: rgba(241, 165, 76, 0.2); }
.shogi-game .shogi-tree__leaf--opponent { border: 2px solid var(--tree-next); background: rgba(239, 125, 98, 0.18); }
/* 推しの棋士。プレイヤー(琥珀色)と見分けられるよう、薄紫の枠にする。 */
.shogi-game .shogi-tree__leaf--mark { border: 2px solid #d7d1fd; }
.shogi-game .shogi-tree__leaf--rival { border: 2px solid #d4a93a; }
.shogi-game .shogi-tree__rival { margin-right: 0.15rem; color: #d4a93a; font-size: 0.85em; }
.shogi-game .shogi-tree__mark { display: block; color: #d7d1fd; font-size: 0.9em; line-height: 1; }
.shogi-game .shogi-tree__leaf--champion { border: 2px solid #d8d0ff; background: rgba(216, 208, 255, 0.14); }
.shogi-game .shogi-tree__leaf--out { opacity: 0.55; }
.shogi-game .shogi-tree__tag {
  min-height: 1.1em;
  color: #f1a54c;
  font-size: 0.62rem;
  line-height: 1.1;
  text-align: center;
  writing-mode: vertical-rl;
  text-orientation: upright;
}
.shogi-game .shogi-tree__name {
  flex: 1;
  font-size: 0.9rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  writing-mode: vertical-rl;
  text-orientation: upright;
}
.shogi-game .shogi-tree__dan { font-size: 0.7rem; color: rgba(255, 252, 244, 0.8); white-space: nowrap; }
</style>
