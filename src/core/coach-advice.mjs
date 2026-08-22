import shogiLib from './vendor/shogi.esm.js';

const { Shogi } = shogiLib;

const CASTLE_TIPS = [
  {
    key: 'elmo',
    names: ['エルモ囲い', '振り飛車エルモ', '右エルモ'],
    text: '相手はエルモ囲いだね。横からは堅いけど、金の頭を狙う上からの攻めが有効だよ！',
  },
  {
    key: 'renmei-mino',
    names: ['連盟美濃'],
    text: '相手は連盟美濃だね。金銀が低く横からの攻めには弱めだから、飛車を横から利かせて守り駒をはがすのが狙い目だよ！',
  },
  {
    key: 'mino',
    names: ['銀冠', '高美濃', 'ダイヤモンド美濃', '四枚美濃', '大山美濃', 'ちょんまげ美濃', '坊主美濃', '本美濃', '木村美濃', '金美濃', '銀美濃', '片美濃', '金立美濃', 'ずれ美濃', '早美濃'],
    text: '相手は美濃囲い系だね。横からは堅いけど、端攻めや玉頭からの攻めが急所だよ！',
  },
  {
    key: 'anaguma',
    names: ['振り飛車穴熊', '居飛車穴熊', '四枚穴熊', '松尾流穴熊', '銀冠穴熊', 'ビッグ4'],
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
    names: ['中住まい', '中原囲い', 'カニ囲い', 'イチゴ囲い', '無敵囲い'],
    text: '相手玉は中央寄りで広いけど、囲いは薄めだね。大駒交換のあとに飛車や角を打ち込む攻めが有効だよ！',
  },
];

const FURIBISHA_NAMES = [
  '四間飛車', '藤井システム', '三間飛車', '向かい飛車', '中飛車', 'ゴキゲン中飛車',
  'ノーマル四間飛車', 'ノーマル三間飛車', '角交換四間飛車', '角交換三間飛車',
  '立石流四間飛車', '石田流', '早石田', '端角中飛車', 'ダイレクト向かい飛車',
  'メリケン向かい飛車', '阪田流向かい飛車', '菜々河流向かい飛車', '天彦流向かい飛車',
  '7八飛戦法', '2手目3二飛戦法', '鬼殺し',
];

const STRATEGY_TIPS = [
  {
    key: 'aifuribisha',
    names: ['相振り飛車', '相中飛車'],
    text: '相振り飛車だね。金無双か美濃囲いにして、相手の攻める筋を見て組み替えるのがおすすめだよ！',
  },
  {
    key: 'fujii-system',
    names: ['藤井システム'],
    text: '相手は藤井システムだね。居飛車穴熊を急ぐと端や玉頭を攻められやすいよ。舟囲いの急戦や、端歩を受けて備えるのがおすすめだよ！',
    furibishaText: '相手は藤井システムだね。相振り飛車に切り替えて、短手数の金無双から先に動くのがおすすめだよ！',
  },
  {
    key: 'osumi',
    names: ['大隅囲い'],
    text: '相手は大隅囲いだね。完成は速いけど金一枚の薄い形だから、玉頭と横から早めに圧力をかけよう！',
  },
  {
    key: 'fast-swinging-rook',
    names: ['鬼殺し', '早石田', '7八飛戦法', '2手目3二飛戦法'],
    text: '相手は速攻型の振り飛車だね。まず舟囲いなど短手数の囲いで、戦いに備えるのがおすすめだよ！',
    furibishaText: '相手は速攻型だね。金無双や片美濃のような、短手数の囲いで戦いに備えよう！',
  },
  {
    key: 'swinging-rook',
    names: FURIBISHA_NAMES,
    text: '相手は振り飛車だね。こちらが居飛車なら、急戦は舟囲い、持久戦は左美濃や居飛車穴熊が候補だよ！',
    furibishaText: '相振り飛車になりそうだね。短手数で組める金無双か美濃囲いが使いやすいよ！',
  },
  {
    key: 'yagura-opening',
    names: ['矢倉'],
    text: '相手は矢倉戦法だね。こちらも矢倉で厚くするか、雁木で手早く囲うのが候補だよ！',
  },
  {
    key: 'bishop-exchange',
    names: ['角換わり', '一手損角換わり', '角換わり29手目基本図', '角換わり37手目基本図', '4五桂速攻'],
    text: '角換わりだね。角の打ち込みに備えて、金銀を低く保つ早囲いや右玉が候補だよ！',
  },
  {
    key: 'side-pawn',
    names: ['横歩取り', '横歩取り青野流', '横歩取り勇気流', '横歩取り2三歩戦法', '横歩取り3三角戦法', '横歩取り3三桂戦法', '相横歩取り', '横歩取り4五角戦法', '横歩取り8五飛戦法'],
    text: '横歩取りの戦いだね。深く囲うより、中住まいで玉を広くして大駒の打ち込みに備えよう！',
  },
  {
    key: 'double-wing',
    names: ['相掛かり', 'AlphaZero流相掛かり', '6二金・8一飛車型', '相掛かり横歩取らせ'],
    text: '相掛かりだね。中住まいや中原囲いのような、広くて手数のかからない囲いが向いているよ！',
  },
  {
    key: 'rapid-attack',
    names: ['原始棒銀', '棒銀', '右四間飛車', '袖飛車', '雀刺し'],
    text: '相手は速い攻めを狙っているね。舟囲いや早囲いのような、短手数で金銀が連結する囲いを優先しよう！',
  },
];

function includesAny(names, candidates) {
  return candidates.some((name) => names.includes(name));
}

function formationAdvice(opponentFormations, playerFormations, advisedTopics) {
  const seen = new Set(advisedTopics);
  for (const tip of STRATEGY_TIPS) {
    if (seen.has(`strategy-${tip.key}`) || !includesAny(opponentFormations, tip.names)) continue;
    const playerUsesFuribisha = includesAny(playerFormations, FURIBISHA_NAMES);
    const text = playerUsesFuribisha
      ? tip.furibishaText ?? 'こちらが振り飛車なら、美濃囲いか振り飛車穴熊が組みやすいよ！'
      : tip.text;
    return {
      key: `strategy-${tip.key}`,
      topic: `strategy-${tip.key}`,
      text,
    };
  }
  for (const tip of CASTLE_TIPS) {
    if (!seen.has(`castle-${tip.key}`) && includesAny(opponentFormations, tip.names)) {
      return { key: `castle-${tip.key}`, topic: `castle-${tip.key}`, text: tip.text };
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
