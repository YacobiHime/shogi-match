<template>
  <!--
    ノベルの場面(docs/team-battle-design.mdの6章)。後の物語モードでも使う。
    押す(クリック・Enter・Space・→)と、文の出かけは全部出し、出ていれば次の行。右上の「飛ばす」で最後まで(D:8-2 遊びを止めない)。
    選択肢のある行(choices)は、文が出きったら答えのボタンを出し、選ぶと返しの行が続く(将棋まつりのトークショー。docs/pro-year-design.mdの10-2の6)。
  -->
  <div
    ref="root"
    class="novel"
    :class="`novel--${scene.background}`"
    role="dialog"
    aria-modal="true"
    :aria-label="scene.title"
    tabindex="-1"
    data-novel
    @click="advance"
    @keydown="onKeydown"
  >
    <p class="novel__title" aria-hidden="true">{{ scene.title }}</p>
    <div class="novel__stage" aria-hidden="true">
      <img
        v-for="(person, index) in castView"
        :key="person.who"
        class="novel__person"
        :class="[
          `novel__person--${castView.length === 1 ? 'center' : index === 0 ? 'left' : 'right'}`,
          { 'novel__person--active': person.who === line.who, 'novel__person--quiet': line.who !== 'narration' && person.who !== line.who },
        ]"
        :src="person.src"
        :srcset="person.srcset"
        sizes="(max-width: 700px) 320px, 800px"
        alt=""
        draggable="false"
      >
    </div>
    <div class="novel__box">
      <p v-if="line.name" class="novel__name" :class="`novel__name--${line.who}`">{{ line.name }}</p>
      <p class="novel__text" :class="{ 'novel__text--narration': line.who === 'narration' }" aria-live="polite">{{ shown }}</p>
      <span v-if="complete && !choosing" class="novel__next" aria-hidden="true">{{ isLast ? "■" : "▼" }}</span>
    </div>
    <div v-if="choosing" class="novel__choices" role="group" aria-label="答えを選ぶ" data-novel-choices @click.stop>
      <button
        v-for="(choice, at) in line.choices"
        :key="at"
        ref="choiceButtons"
        type="button"
        class="novel__choice"
        :data-novel-choice="at"
        @click.stop="choose(at)"
      >{{ choice.label }}</button>
    </div>
    <button type="button" class="novel__skip" data-novel-skip @click.stop="finish">飛ばす</button>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { portraitUrl } from "./core/team-story.mjs";

type SceneChoice = { label: string; value?: string; reply?: SceneLine[] };
type SceneLine = { who: string; face: string; name: string; text: string; choices?: SceneChoice[] };
type Scene = { id: string; title: string; background: string; cast: string[]; lines: SceneLine[] };

const props = defineProps<{ scene: Scene; assetBaseUrl: string }>();
const emit = defineEmits<{ done: []; choose: [payload: { line: number; choice: number; value: string }] }>();

/** 1文字を出す間隔(ミリ秒)。押せば待たずに全部出る。 */
const CHAR_MS = 30;

const root = ref<HTMLElement | null>(null);
const choiceButtons = ref<HTMLButtonElement[]>([]);
const index = ref(0);
const count = ref(0);
let timer: ReturnType<typeof setInterval> | null = null;
/** いま見せている行(選んだ答えの返しを差し込む)。 */
const lines = ref<SceneLine[]>([...props.scene.lines]);

const line = computed<SceneLine>(() => lines.value[index.value] ?? { who: "narration", face: "neutral", name: "", text: "" });
const shown = computed(() => Array.from(line.value.text).slice(0, count.value).join(""));
const complete = computed(() => count.value >= Array.from(line.value.text).length);
const isLast = computed(() => index.value >= lines.value.length - 1);
/** 答えを選ぶところ(文が出きったら、ボタンを出して待つ)。 */
const choosing = computed(() => complete.value && Boolean(line.value.choices?.length));

