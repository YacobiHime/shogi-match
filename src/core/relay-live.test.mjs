import { describe, expect, it } from 'vitest';
import { asAvatarSeason, createSeason, playSpectatorGame } from './ryuo.mjs';
import { createRoster } from './ryuo-roster.mjs';
import {
  hiddenRoundIds, liveDuration, liveGame, liveRound, liveState, maskBracketView, pendingTable, viewersText,
} from './relay-live.mjs';

const settings = { difficulty: 9, scale: 3, revival: true };
const avatar = { rating: 1500, character: { abilities: {}, traits: [] } };

function watchSeason(seed = 9) {
  const roster = createRoster({ seed: 52, userGroup: 6 });
  return asAvatarSeason(createSeason({ no: 2, mode: 'challenge', group: 6, settings, userLevel: 20, seed, roster, userName: 'やこび' }), avatar);
}

describe('回戦の中継ボード(18章)', () => {
  it('次の一局の表と、伏せる同じ回戦のほかの試合(決まっているが、ボードで見るまで伏せる)', () => {
    const season = watchSeason();
    const table = pendingTable(season);
    expect(table).toMatchObject({ tag: 'ranking', stage: 'group', round: 1 });
    const hidden = hiddenRoundIds(season);
    expect(hidden.size).toBeGreaterThan(0);
    expect(hidden.has(table.nodeId)).toBe(false);
    for (const id of hidden) {
      expect(season.ranking.nodes[id].round).toBe(1);
      expect(season.ranking.nodes[id].winner).toBeTruthy();
    }
    // 自分で指す期は伏せない。
    expect(hiddenRoundIds({ ...season, spectator: false }).size).toBe(0);
  });

  it('ボードの対局は、分身の対局が先頭で、同じ回戦のほかの対局が並ぶ。本番の期は変えない', () => {
    const season = watchSeason();
    const before = JSON.stringify(season);
    const round = liveRound(season);
    expect(round.avatar?.tags.self).toBe(true);
    expect(round.specs[0]).toBe(round.avatar);
    expect(round.specs).toHaveLength(hiddenRoundIds(season).size + 1);
    expect(new Set(round.specs.map(({ label }) => label)).size).toBe(1);
    expect(JSON.stringify(season)).toBe(before);
    // 分身の勝敗は、本番の期を進めたときと同じ。
    const next = playSpectatorGame(season);
    expect(next.userGames[0].win).toBe(round.avatar.winner === (round.avatar.black.id === 'user' ? 'black' : 'white'));
  });

  it('何手目・形勢・視聴者数は時刻とともに進み、終局で勝者が分かる', () => {
    const round = liveRound(watchSeason());
    const games = round.specs.map((spec) => liveGame(spec));
    const game = games[0];
    expect(liveState(game, 0)).toMatchObject({ ply: 0, done: false, winner: null });
    const mid = liveState(game, game.end / game.pace / 2);
    expect(mid.ply).toBeGreaterThan(0);
    expect(mid.done).toBe(false);
    expect(mid.viewers).toBeGreaterThan(liveState(game, 0).viewers);
    const end = liveState(game, liveDuration(games));
    expect(end).toMatchObject({ ply: game.end, done: true, winner: game.spec.winner });
    // 終局では、勝った側の勝率が高い。
    const winnerPercent = game.spec.winner === 'black' ? end.blackPercent : 100 - end.blackPercent;
    expect(winnerPercent).toBeGreaterThanOrEqual(85);
    // 局ごとに終わる時刻がばらつく。
    expect(new Set(games.map((item) => Math.round(item.end / item.pace))).size).toBeGreaterThan(1);
  });

  it('中継で作った棋譜があれば、その手数と形勢を使う', () => {
    const spec = liveRound(watchSeason()).avatar;
    const record = { entries: [{ eval: 120 }, { eval: -300 }, { eval: 2600 }] };
    const game = liveGame(spec, record);
    expect(game.end).toBe(3);
    expect(liveState(game, 2.1 / game.pace)).toMatchObject({ ply: 2 });
    expect(liveState(game, 2.1 / game.pace).blackPercent).toBeLessThan(50);
    expect(liveState(game, 100).done).toBe(true);
  });

  it('表の結果を伏せる(次の試合は「○回戦の勝者」)・見せる', () => {
    const slot = (pid, from = null) => ({ pid, name: pid, dan: '', label: '', story: null, you: false, from, placeholder: '' });
    const view = {
      rounds: [{ round: 1, label: '1回戦' }, { round: 2, label: '2回戦' }],
      matches: [
        { id: 'a', round: 1, top: slot('p1'), bottom: slot('p2'), winner: 'top', how: 'ending' },
        { id: 'b', round: 1, top: slot('user'), bottom: slot('p4'), winner: null, how: '' },
        { id: 'c', round: 2, top: slot('p1', 'a'), bottom: { ...slot(null, 'b'), placeholder: '1回戦の勝者' }, winner: null, how: '' },
      ],
    };
    const masked = maskBracketView(view, { hidden: new Set(['a']) });
    expect(masked.matches[0].winner).toBeNull();
    expect(masked.matches[2].top).toMatchObject({ pid: null, placeholder: '1回戦の勝者' });
    const shown = maskBracketView(view, { hidden: new Set(['a']), reveal: new Map([['a', 'p1'], ['b', 'p4']]) });
    expect(shown.matches[0].winner).toBe('top');
    expect(shown.matches[1].winner).toBe('bottom');
    expect(shown.matches[2].top.pid).toBe('p1');
    expect(maskBracketView(view, {})).toBe(view);
  });

  it('視聴者数の書き方', () => {
    expect(viewersText(8250)).toBe('8,250');
    expect(viewersText(12000)).toBe('1.2万');
    expect(viewersText(30000)).toBe('3万');
  });
});
