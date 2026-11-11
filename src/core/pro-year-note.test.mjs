import { describe, expect, it } from 'vitest';
import { advanceToNextGame, createProYear, packProYear, recordProGame } from './pro-year.mjs';
import { createRoster } from './ryuo-roster.mjs';
import { crownName, loadProYearNote, proYearNote, proYearProfileTitles } from './pro-year-note.mjs';

describe('やこびノートの棋士の1年の札(docs/pro-year-design.mdの12章)', () => {
  it('始めていなければnull。今年度の自分の勝ち負け・順位戦のクラスを保存から数える', () => {
    expect(proYearNote(null)).toBeNull();
    expect(loadProYearNote({ getItem: () => '{' })).toBeNull();
    let state = createProYear({ seed: 7, fiscalYear: 2026, roster: createRoster({ seed: 3 }), settings: { world: 30 }, userLevel: 30, userName: 'やこび' });
    for (let i = 0; i < 4; i += 1) {
      state = advanceToNextGame(state);
      state = recordProGame(state, i === 2 ? 'loss' : 'win').state;
    }
    const note = proYearNote(JSON.parse(JSON.stringify(packProYear(state))));
    expect(note).toMatchObject({ fy: 2026, wins: 3, losses: 1, cls: 'C級2組', titles: [], history: [] });
  });
});

describe('棋士の1年の結果をノートと称号へ(docs/pro-year-design.mdの17章)', () => {
  const base = () => createProYear({ seed: 7, fiscalYear: 2026, roster: createRoster({ seed: 3 }), settings: { world: 30 }, userLevel: 30, userName: 'やこび' });

  it('札に段位・通算・持っているタイトルと冠・通算期数・棋戦優勝・将棋大賞', () => {
    const state = base();
    state.titles = { ...state.titles, kio: 'user', oza: 'user' };
    state.user.titleCounts = { kio: 2, oza: 1 };
    state.user.cupCounts = { nhk: 1 };
    state.history = [{ fy: 2025, wins: 30, losses: 10, titles: ['棋王'], awards: ['最多勝利賞'], champions: ['NHK杯'], dan: '五段' }];
    const note = proYearNote(JSON.parse(JSON.stringify(packProYear(state))));
    expect(note.dan).toBe('四段');
    expect(note.total).toEqual({ wins: 30, losses: 10 });
    expect(note.titles).toEqual(['王座', '棋王']);
    expect(note.crown).toBe('二冠');
    expect(note.titleRows.map((row) => `${row.short}${row.count}`)).toEqual(['王座1', '棋王2']);
    expect(note.cupRows.map((row) => row.name)).toEqual(['NHK杯']);
    expect(note.awards).toBe(1);
    expect(note.history[0].champions).toEqual(['NHK杯']);
  });

  it('前の保存(優勝の回数を持たない)は、年度のまとめの名前から数える', () => {
    const state = base();
    state.history = [{ fy: 2025, wins: 1, losses: 0, titles: [], awards: [], champions: ['新人王戦', 'NHK杯'] }, { fy: 2026, wins: 1, losses: 0, titles: [], awards: [], champions: ['新人王戦'] }];
    delete state.user.cupCounts;
    const note = proYearNote(JSON.parse(JSON.stringify(packProYear(state))));
    expect(Object.fromEntries(note.cupRows.map((row) => [row.id, row.count]))).toEqual({ nhk: 1, shinjin: 2 });
  });

  it('称号: タイトルは1つずつ(通算期数)、2つ以上同時なら○冠、棋戦優勝。竜王戦の大会の称号とidを分ける', () => {
    const state = base();
    expect(proYearProfileTitles(state)).toEqual([]);
    state.titles = { ...state.titles, ryuo: 'user', kio: 'user', oza: 'user' };
    state.user.titleCounts = { ryuo: 1, kio: 3, oza: 1 };
    state.user.cupCounts = { asahi: 2 };
    const titles = proYearProfileTitles(state);
    expect(titles.map((title) => title.id)).toEqual(['pro-title-ryuo', 'pro-title-oza', 'pro-title-kio', 'pro-crowns', 'pro-cup-asahi']);
    expect(titles[0].label).toBe('棋士の1年 竜王');
    expect(titles[2].detail).toContain('通算3期');
    expect(titles.find((title) => title.id === 'pro-crowns')).toMatchObject({ label: '棋士の1年 三冠', rank: 23 });
    expect(titles.at(-1)).toMatchObject({ label: '朝日杯優勝', rank: 9 });
    // 失冠しても、いちばん多く持った冠の数を残す。
    state.titles = { ...state.titles, ryuo: 'x', oza: 'x' };
    state.user.bestCrowns = 3;
    expect(proYearProfileTitles(state).find((title) => title.id === 'pro-crowns').label).toBe('棋士の1年 三冠');
    expect(crownName(1)).toBe('');
    expect(crownName(8)).toBe('八冠');
  });
});
