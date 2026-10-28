<template>
  <!--
    大会のほかの対局の中継(docs/tournament-relay-design.mdの6章)。将棋中継の記録を見るように、盤・残り時間・勝率・解説・
    視聴者のコメント・心の声を、1手ずつ再生する。見るだけで、閉じても何も失わない(確認は出さない)。
    棋譜は開いたときに裏のエンジンで作り始め、再生より先の手を作り続ける(core/relay-game.mjs)。
  -->
  <div ref="rootEl" class="relay" role="dialog" aria-modal="true" :aria-label="`対局中継 ${spec.label}`" data-relay tabindex="-1" @keydown="onKey">
    <header class="relay__head">
      <button type="button" class="relay__close" aria-label="中継を閉じる" data-relay-close @click="emit('close')">
        <span aria-hidden="true">←</span><span class="relay__close-text">閉じる</span>
      </button>
      <div class="relay__title">
        <p class="relay__event">
          <span class="relay__badge">中継</span>
          <span class="relay__label">{{ spec.label }}</span>
        </p>
        <p class="relay__chips">
          <span v-if="spec.tags?.next" class="relay__chip relay__chip--next">次の相手</span>
          <span v-if="spec.tags?.rival" class="relay__chip relay__chip--rival">ライバル</span>
          <span v-if="spec.tags?.oshi" class="relay__chip relay__chip--oshi">推し</span>
          <span class="relay__chip">解説 {{ cast.name }}{{ cast.dan }}</span>
        </p>
      </div>
      <p class="relay__audience" :aria-label="`来場者${audienceText}人、コメント${commentCountText}件`">
        <span><b>来場者</b>{{ audienceText }}</span>
        <span><b>コメント</b>{{ commentCountText }}</span>
      </p>
    </header>

    <div class="relay__body">
      <div class="relay__stage">
        <!--
          勝率バー(15章)。盤のすぐ上に置き、盤から目を離さずに見る。先手は青・後手は赤で、名前の札も同じ色にして、
          どちらの色がどちらの棋士かを、名前で分かるようにする。真ん中は「○○優勢」の一言(色だけで伝えない)。
        -->
        <div class="relay__rate" role="img" :aria-label="`AIの勝率 先手${players.black.name}${blackPercent}% 後手${players.white.name}${100 - blackPercent}% ${verdictText}`" data-relay-rate>
          <p class="relay__rate-names" aria-hidden="true">
            <span class="relay__rate-name relay__rate-name--black" data-relay-rate-black>
              <i>☗</i><span class="relay__rate-who">{{ players.black.name }}</span><b>{{ blackPercent }}%</b>
            </span>
            <span :class="['relay__rate-verdict', verdict.side ? `relay__rate-verdict--${verdict.side}` : '']" data-relay-verdict>{{ verdictText }}</span>
            <span class="relay__rate-name relay__rate-name--white" data-relay-rate-white>
              <b>{{ 100 - blackPercent }}%</b><span class="relay__rate-who">{{ players.white.name }}</span><i>☖</i>
            </span>
          </p>
          <span class="relay__rate-bar" aria-hidden="true"><span :style="{ width: `${blackPercent}%` }" /></span>
        </div>
        <div ref="boardEl" class="relay__board" :style="{ '--relay-width': `${boardWidth}px` }">
          <ShogiMatchBoard
            :sfen="boardSfen"
            :last-move="boardLastMove"
            :allow-move="false"
            :enable-drag-and-drop="false"
            layout="compact"
            :asset-base-url="assetBaseUrl"
            :black-player-name="`${spec.black.name}${spec.black.dan ? ` ${spec.black.dan}` : ''}`"
            :white-player-name="`${spec.white.name}${spec.white.dan ? ` ${spec.white.dan}` : ''}`"
            :clocks="clocks"
          />
          <!-- 視聴者のコメント(右から左へ流れる)。押せない飾りで、盤の操作は妨げない。 -->
          <div v-if="commentsOn && !reducedMotion" class="relay__danmaku" aria-hidden="true">
            <span
              v-for="item in flying"
              :key="item.id"
              :class="['relay__comment', item.tone ? `relay__comment--${item.tone}` : '', item.big ? 'relay__comment--big' : '']"
              :style="{ top: `${4 + item.lane * 12}%`, animationDelay: `${item.delay}ms`, animationDuration: `${item.duration}ms` }"
              @animationend="land(item.id)"
            >{{ item.text }}</span>
          </div>
          <!-- 運営のコメント(ニコニコ動画の上コメ)。盤の上の端に3秒止まる。休憩・終局・同じ回戦のほかの結果。 -->
          <p v-if="commentsOn && banner" :key="banner.id" class="relay__banner" aria-hidden="true" data-relay-banner>{{ banner.text }}</p>
          <!-- 心の声。対局者の名札の近く(上が後手、下が先手)。 -->
          <p
            v-for="bubble in bubbles"
            :key="`${bubble.side}-${bubble.at}`"
            :class="['relay__thought', `relay__thought--${bubble.side}`]"
            data-relay-thought
          >
            <span class="relay__thought-face" aria-hidden="true">
              <img v-if="faceSprite(bubble.side)" :src="faceSprite(bubble.side)" alt="" draggable="false">
              <i v-else>{{ players[bubble.side].name.slice(0, 1) }}</i>
            </span>
            <span class="relay__thought-text"><small>{{ players[bubble.side].name }}の心の声</small>{{ bubble.text }}</span>
          </p>
          <!-- 休憩・封じ手・秒読み・特殊能力・終局の札。押すと消える(再生は止めない)。 -->
          <button
            v-if="activeCard"
            type="button"
            :class="['relay__card', `relay__card--${activeCard.kind}`, activeCard.tier ? `relay__card--${activeCard.tier}` : '']"
            data-relay-card
            @click="activeCard = null"
          >
            <strong>{{ activeCard.title }}</strong>
            <span>{{ activeCard.text }}</span>
            <span v-if="activeCard.kind === 'lunch' || activeCard.kind === 'dinner'" class="relay__card-meals">
              ☗{{ spec.black.name }}：{{ mealOf(activeCard.kind, 'black') }}<br>☖{{ spec.white.name }}：{{ mealOf(activeCard.kind, 'white') }}
            </span>
          </button>
          <p v-if="cursor === 0 && !activeCard" class="relay__opening" data-relay-opening>
            <strong>{{ timeControlText }}</strong>
            <span>{{ statusText || "まもなく対局開始" }}</span>
          </p>
          <p v-else-if="catchingUp" class="relay__waiting" role="status" data-relay-catchup>{{ cursor }}手目 → {{ startAt }}手目まで早送り中…</p>
          <p v-else-if="waiting" class="relay__waiting" role="status">考慮中…</p>
          <p v-if="commentsOn && reducedMotion && latestComment" class="relay__ticker" aria-hidden="true">{{ latestComment }}</p>
          <p v-if="noteToast" class="relay__toast" role="status" data-relay-note-toast>{{ noteToast }}</p>
        </div>
      </div>

      <section class="relay__side" aria-label="解説と操作">
        <!--
          中継の楽しみ(24章)。次の一手クイズ・見どころ再生・大盤解説の札は、欄の切り替えと解説の欄の上に重ねる。
          盤には重ねない(次の一手を考えるのに、盤の全部が見えるように)。
        -->
        <div v-if="quiz" class="relay__fun relay__fun--quiz" data-relay-quiz-panel>
          <p class="relay__fun-head"><b>次の一手</b><span>{{ quiz.at }}手目、{{ players[quizSide].name }}はどう指す？</span></p>
          <div v-if="!quiz.pick" class="relay__quiz-choices">
            <button v-for="choice in quiz.choices" :key="choice.usi" type="button" data-relay-quiz-choice @click="answerQuiz(choice.usi)">{{ choice.text }}</button>
          </div>
          <p v-else-if="!quiz.result" class="relay__fun-text">予想：{{ quiz.pickText }}。指されるのを待っています…</p>
          <p v-else :class="['relay__fun-text', `relay__fun-text--${quiz.result}`]" data-relay-quiz-result>{{ quiz.result === "hit" ? `的中！ ${quiz.actualText}` : `はずれ。正解は ${quiz.actualText}` }}</p>
          <button type="button" class="relay__fun-close" @click="quiz = null">{{ quiz.result ? "閉じる" : "やめる" }}</button>
        </div>
        <div v-else-if="highlight" class="relay__fun" data-relay-highlight>
          <p class="relay__fun-head"><b>見どころ {{ Math.min(highlight.index + 1, highlight.list.length) }}/{{ highlight.list.length }}</b><span>{{ highlight.caption }}</span></p>
          <button type="button" class="relay__fun-close" @click="stopHighlight">やめる</button>
        </div>
        <div v-else-if="variation" class="relay__fun relay__fun--bigboard" data-relay-bigboard-panel>
          <p class="relay__fun-head"><b>大盤解説（変化）</b><span>{{ cast.name }}「ここから {{ variation.text }} と進む変化が考えられます」</span></p>
          <button type="button" class="relay__fun-close" @click="endVariation">戻る</button>
        </div>
        <div class="relay__tabs" role="tablist" aria-label="欄の切り替え">
          <button v-for="item in TABS" :key="item.id" type="button" role="tab" :aria-selected="tab === item.id" :data-relay-tab="item.id" @click="tab = item.id">{{ item.label }}</button>
        </div>
        <div class="relay__panel">
          <!--
            解説と聞き手の言葉は、見たところまでを全部残し、欄の中をスクロールして読み返せる(16章)。
            いちばん下を見ているあいだは新しい言葉に付いていき、上へ戻したら止まって「新しい解説へ」を出す。
          -->
          <div v-if="tab === 'talk'" class="relay__talk" data-relay-talk>
            <div ref="talkEl" class="relay__talk-scroll" aria-live="polite" data-relay-talk-scroll @scroll="onTalkScroll">
              <p v-for="(item, index) in visibleLines" :key="`${item.at}-${index}-${item.role}`" :class="['relay__line', `relay__line--${item.role}`]">
                <b>{{ item.role === "host" ? RELAY_HOST : `${cast.name}` }}</b>{{ item.text }}
              </p>
            </div>
            <button v-if="!talkPinned" type="button" class="relay__talk-latest" data-relay-talk-latest @click="scrollTalkToEnd">▼ 新しい解説へ</button>
            <p v-if="readingText" class="relay__reading" data-relay-reading><b>AIの読み筋</b>{{ readingText }}</p>
          </div>
          <div v-else-if="tab === 'graph'" class="relay__graph" data-relay-graph>
            <p class="relay__graph-title"><b>形勢</b><span>上(青)ほど☗{{ players.black.name }}、下(赤)ほど☖{{ players.white.name }}が良い</span></p>
            <svg viewBox="0 0 100 40" preserveAspectRatio="none" role="img" :aria-label="`勝率の移り変わり。いまは先手${blackPercent}%`" @click="seekGraph">
              <rect x="0" y="0" width="100" height="20" class="relay__graph-up" />
              <line x1="0" y1="20" x2="100" y2="20" class="relay__graph-mid" />
              <polyline :points="ratePoints" class="relay__graph-line" />
              <circle v-for="point in turningPoints" :key="point.ply" :cx="point.x" :cy="point.y" r="1.4" class="relay__graph-dot" />
              <line :x1="cursorX" y1="0" :x2="cursorX" y2="40" class="relay__graph-cursor" />
            </svg>
            <p class="relay__graph-title"><b>消費時間</b><span>☗ 残り{{ remainingLabel('black') }} ／ ☖ 残り{{ remainingLabel('white') }}</span></p>
            <svg viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label="1手ごとの考えた時間。上が先手、下が後手" @click="seekGraph">
              <line x1="0" y1="20" x2="100" y2="20" class="relay__graph-mid" />
              <rect v-for="bar in timeBars" :key="bar.ply" :x="bar.x" :y="bar.y" :width="bar.width" :height="bar.height" :class="['relay__bar', `relay__bar--${bar.side}`]" />
              <line :x1="cursorX" y1="0" :x2="cursorX" y2="40" class="relay__graph-cursor" />
            </svg>
          </div>
          <ol v-else ref="kifuEl" class="relay__kifu" data-relay-kifu>
            <li v-for="row in kifuRows" :key="row.no">
              <button type="button" :aria-current="row.no === cursor ? 'step' : undefined" @click="seek(row.no)">
                <span class="relay__kifu-no">{{ row.no }}</span>
                <span class="relay__kifu-move">{{ row.text }}</span>
                <span class="relay__kifu-time">{{ row.time }}</span>
              </button>
            </li>
          </ol>
        </div>
        <p class="relay__move" aria-live="polite" data-relay-move>
          <template v-if="cursor > 0">
            <b>{{ cursor }}手目 {{ currentMoveText }}</b>
            <small>{{ currentTimeText }}</small>
          </template>
          <template v-else><b>対局開始前</b><small>{{ startClockText }}</small></template>
        </p>
        <div class="relay__controls">
          <button type="button" aria-label="開始局面へ" :disabled="cursor === 0" @click="seek(0)">⏮</button>
          <button type="button" aria-label="1手戻る" :disabled="cursor === 0" data-relay-prev @click="seek(cursor - 1)">◁</button>
          <button type="button" class="relay__play" :aria-label="playing ? '止める' : '再生する'" :aria-pressed="playing" data-relay-play @click="togglePlay">
            {{ playing ? "❚❚" : "▶" }}
          </button>
          <button type="button" aria-label="1手進む" :disabled="cursor >= ready" data-relay-next @click="seek(cursor + 1)">▷</button>
          <button type="button" aria-label="いちばん新しい手へ" :disabled="cursor >= ready" @click="seek(ready)">⏭</button>
          <button type="button" class="relay__toggle" :aria-label="`速さ ×${speed}。押すと変える`" data-relay-speed @click="cycleSpeed">×{{ speed }}</button>
          <button type="button" class="relay__toggle" :aria-pressed="commentsOn" aria-label="コメントの表示" data-relay-comments @click="commentsOn = !commentsOn">コメ{{ commentsOn ? "" : "✕" }}</button>
        </div>
        <!-- 中継の楽しみ(24章)。次の一手クイズ・見どころ再生・大盤解説・研究ノート。 -->
        <div class="relay__extras">
          <button type="button" :disabled="!quizAvailable" data-relay-quiz @click="startQuiz">次の一手<small>{{ quizStore.hit }}/{{ quizStore.total }}</small></button>
          <button type="button" :disabled="!highlightAvailable" data-relay-highlights @click="startHighlights">見どころ</button>
          <button type="button" :disabled="!bigBoardAvailable" data-relay-bigboard @click="startBigBoard">大盤</button>
          <button type="button" :disabled="cursor === 0 && !sfens.length" data-relay-note @click="saveNote">☆ノート</button>
        </div>
        <input
          class="relay__seek"
          type="range"
          min="0"
          :max="Math.max(1, ready)"
          :value="cursor"
          aria-label="見る手数"
          data-relay-seek
          @input="seek(Number(($event.target as HTMLInputElement).value))"
        >
      </section>
    </div>
    <p v-if="errorText" class="relay__error" role="alert">{{ errorText }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch, type PropType } from "vue";
