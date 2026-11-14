<template>
  <!--
    数独(docs/brain-training-design.mdの16章)。段の札 → 問題を作る → 盤 → 解けた。
    盤がいちばん大きく、道具(メモ・消す・戻す・ヒント)と数字のキーを下(横向きと広い画面では右)に置く。
    問題は毎回、種つきの乱数で作る(core/brain-sudoku.mjs)。途中でやめても、次に開くと「つづきから」。
  -->
  <section class="brain-sudoku" :class="[`brain-sudoku--n${size}`, `brain-sudoku--${phase}`]" aria-label="数独" data-brain-sudoku>
    <!-- 段の札(16-3)。いちばん上に決まりの1行、つづきがあれば先に。 -->
    <div v-if="phase === 'pick'" class="brain-sudoku__pick" data-sudoku-pick>
      <p class="brain-sudoku__lead">縦・横・太い枠に、同じ数字が1つずつ入るように埋めよう。</p>
      <button v-if="saved" type="button" class="brain-sudoku__level brain-sudoku__level--continue" data-sudoku-continue @click="continueSaved">
        <strong><span aria-hidden="true">▶</span> つづきから</strong>
        <span>{{ levelOf(saved.level).label }}（{{ levelOf(saved.level).sub }}）・{{ sudokuClock(saved.elapsedMs) }}・残り{{ emptyCount(saved) }}マス</span>
      </button>
      <ul class="brain-sudoku__levels">
        <li v-for="level in SUDOKU_LEVELS" :key="level.id">
          <button type="button" class="brain-sudoku__level" :data-sudoku-level="level.id" @click="startLevel(level.id)">
            <strong>{{ level.label }}<small>{{ level.sub }}</small></strong>
            <span>{{ bestLine(level.id) }}</span>
            <em v-if="level.id === recommended" class="brain-sudoku__badge">おすすめ</em>
          </button>
        </li>
      </ul>
      <p v-if="saved" class="brain-sudoku__note">新しい問題を選ぶと、つづきの問題は消えるよ。</p>
    </div>

    <!-- 問題を作っているあいだ(達人は数秒かかることがある)。 -->
    <div v-else-if="phase === 'making'" class="brain-sudoku__making" role="status" data-sudoku-making>
      <span class="brain-sudoku__spinner" aria-hidden="true"></span>
      <p>{{ levelOf(makingLevel).label }}の問題を作っています…</p>
    </div>

    <template v-else-if="game">
      <p class="brain-sudoku__status" data-sudoku-status>
        <span>{{ levelOf(game.level).label }}</span>
        <span aria-label="時間" data-sudoku-clock>⏱ {{ clockText }}</span>
        <span :aria-label="`ヒント${game.hints}回`">💡 {{ game.hints }}</span>
      </p>
      <p class="brain-sudoku__message" :class="{ 'brain-sudoku__message--hint': Boolean(hint), 'brain-sudoku__message--miss': messageKind === 'miss' }" aria-live="polite" data-sudoku-message>
        <template v-if="hint"><b v-if="hint.kind === 'step' && hint.techName">{{ hint.techName }}</b>{{ hint.text }}</template>
        <template v-else>{{ messageText }}</template>
      </p>
      <div
        class="brain-sudoku__board"
        :class="{ 'brain-sudoku__board--solved': phase === 'solved' }"
        :style="{ '--n': size }"
        role="grid"
        :aria-label="`数独の盤 ${size}×${size}`"
        data-sudoku-board
      >
        <button
          v-for="cell in cellIndexes"
          :key="cell"
          type="button"
          class="brain-sudoku__cell"
          :class="cellClass(cell, game.values[cell])"
          :style="phase === 'solved' ? { animationDelay: `${(rowOf(cell) + colOf(cell)) * 35}ms` } : undefined"
          role="gridcell"
          :aria-label="cellLabel(cell, game.values[cell])"
          :aria-selected="selected === cell"
          :data-sudoku-cell="cell"
          @click="selectCell(cell)"
        >
          <span v-if="game.values[cell]" class="brain-sudoku__value">{{ game.values[cell] }}</span>
          <span v-else-if="game.notes[cell]" class="brain-sudoku__notes" aria-hidden="true">
            <i v-for="digit in size" :key="digit">{{ noteHas(cell, digit) ? digit : "" }}</i>
          </span>
        </button>
        <button v-if="phase === 'solved'" type="button" class="brain-sudoku__done" data-sudoku-done @click="finishNow">
          <strong>できた！</strong>
          <span>{{ praise }}</span>
        </button>
      </div>
      <div class="brain-sudoku__tools" role="group" aria-label="道具">
        <template v-if="hint">
          <button type="button" class="brain-sudoku__tool brain-sudoku__tool--main" data-sudoku-hint-apply @click="applyHint">{{ hint.kind === 'mistake' ? "消す" : "入れる" }}</button>
          <button type="button" class="brain-sudoku__tool" data-sudoku-hint-close @click="hint = null">とじる</button>
        </template>
        <template v-else>
          <button type="button" class="brain-sudoku__tool" :class="{ 'brain-sudoku__tool--on': memo }" :aria-pressed="memo" :disabled="phase !== 'play'" data-sudoku-memo @click="memo = !memo">✏️ メモ{{ memo ? "中" : "" }}</button>
          <button type="button" class="brain-sudoku__tool" :disabled="phase !== 'play'" data-sudoku-erase @click="erase">消す</button>
          <button type="button" class="brain-sudoku__tool" :disabled="phase !== 'play' || !undoStack.length" data-sudoku-undo @click="undo">↶ 戻す</button>
          <button type="button" class="brain-sudoku__tool" :disabled="phase !== 'play'" data-sudoku-hint @click="showHint">💡 ヒント</button>
        </template>
      </div>
      <div class="brain-sudoku__pad" :class="{ 'brain-sudoku__pad--memo': memo }" role="group" aria-label="数字のキー" data-sudoku-pad>
        <button
          v-for="digit in size"
          :key="digit"
          type="button"
          class="brain-sudoku__key"
          :disabled="phase !== 'play' || remaining[digit] === 0"
          :aria-label="memo ? `メモ ${digit}` : `${digit}（残り${remaining[digit]}）`"
          :data-sudoku-key="digit"
          @click="pressDigit(digit)"
        >
          <span>{{ digit }}</span>
          <small v-if="!memo">{{ remaining[digit] }}</small>
        </button>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import {
  SUDOKU_LEVELS,
  applySudokuHint,
  clearSudokuSave,
  countSudokuHint,
  createSudokuGame,
  eraseSudokuCell,
  inputSudokuDigit,
  isWrong,
  loadSudokuSave,
  makeSudokuAsync,
  newSudokuSeed,
  recommendSudokuLevel,
  remainingDigits,
  saveSudokuSave,
  sudokuClock,
  sudokuGeometry,
  sudokuHint,
  sudokuLevel,
  sudokuPraise,
  sudokuRecordId,
  sudokuResult,
  sudokuTimeText,
  undoSudoku,
} from "../core/brain-sudoku.mjs";
import { brainAudio } from "../brain-audio";

