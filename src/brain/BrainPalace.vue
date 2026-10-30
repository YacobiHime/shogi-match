<template>
  <!--
    記憶の宮殿(場所法)の学校(docs/brain-training-design.mdの3-4)。お城の場所に、覚えるものを大げさな絵にして置き、
    場所をたどって思い出す。講を順に受けて方法を覚え、毎日の練習で言葉の数を伸ばす。
  -->
  <section class="brain-game brain-palace" aria-label="記憶の宮殿" data-brain-palace>
    <!-- 学校の入口。お城の明かりと、講の道と、毎日の練習。 -->
    <template v-if="phase === 'school'">
      <p class="brain-game__prompt">{{ schoolMessage }}</p>
      <ol class="brain-palace__castle" aria-label="お城の場所">
        <li
          v-for="(locus, index) in CASTLE_LOCI"
          :key="locus.name"
          :class="{ 'brain-palace__room--lit': index < lit }"
          :title="locus.name"
        ><span aria-hidden="true">{{ index < lit ? locus.emoji : "・" }}</span></li>
      </ol>
      <ol class="brain-palace__lessons">
        <li v-for="(lesson, index) in PALACE_LESSONS" :key="lesson.id">
          <button
            type="button"
            class="shogi-brain__card"
            :disabled="!lessonUnlocked(lessons, lesson.id)"
            :data-palace-lesson="lesson.id"
            @click="startLesson(lesson.id)"
          >
            <strong>{{ index + 1 }}. {{ lesson.title }}</strong>
            <small>{{ lesson.goal }}</small>
            <span class="shogi-brain__card-tag">{{ lessons.includes(lesson.id) ? "✓ 終えた" : lessonUnlocked(lessons, lesson.id) ? "" : "🔒" }}</span>
          </button>
        </li>
      </ol>
      <button
        type="button"
        class="shogi-brain__today"
        :disabled="!practiceOpen(lessons)"
        data-palace-practice
        @click="startPractice"
      >
        <span class="shogi-brain__today-eyebrow">毎日の練習</span>
        <strong>言葉{{ practiceCount }}個を覚える</strong>
        <small>{{ practiceOpen(lessons) ? `宮殿：${customLoci.length >= 10 ? "自分の宮殿" : "やこび姫のお城"}` : "「場所に置いてみよう」を終えると開くよ" }}</small>
      </button>
    </template>

    <!-- 覚える: 場所を1つずつたどる。 -->
    <template v-else-if="phase === 'study'">
      <p class="brain-game__status"><span>{{ studyIndex + 1 }} / {{ scenes.length }}</span><span>{{ stageTitle }}</span></p>
      <div class="brain-palace__scene" data-palace-scene>
        <span class="brain-palace__locus"><span aria-hidden="true">{{ scenes[studyIndex].locus.emoji }}</span>{{ studyIndex + 1 }}. {{ scenes[studyIndex].locus.name }}</span>
        <template v-if="scenes[studyIndex].item">
          <strong class="brain-palace__item">
            <span v-if="showHints" aria-hidden="true">{{ scenes[studyIndex].item.emoji }}</span>{{ scenes[studyIndex].item.word }}
          </strong>
          <p class="brain-palace__image">{{ scenes[studyIndex].image }}</p>
          <small v-if="studyIndex === 0 && showHints" class="brain-palace__tip">目をとじて、その場所にそれがある絵を、大げさに思いうかべてね。</small>
        </template>
      </div>
      <div class="brain-game__actions">
        <button v-if="studyIndex > 0" type="button" class="brain-game__secondary" @click="studyIndex -= 1">もどる</button>
        <button type="button" class="brain-game__primary" data-palace-next @click="nextStudy">{{ studyIndex + 1 >= scenes.length ? "思い出す" : "つぎの場所へ" }}</button>
      </div>
    </template>

    <!-- 思い出す(順に押す): 札から、場所の順に押す。 -->
    <template v-else-if="phase === 'order'">
      <p class="brain-game__status"><span>{{ orderAnswer.length }} / {{ orderExpected.length }}</span><span>{{ backward ? "後ろから" : "前から" }}</span></p>
      <p class="brain-game__prompt">{{ orderPrompt }}</p>
      <ul class="brain-palace__pool">
        <li v-for="(word, index) in orderPool" :key="`${word}-${index}`">
          <button
            type="button"
            class="brain-glance__choice brain-palace__tile"
            :disabled="orderAnswer.includes(word)"
            :data-palace-word="word"
            @click="pushOrder(word)"
          >{{ word }}</button>
        </li>
      </ul>
      <div class="brain-game__actions">
        <button type="button" class="brain-game__secondary" :disabled="!orderAnswer.length" @click="orderAnswer = orderAnswer.slice(0, -1)">1つ消す</button>
      </div>
    </template>

    <!-- 思い出す(4択): 場所ごとに、何があったかを選ぶ。 -->
    <template v-else-if="phase === 'choice'">
      <p class="brain-game__status"><span>{{ choiceIndex + 1 }} / {{ choiceQuestions.length }}</span><span>{{ stageTitle }}</span></p>
      <p class="brain-game__prompt">
        <span aria-hidden="true">{{ choiceQuestions[choiceIndex].locus.emoji }}</span>
        {{ choiceQuestions[choiceIndex].number }}番目の「{{ choiceQuestions[choiceIndex].locus.name }}」には、何があった？
      </p>
      <div class="brain-palace__choices">
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

    <!-- 場所の順番クイズ(講1): お城の場所を、道順に押す。 -->
    <template v-else-if="phase === 'walk-quiz'">
      <p class="brain-game__prompt">門から順に、場所を押してね。（{{ walkAnswer.length }} / {{ walkLoci.length }}）</p>
      <ul class="brain-palace__pool">
        <li v-for="locus in walkPool" :key="locus.name">
          <button
            type="button"
            class="brain-glance__choice brain-palace__tile"
            :class="{ 'brain-palace__tile--miss': walkMiss === locus.name }"
            :disabled="walkAnswer.includes(locus.name)"
            :data-palace-locus="locus.name"
            @click="pushWalk(locus.name)"
          ><span aria-hidden="true">{{ locus.emoji }}</span> {{ locus.name }}</button>
        </li>
      </ul>
    </template>

    <!-- 自分の宮殿を作る(講5)。 -->
    <template v-else-if="phase === 'custom'">
      <p class="brain-game__prompt">家や学校で、毎日通る道順の場所を、順に書いてね（10か所以上）。</p>
      <ol class="brain-palace__custom">
        <li v-for="(_, index) in customDraft" :key="index">
          <input v-model="customDraft[index]" type="text" maxlength="20" :aria-label="`${index + 1}番目の場所`" :placeholder="CUSTOM_EXAMPLES[index] ?? ''" :data-palace-custom="index">
        </li>
      </ol>
      <div class="brain-game__actions">
        <button v-if="customDraft.length < PRACTICE_MAX" type="button" class="brain-game__secondary" @click="customDraft.push('')">場所を足す</button>
        <button type="button" class="brain-game__primary" data-palace-custom-save @click="saveCustom">{{ cleanCustomLoci(customDraft).length >= 10 ? "この宮殿を使う" : "お城を使う" }}</button>
      </div>
    </template>

    <!-- 将棋の講の途中で、覚えた手順の完成形を盤で見せる。 -->
    <template v-else-if="phase === 'board'">
      <p class="brain-game__prompt">覚えた8手で、四間飛車と美濃囲いができたよ！</p>
      <BrainBoard :pieces="formationPieces" label="四間飛車と美濃囲い" />
      <div class="brain-game__actions">
        <button type="button" class="brain-game__primary" data-palace-next @click="startProverbs">つぎは格言</button>
      </div>
    </template>

    <!-- 講や練習の結果。 -->
    <template v-else-if="phase === 'result'">
      <p class="brain-game__prompt">{{ resultMessage }}</p>
      <ol v-if="resultRows.length" class="brain-palace__review">
        <li v-for="row in resultRows" :key="row.number" :class="row.ok ? 'brain-palace__review--ok' : 'brain-palace__review--miss'">
          <span>{{ row.number }}. {{ row.locus }}</span><strong>{{ row.word }}</strong>
        </li>
      </ol>
      <div class="brain-game__actions">
        <button type="button" class="brain-game__primary" data-brain-next @click="finishRun">{{ mode === "practice" ? "結果を見る" : "学校へ戻る" }}</button>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, type PropType } from "vue";
