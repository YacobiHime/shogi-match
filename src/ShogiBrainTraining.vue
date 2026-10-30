<template>
  <!-- 脳トレ道場(docs/brain-training-design.md)。見た目は将棋教室と同じ枠(shogi-dex・shogi-tutorial)を使う。 -->
  <div class="shogi-dex shogi-tutorial shogi-brain" role="dialog" aria-modal="true" aria-labelledby="shogi-brain-title" data-brain-training>
    <header class="shogi-dex__header">
      <button type="button" class="shogi-dex__back" @click="goBack">
        <span aria-hidden="true">←</span> {{ backLabel }}
      </button>
      <h1 id="shogi-brain-title">{{ headerTitle }}</h1>
      <button v-if="view === 'home'" type="button" class="shogi-brain__evidence-open" aria-label="脳トレの根拠" data-brain-evidence @click="view = 'evidence'">?</button>
    </header>

    <!-- 入口。いちばん上に「今日の3種目」、下に見る・覚えるの2つの棚。 -->
    <section v-if="view === 'home'" class="shogi-tutorial__shelf shogi-brain__home" aria-label="脳トレの種目">
      <div class="shogi-dex__speech shogi-tutorial__intro">
        <img class="shogi-dex__chara" :src="charaUrl" alt="" aria-hidden="true">
        <p>{{ homeMessage }}</p>
      </div>
      <button type="button" class="shogi-brain__today" data-brain-today @click="startToday">
        <span class="shogi-brain__today-eyebrow">約{{ todayMinutes }}分<template v-if="streak >= 2">・続けて{{ streak }}日</template></span>
        <strong>{{ doneToday ? "今日はできた！もう一度" : "今日の3種目" }}</strong>
        <small>{{ todayList.map((id) => gameLabel(id)).join(" → ") }}</small>
      </button>
      <div v-for="shelf in BRAIN_SHELVES" :key="shelf.id" class="shogi-brain__shelf">
        <h2 class="shogi-brain__shelf-title">{{ shelf.label }}</h2>
        <ul class="shogi-brain__cards">
          <li v-for="game in shelf.games" :key="game.id">
            <button
              type="button"
              class="shogi-brain__card"
              :disabled="!AVAILABLE.includes(game.id)"
              :data-brain-game="game.id"
              @click="startSingle(game.id)"
            >
              <strong>{{ game.label }}</strong>
              <small>{{ game.desc }}</small>
              <span v-if="!AVAILABLE.includes(game.id)" class="shogi-brain__card-tag">準備中</span>
              <span v-else-if="bestText(game.id)" class="shogi-brain__card-best">自己ベスト {{ bestText(game.id) }}</span>
            </button>
          </li>
        </ul>
      </div>
    </section>

    <!-- 種目。今日の3種目は続けて遊び、1つの種目だけのときは終わると結果を出す。 -->
    <section v-else-if="view === 'game' && currentGame" class="shogi-brain__stage" :aria-label="gameLabel(currentGame)">
      <BrainGlance
        v-if="currentGame === 'glance'"
        :key="`glance-${runKey}`"
        :start-level="startLevel(record, 'glance')"
        :count="questionCount('glance')"
        @sound="playSound"
        @finish="finishGame('glance', $event)"
      />
      <BrainBoardMemory
        v-else-if="currentGame === 'board-memory'"
        :key="`memory-${runKey}`"
        :start-level="startLevel(record, 'board-memory')"
        :count="questionCount('board-memory')"
        @sound="playSound"
        @finish="finishGame('board-memory', $event)"
      />
      <BrainMentalBoard
        v-else-if="currentGame === 'mental'"
        :key="`mental-${runKey}`"
        :start-level="startLevel(record, 'mental')"
        :count="questionCount('mental')"
        @sound="playSound"
        @finish="finishGame('mental', $event)"
      />
    </section>

    <!-- 結果。種目ごとの記録と、前の日より伸びたものを並べる。 -->
    <section v-else-if="view === 'summary'" class="shogi-tutorial__shelf shogi-brain__summary" aria-label="結果" data-brain-summary>
      <div class="shogi-dex__speech shogi-tutorial__intro">
        <img class="shogi-dex__chara" :src="charaUrl" alt="" aria-hidden="true">
        <p>{{ summaryMessage }}</p>
      </div>
      <ul class="shogi-brain__results">
        <li v-for="row in results" :key="row.game" :class="{ 'shogi-brain__result--best': row.newBest }">
          <span class="shogi-brain__result-name">{{ gameLabel(row.game) }}</span>
          <strong>{{ valueText(row.game, row.value) || "記録なし" }}</strong>
          <span v-if="row.newBest" class="shogi-brain__result-tag shogi-brain__result-tag--best">自己ベスト！</span>
          <span v-else-if="row.grew" class="shogi-brain__result-tag">伸びた！</span>
          <small>{{ row.correct }} / {{ row.total }} 問 正解</small>
        </li>
      </ul>
      <div class="brain-game__actions">
        <button type="button" class="brain-game__primary" data-brain-again @click="again">もう一度</button>
        <button type="button" class="brain-game__secondary" data-brain-home @click="view = 'home'">道場へ戻る</button>
      </div>
    </section>

    <!-- 根拠のシート。言ってよいことだけを短く並べる(1章)。 -->
    <section v-else-if="view === 'evidence'" class="shogi-tutorial__shelf shogi-brain__evidence" aria-label="脳トレの根拠" data-brain-evidence-sheet>
      <h2>どんな練習なの？</h2>
      <dl>
        <template v-for="item in EVIDENCE" :key="item.title">
          <dt>{{ item.title }}</dt>
          <dd>{{ item.text }}<small>{{ item.source }}</small></dd>
        </template>
      </dl>
      <p class="shogi-brain__evidence-note">脳トレで頭全体が良くなるかは、まだ確かめられていません。だからこの道場では、将棋の盤と駒で練習します。練習したことそのもの（盤をひと目でつかむ・局面を覚える・頭の中で駒を動かす）が、将棋の力の一部だからです。</p>
      <div class="brain-game__actions">
        <button type="button" class="brain-game__secondary" @click="view = 'home'">道場へ戻る</button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import BrainGlance from "./brain/BrainGlance.vue";
