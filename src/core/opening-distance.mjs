import { applyUsiToBoard, pieceVectors } from "./piece-movement.mjs";

/** これより遠い形は案内せず、選び直しを促す。 */
export const OPENING_GUIDE_MAX_DISTANCE = 8;
/** 自分の駒がいる升は、その駒がどく1手を足して通れるものとする。 */
const OWN_BLOCKER_COST = 1;
const DISTANCE_CAP = 30;

export function mirrorSquare(square) {
  return `${10 - Number(square[0])}${String.fromCharCode(202 - square.charCodeAt(1))}`;
}

/** 先手基準の完成形を、手番側の升へ変換する。 */
export function formationVariantsForColor(variants, color) {
  return variants.map((squares) => squares.map(([square, kind]) => [
    color === "white" ? mirrorSquare(square) : square,
    kind,
  ]));
}

/**
 * 盤上の駒を障害物とした最短手数。成りは考えない。
 * 相手の駒と、完成形の升に収まった駒は通れない。これから動く予定の同じ形の駒は通れるものとし、
 * それ以外の自分の駒は、どく1手を足して通る。
 */
const BLOCKED = -1;

function squareIndex(square) {
  return (Number(square[0]) - 1) * 9 + (square.charCodeAt(1) - 97);
}

/** 升ごとの通過コスト。-1は通れない升。 */
function passCosts(board, color, fixed, movingKinds) {
  const costs = new Int8Array(81);
  for (const [square, occupant] of board) {
    costs[squareIndex(square)] = occupant.color !== color || fixed.has(square)
      ? BLOCKED
      : movingKinds.has(occupant.kind) ? 0 : OWN_BLOCKER_COST;
  }
  return costs;
}

function pieceDistances(from, piece, costs) {
  const { steps, slides } = pieceVectors(piece.kind, piece.color);
  const distances = new Array(81).fill(Infinity);
  const origin = squareIndex(from);
  distances[origin] = 0;
  // 1手のコストは1〜数手の小さな整数なので、手数ごとのバケットで最短手数を求める。
  const buckets = [[origin]];
  for (let cost = 0; cost < buckets.length && cost < DISTANCE_CAP; cost += 1) {
    for (const index of buckets[cost] ?? []) {
      if (distances[index] !== cost) continue;
      const x = Math.floor(index / 9) + 1;
      const y = (index % 9) + 1;
      const relax = (target, next) => {
        if (next < distances[target]) {
          distances[target] = next;
          (buckets[next] ??= []).push(target);
        }
      };
      for (const [dx, dy] of steps) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 1 || nx > 9 || ny < 1 || ny > 9) continue;
        const target = (nx - 1) * 9 + ny - 1;
        const pass = target === origin ? 0 : costs[target];
        if (pass !== BLOCKED) relax(target, cost + 1 + pass);
      }
      for (const [dx, dy] of slides) {
        let extra = 0;
        for (let nx = x + dx, ny = y + dy; nx >= 1 && nx <= 9 && ny >= 1 && ny <= 9; nx += dx, ny += dy) {
          const target = (nx - 1) * 9 + ny - 1;
          const pass = target === origin ? 0 : costs[target];
          if (pass === BLOCKED) break;
          extra += pass;
          relax(target, cost + 1 + extra);
          if (extra > 2) break;
        }
      }
    }
  }
  return distances;
}

function bestAssignment(costs, targetCount) {
  // costs[candidate][target]。駒は数枚なので総当たりで最小和を求める。
  let best = Infinity;
  let bestPlan = null;
  const used = new Set();
  const plan = [];
  const visit = (target, total) => {
    if (total >= best) return;
    if (target === targetCount) {
      best = total;
      bestPlan = [...plan];
      return;
    }
    for (let candidate = 0; candidate < costs.length; candidate += 1) {
      if (used.has(candidate)) continue;
      const cost = costs[candidate][target];
      if (!Number.isFinite(cost)) continue;
      used.add(candidate);
      plan.push(candidate);
      visit(target + 1, total + cost);
      plan.pop();
      used.delete(candidate);
    }
  };
  visit(0, 0);
  return { total: best, plan: bestPlan };
}

/** 1つの完成形について、未達の升と最小手数の駒割り当てを求める。 */
export function variantDistance(board, color, squares) {
  const missing = squares.filter(([square, kind]) => {
    const piece = board.get(square);
    return piece?.color !== color || piece.kind !== kind;
  });
  const fixed = new Set(squares
    .filter(([square, kind]) => board.get(square)?.color === color && board.get(square).kind === kind)
    .map(([square]) => square));
  const byKind = new Map();
  for (const entry of missing) {
    if (!byKind.has(entry[1])) byKind.set(entry[1], []);
    byKind.get(entry[1]).push(entry[0]);
  }
  const movingKinds = new Set(byKind.keys());
  const passCost = passCosts(board, color, fixed, movingKinds);
  let distance = 0;
  const assignments = [];
  const distanceCache = new Map();
  for (const [kind, targets] of byKind) {
    const candidates = [...board.entries()]
      .filter(([square, piece]) => piece.color === color && piece.kind === kind && !fixed.has(square))
      .map(([square]) => square);
    if (candidates.length < targets.length) {
      return { distance: Infinity, unreachable: true, reason: "missing-piece", kind, missing };
    }
    const costs = candidates.map((from) => {
      if (!distanceCache.has(from)) {
        distanceCache.set(from, pieceDistances(from, board.get(from), passCost));
      }
      const reach = distanceCache.get(from);
      return targets.map((target) => reach[squareIndex(target)]);
    });
    const { total, plan } = bestAssignment(costs, targets.length);
    if (!Number.isFinite(total)) {
      return { distance: Infinity, unreachable: true, reason: "blocked", kind, missing };
    }
    distance += total;
    plan.forEach((candidate, index) => {
      assignments.push({ from: candidates[candidate], to: targets[index], kind });
    });
  }
  return { distance, unreachable: false, missing, assignments };
}

/** 複数の完成形のうち最も近いものまでの距離。 */
export function formationDistance(board, color, variants) {
  let best = { distance: Infinity, unreachable: true, reason: "no-variant", missing: [] };
  variants.forEach((squares, variantIndex) => {
    const result = variantDistance(board, color, squares);
    if (result.distance < best.distance || (best.unreachable && !result.unreachable)) {
      best = { ...result, variantIndex };
    } else if (best.unreachable && result.unreachable && best.reason === "no-variant") {
      best = { ...result, variantIndex };
    }
  });
  return best;
}

/** 完成までの距離を縮める合法手を、縮めた後の距離つきで返す。 */
export function formationProgressMoves(board, color, variants, legalMoves) {
  const base = formationDistance(board, color, variants);
  if (base.unreachable || base.distance === 0) return { base, moves: [] };
  const moves = [];
  for (const usi of legalMoves) {
    if (usi.includes("*")) continue;
    const applied = applyUsiToBoard(board, usi, color);
    if (!applied || applied.captured) continue;
    const next = formationDistance(applied.board, color, variants);
    if (!next.unreachable && next.distance < base.distance) {
      moves.push({ usi, distance: next.distance });
    }
  }
  return { base, moves };
}
