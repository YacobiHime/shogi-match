// ノベルの場面のUIの、画面に依存しない処理(docs/novel-scene-design.md)。
// 文字とオートの速さ、設定と読んだ行の印の保存、読み返し(ログ)の行、操作の言葉。画面はNovelScene.vue。
// 文字の音とクリックの音の決め方はnovel-sound.mjs(11章)。

import { DEFAULT_VOICE_STYLE, normalizeVoiceStyle } from './novel-sound.mjs';

/** 設定の保存(データリセットでは消さない設定)。 */
export const NOVEL_SETTINGS_KEY = 'yacobihime:shogi-match:novel-settings:v1';
/** 読んだ行の印の保存(データリセットの「大会の進み具合」で消す)。 */
export const NOVEL_READ_KEY = 'yacobihime:shogi-match:novel-read:v1';

/** 文字の速さ(1字の間隔、ミリ秒)。4-4。 */
export const TEXT_SPEEDS = Object.freeze({
  slow: Object.freeze({ label: 'ゆっくり', charMs: 55 }),
  normal: Object.freeze({ label: 'ふつう', charMs: 30 }),
  fast: Object.freeze({ label: 'はやい', charMs: 14 }),
  instant: Object.freeze({ label: 'すぐ', charMs: 0 }),
});

/** オートの速さ(文が出きってから進むまで: base + 1字ごと、上限max)。4-4。 */
export const AUTO_SPEEDS = Object.freeze({
  slow: Object.freeze({ label: 'ゆっくり', baseMs: 2200, perCharMs: 90, maxMs: 7000 }),
  normal: Object.freeze({ label: 'ふつう', baseMs: 1400, perCharMs: 60, maxMs: 6000 }),
  fast: Object.freeze({ label: 'はやい', baseMs: 800, perCharMs: 35, maxMs: 4000 }),
});

/** Ctrlの早送りの1行の間隔(ミリ秒)。 */
export const FAST_FORWARD_MS = 70;
/** 場所の札が大きく出ている時間(ミリ秒)。 */
export const PLACE_CARD_MS = 1800;

/** 1つの場面で覚える行と、覚える場面の数の上限(4-5)。 */
export const READ_LINES_PER_SCENE = 200;
export const READ_SCENES_MAX = 120;

/** @typedef {{ text: keyof typeof TEXT_SPEEDS, auto: keyof typeof AUTO_SPEEDS, voice: 'auto' | 'type' | 'signal' | 'off' }} NovelSettings */

/** @type {NovelSettings} */
export const DEFAULT_NOVEL_SETTINGS = Object.freeze({ text: 'normal', auto: 'normal', voice: /** @type {'auto'} */ (DEFAULT_VOICE_STYLE) });

/**
 * 場面の背景(CSSで描く。画像を足さない)。教室の夕方(壁と床)、会館(畳と障子の色)、会場(明かり)、夜。
 * ノベルの場面(NovelScene.vue)と、ストーリー選択のカードの小さな絵(PickCard.vue)で同じものを使う(docs/story-mode-design.mdの1章)。
 */
export const NOVEL_BACKGROUND_CSS = Object.freeze({
  classroom: 'repeating-linear-gradient(90deg, rgba(90, 60, 40, 0.25) 0 2px, transparent 2px 120px), linear-gradient(180deg, #ffd9a8 0%, #f4b27a 52%, #8a5a3e 53%, #4a3326 100%)',
  hall: 'repeating-linear-gradient(90deg, rgba(255, 252, 244, 0.18) 0 3px, transparent 3px 90px), linear-gradient(180deg, #e9dcc1 0%, #cdb990 55%, #8c9a5b 56%, #5f6d3c 100%)',
  venue: 'radial-gradient(ellipse at 50% 0%, rgba(255, 236, 190, 0.55), transparent 60%), linear-gradient(180deg, #3e4f6a 0%, #2b3850 55%, #5b4632 56%, #3a2c20 100%)',
  night: 'radial-gradient(circle at 80% 18%, rgba(255, 252, 230, 0.9) 0 2.2em, transparent 2.3em), linear-gradient(180deg, #0f1a2e 0%, #1c2b47 60%, #273652 100%)',
});

