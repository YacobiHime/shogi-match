// 中継の楽しみ(docs/tournament-relay-design.mdの24章)。勝敗の予想・次の一手クイズ・見どころ再生・大盤解説・研究ノートの、
// 画面に依存しない部分(選び方・記録・保存)。中継の棋譜はrelay-game.mjsのRelayMoveEntryの形(move・eval・pv・time・mark)。

import { appendUsiMove, createGameRecord, enumerateLegalMoves } from '../game-state';
import { blackWinRate, relaySeed } from './relay-game.mjs';
import { kingGuard, materialText } from './relay-commentary.mjs';
import { moveExchange } from './exchange-eval.mjs';
import { isKingAttacked, parseSfenState, parseUsiMove } from './piece-movement.mjs';

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

// ---- 大盤解説の当てもの(24-2・52章)。次の一手と形勢当て。まだ見ていない手だけで、解説者が選んだ局面で出題する。

export const QUIZ_KEY = 'yacobihime:shogi-match:relay-quiz:v1';
/** 見た手数を残す対局の数(古いものから消す)。 */
export const SEEN_LIMIT = 200;
/** 次の一手を出す手数(この手数より後の手を当てる。序盤の定跡の手は当たり前なので出さない)。 */
export const MOVE_QUIZ_FROM = 25;
/** 形勢当てを出す手数(この手数より後の局面から)。 */
export const JUDGE_QUIZ_FROM = 30;
/** 出題の局面のあいだの手数。 */
export const QUIZ_GAP = 10;
/** 1局で出題する数の上限。 */
export const QUIZ_LIMIT = 8;
/** 互角とみなす勝率(先手の勝率がこの間なら互角)。 */
export const JUDGE_EVEN = Object.freeze({ low: 0.4, high: 0.6 });
/** 形勢当てに出さない勝率(どちらかがほぼ勝ちの局面は、当て甲斐がない)。 */
const JUDGE_DECIDED = 0.95;

const QUIZ_KINDS = Object.freeze(['move', 'judge']);
const emptyTally = () => ({ total: 0, hit: 0, stars: 0, streak: 0, best: 0 });

/**
 * 当てものの記録。次の一手(move)と形勢当て(judge)を分けて、合計・当たり・★の点・連続・最高連続を持つ。
 * seenは対局の鍵ごとの見た手数(先を見た手は数えない。52-3の1)。前の版(total・hit・streak・best)は次の一手として読む。
 */
export function loadQuiz(storage) {
  const parsed = readJson(storage, QUIZ_KEY);
  const count = (value) => (Number.isInteger(value) && value >= 0 ? value : 0);
  const tally = (value) => ({ total: count(value?.total), hit: count(value?.hit), stars: count(value?.stars), streak: count(value?.streak), best: count(value?.best) });
  const move = parsed?.move && typeof parsed.move === 'object'
    ? tally(parsed.move)
    // 前の版は、当たった数を★1つずつの点として移す。
    : { ...tally(parsed), stars: count(parsed?.hit) };
  const judge = parsed?.judge && typeof parsed.judge === 'object' ? tally(parsed.judge) : emptyTally();
  /** @type {Record<string, number>} */
  const seen = {};
  if (parsed?.seen && typeof parsed.seen === 'object') {
    for (const [key, ply] of Object.entries(parsed.seen)) if (Number.isInteger(ply) && ply > 0) seen[key] = ply;
  }
  return { move, judge, seen };
}
export const saveQuiz = (storage, store) => writeJson(storage, QUIZ_KEY, store);

/**
 * 答え合わせを数える。starsは当たったときの点(★の数)。
 * @param {ReturnType<typeof loadQuiz>} store
 * @param {'move' | 'judge'} kind
 * @param {boolean} hit
 * @param {number} [stars]
 */
export function scoreQuiz(store, kind, hit, stars = 1) {
  const key = QUIZ_KINDS.includes(kind) ? kind : 'move';
  const tally = store[key] ?? emptyTally();
  const streak = hit ? tally.streak + 1 : 0;
  return {
    ...store,
    [key]: {
      total: tally.total + 1, hit: tally.hit + (hit ? 1 : 0), stars: tally.stars + (hit ? Math.max(1, Math.round(stars)) : 0),
      streak, best: Math.max(tally.best, streak),
    },
  };
}

