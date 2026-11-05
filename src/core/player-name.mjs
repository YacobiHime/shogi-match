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

/** 性別は任意。未選択は従来の保存にも使い、呼びかけは「さん」にする。 */
export const PLAYER_GENDERS = Object.freeze([
  { id: '', label: '選ばない' }, { id: 'male', label: '男性' }, { id: 'female', label: '女性' },
]);

function joinParts(family, given) {
  if (!family || !given) return family || given;
  return /[A-Za-z0-9]$/.test(family) || /^[A-Za-z0-9]/.test(given) ? `${family} ${given}` : `${family}${given}`;
}

/** 旧来の単一欄の名前は分割を推測せず名字欄へ移す。古い呼び方の固定指定は引き継がない。
 * @param {{ mode?: unknown, name?: unknown, family?: unknown, given?: unknown, gender?: unknown, nickname?: unknown, call?: unknown } | null | undefined} value
 */
export function normalizePlayerProfile(value) {
  /** @type {'' | 'male' | 'female'} */
  const gender = value?.gender === 'male' || value?.gender === 'female' ? value.gender : '';
  let family = normalizePlayerName(value?.family);
  let given = normalizePlayerName(value?.given);
  if (!family && !given && value?.mode !== 'split') family = normalizePlayerName(value?.name);
  while (Array.from(joinParts(family, given)).length > PLAYER_NAME_MAX) {
    if (given) given = Array.from(given).slice(0, -1).join('').trim();
    else family = Array.from(family).slice(0, -1).join('').trim();
  }
  return { mode: /** @type {'split'} */ ('split'), name: joinParts(family, given), family, given, gender, nickname: normalizePlayerName(value?.nickname) };
}

/** 物語の人物・場面側で指定する呼びかけ。名前設定では関係を固定しない。
 * @param {Parameters<typeof normalizePlayerProfile>[0]} profile
 * @param {{ part?: 'family' | 'given', style?: 'polite' | 'familiar' | 'bare' }} [relationship]
 */
export function playerAddress(profile, { part = 'family', style = 'polite' } = {}) {
  const p = normalizePlayerProfile(profile);
  if (!p.name) return 'あなた';
  const base = part === 'given' ? p.given || p.family : p.family || p.given;
  const suffix = !p.gender || style === 'polite' ? 'さん'
    : style === 'bare' ? '' : p.gender === 'female' ? 'ちゃん' : 'くん';
  return `${base}${suffix}`;
}

/** 既存の百花の親しい場面の互換入口。ほかの人物もplayerAddressで同じ選択を利用できる。 */
export function momokaCallName(profile) { return playerAddress(profile, { style: 'familiar' }); }

export function playerCallName(profile) {
  const p = normalizePlayerProfile(profile);
  return p.family || p.given;
}

/** 女流への進路を選べる性別。名前や呼び方から性別を推測しない。 */
export function canEnterWomenCareer(profile) { return normalizePlayerProfile(profile).gender === 'female'; }

/**
 * @param {Storage | null | undefined} storage
 * @returns {ReturnType<typeof normalizePlayerProfile>}
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
 * くわしい形で保存する。名前・性別・ニックネームがすべて空なら保存を消す。整えた形を返す。
 * @param {Storage | null | undefined} storage
 * @param {{ mode?: unknown, name?: unknown, family?: unknown, given?: unknown, call?: unknown, gender?: unknown, nickname?: unknown }} profile
 */
export function savePlayerProfile(storage, profile) {
  const normalized = normalizePlayerProfile(profile);
  try {
    if (!normalized.name && !normalized.gender && !normalized.nickname) storage?.removeItem(PLAYER_NAME_KEY);
    else storage?.setItem(PLAYER_NAME_KEY, JSON.stringify(normalized));
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
