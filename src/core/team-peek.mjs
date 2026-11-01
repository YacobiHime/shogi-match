// 団体戦の仲間の盤のチラ見(docs/team-battle-design.mdの14章)。高校の団体戦で、自分の対局のあいだに隣の羽音・百花の盤をのぞく。
// 仲間の局の勝ち負けは大会が決めてある(pending.teamBoardsのwon)。その勝ち負けに沿って、中継と同じ軽いエンジンで棋譜を作り
// (useRelayGenerator)、自分の手数に合わせて進める。速報の手数(reveal)より先に結果を見せない。保存しない(種から毎回同じ)。
// 羽音は敬語と「！」なし(docs/hanane-character.md)、百花は明るく「！」を使い、プレイヤーを名前に「さん」で呼ぶ(0章)。

import { HANANE } from './ryuo-story.mjs';
import { attackStyleLabel } from './player-character.mjs';

/** 仲間の局の長さの見込み(作り終わる前に、盤の進み方を決めるため)。 */
export const PEEK_EXPECTED_PLIES = 110;

/** 文字列から決まる数。 */
function textSeed(text) {
  let hash = 2166136261;
  for (const ch of String(text)) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
  return hash >>> 0;
}

const relayPlayer = (player, id) => ({
  id, name: player?.name ?? '', dan: player?.dan ?? '', rating: player?.rating ?? 0, level: null, story: player?.story ?? null,
  kind: player?.kind ?? 'student', age: player?.age ?? null, character: player?.character ?? null, repertoire: player?.repertoire ?? null, held: [],
});

/**
 * のぞける仲間の盤(高校の団体戦の対局中だけ。席の順)。specは中継の局の設定(棋譜を作る)。
 * @param {any} run 団体戦の大会
 * @returns {{ seat: number, seatName: string, usId: string, themId: string, usName: string, themName: string, won: boolean, reveal: number, usColor: 'black' | 'white', spec: any }[]}
 */
export function peekBoards(run) {
  if (run?.format !== 'school') return [];
  return peekBoardsOf(run, run?.pending?.teamBoards ?? [], run.current ?? '');
}

/**
 * 仲間の盤(試合のidと、席ごとの顔ぶれ・勝ち負け・知らせる手数から)。対局中のチラ見と、終局後に見守る盤(19章)で同じ鍵を使い、
 * 作った棋譜(中継の保存)を使い回す。
 * @param {any} run 団体戦の大会
 * @param {{ seat: number, seatName: string, us: string, them: string, won: boolean, reveal?: number | null }[]} boards
 * @param {string} matchId 試合のid
 */
export function peekBoardsOf(run, boards, matchId) {
  return [...boards].sort((a, b) => a.seat - b.seat).map((board) => {
    const key = `team-peek:${run.id ?? ''}:${matchId}:${board.seat}`;
    const seed = textSeed(key);
    const usColor = seed % 2 === 0 ? 'black' : 'white';
    const us = relayPlayer(run.players?.[board.us], board.us);
    const them = relayPlayer(run.players?.[board.them], board.them);
    const winnerColor = board.won ? usColor : usColor === 'black' ? 'white' : 'black';
    return {
      seat: board.seat,
      seatName: board.seatName,
      usId: board.us,
      themId: board.them,
      usName: us.name,
      themName: them.name,
      won: Boolean(board.won),
      reveal: board.reveal ?? 60,
      usColor,
      spec: {
        key, event: 'team', kind: 'game', label: `${board.seatName}戦`, section: 'team', order: board.seat, round: 0, weight: 'plain', venue: '', gameNo: 0,
        seed, series: null, quality: '', titleName: '',
        black: usColor === 'black' ? us : them,
        white: usColor === 'black' ? them : us,
        winner: winnerColor,
        openings: { black: null, white: null }, castles: { black: null, white: null },
        story: null, how: 'ending', noNews: true,
        tags: { rival: board.us === 'hanane' || us.story === HANANE, father: false, oshi: false, next: false, self: false, current: false },
      },
    };
  });
}

/**
 * 盤に見せる手数。自分の手数に合わせて進み(仲間の局の長さ÷速報の手数の速さ)、速報の手数までは終局を見せない。
 * @param {{ userPly: number, reveal: number, generated: number, finalPlies?: number | null }} options
 */
export function peekShownPlies({ userPly, reveal, generated, finalPlies = null }) {
  if (userPly >= reveal) return generated;
  const length = finalPlies ?? Math.max(generated, PEEK_EXPECTED_PLIES);
  return Math.max(0, Math.min(generated, finalPlies ? finalPlies - 1 : generated, Math.floor((userPly * length) / Math.max(1, reveal))));
}

// ---- 心の声

