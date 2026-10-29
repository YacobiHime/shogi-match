import { describe, expect, it } from 'vitest';
import { USER_ID, createSeason, recordUserGame } from './ryuo.mjs';
import { createLeague, createMeijinSeason, recordMeijinGame } from './meijin.mjs';
import { createRoster } from './ryuo-roster.mjs';
import { HANANE } from './ryuo-story.mjs';
import { isFeatured, meijinRelayGames, relayGamesOf, relayRoundNews, relaySections, ryuoRelayGames } from './relay-games.mjs';
import { emptyRelayStore, isStaleRelayGame, loadRelayStore, markRelaySeen, packRelayGame, recallRelayGame, rememberRelayGame, saveRelayStore, unpackRelayGame } from './relay-store.mjs';

const settings = { difficulty: 9, scale: 3, revival: true };

function playRyuo(season, games = 3) {
  let current = season;
  for (let index = 0; index < games && current.pending; index += 1) current = recordUserGame(current, 'win');
  return current;
}

describe('ryuoRelayGames', () => {
  const roster = createRoster({ seed: 21, userGroup: 6 });
  const season = playRyuo(createSeason({ no: 1, mode: 'challenge', group: 6, settings, userLevel: 28, seed: 5, roster }), 2);
  const games = ryuoRelayGames(season, { oshiId: null });

  it('決着した棋士どうしの対局だけを集め、自分の対局は入れない', () => {
    expect(games.length).toBeGreaterThan(10);
    for (const entry of games) {
      expect(entry.black.id).not.toBe(USER_ID);
      expect(entry.white.id).not.toBe(USER_ID);
      expect(['black', 'white']).toContain(entry.winner);
      expect(entry.seed).toBeGreaterThan(0);
    }
    expect(new Set(games.map(({ key }) => key)).size).toBe(games.length);
  });

  it('勝者・先手・戦法は、トーナメント表の記録と同じ', () => {
    const entry = games.find((item) => item.key.includes(':ranking:'));
    const nodeId = entry.key.split(':').at(-1);
    const node = season.ranking.nodes[nodeId];
    const winnerId = entry.winner === 'black' ? entry.black.id : entry.white.id;
    expect(winnerId).toBe(node.winner);
    expect(entry.black.id).toBe(node.game.black);
    expect(entry.openings.black).toBe(node.game.openings[entry.black.id]);
    // 新しく決まった局は、展開(先手から見た形勢)を持つ。
    expect(entry.story).toHaveLength(3);
    expect(entry.label).toMatch(/^6組ランキング戦 /);
  });

  it('羽音の対局は注目になり、区分けの先頭に出る。棋士ごとに対局を引ける', () => {
    const rival = Object.values(season.players).find((player) => player.story === HANANE);
    const own = relayGamesOf(games, rival.id);
    expect(own.length).toBeGreaterThan(0);
    expect(own.every((entry) => entry.tags.rival && isFeatured(entry))).toBe(true);
    const sections = relaySections(games);
    expect(sections[0].id).toBe('featured');
    expect(sections.some(({ id }) => id === 'own')).toBe(true);
  });

  it('同じ回戦のほかの結果を、注目の対局から順に知らせる(自分の局は入れない)', () => {
    const spec = games.find((entry) => games.filter((other) => other.label === entry.label).length >= 3);
    const news = relayRoundNews(games, spec);
    expect(news.length).toBeGreaterThan(0);
    expect(news.length).toBeLessThanOrEqual(4);
    expect(news.every((text) => /^.+ 勝ち（対 .+）$/.test(text))).toBe(true);
    const own = spec.winner === 'black' ? spec.black : spec.white;
    expect(news.some((text) => text.startsWith(`${own.name}${own.dan} 勝ち（対 ${(spec.winner === 'black' ? spec.white : spec.black).name}`))).toBe(false);
  });

  it('次の相手の対局には、次の相手の印が付く', () => {
    const nextId = season.pending?.opponentId;
    if (!nextId) return;
    const tagged = games.filter((entry) => entry.tags.next);
    expect(tagged.every((entry) => entry.black.id === nextId || entry.white.id === nextId)).toBe(true);
  });
});

