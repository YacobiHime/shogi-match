<template>
  <!--
    場所法の実用コース「モールス信号」(docs/brain-training-design.mdの17章)。
    語呂(頭文字がその文字で、拍ごとに言うと符号のリズムになる言葉)を宮殿のA=1か所目…に置き、場所から符号を打つ・音で当てる・言葉を読む。
  -->
  <section class="brain-game brain-morse" :class="{ 'brain-morse--talk': phase === 'talk' }" aria-label="モールス信号" data-brain-morse>
    <!-- コースの札 -->
    <template v-if="phase === 'home'">
      <div class="brain-morse__card" data-morse-home>
        <p class="brain-morse__title"><span aria-hidden="true">📡</span> モールス信号（A〜Z）</p>
        <p class="brain-morse__lead">語呂と場所法で、26文字の符号を覚えよう。伸ばす音が「ツー」、ほかの1音が「トン」。</p>
        <ol class="brain-morse__road" aria-label="コースの道">
          <li v-for="(letters, index) in MORSE_SESSIONS" :key="index">
            <button
              type="button"
              class="brain-morse__stone"
              :class="{ 'brain-morse__stone--done': index < progress.done, 'brain-morse__stone--now': index === progress.done }"
              :disabled="index > progress.done"
              :data-morse-session="index + 1"
              @click="startSession(index + 1)"
            >
              <strong>回{{ index + 1 }}</strong><small>{{ letters[0] }}〜{{ letters[letters.length - 1] }}</small>
            </button>
          </li>
          <li>
            <span class="brain-morse__stone brain-morse__stone--review" :class="{ 'brain-morse__stone--done': plan.kind === 'mastered', 'brain-morse__stone--now': plan.kind === 'review' }">
              <strong>おさらい</strong><small>{{ reviewStones }}</small>
            </span>
          </li>
        </ol>
        <p class="brain-morse__meta">
          <span>覚えた文字 <b>{{ progress.known.length }}</b>/26</span>
          <span>置く宮殿：{{ palace.name }}</span>
        </p>
        <p v-if="homeNote" class="brain-morse__note">{{ homeNote }}</p>
        <button type="button" class="brain-morse__talk" :disabled="!talkOpen" data-morse-talk @click="openTalk">
          <span aria-hidden="true">📻</span>
          <span class="brain-morse__talk-body"><strong>無線で話す</strong><small>{{ talkOpen ? "覚えた符号を打って、やこび姫と話そう" : "回3を終えると開く" }}</small></span>
        </button>
      </div>
      <div class="brain-game__actions">
        <button v-if="plan.kind === 'session'" type="button" class="brain-game__primary" data-morse-start @click="startSession(plan.number)">回{{ plan.number }}をはじめる（{{ plan.letters[0] }}〜{{ plan.letters[plan.letters.length - 1] }}）</button>
        <button v-else type="button" class="brain-game__primary" data-morse-review @click="startReview">{{ plan.kind === 'review' && plan.due ? "おさらいをする" : "練習する（段は進まない）" }}</button>
        <button type="button" class="brain-game__secondary" data-morse-table @click="phase = 'table'">符号の表</button>
      </div>
    </template>

    <!-- 決まりの1枚(回1の始め。チーズケーキの例を音つきで) -->
    <template v-else-if="phase === 'rule'">
      <p class="brain-game__prompt">言葉を拍ごとに言うと、そのまま符号になるよ。</p>
      <div class="brain-morse__scene" data-morse-rule>
        <p class="brain-morse__rule"><b class="brain-morse__mark brain-morse__mark--dash" aria-hidden="true"></b>伸ばす音（ー）＝ツー<b class="brain-morse__mark brain-morse__mark--dot" aria-hidden="true"></b>ほかの1音＝トン</p>
        <strong class="brain-morse__letter">C</strong>
        <ol class="brain-morse__beats" aria-label="チー・ズ・ケー・キ">
          <li v-for="(beat, index) in RULE_WORD.chant" :key="index" :class="{ 'brain-morse__beat--lit': lit === index }">
            <span>{{ beat }}</span>
            <b class="brain-morse__mark" :class="isLongBeat(beat) ? 'brain-morse__mark--dash' : 'brain-morse__mark--dot'" aria-hidden="true"></b>
          </li>
        </ol>
        <p class="brain-morse__word"><span aria-hidden="true">{{ RULE_WORD.emoji }}</span>{{ RULE_WORD.word }}<small>{{ RULE_WORD.initial }}</small></p>
        <p class="brain-morse__image">宮殿の3か所目にチーズケーキを置けば、「3番目＝C＝ツー・トン・ツー・トン」が、いっぺんに思い出せるよ。</p>
        <button type="button" class="brain-morse__play" data-morse-play @click="play(MORSE_CODES.C)"><span aria-hidden="true">♪</span> 鳴らす</button>
      </div>
      <div class="brain-game__actions">
        <button type="button" class="brain-game__primary" data-morse-next @click="advance">やってみる</button>
      </div>
    </template>

    <!-- 置く: 文字の番号の場所に、語呂の絵 -->
    <template v-else-if="phase === 'study' && scene">
      <p class="brain-game__status"><span>{{ studyIndex + 1 }} / {{ scenes.length }}</span><span>置く</span></p>
      <div class="brain-morse__scene" data-morse-scene>
        <span class="brain-morse__locus"><b aria-hidden="true">{{ scene.locus.emoji }}</b>{{ scene.index + 1 }}か所目 {{ scene.locus.name }}</span>
        <strong class="brain-morse__letter">{{ scene.letter }}</strong>
        <ol class="brain-morse__beats" :aria-label="scene.word.chant.join('・')">
          <li v-for="(beat, index) in scene.word.chant" :key="index" :class="{ 'brain-morse__beat--lit': lit === index }">
            <span>{{ beat }}</span>
            <b class="brain-morse__mark" :class="isLongBeat(beat) ? 'brain-morse__mark--dash' : 'brain-morse__mark--dot'" aria-hidden="true"></b>
          </li>
        </ol>
        <p class="brain-morse__word"><span aria-hidden="true">{{ scene.word.emoji }}</span>{{ scene.word.word }}<small>{{ scene.word.initial }}</small></p>
        <p class="brain-morse__image">{{ scene.image }}</p>
        <button type="button" class="brain-morse__play" data-morse-play @click="play(scene.code)"><span aria-hidden="true">♪</span> もう一度鳴らす</button>
      </div>
      <div class="brain-game__actions">
        <button v-if="studyIndex > 0" type="button" class="brain-game__secondary" @click="showStudy(studyIndex - 1)">もどる</button>
        <button type="button" class="brain-game__primary" data-morse-next @click="nextStudy">{{ studyIndex + 1 >= scenes.length ? "思い出してみる" : "思いうかべた → 次へ" }}</button>
      </div>
    </template>

    <!-- 場所から符号を打つ -->
    <template v-else-if="phase === 'code' && codeLetter">
      <p class="brain-game__status"><span>{{ codeIndex + 1 }} / {{ codeLetters.length }}</span><span>場所から符号</span></p>
      <div class="brain-morse__scene" data-morse-code>
        <span class="brain-morse__locus"><b aria-hidden="true">{{ codeLocus?.emoji }}</b>{{ letterIndex(codeLetter) + 1 }}か所目 {{ codeLocus?.name }}</span>
        <strong class="brain-morse__letter">{{ codeLetter }}</strong>
        <p class="brain-morse__ask">{{ codeFeedback ? codeFeedbackText : "置いた絵を思い出して、トン・ツーを押そう。" }}</p>
        <p class="brain-morse__input" :class="{ 'brain-morse__input--ok': codeFeedback === 'ok', 'brain-morse__input--miss': codeFeedback === 'miss' }" aria-live="polite" data-morse-input>
          <b v-for="(mark, index) in codeInput" :key="index" class="brain-morse__mark" :class="mark === '-' ? 'brain-morse__mark--dash' : 'brain-morse__mark--dot'"></b>
          <span v-if="!codeInput" class="brain-morse__placeholder">・・・</span>
        </p>
        <p v-if="codeFeedback === 'miss'" class="brain-morse__answer">
          正しくは <span class="brain-morse__marks">{{ morseMarks(MORSE_CODES[codeLetter]) }}</span>（{{ morseWord(codeLetter)?.chant.join("・") }}）
        </p>
      </div>
      <div v-if="!codeFeedback" class="brain-morse__keys" role="group" aria-label="トンとツー">
        <button type="button" class="brain-morse__key" data-morse-dot :disabled="codeInput.length >= 4" @click="pushMark('.')"><b class="brain-morse__mark brain-morse__mark--dot" aria-hidden="true"></b>トン</button>
        <button type="button" class="brain-morse__key" data-morse-dash :disabled="codeInput.length >= 4" @click="pushMark('-')"><b class="brain-morse__mark brain-morse__mark--dash" aria-hidden="true"></b>ツー</button>
        <button type="button" class="brain-morse__key brain-morse__key--sub" data-morse-erase :disabled="!codeInput" @click="codeInput = codeInput.slice(0, -1)">消す</button>
        <button type="button" class="brain-morse__key brain-morse__key--submit" data-morse-submit :disabled="!codeInput" @click="submitCode">決める</button>
      </div>
      <div v-else class="brain-game__actions">
        <button type="button" class="brain-game__primary" data-morse-next @click="nextCode">つぎへ</button>
      </div>
    </template>

    <!-- 聞いて当てる(回の始めのおさらい・回の終わり・全部のおさらい) -->
    <template v-else-if="phase === 'listen' && question">
      <p class="brain-game__status"><span>{{ listenIndex + 1 }} / {{ questions.length }}</span><span>{{ listenTitle }}</span></p>
      <div class="brain-morse__scene" data-morse-listen>
        <button type="button" class="brain-morse__speaker" data-morse-play :aria-label="'もう一度聞く'" @click="play(question.code)">
          <span aria-hidden="true">♪</span>
          <span class="brain-morse__marks brain-morse__marks--live">
            <b v-for="(mark, index) in question.code" :key="index" class="brain-morse__mark" :class="[mark === '-' ? 'brain-morse__mark--dash' : 'brain-morse__mark--dot', { 'brain-morse__mark--hidden': !showMarks && !listenFeedback, 'brain-morse__mark--lit': lit === index }]"></b>
          </span>
          <small>{{ listenFeedback ? listenFeedbackText : "押すと、もう一度鳴るよ" }}</small>
        </button>
        <button v-if="!showMarks && !listenFeedback" type="button" class="brain-morse__peek" data-morse-peek @click="showMarks = true">符号を見る</button>
      </div>
      <div class="brain-morse__options">
        <button
          v-for="(option, index) in question.options"
          :key="option"
          type="button"
          class="brain-morse__option"
          :class="{ 'brain-morse__option--ok': listenFeedback && option === question.letter, 'brain-morse__option--miss': listenFeedback === option && option !== question.letter }"
          :disabled="Boolean(listenFeedback)"
          :data-morse-option="option"
          @click="answerListen(option)"
        ><small aria-hidden="true">{{ index + 1 }}</small>{{ option }}</button>
      </div>
    </template>

    <!-- 読む(SOS・SHOGI) -->
    <template v-else-if="phase === 'read' && readWord">
      <p class="brain-game__status"><span>{{ readWordIndex + 1 }} / {{ MORSE_READ_WORDS.length }}</span><span>読む</span></p>
      <div class="brain-morse__scene" data-morse-read>
        <p class="brain-morse__ask">音を聞いて、1文字ずつ読もう。</p>
        <p class="brain-morse__slots" :aria-label="`${readWord.word.length}文字の言葉`">
          <span v-for="(letter, index) in readWord.word" :key="index" class="brain-morse__slot" :class="{ 'brain-morse__slot--now': index === readLetterIndex && !readDone, 'brain-morse__slot--miss': readMisses.includes(index) }">{{ index < readLetterIndex || readDone ? letter : "" }}</span>
        </p>
        <p v-if="readDone" class="brain-morse__reveal" data-morse-reveal><strong>{{ readWord.word }}</strong>＝{{ readWord.meaning }}って読めた！</p>
        <button v-else-if="readQuestion" type="button" class="brain-morse__speaker brain-morse__speaker--small" data-morse-play aria-label="もう一度聞く" @click="play(readQuestion.code)">
          <span aria-hidden="true">♪</span>
          <span class="brain-morse__marks brain-morse__marks--live">
            <b v-for="(mark, index) in readQuestion.code" :key="index" class="brain-morse__mark" :class="[mark === '-' ? 'brain-morse__mark--dash' : 'brain-morse__mark--dot', { 'brain-morse__mark--hidden': !showMarks && !readFeedback, 'brain-morse__mark--lit': lit === index }]"></b>
          </span>
        </button>
        <button v-if="!readDone && !showMarks && !readFeedback" type="button" class="brain-morse__peek" data-morse-peek @click="showMarks = true">符号を見る</button>
      </div>
      <div v-if="!readDone && readQuestion" class="brain-morse__options">
        <button
          v-for="(option, index) in readQuestion.options"
          :key="option"
          type="button"
          class="brain-morse__option"
          :class="{ 'brain-morse__option--ok': readFeedback && option === readQuestion.letter, 'brain-morse__option--miss': readFeedback === option && option !== readQuestion.letter }"
          :disabled="Boolean(readFeedback)"
          :data-morse-option="option"
          @click="answerRead(option)"
        ><small aria-hidden="true">{{ index + 1 }}</small>{{ option }}</button>
      </div>
      <div v-else class="brain-game__actions">
        <button type="button" class="brain-game__primary" data-morse-next @click="nextReadWord">{{ readWordIndex + 1 < MORSE_READ_WORDS.length ? "つぎの言葉" : "結果を見る" }}</button>
      </div>
    </template>

    <!-- 結果 -->
    <template v-else-if="phase === 'result'">
      <p class="brain-game__prompt" data-morse-result>{{ resultMessage }}</p>
      <ol class="brain-morse__rows">
        <li v-for="row in resultRows" :key="row.label"><span>{{ row.label }}</span><strong>{{ row.correct }}/{{ row.total }}</strong></li>
      </ol>
      <p v-if="resultNext" class="brain-morse__note">{{ resultNext }}</p>
      <div class="brain-game__actions">
        <button type="button" class="brain-game__primary" data-brain-next @click="finishRun">成績表へ</button>
      </div>
    </template>

    <!-- 無線で話す(18章) -->
    <BrainMorseTalk v-else-if="phase === 'talk'" ref="talkView" :courses="courses" @save="(talk) => emit('save', { ...courses, talk })" @finish="(result) => emit('finish', result)" />

    <!-- 符号の表(置いた文字だけ。まだの文字は「？」。D:5-1 存在だけ見せる) -->
    <template v-else-if="phase === 'table'">
      <p class="brain-game__prompt">覚えた文字は、ここでいつでも見返せるよ。</p>
      <ol class="brain-morse__table" data-morse-table-view>
        <li v-for="letter in MORSE_LETTERS" :key="letter" :class="{ 'brain-morse__cell--known': progress.known.includes(letter), 'brain-morse__cell--locked': !placed.includes(letter) }">
          <button type="button" class="brain-morse__cell" :disabled="!placed.includes(letter)" :data-morse-cell="letter" @click="play(MORSE_CODES[letter])">
            <strong>{{ letter }}</strong>
            <template v-if="placed.includes(letter)">
              <span class="brain-morse__marks">{{ morseMarks(MORSE_CODES[letter]) }}</span>
              <small><span aria-hidden="true">{{ morseWord(letter)?.emoji }}</span>{{ morseWord(letter)?.chant.join("") }}</small>
            </template>
            <span v-else class="brain-morse__marks">？</span>
          </button>
        </li>
      </ol>
      <p class="brain-morse__note">数字は決まりで覚えられるよ：1〜5は「前からトンの数」（3＝・・・－－）、6〜9は「前からツーの数＋5」（7＝－－・・・）、0は－－－－－。</p>
      <div class="brain-game__actions">
        <button type="button" class="brain-game__secondary" @click="phase = 'home'">もどる</button>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, type PropType } from "vue";
