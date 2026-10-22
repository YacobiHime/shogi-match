// 竜王戦の期を、① 組のトーナメント・② 決勝トーナメント・③ 番勝負の3つの段階に分けて見せるための形(docs/ryuo-stages-design.md)。
// 制度(組み合わせ・昇級・番勝負)は変えない。ryuo.mjsの表と番勝負を、画面で読みやすい形に直すだけ。
// ryuo.mjsから読まない(循環を避ける)。棋士の札や回戦の名前は、呼ぶ側(describeSeason)が関数で渡す。

const USER = 'user';

/** 段階の番号(0〜2)。段階ごとの、期の進み(season.phase)。 */
const STAGE_OF_PHASE = Object.freeze({
  ranking: 0, revival: 0, 'main-setup': 1, main: 1, playoff: 2, finals: 2, 'prepare-defense': 2,
});

const sidePid = (bracket, side) => (side ? (side.pid ?? bracket.nodes[side.from]?.winner ?? null) : null);

/**
 * プレイヤーがいま(または最後に)いる段階。期が終わっていれば、最後に指した段階。
 * @param {any} season
 * @returns {0 | 1 | 2}
 */
export function currentStageIndex(season) {
  if (season.mode === 'defense') return 2;
  if (season.phase !== 'done') return /** @type {0 | 1 | 2} */ (STAGE_OF_PHASE[season.phase] ?? 0);
  const inSeries = [season.playoff, season.finals].some((series) => series && (series.a === USER || series.b === USER));
  if (inSeries) return 2;
  if ((season.qualified ?? []).includes(USER)) return 1;
  return 0;
}

/**
 * 3つの段階の一覧。statusは、済み(done)・いま(current)・まだ(upcoming)・見るだけ(watch。防衛戦の①②)。
 * winsとlossesは、その段階でのプレイヤーの勝敗。
 * @param {any} season
 */
export function seasonStages(season) {
  const current = currentStageIndex(season);
  const finished = season.phase === 'done';
  const games = season.userGames ?? [];
  const tally = (phases) => {
    const own = games.filter((game) => phases.includes(game.phase));
    return { wins: own.filter((game) => game.win).length, losses: own.filter((game) => !game.win).length };
  };
  const defense = season.mode === 'defense';
  // 直前の対局で、次の段階に進んだか(段階の道のりを光らせる)。
  const lastPhase = games.at(-1)?.phase;
  const lastStage = lastPhase === undefined ? null : STAGE_OF_PHASE[lastPhase] ?? null;
  const arrived = !finished && lastStage !== null && lastStage < current;
  const stages = [
    { key: 'group', label: defense ? '各組のランキング戦' : `${season.startGroup}組ランキング戦`, short: defense ? '各組' : `${season.startGroup}組`, ...tally(['ranking', 'revival']) },
    { key: 'final', label: '決勝トーナメント', short: '決勝T', ...tally(['main']) },
    { key: 'title', label: '番勝負', short: '番勝負', ...tally(['playoff', 'finals']) },
  ];
  return {
    current,
    arrived,
    stages: stages.map((stage, index) => ({
      ...stage,
      index,
      status: defense && index < 2 ? 'watch'
        : index < current || (finished && index === current) ? 'done'
          : index === current ? 'current' : 'upcoming',
    })),
  };
}

/**
 * トーナメント表を、試合の札の列にする(左から右へ回戦が進む)。1試合を1枚の札にし、上下に2人を置く。
 * 札の縦の位置(y)は、葉(棋士)を上から順に1つずつ並べたときの、その試合の山の真ん中(葉の単位)。
 * シードの棋士は、最初に出る試合の札にだけ出る(1回戦の札は作らない)。
 * @param {any} bracket ryuo.mjsのトーナメント表
 * @param {{
 *   brief: (pid: string) => any,
 *   roundLabel: (round: number) => string,
 *   labels?: { [pid: string]: string },
 *   pendingNodeId?: string | null,
 * }} options brief: 棋士の札、roundLabel: 回戦の名前、labels: 名前に添える札(例: 1組優勝)
 */
