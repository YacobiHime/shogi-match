import { describe, expect, it } from 'vitest';
import {
  EXAM_RULES, KISHI_NUMBER_BASE, PRO, RANKS, SANDAN, SHOREIKAI_KEY, USER_ID,
  addToRecord, addToSlump, closeShoreikaiRun, createShoreikaiCareer, createShoreikaiRun, createWorld, describeShoreikai,
  leagueOutlook, leagueSchedule, leagueStandings, loadShoreikai, mentorCandidates, nameboard, promotionProgress,
  promotionReached, recommendedExamRank, recordShoreikaiGame, retryExam, saveShoreikai, shoreikaiScale, slumpWarning,
} from './shoreikai.mjs';
import { createRng } from './ryuo-random.mjs';
import { createRoster } from './ryuo-roster.mjs';
import { HANANE } from './ryuo-story.mjs';

const real = shoreikaiScale('real');
const mini = shoreikaiScale('mini');
const run0 = (overrides = {}) => createShoreikaiRun({ seed: 7, settings: { difficulty: 9, scale: 'mini', ...overrides }, examRank: 3, userName: 'やこび', userLevel: 20 });
const play = (run, outcome) => recordShoreikaiGame(run, outcome, { userLevel: 20 });
const memory = () => {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), data };
};

describe('昇級・昇段・降級点の規定', () => {
  it('実物どおり: 6連勝か9勝3敗…で昇級、1級からは8連勝か12勝4敗…で昇段', () => {
    const rule = real.kyu;
    expect(promotionReached(rule, { wins: 6, losses: 0, streak: 6 })).toBe('6連勝');
    expect(promotionReached(rule, { wins: 9, losses: 3, streak: 1 })).toBe('9勝3敗');
    expect(promotionReached(rule, { wins: 8, losses: 3, streak: 2 })).toBeNull();
    expect(promotionReached(rule, { wins: 15, losses: 6, streak: 0 })).toBe('15勝6敗');
    expect(promotionReached(real.dan, { wins: 12, losses: 4, streak: 0 })).toBe('12勝4敗');
    expect(promotionReached(real.dan, { wins: 7, losses: 0, streak: 7 })).toBeNull();
  });
  it('負けが上限を越えたら数え直す', () => {
    let record = { wins: 3, losses: 6, streak: 0 };
    record = addToRecord(real.kyu, record, false);
    expect(record).toEqual({ wins: 0, losses: 0, streak: 0 });
    expect(addToRecord(mini.kyu, { wins: 1, losses: 0, streak: 1 }, true)).toEqual({ wins: 2, losses: 0, streak: 2 });
  });
  it('昇級までの残りは、いちばん近い規定と連勝の道の近いほう', () => {
    const progress = promotionProgress(real.kyu, { wins: 7, losses: 2, streak: 1 });
    expect(progress).toMatchObject({ mark: '9勝3敗', winsLeft: 2, lossesLeft: 1, streakLeft: 5 });
    expect(promotionProgress(mini.kyu, { wins: 2, losses: 0, streak: 2 }).winsLeft).toBe(1);
  });
  it('降級点: 2勝8敗で降級点、3勝3敗で消え、降級点のまま2勝8敗で降級。勝ちが増えれば数え直す', () => {
    let slump = { wins: 0, losses: 0 };
    let event = null;
    for (const win of [true, true, false, false, false, false, false, false, false]) ({ slump, event } = addToSlump(real, slump, win, false));
    expect(event).toBeNull();
    expect(slumpWarning(real, slump)).toBe(true);
    ({ slump, event } = addToSlump(real, slump, false, false));
    expect(event).toBe('point');
    for (const win of [true, false, true, false]) ({ slump, event } = addToSlump(real, slump, win, true));
    expect(event).toBeNull();
    ({ slump, event } = addToSlump(real, slump, true, true));
    expect(event).toBe('clear');
    expect(addToSlump(real, { wins: 2, losses: 7 }, false, true).event).toBe('demote');
    expect(addToSlump(real, { wins: 2, losses: 3 }, true, false)).toEqual({ slump: { wins: 0, losses: 0 }, event: null });
  });
});

