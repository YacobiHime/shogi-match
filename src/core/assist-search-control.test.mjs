import { describe, expect, it, vi } from 'vitest';
import { createAssistSearchControl } from './assist-search-control.mjs';

describe('assist search control', () => {
  it('stop世代が変わった探索を途中結果として識別する', async () => {
    const control = createAssistSearchControl();
    let resolveSearch;
    const search = control.run(() => new Promise((resolve) => { resolveSearch = resolve; }));
    expect(control.running).toBe(true);
    expect(control.interrupt()).toBe(true);
    resolveSearch({ candidates: [{ rank: 1, move: '7g7f' }] });
    await expect(search).resolves.toMatchObject({ interrupted: true });
    expect(control.running).toBe(false);
  });

  it('古くなった後続項目は探索を始めず即座に抜けられる', async () => {
    const control = createAssistSearchControl();
    let stale = false;
    let resolveSearch;
    const first = control.run(() => new Promise((resolve) => { resolveSearch = resolve; }));
    const engineTask = vi.fn();
    const queued = first.then(() => {
      if (stale) return;
      return control.run(engineTask);
    });
    stale = true;
    control.interrupt();
    resolveSearch({});
    await queued;
    expect(engineTask).not.toHaveBeenCalled();
  });
});
