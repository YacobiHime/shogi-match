<template>
  <!--
    団体戦(docs/team-battle-design.md)。大会の画面(ShogiTournament.vue)の中に出し、研修会・奨励会と同じ部品の見た目を使う。
    入口: 2つの形式の札、オーダー(高校)・ドラフト(プロ)、設定、「出場する」。はじめては羽音に誘われる場面から。
    大会中: チームの3人、次の試合の札、予選の表・トーナメント表。結果: 成績と、終わりの場面。
  -->
  <div class="shoreikai team-battle" data-team-battle>
    <!--
      入口(docs/team-battle-design.mdの17章)。ストーリー選択と同じ枠(PickFrame)で、まず形式のカードを選び、
      次の出場の画面でチーム・オーダー(ドラフト)・設定を見て「出場する」。
    -->
    <div v-if="screen === 'entry'" class="team-battle__entry" data-team-battle-screen="entry" :data-team-entry-step="entryStep">
      <PickFrame
        v-if="entryStep === 'format'"
        heading-id="shogi-tournament-title"
        title="団体戦"
        icon="team"
        :intro="formatIntro"
        :people="formatPeople"
        tone="pink"
        :actions="formatActions"
        :asset-base-url="assetBaseUrl"
        @action="onFormatAction"
      >
        <ul class="team-battle__pick-list" aria-label="出る大会" data-team-formats>
          <li v-for="item in formatCards" :key="item.id">
            <PickCard
              :id="item.id"
              :label="item.label"
              :title="item.name"
              :sub="item.note"
              :badge="item.best ? `最高 ${item.best}` : ''"
              :background="item.background"
              :selected="item.id === format"
              @pick="chooseFormat(item.id)"
              @hover="format = item.id"
            />
          </li>
        </ul>
      </PickFrame>
      <PickFrame
        v-else
        heading-id="shogi-tournament-title"
        :title="TEAM_FORMATS[format].name"
        icon="team"
        :intro="`羽音「${entryLine}」`"
        :people="formatPeople"
        :tone="format === 'pro' ? 'blue' : 'pink'"
        :actions="entryActions"
        :asset-base-url="assetBaseUrl"
        @action="onEntryAction"
      >
        <div class="team-battle__entry-body" data-team-entry>
          <p class="team-battle__entry-goal" data-team-goal><small>目標</small><span>{{ goalText }}</span></p>
          <section class="team-battle__entry-team" aria-labelledby="team-entry-team">
            <h2 id="team-entry-team">チーム<small>顔を押すとステータス</small></h2>
            <ul class="team-battle__entry-members" data-team-members>
              <li v-for="member in entryMembers" :key="member.id">
                <button type="button" class="team-battle__entry-member" :data-team-member="member.id" @click="statusId = member.id">
                  <img v-if="faceOf(member)" class="team-battle__face" :class="`team-battle__face--${faceKind(member)}`" :src="faceOf(member)" alt="" draggable="false">
                  <span v-else class="team-battle__face team-battle__face--char" aria-hidden="true">{{ member.name.slice(0, 1) }}</span>
                  <span class="team-battle__entry-member-text">
                    <small>{{ member.seat || "　" }}</small>
                    <strong>{{ member.you ? playerName : member.name }}</strong>
                    <em>{{ member.strength || "ステータス" }}</em>
                  </span>
                </button>
              </li>
            </ul>
          </section>
          <div v-if="format === 'school'" class="team-battle__entry-row">
            <p><small>オーダー（大会のあいだ変えない）</small><span data-team-order>{{ orderText }}</span></p>
            <button type="button" class="team-battle__entry-change" data-team-order-change @click="picker = 'seat'">変える</button>
          </div>
          <div v-else class="team-battle__entry-row">
            <p><small>ドラフト（3人目）</small><span data-team-draft>{{ draftText }}</span></p>
            <button type="button" class="team-battle__entry-change" data-team-draft-open @click="draftOpen = true">選ぶ</button>
          </div>
          <div class="team-battle__entry-row">
            <p><small>設定</small><span data-team-summary>{{ settingsSummary }}</span></p>
            <button type="button" class="team-battle__entry-change" data-team-change @click="settingsOpen = true">変える</button>
          </div>
        </div>
      </PickFrame>

      <!-- ドラフト: 候補の一覧と、選んだ棋士の能力。羽音に任せることもできる。 -->
      <div v-if="draftOpen" class="shogi-tournament__sheet" role="dialog" aria-modal="true" aria-label="ドラフト" data-team-draft-sheet @click.self="draftOpen = false">
        <div class="shogi-tournament__sheet-panel shogi-tournament__detail team-battle__draft">
          <h2>ドラフト：3人目を選ぶ</h2>
          <p class="shogi-tournament__tip-line shoreikai__tip">
            <img class="shogi-tournament__tip-face team-battle__sprite" :src="hananeSprite" alt="" draggable="false">
            <span class="shogi-tournament__tip-text">{{ hananePick ? hananePick.reason : "候補がいないみたい。" }}</span>
          </p>
          <button type="button" class="shogi-tournament__sub team-battle__auto" data-team-draft-auto @click="pickDraft(null)">羽音に任せる</button>
          <ul class="team-battle__candidates" aria-label="候補">
            <li v-for="candidate in candidates" :key="candidate.id">
              <button
                type="button"
                class="team-battle__candidate"
                :class="{ 'team-battle__candidate--on': draftId === candidate.id, 'team-battle__candidate--hanane': hananePick?.id === candidate.id }"
                :aria-pressed="draftId === candidate.id"
                :data-team-candidate="candidate.id"
                @click="pickDraft(candidate.id)"
              >
                <strong>{{ candidate.name }}</strong>
                <small>{{ candidate.dan }}{{ candidate.titleText }}・{{ candidate.styleText }}</small>
                <small>{{ candidate.strength }}</small>
                <span v-if="hananePick?.id === candidate.id" class="team-battle__tag">羽音のおすすめ</span>
              </button>
            </li>
          </ul>
          <PlayerAbilityPanel v-if="selectedAbility" :view="selectedAbility" compact />
          <button type="button" class="shogi-tournament__sub shogi-tournament__sheet-close" @click="draftOpen = false">閉じる</button>
        </div>
      </div>

      <div v-if="settingsOpen" class="shogi-tournament__sheet" role="dialog" aria-modal="true" aria-label="出場の設定" data-team-settings @click.self="settingsOpen = false">
        <div class="shogi-tournament__sheet-panel shogi-tournament__detail">
          <h2>出場の設定</h2>
          <ul class="shogi-tournament__settings">
            <li v-for="row in settingRows" :key="row.id">
              <button
                type="button"
                class="shogi-tournament__setting"
                :data-team-row="row.id"
                :aria-label="`${row.label}: ${row.value}。押すと変更`"
                @click="picker = row.id"
              >
                <span class="shogi-tournament__setting-label">{{ row.label }}</span>
                <span class="shogi-tournament__setting-value">{{ row.value }}<small v-if="row.note">{{ row.note }}</small></span>
                <span class="shogi-tournament__setting-change" aria-hidden="true">変更</span>
              </button>
            </li>
          </ul>
          <button type="button" class="shogi-tournament__sub shogi-tournament__sheet-close" @click="settingsOpen = false">閉じる</button>
        </div>
      </div>
      <PregamePicker
        v-if="pickerConfig"
        :title="pickerConfig.title"
        :sections="pickerConfig.sections"
        :note="pickerConfig.note"
        :action="picker === 'difficulty' ? MEASURE_PICKER_ACTION : null"
        @select="onPick"
        @close="picker = ''"
        @action="picker = ''; emit('measure')"
      />
    </div>

    <!-- 大会中・結果 -->
    <div v-else-if="view" class="shogi-tournament__stage shogi-tournament__stage--shoreikai" :data-team-battle-screen="screen" :data-team-phase="view.phase">
      <header class="shogi-tournament__topbar shoreikai__topbar">
        <button type="button" class="shogi-tournament__topbar-back" :aria-label="backLabel" data-team-back @click="emit('back')">
          <span aria-hidden="true">←</span><span class="shogi-tournament__topbar-back-text">{{ backLabel }}</span>
        </button>
        <span class="shogi-tournament__seal" aria-hidden="true">団</span>
        <div class="shogi-tournament__topbar-title">
          <h1 id="shogi-tournament-title">{{ view.name }}</h1>
          <p class="shogi-tournament__topbar-sub" data-team-sub>{{ runSub }}</p>
        </div>
      </header>

      <section class="shoreikai__main team-battle__main" :aria-label="view.name">
        <!-- 結果 -->
        <div v-if="screen === 'done'" class="team-battle__result" data-team-result>
          <p class="team-battle__result-label" :class="{ 'team-battle__result-label--win': view.result?.place === 1 }">{{ view.result?.label }}</p>
          <p class="team-battle__result-team">{{ view.team?.name }}</p>
          <p v-if="view.champion && view.result?.place !== 1" class="team-battle__result-note">優勝は{{ view.champion.name }}</p>
        </div>

        <!-- 高校の3つの段階の道(地区大会 → 県大会 → 全国大会。15章の9) -->
        <ol v-if="view.stages" class="team-battle__stages" aria-label="大会の段階" data-team-stages>
          <li
            v-for="stage in view.stages"
            :key="stage.id"
            class="team-battle__stage"
            :class="`team-battle__stage--${stage.state}`"
            :aria-current="stage.state === 'current' ? 'step' : undefined"
            :data-team-stage="stage.id"
            :data-team-stage-state="stage.state"
          >
            <strong>{{ stage.name }}</strong>
            <small>{{ stageNote(stage) }}</small>
          </li>
        </ol>

        <!-- チームの3人(顔を押すとステータス。16章) -->
        <div class="team-battle__team" data-team-members>
          <button
            v-for="member in view.team?.members ?? []"
            :key="member.id"
            type="button"
            class="team-battle__member"
            :class="{ 'team-battle__member--you': member.you }"
            :aria-label="`${member.seat ? `${member.seat} ` : ''}${member.you ? playerName : member.name}のステータス`"
            :data-team-member="member.id"
            @click="statusId = member.id"
          >
            <img v-if="faceOf(member)" class="team-battle__face" :class="`team-battle__face--${faceKind(member)}`" :src="faceOf(member)" alt="" draggable="false">
            <span v-else class="team-battle__face team-battle__face--char" aria-hidden="true">{{ member.name.slice(0, 1) }}</span>
            <span class="team-battle__member-text">
              <small v-if="member.seat">{{ member.seat }}</small>
              <strong>{{ member.you ? playerName : member.name }}</strong>
            </span>
          </button>
        </div>

        <!-- 次の試合 -->
        <div v-if="next" class="team-battle__match" data-team-next>
          <p class="team-battle__match-head">
            <span>{{ next.label }}</span>
            <strong>対 {{ next.them?.name }}<small v-if="next.them?.area">（{{ next.them.area }}）</small></strong>
          </p>
          <p class="team-battle__score" :aria-label="`${next.score.us}勝${next.score.them}敗。${next.need}勝で勝ち`">
            <span v-for="(mark, index) in scoreMarks" :key="index" :class="`team-battle__pip team-battle__pip--${mark}`" aria-hidden="true"></span>
            <b>{{ next.score.us }} - {{ next.score.them }}</b>
          </p>
          <ul class="team-battle__boards">
            <li v-for="(game, index) in next.games" :key="index" class="team-battle__board" :class="{ 'team-battle__board--you': game.user }">
              <small>{{ game.seat }}</small>
              <span>{{ game.us?.you ? playerName : game.us?.name }}</span>
              <b :class="game.result ? `team-battle__mark--${game.result}` : ''">{{ game.result === "win" ? "○" : game.result === "loss" ? "●" : game.user ? "対局" : "…" }}</b>
              <button
                v-if="game.them"
                type="button"
                class="team-battle__opponent"
                :aria-label="`${game.them.name}のステータス`"
                :data-team-opponent="game.them.id"
                @click="statusId = game.them.id"
              >{{ game.them.name }}<small v-if="game.them.dan">{{ game.them.dan }}</small></button>
            </li>
          </ul>
        </div>

        <!-- 進み具合: 段階ごとの表(地区大会・県大会・全国予選・決勝T。プロは予選・本戦。15章の9) -->
        <div class="team-battle__tabs" role="tablist" aria-label="表">
          <button
            v-for="item in view.tables.tabs"
            :key="item.id"
            type="button"
            role="tab"
            :aria-selected="tab === item.id"
            :disabled="item.disabled"
            :data-team-tab="item.id"
            @click="tab = item.id"
          >{{ item.label }}</button>
        </div>
        <div v-if="activeTable?.type === 'swiss' || activeTable?.type === 'leagues'" class="team-battle__table-wrap" data-team-qualify>
          <table v-if="activeTable.type === 'swiss' && view.swiss" class="team-battle__table">
            <thead><tr><th>学校</th><th>勝敗</th><th>勝ち局</th><th></th></tr></thead>
            <tbody>
              <tr v-for="row in swissRows" :key="row.team.id" :class="{ 'team-battle__row--you': row.team.you }">
                <td><button type="button" class="team-battle__school-link" :data-team-school="row.team.id" @click="schoolId = row.team.id">{{ row.team.name }}</button><small v-if="row.team.area">（{{ row.team.area }}）</small></td>
                <td>{{ row.w }}勝{{ row.l }}敗</td>
                <td>{{ row.boards }}</td>
                <td>{{ row.status === "pass" ? "通過" : row.status === "out" ? "" : "" }}</td>
              </tr>
            </tbody>
          </table>
          <div v-else-if="view.leagues" class="team-battle__leagues">
            <table v-for="league in view.leagues" :key="league.id" class="team-battle__table" :class="{ 'team-battle__table--you': league.you }">
              <caption>予選リーグ{{ league.id }}</caption>
              <tbody>
                <tr v-for="row in league.table" :key="row.team.id" :class="{ 'team-battle__row--you': row.team.you }">
                  <td>{{ row.rank }}</td>
                  <td><button type="button" class="team-battle__school-link" :data-team-school="row.team.id" @click="schoolId = row.team.id">{{ row.team.name }}</button></td>
                  <td>{{ row.w }}勝{{ row.l }}敗</td>
                  <td>{{ row.gw }}-{{ row.gl }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div v-else-if="activeTable?.knockout" class="team-battle__table-wrap team-battle__ko" data-team-ko :data-team-ko-stage="activeTable.id">
          <section v-for="round in activeTable.knockout.rounds" :key="round.name" class="team-battle__ko-round">
            <h3>{{ round.name }}</h3>
            <ul>
              <li v-for="(match, index) in round.matches" :key="index" :class="{ 'team-battle__row--you': 'bye' in match ? match.bye?.you : match?.us?.you || match?.them?.you }">
                <template v-if="'bye' in match">{{ match.bye?.name }}（不戦勝）</template>
                <template v-else-if="match">
                  <button type="button" class="team-battle__school-link" :class="{ 'team-battle__winner': match.winner === 'us' }" :data-team-school="match.us?.id" @click="schoolId = match.us?.id ?? ''">{{ match.us?.name }}</button>
                  <b>{{ match.winner ? `${match.score.us}-${match.score.them}` : "対" }}</b>
                  <button type="button" class="team-battle__school-link" :class="{ 'team-battle__winner': match.winner === 'them' }" :data-team-school="match.them?.id" @click="schoolId = match.them?.id ?? ''">{{ match.them?.name }}</button>
                </template>
              </li>
            </ul>
          </section>
          <p v-if="activeTable.knockout.champion" class="team-battle__champion">優勝 {{ activeTable.knockout.champion.name }}</p>
        </div>
      </section>

      <section class="shogi-tournament__hud" aria-label="次の一局">
        <p class="shogi-tournament__tip-line shoreikai__tip" data-team-run-talk>
          <img class="shogi-tournament__tip-face team-battle__sprite" :src="hananeSprite" alt="" draggable="false">
          <span class="shogi-tournament__tip-text">{{ runLine }}</span>
        </p>
        <p v-if="lastNews" class="team-battle__news" role="status" data-team-news>{{ lastNews }}</p>
        <template v-if="screen === 'done'">
          <button v-if="view.result?.place === 1" type="button" class="shogi-tournament__sub" data-team-award @click="emit('ceremony')">賞状を見る</button>
          <button type="button" class="shogi-tournament__start" data-team-close @click="emit('close-run')">大会を終える</button>
        </template>
        <template v-else-if="view.format === 'pro' && !view.pending">
          <p class="team-battle__choose-head">次は誰が指す？</p>
          <div class="team-battle__choose">
            <button
              v-for="member in view.team?.members ?? []"
              :key="member.id"
              type="button"
              class="shogi-tournament__sub team-battle__choose-btn"
              :disabled="!view.available.includes(member.id)"
              :data-team-choose="member.id"
              @click="emit('choose', member.id)"
            >{{ member.you ? `${playerName}（自分）` : member.name }}<small>{{ usedText(member.id) }}</small></button>
          </div>
          <button type="button" class="shogi-tournament__start" data-team-auto @click="emit('choose', '')">羽音に任せる</button>
        </template>
        <button v-else type="button" class="shogi-tournament__start" data-team-play @click="suspendedMoves ? emit('resume') : emit('play')">
          {{ suspendedMoves ? `対局を再開（${suspendedMoves}手目から）` : `対局する（${view.pending?.label?.split(" ").at(-1) ?? ""}）` }}
        </button>
      </section>
    </div>

    <!-- 仲間のステータス(16章)。入口と大会中のどちらでも、チームの顔を押すと開く。 -->
    <TeamMemberSheet
      v-if="statusMember"
      :status="statusMember"
      :face="faceOf(statusMember)"
      :face-kind="faceKind(statusMember)"
      :player-name="playerName"
      :my-profile="myProfile"
      @close="statusId = ''"
    />

    <!-- 学校のシート(20章)。表の学校名を押すと、その学校の3人の札。札を押すとステータス。 -->
    <div v-if="schoolSheet && !statusMember" class="shogi-tournament__sheet" role="dialog" aria-modal="true" :aria-label="schoolSheet.name" data-team-school-sheet @click.self="schoolId = ''">
      <div class="shogi-tournament__sheet-panel shogi-tournament__detail team-battle__school-sheet">
        <h2>{{ schoolSheet.name }}<small v-if="schoolSheet.area">{{ schoolSheet.area }}</small></h2>
        <p v-if="schoolSheet.note" class="team-battle__school-note">{{ schoolSheet.note }}</p>
        <ul class="team-battle__school-members">
          <li v-for="member in schoolSheet.members" :key="member.id">
            <button type="button" class="team-battle__school-member" :data-team-school-member="member.id" @click="statusId = member.id">
              <img v-if="faceOf(member)" class="team-battle__face" :class="`team-battle__face--${faceKind(member)}`" :src="faceOf(member)" alt="" draggable="false">
              <span v-else class="team-battle__face team-battle__face--char" aria-hidden="true">{{ member.name.slice(0, 1) }}</span>
              <span class="team-battle__school-member-text">
                <small>{{ [member.seat, member.dan].filter(Boolean).join("・") }}</small>
                <strong>{{ member.you ? playerName : member.name }}</strong>
                <em>{{ member.recordText }}</em>
              </span>
            </button>
          </li>
        </ul>
        <button ref="schoolCloseEl" type="button" class="shogi-tournament__sub shogi-tournament__sheet-close" data-team-school-close @click="schoolId = ''">閉じる</button>
      </div>
    </div>

    <!-- 試合の結果発表(19章)。自分が先に終わったら仲間の盤を見守り、3局がそろったら1席ずつ明かす。節目の場面はそのあと。 -->
    <TeamFinale
      v-if="finaleView && !scene"
      :key="finaleView.id"
      ref="finaleEl"
      :view="finaleView"
      :boards="finaleBoardList"
      :engine-factory="engineFactory"
      :player-name="playerName === 'あなた' ? '' : playerName"
      :asset-base-url="assetBaseUrl"
      @done="emit('finale-seen')"
    />
    <!-- 表彰式(20章)。段階の終わりに、試合の結果発表のあと、節目の場面の前。 -->
    <TeamCeremony
      v-if="ceremonyView && !finaleView && !scene"
      :key="ceremonyView.id"
      ref="ceremonyEl"
      :view="ceremonyView"
      :awards="awards"
      :asset-base-url="assetBaseUrl"
      @done="emit('ceremony-seen')"
    />
    <NovelScene v-if="scene" ref="novelEl" :scene="scene" :asset-base-url="assetBaseUrl" @done="closeScene" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type PropType } from "vue";
