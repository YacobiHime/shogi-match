import { describe, expect, it } from 'vitest';
import { USER_ID, createSeason, describeSeason, recordUserGame, scaleById, seedHalf } from './ryuo.mjs';
import { applySeason, createCareer, nextEntry } from './ryuo-career.mjs';
import { applySeasonToRoster, createRoster, rosterTarget, selectParticipants, withStoryMembers } from './ryuo-roster.mjs';
import { createRng } from './ryuo-random.mjs';
import { JUNNI_SIZES } from './ryuo-league.mjs';
import { applyCharacter } from './player-character.mjs';
import { CPU_STRENGTH_PRESETS, getStrengthSearchSettings } from './strength-settings.mjs';
import {
  HANANE,
  HANANE_GRUDGE_RATING,
  HANANE_LINES,
  STORY_PEOPLE,
  YOSHIHIKO,
  hananeAfterLine,
  hananeBeforeLine,
  hananeCoachIntro,
  hananeRating,
  storyMemberId,
} from './ryuo-story.mjs';

const settings = (overrides = {}) => ({ difficulty: 9, scale: 3, revival: true, ...overrides });
const members = (roster) => Object.values(roster.players);
const groupOf = (roster, group) => members(roster).filter((member) => member.group === group && member.id !== roster.holder);
const story = (roster, id) => roster.players[storyMemberId(roster, id)];

describe('物語の人物を名簿に入れる', () => {
  it('羽音はプレイヤーの組の新四段(C級2組)、善彦は1組・A級の名人', () => {
    const roster = createRoster({ seed: 3 });
    const hanane = story(roster, HANANE);
    expect(hanane).toMatchObject({ name: '天鷺羽音', kind: 'pro', group: 6, dan: '四段', junni: 'C2', age: 17, rating: hananeRating(6) });
    expect(hanane.character).toEqual(STORY_PEOPLE[HANANE].character);
    const father = story(roster, YOSHIHIKO);
    expect(father).toMatchObject({ name: '天鷺善彦', group: 1, dan: '九段', junni: 'A' });
    expect(roster.titles.meijin).toBe(father.id);
    expect(father.titleCounts.meijin).toBe(STORY_PEOPLE[YOSHIHIKO].titleCounts.meijin);
    // 組の人数と順位戦の定員は、今までどおり。
    for (const group of [1, 2, 3, 4, 5]) expect(groupOf(roster, group)).toHaveLength(rosterTarget(group, 6, true));
    for (const [cls, size] of Object.entries(JUNNI_SIZES)) {
      expect(members(roster).filter((member) => member.kind === 'pro' && member.junni === cls)).toHaveLength(size);
    }
  });

  it('プレイヤーが上の組から始めるなら、羽音もその組(段位は竜王戦の昇段規定)', () => {
    const roster = createRoster({ seed: 4, userGroup: 2 });
    expect(story(roster, HANANE)).toMatchObject({ group: 2, dan: '六段', rating: hananeRating(2) });
    expect(groupOf(roster, 2)).toHaveLength(rosterTarget(2, 2, true));
  });

  it('保存してあった名簿には、タイトルを書き換えずに加える。2度は加えない', () => {
    const roster = createRoster({ seed: 5 });
    for (const id of [storyMemberId(roster, HANANE), storyMemberId(roster, YOSHIHIKO)]) delete roster.players[id];
    const meijin = Object.values(roster.players).find((member) => member.junni === 'A').id;
    roster.titles.meijin = meijin;
    const next = withStoryMembers(roster, { userGroup: 5 });
    expect(next).not.toBe(roster);
    expect(story(next, HANANE).group).toBe(5);
    expect(story(next, YOSHIHIKO).junni).toBe('A');
    expect(next.titles.meijin).toBe(meijin);
    expect(withStoryMembers(next, { userGroup: 5 })).toBe(next);
  });

  it('羽音は、組にいれば毎期必ず出場する', () => {
    const roster = createRoster({ seed: 6 });
    for (let seed = 1; seed <= 20; seed += 1) {
      expect(selectParticipants(roster, 6, 15, createRng(seed))).toContain(storyMemberId(roster, HANANE));
    }
  });
});

