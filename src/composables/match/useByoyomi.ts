import { computed, onBeforeUnmount, ref, watch } from "vue";
import { byoyomiRing, byoyomiSound } from "../../core/byoyomi.mjs";

/*
 * 大会の秒読みの演出(docs/tournament-match-presence-design.mdの7章)。
 * プレイヤーの手番ごとに残り秒を数え、10秒から1秒ごとに音を鳴らす。0秒で「時間いっぱい」と出して止まり、負けにはしない。
 * 閃き・図鑑・開幕の札などのあいだ(paused)と、画面を隠しているあいだは数えない。
 */
export function useByoyomi({ seconds, shown, paused, turnKey, play }: {
  /** 秒読みの秒数。0は演出なし。 */
  seconds: () => number;
  /** 輪を出すとき(大会の対局で、プレイヤーの手番)。 */
  shown: () => boolean;
  /** 数えるのを止めるとき。輪は残す。 */
  paused: () => boolean;
  /** 変わったら数え直す(手数。待ったで戻したときも変わる)。 */
  turnKey: () => unknown;
  play: (kind: "byoyomi" | "byoyomi-end") => void;
}) {
  const left = ref(0);
  let timer: ReturnType<typeof setInterval> | null = null;

  const enabled = computed(() => seconds() > 0 && shown());
  const running = computed(() => enabled.value && !paused() && left.value > 0);

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }
  function tick() {
    if (typeof document !== "undefined" && document.hidden) return;
    left.value = Math.max(0, left.value - 1);
    const sound = byoyomiSound(left.value);
    if (sound) play(sound);
  }
  watch(running, (value) => {
    stop();
    if (value) timer = setInterval(tick, 1000);
  });
  // 手番が来るたび(と、秒読みの局を始めたとき)に、満タンから数え直す。
  watch([turnKey, enabled], () => {
    left.value = seconds();
  }, { immediate: true });
  onBeforeUnmount(stop);

  const byoyomiState = computed(() => (enabled.value ? byoyomiRing(left.value, seconds()) : null));
  return { byoyomiState };
}
