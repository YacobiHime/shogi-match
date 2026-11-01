<template>
  <!--
    ストーリー選択の話のカード(docs/story-mode-design.mdの1章)。団体戦の形式選びでも使う(docs/team-battle-design.mdの17章)。
    上の帯(「第一話」と印)、大きな題名、右に場面の小さな絵。選んでいるカードは少し大きく、左右に▶◀。
    読めないカードは、灰色の模様と札(準備中・未開放)だけ。押すと親が理由を知らせる(無反応にしない。D:3-1)。
  -->
  <div
    class="pick-card"
    :class="[`pick-card--${state}`, { 'pick-card--selected': selected, 'pick-card--patterned': patterned }]"
  >
    <span v-if="selected" class="pick-card__arrow pick-card__arrow--left" aria-hidden="true"></span>
    <button
      type="button"
      class="pick-card__face"
      :aria-label="ariaLabel"
      :aria-current="selected ? 'true' : undefined"
      :data-pick-card="id"
      :data-pick-state="state"
      @click="emit('pick')"
      @focus="emit('hover')"
      @pointerenter="onPointerEnter"
    >
      <template v-if="!patterned">
        <span class="pick-card__scene" :style="{ background: novelBackground(background) }" aria-hidden="true"></span>
        <span class="pick-card__strip" aria-hidden="true">
          <span class="pick-card__label">{{ label }}</span>
          <span v-if="read" class="pick-card__piece">{{ STORY_TEXT.readMark }}</span>
          <span v-if="isNew" class="pick-card__new">{{ STORY_TEXT.isNew }}</span>
          <span v-if="badge" class="pick-card__badge">{{ badge }}</span>
        </span>
        <span class="pick-card__title" aria-hidden="true">{{ title }}</span>
        <span v-if="sub" class="pick-card__sub" aria-hidden="true">{{ sub }}</span>
      </template>
      <span v-if="ribbon" class="pick-card__ribbon" :class="`pick-card__ribbon--${state}`" aria-hidden="true">{{ ribbon }}</span>
    </button>
    <span v-if="selected" class="pick-card__arrow pick-card__arrow--right" aria-hidden="true"></span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { novelBackground } from "./core/novel-ui.mjs";
import { STORY_TEXT } from "./core/story-mode.mjs";

const props = defineProps({
  id: { type: String, required: true },
  /** 上の帯の言葉(「第一話」「団体戦（高校）」「高校の団体戦」)。 */
  label: { type: String, default: "" },
  title: { type: String, default: "" },
  /** 題名の下の小さな一言(団体戦の形式の説明)。 */
  sub: { type: String, default: "" },
  /** 読める(open)・準備中(soon)・未開放(locked)。 */
  state: { type: String, default: "open" },
  /** 題名を出さず、模様と札だけにする(未開放と、題名のない準備中)。 */
  patterned: { type: Boolean, default: false },
  read: { type: Boolean, default: false },
  isNew: { type: Boolean, default: false },
  /** 帯の右の小さな札(最高成績など)。 */
  badge: { type: String, default: "" },
  /** 斜めの札(準備中・未開放)。 */
  ribbon: { type: String, default: "" },
  /** 場面の小さな絵(core/novel-ui.mjsのNOVEL_BACKGROUND_CSSの名前)。 */
  background: { type: String, default: "venue" },
  selected: { type: Boolean, default: false },
});
const emit = defineEmits<{ pick: []; hover: [] }>();

const ariaLabel = computed(() => {
  const name = [props.label, props.title].filter(Boolean).join(" ");
  const state = props.state === "soon" ? `（${STORY_TEXT.ribbon.soon}）` : props.state === "locked" ? `（${STORY_TEXT.ribbon.locked}）` : "";
  const marks = [props.read ? STORY_TEXT.read : "", props.isNew ? "新しい" : "", props.badge, props.sub].filter(Boolean).join("・");
  return `${name}${state}${marks ? `。${marks}` : ""}`;
});

/** マウスを乗せたら選ぶ(指で触る画面では、押したときだけ)。 */
function onPointerEnter(event: PointerEvent) {
  if (event.pointerType === "mouse") emit("hover");
}
</script>

