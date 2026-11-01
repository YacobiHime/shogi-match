<template>
  <!--
    ぐるぐる指導対局(多面指し。docs/pro-year-design.mdの10-2の6)。あなたが上手(後手・先に指す)で、3人のアマチュアと同時に指す。
    1手指すと、相手が指し返し、次の盤へ回る。相手はロジックAI(エンジンを使わない)で、駒を大きく損すると投了する。
    「ここまで」で区切ると、指しかけの盤は引き分け(D:9-2 やめても責めない)。
  -->
  <section class="festival-simul" aria-label="ぐるぐる指導対局" data-festival-simul>
    <ol class="festival-simul__tables" aria-label="3つの盤">
      <li
        v-for="(board, index) in boards"
        :key="index"
        class="festival-simul__table"
        :class="{ 'festival-simul__table--active': index === active && phase === 'play', [`festival-simul__table--${board.result}`]: Boolean(board.result) }"
        :data-simul-table="index"
      >
        <b>{{ board.guest.name }}</b>
        <small>{{ board.guest.handicapLabel }}・{{ board.guest.grade }}</small>
        <span class="festival-simul__state">{{ tableState(board, index) }}</span>
      </li>
    </ol>

    <div ref="stageEl" class="festival-simul__stage">
      <div class="festival-simul__board" :style="boardBoxStyle">
        <ShogiMatchBoard
          v-if="current"
          :sfen="current.sfen"
          :last-move="current.lastMove"
          :allow-move="canMove"
          :enable-drag-and-drop="true"
          :flip="true"
          :mobile="isNarrow"
          :layout="isNarrow ? 'portrait' : 'standard'"
          :asset-base-url="assetBaseUrl"
          :black-player-name="current.guest.name"
          :white-player-name="playerName"
          @usi-move="onBoardMove"
          @resize="onBoardResize"
        />
      </div>
      <div ref="panelEl" class="festival-simul__panel">
        <p class="festival-simul__line" aria-live="polite" data-simul-line>{{ line }}</p>
        <template v-if="phase === 'intro'">
          <button type="button" class="shogi-tournament__start" data-simul-start @click="begin">はじめる</button>
          <button type="button" class="shogi-tournament__sub" data-simul-back @click="emit('cancel')">やめる</button>
        </template>
        <template v-else-if="phase === 'play'">
          <button type="button" class="shogi-tournament__sub" data-simul-stop @click="stop">ここまで</button>
        </template>
        <template v-else>
          <p class="festival-simul__tally" data-simul-tally>{{ tally.wins }}勝{{ tally.losses }}敗{{ tally.draws ? `${tally.draws}分` : "" }}</p>
          <button type="button" class="shogi-tournament__start" data-simul-done @click="emit('done', tally)">まつりに戻る</button>
        </template>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, type PropType } from "vue";
import ShogiMatchBoard from "./ShogiMatchBoard.vue";
import { guestMove, sfenAfter, sideToMove, simulStartSfen, simulStatus, simulTally } from "./core/festival-simul.mjs";

type Guest = { name: string; grade: string; logic: number; handicap: string; handicapLabel: string };
type Board = { guest: Guest; start: string; sfen: string; moves: string[]; lastMove: string; result: "win" | "loss" | "draw" | null };

const props = defineProps({
  guests: { type: Array as PropType<Guest[]>, required: true },
  playerName: { type: String, default: "あなた" },
  assetBaseUrl: { type: String, default: "." },
  seed: { type: Number, default: 1 },
});
const emit = defineEmits<{ done: [tally: { wins: number; losses: number; draws: number }]; cancel: [] }>();

const boards = ref<Board[]>(props.guests.map((guest) => {
  const start = simulStartSfen(guest.handicap);
  return { guest, start, sfen: start, moves: [], lastMove: "", result: null };
}));
const active = ref(0);
const phase = ref<"intro" | "play" | "done">("intro");
const thinking = ref(false);
const current = computed(() => boards.value[active.value] ?? null);
const canMove = computed(() => phase.value === "play" && !thinking.value && Boolean(current.value) && !current.value!.result && sideToMove(current.value!.sfen) === "white");
const tally = computed(() => simulTally(boards.value));

