<template>
  <!--
    仲間の盤(団体戦のチラ見。docs/team-battle-design.mdの14章)。自分の対局の上に重ね、席のタブで羽音・百花の盤をのぞく。
    盤は触れない。自分の手数に合わせて進み、速報の手数までは終局を見せない。形勢のバーと、仲間と相手の心の声。
    のぞいている間も、自分の対局は止めない(相手は考え続ける)。閉じるボタン・Esc・戻る操作で閉じる。
  -->
  <div class="team-peek" role="dialog" aria-modal="true" :aria-label="title" data-team-peek @click.self="emit('close')" @keydown.esc="emit('close')">
    <div class="team-peek__panel">
      <header class="team-peek__head">
        <h2>{{ title }}</h2>
        <button ref="closeButton" type="button" class="team-peek__close" aria-label="閉じる" data-team-peek-close @click="emit('close')">×</button>
      </header>
      <div class="team-peek__tabs" role="tablist" aria-label="席">
        <button
          v-for="(board, index) in boards"
          :key="board.spec.key"
          type="button"
          role="tab"
          :aria-selected="index === selected"
          :data-team-peek-seat="board.seat"
          @click="select(index)"
        >
          <small>{{ board.seatName }}</small>{{ shortName(board.usName) }}
          <b v-if="views[index].done" :class="views[index].won ? 'team-peek__mark--win' : 'team-peek__mark--loss'">{{ views[index].won ? "○" : "●" }}</b>
        </button>
      </div>

      <div v-if="view" ref="stageEl" class="team-peek__stage">
        <div class="team-peek__board" :style="boardBoxStyle">
          <ShogiMatchBoard
            :sfen="view.sfen"
            :last-move="view.lastMove"
            :allow-move="false"
            :enable-drag-and-drop="false"
            :flip="view.board.usColor === 'white'"
            :mobile="true"
            :layout="'portrait'"
            :asset-base-url="assetBaseUrl"
            :black-player-name="view.board.spec.black.name"
            :white-player-name="view.board.spec.white.name"
            @resize="onBoardResize"
          />
        </div>
      </div>

      <div v-if="view" class="team-peek__info">
        <p class="team-peek__ply" aria-live="polite" data-team-peek-ply>
          <b>{{ view.board.seatName }}戦</b>
          <span>{{ view.status }}</span>
        </p>
        <div class="team-peek__bar" :aria-label="`形勢 ${view.verdict}`" data-team-peek-bar>
          <span class="team-peek__bar-us" :style="{ width: `${Math.round(view.rate * 100)}%` }"></span>
          <span class="team-peek__bar-label team-peek__bar-label--us">{{ shortName(view.board.usName) }}</span>
          <span class="team-peek__bar-verdict">{{ view.verdict }}</span>
          <span class="team-peek__bar-label team-peek__bar-label--them">{{ shortName(view.board.themName) }}</span>
        </div>
        <ul class="team-peek__thoughts" aria-label="心の声">
          <li class="team-peek__thought team-peek__thought--us" data-team-peek-thought="us">
            <img v-if="usFace" class="team-peek__face" :class="{ 'team-peek__face--sprite': usFaceSprite }" :src="usFace" alt="" draggable="false">
            <span v-else class="team-peek__face team-peek__face--char" aria-hidden="true">{{ view.board.usName.slice(0, 1) }}</span>
            <span class="team-peek__bubble"><small>{{ shortName(view.board.usName) }}（心の声）</small>{{ view.usThought }}</span>
          </li>
          <li class="team-peek__thought team-peek__thought--them" data-team-peek-thought="them">
            <span class="team-peek__face team-peek__face--char" aria-hidden="true">{{ view.board.themName.slice(0, 1) }}</span>
            <span class="team-peek__bubble"><small>{{ view.board.themName }}（心の声）</small>{{ view.themThought }}</span>
          </li>
        </ul>
        <!-- 終局後に見守るときの早送りなど(docs/team-battle-design.mdの19章の6)。 -->
        <slot name="extra" />
        <button type="button" class="team-peek__back" data-team-peek-back @click="emit('close')">{{ backLabel }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type PropType } from "vue";
