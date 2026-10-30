/**
 * 将棋教室の地図(すごろくの道)。巻 → 章 → レッスンの階層を降りて選ばせるかわりに、
 * 全レッスンを学ぶ順に1本の道に並べる(『スーパーマリオワールド』の地図、Duolingoの道にならう)。
 * いま進めるマスを1つだけ大きく見せ、押せばすぐ始める。
 *
 * レッスンは短いので、同じ章のあいだは結果の画面を挟まずに続けて進め、章の終わりにまとめてほめる。
 * 画面に依存しない。
 */
import { isLessonUnlocked, isSkipAheadChallenge, lessonRecord, lessonsProgress, nextLesson } from './tutorial-progress.mjs';

/** 腕だめしの★からメダルを決める。★3は金、★2は銀、★1は銅。スキップやまだのときはなし。 */
const MEDAL_TIERS = Object.freeze({ 3: 'gold', 2: 'silver', 1: 'bronze' });
export const MEDAL_LABELS = Object.freeze({ gold: '金メダル', silver: '銀メダル', bronze: '銅メダル' });

/**
 * 章のメダル。章の腕だめし(boss)をクリアした★から決める。保存はせず、進捗から導く。
 * @returns {{ tier: 'gold' | 'silver' | 'bronze', label: string, stars: number } | null}
 */
export function chapterMedal(lessons, progress, chapterId) {
  const boss = lessons.find((lesson) => lesson.chapterId === chapterId && lesson.boss);
  if (!boss) return null;
  const record = lessonRecord(progress, boss.id);
  const tier = record.status === 'cleared' ? MEDAL_TIERS[record.stars] : undefined;
  return tier ? { tier, label: MEDAL_LABELS[tier], stars: record.stars } : null;
}

/**
 * 巻を終えたときの称号。巻のレッスンを全部終え(クリアかスキップ)、腕だめしはすべてクリアしていれば渡す。
 * 腕だめしをスキップしただけでは渡さない(称号は力を試した記録にする)。
 * rankは巻の番号(1〜5)で、竜王戦の称号(10〜)より低くし、ホームの所属を竜王戦より先に変えない。
 * @returns {{ id: string, label: string, detail: string, rank: number } | null}
 */
export function volumeTitle(volumes, lessons, progress, volumeId) {
  const index = volumes.findIndex(({ id }) => id === volumeId);
  if (index < 0) return null;
  // 寄り道(21-6)は、遊ばなくても巻を終えたことにする。
  const volumeLessons = lessons.filter((lesson) => lesson.volumeId === volumeId && !lesson.comingSoon && !lesson.side);
  const finished = volumeLessons.every((lesson) => lessonRecord(progress, lesson.id).status !== 'new');
  const bossesCleared = volumeLessons.filter(({ boss }) => boss).every((lesson) => lessonRecord(progress, lesson.id).status === 'cleared');
  if (!volumeLessons.length || !finished || !bossesCleared) return null;
  const last = index === volumes.length - 1;
  return {
    id: `tutorial-${volumeId}`,
    label: last ? '将棋教室 卒業' : `将棋教室 第${index + 1}巻 修了`,
    detail: `やこび姫の将棋教室 第${index + 1}巻「${volumes[index].title}」を終えた`,
    rank: index + 1,
  };
}

/** 終えた巻の称号の一覧(巻の順)。 */
export function earnedVolumeTitles(volumes, lessons, progress) {
  return volumes.map(({ id }) => volumeTitle(volumes, lessons, progress, id)).filter(Boolean);
}

/**
 * 教室を初めて開いたときの「将棋、どのくらい知ってる？」の札(設計17章)。
 * 段階の名前ではなく「できること」で書き、易しい順に並べる。startは始めるレッスン。
 */
export const TUTORIAL_PLACEMENTS = Object.freeze([
  Object.freeze({ id: "beginner", label: "はじめて", description: "駒の動かし方から覚えよう", start: "v1-board" }),
  Object.freeze({ id: "pieces", label: "駒の動きは分かる", description: "成る・持ち駒・反則（二歩など）から", start: "v1-promotion" }),
  Object.freeze({ id: "rules", label: "ルールは分かる", description: "タダの駒・両取り・詰みから", start: "v2-kiki" }),
  Object.freeze({ id: "mate", label: "1手詰めなら解ける", description: "囲いと戦法から", start: "v3-rook-styles" }),
]);

/** 札のIDから、始めるレッスンのID。地図から選ぶ(map)など、札でないときはnull。 */
export function placementStartLesson(placementId) {
  return TUTORIAL_PLACEMENTS.find(({ id }) => id === placementId)?.start ?? null;
}