/** 背景のCSS(知らない背景は会場)。 */
export const novelBackground = (id) => NOVEL_BACKGROUND_CSS[/** @type {keyof typeof NOVEL_BACKGROUND_CSS} */ (id)] ?? NOVEL_BACKGROUND_CSS.venue;

/** 画面の言葉(U:4 文言は1か所に)。 */
export const NOVEL_UI_TEXT = Object.freeze({
  log: 'ログ',
  auto: 'オート',
  hide: '隠す',
  settings: '設定',
  toolsLabel: '読む操作',
  skip: '飛ばす',
  next: 'つぎへ',
  end: 'おわり',
  logTitle: 'これまでの話',
  logEmpty: 'まだ何も話していないよ。',
  close: '閉じる',
  settingsTitle: '読み方の設定',
  textSpeed: '文字の速さ',
  autoSpeed: 'オートの速さ',
  voice: '文字の音',
  voiceNote: '対局画面のメニューの「効果音」がOFFだと、音はぜんぶ鳴らないよ。',
  summaryTitle: 'あらすじ',
  keepReading: '続きを読む',
  skipNow: '飛ばす',
  choiceSkipNote: '飛ばすと、答えなかったことになるよ。',
  hiddenHint: '押すと、文の窓が戻るよ',
  choicesLabel: '答えを選ぶ',
  pickedPrefix: '▶ ',
  keysNote: 'キー: Enter・Space で進む / ↑ でログ / A でオート / H で隠す / Ctrl を押している間は読んだところを早送り',
});

/**
 * 設定をそろえる(知らない値はふつうに戻す)。
 * @param {any} value
 * @returns {NovelSettings}
 */
export function normalizeNovelSettings(value) {
  const text = value && Object.hasOwn(TEXT_SPEEDS, value.text) ? value.text : DEFAULT_NOVEL_SETTINGS.text;
  const auto = value && Object.hasOwn(AUTO_SPEEDS, value.auto) ? value.auto : DEFAULT_NOVEL_SETTINGS.auto;
  const voice = /** @type {NovelSettings['voice']} */ (normalizeVoiceStyle(value?.voice));
  return { text, auto, voice };
}

/**
 * @param {Pick<Storage, 'getItem'> | null | undefined} storage
 * @returns {NovelSettings}
 */
export function loadNovelSettings(storage) {
  try {
    const raw = storage?.getItem(NOVEL_SETTINGS_KEY);
    return normalizeNovelSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_NOVEL_SETTINGS };
  }
}

/**
 * @param {Pick<Storage, 'setItem'> | null | undefined} storage
 * @param {NovelSettings} settings
 */
export function saveNovelSettings(storage, settings) {
  try {
    storage?.setItem(NOVEL_SETTINGS_KEY, JSON.stringify(normalizeNovelSettings(settings)));
  } catch {
    // 保存できなくても読むのは止めない。
  }
}

/**
 * 1字の間隔(ミリ秒)。
 * @param {Partial<NovelSettings>} [settings]
 */
export function charDelayMs(settings) {
  return TEXT_SPEEDS[normalizeNovelSettings(settings).text].charMs;
}

/**
 * オートで、文が出きってから次の行へ進むまでの待ち(ミリ秒)。長い文ほど長く待つ。
 * @param {string} text
 * @param {Partial<NovelSettings>} [settings]
 */
export function autoWaitMs(text, settings) {
  const speed = AUTO_SPEEDS[normalizeNovelSettings(settings).auto];
  const chars = Array.from(String(text ?? '')).length;
  return Math.min(speed.maxMs, speed.baseMs + chars * speed.perCharMs);
}

/**
 * 行の印(話す人と文から作る短い文字列。FNV-1a)。名前を差し込んだあとの文で作るので、名前が変わると別の行になる。
 * @param {{ who?: string, text?: string }} line
 */