import {
  MORSE_CODES,
  MORSE_LETTERS,
  MORSE_LISTEN_COUNT,
  MORSE_READ_WORDS,
  MORSE_REVIEW_LISTEN_COUNT,
  MORSE_SESSIONS,
  MORSE_UNIT_MS,
  MORSE_WARMUP_COUNT,
  completeMorseReview,
  completeMorseSession,
  isLongBeat,
  morseListenQuestions,
  morseMarks,
  morsePalace,
  morsePlan,
  morseReadQuestions,
  morseScenes,
  morseSpoken,
  morseStageText,
  morseTimeline,
  morseWord,
  placedLetters,
} from "../core/palace-morse.mjs";
import { REVIEW_DAYS } from "../core/memory-box.mjs";
import { talkRoomOpen } from "../core/morse-talk.mjs";
import { brainAudio } from "../brain-audio";
import BrainMorseTalk, { type TalkFinish } from "./BrainMorseTalk.vue";

type Locus = { name: string; emoji: string; group?: string };
type Palace = { id: string; name: string; loci: readonly Locus[] };
type Progress = { palace: string; done: number; known: string[]; stage: number; next: string; last: string };
type TalkProgress = { done: string[]; ears: Record<string, { ears: number; total: number }>; sent: number; speed: string; keyMode: string; caption: string };
type CourseStore = { version: number; morse: Progress; talk: TalkProgress };
type Scene = ReturnType<typeof morseScenes>[number];
type Question = { letter: string; code: string; options: string[] };
type Answer = { letter: string; ok: boolean };
type Row = { label: string; correct: number; total: number };
export type MorseFinish = { kind: "session" | "review"; title: string; known: number; correct: number; total: number; text: string; sub: string };

