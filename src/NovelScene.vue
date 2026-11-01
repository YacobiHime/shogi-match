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
    <!-- 立ち絵は上半身を映す: 頭から腰(絵の高さの47%)を窓の上に出し、下は窓の後ろへ(7章) -->
    <div class="novel__stage" :class="{ 'novel__stage--pair': castView.length > 1 }" :style="{ '--aspect': stageAspect }" aria-hidden="true">
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
        :style="{ '--scale': person.scale }"
        :src="person.src"
        :srcset="person.srcset"
        sizes="(orientation: portrait) 70vw, 40vw"
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
    <!-- 窓は隠しても場所を残す(立ち絵の大きさを変えない) -->
    <div class="novel__box" :class="{ 'novel__box--hidden': hidden }" :style="{ '--who': tagColor(line.who) }" data-novel-box>
      <!-- 名前の札: 駒の印と名前。地の文でも行を取っておき、窓の高さを変えない -->
      <p class="novel__name" :class="[`novel__name--${line.who}`, { 'novel__name--empty': !line.name }]" :aria-hidden="!line.name"><span class="novel__name-piece" aria-hidden="true" />{{ line.name || "　" }}</p>
      <!-- まだ出していない字も透明で先に置き、折り返しを最初から決める(文が動かない。4-1) -->
      <p class="novel__text" :class="{ 'novel__text--narration': line.who === 'narration' }" aria-hidden="true"><span>{{ shown }}</span><span class="novel__rest">{{ rest }}</span></p>
      <p class="novel__sr" aria-live="polite">{{ liveText }}</p>
      <div class="novel__footer">
        <span v-if="autoWaiting" :key="autoKey" class="novel__auto-line" :style="{ animationDuration: `${autoMs}ms` }" aria-hidden="true" />
        <div class="novel__bar" role="toolbar" :aria-label="TEXT.toolsLabel" @click.stop>
          <button type="button" class="novel__tool" data-novel-log @click="openLog">{{ TEXT.log }}</button>
          <button type="button" class="novel__tool" :class="{ 'novel__tool--on': autoOn }" :aria-pressed="autoOn" data-novel-auto @click="toggleAuto">{{ TEXT.auto }}</button>
          <button type="button" class="novel__tool" data-novel-hide @click="toggleHide">{{ TEXT.hide }}</button>
          <button type="button" class="novel__tool" data-novel-settings @click="openSettings">{{ TEXT.settings }}</button>
        </div>
        <span class="novel__next" :class="{ 'novel__next--shown': complete && !choosing }" aria-hidden="true" data-novel-next><span class="novel__next-piece" />{{ isLast ? TEXT.end : TEXT.next }}</span>
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
import { portraitAspect, portraitScale, portraitUrl } from "./core/team-story.mjs";
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

/** 話す人の色。ログ(暗い地)は淡い色、名前の札の駒の印と帯(明るい地)は濃い色(4-1・7章)。 */
const WHO_COLORS: Record<string, string> = { hanane: "#9ed8c0", momoka: "#ffb3c6", you: "#ffd59a", host: "#c3ccd4" };
const TAG_COLORS: Record<string, string> = { hanane: "#3f8f76", momoka: "#d9577f", you: "#c98523", host: "#6d7c89" };
const whoColor = (who: string) => WHO_COLORS[who] ?? "#fffcf4";
const tagColor = (who: string) => TAG_COLORS[who] ?? "#8a6a43";
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
    scale: portraitScale(who, props.scene.cast),
    src: portraitUrl(props.assetBaseUrl, who, face),
    srcset: `${portraitUrl(props.assetBaseUrl, who, face, { small: true })} 320w, ${portraitUrl(props.assetBaseUrl, who, face)} 800w`,
  };
}));

