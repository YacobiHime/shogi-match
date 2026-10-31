<template>
  <!--
    自分の宮殿を作る(docs/brain-training-design.mdの11-6のステップ1)。場所の種類を選び、カードの束から、
    自分の場所に本当にあるものを歩く順番に押して並べる。並べたカードは押すと、名前を変える・前後に動かす・消す(取り消せる)。
    10か所でできあがり。変えるたびに保存するので、途中でやめても続きから作れる。
  -->
  <section class="brain-game brain-builder" aria-label="宮殿づくり" data-brain-builder>
    <!-- 宮殿の一覧 -->
    <template v-if="phase === 'list'">
      <p class="brain-game__prompt">{{ palaces.length ? "自分の宮殿" : "よく知っている場所で、自分の宮殿を作ろう。" }}</p>
      <ul class="brain-builder__palaces">
        <li v-for="palace in palaces" :key="palace.id">
          <button type="button" class="shogi-brain__card" :data-builder-palace="palace.id" @click="openPalace(palace.id)">
            <strong>{{ placeEmoji(palace.place) }} {{ palace.name }}</strong>
            <small>{{ palace.loci.length }}か所{{ palaceReady(palace) ? "" : `（あと${LOCI_READY - palace.loci.length}か所でできあがり）` }}</small>
            <span class="shogi-brain__card-best">{{ palaceReady(palace) ? "使える" : "作りかけ" }}</span>
          </button>
        </li>
      </ul>
      <div class="brain-game__actions">
        <button v-if="palaces.length < PALACE_MAX" type="button" class="brain-game__primary" data-builder-new @click="phase = 'place'">新しい宮殿を作る</button>
        <button
          type="button"
          class="brain-game__secondary"
          :aria-pressed="sample"
          data-builder-sample
          @click="toggleSample"
        >{{ sample ? "✓ 見本の宮殿（お城）も使う" : "見本の宮殿（お城）を使う" }}</button>
      </div>
      <p class="brain-builder__note">宮殿は{{ PALACE_MAX }}つまで。いくつかあると、交互に使えて混ざりにくいよ。</p>
    </template>

    <!-- 場所の種類 -->
    <template v-else-if="phase === 'place'">
      <p class="brain-game__prompt">どこで宮殿を作る？</p>
      <ul class="brain-builder__places">
        <li v-for="kind in PLACE_KINDS" :key="kind.id">
          <button type="button" class="shogi-brain__card" :data-builder-place="kind.id" @click="startPalace(kind.id)">
            <strong><span aria-hidden="true">{{ kind.emoji }}</span> {{ kind.label }}</strong>
            <small>{{ kind.hint }}</small>
          </button>
        </li>
      </ul>
    </template>

    <!-- カードを並べる -->
    <template v-else-if="phase === 'cards' && working">
      <p class="brain-game__status">
        <span>{{ working.name }}</span>
        <span>{{ working.loci.length }}か所{{ working.loci.length < LOCI_READY ? ` / ${LOCI_READY}` : "" }}</span>
      </p>
      <ol class="brain-builder__route" aria-label="並べた場所（歩く順）" data-builder-route>
        <li v-for="(locus, index) in working.loci" :key="`${index}-${locus.name}`">
          <button
            type="button"
            class="brain-builder__locus"
            :class="{ 'brain-builder__locus--similar': similarAt.includes(index) }"
            :aria-label="`${index + 1}番目 ${locus.name}。押すと直せる`"
            :data-builder-locus="index"
            @click="openEdit(index)"
          ><small>{{ index + 1 }}</small><span aria-hidden="true">{{ locus.emoji }}</span>{{ locus.name }}</button>
        </li>
        <li v-if="!working.loci.length" class="brain-builder__route-empty">下のカードを、歩く順番に押してね</li>
      </ol>
      <p class="brain-builder__say" aria-live="polite">{{ sayLine }}</p>
      <ul class="brain-builder__tips">
        <li v-for="tip in PALACE_TIPS" :key="tip">{{ tip }}</li>
      </ul>
      <ul class="brain-builder__deck" aria-label="場所カードの束" data-builder-deck>
        <li>
          <button type="button" class="brain-builder__card brain-builder__card--write" data-builder-write @click="openWrite">
            <span aria-hidden="true">✏️</span>カードを書く
          </button>
        </li>
        <li v-for="card in deck" :key="card.name">
          <button
            type="button"
            class="brain-builder__card"
            :class="{ 'brain-builder__card--used': usedNames.has(card.name) }"
            :disabled="working.loci.length >= LOCI_MAX"
            :data-builder-card="card.name"
            @click="add(card)"
          ><span aria-hidden="true">{{ card.emoji }}</span>{{ card.name }}<small v-if="usedNames.has(card.name)">✓</small></button>
        </li>
      </ul>
      <div class="brain-game__actions">
        <button type="button" class="brain-game__primary" :disabled="!palaceReady(working)" data-builder-done @click="toName">
          {{ palaceReady(working) ? "できあがり" : `あと${LOCI_READY - working.loci.length}か所` }}
        </button>
        <button type="button" class="brain-game__secondary" data-builder-later @click="phase = 'list'">一覧へ</button>
      </div>
    </template>

    <!-- 名前を付ける -->
    <template v-else-if="phase === 'name' && working">
      <p class="brain-game__prompt">{{ working.loci.length }}か所の宮殿ができたよ！ 名前を付けよう。</p>
      <label class="brain-builder__field">
        <span>宮殿の名前</span>
        <input v-model="nameDraft" type="text" :maxlength="PALACE_NAME_MAX" data-builder-name>
      </label>
      <ol class="brain-builder__route brain-builder__route--final">
        <li v-for="(locus, index) in working.loci" :key="index"><span class="brain-builder__locus"><small>{{ index + 1 }}</small><span aria-hidden="true">{{ locus.emoji }}</span>{{ locus.name }}</span></li>
      </ol>
      <div class="brain-game__actions">
        <button type="button" class="brain-game__primary" data-builder-finish @click="finishName">この名前にする</button>
        <button type="button" class="brain-game__secondary" @click="phase = 'cards'">場所を足す</button>
      </div>
      <button type="button" class="brain-builder__remove" data-builder-remove-palace @click="deletePalace">この宮殿を消す</button>
    </template>

    <!-- 場所を直すシート -->
    <div v-if="editIndex !== null && working?.loci[editIndex]" class="brain-builder__sheet" role="dialog" aria-modal="true" aria-label="場所を直す" data-builder-edit>
      <p class="brain-game__prompt">{{ editIndex + 1 }}番目の場所</p>
      <label class="brain-builder__field">
        <span>自分の呼び方</span>
        <input v-model="editName" type="text" :maxlength="LOCUS_NAME_MAX" data-builder-edit-name @keydown.enter="saveEdit">
      </label>
      <div class="brain-builder__moves">
        <button type="button" class="brain-game__secondary" :disabled="editIndex === 0" data-builder-up @click="shift(-1)">← 前へ</button>
        <button type="button" class="brain-game__secondary" :disabled="editIndex >= working.loci.length - 1" data-builder-down @click="shift(1)">後ろへ →</button>
      </div>
      <div class="brain-game__actions">
        <button type="button" class="brain-game__primary" data-builder-edit-ok @click="saveEdit">できた</button>
        <button type="button" class="brain-game__secondary" data-builder-delete @click="removeAt">この場所を消す</button>
      </div>
    </div>

    <!-- カードを書くシート -->
    <div v-if="writing" class="brain-builder__sheet" role="dialog" aria-modal="true" aria-label="カードを書く" data-builder-write-sheet>
      <p class="brain-game__prompt">束にない場所を書こう</p>
      <label class="brain-builder__field">
        <span>場所の名前</span>
        <input v-model="writeName" type="text" :maxlength="LOCUS_NAME_MAX" placeholder="例：おばあちゃんの座いす" data-builder-write-name @keydown.enter="addWritten">
      </label>
      <div class="brain-builder__emoji" role="group" aria-label="絵">
        <button
          v-for="emoji in CUSTOM_CARD_EMOJI"
          :key="emoji"
          type="button"
          class="brain-glance__choice"
          :aria-pressed="writeEmoji === emoji"
          @click="writeEmoji = emoji"
        >{{ emoji }}</button>
      </div>
      <div class="brain-game__actions">
        <button type="button" class="brain-game__primary" :disabled="!writeName.trim()" data-builder-write-add @click="addWritten">足す</button>
        <button type="button" class="brain-game__secondary" @click="writing = false">やめる</button>
      </div>
    </div>

    <!-- 消したあとの取り消し(UD:5-2) -->
    <p v-if="undo" class="brain-builder__undo" role="status" data-builder-undo>
      {{ undo.text }}
      <button type="button" class="brain-game__secondary" @click="undoRemove">取り消す</button>
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, type PropType } from "vue";
import { CUSTOM_CARD_EMOJI, PALACE_TIPS, PLACE_KINDS, placeDeck } from "../data/palace-cards.mjs";
import {
  LOCI_MAX,
  LOCI_READY,
  LOCUS_NAME_MAX,
  PALACE_MAX,
  PALACE_NAME_MAX,
  addLocus,
  createPalace,
  moveLocus,
  palaceReady,
  removeLocus,
  removePalace,
  renameLocus,
  renamePalace,
  replacePalace,
  restoreLocus,
  similarNeighbors,
} from "../core/palace-builder.mjs";

