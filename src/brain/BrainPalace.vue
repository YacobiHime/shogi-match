<template>
  <!--
    記憶力の場所法の学校と毎日の練習(docs/brain-training-design.mdの11-6)。自分の宮殿の場所に、覚えるものを大げさな絵にして置き、
    場所をたどって思い出す。講1〜9で方法を身につけ、講3を終えると毎日の練習(前の回の言葉・宮殿に置く・数字)が開く。
  -->
  <section class="brain-game brain-palace" aria-label="記憶の宮殿" data-brain-palace>
    <!-- 学校の入口。講の道と、使う宮殿。 -->
    <template v-if="phase === 'school'">
      <p class="brain-game__prompt">{{ schoolMessage }}</p>
      <button v-if="palaces.length > 1" type="button" class="brain-palace__using" data-palace-switch @click="cyclePalace">
        使う宮殿：<strong>{{ activePalace?.name }}</strong>（{{ activePalace?.loci.length }}か所）<span aria-hidden="true">⇄</span>
      </button>
      <p v-else-if="activePalace" class="brain-palace__using">使う宮殿：<strong>{{ activePalace.name }}</strong>（{{ activePalace.loci.length }}か所）</p>
      <ol class="brain-palace__lessons">
        <li v-for="lesson in PALACE_LESSONS" :key="lesson.id">
          <button
            type="button"
            class="shogi-brain__card"
            :disabled="!lessonUnlocked(store.lessons, lesson.id, Boolean(activePalace))"
            :data-palace-lesson="lesson.id"
            @click="startLesson(lesson.id)"
          >
            <strong>講{{ lesson.number }} {{ lesson.title }}</strong>
            <small>{{ lesson.goal }}</small>
            <span class="shogi-brain__card-tag">{{ lessonTag(lesson.id) }}</span>
          </button>
        </li>
      </ol>
    </template>

    <!-- 覚える: 場所を1つずつたどる。 -->
    <template v-else-if="phase === 'study' && scenes[studyIndex]">
      <p class="brain-game__status"><span>{{ studyIndex + 1 }} / {{ scenes.length }}</span><span>{{ stageTitle }}</span></p>
      <div class="brain-palace__scene" data-palace-scene>
        <span class="brain-palace__locus"><span aria-hidden="true">{{ scenes[studyIndex].locus.emoji }}</span>{{ sceneNumber(studyIndex) }}. {{ scenes[studyIndex].locus.name }}</span>
        <template v-if="scenes[studyIndex].images">
          <p class="brain-palace__digits">
            <span v-for="(image, index) in scenes[studyIndex].images" :key="index"><strong>{{ scenes[studyIndex].pair?.[index] }}</strong><span aria-hidden="true">{{ image.emoji }}</span>{{ image.word }}</span>
          </p>
          <p class="brain-palace__image">{{ scenes[studyIndex].image }}</p>
        </template>
        <template v-else-if="scenes[studyIndex].item">
          <strong class="brain-palace__item">
            <span v-if="showHints" aria-hidden="true">{{ scenes[studyIndex].item!.emoji }}</span>{{ scenes[studyIndex].item!.word }}
          </strong>
          <p v-if="showHints" class="brain-palace__image">{{ scenes[studyIndex].image }}</p>
        </template>
        <small v-if="studyIndex === 0 && studyTip" class="brain-palace__tip">{{ studyTip }}</small>
      </div>
      <div class="brain-game__actions">
        <button v-if="studyIndex > 0" type="button" class="brain-game__secondary" @click="studyIndex -= 1">もどる</button>
        <button type="button" class="brain-game__primary" data-palace-next @click="nextStudy">{{ studyIndex + 1 >= scenes.length ? studyDoneLabel : "つぎの場所へ" }}</button>
      </div>
    </template>

    <!-- 思い出す(順に押す) -->
    <BrainOrderRecall
      v-else-if="phase === 'recall'"
      :key="recallKey"
      :pool="recall.pool"
      :count="recall.count"
      :prompt="recall.prompt"
      :label="recall.label"
      :loci="recall.loci"
      :backward="recall.backward"
      @sound="emit('sound', 'place')"
      @done="recall.then"
    />

    <!-- 4択 -->
    <template v-else-if="phase === 'choice' && choiceQuestions[choiceIndex]">
      <p class="brain-game__status"><span>{{ choiceIndex + 1 }} / {{ choiceQuestions.length }}</span><span>{{ stageTitle }}</span></p>
      <p class="brain-game__prompt">{{ choiceQuestions[choiceIndex].prompt }}</p>
      <div class="brain-palace__choices" :class="{ 'brain-palace__choices--long': choiceQuestions[choiceIndex].long }">
        <button
          v-for="option in choiceQuestions[choiceIndex].options"
          :key="option"
          type="button"
          class="brain-glance__choice brain-palace__tile"
          :class="{ 'brain-palace__tile--ok': choiceFeedback && option === choiceQuestions[choiceIndex].answer, 'brain-palace__tile--miss': choiceFeedback === option && option !== choiceQuestions[choiceIndex].answer }"
          :disabled="Boolean(choiceFeedback)"
          :data-palace-choice="option"
          @click="answerChoice(option)"
        >{{ option }}</button>
      </div>
    </template>

    <!-- 講2: 絵にするコツと見本 -->
    <template v-else-if="phase === 'tips'">
      <p class="brain-game__prompt">覚えたいものは、場所といっしょに「変な絵」にすると忘れにくいよ。</p>
      <ul class="brain-palace__tips">
        <li v-for="tip in IMAGE_TIPS" :key="tip.title"><strong>{{ tip.title }}</strong>{{ tip.text }}</li>
      </ul>
      <ol class="brain-palace__examples">
        <li v-for="(example, index) in examples" :key="index"><span aria-hidden="true">{{ example.item?.emoji }}</span>{{ example.image }}</li>
      </ol>
      <div class="brain-game__actions">
        <button type="button" class="brain-game__primary" data-palace-next @click="afterInfo()">やってみる</button>
      </div>
    </template>

    <!-- 講2: 自分でも1つ考える(書くのは任意) -->
    <template v-else-if="phase === 'think' && thinkScene">
      <p class="brain-game__prompt">自分でも考えてみよう。「{{ thinkScene.locus.name }}」に「{{ thinkScene.item?.word }}」を置くなら？</p>
      <label class="brain-builder__field brain-palace__think">
        <span>思いうかべた絵（書かなくてもいいよ）</span>
        <input v-model="thinkText" type="text" maxlength="60" placeholder="例：ドアに大きな…" data-palace-think>
      </label>
      <div class="brain-game__actions">
        <button type="button" class="brain-game__primary" data-palace-next @click="afterInfo()">思いうかべた</button>
      </div>
    </template>

    <!-- 講6: 数字の絵 -->
    <template v-else-if="phase === 'digits-setup'">
      <p class="brain-game__prompt">0〜9を、形の似たものの絵にしよう。押すと絵を変えられるよ。</p>
      <ol class="brain-palace__digit-table">
        <li v-for="digit in 10" :key="digit">
          <strong>{{ digit - 1 }}</strong>
          <button type="button" class="brain-glance__choice brain-palace__tile" :data-palace-digit="digit - 1" @click="cycleDigit(digit - 1)">
            <span aria-hidden="true">{{ digitImage(digitDraft, digit - 1).emoji }}</span>{{ digitImage(digitDraft, digit - 1).word }}
          </button>
        </li>
      </ol>
      <div class="brain-game__actions">
        <button type="button" class="brain-game__primary" data-palace-next @click="afterInfo()">この絵で覚える</button>
      </div>
    </template>

    <!-- 数を思い出す(数字キー) -->
    <template v-else-if="phase === 'digits-recall'">
      <p class="brain-game__status"><span>{{ digitInput.length }} / {{ digitTarget.length }}</span><span>{{ stageTitle }}</span></p>
      <p class="brain-game__prompt">場所をたどって、数を押してね。</p>
      <ol class="brain-palace__digit-answer">
        <li v-for="(pair, index) in digitPairs" :key="index" :class="{ 'brain-palace__digit-answer--now': index === Math.floor(digitInput.length / 2) }">
          <small>{{ digitLoci[index]?.name }}</small><strong>{{ pair || "・・" }}</strong>
        </li>
      </ol>
      <BrainNumberPad :show-submit="false" @digit="pushDigit" @erase="digitInput = digitInput.slice(0, -1)" />
    </template>

    <!-- 講9: 使ってみる -->
    <template v-else-if="phase === 'use-menu'">
      <p class="brain-game__prompt">ふだんの暮らしで使ってみよう。どれにする？</p>
      <ul class="brain-palace__lessons">
        <li v-for="use in USES" :key="use.id">
          <button type="button" class="shogi-brain__card" :data-palace-use="use.id" @click="startUse(use.id)">
            <strong><span aria-hidden="true">{{ use.emoji }}</span> {{ use.title }}</strong>
            <small>{{ use.desc }}</small>
          </button>
        </li>
      </ul>
    </template>

    <!-- 将棋の手順の完成形 -->
    <template v-else-if="phase === 'board'">
      <p class="brain-game__prompt">覚えた8手で、四間飛車と美濃囲いができたよ！</p>
      <BrainBoard :pieces="formationPieces" label="四間飛車と美濃囲い" />
      <div class="brain-game__actions">
        <button type="button" class="brain-game__primary" data-palace-next @click="afterInfo()">つぎは格言</button>
      </div>
    </template>

    <!-- お知らせ(講7を待つ・場所が足りない・講8の説明) -->
    <template v-else-if="phase === 'info'">
      <p class="brain-game__prompt">{{ infoText }}</p>
      <div class="brain-game__actions">
        <button v-if="infoAction" type="button" class="brain-game__primary" data-palace-next @click="afterInfo()">{{ infoAction }}</button>
        <button v-if="infoBuild" type="button" class="brain-game__secondary" data-palace-build @click="emit('build')">宮殿を作る・直す</button>
        <button v-if="!infoAction" type="button" class="brain-game__secondary" @click="backToSchool">学校へ戻る</button>
      </div>
    </template>

    <!-- 講や練習の結果 -->
    <template v-else-if="phase === 'result'">
      <p class="brain-game__prompt">{{ resultMessage }}</p>
      <ol v-if="resultRows.length" class="brain-palace__review">
        <li v-for="(row, index) in resultRows" :key="index" :class="row.ok ? 'brain-palace__review--ok' : 'brain-palace__review--miss'">
          <span>{{ row.label }}</span><strong>{{ row.value }}</strong>
        </li>
      </ol>
      <div class="brain-game__actions">
        <button type="button" class="brain-game__primary" data-brain-next @click="finishRun">{{ mode === "school" ? "学校へ戻る" : "結果を見る" }}</button>
        <button v-if="resultBuild" type="button" class="brain-game__secondary" data-palace-build @click="emit('build')">2つ目の宮殿を作る</button>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, type PropType } from "vue";
