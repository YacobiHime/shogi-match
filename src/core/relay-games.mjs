// 中継で見られる対局の一覧(docs/tournament-relay-design.mdの1章・7章)。竜王戦・名人戦の期から、決着した棋士どうしの対局を集める。
// 1つの項目は、そのまま中継の棋譜を作る局の設定(relay-game.mjsのplayRelayGameのspec)として使える。画面に依存しない。

import { USER_ID, resultRoundLabel } from './ryuo.mjs';
import { CLASS_LABELS } from './meijin.mjs';
import { HANANE, YOSHIHIKO } from './ryuo-story.mjs';
import { isRealWorld } from './ryuo-strength.mjs';
import { stageVenue } from './match-stage.mjs';
import { relaySeed } from './relay-game.mjs';

/** 一覧の区分(並べる順)。 */
export const RELAY_SECTIONS = Object.freeze({
  series: '番勝負',
  main: '決勝トーナメント',
  own: 'あなたの組',
  groups: 'ほかの組',
  league: '順位戦',
  playoff: 'プレーオフ',
});

/** 中継で使う棋士の写し(名前・段位・強さ・能力・得意戦法)。 */
function relayPlayer(season, id) {
  const player = season.players?.[id];
  if (!player) return null;
  return {
    id, name: player.name ?? '', dan: player.dan ?? '', rating: player.rating ?? 0, level: player.level ?? null,
    story: player.story ?? null, kind: player.kind ?? 'pro', age: player.age ?? null,
    character: player.character ?? null, repertoire: player.repertoire ?? null,
  };
}

const sidePid = (bracket, side) => (side ? (side.pid ?? bracket.nodes?.[side.from]?.winner ?? null) : null);
const rootId = (bracket) => bracket?.root?.from ?? null;

/**
 * 1局の項目。aとbは棋士のid、gameは自動対局の記録(先手・戦法・囲い・展開・勝ち方)。先手が記録にない前の保存の局は、種で決める。
 * @returns {any | null}
 */
function entryOf(season, { key, event, kind, label, section, order, round = 0, weight = 'plain', a, b, winnerId, game, venue = '', gameNo = 0 }, context) {
  // 自分の対局は入れない(振り返りと棋譜解析がある)。観戦の期の分身の対局は入れる(13章)。
  if (!a || !b || !winnerId) return null;
  if (!context.includeUser && (a === USER_ID || b === USER_ID)) return null;
  const seed = relaySeed(key);
  const blackId = game?.black === a || game?.black === b ? game.black : (seed & 1 ? a : b);
  const whiteId = blackId === a ? b : a;
  const black = relayPlayer(season, blackId);
  const white = relayPlayer(season, whiteId);
  if (!black || !white) return null;
  const ids = [blackId, whiteId];
  return {
    key, event, kind, label, section, order, round, weight, venue, gameNo, seed,
    // 観戦の期と本物の世界の期(docs/tournament-strength-spread-design.mdの9章)の中継は、プロ並みの読みで作る(13-3)。
    quality: context.pro ? 'pro' : '',
    black, white,
    winner: winnerId === blackId ? 'black' : 'white',
    openings: { black: game?.openings?.[blackId] ?? null, white: game?.openings?.[whiteId] ?? null },
    castles: { black: game?.castles?.[blackId] ?? null, white: game?.castles?.[whiteId] ?? null },
    story: Array.isArray(game?.story) ? game.story : null,
    how: game?.how ?? 'ending',
    tags: {
      rival: ids.some((id) => season.players?.[id]?.story === HANANE),
      father: ids.some((id) => season.players?.[id]?.story === YOSHIHIKO),
      oshi: Boolean(context.oshiId && ids.includes(context.oshiId)),
      next: Boolean(context.nextId && ids.includes(context.nextId)),
      self: ids.includes(USER_ID),
      current: false,
    },
  };
}

/** 注目の対局か(羽音・善彦・推し・次の相手)。 */
export const isFeatured = (entry) => Boolean(entry?.tags && (entry.tags.rival || entry.tags.father || entry.tags.oshi || entry.tags.next || entry.tags.self));

/** 新しい順(番勝負 → 決勝トーナメント → 自分の組 → ほかの組。中は回戦の遅い順)。 */
const byOrder = (x, y) => y.order - x.order || (x.key < y.key ? -1 : 1);

/**
 * 竜王戦の期の、見られる対局。
 * @param {any} season ryuo.mjsの期
 * @param {{ oshiId?: string | null }} [options]
 */
