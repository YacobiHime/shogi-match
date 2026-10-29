// 大会を途中でやめる(docs/tournament-withdraw-design.md)。竜王戦・名人戦は「棄権」: 残りの対局を不戦敗にして、
// 期はほかの棋士どうしで最後まで決める(期の結果・昇級降級・名簿は、ふつうに期が終わったときと同じ)。
// 不戦敗は盤で指していないので、印(forfeit)を付け、レーティングや統計の解析には入れない。画面と保存に依存しない。

import { recordUserGame } from './ryuo.mjs';
import { recordMeijinGame } from './meijin.mjs';

/** 期をやめられるか(自分の対局が残っている期だけ)。 */
export const canWithdrawSeason = (season) => Boolean(season && season.phase !== 'done' && season.pending);

/**
 * 不戦敗をくり返して、期を最後まで進める。recordは、その大会の負けを記録する関数。
 * @param {any} season
 * @param {(season: any) => any} record
 */
function forfeitRest(season, record) {
  let next = structuredClone(season);
  const before = next.userGames?.length ?? 0;
  // 番勝負まで負け続けても、1期の自分の対局は数十局に収まる。念のため上限を置く。
  for (let guard = 0; guard < 200 && next.pending && next.phase !== 'done'; guard += 1) next = record(next);
  next.userGames = (next.userGames ?? []).map((game, index) => (index >= before ? { ...game, forfeit: true } : game));
  next.withdrawn = true;
  if (next.result) next.result = { ...next.result, withdrawn: true, forfeits: next.userGames.length - before };
  return next;
}

/**
 * 竜王戦の期を棄権する。残りの対局(敗者復活戦・番勝負も)を不戦敗にして、期を終える。
 * @param {any} season
 */
export function withdrawRyuoSeason(season) {
  if (!canWithdrawSeason(season)) return season;
  return forfeitRest(season, (current) => recordUserGame(current, 'loss'));
}

/**
 * 名人戦の期を棄権する。順位戦の残りの回戦(プレーオフ・七番勝負も)を不戦敗にして、期を終える。
 * @param {any} season
 */
export function withdrawMeijinSeason(season) {
  if (!canWithdrawSeason(season)) return season;
  return forfeitRest(season, (current) => recordMeijinGame(current, 'loss'));
}

/**
 * いまやめられる大会(大会の選択の「途中でやめる」の行)。
 * @param {{ ryuoSeason?: any, meijinSeason?: any, shoreikaiRun?: any, kenshukaiRun?: any }} state
 * @returns {{ id: 'ryuo' | 'meijin' | 'shoreikai' | 'kenshukai', label: string, action: string, note: string }[]}
 */
export function withdrawOptions({ ryuoSeason = null, meijinSeason = null, shoreikaiRun = null, kenshukaiRun = null } = {}) {
  const options = [];
  if (canWithdrawSeason(ryuoSeason)) {
    options.push({
      id: 'ryuo', label: `竜王戦 第${ryuoSeason.no}期`, action: '棄権する',
      note: '残りの対局は不戦敗になり、期はほかの棋士どうしで最後まで決まります。昇級・降級も、その結果で決まります。',
    });
  }
  if (canWithdrawSeason(meijinSeason)) {
    options.push({
      id: 'meijin', label: `名人戦 第${meijinSeason.no}期`, action: '棄権する',
      note: '順位戦の残りの対局は不戦敗になり、期はほかの棋士どうしで最後まで決まります。昇級・降級も、その結果で決まります。',
    });
  }
  if (shoreikaiRun && shoreikaiRun.phase !== 'pro' && shoreikaiRun.phase !== 'retired') {
    const member = shoreikaiRun.phase !== 'exam' && shoreikaiRun.phase !== 'failed';
    options.push({
      id: 'shoreikai', label: '奨励会', action: member ? '退会する' : '受験をやめる',
      note: member ? '退会すると、いまの級・段からは続けられません。経歴には「退会」と残ります。' : '入会試験をやめます。あとで、また受験できます。',
    });
  }
  if (kenshukaiRun) {
    options.push({
      id: 'kenshukai', label: '研修会', action: 'やめる',
      note: 'いまのクラスからは続けられません。経歴には、ここまでの成績が残ります。',
    });
  }
  return options;
}
