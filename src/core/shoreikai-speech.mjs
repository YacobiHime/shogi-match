// 奨励会のやこび姫・師匠・羽音の台詞(docs/shoreikai-design.mdの13章)。画面に依存しない。
// やこび姫は、次にすることを短く言う。負けを責めない(D:7)。羽音は感嘆符を使わない冷静な口調(ryuo-story.mjsと同じ)。

import { SANDAN, rankLabel } from './shoreikai.mjs';

/** 入口のやこび姫の一言(吹き出しは2行まで。斜め読みで伝わる長さに。U:3-5)。 */
export function entryTalk({ pro = null, runs = 0 } = {}) {
  if (pro) return `棋士番号${pro.kishiNumber}号のあなたへ。師匠や受験級を変えて、もう一度歩いてみる？`;
  if (runs > 0) return 'もう一度、入会試験から。今度こそ四段まで行こうね！';
  return 'プロ棋士の入口は、奨励会。まずは入会試験！ 師匠と受験する級を決めよう';
}

/** 受験級を選んだときの一言(近道と、試験の相手の強さ)。 */
export function examRankTalk(rank, recommended) {
  const label = rankLabel(rank);
  if (rank === recommended) return `${label}受験がおすすめ。あなたの棋力にちょうどいいよ`;
  if (rank > recommended) return `${label}から受けるんだね。上の級ほど四段に近いけど、試験の相手も強いよ`;
  return `${label}から、じっくり上がっていくんだね。そのぶん、四段までの道は長いよ`;
}

const MENTOR_LINES = Object.freeze({
  static: {
    enter: '推薦状は書いておいた。居飛車の本筋から、しっかり鍛えなさい',
    pass: '合格おめでとう。ここからが長いぞ。毎局、自分の将棋を指すことだ',
    fail: '一度の不合格で決まるものじゃない。また受ければいい',
    promote: '昇級か。いい将棋だった。焦らず、一段ずつだ',
    dan: '有段者になったな。ここからは一局の重みが違う',
    league: '三段リーグは別の世界だ。一局ずつ、目の前の盤に集中しなさい',
    jiten: '次点か。悔しいだろうが、力は届いている',
    pro: 'よくやった。今日から棋士だ。これを受け取りなさい、扇子だ',
    retired: 'よく頑張った。将棋は、どこにいても指せる',
  },
  ranging: {
    enter: '推薦状は書いた。振り飛車でも居飛車でも、自分の得意を一つ作りなさい',
    pass: '合格だね。さばきの感覚を、例会で磨いていこう',
    fail: '落ちても、指した将棋は残る。また受けよう',
    promote: 'いいさばきだった。この調子で、上の級へ',
    dan: '初段おめでとう。軽やかに、でも粘り強くね',
    league: '三段リーグか。苦しいときほど、駒をさばいて楽になろう',
    jiten: '次点は、扉の前まで来た証拠だよ',
    pro: 'おめでとう、四段だ。これはお祝いの扇子。大事に使ってね',
    retired: 'よく指したね。君の将棋は、ずっと君のものだよ',
  },
  both: {
    enter: '推薦状だ。居飛車も振り飛車も、指せるものは何でも指してみなさい',
    pass: '合格か。どんな形でも、最後に勝てばいい',
    fail: '負けた将棋から学べばいい。次の試験で取り返そう',
    promote: '昇級おめでとう。広く指して、強くなりなさい',
    dan: '段位だな。形にとらわれず、局面を見る目を育てなさい',
    league: '三段リーグだ。勝ちにこだわれ。それがプロへの道だ',
    jiten: '次点だったか。もう一歩だな',
    pro: '四段昇段、おめでとう。私からは扇子を。棋士として、存分に指しなさい',
    retired: 'ここまでよく頑張った。誇っていい',
  },
});

/**
 * 師匠の一言。
 * @param {{ name: string, dan: string, party?: string } | null} mentor
 * @param {'enter' | 'pass' | 'fail' | 'promote' | 'dan' | 'league' | 'jiten' | 'pro' | 'retired'} moment
 */
export function mentorLine(mentor, moment) {
  if (!mentor) return '';
  const lines = MENTOR_LINES[mentor.party] ?? MENTOR_LINES.static;
  return lines[moment] ?? '';
}

/** 羽音の一言(冷静で、感嘆符を使わない)。 */
export const HANANE_SHOREIKAI_LINES = Object.freeze({
  first: '三段リーグの天鷺です。……入会したばかりの人と話すのは、珍しいことですが',
  promoted: '先に、四段で待っています',
  league: '三段リーグは、一局ずつです。そうやって、私も抜けました',
  pro: '……ようやく来ましたね。次は、盤の上で',
});

/**
 * 次の1局の、やこび姫の一言。
 * @param {any} view describeShoreikaiの形
 */
