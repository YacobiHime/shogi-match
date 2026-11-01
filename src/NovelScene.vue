<template>
  <!--
    ノベルの場面(docs/novel-scene-design.md。台本の形はdocs/team-battle-design.mdの6章)。後の物語モードでも使う。
    押す(クリック・Enter・Space・→・ホイールの下)と、文の出かけは全部出し、出ていれば次の行。
    窓の操作の帯: ログ(読み返し)・オート・隠す・設定(文字とオートの速さ)。右上の「飛ばす」は、まだ読んでいない場面ならあらすじを見せる。
    Ctrlを押している間は読んだ行を早送り、右クリック・Hで窓を隠す、↑・ホイールの上でログ(4-2)。
    選択肢のある行(choices)は、文が出きったら答えのボタンを出し、選ぶと返しの行が続く(将棋まつりのトークショー)。
  -->
  <div
    ref="root"
    class="novel"
    :class="[`novel--${scene.background}`, { 'novel--hidden': hidden, 'novel--choosing': choosing }]"
    role="dialog"
    aria-modal="true"
    :aria-label="scene.title"
    tabindex="-1"
    data-novel
    @click="onScreenClick"
    @keydown="onKeydown"
    @keyup="onKeyup"
    @wheel="onWheel"
    @contextmenu.prevent="onContextMenu"
    @blur="stopFastForward"
  >
    <p class="novel__place" :class="{ 'novel__place--intro': placeIntro }" aria-hidden="true" data-novel-place>
      <span class="novel__place-text">{{ scene.title }}</span>
    </p>
    <div class="novel__stage" aria-hidden="true">
      <img
        v-for="(person, at) in castView"
        :key="person.who"
        class="novel__person"
        :class="[
          `novel__person--${castView.length === 1 ? 'center' : at === 0 ? 'left' : 'right'}`,
          {
            'novel__person--active': person.who === line.who,
            'novel__person--quiet': line.who !== 'narration' && person.who !== line.who,
            'novel__person--hop': person.who === hopWho,
            'novel__person--enter': entering,
          },
        ]"
        :src="person.src"
        :srcset="person.srcset"
        sizes="(max-width: 700px) 320px, 800px"
        alt=""
        draggable="false"
      >
    </div>
    <div v-if="choosing && !hidden" class="novel__choices" role="group" :aria-label="TEXT.choicesLabel" data-novel-choices @click.stop>
      <button
        v-for="(choice, at) in line.choices"
        :key="at"
        ref="choiceButtons"
        type="button"
        class="novel__choice"
        :data-novel-choice="at"
        @click.stop="choose(at)"
      ><span class="novel__choice-no" aria-hidden="true">{{ at + 1 }}</span>{{ choice.label }}</button>
    </div>
    <div v-show="!hidden" class="novel__box" :style="{ '--who': whoColor(line.who) }" data-novel-box>
      <p v-if="line.name" class="novel__name" :class="`novel__name--${line.who}`">{{ line.name }}</p>
      <!-- まだ出していない字も透明で先に置き、折り返しを最初から決める(文が動かない。4-1) -->
      <p class="novel__text" :class="{ 'novel__text--narration': line.who === 'narration' }" aria-hidden="true"><span>{{ shown }}</span><span class="novel__rest">{{ rest }}</span></p>
      <p class="novel__sr" aria-live="polite">{{ liveText }}</p>
      <div class="novel__footer">
        <span v-if="autoWaiting" :key="autoKey" class="novel__auto-line" :style="{ animationDuration: `${autoMs}ms` }" aria-hidden="true" />
        <span class="novel__next" :class="{ 'novel__next--shown': complete && !choosing }" aria-hidden="true">{{ isLast ? "■" : "▼" }}</span>
        <div class="novel__bar" role="toolbar" :aria-label="TEXT.toolsLabel" @click.stop>
          <button type="button" class="novel__tool" data-novel-log @click="openLog">{{ TEXT.log }}</button>
          <button type="button" class="novel__tool" :class="{ 'novel__tool--on': autoOn }" :aria-pressed="autoOn" data-novel-auto @click="toggleAuto">{{ TEXT.auto }}</button>
          <button type="button" class="novel__tool" data-novel-hide @click="toggleHide">{{ TEXT.hide }}</button>
          <button type="button" class="novel__tool" data-novel-settings @click="openSettings">{{ TEXT.settings }}</button>
        </div>
      </div>
    </div>
    <button v-show="!hidden" type="button" class="novel__skip" data-novel-skip @click.stop="requestSkip">{{ TEXT.skip }}</button>
    <p v-if="hidden" class="novel__hidden-hint" aria-live="polite">{{ TEXT.hiddenHint }}</p>

    <!-- 読み返し(ログ) -->
    <div v-if="logOpen" class="novel__sheet" role="dialog" aria-modal="true" :aria-label="TEXT.logTitle" data-novel-log-sheet @click.stop="onBackdrop($event, closeOverlay)" @keydown.stop="onSheetKey">
      <div class="novel__panel novel__panel--log">
        <div class="novel__panel-head">
          <h2 class="novel__panel-title">{{ TEXT.logTitle }}</h2>
          <button ref="sheetClose" type="button" class="novel__tool" data-novel-log-close @click="closeOverlay">{{ TEXT.close }}</button>
        </div>
        <ol ref="logList" class="novel__log">
          <li v-if="!backlog.length" class="novel__log-empty">{{ TEXT.logEmpty }}</li>
          <li v-for="(entry, at) in backlog" :key="at" class="novel__log-entry" :style="{ '--who': whoColor(entry.who) }">
            <p v-if="entry.name" class="novel__log-name">{{ entry.name }}</p>
            <p class="novel__log-text" :class="{ 'novel__log-text--narration': entry.who === 'narration' }">{{ entry.text }}</p>
            <p v-if="entry.picked" class="novel__log-picked">{{ TEXT.pickedPrefix }}{{ entry.picked }}</p>
          </li>
        </ol>
      </div>
    </div>

    <!-- 読み方の設定 -->
    <div v-if="settingsOpen" class="novel__sheet" role="dialog" aria-modal="true" :aria-label="TEXT.settingsTitle" data-novel-settings-sheet @click.stop="onBackdrop($event, closeOverlay)" @keydown.stop="onSheetKey">
      <div class="novel__panel">
        <div class="novel__panel-head">
          <h2 class="novel__panel-title">{{ TEXT.settingsTitle }}</h2>
          <button ref="sheetClose" type="button" class="novel__tool" data-novel-settings-close @click="closeOverlay">{{ TEXT.close }}</button>
        </div>
        <p class="novel__setting-label">{{ TEXT.textSpeed }}</p>
        <div class="novel__options" role="group" :aria-label="TEXT.textSpeed">
          <button
            v-for="(speed, id) in TEXT_SPEEDS"
            :key="id"
            type="button"
            class="novel__option"
            :class="{ 'novel__option--on': settings.text === id }"
            :aria-pressed="settings.text === id"
            :data-novel-text-speed="id"
            @click="setSetting({ text: id })"
          >{{ speed.label }}</button>
        </div>
        <p class="novel__setting-label">{{ TEXT.autoSpeed }}</p>
        <div class="novel__options" role="group" :aria-label="TEXT.autoSpeed">
          <button
            v-for="(speed, id) in AUTO_SPEEDS"
            :key="id"
            type="button"
            class="novel__option"
            :class="{ 'novel__option--on': settings.auto === id }"
            :aria-pressed="settings.auto === id"
            :data-novel-auto-speed="id"
            @click="setSetting({ auto: id })"
          >{{ speed.label }}</button>
        </div>
        <p class="novel__keys">{{ TEXT.keysNote }}</p>
      </div>
    </div>

    <!-- 飛ばす前のあらすじ(まだ読んでいない場面だけ。4-2) -->
    <div v-if="summaryOpen" class="novel__sheet" role="dialog" aria-modal="true" :aria-label="TEXT.summaryTitle" data-novel-summary @click.stop="onBackdrop($event, closeOverlay)" @keydown.stop="onSheetKey">
      <div class="novel__panel">
        <h2 class="novel__panel-title">{{ TEXT.summaryTitle }}</h2>
        <p class="novel__summary">{{ scene.summary }}</p>
        <p v-if="hasChoices" class="novel__summary-note">{{ TEXT.choiceSkipNote }}</p>
        <div class="novel__panel-actions">
          <button type="button" class="novel__option" data-novel-keep-reading @click="closeOverlay">{{ TEXT.keepReading }}</button>
          <button ref="sheetClose" type="button" class="novel__option novel__option--go" data-novel-skip-now @click="finish">{{ TEXT.skipNow }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { portraitUrl } from "./core/team-story.mjs";
import {
  AUTO_SPEEDS,
  FAST_FORWARD_MS,
  NOVEL_UI_TEXT as TEXT,
  PLACE_CARD_MS,
  TEXT_SPEEDS,
  autoWaitMs,
  backlogEntries,
  charDelayMs,
  faceChangedAt,
  isLineRead,
  lineKey,
  loadNovelRead,
  loadNovelSettings,
  markLineRead,
  saveNovelRead,
  saveNovelSettings,
  shouldShowSummary,
} from "./core/novel-ui.mjs";

type SceneChoice = { label: string; value?: string; reply?: SceneLine[] };
type SceneLine = { who: string; face: string; name: string; text: string; choices?: SceneChoice[] };
type Scene = { id: string; title: string; summary?: string; background: string; cast: string[]; lines: SceneLine[] };
type NovelSettings = ReturnType<typeof loadNovelSettings>;

const props = defineProps<{ scene: Scene; assetBaseUrl: string }>();
const emit = defineEmits<{ done: []; choose: [payload: { line: number; choice: number; value: string }] }>();

/** 話す人の色(名前の札の線とログ。4-1)。 */
const WHO_COLORS: Record<string, string> = { hanane: "#9ed8c0", momoka: "#ffb3c6", you: "#ffd59a", host: "#c3ccd4" };
const whoColor = (who: string) => WHO_COLORS[who] ?? "#fffcf4";
/** 表情が変わったときの跳ね(ミリ秒。4-3)。 */
const HOP_MS = 240;
/** ホイールを続けて回したときに、1回として数える間(ミリ秒)。 */
const WHEEL_GAP_MS = 280;

const storage = (): Storage | null => {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
};

const root = ref<HTMLElement | null>(null);
const choiceButtons = ref<HTMLButtonElement[]>([]);
const sheetClose = ref<HTMLButtonElement | null>(null);
const logList = ref<HTMLElement | null>(null);
const index = ref(0);
const count = ref(0);
/** いま見せている行(選んだ答えの返しを差し込む)。 */
const lines = ref<SceneLine[]>([...props.scene.lines]);
/** 行の番号 → 選んだ答え(ログに出す)。 */
const picks = ref<Record<number, string>>({});
const settings = ref<NovelSettings>(loadNovelSettings(storage()));
let read = loadNovelRead(storage());

const autoOn = ref(false);
const hidden = ref(false);
const logOpen = ref(false);
const settingsOpen = ref(false);
const summaryOpen = ref(false);
const placeIntro = ref(true);
/** はじめに立ち絵が出てくるあいだ(4-3)。終わったら外し、跳ねのあとに出る動きを繰り返さない。 */
const entering = ref(true);
const hopWho = ref("");
const liveText = ref("");
const autoMs = ref(0);
const autoKey = ref(0);

let typingTimer: ReturnType<typeof setInterval> | null = null;
let autoTimer: ReturnType<typeof setTimeout> | null = null;
let fastTimer: ReturnType<typeof setInterval> | null = null;
let placeTimer: ReturnType<typeof setTimeout> | null = null;
let hopTimer: ReturnType<typeof setTimeout> | null = null;
let enterTimer: ReturnType<typeof setTimeout> | null = null;
let lastWheel = 0;

const line = computed<SceneLine>(() => lines.value[index.value] ?? { who: "narration", face: "neutral", name: "", text: "" });
const chars = computed(() => Array.from(line.value.text));
const shown = computed(() => chars.value.slice(0, count.value).join(""));
const rest = computed(() => chars.value.slice(count.value).join(""));
const complete = computed(() => count.value >= chars.value.length);
const isLast = computed(() => index.value >= lines.value.length - 1);
/** 答えを選ぶところ(文が出きったら、ボタンを出して待つ)。 */
const choosing = computed(() => complete.value && Boolean(line.value.choices?.length));
const overlayOpen = computed(() => logOpen.value || settingsOpen.value || summaryOpen.value);
const hasChoices = computed(() => props.scene.lines.some((entry) => entry.choices?.length));
const backlog = computed(() => backlogEntries(lines.value, index.value, complete.value, picks.value));
/** オートで次の行を待っているところ(待ちの線を出す)。 */
const autoWaiting = computed(() => autoOn.value && complete.value && !choosing.value && !overlayOpen.value && !hidden.value);

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
  if (typingTimer) clearInterval(typingTimer);
  typingTimer = null;
}

