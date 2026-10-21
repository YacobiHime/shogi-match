import { describe, expect, it } from 'vitest';
import { applyRatedGame, createRatingState, recommendedLevel } from './player-rating.mjs';
import { CONTENT_SPREAD, TARGET_MARGIN, blendedStrength, recentPerformance, recommendPlay, resultNextStep, resultStrength, unbeatenCap } from './play-coach.mjs';
import { completePlayInsight, createPlayInsight, recordPractice } from './play-insight.mjs';
import { reviewProblemId } from './review-problems.mjs';

/** レーティングRで、すでにgames局指した人から、結果を順に足す。 */
function play(rating, games, results) {
  let state = { ...createRatingState(), rating, games };
  for (const [level, outcome] of results) state = applyRatedGame(state, { opponentLevel: level, outcome }).state;
  return state;
}

describe('勝ち越せる相手(基準のLv)', () => {
  it('勝率6割の見込みで、レーティング÷80より約1つ下を勧める', () => {
    expect(TARGET_MARGIN).toBe(70);
    const state = { ...createRatingState(), rating: 1200, games: 3 };
    expect(recommendedLevel(1200)).toBe(15);
    expect(recommendPlay(state)).toMatchObject({ level: 14, kind: 'normal', title: '対局する' });
  });

  it('記録がない人にも勧める(はじめての対局)', () => {
    const plan = recommendPlay(createRatingState());
    expect(plan.level).toBe(9);
    expect(plan.reason).toContain('Lv.9');
  });

  it('最近の成績が低ければ、そちらで見立てる(負けが続くと早く下げる)', () => {
    const state = play(1200, 20, [[15, 'loss'], [15, 'loss'], [14, 'loss'], [15, 'loss'], [14, 'loss']]);
    expect(recentPerformance(state.history)).toBeLessThan(state.rating);
    expect(resultStrength(state)).toBe(recentPerformance(state.history));
  });
});

