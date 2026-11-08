import { describe, expect, it } from 'vitest';
import {
  SCOUTER_GROWTH, battlePower, powerText, rollingPower, scouterGrade, scoutReading,
} from './power-scouter.mjs';

describe('棋力スカウター', () => {
  it('Lvが上がるほど戦闘力が上がり、2Lvでおよそ2倍', () => {
    expect(battlePower(0)).toBe(500);
    expect(powerText(battlePower(49))).toMatch(/億/);
    expect(battlePower(20)).toBeGreaterThan(battlePower(19));
    expect(battlePower(22) / battlePower(20)).toBeCloseTo(SCOUTER_GROWTH ** 2, 1);
    expect(SCOUTER_GROWTH ** 2).toBeGreaterThan(1.9);
    expect(battlePower(NaN)).toBeNull();
  });

  it('戦闘力の比が勝ちやすさの比になる(同じLvなら5割、Lv差はイロ式と同じ)', () => {
    expect(scoutReading({ opponentLevel: 20, userLevel: 20 }).winChance).toBe(50);
    const reading = scoutReading({ opponentLevel: 25, userLevel: 20 });
    const elo = 1 / (1 + 10 ** ((5 * 60) / 400));
    expect(reading.winChance).toBe(Math.round(elo * 100));
    expect(reading.grade).toBe('much');
  });

  it('段の見立てと、10倍以上はレンズにひび', () => {
    expect(scouterGrade(12)).toBe('beyond');
    expect(scouterGrade(1)).toBe('even');
    expect(scouterGrade(0.3)).toBe('far-below');
    expect(scoutReading({ opponentLevel: 49, userLevel: 10 }).crack).toBe(true);
    expect(scoutReading({ opponentLevel: 10, userLevel: 49 }).winChance).toBe(99);
    expect(scoutReading({ opponentLevel: NaN, userLevel: 10 })).toBeNull();
  });

  it('数は万・億で書く', () => {
    expect(powerText(980)).toBe('980');
    expect(powerText(123400)).toBe('12万3400');
    expect(powerText(50000)).toBe('5万');
    expect(powerText(234567890)).toBe('2億3456万');
    expect(powerText(null)).toBe('???');
  });

  it('測っている数は、最後に本当の数で止まる', () => {
    expect(rollingPower(5000, 1, 0.9)).toBe(5000);
    expect(rollingPower(5000, 0.1, 0.5)).toBeLessThan(5000);
  });
});
