import { describe, expect, it } from 'vitest';
import {
  PLAN_ADVICE_PER_GAME,
  PLAN_SWING_MARGIN,
  confirmPlanAdvice,
  loadCoachPlans,
  planAdvice,
  planAdviceReason,
  planSwingPraise,
  recordCoachPlan,
  rookSwing,
} from './coach-plan-advice.mjs';

const START = 'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1';
// 先手が四間飛車(6八飛)に振ったあとの局面。
const SHIKEN = 'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B1R5/LNSGKGSNL b - 1';
const cp = (value) => ({ type: 'cp', value });
const options = (overrides = {}) => ({
  sfen: START,
  color: 'black',
  moveCount: 10,
  candidates: [
    { rank: 1, move: '2h4h', score: cp(150) },
    { rank: 2, move: '2g2f', score: cp(40) },
  ],
  ...overrides,
});

describe('rookSwing', () => {
  it('maps the destination file to a strategy from the player side', () => {
    expect(rookSwing(START, '2h4h', 'black')).toMatchObject({ planId: 'right-shiken', label: '右四間飛車', boardFile: 4, reswing: false });
    expect(rookSwing(START, '2h6h', 'black')).toMatchObject({ planId: 'shiken', boardFile: 6 });
    expect(rookSwing(START, '2h5h', 'black')?.planId).toBe('nakabisha');
    expect(rookSwing(START, '2h7h', 'black')?.planId).toBe('sangen');
    expect(rookSwing(START, '2h8h', 'black')?.planId).toBe('mukai');
    expect(rookSwing(START, '2h3h', 'black')?.planId).toBe('sodebisha');
  });
  it('mirrors files for the second player and keeps board numbers in the text', () => {
    const white = START.replace(/ b /, ' w ');
    // 後手の右四間飛車は6二飛、四間飛車は4二飛。
    expect(rookSwing(white, '8b6b', 'white')).toMatchObject({ planId: 'right-shiken', boardFile: 6 });
    expect(rookSwing(white, '8b4b', 'white')).toMatchObject({ planId: 'shiken', boardFile: 4 });
  });
  it('only treats a lateral unpromoted rook move on the home rank as a swing', () => {
    expect(rookSwing(START, '2g2f', 'black')).toBeNull();
    expect(rookSwing(START, '2h2d', 'black')).toBeNull();
    expect(rookSwing(START, '8h7h', 'black')).toBeNull(); // 角
    expect(rookSwing(START, 'R*5e', 'black')).toBeNull();
    expect(rookSwing(START.replace('1B5R1', '1B5+R1'), '2h4h', 'black')).toBeNull();
  });
  it('calls a move from a ranging file a re-swing and keeps 3/4 files for static rook', () => {
    expect(rookSwing(SHIKEN, '6h8h', 'black')).toMatchObject({ planId: 'mukai', reswing: true });
    expect(rookSwing(SHIKEN, '6h7h', 'black')).toMatchObject({ planId: 'sangen', reswing: true });
    // 四間飛車の飛車を4筋へ動かす手は「右四間飛車」と言わない。
    expect(rookSwing(SHIKEN, '6h4h', 'black')).toBeNull();
    // 端へ逃げた飛車の横の動きは振る手にしない。
    expect(rookSwing(START.replace('1B5R1', 'RB7'), '9h8h', 'black')).toBeNull();
  });
});

