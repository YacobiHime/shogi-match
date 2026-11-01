<template>
  <!--
    選ぶ画面の枠(docs/story-mode-design.mdの1章。参考の画像は将棋のゲームの「ストーリー選択」)。
    左上に題名の札、右上に案内の一文、左に選んでいるものの人物の立ち絵、右にタブと白い一覧の板、下に橙の帯(タブ切り替え・決定・戻る)。
    縦長の画面では、立ち絵は題名の札の右に胸から上を小さく出し、一覧を画面の幅いっぱいにする。
    物語のストーリー選択(ShogiStory.vue)と、団体戦の形式選び・出場の画面(ShogiTeamBattle.vue)で使う。
  -->
  <section
    class="pick-frame"
    :class="[`pick-frame--${tone}`, { 'pick-frame--pair': shownPeople.length > 1, 'pick-frame--tabs': tabs.length > 0 }]"
    :aria-labelledby="titleId"
    data-pick-frame
  >
    <header class="pick-frame__head">
      <h1 :id="titleId" class="pick-frame__plate">
        <span class="pick-frame__plate-icon" aria-hidden="true">
          <svg v-if="icon === 'team'" viewBox="0 0 16 16" shape-rendering="crispEdges">
            <g fill="#5b3920">
              <rect x="2" y="4" width="3" height="3" /><rect x="11" y="4" width="3" height="3" /><rect x="6" y="2" width="4" height="4" />
              <rect x="1" y="8" width="5" height="5" /><rect x="10" y="8" width="5" height="5" /><rect x="5" y="7" width="6" height="7" />
            </g>
            <g fill="#ec6584"><rect x="7" y="9" width="2" height="2" /></g>
          </svg>
          <svg v-else viewBox="0 0 16 16" shape-rendering="crispEdges">
            <g fill="#fffdf8"><rect x="1" y="3" width="6" height="10" /><rect x="9" y="3" width="6" height="10" /></g>
            <g fill="#5b3920">
              <rect x="7" y="3" width="2" height="11" /><rect x="1" y="13" width="14" height="1" /><rect x="0" y="2" width="1" height="12" /><rect x="15" y="2" width="1" height="12" />
              <rect x="2" y="5" width="4" height="1" /><rect x="2" y="7" width="4" height="1" /><rect x="2" y="9" width="3" height="1" />
              <rect x="10" y="5" width="4" height="1" /><rect x="10" y="7" width="4" height="1" /><rect x="10" y="9" width="3" height="1" />
            </g>
          </svg>
        </span>
        <span class="pick-frame__plate-text">{{ title }}</span>
      </h1>
      <p class="pick-frame__intro" role="status" aria-live="polite" data-pick-intro>{{ intro }}</p>
    </header>

    <div class="pick-frame__people" aria-hidden="true" data-pick-people>
      <img
        v-for="person in shownPeople"
        :key="person.key"
        class="pick-frame__person"
        :class="{ 'pick-frame__person--shadow': person.silhouette }"
        :style="person.style"
        :src="person.src"
        :srcset="person.srcset"
        :sizes="person.sizes"
        alt=""
        draggable="false"
      >
    </div>

    <div class="pick-frame__main">
      <div v-if="tabs.length" class="pick-frame__tabs" role="tablist" :aria-label="tabsLabel">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          role="tab"
          class="pick-frame__tab"
          :class="`pick-frame__tab--${tab.tone}`"
          :aria-selected="tab.id === activeTab"
          :data-pick-tab="tab.id"
          @click="emit('tab', tab.id)"
        >
          {{ tab.label }}<span v-if="tab.badge" class="pick-frame__tab-badge" :aria-label="`新しい話${tab.badge}`">{{ tab.badge }}</span>
        </button>
      </div>
      <div class="pick-frame__panel" :role="tabs.length ? 'tabpanel' : undefined">
        <div ref="listEl" class="pick-frame__list" data-pick-list>
          <slot />
        </div>
      </div>
    </div>

    <footer class="pick-frame__bar" data-pick-bar>
      <template v-for="action in actions" :key="action.id">
        <span v-if="action.hint" class="pick-frame__key pick-frame__key--hint" aria-hidden="true">
          <span v-if="action.key" class="pick-frame__key-icon">{{ action.key }}</span>{{ action.label }}
        </span>
        <button
          v-else
          type="button"
          class="pick-frame__key"
          :class="{ 'pick-frame__key--primary': action.primary }"
          :disabled="action.disabled"
          :data-pick-action="action.id"
          @click="emit('action', action.id)"
        >
          <span v-if="action.key" class="pick-frame__key-icon" aria-hidden="true">{{ action.key }}</span>{{ action.label }}
        </button>
      </template>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, type PropType } from "vue";
