// 戦型の目録と判定(docs/formation-detect-design.mdのF1)。
import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';
import { FORMATION_META } from '../data/formation-catalog.mjs';
import { collectionCatalog } from './collection.mjs';
import { formationCatalog, formationMeta, formationShapes, mirrorSquare, ruleOwnPieces, ruleSpecificity, wazaTierOfRarity } from './formation-catalog.mjs';
import {
  CASTLE_PLY_LIMIT,
  createFormationState,
  detectFormationSnapshot,
  FORMATION_LABEL_ALIASES,
  formationMove,
  formedNamesFromState,
  STRATEGY_PLY_LIMIT,
  updateFormationState,
} from './formation-tracker.mjs';
import { formationWaza } from './move-waza.mjs';
import { OPENING_CASTLES, OPENING_STRATEGIES } from './opening-guide.mjs';

const master = JSON.parse(await readFile(new URL('../data/hiragana_suisho_formations.json', import.meta.url), 'utf8'));
const planCatalog = collectionCatalog({ strategies: OPENING_STRATEGIES, castles: OPENING_CASTLES });
const catalog = formationCatalog(planCatalog);

/** 「77」の形のマスと駒の記号から、盤のSFEN(手番・持ち駒・手数つき)。 */
function sfenOf(pieces, { turn = 'b', hand = '-', moveNumber = 1 } = {}) {
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
  return `${ranks.join('/')} ${turn} ${hand} ${moveNumber}`;
}

/** 規則の形を満たす最小の駒(全部そろう部分と、どれか1つの部分の最初の駒)。 */
function minimalPieces(rule) {
  const pieces = new Map(ruleOwnPieces(rule).map(([square, kind]) => [square, kind]));
  const anyParts = (rule.expression.all ?? []).filter((part) => part.match?.mode === 'any');
  for (const part of anyParts) {
    const own = ruleOwnPieces({ group: rule.group, expression: { match: { mode: 'all', sfen: part.match.sfen } } });
    if (own[0] && !pieces.has(own[0][0])) pieces.set(own[0][0], own[0][1]);
  }
  return [...pieces];
}

