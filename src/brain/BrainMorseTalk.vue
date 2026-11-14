<template>
  <!--
    モールス信号で話す「無線で話す」(docs/brain-training-design.mdの18章)。
    相手(やこび姫・羽音)の信号を音とランプで受け取り、電鍵(押す長さでトンとツー)で返事を打って送る。
  -->
  <section class="brain-talk" :class="`brain-talk--${phase}`" aria-label="無線で話す" data-brain-talk>
    <!-- 交信の一覧 -->
    <template v-if="phase === 'list'">
      <div class="brain-talk__intro">
        <p class="brain-talk__title"><span aria-hidden="true">📻</span> 無線で話す</p>
        <p class="brain-talk__lead">覚えた符号で、本当に話そう。キーを短く押すとトン、長く押すとツー。</p>
      </div>
      <div class="brain-talk__settings" role="group" aria-label="設定">
        <button type="button" class="brain-talk__chip" data-talk-setting="speed" @click="cycleSetting('speed')">速さ<b>{{ speedLabel }}</b></button>
        <button type="button" class="brain-talk__chip" data-talk-setting="keyMode" @click="cycleSetting('keyMode')">打ち方<b>{{ settings.keyMode === "key" ? "電鍵" : "ボタン" }}</b></button>
        <button type="button" class="brain-talk__chip" data-talk-setting="caption" @click="cycleSetting('caption')">字幕<b>{{ settings.caption === "live" ? "すぐ出す" : "あとで" }}</b></button>
      </div>
      <ul class="brain-talk__list">
        <li v-for="row in rows" :key="row.talk.id">
          <button type="button" class="brain-talk__card" :class="{ 'brain-talk__card--done': row.done }" :disabled="!row.open" :data-talk-open="row.talk.id" @click="startTalk(row.talk.id)">
            <span class="brain-talk__avatar" :class="`brain-talk__avatar--${row.partner.id}`" aria-hidden="true">{{ row.partner.mark }}</span>
            <span class="brain-talk__card-body">
              <strong>{{ row.talk.title }}<small v-if="row.done" class="brain-talk__check">✓</small></strong>
              <small>{{ row.open ? row.talk.desc : row.lock }}</small>
            </span>
            <span v-if="row.best" class="brain-talk__best">耳だけ<b>{{ row.best.ears }}/{{ row.best.total }}</b></span>
          </button>
        </li>
      </ul>
      <p v-if="talkProgress.sent" class="brain-talk__note">これまでに送った文字 {{ talkProgress.sent }}</p>
    </template>

    <!-- 会話 -->
    <template v-else-if="phase === 'chat'">
      <div class="brain-talk__pane brain-talk__pane--log">
        <header class="brain-talk__head">
          <span class="brain-talk__avatar" :class="`brain-talk__avatar--${partner.id}`" aria-hidden="true">{{ partner.mark }}</span>
          <strong>{{ partner.name }}</strong>
          <span class="brain-talk__lamp" :class="{ 'brain-talk__lamp--on': lampOn, 'brain-talk__lamp--me': pressing }" aria-hidden="true"></span>
          <small>{{ receiving ? "受信中…" : talk?.free ? "自由に話す" : `やりとり ${replyCount}` }}</small>
        </header>
        <ol ref="logEl" class="brain-talk__log" aria-live="polite">
          <li v-for="entry in entries" :key="entry.id" class="brain-talk__entry" :class="`brain-talk__entry--${entry.who}`" :data-talk-entry="entry.who">
            <template v-if="entry.who === 'say'">{{ entry.say }}</template>
            <div v-else class="brain-talk__bubble">
              <p class="brain-talk__letters" :aria-label="entry.revealed === 'all' || entry.who === 'me' ? entry.text : '受信した信号'">
                <span v-for="(item, index) in entry.chars" :key="index" class="brain-talk__char" :class="{ 'brain-talk__char--space': item.letter === ' ', 'brain-talk__char--lit': entry.lit === index }">
                  <b v-if="item.letter !== ' '" :class="{ 'brain-talk__unknown': item.letter === '?' }">{{ showLetter(entry, index) ? item.letter : "□" }}</b>
                  <span v-if="item.letter !== ' ' && showMarks(entry, index)" class="brain-talk__marks" aria-hidden="true">
                    <i v-for="(mark, markIndex) in item.code" :key="markIndex" class="brain-morse__mark" :class="mark === '-' ? 'brain-morse__mark--dash' : 'brain-morse__mark--dot'"></i>
                  </span>
                </span>
              </p>
              <p v-if="entry.who === 'them' && entry.revealed === 'all' && entry.mean" class="brain-talk__mean">＝{{ entry.mean }}</p>
              <div v-if="entry.who === 'them' && entry.id === lastThemId && !entry.done" class="brain-talk__tools">
                <button type="button" class="brain-talk__tool" :disabled="receiving" data-talk-replay @click="replay"><span aria-hidden="true">♪</span> もう一度</button>
                <button v-if="entry.revealed === 'none'" type="button" class="brain-talk__tool" data-talk-peek="marks" @click="peek('marks')">符号</button>
                <button v-if="entry.revealed !== 'all'" type="button" class="brain-talk__tool" data-talk-peek="all" @click="peek('all')">訳</button>
              </div>
            </div>
          </li>
        </ol>
      </div>
      <div class="brain-talk__pane brain-talk__pane--key">
        <div v-if="lead || hintRows.length" class="brain-talk__guide">
          <p v-if="lead" class="brain-talk__lead-line" data-talk-lead><span class="brain-talk__avatar brain-talk__avatar--small" :class="`brain-talk__avatar--${partner.id}`" aria-hidden="true">{{ partner.mark }}</span>{{ lead }}</p>
          <div v-if="hintRows.length" class="brain-talk__hints">
            <button v-if="!hintOpen" type="button" class="brain-talk__tool" data-talk-hint @click="openHint">返事のヒント</button>
            <ul v-else class="brain-talk__hint-list">
              <li v-for="hint in hintRows" :key="hint.word" data-talk-hint-row>
                <b>{{ hint.word }}</b><small>{{ hint.mean }}</small>
                <span v-if="clueMarks && hint.code.length" class="brain-talk__marks" aria-hidden="true">
                  <template v-for="(code, codeIndex) in hint.code" :key="codeIndex">
                    <i v-for="(mark, markIndex) in code" :key="`${codeIndex}-${markIndex}`" class="brain-morse__mark" :class="mark === '-' ? 'brain-morse__mark--dash' : 'brain-morse__mark--dot'"></i>
                    <i v-if="Number(codeIndex) < hint.code.length - 1" class="brain-talk__gap"></i>
                  </template>
                </span>
              </li>
            </ul>
          </div>
        </div>
        <div class="brain-talk__compose" :class="{ 'brain-talk__compose--empty': !keying.letters.length && !keying.current }" data-talk-compose>
          <p class="brain-talk__typed" aria-live="polite">
            <span v-if="!keying.letters.length && !keying.current && !pressing" class="brain-talk__placeholder">{{ receiving ? "受信中は待ってね" : "ここに打った文字が出るよ" }}</span>
            <span v-for="(item, index) in keying.letters" :key="index" class="brain-talk__char" :class="{ 'brain-talk__char--space': item.letter === ' ' }">
              <b v-if="item.letter !== ' '" :class="{ 'brain-talk__unknown': item.letter === '?' }">{{ item.letter }}</b>
            </span>
            <span v-if="keying.current || pressing" class="brain-talk__current" data-talk-current>
              <span class="brain-talk__marks">
                <i v-for="(mark, index) in keying.current" :key="index" class="brain-morse__mark" :class="mark === '-' ? 'brain-morse__mark--dash' : 'brain-morse__mark--dot'"></i>
                <i v-if="pressing" class="brain-morse__mark brain-morse__mark--lit" :class="pressPreview === '-' ? 'brain-morse__mark--dash' : 'brain-morse__mark--dot'"></i>
              </span>
              <svg class="brain-talk__ring" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" :style="{ strokeDashoffset: String(50.3 * (1 - ringProgress)) }" /></svg>
            </span>
          </p>
          <button type="button" class="brain-talk__erase" :disabled="!keying.letters.length && !keying.current" data-talk-erase @click="erase">消す</button>
          <button type="button" class="brain-talk__send" :disabled="receiving || (!keying.letters.length && !keying.current)" data-talk-send @click="send">送信</button>
        </div>
        <div v-if="settings.keyMode === 'key'" class="brain-talk__keybox">
          <div class="brain-talk__bar" aria-hidden="true">
            <span class="brain-talk__bar-fill" :style="{ width: `${pressRatio * 100}%` }" :class="{ 'brain-talk__bar-fill--dash': pressPreview === '-' }"></span>
            <span class="brain-talk__bar-line"></span>
            <small class="brain-talk__bar-dot">トン</small><small class="brain-talk__bar-dash">ツー</small>
          </div>
          <button
            type="button"
            class="brain-talk__key"
            :class="{ 'brain-talk__key--down': pressing, 'brain-talk__key--wait': receiving }"
            :aria-disabled="receiving"
            data-talk-key
            @pointerdown.prevent="onPointerDown"
            @pointerup="onPointerUp"
            @pointercancel="onPointerUp"
            @lostpointercapture="onPointerUp"
            @contextmenu.prevent
          >
            <span>{{ receiving ? "受信中" : "電鍵" }}</span>
            <small>{{ receiving ? "" : "押す長さで トン・ツー" }}</small>
          </button>
        </div>
        <div v-else class="brain-talk__buttons">
          <button type="button" class="brain-morse__key" :disabled="receiving" data-talk-dot @click="tap('.')"><i class="brain-morse__mark brain-morse__mark--dot" aria-hidden="true"></i>トン</button>
          <button type="button" class="brain-morse__key" :disabled="receiving" data-talk-dash @click="tap('-')"><i class="brain-morse__mark brain-morse__mark--dash" aria-hidden="true"></i>ツー</button>
        </div>
      </div>
    </template>

    <!-- 交信おわり -->
    <template v-else>
      <div class="brain-talk__done" data-talk-done>
        <p class="brain-talk__title"><span aria-hidden="true">📻</span> 交信おわり</p>
        <p class="brain-talk__done-say"><span class="brain-talk__avatar brain-talk__avatar--small" :class="`brain-talk__avatar--${partner.id}`" aria-hidden="true">{{ partner.mark }}</span>{{ doneSay }}</p>
        <ul class="brain-talk__stats">
          <li><span>やりとり</span><strong>{{ replyCount }}回</strong></li>
          <li><span>耳だけで読めた</span><strong>{{ ears }}/{{ replyCount }}</strong></li>
          <li><span>送った文字</span><strong>{{ sentLetters }}</strong></li>
        </ul>
        <p v-if="doneNote" class="brain-talk__note">{{ doneNote }}</p>
      </div>
      <div class="brain-game__actions">
        <button type="button" class="brain-game__primary" data-brain-next @click="finishTalk">成績表へ</button>
        <button type="button" class="brain-game__secondary" data-talk-back @click="backToList">ほかの交信</button>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, type PropType } from "vue";