type Game = ReturnType<typeof createSudokuGame>;
type Hint = NonNullable<ReturnType<typeof sudokuHint>>;
type Undo = { values: number[]; notes: number[] };

const props = defineProps({
  /** 道場の自己ベスト(記録の鍵→秒)。 */
  bests: { type: Object as () => Record<string, number>, default: () => ({}) },
});
const emit = defineEmits<{
  (event: "finish", result: { value: number; level: number; correct: number; total: number; recordId: string; text: string; sub: string }): void;
  (event: "sound", kind: "correct" | "miss" | "finish" | "place"): void;
}>();

/** 解けた盤の光を見せてから成績表へ(1.2秒。押せばすぐ。UD:7-2)。 */
const SOLVED_SHOW_MS = 1200;
/** 時計の表示を進める間(ミリ秒)。 */
const CLOCK_TICK_MS = 500;
/** 途中の盤を残す間(数字を入れたときのほか、この間ごと)。 */
const SAVE_EVERY_MS = 10000;
/** 戻すの上限。 */
const UNDO_LIMIT = 200;

const storage = typeof localStorage === "undefined" ? null : localStorage;
const phase = ref<"pick" | "making" | "play" | "solved">("pick");
const saved = ref<Game | null>(loadSudokuSave(storage));
const game = ref<Game | null>(null);
const makingLevel = ref(1);
const selected = ref(-1);
const memo = ref(false);
const hint = ref<Hint | null>(null);
const undoStack = ref<Undo[]>([]);
const flash = ref<Set<number>>(new Set());
const messageText = ref("");
const messageKind = ref<"" | "miss">("");
const praise = ref("");
const now = ref(performance.now());
let runningSince = 0;
let cancelled = false;
let clockTimer: ReturnType<typeof setInterval> | null = null;
let saveTimer: ReturnType<typeof setInterval> | null = null;
let flashTimer: ReturnType<typeof setTimeout> | null = null;
let finishTimer: ReturnType<typeof setTimeout> | null = null;
let lastSaved = 0;

const size = computed(() => game.value?.size ?? 9);
const cellIndexes = computed(() => Array.from({ length: size.value * size.value }, (_, index) => index));
const geometry = computed(() => (game.value ? sudokuGeometry(game.value) : null));
const recommended = computed(() => recommendSudokuLevel(props.bests));
const remaining = computed(() => (game.value ? remainingDigits(game.value) : []));
const clockText = computed(() => sudokuClock(elapsedNow()));
const ruleText = computed(() => `縦・横・太い枠に、1〜${size.value}が1つずつ。`);

