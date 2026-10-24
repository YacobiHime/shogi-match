<template>
  <!--
    竜王戦の対局の直前のVS画面(docs/ryuo-ui-renewal-design.mdの5-3)。「対局する」を押すと出て、少しして盤へ。押すとすぐ盤へ。
    画面を斜めに青(自分)と朱(相手)に分け、両側が画面の外から滑り込み、「VS」が落ちる。山場の一局は少し長く、金と朱にする。
  -->
  <div
    :class="['ryuo-versus', { 'ryuo-versus--boss': boss }]"
    role="dialog"
    aria-modal="true"
    :aria-label="`${label}。${youName} 対 ${opponent.name}`"
    data-versus
    @click="finish"
  >
    <div class="ryuo-versus__side ryuo-versus__side--you" aria-hidden="true"></div>
    <div class="ryuo-versus__side ryuo-versus__side--them" aria-hidden="true"></div>
    <div class="ryuo-versus__stripes" aria-hidden="true"></div>
    <!-- 羽音は、相手の側に立ち絵(全身)を大きく出す(docs/hanane-rival-design.mdの12章)。 -->
    <HananePortrait
      v-if="opponent.portrait"
      class="ryuo-versus__portrait"
      crop="full"
      :expression="opponent.portrait"
      :asset-base-url="assetBaseUrl"
      data-versus-portrait
    />
    <p class="ryuo-versus__label">{{ label }}</p>
    <div class="ryuo-versus__player ryuo-versus__player--you">
      <span class="ryuo-versus__piece" aria-hidden="true">自</span>
      <strong>{{ youName }}</strong>
      <small>{{ [ratingText, colorText(you)].filter(Boolean).join("・") }}</small>
    </div>
    <div class="ryuo-versus__mark" aria-hidden="true">VS</div>
    <div class="ryuo-versus__player ryuo-versus__player--them">
      <span v-if="opponent.portrait" class="ryuo-versus__rival-tag" aria-hidden="true">ライバル</span>
      <span v-else-if="opponent.sprite" class="ryuo-versus__seal ryuo-versus__seal--sprite" aria-hidden="true"><img :src="opponent.sprite" alt="" draggable="false"></span>
      <span v-else :class="['ryuo-versus__seal', `ryuo-versus__seal--${opponent.tone}`]" aria-hidden="true">{{ opponent.char }}</span>
      <strong>{{ opponent.name }}</strong>
      <small>{{ [opponent.dan, opponent.style, colorText(you === "black" ? "white" : "black")].filter(Boolean).join("・") }}</small>
    </div>
    <p v-if="win" class="ryuo-versus__stakes">勝てば <span>{{ win }}</span></p>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, type PropType } from "vue";
import { createMoveSoundPlayer } from "./core/move-sound";
import HananePortrait from "./HananePortrait.vue";

const props = defineProps({
  assetBaseUrl: { type: String, default: "." },
  /** 段階(例: 6組ランキング戦 準々決勝)。 */
  label: { type: String, required: true },
  /** 自分の手番。 */
  you: { type: String as PropType<"black" | "white">, default: "black" },
  ratingText: { type: String, default: "" },
  /** プレイヤー名(タイトル画面で入れる。入れていなければ「あなた」)。 */
  youName: { type: String, default: "あなた" },
  opponent: {
    /** portraitは、立ち絵のある人物(羽音)の表情。空なら判子。 */
    type: Object as PropType<{ name: string; char: string; tone: string; sprite: string; dan: string; style: string; portrait?: string }>,
    required: true,
  },
  /** 勝てば(例: 準決勝へ)。 */
  win: { type: String, default: "" },
  /** 山場の一局(組の決勝・番勝負・ライバル)。 */
  boss: { type: Boolean, default: false },
});
const emit = defineEmits<{ done: [] }>();

/** VS画面を出している長さ(ms)。山場は少し長く。演出は1.5秒前後で、押せばすぐ盤へ(Game_Nintendo_Implementation.mdの4章)。 */
const VS_MS = 1200;
const VS_BOSS_MS = 1600;
/** 「VS」が落ちて着く時刻(ms)。CSSの`ryuo-versus-drop`(遅れ0.2秒・0.18秒)に合わせて、和太鼓の音を鳴らす。 */
const VS_SOUND_AT = 360;