const props = defineProps({
  /** 記憶力の部屋の保存(宮殿を選ぶため)。 */
  memory: { type: Object as PropType<{ palaces: Palace[]; sample: boolean; lastPalace: string; boxes: unknown[]; treasurePalace: string }>, required: true },
  courses: { type: Object as PropType<CourseStore>, required: true },
  day: { type: String, required: true },
});
const emit = defineEmits<{
  (event: "save", store: CourseStore): void;
  (event: "finish", result: MorseFinish | TalkFinish): void;
  (event: "sound", kind: "correct" | "miss" | "place" | "finish"): void;
}>();

const RULE_WORD = morseWord("C")!;
/** 答えが合ったとき、次へ進むまでの間(符号の音を聞き終える長さ)。 */
const OK_NEXT_MS = 1100;

const seedBase = Math.floor(Math.random() * 1e9);
const phase = ref<"home" | "rule" | "study" | "code" | "listen" | "read" | "result" | "table" | "talk">("home");
const talkView = ref<InstanceType<typeof BrainMorseTalk> | null>(null);
const talkOpen = computed(() => talkRoomOpen(props.courses.morse));
function openTalk() {
  if (!talkOpen.value) return;
  brainAudio().play("tick");
  phase.value = "talk";
}
const progress = computed(() => props.courses.morse);
const palace = computed(() => morsePalace(props.memory, progress.value.palace) as Palace);
const plan = computed(() => morsePlan(progress.value, props.day));
const placed = computed(() => placedLetters(progress.value) as string[]);
const reviewStones = computed(() => {
  if (progress.value.stage < 0) return `${REVIEW_DAYS.length}回`;
  return `${Math.min(progress.value.stage, REVIEW_DAYS.length)}/${REVIEW_DAYS.length}`;
});
const homeNote = computed(() => {
  const current = plan.value;
  if (current.kind === "session" && current.number === 1) return "置く場所は、A＝1か所目、B＝2か所目…。宮殿をA〜Zの順に歩くよ。";
  if (current.kind === "session") return "日をあけると長く残るよ。今日続けて受けてもいいよ。";
  if (current.kind === "review" && current.due) return `${morseStageText(progress.value.stage)}の日。場所をたどって、26文字を思い出そう。`;
  if (current.kind === "review") return `次のおさらいは${dateText(current.next)}。それまでは練習（段は進まない）。`;
  return "1か月たっても思い出せた。モールス信号は、もう身についたね！";
});

