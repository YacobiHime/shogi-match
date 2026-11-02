import { describe, expect, it } from 'vitest';
import {
  TEAM_USER_ID, USER_TEAM, chooseTeamPlayer, createTeamRun, draftCandidates, hananeNextPlayer, markTeamCeremonySeen, recordTeamGame,
  teamPlayerStatus,
} from './team-battle.mjs';
import { CEREMONY_STEP_MS, ceremonyLines, ceremonyRevealMs, teamCeremonyView } from './team-ceremony.mjs';
import { awardLine, awardText, teamStageAward } from './season-award.mjs';
import { createRoster } from './ryuo-roster.mjs';

const roster = createRoster({ seed: 11, userGroup: 6 });
const school = (seed = 5) => createTeamRun({ format: 'school', seed, settings: { world: 20 }, roster, userName: 'やこび', userLevel: 20 });
const pro = (seed = 5) => createTeamRun({
  format: 'pro', seed, settings: { world: 20 }, roster, userName: 'やこび', userLevel: 20, draftPick: draftCandidates(roster)[0].id,
});
const NO_KEIGO = /です|ます|ございます|ください|！/;

/** 表彰式が出るまで(段階が変わるか大会が終わるまで)指す。 */
function playUntilCeremony(run, outcome) {
  let current = run;
  for (let step = 0; step < 300; step += 1) {
    current = current.pending
      ? recordTeamGame(current, typeof outcome === 'function' ? outcome(step) : outcome, { ply: 100 }).run
      : chooseTeamPlayer(current, hananeNextPlayer(current)).run;
    if (current.ceremony && !current.ceremony.seen) return current;
  }
  throw new Error('表彰式が出ない');
}

describe('相手の選手のステータス(docs/team-battle-design.mdの20章の3の1)', () => {
  it('次の相手は、学校・席・学年・強さ・得意戦法・能力・羽音の一言(「君の次の相手」)が見える', () => {
    const run = school(3);
    const status = teamPlayerStatus(run, run.pending.opponentId);
    expect(status).toMatchObject({ rival: true, you: false, recordText: 'この大会は、まだ指していない', vsText: '' });
    expect(status.school).toBe(run.teams[run.matches[run.current].b].name);
    expect(['主将', '副将', '三将']).toContain(status.seat);
    expect(status.dan).toMatch(/^[123]年$/);
    expect(status.strength).toMatch(/くらい|強い/);
    expect(status.profile.character).toBeTruthy();
    expect(status.line).toMatch(/^羽音「君の次の相手。/);
    expect(status.line).not.toMatch(NO_KEIGO);
  });

  it('今の試合で、まだ知らせていない局は数えない。終わった試合は数え、あなたとの対戦成績も出す', () => {
    const run = school(4);
    const match = run.matches[run.current];
    const opponents = run.teams[match.b].members;
    for (const id of opponents) expect(teamPlayerStatus(run, id).recordText).toBe('この大会は、まだ指していない');
    const opponentId = run.pending.opponentId;
    const after = recordTeamGame(run, 'win', { ply: 100 }).run;
    const status = teamPlayerStatus(after, opponentId);
    expect(status.record.losses).toBe(1);
    expect(status.vsText).toBe('あなたとの対局 あなたの1勝0敗');
    expect(status.line).not.toMatch(/君の次の相手/);
  });

  it('自分のチームは仲間のステータス(16章)のまま、知らない選手はnull', () => {
    const run = school(5);
    expect(teamPlayerStatus(run, TEAM_USER_ID)).toMatchObject({ you: true });
    expect(teamPlayerStatus(run, 'nobody')).toBeNull();
  });
});

