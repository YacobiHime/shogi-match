import { describe, expect, it } from 'vitest';
import {
  A2, CLASSES, CLASS_RATINGS, GAMES_PER_DAY, KENSHUKAI_KEY, SHIDO_EVERY, TOP, USER_ID,
  closeKenshukaiRun, createKenshukaiCareer, createKenshukaiRun, createWorld, describeKenshukai, examJoinClass,
  kenshukaiLevel, kenshukaiScale, loadKenshukai, nameboard, promotionRule, recommendedEntryClass, recordKenshukaiGame,
  saveKenshukai, shidoHandicap,
} from './kenshukai.mjs';
import { entryTalk, eventStamp, pendingTip, transferTalk } from './kenshukai-speech.mjs';
import { promotionReached } from './shoreikai.mjs';
import { createRng } from './ryuo-random.mjs';
import { createRoster } from './ryuo-roster.mjs';

const real = kenshukaiScale('real');
const mini = kenshukaiScale('mini');
const roster = createRoster({ seed: 11, userGroup: 6 });
const run0 = (overrides = {}, entryClass = 4) => createKenshukaiRun({
  seed: 7, settings: { difficulty: 9, scale: 'mini', ...overrides }, entryClass, userName: 'やこび', userLevel: 20, roster,
});
const play = (run, outcome) => recordKenshukaiGame(run, outcome, { userLevel: 20 });
const playAll = (run, outcomes) => outcomes.reduce((current, outcome) => play(current, outcome), run);
const memory = () => {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), data };
};
/** 入会試験を、受験クラスのまま(2勝2敗)で終える。 */
const joined = (overrides = {}, entryClass = 4) => playAll(run0(overrides, entryClass), ['win', 'win', 'loss', 'loss']);

describe('クラスと昇級の規定', () => {
  it('13クラス。F2がいちばん下、A2が奨励会編入の資格、Sが頂点。強さは上ほど高い', () => {
    expect(CLASSES).toEqual(['F2', 'F1', 'E2', 'E1', 'D2', 'D1', 'C2', 'C1', 'B2', 'B1', 'A2', 'A1', 'S']);
    expect(CLASSES[A2]).toBe('A2');
    expect(CLASSES[TOP]).toBe('S');
    for (let cls = 1; cls <= TOP; cls += 1) expect(CLASS_RATINGS[cls]).toBeGreaterThan(CLASS_RATINGS[cls - 1]);
    // A2は奨励会6級(R1150)のすぐ下。
    expect(CLASS_RATINGS[A2]).toBeLessThan(1150);
  });
  it('実物どおり: F1へは5連勝か7勝3敗、C・D・Eへは6連勝か9勝3敗、A・B・Sへは8連勝か12勝4敗', () => {
    expect(promotionReached(promotionRule(real, 0), { wins: 5, losses: 0, streak: 5 })).toBe('5連勝');
    expect(promotionReached(promotionRule(real, 0), { wins: 7, losses: 3, streak: 0 })).toBe('7勝3敗');
    expect(promotionReached(promotionRule(real, 1), { wins: 9, losses: 3, streak: 0 })).toBe('9勝3敗');
    expect(promotionReached(promotionRule(real, 6), { wins: 6, losses: 0, streak: 6 })).toBe('6連勝');
    expect(promotionReached(promotionRule(real, 7), { wins: 6, losses: 0, streak: 6 })).toBeNull();
    expect(promotionReached(promotionRule(real, 7), { wins: 12, losses: 4, streak: 0 })).toBe('12勝4敗');
    expect(promotionReached(promotionRule(real, 11), { wins: 8, losses: 0, streak: 8 })).toBe('8連勝');
  });
  it('入会試験は落ちない。成績で、受験クラスの1つ上・そのまま・1つ下から入る(F2より下はない)', () => {
    expect(examJoinClass(mini, 4, 4)).toBe(5);
    expect(examJoinClass(mini, 4, 3)).toBe(4);
    expect(examJoinClass(mini, 4, 2)).toBe(4);
    expect(examJoinClass(mini, 4, 1)).toBe(3);
    expect(examJoinClass(mini, 0, 0)).toBe(0);
    expect(examJoinClass(real, 4, 7)).toBe(5);
    expect(examJoinClass(real, 4, 4)).toBe(4);
    expect(examJoinClass(real, 4, 3)).toBe(3);
  });
  it('指導対局の手合いは、クラスが上がるほど少なくなる(Aクラスからは平手)', () => {
    expect(shidoHandicap(0)).toBe('2pieces');
    expect(shidoHandicap(2)).toBe('rook-lance');
    expect(shidoHandicap(4)).toBe('rook');
    expect(shidoHandicap(6)).toBe('bishop');
    expect(shidoHandicap(8)).toBe('lance');
    expect(shidoHandicap(A2)).toBe('');
  });
});

