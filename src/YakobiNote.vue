<template>
  <div class="shogi-dex shogi-note" role="dialog" aria-modal="true" aria-labelledby="shogi-note-title">
    <header class="shogi-dex__header">
      <button type="button" class="shogi-dex__back" @click="emit('close')">
        <span aria-hidden="true">←</span> {{ backLabel }}
      </button>
      <h1 id="shogi-note-title">やこびノート</h1>
      <p class="shogi-note__header-rating" aria-label="いまのレーティング">
        <strong>R{{ state.rating }}</strong><span>{{ gradeName(nearestPreset.label) }}</span>
      </p>
    </header>

    <!--
      ページ全体はスクロールさせず、左（スマホでは上）のメニューで中身を切り替える。
      中身の欄だけが、収まらないときに中でスクロールする。
    -->
    <div class="shogi-note__layout">
      <nav class="shogi-note__nav" role="tablist" aria-label="ノートの項目" aria-orientation="vertical">
        <button
          v-for="item in TABS"
          :key="item.id"
          type="button"
          role="tab"
          class="shogi-note__nav-item"
          :aria-selected="tab === item.id"
          :aria-controls="`shogi-note-pane-${item.id}`"
          @click="selectTab(item.id)"
        >
          <span class="shogi-note__nav-label">{{ item.label }}</span>
          <small class="shogi-note__nav-desc">{{ item.description }}</small>
        </button>
      </nav>

      <main class="shogi-note__pane">
        <!--
          まとめ。いちばん知りたい「いまの棋力」と「次の目標」を大きく出し、次にすること（対局する）を1つだけ主役にする。
        -->
        <section
          v-if="tab === 'summary'"
          id="shogi-note-pane-summary"
          class="shogi-note__cover"
          role="tabpanel"
          aria-labelledby="shogi-note-rank"
          data-note-profile
        >
          <div class="shogi-note__coach">
            <YakobiSays :lines="messages" size="xl" merged name-tag :asset-base-url="assetBaseUrl" />
          </div>

          <div class="shogi-note__rank">
            <p id="shogi-note-rank" class="shogi-note__eyebrow">あなたの棋力</p>
            <p class="shogi-note__rating">
              <strong>R{{ state.rating }}</strong>
              <span
                v-if="ratingDelta"
                class="shogi-note__delta"
                :class="ratingDelta > 0 ? 'shogi-note__delta--up' : 'shogi-note__delta--down'"
                :title="'前の対局からの増減'"
              >{{ ratingDelta > 0 ? `▲ +${ratingDelta}` : `▼ −${Math.abs(ratingDelta)}` }}</span>
            </p>
            <p class="shogi-note__grade">
              {{ gradeName(nearestPreset.label) }}<small>（CPU Lv.{{ nearestPreset.level }}くらい）</small>
            </p>
            <p v-if="playStreak.best" class="shogi-note__streak" data-note-streak>
              続けて遊んだ日 <b>{{ playStreak.current }}日</b><small>（いちばん長い記録 {{ playStreak.best }}日）</small>
            </p>

            <div v-if="nextGoal" class="shogi-note__goal">
              <p class="shogi-note__goal-text">
                <span>次の目標 <b>{{ gradeName(nextGoal.label) }}</b></span>
                <span>あと <b>R{{ nextGoal.remaining }}</b></span>
              </p>
              <div
                class="shogi-note__goal-bar"
                role="progressbar"
                aria-valuemin="0"
                aria-valuemax="100"
                :aria-valuenow="nextGoal.percent"
                :aria-label="`${gradeName(nextGoal.label)}まで${nextGoal.percent}%`"
              ><span :style="{ width: `${nextGoal.percent}%` }"></span></div>
            </div>
            <p v-else class="shogi-note__goal-text">いちばん上の目安に届いたよ！</p>

            <ul class="shogi-note__badges" aria-label="所属と称号">
              <li class="shogi-note__badge" :class="{ 'shogi-note__badge--group': affiliation }">
                <small>所属</small>{{ affiliation ? affiliation.label : "まだ所属なし" }}
              </li>
              <li v-for="title in otherTitles" :key="title.id" class="shogi-note__badge" :title="title.detail" data-note-title>
                {{ title.label }}
              </li>
            </ul>

            <div v-if="recentForm.length" class="shogi-note__form">
              <span class="shogi-note__form-label">最近の対局</span>
              <ol :aria-label="`最近${recentForm.length}局の結果`">
                <li
                  v-for="(outcome, index) in recentForm"
                  :key="index"
                  :class="`shogi-note__form-mark--${outcome}`"
                  :title="FORM_TEXT[outcome]"
                >{{ FORM_MARK[outcome] }}</li>
              </ol>
            </div>

            <div class="shogi-note__actions">
              <button type="button" class="shogi-note__button shogi-note__button--primary" @click="emit('start-match')">
                {{ state.games ? "対局する" : "1局指してノートを始める" }}
              </button>
              <button type="button" class="shogi-note__button" @click="emit('start-measure')">棋力を測る</button>
            </div>
          </div>

          <ul class="shogi-note__highlights" aria-label="記録のハイライト">
            <li>
              <button type="button" class="shogi-note__highlight" @click="selectTab('record')">
                <small>勝率</small>
                <strong>{{ state.games ? percent(state.wins / state.games) : "—" }}</strong>
                <span>{{ state.games ? `${state.games}局 ${state.wins}勝${state.losses}敗` : "まだ対局がありません" }}</span>
              </button>
            </li>
            <li>
              <button type="button" class="shogi-note__highlight" @click="selectTab('style')">
                <small>得意な戦法</small>
                <strong>{{ favoriteStrategy ? favoriteStrategy.name : "—" }}</strong>
                <span>{{ favoriteStrategy ? `勝率${percent(favoriteStrategy.winRate)}・${favoriteStrategy.games}局` : "3局以上で見つかるよ" }}</span>
              </button>
            </li>
            <li>
              <button type="button" class="shogi-note__highlight" @click="selectTab('ryuo')">
                <small>竜王戦</small>
                <strong>{{ career.champion ? "竜王" : `${career.group}組` }}</strong>
                <span>{{ career.seasons ? `${career.seasons}期参加` : "まだ参加していません" }}</span>
              </button>
            </li>
          </ul>
        </section>

        <!-- 成績 -->
        <section v-if="tab === 'record'" id="shogi-note-pane-record" class="shogi-note__panel shogi-note__panel--fill" role="tabpanel" aria-label="成績">
          <div v-if="!state.games" class="shogi-note__card shogi-note__empty">
            <p>まだ記録がないよ。平手でCPUと対局すると、勝ち負けとレーティングの推移がここに書き込まれるよ。</p>
          </div>
          <template v-else>
            <section class="shogi-note__card shogi-note__score" aria-labelledby="shogi-note-score" data-note-record>
              <h2 id="shogi-note-score">勝ち負け</h2>
              <div class="shogi-note__score-body">
                <div
                  class="shogi-note__ring"
                  :style="{ '--win': `${winShare}%`, '--draw': `${winShare + drawShare}%` }"
                  role="img"
                  :aria-label="`勝率${percent(state.wins / state.games)}`"
                >
                  <span><small>勝率</small>{{ percent(state.wins / state.games) }}</span>
                </div>
                <dl class="shogi-note__tiles">
                  <div><dt>対局</dt><dd>{{ state.games }}</dd></div>
                  <div class="shogi-note__tile--win"><dt>勝ち</dt><dd>{{ state.wins }}</dd></div>
                  <div class="shogi-note__tile--loss"><dt>負け</dt><dd>{{ state.losses }}</dd></div>
                  <div><dt>引き分け</dt><dd>{{ state.draws }}</dd></div>
                </dl>
              </div>
              <ul class="shogi-note__rows" aria-label="手番ごとの成績">
                <li v-for="row in colorRows" :key="row.key">
                  <span class="shogi-note__name">{{ row.label }}</span>
                  <span class="shogi-note__bar" aria-hidden="true"><span :style="{ width: row.winPercent }"></span></span>
                  <span class="shogi-note__stat">{{ row.text }}</span>
                </li>
              </ul>
              <p class="shogi-note__hint">平手の通常対局（対CPU）の結果だけを数えています。</p>
            </section>

            <figure class="shogi-note__card shogi-note__trend-card">
              <h2>レーティングの推移</h2>
              <div v-if="trend" class="shogi-note__trend-box">
                <div class="shogi-note__trend-axis" aria-hidden="true"><span>R{{ trend.max }}</span><span>R{{ trend.min }}</span></div>
                <svg
                  class="shogi-note__trend"
                  viewBox="0 0 300 100"
                  preserveAspectRatio="none"
                  role="img"
                  :aria-label="`直近${trend.count}局のレーティングの推移`"
                >
                  <defs>
                    <linearGradient id="shogi-note-trend-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stop-color="#f1a54c" stop-opacity="0.45" />
                      <stop offset="100%" stop-color="#f1a54c" stop-opacity="0" />
                    </linearGradient>
                  </defs>
                  <line v-for="y in [8, 50, 92]" :key="y" x1="0" x2="300" :y1="y" :y2="y" stroke="rgba(255,252,244,0.12)" stroke-width="1" vector-effect="non-scaling-stroke" />
                  <polygon :points="`0,100 ${trend.points} 300,100`" fill="url(#shogi-note-trend-fill)" />
                  <polyline :points="trend.points" fill="none" stroke="#f1a54c" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
                </svg>
                <figcaption class="shogi-note__trend-note">直近{{ trend.count }}局（R{{ trend.min }}〜R{{ trend.max }}）</figcaption>
              </div>
              <p v-else class="shogi-note__hint">2局以上指すと、ここに推移の線が出るよ。</p>
            </figure>
          </template>
        </section>

        <!-- 戦法: 自分の戦法・囲い・戦型を勝率で比べ、得意とにがてに札を付ける。相手の戦法・囲いはその下に小さく。 -->
        <section v-if="tab === 'style'" id="shogi-note-pane-style" class="shogi-note__panel shogi-note__panel--style" role="tabpanel" aria-label="戦法">
          <div v-if="!state.games" class="shogi-note__card shogi-note__empty">
            <p>対局すると、使った戦法と囲いの勝率がここに並ぶよ。得意な戦法を見つけよう！</p>
          </div>
          <template v-else>
            <section
              v-for="group in ownUsageGroups"
              :key="group.category"
              class="shogi-note__card"
              :aria-label="group.title"
            >
              <h2>{{ group.title }}</h2>
              <p v-if="!group.rows.length" class="shogi-note__hint">まだ記録がありません。</p>
              <ul v-else class="shogi-note__rows shogi-note__rows--style">
                <li v-for="row in group.rows" :key="row.name">
                  <span class="shogi-note__name">
                    {{ row.name }}
                    <em v-if="row.tag === 'best'" class="shogi-note__tag shogi-note__tag--best">★得意</em>
                    <em v-else-if="row.tag === 'weak'" class="shogi-note__tag shogi-note__tag--weak">にがて</em>
                  </span>
                  <span class="shogi-note__bar" :title="`勝率 ${percent(row.winRate)}`" aria-hidden="true">
                    <span :style="{ width: percent(row.winRate) }"></span>
                  </span>
                  <span class="shogi-note__stat">勝率{{ percent(row.winRate) }}・{{ row.wins }}勝{{ row.losses }}敗{{ row.draws ? `${row.draws}分` : "" }}</span>
                </li>
              </ul>
            </section>
            <div class="shogi-note__pair">
              <section
                v-for="group in opponentUsageGroups"
                :key="group.category"
                class="shogi-note__card shogi-note__card--minor"
                :aria-label="group.title"
              >
                <h2>{{ group.title }}</h2>
                <p v-if="!group.rows.length" class="shogi-note__hint">まだ記録がありません。</p>
                <ul v-else class="shogi-note__rows">
                  <li v-for="row in group.rows" :key="row.name">
                    <span class="shogi-note__name">{{ row.name }}</span>
                    <span class="shogi-note__stat">{{ row.games }}局・{{ row.wins }}勝{{ row.losses }}敗{{ row.draws ? `${row.draws}分` : "" }}</span>
                  </li>
                </ul>
              </section>
            </div>
          </template>
        </section>

        <!-- 竜王戦 -->
        <section v-if="tab === 'ryuo'" id="shogi-note-pane-ryuo" class="shogi-note__panel" role="tabpanel" aria-label="竜王戦">
          <section class="shogi-note__card" aria-labelledby="shogi-note-ryuo" data-note-ryuo>
            <h2 id="shogi-note-ryuo">竜王戦</h2>
            <RyuoLadder :group="career.group" :champion="career.champion" />
            <dl class="shogi-note__tiles shogi-note__tiles--four">
              <div><dt>現在</dt><dd>{{ career.champion ? "竜王" : `${career.group}組` }}</dd></div>
              <div><dt>参加</dt><dd>{{ career.seasons }}<small>期</small></dd></div>
              <div><dt>挑戦者</dt><dd>{{ career.challenges }}<small>回</small></dd></div>
              <div><dt>竜王</dt><dd>{{ career.titles }}<small>期</small></dd></div>
            </dl>
            <p v-if="career.titles" class="shogi-note__hint">
              連続{{ career.streak }}期・最長{{ career.bestStreak }}期{{ career.eternal ? "・永世竜王" : "" }}
            </p>
            <template v-if="career.history.length">
              <h3 class="shogi-note__subhead">これまでの成績</h3>
              <ol class="shogi-note__history" data-note-ryuo-history>
                <li v-for="entry in recentHistory" :key="entry.no" :class="`shogi-note__history--${historyKind(entry)}`">
                  <span class="shogi-note__history-no">第{{ entry.no }}期</span>
                  <span class="shogi-note__history-group">{{ entry.mode === "defense" ? "防衛戦" : `${entry.startGroup}組` }}</span>
                  <span class="shogi-note__history-text">
                    {{ outcomeText(entry.outcome) }}{{ entry.promoted ? `・${entry.newGroup}組へ昇級` : "" }}{{ entry.relegated ? `・${entry.newGroup}組へ降級` : "" }}
                  </span>
                  <span class="shogi-note__history-record">{{ entry.wins }}勝{{ entry.losses }}敗</span>
                </li>
              </ol>
            </template>
            <p v-else class="shogi-note__hint">まだ参加していません。タイトル画面の「大会」から、竜王戦に参加できます。</p>
          </section>
          <RyuoRosterBook :roster="roster" :initial-group="career.champion ? 1 : career.group" />
        </section>

        <!--
          コレクション。対局で組んだ戦法・囲いと、初めて勝ったLvを印として並べる。まだのものも名前は見せる。
          印の数で使えるようになる着せ替えは、ここで選ぶ。
        -->
        <section v-if="tab === 'collection'" id="shogi-note-pane-collection" class="shogi-note__panel" role="tabpanel" aria-label="コレクション">
          <section class="shogi-note__card" aria-labelledby="shogi-note-collection-count" data-note-collection>
            <h2 id="shogi-note-collection-count">集めた印</h2>
            <dl class="shogi-note__tiles shogi-note__tiles--four">
              <div><dt>印</dt><dd>{{ collectionTotal }}<small>/ {{ collectionMax }}</small></dd></div>
              <div><dt>戦法・囲い</dt><dd>{{ collectedFormationCount }}<small>/ {{ COLLECTION_CATALOG.length }}</small></dd></div>
              <div><dt>勝ったLv</dt><dd>{{ collectedLevelCount }}<small>/ {{ COLLECTION_LEVELS.length }}</small></dd></div>
              <div><dt>神の一手</dt><dd>{{ collection.godMoves }}<small>回</small></dd></div>
            </dl>
            <p v-if="collection.predictionsHit" class="shogi-note__hint" data-note-predictions>竜王戦の組優勝の予想を、{{ collection.predictionsHit }}回当てたよ！</p>
            <p class="shogi-note__hint">
              対局で定跡図鑑の戦法・囲いを組むと、印が1つ増えるよ。CPUの各Lvに初めて勝っても1つ（レーティングの対象の対局だけ）。
              <template v-if="nextUnlock">次の着せ替えまで、印あと{{ nextUnlock.remaining }}個！</template>
              <template v-else>着せ替えは全部使えるようになったよ！</template>
            </p>
          </section>

          <section class="shogi-note__card" aria-labelledby="shogi-note-themes">
            <h2 id="shogi-note-themes">着せ替え</h2>
            <div v-for="group in themeGroups" :key="group.kind" class="shogi-note__themes" role="radiogroup" :aria-label="group.label">
              <p class="shogi-note__subhead">{{ group.label }}</p>
              <ul>
                <li v-for="theme in group.themes" :key="theme.id">
                  <button
                    type="button"
                    role="radio"
                    class="shogi-note__theme"
                    :class="{ 'shogi-note__theme--locked': !theme.unlocked }"
                    :aria-checked="theme.selected"
                    :disabled="!theme.unlocked"
                    :data-theme="`${group.kind}:${theme.id}`"
                    @click="chooseTheme(group.kind, theme.id)"
                  >
                    <img :src="theme.preview" alt="" aria-hidden="true">
                    <span>{{ theme.name }}</span>
                    <small v-if="!theme.unlocked">印あと{{ theme.remaining }}個</small>
                    <small v-else-if="theme.selected">使用中</small>
                  </button>
                </li>
              </ul>
            </div>
          </section>

          <section v-for="group in formationGroups" :key="group.kind" class="shogi-note__card" :aria-label="group.label">
            <h2>{{ group.label }}<small class="shogi-note__count">{{ group.collected }} / {{ group.items.length }}</small></h2>
            <ul class="shogi-note__stamps">
              <li
                v-for="item in group.items"
                :key="item.label"
                class="shogi-note__stamp"
                :class="{ 'shogi-note__stamp--got': item.count }"
              >
                <span>{{ item.label }}</span>
                <small v-if="item.count">×{{ item.count }}</small>
              </li>
            </ul>
          </section>

          <section class="shogi-note__card" aria-labelledby="shogi-note-levels">
            <h2 id="shogi-note-levels">Lvの壁<small class="shogi-note__count">{{ collectedLevelCount }} / {{ COLLECTION_LEVELS.length }}</small></h2>
            <ol class="shogi-note__levels" aria-label="初めて勝ったLv">
              <li
                v-for="level in COLLECTION_LEVELS"
                :key="level"
                :class="{ 'shogi-note__level--got': collection.levels[level] }"
                :title="collection.levels[level] ? `Lv.${level}に勝った` : `Lv.${level}にはまだ勝っていない`"
              >{{ level }}</li>
            </ol>
          </section>
        </section>

        <!-- 棋力の調整に使う項目。 -->
        <section v-if="tab === 'settings'" id="shogi-note-pane-settings" class="shogi-note__panel" role="tabpanel" aria-label="設定">
          <section class="shogi-note__card shogi-note__card--minor">
            <h2>棋力を測る</h2>
            <p class="shogi-note__hint">
              CPUと1局指すと、終局後に指し手を解析して、レーティングと級・段の目安を診断します。
              結果は解析画面から、あなたのレーティングに設定できます。
            </p>
            <p v-if="state.measured" class="shogi-note__hint" data-note-measured>
              棋力測定で R{{ state.measured.rating }}（{{ state.measured.label }}）を設定しました（{{ measuredDate }}）。
            </p>
            <button type="button" class="shogi-note__button shogi-note__button--ghost" @click="emit('start-measure')">棋力を測る</button>
          </section>

          <section class="shogi-note__card shogi-note__card--minor">
            <h2>段級位を申告する</h2>
            <p class="shogi-note__hint">
              日本将棋連盟の段級位で申告すると、レーティングをその棋力に設定します。
              以降の対局は申告ごとにCPUのレベル別の成績を記録し、表示名と実際の棋力のずれを調べるのに使います。
            </p>
            <p v-if="state.declared" class="shogi-note__hint" data-note-declared>
              申告中: {{ state.declared.label }}（{{ declaredDate }}に設定）
            </p>
            <div class="shogi-note__declare">
              <select v-model="declareLabel" aria-label="申告する段級位">
                <option value="">段級位を選ぶ</option>
                <option v-for="grade in grades" :key="grade.label" :value="grade.label">{{ grade.label }}</option>
              </select>
              <button type="button" class="shogi-note__button" :disabled="!declareLabel" @click="declare">申告して設定</button>
            </div>
          </section>

          <section v-if="levelRows.length" class="shogi-note__card shogi-note__card--minor" aria-labelledby="shogi-note-levels">
            <h2 id="shogi-note-levels">CPUのレベルごとの成績</h2>
            <ul class="shogi-note__rows">
              <li v-for="row in levelRows" :key="row.level">
                <span class="shogi-note__name">Lv.{{ row.level }} {{ row.label }}</span>
                <span class="shogi-note__stat">R{{ row.rating }}・{{ row.wins }}勝{{ row.losses }}敗{{ row.draws }}分</span>
              </li>
            </ul>
          </section>

          <section v-if="declaredRows.length || state.games" class="shogi-note__card shogi-note__card--minor" aria-labelledby="shogi-note-declared">
            <h2 id="shogi-note-declared">申告した棋力での成績</h2>
            <ul v-if="declaredRows.length" class="shogi-note__rows">
              <li v-for="row in declaredRows" :key="row.level">
                <span class="shogi-note__name">Lv.{{ row.level }} {{ row.label }}</span>
                <span class="shogi-note__stat">{{ row.wins }}勝{{ row.losses }}敗{{ row.draws }}分</span>
              </li>
            </ul>
            <p v-else class="shogi-note__hint">段級位を申告すると、ここにCPUのレベル別の成績が出ます。</p>
            <button v-if="state.games" type="button" class="shogi-note__button shogi-note__button--ghost" @click="copyRecord">{{ copied ? "コピーしました" : "戦績データをコピー" }}</button>
          </section>
        </section>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, type PropType } from "vue";
