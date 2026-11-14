// モールス信号を電鍵で打つ・相手の信号を鳴らす(docs/brain-training-design.mdの18-4)。画面に依存しない。
// 時刻はミリ秒で外から渡す(テストで時間を進められるように)。押した長さでトンとツーを分け、手を止めた時間で文字と言葉を区切る。

import { MORSE_CODES } from './palace-morse.mjs';

/** 符号から文字を引く表。 */
const LETTER_OF = Object.freeze(Object.fromEntries(Object.entries(MORSE_CODES).map(([letter, code]) => [code, letter])));

/**
 * 速さ。dashAtはトンとツーの境目(これ以上押したらツー)、letterGapは1文字に区切るまで手を止める時間、wordGapは言葉を区切るまでの時間。
 * incomingは相手の信号(1単位・文字のあいだ・言葉のあいだ)。文字の中は速く、文字のあいだを長くあける(ファーンズワース法)。
 */
export const KEY_SPEEDS = Object.freeze({
  slow: Object.freeze({ id: 'slow', label: 'ゆっくり', dashAt: 280, letterGap: 1100, wordGap: 2600, incoming: Object.freeze({ unit: 100, letterGap: 900, wordGap: 1900 }) }),
  normal: Object.freeze({ id: 'normal', label: 'ふつう', dashAt: 220, letterGap: 750, wordGap: 1800, incoming: Object.freeze({ unit: 80, letterGap: 560, wordGap: 1300 }) }),
  fast: Object.freeze({ id: 'fast', label: 'はやい', dashAt: 170, letterGap: 500, wordGap: 1200, incoming: Object.freeze({ unit: 65, letterGap: 195, wordGap: 455 }) }),
});
export const KEY_SPEED_IDS = Object.freeze(['slow', 'normal', 'fast']);

/** 速さの設定(知らない値はゆっくり)。 */
export function keySpeed(id) {
  return KEY_SPEEDS[id] ?? KEY_SPEEDS.slow;
}

/** 1つ速い速さ(羽音の信号。はやいのときは同じ)。 */
export function fasterSpeed(id) {
  const index = KEY_SPEED_IDS.indexOf(keySpeed(id).id);
  return KEY_SPEED_IDS[Math.min(KEY_SPEED_IDS.length - 1, index + 1)];
}

/** 符号を文字にする。符号にない形は「?」。 */
export function decodeMorse(code) {
  return LETTER_OF[code] ?? '?';
}

/** 押した長さ(ミリ秒)をトン(.)かツー(-)にする。 */
export function pressMark(ms, speedId) {
  return ms >= keySpeed(speedId).dashAt ? '-' : '.';
}

/**
 * 打っている途中の状態。lettersは区切った文字({ code, letter }。言葉の区切りはletterが' ')、currentは打ちかけの符号。
 * downAtは押し始めた時刻(押していなければnull)、lastUpは最後に手を離した時刻。
 * @typedef {{ letters: { code: string, letter: string }[], current: string, downAt: number | null, lastUp: number | null }} Keying
 */

/** @returns {Keying} */
export function emptyKeying() {
  return { letters: [], current: '', downAt: null, lastUp: null };
}

function closeLetter(state) {
  if (!state.current) return state;
  return { ...state, letters: [...state.letters, { code: state.current, letter: decodeMorse(state.current) }], current: '' };
}

/** 手を止めていた時間で、打ちかけの文字を区切り、言葉の区切りを足す(次の印を足す前に呼ぶ)。 */
function settleGap(state, now, speedId) {
  if (state.lastUp === null) return state;
  const speed = keySpeed(speedId);
  const gap = now - state.lastUp;
  let next = state;
  if (gap >= speed.letterGap) next = closeLetter(next);
  const last = next.letters.at(-1);
  if (gap >= speed.wordGap && last && last.letter !== ' ' && !next.current) next = { ...next, letters: [...next.letters, { code: '', letter: ' ' }] };
  return next;
}

/**
 * キーを押した。
 * @param {Keying} state
 * @param {number} now
 * @param {string} speedId
 * @returns {Keying}
 */
export function keyDown(state, now, speedId) {
  if (state.downAt !== null) return state;
  return { ...settleGap(state, now, speedId), downAt: now };
}

