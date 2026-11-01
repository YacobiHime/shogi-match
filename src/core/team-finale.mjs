// 団体戦の試合の結果発表と、自分が先に終わったときに仲間の盤を見守る(docs/team-battle-design.mdの19章)。画面に依存しない。
// 結果発表の記録(run.finale)は、試合が決まったときに team-battle.mjs の recordTeamGame・chooseTeamPlayer が作る。
// ここでは、その記録から画面の形(席の行・決めた局・羽音と百花の一言)と、見守る盤の進み方を決める。
// 羽音は敬語と「！」なし、プレイヤーを「君」と呼ぶ(docs/hanane-character.md)。百花は明るく「！」を使い、名前に「さん」(0章)。

import { SCHOOL_SEATS, TEAM_HANANE_ID, TEAM_MOMOKA_ID } from './team-battle.mjs';
import { peekBoardsOf } from './team-peek.mjs';

/** 見守る盤の時計: 自分の手数の代わりに、この時間で1つ進む(19章の6)。 */
export const FINALE_TICK_MS = 1200;
/** 「早送り」の倍率。 */
export const FINALE_FAST = 4;
/** 結果発表で、席(局)の行を1つ出す間(高校・プロ)。 */
export const FINALE_ROW_MS = Object.freeze({ school: 500, pro: 250 });
/** 見ている盤が終わってから、まだ続いている盤へ移るまで。 */
export const FINALE_SWITCH_MS = 1500;
/** 全部の盤が終わってから、結果発表に移るまで。 */
export const FINALE_ANNOUNCE_DELAY_MS = 1200;
/** 盤を作り終わらないとき、知らせる手数からこれだけ(時計の目盛り)待ったら、結果は出す。 */
export const FINALE_GRACE = 12;

const shortName = (name) => String(name ?? '').replace(/^天鷺|^桜乃/, '');

/**
 * 結果発表の画面の形。まだ見ていない結果発表がなければnull。
 * @param {any} run 団体戦の大会
 * @param {{ playerName?: string }} [options]
 */
export function teamFinaleView(run, { playerName = '' } = {}) {
  const finale = run?.finale;
  if (!finale || finale.seen) return null;
  const players = run.players ?? {};
  const school = finale.format === 'school';
  const you = playerName || 'あなた';
  const rows = finale.rows.map((row, index) => {
    const us = players[row.us];
    const them = players[row.them];
    return {
      index,
      label: school ? SCHOOL_SEATS[row.seat] ?? '' : `第${row.no}局`,
      seat: row.seat,
      us: { id: row.us, name: row.user ? you : us?.name ?? '', short: row.user ? you : shortName(us?.name), you: row.user, story: us?.story ?? null },
      them: { id: row.them, name: them?.name ?? '', dan: them?.dan ?? '' },
      won: row.won,
      user: row.user,
      reveal: row.reveal,
      decisive: index === finale.decidedBy,
      // 自分が終わったとき、まだ対局中だった仲間の局(終局後に見守る)。
      pending: school && !row.user && Number.isFinite(finale.userPly) && Number.isFinite(row.reveal) && row.reveal >= finale.userPly,
    };
  });
  const usName = run.teams?.[finale.us]?.name ?? '';
  const themName = run.teams?.[finale.them]?.name ?? '';
  const decisive = rows.find((row) => row.decisive) ?? null;
  const userRow = rows.find((row) => row.user) ?? null;
  return {
    id: finale.id,
    format: finale.format,
    label: finale.label,
    usName,
    themName,
    rows,
    score: { ...finale.score },
    teamWon: Boolean(finale.teamWon),
    scoreText: `${finale.score.us}勝${finale.score.them}敗`,
    verdict: finale.teamWon ? `${usName}の勝ち` : `${themName}の勝ち`,
    decisiveText: decisiveText(decisive, finale.teamWon, school),
    after: finale.after ?? '',
    userPly: finale.userPly,
    watch: rows.some((row) => row.pending),
    lines: finaleLines({ format: finale.format, teamWon: Boolean(finale.teamWon), rows, decisive, userWon: userRow ? userRow.won : null, playerName }),
  };
}

/** 決めた局の一言(「あなたの勝ちで決まった」「決勝点 三将 百花」)。 */
function decisiveText(row, teamWon, school) {
  if (!row) return '';
  const where = school ? `${row.label}戦` : row.label;
  if (teamWon) return row.user ? 'あなたの勝ちで決まった' : `決勝点 ${where} ${row.us.short}`;
  return row.user ? '' : `${where}で決着`;
}