import ShogiMatchBoard from "./ShogiMatchBoard.vue";
import { appendUsiMove, createGameRecord, STANDARD_SFEN } from "./game-state";
import {
  blackWinRate, clockText, rateVerdict, relayTimeControl, relayTimeline, remainingText, thinkTimeText, type RelayMoveEntry,
} from "./core/relay-game.mjs";
import {
  RELAY_HOST, createRelayScript, moveTextOf, pvTextOf, relayAudience, relayCast,
} from "./core/relay-commentary.mjs";
import { addNote, highlightPlan, loadNotes, loadQuiz, quizChoices, saveNotes, saveQuiz, scoreQuiz } from "./core/relay-fun.mjs";
import { loadRelayStore, markRelaySeen, saveRelayStore } from "./core/relay-store.mjs";
import { createFormationState, detectFormationSnapshot, updateFormationState } from "./core/formation-tracker.mjs";
import { HANANE, HANANE_SPRITE } from "./core/ryuo-story.mjs";
import { createMoveSoundPlayer, moveSoundForUsi } from "./core/move-sound";
import { useRelayGenerator } from "./composables/match/useRelayGenerator";
import type { EngineFactory } from "./composables/match/analysisEngines";
import hiraganaFormationMaster from "./data/hiragana_suisho_formations.json";

type Side = "black" | "white";
type Card = { at: number; when: string; kind: string; tier: string; title: string; text: string };

