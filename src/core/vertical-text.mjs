/*
 * 縦書きの文字列を、1字ずつの箱に分ける(src/VerticalText.vue)。
 * 句読点は右上へ寄せ、長音・括弧・波線は90度回し、小さい仮名は少し右上へ寄せる。
 * 句読点と閉じ括弧は前の字と同じかたまりにして、列の頭に来ないようにする(行頭禁則)。
 */

const COMMA = new Set(['、', '。', '，', '．']);
const SMALL = new Set([...'ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ']);
const TURN = new Set([...'ー－-―〜～…‥「」『』（）()【】〔〕［］｛｝〈〉《》:：=＝→←']);
/** 列の頭に来てはいけない字(前の字につなげる)。 */
const NO_HEAD = new Set([...'、。，．」』）)】〕］｝〉》ーぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ！？!?・…‥']);
/** 列の終わりに来てはいけない字(次の字につなげる)。 */
const NO_TAIL = new Set([...'「『（(【〔［｛〈《']);

/**
 * @param {string} ch
 * @returns {'' | 'comma' | 'small' | 'turn'}
 */
export function verticalKind(ch) {
  if (COMMA.has(ch)) return 'comma';
  if (SMALL.has(ch)) return 'small';
  if (TURN.has(ch)) return 'turn';
  return '';
}

/**
 * 文字列を、列の途中で分けないかたまりの列にする。
 * @param {string} text
 * @returns {{ ch: string, kind: string }[][]}
 */
export function verticalGroups(text) {
  const groups = [];
  let joinNext = false;
  for (const ch of String(text ?? '')) {
    const item = { ch, kind: verticalKind(ch) };
    if (groups.length && (joinNext || NO_HEAD.has(ch))) groups[groups.length - 1].push(item);
    else groups.push([item]);
    joinNext = NO_TAIL.has(ch);
  }
  return groups;
}
