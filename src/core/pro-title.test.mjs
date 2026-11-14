// 棋士の1年のタイトルの防衛・獲得・奪還・失冠と結果の札(docs/pro-year-design.mdの19章)。
import { describe, expect, it } from 'vitest';
import {
  ETERNAL_RULES, applyTitleResult, crownsLabel, emptyTitleRecord, eternalProgress, eternalRuleText, isTitleWin, seriesStatusText, titleCoachLine, titleKind,
  titleResultText,
} from './pro-title.mjs';
import {
  PRO_USER_ID, TITLE_EVENTS, advanceToNextGame, clearProYearResults, createProYear, packProYear, proEvent, proYearView, recordProGame, startNextYear,
  titleRecordsView, unpackProYear,
} from './pro-year.mjs';
import { createRoster } from './ryuo-roster.mjs';
import { headlineOf } from './pro-news.mjs';
import { proYearAward } from './season-award.mjs';
import { proYearProfileTitles } from './pro-year-note.mjs';

const roster = createRoster({ seed: 11, userGroup: 6 });
const start = (seed = 7) => createProYear({ seed, fiscalYear: 2026, roster, settings: { world: 30 }, userLevel: 30, userName: 'やこび' });

/**
 * 1年度を指す。outcomeは局ごとの結果('win' | 'loss')を返す関数。保持者のまま挑戦者決定を指した局と、見えた結果の札を集める。
 * @param {any} state
 * @param {(state: any) => 'win' | 'loss'} outcome
 */
function playYear(state, outcome = () => 'win') {
  let current = state;
  const holderPrelims = [];
  const results = [];
  const titleGames = [];
  for (let step = 0; step < 400; step += 1) {
    current = advanceToNextGame(current);
    if (current.yearDone) break;
    const game = current.games[current.pending.gameId];
    const def = proEvent(game.event).stages[game.stage];
    if (current.titles[game.event] === PRO_USER_ID && !def.title) holderPrelims.push(game.label);
    if (def.title) titleGames.push({ label: game.label, defense: current.pending.defense, stakes: current.pending.stakes.text });
    current = recordProGame(current, outcome(current)).state;
    results.push(...current.results);
    current = clearProYearResults(current);
  }
  return { state: current, holderPrelims, results, titleGames };
}

