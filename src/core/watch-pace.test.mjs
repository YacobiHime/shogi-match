import { test } from 'vitest';
import assert from 'node:assert/strict';
import { PACE_MAX_MS, PACE_MIN_MS, paceMs, watchClocks } from './watch-pace.mjs';
import { discipleTimeRule, watchTimeControl } from './time-control.mjs';

test('弟子の対局の持ち時間は、研修会30分、奨励会の級位者1時間・段位者1時間30分(38章)', () => {
  assert.equal(discipleTimeRule({ event: 'kenshukai' }).main, 30 * 60);
  assert.equal(discipleTimeRule({ event: 'kenshukai' }).byoyomi, 30);
  assert.equal(discipleTimeRule({ event: 'shoreikai', ranks: [0, 5] }).main, 60 * 60);
  assert.equal(discipleTimeRule({ event: 'shoreikai', ranks: [6, 8] }).main, 90 * 60);
  assert.equal(discipleTimeRule({ event: 'shoreikai', ranks: [8, 8] }).byoyomi, 60);
  // 級位者と段位者の局は、下の段級の決まり。
  assert.equal(discipleTimeRule({ event: 'shoreikai', ranks: [5, 6] }).main, 60 * 60);
  assert.match(discipleTimeRule({ event: 'shoreikai', ranks: [7, 7] }).text, /1時間30分.*秒読み1分/);
  const control = watchTimeControl(discipleTimeRule({ event: 'kenshukai' }));
  assert.deepEqual(control.breaks, []);
  assert.equal(control.seal, null);
});

test('1手を見せる長さは、使った持ち時間に合わせ、下限と上限のあいだ', () => {
  assert.equal(paceMs({ time: 0 }), PACE_MIN_MS);
  assert.ok(paceMs({ time: 3 * 3600 }) <= PACE_MAX_MS && paceMs({ time: 3 * 3600 }) > 2000);
  assert.ok(paceMs({ time: 60 }) > paceMs({ time: 5 }));
  assert.ok(paceMs({ time: 60 }) >= 900 && paceMs({ time: 60 }) <= 1100);
  assert.equal(paceMs(null), PACE_MIN_MS);
});

test('時計は見せた手まで引き、考えている手は早送りで減る。使い切ったら秒読み', () => {
  const control = { main: 100, byoyomi: 30 };
  const entries = [{ time: 40 }, { time: 10 }, { time: 70 }, { time: 20 }];
  assert.deepEqual(watchClocks(entries, 2, { control }), { black: 60, white: 90, fast: '' });
  const half = watchClocks(entries, 2, { control, progress: 0.5 });
  assert.equal(half.black, 25);
  assert.equal(half.fast, 'black');
  // 70秒使うと、残り60秒を越えて秒読みに入る(秒読み30秒のうち10秒使った)。
  const over = watchClocks(entries, 2, { control, progress: 1 });
  assert.equal(over.black, 0);
  assert.equal(over.blackByoyomi, 20);
  const after = watchClocks(entries, 3, { control });
  assert.equal(after.black, 0);
  assert.equal(after.blackByoyomi, 30);
  // 駒落ち(上手=後手が先に指す)は、はじめの手が後手の時間。
  assert.deepEqual(watchClocks(entries, 1, { control, whiteFirst: true }), { black: 100, white: 60, fast: '' });
});

test('観戦の1手の時間の上限は、読みの時間を縮め、締め切りを読みの1.3倍にする(38章)', async () => {
  const { WATCH_THINK_BUDGET_MS, budgetProfile, thinkProfile } = await import('./reason-think.mjs');
  const strong = thinkProfile({ reading: 49, plan: 49, steady: 49, mate: 49 });
  assert.ok(strong.timeMs > WATCH_THINK_BUDGET_MS);
  const capped = budgetProfile(strong, WATCH_THINK_BUDGET_MS);
  assert.equal(capped.timeMs, WATCH_THINK_BUDGET_MS);
  assert.equal(capped.deadlineScale, 1.3);
  assert.equal(capped.depth, strong.depth);
  assert.equal(budgetProfile(strong, 0), strong);
  const weak = thinkProfile({ reading: 12, plan: 12, steady: 12, mate: 12 });
  assert.equal(budgetProfile(weak, WATCH_THINK_BUDGET_MS).timeMs, weak.timeMs);
});
