import { describe, expect, it } from 'vitest';
import { AVATAR_GAINS, avatarEdge, avatarLevel, avatarNext, avatarView, emptyAvatar, gainAvatar } from './pro-avatar.mjs';
import { WORKS, workOffers, workReward } from './pro-work.mjs';
import { buildNews, fanLettersBetween, headlineOf, interviewFor, isStreakMark, nextLetter, pickHeadline, recordRanking } from './pro-news.mjs';
import {
  PRO_USER_ID, advanceWeek, answerInterview, autoWeeks, chooseWeekAction, createProYear, finishWork, packProYear, proYearView, recordProGame,
  recordShidou, startWorkShidou, unpackProYear, weekView,
} from './pro-year.mjs';
import { createRoster } from './ryuo-roster.mjs';

const roster = createRoster({ seed: 11, userGroup: 6 });
const start = (seed = 7) => {
  const state = createProYear({ seed, fiscalYear: 2026, roster, settings: { world: 30 }, userLevel: 30, userName: 'やこび' });
  return { ...state, goals: { fy: 2026, ids: ['wins', 'rate', 'money'], target: { wins: 15 }, done: {} } };
};
/** 仕事の依頼がある週まで、おまかせで進める。 */
function weekWithWork(state, id = null) {
  let current = state;
  for (let guard = 0; guard < 40; guard += 1) {
    if (current.pending) current = recordProGame(current, 'auto').state;
    if (current.festival || current.work || current.yearDone) return null;
    const view = weekView(current);
    const work = view?.actions.find((item) => item.work && (!id || item.work === id));
    if (work && !view.applied && view.slots > 0) return { state: current, work };
    current = advanceWeek(chooseWeekAction(current, 0, 'rest'));
  }
  return null;
}

describe('分身を育てる(14-3の2)', () => {
  it('経験からLvが決まり、上ほどゆっくり上がる', () => {
    expect([0, 3, 4, 11, 12, 180, 999].map(avatarLevel)).toEqual([1, 1, 2, 2, 3, 10, 10]);
    expect(avatarNext(4)).toEqual({ need: 8, ratio: 0 });
    expect(avatarNext(180)).toBeNull();
  });

  it('経験を足すとLvの上がった能力を返し、分身の強さが上がる', () => {
    const { avatar, ups } = gainAvatar(emptyAvatar(), { opening: 5, reading: 1 });
    expect(ups).toEqual([{ key: 'opening', label: '研究', from: 1, to: 2 }]);
    expect(avatarEdge(emptyAvatar())).toBe(0);
    expect(avatarEdge(avatar)).toBeGreaterThan(0);
    const full = { exp: Object.fromEntries(Object.keys(emptyAvatar().exp).map((key) => [key, 999])) };
    expect(avatarEdge(full)).toBe(81);
    const view = avatarView(avatar, { opening: 5 });
    expect(view.top.key).toBe('opening');
    expect(view.rows.find((row) => row.key === 'opening').up).toBe(true);
  });
});