import ShogiMatchBoard from "./ShogiMatchBoard.vue";
import { STANDARD_SFEN, appendUsiMove, createGameRecord } from "./game-state";
import { blackWinRate, rateVerdict } from "./core/relay-game.mjs";
import { peekScene, peekShownPlies, peekThought, peekVoice } from "./core/team-peek.mjs";
import { portraitUrl } from "./core/team-story.mjs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Board = any;
type PeekGame = { entries: { move: string; eval: number }[]; end: { winner: string; plies: number } | null; failed: boolean };

const props = defineProps({
  /** のぞける仲間の盤(team-peek.mjsの`peekBoards`)。 */
  boards: { type: Array as PropType<Board[]>, required: true },
  /** 作った棋譜(useTeamPeekの`games`)。 */
  games: { type: Object as PropType<Record<string, PeekGame>>, required: true },
  /** 自分の対局の手数。 */
  userPly: { type: Number, default: 0 },
  playerName: { type: String, default: "" },
  /** 百花の呼び方(player-name.mjsのmomokaCallName。空なら名前に「さん」)。 */
  momokaCall: { type: String, default: "" },
  assetBaseUrl: { type: String, default: "." },
  title: { type: String, default: "仲間の盤" },
  backLabel: { type: String, default: "自分の盤へ戻る" },
  /** 開く席(速報の札から開いたとき・見守る盤を替えるとき)。nullなら先頭。 */
  seat: { type: Number as PropType<number | null>, default: null },
});
const emit = defineEmits<{ close: []; select: [key: string] }>();

const selected = ref(Math.max(0, props.boards.findIndex((board) => board.seat === props.seat)));
watch(() => props.seat, (seat) => {
  const index = props.boards.findIndex((board) => board.seat === seat);
  if (index >= 0) selected.value = index;
});
const closeButton = ref<HTMLButtonElement | null>(null);
const shortName = (name: string) => String(name ?? "").replace(/^天鷺|^桜乃/, "");

/** 1つの盤のいまの形(見せる手数・局面・形勢・心の声)。 */
function boardView(board: Board) {
  const game = props.games[board.spec.key] ?? { entries: [], end: null, failed: false };
  const entries = game.entries.filter(Boolean);
  const shown = peekShownPlies({ userPly: props.userPly, reveal: board.reveal, generated: entries.length, finalPlies: game.end?.plies ?? null });
  const done = Boolean(game.end) && props.userPly >= board.reveal && shown >= (game.end?.plies ?? Infinity);
  const usRateAt = (ply: number) => {
    if (ply <= 0) return 0.5;
    const black = blackWinRate(entries[ply - 1]?.eval ?? 40);
    return board.usColor === "black" ? black : 1 - black;
  };
  const rate = done ? (board.won ? 1 : 0) : usRateAt(shown);
  const before = shown >= 8 ? usRateAt(shown - 6) : null;
  const verdict = (() => {
    if (done) return `${shortName(board.won ? board.usName : board.themName)} 勝ち`;
    const { side, word } = rateVerdict(rate * 100);
    return side ? `${shortName(side === "black" ? board.usName : board.themName)} ${word}` : word;
  })();
  const us = board.spec[board.usColor];
  const them = board.spec[board.usColor === "black" ? "white" : "black"];
  const usScene = peekScene({ ply: shown, rate, before, done, won: board.won });
  const themScene = peekScene({ ply: shown, rate: 1 - rate, before: before === null ? null : 1 - before, done, won: !board.won });
  const status = done ? `${shown}手で終局` : game.failed ? "この盤は、いまは見られないよ" : !entries.length ? "対局の準備中…" : `${shown}手目`;
  return {
    board,
    done,
    won: Boolean(board.won),
    shown,
    rate,
    verdict,
    status,
    sfen: sfenAt(board.spec.key, entries, shown),
    lastMove: shown > 0 ? entries[shown - 1]?.move ?? "" : "",
    usThought: peekThought(peekVoice(us), usScene, { ply: shown, playerName: props.playerName, momokaCall: props.momokaCall }),
    themThought: peekThought(peekVoice(them), themScene, { ply: shown }),
  };
}

