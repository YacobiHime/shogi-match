import { describe, expect, it } from 'vitest';
import { HOME_TAB_FALLBACK, dexLines, learnCards } from './home-tab-cards.mjs';
import { homeTabStats } from './home-tab-stats.mjs';
import { TUTORIAL_LESSONS } from './tutorial-curriculum.mjs';
import { TUTORIAL_PROGRESS_KEY, nextLesson } from './tutorial-progress.mjs';
import { PROBLEM_PROGRESS_KEY } from './problem-progress.mjs';
import { PROBLEMS } from './problem-set.mjs';
import { BRAIN_TRAINING_KEY, emptyBrainRecord, stampRoom } from './brain-training.mjs';
import { RESEARCH_KEY } from './research-record.mjs';

function memoryStorage(entries = {}) {
  const map = new Map(Object.entries(entries).map(([key, value]) => [key, JSON.stringify(value)]));
  return { getItem: (key) => (map.has(key) ? map.get(key) : null), setItem: (key, value) => map.set(key, String(value)), removeItem: (key) => map.delete(key) };
}

describe('ホームのまなぶ・しらべるの札(docs/home-roadmap-design.mdの8章)', () => {
  it('数がまだないときは、何ができるかを1行で言う', () => {
    const cards = learnCards(null);
    expect(cards.tutorial.line).toBe(HOME_TAB_FALLBACK.tutorial);
    expect(cards.tutorial.bar).toBeNull();
    expect(cards.brain.week).toBeNull();
    expect(dexLines(null).research).toBe(HOME_TAB_FALLBACK.research);
  });

  it('記録のない人には0を並べず、はじめのレッスンと何ができるかを出す', () => {
    const stats = homeTabStats(memoryStorage(), '2026-11-25');
    const cards = learnCards(stats);
    expect(cards.tutorial.line).toBe(`はじめは「${TUTORIAL_LESSONS[0].title}」から`);
    expect(cards.tutorial.bar).toBeNull();
    expect(cards.tutorial.chips).toEqual([]);
    expect(cards.problems.line).toBe(HOME_TAB_FALLBACK.problems);
    expect(cards.problems.bar).toBeNull();
    expect(cards.brain.week).toHaveLength(7);
    expect(cards.brain.line).toBe('今日は 計算力の部屋');
    const lines = dexLines(stats);
    expect(lines.tesuji).toBe(HOME_TAB_FALLBACK.tesuji);
    expect(lines.glossary).toMatch(/^将棋のことば \d+語$/);
    expect(stats.dex.glossary).toBeGreaterThan(50);
  });

  it('進んだ人には、つぎのレッスン・解いた数・今週の判子・研究帳の数を出す', () => {
    const main = TUTORIAL_LESSONS.filter((lesson) => !lesson.side && !lesson.comingSoon);
    const lessons = Object.fromEntries(main.slice(0, 3).map(({ id }) => [id, { status: 'cleared', stars: 3 }]));
    let brain = emptyBrainRecord();
    brain = stampRoom(brain, 'calc', '2026-11-24');
    const storage = memoryStorage({
      [TUTORIAL_PROGRESS_KEY]: { lessons },
      [PROBLEM_PROGRESS_KEY]: { solved: { [PROBLEMS[0].id]: { firstTry: true }, [PROBLEMS[1].id]: { firstTry: false } } },
      [BRAIN_TRAINING_KEY]: brain,
      [RESEARCH_KEY]: { current: '', items: [{ sfen: 'x', root: {}, path: [] }, { sfen: 'y', root: {}, path: [] }] },
    });
    const stats = homeTabStats(storage, '2026-11-25');
    const cards = learnCards(stats);
    const next = nextLesson(TUTORIAL_LESSONS, { lessons });
    expect(cards.tutorial.line).toContain(`「${next.title}」`);
    expect(cards.tutorial.line).toMatch(/^つぎは 第\d+巻\d+章/);
    expect(cards.tutorial.bar?.text).toBe(`3/${stats.tutorial.total}`);
    expect(cards.problems.line).toBe('解いた問題 2問');
    expect(cards.problems.bar?.ratio).toBeGreaterThan(0);
    expect(cards.brain.weekText).toBe('今週 1日');
    expect(cards.brain.week?.find((cell) => cell.today)?.label).toBe('水');
    expect(dexLines(stats).research).toBe('研究帳 2局');
  });
});
