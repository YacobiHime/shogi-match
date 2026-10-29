import { describe, expect, it } from 'vitest';
import { resignStyleById } from './resign-style.mjs';
import { appendUsiMove, createGameRecord, enumerateLegalMoves } from '../game-state';
import {
  DECISIVE_CP, RELAY_MAX_PLIES, rateVerdict, relayQuality, THEORY_PLY, clockText, createRelayClock, pickLoss, playRelayGame, relayPlan, relaySeed, relayStoryValues,
  relayTarget, relayTimeControl, relayTimeline, remainingText, shouldResign, thinkTimeText,
} from './relay-game.mjs';

const player = (id, extra = {}) => ({ id, name: id, dan: '七段', rating: 1600, character: { attack: 0, traits: [], abilities: {} }, ...extra });

function specOf(extra = {}) {
  return {
    key: 'test:1', event: 'ryuo', kind: 'game', label: '6組 1回戦', weight: 'plain',
    black: player('a'), white: player('b'), winner: 'black',
    openings: { black: null, white: null }, castles: { black: null, white: null },
    story: [100, 200, 300], how: 'middle', seed: relaySeed('test:1'),
    ...extra,
  };
}

/**
 * にせのエンジン。局面ごとに、合法手を決まった順に並べた上位4手へ、決まった損(0・−60・−180・−450点)を割り当てる。
 * 指した手の損が、そのまま形勢に積み重なる(実際の評価値の代わり)。上位にない手は−200点。
 */
function fakeSearch({ outside = -200, shock = null, mateAbove = Infinity } = {}) {
  const deltas = [0, -60, -180, -450];
  const evals = new Map([['', 0]]);
  const sfens = new Map();
  const tops = new Map();
  const rank = (legal, key) => [...legal].sort((x, y) => relaySeed(`${key}:${x}`) - relaySeed(`${key}:${y}`));
  const sfenOf = (moves) => {
    const key = moves.join(' ');
    if (!sfens.has(key)) {
      const record = createGameRecord(moves.length ? sfenOf(moves.slice(0, -1)) : undefined);
      if (moves.length) appendUsiMove(record, moves.at(-1));
      sfens.set(key, record.position.sfen);
    }
    return sfens.get(key);
  };
  const topOf = (moves) => {
    const key = moves.join(' ');
    if (!tops.has(key)) tops.set(key, rank(enumerateLegalMoves(createGameRecord(sfenOf(moves)).position).map(({ usi }) => usi), key).slice(0, 4));
    return tops.get(key);
  };
  const deltaOf = (moves, usi) => {
    const index = topOf(moves).indexOf(usi);
    return index >= 0 ? deltas[index] : outside;
  };
  const evalOf = (moves) => {
    const key = moves.join(' ');
    if (evals.has(key)) return evals.get(key);
    const before = moves.slice(0, -1);
    const sign = before.length % 2 === 0 ? 1 : -1;
    // shockは、その手数で形勢が急に動く(読みの外の大きな見落とし)。先手から見た点。
    const value = evalOf(before) + sign * deltaOf(before, moves.at(-1)) + (shock && moves.length === shock.ply ? shock.cp : 0);
    evals.set(key, value);
    return value;
  };
  const calls = [];
  const search = async ({ moves, multiPv, searchMoves }) => {
    calls.push({ ply: moves.length, multiPv, searchMoves: searchMoves ?? null });
    const sign = moves.length % 2 === 0 ? 1 : -1;
    const base = evalOf(moves) * sign;
    const list = searchMoves ?? topOf(moves);
    const candidates = list
      .map((move) => ({ move, pv: [move], score: { type: 'cp', value: Math.round(base + deltaOf(moves, move)) } }))
      .sort((x, y) => y.score.value - x.score.value)
      .map((candidate, index) => ({ ...candidate, rank: index + 1, depth: 10 }));
    // 手番の側が大差なら、最善手は詰みの読み(mateAbove)。
    if (base > mateAbove) candidates[0] = { ...candidates[0], score: { type: 'mate', value: 9 } };
    return { move: candidates[0].move, candidates, completedCandidates: candidates };
  };
  return { search, calls, evalOf };
}

function replay(moves) {
  const record = createGameRecord();
  for (const move of moves) {
    if (!appendUsiMove(record, move)) return null;
  }
  return record;
}

