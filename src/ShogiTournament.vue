<template>
  <div :class="screen === 'select' ? 'shogi-home shogi-tournament-home' : 'shogi-dex shogi-tournament'" role="dialog" aria-modal="true" aria-labelledby="shogi-tournament-title">
    <!-- 大会の選択: タイトル画面と同じデザイン・ボタンの配置 -->
    <template v-if="screen === 'select'">
      <span v-for="star in HOME_STARS" :key="star.id" class="shogi-home__star" :style="star.style" aria-hidden="true"></span>
      <span class="shogi-home__moon" aria-hidden="true"></span>
      <button type="button" class="shogi-dex__back shogi-tournament__home-back" @click="emit('close')">
        <span aria-hidden="true">←</span> {{ backLabel }}
      </button>
      <div class="shogi-home__hero" data-screen="select">
        <div class="shogi-home__title">
          <h1 id="shogi-tournament-title">大会</h1>
        </div>
        <p class="shogi-home__bubble" aria-hidden="true">どの大会に参加する？</p>
        <img class="shogi-home__chara" :src="charaUrl" alt="" aria-hidden="true">
      </div>
      <nav class="shogi-home__menu" aria-label="大会">
        <section class="shogi-home__group" aria-labelledby="shogi-tournament-titles">
          <h2 id="shogi-tournament-titles" class="shogi-home__group-title">タイトル戦</h2>
          <p class="shogi-home__group-note">予選から勝ち上がって、タイトルを目指そう</p>
          <div class="shogi-home__cards">
            <button type="button" class="shogi-home__card" data-tournament="ryuo" @click="chooseRyuo">
              <svg class="shogi-home__icon" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
                <g fill="#f1a54c">
                  <rect x="4" y="2" width="8" height="1" />
                  <rect x="4" y="3" width="8" height="4" />
                  <rect x="2" y="3" width="2" height="1" />
                  <rect x="12" y="3" width="2" height="1" />
                  <rect x="5" y="7" width="6" height="1" />
                  <rect x="7" y="8" width="2" height="3" />
                  <rect x="5" y="11" width="6" height="2" />
                </g>
              </svg>
              <span class="shogi-home__label">竜王戦</span>
              <small class="shogi-home__desc">{{ ryuoCardNote }}</small>
            </button>
            <button v-for="item in COMING_SOON" :key="item.id" type="button" class="shogi-home__card" disabled>
              <svg class="shogi-home__icon" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
                <g fill="#fffcf4">
                  <rect x="3" y="3" width="10" height="1" />
                  <rect x="3" y="7" width="10" height="1" />
                  <rect x="3" y="11" width="10" height="1" />
                  <rect x="3" y="3" width="1" height="9" />
                  <rect x="12" y="3" width="1" height="9" />
                </g>
              </svg>
              <span class="shogi-home__label">{{ item.label }}</span>
              <small class="shogi-home__desc">準備中</small>
            </button>
          </div>
        </section>
        <section class="shogi-home__group" aria-labelledby="shogi-tournament-road">
          <h2 id="shogi-tournament-road" class="shogi-home__group-title">プロへの道</h2>
          <p class="shogi-home__group-note">研修会から奨励会、プロ棋士へ</p>
          <div class="shogi-home__cards">
            <button v-for="item in ROAD" :key="item.id" type="button" class="shogi-home__card" disabled>
              <svg class="shogi-home__icon" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
                <g fill="#f1a54c">
                  <rect x="2" y="11" width="4" height="3" />
                  <rect x="6" y="8" width="4" height="6" />
                  <rect x="10" y="4" width="4" height="10" />
                </g>
              </svg>
              <span class="shogi-home__label">{{ item.label }}</span>
              <small class="shogi-home__desc">準備中</small>
            </button>
          </div>
        </section>
      </nav>
    </template>

    <template v-else>
      <header class="shogi-dex__header">
        <button type="button" class="shogi-dex__back" @click="goBack">
          <span aria-hidden="true">←</span> {{ backText }}
        </button>
        <h1 id="shogi-tournament-title">竜王戦</h1>
      </header>

      <div class="shogi-tournament__body">
        <!-- どの画面も、上に大会の帯(印・期・いまの段階・勝ち上がりの道のり)を置く -->
        <section class="shogi-tournament__banner" aria-label="竜王戦の道のり">
          <span class="shogi-tournament__seal" aria-hidden="true">竜</span>
          <div class="shogi-tournament__banner-title">
            <h2>{{ bannerTitle }}</h2>
            <p data-phase>{{ bannerSub }}</p>
          </div>
          <ol class="shogi-tournament__route" :style="{ '--route-steps': route.length }">
            <li
              v-for="step in route"
              :key="step.key"
              :class="['shogi-tournament__step', `shogi-tournament__step--${step.state}`]"
              :aria-current="step.state === 'current' ? 'step' : undefined"
            >
              <span class="shogi-tournament__step-dot" aria-hidden="true"></span>
              <span>{{ step.label }}</span>
            </li>
          </ol>
        </section>

        <!-- 竜王戦: やこび姫の説明(左)と、エントリー(右) -->
        <div v-if="screen === 'ryuo'" class="shogi-tournament__layout shogi-tournament__layout--entry" data-screen="ryuo">
          <aside class="shogi-tournament__coach" aria-label="やこび姫の竜王戦ガイド" data-guide>
            <YakobiSays :lines="talkLines" size="xl" merged name-tag :asset-base-url="assetBaseUrl" />
            <div v-if="talkTopic === 'guide'" class="shogi-tournament__pager">
              <button type="button" :disabled="guidePage === 0" @click="guidePage -= 1">前へ</button>
              <span aria-live="polite">{{ guidePage + 1 }} / {{ guideLines.length }}</span>
              <button type="button" :disabled="guidePage >= guideLines.length - 1" @click="guidePage += 1">次へ</button>
            </div>
            <div v-else class="shogi-tournament__pager shogi-tournament__pager--single">
              <button type="button" @click="talkTopic = 'guide'">竜王戦の説明を聞く</button>
            </div>
            <ol class="shogi-tournament__chapters" aria-label="説明の目次">
              <li v-for="(title, index) in GUIDE_TITLES" :key="title">
                <button
                  type="button"
                  :aria-current="talkTopic === 'guide' && guidePage === index ? 'step' : undefined"
                  @click="talkTopic = 'guide'; guidePage = index"
                >{{ title }}</button>
              </li>
            </ol>
          </aside>

          <div class="shogi-tournament__col">
            <section class="shogi-tournament__card" aria-labelledby="shogi-ryuo-status">
              <h2 id="shogi-ryuo-status">あなたの竜王戦</h2>
              <RyuoLadder :group="career.group" :champion="career.champion" />
              <dl class="shogi-tournament__tiles shogi-tournament__tiles--three" data-ryuo-status>
                <div><dt>現在</dt><dd>{{ career.champion ? "竜王" : `${career.group}組` }}</dd></div>
                <div><dt>参加</dt><dd>{{ career.seasons }}<small>期</small></dd></div>
                <div>
                  <dt>竜王</dt>
                  <dd>{{ career.titles }}<small>期</small></dd>
                  <span v-if="career.eternal" class="shogi-tournament__tile-note">永世竜王</span>
                  <span v-else-if="career.streak" class="shogi-tournament__tile-note">連続{{ career.streak }}期</span>
                </div>
              </dl>
            </section>

            <section v-if="inProgress && !reEntry" class="shogi-tournament__card" aria-labelledby="shogi-ryuo-progress">
              <h2 id="shogi-ryuo-progress">進行中の大会</h2>
              <YakobiSays :lines="[`${view?.title}（${view?.phaseText}）の途中だよ。続きから、いっしょに行こう！`]" size="md" :asset-base-url="assetBaseUrl" />
              <div class="shogi-tournament__actions shogi-tournament__actions--two">
                <button type="button" class="shogi-tournament__sub" @click="reEntry = true">破棄して、新しくエントリー</button>
                <button type="button" class="shogi-tournament__start" data-tournament-continue @click="screen = 'season'">続きから参加する</button>
              </div>
            </section>

            <section v-else class="shogi-tournament__card" aria-labelledby="shogi-ryuo-entry" data-entry-form>
              <h2 id="shogi-ryuo-entry">エントリー設定</h2>

              <div class="shogi-tournament__row">
                <span id="entry-difficulty" class="shogi-tournament__row-label">難易度</span>
                <div class="shogi-tournament__choices shogi-tournament__choices--ten" role="radiogroup" aria-labelledby="entry-difficulty">
                  <button
                    v-for="level in DIFFICULTY_STEPS"
                    :key="level"
                    type="button"
                    role="radio"
                    :aria-checked="level === difficulty"
                    :class="{ 'shogi-tournament__recommended': level === defaultDifficulty }"
                    @click="difficulty = level; talkTopic = 'difficulty'"
                  >{{ level }}</button>
                </div>
                <p class="shogi-tournament__row-meta" data-difficulty-note>
                  相手の平均 <strong>Lv.{{ Math.round(meanLevel) }}</strong>・おすすめは点線の <strong>{{ defaultDifficulty }}</strong>（{{ ratingText }}）
                </p>
              </div>

              <div class="shogi-tournament__row">
                <span id="entry-scale" class="shogi-tournament__row-label">規模</span>
                <div class="shogi-tournament__choices shogi-tournament__choices--five" role="radiogroup" aria-labelledby="entry-scale">
                  <button
                    v-for="item in SCALES"
                    :key="item.id"
                    type="button"
                    role="radio"
                    :aria-checked="item.id === scale"
                    @click="scale = item.id; talkTopic = 'scale'"
                  >{{ item.label }}</button>
                </div>
                <p class="shogi-tournament__row-meta" data-scale-note>{{ scaleMeta }}</p>
              </div>

              <div class="shogi-tournament__row">
                <span id="entry-revival" class="shogi-tournament__row-label">敗者復活戦</span>
                <div class="shogi-tournament__choices shogi-tournament__choices--two" role="radiogroup" aria-labelledby="entry-revival">
                  <button
                    v-for="item in REVIVAL_OPTIONS"
                    :key="item.label"
                    type="button"
                    role="radio"
                    :aria-checked="item.value === revival"
                    @click="revival = item.value; talkTopic = 'revival'"
                  >{{ item.label }}</button>
                </div>
              </div>

              <div class="shogi-tournament__row">
                <span id="entry-coach" class="shogi-tournament__row-label">やこび姫の助言</span>
                <div class="shogi-tournament__choices shogi-tournament__choices--three" role="radiogroup" aria-labelledby="entry-coach">
                  <button
                    v-for="item in COACH_OPTIONS"
                    :key="item.value"
                    type="button"
                    role="radio"
                    :aria-checked="item.value === coachLevel"
                    @click="coachLevel = item.value; talkTopic = 'coach'"
                  >{{ item.label }}</button>
                </div>
              </div>

              <div class="shogi-tournament__row">
                <span class="shogi-tournament__row-label">閃き・待った</span>
                <div class="shogi-tournament__selects">
                  <label class="shogi-tournament__select">
                    <span>閃き</span>
                    <select v-model.number="hintLimit" aria-label="閃きの回数" @change="talkTopic = 'coach'">
                      <option v-for="item in LEARNING_ASSIST_LIMITS" :key="item.value" :value="item.value">{{ item.label }}</option>
                    </select>
                  </label>
                  <label class="shogi-tournament__select">
                    <span>待った</span>
                    <select v-model.number="undoLimit" aria-label="待ったの回数" @change="talkTopic = 'coach'">
                      <option v-for="item in LEARNING_ASSIST_LIMITS" :key="item.value" :value="item.value">{{ item.label }}</option>
                    </select>
                  </label>
                </div>
              </div>

              <!-- 狭い画面では、左のやこび姫が見えないので、変えた設定への一言を、ここにも出す -->
              <div v-if="talkTopic !== 'guide'" class="shogi-tournament__inline-says">
                <YakobiSays :lines="talkLines" size="sm" :asset-base-url="assetBaseUrl" />
              </div>

              <button type="button" class="shogi-tournament__start" data-tournament-enter @click="enter">大会に参加する</button>
            </section>
          </div>
        </div>

        <!-- 竜王戦: 次の対局(左)・やこび姫(右)と、トーナメント表 -->
        <div v-else-if="screen === 'season' && view" class="shogi-tournament__layout shogi-tournament__layout--season" data-screen="season">
          <div class="shogi-tournament__col">
            <section v-if="view.pending" class="shogi-tournament__card shogi-tournament__match" aria-label="次の対局" data-pending>
              <h2>次の対局<span class="shogi-tournament__match-label">{{ view.pending.label }}</span></h2>
              <div class="shogi-tournament__vs">
                <div class="shogi-tournament__player shogi-tournament__player--you">
                  <span class="shogi-tournament__color">{{ view.pending.color === "black" ? "先手" : "後手" }}</span>
                  <strong>あなた</strong>
                  <small>{{ ratingText }}</small>
                </div>
                <div class="shogi-tournament__vs-mid">
                  <template v-if="view.pending.kind !== 'game'">
                    <span class="shogi-tournament__score">{{ view.pending.wins.user }}<i>-</i>{{ view.pending.wins.opponent }}</span>
                    <small>第{{ view.pending.gameNo }}局・{{ view.pending.need }}勝先取</small>
                  </template>
                  <span v-else class="shogi-tournament__vs-mark">VS</span>
                </div>
                <div class="shogi-tournament__player">
                  <span class="shogi-tournament__color">{{ view.pending.color === "black" ? "後手" : "先手" }}</span>
                  <strong>{{ view.pending.opponent.name }}</strong>
                  <small>{{ view.pending.opponent.dan }}</small>
                </div>
              </div>
              <dl class="shogi-tournament__tiles shogi-tournament__tiles--three">
                <div><dt>相手の棋力</dt><dd>Lv.{{ view.pending.opponent.level }}</dd></div>
                <div><dt>得意戦法</dt><dd class="shogi-tournament__tile-text">{{ view.pending.opponent.style?.label ?? "—" }}</dd></div>
                <div><dt>手番</dt><dd class="shogi-tournament__tile-text">{{ view.pending.color === "black" ? "先手" : "後手" }}</dd><span class="shogi-tournament__tile-note">振り駒</span></div>
              </dl>
              <button type="button" class="shogi-tournament__start" data-tournament-play @click="emit('play')">対局開始</button>
            </section>

            <section v-else-if="view.result" class="shogi-tournament__card" aria-label="この期の結果">
              <h2>この期の対局は、すべて終わりました</h2>
              <p class="shogi-tournament__lead">{{ outcomeHeadline }}（{{ view.result.wins }}勝{{ view.result.losses }}敗）</p>
              <button type="button" class="shogi-tournament__start" data-to-result @click="screen = 'result'">結果と統計を見る</button>
            </section>

            <section v-if="view.series.length" class="shogi-tournament__card" aria-label="番勝負">
              <h2>番勝負</h2>
              <ul class="shogi-tournament__series">
                <li v-for="series in view.series" :key="series.key" :class="{ 'shogi-tournament__series--done': series.winner }">
                  <span class="shogi-tournament__series-label">{{ series.label }}</span>
                  <span class="shogi-tournament__series-name">{{ series.a?.name }}</span>
                  <strong class="shogi-tournament__series-score">{{ series.wins.a }} - {{ series.wins.b }}</strong>
                  <span class="shogi-tournament__series-name">{{ series.b?.name }}</span>
                </li>
              </ul>
            </section>
          </div>

          <aside class="shogi-tournament__coach" aria-label="やこび姫">
            <YakobiSays :lines="seasonSays" size="xl" merged name-tag :asset-base-url="assetBaseUrl" />
          </aside>

          <section class="shogi-tournament__card shogi-tournament__tables" aria-label="トーナメント表">
            <div class="shogi-tournament__tabs" role="tablist">
              <button
                v-for="table in view.tables"
                :key="table.key"
                type="button"
                role="tab"
                :aria-selected="table.key === activeTableKey"
                @click="tableChoice = table.key"
              >{{ tableTab(table) }}</button>
            </div>
            <TournamentTree
              v-if="activeTable?.tree"
              :key="activeTable.key"
              :tree="activeTable.tree"
              :finals="activeTable.key === 'main' && view.defender ? { defender: view.defender, winner: finalsWinner } : null"
              :root-badge="activeTable.key === 'main' ? '' : rootBadge(activeTable)"
            />
          </section>
        </div>

        <!-- 竜王戦: 結果・統計・解説(やこび姫が話す) -->
        <div v-else-if="screen === 'result' && view?.result" class="shogi-tournament__layout shogi-tournament__layout--result" data-screen="result" data-result-screen>
          <section :class="['shogi-tournament__card', 'shogi-tournament__verdict', `shogi-tournament__verdict--${groupMove.kind}`]" aria-label="結果">
            <div class="shogi-tournament__verdict-main">
              <p class="shogi-tournament__eyebrow">{{ view.title }}の結果</p>
              <p class="shogi-tournament__headline">{{ outcomeHeadline }}</p>
              <p class="shogi-tournament__text">{{ outcomeDetail }}</p>
              <ul v-if="view.result.titles?.length" class="shogi-tournament__titles">
                <li v-for="title in view.result.titles" :key="title.id"><strong>{{ title.label }}</strong><small>{{ title.detail }}</small></li>
              </ul>
            </div>
            <div class="shogi-tournament__move" :aria-label="`${groupMove.from}から${groupMove.to}（${groupMove.label}）`">
              <span class="shogi-tournament__move-from">{{ groupMove.from }}</span>
              <span class="shogi-tournament__move-arrow" aria-hidden="true">→</span>
              <span class="shogi-tournament__move-to">{{ groupMove.to }}</span>
              <strong class="shogi-tournament__move-label">{{ groupMove.label }}</strong>
            </div>
            <ol class="shogi-tournament__path">
              <li v-for="step in view.result.path" :key="step.stage + step.label"><span>{{ step.label }}</span><strong>{{ step.text }}</strong></li>
            </ol>
          </section>

          <aside class="shogi-tournament__coach" aria-label="やこび姫の解説" data-commentary>
            <YakobiSays size="xl" name-tag :asset-base-url="assetBaseUrl" :lines="[...resultSays, ...commentarySays]">
              <div class="yakobi-says__bubble shogi-tournament__result-talk">
                <p v-for="line in resultSays" :key="line">{{ line }}</p>
              </div>
              <p v-for="line in view.stats.commentary" :key="line.title" class="yakobi-says__bubble">
                <strong>{{ line.title }}</strong>
                <small>{{ line.text }}</small>
              </p>
            </YakobiSays>
          </aside>

          <div class="shogi-tournament__col">
            <section class="shogi-tournament__card shogi-tournament__radar" aria-label="レーダーチャート">
              <h2>この期のあなた</h2>
              <RadarChart :axes="view.stats.radar" />
              <p v-if="view.stats.pending" class="shogi-tournament__hint" data-analyzing>やこび姫が対局を解析しています（あと{{ view.stats.pending }}局）。終わると、点数が出ます。</p>
              <p v-else class="shogi-tournament__hint">外側ほど得意。「—」は、データが足りない項目です。</p>
            </section>

            <section class="shogi-tournament__card" aria-label="統計" data-stats>
              <h2>統計</h2>
              <dl class="shogi-tournament__tiles">
                <div v-for="tile in statTiles" :key="tile.label">
                  <dt>{{ tile.label }}</dt>
                  <dd>{{ tile.value }}</dd>
                  <span v-if="tile.note" class="shogi-tournament__tile-note">{{ tile.note }}</span>
                </div>
              </dl>
            </section>
          </div>

          <div class="shogi-tournament__footer">
            <button type="button" class="shogi-tournament__sub" @click="screen = 'season'">トーナメント表を見る</button>
            <button type="button" class="shogi-tournament__sub" @click="emit('open-note')">やこびノートで見る</button>
            <button type="button" class="shogi-tournament__start" data-back-to-select @click="backToSelect">大会選択へ</button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, type PropType } from "vue";
