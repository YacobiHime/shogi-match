import { describe, expect, it } from 'vitest';
import { Position } from 'tsshogi';
import { enumerateLegalMoves } from '../game-state';
import { SKILL_TEST_ITEMS } from '../data/skill-test-items.mjs';
import { SKILL_TEST_BANK } from './skill-test-bank.mjs';
import { isCaptureMove, profitableCaptures, savingMoves } from './skill-test-promise.mjs';
import { detectTesujiShape, tesujiShape } from './tesuji-shape.mjs';

// 束の全部の問題で、問いの約束と正解の一覧が一致するかを、盤だけで確かめる(docs/skill-assessment-design.mdの10-9)。
// 「詰まない手」(受けの約束)はエンジンが要るので、問題を作るときに確かめている(scripts/build-skill-test-items.mjs)。
const positionOf = (sfen) => /** @type {Position} */ (Position.newBySFEN(sfen));
const legalOf = (sfen) => enumerateLegalMoves(positionOf(sfen)).map(({ usi }) => usi);
const sorted = (list) => [...list].sort();
const givesCheck = (sfen, usi) => {
  const position = positionOf(sfen);
  const move = position.createMoveByUSI(usi);
  return Boolean(move && position.doMove(move) && position.checked);
};
const passSfen = (sfen) => {
  const parts = sfen.split(' ');
  parts[1] = parts[1] === 'b' ? 'w' : 'b';
  return parts.join(' ');
};
const ofType = (type) => SKILL_TEST_ITEMS.filter((item) => item.type === type);

describe('棋力テストの問題の束(v2)', () => {
  it('どの問題も、王手されていない局面で、最善手は正解の1つ', () => {
    for (const item of SKILL_TEST_ITEMS) {
      expect(item.id.startsWith(`st2-${item.type}-`), item.id).toBe(true);
      expect(positionOf(item.sfen).checked, item.id).toBe(false);
      const legal = new Set(legalOf(item.sfen));
      expect(item.accepted.length, item.id).toBeGreaterThan(0);
      for (const usi of item.accepted) expect(legal.has(usi), `${item.id} ${usi}`).toBe(true);
      expect(item.accepted, item.id).toContain(item.best);
    }
    // 種類ごとに、出題に足りる数がある(出す束は、解けすぎ・解けなさすぎの問題を除いたもの)。
    for (const type of ['take', 'save', 'tactic', 'defend', 'judge']) {
      expect(SKILL_TEST_BANK.filter((item) => item.type === type).length, type).toBeGreaterThanOrEqual(20);
    }
  });

  it('取る: 正解の一覧が、得する駒取りのすべてと一致する', () => {
    for (const item of ofType('take')) {
      expect(sorted(item.accepted), item.id).toEqual(sorted(profitableCaptures(item.sfen, legalOf(item.sfen))));
    }
  });

  it('守る: 最善手は駒を助ける手で、正解の一覧が、駒を助ける手のすべてと一致する', () => {
    for (const item of ofType('save')) {
      expect(sorted(item.accepted), item.id).toEqual(sorted(savingMoves(item.sfen, legalOf(item.sfen))));
      // 取られそうな駒は手番側の駒で、何もしないときの相手の手がそれを取る。
      const pass = passSfen(item.sfen);
      expect(item.threat.slice(2, 4), item.id).toBe(item.target);
      expect(isCaptureMove(pass, item.threat), item.id).toBe(true);
    }
  });

  it('手筋: 名前の付いた形で、最善手と正解のすべてがその形に当たる', () => {
    const tactics = ofType('tactic');
    const names = {};
    for (const item of tactics) {
      expect(tesujiShape(item.tesuji), item.id).toBeTruthy();
      for (const usi of item.accepted) expect(detectTesujiShape({ sfenBefore: item.sfen, usi })?.id, `${item.id} ${usi}`).toBe(item.tesuji);
      expect(item.line[0], item.id).toBe(item.best);
      names[item.tesuji] = (names[item.tesuji] ?? 0) + 1;
    }
    // 1つの名前が、手筋の問題の3分の1を超えない(両取りばかりにしない)。
    for (const [name, count] of Object.entries(names)) expect(count, name).toBeLessThanOrEqual(Math.ceil(tactics.length / 3) + 1);
  });

  it('受け: 最善手は王手でない受けの手で、詰まない手は合法手の4分の1以下', () => {
    for (const item of ofType('defend')) {
      expect(givesCheck(item.sfen, item.best), item.id).toBe(false);
      expect(item.threat, item.id).toBeTruthy();
      expect(item.accepted.length, item.id).toBeLessThanOrEqual(legalOf(item.sfen).length / 4);
    }
  });

  it('判断: 3つの別々の選択肢から最善手1つ。深い読みで2番目より200以上良い', () => {
    for (const item of ofType('judge')) {
      expect(new Set(item.choices).size, item.id).toBe(3);
      expect(item.accepted, item.id).toHaveLength(1);
      expect(item.choices, item.id).toContain(item.best);
      expect(item.gap, item.id).toBeGreaterThanOrEqual(200);
      expect(item.line[0], item.id).toBe(item.best);
    }
  });
});