import BrainBoard from "./BrainBoard.vue";
import {
  CASTLE_LOCI,
  PALACE_LESSONS,
  PRACTICE_MAX,
  PRACTICE_MIN,
  cleanCustomLoci,
  fourChoices,
  lessonUnlocked,
  litLoci,
  nextPracticeCount,
  palaceLoci,
  palaceWordSet,
  practiceOpen,
  practiceValue,
  scoreOrder,
  shogiScenes,
} from "../core/memory-palace.mjs";
import { openingFormation } from "../core/opening-formation.mjs";

type Locus = { name: string; emoji: string };
type Scene = { locus: Locus; item: { word: string; emoji: string } | null; image: string };
type Question = { number: number; locus: Locus; answer: string; options: string[] };

const props = defineProps({
  /** school(学校の入口から)か、practice(今日の3種目から、毎日の練習だけ)。 */
  mode: { type: String as PropType<"school" | "practice">, default: "school" },
  lessons: { type: Array as PropType<string[]>, default: () => [] },
  custom: { type: Array as PropType<string[]>, default: () => [] },
  /** 毎日の練習の言葉の数。 */
  practiceCount: { type: Number, default: PRACTICE_MIN },
});
const emit = defineEmits<{
  (event: "finish", result: { value: number; level: number; correct: number; total: number }): void;
  (event: "save", palace: { lessons: string[]; custom: string[] }): void;
  (event: "sound", kind: "correct" | "miss" | "place"): void;
}>();