import BrainBoardMemory from "./brain/BrainBoardMemory.vue";
import BrainMentalBoard from "./brain/BrainMentalBoard.vue";
import { glanceLevelLabel } from "./core/brain-glance.mjs";
import {
  BRAIN_GAMES,
  brainStreak,
  dayKey,
  growthSince,
  loadBrainRecord,
  markTodayDone,
  recordBrainSession,
  saveBrainRecord,
  startLevel,
  todayDone,
  todayMenu,
} from "./core/brain-training.mjs";
import { createMoveSoundPlayer } from "./core/move-sound";

type GameId = "glance" | "board-memory" | "mental" | "palace";
type GameResult = { value: number; level: number; correct: number; total: number };

const props = defineProps({
  assetBaseUrl: { type: String, default: "." },
});
const emit = defineEmits(["close"]);

const BRAIN_TITLE = "脳トレ道場";
/** いま遊べる種目。作った段階から足す(docs/brain-training-design.mdの9章)。 */
const AVAILABLE: readonly GameId[] = ["glance", "board-memory", "mental"];
/** 種目の棚。見る(処理速度)と覚える(記憶)の2つに分ける(3章)。 */
const BRAIN_SHELVES = [
  {
    id: "see",
    label: "見る",
    games: [{ id: "glance" as GameId, label: "ちらっと盤", desc: "一瞬で、駒と玉の場所を見る" }],
  },
  {
    id: "remember",
    label: "覚える",
    games: [
      { id: "board-memory" as GameId, label: "盤面の記憶", desc: "局面を覚えて、並べ直す" },
      { id: "mental" as GameId, label: "頭の中の盤", desc: "見えない駒を、頭の中で動かす" },
      { id: "palace" as GameId, label: "記憶の宮殿", desc: "場所法で、言葉や定跡を覚える" },
    ],
  },
] as const;
/** 根拠のシートの文。docs/brain-training-design.mdの1章の「言ってよいこと」の範囲だけ。 */
const EVIDENCE = [
  { title: "見る速さ（ちらっと盤）", text: "ちらっと見て答える練習は、練習した見方を速くします。お年寄りの大きな研究で、10年後まで良い結果が報告されています。", source: "ACTIVE研究（Edwardsほか、2017年）" },
  { title: "局面の記憶（盤面の記憶）", text: "強い人は、駒を1枚ずつではなく、囲いや形のまとまりで覚えています。でたらめな配置だと、強い人でも覚えにくくなります。", source: "Chase・Simon（1973年）" },
  { title: "頭の中の盤", text: "覚えたことを頭の中で動かす練習は、練習した課題を伸ばします。プロ棋士は盤面をひと目でつかみ、直観で次の一手を出すときに、脳の決まった場所が働いています。", source: "理化学研究所（2011年）" },
  { title: "記憶の宮殿（場所法）", text: "場所法を毎日練習した人は、覚えられる言葉が大きく増え、4か月後も保っていました。", source: "Dreslerほか（2017年）" },
  { title: "思い出す・日をあける", text: "読み返すより思い出してみるほうが、同じ時間でも日をあけて練習するほうが、長く覚えていられます。", source: "Roediger・Karpicke（2006年）、Cepedaほか（2006年）" },
];