import BrainBoard from "./BrainBoard.vue";
import BrainNumberPad from "./BrainNumberPad.vue";
import BrainOrderRecall from "./BrainOrderRecall.vue";
import {
  DIGIT_CHOICES,
  DIGIT_LESSON_LENGTH,
  IMAGE_TIPS,
  NAME_PEOPLE,
  PALACE_LESSONS,
  digitImage,
  digitNumber,
  digitScenes,
  findPalace,
  fourChoices,
  imageExamples,
  imageQuiz,
  lessonPalace,
  lessonUnlocked,
  listScenes,
  nameScenes,
  nextDayState,
  nextDigitCount,
  nextPracticeCount,
  palaceWordSet,
  planPractice,
  practiceOpen,
  practiceValue,
  recallLabel,
  recallPool,
  scoreDigits,
  scoreOrder,
  shogiScenes,
  usablePalaces,
  walkQuiz,
} from "../core/memory-palace.mjs";
import { openingFormation } from "../core/opening-formation.mjs";

type Locus = { name: string; emoji: string; group?: string };
type Palace = { id: string; name: string; place: string; loci: readonly Locus[] };
type Item = { word: string; emoji: string };
type Scene = { locus: Locus; item?: Item | null; image: string; pair?: string; images?: Item[] };
type Question = { prompt: string; answer: string; options: string[]; label: string; long?: boolean };
type Store = {
  version: number;
  palaces: Palace[];
  sample: boolean;
  lessons: string[];
  digits: string[];
  lastWords: { palace: string; words: string[]; day: string } | null;
  lessonWords: { palace: string; words: string[]; day: string } | null;
  lastPalace: string;
  practiceCount: number;
  digitCount: number;
};
type RecordRow = { gameId: string; value: number; level: number; text: string };
type FinishResult = { kind: "practice" | "lesson"; lessonId: string; records: RecordRow[]; correct: number; total: number };

