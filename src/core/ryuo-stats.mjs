// 竜王戦の1期ぶんの、プレイヤーの統計・レーダーチャート・解説。
// 対局ごとに、棋譜解析の結果(kifu-analysis-pipeline.mjsのpoints)と棋譜から、小さな記録(summarizeGame)を作って保存し、
// 1期の終わりに、それらを集計する(aggregateSeasonStats)。画面に依存しない。

/** 1手の損失の上限。1手の大悪手で平均が崩れすぎないようにする。 */
const LOSS_CAP = 1000;
/** 着手前の形勢がこれ以上(どちら向きでも)の局面は、差が付いていて損が測りにくいので除く。 */
const DECIDED_STANDING = 1500;
/** 大きな損(疑問手以上)とみなす損失。 */
const BIG_LOSS = 300;
/** 相手のミスに、損なく応じたとみなす損失の上限。 */
const PUNISH_REPLY_LOSS = 100;
const PHASES = Object.freeze([
  { key: 'opening', until: 30 },
  { key: 'middle', until: 80 },
  { key: 'ending', until: Infinity },
]);

export const RADAR_AXES = Object.freeze([
  { key: 'opening', label: '序盤' },
  { key: 'middle', label: '中盤' },
  { key: 'ending', label: '終盤' },
  { key: 'stability', label: '安定感' },
  { key: 'punish', label: '咎め' },
  { key: 'mate', label: '詰将棋' },
  { key: 'vsRanging', label: '対振り飛車' },
  { key: 'vsStatic', label: '対居飛車' },
  { key: 'material', label: '駒得' },
]);

const PIECE_VALUES = Object.freeze({
  p: 1, l: 3, n: 4, s: 5, g: 6, b: 8, r: 10, '+p': 7, '+l': 6, '+n': 6, '+s': 6, '+b': 10, '+r': 12,
});

/** SFENの、先手の駒の価値から後手の駒の価値を引いた値(持ち駒を含む)。 */
export function materialBalance(sfen) {
  const [board = '', , hands = '-'] = String(sfen).split(' ');
  let balance = 0;
  let promoted = false;
  for (const char of board) {
    if (char === '/' || /\d/.test(char)) continue;
    if (char === '+') { promoted = true; continue; }
    const lower = char.toLowerCase();
    const value = PIECE_VALUES[`${promoted ? '+' : ''}${lower}`] ?? 0;
    balance += char === lower ? -value : value;
    promoted = false;
  }
  if (hands !== '-') {
    for (const [, count, char] of hands.matchAll(/(\d*)([a-zA-Z])/g)) {
      const lower = char.toLowerCase();
      const value = (PIECE_VALUES[lower] ?? 0) * (count ? Number(count) : 1);
      balance += char === lower ? -value : value;
    }
  }
  return balance;
}

const clamp = (value, low = 0, high = 100) => Math.min(high, Math.max(low, value));

/** 平均損失から、点数(0〜100)へ。損失30で100点、300で0点。 */
export const lossScore = (averageLoss) => clamp(100 - (averageLoss - 30) / 2.7);

const isMateFor = (score, color) => (
  score?.type === 'mate' && (color === 'black' ? score.value > 0 : score.value < 0)
);

/**
 * 1局の記録を作る。
 * @param {{
 *   points: any[], sfens: string[], color: 'black' | 'white', win: boolean, opponentRook: 'static' | 'ranging' | null, plies: number,
 * }} options pointsは棋譜解析の点(手数の順)、sfensは各手数の局面(0手目から)。
 */