describe('奨励会の世界', () => {
  it('段級ごとの人数と、三段リーグの三段。羽音は三段', () => {
    const world = createWorld(createRng(3), mini);
    const members = Object.values(world.members);
    for (let rank = 0; rank < SANDAN; rank += 1) expect(members.filter((member) => member.rank === rank)).toHaveLength(mini.perRank);
    expect(world.sandanOrder).toHaveLength(mini.league.size);
    const hanane = members.find((member) => member.story === HANANE);
    expect(hanane).toMatchObject({ rank: SANDAN, name: '天鷺羽音', dan: '三段' });
    expect(new Set(members.map(({ name }) => name)).size).toBe(members.length);
  });
  it('師匠の候補は、竜王戦の名簿の年長の棋士から3人(物語の人物は除く)', () => {
    const roster = createRoster({ seed: 11 });
    const candidates = mentorCandidates(roster, 5);
    expect(candidates).toHaveLength(3);
    for (const mentor of candidates) {
      const member = roster.players[mentor.id];
      expect(member.kind).toBe('pro');
      expect(member.story).toBeFalsy();
    }
    expect(new Set(candidates.map(({ id }) => id)).size).toBe(3);
  });
  it('おすすめの受験級は、強いほど上の級', () => {
    expect(RANKS[recommendedExamRank(5)]).toBe('6級');
    expect(RANKS[recommendedExamRank(33)]).toBe('3級');
    expect(RANKS[recommendedExamRank(44)]).toBe('1級');
  });
});

describe('入会試験', () => {
  it('一次は受験者同士で4勝で通過、二次は奨励会員に1勝で合格。合格すると同期が2人できる', () => {
    let run = run0();
    expect(run.phase).toBe('exam');
    expect(run.pending.kind).toBe('exam1');
    expect(run.players[run.pending.opponentId].kind).toBe('examinee');
    expect(run.pending.stakes.text).toContain('4勝で通過');
    for (let index = 0; index < EXAM_RULES.firstPass; index += 1) run = play(run, 'win');
    expect(run.pending.kind).toBe('exam2');
    const second = run.players[run.pending.opponentId];
    expect(second.kind).toBe('shoreikai');
    expect(second.rank).toBeGreaterThan(3);
    run = play(run, 'loss');
    expect(run.pending.kind).toBe('exam2');
    run = play(run, 'win');
    expect(run.phase).toBe('reikai');
    expect(run.events.map(({ kind }) => kind)).toContain('pass');
    expect(run.peers).toHaveLength(2);
    for (const id of run.peers) expect(run.world.members[id]).toMatchObject({ peer: true, rank: 3 });
    expect(run.pending.kind).toBe('reikai');
  });
  it('一次で3敗すると不合格。受験級を選び直して受け直せる', () => {
    let run = run0();
    for (let index = 0; index < EXAM_RULES.firstFail; index += 1) run = play(run, 'loss');
    expect(run.phase).toBe('failed');
    expect(run.pending).toBeNull();
    run = retryExam(run, 1, { userLevel: 20 });
    expect(run).toMatchObject({ phase: 'exam', rank: 1 });
    expect(run.exam.tries).toBe(2);
    expect(run.pending.kind).toBe('exam1');
  });
});

/** 入会試験に受かったところまで進める。 */
function passed(overrides = {}) {
  let run = run0(overrides);
  for (let index = 0; index < EXAM_RULES.firstPass; index += 1) run = play(run, 'win');
  return play(run, 'win');
}

describe('例会', () => {
  it('1回の例会は2局。みじかいでは3連勝で昇級し、名札が上の列へ移る', () => {
    let run = passed();
    expect(run.day.no).toBe(1);
    run = play(run, 'win');
    expect(run.day.no).toBe(1);
    run = play(run, 'win');
    expect(run.day.no).toBe(2);
    run = play(run, 'win');
    expect(run.rank).toBe(4);
    expect(run.events[0]).toMatchObject({ kind: 'promote', mark: '3連勝', word: '昇級' });
    const board = nameboard(run);
    expect(board[4].tags.some((tag) => tag.you)).toBe(true);
    expect(board[3].tags.some((tag) => tag.you)).toBe(false);
  });
  it('負けが込むと降級点。次の1敗で降級点になる前に予告する', () => {
    let run = passed();
    for (let index = 0; index < mini.slump.losses - 1; index += 1) run = play(run, 'loss');
    expect(describeShoreikai(run).slumpWarning).toBe(true);
    expect(run.pending.stakes.warning).toBe('あと1つ負けると降級点');
    run = play(run, 'loss');
    expect(run.point).toBe(true);
    expect(run.events.map(({ kind }) => kind)).toContain('point');
  });
  it('例会の相手は、段級の近い奨励会員。ほかの例会の結果は速報に使う', () => {
    const run = passed();
    const opponent = run.players[run.pending.opponentId];
    expect(Math.abs(opponent.rank - run.rank)).toBeLessThanOrEqual(1);
    expect(opponent.level).toBeGreaterThanOrEqual(1);
    expect(run.pending.others.games.length).toBeGreaterThan(0);
    expect(run.pending.stakes.goal).toMatch(/昇級まであと\d勝/);
  });
});

