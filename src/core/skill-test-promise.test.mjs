import { describe, expect, it } from 'vitest';
import { TAKE_GAIN_MIN, THREAT_LOSS_MIN, captureNote, isCaptureMove, materialSwing, passLoss, profitableCaptures, savingMoves } from './skill-test-promise.mjs';

describe('棋力テストの問いの約束', () => {
  // 先手の飛車で、守りのない7五の銀が取れる。4六の歩で4五の歩も取れるが、4四の銀に取り返される。
  const take = '4k4/9/9/5s3/2s2p3/5P3/9/9/2R1K4 b - 1';

  it('得する駒取りは、取り合いの2手の読みで300以上得する駒取りのすべて', () => {
    expect(isCaptureMove(take, '7i7e')).toBe(true);
    expect(isCaptureMove(take, '7i7h')).toBe(false);
    expect(materialSwing(take, '7i7e')).toBeGreaterThanOrEqual(TAKE_GAIN_MIN);
    // 歩を取っても、銀で取り返されて得にならない。
    expect(materialSwing(take, '4f4e')).toBeLessThan(TAKE_GAIN_MIN);
    expect(profitableCaptures(take, ['7i7e', '4f4e', '7i7h'])).toEqual(['7i7e']);
  });

  it('取られないようにする手は、逃げる・守る・先に取る、のどれでもよい', () => {
    // 先手の5六の金に、後手の5五の歩が当たっている(手を渡すと金を取られる)。
    const save = '4k4/9/9/9/4p4/4G4/9/9/4K4 b - 1';
    expect(passLoss(save)).toBeGreaterThanOrEqual(THREAT_LOSS_MIN);
    const saving = savingMoves(save, ['5f4f', '5f5e', '5i4h', '5f5g']);
    // 横へ逃げる・歩を取る・後ろへ逃げるは守れる。玉を動かすだけでは金を取られる。
    expect(saving).toEqual(['5f4f', '5f5e', '5f5g']);
  });

  it('駒取りの理由の一言は、取った駒と、取り返されるか', () => {
    expect(captureNote(take, '7i7e')).toEqual({ kind: 'S', free: true });
    expect(captureNote(take, '4f4e')).toEqual({ kind: 'P', free: false });
    expect(captureNote(take, '7i7h')).toBeNull();
  });
});