describe('相手の強さとおすすめ', () => {
  it('上のクラスほど相手のLvが高い(F2とSで差がつく)', () => {
    const levels = CLASS_RATINGS.map((rating) => kenshukaiLevel(rating, 9, 20));
    for (let index = 1; index < levels.length; index += 1) expect(levels[index]).toBeGreaterThanOrEqual(levels[index - 1]);
    expect(levels[TOP]).toBeGreaterThan(levels[0]);
    // 難易度を上げると、同じクラスでも強くなる。
    expect(kenshukaiLevel(CLASS_RATINGS[4], 13, 20)).toBeGreaterThan(kenshukaiLevel(CLASS_RATINGS[4], 9, 20));
  });
  it('おすすめの受験クラスは、強いほど上', () => {
    expect(recommendedEntryClass(5)).toBe(0);
    expect(recommendedEntryClass(25)).toBe(2);
    expect(recommendedEntryClass(31)).toBe(5);
    expect(recommendedEntryClass(45)).toBe(7);
    let previous = -1;
    for (let level = 0; level <= 49; level += 1) {
      expect(recommendedEntryClass(level)).toBeGreaterThanOrEqual(previous);
      previous = recommendedEntryClass(level);
    }
  });
});

describe('研修会の世界', () => {
  it('クラスごとに研修会員がいる', () => {
    const world = createWorld(createRng(3), mini);
    const board = nameboard({ world, phase: 'exam', cls: 0, userName: 'やこび' });
    expect(board).toHaveLength(13);
    for (const column of board) expect(column.tags.length).toBeGreaterThan(0);
  });
  it('何年たっても、クラスごとの人数が大きく偏らない', () => {
    let run = joined({}, 0);
    const rng = createRng(5);
    for (let index = 0; index < 240; index += 1) run = play(run, rng.next() < 0.3 ? 'win' : 'loss');
    const counts = describeKenshukai(run).board.map((column) => column.tags.length);
    const total = counts.reduce((sum, value) => sum + value, 0);
    expect(total).toBeGreaterThan(40);
    expect(Math.max(...counts)).toBeLessThan(total / 3);
  });
});

