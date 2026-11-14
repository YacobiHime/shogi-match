// 番勝負の相手が羽音・善彦のときのちぐはぐを直したところ(docs/pro-year-design.mdの23章)。
import { describe, expect, it } from 'vitest';
import { advanceToNextGame, clearProYearResults, createProYear, recordProGame, seriesRivalIds, weekView } from './pro-year.mjs';
import { createRoster } from './ryuo-roster.mjs';
import { HANANE } from './ryuo-story.mjs';
import { queuedProYearScene, proYearScene } from './pro-year-story.mjs';
import { bondSceneDue } from './pro-bonds.mjs';
import { storyAdvice } from './coach-insight.mjs';
import { lunchOpponentLine } from './title-day.mjs';
import { HANANE_SHOREIKAI_LINES } from './shoreikai-speech.mjs';

const roster = createRoster({ seed: 11, userGroup: 6 });
const start = () => createProYear({ seed: 7, fiscalYear: 2026, roster, settings: { world: 30 }, userLevel: 30, userName: 'やこび' });

/** 番勝負の第1局で止まった状態。 */
function inSeries() {
  let state = start();
  for (let step = 0; step < 400; step += 1) {
    state = advanceToNextGame(state);
    if (state.yearDone) return null;
    if (state.pending.kind === 'finals') return state;
    state = clearProYearResults(recordProGame(state, 'win').state);
  }
  return null;
}

describe('番勝負の相手とは会わない・絆の場面は後回し', () => {
  const state = inSeries();
  it('番勝負の相手を見つける', () => {
    expect(state).toBeTruthy();
    expect([...seriesRivalIds(state)]).toEqual([state.pending.opponentId]);
    expect(seriesRivalIds(start()).size).toBe(0);
  });

  it('番勝負の相手が羽音なら「人に会う」に羽音を出さない', () => {
    const hanane = state.people.hanane;
    const before = weekView(state);
    expect(before.actions.some((action) => action.id === 'meet-hanane')).toBe(true);
    const vsHanane = structuredClone(state);
    vsHanane.people.hanane = state.pending.opponentId;
    vsHanane.players[state.pending.opponentId].story = HANANE;
    const after = weekView(vsHanane);
    expect(after.actions.some((action) => action.id === 'meet-hanane')).toBe(false);
    expect(hanane).toBeTruthy();
  });

  it('絆の場面は、holdの人を後回しにする', () => {
    const id = state.people.hanane;
    const bonded = structuredClone(state);
    bonded.bonds = { [id]: { points: 999, seen: [] } };
    expect(bondSceneDue(bonded)?.id).toBe(id);
    expect(bondSceneDue(bonded, { hold: [id] })).toBeNull();
  });
});

describe('前の版で積んだ失冠の夜の読みかえ', () => {
  it('羽音に取られた失冠の夜は「羽音に届かなかった夜」として出す(羽音は慰めの電話をかけない)', () => {
    const state = start();
    const hanane = Object.values(state.players).find((player) => player.story === HANANE);
    state.sceneQueue = [{ key: 'pro-title-lost:kio:2026', id: 'pro-title-lost', vars: { title: '棋王', challenger: hanane.name } }];
    const queued = queuedProYearScene(state);
    expect(queued).toMatchObject({ key: 'pro-lost-hanane:kio:2026', id: 'pro-lost-hanane' });
    const text = proYearScene(queued.id, { playerName: 'やこび', vars: queued.vars }).lines.map((line) => line.text).join('\n');
    expect(text).toContain('棋王の座は、羽音に移った。');
    expect(text).not.toContain('取り返しに行くんでしょ');
    // 見たら出さない(読みかえた鍵で見た印を見る)。
    expect(queuedProYearScene({ ...state, scenes: [queued.key] })).toBeNull();
    // ほかの棋士に取られた夜は、今までの失冠の夜のまま。
    state.sceneQueue = [{ key: 'pro-title-lost:kio:2026', id: 'pro-title-lost', vars: { title: '棋王', challenger: '若手の棋士' } }];
    expect(queuedProYearScene(state)?.id).toBe('pro-title-lost');
  });
});

describe('対局中・休憩の一言', () => {
  it('羽音の逆転の一言は、名簿のidでなく人物の印で見分ける', () => {
    const input = { playerScore: { type: 'cp', value: 400 }, previousScore: { type: 'cp', value: -400 }, endgame: false };
    expect(storyAdvice({ ...input, opponent: { id: 'r12', name: '天鷺羽音', story: HANANE } })?.key).toBe('story-hanane-turn');
    expect(storyAdvice({ ...input, opponent: { id: 'r12', name: 'ほかの棋士' } })).toBeNull();
  });

  it('善彦の昼食の一言は丁寧語', () => {
    expect(lunchOpponentLine('天ぷらそば', 'yoshihiko')).toMatch(/ました|です/);
  });

  it('羽音がまだ三段なら、三段リーグで先に抜けた人の言葉を言わない', () => {
    expect(HANANE_SHOREIKAI_LINES.leagueRival).not.toContain('抜けた');
    expect(HANANE_SHOREIKAI_LINES.leagueRival).not.toMatch(/！|です|ます/);
  });
});

describe('研究会で指していないのに「何度も指した」と言わない', async () => {
  const { proYearSceneDue, markProYearScene } = await import('./pro-year-story.mjs');
  it('羽音の初手合は、研究会の記録があるかで1行を変える', () => {
    let state = markProYearScene(start(), 'pro-debut');
    for (let step = 0; step < 300; step += 1) {
      state = advanceToNextGame(state);
      if (state.players[state.pending.opponentId]?.story === HANANE) break;
      state = clearProYearResults(recordProGame(state, 'win').state);
    }
    const textOf = (s) => {
      const due = proYearSceneDue(s);
      return proYearScene(due.id, { playerName: 'やこび', vars: due.vars }).lines.map((line) => line.text).join('\n');
    };
    const fresh = structuredClone(state);
    fresh.study = { ...(fresh.study ?? {}), records: {} };
    expect(textOf(fresh)).toContain('今日のは、記録に残る1局。');
    expect(textOf(fresh)).not.toContain('研究会では');
    const studied = structuredClone(state);
    studied.study = { ...(studied.study ?? {}), records: { [state.pending.opponentId]: { w: 1, l: 2, d: 0 } } };
    expect(textOf(studied)).toContain('研究会では何度も指したけど');
  });
});
