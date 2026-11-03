import { describe, expect, it } from 'vitest';
import { advanceToNextGame, createProYear, recordProGame } from './pro-year.mjs';
import { createRoster } from './ryuo-roster.mjs';
import { HANANE } from './ryuo-story.mjs';
import { PRO_YEAR_SCENES, markProYearScene, proYearScene, proYearSceneDue, seenProYearScene } from './pro-year-story.mjs';

const roster = createRoster({ seed: 3 });
const start = () => createProYear({ seed: 7, fiscalYear: 2026, roster, settings: { world: 30 }, userLevel: 30, userName: 'やこび' });

describe('棋士の1年の場面(docs/pro-year-design.mdの12章)', () => {
  it('台本: 12行まで、羽音は敬語と「！」を使わない', () => {
    for (const scene of Object.values(PRO_YEAR_SCENES)) {
      expect(scene.lines.length).toBeLessThanOrEqual(12);
      for (const entry of scene.lines.filter(({ who }) => who === 'hanane')) {
        expect(entry.text).not.toMatch(/！|です|ます|ございま|お願いします/);
      }
    }
  });

  it('名前・百花の呼び方・棋戦の言葉を差し込む。読み直しのときは決まった言葉', () => {
    const eve = proYearScene('pro-title-eve', { playerName: 'やこび', momokaCall: 'やこびちゃん', vars: { title: '棋王', holder: '天鷺善彦' } });
    expect(eve.lines[1].text).toBe('明日、やこびは天鷺善彦棋王に挑む。');
    expect(eve.lines[2].text).toContain('やこびちゃん');
    expect(proYearScene('pro-title-eve').lines[1].text).toBe('明日、あなたはタイトル保持者のタイトルに挑む。');
    expect(eve.lines.every(({ text }) => !/\{\w+\}/.test(text))).toBe(true);
    expect(proYearScene('none')).toBeNull();
  });

  it('デビューの日は、1年目のまだ指していないときに1回だけ', () => {
    const state = start();
    expect(proYearSceneDue(state)).toMatchObject({ key: 'pro-debut' });
    const seen = markProYearScene(state, 'pro-debut');
    expect(seenProYearScene(seen, 'pro-debut')).toBe(true);
    expect(proYearSceneDue(seen)).toBeNull();
    expect(proYearSceneDue({ ...state, history: [{}] })).toBeNull();
  });

  it('羽音とはじめて当たる対局の前に1回。タイトル戦の第1局の前は、タイトルごとに1回', () => {
    let state = markProYearScene(start(), 'pro-debut');
    let hanane = null;
    let eve = null;
    for (let step = 0; step < 200 && !(hanane && eve); step += 1) {
      state = advanceToNextGame(state);
      if (state.yearDone) break;
      const due = proYearSceneDue(state);
      const opponent = state.players[state.pending.opponentId];
      if (opponent.story === HANANE && !hanane) {
        expect(due).toMatchObject({ key: 'pro-hanane' });
        hanane = due;
        state = markProYearScene(state, due.key);
      } else if (due?.id === 'pro-title-eve' && !eve) {
        expect(state.pending.kind).toBe('finals');
        expect(due.vars.title).toBe(state.pending.titleName);
        eve = due;
        state = markProYearScene(state, due.key);
        expect(proYearSceneDue(state)).toBeNull();
      }
      state = recordProGame(state, 'win').state;
    }
    expect(hanane).not.toBeNull();
    expect(eve).not.toBeNull();
  });
});