import TournamentTree from "./TournamentTree.vue";
import RadarChart from "./RadarChart.vue";
import RyuoLadder from "./RyuoLadder.vue";
import YakobiSays from "./YakobiSays.vue";
import { DIFFICULTY_LEVELS, SCALES, groupMeanLevel, scaleById } from "./core/ryuo.mjs";
import { nextEntry, outcomeText } from "./core/ryuo-career.mjs";
import {
  entryCoachLine,
  entryDifficultyLine,
  entryRevivalLine,
  entryScaleLine,
  opponentLines,
  resultLines,
  ryuoGuideLines,
  seasonPhaseLines,
} from "./core/ryuo-speech.mjs";
import { LEARNING_ASSIST_LIMITS } from "./core/learning-setup.mjs";

type Career = {
  group: number; seasons: number; champion: boolean; titles: number; streak: number; eternal: boolean;
  settings: { scale: number; revival: boolean; coachLevel: string; hintLimit: number; undoLimit: number };
};
type Brief = { id: string; name: string; dan: string; level: number; style?: { label: string; rook?: string } | null };
type Tree = {
  root: { pid?: string; from?: string }; rounds: number;
  nodes: Record<string, { id: string; a: { pid?: string; from?: string }; b: { pid?: string; from?: string }; winner: string | null; round: number }>;
  leaves: Record<string, Brief & { label?: string }>; pendingNodeId: string | null;
};
type Table = { key: string; title: string; tree: Tree | null };
type Summary = {
  games: number; wins: number; losses: number; winRate: number | null; longestWinStreak: number;
  black: { games: number; wins: number }; white: { games: number; wins: number };
  vsStatic: { games: number; wins: number }; vsRanging: { games: number; wins: number };
  analyzed: number; moves: number; averageLoss: number | null; bigRate: number | null; averagePlies: number | null;
  kinds: { blunder: number; mistake: number; dubious: number; good: number; brilliant: number };
};
type View = {
  title: string; mode: string; startGroup: number; phase: string; phaseText: string; resultSeen: boolean;
  tables: Table[];
  series: { key: string; label: string; need: number; a: Brief | null; b: Brief | null; wins: { a: number; b: number }; winner: string | null }[];
  pending: null | {
    label: string; kind: string; color: string; need: number; gameNo: number; wins: { user: number; opponent: number }; opponent: Brief;
  };
  result: null | {
    outcome: string; startGroup: number; newGroup: number; promoted: boolean; relegated: boolean; challenger: boolean;
    wins: number; losses: number; standing: number | null; exitLabel: string; path: { stage: string; label: string; text: string }[];
    titles?: { id: string; label: string; detail: string }[];
  };
  defender: Brief | null;
  stats: {
    radar: { key: string; label: string; value: number | null }[]; summary: Summary; pending: number;
    commentary: { title: string; text: string }[];
  };
};

