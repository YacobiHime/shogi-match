/**
 * 技の演出(docs/move-waza-design.md)。手筋・囲い・戦法を使った手に、名前と段階(★)を付ける。画面に依存しない。
 * 手筋の判定は、今の2つ(コレクションの detectTesuji と棋力テストの detectTesujiShape)をまとめ、垂れ歩と尻金を足す。
 * 盤の形だけで決める(良い手かどうかは見ない。名前を覚えるのが目的。4-1)。
 * 自分の手筋はこの目録のIDでコレクションの手筋の印にする(4-3)。
 */
import { detectTesuji, TESUJI_HINTS, TESUJI_NAMES } from './move-tesuji.mjs';
import { detectTesujiShape, TESUJI_SHAPES } from './tesuji-shape.mjs';
import {
  applyUsiToBoard,
  attackersOf,
  findKing,
  opponentOf,
  parseSfenState,
  relativeRank,
  squareXY,
  xySquare,
} from './piece-movement.mjs';

/** 演出の切り替え(表示補助の「技の演出」。"on"・"off"。設定なのでデータリセットでは消さない)。 */
export const WAZA_EFFECT_KEY = 'yacobihime:shogi-match:waza-effect:v1';

/** 段階(★の数)。normalは銀色、rareは金色、legendは虹色。 */
export const WAZA_TIERS = Object.freeze({
  normal: Object.freeze({ stars: 1, rank: 0 }),
  rare: Object.freeze({ stars: 2, rank: 1 }),
  legend: Object.freeze({ stars: 3, rank: 2 }),
});

/** 種類の名前(帯の左上)。 */
export const WAZA_KIND_LABELS = Object.freeze({ tesuji: '手筋', castle: '囲い', strategy: '戦法' });

const shapeHint = (id) => TESUJI_SHAPES.find((shape) => shape.id === id)?.hint ?? '';
const tesuji = (id, name, tier, hint) => Object.freeze({ id, name, tier, hint });

/**
 * 手筋の目録(コレクションの手筋のページの並び)。はじめの9つは今までのコレクションの手筋(IDと名前は同じ)。
 * hintは、はじめて指したときに終局画面でやこび姫が添える一言。
 */
export const WAZA_TESUJI = Object.freeze([
  tesuji('head-gold', TESUJI_NAMES['head-gold'], 'rare', TESUJI_HINTS['head-gold']),
  tesuji('double-check', TESUJI_NAMES['double-check'], 'legend', TESUJI_HINTS['double-check']),
  tesuji('knight-fork', TESUJI_NAMES['knight-fork'], 'rare', TESUJI_HINTS['knight-fork']),
  tesuji('knight-check', TESUJI_NAMES['knight-check'], 'normal', TESUJI_HINTS['knight-check']),
  tesuji('rook-cross-fork', TESUJI_NAMES['rook-cross-fork'], 'rare', TESUJI_HINTS['rook-cross-fork']),
  tesuji('belly-silver', TESUJI_NAMES['belly-silver'], 'rare', TESUJI_HINTS['belly-silver']),
  tesuji('tapping-pawn', TESUJI_NAMES['tapping-pawn'], 'normal', TESUJI_HINTS['tapping-pawn']),
  tesuji('gold-bottom-pawn', TESUJI_NAMES['gold-bottom-pawn'], 'normal', TESUJI_HINTS['gold-bottom-pawn']),
  tesuji('tokin-on-53', TESUJI_NAMES['tokin-on-53'], 'normal', TESUJI_HINTS['tokin-on-53']),
  tesuji('waruuchi', '割り打ちの銀', 'rare', shapeHint('waruuchi')),
  tesuji('ote-bisha', '王手飛車', 'legend', shapeHint('ote-bisha')),
  tesuji('ryodori', '両取り', 'normal', shapeHint('ryodori')),
  tesuji('dengaku', '田楽刺し', 'rare', shapeHint('dengaku')),
  tesuji('focal-pawn', '焦点の歩', 'normal', shapeHint('focal-pawn')),
  tesuji('edge-king-edge-pawn', '端玉には端歩', 'normal', shapeHint('edge-king-edge-pawn')),
  tesuji('one-gap-dragon', '一間竜', 'rare', shapeHint('one-gap-dragon')),
  tesuji('tare-fu', '垂れ歩', 'normal', '相手の陣の1つ手前に歩を打って、次にと金を作るねらいだよ！'),
  tesuji('shiri-kin', '尻金', 'rare', '玉の真後ろに金を打って、玉を前へ追い出す手筋だよ！'),
]);
/** 手筋のIDから名前(コレクションに渡す)。 */
export const WAZA_TESUJI_NAMES = Object.freeze(Object.fromEntries(WAZA_TESUJI.map(({ id, name }) => [id, name])));
/** 手筋のIDから、はじめての一言。 */
export const WAZA_TESUJI_HINTS = Object.freeze(Object.fromEntries(WAZA_TESUJI.map(({ id, hint }) => [id, hint])));
const tesujiEntry = (id) => WAZA_TESUJI.find((entry) => entry.id === id) ?? null;

