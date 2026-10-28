<template>
  <!--
    竜王戦の試合の札の表(docs/ryuo-stages-design.mdの3章)。1試合を1枚の札にして上下に2人を置き、左から右へ回戦を並べる。
    名前は横書き。自分は琥珀、次の相手と次の対局は朱、推しは薄紫の札、ライバルは「ライバル」の札。
    広い枠では高さいっぱいに広げ(下を空けない)、狭い枠では回戦の列を横にすべらせる(列ごとに止まる)。
  -->
  <div ref="frame" class="ryuo-bracket" :class="{ 'ryuo-bracket--scroll': scrolls }" data-bracket>
    <div class="ryuo-bracket__stage" :style="{ width: `${stageWidth}px`, height: `${stageHeight}px` }">
      <ol class="ryuo-bracket__heads" :style="{ width: `${stageWidth}px` }" aria-hidden="true">
        <li
          v-for="(round, index) in view.rounds"
          :key="round.round"
          :class="{ 'ryuo-bracket__head--current': round.round === view.userNext }"
          :style="{ left: `${index * colW}px`, width: `${cardW}px` }"
        >{{ round.label }}</li>
      </ol>
      <span v-for="(round, index) in view.rounds" :key="`snap-${round.round}`" class="ryuo-bracket__snap" :style="{ left: `${index * colW}px` }" aria-hidden="true" />
      <svg class="ryuo-bracket__lines" :width="stageWidth" :height="stageHeight" aria-hidden="true">
        <path v-for="line in lines" :key="line.key" :d="line.d" :class="{ 'ryuo-bracket__line--hot': line.hot }" />
      </svg>
      <ul class="ryuo-bracket__cards" :aria-label="ariaLabel">
        <li
          v-for="match in view.matches"
          :key="match.id"
          :class="['ryuo-bracket__card', {
            'ryuo-bracket__card--pending': match.pending && !live[match.id],
            'ryuo-bracket__card--final': match.final,
            'ryuo-bracket__card--live': live[match.id] && !live[match.id].done,
          }]"
          :style="{ left: `${(match.round - 1) * colW}px`, top: `${HEAD + match.y * leafGap - cardH / 2}px`, width: `${cardW}px`, height: `${cardH}px` }"
          :aria-label="matchAria(match)"
          :data-match="match.id"
        >
          <div
            v-for="side in (['top', 'bottom'] as const)"
            :key="side"
            :class="rowClass(match, side)"
          >
            <span class="ryuo-bracket__mark" aria-hidden="true">{{ markOf(match, side) }}</span>
            <span class="ryuo-bracket__name">
              <i v-if="oshiId && match[side].pid === oshiId" class="ryuo-bracket__tag ryuo-bracket__tag--oshi">推し</i>
              <i v-if="match[side].pid && match[side].pid === rivalId" class="ryuo-bracket__tag ryuo-bracket__tag--rival">ライバル</i>
              <template v-if="match[side].pid || !match[side].placeholder">{{ match[side].name }}</template>
              <span v-else class="ryuo-bracket__wait">{{ match[side].placeholder }}</span>
            </span>
            <!-- 決勝トーナメントは、段位の代わりに組と順位(1組優勝など)を右に出す(名前の幅を残す)。 -->
            <i v-if="match[side].label" class="ryuo-bracket__label">{{ match[side].label }}</i>
            <span v-else class="ryuo-bracket__dan">{{ match[side].dan }}</span>
          </div>
          <!--
            回戦の中継ボード(docs/tournament-relay-design.mdの18章)。何手目・形勢のバー(上の棋士の勝率。色は先後の色)・視聴者数。
          -->
          <div v-if="live[match.id]" class="ryuo-bracket__live" :data-live-match="match.id">
            <span :class="['ryuo-bracket__live-ply', { 'ryuo-bracket__live-ply--on': !live[match.id].done }]">{{ live[match.id].done ? "終局" : `${live[match.id].ply}手目` }}</span>
            <span :class="['ryuo-bracket__live-bar', `ryuo-bracket__live-bar--${live[match.id].topSide}`]" aria-hidden="true">
              <span :style="{ width: `${live[match.id].topPercent}%` }" />
            </span>
            <span class="ryuo-bracket__live-viewers"><span aria-hidden="true">👁</span>{{ live[match.id].viewers }}</span>
          </div>
          <span v-if="match.pending && !live[match.id]" class="ryuo-bracket__vs" aria-hidden="true">VS</span>
          <!-- 決着した棋士どうしの試合は、押すと中継を開く(docs/tournament-relay-design.mdの7章)。 -->
          <button
            v-if="live[match.id] || (watchable && canWatch(match))"
            type="button"
            class="ryuo-bracket__watch"
            :aria-label="`${matchAria(match)}。押すと中継を見る`"
            :data-watch-match="match.id"
            @click="emit('watch', match.id)"
          ><span aria-hidden="true">▶</span></button>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type PropType } from "vue";