import RyuoLadder from "./RyuoLadder.vue";
import RyuoRosterBook from "./RyuoRosterBook.vue";
import YakobiSays from "./YakobiSays.vue";
import {
  declarableGrades,
  gradeName as gradeNameOf,
  levelRating,
  nextRatingGoal,
  recommendedLevel,
  usageRows,
} from "./core/player-rating.mjs";
import { CPU_STRENGTH_PRESETS } from "./core/strength-settings.mjs";
import { currentAffiliation } from "./core/player-profile.mjs";
import { currentStreak, loadPlayStreak, streakLine } from "./core/play-streak.mjs";
import {
  COLLECTION_LEVELS,
  collectionCatalog,
  collectionCount,
  loadCollection,
  nextThemeUnlock,
  themeUnlock,
} from "./core/collection.mjs";
import { OPENING_CASTLES, OPENING_STRATEGIES } from "./core/opening-guide.mjs";
import {
  BOARD_THEMES,
  BOARD_THEME_KEY,
  DEFAULT_BOARD_THEME,
  DEFAULT_PIECE_THEME,
  PIECE_THEMES,
  PIECE_THEME_KEY,
  saveTheme,
} from "./core/themes.mjs";
import { outcomeText } from "./core/ryuo-career.mjs";

type Tally = { wins: number; losses: number; draws: number };
type GameOutcome = "win" | "loss" | "draw";
type RatingState = {
  rating: number;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  levels: { [level: string]: Tally };
  colors: { [color: string]: Tally };
  usage: { [category: string]: { [name: string]: Tally } };
  measured: { rating: number; label: string; at: number } | null;
  declared: { label: string; level: number; at: number } | null;
  declaredLevels: { [label: string]: { [level: string]: Tally } };
  history: { rating: number; outcome?: string }[];
};