import {
  backspaceKeying,
  commitKeying,
  emptyKeying,
  keyDown,
  keySpeed,
  keyTick,
  keyUp,
  keyingText,
  letterProgress,
  messageTimeline,
  tapMark,
  textCodes,
} from "../core/morse-key.mjs";
import {
  CLUE_AFTER_MISSES,
  completeTalk,
  earsPercent,
  freeAnswer,
  incomingSpeed,
  matchReply,
  partnerOf,
  talkById,
  talkList,
  talkNode,
} from "../core/morse-talk.mjs";
import { TALK_CAPTIONS, TALK_KEY_MODES, TALK_SPEED_VALUES } from "../core/palace-morse.mjs";
import { brainAudio } from "../brain-audio";

type TalkProgress = { done: string[]; ears: Record<string, { ears: number; total: number }>; sent: number; speed: string; keyMode: string; caption: string };
type Talk = NonNullable<ReturnType<typeof talkById>>;
type Node = NonNullable<ReturnType<typeof talkNode>>;
type Char = { letter: string; code: string };
type Entry = { id: number; who: "them" | "me" | "say"; text: string; chars: Char[]; mean: string; say: string; revealed: "none" | "marks" | "all" | "live"; shown: number; lit: number; done: boolean };
export type TalkFinish = { kind: "talk"; title: string; ears: number; total: number; sent: number; percent: number };

