// 名人戦(順位戦から名人へ。docs/meijin-design.md)。
// プレイヤーのクラスの順位戦の期(組み合わせ・回戦の進行・順位表・昇級と降級点・自力/他力・A級のプレーオフ・名人戦七番勝負)と、
// 全クラスの「順位戦の世界」(棋士・順位・降級点・名人)の1期ぶんの進め方。
// 竜王戦とは別々の暦で進む(13章)。保存と暦に依存しない(棋士として1年を過ごすモードのカレンダーからも呼べるように)。

import { createRng } from './ryuo-random.mjs';
import { USER_ID, createSeries, recordSeriesGame, seasonPlayerOf } from './ryuo.mjs';
import { gameRecordOf, simulateMemberGame } from './ryuo-simulation.mjs';
import { pickGameStyle } from './ryuo-repertoire.mjs';
import { levelToRating, winProbability } from './ryuo-strength.mjs';
import { HANANE } from './ryuo-story.mjs';
import { seriesView } from './ryuo-stages.mjs';
import { JUNNI_SIZES } from './ryuo-league.mjs';

export const MEIJIN_SEASON_VERSION = 1;
/** 上から。プレイヤーが上がっていく順の逆。 */
export const MEIJIN_CLASSES = Object.freeze(['A', 'B1', 'B2', 'C1', 'C2']);
export const CLASS_LABELS = Object.freeze({ A: 'A級', B1: 'B級1組', B2: 'B級2組', C1: 'C級1組', C2: 'C級2組' });

/**
 * クラスの決まり(1章。要確認の点は簡略にした初期値)。
 * rounds: 1期の対局数(実物どおりの規模)、roundRobin: 総当たり、promote: 昇級の人数、relegate: 降級の人数(A級・B級1組)、
 * pointShare: 降級点が付く下位の割合、pointLimit: 降級する降級点の数、noDrop: 降級点がたまっても落ちない(C級2組。降級点を消して再挑戦)。
 */
export const CLASS_RULES = Object.freeze({
  A: { rounds: 9, roundRobin: true, promote: 0, relegate: 2 },
  B1: { rounds: 12, roundRobin: true, promote: 2, relegate: 2 },
  B2: { rounds: 10, promote: 2, pointShare: 0.2, pointLimit: 2 },
  C1: { rounds: 10, promote: 2, pointShare: 0.2, pointLimit: 2 },
  C2: { rounds: 10, promote: 3, pointShare: 0.2, pointLimit: 3, noDrop: true },
});

/** 規模(1期の対局数)。昇級・降級の人数は変えない。 */
export const MEIJIN_SCALES = Object.freeze([
  { id: 'full', label: '実物どおり', rounds: null },
  { id: 'short', label: '短め', rounds: 7 },
  { id: 'mini', label: 'みじかい', rounds: 5 },
]);
export const meijinScale = (id) => MEIJIN_SCALES.find((scale) => scale.id === id) ?? MEIJIN_SCALES[0];

/** 名人戦七番勝負の勝ち数と、永世名人の期数。 */
export const MEIJIN_NEED = 4;
export const ETERNAL_MEIJIN = 5;
/** クラスで上がる段位(順位戦の昇段規定。ryuo-league.mjsと同じ)。 */
const CLASS_DAN = Object.freeze({ C2: '四段', C1: '五段', B2: '六段', B1: '七段', A: '八段' });
const DAN_ORDER = Object.freeze(['四段', '五段', '六段', '七段', '八段', '九段']);

const classIndex = (cls) => MEIJIN_CLASSES.indexOf(cls);
const upperClass = (cls) => MEIJIN_CLASSES[classIndex(cls) - 1] ?? null;
const lowerClass = (cls) => MEIJIN_CLASSES[classIndex(cls) + 1] ?? null;

