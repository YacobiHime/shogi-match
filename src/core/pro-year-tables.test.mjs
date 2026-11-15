// 棋士の1年の棋戦の表: すべてのブロックの表と、終わった期を見返す(pro-year-design.md 24章)。
import { describe, expect, it } from 'vitest';
import { advanceToNextGame, clearProYearResults, createProYear, eventView, packProYear, recordProGame, startNextYear, unpackProYear } from './pro-year.mjs';
import { createRoster } from './ryuo-roster.mjs';

function playYear(state) {
  for (let step = 0; step < 300; step += 1) {
    state = advanceToNextGame(state);
    if (state.yearDone) break;
    state = clearProYearResults(recordProGame(state, 'win').state);
  }
  return state;
}

const roster = createRoster({ seed: 11, userGroup: 6 });
const first = playYear(createProYear({ seed: 7, fiscalYear: 2026, roster, settings: { world: 30 }, userLevel: 49, userName: 'やこび' }));

describe('すべてのブロックの表(24章)', () => {
  it('予選のブロックは、自分・羽音のいないブロックもトーナメント表になる', () => {
    for (const id of ['eio', 'oi', 'nhk', 'ryuo']) {
      for (const cycle of eventView(first, id).cycles) {
        for (const stage of cycle.stages.filter((entry) => entry.started && entry.blockCount)) {
          expect(stage.brackets.length).toBe(stage.blockCount);
          expect(stage.others).toEqual([]);
          if (stage.done) for (const bracket of stage.brackets) expect(bracket.view.matches.some((match) => match.winner)).toBe(true);
        }
      }
    }
  });

  it('自分のブロック・羽音のブロックが先で、あとは元の順', () => {
    const stage = eventView(first, 'eio').cycles.flatMap((cycle) => cycle.stages).find((entry) => entry.started && entry.blockCount > 2 && entry.brackets.some((bracket) => bracket.you));
    expect(stage.brackets[0].you).toBe(true);
    const rest = stage.brackets.filter((bracket) => !bracket.you && !bracket.rival);
    expect(rest.map((bracket) => bracket.order)).toEqual([...rest.map((bracket) => bracket.order)].sort((a, b) => a - b));
  });

  it('竜王戦の1組・2組の準優勝も、決勝トーナメントへ進む', () => {
    const ryuo = Object.values(first.cycles).find((cycle) => cycle.event === 'ryuo' && cycle.stages[0]?.done);
    expect(ryuo.stages[0].winners.length).toBe(8);
  });

  it('前の保存(最初の並びのないブロック)は、勝ち上がった人の名前の行のまま', () => {
    const old = structuredClone(first);
    const cycle = Object.values(old.cycles).find((entry) => entry.event === 'eio' && entry.stages[0]?.blocks?.length > 2);
    const target = cycle.stages[0].blocks.find((block) => !block.track);
    delete target.slots;
    const stage = eventView(old, 'eio').cycles.find((entry) => entry.id === cycle.id).stages[0];
    expect(stage.brackets.length).toBe(stage.blockCount - 1);
    expect(stage.others.map((other) => other.name)).toEqual([target.name]);
  });
});

describe('終わった期を見返す(24章)', () => {
  const second = startNextYear(first);
  const third = startNextYear(playYear(second));

  it('年度が替わっても、棋戦ごとにいちばん新しい終わった期が残る', () => {
    for (const id of ['ryuo', 'meijin', 'oi', 'eio', 'nhk']) {
      const cycles = eventView(third, id).cycles;
      const done = cycles.filter((cycle) => cycle.champion);
      expect(done.length).toBeGreaterThanOrEqual(1);
      // それより前の終わった期は消える(1棋戦の期は3つまで)。
      expect(cycles.length).toBeLessThanOrEqual(3);
    }
  });

  it('防衛戦のあとも、その期の表と番勝負の星が見られる', () => {
    const ryuo = eventView(third, 'ryuo').cycles.find((cycle) => cycle.champion);
    const series = ryuo.stages.at(-1).series;
    expect(series.games.length).toBeGreaterThanOrEqual(series.need);
    expect(series.games.every((game) => game.winner)).toBe(true);
    const groups = ryuo.stages[0];
    expect(groups.brackets.length).toBe(groups.blockCount);
    // 前の年度より前の期は、年度の数で時期を言う。
    expect(ryuo.stages[0].period).toMatch(/^(前年度|\d{4}年度) /);
  });

  it('保存して戻しても、残した期と番勝負の局は消えない', () => {
    const restored = unpackProYear(JSON.parse(JSON.stringify(packProYear(third))), roster);
    expect(eventView(restored, 'ryuo').cycles.map((cycle) => cycle.id)).toEqual(eventView(third, 'ryuo').cycles.map((cycle) => cycle.id));
    expect(eventView(restored, 'ryuo').cycles.find((cycle) => cycle.champion).stages.at(-1).series.games.length).toBeGreaterThan(0);
  });
});
