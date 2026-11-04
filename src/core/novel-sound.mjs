// ノベルの場面の文字の音とクリックの音(docs/novel-scene-design.mdの11章)。画面と音の出し方(Web Audio)に依存しない。
// 音はファイルを使わず、その場で作る(src/novel-audio.ts)。ここでは「どの字で・どんな音を・どの高さで鳴らすか」だけを決める。

/**
 * 文字の音の種類(読み方の設定で選ぶ)。
 * おまかせは、地の文をタイプライター、台詞を信号の音にし、話す人ごとに高さを変える(誰が話しているかを音でも分かるように。UD:5-3)。
 */
export const VOICE_STYLES = Object.freeze({
  auto: Object.freeze({ label: 'おまかせ' }),
  type: Object.freeze({ label: 'タイプ' }),
  signal: Object.freeze({ label: '信号' }),
  off: Object.freeze({ label: 'なし' }),
});
export const DEFAULT_VOICE_STYLE = 'auto';

/** 話す人ごとの音の高さ(Hz)。羽音は落ち着いた低め、百花は明るい高め。知らない人は真ん中。 */
export const VOICE_PITCH = Object.freeze({
  narration: 760,
  hanane: 540,
  momoka: 880,
  you: 660,
  host: 600,
});
const DEFAULT_PITCH = 700;

/**
 * 文字の音を鳴らす間の下限(ミリ秒)。字が速く出るときは数字おきに鳴らし、音が重なってうるさくならないようにする(U:5)。
 * ふつうの速さ(1字30ms)では2字に1回、ゆっくり(55ms)では1字ずつ。
 */
export const BLIP_MIN_GAP_MS = 50;

/** 音の大きさ(0〜1)。駒音より小さく、文を読むじゃまにならない大きさ(G:3-3 重要度で音量)。 */
export const NOVEL_SOUND_GAIN = Object.freeze({ signal: 0.05, type: 0.09, click: 0.11, choice: 0.13, tool: 0.06 });

