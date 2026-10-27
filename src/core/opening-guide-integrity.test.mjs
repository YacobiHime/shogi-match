// 本番と同じデータ(エディターの保存を読んだ定義)で、定跡補助を通しで確かめる(docs/opening-guide-integrity-design.mdの6章)。
// エディターの保存は、環境変数を立ててからモジュールを読むと使われる。vitestはテストのファイルごとにモジュールを読み直すので、
// ほかのテスト(組み込みの定義のまま)には影響しない。
import { beforeAll, describe, expect, it } from 'vitest';
import { appendUsiMove, createGameRecord, enumerateLegalMoves } from '../game-state';

process.env.OPENING_GUIDE_EDITOR_OVERRIDES = '1';

/** @type {typeof import('./opening-audit.mjs')} */
let audit;
/** @type {typeof import('./opening-guide.mjs')} */
let guide;

beforeAll(async () => {
  guide = await import('./opening-guide.mjs');
  audit = await import('./opening-audit.mjs');
});

function newGame() {
  const record = createGameRecord();
  return {
    sfen: () => record.position.sfen,
    legalMoves: () => enumerateLegalMoves(record.position).map(({ usi }) => usi),
    play: (/** @type {string} */ usi) => appendUsiMove(record, usi),
  };
}

const describeName = (/** @type {{ kind: string, definition: { id: string, label: string } }} */ { kind, definition }) => (
  `${kind}:${definition.id}(${definition.label})`);

describe('定跡補助の監査(本番と同じデータ)', () => {
  it('エディターの保存を読んでいる', () => {
    const anaguma = guide.OPENING_CASTLES.find(({ id }) => id === 'ibisha-anaguma');
    // 居飛車穴熊の完成形は、手順どおり7七角(7七桂ではない)。
    expect(guide.openingCompletionVariants(anaguma).flat()).toContainEqual(['7g', 'B']);
    expect(guide.openingCompletionVariants(anaguma).flat()).not.toContainEqual(['7g', 'N']);
  });

  it('カードで使う定義は、手順の最後の形が完成形に合い、手順に指せない手がない', () => {
    const problems = audit.catalogDefinitions().flatMap((entry) => {
      const misses = audit.completionMismatches(entry.definition, entry.kind);
      const blocked = audit.blockedPlanSteps(entry.definition, entry.kind);
      return misses.length || blocked.length ? [{ name: describeName(entry), misses, blocked }] : [];
    });
    expect(problems).toEqual([]);
  });

  it('作戦カードの戦法と囲いの組は、すべて駒ごとに合わせて組める', () => {
    expect(audit.incompatiblePairs()).toEqual([]);
  });

  it('作戦カードのすべての組で、案内は合わせた手順の駒だけを動かす(先手・後手)', () => {
    const offPlan = [];
    for (const pair of audit.catalogPairs()) {
      const { castleId } = pair;
      // 振り飛車用の囲いだけのカードは、対局中に先に飛車の振り先を選ぶ。ここでは四間飛車にする。
      const strategyId = pair.strategyId
        || (guide.openingDefinitionRookStyle(castleId, 'castle') === 'ranging' ? 'shiken' : '');
      const ranging = guide.openingDefinitionRookStyle(strategyId, 'strategy') === 'ranging'
        || guide.openingDefinitionRookStyle(castleId, 'castle') === 'ranging';
      for (const color of /** @type {const} */ (['black', 'white'])) {
        const result = audit.simulateOpeningGuide({
          strategyId,
          castleId,
          color,
          opponentMoves: ranging ? [...audit.AUDIT_OPPONENTS.static] : [...audit.AUDIT_OPPONENTS.ranging],
          game: newGame(),
        });
        if (result.offPlan.length) offPlan.push({ pair: `${strategyId}+${castleId}`, color, moves: result.offPlan });
      }
    }
    expect(offPlan).toEqual([]);
  }, 120_000);
});