const props = defineProps({
  assetBaseUrl: { type: String, default: "." },
  backLabel: { type: String, default: "タイトルへ戻る" },
  career: { type: Object as PropType<Career>, required: true },
  view: { type: Object as PropType<View | null>, default: null },
  defaultDifficulty: { type: Number, default: 7 },
  /** プレイヤーの棋力の目安(CPUのLv)。やこび姫が、相手の強さを話すのに使う。 */
  userLevel: { type: Number, default: 20 },
  ratingText: { type: String, default: "" },
  startAt: { type: String as PropType<"select" | "season">, default: "select" },
});
const emit = defineEmits<{
  close: [];
  enter: [settings: { difficulty: number; scale: number; revival: boolean; coachLevel: string; hintLimit: number; undoLimit: number }];
  play: [];
  "open-note": [];
  "result-seen": [];
}>();

const HOME_STARS = [
  { id: "t1", style: "left:9%;top:16%;width:12px;height:12px;color:#fffcf4;" },
  { id: "t2", style: "left:16%;top:38%;width:8px;height:8px;color:#f1a54c;" },
  { id: "t3", style: "left:24%;top:10%;width:6px;height:6px;color:#d7d1fd;" },
  { id: "t4", style: "left:52%;top:12%;width:6px;height:6px;color:#f1a54c;" },
  { id: "t5", style: "left:63%;top:22%;width:12px;height:12px;color:#fffcf4;" },
  { id: "t6", style: "left:84%;top:30%;width:8px;height:8px;color:#f1a54c;" },
  { id: "t7", style: "left:12%;top:70%;width:8px;height:8px;color:#f1a54c;" },
  { id: "t8", style: "left:88%;top:66%;width:8px;height:8px;color:#d7d1fd;" },
];
const COMING_SOON = [{ id: "junni", label: "順位戦" }, { id: "meijin", label: "名人戦" }];
const ROAD = [{ id: "kenshukai", label: "研修会" }, { id: "shoreikai", label: "奨励会" }];