function levelOf(id: number) {
  return sudokuLevel(id) ?? SUDOKU_LEVELS[0];
}
function bestLine(id: number) {
  const best = props.bests[sudokuRecordId(id)];
  return best ? `自己ベスト ${sudokuTimeText(best)}` : "まだ記録なし";
}
function emptyCount(target: Game) {
  return target.values.filter((value, cell) => value !== target.solution[cell]).length;
}
function rowOf(cell: number) {
  return geometry.value?.rowOf[cell] ?? 0;
}
function colOf(cell: number) {
  return geometry.value?.colOf[cell] ?? 0;
}
function noteHas(cell: number, digit: number) {
  return Boolean(game.value && game.value.notes[cell] & (1 << (digit - 1)));
}

// ===== 時間(盤を開いているあいだだけ進む。16-6) =====
function elapsedNow() {
  if (!game.value) return 0;
  void now.value;
  return game.value.elapsedMs + (runningSince ? performance.now() - runningSince : 0);
}
function resumeClock() {
  if (!runningSince && phase.value === "play" && document.visibilityState !== "hidden") runningSince = performance.now();
}
function pauseClock() {
  if (!game.value || !runningSince) return;
  game.value = { ...game.value, elapsedMs: Math.round(game.value.elapsedMs + performance.now() - runningSince) };
  runningSince = 0;
}
function persist(force = false) {
  if (!game.value || phase.value !== "play") return;
  const stamp = performance.now();
  if (!force && stamp - lastSaved < 400) return;
  lastSaved = stamp;
  const elapsedMs = Math.round(elapsedNow());
  saveSudokuSave(storage, { ...game.value, elapsedMs });
}
function onVisibility() {
  if (document.visibilityState === "hidden") {
    pauseClock();
    persist(true);
  } else {
    resumeClock();
  }
}

// ===== 始める =====
function begin(next: Game) {
  game.value = next;
  saved.value = null;
  undoStack.value = [];
  hint.value = null;
  memo.value = false;
  flash.value = new Set();
  messageText.value = ruleText.value;
  messageKind.value = "";
  phase.value = "play";
  // すぐ遊べるよう、真ん中に近い空きのマスを選んでおく(D:3-3)。
  const center = (next.size * next.size - 1) / 2;
  const empties = next.values.map((value, cell) => (value ? -1 : cell)).filter((cell) => cell >= 0);
  selected.value = empties.sort((a, b) => Math.abs(a - center) - Math.abs(b - center))[0] ?? -1;
  runningSince = 0;
  resumeClock();
  persist(true);
}
async function startLevel(levelId: number) {
  brainAudio().play("tick");
  makingLevel.value = levelId;
  phase.value = "making";
  const made = await makeSudokuAsync(levelId, newSudokuSeed(), { cancelled: () => cancelled });
  if (!made || cancelled) return;
  begin(createSudokuGame(made));
}
function continueSaved() {
  if (!saved.value) return;
  brainAudio().play("tick");
  begin(saved.value);
}

// ===== 盤の操作(16-6) =====
function selectCell(cell: number) {
  if (phase.value !== "play") return;
  selected.value = cell;
}
function pushUndo(undo: Undo | null) {
  if (!undo) return;
  undoStack.value = [...undoStack.value.slice(-(UNDO_LIMIT - 1)), undo];
}
function showFlash(units: number[][]) {
  if (!units.length) return;
  flash.value = new Set(units.flat());
  if (flashTimer) clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {
    flash.value = new Set();
  }, 700);
}
type InputResult = { game: Game; event: string; completed: number[][]; solved: boolean; undo: Undo | null };
function afterInput(result: InputResult) {
  if (result.event === "none") return;
  if (result.event === "given") {
    messageText.value = "初めの数字は、変えられないよ。";
    messageKind.value = "";
    return;
  }
  game.value = result.game;
  pushUndo(result.undo);
  hint.value = null;
  messageKind.value = "";
  messageText.value = ruleText.value;
  if (result.event === "mistake") {
    // まちがいは「不可」。責めずに、ちがうことだけ伝える(UD:5-3)。
    messageText.value = "そのマスの数字は、ちがうみたい。同じ数字をもう一度押すと消せるよ。";
    messageKind.value = "miss";
    emit("sound", "miss");
  } else if (result.event === "placed") {
    if (result.completed.length) emit("sound", "correct");
    else emit("sound", "place");
    showFlash(result.completed);
  }
  if (result.solved) solved();
  else persist(true);
}
function pressDigit(digit: number) {
  if (!game.value || phase.value !== "play") return;
  brainAudio().play("tick");
  if (selected.value < 0) {
    messageText.value = "先に、数字を入れるマスを押してね。";
    return;
  }
  afterInput(inputSudokuDigit(game.value, selected.value, digit, { note: memo.value }));
}
function erase() {
  if (!game.value || phase.value !== "play" || selected.value < 0) return;
  brainAudio().play("tick");
  const result = eraseSudokuCell(game.value, selected.value);
  if (!result.changed) return;
  game.value = result.game;
  pushUndo(result.undo);
  hint.value = null;
  messageKind.value = "";
  messageText.value = ruleText.value;
  persist(true);
}
function undo() {
  if (!game.value || !undoStack.value.length) return;
  brainAudio().play("tick");
  const last = undoStack.value[undoStack.value.length - 1];
  undoStack.value = undoStack.value.slice(0, -1);
  game.value = undoSudoku(game.value, last);
  hint.value = null;
  messageKind.value = "";
  messageText.value = ruleText.value;
  persist(true);
}