describe('実際の勝ち負けで直す', () => {
  it('Lv15に3連敗したら、Lv13で腕ならし(香落ちならLv15)', () => {
    const state = play(1200, 12, [[15, 'loss'], [15, 'loss'], [15, 'loss']]);
    expect(unbeatenCap(state)).toBe(14);
    expect(recommendPlay(state)).toMatchObject({ level: 13, kind: 'warmup', title: 'Lv.13で腕ならし', handicapLevel: 15 });
    expect(recommendPlay(state).reason).toBe('Lv.15に3連敗。2つ下で、勝つ感覚を取り戻そう');
  });

  it('腕ならしで勝ったら、上限(Lv14)まで戻る。Lv14で2連勝したら、Lv15に再挑戦', () => {
    let state = play(1200, 12, [[15, 'loss'], [15, 'loss'], [15, 'loss'], [13, 'win']]);
    const after = recommendPlay(state);
    expect(after.level).toBeLessThanOrEqual(14);
    state = play(state.rating, state.games, []);
    state = { ...state, history: [...play(1200, 12, [[15, 'loss'], [15, 'loss'], [15, 'loss'], [13, 'win'], [14, 'win'], [14, 'win']]).history] };
    state.levels = { 15: { wins: 0, losses: 3, draws: 0 }, 13: { wins: 1, losses: 0, draws: 0 }, 14: { wins: 2, losses: 0, draws: 0 } };
    expect(unbeatenCap(state)).toBe(40);
    expect(recommendPlay(state)).toMatchObject({ level: 15, kind: 'challenge', title: 'Lv.15に挑戦' });
  });

  it('3局以上勝てていないLvは勧めない。1つ下で勝てば、もう一度挑戦できる', () => {
    const stuck = play(1300, 12, [[16, 'loss'], [15, 'win'], [16, 'loss'], [15, 'draw'], [16, 'loss'], [15, 'draw']]);
    expect(unbeatenCap(stuck)).toBe(15);
    expect(recommendPlay(stuck).level).toBeLessThanOrEqual(15);
    const recovered = play(stuck.rating, stuck.games, [[15, 'win']]);
    recovered.history = [...stuck.history, ...recovered.history];
    recovered.levels = { ...stuck.levels, 15: { wins: 2, losses: 0, draws: 2 } };
    expect(unbeatenCap(recovered)).toBe(40);
  });

  it('同じLvに2連敗したら、1つ下', () => {
    const state = play(1250, 12, [[15, 'win'], [15, 'loss'], [15, 'loss']]);
    expect(recommendPlay(state).level).toBeLessThanOrEqual(14);
  });

  it('初めて勝ったLvの次は、1つ上に挑戦', () => {
    const state = play(1100, 12, [[14, 'loss'], [14, 'win']]);
    expect(recommendPlay(state)).toMatchObject({ level: 15, kind: 'first-win', reason: 'Lv.14に初勝利！ 次は1つ上へ' });
  });

  it('直前に指したLvから、1回で2つより大きく動かさない。Lv0〜40に収める', () => {
    const state = play(2000, 12, [[5, 'draw']]);
    const plan = recommendPlay(state);
    expect(plan.level).toBeLessThanOrEqual(7);
    expect(recommendPlay(play(0, 12, [[0, 'loss'], [0, 'loss'], [0, 'loss']])).level).toBe(0);
    const top = play(3400, 30, [[40, 'win'], [40, 'win']]);
    expect(recommendPlay(top).level).toBeLessThanOrEqual(40);
  });

  it('対局が少ないうち(10局未満)は、連敗などの規則を使わない', () => {
    const state = play(1200, 0, [[15, 'loss'], [15, 'loss'], [15, 'loss']]);
    expect(state.games).toBe(3);
    expect(recommendPlay(state).kind).not.toBe('warmup');
  });

  it('次の級まで勝ち1回分なら、昇級をかけた一局', () => {
    // Lv14の目安(十二級程度)はR1080から。R1075なら、あとR5。
    const state = { ...createRatingState(), rating: 1075, games: 20, history: [] };
    const plan = recommendPlay(state);
    expect(plan.kind).toBe('promotion');
    expect(plan.reason).toMatch(/まであとR5。Lv\.\d+に勝てば昇級だよ/);
  });
});

describe('終局画面の主ボタン', () => {
  it('平手で勝ったら1つ上。初勝利なら、そう添える', () => {
    expect(resultNextStep({ won: true, rated: true, level: 15, lanceHandicap: false, firstWin: true })).toMatchObject({
      kind: 'up', level: 16, title: 'Lv.16に挑戦', reason: 'Lv.15に初勝利！ 次は1つ上へ', sameTitle: '同じLv.15でもう一局',
    });
    expect(resultNextStep({ won: true, rated: true, level: 15, lanceHandicap: false, firstWin: false }).reason).toBe('Lv.15に勝ったね。次は1つ上へ');
  });

  it('Lv40は上限なので上を勧めない。香落ちで勝ったら平手。負け・練習の対局はnull', () => {
    expect(resultNextStep({ won: true, rated: true, level: 40, lanceHandicap: false, firstWin: false })).toMatchObject({ kind: 'top', title: 'もう一局' });
    expect(resultNextStep({ won: true, rated: false, level: 15, lanceHandicap: true, firstWin: false })).toMatchObject({ kind: 'even', level: 15, title: '平手でLv.15に挑む', sameTitle: '香落ちでもう一局' });
    expect(resultNextStep({ won: false, rated: true, level: 15, lanceHandicap: false, firstWin: false })).toBeNull();
    expect(resultNextStep({ won: true, rated: false, level: 15, lanceHandicap: false, firstWin: false })).toBeNull();
  });
});

