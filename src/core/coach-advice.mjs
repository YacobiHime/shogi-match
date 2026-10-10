import { COUNTER_STRATEGY_TIPS, counterStrategyText } from './counter-strategy.mjs';
import shogiLib from './vendor/shogi.esm.js';

const { Shogi } = shogiLib;

const CASTLE_TIPS = [
  {
    key: 'elmo',
    names: ['エルモ囲い', '振り飛車エルモ'],
    text: '相手はエルモ囲いだね。横からは堅いけど、金の頭を狙う上からの攻めが有効だよ！',
  },
  {
    key: 'renmei-mino',
    names: ['連盟美濃'],
    text: '相手は連盟美濃だね。ネタとして知られる形で、金銀が本美濃より低く連携が悪いよ。飛車を横から利かせて守り駒をはがすのが狙い目だよ！',
  },
  {
    key: 'muteki',
    names: ['無敵囲い'],
    text: '相手は無敵囲いだね。名前は強そうだけど、ネタとして知られる形だよ。玉が居玉のままだから、5筋や角のラインから攻めてみよう！',
  },
  {
    key: 'mino',
    names: ['銀冠', '高美濃', 'ダイヤモンド美濃', '四枚美濃', '大山美濃', 'ちょんまげ美濃', '坊主美濃', '本美濃', '木村美濃', '金美濃', '銀美濃', '片美濃', '金立美濃', 'ずれ美濃', '早美濃'],
    text: '相手は美濃囲い系だね。横からは堅いけど、端攻めや玉頭からの攻めが急所だよ！',
  },
  {
    key: 'ibisha-anaguma',
    names: ['居飛車穴熊', '松尾流穴熊', 'ビッグ4', '銀冠穴熊'],
    text: '相手は居飛車穴熊だね。玉は遠いから、端を絡めて外側の金銀を一枚ずつはがしていこう！',
    furibisha: '相手は居飛車穴熊だね。穴熊が完成する前に、藤井システムのように玉頭や端から先に仕掛けるのが相性いいよ。組まれたら、外側の金銀から一枚ずつはがそう！',
  },
  {
    key: 'anaguma',
    names: ['振り飛車穴熊', '四枚穴熊'],
    text: '相手は穴熊系だね。玉は遠いから、端を絡めて外側の金銀を一枚ずつはがしていこう！',
  },
  {
    key: 'yagura',
    names: ['菱矢倉', '総矢倉', '金矢倉', '銀矢倉', '菊水矢倉', '土居矢倉', '天野矢倉', '銀立ち矢倉', '矢倉', '右矢倉'],
    text: '相手は矢倉系だね。正面は厚いから、端攻めや右四間飛車の形で角筋を生かすのが狙い目だよ！',
  },
  {
    key: 'funagakoi',
    names: ['舟囲い', '箱入り娘'],
    text: '相手は舟囲い系だね。組み上がりは速いけど薄めだから、玉頭や横から大駒を近づけると攻めやすいよ！',
  },
  {
    key: 'king-head',
    names: ['左美濃', '天守閣美濃', '端玉銀冠', '銀冠金無双', '金無双', '片金無双', '離れ金無双', '居飛車金無双'],
    text: '相手の囲いは横からの攻めに強い形だね。端と玉頭に歩や桂を集めて攻めるのが急所だよ！',
    furibisha: '相手の囲いは横からの攻めに強い形だね。振り飛車なら、端歩を突き越して端攻めや、玉頭へ銀と桂を集める攻めが相性いいよ！',
  },
  {
    key: 'right-king',
    names: ['右玉'],
    text: '相手は右玉だね。広さはあるけど玉が戦場に近いから、端攻めと飛車交換を絡めて逃げ道を狭めよう！',
  },
  {
    key: 'gangi',
    names: ['雁木'],
    text: '相手は雁木だね。中央は厚いから、飛車角を使って端や玉側から攻めるのが狙い目だよ！',
  },
  {
    key: 'central-king',
    names: ['中住まい', '中原囲い', 'カニ囲い', 'イチゴ囲い'],
    text: '相手玉は中央寄りで広いけど、囲いは薄めだね。大駒交換のあとに飛車や角を打ち込む攻めが有効だよ！',
  },
];