const props = defineProps({
  store: { type: Object as PropType<Store>, required: true },
  day: { type: String, required: true },
  /** school(学校の入口から)・lesson(今日のトレーニングから講を1つ)・practice(毎日の練習)。 */
  mode: { type: String as PropType<"school" | "lesson" | "practice">, default: "school" },
  lessonId: { type: String, default: "" },
});
const emit = defineEmits<{
  (event: "save", patch: Partial<Store>): void;
  (event: "finish", result: FinishResult): void;
  (event: "build"): void;
  (event: "close"): void;
  (event: "sound", kind: "correct" | "miss" | "place"): void;
}>();

const USES = [
  { id: "shopping", emoji: "🛒", title: "買い物リスト", desc: "8つの品物を、お店に行くまで覚えておく" },
  { id: "todo", emoji: "📝", title: "やること", desc: "今日やる5つのことを、順番どおりに" },
  { id: "names", emoji: "👋", title: "人の名前", desc: "名前の音を絵にして、顔と結びつける" },
  { id: "shogi", emoji: "☗", title: "将棋に使う", desc: "四間飛車と美濃囲いの8手と、格言" },
] as const;

const seedBase = Math.floor(Math.random() * 1e9);
const phase = ref<"school" | "study" | "recall" | "choice" | "tips" | "think" | "digits-setup" | "digits-recall" | "use-menu" | "board" | "info" | "result">("school");
const activeId = ref(lessonPalace(props.store)?.id ?? "");
const runLesson = ref("");
// 覚える
const scenes = ref<Scene[]>([]);
const studyIndex = ref(0);
const showHints = ref(false);
const stageTitle = ref("");
const studyTip = ref("");
const studyDoneLabel = ref("思い出す");
const sceneOffset = ref(0);
let afterStudy: () => void = () => {};
// 順に押す
const recallKey = ref(0);
const recall = ref<{ pool: string[]; count: number; prompt: string; label: string; loci: string[]; backward: boolean; then: (answer: string[]) => void }>({
  pool: [], count: 0, prompt: "", label: "", loci: [], backward: false, then: () => {},
});
// 4択
const choiceQuestions = ref<Question[]>([]);
const choiceIndex = ref(0);
const choiceFeedback = ref("");
let afterChoices: () => void = () => {};
let choiceTimer: ReturnType<typeof setTimeout> | null = null;
// 講2
const examples = ref<Scene[]>([]);
const thinkScene = ref<Scene | null>(null);
const thinkText = ref("");
// 数字
const digitDraft = ref<string[]>([...props.store.digits]);
const digitTarget = ref("");
const digitInput = ref("");
const digitLoci = ref<Locus[]>([]);
let afterDigits: (answer: string) => void = () => {};
// お知らせ
const infoText = ref("");
const infoAction = ref("");
const infoBuild = ref(false);
let afterInfoStep: () => void = () => {};
// 結果
const resultMessage = ref("");
const resultRows = ref<{ label: string; value: string; ok: boolean }[]>([]);
const resultBuild = ref(false);
let total = { correct: 0, total: 0 };
let pending: FinishResult | null = null;

const palaces = computed(() => usablePalaces(props.store) as Palace[]);
const activePalace = computed(() => (findPalace(props.store, activeId.value) ?? palaces.value[0] ?? null) as Palace | null);
const formationPieces = computed(() => openingFormation("shiken", "mino").pieces.map(({ square, kind }) => ({ square, kind, color: "black" })));
const schoolMessage = computed(() => {
  if (!activePalace.value) return "まず宮殿を作ろう。宮殿ができると、講1が開くよ。";
  if (props.store.lessons.length >= PALACE_LESSONS.length) return "全部の講を終えたね！ 毎日の練習で、覚えられる数を伸ばそう。";
  if (practiceOpen(props.store.lessons)) return "毎日の練習が開いているよ。講は自分のペースで進めよう。";
  return "場所法は、よく知っている場所に、覚えたいものを順に置いていく覚え方。講を順番に受けよう。";
});
const digitPairs = computed(() => {
  const pairs = [];
  for (let index = 0; index * 2 < digitTarget.value.length; index += 1) pairs.push(digitInput.value.slice(index * 2, index * 2 + 2));
  return pairs;
});