const props = defineProps({
  courses: { type: Object as PropType<{ talk: TalkProgress }>, required: true },
});
const emit = defineEmits<{
  /** 進み具合と設定を保存する(コースの保存のtalkに入れるのは親)。 */
  (event: "save", talk: TalkProgress): void;
  (event: "finish", result: TalkFinish): void;
}>();

/** 相手が返事を受け取ってから、次の信号を送るまでの間(読んで考える時間)。 */
const REPLY_DELAY_MS = 700;
/** 信号を鳴らし始めるまでの間(吹き出しが出てから)。 */
const PLAY_DELAY_MS = 450;
/** 押す長さのバーの右端(境目の2倍)。 */
const BAR_SPAN = 2;

const phase = ref<"list" | "chat" | "done">("list");
const talkProgress = computed(() => props.courses.talk);
const settings = computed(() => talkProgress.value);
const rows = computed(() => talkList(talkProgress.value));
const speedLabel = computed(() => keySpeed(settings.value.speed).label);

function saveTalk(next: TalkProgress) {
  emit("save", next);
}
function cycleSetting(field: "speed" | "keyMode" | "caption") {
  const values: readonly string[] = field === "speed" ? TALK_SPEED_VALUES : field === "keyMode" ? TALK_KEY_MODES : TALK_CAPTIONS;
  const current = values.indexOf(settings.value[field]);
  brainAudio().play("tick");
  saveTalk({ ...talkProgress.value, [field]: values[(current + 1) % values.length] });
}

// ===== 会話の状態 =====
const talkId = ref("");
const talk = computed<Talk | null>(() => (talkId.value ? talkById(talkId.value) : null));
const partner = computed(() => partnerOf(talk.value));
const node = ref<Node | null>(null);
const entries = ref<Entry[]>([]);
const lastThemId = ref(-1);
const lead = ref("");
const receiving = ref(false);
const lampOn = ref(false);
const hintOpen = ref(false);
const clueMarks = ref(false);
const peeked = ref(false);
const misses = ref(0);
const replyCount = ref(0);
const ears = ref(0);
const sentLetters = ref(0);
const doneSay = ref("");
const doneNote = ref("");
const logEl = ref<HTMLElement | null>(null);
let entryId = 0;
let context: { text: string; hour: number } = { text: "", hour: 12 };
let freeLast = "HI";

const speedId = computed(() => keySpeed(settings.value.speed).id);
const inSpeed = computed(() => incomingSpeed(talk.value, speedId.value));
const hintRows = computed(() => {
  if (!node.value || node.value.end) return [];
  return node.value.replies.flatMap((reply) =>
    reply.free ? [{ word: "名前", mean: reply.mean, code: [] as string[] }] : [{ word: reply.words[0], mean: reply.mean, code: textCodes(reply.words[0]) }],
  );
});

// ===== タイマー =====
let flowTimers: ReturnType<typeof setTimeout>[] = [];
let signalTimers: ReturnType<typeof setTimeout>[] = [];
function later(fn: () => void, ms: number) {
  flowTimers.push(setTimeout(fn, ms));
}
function stopSignal() {
  for (const timer of signalTimers) clearTimeout(timer);
  signalTimers = [];
  brainAudio().stopSignal();
  lampOn.value = false;
  receiving.value = false;
}
function clearAll() {
  for (const timer of flowTimers) clearTimeout(timer);
  flowTimers = [];
  stopSignal();
  releaseKey();
}