const FURIBISHA_NAMES = [
  '四間飛車', '藤井システム', '三間飛車', '向かい飛車', '中飛車', 'ゴキゲン中飛車',
  'ノーマル四間飛車', 'ノーマル三間飛車', 'ノーマル向かい飛車', '角交換四間飛車', '角交換三間飛車',
  '立石流四間飛車', '石田流', '早石田', '端角中飛車', '原始中飛車', 'ダイレクト向かい飛車',
  'メリケン向かい飛車', '阪田流向かい飛車', '菜々河流向かい飛車', '天彦流向かい飛車',
  '7八飛戦法', '2手目3二飛戦法', '鬼殺し', '新鬼殺し', 'やばボーズ流', '相振り飛車', '相中飛車',
];

function includesAny(names, candidates) {
  return candidates.some((name) => names.includes(name));
}

function formationAdvice(opponentFormations, playerFormations, advisedTopics) {
  const seen = new Set(advisedTopics);
  const playerUsesFuribisha = includesAny(playerFormations, FURIBISHA_NAMES);
  for (const tip of COUNTER_STRATEGY_TIPS) {
    if (seen.has(`strategy-${tip.key}`) || !includesAny(opponentFormations, tip.names)) continue;
    const text = counterStrategyText(tip, playerUsesFuribisha);
    return {
      key: `strategy-${tip.key}`,
      topic: `strategy-${tip.key}`,
      text,
    };
  }
  for (const tip of CASTLE_TIPS) {
    if (!seen.has(`castle-${tip.key}`) && includesAny(opponentFormations, tip.names)) {
      const text = playerUsesFuribisha ? tip.furibisha ?? tip.text : tip.text;
      return { key: `castle-${tip.key}`, topic: `castle-${tip.key}`, text };
    }
  }
  return null;
}

/** CPU着手前のCPU視点評価を、着手後のプレイヤー視点へ変換する。 */
export function scoreAfterOpponentMove(score) {
  if (!score || !['cp', 'mate'].includes(score.type) || !Number.isFinite(score.value)) {
    return undefined;
  }
  if (score.type === 'cp') return { type: 'cp', value: -score.value };
  if (score.value === 0) return { type: 'mate', value: 0 };
  const remaining = Math.max(1, Math.abs(score.value) - 1);
  return { type: 'mate', value: score.value > 0 ? -remaining : remaining };
}

/** 現局面の相手視点評価をプレイヤー視点へ反転する。 */
export function scoreFromOpponentPerspective(score) {
  if (!score || !['cp', 'mate'].includes(score.type) || !Number.isFinite(score.value)) {
    return undefined;
  }
  return { type: score.type, value: -score.value };
}

/** USIの手番側評価を、指定したプレイヤー側の評価へ正規化する。 */
export function scoreForPlayer(score, sideToMove, playerColor, pliesElapsed = 0) {
  if (
    !score || !['cp', 'mate'].includes(score.type) || !Number.isFinite(score.value)
    || !['black', 'white'].includes(sideToMove) || !['black', 'white'].includes(playerColor)
  ) {
    return undefined;
  }
  let value = score.value;
  if (score.type === 'mate' && value !== 0 && pliesElapsed > 0) {
    value = Math.sign(value) * Math.max(1, Math.abs(value) - Math.trunc(pliesElapsed));
  }
  return { type: score.type, value: sideToMove === playerColor ? value : -value };
}

function comparableScore(score) {
  if (score?.type === 'cp' && Number.isFinite(score.value)) return score.value;
  if (score?.type === 'mate' && Number.isFinite(score.value)) {
    if (score.value > 0) return 100000 - score.value;
    if (score.value < 0) return -100000 + Math.abs(score.value);
  }
  return undefined;
}

