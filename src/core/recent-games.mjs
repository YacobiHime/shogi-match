/**
 * 最近の自分の対局(平手・対CPUで、終局まで指したもの)。終盤戦の開始局面に、名局と並べて使う。
 * 対局画面から保存するので、軽く保つ(局面の計算は終盤戦のモジュールがする)。
 */

export const RECENT_GAMES_KEY = 'yacobihime:shogi-match:recent-games:v1';
/** 覚えておく対局の数。 */
export const RECENT_GAMES_MAX = 10;
/** 終盤戦に使える長さ(終局の24〜40手前から始めるため、短すぎる対局は残さない)。 */
export const RECENT_GAME_MIN_PLIES = 60;

/**
 * 1局を足す。短い対局・勝ち負けのない対局は足さない。新しい順に RECENT_GAMES_MAX 局まで。
 * @param {{ at: number, moves: string[], winner: 'black' | 'white' | null, opponent: string }[]} list
 * @param {{ at?: number, moves: string[], winner: 'black' | 'white' | null, opponent?: string }} game
 */
export function addRecentGame(list, { at = Date.now(), moves, winner, opponent = '' }) {
  if (!winner || !Array.isArray(moves) || moves.length < RECENT_GAME_MIN_PLIES) return list;
  return [{ at, moves: [...moves], winner, opponent }, ...list].slice(0, RECENT_GAMES_MAX);
}

/** 終盤戦で出す、対局の名前。 */
export function recentGameTitle(game) {
  const date = new Date(game.at);
  const day = Number.isNaN(date.getTime()) ? '' : `${date.getMonth() + 1}/${date.getDate()}`;
  return `あなたの対局（${[day, game.opponent ? `対 ${game.opponent}` : ''].filter(Boolean).join(' ')}）`;
}

export function loadRecentGames(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(RECENT_GAMES_KEY) ?? '[]');
    return Array.isArray(parsed)
      ? parsed.filter((game) => game && Array.isArray(game.moves) && game.moves.every((usi) => typeof usi === 'string')
        && (game.winner === 'black' || game.winner === 'white')).slice(0, RECENT_GAMES_MAX)
      : [];
  } catch {
    return [];
  }
}

export function saveRecentGames(storage, list) {
  try {
    storage?.setItem(RECENT_GAMES_KEY, JSON.stringify(list));
  } catch {
    // 保存できない環境では、名局だけで遊ぶ。
  }
}
