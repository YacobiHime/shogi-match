import { OPENING_CASTLES, OPENING_STRATEGIES } from "./opening-guide.mjs";
import { ALL_OPENING_PLANS, OPENING_PLAN_LESSONS } from "./opening-catalog.mjs";

/**
 * 作戦カードの段階的な解放(docs/opening-guide-ux-design.mdの4章)。
 * 新しい保存は増やさず、コレクション(対局で完成させた形)・教室の進み具合・竜王戦の成績・はじめての案内の答え・
 * レーティングから毎回計算する。慣れた人は最初から全部使える(安全網)。画面から独立した純粋な処理にする。
 */

/** 「ぜんぶの作戦を使う」のスイッチ。 */
export const OPENING_PLANS_ALL_KEY = "yacobihime:shogi-match:opening-plans-all:v1";
/** 作戦カードのシートで、もう見た(NEWを外した)作戦。 */
export const OPENING_PLANS_SEEN_KEY = "yacobihime:shogi-match:opening-plans-seen:v1";
/** 応用の段を開く、完成させた基本の作戦の種類の数。 */
export const ADVANCED_UNLOCK_BASIC_PLANS = 2;

const strategyLabel = (id) => OPENING_STRATEGIES.find((entry) => entry.id === id)?.label ?? "";
const castleLabel = (id) => OPENING_CASTLES.find((entry) => entry.id === id)?.label ?? "";

/**
 * 作戦を対局で完成させた回数(コレクションの印)。戦法のカードは戦法の名前、囲いだけのカードと
 * 「矢倉」(居飛車＋金矢倉)のように囲いが主役のカードは囲いの名前で数える。
 * @param {{ id: string, strategyId: string, castles: readonly string[], name?: string }} plan
 * @param {Record<string, { count: number }>} formations コレクションの`formations`
 */
export function planCompletedCount(plan, formations = {}) {
  const label = !plan.strategyId || plan.name ? castleLabel(plan.castles[0]) : strategyLabel(plan.strategyId);
  return label ? formations[label]?.count ?? 0 : 0;
}

function lessonPassed(tutorialProgress, lessonId) {
  const status = tutorialProgress?.lessons?.[lessonId]?.status;
  return status === "cleared" || status === "skipped";
}

/**
 * 使える作戦と、まだ使えない作戦の条件。
 * @param {{
 *   formations?: Record<string, { count: number }>,
 *   tutorialProgress?: { lessons?: Record<string, { status: string }> },
 *   ryuoPlayed?: boolean,
 *   welcomeChoice?: string,
 *   strong?: boolean,
 *   showAll?: boolean,
 *   extraIds?: string[],
 * }} records strongはレーティングが初段相当以上、showAllは「ぜんぶの作戦を使う」、extraIdsは占いで出た作戦など。
 * @returns {{ all: boolean, unlocked: Set<string>, condition: (planId: string) => string }}
 */
export function openingUnlocks(records = {}) {
  const { formations = {}, tutorialProgress, ryuoPlayed = false, welcomeChoice = "", strong = false, showAll = false, extraIds = [] } = records;
  const all = showAll || strong || welcomeChoice === "player";
  const completed = (plan) => planCompletedCount(plan, formations) > 0;
  const entryDone = ALL_OPENING_PLANS.some((plan) => plan.tier === "entry" && completed(plan));
  const basicDone = ALL_OPENING_PLANS.filter((plan) => plan.tier === "basic" && completed(plan)).length;
  const open = {
    entry: true,
    basic: entryDone,
    advanced: basicDone >= ADVANCED_UNLOCK_BASIC_PLANS,
    surprise: ryuoPlayed,
  };
  const unlocked = new Set();
  for (const plan of ALL_OPENING_PLANS) {
    const lesson = OPENING_PLAN_LESSONS[plan.id];
    if (all || open[plan.tier] || completed(plan) || extraIds.includes(plan.id) || (lesson && lessonPassed(tutorialProgress, lesson))) {
      unlocked.add(plan.id);
    }
  }
  const condition = (planId) => {
    if (unlocked.has(planId)) return "";
    const plan = ALL_OPENING_PLANS.find((entry) => entry.id === planId);
    if (!plan) return "";
    const lesson = OPENING_PLAN_LESSONS[plan.id] ? "（教室の第4巻で練習しても使えるよ）" : "";
    if (plan.tier === "basic") return `入門の作戦を、対局で1回完成させると使えるよ${lesson}`;
    if (plan.tier === "advanced") return `基本の作戦を${ADVANCED_UNLOCK_BASIC_PLANS}種類、対局で完成させると使えるよ`;
    if (plan.tier === "surprise") return "竜王戦に出ると使えるよ";
    return "";
  };
  return { all, unlocked, condition };
}

/** 前と後の解放をくらべて、新しく使えるようになった作戦(終局画面で知らせる)。 */
export function newlyUnlockedPlans(before, after) {
  return ALL_OPENING_PLANS.filter((plan) => after.unlocked.has(plan.id) && !before.unlocked.has(plan.id));
}

/**
 * おまかせ。使える作戦から1枚を選ぶ。まだ完成させたことのない作戦を優先し、相手が振り飛車と分かっていれば居飛車の作戦から選ぶ。
 * @param {{ plans: readonly any[], formations?: Record<string, { count: number }>, opponentRanging?: boolean, random?: () => number }} options
 */
export function autoPickPlan({ plans, formations = {}, opponentRanging = false, random = Math.random }) {
  let pool = plans.filter((plan) => plan.group !== "castle" && plan.group !== "surprise");
  if (opponentRanging) {
    const staticPlans = pool.filter((plan) => plan.group === "static");
    if (staticPlans.length) pool = staticPlans;
  }
  if (!pool.length) pool = [...plans];
  if (!pool.length) return null;
  const fresh = pool.filter((plan) => planCompletedCount(plan, formations) === 0);
  const candidates = fresh.length ? fresh : pool;
  // 易しい作戦を少し多めに選ぶ(★1は2倍)。
  const weighted = candidates.flatMap((plan) => (plan.difficulty <= 1 ? [plan, plan] : [plan]));
  return weighted[Math.min(weighted.length - 1, Math.floor(random() * weighted.length))];
}

/** スイッチと、見た作戦の保存。読めない環境でも遊びは止めない。 */
export function loadShowAllPlans(storage) {
  try {
    return storage?.getItem(OPENING_PLANS_ALL_KEY) === "on";
  } catch {
    return false;
  }
}

export function saveShowAllPlans(storage, on) {
  try {
    storage?.setItem(OPENING_PLANS_ALL_KEY, on ? "on" : "off");
  } catch {
    // 保存できない環境では、この画面のあいだだけ有効にする。
  }
}

/** 見た作戦。まだ一度もシートを開いていなければnull(そのときは、いま使える作戦をすべて見たことにする)。 */
export function loadSeenPlans(storage) {
  try {
    const value = JSON.parse(storage?.getItem(OPENING_PLANS_SEEN_KEY) ?? "null");
    return Array.isArray(value) ? new Set(value.filter((id) => typeof id === "string")) : null;
  } catch {
    return null;
  }
}

export function saveSeenPlans(storage, ids) {
  try {
    storage?.setItem(OPENING_PLANS_SEEN_KEY, JSON.stringify([...ids]));
  } catch {
    // 保存できない環境では、NEWの印が次も出るだけ。
  }
}