/** 王手を掛けられても、プレイヤーがこれ以上の評価(詰みを含む)なら「思い出王手」とみなす。 */
export const MEMORIAL_CHECK_SCORE = 2000;

/** 上位候補の評価差から、一手の選択が勝敗へ直結する局面を知らせる。 */
export function getCandidateRiskAdvice(candidates = [], {
  inCheck = false,
  mateThreat = false,
  mateThreatChecked = false,
  bestMoveIsKingMove = false,
  bestMoveGivesCheck = false,
  bestMoveIsDefensive = false,
  bestMoveIsAttacking = false,
  rookUnderThreat = false,
  bestMoveSavesRook = false,
  opponentHasCheckingMove = false,
  moveCount = 0,
} = {}) {
  const ranked = [...candidates]
    .filter((candidate) => Number.isInteger(candidate?.rank) && candidate.rank >= 1)
    .sort((left, right) => left.rank - right.rank);
  const best = ranked.find((candidate) => candidate.rank === 1);
  if (best?.score?.type === 'mate' && best.score.value < 0) {
    return {
      key: `forced-mate-loss-${Math.abs(best.score.value)}`,
      text: `詰んじゃった……${Math.abs(best.score.value)}手詰めだね。`,
    };
  }
  if (inCheck) {
    // 大差で負けている相手が、投了の前に記念に掛ける王手。
    const bestValue = comparableScore(best?.score);
    if (bestValue !== undefined && bestValue >= MEMORIAL_CHECK_SCORE) {
      return { key: 'king-in-check-memorial', text: '思い出王手きた～！' };
    }
    return bestMoveIsKingMove
      ? { key: 'king-in-check-escape', text: 'う～ん、王手だね…ここは逃げるべきかも。' }
      : { key: 'king-in-check', text: '王手きたーっ！！' };
  }
  if (mateThreat) {
    return { key: 'mate-risk-top3', text: '間違えたら詰みだよ。慎重に受けよう。' };
  }
  if (ranked.some((candidate) => (
    candidate.rank >= 4 && candidate.rank <= 5
    && candidate.score?.type === 'mate' && candidate.score.value < 0
  ))) {
    return { key: 'mate-risk-top5', text: '詰みがありそうな気がするな～？' };
  }
  const bestValue = comparableScore(best?.score);
  if (bestValue !== undefined && ranked.some((candidate) => {
    if (candidate.rank < 2 || candidate.rank > 5) return false;
    const value = comparableScore(candidate.score);
    return value !== undefined && bestValue - value >= 700;
  })) {
    return { key: 'candidate-evaluation-cliff', text: '何かあるよ、気を付けて！' };
  }
  if (rookUnderThreat && bestMoveSavesRook) {
    return {
      key: 'save-threatened-rook',
      text: '次に飛車を取られそうだね……先に逃がしておこう。',
    };
  }
  if (bestValue !== undefined && bestValue <= -1200 && bestMoveGivesCheck) {
    return {
      key: 'countercheck-while-losing',
      text: '受け切るのは難しいから、王手で手番を握ろう！',
    };
  }
  if (bestValue !== undefined && bestValue <= 200 && bestMoveIsDefensive) {
    return { key: 'prefer-defense', text: '今は攻めるより守った方が良いかも。' };
  }
  if (
    mateThreatChecked && bestValue !== undefined && bestValue >= -600 && moveCount >= 35
    && opponentHasCheckingMove && bestMoveIsAttacking
  ) {
    return {
      key: 'not-mate-threat-keep-attacking',
      text: '詰めろじゃないから、受けなくてもまだ耐えられるよ！',
    };
  }
  if (bestValue !== undefined && bestValue >= -3000 && bestValue <= -700) {
    return { key: 'still-resilient', text: 'まだ耐えられるよ！頑張ろう！' };
  }
  return null;
}

function formatEvaluation(value) {
  const integer = Math.trunc(value);
  return `${integer >= 0 ? '+' : ''}${integer}`;
}

