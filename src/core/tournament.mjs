// 「大会」の進行と判定。画面に依存しない。
// 研修会入会試験は、プロ棋士への道(研修会→奨励会→各段のリーグ→プロ)の最初の関門として作った、
// このゲームの簡易版である。日本将棋連盟の実際の試験の規定を再現したものではない。

export const TOURNAMENTS = Object.freeze([
  {
    id: 'kenshukai-exam',
    label: '研修会入会試験',
    description: 'プロ棋士への道の最初の関門。何局か指して、合格すると研修会に入会できる。',
    gameOptions: [1, 3, 5],
    defaultGames: 3,
    defaultLevel: 26,
  },
]);

export function tournamentById(id) {
  return TOURNAMENTS.find((tournament) => tournament.id === id);
}

const clampLevel = (level) => Math.min(40, Math.max(0, Math.round(level)));

/**
 * 入会試験の各局の相手のレベル。基準のレベルを中心に、局が進むほど強くなる(2レベルずつ)。
 * 1局だけのときは基準のレベル。
 */
export function examOpponentLevels(baseLevel, total) {
  const base = clampLevel(baseLevel);
  if (total <= 1) return [base];
  return Array.from({ length: total }, (_, index) => clampLevel(base + (index - (total - 1) / 2) * 2));
}

/** 合格に必要な勝ち数(引き分けは0.5勝)。半分より多く勝つ必要があり、1局なら1勝。 */
export function examPassLine(total) {
  return Math.floor(total / 2) + 1;
}

/**
 * @param {{ id?: string, total?: number, baseLevel?: number }} options
 */
export function createTournamentRun({ id = 'kenshukai-exam', total = 3, baseLevel = 26 } = {}) {
  const definition = tournamentById(id);
  if (!definition) throw new Error(`未知の大会です: ${id}`);
  const games = definition.gameOptions.includes(total) ? total : definition.defaultGames;
  return { id, total: games, baseLevel: clampLevel(baseLevel), levels: examOpponentLevels(baseLevel, games), results: [] };
}

/** 次に指す局(0始まり)。終わっていれば-1。 */
export function nextRound(run) {
  return run.results.length >= run.total ? -1 : run.results.length;
}

/** プレイヤーの手番。1局目は先手で、1局ごとに入れ替える。 */
export function roundColor(round) {
  return round % 2 === 0 ? 'black' : 'white';
}

/**
 * 1局の結果を記録した新しい進行状況を返す。
 * @param {ReturnType<typeof createTournamentRun>} run
 * @param {{ outcome: 'win' | 'loss' | 'draw' }} game
 */
export function recordTournamentGame(run, { outcome }) {
  const round = nextRound(run);
  if (round < 0) return run;
  return {
    ...run,
    results: [...run.results, { outcome, color: roundColor(round), opponentLevel: run.levels[round] }],
  };
}

export function tournamentTally(run) {
  const count = (outcome) => run.results.filter((game) => game.outcome === outcome).length;
  return { played: run.results.length, wins: count('win'), losses: count('loss'), draws: count('draw') };
}

/** 勝敗の表示。例: 「2勝1敗」「1勝1敗1引き分け」。 */
export function tallyText({ wins, losses, draws }) {
  return `${wins}勝${losses}敗${draws ? `${draws}引き分け` : ''}`;
}

/**
 * 全局が終わったときの判定。終わっていなければnull。
 * 合格は、半分より多く勝つこと。全勝で(3局以上のとき)F1、それ以外の合格はF2で入会する。
 */
export function examVerdict(run) {
  if (nextRound(run) >= 0) return null;
  const tally = tournamentTally(run);
  const score = tally.wins + tally.draws / 2;
  const passed = score >= examPassLine(run.total);
  const allWins = tally.wins === run.total;
  const grade = !passed ? null : allWins && run.total >= 3 ? 'F1' : 'F2';
  return {
    passed,
    grade,
    ...tally,
    record: tallyText(tally),
    title: grade
      ? { id: `kenshukai-${grade}`, label: `研修会 ${grade}クラス`, detail: `研修会入会試験に合格（${tallyText(tally)}）`, rank: grade === 'F1' ? 2 : 1 }
      : null,
  };
}

const OUTCOMES = ['win', 'loss', 'draw'];

/** 保存データから進行状況を復元する。不正ならnull。 */
export function sanitizeTournamentRun(value) {
  if (!value || typeof value !== 'object' || !tournamentById(value.id)) return null;
  const total = Number(value.total);
  if (!tournamentById(value.id).gameOptions.includes(total)) return null;
  const baseLevel = Number(value.baseLevel);
  if (!Number.isFinite(baseLevel)) return null;
  const run = createTournamentRun({ id: value.id, total, baseLevel });
  if (!Array.isArray(value.results) || value.results.length > total) return null;
  const results = [];
  for (const [index, game] of value.results.entries()) {
    if (!game || !OUTCOMES.includes(game.outcome)) return null;
    results.push({ outcome: game.outcome, color: roundColor(index), opponentLevel: run.levels[index] });
  }
  return { ...run, results };
}