function chars(text: string): Char[] {
  const codes = textCodes(text);
  return [...text].map((letter, index) => ({ letter, code: codes[index] ?? "" }));
}
function pushEntry(who: Entry["who"], text: string, extra: Partial<Entry> = {}) {
  entryId += 1;
  const entry: Entry = { id: entryId, who, text, chars: chars(text), mean: "", say: "", revealed: "all", shown: text.length, lit: -1, done: false, ...extra };
  entries.value.push(entry);
  void nextTick(() => logEl.value?.scrollTo({ top: logEl.value.scrollHeight, behavior: "smooth" }));
  return entries.value[entries.value.length - 1];
}
function sayLine(text: string) {
  if (text) pushEntry("say", "", { say: text });
}
function showLetter(entry: Entry, index: number) {
  if (entry.who !== "them") return true;
  if (entry.revealed === "all") return true;
  return entry.revealed === "live" && index < entry.shown;
}
function showMarks(entry: Entry, index: number) {
  if (entry.who === "me") return true;
  if (entry.revealed === "marks" || entry.revealed === "all") return true;
  return entry.revealed === "live" && index < entry.shown;
}

/** 相手の信号を鳴らす。ランプは音に合わせて点き、字幕「すぐ出す」なら文字も音に合わせて出る。 */
function playEntry(entry: Entry, after?: () => void) {
  stopSignal();
  releaseKey();
  receiving.value = true;
  const { marks, letters, total } = messageTimeline(entry.text, inSpeed.value);
  brainAudio().signal(marks);
  if (entry.revealed === "live") entry.shown = 0;
  for (const mark of marks) {
    signalTimers.push(setTimeout(() => { lampOn.value = true; entry.lit = mark.letter; }, mark.at + 30));
    signalTimers.push(setTimeout(() => { lampOn.value = false; }, mark.at + mark.ms + 30));
  }
  for (const item of letters) signalTimers.push(setTimeout(() => { if (entry.revealed === "live") entry.shown = Math.max(entry.shown, item.index + 1); }, item.end + 30));
  signalTimers.push(setTimeout(() => {
    receiving.value = false;
    lampOn.value = false;
    entry.lit = -1;
    if (entry.revealed === "live") entry.shown = entry.text.length;
    after?.();
  }, total + 120));
}

/** 相手から信号が届く。 */
function receive(text: string, mean: string, after?: () => void, track = true) {
  // AGN(もう一度)は相手の一言で中身を言っているので、はじめから見せる。
  const revealed = !track ? "all" : settings.value.caption === "live" ? "live" : "none";
  const entry = pushEntry("them", text, { mean, revealed, shown: revealed === "all" ? text.length : 0 });
  // 「もう一度・符号・訳」は、いまのやりとりの信号にだけ付ける(AGNには付けない)。
  if (track) lastThemId.value = entry.id;
  // 吹き出しが出た時から受信中にする(鳴り始めるまでの間にキーを押して、途中で止まらないように)。
  releaseKey();
  receiving.value = true;
  later(() => playEntry(entry, after), PLAY_DELAY_MS);
  return entry;
}
function lastThem() {
  return entries.value.find((entry) => entry.id === lastThemId.value) ?? null;
}

// ===== 交信の流れ =====
function startTalk(id: string) {
  const picked = talkById(id);
  if (!picked) return;
  clearAll();
  brainAudio().play("tick");
  talkId.value = picked.id;
  entries.value = [];
  entryId = 0;
  lastThemId.value = -1;
  replyCount.value = 0;
  ears.value = 0;
  sentLetters.value = 0;
  keying.value = emptyKeying();
  context = { text: "", hour: new Date().getHours() };
  freeLast = "HI";
  phase.value = "chat";
  if (picked.free) {
    node.value = null;
    lead.value = "なんでも送ってみて。知っている言葉なら、中身で返すよ。知らない言葉は「R（受け取った）」と送り返すね。";
    hintOpen.value = false;
    receive("HI", "やあ");
    return;
  }
  goNode(picked.start);
}
function goNode(id: string) {
  if (!talk.value) return;
  const next = talkNode(talk.value, id, context);
  if (!next) return;
  node.value = next;
  peeked.value = settings.value.caption === "live";
  misses.value = 0;
  hintOpen.value = false;
  clueMarks.value = false;
  lead.value = next.lead;
  const entry = receive(next.send, next.mean, next.end ? () => endTalk(next) : undefined);
  if (next.end) entry.done = true;
}
function endTalk(last: Node) {
  const entry = lastThem();
  if (entry) entry.revealed = "all";
  later(() => {
    doneSay.value = last.say;
    const result = completeTalk(talkProgress.value as Parameters<typeof completeTalk>[0], talk.value!.id, { ears: ears.value, total: replyCount.value, sent: sentLetters.value });
    doneNote.value = result.opened.length ? `次の交信「${result.opened.map((item) => item.title).join("」「")}」が開いたよ。` : "";
    saveTalk(result.progress as TalkProgress);
    brainAudio().play("finish");
    phase.value = "done";
  }, 900);
}

function replay() {
  const entry = lastThem();
  if (entry && !receiving.value) playEntry(entry);
}
function peek(level: "marks" | "all") {
  const entry = lastThem();
  if (!entry) return;
  peeked.value = true;
  entry.revealed = level;
  entry.shown = entry.text.length;
}
function openHint() {
  peeked.value = true;
  hintOpen.value = true;
}

