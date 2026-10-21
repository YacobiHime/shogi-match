<template>
  <section class="shogi-note__card shogi-note__book" aria-labelledby="shogi-note-book" data-note-roster-book>
    <h2 id="shogi-note-book">棋士名鑑</h2>
    <p v-if="!book" class="shogi-note__hint">竜王戦に参加すると、対戦する棋士たちの名鑑ができます。</p>
    <template v-else>
      <p class="shogi-note__hint" data-book-oshi>
        <template v-if="oshiName">推しの棋士: <b class="shogi-note__book-oshi-name">★{{ oshiName }}</b>。竜王戦の画面で、やこび姫が様子を知らせるよ。</template>
        <template v-else>棋士を開いて「推しにする」を押すと、竜王戦の画面で、やこび姫がその棋士の様子を知らせるよ。</template>
      </p>
      <h3 class="shogi-note__subhead">タイトル保持者</h3>
      <dl class="shogi-note__book-holders" data-note-book-holders>
        <div v-for="holder in book.holders" :key="holder.title"><dt>{{ holder.title }}</dt><dd>{{ holder.name }}</dd></div>
      </dl>
      <template v-if="book.awards.length">
        <h3 class="shogi-note__subhead">将棋大賞（第{{ book.season }}期）</h3>
        <dl class="shogi-note__book-holders shogi-note__book-awards">
          <div v-for="award in book.awards" :key="award.label"><dt>{{ award.label }}</dt><dd>{{ award.name }}</dd></div>
        </dl>
      </template>
      <div class="shogi-note__book-tabs" role="tablist" aria-label="竜王戦の組">
        <button
          v-for="entry in book.groups"
          :key="entry.group"
          type="button"
          role="tab"
          :aria-selected="entry.group === group"
          @click="group = entry.group"
        >{{ entry.group }}組</button>
      </div>
      <ul class="shogi-note__book-list" role="tabpanel">
        <li v-for="member in members" :key="member.id">
          <details :data-book-member="member.id" @toggle="onToggle(member.id, $event)">
            <summary>
              <span class="shogi-note__book-name"><b v-if="member.id === oshiId" class="shogi-note__book-oshi" aria-label="推し">★</b><b v-if="member.story === 'hanane'" class="shogi-note__book-rival" aria-label="ライバル">◆</b>{{ member.name }}</span>
              <span class="shogi-note__book-dan">{{ member.ryuoHolder ? "竜王" : member.dan }}</span>
              <span v-if="member.held.length" class="shogi-note__book-crowns">{{ member.held.join("・") }}</span>
              <span v-if="member.played" class="shogi-note__book-played">対戦あり</span>
              <span class="shogi-note__book-catch">{{ member.catchphrase }}</span>
            </summary>
            <!-- 物語の人物の紹介。羽音は、ドット絵(胸から上)を添える。 -->
            <p v-if="member.intro" class="shogi-note__book-intro" data-book-intro>
              <span v-if="member.story === 'hanane'" class="shogi-note__book-face" aria-hidden="true">
                <img :src="hananeUrl" alt="" draggable="false">
              </span>
              <span><small>{{ member.reading }}</small>{{ member.intro }}</span>
            </p>
            <!-- 能力値(レーダーチャートとランク)・特殊能力・戦法の使用率。開いたときだけ描く(1つの組に数十人いるため)。 -->
            <PlayerAbilityPanel v-if="member.ability && openIds.has(member.id)" class="shogi-note__book-ability" :view="member.ability" />
            <dl class="shogi-note__book-profile">
              <div><dt>立場</dt><dd>{{ member.kind }}・{{ member.age }}歳{{ member.junni ? `・${member.junni}` : "" }}</dd></div>
              <div><dt>得意戦法</dt><dd>{{ member.repertoire }}</dd></div>
              <div><dt>棋風</dt><dd>{{ member.style }}</dd></div>
              <div v-if="member.strengths.length"><dt>得意</dt><dd>{{ member.strengths.join("・") }}</dd></div>
              <div v-if="member.weaknesses.length"><dt>苦手</dt><dd>{{ member.weaknesses.join("・") }}</dd></div>
              <div v-if="member.titleCounts.length"><dt>タイトル</dt><dd>{{ member.titleCounts.join("・") }}（通算{{ member.totalTitles }}期）</dd></div>
              <div v-if="member.lastSeason"><dt>昨年度</dt><dd>{{ member.lastSeason }}</dd></div>
              <div v-if="member.total"><dt>通算</dt><dd>{{ member.total }}</dd></div>
              <div v-if="member.stats.blackTotal || member.stats.whiteTotal" data-book-colors>
                <dt>先手・後手</dt><dd>先手 {{ member.stats.blackTotal || "—" }}・後手 {{ member.stats.whiteTotal || "—" }}</dd>
              </div>
              <div v-if="member.stats.howsTotal.length" data-book-hows><dt>勝ち方</dt><dd>{{ member.stats.howsTotal.join("・") }}</dd></div>
              <div v-if="member.stats.bestOpening"><dt>勝率の高い戦法</dt><dd>{{ member.stats.bestOpening }}</dd></div>
              <div v-if="member.awards.length"><dt>将棋大賞</dt><dd>{{ member.awards.join("・") }}</dd></div>
              <div><dt>対戦成績</dt><dd>{{ member.vsUser }}</dd></div>
              <div v-if="sharedFormations(member).length" data-book-shared><dt>あなたも組んだ形</dt><dd>{{ sharedFormations(member).join("・") }}</dd></div>
            </dl>
            <button
              type="button"
              class="shogi-note__book-oshi-toggle"
              :aria-pressed="member.id === oshiId"
              :data-oshi-toggle="member.id"
              @click="toggleOshi(member.id)"
            >{{ member.id === oshiId ? "推しをやめる" : "推しにする" }}</button>
          </details>
        </li>
      </ul>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, type PropType } from "vue";