describe('relayPlan', () => {
  it('序盤・中盤・終局の手数と、分かれ目の手(敗者の決め手を含む)を種で決める', () => {
    const spec = specOf();
    const plan = relayPlan(spec);
    expect(plan.openingEnd).toBeGreaterThanOrEqual(30);
    expect(plan.openingEnd).toBeLessThanOrEqual(40);
    expect(plan.middleEnd).toBeGreaterThanOrEqual(76);
    expect(plan.end).toBeGreaterThan(plan.middleEnd);
    expect(plan.end).toBeLessThanOrEqual(180);
    const decisive = plan.events.find((event) => event.kind === 'decisive');
    expect(decisive?.side).toBe('white');
    expect(decisive.ply % 2).toBe(1);
    expect(decisive.ply).toBeGreaterThan(plan.middleEnd);
    // 同じ種なら同じ筋書き。
    expect(relayPlan(specOf())).toEqual(plan);
    // 分かれ目の手は、その側の手番の手数に置く。
    for (const event of plan.events) expect(event.ply % 2).toBe(event.side === 'black' ? 0 : 1);
  });

  it('目標の線は、先手の小さな有利から始まり、終局の予定で勝者の大差になる', () => {
    const plan = relayPlan(specOf({ winner: 'white', story: [-150, -300, -300], how: 'opening' }));
    expect(relayTarget(plan, 0)).toBeCloseTo(40, 0);
    expect(relayTarget(plan, THEORY_PLY)).toBeCloseTo(40, 0);
    expect(relayTarget(plan, plan.end)).toBeCloseTo(-DECISIVE_CP, 0);
    expect(relayTarget(plan, plan.openingEnd)).toBeCloseTo(plan.e1, 0);
    expect(relayTarget(plan, plan.middleEnd)).toBeCloseTo(plan.e2, 0);
  });

  it('展開を持たない前の保存の局は、勝ち方から展開を作る(逆転は中盤のあと敗者が優勢)', () => {
    const values = relayStoryValues({ story: null, how: 'comeback', winner: 'black', seed: 5 });
    expect(values[1]).toBeLessThan(-100);
    expect(relayStoryValues({ story: [1, 2, 3], how: 'comeback', winner: 'black', seed: 5 })).toEqual([1, 2, 3]);
  });
});

describe('playRelayGame', () => {
  it('決まった勝者が勝つ、合法な棋譜を作る(投了で終わる)', async () => {
    for (const winner of ['black', 'white']) {
      const engine = fakeSearch();
      const spec = specOf({ winner, story: winner === 'black' ? [120, 250, 300] : [-60, -300, -300], key: `t:${winner}`, seed: relaySeed(`t:${winner}`) });
      const seen = [];
      const game = await playRelayGame({ spec, search: engine.search, onMove: (entry) => seen.push(entry) });
      expect(game).not.toBeNull();
      expect(game.end.winner).toBe(winner);
      expect(game.end.reason).toBe('resign');
      expect(game.entries.length).toBeLessThan(RELAY_MAX_PLIES);
      expect(seen).toHaveLength(game.entries.length);
      expect(replay(game.entries.map(({ move }) => move))).not.toBeNull();
      // 投了の局面では、勝者がはっきり優勢。
      const last = game.entries.at(-1);
      expect(last.eval * (winner === 'black' ? 1 : -1)).toBeGreaterThan(1500);
      // 分かれ目の手(決め手)を、敗者が指している。
      const decisive = game.entries.findIndex(({ mark }) => mark === 'decisive');
      expect(decisive).toBeGreaterThan(0);
      expect(decisive % 2).toBe(winner === 'black' ? 1 : 0);
      for (const entry of game.entries) expect(entry.time).toBeGreaterThan(0);
    }
  }, 60000);

  it('観戦の期(プロ並み)は、分かれ目の悪手とふだんの損が小さく、決まった勝者が投了で勝つ', async () => {
    const story = [150, 300, 300];
    const normal = relayPlan(specOf({ story, key: 'q:n', seed: relaySeed('q') }));
    const pro = relayPlan(specOf({ story, key: 'q:p', seed: relaySeed('q'), quality: 'pro' }));
    const small = (plan) => plan.events.filter(({ phase }) => phase !== 'ending').reduce((sum, { size }) => sum + size, 0);
    expect(small(pro)).toBeLessThan(small(normal));
    expect(relayQuality({ quality: 'pro' }).slipMax).toBeLessThan(relayQuality({}).slipMax);
    const engine = fakeSearch();
    const game = await playRelayGame({ spec: specOf({ story, key: 'q:p', seed: relaySeed('q:p'), quality: 'pro' }), search: engine.search });
    expect(game.end.winner).toBe('black');
    expect(game.end.reason).toBe('resign');
    expect(replay(game.entries.map(({ move }) => move))).not.toBeNull();
    // 終盤の、敗者が良すぎるときの崩れ(上限400点)は別。中盤までのふだんの損を見る。
    const { middleEnd } = relayPlan(specOf({ story, key: 'q:p', seed: relaySeed('q:p'), quality: 'pro' }));
    const slips = game.entries.filter(({ mark }, index) => mark === 'slip' && index < middleEnd);
    expect(slips.every(({ loss }) => loss <= 60 + 1)).toBe(true);
  }, 60000);

  it('序盤は、その棋士の戦法の定跡の手を指す(四間飛車なら飛車を6筋へ)', async () => {
    // 上位にない手(定跡の手)も、損が小さい(−100点)ことにする。
    const engine = fakeSearch({ outside: -100 });
    const spec = specOf({ openings: { black: 'shiken', white: 'ibisha' }, castles: { black: 'mino', white: 'left-mino' } });
    const game = await playRelayGame({ spec, search: engine.search });
    const blackMoves = game.entries.filter((_, index) => index % 2 === 0).slice(0, 16).map(({ move }) => move);
    expect(blackMoves).toContain('2h6h');
    expect(game.entries.slice(0, 8).every(({ mark }) => mark === 'book')).toBe(true);
  }, 60000);

  it('敗者が終盤で詰みのある大差になっても、崩れて、勝者が優勢のまま投了で終わる(15章)', async () => {
    // 先手が勝つ予定の局で、90手目に先手が読みの外の大きな見落としをし、後手(敗者)が7000点の大差・詰みの読みになる。
    const engine = fakeSearch({ shock: { ply: 90, cp: -7000 }, mateAbove: 5000 });
    const spec = specOf({ winner: 'black', story: [100, 200, 300], key: 'shock:1', seed: relaySeed('shock:1') });
    const game = await playRelayGame({ spec, search: engine.search });
    expect(game.end.winner).toBe('black');
    expect(game.end.reason).toBe('resign');
    expect(game.entries.length).toBeLessThan(RELAY_MAX_PLIES);
    // 最後は、勝者(先手)がはっきり優勢(優勢なのに投了、にならない)。
    expect(game.entries.at(-1).eval).toBeGreaterThan(1500);
    // 敗者は崩れる手(slip)で大差を返している。
    expect(game.entries.filter(({ mark }, index) => mark === 'slip' && index > 90 && index % 2 === 1).length).toBeGreaterThan(0);
  }, 60000);

  it('止めると、途中でnullを返す', async () => {
    const engine = fakeSearch();
    let count = 0;
    const game = await playRelayGame({ spec: specOf(), search: engine.search, onMove: () => { count += 1; }, isCancelled: () => count >= 5 });
    expect(game).toBeNull();
    expect(count).toBe(5);
  });
});

