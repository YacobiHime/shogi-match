import { ladderLevelFromOld } from './level-ladder.mjs';
import { describe, expect, it } from 'vitest';
import {
  SCALES,
  USER_ID,
  advanceBracket,
  buildMainBracket,
  buildSeededBracket,
  createRng,
  createSeason,
  describeSeason,
  groupMeanLevel,
  recommendedDifficulty,
  recordUserGame,
  scaleById,
  winProbability,
} from './ryuo.mjs';
import {
  ETERNAL_STREAK,
  applySeason,
  createCareer,
  loadCareer,
  loadSeason,
  nextEntry,
  saveCareer,
  saveSeason,
} from './ryuo-career.mjs';
import { CPU_STRENGTH_PRESETS } from './strength-settings.mjs';
import { createRoster } from './ryuo-roster.mjs';
import { OPPONENT_STYLES } from './ryuo-data.mjs';
import { CPU_OPENING_STRATEGY_IDS } from './cpu-opening-repertoire.mjs';
import { OPENING_CASTLES, OPENING_STRATEGIES, openingDefinitionRookStyle } from './opening-guide.mjs';

const settings = (overrides = {}) => ({ difficulty: 9, scale: 3, revival: true, ...overrides });

/** 方針に従ってプレイヤーが対局を指し続け、シーズンの最後まで進める。 */
function playOut(season, policy, limit = 400) {
  let current = season;
  let games = 0;
  while (current.phase !== 'done' && games < limit) {
    expect(current.pending).not.toBeNull();
    current = recordUserGame(current, policy(current, games));
    games += 1;
  }
  expect(current.phase).toBe('done');
  return { season: current, games };
}

const always = (outcome) => () => outcome;

describe('scales and difficulty', () => {
  it('keeps every scale consistent: slots fit inside the group and promotion fits inside the field', () => {
    for (const scale of SCALES) {
      for (const group of [1, 2, 3, 4, 5, 6]) {
        expect(scale.sizes[group]).toBeGreaterThanOrEqual(4);
        expect(scale.slots[group]).toBeGreaterThanOrEqual(1);
        expect(scale.slots[group]).toBeLessThanOrEqual(scale.sizes[group]);
      }
      expect(scale.promote).toBeLessThan(scale.sizes[2]);
    }
    expect(scaleById(5).slots).toEqual({ 1: 5, 2: 2, 3: 1, 4: 1, 5: 1, 6: 1 });
    expect(scaleById(5).sizes).toEqual({ 1: 16, 2: 16, 3: 16, 4: 32, 5: 32, 6: 64 });
  });

  it('shrinks the field and the slots as the scale gets smaller', () => {
    for (let id = 2; id <= 5; id += 1) {
      const small = scaleById(id - 1);
      const large = scaleById(id);
      for (const group of [1, 2, 3, 4, 5, 6]) {
        expect(small.sizes[group]).toBeLessThanOrEqual(large.sizes[group]);
        expect(small.slots[group]).toBeLessThanOrEqual(large.slots[group]);
      }
      expect(small.promote).toBeLessThanOrEqual(large.promote);
    }
  });

  it('shifts manual opponents by difficulty and recommends a level below the player', () => {
    // 難易度の強さは、段級位の作り直し(2026-10-22)の前と同じ。Lvは同じ強さの新しい表のLvで出す(前のLv30は1級のあたり)。
    expect(groupMeanLevel(6, 9)).toBeCloseTo(ladderLevelFromOld(30));
    expect(groupMeanLevel(6, 7)).toBeCloseTo(ladderLevelFromOld(22));
    // 前の表の16級より弱かった難易度(1〜4)の6組は、15級(Lv1。大会の棋士のいちばん下)にそろう。
    for (const difficulty of [1, 2, 3]) expect(groupMeanLevel(6, difficulty)).toBe(1);
    expect(groupMeanLevel(1, 14)).toBe(40);
    for (let difficulty = 2; difficulty <= 14; difficulty += 1) {
      expect(groupMeanLevel(1, difficulty)).toBeGreaterThanOrEqual(groupMeanLevel(1, difficulty - 1));
    }
    expect(recommendedDifficulty(Math.round(ladderLevelFromOld(30)))).toBe(7);
    expect(recommendedDifficulty(40)).toBe(11);
    expect(groupMeanLevel(6, recommendedDifficulty(25), 25)).toBe(23);
  });

  it('gives a stronger player a higher win rate, by rating', () => {
    expect(winProbability(1500, 1500)).toBeCloseTo(0.5);
    expect(winProbability(1700, 1500)).toBeCloseTo(0.76, 2);
    expect(winProbability(1500, 1700)).toBeCloseTo(0.24, 2);
  });
});