/** 局面(盤ごとに、前に作った局面から続きを指す)。 */
const sfenCache = new Map<string, { moves: string[]; record: ReturnType<typeof createGameRecord> }>();
function sfenAt(key: string, entries: { move: string }[], shown: number) {
  let cached = sfenCache.get(key);
  const moves = entries.slice(0, shown).map((entry) => entry.move);
  const reusable = cached && cached.moves.length <= moves.length && cached.moves.every((move, index) => move === moves[index]);
  if (!cached || !reusable) {
    cached = { moves: [], record: createGameRecord(STANDARD_SFEN) };
    sfenCache.set(key, cached);
  }
  for (let index = cached.moves.length; index < moves.length; index += 1) {
    if (!appendUsiMove(cached.record, moves[index])) break;
    cached.moves.push(moves[index]);
  }
  return cached.record.position.sfen;
}

const views = computed(() => props.boards.map(boardView));
const view = computed(() => views.value[selected.value] ?? null);
const usFaceSprite = computed(() => view.value?.board.usId === "hanane");
const usFace = computed(() => {
  const id = view.value?.board.usId;
  if (id === "hanane") return `${props.assetBaseUrl}/characters/hanane-mini.webp?v=1`;
  if (id === "momoka") return portraitUrl(props.assetBaseUrl, "momoka", "neutral", { small: true });
  return "";
});

function select(index: number) {
  selected.value = index;
  const key = props.boards[index]?.spec.key;
  if (key) emit("select", key);
}
onMounted(() => {
  void nextTick(() => closeButton.value?.focus());
});

// 盤の枠を、描かれる盤と同じ大きさにする(脳トレの将棋の種目と同じ方法)。
const stageEl = ref<HTMLElement | null>(null);
const boardBoxStyle = ref<Record<string, string>>({});
const boardAspect = ref(878 / 1168);
function onBoardResize({ width, height }: { width: number; height: number }) {
  if (width > 0 && height > 0 && Math.abs(width / height - boardAspect.value) > 0.005) boardAspect.value = width / height;
}
function layoutBoardBox() {
  const stage = stageEl.value;
  if (!stage) return;
  const width = Math.max(1, Math.floor(Math.min(stage.clientWidth, stage.clientHeight * boardAspect.value)));
  boardBoxStyle.value = { width: `${width}px`, height: `${Math.max(1, Math.floor(width / boardAspect.value))}px` };
}
const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => layoutBoardBox()) : null;
watch(stageEl, (stage) => {
  observer?.disconnect();
  if (stage) observer?.observe(stage);
  layoutBoardBox();
});
watch(boardAspect, layoutBoardBox);
onBeforeUnmount(() => observer?.disconnect());
</script>

