import shogiLib from './vendor/shogi.esm.js';

const { Shogi, kindToString } = shogiLib;
const RANK_KANJI = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const DROP_KINDS = {
  P: 'FU', L: 'KY', N: 'KE', S: 'GI', G: 'KI', B: 'KA', R: 'HI',
};
const USI_MOVE_PATTERN = /^(?:[1-9][a-i][1-9][a-i]\+?|[PLNSGBR]\*[1-9][a-i])$/;

/** エンジンの探索結果から、順位付きのヒント候補を取得する。 */
export function getHintMoves(searchResult, limit = 3) {
  if (!searchResult || typeof searchResult !== 'object') {
    throw new Error('ヒントの探索結果が不正です');
  }
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error('ヒントの候補数は1以上の整数にしてください');
  }

  const candidates = Array.isArray(searchResult.candidates)
    ? searchResult.candidates.filter((candidate) => (
      Number.isInteger(candidate?.rank)
      && candidate.rank >= 1
      && candidate.rank <= limit
      && typeof candidate.move === 'string'
      && candidate.move.length > 0
    ))
    : [];
  if (!candidates.some((candidate) => candidate.rank === 1)
    && typeof searchResult.move === 'string' && searchResult.move.length > 0) {
    candidates.push({ rank: 1, move: searchResult.move });
  }

  const seenRanks = new Set();
  const seenMoves = new Set();
  const moves = candidates
    .sort((left, right) => left.rank - right.rank)
    .filter((candidate) => {
      if (seenRanks.has(candidate.rank) || seenMoves.has(candidate.move)) return false;
      seenRanks.add(candidate.rank);
      seenMoves.add(candidate.move);
      return true;
    })
    .map(({ rank, move, score }) => ({ rank, move, score }));
  if (moves.length === 0) {
    throw new Error('ヒントの指し手を取得できませんでした');
  }
  return moves;
}

/** 従来どおり最善手だけ必要な呼び出し向け。 */
export function getHintMove(searchResult) {
  return getHintMoves(searchResult, 1)[0].move;
}

function formatDestination(square) {
  const file = square[0];
  const rank = RANK_KANJI[square.charCodeAt(1) - 'a'.charCodeAt(0)];
  return `${file}${rank}`;
}

function formatMoveInPosition(usiMove, shogi) {
  if (usiMove === 'resign') return '投了';
  if (usiMove === 'win') return '入玉宣言';
  const drop = usiMove.match(/^([PLNSGBR])\*([1-9][a-i])$/);
  if (drop) return `${formatDestination(drop[2])}${kindToString(DROP_KINDS[drop[1]])}打`;
  const move = usiMove.match(/^([1-9][a-i])([1-9][a-i])(\+)?$/);
  if (move) {
    const piece = shogi.get(Number(move[1][0]), move[1].charCodeAt(1) - 96);
    if (!piece) throw new Error(`ヒントの移動元に駒がありません: ${move[1]}`);
    return `${formatDestination(move[2])}${kindToString(piece.kind)}${move[3] ? '成' : ''}`;
  }
  return usiMove;
}

function applyUsiMove(shogi, usiMove) {
  const drop = usiMove.match(/^([PLNSGBR])\*([1-9])([a-i])$/);
  if (drop) {
    shogi.drop(Number(drop[2]), drop[3].charCodeAt(0) - 96, DROP_KINDS[drop[1]]);
    return;
  }
  const move = usiMove.match(/^([1-9])([a-i])([1-9])([a-i])(\+)?$/);
  if (!move) throw new Error(`読み筋の指し手が不正です: ${usiMove}`);
  shogi.move(
    Number(move[1]), move[2].charCodeAt(0) - 96,
    Number(move[3]), move[4].charCodeAt(0) - 96,
    Boolean(move[5])
  );
}

function positionFromSfen(sfen) {
  if (typeof sfen !== 'string' || sfen.length === 0) {
    throw new Error('ヒントの駒名を表示するには局面情報が必要です');
  }
  const shogi = new Shogi();
  shogi.initializeFromSFENString(sfen);
  return shogi;
}

