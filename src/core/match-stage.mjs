// 大会の対局の舞台(docs/match-stage-design.md)。竜王戦・名人戦の1局を、ふつうの対局と見分けられる形にする。
// 重さは3段階: ふつうの1局(plain)は対局の札だけ、大一番(big)は開幕の札も、タイトル戦(title)は対局場・和室の背景・封じ手・肩書の名札も。
// 期の保存形式は読むだけで、書き換えない。画面には、対局を始めたときに作った舞台をそのまま持たせる(終局後に次の局へ変わらないように)。

import { USER_ID } from './ryuo.mjs';

/** 二日制のタイトル戦で、1日目を終える手数。この手数を越えて最初に指したプレイヤーの手を、封じ手にする。 */
export const STAGE_SEAL_PLY = 40;
/** 開幕の札と封じ手の札を出しておく時間。振り駒の知らせ(FURIGOMA_SHOW_MS)とそろえる。 */
export const STAGE_CARD_MS = 1800;

const EVENTS = Object.freeze({
  ryuo: { name: '竜王戦', title: '竜王' },
  meijin: { name: '名人戦', title: '名人' },
  // 奨励会(docs/shoreikai-design.md)。タイトル戦はない。期の番号の代わりに、いまの段階の名前(pending.eventText)を出す。
  shoreikai: { name: '奨励会', title: '四段' },
});

/**
 * タイトル戦の対局場。タイトル戦は、全国の旅館・ホテル・お寺をまわって指す(実在の会場の名前は使わず、土地と様子だけ)。
 * 期と局の番号で決まるので、同じ局はいつも同じ対局場になる。
 */
export const STAGE_VENUES = Object.freeze([
  '東京・庭園のある料亭',
  '京都・古いお寺の大広間',
  '福岡・海の見えるホテル',
  '北海道・湖のほとりの宿',
  '山形・桜の城下町の旅館',
  '静岡・富士山の見えるホテル',
  '鹿児島・湯けむりの宿',
  '新潟・雪見の宿',
  '石川・茶室のある料亭',
  '大阪・お城の見える料亭',
  '奈良・古いお寺の書院',
  '広島・瀬戸内の島の宿',
  '宮城・松島をのぞむ宿',
  '長野・高原のホテル',
]);