type Slot = { pid: string | null; name: string; dan: string; label: string; story: string | null; you: boolean; from: string | null; placeholder: string; hope?: boolean };
type Match = {
  id: string; round: number; y: number; top: Slot; bottom: Slot; winner: "top" | "bottom" | null;
  how: string; pending: boolean; final: boolean; userIn: boolean; userWon: boolean;
};
/** 中継ボードの札の1行。topPercentは上の棋士の勝率(%)、topSideは上の棋士の先後。 */
export type LiveCard = { ply: number; done: boolean; topPercent: number; topSide: "black" | "white"; viewers: string };
export type BracketView = {
  rounds: { round: number; label: string }[];
  matches: Match[];
  leafCount: number;
  userNext: number | null;
};

const props = defineProps({
  view: { type: Object as PropType<BracketView>, required: true },
  oshiId: { type: String, default: "" },
  rivalId: { type: String, default: "" },
  /** 決着した棋士どうしの試合を押すと、中継を開く(watchを出す)。 */
  watchable: { type: Boolean, default: false },
  /** 回戦の中継ボードの、試合ごとのようす(18章)。ある試合は札に1行足し、押すと中継を開く。 */
  live: { type: Object as PropType<Record<string, LiveCard>>, default: () => ({}) },
});
const emit = defineEmits<{ watch: [matchId: string] }>();
/** 中継を見られる試合(決着していて、プレイヤーが出ていない)。 */
const canWatch = (match: Match) => Boolean(match.winner && !match.userIn && match.top.pid && match.bottom.pid);

/** 札の高さ(2行。中継ボードは3行)と、列の見出しの高さ(px)。 */
const CARD_ROWS_H = 52;
const LIVE_ROW_H = 22;
const HEAD = 40;
/** 葉(棋士)1人あたりの縦の間の下限・上限。1回戦の札は葉2人ぶんの高さに入る。中継ボードは札が高いので広げる。 */
const LEAF_MIN_PLAIN = 31;
const LEAF_MIN_LIVE = 42;
const LEAF_MAX = 84;
/** 列の幅の下限・上限(札の幅は列の幅から間を引く)。 */
const COL_MIN = 168;
const COL_MAX = 236;
const COL_GAP = 22;

