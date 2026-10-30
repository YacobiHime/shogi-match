/**
 * 大会の対局画面で、相手の棋士を生きて見せ、ほかの対局の速報を流す(段階1)。画面に依存しない。
 * 設計は docs/tournament-match-presence-design.md の2章(相手の顔・一言・特殊能力の札)と4章(速報)。
 */
import { attackStyleLabel, specialAbilityChips, traitMomentIds } from './player-character.mjs';
import { HANANE, YOSHIHIKO } from './ryuo-story.mjs';
import { winRateFor } from './guided-review.mjs';

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
  // 羽音は敬語を使わない。口調は docs/hanane-character.md(ryuo-story.mjsのHANANE_LINESと同じ書き方)。
  hanane: {
    start: 'よろしく。いい将棋にしよう',
    ahead: 'このまま、決めるよ',
    behind: 'へえ、やるね。でも、まだ終わってないよ',
    win: 'ありがとう。また指そう',
    loss: '私の負け。……悔しいけど',
  },
  // 善彦は、中継の解説と同じ口調(「そうですね」「ちょっと」「〜かなと思います」。モデルの羽生善治・藤井聡太の対局後の話し方。
  // docs/tournament-relay-design.mdの36・37・42・43章)。
  yoshihiko: {
    start: 'よろしくお願いします',
    ahead: 'そうですね、少し、指しやすくなったかなという気はします',
    behind: 'うーん……ちょっと、苦しくしてしまったかな、という',
    win: 'ありがとうございました。……途中、ちょっと難しいところもあったかなと思います',
    loss: '負けました。……そうですね、どこかで、ちょっと判断を誤ったかなという気がします',
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
  // 名人戦の順位戦と奨励会(例会・三段リーグ)と研修会(例会)は、同じ回のほかの対局をpending.othersに持つ。
  if (event === 'meijin' || event === 'shoreikai' || event === 'kenshukai') {
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
 * @param {{ event?: "ryuo" | "meijin" | "shoreikai" | "kenshukai", season?: any, oshiId?: string | null }} [options]
 * @returns {{ key: string, text: string, tone: "oshi" | "rival" | "peer" | "next" | "upset" | "plain", pair: string[] }[]}
 */
export function roundNews({ event = 'ryuo', season = null, oshiId = null } = {}) {
  const { games, nextFrom, nextOpponent } = sameRoundGames(event, season);
  const players = season?.players ?? {};
  const name = (pid) => `${players[pid]?.name ?? '？'}さん`;
  const order = { oshi: 0, rival: 1, peer: 2, next: 3, upset: 4, plain: 5 };
  const items = games.filter(({ winner, loser }) => players[winner] && players[loser]).map((game) => ({ ...newsItem(game), pair: [game.winner, game.loser] }));
  return items.sort((a, b) => order[a.tone] - order[b.tone]).slice(0, NEWS_PER_GAME);
  /** 1件の速報。pairは[勝者, 敗者](対局後の中継ボードで、速報で伝えた対局を終局した札にする。docs/tournament-relay-design.mdの35章)。 */
  function newsItem(game) {
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
    // 奨励会・研修会の同期(どちらが先に上がるかの競争)。
    const peer = [winner, loser].find((pid) => players[pid]?.peer);
    if (peer) {
      return peer === winner
        ? { key, tone: 'peer', text: `速報：同期の${name(winner)}が勝った` }
        : { key, tone: 'peer', text: `速報：同期の${name(loser)}は負け…` };
    }
    if ((nextFrom && game.id === nextFrom) || (nextOpponent && (winner === nextOpponent || loser === nextOpponent))) {
      return { key, tone: 'next', text: `速報：${name(winner)}が勝ちました。次に当たるかも？` };
    }
    const gap = (players[loser].rating ?? 0) - (players[winner].rating ?? 0);
    if (gap >= NEWS_UPSET_GAP) return { key, tone: 'upset', text: `速報：大番狂わせ！ ${name(winner)}が${name(loser)}に勝ちました` };
    return { key, tone: 'plain', text: `速報：${name(winner)}が${name(loser)}に勝ちました` };
  }
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

// ---- 中継(段階2): 勝率バーと控室の一言(docs/tournament-match-presence-design.mdの3章)

/** 控室が「形勢が動いた」と言う、勝率の変わり方(10%)。 */
export const ROOM_SWING = 0.1;
/** 控室が話す回数の上限。 */
export const ROOM_LINES_PER_GAME = 5;
/** 中盤・終盤の入り(手数)。 */
export const ROOM_MIDDLE_PLY = 30;
export const ROOM_ENDGAME_PLY = 80;

/**
 * プレイヤーから見た評価値を、プレイヤーの勝率(0〜1)にする。棋譜解析の振り返りと同じ式(guided-review.mjsのwinRateFor)。
 * @param {{ type: string, value: number } | null | undefined} playerScore
 */
export function playerWinRate(playerScore) {
  return playerScore ? winRateFor(playerScore, 'black') ?? null : null;
}

/** 勝率を「62%」の形にする。 */
export function formatWinRate(rate) {
  return Number.isFinite(rate) ? `${Math.round(rate * 100)}%` : '—';
}

/**
 * 控室の一言。言うことがなければnull。同じ場面は1局に1回、合わせて5回まで。
 * どれも相手の指した手か形勢についてだけ言い、プレイヤーの次の手は勧めない(閃きの意味をなくさない)。
 * @param {{
 *   ply: number, winRate: number | null, previousWinRate?: number | null, inCheck?: boolean,
 *   lastMoveText?: string, lastMoverIsPlayer?: boolean, said?: Iterable<string>, weight?: string,
 * }} options
 *   winRate・previousWinRate: プレイヤーの勝率(いまと、前に控室が見たとき)。lastMoveText: 直前の手の表記(「△4五歩」)。
 * @returns {{ key: string, text: string } | null}
 */
export function roomComment({
  ply, winRate, previousWinRate = null, inCheck = false, lastMoveText = '', lastMoverIsPlayer = false, said = [], weight = 'plain',
}) {
  const done = new Set(said);
  if (done.size >= ROOM_LINES_PER_GAME) return null;
  const pick = (key, text) => (done.has(key) ? null : { key, text });
  if (ply <= 1) {
    return weight === 'plain' ? null : pick('room-opening', '控室：注目の一局がまもなく始まります');
  }
  if (Number.isFinite(winRate) && Number.isFinite(previousWinRate)) {
    const swing = winRate - previousWinRate;
    if (swing <= -ROOM_SWING && !lastMoverIsPlayer && lastMoveText) {
      const line = pick('room-sharp', `控室：今の${lastMoveText}は鋭い一手と話題に`);
      if (line) return line;
    }
    if (swing >= ROOM_SWING) {
      const line = pick('room-stir', lastMoverIsPlayer ? '控室：今の一手で、控室がどよめいています！' : '控室：形勢が動いた、との声が上がっています');
      if (line) return line;
    }
  }
  if ((inCheck || ply > ROOM_ENDGAME_PLY) && Number.isFinite(winRate)) {
    const line = pick('room-endgame', `控室：いよいよ終盤戦。勝率はあなた${formatWinRate(winRate)}です`);
    if (line) return line;
  }
  if (ply > ROOM_MIDDLE_PLY) {
    const line = pick('room-middle', '控室：ここからが中盤戦。両者、作戦の方向が見えてきました');
    if (line) return line;
  }
  return null;
}

// ---- 終局の判子(段階3。docs/tournament-match-presence-design.mdの6章)

/**
 * 勝って終局したときに盤に押す判子。期の画面の節目の判子(ryuo-milestone.mjsのlastGameMilestone)と同じ言葉にする。
 * 節目でない勝ちは「勝ち」の小さな判子。負けたときは押さない(null)。
 * @param {{ win: boolean, milestone?: { seal: string, title: string, weight: string } | null, event?: string, crowned?: boolean, weight?: string, upset?: boolean,
 *   mateTier?: string | null }} options
 *   crowned: 名人戦で名人になった(または防衛した)。weight: 対局の舞台の重さ(plain/big/title)。upset: 格上(2Lv以上強い相手)に勝った。
 *   mateTier: 詰ませて勝ったときの寄せの重さ(mate-finish.mjsのmateTier)。9手以上の寄せは判子を1段大きく、15手以上は紙吹雪も
 *   (docs/mate-finish-design.md。G:3-1 出来事の重さ)。
 * @returns {{ seal: string, title: string, size: "small" | "mid" | "big", confetti: boolean } | null}
 */
export function finishStamp({ win, milestone = null, event = 'ryuo', crowned = false, weight = 'plain', upset = false, mateTier = null }) {
  if (!win) return null;
  return withMateWeight(baseFinishStamp({ milestone, event, crowned, weight, upset }), mateTier);
}

function baseFinishStamp({ milestone, event, crowned, weight, upset }) {
  if (event === 'meijin' && crowned) return { seal: '名人', title: '名人になった！', size: 'big', confetti: true };
  if (milestone) {
    const size = milestone.weight === 'max' ? 'big' : milestone.weight === 'big' ? 'mid' : 'small';
    return { seal: milestone.seal, title: milestone.title, size, confetti: milestone.weight === 'max' };
  }
  // 格上(2Lv以上強い相手)に勝ったときは、それを一言で伝える(G:4-8 どれぐらい良いことをした？。docs/tournament-strength-spread-design.md)。
  if (upset) return { seal: '勝ち', title: '格上に勝った！', size: weight === 'title' ? 'big' : 'mid', confetti: false };
  return { seal: '勝ち', title: '', size: weight === 'title' ? 'big' : weight === 'big' ? 'mid' : 'small', confetti: false };
}

const STAMP_SIZES = Object.freeze(['small', 'mid', 'big']);
/** 長い寄せで勝ったら、判子を1段大きくする(大きい判子はそのまま)。15手以上は紙吹雪も降らせる。 */
function withMateWeight(stamp, mateTier) {
  if (mateTier !== 'long' && mateTier !== 'legend') return stamp;
  const size = STAMP_SIZES[Math.min(STAMP_SIZES.length - 1, STAMP_SIZES.indexOf(stamp.size) + 1)];
  return { ...stamp, size, confetti: stamp.confetti || mateTier === 'legend' };
}
