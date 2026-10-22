import { describe, expect, it } from 'vitest';
import { counterKey, counterStyle, loadCounterKey, ryuoNextPlan, ryuoNextSeasonPlan, saveCounterKey } from './ryuo-next.mjs';
import { normalReason } from './play-coach.mjs';

const opponent = (extra = {}) => ({
  id: 'r1', name: '杉山颯太', dan: '奨励会三段', level: 20, story: null,
  repertoire: { usage: { black: { yagura: 30, aigakari: 70 }, white: { yagura: 60, 'shiken-bisha': 40 }, castles: { yagura: { yagura: 7, 'doi-yagura': 3 } } } },
  ...extra,
});
const pending = (extra = {}) => ({
  kind: 'game', opponentId: 'r1', label: '6組ランキング戦 準々決勝', color: 'black',
  opponent: opponent(), stakes: { win: '準決勝へ', lose: '竜王戦はここまで', boss: false }, ...extra,
});

describe('竜王戦のつぎはこれ(docs/home-next-adaptive-design.mdの13章)', () => {
  it('期の途中でなければ出さない', () => {
    expect(ryuoNextPlan({ pending: null, seasonId: 's1', gamesPlayed: 0 })).toBeNull();
  });

  it('ふだんの一局は続きが主役で、対策は小さな入口', () => {
    const plan = ryuoNextPlan({ pending: pending(), seasonId: 's1', gamesPlayed: 0 });
    expect(plan.main).toBe('continue');
    expect(plan.continue.title).toBe('竜王戦 準々決勝');
    expect(plan.continue.reason).toBe('杉山颯太 奨励会三段と。勝てば準決勝へ');
    expect(plan.counter.sub).toBe('杉山颯太さんの対策をする');
    expect(plan.key).toBe('s1:r1:6組ランキング戦 準々決勝');
  });

  it('対策の相手は、相手の手番でいちばん多い戦法と、その中でいちばん多い囲い。本番と同じ手番で', () => {
    // プレイヤーが先手なら、相手は後手の使用率(矢倉60%)。
    const plan = ryuoNextPlan({ pending: pending(), seasonId: 's1', gamesPlayed: 0 });
    expect(plan.style.opening).toBe('yagura');
    expect(plan.style.castle).toBe('yagura');
    expect(plan.counter.reason).toBe('得意の矢倉（60%）を、本番と同じ先手で試そう。記録には残らないよ');
    // 後手なら、相手は先手の使用率(相掛かり70%)。
    expect(counterStyle(opponent(), 'white').label).toBe('相掛かり');
    expect(counterStyle(opponent(), 'white').share).toBe(70);
    // 使用率がなければ、得意戦法。
    expect(counterStyle({ style: { label: '四間飛車' } }, 'black').label).toBe('四間飛車');
  });

  it('山場の一局と、番勝負で前の局を落としたときは、対策が主役', () => {
    const boss = ryuoNextPlan({ pending: pending({ stakes: { win: '6組優勝・昇級！', boss: true } }), seasonId: 's1', gamesPlayed: 3 });
    expect(boss.main).toBe('counter');
    expect(boss.counter.title).toBe('杉山颯太対策');
    expect(boss.continue.sub).toBe('続きを指す（準々決勝）');
    expect(boss.continue.reason).toBe('山場の一局！ 勝てば6組優勝・昇級！');
    const series = pending({ kind: 'finals', label: '竜王戦七番勝負 第3局', gameNo: 3, need: 4, wins: { user: 1, opponent: 1 }, stakes: { win: '竜王まであと2勝', boss: true } });
    const lost = ryuoNextPlan({ pending: { ...series, stakes: { win: '竜王まであと2勝', boss: false } }, seasonId: 's1', gamesPlayed: 9, lastGame: { win: false, opponentId: 'r1' } });
    expect(lost.main).toBe('counter');
    expect(lost.continue.title).toBe('竜王戦七番勝負 第3局');
    expect(lost.continue.sub).toBe('続きを指す（第3局）');
    expect(lost.continue.reason).toBe('前の局は落としたけど、まだ3勝あるよ。杉山颯太さんへ');
  });

  it('対策のあとは、続きが主役で「対策はばっちり」。小さな入口は「もう一度対策する」', () => {
    const plan = ryuoNextPlan({ pending: pending({ stakes: { win: '準決勝へ', boss: true } }), seasonId: 's1', gamesPlayed: 0, counterDone: true });
    expect(plan.main).toBe('continue');
    expect(plan.continue.reason).toBe('対策はばっちり。本番の杉山颯太さんへ。勝てば準決勝へ');
    expect(plan.counter.sub).toBe('もう一度対策する');
  });

  it('羽音との一局は、ライバルの1行', () => {
    const plan = ryuoNextPlan({ pending: pending({ opponent: opponent({ name: '天鷺羽音', story: 'hanane' }) }), seasonId: 's1', gamesPlayed: 0 });
    expect(plan.continue.reason).toBe('ライバル・天鷺羽音との一局。勝てば準決勝へ');
  });

  it('続きの1行は、期の中の対局の数で替わり、同じ数なら同じ', () => {
    const reasons = [0, 1, 2, 3].map((gamesPlayed) => ryuoNextPlan({ pending: pending(), seasonId: 's1', gamesPlayed, lastGame: { win: true, opponentId: 'r0' } }).continue.reason);
    expect(new Set(reasons).size).toBe(3);
    expect(reasons[0]).toBe(reasons[3]);
    expect(reasons[1]).toBe('前の局は勝ち！ この勢いで杉山颯太さんへ');
  });

  it('次の一局の印は、期と相手と対局の名前で決まり、保存できる', () => {
    expect(counterKey('s1', null)).toBe('');
    const store = new Map();
    const storage = { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) };
    expect(loadCounterKey(storage)).toBe('');
    saveCounterKey(storage, 's1:r1:x');
    expect(loadCounterKey(storage)).toBe('s1:r1:x');
  });

  it('次の期へは、期が終わっていて、直前のレーティングの対局が竜王戦のときだけ', () => {
    expect(ryuoNextSeasonPlan({ inSeason: true, lastRatedEvent: 'ryuo', seasons: 2, group: 5 })).toBeNull();
    expect(ryuoNextSeasonPlan({ inSeason: false, lastRatedEvent: 'free', seasons: 2, group: 5 })).toBeNull();
    expect(ryuoNextSeasonPlan({ inSeason: false, lastRatedEvent: 'ryuo', seasons: 2, group: 5 })).toEqual({ title: '第3期 竜王戦へ', reason: '5組から、竜王をめざそう' });
    expect(ryuoNextSeasonPlan({ inSeason: false, lastRatedEvent: 'ryuo', seasons: 4, group: 1, ryuo: true }).reason).toBe('竜王として、防衛戦に挑もう');
  });
});