/** 全部勝って、四段まで進める。 */
function toPro(run) {
  let next = run;
  for (let guard = 0; guard < 400 && next.phase !== 'pro'; guard += 1) next = play(next, 'win');
  return next;
}

describe('三段リーグから四段', () => {
  it('三段になると三段リーグに入り、全部勝てば四段。棋士番号をもらう', () => {
    let run = passed();
    for (let guard = 0; guard < 200 && run.phase === 'reikai'; guard += 1) run = play(run, 'win');
    expect(run.phase).toBe('league');
    expect(run.rank).toBe(SANDAN);
    expect(run.pending.kind).toBe('league');
    expect(run.pending.label).toMatch(/三段リーグ 1回戦/);
    expect(run.league.order.at(-1)).toBe(USER_ID);
    run = toPro(run);
    expect(run.phase).toBe('pro');
    expect(run.rank).toBe(PRO);
    expect(run.kishiNumber).toBeGreaterThan(KISHI_NUMBER_BASE);
    expect(run.lastTerm.promoted).toBe(true);
    expect(run.lastTerm.reveal.find((row) => row.you)).toMatchObject({ place: 1, promoted: true });
    // 羽音は、入会してすぐの三段リーグで四段になっている。
    expect(run.world.feed.some((item) => item.tone === 'rival' && item.text.includes('四段昇段'))).toBe(true);
    expect(Object.values(run.world.members).some((member) => member.story === HANANE)).toBe(false);
  });
  it('三段リーグで負けると来期へ。次の期の順位は、この期の成績順', () => {
    let run = passed();
    for (let guard = 0; guard < 200 && run.phase === 'reikai'; guard += 1) run = play(run, 'win');
    const term = run.league.term;
    for (let guard = 0; guard < 50 && run.league?.term === term; guard += 1) run = play(run, 'loss');
    expect(run.phase).toBe('league');
    expect(run.league.term).toBe(term + 1);
    expect(run.lastTerm).toMatchObject({ promoted: false, wins: 0 });
    expect(run.events.map(({ kind }) => kind)).toContain('sandan-point');
  });
  it('年齢制限ありで負け続けると、退会になる(なしなら続く)', () => {
    let run = passed({ ageLimit: true });
    for (let guard = 0; guard < 600 && run.phase === 'reikai'; guard += 1) run = play(run, 'loss');
    expect(run.phase).toBe('retired');
    expect(run.events.map(({ kind }) => kind)).toContain('retired');
    let free = passed();
    for (let guard = 0; guard < 200; guard += 1) free = play(free, 'loss');
    expect(free.phase).toBe('reikai');
  });
});

