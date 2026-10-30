import { describe, expect, it } from 'vitest';
import { QUESTIONS, answerFeedback, moveText, questionText } from './skill-test-feedback.mjs';

describe('棋力テストの問いと、答えのあとの一言', () => {
  it('問いの文は種類ごとの約束で、手筋は駒得と寄せで分ける', () => {
    expect(questionText({ type: 'save', sfen: '' })).toBe(QUESTIONS.save);
    expect(questionText({ type: 'defend', sfen: '' })).toContain('詰まないように受けよう');
    expect(questionText({ type: 'tactic', sfen: '', tesuji: 'knight-fork' })).toBe(QUESTIONS.tacticGain);
    expect(questionText({ type: 'tactic', sfen: '', tesuji: 'edge-king-edge-pawn' })).toBe(QUESTIONS.tacticYose);
    expect(questionText({ type: 'mate', sfen: '', problem: { plies: 3 } })).toBe('3手で詰ませよう');
    expect(moveText('7g7f', 'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1')).toBe('▲7六歩');
  });

  it('取る: 取った駒でほめ、外したら取れた駒と、守りがなかったことを言う', () => {
    const item = { type: 'take', sfen: '4k4/9/9/5s3/2s2p3/5P3/9/9/2R1K4 b - 1', best: '7i7e', accepted: ['7i7e'] };
    expect(answerFeedback(item, { correct: true, played: '7i7e' }).speech).toBe('いいね！ 銀を取って得したね。');
    const wrong = answerFeedback(item, { correct: false, played: '5i4h' });
    expect(wrong.speech).toBe('答えは▲7五飛。銀は、だれも守っていなかったよ。');
    expect(wrong.marks).toEqual([{ file: 7, rank: 5, tone: 'target' }]);
    expect(wrong.hold).toBe('manual');
  });

  it('守る: 外したら、取られそうだった駒に赤い輪、相手の取る手に点線の矢印', () => {
    const item = { type: 'save', sfen: '4k4/9/9/9/4p4/4G4/9/9/4K4 b - 1', best: '5f5e', accepted: ['5f4f', '5f5e', '5f5g'], threat: '5e5f', target: '5f' };
    expect(answerFeedback(item, { correct: true, played: '5f4f' }).speech).toBe('いいね！ 金を守ったね。');
    const wrong = answerFeedback(item, { correct: false, played: '5i4h' });
    expect(wrong.speech).toBe('答えは▲5五金。何もしないと、△5六歩で金を取られていたよ。');
    expect(wrong.riskSquares).toEqual(['5f']);
    expect(wrong.threatArrows).toEqual([{ usi: '5e5f', color: 'white' }]);
  });

  it('手筋: 正解は名前でほめて続きを見せ、外したら名前と図鑑の一言', () => {
    const item = {
      type: 'tactic', sfen: '8k/9/3s1g3/9/9/9/9/9/K8 b N 1', best: 'N*5e', accepted: ['N*5e'], tesuji: 'knight-fork',
      targets: ['6c', '4c'], line: ['N*5e', '6c6d', '5e4c+'],
    };
    const right = answerFeedback(item, { correct: true, played: 'N*5e' });
    expect(right.speech).toBe('ふんどしの桂！ いいね。');
    expect(right.line).toEqual(['6c6d', '5e4c+']);
    expect(right.hold).toBe('tesuji');
    const wrong = answerFeedback(item, { correct: false, played: '9i8h' });
    expect(wrong.speech).toBe('答えは▲5五桂打。手筋は「ふんどしの桂」。桂馬で2枚の駒を同時にねらう、両取りの形だよ！');
    expect(wrong.marks.map(({ file, rank }) => `${file}${rank}`).sort()).toEqual(['43', '63']);
    expect(wrong.line).toEqual(['N*5e', '6c6d', '5e4c+']);
  });

  it('受け: 外したら、何もしないときの詰み筋の1手目と、ほかの受け方もあったこと', () => {
    const item = { type: 'defend', sfen: '4k4/9/9/9/9/9/9/9/4K4 b - 1', best: '5i4h', accepted: ['5i4h', '5i6h'], threat: '5a5b' };
    expect(answerFeedback(item, { correct: true, played: '5i6h' }).speech).toBe('いいね！ 詰めろを受けたね。');
    const wrong = answerFeedback(item, { correct: false, played: '5i5h' });
    expect(wrong.speech).toBe('答えは▲4八玉。何もしないと、△5二玉から詰んでいたよ。ほかにも受け方があったよ。');
    expect(wrong.threatArrows).toEqual([{ usi: '5a5b', color: 'white' }]);
  });

  it('判断: 外したら、答えの記号と手、そのあとの読み筋', () => {
    const item = { type: 'judge', sfen: 'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1', best: '7g7f', accepted: ['7g7f'], choices: ['2g2f', '7g7f', '1g1f'], line: ['7g7f', '3c3d', '2g2f'] };
    const wrong = answerFeedback(item, { correct: false, played: '1g1f' });
    expect(wrong.speech.startsWith('答えはBの▲7六歩。')).toBe(true);
    expect(wrong.line).toEqual(['7g7f', '3c3d', '2g2f']);
    expect(answerFeedback(item, { correct: true, played: '7g7f' }).hold).toBe('auto');
  });
});