export function pendingTip(view) {
  const pending = view?.pending;
  if (!pending) return '';
  const opponent = pending.opponent;
  if (pending.kind === 'exam1') {
    const exam = view.exam;
    if (exam.losses === 2) return 'あと1つ負けると不合格。でも勝てば、まだまだ続くよ。深呼吸して！';
    return `一次試験は、受験者どうしの勝負。4勝で通過だよ（いま${exam.wins}勝${exam.losses}敗）`;
  }
  if (pending.kind === 'exam2') return '二次試験は、奨励会員と。1勝すれば合格！ 胸を借りるつもりでいこう';
  if (pending.kind === 'league') {
    const outlook = view.league?.outlook;
    if (opponent?.story === 'hanane') return '羽音さんとの一局。終盤がとても正確だから、序盤でリードを取ろう';
    if (pending.stakes.win === '四段') return 'この一局に勝てば、四段！ いつもどおりに指そう';
    if (outlook === 'self') return '全部勝てば、自力で四段。1局ずつだよ';
    if (outlook === 'others') return '全部勝って、ほかの人の結果を待とう。まずは目の前の1勝！';
    if (outlook === 'clinched') return '四段は決まり！ 最後まで、いい将棋を指そう';
    return '今期は苦しいけど、勝ち越せば来期の順位が上がるよ';
  }
  if (opponent?.peer) return `同期の${opponent.name}さんとの対決！ 先に上がるのはどっち？`;
  if (pending.stakes.warning) return view.point
    ? '降級点があるから、ここは踏んばりどころ。勝てば流れが変わるよ'
    : `${pending.stakes.warning}。でも、勝てば大丈夫。落ち着いて！`;
  if (pending.stakes.win) return `この一局に勝てば、${pending.stakes.win}！`;
  if (view.progress?.streak >= 2) return `${view.progress.streak}連勝中！ この調子で${view.word}まで行こう`;
  return `${view.word}まであと${view.progress?.winsLeft ?? '?'}勝。1局ずつね`;
}

/**
 * 対局から戻ったときの判子(1局の出来事のうち、いちばん大きいもの)。
 * @param {{ kind: string, rank?: number, mark?: string, word?: string, text: string }[]} events
 * @returns {null | { seal: string, title: string, sub: string, weight: 'mid' | 'big' | 'max', tone: 'good' | 'soft' }}
 */
export function eventStamp(events = []) {
  const order = ['pro', 'league-entry', 'pass', 'promote', 'jiten', 'exam-first', 'extend', 'clear', 'demote', 'point', 'sandan-point', 'fail', 'retired'];
  const event = [...events].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))[0];
  if (!event) return null;
  switch (event.kind) {
    case 'pro': return { seal: '四段', title: '四段昇段！', sub: event.text, weight: 'max', tone: 'good' };
    case 'league-entry': return { seal: '三段', title: '三段昇段！ 三段リーグへ', sub: '上位に入れば、四段（プロ）', weight: 'big', tone: 'good' };
    case 'pass': return { seal: '合格', title: '入会試験に合格！', sub: `${event.text}。今日から奨励会員`, weight: 'big', tone: 'good' };
    case 'promote': return { seal: event.word === '昇段' ? '昇段' : '昇級', title: `${rankLabel(event.rank ?? 0)}に${event.word}！`, sub: event.mark ? `${event.mark}で` : '', weight: (event.rank ?? 0) >= 6 ? 'big' : 'mid', tone: 'good' };
    case 'jiten': return { seal: '次点', title: '次点', sub: event.text, weight: 'mid', tone: 'soft' };
    case 'exam-first': return { seal: '通過', title: '一次試験通過！', sub: '次は二次試験。奨励会員に1勝で合格', weight: 'mid', tone: 'good' };
    case 'extend': return { seal: '延長', title: '勝ち越しで延長', sub: '年齢制限まで、あと1期', weight: 'mid', tone: 'good' };
    case 'clear': return { seal: '解消', title: '降級点が消えた！', sub: '流れが戻ってきたね', weight: 'mid', tone: 'good' };
    case 'demote': return { seal: '降級', title: event.text, sub: 'もう一度、上がろう', weight: 'mid', tone: 'soft' };
    case 'point': return { seal: '点', title: '降級点がついた', sub: '勝ち越せば消えるよ', weight: 'mid', tone: 'soft' };
    case 'sandan-point': return { seal: '点', title: event.text, sub: '来期で取り返そう', weight: 'mid', tone: 'soft' };
    case 'fail': return { seal: '再挑戦', title: '入会試験は不合格', sub: 'すぐに受け直せるよ', weight: 'mid', tone: 'soft' };
    case 'retired': return { seal: '退会', title: '奨励会を退会', sub: event.text, weight: 'mid', tone: 'soft' };
    default: return null;
  }
}

/** 師匠が話す場面(出来事から)。 */
export function mentorMoment(events = []) {
  const kinds = events.map(({ kind }) => kind);
  if (kinds.includes('pro')) return 'pro';
  if (kinds.includes('league-entry')) return 'league';
  if (kinds.includes('pass')) return 'pass';
  if (kinds.includes('fail')) return 'fail';
  if (kinds.includes('jiten')) return 'jiten';
  if (kinds.includes('retired')) return 'retired';
  const promote = events.find(({ kind }) => kind === 'promote');
  if (promote) return (promote.rank ?? 0) >= 6 ? 'dan' : 'promote';
  return null;
}

/** 三段の言葉(画面の見出しに使う)。 */
export const SANDAN_LABEL = rankLabel(SANDAN);