import NovelScene from "./NovelScene.vue";
import PickCard from "./PickCard.vue";
import PickFrame from "./PickFrame.vue";
import PlayerAbilityPanel from "./PlayerAbilityPanel.vue";
import TeamMemberSheet from "./TeamMemberSheet.vue";
import TeamFinale from "./TeamFinale.vue";
import TeamCeremony from "./TeamCeremony.vue";
import type { SeasonAwardData } from "./SeasonAward.vue";
import PregamePicker, { type PickerSection, type PickerValue } from "./PregamePicker.vue";
import { MEASURE_PICKER_ACTION } from "./core/skill-estimate.mjs";
import { difficultyName, difficultyOptions } from "./core/tournament-world.mjs";
import { LEARNING_ASSIST_LIMITS } from "./core/learning-setup.mjs";
import { BYOYOMI_CHOICES, byoyomiLabel } from "./core/byoyomi.mjs";
import { memberAbilityView } from "./core/ryuo-book.mjs";
import { GROUP_MEAN_RATING, WORLD_BASE_RATING } from "./core/ryuo-strength.mjs";
import {
  RECOMMENDED_SCHOOL_SEAT, SCHOOL_BASE, SCHOOL_SEATS, TEAM_FORMATS, TEAM_HANANE_ID, TEAM_MOMOKA_ID, TEAM_USER_ID, hananeDraftPick, schoolOrder,
  teamEntryMembers, teamPlayerStatus,
} from "./core/team-battle.mjs";
import { portraitUrl, teamMomentFor, teamScene } from "./core/team-story.mjs";
import { finaleBoards, teamFinaleView } from "./core/team-finale.mjs";
import { teamCeremonyView } from "./core/team-ceremony.mjs";
import type { EngineFactory } from "./composables/match/analysisEngines";

