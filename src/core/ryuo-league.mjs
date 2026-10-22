// 名簿の棋士たちの、竜王戦以外の1年。プレイヤーは指さず、すべて自動で決める。
// - 年間の対局と成績(勝敗・連勝)。竜王戦の対局も数える。
// - 順位戦(A級〜C級2組・フリークラス)の昇級・降級
// - 竜王以外の7つのタイトル戦(挑戦者決定と番勝負)
// - 昇段(勝数規定・順位戦・タイトル・竜王戦の昇段規定)
// - 将棋大賞
// - 最初の名簿の、過去のタイトル獲得の履歴と通算勝数
// 数値は、実物の制度を簡略にした仮の値。設計は docs/tournament-design.md の「棋界の1年」。

import { gauss } from './ryuo-random.mjs';
import { PRO_MEAN_RATING, winProbability } from './ryuo-strength.mjs';
import { matchupBonus } from './player-character.mjs';
import { styleEntry } from './ryuo-repertoire.mjs';
import { simulateMemberGame } from './ryuo-simulation.mjs';

export const DAN_ORDER = Object.freeze(['四段', '五段', '六段', '七段', '八段', '九段']);

/** タイトル。gamesは番勝負の勝ち数(5番勝負は3、7番勝負は4)。竜王は大会(ryuo.mjs)で決める。 */
export const TITLES = Object.freeze([
  { id: 'ryuo', label: '竜王', need: 4 },
  { id: 'meijin', label: '名人', need: 4 },
  { id: 'oi', label: '王位', need: 4 },
  { id: 'eio', label: '叡王', need: 3 },
  { id: 'oza', label: '王座', need: 3 },
  { id: 'kio', label: '棋王', need: 3 },
  { id: 'osho', label: '王将', need: 4 },
  { id: 'kisei', label: '棋聖', need: 3 },
]);
export const OTHER_TITLES = Object.freeze(TITLES.filter(({ id }) => id !== 'ryuo'));
export const titleLabel = (id) => TITLES.find((title) => title.id === id)?.label ?? id;

/** 順位戦のクラスと定員。Fはフリークラス(順位戦に出ない)。 */
export const JUNNI_CLASSES = Object.freeze(['A', 'B1', 'B2', 'C1', 'C2', 'F']);
export const JUNNI_SIZES = Object.freeze({ A: 10, B1: 13, B2: 25, C1: 35, C2: 50 });
export const JUNNI_LABELS = Object.freeze({ A: 'A級', B1: 'B級1組', B2: 'B級2組', C1: 'C級1組', C2: 'C級2組', F: 'フリークラス' });
/** 1期の、上のクラスへの昇級の人数(同じ人数が、上のクラスから降級する)。C級2組の下位は、フリークラスへ。 */
const JUNNI_MOVES = Object.freeze({ B1: 2, B2: 3, C1: 3, C2: 3 });
const C2_TO_FREE = 2;
/** 順位戦の昇級で上がる段位。名人は九段。 */
const JUNNI_DAN = Object.freeze({ C1: '五段', B2: '六段', B1: '七段', A: '八段' });

/** 勝数規定。前の昇段からの勝ち数で、次の段位に上がる。 */
export const WINS_TO_PROMOTE = Object.freeze({ 四段: 100, 五段: 120, 六段: 150, 七段: 190, 八段: 250 });

/** 将棋大賞。 */
export const AWARDS = Object.freeze([
  { id: 'mvp', label: '最優秀棋士賞' },
  { id: 'excellent', label: '優秀棋士賞' },
  { id: 'rookie', label: '新人賞' },
  { id: 'most-wins', label: '最多勝利賞' },
  { id: 'most-games', label: '最多対局賞' },
  { id: 'best-rate', label: '勝率一位賞' },
  { id: 'streak', label: '連勝賞' },
]);
export const awardLabel = (id) => AWARDS.find((award) => award.id === id)?.label ?? id;
/** 勝率一位賞に必要な対局数。 */
const BEST_RATE_MIN_GAMES = 30;

/** 最初の名簿の過去の履歴を作るときの、その年の調子のばらつき(レーティング。昔の強さは分からないため)。 */
const FORM_SPREAD = 60;

/** 過去の履歴を作る年数。 */
export const HISTORY_YEARS = 20;

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const members = (roster) => Object.values(roster.players);
const pros = (roster) => members(roster).filter(({ kind }) => kind === 'pro');

