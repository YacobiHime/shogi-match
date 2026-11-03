import { describe, expect, test } from 'vitest';
import {
  BOX_MAX,
  RESHELF_STAGE,
  REVIEW_DAYS,
  SHELF_STAGE,
  addBlocker,
  addBox,
  addDays,
  applyReview,
  checkShelfEntry,
  cleanBoxItems,
  cleanBoxes,
  cleanShelf,
  daysBetween,
  dueBoxes,
  dueText,
  editBoxWords,
  freeStart,
  intervalText,
  nextBoxDay,
  removeBox,
  repackBoxes,
  restoreBox,
  returnShelfToBox,
  reviewOutcome,
  sinceText,
} from './memory-box.mjs';

const words = (count, prefix = 'w') => Array.from({ length: count }, (_, index) => `${prefix}${index + 1}`);
const input = (count, extra = {}) => ({ set: 'custom', title: 'テスト', emoji: '📦', items: words(count), ...extra });

describe('日付', () => {
  test('日数を足す・数える(月と年をまたぐ)', () => {
    expect(addDays('2026-11-02', 1)).toBe('2026-11-03');
    expect(addDays('2026-11-25', 30)).toBe('2026-12-25');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(daysBetween('2026-11-02', '2026-11-09')).toBe(7);
  });
});

describe('箱に入れる(docs/brain-training-design.mdの14-9)', () => {
  test('入れた日はテストしない。最初の思い出しは次の日', () => {
    const { boxes, box, blocker } = addBox([], input(10), 30, '2026-11-02');
    expect(blocker).toBe('');
    expect(boxes).toHaveLength(1);
    expect(box).toMatchObject({ stage: 0, start: 0, added: '2026-11-02', next: '2026-11-03', last: '' });
    expect(dueBoxes(boxes, '2026-11-02')).toEqual([]);
    expect(dueBoxes(boxes, '2026-11-03').map(({ id }) => id)).toEqual([box.id]);
  });

  test('空いた場所に続けて置き、3つまで', () => {
    let boxes = [];
    for (const [count, start] of [[10, 0], [7, 10], [8, 17]]) {
      const result = addBox(boxes, input(count), 30, '2026-11-02');
      expect(result.box?.start).toBe(start);
      boxes = result.boxes;
    }
    expect(boxes).toHaveLength(BOX_MAX);
    expect(addBox(boxes, input(3), 30, '2026-11-02').blocker).toBe('max');
    // 同じ日に同じ組を入れても、idは重ならない
    expect(new Set(boxes.map(({ id }) => id)).size).toBe(3);
  });

  test('場所が足りなければ入れない。外した組の場所は空く', () => {
    const first = addBox([], input(12), 20, '2026-11-02');
    expect(addBlocker(first.boxes, 20, 12)).toBe('room');
    expect(addBox(first.boxes, input(12), 20, '2026-11-02').blocker).toBe('room');
    expect(addBox(first.boxes, input(8), 20, '2026-11-02').box?.start).toBe(12);
    const { boxes } = removeBox(first.boxes, first.box.id);
    expect(freeStart(boxes, 20, 12)).toBe(0);
  });

  test('外した組は取り消しで戻る(場所が重なれば戻さない)', () => {
    const a = addBox([], input(5), 30, '2026-11-02');
    const b = addBox(a.boxes, input(5, { set: 'herbs' }), 30, '2026-11-02');
    const { boxes, removed, index } = removeBox(b.boxes, a.box.id);
    expect(restoreBox(boxes, removed, index).map(({ id }) => id)).toEqual(b.boxes.map(({ id }) => id));
    const taken = addBox(boxes, input(5, { set: 'zodiac' }), 30, '2026-11-02').boxes;
    expect(restoreBox(taken, removed, index)).toBe(taken);
  });

  test('組の数は3〜12。同じ言葉は1つにし、手がかりは「{場}」を含むものだけ残す', () => {
    expect(cleanBoxItems(['a', 'b'])).toBeNull();
    expect(cleanBoxItems(['a', 'a', 'b', 'c'])?.map(({ word }) => word)).toEqual(['a', 'b', 'c']);
    expect(cleanBoxItems(words(20))).toHaveLength(12);
    const [item] = cleanBoxItems([{ word: 'x', cue: '場所なし', ask: '1月は？' }, 'y', 'z']);
    expect(item).toEqual({ word: 'x', ask: '1月は？' });
    expect(addBox([], input(2), 30, '2026-11-02').blocker).toBe('items');
  });
});

