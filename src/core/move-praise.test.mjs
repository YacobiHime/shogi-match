import { describe, expect, it } from 'vitest';
import {
  advanceTurningPoints,
  classifyMoveQuality,
  createTurningPointState,
  getMovePraise,
  materialGain,
  rewindTurningPointState,
} from './move-praise.mjs';
import { coachExpressionForText, coachPlainText, coachTextSegments } from './coach-expression.mjs';
import { coachAdvicePriority } from './coach-advice-scheduler.mjs';
import { formatSpokenMove } from './match-assists.mjs';

const cp = (value) => ({ type: 'cp', value });

describe('classifyMoveQuality', () => {
  const deep = [
    { rank: 1, move: '5c5d', score: cp(900) },
    { rank: 2, move: '7g7f', score: cp(400) },
  ];

  it('浅い読みでも最善なら好手', () => {
    const quality = classifyMoveQuality({
      move: '5c5d',
      deepCandidates: deep,
      shallowCandidates: [{ rank: 1, move: '5c5d', score: cp(700) }],
    });
    expect(quality).toMatchObject({ kind: 'good', gap: 500 });
  });

  it('浅い読みで見落とす最善手は神の一手', () => {
    expect(classifyMoveQuality({
      move: '5c5d',
      deepCandidates: deep,
      shallowCandidates: [
        { rank: 1, move: '7g7f', score: cp(300) },
        { rank: 2, move: '2g2f', score: cp(250) },
      ],
    })?.kind).toBe('god');
    expect(classifyMoveQuality({
      move: '5c5d',
      deepCandidates: deep,
      shallowCandidates: [
        { rank: 1, move: '7g7f', score: cp(300) },
        { rank: 2, move: '5c5d', score: cp(100) },
      ],
    })?.kind).toBe('god');
  });

  it('浅い読みとの差が小さければ好手に留める', () => {
    expect(classifyMoveQuality({
      move: '5c5d',
      deepCandidates: deep,
      shallowCandidates: [
        { rank: 1, move: '7g7f', score: cp(300) },
        { rank: 2, move: '5c5d', score: cp(250) },
      ],
    })?.kind).toBe('good');
  });

  it('最善手でない手や次善手との差が小さい手は褒めない', () => {
    expect(classifyMoveQuality({ move: '7g7f', deepCandidates: deep })).toBeNull();
    expect(classifyMoveQuality({
      move: '5c5d',
      deepCandidates: [deep[0], { rank: 2, move: '7g7f', score: cp(600) }],
    })).toBeNull();
    expect(classifyMoveQuality({ move: '5c5d', deepCandidates: [deep[0]] })).toBeNull();
  });
});

describe('materialGain', () => {
  it('取られていない駒の取得は駒の価値だけ得をする', () => {
    expect(materialGain({ capturedPieceType: 'bishop', moverPieceType: 'pawn' })).toBe(8);
  });

  it('直前に取られた駒と、取り返される駒を差し引く', () => {
    expect(materialGain({
      capturedPieceType: 'silver', moverPieceType: 'pawn', opponentPreviousCapture: 'silver',
    })).toBe(0);
    expect(materialGain({
      capturedPieceType: 'silver', moverPieceType: 'pawn', destinationAttacked: true,
    })).toBe(4);
    expect(materialGain({
      capturedPieceType: 'pawn', moverPieceType: 'rook', destinationAttacked: true,
    })).toBeLessThan(0);
    expect(materialGain({})).toBe(0);
  });
});

describe('advanceTurningPoints', () => {
  function play(values) {
    let state = createTurningPointState();
    const advices = [];
    values.forEach((value, index) => {
      const ply = (index + 1) * 2;
      const result = advanceTurningPoints(state, {
        ply,
        afterScore: cp(value),
        beforeScore: cp(index ? values[index - 1] : value),
      });
      state = result.state;
      advices.push(result.advice?.key ?? null);
    });
    return { state, advices };
  }

  it('劣勢から優勢へ変わったら逆転を1回だけ伝える', () => {
    const { advices } = play([-700, -600, 400, 500]);
    expect(advices).toEqual([null, null, 'praise-reversal', null]);
  });

  it('大差から縮まったら伝え、同じ底からは繰り返さない', () => {
    const { advices } = play([-1500, -1400, -800, -700]);
    expect(advices).toEqual([null, null, 'praise-narrowing', null]);
  });

  it('苦しい局面で評価を落とさず指し続けたら粘りを褒める', () => {
    const { advices } = play([-1000, -1000, -1000, -1000]);
    expect(advices).toEqual([null, null, 'praise-endurance', null]);
  });

  it('待ったで取り消した手の評価を忘れる', () => {
    const { state } = play([-700, -600, 400]);
    expect(rewindTurningPointState(state, 4).entries.map(({ ply }) => ply)).toEqual([2, 4]);
  });
});