/** 口調(羽音・百花・相手の棋風)。 */
export function peekVoice(player) {
  if (player?.story === HANANE || player?.id === 'hanane') return 'hanane';
  if (player?.story === 'momoka' || player?.id === 'momoka') return 'momoka';
  const style = attackStyleLabel(player?.character?.attack);
  if (style.includes('攻め')) return 'attack';
  if (style.includes('受け')) return 'defense';
  return 'balance';
}

/** 場面ごとの心の声。{name}は百花がプレイヤーを呼ぶ名前(名前に「さん」。名前がないときは「あなた」)。羽音はいつも「君」。 */
const PEEK_THOUGHTS = Object.freeze({
  hanane: {
    start: ['いつも通りでいい', '君の盤も気になるけど……今は自分の盤だ'],
    think: ['もう少し、深く読もう', 'ここは、確かめてからにしよう', 'この局面、ちょっと面白いね'],
    ahead: ['このまま、正確にいこう', '大丈夫。読めてる'],
    behind: ['ふぅん……そう来るんだ', '苦しいけど、まだ手はあるでしょ'],
    chance: ['え、見えた', '今の、甘かったでしょ'],
    regret: ['ああ……今の、甘かった', '読み抜けか。まぁ、取り返せばいい'],
    win: ['よし、勝った。あとは君の盤だね', '勝ったよ。……君、そっちはどう？'],
    loss: ['……私の負け。ごめん、あとは任せた', '悔しいけど、負けだ。次は勝つから'],
  },
  momoka: {
    start: ['よーし、楽しんで指そう！', '羽音ちゃんも{name}もいるから、大丈夫！'],
    think: ['えっと、えっと……どれがいいんだろう？', 'ここ、教わった形に似てるかも！', '落ち着いて、落ち着いて……！'],
    ahead: ['あれ、もしかして私、いい感じ！？', 'このまま、このまま……！'],
    behind: ['うう、どうしよう……でも、まだ投げない！', '羽音ちゃんなら、ここでどう指すかな……？'],
    chance: ['今の、チャンスかも！', 'あっ、その手、待ってた！'],
    regret: ['あっ、今の失敗だったかも……', 'うそ、そこ取られちゃう！？'],
    win: ['やった、勝てた！ {name}、見てた！？', '勝った……！ チームの役に立てた！'],
    loss: ['負けちゃった……。ごめんね、{name}！', 'うう、悔しい！ でも、二人を応援する！'],
  },
  attack: {
    start: ['今日も攻めて勝つ'], think: ['踏み込むか……いや、もう一手深く'], ahead: ['よし、一気に決める'], behind: ['攻め合いに持ち込むしかない'],
    chance: ['来た、ここがチャンスだ'], regret: ['しまった……読み抜けだ'], win: ['よし、勝ち切った'], loss: ['……ここまでか'],
  },
  defense: {
    start: ['じっくり、手厚く'], think: ['一番固い手は、どれだ'], ahead: ['焦らず、手厚く'], behind: ['まだ粘れる。辛抱だ'],
    chance: ['相手が無理をした。じっくり咎めよう'], regret: ['……甘かったか'], win: ['最後まで、崩れずに済んだ'], loss: ['……ここまでか'],
  },
  balance: {
    start: ['自分の将棋を指そう'], think: ['ここは大事な局面だ'], ahead: ['良くなった。丁寧にいこう'], behind: ['苦しいが、何かあるはず'],
    chance: ['今の手は、甘いんじゃないか'], regret: ['しまった……'], win: ['勝てた。いい将棋だった'], loss: ['……負けだ'],
  },
});

/**
 * 心の声の場面(その人から見た勝率と、少し前からの変わり方)。
 * @param {{ ply: number, rate: number, before?: number | null, done?: boolean, won?: boolean }} options rateはその人の勝率(0〜1)
 * @returns {'start' | 'think' | 'ahead' | 'behind' | 'chance' | 'regret' | 'win' | 'loss'}
 */
export function peekScene({ ply, rate, before = null, done = false, won = false }) {
  if (done) return won ? 'win' : 'loss';
  if (ply < 16) return 'start';
  if (Number.isFinite(before)) {
    if (rate - before >= 0.15) return 'chance';
    if (before - rate >= 0.15) return 'regret';
  }
  if (rate >= 0.7) return 'ahead';
  if (rate <= 0.3) return 'behind';
  return 'think';
}

/**
 * 心の声の1行(同じ場面でも、手数で言い方を変える)。
 * @param {string} voice `peekVoice`
 * @param {ReturnType<typeof peekScene>} scene
 * @param {{ ply?: number, playerName?: string }} [options]
 */
export function peekThought(voice, scene, { ply = 0, playerName = '' } = {}) {
  const lines = PEEK_THOUGHTS[voice]?.[scene] ?? PEEK_THOUGHTS.balance[scene] ?? [];
  const line = lines[Math.floor(ply / 12) % Math.max(1, lines.length)] ?? '';
  return line.replaceAll('{name}', playerName ? `${playerName}さん` : 'あなた');
}
