import {
  detectHiraganaSuishoFormations,
  invertHiraganaSuishoSfen,
} from './hiragana-suisho-formations.mjs';
import {
  bishopExchangeState,
  mirrorUsiMove,
  OPENING_CASTLES,
  OPENING_STRATEGIES,
} from './opening-guide.mjs';
import { parseSfenBoard } from './sfen-board.mjs';
import { ruleSpecificity } from './formation-catalog.mjs';

/** 戦法の名前を新しく付けるのは、この手数まで(docs/formation-detect-design.mdの7-2。終盤に急に戦法が付かない)。 */
export const STRATEGY_PLY_LIMIT = 60;
/** 囲いを「組んだ」と数えるのは、この手数まで。 */
export const CASTLE_PLY_LIMIT = 100;

function withTurn(sfen, turn) {
  const fields = String(sfen).replace(/^sfen\s+/, '').trim().split(/\s+/);
  if (fields.length !== 4) throw new Error('SFENは4フィールドにしてください');
  fields[1] = turn;
  return fields.join(' ');
}

function namesByGroup(rules, groups) {
  const allowed = new Set(groups);
  return rules.filter((rule) => allowed.has(rule.group)).map((rule) => rule.name);
}

function firstByGroup(rules, group) {
  return rules.find((rule) => rule.group === group)?.name ?? '';
}

function completionVariants(definition) {
  if (definition.completionVariants?.length) return definition.completionVariants;
  return definition.completionSquares?.length ? [definition.completionSquares] : [];
}

/** 補助が完成扱いにする形を、戦型表示でも同じ基準で拾う。 */
function matchesGuideCompletion(definition, board, color, sfen) {
  if (definition.completionRequiresBishopExchange
    && bishopExchangeState(sfen, color) !== 'exchanged') return false;
  return completionVariants(definition).some((squares) => (
    (squares.length >= 2 || definition.id === 'yokofudori')
    && squares.every(([blackSquare, kind]) => {
    const square = color === 'white' ? mirrorUsiMove(blackSquare) : blackSquare;
    const piece = board.get(square);
    return piece?.color === color && piece.kind === kind;
    })
  ));
}

function mostSpecificGuideMatch(definitions, board, color, sfen) {
  return definitions
    .filter((definition) => matchesGuideCompletion(definition, board, color, sfen))
    .sort((left, right) => (
      Math.max(...completionVariants(right).map((squares) => squares.length))
      - Math.max(...completionVariants(left).map((squares) => squares.length))
    ))[0];
}

/** 完成形のうち、いま当たっている形の駒の数のいちばん多いもの(具体的さ)。 */
function guideSpecificity(definition, board, color) {
  return Math.max(0, ...completionVariants(definition)
    .filter((squares) => squares.every(([blackSquare, kind]) => {
      const piece = board.get(color === 'white' ? mirrorUsiMove(blackSquare) : blackSquare);
      return piece?.color === color && piece.kind === kind;
    }))
    .map((squares) => squares.length));
}

/**
 * いまの囲い。定跡補助の完成形とひらがなすいしょうの囲いのうち、形の駒のいちばん多いもの(7-4 いちばん具体的なもの)。
 * 同じ数なら定跡補助の形(作戦カードの名前)、次に規則の並びの順。
 * 前は定跡補助の形をいつも先に選んでいたので、数マスしか見ない補助の形が、もっと詳しい形(銀冠穴熊など)を隠すことがあった。
 */
function bestCastleName(board, color, sfen, rules) {
  const guide = OPENING_CASTLES
    .filter((definition) => matchesGuideCompletion(definition, board, color, sfen))
    .map((definition) => ({ name: definition.label, spec: guideSpecificity(definition, board, color), order: 0 }));
  const hs = rules
    .filter((rule) => rule.group === 'enc_match')
    .map((rule, index) => ({ name: rule.name, spec: ruleSpecificity(rule), order: index + 1 }));
  return [...guide, ...hs].sort((a, b) => b.spec - a.spec || a.order - b.order)[0]?.name ?? '';
}

function guideTacticNames(board, color, sfen) {
  return OPENING_STRATEGIES
    .filter((definition) => definition.id !== 'yokofudori')
    .filter((definition) => matchesGuideCompletion(definition, board, color, sfen))
    .map((definition) => definition.label);
}

