import { describe, expect, it } from 'vitest';
import { asAvatarSeason, createSeason, describeSeason, playSpectatorGame, previewGroupBrackets, recordUserGame, replayRest, restGameKey, restOpen, seasonGameResults, settleRest } from './ryuo.mjs';
import { createRoster } from './ryuo-roster.mjs';
import {
  afterWatchRounds, applyMeijinWatchedRound, applyWatchedRound, elsewhereGames, hiddenRoundIds, meijinAfterRounds, meijinFinale, meijinHiddenKeys, meijinLiveEntry, meijinLiveRound, hiddenTables, liveDuration, liveGame, liveRound, liveState, maskBracketView, maskSeriesViews,
  pendingTable, roundTable, tableOf, viewersText,
} from './relay-live.mjs';
import { stepsAfterElimination, watchSteps } from './ryuo-watch.mjs';
import { HANANE } from './ryuo-story.mjs';

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

describe('回戦の全局を本局にする(20-9)', () => {
  it('同じ回戦のほかの試合の勝者を本局の結果に差し替える。分身の局とほかの回戦は変えない', () => {
    const season = watchSeason();
    const round = liveRound(season);
    const others = round.specs.slice(1);
    const flip = others.map((spec) => {
      const { id } = tableOf(spec.key);
      const winner = season.ranking.nodes[id].winner;
      const aId = spec.black.id;
      // 自動対局と逆の結果にする。
      return { nodeId: id, aId, result: { aWins: winner !== aId, how: 'middle', aColor: 'black', openings: { a: null, b: null }, castles: { a: null, b: null }, phases: [0, 0, 300], probability: null } };
    });
    const before = JSON.parse(JSON.stringify(season));
    const next = playSpectatorGame(JSON.parse(JSON.stringify(season)), { round: [...flip, { nodeId: round.table.nodeId, aId: 'user', result: flip[0].result }] });
    for (const { nodeId, aId, result } of flip) {
      const node = before.ranking.nodes[nodeId];
      const loser = node.winner;
      expect(next.ranking.nodes[nodeId].winner).not.toBe(loser);
      expect(next.ranking.nodes[nodeId].game.black).toBe(aId);
      expect(result.aWins ? aId : null).toBe(result.aWins ? next.ranking.nodes[nodeId].winner : null);
    }
    // 分身の局は、本局の結果(real)か自動対局で決まり、差し替えの対象にしない。
    expect(next.userGames).toHaveLength(1);
    expect(next.userGames[0].win).toBe(playSpectatorGame(JSON.parse(JSON.stringify(season))).userGames[0].win);
    // 自分で指す期は差し替えない。
    const own = JSON.parse(JSON.stringify(season));
    own.spectator = false;
    const id = flip[0].nodeId;
    const kept = own.ranking.nodes[id].winner;
    expect(playSpectatorGame(own, { round: flip }).ranking.nodes[id].winner).toBe(kept);
  });
});