// ===== 回の流れ =====
type Step = "rule" | "warmup" | "study" | "code" | "listen" | "read" | "result";
let steps: Step[] = [];
let stepIndex = -1;
const runKind = ref<"session" | "review" | "practice">("session");
const runNumber = ref(1);
const runLetters = ref<readonly string[]>([]);
const codeAnswers = ref<Answer[]>([]);
const rows = ref<Row[]>([]);

function startSession(number: number) {
  if (number > progress.value.done + 1) return;
  brainAudio().play("tick");
  runKind.value = "session";
  runNumber.value = number;
  runLetters.value = MORSE_SESSIONS[number - 1];
  codeAnswers.value = [];
  rows.value = [];
  steps = [number === 1 ? "rule" : "warmup", "study", "code", "listen", ...(number === MORSE_SESSIONS.length ? (["read"] as Step[]) : []), "result"];
  stepIndex = -1;
  advance();
}
function startReview() {
  brainAudio().play("tick");
  runKind.value = plan.value.kind === "review" && plan.value.due ? "review" : "practice";
  runNumber.value = 0;
  runLetters.value = placed.value.length ? placed.value : MORSE_LETTERS;
  codeAnswers.value = [];
  rows.value = [];
  steps = ["code", "listen", "result"];
  stepIndex = -1;
  advance();
}
function advance() {
  clearTimers();
  stepIndex += 1;
  const step = steps[stepIndex];
  if (!step) {
    phase.value = "home";
    return;
  }
  if (step === "rule") {
    phase.value = "rule";
    later(() => play(MORSE_CODES.C), 400);
  } else if (step === "warmup") {
    const earlier = MORSE_SESSIONS.slice(0, runNumber.value - 1).flat();
    startListen(morseListenQuestions(seedBase + 11, earlier, earlier, MORSE_WARMUP_COUNT), "前の回のおさらい");
  } else if (step === "study") {
    scenes.value = morseScenes(palace.value, runLetters.value);
    showStudy(0);
  } else if (step === "code") {
    codeLetters.value = [...runLetters.value];
    codeIndex.value = 0;
    codeInput.value = "";
    codeFeedback.value = "";
    phase.value = "code";
  } else if (step === "listen") {
    const pool = runKind.value === "session" ? MORSE_SESSIONS.slice(0, runNumber.value).flat() : runLetters.value;
    const letters = runKind.value === "session" ? runLetters.value : pool;
    const count = runKind.value === "session" ? MORSE_LISTEN_COUNT : MORSE_REVIEW_LISTEN_COUNT;
    startListen(morseListenQuestions(seedBase + 23, letters, pool, count), runKind.value === "session" ? "聞いて当てる" : "おさらい");
  } else if (step === "read") {
    readWordIndex.value = 0;
    startReadWord();
  } else {
    showResult();
  }
}

// ===== 音と光 =====
const lit = ref(-1);
// 流れの待ち(次の問いへ進むなど)と、鳴っている印を光らせる待ちは分けて持つ。鳴らし直しで、次へ進む待ちを消さないように。
let timers: ReturnType<typeof setTimeout>[] = [];
let lightTimers: ReturnType<typeof setTimeout>[] = [];
function later(fn: () => void, ms: number) {
  timers.push(setTimeout(fn, ms));
}
function clearLights() {
  for (const timer of lightTimers) clearTimeout(timer);
  lightTimers = [];
  lit.value = -1;
}
function clearTimers() {
  for (const timer of timers) clearTimeout(timer);
  timers = [];
  clearLights();
}
/** 符号を鳴らし、鳴っている音の拍(印)を1つずつ光らせる(音を消していても光る)。 */
function play(code: string) {
  clearLights();
  brainAudio().morse(code, MORSE_UNIT_MS);
  const { marks, total } = morseTimeline(code, MORSE_UNIT_MS);
  marks.forEach((mark, index) => lightTimers.push(setTimeout(() => { lit.value = index; }, mark.at + 30)));
  lightTimers.push(setTimeout(() => { lit.value = -1; }, total + 60));
}

// ===== 置く =====
const scenes = ref<Scene[]>([]);
const studyIndex = ref(0);
const scene = computed(() => scenes.value[studyIndex.value] ?? null);
function showStudy(index: number) {
  studyIndex.value = index;
  phase.value = "study";
  const current = scenes.value[index];
  if (current) later(() => play(current.code), 350);
}
function nextStudy() {
  emit("sound", "place");
  if (studyIndex.value + 1 < scenes.value.length) showStudy(studyIndex.value + 1);
  else advance();
}
function letterIndex(letter: string) {
  return MORSE_LETTERS.indexOf(letter);
}

// ===== 場所から符号 =====
const codeLetters = ref<string[]>([]);
const codeIndex = ref(0);
const codeInput = ref("");
const codeFeedback = ref<"" | "ok" | "miss">("");
const codeLetter = computed(() => codeLetters.value[codeIndex.value] ?? "");
const codeLocus = computed(() => palace.value.loci[letterIndex(codeLetter.value)] ?? null);
const codeFeedbackText = computed(() => {
  const word = morseWord(codeLetter.value);
  if (!word) return "";
  const spoken = morseSpoken(MORSE_CODES[codeLetter.value]);
  return codeFeedback.value === "ok" ? `${codeLetter.value}は${word.chant.join("")}。${spoken}、ぴったり！` : `${codeLetter.value}は${word.chant.join("")}（${word.chant.join("・")}）。`;
});
function pushMark(mark: "." | "-") {
  if (codeFeedback.value || codeInput.value.length >= 4) return;
  brainAudio().play("tick");
  codeInput.value += mark;
}
function submitCode() {
  if (!codeInput.value || codeFeedback.value) return;
  const ok = codeInput.value === MORSE_CODES[codeLetter.value];
  codeFeedback.value = ok ? "ok" : "miss";
  codeAnswers.value = [...codeAnswers.value, { letter: codeLetter.value, ok }];
  emit("sound", ok ? "correct" : "miss");
  later(() => play(MORSE_CODES[codeLetter.value]), ok ? 250 : 400);
  if (ok) later(nextCode, OK_NEXT_MS + morseTimeline(MORSE_CODES[codeLetter.value]).total);
}
function nextCode() {
  if (!codeFeedback.value) return;
  clearTimers();
  if (codeIndex.value + 1 < codeLetters.value.length) {
    codeIndex.value += 1;
    codeInput.value = "";
    codeFeedback.value = "";
    return;
  }
  const correct = codeAnswers.value.filter(({ ok }) => ok).length;
  rows.value = [...rows.value, { label: "場所から符号", correct, total: codeAnswers.value.length }];
  advance();
}

