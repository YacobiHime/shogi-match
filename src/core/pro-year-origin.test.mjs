// 奨励会から棋士の1年へ(docs/pro-year-design.mdの18章)。
import { describe, expect, it } from 'vitest';
import { DEBUT_SEASONS, originDebut, originSceneVars, originText, seasonOfTerm, shoreikaiOrigin } from './pro-year-origin.mjs';
import {
  PRO_USER_ID, PRO_YEAR_TEXT, advanceToNextGame, createProYear, goalChoices, goalProgress, halfYear, packProYear, proYearView, recordProGame, startNextYear, unpackProYear,
  yearEnd, yearStart,
} from './pro-year.mjs';
import { proYearScene, proYearSceneDue } from './pro-year-story.mjs';
import { proYearNote } from './pro-year-note.mjs';
import { STORY_EPISODES } from './story-mode.mjs';
import { closeShoreikaiRun, createShoreikaiCareer, createShoreikaiRun, recordShoreikaiGame } from './shoreikai.mjs';
import { createRoster } from './ryuo-roster.mjs';
import { HANANE } from './ryuo-story.mjs';

const roster = createRoster({ seed: 11, userGroup: 6 });
const PRO = { kishiNumber: 347, entry: '4級', games: 64, wins: 50, losses: 14, mentor: '松本八段', term: 2, place: 1, byJiten: false, leagueTerms: 1, peers: ['佐藤', '鈴木'] };

/** 奨励会の四段の記録から、棋士の1年を始める(ShogiMatchGame.vueのenterProYearと同じ組み立て)。 */
function startFrom(pro, currentFy = 2026, seed = 7) {
  const origin = shoreikaiOrigin(pro);
  const debut = originDebut(origin, currentFy);
  return createProYear({
    seed, fiscalYear: debut.fiscalYear, roster, settings: { world: 30 }, userLevel: 30, userName: 'やこび',
    debut: debut.debut, rivalDebut: debut.rivalDebut, origin, mentorName: origin.mentor,
  });
}

/** 年度の終わりまで、自分の対局を分身で指す。 */
function playOut(state) {
  let current = state;
  for (let step = 0; step < 200 && !current.yearDone; step += 1) {
    current = advanceToNextGame(current);
    if (current.yearDone) break;
    current = recordProGame(current, 'auto').state;
  }
  return current;
}

describe('デビューの季節', () => {
  it('三段リーグの奇数の期は後期で4月1日、偶数の期は前期で10月1日', () => {
    expect(seasonOfTerm(1)).toBe('spring');
    expect(seasonOfTerm(2)).toBe('autumn');
    expect(seasonOfTerm(3)).toBe('spring');
    expect(seasonOfTerm(null)).toBe('spring');
    expect(DEBUT_SEASONS.autumn).toMatchObject({ label: '10月1日', term: '前期' });
  });
  it('記録がなければnull。前の版の記録(期の番号なし)は春のデビュー', () => {
    expect(shoreikaiOrigin(null)).toBeNull();
    expect(shoreikaiOrigin({ kishiNumber: 341, entry: '6級', games: 80, mentor: '' })).toMatchObject({ season: 'spring', kishiNumber: 341, term: null, peers: [] });
  });
  it('春は今の年度の4月1日。秋は前の年度の10月1日(羽音は4月1日から)', () => {
    expect(originDebut(shoreikaiOrigin({ ...PRO, term: 3 }), 2026)).toEqual({ fiscalYear: 2026, debut: '2026-04-01', rivalDebut: '2026-04-01', half: false, label: '4月1日' });
    expect(originDebut(shoreikaiOrigin(PRO), 2026)).toEqual({ fiscalYear: 2025, debut: '2025-10-01', rivalDebut: '2025-04-01', half: true, label: '10月1日' });
  });
  it('画面の言葉: 入口の札・歩みの行・ノートの1行', () => {
    const text = originText(shoreikaiOrigin(PRO));
    expect(text.chip).toBe('棋士番号第347号・10月1日デビュー');
    expect(text.road).toBe('4級で入会 → 第2期三段リーグ1位で四段（棋士番号第347号）');
    expect(text.detail).toBe('奨励会 64局（50勝14敗）・師匠 松本八段');
    expect(text.noteLine).toBe('奨励会から（棋士番号第347号）・10月1日デビュー');
    expect(text.note).toMatch(/半年/);
    expect(originText(shoreikaiOrigin({ ...PRO, term: 4, byJiten: true })).road).toMatch(/2回目の次点/);
  });
});