describe('タイトルの記録(pro-title.mjs)', () => {
  it('番勝負の結果を、防衛・獲得・奪還・失冠・届かずに分ける', () => {
    expect(titleKind({ holder: true, won: true, everHeld: true })).toBe('defend');
    expect(titleKind({ holder: true, won: false, everHeld: true })).toBe('lost');
    expect(titleKind({ holder: false, won: true, everHeld: false })).toBe('take');
    expect(titleKind({ holder: false, won: true, everHeld: true })).toBe('retake');
    expect(titleKind({ holder: false, won: false, everHeld: false })).toBe('miss');
    expect(['defend', 'take', 'retake'].every(isTitleWin)).toBe(true);
    expect(isTitleWin('lost')).toBe(false);
  });

  it('言葉は防衛を「獲得」と言わない', () => {
    expect(titleResultText({ kind: 'defend', short: '竜王', streak: 1 })).toBe('竜王を防衛');
    expect(titleResultText({ kind: 'defend', short: '竜王', streak: 3 })).toBe('竜王を防衛（3連覇）');
    expect(titleResultText({ kind: 'take', short: '竜王' })).toBe('竜王を獲得');
    expect(titleResultText({ kind: 'retake', short: '竜王' })).toBe('竜王を奪還');
    expect(titleResultText({ kind: 'lost', short: '竜王' })).toBe('竜王を失冠');
    expect(titleResultText({ kind: 'miss', short: '竜王', score: [2, 4] })).toBe('竜王への挑戦は2勝4敗で届かず');
    for (const kind of ['defend', 'take', 'retake', 'lost', 'miss']) expect(titleCoachLine({ kind, short: '竜王', streak: 2, total: 3 })).not.toMatch(/残念|失敗/);
  });

  it('通算・連覇・防衛を数え、失冠で連覇が切れる', () => {
    let record = emptyTitleRecord();
    record = applyTitleResult(record, { event: 'kio', kind: 'take', fy: 2026 });
    record = applyTitleResult(record, { event: 'kio', kind: 'defend', fy: 2027 });
    expect(record).toMatchObject({ total: 2, streak: 2, best: 2, defenses: 1, first: 2026, eternal: null });
    record = applyTitleResult(record, { event: 'kio', kind: 'lost', fy: 2028 });
    expect(record).toMatchObject({ total: 2, streak: 0, best: 2 });
    record = applyTitleResult(record, { event: 'kio', kind: 'retake', fy: 2029 });
    expect(record).toMatchObject({ total: 3, streak: 1, defenses: 1 });
  });

  it('永世称号は実物の条件(連続・通算)で、届いた年度を残す', () => {
    expect(Object.keys(ETERNAL_RULES).sort()).toEqual([...TITLE_EVENTS].sort());
    expect(eternalRuleText('ryuo')).toBe('連続5期・通算7期');
    expect(eternalRuleText('meijin')).toBe('通算5期');
    let record = emptyTitleRecord();
    const fys = [];
    for (let fy = 2026; fy < 2031; fy += 1) {
      record = applyTitleResult(record, { event: 'kio', kind: fy === 2026 ? 'take' : 'defend', fy });
      fys.push(eternalProgress('kio', record).text);
    }
    expect(fys).toEqual(['永世棋王まで あと4期', '永世棋王まで あと3期', '永世棋王まで あと2期', '永世棋王まで あと1期', '永世棋王の資格あり']);
    expect(record.eternal).toBe(2030);
    // 通算で届く棋戦(名人は通算5期)。途中で失冠しても数える。
    let meijin = emptyTitleRecord();
    for (const [fy, kind] of [[2026, 'take'], [2027, 'defend'], [2028, 'lost'], [2029, 'retake'], [2030, 'defend'], [2031, 'defend']]) meijin = applyTitleResult(meijin, { event: 'meijin', kind, fy });
    expect(meijin.eternal).toBe(2031);
    expect(eternalProgress('ryuo', { ...emptyTitleRecord(), total: 5, streak: 2 }).text).toBe('永世竜王まで あと2期（通算）');
    expect(eternalProgress('ryuo', { ...emptyTitleRecord(), total: 3, streak: 3 }).text).toBe('永世竜王まで あと2期（連続）');
  });

  it('番勝負の途中の言葉と○冠', () => {
    expect(seriesStatusText({ me: 3, them: 1, need: 4, defense: true })).toBe('防衛まであと1勝');
    expect(seriesStatusText({ me: 1, them: 3, need: 4, defense: true })).toBe('カド番');
    expect(seriesStatusText({ me: 3, them: 3, need: 4, defense: false })).toBe('次で決まる');
    expect(seriesStatusText({ me: 1, them: 1, need: 3, defense: false })).toBe('タイトルまであと2勝');
    expect(seriesStatusText({ me: 4, them: 2, need: 4, defense: true })).toBe('防衛');
    expect(crownsLabel(1)).toBe('');
    expect(crownsLabel(3)).toBe('三冠');
    expect(crownsLabel(8)).toBe('八冠');
  });
});