type ProfileState = {
  titles: { id: string; label: string; detail: string; rank: number; at: number }[];
};
type HistoryEntry = {
  no: number; mode: string; startGroup: number; newGroup: number; outcome: string; wins: number; losses: number; promoted: boolean; relegated: boolean;
};
type RyuoCareer = {
  group: number; seasons: number; champion: boolean; titles: number; streak: number; bestStreak: number;
  challenges: number; eternal: boolean;
  history: HistoryEntry[];
};
type UsageRow = { name: string; wins: number; losses: number; draws: number; games: number; rate: number };

const props = defineProps({
  assetBaseUrl: { type: String, default: "." },
  backLabel: { type: String, default: "タイトルへ戻る" },
  state: { type: Object as PropType<RatingState>, required: true },
  profile: { type: Object as PropType<ProfileState>, default: () => ({ titles: [] }) },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  roster: { type: Object as PropType<any>, default: null },
  career: {
    type: Object as PropType<RyuoCareer>,
    default: () => ({ group: 6, seasons: 0, champion: false, titles: 0, streak: 0, bestStreak: 0, challenges: 0, eternal: false, history: [] }),
  },
});
const emit = defineEmits(["close", "start-match", "start-measure", "declare"]);

/** ノートの項目。最後に開いた項目を、この端末で覚えておく。 */
const TABS = [
  { id: "summary", label: "まとめ", description: "いまの棋力と次の目標" },
  { id: "record", label: "成績", description: "勝ち負けと推移" },
  { id: "style", label: "戦法", description: "得意な戦法と囲い" },
  { id: "ryuo", label: "竜王戦", description: "組と棋士名鑑" },
  { id: "collection", label: "コレクション", description: "集めた印と着せ替え" },
  { id: "settings", label: "設定", description: "棋力の測定と申告" },
] as const;
type TabId = typeof TABS[number]["id"];
const TAB_STORAGE_KEY = "yacobihime:shogi-match:note-tab";
function loadTab(): TabId {
  try {
    const saved = localStorage.getItem(TAB_STORAGE_KEY);
    return TABS.some(({ id }) => id === saved) ? saved as TabId : "summary";
  } catch {
    return "summary";
  }
}
const tab = ref<TabId>(loadTab());
function selectTab(id: TabId) {
  tab.value = id;
  try {
    localStorage.setItem(TAB_STORAGE_KEY, id);
  } catch {
    // 保存できなくても、タブは切り替わる。
  }
}

