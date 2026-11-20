// 棋士の1年: 棋士人生の目標(pro-year-design.md 27章)。
import { describe, expect, it } from 'vitest';
import { CAREER_TRACKS, careerGoalsFrom, crossedTiers, danValue, tierLabel, trackProgress } from './pro-milestones.mjs';
import {
  advanceToNextGame, careerGoals, clearProYearResults, createProYear, goalChoices, goalProgress, PRO_USER_ID, recordProGame,
  setYearGoals, TITLE_EVENTS,
} from './pro-year.mjs';
import { createRoster } from './ryuo-roster.mjs';

const track = (id) => CAREER_TRACKS.find((item) => item.id === id);

describe('道の進み具合', () => {
  it('次の段と残り、前の段からの割合', () => {
    const wins = trackProgress(track('wins'), 250);
    expect(wins.next).toMatchObject({ target: 300, label: '通算300勝', left: 50, leftText: 'あと50勝' });
    expect(wins.ratio).toBeCloseTo(0.5);
    expect(wins.last).toBe('通算200勝');
  });

  it('いちばん上まで越えたら、次はなく達成', () => {
    const titles = trackProgress(track('titles'), 120);
    expect(titles.next).toBeNull();
    expect(titles.done).toBe(true);
    expect(tierLabel('titles', 100)).toBe('タイトル通算100期');
    expect(tierLabel('crowns', 8)).toBe('八冠（全冠制覇）');
  });

  it('段位は四段=0〜九段=5', () => {
    expect(danValue('七段')).toBe(3);
    expect(trackProgress(track('dan'), danValue('九段')).done).toBe(true);
  });
});

describe('永世八冠といちばん近い段', () => {
  const eternal = ['竜王', '名人', '王位', '王座', '棋王', '王将', '棋聖', '叡王'].map((short, index) => ({ id: String(index), short, reached: index < 3, text: '' }));
  it('永世称号の数と、割合のいちばん大きい道', () => {
    const goals = careerGoalsFrom({ wins: 290, titles: 4, crowns: 2, cups: 0, dan: '七段', eternal });
    expect(goals.ultimate).toMatchObject({ label: '永世八冠', count: 3, total: 8, done: false, text: '永世称号 3/8' });
    expect(goals.nearest?.id).toBe('wins');
  });
  it('8つそろえば達成', () => {
    const all = eternal.map((item) => ({ ...item, reached: true }));
    expect(careerGoalsFrom({ wins: 0, titles: 0, crowns: 0, cups: 0, dan: '四段', eternal: all }).ultimate.done).toBe(true);
  });
});

describe('越えた段の印', () => {
  it('前の版の保存(印なし)は黙って印を付ける', () => {
    const { marks, fresh } = crossedTiers(undefined, [{ id: 'wins', value: 320 }]);
    expect(marks.wins).toBe(300);
    expect(fresh).toEqual([]);
  });
  it('1度に何段越えても、いちばん上の段だけ。ほかの札が祝う段(○冠・初優勝)は出さない', () => {
    const { fresh } = crossedTiers({ wins: 100 }, [{ id: 'wins', value: 310 }, { id: 'crowns', value: 3 }, { id: 'cups', value: 1 }]);
    expect(fresh.map((item) => item.label)).toEqual(['通算300勝']);
  });
});

describe('棋士の1年の目標(27章)', () => {
  const roster = createRoster({ seed: 11, userGroup: 6 });
  const start = createProYear({ seed: 7, fiscalYear: 2026, roster, settings: { world: 30 }, userLevel: 30, userName: 'やこび' });

  it('はじめは通算0勝・永世称号0/8', () => {
    const goals = careerGoals(start);
    expect(goals.ultimate.text).toBe('永世称号 0/8');
    expect(goals.tracks.find((item) => item.id === 'wins')?.value).toBe(0);
  });

  it('勝つと通算勝数が増え、50勝で札が出る', () => {
    let state = start;
    let card = null;
    for (let step = 0; step < 300 && !card; step += 1) {
      state = advanceToNextGame(state);
      if (state.yearDone) break;
      state = recordProGame(state, 'win').state;
      card = (state.results ?? []).find((item) => item.type === 'career') ?? null;
      state = clearProYearResults(state);
    }
    const wins = careerGoals(state).tracks.find((item) => item.id === 'wins')?.value ?? 0;
    expect(wins).toBeGreaterThan(0);
    if (wins >= 50) expect(card?.label).toBe('通算50勝');
  });

  it('タイトルを持っていたら、防衛と冠を増やす目標を出し、おすすめにする', () => {
    const state = structuredClone(start);
    state.titles[TITLE_EVENTS[0]] = PRO_USER_ID;
    state.titles[TITLE_EVENTS[1]] = PRO_USER_ID;
    state.history = [{ fy: 2025, wins: 30, losses: 10 }];
    const choices = goalChoices(state);
    const ids = choices.map((goal) => goal.id);
    expect(ids).toContain('defend');
    expect(ids).toContain('crownsUp');
    expect(ids).not.toContain('mainStage');
    expect(choices.find((goal) => goal.id === 'crownsUp')?.label).toBe('三冠になる');
    const recommended = choices.filter((goal) => goal.recommended).map((goal) => goal.id);
    expect(recommended).toHaveLength(3);
    expect(recommended).toContain('defend');
    const set = setYearGoals(state, recommended);
    const crowns = goalProgress(set).find((goal) => goal.id === 'crownsUp');
    expect(crowns).toMatchObject({ label: '三冠になる', done: false });
  });

  it('前に持っていて今はないなら、タイトル獲得の目標', () => {
    const state = structuredClone(start);
    state.user.titleRecord = { [TITLE_EVENTS[0]]: { total: 2, streak: 0, best: 2, defenses: 1, first: 2024, eternal: null } };
    state.history = [{ fy: 2025, wins: 30, losses: 10 }];
    const recommended = goalChoices(state).filter((goal) => goal.recommended).map((goal) => goal.id);
    expect(recommended).toEqual(['titleTake', 'challenge', 'wins']);
  });
});