describe('opponent field', () => {
  /** 名簿から作った期の、組の出場者(プレイヤーを除く)。 */
  const field = (season, group) => season.fields[group].filter((id) => id !== USER_ID).map((id) => season.players[id]);
  const realSeason = (overrides = {}) => createSeason({ no: 1, mode: 'challenge', group: 6, settings: settings({ scale: 5, ...overrides }), userLevel: 28, seed: 7 });

  it('builds distinct players with spread ratings, mixed dan and varied styles', () => {
    const season = realSeason();
    const sixth = field(season, 6);
    expect(sixth).toHaveLength(63);
    const all = Object.values(season.players).filter(({ id }) => id !== USER_ID);
    expect(new Set(all.map(({ name }) => name)).size).toBe(all.length);
    expect(sixth.every(({ level }) => level >= 0 && level <= 40)).toBe(true);
    expect(sixth.every(({ rating }) => Number.isInteger(rating))).toBe(true);
    const ratings = sixth.map(({ rating }) => rating);
    expect(Math.max(...ratings) - Math.min(...ratings)).toBeGreaterThanOrEqual(300);
    const levels = sixth.map(({ level }) => level);
    expect(Math.max(...levels)).toBeGreaterThan(Math.min(...levels));
    expect(new Set(sixth.map(({ style }) => style.id)).size).toBeGreaterThanOrEqual(8);
    expect(new Set(sixth.map(({ dan }) => dan)).size).toBeGreaterThanOrEqual(3);
    // 6組には、アマチュア・女流・奨励会員が混じる。
    expect(sixth.some(({ kind }) => kind === 'amateur')).toBe(true);
    expect(sixth.some(({ kind }) => kind === 'woman')).toBe(true);
    expect(sixth.some(({ kind }) => kind === 'shoreikai')).toBe(true);
  });

  it('puts higher groups on stronger ratings and higher dan', () => {
    const season = realSeason();
    const mean = (group) => field(season, group).reduce((sum, { rating }) => sum + rating, 0) / field(season, group).length;
    const means = [1, 2, 3, 4, 5, 6].map(mean);
    for (let index = 1; index < means.length; index += 1) expect(means[index - 1]).toBeGreaterThan(means[index]);
    const dans = field(season, 1).map(({ dan }) => dan);
    expect(dans.every((dan) => ['七段', '八段', '九段'].includes(dan))).toBe(true);
    // 竜王は出場者に入らない。
    expect(Object.values(season.fields).flat()).not.toContain(season.champion);
    expect(season.players[season.champion].dan).toBe('竜王');
  });

  it('keeps the ratings when the difficulty changes, and only converts the level', () => {
    const easy = realSeason({ difficulty: 5 });
    const hard = realSeason({ difficulty: 12 });
    const ids = easy.fields[3];
    expect(hard.fields[3]).toEqual(ids);
    expect(ids.map((id) => hard.players[id].rating)).toEqual(ids.map((id) => easy.players[id].rating));
    ids.forEach((id) => expect(hard.players[id].level).toBeGreaterThanOrEqual(easy.players[id].level));
  });

  it('takes the players from a given roster', () => {
    const roster = createRoster({ seed: 3 });
    const season = createSeason({ no: 1, mode: 'challenge', group: 6, settings: settings(), userLevel: 28, seed: 9, roster });
    expect(season.champion).toBe(roster.holder);
    for (const id of Object.values(season.fields).flat().filter((pid) => pid !== USER_ID)) {
      expect(season.players[id].name).toBe(roster.players[id].name);
      expect(season.players[id].group).toBe(roster.players[id].group);
    }
  });

  it('uses only styles the CPU can play, with a rook style that matches the castle', () => {
    const strategyIds = new Set(OPENING_STRATEGIES.map(({ id }) => id));
    const castleIds = new Set(OPENING_CASTLES.map(({ id }) => id));
    for (const style of OPPONENT_STYLES) {
      expect(strategyIds.has(style.strategy), style.id).toBe(true);
      // 囲いと一体の戦法(腰掛け銀・藤井システム)は、囲いを指定しない。
      if (style.castle === '') {
        expect(OPENING_STRATEGIES.find(({ id }) => id === style.strategy).integrated, style.id).toBe(true);
        continue;
      }
      expect(castleIds.has(style.castle), style.id).toBe(true);
      expect(CPU_OPENING_STRATEGY_IDS.includes(style.strategy), style.id).toBe(true);
      const strategyStyle = openingDefinitionRookStyle(style.strategy, 'strategy');
      const castleStyle = openingDefinitionRookStyle(style.castle, 'castle') ?? 'both';
      expect(castleStyle === 'both' || castleStyle === strategyStyle, style.id).toBe(true);
    }
    // 飛車の振り方の表示(rook)は、戦法の分類と一致する。
    for (const style of OPPONENT_STYLES) {
      expect(style.rook, style.id).toBe(openingDefinitionRookStyle(style.strategy, 'strategy'));
    }
    // 居飛車と振り飛車の両方がある。
    const rookStyles = new Set(OPPONENT_STYLES.map(({ strategy }) => openingDefinitionRookStyle(strategy, 'strategy')));
    expect(rookStyles).toEqual(new Set(['static', 'ranging']));
  });

  it('maps every opponent level to a CPU preset', () => {
    const levels = new Set(CPU_STRENGTH_PRESETS.map(({ level }) => level));
    const season = realSeason({ difficulty: 14 });
    expect(Object.values(season.players).filter(({ id }) => id !== USER_ID).every(({ level }) => levels.has(level))).toBe(true);
  });
});

