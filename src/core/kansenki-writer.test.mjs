// 観戦記を新聞の記事のように書く(docs/mate-finish-design.mdの6章)。
import { describe, expect, it } from 'vitest';
import { gameFacts, storyOf, writeArticle } from './kansenki-writer.mjs';

const base = {
  eventText: '第3期 竜王戦', label: '5組 準決勝', userName: 'やこび', opponentName: '中村大輔', userColor: 'black',
  formations: { black: '居飛車', white: '四間飛車' },
};
const facts0 = { moves: [], material: [] };
const curve = (...points) => points.map(([ply, rate]) => [ply, rate]);

describe('棋譜の出来事', () => {
  it('角交換を、取った駒・成り・指した側で拾い、駒の損得の線を作る', () => {
    const facts = gameFacts(['7g7f', '3c3d', '8h2b+', '3a2b'], { userColor: 'black' });
    expect(facts.moves).toHaveLength(4);
    expect(facts.moves[2]).toMatchObject({ ply: 3, side: 'user', capture: 'bishop', promote: true, piece: 'bishop' });
    expect(facts.moves[2].text).toMatch(/^▲/);
    expect(facts.moves[3]).toMatchObject({ side: 'opp', capture: 'horse' });
    expect(facts.material[2]).toBeGreaterThan(0);
  });
  it('読めない手で止まる', () => {
    expect(gameFacts(['7g7f', 'zzzz', '3c3d']).moves).toHaveLength(1);
  });
});

describe('形勢の見立て', () => {
  it('逆転勝ち・逆転負け・熱戦・完勝・接戦', () => {
    expect(storyOf({ rates: curve([30, 50], [40, 20], [60, 40], [80, 85]), win: true, plies: 90, facts: facts0 }).kind).toBe('comeback');
    expect(storyOf({ rates: curve([30, 60], [40, 82], [60, 70], [80, 15]), win: false, plies: 90, facts: facts0 }).kind).toBe('collapse');
    expect(storyOf({ rates: curve([30, 65], [40, 35], [50, 66], [60, 34], [70, 62]), win: true, plies: 90, facts: facts0 }).kind).toBe('seesaw');
    expect(storyOf({ rates: curve([30, 60], [40, 70], [60, 80], [80, 95]), win: true, plies: 90, facts: facts0 }).kind).toBe('rout');
    expect(storyOf({ rates: curve([30, 50], [40, 52], [60, 48], [80, 55], [85, 58]), win: true, plies: 90, facts: facts0 }).kind).toBe('close');
  });
  it('頓死: 寄せの始まる直前まで、詰まされた側が悪くなかった', () => {
    const rates = curve([30, 50], [60, 45], [80, 50], [84, 48]);
    const tonshi = storyOf({ rates, win: true, plies: 91, facts: facts0, mate: { plies: 5, from: 87, by: 'user' } });
    expect(tonshi).toMatchObject({ kind: 'tonshi', tonshi: 'opp' });
    const mine = storyOf({ rates: curve([30, 50], [60, 55], [80, 60], [84, 58]), win: false, plies: 91, facts: facts0, mate: { plies: 3, from: 89, by: 'opp' } });
    expect(mine).toMatchObject({ kind: 'tonshi', tonshi: 'user' });
    // 勝っている側がふつうに寄せたなら頓死ではない。
    expect(storyOf({ rates: curve([30, 60], [60, 80], [84, 90]), win: true, plies: 91, facts: facts0, mate: { plies: 5, from: 87, by: 'user' } }).kind).not.toBe('tonshi');
  });
});

describe('記事', () => {
  it('見出し・副見出し・リード・小見出しつきの段落・局後・記録の欄・形勢の線', () => {
    const rates = curve([30, 50], [40, 20], [60, 40], [80, 85]);
    const article = writeArticle({ ...base, win: true, plies: 90, rates, reason: 'resignation', seed: 'a' });
    expect(article.story).toBe('comeback');
    expect(article.sections.map((section) => section.title)).toEqual(['序盤', '中盤', '終盤', '局後']);
    expect(article.lead).toContain('逆転');
    expect(article.paragraphs[0]).toBe(article.lead);
    expect(article.curve.length).toBeGreaterThan(2);
    expect(article.facts.find((fact) => fact.label === '決着').value).toBe('投了');
    expect(article.sections.at(-1).paragraphs[0]).toMatch(/^局後、やこびは「/);
  });
  it('同じ流れでも、局ごとに言い回しが変わる', () => {
    const rates = curve([30, 50], [40, 20], [60, 40], [80, 85]);
    const texts = new Set(['a', 'b', 'c', 'd', 'e', 'f'].map((seed) => {
      const article = writeArticle({ ...base, win: true, plies: 90, rates, reason: 'resignation', seed });
      return `${article.headline}|${article.paragraphs.join('')}`;
    }));
    expect(texts.size).toBeGreaterThan(2);
  });
  it('負けた局は相手の見落としを書かず、勝った局だけ書く', () => {
    const rates = curve([30, 50], [40, 60], [60, 70], [80, 85]);
    const lost = writeArticle({ ...base, win: false, plies: 90, rates: curve([30, 50], [60, 30], [80, 15]), oversights: [50] });
    expect(lost.paragraphs.join('')).not.toContain('見落とした');
    const won = writeArticle({ ...base, win: true, plies: 90, rates, oversights: [50] });
    expect(won.paragraphs.join('')).toContain('見落とした');
  });
  it('棋譜があれば、大駒を取った手と竜・馬を作った手を書く', () => {
    const moves = ['7g7f', '3c3d', '8h2b+', '3a2b'];
    const article = writeArticle({ ...base, win: true, plies: 4, moves, reason: 'resignation' });
    const middle = article.sections.find((section) => section.title === '中盤').paragraphs.join('');
    expect(middle).toContain('3手目、やこびが▲');
    expect(middle).toContain('馬を作り');
  });
});