describe('表彰式(20章の3の2)', () => {
  it('地区大会を勝ち抜くと、地区大会の表彰式。3位2校・準優勝・優勝の順に呼び、自分の学校は優勝', () => {
    const run = playUntilCeremony(school(5), 'win');
    expect(run.ceremony).toEqual({ stage: 'district', seen: false });
    const view = teamCeremonyView(run, { playerName: 'やこび' });
    expect(view.title).toBe('地区大会 表彰式');
    expect(view.host).toBe('ただいまより、全国高校将棋団体戦 地区大会の表彰式を行います。');
    expect(view.places.map((place) => place.label)).toEqual(['第3位', '準優勝', '優勝']);
    expect(view.places[0].teams).toHaveLength(2);
    expect(view.places[2].teams[0]).toMatchObject({ id: USER_TEAM, you: true });
    expect(view.you).toMatchObject({ place: 1, label: '優勝' });
    expect(view.trophy).toBe('優勝杯');
    expect(view.nextLabel).toBe('県大会へ');
    expect(view.photo.caption).toBe(`${run.teams[USER_TEAM].name} 地区大会 優勝`);
    expect(view.photo.members.map((member) => member.name)).toContain('やこび');
    // 個人の部は席ごとに1人。全部勝った自分は副将賞で、全勝。
    expect(view.prizes.map((prize) => prize.label)).toEqual(['主将賞', '副将賞', '三将賞']);
    expect(view.myPrize).toMatchObject({ label: '副将賞', you: true, record: '3勝0敗', perfect: true, name: 'やこび' });
    // 賞状は団体の入賞と個人賞の2枚。
    expect(view.awards.map((award) => [award.kind, award.prize, award.grade])).toEqual([
      ['team', '地区大会 優勝', 'red'], ['player', '地区大会 副将賞', 'red'],
    ]);
    expect(view.lines[0].text).toMatch(/^副将賞は君。おめでとう。地区大会優勝/);
    expect(markTeamCeremonySeen(run).ceremony.seen).toBe(true);
    expect(teamCeremonyView(markTeamCeremonySeen(run))).toBeNull();
  });

  it('1回戦で負けると、表彰式で自分の学校は「ベスト8」の行。賞状はなく、責めない一言で閉会', () => {
    const run = playUntilCeremony(school(6), 'loss');
    const view = teamCeremonyView(run);
    expect(run.phase).toBe('done');
    // 仲間が2勝して勝ち上がることもあるので、自分の学校が3位までに入らなかったときだけ確かめる。
    if (!view.you.place) {
      expect(view.you.label).toMatch(/ベスト/);
      expect(view.awards.filter((award) => award.kind === 'team')).toHaveLength(0);
      expect(view.nextLabel).toBe('閉会');
      expect(view.lines.map((line) => line.who)).toEqual(['hanane', 'momoka']);
    }
  });

  it('全国大会で優勝すると、全国大会の表彰式は優勝旗で、団体の賞状は今までの団体優勝(重ねて渡さない)', () => {
    let run = school(5);
    for (let count = 0; count < 3; count += 1) {
      run = playUntilCeremony(run, 'win');
      if (run.ceremony.stage === 'national') break;
      run = markTeamCeremonySeen(run);
    }
    expect(run.ceremony.stage).toBe('national');
    const view = teamCeremonyView(run);
    expect(view.title).toBe('全国大会 表彰式');
    expect(view.trophy).toBe('優勝旗');
    expect(view.you.place).toBe(1);
    expect(view.awards.filter((award) => award.kind === 'team')).toHaveLength(0);
    expect(view.awards[0]).toMatchObject({ kind: 'grand', id: `team-${run.id}` });
    expect(view.lines[0].text).toMatch(/全国優勝/);
    expect(view.nextLabel).toBe('閉会');
  });

  it('プロは大会の終わりに表彰式。個人の部は最多勝利賞1人、一言は羽音だけ', () => {
    const run = playUntilCeremony(pro(7), 'win');
    expect(run.ceremony.stage).toBe('pro');
    const view = teamCeremonyView(run);
    expect(view.title).toBe('早指し団体戦 表彰式');
    expect(view.prizes.map((prize) => prize.label)).toEqual(['最多勝利賞']);
    expect(view.lines.map((line) => line.who)).toEqual(['hanane']);
  });

  it('羽音の一言は敬語と「！」なし、百花は「！」あり。県大会の準優勝は「準優勝」と言う', () => {
    const outcomes = ['grand', 'champion', 'advance', 'second', 'placed', 'out'];
    for (const outcome of outcomes) {
      for (const school of [true, false]) {
        const lines = ceremonyLines({ outcome, school, stageName: '県大会', myPrize: null, placeLabel: '準優勝' });
        expect(lines[0].text).not.toMatch(NO_KEIGO);
        if (school) expect(lines[1].text).toMatch(/！/);
      }
    }
    expect(ceremonyLines({ outcome: 'placed', school: true, stageName: '県大会', myPrize: null, placeLabel: '準優勝' })[0].text).toMatch(/^準優勝。/);
  });

  it('段取りは約8秒まで(押せばすぐ出る)', () => {
    expect(ceremonyRevealMs({ places: [1, 2, 3], prizes: [1, 2, 3] })).toBe(CEREMONY_STEP_MS.place * 4 + CEREMONY_STEP_MS.prize * 4);
    expect(ceremonyRevealMs({ places: [1, 2, 3], prizes: [1, 2, 3] })).toBeLessThanOrEqual(8000);
  });
});

describe('段階の賞状(20章の3の2の4)', () => {
  it('団体の入賞と個人賞の賞状の文', () => {
    const team = teamStageAward({ id: 'team-x-district', kind: 'team', name: '全国高校将棋団体戦', stageName: '地区大会', prize: '地区大会 準優勝', grade: 'red', team: '燈ヶ丘高校', wins: 2, losses: 1 }, { playerName: 'やこび', at: 0 });
    expect(team).toMatchObject({ id: 'team-x-district', tournament: 'team-stage', grade: 'red' });
    expect(awardText(team).body).toMatch(/燈ヶ丘高校の一員として出場し、二勝一敗の成績で、仲間とともに準優勝に入賞しました/);
    expect(awardLine(team)).toBe('全国高校将棋団体戦 地区大会 準優勝（燈ヶ丘高校）');
    const player = teamStageAward({ id: 'team-x-district-player', kind: 'player', name: '全国高校将棋団体戦', stageName: '地区大会', prize: '地区大会 副将賞', grade: 'red', team: '燈ヶ丘高校', seat: '副将', wins: 3, losses: 0 }, { playerName: 'やこび', at: 0 });
    expect(awardText(player).body).toMatch(/燈ヶ丘高校の副将として出場し、三勝〇敗の成績を収め、副将賞に選ばれました/);
  });
});
