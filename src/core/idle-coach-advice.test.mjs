import { describe, expect, test } from 'vitest';

import { getIdleCoachAdvice, IDLE_COACH_DELAY_MS } from './idle-coach-advice.mjs';

describe('長考中の軽い助言', () => {
  test('10秒後に発火する設定にする', () => {
    expect(IDLE_COACH_DELAY_MS).toBe(10000);
  });

  test('探索最善手が歩の取り返しなら同歩を提案する', () => {
    expect(getIdleCoachAdvice({
      usi: '7f7e', pieceType: 'pawn', capturedPieceType: 'pawn', lastMove: '7d7e',
    })?.text).toContain('同歩');
  });

  test('駒打ち・王手・囲いを区別する', () => {
    expect(getIdleCoachAdvice({ usi: 'P*5e', pieceType: 'pawn' })?.text).toContain('持ち駒');
    expect(getIdleCoachAdvice({ usi: '2h2b+', pieceType: 'rook', givesCheck: true })?.text)
      .toContain('王手');
    expect(getIdleCoachAdvice({
      usi: '5i6h', pieceType: 'king', toRank: 8, color: 'black',
    })?.text).toContain('囲って');
  });

  test('その他の最善手は読みやすい表記で軽く提案する', () => {
    expect(getIdleCoachAdvice({
      usi: '7g7f', formattedMove: '７六歩', pieceType: 'pawn', toRank: 6, color: 'black',
    })?.text).toBe('７六歩あたりを考えてみる？');
  });
});
