import { describe, expect, it } from 'vitest';
import { careerRoad, danFor, nextDanHint, ryuoGroupAfter } from './pro-career.mjs';
import {
  PRO_USER_ID, autoWeeks, closeYearEarly, createProYear, packProYear, proYearView, recordProGame, startNextYear, unpackProYear, weekView,
} from './pro-year.mjs';
import { createRoster } from './ryuo-roster.mjs';

const roster = createRoster({ seed: 11, userGroup: 6 });
const start = (seed = 7) => {
  const state = createProYear({ seed, fiscalYear: 2026, roster, settings: { world: 30 }, userLevel: 30, userName: 'やこび' });
  return { ...state, goals: { fy: 2026, ids: ['wins', 'rate', 'money'], target: { wins: 15 }, done: {} } };
};
/** 公式戦を全部負けて、公式戦が残っていない週まで進める。 */
function loseAll(state) {
  let current = state;
  for (let guard = 0; guard < 200; guard += 1) {
    if (current.pending?.gameId) current = recordProGame(current, 'loss').state;
    else if (current.pending) current = { ...current, pending: null };
    if (current.festival) current = { ...current, festival: null };
    if (current.work) current = { ...current, work: null };
    if (current.yearDone) return current;
    if (weekView(current)?.closable) return current;
    current = autoWeeks(current);
  }
  return current;
}

describe('昇段(15-3の5)', () => {
  it('名簿と同じ決まりで段位を上げ、下げない', () => {
    expect(danFor({ dan: '四段' })).toBe('四段');
    expect(danFor({ dan: '四段', cls: 'C1' })).toBe('五段');
    expect(danFor({ dan: '四段', group: 2 })).toBe('六段');
    expect(danFor({ dan: '五段', titles: { oza: 1 } })).toBe('七段');
    expect(danFor({ dan: '四段', titles: { ryuo: 1 } })).toBe('八段');
    expect(danFor({ dan: '七段', titles: { meijin: 1 } })).toBe('九段');
    expect(danFor({ dan: '八段', cls: 'C1' })).toBe('八段');
    // 勝数規定は1度に1段だけ。
    expect(danFor({ dan: '四段', sinceWins: 100 })).toBe('五段');
    expect(danFor({ dan: '四段', sinceWins: 99 })).toBe('四段');
  });

  it('次の昇段の見込みに、道と勝数規定の残りを出す', () => {
    const hint = nextDanHint({ dan: '四段', cls: 'C2', group: 6, sinceWins: 30 });
    expect(hint.dan).toBe('五段');
    expect(hint.text).toContain('C級1組へ昇級');
    expect(hint.winsLeft).toBe(70);
    expect(nextDanHint({ dan: '九段' })).toBeNull();
  });

  it('竜王戦の組はランキング戦の決勝で1つ上がる', () => {
    expect(ryuoGroupAfter(6, true)).toBe(5);
    expect(ryuoGroupAfter(1, true)).toBe(1);
    expect(ryuoGroupAfter(4, false)).toBe(4);
  });

  it('勝ち数で昇段するとニュースの出来事になる', () => {
    let state = start();
    for (let guard = 0; guard < 50 && !state.pending?.gameId; guard += 1) state = autoWeeks(state);
    state = { ...state, user: { ...state.user, sinceWins: 99 } };
    const result = recordProGame(state, 'win');
    expect(result.state.players[PRO_USER_ID].dan).toBe('五段');
    expect(result.state.user.sinceWins).toBe(0);
    expect(result.state.week.events.some((event) => event.kind === 'danUp' && event.dan === '五段')).toBe(true);
  });
});

