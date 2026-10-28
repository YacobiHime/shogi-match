// 中継の棋譜の保存(docs/tournament-relay-design.mdの8章)。作った棋譜を端末に残し、次からはすぐ見られるようにする。
// 新しく見たものから上限の数だけ残し、古いものから消す。読み込みに失敗しても遊べる(棋譜を作り直す)。画面に依存しない。

import { RELAY_VERSION } from './relay-game.mjs';

export const RELAY_STORE_KEY = 'yacobihime:shogi-match:relay:v1';
/** 残す棋譜の数(1局およそ2〜5KB)。 */
export const RELAY_STORE_LIMIT = 60;
/** 視聴済みの印を残す数。 */
const SEEN_LIMIT = 400;

/** 手の印(1手1文字)。 */
const MARK_CODES = Object.freeze({ '': '.', book: 'b', slip: 's', error: 'e', decisive: 'd', mate: 'm', only: 'o' });
const MARK_NAMES = Object.fromEntries(Object.entries(MARK_CODES).map(([name, code]) => [code, name]));

export function emptyRelayStore() {
  return { v: 1, games: {}, order: [], seen: [] };
}

/** 棋譜を、保存の形(手の並びを文字列に、数を配列に)にする。 */
export function packRelayGame(game) {
  const best = {};
  const loss = {};
  game.entries.forEach((entry, index) => {
    if (entry.best) best[index] = entry.best;
    if (entry.loss) loss[index] = entry.loss;
  });
  return {
    v: game.v ?? RELAY_VERSION,
    m: game.entries.map(({ move }) => move).join(' '),
    e: game.entries.map((entry) => Math.round(entry.eval)),
    t: game.entries.map((entry) => Math.round(entry.time)),
    p: game.entries.map((entry) => entry.pv ?? ''),
    k: game.entries.map((entry) => MARK_CODES[entry.mark] ?? '.').join(''),
    b: best,
    l: loss,
    end: game.end,
  };
}

/** 保存の形を、棋譜に戻す。形が合わなければnull。 */
export function unpackRelayGame(key, packed) {
  if (!packed || typeof packed.m !== 'string' || !Array.isArray(packed.e) || !Array.isArray(packed.t)) return null;
  const moves = packed.m ? packed.m.split(' ') : [];
  if (moves.length !== packed.e.length || moves.length !== packed.t.length) return null;
  const end = packed.end;
  if (!end || (end.winner !== 'black' && end.winner !== 'white')) return null;
  return {
    v: packed.v ?? RELAY_VERSION,
    key,
    entries: moves.map((move, index) => ({
      move,
      eval: Number(packed.e[index]) || 0,
      pv: typeof packed.p?.[index] === 'string' ? packed.p[index] : '',
      best: packed.b?.[index] ?? '',
      loss: Number(packed.l?.[index]) || 0,
      time: Math.max(0, Number(packed.t[index]) || 0),
      mark: MARK_NAMES[packed.k?.[index]] ?? '',
    })),
    end: { winner: end.winner, reason: end.reason === 'mate' ? 'mate' : 'resign', plies: Number(end.plies) || moves.length },
  };
}

export function loadRelayStore(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(RELAY_STORE_KEY) ?? 'null');
    if (!parsed || parsed.v !== 1 || typeof parsed.games !== 'object' || !Array.isArray(parsed.order)) return emptyRelayStore();
    const order = parsed.order.filter((key) => typeof key === 'string' && parsed.games[key]);
    return {
      v: 1,
      games: Object.fromEntries(order.map((key) => [key, parsed.games[key]])),
      order,
      seen: Array.isArray(parsed.seen) ? parsed.seen.filter((key) => typeof key === 'string').slice(-SEEN_LIMIT) : [],
    };
  } catch {
    return emptyRelayStore();
  }
}

export function saveRelayStore(storage, store) {
  try {
    storage?.setItem(RELAY_STORE_KEY, JSON.stringify(store));
  } catch {
    // 保存できない(容量がいっぱいなど)ときは、古い棋譜を半分にして、もう一度だけ試す。
    try {
      const keep = store.order.slice(-Math.floor(store.order.length / 2));
      storage?.setItem(RELAY_STORE_KEY, JSON.stringify({ ...store, games: Object.fromEntries(keep.map((key) => [key, store.games[key]])), order: keep }));
    } catch {
      // それでも保存できなければ、その場かぎりで見る。
    }
  }
}

/** 棋譜を残す(いちばん新しいものにする)。上限を超えたら古いものから消す。 */
export function rememberRelayGame(store, game, limit = RELAY_STORE_LIMIT) {
  const order = [...store.order.filter((key) => key !== game.key), game.key];
  const drop = order.slice(0, Math.max(0, order.length - limit));
  const games = { ...store.games, [game.key]: packRelayGame(game) };
  for (const key of drop) delete games[key];
  return { ...store, games, order: order.slice(drop.length) };
}

/**
 * 前の版(1)で作った棋譜のうち、最後の形勢が負けた側に傾いたまま終わったもの(優勢なのに投了。15章)。作り直す。
 * @param {{ v: number, entries: { eval: number }[], end: { winner: string } }} game
 */
export function isStaleRelayGame(game) {
  if ((game.v ?? 1) >= RELAY_VERSION) return false;
  const last = game.entries.at(-1);
  return Boolean(last) && (game.end.winner === 'black' ? last.eval : -last.eval) <= 0;
}

/** 残してある棋譜(なければnull)。見たものは、いちばん新しいものにする。前の版の崩れた棋譜は、ないものとして作り直す。 */
export function recallRelayGame(store, key) {
  const game = unpackRelayGame(key, store.games?.[key]);
  if (!game || isStaleRelayGame(game)) return { store, game: null };
  return { store: { ...store, order: [...store.order.filter((other) => other !== key), key] }, game };
}

/** 視聴済みの印を付ける。 */
export function markRelaySeen(store, key) {
  if (store.seen.includes(key)) return store;
  return { ...store, seen: [...store.seen, key].slice(-SEEN_LIMIT) };
}
