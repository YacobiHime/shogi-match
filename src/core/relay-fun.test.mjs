import { describe, expect, it } from 'vitest';
import { STANDARD_SFEN, appendUsiMove, createGameRecord } from '../game-state';
import {
  NOTES_LIMIT, PREDICT_UNTIL_PLY, addNote, boardPredictions, highlightPlan, loadNotes, loadPredictions, loadQuiz, pickWinner,
  quizChoices, removeNote, saveNotes, savePredictions, saveQuiz, scoreQuiz, settlePrediction,
} from './relay-fun.mjs';

function memoryStorage() {
  const map = new Map();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: (key) => map.delete(key) };
}

describe('勝敗の予想(24-1)', () => {
  it('序盤のうちだけ選べ、終局したら1局につき1回だけ数える。連続的中と最高も残す', () => {
    let store = loadPredictions(null);
    store = pickWinner(store, 'g1', 'black', 3);
    store = pickWinner(store, 'g2', 'white', PREDICT_UNTIL_PLY);
    expect(store.picks).toEqual({ g1: 'black' });
    store = pickWinner(store, 'g1', 'white', 10);
    expect(store.picks.g1).toBe('white');
    store = pickWinner(store, 'g3', 'black', 0);
    expect(boardPredictions(store, [{ key: 'g1', winner: null }, { key: 'g3', winner: 'black' }, { key: 'g9', winner: 'white' }])).toEqual({ picked: 2, decided: 1, hit: 1 });
    store = settlePrediction(store, 'g3', 'black');
    store = settlePrediction(store, 'g3', 'black');
    store = settlePrediction(store, 'g1', 'white');
    expect(store).toMatchObject({ total: 2, hit: 2, streak: 2, best: 2 });
    // 数え終えた対局は、選び直せない。
    expect(pickWinner(store, 'g1', 'black', 1).picks.g1).toBe('white');
    store = pickWinner(store, 'g4', 'black', 1);
    store = settlePrediction(store, 'g4', 'white');
    expect(store).toMatchObject({ total: 3, hit: 2, streak: 0, best: 2 });
    const storage = memoryStorage();
    savePredictions(storage, store);
    expect(loadPredictions(storage)).toEqual(store);
  });
});

describe('次の一手クイズ(24-2)', () => {
  it('候補は3つの合法手で、実際の手とAIの読み筋の手を入れる。同じ局面と種なら同じ候補', () => {
    const record = createGameRecord(STANDARD_SFEN);
    for (const usi of ['7g7f', '3c3d', '2g2f']) appendUsiMove(record, usi);
    const sfen = record.position.sfen;
    const choices = quizChoices({ sfen, expected: '4a3b', actual: '8c8d', seed: 'k' });
    expect(choices).toHaveLength(3);
    expect(choices).toContain('4a3b');
    expect(choices).toContain('8c8d');
    expect(new Set(choices).size).toBe(3);
    expect(quizChoices({ sfen, expected: '4a3b', actual: '8c8d', seed: 'k' })).toEqual(choices);
    // 合法でない手は入れない。
    expect(quizChoices({ sfen, expected: '1a1z', seed: 'k' })).toHaveLength(3);
    let store = loadQuiz(null);
    store = scoreQuiz(store, true);
    store = scoreQuiz(store, true);
    store = scoreQuiz(store, false);
    expect(store).toEqual({ total: 3, hit: 2, streak: 0, best: 2 });
    const storage = memoryStorage();
    saveQuiz(storage, store);
    expect(loadQuiz(storage)).toEqual(store);
  });
});

describe('見どころ再生(24-3)', () => {
  it('形勢が動いた手・長考・決め手を選び、最後に終局を入れる。手数の順で、上限まで', () => {
    // 31手目で先手に傾き、51手目は長考、71手目で後手に大きく傾き、90手目で詰み。
    const evalAt = (index) => (index < 30 ? 0 : index < 70 ? 900 : -1500);
    const entries = Array.from({ length: 90 }, (_, index) => ({ move: '', eval: evalAt(index), time: 60, mark: '' }));
    entries[30] = { ...entries[30], mark: 'error' };
    entries[50] = { ...entries[50], time: 3600 };
    entries[70] = { ...entries[70], mark: 'decisive' };
    entries[89] = { ...entries[89], eval: -30000, mark: 'mate' };
    const plan = highlightPlan(entries, { end: { winner: 'white', reason: 'mate' } });
    expect(plan.map(({ ply }) => ply)).toEqual([31, 51, 71, 90]);
    expect(plan[0].caption).toMatch(/形勢が/);
    expect(plan[1].kind).toBe('think');
    expect(plan.at(-1).kind).toBe('mate');
    // 上限を超えたら、点の高いものから選ぶ(終局は必ず入れる)。
    const busy = Array.from({ length: 40 }, (_, index) => ({ move: '', eval: index % 2 ? 1500 : -1500, time: 10, mark: '' }));
    const short = highlightPlan(busy, { limit: 4 });
    expect(short).toHaveLength(4);
    expect(short.at(-1).ply).toBe(40);
    expect(short.map(({ ply }) => ply)).toEqual([...short.map(({ ply }) => ply)].sort((a, b) => a - b));
  });

  it('勝率がほとんど動かない決め手には、勝率の数字を添えない(「0%→0%」にしない)', () => {
    const entries = Array.from({ length: 20 }, () => ({ move: '', eval: -5000, time: 30, mark: '' }));
    entries[12] = { ...entries[12], mark: 'decisive' };
    entries[15] = { ...entries[15], mark: 'error' };
    const plan = highlightPlan(entries);
    const decisive = plan.find(({ ply }) => ply === 13);
    expect(decisive.caption).toBe('勝負を分けた一手');
    expect(plan.find(({ ply }) => ply === 16).caption).toBe('疑問手');
    expect(plan.every(({ caption }) => !/0%→0%/.test(caption))).toBe(true);
  });
});

describe('研究ノート(24-5)', () => {
  it('局面を新しい順に残し、同じ手数は1つ。上限まで。能力の重い情報は外して残す', () => {
    const spec = {
      key: 'ryuo:1:main:m3', event: 'ryuo', kind: 'game', label: '決勝トーナメント 準決勝', seed: 7, winner: null,
      black: { id: 'a', name: '甲', dan: '七段', repertoire: { big: true }, character: { attack: 60 } },
      white: { id: 'b', name: '乙', dan: '五段', repertoire: { big: true } },
    };
    let notes = loadNotes(null);
    notes = addNote(notes, { spec, ply: 12, sfen: STANDARD_SFEN, moveText: '▲7六歩', savedAt: 1 });
    notes = addNote(notes, { spec, ply: 30, sfen: STANDARD_SFEN, moveText: '▲2六歩', savedAt: 2 });
    notes = addNote(notes, { spec, ply: 12, sfen: STANDARD_SFEN, moveText: '▲7六歩', savedAt: 3 });
    expect(notes.map(({ ply }) => ply)).toEqual([12, 30]);
    expect(notes[0].spec.black.repertoire).toBeUndefined();
    expect(notes[0].spec.black.character).toEqual({ attack: 60 });
    for (let ply = 40; ply < 40 + NOTES_LIMIT + 5; ply += 1) notes = addNote(notes, { spec, ply, sfen: STANDARD_SFEN, moveText: '' });
    expect(notes).toHaveLength(NOTES_LIMIT);
    notes = removeNote(notes, notes[0].id);
    expect(notes).toHaveLength(NOTES_LIMIT - 1);
    const storage = memoryStorage();
    saveNotes(storage, notes);
    expect(loadNotes(storage)).toEqual(notes);
  });
});