// ===== 聞いて当てる =====
const questions = ref<Question[]>([]);
const listenIndex = ref(0);
const listenTitle = ref("");
const listenFeedback = ref("");
const listenCorrect = ref(0);
const showMarks = ref(false);
const question = computed(() => questions.value[listenIndex.value] ?? null);
const listenFeedbackText = computed(() => {
  const current = question.value;
  if (!current) return "";
  const word = morseWord(current.letter);
  return `${current.letter}＝${word?.chant.join("") ?? ""}（${morseMarks(current.code)}）`;
});
function startListen(list: Question[], title: string) {
  questions.value = list;
  listenIndex.value = 0;
  listenTitle.value = title;
  listenCorrect.value = 0;
  listenFeedback.value = "";
  showMarks.value = false;
  phase.value = "listen";
  if (!list.length) {
    advance();
    return;
  }
  later(() => play(list[0].code), 400);
}
function answerListen(option: string) {
  const current = question.value;
  if (!current || listenFeedback.value) return;
  const ok = option === current.letter;
  listenFeedback.value = option;
  if (ok) listenCorrect.value += 1;
  emit("sound", ok ? "correct" : "miss");
  later(nextListen, ok ? 900 : 2000);
}
function nextListen() {
  clearTimers();
  listenFeedback.value = "";
  showMarks.value = false;
  if (listenIndex.value + 1 < questions.value.length) {
    listenIndex.value += 1;
    later(() => play(questions.value[listenIndex.value].code), 250);
    return;
  }
  rows.value = [...rows.value, { label: listenTitle.value === "前の回のおさらい" ? "前の回のおさらい" : "聞いて当てる", correct: listenCorrect.value, total: questions.value.length }];
  advance();
}

// ===== 読む =====
const readWordIndex = ref(0);
const readQuestions = ref<Question[]>([]);
const readLetterIndex = ref(0);
const readFeedback = ref("");
const readMisses = ref<number[]>([]);
const readCorrect = ref(0);
const readTotal = ref(0);
const readDone = ref(false);
const readWord = computed(() => MORSE_READ_WORDS[readWordIndex.value] ?? null);
const readQuestion = computed(() => readQuestions.value[readLetterIndex.value] ?? null);
function startReadWord() {
  const word = MORSE_READ_WORDS[readWordIndex.value];
  readQuestions.value = morseReadQuestions(seedBase + 37 + readWordIndex.value, word.word);
  readLetterIndex.value = 0;
  readFeedback.value = "";
  readMisses.value = [];
  readDone.value = false;
  showMarks.value = false;
  phase.value = "read";
  later(() => play(readQuestions.value[0].code), 400);
}
function answerRead(option: string) {
  const current = readQuestion.value;
  if (!current || readFeedback.value) return;
  const ok = option === current.letter;
  readFeedback.value = option;
  readTotal.value += 1;
  if (ok) readCorrect.value += 1;
  else readMisses.value = [...readMisses.value, readLetterIndex.value];
  emit("sound", ok ? "correct" : "miss");
  later(() => {
    readFeedback.value = "";
    showMarks.value = false;
    if (readLetterIndex.value + 1 < readQuestions.value.length) {
      readLetterIndex.value += 1;
      later(() => play(readQuestions.value[readLetterIndex.value].code), 200);
      return;
    }
    readLetterIndex.value += 1;
    readDone.value = true;
    emit("sound", "finish");
  }, ok ? 700 : 1600);
}
function nextReadWord() {
  clearTimers();
  if (readWordIndex.value + 1 < MORSE_READ_WORDS.length) {
    readWordIndex.value += 1;
    startReadWord();
    return;
  }
  rows.value = [...rows.value, { label: "読む（SOS・SHOGI）", correct: readCorrect.value, total: readTotal.value }];
  advance();
}

// ===== 結果 =====
const resultMessage = ref("");
const resultNext = ref("");
const resultRows = computed(() => rows.value);
let pending: { store: CourseStore; finish: MorseFinish } | null = null;
function dateText(day: string) {
  return day ? `${Number(day.slice(5, 7))}月${Number(day.slice(8, 10))}日` : "";
}
function showResult() {
  const codeOk = codeAnswers.value.filter(({ ok }) => ok).length;
  const correct = rows.value.reduce((sum, row) => sum + row.correct, 0);
  const total = rows.value.reduce((sum, row) => sum + row.total, 0);
  let nextProgress: Progress;
  let title: string;
  if (runKind.value === "session") {
    nextProgress = completeMorseSession(progress.value, runNumber.value, codeAnswers.value, props.day, palace.value.id);
    title = `モールス信号 回${runNumber.value}（${runLetters.value[0]}〜${runLetters.value[runLetters.value.length - 1]}）`;
    const all = codeOk === codeAnswers.value.length;
    resultMessage.value = all ? `${codeAnswers.value.length}文字、場所から全部言えた！` : `${codeAnswers.value.length}文字のうち${codeOk}文字、場所から言えたよ。まちがえた文字は、その場所の絵をもう一度思いうかべてね。`;
    if (runNumber.value === MORSE_SESSIONS.length) resultMessage.value += " SOSもSHOGIも読めたね。これで26文字そろった！";
    resultNext.value = nextProgress.done < MORSE_SESSIONS.length
      ? `次は回${nextProgress.done + 1}（${MORSE_SESSIONS[nextProgress.done][0]}〜${MORSE_SESSIONS[nextProgress.done].at(-1)}）。日をあけると長く残るよ。`
      : `次は${dateText(nextProgress.next)}に、26文字のおさらい。間をあけて思い出すと、長く覚えていられるよ。`;
  } else if (runKind.value === "review") {
    const outcome = completeMorseReview(progress.value, codeAnswers.value, { correct, total }, props.day);
    nextProgress = outcome.progress;
    title = `モールス信号 ${morseStageText(progress.value.stage)}`;
    resultMessage.value = outcome.mastered
      ? "1か月たっても思い出せた。モールス信号は、もう身についたね！"
      : outcome.passed ? `${total}問中${correct}問。次の段へ進むよ！` : `${total}問中${correct}問。もう一度、近いうちにおさらいしよう。`;
    resultNext.value = outcome.mastered ? "" : `次のおさらいは${dateText(nextProgress.next)}。`;
  } else {
    // 練習: 段は進めず、覚えた文字だけ直す。
    nextProgress = completeMorseSession(progress.value, 0, codeAnswers.value, props.day, "");
    title = "モールス信号 練習";
    resultMessage.value = `${total}問中${correct}問。練習は段に数えないよ。`;
    resultNext.value = progress.value.next ? `次のおさらいは${dateText(progress.value.next)}。` : "";
  }
  const store = { ...props.courses, morse: nextProgress };
  pending = {
    store,
    finish: {
      kind: runKind.value === "session" ? "session" : "review",
      title,
      known: nextProgress.known.length,
      correct,
      total,
      text: `覚えた文字 ${nextProgress.known.length}/26`,
      sub: rows.value.map((row) => `${row.label} ${row.correct}/${row.total}`).join("・"),
    },
  };
  emit("save", store);
  emit("sound", "finish");
  phase.value = "result";
}
function finishRun() {
  if (!pending) return;
  const { finish } = pending;
  pending = null;
  emit("finish", finish);
}

