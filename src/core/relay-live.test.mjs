import { describe, expect, it } from 'vitest';
import { asAvatarSeason, createSeason, describeSeason, playSpectatorGame, recordUserGame } from './ryuo.mjs';
import { createRoster } from './ryuo-roster.mjs';
import {
  afterWatchRounds, hiddenRoundIds, hiddenTables, liveDuration, liveGame, liveRound, liveState, maskBracketView, maskSeriesViews,
  pendingTable, roundTable, tableOf, viewersText,
} from './relay-live.mjs';
import { stepsAfterElimination, watchSteps } from './ryuo-watch.mjs';

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
    // どの局も、終わる時刻ちょうどで終局する(小数の誤差で1手足りなくならない)。
    for (const item of games) expect(liveState(item, item.end / item.pace).done).toBe(true);
    for (const pace of [0.57, 0.61, 0.73, 0.83]) expect(liveState({ ...game, end: 118, pace }, 118 / pace).done).toBe(true);
    // 局ごとに終わる時刻がばらつく。
    expect(new Set(games.map((item) => Math.round(item.end / item.pace))).size).toBeGreaterThan(1);
  });

  it('中継で作った棋譜があれば、その手数と形勢を使う', () => {
    const spec = liveRound(watchSeason()).avatar;
    const record = { entries: [{ eval: 120 }, { eval: -300 }, { eval: 2600 }], end: { winner: 'black' } };
    const game = liveGame(spec, record);
    expect(game.end).toBe(3);
    expect(liveState(game, 2.1 / game.pace)).toMatchObject({ ply: 2 });
    expect(liveState(game, 2.1 / game.pace).blackPercent).toBeLessThan(50);
    expect(liveState(game, 100).done).toBe(true);
  });

  it('本局(20章): 指した手まで進み、次の手を待つあいだは考慮中。終局は棋譜の終わりが来てから', () => {
    const spec = liveRound(watchSeason()).avatar;
    const record = { entries: [{ eval: 50 }, { eval: -80 }], end: null };
    const game = liveGame({ ...spec, winner: null }, record);
    expect(game.live).toBe(true);
    expect(liveDuration([game])).toBe(Infinity);
    expect(liveState(game, 100)).toMatchObject({ ply: 2, done: false, thinking: true, winner: null });
    expect(liveState(game, 1.1 / game.pace)).toMatchObject({ ply: 1, thinking: false });
    record.entries.push({ eval: 3000 });
    record.end = { winner: 'black', reason: 'resign', plies: 3 };
    expect(liveState(game, 100)).toMatchObject({ ply: 3, done: true, thinking: false, winner: 'black' });
    expect(liveDuration([game])).toBeCloseTo(3 / game.pace);
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

describe('敗退後の観戦を表で見る(19章)', () => {
  const roster = createRoster({ seed: 21, userGroup: 6 });
  let season = createSeason({ no: 1, mode: 'challenge', group: 6, settings, userLevel: 28, seed: 5, roster });
  season = recordUserGame(season, 'win');
  season = recordUserGame(season, 'loss');
  while (season.pending) season = recordUserGame(season, 'loss');

  it('回戦の並び: ほかの組は同じ名前の回戦ごと、番勝負は1局ずつ。対局は敗退後の観戦と同じ', () => {
    const rounds = afterWatchRounds(season);
    const steps = stepsAfterElimination(season, watchSteps(season));
    expect(rounds.flatMap(({ entries }) => entries).map(({ key }) => key).sort()).toEqual(steps.flatMap(({ entries }) => entries).map(({ key }) => key).sort());
    const groups = rounds.filter(({ stage }) => stage === 'group');
    expect(groups.length).toBeGreaterThan(1);
    expect(groups.at(-1).label).toBe('ほかの組 決勝');
    for (const round of groups) expect(new Set(round.entries.map(({ label }) => label.split(' ').at(-1))).size).toBe(1);
    expect(rounds.at(-1).stage).toBe('finals');
    expect(roundTable(rounds.at(-1))).toMatchObject({ stage: 2, tag: 'finals' });
    expect(roundTable(groups[0]).stage).toBe(0);
    expect(roundTable(groups[0]).tag).toMatch(/^group-/);
    expect(roundTable(rounds.find(({ stage }) => stage === 'main'))).toEqual({ stage: 1, tag: 'main' });
  });

  it('伏せる札は表ごと。三番勝負を伏せている間は、決勝トーナメントの決勝も伏せる', () => {
    const rounds = afterWatchRounds(season);
    const hidden = hiddenTables(rounds.flatMap(({ entries }) => entries), { mainRootId: 'root' });
    expect(hidden.get('main')?.has('root')).toBe(true);
    expect(hidden.has('playoff')).toBe(true);
    const entry = rounds[0].entries[0];
    expect(hidden.get(tableOf(entry.key).tag)?.has(tableOf(entry.key).id)).toBe(true);
    expect(hiddenTables([{ key: 'ryuo:s1:main:n3' }], { mainRootId: 'root' }).get('main')).toEqual(new Set(['n3']));
  });

  it('番勝負の星取りを伏せる(勝ち数を数え直す。三番勝負の決着前は七番勝負を出さない)', () => {
    const series = describeSeason(season).stages.series;
    expect(series.map(({ key }) => key)).toEqual(['playoff', 'finals']);
    const all = new Map([['playoff', new Set(['0', '1', '2'])], ['finals', new Set(['0', '1', '2', '3', '4', '5', '6'])]]);
    const masked = maskSeriesViews(series, all);
    expect(masked).toHaveLength(1);
    expect(masked[0]).toMatchObject({ key: 'playoff', games: [], wins: { me: 0, them: 0 }, nextNo: 1, winner: null });
    const reveal = new Map([['playoff', new Set(['0'])]]);
    const one = maskSeriesViews(series, all, reveal)[0];
    expect(one.games).toHaveLength(1);
    expect(one.wins.me + one.wins.them).toBe(1);
    // 三番勝負が終われば、七番勝負は第1局から。
    const finalsOnly = maskSeriesViews(series, new Map([['finals', new Set(['0', '1', '2', '3', '4', '5', '6'])]]));
    expect(finalsOnly.map(({ key }) => key)).toEqual(['playoff', 'finals']);
    expect(finalsOnly[1].games).toHaveLength(0);
    expect(maskSeriesViews(series, new Map())).toBe(series);
  });

  it('決勝トーナメントの出場者を枠の名前で伏せる', () => {
    const final = describeSeason(season).stages.final;
    const ids = new Set(final.matches.map(({ id }) => String(id)));
    const masked = maskBracketView(final, { hidden: ids, blankEntrants: true });
    const slots = masked.matches.flatMap(({ top, bottom }) => [top, bottom]);
    expect(slots.every((slot) => slot.pid === null && slot.placeholder)).toBe(true);
    expect(slots.some((slot) => /組/.test(slot.placeholder))).toBe(true);
    expect(masked.matches.every(({ winner }) => winner === null)).toBe(true);
  });
});
