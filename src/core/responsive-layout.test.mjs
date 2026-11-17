// 画面の大きさによる配置の決め方(docs/stable-board-layout-design.mdの11章)。
import { describe, expect, it } from 'vitest';
import { layoutPlan, PORTRAIT_STACK_RATIO } from '../composables/useResponsiveLayout.ts';

describe('縦長の画面はいつも縦積み', () => {
  it('iPadの縦画面のChrome(820×1047)で解析を開いても、横並びにならない', () => {
    expect(layoutPlan(820, 1047, true).side).toBe(false);
    expect(layoutPlan(820, 1047, false).side).toBe(false);
  });

  it('ほかの縦長のタブレット・スマホも縦積み', () => {
    for (const [w, h] of [[744, 1000], [810, 960], [768, 954], [1024, 1250], [820, 1180], [390, 844], [360, 640]]) {
      expect(h / w).toBeGreaterThanOrEqual(PORTRAIT_STACK_RATIO);
      expect(layoutPlan(w, h, true).side).toBe(false);
    }
  });

  it('横画面とほぼ正方形の画面は、今までどおり盤の大きい方を選ぶ', () => {
    expect(layoutPlan(1366, 768, true).side).toBe(true);
    expect(layoutPlan(1180, 820, false).side).toBe(true);
    expect(layoutPlan(844, 390, false).side).toBe(true);
  });

  it('タブレットの縦積みで解析を開くと、グラフの分だけ盤を小さく見積もる', () => {
    const wide = layoutPlan(820, 1180, true).stackBoard.scale;
    const without = layoutPlan(820, 1180, false).stackBoard.scale;
    expect(wide).toBeLessThan(without);
  });
});
