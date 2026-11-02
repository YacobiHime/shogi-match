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

  test.each([
    '王手飛車をかけられるよ！',
    '王手から迫れそうだよ！',
    '自玉はまだ安全！ 相手玉に詰めろをかけて、攻め合いで勝とう！',
    'いま、5手詰めがあったよ！ 次は王手の続く手から探してみよう',
    '王手は相手が必ず受けないといけないから、こっちが手番を握れるよ',
    '詰将棋が得意な相手だよ。王手の続く形にならないよう、玉を固めよう！',
    'コツどおり！ 取られても取り返せるね',
    '指す前に、動かした駒が相手の駒に取られないか確かめよう',
  ])('攻めのチャンス・説明・相手の紹介では、王手や詰みの言葉があっても困り顔にしない: %s', (text) => {
    expect(coachExpressionForText(text)).not.toBe('worried');
  });

  test.each([
    '王手きたーっ！！',
    'う～ん、王手だね…ここは逃げるべきかも。',
    '相手の銀が、飛車をねらってるよ。取られない升へ動かそう！',
    '間違えたら詰みだよ。慎重に受けよう。',
  ])('自分が危ないときだけ困り顔にする: %s', (text) => {
    expect(coachExpressionForText(text)).toBe('worried');
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
