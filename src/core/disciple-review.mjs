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
    // 弟子の好手(33-6)。棋譜帳には本局の印(ただ1つの好手など)を残さないので、見つけた好手をそのまま残す。
    good: (game.good ?? []).map((item) => ({ ply: item.ply, kind: item.kind, name: item.name })),
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

/** 弟子の考えの一言(思考の記録の理由から。34-17)。 */
export const THOUGHT_LINES = Object.freeze({
  book: '定跡どおりに指します', follow: '研究してきた手です', memo: '前にも指した形です。研究メモどおりに指します', mate: '詰みが見えました', 'mate-threat': '詰みまで読み切りました',
  material: '駒得になります', promote: '成れるところは成ります', check: '王手をかけます', attack: '攻め駒を玉に近づけます',
  castle: '囲いを固めます', mobility: '駒を働かせます', read: '読んで決めました', develop: '銀を繰り出します',
  'rook-pawn': '飛車先の歩を伸ばします', 'edge-pawn': '端歩を突いて様子を見ます', wait: '手待ちして相手の出方を見ます',
  save: '取られそうな駒を逃がします', 'defend-mate': '詰まされないように受けます', connect: '駒どうしをつなぎます', natural: '自然な手を指します',
});

/**
 * 本局の手の記録から、弟子の考えの一言。思考の記録がない手(前の版・相手の手)は空。
 * @param {{ d?: { r?: string } } | null | undefined} entry
 */
export function thoughtLine(entry) {
  const reason = entry?.d?.r;
  return reason ? THOUGHT_LINES[reason] ?? '' : '';
}

/**
 * 弟子の読み筋(思考の記録の`l`)と、相手の実際の手(34-18)。読み筋の2手目(弟子が読んだ相手の手)と、相手が実際に指した手が違えば「読んでいなかった手」。
 * @param {readonly { move: string, d?: { l?: string } }[]} entries
 * @param {number} ply 弟子の手(1から)
 * @returns {{ text: string, expected: string, actual: string, actualText: string, surprised: boolean } | null}
 */
export function thoughtReading(entries, ply) {
  const entry = entries[ply - 1];
  const line = String(entry?.d?.l ?? '').split(/\s+/).filter(Boolean);
  if (line.length < 2 || line[0] !== entry.move) return null;
  const record = createGameRecord(sfenAt(entries, ply - 1));
  const labels = [];
  let previous = entries[ply - 2]?.move ?? '';
  for (const usi of line) {
    const label = moveLabel(record.position.sfen, usi, previous);
    if (!label || !appendUsiMove(record, usi)) break;
    labels.push(label);
    previous = usi;
  }
  const actual = entries[ply]?.move ?? '';
  const actualText = actual ? moveLabel(sfenAt(entries, ply), actual, entry.move) : '';
  return { text: labels.join(' '), expected: line[1], actual, actualText, surprised: Boolean(actual) && actual !== line[1] };
}