export function ryuoRelayGames(season, { oshiId = null } = {}) {
  if (!season?.players) return [];
  const spectator = Boolean(season.spectator);
  const context = { oshiId, nextId: season.pending?.opponentId ?? null, includeUser: spectator, pro: spectator || isRealWorld(season.settings?.world) };
  const id = season.id;
  const list = [];
  const pending = season.pending?.kind === 'game' ? season.pending : null;
  const tables = [];
  if (season.ranking) tables.push({ tag: 'ranking', bracket: season.ranking, section: 'own', title: `${season.startGroup}組ランキング戦`, rank: 2, phase: 'ranking' });
  (season.revival ?? []).forEach((block, index) => tables.push({ tag: `revival-${index}`, bracket: block, section: 'own', title: block.label, rank: 3, phase: 'revival', blockIndex: index }));
  for (const [tag, bracket] of Object.entries(season.groupBrackets ?? {})) {
    const [group, block] = tag.split('-');
    tables.push({ tag: `group-${tag}`, bracket, section: 'groups', title: block ? `${group}組 ${bracket.label}` : `${group}組ランキング戦`, rank: 1 });
  }
  if (season.main) tables.push({ tag: 'main', bracket: season.main, section: 'main', title: '決勝トーナメント', rank: 4, series: true, phase: 'main' });
  for (const table of tables) {
    const { bracket } = table;
    const pendingNode = pending && pending.phase === table.phase && (table.blockIndex === undefined || pending.blockIndex === table.blockIndex)
      ? bracket.nodes?.[pending.nodeId] : null;
    for (const node of Object.values(bracket.nodes ?? {})) {
      if (!node.winner) continue;
      // 決勝トーナメントの決勝は、挑戦者決定三番勝負(番勝負の各局)で決まる。
      if (table.series && node.id === rootId(bracket)) continue;
      const entry = entryOf(season, {
        key: `ryuo:${id}:${table.tag}:${node.id}`, event: 'ryuo', kind: 'game',
        label: `${table.title} ${resultRoundLabel(bracket, node.round, { series: table.series === true })}`,
        section: table.section, order: table.rank * 1000 + node.round * 10, round: node.round,
        weight: node.id === rootId(bracket) || table.series ? 'big' : 'plain',
        a: sidePid(bracket, node.a), b: sidePid(bracket, node.b), winnerId: node.winner, game: node.game,
      }, context);
      if (!entry) continue;
      // 自分の次の対局と同じ表の同じ回戦(いま指されている回)。
      entry.tags.current = Boolean(pendingNode && node.round === pendingNode.round);
      list.push(entry);
    }
  }
  const seriesList = [['playoff', season.playoff, '挑戦者決定三番勝負', 5, 'big'], ['finals', season.finals, '竜王戦七番勝負', 6, 'title']];
  for (const [tag, series, title, rank, weight] of seriesList) {
    if (!series || (!spectator && (series.a === USER_ID || series.b === USER_ID))) continue;
    (series.games ?? []).forEach((game, index) => {
      const entry = entryOf(season, {
        key: `ryuo:${id}:${tag}:${index}`, event: 'ryuo', kind: tag, label: `${title} 第${index + 1}局`,
        section: 'series', order: rank * 1000 + index, round: index + 1, weight,
        a: series.a, b: series.b, winnerId: game.winner, game,
        venue: tag === 'finals' ? stageVenue('ryuo', season.no, index + 1) : '', gameNo: index + 1,
      }, context);
      if (entry) list.push(entry);
    });
  }
  return list.sort(byOrder);
}

/**
 * 名人戦の期の、見られる対局(順位戦の各回戦・A級のプレーオフ・名人戦七番勝負)。
 * @param {any} season meijin.mjsの期
 * @param {{ oshiId?: string | null }} [options]
 */
