import { describe, expect, it } from 'vitest';
import { STAGE_SEAL_PLY, STAGE_VENUES, describeMatchStage, seriesStakes, stageDay, stageSealPly, stageVenue } from './match-stage.mjs';

const players = { p1: { name: '斎藤大和', dan: '九段' } };
const games = (list) => list.map((winner) => ({ winner }));

function finalsSeason({ a = 'p1', b = 'user', wins = { p1: 0, user: 0 }, played = [] } = {}) {
  return {
    no: 7,
    players,
    pending: { kind: 'finals', opponentId: 'p1', gameNo: played.length + 1, need: 4 },
    finals: { a, b, need: 4, wins, games: games(played), winner: null },
  };
}

describe('対局の舞台(大会の1局を見分ける形)', () => {
  it('タイトル戦(七番勝負)は、対局場・二日制・肩書・星取りを持つ', () => {
    const season = finalsSeason({ wins: { p1: 1, user: 2 }, played: ['user', 'p1', 'user'] });
    const stage = describeMatchStage({ event: 'ryuo', season, label: '竜王戦七番勝負 第4局', userName: 'やこび' });
    expect(stage.weight).toBe('title');
    expect(stage.eventText).toBe('第7期 竜王戦');
    expect(stage.label).toBe('竜王戦七番勝負 第4局');
    expect(stage.shortLabel).toBe('七番勝負 第4局');
    expect(STAGE_VENUES).toContain(stage.venue);
    expect(stage.venue).toBe(stageVenue('ryuo', 7, 4));
    expect(stage.twoDay).toBe(true);
    expect(stage.marks).toEqual(['win', 'loss', 'win']);
    expect(stage.score).toBe('2勝1敗');
    expect(stage.stakes).toBe('竜王まであと2勝');
    // 挑戦する側: 相手が竜王、あなたが挑戦者。竜王を先に並べる。
    expect(stage.opponentRole).toBe('竜王');
    expect(stage.userRole).toBe('挑戦者');
    expect(stage.sides).toEqual([
      { role: '竜王', name: '斎藤大和', you: false },
      { role: '挑戦者', name: 'やこび', you: true },
    ]);
    expect(stage.coachLine).toContain('竜王まであと2勝');
  });

  it('防衛戦では、あなたが竜王(名人)。第1局は星取りなしで、大舞台の一言', () => {
    const season = finalsSeason({ a: 'user', b: 'p1', wins: { user: 0, p1: 0 } });
    const stage = describeMatchStage({ event: 'meijin', season, label: '名人戦七番勝負 第1局' });
    expect(stage.eventText).toBe('第7期 名人戦');
    expect(stage.userRole).toBe('名人');
    expect(stage.opponentRole).toBe('挑戦者');
    expect(stage.sides[0]).toEqual({ role: '名人', name: 'あなた', you: true });
    expect(stage.score).toBe('');
    expect(stage.stakes).toBe('防衛まであと4勝');
    expect(stage.coachLine).toBe('名人戦七番勝負 第1局。名人をかけた大舞台だよ。いつもどおりにね！');
  });

  it('あと1勝・カド番・最終局を見分ける', () => {
    const base = { need: 4, goal: '竜王', finish: '竜王', prize: '竜王' };
    expect(seriesStakes({ ...base, winsUser: 3, winsOpponent: 1 })).toEqual({ tone: 'reach', text: '勝てば竜王' });
    expect(seriesStakes({ ...base, winsUser: 1, winsOpponent: 3 })).toEqual({ tone: 'kadoban', text: 'カド番・負ければ終わり' });
    expect(seriesStakes({ ...base, winsUser: 3, winsOpponent: 3 })).toEqual({ tone: 'final', text: '最終局・勝ったほうが竜王' });
    expect(seriesStakes({ ...base, winsUser: 0, winsOpponent: 2 })).toEqual({ tone: '', text: '竜王まであと4勝' });
    const reach = describeMatchStage({ event: 'ryuo', season: finalsSeason({ wins: { p1: 2, user: 3 }, played: ['user', 'p1', 'user', 'p1', 'user'] }) });
    expect(reach.coachLine).toBe('あと1勝で竜王！ 落ち着いていこう');
    const defense = describeMatchStage({ event: 'ryuo', season: finalsSeason({ a: 'user', b: 'p1', wins: { user: 3, p1: 0 }, played: ['user', 'user', 'user'] }) });
    expect(defense.stakes).toBe('勝てば竜王を防衛');
  });

  it('挑戦者決定三番勝負と山場の1局は大一番。ふつうの1局は札だけで、いつもの一言', () => {
    const playoff = describeMatchStage({
      event: 'ryuo',
      season: {
        no: 3, players,
        pending: { kind: 'playoff', opponentId: 'p1', gameNo: 2, need: 2 },
        playoff: { a: 'user', b: 'p1', need: 2, wins: { user: 1, p1: 0 }, games: games(['user']) },
      },
      label: '挑戦者決定三番勝負 第2局',
    });
    expect(playoff.weight).toBe('big');
    expect(playoff.twoDay).toBe(false);
    expect(playoff.venue).toBe('');
    expect(playoff.stakes).toBe('勝てば挑戦者');
    expect(playoff.userRole).toBe('');
    expect(playoff.coachLine).toBe('勝てば挑戦者！ ここが大一番だよ');
    const boss = describeMatchStage({
      event: 'ryuo',
      season: { no: 3, players, pending: { kind: 'game', opponentId: 'p1' } },
      label: '5組ランキング戦 決勝',
      stakes: { goal: '5組優勝まであと1勝・昇級まであと1勝', win: '5組優勝・昇級！', boss: true },
    });
    expect(boss.weight).toBe('big');
    expect(boss.stakes).toBe('勝てば5組優勝・昇級');
    expect(boss.shortLabel).toBe('5組ランキング戦 決勝');
    expect(boss.coachLine).toBe('大一番だね。勝てば5組優勝・昇級だよ！');
    const plain = describeMatchStage({
      event: 'meijin',
      season: { no: 2, players, pending: { kind: 'league', opponentId: 'p1', label: 'C級2組 3回戦' } },
      stakes: { text: '昇級まであと…', boss: false },
    });
    expect(plain.weight).toBe('plain');
    expect(plain.label).toBe('C級2組 3回戦');
    expect(plain.stakes).toBe('昇級まであと…');
    expect(plain.sides[1]).toEqual({ role: '九段', name: '斎藤大和', you: false });
    expect(plain.coachLine).toBeNull();
    expect(describeMatchStage({ event: 'ryuo', season: { pending: null } })).toBeNull();
  });

  it('封じ手は、1日目の終わりの手数を越えて最初に指したプレイヤーの手。二日制だけ2日目になる', () => {
    expect(STAGE_SEAL_PLY).toBe(40);
    expect(stageSealPly('black')).toBe(41);
    expect(stageSealPly('white')).toBe(42);
    const title = { twoDay: true };
    expect(stageDay(title, 40, 'black')).toBe('1日目');
    expect(stageDay(title, 41, 'black')).toBe('2日目');
    expect(stageDay(title, 41, 'white')).toBe('1日目');
    expect(stageDay({ twoDay: false }, 80, 'black')).toBe('');
    expect(stageDay(null, 80, 'black')).toBe('');
  });

  it('対局場は期と局で決まる', () => {
    expect(stageVenue('ryuo', 1, 1)).toBe(stageVenue('ryuo', 1, 1));
    const venues = new Set(Array.from({ length: 7 }, (_, index) => stageVenue('ryuo', 1, index + 1)));
    expect(venues.size).toBeGreaterThan(2);
  });
});
