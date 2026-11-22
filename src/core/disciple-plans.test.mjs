// 本番と同じデータ(定跡エディターの上書きデータを含む)で確かめる。環境変数を立ててからモジュールを読む
// (opening-guide-integrity.test.mjsと同じ。vitestはファイルごとに読み直すので、ほかのテストには影響しない)。
import { beforeAll, describe, expect, it } from 'vitest';

process.env.OPENING_GUIDE_EDITOR_OVERRIDES = '1';

/** @type {typeof import('./opening-guide.mjs')} */
let production;
/** @type {typeof import('./disciple-plans.mjs')} */
let plans;
/** @type {typeof import('../game-state')['appendUsiMove']} */
let appendUsiMove;
/** @type {typeof import('../game-state')['createGameRecord']} */
let createGameRecord;
/** @type {typeof import('../game-state')['enumerateLegalMoves']} */
let enumerateLegalMoves;
// 盤のモジュールも、環境変数を立てたあとに読む(静的に読むと、定跡補助が上書きデータなしで先に読まれる)。
beforeAll(async () => {
  ({ appendUsiMove, createGameRecord, enumerateLegalMoves } = await import('../game-state'));
  production = await import('./opening-guide.mjs');
  plans = await import('./disciple-plans.mjs');
});

// 相手は駒組みだけをする(居飛車・振り飛車)。手順を使い切ったら、飛車を1升ずつ行き来して手を渡す。
const OPPONENTS = {
  static: ['3c3d', '8c8d', '8d8e', '7a6b', '5a4b', '4b3b', '6a5b', '1c1d', '9c9d', '1d1e', '9d9e', '7c7d', '6c6d'],
  ranging: ['3c3d', '8b4b', '5a6b', '6b7b', '7a8b', '6a5b', '1c1d', '9c9d', '4c4d', '3a3b'],
};
const PASSES = { static: ['8b7b', '7b8b'], ranging: ['4b4c', '4c4b'] };

/** 作戦の囲いを順に(続きは戦法を済んだものとして)、案内の手だけで完成まで指す。完成した段の手数を返す。 */
function playChain(guide, { strategyId, castles, color, opponent = 'static', maxPlies = 160 }) {
  const convert = color === 'white' ? guide.mirrorUsiMove : (move) => move;
  const script = OPPONENTS[opponent].map(convert);
  const recaptures = ['3a2b', '3c2b'].map(convert);
  const passes = PASSES[opponent].map(convert);
  const record = createGameRecord();
  const history = [];
  const parity = color === 'black' ? 0 : 1;
  const done = [];
  let stage = 0;
  let scriptIndex = 0;
  for (let ply = 0; ply < maxPlies; ply += 1) {
    const legalMoves = enumerateLegalMoves(record.position).map(({ usi }) => usi);
    let usi;
    if (ply % 2 === parity) {
      const options = {
        strategyId: stage === 0 ? strategyId : '', castleId: castles[stage] ?? '', color,
        playedMoves: history.filter((_, index) => index % 2 === parity),
        opponentMoves: history.filter((_, index) => index % 2 !== parity),
        moveHistory: history, legalMoves, currentSfen: record.position.sfen,
        completedPhases: stage > 0 ? { strategy: true } : {},
      };
      if (guide.isOpeningPlanComplete(options)) {
        done.push(castles[stage] || strategyId);
        stage += 1;
        if (stage >= Math.max(1, castles.length)) return { done, complete: true };
        ply -= 1;
        continue;
      }
      if (guide.openingPlanInterruption(options)) return { done, complete: false };
      usi = guide.nextOpeningPlanMove(options)?.usi;
      if (!usi) return { done, complete: false };
    } else {
      const last = history.at(-1) ?? '';
      const recapture = last.endsWith('+') && recaptures.find((move) => move.slice(2, 4) === last.slice(2, 4) && legalMoves.includes(move));
      while (!recapture && scriptIndex < script.length && !legalMoves.includes(script[scriptIndex])) scriptIndex += 1;
      usi = recapture || script[scriptIndex++] || passes.find((move) => legalMoves.includes(move));
    }
    if (!usi || !appendUsiMove(record, usi)) return { done, complete: false };
    history.push(usi);
  }
  return { done, complete: false };
}