export function matchBracket(bracket, { brief, roundLabel, labels = {}, pendingNodeId = null }) {
  if (!bracket?.root?.from) return { rounds: [], matches: [], leafCount: 0, userNext: null };
  const matches = [];
  let leafCount = 0;
  // 山の葉の範囲を求めながら、試合の札を作る。戻り値は、その枝の縦の位置(葉の単位の真ん中)。
  const visit = (side) => {
    if (side.pid) {
      const y = leafCount + 0.5;
      leafCount += 1;
      return y;
    }
    const node = bracket.nodes[side.from];
    const ya = visit(node.a);
    const yb = visit(node.b);
    const slot = (child) => {
      const pid = sidePid(bracket, child);
      if (pid) {
        const player = brief(pid);
        return {
          pid,
          name: player?.name ?? '—',
          dan: player?.dan ?? '',
          label: labels[pid] ?? '',
          story: player?.story ?? null,
          you: pid === USER,
          from: child.from ?? null,
          placeholder: '',
        };
      }
      const childNode = bracket.nodes[child.from];
      return { pid: null, name: '', dan: '', label: '', story: null, you: false, from: child.from, placeholder: `${roundLabel(childNode.round)}の勝者` };
    };
    const top = slot(node.a);
    const bottom = slot(node.b);
    const winner = node.winner === null ? null : node.winner === top.pid ? 'top' : 'bottom';
    matches.push({
      id: node.id,
      round: node.round,
      y: (ya + yb) / 2,
      top,
      bottom,
      winner,
      how: node.game?.how ?? '',
      pending: node.id === pendingNodeId,
      final: node.id === bracket.root.from,
      userIn: top.you || bottom.you,
      // 勝ち上がりの線を、プレイヤーが通ったか(次の試合へ琥珀の線を引く)。
      userWon: node.winner === USER,
    });
    return (ya + yb) / 2;
  };
  visit(bracket.root);
  const roundCount = bracket.rounds ?? Math.max(...matches.map((match) => match.round));
  const rounds = Array.from({ length: roundCount }, (_, index) => ({ round: index + 1, label: roundLabel(index + 1) }));
  matches.sort((x, y) => x.round - y.round || x.y - y.y);
  const pending = matches.find((match) => match.pending);
  const lastUser = [...matches].reverse().find((match) => match.userIn);
  return {
    rounds,
    matches,
    leafCount,
    // 開いたときに見せる回戦(次の対局、なければプレイヤーが最後に指した試合)。
    userNext: pending ? pending.round : lastUser ? lastUser.round : null,
  };
}

/**
 * 決勝トーナメントの、その枠から挑戦者決定三番勝負までに要る勝ち数(三番勝負は数えない)。
 * @param {any} bracket
 * @param {string} pid
 */
export function winsToPlayoff(bracket, pid) {
  if (!bracket?.root?.from) return null;
  const depth = (side, d) => {
    if (side.pid) return side.pid === pid ? d : null;
    const node = bracket.nodes[side.from];
    return depth(node.a, d + 1) ?? depth(node.b, d + 1);
  };
  const found = depth(bracket.root, 0);
  if (found === null) return null;
  // 葉から根までの試合の数から、根(三番勝負)を除く。
  return Math.max(0, found - 1);
}

/**
 * 番勝負の星取り。プレイヤーから見た形(自分・相手・各局の勝敗と先後・次の局)。
 * プレイヤーが出ていない番勝負(防衛戦の挑戦者決定戦など)は、aから見る。
 * @param {any} series ryuo.mjsの番勝負
 * @param {{ brief: (pid: string) => any, key: string }} options
 * @returns {null | {
 *   key: string, label: string, need: number, maxGames: number, userIn: boolean, me: any, them: any,
 *   wins: { me: number, them: number }, games: { no: number, win: boolean, color: string, how: string }[],
 *   nextNo: number | null, unplayed: number, winner: 'me' | 'them' | null,
 * }}
 */
export function seriesView(series, { brief, key }) {
  if (!series) return null;
  const userIn = series.a === USER || series.b === USER;
  const me = userIn ? USER : series.a;
  const them = me === series.a ? series.b : series.a;
  const maxGames = series.need * 2 - 1;
  const games = (series.games ?? []).map((game, index) => ({
    no: index + 1,
    win: game.winner === me,
    // 自分の先後。記録がなければ空。
    color: game.black ? (game.black === me ? 'black' : 'white') : '',
    how: game.how ?? '',
  }));
  const done = series.winner !== null;
  return {
    key,
    label: series.label,
    need: series.need,
    maxGames,
    userIn,
    me: brief(me),
    them: brief(them),
    wins: { me: series.wins[me] ?? 0, them: series.wins[them] ?? 0 },
    games,
    // 次に指す局(決着していればnull)。
    nextNo: done ? null : games.length + 1,
    // 決着がついて、指さない局の数。
    unplayed: done ? maxGames - games.length : 0,
    winner: done ? (series.winner === me ? /** @type {'me'} */ ('me') : /** @type {'them'} */ ('them')) : null,
  };
}
