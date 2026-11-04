<template>
  <!--
    脳トレ道場(docs/brain-training-design.mdの11章)。計算力と記憶力の2つの部屋。
    見た目は将棋教室と同じ枠(shogi-dex・shogi-tutorial)を使い、種目の問題は白い紙のような面に大きく出す。
  -->
  <div ref="rootEl" class="shogi-dex shogi-tutorial shogi-brain" role="dialog" aria-modal="true" aria-labelledby="shogi-brain-title" data-brain-training>
    <header class="shogi-dex__header">
      <button type="button" class="shogi-dex__back" data-brain-back @click="goBack">
        <span aria-hidden="true">←</span> {{ backLabel }}
      </button>
      <h1 id="shogi-brain-title">{{ headerTitle }}</h1>
      <button v-if="view === 'home' || view === 'room'" type="button" class="shogi-brain__evidence-open" aria-label="脳トレの根拠" data-brain-evidence @click="openEvidence">?</button>
    </header>

    <!-- 入口(docs/brain-training-design.mdの14-4・14-6)。主役は今日の稽古の札1枚。今週の判子、2つの部屋の扉、いつ稽古するか。 -->
    <section v-if="view === 'home'" class="shogi-tutorial__shelf shogi-brain__home" aria-label="脳トレの部屋" data-brain-home>
      <div class="shogi-brain__home-main">
        <div class="shogi-dex__speech shogi-tutorial__intro">
          <img class="shogi-dex__chara" :src="charaUrl" alt="" aria-hidden="true">
          <p>{{ homeMessage }}</p>
        </div>
        <BrainTodayCard
          v-if="pick"
          :room="pick"
          v-bind="pick === 'calc' ? calcCard : memoryCard"
          data-brain-continue
          @start="startRoomToday(pick)"
        />
        <section v-else class="brain-done" aria-label="今日の稽古はおしまい" data-brain-done>
          <p class="brain-done__seals" aria-hidden="true"><i class="brain-seal brain-seal--calc">計</i><i class="brain-seal brain-seal--memory"><span>記</span></i></p>
          <h2>今日の稽古はおしまい</h2>
          <p>日をあけて続けると、長く身につくよ。</p>
          <button type="button" class="brain-game__secondary" data-brain-more @click="openRoom((record.room || 'calc') as RoomId)">もう少し練習する</button>
        </section>
        <p v-if="cueLine && !cueEditing" class="brain-cue-line" data-brain-cue-line>
          <span aria-hidden="true">⏰</span><span>{{ cueLine }}</span>
          <button type="button" class="brain-cue-line__edit" data-brain-cue-edit @click="cueEditing = true">変える</button>
        </p>
        <BrainCueChooser v-if="cueEditing" :model-value="record.cue" lead="いつ稽古する？" @choose="chooseCue" />
      </div>
      <div class="shogi-brain__home-side">
        <BrainWeekStrip :strip="week" :counts="weekly" :day-label="todayLabel" />
        <div class="brain-doors">
          <button
            v-for="item in BRAIN_ROOMS"
            :key="item.id"
            type="button"
            class="brain-door"
            :class="`brain-door--${item.id}`"
            :data-brain-room="item.id"
            @click="openRoom(item.id as RoomId)"
          >
            <span class="brain-door__icon" aria-hidden="true">{{ item.emoji }}</span>
            <strong>{{ item.label }}</strong>
            <small>{{ roomProgress(item.id as RoomId).text }}</small>
            <i v-if="stamped(record, today, item.id)" class="brain-seal" :class="`brain-seal--${item.id}`" :aria-label="`${item.label}は今日の判子あり`"><span>{{ item.id === 'calc' ? '計' : '記' }}</span></i>
          </button>
        </div>
      </div>
    </section>

    <!-- 計算力の部屋。主役は今日の稽古、コースの道、自由に練習の4つ、将棋の棚と記録(14-6の2)。 -->
    <section v-else-if="view === 'room' && room === 'calc'" class="shogi-tutorial__shelf shogi-brain__room" aria-label="計算力の部屋" data-brain-room-view="calc">
      <div class="shogi-brain__room-main">
        <p v-if="roomMessage" class="shogi-brain__room-message" role="status">{{ roomMessage }}</p>
        <BrainTodayCard room="calc" v-bind="calcCard" @start="startCalcToday" />
        <section class="brain-road" aria-label="コースの道" data-brain-road>
          <p class="brain-road__head"><strong>コースの道</strong><span>{{ calcGoal }}</span></p>
          <ol class="brain-road__line">
            <li
              v-for="stone in calcRoad"
              :key="stone.key"
              class="brain-road__stone"
              :class="[`brain-road__stone--${stone.state}`, { 'brain-road__stone--measure': stone.measure, 'brain-road__stone--booster': stone.booster }]"
              :aria-label="stone.aria"
            >{{ stone.label }}</li>
          </ol>
        </section>
      </div>
      <div class="shogi-brain__room-side">
        <p class="brain-section-title"><span>自由に練習</span><span>自己ベスト</span></p>
        <ul class="brain-tiles">
          <li v-for="game in CALC_GAMES" :key="game.id">
            <button type="button" class="brain-tile" :data-brain-game="game.id" @click="startSingle(game.id)">
              <strong><span aria-hidden="true">{{ GAME_ICONS[game.id] }}</span> {{ game.label }}</strong>
              <span>{{ bestText(game.id) || "まだ記録なし" }}</span>
            </button>
          </li>
        </ul>
        <div class="brain-rowlinks">
          <button type="button" class="brain-rowlink" data-brain-shelf @click="openShelf">☗ 将棋の棚</button>
          <button type="button" class="brain-rowlink" data-brain-records @click="openRecords">📈 記録</button>
        </div>
      </div>
    </section>

    <!-- 記憶力の部屋。今日の稽古、6週間コース、記憶の道(押せない札の代わり)、わたしの宮殿、棚と記録(14-6の5)。 -->
    <section v-else-if="view === 'room' && room === 'memory'" class="shogi-tutorial__shelf shogi-brain__room" aria-label="記憶力の部屋" data-brain-room-view="memory">
      <div class="shogi-brain__room-main">
        <p v-if="roomMessage" class="shogi-brain__room-message" role="status">{{ roomMessage }}</p>
        <BrainTodayCard room="memory" v-bind="memoryCard" @start="startMemoryToday" />
        <section class="brain-road" aria-label="6週間コース" data-brain-weeks6>
          <p class="brain-road__head"><strong>6週間コース</strong><span>{{ memoryGoal }}</span></p>
          <ol class="brain-weeks6">
            <li v-for="(column, index) in memoryWeeks" :key="index">
              <span class="brain-weeks6__dots" aria-hidden="true"><i v-for="dot in column" :key="dot.n" :class="`brain-weeks6__dot--${dot.state}`"></i></span>
              <span>{{ index + 1 }}週</span>
            </li>
          </ol>
        </section>
      </div>
      <div class="shogi-brain__room-side">
        <p class="brain-section-title"><span>記憶の道</span></p>
        <ol class="brain-path" data-brain-path>
          <li v-for="node in memoryPath" :key="node.id" :class="`brain-path__node--${node.state}`">
            <button type="button" class="brain-path__button" :disabled="node.state === 'locked'" :data-brain-path-node="node.id" @click="openPathNode(node.id)">
              <b aria-hidden="true">{{ node.state === 'locked' ? '🔒' : node.icon }}</b>
              <span>{{ node.label }}</span>
              <small>{{ node.sub }}</small>
            </button>
          </li>
        </ol>
        <p class="brain-section-title"><span>わたしの宮殿</span></p>
        <ul class="brain-palaces">
          <li v-for="item in palaceChips" :key="item.id">
            <button type="button" class="brain-palace-chip" :data-brain-palace-chip="item.id" @click="openBuilder('list')">
              <strong><span aria-hidden="true">{{ item.emoji }}</span> {{ item.name }}</strong>
              <small>{{ item.sub }}</small>
            </button>
          </li>
          <li v-if="memory.palaces.length < PALACE_MAX">
            <button type="button" class="brain-palace-chip brain-palace-chip--add" data-brain-builder-open @click="openBuilder(memory.palaces.length ? 'new' : 'list')">＋ 作る</button>
          </li>
        </ul>
        <div class="brain-rowlinks">
          <button type="button" class="brain-rowlink" data-brain-box-open @click="openBox('list')">🗃️ 箱<em v-if="boxDueCount" class="brain-rowlink__badge" :aria-label="`今日${boxDueCount}つ`">{{ boxDueCount }}</em></button>
          <button type="button" class="brain-rowlink" data-brain-shelf @click="openShelf">☗ 将棋の棚</button>
          <button type="button" class="brain-rowlink" data-brain-records @click="openRecords">📈 記録</button>
        </div>
      </div>
    </section>

    <!-- 将棋の棚(部屋ごと)。自由に遊ぶ将棋の種目(11-7・12章)。 -->
    <section v-else-if="view === 'shelf'" class="shogi-tutorial__shelf shogi-brain__shelf" aria-label="将棋の棚" data-brain-shelf-view>
      <p class="shogi-brain__shelf-lead">将棋の力を、将棋の盤の上で練習する種目だよ。好きなものを選んでね。</p>
      <ul class="shogi-brain__cards shogi-brain__cards--grid">
        <li v-for="game in shelfGames(room)" :key="game.id">
          <button type="button" class="shogi-brain__card shogi-brain__card--shelf" :data-brain-game="game.id" @click="startSingle(game.id)">
            <strong>☗ {{ game.label }}</strong>
            <small>{{ game.desc }}</small>
            <span v-if="bestText(game.id)" class="shogi-brain__card-best">{{ bestText(game.id) }}</span>
          </button>
        </li>
      </ul>
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
        :bests="speedBests"
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
        @box="openBoxFromLesson"
      />
    </section>

    <!-- 思い出しの箱(14-6の8・9) -->
    <section v-else-if="view === 'box'" class="shogi-brain__stage" aria-label="思い出しの箱" data-brain-box-view>
      <BrainMemoryBox
        ref="boxView"
        :key="`box-${runKey}`"
        :store="memory"
        :day="today"
        :chara-url="charaUrl"
        :start="boxStart"
        :review-id="boxReviewId"
        :next-label="boxNextLabel"
        @sound="playSound"
        @save="savePalace"
        @added="stampBox"
        @reviewed="stampBox"
        @checked="stampBox"
        @next="boxNext"
        @build="openBuilder(memory.palaces.length < PALACE_MAX ? 'new' : 'list')"
      />
    </section>

    <!-- 記録。前と後のくらべと、種目ごとの線。 -->
    <section v-else-if="view === 'records'" class="shogi-tutorial__shelf shogi-brain__records" aria-label="記録" data-brain-records-view>
      <!-- 記録は3つのタブ(判子・前と後・記録の線)。1つずつ1画面に収める(U:7-5の2)。 -->
      <div class="brain-tabs" role="tablist" aria-label="記録の切り替え">
        <button v-for="tab in RECORD_TABS" :key="tab.id" type="button" role="tab" class="brain-tabs__tab" :class="{ 'brain-tabs__tab--on': recordsTab === tab.id }" :aria-selected="recordsTab === tab.id" :data-brain-records-tab="tab.id" @click="recordsTab = tab.id">{{ tab.label }}</button>
      </div>
      <template v-if="recordsTab === 'stamps'">
        <div class="shogi-brain__calendar" data-brain-calendar>
        <p class="shogi-brain__calendar-title">
          <span>判子の6週間・目安に届いた週 {{ metWeekCount }}週</span>
          <span class="shogi-brain__legend"><i class="brain-seal brain-seal--calc" aria-hidden="true">計</i>計算力 <i class="brain-seal brain-seal--memory" aria-hidden="true"><span>記</span></i>記憶力</span>
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
                  <i v-if="cell.calc" class="brain-seal brain-seal--calc brain-seal--mini"></i>
                  <i v-if="cell.memory" class="brain-seal brain-seal--memory brain-seal--mini"></i>
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
        <BrainCueChooser :model-value="record.cue" :lead="cueLine ? `いつ稽古する？（いまは「${cueLine}」）` : 'いつ稽古する？ 決めておくと続けやすいよ。'" @choose="chooseCue" />
      </template>
      <template v-else-if="recordsTab === 'compare'">
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
      </template>
      <template v-else>
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
      </template>
    </section>

    <!-- 結果。種目ごとの記録と、前の日より伸びたもの、測ったときは前と後。 -->
    <section v-else-if="view === 'summary'" class="shogi-tutorial__shelf shogi-brain__summary" :class="`shogi-brain__summary--${room}`" aria-label="今日の成績" data-brain-summary>
      <div class="shogi-brain__summary-main">
        <BrainReport :room="room" :date-label="todayLabel" :title="runTitle" :rows="reportRows" :compare="summaryCompare" :stamp="newStamp" :stamp-date="stampDate" :goal="reportGoal" />
      </div>
      <div class="shogi-brain__summary-side">
        <div class="shogi-dex__speech shogi-tutorial__intro">
          <img class="shogi-dex__chara" :src="charaUrl" alt="" aria-hidden="true">
          <p>{{ summaryMessage }}</p>
        </div>
        <BrainCueChooser v-if="askCue" :model-value="record.cue" @choose="chooseCue" />
        <div class="brain-game__actions shogi-brain__summary-actions">
          <button v-if="singleGame" type="button" class="brain-game__secondary" data-brain-again @click="startSingle(singleGame)">もう一度</button>
          <button type="button" class="brain-cta" data-brain-home @click="backToRoom">部屋へ戻る</button>
        </div>
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
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
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
import BrainMemoryBox from "./brain/BrainMemoryBox.vue";
import BrainTodayCard from "./brain/BrainTodayCard.vue";
import BrainWeekStrip from "./brain/BrainWeekStrip.vue";
import BrainCueChooser from "./brain/BrainCueChooser.vue";
import BrainReport, { type ReportRow } from "./brain/BrainReport.vue";
import { glanceLevelLabel } from "./core/brain-glance.mjs";
import { blindLevelText, intuitionLevelText } from "./core/brain-shogi-sense.mjs";
import { nbackText, perProblemText, switchLevelText } from "./core/brain-calc.mjs";
import {
  BRAIN_GAMES,
  BRAIN_ROOMS,
  brainGame,
  dailySeries,
  dayKey,
  growthSince,
  loadBrainRecord,
  lowerIsBetter,
  recordBrainSession,
  rememberRoom,
  saveBrainRecord,
  setBrainCue,
  stampCalendar,
  stampRoom,
  stamped,
  startLevel,
} from "./core/brain-training.mjs";
import { calcNextGoal, compareRecord, cueText, memoryNextGoal, metWeeks, todayPick, weekCounts, weekStrip } from "./core/brain-habit.mjs";
import {
  CALC_BOOSTERS,
  CALC_COURSE_SESSIONS,
  CALC_MEASURE,
  MEMORY_COURSE_SESSIONS,
  calcBoosterDue,
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
  dueTreasureBox,
  hasPalace,
  loadMemoryStore,
  nextDayState,
  nextLesson,
  nextTreasureDay,
  planPractice,
  practiceOpen,
  saveMemoryStore,
} from "./core/memory-palace.mjs";
import { daysBetween } from "./core/memory-box.mjs";
import { PALACE_MAX } from "./core/palace-builder.mjs";
import { brainZoom } from "./core/brain-zoom.mjs";
import { createMoveSoundPlayer } from "./core/move-sound";
import { comboStep } from "./core/brain-sound.mjs";
import { brainAudio, closeBrainAudio } from "./brain-audio";