describe('pickLoss・shouldResign', () => {
  const evaluate = () => ({ weight: 1, tags: [] });
  const best = { move: 'a', value: 100 };
  const pool = [best, { move: 'b', value: 40 }, { move: 'c', value: -80 }, { move: 'd', value: -500 }];
  it('最善手との差が欲しい大きさに近い手を、範囲の中から選ぶ', () => {
    expect(pickLoss(pool, best, { want: 180, min: 90, max: 300, evaluate }).move).toBe('c');
    expect(pickLoss(pool, best, { want: 50, min: 0, max: 120, evaluate }).move).toBe('b');
    expect(pickLoss(pool, best, { want: 900, min: 700, max: 1000, evaluate })).toBeNull();
    // 駒をただで渡す手は選ばない。
    const sacrifice = (usi) => (usi === 'c' ? { weight: 1, tags: ['piece-sacrifice'] } : { weight: 1, tags: [] });
    expect(pickLoss(pool, best, { want: 180, min: 90, max: 300, evaluate: sacrifice })).toBeNull();
  });
  it('敗者が大差でリードしているときは、駒を渡す手でも選べる(sacrifice)', () => {
    const sacrifice = (usi) => (usi === 'c' ? { weight: 1, tags: ['piece-sacrifice'] } : { weight: 1, tags: [] });
    expect(pickLoss(pool, best, { want: 180, min: 90, max: 300, evaluate: sacrifice, sacrifice: true }).move).toBe('c');
  });
  it('勝率バーの一言: 60%からやや有利、70%有利、80%優勢、92%勝勢。40〜60%は互角', () => {
    expect(rateVerdict(50)).toEqual({ side: null, word: '互角' });
    expect(rateVerdict(59)).toEqual({ side: null, word: '互角' });
    expect(rateVerdict(60)).toEqual({ side: 'black', word: 'やや有利' });
    expect(rateVerdict(25)).toEqual({ side: 'white', word: '有利' });
    expect(rateVerdict(84)).toEqual({ side: 'black', word: '優勢' });
    expect(rateVerdict(3)).toEqual({ side: 'white', word: '勝勢' });
  });
  it('敗者は、投了の早さの手数の詰みまで指す(29章)。点で投げるのは決め手のあと6手たってから', () => {
    const plan = { end: 110, events: [{ kind: 'decisive' }] };
    const mated = (plies) => ({ value: -100000 + plies, score: { type: 'mate', value: -plies } });
    const lost = { value: -6500, score: { type: 'cp', value: -6500 } };
    // ふつうは5手詰めあたりまで指す。
    expect(shouldResign({ ply: 95, best: mated(10), decisiveAt: 87, plan })).toBe(false);
    expect(shouldResign({ ply: 95, best: mated(6), decisiveAt: 87, plan })).toBe(true);
    expect(shouldResign({ ply: 95, best: { value: -2400, score: { type: 'cp', value: -2400 } }, decisiveAt: 87, plan, lastValue: -2400 })).toBe(false);
    expect(shouldResign({ ply: 90, best: lost, decisiveAt: 87, plan, lastValue: lost.value })).toBe(false);
    expect(shouldResign({ ply: 95, best: lost, decisiveAt: 87, plan, lastValue: lost.value })).toBe(true);
    // 決め手の前は、点では投げない(寄せを見せる)。
    expect(shouldResign({ ply: 60, best: lost, decisiveAt: null, plan, lastValue: lost.value })).toBe(false);
    // 詰みまで指す人は、詰みが目の前でも投げない。予定を大きく過ぎて詰みが読めないときだけ、長引かせない。
    const full = resignStyleById('full');
    expect(shouldResign({ ply: 95, best: mated(2), decisiveAt: 87, plan, style: full })).toBe(false);
    expect(shouldResign({ ply: 95, best: lost, decisiveAt: 87, plan, style: full, lastValue: lost.value })).toBe(false);
    expect(shouldResign({ ply: 200, best: lost, decisiveAt: 87, plan, style: full })).toBe(true);
  });
});