const colorText = (color: string) => (color === "black" ? "先手" : "後手");
const timers: ReturnType<typeof setTimeout>[] = [];
let done = false;
function finish() {
  if (done) return;
  done = true;
  timers.splice(0).forEach(clearTimeout);
  emit("done");
}
onMounted(() => {
  timers.push(
    setTimeout(() => createMoveSoundPlayer(() => props.assetBaseUrl).play("vs"), VS_SOUND_AT),
    setTimeout(finish, props.boss ? VS_BOSS_MS : VS_MS),
  );
});
onBeforeUnmount(() => timers.splice(0).forEach(clearTimeout));
defineExpose({ finish });
</script>

<style>
.shogi-game .ryuo-versus {
  position: fixed;
  inset: 0;
  z-index: 60;
  overflow: hidden;
  color: #fffcf4;
  background: #0b1320;
  font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Yu Gothic", "Meiryo", sans-serif;
  cursor: pointer;
}
.shogi-game .ryuo-versus__side { position: absolute; inset: 0; }
.shogi-game .ryuo-versus__side--you { background: #3d6fa5; clip-path: polygon(0 0, 100% 0, 100% 40%, 0 60%); animation: ryuo-versus-in-left 220ms ease-out both; }
.shogi-game .ryuo-versus__side--them { background: #c4604c; clip-path: polygon(0 60%, 100% 40%, 100% 100%, 0 100%); animation: ryuo-versus-in-right 220ms ease-out both; }
.shogi-game .ryuo-versus--boss .ryuo-versus__side--you { background: linear-gradient(135deg, #3d6fa5, #b68b2a); }
.shogi-game .ryuo-versus--boss .ryuo-versus__side--them { background: linear-gradient(135deg, #c4604c, #8a2f3a); }
.shogi-game .ryuo-versus__stripes { position: absolute; inset: 0; background: repeating-linear-gradient(115deg, rgba(255, 255, 255, 0.06) 0 6px, transparent 6px 22px); }
.shogi-game .ryuo-versus__label {
  position: absolute;
  top: max(2.2rem, env(safe-area-inset-top));
  left: 50%;
  margin: 0;
  padding: 0.4rem 1.1rem;
  border: 2px solid #f1a54c;
  border-radius: 999px;
  background: #172632;
  font-size: 1rem;
  font-weight: 800;
  white-space: nowrap;
  transform: translateX(-50%);
}
.shogi-game .ryuo-versus__player { position: absolute; display: grid; gap: 0.3rem; }
.shogi-game .ryuo-versus__player strong { font-size: clamp(2rem, 1.4rem + 3vw, 3.4rem); font-weight: 900; line-height: 1.1; text-shadow: 0 4px 0 #0b1320; }
.shogi-game .ryuo-versus__player small { font-size: 0.95rem; font-weight: 800; }
.shogi-game .ryuo-versus__player--you { top: 18%; left: 7%; justify-items: start; animation: ryuo-versus-in-left 260ms ease-out both; }
.shogi-game .ryuo-versus__player--them { bottom: 14%; right: 7%; justify-items: end; text-align: right; animation: ryuo-versus-in-right 260ms ease-out both; }
.shogi-game .ryuo-versus__piece {
  display: grid;
  place-items: center;
  width: clamp(4.5rem, 3rem + 8vw, 6rem);
  aspect-ratio: 1 / 1.15;
  padding-top: 0.6rem;
  box-sizing: border-box;
  clip-path: polygon(50% 0, 88% 16%, 100% 100%, 0 100%, 12% 16%);
  color: #1a2433;
  background: #fffcf4;
  font-size: clamp(2rem, 1.4rem + 3vw, 2.8rem);
  font-weight: 900;
  filter: drop-shadow(0 4px 0 #0b1320);
}
.shogi-game .ryuo-versus__seal {
  display: grid;
  place-items: center;
  width: clamp(5rem, 3.4rem + 8vw, 6.5rem);
  aspect-ratio: 1;
  overflow: hidden;
  border: 4px solid #fffcf4;
  border-radius: 0.5rem;
  background: #c4604c;
  box-shadow: 4px 4px 0 #0b1320;
  font-family: "Yu Mincho", "YuMincho", "Hiragino Mincho ProN", "Noto Serif JP", serif;
  font-size: clamp(2.6rem, 1.8rem + 4vw, 3.4rem);
  font-weight: 900;
}
.shogi-game .ryuo-versus__seal--attack { background: #a8463f; }
.shogi-game .ryuo-versus__seal--defense { background: #3d6fa5; }
.shogi-game .ryuo-versus__seal--balance { color: #1a2433; background: #d9b860; }
.shogi-game .ryuo-versus__seal--sprite { place-items: start center; background: #d8d0ff; }
.shogi-game .ryuo-versus__seal--sprite img { width: 92%; margin-top: 6%; image-rendering: pixelated; }
.shogi-game .ryuo-versus__mark {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  color: #ffd27a;
  font-size: clamp(6rem, 4rem + 10vw, 9rem);
  font-style: italic;
  font-weight: 900;
  letter-spacing: -0.04em;
  line-height: 1;
  text-align: center;
  text-shadow: 0 6px 0 #b0661b, 0 12px 0 #0b1320;
  transform: translateY(-50%);
  animation: ryuo-versus-drop 180ms cubic-bezier(0.3, 1.4, 0.5, 1) 200ms both;
}
.shogi-game .ryuo-versus__stakes {
  position: absolute;
  bottom: max(2.5rem, env(safe-area-inset-bottom));
  left: 50%;
  margin: 0;
  padding: 0.5rem 1.1rem;
  border: 2px solid #ffd27a;
  border-radius: 999px;
  background: #172632;
  font-size: 1.05rem;
  font-weight: 900;
  white-space: nowrap;
  transform: translateX(-50%);
}
.shogi-game .ryuo-versus__stakes span { color: #ffd27a; }
/* 羽音の立ち絵: 縦の画面は相手の側(下)の左に、横の画面は相手の側(右)の名前の左に、下から立たせる。 */
.shogi-game .ryuo-versus__portrait.ryuo-versus__portrait {
  position: absolute;
  bottom: -6vh;
  left: 4%;
  width: auto;
  height: 62vh;
  filter: drop-shadow(0 0 0.6rem rgba(11, 19, 32, 0.6));
  animation: ryuo-versus-in-right 300ms ease-out both;
}
.shogi-game .ryuo-versus__rival-tag {
  padding: 0.15rem 0.7rem;
  color: #1e2d3d;
  background: #d4a93a;
  font-size: 0.95rem;
  font-weight: 900;
  letter-spacing: 0.12em;
  box-shadow: 3px 3px 0 #0b1320;
}
@keyframes ryuo-versus-in-left { from { transform: translateX(-100%); } }
@keyframes ryuo-versus-in-right { from { transform: translateX(100%); } }
@keyframes ryuo-versus-drop {
  from { opacity: 0; transform: translateY(-50%) scale(2.2); }
  to { opacity: 1; transform: translateY(-50%) scale(1); }
}
/* 横長の画面: 左右に並べる。 */
@media (orientation: landscape) and (min-aspect-ratio: 4/3) {
  .shogi-game .ryuo-versus__side--you { clip-path: polygon(0 0, 58% 0, 42% 100%, 0 100%); }
  .shogi-game .ryuo-versus__side--them { clip-path: polygon(58% 0, 100% 0, 100% 100%, 42% 100%); }
  .shogi-game .ryuo-versus__player--you { top: 30%; left: 8%; }
  .shogi-game .ryuo-versus__player--them { top: 30%; bottom: auto; right: 8%; }
  .shogi-game .ryuo-versus__portrait.ryuo-versus__portrait { right: 30%; left: auto; bottom: -4vh; height: 100vh; }
}
@media (prefers-reduced-motion: reduce) {
  .shogi-game .ryuo-versus__side,
  .shogi-game .ryuo-versus__player,
  .shogi-game .ryuo-versus__mark,
  .shogi-game .ryuo-versus__portrait.ryuo-versus__portrait { animation: none; }
}
</style>
