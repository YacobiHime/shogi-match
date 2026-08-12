import shogiLib from './vendor/shogi.esm.js';

const { Shogi } = shogiLib;

const CASTLE_TIPS = [
  {
    key: 'elmo',
    names: ['エルモ囲い', '振り飛車エルモ'],
    text: '相手はエルモ囲いだから、上からの攻めが狙い目だよ！',
  },
];

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

function comparableScore(score) {
  if (score?.type === 'cp' && Number.isFinite(score.value)) return score.value;
  if (score?.type === 'mate' && Number.isFinite(score.value)) {
    if (score.value > 0) return 100000 - score.value;
    if (score.value < 0) return -100000 + Math.abs(score.value);
  }
  return undefined;
}

/** 上位候補の評価差から、一手の選択が勝敗へ直結する局面を知らせる。 */
export function getCandidateRiskAdvice(candidates = [], { inCheck = false, mateThreat = false } = {}) {
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
    return { key: 'king-in-check', text: '王手きたーっ！！' };
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
  return null;
}

function formatEvaluation(value) {
  const integer = Math.trunc(value);
  return `${integer >= 0 ? '+' : ''}${integer}`;
}

/** 着手前後のプレイヤー視点評価から、大きな評価低下だけを指摘する。 */
export function getMoveFeedback({ level = 'encourage', beforeScore, afterScore } = {}) {
  if (level !== 'detailed') return null;
  const before = comparableScore(beforeScore);
  const after = comparableScore(afterScore);
  if (before === undefined || after === undefined) return null;
  const change = after - before;
  const loss = -change;

  if (loss >= 500 && afterScore?.type === 'mate' && afterScore.value < 0) {
    return { key: 'move-lost', text: 'うぅ、もう勝ち目が無いよ…投了する…？' };
  }
  if (loss >= 500 && afterScore?.type === 'cp' && afterScore.value <= -3000) {
    return { key: 'move-nearly-lost', text: 'うぅ、もう勝ち目がほとんど無いよ…投了する…？' };
  }

  if (loss >= 1000 && afterScore?.type === 'cp') {
    return {
      key: `move-blunder-${Math.trunc(change)}`,
      text: `あちゃ～。やっちゃった…評価値変動${formatEvaluation(change)}だよ。`,
    };
  }
  if (loss >= 500 && afterScore?.type === 'cp') {
    return {
      key: `move-mistake-${Math.trunc(change)}`,
      text: `悪手だね…評価値変動${formatEvaluation(change)}だよ。`,
    };
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
export function getCoachAdvice({
  level = 'encourage',
  score,
  moveCount = 0,
  inCheck = false,
  opponentFormations = [],
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
    const seen = new Set(advisedTopics);
    for (const tip of CASTLE_TIPS) {
      if (!seen.has(tip.key) && tip.names.some((name) => opponentFormations.includes(name))) {
        return { key: `castle-${tip.key}`, topic: tip.key, text: tip.text };
      }
    }
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