describe('敗退後の観戦を本局にする(20-10)', () => {
  /** 敗退した期(勝ってから負ける)。 */
  function eliminated(seed, wins = 1) {
    const roster = createRoster({ seed: seed + 11, userGroup: 6 });
    let season = createSeason({ no: 1, mode: 'challenge', group: 6, settings, userLevel: 28, seed, roster });
    for (let index = 0; index < wins && season.pending; index += 1) season = recordUserGame(season, 'win');
    while (season.pending) season = recordUserGame(season, 'loss');
    return season;
  }
  /** 回戦の対局をすべて逆の結果にする本局の結果。 */
  const flipped = (round) => new Map(round.entries.map((entry) => {
    const aId = entry.black.id;
    const aWins = entry.winner !== 'black';
    return [entry.key, { aId, result: { aWins, how: 'middle', aColor: 'black', openings: { a: null, b: null }, castles: { a: null, b: null }, phases: [0, 0, aWins ? 300 : -300], probability: null } }];
  }));
  const gameKey = (entry) => {
    const { tag, id } = tableOf(entry.key);
    return restGameKey(tag, id);
  };
  const winners = (season) => Object.fromEntries(Object.entries(seasonGameResults(season)).map(([key, value]) => [key, value.winner]));

  it('敗退したら、残りを決める前の形を残す。竜王になった期は残さない', () => {
    const season = eliminated(5);
    expect(restOpen(season)).toBe(true);
    expect(season.rest.base.players).toBeNull();
    expect(season.rest.base.phase).not.toBe('done');
    // 決めてある結果を全部渡して指し直すと、同じ期になる。
    const same = replayRest(season, seasonGameResults(season));
    expect(winners(same)).toEqual(winners(season));
    expect(same.champion).toBe(season.champion);
    expect(same.result).toEqual(season.result);
    // 確定すると、土台は消え、指し直さない。
    const settled = settleRest(season);
    expect(restOpen(settled)).toBe(false);
    expect(settled.rest.base).toBeNull();
    expect(applyWatchedRound(settled, afterWatchRounds(settled)[0], flipped(afterWatchRounds(settled)[0]))).toBe(settled);
  });

  it('見終えた回戦は本局の結果に。見た回戦と、観戦しない回戦の結果は、そのあとの指し直しでも変わらない。プレイヤーの結果も変わらない', () => {
    for (const seed of [5, 17, 29, 41]) {
      let season = eliminated(seed, seed % 3);
      const before = winners(season);
      const userResult = JSON.stringify(season.result);
      const unwatched = new Set(Object.keys(before));
      for (const round of afterWatchRounds(season)) for (const entry of round.entries) unwatched.delete(gameKey(entry));
      // 決勝トーナメントの決勝は、挑戦者決定三番勝負で決まる(番勝負の局として見る)。
      unwatched.delete(season.main.root.from);
      const revealed = {};
      for (let index = 0; index < 40; index += 1) {
        const rounds = afterWatchRounds(season);
        if (index >= rounds.length) break;
        // 1回戦おきに、逆の結果(番狂わせ)にする。
        const round = rounds[index];
        const results = index % 2 === 0 ? flipped(round) : new Map();
        const next = applyWatchedRound(season, round, results);
        const now = winners(next);
        for (const entry of round.entries) {
          const key = gameKey(entry);
          const want = results.size ? (entry.winner === 'black' ? entry.white.id : entry.black.id) : (entry.winner === 'black' ? entry.black.id : entry.white.id);
          expect(now[key]).toBe(want);
          revealed[key] = want;
        }
        for (const [key, winner] of Object.entries(revealed)) expect(now[key]).toBe(winner);
        for (const key of unwatched) expect(`${key}:${now[key]}`).toBe(`${key}:${before[key]}`);
        expect(JSON.stringify({ ...next.result, champion: season.result.champion })).toBe(userResult.replace(/"champion":"[^"]*"/, `"champion":"${season.result.champion}"`));
        expect(next.result.champion).toBe(next.champion);
        expect(next.phase).toBe('done');
        // 指し直した番勝負と表は、つじつまが合う(竜王は七番勝負の勝者)。
        expect(next.champion).toBe(next.finals.winner);
        season = next;
      }
    }
  });

  it('順位(プレイヤーの昇級・降級に使う)は、指し直しても変わらない', () => {
    for (const seed of [7, 19, 31]) {
      let season = eliminated(seed, 0);
      const standing = season.standings.indexOf('user');
      for (const round of afterWatchRounds(season).slice(0, 6)) {
        const current = afterWatchRounds(season).find(({ id }) => id === round.id) ?? round;
        season = applyWatchedRound(season, current, flipped(current));
      }
      expect(season.standings.indexOf('user')).toBe(standing);
    }
  });
});

describe('名人戦の分身の次の一局の中継(21章)', () => {
  it('分身の次の一局の項目は、記録したあとの中継の項目と同じ鍵。本番の期は変えない', async () => {
    const { asAvatarMeijinSeason, createLeague, createMeijinSeason, playMeijinSpectatorGame } = await import('./meijin.mjs');
    const { meijinRelayGames } = await import('./relay-games.mjs');
    const roster = createRoster({ seed: 31 });
    const meijinSettings = { difficulty: 9, scale: 'full', coachLevel: 'detailed', hintLimit: 3, undoLimit: 3 };
    let season = asAvatarMeijinSeason(createMeijinSeason({ no: 1, league: createLeague(roster), roster, settings: meijinSettings, userLevel: 20, seed: 7 }), { rating: 1500, character: { abilities: {}, traits: [] } });
    for (let index = 0; index < 3; index += 1) {
      const before = JSON.stringify(season);
      const entry = meijinLiveEntry(season);
      expect(JSON.stringify(season)).toBe(before);
      expect(entry?.tags.self).toBe(true);
      expect([entry.black.id, entry.white.id]).toContain('user');
      expect([entry.black.id, entry.white.id]).toContain(season.pending.opponentId);
      season = playMeijinSpectatorGame(season);
      expect(meijinRelayGames(season).some(({ key }) => key === entry.key)).toBe(true);
    }
    // 自分で指す期は、自分の対局を中継に並べない。
    const own = createMeijinSeason({ no: 1, league: createLeague(roster), roster, settings: meijinSettings, userLevel: 20, seed: 7 });
    expect(meijinLiveEntry(own)).toBeNull();
  });
});

describe('名人戦の回戦の中継ボード(22章)', () => {
  it('分身の局を先頭に、同じ回戦のほかの対局を並べ、ボードで見るまで伏せる。本局の結果に差し替えて記録する', async () => {
    const { asAvatarMeijinSeason, createLeague, createMeijinSeason, playMeijinSpectatorGame } = await import('./meijin.mjs');
    const { meijinRelayGames } = await import('./relay-games.mjs');
    const roster = createRoster({ seed: 31 });
    const meijinSettings = { difficulty: 9, scale: 'full', coachLevel: 'detailed', hintLimit: 3, undoLimit: 3 };
    const season = asAvatarMeijinSeason(createMeijinSeason({ no: 1, league: createLeague(roster), roster, settings: meijinSettings, userLevel: 20, seed: 9 }), { rating: 1500, character: { abilities: {}, traits: [] } });
    const before = JSON.stringify(season);
    const round = meijinLiveRound(season);
    expect(JSON.stringify(season)).toBe(before);
    expect(round.specs[0]).toBe(round.avatar);
    const hidden = meijinHiddenKeys(season);
    expect(round.specs).toHaveLength(season.pending.others.games.length + 1);
    for (const spec of round.specs.slice(1)) expect(hidden.has(spec.key)).toBe(true);
    // 伏せた対局は、いまの期の中継の一覧から外せる(鍵が一覧の項目と同じ)。
    const listed = new Set(meijinRelayGames(season).map(({ key }) => key));
    for (const key of hidden) expect(listed.has(key)).toBe(true);
    // ほかの対局を逆の結果にして記録すると、表(結果)にその勝者が残る。
    const flips = round.specs.slice(1).map((spec) => {
      const aId = spec.black.id;
      const bId = spec.white.id;
      const aWins = spec.winner !== 'black';
      return { aId, bId, result: { aWins, how: 'middle', aColor: 'black', openings: { a: null, b: null }, castles: { a: null, b: null }, phases: [0, 0, aWins ? 300 : -300], probability: null } };
    });
    const next = playMeijinSpectatorGame(season, { round: flips });
    const recorded = next.results[season.pending.round].games;
    for (const { aId, bId, result } of flips) {
      const game = recorded.find(({ a, b }) => [a, b].sort().join() === [aId, bId].sort().join());
      expect(game.winner).toBe(result.aWins ? aId : bId);
      expect(game.black).toBe(aId);
    }
    // 自分で指す期では、伏せる対局はない。
    expect(meijinHiddenKeys({ ...season, spectator: false }).size).toBe(0);
  });
});

describe('名人戦の番勝負の観戦(23章)', () => {
  async function finished(seed, outcome = 'loss') {
    const { createLeague, createMeijinSeason, recordMeijinGame } = await import('./meijin.mjs');
    const roster = createRoster({ seed: 31 });
    const meijinSettings = { difficulty: 9, scale: 'mini', coachLevel: 'detailed', hintLimit: 3, undoLimit: 3 };
    let season = createMeijinSeason({ no: 1, league: createLeague(roster), roster, settings: meijinSettings, userLevel: 20, seed });
    for (let guard = 0; guard < 30 && season.pending; guard += 1) season = recordMeijinGame(season, outcome);
    return season;
  }
  const flip = (round) => new Map(round.entries.map((entry) => {
    const aId = entry.black.id;
    const aWins = entry.winner !== 'black';
    return [entry.key, { aId, result: { aWins, how: 'middle', aColor: 'black', openings: { a: null, b: null }, castles: { a: null, b: null }, phases: [0, 0, aWins ? 300 : -300], probability: null } }];
  }));

  it('A級でない期も、A級の1位が名人に挑戦する七番勝負を指す。自分の出ない局を1局ずつ観戦できる', async () => {
    const season = await finished(5);
    expect(season.phase).toBe('done');
    expect(season.cls).not.toBe('A');
    expect(season.finals?.winner).toBeTruthy();
    expect(season.challenger).toBe(season.tables.A[0].id);
    const rounds = meijinAfterRounds(season);
    expect(rounds.length).toBe(season.finals.games.length);
    expect(rounds.every(({ entries }) => entries.length === 1 && entries[0].kind === 'finals')).toBe(true);
    expect(meijinFinale(season).lines[0]).toMatch(/^第1期名人は、/);
  });

  it('1局ずつ逆の結果にして指し直しても、見た局は変わらず、七番勝負は先に4勝で終わり、プレイヤーの結果は変わらない', async () => {
    for (const seed of [5, 11, 23]) {
      let season = await finished(seed);
      const userResult = { ...season.result, challenger: null, titleWinner: null };
      const seen = [];
      for (let index = 0; index < 8; index += 1) {
        const rounds = meijinAfterRounds(season);
        if (index >= rounds.length) break;
        const round = rounds[index];
        const results = index % 2 === 0 ? flip(round) : new Map();
        const want = results.size ? (round.entries[0].winner === 'black' ? 'white' : 'black') : round.entries[0].winner;
        season = applyMeijinWatchedRound(season, round, results);
        seen.push([index, round.entries[0][want].id]);
        for (const [at, winner] of seen) expect(season.finals.games[at].winner).toBe(winner);
        expect(season.rest.revealed).toBe(index + 1);
        expect(Math.max(...Object.values(season.finals.wins))).toBe(4);
        expect(season.result.titleWinner).toBe(season.finals.winner);
        expect({ ...season.result, challenger: null, titleWinner: null }).toEqual(userResult);
      }
    }
  });
});

describe('ほかの組の注目の対局を見に行く(31章)', () => {
  /** 羽音をほかの組(groupの組)に移した名簿で、6組から出る観戦の期。 */
  function apartSeason(hananeGroup = 5, seed = 9) {
    const roster = createRoster({ seed: 52, userGroup: 6 });
    Object.values(roster.players).find((member) => member.story === HANANE).group = hananeGroup;
    return asAvatarSeason(createSeason({ no: 2, mode: 'challenge', group: 6, settings, userLevel: 20, seed, roster, userName: 'やこび' }), avatar);
  }
  const hananeIn = (entry) => entry.black.story === HANANE || entry.white.story === HANANE;

  it('ほかの組は組ごとの種で決めるので、先に決めた表と、自分の組が終わってから決めた表は同じ', () => {
    let season = apartSeason();
    const preview = previewGroupBrackets(season);
    expect(Object.keys(preview)).toContain('5');
    expect(season.groupBrackets ?? {}).toEqual({});
    for (let index = 0; index < 12 && season.phase !== 'main' && season.pending; index += 1) season = playSpectatorGame(season);
    for (const [tag, bracket] of Object.entries(preview)) {
      const winners = (table) => Object.fromEntries(Object.values(table.nodes).map((node) => [node.id, node.winner]));
      expect(winners(season.groupBrackets[tag]), tag).toEqual(winners(bracket));
    }
  });

  it('分身の次の一局と同じ時に、ほかの組で指されている羽音の対局を、ボードに足す(勝ち負けは先に決めた結果のまま)', () => {
    const season = apartSeason();
    const before = JSON.stringify(season);
    const games = elsewhereGames(season);
    expect(games.length).toBe(1);
    expect(games[0]).toMatchObject({ elsewhere: true, round: 1 });
    expect(hananeIn(games[0])).toBe(true);
    expect(games[0].label).toMatch(/^5組ランキング戦/);
    expect(games[0].tags.rival).toBe(true);
    const round = liveRound(season);
    expect(round.specs.at(-1).key).toBe(games[0].key);
    expect(round.elsewhereKeys).toEqual([games[0].key]);
    expect(JSON.stringify(season)).toBe(before);
    // 同じ組なら、表の上の局なので足さない。
    expect(elsewhereGames(watchSeason())).toEqual([]);
    // 自分で指す期では足さない。
    expect(elsewhereGames({ ...season, spectator: false })).toEqual([]);
  });

  it('分身が段を飛ばしたあいだ(敗者復活戦へ回ったとき)の羽音の対局も、次のボードに古い順で入る', () => {
    let season = apartSeason(6 - 1, 9);
    const seen = [];
    for (let index = 0; index < 8 && season.pending && season.pending.phase !== 'main'; index += 1) {
      seen.push(...elsewhereGames(season).map(({ key, round }) => ({ key, round })));
      season = playSpectatorGame(season);
    }
    // 同じ局は2度入らない。入った局は羽音のいる組の局だけ。
    expect(new Set(seen.map(({ key }) => key)).size).toBe(seen.length);
    expect(seen.every(({ key }) => key.includes(':group-5'))).toBe(true);
    expect(seen.length).toBeGreaterThan(0);
  });
});
