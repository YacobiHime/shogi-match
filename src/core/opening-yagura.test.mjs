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

describe('上の囲い(14-5)', async () => {
  const { readFile } = await import('node:fs/promises');
  const { createFormationState, detectFormationSnapshot, formationMove, formedNamesFromState, updateFormationState } = await import('./formation-tracker.mjs');
  const { openingUnlocks } = await import('./opening-unlocks.mjs');
  const master = JSON.parse(await readFile(new URL('../data/hiragana_suisho_formations.json', import.meta.url), 'utf8'));
  const UPPER = ['silver-crown-anaguma', 'big4', 'yagura-anaguma', 'ibisha-silver-crown', 'half-silver-crown', 'four-mino', 'hishi-yagura', 'gintachi-yagura', 'hayamino', 'kimura-mino', 'amano-yagura'];

  it('案内どおり組むと、形の判定が同じ名前を付ける(先手・後手)', () => {
    for (const castleId of UPPER) {
      const label = OPENING_CASTLES.find(({ id }) => id === castleId).label;
      for (const color of ['black', 'white']) {
        const { complete, sfen } = follow({ castleId, color, start: color === 'white' ? START.replace(' b ', ' w ') : START });
        expect(complete, `${castleId} ${color}`).toBe(true);
        const snapshot = detectFormationSnapshot(sfen, master);
        const state = updateFormationState(createFormationState(), snapshot, formationMove(sfen, 1));
        expect([snapshot[color].castle, ...formedNamesFromState(state, color)], `${castleId} ${color}`).toContain(label);
      }
    }
  });

  it('進化のもとの囲いを1回完成させると使える', () => {
    const before = openingUnlocks({ formations: {} });
    expect(before.unlocked.has('castle:big4')).toBe(false);
    // 応用の段が開いていても、銀冠穴熊を組むまでビッグ4は使えない。
    const advanced = openingUnlocks({ formations: { 原始棒銀: { count: 1 }, 居飛車: { count: 1 }, 早繰り銀: { count: 1 }, 腰掛け銀: { count: 1 } } });
    expect(advanced.unlocked.has('castle:big4')).toBe(false);
    expect(advanced.unlocked.has('castle:hayamino')).toBe(true);
    expect(advanced.condition('castle:big4')).toContain('銀冠穴熊');
    const after = openingUnlocks({ formations: { 原始棒銀: { count: 1 }, 居飛車: { count: 1 }, 早繰り銀: { count: 1 }, 腰掛け銀: { count: 1 }, 銀冠穴熊: { count: 1 } } });
    expect(after.unlocked.has('castle:big4')).toBe(true);
  });
});

describe('矢倉を組んでも飯島流引き角戦法と付けない(docs/formation-detect-design.mdの19章)', async () => {
  const { readFile } = await import('node:fs/promises');
  const { createFormationState, detectFormationSnapshot, formationMove, formedNamesFromState, updateFormationState } = await import('./formation-tracker.mjs');
  const master = JSON.parse(await readFile(new URL('../data/hiragana_suisho_formations.json', import.meta.url), 'utf8'));

  /** 先手の手と後手の待つ手を交互に指して、先手に付いた名前。 */
  function namesAlong(blackMoves, whiteMoves) {
    let record = createGameRecord(START);
    let state = createFormationState();
    let ply = 0;
    const play = (usi) => {
      expect(appendUsiMove(record, usi), usi).toBeTruthy();
      ply += 1;
      state = updateFormationState(state, detectFormationSnapshot(record.position.sfen, master), formationMove(record.position.sfen, ply));
    };
    blackMoves.forEach((usi, index) => {
      play(usi);
      if (whiteMoves[index]) play(whiteMoves[index]);
    });
    return formedNamesFromState(state, 'black');
  }

  it('相手が居飛車でも、矢倉の7九角では付かない', () => {
    const yagura = OPENING_CASTLES.find(({ id }) => id === 'yagura').blackMoves;
    const white = ['8c8d', '7a6b', '8d8e', '6c6d', '6b6c', '5a4b', '4a5b', '3a3b', '4b3a', '5c5d', '1c1d', '9c9d', '1d1e'];
    const names = namesAlong(yagura, white);
    expect(names).toContain('金矢倉');
    expect(names).not.toContain('飯島流引き角戦法');
  });

  it('金矢倉を組まずに角を7九へ引いた形には付く', () => {
    const names = namesAlong(['7g7f', '7i7h', '7h7g', '8h7i', '6i7h'], ['8c8d', '7a6b', '8d8e', '6c6d', '6b6c']);
    expect(names).toContain('飯島流引き角戦法');
  });
});