describe('ランキング戦の山', () => {
  it('羽音とプレイヤーを、トーナメント表の反対の半分に置く(組の決勝で当たる)', () => {
    for (let seed = 1; seed <= 12; seed += 1) {
      const season = createSeason({ no: 1, mode: 'challenge', group: 6, settings: settings(), userLevel: 20, seed });
      const ids = season.ranking.ids;
      const rival = ids.find((pid) => season.players[pid].story === HANANE);
      expect(rival).toBeTruthy();
      expect(ids.indexOf(rival)).toBeLessThan(2);
      expect(seedHalf(ids.indexOf(rival) + 1, ids.length)).not.toBe(seedHalf(ids.indexOf(USER_ID) + 1, ids.length));
    }
  });
});

describe('本気と、期をまたいだ変化', () => {
  /** 1期を最後まで進めて、キャリアと名簿に反映する。policyはプレイヤーの対局の結果。 */
  function runSeason(career, roster, seed, policy) {
    let season = createSeason({ ...nextEntry(career), settings: settings(), userLevel: 20, career, roster, seed });
    for (let guard = 0; season.phase !== 'done' && guard < 400; guard += 1) season = recordUserGame(season, policy(season));
    const applied = applySeason(career, season);
    return { season, career: applied.career, roster: applySeasonToRoster(roster, season, { userGroup: applied.career.group, promote: scaleById(season.settings.scale).promote }) };
  }

  it('羽音に勝つと、次の期からプレイヤーと指すときだけ強くなる。個性は変わらず、引退しない', () => {
    const roster = createRoster({ seed: 8, userGroup: 6 });
    const hananeId = storyMemberId(roster, HANANE);
    // 組の決勝で当たるので、勝ち進んで羽音にも勝つ。
    const result = runSeason(createCareer(), roster, 8, () => 'win');
    const met = result.season.userGames.some((game) => game.opponentId === hananeId);
    expect(met).toBe(true);
    expect(result.roster.vsUser[hananeId].wins).toBe(1);
    expect(result.roster.players[hananeId].character).toEqual(STORY_PEOPLE[HANANE].character);
    const next = createSeason({ ...nextEntry(result.career), settings: settings(), userLevel: 20, career: result.career, roster: result.roster, seed: 9 });
    const player = next.players[hananeId];
    if (player) {
      const plain = createSeason({ ...nextEntry(result.career), settings: settings(), userLevel: 20, career: result.career, roster: { ...result.roster, vsUser: {} }, seed: 9 }).players[hananeId];
      expect(player.rating).toBe(plain.rating);
      expect(player.level).toBeGreaterThanOrEqual(plain.level);
    }
    // 何期たっても名簿に残る。
    let state = result;
    for (let seed = 20; seed < 26; seed += 1) state = runSeason(state.career, state.roster, seed, () => 'loss');
    expect(storyMemberId(state.roster, HANANE)).toBe(hananeId);
    expect(storyMemberId(state.roster, YOSHIHIKO)).toBeTruthy();
    expect(state.roster.players[hananeId].age).toBe(17 + 7);
  });

  it('上乗せは+40で、重ねない', () => {
    expect(HANANE_GRUDGE_RATING).toBe(40);
  });
});

describe('序盤から終盤へ強くなる(late-bloom)', () => {
  const preset = CPU_STRENGTH_PRESETS.find((entry) => entry.level === 25);
  const base = getStrengthSearchSettings(preset.value);
  const character = { attack: 0, traits: [{ id: 'late-bloom', degree: 2 }] };
  const at = (phase) => applyCharacter(base, character, { phase, kingDanger: false, attackChance: false, opponentRook: 'static' }, { skill: preset.skill });

  it('序盤は並みより少し甘く、中盤・終盤と鋭くなる。読みも深くなる', () => {
    const opening = at('opening');
    const middle = at('middle');
    const ending = at('ending');
    expect(opening.bestMoveRate).toBeLessThanOrEqual(base.bestMoveRate);
    expect(middle.bestMoveRate).toBeGreaterThan(opening.bestMoveRate);
    expect(ending.bestMoveRate).toBeGreaterThan(middle.bestMoveRate);
    expect(ending.nodes).toBeGreaterThan(middle.nodes);
    expect(middle.nodes).toBeGreaterThan(opening.nodes);
  });

  it('乱数の棋士には付かない', () => {
    const roster = createRoster({ seed: 10 });
    const random = members(roster).filter((member) => !member.story);
    expect(random.some((member) => member.character.traits.some(({ id }) => id === 'late-bloom'))).toBe(false);
  });
});

