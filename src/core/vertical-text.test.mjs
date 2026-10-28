import { describe, expect, it } from 'vitest';
import { verticalGroups, verticalKind } from './vertical-text.mjs';

describe('verticalGroups', () => {
  it('1字ずつのかたまりにし、句読点・閉じ括弧・長音は前の字につなげる', () => {
    const groups = verticalGroups('賞します。「竜王」ーです');
    expect(groups.map((group) => group.map(({ ch }) => ch).join(''))).toEqual(['賞', 'し', 'ま', 'す。', '「竜', '王」ー', 'で', 'す']);
  });

  it('句読点は右上、長音と括弧は回す、小さい仮名は寄せる', () => {
    expect(verticalKind('、')).toBe('comma');
    expect(verticalKind('ー')).toBe('turn');
    expect(verticalKind('「')).toBe('turn');
    expect(verticalKind('っ')).toBe('small');
    expect(verticalKind('竜')).toBe('');
  });

  it('文字を落とさない(空・空白・絵文字を含む)', () => {
    expect(verticalGroups('')).toEqual([]);
    const text = ' 殿 二〇二六年👑';
    expect(verticalGroups(text).flat().map(({ ch }) => ch).join('')).toBe(text);
  });
});