/** 中身の記録。summariesは古い順。 */
function insightOf(summaries, practice = null) {
  let insight = createPlayInsight();
  summaries.forEach((summary, at) => { insight = completePlayInsight(insight, { at, level: 14, outcome: 'loss', color: 'black' }, summary); });
  return practice ? recordPractice(insight, practice) : insight;
}
function summary({ loss = 30, mates = [], freeLosses = 0 } = {}) {
  const phase = { n: 10, sum: loss * 10, big: 0 };
  return { moves: 30, sum: loss * 30, big: 0, phases: { opening: phase, middle: phase, ending: phase }, mates, freeLosses, standing30: 0 };
}

describe('段階2: 対局の中身', () => {
  it('内容の強さは結果6：内容4で混ぜ、結果からR160より外へは動かさない', () => {
    expect(blendedStrength(1200, null)).toBe(1200);
    expect(blendedStrength(1200, 1000)).toBe(1120);
    expect(blendedStrength(1200, 0)).toBe(1200 - CONTENT_SPREAD);
    expect(blendedStrength(1200, 3000)).toBe(1200 + CONTENT_SPREAD);
  });

  it('内容が良ければ、結果より先に上を勧める(測れた手が40手以上のとき)', () => {
    const state = { ...createRatingState(), rating: 1200, games: 3 };
    const good = recommendPlay(state, { insight: insightOf([summary({ loss: 20 }), summary({ loss: 20 })]) });
    expect(good.level).toBeGreaterThan(recommendPlay(state).level);
    const few = recommendPlay(state, { insight: insightOf([summary({ loss: 20 })]) });
    expect(few.level).toBe(recommendPlay(state).level);
  });

  it('復習の期日が来た問題があれば「やこび姫からの1問」', () => {
    const state = { ...createRatingState(), rating: 1200, games: 20, history: [] };
    const id = reviewProblemId('sfen x');
    expect(recommendPlay(state, { reviewDueId: id })).toMatchObject({
      kind: 'practice', title: 'やこび姫からの1問', reason: '前に逃した詰み、今日は見つけられるかな', practice: { kind: 'review', problemId: id },
    });
    expect(recommendPlay(state, { reviewDueId: 'tsume-1' }).reason).toBe('前に苦労した問題、今日は解けるかな');
  });

  it('弱点の練習。詰みを逃したら、その局面の問題(問題があるときだけ)', () => {
    const state = { ...createRatingState(), rating: 1200, games: 20, history: [] };
    const insight = insightOf([summary({ mates: [{ sfen: 'mate sfen', length: 1 }] })]);
    const id = reviewProblemId('mate sfen');
    expect(recommendPlay(state, { insight, problemIds: new Set([id]) })).toMatchObject({
      kind: 'practice', title: '詰みを解き直そう', reason: '詰みを逃した局面があったね。解き直そう', practice: { kind: 'mate', problemId: id },
    });
    expect(recommendPlay(state, { insight, problemIds: new Set() }).kind).not.toBe('practice');
    const free = insightOf([summary({ freeLosses: 2 })]);
    expect(recommendPlay(state, { insight: free })).toMatchObject({ kind: 'practice', practice: { kind: 'free' }, title: '駒の利きを見ながら対局' });
  });

  it('練習は対局2局に1回まで。同じ弱点を続けて出さない', () => {
    const free = [summary({ freeLosses: 2 })];
    const just = { ...createRatingState(), rating: 1200, games: 21, history: [] };
    expect(recommendPlay(just, { insight: insightOf(free, { kind: 'mate', games: 20 }) }).kind).not.toBe('practice');
    const later = { ...just, games: 22 };
    expect(recommendPlay(later, { insight: insightOf(free, { kind: 'mate', games: 20 }) }).practice?.kind).toBe('free');
    expect(recommendPlay(later, { insight: insightOf(free, { kind: 'free', games: 20 }) }).kind).not.toBe('practice');
  });

  it('立て直し・初勝利の次・連勝の挑戦は、練習より先', () => {
    const state = play(1200, 12, [[15, 'loss'], [15, 'loss'], [15, 'loss']]);
    expect(recommendPlay(state, { reviewDueId: 'tsume-1' }).kind).toBe('warmup');
  });
});