describe('brackets', () => {
  const ids = (count) => Array.from({ length: count }, (_, index) => `p${index + 1}`);

  it('builds a single-elimination tree with one match fewer than players, including odd sizes', () => {
    for (const count of [2, 3, 4, 8, 12, 16, 24, 32, 48, 64]) {
      const bracket = buildSeededBracket('test', ids(count), 't');
      expect(Object.keys(bracket.nodes)).toHaveLength(count - 1);
      expect(bracket.rounds).toBe(Math.ceil(Math.log2(count)));
    }
  });

  it('gives the top seeds byes when the field is not a power of two, and keeps the top two seeds apart until the final', () => {
    const bracket = buildSeededBracket('test', ids(12), 't');
    const firstRound = Object.values(bracket.nodes).filter((node) => node.round === 1);
    const firstRoundPlayers = new Set(firstRound.flatMap((node) => [node.a.pid, node.b.pid]));
    expect(firstRoundPlayers.has('p1')).toBe(false);
    expect(firstRoundPlayers.has('p2')).toBe(false);
    const sixteen = buildSeededBracket('test', ids(16), 't');
    const root = sixteen.nodes[sixteen.root.from];
    const side = (from, pid) => {
      const walk = (s) => (s.pid ? [s.pid] : [...walk(sixteen.nodes[s.from].a), ...walk(sixteen.nodes[s.from].b)]);
      return walk(from).includes(pid);
    };
    expect(side(root.a, 'p1') !== side(root.a, 'p2')).toBe(true);
  });

  it('matches the number of wins each qualifier needs in the real Ryuo main tournament', () => {
    const slots = [
      ['1-1', 0.25], ['1-2', 0.125], ['1-3', 0.125], ['1-4', 0.125], ['1-5', 0.0625],
      ['2-1', 0.125], ['2-2', 0.0625], ['3-1', 0.0625], ['4-1', 0.03125], ['5-1', 0.015625], ['6-1', 0.015625],
    ];
    const bracket = buildMainBracket(slots.map(([pid, weight]) => ({ pid, weight })));
    expect(Object.keys(bracket.nodes)).toHaveLength(10);
    const depth = new Map();
    const walk = (side, level) => {
      if (side.pid) { depth.set(side.pid, level); return; }
      walk(bracket.nodes[side.from].a, level + 1);
      walk(bracket.nodes[side.from].b, level + 1);
    };
    walk(bracket.root, 0);
    // 挑戦者決定戦(根)の前に必要な勝数は、深さ-1。
    const wins = Object.fromEntries([...depth].map(([pid, level]) => [pid, level - 1]));
    expect(wins).toEqual({
      '1-1': 1, '1-2': 2, '1-3': 2, '1-4': 2, '1-5': 3, '2-1': 2, '2-2': 3, '3-1': 3, '4-1': 4, '5-1': 5, '6-1': 5,
    });
  });

  it('advances automatically, stops at the player match, and is repeatable from the same seed', () => {
    const players = Object.fromEntries(ids(8).map((id, index) => [id, { id, rating: 1400 + index * 30 }]));
    players[USER_ID] = { id: USER_ID, rating: 1500 };
    const make = () => buildSeededBracket('test', [...ids(8), USER_ID].slice(0, 8).map((id, index) => (index === 3 ? USER_ID : id)), 't');
    const first = make();
    const stop = advanceBracket(first, players, createRng(5));
    expect(stop.state).toBe('user');
    const second = make();
    advanceBracket(second, players, createRng(5));
    expect(second.nodes).toEqual(first.nodes);
    // プレイヤーが居なければ、最後まで進む。
    const lone = buildSeededBracket('test', ids(8), 't');
    expect(advanceBracket(lone, players, createRng(1)).state).toBe('finished');
    expect(lone.nodes[lone.root.from].winner).toMatch(/^p/);
  });
});

