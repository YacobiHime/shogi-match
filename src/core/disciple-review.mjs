// 師匠の1年の検討(docs/disciple-mode-design.mdの33章の段階B)。観戦した本局の棋譜を1手ずつ見るための形と、弟子の棋譜帳。
// 画面に依存しない。本局の棋譜はengine-game.mjsのentries(指し手・評価値・最善手・読み筋)。新しくエンジンで読まない。

import { appendUsiMove, createGameRecord, STANDARD_SFEN } from '../game-state';
import { moveLabel } from './research-record.mjs';

/** 弟子の棋譜帳に残す対局の数(古い順に外す)。 */
export const BOOK_MAX = 20;

/** 形勢の言葉の境目(弟子から見た評価値の絶対値。将棋の中継の言い方に合わせる)。 */
export const EVAL_STEPS = Object.freeze([
  Object.freeze({ min: 3000, good: '勝勢', bad: '敗勢' }),
  Object.freeze({ min: 1500, good: '優勢', bad: '劣勢' }),
  Object.freeze({ min: 800, good: '有利', bad: '不利' }),
  Object.freeze({ min: 300, good: 'やや有利', bad: 'やや不利' }),
]);

/**
 * 形勢の言葉(弟子から見た評価値)。toneは良い・悪い・互角。
 * @param {number} cp 弟子から見た評価値
 */
export function evalWord(cp) {
  const value = Number(cp) || 0;
  const step = EVAL_STEPS.find((item) => Math.abs(value) >= item.min);
  if (!step) return { word: '互角', tone: 'even' };
  return value > 0 ? { word: step.good, tone: 'good' } : { word: step.bad, tone: 'bad' };
}

/**
 * 棋譜の行(手の一覧)。各手の「▲7六歩」の形・指したあとの形勢の言葉(弟子から見て)・弟子の手か。
 * @param {readonly { move: string, eval?: number }[]} entries 本局の棋譜(評価値は先手から見た値)
 * @param {'black' | 'white'} side 弟子の側
 * @param {{ sfen?: string }} [options] はじめの局面
 */
export function reviewRows(entries, side, { sfen = STANDARD_SFEN } = {}) {
  const record = createGameRecord(sfen);
  const sign = side === 'black' ? 1 : -1;
  const rows = [];
  let previous = '';
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const before = record.position.sfen;
    const text = moveLabel(before, entry.move, previous) || entry.move;
    if (!appendUsiMove(record, entry.move)) break;
    previous = entry.move;
    const ply = index + 1;
    const mine = (side === 'black') === (ply % 2 === 1);
    rows.push({ ply, text, mine, ...evalWord(sign * (Number(entry.eval) || 0)) });
  }
  return rows;
}

/**
 * その手のAIの検討(33-4)。指した手と違うときのAIの最善手と、指した手のあとのAIの読み筋(本局の記録。新しく読まない)。
 * @param {readonly { move: string, best?: string, pv?: string }[]} entries
 * @param {number} ply その手(1から)
 */
export function aiHint(entries, ply) {
  const entry = entries[ply - 1];
  if (!entry) return null;
  const sfen = sfenAt(entries, ply - 1);
  const pvMoves = String(entry.pv ?? '').split(/\s+/).filter(Boolean);
  // 読み筋の文字(指した手のあとの局面から)。
  const record = createGameRecord(sfenAt(entries, ply));
  const pvText = [];
  let previous = entry.move;
  for (const usi of pvMoves.slice(0, 6)) {
    const label = moveLabel(record.position.sfen, usi, previous);
    if (!label || !appendUsiMove(record, usi)) break;
    pvText.push(label);
    previous = usi;
  }
  const best = entry.best && entry.best !== entry.move ? entry.best : '';
  return {
    best,
    bestText: best ? moveLabel(sfen, best, entries[ply - 2]?.move ?? '') : '',
    pvText: pvText.join(' '),
  };
}

/**
 * はじめから何手指した局面か。
 * @param {readonly { move: string }[]} entries
 * @param {number} upto 指した手の数
 */
export function sfenAt(entries, upto, sfen = STANDARD_SFEN) {
  const record = createGameRecord(sfen);
  for (const entry of entries.slice(0, Math.max(0, upto))) {
    if (!appendUsiMove(record, entry.move)) break;
  }
  return record.position.sfen;
}

/**
 * 棋譜帳の1局(育成の状態に残す形。指し手・形勢・最善手・読み筋と、印と答え)。
 * @param {{ label: string, side: 'black' | 'white', opponent: { name: string }, win: boolean, entries: readonly { move: string, eval?: number, best?: string, pv?: string }[], endReason?: string, marks?: readonly any[], guesses?: readonly (string | null)[] }} game
 * @param {{ turn?: number, when?: string }} [meta]
 */
export function bookEntry(game, { turn = 0, when = '' } = {}) {
  return {
    id: `${turn}-${game.entries.length}-${game.entries[0]?.move ?? ''}`,
    label: game.label,
    side: game.side,
    opponent: game.opponent?.name ?? '',
    win: Boolean(game.win),
    plies: game.entries.length,
    endReason: game.endReason ?? 'resign',
    turn,
    when,
    entries: game.entries.map((entry) => ({
      move: entry.move,
      eval: Math.round(Number(entry.eval) || 0),
      ...(entry.best ? { best: entry.best } : {}),
      ...(entry.pv ? { pv: entry.pv } : {}),
    })),
    marks: (game.marks ?? []).map((mark) => ({ ply: mark.ply, loss: mark.loss, cause: mark.cause, clues: [...(mark.clues ?? [])] })),
    guesses: [...(game.guesses ?? [])],
  };
}

/**
 * 棋譜帳に1局を足す(同じ対局は入れ替え、BOOK_MAXまで。新しい順に並べるのは画面)。書き換えてよい写しを渡す。
 * @param {any} state 育成の状態
 * @param {ReturnType<typeof bookEntry>} entry
 */
export function addBookGame(state, entry) {
  const games = (state.games ?? []).filter((game) => game.id !== entry.id);
  state.games = [...games, entry].slice(-BOOK_MAX);
  return state;
}

/** 棋譜帳の一覧(新しい順)。 */
export const bookList = (state) => [...(state?.games ?? [])].reverse();
