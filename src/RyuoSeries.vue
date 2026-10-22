<template>
  <!--
    竜王戦の③ 番勝負(docs/ryuo-stages-design.mdの4章)。挑戦者決定三番勝負と、竜王との七番勝負。
    いまの番勝負を大きく(自分と相手・大きな勝ち数・星取り)、済んだ三番勝負は1行、まだの七番勝負は「竜王が待つ」。
    いちばん下に、この期の歩み(段階ごとの勝敗)。
  -->
  <div class="ryuo-series" data-series>
    <p v-if="before" class="ryuo-series__line" data-series-before>
      <span>{{ before.label }}</span>
      <b>{{ before.me?.name }} {{ before.wins.me }} - {{ before.wins.them }} {{ before.them?.name }}</b>
      <span class="ryuo-series__mini" aria-hidden="true">
        <i v-for="game in before.games" :key="game.no" :class="{ 'ryuo-series__mini--lose': !game.win }">{{ game.win ? "○" : "●" }}</i>
      </span>
      <strong v-if="before.userIn && before.winner === 'me'">挑戦権獲得</strong>
    </p>

    <section v-if="main" class="ryuo-series__bout" :aria-label="`${main.label} ${main.me?.name} ${main.wins.me}勝 ${main.them?.name} ${main.wins.them}勝`">
      <p class="ryuo-series__label">{{ main.label }}</p>
      <div class="ryuo-series__side">
        <span v-if="main.userIn" class="ryuo-series__piece" aria-hidden="true">自</span>
        <span v-else class="ryuo-series__seal" aria-hidden="true">{{ main.me?.name.slice(0, 1) }}</span>
        <span class="ryuo-series__name">{{ main.userIn ? youName : main.me?.name }}<small>{{ sideNote(main, "me") }}</small></span>
      </div>
      <div class="ryuo-series__score">
        <strong>{{ main.wins.me }}<i>-</i>{{ main.wins.them }}</strong>
        <small>{{ scoreNote(main) }}</small>
      </div>
      <div class="ryuo-series__side ryuo-series__side--them">
        <span class="ryuo-series__name">{{ main.them?.name }}<small>{{ sideNote(main, "them") }}</small></span>
        <span class="ryuo-series__seal ryuo-series__seal--them" aria-hidden="true">{{ main.them?.name.slice(0, 1) }}</span>
      </div>
    </section>
    <section v-else class="ryuo-series__bout ryuo-series__bout--wait" aria-label="番勝負">
      <p class="ryuo-series__label">竜王戦七番勝負</p>
      <div class="ryuo-series__side">
        <span class="ryuo-series__piece ryuo-series__piece--ghost" aria-hidden="true">?</span>
        <span class="ryuo-series__name">挑戦者<small>決勝トーナメントの勝者が、三番勝負で決まる</small></span>
      </div>
      <div class="ryuo-series__score"><strong class="ryuo-series__vs">VS</strong><small>先に4勝で竜王</small></div>
      <div class="ryuo-series__side ryuo-series__side--them">
        <span class="ryuo-series__name">{{ holder?.name ?? "竜王" }}<small>竜王が頂上で待つ</small></span>
        <span class="ryuo-series__seal ryuo-series__seal--them" aria-hidden="true">{{ holder?.name.slice(0, 1) ?? "竜" }}</span>
      </div>
    </section>

    <ol class="ryuo-series__hoshi" :style="{ '--games': String(hoshi.length) }" aria-label="星取り">
      <li
        v-for="cell in hoshi"
        :key="cell.no"
        :class="['ryuo-series__game', `ryuo-series__game--${cell.state}`]"
        :data-game="cell.no"
      >
        <span>第{{ cell.no }}局</span>
        <b>{{ cell.mark }}</b>
        <small>{{ cell.note }}</small>
      </li>
    </ol>
    <p class="ryuo-series__hint">○はあなたの勝ち、●は負け。先に{{ main?.need ?? 4 }}勝した方の勝ち。決着がつけば、残りの局は指さない。</p>
    <p v-if="!before && main?.key === 'playoff'" class="ryuo-series__line ryuo-series__line--next">
      <span>勝てば竜王戦七番勝負</span><b>竜王 {{ holder?.name ?? "" }} が待つ</b>
    </p>

    <section class="ryuo-series__journey" aria-label="この期の歩み">
      <h3>この期の歩み</h3>
      <ol>
        <li
          v-for="step in journey"
          :key="step.key"
          :class="`ryuo-series__step--${step.state}`"
        >
          <b>{{ step.label }}</b>
          <span>{{ step.record }}</span>
          <small>{{ step.note }}</small>
        </li>
      </ol>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, type PropType } from "vue";

