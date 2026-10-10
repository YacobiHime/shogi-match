<template>
  <div class="shogi-tree" data-tree>
    <div class="shogi-tree__canvas" :style="{ width: `${layout.width}px`, height: `${layout.height}px` }">
      <svg class="shogi-tree__lines" :width="layout.width" :height="layout.height" aria-hidden="true">
        <polyline
          v-for="edge in layout.edges"
          :key="edge.id"
          :class="['shogi-tree__edge', { 'shogi-tree__edge--won': edge.won }]"
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

      <!-- 決勝(挑戦者決定三番勝負)と、七番勝負の札 -->
      <template v-if="finals">
        <div class="shogi-tree__badge shogi-tree__badge--gold" :style="{ left: `${layout.rootX}px`, top: `${layout.rootY - rowHeight / 2}px` }">決勝三番勝負</div>
        <div v-if="layout.finals" class="shogi-tree__badge shogi-tree__badge--red" :style="{ left: `${layout.finals.x}px`, top: `${layout.finals.y - 14}px` }">七番勝負</div>
      </template>
      <div v-else-if="rootBadge" class="shogi-tree__badge shogi-tree__badge--gold" :style="{ left: `${layout.rootX}px`, top: `${layout.rootY - 18}px` }">{{ rootBadge }}</div>

      <div
        v-for="leaf in layout.leaves"
        :key="leaf.pid"
        :class="['shogi-tree__leaf', { 'shogi-tree__leaf--user': leaf.pid === userId, 'shogi-tree__leaf--out': lost.has(leaf.pid) }]"
        :style="{ left: `${leaf.x}px`, top: `${leaf.y}px`, width: `${leafWidth - 6}px`, height: `${leafHeight}px` }"
        :title="`${player(leaf.pid)?.name} ${player(leaf.pid)?.dan} Lv.${player(leaf.pid)?.level ?? ''}`"
      >
        <small class="shogi-tree__tag">{{ player(leaf.pid)?.label }}</small>
        <span class="shogi-tree__name">{{ player(leaf.pid)?.name }}</span>
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
</template>

<script setup lang="ts">
import { computed, type PropType } from "vue";
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
});

const rowHeight = 44;
// 人数が多い表は、葉を細くして、横に長くなりすぎないようにする。
const leafWidth = computed(() => (Object.keys(props.tree.leaves).length > 16 ? 40 : 52));
const leafHeight = 124;
const layout = computed(() => layoutTree(props.tree, {
  leafWidth: leafWidth.value,
  rowHeight,
  leafHeight,
  top: props.finals ? rowHeight + 40 : 44,
  finals: props.finals ? { defender: props.finals.defender.id, winner: props.finals.winner } : null,
}));
const player = (pid: string) => props.tree.leaves[pid];
/** 葉の幅に収まるよう、長い段位(女流二段・奨励会三段)を縮める。 */
const shortDan = (dan = "") => dan.replace("奨励会", "奨").replace("女流", "女");
/** 負けた棋士(表のどこかの試合で敗れた人)。 */
const lost = computed(() => {
  const set = new Set<string>();
  const pidOf = (side: { pid?: string; from?: string }) => side.pid ?? (side.from ? props.tree.nodes[side.from].winner : null);
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
.shogi-game .shogi-tree { overflow-x: auto; padding-bottom: 0.5rem; }
.shogi-game .shogi-tree__canvas { position: relative; margin: 0 auto; }
.shogi-game .shogi-tree__lines { position: absolute; inset: 0; }
.shogi-game .shogi-tree__edge { stroke: rgba(255, 252, 244, 0.35); stroke-width: 1.5; }
.shogi-game .shogi-tree__edge--won { stroke: #f1a54c; stroke-width: 3; }
.shogi-game .shogi-tree__node { fill: rgba(255, 252, 244, 0.35); }
.shogi-game .shogi-tree__node--decided { fill: #f1a54c; }
.shogi-game .shogi-tree__node--pending { fill: #d8d0ff; stroke: #fffcf4; stroke-width: 2; animation: shogi-tree-pulse 1.4s ease-in-out infinite; }
@keyframes shogi-tree-pulse { 50% { opacity: 0.45; } }
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
