// 戦型の目録(docs/formation-detect-design.mdの4章、F1)。判定した名前を、演出・コレクションに数える1つの目録にまとめる。
// 作戦カードの目録(collection.mjsのcollectionCatalog)に、作戦カードのない名前(銀冠穴熊・ビッグ4など)を足す。
// 画面・保存に依存しない。
import { FORMATION_META, FORMATION_SAME_NAMES, RANGING_STRATEGY_FAMILIES } from '../data/formation-catalog.mjs';
import { FORMATION_CASTLE_RULES, FORMATION_STRATEGY_RULES } from '../data/formation-rules.mjs';

/** 同じ作戦のもう1つの呼び方。 */
const sameName = (name) => FORMATION_SAME_NAMES.find((pair) => pair.includes(name))?.find((item) => item !== name) ?? '';

/**
 * 名前ごとの決まり。知らない名前はnull。
 * @param {string} name
 * @returns {{ kind: 'castle' | 'strategy', rook: 'static' | 'ranging' | '', family: string, rarity: number, parent: string } | null}
 */
export function formationMeta(name) {
  const text = FORMATION_META[/** @type {keyof typeof FORMATION_META} */ (name)] ?? FORMATION_META[/** @type {keyof typeof FORMATION_META} */ (sameName(name))];
  if (!text) return null;
  const [type, family, rarity, parent = ''] = text.split(' ');
  const castle = type === 'cs' || type === 'cr';
  return {
    kind: castle ? 'castle' : 'strategy',
    rook: type === 'cs' ? 'static' : type === 'cr' ? 'ranging' : '',
    family,
    rarity: Math.max(1, Math.min(5, Number(rarity) || 2)),
    parent,
  };
}

/** 名前の★(1〜5)。目録にない名前は2。 */
export const formationRarity = (name) => formationMeta(name)?.rarity ?? 2;

/**
 * ★を技の演出の段階にする(設計の5章。★1〜2は★、★3〜4は★★、★5は★★★の強さで比べる)。
 * @param {number} rarity
 * @returns {'normal' | 'rare' | 'legend'}
 */
export const wazaTierOfRarity = (rarity) => (rarity >= 5 ? 'legend' : rarity >= 3 ? 'rare' : 'normal');

/** 振り飛車のページの戦法の系統。 */
export const RANGING_FAMILIES = new Set(RANGING_STRATEGY_FAMILIES);

/**
 * 演出・コレクションの目録。作戦カードの目録に★と進化のもとを足し、作戦カードのない名前を後ろに足す(catalogOnly)。
 * @template {{ kind: 'strategy' | 'castle', id: string, label: string, family: string, rook?: 'static' | 'ranging' }} T
 * @param {T[]} planCatalog
 * @returns {(T & { rarity: number, parent: string, catalogOnly?: boolean })[]}
 */
export function formationCatalog(planCatalog) {
  const labels = new Set(planCatalog.map((entry) => entry.label));
  const plans = planCatalog.map((entry) => {
    const meta = formationMeta(entry.label);
    return { ...entry, rarity: meta?.rarity ?? 2, parent: meta?.parent ?? '' };
  });
  const extra = Object.keys(FORMATION_META).filter((name) => !labels.has(name) && !labels.has(sameName(name))).map((name) => {
    const meta = /** @type {NonNullable<ReturnType<typeof formationMeta>>} */ (formationMeta(name));
    return /** @type {any} */ ({
      kind: meta.kind,
      id: `f:${name}`,
      label: name,
      family: meta.kind === 'castle' ? 'castle' : meta.family,
      ...(meta.kind === 'castle' ? { rook: meta.rook } : {}),
      rarity: meta.rarity,
      parent: meta.parent,
      catalogOnly: true,
    });
  });
  return [...plans, ...extra];
}

/**
 * 判定式のうち「全部そろう」部分の駒(SFENの部分の盤)。notの中は見ない。
 * 「どれか1つの形」(anyの中の形)は、駒のいちばん多い形を使う(ミレニアムの2つの形など)。
 */
function allModeSfens(expression) {
  if (!expression || typeof expression !== 'object') return [];
  if (expression.match) return expression.match.mode === 'all' ? [expression.match.sfen] : [];
  if (expression.all) return expression.all.flatMap(allModeSfens);
  if (expression.any) {
    return expression.any.map(allModeSfens).sort((a, b) => b.flatMap(sfenPieces).length - a.flatMap(sfenPieces).length)[0] ?? [];
  }
  return [];
}

