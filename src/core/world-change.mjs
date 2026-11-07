// 大会の途中で難易度(世界の物差し)を変える(docs/tournament-strength-spread-design.mdの11章)。画面と保存に依存しない。
// 竜王戦・名人戦の期は、期の初めに棋士の写しへLvを付けるので、写しのLvを新しい世界で付け直す。
// 奨励会・研修会・団体戦・棋士の1年は、対局のたびに相手のLvを決めるので、それぞれのモジュールの retune…World で設定と次の相手だけ直す。

import { USER_ID, seasonLevelFor, seasonUserRating } from './ryuo.mjs';
import { MAX_CPU_LEVEL, isRealWorld } from './ryuo-strength.mjs';
import { YOSHIHIKO } from './ryuo-story.mjs';

const clampLevel = (value) => Math.min(MAX_CPU_LEVEL, Math.max(0, Math.round(value)));

/**
 * 竜王戦・名人戦の期の難易度を変える。棋士の写しのLvを新しい世界で付け直す。
 * 羽音の「一度負けた相手には強くなる」などの上乗せ(前のLvと前の世界の換算の差)はそのまま残す。
 * 本物の世界の善彦はいつもLv49。プレイヤー(分身でない)の物差しのレーティングも直す。
 * 変えた記録を season.worldChanges に残す(記録に「途中で変えた」と出すため)。
 * @param {any} season
 * @param {{ difficulty: number, world: number, userLevel?: number, at?: number }} next
 */
export function retuneSeasonWorld(season, { difficulty, world, userLevel = 20, at = Date.now() }) {
  if (!season?.players || !season.settings) return season;
  const before = season.settings;
  if (before.difficulty === difficulty && before.world === world) return season;
  // 画面の値(リアクティブな写し)も渡ってくるので、JSONで写す(保存と同じ形)。
  const next = JSON.parse(JSON.stringify(season));
  const after = { ...next.settings, difficulty, world };
  next.settings = after;
  for (const [id, player] of Object.entries(next.players)) {
    if (!player || !Number.isFinite(player.rating)) continue;
    if (id === USER_ID) {
      if (player.kind !== 'avatar') player.rating = seasonUserRating(Number.isFinite(player.level) ? player.level : userLevel, after);
      continue;
    }
    const yoshihiko = player.story === YOSHIHIKO;
    const pinned = isRealWorld(before.world) && yoshihiko;
    const extra = pinned || !Number.isFinite(player.level) ? 0 : player.level - seasonLevelFor(player.rating, before, userLevel);
    player.level = isRealWorld(world) && yoshihiko ? MAX_CPU_LEVEL : clampLevel(seasonLevelFor(player.rating, after, userLevel) + extra);
  }
  next.worldChanges = [...(next.worldChanges ?? []), { from: before.difficulty ?? null, to: difficulty, at }].slice(-10);
  return next;
}

/**
 * いまの難易度の番号(期・挑戦の設定から)。番号がなければnull。
 * @param {any} holder 期・挑戦・棋士の1年の状態
 */
export const currentDifficulty = (holder) => (Number.isInteger(holder?.settings?.difficulty) ? holder.settings.difficulty : null);
