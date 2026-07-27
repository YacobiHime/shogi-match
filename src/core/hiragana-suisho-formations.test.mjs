import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';

import {
  detectHiraganaSuishoFormations,
  invertHiraganaSuishoSfen,
} from './hiragana-suisho-formations.mjs';

const master = JSON.parse(await readFile(
  new URL('../data/hiragana_suisho_formations.json', import.meta.url),
  'utf8',
));

describe('HiraganaSuisho原典互換判定', () => {
  test('全133件を変換する', () => {
    expect(master.rules).toHaveLength(133);
    expect(master.rules.filter((rule) => rule.group === 'tac_match')).toHaveLength(29);
  });

  test('先手と後手の共通作戦を盤面反転して判定する', () => {
    const sente = '9/9/9/9/9/7S1/9/7R1/9 w - 1';
    const gote = invertHiraganaSuishoSfen(sente);
    expect(detectHiraganaSuishoFormations(sente, master).map(({ name }) => name))
      .toContain('棒銀');
    expect(detectHiraganaSuishoFormations(gote, master).map(({ name }) => name))
      .toContain('棒銀');
  });

  test('盤面・成駒・持駒・手番の反転は可逆', () => {
    const sfen = '4k4/9/9/9/4+P4/9/9/9/4K4 b R2p 42';
    expect(invertHiraganaSuishoSfen(invertHiraganaSuishoSfen(sfen))).toBe(sfen);
  });
});