describe('「対局する」の1行の言い換え(13-4)', () => {
  const games = [{ opponentLevel: 14, outcome: 'win' }];
  it('対局の数で候補が替わる', () => {
    const state = (n) => ({ games: n, rating: 1150, levels: { 15: { wins: 3, losses: 2, draws: 0 } } });
    const reasons = [0, 1, 2, 3].map((n) => normalReason(state(n), games, 15));
    expect(reasons[0]).toBe('Lv.15 ' + reasons[0].slice(6, reasons[0].indexOf('の相手と。')) + 'の相手と。ここ1局は1勝0敗、いい調子');
    expect(reasons[1]).toBe('前の対局はLv.14に勝ち。次はLv.15で');
    expect(reasons[2]).toBe('Lv.15とは通算3勝2敗。勝ち越しを伸ばそう');
    expect(reasons[3]).toMatch(/まであとR\d+。Lv\.15で一歩ずつ$/);
  });
  it('初めてのLvと、まだ勝ちのないLv', () => {
    expect(normalReason({ games: 2, rating: 1150, levels: {} }, games, 15)).toBe('Lv.15とは初めての対局。どんな相手かな');
    expect(normalReason({ games: 2, rating: 1150, levels: { 15: { wins: 0, losses: 3, draws: 0 } } }, games, 15)).toBe('Lv.15とは3局指して、まだ勝ちなし。まずは1勝');
  });
  it('対局がなければ、すぐ始める1行', () => {
    expect(normalReason({ games: 0 }, [], 3)).toMatch(/振り駒ですぐ始めるよ$/);
  });
});
