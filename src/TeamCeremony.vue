<template>
  <!--
    団体戦の表彰式(docs/team-battle-design.mdの20章)。段階の終わりに、団体戦の画面に重ねて出す(後ろは透かさない)。
    開式 → 団体の部(第3位 → 準優勝 → 優勝) → 個人の部 → 記念撮影と仲間の一言 → 賞状(入賞したら) → 次の段階へ・閉会。
    押すと最後まで一度に出る。賞状は賞状の部品(SeasonAward.vue)を、表彰式の中で開く。
  -->
  <div
    class="team-ceremony"
    :class="{ 'team-ceremony--win': view.you.place === 1 }"
    role="dialog"
    aria-modal="true"
    aria-labelledby="team-ceremony-title"
    data-team-ceremony
    :data-team-ceremony-stage="view.stage"
    @click="revealAll"
  >
    <div v-if="done && view.you.place === 1 && !reducedMotion" class="shogi-game__confetti" aria-hidden="true">
      <i v-for="index in 12" :key="index" />
    </div>
    <div class="team-ceremony__panel">
      <header class="team-ceremony__head">
        <p class="team-ceremony__kicker">{{ view.eventName }}</p>
        <h2 id="team-ceremony-title">{{ view.title }}</h2>
        <p class="team-ceremony__host" data-team-ceremony-host><small>司会</small>{{ view.host }}</p>
      </header>

      <div class="team-ceremony__body">
        <section class="team-ceremony__section" aria-labelledby="team-ceremony-team">
          <h3 id="team-ceremony-team">団体の部</h3>
          <ol class="team-ceremony__places" data-team-ceremony-places>
            <li
              v-for="(place, index) in view.places"
              :key="place.label"
              class="team-ceremony__place"
              :class="[`team-ceremony__place--${place.rank}`, { 'team-ceremony__place--shown': Number(index) < placesShown, 'team-ceremony__place--you': place.teams.some((team) => team.you) }]"
              :data-team-ceremony-place="place.rank"
            >
              <span class="team-ceremony__rank">
                <b v-if="place.rank === 1" class="team-ceremony__trophy" aria-hidden="true">{{ view.trophy === "優勝旗" ? "旗" : "杯" }}</b>{{ place.label }}
              </span>
              <span class="team-ceremony__teams">
                <span v-for="team in place.teams" :key="team.id" :class="{ 'team-ceremony__team--you': team.you }">
                  {{ Number(index) < placesShown ? team.name : "……" }}<small v-if="Number(index) < placesShown && team.you">あなたの学校</small>
                </span>
              </span>
            </li>
          </ol>
          <p v-if="!view.you.place && placesShown >= view.places.length" class="team-ceremony__mine" data-team-ceremony-mine>
            <span>{{ view.you.team }}</span><b>{{ view.you.label }}</b>
          </p>
        </section>

        <section v-if="prizesShown > 0" class="team-ceremony__section" aria-labelledby="team-ceremony-player">
          <h3 id="team-ceremony-player">個人の部</h3>
          <ul class="team-ceremony__prizes" data-team-ceremony-prizes>
            <li
              v-for="(prize, index) in view.prizes"
              v-show="Number(index) < prizesShown"
              :key="prize.label"
              class="team-ceremony__prize"
              :class="{ 'team-ceremony__prize--you': prize.you }"
              :data-team-ceremony-prize="prize.label"
            >
              <span class="team-ceremony__prize-label">{{ prize.label }}</span>
              <span class="team-ceremony__prize-name">
                <strong>{{ prize.name }}</strong><small>{{ prize.school }}</small>
              </span>
              <span class="team-ceremony__prize-record">{{ prize.record }}<b v-if="prize.perfect">全勝</b></span>
            </li>
          </ul>
        </section>

        <template v-if="done">
          <figure ref="photoEl" class="team-ceremony__photo" data-team-ceremony-photo>
            <div class="team-ceremony__photo-frame">
              <span v-for="member in view.photo.members" :key="member.id" class="team-ceremony__photo-member">
                <img v-if="faceOf(member.id)" :class="{ 'team-ceremony__photo-face--sprite': spriteFace(member.id) }" :src="faceOf(member.id)" alt="" draggable="false">
                <span v-else class="team-ceremony__photo-char" aria-hidden="true">{{ member.name.slice(0, 1) }}</span>
                <small>{{ member.name }}</small>
              </span>
            </div>
            <figcaption>{{ view.photo.caption }}<small>{{ today }}</small></figcaption>
          </figure>
          <ul class="team-ceremony__lines" aria-label="仲間の一言">
            <li v-for="line in view.lines" :key="line.who" :data-team-ceremony-line="line.who">
              <img :src="lineFace(line.who)" alt="" draggable="false">
              <span><small>{{ line.who === "hanane" ? "羽音" : "百花" }}</small>{{ line.text }}</span>
            </li>
          </ul>
        </template>
      </div>

      <footer class="team-ceremony__foot">
        <template v-if="done">
          <button
            v-if="awardsLeft.length"
            ref="primaryButton"
            type="button"
            class="team-ceremony__primary"
            data-team-ceremony-award
            @click.stop="openNextAward"
          >賞状を受け取る<small v-if="awardsLeft.length > 1">（{{ awardsLeft.length }}枚）</small></button>
          <button
            v-else
            ref="primaryButton"
            type="button"
            class="team-ceremony__primary"
            data-team-ceremony-next
            @click.stop="emit('done')"
          >{{ view.nextLabel }}</button>
        </template>
        <p v-else class="team-ceremony__hint">押すと、すぐに最後まで出ます</p>
      </footer>
    </div>
    <SeasonAward
      v-if="awardShown"
      :award="awardShown"
      :ceremony="true"
      :button-text="awardsLeft.length > 1 ? '次の賞状へ' : '表彰式へ戻る'"
      :asset-base-url="assetBaseUrl"
      @done="closeAward"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, type PropType } from "vue";