/** 登場する人ごとの、いまの表情の立ち絵(最後に話した表情を残す)。 */
const castView = computed(() => props.scene.cast.map((who) => {
  const spoken = lines.value.slice(0, index.value + 1).filter((entry) => entry.who === who).at(-1);
  const face = spoken?.face ?? "neutral";
  return {
    who,
    src: portraitUrl(props.assetBaseUrl, who, face),
    srcset: `${portraitUrl(props.assetBaseUrl, who, face, { small: true })} 320w, ${portraitUrl(props.assetBaseUrl, who, face)} 800w`,
  };
}));

const reducedMotion = () => typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

function stopTyping() {
  if (timer) clearInterval(timer);
  timer = null;
}

function startTyping() {
  stopTyping();
  const total = Array.from(line.value.text).length;
  if (reducedMotion()) {
    count.value = total;
    return;
  }
  count.value = 0;
  timer = setInterval(() => {
    count.value += 1;
    if (count.value >= total) stopTyping();
  }, CHAR_MS);
}

function finish() {
  stopTyping();
  emit("done");
}

function advance() {
  if (!complete.value) {
    stopTyping();
    count.value = Array.from(line.value.text).length;
    return;
  }
  // 答えを選ぶまでは進まない。
  if (choosing.value) return;
  if (isLast.value) {
    finish();
    return;
  }
  index.value += 1;
}

/** 答えを選ぶ: 返しの行を次に差し込んで進む。 */
function choose(at: number) {
  const choice = line.value.choices?.[at];
  if (!choice) return;
  emit("choose", { line: index.value, choice: at, value: choice.value ?? "" });
  const next = [...lines.value];
  next.splice(index.value + 1, 0, ...(choice.reply ?? []));
  next[index.value] = { ...line.value, choices: undefined };
  lines.value = next;
  index.value += 1;
  root.value?.focus();
}

function onKeydown(event: KeyboardEvent) {
  if (choosing.value && (event.target as HTMLElement | null)?.closest?.("[data-novel-choices]")) return;
  if (event.key === "Enter" || event.key === " " || event.key === "ArrowRight") {
    event.preventDefault();
    advance();
  }
}

watch(index, startTyping);
watch(() => props.scene.id, () => {
  lines.value = [...props.scene.lines];
  index.value = 0;
  startTyping();
});
// 答えのボタンが出たら、最初のボタンへ(キーボードでも選べる)。
watch(choosing, (open) => {
  if (open) void nextTick(() => choiceButtons.value[0]?.focus());
});

onMounted(() => {
  startTyping();
  root.value?.focus();
});
onBeforeUnmount(stopTyping);

defineExpose({ finish });
</script>