describe('年度を締める・棋士の歩み(15-3の6・7)', () => {
  it('ほかの棋戦で敗退して順位戦だけになったら、年度を早く締めてまとめへ(残りは分身)', () => {
    const state = loseAll(start(3));
    expect(state.yearDone).toBe(false);
    const view = weekView(state);
    expect(['over', 'junni']).toContain(view.closable);
    expect(view.weeksLeft).toBeGreaterThan(8);
    const closed = closeYearEarly(state);
    expect(closed.yearDone).toBe(true);
    expect(closed.summary.closedEarly).toBe(state.date);
    expect(closed.news.at(-1).headline).toBe('年度末の将棋界');
    // 締めても分身は持ち越す。
    const next = startNextYear(closed);
    expect(next.fy).toBe(2027);
    expect(next.avatar).toEqual(closed.avatar);
    expect(next.history.at(-1).fy).toBe(2026);
  });

  it('公式戦が残っている週は締められない', () => {
    const state = start(5);
    expect(weekView(state).closable).toBeNull();
    expect(closeYearEarly(state)).toBe(state);
  });

  it('歩みは年度ごとの行と通算', () => {
    const road = careerRoad([
      { fy: 2026, wins: 30, losses: 10, danUp: { from: '四段', to: '五段' }, clsText: 'C級2組 昇級', group: 5, groupUp: true, titles: [], champions: ['新人王戦'], headlines: [{ headline: '新人王に' }] },
    ], { fy: 2027, wins: 5, losses: 2, dan: '五段', clsText: 'C級1組', group: 4, titles: ['王座'], champions: [] });
    expect(road.rows).toHaveLength(2);
    expect(road.rows[0].dan).toBe('四段 → 五段');
    expect(road.rows[0].group).toBe('5組 昇級');
    expect(road.rows[1].now).toBe(true);
    expect(road.total.wins).toBe(35);
    expect(road.total.titles).toBe(1);
    expect(road.total.champions).toEqual(['新人王戦（2026年度）']);
  });

  it('保存から戻しても段位の記録を持つ', () => {
    const state = start();
    const back = unpackProYear(JSON.parse(JSON.stringify(packProYear(state))), roster);
    expect(back.user.danAtStart).toBe('四段');
    expect(proYearView(back).road.rows.at(-1).now).toBe(true);
    // 前の保存(段位の記録がない)。
    const old = JSON.parse(JSON.stringify(packProYear(state)));
    delete old.user.danAtStart;
    delete old.user.sinceWins;
    const restored = unpackProYear(old, roster);
    expect(restored.user.sinceWins).toBe(0);
    expect(restored.user.danAtStart).toBe('四段');
  });
});