/** 堅い囲い・名のある戦法(★★)。ほかの囲いと戦法は★。 */
const RARE_FORMATIONS = new Set([
  '振り飛車穴熊', '居飛車穴熊', '松尾流穴熊', 'ミレニアム', 'ダイヤモンド美濃', '振り飛車銀冠', '天守閣美濃', '菊水矢倉',
  '藤井システム', '森下システム', '雀刺し', '角換わり4五桂速攻', 'ゴキゲン中飛車', '横歩取り青野流',
]);

/** 指した側から見て、そのマスのsteps歩前。 */
function ahead(square, color, steps = 1) {
  const { x, y } = squareXY(square);
  return xySquare(x, y + (color === 'black' ? -steps : steps));
}

/** 垂れ歩と尻金(4-1の1)。 */
function extraTesuji(after, moved, mover) {
  const enemy = opponentOf(mover);
  const found = [];
  if (moved.drop === 'P' && relativeRank(moved.to, mover) === 4) {
    const front = ahead(moved.to, mover);
    const blocked = front ? after.get(front) : null;
    const safe = !attackersOf(after, moved.to, enemy).length || attackersOf(after, moved.to, mover).length > 0;
    if (!(blocked && blocked.color === enemy) && safe) found.push({ id: 'tare-fu', targets: front ? [front] : [] });
  }
  const king = findKing(after, enemy);
  if (moved.drop === 'G' && king && ahead(king, mover) === moved.to) found.push({ id: 'shiri-kin', targets: [king] });
  return found;
}

/** 段階の高い順(同じ段階なら目録の順)。 */
const byPriority = (x, y) => WAZA_TIERS[y.tier].rank - WAZA_TIERS[x.tier].rank;

/**
 * 指した手の手筋。段階の高い順。targetsは、ねらった駒などのマス(赤い輪)。
 * 詰ませた手は checkmate を真にする(頭金はそのときだけ)。
 * @param {{ sfenBefore: string, usi: string, checkmate?: boolean }} move
 * @returns {{ kind: 'tesuji', id: string, name: string, tier: 'normal' | 'rare' | 'legend', to: string, targets: string[] }[]}
 */
export function detectWazaTesuji({ sfenBefore, usi, checkmate = false }) {
  const { board, turn: mover } = parseSfenState(sfenBefore);
  const applied = applyUsiToBoard(board, usi, mover);
  if (!applied) return [];
  const { board: after, moved } = applied;
  /** @type {Map<string, string[]>} */
  const found = new Map();
  const shape = detectTesujiShape({ sfenBefore, usi });
  if (shape) found.set(shape.id, shape.targets);
  for (const id of detectTesuji({ sfenBefore, usi, checkmate })) if (!found.has(id)) found.set(id, []);
  for (const entry of extraTesuji(after, moved, mover)) if (!found.has(entry.id)) found.set(entry.id, entry.targets);
  return WAZA_TESUJI
    .filter(({ id }) => found.has(id))
    .map((entry) => ({ kind: /** @type {const} */ ('tesuji'), id: entry.id, name: entry.name, tier: /** @type {'normal' | 'rare' | 'legend'} */ (entry.tier), to: moved.to, targets: found.get(entry.id) ?? [] }))
    .sort(byPriority);
}

/**
 * その手で新しく付いた囲い・戦法の名前(形の判定の名前の前とあと)。
 * @param {{ before: Iterable<string>, after: Iterable<string>, castles: Set<string>, strategies: Set<string> }} names
 * @returns {{ kind: 'castle' | 'strategy', id: string, name: string, tier: 'normal' | 'rare' | 'legend', to: string, targets: string[] }[]}
 */
export function formationWaza({ before, after, castles, strategies }) {
  const had = new Set(before);
  const out = [];
  for (const name of after) {
    if (had.has(name)) continue;
    const kind = castles.has(name) ? 'castle' : strategies.has(name) ? 'strategy' : null;
    if (!kind) continue;
    out.push({ kind: /** @type {'castle' | 'strategy'} */ (kind), id: name, name, tier: /** @type {'normal' | 'rare'} */ (RARE_FORMATIONS.has(name) ? 'rare' : 'normal'), to: '', targets: [] });
  }
  return out.sort(byPriority);
}

