// 中継の楽しみ(docs/tournament-relay-design.mdの24章)。勝敗の予想・次の一手クイズ・見どころ再生・大盤解説・研究ノートの、
// 画面に依存しない部分(選び方・記録・保存)。中継の棋譜はrelay-game.mjsのRelayMoveEntryの形(move・eval・pv・time・mark)。

import { appendUsiMove, createGameRecord, enumerateLegalMoves } from '../game-state';
import { blackWinRate } from './relay-game.mjs';
import { relaySeed } from './relay-game.mjs';

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

function readJson(storage, key) {
  try {
    return JSON.parse(storage?.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}
function writeJson(storage, key, value) {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    // 保存できなくても、その場では遊べる。
  }
}

// ---- 勝敗の予想(24-1)。回戦の中継ボードで、対局が序盤のうちに勝つ側を選び、終局したら当たり外れを数える。

export const PREDICT_KEY = 'yacobihime:shogi-match:relay-predict:v1';
/** 予想できるのは、ボードの表示がこの手数より前のあいだ(形勢がはっきりする前)。 */
export const PREDICT_UNTIL_PLY = 30;
/** 残す予想の数(古いものから消す。数えた結果は合計に残る)。 */
const PREDICT_LIMIT = 300;

/** 予想の記録。picksは対局の鍵ごとの選んだ側、settledは数え終えた対局。 */
export function loadPredictions(storage) {
  const parsed = readJson(storage, PREDICT_KEY);
  const count = (value) => (Number.isInteger(value) && value >= 0 ? value : 0);
  return {
    picks: parsed && typeof parsed.picks === 'object' ? parsed.picks : {},
    settled: Array.isArray(parsed?.settled) ? parsed.settled : [],
    total: count(parsed?.total), hit: count(parsed?.hit), streak: count(parsed?.streak), best: count(parsed?.best),
  };
}
export const savePredictions = (storage, store) => writeJson(storage, PREDICT_KEY, store);

/** 予想する(序盤のうちだけ。終局した対局と、数え終えた対局は変えられない)。 */
export function pickWinner(store, key, side, ply) {
  if (ply >= PREDICT_UNTIL_PLY || store.settled.includes(key) || (side !== 'black' && side !== 'white')) return store;
  const keys = Object.keys(store.picks).filter((other) => other !== key);
  const picks = Object.fromEntries(keys.slice(-(PREDICT_LIMIT - 1)).map((other) => [other, store.picks[other]]));
  return { ...store, picks: { ...picks, [key]: side } };
}

/** 終局した対局の予想を数える(1局につき1回)。winnerは勝った側。 */
export function settlePrediction(store, key, winner) {
  const pick = store.picks[key];
  if (!pick || store.settled.includes(key) || (winner !== 'black' && winner !== 'white')) return store;
  const hit = pick === winner;
  const streak = hit ? store.streak + 1 : 0;
  return {
    ...store,
    settled: [...store.settled, key].slice(-PREDICT_LIMIT),
    total: store.total + 1, hit: store.hit + (hit ? 1 : 0), streak, best: Math.max(store.best, streak),
  };
}

/** ボードの対局の予想の当たり外れ(この回戦の分)。 */
export function boardPredictions(store, games) {
  let picked = 0;
  let hit = 0;
  let decided = 0;
  for (const { key, winner } of games) {
    const pick = store.picks[key];
    if (!pick) continue;
    picked += 1;
    if (!winner) continue;
    decided += 1;
    if (pick === winner) hit += 1;
  }
  return { picked, decided, hit };
}

// ---- 次の一手クイズ(24-2)。考慮中に、次の手を3つの候補から当てる。

export const QUIZ_KEY = 'yacobihime:shogi-match:relay-quiz:v1';

/** 次の一手の記録(合計・的中・連続)。 */
export function loadQuiz(storage) {
  const parsed = readJson(storage, QUIZ_KEY);
  const count = (value) => (Number.isInteger(value) && value >= 0 ? value : 0);
  return { total: count(parsed?.total), hit: count(parsed?.hit), streak: count(parsed?.streak), best: count(parsed?.best) };
}
export const saveQuiz = (storage, store) => writeJson(storage, QUIZ_KEY, store);

/** 答え合わせを数える。 */
export function scoreQuiz(store, hit) {
  const streak = hit ? store.streak + 1 : 0;
  return { total: store.total + 1, hit: store.hit + (hit ? 1 : 0), streak, best: Math.max(store.best, streak) };
}

/**
 * 次の一手の候補(3つ)。AIの読み筋の手(expected)と、分かっていれば実際に指された手(actual)を入れ、
 * 残りは駒を取る手・成る手・王手などの目立つ手から、種で決めて足す。並びも種で混ぜる(答えの位置を決めない)。
 * @param {{ sfen: string, expected?: string, actual?: string, seed?: string }} input
 * @returns {string[]} USIの手
 */
export function quizChoices({ sfen, expected = '', actual = '', seed = '' }) {
  const record = createGameRecord(sfen);
  const legal = enumerateLegalMoves(record.position).map(({ usi }) => usi);
  if (!legal.length) return [];
  const picked = [];
  const add = (usi) => {
    if (usi && legal.includes(usi) && !picked.includes(usi) && picked.length < 3) picked.push(usi);
  };
  add(actual);
  add(expected);
  // 目立つ手(駒を取る・成る・王手)を先に、そのあとほかの手。種で順番を決める。
  const loud = (usi) => {
    const probe = createGameRecord(sfen);
    if (!appendUsiMove(probe, usi)) return 0;
    const move = probe.current?.move;
    const capture = move && typeof move === 'object' && 'capturedPieceType' in move && move.capturedPieceType ? 2 : 0;
    const promote = usi.endsWith('+') ? 1 : 0;
    return capture + promote;
  };
  const base = relaySeed(`${seed}:${sfen}`);
  const ranked = legal
    .map((usi, index) => ({ usi, loud: loud(usi), order: (base + Math.imul(index + 1, 2654435761)) >>> 0 }))
    .sort((a, b) => b.loud - a.loud || a.order - b.order);
  for (const { usi } of ranked) add(usi);
  // 並びを混ぜる(実際の手がいつも1番目にならないように)。
  return picked
    .map((usi, index) => ({ usi, order: (base ^ Math.imul(index + 7, 40503)) >>> 0 }))
    .sort((a, b) => a.order - b.order)
    .map(({ usi }) => usi);
}

// ---- 見どころ再生(24-3)。形勢が動いた手・長考・決め手・終局を、短く続けて見る。

/** 見どころに選ぶ数の上限。 */
export const HIGHLIGHT_LIMIT = 8;
/** 勝率がこれだけ動いた手は「形勢が動いた」(0〜1)。 */
const SWING = 0.15;
/** これより長く考えた手は「長考」(秒)。 */
const LONG_THINK = 1800;

/**
 * 見どころの手(何手目と、種類・見出し)。手数の順。
 * @param {{ move: string, eval: number, time: number, mark?: string }[]} entries
 * @param {{ limit?: number, end?: { winner: 'black' | 'white', reason: string } | null }} [options]
 */
export function highlightPlan(entries, { limit = HIGHLIGHT_LIMIT, end = null } = {}) {
  const items = [];
  let previous = blackWinRate(40);
  entries.forEach((entry, index) => {
    const ply = index + 1;
    const rate = blackWinRate(entry.eval);
    const swing = Math.abs(rate - previous);
    const before = Math.round(previous * 100);
    const after = Math.round(rate * 100);
    previous = rate;
    // 勝率の数字は、目に見えて動いたときだけ添える(「0%→0%」のような決着後の手には付けない)。
    const rates = swing >= SWING ? `（先手の勝率 ${before}%→${after}%）` : '';
    if (entry.mark === 'mate') items.push({ ply, kind: 'mate', score: 3, caption: '詰みへの決め手' });
    else if (swing >= SWING * 2) items.push({ ply, kind: 'swing', score: 2 + swing, caption: `形勢が大きく動いた一手${rates}` });
    else if (entry.mark === 'decisive') items.push({ ply, kind: 'swing', score: 2 + swing, caption: `勝負を分けた一手${rates}` });
    else if (swing >= SWING) items.push({ ply, kind: 'swing', score: 1 + swing, caption: `形勢が動いた一手${rates}` });
    else if (entry.mark === 'error') items.push({ ply, kind: 'swing', score: 1 + swing, caption: '疑問手' });
    if (entry.time >= LONG_THINK) items.push({ ply, kind: 'think', score: 1 + entry.time / 7200, caption: `長考の一手（${Math.round(entry.time / 60)}分）` });
  });
  // 同じ手は1つにまとめ(重いほうの見出し)、点の高い順に選んでから手数の順に並べる。
  const byPly = new Map();
  for (const item of items) if (!byPly.has(item.ply) || byPly.get(item.ply).score < item.score) byPly.set(item.ply, item);
  const chosen = [...byPly.values()].sort((a, b) => b.score - a.score).slice(0, Math.max(1, limit - 1)).sort((a, b) => a.ply - b.ply);
  const last = entries.length;
  if (last && !chosen.some(({ ply }) => ply === last)) {
    const caption = end ? (end.reason === 'mate' ? '詰み（終局）' : '終局の一手（このあと投了）') : 'いまの局面';
    chosen.push({ ply: last, kind: 'end', score: 0, caption });
  }
  return chosen.map(({ ply, kind, caption }) => ({ ply, kind, caption }));
}

// ---- 研究ノート(24-5)。中継で気に入った局面を残し、やこびノートから開く。

export const NOTES_KEY = 'yacobihime:shogi-match:relay-notes:v1';
/** 残す局面の数(古いものから消す)。 */
export const NOTES_LIMIT = 30;

/** 研究ノートの局面(新しい順)。 */
export function loadNotes(storage) {
  const parsed = readJson(storage, NOTES_KEY);
  return Array.isArray(parsed?.notes) ? parsed.notes.filter((note) => note && typeof note.sfen === 'string' && note.spec) : [];
}

/**
 * 局面を残す(同じ対局の同じ手数は1つ。新しいものを先頭に)。specは中継の項目(開き直すのに使う。重い能力の情報は外す)。
 * @param {any[]} notes
 * @param {{ spec: any, ply: number, sfen: string, moveText: string, savedAt?: number }} note
 */
export function addNote(notes, { spec, ply, sfen, moveText, savedAt = Date.now() }) {
  const light = (player) => ({ id: player.id, name: player.name, dan: player.dan ?? '', rating: player.rating ?? 0, level: player.level ?? null, story: player.story ?? null, kind: player.kind ?? 'pro', character: player.character ?? null });
  const keep = {
    key: spec.key, event: spec.event, kind: spec.kind, label: spec.label, section: spec.section, order: spec.order, round: spec.round,
    weight: spec.weight, venue: spec.venue ?? '', gameNo: spec.gameNo ?? 0, seed: spec.seed, quality: spec.quality ?? '',
    black: light(spec.black), white: light(spec.white), winner: spec.winner ?? null, openings: spec.openings ?? null,
    castles: spec.castles ?? null, story: spec.story ?? null, how: spec.how ?? null, tags: spec.tags ?? {}, series: spec.series ?? null,
  };
  const id = `${spec.key}#${ply}`;
  const next = [{ id, spec: keep, ply: clamp(Math.round(ply), 0, 999), sfen, moveText, savedAt }, ...notes.filter((note) => note.id !== id)];
  return next.slice(0, NOTES_LIMIT);
}

export const removeNote = (notes, id) => notes.filter((note) => note.id !== id);
export const saveNotes = (storage, notes) => writeJson(storage, NOTES_KEY, { notes });