describe('師匠の1年の作戦の目録(35章)', () => {
  it('どのカードも、指せる手番では案内の手だけで完成まで指せる', { timeout: 120000 }, () => {
    const failed = [];
    for (const card of plans.PLAN_CARDS) {
      for (const color of card.colors) {
        const result = playChain(production, {
          strategyId: card.strategyId, castles: card.castleId ? [card.castleId] : [], color,
          opponent: card.vs === 'ranging' ? 'ranging' : 'static',
        });
        if (!result.complete) failed.push(`${card.id}:${color}`);
      }
    }
    expect(failed).toEqual([]);
  });

  it('囲いの続きは、もとの囲いの完成のあと同じ対局のまま完成まで組める', { timeout: 120000 }, () => {
    const chains = [
      ['shiken', ['half-mino', 'mino', 'high-mino', 'silver-crown'], 'static'],
      ['shiken', ['half-mino', 'half-silver-crown'], 'static'],
      ['shiken', ['mino', 'diamond-mino'], 'static'],
      ['shiken', ['high-mino', 'four-mino'], 'static'],
      ['ibisha', ['funagakoi', 'left-mino', 'ibisha-silver-crown'], 'ranging'],
      ['ibisha', ['yagura', 'hishi-yagura'], 'static'],
      ['ibisha', ['yagura', 'gintachi-yagura'], 'static'],
      ['ibisha', ['yagura', 'yagura-anaguma'], 'static'],
      ['ibisha', ['ibisha-anaguma', 'silver-crown-anaguma'], 'ranging'],
    ];
    // 試す組が、続きの表のすべての辺を通ること。
    const edges = new Set(chains.flatMap(([, castles]) => castles.slice(1).map((castle, index) => `${castles[index]}>${castle}`)));
    for (const [from, list] of Object.entries(plans.CASTLE_CHAINS)) for (const to of list) expect(edges.has(`${from}>${to}`)).toBe(true);
    for (const [strategyId, castles, opponent] of chains) {
      for (const color of ['black', 'white']) {
        expect(playChain(production, { strategyId, castles, color, opponent }), `${castles.join('>')}:${color}`).toMatchObject({ complete: true });
      }
    }
  });

  it('戦い方と相手の飛車の向きでカードを選び、力戦なら定跡を持たない', () => {
    expect(plans.disciplePlanCard({ style: 'lead', opponentRook: 'static' })?.id).toBe('hayaguri-gin+yagura');
    expect(plans.disciplePlanCard({ style: 'grit', opponentRook: 'ranging' })?.id).toBe('ibisha+ibisha-anaguma');
    expect(plans.disciplePlanCard({ style: 'study', opponentRook: 'static' })?.id).toBe('kakugawari-koshikake-gin+');
    expect(plans.disciplePlanCard({ style: 'lead', opening: 'avoid', opponentRook: 'ranging' })?.id).toBe('ibisha+ibisha-anaguma');
    expect(plans.disciplePlanCard({ style: 'lead', opening: 'wild' })).toBeNull();
  });

  it('相手の作戦は、得意戦法の戦法と囲いのまま。相手が居飛車でも舟囲いに決め打ちしない', () => {
    expect(plans.opponentPlanSpec({ strategy: 'shiken', castle: 'mino', rook: 'ranging' }, 15)).toMatchObject({ strategyId: 'shiken', castleId: 'mino', chain: [] });
    expect(plans.opponentPlanSpec({ strategy: 'ibisha', castle: 'yagura', rook: 'static' }, 35)).toMatchObject({ castleId: 'yagura', chain: ['hishi-yagura'] });
    expect(plans.opponentPlanSpec({ strategy: 'kakugawari-koshikake-gin', castle: '', rook: 'static' }, 30)).toMatchObject({ castleId: '', chain: [] });
    expect(plans.opponentPlanSpec(null, 20)).toBeNull();
  });

  it('作戦の能力値が高いほど、囲いの続きを組む', () => {
    expect(plans.chainSteps(15)).toBe(0);
    expect(plans.planSpec(plans.planCard('shiken+mino'), { steps: plans.chainSteps(25) })).toMatchObject({ chain: ['high-mino'] });
    expect(plans.planSpec(plans.planCard('shiken+mino'), { steps: plans.chainSteps(40) })).toMatchObject({ chain: ['high-mino', 'silver-crown'], window: { ply: 70 } });
    expect(plans.planSpec(plans.planCard('kakugawari-koshikake-gin+'), { steps: 2 })).toMatchObject({ chain: [], window: null });
  });

  it('戦型の適性は、相手の飛車の向きと自分の作戦で決まる', () => {
    expect(plans.battleKey(plans.planCard('shiken+mino'), 'ranging')).toBe('aifuri');
    expect(plans.battleKey(plans.planCard('ibisha+ibisha-anaguma'), 'ranging')).toBe('ranging');
    expect(plans.battleKey(plans.planCard('kakugawari-koshikake-gin+'), 'static')).toBe('kakugawari');
    expect(plans.battleKey(plans.planCard('ibisha+yagura'), 'static')).toBe('static');
  });

  it('作戦を進めると、完成した囲いから続きの囲いへ移り、続きも組める', () => {
    const record = createGameRecord();
    const history = [];
    let plan = plans.planSpec(plans.planCard('shiken+mino'), { steps: 2 });
    const script = OPPONENTS.static;
    let scriptIndex = 0;
    const seen = [];
    for (let ply = 0; ply < 90; ply += 1) {
      const legalMoves = enumerateLegalMoves(record.position).map(({ usi }) => usi);
      let usi;
      if (ply % 2 === 0) {
        const ownMoves = history.filter((_, index) => index % 2 === 0);
        const opponentMoves = history.filter((_, index) => index % 2 === 1);
        plan = plans.advancePlan(plan, { color: 'black', ownMoves, opponentMoves, sfen: record.position.sfen });
        if (!seen.includes(plan.castleId)) seen.push(plan.castleId);
        usi = production.nextOpeningPlanMove({
          strategyId: plan.strategyId, castleId: plan.castleId, color: 'black', playedMoves: ownMoves, opponentMoves,
          moveHistory: history, legalMoves, currentSfen: record.position.sfen,
        })?.usi;
        if (!usi) break;
      } else {
        while (scriptIndex < script.length && !legalMoves.includes(script[scriptIndex])) scriptIndex += 1;
        usi = script[scriptIndex++] ?? PASSES.static.find((move) => legalMoves.includes(move));
      }
      appendUsiMove(record, usi);
      history.push(usi);
    }
    expect(seen).toEqual(['mino', 'high-mino', 'silver-crown']);
    expect(production.isOpeningPlanComplete({
      strategyId: '', castleId: 'silver-crown', color: 'black', playedMoves: history.filter((_, index) => index % 2 === 0), currentSfen: record.position.sfen,
    })).toBe(true);
  });

  it('相手の飛車の向きが分かったら、囲いをまだ動かしていなければ合う囲いに組み替える', () => {
    // 居飛車の構えに見えた相手が振り飛車(4二飛)だったら、矢倉の早繰り銀を左美濃へ。
    const plan = plans.planSpec(plans.planCard('hayaguri-gin+yagura'), { steps: 0 });
    const record = createGameRecord();
    const moves = ['7g7f', '3c3d', '2g2f', '8b4b'];
    moves.forEach((usi) => appendUsiMove(record, usi));
    const next = plans.advancePlan(plan, { color: 'black', ownMoves: ['7g7f', '2g2f'], opponentMoves: ['3c3d', '8b4b'], sfen: record.position.sfen });
    expect(next).toMatchObject({ castleId: 'left-mino', adapted: true });
  });

  it('作戦帳: はじめの2枚と熟練度、合う作戦の選び方、記録', () => {
    const ranks = { static: 'C', ranging: 'E', kakugawari: 'B' };
    const startingMastery = (rank) => ({ B: 30, C: 20, E: 10 }[rank] ?? 20);
    const book = plans.createPlanBook({ style: 'lead', aptitudes: ranks, startingMastery });
    // 早繰り銀の戦い方(先行)は原始棒銀を少し高く。
    expect(book.cards).toEqual({
      'shiken+mino': { mastery: 20, games: 0, wins: 0 },
      'bougin+kanigakoi': { mastery: 30, games: 0, wins: 0 },
    });
    // 相手が振り飛車なら、知っている作戦のうち合う作戦(四間飛車＋本美濃)だけ。
    expect(plans.bookChoices(book, { opponentRook: 'ranging' }).map((card) => card.id)).toEqual(['shiken+mino']);
    expect(plans.chooseBookCard(book, { opponentRook: 'ranging', random: () => 0.99 })?.id).toBe('shiken+mino');
    // 相手の得意を外すときは、相手と違う飛車の向きの作戦を先に見る(居飛車の相手には振り飛車。合う作戦がなければそのまま)。
    expect(plans.chooseBookCard(book, { opponentRook: 'static', opening: 'avoid', random: () => 0.99 })?.id).toBe('shiken+mino');
    expect(plans.chooseBookCard(book, { opponentRook: 'ranging', opening: 'avoid', random: () => 0.99 })?.id).toBe('shiken+mino');
    expect(plans.chooseBookCard(book, { opening: 'wild' })).toBeNull();
    expect(plans.chooseBookCard(book, { cardId: 'shiken+mino', random: () => 0.99 })?.id).toBe('shiken+mino');
    // 知らない作戦は選べない。
    expect(plans.chooseBookCard(book, { cardId: 'ibisha+yagura', random: () => 0 })?.id).not.toBe('ibisha+yagura');
    expect(plans.notePlanGames(book, 'shiken+mino', { games: 2, wins: 1, gain: 2 })).toBe(2);
    expect(book.cards['shiken+mino']).toEqual({ mastery: 22, games: 2, wins: 1 });
    expect(plans.bookHeadline(book)).toMatchObject({ id: 'shiken+mino', value: 22, count: 2 });
    // 前の版の熟練度は、その戦い方の作戦へ写す。
    const legacy = plans.createPlanBook({ style: 'counter', aptitudes: ranks, legacy: { yagura: 55 }, legacyOpening: 'yagura', startingMastery });
    expect(legacy.cards['ibisha+yagura'].mastery).toBe(55);
    expect(legacy.cards['ibisha+left-mino'].mastery).toBe(55);
  });

  it('組み替えは、作戦帳で知っている囲いの中から選ぶ', () => {
    const plan = plans.planSpec(plans.planCard('hayaguri-gin+yagura'), { steps: 0, castles: ['yagura', 'kanigakoi'] });
    const record = createGameRecord();
    ['7g7f', '3c3d', '2g2f', '8b4b'].forEach((usi) => appendUsiMove(record, usi));
    const next = plans.advancePlan(plan, { color: 'black', ownMoves: ['7g7f', '2g2f'], opponentMoves: ['3c3d', '8b4b'], sfen: record.position.sfen });
    // 左美濃を知らないので、矢倉のまま。
    expect(next).toMatchObject({ castleId: 'yagura', adapted: true });
  });

  it('覚え方: 候補は負けた相手の作戦を先に、足りない向きを1つ、あとは低い段から。能力値で段の上限', () => {
    const startingMastery = () => 20;
    const book = plans.createPlanBook({ style: 'lead', aptitudes: {}, startingMastery });
    expect(plans.learnableTier(15)).toBe('basic');
    expect(plans.learnableTier(25)).toBe('advanced');
    expect(plans.learnableTier(40)).toBe('special');
    const low = plans.learnChoices(book, { planLevel: 15, random: () => 0.5 });
    expect(low).toHaveLength(3);
    for (const id of low) expect(['start', 'basic']).toContain(plans.planCard(id).tier);
    // 負けた相手の作戦(居飛車＋矢倉)は先頭に。知っている作戦は入れない。
    expect(plans.noteSeen(book, { strategy: 'yagura-strategy', castle: 'yagura' })).toBe('ibisha+yagura');
    expect(plans.noteSeen(book, { strategy: 'shiken', castle: 'mino' })).toBe('');
    expect(plans.learnChoices(book, { planLevel: 15, random: () => 0.5 })[0]).toBe('ibisha+yagura');
    // 候補を出し、1つ覚える。
    const offer = plans.offerLearn(book, { planLevel: 15, random: () => 0.5 });
    expect(offer).toHaveLength(3);
    expect(plans.learnCard(book, offer[0])).toBeTruthy();
    expect(book.cards[offer[0]]).toEqual({ mastery: plans.LEARNED_MASTERY, games: 0, wins: 0 });
    expect(book.seen).not.toContain(offer[0]);
    expect(plans.learnCard(book, offer[0])).toBe('');
    // 奇襲は研究会で教わるだけ(覚える候補には出ない)。
    expect(plans.learnChoices(book, { planLevel: 49 }).some((id) => plans.planCard(id).tier === 'surprise')).toBe(false);
    expect(plans.planCard(plans.surpriseToLearn(book, () => 0)).tier).toBe('surprise');
  });

  it('囲いの続きは、その作戦で指した局数で1段ずつ開き、作戦の能力値と小さいほうまで組む', () => {
    const book = plans.createPlanBook({ style: 'counter', aptitudes: {}, startingMastery: () => 20 });
    expect(plans.unlockChain(book, 'shiken+mino')).toBe('');
    plans.notePlanGames(book, 'shiken+mino', { games: plans.CHAIN_GAMES });
    expect(plans.unlockChain(book, 'shiken+mino')).toBe('高美濃');
    expect(plans.unlockChain(book, 'shiken+mino')).toBe('');
    expect(plans.bookChainSteps(book, 'shiken+mino', 40)).toBe(1);
    expect(plans.bookChainSteps(book, 'shiken+mino', 10)).toBe(0);
    const row = plans.bookRows(book).find((item) => item.id === 'shiken+mino');
    expect(row).toMatchObject({ chainNow: ['高美濃'], chainNext: { label: expect.any(String), left: plans.CHAIN_GAMES } });
  });
});
