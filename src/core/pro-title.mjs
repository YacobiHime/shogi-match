// 棋士の1年のタイトルの記録(防衛・獲得・奪還・失冠・届かず)と永世称号(docs/pro-year-design.mdの19章)。
// 画面・保存の仕組みに依存しない。数えるのは番勝負が終わったとき(pro-year.mjsのfinishStage)の1か所。

/**
 * 永世称号の条件(実物の規定。2026-11-13にWebで確かめた。叡王は公式の規定を確かめられず、仮に連続5期)。
 * streakは連続の期数、totalは通算の期数。どちらかに届けば資格。
 */
export const ETERNAL_RULES = Object.freeze({
  ryuo: { name: '永世竜王', streak: 5, total: 7 },
  meijin: { name: '永世名人', total: 5 },
  oi: { name: '永世王位', streak: 5, total: 10 },
  oza: { name: '名誉王座', streak: 5, total: 10 },
  kio: { name: '永世棋王', streak: 5 },
  osho: { name: '永世王将', total: 10 },
  kisei: { name: '永世棋聖', total: 5 },
  eio: { name: '永世叡王', streak: 5 },
});

/** 番勝負の結果の種類。 */
export const TITLE_KINDS = Object.freeze(['defend', 'take', 'retake', 'lost', 'miss']);
/** タイトルを手にした結果(賞状・賞金・判子のあるもの)。 */
export const isTitleWin = (kind) => kind === 'defend' || kind === 'take' || kind === 'retake';

/** 1つのタイトルの記録の空の形。 */
export const emptyTitleRecord = () => ({ total: 0, streak: 0, best: 0, defenses: 0, first: null, eternal: null });

/**
 * 番勝負のプレイヤーの結果の種類。holderは番勝負の保持者の側にプレイヤーがいたか、wonは勝ったか、
 * everHeldは前に持ったことがあるか(取り返したら「奪還」)。
 * @param {{ holder: boolean, won: boolean, everHeld: boolean }} input
 * @returns {'defend' | 'take' | 'retake' | 'lost' | 'miss'}
 */
export function titleKind({ holder, won, everHeld }) {
  if (holder) return won ? 'defend' : 'lost';
  if (!won) return 'miss';
  return everHeld ? 'retake' : 'take';
}

/**
 * 記録に1期の結果を足す(新しい記録を返す。永世称号に届いた年度もここで決める)。
 * @param {any} record
 * @param {{ event: string, kind: string, fy: number }} input
 */
export function applyTitleResult(record, { event, kind, fy }) {
  const next = { ...emptyTitleRecord(), ...(record ?? {}) };
  if (isTitleWin(kind)) {
    next.total += 1;
    next.streak = kind === 'defend' ? next.streak + 1 : 1;
    next.best = Math.max(next.best, next.streak);
    if (kind === 'defend') next.defenses += 1;
    if (next.first === null) next.first = fy;
    if (next.eternal === null && eternalReached(event, next)) next.eternal = fy;
  } else if (kind === 'lost') {
    next.streak = 0;
  }
  return next;
}

/** 永世称号の条件に届いているか。 */
export function eternalReached(event, record) {
  const rule = ETERNAL_RULES[event];
  if (!rule || !record) return false;
  return Boolean((rule.streak && record.streak >= rule.streak) || (rule.total && record.total >= rule.total));
}

/**
 * 永世称号までの残り(棋戦の画面と防衛戦の札。19-3の5)。届いていれば reached。
 * 連続と通算の近いほうを言う。持っていない(連続が0の)ときは、連続は「あと5期」から数える。
 * @param {string} event
 * @param {any} record
 * @returns {{ name: string, reached: boolean, left: number, way: 'streak' | 'total' | null, text: string } | null}
 */
export function eternalProgress(event, record) {
  const rule = ETERNAL_RULES[event];
  if (!rule) return null;
  const now = { ...emptyTitleRecord(), ...(record ?? {}) };
  if (now.eternal !== null || eternalReached(event, now)) return { name: rule.name, reached: true, left: 0, way: null, text: `${rule.name}の資格あり` };
  const ways = [];
  if (rule.streak) ways.push({ way: 'streak', left: rule.streak - now.streak });
  if (rule.total) ways.push({ way: 'total', left: rule.total - now.total });
  const best = ways.sort((a, b) => a.left - b.left || (a.way === 'streak' ? -1 : 1))[0];
  const both = rule.streak && rule.total ? (best.way === 'streak' ? '（連続）' : '（通算）') : '';
  return { name: rule.name, reached: false, left: best.left, way: best.way, text: `${rule.name}まで あと${best.left}期${both}` };
}

