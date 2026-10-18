import { describe, expect, it } from 'vitest';
import {
  chapterPosition,
  chapterSummary,
  firstLessonOfNextChapter,
  lessonIcon,
  nextLessonInChapter,
  tutorialMap,
} from './tutorial-map.mjs';
import { TUTORIAL_LESSONS, TUTORIAL_VOLUMES } from './tutorial-curriculum.mjs';
import { emptyTutorialProgress, recordLessonCleared, recordLessonSkipped } from './tutorial-progress.mjs';

const lessons = TUTORIAL_LESSONS;
const volumes = TUTORIAL_VOLUMES;

describe('将棋教室の地図', () => {
  it('全レッスンを、巻と章の看板をはさんで学ぶ順に1本の道に並べる', () => {
    const map = tutorialMap(volumes, lessons, emptyTutorialProgress());
    const lessonRows = map.rows.filter(({ type }) => type === 'lesson');
    expect(lessonRows.map(({ id }) => id)).toEqual(lessons.map(({ id }) => id));
    expect(map.rows.filter(({ type }) => type === 'volume')).toHaveLength(volumes.length);
    expect(map.rows[0]).toMatchObject({ type: 'volume', number: 1 });
    expect(map.rows[1]).toMatchObject({ type: 'chapter', number: 1 });
    // 最初は、最初のレッスンだけが「次」で、ほかは閉じている。
    expect(map.currentId).toBe(lessons[0].id);
    expect(lessonRows[0].state).toBe('next');
    expect(lessonRows[1].state).toBe('locked');
    // 道は左右にくねる。
    expect(new Set(lessonRows.slice(0, 8).map(({ lane }) => lane)).size).toBeGreaterThan(2);
  });

  it('終えたレッスンは星を、飛ばしたレッスンは飛ばした印を付け、次のマスを1つ示す', () => {
    let progress = recordLessonCleared(emptyTutorialProgress(), lessons[0].id, 2);
    progress = recordLessonSkipped(progress, lessons[1].id);
    const map = tutorialMap(volumes, lessons, progress);
    const byId = Object.fromEntries(map.rows.filter(({ type }) => type === 'lesson').map((row) => [row.id, row]));
    expect(byId[lessons[0].id]).toMatchObject({ state: 'cleared', stars: 2 });
    expect(byId[lessons[1].id].state).toBe('skipped');
    expect(byId[lessons[2].id].state).toBe('next');
    expect(map.total.stars).toBe(2);
  });

  it('同じ章の中は続けて進め、章の終わりで次の章の最初を返す', () => {
    const chapter = lessons.filter(({ chapterId }) => chapterId === lessons[0].chapterId);
    expect(nextLessonInChapter(lessons, chapter[0].id)?.id).toBe(chapter[1].id);
    expect(nextLessonInChapter(lessons, chapter.at(-1).id)).toBeNull();
    const nextChapterFirst = firstLessonOfNextChapter(lessons, chapter.at(-1).id);
    expect(nextChapterFirst.chapterId).not.toBe(chapter[0].chapterId);
    expect(firstLessonOfNextChapter(lessons, lessons.at(-1).id)).toBeNull();
    expect(chapterPosition(lessons, chapter[1].id)).toMatchObject({ index: 1, count: chapter.length });
  });

  it('章のまとめに、レッスンごとの星と、できるようになったことを並べる', () => {
    let progress = emptyTutorialProgress();
    const chapter = lessons.filter(({ chapterId }) => chapterId === lessons[0].chapterId);
    for (const lesson of chapter) progress = recordLessonCleared(progress, lesson.id, 3);
    const summary = chapterSummary(volumes, lessons, progress, chapter[0].chapterId);
    expect(summary).toMatchObject({ number: 1, volumeNumber: 1, stars: chapter.length * 3, maxStars: chapter.length * 3 });
    expect(summary.lessons.map(({ summary: text }) => text).every(Boolean)).toBe(true);
    expect(chapterSummary(volumes, lessons, progress, 'none')).toBeNull();
  });

  it('マスの文字は、いちばん大事な課題の種類で決める', () => {
    expect(lessonIcon({ steps: [{ type: 'explain' }, { type: 'play' }] })).toBe('局');
    expect(lessonIcon({ steps: [{ type: 'explain' }, { type: 'mate' }, { type: 'choose' }] })).toBe('詰');
    expect(lessonIcon({ steps: [{ type: 'choose' }] })).toBe('問');
    expect(lessonIcon({ steps: [] })).toBe('話');
    // 駒のレッスンは、その駒の1文字。
    expect(lessonIcon(lessons.find(({ id }) => id === 'v1-pawn'))).toBe('歩');
    expect(lessonIcon(lessons.find(({ id }) => id === 'v1-rook'))).toBe('飛');
  });
});

describe('腕だめしのメダルと巻の称号', () => {
  it('腕だめしの★で、章のメダルが金・銀・銅になる。スキップはメダルなし', async () => {
    const { chapterMedal } = await import('./tutorial-map.mjs');
    const boss = lessons.find(({ boss: isBoss }) => isBoss);
    expect(chapterMedal(lessons, emptyTutorialProgress(), boss.chapterId)).toBeNull();
    expect(chapterMedal(lessons, recordLessonCleared(emptyTutorialProgress(), boss.id, 3), boss.chapterId)).toMatchObject({ tier: 'gold', label: '金メダル' });
    expect(chapterMedal(lessons, recordLessonCleared(emptyTutorialProgress(), boss.id, 2), boss.chapterId).tier).toBe('silver');
    expect(chapterMedal(lessons, recordLessonCleared(emptyTutorialProgress(), boss.id, 1), boss.chapterId).tier).toBe('bronze');
    expect(chapterMedal(lessons, recordLessonSkipped(emptyTutorialProgress(), boss.id), boss.chapterId)).toBeNull();
    // 腕だめしは、地図の道のまん中に、腕だめしの印で置く。
    const row = tutorialMap(volumes, lessons, emptyTutorialProgress()).rows.find(({ id }) => id === boss.id);
    expect(row).toMatchObject({ boss: true, lane: 2, icon: '試' });
  });

  it('巻のレッスンを全部終え、腕だめしをクリアしたら、巻の称号を渡す', async () => {
    const { volumeTitle, earnedVolumeTitles } = await import('./tutorial-map.mjs');
    const volume1 = lessons.filter(({ volumeId }) => volumeId === 'v1');
    let progress = emptyTutorialProgress();
    for (const lesson of volume1) progress = lesson.boss ? recordLessonSkipped(progress, lesson.id) : recordLessonCleared(progress, lesson.id, 1);
    // 腕だめしをスキップしただけでは渡さない。
    expect(volumeTitle(volumes, lessons, progress, 'v1')).toBeNull();
    for (const lesson of volume1.filter(({ boss }) => boss)) progress = recordLessonCleared(progress, lesson.id, 1);
    expect(volumeTitle(volumes, lessons, progress, 'v1')).toMatchObject({ id: 'tutorial-v1', label: '将棋教室 第1巻 修了', rank: 1 });
    expect(earnedVolumeTitles(volumes, lessons, progress).map(({ id }) => id)).toEqual(['tutorial-v1']);
    // 最後の巻は「卒業」。
    let all = emptyTutorialProgress();
    for (const lesson of lessons) all = recordLessonCleared(all, lesson.id, 3);
    expect(earnedVolumeTitles(volumes, lessons, all).at(-1)).toMatchObject({ id: 'tutorial-v5', label: '将棋教室 卒業', rank: 5 });
  });
});
