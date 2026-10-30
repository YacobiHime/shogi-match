import { describe, expect, it } from 'vitest';
import {
  AXIS_MODELS, MY_ABILITY_MIN_MOVES, MY_REPERTOIRE_MIN_GAMES, axisLevel, collectAxes, myAbilityProfile, myRepertoire, myStyleAttack, worldRatingFor,
} from './my-abilities.mjs';
import { collectionCatalog } from './collection.mjs';
import { OPENING_CASTLES, OPENING_STRATEGIES } from './opening-guide.mjs';
import { defaultCastleShares } from './opening-usage.mjs';
import { createRng } from './ryuo-random.mjs';
import { pickGameStyle } from './ryuo-repertoire.mjs';
import { abilityBase } from './player-abilities.mjs';
import { GROUP_MEAN_RATING, recommendedDifficulty } from './ryuo-strength.mjs';

/** その能力のLvで、ちょうど表どおりに指した集計(手の数n)。 */
function axisAt(key, level, n) {
  const { kind, a, b } = AXIS_MODELS[key];
  const y = a + b * level;
  return kind === 'loss' ? { n, sum: Math.round((Math.exp(y) - 10) * n) } : { n, hit: Math.round((1 / (1 + Math.exp(-y))) * n) };
}
function gameAt(levels, n = 40) {
  const axes = Object.fromEntries(Object.keys(AXIS_MODELS).map((key) => [key, axisAt(key, levels[key] ?? levels.all, n)]));
  return { summary: { moves: n, sum: 0, big: 0, phases: {}, axes } };
}

describe('自分の能力', () => {
  it('表の値は、Lvに戻せる', () => {
    for (const key of Object.keys(AXIS_MODELS)) {
      const total = axisAt(key, 20, 1000);
      const value = 'sum' in total ? total.sum / total.n : total.hit / total.n;
      expect(axisLevel(key, { n: total.n, value })).toBeCloseTo(20, 0);
    }
    expect(axisLevel('opening', { n: 0, value: 0 })).toBeNull();
  });

  it('測れた手が足りなければ、出さずに残りを返す', () => {
    const profile = myAbilityProfile({ games: [gameAt({ all: 20 }, 10)], playerLevel: 20 });
    expect(profile).toMatchObject({ ready: false, games: 1, moves: 10, need: MY_ABILITY_MIN_MOVES - 10 });
  });

  it('どの能力も同じLvなら、平均のまま(バランス型)。全体の高さは竜王戦の世界の物差し', () => {
    const profile = myAbilityProfile({ games: Array.from({ length: 5 }, () => gameAt({ all: 20 })), playerLevel: 20 });
    expect(profile.ready).toBe(true);
    // 割合の能力(詰みは機会が少ない)は、手の数を整数に丸めた分だけずれる。
    for (const value of Object.values(profile.member.character.abilities)) expect(Math.abs(value)).toBeLessThanOrEqual(3);
    expect(profile.view.type).toBe('バランス型');
    const base = Math.round(abilityBase(profile.member.rating));
    for (const { value } of profile.view.abilities) expect(Math.abs(value - base)).toBeLessThanOrEqual(3);
  });

  it('寄せだけ強い人は寄せが高く、ほかが少し低い。いちばんの武器と伸びしろを返す', () => {
    const games = Array.from({ length: 8 }, () => gameAt({ all: 15, attack: 30, defense: 8 }));
    const profile = myAbilityProfile({ games, playerLevel: 15 });
    const devs = profile.member.character.abilities;
    // 寄せは、優勢での損と詰みを逃さなかった割合を合わせるので、片方だけ高いと少し低めに出る。
    expect(devs.attack).toBeGreaterThanOrEqual(8);
    expect(devs.defense).toBeLessThan(0);
    expect(profile.best).toMatchObject({ key: 'attack', label: '寄せ' });
    expect(profile.worst).toMatchObject({ key: 'defense' });
    expect(profile.worst.hint).toMatch(/玉/);
    expect(profile.view.type).toBe('寄せ型');
    // 序盤・中盤・終盤の帯も出す。
    expect(profile.view.phases.map(({ key }) => key)).toEqual(['opening', 'middle', 'ending']);
  });

  it('詰みを逃さなかっただけでは、寄せを大きくは上げない(割合が1に張りつくため)', () => {
    const games = Array.from({ length: 8 }, () => {
      const game = gameAt({ all: 20 });
      game.summary.axes.mate = { n: 6, hit: 6 };
      return game;
    });
    expect(myAbilityProfile({ games, playerLevel: 20 }).member.character.abilities.attack).toBeLessThanOrEqual(8);
  });

  it('前の要約(axesなし)は、序盤・中盤・終盤と安定感だけを数える', () => {
    const old = { summary: { moves: 40, sum: 4000, big: 4, phases: { opening: { n: 15, sum: 900, big: 0 }, middle: { n: 20, sum: 2000, big: 2 }, ending: { n: 5, sum: 1100, big: 2 } } } };
    const { totals, moves, games } = collectAxes([old, { summary: null }]);
    expect({ moves, games }).toEqual({ moves: 40, games: 1 });
    expect(totals.opening).toEqual({ n: 15, sum: 900 });
    expect(totals.stability).toEqual({ n: 40, hit: 4 });
    expect(totals.attack.n).toBe(0);
    const profile = myAbilityProfile({ games: [old], playerLevel: 15 });
    expect(profile.missing).toEqual(['視野', '発想', '読み', '寄せ', '受け']);
  });

  it('おすすめの難易度なら、6組の平均の棋士に7割勝てる強さ。難しい難易度ほど、世界の中では低い', () => {
    const recommended = recommendedDifficulty(20);
    expect(worldRatingFor(20, recommended)).toBe(worldRatingFor(20, null));
    expect(worldRatingFor(20, recommended) - GROUP_MEAN_RATING[6]).toBeGreaterThan(140);
    expect(worldRatingFor(20, recommended + 2)).toBe(worldRatingFor(20, recommended) - 120);
  });
});

