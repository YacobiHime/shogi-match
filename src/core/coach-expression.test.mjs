import { describe, expect, test } from 'vitest';

import { existsSync } from 'node:fs';

import {
  COACH_EXPRESSION_FILES,
  coachExpressionFilename,
  coachExpressionForText,
  coachPortraitSizes,
  coachPortraitSmallFilename,
  coachPortraitSrcset,
} from './coach-expression.mjs';

describe('助言に応じた表情', () => {
  test.each([
    '良い流れだね！',
    '戦法が完成したね！この先はAIの候補手を3手示すよ。',
    'おすすめは ７六歩 だよ！',
  ])('前向きな助言では通常表情にする: %s', (text) => {
    expect(coachExpressionForText(text)).toBe('neutral');
  });

  test.each([
    '王手がかかっているよ。まずは受けよう！',
    '詰めろだね。受けないと負けちゃう…',
    '苦しい終盤だけど、最後まで手を探そう！',
  ])('切迫した助言では不安顔にする: %s', (text) => {
    expect(coachExpressionForText(text)).toBe('worried');
  });

  test.each([
    'あちゃ～。今の私たちの手、やっちゃった…',
    '今の私たちの手は悪手だね…',
    'もう一度、落ち着いて考えてみよう！',
  ])('失敗や軽い思案では苦笑にする: %s', (text) => {
    expect(coachExpressionForText(text)).toBe('wry');
  });

  test('分類外は通常表情を維持し、表情ごとの画像名を返す', () => {
    expect(coachExpressionForText('相手は振り飛車だね。')).toBe('neutral');
    expect(coachExpressionFilename('良い出だしだね！'))
      .toBe('sakurano-momoka.webp');
  });
});

describe('立ち絵の大きさの版', () => {
  test('小さい版と大きい版を、幅の記述付きでsrcsetに並べる', () => {
    expect(coachPortraitSmallFilename('sakurano-momoka-wry.webp')).toBe('sakurano-momoka-wry-320.webp');
    expect(coachPortraitSrcset('./dist', 'sakurano-momoka.webp')).toBe(
      './dist/characters/sakurano-momoka-320.webp?v=3 320w, ./dist/characters/sakurano-momoka.webp?v=3 800w',
    );
  });

  test('表示幅を測れたらその幅を、測る前は画面の幅からの見当をsizesにする', () => {
    expect(coachPortraitSizes(283.4)).toBe('284px');
    expect(coachPortraitSizes(0)).toBe('(max-width: 999px) 80px, 400px');
    expect(coachPortraitSizes(undefined)).toBe('(max-width: 999px) 80px, 400px');
  });

  test('どの表情にも小さい版の画像がある', () => {
    for (const filename of Object.values(COACH_EXPRESSION_FILES)) {
      expect(existsSync(new URL(`../../public/characters/${coachPortraitSmallFilename(filename)}`, import.meta.url))).toBe(true);
    }
  });
});