const props = defineProps({
  /** 中継の局の設定(core/relay-games.mjsの項目)。 */
  spec: { type: Object as PropType<any>, required: true },
  /** 解説者を選ぶ棋士(期の棋士)。 */
  pool: { type: Array as PropType<any[]>, default: () => [] },
  oshiId: { type: String, default: "" },
  /** プレイヤーの次の相手のid(その棋士の対局なら、聞き手が「よく見ておこう」と言う)。 */
  nextId: { type: String, default: "" },
  assetBaseUrl: { type: String, default: "." },
  engineFactory: { type: Function as PropType<() => Promise<EngineFactory>>, required: true },
  compact: { type: Boolean, default: false },
  /** 同じ回戦のほかの結果(運営のコメントで少しずつ知らせる。「鈴木蓮七段 勝ち」)。 */
  news: { type: Array as PropType<string[]>, default: () => [] },
  /**
   * 回戦の中継ボード(18章)から開いたときの、いまの手数。棋譜をその手まで作るあいだ盤を早送りで追いかけ、着いたら再生を始める。
   * 0なら、対局開始から。
   */
  startAt: { type: Number, default: 0 },
  /**
   * 本局(20章。エンジンが本当に指している対局)の手の流れ。あれば棋譜を作らず、指された手を受け取る。
   * entriesはいままでの手、endは終局(まだならnull)、subscribeは新しい手と終局の知らせ(戻り値で止める)。
   */
  live: {
    type: Object as PropType<{
      entries: RelayMoveEntry[];
      end: { winner: Side; reason: string } | null;
      subscribe: (onMove: (entry: RelayMoveEntry) => void, onEnd: (end: { winner: Side; reason: string }) => void) => () => void;
    } | null>,
    default: null,
  },
});
const emit = defineEmits<{ close: []; seen: [key: string] }>();

const TABS = [
  { id: "talk", label: "解説" },
  { id: "graph", label: "グラフ" },
  { id: "kifu", label: "棋譜" },
] as const;
const VIEW_KEY = "yacobihime:shogi-match:relay-view:v1";
/** 1手の間(ミリ秒)の基本と、考えた時間による溜めの上限。 */
const MOVE_BASE_MS = 750;
const THINK_MAX_MS = 2600;
/** 札を出しているあいだ、次の手を待つ時間。 */
const CARD_HOLD_MS = { long: 2200, short: 1100 } as const;
/** コメントが流れる時間と、流れる段の数。 */
const COMMENT_MS = 5600;
const COMMENT_LANES = 6;
/** 運営のコメント(上に止まる帯)を出しておく時間。 */
const BANNER_MS = 3000;

function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
function loadView() {
  try {
    const parsed = JSON.parse(browserStorage()?.getItem(VIEW_KEY) ?? "null");
    return { speed: [1, 2, 4].includes(parsed?.speed) ? parsed.speed : 1, comments: parsed?.comments !== false };
  } catch {
    return { speed: 1, comments: true };
  }
}
const saved = loadView();

const players = computed<Record<Side, any>>(() => ({ black: props.spec.black, white: props.spec.white }));
const cast = relayCast({ spec: props.spec, pool: props.pool, oshiId: props.oshiId || null });
const script = createRelayScript({ spec: { ...props.spec, news: props.news }, cast, oshiId: props.oshiId || null, nextId: props.nextId || null });
const control = relayTimeControl({ event: props.spec.event, kind: props.spec.kind });

// ---- 棋譜(作られた分)と、台本に足した分
const entries = shallowRef<RelayMoveEntry[]>([]);
const sfens = shallowRef<string[]>([STANDARD_SFEN]);
const finished = ref(false);
const endInfo = shallowRef<{ winner: Side; reason: string } | null>(null);
const errorText = ref("");
const statusText = ref("");
/** 台本を足した手の数(作られた手のうち、次の手が来た分と、終局した最後の手)。再生はここまで進められる。 */
const ready = ref(0);
const lines = shallowRef<any[]>([]);
const comments = shallowRef<any[]>([]);
const thoughts = shallowRef<any[]>([]);
const cards = shallowRef<Card[]>([]);
let formationState = createFormationState();
let timeline = relayTimeline({ entries: [] }, control);

/** 作られた手を受け取る(局面を進め、台本を足せる分だけ足す)。 */
function receive(entry: RelayMoveEntry) {
  const record = createGameRecord(sfens.value.at(-1));
  appendUsiMove(record, entry.move);
  entries.value = [...entries.value, entry];
  sfens.value = [...sfens.value, record.position.sfen];
  feedScript();
}

/** 台本に、まだ足していない手を足す。最後の手は、終局が分かってから足す(終局の言葉を添えるため)。 */
function feedScript() {
  const list = entries.value;
  const limit = finished.value ? list.length : Math.max(0, list.length - 1);
  if (ready.value >= limit) return;
  timeline = relayTimeline({ entries: list }, control);
  for (let index = ready.value; index < limit; index += 1) {
    const sfenAfter = sfens.value[index + 1];
    formationState = updateFormationState(formationState, detectFormationSnapshot(sfenAfter, hiraganaFormationMaster));
    script.add({
      index,
      entry: list[index],
      previousEval: index ? list[index - 1].eval : 40,
      sfenBefore: sfens.value[index],
      sfenAfter,
      before: timeline[index],
      after: timeline[index + 1],
      formations: formationState,
      last: finished.value && index === list.length - 1,
      end: finished.value && index === list.length - 1 ? endInfo.value : null,
    });
  }
  ready.value = limit;
  lines.value = [...script.lines];
  comments.value = [...script.comments];
  thoughts.value = [...script.thoughts];
  cards.value = [...script.cards];
}

// ---- 再生
const cursor = ref(0);
const playing = ref(true);
const speed = ref<number>(saved.speed);
const commentsOn = ref<boolean>(saved.comments);
const tab = ref<(typeof TABS)[number]["id"]>("talk");
const waiting = ref(false);
/** 考慮中の手(この手数の手を指す前)。0なら考慮中ではない。 */
const thinkingAt = ref(0);
const thinkProgress = ref(0);
const activeCard = shallowRef<Card | null>(null);
const reducedMotion = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
let timer: ReturnType<typeof setTimeout> | undefined;
let frame = 0;
let thinkStart = 0;
let thinkDuration = 1;

watch([speed, commentsOn], () => {
  try {
    browserStorage()?.setItem(VIEW_KEY, JSON.stringify({ speed: speed.value, comments: commentsOn.value }));
  } catch {
    // 保存できなくても、その場では使える。
  }
});

/** 考えた時間(秒)を、再生の溜め(ミリ秒)にする。1分で+0.3秒、1時間で+2.6秒ほど。 */
function thinkDelay(seconds: number) {
  const extra = seconds < 60 ? (seconds / 60) * 300 : 300 + Math.log2(seconds / 60) * 560;
  return MOVE_BASE_MS + Math.min(THINK_MAX_MS, extra);
}

function clearTimers() {
  if (timer) clearTimeout(timer);
  timer = undefined;
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
}

function animateThink() {
  thinkProgress.value = Math.min(1, (performance.now() - thinkStart) / thinkDuration);
  if (thinkProgress.value < 1 && thinkingAt.value) frame = requestAnimationFrame(animateThink);
}

/** 次の手へ。考慮の溜め(時計が早回しで減る)のあと、手を指す。 */
function schedule() {
  clearTimers();
  if (!playing.value) return;
  const next = cursor.value;
  if (next >= ready.value) {
    if (finished.value) {
      playing.value = false;
      waiting.value = false;
    } else {
      // まだ作られていない手。作られたら続ける(watch(ready))。
      waiting.value = true;
    }
    return;
  }
  waiting.value = false;
  const entry = entries.value[next];
  thinkingAt.value = next + 1;
  thinkStart = performance.now();
  thinkDuration = thinkDelay(entry.time) / speed.value;
  thinkProgress.value = 0;
  spawn(next + 1, "think");
  frame = requestAnimationFrame(animateThink);
  timer = setTimeout(advance, thinkDuration);
}

function advance() {
  clearTimers();
  thinkingAt.value = 0;
  thinkProgress.value = 0;
  if (cursor.value >= ready.value) return;
  cursor.value += 1;
  playSound(cursor.value);
  spawn(cursor.value, "move");
  const card = cards.value.find((item) => item.at === cursor.value) ?? null;
  activeCard.value = card;
  const hold = card ? (["lunch", "dinner", "seal", "unseal", "end"].includes(card.kind) ? CARD_HOLD_MS.long : CARD_HOLD_MS.short) : 0;
  timer = setTimeout(() => {
    if (activeCard.value === card && card?.kind !== "end") activeCard.value = null;
    schedule();
  }, hold / speed.value + 60);
}

function togglePlay() {
  stopHighlight();
  endVariation();
  if (playing.value) {
    playing.value = false;
    clearTimers();
    thinkingAt.value = 0;
    waiting.value = false;
    return;
  }
  if (cursor.value >= ready.value && finished.value) seek(0);
  playing.value = true;
  schedule();
}

/** その手数へ飛ぶ(再生は止める)。 */
function seek(target: number) {
  stopHighlight();
  endVariation();
  playing.value = false;
  clearTimers();
  thinkingAt.value = 0;
  waiting.value = false;
  flying.value = [];
  banner.value = null;
  cursor.value = Math.max(0, Math.min(ready.value, Math.round(target)));
  activeCard.value = cards.value.find((item) => item.at === cursor.value) ?? null;
}

