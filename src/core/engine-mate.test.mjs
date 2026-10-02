import { describe, expect, test, vi } from 'vitest';
import { ShogiEngine } from './engine.js';

describe('USI通常探索', () => {
  test('bestmoveが返らなければ期限後にlistenerを外して失敗する', async () => {
    vi.useFakeTimers();
    try {
      const engine = new ShogiEngine({ factory: async () => ({}) });
      const commands = [];
      engine.instance = { postMessage: (command) => commands.push(command) };
      const search = engine.go({ nodes: 1000, maxTimeMs: 100 });
      const settled = vi.fn();
      search.then(settled, settled);
      await vi.advanceTimersByTimeAsync(2100);
      expect(settled).toHaveBeenCalledOnce();
      await expect(search).rejects.toThrow(/応答|期限|タイムアウト/);
      expect(commands).toContain('stop');
      expect(engine._listeners).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  test('goの送信例外でもlistenerを残さない', async () => {
    const engine = new ShogiEngine({ factory: async () => ({}) });
    engine.instance = { postMessage: () => { throw new Error('send failed'); } };
    await expect(engine.go({ nodes: 1000, maxTimeMs: 100 })).rejects.toThrow('send failed');
    expect(engine._listeners).toHaveLength(0);
  });
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

  test('読んだ局面数を含むinfo行ごとに、思考ゲージ用の途中経過を渡す', async () => {
    const engine = new ShogiEngine({ factory: async () => ({}) });
    engine.instance = {
      postMessage(command) {
        if (!command.startsWith('go ')) return;
        queueMicrotask(() => {
          engine._emit('info depth 3 score cp 20 nodes 120 nps 4000 pv 7g7f');
          engine._emit('info nodes 900 nps 5000 hashfull 1');
          engine._emit('bestmove 7g7f');
        });
      },
    };
    const progress = [];
    await engine.go({ nodes: 1000, maxTimeMs: 200, onNodes: (update) => progress.push(update) });
    expect(progress).toEqual([{ nodes: 120, nps: 4000 }, { nodes: 900, nps: 5000 }]);
  });
});