export function summarizeGame({ points, sfens = [], color, win, opponentRook, plies }) {
  const byPly = new Map(points.map((point) => [point.ply, point]));
  const phases = Object.fromEntries(PHASES.map(({ key }) => [key, { n: 0, sum: 0 }]));
  const kinds = { blunder: 0, mistake: 0, dubious: 0, good: 0, brilliant: 0 };
  let measured = 0;
  let big = 0;
  let sum = 0;
  let worst = null;
  let oppMistakes = 0;
  let punished = 0;
  let mateChances = 0;
  let mateKept = 0;
  for (const point of points) {
    const measure = point.moveMeasure;
    if (!measure) continue;
    if (measure.mover === color) {
      const kind = point.annotation?.kind;
      if (kind && kind in kinds) kinds[kind] += 1;
      // 詰みの手順が着手前に見えている局面で、詰みを逃さずに指したか。
      const before = byPly.get(point.ply - 1);
      if (before && isMateFor(before.score, color)) {
        mateChances += 1;
        if (isMateFor(point.score, color) || point.score?.value === 0) mateKept += 1;
      }
      if (Math.abs(measure.standing) >= DECIDED_STANDING) continue;
      const loss = Math.min(LOSS_CAP, measure.loss);
      measured += 1;
      sum += loss;
      if (measure.loss >= BIG_LOSS) big += 1;
      const phase = phases[PHASES.find(({ until }) => point.ply <= until).key];
      phase.n += 1;
      phase.sum += loss;
      if (measure.loss >= BIG_LOSS && (!worst || measure.loss > worst.loss)) {
        worst = { ply: point.ply, label: point.label ?? `${point.ply}手目`, loss: Math.round(measure.loss) };
      }
    } else if (measure.loss >= BIG_LOSS && Math.abs(measure.standing) < DECIDED_STANDING) {
      // 相手のミスに、損なく応じたか(咎め)。
      const reply = byPly.get(point.ply + 1)?.moveMeasure;
      if (reply && reply.mover === color) {
        oppMistakes += 1;
        if (reply.loss <= PUNISH_REPLY_LOSS) punished += 1;
      }
    }
  }
  // 駒得: 中盤以降の、自分の駒の価値から相手の駒の価値を引いた値の平均(手数15から)。
  const sign = color === 'black' ? 1 : -1;
  const balances = sfens.slice(15).map((sfen) => sign * materialBalance(sfen));
  const material = balances.length ? balances.reduce((total, value) => total + value, 0) / balances.length : null;
  return {
    color, win, opponentRook, plies,
    phases, moves: measured, big, sum, kinds, worst,
    oppMistakes, punished, mateChances, mateKept,
    material: material === null ? null : Math.round(material * 10) / 10,
  };
}

const PRAISE = Object.freeze({
  opening: '序盤の構想が安定していて、いい形で中盤に入れていました。',
  middle: '中盤の判断が的確で、局面を悪くしない手が続きました。',
  ending: '終盤の寄せと受けが正確で、勝負所を逃しませんでした。',
  stability: '大きな悪手が少なく、安定して指せていました。',
  punish: '相手のミスをしっかり咎めて、チャンスを逃しませんでした。',
  mate: '詰みの筋を逃さず、勝ち切る力がありました。',
  vsRanging: '振り飛車に対して、勝負できていました。',
  vsStatic: '居飛車に対して、勝負できていました。',
  material: '駒の損得で優位に立つ指し方ができていました。',
});

const ADVICE = Object.freeze({
  opening: '序盤では、戦法や囲いの手順を確認して、形を整えることを意識しよう。',
  middle: '中盤では、駒を取られていないか、相手の狙いはないかを、1手ごとに確かめよう。',
  ending: '終盤では、詰みがあるかを先に読み、相手玉への寄せと自玉の安全を見比べよう。',
  stability: '大きな悪手が出やすいので、指す前に、取られる駒がないかを確かめる習慣をつけよう。',
  punish: '相手のミスのあとに、有利を広げる手を指せていません。「取れる駒はないか」を、まず探してみよう。',
  mate: '詰みの機会を逃しています。詰将棋で、短い詰みの筋に慣れておこう。',
  vsRanging: '振り飛車への対策（急戦や、居飛車穴熊など）を、定跡図鑑で確かめよう。',
  vsStatic: '居飛車の戦い（矢倉や角換わりなど）を、定跡図鑑で確かめよう。',
  material: '駒損が目立ちます。駒の交換や、ただ取りされる手に気をつけよう。',
});

const pct = (value) => `${Math.round(value * 100)}%`;

/**
 * 1期の記録を集計して、レーダーチャートの点数、統計、解説を作る。
 * @param {{ records: Record<string, any>, games: { win: boolean, color: string, label?: string, opponentName?: string }[], pending?: number }} input
 *   recordsは、対局の番号(0始まり)ごとの記録。解析できていない対局は含まれない。
 */