import { portraitAspect, portraitScale, portraitUrl } from "./core/team-story.mjs";

type Person = { who: string; face?: string; silhouette?: boolean };
type Tab = { id: string; label: string; tone: string; badge?: string | number };
type Action = { id: string; label: string; key?: string; primary?: boolean; disabled?: boolean; hint?: boolean };

const props = defineProps({
  title: { type: String, required: true },
  /** 題名の札の印(本・チーム)。 */
  icon: { type: String as PropType<"book" | "team">, default: "book" },
  /** 案内の一文(押せないものを押したときの一言もここ)。 */
  intro: { type: String, default: "" },
  /** 左の立ち絵(選んでいるものの人物。2人まで)。silhouetteは影(未開放)。 */
  people: { type: Array as PropType<Person[]>, default: () => [] },
  tabs: { type: Array as PropType<Tab[]>, default: () => [] },
  activeTab: { type: String, default: "" },
  tabsLabel: { type: String, default: "" },
  /** 一覧の板の色(タブの色。pink・blue)。 */
  tone: { type: String, default: "pink" },
  actions: { type: Array as PropType<Action[]>, default: () => [] },
  assetBaseUrl: { type: String, default: "." },
  /** 題名の札のid(外の画面のaria-labelledbyが指すとき)。 */
  headingId: { type: String, default: "" },
});
const emit = defineEmits<{ tab: [id: string]; action: [id: string] }>();

const titleId = props.headingId || `pick-frame-title-${Math.random().toString(36).slice(2, 8)}`;
const listEl = ref<HTMLElement | null>(null);

/** 立ち絵(身長差は足元をそろえて出す。ノベルの場面と同じportraitScale)。小さい画面は320幅の絵。 */
const shownPeople = computed(() => {
  const people = props.people.slice(0, 2);
  const cast = people.map((person) => person.who);
  return people.map((person, index) => {
    const face = person.face ?? "neutral";
    const full = portraitUrl(props.assetBaseUrl, person.who, face);
    const small = portraitUrl(props.assetBaseUrl, person.who, face, { small: true });
    const width = person.who === "momoka" ? 800 : 662;
    return {
      key: `${person.who}-${index}`,
      src: full,
      srcset: `${small} 320w, ${full} ${width}w`,
      sizes: "(max-width: 699px) 9rem, 32vw",
      silhouette: Boolean(person.silhouette),
      style: {
        "--scale": String(portraitScale(person.who, cast)),
        "--aspect": String(portraitAspect(person.who)),
        "--x": people.length > 1 ? (index === 0 ? "36%" : "68%") : "50%",
        zIndex: String(people.length - index),
      },
    };
  });
});

/** 一覧の中で、そのカードが見えるところまで動かす(キーで選んだとき)。 */
function revealItem(selector: string) {
  const item = listEl.value?.querySelector(selector);
  item?.scrollIntoView({ block: "nearest" });
}
defineExpose({ revealItem });
</script>

<style>
/*
 * 色(参考の画像の明るい黄色の地・焦げ茶の札・桃色と水色のタブ・橙の帯)。トークンにまとめる(U:7-1)。
 * 全体のボタンの書式(.shogi-game button)に負けないよう、.shogi-game .pick-frame の中に書く。
 */
