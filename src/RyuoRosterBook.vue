<template>
  <!--
    棋士名鑑(docs/player-world-note-design.mdの3-3)。竜王戦と名人戦(順位戦)の棋士を、顔の判子と肩書きで覚えられるようにする。
    上にタイトル保持者、絞り込み(あなたのまわり・タイトル・竜王戦・順位戦・注目)、1人1行の一覧。押すと、くわしい情報を重ねて開く
    (広い画面では一覧の右に並べる)。閉じると一覧の同じ位置に戻る。
  -->
  <section :class="['shogi-note__card', 'shogi-note__book', { 'shogi-note__book--open': selected }]" aria-labelledby="shogi-note-book" data-note-roster-book>
    <div class="shogi-note__book-main">
      <h2 id="shogi-note-book">棋士名鑑</h2>
      <p v-if="!book" class="shogi-note__hint">竜王戦か名人戦に参加すると、対戦する棋士たちの名鑑ができます。</p>
      <template v-else>
        <h3 class="shogi-note__subhead">タイトル保持者</h3>
        <ul class="shogi-note__book-holders" data-note-book-holders>
          <li v-for="holder in book.holders" :key="holder.title">
            <button
              type="button"
              class="shogi-note__book-holder"
              :disabled="!holder.id || holder.user"
              :data-book-holder="holder.title"
              @click="holder.id && !holder.user && openMember(holder.id)"
            >
              <span :class="['shogi-note__book-seal', `shogi-note__book-seal--${holder.tone}`]" aria-hidden="true">{{ holder.face || "—" }}</span>
              <span class="shogi-note__book-holder-text"><small>{{ holder.title }}</small>{{ holder.name }}</span>
            </button>
          </li>
        </ul>
        <div class="shogi-note__book-filters" role="tablist" aria-label="名鑑の絞り込み">
          <button
            v-for="item in BOOK_FILTERS"
            :key="item.id"
            type="button"
            role="tab"
            :aria-selected="filter === item.id"
            :data-book-filter="item.id"
            @click="filter = item.id"
          >{{ item.label }}</button>
        </div>
        <div v-if="filter === 'ryuo' || filter === 'junni'" class="shogi-note__book-tabs" role="tablist" :aria-label="filter === 'ryuo' ? '竜王戦の組' : '順位戦のクラス'">
          <template v-if="filter === 'ryuo'">
            <button v-for="entry in book.groups" :key="entry.group" type="button" role="tab" :aria-selected="entry.group === group" @click="group = entry.group">{{ entry.group }}組</button>
          </template>
          <template v-else>
            <button v-for="tab in BOOK_JUNNI_TABS" :key="tab.id" type="button" role="tab" :aria-selected="tab.id === junni" :data-book-junni="tab.id" @click="junni = tab.id">{{ tab.label }}</button>
          </template>
        </div>
        <p v-if="filter === 'around' && oshiName" class="shogi-note__hint" data-book-oshi>推しの棋士: <b class="shogi-note__book-oshi-name">★{{ oshiName }}</b>。竜王戦の画面で、やこび姫が様子を知らせるよ。</p>
        <ul v-if="members.length" ref="listEl" class="shogi-note__book-list" role="tabpanel" data-book-list>
          <li v-for="row in members" :key="row.id">
            <button
              type="button"
              :class="['shogi-note__book-row', { 'shogi-note__book-row--selected': selected?.id === row.id }]"
              :data-book-member="row.id"
              @click="openMember(row.id)"
            >
              <span v-if="row.story === 'hanane'" class="shogi-note__book-seal shogi-note__book-seal--face" aria-hidden="true"><img :src="hananeUrl" alt="" draggable="false"></span>
              <span v-else :class="['shogi-note__book-seal', `shogi-note__book-seal--${row.tone}`]" aria-hidden="true">{{ row.face }}</span>
              <span class="shogi-note__book-row-main">
                <span class="shogi-note__book-row-name">
                  <b v-if="row.id === oshiId" class="shogi-note__book-oshi" aria-label="推し">★</b><b v-if="row.story === 'hanane'" class="shogi-note__book-rival" aria-label="ライバル">◆</b>{{ row.name }}
                  <small>{{ row.ryuoHolder ? "竜王" : row.dan }}</small>
                  <em v-if="row.held.length" class="shogi-note__book-crowns">{{ row.held.join("・") }}</em>
                </span>
                <span class="shogi-note__book-row-line">竜王戦 {{ row.ryuoHolder ? "竜王" : `${row.group}組` }}{{ row.junniText ? `・順位戦 ${row.junniText}` : "" }}</span>
              </span>
              <span v-if="row.record" :class="['shogi-note__book-record', { 'shogi-note__book-record--ahead': row.ahead }]" :aria-label="`あなたの${row.record.wins}勝${row.record.losses}敗`">
                {{ row.record.wins }}勝{{ row.record.losses }}敗<small v-if="row.ahead">勝ち越し</small>
              </span>
            </button>
          </li>
        </ul>
        <p v-else class="shogi-note__hint" data-book-empty>{{ emptyText }}</p>
      </template>
    </div>

    <!-- くわしい情報。狭い画面では下から重ねて開き、広い画面では一覧の右に並べる。 -->
    <div v-if="selected" class="shogi-note__book-sheet" role="dialog" aria-modal="true" :aria-label="`${selected.name}のくわしい情報`" data-book-detail @click.self="closeMember">
      <article class="shogi-note__book-detail">
        <header class="shogi-note__book-detail-head">
          <span v-if="selected.story === 'hanane'" class="shogi-note__book-seal shogi-note__book-seal--face shogi-note__book-seal--big" aria-hidden="true"><img :src="hananeUrl" alt="" draggable="false"></span>
          <span v-else :class="['shogi-note__book-seal', 'shogi-note__book-seal--big', `shogi-note__book-seal--${selected.tone}`]" aria-hidden="true">{{ selected.face }}</span>
          <div class="shogi-note__book-detail-title">
            <h3>{{ selected.name }} <small>{{ selected.ryuoHolder ? "竜王" : selected.dan }}</small></h3>
            <p v-if="selected.held.length" class="shogi-note__book-crowns">{{ selected.held.join("・") }}</p>
            <p class="shogi-note__book-catch">{{ selected.catchphrase }}</p>
          </div>
          <button type="button" class="shogi-note__book-close" aria-label="閉じる" data-book-close @click="closeMember">×</button>
        </header>
        <!-- 物語の人物の紹介。 -->
        <p v-if="selected.intro" class="shogi-note__book-intro" data-book-intro><span><small>{{ selected.reading }}</small>{{ selected.intro }}</span></p>
        <dl class="shogi-note__book-places">
          <div><dt>竜王戦</dt><dd>{{ selected.ryuoHolder ? "竜王" : `${selected.group}組` }}</dd></div>
          <div><dt>順位戦</dt><dd>{{ selected.junniText || "—" }}</dd></div>
          <div data-book-vs><dt>あなたと</dt><dd>{{ selected.record ? `${selected.record.wins}勝${selected.record.losses}敗` : "まだ対戦していない" }}</dd></div>
        </dl>
        <p v-if="selected.vsEvents.length" class="shogi-note__book-vs-events" data-book-vs-events>
          <span v-for="entry in selected.vsEvents" :key="entry.event">{{ entry.label }} {{ entry.wins }}勝{{ entry.losses }}敗</span>
        </p>
        <!-- 能力値(レーダーチャートとランク)・特殊能力・戦法の使用率。 -->
        <PlayerAbilityPanel v-if="selected.ability" class="shogi-note__book-ability" :view="selected.ability" />
        <dl class="shogi-note__book-profile">
          <div><dt>立場</dt><dd>{{ selected.kind }}・{{ selected.age }}歳</dd></div>
          <div><dt>得意戦法</dt><dd>{{ selected.repertoire }}</dd></div>
          <div><dt>棋風</dt><dd>{{ selected.style }}</dd></div>
          <div v-if="selected.strengths.length"><dt>得意</dt><dd>{{ selected.strengths.join("・") }}</dd></div>
          <div v-if="selected.weaknesses.length"><dt>苦手</dt><dd>{{ selected.weaknesses.join("・") }}</dd></div>
          <div v-if="selected.titleCounts.length"><dt>タイトル</dt><dd>{{ selected.titleCounts.join("・") }}（通算{{ selected.totalTitles }}期）</dd></div>
          <div v-if="selected.lastSeason"><dt>昨年度</dt><dd>{{ selected.lastSeason }}</dd></div>
          <div v-if="selected.total"><dt>通算</dt><dd>{{ selected.total }}</dd></div>
          <div v-if="selected.stats.blackTotal || selected.stats.whiteTotal" data-book-colors>
            <dt>先手・後手</dt><dd>先手 {{ selected.stats.blackTotal || "—" }}・後手 {{ selected.stats.whiteTotal || "—" }}</dd>
          </div>
          <div v-if="selected.stats.howsTotal.length" data-book-hows><dt>勝ち方</dt><dd>{{ selected.stats.howsTotal.join("・") }}</dd></div>
          <div v-if="selected.stats.bestOpening"><dt>勝率の高い戦法</dt><dd>{{ selected.stats.bestOpening }}</dd></div>
          <div v-if="selected.awards.length"><dt>将棋大賞</dt><dd>{{ selected.awards.join("・") }}</dd></div>
          <div v-if="sharedFormations(selected).length" data-book-shared><dt>あなたも組んだ形</dt><dd>{{ sharedFormations(selected).join("・") }}</dd></div>
        </dl>
        <template v-for="member in [selected]" :key="member.id">
          <button
            type="button"
            class="shogi-note__book-oshi-toggle"
            :aria-pressed="member.id === oshiId"
            :data-oshi-toggle="member.id"
            @click="toggleOshi(member.id)"
          >{{ member.id === oshiId ? "推しをやめる" : "推しにする" }}</button>
        </template>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, type PropType } from "vue";
