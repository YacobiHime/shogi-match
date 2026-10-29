import { describe, expect, it } from 'vitest';
import { writeGameKansenki } from './game-kansenki.mjs';

const base = {
  eventText: '第3期 竜王戦', label: '決勝トーナメント 2回戦', userName: 'やこび', opponentName: '中村大輔',
  userColor: 'white', formations: { black: '居飛車', white: '四間飛車' }, moveText: (ply) => `${ply % 2 === 1 ? '▲' : '△'}${ply}の手`,
};

describe('ふつうの大会の対局の観戦記', () => {
  it('詰ませて勝った局は、寄せの手数を見出しにし、寄せの最初の手を書く', () => {
    const text = writeGameKansenki({ ...base, win: true, plies: 88, mate: { plies: 9, from: 80 } });
    expect(text.headline).toBe('やこび、9手詰めで寄せ切る');
    expect(text.paragraphs[0]).toBe('第3期 竜王戦決勝トーナメント 2回戦は、将棋会館で行われた。先手は中村大輔、後手はやこび。戦型は居飛車対四間飛車となった。');
    expect(text.paragraphs.at(-1)).toBe('最後は80手目△80の手からの9手詰め。やこびが鮮やかに寄せ切った。88手まで、やこびの勝ち。');
  });

  it('1手詰めの寄せは見出しにせず、手数で制したと書く', () => {
    const text = writeGameKansenki({ ...base, win: true, plies: 70, mate: { plies: 1, from: 70 } });
    expect(text.headline).toBe('やこび、70手で制す');
    expect(text.paragraphs.at(-1)).toContain('一手で仕留めた');
  });

  it('勝率の記録があれば、形勢の分かれ目を書く。なければ書かない', () => {
    const rates = [[10, 50], [12, 52], [30, 48], [32, 80], [40, 82]];
    const text = writeGameKansenki({ ...base, win: true, plies: 60, rates });
    expect(text.paragraphs).toHaveLength(3);
    expect(text.paragraphs[1]).toBe('勝負を分けたのは31手目、やこびの▲31の手。この一手で、形勢はやこびに傾いた。');
    expect(writeGameKansenki({ ...base, win: true, plies: 60 }).paragraphs).toHaveLength(2);
  });

  it('負けた局は責めずに書き、寄せは書かない。戦型が分からなければ力戦', () => {
    const text = writeGameKansenki({ ...base, formations: { black: '', white: '' }, win: false, plies: 101, score: '1勝1敗', mate: { plies: 5, from: 97 } });
    expect(text.headline).toBe('中村大輔が101手で制す　やこびは次の局へ');
    expect(text.paragraphs[0]).toContain('力戦');
    expect(text.paragraphs.at(-1)).toBe('101手まで、中村大輔の勝ち。これで1勝1敗。やこびは、次の局へ静かに闘志を燃やしていた。');
  });

  it('この勝ちで決まったものがあれば、見出しと最後の段落に書く', () => {
    const text = writeGameKansenki({ ...base, win: true, plies: 120, decided: '6組優勝', mate: { plies: 3, from: 118 } });
    expect(text.headline).toBe('やこび、6組優勝');
    expect(text.paragraphs.at(-1)).toContain('6組優勝を決めた。');
  });
});