const charaUrl = computed(() => `${props.assetBaseUrl}/characters/yakobihime-mini.webp?v=2`);
const inProgress = computed(() => Boolean(props.view && !props.view.result));
const screen = ref<"select" | "ryuo" | "season" | "result">(
  props.startAt === "season" && props.view ? (props.view.result ? "result" : "season") : "select",
);
const reEntry = ref(false);
const tableChoice = ref<string | null>(null);

const entry = computed(() => nextEntry(props.career));
const ryuoCardNote = computed(() => {
  const { career } = props;
  const status = career.champion ? "竜王" : `${career.group}組`;
  const progress = inProgress.value ? "・進行中" : "";
  return `${status}・参加${career.seasons}期${career.titles ? `・竜王${career.titles}期` : ""}${progress}`;
});

/** 竜王戦を選ぶ。進行中なら表へ、見ていない結果があれば結果へ、そうでなければ、説明とエントリーへ。 */
function chooseRyuo() {
  if (props.view && !props.view.result) screen.value = "season";
  else if (props.view?.result && !props.view.resultSeen) screen.value = "result";
  else screen.value = "ryuo";
  talkTopic.value = "guide";
  guidePage.value = 0;
}

const backText = computed(() => (screen.value === "result" ? "大会選択へ" : "大会の選択へ"));
/** 戻る操作。結果は見終えたことにして、大会の選択へ。ほかの画面も、大会の選択へ。選択の画面なら、閉じる。 */
function goBack() {
  if (screen.value === "select") emit("close");
  else backToSelect();
}
function backToSelect() {
  if (screen.value === "result") emit("result-seen");
  screen.value = "select";
  reEntry.value = false;
  tableChoice.value = null;
}
defineExpose({ goBack });

// ---- 大会の帯: 期・段階と、勝ち上がりの道のり
const bannerTitle = computed(() => {
  if (screen.value === "ryuo") return `第${entry.value.no}期 竜王戦`;
  return props.view?.title.replace(/竜王戦$/, " 竜王戦") ?? "竜王戦";
});
const bannerSub = computed(() => {
  if (screen.value === "ryuo") return entry.value.mode === "defense" ? "竜王として、防衛戦に臨む" : `${entry.value.group}組からエントリー`;
  if (screen.value === "result") return "結果";
  const view = props.view;
  if (!view) return "";
  return view.mode === "defense" && view.phase !== "done" ? "防衛戦" : view.phaseText;
});
type RouteState = "done" | "current" | "todo" | "won" | "lost";
const OUTCOME_STEP: Record<string, string> = {
  "ranking-out": "ranking", "main-out": "main", "playoff-lost": "playoff", "finals-lost": "finals", "defense-lost": "finals", champion: "ryuo",
};
const PHASE_STEP: Record<string, string> = {
  ranking: "ranking", revival: "ranking", "main-setup": "main", main: "main", playoff: "playoff", finals: "finals", "prepare-defense": "finals",
};
const route = computed(() => {
  const view = screen.value === "ryuo" ? null : props.view;
  const defense = view ? view.mode === "defense" : entry.value.mode === "defense";
  const group = view ? view.startGroup : entry.value.group;
  const keys = defense ? ["finals", "ryuo"] : ["ranking", "main", "playoff", "finals", "ryuo"];
  const labels: Record<string, string> = {
    ranking: `${group}組ランキング戦`, main: "決勝トーナメント", playoff: "挑戦者決定戦",
    finals: defense ? "防衛戦 七番勝負" : "七番勝負", ryuo: defense ? "竜王防衛" : "竜王",
  };
  const outcome = view?.result?.outcome;
  const at = view ? keys.indexOf(outcome ? OUTCOME_STEP[outcome] : PHASE_STEP[view.phase] ?? "ranking") : -1;
  const reachedState: RouteState = !outcome ? "current" : outcome === "champion" ? "won" : "lost";
  return keys.map((key, index) => ({
    key,
    label: labels[key],
    state: (index < at ? "done" : index === at ? reachedState : "todo") as RouteState,
  }));
});

// ---- エントリー設定
const DIFFICULTY_STEPS = Array.from({ length: DIFFICULTY_LEVELS }, (_, index) => index + 1);
const COACH_OPTIONS = [
  { value: "off", label: "なし" },
  { value: "encourage", label: "応援のみ" },
  { value: "detailed", label: "詳しい助言" },
];
const REVIVAL_OPTIONS = [
  { value: true, label: "あり" },
  { value: false, label: "なし" },
];
const difficulty = ref(props.defaultDifficulty);
const scale = ref(props.career.settings.scale);
const revival = ref(props.career.settings.revival);
const coachLevel = ref(props.career.settings.coachLevel);
const hintLimit = ref(props.career.settings.hintLimit);
const undoLimit = ref(props.career.settings.undoLimit);

const meanLevel = computed(() => groupMeanLevel(entry.value.group, difficulty.value));
const scaleNote = computed(() => {
  const item = scaleById(scale.value);
  const group = entry.value.group;
  const slots = Object.values(item.slots).reduce((sum, count) => sum + count, 0);
  if (entry.value.mode === "defense") return "防衛戦は、挑戦者との七番勝負だけ（先に4勝）。挑戦者の強さは、難易度で決まるよ。";
  return `${group}組は${item.sizes[group]}名のトーナメント。決勝トーナメントは${slots}名。昇級・降級は各${item.promote}名だよ。`
    + "番勝負の数は変わらないよ。";
});
/** 規模の要点。行の下に、短く出す。 */
const scaleMeta = computed(() => {
  const item = scaleById(scale.value);
  if (entry.value.mode === "defense") return "防衛戦は七番勝負だけ";
  const slots = Object.values(item.slots).reduce((sum, count) => sum + count, 0);
  return `${entry.value.group}組${item.sizes[entry.value.group]}名・決勝トーナメント${slots}名・昇級と降級は各${item.promote}名`;
});

