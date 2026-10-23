import { describe, expect, it } from 'vitest';
import { TRAITS } from './player-character.mjs';
import { opponentStyleAdvice } from './coach-opponent.mjs';

describe('opponentStyleAdvice', () => {
  it('has a line for every special ability', () => {
    for (const { id } of TRAITS) {
      expect(opponentStyleAdvice({ traits: [{ id, degree: 1 }] }, '中村')?.text, id).toMatch(/^中村さんは、.+！$/);
    }
  });
  it('prefers gold, then weaknesses, then strengths, then the attack style', () => {
    const traits = [{ id: 'fast-attack', degree: 1 }, { id: 'endgame-collapse', degree: 1 }, { id: 'comeback' }];
    expect(opponentStyleAdvice({ traits }, '中村')?.key).toBe('opponent-style-comeback');
    expect(opponentStyleAdvice({ traits: traits.slice(0, 2) }, '中村')?.key).toBe('opponent-style-endgame-collapse');
    expect(opponentStyleAdvice({ traits: traits.slice(0, 1) }, '中村')?.key).toBe('opponent-style-fast-attack');
    expect(opponentStyleAdvice({ attack: 0.7, traits: [] }, '中村')?.text).toBe('中村さんは、激しい攻め将棋の相手だよ。先に玉を固めて、攻めを受け止めよう！');
  });
  it('stays quiet for a balanced player without abilities or without a name', () => {
    expect(opponentStyleAdvice({ attack: 0, traits: [] }, '中村')).toBeNull();
    expect(opponentStyleAdvice(null, '中村')).toBeNull();
    expect(opponentStyleAdvice({ attack: 0.7 }, '')).toBeNull();
  });
});