export function lineKey(line) {
  const source = `${line?.who ?? ''}\u0000${line?.text ?? ''}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

/** @typedef {{ order: string[], scenes: Record<string, string[]> }} NovelRead */

/** @returns {NovelRead} */
function emptyRead() {
  return { order: [], scenes: {} };
}

/**
 * @param {Pick<Storage, 'getItem'> | null | undefined} storage
 * @returns {NovelRead}
 */
export function loadNovelRead(storage) {
  try {
    const raw = storage?.getItem(NOVEL_READ_KEY);
    const value = raw ? JSON.parse(raw) : null;
    if (!value || typeof value !== 'object' || !value.scenes || typeof value.scenes !== 'object') return emptyRead();
    /** @type {Record<string, string[]>} */
    const scenes = {};
    for (const [id, keys] of Object.entries(value.scenes)) {
      if (Array.isArray(keys)) scenes[id] = keys.filter((key) => typeof key === 'string').slice(-READ_LINES_PER_SCENE);
    }
    const order = (Array.isArray(value.order) ? value.order : Object.keys(scenes)).filter((id) => Object.hasOwn(scenes, id));
    return { order, scenes };
  } catch {
    return emptyRead();
  }
}

/**
 * @param {Pick<Storage, 'setItem'> | null | undefined} storage
 * @param {NovelRead} read
 */
export function saveNovelRead(storage, read) {
  try {
    storage?.setItem(NOVEL_READ_KEY, JSON.stringify(read));
  } catch {
    // 保存できなくても読むのは止めない。
  }
}

/**
 * 行を読んだ印を付けた新しい記録(場面と行の上限を超えたら古いものから捨てる)。
 * @param {NovelRead} read
 * @param {string} sceneId
 * @param {string} key
 * @returns {NovelRead}
 */
export function markLineRead(read, sceneId, key) {
  if (!sceneId || !key) return read;
  const current = read.scenes[sceneId] ?? [];
  if (current.includes(key)) return read;
  const scenes = { ...read.scenes, [sceneId]: [...current, key].slice(-READ_LINES_PER_SCENE) };
  let order = [...read.order.filter((id) => id !== sceneId), sceneId];
  while (order.length > READ_SCENES_MAX) {
    const dropped = order.shift();
    if (dropped) delete scenes[dropped];
  }
  return { order, scenes };
}

/**
 * @param {NovelRead} read
 * @param {string} sceneId
 * @param {string} key
 */
export function isLineRead(read, sceneId, key) {
  return Boolean(read.scenes[sceneId]?.includes(key));
}

/**
 * 場面の行をすべて読んだか(選択肢の返しは数えない。台本の行だけ)。
 * @param {NovelRead} read
 * @param {{ id: string, lines: { who?: string, text?: string }[] }} scene
 */
export function isSceneRead(read, scene) {
  if (!scene?.lines?.length) return false;
  return scene.lines.every((line) => isLineRead(read, scene.id, lineKey(line)));
}

/**
 * 「飛ばす」で、あらすじを見せるか(まだ読んでいない場面で、あらすじがあるときだけ)。
 * @param {NovelRead} read
 * @param {{ id: string, summary?: string, lines: { who?: string, text?: string }[] }} scene
 */
export function shouldShowSummary(read, scene) {
  return Boolean(scene?.summary) && !isSceneRead(read, scene);
}

/**
 * @typedef {{ who: string, name: string, text: string, picked?: string }} BacklogEntry
 */

/**
 * 読み返し(ログ)の行。いまの行まで(文が出きっていなければ、いまの行は入れない)。選んだ答えは、その行の下に「▶ 答え」。
 * @param {{ who: string, name: string, text: string }[]} lines
 * @param {number} index いまの行
 * @param {boolean} complete いまの行の文が出きったか
 * @param {Record<number, string>} [picks] 行の番号 → 選んだ答え
 * @returns {BacklogEntry[]}
 */
export function backlogEntries(lines, index, complete, picks = {}) {
  const last = complete ? index : index - 1;
  /** @type {BacklogEntry[]} */
  const entries = [];
  for (let at = 0; at <= last && at < lines.length; at += 1) {
    const line = lines[at];
    entries.push({ who: line.who, name: line.name ?? '', text: line.text, ...(picks[at] ? { picked: picks[at] } : {}) });
  }
  return entries;
}

/**
 * 表情が変わったか(立ち絵の小さな跳ね)。
 * @param {{ who: string, face: string }[]} lines
 * @param {number} index
 */
export function faceChangedAt(lines, index) {
  const line = lines[index];
  if (!line || line.who === 'narration') return false;
  for (let at = index - 1; at >= 0; at -= 1) {
    if (lines[at].who === line.who) return lines[at].face !== line.face;
  }
  return false;
}
