import { describe, expect, it } from 'vitest';
import { appendUsiMove, createGameRecord, enumerateLegalMoves } from '../game-state';
import {
  LEVEL_STRENGTH, LIGHT_NODES_FLOOR, clearEngineGameProgress, engineGameResult, engineLevel, engineMark, engineStrength,
  isMainCharacter, levelStrength, lightReading, loadEngineGameProgress, playEngineGame, realGameSpec, realPlayerLevel, saveEngineGameProgress,
  shouldEngineResign,
} from './engine-game.mjs';
import { HANANE, HANANE_RIVAL_RUN_RATING, YOSHIHIKO } from './ryuo-story.mjs';
import { resignStyleById } from './resign-style.mjs';
import { GROUP_MEAN_RATING, REAL_WORLD, WORLD_BASE_RATING, worldCpuLevel } from './ryuo-strength.mjs';
import { gameRecordOf } from './ryuo-simulation.mjs';

/** 作りものの読み: 合法手を決まった順に並べ、手番の側から見た値を返す。60手目からは先手が大差(粘る人でも投げる点)。 */
function fakeSearch() {
  const calls = [];
  const search = async ({ moves, multiPv, searchMoves }) => {
    calls.push(moves.length);
    const record = createGameRecord();
    for (const usi of moves) appendUsiMove(record, usi);
    const legal = enumerateLegalMoves(record.position).map(({ usi }) => usi).sort();
    const pool = searchMoves?.length ? legal.filter((usi) => searchMoves.includes(usi)) : legal;
    const blackToMove = moves.length % 2 === 0;
    const base = moves.length >= 60 ? (blackToMove ? 9600 : -9600) : 30;
    const candidates = pool.slice(0, Math.max(1, multiPv)).map((move, index) => ({
      rank: index + 1, move, pv: [move], score: { type: 'cp', value: base - index * 40 },
    }));
    return { move: candidates[0]?.move ?? '', candidates, completedCandidates: [] };
  };
  return { search, calls };
}

const spec = (black, white) => ({
  key: 'ryuo:1:ranking:n1', event: 'ryuo', kind: 'game', seed: 12345, openings: { black: null, white: null }, castles: { black: null, white: null },
  black: { id: 'user', name: '分身', level: black, character: null }, white: { id: 'p1', name: '相手', level: white, character: null },
});

function memoryStorage() {
  const map = new Map();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: (key) => map.delete(key) };
}

