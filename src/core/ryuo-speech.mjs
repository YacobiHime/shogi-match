// 竜王戦の画面で、やこび姫が話すセリフ。説明・エントリーの一言・次の対局・結果の言葉を作る。画面に依存しない。

/** 竜王戦の説明。やこび姫が、順に話す。 */
export function ryuoGuideLines() {
  return [
    '竜王戦はね、将棋界に8つあるタイトル戦の1つだよ！',
    '全棋士のほかに、女流棋士や奨励会員、アマチュアも出られるんだ。',
    'まずは6組のランキング戦。優勝か準優勝すると昇級だよ！ 負けても敗者復活戦があるけど、負け続けると降級しちゃうから気をつけてね。',
    '各組の上位の人が決勝トーナメントへ。上の組ほど、有利な位置から始まるの。',
    '決勝は三番勝負で、2勝すれば竜王への挑戦者！ そして七番勝負で4勝すれば、竜王だよ！',
    '連続5期か通算7期、竜王になれば、永世竜王！ ちなみに、出てくる棋士は、みんな架空の人だからね。',
  ];
}

/** 難易度についての一言。 */
export function entryDifficultyLine({ group, meanLevel, difficulty, recommended, ratingText }) {
  const mean = Math.round(meanLevel);
  const head = `${group}組の相手は、平均でLv.${mean}くらいだよ。`;
  if (difficulty === recommended) return `${head}あなたのレーティング（${ratingText}）にぴったりの難易度だね！`;
  if (difficulty < recommended) return `${head}おすすめより優しめ。じっくり勝ち上がりたいときにいいよ。`;
  return `${head}おすすめより手ごわいよ！ 強い相手と指したいときにどうぞ。点線の数字がおすすめだよ。`;
}

/** 規模についての一言。noteは、組の人数などの説明(画面に表示するもの)。 */
export function entryScaleLine(scaleLabel, note) {
  return `規模は「${scaleLabel}」。${note}`;
}

export function entryRevivalLine(revival) {
  return revival
    ? '敗者復活戦ありだね。負けても、もう一度チャンスがあるよ。ただ、負け続けると降級しちゃうから気をつけて！'
    : '敗者復活戦なし。一発勝負だから、気合いを入れていこう！';
}

const COACH_TEXT = Object.freeze({
  off: '助言なしで、自分の力だけで勝負するんだね。かっこいい！',
  encourage: '応援だけするね。がんばれー！',
  detailed: '詳しく助言するよ。いっしょに考えようね！',
});

/** やこび姫の助言・閃き・待ったについての一言。 */
export function entryCoachLine({ coachLevel, hintLimit, undoLimit }) {
  const count = (value) => (value < 0 ? '無制限' : value === 0 ? 'なし' : `${value}回`);
  return `${COACH_TEXT[coachLevel] ?? COACH_TEXT.detailed} 閃きは${count(hintLimit)}、待ったは${count(undoLimit)}だよ。`;
}

/** 段階に応じた、いまの状況の一言。 */
export function seasonPhaseLines(view) {
  if (!view) return [];
  const { pending } = view;
  const remaining = pending && pending.kind !== 'game' ? pending.need - pending.wins.user : 0;
  const behind = pending && pending.kind !== 'game' ? pending.need - pending.wins.opponent : 0;
  switch (view.phase) {
    case 'ranking':
      return [`${view.startGroup}組のランキング戦だよ。優勝か準優勝で昇級！ 1回戦から、一局ずつ大事にいこう。`];
    case 'revival':
      return ['敗者復活戦だよ！ ここで勝ち上がれば、まだ昇級のチャンスがあるよ。'];
    case 'main':
    case 'main-setup':
      return ['決勝トーナメントに進めたんだね、すごい！ ここを勝ち上がれば、挑戦者決定戦だよ。'];
    case 'playoff':
      return [pending ? `挑戦者決定三番勝負！ あと${remaining}勝で、竜王への挑戦者だよ。` : '挑戦者決定三番勝負だよ。2勝で挑戦者！'];
    case 'finals':
      if (view.mode === 'defense') {
        return [pending ? `竜王の防衛戦！ あと${remaining}勝で防衛だよ。${behind === 1 ? '負けられない一局だね…！' : ''}` : '竜王の防衛戦だよ。'];
      }
      return [pending ? `竜王戦七番勝負！ あと${remaining}勝で、竜王だよ！${behind === 1 ? ' あと1敗で終わっちゃうから、踏ん張ろう！' : ''}` : '竜王戦七番勝負だよ。'];
    case 'prepare-defense':
      return ['防衛戦の準備をしているよ。'];
    default:
      return [];
  }
}

/** 次の対戦相手についての一言。userLevelは、プレイヤーの棋力の目安(Lv)。 */
export function opponentLines(opponent, userLevel, pending) {
  if (!opponent) return [];
  const style = opponent.style?.label;
  const lines = [`${opponent.name}${opponent.dan}との一局だね。${style ? `得意は「${style}」だよ。` : ''}`];
  const gap = opponent.level - userLevel;
  if (gap >= 6) lines.push('今までで一番の強敵かも…！ 全力でいこう！');
  else if (gap >= 3) lines.push('手ごわい相手だよ。慎重にね。');
  else if (gap <= -4) lines.push('落ち着いて指せば大丈夫。でも、油断は禁物だよ！');
  else lines.push('いい勝負になりそう！ がんばってね。');
  if (opponent.style?.rook === 'ranging') lines.push('振り飛車の相手だから、対振り飛車の形を思い出しておこうね。');
  else if (opponent.style?.rook === 'static') lines.push('居飛車の相手だよ。序盤の組み方に気をつけてね。');
  if (pending?.kind && pending.kind !== 'game') lines.push(`これは第${pending.gameNo}局。ここまで、あなた${pending.wins.user}勝、相手${pending.wins.opponent}勝だよ。`);
  return lines;
}

/** 期の結果についての、やこび姫の言葉。 */
export function resultLines(result) {
  if (!result) return [];
  const lines = [];
  switch (result.outcome) {
    case 'champion':
      lines.push('やったーー！ 竜王だよ！！ おめでとう！！', '次の期は、防衛戦だね。連続で防衛して、永世竜王を目指そう！');
      break;
    case 'defense-lost':
      lines.push('防衛、できなかったね…。残念だけど、竜王を守る戦いは本当に大変なんだよ。', '次の期は、また1組から挑戦しよう！');
      break;
    case 'finals-lost':
      lines.push('七番勝負、惜しかった…！ でも、挑戦者になれたのは、本当にすごいことだよ。', '次の期は1組から。もう一度、竜王を目指そう！');
      break;
    case 'playoff-lost':
      lines.push('挑戦者決定戦、あと一歩だったね…。ここまで来られたのは、立派だよ。');
      break;
    case 'main-out':
      lines.push('決勝トーナメントまで来られたんだね。立派な成績だよ！');
      break;
    default:
      lines.push(`今回は、${result.exitLabel ? `${result.exitLabel}で` : ''}敗退だったね…。お疲れさま！`);
  }
  if (result.promoted) lines.push(`${result.startGroup}組から${result.newGroup}組へ、昇級だよ！ おめでとう！`);
  else if (result.relegated) lines.push(`${result.startGroup}組から${result.newGroup}組へ、降級しちゃった…。次で取り返そう！`);
  else if (result.outcome !== 'champion' && result.outcome !== 'defense-lost' && !result.challenger) lines.push(`次の期も、${result.newGroup}組だね。`);
  if (result.standing) lines.push(`組の最終順位は、${result.standing}位だったよ。`);
  return lines;
}
