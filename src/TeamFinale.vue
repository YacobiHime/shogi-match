<template>
  <!--
    団体戦の試合の結果発表(docs/team-battle-design.mdの19章)。団体戦の画面に重ねて出す。
    1. 自分が先に終わって、仲間の局がまだ対局中なら、「仲間の対局」で盤を見守る(チラ見と同じ盤。時計は1.2秒で1つ進む)。
    2. 3局がそろったら「結果発表」。席(局)の行を1つずつ明かし、最後にチームの結果と判子、羽音と百花の一言。
    押すと最後まで一度に出る。「団体戦へ」で閉じる(見た印を保存する)。
  -->
  <TeamPeekSheet
    v-if="phase === 'watch' && boards.length"
    class="team-peek--opaque team-peek--finale"
    :boards="boards"
    :games="games"
    :user-ply="clock"
    :player-name="playerName"
    :asset-base-url="assetBaseUrl"
    :seat="watchSeat"
    title="仲間の対局"
    back-label="結果まで進める"
    @select="onSelect"
    @close="skipWatch"
  >
    <template #extra>
      <ul class="team-finale__board-marks" aria-label="3つの席" data-team-finale-marks>
        <li v-for="row in view.rows" :key="row.index" :class="`team-finale__board-mark--${markState(row)}`">
          <small>{{ row.label }}</small>{{ row.us.short }}<b>{{ markText(row) }}</b>
        </li>
      </ul>
      <p class="team-finale__watch-news" role="status" aria-live="polite" data-team-finale-news>{{ watchNews }}</p>
      <button type="button" class="team-finale__fast" :aria-pressed="fast" data-team-finale-fast @click="fast = !fast">
        {{ fast ? `早送り中（${FINALE_FAST}倍）` : "早送り" }}
      </button>
    </template>
  </TeamPeekSheet>

  <div
    v-else
    class="team-finale"
    role="dialog"
    aria-modal="true"
    aria-labelledby="team-finale-title"
    data-team-finale
    @click="revealAll"
  >
    <div class="team-finale__panel" :class="{ 'team-finale__panel--pro': view.format === 'pro' }">
      <div class="team-finale__main">
      <p class="team-finale__kicker">結果発表</p>
      <h2 id="team-finale-title">{{ view.label }}</h2>
      <p class="team-finale__teams">{{ view.usName }}<span>対</span>{{ view.themName }}</p>
      <ol class="team-finale__rows" data-team-finale-rows>
        <li
          v-for="row in view.rows"
          :key="row.index"
          class="team-finale__row"
          :class="{ 'team-finale__row--shown': row.index < revealed, 'team-finale__row--win': row.won, 'team-finale__row--user': row.user }"
          :data-team-finale-row="row.index"
        >
          <span class="team-finale__seat">{{ row.label }}</span>
          <img v-if="faceOf(row.us.id)" class="team-finale__face" :class="{ 'team-finale__face--sprite': spriteFace(row.us.id) }" :src="faceOf(row.us.id)" alt="" draggable="false">
          <span v-else class="team-finale__face team-finale__face--char" aria-hidden="true">{{ row.us.name.slice(0, 1) }}</span>
          <span class="team-finale__name">{{ row.us.short }}</span>
          <b class="team-finale__mark" :aria-label="row.index < revealed ? (row.won ? '勝ち' : '負け') : '発表前'">{{ row.index < revealed ? (row.won ? "○" : "●") : "" }}</b>
          <span class="team-finale__them">{{ row.them.name }}</span>
          <small v-if="row.decisive && row.index < revealed && resultShown && view.teamWon" class="team-finale__decisive">決勝点</small>
        </li>
      </ol>
      </div>
      <div class="team-finale__side">
      <div v-if="resultShown" class="team-finale__result" :class="view.teamWon ? 'team-finale__result--win' : 'team-finale__result--loss'" role="status" data-team-finale-result>
        <p class="team-finale__score"><strong>{{ view.scoreText }}</strong><span>{{ view.verdict }}</span></p>
        <span v-if="view.teamWon" class="team-finale__stamp" aria-hidden="true">勝</span>
        <p v-if="view.decisiveText" class="team-finale__decisive-text">{{ view.decisiveText }}</p>
        <p v-if="view.after" class="team-finale__after" data-team-finale-after>{{ view.after }}</p>
      </div>
      <ul v-if="resultShown" class="team-finale__lines" aria-label="仲間の一言">
        <li v-for="line in view.lines" :key="line.who" class="team-finale__line" :data-team-finale-line="line.who">
          <img class="team-finale__face team-finale__face--line" :src="lineFace(line.who)" alt="" draggable="false">
          <span><small>{{ line.who === "hanane" ? "羽音" : "百花" }}</small>{{ line.text }}</span>
        </li>
      </ul>
      <button v-if="resultShown" ref="doneButton" type="button" class="team-finale__done" data-team-finale-done @click.stop="emit('done')">団体戦へ</button>
      <p v-else class="team-finale__skip-hint">押すと、すぐに結果を出します</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch, type PropType } from "vue";