function shuffle(rng, list) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(rng.next() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

// ---- 成績

export function createRecord() {
  return { season: { games: 0, wins: 0, losses: 0, bestStreak: 0 }, total: { wins: 0, losses: 0 }, streak: 0, sincePromotion: 0 };
}

/**
 * 1局の内訳を、成績の内訳(先手・後手、戦法ごと、勝ち方)に足す。byColorとbyOpeningは[勝ち, 負け]。howsは勝ち方ごとの勝ち数。
 * @param {any} bucket record.seasonかrecord.total
 * @param {boolean} win
 * @param {{ color?: 'black' | 'white' | null, opening?: string | null, how?: string | null }} detail
 */
function addDetail(bucket, win, { color = null, opening = null, how = null }) {
  const slot = win ? 0 : 1;
  if (color) {
    bucket.byColor ??= { black: [0, 0], white: [0, 0] };
    bucket.byColor[color][slot] += 1;
  }
  if (opening) {
    bucket.byOpening ??= {};
    bucket.byOpening[opening] ??= [0, 0];
    bucket.byOpening[opening][slot] += 1;
  }
  if (how && win) {
    bucket.hows ??= {};
    bucket.hows[how] = (bucket.hows[how] ?? 0) + 1;
  }
}

/**
 * 自動対局の1局を指し、両者の成績に足す。aColorはaの手番(省略すると乱数)。勝てばtrue。
 * @param {{ next(): number }} rng
 * @param {any} a
 * @param {any} b
 * @param {{ ratingOf?: (member: any) => number, big?: boolean, aColor?: 'black' | 'white' | null, record?: boolean }} [options]
 */
function playGame(rng, a, b, { ratingOf, big = false, aColor = null, record = true } = {}) {
  const result = simulateMemberGame(rng, a, b, { ratingOf, big, aColor });
  if (record) {
    const bColor = result.aColor === 'black' ? 'white' : 'black';
    addResult(a, result.aWins, { color: result.aColor, opening: result.openings.a, how: result.how });
    addResult(b, !result.aWins, { color: bColor, opening: result.openings.b, how: result.how });
  }
  return result.aWins;
}

export function ensureLeagueFields(member) {
  member.record ??= createRecord();
  member.titleCounts ??= {};
  member.awards ??= [];
}

function addResult(member, win, detail = {}) {
  ensureLeagueFields(member);
  const record = member.record;
  record.season.games += 1;
  addDetail(record.season, win, detail);
  addDetail(record.total, win, detail);
  if (win) {
    record.season.wins += 1;
    record.total.wins += 1;
    record.sincePromotion += 1;
    record.streak += 1;
    record.season.bestStreak = Math.max(record.season.bestStreak, record.streak);
  } else {
    record.season.losses += 1;
    record.total.losses += 1;
    record.streak = 0;
  }
}

/** 勝率。対局がなければnull。 */
export const winRate = ({ wins, losses }) => (wins + losses ? wins / (wins + losses) : null);

/** いちばんの得意戦法の、飛車の振り方。 */
export function rookOf(member) {
  const primary = member?.repertoire?.styles?.[0];
  return primary ? styleEntry(primary).rook : member?.style?.rook ?? null;
}

/**
 * レーティングと相性だけで見た勝率(目安。実際の自動対局は、先手と能力の配分の上乗せも足すryuo-simulation.mjsのsimulateMemberGameで決める)。
 */
export function memberWinProbability(a, b, ratingOf = (member) => member.rating) {
  return winProbability(
    ratingOf(a) + matchupBonus(a.character, rookOf(b)),
    ratingOf(b) + matchupBonus(b.character, rookOf(a)),
  );
}

// ---- 段位

/** 段位を上げる(下げない)。上がったら、勝数規定の勝ち数を数え直す。 */
export function raiseDan(member, dan) {
  if (member.kind !== 'pro') return false;
  if (DAN_ORDER.indexOf(dan) <= DAN_ORDER.indexOf(member.dan)) return false;
  member.dan = dan;
  ensureLeagueFields(member);
  member.record.sincePromotion = 0;
  return true;
}

/** タイトルの通算期数(竜王を含む)。 */
export function totalTitles(member) {
  return Object.values(member.titleCounts ?? {}).reduce((sum, count) => sum + count, 0) + (member.ryuo ?? 0);
}

/**
 * 実績から決まる段位まで上げる。
 * 竜王戦: 2組で六段、1組で七段、竜王1期で八段・2期で九段。順位戦: C級1組で五段〜A級で八段、名人1期で九段。
 * タイトル: 通算1期で七段、2期で八段、3期で九段。
 */
export function applyDanRules(member) {
  if (member.kind !== 'pro') return;
  const titles = totalTitles(member);
  if (member.group <= 2) raiseDan(member, '六段');
  if (member.group === 1) raiseDan(member, '七段');
  if (JUNNI_DAN[member.junni]) raiseDan(member, JUNNI_DAN[member.junni]);
  if (titles >= 1) raiseDan(member, '七段');
  if (titles >= 2 || (member.ryuo ?? 0) >= 1) raiseDan(member, '八段');
  if (titles >= 3 || (member.ryuo ?? 0) >= 2 || (member.titleCounts?.meijin ?? 0) >= 1) raiseDan(member, '九段');
}

/** 勝数規定による昇段。 */
export function applyWinsRule(member) {
  if (member.kind !== 'pro') return;
  const need = WINS_TO_PROMOTE[member.dan];
  if (need && member.record.sincePromotion >= need) raiseDan(member, DAN_ORDER[DAN_ORDER.indexOf(member.dan) + 1]);
}

// ---- 順位戦

/** 最初の名簿で、順位戦のクラスを決める。強い順(ゆらぎ込み)に定員で分け、残りはC級2組と、あふれたベテランはフリークラス。 */
export function assignJunni(roster, rng) {
  const order = pros(roster)
    .map((member) => ({ member, score: member.rating + gauss(rng) * 100 }))
    .sort((a, b) => b.score - a.score);
  let index = 0;
  for (const cls of ['A', 'B1', 'B2', 'C1']) {
    for (let count = 0; count < JUNNI_SIZES[cls] && index < order.length; count += 1, index += 1) order[index].member.junni = cls;
  }
  // 残りは、強い順(ゆらぎ込み)にC級2組の定員まで。45歳を過ぎたベテランは後ろに回し、あふれた棋士はフリークラス
  // (実物のC級2組の平均はC級1組とほぼ同じ1544。docs/rating-realism-design.md)。
  const rest = order.slice(index)
    .map(({ member, score }) => ({ member, score: score - (member.age > 45 ? 120 : 0) }))
    .sort((a, b) => b.score - a.score)
    .map(({ member }) => member);
  rest.forEach((member, position) => { member.junni = position < JUNNI_SIZES.C2 ? 'C2' : 'F'; });
}

function junniScore(rng, member) {
  const rate = winRate(member.record.season) ?? 0.5;
  return member.rating + 400 * (rate - 0.5) + gauss(rng) * 80;
}

/** 1期の順位戦。クラスごとに成績(勝率と強さ)で並べ、上位が昇級、下位が降級する。名人戦の挑戦者は、A級の1位。 */
function playJunni(roster, rng) {
  const byClass = Object.fromEntries(JUNNI_CLASSES.map((cls) => [cls, []]));
  for (const member of pros(roster)) {
    member.junni ??= 'C2';
    byClass[member.junni].push({ member, score: junniScore(rng, member) });
  }
  for (const cls of JUNNI_CLASSES) byClass[cls].sort((a, b) => b.score - a.score);
  const meijinHolder = roster.titles?.meijin;
  const challenger = byClass.A.find(({ member }) => member.id !== meijinHolder)?.member ?? null;
  const moves = [];
  for (const [cls, count] of Object.entries(JUNNI_MOVES)) {
    const upper = JUNNI_CLASSES[JUNNI_CLASSES.indexOf(cls) - 1];
    // 名人はA級の扱い。降級しない。
    const upperList = byClass[upper].filter(({ member }) => member.id !== meijinHolder);
    byClass[cls].slice(0, count).forEach(({ member }) => moves.push([member, upper]));
    upperList.slice(-count).forEach(({ member }) => moves.push([member, cls]));
  }
  byClass.C2.slice(-C2_TO_FREE).forEach(({ member }) => moves.push([member, 'F']));
  // フリークラスから、成績の良い若手が1名、C級2組に戻る。
  const comeback = byClass.F.find(({ member }) => member.age < 40);
  if (comeback) moves.push([comeback.member, 'C2']);
  for (const [member, cls] of moves) member.junni = cls;
  return challenger;
}

/** クラスの人数を定員にそろえる(引退や新四段で崩れた分)。多いクラスは成績の下から、少ないクラスは下のクラスの上から。 */
function rebalanceJunni(roster) {
  const list = (cls) => pros(roster).filter((member) => member.junni === cls).sort((a, b) => b.rating - a.rating);
  for (const cls of ['A', 'B1', 'B2', 'C1', 'C2']) {
    const lower = JUNNI_CLASSES[JUNNI_CLASSES.indexOf(cls) + 1];
    let current = list(cls);
    while (current.length > JUNNI_SIZES[cls]) {
      const last = current.filter(({ id }) => id !== roster.titles?.meijin).at(-1);
      last.junni = lower;
      current = current.filter((member) => member !== last);
    }
    while (current.length < JUNNI_SIZES[cls]) {
      const candidates = list(lower).filter((member) => lower !== 'F' || member.age < 50);
      const next = candidates[0];
      if (!next) break;
      next.junni = cls;
      current.push(next);
    }
  }
}

// ---- 順位戦の世界(docs/player-world-note-design.mdの2章)
//
// 順位戦のクラスごとの順位の並び・降級点・名人は、名簿のroster.junniに1つだけ持つ。
// 棋士のmember.junniと名簿の名人(roster.titles.meijin)は、ここから写す控え(writeJunniToMembers)。ほかでは書き換えない。
// 世界を1期進める(名人戦の期・名人戦に出る前の自動の期)のは junni-world.mjs。

/** 順位戦に出るクラス(上から)。 */
export const JUNNI_LEAGUE_CLASSES = Object.freeze(['A', 'B1', 'B2', 'C1', 'C2']);
/** プレイヤーのid(ryuo.mjsのUSER_IDと同じ)。 */
const USER = 'user';

/**
 * 名簿の今の順位戦(member.junni)と名人(roster.titles.meijin)から、順位戦の世界を作る。クラスの中は強い順。
 * プレイヤーはまだいない(名人戦に初めて出たときにC級2組の最後に入る)。
 */
export function createJunniWorld(roster) {
  const holderId = roster.titles?.meijin ?? null;
  const holder = holderId && roster.players[holderId]?.kind === 'pro' ? holderId : null;
  const classes = Object.fromEntries(JUNNI_LEAGUE_CLASSES.map((cls) => [cls, []]));
  const list = pros(roster).filter((member) => member.id !== holder).sort((a, b) => b.rating - a.rating);
  for (const member of list) {
    const cls = JUNNI_LEAGUE_CLASSES.includes(member.junni) ? member.junni : member.junni === 'F' ? null : 'C2';
    if (cls) classes[cls].push(member.id);
  }
  const free = list.filter((member) => member.junni === 'F').map(({ id }) => id);
  roster.junni = { version: 1, no: 0, holder, classes, points: {}, even: {}, free, userJoined: false };
  syncJunni(roster);
  return roster.junni;
}

/** プレイヤーのいるクラス(いなければnull。名人なら'meijin')。 */
export function junniClassOf(world, id) {
  if (!world) return null;
  if (world.holder === id) return 'meijin';
  return JUNNI_LEAGUE_CLASSES.find((cls) => world.classes[cls].includes(id)) ?? (world.free?.includes(id) ? 'F' : null);
}

/** クラスの中の順位(1から)。いなければnull。 */
export function junniPlaceOf(world, id) {
  const cls = junniClassOf(world, id);
  if (!cls || cls === 'meijin' || cls === 'F') return null;
  return world.classes[cls].indexOf(id) + 1;
}

/**
 * 名簿と照らし合わせる。引退した棋士を外し、新四段をC級2組の最後に足し、クラスの人数を定員にそろえる
 * (引退で減ったクラスは、下のクラスの順位の上から上げる。C級2組は、足りなければフリークラスの若い順から戻し、超えた分は下からフリークラスへ)。
 * プレイヤーは、そろえるために動かさない。最後に、棋士の控え(member.junni・名人)を書く。
 */
export function syncJunni(roster) {
  const world = roster.junni;
  if (!world) return null;
  const alive = (id) => id === USER || roster.players[id]?.kind === 'pro';
  for (const cls of JUNNI_LEAGUE_CLASSES) world.classes[cls] = world.classes[cls].filter(alive);
  world.free = (world.free ?? []).filter((id) => id !== USER && alive(id));
  if (world.holder && !alive(world.holder)) world.holder = null;
  const known = new Set([world.holder, ...world.free, ...JUNNI_LEAGUE_CLASSES.flatMap((cls) => world.classes[cls])]);
  // 世界にまだいない棋士(新四段・あとから加わった物語の人物)は、控えのクラスがあればその最後、なければC級2組の最後に入れる。
  const rookies = pros(roster).filter((member) => !known.has(member.id)).sort((a, b) => b.rating - a.rating);
  // 物語の人物(あとから名簿に加わった善彦など)は、そのクラスの強さの順の位置に入れる(新四段は最後)。
  for (const member of rookies) {
    if (member.junni === 'F') {
      world.free.push(member.id);
      continue;
    }
    const list = world.classes[JUNNI_LEAGUE_CLASSES.includes(member.junni) ? member.junni : 'C2'];
    const at = member.story ? list.findIndex((id) => (roster.players[id]?.rating ?? -Infinity) < member.rating) : -1;
    if (at >= 0) list.splice(at, 0, member.id);
    else list.push(member.id);
  }
  for (let index = 0; index < JUNNI_LEAGUE_CLASSES.length - 1; index += 1) {
    const cls = JUNNI_LEAGUE_CLASSES[index];
    const lower = JUNNI_LEAGUE_CLASSES[index + 1];
    while (world.classes[cls].length < JUNNI_SIZES[cls]) {
      const from = world.classes[lower].findIndex((id) => id !== USER);
      if (from < 0) break;
      world.classes[cls].push(...world.classes[lower].splice(from, 1));
    }
    while (world.classes[cls].length > JUNNI_SIZES[cls]) {
      const from = world.classes[cls].findLastIndex((id) => id !== USER);
      if (from < 0) break;
      world.classes[lower].unshift(...world.classes[cls].splice(from, 1));
    }
  }
  // C級2組が定員より少なければ、フリークラスの若い順に戻す(50歳以上は戻さない)。
  while (world.classes.C2.length < JUNNI_SIZES.C2) {
    const candidates = world.free.filter((id) => (roster.players[id]?.age ?? 99) < 50).sort((a, b) => roster.players[a].age - roster.players[b].age);
    if (!candidates.length) break;
    world.free = world.free.filter((id) => id !== candidates[0]);
    world.classes.C2.push(candidates[0]);
  }
  while (world.classes.C2.length > JUNNI_SIZES.C2) {
    const from = world.classes.C2.findLastIndex((id) => id !== USER);
    if (from < 0) break;
    world.free.unshift(...world.classes.C2.splice(from, 1));
  }
  for (const id of Object.keys(world.points ?? {})) if (!alive(id)) delete world.points[id];
  for (const id of Object.keys(world.even ?? {})) if (!alive(id)) delete world.even[id];
  writeJunniToMembers(roster);
  return world;
}

/** 順位戦の世界から、棋士の控え(member.junni。名人はA級の扱い)と名簿の名人(roster.titles.meijin)を書く。 */
export function writeJunniToMembers(roster) {
  const world = roster.junni;
  if (!world) return;
  const classOf = new Map();
  for (const cls of JUNNI_LEAGUE_CLASSES) for (const id of world.classes[cls]) classOf.set(id, cls);
  for (const id of world.free ?? []) classOf.set(id, 'F');
  if (world.holder) classOf.set(world.holder, 'A');
  for (const member of pros(roster)) member.junni = classOf.get(member.id) ?? 'F';
  roster.titles ??= {};
  if (world.holder) roster.titles.meijin = world.holder;
  else delete roster.titles.meijin;
}

// ---- タイトル戦

/** 番勝負。1局目の先後は振り駒で、あとは交互。大事な対局なので、大舞台の特殊能力が効く。 */
function playSeries(rng, holder, challenger, need, ratingOf, record = true) {
  const wins = { holder: 0, challenger: 0 };
  let holderColor = rng.next() < 0.5 ? 'black' : 'white';
  while (wins.holder < need && wins.challenger < need) {
    const holderWins = playGame(rng, holder, challenger, { ratingOf, big: true, aColor: holderColor, record });
    wins[holderWins ? 'holder' : 'challenger'] += 1;
    holderColor = holderColor === 'black' ? 'white' : 'black';
  }
  return wins.holder >= need ? holder : challenger;
}

/** 挑戦者決定の簡易トーナメント。強い順(ゆらぎ込み)の上位16名で、勝ち抜き戦をする。 */
function chooseChallenger(rng, pool, holderId, ratingOf, record) {
  let field = pool
    .filter((member) => member.id !== holderId)
    .map((member) => ({ member, score: ratingOf(member) + gauss(rng) * 80 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 16)
    .map(({ member }) => member);
  field = shuffle(rng, field);
  while (field.length > 1) {
    const next = [];
    for (let index = 0; index + 1 < field.length; index += 2) {
      const [a, b] = [field[index], field[index + 1]];
      const aWins = playGame(rng, a, b, { ratingOf, record });
      next.push(aWins ? a : b);
    }
    if (field.length % 2) next.push(field.at(-1));
    field = next;
  }
  return field[0] ?? null;
}

/** 竜王以外の7つのタイトル戦。結果を履歴に残し、獲得期数を数える。 */
function playOtherTitles(roster, rng, { no, meijinChallenger, ratingOf, skipMeijin = false }) {
  roster.titles ??= {};
  const pool = pros(roster);
  const results = [];
  for (const title of OTHER_TITLES) {
    if (skipMeijin && title.id === 'meijin') continue;
    let holder = roster.players[roster.titles[title.id]] ?? null;
    if (!holder) holder = [...pool].sort((a, b) => b.rating - a.rating)[0];
    const challenger = title.id === 'meijin' && meijinChallenger && meijinChallenger.id !== holder.id
      ? meijinChallenger
      : chooseChallenger(rng, pool, holder.id, ratingOf, true);
    const winner = challenger ? playSeries(rng, holder, challenger, title.need, ratingOf) : holder;
    roster.titles[title.id] = winner.id;
    ensureLeagueFields(winner);
    winner.titleCounts[title.id] = (winner.titleCounts[title.id] ?? 0) + 1;
    results.push({ no, title: title.id, holder: winner.id, name: winner.name, changed: winner.id !== holder.id });
  }
  roster.titleHistory = [...(roster.titleHistory ?? []), ...results];
  return results;
}

// ---- 1年の対局

/** 1年の対局数の目安。強い棋士ほど勝ち進んで、多く指す。 */
export function gamesPerYear(rating) {
  return Math.round(clamp(28 + (rating - 1450) / 12, 18, 60));
}

/**
 * その期の竜王戦の対局の勝敗(名簿の棋士の分)。表(トーナメント表)と番勝負から数える。
 * @returns {{ winner: string, loser: string }[]}
 */
export function ryuoSeasonGames(season, isMember) {
  const games = [];
  const fromBracket = (bracket) => {
    if (!bracket) return;
    for (const node of Object.values(bracket.nodes)) {
      if (node.winner === null) continue;
      const side = (entry) => (entry ? (entry.pid ?? bracket.nodes[entry.from]?.winner) : null);
      const a = side(node.a);
      const b = side(node.b);
      if (!a || !b) continue;
      games.push({ winner: node.winner, loser: node.winner === a ? b : a, game: node.game ?? null });
    }
  };
  fromBracket(season.ranking);
  for (const block of season.revival ?? []) fromBracket(block);
  for (const bracket of Object.values(season.groupBrackets ?? {})) fromBracket(bracket);
  fromBracket(season.main);
  for (const series of [season.playoff, season.finals]) {
    if (!series) continue;
    for (const game of series.games) games.push({ winner: game.winner, loser: game.winner === series.a ? series.b : series.a, game });
  }
  return games.filter(({ winner, loser }) => isMember(winner) || isMember(loser));
}

/** 竜王戦以外の対局を、強さの近い相手と組んで決める。 */
function otherGames(roster, rng) {
  const list = pros(roster);
  const games = [];
  for (const member of list) {
    const own = Math.max(0, gamesPerYear(member.rating) - member.record.season.games);
    for (let count = 0; count < Math.ceil(own / 2); count += 1) {
      const weights = list.map((other) => (other === member ? 0 : Math.exp(-Math.abs(other.rating - member.rating) / 250)));
      const total = weights.reduce((sum, weight) => sum + weight, 0);
      let roll = rng.next() * total;
      const opponent = list[weights.findIndex((weight) => (roll -= weight) <= 0)] ?? list.at(-1);
      games.push([member, opponent]);
    }
  }
  return games;
}

function resetSeasonRecords(roster) {
  for (const member of members(roster)) {
    ensureLeagueFields(member);
    member.record.season = { games: 0, wins: 0, losses: 0, bestStreak: 0 };
  }
}

/** 将棋大賞を決める。 */
function chooseAwards(roster, { no, titleResults }) {
  const list = pros(roster);
  const held = (member) => Object.values(roster.titles ?? {}).filter((id) => id === member.id).length + (roster.holder === member.id ? 1 : 0);
  const won = (member) => titleResults.filter(({ holder, changed }) => holder === member.id && changed).length;
  const mvpScore = (member) => held(member) * 3 + won(member) * 2 + (winRate(member.record.season) ?? 0) + member.rating / 2000;
  const ranked = [...list].sort((a, b) => mvpScore(b) - mvpScore(a));
  const awards = [];
  const give = (id, member) => {
    if (!member) return;
    member.awards.push({ no, id });
    awards.push({ no, id, holder: member.id, name: member.name });
  };
  give('mvp', ranked[0]);
  give('excellent', ranked[1]);
  const rookies = list.filter((member) => DAN_ORDER.indexOf(member.dan) <= 2 && member.age <= 26);
  give('rookie', [...rookies].sort((a, b) => b.record.season.wins - a.record.season.wins || b.rating - a.rating)[0]);
  give('most-wins', [...list].sort((a, b) => b.record.season.wins - a.record.season.wins)[0]);
  give('most-games', [...list].sort((a, b) => b.record.season.games - a.record.season.games)[0]);
  const qualified = list.filter(({ record }) => record.season.games >= BEST_RATE_MIN_GAMES);
  give('best-rate', [...qualified].sort((a, b) => winRate(b.record.season) - winRate(a.record.season))[0]);
  give('streak', [...list].sort((a, b) => b.record.season.bestStreak - a.record.season.bestStreak)[0]);
  roster.awards = [...(roster.awards ?? []), ...awards];
  return awards;
}

/**
 * 名簿の棋士たちの1年を進める(竜王戦の結果のあと、年を取る前に呼ぶ)。成績・順位戦・タイトル戦・昇段・将棋大賞。
 * @param {object} roster 書き換える名簿
 * @param {object} season 終わった竜王戦の期
 * @param {{ next(): number }} rng
 */
export function playLeagueYear(roster, season, rng) {
  resetSeasonRecords(roster);
  const isMember = (id) => Boolean(roster.players[id]);
  // 竜王戦の対局と、ほかの対局を混ぜた順に記録する(連勝の数え方のため)。
  const fixed = ryuoSeasonGames(season, isMember);
  // ほかの対局の数は、1年の対局数の目安から、竜王戦の対局を引いた分にする。
  for (const { winner, loser } of fixed) {
    for (const id of [winner, loser]) if (isMember(id)) roster.players[id].record.season.games += 1;
  }
  const random = otherGames(roster, rng).map((pair) => ({ pair }));
  resetSeasonRecords(roster);
  for (const entry of shuffle(rng, [...fixed, ...random])) {
    if (entry.pair) {
      const [a, b] = entry.pair;
      playGame(rng, a, b);
    } else {
      // 竜王戦の対局は、表と番勝負に残した内訳(先手・戦法・勝ち方)で数える。
      const detail = (id) => ({
        color: entry.game?.black ? (entry.game.black === id ? 'black' : 'white') : null,
        opening: entry.game?.openings?.[id] ?? null,
        how: entry.game?.how ?? null,
      });
      if (isMember(entry.winner)) addResult(roster.players[entry.winner], true, detail(entry.winner));
      if (isMember(entry.loser)) addResult(roster.players[entry.loser], false, detail(entry.loser));
    }
  }
  // 順位戦の世界(roster.junni)がある名簿では、順位戦と名人は名人戦の期でだけ進める(junni-world.mjs。docs/player-world-note-design.md)。
  const meijinChallenger = roster.junni ? null : playJunni(roster, rng);
  // タイトル戦も、ほかの対局と同じくレーティングの差どおりの勝率で決める(docs/rating-realism-design.md)。
  const ratingOf = (member) => member.rating;
  const titleResults = playOtherTitles(roster, rng, { no: season.no, meijinChallenger, ratingOf, skipMeijin: Boolean(roster.junni) });
  for (const member of pros(roster)) {
    applyDanRules(member);
    applyWinsRule(member);
  }
  const awards = chooseAwards(roster, { no: season.no, titleResults });
  return { titleResults, awards };
}

/** 引退・新四段のあとに、順位戦の定員をそろえ、新四段をC級2組に入れる。順位戦の世界がある名簿では、世界のほうをそろえる。 */
export function settleLeague(roster) {
  if (roster.junni) {
    for (const member of pros(roster)) ensureLeagueFields(member);
    syncJunni(roster);
    for (const member of pros(roster)) applyDanRules(member);
    return;
  }
  for (const member of pros(roster)) {
    ensureLeagueFields(member);
    member.junni ??= 'C2';
  }
  rebalanceJunni(roster);
  for (const member of pros(roster)) applyDanRules(member);
}

// ---- 最初の名簿の履歴

/** years年前の強さ。年齢による伸びと衰え(ageDrift)を、さかのぼって引く。 */
function pastRating(member, years, ageDrift) {
  let rating = member.rating;
  for (let back = 0; back < years; back += 1) rating -= ageDrift(member.age - back);
  return rating;
}

/**
 * 最初の名簿に、過去の履歴を作る。過去HISTORY_YEARS年のタイトル戦を、そのころの強さで決め、獲得期数と、
 * 通算勝数(1年の対局数と勝率の見込み)を足す。竜王は、いまの竜王が最後のryuo期を連続で持っていたことにする。
 * 勝数規定の勝ち数は、前の昇段からの途中にある、とする。
 */
export function seedLeagueHistory(roster, rng, { ageDrift }) {
  for (const member of members(roster)) ensureLeagueFields(member);
  roster.titles = {};
  roster.titleHistory = [];
  roster.awards = roster.awards ?? [];
  const holder = roster.players[roster.holder] ?? null;
  for (let years = HISTORY_YEARS; years >= 1; years -= 1) {
    const no = 1 - years;
    const active = pros(roster).filter((member) => member.age - years >= 20);
    if (active.length < 8) continue;
    // そのころの強さ。年ごとに、いまの棋士全体と同じ平均・ばらつきに直し、その年の調子を足す。
    const raw = new Map(active.map((member) => [member.id, pastRating(member, years, ageDrift)]));
    const values = [...raw.values()];
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const sd = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length) || 1;
    const now = pros(roster).map(({ rating }) => rating);
    const nowMean = now.reduce((sum, value) => sum + value, 0) / now.length;
    const nowSd = Math.sqrt(now.reduce((sum, value) => sum + (value - nowMean) ** 2, 0) / now.length) || 1;
    const pastOf = new Map([...raw].map(([id, value]) => [id, nowMean + ((value - mean) / sd) * nowSd + gauss(rng) * FORM_SPREAD]));
    const ratingOf = (member) => pastOf.get(member.id) ?? member.rating;
    // 通算勝数。
    for (const member of active) {
      const games = gamesPerYear(ratingOf(member));
      const wins = Math.round(games * winProbability(ratingOf(member), PRO_MEAN_RATING));
      member.record.total.wins += wins;
      member.record.total.losses += games - wins;
    }
    for (const title of TITLES) {
      if (title.id === 'ryuo') {
        if (holder && years <= holder.ryuo) {
          roster.titleHistory.push({ no, title: 'ryuo', holder: holder.id, name: holder.name, changed: false });
          continue;
        }
      }
      const current = roster.players[roster.titles[title.id]];
      const sitting = current && active.includes(current) ? current : [...active].sort((a, b) => ratingOf(b) - ratingOf(a))[0];
      const challenger = chooseChallenger(rng, active, sitting.id, ratingOf, false);
      let winner = sitting;
      if (challenger) {
        const wins = { holder: 0, challenger: 0 };
        while (wins.holder < title.need && wins.challenger < title.need) {
          wins[playGame(rng, sitting, challenger, { ratingOf, big: true, record: false }) ? 'holder' : 'challenger'] += 1;
        }
        winner = wins.holder >= title.need ? sitting : challenger;
      }
      roster.titles[title.id] = winner.id;
      if (title.id === 'ryuo') winner.ryuo += 1;
      else winner.titleCounts[title.id] = (winner.titleCounts[title.id] ?? 0) + 1;
      roster.titleHistory.push({ no, title: title.id, holder: winner.id, name: winner.name, changed: winner.id !== current?.id });
    }
  }
  // いまの竜王は名簿のholderで決まる。タイトルの一覧から竜王を外す。
  delete roster.titles.ryuo;
  if (holder) holder.ryuo = Math.max(holder.ryuo, 1);
  for (const member of pros(roster)) {
    member.record.sincePromotion = Math.floor(rng.next() * (WINS_TO_PROMOTE[member.dan] ?? 100));
    applyDanRules(member);
  }
}

// ---- 紹介

/** いま持っているタイトル(竜王を含む)の名前。 */
export function heldTitles(roster, id) {
  const titles = OTHER_TITLES.filter(({ id: titleId }) => roster.titles?.[titleId] === id).map(({ label }) => label);
  return roster.holder === id ? ['竜王', ...titles] : titles;
}

/** 紹介用の実績の要約。 */
export function careerSummary(roster, member) {
  const held = heldTitles(roster, member.id);
  const total = totalTitles(member);
  const counts = TITLES
    .map(({ id, label }) => [label, id === 'ryuo' ? member.ryuo ?? 0 : member.titleCounts?.[id] ?? 0])
    .filter(([, count]) => count > 0)
    .map(([label, count]) => `${label}${count}期`);
  const former = TITLES.filter(({ id, label }) => !held.includes(label) && (id === 'ryuo' ? member.ryuo : member.titleCounts?.[id])).map(({ label }) => `元${label}`);
  const season = member.record?.season;
  return {
    held,
    former,
    totalTitles: total,
    titleCounts: counts,
    junni: member.junni ? JUNNI_LABELS[member.junni] : null,
    season: season ? { wins: season.wins, losses: season.losses } : null,
    total: member.record ? { ...member.record.total } : null,
    awards: (member.awards ?? []).map(({ no, id }) => ({ no, label: awardLabel(id) })),
  };
}
