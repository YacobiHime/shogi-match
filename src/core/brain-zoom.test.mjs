import { describe, expect, it } from 'vitest';
import { ZOOM_MAX, brainZoom } from './brain-zoom.mjs';

describe('脳トレ道場の拡大率(brain-training-design.mdの15章)', () => {
  it('スマホ・タブレット・1366×768のPCは拡大しない', () => {
    for (const [w, h] of [[360, 640], [390, 844], [844, 390], [820, 1180], [1180, 820], [1366, 768], [1280, 720], [1180, 1000]]) {
      expect(brainZoom(w, h)).toBe(1);
    }
  });

  it('広くて高い画面は大きくする。横と縦の小さいほうに合わせる', () => {
    expect(brainZoom(1920, 1080)).toBe(1.4);
    expect(brainZoom(2560, 1440)).toBe(1.85);
    // 横に長いだけの窓は、縦に合わせる(はみ出さない)。
    expect(brainZoom(2560, 800)).toBe(1.0);
    expect(brainZoom(1920, 900)).toBe(1.15);
  });

  it('上限を超えない。大きさが分からないときは1', () => {
    expect(brainZoom(7680, 4320)).toBe(ZOOM_MAX);
    expect(brainZoom(0, 0)).toBe(1);
    expect(brainZoom(NaN, 1080)).toBe(1);
  });
});
