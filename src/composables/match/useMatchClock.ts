import { computed, onBeforeUnmount, ref, watch } from "vue";
import {
  clockAt,
  commitClock,
  cpuThinkPlan,
  createClock,
  fastForwardProgress,
  playerClockView,
  restoreClock,
} from "../../core/time-control.mjs";

/*
 * 大会の対局の持ち時間(docs/tournament-match-presence-design.mdの15章)。
 * プレイヤーの時計は実際の時間で減り、使い切ったら秒読み(0秒でも負けにはしない)。
 * 相手(CPU)の時計は、1手ごとに決めた「考えた時間」を、考えているあいだに早送りで減らす。
 */
type Side = "black" | "white";
type Control = { main: number; byoyomi: number; increment: number; days: number; key: string; text: string };
type Clock = { startPly: number; marks: Record<string, { black: number; white: number }> };
type CpuPlan = { ply: number; seconds: number; pressure: "calm" | "long" | "low" | "byoyomi"; short: boolean; left: number; side: Side };

/** 考え終えた相手の時計を回し切る長さ(ミリ秒)。 */
const SETTLE_MS = 260;
/** 秒読みの手で、相手の時計が使い切ったように見せないための最低の残り(秒)。 */
const CPU_BYOYOMI_FLOOR = 1;