// ---- やこび姫のセリフ
// エントリーでは、やこび姫が1人で話す。ふだんは竜王戦の説明を1つずつ。設定を変えると、その設定について話す。
type TalkTopic = "guide" | "difficulty" | "scale" | "revival" | "coach";
const talkTopic = ref<TalkTopic>("guide");
/** 説明の各ページの見出し(目次)。guideLinesと同じ順・同じ数。 */
const GUIDE_TITLES = ["はじめに", "竜王戦とは", "出場できる人", "ランキング戦", "決勝トーナメント", "番勝負", "永世竜王"];
const guidePage = ref(0);
const guideLines = computed(() => [
  entry.value.mode === "defense"
    ? "竜王として、防衛戦に臨もう！ 挑戦者との七番勝負だよ。"
    : `第${entry.value.no}期竜王戦、${entry.value.group}組から参加だね！ 竜王戦のこと、説明するね。`,
  ...ryuoGuideLines(),
]);
const difficultyLine = computed(() => entryDifficultyLine({
  group: entry.value.group, meanLevel: meanLevel.value, difficulty: difficulty.value,
  recommended: props.defaultDifficulty, ratingText: props.ratingText,
}));
const scaleLine = computed(() => entryScaleLine(scaleById(scale.value).label, scaleNote.value));
const coachLine = computed(() => entryCoachLine({ coachLevel: coachLevel.value, hintLimit: hintLimit.value, undoLimit: undoLimit.value }));
const talkLines = computed(() => {
  switch (talkTopic.value) {
    case "difficulty": return [difficultyLine.value];
    case "scale": return [scaleLine.value];
    case "revival": return [entryRevivalLine(revival.value)];
    case "coach": return [coachLine.value];
    default: return [guideLines.value[Math.min(guidePage.value, guideLines.value.length - 1)]];
  }
});
const phaseLines = computed(() => seasonPhaseLines(props.view));
const opponentSays = computed(() => (
  props.view?.pending ? opponentLines(props.view.pending.opponent, props.userLevel, props.view.pending) : []
));
const resultSays = computed(() => resultLines(props.view?.result ? { ...props.view.result } : null));
/** 表の画面のやこび姫: いまの段階と、次の相手について。期が終わっていれば、結果について。 */
const seasonSays = computed(() => {
  const lines = [...phaseLines.value, ...opponentSays.value];
  return lines.length ? lines : resultSays.value;
});
/** 解説の表情を決めるための、セリフの文字列。 */
const commentarySays = computed(() => (props.view?.stats.commentary ?? []).map((line) => `${line.title} ${line.text}`));

function enter() {
  emit("enter", {
    difficulty: difficulty.value, scale: scale.value, revival: revival.value,
    coachLevel: coachLevel.value, hintLimit: hintLimit.value, undoLimit: undoLimit.value,
  });
  reEntry.value = false;
  tableChoice.value = null;
  screen.value = "season";
}

// ---- トーナメント表
const currentTableKey = computed(() => {
  const phase = props.view?.phase;
  if (phase === "revival") return props.view?.tables.find(({ key }) => key.startsWith("revival"))?.key ?? "ranking";
  if (phase === "main" || phase === "main-setup" || phase === "playoff" || phase === "finals" || phase === "done") {
    return props.view?.tables.find(({ key }) => key === "main") ? "main" : "ranking";
  }
  return "ranking";
});
const activeTableKey = computed(() => (
  props.view?.tables.some(({ key }) => key === tableChoice.value) ? tableChoice.value : currentTableKey.value
));
const activeTable = computed(() => props.view?.tables.find(({ key }) => key === activeTableKey.value) ?? null);
const finalsWinner = computed(() => props.view?.series.find(({ key }) => key === "finals")?.winner ?? null);
function tableTab(table: Table) {
  if (table.key === "ranking") return `${props.view?.startGroup}組ランキング戦`;
  if (table.key === "main") return "決勝トーナメント";
  return table.title;
}
/** ランキング戦の表は、決勝の上に、優勝の札を付ける。 */
function rootBadge(table: Table) {
  return table.key === "ranking" ? "優勝" : "";
}

// ---- 結果
const outcomeHeadline = computed(() => (props.view?.result ? outcomeText(props.view.result.outcome) : ""));
const outcomeDetail = computed(() => {
  const result = props.view?.result;
  if (!result) return "";
  const record = `${result.wins}勝${result.losses}敗`;
  if (result.outcome === "champion") return `${record}。竜王になりました。次の期は防衛戦です。`;
  if (result.outcome === "defense-lost") return `${record}。竜王の座を明け渡し、次の期は1組から挑戦します。`;
  const move = result.promoted ? `${result.startGroup}組から${result.newGroup}組へ昇級。`
    : result.relegated ? `${result.startGroup}組から${result.newGroup}組へ降級。`
      : result.newGroup === 1 && result.startGroup > 1 ? "挑戦者になったので、次の期は1組です。"
        : `次の期も${result.newGroup}組です。`;
  const standing = result.standing ? `組の最終順位は${result.standing}位。` : "";
  return `${record}。${standing}${move}`;
});
/** 組の動き。結果の画面に「6組 → 5組 昇級」のように大きく出す。 */
const groupMove = computed(() => {
  const view = props.view;
  const result = view?.result;
  if (!view || !result) return { from: "", to: "", label: "", kind: "stay" };
  const from = view.mode === "defense" ? "竜王" : `${result.startGroup}組`;
  if (result.outcome === "champion") return { from, to: "竜王", label: view.mode === "defense" ? "防衛" : "竜王獲得", kind: "crown" };
  const to = `${result.newGroup}組`;
  if (result.outcome === "defense-lost") return { from, to, label: "失冠", kind: "down" };
  if (result.promoted || result.newGroup < result.startGroup) return { from, to, label: "昇級", kind: "up" };
  if (result.relegated) return { from, to, label: "降級", kind: "down" };
  return { from, to, label: "残留", kind: "stay" };
});
const stats = computed(() => props.view!.stats.summary);
const percent = (ratio: number | null) => (ratio === null ? "—" : `${Math.round(ratio * 100)}%`);
const tally = ({ games, wins }: { games: number; wins: number }) => (games ? `${wins}勝${games - wins}敗` : "—");
/** 統計を、数字の大きなタイルにする。解析が済んだ局があるときだけ、指し手の質を出す。 */
const statTiles = computed(() => {
  const s = stats.value;
  const tiles: { label: string; value: string; note?: string }[] = [
    { label: "戦績", value: `${s.wins}勝${s.losses}敗`, note: `${s.games}局` },
    { label: "勝率", value: percent(s.winRate) },
    { label: "最長連勝", value: `${s.longestWinStreak}連勝` },
    { label: "先手", value: tally(s.black) },
    { label: "後手", value: tally(s.white) },
    { label: "対居飛車", value: tally(s.vsStatic) },
    { label: "対振り飛車", value: tally(s.vsRanging) },
  ];
  if (s.analyzed) {
    tiles.push(
      { label: "平均損失", value: String(s.averageLoss ?? "—"), note: `${s.moves}手を測定` },
      { label: "悪手", value: `${s.kinds.blunder + s.kinds.mistake}`, note: `大悪手${s.kinds.blunder}・疑問手${s.kinds.dubious}` },
      { label: "好手", value: `${s.kinds.good + s.kinds.brilliant}`, note: `神の一手${s.kinds.brilliant}` },
      { label: "大きな損", value: percent(s.bigRate), note: "損失300以上の割合" },
    );
  }
  if (s.averagePlies) tiles.push({ label: "平均手数", value: `${s.averagePlies}手` });
  return tiles;
});
</script>