describe('a Ryuo season', () => {
  it('starts in group 6 with a pending first game, an opponent and a bracket', () => {
    const season = createSeason({ no: 1, mode: 'challenge', group: 6, settings: settings(), userLevel: 28, seed: 11 });
    expect(season.phase).toBe('ranking');
    expect(season.pending).toMatchObject({ kind: 'game', phase: 'ranking' });
    const view = describeSeason(season);
    expect(view.phaseText).toBe('6組ランキング戦');
    expect(view.pending.opponent.name).toBeTruthy();
    expect(view.pending.opponent.style.strategy).toBeTruthy();
    expect(view.tables[0].rounds.map(({ label }) => label)).toEqual(['1回戦', '2回戦', '準々決勝', '準決勝', '決勝']);
    expect(season.fields[6]).toHaveLength(32);
    expect(season.fields[6]).toContain(USER_ID);
  });

  it('does not always pit a weak player against the strongest opponent in the first round', () => {
    const levels = new Set();
    for (let seed = 1; seed <= 12; seed += 1) {
      const season = createSeason({ no: 1, mode: 'challenge', group: 6, settings: settings({ difficulty: 9 }), userLevel: 5, seed });
      levels.add(season.players[season.pending.opponentId].rating);
      const strongest = Math.max(...Object.values(season.players).filter(({ group, id }) => group === 6 && id !== USER_ID).map(({ rating }) => rating));
      expect(season.players[season.pending.opponentId].rating).toBeLessThan(strongest);
    }
    // 毎回同じ(最強の)相手にはならない。
    expect(levels.size).toBeGreaterThan(3);
  });

  it('is cut short by a first-game loss when the revival round is off', () => {
    const season = createSeason({ no: 1, mode: 'challenge', group: 6, settings: settings({ revival: false }), userLevel: 28, seed: 3 });
    const { season: done, games } = playOut(season, always('loss'));
    expect(games).toBe(1);
    expect(done.result).toMatchObject({ outcome: 'ranking-out', startGroup: 6, wins: 0, losses: 1 });
    expect(done.result.newGroup).toBe(6);
  });

  it('gives a second chance in the revival round when it is on, and promotes the winners', () => {
    const season = createSeason({ no: 1, mode: 'challenge', group: 6, settings: settings({ scale: 5 }), userLevel: 28, seed: 3 });
    const lost = recordUserGame(season, 'loss');
    expect(lost.phase).toBe('revival');
    expect(lost.pending).toMatchObject({ kind: 'game', phase: 'revival' });
    expect(describeSeason(lost).phaseText).toBe('6組敗者復活戦');
    const { season: done } = playOut(lost, always('win'));
    expect(done.result.outcome).toBe('ranking-out');
    expect(done.result.promoted).toBe(true);
    expect(done.result.newGroup).toBe(5);
  });

  it('lets the revival round save a player from relegation even on a small scale', () => {
    const make = (seed, revival) => createSeason({
      no: 1, mode: 'challenge', group: 5, settings: settings({ scale: 1, revival }), userLevel: 20, seed,
    });
    let relegatedWithoutRevival = 0;
    for (let seed = 1; seed <= 40; seed += 1) {
      const off = playOut(make(seed, false), always('loss')).season;
      if (off.result.relegated) relegatedWithoutRevival += 1;
      // 敗者復活戦が有効なら、負けたあとにもう1局あり、勝てば降級を免れる。
      const lost = recordUserGame(make(seed, true), 'loss');
      expect(lost.phase, `seed ${seed}`).toBe('revival');
      const saved = playOut(lost, always('win')).season;
      expect(saved.result.relegated, `seed ${seed}`).toBe(false);
      expect(saved.result.newGroup).toBe(5);
    }
    // 敗者復活戦が無いと、初戦で負けた人のうち、順位が最下位の人は降級する。
    expect(relegatedWithoutRevival).toBeGreaterThan(0);
    // 6組には降級が無いので、昇級の枠が無い小さな規模では、敗者復活戦は行わない。
    const sixth = createSeason({ no: 1, mode: 'challenge', group: 6, settings: settings({ scale: 3 }), userLevel: 28, seed: 6 });
    expect(recordUserGame(sixth, 'loss').phase).toBe('done');
  }, 20000);

  it('relegates a player who loses everything, except from group 6', () => {
    const fifth = createSeason({ no: 1, mode: 'challenge', group: 5, settings: settings(), userLevel: 28, seed: 4 });
    const { season: done } = playOut(fifth, always('loss'));
    expect(done.result.relegated).toBe(true);
    expect(done.result.newGroup).toBe(6);
    const sixth = createSeason({ no: 1, mode: 'challenge', group: 6, settings: settings(), userLevel: 28, seed: 4 });
    expect(playOut(sixth, always('loss')).season.result.newGroup).toBe(6);
  });

  it('lets a group 6 player win everything and become the Ryuo, on every scale', () => {
    for (const scale of [1, 2, 3, 4, 5]) {
      const season = createSeason({ no: 1, mode: 'challenge', group: 6, settings: settings({ scale }), userLevel: 28, seed: 20 + scale });
      const { season: done, games } = playOut(season, always('win'));
      expect(done.result, `scale ${scale}`).toMatchObject({ outcome: 'champion', wonTitle: true, challenger: true, newGroup: 1, losses: 0 });
      expect(done.champion).toBe(USER_ID);
      expect(done.finals.wins[USER_ID]).toBe(4);
      expect(done.playoff.wins[USER_ID]).toBe(2);
      // 番勝負の数は規模で変わらない: 三番勝負で2局、七番勝負で4局。
      expect(done.userGames.filter(({ phase }) => phase === 'playoff')).toHaveLength(2);
      expect(done.userGames.filter(({ phase }) => phase === 'finals')).toHaveLength(4);
      // 規模が大きいほど、勝ち上がる局数が多い。
      expect(games).toBeGreaterThanOrEqual(6 + 1);
    }
  });

  it('needs more games to win a larger tournament', () => {
    const gamesFor = (scale) => playOut(
      createSeason({ no: 1, mode: 'challenge', group: 6, settings: settings({ scale }), userLevel: 28, seed: 50 }),
      always('win'),
    ).games;
    const counts = [1, 2, 3, 4, 5].map(gamesFor);
    for (let index = 1; index < counts.length; index += 1) expect(counts[index]).toBeGreaterThanOrEqual(counts[index - 1]);
    expect(counts[4]).toBeGreaterThan(counts[0] + 3);
  });

  it('alternates colors inside a best-of series', () => {
    const season = createSeason({ no: 1, mode: 'challenge', group: 6, settings: settings({ scale: 1 }), userLevel: 28, seed: 8 });
    const { season: done } = playOut(season, (current) => (current.phase === 'finals' ? (current.finals.games.length % 2 === 0 ? 'loss' : 'win') : 'win'));
    const finals = done.userGames.filter(({ phase }) => phase === 'finals');
    for (let index = 1; index < finals.length; index += 1) expect(finals[index].color).not.toBe(finals[index - 1].color);
    expect(done.result.outcome === 'champion' || done.result.outcome === 'finals-lost').toBe(true);
  });

  it('ends a lost Ryuo match with a return to group 1', () => {
    const season = createSeason({ no: 1, mode: 'challenge', group: 6, settings: settings({ scale: 2 }), userLevel: 28, seed: 31 });
    const { season: done } = playOut(season, (current) => (current.phase === 'finals' ? 'loss' : 'win'));
    expect(done.result).toMatchObject({ outcome: 'finals-lost', challenger: true, newGroup: 1, wonTitle: false });
    expect(done.champion).toBe(season.champion);
    expect(done.champion).not.toBe(USER_ID);
  });

  it('plays a defense match as the champion against a simulated challenger', () => {
    const season = createSeason({ no: 2, mode: 'defense', group: 1, settings: settings(), userLevel: 30, seed: 5, career: { titles: 1 } });
    expect(season.phase).toBe('finals');
    expect(season.finals.a).toBe(USER_ID);
    expect(season.pending).toMatchObject({ kind: 'finals', gameNo: 1 });
    expect(describeSeason(season).pending.label).toBe('竜王戦七番勝負 第1局');
    const won = playOut(season, always('win')).season;
    expect(won.result.outcome).toBe('champion');
    const lost = playOut(season, always('loss')).season;
    expect(lost.result).toMatchObject({ outcome: 'defense-lost', newGroup: 1 });
    expect(lost.champion).not.toBe(USER_ID);
  });

  it('survives a JSON round trip in the middle of a season and gives the same result', () => {
    const season = createSeason({ no: 1, mode: 'challenge', group: 6, settings: settings({ scale: 2 }), userLevel: 28, seed: 77 });
    const policy = (current, index) => (index % 3 === 2 ? 'loss' : 'win');
    const direct = playOut(season, policy).season;
    let current = season;
    let games = 0;
    while (current.phase !== 'done') {
      current = JSON.parse(JSON.stringify(recordUserGame(JSON.parse(JSON.stringify(current)), policy(current, games))));
      games += 1;
    }
    expect(current.result).toEqual(direct.result);
    expect(current.userGames).toEqual(direct.userGames);
  });

  it('always terminates with a valid result, for any mix of wins and losses', () => {
    for (let seed = 1; seed <= 24; seed += 1) {
      const scale = (seed % 5) + 1;
      const group = (seed % 6) + 1;
      const rng = createRng(seed * 101);
      const season = createSeason({
        no: 1, mode: 'challenge', group, settings: settings({ scale, revival: seed % 2 === 0, difficulty: (seed % 14) + 1 }), userLevel: 20 + (seed % 15), seed,
      });
      const { season: done, games } = playOut(season, () => (rng.next() < 0.6 ? 'win' : 'loss'));
      expect(games).toBeLessThan(120);
      expect(done.result.newGroup).toBeGreaterThanOrEqual(1);
      expect(done.result.newGroup).toBeLessThanOrEqual(6);
      expect(done.result.wins + done.result.losses).toBe(games);
      expect(done.champion).toBeTruthy();
      expect(done.pending).toBeNull();
    }
  });
});