// ===== キーボード(トン・ツー・選択肢) =====
function onKey(event: KeyboardEvent) {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const key = event.key;
  if (phase.value === "code" && !codeFeedback.value) {
    if (key === "." || key === "j" || key === "ArrowLeft") pushMark(".");
    else if (key === "-" || key === "k" || key === "ArrowRight") pushMark("-");
    else if (key === "Backspace") codeInput.value = codeInput.value.slice(0, -1);
    else if (key === "Enter") submitCode();
    else return;
  } else if (phase.value === "code" && key === "Enter") nextCode();
  else if ((phase.value === "listen" || phase.value === "read") && /^[1-4]$/.test(key)) {
    const options = phase.value === "listen" ? question.value?.options : readQuestion.value?.options;
    const option = options?.[Number(key) - 1];
    if (!option) return;
    if (phase.value === "listen") answerListen(option);
    else answerRead(option);
  } else if ((phase.value === "listen" || phase.value === "read") && key === " ") {
    const code = phase.value === "listen" ? question.value?.code : readQuestion.value?.code;
    if (code) play(code);
  } else return;
  event.preventDefault();
}
onMounted(() => window.addEventListener("keydown", onKey));
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKey);
  clearTimers();
});

/** 見出しの戻る。途中ならコースの札へ(回は始めからやり直し)、札なら道場に任せる。 */
function goBack() {
  if (phase.value === "home") return false;
  if (phase.value === "talk" && talkView.value?.goBack()) return true;
  clearTimers();
  phase.value = "home";
  return true;
}
defineExpose({ goBack });
</script>

