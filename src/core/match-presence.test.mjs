import { describe, expect, it } from 'vitest';
import {
  NEWS_EVERY_PLIES,
  midgameMoment,
  newsDue,
  opponentLine,
  opponentMood,
  opponentVoice,
  roundNews,
  traitCard,
} from './match-presence.mjs';
import { USER_ID, createSeason } from './ryuo.mjs';
import { createLeague, createMeijinSeason } from './meijin.mjs';
import { createRoster } from './ryuo-roster.mjs';
import { HANANE } from './ryuo-story.mjs';

const cp = (value) => ({ type: 'cp', value });

describe('相手の表情と一言', () => {
  it('表情はプレイヤーから見た形勢の逆', () => {
    expect(opponentMood(cp(600))).toBe('troubled');
    expect(opponentMood(cp(-600))).toBe('confident');
    expect(opponentMood(cp(100))).toBe('even');
    expect(opponentMood(null)).toBe('even');
    expect(opponentMood({ type: 'mate', value: -3 })).toBe('confident');
  });
  it('口調は棋風と物語の人物で変える', () => {
    expect(opponentVoice({ character: { attack: 0.7 } })).toBe('attack');
    expect(opponentVoice({ character: { attack: -0.4 } })).toBe('defense');
    expect(opponentVoice({ character: { attack: 0 } })).toBe('balance');
    expect(opponentVoice({ story: HANANE, character: { attack: 0.7 } })).toBe('hanane');
    expect(opponentLine('start', { character: { attack: 0.7 } })).toBe('よろしくお願いします。今日も攻めますよ');
    expect(opponentLine('loss', { story: HANANE })).toBe('……私の負け');
    // 羽音は敬語を使わない。
    for (const moment of ['start', 'ahead', 'behind', 'win', 'loss']) expect(opponentLine(moment, { story: HANANE })).not.toMatch(/です|ます|ました|ません|ございます|お願い/);
  });
  it('途中の一言は、形勢が傾いた最初だけ、合わせて2回まで', () => {
    expect(midgameMoment(cp(-600), [])).toBe('ahead');
    expect(midgameMoment(cp(-600), ['ahead'])).toBeNull();
    expect(midgameMoment(cp(600), ['ahead'])).toBe('behind');
    expect(midgameMoment(cp(600), ['ahead', 'behind'])).toBeNull();
    expect(midgameMoment(cp(100), [])).toBeNull();
  });
});

describe('特殊能力の札', () => {
  const character = { attack: 0, traits: [{ id: 'comeback' }, { id: 'endgame-collapse', degree: 1 }, { id: 'tsume', degree: 2 }] };
  it('結果の画面と同じ決まりで、出た瞬間の札を作る', () => {
    expect(traitCard({ kind: 'style', traits: ['comeback'] }, { character, name: '中村' }))
      .toEqual({ id: 'comeback', tier: 'gold', text: '中村さんの『逆転の名手』！', coach: '' });
    expect(traitCard({ kind: 'mate', traits: ['tsume'] }, { character })).toMatchObject({ tier: 'blue', text: '詰将棋がとても得意！' });
    expect(traitCard({ kind: 'oversight', traits: ['endgame-collapse'] }, { character }))
      .toMatchObject({ tier: 'red', text: '頓死の癖が出た！', coach: 'チャンスだよ！ 相手の玉に詰みがないか探そう！' });
  });
  it('出ていない・出した・持っていない特殊能力は札にしない', () => {
    expect(traitCard({ kind: 'style', traits: ['tsume'] }, { character })).toBeNull();
    expect(traitCard({ kind: 'style', traits: ['comeback'] }, { character, shown: ['comeback'] })).toBeNull();
    expect(traitCard({ kind: 'style', traits: ['fast-attack'] }, { character })).toBeNull();
  });
});

describe('ほかの対局の速報', () => {
  const settings = { difficulty: 9, scale: 3, revival: true };
  it('竜王戦: 同じ回戦の決まった試合から、推し・次に当たる人を先に並べる', () => {
    const season = createSeason({ no: 1, mode: 'challenge', group: 6, settings, userLevel: 28, seed: 21 });
    const plain = roundNews({ event: 'ryuo', season });
    expect(plain.length).toBeGreaterThan(0);
    for (const item of plain) expect(item.text).toMatch(/^速報：/);
    // 推しにした棋士の試合は、いちばん先に出る。
    const winnerId = plain.at(-1).key.split('-')[1];
    const withOshi = roundNews({ event: 'ryuo', season, oshiId: winnerId });
    expect(withOshi[0]).toMatchObject({ tone: 'oshi', text: `速報：推しの${season.players[winnerId].name}さん、勝ち！` });
    // プレイヤーは速報に出ない。
    for (const item of withOshi) expect(item.key).not.toContain(USER_ID);
  });
  it('名人戦: 同じ回戦の、先に決めた対局から作る', () => {
    const roster = createRoster({ seed: 3 });
    const season = createMeijinSeason({ no: 1, league: createLeague(roster), roster, settings: { difficulty: 9, scale: 'full', coachLevel: 'detailed', hintLimit: 3, undoLimit: 3 }, userLevel: 12, seed: 7 });
    const news = roundNews({ event: 'meijin', season });
    expect(news.length).toBe(Math.min(4, season.pending.others.games.length));
    expect(news.some(({ tone }) => tone === 'next') || news.length === 4).toBe(true);
  });
  it('20手ごとに1件ずつ出す', () => {
    const news = [{ key: 'a' }, { key: 'b' }];
    expect(newsDue(news, NEWS_EVERY_PLIES - 1, 0)).toBeNull();
    expect(newsDue(news, NEWS_EVERY_PLIES, 0)?.key).toBe('a');
    expect(newsDue(news, NEWS_EVERY_PLIES + 5, 1)).toBeNull();
    expect(newsDue(news, NEWS_EVERY_PLIES * 3, 1)?.key).toBe('b');
    expect(newsDue(news, NEWS_EVERY_PLIES * 5, 2)).toBeNull();
  });
});