describe('season details for the screen', () => {
  /** 試合の札の表(core/ryuo-stages.mjs)に出る棋士(名前のある行)。 */
  const playersOf = (view) => view.matches.flatMap(({ top, bottom }) => [top, bottom]).filter(({ pid }) => pid);

  it('describes each bracket as match cards: one match fewer than players, every player once in their first match, the next match marked', () => {
    const season = createSeason({ no: 1, mode: 'challenge', group: 6, settings: settings({ scale: 2 }), userLevel: 28, seed: 9 });
    const { view } = describeSeason(season).stages.group.find(({ key }) => key === 'ranking');
    expect(view.matches).toHaveLength(view.leafCount - 1);
    // まだ誰も勝っていないので、名前のある行は、各棋士の最初の試合の1回ずつ。
    const pids = playersOf(view).map(({ pid }) => pid);
    expect(new Set(pids).size).toBe(view.leafCount);
    const you = playersOf(view).find(({ pid }) => pid === USER_ID);
    expect(you.name).toBe('あなた');
    expect(you.you).toBe(true);
    expect(view.matches.find(({ pending }) => pending).id).toBe(season.pending.nodeId);
    expect(view.rounds).toHaveLength(Math.ceil(Math.log2(view.leafCount)));
  });

  it('labels the qualifiers of the main tournament by group and rank and shows the defending champion', () => {
    let season = createSeason({ no: 1, mode: 'challenge', group: 6, settings: settings({ scale: 4 }), userLevel: 28, seed: 14 });
    while (season.phase === 'ranking' || season.phase === 'revival') season = recordUserGame(season, 'win');
    const view = describeSeason(season);
    const labels = playersOf(view.stages.final).map(({ label }) => label);
    expect(labels).toContain('1組優勝');
    expect(labels).toContain('1組4位');
    expect(labels).toContain('2組2位');
    expect(labels).toContain('6組優勝');
    expect(playersOf(view.stages.final).find(({ pid }) => pid === USER_ID).label).toBe('6組優勝');
    expect(view.defender.id).toBe(season.champion);
  });

  it('keeps analysis records and queued games through the season and shows them in the statistics', () => {
    let season = createSeason({ no: 1, mode: 'challenge', group: 6, settings: settings({ scale: 1 }), userLevel: 28, seed: 4 });
    season.analysisQueue = [{ index: 0, moves: ['7g7f'] }];
    season.analysis = { 0: { failed: true, win: true, opponentRook: 'static', plies: 0 } };
    season = recordUserGame(season, 'win');
    expect(season.analysisQueue).toHaveLength(1);
    expect(season.analysis[0].failed).toBe(true);
    const view = describeSeason(season);
    expect(view.stats.pending).toBe(1);
    expect(view.stats.summary.games).toBe(1);
    expect(view.stats.radar).toHaveLength(9);
  });

  it('records where the player was knocked out and the path through the stages', () => {
    const season = createSeason({ no: 1, mode: 'challenge', group: 6, settings: settings({ scale: 1, revival: false }), userLevel: 28, seed: 3 });
    // 8名の表の初戦は、準々決勝。
    expect(season.pending.label).toBe('6組ランキング戦 準々決勝');
    const done = recordUserGame(season, 'loss');
    expect(done.userGames[0].label).toBe('6組ランキング戦 準々決勝');
    expect(done.result.exitLabel).toBe('6組ランキング戦 準々決勝');
    expect(done.result.path).toEqual([{ stage: 'ranking', label: '6組ランキング戦', text: '準々決勝で敗退' }]);
    const champion = playOut(createSeason({ no: 1, mode: 'challenge', group: 6, settings: settings({ scale: 1 }), userLevel: 28, seed: 3 }), always('win')).season;
    expect(champion.result.exitLabel).toBe('');
    expect(champion.result.path.map(({ stage }) => stage)).toEqual(['ranking', 'main', 'playoff', 'finals']);
    expect(champion.result.path.at(-1).text).toBe('4勝0敗で、竜王に');
    expect(champion.result.path[0].text).toBe('優勝');
  });
});