describe('タイトル保持者の1年(藤井聡太のような強さで全部勝つ)', () => {
  const year1 = playYear(start());
  const year2 = playYear(startNextYear(year1.state));

  it('保持者は、そのタイトルの予選・挑戦者決定戦を指さない', () => {
    expect(year1.holderPrelims).toEqual([]);
    expect(year2.holderPrelims).toEqual([]);
  });

  it('2年度目は、持っているタイトルの防衛戦を指し、防衛と数える', () => {
    const held = TITLE_EVENTS.filter((id) => year1.state.titles[id] === PRO_USER_ID);
    expect(held.length).toBeGreaterThan(0);
    const defenses = year2.results.filter((item) => item.type === 'title' && item.kind === 'defend');
    expect(defenses.length).toBeGreaterThanOrEqual(held.length);
    // 防衛戦は保持者として指し、賭けるものは「防衛」。
    expect(year2.titleGames.some((game) => game.defense && /防衛をかけて/.test(game.stakes))).toBe(true);
    for (const item of defenses) {
      expect(item.text).toMatch(/防衛/);
      expect(item.text).not.toMatch(/獲得/);
      expect(item.score[0]).toBe(item.need);
    }
    const record = year2.state.user.titleRecord[defenses[0].event];
    expect(record.defenses).toBeGreaterThanOrEqual(1);
    expect(year2.state.user.titleCounts[defenses[0].event]).toBe(record.total);
  });

  it('防衛戦の相手が決まった日に札が出て、相手は保持者でない', () => {
    const challengers = year2.results.filter((item) => item.type === 'challenger');
    expect(challengers.length).toBeGreaterThan(0);
    for (const item of challengers) {
      expect(item.opponent.name).toBeTruthy();
      expect(item.opponent.id).not.toBe(PRO_USER_ID);
      expect(item.eternal?.text).toMatch(/永世|名誉/);
    }
  });

  it('結果の札: 「この1局」の札に番勝負の星・賞金・年度の成績、大きな節目は別の札', () => {
    const game = year2.results.find((item) => item.type === 'game' && item.series?.title);
    expect(game).toMatchObject({ won: true, series: { defense: expect.any(Boolean) } });
    expect(game.record.w).toBeGreaterThan(0);
    expect(game.lines.every((line) => !/防衛|獲得/.test(line))).toBe(true);
    const kinds = new Set([...year1.results, ...year2.results].map((item) => item.type));
    for (const kind of ['game', 'title', 'challenge', 'crowns', 'cup', 'dan', 'promote']) expect(kinds.has(kind), kind).toBe(true);
    // 「この1局」の札は、その局で決まった節目の札より前。
    const titleIndex = year1.results.findIndex((item) => item.type === 'title');
    expect(year1.results[titleIndex - 1].type).toBe('game');
  });

  it('年度のまとめ・ニュース・賞状・ノートも防衛と言う', () => {
    const summary = year2.state.summary;
    expect(summary.titleLog.some((entry) => /防衛/.test(entry.text))).toBe(true);
    expect(summary.crowns).toMatch(/冠$/);
    expect(headlineOf({ kind: 'defend', short: '棋王', streak: 3 }, 'やこび九段')).toBe('やこび九段、棋王を防衛 3連覇');
    expect(headlineOf({ kind: 'crown', short: '棋王', retake: true }, 'やこび九段')).toBe('やこび九段、棋王を奪還');
    expect(proYearAward({ cycle: 'kio-2027', name: '棋王戦', short: '棋王', title: true, fy: 2027, wins: 3, losses: 0, kind: 'defend', streak: 2 }).prize).toBe('棋王防衛（2連覇）');
    expect(proYearAward({ cycle: 'kio-2027', name: '棋王戦', short: '棋王', title: true, fy: 2027, wins: 3, losses: 0 }).prize).toBe('棋王獲得');
    const titles = proYearProfileTitles(year2.state);
    const defended = titles.find((entry) => entry.id === 'pro-title-kio');
    expect(defended.detail).toMatch(/通算\d+期/);
    expect(defended.detail).toMatch(/連覇/);
    const view = proYearView(year2.state);
    expect(view.crowns).toMatch(/冠$/);
    expect(titleRecordsView(year2.state).find((row) => row.id === 'kio')).toMatchObject({ holding: true, eternalText: expect.stringMatching(/永世棋王/) });
  });

  it('竜王戦の組の昇級は、決まったときに効く', () => {
    const promote = year1.results.find((item) => item.type === 'promote' && item.event === 'ryuo')
      ?? year2.results.find((item) => item.type === 'promote' && item.event === 'ryuo');
    expect(promote).toBeTruthy();
  });

  it('保存から戻しても、見ていない結果の札とタイトルの記録が残る', () => {
    const state = recordProGame(advanceToNextGame(year2.state.yearDone ? startNextYear(year2.state) : year2.state), 'win').state;
    expect(state.results.length).toBeGreaterThan(0);
    const back = unpackProYear(JSON.parse(JSON.stringify(packProYear(state))), roster);
    expect(back.results).toEqual(state.results);
    expect(back.user.titleRecord).toEqual(state.user.titleRecord);
    expect(clearProYearResults(back).results).toEqual([]);
  });
});

