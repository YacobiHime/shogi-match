import { describe, expect, it } from 'vitest';
import {
  LADDER_VERSION,
  ladderLabelFromOld,
  ladderLevelFromOld,
  ladderLevelIndexFromOld,
  ladderRatingFromOld,
  migrateSeasonLevels,
  oldLevelFromLadder,
} from './level-ladder.mjs';

describe('段級位の作り直し(2026-10-22)の前の保存を移す', () => {
  it('前の表のLvを、同じ強さの新しい表のLvへ。前と同じ名前の級は同じ名前へ', () => {
    expect(ladderLevelFromOld(0)).toBe(0);
    expect(ladderLevelFromOld(40)).toBe(40);
    // 前の15級(Lv12)〜6級(Lv21)は、新しい15級(Lv1)〜6級(Lv10)と同じ強さ。
    for (let old = 12; old <= 21; old += 1) expect(ladderLevelIndexFromOld(old), `Lv${old}`).toBe(old - 11);
    // なくなった26級〜16級は、Lv0〜1のあいだへ縮める。
    expect(ladderLevelFromOld(6)).toBeCloseTo(0.5, 6);
    // 前のプロ級(Lv39)は、同じ強さの新しいタイトル保持者(Lv39)。
    expect(ladderLevelIndexFromOld(39)).toBe(39);
    let previous = -1;
    for (let old = 0; old <= 40; old += 0.25) {
      const level = ladderLevelFromOld(old);
      expect(level).toBeGreaterThanOrEqual(previous);
      previous = level;
    }
  });

  it('新しい表のLvから前の表のLvへ、逆にも引ける', () => {
    for (const level of [0.3, 1, 4.5, 11, 12.4, 15, 20.7, 33, 39, 39.6]) {
      expect(ladderLevelFromOld(oldLevelFromLadder(level)), String(level)).toBeCloseTo(level, 6);
    }
    expect(oldLevelFromLadder(0)).toBe(0);
    expect(oldLevelFromLadder(40)).toBe(40);
  });

  it('レーティングは、前のR(Lv×80)から新しいR(60×Lv−30)へ', () => {
    // 前の十二級(Lv15、R1200)は、新しい12級(Lv4、R210)。
    expect(ladderRatingFromOld(1200)).toBe(210);
    expect(ladderRatingFromOld(0)).toBe(0);
    expect(ladderRatingFromOld(3200)).toBe(2370);
  });

  it('段級位の名前は、級を算用数字にし、なくなった級は15級、プロ級はタイトル保持者', () => {
    expect(ladderLabelFromOld('十四級程度')).toBe('14級程度');
    expect(ladderLabelFromOld('二十六級')).toBe('15級');
    expect(ladderLabelFromOld('一級')).toBe('1級');
    expect(ladderLabelFromOld('十級')).toBe('10級');
    expect(ladderLabelFromOld('アマ初段程度')).toBe('アマ初段程度');
    expect(ladderLabelFromOld('プロ級')).toBe('タイトル保持者');
    expect(ladderLabelFromOld('3級')).toBe('3級');
    expect(ladderLabelFromOld('')).toBe('');
  });

  it('期の途中の棋士のLvを1回だけ移す', () => {
    const season = { phase: 'ranking', players: { a: { name: 'A', level: 15 }, b: { name: 'B', level: 39 }, user: { name: 'あなた', level: 21 } } };
    const moved = migrateSeasonLevels(season);
    expect(moved.ladder).toBe(LADDER_VERSION);
    expect(moved.players.a.level).toBe(4);
    expect(moved.players.b.level).toBe(39);
    expect(moved.players.user.level).toBe(10);
    expect(migrateSeasonLevels(moved)).toBe(moved);
    expect(migrateSeasonLevels(null)).toBeNull();
  });
});