describe('棋士の仕事(14-3の1)', () => {
  it('依頼は週と種で決まり、解説は開いていて注目局があるときだけ', () => {
    const base = { weekStart: '2026-05-04', seed: 3, slots: 2 };
    const a = workOffers({ ...base, kaisetsuOpen: false });
    expect(a).toEqual(workOffers({ ...base, kaisetsuOpen: false }));
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toContain('kaisetsu');
    expect(workOffers({ ...base, kaisetsuOpen: true, kaisetsuGame: { id: 'g1' } })).toContain('kaisetsu');
    expect(workOffers({ ...base, kaisetsuOpen: true, slots: 0 })).toEqual([]);
  });

  it('出来高: 詰将棋は解けた数、解説は当たった数で上乗せ。さっと済ませると基本の分', () => {
    expect(workReward('tsume', { score: 3 })).toMatchObject({ fee: 20, fans: 5, gains: { attack: 5, reading: 1 } });
    expect(workReward('tsume', { quick: true })).toMatchObject({ fee: 15, gains: { attack: 2, reading: 1 } });
    expect(workReward('tsume', { score: 0 }).fee).toBe(5);
    expect(workReward('kaisetsu', { score: 5 })).toMatchObject({ fee: 30, fans: 45 });
    expect(workReward('shidou', { score: 0 })).toMatchObject({ fee: 10, fans: 10 });
  });

  it('仕事を選んで週を進めると仕事の日で止まり、終えると謝礼・ファン・分身の経験', () => {
    const found = weekWithWork(start());
    expect(found).not.toBeNull();
    const { state, work } = found;
    let next = chooseWeekAction(state, 0, work.id);
    expect(next.week.actions[0]).toBe(work.id);
    // 2つめの枠に別の仕事は選べない。
    const other = weekView(next).actions.find((item) => item.work && item.id !== work.id);
    if (other && weekView(next).slots > 1) expect(chooseWeekAction(next, 1, other.id).week.actions[1]).toBe(next.week.actions[1]);
    next = advanceWeek(next);
    if (next.pending) return; // 仕事の日の前に対局があった種(仕事は次に進めたとき)。
    expect(next.work?.id).toBe(work.work);
    // 仕事の札のあいだは週を進められない。
    expect(advanceWeek(next).work?.id).toBe(work.work);
    const before = next.user.money ?? 0;
    const fansBefore = next.user.fans ?? 0;
    let done;
    if (work.work === 'shidou') {
      const playing = startWorkShidou(next);
      expect(playing.pending).toMatchObject({ kind: 'shidou', work: true, handicapGiver: 'player' });
      done = recordShidou(playing, 'win').state;
    } else {
      done = finishWork(next, { quick: true }).state;
    }
    expect(done.work).toBeNull();
    expect(done.user.money).toBeGreaterThan(before);
    expect(done.user.fans).toBeGreaterThan(fansBefore);
    expect(Object.values(done.avatar.exp).some((value) => value > 0)).toBe(true);
    expect(done.week.log.some((item) => item.kind === 'work')).toBe(true);
  });
});