function hashText(text) {
  let hash = 2166136261;
  for (const char of text) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** 期と局で決まる対局場。 */
export function stageVenue(event, no, gameNo) {
  return STAGE_VENUES[hashText(`${event}:${no}:${gameNo}`) % STAGE_VENUES.length];
}

/**
 * 番勝負の、この1局に賭けているもの。tone: final(最終局) / reach(あと1勝) / kadoban(負ければ終わり) / ''。
 * @param {{ need: number, winsUser: number, winsOpponent: number, goal: string, finish: string, prize: string }} input
 *   goalは「竜王」「防衛」「挑戦者」など、あと何勝の前に付ける言葉。finishは、勝てば決まるときの言葉(「竜王」「竜王を防衛」など)。
 *   prizeは、最終局で勝ったほうが手にするもの(「竜王」「挑戦者」)。
 */
export function seriesStakes({ need, winsUser, winsOpponent, goal, finish, prize }) {
  const myLeft = Math.max(1, need - winsUser);
  const theirLeft = Math.max(1, need - winsOpponent);
  if (myLeft === 1 && theirLeft === 1 && need > 1) return { tone: 'final', text: `最終局・勝ったほうが${prize}` };
  if (myLeft === 1) return { tone: 'reach', text: `勝てば${finish}` };
  if (theirLeft === 1) return { tone: 'kadoban', text: 'カド番・負ければ終わり' };
  return { tone: '', text: `${goal}まであと${myLeft}勝` };
}

/**
 * 対局を始めるときの舞台。期の保存形式から、対局の札・開幕の札・名札・やこび姫の一言を作る。
 * stakesは、期の画面と同じ「この1局に賭けているもの」(竜王戦はpendingStakes、名人戦はdescribeMeijinSeasonのstakes)。
 * @param {{
 *   event: 'ryuo' | 'meijin' | 'shoreikai', season: any, label?: string, userName?: string,
 *   stakes?: { goal?: string, win?: string, text?: string, boss?: boolean } | null,
 * }} input
 */
export function describeMatchStage({ event, season, label = '', userName = '', stakes = null }) {
  const pending = season?.pending;
  if (!pending) return null;
  const info = EVENTS[event] ?? EVENTS.ryuo;
  const opponent = season.players?.[pending.opponentId] ?? null;
  const you = userName || 'あなた';
  const stageLabel = label || pending.label || '';
  const series = pending.kind === 'finals' ? season.finals
    : pending.kind === 'playoff' && event === 'ryuo' ? season.playoff
      : null;
  const title = pending.kind === 'finals' && Boolean(series);
  const seriesInfo = series ? (() => {
    const winsUser = series.wins?.[USER_ID] ?? 0;
    const winsOpponent = series.wins?.[pending.opponentId] ?? 0;
    const defense = title && series.a === USER_ID;
    const goal = title ? (defense ? '防衛' : info.title) : '挑戦者';
    const finish = title ? (defense ? `${info.title}を防衛` : info.title) : '挑戦者';
    return {
      need: series.need,
      winsUser,
      winsOpponent,
      defense,
      marks: (series.games ?? []).map(({ winner }) => (winner === USER_ID ? 'win' : 'loss')),
      gameNo: (series.games ?? []).length + 1,
      ...seriesStakes({ need: series.need, winsUser, winsOpponent, goal, finish, prize: title ? info.title : '挑戦者' }),
    };
  })() : null;
  const weight = title ? 'title' : series || pending.kind === 'playoff' || stakes?.boss ? 'big' : 'plain';
  // 大一番は「勝てば○○」、ふつうの1局は「目標まであと何勝」(期の画面と同じ言葉)。
  const winText = stakes?.win ? `勝てば${stakes.win.replace(/[！!]$/, '')}` : '';
  const stakesText = seriesInfo?.text ?? ((weight === 'big' && winText) || stakes?.goal || stakes?.text || '');
  const tone = seriesInfo?.tone ?? '';
  // タイトル戦では、タイトルを持っている側に肩書を付ける(竜王 ○○・挑戦者 ○○)。
  const holderIsUser = title && seriesInfo?.defense === true;
  const opponentRole = title ? (holderIsUser ? '挑戦者' : info.title) : '';
  const userRole = title ? (holderIsUser ? info.title : '挑戦者') : '';
  const opponentName = opponent?.name ?? '';
  const sides = title
    ? [
      { role: info.title, name: holderIsUser ? you : opponentName, you: holderIsUser },
      { role: '挑戦者', name: holderIsUser ? opponentName : you, you: !holderIsUser },
    ]
    : [{ role: 'あなた', name: you, you: true }, { role: opponent?.dan ?? '', name: opponentName, you: false }];
  return {
    event,
    weight,
    eventText: event === 'shoreikai' ? pending.eventText ?? info.name : `第${season.no}期 ${info.name}`,
    label: stageLabel,
    // 札では、大会の名前と重ねない(「第7期 竜王戦」の下の「七番勝負 第3局」)。
    shortLabel: stageLabel.startsWith(info.name) ? stageLabel.slice(info.name.length) : stageLabel,
    venue: title ? stageVenue(event, season.no, seriesInfo?.gameNo ?? 1) : '',
    twoDay: title,
    marks: seriesInfo?.marks ?? [],
    need: seriesInfo?.need ?? 0,
    score: seriesInfo && seriesInfo.marks.length ? `${seriesInfo.winsUser}勝${seriesInfo.winsOpponent}敗` : '',
    stakes: stakesText,
    tone,
    sides,
    opponentRole,
    userRole,
    scenery: stageScenery(event, pending, title),
    longestDay: event === 'meijin' && pending.kind === 'league' && season.cls === 'A' && pending.round === season.rounds - 1,
    coachLine: stageCoachLine({ weight, tone, title: info.title, label: stageLabel, stakesText, win: stakes?.win ?? '', first: seriesInfo ? seriesInfo.marks.length === 0 : false, defense: holderIsUser }),
  };
}

/**
 * 背景の景色(docs/tournament-match-presence-design.mdの5章)。
 * 竜王戦は勝ち上がるほど山の上へ(麓・中腹・雪の稜線)、名人戦は暮れていく空、タイトル戦は今の金屏風。
 * 奨励会は道場(畳と木の壁)。三段リーグだけは、名人戦と同じ暮れていく空(夕方の将棋会館。docs/shoreikai-design.mdの7-2)。
 */
function stageScenery(event, pending, title) {
  if (title) return 'title';
  if (event === 'shoreikai') return pending.kind === 'league' ? 'sky' : 'dojo';
  if (event === 'meijin') return 'sky';
  if (pending.kind === 'playoff') return 'snow';
  if (pending.phase === 'main') return 'mid';
  return 'foot';
}

/** 名人戦の空の色の段(手数で暮れる)。昼・夕方・夜・深夜。 */
export const SKY_PHASE_PLIES = Object.freeze({ evening: 40, night: 80, midnight: 120 });
/**
 * @param {number} ply いまの手数
 * @returns {"day" | "evening" | "night" | "midnight"}
 */
export function skyPhase(ply) {
  if (ply > SKY_PHASE_PLIES.midnight) return 'midnight';
  if (ply > SKY_PHASE_PLIES.night) return 'night';
  if (ply > SKY_PHASE_PLIES.evening) return 'evening';
  return 'day';
}

/** 対局を始めたときの、やこび姫の一言。ふつうの1局は、いつもの一言のまま(null)。 */
function stageCoachLine({ weight, tone, title, label, stakesText, win, first, defense }) {
  if (weight === 'plain') return null;
  if (weight === 'title') {
    if (tone === 'final') return `最終局。勝ったほうが${title}だよ。思いきりいこう！`;
    if (tone === 'reach') return defense ? `あと1勝で防衛だよ。いつもどおりにね！` : `あと1勝で${title}！ 落ち着いていこう`;
    if (tone === 'kadoban') return 'カド番だね。この1局だけに集中しよう！';
    if (first) return `${label}。${title}をかけた大舞台だよ。いつもどおりにね！`;
    return `${label}。${stakesText}だよ！`;
  }
  if (tone === 'reach') return `${stakesText}！ ここが大一番だよ`;
  if (tone === 'kadoban') return 'カド番だね。この1局に集中しよう！';
  if (win) return `大一番だね。${stakesText}だよ！`;
  return `大一番だね。${stakesText}！`;
}

/**
 * 封じ手にするプレイヤーの手の手数(指したあとの手数)。STAGE_SEAL_PLYを越えて、最初にプレイヤーが指した手。
 * 先手のプレイヤーの手は、指したあとの手数が奇数になる。
 * @param {'black' | 'white'} userColor
 */
export function stageSealPly(userColor) {
  const first = STAGE_SEAL_PLY + 1;
  const odd = first % 2 === 1;
  return (userColor === 'black') === odd ? first : first + 1;
}

/** いまの手数での、二日制の何日目か。二日制でないときは空。 */
export function stageDay(stage, ply, userColor) {
  if (!stage?.twoDay) return '';
  return ply >= stageSealPly(userColor) ? '2日目' : '1日目';
}
