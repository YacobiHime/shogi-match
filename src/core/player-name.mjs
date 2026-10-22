// プレイヤー名。タイトル画面の記録の帯の横で入れる。端末に保存し、盤の名札・対局準備・竜王戦の表とVS画面に出す。
// 入れていないときは「あなた」と呼ぶ(盤の名札は、今までどおり先手・後手の表示名)。

/** 保存の鍵。 */
export const PLAYER_NAME_KEY = 'yacobihime:shogi-match:player-name:v1';
/** 名前の長さの上限(文字数)。盤の名札とトーナメント表の縦書きの枠に収まる長さ。 */
export const PLAYER_NAME_MAX = 10;
/** 名前を入れていないときの呼び方。 */
export const DEFAULT_PLAYER_NAME = 'あなた';

/**
 * 入力を名前に整える。前後の空白を除き、制御文字を消し、続く空白を1つにし、上限の文字数で切る。
 * @param {unknown} value
 * @returns {string} 空なら名前なし
 */
export function normalizePlayerName(value) {
  if (typeof value !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
  return Array.from(cleaned).slice(0, PLAYER_NAME_MAX).join('').trim();
}

/** 画面で呼ぶ名前。入れていなければ「あなた」。 */
export function playerDisplayName(name) {
  return normalizePlayerName(name) || DEFAULT_PLAYER_NAME;
}

/**
 * @param {Storage | null | undefined} storage
 * @returns {string}
 */
export function loadPlayerName(storage) {
  try {
    const raw = storage?.getItem(PLAYER_NAME_KEY);
    if (!raw) return '';
    const data = JSON.parse(raw);
    return normalizePlayerName(data?.name);
  } catch {
    return '';
  }
}

/**
 * 保存する。空なら保存を消す。整えた名前を返す。
 * @param {Storage | null | undefined} storage
 * @param {string} name
 */
export function savePlayerName(storage, name) {
  const normalized = normalizePlayerName(name);
  try {
    if (!normalized) storage?.removeItem(PLAYER_NAME_KEY);
    else storage?.setItem(PLAYER_NAME_KEY, JSON.stringify({ name: normalized }));
  } catch {
    // 保存できなくても、この場では使う。
  }
  return normalized;
}