function guideBattleName(board, sfen) {
  const blackYokofudori = mostSpecificGuideMatch(
    OPENING_STRATEGIES.filter((definition) => definition.id === 'yokofudori'),
    board,
    'black', sfen,
  );
  const whiteYokofudori = mostSpecificGuideMatch(
    OPENING_STRATEGIES.filter((definition) => definition.id === 'yokofudori'),
    board,
    'white', sfen,
  );
  return blackYokofudori || whiteYokofudori ? '横歩取り' : '';
}

// 具体的な派生戦型が判定されたときに、同時表示しない一般名。
// 棒銀など複数の戦型で現れる作戦は、誤って親子扱いしない。
const FORMATION_PARENTS_BY_SPECIFIC = new Map([
  ['鬼殺し', ['三間飛車', '早石田']],
  ['新鬼殺し', ['三間飛車', '石田流', '早石田']],
  ['ゴキゲン中飛車', ['中飛車']],
  ['端角中飛車', ['中飛車']],
  ['ノーマル四間飛車', ['四間飛車']],
  ['藤井システム', ['四間飛車', 'ノーマル四間飛車']],
  ['角交換四間飛車', ['四間飛車']],
  ['やばボーズ流', ['四間飛車', '角交換四間飛車']],
  ['立石流四間飛車', ['四間飛車']],
  ['ノーマル三間飛車', ['三間飛車']],
  ['角交換三間飛車', ['三間飛車']],
  ['石田流', ['三間飛車']],
  ['早石田', ['三間飛車']],
  ['7八飛戦法', ['三間飛車']],
  ['2手目3二飛戦法', ['三間飛車']],
  ['ダイレクト向かい飛車', ['向かい飛車']],
  ['メリケン向かい飛車', ['向かい飛車']],
  ['阪田流向かい飛車', ['向かい飛車']],
  ['菜々河流向かい飛車', ['向かい飛車']],
  ['天彦流向かい飛車', ['向かい飛車']],
  ['一手損角換わり', ['角換わり']],
  ['角換わり29手目基本図', ['角換わり']],
  ['角換わり37手目基本図', ['角換わり']],
  ['4五桂速攻', ['角換わり']],
  ['横歩取り青野流', ['横歩取り']],
  ['横歩取り3三角型', ['横歩取り']],
  ['横歩取り勇気流', ['横歩取り']],
  ['横歩取り2三歩戦法', ['横歩取り']],
  ['横歩取り3三角戦法', ['横歩取り']],
  ['横歩取り3三桂戦法', ['横歩取り']],
  ['相横歩取り', ['横歩取り']],
  ['横歩取り4五角戦法', ['横歩取り']],
  ['横歩取り8五飛戦法', ['横歩取り']],
  ['AlphaZero流相掛かり', ['相掛かり']],
  ['6二金・8一飛車型', ['相掛かり']],
  ['相掛かり横歩取らせ', ['相掛かり']],
  ['菱矢倉', ['矢倉']],
  ['総矢倉', ['矢倉']],
  ['金矢倉', ['矢倉']],
  ['銀矢倉', ['矢倉']],
  ['菊水矢倉', ['矢倉']],
  ['土居矢倉', ['矢倉']],
  ['天野矢倉', ['矢倉']],
  ['銀立ち矢倉', ['矢倉']],
  ['右矢倉', ['矢倉']],
  ['シン・パックマン', ['パックマン']],
]);

/**
 * 戦型の名前(ひらがなすいしょうの形の名前)を、コレクションの目録(作戦カード)の名前へ寄せる(docs/player-world-note-design.mdの9章)。
 * 目録にない呼び方(「棒銀」「矢倉」「四間飛車」など)で見つかると、コレクション・使用率・分身の得意戦法に入らなかったため。
 */
