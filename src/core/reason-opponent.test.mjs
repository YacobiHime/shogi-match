import { describe, expect, it } from 'vitest';
import { DEFAULT_REASON_LEVEL, REASON_LEVELS, normalizeReasonLevel, reasonEquivalentLevel, reasonLevels, reasonStrengthOptions } from './reason-opponent.mjs';
import { readFileSync } from 'node:fs';

describe('自由対局の将棋AI(論理)(docs/disciple-mode-design.mdの41章)', () => {
  it('強さは能力値のLvで選び、4つをそろえる。範囲の外や壊れた値は近いLvへ', () => {
    expect(REASON_LEVELS).toContain(DEFAULT_REASON_LEVEL);
    expect(normalizeReasonLevel(31)).toBe(30);
    expect(normalizeReasonLevel(999)).toBe(49);
    expect(normalizeReasonLevel('x')).toBe(DEFAULT_REASON_LEVEL);
    expect(reasonLevels(40)).toEqual({ reading: 40, plan: 40, steady: 40, mate: 40 });
  });

  it('同じくらいのCPUのLvは能力値とともに上がり、選択肢にその段級位を添える', () => {
    let previous = -1;
    for (const level of REASON_LEVELS) {
      const cpu = reasonEquivalentLevel(level);
      expect(cpu).toBeGreaterThanOrEqual(previous);
      previous = cpu;
    }
    const options = reasonStrengthOptions();
    expect(options.map((o) => o.value)).toEqual([...REASON_LEVELS]);
    for (const o of options) expect(o.description).toMatch(/^CPUの/);
  });

  it('対局画面は将棋AI(論理)を開いたときだけ読み込み、レーティングに数えない', () => {
    const source = readFileSync(new URL('../ShogiMatchGame.vue', import.meta.url), 'utf8');
    expect(source).not.toMatch(/^import .*useThinkWorker/m);
    expect(source).toMatch(/await import\("\.\/composables\/match\/useThinkWorker"\)/);
    expect(source).toMatch(/\/\/ 将棋AI\(論理\)はCPUの強さの表とは別の物差しなので、レーティングに数えない\(41章\)。\n\s+&& !usesReasonAi\.value/);
  });
});