/*
 * コレクション(core/collection.mjs)。開いたときに端末の保存から読む。
 * 着せ替えは、ここで選ぶと保存し、開いている盤にも知らせる(core/themes.mjsのsaveTheme)。
 */
const COLLECTION_CATALOG = collectionCatalog({ strategies: OPENING_STRATEGIES, castles: OPENING_CASTLES });
const collection = ref(loadCollection(safeStorage()));
const collectedFormationCount = computed(() => COLLECTION_CATALOG.filter(({ label }) => collection.value.formations[label]).length);
const collectedLevelCount = computed(() => COLLECTION_LEVELS.filter((level) => collection.value.levels[level]).length);
const collectionTotal = computed(() => collectionCount(collection.value));
const collectionMax = COLLECTION_CATALOG.length + COLLECTION_LEVELS.length;
const nextUnlock = computed(() => nextThemeUnlock(collection.value));
const formationGroups = computed(() => (["strategy", "castle"] as const).map((kind) => {
  const items = COLLECTION_CATALOG
    .filter((entry) => entry.kind === kind)
    .map(({ label }) => ({ label, count: collection.value.formations[label]?.count ?? 0 }));
  return { kind, label: kind === "strategy" ? "戦法" : "囲い", items, collected: items.filter(({ count }) => count).length };
}));
function safeStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
const selectedThemes = ref({
  board: safeStorage()?.getItem(BOARD_THEME_KEY) || DEFAULT_BOARD_THEME,
  piece: safeStorage()?.getItem(PIECE_THEME_KEY) || DEFAULT_PIECE_THEME,
});
const assetBase = computed(() => props.assetBaseUrl.replace(/\/$/, ""));
const themeGroups = computed(() => ([
  { kind: "board" as const, label: "盤", themes: BOARD_THEMES.map((theme) => ({ ...theme, preview: `${assetBase.value}/board/${theme.file}` })) },
  { kind: "piece" as const, label: "駒", themes: PIECE_THEMES.map((theme) => ({ ...theme, preview: `${assetBase.value}/piece/${theme.id}/black_king2.webp` })) },
]).map((group) => ({
  ...group,
  themes: group.themes.map((theme) => {
    const unlock = themeUnlock(collection.value, group.kind, theme.id);
    return { ...theme, unlocked: unlock.unlocked, remaining: unlock.remaining, selected: selectedThemes.value[group.kind] === theme.id };
  }),
})));
function chooseTheme(kind: "board" | "piece", id: string) {
  if (!themeUnlock(collection.value, kind, id).unlocked) return;
  selectedThemes.value = { ...selectedThemes.value, [kind]: id };
  saveTheme(kind, id);
}

/**
 * 続けて遊んだ日(core/play-streak.mjs)。1局指す・1問解く・レッスンを終えると数える。
 * 週に1日はおやすみしても続く。途切れても、いちばん長い記録は残る。
 */
const playStreak = (() => {
  const saved = loadPlayStreak(safeStorage());
  return { current: currentStreak(saved).current, best: saved.best };
})();
const playStreakLine = streakLine(currentStreak(loadPlayStreak(safeStorage())));

const measuredDate = computed(() => {
  const at = props.state.measured?.at;
  return at ? new Date(at).toLocaleDateString("ja-JP") : "";
});
const affiliation = computed(() => currentAffiliation(props.profile));
/** 所属に使った称号のほかの称号を、高いものから並べる。 */
const otherTitles = computed(() => [...props.profile.titles]
  .filter((title) => title.id !== affiliation.value?.id)
  .sort((a, b) => b.rank - a.rank || a.at - b.at));