<style>
/*
 * 竜王戦の画面。
 *   色: ドット絵のやこび姫と同じ、紺の地・スレートの面・クリームの文字・橙の強調・ラベンダーの差し色。
 *       グラデーションと光る影は使わず、平らな面と角の立った枠、ずらした影にする。
 *       竜王戦の朱(--tr-red)は、竜王の印(帯の「竜」と七番勝負の札)だけに使う。
 *   ボタンと入力の寸法をそろえる。
 *     --tr-control: 選択肢のボタン・セレクト・タブの高さ
 *     --tr-action:  大きな操作ボタン(参加・対局開始など)の高さ
 *   選択肢の並びは、グリッドで等分して、幅もそろえる。
 */
.shogi-game .shogi-dex.shogi-tournament {
  --tr-control: 2.75rem;
  --tr-action: 3.25rem;
  --tr-gap: 0.5rem;
  --tr-red: #c4604c;
  --tr-gold: #f1a54c;
  --tr-lavender: #d8d0ff;
  --tr-panel: #2c4359;
  --tr-deep: #172632;
  --tr-shadow: #121e29;
  --tr-line: rgba(255, 252, 244, 0.16);
  --tr-mincho: "Yu Mincho", "YuMincho", "Hiragino Mincho ProN", "Noto Serif JP", serif;
  background: #1e2d3d;
  font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Yu Gothic", "Meiryo", sans-serif;
}
.shogi-game .shogi-tournament__body {
  flex: 1;
  display: grid;
  align-content: start;
  gap: 1rem;
  width: min(100%, 80rem);
  margin: 0 auto;
  box-sizing: border-box;
  overflow-y: auto;
  padding: 1rem clamp(0.8rem, 3vw, 2rem) 2rem;
  font-size: var(--dex-text);
}
.shogi-game .shogi-tournament__layout { display: grid; gap: 1rem; align-items: start; grid-template-columns: minmax(0, 1fr); }
.shogi-game .shogi-tournament__col { display: grid; align-content: start; gap: 1rem; min-width: 0; }
@media (min-width: 900px) {
  .shogi-game .shogi-tournament__layout--entry { grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); }
  .shogi-game .shogi-tournament__layout--season { grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); }
  .shogi-game .shogi-tournament__layout--result { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .shogi-game .shogi-tournament__tables,
  .shogi-game .shogi-tournament__verdict,
  .shogi-game .shogi-tournament__footer { grid-column: 1 / -1; }
  /* やこび姫は、スクロールしても見えるように、列の上に留める */
  .shogi-game .shogi-tournament__layout--entry .shogi-tournament__coach,
  .shogi-game .shogi-tournament__layout--result .shogi-tournament__coach { position: sticky; top: 0; }
}

