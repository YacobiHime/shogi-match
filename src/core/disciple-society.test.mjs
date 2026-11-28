import { describe, expect, it } from 'vitest';
import { STAT_KEYS, overallLevel } from './disciple-strength.mjs';
import { createDiscipleRun, chooseAction, playEvent, turnKind, chooseWords, pendingOpponentLevel, opponentLevel, eventOpponent, watchSpec } from './disciple-run.mjs';
import { MEMBER_SKILL_LEVELS, STAT_HINTS, memberAbilities, memberAbilityPanel, memberMakeup, memberMasteryRows, memberSkills, societyView } from './disciple-society.mjs';
import { SKILL_LEVEL_PLUS } from './disciple-strength.mjs';
import { masteryForLevel, styleMastery } from './strategy-mastery.mjs';
import { nextTeai, teaiRule, teaiRatingBonus, TEAI_RATING } from './teai.mjs';

/** 弟子を進める(研修会の例会を結果だけで)。untilが真になるまで。 */
function advance(state, until, limit = 400) {
  let s = state;
  for (let i = 0; i < limit && !s.end && !until(s); i += 1) {
    const kind = turnKind(s);
    if (kind === 'free') s = s.stamina < 45 ? chooseAction(s, { kind: 'rest' }).state : chooseAction(s, { kind: 'train', id: 'tsume' }).state;
    else if (kind === 'exam' || kind === 'reikai') s = playEvent(s, { plan: { opening: 'own', ending: 'wait' } }).state;
    else if (kind === 'words') s = chooseWords(s, 'review').state;
    s.sceneQueue = [];
  }
  return s;
}

describe('手合い(36-4)', () => {
  it('段級の差で、平手・平香交じり・香落ち', () => {
    expect(teaiRule(0)).toBe('hirate');
    expect(teaiRule(1)).toBe('hanko');
    expect(teaiRule(-2)).toBe('lance');
    expect(teaiRule(3)).toBe('lance');
  });

  it('平香交じりは平手と香落ちを交互、平手の先後も交互、香落ちは上位が上手で下手が先手の側', () => {
    const memory = {};
    const rng = { next: () => 0.2 };
    const a = { id: 'a', rank: 3 };
    const b = { id: 'b', rank: 2 };
    const first = nextTeai({ a, b, memory, rng });
    expect(first.teai).toBe('hirate');
    const second = nextTeai({ a, b, memory, rng });
    expect(second).toMatchObject({ teai: 'lance', giver: 'a', black: 'b' });
    const third = nextTeai({ a, b, memory, rng });
    expect(third.teai).toBe('hirate');
    expect(third.black).not.toBe(first.black);
    const far = nextTeai({ a: { id: 'c', rank: 5 }, b: { id: 'd', rank: 3 }, memory, rng });
    expect(far).toMatchObject({ teai: 'lance', giver: 'c', black: 'd' });
    expect(teaiRatingBonus(far, 'd')).toBe(TEAI_RATING);
    expect(teaiRatingBonus(far, 'c')).toBe(0);
  });

  it('師匠の1年の研修会は、例会に手合いと指導対局が付き、駒落ちの局は駒落ちの局面から観戦する(37章)', () => {
    let s = createDiscipleRun({ seed: 11, discipleId: 'minato' });
    let sawLance = false;
    let sawShido = false;
    for (let i = 0; i < 200 && !(sawLance && sawShido); i += 1) {
      s = advance(s, (x) => turnKind(x) === 'reikai', 30);
      if (s.end || s.shoreikai) break;
      const run = s.kenshukai;
      expect(run.settings.teai).toBe(true);
      const teai = run.day.teai ?? [];
      for (const [index, kind] of (run.day.kinds ?? []).entries()) {
        if (kind === 'shido') sawShido = true;
        if (teai[index]?.teai === 'lance') sawLance = true;
      }
      if (run.pending?.handicap) {
        const made = watchSpec(s);
        // 駒落ちの局面から、上手(後手の側)が先に指す。上手は作戦帳を使わない。
        expect(made.spec.sfen.split(' ')[1]).toBe('w');
        expect(made.spec.plans.white).toBeNull();
        expect(made.side).toBe(run.pending.handicapGiver === 'player' ? 'white' : 'black');
        expect(eventOpponent(s).teai).toMatch(/香落ち|指導対局/);
      }
      if (run.pending?.teai === 'lance') {
        const member = run.world.members[run.pending.opponentId];
        const shift = run.pending.handicapGiver === 'opponent' ? -1 : 1;
        expect(Math.sign(pendingOpponentLevel(s, member) - opponentLevel(member, run.cls))).toBe(shift);
      }
      s = playEvent(s, { plan: { opening: 'own', ending: 'wait' } }).state;
    }
    expect(sawLance).toBe(true);
    expect(sawShido).toBe(true);
  });
});

