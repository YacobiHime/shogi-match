import { describe, expect, it } from 'vitest';
import {
  REVIEW_QUEUE_KEY,
  createReviewQueue,
  dueReviewId,
  loadReviewQueue,
  recordReviewResult,
  saveReviewQueue,
} from './review-queue.mjs';

const DAY = 24 * 60 * 60 * 1000;

describe('復習の箱', () => {
  it('一発で解けなかった問題を、1日後・3日後・7日後と間をあけて出し、最後に箱から出す', () => {
    let queue = recordReviewResult(createReviewQueue(), 'q1', { firstTry: false, now: 0 });
    expect(queue.items.q1).toEqual({ stage: 0, dueAt: DAY });
    expect(dueReviewId(queue, { now: DAY - 1 })).toBeNull();
    expect(dueReviewId(queue, { now: DAY })).toBe('q1');
    queue = recordReviewResult(queue, 'q1', { firstTry: true, now: DAY });
    expect(queue.items.q1).toEqual({ stage: 1, dueAt: 4 * DAY });
    queue = recordReviewResult(queue, 'q1', { firstTry: true, now: 4 * DAY });
    expect(queue.items.q1).toEqual({ stage: 2, dueAt: 11 * DAY });
    queue = recordReviewResult(queue, 'q1', { firstTry: true, now: 11 * DAY });
    expect(queue.items.q1).toBeUndefined();
  });

  it('期限の前に解いても進めず、出し直しで間違えたら1日後からやり直す', () => {
    let queue = recordReviewResult(createReviewQueue(), 'q1', { firstTry: false, now: 0 });
    expect(recordReviewResult(queue, 'q1', { firstTry: true, now: DAY / 2 }).items.q1).toEqual({ stage: 0, dueAt: DAY });
    queue = recordReviewResult(queue, 'q1', { firstTry: true, now: DAY });
    queue = recordReviewResult(queue, 'q1', { firstTry: false, now: 4 * DAY });
    expect(queue.items.q1).toEqual({ stage: 0, dueAt: 5 * DAY });
    // 箱にない問題を一発で解いても、何も変わらない。
    expect(recordReviewResult(createReviewQueue(), 'q9', { firstTry: true, now: 0 })).toEqual(createReviewQueue());
  });

  it('期限の来た問題のうち、いちばん古いものを出し、知らない問題は飛ばす', () => {
    let queue = recordReviewResult(createReviewQueue(), 'old', { firstTry: false, now: 0 });
    queue = recordReviewResult(queue, 'new', { firstTry: false, now: DAY });
    queue = recordReviewResult(queue, 'gone', { firstTry: false, now: -DAY });
    expect(dueReviewId(queue, { now: 3 * DAY, knownIds: new Set(['old', 'new']) })).toBe('old');
    expect(dueReviewId(queue, { now: 3 * DAY })).toBe('gone');
  });

  it('保存して読み直せ、壊れた保存では空の箱にする', () => {
    const data = new Map();
    const storage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
    const queue = recordReviewResult(createReviewQueue(), 'q1', { firstTry: false, now: 0 });
    saveReviewQueue(storage, queue);
    expect(loadReviewQueue(storage)).toEqual(queue);
    data.set(REVIEW_QUEUE_KEY, JSON.stringify({ items: { bad: { stage: 9, dueAt: 1 }, q2: { stage: 1, dueAt: 'x' } } }));
    expect(loadReviewQueue(storage)).toEqual(createReviewQueue());
    data.set(REVIEW_QUEUE_KEY, '{broken');
    expect(loadReviewQueue(storage)).toEqual(createReviewQueue());
  });
});
