import { describe, expect, it } from 'vitest';
import {
  PRO_EVENT_RULES, TIME_RULES, clockAt, clockEffect, commitClock, cpuThinkPlan, createClock, fastForwardProgress,
  fastForwardSeconds, playerClockView, restoreClock, timeRuleText, tournamentTimeControl,
} from './time-control.mjs';
import { PRO_EVENTS } from './pro-year.mjs';
import { applyCharacter } from './player-character.mjs';
import { createRng } from './ryuo-random.mjs';

const season = (pending, extra = {}) => ({ pending, ...extra });

describe('大会の持ち時間の決まり', () => {
  it('竜王戦・名人戦は、実際の持ち時間(予選と番勝負)', () => {
    expect(tournamentTimeControl({ event: 'ryuo', season: season({ kind: 'game' }) })).toMatchObject({ main: 5 * 3600, byoyomi: 60 });
    expect(tournamentTimeControl({ event: 'ryuo', season: season({ kind: 'finals' }) })).toMatchObject({ main: 8 * 3600, days: 2 });
    expect(tournamentTimeControl({ event: 'meijin', season: season({ kind: 'league' }) })).toMatchObject({ main: 6 * 3600 });
    expect(tournamentTimeControl({ event: 'meijin', season: season({ kind: 'finals' }) })).toMatchObject({ main: 9 * 3600, days: 2 });
  });

  it('奨励会は90分、研修会と高校の団体戦は30分・秒読み30秒、プロの早指し団体戦はフィッシャー', () => {
    expect(tournamentTimeControl({ event: 'shoreikai', season: season({ kind: 'league' }) })).toMatchObject({ main: 90 * 60, byoyomi: 60 });
    expect(tournamentTimeControl({ event: 'kenshukai', season: season({ kind: 'reikai' }) })).toMatchObject({ main: 30 * 60, byoyomi: 30 });
    expect(tournamentTimeControl({ event: 'team', season: season({ kind: 'game' }, { format: 'school' }) })).toMatchObject({ main: 30 * 60 });
    expect(tournamentTimeControl({ event: 'team', season: season({ kind: 'game' }, { format: 'pro' }) })).toMatchObject({ main: 300, increment: 5, byoyomi: 0 });
  });

  it('棋士の1年は、棋戦と段階ごと(NHK杯10分・朝日杯40分・七番勝負8時間)。練習と指導は持ち時間なし', () => {
    const at = (eventId, stageId) => tournamentTimeControl({ event: 'pro-year', season: season({ kind: 'game', gameId: 'g', eventId, stageId }) });
    expect(at('nhk', 'main')).toMatchObject({ main: 600, byoyomi: 30 });
    expect(at('asahi', 'q1')).toMatchObject({ main: 2400, byoyomi: 60 });
    expect(at('oi', 'title')).toMatchObject({ main: 8 * 3600, days: 2 });
    expect(at('eio', 'q')).toMatchObject({ main: 3600 });
    expect(tournamentTimeControl({ event: 'pro-year', season: season({ kind: 'study' }) })).toBeNull();
    expect(tournamentTimeControl({ event: 'pro-year', season: season({ kind: 'shidou' }) })).toBeNull();
    // 前の版の保存(棋戦と段階のidがない)は、5時間。
    expect(tournamentTimeControl({ event: 'pro-year', season: season({ kind: 'game', gameId: 'g' }) })).toMatchObject({ main: 5 * 3600 });
  });

  it('棋士の1年のすべての棋戦の段階に、決まりがある', () => {
    for (const event of PRO_EVENTS) {
      for (const stage of event.stages) expect(TIME_RULES[PRO_EVENT_RULES[event.id]?.[stage.id]], `${event.id}:${stage.id}`).toBeTruthy();
    }
  });

  it('対局がなければnull、決まりの言葉', () => {
    expect(tournamentTimeControl({ event: 'ryuo', season: { pending: null } })).toBeNull();
    expect(timeRuleText(TIME_RULES.h5)).toBe('持ち時間5時間・秒読み1分');
    expect(timeRuleText(TIME_RULES.h8)).toBe('持ち時間8時間・秒読み1分（二日制）');
    expect(timeRuleText(TIME_RULES.m10)).toBe('持ち時間10分・秒読み30秒');
    expect(timeRuleText(TIME_RULES.fischer)).toBe('持ち時間5分・1手ごとに5秒加算');
  });
});

describe('時計の記録', () => {
  const control = TIME_RULES.m10;
  it('指した側の時計から考えた時間を引き、使い切ったら0(秒読み)', () => {
    let clock = createClock(control);
    clock = commitClock(clock, { ply: 1, side: 'black', spent: 100, control });
    clock = commitClock(clock, { ply: 2, side: 'white', spent: 700, control });
    expect(clockAt(clock, 2)).toEqual({ black: 500, white: 0 });
    expect(clockAt(clock, 1)).toEqual({ black: 500, white: 600 });
  });

  it('待ったで戻した手数から指し直すと、後ろの記録を捨てる', () => {
    let clock = createClock(control);
    clock = commitClock(clock, { ply: 1, side: 'black', spent: 10, control });
    clock = commitClock(clock, { ply: 2, side: 'white', spent: 10, control });
    clock = commitClock(clock, { ply: 1, side: 'black', spent: 50, control });
    expect(clockAt(clock, 2)).toEqual({ black: 550, white: 600 });
  });

  it('フィッシャーは指すたびに足す。勝負どころからは使った分を引いておく', () => {
    const fischer = TIME_RULES.fischer;
    const clock = commitClock(createClock(fischer), { ply: 1, side: 'black', spent: 20, control: fischer });
    expect(clockAt(clock, 1).black).toBe(285);
    expect(clockAt(createClock(TIME_RULES.h5, { usedPlies: 40 }), 0).black).toBeLessThan(5 * 3600);
  });

  it('保存から戻す(形が違えばnull)', () => {
    const clock = commitClock(createClock(control), { ply: 1, side: 'black', spent: 30, control });
    expect(restoreClock(JSON.parse(JSON.stringify(clock)))).toEqual(clock);
    expect(restoreClock({ marks: {} })).toBeNull();
    expect(restoreClock('x')).toBeNull();
  });

  it('プレイヤーは、使い切ったら秒読み。0秒でも負けにしない(秒読みの残りが0)', () => {
    expect(playerClockView(100, 40, control)).toEqual({ remaining: 60, byoyomi: false, byoyomiLeft: 0 });
    expect(playerClockView(100, 110, control)).toEqual({ remaining: 0, byoyomi: true, byoyomiLeft: 20 });
    expect(playerClockView(100, 999, control)).toEqual({ remaining: 0, byoyomi: true, byoyomiLeft: 0 });
  });
});

