import { describe, expect, it } from 'vitest';
import {
  LADDER_V2,
  LADDER_VERSION,
  ladderLabelFromOld,
  ladderLevelFromOld,
  ladderLevelFromV2,
  ladderLevelIndexFromOld,
  ladderLevelIndexFromV2,
  ladderRatingFromOld,
  ladderRatingFromV2,
  migrateSeasonLevels,
  oldLevelFromLadder,
} from './level-ladder.mjs';

describe('1つ目の表(v1、2026-10-21まで)の保存を今の表(50段階)へ移す', () => {
  it('v1のLvを、同じ強さの今の表のLvへ。同じ名前の級は同じ名前へ', () => {
    expect(ladderLevelFromOld(0)).toBe(0);
    expect(ladderLevelFromOld(40)).toBe(49);
    // v1の24級(Lv3)〜16級(Lv11)は、今の24級(Lv1)〜16級(Lv9)。26級・25級はLv0〜1のあいだ。
    for (let old = 3; old <= 11; old += 1) expect(ladderLevelIndexFromOld(old), `Lv${old}`).toBe(old - 2);
    expect(ladderLevelFromOld(1.5)).toBeCloseTo(0.5, 6);
    // v1の15級(Lv12)〜6級(Lv21)は、今の15級(Lv10)〜6級(Lv19)と同じ強さ。
    for (let old = 12; old <= 21; old += 1) expect(ladderLevelIndexFromOld(old), `Lv${old}`).toBe(old - 2);
    // v1のプロ級(Lv39)は、同じ強さの今のタイトル保持者(Lv48)。
    expect(ladderLevelIndexFromOld(39)).toBe(48);
    let previous = -1;
    for (let old = 0; old <= 40; old += 0.25) {
      const level = ladderLevelFromOld(old);
      expect(level).toBeGreaterThanOrEqual(previous);
      previous = level;
    }
  });

  it('今の表のLvからv1のLvへ、逆にも引ける', () => {
    for (const level of [0.3, 1, 4.5, 9.5, 10, 11, 12.4, 15, 20.7, 33, 42, 48, 48.6]) {
      expect(ladderLevelFromOld(oldLevelFromLadder(level)), String(level)).toBeCloseTo(level, 6);
    }
    expect(oldLevelFromLadder(0)).toBe(0);
    expect(oldLevelFromLadder(49)).toBe(40);
  });

  it('レーティングは、v1のR(Lv×80)から今のR(60×Lv−30)へ', () => {
    // v1の十二級(Lv15、R1200)は、今の12級(Lv13、R750)。
    expect(ladderRatingFromOld(1200)).toBe(750);
    expect(ladderRatingFromOld(0)).toBe(0);
    // v1の二十級(Lv7、R560)は、今の20級(Lv5、R270)。
    expect(ladderRatingFromOld(560)).toBe(270);
    expect(ladderRatingFromOld(3200)).toBe(2910);
  });

  it('段級位の名前は、級を算用数字にし、今の表にない25級より下は24級、プロ級はタイトル保持者', () => {
    expect(ladderLabelFromOld('十四級程度')).toBe('14級程度');
    expect(ladderLabelFromOld('二十六級')).toBe('24級');
    expect(ladderLabelFromOld('二十級')).toBe('20級');
    expect(ladderLabelFromOld('一級')).toBe('1級');
    expect(ladderLabelFromOld('十級')).toBe('10級');
    expect(ladderLabelFromOld('アマ初段程度')).toBe('アマ初段程度');
    expect(ladderLabelFromOld('プロ級')).toBe('タイトル保持者');
    expect(ladderLabelFromOld('3級')).toBe('3級');
    expect(ladderLabelFromOld('')).toBe('');
  });
});

describe('2つ目の表(v2、2026-10-22)の保存を今の表(50段階)へ移す', () => {
  it('15級(Lv1)から上は9つ上がる。Lv0はそのまま', () => {
    expect(ladderLevelFromV2(0)).toBe(0);
    expect(ladderLevelFromV2(1)).toBe(10);
    expect(ladderLevelFromV2(40)).toBe(49);
    expect(ladderLevelIndexFromV2(16)).toBe(25);
    // v2のLv0〜1のあいだ(v1の26級〜16級を縮めたところ)は、v1に戻して同じ名前の級へ。
    expect(ladderLevelFromV2(0.5)).toBeCloseTo(4, 6);
  });

  it('レーティングは、15級から上なら+540', () => {
    expect(ladderRatingFromV2(30)).toBe(570);
    expect(ladderRatingFromV2(630)).toBe(1170);
    expect(ladderRatingFromV2(2370)).toBe(2910);
    // v2のR0(15級より下)は、今の20級(Lv4)くらい。
    expect(ladderRatingFromV2(0)).toBe(210);
  });
});

describe('期の途中の棋士のLvを1回だけ移す', () => {
  it('v1の期', () => {
    const season = { phase: 'ranking', players: { a: { name: 'A', level: 15 }, b: { name: 'B', level: 39 }, user: { name: 'あなた', level: 21 } } };
    const moved = migrateSeasonLevels(season);
    expect(moved.ladder).toBe(LADDER_VERSION);
    expect(moved.players.a.level).toBe(13);
    expect(moved.players.b.level).toBe(48);
    expect(moved.players.user.level).toBe(19);
    expect(migrateSeasonLevels(moved)).toBe(moved);
    expect(migrateSeasonLevels(null)).toBeNull();
  });

  it('v2の期', () => {
    const season = { ladder: LADDER_V2, players: { a: { level: 1 }, b: { level: 40 }, c: { level: 0 } } };
    const moved = migrateSeasonLevels(season);
    expect(moved.ladder).toBe(LADDER_VERSION);
    expect(moved.players).toEqual({ a: { level: 10 }, b: { level: 49 }, c: { level: 0 } });
  });
});