describe('将棋ニュース・記録・取材・ファンレター(14-3の3〜6)', () => {
  it('見出しは強い出来事を選び、自分の名前を段つきで書く', () => {
    const top = pickHeadline([{ kind: 'win', label: '順位戦' }, { kind: 'streak', streak: 5 }, { kind: 'loss', label: 'NHK杯' }]);
    expect(top.kind).toBe('streak');
    expect(headlineOf(top, 'やこび四段')).toBe('やこび四段、5連勝');
    expect(headlineOf({ kind: 'firstWin' }, 'やこび四段')).toBe('新四段やこび、公式戦で初勝利');
    expect(headlineOf({ kind: 'hanane', won: false }, 'やこび四段')).toMatch(/惜敗 次の対局へ/);
    const news = buildNews({ number: 3, start: 'a', end: 'b', events: [], lines: ['x'], you: 'やこび四段', world: '高木六段、勝数の首位' });
    expect(news).toMatchObject({ headline: '高木六段、勝数の首位', mine: false });
    expect(isStreakMark(5)).toBe(true);
    expect(isStreakMark(6)).toBe(false);
  });

  it('記録のランキングは上位3人と自分。10位の外なら近い目当て', () => {
    const records = { user: { w: 2, l: 1, best: 2 } };
    for (let index = 0; index < 12; index += 1) records[`p${index}`] = { w: 20 - index, l: 5, best: 3 };
    const wins = recordRanking(records, 'wins', 'user');
    expect(wins.top.map((row) => row.id)).toEqual(['p0', 'p1', 'p2']);
    expect(wins.you).toBeNull();
    expect(wins.near).toMatch(/10位まで あと\d+勝/);
    expect(recordRanking(records, 'rate', 'user').near).toMatch(/10局から入る/);
  });

  it('取材は節目のときだけ。ファンレターは節目をまたいだ週に1通', () => {
    expect(interviewFor({ kind: 'win' }, 1)).toBeNull();
    const interview = interviewFor({ kind: 'streak' }, 1);
    expect(interview.answers).toHaveLength(3);
    expect(fanLettersBetween(90, 120, 1).map((item) => item.mark)).toEqual([100]);
    expect(fanLettersBetween(120, 130, 1)).toEqual([]);
    expect(nextLetter(268)).toEqual({ mark: 300, need: 32 });
  });

  it('週を閉じるとニュースが残り、取材に答えると次の記事に答えが載る', () => {
    let state = start();
    state = advanceWeek(chooseWeekAction(state, 0, 'research'));
    expect(state.news.length).toBe(1);
    expect(state.news[0]).toMatchObject({ number: 1, fy: 2026 });
    // 取材を用意して答える。
    state = { ...state, interview: { ...interviewFor({ kind: 'firstWin' }, 3), week: 2 } };
    const fans = state.user.fans ?? 0;
    const answered = answerInterview(state, 'thanks');
    expect(answered.interview).toBeNull();
    expect(answered.user.fans).toBe(fans + 15);
    expect(answered.week.quote).toBeTruthy();
    // 保存して戻しても、分身とニュースは残る。
    const restored = unpackProYear(JSON.parse(JSON.stringify(packProYear(answered))), roster);
    expect(restored.news).toHaveLength(answered.news.length);
    expect(restored.avatar.exp.opening).toBe(AVATAR_GAINS.research.opening);
  });

  it('前の保存(分身もニュースもない)も戻せる', () => {
    const packed = JSON.parse(JSON.stringify(packProYear(start())));
    delete packed.avatar;
    delete packed.news;
    delete packed.letters;
    const restored = unpackProYear(packed, roster);
    expect(restored.avatar.exp.opening).toBe(0);
    expect(restored.news).toEqual([]);
  });

  it('1年をおまかせで回すと、ニュースが週ごとに残り、自分で指した対局で分身が育つ', () => {
    let state = start(5);
    for (let guard = 0; guard < 200 && !state.yearDone; guard += 1) {
      if (state.pending) {
        const kind = state.pending.kind;
        if (kind === 'game' || kind === 'finals') state = recordProGame(state, 'win', { way: 'cut' }).state;
        else state = { ...state, pending: null };
        continue;
      }
      if (state.festival) state = { ...state, festival: null };
      if (state.work) state = finishWork(state, { quick: true }).state;
      state = autoWeeks(state);
    }
    expect(state.yearDone).toBe(true);
    expect(state.news.length).toBeGreaterThan(40);
    expect(state.news.some((item) => item.mine)).toBe(true);
    expect(state.avatar.exp.reading).toBeGreaterThan(0);
    expect(state.summary.headlines.length).toBeGreaterThan(0);
    const view = proYearView(state);
    expect(view.records).toHaveLength(4);
    expect(view.records[0].top.length).toBeGreaterThan(0);
    expect(WORKS.kaisetsu.day).toBe(5);
  });
});

describe('分身を名鑑の形に(16-3の6)', () => {
  it('あなたの能力の配分に育てた分を足し、Lvを渡すとその時点の形', async () => {
    const { avatarMember } = await import('./pro-avatar.mjs');
    const avatar = gainAvatar(emptyAvatar(), { opening: 12 }).avatar;
    const member = avatarMember({ rating: 1500, base: { opening: 5, reading: -4 }, avatar });
    expect(member.character.abilities.opening).toBe(5 + 2 * 3);
    expect(member.character.abilities.reading).toBe(-4);
    const before = avatarMember({ rating: 1500, base: { opening: 5 }, levels: { opening: 1 } });
    expect(before.character.abilities.opening).toBe(5);
    expect(avatarMember({ rating: 1500 }).character.abilities.opening).toBe(0);
  });
});