/* ---- 大会の帯 */
.shogi-game .shogi-tournament__banner {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  grid-template-areas: "seal title" "route route";
  align-items: center;
  gap: 0.9rem 1rem;
  padding: 1rem 1.2rem 1.1rem;
  border: 2px solid var(--tr-gold);
  border-radius: 0.2rem;
  background: var(--tr-panel);
  box-shadow: 4px 4px 0 var(--tr-shadow);
}
@media (min-width: 900px) {
  .shogi-game .shogi-tournament__banner {
    grid-template-columns: auto minmax(0, 0.8fr) minmax(0, 1.6fr);
    grid-template-areas: "seal title route";
  }
}
.shogi-game .shogi-tournament__seal {
  grid-area: seal;
  display: grid;
  place-items: center;
  width: 3.6rem;
  height: 3.6rem;
  border: 2px solid #fffcf4;
  border-radius: 0.2rem;
  color: #fffcf4;
  background: var(--tr-red);
  box-shadow: 3px 3px 0 var(--tr-shadow);
  font-family: var(--tr-mincho);
  font-size: 2rem;
  font-weight: 800;
  line-height: 1;
}
.shogi-game .shogi-tournament__banner-title { grid-area: title; min-width: 0; }
.shogi-game .shogi-tournament__banner-title h2 {
  margin: 0;
  color: #fffcf4;
  font-family: var(--tr-mincho);
  font-size: clamp(1.4rem, 1rem + 1.4vw, 2.2rem);
  font-weight: 800;
  letter-spacing: 0.12em;
  line-height: 1.2;
}
.shogi-game .shogi-tournament__banner-title p { margin: 0.25rem 0 0; color: var(--tr-gold); font-weight: 700; }
.shogi-game .shogi-tournament__route {
  grid-area: route;
  display: grid;
  grid-template-columns: repeat(var(--route-steps), minmax(0, 1fr));
  margin: 0;
  padding: 0;
  list-style: none;
}
.shogi-game .shogi-tournament__step {
  position: relative;
  display: grid;
  justify-items: center;
  align-content: start;
  gap: 0.35rem;
  padding: 0 0.15rem;
  color: rgba(255, 252, 244, 0.6);
  font-size: 0.78em;
  font-weight: 700;
  line-height: 1.35;
  text-align: center;
}
/* 段階の間を結ぶ線。通り過ぎた段階までを金にする。 */
.shogi-game .shogi-tournament__step::before {
  content: "";
  position: absolute;
  top: 0.5rem;
  right: 50%;
  width: 100%;
  height: 2px;
  background: rgba(255, 252, 244, 0.28);
}
.shogi-game .shogi-tournament__step:first-child::before { display: none; }
.shogi-game .shogi-tournament__step--done::before,
.shogi-game .shogi-tournament__step--current::before,
.shogi-game .shogi-tournament__step--won::before,
.shogi-game .shogi-tournament__step--lost::before { background: var(--tr-gold); }
.shogi-game .shogi-tournament__step-dot {
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  width: 1rem;
  height: 1rem;
  border: 2px solid rgba(255, 252, 244, 0.55);
  background: var(--tr-deep);
}
.shogi-game .shogi-tournament__step--done .shogi-tournament__step-dot { border-color: var(--tr-gold); background: var(--tr-gold); }
.shogi-game .shogi-tournament__step--done { color: rgba(255, 252, 244, 0.85); }
.shogi-game .shogi-tournament__step--current { color: #fffcf4; }
.shogi-game .shogi-tournament__step--current .shogi-tournament__step-dot {
  border-color: #fffcf4;
  background: var(--tr-lavender);
}
.shogi-game .shogi-tournament__step--won { color: var(--tr-gold); }
.shogi-game .shogi-tournament__step--won .shogi-tournament__step-dot { border-color: #fffcf4; background: var(--tr-gold); }
.shogi-game .shogi-tournament__step--lost { color: rgba(255, 252, 244, 0.6); }
.shogi-game .shogi-tournament__step--lost .shogi-tournament__step-dot { border-color: rgba(255, 252, 244, 0.6); background: #5d6f80; }

/* ---- カード */
.shogi-game .shogi-tournament__card {
  display: grid;
  gap: 0.8rem;
  align-content: start;
  min-width: 0;
  padding: 1rem 1.1rem;
  border: 2px solid #3b5570;
  border-radius: 0.2rem;
  background: var(--tr-panel);
}
.shogi-game .shogi-tournament__card h2 {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem 0.6rem;
  margin: 0;
  color: var(--tr-gold);
  font-size: 0.95em;
  letter-spacing: 0.12em;
}
.shogi-game .shogi-tournament__card h2::before {
  content: "";
  width: 0.5rem;
  height: 0.5rem;
  background: var(--tr-gold);
}
.shogi-game .shogi-tournament__text { margin: 0; line-height: 1.7; }
.shogi-game .shogi-tournament__lead { margin: 0; font-size: 1.2em; font-weight: 800; }
.shogi-game .shogi-tournament__hint { margin: 0; color: rgba(255, 252, 244, 0.7); font-size: 0.85em; line-height: 1.6; }

/* ---- やこび姫(解説役) */
.shogi-game .shogi-tournament__coach {
  display: grid;
  align-content: start;
  gap: 0.9rem;
  min-width: 0;
  padding: 1.1rem;
  border: 2px solid var(--tr-lavender);
  border-radius: 0.2rem;
  background: var(--tr-panel);
  box-shadow: 4px 4px 0 var(--tr-shadow);
}
.shogi-game .shogi-tournament__coach .yakobi-says { padding-bottom: 0.5rem; }
.shogi-game .shogi-tournament__pager {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 5rem minmax(0, 1fr);
  align-items: center;
  gap: var(--tr-gap);
  text-align: center;
  font-weight: 700;
}
.shogi-game .shogi-tournament__pager--single { grid-template-columns: minmax(0, 1fr); }
.shogi-game .shogi-tournament__pager button:disabled { opacity: 0.35; cursor: default; }
.shogi-game .shogi-tournament__result-talk { display: grid; gap: 0.45rem; padding: 0.8rem 1rem; }
.shogi-game .shogi-tournament__result-talk p { margin: 0; }
.shogi-game .shogi-tournament__chapters {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--tr-gap);
  margin: 0;
  padding: 0.9rem 0 0;
  border-top: 1px solid var(--tr-line);
  list-style: none;
}
.shogi-game .shogi-tournament__chapters button {
  box-sizing: border-box;
  width: 100%;
  height: var(--tr-control);
  padding: 0 0.8rem;
  border: 0;
  border-left: 3px solid rgba(255, 252, 244, 0.25);
  border-radius: 0.15rem;
  color: rgba(255, 252, 244, 0.85);
  background: var(--tr-deep);
  font: inherit;
  font-size: 0.9em;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
}
.shogi-game .shogi-tournament__chapters button[aria-current="step"] { border-left-color: var(--tr-gold); color: #fffcf4; background: #3b5570; }
.shogi-game .shogi-tournament__inline-says { display: none; }
@media (max-width: 899px) {
  .shogi-game .shogi-tournament__inline-says { display: block; }
  .shogi-game .shogi-tournament__chapters { display: none; }
}

/* ---- タイル(数字を大きく見せる) */
.shogi-game .shogi-tournament__tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(7.5rem, 1fr));
  gap: var(--tr-gap);
  margin: 0;
}
.shogi-game .shogi-tournament__tiles--three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.shogi-game .shogi-tournament__tiles > div {
  display: grid;
  align-content: start;
  gap: 0.15rem;
  min-width: 0;
  padding: 0.55rem 0.7rem;
  border-radius: 0.15rem;
  background: var(--tr-deep);
}
.shogi-game .shogi-tournament__tiles dt { color: rgba(255, 252, 244, 0.65); font-size: 0.78em; font-weight: 700; }
.shogi-game .shogi-tournament__tiles dd { margin: 0; font-size: 1.35em; font-weight: 800; line-height: 1.25; overflow-wrap: anywhere; }
.shogi-game .shogi-tournament__tiles dd small { margin-left: 0.1rem; font-size: 0.6em; }
.shogi-game .shogi-tournament__tiles dd.shogi-tournament__tile-text { font-size: 1em; }
.shogi-game .shogi-tournament__tile-note { color: var(--tr-gold); font-size: 0.75em; font-weight: 700; }

/* ---- エントリー: 項目名と選択肢を、同じ幅の2列にそろえる */
.shogi-game .shogi-tournament__row {
  display: grid;
  grid-template-columns: 7.5em minmax(0, 1fr);
  align-items: center;
  gap: 0.4rem 0.8rem;
  padding-top: 0.8rem;
  border-top: 1px solid var(--tr-line);
}
.shogi-game .shogi-tournament__row-label { font-weight: 800; }
.shogi-game .shogi-tournament__row-meta { grid-column: 2; margin: 0; color: rgba(255, 252, 244, 0.72); font-size: 0.82em; }
.shogi-game .shogi-tournament__row-meta strong { color: var(--tr-gold); }
.shogi-game .shogi-tournament__choices { display: grid; gap: var(--tr-gap); }
.shogi-game .shogi-tournament__choices--ten { grid-template-columns: repeat(12, minmax(0, 1fr)); }
.shogi-game .shogi-tournament__choices--five { grid-template-columns: repeat(5, minmax(0, 1fr)); }
.shogi-game .shogi-tournament__choices--three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.shogi-game .shogi-tournament__choices--two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.shogi-game .shogi-tournament__choices button,
.shogi-game .shogi-tournament__tabs button,
.shogi-game .shogi-tournament__pager button {
  box-sizing: border-box;
  min-width: 0;
  height: var(--tr-control);
  padding: 0 0.3rem;
  border: 2px solid rgba(255, 252, 244, 0.4);
  border-radius: 0.2rem;
  color: #fffcf4;
  background: var(--tr-deep);
  font: inherit;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
}
.shogi-game .shogi-tournament__choices button[aria-checked="true"],
.shogi-game .shogi-tournament__tabs button[aria-selected="true"] {
  border-color: #f1a54c;
  color: #172632;
  background: #f1a54c;
  font-weight: 800;
}
.shogi-game .shogi-tournament__choices button.shogi-tournament__recommended { border-style: dashed; border-color: #f1a54c; }
.shogi-game .shogi-tournament__selects { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--tr-gap); }
.shogi-game .shogi-tournament__select {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.5rem;
  font-weight: 700;
}
.shogi-game .shogi-tournament__select select {
  box-sizing: border-box;
  width: 100%;
  height: var(--tr-control);
  padding: 0 0.6rem;
  border: 2px solid rgba(255, 252, 244, 0.4);
  border-radius: 0.2rem;
  color: #fffcf4;
  background: var(--tr-deep);
  font: inherit;
}

/* 大きな操作ボタンは、すべて同じ高さと幅(列いっぱい)にする */
.shogi-game .shogi-tournament__actions { display: grid; gap: var(--tr-gap); }
.shogi-game .shogi-tournament__actions--two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.shogi-game .shogi-tournament__start,
.shogi-game .shogi-tournament__sub {
  box-sizing: border-box;
  display: block;
  width: 100%;
  height: var(--tr-action);
  padding: 0 1rem;
  border-radius: 0.2rem;
  font: inherit;
  font-size: 1.05em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}
.shogi-game .shogi-tournament__start {
  border: 2px solid #f1a54c;
  color: #172632;
  background: #f1a54c;
  font-weight: 800;
  box-shadow: 0 0.25rem 0 #b06a1c;
}
.shogi-game .shogi-tournament__sub { border: 2px solid rgba(255, 252, 244, 0.55); color: #fffcf4; background: transparent; font-weight: 700; }

/* ---- 次の対局: あなた VS 相手 */
.shogi-game .shogi-tournament__match-label { color: #fffcf4; letter-spacing: 0.05em; }
.shogi-game .shogi-tournament__vs {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 0.6rem;
  padding: 1rem 0.6rem;
  border-radius: 0.2rem;
  background: var(--tr-deep);
}
.shogi-game .shogi-tournament__player { display: grid; justify-items: center; gap: 0.2rem; min-width: 0; text-align: center; }
.shogi-game .shogi-tournament__player strong {
  font-family: var(--tr-mincho);
  font-size: clamp(1.25rem, 0.9rem + 1.2vw, 1.9rem);
  font-weight: 800;
  line-height: 1.2;
  overflow-wrap: anywhere;
}
.shogi-game .shogi-tournament__player small { color: rgba(255, 252, 244, 0.8); font-weight: 700; }
.shogi-game .shogi-tournament__color {
  padding: 0.05rem 0.6rem;
  border-radius: 0.15rem;
  color: #172632;
  background: #fffcf4;
  font-size: 0.75em;
  font-weight: 800;
}
.shogi-game .shogi-tournament__player:not(.shogi-tournament__player--you) .shogi-tournament__color { color: #fffcf4; background: #172632; box-shadow: 0 0 0 1px #fffcf4 inset; }
.shogi-game .shogi-tournament__vs-mid { display: grid; justify-items: center; gap: 0.2rem; }
.shogi-game .shogi-tournament__vs-mark {
  color: var(--tr-gold);
  font-family: var(--tr-mincho);
  font-size: 1.6em;
  font-style: italic;
  font-weight: 800;
}
.shogi-game .shogi-tournament__score { font-size: 2em; font-weight: 800; line-height: 1; white-space: nowrap; }
.shogi-game .shogi-tournament__score i { margin: 0 0.3rem; color: rgba(255, 252, 244, 0.5); font-style: normal; }
.shogi-game .shogi-tournament__vs-mid small { color: var(--tr-gold); font-size: 0.75em; font-weight: 700; white-space: nowrap; }
.shogi-game .shogi-tournament__series { display: grid; gap: 0.4rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .shogi-tournament__series li {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 0.6rem;
  padding: 0.4rem 0.6rem;
  border-radius: 0.15rem;
  background: var(--tr-deep);
}
.shogi-game .shogi-tournament__series-label { color: rgba(255, 252, 244, 0.7); font-size: 0.85em; }
.shogi-game .shogi-tournament__series-name { font-weight: 700; text-align: center; overflow-wrap: anywhere; }
.shogi-game .shogi-tournament__series-score { color: var(--tr-gold); font-size: 1.15em; white-space: nowrap; }
.shogi-game .shogi-tournament__tabs { display: flex; flex-wrap: wrap; gap: var(--tr-gap); }
.shogi-game .shogi-tournament__tabs button { min-width: 10rem; padding: 0 1rem; }

/* ---- 結果 */
.shogi-game .shogi-tournament__verdict {
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem 1.5rem;
  border-color: var(--tr-gold);
}
@media (min-width: 760px) {
  .shogi-game .shogi-tournament__verdict { grid-template-columns: minmax(0, 1fr) auto; align-items: center; }
  .shogi-game .shogi-tournament__path { grid-column: 1 / -1; }
}
/* 結果の種類は、枠の色で分ける(竜王・昇級は橙、降級はラベンダー)。 */
.shogi-game .shogi-tournament__verdict--crown,
.shogi-game .shogi-tournament__verdict--up { border-color: var(--tr-gold); }
.shogi-game .shogi-tournament__verdict--down { border-color: var(--tr-lavender); }
.shogi-game .shogi-tournament__verdict-main { display: grid; gap: 0.4rem; min-width: 0; }
.shogi-game .shogi-tournament__eyebrow { margin: 0; color: var(--tr-gold); font-weight: 800; letter-spacing: 0.12em; }
.shogi-game .shogi-tournament__headline {
  margin: 0;
  font-family: var(--tr-mincho);
  font-size: clamp(1.7rem, 1.1rem + 2vw, 2.8rem);
  font-weight: 800;
  line-height: 1.2;
}
.shogi-game .shogi-tournament__move {
  display: grid;
  grid-template-columns: auto auto auto;
  align-items: center;
  justify-content: center;
  gap: 0.3rem 0.8rem;
  padding: 0.8rem 1.2rem;
  border-radius: 0.2rem;
  background: var(--tr-deep);
  text-align: center;
}
.shogi-game .shogi-tournament__move-from,
.shogi-game .shogi-tournament__move-to { font-family: var(--tr-mincho); font-size: 1.8em; font-weight: 800; }
.shogi-game .shogi-tournament__move-from { color: rgba(255, 252, 244, 0.6); }
.shogi-game .shogi-tournament__move-arrow { color: rgba(255, 252, 244, 0.6); font-size: 1.4em; }
.shogi-game .shogi-tournament__move-label {
  grid-column: 1 / -1;
  justify-self: center;
  padding: 0.1rem 1rem;
  border-radius: 0.15rem;
  color: #172632;
  background: #fffcf4;
  letter-spacing: 0.2em;
}
.shogi-game .shogi-tournament__verdict--crown .shogi-tournament__move-label,
.shogi-game .shogi-tournament__verdict--up .shogi-tournament__move-label { background: var(--tr-gold); }
.shogi-game .shogi-tournament__verdict--down .shogi-tournament__move-label { background: var(--tr-lavender); }
.shogi-game .shogi-tournament__path {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
  gap: var(--tr-gap);
  margin: 0;
  padding: 0;
  list-style: none;
}
.shogi-game .shogi-tournament__path li {
  display: grid;
  gap: 0.15rem;
  padding: 0.5rem 0.7rem;
  border-left: 3px solid var(--tr-gold);
  border-radius: 0.15rem;
  background: var(--tr-deep);
}
.shogi-game .shogi-tournament__path li span { color: rgba(255, 252, 244, 0.7); font-size: 0.82em; }
.shogi-game .shogi-tournament__titles { display: flex; flex-wrap: wrap; gap: var(--tr-gap); margin: 0.2rem 0 0; padding: 0; list-style: none; }
.shogi-game .shogi-tournament__titles li {
  display: grid;
  gap: 0.05rem;
  padding: 0.4rem 0.9rem;
  border-radius: 0.15rem;
  color: #172632;
  background: var(--tr-gold);
  box-shadow: 3px 3px 0 var(--tr-shadow);
}
.shogi-game .shogi-tournament__titles small { font-size: 0.75em; }
.shogi-game .shogi-tournament__radar { justify-items: center; }
.shogi-game .shogi-tournament__radar h2 { justify-self: start; }
.shogi-game .shogi-tournament__footer { display: grid; gap: var(--tr-gap); grid-template-columns: minmax(0, 1fr); }
@media (min-width: 700px) {
  .shogi-game .shogi-tournament__footer { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

/* 狭い画面: 項目名を選択肢の上に置き、10段階の難易度は5つずつ2段にする */
@media (max-width: 600px) {
  .shogi-game .shogi-tournament__banner { padding: 0.8rem 0.9rem 0.9rem; }
  .shogi-game .shogi-tournament__seal { width: 2.8rem; height: 2.8rem; font-size: 1.5rem; }
  .shogi-game .shogi-tournament__step { font-size: 0.7em; }
  .shogi-game .shogi-tournament__row { grid-template-columns: minmax(0, 1fr); }
  .shogi-game .shogi-tournament__row-meta { grid-column: 1; }
  .shogi-game .shogi-tournament__choices--ten { grid-template-columns: repeat(6, minmax(0, 1fr)); }
  .shogi-game .shogi-tournament__choices--five button { padding: 0; }
  .shogi-game .shogi-tournament__actions--two { grid-template-columns: minmax(0, 1fr); }
  .shogi-game .shogi-tournament__tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .shogi-game .shogi-tournament__tiles--three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .shogi-game .shogi-tournament__series li { grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); }
  .shogi-game .shogi-tournament__series-label { grid-column: 1 / -1; }
  .shogi-game .shogi-tournament__tabs button { min-width: 0; flex: 1 1 calc(50% - var(--tr-gap)); }
}

/* 大会の選択(タイトル画面と同じ見た目)。どの段も、同じ大きさのカードを、3列の同じ位置に並べる。 */
.shogi-game .shogi-tournament-home .shogi-home__cards {
  grid-auto-flow: row;
  grid-template-columns: repeat(3, clamp(96px, 26vw, 130px));
  grid-auto-columns: auto;
  grid-auto-rows: 1fr;
}
.shogi-game .shogi-tournament-home .shogi-home__card { min-height: 7.5rem; align-content: center; }
.shogi-game .shogi-tournament__home-back {
  position: absolute;
  top: 0.8rem;
  left: 0.8rem;
  z-index: 1;
}
</style>
