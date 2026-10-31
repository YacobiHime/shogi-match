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
        lessons[id] = entry.tested === true ? { status: "skipped", stars: 0, tested: true } : { status: "skipped", stars: 0 };
      }
    }
    const result = { lessons };
    if (PLACEMENT_IDS.includes(parsed?.placement)) result.placement = parsed.placement;
    if (parsed?.reviewOffered === true) result.reviewOffered = true;
    if (TUTORIAL_COURSE_IDS.includes(parsed?.course)) result.course = parsed.course;
    return result;
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

// ===== 2つのコース(21-4) =====
/** 教室のコース。basicsはじっくり基礎(今の5巻)、tipsはすぐ使えるコツ。地図のタブで選び、記録に残す。 */
export const TUTORIAL_COURSE_IDS = Object.freeze(["basics", "tips"]);

/** 地図で開くコース。記録がなければじっくり基礎。 */
export function tutorialCourse(progress) {
  return TUTORIAL_COURSE_IDS.includes(progress?.course) ? progress.course : "basics";
}

/** 選んだコースを記録に残す。 */
export function withTutorialCourse(progress, course) {
  return TUTORIAL_COURSE_IDS.includes(course) ? { ...progress, course } : progress;
}

/** コツのレッスンのID(tutorial-curriculum.mjsのTIPS_LESSONSはどれも「tip-」で始まる。対局画面からカリキュラムを読まずに見分ける)。 */
const isTipLessonId = (id) => id.startsWith("tip-");

/** すぐ使えるコツに触れたことがあるか(コツのタブを開いたか、コツのカードを1枚でも遊んだ)。ホームの入口に使う(21-14-4)。 */
export function tipsTouched(progress) {
  return progress?.course === "tips" || Object.keys(progress?.lessons ?? {}).some(isTipLessonId);
}

/** クリアしたコツのカードのID。対局の「コツどおり！」は、覚えたコツだけに出す(21-14-2)。 */
export function learnedTips(progress) {
  return Object.entries(progress?.lessons ?? {})
    .filter(([id, entry]) => isTipLessonId(id) && entry?.status === "cleared")
    .map(([id]) => id);
}

// ===== どこから始めるか(17章) =====
/**
 * 最初の問いの答え。札のID(tutorial-map.mjsのTUTORIAL_PLACEMENTS)と、地図から自分で選んだ「map」、
 * すぐ使えるコツだけ見る「tips」(21-4)。
 */
export const PLACEMENT_IDS = Object.freeze(["beginner", "pieces", "rules", "mate", "map", "tips"]);

/**
 * 教室を開いたときに「どのくらい知ってる？」と聞くか。記録が1つもなく、まだ答えていないときだけ聞く。
 * ホームのはじめての案内で「はじめて」を選んだ人には聞かない(もう答えている)。保存できない環境でも聞かない(毎回聞かないため)。
 * @param {{ lessons: Record<string, unknown>, placement?: string }} progress
 * @param {{ welcomeChoice?: string, storageAvailable?: boolean }} [options]
 */
export function shouldAskPlacement(progress, { welcomeChoice = "", storageAvailable = true } = {}) {
  if (!storageAvailable || progress.placement || welcomeChoice === "beginner") return false;
  return Object.keys(progress.lessons).length === 0;
}

/** ホームのはじめての案内の答えから、おすすめの札。決めつけず「おすすめ」の印に使うだけ。 */
export function recommendedPlacement(welcomeChoice) {
  return ({ rules: "rules", some: "mate", player: "mate" })[welcomeChoice] ?? "";
}

/**
 * はじめての案内で「ルールは分かる」と答えた人は、札を選ぶ代わりに1手詰めを1問解いて、始める場所を決める
 * (docs/first-play-design.mdの4章)。教室を初めて開いたときだけ。
 * @param {{ lessons: Record<string, any>, placement?: string }} progress
 * @param {{ welcomeChoice?: string, storageAvailable?: boolean }} [options]
 */
export function shouldCheckPlacement(progress, { welcomeChoice = "", storageAvailable = true } = {}) {
  return welcomeChoice === "rules" && shouldAskPlacement(progress, { welcomeChoice, storageAvailable });
}

/**
 * 始める場所を決める1問の結果。まちがえずヒントも使わずに解けたら、戦法と囲いから(第3巻・札のmate)。
 * そうでなければ、タダの駒・両取り・詰みから(第2巻・札のrules)。
 * @param {{ mistakes: number, hints: number }} result
 * @returns {'mate' | 'rules'}
 */
export function placementFromCheck({ mistakes, hints }) {
  return mistakes === 0 && hints === 0 ? "mate" : "rules";
}