type Format = "school" | "pro";
type Settings = { difficulty: number; coachLevel: string; hintLimit: number; undoLimit: number; byoyomi: number };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Career = { invited: { school: boolean; pro: boolean }; history: { format: string; label: string }[]; best: Record<string, { place: number; label: string }>; settings?: Partial<Settings>; current?: any };

const props = defineProps({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  view: { type: Object as PropType<any>, default: null },
  career: { type: Object as PropType<Career>, required: true },
  /** ドラフトの候補(名簿の棋士。core/team-battle.mjsのdraftCandidates)。 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  draftMembers: { type: Array as PropType<any[]>, default: () => [] },
  /** プレイヤーの能力(羽音に任せるドラフトの理由に使う。対局が少なければnull)。 */
  myAbilities: { type: Object as PropType<Record<string, number> | null>, default: null },
  /** 自分の能力の見立て(仲間のステータスの自分。my-abilities.mjsのmyAbilityProfile)。 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  myProfile: { type: Object as PropType<any>, default: null },
  /** 名簿(出場の画面で羽音とドラフトの棋士のステータスを作る)。なくても羽音は人物の設定から作る。 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  roster: { type: Object as PropType<any>, default: null },
  defaultDifficulty: { type: Number, default: 9 },
  world: { type: Object as PropType<{ level: number; difficulty: number; playerLevel: number; at: number } | null>, default: null },
  recommendedDifficulty: { type: Number as PropType<number | null>, default: null },
  userLevel: { type: Number, default: NaN },
  assetBaseUrl: { type: String, default: "." },
  playerName: { type: String, default: "あなた" },
  suspendedMoves: { type: Number as PropType<number | null>, default: null },
  /** プロの試合で、仲間が指した直前の局の結果(「第3局 羽音 勝ち 2-1」)。 */
  news: { type: String, default: "" },
  backLabel: { type: String, default: "大会の選択へ" },
  /** 結果発表で仲間の盤を見守るときに棋譜を作るエンジン(中継と同じ)。なければ見守らずに結果発表。 */
  engineFactory: { type: Function as PropType<(() => Promise<EngineFactory>) | null>, default: null },
  /** 賞状帳(表彰式で渡す賞状を開く。20章)。 */
  awards: { type: Array as PropType<SeasonAwardData[]>, default: () => [] },
});
const emit = defineEmits<{
  measure: [];
  enter: [payload: { format: Format; settings: Settings; userSeat: number; draftPick: string | null; draftReason: string }];
  play: [];
  resume: [];
  /** プロの試合の次の局に出す棋士(空なら羽音に任せる)。 */
  choose: [memberId: string];
  invited: [format: Format];
  /** プロの団体戦を選んだが、ドラフトの候補(名簿)がまだない。名簿を作ってもらう。 */
  "need-roster": [];
  "scene-seen": [id: string];
  /** 試合の結果発表を見た(19章)。 */
  "finale-seen": [];
  /** 表彰式を見た(20章)。 */
  "ceremony-seen": [];
  "close-run": [];
  ceremony: [];
  back: [];
}>();

