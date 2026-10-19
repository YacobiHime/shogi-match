import { describe, expect, test } from 'vitest';
import { Position } from 'tsshogi';
import { enumerateLegalMoves, STANDARD_SFEN } from '../game-state.ts';
import { CPU_POSITION_SET, cpuPositionVariants, mirrorPositionSfen } from './cpu-position-set.mjs';
import { mirrorUsiMove } from './opening-guide.mjs';
import {
  createNaturalnessEvaluator,
  LOW_NATURALNESS_THRESHOLD,
  NATURALNESS_MIN,
  PIECE_SACRIFICE_TAG,
} from './move-naturalness.mjs';

function positionAfter(moves, sfen = STANDARD_SFEN) {
  const position = Position.newBySFEN(sfen);
  for (const usi of moves) {
    const move = position.createMoveByUSI(usi);
    if (!move || !position.doMove(move)) throw new Error(`illegal ${usi}`);
  }
  return position;
}

function evaluatorAfter(moves, sfen) {
  const position = positionAfter(moves, sfen);
  return {
    position,
    evaluate: createNaturalnessEvaluator(position.sfen, { moveHistory: moves }),
  };
}

describe('指し手の自然さ', () => {
  test('局面集を盤・手番・持ち駒ごと反転し、両方で同じ目的を判定する', () => {
    for (const fixture of CPU_POSITION_SET) {
      expect(Position.newBySFEN(fixture.sfen)).toBeTruthy();
      expect(Position.newBySFEN(mirrorPositionSfen(fixture.sfen))).toBeTruthy();
      expect(Position.newBySFEN(mirrorPositionSfen(mirrorPositionSfen(fixture.sfen))).sfen)
        .toBe(Position.newBySFEN(fixture.sfen).sfen);
    }
    for (const fixture of cpuPositionVariants()) {
      const move = (usi) => fixture.mirrored ? mirrorUsiMove(usi) : usi;
      for (const simplicity of [0, 1]) {
        const evaluate = createNaturalnessEvaluator(fixture.sfen, { moveHistory: fixture.moveHistory, simplicity });
        if (fixture.id === 'rook-attacked') {
          expect(evaluate(move('P*8d')).purposeful).toBe(false);
          expect(evaluate(move('8b8d')).tags).toContain('escape');
        }
        if (fixture.id === 'anaguma') expect(evaluate(move('9i9h')).tags).toContain('develop');
        if (fixture.id === 'bougin-silver') {
          expect(evaluate(move('P*2c')).tags).toContain('guard');
          for (const usi of ['9a9b', '1a1b', '6a6b']) expect(evaluate(move(usi)).purposeful).toBe(false);
        }
      }
    }
  });

  test('狙いのない香上がりと端への桂跳ねを除き、支えのある桂の活用と作戦を残す', () => {
    for (const simplicity of [0, 1]) {
      const evaluate = createNaturalnessEvaluator(STANDARD_SFEN, { simplicity });
      for (const usi of ['9i9h', '1i1h']) {
        expect(evaluate(usi).purposeful).toBe(false);
        expect(evaluate(usi).tags).not.toContain('advance');
      }
    }
    const advancedPawn = positionAfter(['7g7f', '3c3d']);
    // 支えのある中央への桂跳ねは、次に安全な攻めの拠点へ進めるため駒組み。
    expect(createNaturalnessEvaluator(advancedPawn.sfen)('8i7g').tags).toContain('develop');
    const edgePawn = positionAfter(['9g9f', '3c3d']);
    expect(createNaturalnessEvaluator(edgePawn.sfen)('8i9g').purposeful).toBe(false);
    expect(createNaturalnessEvaluator(STANDARD_SFEN, { planMoves: ['9i9h'] })('9i9h').tags).toContain('plan');
  });

  test('実戦の静かな受けと次の攻めの準備を先後とも具体的な目的として残す', () => {
    // 校正対局で最善手を誤って除外した局面。実際の狙いが同じ反転局面でも残ること。
    const positions = [
      ['ln2k1r1l/4gsg2/p1pp1pn1p/3b1sP+R1/6pp1/1P2+BP3/P1GPP1S1P/9/LNS1KG1NL b P3p 1', '4i4h', 'guard', 46],
      ['ln2k1r1l/4g1g2/p1ppsp2p/4N4/6p+R1/1P2P4/P+BGP1KNSP/1S2+p4/LN6+b b SL6Pg 1', 'P*3h', 'guard', 78],
      ['ln1gk2nl/1rs4G1/p1p1pppsp/3p3p1/9/2P6/PPBPPPP1P/1G2G2R1/LN2K1SNL w bs2p 1', 'S*8e', 'develop', 43],
      ['ln1k5/2s6/p1p1G3p/3p1p3/1r4+R2/2b3s1P/PPBPPP3/1G2GS3/LN2K2NL w GSN4Pl3p 1', 'L*6b', 'guard', 73],
      ['ln1g3nl/1rs2kgs1/p1pppp1pp/1p4p2/7P1/2P5P/PPNPPPP2/2G2S1R1/L1S1KG1NL w Bb 1', 'B*5d', 'develop', 15],
      ['ln1g2knl/1r4g2/p2sppspp/b5p2/2PP3PP/P3PP3/1PGS1SP2/4G2R1/L3K2NL w B3Pn 1', '8a7c', 'develop', 43],
      ['ln1k5/2s6/p1p1G3p/3p1p3/1r4+R2/2b3s1P/PPBPPP3/1G2G4/LN2K1SNL w SN4Pgl3p 1', '6a7a', 'guard', 71],
      ['ln1g2knl/9/pp2+Ppsgp/1B1P2p2/2P4pP/PP2SP3/2G1K1P2/5R3/L3sSbNL w RN2Pg2p 1', 'P*5e', 'threaten', 83],
      ['ln2+RpGnl/4S2k1/p5ggp/1p1PB1ps1/2P4pP/PP2SP3/2G3P2/5b1K1/L6NL w RN3Ps2p 1', '1c1d', 'pawn-tension', 109],
    ];
    for (const [sfen, usi, tag, ply] of positions) {
      for (const mirrored of [false, true]) {
        const evaluate = createNaturalnessEvaluator(mirrored ? mirrorPositionSfen(sfen) : sfen, { ply });
        const result = evaluate(mirrored ? mirrorUsiMove(usi) : usi);
        expect(result.purposeful, usi).toBe(true);
        expect(result.tags, usi).toContain(tag);
        expect(result.tags, usi).not.toContain('idle-drop');
      }
    }
  });

  test('取られる銀で歩を取る手は、取られる前に取る手として扱う', () => {
    const sfen = '4k4/9/5g3/4p4/4S4/9/9/9/4K4 b - 1';
    const evaluated = createNaturalnessEvaluator(sfen)('5e5d');
    expect(evaluated.tags).toContain('desperado');
    expect(evaluated.tags).not.toContain('losing-capture');
    expect(evaluated.tags).not.toContain(PIECE_SACRIFICE_TAG);
  });

  test('損にならない当たりからの静かな退避は、当たり前のescapeを広げずguardとする', () => {
    const sfen = '4kr3/9/9/9/5R3/5G3/9/9/4K4 b - 1';
    const result = createNaturalnessEvaluator(sfen)('4e3e');
    expect(result.purposeful).toBe(true);
    expect(result.tags).toContain('guard');
    expect(result.tags).not.toContain('escape');
  });

  test('損な取りの重みを素人らしさに応じて緩める', () => {
    // 銀で香を取り、金で取り返される。銀は移動前には当たっていない。
    const sfen = '4k4/9/9/9/4S1g2/5l3/9/9/4K4 b - 1';
    const plain = createNaturalnessEvaluator(sfen)('5e4f');
    const simple = createNaturalnessEvaluator(sfen, { simplicity: 1 })('5e4f');
    expect(plain.tags).toContain('losing-capture');
    expect(simple.tags).toContain('losing-capture');
    // 香の侵入を止めるguard(1.5倍)と、取り自体の重みを分けて確認する。
    expect(plain.weight / 1.5).toBeCloseTo(0.4);
    expect(simple.weight / 1.5).toBeCloseTo(1.0);
  });
  test('取り返しは無関係な手より重い', () => {
    const { evaluate } = evaluatorAfter(['7g7f', '3c3d', '8h2b+']);
    const recapture = evaluate('3a2b');
    const unrelated = evaluate('9c9d');
    expect(recapture.tags).toContain('recapture');
    expect(recapture.weight).toBeGreaterThan(unrelated.weight * 2);
  });

  test('序盤の意味のない玉移動は軽く、囲いへ向かう玉移動は軽くしない', () => {
    const { evaluate } = evaluatorAfter(['7g7f', '3c3d']);
    const pawn = evaluate('2g2f').weight;
    expect(evaluate('5i5h').weight).toBeLessThan(pawn * 0.2);
    expect(evaluate('5i4h').weight).toBeLessThan(pawn * 0.3);
    expect(evaluate('5i4h').tags).toContain('early-king');
    // 居飛車の飛車とは反対側へ寄る6八玉は、囲いへの一手として扱う。
    expect(evaluate('5i6h').tags).toContain('castle-build');
    expect(evaluate('5i6h').weight).toBeGreaterThanOrEqual(1);
  });

  test('自陣の隅や端への意図のない駒打ちは軽い', () => {
    const { evaluate } = evaluatorAfter(['7g7f', '3c3d', '8h2b+', '3a2b']);
    const cornerDrop = evaluate('B*9h');
    expect(cornerDrop.tags).toContain('corner-drop');
    expect(cornerDrop.weight).toBeLessThan(LOW_NATURALNESS_THRESHOLD);
    expect(cornerDrop.weight).toBeLessThan(evaluate('2g2f').weight * 0.1);
    // 重みは0にしないので、ごくまれには選ばれる。
    expect(cornerDrop.weight).toBeGreaterThanOrEqual(NATURALNESS_MIN);
  });

  test('理由のない駒捨ては軽い', () => {
    const { evaluate } = evaluatorAfter(['7g7f', '3c3d']);
    // 角を2二の銀・金で取られる升へ出る手(▲3三角不成相当の成り込みは駒得になるので別)。
    const sacrifice = evaluate('8h4d');
    expect(sacrifice.tags).toContain('sacrifice');
    expect(sacrifice.weight).toBeLessThan(0.1);
  });

  test('歩以外をただで渡す手は、王手や成りの加点があっても軽く、駒捨てとして印を付ける', () => {
    const { evaluate } = evaluatorAfter(['7g7f', '3c3d']);
    // ▲3三角成は王手だが、2一の桂でただで取られる。
    const checkSacrifice = evaluate('8h3c+');
    expect(checkSacrifice.tags).toContain(PIECE_SACRIFICE_TAG);
    expect(checkSacrifice.weight).toBeLessThanOrEqual(0.05);
    // 角交換は駒を渡す手ではない。
    expect(evaluate('8h2b+').tags).not.toContain(PIECE_SACRIFICE_TAG);
    expect(evaluate('2g2f').tags).not.toContain(PIECE_SACRIFICE_TAG);
  });

  test('王手をかけられた局面では回避手を減点せず、王手駒を取る手を最も重くする', () => {
    const sfen = '4k4/9/9/9/9/9/9/4r4/3GK4 b - 1';
    const position = Position.newBySFEN(sfen);
    const evaluate = createNaturalnessEvaluator(sfen, { moveHistory: ['5b5h'], ply: 10 });
    const evasions = enumerateLegalMoves(position).map(({ usi }) => [usi, evaluate(usi)]);
    expect(evasions.length).toBeGreaterThan(0);
    for (const [, result] of evasions) {
      expect(result.tags.some((tag) => [
        'capture-checker', 'king-escape', 'drop-block', 'move-block',
      ].includes(tag))).toBe(true);
      expect(result.tags).not.toContain('early-king');
    }
    const byMove = Object.fromEntries(evasions);
    expect(byMove['6i5h'].tags).toContain('capture-checker');
    expect(byMove['6i5h'].weight).toBeGreaterThan(byMove['5i4i'].weight);
    expect(byMove['5i4i'].weight).toBeGreaterThanOrEqual(1);
  });

  test('王手を受けた局面の合駒打ちは、意図のない駒打ちとして減点しない', () => {
    const sfen = '4k4/9/9/9/4r4/9/9/9/4K4 b G 1';
    const evaluate = createNaturalnessEvaluator(sfen, { ply: 10 });
    const block = evaluate('G*5h');
    expect(block.tags).toContain('drop-block');
    expect(block.tags).not.toContain('idle-drop');
    expect(block.weight).toBeGreaterThanOrEqual(1);
  });

  test('同じ駒の往復は軽い', () => {
    const { evaluate } = evaluatorAfter(['7g7f', '3c3d', '6i5h', '4a4b']);
    expect(evaluate('5h6i').tags).toContain('shuffle');
    expect(evaluate('5h6i').weight).toBeLessThan(evaluate('2g2f').weight * 0.3);
  });

  test('素人らしさを効かせると、歩の取り合いを解消する手を強く好む', () => {
    const moves = ['7g7f', '3c3d', '2g2f', '8c8d', '2f2e', '8d8e', '2e2d'];
    const position = positionAfter(moves);
    const plain = createNaturalnessEvaluator(position.sfen, { moveHistory: moves });
    const simple = createNaturalnessEvaluator(position.sfen, { moveHistory: moves, simplicity: 1 });
    expect(simple('2c2d').tags).toContain('pawn-tension');
    // guardの加点と重み8の上限が両方に掛かっても、歩の取り合いをより好む。
    expect(simple('2c2d').weight).toBeGreaterThan(plain('2c2d').weight);
    // 取らずに放っておく手との差が広がる。
    expect(simple('2c2d').weight / simple('9c9d').weight)
      .toBeGreaterThan(plain('2c2d').weight / plain('9c9d').weight * 3);
  });

  test('素人らしさを効かせると、目的の見えない手を避け、狙いの見える手を残す', () => {
    const { position } = evaluatorAfter(['7g7f', '3c3d']);
    const simple = createNaturalnessEvaluator(position.sfen, { moveHistory: ['7g7f', '3c3d'], simplicity: 1 });
    // 飛車を端へ寄せるだけの手は目的が見えない。飛車先の歩を伸ばす手は狙いが分かる。
    expect(simple('2h1h').tags).toContain('aimless');
    expect(simple('2g2f').tags).toContain('rook-pawn-push');
    expect(simple('2g2f').weight).toBeGreaterThan(simple('2h1h').weight * 3);
    // 0なら従来どおり、加点も減点もしない。
    const plain = createNaturalnessEvaluator(position.sfen, { moveHistory: ['7g7f', '3c3d'] });
    expect(plain('2h1h').tags).not.toContain('aimless');
  });

  test('優勢なときは駒の交換を好み、局面を単純にする', () => {
    const { position } = evaluatorAfter(['7g7f', '3c3d']);
    const sfen = position.sfen;
    const ahead = createNaturalnessEvaluator(sfen, { moveHistory: ['7g7f', '3c3d'], simplicity: 1, advantage: 800 });
    const even = createNaturalnessEvaluator(sfen, { moveHistory: ['7g7f', '3c3d'], simplicity: 1, advantage: 0 });
    // ▲2二角成の角交換。
    expect(ahead('8h2b+').tags).toContain('simplify');
    expect(ahead('8h2b+').weight).toBeGreaterThan(even('8h2b+').weight);
  });

  test('後手番でも同じ基準で評価する', () => {
    const { evaluate } = evaluatorAfter(['7g7f']);
    expect(evaluate('5a5b').tags).toContain('early-king');
    expect(evaluate('5a4b').tags).toContain('castle-build');
  });
});