/** 自己ベストのほめ言葉。何ができたかを言う(D:5-4)。 */
const BEST_LINES: Record<GameId, (value: string) => string> = {
  glance: (value) => `${value}でも見えたね。`,
  "board-memory": (value) => `${value}を覚えて並べられたね。`,
  mental: (value) => `頭の中で${value}を追えたね。`,
  palace: (value) => `${value}を覚えたね。`,
};
const storage = typeof localStorage === "undefined" ? null : localStorage;
const record = ref(loadBrainRecord(storage));
const today = dayKey();
const view = ref<"home" | "game" | "summary" | "evidence">("home");
const queue = ref<GameId[]>([]);
const currentGame = ref<GameId | null>(null);
const runKey = ref(0);
const mode = ref<"today" | "single">("today");
const results = ref<(GameResult & { game: GameId; newBest: boolean; grew: boolean })[]>([]);

const charaUrl = computed(() => `${props.assetBaseUrl}/characters/yakobihime-mini.webp?v=4`);
const headerTitle = computed(() => (view.value === "game" && currentGame.value ? gameLabel(currentGame.value) : BRAIN_TITLE));
const backLabel = computed(() => (view.value === "home" ? "ホームへ戻る" : "道場へ戻る"));
const todayList = computed(() => todayMenu({ available: [...AVAILABLE], day: today }) as GameId[]);
const todayMinutes = computed(() => Math.max(1, Math.round(todayList.value.length * 1.6)));
const doneToday = computed(() => todayDone(record.value, today));
const streak = computed(() => brainStreak(record.value, today));
const homeMessage = computed(() => (
  doneToday.value
    ? "今日の練習はおしまい。また明日ね。日をあけて続けると、長く身につくよ。"
    : "将棋の盤で、見る速さと記憶をきたえよう。1日5分で十分だよ。"
));
const summaryMessage = computed(() => {
  const best = results.value.find((row) => row.newBest);
  if (best) return `${gameLabel(best.game)}で自己ベスト！ ${BEST_LINES[best.game](valueText(best.game, best.value))}`;
  if (results.value.some((row) => row.grew)) return "前の日より伸びたよ。続けると、もっと速く見えるようになるよ。";
  return "おつかれさま！ また明日、同じ練習をしてみよう。";
});

const moveSounds = createMoveSoundPlayer(() => props.assetBaseUrl);
onMounted(() => moveSounds.preload());
function playSound(kind: "correct" | "miss" | "best" | "place") {
  if (kind === "correct" || kind === "place") moveSounds.play("normal");
  else if (kind === "best") moveSounds.play("stamp");
}

function gameLabel(id: GameId) {
  return BRAIN_GAMES.find((game) => game.id === id)?.label ?? id;
}
/** 記録の見せ方(D:5-5 身近な尺度)。0は記録なし。 */
function valueText(id: GameId, value: number | undefined) {
  if (!value) return "";
  if (id === "glance") return glanceLevelLabel(value - 1);
  if (id === "board-memory") return `駒${value}枚`;
  if (id === "mental") return `${value}手`;
  return String(value);
}
function bestText(id: GameId) {
  return valueText(id, record.value.best[id]);
}
function questionCount(id: GameId) {
  const game = BRAIN_GAMES.find((item) => item.id === id);
  return mode.value === "today" ? game?.short ?? 1 : game?.full ?? 1;
}

