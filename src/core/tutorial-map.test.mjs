import { describe, expect, it } from 'vitest';
import {
  chapterPosition,
  chapterSummary,
  earnedVolumeTitles,
  firstLessonOfNextChapter,
  lessonIcon,
  nextLessonInChapter,
  placementStartLesson,
  reviewLessonBefore,
  TUTORIAL_PLACEMENTS,
  tutorialMap,
} from './tutorial-map.mjs';
import { PLACEMENT_CHECK_LESSON, TUTORIAL_LESSONS, TUTORIAL_VOLUMES, tutorialLesson } from './tutorial-curriculum.mjs';
import {
  applyPlacement,
  emptyTutorialProgress,
  firstSkippedLesson,
  loadTutorialProgress,
  markReviewOffered,
  nextLesson,
  recommendedPlacement,
  placementFromCheck,
  shouldCheckPlacement,
  recordLessonCleared,
  recordLessonSkipped,
  recordSkipAhead,
  isSkipAheadChallenge,
  isLessonUnlocked,
  skipAheadTargets,
  SKIP_AHEAD_MIN_STARS,
  saveTutorialProgress,
  shouldAskPlacement,
  shouldOfferReview,
} from './tutorial-progress.mjs';
import { homeRoadmap } from './home-roadmap.mjs';

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