const hasLive = computed(() => Object.keys(props.live).length > 0);
const cardH = computed(() => (hasLive.value ? CARD_ROWS_H + LIVE_ROW_H : CARD_ROWS_H));
const LEAF_MIN = computed(() => (hasLive.value ? LEAF_MIN_LIVE : LEAF_MIN_PLAIN));
/** 札の左の印。決着は○●、中継ボードで対局中は先後(☗☖)。 */
function markOf(match: Match, side: "top" | "bottom") {
  if (match.winner) return match.winner === side ? "○" : "●";
  const info = props.live[match.id];
  if (!info || info.done) return "";
  const black = info.topSide === "black" ? "top" : "bottom";
  return side === black ? "☗" : "☖";
}
const frame = ref<HTMLElement | null>(null);
const frameSize = ref({ width: 0, height: 0 });
const roundCount = computed(() => Math.max(1, props.view.rounds.length));
/** 列の幅。枠に収まれば枠いっぱいに広げ、収まらなければ下限で横にすべらせる。 */
const colW = computed(() => Math.min(COL_MAX, Math.max(COL_MIN, Math.floor((frameSize.value.width + COL_GAP) / roundCount.value))));
const cardW = computed(() => colW.value - COL_GAP);
const scrolls = computed(() => colW.value * roundCount.value - COL_GAP > frameSize.value.width + 1);
/** 葉の縦の間。枠の高さいっぱいに広げる(下を空けない)。入らなければ下限で縦に動かす。 */
const leafGap = computed(() => {
  const leaves = Math.max(1, props.view.leafCount);
  const fit = (frameSize.value.height - HEAD - 8) / leaves;
  return Math.min(LEAF_MAX, Math.max(LEAF_MIN.value, fit));
});
const stageWidth = computed(() => colW.value * roundCount.value - COL_GAP);
const stageHeight = computed(() => HEAD + props.view.leafCount * leafGap.value + 8);

/** 前の試合の札から、次の試合の札の、その棋士の行へ引く線。自分が勝ち上がった線は琥珀。 */
const lines = computed(() => {
  const byId = new Map(props.view.matches.map((match) => [match.id, match]));
  const out: { key: string; d: string; hot: boolean }[] = [];
  for (const match of props.view.matches) {
    (["top", "bottom"] as const).forEach((side, index) => {
      const from = match[side].from;
      const child = from ? byId.get(from) : null;
      if (!child) return;
      const x1 = (child.round - 1) * colW.value + cardW.value;
      const y1 = HEAD + child.y * leafGap.value;
      const x2 = (match.round - 1) * colW.value;
      const y2 = HEAD + match.y * leafGap.value - cardH.value / 2 + (index === 0 ? CARD_ROWS_H / 4 : (CARD_ROWS_H * 3) / 4);
      const xm = x2 - COL_GAP / 2;
      out.push({ key: `${child.id}-${match.id}`, d: `M${x1} ${y1} H${xm} V${y2} H${x2}`, hot: child.userWon });
    });
  }
  return out;
});

function rowClass(match: Match, side: "top" | "bottom") {
  const slot = match[side];
  return [
    "ryuo-bracket__row",
    {
      "ryuo-bracket__row--win": match.winner === side,
      "ryuo-bracket__row--lose": match.winner !== null && match.winner !== side,
      "ryuo-bracket__row--you": slot.you || slot.hope,
      "ryuo-bracket__row--opponent": match.pending && !slot.you && Boolean(slot.pid),
      "ryuo-bracket__row--hope": slot.hope,
    },
  ];
}
const sideText = (slot: Slot) => (slot.pid ? `${slot.label ? `${slot.label} ` : ""}${slot.name}` : slot.placeholder || slot.name);
function matchAria(match: Match) {
  const result = match.winner ? `、${sideText(match[match.winner])}の勝ち` : match.pending ? "、あなたの次の対局" : "";
  return `${props.view.rounds[match.round - 1]?.label ?? ""} ${sideText(match.top)} 対 ${sideText(match.bottom)}${result}`;
}
const ariaLabel = computed(() => `トーナメント表(${props.view.rounds.map(({ label }) => label).join("・")})`);

let observer: ResizeObserver | undefined;
function measure() {
  const el = frame.value;
  if (!el) return;
  frameSize.value = { width: el.clientWidth, height: el.clientHeight };
}
/** 開いたとき、次の対局(なければ最後に指した試合)の回戦が左に来るよう、横に送る。縦は、その札が見えるように。 */
function scrollToUser() {
  const el = frame.value;
  if (!el) return;
  const round = props.view.userNext;
  if (round && scrolls.value) el.scrollLeft = Math.max(0, (round - 2) * colW.value);
  const match = props.view.matches.find((entry) => entry.pending) ?? [...props.view.matches].reverse().find((entry) => entry.userIn);
  if (match && el.scrollHeight > el.clientHeight) {
    el.scrollTop = Math.max(0, HEAD + match.y * leafGap.value - el.clientHeight / 2);
  }
}
onMounted(() => {
  measure();
  observer = new ResizeObserver(measure);
  if (frame.value) observer.observe(frame.value);
  void nextTick(scrollToUser);
});
onBeforeUnmount(() => observer?.disconnect());
// 次の対局の回戦が変わったときだけ送る(中継ボードで結果が出るたびに、見ているところから動かさない)。
watch(() => `${props.view.userNext}:${props.view.matches.find((entry) => entry.pending)?.id ?? ""}`, () => void nextTick(scrollToUser));
</script>