import PlayerAbilityPanel from "./PlayerAbilityPanel.vue";
import { BOOK_FILTERS, BOOK_JUNNI_TABS, bookMembers, rosterBook } from "./core/ryuo-book.mjs";
import { HANANE_SPRITE } from "./core/ryuo-story.mjs";
import { loadOshi, saveOshi } from "./core/ryuo-oshi.mjs";
import { loadCollection } from "./core/collection.mjs";
import { OPENING_CASTLES, OPENING_STRATEGIES } from "./core/opening-guide.mjs";

type Profile = {
  id: string; name: string; dan: string; kind: string; age: number; group: number; ryuoHolder: boolean; junni: string | null;
  held: string[]; former: string[]; titleCounts: string[]; totalTitles: number; repertoire: string; style: string; catchphrase: string;
  formations: { kind: "strategy" | "castle"; id: string }[];
  strengths: string[]; weaknesses: string[]; lastSeason: string; total: string; awards: string[]; vsUser: string; played: boolean;
  story: string | null; reading: string; intro: string;
  face: string; tone: string; junniClass: string | null; junniPlace: number | null; junniText: string;
  record: { wins: number; losses: number } | null; ahead: boolean; vsEvents: { event: string; label: string; wins: number; losses: number }[];
  rating: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ability: any;
  stats: { blackTotal: string; whiteTotal: string; blackSeason: string; whiteSeason: string; howsTotal: string[]; bestOpening: string };
};
type Book = {
  holders: { title: string; name: string; id: string | null; user: boolean; face: string; tone: string }[];
  awards: { label: string; name: string }[];
  groups: { group: number; members: Profile[] }[];
  season: number;
};