describe('会の画面(36-5)', () => {
  it('会員の4つの能力は、全体の強さがその会員のLvになり、偏りがある', () => {
    for (const level of [18, 25, 33, 40]) {
      const rows = memberAbilities('k12', level);
      const stats = Object.fromEntries(rows.map((row) => [row.key, row.value]));
      expect(Math.abs(overallLevel(stats) - level)).toBeLessThan(0.6);
      const values = rows.map((row) => row.value);
      expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(150);
      expect(rows.map((row) => row.key)).toEqual([...STAT_KEYS]);
    }
    expect(memberAbilities('k12', 25)).toEqual(memberAbilities('k12', 25));
  });

  it('研修会: 名札掛けに弟子の名札、次の例会の対戦表、前回の例会の結果、会員、規定', () => {
    const s = advance(createDiscipleRun({ seed: 11, discipleId: 'minato' }), (x) => x.kenshukai?.phase === 'reikai' && Boolean(x.lastDay));
    const view = societyView(s);
    expect(view.kind).toBe('kenshukai');
    expect(view.title).toBe('研修会');
    expect(view.board.flatMap((column) => column.tags).find((tag) => tag.you)?.name).toBe(s.name);
    expect(view.upcoming.mine.length).toBeGreaterThan(0);
    expect(view.upcoming.others.every((game) => game.winner === null)).toBe(true);
    expect(view.last.mine.every((game) => game.result === 'win' || game.result === 'loss')).toBe(true);
    expect(view.members.length).toBeGreaterThan(10);
    expect(view.members[0].abilities).toHaveLength(4);
    // 会員の札は棋士名鑑と同じ部品の形(44章): 4つの能力・型・得意戦法の使用率。
    const card = view.members[0];
    expect(card.ability.abilities.map((row) => row.key)).toEqual([...STAT_KEYS]);
    expect(card.ability.openings.length).toBeGreaterThan(0);
    expect(card.ability.openings.reduce((sum, row) => sum + row.share, 0)).toBeGreaterThan(90);
    expect(card.repertoire).toBeTruthy();
    expect(Array.isArray(card.skills)).toBe(true);
    expect(card.mastery.length).toBeGreaterThan(0);
    expect(card.mastery.every((row) => row.value >= 0 && row.value <= 100)).toBe(true);
    expect(view.rules.rule).toMatch(/連勝/);
    expect(view.rules.teai).toHaveLength(3);
  });

  it('会員の札の型の一言と説明(44章)', () => {
    const flat = [{ key: 'reading', label: '読み', value: 700, rank: 'C' }, { key: 'plan', label: '作戦', value: 720, rank: 'C' }, { key: 'steady', label: '安定', value: 690, rank: 'C' }, { key: 'mate', label: '詰み', value: 710, rank: 'C' }];
    expect(memberAbilityPanel(null, flat)).toMatchObject({ type: 'バランス型', staticShare: null, openings: [], specials: [] });
    const spiky = flat.map((row) => (row.key === 'mate' ? { ...row, value: 950 } : row.key === 'plan' ? { ...row, value: 500 } : row));
    expect(memberAbilityPanel(null, spiky).type).toBe('詰みが得意・作戦が苦手');
    expect(memberAbilityPanel(null, flat).abilities.every((row) => row.hint === STAT_HINTS[row.key])).toBe(true);
  });

  it('会員のスキル: Lvで数が増え、毎回同じ。強さ(能力＋いつも効くスキル)はLvのまま(45章)', () => {
    expect(memberSkills('k3', MEMBER_SKILL_LEVELS.two)).toHaveLength(2);
    expect(memberSkills('k3', MEMBER_SKILL_LEVELS.one)).toHaveLength(1);
    expect(memberSkills('k3', 40)).toEqual(memberSkills('k3', 40));
    expect(memberSkills('k3', 40)).not.toContain('fujii-curve');
    for (const id of ['k1', 'k7', 's4', 'rival-x']) {
      for (const level of [24, 36, 44]) {
        const { skills, abilities } = memberMakeup(id, level);
        const plus = skills.reduce((sum, skill) => sum + (SKILL_LEVEL_PLUS[skill] ?? 0), 0);
        const stats = Object.fromEntries(abilities.map((row) => [row.key, row.value]));
        expect(Math.abs(overallLevel(stats) + plus - level)).toBeLessThan(0.7);
      }
    }
  });

  it('戦法熟練度: よく指す戦法ほど高く、いちばんよく指す戦法はLvの熟練度(45章)', () => {
    const usage = { black: { a: 60, b: 30 }, white: { a: 60, b: 10 } };
    expect(styleMastery(40, usage, 'a')).toBe(masteryForLevel(40));
    expect(styleMastery(40, usage, 'b')).toBeLessThan(masteryForLevel(40));
    expect(styleMastery(40, usage, 'b')).toBeGreaterThanOrEqual(Math.round(masteryForLevel(40) * 0.55));
    expect(styleMastery(40, usage, 'zzz')).toBe(masteryForLevel(40));
    expect(styleMastery(40, null, 'a')).toBe(masteryForLevel(40));
    const rows = memberMasteryRows({ repertoire: { usage: { black: { ibisha: 50, shikenbisha: 50 }, white: { ibisha: 80, shikenbisha: 20 } } } }, 30);
    expect(rows.length).toBe(2);
    expect(rows[0].value).toBeGreaterThanOrEqual(rows[1].value);
  });

  it('奨励会: 段級の名札掛けと年齢制限', () => {
    const s = advance(createDiscipleRun({ seed: 11, discipleId: 'minato' }), (x) => Boolean(x.shoreikai) && Boolean(x.lastDay?.kind === 'shoreikai'), 600);
    expect(s.shoreikai).toBeTruthy();
    const view = societyView(s);
    expect(view.kind).toBe('shoreikai');
    expect(view.rules.age).toMatchObject({ shodan: 21, pro: 26 });
    expect(view.board.length).toBe(9);
  });
});