<style>
.shogi-game .team-peek {
  position: fixed; inset: 0; z-index: 80; display: grid; grid-template-rows: minmax(0, 1fr); place-items: center; padding: 0.5rem;
  box-sizing: border-box; background: rgba(10, 18, 26, 0.55);
}
.shogi-game .team-peek__panel {
  display: grid; grid-template-columns: minmax(0, 1fr); grid-template-rows: auto auto minmax(0, 1fr) auto; gap: 0.4rem;
  width: min(100%, 30rem); height: min(100%, 52rem); padding: 0.6rem; box-sizing: border-box;
  border: 0.12rem solid rgba(255, 252, 244, 0.35); border-radius: 0.9rem; color: #fffcf4; background: #172632;
  box-shadow: 0 0.6rem 1.6rem rgba(0, 0, 0, 0.45);
}
.shogi-game .team-peek__head { display: flex; align-items: center; justify-content: space-between; }
.shogi-game .team-peek__head h2 { margin: 0; font-size: 1.05rem; }
.shogi-game .team-peek__close {
  width: 44px; height: 44px; border: 0.1rem solid rgba(255, 252, 244, 0.45); border-radius: 50%;
  color: #fffcf4; background: rgba(43, 70, 91, 0.95); font: inherit; font-size: 1.3rem; cursor: pointer;
}
.shogi-game .team-peek__tabs { display: flex; gap: 0.35rem; }
.shogi-game .team-peek__tabs button {
  display: flex; align-items: baseline; gap: 0.3rem; flex: 1; min-height: 44px; padding: 0.2rem 0.6rem;
  border: 0.1rem solid rgba(255, 252, 244, 0.35); border-radius: 999px; color: #fffcf4; background: transparent; font: inherit; font-weight: 800; cursor: pointer;
}
.shogi-game .team-peek__tabs button small { color: #cfd8de; font-size: 0.72rem; }
.shogi-game .team-peek__tabs button[aria-selected="true"] { color: #172632; background: var(--amber, #f1a54c); border-color: var(--amber, #f1a54c); }
.shogi-game .team-peek__tabs button[aria-selected="true"] small { color: #172632; }
.shogi-game .team-peek__mark--win { color: #1e8449; }
.shogi-game .team-peek__mark--loss { color: #922b21; }
.shogi-game .team-peek__stage { display: grid; place-items: center; min-height: 0; overflow: hidden; }
.shogi-game .team-peek__board { position: relative; }
.shogi-game .team-peek__board .shogi-match-theme-controls { display: none; }
.shogi-game .team-peek__info { display: grid; gap: 0.35rem; }
.shogi-game .team-peek__ply { display: flex; justify-content: space-between; margin: 0; font-size: 0.85rem; }
.shogi-game .team-peek__bar {
  position: relative; display: flex; align-items: center; justify-content: space-between; height: 1.6rem; overflow: hidden;
  border-radius: 999px; background: #922b21; font-size: 0.75rem; font-weight: 900;
}
.shogi-game .team-peek__bar-us { position: absolute; inset: 0 auto 0 0; background: #1f6fb2; transition: width 400ms ease; }
.shogi-game .team-peek__bar-label, .shogi-game .team-peek__bar-verdict { position: relative; padding: 0 0.6rem; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6); }
.shogi-game .team-peek__thoughts { display: grid; gap: 0.3rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .team-peek__thought { display: flex; align-items: center; gap: 0.45rem; }
.shogi-game .team-peek__thought--them { flex-direction: row-reverse; }
.shogi-game .team-peek__face {
  flex: none; width: 2.6rem; height: 2.6rem; border-radius: 50%; object-fit: cover; object-position: 50% 4%;
  border: 0.12rem solid rgba(255, 252, 244, 0.7); background: #e9eef1;
}
.shogi-game .team-peek__face--sprite { object-fit: cover; object-position: 50% 0; image-rendering: pixelated; background: #2b465b; }
.shogi-game .team-peek__face--char { display: inline-grid; place-items: center; color: #172632; font-weight: 900; }
.shogi-game .team-peek__bubble {
  display: grid; flex: 1; min-width: 0; padding: 0.35rem 0.6rem; border-radius: 0.8rem; color: #1d303f; background: #fffcf4;
  font-size: 0.85rem; font-weight: 700; line-height: 1.45;
}
.shogi-game .team-peek__thought--them .team-peek__bubble { background: #e8edf1; }
.shogi-game .team-peek__bubble small { color: #5d6d7e; font-size: 0.68rem; }
.shogi-game .team-peek__back {
  min-height: 44px; border: 0; border-radius: 999px; color: #172632; background: var(--amber, #f1a54c);
  font: inherit; font-weight: 900; cursor: pointer;
}
/* 横向きの低い画面(スマホの横向き)は、盤を左、タブと説明を右に並べる(盤が小さくなりすぎないように) */
@media (orientation: landscape) and (max-height: 560px) {
  .shogi-game .team-peek__panel {
    grid-template-areas: "head head" "stage tabs" "stage info";
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); grid-template-rows: auto auto minmax(0, 1fr);
    width: min(100%, 52rem); column-gap: 0.7rem;
  }
  .shogi-game .team-peek__head { grid-area: head; }
  .shogi-game .team-peek__head h2 { font-size: 0.95rem; }
  .shogi-game .team-peek__close { width: 40px; height: 40px; }
  .shogi-game .team-peek__tabs { grid-area: tabs; }
  .shogi-game .team-peek__stage { grid-area: stage; }
  .shogi-game .team-peek__info { grid-area: info; align-content: start; min-height: 0; overflow-y: auto; }
  .shogi-game .team-peek__face { width: 2rem; height: 2rem; }
  .shogi-game .team-peek__bubble { padding: 0.25rem 0.5rem; font-size: 0.8rem; line-height: 1.35; }
}
@media (prefers-reduced-motion: reduce) {
  .shogi-game .team-peek__bar-us { transition: none; }
}
</style>
