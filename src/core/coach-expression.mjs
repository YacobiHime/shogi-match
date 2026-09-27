export const COACH_EXPRESSION_FILES = Object.freeze({
  neutral: 'sakurano-momoka.webp',
  wry: 'sakurano-momoka-wry.webp',
  worried: 'sakurano-momoka-worried.webp',
});

// 画像を差し替えた際に、長期キャッシュ済みの旧画像を避けるための識別子。
export const COACH_EXPRESSION_ASSET_VERSION = '2';

// 褒め言葉は「苦しい」「詰めろ」などを含んでも心配顔にしない。
const PRAISE_PATTERN = /神の一手|好手|詰めろを掛けた|受けきった|駒得|差が縮まって|逆転|粘ってる/;
const WRY_MISTAKE_PATTERN = /あちゃ|やっちゃった|悪手/;
const WORRIED_PATTERN = /王手|詰み|詰めろ|負け|危険|苦しい|押され|取られ|気を付け|慎重に受け|中断|難しそう|出せません|指せる手がない/;
const WRY_PATTERN = /[？?]|かな|かも|みたい|互角|焦らず|考え|勝負どころ|寄り道|選び直|読み筋|じっくり/;

/** 助言の語調から、やこび姫の立ち絵表情を選ぶ。 */
export function coachExpressionForText(text = '') {
  if (typeof text !== 'string' || !text.trim()) return 'neutral';
  if (WRY_MISTAKE_PATTERN.test(text)) return 'wry';
  if (PRAISE_PATTERN.test(text)) return 'neutral';
  if (WORRIED_PATTERN.test(text)) return 'worried';
  if (WRY_PATTERN.test(text)) return 'wry';
  return 'neutral';
}

export function coachExpressionFilename(text = '') {
  return COACH_EXPRESSION_FILES[coachExpressionForText(text)];
}

const RUBY_PATTERN = /｜([^｜《》]+)《([^《》]+)》/g;

/** 「｜正《まさ》」形式のルビ指定を、表示用の区切りへ分ける。 */
export function coachTextSegments(text = '') {
  if (typeof text !== 'string' || !text) return [];
  const segments = [];
  let last = 0;
  for (const match of text.matchAll(RUBY_PATTERN)) {
    if (match.index > last) segments.push({ text: text.slice(last, match.index) });
    segments.push({ text: match[1], ruby: match[2] });
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last) });
  return segments;
}

/** ルビ指定を取り除いた読み上げ・比較用の本文。 */
export function coachPlainText(text = '') {
  return typeof text === 'string' ? text.replace(RUBY_PATTERN, '$1') : '';
}