describe('planAdvice', () => {
  it('proposes the strategy when the swing is best by the margin', () => {
    const advice = planAdvice(options());
    expect(advice).toMatchObject({ topic: 'plan-right-shiken', swingMove: '2h4h', otherMove: '2g2f' });
    expect(advice?.text).toMatch(/^飛車を4筋に振って、右四間飛車にしたら？ /);
  });
  it('needs the swing to be the best move and clearly better than not swinging', () => {
    expect(planAdvice(options({ candidates: [{ rank: 1, move: '2g2f', score: cp(150) }, { rank: 2, move: '2h4h', score: cp(140) }] }))).toBeNull();
    expect(planAdvice(options({ candidates: [{ rank: 1, move: '2h4h', score: cp(100) }, { rank: 2, move: '2g2f', score: cp(100 - PLAN_SWING_MARGIN + 1) }] }))).toBeNull();
    // ほかの筋へ振る手は比べる相手にしない。
    expect(planAdvice(options({
      candidates: [
        { rank: 1, move: '2h4h', score: cp(150) },
        { rank: 2, move: '2h6h', score: cp(140) },
        { rank: 3, move: '2g2f', score: cp(0) },
      ],
    }))?.otherMove).toBe('2g2f');
    expect(planAdvice(options({ candidates: [{ rank: 1, move: '2h4h', score: cp(150) }] }))).toBeNull();
  });
  it('stays quiet in check, under a mate threat, in a lopsided game or late', () => {
    expect(planAdvice(options({ inCheck: true }))).toBeNull();
    expect(planAdvice(options({ rookUnderThreat: true }))).toBeNull();
    // 差が大きすぎるのは駒の取り合い。
    expect(planAdvice(options({ candidates: [{ rank: 1, move: '2h4h', score: cp(500) }, { rank: 2, move: '2g2f', score: cp(100) }] }))).toBeNull();
    expect(planAdvice(options({ mateThreat: true }))).toBeNull();
    expect(planAdvice(options({ moveCount: 81 }))).toBeNull();
    expect(planAdvice(options({ candidates: [{ rank: 1, move: '2h4h', score: cp(1700) }, { rank: 2, move: '2g2f', score: cp(1500) }] }))).toBeNull();
  });
  it('does not repeat a strategy, respects the selected plan and the per-game limit', () => {
    expect(planAdvice(options({ selectedStrategy: 'right-shiken' }))).toBeNull();
    expect(planAdvice(options({ advisedTopics: ['plan-right-shiken'] }))).toBeNull();
    const many = Array.from({ length: PLAN_ADVICE_PER_GAME }, (_, index) => `plan-x${index}`);
    expect(planAdvice(options({ advisedTopics: many }))).toBeNull();
    expect(planAdvice(options({ advisedTopics: ['castle-yagura'] }))).not.toBeNull();
  });
  it('words a re-swing', () => {
    const advice = planAdvice(options({
      sfen: SHIKEN,
      moveCount: 50,
      candidates: [{ rank: 1, move: '6h8h', score: cp(90) }, { rank: 2, move: '3g3f', score: cp(-10) }],
    }));
    expect(advice?.text).toMatch(/^飛車を8筋に振り直して、向かい飛車にしたら？/);
  });
});

describe('planAdviceReason', () => {
  it('prefers compatibility with the opponent formation, then the aim, then the AI', () => {
    const rightShiken = rookSwing(START, '2h4h', 'black');
    expect(planAdviceReason(rightShiken, ['金矢倉'])).toBe('相手の金矢倉と相性がいい形だよ！');
    expect(planAdviceReason(rightShiken, [])).toMatch(/^狙いは「4筋に攻め駒を集めて、正面突破すること」だよ！$/);
    // 右四間飛車を勧める台詞は、四間飛車の相性にしない。
    const shiken = rookSwing(START, '2h6h', 'black');
    expect(planAdviceReason(shiken, ['金矢倉'])).not.toMatch(/金矢倉/);
    expect(planAdviceReason({ ...shiken, strategyId: 'unknown' }, [])).toBe('AIの読みでも、いちばんの手だよ！');
  });
});

describe('confirmPlanAdvice and praise', () => {
  it('keeps the advice only when the deeper read still prefers the swing', () => {
    const advice = planAdvice(options());
    expect(confirmPlanAdvice(advice, [{ move: '2h4h', score: cp(120) }, { move: '2g2f', score: cp(30) }])).toMatchObject({ swingScore: cp(120), otherScore: cp(30) });
    expect(confirmPlanAdvice(advice, [{ move: '2h4h', score: cp(80) }, { move: '2g2f', score: cp(40) }])).toBeNull();
    expect(confirmPlanAdvice(advice, [{ move: '2h4h', score: cp(80) }])).toBeNull();
    expect(confirmPlanAdvice(advice, [{ move: '2h4h', score: cp(600) }, { move: '2g2f', score: cp(0) }])).toBeNull();
  });
  it('praises a swing to the proposed strategy', () => {
    const advice = planAdvice(options());
    expect(planSwingPraise(advice, { sfen: START, usi: '2h4h', color: 'black' })?.text).toBe('右四間飛車だね！ AIの読みと同じ、いい判断だよ！');
    expect(planSwingPraise(advice, { sfen: START, usi: '2h6h', color: 'black' })).toBeNull();
  });
});

describe('coach plan unlocks', () => {
  it('remembers accepted plans', () => {
    const store = new Map();
    const storage = { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) };
    expect(loadCoachPlans(storage)).toEqual([]);
    recordCoachPlan(storage, 'right-shiken');
    recordCoachPlan(storage, 'right-shiken');
    recordCoachPlan(storage, 'nonsense');
    expect(loadCoachPlans(storage)).toEqual(['right-shiken']);
  });
});
