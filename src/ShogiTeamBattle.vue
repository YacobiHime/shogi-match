<template>
  <!--
    団体戦(docs/team-battle-design.md)。大会の画面(ShogiTournament.vue)の中に出し、研修会・奨励会と同じ部品の見た目を使う。
    入口: 2つの形式の札、オーダー(高校)・ドラフト(プロ)、設定、「出場する」。はじめては羽音に誘われる場面から。
    大会中: チームの3人、次の試合の札、予選の表・トーナメント表。結果: 成績と、終わりの場面。
  -->
  <div class="shoreikai team-battle" data-team-battle>
    <!-- 入口 -->
    <div v-if="screen === 'entry'" class="shogi-tournament__stage shogi-tournament__stage--entry shoreikai__framed" data-team-battle-screen="entry">
      <header class="shogi-tournament__topbar shoreikai__topbar">
        <button type="button" class="shogi-tournament__topbar-back" :aria-label="backLabel" data-team-back @click="emit('back')">
          <span aria-hidden="true">←</span><span class="shogi-tournament__topbar-back-text">{{ backLabel }}</span>
        </button>
        <span class="shogi-tournament__seal" aria-hidden="true">団</span>
        <div class="shogi-tournament__topbar-title">
          <h1 id="shogi-tournament-title">団体戦</h1>
          <p class="shogi-tournament__topbar-sub">{{ careerText }}</p>
        </div>
      </header>
      <div class="shogi-tournament__mapwrap team-battle__mapwrap">
        <div class="team-battle__formats" role="radiogroup" aria-label="出る大会">
          <button
            v-for="item in formatCards"
            :key="item.id"
            type="button"
            role="radio"
            class="team-battle__format"
            :class="{ 'team-battle__format--on': format === item.id }"
            :aria-checked="format === item.id"
            :data-team-format="item.id"
            @click="chooseFormat(item.id)"
          >
            <span class="team-battle__faces" aria-hidden="true">
              <img v-for="face in item.faces" :key="face.who" class="team-battle__face" :class="`team-battle__face--${face.kind}`" :src="face.src" alt="" draggable="false">
            </span>
            <strong>{{ item.name }}</strong>
            <small>{{ item.note }}</small>
            <small v-if="item.best" class="team-battle__best">最高 {{ item.best }}</small>
          </button>
        </div>
      </div>
      <section class="shogi-tournament__hud" aria-label="出場">
        <p class="shogi-tournament__goal-box" data-team-goal><small>目標</small><span>{{ format === "school" ? "3人で、全国の頂点へ" : "早指しの団体戦で優勝する" }}</span></p>
        <p class="shogi-tournament__tip-line shoreikai__tip" data-team-talk>
          <img class="shogi-tournament__tip-face team-battle__sprite" :src="hananeSprite" alt="" draggable="false">
          <span class="shogi-tournament__tip-text">{{ entryLine }}</span>
        </p>
        <div v-if="format === 'school'" class="shogi-tournament__entry-settings">
          <p>
            <small>オーダー（大会のあいだ変えない）</small>
            <span data-team-order>{{ orderText }}</span>
          </p>
          <button type="button" class="shogi-tournament__sub" data-team-order-change @click="picker = 'seat'">変える</button>
        </div>
        <div v-else class="shogi-tournament__entry-settings">
          <p>
            <small>ドラフト（3人目）</small>
            <span data-team-draft>{{ draftText }}</span>
          </p>
          <button type="button" class="shogi-tournament__sub" data-team-draft-open @click="draftOpen = true">選ぶ</button>
        </div>
        <div class="shogi-tournament__entry-settings">
          <p>
            <small>設定</small>
            <span data-team-summary>{{ settingsSummary }}</span>
          </p>
          <button type="button" class="shogi-tournament__sub" data-team-change @click="settingsOpen = true">変える</button>
        </div>
        <button type="button" class="shogi-tournament__start" data-team-enter @click="enter">出場する</button>
      </section>

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

        <!-- チームの3人 -->
        <div class="team-battle__team" data-team-members>
          <div v-for="member in view.team?.members ?? []" :key="member.id" class="team-battle__member" :class="{ 'team-battle__member--you': member.you }">
            <img v-if="faceOf(member)" class="team-battle__face" :class="`team-battle__face--${faceKind(member)}`" :src="faceOf(member)" alt="" draggable="false">
            <span v-else class="team-battle__face team-battle__face--char" aria-hidden="true">{{ member.name.slice(0, 1) }}</span>
            <span class="team-battle__member-text">
              <small v-if="member.seat">{{ member.seat }}</small>
              <strong>{{ member.you ? playerName : member.name }}</strong>
            </span>
          </div>
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
              <span>{{ game.them?.name }}<small v-if="game.them?.dan">{{ game.them.dan }}</small></span>
            </li>
          </ul>
        </div>

        <!-- 進み具合: 予選・トーナメント -->
        <div class="team-battle__tabs" role="tablist" aria-label="表">
          <button type="button" role="tab" :aria-selected="tab === 'qualify'" data-team-tab="qualify" @click="tab = 'qualify'">予選</button>
          <button type="button" role="tab" :aria-selected="tab === 'ko'" :disabled="!view.knockout" data-team-tab="ko" @click="tab = 'ko'">{{ view.format === "school" ? "決勝トーナメント" : "本戦" }}</button>
        </div>
        <div v-if="tab === 'qualify'" class="team-battle__table-wrap" data-team-qualify>
          <table v-if="view.swiss" class="team-battle__table">
            <thead><tr><th>学校</th><th>勝敗</th><th>勝ち局</th><th></th></tr></thead>
            <tbody>
              <tr v-for="row in swissRows" :key="row.team.id" :class="{ 'team-battle__row--you': row.team.you }">
                <td>{{ row.team.name }}<small v-if="row.team.area">（{{ row.team.area }}）</small></td>
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
                  <td>{{ row.team.name }}</td>
                  <td>{{ row.w }}勝{{ row.l }}敗</td>
                  <td>{{ row.gw }}-{{ row.gl }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div v-else-if="view.knockout" class="team-battle__table-wrap team-battle__ko" data-team-ko>
          <section v-for="round in view.knockout.rounds" :key="round.name" class="team-battle__ko-round">
            <h3>{{ round.name }}</h3>
            <ul>
              <li v-for="(match, index) in round.matches" :key="index" :class="{ 'team-battle__row--you': 'bye' in match ? match.bye?.you : match?.us?.you || match?.them?.you }">
                <template v-if="'bye' in match">{{ match.bye?.name }}（不戦勝）</template>
                <template v-else-if="match">
                  <span :class="{ 'team-battle__winner': match.winner === 'us' }">{{ match.us?.name }}</span>
                  <b>{{ match.winner ? `${match.score.us}-${match.score.them}` : "対" }}</b>
                  <span :class="{ 'team-battle__winner': match.winner === 'them' }">{{ match.them?.name }}</span>
                </template>
              </li>
            </ul>
          </section>
          <p v-if="view.knockout.champion" class="team-battle__champion">優勝 {{ view.knockout.champion.name }}</p>
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

    <NovelScene v-if="scene" ref="novelEl" :scene="scene" :asset-base-url="assetBaseUrl" @done="closeScene" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, type PropType } from "vue";