/** 立ち絵の大きさをそろえる幅÷高さ(出ている人のうち、いちばん横に広い絵。みんな同じ縮尺にする)。 */
const stageAspect = computed(() => Math.max(...props.scene.cast.map((who) => portraitAspect(who)), 0.3));

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
  --novel-paper-ink: #3b2a1a;
  --novel-line: rgba(255, 252, 244, 0.38);
  --novel-accent: var(--amber, #f1a54c);
  --novel-enter-ms: 240ms;
  --novel-shift-ms: 160ms;
  /* 文の大きさ: 画面の幅と高さで決める(スマホ縦で約18px、デスクトップで約28px)。7章 */
  --novel-text-size: clamp(1.12rem, min(2.4vw, 4.2vh) + 0.4rem, 1.8rem);
  position: fixed;
  inset: 0;
  z-index: 200;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
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
  position: absolute;
  top: 0.6em;
  left: 0;
  z-index: 2;
  max-width: calc(100% - 7.5em);
  margin: 0;
  padding: 0.3em 1em 0.3em 0.9em;
  border-left: 0.25em solid var(--novel-accent);
  border-radius: 0 999px 999px 0;
  background: rgba(18, 30, 40, 0.6);
  color: rgba(255, 252, 244, 0.92);
  font-size: 0.85em;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
  transition: font-size 320ms ease, padding 320ms ease, background 320ms ease;
  animation: novel-place-in 320ms ease-out;
  pointer-events: none;
}
.novel__place--intro {
  padding: 0.55em 1.8em 0.55em 1.1em;
  background: rgba(18, 30, 40, 0.82);
  font-size: 1.2em;
}
.novel--hidden .novel__place { visibility: hidden; }

/*
 * 立ち絵: 画面いっぱいに大きく映す(9章)。頭を画面の上の端の近くに置き、絵の高さhは
 * 「画面の高さ÷映す割合(頭から腰の下まで、絵の48%)」と「1人の幅÷絵の縦横比」の小さいほう。腰から下は文の窓の後ろへ沈む。
 * 縦横比は出ている人でそろえ、みんな同じ縮尺にする。背の低い人は足元をそろえて縮める(--scale。8章)。
 */
.novel__stage {
  --bust: 0.48;
  --headroom: 6cqh;
  --slot: 84cqw;
  position: absolute;
  inset: 0;
  z-index: 0;
  container-type: size;
  transition: filter var(--novel-shift-ms) ease;
}
.novel__stage--pair { --slot: 64cqw; }
.novel--choosing .novel__stage { filter: brightness(0.72); }
.novel__person {
  --h: min(calc((100cqh - var(--headroom)) / var(--bust)), calc(var(--slot) / var(--aspect, 0.344)));
  position: absolute;
  top: calc(var(--headroom) + var(--h) * (1 - var(--scale, 1)));
  height: calc(var(--h) * var(--scale, 1));
  width: auto;
  max-width: none;
  object-fit: contain;
  translate: -50% 0;
  transition: filter var(--novel-shift-ms) ease, transform var(--novel-shift-ms) ease;
}
.novel__person--center { left: 50%; }
.novel__person--left { left: 28%; }
.novel__person--right { left: 72%; }
.novel__person--enter { animation: novel-person-in var(--novel-enter-ms) ease-out; }
.novel__person--quiet { filter: brightness(0.84) saturate(0.9); transform: translateY(1%); }
.novel__person--active { filter: none; transform: translateY(-0.6%); }
.novel__person--hop { animation: novel-hop 240ms ease-out; }

.novel__choices {
  /* 選択肢は立ち絵の段の下のほうに重ねる(立ち絵の段を縮めない) */
  position: relative;
  z-index: 2;
  grid-row: 1;
  grid-column: 1;
  align-self: end;
  display: grid;
  gap: 0.5em;
  width: min(calc(100% - 2.4em), 46rem);
  margin: 0 auto 0.8em;
  cursor: default;
}
.novel .novel__choice {
  display: flex;
  align-items: center;
  gap: 0.7em;
  min-height: 48px;
  padding: 0.55em 1.1em 0.55em 0.6em;
  border: 1px solid rgba(160, 110, 50, 0.45);
  border-radius: 0.5em;
  color: var(--novel-paper-ink);
  background: rgba(255, 249, 236, 0.97);
  box-shadow: 0 0.25em 0.8em rgba(0, 0, 0, 0.3);
  font: inherit;
  font-size: calc(var(--novel-text-size) * 0.85);
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
  background: #8a5a2b;
  font-size: 0.8em;
}

