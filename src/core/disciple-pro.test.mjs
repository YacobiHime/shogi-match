import { describe, expect, it } from 'vitest';
import { DEBUT_RATING, RIVAL_DEBUT_RATING, debutDisciples, debutRating, noteMasterGame, ongaeshiLine, pendingDebuts, pendingRivalDebut } from './disciple-pro.mjs';
import { rivalFate } from './disciple-rival.mjs';
import { createRoster, seasonEntry } from './ryuo-roster.mjs';
import { createDiscipleRun } from './disciple-run.mjs';
import { joinIchimon } from './disciple-ichimon.mjs';

const ended = (seed, kind, stats = { reading: 1200, plan: 1150, steady: 1100, mate: 1150 }) => ({
  ...createDiscipleRun({ seed, discipleId: 'tsumugi' }), stats, end: { kind, best: '奨励会四段', rank: 'S', turn: 160 },
});
const ichimonOf = (...states) => states.reduce((ichimon, state) => joinIchimon(ichimon, state).ichimon, { version: 1, members: [] });

describe('四段になった弟子のデビュー(31-1)', () => {
  it('四段の弟子だけを、新四段として名簿の6組・C級2組に入れ、2回は入れない', () => {
    const roster = createRoster({ seed: 3 });
    const ichimon = ichimonOf(ended(1, 'pro'), ended(2, 'retired'));
    expect(pendingDebuts(ichimon)).toHaveLength(1);
    const result = debutDisciples(roster, ichimon);
    expect(result.debuts).toEqual([ended(1, 'pro').name]);
    const id = result.ichimon.members.find((member) => member.kind === 'pro').rosterId;
    const member = result.roster.players[id];
    expect(member).toMatchObject({ name: ended(1, 'pro').name, group: 6, dan: '四段', kind: 'pro', disciple: { ichimonId: '1' } });
    if (result.roster.junni) expect(result.roster.junni.classes.C2).toContain(id);
    expect(roster.players[id]).toBeUndefined();
    expect(seasonEntry(result.roster, id).disciple).toMatchObject({ ichimonId: '1' });
    const again = debutDisciples(result.roster, result.ichimon);
    expect(again.debuts).toEqual([]);
    expect(debutDisciples(null, ichimon).debuts).toEqual([]);
  });

  it('何人デビューしても、弟子はみんなC級2組', () => {
    const roster = createRoster({ seed: 5 });
    const result = debutDisciples(roster, ichimonOf(ended(1, 'pro'), ended(2, 'pro'), ended(3, 'pro')));
    expect(result.debuts).toHaveLength(3);
    if (result.roster.junni) {
      for (const member of result.ichimon.members) expect(result.roster.junni.classes.C2, member.name).toContain(member.rosterId);
    }
  });

  it('能力の高い弟子ほど、少し上のレーティングから始める', () => {
    expect(debutRating({ stats: { reading: 1200, plan: 1200, steady: 1200, mate: 1200 } })).toBe(DEBUT_RATING.base + DEBUT_RATING.bonus);
    expect(debutRating({ stats: { reading: 800, plan: 800, steady: 800, mate: 800 } })).toBe(DEBUT_RATING.base);
  });
});

describe('恩返し(31-2)', () => {
  it('相手が弟子なら、勝ち負けで恩返しか師匠の壁の一言', () => {
    expect(ongaeshiLine({ name: '朝比奈 紬', disciple: { ichimonId: '1' } }, false)).toContain('恩返し');
    expect(ongaeshiLine({ name: '朝比奈 紬', disciple: { ichimonId: '1' } }, true)).toContain('師匠の壁');
    expect(ongaeshiLine({ name: 'ほかの棋士' }, false)).toBe('');
  });

  it('師匠との対戦を数え、弟子が勝てば恩返し済み', () => {
    let ichimon = ichimonOf(ended(1, 'pro'));
    ichimon = noteMasterGame(ichimon, '1', true);
    expect(ichimon.members[0]).toMatchObject({ vsMaster: { wins: 0, losses: 1 }, ongaeshi: false });
    ichimon = noteMasterGame(ichimon, '1', false);
    expect(ichimon.members[0]).toMatchObject({ vsMaster: { wins: 1, losses: 1 }, ongaeshi: true });
  });
});

describe('羽音の弟子の名簿入り(32章)', () => {
  const withRival = (seed, kind, rival) => ({ ...ended(seed, kind), rival: { id: 'r1', name: '氷室 凛', gone: '', ...rival }, shoreikai: { world: { members: { r1: { rank: 7 } } } } });

  it('先に四段になったか、三段まで来ていれば四段', () => {
    expect(rivalFate(withRival(1, 'pro', { gone: 'pro' }))).toBe('pro');
    expect(rivalFate({ ...withRival(1, 'pro', {}), shoreikai: { world: { members: { r1: { rank: 9 } } } } })).toBe('pro');
    expect(rivalFate(withRival(1, 'retired', {}))).toBe('');
    expect(rivalFate(ended(1, 'pro'))).toBe('');
  });

  it('羽音の弟子は一門で1人だけ、弟子の印なしで名簿に入る', () => {
    const roster = createRoster({ seed: 4 });
    const ichimon = ichimonOf(withRival(1, 'pro', { gone: 'pro' }), withRival(2, 'pro', { gone: 'pro' }));
    expect(pendingRivalDebut(ichimon)?.rivalName).toBe('氷室 凛');
    const result = debutDisciples(roster, ichimon);
    expect(result.debuts).toContain('氷室 凛');
    const rivalId = result.ichimon.rival.rosterId;
    expect(result.roster.players[rivalId]).toMatchObject({ name: '氷室 凛', group: 6, dan: '四段', rating: RIVAL_DEBUT_RATING, rivalDisciple: { master: '羽音' } });
    expect(result.roster.players[rivalId].disciple).toBeUndefined();
    expect(seasonEntry(result.roster, rivalId).rivalDisciple).toMatchObject({ master: '羽音' });
    expect(Object.values(result.roster.players).filter((player) => player.name === '氷室 凛')).toHaveLength(1);
    expect(pendingRivalDebut(result.ichimon)).toBeNull();
    expect(debutDisciples(result.roster, result.ichimon).debuts).toEqual([]);
  });
});
