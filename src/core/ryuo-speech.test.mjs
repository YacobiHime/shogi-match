import { describe, expect, it } from 'vitest';
import {
  entryCoachLine,
  entryDifficultyLine,
  entryRevivalLine,
  entryScaleLine,
  opponentLines,
  resultLines,
  ryuoGuideLines,
  seasonPhaseLines,
} from './ryuo-speech.mjs';
import { USER_ID, createSeason, describeSeason, recordUserGame } from './ryuo.mjs';

const settings = { difficulty: 7, scale: 2, revival: true };

describe('Yakobihime speech for the Ryuo screens', () => {
  it('explains the tournament in order, from the title match to the eternal title', () => {
    const lines = ryuoGuideLines();
    expect(lines.length).toBeGreaterThanOrEqual(5);
    expect(lines[0]).toContain('タイトル戦');
    expect(lines.join('')).toContain('ランキング戦');
    expect(lines.join('')).toContain('敗者復活戦');
    expect(lines.join('')).toContain('決勝トーナメント');
    expect(lines.join('')).toContain('三番勝負');
    expect(lines.join('')).toContain('七番勝負');
    expect(lines.join('')).toContain('永世竜王');
    expect(lines.join('')).toContain('架空');
  });

  it('comments on the entry settings', () => {
    const base = { group: 6, meanLevel: 22.4, recommended: 3, ratingText: 'R800' };
    expect(entryDifficultyLine({ ...base, difficulty: 3 })).toContain('ぴったり');
    expect(entryDifficultyLine({ ...base, difficulty: 3 })).toContain('Lv.22');
    expect(entryDifficultyLine({ ...base, difficulty: 1 })).toContain('優しめ');
    expect(entryDifficultyLine({ ...base, difficulty: 8 })).toContain('手ごわい');
    expect(entryScaleLine('中', '6組は32名。')).toBe('規模は「中」。6組は32名。');
    expect(entryRevivalLine(true)).toContain('もう一度チャンス');
    expect(entryRevivalLine(false)).toContain('一発勝負');
    expect(entryCoachLine({ coachLevel: 'off', hintLimit: 0, undoLimit: -1 })).toContain('閃きはなし、待ったは無制限');
    expect(entryCoachLine({ coachLevel: 'detailed', hintLimit: 3, undoLimit: 5 })).toContain('閃きは3回、待ったは5回');
  });

  it('says something for every phase of a real season and counts the remaining wins in a series', () => {
    let season = createSeason({ no: 1, mode: 'challenge', group: 6, settings, userLevel: 28, seed: 8 });
    const seen = new Set();
    while (season.phase !== 'done') {
      const view = describeSeason(season);
      const lines = seasonPhaseLines(view);
      expect(lines.length, season.phase).toBeGreaterThan(0);
      seen.add(season.phase);
      if (season.phase === 'finals') {
        // 七番勝負は、勝つたびに、残りの勝ち数が減る。
        const remaining = 4 - view.pending.wins.user;
        expect(lines[0]).toContain(`あと${remaining}勝`);
        expect(opponentLines(view.pending.opponent, 28, view.pending).join('')).toContain(`第${view.pending.gameNo}局`);
      }
      season = recordUserGame(season, 'win');
    }
    expect([...seen]).toEqual(expect.arrayContaining(['ranking', 'main', 'playoff', 'finals']));
    expect(seasonPhaseLines(null)).toEqual([]);
  });

  it('speaks differently in a defense match and when one loss from the end', () => {
    const season = createSeason({ no: 2, mode: 'defense', group: 1, settings, userLevel: 30, seed: 5, career: { titles: 1 } });
    let view = describeSeason(season);
    expect(seasonPhaseLines(view)[0]).toContain('防衛');
    let current = season;
    for (let game = 0; game < 3; game += 1) current = recordUserGame(current, 'loss');
    view = describeSeason(current);
    expect(seasonPhaseLines(view)[0]).toContain('負けられない');
    expect(current.pending.wins.opponent).toBe(3);
  });

  it('describes the next opponent by name, favorite style and strength gap', () => {
    const opponent = { name: '青木賢治', dan: '五段', level: 30, style: { label: '四間飛車（美濃）', rook: 'ranging' } };
    const tough = opponentLines({ ...opponent, level: 36 }, 28, { kind: 'game' });
    expect(tough[0]).toContain('青木賢治五段');
    expect(tough[0]).toContain('四間飛車（美濃）');
    expect(tough.join('')).toContain('強敵');
    expect(tough.join('')).toContain('対振り飛車');
    expect(opponentLines({ ...opponent, level: 31 }, 28, { kind: 'game' }).join('')).toContain('手ごわい');
    expect(opponentLines({ ...opponent, level: 20 }, 28, { kind: 'game' }).join('')).toContain('油断は禁物');
    expect(opponentLines({ ...opponent, level: 28 }, 28, { kind: 'game' }).join('')).toContain('いい勝負');
    expect(opponentLines({ ...opponent, style: { label: '矢倉', rook: 'static' } }, 28, { kind: 'game' }).join('')).toContain('居飛車の相手');
    expect(opponentLines(null, 28, null)).toEqual([]);
    expect(USER_ID).toBe('user');
  });

  it('reacts to every kind of result, with promotion and relegation', () => {
    const base = { startGroup: 6, newGroup: 6, promoted: false, relegated: false, challenger: false, exitLabel: '', standing: null };
    expect(resultLines({ ...base, outcome: 'champion', challenger: true, newGroup: 1 }).join('')).toContain('竜王だよ');
    expect(resultLines({ ...base, outcome: 'defense-lost', newGroup: 1 }).join('')).toContain('防衛、できなかった');
    expect(resultLines({ ...base, outcome: 'finals-lost', challenger: true, newGroup: 1 }).join('')).toContain('惜しかった');
    expect(resultLines({ ...base, outcome: 'playoff-lost' }).join('')).toContain('あと一歩');
    expect(resultLines({ ...base, outcome: 'main-out' }).join('')).toContain('立派');
    const out = resultLines({ ...base, outcome: 'ranking-out', exitLabel: '6組ランキング戦 準決勝', standing: 3, promoted: true, newGroup: 5 });
    expect(out.join('')).toContain('6組ランキング戦 準決勝で敗退');
    expect(out.join('')).toContain('5組へ、昇級');
    expect(out.join('')).toContain('3位');
    expect(resultLines({ ...base, outcome: 'ranking-out', startGroup: 5, relegated: true, newGroup: 6 }).join('')).toContain('降級');
    expect(resultLines({ ...base, outcome: 'ranking-out' }).join('')).toContain('次の期も、6組');
    expect(resultLines(null)).toEqual([]);
  });
});
