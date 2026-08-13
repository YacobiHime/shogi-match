import { describe, expect, test, vi } from 'vitest';

import { withEngineAssetLocation } from './engine-loader.mjs';

describe('やねうら王の配信アセット位置', () => {
  test('dataとwasmをローダーと同じvendorディレクトリから取得する', () => {
    const factory = vi.fn((options) => options);
    const wrapped = withEngineAssetLocation(
      factory,
      'https://shogi-64125.web.app/vendor/yaneuraou.js?v=20260727-2',
    );
    const options = wrapped({ preRun: [] });

    expect(options.locateFile('yaneuraou.data'))
      .toBe('https://shogi-64125.web.app/vendor/yaneuraou.data');
    expect(options.locateFile('yaneuraou.wasm'))
      .toBe('https://shogi-64125.web.app/vendor/yaneuraou.wasm');
    expect(factory).toHaveBeenCalledOnce();
  });

  test('埋め込み側が指定したlocateFileは上書きしない', () => {
    const locateFile = (path) => `/custom/${path}`;
    const wrapped = withEngineAssetLocation((options) => options, './vendor/yaneuraou.js');

    expect(wrapped({ locateFile }).locateFile).toBe(locateFile);
  });
});