function startTyping() {
  stopTyping();
  liveText.value = line.value.text;
  const total = chars.value.length;
  const delay = charDelayMs(settings.value);
  if (reducedMotion() || delay <= 0) {
    count.value = total;
    return;
  }
  count.value = 0;
  typingTimer = setInterval(() => {
    count.value += 1;
    if (count.value >= total) stopTyping();
  }, delay);
}

function revealAll() {
  stopTyping();
  count.value = chars.value.length;
}

function stopAutoTimer() {
  if (autoTimer) clearTimeout(autoTimer);
  autoTimer = null;
}

function stopFastForward() {
  if (fastTimer) clearInterval(fastTimer);
  fastTimer = null;
}

function finish() {
  stopTyping();
  stopAutoTimer();
  stopFastForward();
  summaryOpen.value = false;
  emit("done");
}

function advance() {
  if (!complete.value) {
    revealAll();
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
  picks.value = { ...picks.value, [index.value]: choice.label };
  const next = [...lines.value];
  next.splice(index.value + 1, 0, ...(choice.reply ?? []));
  next[index.value] = { ...line.value, choices: undefined };
  lines.value = next;
  index.value += 1;
  root.value?.focus();
}

function onScreenClick() {
  if (hidden.value) {
    hidden.value = false;
    return;
  }
  if (overlayOpen.value) return;
  advance();
}

/** シートの外側(暗いところ)を押したら閉じる。 */
function onBackdrop(event: MouseEvent, close: () => void) {
  if (event.target === event.currentTarget) close();
}

function focusSheet() {
  void nextTick(() => sheetClose.value?.focus());
}

function openLog() {
  stopFastForward();
  logOpen.value = true;
  focusSheet();
  // 新しい行が下。開いたら最後の行を見せる。
  void nextTick(() => {
    if (logList.value) logList.value.scrollTop = logList.value.scrollHeight;
  });
}

function openSettings() {
  stopFastForward();
  settingsOpen.value = true;
  focusSheet();
}

function requestSkip() {
  stopFastForward();
  if (shouldShowSummary(read, props.scene)) {
    summaryOpen.value = true;
    focusSheet();
    return;
  }
  finish();
}

function closeOverlay() {
  logOpen.value = false;
  settingsOpen.value = false;
  summaryOpen.value = false;
  void nextTick(() => root.value?.focus());
}

function toggleAuto() {
  autoOn.value = !autoOn.value;
}

/** 右クリックで窓を隠す。タッチの長押しでは隠さない(押しまちがいで消えないように)。 */
function onContextMenu(event: MouseEvent) {
  if ((event as PointerEvent).pointerType === "touch") return;
  toggleHide();
}

function toggleHide() {
  if (overlayOpen.value) return;
  stopFastForward();
  hidden.value = !hidden.value;
  if (!hidden.value) void nextTick(() => root.value?.focus());
}

function setSetting(patch: Partial<NovelSettings>) {
  settings.value = { ...settings.value, ...patch } as NovelSettings;
  saveNovelSettings(storage(), settings.value);
  // 文字の速さを変えたら、出かけの行にもすぐ効かせる。
  if (patch.text && !complete.value && charDelayMs(settings.value) <= 0) revealAll();
}

/** Ctrlの早送り: 読んだ行だけ進み、まだ読んでいない行・選択肢で止まる(4-2)。 */
function fastStep() {
  if (overlayOpen.value || hidden.value || choosing.value) {
    stopFastForward();
    return;
  }
  if (!isLineRead(read, props.scene.id, lineKey(line.value))) {
    stopFastForward();
    return;
  }
  advance();
}

function startFastForward() {
  if (fastTimer) return;
  fastStep();
  fastTimer = setInterval(fastStep, FAST_FORWARD_MS);
}

function onSheetKey(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    closeOverlay();
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    if (goBack()) event.preventDefault();
    return;
  }
  if (overlayOpen.value) return;
  if (event.key === "Control") {
    if (!event.repeat) startFastForward();
    return;
  }
  if (hidden.value) {
    event.preventDefault();
    hidden.value = false;
    return;
  }
  if (choosing.value && /^[1-9]$/.test(event.key)) {
    const at = Number(event.key) - 1;
    if (line.value.choices?.[at]) {
      event.preventDefault();
      choose(at);
    }
    return;
  }
  // ボタンの上のEnter・Spaceは、そのボタンを押す。
  if ((event.target as HTMLElement | null)?.closest?.("button")) return;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (key === "Enter" || key === " " || key === "ArrowRight" || key === "ArrowDown") {
    event.preventDefault();
    advance();
  } else if (key === "ArrowUp") {
    event.preventDefault();
    openLog();
  } else if (key === "a") {
    toggleAuto();
  } else if (key === "h") {
    toggleHide();
  }
}

