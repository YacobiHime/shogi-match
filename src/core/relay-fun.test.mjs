import { describe, expect, it } from 'vitest';
import { STANDARD_SFEN, appendUsiMove, createGameRecord, enumerateLegalMoves } from '../game-state';
import {
  JUDGE_QUIZ_FROM, MOVE_QUIZ_FROM, NOTES_LIMIT, PREDICT_UNTIL_PLY, QUIZ_GAP, QUIZ_KEY, SEEN_LIMIT, addNote, boardPredictions, highlightPlan,
  judgeOf, judgeReason, loadNotes, loadPredictions, loadQuiz, markSeen, moveQuizFits, pickWinner, quizChoices, quizSpots, quizStars,
  removeNote, saveNotes, savePredictions, saveQuiz, scoreQuiz, seenPly, settlePrediction,
} from './relay-fun.mjs';
import { blackWinRate } from './relay-game.mjs';
import { moveExchange } from './exchange-eval.mjs';
import { parseSfenState } from './piece-movement.mjs';

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
  });
});

/** 合法手を決まった順で指して、1局ぶんの棋譜(手と局面)を作る。evalAtで手ごとの評価値を決める。 */
function playedGame(length, evalAt) {
  const record = createGameRecord(STANDARD_SFEN);
  const sfens = [record.position.sfen];
  const entries = [];
  for (let index = 0; index < length; index += 1) {
    const legal = enumerateLegalMoves(record.position).map(({ usi }) => usi);
    if (!legal.length) break;
    const usi = legal[(index * 7 + 3) % legal.length];
    appendUsiMove(record, usi);
    sfens.push(record.position.sfen);
    entries.push({ move: usi, eval: evalAt(index), pv: '', best: '', loss: 0, time: 30, mark: '' });
  }
  return { entries, sfens };
}