type Brief = { id: string; name: string; dan: string; profile?: { held?: string[] } | null } | null;
export type SeriesView = {
  key: string; label: string; need: number; maxGames: number; userIn: boolean;
  me: Brief; them: Brief; wins: { me: number; them: number };
  games: { no: number; win: boolean; color: string; how: string }[];
  nextNo: number | null; unplayed: number; winner: "me" | "them" | null;
};
type Stage = { key: string; label: string; status: string; wins: number; losses: number };

const props = defineProps({
  series: { type: Array as PropType<SeriesView[]>, required: true },
  holder: { type: Object as PropType<Brief>, default: null },
  stages: { type: Array as PropType<Stage[]>, required: true },
  youName: { type: String, default: "あなた" },
  /** 次の局の自分の先後(振り駒の前は空)。 */
  nextColor: { type: String, default: "" },
  /** 防衛戦(自分が竜王で、七番勝負を受けて立つ)。 */
  defense: { type: Boolean, default: false },
});

/** いま大きく出す番勝負(七番勝負があれば七番勝負、なければ三番勝負)と、その前の済んだ三番勝負。 */
const main = computed(() => props.series.find(({ key }) => key === "finals") ?? props.series.find(({ key }) => key === "playoff") ?? null);
const before = computed(() => (main.value?.key === "finals" ? props.series.find(({ key }) => key === "playoff") ?? null : null));

/** 勝ち方の短い言葉(core/ryuo-simulation.mjsのclassifyWin。名鑑のHOW_SHORTと同じ言い方)。 */
const HOW_SHORT: Record<string, string> = {
  opening: "序盤のリード", middle: "中盤の抜け出し", ending: "終盤の競り合い", comeback: "逆転", recover: "序盤の不利から挽回",
};
const colorText = (color: string) => (color === "black" ? "先手" : color === "white" ? "後手" : "");
/** 星取りの札。済んだ局(○●と先後・勝ち方)、次の局、まだの局、指さない局。 */
const hoshi = computed(() => {
  const series = main.value;
  const count = series?.maxGames ?? 7;
  return Array.from({ length: count }, (_, index) => {
    const no = index + 1;
    const game = series?.games.find((entry) => entry.no === no);
    if (game) {
      return {
        no, state: game.win ? "win" : "lose", mark: game.win ? "○" : "●",
        note: [colorText(game.color), HOW_SHORT[game.how] ?? ""].filter(Boolean).join("・"),
      };
    }
    if (series?.nextNo === no) return { no, state: "next", mark: "次", note: colorText(props.nextColor) || "振り駒" };
    if (series?.winner) return { no, state: "skip", mark: "", note: "指さない" };
    return { no, state: "later", mark: "", note: "" };
  });
});

function sideNote(series: SeriesView, side: "me" | "them") {
  const brief = series[side];
  const titleHolder = (who: Brief) => {
    const count = who?.profile?.held?.length ?? 0;
    return count > 1 ? `竜王・${count}冠` : "竜王";
  };
  // 防衛戦の七番勝負は、自分が竜王で、相手が挑戦者。
  if (series.key === "finals" && props.defense) return side === "me" ? "竜王(防衛)" : "挑戦者";
  if (side === "me" && series.userIn) return series.key === "finals" ? "挑戦者" : "決勝トーナメント勝者";
  if (series.key === "finals" && side === "them") return titleHolder(brief);
  return brief?.dan ?? "";
}
function scoreNote(series: SeriesView) {
  const defending = series.key === "finals" && props.defense;
  if (series.winner === "me") return series.userIn ? (defending ? "竜王防衛" : series.key === "finals" ? "竜王獲得" : "挑戦権獲得") : `${series.me?.name}の勝ち`;
  if (series.winner === "them") return `${series.them?.name}の勝ち`;
  const rest = series.need - series.wins.me;
  return defending ? `防衛まであと${rest}勝` : series.key === "finals" ? `竜王まであと${rest}勝` : `挑戦権まであと${rest}勝`;
}

