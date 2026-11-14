// 数独(docs/brain-training-design.mdの16章)。画面に依存しない。
// 答えの盤を種つきの乱数で作り、人の解き方で解ける範囲でマスを消して問題にする。段は、解くのに要るいちばん難しい解き方で決める。
// 人の解き方で最後まで解けた問題は、答えが1つに決まる(解き方はどれも、答えになり得る盤すべてに当てはまる推論だから)。
// 答えの数を数える探索(countSudokuSolutions)は、それを確かめるための別の作り方。

import { createRng } from './ryuo-random.mjs';

/**
 * 段(16-4の表)。maxTechは使える解き方の番号の上限、minGivensは初めの数字の数の下限、needTechはそれより易しい解き方だけでは解けないこと。
 * idは記録の鍵(`sudoku-<id>`)と、段の札の順番。
 */
export const SUDOKU_LEVELS = Object.freeze([
  Object.freeze({ id: 1, key: 'mini', label: 'はじめて', sub: '6×6', size: 6, boxW: 3, boxH: 2, maxTech: 3, minGivens: 14, needTech: 0 }),
  Object.freeze({ id: 2, key: 'easy', label: 'やさしい', sub: '9×9', size: 9, boxW: 3, boxH: 3, maxTech: 3, minGivens: 36, needTech: 0 }),
  Object.freeze({ id: 3, key: 'normal', label: 'ふつう', sub: '9×9', size: 9, boxW: 3, boxH: 3, maxTech: 3, minGivens: 0, needTech: 0 }),
  Object.freeze({ id: 4, key: 'hard', label: 'むずかしい', sub: '9×9', size: 9, boxW: 3, boxH: 3, maxTech: 5, minGivens: 0, needTech: 4 }),
  Object.freeze({ id: 5, key: 'expert', label: '達人', sub: '9×9', size: 9, boxW: 3, boxH: 3, maxTech: 6, minGivens: 0, needTech: 6 }),
]);

/** 人の解き方(16-4の表)。番号が大きいほど難しい。1〜3は数字が決まる、4〜6は候補を消す。 */
export const SUDOKU_TECHS = Object.freeze({
  1: '最後の1マス',
  2: 'ここしかない',
  3: 'この数字しかない',
  4: 'しぼりこみ',
  5: 'ペア・トリプル',
  6: 'X-wing',
});

/** 作るのにかけてよい時間(ミリ秒)。超えたら、それまでで一番近い問題を使う(AGENTS.mdの「重い処理には時間の上限」)。 */
export const SUDOKU_TIME_LIMIT_MS = 4000;
/** 作っているあいだ、画面へ返す間(ミリ秒。画面が止まって見えない長さ)。 */
export const YIELD_EVERY_MS = 30;
/** 決まりに合うまで試す回数の上限(同じ種なら同じ問題になる範囲)。 */
export const SUDOKU_MAX_ATTEMPTS = 400;
/** 途中の問題の保存の鍵(16-7)。 */
export const SUDOKU_SAVE_KEY = 'yacobihime:shogi-match:brain-sudoku:v1';

export function sudokuLevel(id) {
  return SUDOKU_LEVELS.find((level) => level.id === Number(id)) ?? null;
}

// ===== 盤の形 =====

const geometryCache = new Map();
const POP = new Uint8Array(1 << 9);
for (let mask = 1; mask < POP.length; mask += 1) POP[mask] = POP[mask >> 1] + (mask & 1);

function bitOf(digit) {
  return 1 << (digit - 1);
}
/** ビットの立っている数字を小さい順に。 */
function digitsOf(mask) {
  const digits = [];
  for (let digit = 1; mask; digit += 1, mask >>= 1) if (mask & 1) digits.push(digit);
  return digits;
}
function singleDigit(mask) {
  return 31 - Math.clz32(mask) + 1;
}

/**
 * 盤の形(行・列・枠のマスの番号、マスごとの行・列・枠)。unitsは行(0〜n-1)・列(n〜2n-1)・枠(2n〜3n-1)の順。
 * @param {{ size: number, boxW: number, boxH: number }} spec
 */
export function sudokuGeometry(spec) {
  const key = `${spec.size}:${spec.boxW}:${spec.boxH}`;
  const cached = geometryCache.get(key);
  if (cached) return cached;
  const n = spec.size;
  const boxesPerRow = n / spec.boxW;
  const rowOf = [];
  const colOf = [];
  const boxOf = [];
  const units = Array.from({ length: n * 3 }, () => []);
  for (let cell = 0; cell < n * n; cell += 1) {
    const row = Math.floor(cell / n);
    const col = cell % n;
    const box = Math.floor(row / spec.boxH) * boxesPerRow + Math.floor(col / spec.boxW);
    rowOf.push(row);
    colOf.push(col);
    boxOf.push(box);
    units[row].push(cell);
    units[n + col].push(cell);
    units[2 * n + box].push(cell);
  }
  const unitsOf = rowOf.map((row, cell) => [row, n + colOf[cell], 2 * n + boxOf[cell]]);
  const peers = unitsOf.map((ids, cell) => [...new Set(ids.flatMap((id) => units[id]))].filter((peer) => peer !== cell));
  const geometry = { n, cells: n * n, all: (1 << n) - 1, boxW: spec.boxW, boxH: spec.boxH, rowOf, colOf, boxOf, units, unitsOf, peers };
  geometryCache.set(key, geometry);
  return geometry;
}

/** 行・列・枠の呼び方。 */
export function unitKind(geometry, unitId) {
  if (unitId < geometry.n) return 'row';
  if (unitId < geometry.n * 2) return 'col';
  return 'box';
}
const UNIT_WORD = { row: '行', col: '列', box: '枠' };

// ===== 答えの盤と、答えの数 =====

