// 竜王戦の画面で、やこび姫が話すセリフ。説明・エントリーの一言・次の対局・結果の言葉を作る。画面に依存しない。

import { describeCharacter, traitMomentText } from './player-character.mjs';
import { styleEntry } from './ryuo-repertoire.mjs';
import { usageRows } from './opening-usage.mjs';
import { abilityHighlights } from './player-abilities.mjs';
import { levelGradeName } from './tournament-world.mjs';

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

/**
 * 難易度(世界の物差し)についての一言(docs/tournament-strength-spread-design.mdの4-3)。
 * recommendedは入口で選んでおいた番号(世界があれば「いつもの世界」、なければ棋力からのおすすめ)。
 * mountainは上の組の強さ(1組の平均・竜王のLv)。reviewは、世界を決めたときからの棋力のずれ(tournament-world.mjsのworldReview)。
 * Lvの数字には段級位の名前を添える(数字だけでは強さが分からないため。8章)。realは、いちばん上の難易度「本物」(9章)。
 * @param {{ group: number, meanLevel: number, difficulty: number, recommended: number, ratingText?: string,
 *   usual?: boolean, mountain?: { one: number, top: number } | null, review?: { kind: string, delta: number } | null, real?: boolean }} input
 */
export function entryDifficultyLine({ group, meanLevel, difficulty, recommended, usual = false, mountain = null, review = null, real = false }) {
  const mean = Math.round(meanLevel);
  const at = (level) => `Lv.${level}（${levelGradeName(level)}）`;
  if (real) {
    return `本物の竜王戦だよ！ ${group}組の相手は、平均で${levelGradeName(mean)}くらい。上の組はトッププロやタイトル保持者、`
      + '天鷺善彦さんは藤井聡太並みの読みで指すよ。観戦では、プロどうしの対局が見られるよ。選んだ世界は、次の期からも使うよ。';
  }
  const head = mountain
    ? `${group}組の相手は、平均で${at(mean)}くらい。上の組ほど強くて、1組の平均は${at(mountain.one)}、竜王は${at(mountain.top)}くらいだよ。`
    : `${group}組の相手は、平均で${at(mean)}くらいだよ。`;
  if (difficulty < recommended) return `${head}${usual ? 'いつもより' : 'おすすめより'}やさしい世界。どの棋士も、少しずつ弱くなるよ。選んだ世界は、次の期からも使うよ。`;
  if (difficulty > recommended) return `${head}${usual ? 'いつもより' : 'おすすめより'}手ごわい世界！ 強い相手と指したいときにどうぞ。選んだ世界は、次の期からも使うよ。`;
  if (!usual) return `${head}いまのあなたなら、6組の平均に7割くらい勝てる世界だよ。この世界で、上をめざそう！`;
  if (review?.kind === 'grown') return `${head}前よりLv.${review.delta}強くなったね！ 同じ世界だから、上の組にも勝てるようになっているはずだよ。`;
  if (review?.kind === 'dropped' || review?.kind === 'struggling') {
    return `${head}苦しい期が続いたね。難易度を${Math.max(1, difficulty - 1)}にして、ひとつやさしい世界にしてもいいよ。`;
  }
  return `${head}いつもの世界だよ。強くなるほど、上の組で勝てるようになるよ。`;
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

/** 秒読みの演出についての一言。時間切れで負けにはしないことを、先に伝える。 */
export function entryByoyomiLine(seconds) {
  return seconds > 0
    ? `1手${seconds}秒の秒読みだよ。10秒から音で知らせるね。0秒になっても負けにはならないから、安心してね。`
    : '秒読みはなし。じっくり考えて指そう！';
}

/** 段階に応じた、いまの状況の一言。 */
export function seasonPhaseLines(view) {
  if (!view) return [];
  const { pending } = view;
  const remaining = pending && pending.kind !== 'game' ? pending.need - pending.wins.user : 0;
  const behind = pending && pending.kind !== 'game' ? pending.need - pending.wins.opponent : 0;
  switch (view.phase) {
    case 'ranking':
      // 昇級の枠(何位まで)は規模で変わるので、「上位」と言う。1組の上位は、昇級ではなく決勝トーナメント。
      return [`${view.startGroup}組のランキング戦だよ。勝てば次の回戦、上位に入れば${view.startGroup === 1 ? '決勝トーナメントへ' : '昇級'}！ 一局ずつ大事にいこう。`];
    case 'revival': {
      // 小さな規模では、勝ち抜いても降級をまぬがれるだけ(ryuo-stakes.mjs)。
      const goal = pending?.stakes?.goal ?? '';
      const reward = view.startGroup === 1 ? '決勝トーナメントに出られる' : goal.startsWith('残留') ? '降級をまぬがれる' : 'まだ昇級できる';
      return [`敗者復活戦だよ！ ここで勝ち上がれば、${reward}よ。`];
    }
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
  // 得意戦法が複数あれば、2つまで挙げる(使用率があれば、多い順に、割合を添えて)。
  const rows = usageRows(opponent.repertoire?.usage).slice(0, 2);
  const styles = rows.length
    ? rows.map(({ label, share }) => `${label}（${share}%）`)
    : opponent.repertoire?.styles?.length
      ? opponent.repertoire.styles.slice(0, 2).map((id) => styleEntry(id).label)
      : [opponent.style?.label].filter(Boolean);
  const styleText = styles.map((label) => `「${label}」`).join('や');
  const lines = [`${opponent.name}${opponent.dan}との一局だね。${styleText ? `得意は${styleText}だよ。` : ''}`];
  const gap = opponent.level - userLevel;
  if (gap >= 6) lines.push('今までで一番の強敵かも…！ 全力でいこう！');
  else if (gap >= 3) lines.push('手ごわい相手だよ。慎重にね。');
  else if (gap <= -4) lines.push('落ち着いて指せば大丈夫。でも、油断は禁物だよ！');
  else lines.push('いい勝負になりそう！ がんばってね。');
  // 実績(タイトル)と、プレイヤーとの対戦成績。
  const career = opponent.profile;
  if (career?.held?.length) {
    const crowns = career.held.length >= 2 ? `${career.held.join('・')}の${['', '', '二', '三', '四', '五', '六', '七', '八'][career.held.length]}冠` : career.held[0];
    lines.push(`相手は${crowns}だよ！ タイトル通算${career.totalTitles}期${career.held.length >= 2 ? 'の第一人者' : ''}だね。`);
  } else if (career?.former?.length) {
    lines.push(`${career.former[0]}で、タイトル通算${career.totalTitles}期の実力者だよ。`);
  }
  const vs = opponent.vsUser;
  if (vs) {
    if (vs.streak <= -2) lines.push(`この人には${-vs.streak}連敗中…。今度こそ勝とう！`);
    else if (vs.streak >= 2) lines.push(`この人には${vs.streak}連勝中！ 相性がいいのかも。`);
    else if (vs.lastWin === false) lines.push('前に負けた相手だよ。リベンジしよう！');
    else lines.push(`前に勝ったことのある相手だね。通算であなたの${vs.wins}勝${vs.losses}敗だよ。`);
  }
  const profile = describeCharacter(opponent.character ?? null);
  // 能力のいちばんの武器と、いちばんの穴(作戦の手がかり)。
  if (opponent.character?.abilities) {
    const { best, worst } = abilityHighlights(opponent);
    lines.push(`能力は${best.label}が${best.rank}で一番の武器。${worst.label}は${worst.rank}だから、${WEAK_SPOT_HINTS[worst.key]}`);
  }
  if (profile.gold?.length) lines.push(`金の特殊能力「${profile.gold.join('」「')}」を持っている、すごい人だよ！`);
  if (opponent.character) {
    const notes = [...profile.strengths.slice(0, 1).map((text) => `${text}みたい`), ...profile.weaknesses.slice(0, 1).map((text) => `${text}らしいよ`)];
    lines.push(`${profile.style}の人だよ。${notes.length ? `${notes.join('。でも、')}。` : ''}`);
  }
  if (opponent.style?.rook === 'ranging') lines.push('振り飛車の相手だから、対振り飛車の形を思い出しておこうね。');
  else if (opponent.style?.rook === 'static') lines.push('居飛車の相手だよ。序盤の組み方に気をつけてね。');
  if (pending?.kind && pending.kind !== 'game') lines.push(`これは第${pending.gameNo}局。ここまで、あなた${pending.wins.user}勝、相手${pending.wins.opponent}勝だよ。`);
  return lines;
}

/** 相手のいちばん低い能力ごとの、作戦の手がかり。 */
const WEAK_SPOT_HINTS = Object.freeze({
  opening: '序盤でリードを取りたいね。',
  middle: '中盤の駆け引きで差をつけよう。',
  ending: '終盤の寄せ合いに持ち込めるといいね。',
  attack: 'しっかり囲えば、攻めはしのげそう。',
  defense: '攻め合いに持ち込めば、チャンスがありそう。',
  reading: '複雑な局面にすると、読み負けしてくれるかも。',
  mate: '玉を詰ませにくい形にしておくと、詰みを逃してくれるかも。',
  stability: '粘っていれば、大きなミスが出るかも。',
});

/** 直前の対局で、相手の特徴が出た場面についての一言。 */
export function lastGameLines(lastGame) {
  if (!lastGame?.traitMoments?.length) return [];
  const name = lastGame.opponent?.name ?? '相手';
  return [`さっきの${name}さんとの対局、`, ...lastGame.traitMoments.slice(0, 2).map(traitMomentText).filter(Boolean)];
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