// ===== ヒント(16-5) =====
function showHint() {
  if (!game.value || phase.value !== "play") return;
  brainAudio().play("tick");
  const next = sudokuHint(game.value);
  if (!next) return;
  game.value = countSudokuHint(game.value);
  hint.value = next;
  selected.value = next.cell;
  persist(true);
}
function applyHint() {
  if (!game.value || !hint.value) return;
  const current = hint.value;
  hint.value = null;
  if (current.kind === "mistake") {
    selected.value = current.cell;
    erase();
    return;
  }
  afterInput(applySudokuHint(game.value, current));
}

// ===== 解けた =====
function solved() {
  pauseClock();
  phase.value = "solved";
  hint.value = null;
  if (!game.value) return;
  clearSudokuSave(storage);
  praise.value = sudokuPraise(game.value, props.bests[sudokuRecordId(game.value.level)] ?? 0);
  emit("sound", "finish");
  finishTimer = setTimeout(finishNow, SOLVED_SHOW_MS);
}
function finishNow() {
  if (finishTimer) clearTimeout(finishTimer);
  finishTimer = null;
  if (!game.value || phase.value !== "solved") return;
  const result = sudokuResult(game.value);
  game.value = null;
  emit("finish", result);
}

// ===== 見た目 =====
function cellClass(cell: number, value: number) {
  const current = game.value;
  const geo = geometry.value;
  if (!current || !geo) return [];
  const sel = selected.value;
  const selectedValue = sel >= 0 ? current.values[sel] : 0;
  const peer = sel >= 0 && cell !== sel && (geo.rowOf[cell] === geo.rowOf[sel] || geo.colOf[cell] === geo.colOf[sel] || geo.boxOf[cell] === geo.boxOf[sel]);
  const currentHint = hint.value;
  return {
    "brain-sudoku__cell--given": Boolean(current.puzzle[cell]),
    "brain-sudoku__cell--user": Boolean(value) && !current.puzzle[cell],
    "brain-sudoku__cell--wrong": isWrong(current, cell),
    "brain-sudoku__cell--selected": cell === sel,
    "brain-sudoku__cell--peer": peer,
    "brain-sudoku__cell--same": Boolean(value) && value === selectedValue && cell !== sel && !isWrong(current, cell),
    "brain-sudoku__cell--edge-r": (geo.colOf[cell] + 1) % current.boxW === 0 && geo.colOf[cell] < current.size - 1,
    "brain-sudoku__cell--edge-b": (geo.rowOf[cell] + 1) % current.boxH === 0 && geo.rowOf[cell] < current.size - 1,
    "brain-sudoku__cell--hint": currentHint?.cell === cell,
    "brain-sudoku__cell--hint-unit": currentHint?.kind === "step" && currentHint.unitCells.includes(cell) && currentHint.cell !== cell,
    "brain-sudoku__cell--hint-pattern": currentHint?.kind === "step" && currentHint.patternCells.includes(cell),
    "brain-sudoku__cell--hint-elim": currentHint?.kind === "step" && currentHint.eliminationCells.includes(cell),
    "brain-sudoku__cell--flash": flash.value.has(cell),
  };
}
function cellLabel(cell: number, value: number) {
  const current = game.value;
  if (!current) return "";
  const head = `${rowOf(cell) + 1}行${colOf(cell) + 1}列`;
  if (value) return `${head} ${value}${current.puzzle[cell] ? "（初めの数字）" : isWrong(current, cell) ? "（ちがう）" : ""}`;
  const notes = Array.from({ length: current.size }, (_, index) => index + 1).filter((digit) => noteHas(cell, digit));
  return `${head} 空き${notes.length ? `・メモ ${notes.join("、")}` : ""}`;
}