function cycleSpeed() {
  speed.value = speed.value === 1 ? 2 : speed.value === 2 ? 4 : 1;
}

watch(ready, () => {
  if (catchingUp.value) catchUp();
  else if (playing.value && waiting.value) schedule();
});

/** いまの手数(startAt)へ追いかけているところ。棋譜が作られるたびに盤を進め、着いたら再生を始める。 */
const catchingUp = ref(props.startAt > 0);
function catchUp() {
  const target = props.startAt;
  const reached = ready.value >= target || (finished.value && ready.value >= entries.value.length);
  cursor.value = Math.min(ready.value, target);
  if (!reached) return;
  catchingUp.value = false;
  statusText.value = "";
  seek(Math.min(ready.value, target));
  playing.value = true;
  schedule();
}

function onKey(event: KeyboardEvent) {
  if (event.key === "ArrowLeft") seek(cursor.value - 1);
  else if (event.key === "ArrowRight") seek(cursor.value + 1);
  else if (event.key === " ") togglePlay();
  else return;
  event.preventDefault();
}

// ---- 駒音(再生中の手だけ。効果音のオン・オフに従う)
const sounds = createMoveSoundPlayer(() => props.assetBaseUrl);
function playSound(ply: number) {
  const entry = entries.value[ply - 1];
  if (!entry) return;
  try {
    const kind = moveSoundForUsi(sfens.value[ply - 1], entry.move);
    if (kind) sounds.play(kind);
  } catch {
    // 音が鳴らなくても、中継は続ける。
  }
}

// ---- 流れるコメント
type Flying = { id: number; text: string; tone: string; big: boolean; lane: number; delay: number; duration: number };
const flying = shallowRef<Flying[]>([]);
let flyId = 0;
let laneCursor = 0;
const banner = shallowRef<{ id: number; text: string } | null>(null);
let bannerTimer: ReturnType<typeof setTimeout> | undefined;
function showBanner(text: string) {
  flyId += 1;
  banner.value = { id: flyId, text };
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => { banner.value = null; }, BANNER_MS / Math.sqrt(speed.value));
}
function spawn(at: number, when: string) {
  if (!commentsOn.value) return;
  const items = comments.value.filter((item) => item.at === at && item.when === when);
  if (!items.length) return;
  // 運営のコメントは上に止める(動かないので、動きを減らす設定でも出す)。
  const top = items.filter((item) => item.pos === "top");
  if (top.length) showBanner(top[top.length - 1].text);
  if (reducedMotion) return;
  const added = items.filter((item) => item.pos !== "top").map((item, index) => {
    laneCursor = (laneCursor + 1 + (index % 2)) % COMMENT_LANES;
    flyId += 1;
    return {
      id: flyId, text: item.text, tone: item.tone ?? "", big: item.size === "big", lane: laneCursor,
      delay: index * 380, duration: (COMMENT_MS * (item.size === "big" ? 1.15 : 1)) / Math.sqrt(speed.value),
    };
  });
  flying.value = [...flying.value, ...added].slice(-24);
}
function land(id: number) {
  flying.value = flying.value.filter((item) => item.id !== id);
}
const latestComment = computed(() => [...comments.value].reverse().find((item) => item.at <= cursor.value)?.text ?? "");

// ---- 表示
const rootEl = ref<HTMLElement | null>(null);
const boardEl = ref<HTMLElement | null>(null);
const kifuEl = ref<HTMLElement | null>(null);
const boardWidth = ref(360);
let resizeObserver: ResizeObserver | undefined;

const blackPercent = computed(() => Math.round(blackWinRate(cursor.value ? entries.value[cursor.value - 1]?.eval ?? 40 : 40) * 100));
/** 勝率バーの真ん中の一言(「鈴木優勢」・「互角」)。 */
const verdict = computed(() => rateVerdict(blackPercent.value));
const verdictText = computed(() => (verdict.value.side ? `${players.value[verdict.value.side as Side].name}${verdict.value.word}` : verdict.value.word));

/** 見たところまでの解説と聞き手の言葉(欄の中でスクロールして読み返す。16章)。考慮中は、その手の「考慮中」の言葉まで。 */
const visibleLines = computed(() => lines.value
  .filter((item) => item.at <= cursor.value || (thinkingAt.value && item.at === thinkingAt.value && item.when === "think")));
/** 解説の欄。いちばん下を見ているあいだ(pinned)は、新しい言葉が来たら下まで送る。 */
const talkEl = ref<HTMLElement | null>(null);
const talkPinned = ref(true);
/** いちばん下とみなす余り(px)。 */
const TALK_PIN_SLACK = 24;
function onTalkScroll() {
  const el = talkEl.value;
  if (el) talkPinned.value = el.scrollHeight - el.scrollTop - el.clientHeight < TALK_PIN_SLACK;
}
function scrollTalkToEnd() {
  const el = talkEl.value;
  if (el) el.scrollTop = el.scrollHeight;
  talkPinned.value = true;
}
watch(() => visibleLines.value.length, () => {
  if (talkPinned.value) void nextTick(scrollTalkToEnd);
}, { flush: "post" });
// 解説の欄に戻ったら、いちばん新しい言葉から見せる。
watch(tab, (next) => {
  if (next === "talk") void nextTick(scrollTalkToEnd);
}, { flush: "post" });

/** いま出す心の声(指した手か、考慮中の手のもの)。 */
const bubbles = computed(() => {
  const now = thoughts.value.filter((item) => (item.at === cursor.value && item.when === "move")
    || (thinkingAt.value && item.at === thinkingAt.value && item.when === "think"));
  const bySide = new Map<Side, any>();
  for (const item of now) bySide.set(item.side, item);
  return [...bySide.values()];
});

/** 休憩の札の、対局者の注文。 */
function mealOf(kind: string, side: Side) {
  return kind === "lunch" || kind === "dinner" ? script.meals[kind][side] : "";
}

function faceSprite(side: Side) {
  return players.value[side]?.story === HANANE ? `${props.assetBaseUrl}/characters/${HANANE_SPRITE.file}?v=${HANANE_SPRITE.version}` : "";
}

/** 名札の横の時計。考慮中は、手番の人の時計が早回しで減る。 */
const clocks = computed(() => {
  const point = relayTimeline({ entries: entries.value.slice(0, cursor.value) }, control).at(-1)!;
  const remaining = { ...point.remaining };
  const byoyomi: Record<Side, number | undefined> = { black: undefined, white: undefined };
  for (const side of ["black", "white"] as const) if (point.byoyomi[side]) byoyomi[side] = control.byoyomi;
  if (thinkingAt.value) {
    const side: Side = (thinkingAt.value - 1) % 2 === 0 ? "black" : "white";
    const spent = (entries.value[thinkingAt.value - 1]?.time ?? 0) * thinkProgress.value;
    if (point.byoyomi[side]) byoyomi[side] = Math.max(1, Math.round(control.byoyomi - Math.min(spent, control.byoyomi - 1)));
    else remaining[side] = Math.max(0, Math.round(remaining[side] - spent));
  }
  return { black: remaining.black, white: remaining.white, blackByoyomi: byoyomi.black, whiteByoyomi: byoyomi.white };
});
const remainingLabel = (side: Side) => (clocks.value[side] > 0 ? remainingText(clocks.value[side]) : "秒読み");

const currentMoveText = computed(() => (cursor.value ? kifuText(cursor.value) : ""));
const currentTimeText = computed(() => {
  const entry = entries.value[cursor.value - 1];
  if (!entry) return "";
  const point = relayTimeline({ entries: entries.value.slice(0, cursor.value) }, control).at(-1)!;
  const day = control.days > 1 ? `${point.day}日目 ` : "";
  return `考慮${thinkTimeText(entry.time)}・${day}${clockText(point.clock)}`;
});
const startClockText = computed(() => `${control.days > 1 ? "1日目 " : ""}${clockText(control.start)} 開始`);
const timeControlText = computed(() => `持ち時間 各${control.main / 3600}時間${control.days > 1 ? "・2日制" : ""}`);

/** 指し手の表記の控え(棋譜の欄と手の行で共通)。 */
const textCache = new Map<number, string>();
function kifuText(ply: number) {
  if (!textCache.has(ply)) {
    const entry = entries.value[ply - 1];
    textCache.set(ply, entry ? moveTextOf(sfens.value[ply - 1], entry.move, entries.value[ply - 2]?.move ?? "") : "");
  }
  return textCache.get(ply)!;
}
/** 見たところまでの手数。グラフと棋譜は、ここまでだけ出す(先の形勢や手数で、結末を先に見せない)。 */
const revealed = ref(0);
watch(cursor, (value) => {
  if (value > revealed.value) revealed.value = value;
});
const kifuRows = computed(() => entries.value.slice(0, revealed.value).map((entry, index) => ({
  no: index + 1, text: kifuText(index + 1), time: thinkTimeText(entry.time),
})));
watch([cursor, tab], async () => {
  if (tab.value !== "kifu") return;
  await nextTick();
  kifuEl.value?.querySelector('[aria-current="step"]')?.scrollIntoView({ block: "nearest" });
});