describe('getMovePraise', () => {
  const base = { level: 'detailed', beforeScore: cp(300), afterScore: cp(280) };

  it('神の一手は評価値とルビ付きで伝える', () => {
    const praise = getMovePraise({ ...base, quality: { kind: 'god', score: cp(1234), gap: 800 } });
    expect(praise).toEqual({ key: 'praise-god-move', text: '評価値+1234、｜正《まさ》に神の一手だね！' });
    expect(coachPlainText(praise.text)).toBe('評価値+1234、正に神の一手だね！');
  });

  it('要望どおりの台詞を優先度順に返す', () => {
    expect(getMovePraise({ ...base, quality: { kind: 'good', score: cp(300), gap: 400 } })?.text)
      .toBe('好手だね、良い調子！');
    expect(getMovePraise({ ...base, gaveMateThreat: true })?.text)
      .toBe('詰めろを掛けたね。良い手だと思うよ！');
    expect(getMovePraise({ ...base, defendedMateThreat: true, gaveMateThreat: true })?.text)
      .toBe('相手の詰めろを受けきったね！これで一安心。');
    expect(getMovePraise({ ...base, materialGain: 5 })?.text).toBe('駒得ざっくざく～♪');
    expect(getMovePraise({
      ...base,
      materialGain: 5,
      turningAdvice: { key: 'praise-reversal', text: '逆転！この調子だね。' },
    })?.key).toBe('praise-reversal');
  });

  it('評価を大きく落とした手は褒めない', () => {
    expect(getMovePraise({
      ...base,
      afterScore: cp(-100),
      quality: { kind: 'good', score: cp(300), gap: 400 },
      materialGain: 5,
    })).toBeNull();
  });

  it('かち込みは好手系より後、粘りより前', () => {
    const fallback = { key: 'enter-enemy-camp', text: 'かち込むよ～！' };
    const endurance = { key: 'praise-endurance', text: '苦しい局面だけど、よく粘ってると思う！頑張って！' };
    expect(getMovePraise({ ...base, fallback, turningAdvice: endurance })).toBe(fallback);
    expect(getMovePraise({ ...base, turningAdvice: endurance })).toBe(endurance);
  });

  it('応援のみでは形勢の転換点だけを伝える', () => {
    const turningAdvice = { key: 'praise-narrowing', text: '差が縮まってきたよ！まだやれる！' };
    expect(getMovePraise({ ...base, level: 'encourage', materialGain: 5 })).toBeNull();
    expect(getMovePraise({ ...base, level: 'encourage', turningAdvice })).toBe(turningAdvice);
    expect(getMovePraise({ ...base, level: 'off', turningAdvice })).toBeNull();
  });
});

describe('褒め言葉の表示', () => {
  it('ルビ指定を区切る', () => {
    expect(coachTextSegments('評価値+1、｜正《まさ》に神の一手だね！')).toEqual([
      { text: '評価値+1、' },
      { text: '正', ruby: 'まさ' },
      { text: 'に神の一手だね！' },
    ]);
    expect(coachTextSegments('ふつうの台詞')).toEqual([{ text: 'ふつうの台詞' }]);
  });

  it('「苦しい」「詰めろ」を含む褒め言葉でも心配顔にしない', () => {
    expect(coachExpressionForText('苦しい局面だけど、よく粘ってると思う！頑張って！')).toBe('neutral');
    expect(coachExpressionForText('詰めろを掛けたね。良い手だと思うよ！')).toBe('neutral');
    expect(coachExpressionForText('相手の詰めろを受けきったね！これで一安心。')).toBe('neutral');
    expect(coachExpressionForText('詰めろだね。受けないと負けちゃう…')).toBe('worried');
  });

  it('褒め言葉は通常助言に上書きされない優先度を持つ', () => {
    expect(coachAdvicePriority({ key: 'praise-good-move' }))
      .toBeGreaterThan(coachAdvicePriority({ key: 'middle-good' }));
    expect(coachAdvicePriority({ key: 'praise-good-move' }))
      .toBeLessThan(coachAdvicePriority({ key: 'move-blunder-1' }));
  });

  it('閃きの最善手は駒名を略さず読み上げる', () => {
    const sfen = 'lnsgkgsnl/1r5b1/pppppp1pp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1';
    expect(formatSpokenMove('2h2c+', sfen)).toBe('2三飛車成');
    expect(formatSpokenMove('2i1g', 'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1'))
      .toBe('1七桂馬');
    expect(formatSpokenMove('B*5e', 'lnsgkgsnl/1r7/ppppppppp/9/9/9/PPPPPPPPP/7R1/LNSGKGSNL b B 1'))
      .toBe('5五角打');
  });
});