describe('失冠と奪還', () => {
  const year1 = playYear(start());
  // 2年度目は、保持者として指す番勝負だけ負ける。
  const year2 = playYear(startNextYear(year1.state), (state) => (state.pending.defense ? 'loss' : 'win'));
  const year3 = playYear(startNextYear(year2.state));

  it('保持者で負けたら「失冠」で、連覇が切れ、責めない一言', () => {
    const lost = year2.results.filter((item) => item.type === 'title' && item.kind === 'lost');
    expect(lost.length).toBeGreaterThan(0);
    for (const item of lost) {
      expect(item.text).toBe(`${item.short}を失冠`);
      expect(item.line).not.toMatch(/残念|失敗/);
      expect(year2.state.user.titleRecord[item.event].streak).toBe(0);
    }
    expect(year2.state.summary.titleLog.some((entry) => entry.kind === 'lost')).toBe(true);
  });

  it('失冠したら、次の期は挑戦者決定の終盤から(前の保持者のシード)', () => {
    const lost = year2.results.filter((item) => item.type === 'title' && item.kind === 'lost' && !['ryuo', 'meijin'].includes(item.event));
    for (const item of lost) expect(year2.state.user.seeds[item.event]).toBe(proEvent(item.event).stages.length - 2);
  });

  it('取り返したら「奪還」', () => {
    const lostEvents = new Set(year2.results.filter((item) => item.type === 'title' && item.kind === 'lost').map((item) => item.event));
    const retaken = year3.results.filter((item) => item.type === 'title' && item.kind === 'retake');
    expect(retaken.length).toBeGreaterThan(0);
    for (const item of retaken) {
      expect(lostEvents.has(item.event)).toBe(true);
      expect(item.text).toBe(`${item.short}を奪還`);
    }
  });

  it('前の版の保存(通算期数だけ)から防衛しても、連覇を数え直す', () => {
    const old = structuredClone(year1.state);
    delete old.user.titleRecord;
    const next = playYear(startNextYear(old));
    const defended = next.results.find((item) => item.type === 'title' && item.kind === 'defend');
    expect(defended.streak).toBe(2);
    expect(defended.total).toBe(2);
  });
});

describe('名人のプレイヤー', () => {
  it('名人は順位戦を指さず、A級の1位の挑戦を受ける', () => {
    const state = start();
    state.titles.meijin = PRO_USER_ID;
    state.user.cls = 'A';
    for (const cycle of Object.values(state.cycles)) if (cycle.event === 'meijin' && !cycle.done) cycle.holder = PRO_USER_ID;
    const year = playYear(state);
    const junniGames = year.results.filter((item) => item.type === 'game' && /順位戦/.test(item.label));
    expect(junniGames).toEqual([]);
    const meijin = year.results.find((item) => item.type === 'title' && item.event === 'meijin');
    expect(meijin?.kind).toBe('defend');
  });
});