/*
 * 文の窓: 画面の下いっぱいの帯。上の端は透明で、下へ行くほど温かい紙の色になり、立ち絵の腰から下が透けて沈む。
 * 文は大きく、濃い茶色(7章)。中身の幅は読みやすい長さまで。
 */
.novel__box {
  position: relative;
  z-index: 1;
  grid-row: 2;
  grid-column: 1;
  padding: 1.5em max(1rem, calc((100% - 58rem) / 2)) 0.15em;
  color: var(--novel-paper-ink);
  background: linear-gradient(180deg, rgba(255, 242, 220, 0) 0, rgba(255, 240, 214, 0.82) 1.6em, rgba(253, 232, 198, 0.94) 50%, rgba(247, 216, 172, 0.97) 100%);
  box-sizing: border-box;
}
/* 細かい点の模様(窓の濃いところだけ) */
.novel__box::before {
  position: absolute;
  inset: 0;
  z-index: -1;
  background: radial-gradient(rgba(176, 116, 52, 0.16) 1px, transparent 1.5px) 0 0 / 9px 9px;
  -webkit-mask-image: linear-gradient(180deg, transparent 0, #000 2.4em);
  mask-image: linear-gradient(180deg, transparent 0, #000 2.4em);
  content: "";
  pointer-events: none;
}
.novel__box--hidden { visibility: hidden; }
/* 名前の札: 紙の札に点線の縁、左に話す人の色の駒の印、右に同じ色の帯 */
.novel__name {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.55em;
  min-width: 8.5em;
  margin: 0 0 0.3em;
  padding: 0.3em 2.1em 0.3em 0.75em;
  border: 1px solid rgba(150, 100, 45, 0.4);
  border-radius: 0.2em;
  color: var(--novel-paper-ink);
  background: linear-gradient(180deg, #fffaf0, #fff1d8);
  box-shadow: 0 0.12em 0.4em rgba(90, 60, 20, 0.2);
  font-size: calc(var(--novel-text-size) * 0.9);
  font-weight: 900;
  letter-spacing: 0.06em;
  line-height: 1.4;
}
.novel__name::before {
  position: absolute;
  inset: 3px;
  border: 1.5px dashed rgba(185, 135, 70, 0.6);
  border-radius: 1px;
  content: "";
  pointer-events: none;
}
.novel__name::after {
  position: absolute;
  top: 0;
  right: 0.6em;
  bottom: 0;
  width: 0.5em;
  background: var(--who, #8a6a43);
  content: "";
}
.novel__name-piece {
  flex: none;
  width: 0.78em;
  height: 0.95em;
  background: var(--who, #8a6a43);
  clip-path: polygon(50% 0, 86% 16%, 100% 100%, 0 100%, 14% 16%);
}
.novel__name--empty { visibility: hidden; }
.novel__text {
  min-height: calc(1.7em * 3);
  margin: 0 0 0 0.5em;
  font-size: var(--novel-text-size);
  font-weight: 600;
  line-height: 1.7;
  white-space: pre-wrap;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.55);
}
.novel__rest { color: transparent; text-shadow: none; }
.novel__text--narration { color: #5b4630; }
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
  justify-content: space-between;
  gap: 0.6em;
}
/* 送りの印: 駒の形と「つぎへ」(最後は「おわり」) */
.novel__next {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  margin-right: 0.3em;
  color: #4a321a;
  font-size: calc(var(--novel-text-size) * 0.72);
  font-weight: 900;
  letter-spacing: 0.12em;
  opacity: 0;
}
.novel__next-piece {
  width: 0.8em;
  height: 1em;
  background: #4a321a;
  clip-path: polygon(50% 0, 86% 16%, 100% 100%, 0 100%, 14% 16%);
}
.novel__next--shown {
  opacity: 1;
  animation: novel-next 900ms ease-in-out infinite;
}
/* オートの待ちの線: 窓の下の端を左から伸び、伸びきったら次の行(4-1) */
.novel__auto-line {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 3px;
  background: var(--novel-accent);
  transform-origin: left center;
  animation: novel-auto-wait linear forwards;
}
.novel__bar {
  display: flex;
  gap: 0.1em;
  cursor: default;
}
.novel .novel__tool {
  box-shadow: none;
  min-width: 44px;
  min-height: 44px;
  padding: 0.2em 0.6em;
  border: 0;
  border-radius: 0.5em;
  color: #6b4f2c;
  background: transparent;
  font: inherit;
  font-size: 0.82em;
  font-weight: 800;
  letter-spacing: 0.05em;
  cursor: pointer;
}
.novel .novel__tool:hover, .novel .novel__tool:focus-visible { color: #3b2a1a; background: rgba(140, 90, 30, 0.14); outline: none; }
.novel .novel__tool:focus-visible { box-shadow: 0 0 0 0.12em var(--novel-accent); }
.novel .novel__tool:active { transform: scale(0.94); }
.novel .novel__tool--on { color: #2a1c0e; background: var(--novel-accent); }
.novel .novel__tool--on:hover, .novel .novel__tool--on:focus-visible { color: #2a1c0e; background: #ffc27a; }
/* ログ・設定のシートの中の「閉じる」は暗い地なので明るい字 */
.novel__panel .novel__tool { color: rgba(255, 252, 244, 0.82); }
.novel__panel .novel__tool:hover, .novel__panel .novel__tool:focus-visible { color: var(--novel-ink); background: rgba(255, 252, 244, 0.12); }

.novel .novel__skip {
  box-shadow: none;
  position: absolute;
  top: 0.55em;
  right: 0.8em;
  z-index: 2;
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
  z-index: 2;
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
  50% { transform: translateY(0.2em); opacity: 0.55; }
}
@keyframes novel-place-in {
  from { opacity: 0; transform: translateX(-1.2em); }
  to { opacity: 1; transform: none; }
}
@keyframes novel-person-in {
  from { opacity: 0; transform: translateY(3%); }
  to { opacity: 1; }
}
@keyframes novel-hop {
  0% { transform: translateY(-0.6%); }
  40% { transform: translateY(-2.2%); }
  100% { transform: translateY(-0.6%); }
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
  .novel__keys { display: none; }
}
/* 縦の画面は幅で大きさが決まるので、2人を少し重ねて大きく映す */
@media (orientation: portrait) {
  .novel__stage { --slot: 96cqw; }
  .novel__stage--pair { --slot: 86cqw; }
  .novel__person--left { left: 25%; }
  .novel__person--right { left: 75%; }
}
/* 横向きの低い画面は、文を2行分にし、窓を低くする */
@media (orientation: landscape) and (max-height: 500px) {
  .novel__stage { --headroom: 4cqh; }
  .novel__box { padding-top: 1.1em; }
  .novel__name { margin-bottom: 0.15em; padding-top: 0.15em; padding-bottom: 0.15em; }
  .novel__text { min-height: calc(1.6em * 2); line-height: 1.6; }
  .novel__place { top: 0.4em; }
  .novel__keys { display: none; }
}
/* 広い画面は2行で足りる */
@media (min-width: 1000px) and (min-height: 600px) {
  .novel__text { min-height: calc(1.7em * 2); }
}
@media (prefers-reduced-motion: reduce) {
  .novel__person, .novel__stage, .novel__place { transition: none; animation: none; }
  .novel__person--quiet, .novel__person--active { transform: none; }
  .novel__next--shown, .novel .novel__choice, .novel__sheet, .novel__hidden-hint { animation: none; }
  .novel__auto-line { animation-name: none; transform: scaleX(1); opacity: 0.5; }
}
</style>
