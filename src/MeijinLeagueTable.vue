<template>
  <!--
    順位戦のリーグ表(docs/meijin-design.mdの7章)。行は今期の順位(勝ち数、同じなら前期の順位)。
    自分の行は琥珀、次の相手は朱。昇級ラインと、降級点(降級)ラインに線を引く。表は枠の中だけを動かす(U:7-5)。
  -->
  <div ref="frameEl" class="meijin-table" data-league-table>
    <table>
      <thead>
        <tr>
          <th scope="col" class="meijin-table__place">順</th>
          <th scope="col" class="meijin-table__name">棋士</th>
          <th scope="col" class="meijin-table__score">勝敗</th>
          <th scope="col" class="meijin-table__marks">
            <span class="meijin-table__marks-head" :style="{ '--rounds': String(rounds) }">
              <i v-for="round in rounds" :key="round" :class="{ 'is-current': round - 1 === currentRound }">{{ round }}</i>
            </span>
          </th>
        </tr>
      </thead>
      <tbody>
        <template v-for="row in rows" :key="row.id">
          <tr
            :class="['meijin-table__row', `meijin-table__row--${row.zone || 'mid'}`, { 'meijin-table__row--you': row.you, 'meijin-table__row--next': row.next }]"
            :data-league-row="row.id"
            :data-you="row.you ? '' : undefined"
          >
            <td class="meijin-table__place">{{ row.place }}</td>
            <th scope="row" class="meijin-table__name">
              <span class="meijin-table__name-text">{{ row.you ? youName : row.name }}</span>
              <small>{{ row.dan }}</small>
              <span v-if="row.you" class="meijin-table__tag meijin-table__tag--you">あなた</span>
              <span v-else-if="row.next" class="meijin-table__tag meijin-table__tag--next">次の相手</span>
              <span v-if="row.story === 'hanane'" class="meijin-table__tag meijin-table__tag--rival">ライバル</span>
              <span v-if="row.points" class="meijin-table__tag meijin-table__tag--point" :aria-label="`降級点${row.points}`">{{ "▼".repeat(row.points) }}</span>
            </th>
            <td class="meijin-table__score"><b>{{ row.wins }}</b>-{{ row.losses }}</td>
            <td class="meijin-table__marks">
              <span class="meijin-table__marks-row" :style="{ '--rounds': String(rounds) }" aria-hidden="true">
                <i v-for="(mark, index) in row.marks" :key="index" :class="`is-${mark ?? 'later'}`">{{ mark === "win" ? "○" : mark === "loss" ? "●" : "" }}</i>
              </span>
            </td>
          </tr>
          <tr v-if="row.place === lines.promote && lines.promote" class="meijin-table__line meijin-table__line--promote" aria-hidden="true">
            <td colspan="4"><span>{{ promoteLabel }}</span></td>
          </tr>
          <tr v-if="bottomLine && row.place === rows.length - bottomLine.count" class="meijin-table__line meijin-table__line--bottom" aria-hidden="true">
            <td colspan="4"><span>{{ bottomLine.label }}</span></td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch, type PropType } from "vue";

export type LeagueRow = {
  id: string; place: number; name: string; dan: string; wins: number; losses: number; story: string | null;
  you: boolean; next: boolean; points: number; zone: string; marks: (string | null)[];
};

const props = defineProps({
  rows: { type: Array as PropType<LeagueRow[]>, required: true },
  rounds: { type: Number, required: true },
  currentRound: { type: Number, default: -1 },
  lines: { type: Object as PropType<{ promote: number; point: number; relegate: number }>, required: true },
  /** A級なら、昇級ラインの代わりに「名人挑戦」。 */
  classId: { type: String, default: "C2" },
  youName: { type: String, default: "あなた" },
});

const promoteLabel = computed(() => (props.classId === "A" ? "ここまで 名人挑戦" : "ここまで 昇級"));
const bottomLine = computed(() => {
  if (props.lines.relegate) return { count: props.lines.relegate, label: "ここから 降級" };
  if (props.lines.point) return { count: props.lines.point, label: "ここから 降級点" };
  return null;
});

