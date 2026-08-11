import { describe, expect, test } from 'vitest';
import { ShogiEngine } from './engine.js';

function mockEngine(response) {
  const engine = new ShogiEngine({ factory: async () => ({}) });
  engine.instance = {
    postMessage(command) {
      if (command.startsWith('go mate')) queueMicrotask(() => engine._emit(response));
    },
  };
  return engine;
}

describe('USI詰み専用探索', () => {
  test('詰み手順をUSI指し手の配列として返す', async () => {
    const engine = mockEngine('checkmate 5c5b 4a5b G*4b');
    await expect(engine.goMate({ movetime: 100, maxTimeMs: 200 })).resolves.toEqual({
      status: 'mate',
      moves: ['5c5b', '4a5b', 'G*4b'],
    });
  });

  test('不詰みと未対応を区別する', async () => {
    await expect(mockEngine('checkmate nomate').goMate({ movetime: 100, maxTimeMs: 200 }))
      .resolves.toEqual({ status: 'nomate', moves: [] });
    await expect(mockEngine('checkmate notimplemented').goMate({ movetime: 100, maxTimeMs: 200 }))
      .resolves.toEqual({ status: 'unsupported', moves: [] });
  });
});

describe('USI通常探索', () => {
  test('multipv表記が省略されても最善手の評価値を保持する', async () => {
    const engine = new ShogiEngine({ factory: async () => ({}) });
    engine.instance = {
      postMessage(command) {
        if (!command.startsWith('go ')) return;
        queueMicrotask(() => {
          engine._emit('info depth 8 score cp 235 nodes 1000 pv 7g7f 3c3d');
          engine._emit('bestmove 7g7f ponder 3c3d');
        });
      },
    };

    await expect(engine.go({ nodes: 1000, maxTimeMs: 200 })).resolves.toMatchObject({
      move: '7g7f',
      candidates: [{ rank: 1, move: '7g7f', score: { type: 'cp', value: 235 } }],
    });
  });
});
