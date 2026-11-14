import { describe, expect, it } from 'vitest';
import { MORSE_CODES, cleanCourseStore, emptyTalkProgress } from './palace-morse.mjs';
import {
  MORSE_TALKS,
  completeTalk,
  earsPercent,
  editDistance,
  fillTalkText,
  freeAnswer,
  greetFor,
  incomingSpeed,
  matchReply,
  normalizeReply,
  partnerOf,
  talkById,
  talkList,
  talkNode,
  talkReplyCount,
  talkRoomOpen,
} from './morse-talk.mjs';

const LETTERS = /^[A-Z ]+$/;

describe('交信の台本', () => {
  it('どの交信も、届く文はA〜Zと空白だけ・返事の行き先がある・終わりにたどり着ける', () => {
    for (const talk of MORSE_TALKS.filter((item) => !item.free)) {
      expect(talk.nodes[talk.start], talk.id).toBeTruthy();
      let ends = 0;
      for (const [id, node] of Object.entries(talk.nodes)) {
        const resolved = talkNode(talk, id, { text: 'TARO', hour: 9 });
        expect(resolved.send, `${talk.id}/${id}`).toMatch(LETTERS);
        if (node.end) {
          ends += 1;
          expect(resolved.say.length, `${talk.id}/${id}`).toBeGreaterThan(0);
          continue;
        }
        expect(resolved.replies.length, `${talk.id}/${id}`).toBeGreaterThan(0);
        for (const reply of resolved.replies) {
          expect(talk.nodes[reply.next], `${talk.id}/${id}→${reply.next}`).toBeTruthy();
          for (const word of reply.words) expect([...word].every((letter) => MORSE_CODES[letter]), word).toBe(true);
        }
      }
      expect(ends, talk.id).toBeGreaterThan(0);
    }
  });

  it('相手の一言(lead)に、届く文の言葉を書かない(耳だけで読めるように)', () => {
    for (const talk of MORSE_TALKS.filter((item) => !item.free)) {
      for (const [id] of Object.entries(talk.nodes)) {
        const node = talkNode(talk, id, { text: 'TARO', hour: 9 });
        for (const word of node.send.split(' ').filter((item) => item.length >= 2 && item !== 'TARO')) {
          expect(node.lead.includes(word), `${talk.id}/${id}: ${word}`).toBe(false);
        }
      }
    }
  });

  it('羽音の台詞に「！」と敬語を使わない', () => {
    const hanane = MORSE_TALKS.filter((talk) => talk.partner === 'hanane');
    expect(hanane.length).toBeGreaterThan(0);
    const lines = [partnerOf(hanane[0]).agn];
    for (const talk of hanane) {
      for (const node of Object.values(talk.nodes)) {
        lines.push(node.lead ?? '', node.say ?? '', node.clue ?? '', node.mean ?? '');
        for (const reply of node.replies ?? []) lines.push(reply.react ?? '');
      }
    }
    for (const line of lines) {
      expect(line.includes('！'), line).toBe(false);
      expect(/です|ます|ください/.test(line), line).toBe(false);
      expect(/規則性|確率/.test(line), line).toBe(false);
    }
  });

  it('交信は順に開き、自由に話すははじめての交信のあと', () => {
    let progress = emptyTalkProgress();
    expect(talkList(progress).filter((row) => row.open).map((row) => row.talk.id)).toEqual(['first']);
    ({ progress } = completeTalk(progress, 'first', { ears: 1, total: 2, sent: 5 }));
    expect(talkList(progress).filter((row) => row.open).map((row) => row.talk.id)).toEqual(['first', 'ham', 'free']);
    expect(talkList(progress).find((row) => row.talk.id === 'koma').lock).toBe('「無線のあいさつ」のあとに開く');
  });

  it('一覧はコースの回3を終えると開く', () => {
    expect(talkRoomOpen({ done: 2 })).toBe(false);
    expect(talkRoomOpen({ done: 3 })).toBe(true);
  });

  it('羽音は1つ速く送る', () => {
    expect(incomingSpeed(talkById('hanane'), 'slow')).toBe('normal');
    expect(incomingSpeed(talkById('first'), 'slow')).toBe('slow');
  });

  it('返事が要るやりとりの数', () => {
    expect(talkReplyCount(talkById('first'))).toBe(2);
    expect(talkReplyCount(talkById('ham'))).toBe(4);
    expect(talkReplyCount(talkById('hanane'))).toBe(3);
    expect(talkReplyCount(talkById('free'))).toBe(0);
  });
});

describe('置きかえ', () => {
  it('時刻のあいさつ', () => {
    expect(greetFor(7).word).toBe('GM');
    expect(greetFor(13).word).toBe('GA');
    expect(greetFor(20).word).toBe('GE');
    expect(greetFor(2).word).toBe('GE');
  });

  it('名前とあいさつを入れる', () => {
    expect(fillTalkText('HI {TEXT} {GREET}', { text: 'TARO', hour: 8 })).toBe('HI TARO GM');
    expect(fillTalkText('やあ、{TEXT}。{GREET_MEAN}', { text: 'TARO', hour: 14 })).toBe('やあ、TARO。こんにちは');
    const node = talkNode(talkById('ham'), 'hello', { text: 'TARO', hour: 19 });
    expect(node.send).toBe('HI TARO GE');
    expect(node.replies[0].words).toEqual(['GM', 'GA', 'GE']);
  });
});