describe('career', () => {
  const finish = (career, no, result) => applySeason(career, { no, mode: 'challenge', result });
  const result = (overrides) => ({
    outcome: 'ranking-out', startGroup: 6, newGroup: 6, promoted: false, relegated: false, challenger: false, wonTitle: false, wins: 1, losses: 1, ...overrides,
  });

  it('starts in group 6 and enters as a challenger', () => {
    const career = createCareer();
    expect(career).toMatchObject({ group: 6, seasons: 0, champion: false, titles: 0 });
    expect(nextEntry(career)).toEqual({ no: 1, mode: 'challenge', group: 6 });
  });

  it('moves between groups and keeps the best group', () => {
    let { career } = finish(createCareer(), 1, result({ newGroup: 5, promoted: true, startGroup: 6 }));
    expect(career).toMatchObject({ group: 5, bestGroup: 5, seasons: 1 });
    ({ career } = finish(career, 2, result({ startGroup: 5, newGroup: 6, relegated: true })));
    expect(career).toMatchObject({ group: 6, bestGroup: 5, seasons: 2 });
    expect(career.history).toHaveLength(2);
  });

  it('records a Ryuo title and switches to defense matches', () => {
    const won = result({ outcome: 'champion', challenger: true, wonTitle: true, newGroup: 1 });
    const { career, titles } = finish(createCareer(), 1, won);
    expect(career).toMatchObject({ champion: true, titles: 1, streak: 1, group: 1, challenges: 1 });
    expect(titles.map(({ id }) => id)).toEqual(['ryuo-challenger', 'ryuo']);
    expect(nextEntry(career)).toEqual({ no: 2, mode: 'defense', group: 1 });
  });

  it('grants Eternal Ryuo after five straight titles', () => {
    let career = createCareer();
    let lastTitles = [];
    for (let no = 1; no <= ETERNAL_STREAK; no += 1) {
      ({ career, titles: lastTitles } = finish(career, no, result({ outcome: 'champion', challenger: no === 1, wonTitle: true, newGroup: 1 })));
    }
    expect(career).toMatchObject({ eternal: true, streak: 5, titles: 5 });
    expect(lastTitles.map(({ id }) => id)).toContain('ryuo-eternal');
  });

  it('grants Eternal Ryuo after seven titles in total even with a gap', () => {
    let career = createCareer();
    let eternal = false;
    for (let no = 1; no <= 8; no += 1) {
      const win = no !== 3;
      const { career: next, titles } = finish(career, no, result({ outcome: win ? 'champion' : 'defense-lost', wonTitle: win, newGroup: 1, challenger: false }));
      career = next;
      if (titles.some(({ id }) => id === 'ryuo-eternal')) eternal = true;
      if (no < 8) expect(career.eternal).toBe(false);
    }
    expect(eternal).toBe(true);
    expect(career.titles).toBe(7);
    expect(career.streak).toBe(5);
  });

  it('loses the title and the streak on a failed defense', () => {
    let { career } = finish(createCareer(), 1, result({ outcome: 'champion', wonTitle: true, challenger: true, newGroup: 1 }));
    ({ career } = finish(career, 2, result({ outcome: 'defense-lost', wonTitle: false, newGroup: 1, startGroup: 1 })));
    expect(career).toMatchObject({ champion: false, streak: 0, titles: 1, group: 1 });
    expect(nextEntry(career).mode).toBe('challenge');
  });

  it('round-trips through storage and ignores broken data', () => {
    const data = new Map();
    const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: (k) => data.delete(k) };
    const { career } = finish(createCareer(), 1, result({ newGroup: 5, promoted: true }));
    expect(saveCareer(storage, career)).toBe(true);
    expect(loadCareer(storage)).toEqual(career);
    const season = createSeason({ no: 1, mode: 'challenge', group: 6, settings: settings({ scale: 1 }), userLevel: 20, seed: 2 });
    expect(saveSeason(storage, season)).toBe(true);
    expect(loadSeason(storage)).toEqual(JSON.parse(JSON.stringify(season)));
    // 難易度が1〜12だった版4の期は、同じ強さになるよう難易度を2つずらして読み込む。
    storage.setItem('yacobihime:shogi-match:ryuo-season', JSON.stringify({ ...season, version: 4, settings: { ...season.settings, difficulty: 3 } }));
    expect(loadSeason(storage)).toMatchObject({ version: 5, settings: { difficulty: 5 } });
    // 棋士が名簿の棋士でない版3以前の期は、続きを指せないので読み込まない(新しく作り直す)。
    for (const version of [1, 2, 3]) {
      storage.setItem('yacobihime:shogi-match:ryuo-season', JSON.stringify({ ...season, version }));
      expect(loadSeason(storage)).toBeNull();
    }
    saveSeason(storage, null);
    expect(loadSeason(storage)).toBeNull();
    storage.setItem('yacobihime:shogi-match:ryuo-career', '{broken');
    expect(loadCareer(storage)).toEqual(createCareer());
    expect(loadCareer(null)).toEqual(createCareer());
  });
});