/** 種から決まる乱数(同じまつりは同じ手つき)。 */
let randomState = (props.seed >>> 0) || 1;
const random = () => {
  randomState = (Math.imul(randomState ^ (randomState >>> 15), 2246822519) + 0x9e3779b9) >>> 0;
  return randomState / 4294967296;
};

const line = computed(() => {
  const board = current.value;
  if (phase.value === "intro") return "3人と同時に指すよ。1手指すと、相手が指し返して、次の盤へ回るよ。あなたが上手で、先に指そう！";
  if (phase.value === "done") {
    return tally.value.wins === boards.value.length ? "全員に勝ったね！ さすがプロ、会場が沸いてるよ！" : "おつかれさま！ みんな楽しそうだったよ。";
  }
  if (!board) return "";
  if (thinking.value) return `${board.guest.name}が考えているよ…`;
  return `${board.guest.name}（${board.guest.handicapLabel}）の盤。あなたの番だよ。`;
});

function tableState(board: Board, index: number) {
  if (board.result === "win") return "勝ち";
  if (board.result === "loss") return "負け";
  if (board.result === "draw") return "引き分け";
  if (phase.value === "play" && index === active.value) return thinking.value ? "考え中" : "いまの盤";
  return `${board.moves.length}手`;
}

function begin() {
  phase.value = "play";
  active.value = 0;
}

/** 盤の決着を見る(上手=あなたから見た結果を残す)。 */
function settle(board: Board) {
  const status = simulStatus(board.sfen, board.start);
  if (status.over) board.result = status.winner === "pro" ? "win" : "loss";
  return status.over;
}

let timer: ReturnType<typeof setTimeout> | null = null;
function onBoardMove(usi: string) {
  const board = current.value;
  if (!board || !canMove.value) return;
  const next = sfenAfter(board.sfen, usi);
  if (!next) return;
  board.sfen = next;
  board.moves.push(usi);
  board.lastMove = usi;
  if (settle(board)) {
    rotate();
    return;
  }
  // 相手が指し返す(少し間を置いて、考えている様子を見せる)。
  thinking.value = true;
  timer = setTimeout(() => {
    const reply = guestMove({ sfen: board.sfen, logic: board.guest.logic, moveHistory: board.moves, random });
    const after = reply ? sfenAfter(board.sfen, reply) : null;
    if (reply && after) {
      board.sfen = after;
      board.moves.push(reply);
      board.lastMove = reply;
    }
    settle(board);
    thinking.value = false;
    timer = setTimeout(rotate, 450);
  }, 320);
}

/** 次の決着していない盤へ(なければ終わり)。 */
function rotate() {
  const open = boards.value.map((board, index) => (board.result ? -1 : index)).filter((index) => index >= 0);
  if (!open.length) {
    phase.value = "done";
    return;
  }
  active.value = open.find((index) => index > active.value) ?? open[0];
}

/** 「ここまで」: 指しかけの盤は引き分け。 */
function stop() {
  if (timer) clearTimeout(timer);
  thinking.value = false;
  for (const board of boards.value) if (!board.result) board.result = "draw";
  phase.value = "done";
}
onBeforeUnmount(() => {
  if (timer) clearTimeout(timer);
});

// 狭い縦長の画面では縦長の盤にする(脳トレの将棋の種目と同じ基準と、盤の枠の合わせ方)。
const narrowMediaQuery = typeof window !== "undefined" && window.matchMedia
  ? window.matchMedia("(max-width: 56rem) and (orientation: portrait), (max-width: 30rem)")
  : null;