type Locus = { name: string; emoji: string; group: string };
type Palace = { id: string; name: string; place: string; loci: Locus[] };
type Card = { name: string; emoji: string; group?: string };

const props = defineProps({
  palaces: { type: Array as PropType<Palace[]>, default: () => [] },
  sample: { type: Boolean, default: false },
  /** はじめに開く画面。new(新しい宮殿の場所選び)か、list。 */
  start: { type: String as PropType<"new" | "list">, default: "list" },
});
const emit = defineEmits<{
  (event: "save", value: { palaces: Palace[]; sample: boolean }): void;
  (event: "done", palaceId: string): void;
  (event: "sound", kind: "place"): void;
}>();

const palaces = ref<Palace[]>(props.palaces.map((palace) => ({ ...palace, loci: [...palace.loci] })));
const sample = ref(props.sample);
const phase = ref<"list" | "place" | "cards" | "name">(props.start === "new" && props.palaces.length < PALACE_MAX ? "place" : "list");
const workingId = ref("");
const editIndex = ref<number | null>(null);
const editName = ref("");
const writing = ref(false);
const writeName = ref("");
const writeEmoji = ref(CUSTOM_CARD_EMOJI[0]);
const nameDraft = ref("");
const sayLine = ref("");
const undo = ref<{ text: string; restore: () => void } | null>(null);
let undoTimer: ReturnType<typeof setTimeout> | null = null;