// ===== キーボード(16-6) =====
function onKey(event: KeyboardEvent) {
  if (!game.value || phase.value !== "play" || event.ctrlKey || event.metaKey || event.altKey) return;
  const target = event.target as HTMLElement | null;
  if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
  const n = game.value.size;
  const key = event.key;
  if (/^[1-9]$/.test(key) && Number(key) <= n) pressDigit(Number(key));
  else if (key === "Backspace" || key === "Delete" || key === "0") erase();
  else if (key === "m" || key === "M") memo.value = !memo.value;
  else if (key === "z" || key === "Z") undo();
  else if (key === "h" || key === "H") showHint();
  else if (key.startsWith("Arrow")) {
    const cell = selected.value < 0 ? 0 : selected.value;
    let row = Math.floor(cell / n);
    let col = cell % n;
    if (key === "ArrowUp") row = (row + n - 1) % n;
    else if (key === "ArrowDown") row = (row + 1) % n;
    else if (key === "ArrowLeft") col = (col + n - 1) % n;
    else if (key === "ArrowRight") col = (col + 1) % n;
    selected.value = row * n + col;
  } else return;
  event.preventDefault();
}

onMounted(() => {
  window.addEventListener("keydown", onKey);
  document.addEventListener("visibilitychange", onVisibility);
  clockTimer = setInterval(() => {
    now.value = performance.now();
  }, CLOCK_TICK_MS);
  saveTimer = setInterval(() => persist(true), SAVE_EVERY_MS);
});
onBeforeUnmount(() => {
  cancelled = true;
  window.removeEventListener("keydown", onKey);
  document.removeEventListener("visibilitychange", onVisibility);
  if (clockTimer) clearInterval(clockTimer);
  if (saveTimer) clearInterval(saveTimer);
  if (flashTimer) clearTimeout(flashTimer);
  if (finishTimer) clearTimeout(finishTimer);
  // 途中でやめても、次に開くと「つづきから」(16-2)。
  if (phase.value === "play") {
    pauseClock();
    persist(true);
  }
});
</script>

