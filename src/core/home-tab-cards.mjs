// ホームのまなぶ・しらべるの札の言葉(docs/home-roadmap-design.mdの8章、案A 進み具合の札)。
// 数はhome-tab-stats.mjs(タブを開いたときに遅れて読む)が数える。数がまだないときと記録がないときは、何ができるかを1行で言う(0を並べない)。
// 画面に依存しない。

/** 今週の判子の曜日(月曜はじまり。brain-habit.mjsと同じ)。 */
export const WEEK_LABELS = Object.freeze(["月", "火", "水", "木", "金", "土", "日"]);

/** 数がまだないときの1行。 */
export const HOME_TAB_FALLBACK = Object.freeze({
  tutorial: "駒の動きから、ひとつずつ覚えよう",
  problems: "詰将棋と練習問題を解こう",
  brain: "計算力と記憶力を鍛えよう",
  piece: "8種の動きと成り",
  tesuji: "うまい指し方を調べよう",
  opening: "戦法と囲いの手順",
  world: "タイトル・名局・棋士",
  glossary: "将棋のことばを調べよう",
  research: "好きな局面をAIと調べよう",
});

/**
 * 割合(0〜1)。合計が0なら0。
 * @param {number} done
 * @param {number} total
 */
const ratio = (done, total) => (total > 0 ? Math.max(0, Math.min(1, done / total)) : 0);

/**
 * まなぶの3枚の中身。
 * @param {ReturnType<typeof import("./home-tab-stats.mjs").homeTabStats> | null} stats
 * @returns {{
 *   tutorial: { line: string, bar: { ratio: number, text: string } | null, chips: string[] },
 *   problems: { line: string, bar: { ratio: number, text: string } | null, chips: string[] },
 *   brain: { line: string, week: { label: string, on: boolean, today: boolean }[] | null, weekText: string },
 * }}
 */
export function learnCards(stats) {
  if (!stats) {
    return {
      tutorial: { line: HOME_TAB_FALLBACK.tutorial, bar: null, chips: [] },
      problems: { line: HOME_TAB_FALLBACK.problems, bar: null, chips: [] },
      brain: { line: HOME_TAB_FALLBACK.brain, week: null, weekText: "" },
    };
  }
  const { tutorial, problems, brain } = stats;
  const started = tutorial.done > 0;
  const next = tutorial.next;
  const tutorialLine = !next
    ? "じっくり基礎を全部終えた！"
    : started
      ? `つぎは 第${next.volume}巻${next.chapter}章「${next.title}」`
      : `はじめは「${next.title}」から`;
  const tutorialChips = [];
  if (tutorial.tips > 0) tutorialChips.push(`コツ ${tutorial.tips}/${tutorial.tipsTotal}`);
  if (tutorial.gold > 0) tutorialChips.push(`金メダル ${tutorial.gold}`);
  const problemsChips = problems.review > 0 ? [`あなたの対局 ${problems.review}問`] : [];
  const brainWeek = brain.strip.map((cell, index) => ({ label: cell.weekday ?? WEEK_LABELS[index], on: cell.on, today: cell.today }));
  const brainLine = brain.pick === "calc" ? "今日は 計算力の部屋" : brain.pick === "memory" ? "今日は 記憶力の部屋" : brain.days > 0 ? "今日の稽古はおしまい" : HOME_TAB_FALLBACK.brain;
  return {
    tutorial: {
      line: tutorialLine,
      bar: started ? { ratio: ratio(tutorial.done, tutorial.total), text: `${tutorial.done}/${tutorial.total}` } : null,
      chips: tutorialChips,
    },
    problems: {
      line: problems.solved > 0 ? `解いた問題 ${problems.solved}問` : HOME_TAB_FALLBACK.problems,
      bar: problems.solved > 0 ? { ratio: ratio(problems.solved, problems.total), text: `${problems.solved}/${problems.total}` } : null,
      chips: problemsChips,
    },
    brain: { line: brainLine, week: brainWeek, weekText: brain.days > 0 ? `今週 ${brain.days}日` : "" },
  };
}

/**
 * しらべるの6枚の1行(キーは図鑑の種類と research)。
 * @param {ReturnType<typeof import("./home-tab-stats.mjs").homeTabStats> | null} stats
 * @returns {Record<"piece" | "tesuji" | "opening" | "world" | "glossary" | "research", string>}
 */
export function dexLines(stats) {
  const dex = stats?.dex;
  return {
    piece: HOME_TAB_FALLBACK.piece,
    tesuji: dex && dex.tesuji > 0 ? `使った手筋 ${dex.tesuji}/${dex.tesujiTotal}` : HOME_TAB_FALLBACK.tesuji,
    opening: dex && dex.formations > 0 ? `組んだ戦法・囲い ${dex.formations}種` : HOME_TAB_FALLBACK.opening,
    world: HOME_TAB_FALLBACK.world,
    glossary: dex ? `将棋のことば ${dex.glossary}語` : HOME_TAB_FALLBACK.glossary,
    research: dex && dex.research > 0 ? `研究帳 ${dex.research}局` : HOME_TAB_FALLBACK.research,
  };
}