import PlayerAbilityPanel from "./PlayerAbilityPanel.vue";
import { rosterBook } from "./core/ryuo-book.mjs";
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ability: any;
  stats: { blackTotal: string; whiteTotal: string; blackSeason: string; whiteSeason: string; howsTotal: string[]; bestOpening: string };
};
type Book = {
  holders: { title: string; name: string }[];
  awards: { label: string; name: string }[];
  groups: { group: number; members: Profile[] }[];
  season: number;
};

const props = defineProps({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  roster: { type: Object as PropType<any>, default: null },
  /** 最初に開く組(プレイヤーのいる組)。 */
  initialGroup: { type: Number, default: 6 },
  assetBaseUrl: { type: String, default: "." },
});
const hananeUrl = computed(() => `${props.assetBaseUrl}/characters/${HANANE_SPRITE.file}?v=${HANANE_SPRITE.version}`);

const book = computed(() => (props.roster ? rosterBook(props.roster) as Book : null));
const group = ref(props.initialGroup);
const members = computed(() => book.value?.groups.find((entry) => entry.group === group.value)?.members ?? []);
/** 開いている棋士。能力のレーダーチャートは、開いたときだけ描く。 */
const openIds = ref(new Set<string>());
function onToggle(id: string, event: Event) {
  const next = new Set(openIds.value);
  if ((event.target as HTMLDetailsElement).open) next.add(id);
  else next.delete(id);
  openIds.value = next;
}

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
.shogi-game .shogi-note__book-holders {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
  gap: 0.4rem;
  margin: 0;
}
.shogi-game .shogi-note__book-holders > div {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
  padding: 0.4rem 0.6rem;
  border-radius: 0.15rem;
  background: var(--note-deep);
}
.shogi-game .shogi-note__book-holders dt { color: var(--note-gold); font-size: 0.78em; font-weight: 700; }
.shogi-game .shogi-note__book-holders dd { margin: 0; font-weight: 700; overflow-wrap: anywhere; }
.shogi-game .shogi-note__book-awards dt { color: var(--note-lavender); }
.shogi-game .shogi-note__book-tabs { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.shogi-game .shogi-note__book-tabs button {
  min-height: var(--note-control);
  min-width: 3.4rem;
  padding: 0 0.8rem;
  border: 2px solid #3b5570;
  border-radius: 0.15rem;
  color: inherit;
  background: var(--note-deep);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.shogi-game .shogi-note__book-tabs button[aria-selected="true"] { border-color: var(--note-gold); color: #172632; background: var(--note-gold); }
.shogi-game .shogi-note__book-list { display: grid; gap: 0.35rem; max-height: 28rem; margin: 0; padding: 0; overflow-y: auto; list-style: none; }
.shogi-game .shogi-note__book-rival { margin-right: 0.15rem; color: #d4a93a; }
.shogi-game .shogi-note__book-intro { display: flex; gap: 0.7rem; align-items: flex-start; margin: 0.4rem 0.6rem; line-height: 1.6; }
.shogi-game .shogi-note__book-intro small { display: block; opacity: 0.75; }
/* 胸から上(上の4割)。1ドットを2px前後にする。 */
.shogi-game .shogi-note__book-face { flex: none; height: 4.8rem; overflow: hidden; }
.shogi-game .shogi-note__book-face img { display: block; height: 12rem; width: auto; image-rendering: pixelated; }
.shogi-game .shogi-note__book-list details { border-radius: 0.15rem; background: var(--note-deep); }
.shogi-game .shogi-note__book-list summary {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.2rem 0.7rem;
  min-height: var(--note-control);
  box-sizing: border-box;
  padding: 0.55rem 0.7rem;
  cursor: pointer;
}
.shogi-game .shogi-note__book-name { font-family: var(--note-mincho); font-size: 1.05em; font-weight: 700; }
.shogi-game .shogi-note__book-dan { color: rgba(255, 252, 244, 0.75); font-size: 0.85em; }
.shogi-game .shogi-note__book-crowns { color: var(--note-gold); font-size: 0.85em; font-weight: 700; }
.shogi-game .shogi-note__book-played { margin-left: auto; color: var(--note-lavender); font-size: 0.75em; font-weight: 700; }
.shogi-game .shogi-note__book-catch { flex-basis: 100%; color: rgba(255, 252, 244, 0.7); font-size: 0.78em; }
.shogi-game .shogi-note__book-oshi { margin-right: 0.2em; color: var(--note-gold); }
.shogi-game .shogi-note__book-oshi-name { color: var(--note-gold); }
.shogi-game .shogi-note__book-oshi-toggle {
  min-height: 0;
  margin: 0 0.7rem 0.7rem;
  padding: 0.35rem 0.9rem;
  border: 2px solid var(--note-gold);
  border-radius: 0.4rem;
  color: var(--note-gold);
  background: transparent;
  font: inherit;
  font-size: 0.85em;
  font-weight: 800;
  cursor: pointer;
}
.shogi-game .shogi-note__book-oshi-toggle[aria-pressed="true"] { color: #172632; background: var(--note-gold); }
.shogi-game .shogi-note__book-ability { margin: 0.2rem 0.7rem 0.7rem; padding: 0.6rem; border-radius: 0.3rem; background: rgba(255, 252, 244, 0.05); }
.shogi-game .shogi-note__book-profile { display: grid; gap: 0.3rem; margin: 0; padding: 0 0.7rem 0.7rem; }
.shogi-game .shogi-note__book-profile > div { display: grid; grid-template-columns: 6.5em minmax(0, 1fr); gap: 0.5rem; }
.shogi-game .shogi-note__book-profile dt { color: rgba(255, 252, 244, 0.65); font-size: 0.82em; font-weight: 700; }
.shogi-game .shogi-note__book-profile dd { margin: 0; font-size: 0.9em; overflow-wrap: anywhere; }
</style>