onBeforeUnmount(() => {
  if (choiceTimer) clearTimeout(choiceTimer);
});

if (props.mode === "practice") startPractice();
else if (props.mode === "lesson" && props.lessonId) startLesson(props.lessonId);

function lessonTag(id: string) {
  if (props.store.lessons.includes(id)) return "✓ 終えた";
  if (id === "nextday" && lessonUnlocked(props.store.lessons, id)) {
    const state = nextDayState(props.store, props.day);
    if (state === "wait") return "あした";
  }
  return lessonUnlocked(props.store.lessons, id, Boolean(activePalace.value)) ? "" : "🔒";
}
function cyclePalace() {
  const list = palaces.value;
  const index = list.findIndex(({ id }) => id === activePalace.value?.id);
  activeId.value = list[(index + 1) % list.length]?.id ?? "";
  emit("save", { lastPalace: activeId.value });
}
function sceneNumber(index: number) {
  return sceneOffset.value + index + 1;
}

// ===== 部品の流れ =====

function startStudy(list: Scene[], options: { title: string; hints?: boolean; tip?: string; done?: string; offset?: number }, then: () => void) {
  scenes.value = list;
  studyIndex.value = 0;
  showHints.value = Boolean(options.hints);
  stageTitle.value = options.title;
  studyTip.value = options.tip ?? "";
  studyDoneLabel.value = options.done ?? "思い出す";
  sceneOffset.value = options.offset ?? 0;
  afterStudy = then;
  phase.value = "study";
}
function nextStudy() {
  if (studyIndex.value + 1 < scenes.value.length) {
    studyIndex.value += 1;
    return;
  }
  afterStudy();
}

function askRecall(input: { pool: string[]; count: number; prompt: string; label: string; loci: string[]; backward?: boolean }, then: (answer: string[]) => void) {
  recallKey.value += 1;
  recall.value = { ...input, backward: Boolean(input.backward), then };
  phase.value = "recall";
}

function askChoices(questions: Question[], title: string, then: () => void) {
  choiceQuestions.value = questions;
  choiceIndex.value = 0;
  choiceFeedback.value = "";
  stageTitle.value = title;
  afterChoices = then;
  phase.value = "choice";
}
function answerChoice(option: string) {
  const question = choiceQuestions.value[choiceIndex.value];
  const ok = option === question.answer;
  choiceFeedback.value = option;
  total = { correct: total.correct + (ok ? 1 : 0), total: total.total + 1 };
  resultRows.value = [...resultRows.value, { label: question.label, value: question.answer, ok }];
  emit("sound", ok ? "correct" : "miss");
  choiceTimer = setTimeout(() => {
    choiceFeedback.value = "";
    if (choiceIndex.value + 1 < choiceQuestions.value.length) {
      choiceIndex.value += 1;
      return;
    }
    afterChoices();
  }, ok ? 500 : 1300);
}

function showInfo(text: string, action: string, then: () => void, build = false) {
  infoText.value = text;
  infoAction.value = action;
  infoBuild.value = build;
  afterInfoStep = then;
  phase.value = "info";
}
function afterInfo() {
  afterInfoStep();
}

function askDigits(target: string, loci: Locus[], title: string, then: (answer: string) => void) {
  digitTarget.value = target;
  digitInput.value = "";
  digitLoci.value = loci;
  stageTitle.value = title;
  afterDigits = then;
  phase.value = "digits-recall";
}
function pushDigit(digit: string) {
  if (digitInput.value.length >= digitTarget.value.length) return;
  digitInput.value += digit;
  emit("sound", "place");
  if (digitInput.value.length >= digitTarget.value.length) afterDigits(digitInput.value);
}

/** 順に押した答えを採点し、結果の行に足す。 */
function scoreRecall(expected: string[], answer: string[], loci: string[], backward = false) {
  const score = scoreOrder(expected, answer);
  total = { correct: total.correct + score.correct, total: total.total + score.total };
  const rows = expected.map((word, index) => {
    const number = backward ? expected.length - index : index + 1;
    return { label: `${number}. ${loci[number - 1] ?? ""}`, value: word, ok: score.positions[index] };
  });
  return { score, rows };
}

function showResult(message: string, rows: { label: string; value: string; ok: boolean }[] = [], build = false) {
  resultMessage.value = message;
  resultRows.value = rows;
  resultBuild.value = build;
  phase.value = "result";
}

function completeLesson(id: string, extra: Partial<Store> = {}) {
  const lessons = props.store.lessons.includes(id) ? [...props.store.lessons] : [...props.store.lessons, id];
  emit("save", { ...extra, lessons, lastPalace: activePalace.value?.id ?? props.store.lastPalace });
  pending = { kind: "lesson", lessonId: id, records: [], correct: total.correct, total: total.total };
}

function praise(correct: number, count: number) {
  if (correct === count) return `${count}個、全部順番どおり！ 場所をたどると、ちゃんと出てくるでしょ？`;
  return `${count}個のうち${correct}個。思い出せないところは、その場所の絵をもう一度思いうかべてみよう。`;
}

// ===== 講 =====