/**
 * 答えの数を数える(limitまで)。候補のいちばん少ないマスから試す後戻りの探索。並べ方がおかしい盤は0。
 * @param {number[]} grid 0は空き
 */
export function countSudokuSolutions(grid, spec, limit = 2) {
  const geometry = sudokuGeometry(spec);
  const { n, all, rowOf, colOf, boxOf } = geometry;
  const cells = grid.slice();
  const rowUsed = new Array(n).fill(0);
  const colUsed = new Array(n).fill(0);
  const boxUsed = new Array(n).fill(0);
  for (let cell = 0; cell < cells.length; cell += 1) {
    const digit = cells[cell];
    if (!digit) continue;
    const bit = bitOf(digit);
    if ((rowUsed[rowOf[cell]] | colUsed[colOf[cell]] | boxUsed[boxOf[cell]]) & bit) return 0;
    rowUsed[rowOf[cell]] |= bit;
    colUsed[colOf[cell]] |= bit;
    boxUsed[boxOf[cell]] |= bit;
  }
  let count = 0;
  const search = () => {
    let best = -1;
    let bestMask = 0;
    let bestCount = 99;
    for (let cell = 0; cell < cells.length; cell += 1) {
      if (cells[cell]) continue;
      const mask = all & ~(rowUsed[rowOf[cell]] | colUsed[colOf[cell]] | boxUsed[boxOf[cell]]);
      const size = POP[mask];
      if (!size) return;
      if (size < bestCount) {
        best = cell;
        bestMask = mask;
        bestCount = size;
        if (size === 1) break;
      }
    }
    if (best < 0) {
      count += 1;
      return;
    }
    for (const digit of digitsOf(bestMask)) {
      const bit = bitOf(digit);
      cells[best] = digit;
      rowUsed[rowOf[best]] |= bit;
      colUsed[colOf[best]] |= bit;
      boxUsed[boxOf[best]] |= bit;
      search();
      cells[best] = 0;
      rowUsed[rowOf[best]] &= ~bit;
      colUsed[colOf[best]] &= ~bit;
      boxUsed[boxOf[best]] &= ~bit;
      if (count >= limit) return;
    }
  };
  search();
  return count;
}