export const FORMATION_LABEL_ALIASES = Object.freeze(new Map([
  ['棒銀', '原始棒銀'],
  ['矢倉', '矢倉戦法'],
  ['一手損角換わり', '角換わり'],
  ['角換わり29手目基本図', '角換わり'],
  ['角換わり37手目基本図', '角換わり'],
  ['4八金・2九飛車型', '角換わり'],
  ['4五桂速攻', '角換わり4五桂速攻'],
  ['横歩取り勇気流', '横歩取り'],
  ['横歩取り2三歩戦法', '横歩取り'],
  ['横歩取り3三角戦法', '横歩取り3三角型'],
  ['横歩取り3三桂戦法', '横歩取り'],
  ['相横歩取り', '横歩取り'],
  ['横歩取り4五角戦法', '横歩取り'],
  ['横歩取り8五飛戦法', '横歩取り'],
  ['AlphaZero流相掛かり', '相掛かり'],
  ['6二金・8一飛車型', '相掛かり'],
  ['相掛かり横歩取らせ', '相掛かり'],
  ['対矢倉右桂速攻', '矢倉戦法'],
  ['四間飛車', 'ノーマル四間飛車'],
  ['角交換四間飛車', 'ノーマル四間飛車'],
  ['立石流四間飛車', 'ノーマル四間飛車'],
  ['三間飛車', 'ノーマル三間飛車'],
  ['角交換三間飛車', 'ノーマル三間飛車'],
  ['石田流', '早石田'],
  ['向かい飛車', 'ノーマル向かい飛車'],
  ['ダイレクト向かい飛車', 'ノーマル向かい飛車'],
  ['メリケン向かい飛車', 'ノーマル向かい飛車'],
  ['阪田流向かい飛車', 'ノーマル向かい飛車'],
  ['菜々河流向かい飛車', 'ノーマル向かい飛車'],
  ['天彦流向かい飛車', 'ノーマル向かい飛車'],
  ['中飛車', '原始中飛車'],
  ['鬼殺し', '原始鬼殺し'],
  ['角頭歩', '角頭歩戦法'],
  ['シン・パックマン', 'パックマン'],
  ['振り飛車ミレニアム', 'ミレニアム'],
  ['銀冠', '振り飛車銀冠'],
]));

/**
 * 1局で見つかった戦型の名前を、コレクション・使用率に数える名前にする。目録の呼び方へ寄せた名前と、
 * くわしい名前に隠れた親の名前(「一手損角換わり」の「角換わり」)も足す。目録にない名前はそのまま残す(数える側が捨てる)。
 * @param {Iterable<string>} names
 * @returns {string[]}
 */
export function collectionFormationNames(names) {
  const out = new Set();
  for (const name of names) {
    if (!name) continue;
    out.add(name);
    const alias = FORMATION_LABEL_ALIASES.get(name);
    if (alias) out.add(alias);
    for (const parent of FORMATION_PARENTS_BY_SPECIFIC.get(name) ?? []) {
      out.add(parent);
      const parentAlias = FORMATION_LABEL_ALIASES.get(parent);
      if (parentAlias) out.add(parentAlias);
    }
  }
  return [...out];
}

export function preferSpecificFormationNames(names) {
  const unique = [...new Set(names.filter(Boolean))];
  const hiddenParents = new Set();
  for (const name of unique) {
    for (const parent of FORMATION_PARENTS_BY_SPECIFIC.get(name) ?? []) {
      hiddenParents.add(parent);
    }
  }
  return unique.filter((name) => !hiddenParents.has(name));
}

export function createFormationState() {
  return {
    battle: '',
    // formedは1局で組んだ囲い・戦法(崩されても残す。7-5)。castleは今の囲い。
    black: { rook: '', castle: '', tactics: [], formed: [] },
    white: { rook: '', castle: '', tactics: [], formed: [] },
  };
}

/**
 * その局面までに指した手の数と、いま指した側(初めの局面は'')。局面のSFENの手数の欄は進まないことがあるので、手数は呼ぶ側が渡す。
 * @param {string} sfen
 * @param {number} ply
 * @returns {{ ply: number, mover: '' | 'black' | 'white' }}
 */
export function formationMove(sfen, ply) {
  const turn = String(sfen).replace(/^sfen\s+/, '').trim().split(/\s+/)[1];
  const count = Math.max(0, Math.trunc(Number(ply) || 0));
  return { ply: count, mover: count === 0 ? '' : turn === 'b' ? 'white' : 'black' };
}