function startLesson(id: string) {
  const lesson = PALACE_LESSONS.find((item) => item.id === id);
  const palace = activePalace.value;
  if (!lesson || !palace || !lessonUnlocked(props.store.lessons, id)) return;
  runLesson.value = id;
  total = { correct: 0, total: 0 };
  resultRows.value = [];
  pending = null;
  const seed = seedBase + id.length * 131;
  const names = palace.loci.map(({ name }) => name);
  if (lesson.kind === "walk") {
    const quiz = walkQuiz(seed, palace.loci);
    startStudy(quiz.route.map((locus) => ({ locus, item: null, image: "" })), { title: "宮殿を歩く", tip: "目をとじて、1番目から歩くつもりで思いうかべてね。", done: "歩けた" }, () => {
      askRecall({ pool: quiz.pool, count: quiz.forward.length, prompt: "1番目から順に、場所を押してね。", label: "前から", loci: [] }, (answer) => {
        const forward = scoreRecall(quiz.forward, answer, names);
        askRecall({ pool: quiz.pool, count: quiz.backward.length, prompt: "こんどは、いちばん後ろの場所から順に。", label: "後ろから", loci: [], backward: true }, (back) => {
          const backward = scoreRecall(quiz.backward, back, names, true);
          const jumps = quiz.jumps.map((jump) => ({ prompt: `${jump.number}番目の場所は？`, answer: jump.answer, options: jump.options, label: `${jump.number}番目` }));
          askChoices(jumps, "飛び飛び", () => {
            completeLesson(id);
            const all = forward.score.correct + backward.score.correct;
            showResult(
              all === quiz.forward.length * 2 ? "前からも後ろからも、まちがえずに歩けた！ この道順が、これからの宮殿だよ。" : "宮殿の道順を歩けたね。目をとじて歩く練習を、ときどきしてみよう。",
              forward.rows,
            );
          });
        });
      });
    });
  } else if (lesson.kind === "image") {
    examples.value = imageExamples(seed, palace.loci) as Scene[];
    phase.value = "tips";
    afterInfoStep = () => {
      const quiz = imageQuiz(seed, palace.loci);
      const questions = quiz.map((question) => ({
        prompt: `「${question.locus.name}」に「${question.item.word}」を置くなら、どの絵がいちばん覚えやすい？`,
        answer: question.options.find(({ good }) => good)!.text,
        options: question.options.map(({ text }) => text),
        label: question.locus.name,
        long: true,
      }));
      askChoices(questions, "絵にする", () => {
        const set = palaceWordSet(seed + 3, 4, palace.loci);
        thinkScene.value = set.scenes[3] as Scene;
        thinkText.value = "";
        phase.value = "think";
        afterInfoStep = () => {
          completeLesson(id);
          showResult("大げさで、動きがあって、場所とからむ絵。これが場所法のいちばんのコツだよ。次は、5個を置いてみよう。");
        };
      });
    };
  } else if (lesson.kind === "order") {
    const count = lesson.count ?? 5;
    if (palace.loci.length < count) {
      showInfo(`この講は${count}か所の宮殿で受けるよ。いまの宮殿は${palace.loci.length}か所。場所を足すか、見本の宮殿（30か所）を使おう。`, "", () => {}, true);
      return;
    }
    const set = palaceWordSet(seed, count, palace.loci);
    const words = set.scenes.map(({ item }) => item.word);
    const pool = set.pool.map(({ word }) => word);
    startStudy(set.scenes as Scene[], { title: lesson.title, hints: Boolean(lesson.hints), tip: lesson.hints ? "目をとじて、その場所にそれがある絵を、大げさに思いうかべてね。" : "絵の文は出ないよ。自分で大げさな絵を作ってね。" }, () => {
      askRecall({ pool, count, prompt: "場所の順に、置いた言葉を押してね。", label: "前から", loci: names }, (answer) => {
        const forward = scoreRecall(words, answer, names);
        const done = (rows: typeof forward.rows) => {
          const extra = lesson.keep ? { lessonWords: { palace: palace.id, words, day: props.day } } : {};
          completeLesson(id, extra);
          const message = praise(forward.score.correct, count) + (lesson.keep ? " この20個は、あしたの講7で思い出すよ。" : "");
          showResult(message, rows);
        };
        if (!lesson.backward) {
          done(forward.rows);
          return;
        }
        askRecall({ pool, count, prompt: "こんどは、いちばん後ろの場所から順に押してね。", label: "後ろから", loci: names, backward: true }, (back) => {
          scoreRecall([...words].reverse(), back, names, true);
          done(forward.rows);
        });
      });
    });
  } else if (lesson.kind === "digits") {
    digitDraft.value = [...props.store.digits];
    phase.value = "digits-setup";
    afterInfoStep = () => {
      emit("save", { digits: [...digitDraft.value] });
      const number = digitNumber(seed, DIGIT_LESSON_LENGTH);
      const list = digitScenes(number, palace.loci, digitDraft.value) as Scene[];
      startStudy(list, { title: "10けたの数", tip: "1か所に2つずつ。2つの絵をぶつけて、1つの場面にしよう。" }, () => {
        askDigits(number, list.map(({ locus }) => locus), "10けたの数", (answer) => {
          const score = scoreDigits(number, answer);
          total = { correct: score.correct, total: score.total };
          completeLesson(id, { digits: [...digitDraft.value] });
          showResult(score.correct === score.total ? `${score.total}けた、全部合ってる！ 電話番号も覚えられそうだね。` : `${score.total}けたのうち${score.correct}けた。2つの絵がぶつかる場面を、大きく思いうかべてね。`, [{ label: "覚えた数", value: number.replace(/(\d{2})(?=\d)/g, "$1 "), ok: score.correct === score.total }]);
        });
      });
    };
  } else if (lesson.kind === "nextday") {
    const state = nextDayState(props.store, props.day);
    if (state === "wait") {
      showInfo("講5で置いた20個は、あした思い出そう。日をあけて思い出すと、長く残るよ。", "", () => {});
      return;
    }
    if (state === "missing") {
      showInfo("講5をもう一度受けると、次の日にここで思い出せるよ。", "", () => {});
      return;
    }
    const entry = props.store.lessonWords!;
    const where = findPalace(props.store, entry.palace) as Palace;
    const lociNames = where.loci.map(({ name }) => name);
    askRecall({ pool: recallPool(seed, entry.words), count: entry.words.length, prompt: `「${where.name}」をたどって、講5で置いた言葉を順に押してね。`, label: "次の日", loci: lociNames }, (answer) => {
      const result = scoreRecall(entry.words, answer, lociNames);
      completeLesson(id);
      showResult(`${recallLabel(entry.day, props.day)}を${result.score.correct}個思い出せた！ 日をあけて思い出すほど、記憶は長く残るよ。`, result.rows);
    });
  } else if (lesson.kind === "two") {
    if (palace.loci.length < 5) return;
    const first = palaceWordSet(seed, 5, palace.loci);
    const firstWords = first.scenes.map(({ item }) => item.word);
    const second = palaceWordSet(seed + 11, 5, palace.loci, firstWords);
    const secondWords = second.scenes.map(({ item }) => item.word);
    showInfo("同じ宮殿に、続けて別のものを置くとどうなるか、ためしてみよう。まず5個。", "はじめる", () => {
      startStudy(first.scenes as Scene[], { title: "1回目", hints: true }, () => {
        askRecall({ pool: first.pool.map(({ word }) => word), count: 5, prompt: "場所の順に押してね。", label: "1回目", loci: names }, (answer) => {
          scoreRecall(firstWords, answer, names);
          showInfo("同じ場所に、すぐ別の5個を置くよ。", "置く", () => {
            startStudy(second.scenes as Scene[], { title: "2回目", hints: true, done: "置いた" }, () => {
              resultRows.value = [];
              const questions = firstWords.map((word, index) => ({
                prompt: `${index + 1}番目の「${names[index]}」に、1回目に置いたのは？`,
                answer: word,
                options: fourChoices(seed + index, word, [secondWords[index], ...firstWords, ...secondWords]),
                label: `${index + 1}. ${names[index]}`,
              }));
              askChoices(questions, "1回目を思い出す", () => {
                const ownCount = props.store.palaces.filter((item) => item.loci.length >= 10).length;
                completeLesson(id);
                showResult(
                  "2回目の絵が、1回目の絵と混ざらなかった？ 同じ宮殿にすぐ置くと混ざりやすい。だから宮殿を2つ作って、日ごとに交互に使おう。",
                  resultRows.value,
                  ownCount < 2,
                );
              });
            });
          });
        });
      });
    });
  } else if (lesson.kind === "use") {
    phase.value = "use-menu";
  }
}

