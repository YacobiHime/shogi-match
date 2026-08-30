export const COACH_EXPRESSION_FILES = Object.freeze({
  neutral: 'sakurano-momoka.webp',
  wry: 'sakurano-momoka-wry.webp',
  worried: 'sakurano-momoka-worried.webp',
});

const WRY_MISTAKE_PATTERN = /あちゃ|やっちゃった|悪手/;
const WORRIED_PATTERN = /王手|詰み|詰めろ|負け|危険|苦しい|押され|取られ|気を付け|慎重に受け|中断|難しそう|出せません|指せる手がない/;
const WRY_PATTERN = /[？?]|かな|かも|みたい|互角|焦らず|考え|勝負どころ|寄り道|選び直|読み筋|じっくり/;

/** 助言の語調から、やこび姫の立ち絵表情を選ぶ。 */
export function coachExpressionForText(text = '') {
  if (typeof text !== 'string' || !text.trim()) return 'neutral';
  if (WRY_MISTAKE_PATTERN.test(text)) return 'wry';
  if (WORRIED_PATTERN.test(text)) return 'worried';
  if (WRY_PATTERN.test(text)) return 'wry';
  return 'neutral';
}

export function coachExpressionFilename(text = '') {
  return COACH_EXPRESSION_FILES[coachExpressionForText(text)];
}