import TeamPeekSheet from "./TeamPeekSheet.vue";
import { createMoveSoundPlayer } from "./core/move-sound";
import {
  FINALE_ANNOUNCE_DELAY_MS, FINALE_FAST, FINALE_ROW_MS, FINALE_SWITCH_MS, FINALE_TICK_MS, finaleBoardSettled,
} from "./core/team-finale.mjs";
import { portraitUrl } from "./core/team-story.mjs";
import { useTeamPeek } from "./composables/match/useTeamPeek";
import type { EngineFactory } from "./composables/match/analysisEngines";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type View = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Board = any;

const props = defineProps({
  /** 結果発表の画面の形(core/team-finale.mjsのteamFinaleView)。 */
  view: { type: Object as PropType<View>, required: true },
  /** 見守る仲間の盤(core/team-finale.mjsのfinaleBoards)。 */
  boards: { type: Array as PropType<Board[]>, default: () => [] },
  engineFactory: { type: Function as PropType<(() => Promise<EngineFactory>) | null>, default: null },
  playerName: { type: String, default: "" },
  assetBaseUrl: { type: String, default: "." },
});
const emit = defineEmits<{ done: [] }>();

const sounds = createMoveSoundPlayer(() => props.assetBaseUrl);
const storage = (): Storage | null => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

// ---- 1. 仲間の対局を見守る(19章の6)。エンジンが使えなければ見守らずに結果発表へ。
const phase = ref<"watch" | "announce">(props.view.watch && props.boards.length && props.engineFactory ? "watch" : "announce");
const peek = props.engineFactory && phase.value === "watch" ? useTeamPeek({ engineFactory: props.engineFactory, storage }) : null;
type PeekGame = { entries: { move: string; eval: number }[]; end: { winner: string; plies: number } | null; failed: boolean };
const games = (peek?.games ?? reactive({})) as Record<string, PeekGame>;
const fast = ref(false);
const elapsed = ref(0);
const clock = computed(() => (props.view.userPly ?? 0) + elapsed.value / FINALE_TICK_MS);
const watchSeat = ref<number | null>(props.boards[0]?.seat ?? null);
const watchNews = ref("");
const settledKeys = ref<string[]>([]);
let lastTick = 0;
let tickTimer: ReturnType<typeof setInterval> | undefined;
let switchTimer: ReturnType<typeof setTimeout> | undefined;
let announceTimer: ReturnType<typeof setTimeout> | undefined;

function settledOf(board: Board) {
  const game = games[board.spec.key];
  return finaleBoardSettled({ clock: clock.value, reveal: board.reveal, ended: Boolean(game?.end), failed: Boolean(game?.failed) });
}
const settled = computed(() => props.boards.filter(settledOf).map((board) => board.spec.key));
const pendingKey = (row: { seat: number }) => props.boards.find((board) => board.seat === row.seat)?.spec.key ?? "";

/** 見守る画面の3つの席の印(自分・勝ち負け・まだ対局中)。 */
function markState(row: { user: boolean; won: boolean; pending: boolean; seat: number }) {
  if (row.user) return row.won ? "win" : "loss";
  if (row.pending && !settledKeys.value.includes(pendingKey(row))) return "playing";
  return row.won ? "win" : "loss";
}
function markText(row: { user: boolean; won: boolean; pending: boolean; seat: number }) {
  const state = markState(row);
  return state === "playing" ? "対局中" : state === "win" ? "○" : "●";
}

function tick() {
  const now = Date.now();
  elapsed.value += (now - lastTick) * (fast.value ? FINALE_FAST : 1);
  lastTick = now;
}