function onKeyup(event: KeyboardEvent) {
  if (event.key === "Control") stopFastForward();
}

function onWheel(event: WheelEvent) {
  if (overlayOpen.value || hidden.value || !event.deltaY) return;
  const now = Date.now();
  if (now - lastWheel < WHEEL_GAP_MS) return;
  lastWheel = now;
  if (event.deltaY < 0) openLog();
  else advance();
}

/** 戻る操作。開いているシート・隠した窓を先に閉じたら真(4-2)。 */
function goBack() {
  if (overlayOpen.value) closeOverlay();
  else if (hidden.value) toggleHide();
  else return false;
  return true;
}

function showPlaceCard() {
  if (placeTimer) clearTimeout(placeTimer);
  if (enterTimer) clearTimeout(enterTimer);
  entering.value = true;
  enterTimer = setTimeout(() => { entering.value = false; }, 300);
  placeIntro.value = true;
  placeTimer = setTimeout(() => {
    placeIntro.value = false;
  }, reducedMotion() ? PLACE_CARD_MS / 2 : PLACE_CARD_MS);
}

// 行が変わったら文字送りを始め、表情が変わった人を小さく跳ねさせる(4-3)。
watch(index, (at) => {
  startTyping();
  if (hopTimer) clearTimeout(hopTimer);
  hopWho.value = !reducedMotion() && faceChangedAt(lines.value, at) ? line.value.who : "";
  if (hopWho.value) hopTimer = setTimeout(() => { hopWho.value = ""; }, HOP_MS);
});
// 文が出きったら、読んだ印を付ける(Ctrlの早送りと「飛ばす」で使う)。文字の速さが「すぐ」でも付くよう、行の変わり目も見る。
watch([complete, index], ([done]) => {
  if (!done) return;
  const next = markLineRead(read, props.scene.id, lineKey(line.value));
  if (next !== read) {
    read = next;
    saveNovelRead(storage(), read);
  }
}, { immediate: true });
// オート: 文が出きってから、文の長さに合わせて待って進む。選択肢・シート・隠しているあいだは止まる。
watch([autoWaiting, index], () => {
  stopAutoTimer();
  if (!autoWaiting.value) return;
  autoMs.value = autoWaitMs(line.value.text, settings.value);
  autoKey.value += 1;
  autoTimer = setTimeout(() => {
    autoTimer = null;
    if (autoWaiting.value) advance();
  }, autoMs.value);
});
watch(() => props.scene.id, () => {
  lines.value = [...props.scene.lines];
  picks.value = {};
  index.value = 0;
  startTyping();
  showPlaceCard();
});
// 答えのボタンが出たら、最初のボタンへ(キーボードでも選べる)。
watch(choosing, (open) => {
  if (open) void nextTick(() => choiceButtons.value[0]?.focus());
});