describe('返事を照らし合わせる', () => {
  const first = talkById('first');
  const hi = talkNode(first, 'hi');
  const shogi = talkNode(first, 'shogi');

  it('通じる(空白は無視・小文字も大文字に)', () => {
    expect(matchReply(hi, 'HI')).toMatchObject({ kind: 'ok', reply: { next: 'shogi' } });
    expect(matchReply(hi, 'h i')).toMatchObject({ kind: 'ok' });
    expect(matchReply(shogi, 'NO')).toMatchObject({ kind: 'ok', reply: { next: 'no' } });
  });

  it('長い言葉は1文字ちがいでも通じる。短い言葉はちがえば通じず、近い言葉を教える', () => {
    expect(matchReply(shogi, 'YET')).toMatchObject({ kind: 'near', guess: 'YES', reply: { next: 'yes' } });
    expect(matchReply(hi, 'HS')).toMatchObject({ kind: 'miss', guess: 'HI' });
    expect(matchReply(hi, 'TEA')).toMatchObject({ kind: 'miss', guess: '' });
  });

  it('読めない文字・空は別にする', () => {
    expect(matchReply(hi, 'H?')).toMatchObject({ kind: 'unreadable' });
    expect(matchReply(hi, '  ')).toMatchObject({ kind: 'empty' });
  });

  it('名前は何でも受け取る(長すぎなければ)', () => {
    const name = talkNode(talkById('ham'), 'name');
    expect(matchReply(name, 'TARO')).toMatchObject({ kind: 'ok', reply: { next: 'hello' }, text: 'TARO' });
    expect(matchReply(name, 'ABCDEFGHIJKLMN')).toMatchObject({ kind: 'miss' });
  });

  it('羽音の謎かけ：E I S の次は H', () => {
    const seq = talkNode(talkById('hanane'), 'seq');
    expect(seq.send).toBe('E I S');
    expect(matchReply(seq, 'H')).toMatchObject({ kind: 'ok', reply: { next: 'seq2' } });
    expect(matchReply(seq, 'S')).toMatchObject({ kind: 'miss', guess: 'H' });
    expect(seq.clue.length).toBeGreaterThan(0);
  });

  it('文字のちがいの数', () => {
    expect(editDistance('YES', 'YET')).toBe(1);
    expect(editDistance('SHOGI', 'SHOG')).toBe(1);
    expect(editDistance('HI', 'IH')).toBe(2);
    expect(normalizeReply(' hi  there! ')).toBe('HI THERE');
  });
});

describe('自由に話す', () => {
  it('知っている言葉には中身で返し、知らない言葉は「R ○○」', () => {
    expect(freeAnswer('SOS')).toMatchObject({ send: 'R', known: true });
    expect(freeAnswer('SHOGI')).toMatchObject({ send: 'FB', known: true });
    expect(freeAnswer('NEKO')).toMatchObject({ send: 'R NEKO', mean: '受け取った、NEKO', known: false });
    expect(freeAnswer('AGN', 'GM')).toMatchObject({ send: 'GM' });
    expect(freeAnswer('N?KO')).toMatchObject({ send: 'AGN' });
    expect(freeAnswer('')).toBe(null);
  });
});

describe('進み具合', () => {
  it('終えた印・耳だけのいちばん良い数・送った文字', () => {
    let progress = emptyTalkProgress();
    let result = completeTalk(progress, 'first', { ears: 1, total: 2, sent: 7 });
    expect(result.opened.map((talk) => talk.id)).toEqual(['ham', 'free']);
    progress = result.progress;
    expect(progress).toMatchObject({ done: ['first'], ears: { first: { ears: 1, total: 2 } }, sent: 7 });
    result = completeTalk(progress, 'first', { ears: 0, total: 2, sent: 3 });
    expect(result.opened).toEqual([]);
    expect(result.progress).toMatchObject({ done: ['first'], ears: { first: { ears: 1, total: 2 } }, sent: 10 });
    result = completeTalk(result.progress, 'first', { ears: 2, total: 2, sent: 3 });
    expect(result.progress.ears.first).toEqual({ ears: 2, total: 2 });
    expect(earsPercent(2, 3)).toBe(67);
    expect(earsPercent(0, 0)).toBe(0);
  });

  it('保存の値を整える(前の保存にtalkがなければ、はじめの値)', () => {
    expect(cleanCourseStore({ version: 1, morse: {} }).talk).toEqual(emptyTalkProgress());
    const talk = cleanCourseStore({
      version: 1,
      morse: {},
      talk: { done: ['first', 'BAD ID', 3], ears: { first: { ears: 5, total: 2 }, ham: { ears: 1 } }, sent: 12, speed: 'fast', keyMode: 'buttons', caption: 'nope' },
    }).talk;
    expect(talk).toEqual({ done: ['first'], ears: { first: { ears: 2, total: 2 } }, sent: 12, speed: 'fast', keyMode: 'buttons', caption: 'after' });
  });
});
