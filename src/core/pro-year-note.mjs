// やこびノートの「大会」の棋士の1年の札(docs/pro-year-design.mdの12章)。保存(pro-year:v1)をそのまま読み、
// 1年を組み立て直さずに、いまの年度・今年度の成績・順位戦のクラス・タイトル・これまでの年度を出す(ノートを軽く保つ)。

import { PRO_USER_ID as USER_ID, PRO_YEAR_KEY, proEvent } from './pro-year.mjs';

export const PRO_YEAR_NOTE_KEY = PRO_YEAR_KEY;
const CLASS_NAMES = Object.freeze({ A: 'A級', B1: 'B級1組', B2: 'B級2組', C1: 'C級1組', C2: 'C級2組' });

/**
 * 保存の中身から札の形を作る。棋士の1年を始めていなければnull。
 * @param {any} packed
 * @returns {{ fy: number, wins: number, losses: number, cls: string, titles: string[], history: { fy: number, wins: number, losses: number, titles: string[], awards: string[] }[], money: number } | null}
 */
export function proYearNote(packed) {
  if (!packed || packed.version !== 1 || !Number.isFinite(packed.fy)) return null;
  let wins = 0;
  let losses = 0;
  for (const row of Array.isArray(packed.games) ? packed.games : []) {
    // [番号, 期, 段階, 回戦, 先, 後, 日, 勝ち, 印, ...]。印の1は自分の対局。
    if (!Array.isArray(row) || !(row[8] & 1) || !row[7]) continue;
    if (String(row[6] ?? '') < `${packed.fy}-04-01`) continue;
    const winner = row[7] === 1 ? row[4] : row[5];
    if (winner === USER_ID) wins += 1;
    else losses += 1;
  }
  const titles = Object.entries(packed.titles ?? {}).filter(([, holder]) => holder === USER_ID).map(([id]) => proEvent(id)?.short ?? id);
  const history = (Array.isArray(packed.history) ? packed.history : []).filter(Boolean).map((entry) => ({
    fy: entry.fy, wins: entry.wins ?? 0, losses: entry.losses ?? 0, titles: entry.titles ?? [], awards: entry.awards ?? [],
  })).reverse();
  return {
    fy: packed.fy,
    wins,
    losses,
    cls: CLASS_NAMES[packed.user?.cls] ?? '',
    titles,
    history,
    money: Number(packed.user?.money) || 0,
  };
}

/** localStorageから読む(読めなければnull)。 */
export function loadProYearNote(storage) {
  try {
    return proYearNote(JSON.parse(storage?.getItem(PRO_YEAR_NOTE_KEY) ?? 'null'));
  } catch {
    return null;
  }
}
