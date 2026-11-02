<template>
  <!--
    ぐるぐる指導対局(docs/pro-year-design.mdの10-2の6・11章)。あなたとほかの棋士2人が上手(後手)で、3つの盤を回りながら1手ずつ指し継ぐ。
    あなたが1手指すあいだに、ほかの棋士も別の盤で1手ずつ指し、みんなで次の盤へ回る。振り飛車党の棋士が振った盤は、居飛車党のあなたも
    振り飛車で指し継ぐ。相手と棋士はロジックAI(エンジンを使わない)。「ここまで」で区切ると、指しかけの盤は引き分け(D:9-2 やめても責めない)。
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
        <small>{{ board.guest.handicapLabel }}・{{ board.guest.grade }}<template v-if="board.ranged">・{{ board.ranged }}</template></small>
        <span class="festival-simul__state">{{ tableState(board, index) }}</span>
        <small class="festival-simul__pro" :data-simul-pro="index">{{ proAtLabel(index) }}</small>
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
import { guestMove, partnerMove, rangingMoveLabel, sfenAfter, sideToMove, simulBoardOf, simulProAt, simulStartSfen, simulStatus, simulTally } from "./core/festival-simul.mjs";

type Guest = { name: string; grade: string; logic: number; handicap: string; handicapLabel: string };
type Partner = { id: string; name: string; short: string; dan: string; logic: number; party: string; rangeSquare: string; rangeLabel: string };
type Board = {
  guest: Guest; start: string; sfen: string; moves: string[]; lastMove: string; result: "win" | "loss" | "draw" | null;
  /** 最後に上手の手を指した棋士(あなたは空)と、その手。 */
  lastBy: string; lastProMove: string;
  /** 飛車を振った戦法の名前と、振った棋士(振り飛車で指し継ぐ盤)。 */
  ranged: string; rangedBy: string;
};

const props = defineProps({
  guests: { type: Array as PropType<Guest[]>, required: true },
  /** 一緒に回る棋士2人(pro-festival.mjsのsimulPartners)。いなければ、あなた1人で回る。 */
  partners: { type: Array as PropType<Partner[]>, default: () => [] },
  playerName: { type: String, default: "あなた" },
  assetBaseUrl: { type: String, default: "." },
  seed: { type: Number, default: 1 },
});
const emit = defineEmits<{ done: [tally: { wins: number; losses: number; draws: number }]; cancel: [] }>();

const boards = ref<Board[]>(props.guests.map((guest) => {
  const start = simulStartSfen(guest.handicap);
  return { guest, start, sfen: start, moves: [], lastMove: "", result: null, lastBy: "", lastProMove: "", ranged: "", rangedBy: "" };
}));
/** 回る回数(round)。round回目に、あなたは盤 simulBoardOf(round, 0) の前にいる。 */
const round = ref(0);
const partnerCount = computed(() => Math.min(props.partners.length, boards.value.length - 1));
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
  if (phase.value === "intro") {
    if (!partnerCount.value) return "3人と同時に指すよ。1手指すと、相手が指し返して、次の盤へ回るよ。あなたが上手で、先に指そう！";
    const names = props.partners.slice(0, partnerCount.value).map((partner) => `${partner.name}${partner.dan}`).join("・");
    return `${names}とあなたで、盤を回りながら1手ずつ指し継ぐよ。前の人の作戦は変えられないから、来た盤の流れに乗って指そう！`;
  }
  if (phase.value === "done") {
    return tally.value.wins === boards.value.length ? "全員に勝ったね！ さすがプロ、会場が沸いてるよ！" : "おつかれさま！ みんな楽しそうだったよ。";
  }
  if (!board) return "";
  if (thinking.value) return `${board.guest.name}が考えているよ…`;
  const base = `${board.guest.name}（${board.guest.handicapLabel}）の盤。`;
  if (board.ranged && board.rangedBy) return `${base}${board.rangedBy}さんが${board.ranged}に振ってる……！ この盤は${board.ranged}で指し継ごう。`;
  if (board.lastBy) return `${base}${board.lastBy}さんから回ってきた盤。あなたの番だよ。`;
  return `${base}あなたの番だよ。`;
});

function tableState(board: Board, index: number) {
  if (board.result === "win") return "勝ち";
  if (board.result === "loss") return "負け";
  if (board.result === "draw") return "引き分け";
  if (phase.value === "play" && index === active.value) return thinking.value ? "考え中" : "いまの盤";
  return `${board.moves.length}手`;
}

/** その盤の前にいる棋士の札(「あなた」「藤井」)。 */
function proAtLabel(index: number) {
  if (phase.value !== "play" || !partnerCount.value) return "";
  const pro = simulProAt(round.value, index, boards.value.length);
  if (pro === 0) return "あなた";
  return props.partners[pro - 1] && pro <= partnerCount.value ? `${props.partners[pro - 1].short}さん` : "";
}