describe('秋のデビュー(半年の1年目)', () => {
  const state = startFrom(PRO);
  it('10月1日から。デビュー前に自分の対局はなく、半年は目標を選ばない', () => {
    expect(state.fy).toBe(2025);
    expect(state.debut).toBe('2025-10-01');
    expect(state.date).toBe('2025-10-01');
    expect(halfYear(state)).toBe(true);
    expect(Object.values(state.games).some((game) => game.user)).toBe(false);
    expect(state.goals).toMatchObject({ fy: 2025, ids: [], half: true });
    expect(goalProgress(state)).toEqual([]);
    expect(state.origin).toMatchObject({ kind: 'shoreikai', kishiNumber: 347 });
  });
  it('順位戦は次の4月から(この年度の順位戦には出ない)。12月の竜王戦は出る', () => {
    expect(state.cycles['meijin-2025'].withUser).toBe(false);
    expect(state.cycles['ryuo-2025'].withUser).toBe(true);
    expect(goalChoices(state).map((goal) => goal.id)).not.toContain('junniPromote');
  });
  it('羽音は奨励会で先に四段になったので、4月から棋戦に出ている', () => {
    const hanane = Object.values(state.players).find((member) => member.story === HANANE);
    const early = Object.values(state.cycles).filter((cycle) => cycle.base === 2025 && cycle.stages.length && cycle.stages[0].start >= '2025-04-01' && cycle.stages[0].start < '2025-10-01');
    expect(early.length).toBeGreaterThan(0);
    expect(early.some((cycle) => cycle.stages.some((stage) => (stage.entrants ?? []).includes(hanane.id)))).toBe(true);
  });
  it('奨励会からのデビューの場面(棋士番号・師匠・同期・半年の一言)', () => {
    const due = proYearSceneDue(state);
    expect(due).toMatchObject({ key: 'pro-debut', id: 'pro-debut-shoreikai' });
    const scene = proYearScene(due.id, { playerName: 'やこび', vars: due.vars });
    const text = scene.lines.map((line) => line.text).join('\n');
    expect(text).toContain('10月1日');
    expect(text).toContain('第347号');
    expect(text).toContain('松本八段');
    expect(text).toContain('佐藤さんと鈴木さん');
    expect(text).toMatch(/半年/);
    expect(text).not.toMatch(/\{\w+\}/);
    expect(scene.lines.length).toBeLessThanOrEqual(12);
    for (const line of scene.lines.filter((entry) => entry.who === 'hanane')) {
      expect(line.text).not.toMatch(/[!！]/);
      expect(line.text).not.toMatch(/です|ます|ました|ません|ございます|お願い/);
    }
  });
  it('入口の羽音の一言も、敬語と「！」を使わない', () => {
    expect(PRO_YEAR_TEXT.hananeEntryShoreikai).not.toMatch(/[!！]|です|ます/);
    expect(PRO_YEAR_TEXT.entrySubShoreikai('10月1日')).toBe('奨励会から、10月1日にデビュー');
  });
  it('ストーリー選択から読み直しても、記録の言葉なしで読める', () => {
    expect(STORY_EPISODES.some((episode) => episode.scene === 'pro-debut-shoreikai')).toBe(true);
    const scene = proYearScene('pro-debut-shoreikai', { playerName: 'やこび' });
    const text = scene.lines.map((line) => line.text).join('\n');
    expect(text).not.toMatch(/\{\w+\}/);
    expect(text).toContain('デビューの日');
  });
  it('半年を終えると、まとめは半年の年度(将棋大賞なし)。次の年度は順位戦に出て、はじめての1年度の目標', () => {
    const done = playOut(state);
    expect(done.yearDone).toBe(true);
    expect(done.summary).toMatchObject({ half: true, debut: '2025-10-01', awards: [] });
    // 指した自分の対局は、デビューの日から年度の終わりまで(次の年度に続く竜王戦の組の対局は、まだ指していない)。
    const mine = Object.values(done.games).filter((game) => game.user);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((game) => game.date >= '2025-10-01')).toBe(true);
    expect(mine.filter((game) => game.winner).every((game) => game.date <= yearEnd(2025))).toBe(true);
    const next = startNextYear(done);
    expect(next.fy).toBe(2026);
    expect(next.date).toBe(yearStart(2026));
    expect(halfYear(next)).toBe(false);
    expect(next.cycles['meijin-2026'].withUser).toBe(true);
    expect(next.goals).toBeNull();
    const choices = goalChoices(next);
    expect(choices.map((goal) => goal.id)).toContain('junniPromote');
    expect(choices.filter((goal) => goal.recommended).map((goal) => goal.id)).toContain('shinjinBest4');
    const view = proYearView(next);
    expect(view.road.rows[0]).toMatchObject({ fy: 2025, half: true, since: '10月から' });
    expect(view.road.origin.road).toMatch(/第2期三段リーグ1位で四段/);
    // ノートの札(保存の形から): 奨励会からの1行と、半年の年度の「10月から」。
    const note = proYearNote(packProYear(next));
    expect(note.origin).toBe('奨励会から（棋士番号第347号）・10月1日デビュー');
    expect(note.history[0]).toMatchObject({ fy: 2025, since: '10月から' });
  });
  it('保存から戻しても、デビューの日・羽音の日・奨励会からの道が残る', () => {
    const back = unpackProYear(JSON.parse(JSON.stringify(packProYear(state))), roster);
    expect(back).toMatchObject({ debut: '2025-10-01', rivalDebut: '2025-04-01', origin: { kind: 'shoreikai', kishiNumber: 347 } });
    expect(halfYear(back)).toBe(true);
  });
});

