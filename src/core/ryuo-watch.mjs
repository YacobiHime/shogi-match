// 回戦ごとの観戦(docs/tournament-relay-design.mdの13章)。竜王戦の期の対局を、期の順の「回戦」に並べ、結果を伏せて1つずつめくる。
// 観戦の期(分身が出る期)は最初から、本番の期で敗退したときは、自分の最後の対局より後の回戦から。
// 保存は ryuo-watch-store.mjs(対局画面から読むので、中継の処理を読み込まない)。画面に依存しない。

import { USER_ID, bracketChampion } from './ryuo.mjs';
import { isFeatured, ryuoRelayGames } from './relay-games.mjs';


/** 期の中の順(ランキング戦→敗者復活戦→ほかの組→決勝トーナメント→挑戦者決定戦→七番勝負)。 */
const CHRONO = Object.freeze({ ranking: 1, revival: 2, group: 3, main: 4, playoff: 5, finals: 6 });

/** 中継の項目の、期の中の段階。 */
function stageOf(entry) {
  const tag = entry.key.split(':')[2] ?? '';
  if (tag === 'ranking') return 'ranking';
  if (tag.startsWith('revival')) return 'revival';
  if (tag.startsWith('group')) return 'group';
  if (tag === 'main') return 'main';
  return tag === 'playoff' ? 'playoff' : 'finals';
}

/**
 * 期の対局を、回戦ごとにまとめて、期の順に並べる。ほかの組の対局は1つの回戦にまとめる。分身の対局、注目の対局(羽音・推し)の順に先に。
 * @param {any} season ryuo.mjsの期(終わった期)
 * @param {{ oshiId?: string | null }} [options]
 * @returns {{ id: string, label: string, stage: string, entries: any[] }[]}
 */
export function watchSteps(season, { oshiId = null } = {}) {
  const entries = ryuoRelayGames(season, { oshiId });
  const steps = new Map();
  for (const entry of entries) {
    const stage = stageOf(entry);
    const id = stage === 'group' ? 'group' : entry.label;
    const label = stage === 'group' ? 'ほかの組のランキング戦' : entry.label;
    if (!steps.has(id)) steps.set(id, { id, label, stage, chrono: CHRONO[stage] * 1000 + (stage === 'group' ? 0 : entry.round), entries: [] });
    steps.get(id).entries.push(entry);
  }
  return [...steps.values()]
    .sort((a, b) => a.chrono - b.chrono || (a.label < b.label ? -1 : 1))
    .map(({ id, label, stage, entries: list }) => ({
      id, label, stage,
      entries: [
        ...list.filter((entry) => entry.tags?.self),
        ...list.filter((entry) => !entry.tags?.self && isFeatured(entry)),
        ...list.filter((entry) => !isFeatured(entry)),
      ],
    }));
}

/**
 * 本番の期で敗退したとき、観戦する回戦(自分の最後の対局より後)。自分の最後の対局の回戦は、ほかの対局があっても入れない
 * (自分の対局と同じ時に指されていて、結果の画面で見ているため)。
 * @param {any} season
 * @param {ReturnType<typeof watchSteps>} steps
 */
export function stepsAfterElimination(season, steps) {
  const last = season?.userGames?.at(-1);
  if (!last) return steps;
  const index = steps.findIndex((step) => step.id === last.label);
  if (index >= 0) return steps.slice(index + 1);
  // 名前で見つからない回戦(前の版の保存など)は、段階で比べる。
  const phase = last.phase === 'playoff' || last.phase === 'finals' ? last.phase : last.phase === 'revival' ? 'revival' : last.phase === 'main' ? 'main' : 'ranking';
  return steps.filter((step) => CHRONO[step.stage] > CHRONO[phase]);
}

/** 自分が勝ち残ったまま終わった期(竜王になった・防衛した)か。敗退後の観戦は要らない。 */
export function userWonSeason(season) {
  return season?.result?.outcome === 'champion';
}

/**
 * 観戦の最後の一言(竜王と、分身がどこまで上がったか)。
 * @param {any} season
 */
export function watchFinale(season) {
  const championId = season?.champion ?? (season?.finals ? season.finals.winner : season?.main ? bracketChampion(season.main) : null);
  const champion = championId ? season.players?.[championId] : null;
  const title = `第${season?.no ?? 1}期竜王`;
  const lines = [];
  if (champion) lines.push(championId === USER_ID ? `${title}は、あなたの分身！` : `${title}は、${champion.name}${champion.dan ?? ''}！`);
  if (season?.spectator && season.result) {
    const path = season.result.path ?? [];
    const lastStep = path.at(-1);
    if (season.result.outcome !== 'champion' && lastStep) lines.push(`分身は、${lastStep.label}・${lastStep.text}。`);
    lines.push(`分身の成績は${season.result.wins}勝${season.result.losses}敗。`);
  }
  return { championId, champion: champion ? { id: championId, name: champion.name, dan: champion.dan ?? '' } : null, lines };
}

export { RYUO_WATCH_KEY, emptyWatchStore, loadWatchStore, noteWatchProgress, replaceWatchSeason, saveWatchStore } from './ryuo-watch-store.mjs';