export function meijinRelayGames(season, { oshiId = null } = {}) {
  if (!season?.players) return [];
  // 分身の期(21章)は、分身の対局も中継に並べ、プロ並みの読みで作る(竜王戦の分身の期と同じ)。
  const spectator = Boolean(season.spectator);
  const context = { oshiId, nextId: season.pending?.opponentId ?? null, includeUser: spectator, pro: spectator || isRealWorld(season.settings?.world) };
  const id = season.id;
  const classLabel = CLASS_LABELS[season.cls] ?? '';
  const list = [];
  const roundGames = (games, round, current) => {
    for (const game of games ?? []) {
      const last = round === season.rounds - 1;
      const entry = entryOf(season, {
        key: `meijin:${id}:r${round}:${game.a}-${game.b}`, event: 'meijin', kind: 'league',
        label: `${classLabel} ${last ? '最終局' : `${round + 1}回戦`}`, section: 'league', order: 1000 + round * 10, round: round + 1,
        weight: last ? 'big' : 'plain', a: game.a, b: game.b, winnerId: game.winner, game,
      }, context);
      if (!entry) continue;
      entry.tags.current = current;
      list.push(entry);
    }
  };
  (season.results ?? []).forEach((result, round) => {
    const opponent = season.schedule?.[round]?.opponent;
    const own = spectator && result?.user && opponent
      ? [{ a: USER_ID, b: opponent, winner: result.user.win ? USER_ID : opponent, ...result.user }]
      : [];
    roundGames([...own, ...(result?.games ?? [])], round, false);
  });
  // いまの回戦のほかの対局は、プレイヤーの局の前に決まっている(pending.others)。
  if (season.pending?.kind === 'league' && season.pending.others) roundGames(season.pending.others.games, season.pending.round, true);
  (season.playoff?.matches ?? []).forEach((match, index) => {
    if (!match.winner) return;
    const entry = entryOf(season, {
      key: `meijin:${id}:po:${index}`, event: 'meijin', kind: 'playoff', label: 'A級プレーオフ', section: 'playoff',
      order: 2000 + index, round: index + 1, weight: 'big', a: match.a, b: match.b, winnerId: match.winner, game: match.game,
    }, context);
    if (entry) list.push(entry);
  });
  const finals = season.finals;
  if (finals && (spectator || (finals.a !== USER_ID && finals.b !== USER_ID))) {
    (finals.games ?? []).forEach((game, index) => {
      const entry = entryOf(season, {
        key: `meijin:${id}:finals:${index}`, event: 'meijin', kind: 'finals', label: `名人戦七番勝負 第${index + 1}局`,
        section: 'series', order: 3000 + index, round: index + 1, weight: 'title', a: finals.a, b: finals.b, winnerId: game.winner, game,
        venue: stageVenue('meijin', season.no, index + 1), gameNo: index + 1,
      }, context);
      if (entry) list.push(entry);
    });
  }
  return list.sort(byOrder);
}

/**
 * 一覧を区分けする。注目(羽音・善彦・推し・次の相手)は、ほかの区分にも残す。
 * @param {any[]} entries
 * @returns {{ id: string, label: string, entries: any[] }[]}
 */
export function relaySections(entries) {
  const sections = [];
  const featured = entries.filter(isFeatured);
  if (featured.length) sections.push({ id: 'featured', label: '注目', entries: featured });
  const current = entries.filter((entry) => entry.tags?.current);
  if (current.length) sections.push({ id: 'current', label: 'この回戦', entries: current });
  for (const [id, label] of Object.entries(RELAY_SECTIONS)) {
    const own = entries.filter((entry) => entry.section === id);
    // 「この回戦」と同じ顔ぶれなら、同じ欄を2つ並べない(期の始めの名人戦など)。
    if (own.length && !(own.length === current.length && own.every((entry) => entry.tags?.current))) sections.push({ id, label, entries: own });
  }
  return sections;
}

/**
 * その棋士の、この期の対局(次の相手の棋譜を見て対策する)。新しい順。
 * @param {any[]} entries
 * @param {string} playerId
 */
export function relayGamesOf(entries, playerId) {
  return entries.filter((entry) => entry.black?.id === playerId || entry.white?.id === playerId);
}

/**
 * 同じ回戦のほかの結果(中継の運営のコメントで知らせる。12章)。注目の対局を先に、多くて4件。
 * 「中村大輔六段 勝ち（対 鈴木蓮五段）」の形。
 * @param {any[]} entries
 * @param {any} spec
 * @param {number} [limit]
 */
export function relayRoundNews(entries, spec, limit = 4) {
  const sameRound = entries.filter((entry) => entry.key !== spec?.key && entry.label === spec?.label);
  const ordered = [...sameRound.filter(isFeatured), ...sameRound.filter((entry) => !isFeatured(entry))];
  return ordered.slice(0, limit).map((entry) => {
    const [winner, loser] = entry.winner === 'black' ? [entry.black, entry.white] : [entry.white, entry.black];
    return `${winner.name}${winner.dan ?? ''} 勝ち（対 ${loser.name}${loser.dan ?? ''}）`;
  });
}
