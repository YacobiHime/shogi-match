import { describe, expect, it } from 'vitest';
import { FURIGOMA_PIECES, furigomaMessage, throwFurigoma } from './furigoma.mjs';

const sequence = (values) => {
  let index = 0;
  return () => values[index++ % values.length];
};

describe('振り駒', () => {
  it('歩が3枚以上ならプレイヤーが先手になる', () => {
    const result = throwFurigoma(sequence([0.1, 0.2, 0.9, 0.3, 0.8]));
    expect(result).toEqual({ faces: ['fu', 'fu', 'to', 'fu', 'to'], fuCount: 3, playerColor: 'black' });
    expect(furigomaMessage(result)).toBe('歩が3枚。あなたが先手だよ！');
  });

  it('と金が3枚以上ならプレイヤーが後手になる', () => {
    const result = throwFurigoma(sequence([0.6, 0.7, 0.1, 0.9, 0.5]));
    expect(result.fuCount).toBe(1);
    expect(result.playerColor).toBe('white');
    expect(furigomaMessage(result)).toBe('と金が4枚。あなたが後手だよ！');
  });

  it('いつも5枚振り、先後は偏らない', () => {
    let black = 0;
    for (let seed = 0; seed < 32; seed += 1) {
      // 5ビットの全組み合わせを並べる。
      const bits = Array.from({ length: FURIGOMA_PIECES }, (_, index) => ((seed >> index) & 1 ? 0.9 : 0.1));
      const result = throwFurigoma(sequence(bits));
      expect(result.faces).toHaveLength(FURIGOMA_PIECES);
      if (result.playerColor === 'black') black += 1;
    }
    expect(black).toBe(16);
  });
});