describe('羽音の台詞', () => {
  it('初めて・勝ち越し・許さないリストのあとで、対局前の一言が変わる', () => {
    expect(hananeBeforeLine(null)).toBe(HANANE_LINES.first[0]);
    expect(HANANE_LINES.againAhead).toContain(hananeBeforeLine({ wins: 0, losses: 1 }));
    expect(HANANE_LINES.againGrudge).toContain(hananeBeforeLine({ wins: 1, losses: 2 }));
  });

  it('初めて負けたときだけ「絶対に許さないリスト」。2回目からは別の一言', () => {
    expect(hananeAfterLine({ userWon: true, vsUser: { wins: 0, losses: 3 } })).toBe(HANANE_LINES.firstLoss[0]);
    expect(HANANE_LINES.lost).toContain(hananeAfterLine({ userWon: true, vsUser: { wins: 1, losses: 3 } }));
    expect(HANANE_LINES.won).toContain(hananeAfterLine({ userWon: false, vsUser: null }));
  });

  it('同じ場面の候補を、対局の回数で順に回す', () => {
    const a = hananeAfterLine({ userWon: false, vsUser: { wins: 0, losses: 0 } });
    const b = hananeAfterLine({ userWon: false, vsUser: { wins: 0, losses: 1 } });
    expect(a).not.toBe(b);
  });

  it('台詞は感嘆符を使わない(冷静な人物)', () => {
    for (const line of Object.values(HANANE_LINES).flat()) expect(line).not.toMatch(/[!！]/);
  });

  it('やこび姫の紹介は、攻略の手がかり(序盤)を言う', () => {
    expect(hananeCoachIntro(null)).toMatch(/序盤/);
    expect(hananeCoachIntro({ wins: 1, losses: 0 })).toMatch(/本気/);
  });
});

describe('竜王戦の画面に出す、羽音の一言', () => {
  /** 組の決勝で羽音と当たる直前の期(勝ち進む)。当たらなければnull。 */
  function seasonBeforeRival(seed) {
    let season = createSeason({ no: 1, mode: 'challenge', group: 6, settings: settings(), userLevel: 20, seed, roster: createRoster({ seed }) });
    for (let guard = 0; season.pending && guard < 20; guard += 1) {
      if (season.players[season.pending.opponentId]?.story === HANANE) return season;
      if (season.pending.phase !== 'ranking') return null;
      season = recordUserGame(season, 'win');
    }
    return null;
  }

  it('対局前は羽音の一言とやこび姫の紹介、勝ったあとは「絶対に許さないリスト」(注目)', () => {
    const season = [1, 2, 3, 4, 5, 6, 7, 8].map(seasonBeforeRival).find(Boolean);
    expect(season).toBeTruthy();
    const before = describeSeason(season);
    expect(before.pending.rival).toMatchObject({ story: HANANE, line: HANANE_LINES.first[0], grudge: false });
    expect(before.pending.rival.coach).toMatch(/序盤/);
    expect(before.rivalId).toBe(season.pending.opponentId);
    const won = describeSeason(recordUserGame(season, 'win'));
    expect(won.lastGame).toMatchObject({ rivalLine: HANANE_LINES.firstLoss[0], rivalNotice: true });
    const lost = describeSeason(recordUserGame(season, 'loss'));
    expect(lost.lastGame.rivalNotice).toBe(false);
    expect(HANANE_LINES.won).toContain(lost.lastGame.rivalLine);
  });

  it('自動対局では、プレイヤーと同じ表の羽音だけが勝ち上がりやすい(多くの期で組の決勝で当たる)', () => {
    const met = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter((seed) => seasonBeforeRival(seed)).length;
    expect(met).toBeGreaterThanOrEqual(5);
  });
});
