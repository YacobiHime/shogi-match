import { describe, expect, it } from 'vitest';
import { applyRatedGame, createRatingState, recommendedLevel } from './player-rating.mjs';
import {
  CONTENT_SPREAD, MATE_THREE_LESSON, PRACTICE_CHAPTERS, TARGET_MARGIN, blendedStrength, detectHabits, goodContentLine, recentPerformance,
  recommendPlay, resultNextStep, resultStrength, tournamentInvite, unbeatenCap,
} from './play-coach.mjs';
import { TUTORIAL_LESSONS, TUTORIAL_VOLUMES } from './tutorial-curriculum.mjs';
import { completePlayInsight, createPlayInsight, recordPractice } from './play-insight.mjs';
import { reviewProblemId } from './review-problems.mjs';

/** レーティングRで、すでにgames局指した人から、結果を順に足す。 */
function play(rating, games, results) {
  let state = { ...createRatingState(), rating, games };
  for (const [level, outcome] of results) state = applyRatedGame(state, { opponentLevel: level, outcome }).state;
  return state;
}

describe('勝ち越せる相手(基準のLv)', () => {
  it('勝率6割の見込みで、レーティングのLvより約1つ下を勧める', () => {
    expect(TARGET_MARGIN).toBe(70);
    const state = { ...createRatingState(), rating: 870, games: 3 };
    expect(recommendedLevel(870)).toBe(15);
    expect(recommendPlay(state)).toMatchObject({ level: 14, kind: 'normal', title: '対局する' });
  });

  it('記録がない人にも勧める(はじめての対局は15級のLv1。Lv0は練習相手で勧めない)', () => {
    const plan = recommendPlay(createRatingState());
    expect(plan.level).toBe(1);
    expect(plan.reason).toContain('Lv.1');
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

  it('直前に指したLvから、1回で2つより大きく動かさない。Lv1〜40に収める', () => {
    const state = play(2000, 12, [[5, 'draw']]);
    const plan = recommendPlay(state);
    expect(plan.level).toBeLessThanOrEqual(7);
    expect(recommendPlay(play(0, 12, [[0, 'loss'], [0, 'loss'], [0, 'loss']])).level).toBe(1);
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

  it('弱点の練習。詰みを逃したら、教室の章(腕だめしが未クリアなら) → 詰将棋の5問 → その局面の問題', () => {
    const state = { ...createRatingState(), rating: 1200, games: 20, history: [] };
    const insight = insightOf([summary({ mates: [{ sfen: 'mate sfen', length: 1 }] })]);
    const id = reviewProblemId('mate sfen');
    expect(recommendPlay(state, { insight, problemIds: new Set([id]) })).toMatchObject({
      kind: 'practice', title: '教室 第2巻3章：玉をつかまえよう',
      reason: '前の対局で、1手で詰む局面を見逃したよ。詰みが見えると、竜王戦の終盤で勝ちきれる',
      practice: { kind: 'mate', via: 'tutorial', chapterId: 'v2-c3' },
    });
    const cleared = { 'v2-c3-boss': { status: 'cleared' } };
    expect(recommendPlay(state, { insight, problemIds: new Set([id]), tutorialLessons: cleared })).toMatchObject({
      title: '1手詰めを5問', practice: { kind: 'mate', via: 'problems', drill: { section: 'tsume', kind: 'tsume', plies: 1, firstProblemId: id } },
    });
    // 前にこの弱点で問題集へ行ったなら、その局面の問題(今までの練習)。
    // (同じ弱点は続けて出さないので、あいだに別の練習をはさむ)
    const after = recordPractice(recordPractice(insight, { kind: 'mate', games: 8, via: 'problems' }), { kind: 'free', games: 10, via: 'tutorial' });
    expect(recommendPlay(state, { insight: after, problemIds: new Set([id]), tutorialLessons: cleared })).toMatchObject({
      title: '詰みを解き直そう', reason: '詰みを逃した局面があったね。解き直そう', practice: { kind: 'mate', via: 'play', problemId: id },
    });
    // その局面の問題がなければ、問題集を続ける。
    expect(recommendPlay(state, { insight: after, problemIds: new Set(), tutorialLessons: cleared }).practice).toMatchObject({ via: 'problems' });
    const free = insightOf([summary({ freeLosses: 2 })]);
    expect(recommendPlay(state, { insight: free })).toMatchObject({ kind: 'practice', practice: { kind: 'free', via: 'tutorial', chapterId: 'v2-c1' }, title: '教室 第2巻1章：三手先まで考えよう' });
  });

  it('逃した詰みの手数で、教室の始めるレッスンと詰将棋の手数を変える(7手詰めは問題集の側で)', () => {
    const state = { ...createRatingState(), rating: 1200, games: 20, history: [] };
    const missed = (length) => insightOf([summary({ mates: [{ sfen: `mate ${length}`, length }] })]);
    expect(recommendPlay(state, { insight: missed(3) }).practice).toMatchObject({ via: 'tutorial', chapterId: 'v2-c3', fromLessonId: MATE_THREE_LESSON });
    const cleared = { 'v2-c3-boss': { status: 'cleared' } };
    expect(recommendPlay(state, { insight: missed(3), tutorialLessons: cleared })).toMatchObject({ title: '3手詰めを5問', practice: { drill: { plies: 3 } } });
    // 5手以上は教室の章がなく、5手詰め。スキップした腕だめしは、クリアしていないのと同じ。
    expect(recommendPlay(state, { insight: missed(7), tutorialLessons: { 'v2-c3-boss': { status: 'skipped' } } })).toMatchObject({ title: '5手詰めを5問', practice: { drill: { plies: 5 } } });
  });

  it('序盤は第3巻1章 → 第4巻(自分の戦法で章を選ぶ) → 作戦カード。終盤は第3巻3章 → 第5巻2章 → 実戦詰将棋と終盤戦を交互に', () => {
    const opening = insightOf([{ ...summary({ loss: 30 }), phases: { opening: { n: 10, sum: 1000, big: 1 }, middle: { n: 10, sum: 100, big: 0 }, ending: { n: 10, sum: 100, big: 0 } }, standing30: -500 }]);
    const state = { ...createRatingState(), rating: 1200, games: 20, history: [] };
    expect(recommendPlay(state, { insight: opening }).practice).toMatchObject({ kind: 'opening', chapterId: 'v3-c1' });
    const v3 = { 'v3-c1-boss': { status: 'cleared' } };
    expect(recommendPlay(state, { insight: opening, tutorialLessons: v3 }).practice).toMatchObject({ chapterId: 'v4-c2' });
    const ranging = { ...state, usage: { rook: { 四間飛車: { wins: 3, losses: 1, draws: 0 }, 居飛車: { wins: 1, losses: 0, draws: 0 } } } };
    expect(recommendPlay(ranging, { insight: opening, tutorialLessons: v3 })).toMatchObject({ title: '教室 第4巻1章：振り飛車にチャレンジ' });
    const v4 = { ...v3, 'v4-c2-boss': { status: 'cleared' } };
    expect(recommendPlay(state, { insight: opening, tutorialLessons: v4 })).toMatchObject({ title: '作戦カードで組み方を練習', practice: { kind: 'opening', via: 'play' } });

    const ending = insightOf([{ ...summary(), phases: { opening: { n: 10, sum: 100, big: 0 }, middle: { n: 10, sum: 100, big: 0 }, ending: { n: 10, sum: 1200, big: 1 } } }]);
    expect(recommendPlay(state, { insight: ending }).practice).toMatchObject({ kind: 'ending', chapterId: 'v3-c3' });
    const v3c3 = { 'v3-c3-boss': { status: 'cleared' } };
    expect(recommendPlay(state, { insight: ending, tutorialLessons: v3c3 })).toMatchObject({ title: '教室 第5巻2章：序盤・中盤・終盤の作戦' });
    const both = { ...v3c3, 'v5-plan-boss': { status: 'cleared' } };
    expect(recommendPlay(state, { insight: ending, tutorialLessons: both })).toMatchObject({
      title: '実戦詰将棋を5問', practice: { via: 'problems', drill: { section: 'tsume', kind: 'jissen', plies: null } },
    });
    const next = recordPractice(recordPractice(ending, { kind: 'ending', games: 8, via: 'problems' }), { kind: 'mate', games: 10, via: 'tutorial' });
    expect(recommendPlay(state, { insight: next, tutorialLessons: both })).toMatchObject({ title: '自分の対局の終盤から', practice: { via: 'play' } });
  });

  it('教室の章のIDと名前は、教室のカリキュラムと同じ', () => {
    for (const [chapterId, chapter] of Object.entries(PRACTICE_CHAPTERS)) {
      const volume = TUTORIAL_VOLUMES.find(({ chapters }) => chapters.some(({ id }) => id === chapterId));
      const index = volume.chapters.findIndex(({ id }) => id === chapterId);
      expect(volume.chapters[index].title, chapterId).toBe(chapter.title);
      expect(chapter.label, chapterId).toBe(`第${TUTORIAL_VOLUMES.indexOf(volume) + 1}巻${index + 1}章`);
      expect(volume.chapters[index].lessons.some(({ id, boss }) => id === chapter.boss && boss), chapterId).toBe(true);
    }
    expect(TUTORIAL_LESSONS.find(({ id }) => id === MATE_THREE_LESSON)?.chapterId).toBe('v2-c3');
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

describe('段階2(14章): 戦型の癖と、良い内容の続き', () => {
  const tally = (wins, losses) => ({ wins, losses, draws: 0 });
  /** 戦型の成績つきの記録。vsRangingは対振り飛車、ownRangingは自分が振り飛車を指した対局、castlesは戦型を記録した対局。 */
  function withUsage({ wins, losses, vsRanging = tally(0, 0), ownRanging = 0, castles = 0, games = wins + losses }) {
    return {
      ...createRatingState(), rating: 1200, games, wins, losses,
      usage: {
        opponentRook: { 四間飛車: vsRanging },
        rook: ownRanging ? { 中飛車: tally(ownRanging, 0) } : {},
        castle: castles ? { 美濃囲い: tally(castles, 0) } : {},
      },
    };
  }

  it('対振り飛車だけ負け越していれば、振り飛車党と対局', () => {
    // 対振り飛車 1勝5敗(17%)、対居飛車 6勝2敗(75%)
    const habits = detectHabits(withUsage({ wins: 7, losses: 7, vsRanging: tally(1, 5) }));
    expect(habits[0]).toEqual({
      kind: 'matchup', rook: 'ranging', title: '振り飛車党と対局', reason: '対振り飛車は1勝5敗。振り飛車を指す相手で慣れよう',
    });
  });

  it('対居飛車が苦手なら居飛車党。差が小さい・局数が少ないときは出さない', () => {
    expect(detectHabits(withUsage({ wins: 7, losses: 7, vsRanging: tally(5, 1) }))[0]).toMatchObject({ kind: 'matchup', rook: 'static' });
    expect(detectHabits(withUsage({ wins: 7, losses: 7, vsRanging: tally(3, 4) }))).toEqual([]);
    expect(detectHabits(withUsage({ wins: 4, losses: 4, vsRanging: tally(0, 4) }))).toEqual([]);
  });

  it('自分の戦法が9割以上どちらかなら、もう片方を試そう(戦型を記録した15局以上)', () => {
    expect(detectHabits(withUsage({ wins: 10, losses: 10, castles: 20, ownRanging: 1 }))[0]).toMatchObject({
      kind: 'widen', rook: 'ranging', title: '振り飛車を試そう', reason: 'これまでの20局は、ほとんど居飛車。作戦カードで振り飛車を指してみよう',
    });
    expect(detectHabits(withUsage({ wins: 10, losses: 10, castles: 20, ownRanging: 19 }))[0]).toMatchObject({ kind: 'widen', rook: 'static' });
    expect(detectHabits(withUsage({ wins: 10, losses: 10, castles: 20, ownRanging: 8 }))).toEqual([]);
    // 戦型の記録がなければ出さない(古い記録)。
    expect(detectHabits(withUsage({ wins: 10, losses: 10 }))).toEqual([]);
  });

  it('戦型の癖は、対局の中身の弱点より後。練習の決まり(2局に1回・同じ種類を続けない)も同じ', () => {
    const state = withUsage({ wins: 7, losses: 7, vsRanging: tally(1, 5) });
    expect(recommendPlay(state)).toMatchObject({ kind: 'practice', title: '振り飛車党と対局', practice: { kind: 'matchup', rook: 'ranging' } });
    const mated = recommendPlay(state, { insight: insightOf([summary({ freeLosses: 3 })]) });
    expect(mated.practice.kind).toBe('free');
    // 前の練習が苦手な戦型なら、続けて出さない。
    const after = recommendPlay({ ...state, games: 16 }, { insight: recordPractice(createPlayInsight(), { kind: 'matchup', games: 14 }) });
    expect(after.kind).not.toBe('practice');
  });

  it('前の局の内容が良ければ、その1行', () => {
    const plain = (loss, big = 0) => ({ summary: { ...summary({ loss }), big } });
    expect(goodContentLine([plain(40, 0)])).toBe('前の局は大きな悪手なし！ ');
    expect(goodContentLine([plain(60, 2), plain(60, 2), plain(40, 1)])).toBe('前の局は、いつもより損の少ない内容。');
    expect(goodContentLine([plain(60, 2), plain(55, 1)])).toBe('');
    expect(goodContentLine([])).toBe('');
  });
});

describe('15級(Lv1)の立て直し(2026-10-22の段級位の作り直し)', () => {
  it('Lv1に3連敗したら、Lv0で肩ならし(レーティングに数えない)と飛車落ち', () => {
    const state = play(30, 12, [[1, 'loss'], [1, 'loss'], [1, 'loss']]);
    expect(recommendPlay(state)).toMatchObject({
      level: 0, kind: 'warmup', handicapLevel: 1, handicapId: { id: 'rook', label: '飛車落ち' },
      reason: 'Lv.1に3連敗。Lv.0で肩ならししよう（レーティングには数えないよ）',
    });
    expect(recommendPlay(play(570, 12, [[10, 'loss'], [10, 'loss'], [10, 'loss']])).handicapId).toEqual({ id: 'lance', label: '香落ち' });
  });

  it('Lv0に勝ったら15級へ、飛車落ちで勝ったら平手へ', () => {
    expect(resultNextStep({ won: true, rated: false, level: 0, firstWin: false })).toMatchObject({ kind: 'up', level: 1, title: 'Lv.1に挑戦' });
    expect(resultNextStep({ won: true, rated: false, level: 1, handicapLabel: '飛車落ち', firstWin: false }))
      .toMatchObject({ kind: 'even', reason: '飛車落ちで勝ったね。次は平手で', sameTitle: '飛車落ちでもう一局' });
  });
});

describe('大会への誘い(docs/first-play-design.mdの6-2)', () => {
  const base = { ryuoEntered: false, ryuoSeasons: 0, meijinEntered: false, measured: false, ratedGames: 0, lastPractice: null };
  it('竜王戦: 出たことがなく、測定を終えたかレーティングの対局が3局以上', () => {
    expect(tournamentInvite(base)).toBeNull();
    expect(tournamentInvite({ ...base, ratedGames: 2 })).toBeNull();
    expect(tournamentInvite({ ...base, ratedGames: 3 })).toMatchObject({ id: 'ryuo', title: '竜王戦に出よう' });
    expect(tournamentInvite({ ...base, measured: true, grade: '8級程度', difficulty: 3 })).toEqual({
      id: 'ryuo', title: '竜王戦に出よう', reason: 'あなたは8級くらい。難易度3の6組なら、勝ち上がれるよ',
    });
  });

  it('練習を勧めた直後(2局たつまで)は出さない', () => {
    expect(tournamentInvite({ ...base, ratedGames: 5, lastPractice: { games: 4 } })).toBeNull();
    expect(tournamentInvite({ ...base, ratedGames: 6, lastPractice: { games: 4 } })?.id).toBe('ryuo');
  });

  it('名人戦: 竜王戦の期を1つ終え、名人戦に出たことがない', () => {
    const entered = { ...base, ryuoEntered: true, ratedGames: 10 };
    expect(tournamentInvite(entered)).toBeNull();
    expect(tournamentInvite({ ...entered, ryuoSeasons: 1 })).toEqual({ id: 'meijin', title: '名人戦に出よう', reason: '順位戦のC級2組から、名人をめざそう' });
    expect(tournamentInvite({ ...entered, ryuoSeasons: 1, meijinEntered: true })).toBeNull();
  });
});
