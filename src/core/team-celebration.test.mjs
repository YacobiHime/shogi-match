import { describe, expect, it } from 'vitest';
import {
  USER_TEAM, addTeamTrophy, chooseTeamPlayer, createTeamRun, draftCandidates, emptyTeamCareer, hananeNextPlayer, markTeamCelebrated,
  markTeamCeremonySeen, recordTeamGame,
} from './team-battle.mjs';
import {
  INTERVIEW_QUESTIONS, championBanner, championNewspaper, championTitle, interviewQuotes, interviewScene, pendingCelebration, teamStreak,
  teamTrophy, trophyShelf,
} from './team-celebration.mjs';
import { teamFinaleView } from './team-finale.mjs';
import { createRoster } from './ryuo-roster.mjs';

const roster = createRoster({ seed: 11, userGroup: 6 });
const school = (seed = 5) => createTeamRun({ format: 'school', seed, settings: { world: 20 }, roster, userName: 'やこび', userLevel: 20 });
const pro = (seed = 5) => createTeamRun({
  format: 'pro', seed, settings: { world: 20 }, roster, userName: 'やこび', userLevel: 20, draftPick: draftCandidates(roster)[0].id,
});
const NO_KEIGO = /です|ます|ございます|ください|！/;

/** 表彰式が出るまで指す。最後に決まった試合の記録(recordTeamGameの戻り)も返す。 */
function playUntilCeremony(run, outcome) {
  let current = run;
  let last = null;
  for (let step = 0; step < 300; step += 1) {
    if (current.pending) {
      last = recordTeamGame(current, outcome, { ply: 100 });
      current = last.run;
    } else current = chooseTeamPlayer(current, hananeNextPlayer(current)).run;
    if (current.ceremony && !current.ceremony.seen) return { run: current, last };
  }
  throw new Error('表彰式が出ない');
}

function playToNational() {
  let run = school(5);
  let last = null;
  for (let count = 0; count < 3; count += 1) {
    ({ run, last } = playUntilCeremony(run, 'win'));
    if (run.ceremony.stage === 'national') break;
    run = markTeamCelebrated(markTeamCeremonySeen(run), run.ceremony.stage, ['joy']);
  }
  return { run, last };
}

describe('優勝の記録(docs/team-battle-design.mdの21章)', () => {
  it('地区大会で優勝すると、まだ見ていないインタビューが残り、決めた試合は優勝の段階を持つ', () => {
    const { run, last } = playUntilCeremony(school(5), 'win');
    expect(run.celebrations).toEqual({ district: { seen: false } });
    expect(pendingCelebration(run)).toBe('district');
    expect(last.champion).toBe('district');
    const seen = markTeamCelebrated(run, 'district', ['thanks']);
    expect(seen.celebrations.district).toEqual({ seen: true, answers: ['thanks'] });
    expect(pendingCelebration(seen)).toBeNull();
    // 2回目は変えない。
    expect(markTeamCelebrated(seen, 'district', ['joy'])).toBe(seen);
  });

  it('優勝を決めた試合の結果発表は帯の文字を持つ。負けて終わったら優勝の記録はない', () => {
    const { run } = playUntilCeremony(school(5), 'win');
    expect(run.finale?.champion).toBe('district');
    expect(championBanner(run, 'district')).toBe('地区大会 優勝');
    expect(championBanner(run, 'national')).toBe('全国制覇');
    expect(championBanner({ format: 'pro' }, 'pro')).toBe('優勝');
    const view = teamFinaleView(run);
    if (view) expect(view.champion).toBe('地区大会 優勝');
    const lost = playUntilCeremony(school(6), 'loss').run;
    if (lost.ceremony.stage === 'district' && lost.phase === 'done') expect(pendingCelebration(lost)).toBeNull();
  });

  it('全国優勝は全国大会の記録、プロは大会の優勝で記録', () => {
    const { run, last } = playToNational();
    expect(last.champion).toBe('national');
    expect(pendingCelebration(run)).toBe('national');
    const proRun = playUntilCeremony(pro(7), 'win').run;
    if (proRun.champion === USER_TEAM) expect(pendingCelebration(proRun)).toBe('pro');
  });
});

