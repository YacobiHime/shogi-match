import { describe, expect, it } from 'vitest';
import { clearExhibitRecords } from './exhibit-reset.mjs';
import {
  CONTENT_MIN_MOVES, MAX_INSIGHT_GAMES, PLAY_INSIGHT_KEY, addAnalyzedGame, completePlayInsight, contentStrength, createPlayInsight, detectWeaknesses,
  enqueuePlayInsight, loadPlayInsight, recordPractice, savePlayInsight, summarizePlayInsight,
} from './play-insight.mjs';
import { reviewProblemId } from './review-problems.mjs';
import { levelForAverageLoss } from './skill-estimate.mjs';
import { STANDARD_SFEN } from '../game-state';

function memoryStorage(entries = {}) {
  const map = new Map(Object.entries(entries));
  return {
    get length() { return map.size; },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

/** 要約の例。phasesは[測れた手, 損の合計, 大きな悪手]。 */
function summary({ opening = [10, 300, 0], middle = [10, 300, 0], ending = [10, 300, 0], mates = [], freeLosses = 0, standing30 = 0 } = {}) {
  const phase = ([n, sum, big]) => ({ n, sum, big });
  const phases = { opening: phase(opening), middle: phase(middle), ending: phase(ending) };
  const all = Object.values(phases);
  return {
    moves: all.reduce((t, p) => t + p.n, 0), sum: all.reduce((t, p) => t + p.sum, 0), big: all.reduce((t, p) => t + p.big, 0),
    phases, mates, freeLosses, standing30,
  };
}
const game = (at, sum, outcome = 'loss') => ({ at, level: 15, outcome, color: 'black', summary: sum });

describe('対局の中身の保存', () => {
  it('解析待ちの列に足し、解析を終えたら記録へ移す。直近20局だけ残す', () => {
    let insight = createPlayInsight();
    insight = enqueuePlayInsight(insight, { moves: ['7g7f'], color: 'black', outcome: 'win', level: 14, at: 5 });
    expect(insight.queue).toHaveLength(1);
    insight = completePlayInsight(insight, insight.queue[0], summary());
    expect(insight.queue).toHaveLength(0);
    expect(insight.games[0]).toMatchObject({ at: 5, level: 14, outcome: 'win', color: 'black' });
    for (let at = 10; at < 40; at += 1) insight = completePlayInsight(insight, { at, level: 14, outcome: 'loss', color: 'white' }, null);
    expect(insight.games).toHaveLength(MAX_INSIGHT_GAMES);
    expect(insight.games.at(-1).at).toBe(39);
  });

  it('保存して読み直す。読めない値は捨てる。展示の「最初から」で消える', () => {
    const storage = memoryStorage();
    let insight = completePlayInsight(createPlayInsight(), { at: 1, level: 3, outcome: 'draw', color: 'white' }, summary());
    insight = recordPractice(insight, { kind: 'free', games: 12 });
    savePlayInsight(storage, insight);
    expect(loadPlayInsight(storage)).toEqual(insight);

    storage.setItem(PLAY_INSIGHT_KEY, JSON.stringify({
      games: [{ at: 1, level: 3, outcome: 'draw', color: 'white', summary: null }, { at: 'x' }, { at: 2, level: 3, outcome: 'win', color: 'black', summary: { moves: 1 } }],
      queue: [{ at: 3, level: 3, outcome: 'win', color: 'black', moves: [1] }],
      practice: { kind: 3 },
    }));
    expect(loadPlayInsight(storage)).toEqual({ games: [{ at: 1, level: 3, outcome: 'draw', color: 'white', summary: null }], queue: [], practice: null });
    storage.setItem(PLAY_INSIGHT_KEY, '{');
    expect(loadPlayInsight(storage)).toEqual(createPlayInsight());

    clearExhibitRecords(storage);
    expect(storage.getItem(PLAY_INSIGHT_KEY)).toBeNull();
  });
});

describe('1局の要約', () => {
  it('序盤・中盤・終盤の損、大きな悪手、逃した詰み、30手目の形勢', () => {
    // 先手が指し続ける形の点(手番は交互)。損は先手の手だけに付ける。
    const moves = ['7g7f', '3c3d', '2g2f', '8c8d'];
    const points = [
      { ply: 0, score: { type: 'mate', value: 3 }, bestMove: '2g2f' },
      { ply: 1, score: { type: 'cp', value: 200 }, moveMeasure: { mover: 'black', loss: 400, standing: 100 } },
      { ply: 2, score: { type: 'cp', value: 200 }, moveMeasure: { mover: 'white', loss: 0, standing: -200 } },
      { ply: 3, score: { type: 'cp', value: 150 }, moveMeasure: { mover: 'black', loss: 50, standing: 2000 } },
      { ply: 4, score: { type: 'cp', value: 150 }, moveMeasure: { mover: 'white', loss: 0, standing: -150 } },
    ];
    const sfens = ['s0', 's1', 's2', 's3', 's4'];
    const result = summarizePlayInsight({ points, sfens, moves, color: 'black', initialSfen: STANDARD_SFEN });
    // 3手目は形勢に大差(2000)があるので、損を測らない。
    expect(result).toMatchObject({ moves: 1, sum: 400, big: 1, freeLosses: 0, standing30: null });
    expect(result.phases.opening).toEqual({ n: 1, sum: 400, big: 1 });
    expect(result.mates).toEqual([{ sfen: 's0', length: 3 }]);

    const white = summarizePlayInsight({ points, sfens, moves, color: 'white', initialSfen: STANDARD_SFEN });
    expect(white.mates).toEqual([]);
    expect(white.moves).toBe(2);
  });

  it('30手目の形勢は、自分から見た値', () => {
    const points = [{ ply: 30, score: { type: 'cp', value: 420 } }];
    expect(summarizePlayInsight({ points, sfens: [], moves: [], color: 'white', initialSfen: '' }).standing30).toBe(-420);
    expect(summarizePlayInsight({ points, sfens: [], moves: [], color: 'black', initialSfen: '' }).standing30).toBe(420);
  });
});

describe('内容の強さ', () => {
  it('測れた手が40手に満たなければ使わない。そろえば平均損失から棋力診断と同じ換算', () => {
    expect(contentStrength([game(1, summary({ opening: [10, 1000, 0], middle: [10, 1000, 0], ending: [10, 1000, 0] }))])).toBeNull();
    const games = [game(1, summary()), game(2, summary())];
    expect(games.reduce((t, g) => t + g.summary.moves, 0)).toBeGreaterThanOrEqual(CONTENT_MIN_MOVES);
    expect(contentStrength(games)).toBe(Math.round(levelForAverageLoss(30) * 80));
    // 解析できなかった対局(summaryがnull)は数えない。
    expect(contentStrength([...games, game(3, null)])).toBe(contentStrength(games));
  });
});

describe('弱点の見立て(直近3局)', () => {
  it('解析した対局がなければ、弱点なし', () => {
    expect(detectWeaknesses([])).toEqual([]);
    expect(detectWeaknesses([game(1, summary())])).toEqual([]);
  });

  it('詰みを逃した: 最新の局面の問題のIDを添える', () => {
    const found = detectWeaknesses([
      game(1, summary({ mates: [{ sfen: 'old', length: 1 }] })),
      game(2, summary({ mates: [{ sfen: 'new 1', length: 3 }] })),
    ]);
    expect(found[0]).toEqual({ kind: 'mate', count: 2, problemId: reviewProblemId('new 1') });
  });

  it('終盤で崩れた: 終盤の平均損失が序盤・中盤の2倍以上で、終盤に大きな悪手がある', () => {
    const ending = summary({ ending: [10, 1200, 1] });
    expect(detectWeaknesses([game(1, ending)]).map(({ kind }) => kind)).toEqual(['ending']);
    expect(detectWeaknesses([game(1, summary({ ending: [10, 1200, 0] }))])).toEqual([]);
    expect(detectWeaknesses([game(1, summary({ ending: [10, 500, 1] }))])).toEqual([]);
  });

  it('タダで取られた: 1局あたり2回以上', () => {
    expect(detectWeaknesses([game(1, summary({ freeLosses: 3 })), game(2, summary({ freeLosses: 1 }))]).map(({ kind }) => kind)).toEqual(['free']);
    expect(detectWeaknesses([game(1, summary({ freeLosses: 2 })), game(2, summary({ freeLosses: 1 }))])).toEqual([]);
  });

  it('序盤で不利: 序盤の損がいちばん大きく、30手目に−300以下', () => {
    const opening = summary({ opening: [10, 900, 1], standing30: -350 });
    expect(detectWeaknesses([game(1, opening)]).map(({ kind }) => kind)).toEqual(['opening']);
    expect(detectWeaknesses([game(1, summary({ opening: [10, 900, 1], standing30: -100 }))])).toEqual([]);
  });

  it('見るのは直近3局だけ。優先の順(詰み・終盤・タダ・序盤)に並べる', () => {
    const old = game(1, summary({ mates: [{ sfen: 'old', length: 1 }] }));
    const recent = [2, 3, 4].map((at) => game(at, summary({ freeLosses: 2, opening: [10, 900, 1], standing30: -400 })));
    expect(detectWeaknesses([old, ...recent]).map(({ kind }) => kind)).toEqual(['free', 'opening']);
  });
});

describe('竜王戦の対局の中身(docs/home-next-adaptive-design.mdの14章)', () => {
  it('ほかで解析した対局を、棋戦の印つきで足す。保存から読み戻せて、弱点の見立てにも入る', () => {
    let insight = addAnalyzedGame(createPlayInsight(), { at: 3, level: 20, outcome: 'win', color: 'white', event: 'ryuo', summary: summary({ freeLosses: 3 }) });
    insight = addAnalyzedGame(insight, { at: 3, level: 20, outcome: 'win', color: 'white', event: 'ryuo', summary: summary({ freeLosses: 3 }) });
    expect(insight.games).toHaveLength(1);
    expect(insight.games[0].event).toBe('ryuo');
    const storage = memoryStorage();
    savePlayInsight(storage, insight);
    expect(loadPlayInsight(storage).games[0].event).toBe('ryuo');
    expect(detectWeaknesses(loadPlayInsight(storage).games).map(({ kind }) => kind)).toContain('free');
    // 読めない値は足さない。
    expect(addAnalyzedGame(createPlayInsight(), { at: 4, level: 20, outcome: 'win', color: 'red', summary: null }).games).toHaveLength(0);
  });
});
