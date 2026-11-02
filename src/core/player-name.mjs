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

/** 入れ方。'single'はそのまま1つの欄、'split'は名字と名前に分けて入れる。 */
export const PLAYER_NAME_MODES = Object.freeze(['single', 'split']);

/** 名字と名前のどちらかにローマ字・数字などがあれば、あいだに空白を入れて並べる(「Taro Yamada」)。日本語の名前は続けて書く。 */
function joinParts(family, given) {
  if (!family || !given) return family || given;
  return /[A-Za-z0-9]$/.test(family) || /^[A-Za-z0-9]/.test(given) ? `${family} ${given}` : `${family}${given}`;
}

/**
 * プレイヤー名のくわしい形に整える。名字と名前に分けたときは、合わせて上限の文字数に収まるよう、名前・名字の順に後ろを切る。
 * @param {{ mode?: unknown, name?: unknown, family?: unknown, given?: unknown } | null | undefined} value
 * @returns {{ mode: 'single' | 'split', name: string, family: string, given: string }}
 */
export function normalizePlayerProfile(value) {
  const mode = value?.mode === 'split' ? 'split' : 'single';
  if (mode === 'single') return { mode, name: normalizePlayerName(value?.name), family: '', given: '' };
  let family = normalizePlayerName(value?.family);
  let given = normalizePlayerName(value?.given);
  while (Array.from(joinParts(family, given)).length > PLAYER_NAME_MAX) {
    if (given) given = Array.from(given).slice(0, -1).join('').trim();
    else family = Array.from(family).slice(0, -1).join('').trim();
  }
  return { mode, name: joinParts(family, given), family, given };
}

/**
 * 呼びかけに使う名前(「○○さん」の○○)。名字と名前に分けたときは名字、そうでなければ名前全体。入れていなければ空。
 * @param {{ mode?: string, name?: string, family?: string } | null | undefined} profile
 */
export function playerCallName(profile) {
  const normalized = normalizePlayerProfile(profile);
  return normalized.mode === 'split' && normalized.family ? normalized.family : normalized.name;
}

/**
 * @param {Storage | null | undefined} storage
 * @returns {{ mode: 'single' | 'split', name: string, family: string, given: string }}
 */
export function loadPlayerProfile(storage) {
  try {
    const raw = storage?.getItem(PLAYER_NAME_KEY);
    if (!raw) return normalizePlayerProfile(null);
    return normalizePlayerProfile(JSON.parse(raw));
  } catch {
    return normalizePlayerProfile(null);
  }
}

/**
 * @param {Storage | null | undefined} storage
 * @returns {string}
 */
export function loadPlayerName(storage) {
  return loadPlayerProfile(storage).name;
}

/**
 * くわしい形で保存する。名前が空なら保存を消す(入れ方の選びも消え、次はそのまま入れる欄から)。整えた形を返す。
 * @param {Storage | null | undefined} storage
 * @param {{ mode?: unknown, name?: unknown, family?: unknown, given?: unknown }} profile
 */
export function savePlayerProfile(storage, profile) {
  const normalized = normalizePlayerProfile(profile);
  try {
    if (!normalized.name) storage?.removeItem(PLAYER_NAME_KEY);
    else storage?.setItem(PLAYER_NAME_KEY, JSON.stringify(normalized.mode === 'split' ? normalized : { mode: 'single', name: normalized.name }));
  } catch {
    // 保存できなくても、この場では使う。
  }
  return normalized;
}

/**
 * 保存する。空なら保存を消す。整えた名前を返す。
 * @param {Storage | null | undefined} storage
 * @param {string} name
 */
export function savePlayerName(storage, name) {
  return savePlayerProfile(storage, { mode: 'single', name }).name;
}