type RoomId = "calc" | "memory";
type GameId = "speed" | "nback" | "glance-sym" | "switch" | "glance" | "mental" | "intuition" | "einstellung" | "blind" | "memory-test" | "board-memory";
type QueueItem = { id: GameId; mode: "train" | "measure" | "single"; measure?: "before" | "after" };
type GameResult = { value: number; level: number; correct: number; total: number; recordId?: string; extraLevels?: Record<string, number>; text?: string };
type ResultRow = { label: string; text: string; correct: number; total: number; newBest: boolean; grew: boolean; measure: boolean; recordId: string; value: number; previous: number | null };
type PalaceFinish = { kind: "practice" | "lesson"; lessonId: string; records: { gameId: string; value: number; level: number; text: string }[]; correct: number; total: number };
type MemoryStore = ReturnType<typeof loadMemoryStore>;

const props = defineProps({
  assetBaseUrl: { type: String, default: "." },
});
const emit = defineEmits(["close"]);

const BRAIN_TITLE = "脳トレ道場";
const WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"];
const WEEKDAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"];
/** 種目の絵(今日の稽古の飛び石・自由に練習の札)。 */
const GAME_ICONS: Record<string, string> = { speed: "⚡", nback: "🔁", "glance-sym": "👁️", switch: "🎨", "memory-test": "📝", palace: "🏯", recall: "↩️", digits: "🔢" };
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
const view = ref<"home" | "room" | "game" | "summary" | "evidence" | "builder" | "palace" | "records" | "shelf" | "box">("home");
const cueEditing = ref(false);
const RECORD_TABS = [
  { id: "stamps", label: "判子" },
  { id: "compare", label: "前と後" },
  { id: "lines", label: "記録の線" },
] as const;
const recordsTab = ref<(typeof RECORD_TABS)[number]["id"]>("stamps");
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
/** 成績表の見出し(部屋とコースの何回目。始めたときの名前を残す)。 */
const runTitle = ref("");
/** 成績表で「いつ稽古する？」を出すか(最初の判子の日に1回だけ。14-4の柱3)。 */
const askCue = ref(false);
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
// ===== 今週の判子・週の目安・今日のおすすめ(14-4の柱1〜3) =====
const week = computed(() => weekStrip(record.value, today));
const weekly = computed(() => weekCounts(record.value, today));
const metWeekCount = computed(() => metWeeks(record.value, today));
const todayLabel = (() => {
  const date = new Date(`${today}T12:00:00`);
  return `${date.getMonth() + 1}月${date.getDate()}日（${WEEKDAY_NAMES[date.getDay()]}）`;
})();
const cueLine = computed(() => cueText(record.value.cue));
const headerTitle = computed(() => {
  switch (view.value) {
    case "room": return roomLabel(room.value);
    case "game": return currentItem.value ? gameLabel(currentItem.value.id) : BRAIN_TITLE;
    case "builder": return "宮殿づくり";
    case "palace": return palaceMode.value === "practice" ? "毎日の練習" : "場所法の学校";
    case "records": return `${roomLabel(room.value)}の記録`;
    case "shelf": return "将棋の棚";
    case "box": return "思い出しの箱";
    case "summary": return "今日の成績";
    case "evidence": return "脳トレの根拠";
    default: return BRAIN_TITLE;
  }
});
const backLabel = computed(() => "戻る");
/** 入口のやこび姫の一言。おすすめの理由を1つだけ言う(14-9)。毎日の連続は数えない(14-3のB30)。 */
const homeMessage = computed(() => {
  const choice = pick.value;
  if (!choice) return "今日は2つともできたね。また明日！ 日をあけて続けると、長く身につくよ。";
  if (!record.value.program.calc.before && !record.value.program.memory.before) return "ようこそ、脳トレ道場へ！ はじめに計算力の測定から。5分くらいだよ。";
  if (choice === "calc" && calcBoosterDue(record.value.program.calc, today)) return "おさらいの時期が来たよ。続けて追加の練習をした人ほど、長い期間で良い結果が出ているんだ。";
  if (choice === "memory" && dueBox.value) {
    const since = Math.max(1, daysBetween(dueBox.value.last || dueBox.value.added, today));
    return `思い出しの箱に、${since === 1 ? "きのう" : `${since}日前`}の「${dueBox.value.title}」が届いてるよ。日をあけて思い出すと、長く残るんだ。`;
  }
  if (choice === "memory" && memoryDue.value) return "きのう置いた言葉を思い出す日だよ。日をあけて思い出すと、長く残るんだ。";
  const counts = weekly.value[choice];
  const left = counts.target - counts.done;
  const label = roomLabel(choice);
  return left > 0 ? `今日は${label}がおすすめ。今週の目安まで、あと${left}回だよ。` : `今日は${label}がおすすめ。今週の目安にはもう届いてるよ。`;
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

// ===== 今日の稽古の札(14-4の柱1) =====
type TodayStep = { icon: string; label: string; sub?: string };
/** 思い出しの箱で、今日思い出す組(14-9)。 */
const dueBox = computed(() => dueTreasureBox(memory.value, today));
/** 記憶力で時期の来たもの(講7の次の日に思い出す・思い出しの箱)。 */
const memoryDue = computed(() => {
  const lessons = memory.value.lessons;
  if (dueBox.value) return true;
  return lessons.includes("twenty") && !lessons.includes("nextday") && nextDayState(memory.value, today) === "ready";
});
/** 時期の来た箱を、今日の稽古の最初に入れるか(練習か講の日だけ。1つだけ。14-4の柱7)。 */
const boxFirst = computed(() => Boolean(dueBox.value) && (memoryPlan.value.kind === "practice" || memoryPlan.value.kind === "lesson"));
const pick = computed(() => todayPick({ record: record.value, day: today, memoryDue: memoryDue.value }) as RoomId | null);
const calcCard = computed(() => {
  const plan = calcPlan.value;
  const steps: TodayStep[] = plan.games.map((game) => ({
    icon: GAME_ICONS[game.id] ?? "・",
    label: gameLabel(game.id),
    sub: game.mode === "measure" ? "測定" : `約${Math.max(1, Math.round(GAME_MINUTES[game.id] ?? 1))}分`,
  }));
  return {
    title: plan.kind === "measure" ? "最初の測定" : plan.label,
    chip: plan.kind === "course" ? `コース ${plan.session}/${plan.total}` : plan.kind === "booster" ? "おさらい" : "計算力",
    steps,
    minutes: calcMinutes.value,
    note: calcNote.value,
    actionLabel: plan.kind === "free" && !plan.counted ? "もう一度" : "はじめる",
  };
});
const memoryCard = computed(() => {
  const plan = memoryPlan.value;
  let steps: TodayStep[] = [];
  let minutes = 10;
  if (plan.kind === "test") {
    steps = [{ icon: "📝", label: "記憶テスト", sub: "15個の言葉" }];
    minutes = 3;
  } else if (plan.kind === "build") {
    steps = [{ icon: "🏠", label: "宮殿づくり", sub: "10か所から" }];
    minutes = 5;
  } else if (plan.kind === "lesson") {
    const lesson = PALACE_LESSONS.find(({ id }) => id === plan.lessonId);
    steps = [{ icon: "🏫", label: lesson ? lesson.title : "学校", sub: lesson ? `講${lesson.number}` : "" }];
  } else {
    const practice = planPractice(memory.value, today);
    if (practice?.recall) steps.push({ icon: GAME_ICONS.recall, label: "前の回の言葉", sub: `${practice.recall.words.length}個` });
    if (practice) steps.push({ icon: GAME_ICONS.palace, label: `宮殿に${practice.count}個`, sub: practice.palace.name });
    if (practice?.digits) steps.push({ icon: GAME_ICONS.digits, label: "数字", sub: `${practice.digitCount}けた` });
    minutes = Math.max(5, Math.min(12, Math.round((practice?.recall ? 1.5 : 0) + (practice?.count ?? 5) * 0.4 + (practice?.digits ? 2 : 0))));
  }
  if (boxFirst.value && dueBox.value) {
    steps = [{ icon: "🗃️", label: "思い出しの箱", sub: dueBox.value.title }, ...steps];
    minutes += 2;
  }
  const title = plan.kind === "practice" && plan.session ? `6週間コース ${plan.session}回目` : memoryTodayTitle.value;
  return {
    title,
    chip: plan.kind === "practice" && plan.session ? `コース ${plan.session}/${MEMORY_COURSE_SESSIONS}` : "記憶力",
    steps,
    minutes,
    note: plan.kind === "practice" && !plan.counted ? "今日の分はできた！ もう一度やると自由練習（記録は残るよ）。" : "",
    actionLabel: plan.kind === "practice" && !plan.counted ? "もう一度" : "はじめる",
  };
});
/** 入口の大きな札から、おすすめの部屋の今日の稽古を始める(2回の操作。UD:3-2)。 */
function startRoomToday(id: RoomId) {
  openRoom(id);
  if (id === "calc") startCalcToday();
  else startMemoryToday();
}
function chooseCue(cue: string) {
  record.value = setBrainCue(record.value, cue);
  save();
  cueEditing.value = false;
  askCue.value = false;
}

// ===== 成績表(14-4の柱5) =====
const stampDate = (() => {
  const date = new Date(`${today}T12:00:00`);
  return `${date.getMonth() + 1}.${date.getDate()}`;
})();
/** 成績表の行。前との差は、伸びたら緑で、下がったら前の値を並べるだけ(G:6-2)。自己ベストの金の帯は1つだけ(UD:5-3)。 */
const reportRows = computed<ReportRow[]>(() => {
  let ribbonUsed = false;
  return results.value.map((row) => {
    const compared = compareRecord(row.recordId, row.value, row.previous);
    let delta = "";
    if (compared?.kind === "up") delta = row.recordId.startsWith("speed") ? `前より${compared.diffSeconds.toFixed(1)}秒速い` : `伸びた！ 前は${valueText(row.recordId, row.previous ?? 0)}`;
    else if (compared?.kind === "same") delta = row.recordId.startsWith("speed") ? "前と同じくらい" : "前と同じ";
    else if (compared?.kind === "prev") delta = `前は${valueText(row.recordId, row.previous ?? 0)}`;
    const ribbon = row.newBest && !ribbonUsed;
    if (ribbon) ribbonUsed = true;
    return {
      label: row.label,
      value: row.text,
      delta,
      deltaKind: compared?.kind,
      best: row.newBest,
      ribbon,
      measure: row.measure,
      sub: row.total ? `${row.total}問中${row.correct}問 正解` : "",
    };
  });
});
const reportGoal = computed(() => (room.value === "calc" ? calcNextGoal(record.value, today) : memoryGoal.value));

// ===== 部屋の道(コースの道・6週間・記憶の道) =====
const calcGoal = computed(() => calcNextGoal(record.value, today));
type RoadStone = { key: string; label: string; state: "done" | "now" | "todo"; measure?: boolean; booster?: boolean; aria: string };
const calcRoad = computed(() => {
  const program = record.value.program.calc;
  const stones: RoadStone[] = [];
  const started = Boolean(program.before);
  for (let index = 0; index < CALC_COURSE_SESSIONS; index += 1) {
    const done = index < program.sessions;
    const now = started && index === program.sessions;
    const last = index === CALC_COURSE_SESSIONS - 1;
    stones.push({
      key: `s${index}`,
      label: last ? "測" : "",
      state: done ? "done" : now ? "now" : "todo",
      measure: last,
      aria: `${index + 1}回目${done ? "（済み）" : now ? "（次）" : ""}${last ? "・最初の自分とくらべる" : ""}`,
    });
  }
  const due = calcBoosterDue(program, today);
  CALC_BOOSTERS.forEach((booster, index) => {
    const done = (program.boosters[index] ?? 0) >= booster.sessions;
    stones.push({
      key: `b${index}`,
      label: booster.afterDays >= 90 ? "3月" : "1月",
      state: done ? "done" : due?.index === index ? "now" : "todo",
      booster: true,
      aria: `${booster.label}${done ? "（済み）" : due?.index === index ? "（いま）" : ""}`,
    });
  });
  return stones;
});
const memoryGoal = computed(() => {
  const next = nextLesson(memory.value.lessons);
  const lesson = PALACE_LESSONS.find(({ id }) => id === next);
  return memoryNextGoal(record.value, today, {
    practiceOpen: memoryPracticeOpen.value,
    nextLessonTitle: lesson ? `講${lesson.number}「${lesson.title}」` : "",
    nextBoxDay: dueBox.value ? "" : nextTreasureDay(memory.value, today),
  });
});
/** 6週間コースの30回を、週ごと5つのマスに(週5回の目安が見える。14-6の5)。 */
const memoryWeeks = computed(() => {
  const sessions = record.value.program.memory.sessions;
  const active = memoryPracticeOpen.value && sessions < MEMORY_COURSE_SESSIONS;
  return Array.from({ length: 6 }, (_, week) => Array.from({ length: 5 }, (_, slot) => {
    const n = week * 5 + slot;
    return { n, state: n < sessions ? "on" : active && n === sessions ? "now" : "off" };
  }));
});
type PathNode = { id: "build" | "school" | "practice" | "test"; icon: string; label: string; sub: string; state: "done" | "now" | "open" | "locked" };
/** 記憶の道。押せない灰色の札の代わりに、今どこかを道で見せる(14-11)。 */
const memoryPath = computed<PathNode[]>(() => {
  const program = record.value.program.memory;
  const built = memoryHasPalace.value;
  const open = memoryPracticeOpen.value;
  const lessonsAll = memory.value.lessons.length >= PALACE_LESSONS.length;
  const courseDone = program.sessions >= MEMORY_COURSE_SESSIONS;
  return [
    { id: "build", icon: "🏠", label: "宮殿づくり", sub: built ? `${memory.value.palaces.length || 1}つ` : program.before ? "ここから" : "テストのあと", state: built ? "done" : program.before ? "now" : "open" },
    { id: "school", icon: "🏫", label: "学校", sub: `講${lessonsDone.value}/${PALACE_LESSONS.length}`, state: !built ? "locked" : lessonsAll ? "done" : open ? "open" : "now" },
    { id: "practice", icon: "📅", label: "毎日の練習", sub: open ? `${program.sessions}/${MEMORY_COURSE_SESSIONS}回` : "講3のあと", state: !open ? "locked" : courseDone ? "done" : "now" },
    { id: "test", icon: "📝", label: "記憶テスト", sub: !program.before ? "はじめに" : program.after.length ? "くらべた" : courseDone ? "いま" : "6週間後", state: program.after.length ? "done" : !program.before || courseDone ? "now" : "open" },
  ];
});
function openPathNode(id: PathNode["id"]) {
  if (id === "build") openBuilder(memory.value.palaces.length ? "list" : "new");
  else if (id === "school") openPalace("school");
  else if (id === "practice") openPalace("practice");
  else startMemoryTest();
}
/** わたしの宮殿(役目つき。練習用は毎日の練習に使う宮殿)。 */
const palaceChips = computed(() => {
  const practicePalace = memory.value.lastPalace;
  const treasure = memory.value.boxes.length ? memory.value.treasurePalace : "";
  const role = (id: string) => (id === treasure ? "・宝物" : id === practicePalace ? "・練習" : "");
  const chips = memory.value.palaces.map((palace) => ({
    id: palace.id,
    emoji: palace.place === "school" ? "🏫" : palace.place === "route" ? "🚶" : palace.place === "shop" ? "🏪" : palace.place === "free" ? "✏️" : "🏠",
    name: palace.name,
    sub: `${palace.loci.length}か所${role(palace.id)}`,
  }));
  if (memory.value.sample || treasure === "castle") chips.push({ id: "castle", emoji: "🏯", name: "見本のお城", sub: `30か所${role("castle")}` });
  return chips;
});
/** 部屋の「箱」の札の数字(今日思い出す組の数)。 */
const boxDueCount = computed(() => memory.value.boxes.filter((box) => box.next <= today).length);
function openShelf() {
  view.value = "shelf";
}
function openRecords() {
  recordsTab.value = "stamps";
  view.value = "records";
}

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

/** スピード計算の段ごとの自己ベスト(前の自分の影に使う)。 */
const speedBests = computed(() => Array.from({ length: 5 }, (_, index) => record.value.best[`speed-${index + 1}`] ?? 0));

// 音(docs/brain-training-design.mdの14-8)。道場の音はその場で作る(brain-audio.ts)。将棋の棚で駒を置く音だけは駒音。
const moveSounds = createMoveSoundPlayer(() => props.assetBaseUrl);
const SHOGI_SHELF = new Set(["glance", "mental", "intuition", "einstellung", "blind", "board-memory"]);
/** 種目の中で続けて正解した数(正解の音の高さに使う。種目が変わると0から)。 */
let combo = 0;
// 大きな画面では道場ぜんたいを拡大する(core/brain-zoom.mjs)。親の枠の大きさで決め、窓の大きさが変わったら測り直す。
const rootEl = ref<HTMLElement | null>(null);
let zoomObserver: ResizeObserver | null = null;
function applyZoom() {
  const root = rootEl.value;
  const parent = root?.parentElement;
  if (!root || !parent) return;
  root.style.setProperty("--dojo-zoom", String(brainZoom(parent.clientWidth, parent.clientHeight)));
}
onMounted(() => {
  moveSounds.preload();
  applyZoom();
  const parent = rootEl.value?.parentElement;
  if (parent && typeof ResizeObserver !== "undefined") {
    zoomObserver = new ResizeObserver(applyZoom);
    zoomObserver.observe(parent);
  }
});
onBeforeUnmount(() => {
  zoomObserver?.disconnect();
  closeBrainAudio();
});
function playSound(kind: "correct" | "miss" | "best" | "place" | "finish" | "stamp") {
  if (kind === "correct") {
    combo += 1;
    brainAudio().play("correct", comboStep(combo));
  } else if (kind === "miss") {
    combo = 0;
    brainAudio().play("miss");
  } else if (kind === "place") {
    if (currentItem.value && SHOGI_SHELF.has(currentItem.value.id)) moveSounds.play("normal");
    else brainAudio().play("place");
  } else {
    brainAudio().play(kind);
  }
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
  runTitle.value = `計算力 ${runPlan.kind === "measure" ? "最初の測定" : runPlan.label}`;
  beginRun(runPlan.games.map((game) => ({ id: game.id as GameId, mode: game.mode as "train" | "measure" })), null);
}
function startSingle(gameId: string) {
  const id = gameId as GameId;
  runPlan = null;
  runMemoryMeasure = null;
  room.value = (brainGame(id)?.room ?? room.value) as RoomId;
  runTitle.value = `${gameLabel(id)}（自由練習）`;
  beginRun([{ id, mode: "single" }], id);
}
function startMemoryTest() {
  runPlan = null;
  runMemoryMeasure = record.value.program.memory.before ? (memoryPlan.value.kind === "test" ? "after" : null) : "before";
  runTitle.value = runMemoryMeasure === "before" ? "記憶力 最初の記憶テスト" : runMemoryMeasure === "after" ? "記憶力 コースの後の記憶テスト" : "記憶テスト（自由練習）";
  beginRun([{ id: "memory-test", mode: runMemoryMeasure ? "measure" : "single", measure: runMemoryMeasure ?? "after" }], runMemoryMeasure ? null : "memory-test");
}
function startMemoryToday() {
  const plan = memoryPlan.value;
  roomMessage.value = "";
  const main = () => {
    if (plan.kind === "test") startMemoryTest();
    else if (plan.kind === "build") openBuilder(memory.value.palaces.length && memory.value.palaces.length < PALACE_MAX ? "list" : "new");
    else if (plan.kind === "lesson") openPalace("lesson", plan.lessonId ?? "");
    else openPalace("practice");
  };
  // 時期の来た箱があれば、最初に1つだけ思い出してから続ける(14-4の柱7)。
  if (boxFirst.value && dueBox.value) {
    openBox("review", dueBox.value.id, plan.kind === "lesson" ? "つぎへ（学校）" : "つぎへ（毎日の練習）", main);
    return;
  }
  main();
}
function nextGame() {
  combo = 0;
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
    recordId,
    value: result.value,
    previous: growth?.previous ?? null,
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
  // 「いつ稽古する？」は、判子を押した稽古の成績表で1回だけ聞く(聞いたことを残す)。
  askCue.value = newStamp.value && !record.value.cueAsked;
  if (askCue.value) {
    record.value = { ...record.value, cueAsked: true };
    save();
  }
  if (newStamp.value) playSound("stamp");
  if (bestInRun) setTimeout(() => playSound("best"), newStamp.value ? 260 : 0);
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
  runTitle.value = mode === "practice" ? `記憶力 ${memoryCard.value.title}` : "記憶力 場所法の学校";
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

// ===== 思い出しの箱(14-9) =====
const boxStart = ref<"list" | "catalog" | "review">("list");
const boxReviewId = ref("");
const boxNextLabel = ref("");
let afterBox: (() => void) | null = null;
const boxView = ref<InstanceType<typeof BrainMemoryBox> | null>(null);
function openBox(start: "list" | "catalog" | "review", reviewId = "", nextLabel = "", then: (() => void) | null = null) {
  room.value = "memory";
  boxStart.value = start;
  boxReviewId.value = reviewId;
  boxNextLabel.value = then ? nextLabel : "";
  afterBox = then;
  runKey.value += 1;
  view.value = "box";
}
/** 箱に入れた・思い出したら、記憶力の判子を押す(自由練習の日も数える。14-9)。 */
function stampBox() {
  record.value = stampRoom(record.value, "memory", today);
  save();
}
function boxNext() {
  const then = afterBox;
  afterBox = null;
  if (then) then();
  else view.value = "room";
}
/** 講9の「思い出しの箱に入れる」。講を終えた印は学校の画面が残す。 */
function openBoxFromLesson() {
  stampBox();
  openBox("catalog");
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
    results.value.push({ label: gameLabel(row.gameId), text: row.text, correct: 0, total: 0, newBest, grew: Boolean(growth?.grew), measure: false, recordId: row.gameId, value: row.value, previous: growth?.previous ?? null });
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
  if (view.value === "box" && boxView.value?.goBack()) return;
  if (view.value === "box") {
    afterBox = null;
    view.value = "room";
    return;
  }
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
  if (view.value === "shelf") {
    view.value = "room";
    return;
  }
  queue.value = [];
  currentItem.value = null;
  view.value = "room";
}
defineExpose({ goBack });

</script>

<style>
/* 道場の色(docs/brain-training-design.mdの14-7)。部品の中に色を直接書かず、ここの変数を使う(U:7-1)。 */
.shogi-game .shogi-brain {
  --dojo-desk: #1c2a36;
  --dojo-desk-2: #243746;
  --dojo-desk-3: #2d4456;
  --dojo-light: #fffcf4;
  --dojo-light-2: #b9c6d0;
  --dojo-paper: #fbf7ee;
  --dojo-paper-2: #f3ecdc;
  --dojo-rule: #e6dcc6;
  --dojo-ink: #1f2a33;
  --dojo-ink-2: #56636d;
  --dojo-shu: #c4402a;
  --dojo-shu-deep: #a83420;
  --dojo-shu-soft: #f6dcd3;
  --dojo-ai: #34488f;
  --dojo-ai-deep: #26356c;
  --dojo-ai-soft: #dde3f4;
  --dojo-ai-light: #7f93d6;
  --dojo-good: #2e7d4f;
  --dojo-good-soft: #d9efe1;
  --dojo-gold: #8a5f00;
  --dojo-gold-soft: #f6e7bf;
  --dojo-now: #f1a54c;
  --dojo-radius: 14px;
  --dojo-shadow: 0 2px 0 rgba(0, 0, 0, 0.18), 0 10px 24px rgba(0, 0, 0, 0.18);
  /* 大きな画面では道場ぜんたいを拡大して余白を使う(docs/brain-training-design.mdの15章)。倍率はscreenZoomで決める。
     拡大するとvh・vwも同じ倍率で大きくなるので、画面に対する長さはこの変数で打ち消す。 */
  --dojo-zoom: 1;
  --dojo-vw: calc(1vw / var(--dojo-zoom));
  --dojo-vh: calc(1vh / var(--dojo-zoom));
  --dojo-dvh: calc(1dvh / var(--dojo-zoom));
  zoom: var(--dojo-zoom);
}
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
.shogi-game .brain-seal--mini { width: 0.6rem; height: 0.6rem; }
.shogi-game .shogi-brain__legend .brain-seal { width: 16px; height: 16px; margin-left: 0.3rem; font-size: 0.56rem; }

/* 入口(14-6の1)。スマホは1列、広い画面は左に主役(一言・今日の稽古・いつ)、右に今週と扉。 */
.shogi-game .shogi-brain__home {
  grid-template-columns: minmax(0, 1fr);
  width: min(100%, 40rem);
  margin: 0 auto;
}
.shogi-game .shogi-brain__home-main,
.shogi-game .shogi-brain__home-side { display: grid; gap: 0.75rem; align-content: start; min-width: 0; }
.shogi-game .brain-done {
  display: grid;
  justify-items: center;
  gap: 0.3rem;
  padding: 1rem;
  border-radius: var(--dojo-radius);
  color: var(--dojo-ink);
  background: var(--dojo-paper);
  box-shadow: var(--dojo-shadow);
  text-align: center;
}
.shogi-game .brain-done h2 { margin: 0; font-size: 1.15rem; }
.shogi-game .brain-done p { margin: 0; color: var(--dojo-ink-2); font-size: 0.86rem; font-weight: 700; }
.shogi-game .brain-done__seals { display: flex; gap: 0.5rem; }
.shogi-game .brain-done__seals .brain-seal { width: 30px; height: 30px; font-size: 0.9rem; }
.shogi-game .brain-done .brain-game__secondary { margin-top: 0.3rem; color: var(--dojo-ink); border-color: var(--dojo-rule); background: #fff; }
.shogi-game .brain-cue-line { display: flex; align-items: center; gap: 0.5rem; margin: 0; color: var(--dojo-light-2); font-size: 0.86rem; font-weight: 800; }
.shogi-game .brain-cue-line span:nth-child(2) { color: var(--dojo-light); }
.shogi-game .brain-cue-line__edit {
  margin-left: auto;
  min-height: 40px;
  padding: 0 0.9rem;
  border: 2px solid rgba(255, 252, 244, 0.25);
  border-radius: 999px;
  color: var(--dojo-light);
  background: transparent;
  box-shadow: none;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 800;
}
/* 2つの部屋の扉(主役の下に小さく。UD:3-1)。 */
.shogi-game .brain-doors { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.6rem; }
.shogi-game .brain-door {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  grid-template-rows: auto auto;
  align-items: center;
  column-gap: 0.6rem;
  min-height: 72px;
  padding: 0.6rem 0.75rem;
  border: 2px solid rgba(255, 252, 244, 0.14);
  border-left: 6px solid var(--door, var(--dojo-shu));
  border-radius: var(--dojo-radius);
  color: var(--dojo-light);
  background: var(--dojo-desk-2);
  box-shadow: none;
  font: inherit;
  text-align: left;
}
.shogi-game .brain-door--memory { --door: var(--dojo-ai-light); }
.shogi-game .brain-door__icon { grid-row: 1 / 3; font-size: 1.7rem; line-height: 1; }
.shogi-game .brain-door strong { font-size: 1.02rem; }
.shogi-game .brain-door small { color: var(--dojo-light-2); font-size: 0.76rem; font-weight: 700; }
.shogi-game .brain-door .brain-seal { position: absolute; top: 0.45rem; right: 0.5rem; }
/* 部屋の部品。 */
.shogi-game .brain-section-title {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin: 0.15rem 0 -0.2rem;
  color: var(--dojo-light-2);
  font-size: 0.84rem;
  font-weight: 900;
  letter-spacing: 0.06em;
}
.shogi-game .brain-road { display: grid; gap: 0.35rem; }
.shogi-game .brain-road__head { display: flex; justify-content: space-between; gap: 0.6rem; margin: 0; color: var(--dojo-light-2); font-size: 0.8rem; font-weight: 800; }
.shogi-game .brain-road__head strong { color: var(--dojo-light); white-space: nowrap; }
.shogi-game .brain-road__head span { text-align: right; }
.shogi-game .brain-road__line { display: flex; flex-wrap: wrap; align-items: center; gap: 0.35rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .brain-road__stone {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 252, 244, 0.35);
  border-radius: 50%;
  color: var(--dojo-light);
  font-size: 0.64rem;
  font-weight: 900;
}
.shogi-game .brain-road__stone--done { border-color: var(--dojo-shu); background: var(--dojo-shu); }
.shogi-game .brain-road__stone--now { border-color: var(--dojo-now); box-shadow: 0 0 0 4px rgba(241, 165, 76, 0.25); }
.shogi-game .brain-road__stone--measure { width: 24px; height: 24px; }
.shogi-game .brain-road__stone--booster { width: auto; min-width: 30px; height: 24px; margin-left: 0.5rem; padding: 0 0.3rem; border-radius: 6px; }
.shogi-game .brain-weeks6 { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 0.35rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .brain-weeks6 li { display: grid; justify-items: center; gap: 0.2rem; color: var(--dojo-light-2); font-size: 0.66rem; }
.shogi-game .brain-weeks6__dots { display: grid; grid-template-columns: repeat(5, 8px); gap: 3px; }
.shogi-game .brain-weeks6__dots i { width: 8px; height: 8px; border-radius: 2px; background: rgba(255, 255, 255, 0.16); }
.shogi-game .brain-weeks6__dots .brain-weeks6__dot--on { background: var(--dojo-ai-light); }
.shogi-game .brain-weeks6__dots .brain-weeks6__dot--now { outline: 2px solid var(--dojo-now); outline-offset: 1px; }
.shogi-game .brain-tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.5rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .brain-tile {
  display: grid;
  gap: 0.15rem;
  width: 100%;
  min-height: 60px;
  padding: 0.5rem 0.75rem;
  border: 2px solid rgba(255, 252, 244, 0.12);
  border-radius: 12px;
  color: var(--dojo-light);
  background: var(--dojo-desk-2);
  box-shadow: none;
  font: inherit;
  text-align: left;
}
.shogi-game .brain-tile strong { font-size: 0.92rem; }
.shogi-game .brain-tile span { color: #f3c08f; font-size: 0.78rem; font-weight: 800; font-variant-numeric: tabular-nums; }
.shogi-game .brain-rowlinks { display: grid; grid-template-columns: repeat(auto-fit, minmax(0, 1fr)); gap: 0.5rem; }
.shogi-game .brain-rowlink {
  min-height: 48px;
  padding: 0 0.6rem;
  border: 2px solid rgba(255, 252, 244, 0.25);
  border-radius: 999px;
  color: var(--dojo-light);
  background: transparent;
  box-shadow: none;
  font: inherit;
  font-size: 0.88rem;
  font-weight: 800;
  white-space: nowrap;
}
.shogi-game .brain-rowlink__badge {
  display: inline-grid;
  place-items: center;
  min-width: 1.3rem;
  height: 1.3rem;
  margin-left: 0.3rem;
  padding: 0 0.3rem;
  border-radius: 999px;
  color: #fff;
  background: var(--dojo-ai);
  font-size: 0.74rem;
  font-style: normal;
  font-weight: 900;
}
.shogi-game .brain-path { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin: 0; padding: 0; list-style: none; }
.shogi-game .brain-path li { position: relative; }
.shogi-game .brain-path li + li::before {
  content: "";
  position: absolute;
  top: 25px;
  right: calc(50% + 21px);
  width: calc(100% - 42px);
  height: 3px;
  background: rgba(255, 252, 244, 0.22);
}
.shogi-game .brain-path .brain-path__node--done + li::before { background: var(--dojo-ai-light); }
.shogi-game .brain-path__button {
  display: grid;
  justify-items: center;
  gap: 0.15rem;
  width: 100%;
  min-height: 0;
  padding: 0.3rem 0.1rem;
  border: 0;
  color: var(--dojo-light-2);
  background: transparent;
  box-shadow: none;
  font: inherit;
  font-size: 0.72rem;
  font-weight: 800;
  line-height: 1.2;
  text-align: center;
}
.shogi-game .brain-path__button b {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border: 2px solid rgba(255, 252, 244, 0.3);
  border-radius: 50%;
  background: var(--dojo-desk-2);
  font-size: 1.05rem;
}
.shogi-game .brain-path__button small { font-size: 0.66rem; font-weight: 700; }
.shogi-game .brain-path__node--done .brain-path__button b { border-color: var(--dojo-ai-light); background: #3a4f8f; }
.shogi-game .brain-path__node--now .brain-path__button { color: var(--dojo-light); }
.shogi-game .brain-path__node--now .brain-path__button b { border-color: var(--dojo-now); box-shadow: 0 0 0 4px rgba(241, 165, 76, 0.25); }
.shogi-game .brain-path__button:disabled { opacity: 0.6; background: transparent; cursor: default; }
.shogi-game .brain-palaces { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .brain-palace-chip {
  display: grid;
  gap: 0.05rem;
  min-height: 52px;
  padding: 0.4rem 0.75rem;
  border: 2px solid rgba(255, 252, 244, 0.12);
  border-radius: 12px;
  color: var(--dojo-light);
  background: var(--dojo-desk-2);
  box-shadow: none;
  font: inherit;
  font-size: 0.86rem;
  font-weight: 800;
  text-align: left;
}
.shogi-game .brain-palace-chip small { color: var(--dojo-light-2); font-size: 0.72rem; font-weight: 700; }
.shogi-game .brain-palace-chip--add { place-items: center; min-width: 4.5rem; border-style: dashed; color: var(--dojo-light-2); }
.shogi-game .shogi-brain__shelf { display: grid; gap: 0.8rem; align-content: start; width: min(100%, 40rem); margin: 0 auto; }
/* 記録のタブ(U:7-5の2)。 */
.shogi-game .brain-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.25rem;
  width: min(100%, 40rem);
  margin: 0 auto;
  padding: 0.25rem;
  border-radius: 999px;
  background: var(--dojo-desk-2);
}
.shogi-game .brain-tabs__tab {
  min-height: 44px;
  border: 0;
  border-radius: 999px;
  color: var(--dojo-light-2);
  background: transparent;
  box-shadow: none;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 800;
}
.shogi-game .brain-tabs__tab--on { color: var(--dojo-ink); background: var(--dojo-paper); }
.shogi-game .brain-tabs__tab:focus-visible { outline: 2px solid var(--dojo-now); outline-offset: 2px; }
.shogi-game .shogi-brain__records > .brain-cue { width: min(100%, 40rem); margin: 0 auto; }
.shogi-game .shogi-brain__shelf-lead { margin: 0; color: var(--dojo-light-2); font-size: 0.9rem; font-weight: 700; }
@media (hover: hover) {
  .shogi-game .brain-door:hover,
  .shogi-game .brain-tile:hover,
  .shogi-game .brain-palace-chip:hover,
  .shogi-game .brain-rowlink:hover { border-color: var(--dojo-now); }
}
.shogi-game .brain-door:focus-visible,
.shogi-game .brain-tile:focus-visible,
.shogi-game .brain-rowlink:focus-visible,
.shogi-game .brain-path__button:focus-visible,
.shogi-game .brain-palace-chip:focus-visible { outline: 3px solid var(--dojo-now); outline-offset: 2px; }

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
  .shogi-game .shogi-brain__card:not(:disabled):hover {
    border-color: #f1a54c;
    transform: translateY(-0.1em);
  }
}
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

/* 成績表の画面(14-6の4)。スマホは1列、広い画面は左に紙、右にやこび姫と操作。 */
.shogi-game .shogi-brain__summary { --room: var(--dojo-shu); --room-deep: var(--dojo-shu-deep); width: min(100%, 40rem); margin: 0 auto; }
.shogi-game .shogi-brain__summary--memory { --room: var(--dojo-ai); --room-deep: var(--dojo-ai-deep); }
.shogi-game .shogi-brain__summary-main,
.shogi-game .shogi-brain__summary-side { display: grid; gap: 0.75rem; align-content: start; min-width: 0; }
.shogi-game .shogi-brain__summary-actions { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 0.6rem; width: 100%; }
.shogi-game .brain-cta {
  min-height: 52px;
  padding: 0 1.2rem;
  border: 0;
  border-radius: 999px;
  color: #fff;
  background: var(--room, var(--dojo-shu));
  box-shadow: 0 3px 0 var(--room-deep, var(--dojo-shu-deep)), 0 6px 14px rgba(0, 0, 0, 0.18);
  font: inherit;
  font-size: 1.08rem;
  font-weight: 900;
  letter-spacing: 0.06em;
}
.shogi-game .brain-cta:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--room-deep, var(--dojo-shu-deep)); }
.shogi-game .brain-cta:focus-visible { outline: 3px solid var(--dojo-now); outline-offset: 3px; }
@media (min-width: 900px) {
  .shogi-game .shogi-brain__summary { grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 1.2rem; width: min(100%, 64rem); }
}
@media (orientation: landscape) and (max-height: 600px) {
  .shogi-game .shogi-brain__summary { grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 0.8rem; width: 100%; }
  .shogi-game .shogi-brain__summary-side .shogi-dex__chara { display: none; }
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
  .shogi-game .shogi-brain__room { grid-template-columns: minmax(0, 26rem) minmax(0, 28rem); justify-content: center; gap: 1.2rem; }
  .shogi-game .shogi-brain__room-main,
  .shogi-game .shogi-brain__room-side { margin: 0; }
  .shogi-game .shogi-brain__home { grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 1.2rem; width: min(100%, 64rem); }
}
@media (orientation: landscape) and (max-height: 600px) {
  .shogi-game .shogi-brain__room { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 0.8rem; }
  .shogi-game .shogi-brain__home { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 0.6rem; width: 100%; }
  .shogi-game .shogi-brain__home-main,
  .shogi-game .shogi-brain__home-side,
  .shogi-game .shogi-brain__room-main,
  .shogi-game .shogi-brain__room-side { gap: 0.45rem; }
  .shogi-game .shogi-brain__calendar td { height: 1.3rem; }
  /* 横向きのスマホでは、今日の稽古の札とやこび姫の一言を詰めて1画面に収める(U:7-5の3)。 */
  .shogi-game .brain-today { gap: 0.4rem; padding: 0.6rem 0.8rem 0.7rem; }
  .shogi-game .brain-today__title { font-size: 1.1rem; }
  .shogi-game .brain-today__note { display: none; }
  .shogi-game .brain-door { min-height: 60px; }
  /* 入口: やこび姫の一言は省き(補足の文。U:7-5の3)、左に今日の稽古、右に今週と扉。 */
  .shogi-game .shogi-brain__home-main > .shogi-dex__speech { display: none; }
  .shogi-game .brain-today__stones b { width: 36px; height: 36px; font-size: 1.05rem; }
  .shogi-game .brain-today__stones li + li::before { top: 17px; right: calc(50% + 20px); width: calc(100% - 40px); }
  .shogi-game .brain-today__go { min-height: 46px; }
  .shogi-game .brain-week { gap: 0.25rem; padding: 0.45rem 0.6rem 0.5rem; }
  .shogi-game .brain-week__days li { padding: 0.15rem 0 0.2rem; }
  /* 記録: 判子のタブはカレンダーと「いつ稽古する？」を左右に、記録の線は2列に。 */
  .shogi-game .shogi-brain__records { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 0.5rem 0.8rem; }
  .shogi-game .shogi-brain__records > .brain-tabs,
  .shogi-game .shogi-brain__records > .shogi-brain__compare,
  .shogi-game .shogi-brain__records > .shogi-brain__records-empty,
  .shogi-game .shogi-brain__records > .shogi-brain__records-note { grid-column: 1 / -1; }
  .shogi-game .shogi-brain__records > .shogi-brain__lines { grid-column: 1 / -1; grid-template-columns: repeat(2, minmax(0, 1fr)); width: 100%; }
  .shogi-game .shogi-brain__records > .shogi-brain__calendar,
  .shogi-game .shogi-brain__records > .brain-cue { width: 100%; align-self: start; }
  .shogi-game .shogi-brain__records .shogi-brain__calendar td { height: 1.15rem; }
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

/* 和紙の面(計算力の種目)。問題を大きく1つ、答えは下の数字キー(11-4・14-7)。 */
.shogi-game .brain-calc { gap: 0.8rem; }
.shogi-game .brain-paper {
  display: grid;
  justify-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.7rem 1rem 1rem;
  border-radius: var(--dojo-radius);
  color: var(--dojo-ink);
  background: repeating-linear-gradient(0deg, transparent 0 27px, rgba(160, 130, 80, 0.06) 27px 28px), var(--dojo-paper);
  box-shadow: var(--dojo-shadow);
}
.shogi-game .brain-paper--ghost { padding-top: 1.6rem; }
.shogi-game .brain-paper__bar {
  position: relative;
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: var(--dojo-paper-2);
}
.shogi-game .brain-paper__bar span {
  display: block;
  height: 100%;
  border-radius: 3px;
  background: var(--dojo-shu);
  transform-origin: left;
  transition: transform 200ms;
}
/* 前の自己ベストのペース(▼)。帯の上に小さく(14-4の柱4、D:5-2)。追い越したら緑。 */
.shogi-game .brain-ghost {
  position: absolute;
  bottom: 9px;
  display: grid;
  justify-items: center;
  color: var(--dojo-ink-2);
  font-size: 0.62rem;
  font-style: normal;
  font-weight: 900;
  line-height: 1;
  white-space: nowrap;
  translate: -50% 0;
  transition: left 100ms linear, color 200ms;
  pointer-events: none;
}
.shogi-game .brain-ghost::after { content: ""; margin-top: 2px; border: 5px solid transparent; border-bottom: 0; border-top-color: currentColor; }
.shogi-game .brain-ghost--passed { color: var(--dojo-good); }
/* 続けて正解した数(3問から)。 */
.shogi-game .brain-combo {
  display: inline-flex;
  align-items: baseline;
  gap: 0.25rem;
  padding: 0 0.6rem;
  border-radius: 999px;
  color: var(--dojo-shu-deep);
  background: var(--dojo-shu-soft);
  font-weight: 900;
  white-space: nowrap;
}
.shogi-game .brain-combo b { font-size: 1.05rem; font-variant-numeric: tabular-nums; }
/* 正解の○。答えの横に跳ねて出る(D:3-1)。 */
.shogi-game .brain-ok {
  position: absolute;
  top: 50%;
  right: -2.8rem;
  width: 2.4rem;
  height: 2.4rem;
  margin-top: -1.2rem;
  border: 5px solid var(--dojo-good);
  border-radius: 50%;
  pointer-events: none;
  animation: brain-ok-pop 220ms cubic-bezier(0.2, 1.4, 0.4, 1);
}
@keyframes brain-ok-pop {
  from { transform: scale(0.4); opacity: 0; }
  to { transform: scale(1); opacity: 0.9; }
}
.shogi-game .brain-paper__finish {
  margin: 0.2rem 0 0;
  color: var(--dojo-shu);
  font-size: 1.5rem;
  font-weight: 900;
  letter-spacing: 0.12em;
  animation: brain-countdown-pop 240ms cubic-bezier(0.2, 1.4, 0.4, 1);
}
/* N問前の答えの見本(式の札を並べ、説明は下の1行。スマホでも折り返して崩れない)。 */
.shogi-game .brain-nback__sample { display: grid; grid-template-columns: auto auto auto; justify-content: center; align-items: center; gap: 0.35rem 0.6rem; }
.shogi-game .brain-nback__card { padding: 0.15rem 0.7rem; border: 2px solid var(--dojo-rule); border-radius: 10px; background: #fff; font-size: 1.4rem; font-weight: 900; font-variant-numeric: tabular-nums; }
.shogi-game .brain-nback__card--now { border-color: var(--dojo-shu); }
.shogi-game .brain-nback__sample p { grid-column: 1 / -1; margin: 0; font-size: 0.9rem; font-weight: 800; line-height: 1.5; text-align: center; }
.shogi-game .brain-nback__sample strong { color: var(--dojo-good); font-size: 1.2rem; }
.shogi-game .brain-paper__status {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  width: 100%;
  margin: 0;
  color: var(--dojo-ink-2);
  font-size: 0.8rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.shogi-game .brain-paper__lead { margin: 0; font-size: 1.02rem; font-weight: 800; line-height: 1.6; text-align: center; }
.shogi-game .brain-paper__sample { display: flex; align-items: baseline; gap: 0.6rem; margin: 0; font-size: 1.5rem; font-weight: 900; }
.shogi-game .brain-paper__sample span { padding: 0.05rem 0.5rem; border-radius: 999px; color: var(--dojo-light); background: var(--dojo-ink-2); font-size: 0.75rem; }
.shogi-game .brain-paper__sample strong { color: var(--dojo-good); }
.shogi-game .brain-paper__problem {
  margin: 0.2rem 0 0;
  font-size: clamp(2.6rem, calc(13 * var(--dojo-vw)), 4.4rem);
  font-weight: 900;
  line-height: 1.1;
  letter-spacing: 0.04em;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.shogi-game .brain-paper__problem--done { color: var(--dojo-good); font-size: clamp(2rem, calc(9 * var(--dojo-vw)), 3rem); }
.shogi-game .brain-paper__answer {
  position: relative;
  min-width: 6rem;
  min-height: 3.2rem;
  margin: 0;
  padding: 0.1rem 0.8rem;
  border-bottom: 4px solid var(--dojo-rule);
  font-size: 2.4rem;
  font-weight: 900;
  line-height: 1.25;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.shogi-game .brain-paper__answer--ok { border-color: var(--dojo-good); color: var(--dojo-good); }
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
  .shogi-game .brain-paper__problem { font-size: clamp(2rem, calc(9 * var(--dojo-vh)), 3.4rem); }
  .shogi-game .brain-pad__key { min-height: 52px; }
  .shogi-game .brain-switch__frame--big { min-height: 8rem; }
}

/* 盤。教室・図鑑の盤と同じ木の色。升の強調は緑(合った)と赤(答え)だけで、黄色は使わない(AGENTS.md)。 */
.shogi-game .brain-board {
  position: relative;
  display: grid;
  grid-template-columns: repeat(9, minmax(0, 1fr));
  grid-template-rows: repeat(9, minmax(0, 1fr));
  width: min(100%, 24rem, calc(46 * var(--dojo-vh)));
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
  font-size: clamp(4rem, calc(30 * var(--dojo-vw)), 9rem);
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
  grid-template-columns: min(calc(100% - 1.4rem), 24rem, calc(46 * var(--dojo-vh))) 1.4rem;
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
  .shogi-game .brain-glance .brain-board { grid-area: board; width: min(calc(70 * var(--dojo-vh)), 22rem); }
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
  .shogi-game .brain-memory .brain-board { width: min(calc(66 * var(--dojo-vh)), 20rem); }
  .shogi-game .brain-mental .brain-board-wrap--coords { grid-template-columns: min(calc(62 * var(--dojo-vh)), 19rem) 1.4rem; }
  /* 盤面の記憶は、時間のバーとボタンを別の段にする(同じ段だと、バーがボタンの後ろに重なった)。 */
  .shogi-game .brain-memory { grid-template-areas: "status status" "board prompt" "board timer" "board tools"; }
  .shogi-game .brain-memory > .brain-memory__timer { grid-area: timer; align-self: end; width: 100%; }
  .shogi-game .brain-memory > :is(.brain-memory__tools, .brain-game__actions),
  .shogi-game .brain-mental > :is(.brain-mental__move, .brain-mental__choices, .brain-game__actions) { grid-area: tools; }
}
@media (prefers-reduced-motion: reduce) {
  .shogi-game .brain-memory__timer span { animation: none; }
  .shogi-game .brain-paper__bar span { transition: none; }
  .shogi-game .brain-ok,
  .shogi-game .brain-paper__finish { animation: none; }
  .shogi-game .brain-ghost { transition: none; }
  .shogi-game .brain-paper__answer--miss { animation: none; }
  .shogi-game .brain-cta:active { transform: none; }
  .shogi-game .shogi-brain__card { transition: none; transform: none !important; }
}
</style>
