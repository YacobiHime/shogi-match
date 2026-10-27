// 定跡補助の監査(docs/opening-guide-integrity-design.mdの6章)。本番と同じデータ(エディターの保存を読んだ定義)で、
// 完成形と手順が合うか、戦法と囲いの組が合うか、案内が手順の駒だけを動かすかを調べる。テストと開発用のスクリプトから使う。
// 画面とエンジンに依存しない(合法手と指し手の反映は、呼び出し側が渡す)。

import {
  OPENING_CASTLES,
  OPENING_STRATEGIES,
  composeOpeningPlan,
  mirrorUsiMove,
  openingDefinitionRookStyle,
  openingCompletionVariants,
  openingPlanCandidates,
  openingPlanCompatibility,
  playPlanSteps,
  resolveOpeningPlanDefinitions,
  trackPlanPieces,
} from './opening-guide.mjs';
import { ALL_OPENING_PLANS } from './opening-catalog.mjs';

/**
 * 1つの定義の手順を初めの配置から指した最後の形と、完成形の食い違い。完成形のどれか1つが合えば空。
 * 合わないときは、いちばん近い完成形の、合わないマス(期待する駒と、最後の形でそこにいる駒)。
 * @param {any} definition
 * @returns {{ square: string, expected: string, actual: string | null }[]}
 */
export function completionMismatches(definition, kind = 'strategy') {
  const variants = openingCompletionVariants(definition);
  if (!variants.length) return [];
  const moves = definition.blackMoves ?? [];
  // 振り飛車用の囲いは、先に飛車を振ってから組む(AGENTS.md)。手順に飛車を振る手がなければ、四間飛車に振ってから指す。
  const swing = kind === 'castle' && openingDefinitionRookStyle(definition.id, 'castle') === 'ranging'
    && !moves.some((move) => /^2h[3-9]h$/.test(move)) ? ['2h6h'] : [];
  const { board } = playPlanSteps([...swing, ...moves].map((usi) => ({ usi })));
  let best = null;
  for (const squares of variants) {
    const misses = squares
      .filter(([square, kind]) => board.get(square) !== kind)
      .map(([square, kind]) => ({ square, expected: kind, actual: board.get(square) ?? null }));
    if (!best || misses.length < best.length) best = misses;
  }
  return best ?? [];
}

/**
 * 1つの定義の手順を、初めの配置から自分の駒だけで指して、指せない手(動かす駒がいない・自分の駒にふさがれている)。
 * 振り飛車用の囲いは、手順に飛車を振る手がなければ四間飛車に振ってから指す。
 * @param {any} definition
 * @param {'strategy' | 'castle'} kind
 */
export function blockedPlanSteps(definition, kind = 'strategy') {
  const moves = definition.blackMoves ?? [];
  const swing = kind === 'castle' && openingDefinitionRookStyle(definition.id, 'castle') === 'ranging'
    && !moves.some((move) => /^2h[3-9]h$/.test(move)) ? ['2h6h'] : [];
  return playPlanSteps([...swing, ...moves].map((usi) => ({ usi }))).blocked;
}

/** 作戦カードで使う戦法・囲いの定義(重ねずに)。 */
export function catalogDefinitions() {
  const strategies = new Set();
  const castles = new Set();
  for (const plan of ALL_OPENING_PLANS) {
    if (plan.strategyId) strategies.add(plan.strategyId);
    for (const castleId of plan.castles) castles.add(castleId);
  }
  const usedStrategies = OPENING_STRATEGIES.filter(({ id }) => strategies.has(id));
  return [
    ...usedStrategies.map((definition) => ({ kind: 'strategy', definition })),
    // 戦法に組み込みの囲い(角換わり腰掛け銀の6八玉・4八金・2九飛など)は、戦法の手順(囲いの手を含む)のあとの形で見る。
    ...usedStrategies.filter(({ integrated, integratedCastle }) => integrated && integratedCastle).map((definition) => ({
      kind: 'castle',
      definition: {
        ...definition.integratedCastle,
        blackMoves: composeOpeningPlan({ strategy: definition, castle: definition.integratedCastle }).steps.map(({ usi }) => usi),
      },
    })),
    ...OPENING_CASTLES.filter(({ id }) => castles.has(id)).map((definition) => ({ kind: 'castle', definition })),
  ];
}

/** 作戦カードの戦法と囲いの組(囲いのないカードは囲いなし)。 */
export function catalogPairs() {
  return ALL_OPENING_PLANS.flatMap((plan) => (plan.castles.length ? plan.castles : ['']).map((castleId) => ({
    planId: plan.id, strategyId: plan.strategyId, castleId,
  })));
}

/** 作戦カードの組のうち、駒ごとに合わせても組めない組と、その理由。 */
export function incompatiblePairs() {
  return catalogPairs().flatMap((pair) => {
    const { compatible, conflicts } = openingPlanCompatibility(pair.strategyId, pair.castleId);
    return compatible ? [] : [{ ...pair, conflicts }];
  });
}

