import { describe, expect, it } from 'vitest';
import { createRng } from './ryuo-random.mjs';
import {
  SUDOKU_LEVELS,
  SUDOKU_SAVE_KEY,
  applySudokuHint,
  clearSudokuSave,
  countSudokuHint,
  countSudokuSolutions,
  createSudokuGame,
  eraseSudokuCell,
  inputSudokuDigit,
  isSolved,
  isWrong,
  loadSudokuSave,
  makeSudoku,
  makeSudokuAsync,
  makeSudokuSolution,
  noteDigits,
  recommendSudokuLevel,
  remainingDigits,
  saveSudokuSave,
  solveSudokuLogically,
  sudokuClock,
  sudokuGeometry,
  sudokuHint,
  sudokuLevel,
  sudokuPraise,
  sudokuRecordId,
  sudokuResult,
  sudokuTimeText,
  undoSudoku,
} from './brain-sudoku.mjs';

const SIX = sudokuLevel(1);
const NINE = sudokuLevel(2);

function memoryStorage() {
  const map = new Map();
  return { getItem: (key) => (map.has(key) ? map.get(key) : null), setItem: (key, value) => map.set(key, String(value)), removeItem: (key) => map.delete(key), map };
}

/** 行・列・枠に1〜nが1つずつあるか。 */
function validSolution(grid, spec) {
  const geometry = sudokuGeometry(spec);
  return geometry.units.every((unit) => new Set(unit.map((cell) => grid[cell])).size === geometry.n && unit.every((cell) => grid[cell] >= 1 && grid[cell] <= geometry.n));
}

/** 段ごとに決まりに合う問題がすぐ見つかる種(16-4。作るのに時間がかからないものを選んだ)。 */
const SEEDS = { 1: [11, 22, 33], 2: [11, 22, 33], 3: [11, 22, 33], 4: [7919, 15838, 23757], 5: [7919, 63352] };

describe('盤の形', () => {
  it('9×9は行・列・枠が9つずつで、どのマスも20のマスと関わる', () => {
    const geometry = sudokuGeometry(NINE);
    expect(geometry.units).toHaveLength(27);
    expect(geometry.units.every((unit) => unit.length === 9)).toBe(true);
    expect(geometry.peers.every((peers) => peers.length === 20)).toBe(true);
    expect(geometry.boxOf[80]).toBe(8);
    expect(geometry.boxOf[30]).toBe(4);
  });

  it('6×6は枠が横3×縦2で、どのマスも12のマスと関わる', () => {
    const geometry = sudokuGeometry(SIX);
    expect(geometry.units).toHaveLength(18);
    expect(geometry.peers.every((peers) => peers.length === 12)).toBe(true);
    // 1行目の左の3マスと2行目の左の3マスが同じ枠。
    expect(new Set([0, 1, 2, 6, 7, 8].map((cell) => geometry.boxOf[cell])).size).toBe(1);
    expect(geometry.boxOf[3]).not.toBe(geometry.boxOf[0]);
  });
});

describe('答えの盤と答えの数', () => {
  it('種つきで、行・列・枠に1つずつの盤を作る(同じ種なら同じ盤)', () => {
    for (const spec of [SIX, NINE]) {
      const grid = makeSudokuSolution(createRng(5), spec);
      expect(validSolution(grid, spec)).toBe(true);
      expect(makeSudokuSolution(createRng(5), spec)).toEqual(grid);
      expect(makeSudokuSolution(createRng(6), spec)).not.toEqual(grid);
    }
  });

  it('答えの数を2まで数える(埋まった盤は1、空の盤は2、重なる盤は0)', () => {
    const grid = makeSudokuSolution(createRng(9), NINE);
    expect(countSudokuSolutions(grid, NINE)).toBe(1);
    expect(countSudokuSolutions(new Array(81).fill(0), NINE)).toBe(2);
    const broken = grid.slice();
    broken[1] = broken[0];
    expect(countSudokuSolutions(broken, NINE)).toBe(0);
  });
});

