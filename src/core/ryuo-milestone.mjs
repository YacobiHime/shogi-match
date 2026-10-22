// 竜王戦の節目(docs/ryuo-ux-redesign.mdの4-5〜4-7)。
// 直前の対局がどんな節目だったか(突破・組優勝・挑戦権・竜王)、ほかの棋士の大番狂わせ、期のできたことの1行を決める。
// 重さはGame_Nintendo_Implementation.mdの3-1に合わせる: mid(中)・big(大)・max(最大)。ふつうの回戦の勝ち(小)は道の動きだけ。
// 期の保存形式(core/ryuo.mjs)を読むだけで、書き換えない。

import { USER_HOLDER } from './ryuo-roster.mjs';
import { HANANE } from './ryuo-story.mjs';

const USER_ID = USER_HOLDER;
const sidePid = (bracket, side) => (side ? (side.pid ?? bracket.nodes[side.from]?.winner ?? null) : null);
const rootOf = (bracket) => Object.values(bracket.nodes).reduce((top, node) => (!top || node.round > top.round ? node : top), null);

/**
 * 直前のプレイヤーの対局の節目。勝った対局だけ。ふつうの回戦の勝ちはnull。
 * @param {any} season
 * @param {{ promote?: number }} [options] promoteは昇級の人数(規模で決まる)。
 * @returns {null | { kind: string, weight: 'mid' | 'big' | 'max', seal: string, title: string, sub: string, line: string }}
 */
export function lastGameMilestone(season, { promote = 1 } = {}) {
  const game = season.userGames?.at(-1);
  if (!game?.win) return null;
  const group = season.startGroup;
  const defense = season.mode === 'defense';
  if (season.phase === 'done' && season.champion === USER_ID) {
    return defense
      ? { kind: 'crown', weight: 'max', seal: '防衛', title: '竜王を防衛！', sub: '七番勝負を制した', line: '防衛おめでとう！ 竜王の座を守りきったね。' }
      : { kind: 'crown', weight: 'max', seal: '竜王', title: '竜王になった！', sub: '七番勝負を制した', line: '竜王だよ！ 本当に、てっぺんまで登ったね……！' };
  }
  if (game.phase === 'playoff' && season.playoff?.winner === USER_ID) {
    return { kind: 'challenger', weight: 'big', seal: '挑戦', title: '竜王への挑戦権を獲得！', sub: '七番勝負へ', line: '挑戦者だよ！ 次は竜王との七番勝負。道のてっぺんが見えてきたね！' };
  }
  if (game.phase === 'ranking' && season.ranking && game.round === season.ranking.rounds) {
    const sub = group === 1 ? '決勝トーナメントへ' : `${group - 1}組へ昇級`;
    return { kind: 'group', weight: 'big', seal: '優勝', title: `${group}組優勝！`, sub, line: `${group}組優勝、おめでとう！ ${sub}が決まったよ。次は決勝トーナメント！` };
  }
  if (game.phase === 'revival') {
    const block = (season.revival ?? []).find((entry) => Object.values(entry.nodes).some((node) => sidePid(entry, node.a) === USER_ID || sidePid(entry, node.b) === USER_ID));
    if (block && rootOf(block)?.winner === USER_ID) {
      // 小さな規模の敗者復活戦は、勝ち抜いても降級をまぬがれるだけ(core/ryuo-stakes.mjs)。
      const promotes = group === 1 || promote - 2 > 0;
      if (group === 1) return { kind: 'revival', weight: 'big', seal: '突破', title: '決勝トーナメントへ！', sub: '敗者復活戦を勝ち抜いた', line: '敗者復活戦を勝ち抜いたよ！ 決勝トーナメントへ行こう！' };
      return promotes
        ? { kind: 'revival', weight: 'big', seal: '昇級', title: `${group - 1}組へ昇級！`, sub: '敗者復活戦を勝ち抜いた', line: `負けても、あきらめなかったね！ ${group - 1}組へ昇級だよ。` }
        : { kind: 'revival', weight: 'mid', seal: '残留', title: '降級をまぬがれた！', sub: '敗者復活戦を勝ち抜いた', line: `${group}組に残れたよ！ 来期はここから昇級をねらおう。` };
    }
  }
  if (game.phase === 'main' && season.playoff && (season.playoff.a === USER_ID || season.playoff.b === USER_ID) && !season.playoff.games.length) {
    return { kind: 'main', weight: 'mid', seal: '突破', title: '決勝トーナメントを勝ち抜いた！', sub: '挑戦者決定三番勝負へ', line: 'あと2勝で、竜王への挑戦者だよ！' };
  }
  if (season.players?.[game.opponentId]?.story === HANANE) {
    return { kind: 'rival', weight: 'mid', seal: '突破', title: 'ライバルに勝った！', sub: game.label ?? '', line: '羽音さんに勝ったね！ 次の一局も、この調子でいこう。' };
  }
  return null;
}