describe('大盤解説の当てもの(52章)', () => {
  it('記録は次の一手と形勢当てを分け、★の点・連続を数える。前の版は次の一手として読む', () => {
    const storage = memoryStorage();
    storage.setItem(QUIZ_KEY, JSON.stringify({ total: 5, hit: 3, streak: 1, best: 2 }));
    let store = loadQuiz(storage);
    expect(store.move).toEqual({ total: 5, hit: 3, stars: 3, streak: 1, best: 2 });
    expect(store.judge).toEqual({ total: 0, hit: 0, stars: 0, streak: 0, best: 0 });
    store = scoreQuiz(store, 'judge', true, 3);
    store = scoreQuiz(store, 'judge', true, 2);
    store = scoreQuiz(store, 'judge', false, 3);
    store = scoreQuiz(store, 'move', true, 1);
    expect(store.judge).toEqual({ total: 3, hit: 2, stars: 5, streak: 0, best: 2 });
    expect(store.move).toEqual({ total: 6, hit: 4, stars: 4, streak: 2, best: 2 });
    saveQuiz(storage, store);
    expect(loadQuiz(storage)).toEqual(store);
  });

  it('見た手数は増えるときだけ残し、新しく見た対局を後ろへ回して上限を超えたら古いものから消す', () => {
    let store = loadQuiz(null);
    store = markSeen(store, 'a', 30);
    store = markSeen(store, 'a', 12);
    expect(seenPly(store, 'a')).toBe(30);
    expect(seenPly(store, 'none')).toBe(0);
    for (let index = 0; index < SEEN_LIMIT; index += 1) store = markSeen(store, `g${index}`, 5);
    expect(Object.keys(store.seen)).toHaveLength(SEEN_LIMIT);
    expect(seenPly(store, 'a')).toBe(0);
    store = markSeen(store, 'g0', 9);
    expect(Object.keys(store.seen).at(-1)).toBe('g0');
  });

  it('形勢の段は勝率40〜60%を互角にする', () => {
    expect(judgeOf(0.5)).toBe('even');
    expect(judgeOf(0.61)).toBe('black');
    expect(judgeOf(0.6)).toBe('black');
    expect(judgeOf(0.39)).toBe('white');
    expect(judgeOf(0.45)).toBe('even');
  });

  it('次の一手に向かない局面：王手を逃げるしかない・取り返すだけ・指せる手が3つ以下', () => {
    expect(moveQuizFits('4k4/9/9/9/4R4/9/9/9/4K4 w - 1', '5a4a')).toBe(false);
    const record = createGameRecord(STANDARD_SFEN);
    for (const usi of ['7g7f', '3c3d', '8h2b+']) appendUsiMove(record, usi);
    expect(moveQuizFits(record.position.sfen, '3a2b', '8h2b+')).toBe(false);
    expect(moveQuizFits(record.position.sfen, '4a3b', '8h2b+')).toBe(true);
    expect(moveQuizFits('8k/9/9/9/9/9/9/9/K8 w - 1', '1a1b')).toBe(false);
  });

  it('出題の局面は25手目より後で10手ずつ空け、次の一手と形勢当てを交互にし、形勢当ての答えを偏らせない', () => {
    // 評価値を、先手よし・互角・後手よしが入れ替わる形にする。
    const evalAt = (index) => [900, 0, -900][Math.floor(index / 4) % 3];
    const { entries, sfens } = playedGame(150, evalAt);
    const cache = new Map();
    const spots = quizSpots({ entries, sfens, cache, limit: 20 });
    expect(spots.length).toBeGreaterThanOrEqual(6);
    expect(spots.every(({ ply }) => ply >= MOVE_QUIZ_FROM)).toBe(true);
    spots.slice(1).forEach((spot, index) => expect(spot.ply - spots[index].ply).toBeGreaterThanOrEqual(QUIZ_GAP));
    const judges = spots.filter(({ kind }) => kind === 'judge');
    expect(judges.every(({ ply }) => ply > JUDGE_QUIZ_FROM)).toBe(true);
    const classes = judges.map(({ ply }) => judgeOf(blackWinRate(entries[ply - 1].eval)));
    const tally = ['black', 'even', 'white'].map((side) => classes.filter((item) => item === side).length);
    expect(Math.max(...tally) - Math.min(...tally)).toBeLessThanOrEqual(1);
    expect(spots.some(({ kind }) => kind === 'move')).toBe(true);
    // 棋譜が伸びても、前に選んだ局面は変わらない(覚えた判定もそのまま使う)。
    const shorter = quizSpots({ entries: entries.slice(0, 80), sfens: sfens.slice(0, 81), cache });
    expect(spots.slice(0, shorter.length)).toEqual(shorter);
    expect(quizSpots({ entries, sfens, limit: 20 })).toEqual(spots);
  });

  it('次の一手の候補のほかの2つは、駒をただで取られない手', () => {
    const { entries, sfens } = playedGame(60, () => 0);
    for (const cursor of [30, 40, 50]) {
      const sfen = sfens[cursor];
      const actual = entries[cursor].move;
      const choices = quizChoices({ sfen, actual, seed: `s${cursor}` });
      expect(choices).toHaveLength(3);
      expect(choices).toContain(actual);
      const state = parseSfenState(sfen);
      for (const usi of choices.filter((usi) => usi !== actual)) {
        expect(moveExchange(state, usi, { scope: 'moved' })?.risk ?? 1).toBeLessThanOrEqual(0);
      }
    }
  });

  it('★は、次の一手はAIと違う手が3・取る手が2・静かな手が1。形勢当ては駒の損得と逆が3', () => {
    const record = createGameRecord(STANDARD_SFEN);
    for (const usi of ['7g7f', '3c3d']) appendUsiMove(record, usi);
    const sfen = record.position.sfen;
    expect(quizStars({ kind: 'move', sfen, answer: { move: '2g2f', best: '6i7h' } })).toBe(3);
    expect(quizStars({ kind: 'move', sfen, answer: { move: '8h2b+', best: '' } })).toBe(2);
    expect(quizStars({ kind: 'move', sfen, answer: { move: '2g2f', best: '' } })).toBe(1);
    appendUsiMove(record, '8h2b+');
    const ahead = record.position.sfen;
    expect(quizStars({ kind: 'judge', sfen: ahead, judge: 'black' })).toBe(1);
    expect(quizStars({ kind: 'judge', sfen: ahead, judge: 'white' })).toBe(3);
    expect(quizStars({ kind: 'judge', sfen: ahead, judge: 'even' })).toBe(2);
    expect(quizStars({ kind: 'judge', sfen: STANDARD_SFEN, judge: 'black' })).toBe(2);
  });

  it('形勢当ての理由は駒の損得と玉の守りから1行。羽音の言い方は敬語と「！」なし', () => {
    const record = createGameRecord(STANDARD_SFEN);
    for (const usi of ['7g7f', '3c3d', '8h2b+']) appendUsiMove(record, usi);
    const sfen = record.position.sfen;
    expect(judgeReason({ sfen, judge: 'black' })).toMatch(/先手の角得で、先手が良いですね/);
    expect(judgeReason({ sfen, judge: 'white' })).toMatch(/^駒は先手が得ですが、後手の/);
    expect(judgeReason({ sfen, judge: 'even' })).toMatch(/互角です$/);
    for (const judge of ['black', 'even', 'white']) {
      const plain = judgeReason({ sfen, judge, plain: true });
      expect(plain).not.toMatch(/です|ます|！/);
      expect(judgeReason({ sfen: STANDARD_SFEN, judge, plain: true })).not.toMatch(/です|ます|！/);
    }
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