/** 合わせた手順で動かす駒(初めのマスで呼ぶ)と、駒の種類ごとの行き先(先手基準)。 */
function planPieces(strategyId, castleId) {
  const { strategy, castle } = resolveOpeningPlanDefinitions(strategyId, castleId);
  const { steps } = composeOpeningPlan({ strategy, castle });
  const tracked = trackPlanPieces(steps.map(({ usi }) => usi));
  const ids = new Set(tracked.map(({ piece }) => piece).filter(Boolean));
  // 角換わりの手順(@kakugawari)は、7六歩・角交換と、待つ間の2六歩・2五歩・7八金・7七角・8八銀を案内する。
  if (steps.some(({ usi }) => usi === '@kakugawari')) for (const id of ['7g', '8h', '2g', '6i', '7i']) ids.add(id);
  const destinations = new Set(tracked
    .filter(({ usi, kind }) => kind && /^[1-9][a-i][1-9][a-i]/.test(usi))
    .map(({ usi, kind }) => `${kind}:${usi.slice(2, 4)}`));
  return { ids, destinations };
}

const INITIAL_IDS = (() => {
  const files = [9, 8, 7, 6, 5, 4, 3, 2, 1];
  const back = ['L', 'N', 'S', 'G', 'K', 'G', 'S', 'N', 'L'];
  return [
    ...files.map((file, index) => [`${file}i`, back[index]]),
    ['8h', 'B'], ['2h', 'R'],
    ...files.map((file) => [`${file}g`, 'P']),
  ];
})();

/**
 * 案内を、決まった相手の手で通しで指して、手順にない駒を動かす案内を探す。
 * game: { sfen(): string, legalMoves(): string[], play(usi): boolean }。初めは平手。
 * opponentMoves: 相手の手(相手が後手のときの表記)。指せない手は飛ばし、尽きたら端歩か最初の合法手。
 * @param {{
 *   strategyId: string, castleId: string, color?: 'black' | 'white', opponentMoves: string[], plies?: number,
 *   game: { sfen(): string, legalMoves(): string[], play(usi: string): boolean },
 * }} input
 * @returns {{ offPlan: { ply: number, usi: string }[], played: string[] }}
 */
export function simulateOpeningGuide({ strategyId, castleId, color = 'black', opponentMoves, plies = 60, game }) {
  const convert = color === 'white' ? mirrorUsiMove : (/** @type {string} */ move) => move;
  const opponentSequence = color === 'white' ? opponentMoves.map(mirrorUsiMove) : opponentMoves;
  const { ids, destinations } = planPieces(strategyId, castleId);
  // 盤の自分の駒が、初めにどのマスにいた駒か(手番側から見た先手基準のマスで呼ぶ)。
  const owner = new Map(INITIAL_IDS.map(([square, kind]) => [convert(`${square}${square}`).slice(0, 2), { id: square, kind }]));
  const played = [];
  const history = [];
  const offPlan = [];
  let opponentIndex = 0;
  for (let ply = 0; ply < plies; ply += 1) {
    const mine = (ply % 2 === 0) === (color === 'black');
    const legal = game.legalMoves();
    if (!legal.length) break;
    let usi;
    if (mine) {
      const candidates = openingPlanCandidates({
        strategyId, castleId, color, playedMoves: played, moveHistory: history, legalMoves: legal, currentSfen: game.sfen(),
      });
      if (!candidates.length) break;
      usi = candidates[0].usi;
      const piece = owner.get(usi.slice(0, 2));
      const to = convert(usi).slice(2, 4);
      if (piece && !ids.has(piece.id) && !destinations.has(`${piece.kind}:${to}`)) offPlan.push({ ply: ply + 1, usi });
      played.push(usi);
    } else {
      while (opponentIndex < opponentSequence.length && !legal.includes(opponentSequence[opponentIndex])) opponentIndex += 1;
      usi = opponentSequence[opponentIndex] ?? legal.find((move) => /^[19][a-i][19][a-i]$/.test(move)) ?? legal[0];
      opponentIndex += 1;
      // 相手に取られた自分の駒は、持ち主の表から外す。
      owner.delete(usi.slice(2, 4));
    }
    if (mine) {
      const piece = owner.get(usi.slice(0, 2));
      owner.delete(usi.slice(0, 2));
      if (piece) owner.set(usi.slice(2, 4), piece);
    }
    history.push(usi);
    if (!game.play(usi)) break;
  }
  return { offPlan, played };
}

/** 相手の手の例。相手が居飛車らしく指す手と、振り飛車らしく指す手(後手の表記)。 */
export const AUDIT_OPPONENTS = Object.freeze({
  static: Object.freeze(['3c3d', '8c8d', '8d8e', '4a3b', '6a5b', '5a4b', '7a6b', '4c4d', '3a4b', '9c9d', '1c1d', '6c6d', '7c7d', '2c2d']),
  ranging: Object.freeze(['3c3d', '4c4d', '8b4b', '5a6b', '6b7b', '7b8b', '9a9b', '3a3b', '4a5b', '6a5a', '1c1d', '9c9d', '7a7b']),
});