describe('入会試験', () => {
  it('受験クラスの研修会員と4局。2勝2敗ならそのまま入会し、同期が2人できる', () => {
    let run = run0();
    expect(run.phase).toBe('exam');
    expect(run.pending.kind).toBe('exam');
    expect(run.players[run.pending.opponentId].cls).toBe(4);
    run = playAll(run, ['win', 'win', 'loss']);
    expect(run.phase).toBe('exam');
    run = play(run, 'loss');
    expect(run.phase).toBe('reikai');
    expect(run.cls).toBe(4);
    expect(run.events.map(({ kind }) => kind)).toContain('join');
    expect(run.peers).toHaveLength(2);
    expect(run.peers.every((id) => run.world.members[id].peer && run.world.members[id].cls === 4)).toBe(true);
    expect(eventStamp(run.events).title).toBe('D2クラスで入会！');
  });
  it('全勝なら1つ上、1勝以下なら1つ下から入る', () => {
    expect(playAll(run0(), ['win', 'win', 'win', 'win']).cls).toBe(5);
    expect(playAll(run0(), ['win', 'loss', 'loss', 'loss']).cls).toBe(3);
    expect(playAll(run0({}, 0), ['loss', 'loss', 'loss', 'loss']).cls).toBe(0);
  });
  it('試験の一言は、落ちないことと、全部勝てば上から入れることを伝える', () => {
    const run = run0();
    expect(pendingTip(describeKenshukai(run))).toContain('落ちることはない');
    const after = playAll(run, ['win', 'win']);
    expect(pendingTip(describeKenshukai(after))).toContain('D1から入れる');
    expect(after.pending.stakes.goal).toBe('あと2勝でD1から');
    // 1つ上に届かなくなったら、受験クラスのまま入るまでの勝ち数。
    expect(playAll(run, ['win', 'loss']).pending.stakes.goal).toBe('あと1勝でD2から');
    expect(playAll(run, ['win', 'win', 'loss']).pending.stakes.goal).toBe('D2から入るのは決まり');
  });
});

describe('例会と指導対局', () => {
  it('例会は1日4局。2回に1回の例会の4局目は、竜王戦の名簿の棋士との駒落ちの指導対局', () => {
    let run = joined();
    expect(run.day.no).toBe(1);
    expect(run.day.kinds).toEqual(['game', 'game', 'game', 'game']);
    run = playAll(run, ['win', 'loss', 'win', 'loss']);
    expect(run.day.no).toBe(SHIDO_EVERY);
    expect(run.day.kinds).toEqual(['game', 'game', 'game', 'shido']);
    run = playAll(run, ['loss', 'win', 'loss']);
    const pending = run.pending;
    expect(pending.kind).toBe('shido');
    expect(pending.handicap).toBe('rook');
    expect(pending.handicapLabel).toBe('飛車落ち');
    expect(pending.color).toBe('black');
    expect(pending.label).toContain('指導対局（飛車落ち）');
    const teacher = run.players[pending.opponentId];
    expect(teacher.kind).toBe('teacher');
    expect(Object.values(roster.players).some((member) => member.name === teacher.name)).toBe(true);
    expect(pendingTip(describeKenshukai(run))).toContain('先生との指導対局');
    // 指導対局の勝ちも、昇級の成績に数える。
    const before = run.record.wins;
    run = play(run, 'win');
    expect(run.games.at(-1)).toMatchObject({ kind: 'shido', handicap: 'rook', win: true });
    expect(run.record.wins === before + 1 || run.events.some(({ kind }) => kind === 'promote')).toBe(true);
    expect(eventStamp(run.events)?.seal === '指導' || eventStamp(run.events)?.seal === '昇級').toBe(true);
    expect(run.day.results).toHaveLength(0);
    expect(run.day.no).toBe(3);
  });
  it('指導対局「なし」なら、4局とも研修会員と指す', () => {
    let run = joined({ shido: false });
    run = playAll(run, ['win', 'loss', 'win', 'loss']);
    expect(run.day.kinds).toEqual(['game', 'game', 'game', 'game']);
  });
  it('みじかいでは、D2から3連勝でD1へ昇級し、名札が上の列へ移る', () => {
    let run = joined();
    run = playAll(run, ['win', 'win', 'win']);
    expect(run.cls).toBe(5);
    expect(eventStamp(run.events).title).toBe('D1クラスに昇級！');
    const board = describeKenshukai(run).board;
    expect(board[5].tags.some((tag) => tag.you)).toBe(true);
    expect(board[4].tags.some((tag) => tag.you)).toBe(false);
  });
  it('負けが込むと降級点、もう一度で降級。F2には降級点はない', () => {
    let run = joined();
    run = playAll(run, ['loss', 'loss', 'loss']);
    expect(describeKenshukai(run).slumpWarning).toBe(true);
    expect(run.pending.stakes.warning).toBe('あと1つ負けると降級点');
    run = play(run, 'loss');
    expect(run.point).toBe(true);
    run = playAll(run, ['loss', 'loss', 'loss', 'loss']);
    expect(run.cls).toBe(3);
    expect(eventStamp(run.events).seal).toBe('降級');
    let bottom = joined({}, 0);
    bottom = playAll(bottom, Array(8).fill('loss'));
    expect(bottom.cls).toBe(0);
    expect(bottom.point).toBe(false);
  });
  it('同じ例会のほかの対局を速報に持つ', () => {
    const run = joined();
    expect(run.pending.others.games.length).toBeGreaterThan(5);
    expect(run.pending.others.games.every(({ a, b }) => a !== USER_ID && b !== USER_ID)).toBe(true);
  });
});

