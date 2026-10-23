/**
 * 大会の対局画面で、相手の棋士を生きて見せ、ほかの対局の速報を流す(段階1)。画面に依存しない。
 * 設計は docs/tournament-match-presence-design.md の2章(相手の顔・一言・特殊能力の札)と4章(速報)。
 */
import { attackStyleLabel, specialAbilityChips, traitMomentIds } from './player-character.mjs';
import { HANANE, YOSHIHIKO } from './ryuo-story.mjs';

/** 形勢がこれだけ傾いたら、相手の表情と一言を変える(プレイヤーから見た評価値)。 */
export const MOOD_SCORE = 500;
/** 対局の途中で相手が話す回数(始めと終わりは別)。 */
export const OPPONENT_MIDGAME_LINES = 2;
/** 速報を出す間隔(手数)と、1局に出す数。 */
export const NEWS_EVERY_PLIES = 20;
export const NEWS_PER_GAME = 4;
/** 大番狂わせ(レーティングがこれだけ低い棋士の勝ち)。期の画面の大番狂わせと同じ差。 */
export const NEWS_UPSET_GAP = 200;

/**
 * 相手の表情。プレイヤーが勝っていれば相手は苦しい、負けていれば余裕。
 * @param {{ type: string, value: number } | null | undefined} playerScore
 * @returns {"even" | "confident" | "troubled"}
 */
export function opponentMood(playerScore) {
  if (playerScore?.type === 'mate') return playerScore.value > 0 ? 'troubled' : 'confident';
  if (playerScore?.type !== 'cp') return 'even';
  if (playerScore.value >= MOOD_SCORE) return 'troubled';
  if (playerScore.value <= -MOOD_SCORE) return 'confident';
  return 'even';
}

/** 口調。物語の人物はその人の口調、ほかは棋風(攻め将棋・受け将棋・バランス型)。 */
export function opponentVoice({ character = null, story = null } = {}) {
  if (story === HANANE) return 'hanane';
  if (story === YOSHIHIKO) return 'yoshihiko';
  const style = attackStyleLabel(character?.attack);
  if (style.includes('攻め')) return 'attack';
  if (style.includes('受け')) return 'defense';
  return 'balance';
}

/** 場面ごとの相手の一言。ahead/behind は相手から見た形勢。win/loss は相手から見た勝ち負け。 */
const LINES = Object.freeze({
  attack: {
    start: 'よろしくお願いします。今日も攻めますよ',
    ahead: 'ここから一気にいきます',
    behind: 'むむ…',
    win: 'ありがとうございました',
    loss: '負けました。強かったです',
  },
  defense: {
    start: 'よろしくお願いします。じっくりいきましょう',
    ahead: 'このまま、手厚く',
    behind: 'まだまだ、ここからです',
    win: 'ありがとうございました',
    loss: '参りました',
  },
  balance: {
    start: 'よろしくお願いします',
    ahead: '良い流れですね',
    behind: '……苦しいですね',
    win: 'ありがとうございました',
    loss: '負けました',
  },
  hanane: {
    start: '……よろしくお願いします',
    ahead: '……このまま、決めるから',
    behind: '……まだ、終わってない',
    win: 'ありがとうございました。……また指そう',
    loss: '……負けました',
  },
  yoshihiko: {
    start: 'よろしくお願いします。楽しませてもらうよ',
    ahead: 'ふむ、ここは厚く指そう',
    behind: '……なるほど。やるね',
    win: 'ありがとうございました。良い将棋だった',
    loss: '負けました。強くなったね',
  },
});

/**
 * 相手の一言。
 * @param {"start" | "ahead" | "behind" | "win" | "loss"} moment
 * @param {{ character?: { attack?: number } | null, story?: string | null }} [who]
 */
export function opponentLine(moment, who = {}) {
  return LINES[opponentVoice(who)]?.[moment] ?? '';
}

/**
 * 対局の途中で相手が話す場面。形勢が±500点を越えた最初だけ、それぞれ1回。合わせて2回まで。
 * @param {{ type: string, value: number } | null | undefined} playerScore
 * @param {Iterable<string>} said 話した場面
 * @returns {"ahead" | "behind" | null} 相手から見た形勢
 */
export function midgameMoment(playerScore, said = []) {
  const done = [...said];
  if (done.length >= OPPONENT_MIDGAME_LINES) return null;
  const mood = opponentMood(playerScore);
  const moment = mood === 'confident' ? 'ahead' : mood === 'troubled' ? 'behind' : null;
  return moment && !done.includes(moment) ? moment : null;
}

/** 苦手が出たときに、やこび姫が添える一言。 */
const WEAKNESS_COACH = Object.freeze({
  'endgame-collapse': 'チャンスだよ！ 相手の玉に詰みがないか探そう！',
});
/** 札の短い言葉(名鑑の札の名前をもとに、出た瞬間の言い方にする)。 */
const CARD_TEXT = Object.freeze({
  'endgame-collapse': '頓死の癖が出た！',
});

/**
 * CPUの1手で特殊能力が「出た」なら、相手の名札の下に出す札。同じ特殊能力は1局に1回。
 * 出たかどうかは、結果の画面の「特徴が出た場面」と同じ決まり(player-character.mjsのtraitMomentIds)。
 * @param {{ kind?: string, traits?: string[] } | null} move CPUの1手の記録(ryuoCpuMoves の1つ)
 * @param {{ character?: { traits?: { id: string, degree?: number }[] } | null, name?: string, shown?: Iterable<string> }} [options]
 * @returns {{ id: string, tier: string, text: string, coach: string } | null}
 */
