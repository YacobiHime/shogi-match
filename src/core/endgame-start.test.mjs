import { describe, expect, it } from 'vitest';
import { Position } from 'tsshogi';
import {
  ENDGAME_MAX_MATERIAL_GAP,
  ENDGAME_PLIES_BEFORE_END,
  endgameIntro,
  endgameSources,
  materialBalance,
  pickEndgameStart,
} from './endgame-start.mjs';

const STANDARD = 'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1';

describe('終盤戦の開始局面', () => {
  it('駒の損得を、盤上と持ち駒から先手側で数える', () => {
    expect(materialBalance(STANDARD)).toBe(0);
    // 先手が角を1枚持ち駒にしている(後手の角が盤にない)。
    expect(materialBalance('lnsgkgsnl/1r7/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b B 1')).toBe(16);
    // 後手のと金と、後手の持ち歩2枚。
    expect(materialBalance('4k4/9/9/9/9/9/4+p3/9/4K4 b 2p 1')).toBe(-8);
  });

  it('代表局を読み込み、どれも投了か詰みで終わる', () => {
    const sources = endgameSources();
    expect(sources.length).toBeGreaterThanOrEqual(8);
    for (const source of sources) {
      expect(source.title).toMatch(/ 対 /);
      expect(source.sfens.length).toBeGreaterThan(ENDGAME_PLIES_BEFORE_END.max);
      expect(['black', 'white']).toContain(source.winner);
    }
  });

  it('終局の少し前で、駒の損得が大きすぎない、合法な局面を選ぶ', () => {
    const sources = endgameSources();
    for (const value of [0, 0.25, 0.5, 0.75, 0.999]) {
      const start = pickEndgameStart(sources, { random: () => value });
      expect(start).not.toBeNull();
      expect(start.pliesLeft).toBeGreaterThanOrEqual(ENDGAME_PLIES_BEFORE_END.min);
      expect(start.pliesLeft).toBeLessThanOrEqual(ENDGAME_PLIES_BEFORE_END.max);
      expect(Math.abs(materialBalance(start.sfen))).toBeLessThanOrEqual(ENDGAME_MAX_MATERIAL_GAP);
      // プレイヤーは、その局面で手番の側を持つ。
      expect(start.playerColor).toBe(start.sfen.split(' ')[1] === 'w' ? 'white' : 'black');
      expect(Position.newBySFEN(start.sfen)).not.toBeNull();
    }
    // 同じ局面を続けて出さない。
    const first = pickEndgameStart(sources, { random: () => 0 });
    expect(pickEndgameStart(sources, { random: () => 0, excludeSfen: first.sfen }).sfen).not.toBe(first.sfen);
  });

  it('やこび姫の一言で、持つ側と実戦の勝ち負けを伝える', () => {
    expect(endgameIntro({ title: 'A 対 B', playerColor: 'black', winner: 'black' }))
      .toBe('「A 対 B」の終盤から、あなたは先手を持つよ。実戦では、この局面を持った側が勝ったよ。勝ち切れるかな？');
    expect(endgameIntro({ title: 'A 対 B', playerColor: 'white', winner: 'black' })).toContain('ひっくり返せるかな？');
  });
});