describe('A2とS', () => {
  it('A2に上がると奨励会6級への編入の資格。Sに上がると研修会の頂点で、次の1局はない', () => {
    let run = joined({}, 7);
    expect(run.cls).toBe(7);
    let guard = 0;
    while (!run.qualified && guard < 60) { run = play(run, 'win'); guard += 1; }
    expect(run.cls).toBe(A2);
    expect(run.events.map(({ kind }) => kind)).toContain('qualify');
    expect(eventStamp(run.events).seal).toBe('A2');
    const view = describeKenshukai(run);
    expect(view.qualified).toBe(true);
    expect(transferTalk(view)).toContain('編入');
    while (run.phase !== 'top' && guard < 120) { run = play(run, 'win'); guard += 1; }
    expect(run.phase).toBe('top');
    expect(run.cls).toBe(TOP);
    expect(run.pending).toBeNull();
    expect(eventStamp(run.events).seal).toBe('S');
  });
});

describe('局数の見積もり(docs/kenshukai-design.mdの2章)', () => {
  it('みじかいは、勝率7割ならD2からA2まで20〜90局ほど', () => {
    const counts = [];
    for (let trial = 0; trial < 6; trial += 1) {
      const rng = createRng(1000 + trial);
      let run = createKenshukaiRun({ seed: 50 + trial, settings: { scale: 'mini' }, entryClass: 4, userLevel: 20, roster });
      let games = 0;
      while (!run.qualified && games < 400) { run = play(run, rng.next() < 0.7 ? 'win' : 'loss'); games += 1; }
      counts.push(games);
    }
    const mean = counts.reduce((sum, value) => sum + value, 0) / counts.length;
    expect(mean).toBeGreaterThan(20);
    expect(mean).toBeLessThan(90);
  });
});

describe('保存と、挑戦を終える', () => {
  it('相手の表は保存せず、読み込むと世界から付け直す。壊れた保存は新しいキャリア', () => {
    const storage = memory();
    const run = joined();
    saveKenshukai(storage, { ...createKenshukaiCareer(), run });
    expect(storage.data.get(KENSHUKAI_KEY)).not.toContain('"players"');
    const loaded = loadKenshukai(storage);
    expect(loaded.run.players[loaded.run.pending.opponentId].name).toBe(run.players[run.pending.opponentId].name);
    storage.setItem(KENSHUKAI_KEY, '{broken');
    expect(loadKenshukai(storage).run).toBeNull();
  });
  it('A2から奨励会へ編入して閉じると、要約と、いちばん上がったクラスが残る', () => {
    let run = joined({}, 7);
    while (!run.qualified) run = play(run, 'win');
    const career = closeKenshukaiRun({ ...createKenshukaiCareer(), run }, { transfer: true });
    expect(career.run).toBeNull();
    expect(career.best).toBe(A2);
    expect(career.history[0]).toMatchObject({ result: 'transfer', best: 'A2', entry: 'C1' });
    expect(entryTalk({ best: career.best, runs: 1 })).toContain('A2まで上がった');
  });
  it('資格がないまま閉じると、編入にはならない', () => {
    const career = closeKenshukaiRun({ ...createKenshukaiCareer(), run: joined() }, { transfer: true });
    expect(career.history[0].result).toBe('closed');
  });
});
