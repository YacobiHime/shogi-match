import { describe, expect, it } from 'vitest';
import { layoutTree, roundLabel } from './ryuo-tree-layout.mjs';
import { USER_ID, buildSeededBracket, createSeason, describeSeason } from './ryuo.mjs';

const bracketTree = (count, decide = () => null) => {
  const bracket = buildSeededBracket('test', Array.from({ length: count }, (_, index) => `p${index + 1}`), 't');
  for (const node of Object.values(bracket.nodes)) node.winner = decide(node);
  const nodes = Object.fromEntries(Object.values(bracket.nodes).map((node) => [node.id, { ...node }]));
  return { root: bracket.root, rounds: bracket.rounds, nodes, leaves: {}, pendingNodeId: null };
};

describe('tournament tree layout', () => {
  it('places every player once from the left, each match above and between its two branches', () => {
    const tree = bracketTree(8);
    const layout = layoutTree(tree, { leafWidth: 50, rowHeight: 40, top: 40, leafHeight: 100 });
    expect(layout.leaves).toHaveLength(8);
    expect(layout.leaves.map(({ x }) => x)).toEqual([25, 75, 125, 175, 225, 275, 325, 375]);
    expect(layout.nodes).toHaveLength(7);
    // 1つの枝を、縦の線と横の線に分ける。
    expect(layout.edges).toHaveLength(28);
    expect(layout.width).toBe(400);
    expect(layout.leafY).toBe(40 + 3 * 40);
    expect(layout.height).toBe(layout.leafY + 100);
    const byId = Object.fromEntries(layout.nodes.map((node) => [node.id, node]));
    for (const node of Object.values(tree.nodes)) {
      const point = byId[node.id];
      for (const side of [node.a, node.b]) {
        const childX = side.pid ? layout.leaves.find(({ pid }) => pid === side.pid).x : byId[side.from].x;
        const childY = side.pid ? layout.leafY : byId[side.from].y;
        expect(childY).toBeGreaterThan(point.y);
        expect(Math.min(childX, point.x) <= Math.max(childX, point.x)).toBe(true);
      }
    }
    // 根(決勝)がいちばん上。
    expect(layout.rootY).toBe(40);
    expect(layout.rootX).toBe(200);
  });

  it('draws the winning branch of each decided match as the path to the top', () => {
    const tree = bracketTree(4, (node) => {
      const pick = (side) => side.pid ?? null;
      return node.round === 1 ? pick(node.a) : null;
    });
    const layout = layoutTree(tree);
    const won = layout.edges.filter((edge) => edge.won);
    // 1回戦の勝者2人は、名前から勝った試合の横の線を通り、決勝の横の線の高さまで線が伸びる(ここで2人がぶつかる)。
    // 決勝(未定)の横の線は、まだ強調しない。
    expect(won.filter(({ kind }) => kind === 'bar')).toHaveLength(2);
    expect(won.filter(({ kind }) => kind === 'rise')).toHaveLength(4);
    const rootY = layout.rootY;
    const intoFinal = won.filter(({ kind, points }) => kind === 'rise' && points[1][1] === rootY);
    expect(intoFinal).toHaveLength(2);
    expect(layout.edges.filter((edge) => edge.kind === 'bar' && edge.points[0][1] === rootY && edge.won)).toHaveLength(0);
    expect(layout.edges.filter((edge) => !edge.decided)).toHaveLength(4);
    expect(layout.nodes.filter((node) => node.decided)).toHaveLength(2);
  });

  it('marks the lines into the pending match, and names each round from the top', () => {
    const tree = { ...bracketTree(8), pendingNodeId: null };
    const first = Object.values(tree.nodes).find((node) => node.round === 1);
    tree.pendingNodeId = first.id;
    const layout = layoutTree(tree, { gutter: 30, leafWidth: 50 });
    expect(layout.edges.filter((edge) => edge.next)).toHaveLength(4);
    expect(layout.nodes.find((node) => node.pending).id).toBe(first.id);
    expect(layout.rows.map(({ label }) => label)).toEqual(['準々決勝', '準決勝', '決勝']);
    expect(layout.rows[2].y).toBe(layout.rootY);
    expect(layout.leaves[0].x).toBe(30 + 25);
    expect(layout.width).toBe(30 + 8 * 50);
    expect(roundLabel(6, 1)).toBe('1回戦');
    expect(roundLabel(6, 3)).toBe('3回戦');
    expect(roundLabel(6, 4)).toBe('準々決勝');
  });

  it('shortens the branch of a player who skips a round, so byes show as long vertical lines', () => {
    const tree = bracketTree(6);
    const layout = layoutTree(tree, { top: 40, rowHeight: 40 });
    const lengths = layout.edges.filter(({ kind }) => kind === 'rise').map(({ points }) => points[0][1] - points[1][1]);
    expect(Math.max(...lengths)).toBeGreaterThan(Math.min(...lengths));
    expect(layout.leaves).toHaveLength(6);
    expect(layout.nodes).toHaveLength(5);
  });

  it('adds the defending champion and the title match above the final', () => {
    const tree = bracketTree(4);
    const layout = layoutTree(tree, { leafWidth: 50, rowHeight: 40, top: 80, finals: { defender: 'champ', winner: 'champ' } });
    expect(layout.defender).toMatchObject({ pid: 'champ', x: 4.5 * 50 });
    expect(layout.width).toBe(5 * 50);
    expect(layout.finals).toMatchObject({ y: 40, decided: true, winner: 'champ' });
    expect(layout.finals.x).toBeGreaterThan(layout.rootX);
    const finalsEdges = layout.edges.filter(({ id }) => id.startsWith('finals'));
    expect(finalsEdges).toHaveLength(4);
    expect(finalsEdges.find(({ id }) => id === 'finals:defender:bar').won).toBe(true);
    expect(finalsEdges.find(({ id }) => id === 'finals:challenger:bar').won).toBe(false);
  });

  it('lays out the real season brackets of every scale', () => {
    for (const scale of [1, 2, 3, 4, 5]) {
      const season = createSeason({
        no: 1, mode: 'challenge', group: 6, settings: { difficulty: 9, scale, revival: true }, userLevel: 28, seed: 30 + scale,
      });
      const view = describeSeason(season);
      const { tree } = view.tables[0];
      const layout = layoutTree(tree, { leafWidth: 42 });
      expect(layout.leaves.some(({ pid }) => pid === USER_ID)).toBe(true);
      expect(layout.nodes).toHaveLength(Object.keys(tree.nodes).length);
      expect(layout.nodes.filter(({ pending }) => pending)).toHaveLength(1);
      for (const point of layout.nodes) {
        expect(point.x).toBeGreaterThan(0);
        expect(point.x).toBeLessThan(layout.width);
        expect(point.y).toBeLessThan(layout.leafY);
      }
    }
  });
});