/** その対局で見た手数(なければ0)。 */
export const seenPly = (store, key) => store?.seen?.[key] ?? 0;

/** 見た手数を残す(増えるときだけ。新しく見た対局は後ろへ回し、SEEN_LIMITを超えたら古いものから消す)。 */
export function markSeen(store, key, ply) {
  if (!key || !Number.isInteger(ply) || ply <= seenPly(store, key)) return store;
  const entries = Object.entries(store.seen ?? {}).filter(([other]) => other !== key);
  entries.push([key, ply]);
  return { ...store, seen: Object.fromEntries(entries.slice(-SEEN_LIMIT)) };
}

/** 形勢の段(先手の勝率0〜1から)。'black'(先手よし)・'even'(互角)・'white'(後手よし)。 */
export function judgeOf(rate) {
  if (rate >= JUDGE_EVEN.high) return 'black';
  if (rate <= JUDGE_EVEN.low) return 'white';
  return 'even';
}

const destination = (usi) => parseUsiMove(usi)?.to ?? '';
function moveFacts(sfen, usi) {
  const probe = createGameRecord(sfen);
  if (!appendUsiMove(probe, usi)) return { capture: false, promote: false };
  const move = probe.current?.move;
  const capture = Boolean(move && typeof move === 'object' && 'capturedPieceType' in move && move.capturedPieceType);
  return { capture, promote: usi.endsWith('+') };
}

/**
 * その局面が次の一手の問いに向くか。取り返すだけの手・王手を逃げるしかない局面・指せる手が3つ以下の局面は向かない(考える余地がない)。
 * @param {string} sfen 問いの局面(答えの手を指す前)
 * @param {string} answer 実際に指された手
 * @param {string} [previous] 直前の手(取り返しを見分ける)
 */
export function moveQuizFits(sfen, answer, previous = '') {
  if (!sfen || !answer) return false;
  const state = parseSfenState(sfen);
  if (isKingAttacked(state.board, state.turn)) return false;
  if (enumerateLegalMoves(createGameRecord(sfen).position).length <= 3) return false;
  if (previous && destination(previous) === destination(answer) && moveFacts(sfen, answer).capture) return false;
  return true;
}

/**
 * 解説者が出題する局面(52-3の2)。cursorの局面(cursor手を指したあと)で、次の一手(cursor+1手目を当てる)か形勢当てを出す。
 * 前から順に、QUIZ_GAP手ずつ空けて選ぶ。次の一手と形勢当ては交互にし、形勢当ては先手よし・互角・後手よしがだいたい同じ回数になるよう選ぶ
 * (いつも「互角」と答えれば当たる、をなくす)。前から順に決めるので、棋譜が伸びても前に選んだ局面は変わらない。
 * cacheを渡すと、手数ごとの判定を覚えておく(棋譜が1手ずつ届くたびに計算し直さない)。
 * @param {{ entries: { move: string, eval: number }[], sfens: string[], limit?: number, cache?: Map<number, { move: boolean, judge: string }> }} input
 * @returns {{ ply: number, kind: 'move' | 'judge' }[]}
 */
