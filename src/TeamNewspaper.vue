<template>
  <!--
    団体戦の優勝の号外(docs/team-battle-design.mdの21章の3の3)。インタビューのあとに出し、トロフィー棚からも読み返す。
    中身は core/team-celebration.mjs の championNewspaper。「棚に飾る」(読み返しは「閉じる」)で閉じる。
  -->
  <div class="team-paper" role="dialog" aria-modal="true" aria-labelledby="team-paper-headline" data-team-paper :data-team-paper-mode="mode" @click.self="close">
    <article class="team-paper__sheet" :class="{ 'team-paper__sheet--new': mode === 'new' }">
      <header class="team-paper__mast">
        <strong class="team-paper__title">{{ paper.masthead }}</strong>
        <span class="team-paper__edition">{{ paper.edition }}</span>
        <small class="team-paper__date">{{ paper.date }}</small>
      </header>
      <h2 id="team-paper-headline" class="team-paper__headline" data-team-paper-headline>{{ paper.headline }}</h2>
      <p v-if="paper.sub" class="team-paper__sub">{{ paper.sub }}</p>
      <p class="team-paper__lead">{{ paper.lead }}</p>
      <div class="team-paper__columns">
        <section v-if="paper.path.length" class="team-paper__box" aria-label="勝ち上がり">
          <h3>勝ち上がり</h3>
          <ol class="team-paper__path">
            <li v-for="(entry, index) in paper.path" :key="index">
              <small>{{ entry.label }}</small>
              <span>{{ entry.rival }}</span>
              <b>{{ entry.won ? "○" : "●" }}{{ entry.score }}</b>
            </li>
          </ol>
        </section>
        <section class="team-paper__box" aria-label="3人の成績">
          <h3>{{ paper.format === "school" ? "3人の成績" : "チームの成績" }}</h3>
          <ul class="team-paper__members" data-team-paper-members>
            <li v-for="member in paper.members" :key="member.id" :class="{ 'team-paper__member--top': member.top }">
              <small>{{ member.seat }}</small>
              <span>{{ member.name }}</span>
              <b>{{ member.record }}</b>
              <em v-if="member.top" class="team-paper__top">殊勲</em>
            </li>
          </ul>
        </section>
      </div>
      <section class="team-paper__box team-paper__quotes" aria-label="あなたの言葉" data-team-paper-quotes>
        <h3>{{ paper.playerName }}の言葉</h3>
        <p v-for="(quote, index) in paper.quotes" :key="index">「{{ quote }}」</p>
      </section>
      <ul class="team-paper__comments" aria-label="仲間の一言">
        <li v-for="comment in paper.comments" :key="comment.who">
          <img class="team-paper__face" :src="faceOf(comment.who)" alt="" draggable="false">
          <span><small>{{ comment.name }}</small>{{ comment.text }}</span>
        </li>
      </ul>
      <button ref="doneButton" type="button" class="team-paper__done" data-team-paper-done @click="close">{{ mode === "new" ? "棚に飾る" : "閉じる" }}</button>
    </article>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, type PropType } from "vue";
import { portraitUrl } from "./core/team-story.mjs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Paper = any;

const props = defineProps({
  /** 号外の中身(core/team-celebration.mjsのchampionNewspaper)。 */
  paper: { type: Object as PropType<Paper>, required: true },
  /** new: インタビューのあと(「棚に飾る」)、read: 棚から読み返す(「閉じる」)。 */
  mode: { type: String as PropType<"new" | "read">, default: "new" },
  assetBaseUrl: { type: String, default: "." },
});
const emit = defineEmits<{ done: [] }>();
const doneButton = ref<HTMLButtonElement | null>(null);

function close() {
  emit("done");
}
const faceOf = (who: string) => portraitUrl(props.assetBaseUrl, who, who === "hanane" ? "smile" : "wry", { small: true });

/** 戻る操作で閉じる(画面に任せない)。 */
function goBack() {
  close();
  return true;
}
defineExpose({ goBack });