<style>
/* 色は枠(PickFrame.vue)のタブの色(--pick-tone)。全体のボタンの書式に負けないよう、.shogi-game .pick-card の中に書く。 */
.shogi-game .pick-card {
  position: relative;
  padding: 0 var(--pick-arrow-room, 1.7rem);
}
.shogi-game .pick-card .pick-card__face {
  position: relative;
  display: grid;
  grid-template-rows: auto auto;
  align-content: start;
  width: 100%;
  min-height: var(--pick-card-h, 4.9rem);
  margin: 0;
  padding: 0;
  overflow: hidden;
  border: 0.2rem solid var(--pick-tone, #ec6584);
  border-radius: 0.6rem;
  color: var(--pick-ink, #3b2a1c);
  background: #fffdf8;
  box-shadow: 0 0.18rem 0 rgba(120, 70, 30, 0.22);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: transform 120ms ease, box-shadow 120ms ease;
}
.shogi-game .pick-card .pick-card__face:not(:disabled):hover {
  border-color: var(--pick-tone, #ec6584);
  background: #fffdf8;
  transform: none;
}
.shogi-game .pick-card .pick-card__face:not(:disabled):active {
  transform: scale(0.99);
  box-shadow: 0 0.06rem 0 rgba(120, 70, 30, 0.22);
}
.shogi-game .pick-card .pick-card__face:focus-visible {
  outline: 0.2rem solid #3b2a1c;
  outline-offset: 0.15rem;
}
/* 選んでいるカード: 少し大きく、白い縁と影。左右に▶◀(参考の画像)。 */
.shogi-game .pick-card--selected .pick-card__face {
  transform: scale(1.025);
  box-shadow: 0 0 0 0.18rem #fff, 0 0.35rem 0.9rem rgba(120, 60, 20, 0.28);
}
.shogi-game .pick-card--selected .pick-card__face:not(:disabled):hover { transform: scale(1.025); }
.shogi-game .pick-card__arrow {
  position: absolute;
  top: 50%;
  width: 0;
  height: 0;
  border-top: 0.75rem solid transparent;
  border-bottom: 0.75rem solid transparent;
  translate: 0 -50%;
  animation: pick-card-nudge 900ms ease-in-out infinite alternate;
}
.shogi-game .pick-card__arrow--left {
  left: 0.1rem;
  border-left: 1rem solid var(--pick-tone, #ec6584);
}
.shogi-game .pick-card__arrow--right {
  right: 0.1rem;
  border-right: 1rem solid var(--pick-tone, #ec6584);
  animation-direction: alternate-reverse;
}
@keyframes pick-card-nudge {
  from { margin-left: -0.15rem; }
  to { margin-left: 0.15rem; }
}
/* 場面の小さな絵: 右に、左へ向かって薄くなるようにかける。 */
.shogi-game .pick-card__scene {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 46%;
  opacity: 0.85;
  -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 55%);
  mask-image: linear-gradient(90deg, transparent 0%, #000 55%);
  background-size: cover;
  pointer-events: none;
}
/* 上の帯: タブの色から右へ白く抜ける。網点の模様。 */
.shogi-game .pick-card__strip {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 1.85rem;
  padding: 0.12rem 0.9rem;
  color: #fff;
  background:
    radial-gradient(circle, rgba(255, 255, 255, 0.28) 0.09rem, transparent 0.11rem) 0 0 / 0.42rem 0.42rem,
    linear-gradient(90deg, var(--pick-tone, #ec6584) 0%, var(--pick-tone, #ec6584) 38%, rgba(255, 255, 255, 0) 78%);
  font-size: 1rem;
  font-weight: 900;
  letter-spacing: 0.06em;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.18);
}
.shogi-game .pick-card__label { white-space: nowrap; }
/* 読んだ印: 駒の形(将棋の駒の五角形)。 */
.shogi-game .pick-card__piece {
  display: inline-grid;
  place-items: center;
  width: 1.25rem;
  height: 1.45rem;
  padding-top: 0.12rem;
  color: #6b3d1f;
  background: linear-gradient(180deg, #f8e2ad, #e7c27a);
  clip-path: polygon(50% 0, 86% 16%, 100% 100%, 0 100%, 14% 16%);
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0;
  text-shadow: none;
}
.shogi-game .pick-card__new {
  padding: 0.02rem 0.45rem;
  border-radius: 999px;
  color: #fff;
  background: #e8475f;
  font-size: 0.7rem;
  letter-spacing: 0.04em;
  text-shadow: none;
}
.shogi-game .pick-card__badge {
  padding: 0.04rem 0.5rem;
  border: 0.1rem solid var(--pick-tone, #ec6584);
  border-radius: 999px;
  color: var(--pick-tone-deep, #c94a68);
  background: #fff;
  font-size: 0.72rem;
  letter-spacing: 0.02em;
  text-shadow: none;
  white-space: nowrap;
}
.shogi-game .pick-card__title {
  position: relative;
  padding: 0.3rem 1.1rem 0.42rem;
  overflow: hidden;
  font-size: var(--pick-title-size, clamp(1.15rem, 0.9rem + 1vw, 1.7rem));
  font-weight: 800;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.shogi-game .pick-card__sub {
  position: relative;
  margin-top: -0.3rem;
  padding: 0 1.1rem 0.45rem;
  color: #6d5a48;
  font-size: 0.8rem;
  font-weight: 700;
  line-height: 1.35;
}
/* 読めない話: 灰色の地に桜と星の模様(参考の画像の「未開放」)。 */
.shogi-game .pick-card--patterned .pick-card__face {
  display: grid;
  place-items: center;
  border-color: #bdb6ad;
  background:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='72' viewBox='0 0 120 72'%3E%3Cg fill='%23ffffff' fill-opacity='0.32'%3E%3Cg transform='translate(22 22)'%3E%3Ccircle cx='0' cy='-7' r='5'/%3E%3Ccircle cx='6.7' cy='-2.2' r='5'/%3E%3Ccircle cx='4.1' cy='5.7' r='5'/%3E%3Ccircle cx='-4.1' cy='5.7' r='5'/%3E%3Ccircle cx='-6.7' cy='-2.2' r='5'/%3E%3C/g%3E%3Cpath d='M86 46l3 6.4 7 1-5 5 1.2 7-6.2-3.3-6.2 3.3 1.2-7-5-5 7-1z'/%3E%3Cpath d='M98 12l2 4.2 4.6.7-3.3 3.2.8 4.6-4.1-2.2-4.1 2.2.8-4.6-3.3-3.2 4.6-.7z'/%3E%3C/g%3E%3C/svg%3E") 0 0 / 7.5rem 4.5rem,
    linear-gradient(rgba(255, 255, 255, 0.18) 1px, transparent 1px) 0 0 / 1.2rem 1.2rem,
    linear-gradient(90deg, rgba(255, 255, 255, 0.18) 1px, transparent 1px) 0 0 / 1.2rem 1.2rem,
    #a9a49d;
  cursor: pointer;
}
.shogi-game .pick-card--patterned .pick-card__face:not(:disabled):hover { background-color: #a9a49d; border-color: #bdb6ad; }
/* 準備中・未開放の札: 白い札の左に色の帯。少し傾ける。 */
.shogi-game .pick-card__ribbon {
  position: relative;
  padding: 0.3rem 1.3rem 0.3rem 1.6rem;
  border-radius: 0.2rem;
  color: #3b2a1c;
  background: linear-gradient(90deg, #e8566f 0 0.55rem, #fff 0.55rem);
  box-shadow: 0 0.15rem 0.3rem rgba(0, 0, 0, 0.2);
  font-size: 1.05rem;
  font-weight: 900;
  letter-spacing: 0.12em;
  rotate: -4deg;
}
.shogi-game .pick-card__ribbon--soon { background: linear-gradient(90deg, #3f9fd2 0 0.55rem, #fff 0.55rem); }
/* 題名のある準備中のカード: 札は右の絵の上に重ね、カードの色を少し落とす。 */
.shogi-game .pick-card--soon:not(.pick-card--patterned) .pick-card__ribbon {
  position: absolute;
  top: 50%;
  right: 1.2rem;
  translate: 0 -50%;
}
.shogi-game .pick-card--soon:not(.pick-card--patterned) .pick-card__scene { filter: grayscale(0.7); opacity: 0.6; }
@media (prefers-reduced-motion: reduce) {
  .shogi-game .pick-card__arrow { animation: none; }
  .shogi-game .pick-card .pick-card__face { transition: none; }
}
@media (max-width: 520px) {
  .shogi-game .pick-card { --pick-arrow-room: 1.25rem; }
  .shogi-game .pick-card__arrow { border-top-width: 0.6rem; border-bottom-width: 0.6rem; }
  .shogi-game .pick-card__arrow--left { border-left-width: 0.8rem; }
  .shogi-game .pick-card__arrow--right { border-right-width: 0.8rem; }
  .shogi-game .pick-card__strip { min-height: 1.6rem; padding: 0.1rem 0.7rem; font-size: 0.88rem; }
  .shogi-game .pick-card__title { padding: 0.22rem 0.8rem 0.34rem; }
  .shogi-game .pick-card__sub { padding: 0 0.8rem 0.4rem; font-size: 0.74rem; }
  .shogi-game .pick-card__ribbon { font-size: 0.92rem; }
}
</style>