/** 大番狂わせにする、レーティングの差(負けた側が、これだけ上)。逆転勝ちなら、半分の差から。 */
export const UPSET_RATING_GAP = 200;
/** 1期に知らせる大番狂わせの数の上限(D:9-1 待たせない。全部は見せない)。 */
export const UPSET_LIMIT = 3;

/**
 * この期の、ほかの棋士どうしの大番狂わせ(表の進む順)。同じ表の同じ回戦では、いちばん大きいものだけ。上限はUPSET_LIMIT。
 * @returns {{ phase: string, round: number, winner: string, loser: string, gap: number, comeback: boolean }[]}
 */
export function seasonUpsets(season) {
  const brackets = [
    ['ranking', season.ranking],
    ...(season.revival ?? []).map((block) => ['revival', block]),
    ['main', season.main],
  ].filter(([, bracket]) => bracket);
  const upsets = [];
  for (const [phase, bracket] of brackets) {
    const byRound = new Map();
    for (const node of Object.values(bracket.nodes)) {
      const a = sidePid(bracket, node.a);
      const b = sidePid(bracket, node.b);
      if (!node.winner || !a || !b || a === USER_ID || b === USER_ID) continue;
      const loser = node.winner === a ? b : a;
      const gap = (season.players[loser]?.rating ?? 0) - (season.players[node.winner]?.rating ?? 0);
      const comeback = node.game?.how === 'comeback';
      if (gap < UPSET_RATING_GAP && !(comeback && gap >= UPSET_RATING_GAP / 2)) continue;
      const current = byRound.get(node.round);
      if (!current || gap > current.gap) byRound.set(node.round, { phase, round: node.round, winner: node.winner, loser, gap, comeback });
    }
    upsets.push(...[...byRound.values()].sort((x, y) => x.round - y.round));
  }
  return upsets.slice(0, UPSET_LIMIT);
}

/**
 * いま知らせる大番狂わせの1行。プレイヤーが直前に指したのと同じ表・同じ回戦のものだけ(古い話はしない)。
 */
export function latestUpsetLine(season) {
  const game = season.userGames?.at(-1);
  if (!game || !game.round) return '';
  const upset = seasonUpsets(season).find(({ phase, round }) => phase === game.phase && round === game.round);
  if (!upset) return '';
  const winner = season.players[upset.winner];
  const loser = season.players[upset.loser];
  if (!winner || !loser) return '';
  const how = upset.comeback ? '終盤の逆転で' : '';
  return `大番狂わせ！ ${winner.name}${winner.dan}が、${how}${loser.name}${loser.dan}を破ったよ。`;
}

/**
 * 期のできたこと(1行)。レーダーチャートでいちばん高い項目。解析がまだで、点のある項目がなければ空。
 * @param {{ label: string, value: number | null }[]} radar
 */
export function bestAxisLine(radar) {
  const best = (radar ?? []).filter(({ value }) => typeof value === 'number').sort((a, b) => b.value - a.value)[0];
  return best ? `この期いちばん光っていたのは「${best.label}」（${Math.round(best.value)}点）だよ。` : '';
}