describe('制度を物語で教える(36-6)', () => {
  it('入会試験の前に研修会の面談、試験のあとに名札掛けの場面。見ると(飛ばしても)制度の札が入る', async () => {
    const { resolveScene, pendingScene } = await import('./disciple-events.mjs');
    const { systemCardsOf } = await import('./disciple-society.mjs');
    let s = createDiscipleRun({ seed: 11, discipleId: 'minato' });
    while (turnKind(s) === 'free') s = chooseAction(s, { kind: 'rest' }).state;
    expect(s.sceneQueue).toContain('sys-kenshukai');
    while (s.sceneQueue?.length) {
      const key = s.sceneQueue[0];
      s = resolveScene(s, key === 'sys-kenshukai' ? 'calm' : null).state;
    }
    expect(systemCardsOf(s).map((card) => card.id)).toEqual(['kenshukai', 'exam']);
    s = playEvent(s, { plan: { opening: 'own', ending: 'wait' } }).state;
    expect(s.sceneQueue).toContain('sys-reikai');
    expect(pendingScene({ ...s, sceneQueue: ['sys-reikai'] }).script).toBe('disciple-sys-reikai');
    s = { ...s, sceneQueue: ['sys-reikai'] };
    s = resolveScene(s, null).state;
    expect(s.systemCards).toEqual(expect.arrayContaining(['reikai', 'promote']));
  });

  it('香落ちのある例会の前に手合いの場面、指導対局の前に先生との駒落ちの場面が積まれる', () => {
    let s = createDiscipleRun({ seed: 11, discipleId: 'minato' });
    const queued = new Set();
    for (let i = 0; i < 300 && !s.end && !s.shoreikai && !(queued.has('sys-teai') && queued.has('sys-shido')); i += 1) {
      const kind = turnKind(s);
      if (kind === 'free') s = s.stamina < 45 ? chooseAction(s, { kind: 'rest' }).state : chooseAction(s, { kind: 'train', id: 'tsume' }).state;
      else if (kind === 'exam' || kind === 'reikai') s = playEvent(s, { plan: { opening: 'own', ending: 'wait' } }).state;
      else if (kind === 'words') s = chooseWords(s, 'review').state;
      for (const key of s.sceneQueue ?? []) queued.add(key);
      // 見たことにする(同じ場面は1回だけ)。
      s.scenesSeen = { ...s.scenesSeen, ...Object.fromEntries((s.sceneQueue ?? []).map((key) => [key, { count: 1, turn: s.turn }])) };
      s.sceneQueue = [];
    }
    expect(queued.has('sys-teai')).toBe(true);
    expect(queued.has('sys-shido')).toBe(true);
  });
});

describe('駒落ちの局の手番(37章)', async () => {
  const { moverOfPly, firstMover, discipleWatchMoves } = await import('./disciple-strength.mjs');
  const { reviewRows } = await import('./disciple-review.mjs');
  const { goodMoves } = await import('./disciple-causes.mjs');
  const { LEARNING_HANDICAPS } = await import('./learning-setup.mjs');
  const lance = LEARNING_HANDICAPS.find((item) => item.id === 'lance').sfen;
  it('駒落ちは上手(後手の側)が1手目を指す', () => {
    expect(firstMover('')).toBe('black');
    expect(firstMover(lance)).toBe('white');
    expect(moverOfPly(1, lance)).toBe('white');
    expect(moverOfPly(2, lance)).toBe('black');
    expect(moverOfPly(1, '')).toBe('black');
  });
  it('見立てと棋譜の行は、駒落ちの局でも弟子の手を正しく数える', () => {
    const entries = [{ move: '5a4b', eval: 0 }, { move: '7g7f', eval: 0 }, { move: '3c3d', eval: 0 }, { move: '2g2f', eval: -600 }];
    expect(discipleWatchMoves(entries, 'black', { start: lance }).map((move) => move.ply)).toEqual([2, 4]);
    expect(discipleWatchMoves(entries, 'white', { start: lance }).map((move) => move.ply)).toEqual([1, 3]);
    const rows = reviewRows(entries, 'black', { sfen: lance });
    expect(rows.map((row) => row.mine)).toEqual([false, true, false, true]);
    expect(goodMoves(entries, 'black', { start: lance }).every((move) => move.ply % 2 === 0)).toBe(true);
  });
});
