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