const isNarrow = ref(Boolean(narrowMediaQuery?.matches));
function onNarrowChange(event: MediaQueryListEvent) { isNarrow.value = event.matches; }
onMounted(() => narrowMediaQuery?.addEventListener("change", onNarrowChange));
onBeforeUnmount(() => narrowMediaQuery?.removeEventListener("change", onNarrowChange));
const stageEl = ref<HTMLElement | null>(null);
const panelEl = ref<HTMLElement | null>(null);
const boardBoxStyle = ref<Record<string, string>>({});
const boardAspect = ref(isNarrow.value ? 878 / 1168 : 1471 / 959);
watch(isNarrow, (narrow) => { boardAspect.value = narrow ? 878 / 1168 : 1471 / 959; });
function onBoardResize({ width, height }: { width: number; height: number }) {
  if (width > 0 && height > 0 && Math.abs(width / height - boardAspect.value) > 0.005) boardAspect.value = width / height;
}
function layoutBoardBox() {
  const stage = stageEl.value;
  if (!stage) return;
  const style = getComputedStyle(stage);
  const innerWidth = stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const innerHeight = stage.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
  const row = style.flexDirection === "row";
  const panelHeight = panelEl.value?.offsetHeight ?? 0;
  const panelWidth = panelEl.value?.offsetWidth ?? 0;
  const gap = parseFloat(row ? style.columnGap : style.rowGap) || 0;
  const minHeight = Math.min(240, window.innerHeight * 0.3);
  const availableHeight = row ? innerHeight : Math.max(minHeight, innerHeight - panelHeight - gap);
  const availableWidth = row ? Math.max(1, innerWidth - panelWidth - gap) : innerWidth;
  const width = Math.max(1, Math.floor(Math.min(availableWidth, availableHeight * boardAspect.value)));
  const height = Math.max(1, Math.floor(width / boardAspect.value));
  boardBoxStyle.value = { width: `${width}px`, height: `${height}px` };
}
const boardBoxObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => layoutBoardBox()) : null;
watch([stageEl, panelEl], ([stage, panel]) => {
  boardBoxObserver?.disconnect();
  if (stage) boardBoxObserver?.observe(stage);
  if (panel) boardBoxObserver?.observe(panel);
  layoutBoardBox();
});
watch(boardAspect, layoutBoardBox);
onBeforeUnmount(() => boardBoxObserver?.disconnect());
</script>

<style>
.shogi-game .festival-simul { display: grid; grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); gap: 0.4rem; height: 100%; min-width: 0; min-height: 0; }
.shogi-game .festival-simul__tables { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.3rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .festival-simul__table {
  display: grid; min-width: 0; padding: 0.25rem 0.4rem; border: 0.1rem solid rgba(255, 252, 244, 0.2); border-radius: 0.5rem;
  background: rgba(43, 70, 91, 0.7); font-size: 0.75rem;
}
.shogi-game .festival-simul__table b, .shogi-game .festival-simul__table small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.shogi-game .festival-simul__table small { color: #cfd8de; font-size: 0.66rem; }
.shogi-game .festival-simul__state { font-weight: 900; }
.shogi-game .festival-simul__table--active { border-color: var(--amber, #f1a54c); box-shadow: 0 0 0 0.1rem var(--amber, #f1a54c); }
.shogi-game .festival-simul__table--win .festival-simul__state { color: #86d4a9; }
.shogi-game .festival-simul__table--loss .festival-simul__state { color: #f5a3a3; }
.shogi-game .festival-simul__table--draw .festival-simul__state { color: #cfd8de; }
.shogi-game .festival-simul__stage { display: flex; flex-direction: row; align-items: center; justify-content: center; gap: 0.8rem; min-width: 0; min-height: 0; overflow: hidden; }
.shogi-game .festival-simul__board { flex: none; position: relative; }
.shogi-game .festival-simul__panel { display: grid; align-content: center; gap: 0.5rem; flex: 0 1 16rem; min-width: 0; }
.shogi-game .festival-simul__line { margin: 0; font-weight: 800; line-height: 1.5; }
.shogi-game .festival-simul__tally { margin: 0; color: #e9c46a; font-size: 1.4rem; font-weight: 900; text-align: center; }
@media (max-width: 56rem) and (orientation: portrait), (max-width: 30rem) {
  .shogi-game .festival-simul__stage { flex-direction: column; justify-content: flex-start; }
  .shogi-game .festival-simul__panel { flex: none; width: 100%; }
}
</style>