/** 原典の先手・後手別の呼び分けに合わせて、現局面の分類を返す。 */
export function detectFormationSnapshot(sfen, master) {
  const direct = withTurn(sfen, 'w');
  const inverted = withTurn(invertHiraganaSuishoSfen(sfen), 'w');
  const goteDirect = withTurn(sfen, 'b');
  const directRules = detectHiraganaSuishoFormations(direct, master, { allCastles: true });
  const invertedRules = detectHiraganaSuishoFormations(inverted, master, { allCastles: true });
  const goteRules = detectHiraganaSuishoFormations(goteDirect, master);
  const board = parseSfenBoard(sfen);
  const blackGuideTactics = guideTacticNames(board, 'black', sfen);
  const whiteGuideTactics = guideTacticNames(board, 'white', sfen);
  return {
    battle: firstByGroup(directRules, 'bt_match1') || guideBattleName(board, sfen),
    black: {
      rook: firstByGroup(directRules, 'bt_match2'),
      castle: bestCastleName(board, 'black', sfen, directRules),
      tactics: [...new Set([
        ...namesByGroup(directRules, ['sente_tac_match', 'tac_match']),
        ...blackGuideTactics,
      ])],
    },
    white: {
      rook: firstByGroup(invertedRules, 'bt_match2'),
      castle: bestCastleName(board, 'white', sfen, invertedRules),
      tactics: [
        ...new Set([
          ...namesByGroup(goteRules, ['gote_tac_match']),
          ...namesByGroup(invertedRules, ['tac_match']),
          ...whiteGuideTactics,
        ]),
      ],
    },
  };
}

/**
 * 局面ごとの判定を、1局の戦型にまとめる(7-2・7-3・7-5)。moveはformationMoveの結果。
 * - 新しい戦法・囲いを数えるのは、その側が指した手のあとだけ(相手の手で偶然できた形は、自分が次に指してもまだあれば数える)。
 * - 戦法はSTRATEGY_PLY_LIMIT手まで、囲いを組んだと数えるのはCASTLE_PLY_LIMIT手まで。今の囲い(castle)はいつも今の局面のもの。
 * - 初めの局面(手数0)と、moveを渡さないときは、どちらの側の形も数える。
 * @param {ReturnType<typeof createFormationState>} previous
 * @param {any} snapshot
 * @param {{ ply: number, mover: '' | 'black' | 'white' }} [move]
 */
export function updateFormationState(previous, snapshot, move = { ply: 0, mover: '' }) {
  const next = {
    battle: previous.battle,
    black: { ...previous.black, tactics: [...previous.black.tactics], formed: [...(previous.black.formed ?? [])] },
    white: { ...previous.white, tactics: [...previous.white.tactics], formed: [...(previous.white.formed ?? [])] },
  };
  const { ply, mover } = move;
  // 戦型(相掛かり・矢倉など)と振り飛車の筋も、戦法と同じ手数まで(終盤の形で「矢倉」と付かない)。
  if (!next.battle && snapshot.battle && ply <= STRATEGY_PLY_LIMIT) next.battle = snapshot.battle;
  for (const color of ['black', 'white']) {
    const own = !mover || mover === color;
    if (!next[color].rook && snapshot[color].rook && own && ply <= STRATEGY_PLY_LIMIT) next[color].rook = snapshot[color].rook;
    next[color].castle = snapshot[color].castle;
    const fresh = own && ply <= STRATEGY_PLY_LIMIT ? snapshot[color].tactics.filter((name) => !next[color].tactics.includes(name)) : [];
    next[color].tactics = [...next[color].tactics, ...fresh];
    const formed = new Set(next[color].formed);
    for (const name of fresh) formed.add(name);
    if (own && ply <= CASTLE_PLY_LIMIT && snapshot[color].castle) formed.add(snapshot[color].castle);
    next[color].formed = [...formed];
  }
  return next;
}

/**
 * 1局でその側が組んだ戦型の名前(コレクション・技の演出)。戦型・振り飛車の筋と、組んだ囲い・戦法。
 * 先手の一手損角換わりは数えない(後手の作戦の名前のため。formationNamesFromStateと同じ)。
 * @param {ReturnType<typeof createFormationState>} state
 * @param {'black' | 'white'} color
 */
export function formedNamesFromState(state, color) {
  const side = state[color];
  const battle = state.battle === '一手損角換わり' && color === 'black' ? '' : state.battle;
  return [...new Set([battle, side.rook, ...(side.formed ?? []), ...side.tactics].filter(Boolean))];
}

export function formationNamesFromState(state, color, limit = Infinity) {
  const side = state[color];
  const battle = state.battle === '一手損角換わり' && color === 'black'
    ? []
    : [state.battle];
  return preferSpecificFormationNames([
    ...battle,
    side.rook,
    side.castle,
    ...side.tactics,
  ]).slice(0, limit);
}

export function formationNamesFromSnapshot(snapshot, color) {
  return formationNamesFromState({ ...snapshot }, color);
}