describe('中継(勝率と控室)', () => {
  it('プレイヤーの勝率は評価値から(0点は50%)', async () => {
    const { playerWinRate, formatWinRate } = await import('./match-presence.mjs');
    expect(playerWinRate(cp(0))).toBeCloseTo(0.5);
    expect(playerWinRate(cp(600))).toBeGreaterThan(0.7);
    expect(playerWinRate({ type: 'mate', value: 3 })).toBe(1);
    expect(playerWinRate(null)).toBeNull();
    expect(formatWinRate(0.623)).toBe('62%');
  });
  it('控室は、始め・形勢の動き・終盤・中盤を、それぞれ1回だけ言う', async () => {
    const { roomComment } = await import('./match-presence.mjs');
    expect(roomComment({ ply: 0, winRate: 0.5, weight: 'big' })?.key).toBe('room-opening');
    expect(roomComment({ ply: 0, winRate: 0.5, weight: 'plain' })).toBeNull();
    expect(roomComment({ ply: 20, winRate: 0.35, previousWinRate: 0.5, lastMoveText: '△4五歩' }))
      .toEqual({ key: 'room-sharp', text: '控室：今の△4五歩は鋭い一手と話題に' });
    expect(roomComment({ ply: 20, winRate: 0.65, previousWinRate: 0.5, lastMoverIsPlayer: true })?.text).toBe('控室：今の一手で、控室がどよめいています！');
    expect(roomComment({ ply: 85, winRate: 0.62, previousWinRate: 0.6 })?.text).toBe('控室：いよいよ終盤戦。勝率はあなた62%です');
    expect(roomComment({ ply: 31, winRate: 0.5, previousWinRate: 0.5 })?.key).toBe('room-middle');
    expect(roomComment({ ply: 31, winRate: 0.5, previousWinRate: 0.5, said: ['room-middle'] })).toBeNull();
    expect(roomComment({ ply: 50, winRate: 0.5, said: ['a', 'b', 'c', 'd', 'e'] })).toBeNull();
    expect(roomComment({ ply: 20, winRate: 0.5, previousWinRate: 0.48 })).toBeNull();
  });
});

describe('終局の判子', () => {
  it('節目は期の画面と同じ言葉、ふつうの勝ちは小さな「勝ち」、負けは押さない', async () => {
    const { finishStamp } = await import('./match-presence.mjs');
    expect(finishStamp({ win: true, milestone: { seal: '竜王', title: '竜王になった！', weight: 'max' } }))
      .toEqual({ seal: '竜王', title: '竜王になった！', size: 'big', confetti: true });
    expect(finishStamp({ win: true, milestone: { seal: '優勝', title: '6組優勝！', weight: 'big' } })?.size).toBe('mid');
    expect(finishStamp({ win: true })).toEqual({ seal: '勝ち', title: '', size: 'small', confetti: false });
    expect(finishStamp({ win: true, weight: 'title' })?.size).toBe('big');
    expect(finishStamp({ win: true, event: 'meijin', crowned: true })).toMatchObject({ seal: '名人', confetti: true });
    expect(finishStamp({ win: false, milestone: { seal: '優勝', title: '', weight: 'big' } })).toBeNull();
    // 格上に勝ったときは、それを一言で伝える(節目の判子が先)。
    expect(finishStamp({ win: true, upset: true })).toEqual({ seal: '勝ち', title: '格上に勝った！', size: 'mid', confetti: false });
    expect(finishStamp({ win: true, upset: true, milestone: { seal: '優勝', title: '6組優勝！', weight: 'big' } })?.title).toBe('6組優勝！');
    // 長い寄せで勝ったら判子を1段大きく、15手以上は紙吹雪も(docs/mate-finish-design.md)。短い寄せは変えない。
    expect(finishStamp({ win: true, mateTier: 'mid' })).toEqual({ seal: '勝ち', title: '', size: 'small', confetti: false });
    expect(finishStamp({ win: true, mateTier: 'long' })).toMatchObject({ size: 'mid', confetti: false });
    expect(finishStamp({ win: true, mateTier: 'legend', weight: 'big' })).toMatchObject({ size: 'big', confetti: true });
    expect(finishStamp({ win: true, mateTier: 'long', weight: 'title' })?.size).toBe('big');
  });
});