describe('番勝負の星(30章)', () => {
  it('タイトル戦の各局に、その局の前の星とタイトル保持者の側を持たせる', () => {
    const pro = (name) => ({ name, dan: '九段', rating: 1900 });
    const season = {
      id: 's1', no: 1, players: { h: pro('天野一郎'), c: pro('川口二郎') },
      finals: { a: 'h', b: 'c', need: 4, games: [{ winner: 'h' }, { winner: 'h' }, { winner: 'c' }, { winner: 'h' }] },
    };
    const finals = ryuoRelayGames(season).filter(({ kind }) => kind === 'finals').sort((x, y) => x.gameNo - y.gameNo);
    expect(finals).toHaveLength(4);
    const fourth = finals[3];
    const holder = fourth.black.id === 'h' ? 'black' : 'white';
    expect(fourth.series).toEqual({ holder, need: 4, wins: { [holder]: 2, [holder === 'black' ? 'white' : 'black']: 1 } });
    expect(finals[0].series.wins).toEqual({ black: 0, white: 0 });
  });
});

describe('meijinRelayGames', () => {
  const roster = createRoster({ seed: 31 });
  const season = createMeijinSeason({ no: 1, league: createLeague(roster), roster, settings: { difficulty: 9, scale: 'mini' }, userLevel: 12, seed: 7 });
  const later = recordMeijinGame(season, 'win');

  it('順位戦の回戦ごとの対局(いまの回戦の決まった対局を含む)を集める', () => {
    const now = meijinRelayGames(season);
    expect(now.length).toBeGreaterThan(0);
    expect(now.every((entry) => entry.tags.current && entry.kind === 'league')).toBe(true);
    const after = meijinRelayGames(later);
    expect(after.length).toBeGreaterThan(now.length);
    expect(after.every((entry) => entry.black.id !== USER_ID && entry.white.id !== USER_ID)).toBe(true);
    expect(after[0].label).toMatch(/C級2組/);
  });

  it('「この回戦」と同じ顔ぶれの区分は、2つ並べない', () => {
    const ids = relaySections(meijinRelayGames(season)).map(({ id }) => id);
    expect(ids).toContain('current');
    expect(ids).not.toContain('league');
    expect(relaySections(meijinRelayGames(later)).map(({ id }) => id)).toContain('league');
  });
});

describe('relay-store', () => {
  const game = {
    v: 2, key: 'k1',
    entries: [
      { move: '7g7f', eval: 40, pv: '3c3d 2g2f', best: '', loss: 0, time: 30, mark: 'book' },
      { move: '3c3d', eval: 35, pv: '', best: '8c8d', loss: 20, time: 125, mark: 'slip' },
    ],
    end: { winner: 'white', reason: 'resign', plies: 2 },
  };
  function memoryStorage() {
    const map = new Map();
    return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: (key) => map.delete(key) };
  }

  it('前の版の棋譜で、最後の形勢が負けた側に傾いたまま終わったもの(優勢なのに投了)は、作り直す(15章)', () => {
    const store = rememberRelayGame(emptyRelayStore(), { ...game, v: 1 });
    expect(isStaleRelayGame({ ...game, v: 1 })).toBe(true);
    expect(recallRelayGame(store, 'k1').game).toBeNull();
    // 勝者に傾いて終わった前の版の棋譜は、そのまま見られる。
    const fine = { ...game, v: 1, end: { ...game.end, winner: 'black' } };
    expect(isStaleRelayGame(fine)).toBe(false);
    expect(recallRelayGame(rememberRelayGame(emptyRelayStore(), fine), 'k1').game).not.toBeNull();
  });

  it('保存の形にして、元に戻せる', () => {
    expect(unpackRelayGame('k1', packRelayGame(game))).toEqual(game);
    expect(unpackRelayGame('k1', { m: '7g7f', e: [], t: [] })).toBeNull();
  });

  it('上限を超えたら古いものから消し、見たものは新しくする。視聴済みの印を残す', () => {
    let store = emptyRelayStore();
    for (const key of ['a', 'b', 'c']) store = rememberRelayGame(store, { ...game, key }, 2);
    expect(store.order).toEqual(['b', 'c']);
    expect(store.games.a).toBeUndefined();
    const recalled = recallRelayGame(store, 'b');
    expect(recalled.game?.entries).toHaveLength(2);
    expect(recalled.store.order).toEqual(['c', 'b']);
    store = markRelaySeen(markRelaySeen(store, 'b'), 'b');
    expect(store.seen).toEqual(['b']);
    const storage = memoryStorage();
    saveRelayStore(storage, store);
    expect(loadRelayStore(storage)).toEqual(store);
    expect(loadRelayStore({ getItem: () => '{broken' })).toEqual(emptyRelayStore());
  });
});