/** 送信。相手が照らし合わせて、通じたら次へ、通じなければAGN。 */
function send() {
  if (receiving.value || !talk.value) return;
  releaseKey();
  keying.value = commitKeying(keying.value);
  const text = keyingText(keying.value);
  if (!text) return;
  pushEntry("me", text);
  keying.value = emptyKeying();
  sentLetters.value += text.replace(/ /g, "").length;
  brainAudio().play("place");
  if (talk.value.free) {
    // 返事をしたら、前の信号の中身を見せる(答え合わせ)。
    const previous = lastThem();
    if (previous) {
      previous.revealed = "all";
      previous.done = true;
    }
    const answer = freeAnswer(text, freeLast);
    if (!answer) return;
    freeLast = answer.send === "AGN" ? freeLast : answer.send;
    later(() => {
      sayLine(answer.say);
      receive(answer.send, answer.mean);
    }, REPLY_DELAY_MS);
    saveTalk({ ...talkProgress.value, sent: talkProgress.value.sent + text.replace(/ /g, "").length });
    return;
  }
  const current = node.value;
  if (!current) return;
  const result = matchReply(current, text);
  if (result.kind === "empty") return;
  if ((result.kind === "ok" || result.kind === "near") && result.reply) {
    const reply = result.reply;
    replyCount.value += 1;
    if (!peeked.value) ears.value += 1;
    const entry = lastThem();
    if (entry) {
      entry.revealed = "all";
      entry.done = true;
    }
    if (reply.free && "text" in result && result.text) context = { ...context, text: result.text };
    brainAudio().play("correct");
    lead.value = "";
    later(() => {
      if (result.kind === "near") sayLine(`${result.guess}のことだね。1文字ちがったけど、伝わったよ。`);
      sayLine(reply.react);
      goNode(reply.next);
    }, REPLY_DELAY_MS);
    return;
  }
  misses.value += 1;
  brainAudio().play("miss");
  later(() => {
    const guess = result.kind === "miss" && result.guess ? `「${result.guess}」かな？` : result.kind === "unreadable" ? "「？」の文字が読めなかった。" : "";
    sayLine(`${partner.value.agn}${guess ? ` ${guess}` : ""}`);
    if (misses.value >= CLUE_AFTER_MISSES) {
      hintOpen.value = true;
      clueMarks.value = true;
      peeked.value = true;
      sayLine(current.clue || "返事の符号を出したよ。見ながら打ってみて。");
    }
    receive("AGN", "もう一度", undefined, false).done = true;
  }, REPLY_DELAY_MS);
}

function finishTalk() {
  if (!talk.value) return;
  emit("finish", {
    kind: "talk",
    title: `無線で話す「${talk.value.title}」`,
    ears: ears.value,
    total: replyCount.value,
    sent: sentLetters.value,
    percent: earsPercent(ears.value, replyCount.value),
  });
}
function backToList() {
  clearAll();
  phase.value = "list";
}

// ===== 電鍵 =====
const keying = ref(emptyKeying());
const pressing = ref(false);
const now = ref(0);
let ticker: ReturnType<typeof setInterval> | null = null;
const pressRatio = computed(() => {
  if (!pressing.value || keying.value.downAt === null) return 0;
  return Math.min(1, (now.value - keying.value.downAt) / (keySpeed(speedId.value).dashAt * BAR_SPAN));
});
const pressPreview = computed(() => (pressing.value && keying.value.downAt !== null && now.value - keying.value.downAt >= keySpeed(speedId.value).dashAt ? "-" : "."));
const ringProgress = computed(() => letterProgress(keying.value, now.value, speedId.value));

function clock() {
  return performance.now();
}
function pressKey() {
  if (phase.value !== "chat" || receiving.value || pressing.value) return;
  now.value = clock();
  keying.value = keyDown(keying.value, now.value, speedId.value);
  pressing.value = true;
  brainAudio().keyOn();
}
function releaseKey() {
  if (!pressing.value) return;
  pressing.value = false;
  brainAudio().keyOff();
  now.value = clock();
  keying.value = keyUp(keying.value, now.value, speedId.value).state;
}
function onPointerDown(event: PointerEvent) {
  if (event.button !== 0 && event.pointerType === "mouse") return;
  try {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  } catch {
    // 捕まえられなくても押せる。
  }
  pressKey();
}
function onPointerUp() {
  releaseKey();
}
function tap(mark: "." | "-") {
  if (receiving.value) return;
  now.value = clock();
  keying.value = tapMark(keying.value, mark, now.value, speedId.value);
  brainAudio().morse(mark);
}
function erase() {
  keying.value = backspaceKeying(keying.value);
}

/** 押しているあいだと、打ちかけの文字があるあいだだけ時計を進める(ほかは描き直さない)。 */
function tick() {
  if (phase.value !== "chat" || (!pressing.value && !keying.value.current)) return;
  now.value = clock();
  keying.value = keyTick(keying.value, now.value, speedId.value);
}