function startToday() {
  mode.value = "today";
  results.value = [];
  queue.value = [...todayList.value];
  nextGame();
}
function startSingle(id: GameId) {
  if (!AVAILABLE.includes(id)) return;
  mode.value = "single";
  results.value = [];
  queue.value = [id];
  nextGame();
}
function nextGame() {
  const next = queue.value.shift() ?? null;
  currentGame.value = next;
  runKey.value += 1;
  if (next) view.value = "game";
  else finishRun();
}
function finishGame(id: GameId, result: GameResult) {
  const { record: next, newBest } = recordBrainSession(record.value, id, result, today);
  record.value = next;
  saveBrainRecord(storage, record.value);
  const growth = growthSince(record.value, id, today);
  results.value = [...results.value, { ...result, game: id, newBest, grew: Boolean(growth?.grew) }];
  if (newBest) playSound("best");
  nextGame();
}
function finishRun() {
  if (mode.value === "today") {
    record.value = markTodayDone(record.value, today);
    saveBrainRecord(storage, record.value);
  }
  view.value = "summary";
}
function again() {
  if (mode.value === "today") startToday();
  else if (results.value[0]) startSingle(results.value[0].game);
}

/** ブラウザの戻る操作と、見出しの戻るボタン。種目・結果・根拠からは入口へ、入口からはホームへ。 */
function goBack() {
  if (view.value === "home") emit("close");
  else {
    queue.value = [];
    currentGame.value = null;
    view.value = "home";
  }
}
defineExpose({ goBack });
</script>