const hananeSprite = computed(() => `${props.assetBaseUrl}/characters/hanane-mini.webp?v=1`);
const screen = computed(() => {
  if (!props.view) return "entry";
  return props.view.phase === "done" ? "done" : "run";
});

// ---- 場面(ノベル)
const novelEl = ref<{ finish: () => void; goBack: () => boolean } | null>(null);
const sceneId = ref("");
const scene = computed(() => (sceneId.value ? teamScene(sceneId.value, props.playerName === "あなた" ? "" : props.playerName) : null));
function closeScene() {
  const id = sceneId.value;
  sceneId.value = "";
  if (id === "invite-school") emit("invited", "school");
  else if (id === "invite-pro") emit("invited", "pro");
  else if (id) emit("scene-seen", id);
}
/** はじめて団体戦を開いたら、羽音に誘われる場面から(4章)。 */
if (!props.view && !props.career.invited?.school) sceneId.value = "invite-school";

// ---- 試合の結果発表(19章)。まだ見ていなければ、節目の場面より先に出す。
const finaleEl = ref<{ goBack: () => boolean } | null>(null);
const finaleView = computed(() => teamFinaleView(props.career.current, { playerName: props.playerName === "あなた" ? "" : props.playerName }));
const finaleBoardList = computed(() => finaleBoards(props.career.current));

// ---- 表彰式(20章)。結果発表を見てから、節目の場面の前に。
const ceremonyEl = ref<{ goBack: () => boolean } | null>(null);
const ceremonyView = computed(() => teamCeremonyView(props.career.current, { playerName: props.playerName === "あなた" ? "" : props.playerName }));

/** 大会中の節目の場面(見ていなければ1回だけ。地区大会・県大会・全国大会の始めなど。15章の8)。結果発表と表彰式を見てから。 */
watch(() => [props.view?.phase, props.view?.stage, props.view?.next?.id, props.view?.result?.label, finaleView.value?.id, ceremonyView.value?.id], () => {
  if (sceneId.value || finaleView.value || ceremonyView.value) return;
  const id = teamMomentFor(props.view);
  if (id) sceneId.value = id;
}, { immediate: true });

// ---- 入口(17章)。形式選び(format)→ 出場の画面(entry)。
const format = ref<Format>("school");
const entryStep = ref<"format" | "entry">("format");
/** 形式のカードを押した: その形式の出場の画面へ(プロのはじめては、先に羽音に誘われる場面)。 */
function chooseFormat(id: Format) {
  format.value = id;
  if (id === "pro" && !props.draftMembers.length) emit("need-roster");
  if (id === "pro" && !props.career.invited?.pro) sceneId.value = "invite-pro";
  entryStep.value = "entry";
}
const formatIntro = "出る団体戦を選んでください。羽音と同じチームで出ます。";
const formatPeople = computed(() => (format.value === "school"
  ? [{ who: "hanane", face: "neutral" }, { who: "momoka", face: "wry" }]
  : [{ who: "hanane", face: "smile" }]));
const formatActions = [
  { id: "select", label: "選択", key: "▲▼", hint: true },
  { id: "decide", label: "決定", key: "Enter", primary: true },
  { id: "back", label: "戻る", key: "Esc" },
];
function onFormatAction(id: string) {
  if (id === "decide") chooseFormat(format.value);
  else if (id === "back") emit("back");
}
const entryActions = [
  { id: "enter", label: "出場する", key: "Enter", primary: true },
  { id: "back", label: "戻る", key: "Esc" },
];
function onEntryAction(id: string) {
  if (id === "enter") enter();
  else if (id === "back") entryStep.value = "format";
}
const goalText = computed(() => (format.value === "school" ? "地区大会から勝ち上がり、3人で全国の頂点へ" : "早指しの団体戦で優勝する"));
/** 出場の画面のチームの3人(大会を作る前のステータス。17章の3)。 */
const entryMembers = computed(() => teamEntryMembers({
  format: format.value,
  roster: props.roster,
  userSeat: userSeat.value,
  draftPick: format.value === "pro" ? (draftId.value ?? hananePick.value?.id ?? null) : null,
  userName: props.playerName,
  userLevel: Number.isFinite(props.userLevel) ? props.userLevel : 20,
  world: props.world?.level ?? null,
}));
const faceSrc = (who: string, face = "neutral") => portraitUrl(props.assetBaseUrl, who, face, { small: true });
const formatCards = computed(() => (["school", "pro"] as const).map((id) => ({
  id,
  label: TEAM_FORMATS[id].short,
  name: TEAM_FORMATS[id].name,
  note: TEAM_FORMATS[id].note,
  best: props.career.best?.[id]?.label ?? "",
  background: id === "school" ? "classroom" : "hall",
})));
const userSeat = ref(RECOMMENDED_SCHOOL_SEAT);
const orderText = computed(() => {
  const names: Record<string, string> = { [TEAM_USER_ID]: props.playerName, [TEAM_HANANE_ID]: "羽音", [TEAM_MOMOKA_ID]: "百花" };
  return schoolOrder(userSeat.value).map((id, index) => `${SCHOOL_SEATS[index]} ${names[id]}`).join("・")
    + (userSeat.value === RECOMMENDED_SCHOOL_SEAT ? "（羽音のおすすめ）" : "");
});
const entryLine = computed(() => {
  if (format.value === "pro") return "3人目は君が選んで。迷ったら、私に任せて。";
  if (userSeat.value === 0) return "君が主将。相手のいちばん強い人と当たるよ。私は副将で1つ取る。";
  if (userSeat.value === 2) return "三将でいいの？ じゃあ百花が副将。私が主将で1つ取るよ。";
  return "主将は私。君は副将、百花は三将。3局のうち2つ取れば勝ちだよ。";
});

