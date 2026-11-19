import { describe, expect, it } from 'vitest';
import { writeGameKansenki } from './game-kansenki.mjs';

const base = {
  eventText: '第3期 竜王戦', label: '決勝トーナメント 2回戦', userName: 'やこび', opponentName: '中村大輔',
  userColor: 'white', formations: { black: '居飛車', white: '四間飛車' }, moveText: (ply) => `${ply % 2 === 1 ? '▲' : '△'}${ply}の手`,
};

describe('ふつうの大会の対局の観戦記(記事の形は kansenki-writer.mjs)', () => {
  it('詰ませて勝った局は、寄せの手数を副見出しにし、終盤に寄せの最初の手を書く', () => {
    const text = writeGameKansenki({ ...base, win: true, plies: 88, mate: { plies: 9, from: 80 } });
    expect(text.subhead).toBe('居飛車対四間飛車　9手詰めの寄せ');
    expect(text.lead.startsWith('第3期 竜王戦決勝トーナメント 2回戦は、将棋会館で行われ、')).toBe(true);
    expect(text.sections[0].paragraphs[0]).toBe('先手は中村大輔、後手はやこび。戦型は居飛車対四間飛車となった。');
    const end = text.sections.find((section) => section.title === '終盤').paragraphs.join('');
    expect(end).toContain('80手目△80の手');
    expect(end).toContain('88手まで、やこびの勝ち。');
  });

  it('負けた局は責めずに書く。戦型が分からなければ力戦', () => {
    const text = writeGameKansenki({ ...base, formations: { black: '', white: '' }, win: false, plies: 101, score: '1勝1敗' });
    expect(text.headline).toContain('中村大輔');
    expect(text.paragraphs.join('')).toContain('力戦');
    expect(text.lead).toContain('これで1勝1敗となった。');
    expect(text.paragraphs.join('')).toContain('101手まで、中村大輔の勝ち。');
    expect(text.paragraphs.at(-1)).toBe('やこびは、次の局へ静かに闘志を燃やしていた。');
  });

  it('この勝ちで決まったものがあれば、見出しとリードに書く', () => {
    const text = writeGameKansenki({ ...base, win: true, plies: 120, decided: '6組優勝', mate: { plies: 3, from: 118 } });
    expect(text.headline).toBe('やこび、6組優勝');
    expect(text.lead).toContain('6組優勝を決めた。');
  });
});
