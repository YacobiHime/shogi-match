import { describe, expect, test } from 'vitest';
import { formatAnalysisScore, scoreForBlack, scoreToGraphValue } from './kifu-analysis.mjs';

describe('棋譜解析の評価値', () => {
  test('後手番の評価を先手視点へ反転する', () => {
    expect(scoreForBlack({ type: 'cp', value: 350 }, 'black'))
      .toEqual({ type: 'cp', value: 350 });
    expect(scoreForBlack({ type: 'cp', value: 350 }, 'white'))
      .toEqual({ type: 'cp', value: -350 });
    expect(scoreForBlack({ type: 'mate', value: 7 }, 'white'))
      .toEqual({ type: 'mate', value: -7 });
  });

  test('グラフ表示を±2000へ収め、詰みを上下端へ置く', () => {
    expect(scoreToGraphValue({ type: 'cp', value: 2600 })).toBe(2000);
    expect(scoreToGraphValue({ type: 'cp', value: -2400 })).toBe(-2000);
    expect(scoreToGraphValue({ type: 'mate', value: 5 })).toBe(2000);
    expect(scoreToGraphValue({ type: 'mate', value: -3 })).toBe(-2000);
  });

  test('評価値と詰みを日本語で表示する', () => {
    expect(formatAnalysisScore({ type: 'cp', value: 123 })).toBe('評価値 +123');
    expect(formatAnalysisScore({ type: 'mate', value: -7 })).toBe('後手に7手詰め');
  });
});
