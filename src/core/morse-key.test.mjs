import { describe, expect, it } from 'vitest';
import {
  KEY_SPEEDS,
  backspaceKeying,
  commitKeying,
  decodeMorse,
  emptyKeying,
  fasterSpeed,
  keyDown,
  keyTick,
  keyUp,
  keyingText,
  letterProgress,
  messageTimeline,
  pressMark,
  tapMark,
  textCodes,
} from './morse-key.mjs';
import { MORSE_CODES, MORSE_LETTERS } from './palace-morse.mjs';

/** 印の並び(例：「.-」)を、押す長さで打つ。markGapは印のあいだ、startは始まりの時刻。 */
function keyCode(state, code, start, speedId = 'slow', markGap = 150) {
  let at = start;
  for (const mark of code) {
    state = keyDown(state, at, speedId);
    at += mark === '-' ? 450 : 120;
    state = keyUp(state, at, speedId).state;
    at += markGap;
  }
  return { state, at: at - markGap };
}

describe('押す長さ', () => {
  it('境目より短ければトン、境目から上はツー', () => {
    expect(pressMark(120, 'slow')).toBe('.');
    expect(pressMark(279, 'slow')).toBe('.');
    expect(pressMark(280, 'slow')).toBe('-');
    expect(pressMark(200, 'fast')).toBe('-');
  });

  it('符号を文字にする。符号にない形は「?」', () => {
    for (const letter of MORSE_LETTERS) expect(decodeMorse(MORSE_CODES[letter])).toBe(letter);
    expect(decodeMorse('.....')).toBe('?');
  });

  it('羽音の速さは1つ速い(はやいのときは同じ)', () => {
    expect(fasterSpeed('slow')).toBe('normal');
    expect(fasterSpeed('normal')).toBe('fast');
    expect(fasterSpeed('fast')).toBe('fast');
    expect(fasterSpeed('???')).toBe('normal');
  });
});

describe('電鍵で打つ', () => {
  it('HIを打つ：手を止めると1文字に区切られる', () => {
    const speed = KEY_SPEEDS.slow;
    let { state, at } = keyCode(emptyKeying(), '....', 0);
    expect(state.current).toBe('....');
    // まだ区切りの時間に届かない。
    expect(keyTick(state, at + speed.letterGap - 1, 'slow').current).toBe('....');
    expect(letterProgress(state, at + speed.letterGap / 2, 'slow')).toBeCloseTo(0.5, 2);
    state = keyTick(state, at + speed.letterGap, 'slow');
    expect(state.letters.map((item) => item.letter)).toEqual(['H']);
    ({ state, at } = keyCode(state, '..', at + speed.letterGap + 100));
    state = commitKeying(state);
    expect(keyingText(state)).toBe('HI');
  });

  it('区切りの前に次を押すと、同じ文字の続きになる', () => {
    let { state, at } = keyCode(emptyKeying(), '.-', 0);
    ({ state } = keyCode(state, '-', at + 300));
    expect(state.current).toBe('.--');
    expect(keyingText(commitKeying(state))).toBe('W');
  });

  it('長く手を止めると言葉の区切り(空白)が入る', () => {
    const speed = KEY_SPEEDS.slow;
    let { state, at } = keyCode(emptyKeying(), '-', 0);
    ({ state } = keyCode(state, '..', at + speed.wordGap + 10));
    expect(keyingText(commitKeying(state))).toBe('T I');
  });

  it('押しているあいだに区切りの時間が過ぎても、区切らない', () => {
    let state = keyDown(emptyKeying(), 0, 'slow');
    expect(keyTick(state, 5000, 'slow')).toBe(state);
    expect(keyUp(emptyKeying(), 10, 'slow').mark).toBe('');
  });

  it('消す：打ちかけの符号、なければ最後の文字(と空白)', () => {
    let state = commitKeying(keyCode(emptyKeying(), '...', 0).state);
    state = tapMark(state, '-', 5000, 'slow');
    state = commitKeying(state);
    expect(keyingText(state)).toBe('S T');
    state = tapMark(state, '.', 20000, 'slow');
    expect(backspaceKeying(state).current).toBe('');
    state = commitKeying(state);
    expect(keyingText(state)).toBe('S T E');
    state = backspaceKeying(state);
    expect(keyingText(state)).toBe('S T');
    state = backspaceKeying(state);
    expect(keyingText(state)).toBe('S');
    expect(keyingText(backspaceKeying(backspaceKeying(state)))).toBe('');
  });

  it('ボタンで打つ：区切りは電鍵と同じく手を止めた時間', () => {
    let state = tapMark(emptyKeying(), '-', 0, 'normal');
    state = tapMark(state, '.', 300, 'normal');
    state = tapMark(state, '-', 600, 'normal');
    state = tapMark(state, '-', 2000, 'normal');
    expect(keyingText(commitKeying(state))).toBe('KT');
  });
});

describe('相手の信号', () => {
  it('文字の中は1単位、文字のあいだと言葉のあいだは長くあける', () => {
    const { unit, letterGap, wordGap } = KEY_SPEEDS.slow.incoming;
    const { marks, letters, total } = messageTimeline('HI E', 'slow');
    expect(letters.map((item) => item.letter)).toEqual(['H', 'I', 'E']);
    expect(marks.filter((mark) => mark.letter === 0)).toHaveLength(4);
    expect(marks[1].at - (marks[0].at + marks[0].ms)).toBe(unit);
    expect(letters[1].start - letters[0].end).toBe(letterGap);
    expect(letters[2].start - letters[1].end).toBe(wordGap);
    expect(total).toBe(letters[2].end);
    expect(marks.at(-1).letter).toBe(3);
  });

  it('はやいは本物と同じ間(文字のあいだ3単位・言葉のあいだ7単位)', () => {
    const { unit, letterGap, wordGap } = KEY_SPEEDS.fast.incoming;
    expect(letterGap).toBe(3 * unit);
    expect(wordGap).toBe(7 * unit);
  });

  it('文の符号', () => {
    expect(textCodes('SOS')).toEqual(['...', '---', '...']);
    expect(textCodes('R K')).toEqual(['.-.', '', '-.-']);
  });
});