describe('分かるところから始める(設計17章)', () => {
  const place = (id) => applyPlacement(lessons, emptyTutorialProgress(), id, placementStartLesson(id));

  it('札は易しい順に4枚で、始めるレッスンは遊べるレッスンとして実在し、順に後ろへ進む', () => {
    expect(TUTORIAL_PLACEMENTS.map(({ id }) => id)).toEqual(['beginner', 'pieces', 'rules', 'mate']);
    const indexes = TUTORIAL_PLACEMENTS.map(({ start }) => lessons.findIndex(({ id }) => id === start));
    for (const [index, placement] of TUTORIAL_PLACEMENTS.entries()) {
      expect(indexes[index], placement.id).toBeGreaterThanOrEqual(0);
      expect(lessons[indexes[index]].comingSoon).toBeFalsy();
    }
    expect(indexes[0]).toBe(0);
    expect([...indexes].sort((a, b) => a - b)).toEqual(indexes);
    // 「1手詰めなら解ける」は囲いと戦法から(第3巻の最初)。「ルールは分かる」は第2巻の最初。
    expect(lessons[indexes[3]].volumeId).toBe(volumes[2].id);
    expect(lessons[indexes[2]].volumeId).toBe(volumes[1].id);
    expect(placementStartLesson('map')).toBeNull();
  });

  it('始めるところより前をとばし、次のレッスンが始めるレッスンになる', () => {
    for (const { id, start } of TUTORIAL_PLACEMENTS) {
      const progress = place(id);
      expect(progress.placement).toBe(id);
      expect(nextLesson(lessons, progress).id).toBe(start);
      const index = lessons.findIndex((lesson) => lesson.id === start);
      for (const lesson of lessons.slice(0, index)) expect(progress.lessons[lesson.id]?.status).toBe('skipped');
      for (const lesson of lessons.slice(index)) expect(progress.lessons[lesson.id]).toBeUndefined();
    }
    expect(firstSkippedLesson(lessons, place('beginner'))).toBeNull();
    expect(firstSkippedLesson(lessons, place('rules')).id).toBe(lessons[0].id);
  });

  it('クリアの記録は消さず、とばしただけでは巻の称号を渡さない', () => {
    const cleared = recordLessonCleared(emptyTutorialProgress(), 'v1-board', 3);
    const progress = applyPlacement(lessons, cleared, 'rules', placementStartLesson('rules'));
    expect(progress.lessons['v1-board']).toEqual({ status: 'cleared', stars: 3 });
    expect(earnedVolumeTitles(volumes, lessons, progress)).toEqual([]);
  });

  it('ルールは分かる以上を選ぶと、ホームの強くなる道の「駒を覚える」を終える', () => {
    expect(homeRoadmap({ tutorialProgress: place('beginner') }).current).toBe(1);
    expect(homeRoadmap({ tutorialProgress: place('rules') }).current).toBe(2);
  });

  it('記録が空で、まだ答えていないときだけ聞く', () => {
    const empty = emptyTutorialProgress();
    expect(shouldAskPlacement(empty)).toBe(true);
    expect(shouldAskPlacement(empty, { welcomeChoice: 'rules' })).toBe(true);
    expect(shouldAskPlacement(empty, { welcomeChoice: 'beginner' })).toBe(false);
    expect(shouldAskPlacement(empty, { storageAvailable: false })).toBe(false);
    expect(shouldAskPlacement(recordLessonCleared(empty, 'v1-board', 1))).toBe(false);
    expect(shouldAskPlacement({ ...empty, placement: 'map' })).toBe(false);
    expect(shouldAskPlacement(place('beginner'))).toBe(false);
  });

  it('ホームの案内の答えを、おすすめの札にする', () => {
    expect(recommendedPlacement('rules')).toBe('rules');
    expect(recommendedPlacement('player')).toBe('mate');
    expect(recommendedPlacement('some')).toBe('mate');
    expect(recommendedPlacement('beginner')).toBe('');
    expect(recommendedPlacement('')).toBe('');
  });

  it('「ルールは分かる」の人は、札の代わりに1手詰めの1問で始める場所を決める(docs/first-play-design.mdの4章)', () => {
    const empty = { lessons: {} };
    expect(shouldCheckPlacement(empty, { welcomeChoice: 'rules' })).toBe(true);
    expect(shouldCheckPlacement(empty, { welcomeChoice: 'player' })).toBe(false);
    expect(shouldCheckPlacement(empty, { welcomeChoice: 'rules', storageAvailable: false })).toBe(false);
    expect(shouldCheckPlacement({ lessons: {}, placement: 'map' }, { welcomeChoice: 'rules' })).toBe(false);
    expect(shouldCheckPlacement({ lessons: { 'v1-board': { status: 'cleared', stars: 3 } } }, { welcomeChoice: 'rules' })).toBe(false);
    // まちがえずヒントも使わずに解けたら第3巻(戦法と囲い)、そうでなければ第2巻(タダの駒・両取り・詰み)。
    expect(placementFromCheck({ mistakes: 0, hints: 0 })).toBe('mate');
    expect(placementFromCheck({ mistakes: 1, hints: 0 })).toBe('rules');
    expect(placementFromCheck({ mistakes: 0, hints: 1 })).toBe('rules');
    expect(placementStartLesson('mate')).toBe('v3-rook-styles');
    expect(placementStartLesson('rules')).toBe('v2-kiki');
    // 1問は巻と章に入れない(地図に出さない)。正解は金打ちの1つ。
    expect(tutorialLesson(PLACEMENT_CHECK_LESSON.id)).toBe(PLACEMENT_CHECK_LESSON);
    expect(lessons.some(({ id }) => id === PLACEMENT_CHECK_LESSON.id)).toBe(false);
    expect(PLACEMENT_CHECK_LESSON.steps).toHaveLength(1);
    expect(PLACEMENT_CHECK_LESSON.steps[0]).toMatchObject({ type: 'mate', solution: ['G*5b'] });
  });

  it('答えと、復習を勧めたことを保存し、読めない値は捨てる', () => {
    const store = new Map();
    const fake = { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) };
    const progress = markReviewOffered(place('mate'));
    saveTutorialProgress(fake, progress);
    expect(loadTutorialProgress(fake)).toMatchObject({ placement: 'mate', reviewOffered: true });
    saveTutorialProgress(fake, { lessons: {}, placement: 'expert', reviewOffered: 'yes' });
    expect(loadTutorialProgress(fake)).toEqual({ lessons: {} });
  });

  it('先から始めた章で、続けて2つ★1なら一度だけ復習を勧める', () => {
    const start = placementStartLesson('mate');
    const chapter = lessons.filter(({ chapterId }) => chapterId === lessons.find(({ id }) => id === start).chapterId);
    let progress = place('mate');
    progress = recordLessonCleared(progress, chapter[0].id, 1);
    expect(shouldOfferReview(lessons, progress, start)).toBe(false);
    progress = recordLessonCleared(progress, chapter[1].id, 1);
    expect(shouldOfferReview(lessons, progress, start)).toBe(true);
    expect(shouldOfferReview(lessons, markReviewOffered(progress), start)).toBe(false);
    // ★2をはさめば続けてではない。
    const mixed = recordLessonCleared(recordLessonCleared(place('mate'), chapter[0].id, 1), chapter[1].id, 2);
    expect(shouldOfferReview(lessons, recordLessonCleared(mixed, chapter[2].id, 1), start)).toBe(false);
    // はじめから始めた人・地図から選んだ人には勧めない。
    const beginner = recordLessonCleared(recordLessonCleared(place('beginner'), lessons[0].id, 1), lessons[1].id, 1);
    expect(shouldOfferReview(lessons, beginner, placementStartLesson('beginner'))).toBe(false);
  });

  it('復習の行き先は、とばした中でいちばん近い章の最初のレッスン', () => {
    expect(reviewLessonBefore(lessons, placementStartLesson('pieces')).id).toBe('v1-pawn');
    expect(reviewLessonBefore(lessons, placementStartLesson('rules')).id).toBe('v1-pawn');
    expect(reviewLessonBefore(lessons, placementStartLesson('mate')).id).toBe('v2-check');
    expect(reviewLessonBefore(lessons, placementStartLesson('beginner'))).toBeNull();
  });
});