.shogi-game .pick-frame {
  --pick-pink: #ec6584;
  --pick-pink-deep: #c94a68;
  --pick-blue: #3f9fd2;
  --pick-blue-deep: #2a78a8;
  --pick-ink: #3b2a1c;
  --pick-plate: #5b3920;
  --pick-plate-edge: #f6d9a0;
  --pick-bar: #ef8b23;
  --pick-tone: var(--pick-pink);
  --pick-tone-deep: var(--pick-pink-deep);
  --pick-head-h: 3.6rem;
  --pick-bar-h: 3.2rem;
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 34fr) minmax(0, 66fr);
  grid-template-rows: var(--pick-head-h) minmax(0, 1fr) var(--pick-bar-h);
  grid-template-areas: "head head" "people main" "bar bar";
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  color: var(--pick-ink);
  background:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='200' viewBox='0 0 240 200'%3E%3Cg fill='%23f0b63e' fill-opacity='0.32'%3E%3Cpath d='M40 18l5 10.5 11.5 1.6-8.3 8.1 2 11.4L40 44.2l-10.2 5.4 2-11.4-8.3-8.1 11.5-1.6z'/%3E%3Cpath d='M180 96l3.4 7 7.7 1.1-5.6 5.4 1.3 7.7-6.8-3.6-6.8 3.6 1.3-7.7-5.6-5.4 7.7-1.1z'/%3E%3Cpath d='M96 150l2.4 5 5.5.8-4 3.9.9 5.5-4.8-2.6-4.8 2.6.9-5.5-4-3.9 5.5-.8z'/%3E%3C/g%3E%3C/svg%3E") 0 0 / 15rem 12.5rem,
    linear-gradient(rgba(255, 255, 255, 0.5) 2px, transparent 2px) 0 0 / 3rem 3rem,
    linear-gradient(90deg, rgba(255, 255, 255, 0.5) 2px, transparent 2px) 0 0 / 3rem 3rem,
    linear-gradient(160deg, #fff3cc 0%, #fde49c 50%, #f9cd68 100%);
  font-family: "Hiragino Maru Gothic ProN", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", sans-serif;
}
.shogi-game .pick-frame--blue {
  --pick-tone: var(--pick-blue);
  --pick-tone-deep: var(--pick-blue-deep);
}

