import { describe, expect, it } from 'vitest';
import { PEEK_EXPECTED_PLIES, peekBoards, peekScene, peekShownPlies, peekThought, peekVoice } from './team-peek.mjs';

const run = {
  id: 'r1', current: 'm3', format: 'school',
  players: {
    hanane: { id: 'hanane', name: '天鷺羽音', story: 'hanane', dan: '2年', rating: 1500, character: { attack: 0 } },
    momoka: { id: 'momoka', name: '桜乃百花', story: 'momoka', dan: '2年', rating: 1300, character: { attack: 0.5 } },
    s1: { id: 's1', name: '相手の主将', dan: '3年', rating: 1450, character: { attack: 0.7 } },
    s3: { id: 's3', name: '相手の三将', dan: '1年', rating: 1200, character: { attack: -0.7 } },
  },
  pending: {
    teamBoards: [
      { seat: 2, seatName: '三将', us: 'momoka', them: 's3', won: false, reveal: 80 },
      { seat: 0, seatName: '主将', us: 'hanane', them: 's1', won: true, reveal: 50 },
    ],
  },
};

describe('仲間の盤のチラ見(14章)', () => {
  it('高校の団体戦だけ、席の順に仲間の盤。決めてある勝ち負けを中継の局の設定にする', () => {
    const boards = peekBoards(run);
    expect(boards.map((board) => board.seatName)).toEqual(['主将', '三将']);
    const [hanane, momoka] = boards;
    expect(hanane.spec[hanane.usColor].name).toBe('天鷺羽音');
    expect(hanane.spec.winner).toBe(hanane.usColor);
    expect(momoka.spec.winner).not.toBe(momoka.usColor);
    expect(hanane.spec.key).not.toBe(momoka.spec.key);
    // 種から毎回同じ。
    expect(peekBoards(run)).toEqual(boards);
    expect(peekBoards({ ...run, format: 'pro' })).toEqual([]);
    expect(peekBoards({ ...run, pending: null })).toEqual([]);
  });

  it('自分の手数に合わせて進み、速報の手数までは終局を見せない', () => {
    expect(peekShownPlies({ userPly: 0, reveal: 50, generated: 30 })).toBe(0);
    expect(peekShownPlies({ userPly: 25, reveal: 50, generated: 100 })).toBe(Math.floor(PEEK_EXPECTED_PLIES / 2));
    // 作れたところまで。
    expect(peekShownPlies({ userPly: 25, reveal: 50, generated: 10 })).toBe(10);
    // 終局の手数が分かっても、速報の前は最後の手を見せない。
    expect(peekShownPlies({ userPly: 49, reveal: 50, generated: 90, finalPlies: 90 })).toBeLessThan(90);
    expect(peekShownPlies({ userPly: 50, reveal: 50, generated: 90, finalPlies: 90 })).toBe(90);
  });

  it('心の声は、形勢と変わり方で場面を選び、羽音は敬語と「！」なし・百花は名前に「さん」', () => {
    expect(peekScene({ ply: 4, rate: 0.5 })).toBe('start');
    expect(peekScene({ ply: 40, rate: 0.8 })).toBe('ahead');
    expect(peekScene({ ply: 40, rate: 0.2 })).toBe('behind');
    expect(peekScene({ ply: 40, rate: 0.6, before: 0.4 })).toBe('chance');
    expect(peekScene({ ply: 40, rate: 0.4, before: 0.6 })).toBe('regret');
    expect(peekScene({ ply: 90, rate: 0.9, done: true, won: true })).toBe('win');
    expect(peekVoice(run.players.hanane)).toBe('hanane');
    expect(peekVoice(run.players.momoka)).toBe('momoka');
    expect(peekVoice(run.players.s1)).toBe('attack');
    expect(peekVoice(run.players.s3)).toBe('defense');
    for (const scene of ['start', 'think', 'ahead', 'behind', 'chance', 'regret', 'win', 'loss']) {
      for (let ply = 0; ply < 48; ply += 12) {
        const line = peekThought('hanane', scene, { ply, playerName: 'やこび' });
        expect(line).not.toMatch(/[！!]|です|ます|やこび/);
      }
    }
    expect(peekThought('momoka', 'win', { ply: 0, playerName: 'やこび' })).toContain('やこびさん');
    expect(peekThought('momoka', 'loss', { ply: 0, playerName: '' })).toContain('あなた');
    expect(peekThought('momoka', 'loss', { ply: 0, playerName: '' })).not.toContain('あなたさん');
  });
});