/** USI形式の指し手を「5二銀」のような日本語表記にする。 */
export function formatHintMove(usiMove, sfen) {
  return formatMoveInPosition(usiMove, positionFromSfen(sfen));
}

/** PVを局面へ順に適用しながら、日本語の読み筋へ変換する。 */
export function formatHintPrincipalVariation(usiMoves, sfen, limit = 6) {
  if (!Array.isArray(usiMoves) || !Number.isInteger(limit) || limit < 1) return '';
  const shogi = positionFromSfen(sfen);
  const formatted = [];
  for (const usiMove of usiMoves.slice(0, limit)) {
    if (typeof usiMove !== 'string' || !USI_MOVE_PATTERN.test(usiMove)) break;
    try {
      formatted.push(formatMoveInPosition(usiMove, shogi));
      applyUsiMove(shogi, usiMove);
    } catch {
      break;
    }
  }
  return formatted.join(' → ');
}

/** USIの評価値をプレイヤー向けに読みやすくする。 */
export function formatHintEvaluation(score) {
  if (!score || !['cp', 'mate'].includes(score.type) || !Number.isFinite(score.value)) {
    return '評価値 —';
  }
  if (score.type === 'mate') {
    if (score.value > 0) return `評価値 詰み${score.value}手`;
    if (score.value < 0) return `評価値 被詰み${Math.abs(score.value)}手`;
    return '評価値 詰み';
  }
  const value = score.value / 100;
  return `評価値 ${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
}

/** エンジン評価を、矢印の比較に使う手番側視点の整数値へ変換する。 */
export function hintScoreForArrow(score) {
  if (!score || !['cp', 'mate'].includes(score.type) || !Number.isFinite(score.value)) {
    return undefined;
  }
  if (score.type === 'cp') return Math.trunc(score.value);
  // 詰みは通常評価より常に優先し、短い詰みほど高く、被詰みは長いほど高く扱う。
  if (score.value > 0) return 100000 - score.value;
  if (score.value < 0) return -100000 + Math.abs(score.value);
  return 100000;
}

/** 通常対局の強さ設定とは独立した、端末負荷を抑えた閃き専用探索設定。 */
export function getHintSearchSettings(mobile = false) {
  return mobile
    ? { nodes: 300000, maxTimeMs: 6000, multiPv: 3 }
    : { nodes: 1000000, maxTimeMs: 10000, multiPv: 3 };
}

/** 10秒後の軽い助言は、候補を広げず最善手1本へ探索を集中する。 */
export function getIdleCoachSearchSettings(mobile = false) {
  return mobile
    ? { nodes: 100000, maxTimeMs: 1800, multiPv: 1 }
    : { nodes: 200000, maxTimeMs: 2500, multiPv: 1 };
}

/** 戦法完成後の自動3候補。閃きより軽く、通常助言より深く読む。 */
export function getOpeningFollowupSearchSettings(mobile = false) {
  return mobile
    ? { nodes: 200000, maxTimeMs: 3500, multiPv: 3 }
    : { nodes: 500000, maxTimeMs: 6000, multiPv: 3 };
}

function validateSnapshot(snapshot) {
  if (!snapshot || typeof snapshot.sfen !== 'string'
    || !Number.isInteger(snapshot.moveHistoryLength) || snapshot.moveHistoryLength < 0
    || !Number.isInteger(snapshot.repetitionLength) || snapshot.repetitionLength < 1) {
    throw new Error('待った用の局面履歴が不正です');
  }
  return { ...snapshot };
}

/** プレイヤーの手番開始時点の局面を保存する。 */
export class TurnHistory {
  constructor(initialSnapshot) {
    this.snapshots = [validateSnapshot(initialSnapshot)];
  }

  record(snapshot) {
    this.snapshots.push(validateSnapshot(snapshot));
  }

  canUndo() {
    return this.snapshots.length > 1;
  }

  undo() {
    if (!this.canUndo()) return null;
    this.snapshots.pop();
    return { ...this.snapshots.at(-1) };
  }
}