describe('分身の得意戦法と棋風(docs/tournament-relay-design.mdの28章)', () => {
  const catalog = collectionCatalog({ strategies: OPENING_STRATEGIES, castles: OPENING_CASTLES });
  const labelOf = (kind, id) => catalog.find((entry) => entry.kind === kind && entry.id === id).label;

  it('組んだ戦法が少ないうちは持たない(序盤はエンジンに任せる)', () => {
    expect(myRepertoire({ formations: {}, catalog })).toBeNull();
    expect(myRepertoire({ formations: { [labelOf('strategy', 'shiken')]: { count: MY_REPERTOIRE_MIN_GAMES - 1 } }, catalog })).toBeNull();
  });

  it('組んだ回数から、名鑑の棋士と同じ形の使用率を作る。囲いは組んだ回数の割合', () => {
    const repertoire = myRepertoire({
      formations: {
        [labelOf('strategy', 'shiken')]: { count: 6 },
        [labelOf('strategy', 'fujii-system')]: { count: 2 },
        [labelOf('strategy', 'gokigen')]: { count: 2 },
        [labelOf('castle', 'furibisha-anaguma')]: { count: 5 },
        [labelOf('castle', 'mino')]: { count: 1 },
      },
      catalog,
    });
    expect(repertoire.party).toBe('ranging');
    expect(repertoire.games).toBe(10);
    expect(repertoire.usage.black).toEqual({ shiken: 60, 'fujii-system': 20, gokigen: 20 });
    expect(repertoire.usage.castles.shiken['furibisha-anaguma']).toBeGreaterThan(repertoire.usage.castles.shiken.mino);
    expect(repertoire.usage.castles.gokigen).toEqual({ 'furibisha-anaguma': 83, mino: 17 });
    // 組んだ囲いのない戦法(囲いと一体の藤井システム)は、目録の重み。
    expect(repertoire.usage.castles['fujii-system']).toEqual(defaultCastleShares('fujii-system'));
    expect(repertoire.styles[0]).toBe('shiken-anaguma');
    // 1局ずつ、その使用率で戦法を選べる(名鑑の棋士と同じ)。
    const picked = pickGameStyle(createRng(3), repertoire, { color: 'black', opponentRook: 'static' });
    expect(['shiken', 'fujii-system', 'gokigen']).toContain(picked.opening);
  });

  it('目録にない戦法は近い戦法に数え、居飛車なら対抗形の囲いも持つ。奇襲は数えない', () => {
    const repertoire = myRepertoire({
      formations: {
        [labelOf('strategy', 'yokofudori')]: { count: 2 },
        [labelOf('strategy', 'yagura-strategy')]: { count: 2 },
        [labelOf('strategy', 'onigoroshi')]: { count: 9 },
        [labelOf('castle', 'ibisha-anaguma')]: { count: 3 },
      },
      catalog,
    });
    expect(repertoire.usage.black).toEqual({ aigakari: 50, yagura: 50 });
    expect(repertoire.party).toBe('static');
    expect(repertoire.usage.castles.ibisha).toEqual({ 'ibisha-anaguma': 100 });
  });

  it('棋風は能力の攻めと受けの差に、よく指す戦法の攻めっ気を少し足す', () => {
    const attacking = myRepertoire({ formations: { [labelOf('strategy', 'hayaguri-gin')]: { count: 4 } }, catalog });
    const solid = myRepertoire({ formations: { [labelOf('strategy', 'yagura-strategy')]: { count: 4 } }, catalog });
    expect(myStyleAttack(null, attacking)).toBeCloseTo(0.4, 5);
    expect(myStyleAttack(null, solid)).toBeCloseTo(-0.4, 5);
    expect(myStyleAttack({ attack: 20, defense: -20 }, null)).toBe(1);
    expect(myStyleAttack(null, null)).toBe(0);
  });

  it('能力が出たら、分身の棋士の形(member)に得意戦法と棋風を持たせ、使用率も見せる', () => {
    const repertoire = myRepertoire({ formations: { [labelOf('strategy', 'aigakari')]: { count: 5 } }, catalog });
    const profile = myAbilityProfile({ games: [gameAt({ all: 20 })], playerLevel: 20, repertoire });
    expect(profile.ready).toBe(true);
    expect(profile.member.repertoire).toBe(repertoire);
    expect(typeof profile.member.character.attack).toBe('number');
    expect(profile.view.openings[0]).toMatchObject({ id: 'aigakari', share: 100 });
    expect(profile.view.staticShare).toBe(100);
  });
});