describe('本局(20章の段階1)', () => {
  it('Lvの強さ設定(sourceが10以下はロジックAI)', () => {
    expect(engineStrength({ level: 30 })).toMatchObject({ level: 30, logicLevel: null });
    expect(engineStrength({ level: 30 }).settings.nodes).toBeGreaterThan(0);
    expect(engineStrength({ level: 3 }).logicLevel).not.toBeNull();
    expect(engineStrength({ level: 99 }).level).toBe(49);
    expect(engineStrength({}).level).toBe(1);
  });

  it('手の印と投了の決まり', () => {
    expect(engineMark({ planned: true, mate: false, loss: 900, onlyMove: false })).toBe('book');
    expect(engineMark({ planned: false, mate: true, loss: 0, onlyMove: false })).toBe('mate');
    expect(engineMark({ planned: false, mate: false, loss: 700, onlyMove: false })).toBe('decisive');
    expect(engineMark({ planned: false, mate: false, loss: 300, onlyMove: false })).toBe('error');
    expect(engineMark({ planned: false, mate: false, loss: 120, onlyMove: false })).toBe('slip');
    expect(engineMark({ planned: false, mate: false, loss: 0, onlyMove: true })).toBe('only');
    // 投了は棋士の投了の早さで決める(29章)。ふつうは5手詰めあたりまで指し、点ではよほどの大差を2回続けたら投げる。
    const normal = resignStyleById('normal');
    const bad = { value: normal.cp - 100 };
    expect(shouldEngineResign({ ply: 20, best: bad, lastValue: bad.value })).toBe(false);
    expect(shouldEngineResign({ ply: 60, best: bad, lastValue: null })).toBe(false);
    expect(shouldEngineResign({ ply: 60, best: bad, lastValue: bad.value })).toBe(true);
    expect(shouldEngineResign({ ply: 60, best: { value: -3000 }, lastValue: -3000 })).toBe(false);
    const mated = (plies) => ({ value: -100000 + plies, score: { type: 'mate', value: -plies } });
    expect(shouldEngineResign({ ply: 60, best: mated(10), lastValue: null })).toBe(false);
    expect(shouldEngineResign({ ply: 60, best: mated(6), lastValue: null })).toBe(true);
    // 詰みまで指す人は投げない。潔い人は9手詰めで投げる。
    expect(shouldEngineResign({ ply: 60, best: mated(2), lastValue: null, style: resignStyleById('full') })).toBe(false);
    expect(shouldEngineResign({ ply: 60, best: mated(10), lastValue: null, style: resignStyleById('clean') })).toBe(true);
  });

  it('本当に指して、劣勢の側が投了する。手はどれも合法で、中継の棋譜の形', async () => {
    const { search } = fakeSearch();
    const seen = [];
    const game = await playEngineGame({ spec: spec(20, 20), search, onMove: (entry, index) => seen.push(index) });
    // 目的のある手の選び方(aware-move-choice.mjs)は時計で読みを打ち切るので、テストを並べて走らせて遅いときは、
    // 投げる前に先手が詰ますこともある。どちらでも、劣勢の後手が負けて終わる。
    expect(game.end.winner).toBe('black');
    expect(['resign', 'mate']).toContain(game.end.reason);
    expect(game.entries.length).toBe(game.end.plies);
    expect(game.entries.length).toBeGreaterThanOrEqual(game.end.reason === 'resign' ? 60 : 40);
    expect(seen).toEqual(game.entries.map((_, index) => index));
    const record = createGameRecord();
    for (const entry of game.entries) {
      expect(appendUsiMove(record, entry.move)).toBe(true);
      expect(Number.isFinite(entry.eval) && Number.isFinite(entry.time) && entry.time > 0).toBe(true);
      expect(['', 'book', 'mate', 'decisive', 'error', 'slip', 'only']).toContain(entry.mark);
    }
    // 60手目からは先手から見て大きく良い(後手の手番でも先手から見た値)。
    expect(game.entries.at(-1).eval).toBeGreaterThan(2000);
  }, 60000);

  it('ロジックAIのLvでも指せる', async () => {
    const { search } = fakeSearch();
    const game = await playEngineGame({ spec: spec(3, 4), search });
    expect(game.end.winner).toBe('black');
    expect(game.entries.length).toBeGreaterThanOrEqual(60);
  }, 60000);

  it('途中の手から続きを指せる(保存して、戻ったら続きから)', async () => {
    const storage = memoryStorage();
    const first = await playEngineGame({ spec: spec(20, 20), search: fakeSearch().search });
    saveEngineGameProgress(storage, 'k', first.entries.slice(0, 24));
    const resume = loadEngineGameProgress(storage, 'k');
    expect(resume.map(({ move }) => move)).toEqual(first.entries.slice(0, 24).map(({ move }) => move));
    const { search, calls } = fakeSearch();
    const again = await playEngineGame({ spec: spec(20, 20), search, resume });
    expect(again.entries.slice(0, 24)).toEqual(resume);
    expect(Math.min(...calls)).toBeGreaterThanOrEqual(24);
    expect(again.end.winner).toBe('black');
    clearEngineGameProgress(storage, 'k');
    expect(loadEngineGameProgress(storage, 'k')).toEqual([]);
  }, 60000);

  it('止めたらnull', async () => {
    let count = 0;
    const game = await playEngineGame({ spec: spec(20, 20), search: fakeSearch().search, isCancelled: () => (count += 1) > 30 });
    expect(game).toBeNull();
  }, 60000);

  it('結果を期の記録の形にする(勝ち負け・勝ち方・形勢)', () => {
    const entries = Array.from({ length: 90 }, (_, index) => ({ move: '', eval: index < 30 ? 0 : index < 80 ? 400 : 2500, pv: '', best: '', loss: 0, time: 10, mark: '' }));
    const game = { v: 2, key: 'k', entries, end: { winner: 'black', reason: 'resign', plies: 90 } };
    const result = engineGameResult(spec(20, 20), game, 'user');
    expect(result).toMatchObject({ aWins: true, aColor: 'black', how: 'middle' });
    const asWhite = engineGameResult({ ...spec(20, 20), black: { id: 'p1' }, white: { id: 'user' } }, game, 'user');
    expect(asWhite).toMatchObject({ aWins: false, aColor: 'white' });
    expect(asWhite.phases[2]).toBeLessThan(0);
    const stored = gameRecordOf(result, 'user', 'p1');
    expect(stored).toMatchObject({ black: 'user', how: 'middle' });
    expect(stored.story[2]).toBeGreaterThan(0);
  });
});

