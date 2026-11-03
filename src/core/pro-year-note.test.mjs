import { describe, expect, it } from 'vitest';
import { advanceToNextGame, createProYear, packProYear, recordProGame } from './pro-year.mjs';
import { createRoster } from './ryuo-roster.mjs';
import { loadProYearNote, proYearNote } from './pro-year-note.mjs';

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