// ドラフト
const draftOpen = ref(false);
const draftId = ref<string | null>(null);
const hananePick = computed(() => hananeDraftPick(props.draftMembers, props.myAbilities));
const groupOf = (rating: number) => {
  const groups = Object.entries(GROUP_MEAN_RATING).sort((a, b) => b[1] - a[1]);
  return Number(groups.find(([, mean]) => rating >= mean - 40)?.[0] ?? 6);
};
const candidates = computed(() => props.draftMembers.map((member) => ({
  id: member.id,
  name: member.name,
  dan: member.dan ?? "",
  titleText: Object.keys(member.titleCounts ?? {}).length ? "・タイトル経験者" : "",
  styleText: member.style?.label ?? "",
  strength: `竜王戦${groupOf(member.rating)}組くらいの強さ`,
})));
const selectedAbility = computed(() => {
  const id = draftId.value ?? hananePick.value?.id;
  const member = props.draftMembers.find((entry) => entry.id === id);
  return member ? memberAbilityView(member) : null;
});
const draftText = computed(() => {
  if (!draftId.value) return `羽音に任せる（${props.draftMembers.find((member) => member.id === hananePick.value?.id)?.name ?? "未定"}）`;
  return props.draftMembers.find((member) => member.id === draftId.value)?.name ?? "";
});
function pickDraft(id: string | null) {
  draftId.value = id;
  if (id === null) draftOpen.value = false;
}

// 設定(研修会と同じ並び)
const settingsOpen = ref(false);
const picker = ref("");
const last = props.career.settings ?? {};
const difficulty = ref(props.defaultDifficulty);
watch(() => props.defaultDifficulty, (next, previous) => {
  if (difficulty.value === previous) difficulty.value = next;
});
const coachLevel = ref(String(last.coachLevel ?? "detailed"));
const hintLimit = ref(Number(last.hintLimit ?? 3));
const undoLimit = ref(Number(last.undoLimit ?? 3));
const byoyomi = ref<number | null>(null);
const byoyomiValue = computed(() => byoyomi.value ?? TEAM_FORMATS[format.value].byoyomi);
const COACH_OPTIONS = [
  { value: "off", label: "なし" },
  { value: "encourage", label: "応援のみ" },
  { value: "detailed", label: "詳しい助言" },
];
const assistText = (value: number) => LEARNING_ASSIST_LIMITS.find((item) => item.value === value)?.label ?? String(value);
const difficultyChoices = computed(() => difficultyOptions(format.value === "school"
  ? {
    stored: props.world, playerLevel: props.userLevel, base: SCHOOL_BASE,
    bottom: { label: "ふつうの学校", rating: SCHOOL_BASE - 60 }, top: { label: "優勝候補", rating: SCHOOL_BASE + 140 },
    recommended: props.recommendedDifficulty ?? props.defaultDifficulty,
  }
  : {
    stored: props.world, playerLevel: props.userLevel, base: WORLD_BASE_RATING,
    bottom: { label: "6組", rating: GROUP_MEAN_RATING[6] }, top: { label: "1組", rating: GROUP_MEAN_RATING[1] },
    recommended: props.recommendedDifficulty ?? props.defaultDifficulty,
  }));
const settingsSummary = computed(() => [
  `難易度 ${difficultyName(difficulty.value)}`,
  `秒読み ${byoyomiLabel(byoyomiValue.value)}`,
].join("・"));
const settingRows = computed(() => [
  { id: "difficulty", label: "難易度", value: difficultyName(difficulty.value), note: difficultyChoices.value.find((option) => option.value === difficulty.value)?.description ?? "" },
  { id: "coach", label: "やこび姫の助言", value: COACH_OPTIONS.find((item) => item.value === coachLevel.value)?.label ?? "", note: "" },
  { id: "assist", label: "閃き・待った", value: `閃き${assistText(hintLimit.value)}・待った${assistText(undoLimit.value)}`, note: "" },
  { id: "byoyomi", label: "秒読みの演出", value: byoyomiLabel(byoyomiValue.value), note: format.value === "pro" ? "早指しの団体戦は30秒がおすすめ" : "" },
]);
const pickerConfig = computed<{ title: string; sections: PickerSection[]; note: string } | null>(() => {
  const single = (title: string, key: string, value: PickerValue, options: { value: PickerValue; label: string; description?: string }[], note = "") => (
    { title, note, sections: [{ key, value, groups: [{ options }] }] }
  );
  switch (picker.value) {
    case "seat":
      return single("自分の席", "seat", userSeat.value, SCHOOL_SEATS.map((label, index) => ({
        value: index,
        label: `${label}${index === RECOMMENDED_SCHOOL_SEAT ? "（羽音に任せる）" : ""}`,
        description: index === 0 ? "相手のいちばん強い人と当たる" : index === 1 ? "主将は羽音、三将は百花" : "百花が副将。相手の三番手と当たる",
      })), "席は実力の順に、大会のあいだ変えない。羽音は残りの上、百花は残りの下に座るよ。");
    case "difficulty":
      return single("難易度", "difficulty", difficulty.value, difficultyChoices.value,
        "数字が大きいほど、相手が強くなるよ。世界は竜王戦・名人戦と同じ。");
    case "coach":
      return single("やこび姫の助言", "coach", coachLevel.value, COACH_OPTIONS);
    case "assist":
      return {
        title: "閃き・待った",
        note: "",
        sections: [
          { key: "hint", label: "閃き", value: hintLimit.value, groups: [{ options: LEARNING_ASSIST_LIMITS.map((item) => ({ value: item.value, label: item.label })) }] },
          { key: "undo", label: "待った", value: undoLimit.value, groups: [{ options: LEARNING_ASSIST_LIMITS.map((item) => ({ value: item.value, label: item.label })) }] },
        ],
      };
    case "byoyomi":
      return single("秒読みの演出", "byoyomi", byoyomiValue.value, BYOYOMI_CHOICES.map((item) => ({ value: item.value, label: item.label })), "0秒になっても負けにはならないよ。");
    default:
      return null;
  }
});
function onPick(key: string, value: PickerValue) {
  if (key === "seat") userSeat.value = Number(value);
  else if (key === "difficulty") difficulty.value = Number(value);
  else if (key === "coach") coachLevel.value = String(value);
  else if (key === "hint") hintLimit.value = Number(value);
  else if (key === "undo") undoLimit.value = Number(value);
  else if (key === "byoyomi") byoyomi.value = Number(value);
  if ((pickerConfig.value?.sections.length ?? 0) <= 1) picker.value = "";
}
function enter() {
  settingsOpen.value = false;
  const pick = format.value === "pro" ? (draftId.value ?? hananePick.value?.id ?? null) : null;
  emit("enter", {
    format: format.value,
    settings: { difficulty: difficulty.value, coachLevel: coachLevel.value, hintLimit: hintLimit.value, undoLimit: undoLimit.value, byoyomi: byoyomiValue.value },
    userSeat: userSeat.value,
    draftPick: pick,
    draftReason: format.value === "pro" && !draftId.value ? hananePick.value?.reason ?? "" : "",
  });
}