const KIND_ORDER = Object.freeze({ tesuji: 0, castle: 1, strategy: 2 });

/**
 * 1つの手に出す技を1つ選ぶ(段階の高いもの → 手筋 → 囲い → 戦法。4-1の5)。なければnull。
 * @template {{ kind: 'tesuji' | 'castle' | 'strategy', tier: 'normal' | 'rare' | 'legend' }} T
 * @param {T[]} list
 * @returns {T | null}
 */
export function pickWaza(list) {
  return [...list].sort((x, y) => byPriority(x, y) || KIND_ORDER[x.kind] - KIND_ORDER[y.kind])[0] ?? null;
}

/** 帯を出す長さ(ミリ秒)。U:6の1.5秒以内。smallは相手の技と、1局で2回目からの技。 */
export const WAZA_MS = Object.freeze({ normal: 1200, rare: 1350, legend: 1500, small: 900 });
/** はじめての技は少し長く(上限は1.5秒)。 */
export const WAZA_FIRST_EXTRA_MS = 200;
/** CPUの応手を待たせる長さ(自分の大きな帯のときだけ。4-2の7)。 */
export const WAZA_HOLD_MS = Object.freeze({ normal: 500, rare: 700, legend: 900 });

/**
 * 帯の見せ方(4-2)。mineは自分の技、repeatは同じ対局で同じ側が前にも使った技、firstはコレクションにまだない技、
 * tipは同じ手で教室のコツの形ができたか。
 * @param {{ kind: 'tesuji' | 'castle' | 'strategy', name: string, tier: 'normal' | 'rare' | 'legend' }} waza
 * @param {{ mine: boolean, repeat?: boolean, first?: boolean, tip?: boolean }} options
 */
export function wazaPresentation(waza, { mine, repeat = false, first = false, tip = false }) {
  const big = mine && !repeat;
  const kindLabel = WAZA_KIND_LABELS[waza.kind];
  const ms = big ? Math.min(WAZA_MS.legend, WAZA_MS[waza.tier] + (first ? WAZA_FIRST_EXTRA_MS : 0)) : WAZA_MS.small;
  return {
    size: /** @type {'big' | 'small'} */ (big ? 'big' : 'small'),
    mine,
    kind: waza.kind,
    kindLabel: mine ? kindLabel : `相手の${kindLabel}`,
    name: waza.name,
    // 囲いは「完成」を添える(今までの札と同じ言い方)。
    suffix: waza.kind === 'castle' ? '完成' : '',
    tier: waza.tier,
    stars: WAZA_TIERS[waza.tier].stars,
    badge: mine && first ? 'はじめて！' : mine && tip ? 'コツどおり！' : '',
    ms,
    holdMs: big ? WAZA_HOLD_MS[waza.tier] : 0,
  };
}

/**
 * 段階ごとの上がる音(4-4)。atは鳴らし始め(ミリ秒)、freqはHz。相手の技は低い2音を小さく。
 * @param {'normal' | 'rare' | 'legend'} tier
 * @param {{ mine: boolean }} options
 * @returns {{ freq: number, at: number, ms: number, gain: number, wave: 'sine' | 'triangle' }[]}
 */
export function wazaChime(tier, { mine }) {
  if (!mine) return [{ freq: 392, at: 0, ms: 80, gain: 0.05, wave: 'triangle' }, { freq: 523.25, at: 70, ms: 110, gain: 0.05, wave: 'triangle' }];
  const notes = {
    normal: [659.25, 880],
    rare: [523.25, 659.25, 783.99],
    legend: [523.25, 659.25, 783.99, 1046.5],
  }[tier];
  const step = tier === 'legend' ? 65 : 75;
  const plan = notes.map((freq, index) => ({ freq, at: index * step, ms: index === notes.length - 1 ? 160 : 90, gain: 0.09, wave: /** @type {const} */ ('triangle') }));
  if (tier === 'legend') plan.push({ freq: 2093, at: notes.length * step, ms: 140, gain: 0.04, wave: 'sine' });
  return plan;
}

/** 1つの対局で、側ごとに出した技(2回目からは小さく。4-2の3)。 */
export function wazaRepeatKey(side, waza) {
  return `${side}:${waza.kind}:${waza.id}`;
}