function startUse(kind: "shopping" | "todo" | "names" | "shogi") {
  const palace = activePalace.value;
  if (!palace) return;
  total = { correct: 0, total: 0 };
  resultRows.value = [];
  const seed = seedBase + kind.length * 977;
  const names = palace.loci.map(({ name }) => name);
  const finishUse = (message: string, rows: { label: string; value: string; ok: boolean }[]) => {
    completeLesson("use");
    showResult(message, rows);
  };
  if (kind === "shopping" || kind === "todo") {
    const set = listScenes(seed, kind, palace.loci);
    const words = set.scenes.map(({ item }) => item.word);
    startStudy(set.scenes as Scene[], { title: kind === "todo" ? "やること" : "買い物リスト", hints: true }, () => {
      askRecall({ pool: set.pool, count: words.length, prompt: "場所の順に押してね。", label: "前から", loci: names }, (answer) => {
        const result = scoreRecall(words, answer, names);
        finishUse(kind === "todo" ? "やることを、宮殿にしまえたね。出かける前に、宮殿をひと回りしてみよう。" : "これでメモがなくても買い物できるね。お店で宮殿をたどってみよう。", result.rows);
      });
    });
  } else if (kind === "names") {
    const list = nameScenes(seed, palace.loci);
    startStudy(list as Scene[], { title: "人の名前", hints: true, tip: "名前の音から絵を作ろう（さとう→砂糖）。" }, () => {
      const people = NAME_PEOPLE.map(({ word }) => word);
      askChoices(list.map((sceneItem, index) => ({
        prompt: `${index + 1}番目の「${sceneItem.locus.name}」にいた${sceneItem.person.face}は、だれ？`,
        answer: sceneItem.person.word,
        options: fourChoices(seed + index, sceneItem.person.word, people),
        label: `${index + 1}. ${sceneItem.locus.name}`,
      })), "人の名前", () => finishUse("名前の音を絵にすると、顔と名前が結びつくよ。", resultRows.value));
    });
  } else {
    const moves = shogiScenes(seed, palace.loci, "moves") as Scene[];
    startStudy(moves, { title: "定跡の手順", hints: true }, () => {
      const labels = moves.map(({ item }) => item!.word);
      askChoices(moves.map((sceneItem, index) => ({
        prompt: `${index + 1}番目の「${sceneItem.locus.name}」の手は？`,
        answer: labels[index],
        options: fourChoices(seed + index, labels[index], labels),
        label: `${index + 1}手目`,
      })), "定跡の手順", () => {
        phase.value = "board";
        afterInfoStep = () => {
          const proverbs = shogiScenes(seed + 977, palace.loci, "proverbs") as Scene[];
          startStudy(proverbs, { title: "格言", hints: true }, () => {
            const words = proverbs.map(({ item }) => item!.word);
            askChoices(proverbs.map((sceneItem, index) => ({
              prompt: `${index + 1}番目の「${sceneItem.locus.name}」の格言は？`,
              answer: words[index],
              options: fourChoices(seed + index, words[index], words),
              label: `${index + 1}. ${sceneItem.locus.name}`,
              long: true,
            })), "格言", () => finishUse("定跡の手順も格言も、宮殿にしまえば順番どおりに出てくるね。", resultRows.value));
          });
        };
      });
    });
  }
}