export function quizSpots({ entries, sfens, limit = QUIZ_LIMIT, cache = new Map() }) {
  /** @type {{ ply: number, kind: 'move' | 'judge' }[]} */
  const spots = [];
  const counts = { black: 0, even: 0, white: 0 };
  let last = -Infinity;
  let want = 'move';
  const factsAt = (cursor) => {
    if (!cache.has(cursor)) {
      const rate = blackWinRate(entries[cursor - 1].eval);
      const decided = rate >= JUDGE_DECIDED || rate <= 1 - JUDGE_DECIDED;
      cache.set(cursor, {
        move: moveQuizFits(sfens[cursor], entries[cursor].move, entries[cursor - 1].move),
        judge: cursor > JUDGE_QUIZ_FROM && !decided ? judgeOf(rate) : '',
      });
    }
    return /** @type {{ move: boolean, judge: string }} */ (cache.get(cursor));
  };
  for (let cursor = MOVE_QUIZ_FROM; cursor < entries.length && spots.length < limit; cursor += 1) {
    if (cursor - last < QUIZ_GAP || !sfens[cursor]) continue;
    const facts = factsAt(cursor);
    const least = Math.min(counts.black, counts.even, counts.white);
    const judgeOk = Boolean(facts.judge) && (counts[facts.judge] === least || cursor - last >= QUIZ_GAP * 2);
    const order = want === 'move' ? ['move', 'judge'] : ['judge', 'move'];
    const kind = order.find((item) => (item === 'move' ? facts.move : judgeOk));
    if (kind !== 'move' && kind !== 'judge') continue;
    spots.push({ ply: cursor, kind });
    if (kind === 'judge') counts[facts.judge] += 1;
    last = cursor;
    want = kind === 'move' ? 'judge' : 'move';
  }
  return spots;
}

/**
 * 次の一手の候補(3つ)。実際に指された手(actual)とAIの手(expected)を入れ、残りは「駒をただで失わない手」のうち、
 * 実際の手と同じ駒の種類の手か、同じ升へ行く手を先に足す(もっともらしい手どうしにする。52-3の3)。並びは種で混ぜる。
 * @param {{ sfen: string, expected?: string, actual?: string, seed?: string }} input
 * @returns {string[]} USIの手
 */
export function quizChoices({ sfen, expected = '', actual = '', seed = '' }) {
  const record = createGameRecord(sfen);
  const legal = enumerateLegalMoves(record.position).map(({ usi }) => usi);
  if (!legal.length) return [];
  /** @type {string[]} */
  const picked = [];
  const add = (usi) => {
    if (usi && legal.includes(usi) && !picked.includes(usi) && picked.length < 3) picked.push(usi);
  };
  add(actual);
  add(expected);
  const state = parseSfenState(sfen);
  const kindOf = (usi) => {
    const parsed = parseUsiMove(usi);
    if (!parsed) return '';
    return parsed.drop ?? String(state.board.get(parsed.from)?.kind ?? '').replace('+', '');
  };
  const anchors = [actual, expected].filter(Boolean);
  const near = (usi) => anchors.some((anchor) => kindOf(anchor) === kindOf(usi) || destination(anchor) === destination(usi));
  const safe = (usi) => {
    try {
      const result = moveExchange(state, usi, { scope: 'moved' });
      return Boolean(result) && /** @type {{ risk: number }} */ (result).risk <= 0;
    } catch {
      return false;
    }
  };
  const base = relaySeed(`${seed}:${sfen}`);
  const ranked = legal
    .map((usi, index) => ({ usi, order: (base + Math.imul(index + 1, 2654435761)) >>> 0 }))
    .sort((a, b) => a.order - b.order)
    .map(({ usi }) => usi);
  const safeMoves = ranked.filter((usi) => !picked.includes(usi) && safe(usi));
  for (const usi of safeMoves.filter(near)) add(usi);
  for (const usi of safeMoves) add(usi);
  // ただで取られない手が足りないときだけ、ほかの手で埋める(候補は3つそろえる)。
  for (const usi of ranked) add(usi);
  // 並びを混ぜる(実際の手がいつも1番目にならないように)。
  return picked
    .map((usi, index) => ({ usi, order: (base ^ Math.imul(index + 7, 40503)) >>> 0 }))
    .sort((a, b) => a.order - b.order)
    .map(({ usi }) => usi);
}

/**
 * 問いの難しさ(★1〜3。当てたらその数だけ点。52-3の4)。
 * - 次の一手：実際の手がAIの最善と違う(棋士の個性)＝★3、駒を取る・成る手＝★2、静かな手＝★1。
 * - 形勢当て：形勢が駒の損得と逆＝★3、互角か駒の損得がない＝★2、駒を得している側が良い＝★1。
 * @param {{ kind: 'move' | 'judge', sfen: string, answer?: { move: string, best?: string } | null, judge?: string }} input
 * @returns {1 | 2 | 3}
 */