/**
 * 規則の具体的さ(形の駒の数)。全部そろう駒と、「このどれかのマスに玉」のような部分(1つと数える)。
 * 定跡補助の完成形(玉のマスも数える)と同じ物差しで比べるため。
 * @param {{ group: string, expression: any }} rule
 */
export function ruleSpecificity(rule) {
  const anyParts = (rule.expression?.all ?? []).filter((part) => part.match?.mode === 'any').length;
  return ruleOwnPieces(rule).length + anyParts;
}

/** 部分のSFENの盤の駒(「77」の形のマスと駒の記号)。 */
function sfenPieces(sfen) {
  const ranks = String(sfen).replace(/^sfen\s+/, '').trim().split(/\s+/)[0].split('/');
  const out = [];
  ranks.forEach((rank, rankIndex) => {
    let file = 9;
    let promoted = false;
    for (const symbol of rank) {
      if (/[1-9]/.test(symbol)) file -= Number(symbol);
      else if (symbol === '+') promoted = true;
      else {
        out.push({ square: `${file}${rankIndex + 1}`, symbol, promoted });
        file -= 1;
        promoted = false;
      }
    }
  });
  return out;
}

/** 盤を180度回したマス(「77」→「33」)。 */
export const mirrorSquare = (square) => `${10 - Number(square[0])}${10 - Number(square[1])}`;

/**
 * 規則の形を作る自分の駒(先手から見たマスと駒の種類。成り駒は「+P」)。後手だけの規則は小文字の駒を回して先手にする。
 * @param {{ group: string, expression: any }} rule
 * @returns {[string, string][]}
 */
export function ruleOwnPieces(rule) {
  const gote = rule.group === 'gote_tac_match';
  const pieces = allModeSfens(rule.expression).flatMap(sfenPieces);
  const own = pieces.filter(({ symbol }) => (gote ? symbol === symbol.toLowerCase() : symbol === symbol.toUpperCase()));
  const seen = new Set();
  const out = [];
  for (const { square, symbol, promoted } of own) {
    const at = gote ? mirrorSquare(square) : square;
    if (seen.has(at)) continue;
    seen.add(at);
    out.push(/** @type {[string, string]} */ ([at, `${promoted ? '+' : ''}${symbol.toUpperCase()}`]));
  }
  return out;
}

/**
 * 名前ごとの形(アルバムのカードの小さな盤。作戦カードのない名前に使う)。同じ名前の規則が2つあれば、駒の多いほう。
 * @param {{ rules: { group: string, name: string, expression: any }[] }} master
 * @returns {Map<string, [string, string][]>}
 */
export function formationShapes(master) {
  const shapes = new Map();
  for (const rule of master?.rules ?? []) {
    const pieces = ruleOwnPieces(rule);
    if ((shapes.get(rule.name)?.length ?? 0) < pieces.length) shapes.set(rule.name, pieces);
  }
  // 自作の規則は、置き換えるものも足すものも、最初の形の駒で描く。
  for (const rule of [...FORMATION_CASTLE_RULES, ...FORMATION_STRATEGY_RULES]) {
    const variant = /** @type {any} */ (rule.variants[0]);
    shapes.set(rule.name, [...variant.own, ...(variant.ownAny ?? []).map((/** @type {string[]} */ group) => group[0])].map(splitCell));
  }
  return shapes;
}

/** 「99K」を、マスと駒の記号に分ける(「11+P」は「+P」)。 */
const splitCell = (cell) => /** @type {[string, string]} */ ([cell.slice(0, 2), cell.slice(2)]);

/** 「99」をUSIのマス(「9i」)に。 */
const usiSquare = (square) => `${square[0]}${String.fromCharCode(96 + Number(square[1]))}`;

/**
 * 自作の囲いの規則の、いま当たっている形の具体的さ(当たらなければ0)。boardはsfen-board.mjsの盤。
 * @param {{ variants: { own: string[], ownAny?: string[][], ownNot?: string[] }[] }} rule
 * @param {Map<string, { color: string, kind: string }>} board
 * @param {'black' | 'white'} color
 */
