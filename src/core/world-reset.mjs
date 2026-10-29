// 棋士の世界を最初に戻す(docs/player-world-note-design.mdの7章)。大会の選択の「棋士の世界を最初に戻す」。
// 名簿(棋士の年齢・段位・強さ・組・タイトル・順位戦・プレイヤーとの対戦成績・棋界の記録)を作り直す。
// プレイヤー自身の位置(竜王戦の組と竜王・順位戦のクラスと名人)は、新しい世界でもそのまま。
// 竜王戦の組はキャリアが持つので、ここでは竜王かどうかと順位戦のクラスだけを写す。画面と保存に依存しない。

import { USER_ID } from './ryuo.mjs';
import { USER_HOLDER, createRoster } from './ryuo-roster.mjs';
import { JUNNI_LEAGUE_CLASSES, junniClassOf, syncJunni } from './ryuo-league.mjs';

/**
 * 進行中のため、世界を戻せない理由(戻せるならnull)。期の途中で戻すと、期の棋士が名簿にいなくなるため。
 * @param {{ ryuoSeason?: any, meijinSeason?: any, shoreikaiRun?: any, kenshukaiRun?: any }} state
 * @returns {string | null}
 */
export function worldResetBlocker({ ryuoSeason = null, meijinSeason = null, shoreikaiRun = null, kenshukaiRun = null } = {}) {
  if (ryuoSeason && ryuoSeason.phase !== 'done') return '竜王戦の期の途中';
  if (meijinSeason && meijinSeason.phase !== 'done') return '名人戦の期の途中';
  // 奨励会・研修会は、挑戦(run)を経歴に残して閉じるまで(四段・退会・不合格のあとも、入口で閉じるまで)。
  if (shoreikaiRun) return '奨励会の挑戦の途中';
  if (kenshukaiRun) return '研修会の途中';
  return null;
}

/**
 * 新しい棋士の世界(名簿)。前の名簿で、プレイヤーが竜王なら竜王のまま、順位戦にいればそのクラス(名人なら名人)のまま。
 * @param {any} previous 前の名簿(なければ、はじめての世界と同じ)
 * @param {{ seed: number, userGroup: number }} options userGroupは、竜王戦のキャリアのプレイヤーの組
 */
export function resetRoster(previous, { seed, userGroup }) {
  const userIsChampion = previous?.holder === USER_HOLDER;
  const roster = createRoster({ seed, userGroup, userIsChampion });
  const before = previous?.junni;
  if (!before?.userJoined || !roster.junni) return roster;
  const cls = junniClassOf(before, USER_ID);
  const world = roster.junni;
  if (cls === 'meijin') {
    // プレイヤーが名人なら、新しい世界の名人(善彦)はA級の先頭へ。
    if (world.holder) world.classes.A.unshift(world.holder);
    world.holder = USER_ID;
  } else if (JUNNI_LEAGUE_CLASSES.includes(cls)) {
    world.classes[cls].push(USER_ID);
  } else {
    world.classes.C2.push(USER_ID);
  }
  world.userJoined = true;
  syncJunni(roster);
  return roster;
}