export function aggregateSeasonStats({ records, games, pending = 0 }) {
  const list = Object.entries(records).sort(([x], [y]) => Number(x) - Number(y)).map(([index, record]) => ({ index: Number(index), ...record }));
  const analyzed = list.filter((record) => !record.failed);
  const sum = (pick) => analyzed.reduce((total, record) => total + pick(record), 0);
  const phaseScore = (key) => {
    const n = sum((record) => record.phases[key].n);
    return n >= 3 ? Math.round(lossScore(sum((record) => record.phases[key].sum) / n)) : null;
  };
  const moves = sum((record) => record.moves);
  const big = sum((record) => record.big);
  const oppMistakes = sum((record) => record.oppMistakes);
  const mateChances = sum((record) => record.mateChances);
  const averageLoss = moves ? Math.round(sum((record) => record.sum) / moves) : null;

  const vsScore = (rook) => {
    const subset = list.filter((record) => record.opponentRook === rook);
    if (!subset.length) return null;
    const wins = subset.filter((record) => record.win).length;
    const usable = subset.filter((record) => !record.failed && record.moves > 0);
    const subsetMoves = usable.reduce((total, record) => total + record.moves, 0);
    const winPart = (wins / subset.length) * 100;
    if (!subsetMoves) return Math.round(winPart);
    const loss = usable.reduce((total, record) => total + record.sum, 0) / subsetMoves;
    return Math.round(0.6 * winPart + 0.4 * lossScore(loss));
  };
  const materials = list.map((record) => record.material).filter((value) => value !== null && value !== undefined);
  const materialAverage = materials.length ? materials.reduce((total, value) => total + value, 0) / materials.length : null;

  const values = {
    opening: phaseScore('opening'),
    middle: phaseScore('middle'),
    ending: phaseScore('ending'),
    stability: moves >= 5 ? Math.round(clamp(100 - (big / moves) * 400)) : null,
    punish: oppMistakes >= 3 ? Math.round((sum((record) => record.punished) / oppMistakes) * 100) : null,
    mate: mateChances >= 2 ? Math.round((sum((record) => record.mateKept) / mateChances) * 100) : null,
    vsRanging: vsScore('ranging'),
    vsStatic: vsScore('static'),
    material: materialAverage === null ? null : Math.round(clamp(50 + materialAverage * 8)),
  };
  const radar = RADAR_AXES.map(({ key, label }) => ({ key, label, value: values[key] }));

  // 統計
  const wins = games.filter((game) => game.win).length;
  let streak = 0;
  let longest = 0;
  for (const game of games) {
    streak = game.win ? streak + 1 : 0;
    longest = Math.max(longest, streak);
  }
  const byColor = (color) => {
    const subset = games.filter((game) => game.color === color);
    return { games: subset.length, wins: subset.filter((game) => game.win).length };
  };
  const versus = (rook) => {
    const subset = list.filter((record) => record.opponentRook === rook);
    return { games: subset.length, wins: subset.filter((record) => record.win).length };
  };
  let worst = null;
  for (const record of analyzed) {
    if (record.worst && (!worst || record.worst.loss > worst.loss)) worst = { game: record.index + 1, ...record.worst };
  }
  const summary = {
    games: games.length,
    wins,
    losses: games.length - wins,
    winRate: games.length ? wins / games.length : null,
    longestWinStreak: longest,
    black: byColor('black'),
    white: byColor('white'),
    vsStatic: versus('static'),
    vsRanging: versus('ranging'),
    analyzed: analyzed.length,
    moves,
    averageLoss,
    bigRate: moves ? big / moves : null,
    kinds: {
      blunder: sum((record) => record.kinds.blunder),
      mistake: sum((record) => record.kinds.mistake),
      dubious: sum((record) => record.kinds.dubious),
      good: sum((record) => record.kinds.good),
      brilliant: sum((record) => record.kinds.brilliant),
    },
    averagePlies: games.length && list.length ? Math.round(list.reduce((total, record) => total + record.plies, 0) / list.length) : null,
    worst,
  };

  // 解説
  const commentary = [];
  const scored = radar.filter(({ value }) => value !== null);
  if (scored.length >= 2) {
    const sorted = [...scored].sort((x, y) => y.value - x.value);
    const best = sorted[0];
    const weakest = sorted.at(-1);
    commentary.push({ title: `光っていたところ: ${best.label}（${best.value}点）`, text: PRAISE[best.key] });
    if (weakest.key !== best.key) commentary.push({ title: `伸ばしたいところ: ${weakest.label}（${weakest.value}点）`, text: ADVICE[weakest.key] });
  }
  if (summary.vsStatic.games && summary.vsRanging.games) {
    commentary.push({
      title: '戦型ごとの成績',
      text: `居飛車の相手に${summary.vsStatic.wins}勝${summary.vsStatic.games - summary.vsStatic.wins}敗、振り飛車の相手に${summary.vsRanging.wins}勝${summary.vsRanging.games - summary.vsRanging.wins}敗でした。`,
    });
  }
  if (worst) {
    commentary.push({ title: '一番の悪手', text: `第${worst.game}局の${worst.label}（評価値で${worst.loss}の損）。ここを振り返ると、次につながるよ。` });
  }
  if (summary.kinds.brilliant > 0 || summary.kinds.good > 0) {
    commentary.push({ title: '光った手', text: `好手が${summary.kinds.good}回、神の一手が${summary.kinds.brilliant}回ありました。` });
  }
  if (!analyzed.length) {
    commentary.push({ title: '解析', text: pending ? '対局を解析しています。終わると、レーダーチャートと解説が出ます。' : 'この期の対局は、解析できませんでした。' });
  }
  return { radar, summary, commentary, pending, rates: { win: summary.winRate === null ? '' : pct(summary.winRate) } };
}