<style>
/* 実用コース「モールス信号」(17章)。色は道場の変数だけを使う(U:7-1)。トンは丸、ツーは横長の棒(形で分ける。U:7-3)。 */
.shogi-game .brain-morse__card,
.shogi-game .brain-morse__scene {
  display: grid;
  justify-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.9rem 1rem;
  border-radius: var(--dojo-radius);
  color: var(--dojo-ink);
  background: var(--dojo-paper);
  box-shadow: var(--dojo-shadow);
}
.shogi-game .brain-morse__card { justify-items: stretch; }
.shogi-game .brain-morse__title { margin: 0; color: var(--dojo-ai); font-size: 1.15rem; font-weight: 900; }
.shogi-game .brain-morse__lead,
.shogi-game .brain-morse__note { margin: 0; font-size: 0.86rem; font-weight: 700; line-height: 1.55; }
.shogi-game .brain-morse__note { color: var(--dojo-ink-2); }
.shogi-game .brain-game > .brain-morse__note { color: var(--dojo-light-2); text-align: center; }
.shogi-game .brain-morse__road { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.35rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .brain-morse__stone {
  display: grid;
  justify-items: center;
  gap: 0.05rem;
  width: 100%;
  min-height: 52px;
  padding: 0.3rem 0.2rem;
  border: 2px solid var(--dojo-rule);
  border-radius: 12px;
  color: var(--dojo-ink-2);
  background: #fff;
  box-shadow: none;
  font: inherit;
  cursor: pointer;
}
.shogi-game .brain-morse__stone strong { font-size: 0.88rem; }
.shogi-game .brain-morse__stone small { font-size: 0.72rem; font-weight: 800; }
.shogi-game .brain-morse__stone--done { border-color: var(--dojo-ai-light); color: var(--dojo-ai); background: var(--dojo-ai-soft); }
.shogi-game .brain-morse__stone--now { border-color: var(--dojo-now); color: var(--dojo-ink); background: #fff3dc; }
.shogi-game .brain-morse__stone--review { cursor: default; }
.shogi-game .brain-morse__stone:disabled { color: var(--dojo-ink-2); background: #fff; opacity: 0.5; cursor: default; }
.shogi-game .brain-morse__meta { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.2rem 0.8rem; margin: 0; font-size: 0.82rem; font-weight: 800; }
.shogi-game .brain-morse__meta b { color: var(--dojo-ai); font-size: 1.1rem; }

/* 決まりと置く */
.shogi-game .brain-morse__rule { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 0.3rem 0.5rem; margin: 0; font-size: 0.9rem; font-weight: 800; }
.shogi-game .brain-morse__locus { display: inline-flex; align-items: center; gap: 0.35rem; color: var(--dojo-ai); font-size: 1rem; font-weight: 900; }
.shogi-game .brain-morse__locus b { font-size: 1.7rem; line-height: 1; }
.shogi-game .brain-morse__letter { color: var(--dojo-ink); font-size: clamp(2.6rem, calc(11 * var(--dojo-vw)), 3.6rem); font-weight: 900; line-height: 1; }
.shogi-game .brain-morse__beats { display: flex; justify-content: center; gap: 0.35rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .brain-morse__beats li {
  display: grid;
  justify-items: center;
  gap: 0.3rem;
  min-width: 3.2rem;
  padding: 0.35rem 0.4rem 0.45rem;
  border: 2px solid var(--dojo-rule);
  border-radius: 10px;
  background: #fff;
  transition: background-color 80ms, border-color 80ms;
}
.shogi-game .brain-morse__beats span { font-size: 1.3rem; font-weight: 900; }
.shogi-game .brain-morse__beats .brain-morse__beat--lit { border-color: var(--dojo-shu); background: var(--dojo-shu-soft); }
.shogi-game .brain-morse__word { display: flex; flex-wrap: wrap; justify-content: center; align-items: baseline; gap: 0.2rem 0.45rem; margin: 0; font-size: 1.15rem; font-weight: 900; }
.shogi-game .brain-morse__word small { color: var(--dojo-gold); font-size: 0.78rem; }
.shogi-game .brain-morse__image {
  width: 100%;
  margin: 0;
  padding: 0.5rem 0.75rem;
  border-radius: 12px;
  background: var(--dojo-ai-soft);
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.5;
}
.shogi-game .brain-morse__play,
.shogi-game .brain-morse__peek {
  min-height: 44px;
  padding: 0.3rem 1.1rem;
  border: 2px solid var(--dojo-ai-light);
  border-radius: 999px;
  color: var(--dojo-ai);
  background: #fff;
  box-shadow: none;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 900;
  cursor: pointer;
}
.shogi-game .brain-morse__peek { min-height: 40px; border-color: var(--dojo-rule); color: var(--dojo-ink-2); font-size: 0.82rem; }

/* 符号の印: トンは丸、ツーは横長の棒。 */
.shogi-game .brain-morse__mark { display: inline-block; flex: none; background: var(--dojo-ink); }
.shogi-game .brain-morse__mark--dot { width: 0.7rem; height: 0.7rem; border-radius: 50%; }
.shogi-game .brain-morse__mark--dash { width: 2.1rem; height: 0.7rem; border-radius: 0.35rem; }
.shogi-game .brain-morse__mark--hidden { background: var(--dojo-paper-2); }
.shogi-game .brain-morse__mark--lit { background: var(--dojo-shu); }
.shogi-game .brain-morse__beat--lit .brain-morse__mark { background: var(--dojo-shu); }
.shogi-game .brain-morse__marks { display: inline-flex; align-items: center; gap: 0.3rem; font-weight: 900; letter-spacing: 0.08em; }

/* 場所から符号 */
.shogi-game .brain-morse__ask { min-height: 2.9em; margin: 0; font-size: 0.92rem; font-weight: 800; line-height: 1.5; text-align: center; }
.shogi-game .brain-morse__input {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.45rem;
  min-width: 10rem;
  min-height: 2.6rem;
  margin: 0;
  padding: 0 0.8rem;
  border-bottom: 4px solid var(--dojo-rule);
}
.shogi-game .brain-morse__input .brain-morse__mark--dot { width: 1rem; height: 1rem; }
.shogi-game .brain-morse__input .brain-morse__mark--dash { width: 3rem; height: 1rem; border-radius: 0.5rem; }
.shogi-game .brain-morse__input--ok { border-color: var(--dojo-good); }
.shogi-game .brain-morse__input--ok .brain-morse__mark { background: var(--dojo-good); }
.shogi-game .brain-morse__input--miss { border-color: var(--dojo-shu); }
.shogi-game .brain-morse__input--miss .brain-morse__mark { background: var(--dojo-shu); }
.shogi-game .brain-morse__placeholder { color: var(--dojo-rule); font-size: 1.4rem; font-weight: 900; }
.shogi-game .brain-morse__answer { margin: 0; font-size: 0.9rem; font-weight: 800; }
.shogi-game .brain-morse__keys { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.5rem; width: min(100%, 22rem); }
.shogi-game .brain-morse__key {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  min-height: 60px;
  border: 2px solid var(--dojo-rule);
  border-radius: 0.8rem;
  color: var(--dojo-ink);
  background: #fff;
  box-shadow: 0 3px 0 var(--dojo-rule);
  font: inherit;
  font-size: 1.15rem;
  font-weight: 900;
  cursor: pointer;
  touch-action: manipulation;
}
.shogi-game .brain-morse__key--sub { min-height: 48px; font-size: 0.95rem; background: var(--dojo-paper-2); }
.shogi-game .brain-morse__key--submit { min-height: 48px; border-color: var(--dojo-ai); color: #fff; background: var(--dojo-ai); box-shadow: 0 3px 0 var(--dojo-ai-deep); }
.shogi-game .brain-morse__key:disabled { color: var(--dojo-ink); background: #fff; opacity: 0.4; cursor: default; }
.shogi-game .brain-morse__key--submit:disabled { color: #fff; background: var(--dojo-ai); }

/* 聞いて当てる・読む */
.shogi-game .brain-morse__speaker {
  display: grid;
  justify-items: center;
  gap: 0.45rem;
  width: min(100%, 18rem);
  padding: 0.8rem;
  border: 3px solid var(--dojo-ai-light);
  border-radius: 18px;
  color: var(--dojo-ai);
  background: #fff;
  box-shadow: none;
  font: inherit;
  cursor: pointer;
}
.shogi-game .brain-morse__speaker > span:first-child { font-size: 2rem; line-height: 1; }
.shogi-game .brain-morse__speaker small { color: var(--dojo-ink-2); font-size: 0.82rem; font-weight: 800; }
.shogi-game .brain-morse__speaker--small { padding: 0.5rem; }
.shogi-game .brain-morse__marks--live { min-height: 1rem; }
.shogi-game .brain-morse__options { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.5rem; width: min(100%, 24rem); }
.shogi-game .brain-morse__option {
  position: relative;
  min-height: 64px;
  border: 2px solid var(--dojo-rule);
  border-radius: 0.8rem;
  color: var(--dojo-ink);
  background: #fff;
  box-shadow: 0 3px 0 var(--dojo-rule);
  font: inherit;
  font-size: 1.8rem;
  font-weight: 900;
  cursor: pointer;
  touch-action: manipulation;
}
.shogi-game .brain-morse__option small { position: absolute; top: 0.2rem; left: 0.4rem; color: var(--dojo-ink-2); font-size: 0.66rem; }
.shogi-game .brain-morse__option--ok { border-color: var(--dojo-good); color: #fff; background: var(--dojo-good); }
.shogi-game .brain-morse__option--miss { border-color: var(--dojo-shu); color: var(--dojo-shu); background: var(--dojo-shu-soft); }
.shogi-game .brain-morse__option:disabled { opacity: 1; cursor: default; }
.shogi-game .brain-morse__option:disabled:not(.brain-morse__option--ok):not(.brain-morse__option--miss) { color: var(--dojo-ink); background: #fff; opacity: 0.5; }
.shogi-game .brain-morse__slots { display: flex; justify-content: center; gap: 0.35rem; margin: 0; }
.shogi-game .brain-morse__slot {
  display: grid;
  place-items: center;
  width: 2.6rem;
  height: 3rem;
  border-bottom: 4px solid var(--dojo-rule);
  font-size: 1.9rem;
  font-weight: 900;
}
.shogi-game .brain-morse__slot--now { border-color: var(--dojo-now); }
.shogi-game .brain-morse__slot--miss { color: var(--dojo-shu); }
.shogi-game .brain-morse__reveal { margin: 0; color: var(--dojo-good); font-size: 1.05rem; font-weight: 900; text-align: center; }
.shogi-game .brain-morse__reveal strong { display: block; font-size: 2.2rem; letter-spacing: 0.12em; }

/* 無線で話す(18章)の入口と、会話のあいだの枠(画面の高さいっぱい。吹き出しの列は枠の中だけ動く。U:7-5) */
.shogi-game .brain-morse__talk {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-height: 52px;
  padding: 0.45rem 0.8rem;
  border: 2px solid var(--dojo-ai-light);
  border-radius: 12px;
  color: var(--dojo-ink);
  background: var(--dojo-ai-soft);
  box-shadow: none;
  font: inherit;
  text-align: left;
}
.shogi-game .brain-morse__talk > span:first-child { font-size: 1.5rem; }
.shogi-game .brain-morse__talk-body { display: grid; gap: 0.05rem; }
.shogi-game .brain-morse__talk-body strong { color: var(--dojo-ai); font-size: 0.98rem; }
.shogi-game .brain-morse__talk-body small { color: var(--dojo-ink-2); font-size: 0.76rem; font-weight: 700; }
.shogi-game .brain-morse__talk:disabled { border-color: var(--dojo-rule); background: var(--dojo-paper-2); opacity: 0.7; }
.shogi-game .brain-game.brain-morse.brain-morse--talk { display: block; width: min(100%, 46rem); height: 100%; }

/* 結果と表 */
.shogi-game .brain-morse__rows { display: grid; gap: 0.3rem; width: min(100%, 24rem); margin: 0; padding: 0.6rem 0.9rem; border-radius: var(--dojo-radius); color: var(--dojo-ink); background: var(--dojo-paper); list-style: none; }
.shogi-game .brain-morse__rows li { display: flex; justify-content: space-between; gap: 0.6rem; font-weight: 800; }
.shogi-game .brain-morse__rows strong { font-variant-numeric: tabular-nums; }
/* 26文字を4列に詰め、それでも背が足りない画面では表の枠の中だけ動かす(U:7-5)。 */
.shogi-game .brain-morse__table {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.3rem;
  width: 100%;
  max-height: calc(56 * var(--dojo-vh));
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}
.shogi-game .brain-morse__cell {
  display: grid;
  justify-items: center;
  gap: 0.05rem;
  width: 100%;
  min-height: 54px;
  padding: 0.25rem 0.2rem;
  border: 2px solid var(--dojo-rule);
  border-radius: 10px;
  color: var(--dojo-ink);
  background: var(--dojo-paper);
  box-shadow: none;
  font: inherit;
  cursor: pointer;
}
.shogi-game .brain-morse__cell strong { font-size: 1.1rem; line-height: 1; }
.shogi-game .brain-morse__cell .brain-morse__marks { font-size: 0.88rem; line-height: 1.2; }
.shogi-game .brain-morse__cell small { max-width: 100%; overflow: hidden; font-size: 0.62rem; font-weight: 800; text-overflow: ellipsis; white-space: nowrap; }
.shogi-game .brain-morse__cell--known .brain-morse__cell { border-color: var(--dojo-ai-light); background: var(--dojo-ai-soft); }
.shogi-game .brain-morse__cell:disabled { color: var(--dojo-ink-2); background: var(--dojo-paper-2); opacity: 0.6; cursor: default; }
@media (hover: hover) {
  .shogi-game .brain-morse__key:not(:disabled):hover,
  .shogi-game .brain-morse__option:not(:disabled):hover { border-color: var(--dojo-now); background-color: #fff3dc; }
}
.shogi-game .brain-morse__key:focus-visible,
.shogi-game .brain-morse__option:focus-visible,
.shogi-game .brain-morse__stone:focus-visible,
.shogi-game .brain-morse__cell:focus-visible,
.shogi-game .brain-morse__speaker:focus-visible { outline: 3px solid #3c6dd1; outline-offset: 2px; }
/* 背の低い画面(スマホ横・小さな縦): 字と札を詰めて、1画面に収める(U:7-5)。 */
@media (max-height: 640px) {
  .shogi-game .brain-morse__scene { gap: 0.3rem; padding: 0.55rem 0.8rem; }
  .shogi-game .brain-morse__letter { font-size: 2.2rem; }
  .shogi-game .brain-morse__beats span { font-size: 1.1rem; }
  .shogi-game .brain-morse__image { padding: 0.35rem 0.6rem; font-size: 0.86rem; line-height: 1.4; }
  .shogi-game .brain-morse__key { min-height: 50px; }
  .shogi-game .brain-morse__option { min-height: 52px; font-size: 1.5rem; }
  .shogi-game .brain-morse__ask { min-height: 0; }
}
@media (orientation: landscape) and (max-height: 600px) {
  /* .brain-gameの幅(30rem)より強くする(道場の書式があとに読まれても負けないように)。 */
  .shogi-game .brain-game.brain-morse { grid-template-columns: minmax(0, 1fr) minmax(0, 18rem); align-items: center; width: min(100%, 50rem); column-gap: 1rem; }
  .shogi-game .brain-morse > .brain-game__status,
  .shogi-game .brain-morse > .brain-game__prompt { grid-column: 1 / -1; }
  .shogi-game .brain-morse__table { grid-column: 1 / -1; grid-template-columns: repeat(auto-fill, minmax(5.6rem, 1fr)); max-height: calc(48 * var(--dojo-vh)); }
}
/* もっと背の低い横向き(小さなスマホの横): 札の中をさらに詰める(U:7-5)。 */
@media (orientation: landscape) and (max-height: 400px) {
  /* コースの札の補足の文(決まりの説明)は省く。決まりの1枚と符号の表にある(U:7-5の3)。 */
  .shogi-game .brain-morse__card .brain-morse__lead { display: none; }
  .shogi-game .brain-morse__scene { gap: 0.15rem; padding: 0.4rem 0.7rem; }
  .shogi-game .brain-morse__rule { font-size: 0.8rem; }
  .shogi-game .brain-morse__letter { font-size: 1.8rem; }
  .shogi-game .brain-morse__beats li { min-height: 0; padding-block: 0.15rem; }
  .shogi-game .brain-morse__beats span { font-size: 1rem; }
  .shogi-game .brain-morse__word { font-size: 1rem; }
  .shogi-game .brain-morse__image { font-size: 0.8rem; line-height: 1.35; }
}
@media (prefers-reduced-motion: reduce) {
  .shogi-game .brain-morse__beats li { transition: none; }
}
</style>