// 盤が終わったら、速報の一言と「カタン」。見ている盤が終わったら、まだ続いている盤へ移る。全部終わったら結果発表へ。
watch(settled, (keys) => {
  const fresh = keys.filter((key) => !settledKeys.value.includes(key));
  if (!fresh.length) return;
  settledKeys.value = [...settledKeys.value, ...fresh];
  const board = props.boards.find((entry) => entry.spec.key === fresh[fresh.length - 1]);
  if (board) {
    watchNews.value = `${board.seatName}戦、${board.usName.replace(/^天鷺|^桜乃/, "")}${board.won ? "が勝った" : "は負け"}`;
    sounds.play("nameplate");
  }
  const rest = props.boards.filter((entry) => !settledKeys.value.includes(entry.spec.key));
  if (!rest.length) {
    clearInterval(tickTimer);
    announceTimer = setTimeout(startAnnounce, FINALE_ANNOUNCE_DELAY_MS);
    return;
  }
  if (board && board.seat === watchSeat.value) {
    clearTimeout(switchTimer);
    switchTimer = setTimeout(() => {
      watchSeat.value = rest[0].seat;
      peek?.start(props.boards.map((entry) => entry.spec), rest[0].spec.key);
    }, FINALE_SWITCH_MS);
  }
});

function onSelect(key: string) {
  const board = props.boards.find((entry) => entry.spec.key === key);
  if (board) watchSeat.value = board.seat;
  peek?.start(props.boards.map((entry) => entry.spec), key);
}
/** 「結果まで進める」・Esc・戻る操作(結果発表は飛ばさない)。 */
function skipWatch() {
  clearInterval(tickTimer);
  clearTimeout(switchTimer);
  clearTimeout(announceTimer);
  startAnnounce();
}

// ---- 2. 結果発表(19章の7)
const revealed = ref(0);
const resultShown = ref(false);
const doneButton = ref<HTMLButtonElement | null>(null);
let revealTimers: ReturnType<typeof setTimeout>[] = [];
const stepMs = computed(() => FINALE_ROW_MS[props.view.format === "pro" ? "pro" : "school"]);

let announceStarted = false;
function startAnnounce() {
  if (announceStarted) return;
  announceStarted = true;
  peek?.stop();
  phase.value = "announce";
  revealed.value = 0;
  resultShown.value = false;
  const count = props.view.rows.length;
  revealTimers = [];
  for (let index = 0; index < count; index += 1) {
    revealTimers.push(setTimeout(() => {
      revealed.value = index + 1;
      // プロは行が多いので、音は高校だけ(重ならないように)。
      if (props.view.format !== "pro") sounds.play("nameplate");
    }, stepMs.value * (index + 1)));
  }
  revealTimers.push(setTimeout(showResult, stepMs.value * (count + 1)));
}
function showResult() {
  revealed.value = props.view.rows.length;
  if (resultShown.value) return;
  resultShown.value = true;
  sounds.play(props.view.teamWon ? "stamp" : "nameplate");
  void nextTick(() => doneButton.value?.focus());
}
/** 押すと、残りの行とチームの結果を一度に出す(UD:7-2 演出は短く飛ばせる)。 */
function revealAll() {
  if (resultShown.value) return;
  for (const timer of revealTimers) clearTimeout(timer);
  revealTimers = [];
  showResult();
}

/** 戻る操作。見守る途中なら結果発表へ、発表の途中なら最後まで出す。閉じたら偽(画面に任せる)。 */
function goBack() {
  if (phase.value === "watch") {
    skipWatch();
    return true;
  }
  if (!resultShown.value) {
    revealAll();
    return true;
  }
  emit("done");
  return true;
}
defineExpose({ goBack });

function onKeydown(event: KeyboardEvent) {
  if (phase.value !== "announce" || event.defaultPrevented) return;
  if (event.key === "Escape" || ((event.key === "Enter" || event.key === " ") && !resultShown.value)) {
    event.preventDefault();
    goBack();
  }
}

onMounted(() => {
  window.addEventListener("keydown", onKeydown);
  if (phase.value === "watch") {
    lastTick = Date.now();
    tickTimer = setInterval(tick, 200);
    peek?.start(props.boards.map((board) => board.spec), props.boards[0]?.spec.key ?? "");
  } else {
    startAnnounce();
  }
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
  clearInterval(tickTimer);
  clearTimeout(switchTimer);
  clearTimeout(announceTimer);
  for (const timer of revealTimers) clearTimeout(timer);
  peek?.stop();
});

// ---- 顔
const faceOf = (id: string) => {
  if (id === "hanane") return `${props.assetBaseUrl}/characters/hanane-mini.webp?v=1`;
  if (id === "momoka") return portraitUrl(props.assetBaseUrl, "momoka", "neutral", { small: true });
  if (id === "user") return `${props.assetBaseUrl}/characters/yakobihime-mini.webp?v=4`;
  return "";
};
const spriteFace = (id: string) => id === "hanane" || id === "user";
const lineFace = (who: string) => portraitUrl(props.assetBaseUrl, who, props.view.teamWon ? (who === "hanane" ? "smile" : "neutral") : "worried", { small: true });
</script>