/**
 * 答えを記録する。始めるレッスンより前のレッスンを、すべて「とばした」にする(章をとばすのと同じ記録)。
 * クリアした記録は消さない。★・メダル・巻の称号は、今までどおり腕だめしのクリアが要る。
 * @param {{ id: string, comingSoon?: boolean }[]} lessons
 * @param {{ lessons: Record<string, any>, placement?: string }} progress
 * @param {string} placement
 * @param {string | null} [startLessonId] 始めるレッスン。なければ、とばさない。
 */
export function applyPlacement(lessons, progress, placement, startLessonId = null) {
  let next = { ...progress, placement };
  const index = startLessonId ? lessons.findIndex(({ id }) => id === startLessonId) : -1;
  for (const lesson of lessons.slice(0, Math.max(0, index))) {
    if (!lesson.comingSoon) next = recordLessonSkipped(next, lesson.id);
  }
  return next;
}

/** とばした最初のレッスン(地図の「はじめから学ぶ」で始める)。腕だめしで修了にしたレッスンは除く。なければnull。 */
export function firstSkippedLesson(lessons, progress) {
  return lessons.find((lesson) => {
    const record = lessonRecord(progress, lesson.id);
    return !lesson.comingSoon && !lesson.side && record.status === "skipped" && !record.tested;
  }) ?? null;
}

/**
 * 先から始めた人が、始めた章で続けて2つのレッスンを★1で終えたら、一度だけ前の章の復習を勧める。
 * 前の章へ戻るかは本人が選ぶ(黙って戻さない)。
 * @param {{ id: string, chapterId: string, comingSoon?: boolean }[]} lessons
 * @param {{ lessons: Record<string, any>, placement?: string, reviewOffered?: boolean }} progress
 * @param {string | null} startLessonId 答えで始めたレッスン
 */
export function shouldOfferReview(lessons, progress, startLessonId) {
  if (!startLessonId || progress.reviewOffered || ["beginner", "map", undefined].includes(progress.placement)) return false;
  const start = lessons.find(({ id }) => id === startLessonId);
  if (!start) return false;
  const chapter = lessons.filter((lesson) => lesson.chapterId === start.chapterId && !lesson.comingSoon);
  return chapter.some((lesson, index) => index > 0
    && [lesson, chapter[index - 1]].every(({ id }) => {
      const record = lessonRecord(progress, id);
      return record.status === "cleared" && record.stars === 1;
    }));
}

/** 復習を勧めたことを記録する(二度は聞かない)。 */
export function markReviewOffered(progress) {
  return { ...progress, reviewOffered: true };
}

/** クリアを記録する。やり直して★が減っても、最高記録を残す。 */
export function recordLessonCleared(progress, lessonId, stars) {
  const previous = progress.lessons[lessonId];
  const best = previous?.status === "cleared" ? Math.max(previous.stars, stars) : stars;
  return { ...progress, lessons: { ...progress.lessons, [lessonId]: { status: "cleared", stars: best } } };
}

/** スキップを記録する。すでにクリアしたレッスンと、腕だめしで修了にしたレッスンの記録は残す。 */
export function recordLessonSkipped(progress, lessonId) {
  const previous = progress.lessons[lessonId];
  if (previous?.status === "cleared" || previous?.tested) return progress;
  return { ...progress, lessons: { ...progress.lessons, [lessonId]: { status: "skipped", stars: 0 } } };
}

// ===== 腕だめしで飛び級(設計20章) =====
/** 腕だめしで飛び級できる★の下限。まちがいとヒントが合わせて2回まで(★2以上)で合格にする。 */
export const SKIP_AHEAD_MIN_STARS = 2;

/**
 * 腕だめしで飛び級するときに記録を変えるレッスン。
 * - tested: 腕だめしの章の、腕だめしより前で、まだクリアも修了もしていないレッスン(修了にする)。
 * - skipped: それより前の章の、まだ遊んでいないレッスン(章をとばすのと同じ「とばした」にする)。
 * 腕だめしでなければ、両方とも空。
 * @param {{ id: string, chapterId: string, boss?: boolean, comingSoon?: boolean }[]} lessons
 * @param {{ lessons: Record<string, any> }} progress
 * @param {string} bossId
 * @returns {{ tested: string[], skipped: string[] }}
 */