onMounted(() => {
  startTyping();
  showPlaceCard();
  root.value?.focus();
});
onBeforeUnmount(() => {
  stopTyping();
  stopAutoTimer();
  stopFastForward();
  if (placeTimer) clearTimeout(placeTimer);
  if (hopTimer) clearTimeout(hopTimer);
  if (enterTimer) clearTimeout(enterTimer);
});

defineExpose({ finish, goBack });
</script>

<style scoped>
.novel {
  --novel-ink: #fffcf4;
  --novel-window: rgba(18, 30, 40, 0.86);
  --novel-window-top: rgba(18, 30, 40, 0.62);
  --novel-line: rgba(255, 252, 244, 0.38);
  --novel-accent: var(--amber, #f1a54c);
  --novel-enter-ms: 240ms;
  --novel-shift-ms: 160ms;
  position: fixed;
  inset: 0;
  z-index: 200;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  grid-template-columns: minmax(0, 1fr);
  overflow: hidden;
  color: var(--novel-ink);
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

/* 場所の札: はじめは大きな帯で出て、少しして左上の小さな札になる(4-3)。押して読むのは止めない。 */
.novel__place {
  grid-row: 1;
  grid-column: 1;
  justify-self: start;
  max-width: calc(100% - 7.5em);
  margin: 0.6em 0 0;
  padding: 0.3em 1em 0.3em 0.9em;
  border-left: 0.25em solid var(--novel-accent);
  border-radius: 0 999px 999px 0;
  background: rgba(18, 30, 40, 0.55);
  color: rgba(255, 252, 244, 0.92);
  font-size: 0.85em;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
  transition: font-size 320ms ease, padding 320ms ease, background 320ms ease;
  animation: novel-place-in 320ms ease-out;
}
.novel__place--intro {
  padding: 0.55em 1.8em 0.55em 1.1em;
  background: rgba(18, 30, 40, 0.82);
  font-size: 1.2em;
}
.novel--hidden .novel__place { visibility: hidden; }

.novel__stage {
  position: relative;
  grid-row: 2;
  grid-column: 1;
  min-height: 0;
  transition: filter var(--novel-shift-ms) ease;
}
.novel--choosing .novel__stage { filter: brightness(0.72); }
.novel__person {
  position: absolute;
  bottom: -6%;
  height: 112%;
  max-width: 48%;
  object-fit: contain;
  object-position: bottom;
  transition: filter var(--novel-shift-ms) ease, transform var(--novel-shift-ms) ease;
}
.novel__person--enter { animation: novel-person-in var(--novel-enter-ms) ease-out; }
.novel__person--left { left: 6%; }
.novel__person--right { right: 6%; }
.novel__person--center { left: 50%; translate: -50% 0; }
.novel__person--quiet { filter: brightness(0.6) saturate(0.78); transform: translateY(1.5%); }
.novel__person--active { filter: none; transform: translateY(-1%); }
.novel__person--hop { animation: novel-hop 240ms ease-out; }

.novel__choices {
  /* 選択肢は立ち絵の段の下のほうに重ねる(立ち絵の段を縮めない) */
  position: relative;
  z-index: 1;
  grid-row: 2;
  grid-column: 1;
  align-self: end;
  display: grid;
  gap: 0.5em;
  width: min(calc(100% - 2.4em), 34em);
  margin: 0 auto 1em;
  cursor: default;
}
.novel .novel__choice {
  display: flex;
  align-items: center;
  gap: 0.7em;
  min-height: 48px;
  padding: 0.55em 1.1em 0.55em 0.6em;
  border: 0.12em solid rgba(255, 252, 244, 0.8);
  border-radius: 0.7em;
  color: #172632;
  background: rgba(255, 252, 244, 0.96);
  box-shadow: 0 0.25em 0.8em rgba(0, 0, 0, 0.3);
  font: inherit;
  font-size: 1em;
  font-weight: 800;
  text-align: left;
  cursor: pointer;
  animation: novel-choice-in 200ms ease-out both;
}
.novel .novel__choice:nth-child(2) { animation-delay: 50ms; }
.novel .novel__choice:nth-child(3) { animation-delay: 100ms; }
.novel .novel__choice:hover, .novel .novel__choice:focus-visible { background: #ffe7c2; outline: 0.15em solid var(--novel-accent); }
.novel__choice-no {
  display: inline-grid;
  flex: none;
  place-items: center;
  width: 1.7em;
  height: 1.7em;
  border-radius: 50%;
  color: var(--novel-ink);
  background: #2b4a5c;
  font-size: 0.85em;
}

/* 文の窓: 下ほど濃い半透明で、背景と立ち絵が透ける。名前の札は左上に、人ごとの色の線(4-1)。 */
.novel__box {
  position: relative;
  grid-row: 3;
  grid-column: 1;
  margin: 0 auto 0.7em;
  width: min(calc(100% - 1.4em), 50em);
  padding: 1.15em 1.3em 0.3em;
  border: 1px solid var(--novel-line);
  border-radius: 0.9em;
  background: linear-gradient(180deg, var(--novel-window-top), var(--novel-window) 35%);
  box-shadow: 0 0.3em 1.2em rgba(0, 0, 0, 0.35);
  box-sizing: border-box;
  -webkit-backdrop-filter: blur(3px);
  backdrop-filter: blur(3px);
}
.novel__name {
  position: absolute;
  top: -0.95em;
  left: 0.9em;
  margin: 0;
  padding: 0.18em 0.95em 0.18em 0.7em;
  border-left: 0.3em solid var(--who, #fffcf4);
  border-radius: 0.3em 999px 999px 0.3em;
  color: var(--novel-ink);
  background: #172632;
  box-shadow: 0 0.15em 0.4em rgba(0, 0, 0, 0.35);
  font-size: 0.92em;
  font-weight: 900;
  letter-spacing: 0.04em;
}
.novel__text {
  min-height: calc(1.8em * 3);
  margin: 0;
  font-size: 1.08em;
  line-height: 1.8;
  white-space: pre-wrap;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
}
.novel__rest { color: transparent; text-shadow: none; }
.novel__text--narration { color: #dfe7ea; }
.novel__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
.novel__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.6em;
}
.novel__next {
  color: var(--novel-accent);
  font-size: 0.8em;
  opacity: 0;
}
.novel__next--shown {
  opacity: 1;
  animation: novel-next 900ms ease-in-out infinite;
}
/* オートの待ちの線: 窓の下の端を左から伸び、伸びきったら次の行(4-1)。 */
.novel__auto-line {
  position: absolute;
  left: 0.9em;
  right: 0.9em;
  bottom: 0.2em;
  height: 2px;
  border-radius: 999px;
  background: var(--novel-accent);
  transform-origin: left center;
  animation: novel-auto-wait linear forwards;
}
.novel__bar {
  display: flex;
  gap: 0.15em;
  cursor: default;
}
.novel .novel__tool {
  box-shadow: none;
  min-width: 44px;
  min-height: 44px;
  padding: 0.2em 0.65em;
  border: 0;
  border-radius: 0.5em;
  color: rgba(255, 252, 244, 0.82);
  background: transparent;
  font: inherit;
  font-size: 0.8em;
  font-weight: 800;
  letter-spacing: 0.05em;
  cursor: pointer;
}
.novel .novel__tool:hover, .novel .novel__tool:focus-visible { color: var(--novel-ink); background: rgba(255, 252, 244, 0.12); outline: none; }
.novel .novel__tool:focus-visible { box-shadow: 0 0 0 0.12em var(--novel-accent); }
.novel .novel__tool:active { transform: scale(0.94); }
.novel .novel__tool--on { color: #172632; background: var(--novel-accent); }
.novel .novel__tool--on:hover, .novel .novel__tool--on:focus-visible { color: #172632; background: #ffc27a; }

.novel .novel__skip {
  box-shadow: none;
  position: absolute;
  top: 0.55em;
  right: 0.8em;
  min-height: 44px;
  padding: 0.3em 1.1em;
  border: 0.1em solid rgba(255, 252, 244, 0.6);
  border-radius: 999px;
  color: var(--novel-ink);
  background: rgba(23, 38, 50, 0.7);
  font: inherit;
  font-size: 0.85em;
  font-weight: 800;
  cursor: pointer;
}
.novel__hidden-hint {
  position: absolute;
  left: 50%;
  bottom: 1em;
  margin: 0;
  padding: 0.3em 1em;
  border-radius: 999px;
  color: var(--novel-ink);
  background: rgba(18, 30, 40, 0.78);
  font-size: 0.85em;
  font-weight: 800;
  translate: -50% 0;
  animation: novel-hint 3.2s ease-in-out forwards;
}

/* シート(ログ・設定・あらすじ) */
.novel__sheet {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: grid;
  place-items: center;
  padding: 1em;
  background: rgba(10, 18, 26, 0.6);
  cursor: default;
  animation: novel-fade 160ms ease-out;
}
.novel__panel {
  display: grid;
  gap: 0.6em;
  width: min(100%, 32em);
  max-height: calc(100% - 1em);
  padding: 1em 1.1em 1.1em;
  border: 1px solid var(--novel-line);
  border-radius: 0.9em;
  background: #172632;
  box-shadow: 0 0.4em 1.4em rgba(0, 0, 0, 0.45);
  box-sizing: border-box;
  overflow: auto;
}
.novel__panel--log {
  grid-template-rows: auto minmax(0, 1fr);
  width: min(100%, 40em);
  height: min(100%, 36em);
  overflow: hidden;
}
.novel__panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6em;
}
.novel__panel-title { margin: 0; font-size: 1.05em; font-weight: 900; letter-spacing: 0.06em; }
.novel__log {
  display: grid;
  align-content: start;
  gap: 0.8em;
  margin: 0;
  padding: 0 0.2em 0 0;
  overflow-y: auto;
  list-style: none;
}
.novel__log-empty { color: rgba(255, 252, 244, 0.7); }
.novel__log-entry { padding-left: 0.7em; border-left: 0.22em solid var(--who, #fffcf4); }
.novel__log-name { margin: 0; color: var(--who, #fffcf4); font-size: 0.82em; font-weight: 900; }
.novel__log-text { margin: 0.1em 0 0; line-height: 1.7; white-space: pre-wrap; }
.novel__log-text--narration { color: #c9d4d8; }
.novel__log-picked { margin: 0.25em 0 0; color: var(--novel-accent); font-weight: 800; }
.novel__setting-label { margin: 0.3em 0 0; color: rgba(255, 252, 244, 0.8); font-size: 0.85em; font-weight: 800; }
.novel__options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(5em, 1fr));
  gap: 0.4em;
}
.novel .novel__option {
  box-shadow: none;
  min-height: 44px;
  padding: 0.3em 0.6em;
  border: 1px solid var(--novel-line);
  border-radius: 0.6em;
  color: var(--novel-ink);
  background: rgba(255, 252, 244, 0.06);
  font: inherit;
  font-size: 0.92em;
  font-weight: 800;
  cursor: pointer;
}
.novel .novel__option:hover, .novel .novel__option:focus-visible { background: rgba(255, 252, 244, 0.16); outline: 0.12em solid var(--novel-accent); }
.novel .novel__option--on, .novel .novel__option--go { color: #172632; background: var(--novel-accent); border-color: var(--novel-accent); }
.novel .novel__option--on:hover, .novel .novel__option--go:hover, .novel .novel__option--go:focus-visible { color: #172632; background: #ffc27a; }
.novel__keys { margin: 0.4em 0 0; color: rgba(255, 252, 244, 0.62); font-size: 0.75em; line-height: 1.6; }
.novel__summary { margin: 0; line-height: 1.8; }
.novel__summary-note { margin: 0; color: var(--novel-accent); font-size: 0.9em; font-weight: 800; }
.novel__panel-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5em; margin-top: 0.3em; }

@keyframes novel-next {
  0%, 100% { transform: translateY(0); opacity: 1; }
  50% { transform: translateY(0.2em); opacity: 0.6; }
}
@keyframes novel-place-in {
  from { opacity: 0; transform: translateX(-1.2em); }
  to { opacity: 1; transform: none; }
}
@keyframes novel-person-in {
  from { opacity: 0; transform: translateY(4%); }
  to { opacity: 1; }
}
@keyframes novel-hop {
  0% { transform: translateY(-1%); }
  40% { transform: translateY(-3.5%); }
  100% { transform: translateY(-1%); }
}
@keyframes novel-choice-in {
  from { opacity: 0; transform: translateY(0.4em); }
  to { opacity: 1; transform: none; }
}
@keyframes novel-auto-wait {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
@keyframes novel-hint {
  0% { opacity: 0; }
  12%, 80% { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes novel-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
@media (max-width: 700px) {
  .novel__person { max-width: 62%; height: 104%; }
  .novel__person--left { left: -4%; }
  .novel__person--right { right: -4%; }
  .novel__text { font-size: 1em; }
  .novel__box { padding: 1.1em 1em 0.2em; }
  .novel__place--intro { font-size: 1.05em; }
  .novel__keys { display: none; }
}
/* 横向きの低い画面は、立ち絵を左右の端に寄せ、文の窓を少し低く。 */
@media (orientation: landscape) and (max-height: 500px) {
  .novel__person { height: 135%; max-width: 30%; }
  .novel__box { margin-bottom: 0.4em; padding: 0.95em 1em 0.1em; }
  .novel__text { min-height: calc(1.7em * 2); line-height: 1.7; }
  .novel__place { margin-top: 0.4em; }
  .novel__keys { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .novel__person, .novel__stage, .novel__place { transition: none; animation: none; }
  .novel__person--quiet, .novel__person--active { transform: none; }
  .novel__next--shown, .novel .novel__choice, .novel__sheet, .novel__hidden-hint { animation: none; }
  .novel__auto-line { animation-name: none; transform: scaleX(1); opacity: 0.5; }
}
</style>
