import { describe, expect, it } from 'vitest';
import {
  FIT_BONUS, HAND_SIZE, LESSON_CARDS, LESSON_ROUNDS, MAX_SKILLS, STARTER_DECK, autoPick, cardById, lessonDeck, lessonHands, newSkills, scoreLesson,
  skillNeed, skillProgress, SKILL_RULES,
} from './disciple-lesson.mjs';
import { createDiscipleRun, chooseAction, turnKind } from './disciple-run.mjs';
import { skillById, skillEffects } from './disciple-strength.mjs';

describe('指導の引き出し(25-1)', () => {
  const state = () => createDiscipleRun({ seed: 3, discipleId: 'minato' });

  it('手札は3回ぶん3枚ずつで、同じ状態なら同じ', () => {
    const hands = lessonHands(state(), 'tsume');
    expect(hands).toHaveLength(LESSON_ROUNDS);
    for (const hand of hands) {
      expect(hand).toHaveLength(HAND_SIZE);
      expect(new Set(hand).size).toBe(HAND_SIZE);
      for (const id of hand) expect(STARTER_DECK).toContain(id);
    }
    expect(lessonHands(state(), 'tsume')).toEqual(hands);
    expect(lessonDeck({ deck: ['dojo', 'nothing'] })).toContain('dojo');
  });

  it('合う弟子にはよく効き、出来で伸びの倍率が決まる', () => {
    const s = state();
    // 湊にはVSとほめるが合う。
    const good = scoreLesson(s, ['vs', 'praise', 'vs']);
    expect(good.points).toBe((34 + FIT_BONUS) * 2 + 18 + FIT_BONUS);
    expect(good.grade.id).toBe('perfect');
    expect(good.mood).toBe(1);
    const strict = scoreLesson(s, ['strict']);
    expect(strict.mood).toBe(-1);
    expect(scoreLesson(s, ['tea', 'think']).points).toBe(6 + 22 + 8);
    expect(scoreLesson(s, ['early']).grade.id).toBe('poor');
  });

  it('おまかせは合うカードを選び、疲れていれば休ませる', () => {
    const s = state();
    expect(autoPick(s, ['strict', 'vs', 'tea'])).toBe('vs');
    expect(autoPick({ ...s, stamina: 20 }, ['strict', 'vs', 'tea'])).toBe('tea');
    for (const card of LESSON_CARDS) expect(cardById(card.id)).toBe(card);
  });

  it('稽古でカードを使うと、出来の倍率で伸びが増える', () => {
    const s = { ...state(), stamina: 100 };
    const hands = lessonHands(s, 'jissen');
    const picks = hands.map((hand, index) => autoPick(s, hand, hands.slice(0, index).map((h) => h[0])));
    const plain = chooseAction(s, { kind: 'train', id: 'jissen' });
    const lesson = chooseAction(s, { kind: 'train', id: 'jissen', cards: picks });
    if (!plain.result.failed && !lesson.result.failed) {
      expect(lesson.result.lesson).toBeTruthy();
      expect(lesson.result.gains.reading).toBeGreaterThanOrEqual(Math.round(plain.result.gains.reading * lesson.result.lesson.grade.scale) - 1);
    }
  });
});

describe('研究会・師匠の予定(25-2)', () => {
  it('研究会は読みと安定が伸び、師匠の予定は暦で行き先が決まる', () => {
    const s = createDiscipleRun({ seed: 4, discipleId: 'tsumugi' });
    const study = chooseAction(s, { kind: 'study' });
    expect(study.result.kind).toBe('study');
    expect(study.state.stats.reading).toBeGreaterThan(s.stats.reading);
    expect(study.state.stamina).toBeLessThan(s.stamina);
    const master = chooseAction(s, { kind: 'master' });
    expect(['kengaku', 'kaisetsu', 'matsuri']).toContain(master.result.event);
  });

  it('出かけた回数で引き出しにカードが増える', () => {
    let s = createDiscipleRun({ seed: 5, discipleId: 'ao' });
    let added = [];
    for (let i = 0; i < 3; i += 1) {
      const out = chooseAction(s, { kind: 'outing' });
      s = out.state;
      added = added.concat(out.result.newCards);
    }
    expect(added).toContain('dojo');
    expect(lessonDeck(s)).toContain('dojo');
  });
});

describe('スキルを覚える条件(25-3)', () => {
  it('効き目のあるスキルだけを覚え、戦い方とかみ合うと条件が7割', () => {
    for (const rule of SKILL_RULES) expect(skillById(rule.id)).toBeTruthy();
    const researcher = SKILL_RULES.find((rule) => rule.id === 'researcher');
    expect(skillNeed(researcher, 'study')).toBe(7);
    expect(skillNeed(researcher, 'counter')).toBe(10);
    expect(newSkills({ skills: [], style: 'study', trainCounts: { kifu: 7 }, stats: {} })).toContain('researcher');
    expect(newSkills({ skills: [], style: 'counter', trainCounts: { kifu: 7 }, stats: {} })).not.toContain('researcher');
    expect(newSkills({ skills: Array.from({ length: MAX_SKILLS }, (_, i) => `s${i}`), style: 'study', trainCounts: { kifu: 20 }, stats: {} })).toEqual([]);
    const progress = skillProgress({ skills: ['researcher'], style: 'lead', trainCounts: { tsume: 4 }, stats: {} });
    expect(progress.find((row) => row.id === 'researcher').have).toBe(true);
    expect(progress.find((row) => row.id === 'endgame-demon').now).toBe(4);
  });

  it('足したスキルの効き目(研究家は序盤、千里眼は見落とし、早見えは候補の数)', () => {
    expect(skillEffects(['researcher'], { phase: 'opening' }).levelPlus).toBeGreaterThan(0);
    expect(skillEffects(['researcher'], { phase: 'middle' }).levelPlus).toBe(0);
    expect(skillEffects(['clairvoyance']).missScale).toBe(0.5);
    expect(skillEffects(['quick-sight']).candidatesMin).toBe(8);
  });

  it('棋譜並べの10回目で研究家を覚え、稽古の結果で知らせる', () => {
    const base = createDiscipleRun({ seed: 6, discipleId: 'tsumugi' });
    expect(turnKind(base)).toBe('free');
    const s = { ...base, style: 'lead', skills: [], stamina: 100, trainCounts: { kifu: 9 } };
    const out = chooseAction(s, { kind: 'train', id: 'kifu' });
    expect(out.result.failed).toBe(false);
    expect(out.result.newSkills).toContain('researcher');
    expect(out.state.skills).toContain('researcher');
  });
});