<style>
.shogi-game .shogi-brain__home,
.shogi-game .shogi-brain__summary,
.shogi-game .shogi-brain__evidence {
  display: grid;
  gap: 0.9rem;
  align-content: start;
}
.shogi-game .shogi-brain__evidence-open {
  margin-left: auto;
  width: 44px;
  height: 44px;
  border: 2px solid rgba(255, 252, 244, 0.35);
  border-radius: 50%;
  color: #fffcf4;
  background: transparent;
  font: inherit;
  font-weight: 900;
  cursor: pointer;
}
.shogi-game .shogi-brain__today {
  display: grid;
  gap: 0.1rem;
  justify-items: start;
  width: min(100%, 40rem);
  margin: 0 auto;
  padding: 0.8rem 1.1rem;
  border: 2px solid #f1a54c;
  border-radius: 0.9rem;
  color: #fffcf4;
  background: #2b465b;
  box-shadow: 0 4px 0 #172632;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.shogi-game .shogi-brain__today strong { font-size: 1.3em; }
.shogi-game .shogi-brain__today small { color: #cfd8de; }
.shogi-game .shogi-brain__today-eyebrow {
  color: #f1a54c;
  font-size: 0.8em;
  font-weight: 800;
  letter-spacing: 0.06em;
}
.shogi-game .shogi-brain__card:disabled {
  opacity: 0.55;
  cursor: default;
}
.shogi-game .shogi-brain__shelf {
  display: grid;
  gap: 0.4rem;
  width: min(100%, 40rem);
  margin: 0 auto;
}
.shogi-game .shogi-brain__shelf-title {
  margin: 0;
  color: #f1a54c;
  font-size: 0.95rem;
  letter-spacing: 0.12em;
}
.shogi-game .shogi-brain__cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.shogi-game .shogi-brain__card {
  position: relative;
  display: grid;
  gap: 0.15rem;
  justify-items: start;
  width: 100%;
  min-height: 44px;
  padding: 0.65rem 0.9rem;
  border: 2px solid rgba(255, 252, 244, 0.25);
  border-radius: 0.8rem;
  color: #fffcf4;
  background: #2b465b;
  box-shadow: 0 3px 0 #172632;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.shogi-game .shogi-brain__card strong { font-size: 1.05em; }
.shogi-game .shogi-brain__card small { color: #cfd8de; font-size: 0.82em; }
.shogi-game .shogi-brain__card-tag,
.shogi-game .shogi-brain__card-best {
  position: absolute;
  top: 0.5rem;
  right: 0.6rem;
  color: #d7d1fd;
  font-size: 0.75em;
  font-weight: 800;
}
.shogi-game .shogi-brain__card-best { color: #9fe0b4; }
@media (hover: hover) {
  .shogi-game .shogi-brain__today:hover,
  .shogi-game .shogi-brain__card:not(:disabled):hover {
    border-color: #f1a54c;
    transform: translateY(-0.1em);
  }
}
.shogi-game .shogi-brain__stage {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.6rem 1rem 1rem;
}
.shogi-game .shogi-brain__results {
  display: grid;
  gap: 0.5rem;
  width: min(100%, 32rem);
  margin: 0 auto;
  padding: 0;
  list-style: none;
}
.shogi-game .shogi-brain__results li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas: "name value" "count tag";
  gap: 0.15rem 0.6rem;
  padding: 0.6rem 0.9rem;
  border: 2px solid rgba(255, 252, 244, 0.2);
  border-radius: 0.8rem;
  background: #2b465b;
}
.shogi-game .shogi-brain__results .shogi-brain__result--best { border-color: #9fe0b4; }
.shogi-game .shogi-brain__result-name { grid-area: name; font-weight: 800; }
.shogi-game .shogi-brain__results strong { grid-area: value; font-size: 1.15em; }
.shogi-game .shogi-brain__results small { grid-area: count; color: #cfd8de; }
.shogi-game .shogi-brain__result-tag { grid-area: tag; justify-self: end; color: #f1a54c; font-weight: 800; font-size: 0.85em; }
.shogi-game .shogi-brain__result-tag--best { color: #9fe0b4; }
.shogi-game .shogi-brain__evidence h2 { margin: 0; text-align: center; font-size: 1.15rem; }
.shogi-game .shogi-brain__evidence dl {
  display: grid;
  gap: 0.35rem;
  width: min(100%, 40rem);
  margin: 0 auto;
}
.shogi-game .shogi-brain__evidence dt { color: #f1a54c; font-weight: 800; margin-top: 0.4rem; }
.shogi-game .shogi-brain__evidence dd { margin: 0; line-height: 1.6; }
.shogi-game .shogi-brain__evidence dd small { display: block; color: #cfd8de; font-size: 0.78em; }
.shogi-game .shogi-brain__evidence-note {
  width: min(100%, 40rem);
  margin: 0 auto;
  padding: 0.7rem 0.9rem;
  border-radius: 0.7rem;
  background: rgba(215, 209, 253, 0.12);
  line-height: 1.6;
}

/* ===== 種目で共通の部品 ===== */
.shogi-game .brain-game {
  display: grid;
  justify-items: center;
  gap: 0.6rem;
  width: min(100%, 30rem);
  margin: 0 auto;
}
.shogi-game .brain-game__status {
  display: flex;
  justify-content: space-between;
  width: 100%;
  margin: 0;
  color: #cfd8de;
  font-size: 0.85rem;
}
.shogi-game .brain-game__prompt {
  min-height: 1.5em;
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
  text-align: center;
}
.shogi-game .brain-game__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.6rem;
}
.shogi-game .brain-game__primary,
.shogi-game .brain-game__secondary {
  min-width: 9rem;
  min-height: 48px;
  padding: 0.5rem 1.4rem;
  border: 2px solid #f1a54c;
  border-radius: 999px;
  color: #172632;
  background: #f1a54c;
  font: inherit;
  font-weight: 900;
  cursor: pointer;
}
.shogi-game .brain-game__secondary {
  color: #fffcf4;
  background: transparent;
  border-color: rgba(255, 252, 244, 0.5);
}
.shogi-game .brain-game__primary:focus-visible,
.shogi-game .brain-game__secondary:focus-visible,
.shogi-game .brain-glance__choice:focus-visible {
  outline: 3px solid #d7d1fd;
  outline-offset: 2px;
}

/* 盤。教室・図鑑の盤と同じ木の色。升の強調は緑(合った)と赤(答え)だけで、黄色は使わない(AGENTS.md)。 */
.shogi-game .brain-board {
  position: relative;
  display: grid;
  grid-template-columns: repeat(9, minmax(0, 1fr));
  grid-template-rows: repeat(9, minmax(0, 1fr));
  width: min(100%, 24rem, 46vh);
  aspect-ratio: 1;
  border: 3px solid #6b4423;
  background: #e8c07a;
  /* 駒の字の大きさを盤の幅に合わせる(駒が増えても升の高さが変わらない)。 */
  container-type: inline-size;
}
.shogi-game .brain-board__cell {
  position: relative;
  display: grid;
  place-items: center;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid rgba(80, 50, 20, 0.45);
}
.shogi-game .brain-board__cell--ok { background: rgba(60, 170, 90, 0.45); }
.shogi-game .brain-board__cell--answer { background: rgba(220, 70, 60, 0.4); }
.shogi-game .brain-piece {
  display: grid;
  place-items: center;
  width: 86%;
  height: 92%;
  color: #1d1d1d;
  background: #f6dfae;
  clip-path: polygon(50% 0, 88% 18%, 100% 100%, 0 100%, 12% 18%);
  font-size: 6.4cqw;
  font-weight: 900;
  line-height: 1;
  padding-top: 12%;
}
.shogi-game .brain-piece--king { color: #8b1d1d; }
.shogi-game .brain-board__dot {
  width: 28%;
  height: 28%;
  border-radius: 50%;
  background: #6b4423;
}
.shogi-game .brain-board__noise {
  position: absolute;
  inset: 0;
  background:
    repeating-linear-gradient(45deg, rgba(40, 30, 20, 0.85) 0 6px, rgba(232, 192, 122, 0.9) 6px 12px),
    repeating-linear-gradient(-45deg, rgba(40, 30, 20, 0.5) 0 4px, transparent 4px 10px);
}
.shogi-game .brain-board__verdict {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: clamp(4rem, 30vw, 9rem);
  font-weight: 900;
  pointer-events: none;
  text-shadow: 0 0 6px #fffcf4;
}
.shogi-game .brain-board__verdict--ok { color: rgba(40, 150, 80, 0.7); }

/* 盤の部品(BrainBoard.vue)。押せる盤はボタンの見た目を消す。後手の駒は逆さ、薄い駒は答えの見せ方。 */
.shogi-game .brain-board-wrap {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  justify-items: center;
  width: 100%;
}
.shogi-game .brain-board-wrap--coords {
  grid-template-columns: min(calc(100% - 1.4rem), 24rem, 46vh) 1.4rem;
  grid-template-areas: "files ." "board ranks";
  justify-content: center;
}
.shogi-game .brain-board-wrap--coords .brain-board { grid-area: board; width: 100%; }
.shogi-game .brain-board__files {
  grid-area: files;
  display: grid;
  grid-template-columns: repeat(9, minmax(0, 1fr));
  width: 100%;
  color: #cfd8de;
  font-size: 0.75rem;
  text-align: center;
}
.shogi-game .brain-board__ranks {
  grid-area: ranks;
  display: grid;
  grid-template-rows: repeat(9, minmax(0, 1fr));
  padding-left: 0.2rem;
  color: #cfd8de;
  font-size: 0.75rem;
  align-items: center;
}
.shogi-game .brain-board__cell--button {
  padding: 0;
  font: inherit;
  cursor: pointer;
  background: transparent;
}
.shogi-game .brain-board__cell--button:focus-visible { outline: 3px solid #3c6dd1; outline-offset: -3px; }
.shogi-game .brain-board__cell--wrong { background: rgba(220, 70, 60, 0.4); }
.shogi-game .brain-board__cell--missed { background: rgba(220, 70, 60, 0.25); }
.shogi-game .brain-piece--white { transform: rotate(180deg); }
.shogi-game .brain-piece--ghost { opacity: 0.45; }

/* 盤面の記憶の道具(先手・後手と駒箱)と、覚える時間の帯。 */
.shogi-game .brain-memory__tools {
  display: grid;
  justify-items: center;
  gap: 0.5rem;
}
.shogi-game .brain-memory__colors,
.shogi-game .brain-memory__palette,
.shogi-game .brain-mental__choices {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.35rem;
}
.shogi-game .brain-memory__colors .brain-glance__choice { font-size: 1rem; padding: 0 0.8rem; }
.shogi-game .brain-mental__choices .brain-glance__choice { padding: 0 0.8rem; }
.shogi-game .brain-memory__timer {
  width: min(100%, 24rem);
  height: 6px;
  border-radius: 3px;
  background: rgba(255, 252, 244, 0.15);
  overflow: hidden;
}
.shogi-game .brain-memory__timer span {
  display: block;
  height: 100%;
  background: #f1a54c;
  transform-origin: left;
  animation: brain-timer linear forwards;
}
@keyframes brain-timer {
  from { transform: scaleX(1); }
  to { transform: scaleX(0); }
}
.shogi-game .brain-mental__move {
  display: grid;
  justify-items: center;
  margin: 0;
  font-size: 2rem;
  font-weight: 900;
}
.shogi-game .brain-mental__move small { color: #cfd8de; font-size: 0.8rem; font-weight: 700; }

/* ちらっと盤の答え。金・銀の2つと、8方向の矢印。 */
.shogi-game .brain-glance__answer {
  display: grid;
  grid-template-columns: auto auto;
  align-items: center;
  gap: 1rem;
}
.shogi-game .brain-glance__pieces {
  display: grid;
  gap: 0.5rem;
}
.shogi-game .brain-glance__pad {
  display: grid;
  grid-template-columns: repeat(3, 52px);
  grid-template-rows: repeat(3, 52px);
  gap: 0.3rem;
}
.shogi-game .brain-glance__choice {
  min-width: 52px;
  min-height: 52px;
  border: 2px solid rgba(255, 252, 244, 0.4);
  border-radius: 0.7rem;
  color: #fffcf4;
  background: #2b465b;
  box-shadow: 0 3px 0 #172632;
  font: inherit;
  font-size: 1.25rem;
  font-weight: 900;
  cursor: pointer;
}
.shogi-game .brain-glance__pieces .brain-glance__choice { min-width: 4.5rem; }
.shogi-game .brain-glance__choice[aria-pressed="true"] {
  border-color: #f1a54c;
  background: #3c5f78;
}
.shogi-game .brain-glance__arrow span { display: inline-block; }
.shogi-game .brain-glance__pad-center {
  display: grid;
  place-items: center;
  color: #cfd8de;
  font-size: 0.8rem;
}
@media (orientation: landscape) and (max-height: 600px) {
  .shogi-game .brain-glance {
    grid-template-columns: auto auto;
    grid-template-areas: "status status" "board prompt" "board answer";
    align-items: center;
    width: auto;
  }
  .shogi-game .brain-glance .brain-game__status { grid-area: status; }
  .shogi-game .brain-glance .brain-game__prompt { grid-area: prompt; }
  .shogi-game .brain-glance .brain-board { grid-area: board; width: min(70vh, 22rem); }
  .shogi-game .brain-glance .brain-glance__answer,
  .shogi-game .brain-glance .brain-game__actions { grid-area: answer; }
}
@media (orientation: landscape) and (max-height: 600px) {
  .shogi-game .brain-memory,
  .shogi-game .brain-mental {
    grid-template-columns: auto minmax(0, 16rem);
    grid-template-areas: "status status" "board prompt" "board tools";
    align-items: center;
    width: auto;
  }
  .shogi-game .brain-memory .brain-game__status,
  .shogi-game .brain-mental .brain-game__status { grid-area: status; }
  .shogi-game .brain-memory .brain-game__prompt,
  .shogi-game .brain-mental .brain-game__prompt { grid-area: prompt; }
  .shogi-game .brain-memory .brain-board-wrap,
  .shogi-game .brain-mental .brain-board-wrap { grid-area: board; }
  .shogi-game .brain-memory .brain-board { width: min(66vh, 20rem); }
  .shogi-game .brain-mental .brain-board-wrap--coords { grid-template-columns: min(62vh, 19rem) 1.4rem; }
  .shogi-game .brain-memory > :is(.brain-memory__tools, .brain-game__actions, .brain-memory__timer),
  .shogi-game .brain-mental > :is(.brain-mental__move, .brain-mental__choices, .brain-game__actions) { grid-area: tools; }
}
@media (prefers-reduced-motion: reduce) {
  .shogi-game .brain-memory__timer span { animation: none; }
  .shogi-game .shogi-brain__today,
  .shogi-game .shogi-brain__card { transition: none; transform: none !important; }
}
</style>