export function skipAheadTargets(lessons, progress, bossId) {
  const index = lessons.findIndex(({ id }) => id === bossId);
  const boss = lessons[index];
  if (!boss?.boss) return { tested: [], skipped: [] };
  // 寄り道(21-6)は、飛び級で修了にも「とばした」にもしない(遊ばなくてもよいレッスンのまま)。
  const before = lessons.slice(0, index).filter(({ comingSoon, side }) => !comingSoon && !side);
  const tested = before
    .filter((lesson) => lesson.chapterId === boss.chapterId)
    .filter(({ id }) => {
      const record = lessonRecord(progress, id);
      return record.status !== "cleared" && !record.tested;
    })
    .map(({ id }) => id);
  const skipped = before
    .filter((lesson) => lesson.chapterId !== boss.chapterId && lessonRecord(progress, lesson.id).status === "new")
    .map(({ id }) => id);
  return { tested, skipped };
}

/**
 * この腕だめしが飛び級の挑戦か: 前に、まだ遊んでいないレッスンがある(順に進んでいたら届かない)。
 * 順に届いた腕だめしは、ふつうの腕だめし。合格すれば、とばしていた同じ章のレッスンを修了に変えるだけにする。
 */
export function isSkipAheadChallenge(lessons, progress, bossId) {
  const lesson = lessons.find(({ id }) => id === bossId);
  return Boolean(lesson?.boss) && !lesson.comingSoon && !isLessonUnlocked(lessons, progress, bossId);
}

/**
 * 腕だめしの合格で飛び級を記録する。腕だめし自体のクリア(★)は、別にrecordLessonClearedで記録する。
 * @returns {{ progress: { lessons: Record<string, any> }, tested: string[], skipped: string[] }}
 */
export function recordSkipAhead(lessons, progress, bossId) {
  const { tested, skipped } = skipAheadTargets(lessons, progress, bossId);
  let next = progress;
  for (const id of skipped) next = recordLessonSkipped(next, id);
  if (tested.length) {
    const entries = Object.fromEntries(tested.map((id) => [id, { status: "skipped", stars: 0, tested: true }]));
    next = { ...next, lessons: { ...next.lessons, ...entries } };
  }
  return { progress: next, tested, skipped };
}

export function lessonRecord(progress, lessonId) {
  return progress.lessons[lessonId] ?? { status: "new", stars: 0 };
}

/** 次のレッスンへ進めるか。準備中と寄り道(side。21-6)のレッスンは通過済みとして扱う。 */
function passed(lesson, progress) {
  if (lesson.comingSoon || lesson.side) return true;
  const { status } = lessonRecord(progress, lesson.id);
  return status === "cleared" || status === "skipped";
}

/** 教室全体を通した順番で、前のレッスンを終えていれば解放する。すぐ使えるコツ(free)は、いつでも遊べる(21-4)。 */
export function isLessonUnlocked(lessons, progress, lessonId) {
  const index = lessons.findIndex(({ id }) => id === lessonId);
  if (lessons[index]?.free) return true;
  if (index <= 0) return index === 0;
  return lessons.slice(0, index).every((lesson) => passed(lesson, progress));
}

/** まだ終えていない最初のレッスン。すべて終えていればnull。 */
export function nextLesson(lessons, progress) {
  return lessons.find((lesson) => !lesson.comingSoon && !passed(lesson, progress)) ?? null;
}

/** 巻や章の進み具合。 */
export function lessonsProgress(lessons, progress) {
  // 寄り道(21-6)は進み具合のメーターに数えない(遊ばなくても巻を終えられる)。
  const playable = lessons.filter(({ comingSoon, side }) => !comingSoon && !side);
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

// ===== 格言帳 =====
/**
 * 教室の格言札で出会った格言(手筋図鑑のID)。手筋図鑑の項目に★を付ける(docs/nyumon-mode-design.mdの16-5)。
 * 読めなくても、壊れていても、空の帳面として遊べるようにする。
 */
export const TUTORIAL_PROVERBS_KEY = "yacobihime:shogi-match:tutorial-proverbs:v1";

/** @param {any} storage @returns {string[]} */
export function loadCollectedProverbs(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(TUTORIAL_PROVERBS_KEY) ?? "[]");
    return Array.isArray(parsed) ? [...new Set(parsed.filter((id) => typeof id === "string" && id))] : [];
  } catch {
    return [];
  }
}

/**
 * 格言を格言帳に入れる。isNewは初めて出会った格言か(「格言帳に入ったよ」と添える)。
 * @param {any} storage
 * @param {string} id
 * @returns {{ ids: string[], isNew: boolean }}
 */
export function recordProverb(storage, id) {
  const ids = loadCollectedProverbs(storage);
  if (!id || ids.includes(id)) return { ids, isNew: false };
  const next = [...ids, id];
  try {
    storage?.setItem(TUTORIAL_PROVERBS_KEY, JSON.stringify(next));
  } catch {
    // 保存できなくても、札は出す。
  }
  return { ids: next, isNew: true };
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
