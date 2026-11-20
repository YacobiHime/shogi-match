// 戦型の演出(docs/formation-detect-design.mdのF4。5・6章)。
import { describe, expect, test } from 'vitest';
import { formationGlowSquares, formationMon, rarityLook } from './formation-catalog.mjs';
import { wazaPresentation } from './move-waza.mjs';
import { parseSfenBoard } from './sfen-board.mjs';

const castle = (name, rarity) => ({ kind: /** @type {const} */ ('castle'), id: name, name, tier: /** @type {const} */ (rarity >= 5 ? 'legend' : rarity >= 3 ? 'rare' : 'normal'), rarity });

describe('★ごとの見せ方(5章の表)', () => {
  test('★1は自分の手でも小さな帯、★3から駒の光、★4から金と大きな紋、★5は虹と盤の縁', () => {
    expect(wazaPresentation(castle('舟囲い', 1), { mine: true })).toMatchObject({ size: 'small', glow: false, holdMs: 0, stars: 1 });
    expect(wazaPresentation(castle('本美濃', 2), { mine: true })).toMatchObject({ size: 'big', look: 'silver', glow: false, monBig: false, ms: 1200, holdMs: 400 });
    expect(wazaPresentation(castle('高美濃', 3), { mine: true })).toMatchObject({ size: 'big', look: 'silver', glow: true, monBig: false, ms: 1350, holdMs: 600 });
    expect(wazaPresentation(castle('銀冠穴熊', 4), { mine: true })).toMatchObject({ look: 'gold', glow: true, monBig: true, edge: false, ms: 1500, holdMs: 700 });
    expect(wazaPresentation(castle('ビッグ4', 5), { mine: true })).toMatchObject({ look: 'rainbow', glow: true, monBig: true, edge: true, stars: 5, holdMs: 900 });
  });

  test('長さは1.5秒まで(はじめてでも)', () => {
    for (const rarity of [1, 2, 3, 4, 5]) {
      expect(wazaPresentation(castle('x', rarity), { mine: true, first: true }).ms).toBeLessThanOrEqual(1500);
    }
    expect(rarityLook(9).rarity).toBe(5);
  });

  test('相手の形は小さな帯で止めない。★4以上だけ紋を付ける', () => {
    expect(wazaPresentation(castle('ビッグ4', 5), { mine: false })).toMatchObject({ size: 'small', holdMs: 0, glow: false, edge: false, kindLabel: '相手の囲い' });
    expect(wazaPresentation(castle('ビッグ4', 5), { mine: false }).mon).not.toBeNull();
    expect(wazaPresentation(castle('本美濃', 2), { mine: false }).mon).toBeNull();
  });

  test('かんたんは、どの★も小さな帯だけ(紋・光・縁なし)', () => {
    const view = wazaPresentation(castle('ビッグ4', 5), { mine: true, simple: true });
    expect(view).toMatchObject({ size: 'small', mon: null, glow: false, edge: false, monBig: false, holdMs: 0 });
  });

  test('進化したら前の名前と「進化！」。はじめての形なら「はじめて！」を先に', () => {
    expect(wazaPresentation(castle('振り飛車銀冠', 4), { mine: true, evolved: '高美濃' })).toMatchObject({ prev: '高美濃', badge: '進化！' });
    expect(wazaPresentation(castle('振り飛車銀冠', 4), { mine: true, evolved: '高美濃', first: true })).toMatchObject({ prev: '高美濃', badge: 'はじめて！' });
    expect(wazaPresentation(castle('振り飛車銀冠', 4), { mine: true, evolved: '高美濃', repeat: true })).toMatchObject({ prev: '', badge: '' });
  });

  test('手筋の見せ方は前のまま(段階で銀・金・虹)', () => {
    const view = wazaPresentation({ kind: 'tesuji', id: 'x', name: 'ふんどしの桂', tier: 'rare' }, { mine: true });
    expect(view).toMatchObject({ look: 'gold', mon: null, glow: false, stars: 2 });
  });
});

describe('系統の紋', () => {
  test('囲い・振り飛車の筋・奇襲など', () => {
    expect(formationMon('ビッグ4').shape).toBe('paw');
    expect(formationMon('本美濃').shape).toBe('fan');
    expect(formationMon('金矢倉').shape).toBe('yagura');
    expect(formationMon('ノーマル四間飛車')).toEqual({ shape: 'file', text: '四' });
    expect(formationMon('原始鬼殺し').shape).toBe('shuriken');
    expect(formationMon('知らない名前').shape).toBe('shield');
  });
});

describe('形を作る駒の光(6-2)', () => {
  const big4 = [['99', 'K'], ['98', 'L'], ['89', 'N'], ['88', 'G'], ['78', 'G'], ['87', 'S'], ['77', 'S']];
  test('いまその駒がいるマスだけ、玉に近い順(先手・後手)', () => {
    const black = parseSfenBoard('4k4/9/9/9/9/9/1SS6/LGG6/KN7 b - 1');
    const squares = formationGlowSquares(big4, black, 'black', { kind: 'castle' });
    expect(squares[0]).toBe('9i');
    expect(squares).toHaveLength(7);
    expect(squares.indexOf('7g')).toBeGreaterThan(squares.indexOf('8h'));
    const white = parseSfenBoard('7nk/6ggl/6ss1/9/9/9/9/9/4K4 w - 1');
    expect(formationGlowSquares(big4, white, 'white', { kind: 'castle' })[0]).toBe('1a');
  });

  test('戦法は動いた駒に近い順', () => {
    const board = parseSfenBoard('4k4/9/9/9/9/2S6/9/5R3/4K4 b - 1');
    const squares = formationGlowSquares([['48', 'R'], ['76', 'S']], board, 'black', { kind: 'strategy', moved: '7f' });
    expect(squares).toEqual(['7f', '4h']);
  });
});
