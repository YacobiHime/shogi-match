<template>
  <!--
    脳トレ道場(docs/brain-training-design.mdの11章)。計算力と記憶力の2つの部屋。
    見た目は将棋教室と同じ枠(shogi-dex・shogi-tutorial)を使い、種目の問題は白い紙のような面に大きく出す。
  -->
  <div class="shogi-dex shogi-tutorial shogi-brain" role="dialog" aria-modal="true" aria-labelledby="shogi-brain-title" data-brain-training>
    <header class="shogi-dex__header">
      <button type="button" class="shogi-dex__back" data-brain-back @click="goBack">
        <span aria-hidden="true">←</span> {{ backLabel }}
      </button>
      <h1 id="shogi-brain-title">{{ headerTitle }}</h1>
      <button v-if="view === 'home' || view === 'room'" type="button" class="shogi-brain__evidence-open" aria-label="脳トレの根拠" data-brain-evidence @click="openEvidence">?</button>
    </header>

    <!-- 入口。前の部屋の「つづき」、2つの部屋の扉、判子のカレンダー。 -->
    <section v-if="view === 'home'" class="shogi-tutorial__shelf shogi-brain__home" aria-label="脳トレの部屋" data-brain-home>
      <div class="shogi-dex__speech shogi-tutorial__intro">
        <img class="shogi-dex__chara" :src="charaUrl" alt="" aria-hidden="true">
        <p>{{ homeMessage }}</p>
      </div>
      <button v-if="record.room" type="button" class="shogi-brain__today" data-brain-continue @click="continueRoom">
        <span class="shogi-brain__today-eyebrow">つづき</span>
        <strong>{{ roomLabel(record.room as RoomId) }}の今日のトレーニング</strong>
        <small>{{ roomProgress(record.room as RoomId).text }}</small>
      </button>
      <ul class="shogi-brain__rooms">
        <li v-for="item in BRAIN_ROOMS" :key="item.id">
          <button type="button" class="shogi-brain__room-card" :class="`shogi-brain__room-card--${item.id}`" :data-brain-room="item.id" @click="openRoom(item.id as RoomId)">
            <span class="shogi-brain__room-emoji" aria-hidden="true">{{ item.emoji }}</span>
            <strong>{{ item.label }}</strong>
            <small>{{ roomProgress(item.id as RoomId).text }}</small>
            <span class="shogi-brain__room-stamp" :class="{ 'shogi-brain__room-stamp--done': stamped(record, today, item.id) }">
              {{ stamped(record, today, item.id) ? "今日 ✓" : "今日はまだ" }}
            </span>
          </button>
        </li>
      </ul>
      <div class="shogi-brain__calendar" data-brain-calendar>
        <p class="shogi-brain__calendar-title">
          <span>判子のカレンダー（6週間）</span>
          <span class="shogi-brain__legend"><i class="shogi-brain__stamp shogi-brain__stamp--calc" aria-hidden="true"></i>計算力 <i class="shogi-brain__stamp shogi-brain__stamp--memory" aria-hidden="true"></i>記憶力</span>
        </p>
        <table>
          <thead><tr><th v-for="weekday in WEEKDAYS" :key="weekday" scope="col">{{ weekday }}</th></tr></thead>
          <tbody>
            <tr v-for="(week, row) in calendar" :key="row">
              <td
                v-for="cell in week"
                :key="cell.day"
                :class="{ 'shogi-brain__day--today': cell.today, 'shogi-brain__day--future': cell.future }"
                :aria-label="`${cell.day}${cell.calc ? ' 計算力' : ''}${cell.memory ? ' 記憶力' : ''}`"
              >
                <span>{{ cell.date }}</span>
                <span class="shogi-brain__stamps" aria-hidden="true">
                  <i v-if="cell.calc" class="shogi-brain__stamp shogi-brain__stamp--calc"></i>
                  <i v-if="cell.memory" class="shogi-brain__stamp shogi-brain__stamp--memory"></i>
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- 計算力の部屋 -->
    <section v-else-if="view === 'room' && room === 'calc'" class="shogi-tutorial__shelf shogi-brain__room" aria-label="計算力の部屋" data-brain-room-view="calc">
      <div class="shogi-brain__room-main">
        <button type="button" class="shogi-brain__today" data-brain-today @click="startCalcToday">
          <span class="shogi-brain__today-eyebrow">今日のトレーニング・約{{ calcMinutes }}分</span>
          <strong>{{ calcPlan.label }}</strong>
          <small>{{ calcPlan.games.map((game) => gameLabel(game.id)).join(" → ") }}</small>
          <small v-if="calcNote" class="shogi-brain__today-note">{{ calcNote }}</small>
        </button>
        <p v-if="roomMessage" class="shogi-brain__room-message" role="status">{{ roomMessage }}</p>
        <button type="button" class="brain-game__secondary shogi-brain__records-open" data-brain-records @click="view = 'records'">記録を見る</button>
      </div>
      <div class="shogi-brain__room-side">
        <ul class="shogi-brain__cards shogi-brain__cards--grid">
          <li v-for="game in CALC_GAMES" :key="game.id">
            <button type="button" class="shogi-brain__card" :data-brain-game="game.id" @click="startSingle(game.id)">
              <strong>{{ game.label }}</strong>
              <small>{{ game.desc }}</small>
              <span v-if="bestText(game.id)" class="shogi-brain__card-best">{{ bestText(game.id) }}</span>
            </button>
          </li>
        </ul>
        <h2 class="shogi-brain__shelf-title">将棋の棚</h2>
        <ul class="shogi-brain__cards shogi-brain__cards--grid">
          <li v-for="game in shelfGames('calc')" :key="game.id">
            <button type="button" class="shogi-brain__card shogi-brain__card--shelf" :data-brain-game="game.id" @click="startSingle(game.id)">
              <strong>☗ {{ game.label }}</strong>
              <small>{{ game.desc }}</small>
              <span v-if="bestText(game.id)" class="shogi-brain__card-best">{{ bestText(game.id) }}</span>
            </button>
          </li>
        </ul>
      </div>
    </section>

    <!-- 記憶力の部屋 -->
    <section v-else-if="view === 'room' && room === 'memory'" class="shogi-tutorial__shelf shogi-brain__room" aria-label="記憶力の部屋" data-brain-room-view="memory">
      <div class="shogi-brain__room-main">
        <button type="button" class="shogi-brain__today" data-brain-today @click="startMemoryToday">
          <span class="shogi-brain__today-eyebrow">今日のトレーニング・約10分</span>
          <strong>{{ memoryTodayTitle }}</strong>
          <small>{{ memoryTodayDetail }}</small>
        </button>
        <p v-if="roomMessage" class="shogi-brain__room-message" role="status">{{ roomMessage }}</p>
        <button type="button" class="brain-game__secondary shogi-brain__records-open" data-brain-records @click="view = 'records'">記録を見る</button>
      </div>
      <div class="shogi-brain__room-side">
        <ul class="shogi-brain__cards shogi-brain__cards--grid">
          <li>
            <button type="button" class="shogi-brain__card" data-brain-builder-open @click="openBuilder('list')">
              <strong>🏠 自分の宮殿</strong>
              <small>{{ palaceSummary }}</small>
            </button>
          </li>
          <li>
            <button type="button" class="shogi-brain__card" :disabled="!memoryHasPalace" data-brain-school @click="openPalace('school')">
              <strong>🏫 場所法の学校</strong>
              <small>{{ memoryHasPalace ? `講 ${lessonsDone}/${PALACE_LESSONS.length} を終えた` : "宮殿ができると開くよ" }}</small>
            </button>
          </li>
          <li>
            <button type="button" class="shogi-brain__card" :disabled="!memoryPracticeOpen" data-brain-practice @click="openPalace('practice')">
              <strong>📅 毎日の練習</strong>
              <small>{{ memoryPracticeOpen ? `言葉${memory.practiceCount}個から` : "講3を終えると開くよ" }}</small>
              <span v-if="bestText('palace')" class="shogi-brain__card-best">{{ bestText("palace") }}</span>
            </button>
          </li>
          <li>
            <button type="button" class="shogi-brain__card" data-brain-game="memory-test" @click="startMemoryTest">
              <strong>📝 記憶テスト</strong>
              <small>{{ record.program.memory.before ? `最初は${record.program.memory.before.total}個中${record.program.memory.before.correct}個` : "15個の言葉を、順番どおりに" }}</small>
            </button>
          </li>
        </ul>
        <h2 class="shogi-brain__shelf-title">将棋の棚</h2>
        <ul class="shogi-brain__cards shogi-brain__cards--grid">
          <li v-for="game in shelfGames('memory')" :key="game.id">
            <button type="button" class="shogi-brain__card shogi-brain__card--shelf" :data-brain-game="game.id" @click="startSingle(game.id)">
              <strong>☗ {{ game.label }}</strong>
              <small>{{ game.desc }}</small>
              <span v-if="bestText(game.id)" class="shogi-brain__card-best">{{ bestText(game.id) }}</span>
            </button>
          </li>
        </ul>
      </div>
    </section>

    <!-- 種目。今日のトレーニングは続けて遊び、終わると結果を出す。 -->
    <section v-else-if="view === 'game' && currentItem" class="shogi-brain__stage" :aria-label="gameLabel(currentItem.id)">
      <p v-if="queueTotal > 1" class="shogi-brain__step">{{ queueTotal - queue.length }} / {{ queueTotal }}<template v-if="currentItem.mode === 'measure'">・測定</template></p>
      <BrainSpeedCalc
        v-if="currentItem.id === 'speed'"
        :key="`speed-${runKey}`"
        :mode="currentItem.mode === 'measure' ? 'measure' : 'train'"
        :saved-level="record.levels.speed ?? 0"
        :saved-slow="record.levels['speed-slow'] ?? 0"
        :count="currentItem.mode === 'measure' ? 10 : 20"
        @sound="playSound"
        @finish="finishGame($event)"
      />
      <BrainNBack
        v-else-if="currentItem.id === 'nback'"
        :key="`nback-${runKey}`"
        :mode="currentItem.mode === 'measure' ? 'measure' : 'train'"
        :saved-level="record.levels.nback ?? 1"
        :rounds="3"
        @sound="playSound"
        @finish="finishGame($event)"
      />
      <BrainGlance
        v-else-if="currentItem.id === 'glance-sym'"
        :key="`glance-sym-${runKey}`"
        variant="symbols"
        :start-level="currentItem.mode === 'measure' ? 0 : startLevel(record, 'glance-sym')"
        :count="currentItem.mode === 'measure' ? 12 : 20"
        @sound="playSound"
        @finish="finishGame($event)"
      />
      <BrainSwitch
        v-else-if="currentItem.id === 'switch'"
        :key="`switch-${runKey}`"
        :start-level="startLevel(record, 'switch')"
        :count="24"
        @sound="playSound"
        @finish="finishGame($event)"
      />
      <BrainGlance
        v-else-if="currentItem.id === 'glance'"
        :key="`glance-${runKey}`"
        :start-level="startLevel(record, 'glance')"
        :count="16"
        @sound="playSound"
        @finish="finishGame($event)"
      />
      <BrainBoardMemory
        v-else-if="currentItem.id === 'board-memory'"
        :key="`memory-${runKey}`"
        :start-level="startLevel(record, 'board-memory')"
        :count="5"
        @sound="playSound"
        @finish="finishGame($event)"
      />
      <BrainMentalBoard
        v-else-if="currentItem.id === 'mental'"
        :key="`mental-${runKey}`"
        :start-level="startLevel(record, 'mental')"
        :count="8"
        @sound="playSound"
        @finish="finishGame($event)"
      />
      <BrainShogiSense
        v-else-if="currentItem.id === 'intuition' || currentItem.id === 'einstellung' || currentItem.id === 'blind'"
        :key="`sense-${currentItem.id}-${runKey}`"
        :kind="currentItem.id"
        :start-level="startLevel(record, currentItem.id)"
        :count="currentItem.id === 'intuition' ? 10 : 6"
        :asset-base-url="assetBaseUrl"
        @sound="playSound"
        @finish="finishGame($event)"
      />
      <BrainMemoryTest
        v-else-if="currentItem.id === 'memory-test'"
        :key="`test-${runKey}`"
        :measure="currentItem.measure === 'after' ? 'after' : 'before'"
        @sound="playSound"
        @finish="finishGame($event)"
      />
    </section>

    <!-- 宮殿づくり -->
    <section v-else-if="view === 'builder'" class="shogi-brain__stage" aria-label="宮殿づくり">
      <BrainPalaceBuilder
        ref="builderView"
        :key="`builder-${runKey}`"
        :palaces="memory.palaces"
        :sample="memory.sample"
        :start="builderStart"
        @sound="playSound"
        @save="saveBuilder"
        @done="builtPalace"
      />
    </section>

    <!-- 場所法の学校と毎日の練習 -->
    <section v-else-if="view === 'palace'" class="shogi-brain__stage" aria-label="場所法の学校">
      <BrainPalace
        ref="palaceView"
        :key="`palace-${runKey}`"
        :store="memory"
        :day="today"
        :mode="palaceMode"
        :lesson-id="palaceLesson"
        @sound="playSound"
        @save="savePalace"
        @build="openBuilder(memory.palaces.length < PALACE_MAX ? 'new' : 'list')"
        @close="view = 'room'"
        @finish="finishPalace"
      />
    </section>

    <!-- 記録。前と後のくらべと、種目ごとの線。 -->
    <section v-else-if="view === 'records'" class="shogi-tutorial__shelf shogi-brain__records" aria-label="記録" data-brain-records-view>
      <div v-if="compareRows.length" class="shogi-brain__compare">
        <h2>前と後</h2>
        <table>
          <thead><tr><th scope="col">種目</th><th v-for="head in compareHeads" :key="head" scope="col">{{ head }}</th></tr></thead>
          <tbody>
            <tr v-for="row in compareRows" :key="row.label">
              <th scope="row">{{ row.label }}</th>
              <td v-for="(cell, index) in row.cells" :key="index">{{ cell || "—" }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="shogi-brain__records-empty">{{ room === 'calc' ? "最初の測定をすると、ここで「前」と「後」をくらべられるよ。" : "最初の記憶テストをすると、ここで「前」と「後」をくらべられるよ。" }}</p>
      <ul class="shogi-brain__lines">
        <li v-for="line in recordLines" :key="line.id">
          <span class="shogi-brain__line-name">{{ line.label }}</span>
          <svg v-if="line.points" class="shogi-brain__spark" viewBox="0 0 120 32" role="img" :aria-label="`${line.label}の記録の線`">
            <polyline :points="line.points" />
          </svg>
          <span v-else class="shogi-brain__spark shogi-brain__spark--empty">{{ line.days ? "2日目から線になるよ" : "まだ記録なし" }}</span>
          <strong>{{ line.best }}</strong>
        </li>
      </ul>
      <p class="shogi-brain__records-note">線は上ほど良い記録（日ごとのいちばん良い記録。最近の20日）。</p>
    </section>

    <!-- 結果。種目ごとの記録と、前の日より伸びたもの、測ったときは前と後。 -->
    <section v-else-if="view === 'summary'" class="shogi-tutorial__shelf shogi-brain__summary" aria-label="結果" data-brain-summary>
      <div class="shogi-dex__speech shogi-tutorial__intro">
        <img class="shogi-dex__chara" :src="charaUrl" alt="" aria-hidden="true">
        <p>{{ summaryMessage }}</p>
      </div>
      <p v-if="newStamp" class="shogi-brain__new-stamp" :class="`shogi-brain__new-stamp--${room}`" aria-hidden="true">{{ room === 'calc' ? "計" : "記" }}</p>
      <ul class="shogi-brain__results">
        <li v-for="(row, index) in results" :key="index" :class="{ 'shogi-brain__result--best': row.newBest }">
          <span class="shogi-brain__result-name">{{ row.label }}<small v-if="row.measure">（測定）</small></span>
          <strong>{{ row.text || "記録なし" }}</strong>
          <span v-if="row.newBest" class="shogi-brain__result-tag shogi-brain__result-tag--best">自己ベスト！</span>
          <span v-else-if="row.grew" class="shogi-brain__result-tag">伸びた！</span>
          <small v-if="row.total">{{ row.correct }} / {{ row.total }} 問 正解</small>
        </li>
      </ul>
      <div v-if="summaryCompare.length" class="shogi-brain__compare">
        <h2>前と後</h2>
        <table>
          <tbody>
            <tr v-for="row in summaryCompare" :key="row.label">
              <th scope="row">{{ row.label }}</th>
              <td>{{ row.before }}</td>
              <td aria-hidden="true">→</td>
              <td><strong>{{ row.after }}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="brain-game__actions">
        <button v-if="singleGame" type="button" class="brain-game__primary" data-brain-again @click="startSingle(singleGame)">もう一度</button>
        <button type="button" :class="singleGame ? 'brain-game__secondary' : 'brain-game__primary'" data-brain-home @click="backToRoom">部屋へ戻る</button>
      </div>
    </section>

    <!-- 根拠のシート。言ってよいことだけを短く並べる(11-2)。 -->
    <section v-else-if="view === 'evidence'" class="shogi-tutorial__shelf shogi-brain__evidence" aria-label="脳トレの根拠" data-brain-evidence-sheet>
      <h2>どんな練習なの？</h2>
      <dl>
        <template v-for="item in EVIDENCE" :key="item.title">
          <dt>{{ item.title }}</dt>
          <dd>{{ item.text }}<small>{{ item.source }}</small></dd>
        </template>
      </dl>
      <p class="shogi-brain__evidence-note">脳トレで頭全体が良くなるかは、まだ確かめられていません。この道場では、練習した力そのもの（速く見る・速く計算する・順番どおりに覚える）を伸ばします。1回10分ほど。計算力は週3回ほどで十分です（回数を増やすほど伸びるとは限りません）。記憶力のコースは、研究に合わせて週5回ほどが目安です。</p>
      <div class="brain-game__actions">
        <button type="button" class="brain-game__secondary" @click="view = evidenceFrom">戻る</button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import BrainGlance from "./brain/BrainGlance.vue";
import BrainBoardMemory from "./brain/BrainBoardMemory.vue";
import BrainMentalBoard from "./brain/BrainMentalBoard.vue";
import BrainShogiSense from "./brain/BrainShogiSense.vue";
import BrainSpeedCalc from "./brain/BrainSpeedCalc.vue";
import BrainNBack from "./brain/BrainNBack.vue";
import BrainSwitch from "./brain/BrainSwitch.vue";
import BrainMemoryTest from "./brain/BrainMemoryTest.vue";
import BrainPalace from "./brain/BrainPalace.vue";
import BrainPalaceBuilder from "./brain/BrainPalaceBuilder.vue";
import { glanceLevelLabel } from "./core/brain-glance.mjs";
import { blindLevelText, intuitionLevelText } from "./core/brain-shogi-sense.mjs";
import { nbackText, perProblemText, switchLevelText } from "./core/brain-calc.mjs";
import {
  BRAIN_GAMES,
  BRAIN_ROOMS,
  brainGame,
  brainStreak,
  dailySeries,
  dayKey,
  growthSince,
  loadBrainRecord,
  lowerIsBetter,
  recordBrainSession,
  rememberRoom,
  saveBrainRecord,
  stampCalendar,
  stampRoom,
  stamped,
  startLevel,
} from "./core/brain-training.mjs";
import {
  CALC_MEASURE,
  calcNextBoosterDay,
  calcProgress,
  completeCalcPlan,
  completeMemoryPractice,
  memoryProgress,
  planCalcToday,
  planMemoryToday,
  recordMemoryTest,
} from "./core/brain-program.mjs";
import {
  PALACE_LESSONS,
  hasPalace,
  loadMemoryStore,
  nextLesson,
  practiceOpen,
  saveMemoryStore,
} from "./core/memory-palace.mjs";
import { PALACE_MAX } from "./core/palace-builder.mjs";
import { createMoveSoundPlayer } from "./core/move-sound";

type RoomId = "calc" | "memory";
type GameId = "speed" | "nback" | "glance-sym" | "switch" | "glance" | "mental" | "intuition" | "einstellung" | "blind" | "memory-test" | "board-memory";
type QueueItem = { id: GameId; mode: "train" | "measure" | "single"; measure?: "before" | "after" };
type GameResult = { value: number; level: number; correct: number; total: number; recordId?: string; extraLevels?: Record<string, number>; text?: string };
type ResultRow = { label: string; text: string; correct: number; total: number; newBest: boolean; grew: boolean; measure: boolean };
type PalaceFinish = { kind: "practice" | "lesson"; lessonId: string; records: { gameId: string; value: number; level: number; text: string }[]; correct: number; total: number };
type MemoryStore = ReturnType<typeof loadMemoryStore>;

const props = defineProps({
  assetBaseUrl: { type: String, default: "." },
});
const emit = defineEmits(["close"]);

const BRAIN_TITLE = "脳トレ道場";
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
const CALC_GAMES = BRAIN_GAMES.filter((game) => game.room === "calc" && !game.shelf);
/** 1つの種目のだいたいの時間(分)。今日のトレーニングの「約○分」に使う。 */
const GAME_MINUTES: Record<string, number> = { speed: 1.5, nback: 3, "glance-sym": 2.5, switch: 1.5 };
const MEASURE_MINUTES: Record<string, number> = { speed: 1, nback: 2, "glance-sym": 1.5 };
/** 根拠のシートの文。docs/brain-training-design.mdの11-2の「言ってよいこと」の範囲だけ。 */
const EVIDENCE = [
  { title: "見る速さ（ちらっと見る）", text: "ちらっと見て答える練習を10回して、そのあと追加の練習（おさらい）もした人では、20年という長い期間で良い結果が報告されています。おさらいをしなかった人では差がありませんでした。この道場のおさらい（1か月後・3か月後）は、研究の間隔（約1年後・約3年後）を短くしたものです。", source: "ACTIVE研究（2026年）" },
  { title: "簡単な計算（スピード計算・色で切り替え）", text: "簡単な計算や音読などを毎日少しずつ練習して、処理速度や切り替える・抑える力が伸びたという小さな研究があります（計算だけの効果を分けて調べたものではありません）。", source: "Nouchiほか（2012年・2013年・2016年）" },
  { title: "N問前の答え", text: "練習した課題と、よく似た課題は伸びます。頭全体が良くなるとは言えません。", source: "Soveriほか（2017年）" },
  { title: "場所法（記憶の宮殿）", text: "場所法は、順番どおりに思い出す力を大きく伸ばすという研究が多くあります（研究の質はまだ高くありません）。毎日練習した人は、4か月たっても覚えたことが長く残りやすかった。", source: "Ondřej（2025年）、Wagnerほか（2021年）" },
  { title: "自分の宮殿", text: "自分のよく知る場所で作るのがいちばん始めやすい。見本の宮殿でも、よく歩いて覚えれば同じように使えます。同じ宮殿にすぐ別のものを置くと混ざるので、日をあけるか、別の宮殿を使いましょう。", source: "Leggeほか（2012年）、De Beni・Cornoldi（1988年）" },
  { title: "思い出す・日をあける", text: "読み返すより思い出してみるほうが、同じ時間でも日をあけて練習するほうが、長く覚えていられます。", source: "Roediger・Karpicke（2006年）、Cepedaほか（2006年）" },
  { title: "将棋の棚（局面の記憶）", text: "強い人は、駒を1枚ずつではなく、囲いや形のまとまりで覚えています。", source: "Chase・Simon（1973年）" },
  { title: "直観の一手", text: "プロは次の一手を直観で思いつくときに、脳の尾状核が働きます。将棋を知らない人も、4か月練習すると素早く良い手を思いつく直観が育ちました。将棋の力を、将棋の中で練習します。", source: "理化学研究所（2011年）、電気通信大学・理化学研究所（2012年）" },
  { title: "思い込み外し", text: "強い人でも、良い手を1つ見つけると、その手のまわりばかり見て、もっと良い手を見落とすことがあります。目に付く手で止まらずに探す練習です。", source: "Bilalićほか（2008年）" },
  { title: "目隠しの詰将棋", text: "頭の中で駒を動かして先を読む練習です。将棋の力を、将棋の中で練習します（頭全体が良くなるとは言えません）。", source: "Sala・Gobet（2017年）" },
];

const storage = typeof localStorage === "undefined" ? null : localStorage;
const record = ref(loadBrainRecord(storage));
const memory = ref<MemoryStore>(loadMemoryStore(storage));
const today = dayKey();
const view = ref<"home" | "room" | "game" | "summary" | "evidence" | "builder" | "palace" | "records">("home");
const room = ref<RoomId>("calc");
const evidenceFrom = ref<"home" | "room">("home");
const queue = ref<QueueItem[]>([]);
const queueTotal = ref(0);
const currentItem = ref<QueueItem | null>(null);
const runKey = ref(0);
const results = ref<ResultRow[]>([]);
const singleGame = ref<GameId | null>(null);
const roomMessage = ref("");
const newStamp = ref(false);
const summaryCompare = ref<{ label: string; before: string; after: string }[]>([]);
const builderStart = ref<"new" | "list">("list");
const palaceMode = ref<"school" | "lesson" | "practice">("school");
const palaceLesson = ref("");
const palaceView = ref<InstanceType<typeof BrainPalace> | null>(null);
const builderView = ref<InstanceType<typeof BrainPalaceBuilder> | null>(null);
let runPlan: ReturnType<typeof planCalcToday> | null = null;
let runMemoryMeasure: "before" | "after" | null = null;
let measureValues: Record<string, number> = {};
let stampedBefore = false;
let bestInRun = false;

const charaUrl = computed(() => `${props.assetBaseUrl}/characters/yakobihime-mini.webp?v=4`);
const calendar = computed(() => stampCalendar(record.value, today));
const streak = computed(() => brainStreak(record.value, today));
const headerTitle = computed(() => {
  switch (view.value) {
    case "room": return roomLabel(room.value);
    case "game": return currentItem.value ? gameLabel(currentItem.value.id) : BRAIN_TITLE;
    case "builder": return "宮殿づくり";
    case "palace": return palaceMode.value === "practice" ? "毎日の練習" : "場所法の学校";
    case "records": return `${roomLabel(room.value)}の記録`;
    case "summary": return "結果";
    case "evidence": return "脳トレの根拠";
    default: return BRAIN_TITLE;
  }
});
const backLabel = computed(() => {
  if (view.value === "home") return "ホームへ戻る";
  if (view.value === "room") return "道場へ戻る";
  if (view.value === "evidence") return "戻る";
  return "部屋へ戻る";
});
const homeMessage = computed(() => {
  if (stamped(record.value, today, "calc") && stamped(record.value, today, "memory")) return "今日は2つともできたね。また明日！ 日をあけて続けると、長く身につくよ。";
  if (streak.value >= 2) return `続けて${streak.value}日目。今日はどっちをきたえる？`;
  return "計算力と記憶力、今日はどっちをきたえる？ 1回10分ほど、毎日でなくて大丈夫だよ。";
});

// ===== 計算力 =====
const calcPlan = computed(() => planCalcToday(record.value.program.calc, today));
const calcMinutes = computed(() => Math.max(1, Math.round(calcPlan.value.games.reduce((sum, game) => sum + ((game.mode === "measure" ? MEASURE_MINUTES[game.id] : GAME_MINUTES[game.id]) ?? 1), 0))));
const calcNote = computed(() => {
  const plan = calcPlan.value;
  const program = record.value.program.calc;
  if (plan.kind === "measure") return "はじめに、いまの力を測るよ。10回のコースの終わりに、同じ種目でもう一度測ってくらべよう。";
  if (plan.kind === "free" && !plan.counted) return "今日の分はできた！ もう一度やると自由練習（記録は残るよ）。";
  if (plan.kind === "course" && plan.session === 1) return "週3回ほどで十分。1日に何度やっても、コースは1日1回ぶん進むよ。";
  if (plan.measure === "after") return "コースの最後。終わりにもう一度測って、最初とくらべよう。";
  if (plan.kind === "free") {
    const next = calcNextBoosterDay(program, today);
    return next ? `おさらいは${Number(next.slice(5, 7))}月${Number(next.slice(8))}日ごろから。` : "";
  }
  return "";
});

// ===== 記憶力 =====
const memoryHasPalace = computed(() => hasPalace(memory.value));
const memoryPracticeOpen = computed(() => practiceOpen(memory.value.lessons) && memoryHasPalace.value);
const lessonsDone = computed(() => memory.value.lessons.length);
const memoryPlan = computed(() => planMemoryToday({
  program: record.value.program.memory,
  hasPalace: memoryHasPalace.value,
  practiceOpen: memoryPracticeOpen.value,
  nextLesson: nextLesson(memory.value.lessons),
  day: today,
}));
const memoryTodayTitle = computed(() => {
  const plan = memoryPlan.value;
  if (plan.kind === "lesson") {
    const lesson = PALACE_LESSONS.find(({ id }) => id === plan.lessonId);
    return lesson ? `学校 講${lesson.number}「${lesson.title}」` : "学校";
  }
  return plan.label;
});
const memoryTodayDetail = computed(() => {
  const plan = memoryPlan.value;
  if (plan.kind === "test") return plan.measure === "before" ? "方法を教わる前に、いまの記憶を測ろう（15個の言葉）。" : "6週間のコースの終わり。最初と同じテストでくらべよう。";
  if (plan.kind === "build") return "自分の家など、よく知っている場所のカードを歩く順に並べよう。";
  if (plan.kind === "lesson") return "講3まで終えると、毎日の練習が開くよ。";
  const steps = [];
  const last = memory.value.lastWords;
  if (last && last.day < today) steps.push("前の回の言葉");
  steps.push(`宮殿に${memory.value.practiceCount}個`);
  if (memory.value.lessons.includes("digits") && Number(today.slice(-2)) % 2 === 1) steps.push("数字");
  const head = plan.session ? "" : plan.counted ? "" : "今日の分はできた！ ";
  return `${head}${steps.join(" → ")}`;
});
const palaceSummary = computed(() => {
  const own = memory.value.palaces;
  if (!own.length) return memory.value.sample ? "見本の宮殿（お城）を使っている" : "よく知っている場所で作ろう";
  return own.map((palace) => `${palace.name}（${palace.loci.length}）`).join("・");
});

function roomLabel(id: RoomId) {
  return BRAIN_ROOMS.find((item) => item.id === id)?.label ?? id;
}
function roomProgress(id: RoomId) {
  if (id === "calc") return calcProgress(record.value.program.calc, today);
  return memoryProgress(record.value.program.memory, { hasPalace: memoryHasPalace.value, practiceOpen: memoryPracticeOpen.value, lessonsDone: lessonsDone.value });
}
function gameLabel(id: string) {
  return brainGame(id)?.label ?? id;
}
function shelfGames(id: RoomId) {
  return BRAIN_GAMES.filter((game) => game.room === id && game.shelf === "shogi");
}

/** 記録の見せ方(D:5-5 身近な尺度)。0は記録なし。 */
function valueText(recordId: string, value: number | undefined) {
  if (!value) return "";
  if (recordId.startsWith("speed-")) return `${perProblemText(value)}（段${recordId.slice(6)}）`;
  switch (recordId) {
    case "nback": return nbackText(value);
    case "glance-sym": return `${glanceLevelLabel(value - 1, "じゃまの印")}で見えた`;
    case "switch": return switchLevelText(value - 1);
    case "glance": return glanceLevelLabel(value - 1);
    case "board-memory": return `駒${value}枚`;
    case "mental": return `${value}手`;
    case "intuition": return intuitionLevelText(value);
    case "einstellung": return `6問中${value}問`;
    case "blind": return blindLevelText(value);
    case "palace": return `宮殿で${value}個`;
    case "recall": return `前の回の言葉${value}個`;
    case "digits": return `数字${value}けた`;
    case "memory-test": return `15個中${value}個`;
    default: return String(value);
  }
}
/** スピード計算のいま見せる記録の鍵(いちばん新しく遊んだ段)。 */
function speedRecordId() {
  const days = Object.keys(record.value.days).sort().reverse();
  for (const day of days) {
    const key = Object.keys(record.value.days[day]).find((id) => id.startsWith("speed-"));
    if (key) return key;
  }
  return `speed-${(record.value.levels.speed ?? 0) + 1}`;
}
function bestText(id: string) {
  const recordId = id === "speed" ? speedRecordId() : id;
  return valueText(recordId, record.value.best[recordId]);
}

const moveSounds = createMoveSoundPlayer(() => props.assetBaseUrl);
onMounted(() => moveSounds.preload());
function playSound(kind: "correct" | "miss" | "best" | "place") {
  if (kind === "correct" || kind === "place") moveSounds.play("normal");
  else if (kind === "best") moveSounds.play("stamp");
}

function save() {
  saveBrainRecord(storage, record.value);
}
function openRoom(id: RoomId) {
  room.value = id;
  roomMessage.value = "";
  record.value = rememberRoom(record.value, id);
  save();
  view.value = "room";
}
function continueRoom() {
  const id = (record.value.room || "calc") as RoomId;
  openRoom(id);
  if (id === "calc") startCalcToday();
  else startMemoryToday();
}
function openEvidence() {
  evidenceFrom.value = view.value === "room" ? "room" : "home";
  view.value = "evidence";
}

function beginRun(items: QueueItem[], single: GameId | null) {
  results.value = [];
  summaryCompare.value = [];
  singleGame.value = single;
  measureValues = {};
  stampedBefore = stamped(record.value, today, room.value);
  bestInRun = false;
  newStamp.value = false;
  queue.value = [...items];
  queueTotal.value = items.length;
  nextGame();
}
function startCalcToday() {
  runPlan = calcPlan.value;
  runMemoryMeasure = null;
  beginRun(runPlan.games.map((game) => ({ id: game.id as GameId, mode: game.mode as "train" | "measure" })), null);
}
function startSingle(gameId: string) {
  const id = gameId as GameId;
  runPlan = null;
  runMemoryMeasure = null;
  room.value = (brainGame(id)?.room ?? room.value) as RoomId;
  beginRun([{ id, mode: "single" }], id);
}
function startMemoryTest() {
  runPlan = null;
  runMemoryMeasure = record.value.program.memory.before ? (memoryPlan.value.kind === "test" ? "after" : null) : "before";
  beginRun([{ id: "memory-test", mode: runMemoryMeasure ? "measure" : "single", measure: runMemoryMeasure ?? "after" }], runMemoryMeasure ? null : "memory-test");
}
function startMemoryToday() {
  const plan = memoryPlan.value;
  roomMessage.value = "";
  if (plan.kind === "test") startMemoryTest();
  else if (plan.kind === "build") openBuilder(memory.value.palaces.length && memory.value.palaces.length < PALACE_MAX ? "list" : "new");
  else if (plan.kind === "lesson") openPalace("lesson", plan.lessonId ?? "");
  else openPalace("practice");
}
function nextGame() {
  const next = queue.value.shift() ?? null;
  currentItem.value = next;
  runKey.value += 1;
  if (next) view.value = "game";
  else finishRun();
}

function finishGame(result: GameResult) {
  const item = currentItem.value;
  if (!item) return;
  const recordId = result.recordId ?? item.id;
  const { record: next, newBest } = recordBrainSession(record.value, item.id, result, today);
  record.value = next;
  save();
  if (item.mode === "measure") measureValues[item.id] = result.value;
  const growth = growthSince(record.value, recordId, today);
  if (newBest) bestInRun = true;
  results.value = [...results.value, {
    label: gameLabel(item.id),
    text: result.text || valueText(recordId, result.value),
    correct: result.correct,
    total: result.total,
    newBest,
    grew: Boolean(growth?.grew),
    measure: item.mode === "measure",
  }];
  nextGame();
}

function measureText(id: string, value: number | undefined) {
  if (!value) return "記録なし";
  if (id === "speed") return perProblemText(value);
  return valueText(id, value);
}
function finishRun() {
  if (runPlan) {
    const before = record.value.program.calc.before;
    const program = completeCalcPlan(record.value.program.calc, runPlan, measureValues, today);
    record.value = { ...record.value, program: { ...record.value.program, calc: program } };
    if ((runPlan.measure === "after" || runPlan.measure === "booster") && before) {
      summaryCompare.value = CALC_MEASURE.map((id) => ({ label: gameLabel(id), before: measureText(id, before.values[id]), after: measureText(id, measureValues[id]) }));
    }
  }
  if (runMemoryMeasure) {
    const row = results.value[0];
    const before = record.value.program.memory.before;
    record.value = { ...record.value, program: { ...record.value.program, memory: recordMemoryTest(record.value.program.memory, runMemoryMeasure, { correct: row?.correct ?? 0, total: row?.total ?? 15 }, today) } };
    if (runMemoryMeasure === "after" && before) summaryCompare.value = [{ label: "記憶テスト", before: `${before.total}個中${before.correct}個`, after: `${row?.total ?? 15}個中${row?.correct ?? 0}個` }];
  }
  save();
  showSummary();
}
function showSummary() {
  newStamp.value = !stampedBefore && stamped(record.value, today, room.value);
  if (newStamp.value || bestInRun) playSound("best");
  view.value = "summary";
}
const summaryMessage = computed(() => {
  const best = results.value.find((row) => row.newBest);
  if (runPlan?.kind === "measure") return "これが「前」の記録。10回のコースのあとに、同じ種目でもう一度測ってくらべよう。週3回ほどで十分だよ。";
  if (runMemoryMeasure === "before") return "これが「前」の記録。次は、自分の宮殿を作って場所法を覚えよう。6週間のあとに、同じテストでくらべるよ。";
  if (summaryCompare.value.length) return "最初の記録とくらべてみよう。続けた分だけ、ちゃんと伸びているよ。";
  if (best) return `${best.label}で自己ベスト！ ${best.text}。`;
  if (results.value.some((row) => row.grew)) return "前の日より伸びたよ。日をあけて続けると、もっと伸びるよ。";
  return "おつかれさま！ また明日、同じ練習をしてみよう。";
});
function backToRoom() {
  view.value = "room";
}

// ===== 宮殿づくりと学校 =====
function openBuilder(start: "new" | "list") {
  room.value = "memory";
  builderStart.value = start;
  runKey.value += 1;
  view.value = "builder";
}
function saveBuilder(value: { palaces: MemoryStore["palaces"]; sample: boolean }) {
  memory.value = { ...memory.value, palaces: value.palaces, sample: value.sample };
  saveMemoryStore(storage, memory.value);
}
function builtPalace(palaceId: string) {
  const palace = memory.value.palaces.find(({ id }) => id === palaceId);
  record.value = stampRoom(record.value, "memory", today);
  save();
  roomMessage.value = memory.value.lessons.length
    ? `宮殿「${palace?.name ?? ""}」ができたよ。学校で「使う宮殿」を切り替えられるよ。`
    : `宮殿「${palace?.name ?? ""}」ができた！ 次は学校の講1で、宮殿を歩いてみよう。`;
  view.value = "room";
}
function openPalace(mode: "school" | "lesson" | "practice", lessonId = "") {
  room.value = "memory";
  palaceMode.value = mode;
  palaceLesson.value = lessonId;
  runKey.value += 1;
  stampedBefore = stamped(record.value, today, "memory");
  bestInRun = false;
  view.value = "palace";
}
function savePalace(patch: Partial<MemoryStore>) {
  memory.value = { ...memory.value, ...patch };
  saveMemoryStore(storage, memory.value);
}
function finishPalace(result: PalaceFinish) {
  record.value = stampRoom(record.value, "memory", today);
  results.value = [];
  summaryCompare.value = [];
  singleGame.value = null;
  runPlan = null;
  runMemoryMeasure = null;
  for (const row of result.records) {
    const { record: next, newBest } = recordBrainSession(record.value, row.gameId, { value: row.value, level: row.level }, today);
    record.value = next;
    if (newBest) bestInRun = true;
    const growth = growthSince(record.value, row.gameId, today);
    results.value.push({ label: gameLabel(row.gameId), text: row.text, correct: 0, total: 0, newBest, grew: Boolean(growth?.grew), measure: false });
  }
  if (result.kind === "practice") {
    record.value = { ...record.value, program: { ...record.value.program, memory: completeMemoryPractice(record.value.program.memory, today) } };
    save();
    showSummary();
    return;
  }
  save();
  const lesson = PALACE_LESSONS.find(({ id }) => id === result.lessonId);
  if (palaceMode.value === "lesson") {
    roomMessage.value = lesson ? `講${lesson.number}「${lesson.title}」を終えたね！${practiceOpen(memory.value.lessons) && lesson.id === "place5" ? " 毎日の練習が開いたよ。" : ""}` : "";
    view.value = "room";
  }
}

// ===== 記録 =====
const compareHeads = computed(() => {
  if (room.value === "calc") {
    const program = record.value.program.calc;
    return program.before ? ["最初", ...program.after.map(({ label }) => label)] : [];
  }
  const program = record.value.program.memory;
  return program.before ? ["最初", ...program.after.map(() => "コースの後")] : [];
});
const compareRows = computed(() => {
  if (room.value === "calc") {
    const program = record.value.program.calc;
    if (!program.before) return [];
    return CALC_MEASURE.map((id) => ({
      label: gameLabel(id),
      cells: [program.before!.values[id], ...program.after.map(({ values }) => values[id])].map((value) => (value ? measureText(id, value) : "")),
    }));
  }
  const program = record.value.program.memory;
  if (!program.before) return [];
  return [{ label: "記憶テスト", cells: [program.before, ...program.after].map((test) => `${test.total}個中${test.correct}個`) }];
});
const recordLines = computed(() => {
  const ids = room.value === "calc"
    ? [speedRecordId(), "nback", "glance-sym", "switch", "glance", "mental"]
    : ["palace", "recall", "digits", "memory-test", "board-memory"];
  return ids.map((id) => {
    const series = dailySeries(record.value, id).slice(-20);
    const label = id.startsWith("speed-") ? `スピード計算（段${id.slice(6)}）` : gameLabel(id);
    return { id, label, days: series.length, points: sparkPoints(series.map(({ value }) => value), lowerIsBetter(id)), best: valueText(id, record.value.best[id]) || "—" };
  });
});
/** 記録の線(上ほど良い)。2日分以上あるときだけ描く。 */
function sparkPoints(values: number[], low: boolean) {
  if (values.length < 2) return "";
  const shown = values.map((value) => (low ? -value : value));
  const min = Math.min(...shown);
  const max = Math.max(...shown);
  const span = max - min || 1;
  return shown.map((value, index) => `${Math.round((index / (shown.length - 1)) * 116) + 2},${Math.round(30 - ((value - min) / span) * 28)}`).join(" ");
}

/** ブラウザの戻る操作と、見出しの戻るボタン。種目・結果・記録からは部屋へ、部屋からは入口へ、入口からはホームへ。 */
function goBack() {
  if (view.value === "palace" && palaceView.value?.goBack()) return;
  if (view.value === "builder" && builderView.value?.goBack()) return;
  if (view.value === "home") {
    emit("close");
    return;
  }
  if (view.value === "evidence") {
    view.value = evidenceFrom.value;
    return;
  }
  if (view.value === "room") {
    view.value = "home";
    return;
  }
  queue.value = [];
  currentItem.value = null;
  view.value = "room";
}
defineExpose({ goBack });

</script>

<style>
.shogi-game .shogi-brain__home,
.shogi-game .shogi-brain__summary,
.shogi-game .shogi-brain__evidence,
.shogi-game .shogi-brain__records {
  display: grid;
  gap: 0.8rem;
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
.shogi-game .shogi-brain__today .shogi-brain__today-note { color: #9fe0b4; }
.shogi-game .shogi-brain__today-eyebrow {
  color: #f1a54c;
  font-size: 0.8em;
  font-weight: 800;
  letter-spacing: 0.06em;
}

/* 入口の2つの部屋の扉 */
.shogi-game .shogi-brain__rooms {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
  width: min(100%, 40rem);
  margin: 0 auto;
  padding: 0;
  list-style: none;
}
.shogi-game .shogi-brain__room-card {
  display: grid;
  justify-items: center;
  gap: 0.2rem;
  width: 100%;
  min-height: 9rem;
  padding: 0.8rem 0.6rem;
  border: 3px solid rgba(255, 252, 244, 0.25);
  border-radius: 1rem;
  color: #fffcf4;
  background: #2b465b;
  box-shadow: 0 4px 0 #172632;
  font: inherit;
  text-align: center;
  cursor: pointer;
}
.shogi-game .shogi-brain__room-card--calc { border-color: #f1a54c; }
.shogi-game .shogi-brain__room-card--memory { border-color: #b8a8f5; }
.shogi-game .shogi-brain__room-emoji { font-size: 2.2rem; line-height: 1; }
.shogi-game .shogi-brain__room-card strong { font-size: 1.35em; }
.shogi-game .shogi-brain__room-card small { color: #cfd8de; font-size: 0.82em; }
.shogi-game .shogi-brain__room-stamp { padding: 0.1rem 0.6rem; border-radius: 999px; color: #cfd8de; background: rgba(255, 252, 244, 0.1); font-size: 0.8em; font-weight: 800; }
.shogi-game .shogi-brain__room-stamp--done { color: #172632; background: #9fe0b4; }

/* 判子のカレンダー。計算力は橙の丸、記憶力は紫の四角(色と形の両方で分ける。U:7-3)。 */
.shogi-game .shogi-brain__calendar { width: min(100%, 40rem); margin: 0 auto; }
.shogi-game .shogi-brain__calendar-title {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.3rem;
  margin: 0 0 0.3rem;
  color: #f1a54c;
  font-size: 0.85rem;
  font-weight: 800;
}
.shogi-game .shogi-brain__legend { display: inline-flex; align-items: center; gap: 0.3rem; color: #cfd8de; font-weight: 700; }
.shogi-game .shogi-brain__calendar table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.shogi-game .shogi-brain__calendar th { color: #cfd8de; font-size: 0.72rem; font-weight: 700; }
.shogi-game .shogi-brain__calendar td {
  height: 2.1rem;
  padding: 0.1rem;
  border: 1px solid rgba(255, 252, 244, 0.1);
  color: #cfd8de;
  font-size: 0.7rem;
  text-align: center;
  vertical-align: top;
}
.shogi-game .shogi-brain__calendar td > span:first-child { display: block; line-height: 1.1; }
.shogi-game .shogi-brain__calendar .shogi-brain__day--today { outline: 2px solid #f1a54c; outline-offset: -2px; color: #fffcf4; }
.shogi-game .shogi-brain__calendar .shogi-brain__day--future { opacity: 0.35; }
.shogi-game .shogi-brain__stamps { display: flex; justify-content: center; gap: 0.15rem; margin-top: 0.1rem; }
.shogi-game .shogi-brain__stamp { display: inline-block; width: 0.7rem; height: 0.7rem; }
.shogi-game .shogi-brain__stamp--calc { border-radius: 50%; background: #f1a54c; }
.shogi-game .shogi-brain__stamp--memory { border-radius: 0.1rem; background: #b8a8f5; transform: rotate(45deg) scale(0.85); }

/* 部屋 */
.shogi-game .shogi-brain__room {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.8rem;
  align-content: start;
}
.shogi-game .shogi-brain__room-main,
.shogi-game .shogi-brain__room-side {
  display: grid;
  gap: 0.6rem;
  align-content: start;
  width: min(100%, 40rem);
  margin: 0 auto;
}
.shogi-game .shogi-brain__room-message { margin: 0; color: #9fe0b4; font-weight: 800; text-align: center; }
.shogi-game .shogi-brain__records-open { justify-self: center; }
.shogi-game .shogi-brain__shelf-title {
  margin: 0.2rem 0 0;
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
.shogi-game .shogi-brain__cards--grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.shogi-game .shogi-brain__card {
  position: relative;
  display: grid;
  gap: 0.15rem;
  justify-items: start;
  align-content: start;
  width: 100%;
  height: 100%;
  min-height: 44px;
  padding: 0.6rem 0.8rem;
  border: 2px solid rgba(255, 252, 244, 0.25);
  border-radius: 0.8rem;
  color: #fffcf4;
  background: #2b465b;
  box-shadow: 0 3px 0 #172632;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.shogi-game .shogi-brain__card strong { font-size: 1.02em; }
.shogi-game .shogi-brain__card small { color: #cfd8de; font-size: 0.8em; }
.shogi-game .shogi-brain__card--shelf { background: #24394b; }
.shogi-game .shogi-brain__card:disabled { opacity: 0.55; cursor: default; }
.shogi-game .shogi-brain__card-tag {
  position: absolute;
  top: 0.5rem;
  right: 0.6rem;
  color: #d7d1fd;
  font-size: 0.75em;
  font-weight: 800;
}
.shogi-game .shogi-brain__card-best { color: #9fe0b4; font-size: 0.75em; font-weight: 800; }
@media (hover: hover) {
  .shogi-game .shogi-brain__today:hover,
  .shogi-game .shogi-brain__room-card:hover,
  .shogi-game .shogi-brain__card:not(:disabled):hover {
    border-color: #f1a54c;
    transform: translateY(-0.1em);
  }
}
.shogi-game .shogi-brain__today:focus-visible,
.shogi-game .shogi-brain__room-card:focus-visible,
.shogi-game .shogi-brain__card:focus-visible {
  outline: 3px solid #d7d1fd;
  outline-offset: 2px;
}
.shogi-game .shogi-brain__stage {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.6rem 1rem 1rem;
}
.shogi-game .shogi-brain__step { margin: 0 0 0.3rem; color: #cfd8de; font-size: 0.8rem; text-align: center; }

/* 記録 */
.shogi-game .shogi-brain__compare { width: min(100%, 40rem); margin: 0 auto; }
.shogi-game .shogi-brain__compare h2 { margin: 0 0 0.3rem; color: #f1a54c; font-size: 1rem; }
.shogi-game .shogi-brain__compare table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.shogi-game .shogi-brain__compare th,
.shogi-game .shogi-brain__compare td { padding: 0.35rem 0.4rem; border-bottom: 1px solid rgba(255, 252, 244, 0.12); text-align: left; }
.shogi-game .shogi-brain__compare thead th { color: #cfd8de; font-weight: 700; }
.shogi-game .shogi-brain__compare tbody th { color: #fffcf4; }
.shogi-game .shogi-brain__records-empty,
.shogi-game .shogi-brain__records-note { width: min(100%, 40rem); margin: 0 auto; color: #cfd8de; font-size: 0.85rem; }
.shogi-game .shogi-brain__lines {
  display: grid;
  gap: 0.35rem;
  width: min(100%, 40rem);
  margin: 0 auto;
  padding: 0;
  list-style: none;
}
.shogi-game .shogi-brain__lines li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 7.5rem auto;
  align-items: center;
  gap: 0.6rem;
  padding: 0.4rem 0.7rem;
  border-radius: 0.6rem;
  background: #2b465b;
}
.shogi-game .shogi-brain__line-name { font-weight: 800; font-size: 0.9rem; }
.shogi-game .shogi-brain__lines strong { color: #9fe0b4; font-size: 0.82rem; text-align: right; }
.shogi-game .shogi-brain__spark { width: 7.5rem; height: 2rem; }
.shogi-game .shogi-brain__spark polyline { fill: none; stroke: #f1a54c; stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; }
.shogi-game .shogi-brain__spark--empty { display: grid; place-items: center; color: #5d7c8f; font-size: 0.72rem; }

/* 結果 */
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
.shogi-game .shogi-brain__result-name small { color: #cfd8de; font-weight: 700; }
.shogi-game .shogi-brain__results strong { grid-area: value; font-size: 1.1em; }
.shogi-game .shogi-brain__results > li > small { grid-area: count; color: #cfd8de; }
.shogi-game .shogi-brain__result-tag { grid-area: tag; justify-self: end; color: #f1a54c; font-weight: 800; font-size: 0.85em; }
.shogi-game .shogi-brain__result-tag--best { color: #9fe0b4; }
.shogi-game .shogi-brain__new-stamp {
  justify-self: center;
  display: grid;
  place-items: center;
  width: 3.4rem;
  height: 3.4rem;
  margin: 0;
  border: 4px double #e05a3a;
  border-radius: 50%;
  color: #e05a3a;
  font-size: 1.5rem;
  font-weight: 900;
  transform: rotate(-12deg);
  animation: brain-stamp 420ms ease-out;
}
.shogi-game .shogi-brain__new-stamp--memory { border-color: #9a86f0; color: #9a86f0; border-radius: 0.6rem; }
@keyframes brain-stamp {
  0% { opacity: 0; transform: rotate(-12deg) scale(1.8); }
  70% { opacity: 1; transform: rotate(-12deg) scale(0.92); }
  100% { transform: rotate(-12deg) scale(1); }
}
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
@media (min-width: 900px) {
  .shogi-game .shogi-brain__room { grid-template-columns: minmax(0, 22rem) minmax(0, 32rem); justify-content: center; }
  .shogi-game .shogi-brain__room-main,
  .shogi-game .shogi-brain__room-side { margin: 0; }
}
@media (orientation: landscape) and (max-height: 600px) {
  .shogi-game .shogi-brain__room { grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr); }
  .shogi-game .shogi-brain__home { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .shogi-game .shogi-brain__home > .shogi-dex__speech { grid-column: 1 / -1; }
  .shogi-game .shogi-brain__room-card { min-height: 7rem; }
  /* 横向きのスマホでも、6週間のカレンダーが1画面に収まる高さにする。 */
  .shogi-game .shogi-brain__home { gap: 0.5rem; }
  .shogi-game .shogi-brain__calendar td { height: 1.3rem; }
  .shogi-game .shogi-brain__room-side { gap: 0.45rem; }
  /* 計算力の部屋は種目が9つあるので、横向きのスマホでは説明の文を省いて1画面に収める(U:7-5の3)。 */
  .shogi-game [data-brain-room-view="calc"] .shogi-brain__card small { display: none; }
  .shogi-game .shogi-brain__room .shogi-brain__card { padding: 0.45rem 0.8rem; }
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
  line-height: 1.5;
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
.shogi-game .brain-game__primary:disabled,
.shogi-game .brain-game__secondary:disabled { opacity: 0.45; cursor: default; }
@media (hover: hover) {
  /* 全体のボタンの書式(灰色の地)だと、琥珀色のボタンの暗い文字が読みにくくなるので、琥珀色のまま明るくする。 */
  .shogi-game .brain-game__primary:not(:disabled):hover { background-color: #f6b968; }
}
.shogi-game .brain-game__primary:focus-visible,
.shogi-game .brain-game__secondary:focus-visible,
.shogi-game .brain-glance__choice:focus-visible {
  outline: 3px solid #d7d1fd;
  outline-offset: 2px;
}

/* 白い紙の面(計算力の種目)。問題を大きく1つ、答えは下の数字キー(11-4)。 */
.shogi-game .brain-calc { gap: 0.8rem; }
.shogi-game .brain-paper {
  display: grid;
  justify-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.6rem 1rem 1rem;
  border-radius: 1rem;
  color: #172632;
  background: #fffcf4;
  box-shadow: 0 4px 0 #c9c2b0;
}
.shogi-game .brain-paper__bar {
  width: 100%;
  height: 5px;
  border-radius: 3px;
  background: #ece5d4;
  overflow: hidden;
}
.shogi-game .brain-paper__bar span {
  display: block;
  height: 100%;
  background: #d9822b;
  transform-origin: left;
  transition: transform 200ms;
}
.shogi-game .brain-paper__status {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  width: 100%;
  margin: 0;
  color: #5d6f7c;
  font-size: 0.8rem;
  font-weight: 700;
}
.shogi-game .brain-paper__lead { margin: 0; font-size: 1.02rem; font-weight: 800; line-height: 1.6; text-align: center; }
.shogi-game .brain-paper__sample { display: flex; align-items: baseline; gap: 0.6rem; margin: 0; font-size: 1.5rem; font-weight: 900; }
.shogi-game .brain-paper__sample span { padding: 0.05rem 0.5rem; border-radius: 999px; color: #fffcf4; background: #5d6f7c; font-size: 0.75rem; }
.shogi-game .brain-paper__sample strong { color: #2a8a4a; }
.shogi-game .brain-paper__problem {
  margin: 0.2rem 0 0;
  font-size: clamp(2.6rem, 13vw, 4.4rem);
  font-weight: 900;
  line-height: 1.1;
  letter-spacing: 0.04em;
  white-space: nowrap;
}
.shogi-game .brain-paper__problem--done { color: #2a8a4a; font-size: clamp(2rem, 9vw, 3rem); }
.shogi-game .brain-paper__answer {
  min-width: 6rem;
  min-height: 3.2rem;
  margin: 0;
  padding: 0.1rem 0.8rem;
  border-bottom: 4px solid #c9c2b0;
  font-size: 2.4rem;
  font-weight: 900;
  line-height: 1.25;
  text-align: center;
}
.shogi-game .brain-paper__answer--ok { border-color: #2a8a4a; color: #2a8a4a; }
.shogi-game .brain-paper__answer--miss { border-color: #cf3b30; color: #b2281f; font-size: 1.3rem; animation: brain-shake 260ms; }
@keyframes brain-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-6px); }
  75% { transform: translateX(6px); }
}
.shogi-game .brain-calc__controls { display: grid; justify-items: center; width: 100%; }
@media (orientation: landscape) and (max-height: 600px) {
  .shogi-game .brain-calc {
    grid-template-columns: minmax(0, 1fr) minmax(0, 18rem);
    align-items: center;
    width: min(100%, 46rem);
  }
  .shogi-game .brain-paper__problem { font-size: clamp(2rem, 9vh, 3.4rem); }
  .shogi-game .brain-pad__key { min-height: 52px; }
  .shogi-game .brain-switch__frame--big { min-height: 8rem; }
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
/* 記号版のちらっと見る。木の盤ではなく白い紙に、線のない升目。 */
.shogi-game .brain-board--sym { border: 3px solid #c9c2b0; border-radius: 0.8rem; background: #fffcf4; }
.shogi-game .brain-board--sym .brain-board__cell { border-color: transparent; }
.shogi-game .brain-board--sym .brain-board__dot { background: #5d6f7c; }
.shogi-game .brain-board--sym .brain-board__noise {
  background:
    repeating-linear-gradient(45deg, rgba(23, 38, 50, 0.85) 0 6px, rgba(255, 252, 244, 0.9) 6px 12px),
    repeating-linear-gradient(-45deg, rgba(23, 38, 50, 0.5) 0 4px, transparent 4px 10px);
}
.shogi-game .brain-board--sym .brain-board__cell--ok { background: rgba(60, 170, 90, 0.35); border-radius: 0.4rem; }
.shogi-game .brain-board--sym .brain-board__cell--answer { background: rgba(220, 70, 60, 0.3); border-radius: 0.4rem; }
.shogi-game .brain-sym { font-size: 8.5cqw; font-weight: 900; line-height: 1; }
.shogi-game .brain-sym--center { color: #172632; }
.shogi-game .brain-sym--target { color: #d9822b; }
.shogi-game .brain-sym--noise { color: #8a97a1; }

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

/* ちらっと盤・ちらっと見るの答え。真ん中の2つと、8方向の矢印。 */
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
  /* 盤面の記憶は、時間のバーとボタンを別の段にする(同じ段だと、バーがボタンの後ろに重なった)。 */
  .shogi-game .brain-memory { grid-template-areas: "status status" "board prompt" "board timer" "board tools"; }
  .shogi-game .brain-memory > .brain-memory__timer { grid-area: timer; align-self: end; width: 100%; }
  .shogi-game .brain-memory > :is(.brain-memory__tools, .brain-game__actions),
  .shogi-game .brain-mental > :is(.brain-mental__move, .brain-mental__choices, .brain-game__actions) { grid-area: tools; }
}
@media (prefers-reduced-motion: reduce) {
  .shogi-game .brain-memory__timer span { animation: none; }
  .shogi-game .brain-paper__bar span { transition: none; }
  .shogi-game .brain-paper__answer--miss { animation: none; }
  .shogi-game .shogi-brain__new-stamp { animation: none; }
  .shogi-game .shogi-brain__today,
  .shogi-game .shogi-brain__room-card,
  .shogi-game .shogi-brain__card { transition: none; transform: none !important; }
}
</style>
