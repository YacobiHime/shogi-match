import { describe, expect, it } from 'vitest';
import { BOOK_MAX, addBookGame, aiHint, bookEntry, bookList, evalWord, reviewRows, sfenAt, thoughtLine } from './disciple-review.mjs';
import { STANDARD_SFEN } from '../game-state';

const entries = [
  { move: '7g7f', eval: 40 },
  { move: '3c3d', eval: 30 },
  { move: '8h2b+', eval: 600, best: '2g2f', pv: '3a2b 2g2f' },
  { move: '3a2b', eval: -150 },
];

describe('形勢の言葉(33-4)', () => {
  it('弟子から見た評価値を、互角・やや有利…勝勢と、その逆で言う', () => {
    expect(evalWord(0)).toEqual({ word: '互角', tone: 'even' });
    expect(evalWord(299).word).toBe('互角');
    expect(evalWord(300)).toEqual({ word: 'やや有利', tone: 'good' });
    expect(evalWord(-900)).toEqual({ word: '不利', tone: 'bad' });
    expect(evalWord(1600).word).toBe('優勢');
    expect(evalWord(-30000).word).toBe('敗勢');
  });
});

describe('棋譜の行(33-4)', () => {
  it('手を「▲7六歩」の形にし、弟子から見た形勢と、弟子の手かを付ける', () => {
    const rows = reviewRows(entries, 'white');
    expect(rows.map((row) => row.text)).toEqual(['▲7六歩', '△3四歩', '▲2二角成', '△同銀']);
    expect(rows[2]).toMatchObject({ ply: 3, mine: false, word: 'やや不利', tone: 'bad' });
    expect(rows[3]).toMatchObject({ mine: true, word: '互角' });
    expect(reviewRows(entries, 'black')[2]).toMatchObject({ mine: true, word: 'やや有利' });
  });
  it('はじめから何手指した局面か', () => {
    expect(sfenAt(entries, 0)).toBe(STANDARD_SFEN);
    expect(sfenAt(entries, 2)).not.toBe(STANDARD_SFEN);
  });
});

describe('AIの検討(33-4)', () => {
  it('指した手と違う最善手と、指した手のあとの読み筋を、本局の記録から出す', () => {
    const hint = aiHint(entries, 3);
    expect(hint).toMatchObject({ best: '2g2f', bestText: '▲2六歩' });
    expect(hint.pvText).toBe('△同銀 ▲2六歩');
    expect(aiHint(entries, 1)).toMatchObject({ best: '', pvText: '' });
    expect(aiHint(entries, 9)).toBeNull();
  });
});

describe('弟子の棋譜帳(33-4)', () => {
  const game = (n) => ({ label: `例会${n}`, side: 'black', opponent: { name: '相手' }, win: n % 2 === 0, entries: [{ move: '7g7f', eval: n }, { move: `${n}` }], marks: [{ ply: 1, loss: 300, cause: 'careless', clues: ['1手目'] }], guesses: ['careless'] });
  it('指し手・形勢・印と答えを残し、20局まで。新しい順に並べる', () => {
    let state = {};
    for (let n = 0; n < BOOK_MAX + 3; n += 1) state = addBookGame(state, bookEntry(game(n), { turn: n, when: `${n}ターン` }));
    expect(state.games).toHaveLength(BOOK_MAX);
    expect(bookList(state)[0]).toMatchObject({ label: `例会${BOOK_MAX + 2}`, when: `${BOOK_MAX + 2}ターン`, marks: [{ cause: 'careless' }], guesses: ['careless'] });
    const again = addBookGame(state, bookEntry(game(BOOK_MAX + 2), { turn: BOOK_MAX + 2 }));
    expect(again.games).toHaveLength(BOOK_MAX);
  });
});

describe('弟子の考えの一言(34-17)', () => {
  it('思考の記録の理由から一言にする。記録がなければ空', () => {
    expect(thoughtLine({ d: { r: 'edge-pawn' } })).toBe('端歩を突いて様子を見ます');
    expect(thoughtLine({ d: { r: 'follow' } })).toBe('研究してきた手です');
    expect(thoughtLine({})).toBe('');
  });
});
