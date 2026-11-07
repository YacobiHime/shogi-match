// 棋士の1年の「分身を育てる」(docs/pro-year-design.mdの14-3の2)。画面に依存しない。
// 分身は8つの能力(player-abilities.mjsのABILITIES)ごとに経験を持ち、経験からLv(1〜10)が決まる。
// 週の行動・仕事・自分で指した対局で経験がたまり、分身に任せる対局と勝負どころの局面に効く(自分で指すときの強さは変えない)。

import { ABILITIES, ABILITY_KEYS, ABILITY_SIM_WEIGHTS } from './player-abilities.mjs';

export const AVATAR_MAX_LEVEL = 10;
/** Lv1つあたりの能力の差(名簿の尺度。Lv10で27)。 */
export const AVATAR_DEV_PER_LEVEL = 3;
/** 重みつきの平均の能力の差を、分身の強さ(レーティング)に直す倍率。全部Lv10で約80。 */
export const AVATAR_RATING_SCALE = 3;

const LABELS = Object.fromEntries(ABILITIES.map(({ key, label }) => [key, label]));
export const avatarLabel = (key) => LABELS[key] ?? key;

/** 何をすると、どの能力に経験が入るか(14-3の2の表)。 */
export const AVATAR_GAINS = Object.freeze({
  research: Object.freeze({ opening: 2 }),
  rest: Object.freeze({ stability: 1 }),
  study: Object.freeze({ reading: 2, idea: 1 }),
  studyWin: Object.freeze({ idea: 1 }),
  festival: Object.freeze({ idea: 1, defense: 1 }),
  gameFull: Object.freeze({ vision: 1, judgment: 1 }),
  gameCut: Object.freeze({ reading: 1 }),
  gameWin: Object.freeze({ attack: 1 }),
});

export const emptyAvatar = () => ({ exp: Object.fromEntries(ABILITY_KEYS.map((key) => [key, 0])) });

/** Lv nになるまでの経験の合計(Lv→Lv+1にLv×4)。 */
const needFor = (level) => 2 * level * (level - 1);

/** 経験からLv。 */
export function avatarLevel(exp) {
  let level = 1;
  while (level < AVATAR_MAX_LEVEL && needFor(level + 1) <= Math.max(0, Number(exp) || 0)) level += 1;
  return level;
}

/** 次のLvまでの残りと、いまのLvの中での進み(0〜1)。Lv10ならnull。 */
export function avatarNext(exp) {
  const value = Math.max(0, Number(exp) || 0);
  const level = avatarLevel(value);
  if (level >= AVATAR_MAX_LEVEL) return null;
  const from = needFor(level);
  const to = needFor(level + 1);
  return { need: to - value, ratio: (value - from) / (to - from) };
}

/** 能力の差(名簿の`character.abilities`と同じ尺度)。 */
export function avatarDevs(avatar) {
  return Object.fromEntries(ABILITY_KEYS.map((key) => [key, (avatarLevel(avatar?.exp?.[key]) - 1) * AVATAR_DEV_PER_LEVEL]));
}

/** 分身の強さの上乗せ(レーティング)。自動対局の重みで平均した能力の差に倍率を掛ける。 */
export function avatarEdge(avatar) {
  const devs = avatarDevs(avatar);
  let sum = 0;
  let weight = 0;
  for (const key of ABILITY_KEYS) {
    // 安定感は自動対局の重みが0なので、ほかの能力と同じ1として数える(育てた分が無駄にならないように)。
    const w = ABILITY_SIM_WEIGHTS[key] || 1;
    sum += w * devs[key];
    weight += w;
  }
  return Math.round((sum / weight) * AVATAR_RATING_SCALE);
}

/**
 * 経験を足す。Lvが上がった能力を返す。
 * @param {{ exp: Record<string, number> } | null | undefined} avatar
 * @param {Record<string, number>} gains
 */
export function gainAvatar(avatar, gains) {
  const next = { exp: { ...emptyAvatar().exp, ...(avatar?.exp ?? {}) } };
  const ups = [];
  for (const [key, amount] of Object.entries(gains ?? {})) {
    if (!ABILITY_KEYS.includes(key) || !(amount > 0)) continue;
    const before = avatarLevel(next.exp[key]);
    next.exp[key] += amount;
    const after = avatarLevel(next.exp[key]);
    if (after > before) ups.push({ key, label: avatarLabel(key), from: before, to: after });
  }
  return { avatar: next, ups };
}

/** 経験を足し合わせる(1つの行動・仕事の伸びをまとめる)。 */
export function mergeGains(...list) {
  const out = {};
  for (const gains of list) for (const [key, amount] of Object.entries(gains ?? {})) out[key] = (out[key] ?? 0) + amount;
  return out;
}

/** 「研究＋2・読み＋1」の言葉。 */
export const gainsText = (gains) => Object.entries(gains ?? {}).filter(([, amount]) => amount > 0).map(([key, amount]) => `${avatarLabel(key)}＋${amount}`).join('・');

/**
 * 分身の札とシートの形。
 * @param {{ exp: Record<string, number> } | null | undefined} avatar
 * @param {Record<string, number>} [weekGains] 今週入った経験
 */
export function avatarView(avatar, weekGains = {}) {
  const rows = ABILITY_KEYS.map((key) => {
    const exp = Math.max(0, Number(avatar?.exp?.[key]) || 0);
    const level = avatarLevel(exp);
    const next = avatarNext(exp);
    const before = avatarLevel(exp - (weekGains[key] ?? 0));
    return { key, label: avatarLabel(key), exp, level, need: next?.need ?? 0, ratio: next ? next.ratio : 1, up: level > before, gain: weekGains[key] ?? 0, before };
  });
  const top = [...rows].sort((a, b) => b.level - a.level || b.exp - a.exp)[0];
  const grew = [...rows].filter((row) => row.gain > 0).sort((a, b) => b.gain - a.gain)[0] ?? null;
  const closest = [...rows].filter((row) => row.level < AVATAR_MAX_LEVEL).sort((a, b) => a.need - b.need)[0] ?? null;
  return { rows, top, grew, closest, edge: avatarEdge(avatar), total: rows.reduce((sum, row) => sum + row.level, 0) };
}
