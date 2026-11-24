import { describe, expect, it } from 'vitest';
import { STAT_KEYS, overallLevel } from './disciple-strength.mjs';
import { createDiscipleRun, chooseAction, playEvent, turnKind, chooseWords, pendingOpponentLevel, opponentLevel, eventOpponent, watchSpec } from './disciple-run.mjs';
import { memberAbilities, societyView } from './disciple-society.mjs';
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

  it('師匠の1年の研修会は、例会に手合いと指導対局が付き、香落ちの局は観戦しない', () => {
    let s = createDiscipleRun({ seed: 11, discipleId: 'minato' });
    let sawLance = false;
    let sawShido = false;
    for (let i = 0; i < 200 && !(sawLance && sawShido); i += 1) {
      s = advance(s, (x) => turnKind(x) === 'reikai', 30);
      if (s.end || s.shoreikai) break;
      const run = s.kenshukai;
      expect(run.settings.teai).toBe(true);
      // 平手の局が先に並ぶ(はじめの局は、平手の局があれば平手)。
      const teai = run.day.teai ?? [];
      const lanceFirst = teai[0]?.teai === 'lance';
      if (lanceFirst) expect(teai.every((item) => !item || item.teai === 'lance')).toBe(true);
      for (const [index, kind] of (run.day.kinds ?? []).entries()) {
        if (kind === 'shido') sawShido = true;
        if (teai[index]?.teai === 'lance') sawLance = true;
      }
      if (run.pending?.handicap) {
        expect(watchSpec(s)).toBeNull();
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
    expect(view.rules.rule).toMatch(/連勝/);
    expect(view.rules.teai).toHaveLength(3);
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