export function useMatchClock({ running, humanSide, sideToMove, moveCount, paused, character }: {
  /** 時計を動かすとき(対局中で、終局していない)。 */
  running: () => boolean;
  humanSide: () => Side;
  sideToMove: () => Side;
  moveCount: () => number;
  /** プレイヤーの時計を止めるとき(図鑑・札・休憩のあいだ)。 */
  paused: () => boolean;
  /** 相手の棋風(考える速さ)。 */
  character: () => unknown;
}) {
  const clock = ref<Clock | null>(null);
  /** この対局の決まり(対局を始めたときに決め、終局のあとも残す)。大会の対局でなければnull。 */
  const rule = ref<Control | null>(null);
  const control = () => rule.value;
  /** プレイヤーがこの手番で使った秒。 */
  const turnUsed = ref(0);
  const cpuPlan = ref<CpuPlan | null>(null);
  /** 早送りの進み(0〜1)。 */
  const cpuProgress = ref(0);
  let cpuStartedAt = 0;
  let settle: { from: number; at: number; resolve: () => void } | null = null;
  let frame = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  const reduceMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

  function stopFrame() {
    if (frame && typeof cancelAnimationFrame !== "undefined") cancelAnimationFrame(frame);
    frame = 0;
  }
  function step() {
    frame = 0;
    const plan = cpuPlan.value;
    if (!plan) return;
    if (settle) {
      const t = Math.min(1, (now() - settle.at) / SETTLE_MS);
      cpuProgress.value = settle.from + (1 - settle.from) * t;
      if (t >= 1) {
        const done = settle.resolve;
        settle = null;
        done();
        return;
      }
    } else {
      cpuProgress.value = fastForwardProgress((now() - cpuStartedAt) / 1000, plan.seconds);
    }
    if (typeof requestAnimationFrame !== "undefined") frame = requestAnimationFrame(step);
  }

  /** 対局を始める(大会の対局でなければ時計なし)。usedPliesは、途中の局面から指すときの手数。 */
  function start(next: Control | null, { usedPlies = 0 }: { usedPlies?: number } = {}) {
    finishAnimation();
    cpuPlan.value = null;
    turnUsed.value = 0;
    rule.value = next;
    clock.value = next ? createClock(next, { usedPlies }) : null;
  }
  /** 時計をなくす(大会でない対局)。 */
  function clear() {
    finishAnimation();
    cpuPlan.value = null;
    turnUsed.value = 0;
    rule.value = null;
    clock.value = null;
  }
  /** 保存から戻す(保存の決まりがなければ、いまの期の決まり)。 */
  function restore(saved: unknown, fallback: Control | null) {
    finishAnimation();
    cpuPlan.value = null;
    turnUsed.value = 0;
    const value = saved && typeof saved === "object" ? saved as { rule?: Control } : null;
    const savedRule = value?.rule && Number.isFinite(value.rule.main) && value.rule.main > 0 ? value.rule : null;
    rule.value = savedRule ?? fallback;
    clock.value = rule.value ? restoreClock(saved) ?? createClock(rule.value) : null;
  }
  const snapshot = () => (clock.value && rule.value ? JSON.parse(JSON.stringify({ ...clock.value, rule: rule.value })) : null);

  function finishAnimation() {
    stopFrame();
    if (settle) {
      const done = settle.resolve;
      settle = null;
      done();
    }
    cpuProgress.value = 0;
  }

  /**
   * 相手が考え始める。この手で使う時間と、時間の重圧を返す(同じ手数で2回呼んでも同じもの)。
   * 時計がなければnull。
   */
  function beginCpuThink(): { pressure: CpuPlan["pressure"]; short: boolean; seconds: number } | null {
    const current = control();
    if (!current || !clock.value) return null;
    const ply = moveCount();
    if (cpuPlan.value?.ply === ply) return cpuPlan.value;
    const side = sideToMove();
    const left = clockAt(clock.value, ply)?.[side] ?? current.main;
    const plan = cpuThinkPlan({ control: current, left, ply, rng: { next: Math.random }, character: character() });
    finishAnimation();
    cpuPlan.value = { ...plan, ply, left, side } as CpuPlan;
    cpuStartedAt = now();
    if (reduceMotion()) cpuProgress.value = 1;
    else step();
    return cpuPlan.value;
  }
  /** 相手が指す前に、時計を回し切る(短い時間)。 */
  function settleCpuThink(): Promise<void> {
    if (!cpuPlan.value || cpuProgress.value >= 1 || reduceMotion()) {
      cpuProgress.value = cpuPlan.value ? 1 : 0;
      return Promise.resolve();
    }
    stopFrame();
    return new Promise((resolve) => {
      settle = { from: cpuProgress.value, at: now(), resolve };
      step();
    });
  }

  // 1手指すたびに、指した側の時計に記録する。待ったで戻したら、戻した手数の残りに戻る(記録の手数で引くので、何もしない)。
  watch(moveCount, (next, previous) => {
    const current = control();
    if (!current || !clock.value) return;
    if (next === previous + 1) {
      const mover: Side = sideToMove() === "black" ? "white" : "black";
      const plan = cpuPlan.value?.ply === previous ? cpuPlan.value : null;
      const spent = mover === humanSide() ? turnUsed.value : plan?.seconds ?? Math.round(current.byoyomi / 2 || 5);
      clock.value = commitClock(clock.value, { ply: next, side: mover, spent, control: current });
    }
    turnUsed.value = 0;
    // 相手がもう次の手を考え始めていたら(手を指した直後に考え始め、この見張りはそのあとに動く)、その早送りは残す。
    if (cpuPlan.value?.ply === next) return;
    finishAnimation();
    cpuPlan.value = null;
  });

  // プレイヤーの手番の時計(1秒ずつ。画面を隠しているあいだは数えない)。
  const playerTicking = computed(() => Boolean(control() && clock.value && running() && sideToMove() === humanSide() && !paused()));
  watch(playerTicking, (value) => {
    if (timer) clearInterval(timer);
    timer = null;
    if (value) {
      timer = setInterval(() => {
        if (typeof document !== "undefined" && document.hidden) return;
        turnUsed.value += 1;
      }, 1000);
    }
  }, { immediate: true });
  onBeforeUnmount(() => {
    if (timer) clearInterval(timer);
    stopFrame();
  });

  /** プレイヤーが秒読みに入ったか(名札の秒読みの輪を、その秒数で出す)。 */
  const playerByoyomi = computed(() => {
    const current = control();
    if (!current || !clock.value || !running() || sideToMove() !== humanSide()) return false;
    const left = clockAt(clock.value, moveCount())?.[humanSide()] ?? current.main;
    return playerClockView(left, turnUsed.value, current).byoyomi;
  });

  /** 盤の名札の横の時計(残りの秒と、秒読みの残り秒)。fastは、早送りで減っている側。 */
  const clocks = computed(() => {
    const current = control();
    if (!current || !clock.value) return null;
    const ply = moveCount();
    const base = clockAt(clock.value, ply) ?? { black: current.main, white: current.main };
    const view: { black: number; white: number; blackByoyomi?: number; whiteByoyomi?: number; fast: Side | "" } = { ...base, fast: "" };
    const setSide = (side: Side, remaining: number, byoyomi: number | undefined) => {
      view[side] = Math.max(0, Math.round(remaining));
      if (side === "black") view.blackByoyomi = byoyomi;
      else view.whiteByoyomi = byoyomi;
    };
    for (const side of ["black", "white"] as const) {
      if (!current.increment && base[side] <= 0) setSide(side, 0, current.byoyomi);
    }
    const toMove = sideToMove();
    if (running() && toMove === humanSide()) {
      const own = playerClockView(base[toMove], turnUsed.value, current);
      setSide(toMove, own.remaining, own.byoyomi ? own.byoyomiLeft : undefined);
    }
    const plan = cpuPlan.value;
    if (plan && plan.ply === ply && running()) {
      const spent = plan.seconds * cpuProgress.value;
      if (current.increment || spent < plan.left) setSide(plan.side, plan.left - spent, undefined);
      else setSide(plan.side, 0, Math.max(CPU_BYOYOMI_FLOOR, Math.round(current.byoyomi - (spent - plan.left))));
      if (cpuProgress.value < 1) view.fast = plan.side;
    }
    return view;
  });

  return { clock, rule, clocks, playerByoyomi, start, clear, restore, snapshot, beginCpuThink, settleCpuThink };
}
