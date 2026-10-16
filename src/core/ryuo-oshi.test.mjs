import { describe, expect, it } from 'vitest';
import {
  OSHI_STORAGE_KEY,
  characterCatchphrase,
  loadOshi,
  loadPrediction,
  oshiSeasonLine,
  oshiSeasonStatus,
  predictionChoices,
  predictionLine,
  predictionOutcome,
  saveOshi,
  savePrediction,
} from './ryuo-oshi.mjs';

const brief = (id, name) => ({ id, name });
/** 4人のランキング戦。1回戦2局と決勝。 */
const rankingView = ({ r1a = null, r1b = null, final = null } = {}) => ({
  title: '第3期竜王戦',
  phase: final ? 'main' : 'ranking',
  tables: [{
    key: 'ranking',
    title: '5組ランキング戦',
    rounds: [
      { round: 1, label: '1回戦', matches: [
        { id: 'n1', a: brief('user', 'あなた'), b: brief('p1', '山田'), winner: r1a, final: false },
        { id: 'n2', a: brief('p2', '佐藤'), b: brief('p3', '鈴木'), winner: r1b, final: false },
      ] },
      { round: 2, label: '決勝', matches: [
        { id: 'n3', a: r1a ? brief(r1a, r1a === 'user' ? 'あなた' : '山田') : null, b: r1b ? brief(r1b, r1b === 'p2' ? '佐藤' : '鈴木') : null, winner: final, final: true },
      ] },
    ],
  }],
  series: [],
  champion: null,
});

describe('竜王戦の応援', () => {
  it('棋士の個性を一言にし、「とても」の付く特徴を先に選ぶ', () => {
    expect(characterCatchphrase({ style: '攻め将棋', strengths: ['詰将棋がやや得意', '寄せがとても速い'], weaknesses: [] }))
      .toBe('攻め将棋・寄せがとても速い');
    expect(characterCatchphrase({ style: '受け将棋', strengths: [], weaknesses: ['受けがやや苦手'] })).toBe('受け将棋・受けがやや苦手');
    expect(characterCatchphrase({ style: 'バランス型', strengths: [], weaknesses: [] })).toBe('バランス型');
  });

  it('推しの棋士の勝ち負けを、表の進む順に数える', () => {
    expect(oshiSeasonStatus(rankingView(), 'p2')).toEqual({ games: [], wins: 0, losses: 0, alive: true, champion: false });
    expect(oshiSeasonLine(oshiSeasonStatus(rankingView(), 'p2'), '佐藤')).toContain('まだ対局前');
    const won = oshiSeasonStatus(rankingView({ r1a: 'user', r1b: 'p2' }), 'p2');
    expect(won).toMatchObject({ wins: 1, losses: 0, alive: true });
    expect(oshiSeasonLine(won, '佐藤')).toBe('推しの佐藤さん、5組ランキング戦 1回戦で鈴木さんに勝ったよ！（今期1勝0敗）');
    const lost = oshiSeasonStatus(rankingView({ r1a: 'user', r1b: 'p2', final: 'user' }), 'p2');
    expect(lost).toMatchObject({ wins: 1, losses: 1, alive: false });
    expect(oshiSeasonLine(lost, '佐藤')).toBe('推しの佐藤さんは、5組ランキング戦 決勝であなたに敗れて、今期はここまで…。また来期を応援しよう！');
    // 出ていない棋士はnullで、ほかの組で戦っていると伝える。
    expect(oshiSeasonStatus(rankingView(), 'p9')).toBeNull();
    expect(oshiSeasonLine(null, '田中')).toContain('ほかの組');
  });

  it('組優勝の予想は、プレイヤーの1局目が決まる前だけ、負けていない棋士から選べる', () => {
    const choices = predictionChoices(rankingView());
    expect(choices.map(({ name }) => name)).toEqual(['あなた', '山田', '佐藤', '鈴木']);
    // ほかの対局が先に進んでいても選べる。負けた棋士は選べない。
    expect(predictionChoices(rankingView({ r1b: 'p2' })).map(({ name }) => name)).toEqual(['あなた', '山田', '佐藤']);
    // プレイヤーの対局が決まったら、もう選べない。
    expect(predictionChoices(rankingView({ r1a: 'user' }))).toBeNull();
    const prediction = { season: '第3期竜王戦', pid: 'p2', name: '佐藤', counted: false };
    expect(predictionOutcome(rankingView({ r1a: 'user', r1b: 'p2' }), prediction)).toBeNull();
    expect(predictionOutcome(rankingView({ r1a: 'user', r1b: 'p2', final: 'p2' }), prediction)).toBe('hit');
    expect(predictionOutcome(rankingView({ r1a: 'user', r1b: 'p2', final: 'user' }), prediction)).toBe('miss');
    // 別の期の予想は使わない。
    expect(predictionOutcome(rankingView({ r1a: 'user', r1b: 'p2', final: 'p2' }), { ...prediction, season: '第2期竜王戦' })).toBeNull();
    expect(predictionLine(prediction, 'hit')).toContain('大当たり');
    expect(predictionLine({ ...prediction, pid: 'user' }, null)).toContain('あなた自身');
  });

  it('推しと予想を保存して読み直せる', () => {
    const data = new Map();
    const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: (k) => data.delete(k) };
    saveOshi(storage, 'p2');
    expect(loadOshi(storage)).toBe('p2');
    saveOshi(storage, '');
    expect(data.has(OSHI_STORAGE_KEY)).toBe(false);
    expect(loadOshi(null)).toBe('');
    savePrediction(storage, { season: '第3期竜王戦', pid: 'p2', name: '佐藤', counted: true });
    expect(loadPrediction(storage)).toEqual({ season: '第3期竜王戦', pid: 'p2', name: '佐藤', counted: true });
    expect(loadPrediction({ getItem: () => '{broken' })).toBeNull();
  });
});
