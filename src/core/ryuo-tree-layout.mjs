// トーナメント表を木の形で描くための、配置の計算。画面に依存しない。
// 葉(棋士)を下に左から並べ、各試合は、2つの枝の真ん中に置く。上の試合ほど、上に置く。
// 人数が2の累乗でないときの不戦勝は、短い枝(長い縦線)になる。

/**
 * @param {{
 *   root: { pid?: string, from?: string }, rounds: number,
 *   nodes: Record<string, { id: string, a: any, b: any, winner: string | null, round: number }>,
 *   pendingNodeId?: string | null,
 * }} tree view(ryuo.mjs)のtree
 * @param {{ leafWidth?: number, rowHeight?: number, top?: number, leafHeight?: number, finals?: { defender: string, winner?: string | null } | null }} [options]
 *   finalsを渡すと、決勝(三番勝負)のさらに上に、竜王(防衛側)との七番勝負を足す。そのとき、topはrowHeightより大きくする。
 */
export function layoutTree(tree, { leafWidth = 52, rowHeight = 44, top = 44, leafHeight = 124, finals = null } = {}) {
  const order = [];
  const walk = (side) => {
    if (side.pid) order.push(side.pid);
    else {
      const node = tree.nodes[side.from];
      walk(node.a);
      walk(node.b);
    }
  };
  walk(tree.root);
  const leafX = new Map(order.map((pid, index) => [pid, (index + 0.5) * leafWidth]));
  const leafY = top + tree.rounds * rowHeight;
  const nodeY = (node) => top + (tree.rounds - node.round) * rowHeight;

  const xCache = new Map();
  const sideX = (side) => {
    if (side.pid) return leafX.get(side.pid);
    if (!xCache.has(side.from)) {
      const node = tree.nodes[side.from];
      xCache.set(side.from, (sideX(node.a) + sideX(node.b)) / 2);
    }
    return xCache.get(side.from);
  };
  const sideY = (side) => (side.pid ? leafY : nodeY(tree.nodes[side.from]));
  const sidePid = (side) => (side.pid ?? tree.nodes[side.from].winner);

  const nodes = [];
  const edges = [];
  for (const node of Object.values(tree.nodes)) {
    const x = sideX({ from: node.id });
    const y = nodeY(node);
    nodes.push({ id: node.id, x, y, winner: node.winner, pending: node.id === tree.pendingNodeId, decided: node.winner !== null });
    for (const side of [node.a, node.b]) {
      const cx = sideX(side);
      const cy = sideY(side);
      const pid = sidePid(side);
      edges.push({
        id: `${node.id}:${side.pid ?? side.from}`,
        points: [[cx, cy], [cx, y], [x, y]],
        won: node.winner !== null && pid === node.winner,
        decided: node.winner !== null,
      });
    }
  }

  const leaves = order.map((pid) => ({ pid, x: leafX.get(pid), y: leafY }));
  const result = {
    leaves, nodes, edges, leafY, width: order.length * leafWidth, height: leafY + leafHeight,
    rootX: sideX(tree.root), rootY: tree.root.pid ? leafY : nodeY(tree.nodes[tree.root.from]),
    finals: null, defender: null,
  };
  if (finals) {
    const defenderX = (order.length + 0.5) * leafWidth;
    const barY = top - rowHeight;
    const barX = (result.rootX + defenderX) / 2;
    const challenger = sidePid(tree.root);
    const decided = Boolean(finals.winner);
    result.defender = { pid: finals.defender, x: defenderX, y: leafY };
    result.width += leafWidth;
    result.finals = { x: barX, y: barY, decided, winner: finals.winner ?? null };
    edges.push(
      { id: 'finals:challenger', points: [[result.rootX, result.rootY], [result.rootX, barY], [barX, barY]], won: decided && challenger === finals.winner, decided },
      { id: 'finals:defender', points: [[defenderX, leafY], [defenderX, barY], [barX, barY]], won: decided && finals.defender === finals.winner, decided },
    );
  }
  return result;
}