function cycleDigit(digit: number) {
  const choices = DIGIT_CHOICES[digit];
  const index = choices.findIndex(({ word }) => word === digitDraft.value[digit]);
  const next = [...digitDraft.value];
  next[digit] = choices[(index + 1) % choices.length].word;
  digitDraft.value = next;
}

// ===== 毎日の練習 =====

function startPractice() {
  const plan = planPractice(props.store, props.day);
  if (!plan) {
    showInfo("宮殿ができると、毎日の練習ができるよ。", "", () => {}, true);
    return;
  }
  runLesson.value = "practice";
  total = { correct: 0, total: 0 };
  const records: RecordRow[] = [];
  const rows: { label: string; value: string; ok: boolean }[] = [];
  const palace = plan.palace as Palace;
  const names = palace.loci.map(({ name }) => name);
  const patch: Partial<Store> = { lastPalace: palace.id };
  const place = () => {
    const avoid = plan.recall?.words ?? [];
    const set = palaceWordSet(seedBase + 7, plan.count, palace.loci, avoid);
    const words = set.scenes.map(({ item }) => item.word);
    startStudy(set.scenes as Scene[], { title: `「${palace.name}」に${plan.count}個`, tip: "1か所に1つ。大げさで、動きのある絵にしてね。" }, () => {
      askRecall({ pool: set.pool.map(({ word }) => word), count: words.length, prompt: "場所の順に、置いた言葉を押してね。", label: "宮殿に置く", loci: names }, (answer) => {
        const { score } = scoreRecall(words, answer, names);
        const nextCount = nextPracticeCount(plan.count, score.accuracy, palace.loci.length);
        records.push({ gameId: "palace", value: practiceValue(score), level: nextCount, text: `宮殿で${score.correct}個を順番どおり` });
        rows.push({ label: "宮殿に置く", value: `${score.total}個中${score.correct}個`, ok: score.accuracy >= 1 });
        Object.assign(patch, { lastWords: { palace: palace.id, words, day: props.day }, practiceCount: nextCount });
        if (plan.digits) digits();
        else done();
      });
    });
  };
  const digits = () => {
    const number = digitNumber(seedBase + 31, plan.digitCount);
    const list = digitScenes(number, palace.loci, props.store.digits) as Scene[];
    startStudy(list, { title: `数字${plan.digitCount}けた` }, () => {
      askDigits(number, list.map(({ locus }) => locus), `数字${plan.digitCount}けた`, (answer) => {
        const score = scoreDigits(number, answer);
        total = { correct: total.correct + score.correct, total: total.total + score.total };
        const nextCount = nextDigitCount(plan.digitCount, score.accuracy, palace.loci.length);
        records.push({ gameId: "digits", value: score.accuracy >= 0.8 ? score.correct : 0, level: nextCount, text: `数字${score.correct}けた` });
        rows.push({ label: "数字", value: `${score.total}けた中${score.correct}けた`, ok: score.accuracy >= 1 });
        patch.digitCount = nextCount;
        done();
      });
    });
  };
  const done = () => {
    emit("save", patch);
    pending = { kind: "practice", lessonId: "", records, correct: total.correct, total: total.total };
    const all = rows.every(({ ok }) => ok);
    showResult(all ? "全部、順番どおり！ 宮殿がしっかり働いているね。" : "おつかれさま。思い出せなかった場所は、絵をもっと大げさにしてみよう。", rows);
  };
  if (plan.recall) {
    const entry = plan.recall;
    const where = findPalace(props.store, entry.palace) as Palace;
    const lociNames = where.loci.map(({ name }) => name);
    const label = recallLabel(entry.day, props.day);
    askRecall({ pool: recallPool(seedBase + 5, entry.words), count: entry.words.length, prompt: `「${where.name}」をたどって、${label}を順に押してね。`, label, loci: lociNames }, (answer) => {
      const { score } = scoreRecall(entry.words, answer, lociNames);
      records.push({ gameId: "recall", value: score.correct, level: 0, text: `${label}${score.correct}個` });
      rows.push({ label, value: `${score.total}個中${score.correct}個`, ok: score.accuracy >= 1 });
      showInfo(`${label}を${score.correct}個思い出せたね。${where.id === palace.id ? "思い出したから、同じ宮殿に新しく置こう。" : `今日は「${palace.name}」を使うよ。`}`, "つぎへ", place);
    });
  } else {
    place();
  }
}

/** お知らせから戻る。学校から開いたなら学校の入口へ、今日のトレーニングから開いたなら部屋へ。 */
function backToSchool() {
  if (props.mode === "school") phase.value = "school";
  else emit("close");
}

/** 結果のあと。記録を渡し、学校から開いたなら学校の入口へ戻る(部屋へ戻すかは道場の画面が決める)。 */
function finishRun() {
  if (pending) emit("finish", pending);
  pending = null;
  if (props.mode === "school") phase.value = "school";
}