/**
 * キーを離した。押していた長さで印を足す。
 * @param {Keying} state
 * @param {number} now
 * @param {string} speedId
 * @returns {{ state: Keying, mark: string }}
 */
export function keyUp(state, now, speedId) {
  if (state.downAt === null) return { state, mark: '' };
  const mark = pressMark(now - state.downAt, speedId);
  return { state: { ...state, current: state.current + mark, downAt: null, lastUp: now }, mark };
}

/**
 * ボタンで印を1つ足す(打ち方「ボタン」)。区切りは電鍵と同じく、手を止めた時間で決める。
 * @param {Keying} state
 * @param {'.' | '-'} mark
 * @param {number} now
 * @param {string} speedId
 * @returns {Keying}
 */
export function tapMark(state, mark, now, speedId) {
  const settled = settleGap({ ...state, downAt: null }, now, speedId);
  return { ...settled, current: settled.current + mark, lastUp: now };
}

/**
 * 時間が過ぎたら、打ちかけの文字を区切る(画面が少しずつ呼ぶ)。
 * @param {Keying} state
 * @param {number} now
 * @param {string} speedId
 * @returns {Keying}
 */
export function keyTick(state, now, speedId) {
  if (!state.current || state.downAt !== null || state.lastUp === null) return state;
  return now - state.lastUp >= keySpeed(speedId).letterGap ? closeLetter(state) : state;
}

/** 打ちかけの文字が区切られるまでの進み(0〜1。区切りの輪)。 */
export function letterProgress(state, now, speedId) {
  if (!state.current || state.downAt !== null || state.lastUp === null) return 0;
  return Math.max(0, Math.min(1, (now - state.lastUp) / keySpeed(speedId).letterGap));
}

/** 送信の前に、打ちかけの文字をそこで区切る。 */
export function commitKeying(state) {
  return { ...closeLetter(state), downAt: null };
}

/** 消す。打ちかけの符号があればそれを、なければ最後の1文字(と後ろの空白)を消す。 */
export function backspaceKeying(state) {
  if (state.current) return { ...state, current: '' };
  const letters = [...state.letters];
  while (letters.at(-1)?.letter === ' ') letters.pop();
  letters.pop();
  while (letters.at(-1)?.letter === ' ') letters.pop();
  return { ...state, letters };
}

/** 区切った文字を文にする(前後の空白を除き、続く空白は1つに)。 */
export function keyingText(state) {
  return state.letters.map(({ letter }) => letter).join('').replace(/ +/g, ' ').trim();
}

// ===== 相手の信号 =====

/**
 * 文を鳴らす時間割。marksは1つずつの音(atは始まり、msは長さ、letterは文の中の文字の番号)、lettersは文字ごとの始まりと終わり。
 * 文字の中は1単位あけ、文字のあいだはletterGap、言葉のあいだはwordGapあける。
 * @param {string} text A〜Zと空白
 * @param {string} speedId
 * @returns {{ marks: { at: number, ms: number, kind: 'dot' | 'dash', letter: number }[], letters: { index: number, letter: string, code: string, start: number, end: number }[], total: number }}
 */
export function messageTimeline(text, speedId) {
  const { unit, letterGap, wordGap } = keySpeed(speedId).incoming;
  const marks = [];
  const letters = [];
  let at = 0;
  let pendingGap = 0;
  [...text.toUpperCase()].forEach((letter, index) => {
    if (letter === ' ') {
      pendingGap = letters.length ? wordGap : 0;
      return;
    }
    const code = MORSE_CODES[letter];
    if (!code) return;
    if (letters.length) at += Math.max(pendingGap, letterGap);
    pendingGap = 0;
    const start = at;
    [...code].forEach((mark, markIndex) => {
      if (markIndex) at += unit;
      const ms = (mark === '-' ? 3 : 1) * unit;
      marks.push({ at, ms, kind: mark === '-' ? 'dash' : 'dot', letter: index });
      at += ms;
    });
    letters.push({ index, letter, code, start, end: at });
  });
  return { marks, letters, total: at };
}

/**
 * 文の符号(文字ごと。空白は'')。
 * @param {string} text
 * @returns {string[]}
 */
export function textCodes(text) {
  return [...text.toUpperCase()].map((letter) => (letter === ' ' ? '' : MORSE_CODES[letter] ?? ''));
}