const readingText = computed(() => {
  const entry = entries.value[cursor.value - 1];
  if (!entry?.pv) return "";
  try {
    return pvTextOf(sfens.value[cursor.value], entry.pv, entry.move);
  } catch {
    return "";
  }
});

/** グラフの横幅の手数。見たところが右端に寄りすぎないよう、少し先まで取る。 */
const graphTotal = computed(() => Math.max(40, Math.ceil((revealed.value + 10) / 20) * 20));
const cursorX = computed(() => ((cursor.value / graphTotal.value) * 100).toFixed(2));
const ratePoints = computed(() => {
  const points = [`0,${(40 - blackWinRate(40) * 40).toFixed(2)}`];
  entries.value.slice(0, revealed.value).forEach((entry, index) => {
    points.push(`${(((index + 1) / graphTotal.value) * 100).toFixed(2)},${(40 - blackWinRate(entry.eval) * 40).toFixed(2)}`);
  });
  return points.join(" ");
});
const turningPoints = computed(() => entries.value.slice(0, revealed.value)
  .map((entry, index) => ({ entry, ply: index + 1 }))
  .filter(({ entry }) => entry.mark === "error" || entry.mark === "decisive")
  .map(({ entry, ply }) => ({ ply, x: (ply / graphTotal.value) * 100, y: 40 - blackWinRate(entry.eval) * 40 })));
const timeBars = computed(() => {
  const width = Math.max(0.3, (100 / graphTotal.value) * 0.8);
  return entries.value.slice(0, revealed.value).map((entry, index) => {
    const height = Math.min(19, Math.sqrt(Math.min(1, entry.time / 5400)) * 19);
    const side: Side = index % 2 === 0 ? "black" : "white";
    return { ply: index + 1, side, x: (index / graphTotal.value) * 100, width, height: Math.max(0.4, height), y: side === "black" ? 20 - Math.max(0.4, height) : 20 };
  });
});
function seekGraph(event: MouseEvent) {
  const target = event.currentTarget as SVGElement;
  const rect = target.getBoundingClientRect();
  if (!rect.width) return;
  seek(((event.clientX - rect.left) / rect.width) * graphTotal.value);
}

const commentPrefix = computed(() => comments.value.filter((item) => item.at <= cursor.value).length);
const audienceText = computed(() => relayAudience(props.spec, cursor.value).toLocaleString("ja-JP"));
const commentCountText = computed(() => (commentPrefix.value * 37 + (cursor.value * 11)).toLocaleString("ja-JP"));

// ---- 中継の楽しみ(24章)
/** 再生を止める(考慮中の溜めも)。 */
function pausePlayback() {
  playing.value = false;
  clearTimers();
  thinkingAt.value = 0;
  waiting.value = false;
}

// 次の一手クイズ(24-2)。次に指される手を3つから当てる。当たると視聴者が沸く。
type Quiz = { at: number; choices: { usi: string; text: string }[]; pick: string; pickText: string; result: "hit" | "miss" | null; actualText: string };
const quiz = shallowRef<Quiz | null>(null);
const quizStore = ref(loadQuiz(browserStorage()));
const quizSide = computed<Side>(() => ((quiz.value?.at ?? 1) % 2 === 1 ? "black" : "white"));
const quizAvailable = computed(() => !quiz.value && !catchingUp.value && !(finished.value && cursor.value >= entries.value.length));
let quizTimer: ReturnType<typeof setTimeout> | undefined;
function startQuiz() {
  const at = cursor.value + 1;
  const sfen = sfens.value[cursor.value];
  const previous = entries.value[cursor.value - 1];
  const choices = quizChoices({
    sfen, expected: (previous?.pv ?? "").split(" ")[0] ?? "", actual: entries.value[cursor.value]?.move ?? "", seed: `${props.spec.key}:${at}`,
  }).map((usi) => ({ usi, text: moveTextOf(sfen, usi, previous?.move ?? "") }));
  if (!choices.length) return;
  stopHighlight();
  endVariation();
  pausePlayback();
  quiz.value = { at, choices, pick: "", pickText: "", result: null, actualText: "" };
}
function answerQuiz(usi: string) {
  const current = quiz.value;
  if (!current) return;
  quiz.value = { ...current, pick: usi, pickText: current.choices.find((choice) => choice.usi === usi)?.text ?? "" };
  playing.value = true;
  schedule();
}
watch(cursor, (value) => {
  const current = quiz.value;
  if (!current) return;
  if (value === current.at && current.pick && !current.result) {
    const hit = entries.value[current.at - 1]?.move === current.pick;
    quizStore.value = scoreQuiz(quizStore.value, hit);
    saveQuiz(browserStorage(), quizStore.value);
    quiz.value = { ...current, result: hit ? "hit" : "miss", actualText: kifuText(current.at) };
    if (hit) celebrateQuiz();
    clearTimeout(quizTimer);
    quizTimer = setTimeout(() => { if (quiz.value?.at === current.at) quiz.value = null; }, 3600 / Math.sqrt(speed.value));
  } else if (value !== current.at - 1 && !(current.result && value === current.at)) {
    quiz.value = null;
  }
});
/** 的中したとき、視聴者のコメントが沸く(「予想的中」と同じ。動きを減らす設定では運営の帯で)。 */
function celebrateQuiz() {
  if (!commentsOn.value) return;
  if (reducedMotion) {
    showBanner("次の一手 的中！");
    return;
  }
  const texts = ["次の一手的中！！", "読み筋どおり", "完全に読んでた", "的中おめ", "名人の読み", "8888"];
  const added = texts.map((text, index) => {
    laneCursor = (laneCursor + 1) % COMMENT_LANES;
    flyId += 1;
    return { id: flyId, text, tone: "hit", big: index === 0, lane: laneCursor, delay: index * 260, duration: COMMENT_MS / Math.sqrt(speed.value) };
  });
  flying.value = [...flying.value, ...added].slice(-24);
}

// 見どころ再生(24-3)。形勢が動いた手・長考・決め手・終局を、短く続けて見る。
type Highlight = { list: ReturnType<typeof highlightPlan>; index: number; caption: string };
const highlight = shallowRef<Highlight | null>(null);
let highlightTimer: ReturnType<typeof setTimeout> | undefined;
/** 見どころの範囲。終局していれば全部、そうでなければ見たところまで(先の結末を見せない)。 */
const highlightRange = computed(() => (finished.value ? ready.value : Math.max(revealed.value, cursor.value)));
const highlightAvailable = computed(() => highlightRange.value >= 10 && !highlight.value);
function startHighlights() {
  const list = highlightPlan(entries.value.slice(0, highlightRange.value), { end: finished.value ? endInfo.value : null });
  if (!list.length) return;
  quiz.value = null;
  endVariation();
  pausePlayback();
  highlight.value = { list, index: -1, caption: "" };
  stepHighlight(0);
}
function stepHighlight(index: number) {
  const current = highlight.value;
  if (!current) return;
  if (index >= current.list.length) {
    highlight.value = { ...current, index: current.list.length, caption: "見どころは以上です" };
    highlightTimer = setTimeout(() => { highlight.value = null; }, 2200);
    return;
  }
  const item = current.list[index];
  activeCard.value = null;
  cursor.value = Math.max(0, item.ply - 1);
  highlight.value = { ...current, index, caption: item.caption };
  highlightTimer = setTimeout(() => {
    cursor.value = item.ply;
    playSound(item.ply);
    highlightTimer = setTimeout(() => stepHighlight(index + 1), 2600 / speed.value);
  }, 900 / speed.value);
}
function stopHighlight() {
  clearTimeout(highlightTimer);
  highlightTimer = undefined;
  highlight.value = null;
}