export function customRuleSpecificity(rule, board, color) {
  const has = (cell) => {
    const [square, kind] = splitCell(cell);
    const at = usiSquare(color === 'white' ? mirrorSquare(square) : square);
    const piece = board.get(at);
    return piece?.color === color && piece.kind === kind;
  };
  let best = 0;
  for (const variant of rule.variants) {
    if (!variant.own.every(has)) continue;
    if (!(variant.ownAny ?? []).every((group) => group.some(has))) continue;
    if ((variant.ownNot ?? []).some(has)) continue;
    best = Math.max(best, variant.own.length + (variant.ownAny ?? []).length);
  }
  return best;
}

/** 自作の囲いの規則。 */
export const CUSTOM_CASTLE_RULES = FORMATION_CASTLE_RULES;

/**
 * いちばん近い進化のもと(1局ですでに組んだ形のうち、進化のもとをたどって最初に見つかるもの)。なければ''。
 * 「高美濃 → 銀冠 進化！」の演出に使う(設計の6-3)。
 * @param {string} name
 * @param {Iterable<string>} formed
 */
export function evolvedFrom(name, formed) {
  const had = new Set(formed);
  const seen = new Set([name]);
  let parent = formationMeta(name)?.parent ?? '';
  while (parent && !seen.has(parent)) {
    if (had.has(parent)) return parent;
    seen.add(parent);
    parent = formationMeta(parent)?.parent ?? '';
  }
  return '';
}

/** 自作の戦法の規則(F3)。 */
export const CUSTOM_STRATEGY_RULES = FORMATION_STRATEGY_RULES;

/**
 * 盤の駒を、その側から見たマスの札(「28R」)の一覧にする。boardはsfen-board.mjsの盤(マスはUSIの「2h」)。
 * 先手は盤のまま、後手は盤を回す(後手の飛車の初めのマス8二は「28R」)。
 * @param {Map<string, { color: string, kind: string }>} board
 * @param {'black' | 'white'} color
 * @returns {string[]}
 */
export function sideCells(board, color) {
  const cells = [];
  for (const [usi, piece] of board) {
    if (piece.color !== color) continue;
    const square = `${usi[0]}${usi.charCodeAt(1) - 96}`;
    cells.push(`${color === 'white' ? mirrorSquare(square) : square}${piece.kind}`);
  }
  return cells;
}

/** 札の一覧(その側から見たマス)を、相手から見たマスに回す。 */
export const turnCells = (cells) => cells.map((cell) => `${mirrorSquare(cell.slice(0, 2))}${cell.slice(2)}`);

/** 振り飛車か(その側から見た飛車の筋が5〜9)。飛車がないか成っていれば''。 */
export function rookStyle(ownCells) {
  const rook = ownCells.find((cell) => cell.slice(2) === 'R');
  if (!rook) return '';
  return Number(rook[0]) >= 5 ? 'ranging' : 'static';
}

/**
 * 自作の戦法の規則に当たるか。
 * @param {typeof FORMATION_STRATEGY_RULES[number]} rule
 * @param {{ own: string[], opp: string[], battle: string, visited: Iterable<string>, ply: number }} context
 *   ownはその側から見た自分の駒、oppはその側から見た相手の駒(sideCellsの相手の結果をturnCellsで回したもの)
 */
export function strategyRuleMatches(rule, { own, opp, battle, visited, ply }) {
  const limit = /** @type {any} */ (rule).maxPly ?? Infinity;
  if (ply > limit) return false;
  if (/** @type {any} */ (rule).battle && /** @type {any} */ (rule).battle !== battle) return false;
  const mine = new Set(own);
  const theirs = new Set(opp);
  const seen = new Set(visited);
  const oppStyle = rookStyle(turnCells(opp));
  return rule.variants.some((/** @type {any} */ variant) => (
    (variant.own ?? []).every((cell) => mine.has(cell))
    && (variant.ownAny ?? []).every((group) => group.some((cell) => mine.has(cell)))
    && !(variant.ownNot ?? []).some((cell) => mine.has(cell))
    && (variant.opp ?? []).every((cell) => theirs.has(cell))
    && (variant.oppAny ?? []).every((group) => group.some((cell) => theirs.has(cell)))
    && (!variant.oppRook || variant.oppRook === oppStyle)
    && (variant.visited ?? []).every((cell) => seen.has(cell))
  ));
}
