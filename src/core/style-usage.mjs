/**
 * やこびノートの「戦型」の項目の表(docs/player-world-note-design.mdの8-3)。
 * レーティングの記録の使用状況(player-rating.mjsのusage。対局ごとに戦型・戦法・囲いの名前の勝ち負けを数えたもの)から、
 * 使用率と勝率の表を作る。新しい記録は足さない(数え方は今までの記録のまま)。
 *
 * - 戦法の記録(usage.rook・usage.opponentRook)には、振り飛車の戦法の名前だけが入る(居飛車の対局は名前なし)。
 *   なので、居飛車の対局数は「全部の対局 − 振り飛車の戦法の対局」で数える。
 * - 戦型(相居飛車・対抗形・相振り飛車)は対局ごとの組み合わせを記録していないので、
 *   相振り飛車の戦型の記録(usage.battle)と、両者の振り飛車の対局数から割り出す(合わない記録は0〜対局数に収める)。
 */

/** 振り飛車の戦法の名前(戦型検出のbt_match2のうち、飛車を振るもの)。 */
export const RANGING_ROOK_NAMES = Object.freeze(['四間飛車', '三間飛車', '向かい飛車', '中飛車']);
const RANGING = new Set(RANGING_ROOK_NAMES);
/** 相振り飛車に数える戦型の名前。 */
const DOUBLE_RANGING_BATTLES = new Set(['相振り飛車', '相中飛車']);
/** 「得意」「にがて」の札を付けるのに要る対局数。 */
export const STYLE_TAG_MIN_GAMES = 3;

/**
 * @typedef {{ wins: number, losses: number, draws: number }} Tally
 * @typedef {{ games?: number, wins?: number, losses?: number, draws?: number, usage?: { [category: string]: { [name: string]: Tally } } }} RatingLike
 */

const empty = () => ({ wins: 0, losses: 0, draws: 0 });
const gamesOf = (/** @type {Tally} */ tally) => tally.wins + tally.losses + tally.draws;
const clamp = (/** @type {number} */ value, /** @type {number} */ low, /** @type {number} */ high) => Math.min(high, Math.max(low, value));

/** 表のある分類の勝ち負けを、名前の条件で合わせる。 */
function sumTally(/** @type {{ [name: string]: Tally } | undefined} */ table, /** @type {(name: string) => boolean} */ pick) {
  const total = empty();
  for (const [name, tally] of Object.entries(table ?? {})) {
    if (!pick(name)) continue;
    total.wins += tally.wins ?? 0;
    total.losses += tally.losses ?? 0;
    total.draws += tally.draws ?? 0;
  }
  return total;
}

/**
 * 1行の形(局数・使用率%・勝率)。
 * @param {string} id
 * @param {string} label
 * @param {Tally} tally
 * @param {number} total 全部の対局数
 */
function row(id, label, tally, total) {
  const games = gamesOf(tally);
  return {
    id,
    label,
    games,
    wins: tally.wins,
    losses: tally.losses,
    draws: tally.draws,
    share: total ? Math.round((games / total) * 100) : 0,
    winRate: games ? tally.wins / games : null,
  };
}

/** 全部の対局の勝ち負け。 */
function totalTally(/** @type {RatingLike} */ state) {
  return { wins: state.wins ?? 0, losses: state.losses ?? 0, draws: state.draws ?? 0 };
}

/** 全部から一部を引く(0より小さくしない)。 */
function minus(/** @type {Tally} */ all, /** @type {Tally} */ part) {
  return { wins: Math.max(0, all.wins - part.wins), losses: Math.max(0, all.losses - part.losses), draws: Math.max(0, all.draws - part.draws) };
}

/**
 * 居飛車と振り飛車の割合(自分か相手)。
 * @param {RatingLike} state
 * @param {'own' | 'opponent'} side
 * @returns {{ id: 'static' | 'ranging', label: string, games: number, wins: number, losses: number, draws: number, share: number, winRate: number | null }[]}
 */
export function rookSplit(state, side = 'own') {
  const total = state.games ?? 0;
  const ranging = sumTally(state.usage?.[side === 'own' ? 'rook' : 'opponentRook'], (name) => RANGING.has(name));
  const rangingRow = row('ranging', '振り飛車', ranging, total);
  const staticRow = row('static', '居飛車', minus(totalTally(state), ranging), total);
  // 割合の合計を100にそろえる(四捨五入のずれは居飛車の側で吸う)。
  if (total) staticRow.share = 100 - rangingRow.share;
  return [/** @type {any} */ (staticRow), /** @type {any} */ (rangingRow)];
}

