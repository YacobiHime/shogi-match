import { describe, expect, it } from 'vitest';
import { chooseThinkingMove, thinkProfile } from './reason-think.mjs';
import { FastBoard } from './fast-board.mjs';

const START = 'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1';
const strong = thinkProfile({ reading: 49, plan: 49, steady: 49, mate: 49 });
const never = () => 0.99;

describe('理由で指す棋士の考え方(34-16)', () => {
  it('能力値で読みの手数・大局観・うっかり・詰みの手数が変わる', () => {
    expect(thinkProfile({ reading: 12, plan: 12, steady: 12, mate: 12 })).toMatchObject({ depth: 1, qdepth: 1, shapeScale: 0, skip: 0.35, mateDepth: 1 });
    expect(thinkProfile({ reading: 18 }).depth).toBe(1);
    expect(strong).toMatchObject({ depth: 6, shapeScale: 1, skip: 0.02, mateDepth: 9 });
  });
  it('詰みがあれば詰ます', () => {
    const got = chooseThinkingMove({ sfen: '8k/9/7G1/9/9/9/9/9/K8 b G 1', profile: strong, random: never });
    expect(got).toMatchObject({ stage: 'mate', reason: 'mate' });
    const board = FastBoard.fromSfen('8k/9/7G1/9/9/9/9/9/K8 b G 1');
    board.make(board.fromUsi(got.move));
    expect(board.inCheck() && !board.hasLegal()).toBe(true);
  });
  it('ただの駒を取る(読みの最善で、理由は駒得)', () => {
    const got = chooseThinkingMove({ sfen: 'k8/9/9/9/4s4/9/9/4R4/K8 b - 1', profile: { ...strong, depth: 3 }, random: never });
    expect(got).toMatchObject({ move: '5h5e', stage: 'read', reason: 'material' });
  });
  it('定跡の手は、最善より大きく劣らなければ指す', () => {
    const got = chooseThinkingMove({ sfen: START, profile: { ...strong, depth: 3 }, planMove: '2g2f', random: never });
    expect(got).toMatchObject({ move: '2g2f', stage: 'book' });
  });
  it('うっかりした手は、思考の記録に残る', () => {
    const got = chooseThinkingMove({ sfen: START, profile: { ...strong, depth: 3 }, random: () => 0 });
    expect(got.skipped).toContain('hanging');
  });
});