const CUSTOM_EXAMPLES = ["玄関", "くつ箱", "ろうか", "トイレ", "おふろ", "台所", "冷蔵庫", "テーブル", "テレビ", "ソファ"];

const phase = ref<"school" | "study" | "order" | "choice" | "walk-quiz" | "custom" | "board" | "result">(props.mode === "practice" ? "study" : "school");
const lessonId = ref<string>(props.mode === "practice" ? "practice" : "");
const scenes = ref<Scene[]>([]);
const studyIndex = ref(0);
const showHints = ref(false);
const stageTitle = ref("");
// 順に押す
const orderExpected = ref<string[]>([]);
const orderPool = ref<string[]>([]);
const orderAnswer = ref<string[]>([]);
const backward = ref(false);
const orderPrompt = ref("");
// 4択
const choiceQuestions = ref<Question[]>([]);
const choiceIndex = ref(0);
const choiceFeedback = ref("");
// 講1
const walkLoci = ref<Locus[]>([]);
const walkPool = ref<Locus[]>([]);
const walkAnswer = ref<string[]>([]);
const walkMiss = ref("");
let walkMistakes = 0;
// 自分の宮殿
const customDraft = ref<string[]>([]);
// 結果
const resultMessage = ref("");
const resultRows = ref<{ number: number; locus: string; word: string; ok: boolean }[]>([]);
const total = ref({ correct: 0, total: 0 });
let afterStudy: () => void = () => {};
const seedBase = Math.floor(Math.random() * 1e9);

const lit = computed(() => litLoci(props.lessons));
const customLoci = computed(() => cleanCustomLoci(props.custom));
const loci = computed(() => palaceLoci(customLoci.value) as Locus[]);
const formationPieces = computed(() => openingFormation("shiken", "mino").pieces.map(({ square, kind }) => ({ square, kind, color: "black" })));
const schoolMessage = computed(() => (
  props.lessons.length >= PALACE_LESSONS.length
    ? "全部の講を終えたね！ 毎日の練習で、覚えられる数を伸ばそう。"
    : "場所法は、よく知っている道順の場所に、覚えたいものを置いていく覚え方。順番に講を受けよう。"
));

if (props.mode === "practice") startPractice();