// ---- 仲間のステータス(16章)
const statusId = ref("");
const statusMember = computed(() => {
  if (!statusId.value) return null;
  // 大会中は、自分のチーム(16章)も相手の学校の選手(20章)も同じ形のステータス。
  if (props.view) return props.view.members?.[statusId.value] ?? teamPlayerStatus(props.career.current, statusId.value);
  return entryMembers.value.find((member) => member?.id === statusId.value) ?? null;
});
// ---- 学校のシート(20章)。表の学校名から、その学校の3人の札。
const schoolId = ref("");
const schoolCloseEl = ref<HTMLButtonElement | null>(null);
const schoolSheet = computed(() => {
  const run = props.career.current;
  const team = schoolId.value ? run?.teams?.[schoolId.value] : null;
  if (!team) return null;
  const record = run.swiss?.records?.[team.id];
  return {
    id: team.id,
    name: team.name,
    area: team.area ?? "",
    note: record ? `全国予選 ${record.w}勝${record.l}敗` : "",
    members: team.members.map((id: string) => teamPlayerStatus(run, id)).filter(Boolean),
  };
});
watch(schoolSheet, (sheet) => {
  if (sheet) void nextTick(() => schoolCloseEl.value?.focus());
});

// ---- 大会中
/** 表のタブ(段階が進んだら、いまの段階の表を開く)。 */
const tab = ref("qualify");
watch(() => [props.view?.phase, props.view?.stage, props.view?.tables?.current], () => {
  const current = props.view?.tables?.current;
  if (current) tab.value = current;
}, { immediate: true });
const activeTable = computed(() => {
  const tabs = props.view?.tables?.tabs ?? [];
  return tabs.find((item: { id: string }) => item.id === tab.value) ?? tabs[0] ?? null;
});
/** 段階の道の下の小さな言葉。 */
function stageNote(stage: { state: string; label: string }) {
  if (stage.state === "current") return "いまここ";
  if (stage.state === "skipped") return "―";
  return stage.label;
}
const next = computed(() => props.view?.next ?? null);
const scoreMarks = computed(() => {
  const match = next.value;
  if (!match) return [];
  const total = match.need * 2 - 1;
  const marks = [...match.games.filter((game: { result: string | null }) => game.result).map((game: { result: string }) => game.result)];
  while (marks.length < total) marks.push("empty");
  return marks.slice(0, total);
});
const swissRows = computed(() => {
  const table = props.view?.swiss?.table ?? [];
  const mine = table.findIndex((row: { team: { you: boolean } }) => row.team.you);
  // 上の8校と、自分の学校のまわり(大きな順位で恥をかかせない。G:6-2)。
  const shown = table.filter((_: unknown, index: number) => index < 8 || Math.abs(index - mine) <= 1);
  return shown;
});
const runSub = computed(() => {
  const view = props.view;
  if (!view) return "";
  if (view.phase === "done") return view.result?.label ?? "";
  if (view.format === "school" && view.phase === "swiss") return `全国大会 予選${view.swiss.round}回戦・${view.swiss.record.w}勝${view.swiss.record.l}敗`;
  return view.next?.label ?? "";
});
const usedText = (id: string) => {
  const games = (next.value?.games ?? []).filter((game: { us: { id: string } | null }) => game.us?.id === id).length;
  return `${games}/3局`;
};
const runLine = computed(() => {
  const view = props.view;
  if (!view) return "";
  if (view.phase === "done") return view.result?.place === 1 ? "優勝。……3人で取った優勝だね。" : "悔しいけど、いい大会だった。次は勝つから。";
  if (view.draftReason && view.format === "pro" && (next.value?.games ?? []).length === 0 && view.leagues?.[0]?.table?.every((row: { w: number; l: number }) => !row.w && !row.l)) return view.draftReason;
  const match = next.value;
  if (!match) return "";
  if (view.format === "pro") {
    if (match.score.us === match.need - 1 || match.score.them === match.need - 1) return "ここが勝負どころ。君が指すのがいいと思う。";
    return "誰を出すか、局ごとに選べるよ。1人3局まで。";
  }
  const decided = match.games.filter((game: { result: string | null; user: boolean }) => !game.user && game.result);
  if (decided.length) return "仲間の局は、対局の途中で知らせるね。";
  if (view.stage === "district") return "地区大会は、決勝まで行けば県大会。目の前の1局に集中して。";
  if (view.stage === "prefecture") return "県大会は、負けたら終わり。仲間の結果は、君の対局の途中で届くよ。";
  return "仲間の結果は、君の対局の途中で届くよ。目の前の1局に集中して。";
});
const lastNews = computed(() => props.news);

// 顔(羽音と百花は立ち絵の顔、自分はやこび姫のドット絵、ほかは名前の1字)
const faceOf = (member: { id: string; story?: string | null }) => {
  if (member.id === TEAM_HANANE_ID || member.story === "hanane") return faceSrc("hanane");
  if (member.id === TEAM_MOMOKA_ID) return faceSrc("momoka", "wry");
  if (member.id === TEAM_USER_ID) return `${props.assetBaseUrl}/characters/yakobihime-mini.webp?v=4`;
  return "";
};
const faceKind = (member: { id: string }) => (member.id === TEAM_USER_ID ? "sprite" : "portrait");

/** 戻る操作。重ねて開いたものを閉じたら真。 */
function goBack() {
  // 場面のログ・設定・隠した窓を先に閉じ、なければ場面を閉じる(docs/novel-scene-design.mdの4-2)。
  if (sceneId.value) {
    if (!novelEl.value?.goBack()) novelEl.value?.finish();
  }
  else if (finaleView.value && finaleEl.value) finaleEl.value.goBack();
  else if (ceremonyView.value && ceremonyEl.value) ceremonyEl.value.goBack();
  else if (statusId.value) statusId.value = "";
  else if (schoolId.value) schoolId.value = "";
  else if (picker.value) picker.value = "";
  else if (settingsOpen.value) settingsOpen.value = false;
  else if (draftOpen.value) draftOpen.value = false;
  else if (!props.view && entryStep.value === "entry") entryStep.value = "format";
  else return false;
  return true;
}
defineExpose({ goBack });

// 入口のキー(↑↓で形式を選ぶ・Enterで決定・Escで戻る。ストーリー選択と同じ。docs/story-mode-design.mdの3章の4)。
function onEntryKeydown(event: KeyboardEvent) {
  // 仲間のステータスは、大会中でもEscで閉じる。
  if (statusId.value && event.key === "Escape" && !event.defaultPrevented) {
    event.preventDefault();
    statusId.value = "";
    return;
  }
  if (schoolId.value && event.key === "Escape" && !event.defaultPrevented) {
    event.preventDefault();
    schoolId.value = "";
    return;
  }
  if (props.view || sceneId.value || statusId.value || picker.value || settingsOpen.value || draftOpen.value) return;
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
  const target = event.target as HTMLElement | null;
  if (target?.closest?.("input, textarea, select")) return;
  if (entryStep.value === "format" && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
    event.preventDefault();
    format.value = format.value === "school" ? "pro" : "school";
  } else if ((event.key === "Enter" || event.key === " ") && !target?.closest?.("button")) {
    event.preventDefault();
    if (entryStep.value === "format") chooseFormat(format.value);
    else enter();
  } else if (event.key === "Escape") {
    event.preventDefault();
    if (entryStep.value === "entry") entryStep.value = "format";
    else emit("back");
  }
}
onMounted(() => window.addEventListener("keydown", onEntryKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onEntryKeydown));
</script>