/** 平手の盤は先手のアマチュアから指す(はじめる前に1手)。 */
function guestOpening(board: Board) {
  if (board.result || sideToMove(board.sfen) !== "black") return;
  const reply = guestMove({ sfen: board.sfen, logic: board.guest.logic, moveHistory: board.moves, random });
  const after = reply ? sfenAfter(board.sfen, reply) : null;
  if (!reply || !after) return;
  board.sfen = after;
  board.moves.push(reply);
  board.lastMove = reply;
}

function begin() {
  phase.value = "play";
  round.value = 0;
  for (const board of boards.value) guestOpening(board);
  active.value = simulBoardOf(0, 0, boards.value.length);
}

/** ほかの棋士が、いま前にいる盤で1手指し、アマチュアが指し返す(あなたが指すのと同じ時に)。 */
function partnersPlay() {
  const count = boards.value.length;
  boards.value.forEach((board, index) => {
    if (board.result || sideToMove(board.sfen) !== "white") return;
    const pro = simulProAt(round.value, index, count);
    if (pro === 0 || pro > partnerCount.value) return;
    const partner = props.partners[pro - 1];
    const usi = partnerMove({ sfen: board.sfen, partner, moveHistory: board.moves, random });
    const next = usi ? sfenAfter(board.sfen, usi) : null;
    if (!usi || !next) return;
    const ranged = rangingMoveLabel(board.sfen, usi);
    if (ranged) {
      board.ranged = ranged;
      board.rangedBy = partner.short;
    }
    board.sfen = next;
    board.moves.push(usi);
    board.lastMove = usi;
    board.lastBy = partner.short;
    board.lastProMove = usi;
    if (settle(board)) return;
    guestOpening(board);
    settle(board);
  });
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
  const ranged = rangingMoveLabel(board.sfen, usi);
  if (ranged) {
    board.ranged = ranged;
    board.rangedBy = "";
  }
  board.sfen = next;
  board.moves.push(usi);
  board.lastMove = usi;
  board.lastBy = "";
  // ほかの棋士も、同じ時に別の盤で1手指す。
  partnersPlay();
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

/**
 * みんなで次の盤へ回る。あなたの前の盤が決着していたら、ほかの棋士だけ指して、もう1つ回る。
 * ほかの棋士がいないときは、今までどおり次の決着していない盤へ。
 */
function rotate() {
  const count = boards.value.length;
  const open = () => boards.value.some((board) => !board.result);
  if (!open()) {
    phase.value = "done";
    return;
  }
  if (!partnerCount.value) {
    const indexes = boards.value.map((board, index) => (board.result ? -1 : index)).filter((index) => index >= 0);
    active.value = indexes.find((index) => index > active.value) ?? indexes[0];
    return;
  }
  for (let guard = 0; guard < 400; guard += 1) {
    round.value += 1;
    const mine = simulBoardOf(round.value, 0, count);
    if (!boards.value[mine].result) {
      active.value = mine;
      return;
    }
    partnersPlay();
    if (!open()) {
      phase.value = "done";
      return;
    }
  }
  phase.value = "done";
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
.shogi-game .festival-simul__pro { color: var(--amber, #f1a54c); font-weight: 800; }
.shogi-game .festival-simul__table--active { border-color: var(--amber, #f1a54c); box-shadow: 0 0 0 0.1rem var(--amber, #f1a54c); }
.shogi-game .festival-simul__table--win .festival-simul__state { color: #86d4a9; }
.shogi-game .festival-simul__table--loss .festival-simul__state { color: #f5a3a3; }
.shogi-game .festival-simul__table--draw .festival-simul__state { color: #cfd8de; }
.shogi-game .festival-simul__stage { display: flex; flex-direction: row; align-items: center; justify-content: center; gap: 0.8rem; min-width: 0; min-height: 0; overflow: hidden; }
.shogi-game .festival-simul__board { flex: none; position: relative; }
.shogi-game .festival-simul__board .shogi-match-theme-controls { display: none; }
.shogi-game .festival-simul__panel { display: grid; align-content: center; gap: 0.5rem; flex: 0 1 16rem; min-width: 0; }
.shogi-game .festival-simul__line { margin: 0; font-weight: 800; line-height: 1.5; }
.shogi-game .festival-simul__tally { margin: 0; color: #e9c46a; font-size: 1.4rem; font-weight: 900; text-align: center; }
@media (max-width: 56rem) and (orientation: portrait), (max-width: 30rem) {
  .shogi-game .festival-simul__stage { flex-direction: column; justify-content: flex-start; }
  .shogi-game .festival-simul__panel { flex: none; width: 100%; }
}
</style>
