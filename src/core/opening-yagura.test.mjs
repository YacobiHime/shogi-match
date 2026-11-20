// 矢倉の手順と、角換わりで角がいないときの囲い(docs/opening-guide-ux-design.mdの14-2・14-8)。
import { describe, expect, it } from 'vitest';
import { appendUsiMove, createGameRecord, enumerateLegalMoves } from '../game-state';
import { isOpeningPlanComplete, nextOpeningPlanMove, openingPlanCompatibility, OPENING_CASTLES } from './opening-guide.mjs';

const START = 'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1';

/** 案内の手を指していき、相手はoppの手を順に指す(なくなったら指さない)。 */
function follow({ strategyId = '', castleId, color = 'black', opp = [], start = START }) {
  let record = createGameRecord(start);
  const playedMoves = []; const opponentMoves = []; const moveHistory = []; const moves = [];
  const side = color === 'black' ? 'b' : 'w';
  for (let step = 0; step < 30; step += 1) {
    if (isOpeningPlanComplete({ strategyId, castleId, color, playedMoves, opponentMoves, currentSfen: record.position.sfen })) return { moves, complete: true, sfen: record.position.sfen };
    const fields = record.position.sfen.split(' '); fields[1] = side;
    const legalMoves = enumerateLegalMoves(createGameRecord(fields.join(' ')).position).map(({ usi }) => usi);
    const next = nextOpeningPlanMove({ strategyId, castleId, color, playedMoves, opponentMoves, moveHistory, currentSfen: record.position.sfen, legalMoves });
    if (!next) return { moves, complete: false };
    record = createGameRecord(fields.join(' '));
    expect(appendUsiMove(record, next.usi), next.usi).toBeTruthy();
    playedMoves.push(next.usi); moveHistory.push(next.usi); moves.push(next.usi);
    const reply = opp[step];
    if (reply) {
      const turned = record.position.sfen.split(' '); turned[1] = side === 'b' ? 'w' : 'b';
      record = createGameRecord(turned.join(' '));
      expect(appendUsiMove(record, reply), reply).toBeTruthy();
      opponentMoves.push(reply); moveHistory.push(reply);
    }
  }
  return { moves, complete: false };
}

describe('矢倉の手順(14-8)', () => {
  it('完成の条件は7七銀・7八金・6七金と8八の玉。角は入れない', () => {
    const yagura = OPENING_CASTLES.find(({ id }) => id === 'yagura');
    expect(yagura.completionSquares).toEqual([['8h', 'K'], ['7g', 'S'], ['7h', 'G'], ['6g', 'G']]);
  });

  it('相手が角道を閉じたままなら、7八銀→7七銀→7八金→5八金→6六歩→6七金→5六歩→6九玉→7九角→6八角→7九玉→8八玉', () => {
    const { moves, complete } = follow({ castleId: 'yagura', opp: ['8c8d', '7a6b', '6a5b'] });
    expect(complete).toBe(true);
    expect(moves).toEqual(['7g7f', '7i7h', '7h7g', '6i7h', '4i5h', '6g6f', '5h6g', '5g5f', '5i6i', '8h7i', '7i6h', '6i7i', '7i8h']);
  });

  it('相手が角道を開けたら、すぐ6六歩で角道を閉じる', () => {
    const { moves, complete } = follow({ castleId: 'yagura', opp: ['3c3d', '8c8d', '7a6b'] });
    expect(complete).toBe(true);
    expect(moves.slice(0, 3)).toEqual(['7g7f', '6g6f', '7i7h']);
  });

  it('後手も反転した手順で組める', () => {
    const { moves, complete } = follow({ castleId: 'yagura', color: 'white', start: START.replace(' b ', ' w ') });
    expect(complete).toBe(true);
    expect(moves.slice(-4)).toEqual(['2b3a', '3a4b', '4a3a', '3a2b']);
  });

  it('角換わりで角が持ち駒なら、角の手を飛ばして組める', () => {
    // 角交換のあとの局面(両方の角が持ち駒)。
    const exchanged = 'lnsgkgsnl/1r7/pppppp1pp/6p2/9/2P6/PP1PPPPPP/7R1/LNSGKGSNL b Bb 1';
    const { moves, complete, sfen } = follow({ castleId: 'yagura', start: exchanged });
    expect(complete).toBe(true);
    expect(moves.some((usi) => usi.startsWith('8h') || usi.startsWith('7i6h'))).toBe(false);
    expect(sfen.split(' ')[0].split('/')[7]).toContain('K');
  });

  it('角換わりの戦法と矢倉・左美濃を組める', () => {
    for (const strategyId of ['kakugawari', 'kakugawari-koshikake-gin']) {
      for (const castleId of ['yagura', 'left-mino']) expect(openingPlanCompatibility(strategyId, castleId).compatible, `${strategyId}+${castleId}`).toBe(true);
    }
  });

  it('矢倉戦法(7九→6八の銀)と組んでも、角の7九→6八を別の手として指す', () => {
    const { moves, complete } = follow({ strategyId: 'yagura-strategy', castleId: 'yagura' });
    expect(complete).toBe(true);
    expect(moves.filter((usi) => usi === '7i6h')).toHaveLength(2);
  });
});

describe('左美濃(14-2)', () => {
  it('完成の条件に角を入れない', () => {
    expect(OPENING_CASTLES.find(({ id }) => id === 'left-mino').completionSquares.some(([, kind]) => kind === 'B')).toBe(false);
  });
});
