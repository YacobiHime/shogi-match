// 戦型の目録と判定(docs/formation-detect-design.mdのF1)。
import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';
import { FORMATION_META } from '../data/formation-catalog.mjs';
import { collectionCatalog } from './collection.mjs';
import { CUSTOM_CASTLE_RULES, evolvedFrom, formationCatalog, formationMeta, formationShapes, mirrorSquare, ruleOwnPieces, ruleSpecificity, wazaTierOfRarity } from './formation-catalog.mjs';
import {
  CASTLE_PLY_LIMIT,
  collectionFormationNames,
  createFormationState,
  detectFormationSnapshot,
  FORMATION_LABEL_ALIASES,
  formationMove,
  formedNamesFromState,
  STRATEGY_PLY_LIMIT,
  statFormationNames,
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

  test('作戦カードのない名前を足し、銀冠穴熊・ビッグ4もカードになる(ビッグ4は14-5から作戦カードの囲い)', () => {
    const labels = catalog.map((entry) => entry.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(catalog.length).toBeGreaterThan(planCatalog.length + 60);
    for (const name of ['銀冠穴熊', 'ビッグ4', '四枚美濃', '菱矢倉', '棒銀', '石田流']) expect(labels).toContain(name);
    expect(catalog.find((entry) => entry.label === 'ビッグ4')).toMatchObject({ kind: 'castle', id: 'big4', rook: 'static', rarity: 5 });
    expect(catalog.find((entry) => entry.label === 'ビッグ4').catalogOnly).toBeFalsy();
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
  // 自作の規則に置き換えた名前は、自作の規則のほうで確かめる(下)。
  const replaced = new Set(CUSTOM_CASTLE_RULES.filter((rule) => rule.replaces).map((rule) => rule.name));
  const castleRules = master.rules.filter((rule) => rule.group === 'enc_match' && !replaced.has(rule.name));
  const RENAMED = { 銀冠: ['居飛車銀冠'] };
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
        // 名前を分けた形(ひらがなすいしょうの居飛車の「銀冠」は、自作の規則の居飛車銀冠)。
        if (RENAMED[rule.name]?.includes(got)) continue;
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
      銀冠穴熊: 'lnsgkgsnl/1r5b1/ppppppppp/9/9/1PP6/1S1PPPPPP/LGG4R1/KN4SNL b B 1',
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

describe('自作の囲いの規則(F2)', () => {
  const cell = (text, color) => {
    const square = text.slice(0, 2);
    const kind = text.slice(2);
    return color === 'black' ? [square, kind] : [mirrorSquare(square), kind.toLowerCase()];
  };
  for (const color of ['black', 'white']) {
    test(`${color === 'black' ? '先手' : '後手'}: 規則の形を置くとその名前、駒を1つ抜くとその名前にならない`, () => {
      for (const rule of CUSTOM_CASTLE_RULES) {
        const variant = rule.variants[0];
        const cells = [...variant.own, ...(variant.ownAny ?? []).map((group) => group[0])];
        const enemyKing = color === 'black' ? ['51', 'k'] : ['59', 'K'];
        const full = detectFormationSnapshot(sfenOf([...cells.map((text) => cell(text, color)), enemyKing]), master)[color].castle;
        expect(full, rule.name).toBe(rule.name);
        for (const missing of variant.own.filter((text) => !text.endsWith('K'))) {
          const rest = cells.filter((text) => text !== missing).map((text) => cell(text, color));
          const got = detectFormationSnapshot(sfenOf([...rest, enemyKing]), master)[color].castle;
          expect(got, `${rule.name}から${missing}を抜く`).not.toBe(rule.name);
        }
      }
    });
  }

  test('片銀冠に4七の金を足すと銀冠(振り飛車銀冠)', () => {
    const base = ['28K', '27S', '38G', '26P'].map((text) => cell(text, 'black'));
    expect(detectFormationSnapshot(sfenOf([...base, ['51', 'k']]), master).black.castle).toBe('片銀冠');
    const crown = detectFormationSnapshot(sfenOf([...base, ['47', 'G'], ['51', 'k']]), master).black.castle;
    expect(['振り飛車銀冠', '銀冠']).toContain(crown);
  });

  test('居飛車穴熊の銀を8七に上げただけでは銀冠穴熊にならない(前の規則の誤り)', () => {
    const sfen = sfenOf([['99', 'K'], ['98', 'L'], ['89', 'N'], ['87', 'S'], ['78', 'G'], ['51', 'k']]);
    expect(detectFormationSnapshot(sfen, master).black.castle).not.toBe('銀冠穴熊');
  });

  test('進化のもと: すでに組んだ形のうち、いちばん近いもの', () => {
    expect(evolvedFrom('ビッグ4', ['居飛車穴熊', '銀冠穴熊'])).toBe('銀冠穴熊');
    expect(evolvedFrom('ビッグ4', ['居飛車穴熊'])).toBe('居飛車穴熊');
    expect(evolvedFrom('振り飛車銀冠', ['片美濃'])).toBe('片美濃');
    expect(evolvedFrom('居飛車穴熊', ['舟囲い'])).toBe('');
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

describe('コレクションと統計の名前(17章)', () => {
  test('目録にある名前は別名へ寄せない(棒銀で原始棒銀を数えない)。親の名前はコレクションには足す', () => {
    const labels = new Set(catalog.map((entry) => entry.label));
    const names = collectionFormationNames(['棒銀', '一手損角換わり'], labels);
    expect(names).toContain('棒銀');
    expect(names).not.toContain('原始棒銀');
    expect(names).toContain('角換わり');
  });

  test('統計は、くわしい名前があれば親を数えず、目録の呼び方へ寄せ、同じ名前は1回', () => {
    const labels = new Set(catalog.filter((entry) => entry.kind === 'strategy').map((entry) => entry.label));
    expect(statFormationNames(['一手損角換わり', '角換わり'], labels)).toEqual(['一手損角換わり']);
    expect(statFormationNames(['四間飛車', 'ノーマル四間飛車'], labels)).toEqual(['ノーマル四間飛車']);
    expect(statFormationNames(['藤井システム', '四間飛車', '舟囲い'], labels)).toEqual(['藤井システム']);
  });
});