describe('人との絆(15-3の1〜3)', () => {
  it('段は3・5・7・9で上がり、下がらない', async () => {
    const { bondLevel, bondNext, addBond } = await import('./pro-bonds.mjs');
    expect([0, 2, 3, 7, 8, 14, 15, 23, 24, 99].map(bondLevel)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
    expect(bondNext(0)).toEqual({ level: 2, need: 3, ratio: 0 });
    expect(bondNext(24)).toBeNull();
    const { bonds, up } = addBond({ a: { points: 2, seen: [] } }, 'a', 2);
    expect(bonds.a.points).toBe(4);
    expect(up).toEqual({ from: 1, to: 2 });
  });

  it('5人を選ぶ(師匠はベテラン・羽音・研究会の2人)', () => {
    const state = start();
    const { people } = state;
    expect(people.mentor).toBeTruthy();
    expect(people.senior).toBeTruthy();
    expect(state.players[people.hanane].story).toBeTruthy();
    expect([people.peer1, people.peer2]).toEqual(state.study.members.slice(1, 3));
    expect(state.players[people.mentor].age).toBeGreaterThanOrEqual(40);
    expect(new Set(Object.values(people)).size).toBe(5);
    expect(Object.keys(state.bonds)).toHaveLength(5);
    // 奨励会で選んだ師匠は名前で探す。
    const named = Object.values(state.players).find((member) => !member.story && member.id !== PRO_USER_ID && (member.age ?? 0) >= 50);
    const withMentor = createProYear({ seed: 7, fiscalYear: 2026, roster, settings: { world: 30 }, userLevel: 30, userName: 'やこび', mentorName: `${named.name}${named.dan}` });
    expect(withMentor.people.mentor).toBe(named.id);
  });

  it('人に会うと効き目と絆と分身の経験。週に1人まで', async () => {
    const { chooseWeekAction, advanceWeek } = await import('./pro-year.mjs');
    let state = { ...start(), condition: 1 };
    const view = weekView(state);
    const meet = view.actions.find((item) => item.id === 'meet-mentor');
    expect(meet.person.id).toBe(state.people.mentor);
    expect(view.people).toHaveLength(5);
    state = chooseWeekAction(state, 0, 'meet-mentor');
    if (view.slots > 1) expect(chooseWeekAction(state, 1, 'meet-hanane').week.actions[1] ?? null).toBeNull();
    const after = advanceWeek(state);
    expect(after.bonds[state.people.mentor].points).toBe(2);
    expect(after.condition).toBe(2);
    expect(after.avatar.exp.stability).toBeGreaterThan(0);
  });

  it('段5の効き目: 兄弟子で★の上限＋1、羽音で閃き＋1', () => {
    const state = start();
    const maxed = { ...state, bonds: { ...state.bonds, [state.people.senior]: { points: 24, seen: [] }, [state.people.hanane]: { points: 24, seen: [] } } };
    const view = weekView(maxed);
    if (view.prep) expect(view.prep.cap).toBe(2);
    expect(proYearView(maxed).people.find((item) => item.role === 'senior').perkOn).toBe(true);
  });

  it('段が上がったら場面が来る。見たら印', async () => {
    const { bondSceneDue } = await import('./pro-bonds.mjs');
    const { seeBondScene } = await import('./pro-year.mjs');
    const state = start();
    expect(bondSceneDue(state)).toBeNull();
    const up = { ...state, bonds: { ...state.bonds, [state.people.hanane]: { points: 8, seen: [] }, [state.people.peer1]: { points: 8, seen: [] } } };
    const due = bondSceneDue(up);
    expect(due).toMatchObject({ role: 'hanane', level: 2, scene: 'pro-bond-hanane-2' });
    const seen = seeBondScene(seeBondScene(up, due.id, 2), due.id, 3);
    expect(bondSceneDue(seen)).toMatchObject({ role: 'peer1', level: 3, scene: 'pro-bond-peer-3' });
  });

  it('前の保存は5人を選び、全員段1から', () => {
    const packed = JSON.parse(JSON.stringify(packProYear(start())));
    delete packed.people;
    delete packed.bonds;
    const back = unpackProYear(packed, roster);
    expect(Object.values(back.people).filter(Boolean)).toHaveLength(5);
    expect(Object.values(back.bonds).every((item) => item.points === 0)).toBe(true);
  });
});

describe('名簿への書き戻し(15-3の8)', () => {
  const finished = () => {
    const state = closeYearEarly(loseAll(start(3)));
    return { ...state, user: { ...state.user, cls: 'C2', junniResult: { cls: 'C2', promoted: true, place: 1, wins: 9, losses: 1 }, ryuoResult: { group: 6, next: 5, promoted: true } } };
  };

  it('竜王戦の組・順位戦のクラス・ほかの棋士のタイトルを書く', async () => {
    const { writeBackPlan, applyWriteBack } = await import('./pro-writeback.mjs');
    const { createCareer } = await import('./ryuo-career.mjs');
    const state = finished();
    const { items, plan } = writeBackPlan(state, { roster });
    expect(items[0].text).toBe('竜王戦：あなたは5組');
    expect(items[1].text).toBe('順位戦：あなたはC級2組 → C級1組');
    const { roster: next, career } = applyWriteBack(roster, createCareer(), plan);
    expect(career.group).toBe(5);
    expect(next.junni.classes.C1).toContain(PRO_USER_ID);
    expect(Object.values(next.junni.classes).flat().filter((id) => id === PRO_USER_ID)).toHaveLength(1);
    expect(next.junni.userJoined).toBe(true);
    for (const [id, holder] of Object.entries(plan.titles)) expect(next.titles[id]).toBe(holder);
    // もとの名簿は変えない。
    expect(roster.junni.classes.C1 ?? []).not.toContain(PRO_USER_ID);
  });

  it('期の途中の棋戦は書かない', async () => {
    const { writeBackPlan } = await import('./pro-writeback.mjs');
    const { items, plan } = writeBackPlan(finished(), { roster, ryuoBusy: true, meijinBusy: true });
    expect(plan.ryuo).toBeNull();
    expect(plan.junni).toBeNull();
    expect(items.filter((item) => !item.ok).map((item) => item.text).join()).toMatch(/竜王戦の期の途中.*名人戦の期の途中/);
  });

  it('選んだ印を残し、「毎年残す」を覚える', async () => {
    const { markWriteBack } = await import('./pro-year.mjs');
    const state = finished();
    const kept = markWriteBack(state, { keep: true, always: true, items: [{ ok: true, text: 'x' }] });
    expect(kept.summary.writeBack).toBe('kept');
    expect(kept.settings.writeBack).toBe('always');
    expect(markWriteBack(kept, { keep: false }).settings.writeBack).toBeNull();
  });
});
