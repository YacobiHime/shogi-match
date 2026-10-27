import { describe, expect, it } from 'vitest';
import {
  CONTENT_PERSONAL_SD, PROFILE_CONTENT_GAMES, PROFILE_MIN_RESULTS, PROFILE_TESTS, SKILL_PROFILE_KEY, TEST_PERSONAL_SD,
  contentFromInsight, createSkillProfile, estimateProfile, loadSkillProfile, poolEstimates, recordSkillTest, resultsFromHistory,
  saveSkillProfile, setProfileBand,
} from './skill-profile.mjs';

const memoryStorage = () => {
  const map = new Map();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)) };
};
/** opponentに、勝ちwins・負けlossesの履歴(交互に並べる)。 */
const history = (opponent, wins, losses, event = 'free') => {
  const outcomes = [...Array(wins).fill('win'), ...Array(losses).fill('loss')];
  const mixed = [];
  while (outcomes.length) mixed.push(outcomes.splice(mixed.length % 2 ? outcomes.length - 1 : 0, 1)[0]);
  return mixed.map((outcome, index) => ({ at: index, rating: 0, opponentLevel: opponent, outcome, event }));
};

describe('棋力カルテ', () => {
  it('勝ち負けは新しいほど重く、大会は軽く、申告・測定の記録は数えない', () => {
    const results = resultsFromHistory([
      { opponentLevel: null, outcome: 'measure' },
      { opponentLevel: 10, outcome: 'win', event: 'free' },
      { opponentLevel: 12, outcome: 'loss', event: 'ryuo' },
      { opponentLevel: 11, outcome: 'draw', event: 'free' },
    ]);
    expect(results.map(({ opponent, score }) => [opponent, score])).toEqual([[10, 1], [12, 0], [11, 0.5]]);
    expect(results[2].weight).toBe(1);
    expect(results[1].weight).toBeCloseTo(0.95 * 0.7, 6);
    expect(results[0].weight).toBeCloseTo(0.95 ** 2, 6);
  });

  it('Lv20と五分の実績が多い人は、Lv20と出て幅が狭い。材料がなければ広い', () => {
    const record = estimateProfile({ history: history(20, 10, 10) });
    expect(record.level).toBeGreaterThan(19);
    expect(record.level).toBeLessThan(21);
    expect(record.spread).toBeLessThan(2);
    expect(record.enough).toBe(true);
    const nothing = estimateProfile({});
    expect(nothing.spread).toBeGreaterThan(8);
    expect(nothing.enough).toBe(false);
    expect(estimateProfile({ history: history(5, 2, 1) }).enough).toBe(PROFILE_MIN_RESULTS <= 3);
  });

  it('テストが外れていても、勝ち負けが増えると勝ち負けに寄る(個人のずれ)', () => {
    // テストではLv26と出たが、実際はLv20と五分。
    const profile = recordSkillTest(createSkillProfile(), { level: 26, spread: 1.5 });
    const testOnly = estimateProfile({ profile });
    expect(testOnly.level).toBeGreaterThan(24);
    // テストの幅に個人のずれを足すので、テストだけなら幅は個人のずれより広い。
    expect(testOnly.spread).toBeGreaterThan(TEST_PERSONAL_SD * 0.8);
    const few = estimateProfile({ profile, history: history(20, 2, 2) });
    const many = estimateProfile({ profile, history: history(20, 12, 12) });
    expect(few.level).toBeLessThan(testOnly.level);
    expect(Math.abs(many.level - 20)).toBeLessThan(Math.abs(few.level - 20));
    expect(Math.abs(many.level - 20)).toBeLessThan(1.5);
  });

  it('テスト・場面採点・申告の幅をそれぞれ足せる。幅の外の勝ち負けで外へ出られる', () => {
    let profile = setProfileBand(createSkillProfile(), [16, 24]);
    expect(estimateProfile({ profile }).level).toBeCloseTo(20, 0);
    const content = contentFromInsight([{ summary: null }, { summary: { content: null } }, { summary: { content: { level: 18, spread: 2 } } }]);
    expect(content).toEqual([{ level: 18, spread: 2 }]);
    const withContent = estimateProfile({ profile, content });
    expect(withContent.level).toBeLessThan(20);
    expect(withContent.sources).toMatchObject({ content: 1, band: true });
    // 「9級〜1級」の札でも、アマ二段に勝ち続ければ外へ出る。
    const strong = estimateProfile({ profile: setProfileBand(createSkillProfile(), [16, 24]), history: history(29, 6, 0) });
    expect(strong.level).toBeGreaterThan(26);
    expect(CONTENT_PERSONAL_SD).toBeGreaterThan(0);
  });

  it('1Lvの重さを勝ち負けから学ぶ(差の大きい相手に勝ち負けがはっきり分かれる人は、重い)', () => {
    // Lv18には全勝、Lv22には全敗: 4Lvで勝ち負けがはっきり分かれる。
    const steep = estimateProfile({ history: [...history(18, 8, 0), ...history(22, 0, 8)] });
    // Lv14〜26のどこでも勝ったり負けたり: なだらか。
    const flat = estimateProfile({ history: [...history(14, 5, 3), ...history(26, 3, 5)] });
    expect(steep.slope).toBeGreaterThan(flat.slope);
    expect(steep.level).toBeGreaterThan(19);
    expect(steep.level).toBeLessThan(21);
  });

  it('テストは新しいものほど重く、最近の回数だけ残す。保存して読み直せる', () => {
    expect(poolEstimates([{ level: 10, spread: 2 }, { level: 20, spread: 2 }], 1.3).level).toBeGreaterThan(15);
    let profile = createSkillProfile();
    for (let index = 0; index < PROFILE_TESTS + 2; index += 1) profile = recordSkillTest(profile, { level: 10 + index, spread: 2, at: index });
    expect(profile.tests).toHaveLength(PROFILE_TESTS);
    const games = Array.from({ length: PROFILE_CONTENT_GAMES + 3 }, () => ({ summary: { content: { level: 12, spread: 4 } } }));
    expect(contentFromInsight(games)).toHaveLength(PROFILE_CONTENT_GAMES);
    expect(recordSkillTest(profile, { level: Number.NaN, spread: 1 })).toBe(profile);
    const storage = memoryStorage();
    saveSkillProfile(storage, setProfileBand(profile, [10, 15]));
    expect(loadSkillProfile(storage)).toEqual({ ...profile, band: [10, 15] });
    storage.setItem(SKILL_PROFILE_KEY, '{"tests":[{"level":"x"}],"band":[3]}');
    expect(loadSkillProfile(storage)).toEqual(createSkillProfile());
  });
});
