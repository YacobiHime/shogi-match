<template>
  <!--
    将棋の棚の3種目(docs/brain-training-design.mdの12章)。対局と同じ盤で、将棋の力を将棋の中で練習する。
    - 直観の一手(intuition): 3本の矢印(A・B・C)から、時間内にいちばん良い手を選ぶ。
    - 思い込み外し(einstellung): 最初に目に付く手(点線の矢印)より良い手を、盤で指す。
    - 目隠しの詰将棋(blind): 盤は初めの局面のまま、手順を文字で進め、最後の詰ませる手を選ぶ。
  -->
  <section ref="stageEl" class="brain-sense" :aria-label="title" :data-brain-sense="kind">
    <div class="brain-sense__board" :style="boardBoxStyle">
      <ShogiMatchBoard
        v-if="boardSfen"
        :sfen="boardSfen"
        :last-move="lastMove"
        :allow-move="phase === 'question' && kind === 'einstellung'"
        :enable-drag-and-drop="true"
        :mobile="isNarrow"
        :layout="isNarrow ? 'portrait' : 'standard'"
        :asset-base-url="assetBaseUrl"
        :flip="flipped"
        :candidates="arrows"
        :threat-arrows="dottedArrows"
        :float-labels="labels"
        @usi-move="onBoardMove"
        @resize="onBoardResize"
      />
    </div>
    <div ref="panelEl" class="brain-sense__panel">
      <p class="brain-game__status" aria-live="polite">
        <span>{{ Math.min(trials.length + (phase === 'result' ? 0 : 1), count) }} / {{ count }}</span>
        <span>{{ levelLabel }}</span>
      </p>
      <p class="brain-sense__prompt" data-sense-prompt>{{ prompt }}</p>
      <div v-if="kind === 'intuition' && phase === 'question'" class="brain-sense__timer" aria-hidden="true">
        <span :style="{ width: `${Math.max(0, timeLeft) * 100}%` }"></span>
      </div>
      <!-- 目隠しの詰将棋の手順(盤は動かさない)。手順を隠す段では、いま出ている1手だけ。 -->
      <ol v-if="kind === 'blind' && blind && (phase === 'moves' || phase === 'question' || phase === 'result')" class="brain-sense__moves" data-sense-moves>
        <li v-for="(label, index) in shownLabels" :key="index">{{ label }}</li>
      </ol>

      <div v-if="phase === 'loading'" class="brain-game__actions"><p class="brain-sense__note">準備しています…</p></div>
      <div v-else-if="phase === 'intro'" class="brain-game__actions">
        <button type="button" class="brain-game__primary" data-brain-start @click="startTrial">はじめる</button>
      </div>
      <div v-else-if="phase === 'question' && choices.length" class="brain-sense__choices" role="group" aria-label="選ぶ手">
        <button
          v-for="(usi, index) in choices"
          :key="usi"
          type="button"
          class="brain-sense__choice"
          :data-sense-choice="usi"
          @click="answerChoice(usi)"
        ><b>{{ LETTERS[index] }}</b>{{ choiceLabel(usi) }}</button>
      </div>
      <div v-else-if="phase === 'question' && kind === 'einstellung'" class="brain-game__actions">
        <button type="button" class="brain-game__secondary" data-sense-giveup @click="giveUp">わからない</button>
      </div>
      <div v-else-if="phase === 'result'" class="brain-game__actions">
        <button type="button" class="brain-game__primary" data-brain-next @click="advance">{{ trials.length >= count ? "結果を見る" : "つぎへ" }}</button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, type PropType } from "vue";
import ShogiMatchBoard from "../ShogiMatchBoard.vue";
import { nextStair } from "../core/brain-training.mjs";
import { formatHintMove } from "../core/match-assists.mjs";
import { tesujiShape } from "../core/tesuji-shape.mjs";
import {
  BLIND_LEVELS,
  BLIND_MAX_LEVEL,
  EINSTELLUNG_COUNT,
  INTUITION_LEVELS,
  INTUITION_MAX_LEVEL,
  blindMatePool,
  blindMateProblem,
  einstellungPool,
  intuitionPool,
  judgeEinstellung,
  pickIntuition,
  pickProblem,
  scoreChoice,
} from "../core/brain-shogi-sense.mjs";

