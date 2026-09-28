/**
 * 助言用エンジン探索の実行中状態と、外部stopによる中断世代を管理する。
 * USIのstop後に返る途中結果を、完了結果やキャッシュとして扱わないために使う。
 */
export function createAssistSearchControl() {
  let activeCount = 0;
  let stopGeneration = 0;

  return {
    get running() {
      return activeCount > 0;
    },
    interrupt() {
      if (activeCount === 0) return false;
      stopGeneration += 1;
      return true;
    },
    async run(task) {
      const startedAt = stopGeneration;
      activeCount += 1;
      try {
        const value = await task();
        return { value, interrupted: startedAt !== stopGeneration };
      } finally {
        activeCount -= 1;
      }
    },
  };
}
