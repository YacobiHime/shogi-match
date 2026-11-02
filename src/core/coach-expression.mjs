export const COACH_EXPRESSION_FILES = Object.freeze({
  neutral: 'sakurano-momoka.webp',
  wry: 'sakurano-momoka-wry.webp',
  worried: 'sakurano-momoka-worried.webp',
});

// 画像を差し替えた際に、長期キャッシュ済みの旧画像を避けるための識別子。
export const COACH_EXPRESSION_ASSET_VERSION = '3';

/**
 * 立ち絵の幅(px)。大きい版(元の画像)と、スマホ・タブレットの縦向き用の小さい版(-320.webp)。
 * 小さい版は scripts/optimize-images.mjs が作る。
 */
export const COACH_PORTRAIT_FULL_WIDTH = 800;
export const COACH_PORTRAIT_SMALL_WIDTH = 320;

/** 立ち絵の小さい版のファイル名。 */
export function coachPortraitSmallFilename(filename) {
  return filename.replace(/\.webp$/, `-${COACH_PORTRAIT_SMALL_WIDTH}.webp`);
}

/**
 * 立ち絵のsrcset。表示幅(sizes)と画面の倍率から、ブラウザが小さい版と大きい版のどちらかを選ぶ。
 * @param {string} baseUrl 画像の公開先(asset-base-url)
 * @param {string} filename 大きい版のファイル名
 */
export function coachPortraitSrcset(baseUrl, filename) {
  const url = (name) => `${baseUrl}/characters/${name}?v=${COACH_EXPRESSION_ASSET_VERSION}`;
  return `${url(coachPortraitSmallFilename(filename))} ${COACH_PORTRAIT_SMALL_WIDTH}w, ${url(filename)} ${COACH_PORTRAIT_FULL_WIDTH}w`;
}

/**
 * 立ち絵のsizes。表示幅を測れたら、その幅を使う。測る前は、画面の幅から見当を付ける
 * (幅1000px未満では、立ち絵は盤の脇に小さく出る。広い画面では横300〜400px程度で出る)。
 * @param {number} [width] 測った表示幅(CSS px)。0や未定なら見当で返す。
 */
export function coachPortraitSizes(width) {
  return Number.isFinite(width) && width > 0 ? `${Math.ceil(width)}px` : '(max-width: 999px) 80px, 400px';
}

/*
 * 困り顔(worried)は、自分の玉や駒が危ないときだけに使う。「王手」「詰み」という言葉だけで困り顔にすると、
 * 「王手飛車をかけられるよ！」のような明るい誘いや、王手・詰めろの説明まで困り顔になってしまう。
 * 褒め言葉・攻めのチャンス・説明・相手の紹介は、「苦しい」「詰めろ」などを含んでも心配顔にしない。
 */
const PRAISE_PATTERN = /神の一手|好手|詰めろを掛けた|詰めろをかけ|受けきった|駒得|差が縮まって|逆転|粘ってる|お見事|見つけたね|読みきった|コツどおり|で詰み！|チャンス|安全|かけられる|できそう|効きそう|迫れそう|勝ちきれる|手詰めがあった|相手だよ。|^(王手|詰めろ)(は|かどうか)/;
const WRY_MISTAKE_PATTERN = /あちゃ|やっちゃった|悪手|^前は|前の対局で|思い出王手/;
const WORRIED_PATTERN = /王手だね|王手！ 玉|王手がかか|王手きた(?!～)|詰めろだね|詰まされ|間違えたら詰み|自玉に詰めろ|詰めろがかか|受けないと|負けちゃう|負けそう|危険|苦しい|押され|取られ(?!ない)|ねらってる|狙いは|気を付け|慎重に受け|指せる手がない/;
const WRY_PATTERN = /[？?]|かな|かも|みたい|互角|焦らず|考え|勝負どころ|寄り道|選び直|読み筋|じっくり|中断|難しそう|出せません/;

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