const working = computed(() => palaces.value.find(({ id }) => id === workingId.value) ?? null);
const deck = computed(() => placeDeck(working.value?.place ?? "free") as readonly Card[]);
const usedNames = computed(() => new Set(working.value?.loci.map(({ name }) => name) ?? []));
const similarAt = computed(() => (working.value ? similarNeighbors(working.value) : []));

onBeforeUnmount(() => {
  if (undoTimer) clearTimeout(undoTimer);
});

function placeEmoji(place: string) {
  return PLACE_KINDS.find(({ id }) => id === place)?.emoji ?? "📍";
}
function persist() {
  emit("save", { palaces: palaces.value.map((palace) => ({ ...palace, loci: [...palace.loci] })), sample: sample.value });
}
function update(palace: Palace) {
  palaces.value = replacePalace(palaces.value, palace) as Palace[];
  persist();
}

function toggleSample() {
  sample.value = !sample.value;
  persist();
}
function openPalace(id: string) {
  workingId.value = id;
  sayLine.value = "";
  phase.value = "cards";
}
function startPalace(place: string) {
  const made = createPalace(palaces.value, { place });
  if (!made) return;
  palaces.value = made.palaces as Palace[];
  workingId.value = made.palace.id;
  sayLine.value = place === "home" ? "玄関から順に、家の中を歩くつもりで押してね。" : "入口から順に、歩くつもりで押してね。";
  phase.value = "cards";
  persist();
}

function add(card: Card) {
  if (!working.value) return;
  const result = addLocus(working.value, card);
  if (!result.added) return;
  update(result.palace as Palace);
  emit("sound", "place");
  const count = result.palace.loci.length;
  // 似た場所が続いたときだけ、責めずにひとこと(11-6)。
  if (result.similar) sayLine.value = "似ている場所が続くと、混ざりやすいよ。";
  else if (count === LOCI_READY) sayLine.value = "10か所そろった！ 「できあがり」で宮殿になるよ。まだ足してもいいよ。";
  else if (count === 1) sayLine.value = "その調子。次に歩く場所を押してね。";
  else sayLine.value = "";
}

