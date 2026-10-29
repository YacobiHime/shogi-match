// 棋士の投了の早さ(docs/tournament-relay-design.mdの29章)。観戦の対局(本局と筋書きの中継)で、負けた側がいつ投げるかを決める。
// 人によって違う: 詰みが見えたら潔く投げる人、5手詰めあたりまで指す人、3手詰めまで粘る人、詰みまで指す人。
// 棋士のidから毎回同じに決まる(保存しない)。特徴(劣勢でも崩れない・逆転の名手)があると、粘る側へ寄る。画面に依存しない。

import { HANANE, YOSHIHIKO } from './ryuo-story.mjs';

/**
 * 投了の早さの段。mateは、自分の手を指しても相手に何手詰め(相手の手から数える)が残るなら投げるか(0は詰みまで投げない)。
 * cpは、詰みが読めないまま、最善の値がこれ以下(手番の側から見た点)なら投げる。nullは点では投げない。
 * 順は早い順(粘る特徴で1つずつ後ろへずらす)。
 */
export const RESIGN_STYLES = Object.freeze([
  Object.freeze({ id: 'clean', label: '潔い', note: '詰みが見えたら潔く投げる', mate: 9, cp: -3500 }),
  Object.freeze({ id: 'normal', label: 'ふつう', note: '5手詰めあたりまで指す', mate: 5, cp: -6000 }),
  Object.freeze({ id: 'stubborn', label: '粘る', note: '3手詰めまで粘る', mate: 3, cp: -9000 }),
  Object.freeze({ id: 'full', label: '最後まで指す', note: '詰みまで指す', mate: 0, cp: null }),
]);
const STYLE_BY_ID = new Map(RESIGN_STYLES.map((style) => [style.id, style]));
/** 名簿の棋士の投了の早さの割合(%。早い順)。 */
export const RESIGN_STYLE_SHARES = Object.freeze({ clean: 25, normal: 45, stubborn: 20, full: 10 });
/** 粘る側へ寄せる特徴(1つにつき1段)。 */
const LATE_TRAITS = Object.freeze(['tenacious', 'comeback']);

/** 文字列の種(同じ棋士は、いつも同じ)。 */
function hashOf(text) {
  let hash = 2166136261;
  for (const char of String(text)) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** 投了の早さの段(idから)。知らないidは「ふつう」。 */
export const resignStyleById = (id) => STYLE_BY_ID.get(id) ?? STYLE_BY_ID.get('normal');

/**
 * 棋士の投了の早さ。分身(プレイヤー)は「ふつう」、天鷺善彦は「潔い」(王者らしく)、羽音は「粘る」(負けず嫌い)。
 * ほかの棋士はidから割合どおりに決め、劣勢でも崩れない・逆転の名手の特徴があれば、1段ずつ粘る側へ寄せる。
 * @param {{ id?: string, story?: string | null, character?: { traits?: { id: string }[] } | null } | null | undefined} player
 */
export function resignStyleOf(player) {
  if (!player) return resignStyleById('normal');
  if (player.id === 'user') return resignStyleById('normal');
  if (player.story === YOSHIHIKO) return resignStyleById('clean');
  if (player.story === HANANE) return resignStyleById('stubborn');
  const roll = hashOf(`resign:${player.id ?? ''}`) % 100;
  let index = 0;
  let acc = 0;
  for (const [position, style] of RESIGN_STYLES.entries()) {
    acc += RESIGN_STYLE_SHARES[style.id];
    if (roll < acc) {
      index = position;
      break;
    }
  }
  const late = (player.character?.traits ?? []).filter(({ id }) => LATE_TRAITS.includes(id)).length;
  return RESIGN_STYLES[Math.min(RESIGN_STYLES.length - 1, index + late)];
}

/**
 * 詰みの読み(手番の側から見た、USIの詰みの手数。負なら詰まされる)から、自分の手のあとに残る相手の何手詰めか。詰みでなければnull。
 * 例: 手番の側が「mate -6」なら、自分が1手指したあとに相手の5手詰め。
 * @param {{ type?: string, value?: number } | null | undefined} score
 */
export function matedIn(score) {
  if (score?.type !== 'mate' || !Number.isFinite(score.value) || score.value >= 0) return null;
  return Math.max(1, -score.value - 1);
}

/**
 * 投了の早さの段で、いまの読みなら投げるか。bestは手番の側から見た最善の候補(valueは比べられる値)。
 * 詰みは段の手数以内で投げる。点では、段の値以下を自分の手番で2回続けたら投げる(lastValueは1つ前の自分の手番の値)。
 * @param {ReturnType<typeof resignStyleById>} style
 * @param {{ best: { value: number, score?: any } | null, lastValue?: number | null }} input
 */
export function resignsBy(style, { best, lastValue = null }) {
  if (!best || !style) return false;
  const mate = matedIn(best.score);
  if (mate !== null) return style.mate > 0 && mate <= style.mate;
  if (style.cp === null) return false;
  return best.value <= style.cp && lastValue !== null && lastValue <= style.cp;
}
