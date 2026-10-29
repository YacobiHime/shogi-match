// 自分の対局の中継(docs/mate-finish-design.md)。大会の自分の対局の棋譜(手と考えた時間)を残し、あとで中継の画面で振り返れる形にする。
// 中継の項目(relay-games.mjsの項目と同じ形)は、棋譜を作らず、残した手を読み直して見せる(relay-game.mjsのreplayKifuGame)。
// 画面と保存の仕組みに依存しない。

import { relaySeed } from './relay-game.mjs';

export const MY_GAMES_KEY = 'yacobihime:shogi-match:my-games:v1';
/** 残す対局の数(1局およそ1〜2KB)。新しいものから。 */
export const MY_GAMES_LIMIT = 30;
/** 1手の考えた時間の上限(秒。置きっぱなしで記録がゆがまないように)。 */
export const MY_THINK_CAP_SECONDS = 600;

/** 中継で使う棋士の写し(relay-games.mjsのrelayPlayerと同じ項目)。 */
function playerCopy(player, fallback) {
  const source = player ?? {};
  return {
    id: source.id ?? fallback.id, name: source.name || fallback.name || '', dan: source.dan ?? '', rating: source.rating ?? 0,
    level: source.level ?? null, story: source.story ?? null, kind: source.kind ?? fallback.kind ?? 'pro', age: source.age ?? null,
    character: source.character ?? null, repertoire: source.repertoire ?? null,
  };
}

/**
 * 残す1局。userColorはプレイヤーの側、winnerは勝った側、reasonは終わり方(詰み・投了)。
 * timesは各手の考えた時間(秒)。足りない分は1秒にする。
 * @param {{
 *   at: number, event: string, eventText?: string, label?: string, venue?: string, weight?: string,
 *   userColor: 'black' | 'white', user: { name: string, dan?: string, rating?: number }, opponent: any,
 *   winner: 'black' | 'white', reason: 'mate' | 'resign', moves: string[], times?: number[], mate?: { plies: number, from: number } | null,
 * }} input
 */
export function myGameRecord({
  at, event, eventText = '', label = '', venue = '', weight = 'plain', userColor, user, opponent, winner, reason, moves, times = [], mate = null,
}) {
  const seconds = moves.map((_, index) => {
    const value = Math.round(Number(times[index]));
    return Number.isFinite(value) && value > 0 ? Math.min(MY_THINK_CAP_SECONDS, value) : 1;
  });
  return {
    id: `${event}:${at}`, at, event, eventText, label, venue, weight, userColor,
    user: { name: user.name, dan: user.dan ?? '', rating: user.rating ?? 0 },
    opponent: playerCopy(opponent, { id: 'opponent', name: '相手' }),
    winner, reason: reason === 'mate' ? 'mate' : 'resign', moves: [...moves], times: seconds,
    mate: mate && Number.isFinite(mate.plies) ? { plies: mate.plies, from: mate.from } : null,
  };
}

/** 保存した自分の対局(新しい順)。読めなければ空。形の合わないものは捨てる。 */
export function loadMyGames(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(MY_GAMES_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((game) => game && typeof game.id === 'string' && Array.isArray(game.moves) && game.moves.length
      && Array.isArray(game.times) && game.times.length === game.moves.length
      && (game.winner === 'black' || game.winner === 'white') && (game.userColor === 'black' || game.userColor === 'white'));
  } catch {
    return [];
  }
}

/** 1局を足す(同じidは置き換え)。保存できなくても遊びは止めない。 */
export function saveMyGame(storage, game) {
  const list = [game, ...loadMyGames(storage).filter((item) => item.id !== game.id)].slice(0, MY_GAMES_LIMIT);
  try {
    storage?.setItem(MY_GAMES_KEY, JSON.stringify(list));
  } catch {
    // 保存できない環境では、中継で振り返れないだけにする。
  }
  return list;
}

/** 中継の項目の鍵(relay-store.mjsの棋譜の鍵にもなる)。 */
export const myRelayKey = (game) => `mine:${game.id}`;

/**
 * 中継の項目(relay-games.mjsの項目と同じ形)。section「mine」で、一覧の「あなたの対局」に並ぶ。
 * kifuがあるので、中継の画面は棋譜を作らず、残した手を読み直す。
 * @param {ReturnType<typeof myGameRecord>} game
 */
export function myRelaySpec(game) {
  const key = myRelayKey(game);
  const you = { id: 'user', name: game.user.name, dan: game.user.dan, rating: game.user.rating, level: null, story: null, kind: 'user', age: null, character: null, repertoire: null };
  const black = game.userColor === 'black' ? you : game.opponent;
  const white = game.userColor === 'black' ? game.opponent : you;
  return {
    key, event: game.event, kind: game.weight === 'title' ? 'finals' : 'game',
    label: [game.eventText, game.label].filter(Boolean).join(' '), section: 'mine', order: game.at, round: 0,
    weight: game.weight, venue: game.venue, gameNo: 0, seed: relaySeed(key), series: null, quality: '',
    black, white, winner: game.winner, openings: { black: null, white: null }, castles: { black: null, white: null },
    story: null, how: 'ending',
    tags: { rival: false, father: false, oshi: false, next: false, self: false, mine: true, current: false },
    kifu: { moves: game.moves, times: game.times, reason: game.reason }, mate: game.mate, at: game.at,
  };
}