describe('問題を作る(段ごと)', () => {
  for (const level of SUDOKU_LEVELS) {
    it(`${level.label}: 答えが1つで、段の解き方で解け、段の決まりを満たす`, () => {
      for (const seed of SEEDS[level.id]) {
        const made = makeSudoku(level.id, seed, { maxAttempts: 2000, timeLimitMs: 60000 });
        expect(made.size).toBe(level.size);
        expect(made.fits).toBe(true);
        expect(validSolution(made.solution, level)).toBe(true);
        expect(made.puzzle.every((value, cell) => !value || value === made.solution[cell])).toBe(true);
        expect(countSudokuSolutions(made.puzzle, level)).toBe(1);
        const solved = solveSudokuLogically(made.puzzle, level, level.maxTech);
        expect(solved.solved).toBe(true);
        expect(solved.values).toEqual(made.solution);
        expect(made.givens).toBe(made.puzzle.filter(Boolean).length);
        expect(made.givens).toBeGreaterThanOrEqual(level.minGivens);
        if (level.needTech) {
          // それより易しい解き方だけでは解けない。
          expect(solveSudokuLogically(made.puzzle, level, level.needTech - 1).solved).toBe(false);
        }
      }
    });
  }

  it('同じ種なら同じ問題になる', () => {
    expect(makeSudoku(3, 4242).puzzle).toEqual(makeSudoku(3, 4242).puzzle);
    expect(makeSudoku(3, 4242).puzzle).not.toEqual(makeSudoku(3, 4243).puzzle);
  });

  it('やさしいは初めの数字が36以上、ふつうはそれより少ない', () => {
    const easy = makeSudoku(2, 101);
    const normal = makeSudoku(3, 101);
    expect(easy.givens).toBeGreaterThanOrEqual(36);
    expect(normal.givens).toBeLessThan(easy.givens);
  });

  it('時間の上限に届いたら、それまでで一番近い問題を返す', () => {
    let clock = 0;
    const made = makeSudoku(5, 1, { now: () => (clock += 10000), timeLimitMs: 1 });
    expect(made.attempts).toBe(1);
    expect(countSudokuSolutions(made.puzzle, sudokuLevel(5))).toBe(1);
    expect(solveSudokuLogically(made.puzzle, sudokuLevel(5), 6).solved).toBe(true);
  });

  it('画面を止めない作り方も同じ問題を返し、やめたらnull', async () => {
    const sync = makeSudoku(4, 7919);
    const asyncMade = await makeSudokuAsync(4, 7919, { yieldEvery: async () => {} });
    expect(asyncMade?.puzzle).toEqual(sync.puzzle);
    const cancelled = await makeSudokuAsync(5, 1, { yieldEvery: async () => {}, cancelled: () => true });
    expect(cancelled).toBeNull();
  });
});

describe('遊ぶ盤', () => {
  const made = makeSudoku(2, 11);
  const empty = made.puzzle.findIndex((value) => !value);
  const given = made.puzzle.findIndex((value) => value);
  const answer = made.solution[empty];
  const wrongDigit = answer === 9 ? 1 : answer + 1;

  it('初めの数字は書きかえない', () => {
    const game = createSudokuGame(made);
    expect(inputSudokuDigit(game, given, 1).event).toBe('given');
  });

  it('正しい数字を入れると、同じ行・列・枠のメモからその数字が消える', () => {
    let game = createSudokuGame(made);
    const geometry = sudokuGeometry(made);
    const peer = geometry.peers[empty].find((cell) => !made.puzzle[cell]);
    game = inputSudokuDigit(game, peer, answer, { note: true }).game;
    expect(noteDigits(game.notes[peer])).toContain(answer);
    const result = inputSudokuDigit(game, empty, answer);
    expect(result.event).toBe('placed');
    expect(noteDigits(result.game.notes[peer])).not.toContain(answer);
    expect(result.game.mistakes).toBe(0);
  });

  it('まちがいは数えて盤に残し、同じ数字をもう一度押すと消える', () => {
    let game = createSudokuGame(made);
    const result = inputSudokuDigit(game, empty, wrongDigit);
    expect(result.event).toBe('mistake');
    game = result.game;
    expect(game.mistakes).toBe(1);
    expect(isWrong(game, empty)).toBe(true);
    const erased = inputSudokuDigit(game, empty, wrongDigit);
    expect(erased.event).toBe('erased');
    expect(erased.game.values[empty]).toBe(0);
    expect(erased.game.mistakes).toBe(1);
  });

  it('メモを付け外しし、消す・戻すができる', () => {
    let game = createSudokuGame(made);
    game = inputSudokuDigit(game, empty, 3, { note: true }).game;
    game = inputSudokuDigit(game, empty, 5, { note: true }).game;
    expect(noteDigits(game.notes[empty])).toEqual([3, 5]);
    const removed = inputSudokuDigit(game, empty, 3, { note: true });
    expect(noteDigits(removed.game.notes[empty])).toEqual([5]);
    expect(undoSudoku(removed.game, removed.undo).notes[empty]).toBe(game.notes[empty]);
    const erased = eraseSudokuCell(game, empty);
    expect(erased.changed).toBe(true);
    expect(erased.game.notes[empty]).toBe(0);
    expect(eraseSudokuCell(erased.game, empty).changed).toBe(false);
    expect(eraseSudokuCell(game, given).changed).toBe(false);
  });

  it('行・列・枠がそろうと知らせ、全部そろうと解けた', () => {
    let game = createSudokuGame(made);
    const geometry = sudokuGeometry(made);
    const row = geometry.units[geometry.rowOf[empty]];
    const blanks = row.filter((cell) => !made.puzzle[cell]);
    let last = null;
    for (const cell of blanks) {
      last = inputSudokuDigit(game, cell, made.solution[cell]);
      game = last.game;
    }
    expect(last?.completed.some((unit) => unit.join() === row.join())).toBe(true);
    for (let cell = 0; cell < 81; cell += 1) {
      if (!game.values[cell]) {
        last = inputSudokuDigit(game, cell, made.solution[cell]);
        game = last.game;
      }
    }
    expect(last?.solved).toBe(true);
    expect(isSolved(game)).toBe(true);
    expect(remainingDigits(game).slice(1).every((left) => left === 0)).toBe(true);
  });

  it('数字ごとの残りは、正しく入った数を引いた数', () => {
    const game = createSudokuGame(made);
    const left = remainingDigits(game);
    const placed = (digit) => made.puzzle.filter((value) => value === digit).length;
    for (let digit = 1; digit <= 9; digit += 1) expect(left[digit]).toBe(9 - placed(digit));
  });
});

