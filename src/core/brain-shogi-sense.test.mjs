import { describe, expect, it } from 'vitest';
import { SKILL_TEST_BANK } from './skill-test-bank.mjs';
import { TSUME_PROBLEMS } from '../data/tsume-problems.mjs';
import { tesujiShape } from './tesuji-shape.mjs';
import {
  BLIND_LEVELS,
  INTUITION_LEVELS,
  afterMove,
  blindLevelText,
  blindMatePool,
  blindMateProblem,
  einstellungPool,
  givesMate,
  intuitionLevelText,
  intuitionPool,
  judgeEinstellung,
  pickIntuition,
  scoreChoice,
} from './brain-shogi-sense.mjs';

// docs/brain-training-design.mdの12章。将棋の棚の3種目の問題の作り方。
describe('直観の一手', () => {
  const pool = intuitionPool(SKILL_TEST_BANK);

  it('手筋と判断の問題から、行き先の違う3択を作り、正解はいつも選択肢の中にある', () => {
    expect(pool.length).toBeGreaterThan(100);
    for (const problem of pool) {
      expect(problem.choices, problem.id).toHaveLength(3);
      expect(new Set(problem.choices.map((usi) => usi.slice(2, 4))).size, problem.id).toBe(3);
      expect(problem.choices, problem.id).toContain(problem.best);
      expect(problem.accepted.length, problem.id).toBeGreaterThan(0);
      for (const usi of problem.choices) expect(afterMove(problem.sfen, usi), `${problem.id} ${usi}`).not.toBeNull();
    }
    // 正解がいつも同じ位置にならない。
    const places = new Set(pool.filter(({ id }) => id.includes('tactic')).map((problem) => problem.choices.indexOf(problem.best)));
    expect(places.size).toBe(3);
  });

  it('段が上がると時間が短く、出す問題の難しさの上限が上がる', () => {
    for (let level = 1; level < INTUITION_LEVELS.length; level += 1) {
      expect(INTUITION_LEVELS[level].seconds).toBeLessThan(INTUITION_LEVELS[level - 1].seconds);
      expect(INTUITION_LEVELS[level].maxB).toBeGreaterThan(INTUITION_LEVELS[level - 1].maxB);
    }
    const easy = pickIntuition(pool, 0, 3);
    expect(easy.b).toBeLessThanOrEqual(INTUITION_LEVELS[0].maxB);
    // まだ出していない問題から選ぶ。
    const used = new Set([easy.id]);
    expect(pickIntuition(pool, 0, 3, used).id).not.toBe(easy.id);
    expect(intuitionLevelText(1)).toBe('7秒で選べた');
  });

  it('正解の手だけを正解にし、時間切れはまちがえ', () => {
    const problem = pool[0];
    expect(scoreChoice(problem, problem.best).correct).toBe(true);
    expect(scoreChoice(problem, problem.choices.find((usi) => !problem.accepted.includes(usi))).correct).toBe(false);
    expect(scoreChoice(problem, null).correct).toBe(false);
  });
});

describe('思い込み外し', () => {
  const pool = einstellungPool(SKILL_TEST_BANK);

  it('正解でない「得する駒取り」か「王手」がある手筋の問題だけを使う', () => {
    expect(pool.length).toBeGreaterThanOrEqual(30);
    for (const problem of pool) {
      expect(tesujiShape(problem.tesuji), problem.id).toBeTruthy();
      expect(problem.accepted, problem.id).not.toContain(problem.tempting);
      expect(['capture', 'check'], problem.id).toContain(problem.temptingKind);
      expect(afterMove(problem.sfen, problem.tempting), problem.id).not.toBeNull();
    }
    expect(pool.some(({ temptingKind }) => temptingKind === 'capture')).toBe(true);
  });

  it('正解・目に付く手(数えずにもう一度)・ほかの手を分ける', () => {
    const problem = pool[0];
    expect(judgeEinstellung(problem, problem.best)).toBe('correct');
    expect(judgeEinstellung(problem, problem.tempting)).toBe('tempting');
    expect(judgeEinstellung(problem, '9i9h')).toBe('wrong');
  });
});

describe('目隠しの詰将棋', () => {
  const pool = blindMatePool(TSUME_PROBLEMS);

  it('どの段でも、最後の手の前の局面で、正解だけが詰む3択を作る', () => {
    for (let level = 0; level < BLIND_LEVELS.length; level += 1) {
      for (let seed = 0; seed < 8; seed += 1) {
        const problem = blindMateProblem(pool, level, seed);
        expect(problem, `${level} ${seed}`).not.toBeNull();
        expect(problem.shown).toHaveLength(BLIND_LEVELS[level].plies - 1);
        expect(problem.hide).toBe(BLIND_LEVELS[level].hide);
        expect(problem.choices).toHaveLength(3);
        expect(problem.choices).toContain(problem.answer);
        for (const usi of problem.choices) expect(givesMate(problem.lastSfen, usi), `${problem.id} ${usi}`).toBe(usi === problem.answer);
        expect(new Set(problem.choices.map((usi) => usi.slice(2, 4))).size).toBe(3);
      }
    }
    expect(blindLevelText(1)).toBe('3手詰め');
    expect(blindLevelText(4)).toBe('5手詰め（手順を隠して）');
  });

  it('出した問題は、ほかに問題があれば選ばない', () => {
    const first = blindMateProblem(pool, 0, 1);
    const second = blindMateProblem(pool, 0, 1, new Set([first.id]));
    expect(second.id).not.toBe(first.id);
  });
});