function openEdit(index: number) {
  if (!working.value) return;
  editIndex.value = index;
  editName.value = working.value.loci[index].name;
}
function saveEdit() {
  if (!working.value || editIndex.value === null) return;
  update(renameLocus(working.value, editIndex.value, editName.value) as Palace);
  editIndex.value = null;
}
function shift(step: number) {
  if (!working.value || editIndex.value === null) return;
  const to = editIndex.value + step;
  update(moveLocus(renameLocus(working.value, editIndex.value, editName.value), editIndex.value, to) as Palace);
  editIndex.value = to;
}
function showUndo(text: string, restore: () => void) {
  if (undoTimer) clearTimeout(undoTimer);
  undo.value = { text, restore };
  undoTimer = setTimeout(() => { undo.value = null; }, 5000);
}
function removeAt() {
  if (!working.value || editIndex.value === null) return;
  const palaceId = working.value.id;
  const result = removeLocus(working.value, editIndex.value);
  update(result.palace as Palace);
  editIndex.value = null;
  showUndo(`「${result.removed?.name ?? ""}」を消したよ。`, () => {
    const palace = palaces.value.find(({ id }) => id === palaceId);
    if (palace) update(restoreLocus(palace, result.index, result.removed) as Palace);
  });
}
function undoRemove() {
  undo.value?.restore();
  undo.value = null;
}

function openWrite() {
  writeName.value = "";
  writeEmoji.value = CUSTOM_CARD_EMOJI[0];
  writing.value = true;
}
function addWritten() {
  if (!writeName.value.trim()) return;
  add({ name: writeName.value, emoji: writeEmoji.value });
  writing.value = false;
}

function finishName() {
  if (!working.value) return;
  const palace = renamePalace(working.value, nameDraft.value || working.value.name) as Palace;
  update(palace);
  emit("done", palace.id);
  phase.value = "list";
}
function deletePalace() {
  if (!working.value) return;
  const removed = working.value;
  const index = palaces.value.findIndex(({ id }) => id === removed.id);
  palaces.value = removePalace(palaces.value, removed.id) as Palace[];
  persist();
  phase.value = "list";
  showUndo(`「${removed.name}」を消したよ。`, () => {
    const list = [...palaces.value];
    list.splice(index, 0, removed);
    palaces.value = list;
    persist();
  });
}

/** 名前の画面を開く。今の名前を下書きにする。 */
function toName() {
  nameDraft.value = working.value?.name ?? "";
  phase.value = "name";
}

/** 戻る操作。シート・カード・名前の画面からは1つ前へ戻り、真を返す。一覧なら偽(部屋へ戻る)。 */
function goBack() {
  if (editIndex.value !== null) {
    editIndex.value = null;
    return true;
  }
  if (writing.value) {
    writing.value = false;
    return true;
  }
  if (phase.value === "name") {
    phase.value = "cards";
    return true;
  }
  if (phase.value === "cards" || phase.value === "place") {
    phase.value = "list";
    return true;
  }
  return false;
}
defineExpose({ goBack });
</script>

