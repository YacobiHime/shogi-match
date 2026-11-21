import { describe, expect, it } from 'vitest';
import { REVIEW_AIM, causeExplain, causeLabel, classifyMove, judgeReviewGuess, planSection, reviewMarks } from './disciple-causes.mjs';

/** 先手から見た評価値つきの棋譜にする。 */
const game = (moves, evals, extra = {}) => moves.map((move, index) => ({ move, eval: evals[index] ?? evals.at(-1), ...(extra[index] ?? {}) }));

describe('崩れ方の見立て(33-5)', () => {
  it('次の手で駒をただで取られた → うっかり。赤い輪は取られた升、点線の矢印は取る手', () => {
    const entries = game(['7g7f', '3c3d', '8h4d', '4c4d', '2g2f', '8b8c'], [30, 20, -800, -850, -850, -850]);
    const judged = classifyMove(entries, 'black', 3);
    expect(judged).toMatchObject({ cause: 'careless', rings: ['4d'], threat: '4c4d' });
    expect(judged.swing).toBeLessThanOrEqual(-2);
  });

  it('相手の次の手が両取りの形で、そのあと駒を損した → 手筋をくらった(副はうっかり)', () => {
    const sfen = '4k4/9/5n3/9/9/9/3G1R2P/9/4K4 b - 1';
    const entries = game(['1g1f', '4c5e', '4g4h', '5e6g+'], [0, -600, -650, -700]);
    const judged = classifyMove(entries, 'black', 1, { sfen });
    expect(judged).toMatchObject({ cause: 'tactic', alt: 'careless', threat: '4c5e' });
    expect(judged.tesuji).toBe('ふんどしの桂');
  });

  it('駒の損得が動かないのに形勢を損ねた → 方針の誤り。序盤なら副は作戦負け', () => {
    const entries = game(['7g7f', '3c3d', '2g2f', '4c4d', '6i7h', '8b4b'], [30, 20, 30, 20, -300, -320]);
    expect(classifyMove(entries, 'black', 5)).toMatchObject({ cause: 'policy', alt: 'plan' });
  });

  it('指したあと相手に詰みが生じた → 受け損ない。詰みを逃した → 寄せの誤り(詰み)', () => {
    const entries = game(['7g7f', '3c3d', '2g2f', '4c4d', '6i7h', '8b4b'], [30, 20, 30, 20, -29990, -29991]);
    expect(classifyMove(entries, 'black', 5)?.cause).toBe('defense');
    const missed = game(['7g7f', '3c3d', '2g2f', '4c4d', '6i7h', '8b4b'], [30, 20, 30, 20, 900, 900], { 4: { d: { m: 1 } } });
    expect(classifyMove(missed, 'black', 5)).toMatchObject({ cause: 'yose', sub: 'mate' });
  });

  it('勝っている局面で、駒を損さずに形勢を落とした → 寄せの誤り(寄せが遅れた)', () => {
    const entries = game(['7g7f', '3c3d', '2g2f', '4c4d', '6i7h', '8b4b'], [30, 20, 30, 1600, 900, 900]);
    expect(classifyMove(entries, 'black', 5)).toMatchObject({ cause: 'yose', sub: 'slow' });
  });

  it('秒読みの手は、背景の札に「時間」を付ける(理由は中身で決める)', () => {
    const entries = game(['7g7f', '3c3d', '8h4d', '4c4d', '2g2f', '8b8c'], [30, 20, -800, -850, -850, -850], { 2: { d: { c: 'byoyomi' } } });
    expect(classifyMove(entries, 'black', 3)).toMatchObject({ cause: 'careless', tags: ['time'] });
  });
});

describe('作戦負けの区間(33-5)', () => {
  // 飛車を行ったり来たりして、駒を取らずに40手。形勢は少しずつ落ちる。
  const shuffle = Array.from({ length: 40 }, (_, index) => ['2h3h', '8b7b', '3h2h', '7b8b'][index % 4]);
  it('序盤の終わりに−300点以下で、大きく落ちた1手がなければ区間にする', () => {
    const entries = game(shuffle, shuffle.map((_, index) => -12 * index));
    const section = planSection(entries, 'black');
    expect(section).toMatchObject({ from: 1, to: 40, startWord: '互角' });
    const marks = reviewMarks(entries, 'black');
    expect(marks).toEqual([expect.objectContaining({ cause: 'plan', sub: 'section', from: 1, to: 40 })]);
  });
  it('序盤のうちに大きく落ちた1手があれば、区間にしない(その手で見立てる)', () => {
    const evals = shuffle.map((_, index) => (index < 20 ? 0 : -500));
    expect(planSection(game(shuffle, evals), 'black')).toBeNull();
  });
});

describe('答えの判定(33-5)', () => {
  it('主を当てれば見抜いた、副ならおしい、外れは答え。秒読みなら時間の印', () => {
    const mark = { cause: 'tactic', alt: 'careless', tags: ['time'] };
    expect(judgeReviewGuess(mark, 'tactic')).toMatchObject({ right: true, boost: REVIEW_AIM.right, target: 'reading', time: true });
    expect(judgeReviewGuess(mark, 'careless')).toMatchObject({ right: false, near: true, boost: REVIEW_AIM.near });
    expect(judgeReviewGuess(mark, 'plan')).toMatchObject({ right: false, near: false, boost: REVIEW_AIM.wrong });
  });
  it('答えのあとの一言と、前の版の理由の名前', () => {
    expect(causeExplain({ cause: 'tactic', tesuji: 'ふんどしの桂', tags: ['time'] })).toBe('手筋をくらった（秒読み）。相手の「ふんどしの桂」を読めていなかった');
    expect(causeExplain({ cause: 'policy', sub: 'rush' })).toContain('攻め急ぎ');
    expect(causeLabel('reading')).toBe('読み負け');
    expect(causeLabel('careless')).toBe('うっかり');
  });
});