describe('結果の札の並び(pro-year-results.mjs)', () => {
  const game = (won, extra = {}) => ({ type: 'game', label: '叡王戦五番勝負 第3局', opponent: '井上', opponentDan: '八段', won, record: { w: 10, l: 2 }, earned: 30, lines: [], ...extra });

  it('「この1局」の次に大きな節目を1枚ずつ。続いた対局は1枚の一覧', async () => {
    const { resultPages, hasBigResult } = await import('./pro-year-results.mjs');
    const pages = resultPages([
      game(true, { series: { me: 3, them: 0, need: 3, defense: true, status: '防衛' } }),
      { type: 'title', kind: 'defend', name: '叡王戦', short: '叡王', streak: 3, total: 3, defenses: 2, score: [3, 0], opponent: '井上', eternal: { reached: false, text: '永世叡王まで あと2期' }, line: '3連覇！' },
      game(true), game(false), game(true),
      { type: 'goal', label: '新人王戦で優勝' },
    ]);
    expect(pages.map((page) => page.kind)).toEqual(['game', 'title', 'games', 'goal']);
    expect(pages[0]).toMatchObject({ seal: '勝', seriesText: '防衛', defense: true, series: { me: 3, them: 0, need: 3 } });
    expect(pages[0].facts.map((fact) => fact.value)).toEqual(['30万円', '10勝2敗']);
    expect(pages[1]).toMatchObject({ heading: '叡王 防衛', sub: '3連覇', seal: '防', tone: 'gold', confetti: true });
    expect(pages[1].lines).toContain('永世叡王まで あと2期');
    expect(pages[2]).toMatchObject({ heading: '3局 2勝1敗' });
    expect(pages.at(-1).last).toBe(true);
    expect(hasBigResult([game(true)])).toBe(false);
    expect(hasBigResult([game(true), { type: 'dan', from: '四段', to: '五段' }])).toBe(true);
  });

  it('失冠・届かずは控えめで判子なし、防衛戦の相手の札は永世称号に届く局を言う', async () => {
    const { resultPages } = await import('./pro-year-results.mjs');
    const pages = resultPages([
      { type: 'title', kind: 'lost', name: '竜王戦', short: '竜王', streak: 0, total: 4, score: [2, 4], opponent: '中村', line: '' },
      { type: 'title', kind: 'miss', name: '名人戦', short: '名人', score: [1, 4], opponent: '天鷺', line: '' },
      { type: 'challenger', name: '竜王戦', short: '竜王', series: '竜王戦七番勝負', opponent: { name: '中村', dan: '八段', rating: 2400, wins: 30, losses: 8 }, met: [2, 1], streak: 4, eternal: { left: 1, name: '永世竜王', text: '永世竜王まで あと1期（連続）' }, line: '' },
    ]);
    expect(pages[0]).toMatchObject({ heading: '竜王 失冠', tone: 'calm', seal: '' });
    expect(pages[1]).toMatchObject({ heading: '名人への挑戦', sub: '1勝4敗で届かず', tone: 'calm' });
    expect(pages[2].lines).toEqual(['挑戦者 中村八段', '防衛すれば5連覇', '防衛すれば永世竜王の資格']);
    expect(pages[2].facts.map((fact) => fact.value)).toEqual(['R2400', '30勝8敗', '2勝1敗']);
  });
});