type Kind = "intuition" | "einstellung" | "blind";
type Problem = { id: string; sfen: string; best?: string; accepted?: readonly string[]; choices?: readonly string[]; tesuji?: string; tempting?: string; temptingKind?: string; b?: number };
type BlindProblem = NonNullable<ReturnType<typeof blindMateProblem>>;

const props = defineProps({
  kind: { type: String as PropType<Kind>, required: true },
  startLevel: { type: Number, default: 0 },
  count: { type: Number, default: 10 },
  assetBaseUrl: { type: String, default: "." },
});
const emit = defineEmits<{
  (event: "finish", result: { value: number; level: number; correct: number; total: number }): void;
  (event: "sound", kind: "correct" | "miss" | "place"): void;
}>();

const LETTERS = ["A", "B", "C"];
/** 目隠しの詰将棋で、手順の1手を出す間(ミリ秒)。 */
const BLIND_MOVE_MS = 1600;
const TITLES: Record<Kind, string> = { intuition: "直観の一手", einstellung: "思い込み外し", blind: "目隠しの詰将棋" };
const title = computed(() => TITLES[props.kind]);
const maxLevel = computed(() => (props.kind === "intuition" ? INTUITION_MAX_LEVEL : props.kind === "blind" ? BLIND_MAX_LEVEL : 0));