const props = defineProps({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  roster: { type: Object as PropType<any>, default: null },
  /** プレイヤーの竜王戦の組(あなたのまわり・竜王戦の最初の組)。 */
  initialGroup: { type: Number, default: 6 },
  assetBaseUrl: { type: String, default: "." },
});
const hananeUrl = computed(() => `${props.assetBaseUrl}/characters/${HANANE_SPRITE.file}?v=${HANANE_SPRITE.version}`);

const book = computed(() => (props.roster ? rosterBook(props.roster) as Book : null));
const filter = ref("around");
const group = ref(props.initialGroup);
/** プレイヤーの順位戦のクラス(名人戦に出ていなければnull)。順位戦の切り替えの最初のクラスにも使う。 */
const userJunni = computed(() => {
  const world = props.roster?.junni;
  if (!world) return null;
  if (world.holder === "user") return "meijin";
  return (["A", "B1", "B2", "C1", "C2"] as const).find((cls) => world.classes[cls].includes("user")) ?? null;
});
const junni = ref(userJunni.value ?? "C2");
const members = computed<Profile[]>(() => bookMembers(book.value, {
  filter: filter.value, group: group.value, junni: junni.value, userGroup: props.initialGroup, userJunni: userJunni.value, oshiId: oshiId.value,
  userPlace: userJunni.value && userJunni.value !== "meijin" ? (props.roster?.junni?.classes[userJunni.value]?.indexOf("user") ?? -1) + 1 || null : null,
}) as Profile[]);
const emptyText = computed(() => (filter.value === "watch"
  ? "推しにした棋士・ライバル・対戦した棋士が、ここに並ぶよ。"
  : "この絞り込みには、まだ棋士がいません。"));

