// 回戦の中継ボード(docs/tournament-relay-design.mdの18章)。分身が出る竜王戦の期で、「観戦する」を押すと、
// 分身の対局と、同じ回戦のほかの対局が、トーナメント表の上で同時に進んでいく。札には、何手目・形勢のバー・視聴者数。
// 進み方は、中継の棋譜の筋書き(relay-game.mjsのrelayPlan。勝ち負けと展開は自動対局の記録のまま)から決める。
// エンジンは使わない(何局も同時に作れないため)。中継で棋譜を作った局は、その棋譜の手数と形勢を使う。画面に依存しない。

import { playSpectatorGame } from './ryuo.mjs';
import { ryuoRelayGames } from './relay-games.mjs';
import { blackWinRate, relayPlan, relaySeed, relayTarget } from './relay-game.mjs';
import { relayAudience } from './relay-commentary.mjs';

/** 1秒(ボードの時間)あたりに進む手の数の幅。局ごとに種で決め、終わる時刻をばらつかせる。 */
export const LIVE_PACE = Object.freeze({ min: 0.55, max: 0.85 });

/**
 * 期の次の一局の表(中継の項目の鍵のtag・札のid・回戦・段階)。番勝負は、表の代わりに局の番号。
 * @param {any} season ryuo.mjsの期
 * @returns {{ tag: string, bracket: any, nodeId: string, round: number | null, stage: 'group' | 'final' | 'title' } | null}
 */
export function pendingTable(season) {
  const pending = season?.pending;
  if (!pending) return null;
  if (pending.kind === 'game') {
    const block = pending.blockIndex ?? 0;
    const tag = pending.phase === 'revival' ? `revival-${block}` : pending.phase === 'main' ? 'main' : 'ranking';
    const bracket = pending.phase === 'revival' ? season.revival?.[block] : pending.phase === 'main' ? season.main : season.ranking;
    const node = bracket?.nodes?.[pending.nodeId];
    return { tag, bracket: bracket ?? null, nodeId: String(pending.nodeId), round: node?.round ?? null, stage: pending.phase === 'main' ? 'final' : 'group' };
  }
  const series = pending.kind === 'playoff' ? season.playoff : season.finals;
  return { tag: pending.kind, bracket: null, nodeId: String(series?.games?.length ?? 0), round: null, stage: 'title' };
}

/**
 * 観戦の期で、まだ見ていない同じ回戦のほかの試合のid。ふつうの期と同じく、同じ回戦は分身の局より先に決まっているが、
 * 観戦では中継ボードで見るまで結果を伏せる。
 * @param {any} season
 * @returns {Set<string>}
 */
export function hiddenRoundIds(season) {
  const table = season?.spectator ? pendingTable(season) : null;
  if (!table?.bracket || table.round === null) return new Set();
  return new Set(Object.values(table.bracket.nodes ?? {})
    .filter((node) => node.round === table.round && node.id !== table.nodeId && node.winner)
    .map((node) => String(node.id)));
}

/**
 * 回戦の中継ボードに並べる対局。分身の次の一局を決めた写しの期(provisional。本番の期は、ボードを見終えてから進める)から、
 * 分身の対局を先頭に、同じ回戦のほかの対局を並べる。
 * @param {any} season 観戦の期(書き換えない)
 * @param {{ oshiId?: string | null }} [options]
 */
export function liveRound(season, { oshiId = null } = {}) {
  const table = season?.spectator ? pendingTable(season) : null;
  if (!table) return null;
  const provisional = playSpectatorGame(JSON.parse(JSON.stringify(season)));
  const keyOf = (id) => `ryuo:${season.id}:${table.tag}:${id}`;
  const avatarKey = keyOf(table.nodeId);
  const hidden = new Set([...hiddenRoundIds(season)].map(keyOf));
  const list = ryuoRelayGames(provisional, { oshiId });
  const avatar = list.find((entry) => entry.key === avatarKey) ?? null;
  const others = list.filter((entry) => hidden.has(entry.key));
  return { table, avatarKey, avatar, specs: avatar ? [avatar, ...others] : others };
}

/**
 * ボードの1局。recordは、中継で作った棋譜(relay-store.mjsの形)。あれば、その手数と形勢を使う。
 * @param {any} spec 中継の項目
 * @param {{ entries: { eval: number }[] } | null} [record]
 */
export function liveGame(spec, record = null) {
  const plan = relayPlan(spec);
  const pace = LIVE_PACE.min + ((relaySeed(`${spec.key}:pace`) % 1000) / 1000) * (LIVE_PACE.max - LIVE_PACE.min);
  const end = record?.entries?.length || plan.end;
  return { key: spec.key, spec, plan, pace, end, record: record ?? null };
}

/**
 * ボードの時刻(秒)での、その局のようす。blackPercentは先手の勝率(%)、viewersは視聴者数。
 * @param {ReturnType<typeof liveGame>} game
 * @param {number} seconds
 */
export function liveState(game, seconds) {
  const ply = Math.max(0, Math.min(game.end, Math.floor(seconds * game.pace)));
  const done = ply >= game.end;
  const cp = game.record ? (ply ? game.record.entries[ply - 1].eval : 40) : relayTarget(game.plan, ply);
  return {
    ply,
    done,
    blackPercent: Math.round(blackWinRate(cp) * 100),
    viewers: relayAudience(game.spec, ply),
    winner: done ? game.spec.winner : null,
  };
}

/** すべての局が終わる時刻(秒)。 */
export function liveDuration(games) {
  return games.reduce((longest, game) => Math.max(longest, game.end / game.pace), 0);
}

/** 視聴者数の短い書き方(1.2万・8,250)。 */
export function viewersText(count) {
  if (count >= 10000) return `${(count / 10000).toFixed(1).replace(/\.0$/, '')}万`;
  return count.toLocaleString('ja-JP');
}

/**
 * トーナメント表(ryuo-stages.mjsのmatchBracket)の結果を伏せる・見せる。hiddenの試合は勝者を伏せ、その勝者が入る次の試合の札は
 * 「○回戦の勝者」にする。revealの試合(ボードで終局した対局。値は勝者のid)は、その勝者を見せる。
 * @param {any} view
 * @param {{ hidden?: Set<string>, reveal?: Map<string, string> }} [options]
 */
export function maskBracketView(view, { hidden = new Set(), reveal = new Map() } = {}) {
  if (!view?.matches || (!hidden.size && !reveal.size)) return view;
  const byId = new Map(view.matches.map((match) => [String(match.id), match]));
  const roundLabel = (round) => view.rounds?.[round - 1]?.label ?? '';
  const matches = view.matches.map((match) => {
    const id = String(match.id);
    let next = match;
    if (reveal.has(id)) next = { ...next, winner: next.top?.pid === reveal.get(id) ? 'top' : 'bottom' };
    else if (hidden.has(id)) next = { ...next, winner: null, how: '' };
    for (const side of /** @type {const} */ (['top', 'bottom'])) {
      const from = next[side]?.from ? String(next[side].from) : null;
      if (!from || !hidden.has(from) || reveal.has(from) || !next[side].pid) continue;
      const child = byId.get(from);
      next = {
        ...next,
        [side]: { pid: null, name: '', dan: '', label: '', story: null, you: false, from, placeholder: `${roundLabel(child?.round ?? 1)}の勝者` },
      };
    }
    return next;
  });
  return { ...view, matches };
}
