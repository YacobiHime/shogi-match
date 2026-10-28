// 回戦の中継ボード(docs/tournament-relay-design.mdの18章)。分身が出る竜王戦の期で、「観戦する」を押すと、
// 分身の対局と、同じ回戦のほかの対局が、トーナメント表の上で同時に進んでいく。札には、何手目・形勢のバー・視聴者数。
// 進み方は、中継の棋譜の筋書き(relay-game.mjsのrelayPlan。勝ち負けと展開は自動対局の記録のまま)から決める。
// エンジンは使わない(何局も同時に作れないため)。中継で棋譜を作った局は、その棋譜の手数と形勢を使う。画面に依存しない。

import { playSpectatorGame } from './ryuo.mjs';
import { ryuoRelayGames } from './relay-games.mjs';
import { blackWinRate, relayPlan, relaySeed, relayTarget } from './relay-game.mjs';
import { relayAudience } from './relay-commentary.mjs';
import { stepsAfterElimination, watchSteps } from './ryuo-watch.mjs';

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
  // 終わる時刻(end / pace)を掛け戻すと、小数の誤差で1手足りないことがあるので、わずかに足してから切り捨てる。
  const ply = Math.max(0, Math.min(game.end, Math.floor(seconds * game.pace + 1e-9)));
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

/** 中継の項目の鍵(`ryuo:期:表:札`)から、表のtagと札のid。 */
export function tableOf(key) {
  const parts = String(key).split(':');
  return { tag: parts[2] ?? '', id: parts.slice(3).join(':') };
}

/** 回戦の名前(「準決勝」など)の順。n回戦が先、決勝が最後。 */
function roundOrder(name) {
  const number = /^(\d+)回戦$/.exec(name);
  if (number) return Number(number[1]);
  return { 準々決勝: 100, 準決勝: 101, 決勝: 102 }[name] ?? 50;
}

/**
 * 敗退したあとの回戦(19章)。回戦ごとの観戦(ryuo-watch.mjsのwatchSteps)と同じ並びで、ほかの組のランキング戦だけは、
 * 組をまたいで同じ名前の回戦ごとに分ける(表の上で、各組の同じ回戦が同時に進む)。番勝負は1局ずつ。
 * @param {any} season 終わった期
 * @param {{ oshiId?: string | null }} [options]
 * @returns {{ id: string, label: string, stage: string, entries: any[] }[]}
 */
export function afterWatchRounds(season, { oshiId = null } = {}) {
  const steps = stepsAfterElimination(season, watchSteps(season, { oshiId }));
  return steps.flatMap((step) => {
    if (step.stage !== 'group') return [step];
    const rounds = new Map();
    for (const entry of step.entries) {
      const name = String(entry.label).split(' ').at(-1) ?? '';
      if (!rounds.has(name)) rounds.set(name, []);
      rounds.get(name).push(entry);
    }
    return [...rounds.entries()]
      .sort(([a], [b]) => roundOrder(a) - roundOrder(b))
      .map(([name, entries]) => ({ id: `group:${name}`, label: `ほかの組 ${name}`, stage: 'group', entries }));
  });
}

/**
 * その回戦を見せる表。①(組の表。tagで選ぶ)・②決勝トーナメント・③番勝負。いちばん前の対局(注目の対局が先)の表。
 * @param {{ entries: any[] }} round
 * @returns {{ stage: 0 | 1 | 2, tag: string }}
 */
export function roundTable(round) {
  const { tag } = tableOf(round?.entries?.[0]?.key ?? '');
  if (tag === 'main') return { stage: 1, tag };
  if (tag === 'playoff' || tag === 'finals') return { stage: 2, tag };
  return { stage: 0, tag };
}

/**
 * 伏せる対局を、表ごとの札のidにまとめる。決勝トーナメントの決勝(挑戦者決定三番勝負で決まる)は、三番勝負を伏せている間は伏せる。
 * @param {any[]} entries 伏せる中継の項目
 * @param {{ mainRootId?: string | null }} [options]
 * @returns {Map<string, Set<string>>}
 */
export function hiddenTables(entries, { mainRootId = null } = {}) {
  const tables = new Map();
  const add = (tag, id) => {
    if (!tables.has(tag)) tables.set(tag, new Set());
    tables.get(tag).add(String(id));
  };
  for (const entry of entries) {
    const { tag, id } = tableOf(entry.key);
    add(tag, id);
  }
  if (mainRootId !== null && tables.has('playoff')) add('main', mainRootId);
  return tables;
}

/**
 * 番勝負の星取り(ryuo-stages.mjsのseriesView)の結果を伏せる。伏せた局から後ろは指していない形にし、勝ち数を数え直す。
 * 三番勝負の決着を伏せている間は、七番勝負(挑戦者が分かる)を出さない。
 * @param {any[]} list seriesViewの並び
 * @param {Map<string, Set<string>>} hidden 表ごとの伏せる局(局の番号は0から)
 * @param {Map<string, Set<string>>} [reveal] ボードで終局した局
 */
export function maskSeriesViews(list, hidden, reveal = new Map()) {
  if (!hidden.size) return list;
  const masked = [];
  for (const view of list) {
    const hide = hidden.get(view.key);
    const open = reveal.get(view.key) ?? new Set();
    const cut = view.games.findIndex((_, index) => hide?.has(String(index)) && !open.has(String(index)));
    if (cut < 0) {
      masked.push(view);
      continue;
    }
    if (view.key === 'finals' && masked.some((item) => item.key === 'playoff' && !item.winner)) continue;
    const games = view.games.slice(0, cut);
    const me = games.filter((game) => game.win).length;
    masked.push({ ...view, games, wins: { me, them: games.length - me }, nextNo: games.length + 1, unplayed: 0, winner: null });
  }
  return masked;
}

/**
 * トーナメント表(ryuo-stages.mjsのmatchBracket)の結果を伏せる・見せる。hiddenの試合は勝者を伏せ、その勝者が入る次の試合の札は
 * 「○回戦の勝者」にする。revealの試合(ボードで終局した対局。値は勝者のid)は、その勝者を見せる。
 * blankEntrantsなら、どの試合からも来ない札(決勝トーナメントの各組の勝者)も伏せ、枠の名前(「3組優勝」など)にする。
 * @param {any} view
 * @param {{ hidden?: Set<string>, reveal?: Map<string, string>, blankEntrants?: boolean }} [options]
 */
export function maskBracketView(view, { hidden = new Set(), reveal = new Map(), blankEntrants = false } = {}) {
  if (!view?.matches || (!hidden.size && !reveal.size && !blankEntrants)) return view;
  const byId = new Map(view.matches.map((match) => [String(match.id), match]));
  const roundLabel = (round) => view.rounds?.[round - 1]?.label ?? '';
  const matches = view.matches.map((match) => {
    const id = String(match.id);
    let next = match;
    if (reveal.has(id)) next = { ...next, winner: next.top?.pid === reveal.get(id) ? 'top' : 'bottom' };
    else if (hidden.has(id)) next = { ...next, winner: null, how: '' };
    for (const side of /** @type {const} */ (['top', 'bottom'])) {
      if (blankEntrants && next[side]?.pid && !next[side].from) {
        next = { ...next, winner: null, how: '', [side]: { ...next[side], pid: null, name: '', dan: '', story: null, you: false, placeholder: next[side].label || '？' } };
        continue;
      }
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
