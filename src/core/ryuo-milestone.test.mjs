import { describe, expect, it } from 'vitest';
import { UPSET_LIMIT, bestAxisLine, lastGameMilestone, latestUpsetLine, seasonUpsets } from './ryuo-milestone.mjs';
import { createSeason, describeSeason, recordUserGame } from './ryuo.mjs';
import { USER_HOLDER } from './ryuo-roster.mjs';
import { HANANE } from './ryuo-story.mjs';

const settings = (overrides = {}) => ({ difficulty: 9, scale: 3, revival: true, ...overrides });
const fresh = (overrides = {}) => createSeason({ no: 1, mode: 'challenge', group: 6, settings: settings(), userLevel: 20, seed: 11, ...overrides });
const play = (season, outcomes) => outcomes.reduce((next, outcome) => (next.pending ? recordUserGame(next, outcome) : next), season);

describe('竜王戦の節目', () => {
  it('ふつうの回戦の勝ちと負けは節目にしない(道の動きだけ)', () => {
    expect(lastGameMilestone(fresh(), { promote: 2 })).toBeNull();
    expect(lastGameMilestone(play(fresh(), ['win']), { promote: 2 })).toBeNull();
    expect(lastGameMilestone(play(fresh(), ['loss']), { promote: 2 })).toBeNull();
  });

  it('組の決勝に勝てば組優勝・昇級(大)、挑戦者決定戦を制すれば挑戦権(大)、七番勝負を制すれば竜王(最大)', () => {
    let season = fresh();
    const seen = [];
    let guard = 0;
    while (season.phase !== 'done' && guard < 30) {
      season = recordUserGame(season, 'win');
      guard += 1;
      const milestone = lastGameMilestone(season, { promote: 2 });
      if (milestone) seen.push(`${milestone.kind}:${milestone.weight}:${milestone.seal}`);
    }
    expect(seen).toEqual(['group:big:優勝', 'main:mid:突破', 'challenger:big:挑戦', 'crown:max:竜王']);
    expect(describeSeason(season).milestone).toMatchObject({ kind: 'crown', title: '竜王になった！' });
  });

  it('組優勝は昇級先、1組は決勝トーナメントを言う', () => {
    const sixth = play(fresh(), ['win', 'win', 'win', 'win', 'win']);
    expect(lastGameMilestone(sixth, { promote: 2 })).toMatchObject({ title: '6組優勝！', sub: '5組へ昇級' });
    const first = createSeason({ no: 1, mode: 'challenge', group: 1, settings: settings(), userLevel: 30, seed: 3 });
    const won = play(first, Array(first.ranking.rounds).fill('win'));
    expect(lastGameMilestone(won, { promote: 2 })).toMatchObject({ title: '1組優勝！', sub: '決勝トーナメントへ' });
  });

  it('敗者復活戦を勝ち抜くと、規模に応じて昇級か残留', () => {
    let season = play(createSeason({ no: 1, mode: 'challenge', group: 5, settings: settings(), userLevel: 20, seed: 11 }), ['loss']);
    let guard = 0;
    while (season.pending?.phase === 'revival' && guard < 10) {
      season = recordUserGame(season, 'win');
      guard += 1;
    }
    expect(lastGameMilestone(season, { promote: 2 })).toMatchObject({ kind: 'revival', weight: 'mid', seal: '残留' });
    expect(lastGameMilestone(season, { promote: 3 })).toMatchObject({ kind: 'revival', weight: 'big', seal: '昇級', title: '4組へ昇級！' });
  });

  it('ライバルに勝つと突破(中)', () => {
    const season = fresh();
    const opponent = season.pending.opponentId;
    season.players[opponent].story = HANANE;
    expect(lastGameMilestone(play(season, ['win']), { promote: 2 })).toMatchObject({ kind: 'rival', weight: 'mid', seal: '突破' });
  });
});

describe('大番狂わせ', () => {
  it('レーティングが200以上低い棋士の勝ちを、表・回戦ごとに1つ、1期に3つまで知らせる', () => {
    let season = fresh();
    // 1回戦の、ほかの対局のうち1局を、大番狂わせにする。
    const node = Object.values(season.ranking.nodes).find((entry) => entry.round === 1 && entry.winner && entry.a?.pid !== USER_HOLDER && entry.b?.pid !== USER_HOLDER);
    const loser = node.winner === node.a.pid ? node.b.pid : node.a.pid;
    season.players[loser].rating = season.players[node.winner].rating + 260;
    const upsets = seasonUpsets(season);
    expect(upsets.length).toBeLessThanOrEqual(UPSET_LIMIT);
    expect(upsets.find(({ round }) => round === 1)).toMatchObject({ phase: 'ranking', gap: expect.any(Number) });
    // プレイヤーが1回戦を指したあとに、同じ回戦の大番狂わせを1行で知らせる。
    expect(latestUpsetLine(season)).toBe('');
    season = recordUserGame(season, 'win');
    const line = latestUpsetLine(season);
    expect(line).toMatch(/^大番狂わせ！ .+が、.+を破ったよ。$/);
    expect(describeSeason(season).upset).toBe(line);
  });

  it('期のできたことは、レーダーチャートのいちばん高い項目', () => {
    expect(bestAxisLine([{ label: '序盤', value: 40 }, { label: '終盤', value: 72.4 }, { label: '詰将棋', value: null }])).toBe('この期いちばん光っていたのは「終盤」（72点）だよ。');
    expect(bestAxisLine([{ label: '序盤', value: null }])).toBe('');
  });
});