import NovelScene from "./NovelScene.vue";
import PlayerAbilityPanel from "./PlayerAbilityPanel.vue";
import PregamePicker, { type PickerSection, type PickerValue } from "./PregamePicker.vue";
import { MEASURE_PICKER_ACTION } from "./core/skill-estimate.mjs";
import { difficultyName, difficultyOptions } from "./core/tournament-world.mjs";
import { LEARNING_ASSIST_LIMITS } from "./core/learning-setup.mjs";
import { BYOYOMI_CHOICES, byoyomiLabel } from "./core/byoyomi.mjs";
import { memberAbilityView } from "./core/ryuo-book.mjs";
import { GROUP_MEAN_RATING, WORLD_BASE_RATING } from "./core/ryuo-strength.mjs";
import {
  RECOMMENDED_SCHOOL_SEAT, SCHOOL_BASE, SCHOOL_SEATS, TEAM_FORMATS, TEAM_HANANE_ID, TEAM_MOMOKA_ID, TEAM_USER_ID, hananeDraftPick, schoolOrder,
} from "./core/team-battle.mjs";
import { momentScene, portraitUrl, teamScene } from "./core/team-story.mjs";

type Format = "school" | "pro";
type Settings = { difficulty: number; coachLevel: string; hintLimit: number; undoLimit: number; byoyomi: number };
type Career = { invited: { school: boolean; pro: boolean }; history: { format: string; label: string }[]; best: Record<string, { place: number; label: string }>; settings?: Partial<Settings> };