/** くわしい情報を開いている棋士。閉じたら、一覧の同じ位置に戻る(一覧のスクロールは動かさない)。 */
const selectedId = ref("");
const selected = computed(() => book.value?.groups.flatMap((entry) => entry.members).find((member) => member.id === selectedId.value) ?? null);
const listEl = ref<HTMLElement | null>(null);
function openMember(id: string) {
  selectedId.value = id;
}
function closeMember() {
  const id = selectedId.value;
  selectedId.value = "";
  void nextTick(() => listEl.value?.querySelector<HTMLElement>(`[data-book-member="${id}"]`)?.focus({ preventScroll: true }));
}
/** 戻る操作。くわしい情報を開いていれば閉じて真。 */
function goBack() {
  if (!selectedId.value) return false;
  closeMember();
  return true;
}
defineExpose({ goBack });

/** 推しの棋士(1人)。端末に保存し、竜王戦の画面でやこび姫が様子を知らせる(core/ryuo-oshi.mjs)。 */
const storage = (() => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
})();
const oshiId = ref(loadOshi(storage));
const oshiName = computed(() => (oshiId.value ? props.roster?.players?.[oshiId.value]?.name ?? "" : ""));
/** 棋士の得意な形のうち、プレイヤーも対局で組んだことのあるもの(コレクションとのつながり)。 */
const collectedLabels = new Set(Object.keys(loadCollection(storage).formations));
function sharedFormations(member: Profile) {
  return member.formations
    .map(({ kind, id }) => (kind === "strategy" ? OPENING_STRATEGIES : OPENING_CASTLES).find((entry: { id: string }) => entry.id === id)?.label ?? "")
    .filter((label: string) => label && collectedLabels.has(label));
}
function toggleOshi(id: string) {
  oshiId.value = oshiId.value === id ? "" : id;
  saveOshi(storage, oshiId.value);
}
</script>