const recentHistory = computed(() => [...props.career.history].reverse().slice(0, 8));
/** 成績の行の色分け: 竜王・昇級・降級・そのほか。 */
function historyKind(entry: HistoryEntry) {
  if (entry.outcome === "champion") return "crown";
  if (entry.promoted) return "up";
  if (entry.relegated || entry.outcome === "defense-lost") return "down";
  return "stay";
}
const grades = declarableGrades();
const declareLabel = ref("");
function declare() {
  const grade = grades.find(({ label }) => label === declareLabel.value);
  if (grade) emit("declare", grade);
}
const declaredDate = computed(() => {
  const at = props.state.declared?.at;
  return at ? new Date(at).toLocaleDateString("ja-JP") : "";
});
/** 申告中の段級位に対する、CPUのレベル別の成績(対局したレベルだけ)。 */
const declaredRows = computed(() => {
  const label = props.state.declared?.label;
  const tally = label ? props.state.declaredLevels?.[label] : undefined;
  if (!tally) return [];
  return CPU_STRENGTH_PRESETS
    .filter((preset) => tally[preset.level] && tally[preset.level].wins + tally[preset.level].losses + tally[preset.level].draws > 0)
    .map((preset) => ({ ...preset, ...tally[preset.level] }));
});
const copied = ref(false);
/** 戦績を、表示名の調整に使えるよう、JSONでクリップボードへコピーする。 */
async function copyRecord() {
  const { declared, declaredLevels, levels, colors, games, wins, losses, draws, rating } = props.state;
  const text = JSON.stringify({ rating, games, wins, losses, draws, declared, declaredLevels, levels, colors });
  try {
    await navigator.clipboard.writeText(text);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2500);
  } catch {
    window.prompt("戦績データをコピーしてください", text);
  }
}
const percent = (ratio: number) => `${Math.round(ratio * 100)}%`;
/** 「十四級程度」を、表紙では「十四級」と短く出す。 */
const gradeName = (label: string) => gradeNameOf(label);

const nearestPreset = computed(() => {
  const level = recommendedLevel(props.state.rating);
  return CPU_STRENGTH_PRESETS.find((preset) => preset.level === level)!;
});

/** 次の目標と、そこまでの残り。計算は結果画面と共通(core/player-rating.mjs)。 */
const nextGoal = computed(() => nextRatingGoal(props.state.rating));

/** 対局の結果だけを、古い順に並べたもの(申告・測定の記録は除く)。 */
const gameHistory = computed(() => props.state.history.filter(
  (entry): entry is { rating: number; outcome: GameOutcome } =>
    entry.outcome === "win" || entry.outcome === "loss" || entry.outcome === "draw",
));
/** 前の対局からのレーティングの増減。直前の記録が対局の結果のときだけ出す。 */
const ratingDelta = computed(() => {
  const history = props.state.history;
  const last = history[history.length - 1];
  const before = history[history.length - 2];
  if (!last || !before || !gameHistory.value.includes(last as { rating: number; outcome: GameOutcome })) return 0;
  return Math.round(last.rating - before.rating);
});
const FORM_MARK: Record<GameOutcome, string> = { win: "勝", loss: "負", draw: "分" };
const FORM_TEXT: Record<GameOutcome, string> = { win: "勝ち", loss: "負け", draw: "引き分け" };
/** 最近10局の勝ち負け(古い順)。 */
const recentForm = computed(() => gameHistory.value.slice(-10).map((entry) => entry.outcome));

/** 勝率の輪の、勝ち・引き分けの割合(%)。 */
const winShare = computed(() => (props.state.games ? (props.state.wins / props.state.games) * 100 : 0));
const drawShare = computed(() => (props.state.games ? (props.state.draws / props.state.games) * 100 : 0));

/** やこび姫のひとこと。全体の様子と、得意な戦法(3局以上で、いちばん勝率の高いもの)と、次の目標。 */
const messages = computed(() => {
  const { games, wins, rating } = props.state;
  if (!games) return ["ここは、あなたの対局の記録をまとめるノートだよ。", "1局指すと、レーティングや得意な戦法が書き込まれていくよ！"];
  if (games < 5) return [`まだ${games}局だけど、もう書き込みが始まったよ。`, "たくさん指して、ノートを育てよう！"];
  const lines = [`${games}局で${wins}勝！ 今のレーティングはR${rating}だよ。`];
  const best = usageRows(props.state, "rook")
    .filter((row: UsageRow) => row.games >= 3)
    .sort((a: UsageRow, b: UsageRow) => b.wins / b.games - a.wins / a.games)[0];
  if (best) lines.push(`いちばん勝てているのは「${best.name}」。勝率${percent(best.wins / best.games)}だよ！`);
  if (nextGoal.value) lines.push(`${gradeName(nextGoal.value.label)}まで、あとR${nextGoal.value.remaining}。いっしょにがんばろう！`);
  if (playStreakLine) lines.push(playStreakLine);
  return lines;
});