function shuffle(rng, list) {
  const copy = list.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(rng.next() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

/** 種つきの乱数で、すべてのマスが埋まった答えの盤を作る。 */
export function makeSudokuSolution(rng, spec) {
  const geometry = sudokuGeometry(spec);
  const { n, all, rowOf, colOf, boxOf } = geometry;
  const cells = new Array(n * n).fill(0);
  const rowUsed = new Array(n).fill(0);
  const colUsed = new Array(n).fill(0);
  const boxUsed = new Array(n).fill(0);
  const fill = () => {
    let best = -1;
    let bestMask = 0;
    let bestCount = 99;
    for (let cell = 0; cell < cells.length; cell += 1) {
      if (cells[cell]) continue;
      const mask = all & ~(rowUsed[rowOf[cell]] | colUsed[colOf[cell]] | boxUsed[boxOf[cell]]);
      const size = POP[mask];
      if (!size) return false;
      if (size < bestCount) {
        best = cell;
        bestMask = mask;
        bestCount = size;
      }
    }
    if (best < 0) return true;
    for (const digit of shuffle(rng, digitsOf(bestMask))) {
      const bit = bitOf(digit);
      cells[best] = digit;
      rowUsed[rowOf[best]] |= bit;
      colUsed[colOf[best]] |= bit;
      boxUsed[boxOf[best]] |= bit;
      if (fill()) return true;
      cells[best] = 0;
      rowUsed[rowOf[best]] &= ~bit;
      colUsed[colOf[best]] &= ~bit;
      boxUsed[boxOf[best]] &= ~bit;
    }
    return false;
  };
  fill();
  return cells;
}

// ===== 人の解き方 =====

/** 盤から、解き方の状態(数字と候補)を作る。並べ方がおかしい(同じ数字が重なる)ならnull。 */
function initState(grid, geometry) {
  const values = grid.slice();
  const cand = new Array(geometry.cells).fill(0);
  for (let cell = 0; cell < geometry.cells; cell += 1) {
    if (values[cell]) continue;
    let used = 0;
    for (const peer of geometry.peers[cell]) if (values[peer]) used |= bitOf(values[peer]);
    cand[cell] = geometry.all & ~used;
  }
  for (let cell = 0; cell < geometry.cells; cell += 1) {
    if (!values[cell]) continue;
    for (const peer of geometry.peers[cell]) if (values[peer] === values[cell]) return null;
  }
  return { values, cand };
}

function placeDigit(state, geometry, cell, digit) {
  state.values[cell] = digit;
  state.cand[cell] = 0;
  const bit = bitOf(digit);
  for (const peer of geometry.peers[cell]) state.cand[peer] &= ~bit;
}

/** ヒントで先に見せる順(枠→行→列。枠がいちばん見つけやすい)。 */
function unitOrderOf(geometry) {
  if (geometry.order) return geometry.order;
  const { n } = geometry;
  const ids = [];
  for (let index = 0; index < n; index += 1) ids.push(2 * n + index);
  for (let index = 0; index < n * 2; index += 1) ids.push(index);
  geometry.order = ids;
  return ids;
}

// 解き方の探索は、作るときに何千回も呼ぶ。配列を作らず、ビットで数える(作る時間の大半がここ。16-4の時間の上限)。

function fullHouse(state, geometry) {
  const { values, cand } = state;
  for (const unitId of unitOrderOf(geometry)) {
    let empty = -1;
    let count = 0;
    let used = 0;
    for (const cell of geometry.units[unitId]) {
      if (values[cell]) used |= 1 << (values[cell] - 1);
      else {
        empty = cell;
        count += 1;
      }
    }
    if (count !== 1) continue;
    const missing = geometry.all & ~used;
    if (POP[missing] !== 1 || !(cand[empty] & missing)) continue;
    return { tech: 1, cell: empty, digit: singleDigit(missing), unit: unitId };
  }
  return null;
}

function hiddenSingle(state, geometry) {
  const { values, cand } = state;
  for (const unitId of unitOrderOf(geometry)) {
    const unit = geometry.units[unitId];
    let placed = 0;
    let once = 0;
    let twice = 0;
    for (const cell of unit) {
      const value = values[cell];
      if (value) {
        placed |= 1 << (value - 1);
        continue;
      }
      const mask = cand[cell];
      twice |= once & mask;
      once |= mask;
    }
    const single = once & ~twice & ~placed;
    if (!single) continue;
    const bit = single & -single;
    for (const cell of unit) if (cand[cell] & bit) return { tech: 2, cell, digit: singleDigit(bit), unit: unitId };
  }
  return null;
}

function nakedSingle(state, geometry) {
  const { values, cand } = state;
  for (let cell = 0; cell < geometry.cells; cell += 1) {
    if (!values[cell] && POP[cand[cell]] === 1) return { tech: 3, cell, digit: singleDigit(cand[cell]), unit: null };
  }
  return null;
}

/** 行・列・枠の、その数字の候補があるマス(見つけたときだけ配列にする)。 */
function positions(state, unit, bit) {
  const cells = [];
  for (const cell of unit) if (state.cand[cell] & bit) cells.push(cell);
  return cells;
}

/** unitのうちskipでないマスから、その数字の候補を消す手順。消すものがなければnull。 */
function eliminateIn(state, unit, bit, skip) {
  let found = false;
  for (const cell of unit) {
    if ((state.cand[cell] & bit) && !skip(cell)) {
      found = true;
      break;
    }
  }
  if (!found) return null;
  const digit = singleDigit(bit);
  return unit.filter((cell) => (state.cand[cell] & bit) && !skip(cell)).map((cell) => ({ cell, digit }));
}

function lockedCandidates(state, geometry) {
  const { n, rowOf, colOf, boxOf, units } = geometry;
  const { cand } = state;
  // 枠の中で1つの行(列)に並ぶ → その行(列)の枠の外から消す(pointing)。
  for (let box = 0; box < n; box += 1) {
    const unit = units[2 * n + box];
    for (let digit = 1; digit <= n; digit += 1) {
      const bit = 1 << (digit - 1);
      let count = 0;
      let row = -1;
      let col = -1;
      let sameRow = true;
      let sameCol = true;
      for (const cell of unit) {
        if (!(cand[cell] & bit)) continue;
        if (count === 0) {
          row = rowOf[cell];
          col = colOf[cell];
        } else {
          if (rowOf[cell] !== row) sameRow = false;
          if (colOf[cell] !== col) sameCol = false;
        }
        count += 1;
      }
      if (count < 2) continue;
      for (const lineId of [sameRow ? row : -1, sameCol ? n + col : -1]) {
        if (lineId < 0) continue;
        const eliminations = eliminateIn(state, units[lineId], bit, (cell) => boxOf[cell] === box);
        if (eliminations) return { tech: 4, kind: 'pointing', eliminations, pattern: positions(state, unit, bit), digit, unit: 2 * n + box, line: lineId };
      }
    }
  }
  // 行(列)の中で1つの枠にだけある → 枠のほかのマスから消す(claiming)。
  for (let lineId = 0; lineId < n * 2; lineId += 1) {
    const unit = units[lineId];
    for (let digit = 1; digit <= n; digit += 1) {
      const bit = 1 << (digit - 1);
      let count = 0;
      let box = -1;
      let same = true;
      for (const cell of unit) {
        if (!(cand[cell] & bit)) continue;
        if (count === 0) box = boxOf[cell];
        else if (boxOf[cell] !== box) same = false;
        count += 1;
      }
      if (count < 2 || !same) continue;
      const isLine = lineId < n ? (cell) => rowOf[cell] === lineId : (cell) => colOf[cell] === lineId - n;
      const eliminations = eliminateIn(state, units[2 * n + box], bit, isLine);
      if (eliminations) return { tech: 4, kind: 'claiming', eliminations, pattern: positions(state, unit, bit), digit, unit: lineId, line: 2 * n + box };
    }
  }
  return null;
}

const scratchCells = new Int32Array(9);
const scratchPos = new Int32Array(10);

function nakedSubset(state, geometry, unitId, size) {
  const unit = geometry.units[unitId];
  const { values, cand } = state;
  let emptyCount = 0;
  let small = 0;
  for (const cell of unit) {
    if (values[cell]) continue;
    emptyCount += 1;
    if (POP[cand[cell]] <= size) scratchCells[small++] = cell;
  }
  if (emptyCount <= size || small < size) return null;
  const tryGroup = (group, union) => {
    if (POP[union] !== size) return null;
    let found = false;
    for (const cell of unit) if (!values[cell] && !group.includes(cell) && (cand[cell] & union)) found = true;
    if (!found) return null;
    const digits = digitsOf(union);
    const eliminations = [];
    for (const cell of unit) {
      if (values[cell] || group.includes(cell)) continue;
      for (const digit of digits) if (cand[cell] & (1 << (digit - 1))) eliminations.push({ cell, digit });
    }
    return { tech: 5, kind: size === 2 ? 'naked-pair' : 'naked-triple', eliminations, pattern: group, digits, unit: unitId };
  };
  for (let a = 0; a < small; a += 1) {
    for (let b = a + 1; b < small; b += 1) {
      const ab = cand[scratchCells[a]] | cand[scratchCells[b]];
      if (size === 2) {
        const step = POP[ab] === 2 ? tryGroup([scratchCells[a], scratchCells[b]], ab) : null;
        if (step) return step;
        continue;
      }
      if (POP[ab] > 3) continue;
      for (let c = b + 1; c < small; c += 1) {
        const abc = ab | cand[scratchCells[c]];
        if (POP[abc] !== 3) continue;
        const step = tryGroup([scratchCells[a], scratchCells[b], scratchCells[c]], abc);
        if (step) return step;
      }
    }
  }
  return null;
}

function hiddenSubset(state, geometry, unitId, size) {
  const unit = geometry.units[unitId];
  const { values, cand } = state;
  const n = geometry.n;
  scratchPos.fill(0);
  let placed = 0;
  let empty = 0;
  unit.forEach((cell, index) => {
    if (values[cell]) {
      placed |= 1 << (values[cell] - 1);
      return;
    }
    empty += 1;
    for (let digit = 1; digit <= n; digit += 1) if (cand[cell] & (1 << (digit - 1))) scratchPos[digit] |= 1 << index;
  });
  if (empty <= size) return null;
  const digits = [];
  for (let digit = 1; digit <= n; digit += 1) if (!(placed & (1 << (digit - 1))) && scratchPos[digit] && POP[scratchPos[digit]] <= size) digits.push(digit);
  const tryGroup = (group, where) => {
    if (POP[where] !== size) return null;
    const keep = group.reduce((mask, digit) => mask | (1 << (digit - 1)), 0);
    const cells = unit.filter((_, index) => where & (1 << index));
    const eliminations = cells.flatMap((cell) => digitsOf(cand[cell] & ~keep).map((digit) => ({ cell, digit })));
    if (!eliminations.length) return null;
    return { tech: 5, kind: size === 2 ? 'hidden-pair' : 'hidden-triple', eliminations, pattern: cells, digits: group, unit: unitId };
  };
  for (let a = 0; a < digits.length; a += 1) {
    for (let b = a + 1; b < digits.length; b += 1) {
      const ab = scratchPos[digits[a]] | scratchPos[digits[b]];
      if (size === 2) {
        const step = tryGroup([digits[a], digits[b]], ab);
        if (step) return step;
        continue;
      }
      if (POP[ab] > 3) continue;
      for (let c = b + 1; c < digits.length; c += 1) {
        const step = tryGroup([digits[a], digits[b], digits[c]], ab | scratchPos[digits[c]]);
        if (step) return step;
      }
    }
  }
  return null;
}

function subsets(state, geometry) {
  const order = unitOrderOf(geometry);
  for (const size of [2, 3]) {
    for (const unitId of order) {
      const step = nakedSubset(state, geometry, unitId, size) ?? hiddenSubset(state, geometry, unitId, size);
      if (step) return step;
    }
  }
  return null;
}

function xWing(state, geometry) {
  const { n, units, rowOf, colOf } = geometry;
  const { cand } = state;
  const masks = new Int32Array(n);
  for (let digit = 1; digit <= n; digit += 1) {
    const bit = 1 << (digit - 1);
    for (const base of ['row', 'col']) {
      // 行(列)ごとの、その数字の候補がある列(行)のビット。
      for (let index = 0; index < n; index += 1) {
        let mask = 0;
        for (const cell of units[base === 'row' ? index : n + index]) if (cand[cell] & bit) mask |= 1 << (base === 'row' ? colOf[cell] : rowOf[cell]);
        masks[index] = POP[mask] === 2 ? mask : 0;
      }
      for (let a = 0; a < n; a += 1) {
        if (!masks[a]) continue;
        for (let b = a + 1; b < n; b += 1) {
          if (masks[b] !== masks[a]) continue;
          const cross = digitsOf(masks[a]).map((value) => value - 1);
          const lines = [base === 'row' ? a : n + a, base === 'row' ? b : n + b];
          const covers = cross.map((index) => (base === 'row' ? n + index : index));
          const inLines = base === 'row' ? (cell) => rowOf[cell] === a || rowOf[cell] === b : (cell) => colOf[cell] === a || colOf[cell] === b;
          const eliminations = covers.flatMap((unitId) => eliminateIn(state, units[unitId], bit, inLines) ?? []);
          if (!eliminations.length) continue;
          const pattern = lines.flatMap((unitId) => positions(state, units[unitId], bit));
          return { tech: 6, kind: base === 'row' ? 'x-wing-row' : 'x-wing-col', eliminations, pattern, digit, unit: lines[0], units: lines, covers };
        }
      }
    }
  }
  return null;
}

const FINDERS = [null, fullHouse, hiddenSingle, nakedSingle, lockedCandidates, subsets, xWing];

/** いちばん易しい次の1手(数字が決まる、か、候補が消える)。 */
function findStep(state, geometry, maxTech, minTech = 1) {
  for (let tech = minTech; tech <= maxTech; tech += 1) {
    const step = FINDERS[tech](state, geometry);
    if (step) return step;
  }
  return null;
}

function applyStep(state, geometry, step) {
  if (step.tech <= 3) placeDigit(state, geometry, step.cell, step.digit);
  else for (const { cell, digit } of step.eliminations) state.cand[cell] &= ~bitOf(digit);
}

/** 決まるマスを、まとめて入れる(ここしかない・この数字しかない)。入れた数。こわれた(候補のないマス)なら-1。 */
function placeSingles(state, geometry, counts) {
  const { values, cand } = state;
  let placedTotal = 0;
  for (;;) {
    let placed = 0;
    for (let cell = 0; cell < geometry.cells; cell += 1) {
      if (values[cell]) continue;
      const mask = cand[cell];
      if (!mask) return -1;
      if (POP[mask] === 1) {
        placeDigit(state, geometry, cell, singleDigit(mask));
        counts[3] = (counts[3] ?? 0) + 1;
        placed += 1;
      }
    }
    for (const unit of geometry.units) {
      let once = 0;
      let twice = 0;
      let placedMask = 0;
      for (const cell of unit) {
        if (values[cell]) {
          placedMask |= 1 << (values[cell] - 1);
          continue;
        }
        twice |= once & cand[cell];
        once |= cand[cell];
      }
      if ((once | placedMask) !== geometry.all) return -1;
      let single = once & ~twice & ~placedMask;
      while (single) {
        const bit = single & -single;
        single &= single - 1;
        for (const cell of unit) {
          if (!values[cell] && (cand[cell] & bit)) {
            placeDigit(state, geometry, cell, singleDigit(bit));
            counts[2] = (counts[2] ?? 0) + 1;
            placed += 1;
            break;
          }
        }
      }
    }
    placedTotal += placed;
    if (!placed) return placedTotal;
  }
}

/**
 * 人の解き方だけで解く。数字が決まるマス(解き方1〜3)を先にまとめて入れ、行き詰まったら候補を消す解き方を易しい順に1つ使う。
 * hardestは使った解き方のいちばん難しい番号(1〜3は区別しないので、数字が決まるだけなら3以下。段の決まりは4以上だけを見る)。
 * @returns {{ solved: boolean, hardest: number, counts: Record<number, number>, values: number[] }}
 */
export function solveSudokuLogically(grid, spec, maxTech = 6) {
  const geometry = sudokuGeometry(spec);
  const state = initState(grid, geometry);
  const counts = {};
  if (!state) return { solved: false, hardest: 0, counts, values: grid.slice() };
  let hardest = 0;
  for (;;) {
    const placed = placeSingles(state, geometry, counts);
    if (placed < 0) return { solved: false, hardest, counts, values: state.values };
    if (placed > 0) hardest = Math.max(hardest, counts[3] ? 3 : 2);
    if (!state.values.includes(0)) return { solved: true, hardest, counts, values: state.values };
    const step = maxTech >= 4 ? findStep(state, geometry, maxTech, 4) : null;
    if (!step) return { solved: false, hardest, counts, values: state.values };
    applyStep(state, geometry, step);
    hardest = Math.max(hardest, step.tech);
    counts[step.tech] = (counts[step.tech] ?? 0) + 1;
  }
}

// ===== 問題を作る =====

/** 消す順(9×9も6×6も、点対称の2マスずつ。真ん中のマスは1つ)。 */
function removalOrder(rng, geometry) {
  const seen = new Set();
  const pairs = [];
  for (let cell = 0; cell < geometry.cells; cell += 1) {
    if (seen.has(cell)) continue;
    const mirror = geometry.cells - 1 - cell;
    seen.add(cell);
    seen.add(mirror);
    pairs.push(cell === mirror ? [cell] : [cell, mirror]);
  }
  return shuffle(rng, pairs);
}

/** 1回分の問題(答えの盤を作り、段の解き方で解ける範囲で消す)。 */
function attempt(rng, level) {
  const geometry = sudokuGeometry(level);
  const solution = makeSudokuSolution(rng, level);
  const puzzle = solution.slice();
  let givens = geometry.cells;
  for (const pair of removalOrder(rng, geometry)) {
    if (givens - pair.length < level.minGivens) continue;
    for (const cell of pair) puzzle[cell] = 0;
    // 易しい解き方だけで解けるなら、難しい解き方を試すまでもない(作る時間を短くする)。
    if (solveSudokuLogically(puzzle, level, Math.min(3, level.maxTech)).solved || (level.maxTech > 3 && solveSudokuLogically(puzzle, level, level.maxTech).solved)) {
      givens -= pair.length;
    } else {
      for (const cell of pair) puzzle[cell] = solution[cell];
    }
  }
  let grade = solveSudokuLogically(puzzle, level, level.maxTech);
  // むずかしいで決まりに届かないときは、点対称をくずして1マスずつ消してみる(しぼりこみ・ペアが要る問題が見つかりやすい)。
  // 達人(X-wing)では見つかりやすさが変わらず時間だけかかるので、しない。
  if (grade.hardest < level.needTech && level.needTech <= 5) {
    for (const cell of shuffle(rng, puzzle.map((value, index) => (value ? index : -1)).filter((index) => index >= 0))) {
      if (givens - 1 < level.minGivens) break;
      puzzle[cell] = 0;
      const tried = solveSudokuLogically(puzzle, level, level.maxTech);
      if (!tried.solved) {
        puzzle[cell] = solution[cell];
        continue;
      }
      givens -= 1;
      grade = tried;
      if (grade.hardest >= level.needTech) break;
    }
  }
  return { puzzle, solution, givens, hardest: grade.hardest, counts: grade.counts };
}

/** 段の決まりにどれだけ近いか(大きいほど近い)。決まりに合えばInfinity。 */
function fitness(level, candidate) {
  if (candidate.hardest >= level.needTech) return Infinity;
  const counts = candidate.counts;
  // 達人で見つからないときは、5を何回も使う問題を近いとする(16-4の表)。
  return candidate.hardest * 1000 + (counts[5] ?? 0) * 20 + (counts[4] ?? 0) * 5 - candidate.givens;
}

function finished(level, seed, best, attempts) {
  return {
    level: level.id,
    seed,
    size: level.size,
    boxW: level.boxW,
    boxH: level.boxH,
    puzzle: best.puzzle,
    solution: best.solution,
    givens: best.givens,
    hardest: best.hardest,
    counts: best.counts,
    attempts,
    fits: best.hardest >= level.needTech,
  };
}

/**
 * 段に合う問題を作る(同期)。決まりに合うまで試し、上限(回数・時間)に届いたら一番近い問題を返す。
 * @param {number} levelId
 * @param {number} seed
 * @param {{ maxAttempts?: number, timeLimitMs?: number, now?: () => number }} [options]
 */
export function makeSudoku(levelId, seed, options = {}) {
  const level = sudokuLevel(levelId) ?? SUDOKU_LEVELS[0];
  const { maxAttempts = SUDOKU_MAX_ATTEMPTS, timeLimitMs = SUDOKU_TIME_LIMIT_MS, now = () => Date.now() } = options;
  const rng = createRng(seed);
  const started = now();
  let best = null;
  let bestFit = -Infinity;
  let attempts = 0;
  while (attempts < maxAttempts) {
    attempts += 1;
    const candidate = attempt(rng, level);
    const fit = fitness(level, candidate);
    if (fit > bestFit) {
      best = candidate;
      bestFit = fit;
    }
    if (fit === Infinity || now() - started > timeLimitMs) break;
  }
  return finished(level, seed, best, attempts);
}

/**
 * 段に合う問題を作る(画面を止めない)。1回試すごとに画面へ返す。cancelledが真になったらnull。
 * @param {number} levelId
 * @param {number} seed
 * @param {{ maxAttempts?: number, timeLimitMs?: number, now?: () => number, yieldEvery?: () => Promise<void>, cancelled?: () => boolean }} [options]
 */
export async function makeSudokuAsync(levelId, seed, options = {}) {
  const level = sudokuLevel(levelId) ?? SUDOKU_LEVELS[0];
  const {
    maxAttempts = SUDOKU_MAX_ATTEMPTS,
    timeLimitMs = SUDOKU_TIME_LIMIT_MS,
    now = () => Date.now(),
    yieldEvery = () => new Promise((resolve) => setTimeout(resolve, 0)),
    cancelled = () => false,
  } = options;
  const rng = createRng(seed);
  const started = now();
  let best = null;
  let bestFit = -Infinity;
  let attempts = 0;
  let lastYield = started;
  while (attempts < maxAttempts) {
    attempts += 1;
    const candidate = attempt(rng, level);
    const fit = fitness(level, candidate);
    if (fit > bestFit) {
      best = candidate;
      bestFit = fit;
    }
    if (fit === Infinity || now() - started > timeLimitMs) break;
    // 1回ずつ返すと、ブラウザのsetTimeoutの待ち(4ミリ秒ほど)が回数分たまる。画面に返すのは約30ミリ秒に1回。
    if (now() - lastYield >= YIELD_EVERY_MS) {
      await yieldEvery();
      lastYield = now();
      if (cancelled()) return null;
    }
  }
  if (cancelled()) return null;
  return finished(level, seed, best, attempts);
}

// ===== 遊んでいる盤 =====

/**
 * 作った問題から、遊ぶ盤を作る。valuesは今の数字(初めの数字を含む)、notesはマスごとのメモ(ビット)。
 * @param {ReturnType<typeof makeSudoku>} made
 */
export function createSudokuGame(made) {
  return {
    version: 1,
    level: made.level,
    seed: made.seed,
    size: made.size,
    boxW: made.boxW,
    boxH: made.boxH,
    puzzle: made.puzzle.slice(),
    solution: made.solution.slice(),
    values: made.puzzle.slice(),
    notes: new Array(made.puzzle.length).fill(0),
    elapsedMs: 0,
    hints: 0,
    mistakes: 0,
  };
}

function specOf(game) {
  return { size: game.size, boxW: game.boxW, boxH: game.boxH };
}

/** その数字が、答えと同じか。 */
export function isWrong(game, cell) {
  return Boolean(game.values[cell]) && game.values[cell] !== game.solution[cell];
}

export function isSolved(game) {
  return game.values.every((value, cell) => value === game.solution[cell]);
}

/** 数字ごとの残り(正しく入った数を引いた数)。添字0は使わない。 */
export function remainingDigits(game) {
  const left = new Array(game.size + 1).fill(game.size);
  left[0] = 0;
  game.values.forEach((value, cell) => {
    if (value && value === game.solution[cell]) left[value] -= 1;
  });
  return left;
}

/** 今の盤で、正しくそろっている行・列・枠。 */
function completeUnits(game) {
  const geometry = sudokuGeometry(specOf(game));
  return geometry.units.map((unit, id) => (unit.every((cell) => game.values[cell] && game.values[cell] === game.solution[cell]) ? id : -1)).filter((id) => id >= 0);
}

function snapshot(game) {
  return { values: game.values.slice(), notes: game.notes.slice() };
}

/**
 * 数字を入れる(メモのときは候補を付ける・外す)。同じ数字をもう一度入れると消す。初めの数字は書きかえない。
 * 正しい数字を入れたら、同じ行・列・枠のメモからその数字を消す(16-6)。まちがいは数だけ数え、盤には残す(朱で見せる)。
 * @returns {{ game: object, event: 'given' | 'placed' | 'erased' | 'mistake' | 'note' | 'none', completed: number[][], solved: boolean, undo: object | null }}
 */
export function inputSudokuDigit(game, cell, digit, { note = false } = {}) {
  const none = { game, event: /** @type {const} */ ('none'), completed: [], solved: false, undo: null };
  if (!(cell >= 0 && cell < game.values.length) || !(digit >= 1 && digit <= game.size)) return none;
  if (game.puzzle[cell]) return { ...none, event: 'given' };
  const undo = snapshot(game);
  const next = { ...game, values: game.values.slice(), notes: game.notes.slice() };
  if (note) {
    if (next.values[cell]) return none;
    next.notes[cell] ^= bitOf(digit);
    return { game: next, event: 'note', completed: [], solved: false, undo };
  }
  if (next.values[cell] === digit) {
    next.values[cell] = 0;
    return { game: next, event: 'erased', completed: [], solved: false, undo };
  }
  const before = new Set(completeUnits(game));
  next.values[cell] = digit;
  next.notes[cell] = 0;
  if (digit !== game.solution[cell]) {
    next.mistakes = game.mistakes + 1;
    return { game: next, event: 'mistake', completed: [], solved: false, undo };
  }
  const geometry = sudokuGeometry(specOf(game));
  const bit = bitOf(digit);
  for (const peer of geometry.peers[cell]) next.notes[peer] &= ~bit;
  const completed = completeUnits(next).filter((id) => !before.has(id)).map((id) => geometry.units[id]);
  return { game: next, event: 'placed', completed, solved: isSolved(next), undo };
}

/** そのマスの数字とメモを消す。 */
export function eraseSudokuCell(game, cell) {
  if (!(cell >= 0 && cell < game.values.length) || game.puzzle[cell] || (!game.values[cell] && !game.notes[cell])) return { game, changed: false, undo: null };
  const undo = snapshot(game);
  const next = { ...game, values: game.values.slice(), notes: game.notes.slice() };
  next.values[cell] = 0;
  next.notes[cell] = 0;
  return { game: next, changed: true, undo };
}

/** 戻す(入れる前の数字とメモに)。数えたヒント・まちがい・時間は戻さない。 */
export function undoSudoku(game, undo) {
  if (!undo) return game;
  return { ...game, values: undo.values.slice(), notes: undo.notes.slice() };
}

/** メモのビットから、数字の並び(画面の小さな数字)。 */
export function noteDigits(mask) {
  return digitsOf(mask);
}

// ===== ヒント =====

function cellName(geometry, cell) {
  return `${geometry.rowOf[cell] + 1}行${geometry.colOf[cell] + 1}列`;
}
function unitWord(geometry, unitId) {
  return `この${UNIT_WORD[unitKind(geometry, unitId)]}`;
}

/** 解き方の言葉(16-5)。stepは数字が決まる手順。viaは、その前に使った候補を消す手順。 */
function hintText(geometry, step, via) {
  let main;
  if (step.tech === 1) main = `${unitWord(geometry, step.unit)}で空いているのはここだけ。入るのは${step.digit}だよ。`;
  else if (step.tech === 2) main = `${unitWord(geometry, step.unit)}で、${step.digit}が入れるのはここだけだよ。`;
  else main = `このマスに入れる数字は、${step.digit}しか残っていないよ。`;
  if (!via) return main;
  const digits = (via.digits ?? []).join('と');
  let reason = '';
  if (via.kind === 'pointing') reason = `この枠の${via.digit}は、この${UNIT_WORD[unitKind(geometry, via.line)]}のどれか。だから${UNIT_WORD[unitKind(geometry, via.line)]}のほかのマスに${via.digit}は入らない。`;
  else if (via.kind === 'claiming') reason = `${unitWord(geometry, via.unit)}の${via.digit}は、この枠のどれか。だから枠のほかのマスに${via.digit}は入らない。`;
  else if (via.kind === 'naked-pair' || via.kind === 'naked-triple') reason = `光った${via.pattern.length}マスには${digits}しか入らない。だから${unitWord(geometry, via.unit)}のほかのマスに${digits}は入らない。`;
  else if (via.kind === 'hidden-pair' || via.kind === 'hidden-triple') reason = `${digits}が入れるのは、${unitWord(geometry, via.unit)}の光った${via.pattern.length}マスだけ。だからそのマスには、ほかの数字は入らない。`;
  else reason = `${via.digit}は、2つの${via.kind === 'x-wing-row' ? '行' : '列'}で同じ2つの${via.kind === 'x-wing-row' ? '列' : '行'}にしか入らない。だからその${via.kind === 'x-wing-row' ? '列' : '行'}のほかのマスに${via.digit}は入らない。`;
  return `${SUDOKU_TECHS[via.tech]}：${reason}すると、${main}`;
}

/**
 * 次のヒント(16-5)。まちがった数字があれば、先にそれ。なければ、次に入れられる1マスを、いちばん易しい解き方で。
 * 候補を消す解き方が要るときは、その最初の手順も返す(via)。メモは使わない(盤の数字だけから考える)。
 * @returns {{ kind: 'mistake', cell: number, text: string } | { kind: 'step', tech: number, techName: string, cell: number, digit: number, unitCells: number[], via: object | null, patternCells: number[], eliminationCells: number[], text: string } | null}
 */
export function sudokuHint(game) {
  const geometry = sudokuGeometry(specOf(game));
  const wrong = game.values.findIndex((value, cell) => value && value !== game.solution[cell]);
  if (wrong >= 0) return { kind: 'mistake', cell: wrong, text: `${cellName(geometry, wrong)}の数字が、答えとちがうみたい。消してから考えてみて。` };
  if (isSolved(game)) return null;
  const state = initState(game.values, geometry);
  if (!state) return null;
  let via = null;
  for (let guard = 0; guard < 200; guard += 1) {
    const step = findStep(state, geometry, 6);
    if (!step) break;
    if (step.tech <= 3) {
      const unitCells = step.unit === null ? geometry.peers[step.cell].concat(step.cell) : geometry.units[step.unit];
      return {
        kind: 'step',
        tech: via ? via.tech : step.tech,
        techName: SUDOKU_TECHS[via ? via.tech : step.tech],
        cell: step.cell,
        digit: step.digit,
        unitCells,
        via,
        patternCells: via ? via.pattern : [],
        eliminationCells: via ? [...new Set(via.eliminations.map(({ cell }) => cell))] : [],
        text: hintText(geometry, step, via),
      };
    }
    if (!via) via = step;
    applyStep(state, geometry, step);
  }
  // 解き方6でも見つからない(作った問題では起きない)。答えのマスを1つ教える。
  const cell = game.values.findIndex((value) => !value);
  return {
    kind: 'step', tech: 0, techName: '', cell, digit: game.solution[cell], unitCells: [cell], via: null, patternCells: [], eliminationCells: [],
    text: `${cellName(geometry, cell)}には${game.solution[cell]}が入るよ。`,
  };
}

/** ヒントで数字を入れる(ヒントの回数は、ヒントを出したときに数える)。 */
export function applySudokuHint(game, hint) {
  if (!hint || hint.kind !== 'step') return { game, event: 'none', completed: [], solved: false, undo: null };
  return inputSudokuDigit(game, hint.cell, hint.digit);
}

/** ヒントを出した回数を数える。 */
export function countSudokuHint(game) {
  return { ...game, hints: game.hints + 1 };
}

// ===== 記録と言葉 =====

/** 時間の言葉(「12分34秒」「45秒」)。 */
export function sudokuTimeText(seconds) {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  if (minutes >= 60) return `${Math.floor(minutes / 60)}時間${minutes % 60}分${rest}秒`;
  return minutes ? `${minutes}分${String(rest).padStart(2, '0')}秒` : `${rest}秒`;
}

/** 時計の表示(「12:34」)。 */
export function sudokuClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** 記録の鍵(段ごと)。 */
export function sudokuRecordId(levelId) {
  return `sudoku-${levelId}`;
}

/**
 * 解けたときの記録(道場のfinishの形)。自己ベストの値(秒)は、ヒントなしで解いたときだけ(16-2)。
 * @param {ReturnType<typeof createSudokuGame>} game
 */
export function sudokuResult(game) {
  const level = sudokuLevel(game.level) ?? SUDOKU_LEVELS[0];
  const seconds = Math.max(1, Math.round(game.elapsedMs / 1000));
  const notes = [];
  if (game.hints) notes.push(`ヒント${game.hints}回`);
  if (game.mistakes) notes.push(`まちがい${game.mistakes}回`);
  if (game.hints) notes.push('自己ベストはヒントなしで解いたとき');
  return {
    value: game.hints ? 0 : seconds,
    level: level.id,
    correct: 0,
    total: 0,
    recordId: sudokuRecordId(level.id),
    // 成績表の行は短く(段と時間)。ヒントとまちがいの回数は下の小さな行(sub)へ。
    text: `${level.label} ${sudokuTimeText(seconds)}`,
    sub: notes.join('・'),
  };
}

/** ほめる一言(解けたとき。何ができたかを数で言う。D:5-4)。 */
export function sudokuPraise(game, previousBest) {
  const level = sudokuLevel(game.level) ?? SUDOKU_LEVELS[0];
  const seconds = Math.max(1, Math.round(game.elapsedMs / 1000));
  if (game.hints) return `${level.label}をクリア！ ${sudokuTimeText(seconds)}。次はヒントなしで挑戦してみよう。`;
  if (previousBest && seconds < previousBest) return `${level.label}を${sudokuTimeText(seconds)}！ 前より${sudokuTimeText(previousBest - seconds)}速い。`;
  return `ヒントなしで、${level.label}を${sudokuTimeText(seconds)}！`;
}

/**
 * おすすめの段(段の札の「おすすめ」)。自己ベスト(ヒントなしでクリア)のある段の、次の段。何もなければ「はじめて」。
 * @param {Record<string, number>} best 道場の自己ベスト
 */
export function recommendSudokuLevel(best) {
  let cleared = 0;
  for (const level of SUDOKU_LEVELS) if (Number.isFinite(best?.[sudokuRecordId(level.id)]) && best[sudokuRecordId(level.id)] > 0) cleared = level.id;
  return Math.min(SUDOKU_LEVELS.length, cleared + 1);
}

// ===== 保存 =====

function validDigits(list, length, max, allowZero) {
  return Array.isArray(list) && list.length === length && list.every((value) => Number.isInteger(value) && value >= (allowZero ? 0 : 1) && value <= max);
}

/** 途中の盤を読む。形が違う・答えが壊れている値は捨てる(null)。 */
export function loadSudokuSave(storage) {
  let parsed = null;
  try {
    parsed = JSON.parse(storage?.getItem(SUDOKU_SAVE_KEY) ?? 'null');
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) return null;
  const level = sudokuLevel(parsed.level);
  if (!level || parsed.size !== level.size || parsed.boxW !== level.boxW || parsed.boxH !== level.boxH) return null;
  const cells = level.size * level.size;
  if (!validDigits(parsed.solution, cells, level.size, false) || !validDigits(parsed.puzzle, cells, level.size, true) || !validDigits(parsed.values, cells, level.size, true)) return null;
  if (!Array.isArray(parsed.notes) || parsed.notes.length !== cells || !parsed.notes.every((mask) => Number.isInteger(mask) && mask >= 0 && mask < (1 << level.size))) return null;
  if (countSudokuSolutions(parsed.solution, level, 2) !== 1) return null;
  if (parsed.puzzle.some((value, cell) => value && value !== parsed.solution[cell])) return null;
  if (parsed.values.some((value, cell) => parsed.puzzle[cell] && value !== parsed.puzzle[cell])) return null;
  const number = (value) => (Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0);
  return {
    version: 1,
    level: level.id,
    seed: number(parsed.seed),
    size: level.size,
    boxW: level.boxW,
    boxH: level.boxH,
    puzzle: parsed.puzzle,
    solution: parsed.solution,
    values: parsed.values,
    notes: parsed.notes,
    elapsedMs: number(parsed.elapsedMs),
    hints: number(parsed.hints),
    mistakes: number(parsed.mistakes),
  };
}

/** 途中の盤を残す。保存できなくても遊べる。 */
export function saveSudokuSave(storage, game) {
  try {
    storage?.setItem(SUDOKU_SAVE_KEY, JSON.stringify(game));
  } catch {
    // 保存できない環境でも、その場では遊べる。
  }
}

export function clearSudokuSave(storage) {
  try {
    storage?.removeItem(SUDOKU_SAVE_KEY);
  } catch {
    // 消せなくても、次に解いたときに上書きされる。
  }
}

/** 新しい問題の種(画面で使う。テストでは決まった種を渡す)。 */
export function newSudokuSeed() {
  return Math.floor(Math.random() * 2 ** 31);
}