describe('目録', () => {
  test('ひらがなすいしょうの名前は、目録にあるか、目録の名前への別名がある', () => {
    const missing = [...new Set(master.rules.map((rule) => rule.name))]
      .filter((name) => !formationMeta(name) && !formationMeta(FORMATION_LABEL_ALIASES.get(name) ?? ''));
    expect(missing).toEqual([]);
  });

  test('作戦カードの名前はすべて目録にある', () => {
    expect(planCatalog.map((entry) => entry.label).filter((label) => !formationMeta(label))).toEqual([]);
  });

  test('★は1〜5、進化のもとは目録の同じ種類の名前', () => {
    for (const name of Object.keys(FORMATION_META)) {
      const meta = formationMeta(name);
      expect(meta?.rarity, name).toBeGreaterThanOrEqual(1);
      expect(meta?.rarity, name).toBeLessThanOrEqual(5);
      if (meta?.parent) expect(formationMeta(meta.parent)?.kind, `${name}の進化のもと`).toBe(meta.kind);
    }
  });

  test('作戦カードのない名前を足し、銀冠穴熊・ビッグ4もカードになる', () => {
    const labels = catalog.map((entry) => entry.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(catalog.length).toBeGreaterThan(planCatalog.length + 60);
    for (const name of ['銀冠穴熊', 'ビッグ4', '四枚美濃', '菱矢倉', '棒銀', '石田流']) expect(labels).toContain(name);
    expect(catalog.find((entry) => entry.label === 'ビッグ4')).toMatchObject({ kind: 'castle', rook: 'static', catalogOnly: true, rarity: 5 });
  });

  test('作戦カードのない囲いには、小さな盤に描ける形がある', () => {
    const shapes = formationShapes(master);
    // 規則のない名前(定跡エディターの上書きでだけ作戦カードになる羽生流右玉など)は、本番では作戦カードの小さな盤を使う。
    for (const entry of catalog.filter((item) => item.catalogOnly && item.kind === 'castle' && shapes.has(item.label))) {
      const drawable = (shapes.get(entry.label) ?? []).filter(([square]) => Number(square[1]) >= 5);
      expect(drawable.length, entry.label).toBeGreaterThan(0);
    }
  });

  test('★を技の段階にする', () => {
    expect([1, 2, 3, 4, 5].map(wazaTierOfRarity)).toEqual(['normal', 'normal', 'rare', 'rare', 'legend']);
  });
});

describe('いちばん具体的な囲い(7-4)', () => {
  const castleRules = master.rules.filter((rule) => rule.group === 'enc_match');
  for (const color of ['black', 'white']) {
    test(`${color === 'black' ? '先手' : '後手'}: どの囲いの形だけを置いても、その囲い(か、同じ駒の数の名前)になる`, () => {
      const wrong = [];
      for (const rule of castleRules) {
        const own = minimalPieces(rule);
        const pieces = own.map(([square, kind]) => (color === 'black' ? [square, kind] : [mirrorSquare(square), kind.toLowerCase()]));
        const enemyKing = color === 'black' ? ['51', 'k'] : ['59', 'K'];
        if (pieces.some(([square]) => square === enemyKing[0])) continue;
        const snapshot = detectFormationSnapshot(sfenOf([...pieces, enemyKing]), master);
        const got = snapshot[color].castle;
        if (got === rule.name) continue;
        // 同じ駒の数の、ほかの名前(並びの先・定跡補助の形)に当たったときは、その形も同じ駒をすべて満たす。
        const other = castleRules.find((item) => item.name === got);
        const sameSize = other ? ruleSpecificity(other) >= ruleSpecificity(rule) : OPENING_CASTLES.some((item) => item.label === got);
        if (!sameSize) wrong.push(`${rule.name}→${got || 'なし'}`);
      }
      expect(wrong).toEqual([]);
    });
  }

  test('銀冠穴熊・ビッグ4の局面(先手・後手)', () => {
    const cases = {
      銀冠穴熊: 'lnsgkgsnl/1r5b1/ppppppppp/9/9/1PP6/1S1PPPPPP/LG2G2R1/KN4SNL b B 1',
      ビッグ4: 'lnsgkgsnl/1r5b1/ppppppppp/9/9/2P6/PSSPPPPPP/LGG4R1/KN5NL b B 1',
      松尾流穴熊: 'lnsgkgsnl/1r5b1/ppppppppp/9/9/2P6/PP1PPPPPP/LSG1G2R1/KNS4NL b B 1',
    };
    for (const [name, sfen] of Object.entries(cases)) {
      expect(detectFormationSnapshot(sfen, master).black.castle, name).toBe(name);
    }
    // 後手は盤を回して同じ形。
    const rotate = (sfen) => {
      const [board, , hand] = sfen.split(' ');
      const rows = board.split('/').map((row) => row.replace(/\d/g, (n) => '.'.repeat(Number(n))));
      const turned = rows.reverse().map((row) => [...row].reverse().map((ch) => (ch === '.' ? ch : ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase())).join('').replace(/\.+/g, (dots) => String(dots.length)));
      return `${turned.join('/')} w ${hand === '-' ? '-' : hand.toLowerCase()} 1`;
    };
    expect(detectFormationSnapshot(rotate(cases.ビッグ4), master).white.castle).toBe('ビッグ4');
    expect(detectFormationSnapshot(rotate(cases.銀冠穴熊), master).white.castle).toBe('銀冠穴熊');
  });

  test('居飛車穴熊に銀を足すだけでは、銀冠穴熊やビッグ4にならない', () => {
    const anaguma = 'lnsgkgsnl/1r5b1/ppppppppp/9/9/2P6/PP1PPPPPP/LSG4R1/KNG3SNL b B 1';
    const snapshot = detectFormationSnapshot(anaguma, master);
    expect(snapshot.black.castle).toBe('居飛車穴熊');
  });
});

describe('1局の戦型のまとめ(7-2・7-3・7-5)', () => {
  const snap = (overrides) => ({
    battle: '',
    black: { rook: '', castle: '', tactics: [] },
    white: { rook: '', castle: '', tactics: [] },
    ...overrides,
  });

  test('相手が指した手のあとでは、その側の新しい戦法・囲いを数えない(次に自分が指してまだあれば数える)', () => {
    let state = createFormationState();
    state = updateFormationState(state, snap({ black: { rook: '', castle: '舟囲い', tactics: ['棒銀'] } }), { ply: 10, mover: 'white' });
    expect(state.black.formed).toEqual([]);
    expect(state.black.castle).toBe('舟囲い');
    state = updateFormationState(state, snap({ black: { rook: '', castle: '舟囲い', tactics: ['棒銀'] } }), { ply: 11, mover: 'black' });
    expect(state.black.formed).toEqual(['棒銀', '舟囲い']);
  });

  test('戦法は60手まで、囲いを組んだと数えるのは100手まで', () => {
    let state = createFormationState();
    state = updateFormationState(state, snap({ black: { rook: '', castle: '美濃囲い', tactics: ['棒銀'] } }), { ply: STRATEGY_PLY_LIMIT + 1, mover: 'black' });
    expect(state.black.tactics).toEqual([]);
    expect(state.black.formed).toEqual(['美濃囲い']);
    state = updateFormationState(state, snap({ black: { rook: '', castle: '高美濃', tactics: [] } }), { ply: CASTLE_PLY_LIMIT + 1, mover: 'black' });
    expect(state.black.formed).toEqual(['美濃囲い']);
    expect(state.black.castle).toBe('高美濃');
  });

  test('崩されても、組んだ囲いは残る', () => {
    let state = createFormationState();
    state = updateFormationState(state, snap({ black: { rook: '', castle: '居飛車穴熊', tactics: [] } }), { ply: 10, mover: 'black' });
    state = updateFormationState(state, snap({ black: { rook: '', castle: '', tactics: [] } }), { ply: 30, mover: 'black' });
    expect(state.black.castle).toBe('');
    expect(formedNamesFromState(state, 'black')).toContain('居飛車穴熊');
  });

  test('手数と、いま指した側(局面の手番の逆。初めの局面は空)', () => {
    expect(formationMove('lnsgkgsnl/1r5b1/ppppppppp/9/9/2P6/PP1PPPPPP/1B5R1/LNSGKGSNL w - 1', 1)).toEqual({ ply: 1, mover: 'black' });
    expect(formationMove('lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1', 0)).toEqual({ ply: 0, mover: '' });
  });

  test('戦型と振り飛車の筋も60手まで', () => {
    const state = updateFormationState(createFormationState(), { ...snap({}), battle: '矢倉', black: { rook: '四間飛車', castle: '', tactics: [] } }, { ply: STRATEGY_PLY_LIMIT + 1, mover: 'black' });
    expect(state.battle).toBe('');
    expect(state.black.rook).toBe('');
  });

  test('初めの局面(手数0)は、どちらの側の形も数える', () => {
    const state = updateFormationState(createFormationState(), snap({ white: { rook: '', castle: '舟囲い', tactics: [] } }), { ply: 0, mover: '' });
    expect(state.white.formed).toEqual(['舟囲い']);
  });
});

describe('技の演出の目録', () => {
  test('作戦カードのない銀冠穴熊・ビッグ4も、★から段階を付けて出す', () => {
    const castles = new Set(catalog.filter((entry) => entry.kind === 'castle').map((entry) => entry.label));
    const strategies = new Set(catalog.filter((entry) => entry.kind === 'strategy').map((entry) => entry.label));
    const found = formationWaza({ before: ['居飛車穴熊'], after: ['居飛車穴熊', 'ビッグ4', '銀冠穴熊'], castles, strategies });
    expect(found.map((item) => [item.name, item.tier])).toEqual([['ビッグ4', 'legend'], ['銀冠穴熊', 'rare']]);
  });
});