<style>
.shogi-game .brain-builder { width: min(100%, 40rem); position: relative; }
.shogi-game .brain-builder__palaces,
.shogi-game .brain-builder__places {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: 0.5rem;
  width: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
}
.shogi-game .brain-builder__note { margin: 0; color: #cfd8de; font-size: 0.85rem; text-align: center; }
.shogi-game .brain-builder__route {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  width: 100%;
  max-height: 7.2rem;
  margin: 0;
  padding: 0.4rem;
  overflow-y: auto;
  border-radius: 0.7rem;
  background: #172632;
  list-style: none;
}
.shogi-game .brain-builder__route--final { max-height: 12rem; }
.shogi-game .brain-builder__route-empty { padding: 0.3rem 0.5rem; color: #cfd8de; font-size: 0.85rem; }
.shogi-game .brain-builder__locus {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  min-height: 36px;
  padding: 0.2rem 0.6rem;
  border: 2px solid transparent;
  border-radius: 999px;
  color: #172632;
  background: #fffcf4;
  font: inherit;
  font-size: 0.88rem;
  font-weight: 800;
  cursor: pointer;
}
.shogi-game .brain-builder__locus small { color: #8a4b0f; font-size: 0.72rem; }
.shogi-game .brain-builder__locus--similar { border-color: #d9822b; border-style: dashed; }
.shogi-game .brain-builder__say { min-height: 1.4em; margin: 0; color: #f1a54c; font-weight: 800; text-align: center; }
.shogi-game .brain-builder__tips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.2rem 0.9rem;
  margin: 0;
  padding: 0;
  color: #cfd8de;
  font-size: 0.78rem;
  list-style: none;
}
.shogi-game .brain-builder__tips li::before { content: "・"; }
.shogi-game .brain-builder__deck {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(7.2rem, 1fr));
  gap: 0.35rem;
  width: 100%;
  /* 残りの高さを使い、束は枠の中だけ動かす(U:7-5)。 */
  max-height: max(12rem, calc(100dvh - 25rem));
  margin: 0;
  padding: 0.2rem;
  overflow-y: auto;
  list-style: none;
}
.shogi-game .brain-builder__card {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 0.1rem;
  width: 100%;
  min-height: 64px;
  padding: 0.35rem 0.3rem;
  border: 2px solid #c9c2b0;
  border-radius: 0.7rem;
  color: #172632;
  background: #fffcf4;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 800;
  line-height: 1.25;
  cursor: pointer;
}
.shogi-game .brain-builder__card span { font-size: 1.5rem; line-height: 1.1; }
.shogi-game .brain-builder__card small { position: absolute; top: 0.15rem; right: 0.35rem; color: #2a8a4a; }
.shogi-game .brain-builder__card--used { background: #e7f2e6; border-color: #9fc79b; }
.shogi-game .brain-builder__card--write { border-style: dashed; background: #f1ece0; }
@media (hover: hover) {
  .shogi-game .brain-builder__card:not(:disabled):hover,
  .shogi-game .brain-builder__locus:not(:disabled):hover { border-color: #d9822b; background-color: #fff3dc; }
}
.shogi-game .brain-builder__card:focus-visible,
.shogi-game .brain-builder__locus:focus-visible { outline: 3px solid #3c6dd1; outline-offset: 2px; }
.shogi-game .brain-builder__field { display: grid; gap: 0.25rem; width: min(100%, 22rem); font-weight: 800; }
.shogi-game .brain-builder__field input {
  min-height: 44px;
  padding: 0 0.7rem;
  border: 2px solid rgba(255, 252, 244, 0.4);
  border-radius: 0.6rem;
  color: #fffcf4;
  background: #172632;
  font: inherit;
}
.shogi-game .brain-builder__sheet {
  position: fixed;
  inset: auto 0 0 0;
  z-index: 5;
  display: grid;
  justify-items: center;
  gap: 0.6rem;
  padding: 1rem 1rem calc(1rem + env(safe-area-inset-bottom));
  border-top: 3px solid #f1a54c;
  border-radius: 1rem 1rem 0 0;
  background: #223a4c;
  box-shadow: 0 -6px 20px rgba(0, 0, 0, 0.35);
}
.shogi-game .brain-builder__moves { display: flex; gap: 0.5rem; }
.shogi-game .brain-builder__emoji { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.3rem; }
.shogi-game .brain-builder__emoji .brain-glance__choice { font-size: 1.3rem; }
.shogi-game .brain-builder__undo {
  position: fixed;
  left: 50%;
  bottom: calc(1rem + env(safe-area-inset-bottom));
  z-index: 6;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin: 0;
  padding: 0.4rem 0.5rem 0.4rem 1rem;
  border-radius: 999px;
  color: #fffcf4;
  background: #172632;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
  transform: translateX(-50%);
  white-space: nowrap;
}
.shogi-game .brain-builder__undo .brain-game__secondary { min-width: 0; min-height: 44px; padding: 0.3rem 1rem; }
.shogi-game .brain-builder__remove {
  min-height: 44px;
  border: 0;
  color: #e58d84;
  background: transparent;
  font: inherit;
  text-decoration: underline;
  cursor: pointer;
}
</style>