function shuffle(rng, list) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(rng.next() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

const isPro = (member) => member?.kind === 'pro';

// ---- 順位戦の世界(全クラスの棋士・順位・降級点・名人)

/**
 * 最初の順位戦の世界を、名簿の今の順位戦(junni)から作る。クラスの中は強い順を順位にする。
 * プレイヤーはC級2組の最後(新四段)。羽音は新四段なので、C級2組のプレイヤーの前に入れる。名人は名簿の名人。
 * @param {any} roster ryuo-roster.mjsの名簿
 * @returns {{ holder: string | null, classes: Record<string, string[]>, points: Record<string, number>, even: Record<string, boolean> }}
 */
export function createLeague(roster) {
  const holderId = roster?.titles?.meijin;
  const holder = holderId && isPro(roster.players?.[holderId]) ? holderId : null;
  const classes = Object.fromEntries(MEIJIN_CLASSES.map((cls) => [cls, []]));
  const pros = Object.values(roster?.players ?? {}).filter((member) => isPro(member) && member.id !== holder);
  for (const cls of MEIJIN_CLASSES) {
    classes[cls] = pros.filter((member) => member.junni === cls && member.story !== HANANE)
      .sort((a, b) => b.rating - a.rating)
      .map(({ id }) => id);
  }
  const hanane = pros.find((member) => member.story === HANANE);
  if (hanane) classes.C2.push(hanane.id);
  classes.C2.push(USER_ID);
  return { holder, classes, points: {}, even: {} };
}

/**
 * 期の始めに、名簿と照らし合わせる。名簿から消えた棋士(引退)は外し、名簿にいて世界にいない棋士(新四段)はC級2組の最後に足す。
 * 名人が名簿から消えていれば、名人は空き(次の七番勝負で、A級の1位がそのまま名人になる)。
 */
export function syncLeague(league, roster) {
  const next = structuredClone(league);
  const alive = (id) => id === USER_ID || isPro(roster?.players?.[id]);
  for (const cls of MEIJIN_CLASSES) next.classes[cls] = next.classes[cls].filter(alive);
  if (next.holder && !alive(next.holder)) next.holder = null;
  const known = new Set([next.holder, ...MEIJIN_CLASSES.flatMap((cls) => next.classes[cls])]);
  // フリークラスの棋士(名簿のjunniが'F')は順位戦に出ない。
  const rookies = Object.values(roster?.players ?? {}).filter((member) => isPro(member) && member.junni !== 'F' && !known.has(member.id));
  next.classes.C2.push(...rookies.sort((a, b) => b.rating - a.rating).map(({ id }) => id));
  return next;
}

/** プレイヤーのいるクラス(名人ならnull)。 */
export const userClass = (league) => MEIJIN_CLASSES.find((cls) => league.classes[cls].includes(USER_ID)) ?? null;

// ---- 期

/**
 * 名人戦の1期を始める。プレイヤーがクラスにいれば、そのクラスの順位戦。名人なら、A級を自動で進め、1位を迎えて防衛戦。
 * @param {{
 *   no: number, league: any, roster: any,
 *   settings: { difficulty: number, scale?: string, coachLevel?: string, hintLimit?: number, undoLimit?: number },
 *   userLevel: number, userName?: string, userDan?: string, seed?: number,
 * }} input
 */
export function createMeijinSeason({ no, league, roster, settings, userLevel, userName = 'あなた', userDan = '四段', seed = Date.now() }) {
  const rng = createRng(seed);
  const world = syncLeague(league, roster);
  const cls = userClass(world);
  const scale = meijinScale(settings.scale);
  const season = {
    version: MEIJIN_SEASON_VERSION,
    id: seed,
    no,
    mode: cls ? 'challenge' : 'defense',
    cls: cls ?? 'A',
    settings: { ...settings, scale: scale.id },
    league: world,
    players: {},
    order: [],
    rounds: 0,
    schedule: [],
    results: [],
    round: 0,
    phase: 'league',
    playoff: null,
    finals: null,
    pending: null,
    userGames: [],
    result: null,
    /** 全クラスの棋士のレーティング(ほかのクラスの自動の成績に使う)。 */
    ratings: {},
    rngState: 0,
  };
  season.players[USER_ID] = {
    id: USER_ID, name: userName, dan: userDan, kind: 'user',
    level: Math.round(userLevel), rating: levelToRating(userLevel, settings.difficulty), style: null,
  };
  const snapshot = (id) => {
    if (!season.players[id] && roster?.players?.[id]) season.players[id] = seasonPlayerOf(roster, id, settings.difficulty);
  };
  if (world.holder) snapshot(world.holder);
  for (const cls of MEIJIN_CLASSES) {
    for (const id of world.classes[cls]) {
      season.ratings[id] = id === USER_ID ? season.players[USER_ID].rating : roster?.players?.[id]?.rating ?? 0;
    }
  }
  season.order = [...world.classes[season.cls]];
  for (const id of season.order) if (id !== USER_ID) snapshot(id);
  const rule = CLASS_RULES[season.cls];
  season.rounds = Math.max(1, Math.min(scale.rounds ?? rule.rounds, season.order.length - 1));
  season.schedule = buildSchedule(season, rng);
  return drive(season, rng);
}

/**
 * 1期の組み合わせ。回戦ごとに、プレイヤーの相手と、ほかの棋士どうしの組(同じ相手と2度当たらないように)。
 * 数が合わずに余った棋士(extra)は、その回戦はクラスの平均の相手と指したことにする。
 * 羽音がいれば、プレイヤーと必ず1度当たる(期の後半)。名人の防衛戦の期は、A級の総当たりを全員分作る。
 */
function buildSchedule(season, rng) {
  const order = season.order;
  const others = order.filter((id) => id !== USER_ID);
  const userIn = order.includes(USER_ID);
  const rounds = season.rounds;
  let opponents = userIn ? shuffle(rng, others).slice(0, rounds) : [];
  const hanane = others.find((id) => season.players[id]?.story === HANANE);
  if (userIn && hanane) {
    if (!opponents.includes(hanane)) opponents[opponents.length - 1] = hanane;
    const at = Math.min(rounds - 1, Math.floor(rounds * 0.6));
    const from = opponents.indexOf(hanane);
    [opponents[at], opponents[from]] = [opponents[from], opponents[at]];
  }
  const played = new Set();
  const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const schedule = [];
  for (let round = 0; round < rounds; round += 1) {
    const opponent = opponents[round] ?? null;
    if (opponent) played.add(key(USER_ID, opponent));
    const pool = shuffle(rng, others.filter((id) => id !== opponent));
    const pairs = [];
    while (pool.length > 1) {
      const a = pool.shift();
      let index = pool.findIndex((b) => !played.has(key(a, b)));
      if (index < 0) index = 0;
      const [b] = pool.splice(index, 1);
      played.add(key(a, b));
      pairs.push([a, b]);
    }
    schedule.push({ opponent, pairs, extra: pool[0] ?? null });
  }
  return schedule;
}

/** いまの回戦のプレイヤーの対局を決める(先後は振り駒。相手の戦法は使用率から)。 */
function setPending(season, rng) {
  const entry = season.schedule[season.round];
  const opponent = season.players[entry.opponent];
  const color = rng.next() < 0.5 ? 'black' : 'white';
  const style = opponent?.repertoire
    ? pickGameStyle(rng, opponent.repertoire, { color: color === 'black' ? 'white' : 'black' })
    : opponent?.style ?? null;
  const last = season.round === season.rounds - 1;
  season.pending = {
    kind: 'league', round: season.round, opponentId: entry.opponent, color, style,
    label: `${CLASS_LABELS[season.cls]} ${last ? '最終局' : `${season.round + 1}回戦`}`,
  };
}

/** クラスの平均のレーティング(余った棋士の相手と、ほかのクラスの自動の成績に使う)。 */
function meanRating(season, ids) {
  const ratings = ids.filter((id) => id !== USER_ID).map((id) => season.players[id]?.rating).filter(Number.isFinite);
  return ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : 0;
}

/** いまの回戦の、プレイヤー以外の対局を自動で指す。 */
function playOthers(season, rng) {
  const entry = season.schedule[season.round];
  const games = entry.pairs.map(([a, b]) => {
    const result = simulateMemberGame(rng, season.players[a], season.players[b]);
    return { a, b, winner: result.aWins ? a : b, ...gameRecordOf(result, a, b) };
  });
  const extra = entry.extra
    ? { id: entry.extra, win: rng.next() < winProbability(season.players[entry.extra].rating, meanRating(season, season.order)) }
    : null;
  return { games, extra };
}

/** プレイヤーの1局を記録し、同じ回戦のほかの対局を指して、次の対局(か期の終わり)まで進める。 */
export function recordMeijinGame(season, outcome) {
  const next = structuredClone(season);
  const pending = next.pending;
  if (!pending) return next;
  const rng = createRng(next.rngState);
  const win = outcome === 'win';
  next.userGames.push({ kind: pending.kind, round: pending.round, opponentId: pending.opponentId, win, color: pending.color, label: pending.label });
  next.pending = null;
  const game = { black: pending.color === 'black' ? USER_ID : pending.opponentId, openings: { [pending.opponentId]: pending.style?.opening ?? null } };
  if (pending.kind === 'league') {
    next.results[pending.round] = { user: { win, ...game }, ...playOthers(next, rng) };
    next.round += 1;
  } else if (pending.kind === 'playoff') {
    const match = next.playoff.matches[next.playoff.matches.length - 1];
    match.winner = win ? USER_ID : pending.opponentId;
    match.game = game;
  } else {
    recordSeriesGame(next.finals, win ? USER_ID : pending.opponentId, game);
  }
  return drive(next, rng);
}

/** プレイヤーの次の対局まで、または期の終わりまで進める。 */
function drive(season, rng) {
  if (season.mode === 'defense' && season.phase === 'league') {
    // 名人は順位戦を指さない。A級を自動で進め、1位を迎える。
    while (season.round < season.rounds) {
      season.results[season.round] = playOthers(season, rng);
      season.round += 1;
    }
    finishLeague(season, rng);
  }
  if (season.phase === 'league') {
    if (season.round < season.rounds) setPending(season, rng);
    else finishLeague(season, rng);
  }
  if (season.phase === 'playoff') drivePlayoff(season, rng);
  if (season.phase === 'title') driveTitle(season, rng);
  season.rngState = rng.state;
  return season;
}

/** 保存から読んだ期を、次の対局(か期の終わり)まで進め直す(読み込み直後の安全のため。進めることがなければ同じ)。 */
export function resumeMeijinSeason(season) {
  const next = structuredClone(season);
  if (next.pending || next.phase === 'done') return next;
  return drive(next, createRng(next.rngState));
}

// ---- 成績と順位

/**
 * 各棋士の今期の成績(勝ち・負け・残りの対局数)。
 * @returns {Record<string, { wins: number, losses: number, remaining: number, rank: number }>}
 */
export function seasonRecords(season) {
  const records = Object.fromEntries(season.order.map((id, rank) => [id, { wins: 0, losses: 0, remaining: 0, rank }]));
  const add = (id, win) => {
    if (!records[id]) return;
    if (win) records[id].wins += 1;
    else records[id].losses += 1;
  };
  season.results.forEach((result, round) => {
    if (!result) return;
    const entry = season.schedule[round];
    if (result.user) {
      add(USER_ID, result.user.win);
      add(entry.opponent, !result.user.win);
    }
    for (const game of result.games) {
      add(game.a, game.winner === game.a);
      add(game.b, game.winner === game.b);
    }
    if (result.extra) add(result.extra.id, result.extra.win);
  });
  for (let round = season.results.length; round < season.rounds; round += 1) {
    const entry = season.schedule[round];
    if (!entry) continue;
    if (entry.opponent) {
      records[USER_ID].remaining += 1;
      records[entry.opponent].remaining += 1;
    }
    for (const [a, b] of entry.pairs) {
      records[a].remaining += 1;
      records[b].remaining += 1;
    }
    if (entry.extra) records[entry.extra].remaining += 1;
  }
  return records;
}

/**
 * 順位表(上から)。勝ち数の多い順、同じ勝ち数なら順位が上の順(頭ハネ)。
 * @returns {{ id: string, wins: number, losses: number, remaining: number, rank: number, place: number }[]}
 */
export function standings(season) {
  const records = seasonRecords(season);
  return Object.entries(records)
    .map(([id, record]) => ({ id, ...record }))
    .sort((a, b) => b.wins - a.wins || a.rank - b.rank)
    .map((row, index) => ({ ...row, place: index + 1 }));
}

/**
 * 昇級(A級は挑戦)の見通し(5-1)。残りを全部勝ったときに、上に来うる棋士の数で決める
 * (棋士どうしの残りの対局は考えない、控えめな見積もり)。
 * - clinched: 残りを全部負けても昇級(A級は挑戦かプレーオフ)
 * - self: 残りを全部勝てば、ほかの結果にかかわらず昇級(自力)
 * - others: ほかの結果しだい(他力)。rivalsは、上に来うる棋士(勝ち数の多い順)
 * - out: 昇級の可能性がない
 * @returns {{ status: 'clinched' | 'self' | 'others' | 'out' | 'none', slots: number, rivals: string[] }}
 */
export function promotionOutlook(season, id = USER_ID) {
  const rule = CLASS_RULES[season.cls];
  const slots = season.cls === 'A' ? 1 : rule.promote;
  const records = seasonRecords(season);
  const me = records[id];
  if (!me || !slots) return { status: 'none', slots, rivals: [] };
  const best = me.wins + me.remaining;
  const worst = me.wins;
  const tieBeats = (other) => (season.cls === 'A' ? false : other.rank < me.rank);
  const beats = (wins, other, target) => wins > target || (wins === target && tieBeats(other));
  const others = Object.entries(records).filter(([other]) => other !== id);
  const canPass = others.filter(([, other]) => beats(other.wins + other.remaining, other, best));
  const surelyPass = others.filter(([, other]) => beats(other.wins, other, best));
  const canPassWorst = others.filter(([, other]) => beats(other.wins + other.remaining, other, worst));
  const rivals = canPass.sort((a, b) => b[1].wins - a[1].wins || a[1].rank - b[1].rank).map(([other]) => other);
  if (canPassWorst.length < slots) return { status: 'clinched', slots, rivals: [] };
  if (canPass.length < slots) return { status: 'self', slots, rivals };
  if (surelyPass.length < slots) return { status: 'others', slots, rivals };
  return { status: 'out', slots, rivals };
}

/**
 * クラスの期の結果(昇級・残留・降級点・降級)。standingsは上からの順位表。ほかのクラスの自動の結果にも使う。
 * @param {string} cls
 * @param {{ id: string, wins: number, losses: number }[]} table
 * @param {{ points: Record<string, number>, even: Record<string, boolean> }} league
 * @returns {Record<string, { outcome: 'promote' | 'stay' | 'point' | 'demote' | 'reset' | 'clear' | 'challenger', points: number, even: boolean }>}
 */
export function classOutcome(cls, table, league) {
  const rule = CLASS_RULES[cls];
  const result = {};
  const n = table.length;
  const promoted = new Set(table.slice(0, rule.promote).map(({ id }) => id));
  const relegated = new Set(rule.relegate ? table.slice(-rule.relegate).map(({ id }) => id) : []);
  const pointCount = rule.pointShare ? Math.floor(n * rule.pointShare) : 0;
  const pointed = new Set(table.slice(n - pointCount).map(({ id }) => id).filter((id) => !promoted.has(id)));
  for (const row of table) {
    let points = league.points?.[row.id] ?? 0;
    let even = league.even?.[row.id] ?? false;
    let outcome = 'stay';
    if (cls === 'A' && row === table[0]) outcome = 'challenger';
    if (promoted.has(row.id)) {
      outcome = 'promote';
      points = 0;
      even = false;
    } else if (relegated.has(row.id)) {
      outcome = 'demote';
      points = 0;
      even = false;
    } else if (pointed.has(row.id)) {
      points += 1;
      even = false;
      outcome = 'point';
      if (points >= rule.pointLimit) {
        outcome = rule.noDrop ? 'reset' : 'demote';
        points = 0;
      }
    } else if (points > 0 && (row.wins > row.losses || (row.wins === row.losses && even))) {
      // 勝ち越すか、2期続けて5割で、降級点を1つ消す。
      points -= 1;
      even = false;
      if (outcome !== 'challenger') outcome = 'clear';
    } else {
      even = row.wins === row.losses;
    }
    result[row.id] = { outcome, points, even };
  }
  return result;
}

// ---- 期の終わり(A級のプレーオフ・名人戦七番勝負)

/** パラマス方式の順(順位の下の者から。最後が順位のいちばん上の者)。 */
export function paramasLadder(rows) {
  return [...rows].sort((a, b) => b.rank - a.rank).map(({ id }) => id);
}

function finishLeague(season, rng) {
  const table = standings(season);
  if (season.cls === 'A') {
    const top = table.filter((row) => row.wins === table[0].wins);
    if (top.length > 1) {
      // パラマス方式: 順位の下の者から勝ち抜き。最後に、順位がいちばん上の者と当たる。
      const ladder = paramasLadder(top);
      season.playoff = { ladder, matches: [], winner: null };
      season.phase = 'playoff';
      return;
    }
    season.challenger = table[0].id;
    season.phase = 'title';
    return;
  }
  finishSeason(season);
}

function drivePlayoff(season, rng) {
  const playoff = season.playoff;
  for (;;) {
    const last = playoff.matches.at(-1);
    if (last && last.winner === null) {
      if (last.a === USER_ID || last.b === USER_ID) return;
    }
    const step = playoff.matches.length;
    if (step >= playoff.ladder.length - 1) {
      playoff.winner = playoff.matches.at(-1)?.winner ?? playoff.ladder[0];
      season.challenger = playoff.winner;
      season.phase = 'title';
      return;
    }
    const a = step === 0 ? playoff.ladder[0] : playoff.matches.at(-1).winner;
    const b = playoff.ladder[step + 1];
    const match = { a, b, winner: null, game: null };
    playoff.matches.push(match);
    if (a === USER_ID || b === USER_ID) {
      const opponentId = a === USER_ID ? b : a;
      const color = rng.next() < 0.5 ? 'black' : 'white';
      const opponent = season.players[opponentId];
      season.pending = {
        kind: 'playoff', round: step, opponentId, color,
        style: opponent?.repertoire ? pickGameStyle(rng, opponent.repertoire, { color: color === 'black' ? 'white' : 'black' }) : opponent?.style ?? null,
        label: 'A級プレーオフ',
      };
      return;
    }
    const result = simulateMemberGame(rng, season.players[a], season.players[b], { big: true });
    match.winner = result.aWins ? a : b;
    match.game = gameRecordOf(result, a, b);
  }
}

function driveTitle(season, rng) {
  const holder = season.league.holder;
  const challenger = season.challenger;
  // 名人が空き(引退)なら、A級の1位がそのまま名人。
  if (!holder || !challenger || holder === challenger) {
    season.titleWinner = challenger ?? holder;
    finishSeason(season);
    return;
  }
  if (!season.finals) season.finals = createSeries('名人戦七番勝負', holder, challenger, MEIJIN_NEED);
  const series = season.finals;
  const userIn = series.a === USER_ID || series.b === USER_ID;
  while (series.winner === null) {
    const last = series.games.at(-1);
    const aColor = last?.black ? (last.black === series.a ? 'white' : 'black') : rng.next() < 0.5 ? 'black' : 'white';
    if (userIn) {
      const opponentId = series.a === USER_ID ? series.b : series.a;
      const color = series.a === USER_ID ? aColor : aColor === 'black' ? 'white' : 'black';
      const opponent = season.players[opponentId];
      season.pending = {
        kind: 'finals', round: series.games.length, opponentId, color,
        style: opponent?.repertoire ? pickGameStyle(rng, opponent.repertoire, { color: color === 'black' ? 'white' : 'black' }) : opponent?.style ?? null,
        label: `名人戦七番勝負 第${series.games.length + 1}局`,
      };
      return;
    }
    const result = simulateMemberGame(rng, season.players[series.a], season.players[series.b], { big: true, aColor });
    recordSeriesGame(series, result.aWins ? series.a : series.b, gameRecordOf(result, series.a, series.b));
  }
  season.titleWinner = series.winner;
  finishSeason(season);
}

/** 期の結果(プレイヤーの成績と、昇級・残留・降級点・降級・挑戦・名人)。 */
function finishSeason(season) {
  season.phase = 'done';
  season.pending = null;
  const table = standings(season);
  const outcomes = classOutcome(season.cls, table, season.league);
  const me = table.find(({ id }) => id === USER_ID);
  const holderBefore = season.league.holder;
  const titleWinner = season.titleWinner ?? holderBefore;
  let outcome = me ? outcomes[USER_ID].outcome : 'defend';
  if (season.cls === 'A' && me) {
    if (season.challenger === USER_ID) outcome = titleWinner === USER_ID ? 'meijin' : 'challenger';
    else if (outcome === 'challenger') outcome = 'stay';
  }
  if (season.mode === 'defense') outcome = titleWinner === USER_ID ? 'defend' : 'lost-title';
  season.result = {
    cls: season.cls,
    wins: me?.wins ?? 0,
    losses: me?.losses ?? 0,
    place: me?.place ?? null,
    outcome,
    points: me ? outcomes[USER_ID].points : 0,
    challenger: season.challenger ?? null,
    titleWinner,
  };
}

// ---- 画面の形

/** 棋士の札(名前・段位・Lv・戦法など。画面と、竜王戦と同じ次の一局の枠に使う)。 */
function brief(season, id) {
  const player = season.players[id];
  if (!player) return null;
  return {
    id, name: player.name, dan: id === season.league.holder && id !== USER_ID ? '名人' : player.dan, level: player.level,
    rating: player.rating, kind: player.kind, style: player.style ?? null, story: player.story ?? null,
    character: player.character ?? null, repertoire: player.repertoire ?? null, age: player.age ?? null,
    profile: player.profile ?? null, vsUser: player.vsUser ?? null,
  };
}

/** 各棋士の回戦ごとの勝ち負け(win・loss・rest(余った回の自動の1局は勝ち負けで数える)・null(まだ))。 */
function roundMarks(season) {
  const marks = Object.fromEntries(season.order.map((id) => [id, Array(season.rounds).fill(null)]));
  season.results.forEach((result, round) => {
    if (!result) return;
    const entry = season.schedule[round];
    if (result.user && entry.opponent) {
      marks[USER_ID][round] = result.user.win ? 'win' : 'loss';
      marks[entry.opponent][round] = result.user.win ? 'loss' : 'win';
    }
    for (const game of result.games) {
      marks[game.a][round] = game.winner === game.a ? 'win' : 'loss';
      marks[game.b][round] = game.winner === game.b ? 'win' : 'loss';
    }
    if (result.extra) marks[result.extra.id][round] = result.extra.win ? 'win' : 'loss';
  });
  return marks;
}

/** 自力・他力の1行(5-1。札の「自力」「他力」は画面が付ける)。責めない言い方で、次の目標を言う。 */
function outlookText(season, outlook) {
  const target = season.cls === 'A' ? '名人挑戦' : '昇級';
  const names = outlook.rivals.slice(0, 2).map((id) => `${season.players[id]?.name ?? ''}さん`).join('・');
  switch (outlook.status) {
    case 'clinched': return season.cls === 'A' ? '名人挑戦(かプレーオフ)が決まったよ' : '昇級が決まったよ！';
    case 'self': return `残りを全部勝てば${target}`;
    case 'others': return names ? `${names}が負ければ、${target}が近づく` : `ほかの結果しだいで${target}`;
    case 'out': return season.cls === 'A' ? '残りを勝って、A級に残ろう' : '勝ち越して、来期の順位を上げよう';
    default: return '';
  }
}

/**
 * 期の画面の形(docs/meijin-design.mdの7章)。順位表・自力/他力・次の一局・番勝負・結果。
 * @param {any} season
 */
export function describeMeijinSeason(season) {
  if (!season) return null;
  const rule = CLASS_RULES[season.cls];
  const table = standings(season);
  const marks = roundMarks(season);
  const pointCount = rule.pointShare ? Math.floor(table.length * rule.pointShare) : 0;
  const relegate = rule.relegate ?? 0;
  const promoteCount = season.cls === 'A' ? 1 : rule.promote;
  const rows = table.map((row) => {
    const player = brief(season, row.id);
    const zone = row.place <= promoteCount ? 'promote'
      : row.place > table.length - Math.max(pointCount, relegate) && (pointCount || relegate) ? (relegate ? 'demote' : 'point')
        : '';
    return {
      ...row, name: player?.name ?? '', dan: player?.dan ?? '', story: player?.story ?? null, you: row.id === USER_ID,
      points: season.league.points?.[row.id] ?? 0, marks: marks[row.id] ?? [], zone,
      next: season.pending?.kind === 'league' && season.pending.opponentId === row.id,
    };
  });
  const outlook = season.mode === 'challenge' ? promotionOutlook(season) : { status: 'none', slots: 0, rivals: [] };
  const pending = season.pending ? {
    ...season.pending,
    opponent: brief(season, season.pending.opponentId),
    stakes: { outlook: outlook.status, text: outlookText(season, outlook), boss: season.pending.kind !== 'league' || season.pending.round === season.rounds - 1 || brief(season, season.pending.opponentId)?.story === HANANE },
  } : null;
  const me = table.find(({ id }) => id === USER_ID) ?? null;
  return {
    no: season.no,
    title: `第${season.no}期 名人戦`,
    mode: season.mode,
    cls: season.cls,
    clsLabel: CLASS_LABELS[season.cls],
    phase: season.phase,
    round: season.round,
    rounds: season.rounds,
    promote: promoteCount,
    lines: { promote: promoteCount, point: pointCount, relegate },
    rows,
    me,
    outlook: { ...outlook, text: outlookText(season, outlook) },
    pending,
    holder: season.league.holder ? brief(season, season.league.holder) : null,
    playoff: season.playoff ? { ...season.playoff, names: season.playoff.ladder.map((id) => brief(season, id)?.name ?? '') } : null,
    series: season.finals ? seriesView(season.finals, { brief: (id) => brief(season, id), key: 'finals' }) : null,
    userGames: season.userGames,
    result: season.result,
    resultSeen: season.resultSeen === true,
    settings: season.settings,
  };
}

/** 期の目標の1行(入口と期の画面)。 */
export function meijinGoalLine(cls, rounds) {
  if (!cls) return '名人として、A級の1位を迎え撃とう';
  const rule = CLASS_RULES[cls];
  if (cls === 'A') return `A級で${rounds}局。1位になれば、名人戦七番勝負へ`;
  return `${CLASS_LABELS[cls]}で${rounds}局。上位${rule.promote}名に入れば、${CLASS_LABELS[upperClass(cls)]}へ昇級`;
}

/** 期の結果の見出し。 */
export const MEIJIN_OUTCOME_TEXT = Object.freeze({
  promote: '昇級', stay: '残留', point: '降級点', demote: '降級', reset: '降級点を消して再挑戦', clear: '降級点が消えた',
  challenger: '名人挑戦', meijin: '名人獲得', defend: '名人防衛', 'lost-title': '名人失冠',
});

// ---- 次の期の順位戦の世界

/**
 * 期を終えた順位戦の世界を、次の期へ進める。プレイヤーのクラスは実際の成績、ほかのクラスは自動(クラスの平均との勝率)で、
 * 昇級・降級点・降級を決める。次の期の順位は、降級してきた棋士 → 残った棋士(今期の成績順) → 昇級してきた棋士 → 新四段。
 * 名人は七番勝負の勝者。失冠した名人はA級の順位1位に入る。
 * @param {any} season 終わった期(phase: 'done')
 * @param {{ next(): number }} [rng]
 */
export function advanceLeague(season, rng = createRng((Number(season.id) ^ 0x2545f491) >>> 0)) {
  const league = structuredClone(season.league);
  const ratingOf = (id) => season.ratings?.[id] ?? season.players[id]?.rating ?? 0;
  const tables = {};
  for (const cls of MEIJIN_CLASSES) tables[cls] = cls === season.cls ? standings(season) : autoTable(league.classes[cls], cls, ratingOf, rng);
  const titleWinner = season.result?.titleWinner ?? league.holder;
  return nextWorld(league, tables, titleWinner);
}

/** プレイヤーのいないクラスの1期の成績表。クラスの平均との勝率で、1期の対局数を指したことにする(順位の上が、同じ勝ち数なら上)。 */
function autoTable(ids, cls, ratingOf, rng) {
  const rule = CLASS_RULES[cls];
  const rounds = Math.min(rule.rounds, Math.max(0, ids.length - 1));
  const mean = ids.length ? ids.reduce((sum, id) => sum + ratingOf(id), 0) / ids.length : 0;
  return ids.map((id, rank) => {
    let wins = 0;
    for (let game = 0; game < rounds; game += 1) if (rng.next() < winProbability(ratingOf(id), mean)) wins += 1;
    return { id, wins, losses: rounds - wins, rank };
  }).sort((a, b) => b.wins - a.wins || a.rank - b.rank);
}

/** 全クラスの成績表と名人戦の勝者から、次の期の順位戦の世界を作る。 */
function nextWorld(league, tables, titleWinner) {
  const outcomes = Object.fromEntries(MEIJIN_CLASSES.map((cls) => [cls, classOutcome(cls, tables[cls], league)]));
  const nextClasses = Object.fromEntries(MEIJIN_CLASSES.map((cls) => [cls, []]));
  const points = {};
  const even = {};
  const comingDown = Object.fromEntries(MEIJIN_CLASSES.map((cls) => [cls, []]));
  const comingUp = Object.fromEntries(MEIJIN_CLASSES.map((cls) => [cls, []]));
  for (const cls of MEIJIN_CLASSES) {
    for (const row of tables[cls]) {
      const result = outcomes[cls][row.id];
      points[row.id] = result.points;
      even[row.id] = result.even;
      if (result.outcome === 'promote' && upperClass(cls)) comingUp[upperClass(cls)].push(row.id);
      else if (result.outcome === 'demote' && lowerClass(cls)) comingDown[lowerClass(cls)].push(row.id);
    }
  }
  for (const cls of MEIJIN_CLASSES) {
    const stayers = tables[cls].filter((row) => !['promote', 'demote'].includes(outcomes[cls][row.id].outcome)).map(({ id }) => id);
    nextClasses[cls] = [...comingDown[cls], ...stayers, ...comingUp[cls]];
  }
  // 名人の交代: 新しい名人をクラスから外し、失冠した名人をA級の順位1位に入れる。
  if (titleWinner && titleWinner !== league.holder) {
    for (const cls of MEIJIN_CLASSES) nextClasses[cls] = nextClasses[cls].filter((id) => id !== titleWinner);
    if (league.holder) nextClasses.A.unshift(league.holder);
  }
  return { ...league, holder: titleWinner ?? null, classes: nextClasses, points, even };
}

/**
 * プレイヤーのいない名人戦の1期(プレイヤーが名人戦に出る前の、棋界の1年。docs/player-world-note-design.mdの2章)。
 * 全クラスを自動で進め、A級の1位(名人を除く)が名人と七番勝負を指す。名人がいなければ、A級の1位が名人になる。
 * @param {{ holder: string | null, classes: Record<string, string[]>, points?: Record<string, number>, even?: Record<string, boolean> }} league
 * @param {{ players: Record<string, any>, rng: { next(): number } }} options playersは名簿の棋士(idで引く)
 * @returns {{ league: any, challenger: string | null, titleWinner: string | null, series: any }}
 */
export function autoMeijinSeason(league, { players, rng }) {
  const ratingOf = (id) => players[id]?.rating ?? 0;
  const tables = Object.fromEntries(MEIJIN_CLASSES.map((cls) => [cls, autoTable(league.classes[cls], cls, ratingOf, rng)]));
  const challenger = tables.A[0]?.id ?? null;
  const holder = league.holder && players[league.holder] ? league.holder : null;
  let titleWinner = holder ?? challenger;
  let series = null;
  if (holder && challenger) {
    series = createSeries('名人戦七番勝負', holder, challenger, MEIJIN_NEED);
    let aColor = rng.next() < 0.5 ? 'black' : 'white';
    while (series.winner === null) {
      const result = simulateMemberGame(rng, players[series.a], players[series.b], { big: true, aColor });
      recordSeriesGame(series, result.aWins ? series.a : series.b, gameRecordOf(result, series.a, series.b));
      aColor = aColor === 'black' ? 'white' : 'black';
    }
    titleWinner = series.winner;
  }
  return { league: nextWorld({ ...league, holder }, tables, titleWinner), challenger, titleWinner, series };
}

// ---- キャリア

/**
 * 名人戦のキャリア(プレイヤー自身の歩み)。noは最後に指した期の番号、参加した期数はhistoryの長さ。
 * 順位戦の世界は名簿(roster.junni)に持つ(junni-world.mjs)。前の保存のleagueは、読み込んだあと名簿へ移す。
 */
export function createMeijinCareer() {
  return { version: 1, no: 0, best: 'C2', titles: 0, eternal: false, history: [] };
}

/**
 * 期の結果をキャリアに足す(次の期のクラス・名人の期数・永世名人・履歴。順位戦の世界を名簿へ書き戻すのはjunni-world.mjs)。
 * @param {ReturnType<typeof createMeijinCareer>} career
 * @param {any} season 終わった期
 */
export function applyMeijinSeason(career, season) {
  if (season.phase !== 'done' || career.no >= season.no) return career;
  const league = advanceLeague(season);
  const nextClass = userClass(league);
  const meijin = league.holder === USER_ID;
  const titles = career.titles + (meijin ? 1 : 0);
  const best = meijin ? 'meijin' : career.best === 'meijin' ? 'meijin'
    : [career.best, nextClass].filter(Boolean).sort((a, b) => classIndex(a) - classIndex(b))[0] ?? career.best;
  return {
    ...career,
    no: season.no,
    best,
    titles,
    eternal: career.eternal || titles >= ETERNAL_MEIJIN,
    history: [...career.history, {
      no: season.no, cls: season.cls, wins: season.result?.wins ?? 0, losses: season.result?.losses ?? 0,
      place: season.result?.place ?? null, outcome: season.result?.outcome ?? 'stay', next: meijin ? 'meijin' : nextClass,
    }],
  };
}

/** 名人戦のキャリアでの段位(クラスで上がる段位。名人で九段。下がらない)。 */
export function meijinDan(career) {
  if (!career) return '四段';
  if (career.best === 'meijin' || career.titles > 0) return '九段';
  return CLASS_DAN[career.best] ?? '四段';
}

/** 2つの段位の高い方。 */
export function higherDan(a, b) {
  return DAN_ORDER.indexOf(a) >= DAN_ORDER.indexOf(b) ? a : b;
}

// ---- 保存

export const MEIJIN_CAREER_KEY = 'yacobihime:shogi-match:meijin-career';
export const MEIJIN_SEASON_KEY = 'yacobihime:shogi-match:meijin-season';

function readJson(storage, key) {
  try {
    return JSON.parse(storage?.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}
function writeJson(storage, key, value) {
  try {
    if (value === null) storage?.removeItem(key);
    else storage?.setItem(key, JSON.stringify(value));
  } catch {
    // 保存できない環境では、その場かぎりで遊べる。
  }
}

const validLeague = (league) => league && typeof league === 'object'
  && MEIJIN_CLASSES.every((cls) => Array.isArray(league.classes?.[cls]) && league.classes[cls].every((id) => typeof id === 'string'))
  && (league.holder === null || typeof league.holder === 'string');

export function loadMeijinCareer(storage) {
  const parsed = readJson(storage, MEIJIN_CAREER_KEY);
  if (!parsed || parsed.version !== 1) return createMeijinCareer();
  const count = (value) => (Number.isFinite(value) && value > 0 ? Math.floor(value) : 0);
  return {
    version: 1,
    no: count(parsed.no),
    best: parsed.best === 'meijin' || MEIJIN_CLASSES.includes(parsed.best) ? parsed.best : 'C2',
    titles: count(parsed.titles),
    eternal: parsed.eternal === true,
    history: Array.isArray(parsed.history) ? parsed.history.filter((entry) => entry && Number.isFinite(entry.no)) : [],
    league: validLeague(parsed.league)
      ? { ...parsed.league, points: parsed.league.points ?? {}, even: parsed.league.even ?? {} }
      : null,
    // 前の期で選んだ設定(入口の初期値)。
    ...(parsed.settings && typeof parsed.settings === 'object' ? { settings: parsed.settings } : {}),
  };
}
export const saveMeijinCareer = (storage, career) => writeJson(storage, MEIJIN_CAREER_KEY, career);

export function loadMeijinSeason(storage) {
  const parsed = readJson(storage, MEIJIN_SEASON_KEY);
  return parsed && parsed.version === MEIJIN_SEASON_VERSION && Array.isArray(parsed.order) && Array.isArray(parsed.schedule) ? parsed : null;
}
export const saveMeijinSeason = (storage, season) => writeJson(storage, MEIJIN_SEASON_KEY, season);
