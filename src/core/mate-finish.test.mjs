import { describe, expect, it } from 'vitest';
import {
  addMateRecord, emptyMateRecords, finishingMate, loadMateRecords, mateFinishText, mateKansenkiSentence, mateStreak, mateTier,
  MATE_FINISH_KEY, MATE_RECENT_LIMIT, saveMateRecords,
} from './mate-finish.mjs';

/** 玉が5一、先手の歩が5三、先手が飛と金を持つ局面(▲5二飛から3手で詰む)。 */
const START = '4k4/9/4P4/9/9/9/9/9/4K4 b RG 1';

function memoryStorage() {
  const map = new Map();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)) };
}

describe('寄せの手数(最後の王手の連続)', () => {
  it('最後の手が王手でなければ0、王手が続くところまでさかのぼる', () => {
    expect(mateStreak([])).toBe(0);
    expect(mateStreak([true, false, false])).toBe(0);
    expect(mateStreak([false, false, true])).toBe(1);
    expect(mateStreak([true, false, true, false, true])).toBe(5);
    // 詰ませた側の王手が途切れたら、そこまで。相手の手が王手でも数えない(王手の連続は詰ませた側の手だけを見る)。
    expect(mateStreak([true, true, false, false, true, false, true])).toBe(3);
  });

  it('▲5二飛 △6一玉 ▲7二金で3手詰め', () => {
    const mate = finishingMate(['R*5b', '5a6a', 'G*7b'], { initialSfen: START });
    expect(mate).toEqual({ plies: 3, from: 1, to: 3 });
  });

  it('静かな手のあとの1手の詰みは1手詰め。寄せの最初の手数を返す', () => {
    // 先手の玉が9九と9八を行き来する静かな手のあと、玉が5一に戻ったところで▲5二金(頭金)。
    const quiet = '4k4/9/4P4/9/9/9/9/9/K8 b G 1';
    const mate = finishingMate(['9i9h', '5a4a', '9h9i', '4a5a', 'G*5b'], { initialSfen: quiet });
    expect(mate).toEqual({ plies: 1, from: 5, to: 5 });
  });

  it('詰みで終わっていない棋譜・指せない手を含む棋譜はnull', () => {
    expect(finishingMate(['R*5b', '5a6a'], { initialSfen: START })).toBeNull();
    expect(finishingMate(['R*5b', '1a1b'], { initialSfen: START })).toBeNull();
    expect(finishingMate([], { initialSfen: START })).toBeNull();
  });

  it('寄せの重さと言葉', () => {
    expect(mateTier(1)).toBe('short');
    expect(mateTier(5)).toBe('mid');
    expect(mateTier(9)).toBe('long');
    expect(mateTier(15)).toBe('legend');
    expect(mateFinishText(1)).toBe('1手詰めで仕留めた！');
    expect(mateFinishText(7)).toBe('7手詰めで寄せ切り！');
  });

  it('観戦記の一文は、寄せの最初の手と手数を書く', () => {
    expect(mateKansenkiSentence({ plies: 7, from: 89, fromText: '▲3二銀', userName: 'やこび' }))
      .toBe('最後は89手目▲3二銀からの7手詰め。やこびが鮮やかに寄せ切った。');
    expect(mateKansenkiSentence({ plies: 1, from: 101, fromText: '▲5二金', userName: 'やこび' })).toContain('一手で仕留めた');
    expect(mateKansenkiSentence({ plies: 17, from: 80, userName: 'やこび' })).toContain('読み切った');
  });
});

describe('寄せの記録', () => {
  it('いちばん長い寄せを残し、前の記録より長いときだけ自己最長にする', () => {
    let records = emptyMateRecords();
    const first = addMateRecord(records, { plies: 5, at: 1, event: 'ryuo' });
    expect(first.isBest).toBe(false);
    records = first.records;
    const shorter = addMateRecord(records, { plies: 3, at: 2, event: 'ryuo' });
    expect(shorter.isBest).toBe(false);
    expect(shorter.records.best.plies).toBe(5);
    const longer = addMateRecord(shorter.records, { plies: 9, at: 3, event: 'meijin' });
    expect(longer.isBest).toBe(true);
    expect(longer.records).toMatchObject({ count: 3, best: { plies: 9, event: 'meijin' } });
    expect(longer.records.recent.map(({ plies }) => plies)).toEqual([9, 3, 5]);
  });

  it('最近の寄せは決まった数まで。保存して読み戻せる。壊れた保存は空', () => {
    let records = emptyMateRecords();
    for (let index = 0; index < MATE_RECENT_LIMIT + 3; index += 1) records = addMateRecord(records, { plies: 3, at: index, event: 'ryuo' }).records;
    expect(records.recent).toHaveLength(MATE_RECENT_LIMIT);
    const storage = memoryStorage();
    saveMateRecords(storage, records);
    expect(loadMateRecords(storage)).toEqual(records);
    storage.setItem(MATE_FINISH_KEY, '{broken');
    expect(loadMateRecords(storage)).toEqual(emptyMateRecords());
  });
});
