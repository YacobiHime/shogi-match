import { describe, expect, it } from 'vitest';
import {
  RIVAL_DISCIPLE, RIVAL_EDGE, createRival, kenshukaiRatingFor, noteRivalGame, rivalLevel, shoreikaiRankFor, shoreikaiRatingFor, syncRival,
} from './disciple-rival.mjs';
import { createDiscipleRun, chooseAction, isBigEvent, opponentLevel, pendingIsRival, playEvent, rivalView, shoreikaiOpponentLevel, turnKind } from './disciple-run.mjs';
import { pendingScene, queueScene, resolveScene } from './disciple-events.mjs';
import { RANK_RATINGS } from './shoreikai.mjs';

const afterExam = (seed = 7, id = 'minato') => {
  let s = createDiscipleRun({ seed, discipleId: id });
  while (turnKind(s) === 'free') s = chooseAction(s, { kind: 'rest' }).state;
  return playEvent(s, {}).state;
};

describe('羽音の一門(30-1)', () => {
  it('研修会に入ると、羽音の弟子が同じクラスの同期として入る', () => {
    const s = afterExam();
    expect(s.rival.id).toBeTruthy();
    const member = s.kenshukai.world.members[s.rival.id];
    expect(member).toMatchObject({ name: RIVAL_DISCIPLE.name, peer: true, rival: true });
    expect(rivalView(s)).toMatchObject({ name: RIVAL_DISCIPLE.name, wins: 0, losses: 0 });
  });

  it('強さは弟子のLvに差を足したもの。研修会・奨励会の物差しで逆に引ける', () => {
    const rival = createRival();
    expect(rival.edge).toBe(RIVAL_EDGE.start);
    expect(rivalLevel(30, rival)).toBeCloseTo(30 + RIVAL_EDGE.start, 5);
    expect(rivalLevel(49, { edge: 2 })).toBe(49);
    expect(opponentLevel({ rivalLevel: 33.3, cls: 0, rating: 0 }, 0)).toBe(33.3);
    expect(shoreikaiOpponentLevel({ rating: shoreikaiRatingFor(44) })).toBeCloseTo(44, 0);
    expect(shoreikaiRankFor(RANK_RATINGS[3] + 1)).toBe(3);
    expect(kenshukaiRatingFor(28)).toBeGreaterThan(kenshukaiRatingFor(20));
  });

  it('例会ごとに差が揺れ、世界からいなくなったら先に進んだ知らせ', () => {
    const rival = { ...createRival(), id: 'k1' };
    const run = { world: { members: { k1: { id: 'k1', rating: 0 } } } };
    const rng = { next: () => 0.9 };
    expect(syncRival(rival, run, { level: 30, ageYears: 13, kind: 'kenshukai', rng })).toBe('');
    expect(rival.edge).not.toBe(RIVAL_EDGE.start);
    expect(run.world.members.k1.rivalLevel).toBeCloseTo(30 + rival.edge, 0);
    expect(syncRival(rival, { world: { members: {} } }, { level: 30, ageYears: 13, kind: 'kenshukai', rng })).toContain('奨励会');
    expect(rival.ahead).toBe(true);
    expect(syncRival(rival, { world: { members: {} } }, { level: 30, ageYears: 13, kind: 'shoreikai', rng })).toContain('四段');
    expect(rival.gone).toBe('pro');
    noteRivalGame(rival, true);
    noteRivalGame(rival, false);
    expect([rival.wins, rival.losses, rival.met, rival.last]).toEqual([1, 1, 2, 'loss']);
  });

  it('羽音の弟子との局は大一番で、何度も当たる', () => {
    let s = afterExam(11, 'tsumugi');
    let met = 0;
    let bigWhenRival = true;
    for (let i = 0; i < 120 && !s.end && !s.shoreikai; i += 1) {
      const kind = turnKind(s);
      if (kind === 'reikai' && pendingIsRival(s)) bigWhenRival = bigWhenRival && isBigEvent(s);
      if (kind === 'free') s = chooseAction(s, { kind: s.stamina < 45 ? 'rest' : 'train', id: 'jissen' }).state;
      else if (kind === 'words') s = { ...s, words: null };
      else s = playEvent(s, {}).state;
      met = s.rival.met;
    }
    expect(met).toBeGreaterThan(1);
    expect(bigWhenRival).toBe(true);
  });
});

describe('羽音の一門の場面(30-2)', () => {
  it('はじめて当たった日の場面に、弟子と羽音の弟子の名前と結果が入る', () => {
    const s = { ...afterExam(), sceneQueue: [] };
    s.rival = { ...s.rival, last: 'win' };
    const next = structuredClone(s);
    queueScene(next, 'rival-first');
    const pending = pendingScene(next);
    expect(pending.vars).toMatchObject({ rival: RIVAL_DISCIPLE.name, result: `${s.name}の勝ち` });
  });

  it('勝った日・負けた日の場面は台本を替え、2回まで', () => {
    let s = structuredClone({ ...afterExam(), sceneQueue: [] });
    const scripts = [];
    for (let i = 0; i < 3; i += 1) {
      const queued = queueScene(s, 'rival-lose');
      if (!queued) break;
      scripts.push(pendingScene(s).script);
      s = structuredClone(resolveScene(s, 'rematch').state);
    }
    expect(scripts).toEqual(['disciple-rival-lose-1', 'disciple-rival-lose-2']);
  });
});