const trend = computed(() => {
  const ratings = props.state.history.map((entry) => entry.rating);
  if (ratings.length < 2) return null;
  const min = Math.min(...ratings);
  const max = Math.max(...ratings);
  const span = Math.max(1, max - min);
  const points = ratings.map((value, index) => {
    const x = (index / (ratings.length - 1)) * 300;
    const y = 92 - ((value - min) / span) * 84;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return { points, min, max, count: ratings.length };
});

function tallyText({ wins, losses, draws }: Tally) {
  return `${wins}勝${losses}敗${draws}分`;
}
const colorRows = computed(() => (["black", "white"] as const).map((key) => {
  const tally = props.state.colors?.[key] ?? { wins: 0, losses: 0, draws: 0 };
  const games = tally.wins + tally.losses + tally.draws;
  return {
    key,
    label: key === "black" ? "先手" : "後手",
    winPercent: percent(games ? tally.wins / games : 0),
    text: `${games ? `勝率${percent(tally.wins / games)}・` : ""}${tallyText(tally)}`,
  };
}));

const USAGE_LIMIT = 8;
/** 「得意」「にがて」の札を付けるのに要る対局数。 */
const TAG_MIN_GAMES = 3;
function usageGroup(category: string, title: string) {
  const rows = (usageRows(props.state, category) as UsageRow[]).slice(0, USAGE_LIMIT)
    .map((row) => ({ ...row, winRate: row.games ? row.wins / row.games : 0, tag: "" as "" | "best" | "weak" }));
  const tagged = rows.filter((row) => row.games >= TAG_MIN_GAMES);
  const best = tagged.reduce<typeof rows[number] | null>((top, row) => (!top || row.winRate > top.winRate ? row : top), null);
  if (best && best.winRate >= 0.5) best.tag = "best";
  for (const row of tagged) if (row !== best && row.winRate < 0.5) row.tag = "weak";
  return { category, title, rows };
}
/** まとめに出す得意な戦法。戦法の中で「★得意」の札が付いたもの。 */
const favoriteStrategy = computed(() => usageGroup("rook", "").rows.find((row) => row.tag === "best") ?? null);
const ownUsageGroups = computed(() => [
  usageGroup("rook", "あなたの戦法"),
  usageGroup("castle", "あなたの囲い"),
  usageGroup("battle", "戦型"),
]);
const opponentUsageGroups = computed(() => [
  usageGroup("opponentRook", "相手の戦法"),
  usageGroup("opponentCastle", "相手の囲い"),
]);

const levelRows = computed(() => CPU_STRENGTH_PRESETS
  .filter((preset) => {
    const tally = props.state.levels?.[preset.level];
    return tally && tally.wins + tally.losses + tally.draws > 0;
  })
  .map((preset) => ({ ...preset, ...props.state.levels[preset.level], rating: levelRating(preset.level) })));
</script>

<style>
/* やこびノート。夜空の紺に、やこび姫のドット絵の色(クリーム・橙・ラベンダー)を合わせる。
 * 表紙をいちばん大きく、タブの中のカードは控えめにして、見る順番をはっきりさせる。 */
.shogi-game .shogi-dex.shogi-note {
  --note-gold: #f1a54c;
  --note-gold-shadow: #b57c39;
  --note-lavender: #d8d0ff;
  --note-panel: #2c4359;
  --note-deep: #172632;
  --note-shadow: #121e29;
  --note-line: rgba(255, 252, 244, 0.16);
  --note-muted: rgba(255, 252, 244, 0.7);
  --note-control: 2.9rem;
  background: #1e2d3d;
  font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Yu Gothic", "Meiryo", sans-serif;
}
.shogi-game .shogi-note__header-rating {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  margin: 0 0 0 auto;
  font-weight: 800;
}
.shogi-game .shogi-note__header-rating strong { color: var(--note-gold); font-size: 1.35rem; }
.shogi-game .shogi-note__header-rating span { color: var(--note-muted); }

/* ===== 画面の骨組み =====
 * ページ全体はスクロールさせない。スマホは上にメニュー、広い画面は左にメニューを置き、
 * 中身の欄（.shogi-note__pane）だけが、収まらないときに中でスクロールする。 */
.shogi-game .shogi-note__layout {
  flex: 1;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 0.7rem;
  width: min(100%, 82rem);
  min-height: 0;
  margin: 0 auto;
  margin-bottom: 0.5rem;
  box-sizing: border-box;
  padding: 0.7rem clamp(0.6rem, 2vw, 1.5rem) 0.8rem;
  font-size: var(--dex-text);
}
/* 項目が横に並ぶ画面では、収まらない分を次の行へ折り返す(「コレクション」が切れないように)。 */
.shogi-game .shogi-note__nav {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(5.6rem, 1fr));
  gap: 0.35rem;
}
.shogi-game .shogi-note__nav-item {
  display: grid;
  align-content: center;
  justify-items: center;
  min-width: 0;
  min-height: 2.9rem;
  padding: 0.3rem 0.2rem;
  border: 2px solid rgba(255, 252, 244, 0.35);
  border-radius: 0.7rem;
  color: #fffcf4;
  background: rgba(255, 252, 244, 0.06);
  box-shadow: 0 3px 0 var(--note-shadow);
  font: inherit;
  cursor: pointer;
}
.shogi-game .shogi-note__nav .shogi-note__nav-item[aria-selected="true"] {
  border-color: var(--note-gold);
  color: var(--note-deep);
  background: var(--note-gold);
  box-shadow: 0 3px 0 var(--note-gold-shadow);
}
.shogi-game .shogi-note__nav-item:active { box-shadow: none; transform: translateY(3px); }
.shogi-game .shogi-note__nav-label { font-weight: 800; white-space: nowrap; }
.shogi-game .shogi-note__nav-desc { display: none; }
.shogi-game .shogi-note__pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.shogi-game .shogi-note__pane > * { flex: none; }
.shogi-game .shogi-note__pane > .shogi-note__cover,
.shogi-game .shogi-note__pane > .shogi-note__panel--fill {
  flex: 1 0 auto;
  box-sizing: border-box;
}
.shogi-game .shogi-note__pane > .shogi-note__cover { align-content: space-evenly; }
.shogi-game .shogi-note__panel.shogi-note__panel--fill { align-items: stretch; }
.shogi-game .shogi-note__panel--fill > .shogi-note__card { align-content: start; }
.shogi-game .shogi-note__panel--fill .shogi-note__trend-card { grid-template-rows: auto minmax(0, 1fr); }
.shogi-game .shogi-note__panel--fill .shogi-note__trend-box { height: 100%; box-sizing: border-box; }
/* スマホでは見出しの帯が2行にならないよう、レーティングは「まとめ」にだけ出す。 */
@media (max-width: 599px) {
  .shogi-game .shogi-note__header-rating { display: none; }
}
@media (min-width: 900px) {
  .shogi-game .shogi-note__layout {
    font-size: clamp(15px, min(1.25vw, 2.2vh), 26px);
    width: min(100%, 74em);
    grid-template-columns: 13.5em minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
    gap: 1.2rem;
    padding-top: 1rem;
  }
  .shogi-game .shogi-note__nav { grid-template-columns: minmax(0, 1fr); align-content: start; gap: 0.5rem; }
  .shogi-game .shogi-note__nav-item {
    justify-items: start;
    gap: 0.15rem;
    min-height: 3.8rem;
    padding: 0.6rem 1rem;
    text-align: left;
  }
  .shogi-game .shogi-note__nav-label { font-size: 1.1em; }
  .shogi-game .shogi-note__nav-desc { display: block; color: var(--note-muted); font-size: 0.75em; }
  .shogi-game .shogi-note__nav .shogi-note__nav-item[aria-selected="true"] .shogi-note__nav-desc { color: rgba(23, 38, 50, 0.75); }
}

/* ===== 表紙 ===== */
.shogi-game .shogi-note__cover {
  display: grid;
  gap: 1rem;
  grid-template-columns: minmax(0, 1fr);
  padding: clamp(0.9rem, 2.5vw, 1.4rem);
  border: 2px solid var(--note-gold);
  border-radius: 1rem;
  background:
    radial-gradient(circle at 92% 12%, rgba(241, 165, 76, 0.16) 0 3px, transparent 4px),
    radial-gradient(circle at 70% 85%, rgba(215, 209, 253, 0.16) 0 2px, transparent 3px),
    #263d52;
  box-shadow: 0 5px 0 var(--note-gold-shadow);
}
@media (min-width: 1000px) {
  .shogi-game .shogi-note__cover { grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); align-items: center; }
  .shogi-game .shogi-note__highlights { grid-column: 1 / -1; }
}
.shogi-game .shogi-note__highlights {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.6rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.shogi-game .shogi-note__highlight {
  display: grid;
  gap: 0.15em;
  justify-items: start;
  width: 100%;
  height: 100%;
  min-width: 0;
  padding: 0.7em 0.9em;
  border: 2px solid rgba(255, 252, 244, 0.25);
  border-radius: 0.7rem;
  color: #fffcf4;
  background: var(--note-deep);
  box-shadow: 0 3px 0 var(--note-shadow);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.shogi-game .shogi-note__highlight:active { box-shadow: none; transform: translateY(3px); }
@media (hover: hover) {
  .shogi-game .shogi-note__highlight:hover { border-color: var(--note-gold); }
}
.shogi-game .shogi-note__highlight small { color: var(--note-gold); font-size: 0.78em; font-weight: 800; }
.shogi-game .shogi-note__highlight strong {
  max-width: 100%;
  overflow: hidden;
  font-size: 1.35em;
  font-weight: 900;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.shogi-game .shogi-note__highlight span { color: var(--note-muted); font-size: 0.75em; }
@media (max-width: 599px) {
  .shogi-game .shogi-note__highlights { gap: 0.4rem; }
  .shogi-game .shogi-note__highlight { padding: 0.55em 0.6em; }
  .shogi-game .shogi-note__highlight strong { font-size: 1.05em; }
  .shogi-game .shogi-note__highlight span { font-size: 0.68em; }
}
.shogi-game .shogi-note__coach { min-width: 0; }
.shogi-game .shogi-note__rank { display: grid; gap: 0.6rem; min-width: 0; }
.shogi-game .shogi-note__eyebrow {
  margin: 0;
  color: var(--note-gold);
  font-size: 0.85em;
  font-weight: 800;
  letter-spacing: 0.12em;
}
.shogi-game .shogi-note__rating {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.3rem 0.8rem;
  margin: 0;
}
.shogi-game .shogi-note__rating strong {
  font-size: clamp(2.8rem, 2rem + 3vw, 4.2rem);
  font-weight: 900;
  line-height: 1;
  letter-spacing: 0.02em;
  text-shadow: 0 3px 0 var(--note-shadow);
}
.shogi-game .shogi-note__delta {
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  font-size: 0.95em;
  font-weight: 800;
}
.shogi-game .shogi-note__delta--up { color: var(--note-deep); background: var(--note-gold); }
.shogi-game .shogi-note__delta--down { color: var(--note-deep); background: var(--note-lavender); }
.shogi-game .shogi-note__grade {
  margin: 0;
  font-size: 1.5em;
  font-weight: 800;
}
.shogi-game .shogi-note__grade small {
  margin-left: 0.4rem;
  color: var(--note-muted);
  font-size: 0.55em;
  font-weight: 600;
}
.shogi-game .shogi-note__goal { display: grid; gap: 0.35rem; }
.shogi-game .shogi-note__goal-text {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.2rem 1rem;
  margin: 0;
  color: var(--note-muted);
  font-size: 0.9em;
}
.shogi-game .shogi-note__goal-text b { color: #fffcf4; font-size: 1.1em; }
.shogi-game .shogi-note__goal-bar {
  height: 0.9rem;
  overflow: hidden;
  border: 2px solid var(--note-deep);
  border-radius: 999px;
  background: var(--note-deep);
}
.shogi-game .shogi-note__goal-bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: repeating-linear-gradient(135deg, var(--note-gold) 0 10px, #f6bb6e 10px 20px);
  animation: shogi-note-goal-fill 700ms cubic-bezier(0.2, 0.9, 0.3, 1) both;
  transform-origin: left center;
}
@keyframes shogi-note-goal-fill {
  from { transform: scaleX(0); }
}
@media (prefers-reduced-motion: reduce) {
  .shogi-game .shogi-note__goal-bar span { animation: none; }
}
.shogi-game .shogi-note__badges { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .shogi-note__badge {
  padding: 0.25rem 0.75rem;
  border: 2px solid var(--note-gold);
  border-radius: 999px;
  color: var(--note-gold);
  font-size: 0.85em;
  font-weight: 800;
}
.shogi-game .shogi-note__badge small { margin-right: 0.4rem; color: var(--note-muted); font-weight: 700; }
.shogi-game .shogi-note__badge--group { color: var(--note-deep); background: var(--note-gold); }
.shogi-game .shogi-note__badge--group small { color: rgba(23, 38, 50, 0.75); }
.shogi-game .shogi-note__form { display: flex; flex-wrap: wrap; align-items: center; gap: 0.3rem 0.7rem; }
.shogi-game .shogi-note__form-label { color: var(--note-muted); font-size: 0.85em; font-weight: 700; }
.shogi-game .shogi-note__form ol { display: flex; gap: 0.25rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .shogi-note__form li {
  display: grid;
  place-items: center;
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 50%;
  font-size: 0.8em;
  font-weight: 900;
  line-height: 1;
}
.shogi-game .shogi-note__form-mark--win { color: var(--note-deep); background: var(--note-gold); }
.shogi-game .shogi-note__form-mark--loss { color: var(--note-deep); background: var(--note-lavender); }
.shogi-game .shogi-note__form-mark--draw { color: #fffcf4; background: #445c6d; }
.shogi-game .shogi-note__actions { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 0.6rem; margin-top: 0.2rem; }

/* ===== ボタン ===== */
.shogi-game .shogi-note__button,
.shogi-game .shogi-note__declare select {
  box-sizing: border-box;
  height: var(--note-control);
  border-radius: 0.6rem;
  font: inherit;
}
.shogi-game .shogi-note__button {
  width: 100%;
  padding: 0 1rem;
  border: 2px solid rgba(255, 252, 244, 0.55);
  color: #fffcf4;
  background: rgba(255, 252, 244, 0.06);
  box-shadow: 0 3px 0 var(--note-shadow);
  font-weight: 800;
  white-space: nowrap;
  cursor: pointer;
}
.shogi-game .shogi-note__button--primary {
  border-color: var(--note-gold);
  color: var(--note-deep);
  background: var(--note-gold);
  box-shadow: 0 4px 0 var(--note-gold-shadow);
  font-size: 1.05em;
}
.shogi-game .shogi-note__button:not(:disabled):active { box-shadow: none; transform: translateY(3px); }
.shogi-game .shogi-note__button--ghost { justify-self: start; width: auto; border-width: 1px; font-weight: 700; }
.shogi-game .shogi-note__button:disabled { opacity: 0.45; cursor: default; }

/* ===== タブ ===== */

/* ===== カード ===== */
.shogi-game .shogi-note__panel {
  display: grid;
  gap: 1rem;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  animation: shogi-note-panel-in 160ms ease-out both;
}
@media (min-width: 760px) {
  .shogi-game .shogi-note__panel { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .shogi-game .shogi-note__panel > .shogi-note__empty,
  .shogi-game .shogi-note__panel > .shogi-note__pair { grid-column: 1 / -1; }
}
@keyframes shogi-note-panel-in {
  from { opacity: 0; transform: translateY(6px); }
}
@media (prefers-reduced-motion: reduce) {
  .shogi-game .shogi-note__panel { animation: none; }
}
.shogi-game .shogi-note__card {
  display: grid;
  align-content: start;
  gap: 0.75rem;
  min-width: 0;
  margin: 0;
  padding: 1rem 1.1rem;
  border: 2px solid #3b5570;
  border-radius: 0.8rem;
  background: var(--note-panel);
}
.shogi-game .shogi-note__card--minor { border-color: rgba(59, 85, 112, 0.7); background: rgba(44, 67, 89, 0.6); }
.shogi-game .shogi-note__card h2 {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin: 0;
  color: var(--note-gold);
  font-size: 0.95em;
  letter-spacing: 0.08em;
}
.shogi-game .shogi-note__card h2::before {
  content: "";
  width: 0.5rem;
  height: 0.5rem;
  background: var(--note-gold);
}
.shogi-game .shogi-note__empty p { margin: 0; line-height: 1.7; }
.shogi-game .shogi-note__pair { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr)); }
.shogi-game .shogi-note__subhead { margin: 0.3rem 0 0; color: rgba(255, 252, 244, 0.8); font-size: 0.9em; }
.shogi-game .shogi-note__hint { margin: 0; color: var(--note-muted); font-size: 0.8em; line-height: 1.6; }

/* 続けて遊んだ日。棋力の下に小さく出す(数字で急かさない)。 */
.shogi-game .shogi-note__streak { margin: 0.2rem 0 0; color: var(--note-muted); font-size: 0.85em; }
.shogi-game .shogi-note__streak b { color: var(--note-gold); }
.shogi-game .shogi-note__streak small { margin-left: 0.3rem; }

/* コレクション */
.shogi-game .shogi-note__count { margin-left: auto; color: var(--note-muted); font-size: 0.85em; letter-spacing: 0; }
.shogi-game .shogi-note__stamps { display: flex; flex-wrap: wrap; gap: 0.35rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .shogi-note__stamp {
  display: inline-flex;
  align-items: baseline;
  gap: 0.25rem;
  padding: 0.25rem 0.55rem;
  border: 1px dashed var(--note-line);
  border-radius: 999px;
  color: var(--note-muted);
  font-size: 0.82em;
}
.shogi-game .shogi-note__stamp--got {
  border: 1px solid var(--note-gold);
  color: var(--note-deep);
  background: var(--note-gold);
  font-weight: 800;
}
.shogi-game .shogi-note__stamp small { font-size: 0.85em; }
.shogi-game .shogi-note__levels {
  display: grid;
  grid-template-columns: repeat(10, minmax(0, 1fr));
  gap: 0.3rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.shogi-game .shogi-note__levels li {
  display: grid;
  place-items: center;
  min-height: 1.9rem;
  border: 1px dashed var(--note-line);
  border-radius: 0.35rem;
  color: var(--note-muted);
  font-size: 0.78em;
  font-weight: 700;
}
.shogi-game .shogi-note__levels .shogi-note__level--got {
  border: 1px solid var(--note-gold);
  color: var(--note-deep);
  background: var(--note-gold);
}
.shogi-game .shogi-note__themes ul {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(6.5rem, 1fr));
  gap: 0.45rem;
  margin: 0.35rem 0 0;
  padding: 0;
  list-style: none;
}
.shogi-game .shogi-note__theme {
  display: grid;
  justify-items: center;
  gap: 0.2rem;
  width: 100%;
  min-height: 0;
  padding: 0.45rem 0.3rem;
  border: 2px solid transparent;
  border-radius: 0.5rem;
  color: inherit;
  background: var(--note-deep);
  font-size: 0.8em;
}
.shogi-game .shogi-note__theme img {
  width: 3rem;
  height: 3rem;
  object-fit: cover;
  border-radius: 0.25rem;
}
.shogi-game .shogi-note__theme[aria-checked="true"] { border-color: var(--note-gold); }
.shogi-game .shogi-note__theme small { color: var(--note-muted); font-size: 0.85em; }
.shogi-game .shogi-note__theme--locked img { filter: grayscale(1) brightness(0.55); }
.shogi-game .shogi-note__theme:disabled { opacity: 1; cursor: default; }

/* 勝ち負け: 勝率の輪と、数のタイル */
.shogi-game .shogi-note__score-body { display: flex; flex-wrap: wrap; align-items: center; gap: 1rem; }
.shogi-game .shogi-note__ring {
  display: grid;
  flex: none;
  place-items: center;
  width: 7.5rem;
  height: 7.5rem;
  border-radius: 50%;
  background: conic-gradient(var(--note-gold) 0 var(--win), #8a93a0 var(--win) var(--draw), var(--note-lavender) var(--draw) 100%);
}
.shogi-game .shogi-note__ring span {
  display: grid;
  place-items: center;
  width: 72%;
  height: 72%;
  border-radius: 50%;
  background: var(--note-panel);
  font-size: 1.5em;
  font-weight: 900;
  line-height: 1.1;
}
.shogi-game .shogi-note__ring small { color: var(--note-muted); font-size: 0.45em; font-weight: 700; }
.shogi-game .shogi-note__tiles { display: grid; flex: 1 1 12rem; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.5rem; margin: 0; }
.shogi-game .shogi-note__tiles--four { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.shogi-game .shogi-note__tiles > div {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
  padding: 0.5rem 0.7rem;
  border-radius: 0.5rem;
  background: var(--note-deep);
}
.shogi-game .shogi-note__tiles dt { color: var(--note-muted); font-size: 0.75em; font-weight: 700; white-space: nowrap; }
.shogi-game .shogi-note__tiles dd { margin: 0; font-size: 1.35em; font-weight: 900; line-height: 1.2; }
.shogi-game .shogi-note__tiles dd small { margin-left: 0.1rem; font-size: 0.6em; }
.shogi-game .shogi-note__tile--win { box-shadow: inset 4px 0 0 var(--note-gold); }
.shogi-game .shogi-note__tile--loss { box-shadow: inset 4px 0 0 var(--note-lavender); }

/* レーティングの推移 */
.shogi-game .shogi-note__trend-box {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  grid-template-rows: minmax(8rem, 1fr) auto;
  gap: 0.3rem 0.5rem;
  padding: 0.7rem 0.8rem;
  border-radius: 0.5rem;
  background: var(--note-deep);
}
.shogi-game .shogi-note__trend-axis {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  color: rgba(255, 252, 244, 0.6);
  font-size: 0.72em;
  text-align: right;
}
.shogi-game .shogi-note__trend { display: block; width: 100%; height: 100%; min-height: 8rem; }
.shogi-game .shogi-note__trend-note { grid-column: 2; color: var(--note-muted); font-size: 0.78em; }

/* 竜王戦の成績 */
.shogi-game .shogi-note__history { display: grid; gap: 0.35rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .shogi-note__history li {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.6rem;
  padding: 0.45rem 0.7rem;
  border-left: 4px solid rgba(255, 252, 244, 0.35);
  border-radius: 0.4rem;
  background: var(--note-deep);
  font-size: 0.9em;
}
.shogi-game .shogi-note__history li.shogi-note__history--crown { border-left-color: var(--note-gold); background: rgba(241, 165, 76, 0.14); }
.shogi-game .shogi-note__history li.shogi-note__history--up { border-left-color: var(--note-gold); }
.shogi-game .shogi-note__history li.shogi-note__history--down { border-left-color: var(--note-lavender); }
.shogi-game .shogi-note__history-no { font-weight: 800; }
.shogi-game .shogi-note__history-group { color: var(--note-gold); font-weight: 700; }
.shogi-game .shogi-note__history-text { overflow-wrap: anywhere; }
.shogi-game .shogi-note__history-record { white-space: nowrap; }

/* 使用率・成績の行 */
.shogi-game .shogi-note__rows { display: grid; gap: 0.6rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .shogi-note__rows li {
  display: grid;
  grid-template-columns: minmax(6rem, 1fr) minmax(3rem, 1fr) auto;
  align-items: center;
  gap: 0.25rem 0.7rem;
}
.shogi-game .shogi-note__rows li:not(:has(.shogi-note__bar)) { grid-template-columns: 1fr auto; }
.shogi-game .shogi-note__rows--style li { grid-template-columns: minmax(0, 1fr) auto; }
.shogi-game .shogi-note__rows--style .shogi-note__bar { grid-column: 1 / -1; grid-row: 2; }
.shogi-game .shogi-note__name { font-weight: 700; overflow-wrap: anywhere; }
.shogi-game .shogi-note__stat { font-size: 0.85em; text-align: right; white-space: nowrap; }
.shogi-game .shogi-note__bar { height: 0.6rem; overflow: hidden; border-radius: 999px; background: var(--note-deep); }
.shogi-game .shogi-note__bar span { display: block; height: 100%; border-radius: inherit; background: var(--note-gold); }
.shogi-game .shogi-note__tag {
  margin-left: 0.4rem;
  padding: 0.05rem 0.5rem;
  border-radius: 999px;
  font-size: 0.72em;
  font-style: normal;
  font-weight: 800;
  vertical-align: 0.1em;
}
.shogi-game .shogi-note__tag--best { color: var(--note-deep); background: var(--note-gold); }
.shogi-game .shogi-note__tag--weak { color: var(--note-deep); background: var(--note-lavender); }

/* 設定 */
.shogi-game .shogi-note__declare { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 0.5rem; }
.shogi-game .shogi-note__declare select {
  width: 100%;
  padding: 0 0.6rem;
  border: 2px solid rgba(255, 252, 244, 0.4);
  color: #fffcf4;
  background: var(--note-deep);
}
@media (max-width: 520px) {
  .shogi-game .shogi-note__rows li,
  .shogi-game .shogi-note__rows li:not(:has(.shogi-note__bar)) { grid-template-columns: 1fr auto; }
  .shogi-game .shogi-note__bar { grid-column: 1 / -1; grid-row: 2; }
  .shogi-game .shogi-note__tiles--four { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .shogi-game .shogi-note__declare { grid-template-columns: minmax(0, 1fr); }
  .shogi-game .shogi-note__history li { grid-template-columns: auto auto minmax(0, 1fr); }
  .shogi-game .shogi-note__history-record { grid-column: 3; justify-self: end; }
  .shogi-game .shogi-note__actions { grid-template-columns: minmax(0, 1fr); }
  .shogi-game .shogi-note__ring { width: 6.2rem; height: 6.2rem; }
}
</style>
