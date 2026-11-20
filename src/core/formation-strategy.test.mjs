// 自作の戦法の規則(docs/formation-detect-design.mdのF3)。相手の形・駒の通り道・戦型・手数の窓。
import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';
import { CUSTOM_STRATEGY_RULES, formationMeta, mirrorSquare } from './formation-catalog.mjs';
import { createFormationState, detectFormationSnapshot, updateFormationState } from './formation-tracker.mjs';

const master = JSON.parse(await readFile(new URL('../data/hiragana_suisho_formations.json', import.meta.url), 'utf8'));

/** 盤の駒(「77」と記号)から局面のSFEN。 */
function sfenOf(pieces) {
  const board = new Map(pieces);
  const ranks = [];
  for (let rank = 1; rank <= 9; rank += 1) {
    let empty = 0;
    let text = '';
    for (let file = 9; file >= 1; file -= 1) {
      const piece = board.get(`${file}${rank}`);
      if (!piece) empty += 1;
      else {
        if (empty) text += empty;
        empty = 0;
        text += piece;
      }
    }
    ranks.push(text + (empty || ''));
  }
  return `${ranks.join('/')} b - 1`;
}

/**
 * その側から見た駒の札(自分のもの・相手のもの)から、盤の駒を作る。
 * @param {'black' | 'white'} color
 * @param {string[]} mine
 * @param {string[]} theirs その側から見た相手の駒
 */
function piecesFor(color, mine, theirs) {
  const at = (cell) => (color === 'black' ? cell.slice(0, 2) : mirrorSquare(cell.slice(0, 2)));
  const own = mine.map((cell) => [at(cell), color === 'black' ? cell.slice(2) : cell.slice(2).toLowerCase()]);
  const opp = theirs.map((cell) => [at(cell), color === 'black' ? cell.slice(2).toLowerCase() : cell.slice(2)]);
  return [...own, ...opp];
}

/** 規則のいちばん小さな形と、相手の駒(玉と、条件に合う飛車)。 */
function ruleBoard(rule, { oppRook } = {}) {
  const variant = rule.variants[0];
  const mine = [...variant.own, ...(variant.ownAny ?? []).map((group) => group[0])];
  if (!mine.some((cell) => cell.endsWith('K'))) mine.push(mine.some((cell) => cell.startsWith('59')) ? '69K' : '59K');
  const theirs = [...(variant.opp ?? []), ...(variant.oppAny ?? []).map((group) => group[0]), '51K'];
  const style = oppRook ?? variant.oppRook;
  // 相手から見て5〜9筋の飛車が振り飛車。自分から見ると、相手の2八は「82」、相手の6八は「42」。
  if (style && !theirs.some((cell) => cell.endsWith('R'))) theirs.push(style === 'ranging' ? '42R' : '82R');
  return { mine, theirs };
}

/** 局面を順に見て、その側に付いた戦法。 */
function tacticsAfter(color, boards, { ply = 10, battle = '' } = {}) {
  let state = createFormationState();
  boards.forEach(({ mine, theirs }, index) => {
    const snapshot = detectFormationSnapshot(sfenOf(piecesFor(color, mine, theirs)), master);
    if (battle) snapshot.battle = battle;
    state = updateFormationState(state, snapshot, { ply: ply + index * 2, mover: color });
  });
  return state[color].tactics;
}

describe('自作の戦法の規則', () => {
  test('どの名前も目録にあり、戦法', () => {
    for (const rule of CUSTOM_STRATEGY_RULES) expect(formationMeta(rule.name)?.kind, rule.name).toBe('strategy');
  });

  for (const color of ['black', 'white']) {
    const side = color === 'black' ? '先手' : '後手';
    test(`${side}: 形がそろうとその名前、自分の駒を1つ抜くと付かない`, () => {
      for (const rule of CUSTOM_STRATEGY_RULES) {
        const battle = rule.battle ?? '';
        const variant = rule.variants[0];
        const board = ruleBoard(rule);
        const steps = variant.visited ? [{ mine: [...board.mine.filter((cell) => !cell.endsWith('R')), ...variant.visited], theirs: board.theirs }, board] : [board];
        expect(tacticsAfter(color, steps, { battle }), rule.name).toContain(rule.name);
        for (const missing of variant.own.filter((cell) => !cell.endsWith('K'))) {
          const less = { ...board, mine: board.mine.filter((cell) => cell !== missing) };
          expect(tacticsAfter(color, [less], { battle }), `${rule.name}から${missing}を抜く`).not.toContain(rule.name);
        }
      }
    });
  }

  test('相手の飛車の向きが違えば付かない(対振り飛車の急戦は、相手が居飛車なら付かない)', () => {
    for (const rule of CUSTOM_STRATEGY_RULES.filter((item) => item.variants[0].oppRook)) {
      const style = rule.variants[0].oppRook === 'ranging' ? 'static' : 'ranging';
      expect(tacticsAfter('black', [ruleBoard(rule, { oppRook: style })], { battle: rule.battle ?? '' }), rule.name).not.toContain(rule.name);
    }
  });

  test('手数の窓を過ぎたら付かない', () => {
    for (const rule of CUSTOM_STRATEGY_RULES.filter((item) => item.maxPly)) {
      expect(tacticsAfter('black', [ruleBoard(rule)], { ply: rule.maxPly + 1, battle: rule.battle ?? '' }), rule.name).not.toContain(rule.name);
    }
  });

  test('戦型の条件(相掛かり棒銀は相掛かりのときだけ)', () => {
    const rule = CUSTOM_STRATEGY_RULES.find((item) => item.name === '相掛かり棒銀');
    expect(tacticsAfter('black', [ruleBoard(rule)], { battle: '' })).not.toContain('相掛かり棒銀');
  });

  test('駒の通り道: 6八に飛車がいたことがなければ4→3戦法にならない', () => {
    const rule = CUSTOM_STRATEGY_RULES.find((item) => item.name === '4→3戦法');
    expect(tacticsAfter('black', [ruleBoard(rule)])).not.toContain('4→3戦法');
    const board = ruleBoard(rule);
    const before = { mine: [...board.mine.filter((cell) => !cell.endsWith('R')), '68R'], theirs: board.theirs };
    expect(tacticsAfter('black', [before, board])).toContain('4→3戦法');
  });
});