const frameEl = ref<HTMLElement | null>(null);
/** 自分の行が見えるよう、表を送る(ページはスクロールさせない)。 */
function showYou() {
  const frame = frameEl.value;
  const row = frame?.querySelector<HTMLElement>("[data-you]");
  if (!frame || !row) return;
  frame.scrollTop = Math.max(0, row.offsetTop - frame.clientHeight / 2 + row.offsetHeight / 2);
}
onMounted(() => nextTick(showYou));
watch(() => props.currentRound, () => nextTick(showYou));
</script>

<style>
.shogi-game .meijin-table { min-height: 0; overflow: auto; border-radius: 0.6rem; background: #172632; scrollbar-width: thin; container-type: inline-size; }
.shogi-game .meijin-table table { width: 100%; border-collapse: collapse; color: #fffcf4; font-size: 0.86em; }
.shogi-game .meijin-table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 0.35rem 0.4rem;
  color: #9fb3c8;
  background: #0f1828;
  font-size: 0.8em;
  font-weight: 900;
  text-align: left;
}
.shogi-game .meijin-table td,
.shogi-game .meijin-table tbody th { padding: 0.3rem 0.4rem; border-bottom: 1px solid rgba(159, 179, 200, 0.14); text-align: left; font-weight: 700; }
.shogi-game .meijin-table__place { width: 2.2em; color: #9fb3c8; text-align: right !important; font-variant-numeric: tabular-nums; }
.shogi-game .meijin-table__name { min-width: 0; }
.shogi-game .meijin-table__name-text { font-weight: 900; }
.shogi-game .meijin-table__name small { margin-left: 0.3rem; color: #9fb3c8; font-size: 0.8em; }
.shogi-game .meijin-table__score { width: 3.6em; white-space: nowrap; font-variant-numeric: tabular-nums; }
.shogi-game .meijin-table__score b { color: #f1a54c; font-size: 1.1em; }
.shogi-game .meijin-table__marks-head,
.shogi-game .meijin-table__marks-row { display: grid; grid-template-columns: repeat(var(--rounds), 1.15em); gap: 0.12em; }
.shogi-game .meijin-table__marks-head i,
.shogi-game .meijin-table__marks-row i { display: grid; place-items: center; height: 1.15em; font-style: normal; font-size: 0.85em; }
.shogi-game .meijin-table__marks-head i.is-current { color: #f1a54c; }
.shogi-game .meijin-table__marks-row i.is-win { color: #f1a54c; }
.shogi-game .meijin-table__marks-row i.is-loss { color: #8094a8; }
.shogi-game .meijin-table__marks-row i.is-later { border-radius: 0.2em; background: rgba(159, 179, 200, 0.1); }
.shogi-game .meijin-table__row--you { background: rgba(241, 165, 76, 0.24); }
.shogi-game .meijin-table__row--you .meijin-table__name-text { color: #ffd27a; }
.shogi-game .meijin-table__row--next { background: rgba(224, 116, 94, 0.2); }
.shogi-game .meijin-table__row--promote .meijin-table__place { color: #f1a54c; }
.shogi-game .meijin-table__row--point .meijin-table__place,
.shogi-game .meijin-table__row--demote .meijin-table__place { color: #e0745e; }
.shogi-game .meijin-table__tag { display: inline-block; margin-left: 0.3rem; padding: 0 0.35rem; border-radius: 999px; font-size: 0.72em; font-weight: 900; vertical-align: 1px; }
.shogi-game .meijin-table__tag--you { color: #172632; background: #f1a54c; }
.shogi-game .meijin-table__tag--next { color: #fffcf4; background: #c4604c; }
.shogi-game .meijin-table__tag--rival { color: #1e2d3d; background: #d4a93a; }
.shogi-game .meijin-table__tag--point { padding: 0; color: #e0745e; background: none; }
.shogi-game .meijin-table__line td { padding: 0; border-bottom: 0; }
.shogi-game .meijin-table__line span {
  display: block;
  padding: 0.1rem 0.5rem;
  border-top: 2px dashed currentColor;
  font-size: 0.72em;
  font-weight: 900;
}
.shogi-game .meijin-table__line--promote { color: #f1a54c; }
.shogi-game .meijin-table__line--bottom { color: #e0745e; }
/* 狭い枠では、回戦ごとの○●を省く(勝敗は残す)。 */
@container (max-width: 26rem) {
  .shogi-game .meijin-table__marks { display: none; }
}
</style>
