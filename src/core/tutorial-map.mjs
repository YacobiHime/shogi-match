/**
 * 将棋教室の地図(すごろくの道)。巻 → 章 → レッスンの階層を降りて選ばせるかわりに、
 * 全レッスンを学ぶ順に1本の道に並べる(『スーパーマリオワールド』の地図、Duolingoの道にならう)。
 * いま進めるマスを1つだけ大きく見せ、押せばすぐ始める。
 *
 * レッスンは短いので、同じ章のあいだは結果の画面を挟まずに続けて進め、章の終わりにまとめてほめる。
 * 画面に依存しない。
 */
import { isLessonUnlocked, lessonRecord, lessonsProgress, nextLesson } from './tutorial-progress.mjs';

/** 道を左右にくねらせる位置(0〜4)。章ごとに、まん中から始める。 */
const LANES = Object.freeze([2, 3, 4, 3, 2, 1, 0, 1]);

/**
 * レッスンのマスに描く1文字。いちばん大事な課題の種類で決める。
 * レッスンにiconがあればそれを使う(駒のレッスンは、その駒の1文字)。
 * なければ、対局 → 観戦 → 詰み → 指す → 駒を動かす → クイズ → 説明。
 */
export function lessonIcon(lesson) {
  if (typeof lesson?.icon === 'string' && lesson.icon) return lesson.icon;
  const types = new Set((lesson?.steps ?? []).map(({ type }) => type));
  if (types.has('play')) return '局';
  if (types.has('replay')) return '観';
  if (types.has('mate')) return '詰';
  if (types.has('find-move')) return '指';
  if (types.has('move-piece')) return '駒';
  if (types.has('choose')) return '問';
  return '話';
}

/** レッスンのマスの状態。 */
function lessonState(lessons, progress, lesson, current) {
  if (lesson.comingSoon) return 'soon';
  const record = lessonRecord(progress, lesson.id);
  if (record.status === 'cleared') return 'cleared';
  if (record.status === 'skipped') return 'skipped';
  if (current?.id === lesson.id) return 'next';
  return isLessonUnlocked(lessons, progress, lesson.id) ? 'open' : 'locked';
}

/**
 * 地図に並べる行。巻の看板、章の看板、レッスンのマスを、学ぶ順に並べる。
 * @param {any[]} volumes TUTORIAL_VOLUMES
 * @param {any[]} lessons TUTORIAL_LESSONS(巻・章のIDつき)
 * @param {{ lessons: Record<string, { status: string, stars: number }> }} progress
 */
export function tutorialMap(volumes, lessons, progress) {
  const current = nextLesson(lessons, progress);
  const rows = [];
  volumes.forEach((volume, volumeIndex) => {
    const volumeLessons = lessons.filter((lesson) => lesson.volumeId === volume.id);
    rows.push({
      type: 'volume', id: volume.id, number: volumeIndex + 1, title: volume.title, description: volume.description,
      summary: lessonsProgress(volumeLessons, progress),
    });
    volume.chapters.forEach((chapter, chapterIndex) => {
      const chapterLessons = lessons.filter((lesson) => lesson.chapterId === chapter.id);
      const pending = chapterLessons.filter((lesson) => !lesson.comingSoon && lessonRecord(progress, lesson.id).status === 'new');
      rows.push({
        type: 'chapter', id: chapter.id, number: chapterIndex + 1, title: chapter.title,
        summary: lessonsProgress(chapterLessons, progress),
        // まだ終えていないレッスンがあり、その最初が遊べるときだけ、章ごと飛ばせる。
        skippable: pending.length > 0 && isLessonUnlocked(lessons, progress, pending[0].id),
      });
      chapterLessons.forEach((lesson, lessonIndex) => {
        rows.push({
          type: 'lesson', id: lesson.id, title: lesson.title, summary: lesson.summary ?? '',
          icon: lessonIcon(lesson), lane: LANES[lessonIndex % LANES.length],
          state: lessonState(lessons, progress, lesson, current),
          stars: lessonRecord(progress, lesson.id).stars,
        });
      });
    });
  });
  return { rows, currentId: current?.id ?? null, total: lessonsProgress(lessons, progress) };
}

/** 同じ章の、次に遊べるレッスン(準備中は飛ばす)。章の最後ならnull。 */
export function nextLessonInChapter(lessons, lessonId) {
  const index = lessons.findIndex(({ id }) => id === lessonId);
  if (index < 0) return null;
  const chapterId = lessons[index].chapterId;
  return lessons.slice(index + 1).find((lesson) => lesson.chapterId === chapterId && !lesson.comingSoon) ?? null;
}

/** 次の章の最初に遊べるレッスン。最後の章ならnull。 */
export function firstLessonOfNextChapter(lessons, lessonId) {
  const index = lessons.findIndex(({ id }) => id === lessonId);
  if (index < 0) return null;
  const chapterId = lessons[index].chapterId;
  return lessons.slice(index + 1).find((lesson) => lesson.chapterId !== chapterId && !lesson.comingSoon) ?? null;
}

/**
 * 章のまとめ。章クリアの画面に出す。
 * @returns {{ id: string, title: string, number: number, volumeNumber: number, lessons: { id: string, title: string, summary: string, stars: number, status: string }[], stars: number, maxStars: number }}
 */
export function chapterSummary(volumes, lessons, progress, chapterId) {
  for (const [volumeIndex, volume] of volumes.entries()) {
    const chapterIndex = volume.chapters.findIndex(({ id }) => id === chapterId);
    if (chapterIndex < 0) continue;
    const chapterLessons = lessons.filter((lesson) => lesson.chapterId === chapterId && !lesson.comingSoon);
    const entries = chapterLessons.map((lesson) => ({
      id: lesson.id, title: lesson.title, summary: lesson.summary ?? '', ...lessonRecord(progress, lesson.id),
    }));
    return {
      id: chapterId,
      title: volume.chapters[chapterIndex].title,
      number: chapterIndex + 1,
      volumeNumber: volumeIndex + 1,
      lessons: entries,
      stars: entries.reduce((sum, { stars }) => sum + stars, 0),
      maxStars: entries.length * 3,
    };
  }
  return null;
}

/**
 * 章の中での、いまのレッスンの位置(見出しの進み具合に使う)。
 * @returns {{ index: number, count: number, ids: string[] }}
 */
export function chapterPosition(lessons, lessonId) {
  const lesson = lessons.find(({ id }) => id === lessonId);
  if (!lesson) return { index: 0, count: 0, ids: [] };
  const ids = lessons.filter((entry) => entry.chapterId === lesson.chapterId && !entry.comingSoon).map(({ id }) => id);
  return { index: ids.indexOf(lessonId), count: ids.length, ids };
}