<style>
/* 団体戦: 研修会・奨励会の画面の部品(ShogiShoreikai.vue・ShogiTournament.vue)を使い、団体戦だけのものを足す。 */
/* ---- 入口(17章): ストーリー選択と同じ枠。一覧の板は明るいので、中の文字は焦げ茶。 */
.shogi-game .team-battle__entry { display: grid; height: 100%; min-height: 0; }
.shogi-game .team-battle__pick-list { display: grid; gap: inherit; margin: 0; padding: 0; list-style: none; }
.shogi-game .team-battle__entry-body { display: grid; gap: 0.75rem; padding: 0 clamp(0.4rem, 2vw, 1.4rem); color: #3b2a1c; }
.shogi-game .team-battle__entry-goal { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.5rem; margin: 0; font-weight: 800; }
.shogi-game .team-battle__entry-goal small {
  padding: 0.05rem 0.55rem; border-radius: 999px; color: #fff; background: var(--pick-tone, #ec6584); font-size: 0.75rem;
}
.shogi-game .team-battle__entry-team h2 { display: flex; align-items: baseline; gap: 0.6rem; margin: 0 0 0.35rem; font-size: 1.05rem; }
.shogi-game .team-battle__entry-team h2 small { color: #8a6a4c; font-size: 0.75rem; font-weight: 700; }
.shogi-game .team-battle__entry-members { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.5rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .team-battle__entry .team-battle__entry-member {
  display: flex; align-items: center; gap: 0.5rem; width: 100%; min-height: 44px; margin: 0; padding: 0.4rem 0.5rem;
  border: 0.16rem solid var(--pick-tone, #ec6584); border-radius: 0.7rem;
  color: #3b2a1c; background: #fff; box-shadow: 0 0.16rem 0 rgba(120, 70, 30, 0.2);
  font: inherit; text-align: left; cursor: pointer;
}
.shogi-game .team-battle__entry .team-battle__entry-member:not(:disabled):hover { border-color: var(--pick-tone, #ec6584); background: #fff6ec; transform: none; }
.shogi-game .team-battle__entry-member .team-battle__face { width: 2.8rem; height: 2.8rem; flex: none; border-color: var(--pick-tone, #ec6584); }
.shogi-game .team-battle__entry-member-text { display: grid; min-width: 0; line-height: 1.25; }
.shogi-game .team-battle__entry-member-text small { color: var(--pick-tone-deep, #c94a68); font-size: 0.72rem; font-weight: 900; }
.shogi-game .team-battle__entry-member-text strong { overflow: hidden; font-size: 0.95rem; text-overflow: ellipsis; white-space: nowrap; }
.shogi-game .team-battle__entry-member-text em { color: #7a634e; font-size: 0.72rem; font-style: normal; }
.shogi-game .team-battle__entry-row {
  display: flex; align-items: center; justify-content: space-between; gap: 0.6rem;
  padding: 0.45rem 0.7rem; border-radius: 0.7rem; background: #fbf1df;
}
.shogi-game .team-battle__entry-row p { display: grid; gap: 0.1rem; min-width: 0; margin: 0; }
.shogi-game .team-battle__entry-row small { color: #8a6a4c; font-size: 0.72rem; font-weight: 800; }
.shogi-game .team-battle__entry-row span { font-size: 0.92rem; font-weight: 800; }
.shogi-game .team-battle__entry .team-battle__entry-change {
  flex: none; min-height: 44px; margin: 0; padding: 0.3rem 1rem; border: 0.14rem solid var(--pick-tone, #ec6584); border-radius: 999px;
  color: var(--pick-tone-deep, #c94a68); background: #fff; box-shadow: none; font: inherit; font-weight: 900;
}
.shogi-game .team-battle__entry .team-battle__entry-change:not(:disabled):hover { border-color: var(--pick-tone, #ec6584); background: #fff6ec; transform: none; }
/* ---- 大会中: 高校の3つの段階の道(15章の9) */
.shogi-game .team-battle__stages { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.25rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .team-battle__stage {
  position: relative; display: grid; justify-items: center; gap: 0.05rem; padding: 0.3rem 0.4rem 0.3rem 0.9rem;
  color: #cfd8de; background: rgba(43, 70, 91, 0.6);
  clip-path: polygon(0 0, calc(100% - 0.7rem) 0, 100% 50%, calc(100% - 0.7rem) 100%, 0 100%, 0.7rem 50%);
}
.shogi-game .team-battle__stage:first-child { clip-path: polygon(0 0, calc(100% - 0.7rem) 0, 100% 50%, calc(100% - 0.7rem) 100%, 0 100%); padding-left: 0.4rem; }
.shogi-game .team-battle__stage strong { font-size: 0.85rem; }
.shogi-game .team-battle__stage small { min-height: 1em; font-size: 0.7rem; font-weight: 800; }
.shogi-game .team-battle__stage--done { color: #172632; background: var(--amber, #f1a54c); }
.shogi-game .team-battle__stage--current { color: #172632; background: #fffcf4; }
.shogi-game .team-battle__stage--out { color: #fffcf4; background: #6d7c89; }
.shogi-game .team-battle__stage--skipped, .shogi-game .team-battle__stage--next { opacity: 0.7; }
.shogi-game .team-battle__face {
  width: 3.4rem; height: 3.4rem; border-radius: 50%; object-fit: cover; object-position: 50% 4%;
  border: 0.12rem solid rgba(255, 252, 244, 0.7); background: #e9eef1;
}
.shogi-game .team-battle__face--sprite { object-fit: contain; object-position: 50% 0; image-rendering: pixelated; background: #2b465b; }
.shogi-game .team-battle__face--char { display: inline-grid; place-items: center; color: #172632; font-weight: 900; font-size: 1.3rem; }
.shogi-game .team-battle__sprite { image-rendering: pixelated; object-fit: cover; object-position: 50% 0; }
.shogi-game .team-battle__draft { max-height: min(88vh, 46rem); overflow-y: auto; }
.shogi-game .team-battle__auto { justify-self: start; }
.shogi-game .team-battle__candidates { display: grid; grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr)); gap: 0.4rem; margin: 0.5rem 0; padding: 0; list-style: none; }
.shogi-game .team-battle__candidate {
  position: relative; display: grid; gap: 0.1rem; width: 100%; min-height: 44px; padding: 0.45rem 0.6rem; text-align: left;
  border: 0.12rem solid rgba(255, 252, 244, 0.3); border-radius: 0.6rem; color: #fffcf4; background: rgba(43, 70, 91, 0.92); font: inherit; cursor: pointer;
}
.shogi-game .team-battle__candidate small { color: #cfd8de; font-size: 0.72rem; }
.shogi-game .team-battle__candidate--on { border-color: var(--amber, #f1a54c); }
.shogi-game .team-battle__candidate--hanane { box-shadow: inset 0 0 0 0.1rem #86d4a9; }
.shogi-game .team-battle__tag { position: absolute; top: 0.3rem; right: 0.4rem; padding: 0 0.4rem; border-radius: 999px; color: #172632; background: #86d4a9; font-size: 0.66rem; font-weight: 900; }
.shogi-game .team-battle__main { display: grid; align-content: start; gap: 0.6rem; overflow-y: auto; padding: 0.6rem; }
.shogi-game .team-battle__team { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.4rem; }
.shogi-game .team-battle__member {
  display: flex; align-items: center; gap: 0.4rem; min-width: 0; min-height: 44px; margin: 0; padding: 0.35rem;
  border: 0.1rem solid rgba(255, 252, 244, 0.25); border-radius: 0.6rem;
  color: #fffcf4; background: rgba(43, 70, 91, 0.8); box-shadow: none; font: inherit; text-align: left; cursor: pointer;
}
.shogi-game .team-battle__member .team-battle__face { width: 2.4rem; height: 2.4rem; flex: none; }
.shogi-game .team-battle__member--you { box-shadow: inset 0 0 0 0.12rem var(--amber, #f1a54c); }
.shogi-game .team-battle__member-text { display: grid; min-width: 0; }
.shogi-game .team-battle__member-text small { color: var(--amber, #f1a54c); font-size: 0.7rem; font-weight: 900; }
.shogi-game .team-battle__member-text strong { overflow: hidden; font-size: 0.86rem; text-overflow: ellipsis; white-space: nowrap; }
.shogi-game .team-battle__match { padding: 0.55rem 0.7rem; border: 0.12rem solid rgba(255, 252, 244, 0.35); border-radius: 0.8rem; background: rgba(23, 38, 50, 0.85); }
.shogi-game .team-battle__match-head { display: flex; flex-wrap: wrap; gap: 0.2rem 0.6rem; align-items: baseline; margin: 0; }
.shogi-game .team-battle__match-head span { color: var(--amber, #f1a54c); font-size: 0.8rem; font-weight: 900; }
.shogi-game .team-battle__match-head small { color: #cfd8de; font-size: 0.75rem; }
.shogi-game .team-battle__score { display: flex; align-items: center; gap: 0.25rem; margin: 0.35rem 0; }
.shogi-game .team-battle__score b { margin-left: 0.4rem; font-size: 1.05rem; }
.shogi-game .team-battle__pip { width: 0.85rem; height: 0.85rem; border-radius: 50%; border: 0.1rem solid rgba(255, 252, 244, 0.6); }
.shogi-game .team-battle__pip--win { background: #fffcf4; }
.shogi-game .team-battle__pip--loss { background: #172632; border-color: #fffcf4; box-shadow: inset 0 0 0 0.15rem #172632, inset 0 0 0 1rem #8a99a6; }
.shogi-game .team-battle__boards { display: grid; gap: 0.2rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .team-battle__board { display: grid; grid-template-columns: 3.2rem minmax(0, 1fr) 2.4rem minmax(0, 1fr); gap: 0.4rem; align-items: center; padding: 0.2rem 0.3rem; border-radius: 0.4rem; font-size: 0.85rem; }
.shogi-game .team-battle__board small { color: #cfd8de; font-size: 0.7rem; margin-left: 0.2rem; }
.shogi-game .team-battle__board > small:first-child { color: var(--amber, #f1a54c); font-weight: 900; margin: 0; }
.shogi-game .team-battle__board b { text-align: center; }
.shogi-game .team-battle__board--you { background: rgba(241, 165, 76, 0.18); }
/* 相手の名前と表の学校名は押してステータス・学校のシートを開く(20章)。見た目は文字のまま、下線で押せると分かる */
.shogi-game .team-battle__opponent, .shogi-game .team-battle__school-link {
  min-width: 0; min-height: 0; padding: 0; border: 0; border-radius: 0; color: inherit; background: transparent; box-shadow: none;
  font: inherit; text-align: left; text-decoration: underline dotted rgba(255, 252, 244, 0.55); text-underline-offset: 0.2em; cursor: pointer;
}
.shogi-game .team-battle__opponent { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.shogi-game .team-battle__opponent:hover, .shogi-game .team-battle__school-link:hover,
.shogi-game .team-battle__opponent:focus-visible, .shogi-game .team-battle__school-link:focus-visible { color: var(--amber, #f1a54c); transform: none; }
.shogi-game .team-battle__ko-round li .team-battle__school-link:last-child { text-align: right; }
.shogi-game .team-battle__school-sheet { display: grid; gap: 0.5rem; }
.shogi-game .team-battle__school-sheet h2 { display: flex; align-items: baseline; gap: 0.5rem; margin: 0; font-size: 1.15rem; }
.shogi-game .team-battle__school-sheet h2 small { color: #cfd8de; font-size: 0.75rem; }
.shogi-game .team-battle__school-note { margin: 0; color: #cfd8de; font-size: 0.85rem; }
.shogi-game .team-battle__school-members { display: grid; gap: 0.35rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .team-battle__school-member {
  display: flex; align-items: center; gap: 0.6rem; width: 100%; min-height: 3.4rem; padding: 0.35rem 0.6rem;
  border: 0.08rem solid rgba(255, 252, 244, 0.3); border-radius: 0.7rem; color: #fffcf4; background: rgba(43, 70, 91, 0.7);
  font: inherit; text-align: left; cursor: pointer;
}
.shogi-game .team-battle__school-member-text { display: grid; min-width: 0; }
.shogi-game .team-battle__school-member-text small { color: var(--amber, #f1a54c); font-size: 0.72rem; font-weight: 900; }
.shogi-game .team-battle__school-member-text em { color: #cfd8de; font-size: 0.75rem; font-style: normal; }
.shogi-game .team-battle__mark--win { color: #fffcf4; }
.shogi-game .team-battle__mark--loss { color: #8a99a6; }
.shogi-game .team-battle__tabs { display: flex; gap: 0.3rem; }
.shogi-game .team-battle__tabs button { min-height: 40px; padding: 0.2rem 0.9rem; border: 0.1rem solid rgba(255, 252, 244, 0.35); border-radius: 999px; color: #fffcf4; background: transparent; font: inherit; font-size: 0.85rem; font-weight: 800; cursor: pointer; }
.shogi-game .team-battle__tabs button[aria-selected="true"] { color: #172632; background: var(--amber, #f1a54c); border-color: var(--amber, #f1a54c); }
.shogi-game .team-battle__tabs button:disabled { opacity: 0.45; cursor: default; }
.shogi-game .team-battle__table-wrap { min-height: 0; }
.shogi-game .team-battle__table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
.shogi-game .team-battle__table caption { color: var(--amber, #f1a54c); font-weight: 900; text-align: left; padding: 0.2rem 0; }
.shogi-game .team-battle__table th { color: #cfd8de; font-size: 0.72rem; text-align: left; }
.shogi-game .team-battle__table td { padding: 0.18rem 0.3rem; border-top: 0.06rem solid rgba(255, 252, 244, 0.12); }
.shogi-game .team-battle__table td small { color: #cfd8de; font-size: 0.7rem; }
.shogi-game .team-battle__row--you { background: rgba(241, 165, 76, 0.18); font-weight: 800; }
.shogi-game .team-battle__leagues { display: grid; grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr)); gap: 0.5rem; }
.shogi-game .team-battle__ko { display: grid; gap: 0.5rem; }
.shogi-game .team-battle__ko-round h3 { margin: 0 0 0.2rem; color: var(--amber, #f1a54c); font-size: 0.85rem; }
.shogi-game .team-battle__ko-round ul { display: grid; grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); gap: 0.25rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .team-battle__ko-round li { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); gap: 0.3rem; padding: 0.2rem 0.4rem; border-radius: 0.4rem; background: rgba(43, 70, 91, 0.6); font-size: 0.8rem; }
.shogi-game .team-battle__ko-round li span:last-child { text-align: right; }
.shogi-game .team-battle__winner { color: var(--amber, #f1a54c); font-weight: 900; }
.shogi-game .team-battle__champion { margin: 0; color: var(--amber, #f1a54c); font-weight: 900; }
.shogi-game .team-battle__result { display: grid; justify-items: center; gap: 0.2rem; padding: 0.6rem; }
.shogi-game .team-battle__result-label { margin: 0; font-size: 1.8rem; font-weight: 900; }
.shogi-game .team-battle__result-label--win { color: var(--amber, #f1a54c); }
.shogi-game .team-battle__result-team, .shogi-game .team-battle__result-note { margin: 0; color: #cfd8de; }
.shogi-game .team-battle__news { margin: 0; padding: 0.3rem 0.6rem; border-radius: 0.5rem; background: rgba(134, 212, 169, 0.18); font-size: 0.85rem; font-weight: 800; }
.shogi-game .team-battle__choose-head { margin: 0; font-weight: 900; }
.shogi-game .team-battle__choose { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.3rem; }
.shogi-game .team-battle__choose-btn { display: grid; min-height: 44px; }
.shogi-game .team-battle__choose-btn small { font-size: 0.68rem; opacity: 0.8; }
@media (max-width: 520px) {
  .shogi-game .team-battle__face { width: 2.8rem; height: 2.8rem; }
  .shogi-game .team-battle__entry-members { gap: 0.3rem; }
  .shogi-game .team-battle__entry .team-battle__entry-member { flex-direction: column; text-align: center; padding: 0.35rem 0.2rem; }
  .shogi-game .team-battle__entry-member-text { justify-items: center; }
  .shogi-game .team-battle__member { flex-direction: column; text-align: center; }
  .shogi-game .team-battle__member-text strong { font-size: 0.78rem; }
}
</style>