/** 着手前後のプレイヤー視点評価から、大きな評価低下だけを指摘する。 */
/**
 * @param {{
 *   level?: string, beforeScore?: { type: string, value: number } | null, afterScore?: { type: string, value: number } | null,
 *   wasPromotion?: boolean, wasEnemyCampDrop?: boolean,
 * }} [options]
 */
export function getMoveFeedback({
  level = 'encourage',
  beforeScore,
  afterScore,
  wasPromotion = false,
  wasEnemyCampDrop = false,
} = {}) {
  if (level !== 'detailed') return null;
  const before = comparableScore(beforeScore);
  const after = comparableScore(afterScore);
  if (before === undefined || after === undefined) return null;
  const change = after - before;
  const loss = -change;

  if (loss >= 1000 && afterScore?.type === 'cp') {
    return {
      key: `move-blunder-${Math.trunc(change)}`,
      text: `あちゃ～。今の私たちの手、やっちゃった…評価値変動${formatEvaluation(change)}だよ。`,
    };
  }
  if (loss >= 500 && afterScore?.type === 'cp') {
    return {
      key: `move-mistake-${Math.trunc(change)}`,
      text: `今の私たちの手は悪手だね…評価値変動${formatEvaluation(change)}だよ。`,
    };
  }
  if ((wasPromotion || wasEnemyCampDrop) && after >= -500 && change >= -300) {
    return { key: 'enter-enemy-camp', text: 'かち込むよ～！' };
  }
  return null;
}

export function isSideToMoveInCheck(sfen) {
  try {
    const shogi = new Shogi();
    shogi.initializeFromSFENString(sfen);
    return shogi.isCheck(shogi.turn);
  } catch {
    return false;
  }
}

/**
 * 表示すべき助言を優先度順に1件だけ返す。
 * level: off / encourage / detailed
 */
/**
 * @param {{
 *   level?: string, score?: { type: string, value: number } | null, moveCount?: number, inCheck?: boolean,
 *   opponentFormations?: string[], playerFormations?: string[], advisedTopics?: Iterable<string>,
 * }} [options]
 */
export function getCoachAdvice({
  level = 'encourage',
  score,
  moveCount = 0,
  inCheck = false,
  opponentFormations = [],
  playerFormations = [],
  advisedTopics = [],
} = {}) {
  if (level === 'off') return null;

  if (level === 'detailed' && score?.type === 'mate' && Number.isFinite(score.value)) {
    if (score.value > 0) {
      return {
        key: `mate-win-${score.value}`,
        text: `${score.value}手詰めだね、頑張って！`,
      };
    }
    if (score.value < 0) {
      return inCheck
        ? { key: 'mate-danger-check', text: '王手がかかっているよ。まずは受けよう！' }
        : { key: 'mate-danger-threat', text: '詰めろだね。受けないと負けちゃう…' };
    }
  }

  if (level === 'detailed') {
    const advice = formationAdvice(opponentFormations, playerFormations, advisedTopics);
    if (advice) return advice;
  }

  if (score?.type !== 'cp' || !Number.isFinite(score.value)) return null;
  if (moveCount <= 30) {
    if (score.value >= 180) return { key: 'opening-good', text: '良い出だしだね！' };
    if (score.value <= -180) {
      return { key: 'opening-behind', text: '少し押されているけど、まだまだやれるよ！' };
    }
    return { key: 'opening-even', text: '互角の出だしだね。じっくり指していこう！' };
  } else if (moveCount <= 80) {
    if (score.value >= 300) return { key: 'middle-good', text: '良い流れだね！' };
    if (score.value <= -300) return { key: 'middle-behind', text: 'まだまだやれるよ！' };
    return { key: 'middle-even', text: 'まだ互角だよ。焦らずいこう！' };
  }
  if (score.value >= 500) return { key: 'endgame-good', text: '終盤は私たちが良さそうだよ！' };
  if (score.value <= -500) return { key: 'endgame-behind', text: '苦しい終盤だけど、最後まで手を探そう！' };
  return { key: 'endgame-even', text: '勝負どころだね。慎重に読もう！' };
}