/** 永世称号の条件の言葉(「連続5期・通算7期」)。 */
export function eternalRuleText(event) {
  const rule = ETERNAL_RULES[event];
  if (!rule) return '';
  return [rule.streak ? `連続${rule.streak}期` : '', rule.total ? `通算${rule.total}期` : ''].filter(Boolean).join('・');
}

const NUMERALS = ['', '一', '二', '三', '四', '五', '六', '七', '八'];
/** 同時に持つタイトルの数の呼び方(2以上。8は「八冠」)。 */
export const crownsLabel = (count) => (count >= 2 ? `${NUMERALS[count] ?? count}冠` : '');

/**
 * 番勝負の結果の言葉(節目の行・判子・札の見出し)。scoreは[あなたの勝ち, 負け]。
 * @param {{ kind: string, short: string, streak?: number, score?: number[] }} input
 */
export function titleResultText({ kind, short, streak = 0, score = [0, 0] }) {
  const [w, l] = score;
  if (kind === 'defend') return `${short}を防衛${streak >= 2 ? `（${streak}連覇）` : ''}`;
  if (kind === 'take') return `${short}を獲得`;
  if (kind === 'retake') return `${short}を奪還`;
  if (kind === 'lost') return `${short}を失冠`;
  return `${short}への挑戦は${w}勝${l}敗で届かず`;
}

/** 判子の大きな字と短い言葉(終局の判子・結果の札)。 */
export const TITLE_SEALS = Object.freeze({
  defend: { seal: '防', word: '防衛' },
  take: { seal: '冠', word: '獲得' },
  retake: { seal: '冠', word: '奪還' },
  lost: { seal: '', word: '失冠' },
  miss: { seal: '', word: '挑戦' },
});

/**
 * やこび姫の一言(結果の札。羽音でないので「！」を使う。負けは責めない。G:5・G:7)。
 * @param {{ kind: string, short: string, streak?: number, total?: number, first?: boolean }} input
 */
export function titleCoachLine({ kind, short, streak = 0, total = 0, first = false }) {
  if (kind === 'defend') {
    if (streak >= 5) return `${streak}連覇！ ${short}は、もうあなたの代名詞だね。`;
    if (streak >= 2) return `${streak}連覇！ 勢いに乗った挑戦者を、しっかり受け止めたね。`;
    return `初防衛！ 取るより守るほうが難しいって言うけど、守り切ったね。`;
  }
  if (kind === 'take') return first ? 'はじめてのタイトル！ 今日からあなたは、タイトルホルダーだよ。' : `${short}も獲得！ タイトルがまた1つ増えたね。`;
  if (kind === 'retake') return `${short}を取り返したね！ 一度失ったものを取り返すのは、ほんとうに強い人だけだよ。`;
  if (kind === 'lost') return total >= 2 ? `${total}期のあいだ、${short}を守ってきたね。次の期は挑戦者決定の終盤から出られるよ。取り返しに行こう。` : `${short}は手放したけど、次の期は挑戦者決定の終盤から出られるよ。取り返しに行こう。`;
  return 'ここまで来たことが、まずすごいよ。次の挑戦の権利を取りに行こう。';
}

/**
 * 番勝負の途中の言葉(「防衛まであと1勝」「カド番」。結果の札・終局の窓)。
 * @param {{ me: number, them: number, need: number, defense: boolean }} series
 */
export function seriesStatusText({ me, them, need, defense }) {
  const goal = defense ? '防衛' : 'タイトル';
  if (me >= need) return defense ? '防衛' : '奪取';
  if (them >= need) return defense ? '失冠' : '届かず';
  if (me === need - 1 && them === need - 1) return '次で決まる';
  if (me === need - 1) return `${goal}まであと1勝`;
  if (them === need - 1) return 'カド番';
  return `${goal}まであと${need - me}勝`;
}