/**
 * 戦型の割合(相居飛車・対抗形・相振り飛車)。記録から割り出す(このファイルの最初の説明)。
 * @param {RatingLike} state
 */
export function battleSplit(state) {
  const total = state.games ?? 0;
  const own = sumTally(state.usage?.rook, (name) => RANGING.has(name));
  const opponent = sumTally(state.usage?.opponentRook, (name) => RANGING.has(name));
  const recorded = sumTally(state.usage?.battle, (name) => DOUBLE_RANGING_BATTLES.has(name));
  // 相振り飛車は、両方が振り飛車の対局より多くはならない。
  const limit = Math.min(gamesOf(own), gamesOf(opponent));
  const scale = gamesOf(recorded) > limit && gamesOf(recorded) ? limit / gamesOf(recorded) : 1;
  const double = {
    wins: Math.floor(recorded.wins * scale), losses: Math.floor(recorded.losses * scale), draws: Math.floor(recorded.draws * scale),
  };
  // 対抗形は、どちらか一方だけが振り飛車の対局。
  const opposed = minus({
    wins: own.wins + opponent.wins, losses: own.losses + opponent.losses, draws: own.draws + opponent.draws,
  }, { wins: double.wins * 2, losses: double.losses * 2, draws: double.draws * 2 });
  const opposedFit = {
    wins: clamp(opposed.wins, 0, Math.max(0, (state.wins ?? 0) - double.wins)),
    losses: clamp(opposed.losses, 0, Math.max(0, (state.losses ?? 0) - double.losses)),
    draws: clamp(opposed.draws, 0, Math.max(0, (state.draws ?? 0) - double.draws)),
  };
  const both = minus(minus(totalTally(state), double), opposedFit);
  return [
    row('static', '相居飛車', both, total),
    row('opposed', '対抗形', opposedFit, total),
    row('ranging', '相振り飛車', double, total),
  ];
}

/**
 * 分類の表(多い順に5つまでと、残りの数)。「得意」「にがて」の札も付ける(3局以上で、いちばん勝率の高いものが5割以上なら得意、5割未満はにがて)。
 * @param {RatingLike} state
 * @param {string} category USAGE_CATEGORIESのどれか
 * @param {{ limit?: number }} [options]
 */
export function usageTable(state, category, { limit = 5 } = {}) {
  const total = state.games ?? 0;
  const all = Object.entries(state.usage?.[category] ?? {})
    .map(([name, tally]) => ({ ...row(name, name, tally, total), tag: /** @type {'' | 'best' | 'weak'} */ ('') }))
    .filter(({ games }) => games > 0)
    .sort((a, b) => b.games - a.games || b.wins - a.wins || a.label.localeCompare(b.label, 'ja'));
  const tagged = all.filter(({ games }) => games >= STYLE_TAG_MIN_GAMES);
  const best = tagged.reduce((top, item) => (!top || (item.winRate ?? 0) > (top.winRate ?? 0) ? item : top), /** @type {typeof all[number] | null} */ (null));
  if (best && (best.winRate ?? 0) >= 0.5) best.tag = 'best';
  for (const item of tagged) if (item.tag !== 'best' && (item.winRate ?? 0) < 0.5) item.tag = 'weak';
  const rows = all.slice(0, limit);
  const rest = all.slice(limit);
  return { rows, rest: { count: rest.length, games: rest.reduce((sum, item) => sum + item.games, 0) } };
}

/**
 * 組んだ戦法の表(コレクションで組んだ回数から。my-abilities.mjsのmyRepertoireのusageを、opening-usage.mjsのusageRowsで並べたもの)。
 * 勝ち負けは記録していないので、使用率と組んだ回数だけ。
 * @param {{ id: string, label: string, rook: string, share: number }[]} openings 使用率の高い順
 * @param {number} games 組んだ戦法の回数(合わせて)
 * @param {{ limit?: number }} [options]
 */
export function repertoireTable(openings, games, { limit = 5 } = {}) {
  const all = [...openings].sort((a, b) => b.share - a.share).map((item) => ({
    id: item.id, label: item.label, rook: item.rook, share: item.share, games: Math.round((item.share / 100) * games),
  }));
  const rest = all.slice(limit);
  return { rows: all.slice(0, limit), rest: { count: rest.length, share: rest.reduce((sum, item) => sum + item.share, 0) } };
}