<style>
.shogi-game .ryuo-bracket {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
}
.shogi-game .ryuo-bracket--scroll { scroll-snap-type: x mandatory; }
.shogi-game .ryuo-bracket__stage { position: relative; }
.shogi-game .ryuo-bracket__snap { position: absolute; top: 0; width: 1px; height: 1px; scroll-snap-align: start; }
.shogi-game .ryuo-bracket__heads {
  position: sticky;
  top: 0;
  z-index: 2;
  height: 32px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.shogi-game .ryuo-bracket__heads li {
  position: absolute;
  top: 0;
  display: grid;
  place-items: center;
  height: 28px;
  border: 1px solid #2c4359;
  border-radius: 999px;
  color: #9fb3c8;
  background: #0f1828;
  font-size: 0.78rem;
  font-weight: 900;
  white-space: nowrap;
}
.shogi-game .ryuo-bracket__heads li.ryuo-bracket__head--current { border-color: #f1a54c; color: #172632; background: #f1a54c; }
.shogi-game .ryuo-bracket__lines { position: absolute; left: 0; top: 0; overflow: visible; pointer-events: none; }
.shogi-game .ryuo-bracket__lines path { fill: none; stroke: #4b6585; stroke-width: 2; }
.shogi-game .ryuo-bracket__lines path.ryuo-bracket__line--hot { stroke: #f1a54c; stroke-width: 4; }
.shogi-game .ryuo-bracket__cards { margin: 0; padding: 0; list-style: none; }
.shogi-game .ryuo-bracket__card {
  position: absolute;
  display: grid;
  grid-template-rows: 24px 24px;
  grid-auto-rows: 22px;
  box-sizing: border-box;
  border: 2px solid #3a526e;
  border-radius: 8px;
  background: #22344c;
  font-size: 0.82rem;
}
.shogi-game .ryuo-bracket__card--final { border-color: #d4a93a; }
.shogi-game .ryuo-bracket__card--pending { border-color: #e0745e; box-shadow: 0 0 0 3px rgba(224, 116, 94, 0.35); }
.shogi-game .ryuo-bracket__row {
  display: grid;
  grid-template-columns: 1.1rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
  padding: 0 0.45rem;
  color: #fffcf4;
}
.shogi-game .ryuo-bracket__row:first-child { border-radius: 6px 6px 0 0; }
.shogi-game .ryuo-bracket__row + .ryuo-bracket__row { border-top: 1px solid #3a526e; border-radius: 0 0 6px 6px; }
.shogi-game .ryuo-bracket__mark { display: grid; place-items: center; width: 1rem; height: 1rem; border-radius: 4px; font-size: 0.7rem; font-weight: 900; }
.shogi-game .ryuo-bracket__row--win .ryuo-bracket__mark { color: #172632; background: #f1a54c; }
.shogi-game .ryuo-bracket__row--lose .ryuo-bracket__mark { color: #8ea0b4; background: #33465e; }
.shogi-game .ryuo-bracket__name { display: flex; align-items: center; gap: 0.25rem; min-width: 0; overflow: hidden; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.shogi-game .ryuo-bracket__row--win .ryuo-bracket__name { font-weight: 900; }
.shogi-game .ryuo-bracket__row--lose { color: #7d8ea3; }
.shogi-game .ryuo-bracket__row--you { background: rgba(241, 165, 76, 0.2); }
.shogi-game .ryuo-bracket__row--you .ryuo-bracket__name { color: #ffd27a; }
.shogi-game .ryuo-bracket__row--opponent { background: rgba(196, 96, 76, 0.28); }
.shogi-game .ryuo-bracket__row--hope { outline: 2px dashed #f1a54c; outline-offset: -2px; }
.shogi-game .ryuo-bracket__dan { color: #9fb3c8; font-size: 0.68rem; white-space: nowrap; }
.shogi-game .ryuo-bracket__wait { color: #7d8ea3; font-weight: 700; }
.shogi-game .ryuo-bracket__label,
.shogi-game .ryuo-bracket__tag {
  flex: none;
  padding: 0 0.3rem;
  border-radius: 4px;
  font-size: 0.62rem;
  font-style: normal;
  font-weight: 900;
}
.shogi-game .ryuo-bracket__label { color: #172632; background: #c9d6e6; }
.shogi-game .ryuo-bracket__tag--oshi { color: #172632; background: #d8d0ff; }
.shogi-game .ryuo-bracket__tag--rival { color: #fffcf4; background: #8a5ad1; }
/* 中継を見られる試合。札全体を押せるようにし、右端に小さな印を出す。 */
.shogi-game .ryuo-bracket__watch {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 0.15rem;
  border: 0;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
}
.shogi-game .ryuo-bracket__watch span {
  display: grid;
  place-items: center;
  width: 1.05rem;
  height: 1.05rem;
  margin-right: -0.6rem;
  border-radius: 50%;
  color: #172632;
  background: #f1a54c;
  font-size: 0.55rem;
  box-shadow: 0 0 0 2px #142231;
}
.shogi-game .ryuo-bracket__watch:hover,
.shogi-game .ryuo-bracket__watch:focus-visible { background: rgba(241, 165, 76, 0.12); outline: 2px solid #f1a54c; outline-offset: -2px; }
/* 回戦の中継ボード(18章)。対局中の札は赤い縁で脈打つ(動きを減らす設定では止める)。 */
.shogi-game .ryuo-bracket__card--live { border-color: #e0745e; }
.shogi-game .ryuo-bracket__live {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.3rem;
  align-items: center;
  padding: 0 0.4rem;
  border-top: 1px solid #3a526e;
  color: #c9d6e6;
  font-size: 0.68rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.shogi-game .ryuo-bracket__live-ply--on { color: #ffb3a4; }
.shogi-game .ryuo-bracket__live-ply--on::before { content: "●"; margin-right: 0.15rem; color: #e0745e; animation: ryuo-bracket-live 1.2s ease-in-out infinite; }
.shogi-game .ryuo-bracket__live-bar { height: 0.42rem; overflow: hidden; border-radius: 999px; }
.shogi-game .ryuo-bracket__live-bar span { display: block; height: 100%; transition: width 0.4s ease; }
/* 上の棋士の色(先手は青・後手は赤)と、下の棋士の色。中継の勝率バーと同じ色。 */
.shogi-game .ryuo-bracket__live-bar--black { background: #c8433a; }
.shogi-game .ryuo-bracket__live-bar--black span { background: #3d78b8; }
.shogi-game .ryuo-bracket__live-bar--white { background: #3d78b8; }
.shogi-game .ryuo-bracket__live-bar--white span { background: #c8433a; }
.shogi-game .ryuo-bracket__live-viewers { color: #9fb3c8; }
@keyframes ryuo-bracket-live { 50% { opacity: 0.25; } }
@media (prefers-reduced-motion: reduce) {
  .shogi-game .ryuo-bracket__live-ply--on::before { animation: none; }
  .shogi-game .ryuo-bracket__live-bar span { transition: none; }
}
.shogi-game .ryuo-bracket__vs {
  position: absolute;
  top: 50%;
  right: -0.9rem;
  padding: 0.05rem 0.35rem;
  border-radius: 5px;
  color: #fffcf4;
  background: #c4604c;
  font-size: 0.66rem;
  font-weight: 900;
  transform: translateY(-50%);
}
</style>