describe('春のデビューとふつうの入口', () => {
  it('春は4月1日から1年度まるごと(目標を選ぶ)。場面は奨励会から', () => {
    const state = startFrom({ ...PRO, term: 3 });
    expect(state.fy).toBe(2026);
    expect(state.debut).toBe('2026-04-01');
    expect(halfYear(state)).toBe(false);
    expect(state.goals ?? null).toBeNull();
    expect(state.cycles['meijin-2026'].withUser).toBe(true);
    expect(proYearSceneDue(state)).toMatchObject({ id: 'pro-debut-shoreikai', vars: { date: '4月1日', half: '' } });
  });
  it('奨励会からでなければ、今までどおり(羽音と同じ日の場面・歩みに奨励会の行なし)', () => {
    const state = createProYear({ seed: 7, fiscalYear: 2026, roster, settings: { world: 30 }, userLevel: 30, userName: 'やこび' });
    expect(state.debut).toBe('2026-04-01');
    expect(state.rivalDebut).toBe('2026-04-01');
    expect(state.origin).toBeNull();
    expect(proYearSceneDue(state)).toMatchObject({ id: 'pro-debut' });
    expect(proYearView(state).road.origin).toBeNull();
    expect(proYearNote(packProYear(state)).origin).toBe('');
  });
  it('年度の外のデビューの日は受け取らず、4月1日にする', () => {
    const state = createProYear({ seed: 7, fiscalYear: 2026, roster, settings: { world: 30 }, userLevel: 30, debut: '2030-10-01' });
    expect(state.debut).toBe('2026-04-01');
  });
});

describe('奨励会の四段の記録', () => {
  it('四段になった挑戦を閉じると、期の番号・順位・同期の名前・勝ち負けが残る', () => {
    let run = createShoreikaiRun({ seed: 7, settings: { difficulty: 9, scale: 'mini' }, examRank: 3, userName: 'やこび', userLevel: 20 });
    for (let guard = 0; guard < 600 && run.phase !== 'pro'; guard += 1) run = recordShoreikaiGame(run, 'win', { userLevel: 20 });
    expect(run.phase).toBe('pro');
    const career = closeShoreikaiRun({ ...createShoreikaiCareer(), run });
    expect(career.pro).toMatchObject({ kishiNumber: run.kishiNumber, term: run.lastTerm.term, place: run.lastTerm.place, byJiten: false, wins: run.games.length, losses: 0 });
    expect(career.pro.peers.length).toBeGreaterThan(0);
    const origin = shoreikaiOrigin(career.pro);
    expect(origin.season).toBe(seasonOfTerm(run.lastTerm.term));
    expect(originSceneVars(origin).kishi).toBe(`棋士番号は、第${run.kishiNumber}号。`);
    expect(PRO_USER_ID).toBe('user');
  });
});