/**
 * 復習を勧めるときの行き先: 始めたレッスンのすぐ前の章(とばした中で、いちばん近い章)の、
 * 始めたレッスンより前で最初に遊べるレッスン。「駒の動きは分かる」なら歩、「1手詰めなら解ける」なら王手と詰み。なければnull。
 */
export function reviewLessonBefore(lessons, lessonId) {
  const index = lessons.findIndex(({ id }) => id === lessonId);
  if (index <= 0) return null;
  const before = lessons.slice(0, index);
  const chapterId = before.at(-1).chapterId;
  return before.find((lesson) => lesson.chapterId === chapterId && !lesson.comingSoon) ?? null;
}

/** 道を左右にくねらせる位置(0〜4)。章ごとに、まん中から始める。 */
const LANES = Object.freeze([2, 3, 4, 3, 2, 1, 0, 1]);

/**
 * レッスンのマスに描く1文字。いちばん大事な課題の種類で決める。
 * レッスンにiconがあればそれを使う(駒のレッスンは、その駒の1文字)。
 * なければ、対局 → 観戦 → 詰み・問題 → 指す → 駒取り → 駒を動かす → クイズ → 説明。
 */
export function lessonIcon(lesson) {
  if (typeof lesson?.icon === 'string' && lesson.icon) return lesson.icon;
  const types = new Set((lesson?.steps ?? []).map(({ type }) => type));
  if (types.has('play')) return '局';
  if (types.has('replay')) return '観';
  if (types.has('mate') || types.has('problem')) return '詰';
  if (types.has('find-move')) return '指';
  if (types.has('capture')) return '取';
  if (types.has('move-piece')) return '駒';
  if (types.has('choose')) return '問';
  return '話';
}

/**
 * レッスンのマスの状態。腕だめしで修了にしたレッスンは'tested'。
 * まだ届いていない腕だめしは鍵をかけず'challenge'にする(合格すれば飛び級できる。設計20章)。
 */
function lessonState(lessons, progress, lesson, current) {
  if (lesson.comingSoon) return 'soon';
  const record = lessonRecord(progress, lesson.id);
  if (record.status === 'cleared') return 'cleared';
  if (record.status === 'skipped') return record.tested ? 'tested' : 'skipped';
  if (current?.id === lesson.id) return 'next';
  if (isLessonUnlocked(lessons, progress, lesson.id)) return 'open';
  return lesson.boss ? 'challenge' : 'locked';
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
      type: 'volume', id: volume.id, number: volumeIndex + 1, volumeNumber: volumeIndex + 1, title: volume.title, description: volume.description,
      summary: lessonsProgress(volumeLessons, progress),
    });
    volume.chapters.forEach((chapter, chapterIndex) => {
      const chapterLessons = lessons.filter((lesson) => lesson.chapterId === chapter.id);
      const pending = chapterLessons.filter((lesson) => !lesson.comingSoon && !lesson.side && lessonRecord(progress, lesson.id).status === 'new');
      rows.push({
        type: 'chapter', id: chapter.id, number: chapterIndex + 1, title: chapter.title, volumeNumber: volumeIndex + 1,
        summary: lessonsProgress(chapterLessons, progress),
        medal: chapterMedal(lessons, progress, chapter.id),
        // まだ終えていないレッスンがあり、その最初が遊べるときだけ、章ごと飛ばせる。
        // すぐ使えるコツ(free)は、どこからでも遊べるので、とばす必要がない。
        skippable: pending.length > 0 && !pending[0].free && isLessonUnlocked(lessons, progress, pending[0].id),
      });
      chapterLessons.forEach((lesson, lessonIndex) => {
        rows.push({
          type: 'lesson', id: lesson.id, title: lesson.title, summary: lesson.summary ?? '', volumeNumber: volumeIndex + 1,
          icon: lessonIcon(lesson), boss: Boolean(lesson.boss), side: Boolean(lesson.side),
          // 腕だめしは道のまん中に置く(山場を目立たせる)。
          lane: lesson.boss ? 2 : LANES[lessonIndex % LANES.length],
          state: lessonState(lessons, progress, lesson, current),
          stars: lessonRecord(progress, lesson.id).stars,
          // 合格すると飛び級になる腕だめし(前に、まだ遊んでいないレッスンがある)。
          skipAhead: isSkipAheadChallenge(lessons, progress, lesson.id),
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
 * @returns {{ id: string, title: string, number: number, volumeNumber: number, volumeId: string, medal: ReturnType<typeof chapterMedal>, lessons: { id: string, title: string, summary: string, stars: number, status: string, tested?: boolean }[], stars: number, maxStars: number }}
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
      volumeId: volume.id,
      medal: chapterMedal(lessons, progress, chapterId),
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
