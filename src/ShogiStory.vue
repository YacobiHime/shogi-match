<template>
  <!--
    物語モードのストーリー選択(docs/story-mode-design.md)。ホームの「物語」から開く。
    メイン(本編。まだ準備中)とサブ(大会で見た場面をもう一度読む)の2つのタブ。カードを1回押すと話が始まる(3章の3)。
    話はノベルの場面の部品(NovelScene.vue)で読む。
  -->
  <div class="shogi-story" role="dialog" aria-modal="true" :aria-label="STORY_TEXT.title" data-story>
    <PickFrame
      ref="frameEl"
      :title="STORY_TEXT.title"
      icon="book"
      :intro="introText"
      :people="people"
      :tabs="tabTiles"
      :active-tab="tab"
      tabs-label="ストーリーの種類"
      :tone="tone"
      :actions="actions"
      :asset-base-url="assetBaseUrl"
      @tab="chooseTab"
      @action="onAction"
    >
      <ul class="shogi-story__list" :aria-label="`${tabLabel}ストーリー`" :data-story-tab="tab">
        <li v-for="card in cards" :key="card.id">
          <PickCard
            :id="card.id"
            :label="card.label"
            :title="card.title"
            :state="card.state"
            :patterned="card.patterned"
            :read="card.read"
            :is-new="card.isNew"
            :ribbon="card.state === 'open' ? '' : STORY_TEXT.ribbon[card.state as 'soon' | 'locked']"
            :background="card.background"
            :selected="card.id === selectedId"
            @pick="pick(card)"
            @hover="select(card.id)"
          />
        </li>
      </ul>
    </PickFrame>
    <NovelScene v-if="scene" ref="novelEl" :scene="scene" :asset-base-url="assetBaseUrl" @done="closeScene" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import NovelScene from "./NovelScene.vue";
import PickCard from "./PickCard.vue";
import PickFrame from "./PickFrame.vue";
import {
  STORY_NOTICE_MS, STORY_TABS, STORY_TEXT, loadStoryProgress, markStoryOpened, markStoryRead, rememberStoryPlace, saveStoryProgress,
  storyCards, storyEpisode, storyNewCount, storyNotice, storyScene, syncStoryUnlocks,
} from "./core/story-mode.mjs";
import { isSceneRead, loadNovelRead } from "./core/novel-ui.mjs";
import { loadTeamBattle } from "./core/team-battle.mjs";
import { clickPlan } from "./core/novel-sound.mjs";
import { createNovelAudio } from "./novel-audio";

type TabId = "main" | "sub";
type Card = ReturnType<typeof storyCards>[number];

const props = defineProps({
  assetBaseUrl: { type: String, default: "." },
  playerName: { type: String, default: "あなた" },
});
const emit = defineEmits<{ close: [] }>();

const storage = typeof localStorage === "undefined" ? null : localStorage;
const progress = ref(loadStoryProgress(storage));
const novelRead = ref(loadNovelRead(storage));
// 遊びの中で見た場面(団体戦)から、開いた話を拾って残す(3章の7)。
{
  const synced = syncStoryUnlocks(progress.value, { read: novelRead.value, teamCareer: loadTeamBattle(storage) });
  if (synced.changed) {
    progress.value = synced.progress;
    saveStoryProgress(storage, progress.value);
  }
}
/** 場面に差し込む名前(名前がなければ、台本は「あなた」と呼ぶ)。 */
const sceneName = computed(() => (props.playerName === "あなた" ? "" : props.playerName));

const tab = ref<TabId>(progress.value.last.tab as TabId);
const tabLabel = computed(() => STORY_TABS.find((entry) => entry.id === tab.value)?.label ?? "");
const tone = computed(() => STORY_TABS.find((entry) => entry.id === tab.value)?.tone ?? "pink");
const cards = computed(() => storyCards(progress.value, tab.value, { read: novelRead.value, playerName: sceneName.value }));
const tabTiles = computed(() => STORY_TABS.map((entry) => {
  const count = storyNewCount(progress.value, entry.id as TabId, { read: novelRead.value, playerName: sceneName.value });
  return { id: entry.id, label: entry.label, tone: entry.tone, badge: count ? String(count) : "" };
}));

// 選んでいるカード(タブごと)。はじめは前に見た話、なければ読める話の最初、それもなければ一覧の最初。
const selection = reactive<Record<TabId, string>>({ main: "", sub: "" });
selection[tab.value] = progress.value.last.id;
const selectedId = computed(() => {
  const list = cards.value;
  if (list.some((card) => card.id === selection[tab.value])) return selection[tab.value];
  return (list.find((card) => card.state === "open") ?? list[0])?.id ?? "";
});
const selectedCard = computed(() => cards.value.find((card) => card.id === selectedId.value) ?? null);

/** 左の立ち絵: 選んでいる話の人物。未開放は影(3章の9)。 */
const people = computed(() => {
  const card = selectedCard.value;
  const cast = card?.cast.length ? card.cast : ["momoka"];
  return cast.map((who) => ({ who, face: "neutral", silhouette: card?.state === "locked" }));
});

