import { describe, expect, it } from 'vitest';
import {
  MAX_OPENING_SHARE, PRO_OPENINGS, createUsage, openingEntry, partyOfUsage, pickOpening, staticShare, toPercent, usageRows,
} from './opening-usage.mjs';
import { createRng } from './ryuo-random.mjs';
import { createRepertoire } from './ryuo-repertoire.mjs';
import { CPU_OPENING_STRATEGY_IDS } from './cpu-opening-repertoire.mjs';
import { OPENING_CASTLES, OPENING_STRATEGIES, openingDefinitionRookStyle } from './opening-guide.mjs';
import { STORY_PEOPLE, YOSHIHIKO } from './ryuo-story.mjs';

const sum = (table) => Object.values(table).reduce((total, value) => total + value, 0);

describe('戦法と囲いの目録', () => {
  it('CPUが指せる戦法と、飛車の振り方の合う囲いだけ', () => {
    const strategies = new Map(OPENING_STRATEGIES.map((strategy) => [strategy.id, strategy]));
    const castleIds = new Set(OPENING_CASTLES.map(({ id }) => id));
    for (const opening of PRO_OPENINGS) {
      expect(strategies.has(opening.strategy), opening.id).toBe(true);
      expect(CPU_OPENING_STRATEGY_IDS.includes(opening.strategy), opening.id).toBe(true);
      expect(openingDefinitionRookStyle(opening.strategy, 'strategy'), opening.id).toBe(opening.rook);
      for (const [castle] of opening.castles) {
        if (castle === '') {
          // 囲いと一体の戦法(腰掛け銀・藤井システム)は、囲いを指定しない。
          expect(strategies.get(opening.strategy).integrated, opening.id).toBe(true);
          continue;
        }
        expect(castleIds.has(castle), `${opening.id}:${castle}`).toBe(true);
        const castleStyle = openingDefinitionRookStyle(castle, 'castle') ?? 'both';
        expect(castleStyle === 'both' || castleStyle === opening.rook, `${opening.id}:${castle}`).toBe(true);
      }
    }
  });

  it('百分率は合計100の整数', () => {
    expect(sum(toPercent({ a: 1, b: 1, c: 1 }))).toBe(100);
    expect(toPercent({ a: 2, b: 1 })).toEqual({ a: 67, b: 33 });
    expect(toPercent({})).toEqual({});
  });
});

describe('使用率', () => {
  it('得意戦法を上位にし、ほかの戦法にも割り振る。1つの戦法は6割まで。先後で少し違う', () => {
    const rng = createRng(3);
    for (let index = 0; index < 300; index += 1) {
      const repertoire = createRepertoire(rng, 1 + (index % 6));
      const { usage } = repertoire;
      expect(sum(usage.black)).toBe(100);
      expect(sum(usage.white)).toBe(100);
      expect(Math.max(...Object.values(usage.black))).toBeLessThanOrEqual(MAX_OPENING_SHARE);
      expect(Object.keys(usage.black).length).toBeGreaterThanOrEqual(3);
      for (const castles of Object.values(usage.castles)) expect(sum(castles)).toBe(100);
      // 居飛車党は居飛車、振り飛車党は振り飛車だけを指す。
      if (repertoire.party === 'static') expect(staticShare(usage)).toBe(100);
      if (repertoire.party === 'ranging') expect(staticShare(usage)).toBe(0);
    }
    expect(partyOfUsage({ black: { aigakari: 90, shiken: 10 }, white: { aigakari: 90, shiken: 10 } })).toBe('static');
    expect(partyOfUsage({ black: { aigakari: 50, shiken: 50 }, white: { aigakari: 50, shiken: 50 } })).toBe('both');
  });

  it('1局ごとに、手番の使用率で戦法を、戦法ごとの使用率で囲いを選ぶ', () => {
    const usage = {
      black: { kakugawari: 100 },
      white: { gangi: 50, aigakari: 50 },
      castles: { kakugawari: { 'early-castle': 100 }, gangi: { gangi: 100 }, aigakari: { funagakoi: 70, nakazumai: 30 } },
    };
    const rng = createRng(5);
    expect(pickOpening(rng, usage, { color: 'black' })).toMatchObject({ opening: 'kakugawari', strategy: 'kakugawari', castle: 'early-castle', rook: 'static' });
    const white = Array.from({ length: 2000 }, () => pickOpening(rng, usage, { color: 'white' }));
    expect(white.filter(({ opening }) => opening === 'gangi').length / 2000).toBeCloseTo(0.5, 1);
    const aigakari = white.filter(({ opening }) => opening === 'aigakari');
    expect(aigakari.filter(({ castle }) => castle === 'funagakoi').length / aigakari.length).toBeCloseTo(0.7, 1);
  });

  it('相手が振り飛車なら、居飛車は対抗形。相手が居飛車なら、対抗形の居飛車は選ばない', () => {
    const usage = {
      black: { aigakari: 60, ibisha: 40 }, white: { aigakari: 60, ibisha: 40 },
      castles: { aigakari: { funagakoi: 100 }, ibisha: { 'ibisha-anaguma': 60, 'left-mino': 40 } },
    };
    const rng = createRng(8);
    for (let index = 0; index < 200; index += 1) {
      expect(pickOpening(rng, usage, { opponentRook: 'ranging' }).opening).toBe('ibisha');
      expect(pickOpening(rng, usage, { opponentRook: 'static' }).opening).toBe('aigakari');
    }
  });

  it('名鑑の行は多い順。囲いと一体の戦法は囲いを出さない', () => {
    const rows = usageRows({
      black: { 'kakugawari-kg': 60, aigakari: 40 }, white: { 'kakugawari-kg': 40, aigakari: 60 },
      castles: { 'kakugawari-kg': { '': 100 }, aigakari: { funagakoi: 100 } },
    });
    expect(rows.map(({ share }) => share)).toEqual([50, 50]);
    expect(rows.find(({ id }) => id === 'kakugawari-kg').castles).toEqual([]);
    expect(openingEntry('aigakari', 'nakazumai')).toMatchObject({ label: '相掛かり（中住まい）', castle: 'nakazumai' });
    expect(openingEntry('kakugawari-kg', '')).toMatchObject({ label: '角換わり腰掛け銀', castle: '' });
  });

  it('善彦はオールラウンダー。いちばん多い戦法でも2割ほどで、居飛車7割', () => {
    const usage = STORY_PEOPLE[YOSHIHIKO].repertoire.usage;
    expect(Math.max(...Object.values(usage.black))).toBeLessThanOrEqual(22);
    expect(staticShare(usage)).toBeGreaterThanOrEqual(65);
    expect(staticShare(usage)).toBeLessThanOrEqual(75);
    expect(partyOfUsage(usage)).toBe('both');
    expect(createUsage(createRng(1), { party: 'static', styles: ['aigakari'] }).black.aigakari).toBeGreaterThan(20);
  });
});