describe('思い出す', () => {
  const start = addBox([], input(10), 30, '2026-11-02');

  test('段の表どおりの日に次が来る(1日・3日・1週間・2週間・1か月)', () => {
    let boxes = start.boxes;
    let day = '2026-11-03';
    const nexts = [];
    for (let stage = 0; stage < SHELF_STAGE - 1; stage += 1) {
      const result = applyReview(boxes, [], start.box.id, Array(10).fill(true), day);
      boxes = result.boxes;
      nexts.push(daysBetween(day, result.outcome.next));
      day = result.outcome.next;
    }
    expect(nexts).toEqual(REVIEW_DAYS.slice(1));
    expect(boxes[0].stage).toBe(4);
  });

  test('8割で上がり、届かなければ1段戻る(0より下にならない)', () => {
    const box = { ...start.box, stage: 2 };
    expect(reviewOutcome(box, [...Array(8).fill(true), false, false], '2026-11-10')).toMatchObject({ passed: true, correct: 8, stage: 3 });
    const failed = reviewOutcome(box, [...Array(7).fill(true), false, false, false], '2026-11-10');
    expect(failed).toMatchObject({ passed: false, correct: 7, stage: 1, next: '2026-11-13' });
    expect(failed.missed.filter(Boolean)).toHaveLength(3);
    expect(reviewOutcome({ ...box, stage: 0 }, Array(10).fill(false), '2026-11-10')).toMatchObject({ stage: 0, next: '2026-11-11' });
  });

  test('遅れて思い出しても、その日から数える', () => {
    const late = applyReview(start.boxes, [], start.box.id, Array(10).fill(true), '2026-11-08');
    expect(late.outcome.next).toBe(addDays('2026-11-08', REVIEW_DAYS[1]));
    expect(late.boxes[0].last).toBe('2026-11-08');
  });

  test('1か月あとも思い出せたら宝物の棚へ。箱の場所は空く', () => {
    const boxes = [{ ...start.box, stage: SHELF_STAGE - 1 }];
    const result = applyReview(boxes, [], start.box.id, Array(10).fill(true), '2026-12-20');
    expect(result.outcome).toMatchObject({ shelved: true, next: '' });
    expect(result.boxes).toEqual([]);
    expect(result.shelf).toEqual([{ set: 'custom', title: 'テスト', emoji: '📦', count: 10, day: '2026-12-20', items: start.box.items, start: 0, pics: start.box.pics }]);
  });

  test('次の日と言い方', () => {
    const later = addBox(start.boxes, input(5, { set: 'b' }), 30, '2026-11-05');
    expect(nextBoxDay(later.boxes, '2026-11-02')).toBe('2026-11-03');
    expect(nextBoxDay(later.boxes, '2026-11-03')).toBe('2026-11-06');
    expect(dueText(start.box, '2026-11-02')).toBe('あと1日');
    expect(dueText(start.box, '2026-11-05')).toBe('今日');
    expect(sinceText(start.box, '2026-11-03')).toBe('1日ぶり');
    expect(sinceText({ ...start.box, last: '2026-11-03' }, '2026-11-10')).toBe('1週間ぶり');
    expect(REVIEW_DAYS.map(intervalText)).toEqual(['1日', '3日', '1週間', '2週間', '1か月']);
  });
});

describe('保存を整える', () => {
  test('壊れた組・重なる組・4つ目は捨てる', () => {
    const a = addBox([], input(10), 30, '2026-11-02').box;
    const overlap = { ...a, id: 'other' };
    const broken = { ...a, id: 'broken', stage: 9 };
    const b = { ...a, id: 'b', start: 10 };
    const c = { ...a, id: 'c', start: 20 };
    const d = { ...a, id: 'd', start: 30 };
    expect(cleanBoxes([a, overlap, broken, 'x', b, c, d]).map(({ id }) => id)).toEqual([a.id, 'b', 'c']);
    expect(cleanBoxes('x')).toEqual([]);
    expect(cleanShelf([{ title: '惑星', count: 8, day: '2026-12-01' }, { title: '', count: 1, day: '2026-12-01' }, 3])).toEqual([
      { set: 'custom', title: '惑星', emoji: '📦', count: 8, day: '2026-12-01' },
    ]);
  });
});