describe('防衛戦の夜(docs/pro-year-design.mdの20章)', async () => {
  const { proYearSceneDue, proYearSealSceneId, proYearScene, queuedProYearScene, markProYearScene, isStreakSceneMark } = await import('./pro-year-story.mjs');
  const { storyEpisode } = await import('./story-mode.mjs');

  /** 年度の中で、保持者として指す番勝負の第1局で止まった状態を探す。 */
  function firstDefenseGame(state) {
    let current = state;
    for (let step = 0; step < 400; step += 1) {
      current = advanceToNextGame(current);
      if (current.yearDone) return null;
      const pending = current.pending;
      if (pending.kind === 'finals' && pending.defense && !(pending.series?.games?.length)) return current;
      current = clearProYearResults(recordProGame(current, 'win').state);
    }
    return null;
  }
  const year1 = playYear(start());

  it('防衛戦の第1局は「防衛戦の前夜」で、挑戦者の名前が挑戦者の欄に入る(逆さまの文にしない)', () => {
    const state = firstDefenseGame(startNextYear(year1.state));
    expect(state).toBeTruthy();
    const due = proYearSceneDue(state);
    expect(due.id).toBe('pro-defense-eve');
    const challenger = state.players[state.pending.opponentId].name;
    expect(due.vars.challenger).toBe(challenger);
    const scene = proYearScene(due.id, { playerName: 'やこび', vars: due.vars });
    const text = scene.lines.map((entry) => entry.text).join('\n');
    expect(text).toContain(`${challenger}が挑戦者としてやこびに挑んでくる`);
    expect(text).not.toMatch(/に挑む。/);
    // 一度見たら、同じタイトルの防衛戦では出さない。
    expect(proYearSceneDue(markProYearScene(state, due.key))).toBeNull();
  });

  it('防衛すれば永世称号に届く番勝負は「記録の前夜」', () => {
    const state = firstDefenseGame(startNextYear(year1.state));
    const pending = { ...state.pending, titleStakes: { streak: 4, eternal: { name: '永世棋王', reached: false, left: 1, text: '' } } };
    const due = proYearSceneDue({ ...state, pending });
    expect(due).toMatchObject({ id: 'pro-defense-eternal', vars: { eternal: '永世棋王' } });
  });

  it('封じ手の夜は、防衛戦なら守る側の3本', () => {
    expect(proYearSealSceneId({ winsUser: 2, winsOpponent: 1, need: 4, defense: true })).toBe('pro-seal-defense-lead');
    expect(proYearSealSceneId({ winsUser: 1, winsOpponent: 1, need: 4, defense: true })).toBe('pro-seal-defense-tie');
    expect(proYearSealSceneId({ winsUser: 1, winsOpponent: 3, need: 4, defense: true })).toBe('pro-seal-defense-kado');
    expect(proYearSealSceneId({ winsUser: 1, winsOpponent: 3, need: 4 })).toBe('pro-seal-kado');
  });

  it('3連覇で連覇の夜を積み、見たら消える。失冠したら失冠の夜', () => {
    expect([2, 3, 4, 5, 10, 11].map(isStreakSceneMark)).toEqual([false, true, false, true, true, false]);
    const year2 = playYear(startNextYear(year1.state));
    const year3 = playYear(startNextYear(year2.state));
    const queued = queuedProYearScene(year3.state);
    expect(queued?.id).toBe('pro-defense-streak');
    expect(queued.vars.streak).toBe('3');
    const text = proYearScene(queued.id, { playerName: 'やこび', vars: queued.vars }).lines.map((entry) => entry.text).join('\n');
    expect(text).toContain('3連覇');
    let seen = year3.state;
    while (queuedProYearScene(seen)) seen = markProYearScene(seen, queuedProYearScene(seen).key);
    expect(queuedProYearScene(seen)).toBeNull();
    const lostYear = playYear(startNextYear(year1.state), (state) => (state.pending.defense ? 'loss' : 'win'));
    expect(lostYear.state.sceneQueue.some((item) => item.id === 'pro-title-lost' && item.vars.challenger)).toBe(true);
  });

  it('物語のサブで読み直せる(差し込みがなくても読める文)', () => {
    for (const id of ['pro-defense-eve', 'pro-defense-eternal', 'pro-defense-streak', 'pro-eternal', 'pro-all-crowns', 'pro-title-lost']) {
      expect(storyEpisode(`pro:${id}`)?.scene, id).toBe(id);
      const text = proYearScene(id, { playerName: 'やこび' }).lines.map((entry) => entry.text).join('');
      expect(text, id).not.toMatch(/\{[a-z]+\}/);
    }
  });
});