describe('優勝インタビュー(21章の3の2)', () => {
  it('段階の優勝は質問1つ、全国優勝は2つ。答えは3つずつで、羽音の返しは敬語と「！」なし、百花は「！」あり', () => {
    const district = interviewScene(playUntilCeremony(school(5), 'win').run, 'district', { playerName: 'やこび' });
    expect(district.lines.filter((line) => line.choices)).toHaveLength(1);
    expect(district.lines[1].text).toBe('地区大会優勝、おめでとうございます。やこびさん、今のお気持ちは？');
    const national = interviewScene(playToNational().run, 'national', { playerName: 'やこび' });
    const asks = national.lines.filter((line) => line.choices);
    expect(asks).toHaveLength(2);
    for (const ask of asks) {
      expect(ask.choices).toHaveLength(3);
      for (const choice of ask.choices) {
        const hanane = choice.reply.find((line) => line.who === 'hanane');
        const momoka = choice.reply.find((line) => line.who === 'momoka');
        expect(hanane.text).not.toMatch(NO_KEIGO);
        expect(momoka.text).toMatch(/！/);
      }
    }
    expect(national.cast).toEqual(['hanane', 'momoka']);
    expect(national.summary).toMatch(/全国大会/);
  });

  it('プロは2問で、返しは羽音だけ', () => {
    const run = playUntilCeremony(pro(7), 'win').run;
    const scene = interviewScene(run, 'pro', { playerName: 'やこび' });
    const asks = scene.lines.filter((line) => line.choices);
    expect(asks).toHaveLength(2);
    expect(asks[0].text).toMatch(/リーダーのやこびさん/);
    for (const choice of asks[0].choices) expect(choice.reply.map((line) => line.who)).toEqual(['you', 'hanane']);
    expect(scene.cast).toEqual(['hanane']);
  });

  it('答えの言葉。飛ばしたら1つめの答え', () => {
    expect(interviewQuotes(['joy', 'party'])).toEqual([INTERVIEW_QUESTIONS[0].answers[1].say, INTERVIEW_QUESTIONS[1].answers[2].say]);
    expect(interviewQuotes([])).toEqual([INTERVIEW_QUESTIONS[0].answers[0].say]);
  });
});

describe('号外・トロフィー棚・称号・連覇(21章の3の3〜5)', () => {
  it('地区大会の号外: 見出し・勝ち上がり・3人の成績・殊勲・言葉・仲間の一言', () => {
    const { run } = playUntilCeremony(school(5), 'win');
    const paper = championNewspaper(run, 'district', { playerName: 'やこび', answers: ['joy'], at: new Date(2026, 10, 2).getTime() });
    const team = run.teams[USER_TEAM].name;
    expect(paper).toMatchObject({ masthead: '燈ヶ丘新聞', edition: '号外', date: '2026年11月2日', headline: `${team} 地区大会優勝` });
    expect(paper.path.length).toBeGreaterThan(0);
    expect(paper.path.every((entry) => entry.won)).toBe(true);
    expect(paper.sub).toBe(`決勝で${paper.path.at(-1).rival}を${paper.path.at(-1).score}で破る`);
    expect(paper.members).toHaveLength(3);
    expect(paper.members.find((member) => member.name === 'やこび')).toMatchObject({ seat: '副将', losses: 0, top: true });
    expect(paper.lead).toMatch(/全勝で優勝した。殊勲はやこびで/);
    expect(paper.quotes).toEqual(['最高にうれしいです！']);
    expect(paper.comments.map((comment) => comment.who)).toEqual(['hanane', 'momoka']);
    expect(paper.comments[0].text).not.toMatch(NO_KEIGO);
  });

  it('全国優勝の見出しは「全国制覇」、連覇は「全国n連覇」。プロは将棋日報', () => {
    const { run } = playToNational();
    expect(championNewspaper(run, 'national').headline).toMatch(/全国制覇$/);
    expect(championNewspaper(run, 'national', { streak: 2 }).headline).toMatch(/全国2連覇$/);
    const proRun = playUntilCeremony(pro(7), 'win').run;
    const paper = championNewspaper(proRun, 'pro', { streak: 3 });
    expect(paper.masthead).toBe('将棋日報');
    expect(paper.headline).toMatch(/3連覇$/);
    expect(paper.comments.map((comment) => comment.who)).toEqual(['hanane']);
  });

  it('連覇は同じ形式の前の大会から続く優勝を数える(棄権は飛ばす)', () => {
    const career = { history: [
      { format: 'school', place: 1 }, { format: 'pro', place: 3 }, { format: 'school', place: 99, label: '棄権' }, { format: 'school', place: 1 },
    ] };
    expect(teamStreak(career, 'school')).toBe(3);
    expect(teamStreak(career, 'pro')).toBe(1);
    expect(teamStreak({ history: [{ format: 'school', place: 102 }, { format: 'school', place: 1 }] }, 'school')).toBe(2);
    expect(teamStreak(emptyTeamCareer(), 'school')).toBe(1);
  });

  it('トロフィー棚: 杯ごとの数(まだは0)。同じ大会の同じ段階は重ねない', () => {
    const { run } = playUntilCeremony(school(5), 'win');
    const paper = championNewspaper(run, 'district');
    const trophy = teamTrophy(run, 'district', paper, 10);
    expect(trophy).toMatchObject({ id: `${run.id}-district`, stage: 'district', label: '地区大会の優勝杯', at: 10 });
    let career = addTeamTrophy(emptyTeamCareer(), trophy);
    expect(addTeamTrophy(career, trophy)).toBe(career);
    career = addTeamTrophy(career, { ...trophy, id: 'other-district', at: 20 });
    const shelf = trophyShelf(career);
    expect(shelf.total).toBe(2);
    expect(shelf.slots.map((slot) => slot.count)).toEqual([2, 0, 0, 0]);
    expect(shelf.slots[0].trophies[0].id).toBe('other-district');
    expect(trophyShelf(emptyTeamCareer()).total).toBe(0);
  });

  it('称号は大会の優勝だけ。回数を添える', () => {
    expect(championTitle('school', 2)).toMatchObject({ id: 'team-school-champion', label: '全国高校団体優勝', detail: '全国高校将棋団体戦で優勝（通算2回）' });
    expect(championTitle('pro', 1).id).toBe('team-pro-champion');
  });
});
