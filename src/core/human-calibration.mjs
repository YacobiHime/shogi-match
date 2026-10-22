import { CPU_STRENGTH_PRESETS } from "./strength-settings.mjs";
import { ladderLabelFromOld } from "./level-ladder.mjs";

/*
 * 人間の対局結果から、CPUのレベルの表示名(段級位)のずれを調べる。
 * 入力は、やこびノートの「戦績データをコピー」で取り出したJSON(1人1つ、何人分でもよい)。
 * 申告した段級位ごとに、CPUのレベル別の勝敗を合わせ、勝率がちょうど50%になるLv(θ)を推定する。
 * 表示名どおりなら、θは申告と同じ表示名のLvになる。
 *
 * 勝率のモデルは、レーティングと同じElo式。CPUのLvは1LvあたりR60(2026-10-22の段級位の作り直しから)なので、
 * Lvが約6.7違うと勝ちやすさのオッズが10倍違う: P(勝ち) = 1 / (1 + 10^((Lv − θ) / 6.67))。
 * 作り直しの前の戦績データ(Lv×80)は、やこびノートを開いたときに新しい表へ移したものを出す。
 */
export const LEVELS_PER_TENFOLD_ODDS = 400 / 60;
const LN10 = Math.log(10);

/**
 * 申告の表示名に対応するLv。同じ表示名のLvが複数あるとき(アマ初段など)は、その真ん中。
 * 段級位の作り直し(2026-10-22)の前の名前(「十級」など)も、新しい名前に直して読む。
 */
export function nominalLevel(label) {
  const grade = ladderLabelFromOld(String(label ?? "")).replace(/程度$/, "");
  const levels = CPU_STRENGTH_PRESETS
    .filter((preset) => preset.label.replace(/程度$/, "") === grade)
    .map((preset) => preset.level);
  if (!levels.length) return null;
  return (Math.min(...levels) + Math.max(...levels)) / 2;
}

/** 戦績データ(複数可)を、申告ごと・Lvごとの勝敗にまとめる。引き分けは0.5勝0.5敗に数える。 */
export function aggregateDeclaredResults(exports) {
  const byLabel = new Map();
  for (const data of exports) {
    for (const [label, tally] of Object.entries(data?.declaredLevels ?? {})) {
      const levels = byLabel.get(label) ?? new Map();
      for (const [levelKey, entry] of Object.entries(tally ?? {})) {
        const level = Number(levelKey);
        if (!Number.isFinite(level)) continue;
        const wins = Number(entry?.wins) || 0;
        const losses = Number(entry?.losses) || 0;
        const draws = Number(entry?.draws) || 0;
        if (wins + losses + draws <= 0) continue;
        const current = levels.get(level) ?? { level, wins: 0, losses: 0, draws: 0 };
        current.wins += wins;
        current.losses += losses;
        current.draws += draws;
        levels.set(level, current);
      }
      if (levels.size) byLabel.set(label, levels);
    }
  }
  return [...byLabel].map(([label, levels]) => ({
    label,
    levels: [...levels.values()].sort((a, b) => a.level - b.level),
  }));
}

function winProbability(level, theta) {
  return 1 / (1 + 10 ** ((level - theta) / LEVELS_PER_TENFOLD_ODDS));
}

/**
 * 勝率50%のLv(θ)の最尤推定と、その標準誤差。
 * 全勝・全敗のときは推定が無限に逃げるので、範囲の端(minLevel・maxLevel)で止め、bounded: trueを返す。
 */
export function estimateEvenLevel(levels, { minLevel = -10, maxLevel = 50 } = {}) {
  const rows = levels.map(({ level, wins, losses, draws }) => ({
    level, score: wins + draws / 2, games: wins + losses + draws,
  }));
  const games = rows.reduce((sum, row) => sum + row.games, 0);
  if (!games) return null;
  // 対数尤度の微分(θについて)は単調に減るので、二分法で0になるθを探す。
  const gradient = (theta) => rows.reduce((sum, { level, score, games: n }) => sum + (score - n * winProbability(level, theta)), 0);
  let low = minLevel;
  let high = maxLevel;
  let bounded = false;
  if (gradient(low) <= 0) {
    high = low;
    bounded = true;
  } else if (gradient(high) >= 0) {
    low = high;
    bounded = true;
  } else {
    for (let step = 0; step < 80; step += 1) {
      const mid = (low + high) / 2;
      if (gradient(mid) > 0) low = mid;
      else high = mid;
    }
  }
  const theta = (low + high) / 2;
  const k = LN10 / LEVELS_PER_TENFOLD_ODDS;
  const information = rows.reduce((sum, { level, games: n }) => {
    const p = winProbability(level, theta);
    return sum + n * k * k * p * (1 - p);
  }, 0);
  const standardError = information > 0 ? 1 / Math.sqrt(information) : Infinity;
  return { theta, standardError, games, bounded };
}

/**
 * 申告ごとの報告。offsetは「勝率50%のLv − 表示名のLv」。
 * 正なら、その段級位の人には表示名より上のLvが互角(表示名のLvは表示より弱い)。
 * 負なら、表示名のLvは表示より強い。
 * 対局数がminGamesに満たないときや、差が誤差の2倍以内のときは「判断できない」とする。
 */
export function calibrationReport(exports, { minGames = 20 } = {}) {
  return aggregateDeclaredResults(exports)
    .map(({ label, levels }) => {
      const nominal = nominalLevel(label);
      const estimate = estimateEvenLevel(levels);
      const offset = estimate && nominal !== null ? estimate.theta - nominal : null;
      let verdict = "判断できない";
      if (estimate && offset !== null && estimate.games >= minGames && !estimate.bounded) {
        if (Math.abs(offset) <= 2 * estimate.standardError) verdict = "表示名どおり";
        else verdict = offset > 0 ? "表示名より弱い" : "表示名より強い";
      }
      return { label, nominal, levels, ...(estimate ?? { theta: null, standardError: null, games: 0, bounded: false }), offset, verdict };
    })
    .sort((a, b) => (a.nominal ?? 99) - (b.nominal ?? 99));
}

/** 報告をMarkdownの表にする。 */
export function formatCalibrationReport(report) {
  const fixed = (value, digits = 1) => (Number.isFinite(value) ? value.toFixed(digits) : "-");
  const lines = [
    "| 申告 | 表示名のLv | 対局数 | 勝率50%のLv | 誤差(±1σ) | 差 | 判定 |",
    "| --- | ---: | ---: | ---: | ---: | ---: | --- |",
  ];
  for (const row of report) {
    const theta = row.bounded ? `${row.theta <= 0 ? "≦" : "≧"}${fixed(row.theta)}` : fixed(row.theta);
    const offset = Number.isFinite(row.offset) ? `${row.offset >= 0 ? "+" : ""}${fixed(row.offset)}` : "-";
    lines.push(`| ${row.label} | ${fixed(row.nominal)} | ${row.games} | ${theta} | ${fixed(row.standardError)} | ${offset} | ${row.verdict} |`);
  }
  return lines.join("\n");
}
