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

// ===== 道具: 利きメガネ =====
/** 利きメガネをもらうレッスン。クリアかスキップで持っていることにする(スキップした上級者も使える)。 */
export const KIKI_GLASSES_LESSON_ID = "v2-kiki";
/** 利きメガネを付けているか(付け外しの状態)。レッスンの進捗とは別の鍵に置く。 */
export const KIKI_GLASSES_KEY = "yacobihime:shogi-match:tutorial-kiki-glasses:v1";

export function hasKikiGlasses(progress) {
  const { status } = lessonRecord(progress, KIKI_GLASSES_LESSON_ID);
  return status === "cleared" || status === "skipped";
}

export function loadKikiGlassesOn(storage) {
  try {
    return storage?.getItem(KIKI_GLASSES_KEY) === "on";
  } catch {
    return false;
  }
}

export function saveKikiGlassesOn(storage, on) {
  try {
    storage?.setItem(KIKI_GLASSES_KEY, on ? "on" : "off");
    return true;
  } catch {
    return false;
  }
}

// ===== にがてをもう1回 =====
/**
 * レッスンでまちがえた課題(まちがい・ヒントがあった課題)の記録。{ [レッスンID]: ステップの番号の配列 }。
 * レッスンの進捗(★)とは別の鍵に置く。教材が変わって番号が課題でなくなったものは、読み込むときに捨てる。
 */
export const TUTORIAL_WEAK_KEY = "yacobihime:shogi-match:tutorial-weak:v1";
/** 苦手として出し直す課題の種類。説明・観戦・対局・図鑑の案内は出さない。 */
export const WEAK_STEP_TYPES = Object.freeze(["move-piece", "find-move", "mate", "choose", "capture", "problem", "build", "attack-test"]);

function isWeakStep(lesson, index) {
  return WEAK_STEP_TYPES.includes(lesson?.steps?.[index]?.type);
}

/** @param {any} storage @param {{ id: string, steps?: any[] }[]} lessons */
export function loadWeakSteps(storage, lessons) {
  try {
    const parsed = JSON.parse(storage?.getItem(TUTORIAL_WEAK_KEY) ?? "{}");
    const byId = new Map(lessons.map((lesson) => [lesson.id, lesson]));
    /** @type {Record<string, number[]>} */
    const weak = {};
    for (const [lessonId, indexes] of Object.entries(parsed ?? {})) {
      if (!Array.isArray(indexes)) continue;
      const valid = [...new Set(indexes.filter((index) => Number.isInteger(index) && isWeakStep(byId.get(lessonId), index)))].sort((a, b) => a - b);
      if (valid.length) weak[lessonId] = valid;
    }
    return weak;
  } catch {
    return {};
  }
}

export function saveWeakSteps(storage, weak) {
  try {
    storage?.setItem(TUTORIAL_WEAK_KEY, JSON.stringify(weak));
    return true;
  } catch {
    return false;
  }
}

/** レッスンを最後まで遊んだ結果で、そのレッスンの苦手を置き換える(まちがえなかった課題は消える)。 */
export function recordLessonWeakSteps(weak, lessonId, indexes) {
  const next = { ...weak };
  const list = [...new Set(indexes)].sort((a, b) => a - b);
  if (list.length) next[lessonId] = list;
  else delete next[lessonId];
  return next;
}

/** にがてをもう1回で、まちがえずに解いた課題を苦手から消す。 */
export function clearWeakSteps(weak, solved) {
  const next = { ...weak };
  for (const { lessonId, index } of solved) {
    const list = (next[lessonId] ?? []).filter((entry) => entry !== index);
    if (list.length) next[lessonId] = list;
    else delete next[lessonId];
  }
  return next;
}

/** 章の苦手の課題(学ぶ順)。 */
export function chapterWeakSteps(lessons, weak, chapterId) {
  return lessons
    .filter((lesson) => lesson.chapterId === chapterId)
    .flatMap((lesson) => (weak[lesson.id] ?? []).filter((index) => isWeakStep(lesson, index)).map((index) => ({ lessonId: lesson.id, index, step: lesson.steps[index] })));
}

/**
 * 章の苦手だけを並べた復習のレッスン。苦手がなければnull。
 * 各ステップのoriginに、元のレッスンと番号を残す(まちがえずに解いたら苦手から消すため)。
 */
export function weakReviewLesson(lessons, weak, chapterId) {
  const entries = chapterWeakSteps(lessons, weak, chapterId);
  if (!entries.length) return null;
  const first = lessons.find((lesson) => lesson.chapterId === chapterId);
  return {
    id: `review:${chapterId}`,
    chapterId,
    volumeId: first?.volumeId,
    title: "にがてをもう1回",
    summary: "まちがえた課題を解き直す",
    review: true,
    steps: entries.map(({ lessonId, index, step }) => ({ ...step, origin: { lessonId, index } })),
  };
}
