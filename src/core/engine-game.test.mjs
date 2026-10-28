import { describe, expect, it } from 'vitest';
import { appendUsiMove, createGameRecord, enumerateLegalMoves } from '../game-state';
import {
  ENGINE_RESIGN_CP, clearEngineGameProgress, engineGameResult, engineMark, engineStrength, loadEngineGameProgress, playEngineGame,
  saveEngineGameProgress, shouldEngineResign,
} from './engine-game.mjs';
import { gameRecordOf } from './ryuo-simulation.mjs';

/** 作りものの読み: 合法手を決まった順に並べ、手番の側から見た値を返す。60手目からは先手が大きく優勢。 */
function fakeSearch() {
  const calls = [];
  const search = async ({ moves, multiPv, searchMoves }) => {
    calls.push(moves.length);
    const record = createGameRecord();
    for (const usi of moves) appendUsiMove(record, usi);
    const legal = enumerateLegalMoves(record.position).map(({ usi }) => usi).sort();
    const pool = searchMoves?.length ? legal.filter((usi) => searchMoves.includes(usi)) : legal;
    const blackToMove = moves.length % 2 === 0;
    const base = moves.length >= 60 ? (blackToMove ? 3000 : -3000) : 30;
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
    const bad = { value: ENGINE_RESIGN_CP - 100 };
    expect(shouldEngineResign({ ply: 20, best: bad, lastValue: bad.value })).toBe(false);
    expect(shouldEngineResign({ ply: 60, best: bad, lastValue: null })).toBe(false);
    expect(shouldEngineResign({ ply: 60, best: bad, lastValue: bad.value })).toBe(true);
    expect(shouldEngineResign({ ply: 60, best: { value: -99990, score: { type: 'mate', value: -9 } }, lastValue: null })).toBe(true);
  });

  it('本当に指して、劣勢の側が投了する。手はどれも合法で、中継の棋譜の形', async () => {
    const { search } = fakeSearch();
    const seen = [];
    const game = await playEngineGame({ spec: spec(20, 20), search, onMove: (entry, index) => seen.push(index) });
    expect(game.end).toMatchObject({ winner: 'black', reason: 'resign' });
    expect(game.entries.length).toBe(game.end.plies);
    expect(game.entries.length).toBeGreaterThanOrEqual(60);
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
