/**
 * やこび姫の将棋教室の進捗。レッスンごとに「クリア（★1〜3）」か「スキップ」を記録する。
 * 対局の保存とは別の鍵に置き、「対局準備へ戻る」では消さない。
 */

export const TUTORIAL_PROGRESS_KEY = "yacobihime:shogi-match:tutorial:v1";

export function emptyTutorialProgress() {
  return { lessons: {} };
}

export function loadTutorialProgress(storage) {
  try {
    const raw = storage?.getItem(TUTORIAL_PROGRESS_KEY);
    if (!raw) return emptyTutorialProgress();
    const parsed = JSON.parse(raw);
    const lessons = {};
    for (const [id, entry] of Object.entries(parsed?.lessons ?? {})) {
      if (entry?.status === "cleared" && [1, 2, 3].includes(entry.stars)) {
        lessons[id] = { status: "cleared", stars: entry.stars };
      } else if (entry?.status === "skipped") {
        lessons[id] = { status: "skipped", stars: 0 };
      }
    }
    return { lessons };
  } catch {
    return emptyTutorialProgress();
  }
}

export function saveTutorialProgress(storage, progress) {
  try {
    storage?.setItem(TUTORIAL_PROGRESS_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

/** クリアを記録する。やり直して★が減っても、最高記録を残す。 */
export function recordLessonCleared(progress, lessonId, stars) {
  const previous = progress.lessons[lessonId];
  const best = previous?.status === "cleared" ? Math.max(previous.stars, stars) : stars;
  return { ...progress, lessons: { ...progress.lessons, [lessonId]: { status: "cleared", stars: best } } };
}

/** スキップを記録する。すでにクリアしたレッスンの記録は残す。 */
export function recordLessonSkipped(progress, lessonId) {
  if (progress.lessons[lessonId]?.status === "cleared") return progress;
  return { ...progress, lessons: { ...progress.lessons, [lessonId]: { status: "skipped", stars: 0 } } };
}

export function lessonRecord(progress, lessonId) {
  return progress.lessons[lessonId] ?? { status: "new", stars: 0 };
}

/** 次のレッスンへ進めるか。準備中のレッスンは通過済みとして扱う。 */
function passed(lesson, progress) {
  if (lesson.comingSoon) return true;
  const { status } = lessonRecord(progress, lesson.id);
  return status === "cleared" || status === "skipped";
}

/** 教室全体を通した順番で、前のレッスンを終えていれば解放する。 */
export function isLessonUnlocked(lessons, progress, lessonId) {
  const index = lessons.findIndex(({ id }) => id === lessonId);
  if (index <= 0) return index === 0;
  return lessons.slice(0, index).every((lesson) => passed(lesson, progress));
}

/** まだ終えていない最初のレッスン。すべて終えていればnull。 */
export function nextLesson(lessons, progress) {
  return lessons.find((lesson) => !lesson.comingSoon && !passed(lesson, progress)) ?? null;
}

/** 巻や章の進み具合。 */
export function lessonsProgress(lessons, progress) {
  const playable = lessons.filter(({ comingSoon }) => !comingSoon);
  const records = playable.map(({ id }) => lessonRecord(progress, id));
  return {
    cleared: records.filter(({ status }) => status === "cleared").length,
    done: records.filter(({ status }) => status !== "new").length,
    total: playable.length,
    stars: records.reduce((sum, { stars }) => sum + stars, 0),
    maxStars: playable.length * 3,
  };
}