import SeasonAward, { type SeasonAwardData } from "./SeasonAward.vue";
import { createMoveSoundPlayer } from "./core/move-sound";
import { CEREMONY_STEP_MS } from "./core/team-ceremony.mjs";
import { portraitUrl } from "./core/team-story.mjs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type View = any;

const props = defineProps({
  /** 表彰式の画面の形(core/team-ceremony.mjsのteamCeremonyView)。 */
  view: { type: Object as PropType<View>, required: true },
  /** 賞状帳(表彰式で渡す賞状を、ここから探して開く)。 */
  awards: { type: Array as PropType<SeasonAwardData[]>, default: () => [] },
  assetBaseUrl: { type: String, default: "." },
});
const emit = defineEmits<{ done: [] }>();

const sounds = createMoveSoundPlayer(() => props.assetBaseUrl);
const reducedMotion = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const placesShown = ref(0);
const prizesShown = ref(0);
const done = ref(false);
const primaryButton = ref<HTMLButtonElement | null>(null);
const photoEl = ref<HTMLElement | null>(null);
const today = (() => {
  const date = new Date();
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
})();
let timers: ReturnType<typeof setTimeout>[] = [];

/** 1つ呼ぶたびに「カタン」、優勝は判子の「トン」(D:3-2 大事なところは止めて音)。 */
function showPlace(count: number) {
  placesShown.value = count;
  const place = props.view.places[count - 1];
  sounds.play(place?.rank === 1 ? "stamp" : "nameplate");
}
function finish() {
  placesShown.value = props.view.places.length;
  prizesShown.value = props.view.prizes.length;
  if (done.value) return;
  done.value = true;
  // 狭い画面で欄がスクロールするときは、記念撮影まで送る(最後の場面を見逃さない)。
  void nextTick(() => {
    primaryButton.value?.focus({ preventScroll: true });
    photoEl.value?.scrollIntoView({ block: "nearest", behavior: reducedMotion ? "auto" : "smooth" });
  });
}
onMounted(() => {
  const placeCount = props.view.places.length;
  const prizeCount = props.view.prizes.length;
  for (let index = 1; index <= placeCount; index += 1) {
    timers.push(setTimeout(() => showPlace(index), CEREMONY_STEP_MS.place * index));
  }
  const prizeStart = CEREMONY_STEP_MS.place * (placeCount + 1);
  for (let index = 1; index <= prizeCount; index += 1) {
    timers.push(setTimeout(() => {
      prizesShown.value = index;
      sounds.play("nameplate");
    }, prizeStart + CEREMONY_STEP_MS.prize * (index - 1)));
  }
  timers.push(setTimeout(finish, prizeStart + CEREMONY_STEP_MS.prize * prizeCount));
  window.addEventListener("keydown", onKeydown);
});
onBeforeUnmount(() => {
  for (const timer of timers) clearTimeout(timer);
  window.removeEventListener("keydown", onKeydown);
});

