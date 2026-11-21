import { describe, expect, it } from 'vitest';
import { chooseReasonMove, reasonProfile } from './reason-move.mjs';
import { stateFromSfen, playLight } from './logic-position.mjs';
import { isCheckmated, legalMoves } from './light-moves.mjs';
import { MASTERY_FOLLOW, createBookTracker, followUpTurn, masteryFollowUp, noteBook } from './strategy-mastery.mjs';

const strong = reasonProfile({ reading: 49, plan: 49, steady: 49, mate: 49 });
const never = () => 0.99; // 確かめを飛ばさない(くじはいつも外れ)

describe('能力値から考える順番の深さ(34-6)', () => {
  it('弱いと詰みは1手・取り合いは2手・うっかりが多い。強いと9手・6手・ほとんど飛ばさない', () => {
    expect(reasonProfile({ reading: 12, plan: 12, steady: 12, mate: 12 })).toMatchObject({ mateDepth: 1, captureDepth: 2, skip: 0.3 });
    expect(strong).toMatchObject({ mateDepth: 9, captureDepth: 6, skip: 0.02 });
  });
});

describe('考える順番(34-4)', () => {
  it('1. 詰みがあれば詰ます', () => {
    const sfen = '8k/9/7G1/9/9/9/9/9/K8 b G 1';
    const got = chooseReasonMove({ sfen, profile: strong, random: never });
    expect(got).toMatchObject({ stage: 'mate', reason: 'mate', mate: 1 });
    expect(isCheckmated(playLight(stateFromSfen(sfen), got.move))).toBe(true);
  });
  it('2. 相手の1手詰めを防ぐ', () => {
    // 先手玉1九。後手は2七の金と持ち駒の金で、1八金の1手詰めをねらう。
    const sfen = 'k8/9/9/9/7R1/9/7g1/9/8K b g 1';
    const got = chooseReasonMove({ sfen, profile: strong, random: never });
    expect(got.stage).toBe('defend');
    const child = playLight(stateFromSfen(sfen), got.move);
    const mates = legalMoves(child).filter((usi) => {
      const next = playLight(child, usi);
      return legalMoves(next).length === 0;
    });
    expect(mates).toEqual([]);
  });
  it('3. 定跡の手を指す', () => {
    const got = chooseReasonMove({ sfen: 'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1', profile: strong, planMove: '2g2f', random: never });
    expect(got).toMatchObject({ move: '2g2f', stage: 'book', reason: 'book' });
  });
  it('4. ただの駒を取る(駒得)', () => {
    const got = chooseReasonMove({ sfen: 'k8/9/9/9/4s4/9/9/4R4/K8 b - 1', profile: strong, random: never });
    expect(got).toMatchObject({ move: '5h5e', stage: 'read', reason: 'material' });
  });
  it('4. 取られそうな銀を、取られない升へ逃がす', () => {
    // 先手の銀5五に後手の歩5四が当たり、歩は5三の金が守る。
    const sfen = 'k8/9/4g4/4p4/4S4/9/9/9/K8 b - 1';
    const got = chooseReasonMove({ sfen, profile: strong, random: never });
    expect(got).toMatchObject({ stage: 'read', reason: 'save' });
    expect(got.move.startsWith('5e')).toBe(true);
    expect(['5e4d', '5e6d', '5e5d']).not.toContain(got.move.slice(0, 4));
  });
  it('6. 何もない局面では、取られない端歩を突く', () => {
    const got = chooseReasonMove({ sfen: '4k4/9/9/9/9/9/8P/9/4K4 b - 1', profile: strong, random: never });
    expect(got).toMatchObject({ move: '1g1f', stage: 'quiet', reason: 'edge-pawn' });
  });
  it('確かめを飛ばした手は、思考の記録に残る', () => {
    const always = () => 0;
    const got = chooseReasonMove({ sfen: 'k8/9/4g4/4p4/4S4/9/9/9/K8 b - 1', profile: strong, random: always });
    expect(got.skipped).toContain('hanging');
  });
});

describe('戦法熟練度(34-10)', () => {
  it('熟練度0はエンジンを使わず、上がるほど手の数と探索量が増える', () => {
    expect(masteryFollowUp(0)).toEqual({ moves: 0, nodes: 0 });
    expect(masteryFollowUp(100)).toEqual({ moves: MASTERY_FOLLOW.maxMoves, nodes: MASTERY_FOLLOW.maxNodes });
    const half = masteryFollowUp(50);
    expect(half.moves).toBe(5);
    expect(half.nodes).toBeGreaterThan(MASTERY_FOLLOW.minNodes);
    expect(half.nodes).toBeLessThan(MASTERY_FOLLOW.maxNodes);
  });
  it('定跡の手がなくなった次の手から、熟練度の手の数だけエンジンで指す', () => {
    let tracker = createBookTracker();
    tracker = noteBook(tracker, 'black', { planMove: '2g2f', ownMoves: 0 });
    expect(followUpTurn(tracker, 'black', 1, 30)).toBeNull();
    tracker = noteBook(tracker, 'black', { planMove: null, ownMoves: 6 });
    const { moves } = masteryFollowUp(30);
    expect(followUpTurn(tracker, 'black', 6, 30)).toMatchObject({ index: 0, of: moves });
    expect(followUpTurn(tracker, 'black', 6 + moves - 1, 30)).not.toBeNull();
    expect(followUpTurn(tracker, 'black', 6 + moves, 30)).toBeNull();
    // 定跡を使わなかった側はエンジンで指さない。
    expect(followUpTurn(noteBook(createBookTracker(), 'white', { planMove: null, ownMoves: 3 }), 'white', 3, 100)).toBeNull();
  });
});