/* ---- 上: 題名の札と案内の一文 */
.shogi-game .pick-frame__head {
  grid-area: head;
  position: relative;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 1rem;
  min-width: 0;
  padding: 0.45rem clamp(0.6rem, 2vw, 1.4rem) 0;
}
.shogi-game .pick-frame__plate {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 0.7rem;
  margin: 0;
  padding: 0.2rem 1.5rem 0.2rem 0.3rem;
  border: 0.2rem solid var(--pick-plate-edge);
  border-radius: 0.9rem;
  color: #fff3d6;
  background: linear-gradient(180deg, #6b4428, var(--pick-plate));
  box-shadow: 0 0 0 0.16rem var(--pick-plate), 0 0.3rem 0 rgba(91, 57, 32, 0.35);
  font-size: clamp(1.15rem, 0.85rem + 1vw, 1.65rem);
  font-weight: 900;
  letter-spacing: 0.08em;
  line-height: 1.2;
  text-shadow: 0 0.12rem 0 rgba(0, 0, 0, 0.35);
  white-space: nowrap;
}
.shogi-game .pick-frame__plate-icon {
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  margin: -0.5rem 0 -0.5rem -0.7rem;
  border: 0.18rem solid var(--pick-plate);
  border-radius: 0.45rem;
  background: #ffe7a0;
  rotate: -8deg;
  box-shadow: 0 0.18rem 0 rgba(91, 57, 32, 0.4);
}
.shogi-game .pick-frame__plate-icon svg { width: 1.7rem; height: 1.7rem; }
.shogi-game .pick-frame__intro {
  flex: 1;
  min-width: 0;
  margin: 0;
  color: #fff;
  font-size: clamp(0.85rem, 0.7rem + 0.45vw, 1.12rem);
  font-weight: 800;
  line-height: 1.35;
  text-align: right;
  /* 白い字に焦げ茶の縁(黄色の地の上で読めるように)。 */
  text-shadow:
    0.08rem 0 0 #8a5528, -0.08rem 0 0 #8a5528, 0 0.08rem 0 #8a5528, 0 -0.08rem 0 #8a5528,
    0.06rem 0.06rem 0 #8a5528, -0.06rem -0.06rem 0 #8a5528, 0.06rem -0.06rem 0 #8a5528, -0.06rem 0.06rem 0 #8a5528;
}

/* ---- 左: 立ち絵(頭から腿のあたりまで。足元はそろえ、身長差は少し縮めて見せる) */
.shogi-game .pick-frame__people {
  grid-area: people;
  position: relative;
  z-index: 1;
  min-height: 0;
  margin-bottom: calc(-1 * var(--pick-bar-h));
  overflow: hidden;
  container-type: size;
  --crop: 0.64;
  --head: 2cqh;
}
.shogi-game .pick-frame__person {
  position: absolute;
  left: var(--x, 50%);
  top: calc(var(--head) + (100cqh / var(--crop)) * (1 - var(--scale, 1)));
  height: calc((100cqh / var(--crop)) * var(--scale, 1));
  width: auto;
  max-width: none;
  translate: -50% 0;
  filter: drop-shadow(0 0.4rem 0.6rem rgba(120, 60, 20, 0.25));
  user-select: none;
  animation: pick-frame-person-in 220ms ease-out both;
}
/* 未開放: 人物は影で見せる(いるのは分かるが、まだ会えない。G:6-1の4)。 */
.shogi-game .pick-frame__person--shadow { filter: brightness(0) opacity(0.4); }
@keyframes pick-frame-person-in {
  from { opacity: 0; margin-left: -1.2rem; }
  to { opacity: 1; margin-left: 0; }
}

/* ---- 右: タブと一覧の板 */
.shogi-game .pick-frame__main {
  grid-area: main;
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-rows: minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  padding: 0.3rem clamp(0.6rem, 2vw, 1.4rem) 0.6rem 0;
}
.shogi-game .pick-frame--tabs .pick-frame__main { grid-template-rows: auto minmax(0, 1fr); }
.shogi-game .pick-frame__tabs {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
  padding: 0 1.2rem;
}
.shogi-game .pick-frame .pick-frame__tab {
  position: relative;
  min-width: min(10rem, 40%);
  min-height: 2.6rem;
  margin: 0 0 -0.22rem;
  padding: 0.3rem 1.2rem;
  border: 0.22rem solid var(--tab, var(--pick-pink));
  border-bottom: 0;
  border-radius: 0.9rem 0.9rem 0 0;
  color: var(--tab, var(--pick-pink));
  background: #fffdf8;
  box-shadow: none;
  font-size: clamp(1rem, 0.85rem + 0.5vw, 1.3rem);
  font-weight: 900;
  letter-spacing: 0.12em;
  transform: none;
}
.shogi-game .pick-frame .pick-frame__tab--pink { --tab: var(--pick-pink); }
.shogi-game .pick-frame .pick-frame__tab--blue { --tab: var(--pick-blue); }
.shogi-game .pick-frame .pick-frame__tab[aria-selected="true"] {
  z-index: 1;
  color: #fff;
  background:
    radial-gradient(circle, rgba(255, 255, 255, 0.22) 0.09rem, transparent 0.11rem) 0 0 / 0.42rem 0.42rem,
    var(--tab, var(--pick-pink));
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.2);
}
.shogi-game .pick-frame .pick-frame__tab:not(:disabled):hover {
  border-color: var(--tab, var(--pick-pink));
  background-color: #fff6ec;
  transform: none;
}
.shogi-game .pick-frame .pick-frame__tab[aria-selected="true"]:not(:disabled):hover { background-color: var(--tab, var(--pick-pink)); }
.shogi-game .pick-frame__tab-badge {
  position: absolute;
  top: -0.45rem;
  right: -0.35rem;
  min-width: 1.2rem;
  padding: 0 0.3rem;
  border-radius: 999px;
  color: #fff;
  background: #e8475f;
  font-size: 0.72rem;
  line-height: 1.2rem;
  letter-spacing: 0;
  text-shadow: none;
}
.shogi-game .pick-frame__panel {
  display: grid;
  min-height: 0;
  border: 0.25rem solid var(--pick-tone);
  border-radius: 1.1rem;
  background: rgba(255, 253, 248, 0.97);
  box-shadow: 0 0.3rem 0 rgba(150, 90, 40, 0.22);
  overflow: hidden;
}
.shogi-game .pick-frame__list {
  display: grid;
  align-content: start;
  gap: 0.75rem;
  min-height: 0;
  padding: 0.9rem 0.6rem 1rem;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-color: #f39a2b #dedad3;
}
.shogi-game .pick-frame__list::-webkit-scrollbar { width: 0.65rem; }
.shogi-game .pick-frame__list::-webkit-scrollbar-track { background: #dedad3; border-radius: 999px; }
.shogi-game .pick-frame__list::-webkit-scrollbar-thumb { background: #f39a2b; border-radius: 999px; }

/* ---- 下: 橙の帯(参考の画像の「タブ切り替え・選択・決定・戻る」) */
.shogi-game .pick-frame__bar {
  grid-area: bar;
  position: relative;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: clamp(0.6rem, 2vw, 2rem);
  padding: 0 clamp(0.6rem, 2vw, 1.6rem) env(safe-area-inset-bottom);
  background: linear-gradient(180deg, #f5a03a, var(--pick-bar));
  box-shadow: 0 -0.15rem 0 rgba(255, 255, 255, 0.45) inset;
}
.shogi-game .pick-frame .pick-frame__key {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 44px;
  margin: 0;
  padding: 0.2rem 0.6rem;
  border: 0;
  border-radius: 0.6rem;
  color: #fff;
  background: transparent;
  box-shadow: none;
  font-size: clamp(1rem, 0.85rem + 0.5vw, 1.25rem);
  font-weight: 900;
  letter-spacing: 0.06em;
  text-shadow: 0 0.1rem 0 rgba(120, 50, 0, 0.45);
  white-space: nowrap;
}
.shogi-game .pick-frame .pick-frame__key:not(:disabled):hover {
  border: 0;
  background: rgba(255, 255, 255, 0.18);
  transform: none;
}
.shogi-game .pick-frame .pick-frame__key--primary {
  padding: 0.2rem 1.1rem;
  color: var(--pick-ink);
  background: #fffdf8;
  box-shadow: 0 0.18rem 0 rgba(120, 50, 0, 0.35);
  text-shadow: none;
}
.shogi-game .pick-frame .pick-frame__key--primary:not(:disabled):hover { background: #fff3dc; }
.shogi-game .pick-frame .pick-frame__key:disabled { opacity: 0.5; background: transparent; }
.shogi-game .pick-frame .pick-frame__key--primary:disabled { background: #fffdf8; }
.shogi-game .pick-frame__key--hint { cursor: default; }
/* キーの印: マウスとキーボードのある画面だけ(指の画面では、ボタンの言葉だけ。docs/story-mode-design.mdの3章の4)。 */
.shogi-game .pick-frame__key-icon {
  display: none;
  min-width: 1.7rem;
  height: 1.7rem;
  padding: 0 0.35rem;
  border-radius: 999px;
  color: var(--pick-bar);
  background: #fff;
  font-size: 0.78rem;
  line-height: 1.7rem;
  text-align: center;
  text-shadow: none;
}
.shogi-game .pick-frame .pick-frame__key--primary .pick-frame__key-icon { color: #fff; background: var(--pick-bar); }
.shogi-game .pick-frame .pick-frame__key--hint { display: none; }
@media (hover: hover) and (pointer: fine) and (min-width: 560px) {
  .shogi-game .pick-frame__key-icon { display: inline-block; }
  .shogi-game .pick-frame .pick-frame__key--hint { display: inline-flex; }
}

/* ---- 縦長の画面: 立ち絵は題名の札の右に胸から上を小さく。一覧は画面の幅いっぱい。 */
@media (max-aspect-ratio: 1/1), (max-width: 699px) {
  .shogi-game .pick-frame {
    --pick-head-h: auto;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-rows: auto minmax(0, 1fr) var(--pick-bar-h);
    grid-template-areas: "head people" "main main" "bar bar";
  }
  .shogi-game .pick-frame__head {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.6rem 0.2rem 0.4rem 0.75rem;
  }
  .shogi-game .pick-frame__intro { text-align: left; }
  .shogi-game .pick-frame__people {
    width: 7.4rem;
    height: 7.2rem;
    margin: 0.3rem 0.6rem 0 0;
    border-bottom: 0.2rem solid rgba(255, 255, 255, 0.7);
    --crop: 0.27;
    --head: 6cqh;
  }
  .shogi-game .pick-frame--pair .pick-frame__people { width: 10.5rem; }
  .shogi-game .pick-frame__main { padding: 0 0.6rem 0.5rem; }
  .shogi-game .pick-frame__tabs { padding: 0 0.8rem; }
  .shogi-game .pick-frame__bar { justify-content: space-around; gap: 0.2rem; }
}
@media (min-width: 700px) and (max-aspect-ratio: 1/1) {
  .shogi-game .pick-frame__people { width: 11rem; height: 11rem; }
  .shogi-game .pick-frame--pair .pick-frame__people { width: 15rem; }
}
/* 背の低い横長の画面(スマホの横向き): 上と下の帯を細く。 */
@media (max-height: 520px) and (min-aspect-ratio: 1/1) {
  .shogi-game .pick-frame { --pick-head-h: 2.9rem; --pick-bar-h: 2.75rem; }
  .shogi-game .pick-frame__plate { font-size: 1.05rem; padding: 0.1rem 1rem 0.1rem 0.2rem; }
  .shogi-game .pick-frame__plate-icon { width: 2rem; height: 2rem; }
  .shogi-game .pick-frame__plate-icon svg { width: 1.3rem; height: 1.3rem; }
  .shogi-game .pick-frame__list { gap: 0.5rem; padding: 0.6rem 0.4rem 0.7rem; }
  .shogi-game .pick-frame .pick-frame__tab { min-height: 2.2rem; padding: 0.15rem 1rem; }
}
@media (prefers-reduced-motion: reduce) {
  .shogi-game .pick-frame__person { animation: none; }
}
</style>
