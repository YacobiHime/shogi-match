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
    if (score.value >= 250) return { key: 'opening-good', text: '良い出だしだね！' };
    if (score.value <= -250) {
      return { key: 'opening-behind', text: '少し押されているけど、まだまだやれるよ！' };
    }
  } else if (moveCount <= 80) {
    if (score.value >= 400) return { key: 'middle-good', text: '良い流れだね！' };
    if (score.value <= -400) return { key: 'middle-behind', text: 'まだまだやれるよ！' };
  }
  return null;
}