// ===== キーボード(スペースが電鍵) =====
function isTyping(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null;
  return Boolean(target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA"));
}
function onKeyDown(event: KeyboardEvent) {
  if (phase.value !== "chat" || event.ctrlKey || event.metaKey || event.altKey || isTyping(event)) return;
  const key = event.key;
  if (event.code === "Space" || key === " ") {
    event.preventDefault();
    if (settings.value.keyMode === "key" && !event.repeat) pressKey();
  } else if (settings.value.keyMode === "buttons" && (key === "." || key === "j")) {
    event.preventDefault();
    tap(".");
  } else if (settings.value.keyMode === "buttons" && (key === "-" || key === "k")) {
    event.preventDefault();
    tap("-");
  } else if (key === "Backspace") {
    event.preventDefault();
    erase();
  } else if (key === "Enter") {
    event.preventDefault();
    send();
  }
}
function onKeyUp(event: KeyboardEvent) {
  if (event.code === "Space" || event.key === " ") {
    if (phase.value === "chat") event.preventDefault();
    releaseKey();
  }
}
function onBlur() {
  releaseKey();
}

onMounted(() => {
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  ticker = setInterval(tick, 40);
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);
  window.removeEventListener("blur", onBlur);
  if (ticker) clearInterval(ticker);
  clearAll();
});

/** 見出しの戻る。会話・おわりなら一覧へ、一覧ならコースの札へ(親に任せる)。 */
function goBack() {
  if (phase.value === "list") return false;
  backToList();
  return true;
}
defineExpose({ goBack });
</script>

