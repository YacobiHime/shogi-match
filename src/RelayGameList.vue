<template>
  <!--
    対局中継の一覧(docs/tournament-relay-design.mdの7章)。決着した棋士どうしの対局を、注目(羽音・善彦・推し・次の相手)・この回戦・
    区分ごとに並べ、押すと中継を開く。棋士を決めて開いたとき(次の相手の対局)は、その棋士の対局だけを出す。
  -->
  <div class="shogi-tournament__sheet relay-list" role="dialog" aria-modal="true" :aria-label="heading" data-relay-list @click.self="emit('close')">
    <div class="shogi-tournament__sheet-panel shogi-tournament__detail relay-list__panel">
      <h2>{{ heading }}</h2>
      <p class="shogi-tournament__hint">{{ hint }}</p>
      <div v-if="!focusPlayer && sections.length > 1" class="shogi-tournament__tabs relay-list__tabs" role="tablist" aria-label="対局の区分">
        <button
          v-for="section in sections"
          :key="section.id"
          type="button"
          role="tab"
          :aria-selected="section.id === activeSection?.id"
          :data-relay-section="section.id"
          @click="sectionId = section.id"
        >{{ section.label }}<small>{{ section.entries.length }}</small></button>
      </div>
      <ul v-if="shown.length" class="relay-list__rows">
        <li v-for="entry in shown" :key="entry.key">
          <button type="button" class="relay-list__row" :data-relay-entry="entry.key" @click="emit('watch', entry)">
            <span class="relay-list__label">
              {{ entry.label }}
              <i v-if="entry.tags.next" class="relay-list__tag relay-list__tag--next">次の相手</i>
              <i v-if="entry.tags.rival" class="relay-list__tag relay-list__tag--rival">ライバル</i>
              <i v-if="entry.tags.oshi" class="relay-list__tag relay-list__tag--oshi">推し</i>
              <i v-if="seen.includes(entry.key)" class="relay-list__tag relay-list__tag--seen">視聴済み</i>
            </span>
            <span class="relay-list__players">
              <b :class="{ 'relay-list__win': entry.winner === 'black' }">☗{{ entry.black.name }}</b>
              <span aria-hidden="true">対</span>
              <b :class="{ 'relay-list__win': entry.winner === 'white' }">☖{{ entry.white.name }}</b>
            </span>
            <span class="relay-list__meta">{{ metaText(entry) }}</span>
            <span class="relay-list__go" aria-hidden="true">観る ›</span>
          </button>
        </li>
      </ul>
      <p v-else class="shogi-tournament__text">まだ、見られる対局がないよ。回戦が進むと、ここに並ぶよ。</p>
      <div class="shogi-tournament__hud-row">
        <button v-if="focusPlayer" type="button" class="shogi-tournament__sub" data-relay-all @click="emit('all')">すべての対局</button>
        <button type="button" class="shogi-tournament__sub shogi-tournament__sheet-close" data-relay-list-close @click="emit('close')">閉じる</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, type PropType } from "vue";
import { relayGamesOf, relaySections } from "./core/relay-games.mjs";
import { openingLabel } from "./core/relay-commentary.mjs";

const props = defineProps({
  /** 見られる対局(core/relay-games.mjsの項目。新しい順)。 */
  entries: { type: Array as PropType<any[]>, required: true },
  /** 視聴済みの対局の鍵。 */
  seen: { type: Array as PropType<string[]>, default: () => [] },
  /** この棋士の対局だけを出す(次の相手の対局)。 */
  focusId: { type: String, default: "" },
});
const emit = defineEmits<{ watch: [entry: any]; close: []; all: [] }>();

const focusPlayer = computed(() => {
  if (!props.focusId) return null;
  const entry = props.entries.find((item) => item.black?.id === props.focusId || item.white?.id === props.focusId);
  return entry ? (entry.black.id === props.focusId ? entry.black : entry.white) : null;
});
const sections = computed(() => relaySections(props.entries));
const sectionId = ref("");
const activeSection = computed(() => sections.value.find((section) => section.id === sectionId.value) ?? sections.value[0] ?? null);
const shown = computed(() => (props.focusId ? relayGamesOf(props.entries, props.focusId) : activeSection.value?.entries ?? []));
const heading = computed(() => (focusPlayer.value ? `${focusPlayer.value.name}さんの対局` : "対局中継"));
const hint = computed(() => (focusPlayer.value
  ? "この期の対局を、解説つきで見られるよ。得意な戦法や、終盤の指し方を見て、対策を考えよう。"
  : "決着した棋士どうしの対局を、解説と視聴者のコメントつきで見られるよ。"));

function metaText(entry: any) {
  const black = openingLabel(entry.openings?.black);
  const white = openingLabel(entry.openings?.white);
  const opening = black && white ? `${black} 対 ${white}` : black || white || "";
  const winner = entry.winner === "black" ? entry.black.name : entry.white.name;
  return [opening, `${winner}の勝ち`].filter(Boolean).join("・");
}
</script>

<style>
.shogi-game .relay-open { display: grid; gap: 0.1rem; justify-items: center; width: 100%; }
.shogi-game .relay-open small { opacity: 0.75; font-weight: 600; }
.shogi-game .relay-list__panel { display: grid; grid-template-rows: auto auto auto minmax(0, 1fr) auto; max-height: 100%; }
.shogi-game .relay-list__tabs { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.shogi-game .relay-list__tabs button { flex: 1 1 auto; }
.shogi-game .relay-list__tabs small { margin-left: 0.3rem; opacity: 0.7; }
.shogi-game .relay-list__rows { display: grid; gap: 0.4rem; min-height: 0; margin: 0; padding: 0; overflow-y: auto; list-style: none; overscroll-behavior: contain; }
.shogi-game .relay-list__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas: "label go" "players go" "meta go";
  gap: 0.1rem 0.5rem;
  align-items: center;
  width: 100%;
  min-height: 44px;
  padding: 0.45rem 0.6rem;
  border: 1px solid rgba(255, 252, 244, 0.18);
  border-radius: 0.45rem;
  color: #fffcf4;
  background: rgba(255, 252, 244, 0.05);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.shogi-game .relay-list__label { grid-area: label; display: flex; flex-wrap: wrap; gap: 0.3rem; align-items: center; color: #9fb3c8; font-size: 0.8em; font-weight: 700; }
.shogi-game .relay-list__players { grid-area: players; display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: baseline; font-weight: 800; }
.shogi-game .relay-list__players span { color: #9fb3c8; font-size: 0.8em; }
.shogi-game .relay-list__win::after { content: "○"; margin-left: 0.15rem; color: #f1a54c; }
.shogi-game .relay-list__meta { grid-area: meta; color: #c9d6e6; font-size: 0.8em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.shogi-game .relay-list__go { grid-area: go; padding: 0.2rem 0.5rem; border-radius: 0.35rem; color: #172632; background: #f1a54c; font-size: 0.85em; font-weight: 900; }
.shogi-game .relay-list__tag { padding: 0 0.3rem; border-radius: 0.25rem; font-size: 0.85em; font-style: normal; font-weight: 900; }
.shogi-game .relay-list__tag--next { color: #fffcf4; background: #c4604c; }
.shogi-game .relay-list__tag--rival { color: #fffcf4; background: #8a5ad1; }
.shogi-game .relay-list__tag--oshi { color: #172632; background: #d8d0ff; }
.shogi-game .relay-list__tag--seen { color: #172632; background: #9fb3c8; }
</style>
