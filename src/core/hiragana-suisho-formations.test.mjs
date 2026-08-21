import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';

import {
  detectHiraganaSuishoFormations,
  invertHiraganaSuishoSfen,
} from './hiragana-suisho-formations.mjs';
import { appendUsiMove, createGameRecord } from '../game-state.ts';

const master = JSON.parse(await readFile(
  new URL('../data/hiragana_suisho_formations.json', import.meta.url),
  'utf8',
));

describe('HiraganaSuisho原典互換判定', () => {
  test('原典133件と追加囲いを読み込む', () => {
    expect(master.rules).toHaveLength(136);
    expect(master.rules.filter((rule) => rule.group === 'tac_match')).toHaveLength(31);
  });

  test('先手と後手の共通作戦を盤面反転して判定する', () => {
    const sente = '9/9/9/9/9/7S1/9/7R1/9 w - 1';
    const gote = invertHiraganaSuishoSfen(sente);
    expect(detectHiraganaSuishoFormations(sente, master).map(({ name }) => name))
      .toContain('棒銀');
    expect(detectHiraganaSuishoFormations(gote, master).map(({ name }) => name))
      .toContain('棒銀');
  });

  test('盤面・成駒・持駒・手番の反転は可逆', () => {
    const sfen = '4k4/9/9/9/4+P4/9/9/9/4K4 b R2p 42';
    expect(invertHiraganaSuishoSfen(invertHiraganaSuishoSfen(sfen))).toBe(sfen);
  });

  test('角交換前の相居飛車を角換わりと誤判定しない', () => {
    const beforeExchange = '4k4/1r5b1/9/1p7/7P1/9/9/1B5R1/4K4 w - 1';
    expect(detectHiraganaSuishoFormations(beforeExchange, master).map(({ name }) => name))
      .not.toContain('角換わり');
  });

  test('双方が角を持駒にした角交換済み局面を角換わりと判定する', () => {
    const afterExchange = '4k4/1r7/9/1p7/7P1/9/9/7R1/4K4 w Bb 1';
    expect(detectHiraganaSuishoFormations(afterExchange, master).map(({ name }) => name))
      .toContain('角換わり');
  });

  test('角換わり29手目基本図を角換わりとしても判定する', () => {
    const joseki = 'ln1g3nl/1r3kg2/3sppsp1/p1pp2p1p/1p5P1/P1PP1PP1P/1PS1P1N2/2GK2SR1/LN3G2L w Bb 30';
    const names = detectHiraganaSuishoFormations(joseki, master).map(({ name }) => name);
    expect(names).toContain('角換わり');
    expect(names).toContain('角換わり29手目基本図');
  });

  test('代表的な角交換の指し手列では交換成立後だけ角換わりになる', () => {
    const record = createGameRecord();
    const moves = ['7g7f', '8c8d', '2g2f', '8d8e', '8h7g', '3c3d', '7g2b+', '3a2b'];
    for (const move of moves.slice(0, -1)) expect(appendUsiMove(record, move)).toBe(true);
    expect(detectHiraganaSuishoFormations(record.position.sfen, master).map(({ name }) => name))
      .not.toContain('角換わり');
    expect(appendUsiMove(record, moves.at(-1))).toBe(true);
    expect(detectHiraganaSuishoFormations(record.position.sfen, master).map(({ name }) => name))
      .toContain('角換わり');
  });

  test('後手が8筋歩を突かずに角交換した手順を一手損角換わりと判定する', () => {
    const record = createGameRecord();
    const moves = ['7g7f', '3c3d', '2g2f', '2b8h+', '7i8h'];
    for (const move of moves) expect(appendUsiMove(record, move)).toBe(true);
    const names = detectHiraganaSuishoFormations(record.position.sfen, master)
      .map(({ name }) => name);
    expect(names).toContain('一手損角換わり');
  });

  test('角換わりの基本判定は後手8筋歩の位置を必須にしない', () => {
    const genericRule = master.rules.find((rule) => rule.name === '角換わり');
    const oneTempoLoss = '4k4/1r7/1p7/9/9/7P1/9/7R1/4K4 w Bb 5';
    expect(detectHiraganaSuishoFormations(
      oneTempoLoss,
      { version: 1, rules: [genericRule] },
    ).map(({ name }) => name)).toContain('角換わり');
  });

  test('鬼殺しの代表形を判定し、嬉野流とは誤判定しない', () => {
    const record = createGameRecord();
    for (const move of ['7g7f', '3c3d', '7f7e', '4c4d', '8i7g', '8c8d', '2h7h']) {
      expect(appendUsiMove(record, move)).toBe(true);
    }
    const names = detectHiraganaSuishoFormations(record.position.sfen, master)
      .map(({ name }) => name);
    expect(names).toContain('鬼殺し');
    expect(names).not.toContain('嬉野流');
  });

  test('嬉野流の代表的な銀上がりを判定し、鬼殺しとは誤判定しない', () => {
    const record = createGameRecord();
    for (const move of ['7i6h', '3c3d', '5g5f', '8c8d', '6h5g']) {
      expect(appendUsiMove(record, move)).toBe(true);
    }
    const names = detectHiraganaSuishoFormations(record.position.sfen, master)
      .map(({ name }) => name);
    expect(names).toContain('嬉野流');
    expect(names).not.toContain('鬼殺し');
  });

  test('角頭歩を代表手順から判定する', () => {
    const record = createGameRecord();
    for (const move of ['7g7f', '3c3d', '8g8f']) {
      expect(appendUsiMove(record, move)).toBe(true);
    }
    expect(detectHiraganaSuishoFormations(record.position.sfen, master).map(({ name }) => name))
      .toContain('角頭歩');
  });

  test('銀と金だけの不完全な形を銀冠と誤判定しない', () => {
    const incomplete = '4k4/9/9/9/9/9/5G1S1/6G1K/9 w - 1';
    expect(detectHiraganaSuishoFormations(incomplete, master).map(({ name }) => name))
      .not.toContain('銀冠');
  });

  test('振り飛車銀冠の主要4駒が揃った形を銀冠と判定する', () => {
    const silverCrown = '4k4/9/9/9/9/9/5G1S1/6GK1/9 w - 1';
    expect(detectHiraganaSuishoFormations(silverCrown, master).map(({ name }) => name))
      .toContain('銀冠');
  });

  test('先手の連盟美濃を主要4駒から判定する', () => {
    const renmeiMino = '4k4/9/9/9/9/9/4PPPPP/5G1K1/4G1SNL w - 1';
    expect(detectHiraganaSuishoFormations(renmeiMino, master).map(({ name }) => name))
      .toContain('連盟美濃');
  });

  test('後手の連盟美濃を盤面反転して判定する', () => {
    const sente = '4k4/9/9/9/9/9/4PPPPP/5G1K1/4G1SNL w - 1';
    const gote = invertHiraganaSuishoSfen(sente);
    expect(detectHiraganaSuishoFormations(gote, master).map(({ name }) => name))
      .toContain('連盟美濃');
  });

  test('5九金がない片連盟美濃を連盟美濃と誤判定しない', () => {
    const incomplete = '4k4/9/9/9/9/9/4PPPPP/5G1K1/6SNL w - 1';
    expect(detectHiraganaSuishoFormations(incomplete, master).map(({ name }) => name))
      .not.toContain('連盟美濃');
  });

  test('居玉で金銀を整えた四間飛車を藤井システムと判定する', () => {
    const record = createGameRecord();
    for (const move of ['7g7f', '3c3d', '6g6f', '8c8d', '2h6h', '6a6b', '1g1f', '4a4b', '8h7g', '4b3b', '3i3h', '5a4b', '6i5h', '7a7b', '7i7h']) {
      expect(appendUsiMove(record, move)).toBe(true);
    }
    const names = detectHiraganaSuishoFormations(record.position.sfen, master)
      .map(({ name }) => name);
    expect(names).toContain('藤井システム');
  });

  test('通常の四間飛車を藤井システムと誤判定しない', () => {
    const ordinary = 'lnsgkgsnl/1r5b1/ppppppppp/9/9/3P5/PPP1PPPPP/1B1R5/LNSGKGSNL w - 1';
    expect(detectHiraganaSuishoFormations(ordinary, master).map(({ name }) => name))
      .not.toContain('藤井システム');
  });
});
