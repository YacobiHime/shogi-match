import { describe, expect, it } from 'vitest';
import { blunderDestinations } from './board-insight.mjs';
import { collectionFormationNames } from './formation-tracker.mjs';
import { applyRatedGame, createRatingState } from './player-rating.mjs';

describe('悪手のマス(docs/coach-advice-expansion-design.mdの14章)', () => {
  it('タダで取られる行き先と、守りが外れて別の駒が取られる行き先に印。安全な行き先には付けない', () => {
    // 先手の金5六は、相手の銀4四が利いている5五へ出るとタダで取られる。
    const sfen = '4k4/9/9/5s3/9/4G4/9/9/4K4 b - 1';
    const marks = blunderDestinations(sfen, '5f');
    expect(marks).toContain('5e');
    expect(marks).not.toContain('5g');
    // 飛車が角を守っている。飛車を動かすと角が取られる(守りが外れる)。
    const guard = '4k4/9/9/9/2s6/3B5/9/3R5/4K4 b - 1';
    expect(blunderDestinations(guard, '6h')).toContain('7h');
    expect(blunderDestinations(guard, '6h')).not.toContain('6g');
  });
});

describe('戦型の名前を目録へ寄せる(docs/player-world-note-design.mdの9章)', () => {
  it('棒銀は原始棒銀、一手損角換わりは角換わりも数える', () => {
    expect(collectionFormationNames(['棒銀'])).toEqual(expect.arrayContaining(['棒銀', '原始棒銀']));
    expect(collectionFormationNames(['一手損角換わり'])).toEqual(expect.arrayContaining(['一手損角換わり', '角換わり']));
    expect(collectionFormationNames(['早繰り銀', ''])).toEqual(['早繰り銀']);
  });

  it('レーティングの記録に、組んだ戦法(居飛車も)を1つずつ数える', () => {
    const { state } = applyRatedGame(createRatingState(), {
      opponentLevel: 20, outcome: 'win', color: 'black', profile: { strategy: ['早繰り銀', '角換わり', '早繰り銀'], rook: '' },
    });
    expect(state.usage.strategy).toEqual({ 早繰り銀: { wins: 1, losses: 0, draws: 0 }, 角換わり: { wins: 1, losses: 0, draws: 0 } });
  });
});
