/**
 * 盤と駒の着せ替え。盤の部品(ShogiMatchBoard.vue)、終局画面、やこびノートで同じ一覧を使う。
 * 一部は、コレクションの印の数で使えるようになる(core/collection.mjsのTHEME_UNLOCKS)。
 */

export const BOARD_THEMES = Object.freeze([
  { id: 'wood_light2', name: '木目・明るめ', file: 'wood_light2.webp' },
  { id: 'sunfish_light', name: '白木', file: 'sunfish_light.webp' },
  { id: 'sunfish_warm', name: '暖色木目', file: 'sunfish_warm.webp' },
  { id: 'sunfish_dark', name: '濃色', file: 'sunfish_dark.webp' },
  { id: 'sunfish_resin', name: '樹脂', file: 'sunfish_resin.webp' },
]);

export const PIECE_THEMES = Object.freeze([
  { id: 'hitomoji_wood', name: '一文字・木目' },
  { id: 'hitomoji', name: '一文字' },
  { id: 'hitomoji_dark', name: '一文字・濃色' },
  { id: 'hitomoji_gothic', name: '一文字・ゴシック' },
  { id: 'hitomoji_gothic_dark', name: '一文字・ゴシック濃色' },
  { id: 'futamoji', name: '二文字' },
]);

export const BOARD_THEME_KEY = 'shogi-match-board-theme';
export const PIECE_THEME_KEY = 'shogi-match-piece-theme';
export const DEFAULT_BOARD_THEME = 'wood_light2';
export const DEFAULT_PIECE_THEME = 'hitomoji_wood';

/** 着せ替えの名前。知らないIDはIDのまま返す。 */
export function themeName(kind, id) {
  return (kind === 'board' ? BOARD_THEMES : PIECE_THEMES).find((theme) => theme.id === id)?.name ?? id;
}

/** 着せ替えを変えたときに、開いている盤へ知らせるイベント。 */
export const THEME_CHANGE_EVENT = 'shogi-match:theme-change';

/** 着せ替えを保存し、開いている盤へ知らせる。保存できない環境でも、知らせは送る。 */
export function saveTheme(kind, id) {
  try {
    localStorage.setItem(kind === 'board' ? BOARD_THEME_KEY : PIECE_THEME_KEY, id);
  } catch {
    // 保存できない環境では、この画面の間だけ使う。
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: { kind, id } }));
}