const phase = ref<"loading" | "intro" | "moves" | "question" | "result" | "done">("loading");
const stair = ref({ level: Math.max(0, Math.min(maxLevel.value, props.startLevel)), streak: 0 });
const problem = ref<Problem | null>(null);
const blind = ref<BlindProblem | null>(null);
const boardSfen = ref("");
const lastMove = ref("");
const arrows = ref<{ usi: string; guideKind?: "move" }[]>([]);
const dottedArrows = ref<{ usi: string; color: "black" | "white" }[]>([]);
const labels = ref<{ id: string; file: number; rank: number; text: string; tone: "good" | "bad"; pin: boolean; sub?: boolean; offset?: boolean }[]>([]);
const message = ref("");
const timeLeft = ref(1);
const blindStep = ref(0);
const trials = ref<{ level: number; correct: boolean }[]>([]);
const used = new Set<string>();
const seedBase = Math.floor(Math.random() * 1e9);
let pool: readonly any[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let ticker: ReturnType<typeof setInterval> | null = null;

function clearTimers() {
  if (timer) clearTimeout(timer);
  if (ticker) clearInterval(ticker);
  timer = null;
  ticker = null;
}
onBeforeUnmount(clearTimers);

const sideToMove = (sfen: string) => (sfen.split(" ")[1] === "w" ? "white" : "black");
/** 盤の下側を、問題で指す側にする。 */
const flipped = computed(() => Boolean(problem.value || blind.value) && sideToMove((problem.value ?? blind.value)?.sfen ?? "") === "white");
const levelLabel = computed(() => {
  if (props.kind === "intuition") return `${INTUITION_LEVELS[stair.value.level].seconds}秒`;
  if (props.kind === "blind") {
    const level = BLIND_LEVELS[stair.value.level];
    return `${level.plies}手詰め${level.hide ? "・手順を隠す" : ""}`;
  }
  return "";
});
const choices = computed(() => {
  if (phase.value !== "question") return [];
  if (props.kind === "intuition") return problem.value?.choices ?? [];
  if (props.kind === "blind") return blind.value?.choices ?? [];
  return [];
});
function choiceLabel(usi: string) {
  const sfen = props.kind === "blind" ? blind.value?.lastSfen ?? "" : problem.value?.sfen ?? "";
  try {
    return formatHintMove(usi, sfen);
  } catch {
    return usi;
  }
}
const mark = (sfen: string) => (sideToMove(sfen) === "black" ? "▲" : "△");
/** 目隠しの詰将棋の手順の文字(「▲2三銀」)。手順を隠す段では、いま出ている1手だけ。 */
const shownLabels = computed(() => {
  const problemValue = blind.value;
  if (!problemValue) return [];
  const all = problemValue.shown.map((usi, index) => `${mark(problemValue.sfens[index])}${formatHintMove(usi, problemValue.sfens[index])}`);
  if (phase.value === "moves") return problemValue.hide ? [all[blindStep.value]] : all.slice(0, blindStep.value + 1);
  if (phase.value === "question") return problemValue.hide ? [] : all;
  return all;
});
const prompt = computed(() => {
  if (message.value) return message.value;
  switch (props.kind) {
    case "intuition":
      return phase.value === "intro" ? "3つの手から、いちばん良い手をぱっと選ぼう。考えすぎないのがコツだよ。" : "いちばん良い手はどれ？";
    case "einstellung":
      if (phase.value === "intro") return "目に付く手も良さそう。でも、もっと良い手があるよ。盤で指して答えよう。";
      return problem.value ? `点線の${problem.value.temptingKind === "capture" ? "駒取り" : "王手"}（${choiceLabel(problem.value.tempting ?? "")}）も良さそう。でも、もっと良い手があるよ。盤で指してね。` : "";
    case "blind":
      if (phase.value === "intro") return "盤は動かさずに、手順を頭の中で進めよう。最後に詰ませる手を選んでね。";
      if (phase.value === "moves") return "頭の中で盤を動かしてね。";
      return "この手順のあと、詰ませる手はどれ？";
    default:
      return "";
  }
});

function clearBoardMarks() {
  arrows.value = [];
  dottedArrows.value = [];
  labels.value = [];
}
const squareOf = (usi: string) => ({ file: Number(usi[2]), rank: usi.charCodeAt(3) - 96 });

async function loadPool() {
  if (props.kind === "blind") {
    const { TSUME_PROBLEMS } = await import("../data/tsume-problems.mjs");
    pool = blindMatePool(TSUME_PROBLEMS);
  } else {
    const { SKILL_TEST_BANK } = await import("../core/skill-test-bank.mjs");
    pool = props.kind === "intuition" ? intuitionPool(SKILL_TEST_BANK) : einstellungPool(SKILL_TEST_BANK);
  }
  phase.value = "intro";
}
onMounted(() => { void loadPool(); });

function startTrial() {
  clearTimers();
  clearBoardMarks();
  message.value = "";
  lastMove.value = "";
  const seed = seedBase + trials.value.length * 7919;
  if (props.kind === "blind") {
    const next = blindMateProblem(pool, stair.value.level, seed, used);
    if (!next) return;
    used.add(next.id);
    blind.value = next;
    problem.value = null;
    boardSfen.value = next.sfen;
    blindStep.value = 0;
    phase.value = "moves";
    emit("sound", "place");
    timer = setTimeout(nextBlindMove, BLIND_MOVE_MS);
    return;
  }
  const next = (props.kind === "intuition"
    ? pickIntuition(pool, stair.value.level, seed, used)
    : pickProblem(pool, 0, seed, used)) as Problem | null;
  if (!next) return;
  used.add(next.id);
  problem.value = next;
  blind.value = null;
  boardSfen.value = next.sfen;
  if (props.kind === "intuition") {
    arrows.value = (next.choices ?? []).map((usi) => ({ usi, guideKind: "move" as const }));
    labels.value = (next.choices ?? []).map((usi, index) => ({ id: `c${index}`, ...squareOf(usi), text: LETTERS[index], tone: "good" as const, pin: true, offset: true }));
    startClock(INTUITION_LEVELS[stair.value.level].seconds);
  } else {
    dottedArrows.value = next.tempting ? [{ usi: next.tempting, color: sideToMove(next.sfen) }] : [];
  }
  phase.value = "question";
}
function startClock(seconds: number) {
  const started = performance.now();
  timeLeft.value = 1;
  ticker = setInterval(() => {
    timeLeft.value = 1 - (performance.now() - started) / (seconds * 1000);
    if (timeLeft.value <= 0) {
      clearTimers();
      finishTrial(false, "時間切れ。");
    }
  }, 50);
}
function nextBlindMove() {
  clearTimers();
  const current = blind.value;
  if (!current) return;
  if (blindStep.value + 1 >= current.shown.length) {
    timer = setTimeout(() => {
      phase.value = "question";
    }, current.hide ? BLIND_MOVE_MS : 300);
    return;
  }
  blindStep.value += 1;
  emit("sound", "place");
  timer = setTimeout(nextBlindMove, BLIND_MOVE_MS);
}

function answerChoice(usi: string) {
  if (phase.value !== "question") return;
  clearTimers();
  if (props.kind === "blind" && blind.value) {
    finishTrial(usi === blind.value.answer, "", usi);
    return;
  }
  if (problem.value) finishTrial(scoreChoice(problem.value, usi).correct, "", usi);
}
function onBoardMove(usi: string) {
  if (phase.value !== "question" || props.kind !== "einstellung" || !problem.value) return;
  const verdict = judgeEinstellung(problem.value, usi);
  if (verdict === "tempting") {
    // 目に付く手は数えない。盤を戻して、もう一度探してもらう(D:7-1)。
    message.value = "それは最初に目に付いた手。もっと良い手を探そう。";
    emit("sound", "miss");
    const sfen = boardSfen.value;
    boardSfen.value = "";
    setTimeout(() => {
      boardSfen.value = sfen;
    }, 0);
    return;
  }
  finishTrial(verdict === "correct", "", usi);
}
function giveUp() {
  if (phase.value === "question") finishTrial(false, "");
}

/** 答えのあと: 正解の手を矢印で見せ、何が良かったかを言う(D:5-4・D:7-2)。 */
function finishTrial(correct: boolean, prefix: string, played = "") {
  clearTimers();
  const level = stair.value.level;
  trials.value = [...trials.value, { level, correct }];
  if (maxLevel.value > 0) stair.value = nextStair(stair.value, correct, { max: maxLevel.value });
  emit("sound", correct ? "correct" : "miss");
  clearBoardMarks();
  if (props.kind === "blind" && blind.value) {
    const current = blind.value;
    boardSfen.value = current.lastSfen;
    lastMove.value = current.shown.at(-1) ?? "";
    arrows.value = [{ usi: current.answer, guideKind: "move" }];
    const answer = `${mark(current.lastSfen)}${choiceLabel(current.answer)}`;
    message.value = correct ? `正解！ ${answer}で詰み。頭の中の盤がよく見えているね。` : `${prefix}詰ませる手は${answer}。手順を進めた盤はこうなっていたよ。`;
  } else if (problem.value) {
    const current = problem.value;
    const best = current.best ?? current.accepted?.[0] ?? "";
    arrows.value = best ? [{ usi: best, guideKind: "move" }] : [];
    if (played && !correct && played !== best) dottedArrows.value = [{ usi: played, color: sideToMove(current.sfen) }];
    const name = tesujiShape(current.tesuji ?? "")?.name ?? "";
    const bestText = `${mark(current.sfen)}${choiceLabel(best)}`;
    if (props.kind === "intuition") {
      message.value = correct ? `正解！ ${name ? `${name}。` : ""}ぱっと良い手が見えたね。` : `${prefix}いちばん良い手は${bestText}${name ? `（${name}）` : ""}だよ。`;
    } else {
      message.value = correct
        ? `正解！ ${name || "良い手"}。目に付く手で止まらずに、もっと良い手を見つけたね。`
        : `答えは${bestText}${name ? `（${name}）` : ""}。目に付く手より、こちらのほうが良かったよ。`;
    }
  }
  phase.value = "result";
}
function advance() {
  if (trials.value.length >= props.count) {
    phase.value = "done";
    const correct = trials.value.filter((trial) => trial.correct).length;
    // 直観・目隠し: 正解した中でいちばん高い段+1。思い込み外し: 正解の数。
    const value = props.kind === "einstellung" ? correct : Math.max(0, ...trials.value.filter((trial) => trial.correct).map((trial) => trial.level + 1));
    emit("finish", { value, level: stair.value.level, correct, total: trials.value.length });
    return;
  }
  startTrial();
}

// 狭い縦長の画面では縦長の盤にする(棋力テストと同じ基準)。
const narrowMediaQuery = typeof window !== "undefined" && window.matchMedia
  ? window.matchMedia("(max-width: 56rem) and (orientation: portrait), (max-width: 30rem)")
  : null;
const isNarrow = ref(Boolean(narrowMediaQuery?.matches));
function onNarrowChange(event: MediaQueryListEvent) { isNarrow.value = event.matches; }
onMounted(() => narrowMediaQuery?.addEventListener("change", onNarrowChange));
onBeforeUnmount(() => narrowMediaQuery?.removeEventListener("change", onNarrowChange));

/* 盤の枠を、描かれる盤と同じ大きさにする(棋力テストと同じ方法)。 */
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
  const minHeight = Math.min(300, window.innerHeight * 0.4);
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
.shogi-game .brain-sense {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  box-sizing: border-box;
}
.shogi-game .brain-sense__board { flex: none; position: relative; }
.shogi-game .brain-sense__panel {
  flex: 0 1 22rem;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  color: #fffcf4;
}
.shogi-game .brain-sense__prompt { margin: 0; font-size: 1rem; line-height: 1.5; font-weight: 700; }
.shogi-game .brain-sense__note { margin: 0; color: #cfd8de; }
.shogi-game .brain-sense__timer {
  height: 0.6rem;
  border-radius: 999px;
  background: rgba(255, 252, 244, 0.18);
  overflow: hidden;
}
.shogi-game .brain-sense__timer span { display: block; height: 100%; background: #f1a54c; border-radius: inherit; }
.shogi-game .brain-sense__moves {
  margin: 0;
  padding: 0.5rem 0.75rem 0.5rem 2rem;
  border-radius: 0.6rem;
  background: rgba(255, 252, 244, 0.1);
  font-size: 1.15rem;
  font-weight: 700;
  min-height: 2.2rem;
}
.shogi-game .brain-sense__choices { display: grid; gap: 0.5rem; }
.shogi-game .brain-sense__choice {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-height: 2.9rem;
  padding: 0.5rem 0.9rem;
  border: 2px solid rgba(255, 252, 244, 0.35);
  border-radius: 0.7rem;
  background: #2b465b;
  color: #fffcf4;
  font-size: 1.05rem;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
}
.shogi-game .brain-sense__choice b {
  flex: none;
  display: grid;
  place-items: center;
  width: 1.8rem;
  height: 1.8rem;
  border-radius: 50%;
  background: #f1a54c;
  color: #1d303f;
}
/* 横向きのスマホ: 高さが足りないので、右の欄を細くして盤に幅を回す(欄が広いと、盤が小さすぎて駒が読めなかった)。 */
@media (orientation: landscape) and (max-height: 600px) {
  .shogi-game .brain-sense { gap: 0.6rem; }
  .shogi-game .brain-sense__panel { flex-basis: 15rem; gap: 0.45rem; }
  .shogi-game .brain-sense__prompt { font-size: 0.92rem; line-height: 1.4; }
  .shogi-game .brain-sense__choice { min-height: 2.6rem; padding: 0.35rem 0.7rem; font-size: 0.95rem; }
  .shogi-game .brain-sense__moves { font-size: 1rem; }
}
@media (max-width: 56rem) and (orientation: portrait), (max-width: 30rem) {
  .shogi-game .brain-sense { flex-direction: column; justify-content: flex-start; }
  .shogi-game .brain-sense__panel { flex: none; width: 100%; }
}
</style>