function onKeydown(event: KeyboardEvent) {
  if (event.defaultPrevented || event.key !== "Escape") return;
  event.preventDefault();
  close();
}
onMounted(() => {
  window.addEventListener("keydown", onKeydown);
  void nextTick(() => doneButton.value?.focus({ preventScroll: true }));
});
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<style>
.shogi-game .team-paper {
  position: fixed; inset: 0; z-index: 82; display: grid; place-items: center; padding: 0.5rem; box-sizing: border-box;
  background: rgba(15, 28, 38, 0.9);
}
.shogi-game .team-paper__sheet {
  display: grid; gap: 0.5rem; width: min(100%, 34rem); max-height: 100%; overflow-y: auto; padding: 0.9rem 1rem 1rem; box-sizing: border-box;
  border-radius: 0.3rem; color: #1d1a16; background: #f4efe2;
  background-image: repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.025) 0 1px, transparent 1px 4px);
  box-shadow: 0 0.8rem 2rem rgba(0, 0, 0, 0.5); font-family: "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif;
}
.shogi-game .team-paper__sheet--new { animation: team-paper-in 520ms cubic-bezier(0.2, 1.2, 0.4, 1); }
.shogi-game .team-paper__mast {
  display: flex; align-items: center; gap: 0.5rem; padding-bottom: 0.35rem; border-bottom: 0.2rem double #1d1a16;
}
.shogi-game .team-paper__title { font-size: 1.25rem; font-weight: 900; letter-spacing: 0.15em; }
.shogi-game .team-paper__edition {
  padding: 0.05rem 0.5rem; border-radius: 0.2rem; color: #fff; background: #b3261e; font-weight: 900; letter-spacing: 0.2em;
}
.shogi-game .team-paper__date { margin-left: auto; color: #4a443b; font-size: 0.78rem; }
.shogi-game .team-paper__headline {
  margin: 0.1rem 0 0; font-size: clamp(1.5rem, 7vw, 2.3rem); font-weight: 900; line-height: 1.2; letter-spacing: 0.04em;
}
.shogi-game .team-paper__sub { margin: 0; padding-left: 0.5rem; border-left: 0.3rem solid #b3261e; font-size: 1rem; font-weight: 800; }
.shogi-game .team-paper__lead { margin: 0; font-size: 0.9rem; line-height: 1.7; text-indent: 1em; }
.shogi-game .team-paper__columns { display: grid; gap: 0.5rem; }
@media (min-width: 560px) { .shogi-game .team-paper__columns { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } }
.shogi-game .team-paper__box { display: grid; align-content: start; gap: 0.25rem; padding: 0.4rem 0.55rem; border: 0.08rem solid #1d1a16; }
.shogi-game .team-paper__box h3 { margin: 0; font-size: 0.82rem; font-weight: 900; letter-spacing: 0.1em; }
.shogi-game .team-paper__path, .shogi-game .team-paper__members { display: grid; gap: 0.15rem; margin: 0; padding: 0; list-style: none; font-size: 0.82rem; }
.shogi-game .team-paper__path li, .shogi-game .team-paper__members li {
  display: grid; grid-template-columns: minmax(3.2rem, max-content) minmax(0, 1fr) auto; align-items: baseline; gap: 0.35rem;
}
.shogi-game .team-paper__members li { grid-template-columns: 2.4rem minmax(0, 1fr) auto auto; }
.shogi-game .team-paper__path small, .shogi-game .team-paper__members small { color: #4a443b; font-size: 0.72rem; }
.shogi-game .team-paper__path span, .shogi-game .team-paper__members span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.shogi-game .team-paper__member--top span, .shogi-game .team-paper__member--top b { color: #b3261e; }
.shogi-game .team-paper__top {
  padding: 0 0.3rem; border: 0.08rem solid #b3261e; border-radius: 0.2rem; color: #b3261e; font-size: 0.68rem; font-style: normal; font-weight: 900;
}
.shogi-game .team-paper__quotes p { margin: 0; font-size: 0.95rem; font-weight: 800; }
.shogi-game .team-paper__comments { display: grid; gap: 0.35rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .team-paper__comments li { display: flex; align-items: center; gap: 0.45rem; }
.shogi-game .team-paper__face {
  flex: none; width: 2.4rem; height: 2.4rem; border: 0.08rem solid #1d1a16; border-radius: 50%; object-fit: cover; object-position: 50% 4%;
  background: #e9eef1; filter: grayscale(0.6) contrast(1.1);
}
.shogi-game .team-paper__comments span { display: grid; font-size: 0.85rem; line-height: 1.5; }
.shogi-game .team-paper__comments small { color: #4a443b; font-size: 0.7rem; }
.shogi-game .team-paper__done {
  min-height: 44px; margin-top: 0.2rem; border: 0; border-radius: 999px; color: #fffcf4; background: #1d303f;
  font: inherit; font-family: system-ui, sans-serif; font-weight: 900; cursor: pointer;
}
@keyframes team-paper-in { from { transform: rotate(-8deg) scale(0.4); opacity: 0; } to { transform: rotate(0) scale(1); opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .shogi-game .team-paper__sheet--new { animation: none; } }
</style>