describe('回戦の全局を本局にする(20-9)', () => {
  it('主要キャラは分身・羽音・善彦', () => {
    expect(isMainCharacter({ id: 'user' })).toBe(true);
    expect(isMainCharacter({ id: 'p1', story: HANANE })).toBe(true);
    expect(isMainCharacter({ id: 'p2', story: YOSHIHIKO })).toBe(true);
    expect(isMainCharacter({ id: 'p3', story: null })).toBe(false);
  });

  it('観戦用の読みは4分の1(下限より少なくしない。下限以下の強さはそのまま)', () => {
    const strong = engineStrength({ level: 49 }).settings;
    const light = engineStrength({ level: 49 }, { light: true }).settings;
    expect(light.nodes).toBe(Math.max(LIGHT_NODES_FLOOR, Math.round(strong.nodes / 4)));
    expect(light.searchThreads).toBe(1);
    const weak = engineStrength({ level: 22 }).settings;
    expect(lightReading(weak)).toEqual(weak.nodes > LIGHT_NODES_FLOOR ? { ...weak, nodes: Math.max(LIGHT_NODES_FLOOR, Math.round(weak.nodes / 4)), searchThreads: 1 } : weak);
  });

  it('強さの表は強い順に並び、表の外は直線で延ばす', () => {
    for (const table of [LEVEL_STRENGTH.full, LEVEL_STRENGTH.light]) {
      for (let level = 2; level <= 49; level += 1) expect(levelStrength(level, table)).toBeGreaterThan(levelStrength(level - 1, table));
    }
    expect(levelStrength(14)).toBe(0);
    expect(levelStrength(13)).toBe(-60);
  });

  it('CPU同士のLv: 基準の棋士は世界の基準Lv、レーティングが高いほど上(Elo式の差をそのまま強さの表で上る)', () => {
    expect(engineLevel(WORLD_BASE_RATING, 26)).toBe(26);
    const up = engineLevel(WORLD_BASE_RATING + 300, 26);
    expect(up).toBeGreaterThan(26);
    expect(Math.abs(levelStrength(up) - (levelStrength(26) + 300))).toBeLessThan(80);
    expect(engineLevel(WORLD_BASE_RATING - 5000, 26)).toBe(1);
    expect(engineLevel(WORLD_BASE_RATING + 5000, 26)).toBe(49);
  });

  it('本局の設定: 勝ち負けは決めない。分身の局はLvのまま、CPU同士はLvを当て直し、主要キャラがいなければ観戦用の読み', () => {
    const base = {
      key: 'ryuo:1:ranking:n2', winner: 'black', how: 'middle', story: [1, 2, 3],
      black: { id: 'p1', rating: WORLD_BASE_RATING + 200, level: 10, story: null },
      white: { id: 'p2', rating: WORLD_BASE_RATING, level: 10, story: null },
    };
    const other = realGameSpec(base, { world: 24 });
    expect(other).toMatchObject({ winner: null, how: null, story: null, light: true });
    expect(other.white.level).toBe(24);
    expect(other.black.level).toBe(engineLevel(WORLD_BASE_RATING + 200, 24, { light: true }));
    const rival = realGameSpec({ ...base, white: { ...base.white, story: HANANE } }, { world: 24 });
    expect(rival.light).toBe(false);
    // 羽音は、分身のいる表では勝ち上がりやすい(自動対局と同じ)。
    expect(rival.white.level).toBe(engineLevel(WORLD_BASE_RATING + HANANE_RIVAL_RUN_RATING, 24));
    const avatar = realGameSpec({ ...base, black: { ...base.black, id: 'user' } }, { world: 24 });
    expect(avatar.light).toBe(false);
    expect(avatar.black.level).toBe(10);
    expect(avatar.white.level).toBe(10);
    // 世界の物差しのない期は、期のLvのまま。
    expect(realGameSpec(base, { world: null }).black.level).toBe(10);
  });
});

describe('本物の世界の本局(docs/tournament-strength-spread-design.mdの9章)', () => {
  const base = {
    key: 'ryuo:1:main:n1', winner: 'black', how: 'middle', story: [1, 2, 3],
    black: { id: 'p1', rating: GROUP_MEAN_RATING[1], level: 10, story: null },
    white: { id: 'p2', rating: GROUP_MEAN_RATING[6], level: 10, story: null },
  };
  it('プロどうしの対局を見せる: 観戦用の読みにせず、段級位の強さのLv(奨励会三段〜タイトル保持者)で指す', () => {
    const spec = realGameSpec(base, { world: REAL_WORLD });
    expect(spec.light).toBe(false);
    expect(spec.black.level).toBe(worldCpuLevel(GROUP_MEAN_RATING[1], REAL_WORLD));
    expect(spec.white.level).toBe(worldCpuLevel(GROUP_MEAN_RATING[6], REAL_WORLD));
    expect(spec.black.level).toBeGreaterThanOrEqual(45);
    expect(engineStrength(spec.black, { light: spec.light }).settings.nodes).toBe(engineStrength(spec.black).settings.nodes);
  });

  it('天鷺善彦は、いつも藤井聡太並み(Lv49。読む量も最上位)', () => {
    const father = { id: 'p9', rating: 1700, story: YOSHIHIKO };
    expect(realPlayerLevel(father)).toBe(49);
    const spec = realGameSpec({ ...base, white: father }, { world: REAL_WORLD });
    expect(spec.white.level).toBe(49);
    expect(engineStrength(spec.white).settings.nodes).toBe(engineStrength({ level: 49 }).settings.nodes);
    expect(engineStrength(spec.white).settings.searchThreads).toBe(2);
  });
});
