// 研修会のやこび姫の台詞と、対局から戻ったときの判子(docs/kenshukai-design.md)。画面に依存しない。
// やこび姫は、次にすることを短く言う。負けを責めない(D:7)。吹き出しは2行まで(U:3-5)。

import { A2, TOP, classLabel } from './kenshukai.mjs';

/** 入口のやこび姫の一言。 */
export function entryTalk({ best = null, runs = 0, shoreikaiFailed = false } = {}) {
  if (shoreikaiFailed) return '奨励会の試験、惜しかったね。研修会でA2まで上がれば、試験なしで6級に編入できるよ';
  if (best !== null && best >= A2) return `前は${classLabel(best)}まで上がったね。もう一度、クラスを上げていこう！`;
  if (runs > 0) return 'もう一度、入会試験から。今度はA2まで行こうね！';
  return '研修会は、プロを目指す子たちの会。クラスを上げて、A2に上がったら奨励会に入れるよ';
}

/** 受験クラスを選んだときの一言(近道と、試験の相手の強さ)。 */
export function entryClassTalk(cls, recommended) {
  const label = classLabel(cls);
  if (cls === recommended) return `${label}受験がおすすめ。あなたの棋力にちょうどいいよ`;
  if (cls > recommended) return `${label}から受けるんだね。上のクラスほどA2に近いけど、試験の相手も強いよ`;
  return `${label}から、じっくり上がっていくんだね。試験で全勝すれば、1つ上から入れるよ`;
}

/**
 * 次の1局の、やこび姫の一言。
 * @param {any} view describeKenshukaiの形
 */
export function pendingTip(view) {
  const pending = view?.pending;
  if (!pending) return '';
  const opponent = pending.opponent;
  if (pending.kind === 'exam') {
    const exam = view.exam;
    const left = exam.games - exam.results.length;
    if (exam.results.length === 0) return `入会試験は${exam.games}局。落ちることはないよ。成績しだいで、入るクラスが上下するんだ`;
    if (exam.wins >= exam.up) return `もう${exam.upLabel}から入れるよ！ 残りもいつもどおりに`;
    if (exam.wins + left >= exam.up) return `全部勝てば、${exam.upLabel}から入れるよ。あと${left}局！`;
    return `あと${left}局。1つでも多く勝って、いいクラスから始めよう`;
  }
  if (pending.kind === 'shido') {
    if (!pending.handicap) return `${opponent?.name}先生との指導対局。平手だよ！ 胸を借りるつもりで、思いきり指そう`;
    return `${opponent?.name}先生との指導対局（${pending.handicapLabel}）。上手は駒が少ないぶん、こちらが先に攻めよう！`;
  }
  if (opponent?.peer) return `同期の${opponent.name}さんとの対決！ 先に上がるのはどっち？`;
  if (pending.stakes.warning) return view.point
    ? '降級点があるから、ここは踏んばりどころ。勝てば流れが変わるよ'
    : `${pending.stakes.warning}。でも、勝てば大丈夫。落ち着いて！`;
  if (pending.stakes.win) return `この一局に勝てば、${pending.stakes.win}！`;
  if (view.progress?.streak >= 2) return `${view.progress.streak}連勝中！ この調子で${view.nextClassLabel}まで行こう`;
  return `${view.nextClassLabel}まであと${view.progress?.winsLeft ?? '?'}勝。1局ずつね`;
}

/** 編入の札の一言(A2以上)。 */
export function transferTalk(view) {
  if (!view?.qualified) return '';
  if (view.phase === 'top') return 'Sクラス、研修会のいちばん上だよ！ 奨励会6級に、いつでも編入できるよ';
  return '奨励会6級に、試験なしで編入できるよ。研修会でSクラスを目指してもいいんだ';
}

/**
 * 対局から戻ったときの判子(1局の出来事のうち、いちばん大きいもの)。
 * @param {{ kind: string, cls?: number, delta?: number, mark?: string, text: string }[]} events
 * @returns {null | { seal: string, title: string, sub: string, weight: 'mid' | 'big' | 'max', tone: 'good' | 'soft' }}
 */
export function eventStamp(events = []) {
  const order = ['top', 'qualify', 'join', 'promote', 'shido-win', 'clear', 'demote', 'point'];
  const event = [...events].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))[0];
  if (!event) return null;
  switch (event.kind) {
    case 'top': return { seal: 'S', title: 'Sクラスに昇級！', sub: '研修会の頂点。修了証をもらおう', weight: 'max', tone: 'good' };
    case 'qualify': return { seal: 'A2', title: 'A2クラスに昇級！', sub: '奨励会6級に、試験なしで編入できる', weight: 'max', tone: 'good' };
    case 'join': return {
      seal: '入会',
      title: `${classLabel(event.cls ?? 0)}クラスで入会！`,
      sub: event.delta > 0 ? '試験の成績で、1つ上のクラスから' : event.delta < 0 ? '1つ下のクラスから、じっくり上がろう' : '今日から研修会員',
      weight: 'big',
      tone: 'good',
    };
    case 'promote': return { seal: '昇級', title: `${classLabel(event.cls ?? 0)}クラスに昇級！`, sub: event.mark ? `${event.mark}で` : '', weight: (event.cls ?? 0) >= 8 ? 'big' : 'mid', tone: 'good' };
    case 'shido-win': return { seal: '指導', title: '指導対局で勝った！', sub: event.text, weight: 'mid', tone: 'good' };
    case 'clear': return { seal: '解消', title: '降級点が消えた！', sub: '流れが戻ってきたね', weight: 'mid', tone: 'good' };
    case 'demote': return { seal: '降級', title: event.text, sub: 'もう一度、上がろう', weight: 'mid', tone: 'soft' };
    case 'point': return { seal: '点', title: '降級点がついた', sub: '勝ち越せば消えるよ', weight: 'mid', tone: 'soft' };
    default: return null;
  }
}

/** 頂点(S)の画面の見出し。 */
export const TOP_LABEL = classLabel(TOP);
