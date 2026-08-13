import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';
import { appendUsiMove, createGameRecord } from '../game-state.ts';
import {
  createFormationState,
  detectFormationSnapshot,
  formationNamesFromState,
  preferSpecificFormationNames,
  updateFormationState,
} from './formation-tracker.mjs';

const master = JSON.parse(await readFile(
  new URL('../data/hiragana_suisho_formations.json', import.meta.url),
  'utf8',
));

describe('戦型の役割別追跡', () => {
  test('一手損角換わりを後手側だけへ表示する', () => {
    const record = createGameRecord();
    for (const move of ['7g7f', '3c3d', '2g2f', '2b8h+', '7i8h']) {
      expect(appendUsiMove(record, move)).toBe(true);
    }
    const state = updateFormationState(
      createFormationState(),
      detectFormationSnapshot(record.position.sfen, master),
    );
    expect(formationNamesFromState(state, 'black')).not.toContain('一手損角換わり');
    expect(formationNamesFromState(state, 'white')).toContain('一手損角換わり');
  });

  test('四間飛車を指した側だけへ割り当てる', () => {
    const record = createGameRecord();
    expect(appendUsiMove(record, '2h6h')).toBe(true);
    const snapshot = detectFormationSnapshot(record.position.sfen, master);
    expect(snapshot.black.rook).toBe('四間飛車');
    expect(snapshot.white.rook).toBe('');
  });

  test('連盟美濃を先手・後手それぞれの囲いとして割り当てる', () => {
    const sente = '4k4/9/9/9/9/9/4PPPPP/5G1K1/4G1SNL b - 1';
    const gote = 'lns1g4/1k1g5/ppppp4/9/9/9/9/9/4K4 b - 1';
    expect(detectFormationSnapshot(sente, master).black.castle).toBe('連盟美濃');
    expect(detectFormationSnapshot(gote, master).white.castle).toBe('連盟美濃');
  });

  test('後手専用の2手目3二飛戦法を元盤面から判定する', () => {
    const record = createGameRecord();
    for (const move of ['7g7f', '8b3b']) expect(appendUsiMove(record, move)).toBe(true);
    const snapshot = detectFormationSnapshot(record.position.sfen, master);
    expect(snapshot.white.tactics).toContain('2手目3二飛戦法');
    expect(snapshot.black.tactics).not.toContain('2手目3二飛戦法');
  });

  test('基本戦型と飛車位置系は最初の判定を保持する', () => {
    const initial = createFormationState();
    const first = updateFormationState(initial, {
      battle: '角換わり',
      black: { rook: '四間飛車', castle: '', tactics: [] },
      white: { rook: '', castle: '', tactics: [] },
    });
    const later = updateFormationState(first, {
      battle: '矢倉',
      black: { rook: '三間飛車', castle: '', tactics: [] },
      white: { rook: '', castle: '', tactics: [] },
    });
    expect(later.battle).toBe('角換わり');
    expect(later.black.rook).toBe('四間飛車');
  });

  test('囲いは現在形へ更新し、作戦は重複なく蓄積する', () => {
    const first = updateFormationState(createFormationState(), {
      battle: '',
      black: { rook: '', castle: '片美濃', tactics: ['棒銀'] },
      white: { rook: '', castle: '', tactics: [] },
    });
    const later = updateFormationState(first, {
      battle: '',
      black: { rook: '', castle: '銀冠', tactics: ['棒銀', '腰掛け銀'] },
      white: { rook: '', castle: '', tactics: [] },
    });
    expect(later.black.castle).toBe('銀冠');
    expect(later.black.tactics).toEqual(['棒銀', '腰掛け銀']);
  });

  test('件数制限は保存後の表示時だけ適用する', () => {
    const state = updateFormationState(createFormationState(), {
      battle: '角換わり',
      black: { rook: '', castle: '銀冠', tactics: ['棒銀', '早繰り銀', '腰掛け銀'] },
      white: { rook: '', castle: '', tactics: [] },
    });
    expect(state.black.tactics).toHaveLength(3);
    expect(formationNamesFromState(state, 'black', 3)).toHaveLength(3);
  });

  test.each([
    [['中飛車', 'ゴキゲン中飛車'], ['ゴキゲン中飛車']],
    [['四間飛車', 'ノーマル四間飛車'], ['ノーマル四間飛車']],
    [['四間飛車', 'ノーマル四間飛車', '藤井システム'], ['藤井システム']],
    [['三間飛車', '石田流'], ['石田流']],
    [['向かい飛車', 'ダイレクト向かい飛車'], ['ダイレクト向かい飛車']],
    [['角換わり', '角換わり29手目基本図'], ['角換わり29手目基本図']],
    [['横歩取り', '横歩取り青野流'], ['横歩取り青野流']],
    [['相掛かり', 'AlphaZero流相掛かり'], ['AlphaZero流相掛かり']],
    [['矢倉', '金矢倉'], ['金矢倉']],
    [['鬼殺し', '三間飛車', '早石田'], ['鬼殺し']],
  ])('具体的な派生戦型があれば一般名を隠す: %j', (names, expected) => {
    expect(preferSpecificFormationNames(names)).toEqual(expected);
  });

  test('親子関係のない戦型や作戦は残す', () => {
    expect(preferSpecificFormationNames(['角換わり', '棒銀', '腰掛け銀']))
      .toEqual(['角換わり', '棒銀', '腰掛け銀']);
  });
});