describe('棚の組をもう一度めくる・言葉を直す・詰め直す(docs/brain-training-design.mdの14-16)', () => {
  const { boxes } = addBox([], input(10), 30, '2026-11-02');
  const shelved = applyReview([{ ...boxes[0], stage: SHELF_STAGE - 1, pics: [2, 0, 0, 0, 0, 0, 0, 0, 0, 0] }], [], boxes[0].id, Array(10).fill(true), '2026-12-20');

  test('棚に入るとき、言葉・置いた場所・選んだ絵を残す。前の版の棚(言葉なし)も読める', () => {
    const [entry] = shelved.shelf;
    expect(entry.items.map(({ word }) => word)).toEqual(words(10));
    expect(entry).toMatchObject({ start: 0, pics: [2, 0, 0, 0, 0, 0, 0, 0, 0, 0] });
    expect(cleanShelf(shelved.shelf)[0].items).toHaveLength(10);
    expect(cleanShelf([{ title: '惑星', count: 8, day: '2026-12-01' }])[0].items).toBeUndefined();
  });

  test('確かめは段を動かさず、思い出せた数と日を残す。8割に届かなければ箱にもどすのを勧める', () => {
    const ok = checkShelfEntry(shelved.shelf, 0, Array(10).fill(true), '2027-03-01');
    expect(ok.check).toEqual({ correct: 10, total: 10, passed: true });
    expect(ok.shelf[0]).toMatchObject({ checked: '2027-03-01', score: 10 });
    expect(checkShelfEntry(shelved.shelf, 0, [...Array(7).fill(true), false, false, false], '2027-03-01').check.passed).toBe(false);
    expect(checkShelfEntry(cleanShelf([{ title: '惑星', count: 8, day: '2026-12-01' }]), 0, [true], '2027-03-01').check).toBeNull();
  });

  test('箱にもどすと、空いた場所に置き直して3日あとから思い出し直す', () => {
    const other = addBox([], input(8, { set: 'b' }), 20, '2027-03-01').boxes;
    const back = returnShelfToBox(other, shelved.shelf, 0, 20, '2027-03-01');
    expect(back.blocker).toBe('');
    expect(back.box).toMatchObject({ start: 8, stage: RESHELF_STAGE, next: addDays('2027-03-01', REVIEW_DAYS[RESHELF_STAGE]), pics: [2, 0, 0, 0, 0, 0, 0, 0, 0, 0] });
    expect(back.shelf).toEqual([]);
    expect(returnShelfToBox(other, shelved.shelf, 0, 12, '2027-03-01').blocker).toBe('room');
    // 前の場所(0〜9)が空いていれば、そこへ戻す
    expect(returnShelfToBox([], shelved.shelf, 0, 20, '2027-03-01').box.start).toBe(0);
  });

  test('言葉を直す。数は変えず、変えた所は絵の手がかりを外す。空・重なりは直さない', () => {
    const withCue = [{ ...boxes[0], items: boxes[0].items.map((item, index) => (index === 0 ? { ...item, cue: '{場}で何か', ask: '1月は？' } : item)) }];
    const next = words(10).map((word, index) => (index === 0 ? 'りんご' : word));
    const edited = editBoxWords(withCue, boxes[0].id, next, '果物');
    expect(edited.error).toBe('');
    expect(edited.boxes[0].items[0]).toEqual({ word: 'りんご', ask: '1月は？' });
    expect(edited.boxes[0].title).toBe('果物');
    expect(editBoxWords(withCue, boxes[0].id, words(10), '').boxes[0].items[0].cue).toBe('{場}で何か');
    expect(editBoxWords(withCue, boxes[0].id, ['', ...words(9)], '').error).toBe('empty');
    expect(editBoxWords(withCue, boxes[0].id, ['w2', ...words(10).slice(1)], '').error).toBe('duplicate');
  });

  test('別の宮殿に詰め直す。日と段はそのまま、置けなければnull', () => {
    const two = addBox(addBox([], input(10), 30, '2026-11-02').boxes, input(7, { set: 'b' }), 30, '2026-11-02').boxes;
    const moved = removeBox(two, two[0].id).boxes;
    expect(repackBoxes(moved, 12)?.map(({ start, next }) => [start, next])).toEqual([[0, '2026-11-03']]);
    expect(repackBoxes(two, 12)).toBeNull();
  });
});
