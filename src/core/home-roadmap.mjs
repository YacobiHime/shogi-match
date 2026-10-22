/**
 * ホームの「強くなる道」(docs/home-roadmap-design.md)。やこび姫と強くなる5つの段を、保存してある記録だけで決める。
 * 前の段を終えていなくても、後の段の条件を満たしていれば、その段も終えたことにする(遊び方の順番を押しつけない)。
 * 画面から独立した純粋な処理にして、単体テストで確かめる。
 */

/** 教室の第1巻・第2巻の最後のレッスン(腕だめし)。クリアかスキップで、その巻を終えたとみなす。 */
export const VOLUME_1_LAST_LESSON = "v1-c2-boss";
export const VOLUME_2_LAST_LESSON = "v2-c3-boss";
/** 「駒を覚える」を終えたとみなす通常対局の数(教室を通らずに対局を続けている人)。 */
export const ROADMAP_PIECES_GAMES = 3;
/** 「詰みを覚える」を終えたとみなす、問題集で解いた問題の数。 */
export const ROADMAP_MATE_PROBLEMS = 10;

/** afterは、その段を終えてから遊ぶとよい入口に添える言葉(「1局指したら」)。 */
export const ROADMAP_STEPS = Object.freeze([
  Object.freeze({ id: "pieces", label: "駒を覚える", after: "駒を覚えたら" }),
  Object.freeze({ id: "first-game", label: "初めての対局", after: "1局指したら" }),
  Object.freeze({ id: "mate", label: "詰みを覚える", after: "詰みを覚えたら" }),
  Object.freeze({ id: "ryuo", label: "竜王戦に出る", after: "竜王戦のあとに" }),
  Object.freeze({ id: "grade", label: "大会で勝ち上がる", after: "" }),
]);

/** ホームの入口と、その入口がおすすめになる段(1から数える)。しらべる(図鑑)は道に入れない。 */
export const ROADMAP_TILE_STEPS = Object.freeze({ tutorial: 1, match: 2, problems: 3, endgame: 3, tournament: 4 });

function passed(tutorialProgress, lessonId) {
  const status = tutorialProgress?.lessons?.[lessonId]?.status;
  return status === "cleared" || status === "skipped";
}

/**
 * いまの段と、各段を終えたか。
 * @param {{
 *   tutorialProgress?: { lessons?: Record<string, { status: string }> },
 *   ratedGames?: number,
 *   problemsSolved?: number,
 *   ryuoPlayed?: boolean,
 *   welcomeChoice?: string,
 *   measured?: boolean,
 * }} records
 *   welcomeChoiceは、はじめての案内の答え(beginner・rules・some・player)。measuredは、棋力測定でレーティングを決めたか。
 * @returns {{ steps: { id: string, label: string, number: number, done: boolean, current: boolean }[], current: number }}
 *   currentは、いまの段の番号(1〜5)。
 */
export function homeRoadmap(records = {}) {
  const { tutorialProgress, ratedGames = 0, problemsSolved = 0, ryuoPlayed = false, welcomeChoice = "", measured = false } = records;
  // 答えごとに終えたことにする段(docs/first-play-design.mdの3章): ルールは分かる・少し指せる・よく指しているは駒を覚える段、
  // 少し指せる・よく指しているは測定を終えたら初めての対局の段、よく指しているは詰みの段も。
  const experienced = ["rules", "some", "player"].includes(welcomeChoice);
  const measuredPlayer = (welcomeChoice === "some" || welcomeChoice === "player") && measured;
  const done = [
    passed(tutorialProgress, VOLUME_1_LAST_LESSON) || ratedGames >= ROADMAP_PIECES_GAMES || experienced,
    ratedGames >= 1 || measuredPlayer,
    // よく指している人は、1局指すか棋力を測ったら、詰みの段も終えたことにする(竜王戦へ案内する)。
    passed(tutorialProgress, VOLUME_2_LAST_LESSON) || problemsSolved >= ROADMAP_MATE_PROBLEMS
      || (welcomeChoice === "player" && (ratedGames >= 1 || measured)),
    ryuoPlayed,
    false,
  ];
  // 後の段を終えていれば、前の段も終えたことにする。
  for (let index = done.length - 2; index >= 0; index -= 1) {
    if (done[index + 1]) done[index] = true;
  }
  const currentIndex = done.findIndex((value) => !value);
  const current = currentIndex + 1;
  return {
    current,
    steps: ROADMAP_STEPS.map((step, index) => ({ ...step, number: index + 1, done: done[index], current: index === currentIndex })),
  };
}

/**
 * ホームの入口を薄くするか。入口の段が、いまの段の2つ以上先なら薄くし、「1局指したら」のように添える。鍵はかけない。
 * @param {string} tileId ROADMAP_TILE_STEPSのキー
 * @param {number} current いまの段
 * @returns {{ dim: boolean, recommended: boolean, after: string }}
 */
export function roadmapTile(tileId, current) {
  const step = ROADMAP_TILE_STEPS[tileId];
  if (!step) return { dim: false, recommended: false, after: "" };
  const recommended = step === current || (current === 5 && (tileId === "match" || tileId === "endgame"));
  const dim = step >= current + 2;
  return { dim, recommended, after: dim ? ROADMAP_STEPS[step - 2].after : "" };
}

/** はじめての案内で選んだ道(beginner・rules・some・player・skip)。読めなければ""。 */
export function welcomeChoiceFrom(storage, key) {
  try {
    const value = JSON.parse(storage?.getItem(key) ?? "null");
    return typeof value?.choice === "string" ? value.choice : "";
  } catch {
    return "";
  }
}
