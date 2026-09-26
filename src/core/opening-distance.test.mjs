import { describe, expect, test } from 'vitest';
import { Position } from 'tsshogi';
import { enumerateLegalMoves, STANDARD_SFEN } from '../game-state.ts';
import { formationDistance, formationVariantsForColor } from './opening-distance.mjs';
import { parseSfenBoard } from './sfen-board.mjs';
import {
  classifyStrategyStep,
  isOpeningPlanComplete,
  mirrorUsiMove,
  nearestOpeningCastles,
  nearestOpeningStrategies,
  openingNearCompletion,
  openingStrategyStepClassification,
  openingCastleDistance,
  openingCastleNearCompletion,
  openingPlanCandidates,
  openingPlanInterruption,
  OPENING_CASTLES,
} from './opening-guide.mjs';

/** 相手の手を挟まず、指定した側の手だけを進めた局面を作る。 */
function playOwnMoves(blackMoves, color, sfen = STANDARD_SFEN) {
  const moves = color === 'white' ? blackMoves.map(mirrorUsiMove) : blackMoves;
  let current = sfen;
  for (const usi of moves) {
    const fields = current.split(' ');
    fields[1] = color === 'black' ? 'b' : 'w';
    const position = Position.newBySFEN(fields.join(' '));
    const move = position.createMoveByUSI(usi);
    if (!move || !position.doMove(move)) throw new Error(`illegal ${usi}`);
    current = position.sfen;
  }
  const fields = current.split(' ');
  fields[1] = color === 'black' ? 'b' : 'w';
  return { sfen: fields.join(' '), playedMoves: moves };
}

function legalMovesOf(sfen) {
  return enumerateLegalMoves(Position.newBySFEN(sfen)).map(({ usi }) => usi);
}

