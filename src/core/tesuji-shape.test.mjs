import { describe, expect, it } from 'vitest';
import { TESUJI_SHAPES, detectTesujiShape, tesujiShape } from './tesuji-shape.mjs';
import { referenceDexEntries } from './reference-dex.mjs';

const shapeOf = (sfenBefore, usi) => detectTesujiShape({ sfenBefore, usi });

describe('棋力テストの手筋の形', () => {
  it('名前と一言は、手筋図鑑か用語辞典の項目と同じ', () => {
    for (const shape of TESUJI_SHAPES) {
      const entry = referenceDexEntries(shape.dex).find(({ id }) => id === shape.id);
      expect(entry, shape.id).toBeTruthy();
      expect(shape.hint, shape.id).toBe(entry.overview);
      expect(['gain', 'yose']).toContain(shape.family);
      expect(tesujiShape(shape.id)).toBe(shape);
    }
  });

  it.each([
    ['knight-fork', '8k/9/3s1g3/9/9/9/9/9/K8 b N 1', 'N*5e', ['6c', '4c']],
    // 用語辞典の例: 7一に銀を打つと、8二の飛車と6二の金の両取り。
    ['waruuchi', '8k/1r1g5/9/9/9/9/9/9/K8 b S 1', 'S*7a', ['8b', '6b']],
    ['rook-cross-fork', '8k/4g4/9/9/7s1/9/9/9/K8 b R 1', 'R*5e', ['5b', '2e']],
    ['ote-bisha', '4k4/9/9/9/r8/9/9/9/8K b B 1', 'B*7c', ['5a', '9e']],
    // 手筋図鑑の例: 5五に香を打つと、5三の金と5一の飛車の串刺し。
    ['dengaku', '4r3k/9/4g4/9/9/9/9/9/K8 b L 1', 'L*5e', ['5c', '5a']],
    ['ryodori', '8k/9/2s3g2/9/9/9/9/9/K8 b B 1', 'B*5e', ['3c', '7c']],
    ['focal-pawn', '4k4/3g1s3/9/9/9/9/9/9/4K4 b P 1', 'P*5c', ['5c']],
    ['tapping-pawn', '8k/9/4s4/9/9/9/9/9/K8 b P 1', 'P*5d', ['5c']],
    ['edge-king-edge-pawn', '8k/9/7pp/9/8P/9/9/9/4K3L b - 1', '1e1d', ['1a']],
    ['belly-silver', '4k4/9/9/9/9/9/9/9/K8 b S 1', 'S*4a', ['5a']],
    ['one-gap-dragon', '4k4/9/6+R2/9/9/9/9/9/4K4 b - 1', '3c3a', ['5a']],
  ])('%s', (id, sfen, usi, targets) => {
    const shape = shapeOf(sfen, usi);
    expect(shape?.id).toBe(id);
    expect([...(shape?.targets ?? [])].sort()).toEqual([...targets].sort());
  });

  it('後手の手も、後手から見た形で見分ける', () => {
    // 先手の銀と金に、後手が桂を打つ(後手の桂は下へ跳ぶ)。
    expect(shapeOf('k8/9/9/9/9/9/3S1G3/9/8K w n 1', 'N*5e')?.id).toBe('knight-fork');
    // 後手の割り打ち: 後手の銀の斜め後ろは上の段。
    expect(shapeOf('k8/9/9/9/9/9/9/5G1R1/K8 w s 1', 'S*3i')?.id).toBe('waruuchi');
    // 先手の玉が9筋の端にいるとき、後手の9筋の歩。
    expect(shapeOf('4k4/9/9/p8/9/9/PP7/9/K8 w - 1', '9d9e')?.id).toBe('edge-king-edge-pawn');
  });

  it('形でない手は、手筋と言わない', () => {
    // 桂が歩しかねらっていない。
    expect(shapeOf('8k/9/3p1p3/9/9/9/9/9/K8 b N 1', 'N*5e')).toBeNull();
    // 玉が端にいないときの端歩・玉が陣の外に出ているときの端歩。
    expect(shapeOf('4k4/9/8p/9/8P/9/9/9/4K4 b - 1', '1e1d')).toBeNull();
    expect(shapeOf('9/9/9/8k/9/8P/9/9/4K4 b - 1', '1f1e')).toBeNull();
    // 手前が歩の串刺しは田楽刺しと言わない。
    expect(shapeOf('4r3k/9/4p4/9/9/9/9/9/K8 b L 1', 'L*5e')).toBeNull();
    // 静かな手。
    expect(shapeOf('4k4/9/9/9/9/9/9/4P4/4K4 b - 1', '5h5g')).toBeNull();
  });
});
