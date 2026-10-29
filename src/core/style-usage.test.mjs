import { describe, expect, it } from 'vitest';
import { battleSplit, repertoireTable, rookSplit, usageTable } from './style-usage.mjs';

const t = (wins, losses, draws = 0) => ({ wins, losses, draws });

/** 20局: 自分は四間飛車6局・三間飛車2局(ほかは居飛車)、相手は中飛車5局、相振り飛車2局。 */
const state = {
  games: 20,
  wins: 11,
  losses: 8,
  draws: 1,
  usage: {
    rook: { 四間飛車: t(4, 2), 三間飛車: t(1, 1), 嬉野流: t(1, 0) },
    opponentRook: { 中飛車: t(3, 2) },
    battle: { 相振り飛車: t(1, 1), 矢倉: t(2, 1) },
    castle: { 本美濃: t(3, 1), 舟囲い: t(2, 2), 片美濃: t(1, 0), 金矢倉: t(1, 1), 高美濃: t(0, 1), 銀冠: t(1, 0) },
    opponentCastle: { 居飛車穴熊: t(2, 2) },
  },
};

describe('戦型の項目の表', () => {
  it('居飛車と振り飛車の割合は、振り飛車の戦法の記録と全部の対局から出す(嬉野流は居飛車)', () => {
    const [staticRow, ranging] = rookSplit(state, 'own');
    expect(ranging).toMatchObject({ label: '振り飛車', games: 8, wins: 5, losses: 3, share: 40 });
    expect(staticRow).toMatchObject({ label: '居飛車', games: 12, wins: 6, losses: 5, draws: 1, share: 60 });
    expect(staticRow.winRate).toBeCloseTo(0.5);
    const [opponentStatic, opponentRanging] = rookSplit(state, 'opponent');
    expect(opponentRanging).toMatchObject({ games: 5, share: 25 });
    expect(opponentStatic.games).toBe(15);
  });

  it('戦型は、相振り飛車の記録と両者の振り飛車の対局から割り出し、合計は全部の対局になる', () => {
    const rows = battleSplit(state);
    expect(rows.map(({ label }) => label)).toEqual(['相居飛車', '対抗形', '相振り飛車']);
    const [both, opposed, double] = rows;
    expect(double).toMatchObject({ games: 2, wins: 1, losses: 1 });
    // 自分の振り飛車8局 + 相手の振り飛車5局 − 相振り飛車2局×2 = 9局
    expect(opposed.games).toBe(9);
    expect(both.games).toBe(9);
    expect(both.games + opposed.games + double.games).toBe(20);
  });

  it('合わない記録(相振り飛車の記録が振り飛車の対局より多い)も、0〜対局数に収める', () => {
    const odd = { games: 3, wins: 1, losses: 2, draws: 0, usage: { battle: { 相振り飛車: t(1, 2) }, rook: { 四間飛車: t(1, 0) } } };
    const rows = battleSplit(odd);
    expect(rows.every(({ games }) => games >= 0 && games <= 3)).toBe(true);
    expect(rows[2].games).toBe(0);
    expect(rows.reduce((sum, { games }) => sum + games, 0)).toBe(3);
  });

  it('囲いの表は多い順に5つまでで、残りは数だけ。3局以上でいちばん勝つものに「得意」、5割未満に「にがて」', () => {
    const table = usageTable(state, 'castle');
    expect(table.rows.map(({ label }) => label)).toEqual(['本美濃', '舟囲い', '金矢倉', '銀冠', '片美濃']);
    expect(table.rest).toEqual({ count: 1, games: 1 });
    expect(table.rows[0]).toMatchObject({ share: 20, tag: 'best' });
    expect(table.rows[1].tag).toBe('');
    expect(usageTable({ games: 4, wins: 1, losses: 3, draws: 0, usage: { castle: { 舟囲い: t(1, 3) } } }, 'castle').rows[0].tag).toBe('weak');
    expect(usageTable({ games: 0 }, 'castle')).toEqual({ rows: [], rest: { count: 0, games: 0 } });
  });

  it('組んだ戦法の表は使用率の高い順に5つまでと、残りの割合', () => {
    const openings = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, index) => ({ id, label: id, rook: 'static', share: [30, 25, 20, 10, 10, 5][index] }));
    const table = repertoireTable(openings, 20);
    expect(table.rows).toHaveLength(5);
    expect(table.rows[0]).toMatchObject({ id: 'a', share: 30, games: 6 });
    expect(table.rest).toEqual({ count: 1, share: 5 });
  });
});
