/**
 * 将棋教室の読み上げ(docs/nyumon-mode-design.mdの16-10)。
 * ブラウザの音声合成は、将棋の符号や駒の名前を読み違える(「歩」を「ほ」、「玉」を「たま」、「角」を「かど」)ので、
 * 読む前に読み方を直す。画面から切り離した純粋な処理にしてテストする。
 */

/** 読み上げのオン/オフを残すキー。既定はオフ(急に声が出ると驚くため)。 */
export const TUTORIAL_VOICE_KEY = "yacobihime:shogi-match:tutorial-voice:v1";

const NUMBER_READINGS = ["", "いち", "に", "さん", "よん", "ご", "ろく", "なな", "はち", "きゅう"];
const KANJI_NUMBERS = "一二三四五六七八九";
const FULL_DIGITS = "１２３４５６７８９";

/** 符号の駒の読み。長い名前を先に置き、正規表現で長いほうから当てる。 */
const MOVE_PIECES = [
  ["成香", "なりきょう"], ["成桂", "なりけい"], ["成銀", "なりぎん"],
  ["歩", "ふ"], ["香", "きょう"], ["桂", "けい"], ["銀", "ぎん"], ["金", "きん"], ["角", "かく"],
  ["飛", "ひ"], ["玉", "ぎょく"], ["王", "おう"], ["と", "と"], ["馬", "うま"], ["竜", "りゅう"], ["龍", "りゅう"],
];
const MOVE_SUFFIXES = [["不成", "ならず"], ["成", "なり"], ["打", "うつ"], ["左", "ひだり"], ["右", "みぎ"], ["上", "あがる"], ["引", "ひく"], ["寄", "よる"], ["直", "すぐ"]];
const PIECE_READINGS = new Map(MOVE_PIECES);
const SUFFIX_READINGS = new Map(MOVE_SUFFIXES);

const alternatives = (pairs) => pairs.map(([word]) => word).join("|");
const DIGIT = `[1-9${FULL_DIGITS}]`;
const MOVE_PATTERN = new RegExp(
  `([▲△☗☖]?)(?:(${DIGIT})([${KANJI_NUMBERS}])|(同)\\s?)(${alternatives(MOVE_PIECES)})?(${alternatives(MOVE_SUFFIXES)})?`,
  "g",
);

function digitReading(char) {
  const half = FULL_DIGITS.indexOf(char);
  return NUMBER_READINGS[half >= 0 ? half + 1 : Number(char)] ?? char;
}

/** 文の中の駒の名前の読み(符号の外)。読み違えやすいものだけを直す。 */
const WORD_READINGS = [
  ["香車", "きょうしゃ"],
  ["桂馬", "けいま"],
  ["飛車", "ひしゃ"],
  ["と金", "ときん"],
  ["「成」", "「なり」"],
  ["「不成」", "「ならず」"],
  ["歩", "ふ"],
  ["玉", "ぎょく"],
  ["角", "かく"],
  ["金", "きん"],
  ["香", "きょう"],
  ["桂", "けい"],
];
const CIRCLED = "①②③④⑤⑥⑦⑧⑨";

/**
 * 読み上げる文の読み方を直す。
 * 「▲７六歩」→「せんて、なな ろく ふ」、「△3四歩」→「ごて、さん よん ふ」、「＋6」→「プラス6」、「−5」→「マイナス5」。
 * 「★」「▼」などの記号は読まない。
 * @param {string} text
 */
export function voiceText(text) {
  let source = String(text ?? "");
  source = source.replace(MOVE_PATTERN, (match, mark, file, rank, same, piece, suffix) => {
    if (!file && !same) return match;
    // 「同」だけで駒の名前が続かないもの(「同じ」など)は符号ではない。
    if (same && !piece) return match;
    const words = [];
    if (mark) words.push(mark === "▲" || mark === "☗" ? "せんて、" : "ごて、");
    // マスの読みは前の言葉とつながらないよう、前に間を入れる(「ひしゃで に よん」)。
    if (file) words.push(`${mark ? "" : " "}${digitReading(file)} ${NUMBER_READINGS[KANJI_NUMBERS.indexOf(rank) + 1]}`);
    else words.push(mark ? "どう" : " どう");
    if (piece) words.push(` ${PIECE_READINGS.get(piece)}`);
    if (suffix) words.push(` ${SUFFIX_READINGS.get(suffix)}`);
    return words.join("");
  });
  source = source
    .replace(/[▲☗]/g, "せんて")
    .replace(/[△☖]/g, "ごて")
    .replace(/[＋+](?=\s?[0-9０-９])/g, "プラス")
    .replace(/[−\-－](?=\s?[0-9０-９])/g, "マイナス")
    .replace(new RegExp(`[${CIRCLED}]`, "g"), (char) => `${NUMBER_READINGS[CIRCLED.indexOf(char) + 1]}、`)
    .replace(/[★☆▼▶◀■●]/g, "")
    .replace(/×/g, "バツ");
  for (const [word, reading] of WORD_READINGS) source = source.split(word).join(reading);
  return source.replace(/\s{2,}/g, " ").trim();
}

/**
 * 端末の声の中から日本語の声を選ぶ。なければnull(読み上げのボタンを出さない)。
 * @template {{ lang: string, localService?: boolean, default?: boolean }} T
 * @param {readonly T[]} voices
 * @returns {T | null}
 */
export function pickJapaneseVoice(voices) {
  const japanese = (voices ?? []).filter(({ lang }) => /^ja([-_]|$)/i.test(lang));
  if (!japanese.length) return null;
  return japanese.find((voice) => voice.localService) ?? japanese[0];
}

/** 保存した読み上げのオン/オフ。読めなければオフ。 */
export function loadTutorialVoiceOn(storage) {
  try {
    return storage?.getItem(TUTORIAL_VOICE_KEY) === "on";
  } catch {
    return false;
  }
}

export function saveTutorialVoiceOn(storage, on) {
  try {
    storage?.setItem(TUTORIAL_VOICE_KEY, on ? "on" : "off");
  } catch {
    // 保存できなくても、読み上げはこの画面のあいだ使える。
  }
}