// 大盤解説(24-4)。解説者が大盤で、いまの局面からAIの読み筋の手を進めて見せ、終わったら元の局面へ戻す。
type Variation = { sfens: string[]; moves: string[]; index: number; text: string };
const variation = shallowRef<Variation | null>(null);
let variationTimer: ReturnType<typeof setTimeout> | undefined;
const bigBoardAvailable = computed(() => cursor.value > 0 && Boolean(entries.value[cursor.value - 1]?.pv) && !variation.value);
function startBigBoard() {
  const entry = entries.value[cursor.value - 1];
  const base = sfens.value[cursor.value];
  if (!entry?.pv || !base) return;
  const record = createGameRecord(base);
  const list = [base];
  const moves: string[] = [];
  for (const usi of entry.pv.split(" ").filter(Boolean).slice(0, 4)) {
    if (!appendUsiMove(record, usi)) break;
    list.push(record.position.sfen);
    moves.push(usi);
  }
  if (!moves.length) return;
  quiz.value = null;
  stopHighlight();
  pausePlayback();
  variation.value = { sfens: list, moves, index: 0, text: pvTextOf(base, moves.join(" "), entry.move) };
  stepVariation();
}
function stepVariation() {
  const current = variation.value;
  if (!current) return;
  if (current.index >= current.moves.length) {
    variationTimer = setTimeout(endVariation, 2200 / speed.value);
    return;
  }
  variationTimer = setTimeout(() => {
    const now = variation.value;
    if (!now) return;
    try {
      const kind = moveSoundForUsi(now.sfens[now.index], now.moves[now.index]);
      if (kind) sounds.play(kind);
    } catch {
      // 音が鳴らなくても続ける。
    }
    variation.value = { ...now, index: now.index + 1 };
    stepVariation();
  }, 1300 / speed.value);
}
function endVariation() {
  clearTimeout(variationTimer);
  variationTimer = undefined;
  variation.value = null;
}
/** 盤に出す局面(大盤解説の間は、変化の局面)。 */
const boardSfen = computed(() => (variation.value ? variation.value.sfens[variation.value.index] : sfens.value[cursor.value] ?? sfens.value[0]));
const boardLastMove = computed(() => {
  if (variation.value) return variation.value.index ? variation.value.moves[variation.value.index - 1] : "";
  return cursor.value > 0 ? entries.value[cursor.value - 1]?.move ?? "" : "";
});

// 研究ノート(24-5)。いまの局面を残し、やこびノートの「研究ノート」から開く。
const noteToast = ref("");
let noteTimer: ReturnType<typeof setTimeout> | undefined;
function saveNote() {
  const storage = browserStorage();
  const ply = cursor.value;
  const notes = addNote(loadNotes(storage), {
    spec: props.spec, ply, sfen: sfens.value[ply] ?? sfens.value[0], moveText: ply ? `${ply}手目 ${kifuText(ply)}` : "対局開始前",
  });
  saveNotes(storage, notes);
  noteToast.value = "研究ノートに残したよ（やこびノートの「研究ノート」から開ける）";
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => { noteToast.value = ""; }, 2600);
}

// ---- 棋譜を作る(本局は、指された手を受け取る)
let stopLive: (() => void) | null = null;
const generator = useRelayGenerator({
  engineFactory: () => props.engineFactory(),
  compact: () => props.compact,
  storage: browserStorage,
});

onMounted(() => {
  const storage = browserStorage();
  saveRelayStore(storage, markRelaySeen(loadRelayStore(storage), props.spec.key));
  emit("seen", props.spec.key);
  if (boardEl.value) {
    resizeObserver = new ResizeObserver(() => { boardWidth.value = boardEl.value?.clientWidth ?? boardWidth.value; });
    resizeObserver.observe(boardEl.value);
    boardWidth.value = boardEl.value.clientWidth;
  }
  rootEl.value?.focus({ preventScroll: true });
  statusText.value = catchingUp.value ? `いまの局面（${props.startAt}手目）まで進めています…` : "中継の準備中…";
  // 対局開始前の札(解説の紹介)を少し見せてから、1手目へ。途中から開いたときは、いまの手数まで追いかけてから。
  if (catchingUp.value) playing.value = false;
  else timer = setTimeout(schedule, 1500);
  const finish = (end: { winner: Side; reason: string }) => {
    endInfo.value = end;
    finished.value = true;
    feedScript();
    if (catchingUp.value) catchUp();
  };
  // 本局は、指された手をそのまま受け取る(棋譜は作らない)。
  if (props.live) {
    const source = props.live;
    source.entries.forEach((entry) => receive(entry));
    if (source.entries.length && !catchingUp.value) statusText.value = "";
    if (source.end) finish(source.end);
    else {
      stopLive = source.subscribe((entry) => {
        if (!catchingUp.value) statusText.value = "";
        receive(entry);
      }, finish);
    }
    if (catchingUp.value) catchUp();
    return;
  }
  generator.play(props.spec, (entry) => {
    if (!catchingUp.value) statusText.value = "";
    receive(entry);
  }).then((game) => {
    if (!game) return;
    finish(game.end);
  }).catch((error: unknown) => {
    errorText.value = `中継の準備ができませんでした（${error instanceof Error ? error.message : String(error)}）。閉じて、もう一度開いてください。`;
    playing.value = false;
  });
});
onBeforeUnmount(() => {
  clearTimers();
  clearTimeout(bannerTimer);
  clearTimeout(quizTimer);
  clearTimeout(highlightTimer);
  clearTimeout(variationTimer);
  clearTimeout(noteTimer);
  resizeObserver?.disconnect();
  stopLive?.();
  generator.dispose();
});

</script>

<style>
/* 中継の画面。大会の画面の上に重ねる。紺の地にクリームの文字、橙の強調(大会の画面と同じ色)。 */
.shogi-game .relay {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  box-sizing: border-box;
  padding: max(6px, env(safe-area-inset-top)) clamp(8px, 2vw, 16px) max(8px, env(safe-area-inset-bottom));
  color: #fffcf4;
  background: #142231;
  font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Yu Gothic", "Meiryo", sans-serif;
  outline: none;
}
.shogi-game .relay__head {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  padding-bottom: 0.35rem;
  border-bottom: 1px solid rgba(255, 252, 244, 0.14);
}
.shogi-game .relay__close {
  display: inline-flex;
  gap: 0.3rem;
  align-items: center;
  min-width: 44px;
  min-height: 44px;
  padding: 0 0.6rem;
  border: 1px solid rgba(255, 252, 244, 0.3);
  border-radius: 0.45rem;
  color: #fffcf4;
  background: transparent;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}
