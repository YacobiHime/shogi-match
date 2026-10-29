import { describe, expect, it } from 'vitest';
import { loadMyGames, myGameRecord, myRelayKey, myRelaySpec, MY_GAMES_KEY, MY_GAMES_LIMIT, MY_THINK_CAP_SECONDS, saveMyGame } from './my-games.mjs';
import { relaySections } from './relay-games.mjs';

function memoryStorage() {
  const map = new Map();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)) };
}

const opponent = { id: 'p12', name: '中村大輔', dan: '七段', rating: 1700, level: 30, story: null, kind: 'pro', character: { attack: 0.3 } };

function gameOf(extra = {}) {
  return myGameRecord({
    at: 1000, event: 'ryuo', eventText: '第3期 竜王戦', label: '決勝トーナメント 2回戦', venue: '将棋会館', weight: 'big',
    userColor: 'white', user: { name: 'やこび', dan: '四段', rating: 1500 }, opponent,
    winner: 'white', reason: 'mate', moves: ['7g7f', '3c3d', '2g2f'], times: [12, 0, 9999], mate: { plies: 1, from: 3 },
    ...extra,
  });
}

describe('自分の対局の記録', () => {
  it('考えた時間は1秒から上限まで。手と勝ち負けと寄せを残す', () => {
    const game = gameOf();
    expect(game.times).toEqual([12, 1, MY_THINK_CAP_SECONDS]);
    expect(game).toMatchObject({ id: 'ryuo:1000', winner: 'white', reason: 'mate', userColor: 'white', mate: { plies: 1, from: 3 } });
    expect(game.opponent).toMatchObject({ id: 'p12', name: '中村大輔', dan: '七段' });
  });

  it('新しい順に上限まで残し、同じ対局は置き換える。壊れた保存と形の合わない対局は捨てる', () => {
    const storage = memoryStorage();
    for (let index = 0; index < MY_GAMES_LIMIT + 2; index += 1) saveMyGame(storage, gameOf({ at: index }));
    const list = loadMyGames(storage);
    expect(list).toHaveLength(MY_GAMES_LIMIT);
    expect(list[0].at).toBe(MY_GAMES_LIMIT + 1);
    saveMyGame(storage, gameOf({ at: MY_GAMES_LIMIT + 1, winner: 'black' }));
    expect(loadMyGames(storage)[0].winner).toBe('black');
    expect(loadMyGames(storage)).toHaveLength(MY_GAMES_LIMIT);
    storage.setItem(MY_GAMES_KEY, JSON.stringify([{ id: 'x', moves: ['7g7f'], times: [], winner: 'black', userColor: 'black' }]));
    expect(loadMyGames(storage)).toEqual([]);
    storage.setItem(MY_GAMES_KEY, '{broken');
    expect(loadMyGames(storage)).toEqual([]);
  });

  it('中継の項目にすると、プレイヤーを「あなた」の棋士にし、一覧の「あなたの対局」に並ぶ', () => {
    const spec = myRelaySpec(gameOf());
    expect(spec.key).toBe(myRelayKey(gameOf()));
    expect(spec.white).toMatchObject({ id: 'user', name: 'やこび', kind: 'user' });
    expect(spec.black).toMatchObject({ id: 'p12', name: '中村大輔' });
    expect(spec).toMatchObject({ label: '第3期 竜王戦 決勝トーナメント 2回戦', winner: 'white', kind: 'game', section: 'mine' });
    expect(spec.kifu).toEqual({ moves: ['7g7f', '3c3d', '2g2f'], times: [12, 1, MY_THINK_CAP_SECONDS], reason: 'mate' });
    // 注目の欄には入れず(重ねない)、「あなたの対局」の欄に入る。
    const sections = relaySections([spec]);
    expect(sections.map(({ id }) => id)).toEqual(['mine']);
    expect(sections[0].label).toBe('あなたの対局');
    expect(myRelaySpec(gameOf({ weight: 'title' })).kind).toBe('finals');
  });
});