function startStudy(list: Scene[], title: string, hints: boolean, then: () => void) {
  scenes.value = list;
  studyIndex.value = 0;
  showHints.value = hints;
  stageTitle.value = title;
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

function startLesson(id: string) {
  const lesson = PALACE_LESSONS.find((item) => item.id === id);
  if (!lesson || !lessonUnlocked(props.lessons, id)) return;
  lessonId.value = id;
  total.value = { correct: 0, total: 0 };
  resultRows.value = [];
  const seed = seedBase + id.length * 131;
  if (lesson.kind === "walk") {
    walkLoci.value = CASTLE_LOCI.slice(0, lesson.count) as Locus[];
    startStudy(walkLoci.value.map((locus) => ({ locus, item: null, image: "" })), lesson.title, false, () => {
      walkPool.value = shuffle([...walkLoci.value], seed);
      walkAnswer.value = [];
      walkMistakes = 0;
      phase.value = "walk-quiz";
    });
  } else if (lesson.kind === "choice" || lesson.kind === "jump") {
    const set = palaceWordSet(seed, lesson.count, loci.value);
    startStudy(set.scenes as Scene[], lesson.title, Boolean(lesson.hints), () => {
      const words = set.scenes.map((sceneItem) => sceneItem.item.word);
      const others = [...words, ...set.distractors.map(({ word }) => word)];
      const order = lesson.kind === "jump" ? shuffle(set.scenes.map((_, index) => index), seed).slice(0, 5) : set.scenes.map((_, index) => index);
      askChoices(order.map((index) => ({ number: index + 1, locus: set.scenes[index].locus as Locus, answer: words[index], options: fourChoices(seed + index, words[index], others) })), lesson.title);
    });
  } else if (lesson.kind === "order") {
    const set = palaceWordSet(seed, lesson.count, loci.value);
    startStudy(set.scenes as Scene[], lesson.title, Boolean(lesson.hints), () => {
      const words = set.scenes.map((sceneItem) => sceneItem.item.word);
      askOrder(words, set.pool.map(({ word }) => word), false, () => askOrder([...words].reverse(), set.pool.map(({ word }) => word), true, () => showResult()));
    });
  } else if (lesson.kind === "custom") {
    const current = [...customLoci.value];
    while (current.length < 10) current.push("");
    customDraft.value = current;
    phase.value = "custom";
  } else if (lesson.kind === "shogi") {
    const moves = shogiScenes(seed, loci.value, "moves") as Scene[];
    startStudy(moves, "定跡の手順", false, () => {
      const labels = moves.map((sceneItem) => sceneItem.item!.word);
      askChoices(moves.map((sceneItem, index) => ({ number: index + 1, locus: sceneItem.locus, answer: labels[index], options: fourChoices(seed + index, labels[index], labels) })), "定跡の手順", () => {
        phase.value = "board";
      });
    });
  }
}
function startProverbs() {
  const seed = seedBase + 977;
  const proverbs = shogiScenes(seed, loci.value, "proverbs") as Scene[];
  startStudy(proverbs, "格言", false, () => {
    const words = proverbs.map((sceneItem) => sceneItem.item!.word);
    askChoices(proverbs.map((sceneItem, index) => ({ number: index + 1, locus: sceneItem.locus, answer: words[index], options: fourChoices(seed + index, words[index], words) })), "格言");
  });
}

function startPractice() {
  if (!practiceOpen(props.lessons)) return;
  lessonId.value = "practice";
  total.value = { correct: 0, total: 0 };
  resultRows.value = [];
  const count = Math.min(props.practiceCount, loci.value.length);
  const set = palaceWordSet(seedBase + 7, count, loci.value);
  startStudy(set.scenes as Scene[], "毎日の練習", false, () => {
    askOrder(set.scenes.map((sceneItem) => sceneItem.item.word), set.pool.map(({ word }) => word), false, () => showResult());
  });
}

let afterOrder: () => void = () => {};
function askOrder(expected: string[], pool: string[], fromBack: boolean, then: () => void) {
  orderExpected.value = expected;
  orderPool.value = pool;
  orderAnswer.value = [];
  backward.value = fromBack;
  orderPrompt.value = fromBack ? "こんどは、いちばん後ろの場所から順に押してね。" : "場所の順に、置いた言葉を押してね。";
  afterOrder = then;
  phase.value = "order";
}
function pushOrder(word: string) {
  orderAnswer.value = [...orderAnswer.value, word];
  emit("sound", "place");
  if (orderAnswer.value.length < orderExpected.value.length) return;
  const score = scoreOrder(orderExpected.value, orderAnswer.value);
  total.value = { correct: total.value.correct + score.correct, total: total.value.total + score.total };
  const count = orderExpected.value.length;
  const rows = orderExpected.value.map((word, index) => {
    const number = backward.value ? count - index : index + 1;
    return { number, locus: loci.value[number - 1]?.name ?? "", word, ok: score.positions[index] };
  });
  resultRows.value = backward.value ? resultRows.value : rows;
  afterOrder();
}

let afterChoices: (() => void) | null = null;
function askChoices(questions: Question[], title: string, then: (() => void) | null = null) {
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
  total.value = { correct: total.value.correct + (ok ? 1 : 0), total: total.value.total + 1 };
  resultRows.value = [...resultRows.value, { number: question.number, locus: question.locus.name, word: question.answer, ok }];
  emit("sound", ok ? "correct" : "miss");
  setTimeout(() => {
    choiceFeedback.value = "";
    if (choiceIndex.value + 1 < choiceQuestions.value.length) {
      choiceIndex.value += 1;
      return;
    }
    if (afterChoices) {
      const next = afterChoices;
      afterChoices = null;
      next();
    } else showResult();
  }, ok ? 500 : 1100);
}

function pushWalk(name: string) {
  const expected = walkLoci.value[walkAnswer.value.length]?.name;
  if (name !== expected) {
    walkMistakes += 1;
    walkMiss.value = name;
    emit("sound", "miss");
    setTimeout(() => { walkMiss.value = ""; }, 500);
    return;
  }
  walkAnswer.value = [...walkAnswer.value, name];
  emit("sound", "place");
  if (walkAnswer.value.length >= walkLoci.value.length) {
    total.value = { correct: walkLoci.value.length, total: walkLoci.value.length + walkMistakes };
    resultRows.value = [];
    resultMessage.value = walkMistakes
      ? `10か所の道順を覚えたね（まちがい${walkMistakes}回）。この道順が、これからの宮殿だよ。`
      : "10か所、まちがえずにたどれた！ この道順が、これからの宮殿だよ。";
    clearLesson();
    phase.value = "result";
  }
}

function saveCustom() {
  const names = cleanCustomLoci(customDraft.value);
  emit("save", { lessons: withLesson("custom"), custom: names.length >= 10 ? names : [] });
  resultRows.value = [];
  resultMessage.value = names.length >= 10
    ? `${names.length}か所の自分の宮殿ができたよ。毎日の練習は、この宮殿で覚えよう。`
    : "お城の宮殿のまま続けよう。自分の宮殿は、いつでもここで作れるよ。";
  phase.value = "result";
}

function showResult() {
  const { correct, total: count } = total.value;
  if (lessonId.value === "practice") {
    resultMessage.value = correct === count ? `${count}個、全部順番どおり！` : `${count}個のうち${correct}個を思い出せたよ。`;
  } else {
    resultMessage.value = correct === count
      ? "全部思い出せた！ 場所をたどると、ちゃんと出てくるでしょ？"
      : `${count}問のうち${correct}問。場所をもう一度たどると、思い出せることが多いよ。`;
    clearLesson();
  }
  phase.value = "result";
}

function withLesson(id: string) {
  return props.lessons.includes(id) ? [...props.lessons] : [...props.lessons, id];
}
function clearLesson() {
  if (lessonId.value && lessonId.value !== "practice" && lessonId.value !== "custom") {
    emit("save", { lessons: withLesson(lessonId.value), custom: [...props.custom] });
  }
}

function finishRun() {
  if (lessonId.value === "practice") {
    const { correct, total: count } = total.value;
    const score = { correct, total: count, accuracy: count ? correct / count : 0 };
    emit("finish", { value: practiceValue(score), level: nextPracticeCount(count, score.accuracy, loci.value.length), correct, total: count });
    return;
  }
  phase.value = "school";
}

function shuffle<T>(list: T[], seed: number): T[] {
  const copy = [...list];
  let state = seed >>> 0;
  for (let index = copy.length - 1; index > 0; index -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const swap = state % (index + 1);
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

/** 戻る操作。講の途中なら学校の入口へ戻し、真を返す。入口なら偽(道場へ戻る)。 */
function goBack() {
  if (props.mode === "school" && phase.value !== "school") {
    phase.value = "school";
    return true;
  }
  return false;
}
defineExpose({ goBack });
</script>