.shogi-game .relay__title { min-width: 0; }
.shogi-game .relay__event { display: flex; gap: 0.4rem; align-items: center; margin: 0; min-width: 0; font-weight: 900; }
.shogi-game .relay__label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.shogi-game .relay__badge { flex: none; padding: 0.05rem 0.4rem; border-radius: 0.3rem; color: #172632; background: #f1a54c; font-size: 0.78em; }
.shogi-game .relay__chips { display: flex; gap: 0.3rem; margin: 0.15rem 0 0; overflow: hidden; white-space: nowrap; }
.shogi-game .relay__chip { flex: none; padding: 0 0.35rem; border-radius: 0.25rem; color: #c9d6e6; background: rgba(255, 252, 244, 0.1); font-size: 0.72rem; font-weight: 700; }
.shogi-game .relay__chip--next { color: #fffcf4; background: #c4604c; }
.shogi-game .relay__chip--rival { color: #fffcf4; background: #8a5ad1; }
.shogi-game .relay__chip--oshi { color: #172632; background: #d8d0ff; }
.shogi-game .relay__audience { display: grid; gap: 0.1rem; margin: 0; color: #c9d6e6; font-size: 0.72rem; text-align: right; font-variant-numeric: tabular-nums; }
.shogi-game .relay__audience b { margin-right: 0.25rem; color: #9fb3c8; font-weight: 700; }
.shogi-game .relay__body {
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 0.4rem;
  min-height: 0;
  padding-top: 0.4rem;
}
.shogi-game .relay__stage { display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 0.3rem; min-height: 0; }
.shogi-game .relay__board { position: relative; min-width: 0; min-height: 0; overflow: hidden; }
.shogi-game .relay__board .shogi-match-theme-controls { display: none; }
/* 盤の中の重なり(名札など)を盤の中に閉じ込め、札・心の声・コメントを盤より前に出す。 */
.shogi-game .relay__board > :first-child { isolation: isolate; }
/* 流れるコメント。盤の上を右から左へ(押せない飾り)。 */
/*
  流れるコメントの字は、盤の幅に合わせて大きくする(16章)。画面が大きいほど盤も大きいので、字が小さく見えないようにする。
  --relay-widthは盤の欄の幅(px)。種類ごとの大きさは、この字に対する倍率(em)で持つ。
*/
.shogi-game .relay__danmaku { position: absolute; inset: 0; overflow: hidden; pointer-events: none; font-size: clamp(1rem, calc(var(--relay-width, 400px) * 0.036), 2rem); }
.shogi-game .relay__comment {
  position: absolute;
  left: 100%;
  color: #fff;
  font-size: 1em;
  font-weight: 900;
  white-space: nowrap;
  text-shadow: 0 0 2px #000, 1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000;
  opacity: 0.92;
  animation-name: relay-fly;
  animation-timing-function: linear;
  animation-fill-mode: both;
}
.shogi-game .relay__comment--red { color: #ff9c8c; }
.shogi-game .relay__comment--gold { color: #ffd27a; font-size: 1.12em; }
.shogi-game .relay__comment--pink { color: #ffc4e6; }
/* AI勢は青、初心者と答える人は緑(書き手の種類。12章)。盛り上がりは大きな字。 */
.shogi-game .relay__comment--blue { color: #9fd0ff; }
.shogi-game .relay__comment--green { color: #b4ecb0; }
/* 駒割り勢はオレンジ、海外のファンは薄紫(12-5)。 */
.shogi-game .relay__comment--orange { color: #ffb36b; }
.shogi-game .relay__comment--lavender { color: #d9c8ff; }
.shogi-game .relay__comment--big { font-size: 1.4em; }
/* 運営のコメント(上に止まる帯)。後手の名札と時計の下、心の声より上。 */
.shogi-game .relay__banner {
  position: absolute;
  top: 13%;
  left: 50%;
  z-index: 4;
  max-width: 92%;
  margin: 0;
  padding: 0.15rem 0.6rem;
  overflow: hidden;
  border: 1px solid rgba(241, 165, 76, 0.8);
  border-radius: 0.3rem;
  color: #ffd27a;
  background: rgba(20, 34, 49, 0.88);
  font-size: clamp(0.85rem, calc(var(--relay-width, 400px) * 0.024), 1.3rem);
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
  transform: translateX(-50%);
  pointer-events: none;
}
@keyframes relay-fly {
  from { transform: translateX(0); }
  to { transform: translateX(calc(-1 * var(--relay-width, 400px) - 100%)); }
}
/* 心の声。上が後手、下が先手の名札の近く(名札と時計は隠さない)。 */
.shogi-game .relay__thought {
  position: absolute;
  left: 50%;
  z-index: 3;
  display: flex;
  gap: 0.4rem;
  align-items: center;
  max-width: min(92%, 26rem);
  margin: 0;
  padding: 0.3rem 0.6rem 0.3rem 0.35rem;
  border: 2px solid rgba(23, 38, 50, 0.85);
  border-radius: 1.2rem;
  color: #172632;
  background: rgba(255, 252, 244, 0.95);
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.3);
  transform: translateX(-50%);
  animation: relay-pop 0.25s ease-out both;
  pointer-events: none;
}
.shogi-game .relay__thought--white { top: 20%; }
.shogi-game .relay__thought--black { bottom: 20%; }
.shogi-game .relay__thought-face {
  display: grid;
  flex: none;
  place-items: center;
  width: 2rem;
  height: 2rem;
  overflow: hidden;
  border-radius: 50%;
  background: #2c4359;
}
.shogi-game .relay__thought-face img { width: 100%; margin-top: 30%; image-rendering: pixelated; }
.shogi-game .relay__thought-face i { color: #fffcf4; font-style: normal; font-weight: 900; }
.shogi-game .relay__thought-text { display: grid; font-size: clamp(0.9rem, calc(var(--relay-width, 400px) * 0.025), 1.3rem); font-weight: 800; line-height: 1.3; }
.shogi-game .relay__thought-text small { color: #5b6f82; font-size: 0.75em; font-weight: 700; }
@keyframes relay-pop {
  from { opacity: 0; transform: translate(-50%, 6px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}
.shogi-game .relay__card,
.shogi-game .relay__opening {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 4;
  display: grid;
  gap: 0.2rem;
  justify-items: center;
  min-width: min(80%, 16rem);
  margin: 0;
  padding: 0.7rem 1rem;
  border: 2px solid #f1a54c;
  border-radius: 0.6rem;
  color: #fffcf4;
  background: rgba(20, 34, 49, 0.94);
  box-shadow: 0 6px 0 rgba(0, 0, 0, 0.35);
  font: inherit;
  text-align: center;
  transform: translate(-50%, -50%);
}
.shogi-game .relay__card { cursor: pointer; }
.shogi-game .relay__card strong,
.shogi-game .relay__opening strong { font-size: 1.15rem; }
.shogi-game .relay__card--gold { border-color: #e6c15c; background: rgba(60, 44, 10, 0.94); }
.shogi-game .relay__card--red { border-color: #c4604c; }
.shogi-game .relay__card--blue { border-color: #6fa1d6; }
.shogi-game .relay__card-meals { color: #f7ead5; font-size: 0.85rem; line-height: 1.5; }
.shogi-game .relay__waiting {
  position: absolute;
  right: 0.4rem;
  bottom: 0.4rem;
  margin: 0;
  padding: 0.15rem 0.5rem;
  border-radius: 0.3rem;
  background: rgba(20, 34, 49, 0.85);
  font-size: 0.8rem;
  font-weight: 800;
}
.shogi-game .relay__ticker {
  position: absolute;
  left: 0.4rem;
  right: 0.4rem;
  bottom: 0.3rem;
  margin: 0;
  overflow: hidden;
  color: #fff;
  font-size: clamp(1rem, calc(var(--relay-width, 400px) * 0.03), 1.6rem);
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-shadow: 1px 1px 0 #000;
}
/* 勝率バー(15章)。先手は青・後手は赤。名前の札をバーと同じ色にする。 */
.shogi-game .relay { --relay-black: #3d78b8; --relay-white: #c8433a; }
.shogi-game .relay__rate { display: grid; gap: 0.2rem; min-width: 0; font-variant-numeric: tabular-nums; }
.shogi-game .relay__rate-names { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); gap: 0.4rem; align-items: center; margin: 0; }
.shogi-game .relay__rate-name {
  display: inline-flex;
  gap: 0.3rem;
  align-items: center;
  min-width: 0;
  padding: 0.1rem 0.45rem;
  border-radius: 0.3rem;
  color: #fff;
  font-size: 0.85rem;
  font-weight: 800;
  line-height: 1.4;
}
.shogi-game .relay__rate-name--black { justify-self: start; background: var(--relay-black); }
.shogi-game .relay__rate-name--white { justify-self: end; background: var(--relay-white); }
.shogi-game .relay__rate-name i { font-style: normal; }
.shogi-game .relay__rate-name b { font-size: 1rem; font-weight: 900; }
.shogi-game .relay__rate-who { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.shogi-game .relay__rate-verdict { color: #e2e8ef; font-size: 0.85rem; font-weight: 900; white-space: nowrap; }
.shogi-game .relay__rate-verdict--black { color: #9fd0ff; }
.shogi-game .relay__rate-verdict--white { color: #ffa79a; }
.shogi-game .relay__rate-bar { position: relative; height: 0.7rem; overflow: hidden; border-radius: 999px; background: var(--relay-white); }
.shogi-game .relay__rate-bar span { display: block; height: 100%; background: var(--relay-black); transition: width 0.3s ease; }
/* 五分の目印(真ん中の線)。 */
.shogi-game .relay__rate-bar::after { content: ""; position: absolute; top: 0; bottom: 0; left: 50%; width: 2px; background: rgba(255, 252, 244, 0.85); transform: translateX(-50%); }
.shogi-game .relay__side {
  display: grid;
  grid-template-rows: auto var(--relay-panel, 8.6rem) auto auto auto;
  gap: 0.3rem;
  min-width: 0;
  min-height: 0;
}
.shogi-game .relay__tabs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.3rem; }
.shogi-game .relay__tabs button,
.shogi-game .relay__controls button {
  min-height: 40px;
  border: 1px solid rgba(255, 252, 244, 0.25);
  border-radius: 0.4rem;
  color: #fffcf4;
  background: rgba(255, 252, 244, 0.06);
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}
.shogi-game .relay__tabs button[aria-selected="true"] { border-color: #f1a54c; color: #172632; background: #f1a54c; }
.shogi-game .relay__panel { min-height: 0; overflow: hidden; border-radius: 0.45rem; background: rgba(255, 252, 244, 0.05); }
/* 解説の欄(16章)。言葉は下から積み、欄の中だけスクロールする。字は画面の幅に合わせて少し大きくする。 */
.shogi-game .relay__talk { position: relative; display: grid; grid-template-rows: minmax(0, 1fr) auto; height: 100%; box-sizing: border-box; padding: 0.35rem 0.5rem; overflow: hidden; }
.shogi-game .relay__talk-scroll { display: flex; flex-direction: column; gap: 0.3rem; min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; }
.shogi-game .relay__talk-scroll > :first-child { margin-top: auto; }
.shogi-game .relay__talk-latest {
  position: absolute;
  right: 0.6rem;
  bottom: 2.2rem;
  min-height: 44px;
  padding: 0 0.8rem;
  border: 1px solid #f1a54c;
  border-radius: 999px;
  color: #172632;
  background: #f1a54c;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 800;
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.35);
  cursor: pointer;
}
.shogi-game .relay__line { margin: 0; font-size: clamp(0.95rem, 0.75rem + 0.5vw, 1.25rem); line-height: 1.5; }
.shogi-game .relay__line b { margin-right: 0.35rem; padding: 0 0.3rem; border-radius: 0.25rem; font-size: 0.8em; }
.shogi-game .relay__line--commentator b { color: #172632; background: #e6c15c; }
.shogi-game .relay__line--host b { color: #172632; background: #ffc4e6; }
.shogi-game .relay__reading { margin: 0.1rem 0 0; padding-top: 0.25rem; border-top: 1px dashed rgba(255, 252, 244, 0.2); color: #c9d6e6; font-size: clamp(0.85rem, 0.7rem + 0.35vw, 1.1rem); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.shogi-game .relay__reading b { margin-right: 0.35rem; color: #9fd0ff; }
.shogi-game .relay__graph { display: grid; grid-template-rows: auto minmax(0, 1fr) auto minmax(0, 1fr); gap: 0.1rem; height: 100%; box-sizing: border-box; padding: 0.3rem 0.5rem; }
.shogi-game .relay__graph-title { display: flex; justify-content: space-between; gap: 0.4rem; margin: 0; font-size: 0.72rem; }
.shogi-game .relay__graph-title span { color: #9fb3c8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.shogi-game .relay__graph svg { width: 100%; height: 100%; min-height: 0; border-radius: 0.25rem; background: rgba(200, 67, 58, 0.22); cursor: pointer; }
.shogi-game .relay__graph-up { fill: rgba(61, 120, 184, 0.38); }
.shogi-game .relay__graph-mid { stroke: rgba(255, 252, 244, 0.45); stroke-width: 0.4; stroke-dasharray: 2 2; vector-effect: non-scaling-stroke; }
.shogi-game .relay__graph-line { fill: none; stroke: #fffcf4; stroke-width: 1.4; vector-effect: non-scaling-stroke; stroke-linejoin: round; }
.shogi-game .relay__graph-dot { fill: #f1a54c; }
.shogi-game .relay__graph-cursor { stroke: #e6c15c; stroke-width: 1.2; vector-effect: non-scaling-stroke; }
.shogi-game .relay__bar--black { fill: #6fa1d6; }
.shogi-game .relay__bar--white { fill: #e0745e; }
.shogi-game .relay__kifu { height: 100%; margin: 0; padding: 0.2rem; overflow-y: auto; list-style: none; overscroll-behavior: contain; }
.shogi-game .relay__kifu button {
  display: grid;
  grid-template-columns: 2.4em minmax(0, 1fr) auto;
  gap: 0.4rem;
  width: 100%;
  min-height: 34px;
  padding: 0 0.4rem;
  border: 0;
  border-radius: 0.3rem;
  color: #fffcf4;
  background: transparent;
  font: inherit;
  font-size: 0.86rem;
  text-align: left;
  cursor: pointer;
}
.shogi-game .relay__kifu button[aria-current="step"] { color: #172632; background: #f1a54c; font-weight: 900; }
.shogi-game .relay__kifu-no,
.shogi-game .relay__kifu-time { color: inherit; opacity: 0.75; font-variant-numeric: tabular-nums; }
.shogi-game .relay__move { display: flex; gap: 0.5rem; align-items: baseline; justify-content: center; margin: 0; min-height: 1.5em; font-size: 0.95rem; white-space: nowrap; overflow: hidden; }
.shogi-game .relay__move small { color: #9fb3c8; font-size: 0.78rem; }
.shogi-game .relay__controls { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)) repeat(2, minmax(0, 1.1fr)); gap: 0.25rem; }
.shogi-game .relay__controls button { min-height: 44px; padding: 0; }
.shogi-game .relay__controls button:disabled { opacity: 0.4; cursor: default; }
.shogi-game .relay__play { color: #172632 !important; background: #f1a54c !important; border-color: #f1a54c !important; font-size: 1.05rem; }
.shogi-game .relay__toggle { font-size: 0.82rem; }
.shogi-game .relay__seek { width: 100%; min-height: 28px; margin: 0; accent-color: #f1a54c; }
/* 中継の楽しみ(24章)。次の一手・見どころ・大盤・研究ノートのボタンと、盤の下の端の札。 */
.shogi-game .relay__extras { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.25rem; }
.shogi-game .relay__extras button {
  display: grid; place-items: center; min-height: 40px; padding: 0 0.2rem; border: 1px solid rgba(241, 165, 76, 0.5); border-radius: 0.4rem;
  color: #fffcf4; background: rgba(241, 165, 76, 0.1); font: inherit; font-size: 0.82rem; font-weight: 800; line-height: 1.1; cursor: pointer;
}
.shogi-game .relay__extras button small { color: #f1a54c; font-size: 0.72rem; font-variant-numeric: tabular-nums; }
.shogi-game .relay__extras button:disabled { opacity: 0.4; cursor: default; }
/* 札は欄の切り替えと解説の欄(1〜2段目)に重ねる。そのため、その2つの段を決めておく(ほかの段は順に並ぶ)。 */
.shogi-game .relay__tabs { grid-row: 1; grid-column: 1; }
.shogi-game .relay__panel { grid-row: 2; grid-column: 1; }
.shogi-game .relay__fun {
  position: relative; z-index: 2; grid-row: 1 / 3; grid-column: 1; align-self: start; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.35rem;
  box-sizing: border-box; max-height: 100%; margin: 0; padding: 0.45rem 0.55rem; overflow-y: auto;
  border: 2px solid #f1a54c; border-radius: 0.5rem; color: #fffcf4; background: #142231; box-shadow: 0 6px 16px rgba(0, 0, 0, 0.45); font-weight: 800;
}
.shogi-game .relay__fun--bigboard { border-color: #9fd0ff; }
.shogi-game .relay__fun-head { display: grid; gap: 0.1rem; margin: 0; font-size: 0.86rem; line-height: 1.35; }
.shogi-game .relay__fun-head b { color: #f1a54c; font-size: 0.8rem; }
.shogi-game .relay__fun--bigboard .relay__fun-head b { color: #9fd0ff; }
.shogi-game .relay__fun-text { grid-column: 1 / -1; margin: 0; font-size: 0.9rem; }
.shogi-game .relay__fun-text--hit { color: #ffd27a; font-size: 1.05rem; }
.shogi-game .relay__fun-text--miss { color: #c9d6e6; }
.shogi-game .relay__fun-close { grid-row: 1; grid-column: 2; align-self: start; min-height: 36px; padding: 0 0.7rem; border: 1px solid rgba(255, 252, 244, 0.3); border-radius: 0.35rem; color: #fffcf4; background: transparent; font: inherit; font-size: 0.8rem; cursor: pointer; }
.shogi-game .relay__quiz-choices { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.3rem; }
.shogi-game .relay__quiz-choices button { min-height: 44px; padding: 0 0.2rem; border: 2px solid rgba(255, 252, 244, 0.35); border-radius: 0.4rem; color: #fffcf4; background: rgba(255, 252, 244, 0.08); font: inherit; font-weight: 900; cursor: pointer; }
.shogi-game .relay__toast { position: absolute; left: 50%; top: 0.5rem; z-index: 7; margin: 0; padding: 0.3rem 0.7rem; border-radius: 999px; color: #172632; background: #f1a54c; font-size: 0.8rem; font-weight: 900; width: max-content; max-width: 90%; text-align: center; transform: translateX(-50%); }
.shogi-game .relay__comment--hit { color: #ffd27a; text-shadow: 0 0 6px rgba(241, 165, 76, 0.9), 0 1px 2px #000; }
.shogi-game .relay__error { position: absolute; left: 1rem; right: 1rem; bottom: 1rem; margin: 0; padding: 0.6rem; border-radius: 0.4rem; color: #fffcf4; background: #8a2f26; }
/* 背の低い画面は、欄を低くする。 */
@media (max-height: 700px) {
  .shogi-game .relay { --relay-panel: 6rem; }
  .shogi-game .relay__close-text { display: none; }
  .shogi-game .relay__chips { display: none; }
}
/* 横長の広い画面: 左に勝率と盤、右の列に欄・操作。 */
@media (min-width: 900px) and (min-aspect-ratio: 1/1) {
  .shogi-game .relay__body { grid-template-rows: minmax(0, 1fr); grid-template-columns: minmax(0, 1fr) minmax(19rem, 26rem); gap: 1rem; }
  .shogi-game .relay__side { grid-template-rows: auto minmax(0, 1fr) auto auto auto; }
}
@media (prefers-reduced-motion: reduce) {
  .shogi-game .relay__thought { animation: none; }
  .shogi-game .relay__rate-bar span { transition: none; }
}
</style>