describe('腕だめしで飛び級(設計20章)', () => {
  const bossOf = (chapterId) => lessons.find((lesson) => lesson.chapterId === chapterId && lesson.boss);
  const chapterOf = (chapterId) => lessons.filter((lesson) => lesson.chapterId === chapterId && !lesson.comingSoon);

  it('まだ届いていない腕だめしは、鍵をかけず「挑戦できる」にする。ふつうのレッスンは鍵のまま', () => {
    const rows = tutorialMap(volumes, lessons, emptyTutorialProgress()).rows.filter(({ type }) => type === 'lesson');
    const bosses = rows.filter(({ boss }) => boss);
    expect(bosses.length).toBeGreaterThan(0);
    for (const row of bosses) expect(row).toMatchObject({ state: 'challenge', skipAhead: true });
    expect(rows.filter(({ boss, state }) => !boss && state === 'challenge')).toEqual([]);
    expect(rows[1].state).toBe('locked');
  });

  it('合格すると、腕だめしの章の終えていないレッスンを修了に、前の章の遊んでいないレッスンをとばしたにする', () => {
    const boss = bossOf('v2-c3');
    let progress = recordLessonCleared(emptyTutorialProgress(), lessons[0].id, 3);
    const inChapter = chapterOf('v2-c3');
    progress = recordLessonCleared(progress, inChapter[0].id, 2);
    expect(isSkipAheadChallenge(lessons, progress, boss.id)).toBe(true);
    progress = recordLessonCleared(progress, boss.id, SKIP_AHEAD_MIN_STARS);
    const result = recordSkipAhead(lessons, progress, boss.id);
    // クリアの記録は残し、章の残りを修了に。
    expect(result.progress.lessons[inChapter[0].id]).toEqual({ status: 'cleared', stars: 2 });
    expect(result.tested).toEqual(inChapter.filter(({ id }) => id !== boss.id && id !== inChapter[0].id).map(({ id }) => id));
    for (const id of result.tested) expect(result.progress.lessons[id]).toEqual({ status: 'skipped', stars: 0, tested: true });
    expect(result.progress.lessons[lessons[0].id]).toEqual({ status: 'cleared', stars: 3 });
    expect(result.progress.lessons[lessons[1].id]).toEqual({ status: 'skipped', stars: 0 });
    // 次は、腕だめしの次の章から。
    expect(nextLesson(lessons, result.progress).id).toBe(firstLessonOfNextChapter(lessons, boss.id).id);
    const map = tutorialMap(volumes, lessons, result.progress);
    expect(map.rows.find(({ id }) => id === result.tested[0]).state).toBe('tested');
    expect(map.rows.find(({ id }) => id === boss.id)).toMatchObject({ state: 'cleared', skipAhead: false });
    // 修了は「はじめから学ぶ」の行き先にしない(とばした最初のレッスンへ)。
    expect(firstSkippedLesson(lessons, result.progress).id).toBe(lessons[1].id);
  });

  it('修了の記録は、章をとばしても消えず、クリアすれば★に変わる。保存して読み直しても残る', () => {
    const boss = bossOf('v1-c1');
    const { progress, tested } = recordSkipAhead(lessons, emptyTutorialProgress(), boss.id);
    expect(recordLessonSkipped(progress, tested[0]).lessons[tested[0]].tested).toBe(true);
    expect(recordLessonCleared(progress, tested[0], 1).lessons[tested[0]]).toEqual({ status: 'cleared', stars: 1 });
    const store = new Map();
    const storage = { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) };
    saveTutorialProgress(storage, progress);
    expect(loadTutorialProgress(storage).lessons[tested[0]]).toEqual({ status: 'skipped', stars: 0, tested: true });
  });

  it('修了とメダル・称号: 腕だめしの★でメダル。前の章の腕だめしをとばしただけなら巻の称号は渡さない', () => {
    const boss = bossOf('v1-c2');
    let progress = recordLessonCleared(emptyTutorialProgress(), boss.id, 3);
    progress = recordSkipAhead(lessons, progress, boss.id).progress;
    expect(chapterSummary(volumes, lessons, progress, 'v1-c2').medal.tier).toBe('gold');
    expect(earnedVolumeTitles(volumes, lessons, progress)).toEqual([]);
    // 第1章の腕だめしにも合格すれば、第1巻の称号。
    const first = bossOf('v1-c1');
    progress = recordLessonCleared(progress, first.id, 2);
    progress = recordSkipAhead(lessons, progress, first.id).progress;
    expect(earnedVolumeTitles(volumes, lessons, progress).map(({ id }) => id)).toEqual(['tutorial-v1']);
  });

  it('順に届いた腕だめしは飛び級の挑戦ではない。とばしていた同じ章のレッスンだけを修了に変える', () => {
    const boss = bossOf('v1-c2');
    const progress = applyPlacement(lessons, emptyTutorialProgress(), 'pieces', placementStartLesson('pieces'));
    let reached = progress;
    for (const lesson of chapterOf('v1-c2')) {
      if (lesson.id !== boss.id && reached.lessons[lesson.id]?.status !== 'skipped') reached = recordLessonCleared(reached, lesson.id, 3);
    }
    expect(isLessonUnlocked(lessons, reached, boss.id)).toBe(true);
    expect(isSkipAheadChallenge(lessons, reached, boss.id)).toBe(false);
    const targets = skipAheadTargets(lessons, reached, boss.id);
    expect(targets.skipped).toEqual([]);
    expect(targets.tested.every((id) => reached.lessons[id].status === 'skipped')).toBe(true);
  });

  it('腕だめしでないレッスンは、飛び級の対象にしない', () => {
    expect(skipAheadTargets(lessons, emptyTutorialProgress(), lessons[3].id)).toEqual({ tested: [], skipped: [] });
    expect(isSkipAheadChallenge(lessons, emptyTutorialProgress(), lessons[3].id)).toBe(false);
  });
});