<style scoped>
.novel {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto auto;
  overflow: hidden;
  color: #fffcf4;
  cursor: pointer;
  user-select: none;
  outline: none;
  background: #1d303f;
}
/* 背景はCSSで描く。教室の夕方(壁と床)、会館(畳と障子の色)、会場(明かり)、夜。 */
.novel--classroom {
  background:
    repeating-linear-gradient(90deg, rgba(90, 60, 40, 0.25) 0 2px, transparent 2px 120px),
    linear-gradient(180deg, #ffd9a8 0%, #f4b27a 52%, #8a5a3e 53%, #4a3326 100%);
}
.novel--hall {
  background:
    repeating-linear-gradient(90deg, rgba(255, 252, 244, 0.18) 0 3px, transparent 3px 90px),
    linear-gradient(180deg, #e9dcc1 0%, #cdb990 55%, #8c9a5b 56%, #5f6d3c 100%);
}
.novel--venue {
  background:
    radial-gradient(ellipse at 50% 0%, rgba(255, 236, 190, 0.55), transparent 60%),
    linear-gradient(180deg, #3e4f6a 0%, #2b3850 55%, #5b4632 56%, #3a2c20 100%);
}
.novel--night {
  background:
    radial-gradient(circle at 80% 18%, rgba(255, 252, 230, 0.9) 0 2.2em, transparent 2.3em),
    linear-gradient(180deg, #0f1a2e 0%, #1c2b47 60%, #273652 100%);
}
.novel__title {
  margin: 0;
  padding: 0.7em 6.5em 0 1em;
  color: rgba(255, 252, 244, 0.85);
  font-size: 0.85em;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
}
.novel__stage {
  position: relative;
  min-height: 0;
}
.novel__person {
  position: absolute;
  bottom: -6%;
  height: 112%;
  max-width: 48%;
  object-fit: contain;
  object-position: bottom;
  transition: filter 160ms ease, transform 160ms ease;
}
.novel__person--left { left: 6%; }
.novel__person--right { right: 6%; }
.novel__person--center { left: 50%; transform: translateX(-50%); }
.novel__person--quiet { filter: brightness(0.62) saturate(0.8); }
.novel__person--active { filter: none; }
.novel__box {
  position: relative;
  margin: 0 auto 0.9em;
  width: min(calc(100% - 1.6em), 46em);
  min-height: 7.2em;
  padding: 1.1em 1.2em 1em;
  border: 0.12em solid rgba(255, 252, 244, 0.55);
  border-radius: 0.8em;
  background: rgba(23, 38, 50, 0.9);
  box-shadow: 0 0.3em 1em rgba(0, 0, 0, 0.35);
  box-sizing: border-box;
}
.novel__name {
  position: absolute;
  top: -0.95em;
  left: 0.9em;
  margin: 0;
  padding: 0.15em 0.8em;
  border-radius: 999px;
  color: #172632;
  background: #fffcf4;
  font-size: 0.9em;
  font-weight: 900;
}
.novel__name--hanane { background: #cfe6dc; }
.novel__name--momoka { background: #ffc9d6; }
.novel__text {
  margin: 0;
  font-size: 1.05em;
  line-height: 1.75;
  white-space: pre-wrap;
}
.novel__text--narration { color: #e6ecef; font-style: normal; }
.novel__next {
  position: absolute;
  right: 0.9em;
  bottom: 0.5em;
  color: var(--amber, #f1a54c);
  font-size: 0.8em;
  animation: novel-next 900ms ease-in-out infinite;
}
.novel__choices {
  display: grid;
  gap: 0.45em;
  width: min(calc(100% - 1.6em), 46em);
  margin: 0 auto 0.9em;
  cursor: default;
}
.novel__choice {
  min-height: 44px;
  padding: 0.55em 1em;
  border: 0.12em solid rgba(255, 252, 244, 0.7);
  border-radius: 0.7em;
  color: #172632;
  background: #fffcf4;
  font: inherit;
  font-size: 0.98em;
  font-weight: 800;
  text-align: left;
  cursor: pointer;
}
.novel__choice:hover, .novel__choice:focus-visible { background: #ffe7c2; outline: 0.15em solid var(--amber, #f1a54c); }
.novel__name--you { background: #ffe7c2; }
.novel__name--host { background: #d6dde3; }
.novel__skip {
  position: absolute;
  top: 0.55em;
  right: 0.8em;
  min-height: 44px;
  padding: 0.3em 1.1em;
  border: 0.1em solid rgba(255, 252, 244, 0.6);
  border-radius: 999px;
  color: #fffcf4;
  background: rgba(23, 38, 50, 0.7);
  font: inherit;
  font-size: 0.85em;
  font-weight: 800;
  cursor: pointer;
}
@keyframes novel-next {
  0%, 100% { transform: translateY(0); opacity: 1; }
  50% { transform: translateY(0.2em); opacity: 0.6; }
}
@media (max-width: 700px) {
  .novel__person { max-width: 62%; height: 104%; }
  .novel__person--left { left: -4%; }
  .novel__person--right { right: -4%; }
  .novel__text { font-size: 1em; }
}
/* 横向きの低い画面は、立ち絵を左右の端に寄せ、文の窓を少し低く。 */
@media (orientation: landscape) and (max-height: 500px) {
  .novel__person { height: 135%; max-width: 30%; }
  .novel__box { min-height: 5.6em; padding: 0.9em 1em 0.8em; margin-bottom: 0.5em; }
}
@media (prefers-reduced-motion: reduce) {
  .novel__person { transition: none; }
  .novel__next { animation: none; }
}
</style>
