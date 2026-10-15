import { computed, onBeforeUnmount, ref, watch, type Ref } from "vue";

/*
 * CPUの思考中に出す「読んだ局面数」のゲージ。
 * エンジンの報告(onNodes)は間が空くので、報告の間は直近のNPSから100msごとに見積もって伸ばす。
 * 見積もりは目標の99%で止め、探索を終えたときに100%にする。
 */
export function useCpuSearchGauge(thinking: Ref<boolean>) {
  const cpuSearchGauge = ref<{ target: number; nodes: number } | null>(null);
  let sample = { nodes: 0, nps: 0, at: 0 };
  let timer: ReturnType<typeof setInterval> | null = null;

  function stopCpuGauge() {
    if (timer) clearInterval(timer);
    timer = null;
    cpuSearchGauge.value = null;
  }
  function startCpuGauge(target: number) {
    stopCpuGauge();
    sample = { nodes: 0, nps: 0, at: performance.now() };
    cpuSearchGauge.value = { target, nodes: 0 };
    timer = setInterval(() => {
      const gauge = cpuSearchGauge.value;
      if (!gauge) return;
      const { nodes, nps, at } = sample;
      const estimate = Math.min(gauge.target * 0.99, nodes + (nps * (performance.now() - at)) / 1000);
      if (estimate > gauge.nodes) cpuSearchGauge.value = { ...gauge, nodes: estimate };
    }, 100);
  }
  function updateCpuGauge({ nodes, nps }: { nodes: number; nps?: number }) {
    sample = { nodes, nps: nps ?? sample.nps, at: performance.now() };
    const gauge = cpuSearchGauge.value;
    if (gauge && nodes > gauge.nodes) cpuSearchGauge.value = { ...gauge, nodes: Math.min(gauge.target, nodes) };
  }
  function finishCpuGauge() {
    if (timer) clearInterval(timer);
    timer = null;
    const gauge = cpuSearchGauge.value;
    if (gauge) cpuSearchGauge.value = { ...gauge, nodes: gauge.target };
  }
  watch(thinking, (value) => {
    if (!value) stopCpuGauge();
  });
  onBeforeUnmount(stopCpuGauge);
  const cpuGaugePercent = computed(() => {
    const gauge = cpuSearchGauge.value;
    return gauge ? Math.round((gauge.nodes / Math.max(1, gauge.target)) * 100) : 0;
  });

  return { cpuSearchGauge, cpuGaugePercent, startCpuGauge, updateCpuGauge, finishCpuGauge };
}