/** この期の歩み。①②と三番勝負・七番勝負の勝敗。 */
const journey = computed(() => {
  const [group, final] = props.stages;
  const record = (wins: number, losses: number) => `${wins}勝${losses}敗`;
  const steps = [
    { key: "group", label: `① ${group?.label ?? ""}`, record: group?.status === "watch" ? "—" : record(group?.wins ?? 0, group?.losses ?? 0), note: group?.status === "watch" ? "竜王は出ない" : "", state: group?.status ?? "" },
    { key: "final", label: "② 決勝トーナメント", record: final?.status === "watch" ? "—" : record(final?.wins ?? 0, final?.losses ?? 0), note: final?.status === "watch" ? "竜王は出ない" : "", state: final?.status ?? "" },
  ];
  for (const series of props.series) {
    if (!series.userIn) continue;
    steps.push({
      key: series.key,
      label: series.key === "finals" ? "③ 七番勝負" : "挑戦者決定三番勝負",
      record: record(series.wins.me, series.wins.them),
      note: scoreNote(series),
      state: series.winner ? "done" : "current",
    });
  }
  return steps;
});
</script>

<style>
.shogi-game .ryuo-series { display: grid; align-content: start; gap: 0.75rem; min-width: 0; }
.shogi-game .ryuo-series__line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem 0.75rem;
  margin: 0;
  padding: 0.55rem 0.8rem;
  border-radius: 0.6rem;
  color: #9fb3c8;
  background: #172632;
  font-size: 0.85em;
}
.shogi-game .ryuo-series__line b { color: #fffcf4; }
.shogi-game .ryuo-series__line strong { margin-left: auto; color: #f1a54c; }
.shogi-game .ryuo-series__mini { display: flex; gap: 0.2rem; }
.shogi-game .ryuo-series__mini i { display: grid; place-items: center; width: 1.3rem; height: 1.3rem; border-radius: 0.3rem; color: #172632; background: #f1a54c; font-style: normal; font-weight: 900; }
.shogi-game .ryuo-series__mini i.ryuo-series__mini--lose { color: #fffcf4; background: #55697d; }
.shogi-game .ryuo-series__bout {
  display: grid;
  /* 背の高い画面では、対戦の札と星取りを大きくして、下を空けない。 */
  min-height: clamp(8rem, 24vh, 15rem);
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 0.6rem 1rem;
  padding: 0.8rem 1.1rem 1rem;
  border: 2px solid #3a526e;
  border-radius: 0.9rem;
  background: linear-gradient(100deg, rgba(61, 111, 165, 0.5), rgba(34, 52, 76, 0.6) 45%, rgba(196, 96, 76, 0.5));
}
.shogi-game .ryuo-series__label { grid-column: 1 / -1; margin: 0; color: #ffd27a; font-size: 0.85em; font-weight: 900; text-align: center; }
.shogi-game .ryuo-series__side { display: flex; align-items: center; gap: 0.75rem; min-width: 0; }
.shogi-game .ryuo-series__side--them { justify-content: flex-end; text-align: right; }
.shogi-game .ryuo-series__name { display: grid; min-width: 0; color: #fffcf4; font-size: clamp(1.1em, 2vw, 1.6em); font-weight: 900; overflow-wrap: anywhere; }
.shogi-game .ryuo-series__name small { color: #c9d6e6; font-size: 0.55em; font-weight: 800; }
.shogi-game .ryuo-series__piece {
  flex: none;
  display: grid;
  place-items: center;
  width: 3.4rem;
  height: 3.9rem;
  padding-top: 0.5rem;
  box-sizing: border-box;
  clip-path: polygon(50% 0, 88% 16%, 100% 100%, 0 100%, 12% 16%);
  color: #1a2433;
  background: #fffcf4;
  font-size: 1.6rem;
  font-weight: 900;
}
.shogi-game .ryuo-series__piece--ghost { color: #9fb3c8; background: #33465e; }
.shogi-game .ryuo-series__seal {
  flex: none;
  display: grid;
  place-items: center;
  width: 3.4rem;
  height: 3.4rem;
  border: 3px solid #fffcf4;
  border-radius: 0.5rem;
  color: #fffcf4;
  background: #3d6fa5;
  box-shadow: 3px 3px 0 #0b1320;
  font-size: 1.6rem;
  font-weight: 900;
}
.shogi-game .ryuo-series__seal--them { color: #172632; background: #d9b860; }
.shogi-game .ryuo-series__score { display: grid; justify-items: center; }
.shogi-game .ryuo-series__score strong { color: #fffcf4; font-size: clamp(2.6em, 5vw, 3.6em); font-weight: 900; line-height: 1; white-space: nowrap; }
.shogi-game .ryuo-series__score strong i { margin: 0 0.4rem; color: #9fb3c8; font-style: normal; }
.shogi-game .ryuo-series__score strong.ryuo-series__vs { color: #ffd27a; font-style: italic; }
.shogi-game .ryuo-series__score small { color: #f1a54c; font-size: 0.85em; font-weight: 900; white-space: nowrap; }
.shogi-game .ryuo-series__hoshi {
  display: grid;
  grid-template-columns: repeat(var(--games, 7), minmax(0, 1fr));
  gap: 0.45rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.shogi-game .ryuo-series__game {
  display: grid;
  justify-items: center;
  align-content: start;
  gap: 0.2rem;
  min-width: 0;
  min-height: clamp(5.5rem, 17vh, 10rem);
  padding: 0.6rem 0.25rem;
  border: 2px solid #3a526e;
  border-radius: 0.6rem;
  color: #9fb3c8;
  background: #22344c;
  font-size: 0.75em;
  text-align: center;
}
.shogi-game .ryuo-series__game b { min-height: 1.2em; color: #fffcf4; font-size: 2.2em; line-height: 1.1; }
.shogi-game .ryuo-series__game small { min-height: 1.3em; font-size: 0.95em; line-height: 1.3; }
.shogi-game .ryuo-series__game--win b { color: #f1a54c; }
.shogi-game .ryuo-series__game--lose b { color: #8ea0b4; }
.shogi-game .ryuo-series__game--next { border-color: #e0745e; box-shadow: 0 0 0 3px rgba(224, 116, 94, 0.35); color: #fffcf4; }
.shogi-game .ryuo-series__game--next b { color: #e0745e; font-size: 1.6em; }
.shogi-game .ryuo-series__game--later { border-style: dashed; background: transparent; opacity: 0.6; }
.shogi-game .ryuo-series__game--skip { border-style: dashed; background: transparent; opacity: 0.35; }
.shogi-game .ryuo-series__hint { margin: 0; color: #9fb3c8; font-size: 0.78em; }
.shogi-game .ryuo-series__journey h3 { margin: 0.2rem 0 0.45rem; color: #9fb3c8; font-size: 0.85em; }
.shogi-game .ryuo-series__journey ol { display: grid; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr)); gap: 0.45rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .ryuo-series__journey li { display: grid; gap: 0.1rem; padding: 0.55rem 0.7rem; border-top: 4px solid #55697d; border-radius: 0.5rem; background: #172632; font-size: 0.8em; }
.shogi-game .ryuo-series__journey li b { color: #c9d6e6; }
.shogi-game .ryuo-series__journey li span { color: #fffcf4; font-size: 1.25em; font-weight: 900; }
.shogi-game .ryuo-series__journey li small { color: #9fb3c8; }
.shogi-game .ryuo-series__journey li.ryuo-series__step--done { border-top-color: #3f7d5a; }
.shogi-game .ryuo-series__journey li.ryuo-series__step--current { border-top-color: #f1a54c; }
/* 狭い枠(スマホ縦): 星取りを4列に折り返し、対戦の札を縦に詰める。 */
@container (max-width: 30rem) {
  .shogi-game .ryuo-series__hoshi { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .shogi-game .ryuo-series__bout { grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); padding: 0.6rem; }
  .shogi-game .ryuo-series__side { flex-direction: column; text-align: center; gap: 0.35rem; }
  .shogi-game .ryuo-series__side--them { flex-direction: column-reverse; text-align: center; }
  .shogi-game .ryuo-series__piece,
  .shogi-game .ryuo-series__seal { width: 2.8rem; height: 2.8rem; font-size: 1.3rem; }
  .shogi-game .ryuo-series__piece { height: 3.2rem; }
}
</style>
