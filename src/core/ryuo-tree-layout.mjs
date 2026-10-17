// トーナメント表を木の形で描くための、配置の計算。画面に依存しない。
// 葉(棋士)を下に左から並べ、各試合は、2つの枝の真ん中に置く。上の試合ほど、上に置く。
// 人数が2の累乗でないときの不戦勝は、短い枝(長い縦線)になる。
// 枝は、縦の線(rise)と横の線(bar)に分けて返す。普通のトーナメント表のように、勝者の線は、
// 勝った試合の横の線を通り、次の試合の横の線の高さまで縦に伸びる(両側の勝者の線が届いた横の線が、次の対戦)。

/** 段の名前。いちばん上が決勝、その下が準決勝・準々決勝、それより下は「◯回戦」。 */
export function roundLabel(rounds, round) {
  const from = rounds - round;
  if (from === 0) return '決勝';
  if (from === 1) return '準決勝';
  if (from === 2) return '準々決勝';
  return `${round}回戦`;
}

/**
 * @param {{
 *   root: { pid?: string, from?: string }, rounds: number,
 *   nodes: Record<string, { id: string, a: any, b: any, winner: string | null, round: number }>,
 *   pendingNodeId?: string | null,
 * }} tree view(ryuo.mjs)のtree
 * @param {{ leafWidth?: number, rowHeight?: number, top?: number, leafHeight?: number, gutter?: number, finals?: { defender: string, winner?: string | null } | null }} [options]
 *   finalsを渡すと、決勝(三番勝負)のさらに上に、竜王(防衛側)との七番勝負を足す。そのとき、topはrowHeightより大きくする。
 *   gutterは、左に空ける幅(段の名前を置く)。
 * 枝(edges)は、kind: 'rise'(縦)と'bar'(横)に分ける。won: 勝者の線、next: 保留中の試合(次の対局)へ向かう線。
 */
export function layoutTree(tree, { leafWidth = 52, rowHeight = 44, top = 44, leafHeight = 124, gutter = 0, finals = null } = {}) {
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
  const leafX = new Map(order.map((pid, index) => [pid, gutter + (index + 0.5) * leafWidth]));
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
    const pending = node.id === tree.pendingNodeId;
    const decided = node.winner !== null;
    nodes.push({ id: node.id, x, y, winner: node.winner, pending, decided });
    for (const side of [node.a, node.b]) {
      const cx = sideX(side);
      const cy = sideY(side);
      const pid = sidePid(side);
      const wonThis = decided && pid === node.winner;
      const key = `${node.id}:${side.pid ?? side.from}`;
      // 下の試合の勝者が決まっていれば、その人の線は、この試合の横の線の高さまで伸びる。
      const advanced = side.pid ? wonThis : tree.nodes[side.from].winner !== null;
      edges.push(
        { id: `${key}:rise`, kind: 'rise', points: [[cx, cy], [cx, y]], won: advanced, decided, next: pending },
        { id: `${key}:bar`, kind: 'bar', points: [[cx, y], [x, y]], won: wonThis, decided, next: pending },
      );
    }
  }

  const rows = Array.from({ length: tree.rounds }, (_, index) => {
    const round = index + 1;
    return { round, y: top + (tree.rounds - round) * rowHeight, label: roundLabel(tree.rounds, round) };
  });

  const leaves = order.map((pid) => ({ pid, x: leafX.get(pid), y: leafY }));
  const result = {
    leaves, nodes, edges, rows, leafY, width: gutter + order.length * leafWidth, height: leafY + leafHeight,
    rootX: sideX(tree.root), rootY: tree.root.pid ? leafY : nodeY(tree.nodes[tree.root.from]),
    finals: null, defender: null,
  };
  if (finals) {
    const defenderX = gutter + (order.length + 0.5) * leafWidth;
    const barY = top - rowHeight;
    const barX = (result.rootX + defenderX) / 2;
    const challenger = sidePid(tree.root);
    const decided = Boolean(finals.winner);
    result.defender = { pid: finals.defender, x: defenderX, y: leafY };
    result.width += leafWidth;
    result.finals = { x: barX, y: barY, decided, winner: finals.winner ?? null };
    const challengerDecided = !tree.root.pid && tree.nodes[tree.root.from].winner !== null;
    edges.push(
      { id: 'finals:challenger:rise', kind: 'rise', points: [[result.rootX, result.rootY], [result.rootX, barY]], won: challengerDecided, decided, next: false },
      { id: 'finals:challenger:bar', kind: 'bar', points: [[result.rootX, barY], [barX, barY]], won: decided && challenger === finals.winner, decided, next: false },
      { id: 'finals:defender:rise', kind: 'rise', points: [[defenderX, leafY], [defenderX, barY]], won: decided && finals.defender === finals.winner, decided, next: false },
      { id: 'finals:defender:bar', kind: 'bar', points: [[defenderX, barY], [barX, barY]], won: decided && finals.defender === finals.winner, decided, next: false },
    );
  }
  return result;
}