const props = defineProps({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  view: { type: Object as PropType<any>, default: null },
  career: { type: Object as PropType<Career>, required: true },
  /** ドラフトの候補(名簿の棋士。core/team-battle.mjsのdraftCandidates)。 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  draftMembers: { type: Array as PropType<any[]>, default: () => [] },
  /** プレイヤーの能力(羽音に任せるドラフトの理由に使う。対局が少なければnull)。 */
  myAbilities: { type: Object as PropType<Record<string, number> | null>, default: null },
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
const novelEl = ref<{ finish: () => void } | null>(null);
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

/** 大会中の節目の場面(見ていなければ1回だけ)。 */
function momentFor(view: any): string {
  if (!view) return "";
  const seen: string[] = view.seen ?? [];
  const show = (id: string | null) => (id && !seen.includes(id) ? id : "");
  if (view.phase === "done") return show(momentScene(view, "end"));
  if (view.next?.label && /(^|\s)決勝$/.test(view.next.label)) return show(momentScene(view, "final"));
  if (view.phase === "ko") return show(momentScene(view, "knockout"));
  const played = (view.next?.games ?? []).some((game: { result: string | null }) => game.result);
  if (view.format === "school" && view.swiss?.round === 1 && !played) return show(momentScene(view, "start"));
  return "";
}
watch(() => [props.view?.phase, props.view?.next?.id, props.view?.result?.label], () => {
  if (sceneId.value) return;
  const id = momentFor(props.view);
  if (id) sceneId.value = id;
}, { immediate: true });

// ---- 入口
const format = ref<Format>("school");
function chooseFormat(id: Format) {
  format.value = id;
  if (id === "pro" && !props.draftMembers.length) emit("need-roster");
  if (id === "pro" && !props.career.invited?.pro) sceneId.value = "invite-pro";
}
const careerText = computed(() => {
  const best = props.career.best ?? {};
  const parts = (["school", "pro"] as const).filter((id) => best[id]).map((id) => `${TEAM_FORMATS[id].short} ${best[id].label}`);
  return parts.length ? `最高 ${parts.join("・")}` : "羽音と組んで出る大会";
});
const faceSrc = (who: string, face = "neutral") => portraitUrl(props.assetBaseUrl, who, face, { small: true });
const formatCards = computed(() => (["school", "pro"] as const).map((id) => ({
  id,
  name: TEAM_FORMATS[id].name,
  note: TEAM_FORMATS[id].note,
  best: props.career.best?.[id]?.label ?? "",
  faces: id === "school"
    ? [{ who: "hanane", kind: "portrait", src: faceSrc("hanane") }, { who: "momoka", kind: "portrait", src: faceSrc("momoka", "wry") }]
    : [{ who: "hanane", kind: "portrait", src: faceSrc("hanane", "smile") }],
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

// ---- 大会中
const tab = ref<"qualify" | "ko">("qualify");
watch(() => props.view?.phase, (phase) => {
  if (phase === "ko" || phase === "done") tab.value = props.view?.knockout ? "ko" : "qualify";
}, { immediate: true });
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
  if (view.format === "school" && view.phase === "swiss") return `予選${view.swiss.round}回戦・${view.swiss.record.w}勝${view.swiss.record.l}敗`;
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
  return "仲間の結果は、君の対局の途中で届くよ。目の前の1局に集中して。";
});
const lastNews = computed(() => props.news);

// 顔(羽音と百花は立ち絵の顔、ほかは名前の1字)
const faceOf = (member: { id: string; story?: string | null }) => {
  if (member.id === TEAM_HANANE_ID || member.story === "hanane") return faceSrc("hanane");
  if (member.id === TEAM_MOMOKA_ID) return faceSrc("momoka", "wry");
  if (member.id === TEAM_USER_ID) return `${props.assetBaseUrl}/characters/yakobihime-mini.webp?v=4`;
  return "";
};
const faceKind = (member: { id: string }) => (member.id === TEAM_USER_ID ? "sprite" : "portrait");

/** 戻る操作。重ねて開いたものを閉じたら真。 */
function goBack() {
  if (sceneId.value) novelEl.value?.finish();
  else if (picker.value) picker.value = "";
  else if (settingsOpen.value) settingsOpen.value = false;
  else if (draftOpen.value) draftOpen.value = false;
  else return false;
  return true;
}
defineExpose({ goBack });
</script>

<style>
/* 団体戦: 研修会・奨励会の画面の部品(ShogiShoreikai.vue・ShogiTournament.vue)を使い、団体戦だけのものを足す。 */
.shogi-game .team-battle__mapwrap { display: grid; place-items: center; padding: 0.6rem; }
.shogi-game .team-battle__formats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.7rem; width: min(100%, 38rem); }
.shogi-game .team-battle__format {
  display: grid; justify-items: center; gap: 0.25rem; padding: 0.7rem 0.6rem 0.8rem;
  border: 0.14rem solid rgba(255, 252, 244, 0.35); border-radius: 0.9rem;
  color: #fffcf4; background: rgba(43, 70, 91, 0.92); box-shadow: 0 0.25rem 0 rgba(23, 38, 50, 0.85);
  font: inherit; text-align: center; cursor: pointer;
}
.shogi-game .team-battle__format strong { font-size: 1.05rem; }
.shogi-game .team-battle__format small { color: #cfd8de; font-size: 0.74rem; line-height: 1.35; }
.shogi-game .team-battle__format--on { border-color: var(--amber, #f1a54c); background: rgba(70, 92, 112, 0.95); }
.shogi-game .team-battle__best { color: var(--amber, #f1a54c) !important; font-weight: 800; }
.shogi-game .team-battle__faces { display: flex; gap: 0.3rem; justify-content: center; }
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
.shogi-game .team-battle__member { display: flex; align-items: center; gap: 0.4rem; min-width: 0; padding: 0.35rem; border-radius: 0.6rem; background: rgba(43, 70, 91, 0.8); }
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
  .shogi-game .team-battle__formats { grid-template-columns: minmax(0, 1fr); }
  .shogi-game .team-battle__format { grid-template-columns: auto minmax(0, 1fr); justify-items: start; text-align: left; }
  .shogi-game .team-battle__format .team-battle__faces { grid-row: span 3; }
  .shogi-game .team-battle__face { width: 2.8rem; height: 2.8rem; }
  .shogi-game .team-battle__member { flex-direction: column; text-align: center; }
  .shogi-game .team-battle__member-text strong { font-size: 0.78rem; }
}
</style>