/**
 * 羽音と百花の一言(結果発表の最後。19章の7)。プロは羽音だけ(百花はプロのチームにいない)。
 * @param {{ format: string, teamWon: boolean, rows: any[], decisive: any, userWon: boolean | null, playerName?: string }} options
 * @returns {{ who: 'hanane' | 'momoka', text: string }[]}
 */
export function finaleLines({ format, teamWon, rows, decisive, userWon, playerName = '' }) {
  const name = playerName ? `${playerName}さん` : 'あなた';
  const rowOf = (id) => rows.find((row) => row.us.id === id) ?? null;
  const hanane = rowOf(TEAM_HANANE_ID);
  const momoka = rowOf(TEAM_MOMOKA_ID);
  const by = decisive?.user ? 'user' : decisive?.us.id ?? null;
  const lines = [];
  // 羽音
  let h;
  if (teamWon && by === 'user') h = '決めたのは君だよ。……ちょっと、悔しいくらい';
  else if (teamWon && by === TEAM_HANANE_ID) h = '私の勝ちで決まった。……でも、3人で取った勝ちだよ';
  else if (teamWon && hanane && !hanane.won) h = '私が落としたのに、勝てた。二人のおかげだね';
  else if (teamWon && userWon) h = '君の白星、ちゃんと見てた。いい将棋だったね';
  else if (teamWon) h = '大丈夫。団体戦は、3人で勝てばいいでしょ';
  else if (userWon) h = '君は勝ったのに……ごめん。次は私が取り返す';
  else h = '負けは負け。……次の一局は、もう始まってるよ';
  if (format === 'pro') h = teamWon ? (by === 'user' ? h : 'いい試合だった。次も、このチームでいこう') : '負けた。……次は、もっと上手く回そう';
  lines.push({ who: 'hanane', text: h });
  if (format !== 'school') return lines;
  // 百花
  let m;
  if (teamWon && by === TEAM_MOMOKA_ID) m = 'えっ、私の勝ちで決まったの！？ やった……！';
  else if (teamWon && by === 'user') m = `${name}、すごい！ 決めちゃった！`;
  else if (teamWon && momoka && !momoka.won) m = '私は負けちゃったけど……二人とも、ありがとう！';
  else if (teamWon) m = 'やったー！ 3人の勝ちだね！';
  else if (momoka?.won) m = '私は勝てたのに……うう、悔しい！ 次は3人で勝とう！';
  else m = 'うう、悔しい……！ でも、次はきっと勝てるよ！';
  lines.push({ who: 'momoka', text: m });
  return lines;
}

/**
 * 見守る仲間の盤(チラ見と同じ形。終局後もまだ対局中だった局だけ)。
 * @param {any} run 団体戦の大会
 */
export function finaleBoards(run) {
  const finale = run?.finale;
  if (!finale || finale.seen || finale.format !== 'school' || !Number.isFinite(finale.userPly)) return [];
  const boards = finale.rows
    .filter((row) => !row.user && Number.isFinite(row.reveal) && row.reveal >= finale.userPly)
    .map((row) => ({ seat: row.seat, seatName: SCHOOL_SEATS[row.seat], us: row.us, them: row.them, won: row.won, reveal: row.reveal }));
  return peekBoardsOf(run, boards, finale.id);
}

/**
 * 見守る盤の時計(自分の手数の代わり)。終局の手数から、経った時間で進む。
 * @param {{ userPly: number, elapsedMs: number, tickMs?: number }} options
 */
export function finaleClock({ userPly, elapsedMs, tickMs = FINALE_TICK_MS }) {
  return userPly + Math.max(0, elapsedMs) / tickMs;
}

/**
 * 見守る盤の1つが終わったか。知らせる手数まで時計が進み、盤を作り終えた(作れなかった・待ちすぎた)とき。
 * @param {{ clock: number, reveal: number, ended: boolean, failed?: boolean, noEngine?: boolean }} options
 */
export function finaleBoardSettled({ clock, reveal, ended, failed = false, noEngine = false }) {
  if (clock < reveal) return false;
  return ended || failed || noEngine || clock >= reveal + FINALE_GRACE;
}

/**
 * 結果発表の行を出し終える時間(ミリ秒)。最後のチームの結果は、行のあとにもう1つ分。
 * @param {{ format: string, rows: unknown[] }} view
 */
export function finaleRevealMs(view) {
  const step = FINALE_ROW_MS[view.format === 'pro' ? 'pro' : 'school'];
  return step * (view.rows.length + 1);
}