<style>
/* 後ろの団体戦の画面には、もう試合の結果(表・成績)が出ているので、透かさない(発表の前に結果を見せない。19章の7) */
.shogi-game .team-finale, .shogi-game .team-peek.team-peek--opaque { background: #0f1c26; }
.shogi-game .team-finale {
  position: fixed; inset: 0; z-index: 80; display: grid; place-items: center; padding: 0.5rem; cursor: pointer;
}
.shogi-game .team-finale__panel {
  display: grid; gap: 0.5rem; width: min(100%, 30rem); max-height: 100%; overflow-y: auto; padding: 0.9rem 1rem; box-sizing: border-box;
  border: 0.12rem solid rgba(255, 252, 244, 0.45); border-radius: 0.9rem; color: #fffcf4; background: #172632; cursor: default;
  box-shadow: 0 0.6rem 1.6rem rgba(0, 0, 0, 0.45); text-align: center;
}
.shogi-game .team-finale__main, .shogi-game .team-finale__side { display: grid; gap: 0.5rem; align-content: start; min-width: 0; }
.shogi-game .team-finale__kicker { margin: 0; color: var(--amber, #f1a54c); font-size: 0.85rem; font-weight: 900; letter-spacing: 0.3em; }
.shogi-game .team-finale__panel h2 { margin: 0; font-size: 1.2rem; }
.shogi-game .team-finale__teams { display: flex; justify-content: center; gap: 0.5rem; margin: 0; color: #cfd8de; font-size: 0.85rem; font-weight: 700; }
.shogi-game .team-finale__teams span { color: #8fa3b0; }
.shogi-game .team-finale__rows { display: grid; gap: 0.3rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .team-finale__row {
  display: grid; grid-template-columns: 2.6rem 2.2rem minmax(0, 1fr) 1.6rem minmax(0, 1fr); align-items: center; gap: 0.4rem;
  min-height: 2.6rem; padding: 0.2rem 0.5rem; border-radius: 0.6rem; background: rgba(43, 70, 91, 0.55); text-align: left;
  opacity: 0.35; transition: opacity 200ms ease, background 200ms ease;
}
.shogi-game .team-finale__row--shown { opacity: 1; }
.shogi-game .team-finale__row--shown.team-finale__row--win { background: rgba(31, 111, 178, 0.45); }
.shogi-game .team-finale__row--user { outline: 0.1rem solid rgba(241, 165, 76, 0.7); }
.shogi-game .team-finale__seat { color: #cfd8de; font-size: 0.78rem; font-weight: 900; }
.shogi-game .team-finale__face {
  width: 2.2rem; height: 2.2rem; border-radius: 50%; object-fit: cover; object-position: 50% 4%;
  border: 0.1rem solid rgba(255, 252, 244, 0.7); background: #e9eef1;
}
.shogi-game .team-finale__face--sprite { object-position: 50% 0; image-rendering: pixelated; background: #2b465b; }
.shogi-game .team-finale__face--char { display: inline-grid; place-items: center; color: #172632; font-weight: 900; }
.shogi-game .team-finale__name { overflow: hidden; font-weight: 900; text-overflow: ellipsis; white-space: nowrap; }
.shogi-game .team-finale__mark { font-size: 1.35rem; text-align: center; }
.shogi-game .team-finale__them { overflow: hidden; color: #cfd8de; font-size: 0.8rem; text-overflow: ellipsis; white-space: nowrap; }
.shogi-game .team-finale__decisive {
  grid-column: 3 / -1; justify-self: start; padding: 0 0.5rem; border-radius: 999px; color: #172632; background: var(--amber, #f1a54c);
  font-size: 0.72rem; font-weight: 900;
}
.shogi-game .team-finale__panel--pro .team-finale__rows { gap: 0.2rem; }
.shogi-game .team-finale__panel--pro .team-finale__row { min-height: 2rem; padding-block: 0.1rem; }
.shogi-game .team-finale__panel--pro .team-finale__face { width: 1.7rem; height: 1.7rem; }
.shogi-game .team-finale__result {
  position: relative; display: grid; gap: 0.2rem; padding: 0.6rem; border-radius: 0.8rem;
  animation: team-finale-pop 320ms ease-out;
}
.shogi-game .team-finale__result--win { background: rgba(31, 111, 178, 0.35); }
.shogi-game .team-finale__result--loss { background: rgba(43, 70, 91, 0.75); }
.shogi-game .team-finale__score { display: grid; gap: 0.1rem; margin: 0; }
.shogi-game .team-finale__score strong { font-size: 1.7rem; }
.shogi-game .team-finale__score span { font-size: 1rem; font-weight: 900; }
.shogi-game .team-finale__stamp {
  position: absolute; top: 0.3rem; right: 0.6rem; display: grid; place-items: center; width: 3rem; height: 3rem;
  border: 0.18rem solid #c0392b; border-radius: 50%; color: #c0392b; background: rgba(255, 252, 244, 0.92);
  font-size: 1.5rem; font-weight: 900; transform: rotate(-12deg); animation: team-finale-stamp 260ms ease-out;
}
.shogi-game .team-finale__decisive-text { margin: 0; color: var(--amber, #f1a54c); font-weight: 900; }
.shogi-game .team-finale__after { margin: 0; font-size: 0.9rem; font-weight: 700; }
.shogi-game .team-finale__lines { display: grid; gap: 0.35rem; margin: 0; padding: 0; list-style: none; text-align: left; }
.shogi-game .team-finale__line { display: flex; align-items: center; gap: 0.5rem; }
.shogi-game .team-finale__face--line { flex: none; width: 2.6rem; height: 2.6rem; }
.shogi-game .team-finale__line > span {
  display: grid; flex: 1; min-width: 0; padding: 0.35rem 0.6rem; border-radius: 0.8rem; color: #1d303f; background: #fffcf4;
  font-size: 0.88rem; font-weight: 700; line-height: 1.45;
}
.shogi-game .team-finale__line small { color: #5d6d7e; font-size: 0.68rem; }
.shogi-game .team-finale__done {
  min-height: 44px; border: 0; border-radius: 999px; color: #172632; background: var(--amber, #f1a54c);
  font: inherit; font-weight: 900; cursor: pointer;
}
.shogi-game .team-finale__skip-hint { margin: 0; color: #8fa3b0; font-size: 0.75rem; }
/* 見守る画面(チラ見のシートの中) */
.shogi-game .team-finale__board-marks { display: flex; gap: 0.3rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .team-finale__board-marks li {
  display: flex; flex: 1; align-items: baseline; justify-content: center; gap: 0.25rem; min-width: 0; padding: 0.15rem 0.3rem;
  border-radius: 999px; background: rgba(43, 70, 91, 0.75); font-size: 0.78rem; font-weight: 800; white-space: nowrap;
}
.shogi-game .team-finale__board-marks small { color: #cfd8de; font-size: 0.65rem; }
.shogi-game .team-finale__board-mark--win b { color: #7fc6ff; }
.shogi-game .team-finale__board-mark--loss b { color: #ff9c8f; }
.shogi-game .team-finale__board-mark--playing b { color: #cfd8de; font-size: 0.68rem; }
.shogi-game .team-finale__watch-news { min-height: 1.3em; margin: 0; color: var(--amber, #f1a54c); font-size: 0.85rem; font-weight: 900; text-align: center; }
.shogi-game .team-finale__fast {
  min-height: 40px; border: 0.1rem solid rgba(255, 252, 244, 0.45); border-radius: 999px; color: #fffcf4; background: transparent;
  font: inherit; font-weight: 800; cursor: pointer;
}
.shogi-game .team-finale__fast[aria-pressed="true"] { color: #172632; background: #cfd8de; }
/* 横向きの低い画面は、席の行を左、チームの結果と一言を右に並べる。見守る画面は「早送り」と「結果まで進める」を横に並べる */
@media (orientation: landscape) and (max-height: 560px) {
  .shogi-game .team-peek--finale .team-peek__info { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .shogi-game .team-peek--finale .team-peek__info > * { grid-column: 1 / -1; }
  .shogi-game .team-peek--finale .team-peek__info > .team-finale__fast,
  .shogi-game .team-peek--finale .team-peek__info > .team-peek__back { grid-column: auto; }
  .shogi-game .team-finale__panel { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); column-gap: 0.8rem; width: min(100%, 50rem); padding: 0.6rem 0.8rem; }
  .shogi-game .team-finale__panel h2 { font-size: 1rem; }
  .shogi-game .team-finale__row { min-height: 2.2rem; }
  .shogi-game .team-finale__score strong { font-size: 1.4rem; }
  .shogi-game .team-finale__side { align-content: center; }
}
@keyframes team-finale-pop { from { transform: scale(0.94); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes team-finale-stamp { from { transform: rotate(-12deg) scale(1.6); opacity: 0; } to { transform: rotate(-12deg) scale(1); opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .shogi-game .team-finale__row { transition: none; }
  .shogi-game .team-finale__result, .shogi-game .team-finale__stamp { animation: none; }
}
</style>