/** 押すと、残りを一度に出す(UD:7-2 演出は短く飛ばせる)。 */
function revealAll() {
  if (done.value) return;
  for (const timer of timers) clearTimeout(timer);
  timers = [];
  finish();
}

// ---- 賞状(入賞と個人賞。賞状帳に入っているものを順に開く)
const received = ref<string[]>([]);
const awardShown = ref<SeasonAwardData | null>(null);
const awardsLeft = computed(() => (props.view.awards ?? [])
  .map((entry: { id: string }) => props.awards.find((award) => award.id === entry.id))
  .filter((award: SeasonAwardData | undefined): award is SeasonAwardData => Boolean(award) && !received.value.includes(award!.id)));
function openNextAward() {
  awardShown.value = awardsLeft.value[0] ?? null;
}
function closeAward() {
  const shown = awardShown.value;
  awardShown.value = null;
  if (shown) received.value = [...received.value, shown.id];
  if (awardsLeft.value.length) openNextAward();
  else void nextTick(() => primaryButton.value?.focus());
}

/** 戻る操作・Esc。途中なら最後まで出し、賞状が開いていれば閉じる。閉じたら真。 */
function goBack() {
  if (!done.value) {
    revealAll();
    return true;
  }
  if (awardShown.value) {
    closeAward();
    return true;
  }
  emit("done");
  return true;
}
defineExpose({ goBack });
function onKeydown(event: KeyboardEvent) {
  if (event.defaultPrevented) return;
  if (event.key === "Escape" || ((event.key === "Enter" || event.key === " ") && !done.value)) {
    event.preventDefault();
    goBack();
  }
}

// ---- 顔
const faceOf = (id: string) => {
  if (id === "hanane") return `${props.assetBaseUrl}/characters/hanane-mini.webp?v=1`;
  if (id === "momoka") return portraitUrl(props.assetBaseUrl, "momoka", "neutral", { small: true });
  if (id === "user") return `${props.assetBaseUrl}/characters/yakobihime-mini.webp?v=4`;
  return "";
};
const spriteFace = (id: string) => id === "hanane" || id === "user";
const lineFace = (who: string) => {
  const good = props.view.you.place > 0 || props.view.nextLabel !== "閉会";
  return portraitUrl(props.assetBaseUrl, who, good ? (who === "hanane" ? "smile" : "neutral") : (who === "hanane" ? "gentle" : "worried"), { small: true });
};
</script>