<style>
/* 数独(16-3)。色は道場の変数だけを使う(U:7-1)。盤がいちばん大きい。 */
.shogi-game .brain-sudoku {
  --sudoku-board: min(calc(100 * var(--dojo-vw) - 2rem), calc(100 * var(--dojo-dvh) - 22.5rem), 40rem);
  display: grid;
  grid-template-columns: minmax(0, var(--sudoku-board));
  grid-template-areas: "status" "message" "board" "tools" "pad";
  justify-content: center;
  /* 道場の種目の枠(brain-game)は使わない(中身を真ん中に寄せて縮めるため)。行いっぱいに広げる。 */
  justify-items: stretch;
  margin: 0 auto;
  gap: 0.45rem;
  width: 100%;
}
.shogi-game .brain-sudoku--pick,
.shogi-game .brain-sudoku--making { display: block; width: min(100%, 34rem); margin: 0 auto; }
/* 横向きの背の低い画面では、段の札を3列にして1画面に収める(U:7-5)。 */
@media (orientation: landscape) and (max-height: 600px) {
  .shogi-game .brain-sudoku--pick { width: min(100%, 48rem); }
  .shogi-game .brain-sudoku__levels { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .shogi-game .brain-sudoku__level { min-height: 52px; padding: 0.4rem 0.7rem; }
  .shogi-game .brain-sudoku__pick { gap: 0.45rem; }
}

/* 段の札 */
.shogi-game .brain-sudoku__pick { display: grid; gap: 0.6rem; }
.shogi-game .brain-sudoku__lead { margin: 0; color: var(--dojo-light); font-size: 0.98rem; font-weight: 800; line-height: 1.55; text-align: center; }
.shogi-game .brain-sudoku__levels { display: grid; grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr)); gap: 0.5rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .brain-sudoku__level {
  position: relative;
  display: grid;
  gap: 0.15rem;
  width: 100%;
  min-height: 60px;
  padding: 0.55rem 0.85rem;
  border: 2px solid var(--dojo-rule);
  border-radius: 12px;
  color: var(--dojo-ink);
  background: var(--dojo-paper);
  box-shadow: 0 3px 0 var(--dojo-rule);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.shogi-game .brain-sudoku__level strong { display: flex; align-items: baseline; gap: 0.45rem; font-size: 1.05rem; }
.shogi-game .brain-sudoku__level strong small { color: var(--dojo-ink-2); font-size: 0.78rem; }
.shogi-game .brain-sudoku__level > span { color: var(--dojo-gold); font-size: 0.8rem; font-weight: 800; font-variant-numeric: tabular-nums; }
.shogi-game .brain-sudoku__level--continue { border-color: var(--dojo-now); background: #fff3dc; box-shadow: 0 3px 0 var(--dojo-now); }
.shogi-game .brain-sudoku__level--continue > span { color: var(--dojo-ink-2); }
.shogi-game .brain-sudoku__badge {
  position: absolute;
  top: 0.45rem;
  right: 0.6rem;
  padding: 0.05rem 0.55rem;
  border-radius: 999px;
  color: #fff;
  background: var(--dojo-shu);
  font-size: 0.72rem;
  font-style: normal;
  font-weight: 900;
}
.shogi-game .brain-sudoku__note { margin: 0; color: var(--dojo-light-2); font-size: 0.8rem; text-align: center; }
@media (hover: hover) {
  .shogi-game .brain-sudoku__level:hover { border-color: var(--dojo-now); background-color: #fff3dc; }
}
.shogi-game .brain-sudoku__level:focus-visible,
.shogi-game .brain-sudoku__cell:focus-visible,
.shogi-game .brain-sudoku__tool:focus-visible,
.shogi-game .brain-sudoku__key:focus-visible { outline: 3px solid #3c6dd1; outline-offset: 2px; }

/* 作っているあいだ */
.shogi-game .brain-sudoku__making { display: grid; justify-items: center; gap: 0.8rem; padding: 3rem 1rem; color: var(--dojo-light); font-weight: 800; }
.shogi-game .brain-sudoku__making p { margin: 0; }
.shogi-game .brain-sudoku__spinner {
  width: 2.6rem;
  height: 2.6rem;
  border: 5px solid rgba(255, 252, 244, 0.2);
  border-top-color: var(--dojo-now);
  border-radius: 50%;
  animation: brain-sudoku-spin 0.9s linear infinite;
}
@keyframes brain-sudoku-spin { to { transform: rotate(360deg); } }

/* 時間の行と、決まり・ヒントの文 */
.shogi-game .brain-sudoku__status {
  grid-area: status;
  display: flex;
  justify-content: space-between;
  gap: 0.6rem;
  margin: 0;
  color: var(--dojo-light-2);
  font-size: 0.85rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.shogi-game .brain-sudoku__message {
  grid-area: message;
  display: block;
  height: calc(0.82rem * 1.45 * 3 + 0.5rem);
  margin: 0;
  padding: 0.25rem 0.6rem;
  overflow-y: auto;
  border-radius: 10px;
  color: var(--dojo-light);
  background: var(--dojo-desk-2);
  font-size: 0.82rem;
  font-weight: 700;
  line-height: 1.45;
}
.shogi-game .brain-sudoku__message b { margin-right: 0.4rem; padding: 0 0.45rem; border-radius: 999px; color: var(--dojo-ink); background: var(--dojo-good-soft); font-size: 0.75rem; }
.shogi-game .brain-sudoku__message--hint { color: var(--dojo-ink); background: var(--dojo-paper); }
.shogi-game .brain-sudoku__message--miss { color: var(--dojo-ink); background: var(--dojo-shu-soft); }

/* 盤 */
.shogi-game .brain-sudoku__board {
  grid-area: board;
  position: relative;
  display: grid;
  grid-template-columns: repeat(var(--n), minmax(0, 1fr));
  grid-template-rows: repeat(var(--n), minmax(0, 1fr));
  width: var(--sudoku-board);
  aspect-ratio: 1;
  border: 3px solid var(--dojo-ink);
  border-radius: 6px;
  overflow: hidden;
  background: var(--dojo-paper);
  box-shadow: var(--dojo-shadow);
  justify-self: center;
}
/* マスはボタンなので、アプリ全体のボタンの書式(触れると灰色・押すと沈む・縁が琥珀色)に負けないよう、:not(:disabled)まで書いて強くする。
   線と面と縁は変数で持ち、状態の札(選んだ・同じ数字・ヒント)は変数だけを変える(盤の上の札でいくつ重なっても線が消えない)。 */
.shogi-game .brain-sudoku__board {
  --cell-bg: #fff;
  --line-r: 1px;
  --line-rc: var(--dojo-rule);
  --line-b: 1px;
  --line-bc: var(--dojo-rule);
  --ring: 0 0 0 0 transparent;
}
.shogi-game .brain-sudoku__board > .brain-sudoku__cell:not(:disabled) {
  position: relative;
  display: grid;
  place-items: center;
  min-width: 0;
  min-height: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  color: var(--dojo-ink);
  background: var(--cell-bg);
  box-shadow: inset calc(-1 * var(--line-r)) 0 0 var(--line-rc), inset 0 calc(-1 * var(--line-b)) 0 var(--line-bc), var(--ring);
  transform: none;
  font: inherit;
  font-size: calc(var(--sudoku-board) / var(--n) * 0.58);
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  touch-action: manipulation;
  transition: none;
}
.shogi-game .brain-sudoku__cell--edge-r { --line-r: 3px; --line-rc: var(--dojo-ink); }
.shogi-game .brain-sudoku__cell--edge-b { --line-b: 3px; --line-bc: var(--dojo-ink); }
/* 初めの数字は墨の太字、入れた数字は藍(色と太さの両方で分ける。U:7-3)。 */
.shogi-game .brain-sudoku__board > .brain-sudoku__cell--given:not(:disabled) { font-weight: 900; }
.shogi-game .brain-sudoku__board > .brain-sudoku__cell--user:not(:disabled) { color: var(--dojo-ai); font-weight: 600; }
/* まちがいは朱の字と波線(色だけに頼らない)。 */
.shogi-game .brain-sudoku__board > .brain-sudoku__cell--wrong:not(:disabled) { color: var(--dojo-shu); }
.shogi-game .brain-sudoku__cell--wrong .brain-sudoku__value { text-decoration: underline wavy var(--dojo-shu); text-decoration-thickness: 2px; text-underline-offset: 0.12em; }
/* 選んだマスと同じ行・列・枠は薄く、同じ数字は藍の薄い面、選んだマスは橙の縁(形でも分かる)。 */
.shogi-game .brain-sudoku__cell--peer { --cell-bg: var(--dojo-paper-2); }
.shogi-game .brain-sudoku__cell--same { --cell-bg: var(--dojo-ai-soft); }
.shogi-game .brain-sudoku__cell--selected { --cell-bg: #fff3dc; --ring: inset 0 0 0 3px var(--dojo-now); }
/* ヒント: 理由の行・列・枠は緑の薄い面、候補を消すマスは朱の薄い面、決まるマスは緑の縁。 */
.shogi-game .brain-sudoku__cell--hint-unit { --cell-bg: var(--dojo-good-soft); }
.shogi-game .brain-sudoku__cell--hint-pattern { --cell-bg: var(--dojo-ai-soft); --ring: inset 0 0 0 2px var(--dojo-ai-light); }
.shogi-game .brain-sudoku__cell--hint-elim { --cell-bg: var(--dojo-shu-soft); }
.shogi-game .brain-sudoku__cell--hint { --ring: inset 0 0 0 3px var(--dojo-good); animation: brain-sudoku-pulse 900ms ease-in-out infinite alternate; }
@keyframes brain-sudoku-pulse { to { background: var(--dojo-good-soft); } }
/* そろった行・列・枠が光る(D:2-2の小さな解放)。 */
.shogi-game .brain-sudoku__cell--flash { animation: brain-sudoku-flash 650ms ease-out; }
@keyframes brain-sudoku-flash {
  0% { background: #fff; }
  35% { background: var(--dojo-gold-soft); }
  100% { background: #fff; }
}
/* 解けた: 盤じゅうを左上から斜めに光らせる。 */
.shogi-game .brain-sudoku__board--solved .brain-sudoku__cell { animation: brain-sudoku-solved 520ms ease-out both; }
@keyframes brain-sudoku-solved {
  0% { background: #fff; }
  45% { background: var(--dojo-gold-soft); }
  100% { background: var(--dojo-good-soft); }
}
.shogi-game .brain-sudoku__notes {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  width: 100%;
  height: 100%;
  padding: 2px;
  color: var(--dojo-ink-2);
  font-size: calc(var(--sudoku-board) / var(--n) * 0.24);
  font-weight: 700;
}
.shogi-game .brain-sudoku--n6 .brain-sudoku__notes { font-size: calc(var(--sudoku-board) / var(--n) * 0.2); }
.shogi-game .brain-sudoku__notes i { display: grid; place-items: center; font-style: normal; }
.shogi-game .brain-sudoku__done {
  position: absolute;
  inset: 26% 8%;
  display: grid;
  place-content: center;
  gap: 0.4rem;
  padding: 0.6rem;
  border: 3px solid var(--dojo-good);
  border-radius: var(--dojo-radius);
  color: var(--dojo-ink);
  background: rgba(251, 247, 238, 0.95);
  box-shadow: var(--dojo-shadow);
  font: inherit;
  text-align: center;
  cursor: pointer;
  animation: brain-countdown-pop 260ms cubic-bezier(0.2, 1.4, 0.4, 1) 300ms both;
}
.shogi-game .brain-sudoku__done strong { color: var(--dojo-good); font-size: 1.8rem; letter-spacing: 0.1em; }
.shogi-game .brain-sudoku__done span { font-size: 0.95rem; font-weight: 800; line-height: 1.5; }

/* 道具と数字のキー */
.shogi-game .brain-sudoku__tools {
  grid-area: tools;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
  gap: 0.4rem;
}
.shogi-game .brain-sudoku__tool {
  min-height: 44px;
  padding: 0 0.3rem;
  border: 2px solid rgba(255, 252, 244, 0.3);
  border-radius: 12px;
  color: var(--dojo-light);
  background: var(--dojo-desk-2);
  box-shadow: none;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 800;
  white-space: nowrap;
  cursor: pointer;
}
.shogi-game .brain-sudoku__tool--on { border-color: var(--dojo-now); color: var(--dojo-ink); background: var(--dojo-now); }
.shogi-game .brain-sudoku__tool--main { border-color: var(--dojo-good); color: #fff; background: var(--dojo-good); }
.shogi-game .brain-sudoku__tool:disabled { opacity: 0.45; cursor: default; }
.shogi-game .brain-sudoku__pad {
  grid-area: pad;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.4rem;
}
.shogi-game .brain-sudoku--n6 .brain-sudoku__pad { grid-template-columns: repeat(6, minmax(0, 1fr)); }
.shogi-game .brain-sudoku__key {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 52px;
  padding: 0;
  border: 2px solid var(--dojo-rule);
  border-radius: 12px;
  color: var(--dojo-ai-deep);
  background: #fff;
  box-shadow: 0 3px 0 var(--dojo-rule);
  font: inherit;
  font-size: 1.55rem;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  touch-action: manipulation;
}
.shogi-game .brain-sudoku__key small { position: absolute; right: 0.35rem; bottom: 0.15rem; color: var(--dojo-ink-2); font-size: 0.66rem; font-weight: 800; }
.shogi-game .brain-sudoku__pad--memo .brain-sudoku__key { color: var(--dojo-ink-2); background: var(--dojo-paper-2); font-size: 1.15rem; }
.shogi-game .brain-sudoku__key:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 1px 0 var(--dojo-rule); }
/* 押せないあいだも白いまま薄くする(全体のボタンの書式で暗くならないように)。 */
.shogi-game .brain-sudoku__key:disabled { color: var(--dojo-ai-deep); background: #fff; opacity: 0.35; cursor: default; }
@media (hover: hover) {
  .shogi-game .brain-sudoku__key:not(:disabled):hover { border-color: var(--dojo-now); background-color: #fff3dc; }
  .shogi-game .brain-sudoku__tool:not(:disabled):hover { border-color: var(--dojo-now); }
  .shogi-game .brain-sudoku__board > .brain-sudoku__cell:not(:disabled):hover { filter: brightness(0.96); }
}

/* 背の低い画面(スマホの小さな縦): キーと道具を低くして、盤に高さをまわす(U:7-4 盤を最優先)。 */
@media (orientation: portrait) and (max-height: 700px) {
  .shogi-game .brain-sudoku { --sudoku-board: min(calc(100 * var(--dojo-vw) - 2rem), calc(100 * var(--dojo-dvh) - 19.5rem), 40rem); gap: 0.35rem; }
  .shogi-game .brain-sudoku__key { min-height: 46px; font-size: 1.35rem; }
  .shogi-game .brain-sudoku__tool { min-height: 40px; }
  .shogi-game .brain-sudoku__message { height: calc(0.78rem * 1.4 * 2 + 0.4rem); font-size: 0.78rem; line-height: 1.4; }
}
/* 横向き・広い画面: 左に盤(高さいっぱい)、右に時間・文・道具・キー(16-3の表)。 */
@media (orientation: landscape) {
  .shogi-game .brain-sudoku {
    --sudoku-board: min(calc(100 * var(--dojo-dvh) - 6.4rem), calc(100 * var(--dojo-vw) - 25rem), 40rem);
    grid-template-columns: var(--sudoku-board) minmax(14rem, 22rem);
    grid-template-rows: auto auto auto 1fr;
    grid-template-areas: "board status" "board message" "board tools" "board pad";
    align-items: start;
    gap: 0.45rem 1rem;
  }
  .shogi-game .brain-sudoku__pad { align-self: start; }
}
@media (orientation: landscape) and (max-height: 500px) {
  .shogi-game .brain-sudoku__key { min-height: 44px; font-size: 1.3rem; }
  .shogi-game .brain-sudoku__tool { min-height: 40px; }
  .shogi-game .brain-sudoku__message { height: calc(0.78rem * 1.4 * 3 + 0.4rem); font-size: 0.78rem; line-height: 1.4; }
}
@media (prefers-reduced-motion: reduce) {
  .shogi-game .brain-sudoku__cell--flash,
  .shogi-game .brain-sudoku__board--solved .brain-sudoku__cell,
  .shogi-game .brain-sudoku__cell--hint,
  .shogi-game .brain-sudoku__done,
  .shogi-game .brain-sudoku__spinner { animation: none; }
  .shogi-game .brain-sudoku__board--solved .brain-sudoku__cell { --cell-bg: var(--dojo-good-soft); }
  .shogi-game .brain-sudoku__key:active:not(:disabled) { transform: none; }
}
</style>