describe.each(['black', 'white'])('完成形までの距離: %s', (color) => {
  const initial = color === 'black' ? STANDARD_SFEN : STANDARD_SFEN.replace(' b ', ' w ');

  test('初期局面から各囲いまでの距離が妥当な値になる', () => {
    const expected = {
      funagakoi: 3, osumi: 3, 'half-mino': 5, mino: 6, kinmusou: 6,
      elmo: 5, yagura: 11, 'ibisha-anaguma': 10,
    };
    for (const [castleId, distance] of Object.entries(expected)) {
      const result = openingCastleDistance({ castleId, color, currentSfen: initial });
      expect(result, castleId).toMatchObject({ unreachable: false, distance });
    }
    for (const { id } of OPENING_CASTLES) {
      const result = openingCastleDistance({ castleId: id, color, currentSfen: initial });
      expect(result.unreachable, id).toBe(false);
      expect(result.distance, id).toBeGreaterThan(0);
      expect(result.distance, id).toBeLessThanOrEqual(result.limit);
    }
  });

  test('金が1マスずれた局面でも案内が続き、完成に近づく手が出る', () => {
    // 4九の金を5八へ上げてしまった片美濃。従来の手順には金を戻す手がなく止まっていた。
    let { sfen, playedMoves } = playOwnMoves(
      ['2h6h', '4i5h', '5i4h', '4h3h', '3h2h', '3i3h'], color,
    );
    expect(openingPlanInterruption({
      castleId: 'half-mino', color, playedMoves, currentSfen: sfen, legalMoves: legalMovesOf(sfen),
    })).toBeNull();
    const start = openingCastleDistance({ castleId: 'half-mino', color, currentSfen: sfen });
    expect(start).toMatchObject({ unreachable: false, distance: 2 });

    for (let step = 0; step < 4; step += 1) {
      if (isOpeningPlanComplete({ castleId: 'half-mino', color, playedMoves, currentSfen: sfen })) break;
      const [next] = openingPlanCandidates({
        castleId: 'half-mino', color, playedMoves, currentSfen: sfen, legalMoves: legalMovesOf(sfen),
      });
      expect(next?.phase).toBe('castle');
      const before = openingCastleDistance({ castleId: 'half-mino', color, currentSfen: sfen }).distance;
      ({ sfen } = playOwnMoves([color === 'white' ? mirrorUsiMove(next.usi) : next.usi], color, sfen));
      playedMoves = [...playedMoves, next.usi];
      expect(openingCastleDistance({ castleId: 'half-mino', color, currentSfen: sfen }).distance)
        .toBeLessThan(before);
    }
    expect(isOpeningPlanComplete({ castleId: 'half-mino', color, playedMoves, currentSfen: sfen }))
      .toBe(true);
  });

  test('必要な駒が取られた局面では到達不能になり、近い囲いを提案する', () => {
    // 銀2枚を失った局面。舟囲いは7九銀が必要なので届かない。
    const noSilvers = color === 'black'
      ? 'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LN1GKG1NL b - 1'
      : 'ln1gkg1nl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL w - 1';
    expect(openingCastleDistance({ castleId: 'funagakoi', color, currentSfen: noSilvers }))
      .toMatchObject({ unreachable: true, reason: 'missing-piece' });
    const interruption = openingPlanInterruption({
      castleId: 'funagakoi', color, currentSfen: noSilvers, legalMoves: legalMovesOf(noSilvers),
    });
    expect(interruption).toMatchObject({ requiresReselection: true, clearCastle: true, reason: 'unreachable' });
    expect(interruption.castleSuggestions.length).toBeGreaterThan(0);
    expect(interruption.castleSuggestions.length).toBeLessThanOrEqual(3);
    expect(interruption.castleSuggestions.map(({ id }) => id)).toContain('osumi');
    expect(interruption.castleSuggestions.map(({ id }) => id)).not.toContain('funagakoi');
    const [first] = interruption.castleSuggestions;
    expect(interruption.message).toBe(
      `舟囲いは難しくなったけど、${first.label}ならあと${first.distance}手だよ！`
      + interruption.castleSuggestions.slice(1)
        .map(({ label, distance }) => `${label}（あと${distance}手）`).join('、')
      + (interruption.castleSuggestions.length > 1 ? 'も選べるよ。' : ''),
    );
    // 提案は残り手数の少ない順。
    const distances = interruption.castleSuggestions.map(({ distance }) => distance);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  test('片美濃に達した局面で「ほぼ完成」を返し、本美濃の完成後は返さない', () => {
    const { sfen } = playOwnMoves(['2h6h', '5i4h', '4h3h', '3h2h', '3i3h'], color);
    expect(openingCastleNearCompletion({ castleId: 'mino', color, currentSfen: sfen })).toMatchObject({
      id: 'kata-mino', label: '片美濃', castleLabel: '本美濃', remaining: 1,
    });
    const complete = playOwnMoves(['6i5h'], color, sfen).sfen;
    expect(openingCastleNearCompletion({ castleId: 'mino', color, currentSfen: complete })).toBeNull();
    // ほぼ完成形を持たない囲いでは何も返さない。
    expect(openingCastleNearCompletion({ castleId: 'osumi', color, currentSfen: sfen })).toBeNull();
  });

  test('振り飛車の局面では振り飛車用の囲いだけを提案する', () => {
    const { sfen } = playOwnMoves(['2h6h', '5i4h'], color);
    const suggestions = nearestOpeningCastles({ color, currentSfen: sfen, rookStyle: 'ranging' });
    expect(suggestions.length).toBe(3);
    expect(suggestions.map(({ id }) => id)).not.toContain('funagakoi');
  });
});

describe('戦法の手順分類', () => {
  test('駒組みと順番が重要な手を分ける', () => {
    const kinds = (id) => Object.fromEntries(
      openingStrategyStepClassification(id).map(({ usi, kind }) => [usi, kind]),
    );
    // 横歩取りの飛車先交換と横歩取りは順番が重要。
    expect(kinds('yokofudori')).toMatchObject({
      '7g7f': 'shape', '2g2f': 'shape', '6i7h': 'shape',
      '2e2d': 'order', '2h2d': 'order', '2d3d': 'order',
    });
    // 角交換・駒打ち・桂跳ねは順番が重要、右四間飛車の駒組みはすべて距離方式。
    expect(classifyStrategyStep('7g6e', {}, undefined, 'N')).toBe('order');
    expect(classifyStrategyStep('8h2b+', {}, undefined, 'B')).toBe('order');
    expect(classifyStrategyStep('B*4e', {}, undefined)).toBe('order');
    expect(classifyStrategyStep('3g4e', {}, undefined, 'N')).toBe('order');
    expect(classifyStrategyStep('7f7e', {}, undefined, 'P')).toBe('shape');
    expect(Object.values(kinds('right-shiken')).every((kind) => kind === 'shape')).toBe(true);
    // 前提条件のついた手は順番を守る。
    expect(kinds('gokigen')['5i4h']).toBe('order');
  });
});

describe.each(['black', 'white'])('戦法の駒組みを距離で案内する: %s', (color) => {
  test('銀が予定と違う経路へ出ても、目標形へ近づく手で案内を続ける', () => {
    // 右四間飛車で3九銀を4八ではなく3八へ上げた。従来は4八銀の駒がないとして中断していた。
    const { sfen, playedMoves } = playOwnMoves(['7g7f', '4g4f', '3i3h'], color);
    const legalMoves = legalMovesOf(sfen);
    expect(openingPlanInterruption({
      strategyId: 'right-shiken', color, playedMoves, moveHistory: playedMoves, currentSfen: sfen, legalMoves,
    })).toBeNull();
    const next = openingPlanCandidates({
      strategyId: 'right-shiken', color, playedMoves, currentSfen: sfen, legalMoves,
    })[0];
    expect(next).toMatchObject({ phase: 'strategy' });
    expect(next.usi).toBe(color === 'white' ? mirrorUsiMove('3h4g') : '3h4g');
  });

  test('順番が重要な手の駒がなければ、従来どおり中断する', () => {
    // 横歩取りで2五の歩が消えた局面。次の2四歩は突き捨てなので代わりを探さない。
    const { sfen, playedMoves } = playOwnMoves(['7g7f', '2g2f', '2f2e', '6i7h'], color);
    const pawnSquare = color === 'white' ? mirrorUsiMove('2e') : '2e';
    const fields = sfen.split(' ');
    const ranks = fields[0].split('/');
    const rankIndex = pawnSquare.charCodeAt(1) - 97;
    const expanded = ranks[rankIndex].replace(/\d/g, (n) => '1'.repeat(Number(n))).split('');
    expanded[9 - Number(pawnSquare[0])] = '1';
    ranks[rankIndex] = expanded.join('').replace(/1+/g, (ones) => String(ones.length));
    fields[0] = ranks.join('/');
    const withoutPawn = fields.join(' ');
    expect(openingPlanInterruption({
      strategyId: 'yokofudori', color, playedMoves, moveHistory: playedMoves, currentSfen: withoutPawn,
      legalMoves: legalMovesOf(withoutPawn),
    })).toMatchObject({ requiresReselection: true, clearStrategy: true, reason: 'order-broken' });
  });

  test('届かない戦法では近い戦法を提案する', () => {
    const { sfen, playedMoves } = playOwnMoves(['3g3f', '3f3e', '2h1h'], color);
    const interruption = openingPlanInterruption({
      strategyId: 'sodebisha', color, playedMoves, moveHistory: playedMoves, currentSfen: sfen,
    });
    expect(interruption.reason).toBe('unreachable');
    expect(interruption.strategySuggestions.length).toBeGreaterThan(0);
    expect(interruption.strategySuggestions.map(({ id }) => id)).not.toContain('sodebisha');
    const [first] = interruption.strategySuggestions;
    expect(interruption.message).toContain(`袖飛車は難しくなったけど、${first.label}ならあと${first.distance}手だよ！`);
    const suggestions = nearestOpeningStrategies({ color, currentSfen: sfen, moveHistory: playedMoves });
    expect(suggestions.length).toBeLessThanOrEqual(3);
  });

  test('右四間飛車の飛車を回る前を「ほぼ完成」として返す', () => {
    const { sfen } = playOwnMoves(['7g7f', '4g4f', '3i4h', '4h4g', '4g5f'], color);
    expect(openingNearCompletion({ kind: 'strategy', id: 'right-shiken', color, currentSfen: sfen }))
      .toMatchObject({ id: 'before-rook-swing', definitionLabel: '右四間飛車', remaining: 1 });
    const complete = playOwnMoves(['2h4h'], color, sfen).sfen;
    expect(openingNearCompletion({ kind: 'strategy', id: 'right-shiken', color, currentSfen: complete }))
      .toBeNull();
  });
});

describe('距離計算の基本', () => {
  test('相手の駒は通れず回り道になり、自分の駒はどく1手を足して通る', () => {
    const variants = formationVariantsForColor([[['3i', 'K']]], 'black');
    const open = parseSfenBoard('4k4/9/9/9/9/9/9/9/4K4 b - 1');
    expect(formationDistance(open, 'black', variants).distance).toBe(2);
    // 4七〜4九に相手の歩の壁。5七・4六を回って3九へ行く。
    const enemyWall = parseSfenBoard('4k4/9/9/9/9/9/5p3/5p3/4Kp3 b - 1');
    expect(formationDistance(enemyWall, 'black', variants).distance).toBe(6);
    // 同じ壁が自分の歩なら、どく1手を足して最短経路を通れる。
    const ownWall = parseSfenBoard('4k4/9/9/9/9/9/5P3/5P3/4KP3 b - 1');
    expect(formationDistance(ownWall, 'black', variants).distance).toBe(3);
  });

  test('必要な駒種が盤上に足りなければ到達不能', () => {
    const variants = formationVariantsForColor([[['2h', 'K'], ['3h', 'S']]], 'black');
    const board = parseSfenBoard('4k4/9/9/9/9/9/9/9/4K4 b S 1');
    expect(formationDistance(board, 'black', variants))
      .toMatchObject({ unreachable: true, reason: 'missing-piece', kind: 'S' });
  });
});
