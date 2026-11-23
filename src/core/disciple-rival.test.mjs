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

describe('羽音の弟子の作戦帳(35-14)', () => {
  it('はじめは居飛車党の2枚で、例会の日ごとに研究し、強さで開く段の作戦を順に覚える', async () => {
    const { RIVAL_GROWTH, RIVAL_START_CARDS, createRivalBook, growRivalBook } = await import('./disciple-rival.mjs');
    expect(Object.keys(createRival().book.cards)).toEqual(Object.keys(RIVAL_START_CARDS));
    const rival = createRival();
    const learned = [];
    for (let day = 0; day < RIVAL_GROWTH.learnEvery * 3; day += 1) {
      const name = growRivalBook(rival, { level: 15 });
      if (name) learned.push(name);
    }
    // Lv20より下は基本の段まで。角換わり腰掛け銀(応用)はまだ覚えない。
    expect(learned).toHaveLength(3);
    expect(rival.book.cards['ibisha+ibisha-anaguma']).toBeTruthy();
    expect(rival.book.cards['kakugawari-koshikake-gin+']).toBeUndefined();
    const strong = { ...createRival(), book: createRivalBook() };
    for (let day = 0; day < RIVAL_GROWTH.learnEvery * 3; day += 1) growRivalBook(strong, { level: 30 });
    expect(strong.book.cards['kakugawari-koshikake-gin+']).toBeTruthy();
    // 研究で、最後の作戦の熟練度が上がる。
    expect(Math.max(...Object.values(strong.book.cards).map((entry) => entry.mastery))).toBeGreaterThan(20);
  });

  it('前の版の記録(作戦帳なし)でも、はじめの形から育てられる', async () => {
    const { growRivalBook, rivalBook } = await import('./disciple-rival.mjs');
    const old = { ...createRival() };
    delete old.book;
    expect(Object.keys(rivalBook(old).cards).length).toBe(2);
    growRivalBook(old, { level: 20 });
    expect(old.book.days).toBe(1);
  });

  it('羽音の弟子との局を作戦帳に数え、負けた局は悔しさで多く伸びる', async () => {
    const { RIVAL_GROWTH, noteRivalBookGame } = await import('./disciple-rival.mjs');
    const rival = createRival();
    const before = rival.book.cards['ibisha+yagura'].mastery;
    noteRivalBookGame(rival, 'ibisha+yagura', { win: false });
    expect(rival.book.cards['ibisha+yagura']).toMatchObject({ games: 1, wins: 0, mastery: before + RIVAL_GROWTH.game + RIVAL_GROWTH.loss });
    noteRivalBookGame(rival, 'ibisha+yagura', { win: true });
    expect(rival.book.cards['ibisha+yagura']).toMatchObject({ games: 2, wins: 1 });
    expect(noteRivalBookGame(rival, 'shiken+mino', { win: true })).toEqual([]);
  });

  it('羽音の弟子と当たる日は、観戦でも結果だけでも、羽音の弟子の作戦帳の作戦で指す', async () => {
    const { watchSpec } = await import('./disciple-run.mjs');
    const { RIVAL_START_CARDS } = await import('./disciple-rival.mjs');
    let s = afterExam();
    let found = null;
    for (let i = 0; i < 200 && !s.end && !s.shoreikai && !found; i += 1) {
      const kind = turnKind(s);
      if (kind === 'reikai' && pendingIsRival(s)) { found = s; break; }
      if (kind === 'free') s = chooseAction(s, { kind: s.stamina < 45 ? 'rest' : 'train', id: 'jissen' }).state;
      else if (kind === 'words') s = { ...s, words: null };
      else s = playEvent(s, {}).state;
    }
    expect(found).toBeTruthy();
    const made = watchSpec(found, {});
    const other = made.side === 'black' ? 'white' : 'black';
    const plan = made.spec.plans[other];
    const cardId = `${plan.strategyId}+${plan.castleId}`;
    expect(Object.keys(found.rival.book?.cards ?? RIVAL_START_CARDS)).toContain(cardId);
    expect(made.spec[other].reason.mastery).toBe((found.rival.book?.cards ?? {})[cardId]?.mastery ?? RIVAL_START_CARDS[cardId]);
    expect(made.plans.opponent).toBeTruthy();
    // 結果だけ見ても、同じ作戦が羽音の弟子の作戦帳に数えられる。
    const before = found.rival.book?.cards?.[cardId]?.games ?? 0;
    const after = playEvent(found, {}).state;
    expect(after.rival.book.cards[cardId].games).toBeGreaterThan(before);
    expect(after.rival.book.days).toBe((found.rival.book?.days ?? 0) + 1);
    expect(rivalView(after).plan).toBeTruthy();
  });
});