<style>
.shogi-game .shogi-note__book-main { display: grid; align-content: start; gap: 0.75rem; min-width: 0; }
/* タイトル保持者: 顔の判子と肩書き。押すと、その棋士のくわしい情報。 */
.shogi-game .shogi-note__book-holders {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.shogi-game .shogi-note__book-holder {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  min-height: 48px;
  padding: 0.3rem 0.5rem;
  border: 0;
  border-radius: 0.3rem;
  color: inherit;
  background: var(--note-deep);
  box-shadow: none;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.shogi-game .shogi-note__book-holder:disabled { cursor: default; opacity: 1; }
.shogi-game .shogi-note__book-holder-text { display: grid; min-width: 0; font-weight: 800; overflow-wrap: anywhere; }
.shogi-game .shogi-note__book-holder-text small { color: var(--note-gold); font-size: 0.75em; }
/* 顔の判子。名前の1文字、色は棋風(攻めは朱、受けは青、そのほかは金。大会の画面の次の相手の顔と同じ)。 */
.shogi-game .shogi-note__book-seal {
  flex: none;
  display: grid;
  place-items: center;
  width: 2.3rem;
  height: 2.3rem;
  overflow: hidden;
  border: 2px solid #fffcf4;
  border-radius: 0.3rem;
  color: #fffcf4;
  background: #5d6f80;
  font-family: var(--note-mincho);
  font-size: 1.1rem;
  font-weight: 900;
}
.shogi-game .shogi-note__book-seal--attack { background: #c4604c; }
.shogi-game .shogi-note__book-seal--defense { background: #3d6fa5; }
.shogi-game .shogi-note__book-seal--balance { color: #172632; background: #d9b860; }
.shogi-game .shogi-note__book-seal--user { color: #172632; background: #fffcf4; }
.shogi-game .shogi-note__book-seal--face { align-items: start; background: #2b3d55; }
.shogi-game .shogi-note__book-seal--face img { width: 100%; height: auto; image-rendering: pixelated; }
.shogi-game .shogi-note__book-seal--big { width: 3.4rem; height: 3.4rem; font-size: 1.6rem; }
/* 絞り込み。 */
.shogi-game .shogi-note__book-filters { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.shogi-game .shogi-note__book-filters button,
.shogi-game .shogi-note__book-tabs button {
  min-height: var(--note-control);
  min-width: 3.4rem;
  padding: 0 0.8rem;
  border: 2px solid #3b5570;
  border-radius: 999px;
  color: inherit;
  background: var(--note-deep);
  box-shadow: none;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}
.shogi-game .shogi-note__book-tabs { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.shogi-game .shogi-note__book-tabs button { border-radius: 0.3rem; font-size: 0.88em; }
.shogi-game .shogi-note__book-filters button[aria-selected="true"],
.shogi-game .shogi-note__book-tabs button[aria-selected="true"] { border-color: var(--note-gold); color: #172632; background: var(--note-gold); }
/* 一覧: 1人1行。左に顔、真ん中に名前と1行、右にあなたとの対戦成績。 */
.shogi-game .shogi-note__book-list { display: grid; gap: 0.3rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .shogi-note__book-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  min-height: 56px;
  padding: 0.35rem 0.6rem;
  border: 2px solid transparent;
  border-radius: 0.3rem;
  color: inherit;
  background: var(--note-deep);
  box-shadow: none;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.shogi-game .shogi-note__book-row--selected { border-color: var(--note-gold); }
.shogi-game .shogi-note__book-row-main { display: grid; flex: 1; gap: 0.1rem; min-width: 0; }
.shogi-game .shogi-note__book-row-name { overflow: hidden; font-family: var(--note-mincho); font-size: 1.02em; font-weight: 800; text-overflow: ellipsis; white-space: nowrap; }
.shogi-game .shogi-note__book-row-name small { margin-left: 0.3em; color: rgba(255, 252, 244, 0.7); font-family: inherit; font-size: 0.8em; }
.shogi-game .shogi-note__book-row-name em { margin-left: 0.4em; font-style: normal; }
.shogi-game .shogi-note__book-row-line { overflow: hidden; color: rgba(255, 252, 244, 0.7); font-size: 0.78em; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.shogi-game .shogi-note__book-record { flex: none; display: grid; justify-items: end; color: rgba(255, 252, 244, 0.85); font-size: 0.85em; font-weight: 800; }
.shogi-game .shogi-note__book-record small { color: var(--note-gold); font-size: 0.8em; }
.shogi-game .shogi-note__book-record--ahead { color: var(--note-gold); }
.shogi-game .shogi-note__book-crowns { color: var(--note-gold); font-size: 0.85em; font-weight: 800; }
.shogi-game .shogi-note__book-rival { margin-right: 0.15rem; color: #d4a93a; }
.shogi-game .shogi-note__book-oshi { margin-right: 0.2em; color: var(--note-gold); }
.shogi-game .shogi-note__book-oshi-name { color: var(--note-gold); }
/* くわしい情報: 狭い画面では下から重ねる。 */
.shogi-game .shogi-note__book-sheet {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  align-items: end;
  justify-items: center;
  padding: max(0.8rem, env(safe-area-inset-top)) 0 0;
  background: rgba(10, 18, 26, 0.72);
}
.shogi-game .shogi-note__book-detail {
  box-sizing: border-box;
  display: grid;
  align-content: start;
  gap: 0.6rem;
  width: min(100%, 40rem);
  max-height: 100%;
  overflow-y: auto;
  padding: 0.9rem 1rem max(1rem, env(safe-area-inset-bottom));
  border: 2px solid var(--note-lavender);
  border-bottom: 0;
  border-radius: 0.8rem 0.8rem 0 0;
  background: var(--note-panel);
}
.shogi-game .shogi-note__book-detail-head { display: flex; align-items: center; gap: 0.7rem; }
.shogi-game .shogi-note__book-detail-title { flex: 1; min-width: 0; }
.shogi-game .shogi-note__book-detail-title h3 { margin: 0; font-family: var(--note-mincho); font-size: 1.25em; }
.shogi-game .shogi-note__book-detail-title h3 small { margin-left: 0.3em; color: rgba(255, 252, 244, 0.7); font-size: 0.7em; }
.shogi-game .shogi-note__book-detail-title p { margin: 0.1rem 0 0; }
.shogi-game .shogi-note__book-catch { color: rgba(255, 252, 244, 0.75); font-size: 0.82em; }
.shogi-game .shogi-note__book-close {
  flex: none;
  width: 44px;
  height: 44px;
  border: 2px solid rgba(255, 252, 244, 0.4);
  border-radius: 50%;
  color: inherit;
  background: transparent;
  box-shadow: none;
  font: inherit;
  font-size: 1.2rem;
  cursor: pointer;
}
.shogi-game .shogi-note__book-places { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.35rem; margin: 0; }
.shogi-game .shogi-note__book-places > div { display: grid; gap: 0.1rem; padding: 0.35rem 0.5rem; border-radius: 0.3rem; background: var(--note-deep); }
.shogi-game .shogi-note__book-places dt { color: var(--note-gold); font-size: 0.75em; font-weight: 800; }
.shogi-game .shogi-note__book-places dd { margin: 0; font-weight: 800; font-size: 0.92em; overflow-wrap: anywhere; }
.shogi-game .shogi-note__book-vs-events { display: flex; flex-wrap: wrap; gap: 0.3rem 0.8rem; margin: 0; color: rgba(255, 252, 244, 0.8); font-size: 0.82em; font-weight: 700; }
.shogi-game .shogi-note__book-intro { display: flex; gap: 0.7rem; align-items: flex-start; margin: 0; line-height: 1.6; }
.shogi-game .shogi-note__book-intro small { display: block; opacity: 0.75; }
.shogi-game .shogi-note__book-oshi-toggle {
  justify-self: start;
  min-height: 44px;
  padding: 0.35rem 1rem;
  border: 2px solid var(--note-gold);
  border-radius: 0.4rem;
  color: var(--note-gold);
  background: transparent;
  box-shadow: none;
  font: inherit;
  font-size: 0.9em;
  font-weight: 800;
  cursor: pointer;
}
.shogi-game .shogi-note__book-oshi-toggle[aria-pressed="true"] { color: #172632; background: var(--note-gold); }
.shogi-game .shogi-note__book-ability { padding: 0.6rem; border-radius: 0.3rem; background: rgba(255, 252, 244, 0.05); }
.shogi-game .shogi-note__book-profile { display: grid; gap: 0.3rem; margin: 0; }
.shogi-game .shogi-note__book-profile > div { display: grid; grid-template-columns: 6.5em minmax(0, 1fr); gap: 0.5rem; }
.shogi-game .shogi-note__book-profile dt { color: rgba(255, 252, 244, 0.65); font-size: 0.82em; font-weight: 700; }
.shogi-game .shogi-note__book-profile dd { margin: 0; font-size: 0.9em; overflow-wrap: anywhere; }
/* 広い画面: 一覧の右に、くわしい情報を並べる(重ねない)。 */
@media (min-width: 1100px) {
  .shogi-game .shogi-note__book.shogi-note__book--open { display: grid; grid-template-columns: minmax(0, 1fr) minmax(20rem, 26rem); gap: 1rem; align-items: start; }
  .shogi-game .shogi-note__book-main { display: grid; gap: inherit; min-width: 0; }
  .shogi-game .shogi-note__book-sheet { position: sticky; top: 0; inset: auto; z-index: auto; display: block; padding: 0; background: none; }
  .shogi-game .shogi-note__book-detail { width: 100%; max-height: calc(100dvh - 9rem); border: 2px solid var(--note-lavender); border-radius: 0.5rem; }
}
</style>