<style>
/* 「無線で話す」(18章)。色は道場の変数だけを使う(U:7-1)。トンは丸、ツーは横長の棒(17章と同じ印)。 */
.shogi-game .brain-talk { display: flex; flex-direction: column; gap: 0.5rem; width: 100%; height: 100%; min-height: 0; }
.shogi-game .brain-talk--list,
.shogi-game .brain-talk--done { justify-content: flex-start; }
.shogi-game .brain-talk__intro,
.shogi-game .brain-talk__done {
  display: grid;
  gap: 0.35rem;
  padding: 0.8rem 1rem;
  border-radius: var(--dojo-radius);
  color: var(--dojo-ink);
  background: var(--dojo-paper);
  box-shadow: var(--dojo-shadow);
}
.shogi-game .brain-talk__title { margin: 0; color: var(--dojo-ai); font-size: 1.15rem; font-weight: 900; }
.shogi-game .brain-talk__lead { margin: 0; font-size: 0.86rem; font-weight: 700; line-height: 1.5; }
.shogi-game .brain-talk__note { margin: 0; color: var(--dojo-light-2); font-size: 0.82rem; font-weight: 700; text-align: center; }
.shogi-game .brain-talk__done .brain-talk__note { color: var(--dojo-gold); }
.shogi-game .brain-talk__settings { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.shogi-game .brain-talk__chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 44px;
  padding: 0.3rem 0.8rem;
  border: 1px solid var(--dojo-light-2);
  border-radius: 999px;
  color: var(--dojo-light-2);
  background: transparent;
  box-shadow: none;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 800;
}
.shogi-game .brain-talk__chip b { color: var(--dojo-light); font-size: 0.92rem; }
.shogi-game .brain-talk__list { display: grid; gap: 0.4rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .brain-talk__card {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  width: 100%;
  min-height: 60px;
  padding: 0.5rem 0.8rem;
  border: 2px solid var(--dojo-rule);
  border-radius: var(--dojo-radius);
  color: var(--dojo-ink);
  background: var(--dojo-paper);
  box-shadow: none;
  font: inherit;
  text-align: left;
}
.shogi-game .brain-talk__card--done { border-color: var(--dojo-ai-light); }
.shogi-game .brain-talk__card:disabled { color: var(--dojo-ink-2); background: var(--dojo-paper-2); opacity: 0.7; }
.shogi-game .brain-talk__card-body { display: grid; flex: 1; gap: 0.1rem; min-width: 0; }
.shogi-game .brain-talk__card-body strong { font-size: 1rem; }
.shogi-game .brain-talk__card-body small { color: var(--dojo-ink-2); font-size: 0.78rem; font-weight: 700; }
.shogi-game .brain-talk__check { margin-left: 0.4rem; color: var(--dojo-good); font-size: 0.95rem; }
.shogi-game .brain-talk__best { display: grid; justify-items: end; color: var(--dojo-ink-2); font-size: 0.7rem; font-weight: 800; }
.shogi-game .brain-talk__best b { color: var(--dojo-ai); font-size: 1rem; }
.shogi-game .brain-talk__avatar {
  display: inline-grid;
  flex: none;
  place-items: center;
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 50%;
  color: var(--dojo-light);
  background: var(--dojo-shu);
  font-size: 1.05rem;
  font-weight: 900;
}
.shogi-game .brain-talk__avatar--hanane { background: var(--dojo-ai); }
.shogi-game .brain-talk__avatar--small { width: 1.6rem; height: 1.6rem; margin-right: 0.4rem; font-size: 0.8rem; vertical-align: middle; }

/* 会話 */
.shogi-game .brain-talk__pane { display: flex; flex-direction: column; gap: 0.45rem; min-height: 0; }
.shogi-game .brain-talk__pane--log { flex: 1; }
.shogi-game .brain-talk__head { display: flex; align-items: center; gap: 0.5rem; color: var(--dojo-light); font-size: 0.95rem; }
.shogi-game .brain-talk__head small { margin-left: auto; color: var(--dojo-light-2); font-size: 0.78rem; font-weight: 700; }
.shogi-game .brain-talk__lamp {
  width: 1rem;
  height: 1rem;
  border: 2px solid var(--dojo-light-2);
  border-radius: 50%;
  background: var(--dojo-desk-3);
  transition: background-color 30ms;
}
.shogi-game .brain-talk__lamp--on { border-color: var(--dojo-now); background: var(--dojo-now); box-shadow: 0 0 10px var(--dojo-now); }
.shogi-game .brain-talk__lamp--me { border-color: var(--dojo-light); background: var(--dojo-light); }
.shogi-game .brain-talk__log {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.45rem;
  min-height: 0;
  margin: 0;
  padding: 0.6rem;
  overflow-y: auto;
  border-radius: var(--dojo-radius);
  background: var(--dojo-desk-2);
  list-style: none;
}
.shogi-game .brain-talk__entry { display: flex; }
.shogi-game .brain-talk__entry--me { justify-content: flex-end; }
.shogi-game .brain-talk__entry--say { align-self: flex-start; max-width: 92%; color: var(--dojo-light); font-size: 0.86rem; font-weight: 700; line-height: 1.5; }
.shogi-game .brain-talk__bubble {
  display: grid;
  gap: 0.25rem;
  max-width: 92%;
  padding: 0.45rem 0.7rem;
  border-radius: 12px 12px 12px 4px;
  color: var(--dojo-ink);
  background: var(--dojo-paper);
}
.shogi-game .brain-talk__entry--me .brain-talk__bubble { border-radius: 12px 12px 4px 12px; background: var(--dojo-ai-soft); }
.shogi-game .brain-talk__letters { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 0.15rem 0.4rem; margin: 0; }
.shogi-game .brain-talk__char { display: inline-grid; justify-items: center; gap: 0.15rem; min-width: 1.1rem; }
.shogi-game .brain-talk__char b { font-family: ui-monospace, "SFMono-Regular", Menlo, monospace; font-size: 1.35rem; line-height: 1; }
.shogi-game .brain-talk__char--space { min-width: 0.6rem; }
.shogi-game .brain-talk__char--lit b { color: var(--dojo-shu); }
.shogi-game .brain-talk__unknown { color: var(--dojo-shu); }
.shogi-game .brain-talk__marks { display: inline-flex; align-items: center; gap: 0.15rem; }
.shogi-game .brain-talk__marks .brain-morse__mark--dot { width: 0.42rem; height: 0.42rem; }
.shogi-game .brain-talk__marks .brain-morse__mark--dash { width: 1.2rem; height: 0.42rem; border-radius: 0.21rem; }
.shogi-game .brain-talk__gap { display: inline-block; width: 0.45rem; }
.shogi-game .brain-talk__mean { margin: 0; color: var(--dojo-ink-2); font-size: 0.82rem; font-weight: 800; }
.shogi-game .brain-talk__tools { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.shogi-game .brain-talk__tool {
  min-height: 36px;
  padding: 0.2rem 0.7rem;
  border: 1.5px solid var(--dojo-ai-light);
  border-radius: 999px;
  color: var(--dojo-ai);
  background: #fff;
  box-shadow: none;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 800;
}
.shogi-game .brain-talk__tool:disabled { opacity: 0.5; }
.shogi-game .brain-talk__guide { display: grid; gap: 0.3rem; }
.shogi-game .brain-talk__lead-line { margin: 0; color: var(--dojo-light); font-size: 0.84rem; font-weight: 700; line-height: 1.45; }
.shogi-game .brain-talk__hints { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.shogi-game .brain-talk__hint-list { display: flex; flex-wrap: wrap; gap: 0.3rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .brain-talk__hint-list li {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.15rem 0.35rem;
  padding: 0.2rem 0.55rem;
  border-radius: 8px;
  color: var(--dojo-ink);
  background: var(--dojo-paper-2);
  font-size: 0.78rem;
}
.shogi-game .brain-talk__hint-list b { font-family: ui-monospace, "SFMono-Regular", Menlo, monospace; font-size: 0.95rem; }
.shogi-game .brain-talk__hint-list small { color: var(--dojo-ink-2); font-weight: 700; }
.shogi-game .brain-talk__compose {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 56px;
  padding: 0.35rem 0.4rem 0.35rem 0.7rem;
  border-radius: var(--dojo-radius);
  color: var(--dojo-ink);
  background: var(--dojo-paper);
}
.shogi-game .brain-talk__typed { display: flex; flex: 1; flex-wrap: wrap; align-items: center; gap: 0.1rem 0.3rem; min-width: 0; margin: 0; }
.shogi-game .brain-talk__placeholder { color: var(--dojo-ink-2); font-size: 0.8rem; font-weight: 700; }
.shogi-game .brain-talk__current { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.15rem 0.35rem; border-radius: 8px; background: var(--dojo-paper-2); }
.shogi-game .brain-talk__current .brain-morse__mark--dot { width: 0.6rem; height: 0.6rem; }
.shogi-game .brain-talk__current .brain-morse__mark--dash { width: 1.7rem; height: 0.6rem; }
.shogi-game .brain-talk__ring { width: 1.1rem; height: 1.1rem; transform: rotate(-90deg); }
.shogi-game .brain-talk__ring circle { fill: none; stroke: var(--dojo-ai); stroke-width: 3; stroke-dasharray: 50.3; }
.shogi-game .brain-talk__erase,
.shogi-game .brain-talk__send {
  flex: none;
  min-width: 56px;
  min-height: 44px;
  padding: 0.2rem 0.7rem;
  border-radius: 10px;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 900;
  box-shadow: none;
}
.shogi-game .brain-talk__erase { border: 1.5px solid var(--dojo-rule); color: var(--dojo-ink-2); background: #fff; }
.shogi-game .brain-talk__send { border: 0; color: var(--dojo-light); background: var(--dojo-ai); }
.shogi-game .brain-talk__erase:disabled,
.shogi-game .brain-talk__send:disabled { opacity: 0.45; }
.shogi-game .brain-talk__keybox { display: grid; justify-items: center; gap: 0.35rem; }
.shogi-game .brain-talk__bar {
  position: relative;
  width: min(100%, 16rem);
  height: 0.55rem;
  border-radius: 999px;
  background: var(--dojo-desk-3);
}
.shogi-game .brain-talk__bar-fill { position: absolute; inset: 0 auto 0 0; border-radius: inherit; background: var(--dojo-light-2); }
.shogi-game .brain-talk__bar-fill--dash { background: var(--dojo-now); }
.shogi-game .brain-talk__bar-line { position: absolute; top: -0.2rem; bottom: -0.2rem; left: 50%; width: 2px; background: var(--dojo-light); }
.shogi-game .brain-talk__bar-dot,
.shogi-game .brain-talk__bar-dash { position: absolute; top: 0.7rem; color: var(--dojo-light-2); font-size: 0.68rem; font-weight: 800; }
.shogi-game .brain-talk__bar-dot { left: 20%; }
.shogi-game .brain-talk__bar-dash { left: 70%; }
.shogi-game .brain-talk__key {
  display: grid;
  place-content: center;
  gap: 0.1rem;
  width: clamp(7rem, calc(24 * var(--dojo-dvh)), 9.5rem);
  aspect-ratio: 1;
  margin-top: 0.7rem;
  border: 4px solid var(--dojo-ai-deep);
  border-radius: 50%;
  color: var(--dojo-light);
  background: radial-gradient(circle at 40% 35%, var(--dojo-ai-light), var(--dojo-ai) 60%, var(--dojo-ai-deep));
  box-shadow: 0 6px 0 var(--dojo-ai-deep), 0 10px 18px rgba(0, 0, 0, 0.3);
  font: inherit;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  cursor: pointer;
}
.shogi-game .brain-talk__key span { font-size: 1.3rem; font-weight: 900; }
.shogi-game .brain-talk__key small { color: var(--dojo-ai-soft); font-size: 0.68rem; font-weight: 800; }
.shogi-game .brain-talk__key.brain-talk__key--down { transform: translateY(5px); box-shadow: 0 1px 0 var(--dojo-ai-deep), 0 4px 10px rgba(0, 0, 0, 0.3); background: radial-gradient(circle at 40% 35%, var(--dojo-now), var(--dojo-shu) 70%); }
.shogi-game .brain-talk__key.brain-talk__key--wait { filter: grayscale(0.7); opacity: 0.6; }
.shogi-game .brain-talk__buttons { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
.shogi-game .brain-talk__done-say { margin: 0; font-size: 0.92rem; font-weight: 800; line-height: 1.55; }
.shogi-game .brain-talk__stats { display: grid; gap: 0.25rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .brain-talk__stats li { display: flex; justify-content: space-between; font-weight: 800; }
.shogi-game .brain-talk__stats strong { color: var(--dojo-ai); font-variant-numeric: tabular-nums; }
.shogi-game .brain-talk__chip:focus-visible,
.shogi-game .brain-talk__card:focus-visible,
.shogi-game .brain-talk__tool:focus-visible,
.shogi-game .brain-talk__erase:focus-visible,
.shogi-game .brain-talk__send:focus-visible,
.shogi-game .brain-talk__key:focus-visible { outline: 3px solid #3c6dd1; outline-offset: 2px; }
/* 背の低い縦画面: 電鍵を小さくして、吹き出しの列に高さを回す(U:7-5)。 */
@media (orientation: portrait) and (max-height: 700px) {
  .shogi-game .brain-talk { gap: 0.35rem; }
  .shogi-game .brain-talk__key { width: 6.4rem; margin-top: 0.55rem; }
  .shogi-game .brain-talk__compose { min-height: 48px; }
  .shogi-game .brain-talk__lead-line { font-size: 0.8rem; }
}
/* 背の低い横画面: 左に吹き出し、右に打つところ(U:7-5の1)。 */
@media (orientation: landscape) and (max-height: 600px) {
  .shogi-game .brain-talk--chat { flex-direction: row; gap: 0.8rem; }
  .shogi-game .brain-talk--chat .brain-talk__pane--log { flex: 1.2; }
  .shogi-game .brain-talk--chat .brain-talk__pane--key { flex: 1; justify-content: center; }
  .shogi-game .brain-talk__key { width: min(6.6rem, calc(30 * var(--dojo-vh))); margin-top: 0.5rem; }
  .shogi-game .brain-talk--list .brain-talk__list { grid-template-columns: 1fr 1fr; }
  /* 一覧: 補足の文を省き、札を詰める(U:7-5の3)。 */
  .shogi-game .brain-talk--list { gap: 0.4rem; }
  .shogi-game .brain-talk--list .brain-talk__intro { padding: 0.45rem 0.9rem; }
  .shogi-game .brain-talk--list .brain-talk__lead { display: none; }
  .shogi-game .brain-talk__card { min-height: 50px; padding: 0.35rem 0.7rem; }
}
@media (prefers-reduced-motion: reduce) {
  .shogi-game .brain-talk__lamp { transition: none; }
}
</style>