/** 戻る操作。講の途中なら学校の入口へ戻し、真を返す。入口・今日のトレーニングなら偽(部屋へ戻る)。 */
function goBack() {
  if (props.mode === "school" && phase.value !== "school") {
    if (choiceTimer) clearTimeout(choiceTimer);
    phase.value = "school";
    return true;
  }
  return false;
}
defineExpose({ goBack });
</script>

<style>
.shogi-game .brain-palace { width: min(100%, 36rem); }
.shogi-game .brain-palace__using {
  margin: 0;
  min-height: 44px;
  padding: 0.3rem 0.9rem;
  border: 2px solid rgba(255, 252, 244, 0.3);
  border-radius: 999px;
  color: #fffcf4;
  background: transparent;
  font: inherit;
  font-size: 0.9rem;
}
.shogi-game button.brain-palace__using { cursor: pointer; }
.shogi-game .brain-palace__lessons {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
  gap: 0.4rem;
  width: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
}
.shogi-game .brain-palace__scene {
  display: grid;
  justify-items: center;
  gap: 0.6rem;
  width: 100%;
  padding: 1rem;
  border-radius: 0.9rem;
  color: #172632;
  background: #fffcf4;
  text-align: center;
}
.shogi-game .brain-palace__locus { color: #8a4b0f; font-size: 1.15rem; font-weight: 900; }
.shogi-game .brain-palace__locus span { margin-right: 0.3rem; font-size: 1.6rem; }
.shogi-game .brain-palace__item { font-size: 1.9rem; }
.shogi-game .brain-palace__item span { margin-right: 0.3rem; }
.shogi-game .brain-palace__image { margin: 0; font-size: 1.05rem; line-height: 1.6; }
.shogi-game .brain-palace__tip { color: #5d6f7c; }
.shogi-game .brain-palace__digits { display: flex; gap: 1rem; margin: 0; font-size: 1.2rem; font-weight: 800; }
.shogi-game .brain-palace__digits strong { margin-right: 0.2rem; color: #8a4b0f; font-size: 1.6rem; }
.shogi-game .brain-palace__digits span span { margin-right: 0.15rem; }
.shogi-game .brain-palace__choices {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.4rem;
  width: 100%;
}
.shogi-game .brain-palace__choices--long { grid-template-columns: minmax(0, 1fr); }
.shogi-game .brain-palace__tile { padding: 0.3rem 0.8rem; font-size: 1rem; line-height: 1.4; }
.shogi-game .brain-palace__choices--long .brain-palace__tile { text-align: left; font-size: 0.95rem; }
.shogi-game .brain-palace__tile:disabled { opacity: 0.35; }
.shogi-game .brain-palace__choices .brain-palace__tile:disabled { opacity: 1; }
.shogi-game .brain-palace__tile--ok { border-color: #9fe0b4; background: rgba(60, 170, 90, 0.45); }
.shogi-game .brain-palace__tile--miss { border-color: #e58d84; background: rgba(220, 70, 60, 0.45); }
.shogi-game .brain-palace__tips,
.shogi-game .brain-palace__examples {
  display: grid;
  gap: 0.35rem;
  width: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
}
.shogi-game .brain-palace__tips { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.shogi-game .brain-palace__tips li {
  display: grid;
  gap: 0.15rem;
  padding: 0.5rem;
  border-radius: 0.7rem;
  background: #2b465b;
  font-size: 0.85rem;
  text-align: center;
}
.shogi-game .brain-palace__tips strong { color: #f1a54c; font-size: 1rem; }
.shogi-game .brain-palace__examples li {
  padding: 0.45rem 0.7rem;
  border-radius: 0.6rem;
  color: #172632;
  background: #fffcf4;
  line-height: 1.5;
}
.shogi-game .brain-palace__examples li span { margin-right: 0.3rem; }
.shogi-game .brain-palace__think { width: 100%; }
.shogi-game .brain-palace__digit-table {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.35rem;
  width: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
}
.shogi-game .brain-palace__digit-table li { display: flex; align-items: center; gap: 0.5rem; }
.shogi-game .brain-palace__digit-table strong { width: 1.4rem; color: #f1a54c; font-size: 1.3rem; text-align: center; }
.shogi-game .brain-palace__digit-table .brain-palace__tile { flex: 1; min-height: 48px; }
.shogi-game .brain-palace__digit-answer {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.35rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.shogi-game .brain-palace__digit-answer li {
  display: grid;
  justify-items: center;
  min-width: 4.2rem;
  padding: 0.25rem 0.4rem;
  border: 2px solid transparent;
  border-radius: 0.6rem;
  color: #172632;
  background: #fffcf4;
}
.shogi-game .brain-palace__digit-answer small { max-width: 5rem; overflow: hidden; color: #5d6f7c; font-size: 0.68rem; text-overflow: ellipsis; white-space: nowrap; }
.shogi-game .brain-palace__digit-answer strong { font-size: 1.3rem; letter-spacing: 0.1em; }
.shogi-game .brain-palace__digit-answer .brain-palace__digit-answer--now { border-color: #d9822b; }
.shogi-game .brain-palace__review {
  display: grid;
  gap: 0.25rem;
  width: 100%;
  max-height: 40vh;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}
.shogi-game .brain-palace__review li {
  display: flex;
  justify-content: space-between;
  gap: 0.6rem;
  padding: 0.3rem 0.7rem;
  border-radius: 0.5rem;
  background: #2b465b;
}
.shogi-game .brain-palace__review--ok { border-left: 4px solid #9fe0b4; }
.shogi-game .brain-palace__review--miss { border-left: 4px solid #e58d84; }
@media (max-width: 420px) {
  .shogi-game .brain-palace__tips { grid-template-columns: minmax(0, 1fr); }
}
</style>