describe('三段リーグの表と見通し', () => {
  it('組み合わせは、プレイヤーが毎回指し、同じ相手と続けて当たらない', () => {
    const ids = [USER_ID, ...Array.from({ length: 7 }, (_, index) => `s${index}`)];
    const schedule = leagueSchedule(createRng(9), ids, 6);
    const seen = new Set();
    for (const round of schedule) {
      expect(round.some((pair) => pair.includes(USER_ID))).toBe(true);
      for (const [a, b] of round) {
        const key = [a, b].sort().join('|');
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
  });
  it('同じ勝ち数なら前期の順位が上の人が上。見通しは自力・他力・決定・届かない', () => {
    const league = {
      order: ['a', 'b', USER_ID, 'c'],
      results: [[{ a: 'a', b: 'c', winner: 'a' }, { a: 'b', b: USER_ID, winner: USER_ID }], [{ a: 'a', b: USER_ID, winner: 'a' }, { a: 'b', b: 'c', winner: 'b' }]],
    };
    const rows = leagueStandings(league);
    expect(rows.map(({ id }) => id)).toEqual(['a', 'b', USER_ID, 'c']);
    expect(leagueOutlook(rows, 'a', 2, 1)).toBe('clinched');
    expect(leagueOutlook(rows, USER_ID, 4, 1)).toBe('others');
    expect(leagueOutlook(rows, 'a', 4, 1)).toBe('self');
    expect(leagueOutlook(rows, 'c', 3, 1)).toBe('out');
  });
});

describe('ほかの奨励会員の世界', () => {
  it('何年たっても、段級ごとの人数が大きく偏らない(低い級が空にならず、三段が増えすぎない)', () => {
    let run = passed();
    for (let guard = 0; guard < 160; guard += 1) run = play(run, guard % 3 === 0 ? 'win' : 'loss');
    const members = Object.values(run.world.members).filter((member) => member.kind === 'shoreikai');
    const lower = members.filter((member) => member.rank < SANDAN).length;
    expect(run.world.month).toBeGreaterThan(60);
    expect(lower).toBeGreaterThan(mini.perRank * SANDAN * 0.6);
    expect(lower).toBeLessThan(mini.perRank * SANDAN * 1.5);
    expect(members.filter((member) => member.rank === SANDAN).length).toBeLessThanOrEqual(Math.ceil(mini.league.size * 1.25) + 2);
    expect(members.filter((member) => member.rank <= 1).length).toBeGreaterThan(0);
  });
});

describe('局数の見積もり(docs/shoreikai-design.mdの2章)', () => {
  it('みじかいは、勝率7割なら四段まで40〜110局ほど', () => {
    const counts = [];
    for (let seed = 1; seed <= 6; seed += 1) {
      const dice = createRng(seed * 101);
      let run = createShoreikaiRun({ seed, settings: { scale: 'mini' }, examRank: 2, userLevel: 20 });
      for (let guard = 0; guard < 400 && run.phase !== 'pro'; guard += 1) {
        if (run.phase === 'failed') run = retryExam(run, 2, { userLevel: 20 });
        run = play(run, dice.next() < 0.7 ? 'win' : 'loss');
      }
      expect(run.phase).toBe('pro');
      counts.push(run.games.length);
    }
    const mean = counts.reduce((sum, value) => sum + value, 0) / counts.length;
    expect(mean).toBeGreaterThan(30);
    expect(mean).toBeLessThan(120);
  }, 60000);
});

describe('保存', () => {
  it('相手の表は保存せず、読み込むと世界から付け直す。壊れた保存は新しいキャリア', () => {
    const storage = memory();
    const career = { ...createShoreikaiCareer(), run: passed() };
    saveShoreikai(storage, career);
    const raw = JSON.parse(storage.data.get(SHOREIKAI_KEY));
    expect(raw.run.players).toBeUndefined();
    const loaded = loadShoreikai(storage);
    expect(loaded.run.players[loaded.run.pending.opponentId].name).toBe(career.run.players[career.run.pending.opponentId].name);
    storage.setItem(SHOREIKAI_KEY, '{');
    expect(loadShoreikai(storage)).toEqual(createShoreikaiCareer());
  });
  it('50段階の表(2026-10-23)より前の保存は、奨励会員の指すLvを9つ上げる(1回だけ)', () => {
    const storage = memory();
    const career = { ...createShoreikaiCareer(), run: passed() };
    const id = career.run.pending.opponentId;
    const level = career.run.world.members[id].level;
    saveShoreikai(storage, career);
    const raw = JSON.parse(storage.data.get(SHOREIKAI_KEY));
    delete raw.ladder;
    raw.run.world.members[id].level = 3;
    storage.setItem(SHOREIKAI_KEY, JSON.stringify(raw));
    const loaded = loadShoreikai(storage);
    expect(loaded.ladder).toBe(3);
    expect(loaded.run.world.members[id].level).toBe(12);
    saveShoreikai(storage, loaded);
    expect(loadShoreikai(storage).run.world.members[id].level).toBe(12);
    expect(Number.isFinite(level)).toBe(true);
  });
  it('研修会から編入すると、入会試験なしで6級の例会から。同期が2人でき、経歴に編入と残る', () => {
    const run = createShoreikaiRun({ seed: 9, settings: { scale: 'mini' }, examRank: 3, userName: 'やこび', userLevel: 20, transfer: { from: 'kenshukai', label: '研修会A2' } });
    expect(run.phase).toBe('reikai');
    expect(run.rank).toBe(0);
    expect(run.exam).toBeNull();
    expect(run.peers).toHaveLength(2);
    expect(run.pending.kind).toBe('reikai');
    expect(run.history[0].text).toBe('研修会A2から6級に編入');
    const view = describeShoreikai(run);
    expect(view.rankLabel).toBe('6級');
    expect(view.transfer).toEqual({ from: 'kenshukai', label: '研修会A2' });
    expect(createShoreikaiCareer().transfer).toBeNull();
  });
  it('四段になった挑戦を閉じると、要約と棋士番号が残る', () => {
    const pro = toPro(passed());
    const career = closeShoreikaiRun({ ...createShoreikaiCareer(), run: pro });
    expect(career.run).toBeNull();
    expect(career.history[0]).toMatchObject({ result: 'pro', kishiNumber: pro.kishiNumber });
    expect(career.pro.kishiNumber).toBe(pro.kishiNumber);
  });
});