export function traitCard(move, { character = null, name = '', shown = [] } = {}) {
  const done = new Set(shown);
  const id = traitMomentIds(move).find((candidate) => !done.has(candidate));
  if (!id) return null;
  const chip = specialAbilityChips(character).find((entry) => entry.id === id);
  if (!chip) return null;
  const text = CARD_TEXT[id]
    ?? (chip.tier === 'gold' ? `${name ? `${name}さんの` : ''}『${chip.label}』！` : `${chip.label}！`);
  return { id, tier: chip.tier, text, coach: WEAKNESS_COACH[id] ?? '' };
}

const sidePid = (bracket, side) => (side ? (side.pid ?? bracket.nodes[side.from]?.winner ?? null) : null);

/** いまの対局の、同じ回戦のほかの試合(決まったもの)と、プレイヤーが勝てば次に当たる人が出る試合。 */
function sameRoundGames(event, season) {
  const pending = season?.pending;
  if (!pending) return { games: [], nextFrom: null };
  if (event === 'meijin') {
    const games = (pending.others?.games ?? []).map(({ a, b, winner }) => ({ winner, loser: winner === a ? b : a }));
    const nextOpponent = season.schedule?.[pending.round + 1]?.opponent ?? null;
    return { games, nextOpponent };
  }
  if (pending.kind !== 'game') return { games: [], nextFrom: null };
  const bracket = pending.phase === 'ranking' ? season.ranking
    : pending.phase === 'revival' ? season.revival?.[pending.blockIndex] : season.main;
  const node = bracket?.nodes?.[pending.nodeId];
  if (!node) return { games: [], nextFrom: null };
  const games = Object.values(bracket.nodes)
    .filter((other) => other.id !== node.id && other.round === node.round && other.winner)
    .map((other) => {
      const a = sidePid(bracket, other.a);
      const b = sidePid(bracket, other.b);
      return { id: other.id, winner: other.winner, loser: other.winner === a ? b : a };
    });
  // プレイヤーの試合の勝者が進む試合の、もう片方の側(そこの勝者が、次の相手になる)。
  const parent = Object.values(bracket.nodes).find((other) => other.a?.from === node.id || other.b?.from === node.id);
  const otherSide = parent ? (parent.a?.from === node.id ? parent.b : parent.a) : null;
  return { games, nextFrom: otherSide?.from ?? null };
}

/**
 * 対局中に流す速報(優先順に、多くて4件)。推し → 羽音 → 次に当たるかもしれない試合 → 大番狂わせ → そのほか。
 * @param {{ event?: "ryuo" | "meijin", season?: any, oshiId?: string | null }} [options]
 * @returns {{ key: string, text: string, tone: "oshi" | "rival" | "next" | "upset" | "plain" }[]}
 */
export function roundNews({ event = 'ryuo', season = null, oshiId = null } = {}) {
  const { games, nextFrom, nextOpponent } = sameRoundGames(event, season);
  const players = season?.players ?? {};
  const name = (pid) => `${players[pid]?.name ?? '？'}さん`;
  const order = { oshi: 0, rival: 1, next: 2, upset: 3, plain: 4 };
  const items = games.filter(({ winner, loser }) => players[winner] && players[loser]).map((game) => {
    const { winner, loser } = game;
    const key = `news-${winner}-${loser}`;
    if (oshiId && (winner === oshiId || loser === oshiId)) {
      return winner === oshiId
        ? { key, tone: 'oshi', text: `速報：推しの${name(winner)}、勝ち！` }
        : { key, tone: 'oshi', text: `速報：推しの${name(loser)}は、${name(winner)}に敗れる…` };
    }
    const rival = [winner, loser].find((pid) => players[pid]?.story === HANANE);
    if (rival) {
      return rival === winner
        ? { key, tone: 'rival', text: `速報：${name(winner)}が勝った！ 勝ち上がってくるよ` }
        : { key, tone: 'rival', text: `速報：${name(loser)}、まさかの負け…` };
    }
    if ((nextFrom && game.id === nextFrom) || (nextOpponent && (winner === nextOpponent || loser === nextOpponent))) {
      return { key, tone: 'next', text: `速報：${name(winner)}が勝ちました。次に当たるかも？` };
    }
    const gap = (players[loser].rating ?? 0) - (players[winner].rating ?? 0);
    if (gap >= NEWS_UPSET_GAP) return { key, tone: 'upset', text: `速報：大番狂わせ！ ${name(winner)}が${name(loser)}に勝ちました` };
    return { key, tone: 'plain', text: `速報：${name(winner)}が${name(loser)}に勝ちました` };
  });
  return items.sort((a, b) => order[a.tone] - order[b.tone]).slice(0, NEWS_PER_GAME);
}

/**
 * いま出す速報(手数が20の倍数を越えるたびに1件)。出し終わったらnull。
 * @param {ReturnType<typeof roundNews>} news
 * @param {number} ply いまの手数
 * @param {number} shownCount もう出した数
 */
export function newsDue(news, ply, shownCount) {
  const due = Math.floor(ply / NEWS_EVERY_PLIES);
  return shownCount < due && shownCount < news.length ? news[shownCount] : null;
}
