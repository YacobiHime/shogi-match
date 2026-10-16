import { describe, expect, it } from 'vitest';
import {
  DEFEAT_STOP_MS,
  IMPACT_STAGE,
  finishImpact,
  impactStopMs,
  moveImpact,
  praiseImpactStage,
} from './move-impact.mjs';

describe('出来事の重さ', () => {
  it('通常の手・取る・成る・打つを区別する', () => {
    expect(moveImpact({})).toEqual({ stage: IMPACT_STAGE.MOVE, sound: 'normal' });
    expect(moveImpact({ capturedPieceType: 'pawn' })).toEqual({ stage: IMPACT_STAGE.CAPTURE, sound: 'capture' });
    expect(moveImpact({ promote: true })).toEqual({ stage: IMPACT_STAGE.CAPTURE, sound: 'promote' });
    expect(moveImpact({ drop: true })).toEqual({ stage: IMPACT_STAGE.CAPTURE, sound: 'drop' });
    // 取りながら成る手は、成る音にする。
    expect(moveImpact({ capturedPieceType: 'silver', promote: true }).sound).toBe('promote');
  });

  it('王手・大駒を取る手・詰みは強い音にし、段階を上げる', () => {
    for (const piece of ['rook', 'bishop', 'dragon', 'horse']) {
      expect(moveImpact({ capturedPieceType: piece })).toEqual({ stage: IMPACT_STAGE.STRONG, sound: 'strong' });
    }
    expect(moveImpact({ check: true, drop: true })).toEqual({ stage: IMPACT_STAGE.STRONG, sound: 'strong' });
    expect(moveImpact({ check: true, checkmate: true })).toEqual({ stage: IMPACT_STAGE.FINISH, sound: 'strong' });
  });

  it('ほめ言葉は、神の一手を5、それ以外を4にする', () => {
    expect(praiseImpactStage('praise-god-move')).toBe(IMPACT_STAGE.GOD);
    for (const key of ['praise-good-move', 'praise-mate-threat', 'praise-mate-defense', 'praise-material', 'praise-reversal']) {
      expect(praiseImpactStage(key)).toBe(IMPACT_STAGE.GOOD);
    }
    expect(praiseImpactStage('move-blunder')).toBe(IMPACT_STAGE.MENU);
    expect(praiseImpactStage()).toBe(IMPACT_STAGE.MENU);
  });

  it('止めは段階が上がるほど長く、範囲外は丸める', () => {
    const stops = [0, 1, 2, 3, 4, 5, 6].map(impactStopMs);
    expect(stops).toEqual([0, 0, 0, 80, 80, 250, 400]);
    for (let index = 1; index < stops.length; index += 1) expect(stops[index]).toBeGreaterThanOrEqual(stops[index - 1]);
    expect(impactStopMs(99)).toBe(400);
    expect(impactStopMs(-1)).toBe(0);
  });

  it('詰みで勝つと長く止め、詰まされたときは短くする。投了と引き分けは止めない', () => {
    expect(finishImpact({ reason: 'checkmate', outcome: 'win' })).toEqual({ stopMs: 400, sound: 'win' });
    expect(finishImpact({ reason: 'checkmate', outcome: 'loss' })).toEqual({ stopMs: DEFEAT_STOP_MS, sound: 'lose' });
    expect(DEFEAT_STOP_MS).toBeLessThan(400);
    expect(finishImpact({ reason: 'resignation', outcome: 'win' })).toEqual({ stopMs: 0, sound: 'win' });
    expect(finishImpact({ reason: 'resignation', outcome: 'loss' })).toEqual({ stopMs: 0, sound: 'lose' });
    expect(finishImpact({ reason: 'repetition', outcome: 'draw' })).toEqual({ stopMs: 0, sound: null });
    expect(finishImpact({ reason: 'checkmate', outcome: 'none' })).toEqual({ stopMs: 400, sound: 'win' });
  });
});
