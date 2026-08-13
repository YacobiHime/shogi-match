import { describe, expect, test } from 'vitest';
import {
  classifyAnalyzedMove,
  formatAnalysisScore,
  scoreForBlack,
  scoreToGraphValue,
} from './kifu-analysis.mjs';

describe('棋譜解析の評価値', () => {
  test('後手番の評価を先手視点へ反転する', () => {
    expect(scoreForBlack({ type: 'cp', value: 350 }, 'black'))
      .toEqual({ type: 'cp', value: 350 });
    expect(scoreForBlack({ type: 'cp', value: 350 }, 'white'))
      .toEqual({ type: 'cp', value: -350 });
    expect(scoreForBlack({ type: 'mate', value: 7 }, 'white'))
      .toEqual({ type: 'mate', value: -7 });
  });

  test('グラフ表示を±6000へ収め、詰みを上下端へ置く', () => {
    expect(scoreToGraphValue({ type: 'cp', value: 7200 })).toBe(6000);
    expect(scoreToGraphValue({ type: 'cp', value: -6800 })).toBe(-6000);
    expect(scoreToGraphValue({ type: 'mate', value: 5 })).toBe(6000);
    expect(scoreToGraphValue({ type: 'mate', value: -3 })).toBe(-6000);
  });

  test('評価値と詰みを日本語で表示する', () => {
    expect(formatAnalysisScore({ type: 'cp', value: 123 })).toBe('評価値 +123');
    expect(formatAnalysisScore({ type: 'mate', value: -7 })).toBe('後手に7手詰め');
  });

  test('着手者視点の評価損から疑問手・悪手・大悪手を判定する', () => {
    expect(classifyAnalyzedMove({
      ply: 1, playedMove: '7g7f', bestMove: '2g2f',
      beforeBestScore: { type: 'cp', value: 200 },
      afterScore: { type: 'cp', value: -150 },
    })?.label).toBe('疑問手');
    expect(classifyAnalyzedMove({
      ply: 2, playedMove: '3c3d', bestMove: '8c8d',
      beforeBestScore: { type: 'cp', value: -100 },
      afterScore: { type: 'cp', value: 850 },
    })?.label).toBe('悪手');
    expect(classifyAnalyzedMove({
      ply: 3, playedMove: '2g2f', bestMove: '7g7f',
      beforeBestScore: { type: 'cp', value: 500 },
      afterScore: { type: 'cp', value: -1800 },
    })?.label).toBe('大悪手');
  });

  test('次善手との差が大きい最善手だけを好手・神の一手にする', () => {
    expect(classifyAnalyzedMove({
      ply: 1, playedMove: '7g7f', bestMove: '7g7f',
      beforeBestScore: { type: 'cp', value: 700 },
      beforeSecondScore: { type: 'cp', value: 250 },
      afterScore: { type: 'cp', value: 680 },
    })?.label).toBe('好手');
    expect(classifyAnalyzedMove({
      ply: 2, playedMove: '8c8d', bestMove: '8c8d',
      beforeBestScore: { type: 'cp', value: -900 },
      beforeSecondScore: { type: 'cp', value: 500 },
      afterScore: { type: 'cp', value: -850 },
    })?.label).toBe('神の一手');
    expect(classifyAnalyzedMove({
      ply: 1, playedMove: '7g7f', bestMove: '7g7f',
      beforeBestScore: { type: 'cp', value: 100 },
      beforeSecondScore: { type: 'cp', value: 50 },
      afterScore: { type: 'cp', value: 90 },
    })).toBeNull();
  });
});