describe('ヒント', () => {
  it('まちがいがあれば、先にそのマスを言う', () => {
    const made = makeSudoku(2, 22);
    const empty = made.puzzle.findIndex((value) => !value);
    const wrong = made.solution[empty] === 9 ? 1 : made.solution[empty] + 1;
    const game = inputSudokuDigit(createSudokuGame(made), empty, wrong).game;
    const hint = sudokuHint(game);
    expect(hint?.kind).toBe('mistake');
    expect(hint?.cell).toBe(empty);
  });

  it('ヒントを入れ続けると、いつも正しい数字で最後まで解ける(むずかしいは候補を消す解き方の説明も出る)', () => {
    for (const levelId of [1, 3, 4, 5]) {
      const made = makeSudoku(levelId, SEEDS[levelId][0], { maxAttempts: 2000, timeLimitMs: 60000 });
      let game = createSudokuGame(made);
      let viaSeen = 0;
      for (let guard = 0; guard < 200; guard += 1) {
        const hint = sudokuHint(game);
        if (!hint) break;
        expect(hint.kind).toBe('step');
        if (hint.kind !== 'step') break;
        expect(game.values[hint.cell]).toBe(0);
        expect(hint.digit).toBe(made.solution[hint.cell]);
        expect(hint.text.length).toBeGreaterThan(5);
        if (hint.via) viaSeen += 1;
        game = applySudokuHint(countSudokuHint(game), hint).game;
      }
      expect(isSolved(game)).toBe(true);
      if (levelId >= 4) expect(viaSeen).toBeGreaterThan(0);
      if (levelId === 1) expect(viaSeen).toBe(0);
    }
  });
});

describe('記録と言葉', () => {
  it('時間の言葉と時計', () => {
    expect(sudokuTimeText(45)).toBe('45秒');
    expect(sudokuTimeText(754)).toBe('12分34秒');
    expect(sudokuTimeText(65)).toBe('1分05秒');
    expect(sudokuClock(754000)).toBe('12:34');
  });

  it('自己ベストの値はヒントなしで解いたときだけ', () => {
    const made = makeSudoku(4, 7919);
    const game = { ...createSudokuGame(made), elapsedMs: 600_400 };
    expect(sudokuResult(game)).toMatchObject({ value: 600, level: 4, recordId: 'sudoku-4' });
    expect(sudokuResult({ ...game, hints: 2 })).toMatchObject({ value: 0, recordId: 'sudoku-4' });
    expect(sudokuResult(game)).toMatchObject({ text: 'むずかしい 10分00秒', sub: '' });
    expect(sudokuResult({ ...game, hints: 2, mistakes: 1 }).sub).toBe('ヒント2回・まちがい1回・自己ベストはヒントなしで解いたとき');
    expect(sudokuPraise(game, 700)).toContain('1分40秒速い');
    expect(sudokuPraise({ ...game, hints: 1 }, 700)).toContain('ヒントなしで');
  });

  it('おすすめの段は、ヒントなしで解いた段の次', () => {
    expect(recommendSudokuLevel({})).toBe(1);
    expect(recommendSudokuLevel({ [sudokuRecordId(1)]: 200 })).toBe(2);
    expect(recommendSudokuLevel({ [sudokuRecordId(1)]: 200, [sudokuRecordId(3)]: 700 })).toBe(4);
    expect(recommendSudokuLevel({ [sudokuRecordId(5)]: 900 })).toBe(5);
  });
});

describe('途中の盤の保存', () => {
  it('残して読み直せる。壊れた値・答えの違う値は捨てる', () => {
    const storage = memoryStorage();
    const made = makeSudoku(1, 33);
    const empty = made.puzzle.findIndex((value) => !value);
    const game = { ...inputSudokuDigit(createSudokuGame(made), empty, made.solution[empty]).game, elapsedMs: 12345, hints: 1 };
    saveSudokuSave(storage, game);
    expect(loadSudokuSave(storage)).toEqual(game);
    const parsed = JSON.parse(storage.getItem(SUDOKU_SAVE_KEY));
    storage.setItem(SUDOKU_SAVE_KEY, JSON.stringify({ ...parsed, puzzle: parsed.puzzle.map((value, cell) => (cell === made.puzzle.findIndex(Boolean) ? (value % 6) + 1 : value)) }));
    expect(loadSudokuSave(storage)).toBeNull();
    storage.setItem(SUDOKU_SAVE_KEY, '{oops');
    expect(loadSudokuSave(storage)).toBeNull();
    storage.setItem(SUDOKU_SAVE_KEY, JSON.stringify({ ...parsed, level: 9 }));
    expect(loadSudokuSave(storage)).toBeNull();
    clearSudokuSave(storage);
    expect(loadSudokuSave(storage)).toBeNull();
  });
});