// 押せない話の一言(4秒で、もとの案内の一文に戻る。3章の5)。
const notice = ref("");
let noticeTimer: ReturnType<typeof setTimeout> | null = null;
function showNotice(text: string) {
  notice.value = text;
  if (noticeTimer) clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { notice.value = ""; noticeTimer = null; }, STORY_NOTICE_MS);
}
const introText = computed(() => notice.value || STORY_TEXT.intro[tab.value]);

const actions = computed(() => [
  { id: "tab", label: STORY_TEXT.bar.tab, key: "◀▶" },
  { id: "select", label: STORY_TEXT.bar.select, key: "▲▼", hint: true },
  { id: "decide", label: STORY_TEXT.bar.decide, key: "Enter", primary: true, disabled: !selectedCard.value },
  { id: "back", label: STORY_TEXT.bar.back, key: "Esc" },
]);

function remember() {
  progress.value = rememberStoryPlace(progress.value, tab.value, selectedId.value);
  saveStoryProgress(storage, progress.value);
}
/** 押した音(ノベルの場面と同じ「ポッ」。docs/novel-scene-design.mdの11章)。 */
const audio = createNovelAudio();
const clickSound = (kind: "click" | "choice" | "tool") => audio.click(clickPlan(kind));

function select(id: string) {
  selection[tab.value] = id;
}
function chooseTab(id: string) {
  if (id !== "main" && id !== "sub") return;
  if (tab.value !== id) {
    clickSound("tool");
    tab.value = id;
    notice.value = "";
  }
  remember();
}
function onAction(id: string) {
  if (id === "tab") chooseTab(tab.value === "main" ? "sub" : "main");
  else if (id === "decide" && selectedCard.value) pick(selectedCard.value);
  else if (id === "back") {
    clickSound("tool");
    emit("close");
  }
}

// ---- 話を読む
const frameEl = ref<{ revealItem: (selector: string) => void } | null>(null);
const novelEl = ref<{ finish: () => void; goBack: () => boolean } | null>(null);
const sceneId = ref("");
const scene = computed(() => (sceneId.value ? storyScene(storyEpisode(sceneId.value), sceneName.value) : null));

/** カードを押した。読める話は始め、読めない話は理由を知らせる(無反応にしない。D:3-1)。 */
function pick(card: Card) {
  select(card.id);
  clickSound(card.state === "open" ? "choice" : "tool");
  if (card.state !== "open") {
    showNotice(storyNotice(card));
    remember();
    return;
  }
  notice.value = "";
  progress.value = markStoryOpened(progress.value, card.id);
  remember();
  sceneId.value = card.id;
}
/** 話を閉じた。最後の行まで読んでいれば「済」(ノベルの場面の読んだ印で確かめる)。 */
function closeScene() {
  const id = sceneId.value;
  const shown = scene.value;
  sceneId.value = "";
  novelRead.value = loadNovelRead(storage);
  if (id && shown && isSceneRead(novelRead.value, shown)) {
    progress.value = markStoryRead(progress.value, id);
    saveStoryProgress(storage, progress.value);
  }
  void nextTick(() => frameEl.value?.revealItem(`[data-pick-card="${id}"]`));
}

// ---- キー(↑↓で選ぶ・←→でタブ・Enterで決定・Escで戻る。3章の4)
function moveSelection(step: number) {
  const list = cards.value;
  if (!list.length) return;
  const index = Math.max(0, list.findIndex((card) => card.id === selectedId.value));
  const next = list[Math.min(list.length - 1, Math.max(0, index + step))];
  select(next.id);
  frameEl.value?.revealItem(`[data-pick-card="${next.id}"]`);
}
function onKeydown(event: KeyboardEvent) {
  if (sceneId.value) {
    // 話のログ・設定・隠した窓は話の部品が先に閉じる(閉じたらdefaultPrevented)。何もなければ、Escは話を閉じる(戻ると同じ)。
    if (event.key === "Escape" && !event.defaultPrevented) {
      event.preventDefault();
      novelEl.value?.finish();
    }
    return;
  }
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
  const target = event.target as HTMLElement | null;
  const typing = target?.closest?.("input, textarea, select, [contenteditable='true']");
  if (typing) return;
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    moveSelection(event.key === "ArrowDown" ? 1 : -1);
  } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    onAction("tab");
  } else if ((event.key === "Enter" || event.key === " ") && !target?.closest?.("button")) {
    // ボタンにフォーカスがあるときは、そのボタンの押し(二重に動かさない)。
    event.preventDefault();
    onAction("decide");
  } else if (event.key === "Escape") {
    event.preventDefault();
    emit("close");
  }
}
onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
  audio.close();
  if (noticeTimer) clearTimeout(noticeTimer);
});

/** 戻る操作。話を読んでいるときは、話(のログ・設定)を閉じる。一覧ではfalse(ホームへ戻るのは親)。 */
function goBack() {
  if (!sceneId.value) return false;
  if (!novelEl.value?.goBack()) novelEl.value?.finish();
  return true;
}
defineExpose({ goBack });
</script>

<style>
.shogi-game .shogi-story {
  position: absolute;
  inset: 0;
  z-index: 6;
  display: grid;
  background: #fde49c;
  animation: shogi-story-enter 180ms ease-out both;
}
.shogi-game .shogi-story__list {
  display: grid;
  gap: inherit;
  margin: 0;
  padding: 0;
  list-style: none;
}
@keyframes shogi-story-enter {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .shogi-game .shogi-story { animation: none; }
}
</style>