<style>
/* 後ろの団体戦の画面は透かさない(表彰式に集中する。結果を先に見せない) */
.shogi-game .team-ceremony {
  position: fixed; inset: 0; z-index: 80; display: grid; grid-template-rows: minmax(0, 1fr); place-items: center; padding: 0.5rem;
  box-sizing: border-box; overflow: hidden; background: radial-gradient(ellipse at 50% 0%, #2c4a63 0%, #0f1c26 70%); cursor: pointer;
}
.shogi-game .team-ceremony__panel {
  position: relative; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; gap: 0.5rem; width: min(100%, 34rem); max-height: 100%;
  padding: 0.9rem 1rem; box-sizing: border-box; border: 0.14rem solid rgba(241, 165, 76, 0.65); border-radius: 0.9rem;
  color: #fffcf4; background: #172632; box-shadow: 0 0.6rem 1.6rem rgba(0, 0, 0, 0.5); text-align: center; cursor: default;
}
.shogi-game .team-ceremony__head { display: grid; gap: 0.2rem; }
.shogi-game .team-ceremony__kicker { margin: 0; color: var(--amber, #f1a54c); font-size: 0.8rem; font-weight: 900; letter-spacing: 0.15em; }
.shogi-game .team-ceremony__head h2 { margin: 0; font-size: 1.3rem; letter-spacing: 0.1em; }
.shogi-game .team-ceremony__host { margin: 0; color: #e8eef2; font-size: 0.85rem; }
.shogi-game .team-ceremony__host small {
  margin-right: 0.4em; padding: 0 0.4em; border-radius: 0.3rem; color: #172632; background: #cfd8de; font-size: 0.7rem; font-weight: 900;
}
.shogi-game .team-ceremony__body { display: grid; gap: 0.6rem; align-content: start; min-height: 0; overflow-y: auto; }
.shogi-game .team-ceremony__section { display: grid; gap: 0.3rem; }
.shogi-game .team-ceremony__section h3 { margin: 0; color: #cfd8de; font-size: 0.8rem; letter-spacing: 0.2em; }
.shogi-game .team-ceremony__places, .shogi-game .team-ceremony__prizes, .shogi-game .team-ceremony__lines { display: grid; gap: 0.3rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .team-ceremony__place {
  display: grid; grid-template-columns: 5.2rem minmax(0, 1fr); align-items: center; gap: 0.5rem; min-height: 2.4rem; padding: 0.25rem 0.6rem;
  border-radius: 0.6rem; background: rgba(43, 70, 91, 0.55); text-align: left; opacity: 0.4; transition: opacity 240ms ease, transform 240ms ease;
}
.shogi-game .team-ceremony__place--shown { opacity: 1; }
.shogi-game .team-ceremony__place--1.team-ceremony__place--shown { background: linear-gradient(90deg, rgba(241, 165, 76, 0.45), rgba(241, 165, 76, 0.15)); transform: scale(1.02); }
.shogi-game .team-ceremony__place--you.team-ceremony__place--shown { outline: 0.14rem solid var(--amber, #f1a54c); }
.shogi-game .team-ceremony__rank { display: flex; align-items: center; gap: 0.3rem; font-weight: 900; }
.shogi-game .team-ceremony__place--1 .team-ceremony__rank { color: var(--amber, #f1a54c); font-size: 1.05rem; }
.shogi-game .team-ceremony__trophy {
  display: inline-grid; place-items: center; width: 1.6rem; height: 1.6rem; border-radius: 50%; color: #172632; background: var(--amber, #f1a54c); font-size: 0.85rem;
}
.shogi-game .team-ceremony__teams { display: grid; gap: 0.1rem; min-width: 0; font-weight: 800; }
.shogi-game .team-ceremony__teams > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.shogi-game .team-ceremony__teams small, .shogi-game .team-ceremony__mine small {
  margin-left: 0.4em; padding: 0 0.4em; border-radius: 999px; color: #172632; background: var(--amber, #f1a54c); font-size: 0.68rem; font-weight: 900;
}
.shogi-game .team-ceremony__mine {
  display: flex; justify-content: space-between; margin: 0; padding: 0.3rem 0.6rem; border: 0.1rem dashed rgba(255, 252, 244, 0.4);
  border-radius: 0.6rem; font-weight: 800;
}
.shogi-game .team-ceremony__prize {
  display: grid; grid-template-columns: 4.4rem minmax(0, 1fr) auto; align-items: center; gap: 0.5rem; padding: 0.25rem 0.6rem;
  border-radius: 0.6rem; background: rgba(43, 70, 91, 0.55); text-align: left;
}
.shogi-game .team-ceremony__prize--you { outline: 0.14rem solid var(--amber, #f1a54c); background: rgba(241, 165, 76, 0.2); }
.shogi-game .team-ceremony__prize-label { color: var(--amber, #f1a54c); font-size: 0.82rem; font-weight: 900; }
.shogi-game .team-ceremony__prize-name { display: grid; min-width: 0; }
.shogi-game .team-ceremony__prize-name strong, .shogi-game .team-ceremony__prize-name small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.shogi-game .team-ceremony__prize-name small { color: #cfd8de; font-size: 0.7rem; }
.shogi-game .team-ceremony__prize-record { font-size: 0.85rem; font-weight: 800; white-space: nowrap; }
.shogi-game .team-ceremony__prize-record b {
  margin-left: 0.3em; padding: 0 0.4em; border-radius: 0.3rem; color: #fffcf4; background: #c0392b; font-size: 0.7rem;
}
.shogi-game .team-ceremony__photo { display: grid; gap: 0.3rem; margin: 0; animation: team-ceremony-photo 420ms ease-out; }
.shogi-game .team-ceremony__photo-frame {
  display: flex; justify-content: center; gap: 0.8rem; padding: 0.6rem; border: 0.35rem solid #e9dcc3; border-radius: 0.3rem;
  background: linear-gradient(180deg, #f6e7c8, #e4c99a); box-shadow: inset 0 0 0 0.12rem #b98d4f;
}
.shogi-game .team-ceremony__photo-member { display: grid; justify-items: center; gap: 0.15rem; color: #3a2a17; font-size: 0.75rem; font-weight: 900; }
.shogi-game .team-ceremony__photo-member img, .shogi-game .team-ceremony__photo-char {
  width: 3.4rem; height: 3.4rem; border-radius: 50%; object-fit: cover; object-position: 50% 4%; border: 0.12rem solid #fffcf4; background: #e9eef1;
}
.shogi-game .team-ceremony__photo-face--sprite { object-position: 50% 0 !important; image-rendering: pixelated; background: #2b465b !important; }
.shogi-game .team-ceremony__photo-char { display: grid; place-items: center; color: #172632; font-size: 1.3rem; }
.shogi-game .team-ceremony__photo figcaption { display: grid; font-weight: 900; }
.shogi-game .team-ceremony__photo figcaption small { color: #cfd8de; font-size: 0.72rem; font-weight: 700; }
.shogi-game .team-ceremony__lines li { display: flex; align-items: center; gap: 0.5rem; text-align: left; }
.shogi-game .team-ceremony__lines img {
  flex: none; width: 2.5rem; height: 2.5rem; border-radius: 50%; object-fit: cover; object-position: 50% 4%; border: 0.1rem solid rgba(255, 252, 244, 0.7); background: #e9eef1;
}
.shogi-game .team-ceremony__lines li > span {
  display: grid; flex: 1; min-width: 0; padding: 0.35rem 0.6rem; border-radius: 0.8rem; color: #1d303f; background: #fffcf4;
  font-size: 0.86rem; font-weight: 700; line-height: 1.45;
}
.shogi-game .team-ceremony__lines small { color: #5d6d7e; font-size: 0.68rem; }
.shogi-game .team-ceremony__primary {
  width: 100%; min-height: 44px; border: 0; border-radius: 999px; color: #172632; background: var(--amber, #f1a54c);
  font: inherit; font-weight: 900; cursor: pointer;
}
.shogi-game .team-ceremony__primary small { margin-left: 0.3em; font-size: 0.75rem; }
.shogi-game .team-ceremony__hint { margin: 0; color: #8fa3b0; font-size: 0.75rem; }
@keyframes team-ceremony-photo { from { opacity: 0; transform: translateY(0.6rem); } to { opacity: 1; transform: none; } }
/* 広い画面と横向きの低い画面は、団体の部と個人の部を左、記念撮影と一言を右に並べる */
@media (min-width: 900px) {
  .shogi-game .team-ceremony__panel { width: min(100%, 56rem); }
  .shogi-game .team-ceremony__body { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); column-gap: 1rem; }
  .shogi-game .team-ceremony__body > .team-ceremony__photo { grid-column: 2; grid-row: 1; }
  .shogi-game .team-ceremony__body > .team-ceremony__lines { grid-column: 2; grid-row: 2; align-self: start; }
  .shogi-game .team-ceremony__body > .team-ceremony__section { grid-column: 1; }
}
@media (orientation: landscape) and (max-height: 560px) {
  .shogi-game .team-ceremony__panel { width: min(100%, 52rem); padding: 0.6rem 0.8rem; }
  .shogi-game .team-ceremony__head h2 { font-size: 1.05rem; }
  .shogi-game .team-ceremony__body { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); column-gap: 0.8rem; }
  .shogi-game .team-ceremony__place { min-height: 2rem; }
  .shogi-game .team-ceremony__photo-member img, .shogi-game .team-ceremony__photo-char { width: 2.6rem; height: 2.6rem; }
}
@media (prefers-reduced-motion: reduce) {
  .shogi-game .team-ceremony__place { transition: none; }
  .shogi-game .team-ceremony__photo { animation: none; }
}
</style>
