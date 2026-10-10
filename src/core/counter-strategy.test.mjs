import { describe, expect, test } from 'vitest';

import { OPENING_STRATEGIES } from './opening-guide.mjs';
import { COUNTER_STRATEGY_TIPS } from './counter-strategy.mjs';
import formations from '../data/hiragana_suisho_formations.json';

describe('対策助言のデータ', () => {
  test('戦型名は、戦型検出か定跡案内で使う名前だけにする', () => {
    const known = new Set([
      ...formations.rules.map((rule) => rule.name),
      ...OPENING_STRATEGIES.map((strategy) => strategy.label),
    ]);
    const unknown = COUNTER_STRATEGY_TIPS.flatMap((tip) => tip.names).filter((name) => !known.has(name));
    expect(unknown).toEqual([]);
  });

  test('台詞に升の座標を入れない', () => {
    for (const tip of COUNTER_STRATEGY_TIPS) {
      for (const text of [tip.ibisha, tip.furibisha].filter(Boolean)) {
        expect(text, tip.key).not.toMatch(/[1-9１-９][一二三四五六七八九]/);
      }
    }
  });
});
