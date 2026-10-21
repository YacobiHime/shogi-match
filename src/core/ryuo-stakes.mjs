// 竜王戦の「この一局に賭けているもの」と「目標まであと何勝か」(docs/ryuo-ux-redesign.mdの4-1・4-3)。
// 勝てば何が起き、負ければ何が起きるかを、短い言葉で決める(D:2-1 リスクとリターン、5-2 吊られたごほうび)。
// 期の状態から作った、組・規模・回戦などの数だけを受け取る。画面と期の保存形式に依存しない。

/** 回戦の名前。fromは、決勝まであといくつの回戦か(0なら決勝)。 */
function roundName(from, round, finalName) {
  if (from === 0) return finalName;
  if (from === 1) return '準決勝';
  if (from === 2) return '準々決勝';
  return `${round}回戦`;
}

/**
 * 次の一局の賭けているもの。
 * - win・lose: 勝ったら・負けたら(短い言葉)
 * - goal: 目標まであと何勝か(1行)
 * - boss: 山場の一局か(組の決勝・番勝負)。ライバルとの一局は、呼ぶ側で足す。
 * @param {{
 *   phase: 'ranking' | 'revival' | 'main' | 'playoff' | 'finals', mode?: 'challenge' | 'defense', group: number,
 *   round?: number, rounds?: number, promote?: number, groupSlots?: number,
 *   revivalEnabled?: boolean, revivalReachable?: boolean, revivalPromotes?: boolean,
 *   need?: number, winsUser?: number, winsOpponent?: number,
 * }} input
 *   revivalReachableは、この回戦で負けても敗者復活戦に回れるか。revivalPromotesは、敗者復活戦を勝ち抜くと昇級(1組は決勝トーナメント)か(小さな規模では、降級をまぬがれるだけ)。
 * @returns {{ win: string, lose: string, goal: string, boss: boolean }}
 */
export function matchStakes(input) {
  const { phase, group, round = 1, rounds = 1, promote = 1, groupSlots = 1 } = input;
  const left = Math.max(1, rounds - round + 1);
  if (phase === 'ranking') {
    const final = round >= rounds;
    const next = final ? '' : `${roundName(rounds - round - 1, round + 1, '組の決勝')}へ`;
    const champion = group === 1 ? '1組優勝・決勝トーナメントへ' : `${group}組優勝・昇級！`;
    let lose = '竜王戦はここまで';
    if (final) {
      if (group > 1 && promote >= 2) lose = '準優勝で昇級';
      else if (group === 1 && groupSlots >= 2) lose = '準優勝で決勝トーナメントへ';
      else lose = '準優勝';
    } else if (input.revivalEnabled && input.revivalReachable) {
      lose = '敗者復活戦へ';
    }
    const promoteLeft = group > 1 && promote >= 2 ? Math.max(1, left - 1) : left;
    const goal = group === 1 ? `1組優勝まであと${left}勝` : `${group}組優勝まであと${left}勝・昇級まであと${promoteLeft}勝`;
    return { win: final ? champion : next, lose, goal, boss: final };
  }
  if (phase === 'revival') {
    const final = round >= rounds;
    const reward = group === 1 ? '決勝トーナメントへ' : input.revivalPromotes ? '昇級！' : '降級をまぬがれる';
    const goalName = group === 1 ? '決勝トーナメント' : input.revivalPromotes ? '昇級' : '残留';
    return {
      win: final ? reward : `${roundName(rounds - round - 1, round + 1, '決勝')}へ`,
      lose: '竜王戦はここまで',
      goal: `${goalName}まであと${left}勝`,
      boss: final,
    };
  }
  if (phase === 'main') {
    // 決勝トーナメントの決勝は、挑戦者決定三番勝負(表の根)。
    const toPlayoff = Math.max(1, rounds - round);
    return {
      win: toPlayoff === 1 ? '挑戦者決定三番勝負へ' : `${roundName(rounds - round - 1, round + 1, '挑戦者決定三番勝負')}へ`,
      lose: '竜王戦はここまで',
      goal: `挑戦者決定戦まであと${toPlayoff}勝`,
      boss: false,
    };
  }
  // 番勝負。
  const need = input.need ?? 1;
  const myLeft = Math.max(1, need - (input.winsUser ?? 0));
  const theirLeft = Math.max(1, need - (input.winsOpponent ?? 0));
  const defense = input.mode === 'defense';
  const finish = phase === 'playoff' ? '竜王への挑戦者に！' : defense ? '竜王を防衛！' : '竜王に！';
  const fail = phase === 'playoff' ? '挑戦はここまで' : defense ? '竜王を失う' : '竜王はならず';
  const goalName = phase === 'playoff' ? '挑戦者' : defense ? '防衛' : '竜王';
  return {
    win: myLeft === 1 ? finish : `${goalName}まであと${myLeft - 1}勝`,
    lose: theirLeft === 1 ? fail : `相手はあと${theirLeft - 1}勝`,
    goal: `${goalName}まであと${myLeft}勝`,
    boss: true,
  };
}

/**
 * 期の目標の1行(入口と、期の結果の「次の期」)。
 * @param {{ mode: 'challenge' | 'defense', group: number, promote: number, groupSlots: number }} entry
 */
export function seasonGoalLine({ mode, group, promote, groupSlots }) {
  if (mode === 'defense') return '挑戦者との七番勝負。先に4勝すれば竜王を防衛';
  const toMain = groupSlots <= 1 ? '優勝すれば' : `${groupSlots}位以内なら`;
  if (group === 1) return `1組で${toMain}決勝トーナメントへ。勝ち抜けば竜王への挑戦者`;
  return `${group}組で${promote}位以内なら昇級。${toMain}決勝トーナメントへ`;
}
