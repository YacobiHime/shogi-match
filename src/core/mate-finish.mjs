// 寄せの記録(docs/mate-finish-design.md)。大会で詰ませて勝ったとき、最後の寄せが「何手詰め」だったかを出し、記録する。
// 数え方は詰将棋と同じく、詰ませた側の最後の王手の連続を、両者の手を合わせて数える。画面と保存の仕組みに依存しない。

import { appendUsiMove, createGameRecord, enumerateLegalMoves, STANDARD_SFEN } from '../game-state';

export const MATE_FINISH_KEY = 'yacobihime:shogi-match:mate-finish:v1';
/** 残す最近の寄せの数。 */
export const MATE_RECENT_LIMIT = 10;

/**
 * 最後の王手の連続の手数。checksは、各手を指したあとに相手が王手されているか(最後の手は詰み)。
 * 最後の手が王手でなければ0。
 * @param {boolean[]} checks
 */
export function mateStreak(checks) {
  let start = checks.length - 1;
  if (start < 0 || !checks[start]) return 0;
  while (start - 2 >= 0 && checks[start - 2]) start -= 2;
  return checks.length - start;
}

/**
 * 詰みで終わった棋譜の、最後の寄せ。詰みで終わっていなければnull。
 * pliesは何手詰めか、fromは寄せの最初の手の手数(1始まり)、toは詰ませた手の手数。
 * @param {string[]} moves
 * @param {{ initialSfen?: string }} [options]
 */
export function finishingMate(moves, { initialSfen = STANDARD_SFEN } = {}) {
  if (!moves?.length) return null;
  let record;
  try {
    record = createGameRecord(initialSfen);
  } catch {
    return null;
  }
  const checks = [];
  for (const usi of moves) {
    if (!appendUsiMove(record, usi)) return null;
    checks.push(Boolean(record.position.checked));
  }
  if (!checks.at(-1) || enumerateLegalMoves(record.position).length) return null;
  const plies = mateStreak(checks);
  return { plies, from: moves.length - plies + 1, to: moves.length };
}

/** 寄せの手数の重さ。判子の大きさと言葉に使う(G:3-1)。 */
export function mateTier(plies) {
  if (plies >= 15) return 'legend';
  if (plies >= 9) return 'long';
  if (plies >= 5) return 'mid';
  return 'short';
}

/** 「7手詰め」。 */
export const mateLabel = (plies) => `${plies}手詰め`;

/** 終局の判子の下の言葉。1手詰めは「仕留めた」、ほかは「寄せ切り」。 */
export function mateFinishText(plies) {
  return plies <= 1 ? '1手詰めで仕留めた！' : `${mateLabel(plies)}で寄せ切り！`;
}

/**
 * 観戦記の寄せの一文。fromTextは寄せの最初の手の言葉(「▲3二銀」)。
 * @param {{ plies: number, from: number, fromText?: string, userName: string }} input
 */
export function mateKansenkiSentence({ plies, from, fromText = '', userName }) {
  const start = fromText ? `${from}手目${fromText}` : `${from}手目`;
  if (plies <= 1) return `最後は${start}で詰み。${userName}が一手で仕留めた。`;
  if (plies >= 15) return `最後は${start}からの${plies}手詰め。長い寄せを、${userName}は一手も誤らずに読み切った。`;
  return `最後は${start}からの${plies}手詰め。${userName}が鮮やかに寄せ切った。`;
}

/** 空の記録。 */
export const emptyMateRecords = () => ({ count: 0, best: null, recent: [] });

/** 保存した記録。読めなければ空。 */
export function loadMateRecords(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(MATE_FINISH_KEY) ?? 'null');
    if (!parsed || typeof parsed !== 'object') return emptyMateRecords();
    const valid = (item) => item && Number.isFinite(item.plies) && item.plies > 0;
    return {
      count: Number.isFinite(parsed.count) ? parsed.count : 0,
      best: valid(parsed.best) ? parsed.best : null,
      recent: Array.isArray(parsed.recent) ? parsed.recent.filter(valid).slice(0, MATE_RECENT_LIMIT) : [],
    };
  } catch {
    return emptyMateRecords();
  }
}

/**
 * 寄せ切った1局を足す。isBestは、前の記録より長い寄せか(前の記録がなければ偽。比べるものがないため)。
 * @param {ReturnType<typeof emptyMateRecords>} records
 * @param {{ plies: number, at: number, event: string, eventText?: string, label?: string, opponent?: string }} item
 */
export function addMateRecord(records, item) {
  const isBest = Boolean(records.best) && item.plies > records.best.plies;
  const best = !records.best || item.plies > records.best.plies ? item : records.best;
  return {
    records: { count: records.count + 1, best, recent: [item, ...records.recent].slice(0, MATE_RECENT_LIMIT) },
    isBest,
  };
}

/** 記録を保存する。保存できなくても遊びは止めない。 */
export function saveMateRecords(storage, records) {
  try {
    storage?.setItem(MATE_FINISH_KEY, JSON.stringify(records));
  } catch {
    // 保存できない環境では、この局の演出だけにする。
  }
}