describe('持ち時間と時刻', () => {
  it('竜王戦は5時間・名人戦の順位戦は6時間・七番勝負は二日制', () => {
    expect(relayTimeControl({ event: 'ryuo', kind: 'game' })).toMatchObject({ main: 5 * 3600, days: 1, start: 600 });
    expect(relayTimeControl({ event: 'meijin', kind: 'league' })).toMatchObject({ main: 6 * 3600, days: 1 });
    expect(relayTimeControl({ event: 'ryuo', kind: 'finals' })).toMatchObject({ main: 8 * 3600, days: 2, seal: 18 * 60 });
    expect(relayTimeControl({ event: 'meijin', kind: 'finals' })).toMatchObject({ main: 9 * 3600, days: 2 });
  });

  it('時計は持ち時間を減らし、使い切ったら秒読み(1手60秒未満)になる', () => {
    const spec = specOf();
    const plan = relayPlan(spec);
    const clock = createRelayClock(spec, plan);
    let rngState = 1;
    const rng = { next: () => { rngState = (rngState * 48271) % 2147483647; return rngState / 2147483647; } };
    let total = 0;
    for (let ply = 0; ply < 400; ply += 1) {
      const side = ply % 2 === 0 ? 'black' : 'white';
      const seconds = clock.think({ side, ply, kind: ply < 20 ? 'book' : '', gap: 5, surprise: 0, rng });
      total += seconds;
      expect(seconds).toBeGreaterThan(0);
      if (clock.remaining[side] === 0 && ply > 300) expect(seconds).toBeLessThan(60);
    }
    expect(clock.remaining.black).toBe(0);
    expect(total).toBeGreaterThan(2 * 5 * 3600);
  });

  it('時刻をまたいだ手のあとに休憩が入り、二日制は1日目の18時で封じ手になる', () => {
    const game = { entries: Array.from({ length: 80 }, () => ({ time: 600 })) };
    const timeline = relayTimeline(game, relayTimeControl({ event: 'ryuo', kind: 'game' }));
    expect(timeline).toHaveLength(81);
    const breaks = timeline.flatMap((point) => point.breaks);
    expect(breaks.map(({ kind }) => kind)).toEqual(['lunch', 'dinner']);
    expect(timeline[1].clock).toBe(610);
    const two = relayTimeline(game, relayTimeControl({ event: 'ryuo', kind: 'finals' }));
    const seal = two.findIndex((point) => point.breaks.some(({ kind }) => kind === 'seal'));
    expect(seal).toBeGreaterThan(0);
    expect(two[seal + 1].day).toBe(2);
    expect(two.at(-1).day).toBe(2);
  });

  it('時刻と時間の言葉', () => {
    expect(clockText(14 * 60 + 5)).toBe('14:05');
    expect(clockText(24 * 60 + 30)).toBe('0:30');
    expect(remainingText(4 * 3600 + 12 * 60 + 30)).toBe('4:12:30');
    expect(remainingText(52 * 60 + 9)).toBe('52:09');
    expect(thinkTimeText(30)).toBe('30秒');
    expect(thinkTimeText(12 * 60)).toBe('12分');
    expect(thinkTimeText(65 * 60)).toBe('1時間5分');
  });
});