describe('相手の考えた時間と時間の重圧', () => {
  const play = (control, character = null, plies = 150, seed = 1) => {
    const rng = createRng(seed);
    let left = control.main;
    const plans = [];
    for (let ply = 1; ply <= plies; ply += 2) {
      const plan = cpuThinkPlan({ control, left, ply, rng, character });
      plans.push(plan);
      left = Math.max(0, left - plan.seconds) + (control.increment ?? 0);
    }
    return { plans, left };
  };

  it('5時間の対局は、序盤は早く、中盤に使い、長い対局の終わりで秒読みに入る', () => {
    const { plans } = play(TIME_RULES.h5);
    const opening = plans.slice(0, 10).reduce((sum, plan) => sum + plan.seconds, 0);
    const middle = plans.slice(15, 25).reduce((sum, plan) => sum + plan.seconds, 0);
    expect(middle).toBeGreaterThan(opening);
    expect(plans.some((plan) => plan.pressure === 'byoyomi')).toBe(true);
    expect(plans.slice(0, 20).every((plan) => plan.pressure !== 'byoyomi')).toBe(true);
  });

  it('10分の早指しは、5時間より早く秒読みに入る', () => {
    const firstByoyomi = (control) => {
      const counts = [];
      for (let seed = 1; seed <= 20; seed += 1) {
        const index = play(control, null, 150, seed).plans.findIndex((plan) => plan.pressure === 'byoyomi');
        counts.push(index < 0 ? 99 : index);
      }
      return counts.reduce((a, b) => a + b, 0) / counts.length;
    };
    expect(firstByoyomi(TIME_RULES.m10)).toBeLessThanOrEqual(firstByoyomi(TIME_RULES.h5));
  });

  it('秒読みの手は秒読みの秒数より短く考え、残りの持ち時間を超えない', () => {
    const rng = createRng(3);
    for (let i = 0; i < 50; i += 1) {
      const plan = cpuThinkPlan({ control: TIME_RULES.h5, left: 0, ply: 120, rng });
      expect(plan.pressure).toBe('byoyomi');
      expect(plan.seconds).toBeLessThan(60);
    }
  });

  it('時間に追われる棋士は、中盤で多く使う', () => {
    const trouble = { traits: [{ id: 'time-trouble', degree: 2 }] };
    const total = (character) => {
      let sum = 0;
      for (let seed = 1; seed <= 30; seed += 1) sum += cpuThinkPlan({ control: TIME_RULES.h5, left: 10000, ply: 50, rng: createRng(seed), character }).seconds;
      return sum;
    };
    expect(total(trouble)).toBeGreaterThan(total(null));
  });

  it('重圧は、秒読みが短いほど浅く荒く、長考は冴える', () => {
    expect(clockEffect({ pressure: 'byoyomi', short: true })).toEqual({ nodes: 0.6, sharpen: -0.45 });
    expect(clockEffect({ pressure: 'byoyomi', short: false }).nodes).toBeGreaterThan(0.6);
    expect(clockEffect({ pressure: 'long', short: false }).sharpen).toBeGreaterThan(0);
    expect(clockEffect({ pressure: 'calm', short: false })).toBeNull();
    expect(clockEffect(null)).toBeNull();
  });

  it('秒読みの重圧で、相手の探索量が減り、最善手の率が下がる(最善手だけの強さは変えない)', () => {
    const strength = { nodes: 20000, bestMoveRate: 0.6, scoreTemperature: 100, maxScoreLoss: 300, multiPv: 3 };
    const situation = { phase: 'middle', ply: 60, close: true };
    const calm = applyCharacter(strength, { attack: 0, traits: [] }, situation, { skill: 30 });
    const rushed = applyCharacter(strength, { attack: 0, traits: [] }, { ...situation, clock: { pressure: 'byoyomi', short: true } }, { skill: 30 });
    expect(rushed.nodes).toBeLessThan(calm.nodes);
    expect(rushed.bestMoveRate).toBeLessThan(calm.bestMoveRate);
    const top = { ...strength, bestMoveRate: 1 };
    expect(applyCharacter(top, { attack: 0, traits: [] }, { ...situation, clock: { pressure: 'byoyomi', short: true } }, { skill: 30 }).nodes).toBe(20000);
  });
});

describe('相手の時計の早送り', () => {
  it('長く考えた手ほど長く回し、上限がある。見込みの長さでほぼ回し終える', () => {
    expect(fastForwardSeconds(3600)).toBeGreaterThan(fastForwardSeconds(10));
    expect(fastForwardSeconds(100000)).toBeLessThanOrEqual(2.2);
    expect(fastForwardProgress(0, 600)).toBe(0);
    expect(fastForwardProgress(fastForwardSeconds(600), 600)).toBeGreaterThan(0.94);
  });
});