/** 鳴らさない字(空白・句読点・かっこ・記号)。間(ま)として黙る。 */
const SILENT = /[\s、。，．,.!！?？…‥・「」『』（）()［］【】〈〉《》―ー〜~"'“”‘’：:;；]/u;

/**
 * 話す人とスタイルから、使う音の形(信号かタイプか)。
 * @param {string} who
 * @param {keyof typeof VOICE_STYLES} style
 * @returns {'signal' | 'type' | null}
 */
export function voiceKind(who, style) {
  if (style === 'off') return null;
  if (style === 'type' || style === 'signal') return style;
  return who === 'narration' ? 'type' : 'signal';
}

/**
 * 1字の音の計画(鳴らさないときはnull)。
 * 信号はモールス信号のように、字ごとに短い音(トン)と長い音(ツー)を混ぜる。高さは話す人ごとに決め、字ごとに少しだけ揺らす。
 * タイプは、紙を打つ短い雑音。話す人ごとに雑音の高さを少し変える。
 * @param {{ char: string, who: string, style: keyof typeof VOICE_STYLES, sinceLastMs: number }} options
 * @returns {{ kind: 'signal' | 'type', freq: number, ms: number, gain: number } | null}
 */
export function blipPlan({ char, who, style, sinceLastMs }) {
  const kind = voiceKind(who, style);
  if (!kind || !char || SILENT.test(char)) return null;
  if (sinceLastMs < BLIP_MIN_GAP_MS) return null;
  const code = char.codePointAt(0) ?? 0;
  const base = VOICE_PITCH[/** @type {keyof typeof VOICE_PITCH} */ (who)] ?? DEFAULT_PITCH;
  // 字ごとの揺れ(±3%)。同じ字は同じ高さ(決まった音にする)。
  const freq = Math.round(base * (1 + ((code % 7) - 3) * 0.01));
  if (kind === 'signal') {
    // 4字に1字ぐらいを長い音(ツー)にする。
    const dash = code % 4 === 0;
    return { kind, freq, ms: dash ? 70 : 32, gain: NOVEL_SOUND_GAIN.signal };
  }
  return { kind, freq: freq * 3, ms: 16, gain: NOVEL_SOUND_GAIN.type };
}

/**
 * クリックの音の計画。進む(click)・答えを選ぶ(choice)・下の帯のボタン(tool)。
 * 柔らかい「ポッ」(高い音から少し下がる)。答えは少し大きく高く。
 * @param {'click' | 'choice' | 'tool'} kind
 * @returns {{ from: number, to: number, ms: number, gain: number }}
 */
export function clickPlan(kind) {
  if (kind === 'choice') return { from: 1180, to: 760, ms: 70, gain: NOVEL_SOUND_GAIN.choice };
  if (kind === 'tool') return { from: 1400, to: 1100, ms: 28, gain: NOVEL_SOUND_GAIN.tool };
  return { from: 980, to: 620, ms: 45, gain: NOVEL_SOUND_GAIN.click };
}

/** 保存の値をそろえる(知らない値はおまかせ)。 */
export function normalizeVoiceStyle(value) {
  return typeof value === 'string' && Object.hasOwn(VOICE_STYLES, value) ? value : DEFAULT_VOICE_STYLE;
}

/**
 * 台本の効果音(docs/novel-scene-design.mdの12章)。ファイルを使わず、短い音を数字で作る(src/novel-audio.tsのsfx)。
 * tonesは音の高さ(freqからtoへ滑らせてもよい)、noiseは雑音(filterの高さで音色を変える)。atは鳴り始め、msは長さ(ミリ秒)。
 * 立ち上がりを速く、余韻を短く(G:3-3)。大きさは文字の音より少し大きく、押した音より大きくしない程度。
 * @type {Readonly<Record<string, { label: string, use: string, tones?: { type: OscillatorType, freq: number, to?: number, at: number, ms: number, gain: number }[], noise?: { at: number, ms: number, gain: number, filter: number }[] }>>}
 */
export const SFX = Object.freeze({
  pop: Object.freeze({ label: 'ぽん', use: '何かが出てくる・軽い驚き', tones: [{ type: 'sine', freq: 620, to: 980, at: 0, ms: 110, gain: 0.16 }] }),
  chime: Object.freeze({
    label: 'きらり', use: 'ひらめき・うれしい知らせ',
    tones: [
      { type: 'triangle', freq: 1320, at: 0, ms: 240, gain: 0.1 },
      { type: 'triangle', freq: 1760, at: 70, ms: 280, gain: 0.09 },
      { type: 'triangle', freq: 2640, at: 140, ms: 360, gain: 0.07 },
    ],
  }),
  impact: Object.freeze({
    label: 'どん', use: '衝撃・決意',
    tones: [{ type: 'sine', freq: 150, to: 55, at: 0, ms: 280, gain: 0.32 }],
    noise: [{ at: 0, ms: 80, gain: 0.14, filter: 900 }],
  }),
  koma: Object.freeze({
    label: '駒音', use: '駒を打つ・対局の始まり',
    tones: [{ type: 'triangle', freq: 460, to: 300, at: 0, ms: 70, gain: 0.14 }],
    noise: [{ at: 0, ms: 45, gain: 0.3, filter: 2600 }],
  }),
  door: Object.freeze({ label: '戸', use: '戸を開ける・人が来る', noise: [{ at: 0, ms: 380, gain: 0.1, filter: 700 }] }),
  bell: Object.freeze({
    label: 'チャイム', use: '学校のチャイム・時間の区切り',
    tones: [
      { type: 'sine', freq: 784, at: 0, ms: 520, gain: 0.12 },
      { type: 'sine', freq: 659, at: 430, ms: 720, gain: 0.12 },
    ],
  }),
});

/** 効果音の作り方(知らない名前はnull)。 */
export const sfxPlan = (id) => SFX[/** @type {keyof typeof SFX} */ (id)] ?? null;