export function quizStars({ kind, sfen, answer = null, judge = '' }) {
  if (kind === 'move') {
    if (!answer) return 1;
    if (answer.best) return 3;
    const facts = moveFacts(sfen, answer.move);
    return facts.capture || facts.promote ? 2 : 1;
  }
  const lead = materialText(sfen).lead;
  if (judge === 'even' || !lead) return 2;
  return lead === judge ? 1 : 3;
}

const SIDE_WORD = Object.freeze({ black: '先手', white: '後手' });
/**
 * 形勢当ての答えのあとの、解説者の理由の1行(駒の損得と玉の守りから。52-3の5)。plainは敬語を使わない人(羽音)の言い方。
 * @param {{ sfen: string, judge: string, plain?: boolean }} input
 */
export function judgeReason({ sfen, judge, plain = false }) {
  const material = materialText(sfen);
  const guards = { black: kingGuard(sfen, 'black')?.guards ?? 0, white: kingGuard(sfen, 'white')?.guards ?? 0 };
  const lead = material.lead;
  const say = (polite, casual) => (plain ? casual : polite);
  if (judge === 'even') {
    if (!lead) return say('駒の損得も玉の堅さも、ほぼ互角ですね', '駒の損得も玉の堅さも、ほぼ互角');
    const other = lead === 'black' ? 'white' : 'black';
    const plus = guards[other] > guards[lead] ? '玉の堅さ' : '攻め';
    return say(
      `駒は${SIDE_WORD[lead]}が得ですが、${SIDE_WORD[other]}にも${plus}があって互角です`,
      `駒は${SIDE_WORD[lead]}が得。でも${SIDE_WORD[other]}にも${plus}があるから互角`,
    );
  }
  const side = judge === 'white' ? 'white' : 'black';
  const other = side === 'black' ? 'white' : 'black';
  const name = SIDE_WORD[side];
  if (lead === side) return say(`${material.text}で、${name}が良いですね`, `${material.text}。${name}が良い`);
  if (lead === other) {
    const why = guards[side] > guards[other] ? '玉が堅く' : '攻めが続いて';
    return say(
      `駒は${SIDE_WORD[other]}が得ですが、${name}の${why}、${name}が指しやすいですね`,
      `駒は${SIDE_WORD[other]}が得。でも${name}の${why}、${name}が指しやすい`,
    );
  }
  return guards[side] > guards[other]
    ? say(`駒の損得はありませんが、${name}の玉が堅いぶん${name}が良さそうです`, `駒の損得はない。${name}の玉が堅いぶん、${name}が良さそう`)
    : say(`駒の損得はありませんが、${name}の駒の働きが良いですね`, `駒の損得はない。${name}の駒の働きが良い`);
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
  const light = (player) => ({ id: player.id, name: player.name, nickname: player.nickname ?? '', dan: player.dan ?? '', rating: player.rating ?? 0, level: player.level ?? null, story: player.story ?? null, kind: player.kind ?? 'pro', character: player.character ?? null });
  const keep = {
    key: spec.key, event: spec.event, kind: spec.kind, label: spec.label, section: spec.section, order: spec.order, round: spec.round,
    weight: spec.weight, scale: spec.scale ?? '', venue: spec.venue ?? '', gameNo: spec.gameNo ?? 0, seed: spec.seed, quality: spec.quality ?? '',
    black: light(spec.black), white: light(spec.white), winner: spec.winner ?? null, openings: spec.openings ?? null,
    castles: spec.castles ?? null, story: spec.story ?? null, how: spec.how ?? null, tags: spec.tags ?? {}, series: spec.series ?? null,
  };
  const id = `${spec.key}#${ply}`;
  const next = [{ id, spec: keep, ply: clamp(Math.round(ply), 0, 999), sfen, moveText, savedAt }, ...notes.filter((note) => note.id !== id)];
  return next.slice(0, NOTES_LIMIT);
}

export const removeNote = (notes, id) => notes.filter((note) => note.id !== id);
export const saveNotes = (storage, notes) => writeJson(storage, NOTES_KEY, { notes });
