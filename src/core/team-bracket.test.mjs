import { describe, expect, it } from 'vitest';
import {
  USER_TEAM, chooseTeamPlayer, createTeamRun, draftCandidates, hananeNextPlayer, recordTeamGame, teamBracket, teamTablesView,
} from './team-battle.mjs';
import { createRoster } from './ryuo-roster.mjs';

const roster = createRoster({ seed: 11, userGroup: 6 });
const school = (seed = 5) => createTeamRun({ format: 'school', seed, settings: { world: 20 }, roster, userName: 'やこび', userLevel: 20 });
const pro = (seed = 7) => createTeamRun({
  format: 'pro', seed, settings: { world: 20 }, roster, userName: 'やこび', userLevel: 20, draftPick: draftCandidates(roster)[0].id,
});
const tab = (run, id) => teamTablesView(run).tabs.find((entry) => entry.id === id);

/** 自分の局を、試合が決まるまで指す。 */
function playMatch(run, outcome) {
  const first = run.current;
  let current = run;
  for (let step = 0; step < 20 && current.current === first; step += 1) {
    current = current.pending ? recordTeamGame(current, outcome, { ply: 100 }).run : chooseTeamPlayer(current, hananeNextPlayer(current)).run;
  }
  return current;
}

describe('団体戦のトーナメント表(docs/team-battle-design.mdの22章)', () => {
  it('地区大会のはじめ: 1回戦から決勝までの7枚の札。まだの回戦は「○○の勝者」、自分の1回戦は次の対局', () => {
    const run = school(5);
    const view = tab(run, 'district').knockout.bracket;
    expect(view.rounds.map((round) => round.label)).toEqual(['1回戦', '準決勝', '決勝']);
    expect(view.leafCount).toBe(8);
    expect(view.matches).toHaveLength(7);
    expect(view.userNext).toBe(1);
    const pending = view.matches.filter((card) => card.pending);
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ id: run.current, round: 1, userIn: true, winner: null });
    expect([pending[0].top, pending[0].bottom].some((slot) => slot.you && slot.pid === USER_TEAM && slot.name === run.teams[USER_TEAM].name)).toBe(true);
    const semi = view.matches.find((card) => card.round === 2);
    expect(semi.top).toMatchObject({ pid: null, placeholder: '1回戦の勝者' });
    expect(view.matches.find((card) => card.round === 3)).toMatchObject({ final: true, id: 'ko-3-0' });
  });

  it('1回戦に勝つと、勝ち数と勝ち上がりの線が付き、準決勝の札に自分の学校が入る', () => {
    const run = playMatch(school(5), 'win');
    const view = tab(run, 'district').knockout.bracket;
    const first = view.matches.find((card) => card.round === 1 && card.userIn);
    expect(first.userWon).toBe(true);
    const mine = first.top.you ? first.top : first.bottom;
    const them = first.top.you ? first.bottom : first.top;
    expect(first.winner).toBe(first.top.you ? 'top' : 'bottom');
    expect(Number(mine.dan)).toBeGreaterThan(Number(them.dan));
    const semi = view.matches.find((card) => card.round === 2 && card.userIn);
    expect(semi.pending).toBe(true);
    expect(view.userNext).toBe(2);
    // 1回戦の札は全部決着している(同じ回戦のほかの試合も、自分の局の前に決まる)。
    expect(view.matches.filter((card) => card.round === 1).every((card) => card.winner)).toBe(true);
  });

  it('プロの本戦は8チームの3回戦。本戦の前は表がない', () => {
    let run = pro(7);
    expect(tab(run, 'ko').knockout).toBeNull();
    for (let step = 0; step < 200 && !run.ko && run.phase !== 'done'; step += 1) {
      run = run.pending ? recordTeamGame(run, 'win', { ply: 100 }).run : chooseTeamPlayer(run, hananeNextPlayer(run)).run;
    }
    if (!run.ko) return;
    const view = tab(run, 'ko').knockout.bracket;
    expect(view.rounds.map((round) => round.label)).toEqual(['準々決勝', '準決勝', '決勝']);
    expect(view.matches).toHaveLength(7);
  });

  it('不戦勝の枠は札を作らず、次の回戦へそのまま進む', () => {
    const run = {
      current: null,
      teams: Object.fromEntries(['A', 'B', 'C', 'D', 'E', 'F'].map((id) => [id, { id, name: `${id}高校`, members: [] }])),
      matches: {},
    };
    const view = teamBracket(run, { size: 8, slots: ['A', 'B', 'C', null, 'D', 'E', null, 'F'], rounds: [], names: ['1回戦', '準決勝', '決勝'] });
    expect(view.matches.filter((card) => card.round === 1)).toHaveLength(2);
    const semis = view.matches.filter((card) => card.round === 2);
    expect(semis).toHaveLength(2);
    expect(semis[0].bottom).toMatchObject({ pid: 'C', name: 'C高校' });
    expect(semis[1].bottom).toMatchObject({ pid: 'F' });
    expect(teamBracket(run, null).matches).toEqual([]);
  });
});
