// 奨励会(docs/shoreikai-design.md)。入会試験に受かり、例会で級・段を上がり、三段リーグを抜けて四段(プロ棋士)になるまで。
// 奨励会員は、竜王戦の名簿とは別の架空の世界に持つ。画面・保存の仕組み・暦に依存しない(後で作る棋士モードからも呼ぶ)。
// 登場する人物はすべて架空で、実在の人物とは関係がない。
//
// 1つの挑戦(run)の流れ:
//   exam(入会試験: 一次は受験者同士、二次は奨励会員と) → reikai(例会: 1回に2局) → league(三段リーグ: 1期ずつ) → pro(四段)
//   入会試験に落ちたら failed(受け直せる)。年齢制限を選んだ人が届かなければ retired。

import { USER_ID } from './ryuo.mjs';
import { createRng, gauss, pick } from './ryuo-random.mjs';
import { newName } from './ryuo-names.mjs';
import { createRepertoire, pickGameStyle, repertoireText, styleEntry, PARTY_LABELS } from './ryuo-repertoire.mjs';
import { createCharacter } from './player-character.mjs';
import { tournamentLevel } from './ryuo-strength.mjs';
import { LADDER_VERSION, ladderLevelIndexFromV2 } from './level-ladder.mjs';
import { simulateMemberGame } from './ryuo-simulation.mjs';
import { HANANE, STORY_PEOPLE, storyCharacter } from './ryuo-story.mjs';

export { USER_ID };

export const SHOREIKAI_VERSION = 1;
export const SHOREIKAI_KEY = 'yacobihime:shogi-match:shoreikai:v1';

/** 段級。0が6級、8が三段、9が四段(プロ)。 */
export const RANKS = Object.freeze(['6級', '5級', '4級', '3級', '2級', '1級', '初段', '二段', '三段', '四段']);
export const SHODAN = 6;
export const SANDAN = 8;
export const PRO = 9;
/** 受験できる級(6級〜1級)。 */
export const EXAM_RANKS = Object.freeze([0, 1, 2, 3, 4, 5]);
/**
 * 段級ごとの強さの目安(竜王戦の名簿と同じ尺度。棋士の平均はR1555、6組の平均はR1450)。
 * 三段は6組の平均より少し上(竜王戦の特別枠の奨励会三段と同じ+40)。
 */
export const RANK_RATINGS = Object.freeze([1150, 1185, 1220, 1255, 1290, 1325, 1370, 1415, 1490]);
/** 入会試験の決まり(実物どおり。規模では変えない)。一次は4勝で通過・3敗で不合格、二次は3局のうち1勝で合格。 */
export const EXAM_RULES = Object.freeze({ firstPass: 4, firstFail: 3, secondGames: 3, secondPass: 1 });
/** 例会1回の局数。 */
export const GAMES_PER_DAY = 2;
/** 三段リーグの1期の長さ(か月)。 */
export const MONTHS_PER_TERM = 6;
/** 棋士番号の、この世界の始まりの番号(四段になった順に1つずつ増える)。 */
export const KISHI_NUMBER_BASE = 340;
/** 受験級ごとの入会の年齢(低い級ほど若い)。 */
export const ENTRY_AGE = Object.freeze([12, 12, 13, 13, 14, 14]);
/** 年齢制限(選んだ人だけ)。21歳までに初段、26歳のリーグの終わりまでに四段。最後のリーグで勝ち越せば延長。 */
export const AGE_LIMIT = Object.freeze({ shodan: 21, pro: 26 });
/** 三段の降段点: 勝率がこの割合以下。 */
export const SANDAN_DEMOTE_RATE = 0.25;
/** 観戦の記録(世界の出来事)を残す数。 */
const FEED_LIMIT = 24;
/** 例会で、同じ相手と続けて当たらないために覚えておく数。 */
const RECENT_OPPONENTS = 4;

/**
 * 規模(docs/shoreikai-design.mdの2章)。kyuは6級〜2級からの昇級、danは1級〜二段からの昇段。
 * streakは連勝、marksは[勝ち, 負けの上限]。slumpは降級点([勝ちの上限, 負け])、clearは降級点を消す成績。
 */
export const SHOREIKAI_SCALES = Object.freeze([
  Object.freeze({
    id: 'mini', label: 'みじかい', note: '勝率7割で約60局',
    kyu: { streak: 3, marks: [[4, 1], [5, 2]] },
    dan: { streak: 4, marks: [[6, 2], [7, 3]] },
    slump: { wins: 1, losses: 4 }, clear: { wins: 2, losses: 2 },
    league: { size: 8, rounds: 6, promote: 1 }, perRank: 7,
  }),
  Object.freeze({
    id: 'short', label: '短め', note: '勝率7割で約80局',
    kyu: { streak: 4, marks: [[6, 2], [8, 3]] },
    dan: { streak: 5, marks: [[8, 3], [10, 4]] },
    slump: { wins: 2, losses: 6 }, clear: { wins: 3, losses: 3 },
    league: { size: 16, rounds: 10, promote: 2 }, perRank: 8,
  }),
  Object.freeze({
    id: 'real', label: '実物どおり', note: '勝率7割で約150局',
    kyu: { streak: 6, marks: [[9, 3], [11, 4], [13, 5], [15, 6]] },
    dan: { streak: 8, marks: [[12, 4], [14, 5], [16, 6], [18, 7]] },
    slump: { wins: 2, losses: 8 }, clear: { wins: 3, losses: 3 },
    league: { size: 30, rounds: 18, promote: 2 }, perRank: 10,
  }),
]);
export const DEFAULT_SCALE = 'mini';
export const shoreikaiScale = (id) => SHOREIKAI_SCALES.find((scale) => scale.id === id) ?? SHOREIKAI_SCALES[0];

export const DEFAULT_SETTINGS = Object.freeze({
  difficulty: 9,
  scale: DEFAULT_SCALE,
  ageLimit: false,
  coachLevel: 'detailed',
  hintLimit: 3,
  undoLimit: 3,
  byoyomi: 0,
});

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
export const rankLabel = (rank) => RANKS[rank] ?? '';

// ---- 昇級・昇段・降級点の規定

/** その段級から上がるときの規定(6級〜2級は昇級、1級〜二段は昇段。1級から初段も昇段の規定)。 */
export function promotionRule(scale, rank) {
  return rank <= 4 ? scale.kyu : scale.dan;
}
/** 上がるときの言葉。 */
export const promotionWord = (rank) => (rank <= 4 ? '昇級' : '昇段');

export const emptyRecord = () => ({ wins: 0, losses: 0, streak: 0 });
const emptySlump = () => ({ wins: 0, losses: 0 });

/**
 * 1局の結果を、前の昇級からの成績に足す。負けが規定の上限を越えたら、数え直す(実物の起点の決まりを簡単にしたもの)。
 * @param {{ streak: number, marks: number[][] }} rule
 * @param {{ wins: number, losses: number, streak: number }} record
 * @param {boolean} win
 */
export function addToRecord(rule, record, win) {
  const next = { wins: record.wins + (win ? 1 : 0), losses: record.losses + (win ? 0 : 1), streak: win ? record.streak + 1 : 0 };
  const maxLosses = Math.max(...rule.marks.map(([, losses]) => losses));
  return next.losses > maxLosses ? emptyRecord() : next;
}

/**
 * 昇級・昇段に届いたか。届いたら、届いた規定の言葉(「3連勝」「4勝1敗」)。
 * @param {{ streak: number, marks: number[][] }} rule
 * @param {{ wins: number, losses: number, streak: number }} record
 */
export function promotionReached(rule, record) {
  if (record.streak >= rule.streak) return `${rule.streak}連勝`;
  const mark = rule.marks.find(([wins, losses]) => record.wins >= wins && record.losses <= losses);
  return mark ? `${mark[0]}勝${mark[1]}敗` : null;
}

/**
 * 昇級・昇段までの残り(いちばん近い規定と、連勝の道)。
 * @param {{ streak: number, marks: number[][] }} rule
 * @param {{ wins: number, losses: number, streak: number }} record
 */
export function promotionProgress(rule, record) {
  const marks = rule.marks
    .filter(([, losses]) => record.losses <= losses)
    .map(([wins, losses]) => ({ mark: `${wins}勝${losses}敗`, markWins: wins, markLosses: losses, winsLeft: Math.max(0, wins - record.wins), lossesLeft: losses - record.losses }))
    .sort((a, b) => a.winsLeft - b.winsLeft);
  const best = marks[0] ?? null;
  const streakLeft = Math.max(0, rule.streak - record.streak);
  return {
    record: `${record.wins}勝${record.losses}敗`,
    wins: record.wins,
    losses: record.losses,
    streak: record.streak,
    streakLeft,
    streakGoal: rule.streak,
    mark: best?.mark ?? null,
    markWins: best?.markWins ?? 0,
    markLosses: best?.markLosses ?? 0,
    winsLeft: best ? Math.min(best.winsLeft, streakLeft) : streakLeft,
    lossesLeft: best?.lossesLeft ?? 0,
  };
}

/**
 * 降級点の数え。降級点がないときは、負けが込むと降級点(point)。降級点があるときは、勝てば消え(clear)、また負けが込むと降級(demote)。
 * 勝ちが上限を越えたら数え直す(調子が戻った)。
 * @param {{ slump: { wins: number, losses: number }, clear: { wins: number, losses: number } }} scale
 * @param {{ wins: number, losses: number }} slump
 * @param {boolean} win
 * @param {boolean} hasPoint 降級点があるか
 * @returns {{ slump: { wins: number, losses: number }, event: null | 'point' | 'clear' | 'demote' }}
 */
export function addToSlump(scale, slump, win, hasPoint) {
  const next = { wins: slump.wins + (win ? 1 : 0), losses: slump.losses + (win ? 0 : 1) };
  if (hasPoint && next.wins >= scale.clear.wins && next.losses <= scale.clear.losses) return { slump: emptySlump(), event: 'clear' };
  if (next.losses >= scale.slump.losses && next.wins <= scale.slump.wins) return { slump: emptySlump(), event: hasPoint ? 'demote' : 'point' };
  if (next.wins > scale.slump.wins && (!hasPoint || next.losses > scale.clear.losses)) return { slump: emptySlump(), event: null };
  return { slump: next, event: null };
}

/**
 * 降級点の1つ手前か(やこび姫の予告。次の1敗で降級点・降級になる)。
 * @param {{ slump: { wins: number, losses: number }, clear: { wins: number, losses: number } }} scale
 * @param {{ wins: number, losses: number }} slump
 */
export function slumpWarning(scale, slump) {
  return slump.wins <= scale.slump.wins && slump.losses === scale.slump.losses - 1;
}

/** 三段の降段点の勝ち数(この勝ち数以下で降段点)。 */
export const sandanDemoteWins = (rounds) => Math.floor(rounds * SANDAN_DEMOTE_RATE);

// ---- 奨励会の世界(奨励会員の名簿)

/**
 * 奨励会員を1人作る。強さは段級の目安に、才能(talent)を足したもの。棋風・特殊能力・得意戦法は、竜王戦の棋士と同じ作り方。
 * @param {any} world
 * @param {{ next(): number }} rng
 * @param {Set<string>} used
 * @param {{ rank: number, age: number, talent?: number, kind?: string }} options
 */
function createMember(world, rng, used, { rank, age, talent = gauss(rng) * 35, kind = 'shoreikai' }) {
  const id = `${kind === 'examinee' ? 'e' : 's'}${world.nextId}`;
  world.nextId += 1;
  // 強さはいまの段級の目安のまわり。才能は、これからの伸び(1か月の伸び)に効く。
  const rating = Math.round(RANK_RATINGS[Math.min(rank, SANDAN)] + gauss(rng) * 18 + (kind === 'examinee' ? -30 : 0));
  const repertoire = createRepertoire(rng, 6);
  const style = styleEntry(repertoire.styles[0]);
  const member = {
    id,
    name: newName(rng, used, { women: rng.next() < 0.12, age }),
    kind,
    rank,
    dan: kind === 'examinee' ? '受験者' : rankLabel(rank),
    rating,
    talent: Math.round(talent),
    age: Math.round(age * 12) / 12,
    joined: world.month,
    record: emptyRecord(),
    slump: emptySlump(),
    point: false,
    sandan: { jiten: 0, points: 0, terms: 0 },
    repertoire,
    style,
    character: createCharacter(rng, { rating, age, style }),
  };
  used.add(member.name);
  return member;
}

/** その段級の、ふつうの年齢。 */
function rankAge(rng, rank) {
  const base = [12.5, 13.2, 13.8, 14.4, 15, 15.6, 16.6, 17.6, 20][Math.min(rank, SANDAN)];
  return clamp(base + gauss(rng) * (rank >= SANDAN ? 2 : 1.2), 10, 25.5);
}

/** 天鷺羽音(三段リーグの三段。最初の三段リーグで四段になる。竜王戦の名簿の「新四段の羽音」につながる)。 */
function hananeMember(world) {
  const person = STORY_PEOPLE[HANANE];
  const id = `s${world.nextId}`;
  world.nextId += 1;
  return {
    id,
    story: HANANE,
    name: person.name,
    kind: 'shoreikai',
    rank: SANDAN,
    dan: rankLabel(SANDAN),
    // 三段リーグをすぐ抜ける強さ(竜王戦の名簿の羽音と同じくらい)。
    rating: RANK_RATINGS[SANDAN] + 170,
    talent: 170,
    age: person.age,
    joined: -60,
    record: emptyRecord(),
    slump: emptySlump(),
    point: false,
    sandan: { jiten: 0, points: 0, terms: 1 },
    repertoire: structuredClone(person.repertoire),
    style: styleEntry(person.repertoire.styles[0]),
    character: storyCharacter(HANANE),
  };
}

/**
 * 奨励会の世界を作る。段級ごとに規模の人数、三段は三段リーグの定員。羽音は三段。
 * いまの三段リーグは2か月後に終わる(入会してすぐ、羽音の四段昇段を見られる)。
 */
export function createWorld(rng, scale) {
  const world = { nextId: 1, month: 0, termNo: 1, termEndsAt: 2, members: {}, sandanOrder: [], nextSandan: [], proCount: 0, feed: [] };
  const used = new Set();
  for (let rank = 0; rank < SANDAN; rank += 1) {
    for (let index = 0; index < scale.perRank; index += 1) {
      const member = createMember(world, rng, used, { rank, age: rankAge(rng, rank) });
      world.members[member.id] = member;
    }
  }
  const hanane = hananeMember(world);
  world.members[hanane.id] = hanane;
  used.add(hanane.name);
  world.sandanOrder.push(hanane.id);
  for (let index = 1; index < scale.league.size; index += 1) {
    const member = createMember(world, rng, used, { rank: SANDAN, age: rankAge(rng, SANDAN) });
    world.members[member.id] = member;
    world.sandanOrder.push(member.id);
  }
  // 前期の順位(羽音は上のほう)。
  world.sandanOrder.sort((a, b) => world.members[b].rating - world.members[a].rating);
  return world;
}

const usedNames = (world) => new Set(Object.values(world.members).map(({ name }) => name));
const membersOf = (world) => Object.values(world.members);

function addFeed(world, text, tone = 'plain') {
  world.feed = [{ month: Math.floor(world.month), text, tone }, ...(world.feed ?? [])].slice(0, FEED_LIMIT);
}

/** 1か月の伸び(才能で決まる。伸び悩む人もいる)。 */
export const monthlyGrowth = (talent) => clamp(2.6 + talent / 18, -0.5, 6.5);
/** 三段の人数の上限の目安(三段リーグの定員の1.25倍)。越えているあいだは、二段の人は三段に上がらない。 */
const sandanCap = (scale) => Math.ceil(scale.league.size * 1.25);
/** ほかの奨励会員が、1か月のうちに上がる確率(強さが次の段級の目安を越えているとき)。 */
const NPC_PROMOTE_CHANCE = 0.35;
/** 強さが段級の目安を大きく下回ったときに、1か月のうちに下がる確率。 */
const NPC_DEMOTE_CHANCE = 0.12;
/** 1か月のうちに、ほかの奨励会員が奨励会をやめる確率(学業・進路など)。 */
const NPC_QUIT_CHANCE = 0.005;
/** 入会の頻度(か月)。実物は年1回だが、低い級が空にならないよう年2回にする。 */
const ENTRY_EVERY_MONTHS = 6;

/** 2人の奨励会員の1局(自動)。aが勝てば真。 */
function memberGame(rng, a, b) {
  return simulateMemberGame(rng, a, b).aWins;
}

/**
 * 1か月分の、ほかの奨励会員どうしの例会(三段は三段リーグなので除く)。段級の近い人どうしで2局ずつ指す。
 * ほかの奨励会員の昇級は、ここの勝ち負けではなく強さの伸びで決める(ageMonth)。結果は速報に使う。
 * busyは、この例会でプレイヤーと当たる人(プレイヤーとの1局のぶん、1局少なく指す)。
 * @returns {{ a: string, b: string, winner: string }[]}
 */
function playMonth(world, rng, busy = []) {
  const games = [];
  const pool = membersOf(world).filter((member) => member.kind === 'shoreikai' && member.rank < SANDAN);
  for (let round = 0; round < GAMES_PER_DAY; round += 1) {
    const players = pool.filter((member) => !(round === 0 && busy.includes(member.id)));
    // 段級と乱数で並べ、隣どうしで当てる(段級の差は1つまでになることが多い)。
    const order = players.map((member) => ({ member, key: member.rank + rng.next() * 1.6 })).sort((a, b) => a.key - b.key).map(({ member }) => member);
    for (let index = 0; index + 1 < order.length; index += 2) {
      const a = order[index];
      const b = order[index + 1];
      games.push({ a: a.id, b: b.id, winner: memberGame(rng, a, b) ? a.id : b.id });
    }
  }
  return games;
}

/** ほかの奨励会員の1か月(伸び・昇級・降級・退会)。 */
function memberMonth(world, scale, rng, member) {
  member.age += 1 / 12;
  if (!member.story) member.rating += monthlyGrowth(member.talent);
  if (member.rank >= SANDAN) return;
  const next = RANK_RATINGS[member.rank + 1];
  const sandanCount = membersOf(world).filter((other) => other.kind === 'shoreikai' && other.rank === SANDAN).length;
  const blocked = member.rank + 1 === SANDAN && sandanCount >= sandanCap(scale);
  if (member.rating >= next - 8 && !blocked && rng.next() < NPC_PROMOTE_CHANCE) {
    member.rank += 1;
    member.dan = rankLabel(member.rank);
    if (member.rank === SANDAN) world.nextSandan.push(member.id);
    if (member.peer) addFeed(world, `同期の${member.name}さんが${member.dan}に${member.rank >= SHODAN ? '昇段' : '昇級'}`, 'peer');
    else if (member.rank === SANDAN) addFeed(world, `${member.name}さんが三段に昇段。次の三段リーグへ`, 'plain');
  } else if (member.rank > 0 && member.rating < RANK_RATINGS[member.rank] - 70 && rng.next() < NPC_DEMOTE_CHANCE) {
    member.rank -= 1;
    member.dan = rankLabel(member.rank);
  }
}

/** 時間が進む。ほかの奨励会員が伸び、上がり、年齢制限(21歳で初段)と進路でやめ、半年ごとに入会がある。 */
function ageMonth(world, scale, rng, months = 1) {
  const before = Math.floor(world.month);
  world.month += months;
  const after = Math.floor(world.month);
  for (let month = before + 1; month <= after; month += 1) {
    for (const member of membersOf(world)) {
      if (member.kind !== 'shoreikai') continue;
      memberMonth(world, scale, rng, member);
      const quit = !member.story && member.rank < SANDAN && rng.next() < NPC_QUIT_CHANCE;
      if ((member.rank < SHODAN && member.age >= AGE_LIMIT.shodan) || quit) {
        delete world.members[member.id];
        if (member.peer) addFeed(world, `同期の${member.name}さんが、奨励会を去った`, 'peer');
      }
    }
    if (month % ENTRY_EVERY_MONTHS !== 0) continue;
    const used = usedNames(world);
    const target = scale.perRank * SANDAN;
    const current = membersOf(world).filter((member) => member.kind === 'shoreikai' && member.rank < SANDAN).length;
    const count = Math.max(2, target - current);
    for (let index = 0; index < count; index += 1) {
      // 6級・5級を多めに。
      const roll = rng.next();
      const rank = roll < 0.4 ? 0 : roll < 0.7 ? 1 : roll < 0.9 ? 2 : 3;
      const member = createMember(world, rng, used, { rank, age: rankAge(rng, rank) - 0.5 });
      world.members[member.id] = member;
    }
    addFeed(world, `新しく${count}名が入会`, 'plain');
  }
}

// ---- 三段リーグ(組み合わせ・順位・四段・次点・降段点)

function shuffle(rng, list) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(rng.next() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

/**
 * 三段リーグの組み合わせ。毎回の回戦で、まだ当たっていない人どうしを当てる(18局なら全員とは当たらない)。
 * 人数が奇数なら、プレイヤー以外の1人が休み。
 * @returns {string[][][]} 回戦ごとの[先, 後]の組
 */
export function leagueSchedule(rng, ids, rounds) {
  const played = new Set();
  const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  /** 1回戦の組を、乱数の並びから順に作る。重なり(前に当たった組)の数も返す。 */
  const tryRound = () => {
    const pool = shuffle(rng, ids);
    // 休みはプレイヤー以外。
    if (pool.length % 2 === 1) pool.splice(pool.findIndex((id) => id !== USER_ID), 1);
    // プレイヤーを先に組む(必ず指す)。
    const userIndex = pool.indexOf(USER_ID);
    if (userIndex > 0) pool.unshift(...pool.splice(userIndex, 1));
    const pairs = [];
    let repeats = 0;
    while (pool.length > 1) {
      const a = pool.shift();
      let index = pool.findIndex((b) => !played.has(key(a, b)));
      if (index < 0) {
        index = 0;
        repeats += 1;
      }
      const [b] = pool.splice(index, 1);
      pairs.push([a, b]);
    }
    return { pairs, repeats };
  };
  const schedule = [];
  for (let round = 0; round < rounds; round += 1) {
    // 重なりのない組み方が見つかるまで、何度か並べ直す(見つからなければ、重なりのいちばん少ないもの)。
    let best = tryRound();
    for (let attempt = 0; attempt < 40 && best.repeats > 0; attempt += 1) {
      const next = tryRound();
      if (next.repeats < best.repeats) best = next;
    }
    for (const [a, b] of best.pairs) played.add(key(a, b));
    schedule.push(best.pairs);
  }
  return schedule;
}

/**
 * 三段リーグの順位表。勝ち数の多い順、同じなら前期の順位(order)が上の人が上。
 * @param {{ order: string[], results: { a: string, b: string, winner: string }[][] }} league
 */
export function leagueStandings(league) {
  const rows = new Map(league.order.map((id, index) => [id, { id, wins: 0, losses: 0, seed: index + 1, results: [] }]));
  for (const round of league.results) {
    for (const game of round) {
      for (const id of [game.a, game.b]) {
        const row = rows.get(id);
        if (!row) continue;
        const win = game.winner === id;
        row.wins += win ? 1 : 0;
        row.losses += win ? 0 : 1;
        row.results.push(win ? 'win' : 'loss');
      }
    }
  }
  return [...rows.values()].sort((a, b) => b.wins - a.wins || a.seed - b.seed).map((row, index) => ({ ...row, place: index + 1 }));
}

/**
 * 三段リーグの見通し(名人戦の順位戦と同じ考え方を簡単にしたもの)。残りの局を全部勝ったときに四段の枠に入れるか。
 * clinched: 残りを全部負けても枠に入る。self: 全部勝てば、ほかの結果に関係なく入る。others: 全部勝っても、ほかの結果しだい。out: 届かない。
 * @param {ReturnType<typeof leagueStandings>} rows
 * @param {string} id
 * @param {number} rounds
 * @param {number} promote
 */
export function leagueOutlook(rows, id, rounds, promote) {
  const me = rows.find((row) => row.id === id);
  if (!me) return 'out';
  const left = (row) => rounds - row.wins - row.losses;
  // 最後に、otherの勝ち数がmineより上になるか(同じなら前期の順位が上の人が上)。
  const beats = (other, otherWins, mine) => otherWins > mine || (otherWins === mine && other.seed < me.seed);
  const others = rows.filter((row) => row.id !== id);
  const best = me.wins + left(me);
  const worst = me.wins;
  // 全部負けても、自分を抜ける人が枠の数より少ない。
  if (others.filter((row) => beats(row, row.wins + left(row), worst)).length < promote) return 'clinched';
  // 全部勝てば、自分を抜ける人が枠の数より少ない。
  if (others.filter((row) => beats(row, row.wins + left(row), best)).length < promote) return 'self';
  // 全部勝っても、もう自分より上と決まっている人が枠の数以上。
  if (others.filter((row) => beats(row, row.wins, best)).length >= promote) return 'out';
  return 'others';
}

/** 三段リーグの1期を始める(参加者・組み合わせ・結果の入れ物)。 */
function newLeague(world, scale, rng, withUser) {
  const ids = [
    ...world.sandanOrder.filter((id) => (id === USER_ID ? withUser : world.members[id])),
    ...world.nextSandan.filter((id) => world.members[id] && !world.sandanOrder.includes(id)),
  ];
  world.nextSandan = [];
  // 三段が定員より少なければ、三段編入の人で補う(定員の目安。プレイヤーを含めて偶数にし、休みの回戦を出さない)。
  const used = usedNames(world);
  const total = () => ids.length + (withUser && !ids.includes(USER_ID) ? 1 : 0);
  while (ids.filter((id) => id !== USER_ID).length < scale.league.size - (withUser ? 1 : 0) || total() % 2 === 1) {
    const member = createMember(world, rng, used, { rank: SANDAN, age: rankAge(rng, SANDAN) });
    world.members[member.id] = member;
    ids.push(member.id);
  }
  // 新しく三段になったプレイヤーは、いちばん下の順位から。
  const order = withUser && !ids.includes(USER_ID) ? [...ids, USER_ID] : ids;
  return {
    term: world.termNo,
    rounds: scale.league.rounds,
    promote: scale.league.promote,
    order,
    schedule: leagueSchedule(rng, order, scale.league.rounds),
    results: [],
    round: 0,
  };
}

/** 三段リーグの1回戦の、プレイヤー以外の対局を自動で指す。 */
function playLeagueRound(world, rng, league, round) {
  const games = [];
  for (const [a, b] of league.schedule[round]) {
    if (a === USER_ID || b === USER_ID) continue;
    const ma = world.members[a];
    const mb = world.members[b];
    if (!ma || !mb) continue;
    const aWins = memberGame(rng, ma, mb);
    games.push({ a, b, winner: aWins ? a : b });
  }
  return games;
}

/**
 * 三段リーグの1期を締める。上位が四段、次の順位が次点(2回で四段)、勝率2割5分以下は降段点(2期続けて二段へ)。
 * 26歳の期で勝ち越せなかった人は退会。羽音は最初の期で必ず四段になる(物語)。次の期の順位(order)を決める。
 * @returns {{ rows: ReturnType<typeof leagueStandings>, promoted: string[], jiten: string | null, retired: string[] }}
 */
function closeLeague(world, league) {
  let rows = leagueStandings(league);
  const promote = league.promote;
  // 羽音は最初の三段リーグで四段になる(竜王戦の名簿の新四段の羽音につながる)。
  const hananeRow = rows.find((row) => world.members[row.id]?.story === HANANE);
  if (hananeRow && hananeRow.place > promote) {
    rows = [hananeRow, ...rows.filter((row) => row !== hananeRow)].map((row, index) => ({ ...row, place: index + 1 }));
  }
  const promoted = rows.slice(0, promote).map((row) => row.id);
  const jitenRow = rows[promote] ?? null;
  const retired = [];
  const demoteWins = sandanDemoteWins(league.rounds);
  for (const row of rows) {
    if (row.id === USER_ID) continue;
    const member = world.members[row.id];
    if (!member) continue;
    member.sandan.terms += 1;
    if (promoted.includes(row.id)) continue;
    if (jitenRow?.id === row.id) {
      member.sandan.jiten += 1;
      if (member.sandan.jiten >= 2) promoted.push(row.id);
    }
    if (row.wins <= demoteWins) member.sandan.points += 1;
    else member.sandan.points = 0;
    if (member.age >= AGE_LIMIT.pro && row.wins * 2 <= league.rounds && !promoted.includes(row.id)) retired.push(row.id);
  }
  // 次の期の順位: 残った人を、この期の成績順に(プレイヤーも)。四段になった人と退会した人は外す。
  world.sandanOrder = rows.filter((row) => !promoted.includes(row.id) && !retired.includes(row.id)).map((row) => row.id);
  for (const id of promoted) {
    if (id === USER_ID) continue;
    const member = world.members[id];
    world.proCount += 1;
    addFeed(world, member.story === HANANE
      ? `天鷺羽音さん、第${league.term}期三段リーグを1位で抜けて四段昇段`
      : `${member.name}さん、${member.sandan.jiten >= 2 && jitenRow?.id === id ? '次点2回で' : ''}四段昇段`, member.story === HANANE ? 'rival' : 'pro');
    delete world.members[id];
  }
  for (const id of retired) {
    addFeed(world, `${world.members[id].name}さんが、年齢制限で奨励会を去った`, 'plain');
    delete world.members[id];
  }
  // 降段点を2期続けた人は二段へ。
  for (const id of [...world.sandanOrder]) {
    const member = world.members[id];
    if (member && member.sandan.points >= 2) {
      member.rank = SANDAN - 1;
      member.dan = rankLabel(member.rank);
      member.sandan.points = 0;
      member.record = emptyRecord();
      world.sandanOrder = world.sandanOrder.filter((other) => other !== id);
    }
  }
  world.termNo += 1;
  return { rows, promoted, jiten: jitenRow?.id ?? null, retired };
}

/** プレイヤーのいない三段リーグの1期を、まとめて自動で指して締める。 */
function playNpcTerm(world, scale, rng) {
  const league = newLeague(world, scale, rng, false);
  for (let round = 0; round < league.rounds; round += 1) league.results.push(playLeagueRound(world, rng, league, round));
  closeLeague(world, league);
  world.termEndsAt = Math.floor(world.month) + MONTHS_PER_TERM;
}

// ---- 1つの挑戦(run)

const players = (run) => ({ ...run.world.members, ...(run.exam?.examinees ?? {}) });
/** 対局画面などが使う、相手の棋士の表(奨励会員と受験者)。保存のあとに付け直す。 */
function link(run) {
  run.players = players(run);
  return run;
}

/**
 * 推薦してくれる師匠の候補(竜王戦の名簿の、年長の棋士から3人。居飛車党・振り飛車党・両方から1人ずつを優先)。
 * @param {any} roster
 * @param {number} seed
 */
export function mentorCandidates(roster, seed = 1) {
  const rng = createRng((seed ^ 0x51ed270b) >>> 0);
  const pros = Object.values(roster?.players ?? {}).filter((member) => member.kind === 'pro' && !member.story && (member.age ?? 0) >= 40);
  const veterans = pros.length >= 3 ? pros : Object.values(roster?.players ?? {}).filter((member) => member.kind === 'pro' && !member.story);
  const picked = [];
  for (const party of ['static', 'ranging', 'both']) {
    const pool = veterans.filter((member) => member.repertoire?.party === party && !picked.includes(member));
    if (pool.length) picked.push(pick(rng, pool));
  }
  while (picked.length < 3 && picked.length < veterans.length) {
    const rest = veterans.filter((member) => !picked.includes(member));
    picked.push(pick(rng, rest));
  }
  return picked.map((member) => ({
    id: member.id,
    name: member.name,
    dan: member.dan,
    age: member.age,
    party: member.repertoire?.party ?? 'static',
    partyLabel: PARTY_LABELS[member.repertoire?.party ?? 'static'],
    styleLabel: member.style?.label ?? '',
    repertoire: repertoireText(member.repertoire),
  }));
}

/**
 * 棋力(Lv)からのおすすめの受験級。強いほど上の級から受ける(近道。ただし試験の相手も強い)。
 * @param {number} userLevel
 */
export function recommendedExamRank(userLevel) {
  const level = Number.isFinite(userLevel) ? userLevel : 0;
  // 今の表(50段階)のLv。アマ五段なら1級、アマ四段なら2級、アマ三段なら3級、アマ初段なら4級、6級なら5級から。
  if (level >= 39) return 5;
  if (level >= 35) return 4;
  if (level >= 31) return 3;
  if (level >= 25) return 2;
  if (level >= 19) return 1;
  return 0;
}

/** 入会試験の受験者(6人)。 */
function makeExaminees(world, rng, rank) {
  const used = usedNames(world);
  const examinees = {};
  for (let index = 0; index < EXAM_RULES.firstPass + EXAM_RULES.firstFail - 1; index += 1) {
    const member = createMember(world, rng, used, { rank, age: clamp(ENTRY_AGE[rank] + gauss(rng) * 1.2, 10, 18), kind: 'examinee' });
    examinees[member.id] = member;
  }
  return examinees;
}

/** 二次試験の相手(受験級の1〜2つ上の奨励会員。三段は出ない)。 */
function examSecondOpponents(world, rng, rank) {
  const pool = membersOf(world).filter((member) => member.kind === 'shoreikai' && member.rank > rank && member.rank <= Math.min(rank + 2, SANDAN - 1));
  const picked = [];
  while (picked.length < EXAM_RULES.secondGames && pool.length) picked.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0].id);
  return picked;
}

/** プレイヤーの1局の相手を決め、Lvと戦法と先後を付ける。 */
function setPending(run, rng, { opponentId, kind, label, eventText, stakes, others = [], userLevel }) {
  const all = players(run);
  const opponent = all[opponentId];
  opponent.level = tournamentLevel(opponent.rating, run.settings.difficulty, Number.isFinite(userLevel) ? userLevel : 20);
  const color = rng.next() < 0.5 ? 'black' : 'white';
  const style = opponent.repertoire
    ? pickGameStyle(rng, opponent.repertoire, { color: color === 'black' ? 'white' : 'black' })
    : opponent.style ?? null;
  run.pending = { kind, opponentId, color, style, label, eventText, stakes, others: { games: others } };
}

function startExamPending(run, rng, userLevel) {
  const exam = run.exam;
  if (exam.stage === 1) {
    const ids = Object.keys(exam.examinees);
    const opponentId = ids[exam.results.length % ids.length];
    const wins = exam.wins;
    const losses = exam.losses;
    setPending(run, rng, {
      opponentId, kind: 'exam1', userLevel,
      label: `入会試験 一次 ${exam.results.length + 1}局目`,
      eventText: `奨励会 入会試験（${rankLabel(exam.rank)}受験）`,
      stakes: {
        text: `一次試験 ${wins}勝${losses}敗（4勝で通過・3敗で不合格）`,
        win: wins + 1 >= EXAM_RULES.firstPass ? '一次試験通過' : '',
        goal: `一次試験通過まであと${EXAM_RULES.firstPass - wins}勝`,
        boss: wins + 1 >= EXAM_RULES.firstPass || losses + 1 >= EXAM_RULES.firstFail,
      },
    });
  } else {
    const index = exam.secondResults.length;
    setPending(run, rng, {
      opponentId: exam.second[index], kind: 'exam2', userLevel,
      label: `入会試験 二次 ${index + 1}局目`,
      eventText: `奨励会 入会試験（${rankLabel(exam.rank)}受験）`,
      stakes: { text: `二次試験 ${index + 1}局目（奨励会員に1勝で合格）`, win: '合格', goal: '勝てば合格', boss: true },
    });
  }
}

/**
 * 例会の相手を2人決める。同じ段級に同期がいれば優先して当てる(同期対決)。段級は1つ上下まで。最近の相手は避ける。
 */
function pickReikaiOpponents(run, rng) {
  const world = run.world;
  const recent = run.recent ?? [];
  const regular = membersOf(world).filter((member) => member.kind === 'shoreikai' && member.rank < SANDAN);
  // 段級は1つ上下まで。少なければ2つ、それでも少なければ全員から。
  let pool = regular.filter((member) => Math.abs(member.rank - run.rank) <= 1);
  if (pool.length < GAMES_PER_DAY) pool = regular.filter((member) => Math.abs(member.rank - run.rank) <= 2);
  if (pool.length < GAMES_PER_DAY) pool = regular;
  while (pool.length < GAMES_PER_DAY) {
    const member = createMember(world, rng, usedNames(world), { rank: Math.min(run.rank, SANDAN - 1), age: rankAge(rng, run.rank) });
    world.members[member.id] = member;
    pool.push(member);
  }
  const fresh = pool.filter((member) => !recent.includes(member.id));
  const candidates = fresh.length >= GAMES_PER_DAY ? fresh : pool;
  const picked = [];
  const peer = candidates.find((member) => member.peer && member.rank === run.rank && !recent.slice(0, 2).includes(member.id));
  if (peer && rng.next() < 0.6) picked.push(peer.id);
  while (picked.length < GAMES_PER_DAY && candidates.length) {
    const left = candidates.filter((member) => !picked.includes(member.id));
    if (!left.length) break;
    // 同じ段級を多めに。
    const weights = left.map((member) => (member.rank === run.rank ? 3 : 1));
    let roll = rng.next() * weights.reduce((sum, value) => sum + value, 0);
    let chosen = left[left.length - 1];
    for (let index = 0; index < left.length; index += 1) {
      roll -= weights[index];
      if (roll <= 0) { chosen = left[index]; break; }
    }
    picked.push(chosen.id);
  }
  return picked;
}

/** 例会の賭けているもの(「あと2勝で昇級」「勝てば昇級」)。 */
function reikaiStakes(run) {
  const scale = shoreikaiScale(run.settings.scale);
  const rule = promotionRule(scale, run.rank);
  const word = promotionWord(run.rank);
  const progress = promotionProgress(rule, run.record);
  const afterWin = promotionReached(rule, addToRecord(rule, run.record, true));
  const next = rankLabel(run.rank + 1);
  const warning = slumpWarning(scale, run.slump);
  return {
    text: `${rankLabel(run.rank)}・${progress.record}${progress.streak >= 2 ? `・${progress.streak}連勝中` : ''}`,
    win: afterWin ? (run.rank + 1 === SANDAN ? '三段リーグ入り' : `${next}に${word}`) : '',
    goal: afterWin ? '' : `${word}まであと${progress.winsLeft}勝`,
    boss: Boolean(afterWin) || warning,
    warning: warning ? (run.point ? 'あと1つ負けると降級' : 'あと1つ負けると降級点') : '',
  };
}

function startReikaiDay(run, rng, userLevel) {
  const scale = shoreikaiScale(run.settings.scale);
  const world = run.world;
  ageMonth(world, scale, rng, 1);
  run.age += 1;
  // ほかの三段の三段リーグが終わる月(羽音の四段昇段など)。
  if (world.month >= world.termEndsAt) playNpcTerm(world, scale, rng);
  const opponents = pickReikaiOpponents(run, rng);
  const others = playMonth(world, rng, opponents);
  run.dayNo += 1;
  run.day = { no: run.dayNo, opponents, results: [], others };
  setReikaiPending(run, rng, userLevel);
}

function setReikaiPending(run, rng, userLevel) {
  const day = run.day;
  const index = day.results.length;
  const opponentId = day.opponents[index] ?? day.opponents[0];
  setPending(run, rng, {
    opponentId, kind: 'reikai', userLevel,
    label: `第${day.no}回例会 ${index + 1}局目`,
    eventText: `奨励会 ${rankLabel(run.rank)}`,
    stakes: reikaiStakes(run),
    others: index === 0 ? day.others : [],
  });
}

/** 三段リーグの賭けているもの。 */
function leagueStakes(run) {
  const league = run.league;
  const rows = leagueStandings(league);
  const me = rows.find((row) => row.id === USER_ID);
  const last = league.round === league.rounds - 1;
  const outlook = leagueOutlook(rows, USER_ID, league.rounds, league.promote);
  const text = `${me.wins}勝${me.losses}敗・${me.place}位`;
  const contention = outlook === 'self' || outlook === 'others' || outlook === 'clinched';
  return {
    text,
    win: last && outlook === 'self' ? '四段' : '',
    goal: outlook === 'clinched' ? '四段が決まっている' : outlook === 'self' ? '全部勝てば四段' : outlook === 'others' ? '全部勝って、ほかの結果を待つ' : '来期へつなぐ一局',
    boss: last || (contention && league.round >= league.rounds - 2),
    outlook,
  };
}

function startLeagueDay(run, rng, userLevel) {
  const scale = shoreikaiScale(run.settings.scale);
  const league = run.league;
  const days = Math.max(1, Math.ceil(league.rounds / GAMES_PER_DAY));
  ageMonth(run.world, scale, rng, MONTHS_PER_TERM / days);
  run.age += MONTHS_PER_TERM / days;
  // ほかの段級の例会も進む(三段の人以外)。
  run.dayNo += 1;
  run.day = { no: run.dayNo, opponents: [], results: [], others: playMonth(run.world, rng) };
  setLeaguePending(run, rng, userLevel);
}

function setLeaguePending(run, rng, userLevel) {
  const league = run.league;
  const pair = league.schedule[league.round].find((ids) => ids.includes(USER_ID));
  const opponentId = pair[0] === USER_ID ? pair[1] : pair[0];
  // この回戦のほかの対局は、プレイヤーの局の前に決めておく(対局中の速報)。
  const others = playLeagueRound(run.world, rng, league, league.round);
  league.pendingOthers = others;
  const last = league.round === league.rounds - 1;
  setPending(run, rng, {
    opponentId, kind: 'league', userLevel,
    label: `第${league.term}期 三段リーグ ${last ? '最終局' : `${league.round + 1}回戦`}`,
    eventText: `第${league.term}期 三段リーグ`,
    stakes: leagueStakes(run),
    others,
  });
}

/**
 * 三段リーグを始める(三段になったとき・次の期)。三段になったばかり(entering)なら、ほかの三段の期を先に締める
 * (途中の期にあとから入らず、すぐ次の期から指す)。
 */
function startLeague(run, rng, userLevel, { entering = false } = {}) {
  const scale = shoreikaiScale(run.settings.scale);
  const world = run.world;
  if (entering) playNpcTerm(world, scale, rng);
  run.league = newLeague(world, scale, rng, true);
  run.leagueTerms += 1;
  world.termEndsAt = Math.floor(world.month) + MONTHS_PER_TERM;
  startLeagueDay(run, rng, userLevel);
}

/**
 * 新しい挑戦を始める(入会試験から)。
 * @param {{
 *   seed: number, settings: any, examRank: number, mentor?: any, userName?: string, userLevel: number,
 * }} input
 */
export function createShoreikaiRun({ seed, settings, examRank, mentor = null, userName = 'あなた', userLevel }) {
  const rng = createRng(seed);
  const merged = { ...DEFAULT_SETTINGS, ...settings };
  const scale = shoreikaiScale(merged.scale);
  const rank = clamp(Math.round(examRank), 0, 5);
  const world = createWorld(rng, scale);
  const run = {
    version: SHOREIKAI_VERSION,
    id: seed,
    settings: { ...merged, scale: scale.id },
    userName,
    mentor,
    phase: 'exam',
    rank,
    entryRank: rank,
    best: rank,
    // 年齢(か月)。年齢制限を選んだ人だけ、画面に出す。
    age: ENTRY_AGE[rank] * 12,
    record: emptyRecord(),
    slump: emptySlump(),
    point: false,
    jiten: 0,
    sandanPoints: 0,
    leagueTerms: 0,
    extended: false,
    dayNo: 0,
    day: null,
    recent: [],
    exam: null,
    league: null,
    lastTerm: null,
    peers: [],
    games: [],
    history: [],
    events: [],
    kishiNumber: null,
    resultSeen: false,
    world,
    rng: 0,
    pending: null,
  };
  beginExam(run, rng, rank, userLevel);
  run.history.push({ day: 0, kind: 'exam', text: `${rankLabel(rank)}で入会試験を受験` });
  run.rng = rng.state;
  return link(run);
}

function beginExam(run, rng, rank, userLevel) {
  run.phase = 'exam';
  run.rank = rank;
  run.entryRank = rank;
  run.best = rank;
  run.age = Math.max(run.age, ENTRY_AGE[rank] * 12);
  run.exam = {
    rank,
    stage: 1,
    wins: 0,
    losses: 0,
    results: [],
    second: examSecondOpponents(run.world, rng, rank),
    secondResults: [],
    examinees: makeExaminees(run.world, rng, rank),
    tries: (run.exam?.tries ?? 0) + 1,
  };
  link(run);
  startExamPending(run, rng, userLevel);
}

/**
 * 入会試験に落ちたあと、受け直す(受験級を選び直せる)。
 * @param {any} run
 * @param {number} rank
 * @param {{ userLevel: number }} options
 */
export function retryExam(run, rank, { userLevel }) {
  const next = structuredClone({ ...run, players: undefined });
  const rng = createRng(next.rng);
  next.events = [];
  beginExam(next, rng, clamp(Math.round(rank), 0, 5), userLevel);
  next.history.push({ day: next.dayNo, kind: 'exam', text: `${rankLabel(next.rank)}で受け直し` });
  next.rng = rng.state;
  return link(next);
}

/** 入会試験に合格した。受験者のうち2人が同期として入会する。 */
function passExam(run, rng, userLevel) {
  const exam = run.exam;
  const examinees = Object.values(exam.examinees).sort((a, b) => b.rating - a.rating);
  run.peers = [];
  for (const [index, examinee] of examinees.slice(0, 2).entries()) {
    const member = {
      ...examinee,
      id: `s${run.world.nextId}`,
      kind: 'shoreikai',
      dan: rankLabel(exam.rank),
      peer: true,
      // 1人は伸びる同期、1人はゆっくりの同期。
      talent: index === 0 ? 40 : 0,
      rating: RANK_RATINGS[exam.rank] + (index === 0 ? 10 : -5),
      joined: run.world.month,
      record: emptyRecord(),
      slump: emptySlump(),
    };
    run.world.nextId += 1;
    run.world.members[member.id] = member;
    run.peers.push(member.id);
  }
  run.phase = 'reikai';
  run.rank = exam.rank;
  run.events.push({ kind: 'pass', rank: exam.rank, text: `${rankLabel(exam.rank)}で入会` });
  run.history.push({ day: run.dayNo, kind: 'pass', text: `入会試験に合格（${rankLabel(exam.rank)}）` });
  link(run);
  startReikaiDay(run, rng, userLevel);
}

/**
 * プレイヤーの1局を記録する。入会試験・例会・三段リーグを進め、次の1局を決める。
 * @param {any} run
 * @param {'win' | 'loss'} outcome
 * @param {{ userLevel: number }} options userLevelは、いまの棋力(相手のLvをおすすめに合わせる)
 */
export function recordShoreikaiGame(run, outcome, { userLevel }) {
  if (!run?.pending) return run;
  const next = structuredClone({ ...run, players: undefined });
  const rng = createRng(next.rng);
  const win = outcome === 'win';
  const pending = next.pending;
  const opponent = players(next)[pending.opponentId];
  next.events = [];
  next.games.push({ day: next.dayNo, kind: pending.kind, opponentId: pending.opponentId, name: opponent?.name ?? '', dan: opponent?.dan ?? '', rank: next.rank, win });
  next.pending = null;
  if (pending.kind === 'exam1' || pending.kind === 'exam2') recordExam(next, rng, pending, win, userLevel);
  else if (pending.kind === 'reikai') recordReikai(next, rng, win, opponent, userLevel);
  else if (pending.kind === 'league') recordLeague(next, rng, win, opponent, userLevel);
  next.rng = rng.state;
  return link(next);
}

function recordExam(run, rng, pending, win, userLevel) {
  const exam = run.exam;
  if (pending.kind === 'exam1') {
    exam.results.push(win ? 'win' : 'loss');
    exam.wins += win ? 1 : 0;
    exam.losses += win ? 0 : 1;
    if (exam.wins >= EXAM_RULES.firstPass) {
      exam.stage = 2;
      run.events.push({ kind: 'exam-first', text: '一次試験通過' });
      startExamPending(run, rng, userLevel);
      return;
    }
    if (exam.losses >= EXAM_RULES.firstFail) {
      failExam(run, '一次試験');
      return;
    }
    startExamPending(run, rng, userLevel);
    return;
  }
  exam.secondResults.push(win ? 'win' : 'loss');
  if (win) {
    passExam(run, rng, userLevel);
    return;
  }
  if (exam.secondResults.length >= Math.min(EXAM_RULES.secondGames, exam.second.length)) {
    failExam(run, '二次試験');
    return;
  }
  startExamPending(run, rng, userLevel);
}

function failExam(run, stage) {
  run.phase = 'failed';
  run.events.push({ kind: 'fail', text: `${stage}で不合格` });
  run.history.push({ day: run.dayNo, kind: 'fail', text: `入会試験 ${stage}で不合格（${rankLabel(run.exam.rank)}受験）` });
}

function recordReikai(run, rng, win, opponent, userLevel) {
  const scale = shoreikaiScale(run.settings.scale);
  const world = run.world;
  run.day.results.push(win ? 'win' : 'loss');
  run.recent = [opponent?.id, ...run.recent].filter(Boolean).slice(0, RECENT_OPPONENTS);
  // プレイヤーに勝った相手は、少し自信をつける(強さが少し伸びる)。
  if (opponent && world.members[opponent.id] && !win) world.members[opponent.id].rating += 2;
  const rule = promotionRule(scale, run.rank);
  run.record = addToRecord(rule, run.record, win);
  const slump = addToSlump(scale, run.slump, win, run.point);
  run.slump = slump.slump;
  if (slump.event === 'point') {
    run.point = true;
    run.events.push({ kind: 'point', text: '降級点' });
  } else if (slump.event === 'clear') {
    run.point = false;
    run.events.push({ kind: 'clear', text: '降級点が消えた' });
  } else if (slump.event === 'demote') {
    run.point = false;
    if (run.rank > 0) {
      run.rank -= 1;
      run.record = emptyRecord();
      run.events.push({ kind: 'demote', rank: run.rank, text: `${rankLabel(run.rank)}に降級` });
      run.history.push({ day: run.dayNo, kind: 'demote', text: `${rankLabel(run.rank)}に降級` });
    }
  }
  const reached = slump.event === 'demote' ? null : promotionReached(rule, run.record);
  if (reached) {
    const word = promotionWord(run.rank);
    run.rank += 1;
    run.best = Math.max(run.best, run.rank);
    run.record = emptyRecord();
    run.slump = emptySlump();
    run.point = false;
    run.events.push({ kind: 'promote', rank: run.rank, mark: reached, word, text: `${rankLabel(run.rank)}に${word}（${reached}）` });
    run.history.push({ day: run.dayNo, kind: 'promote', text: `${rankLabel(run.rank)}に${word}（${reached}）` });
    if (run.rank === SANDAN) {
      run.phase = 'league';
      run.events.push({ kind: 'league-entry', text: '三段リーグ入り' });
      startLeague(run, rng, userLevel, { entering: true });
      return;
    }
  }
  if (run.settings.ageLimit && run.rank < SHODAN && run.age >= AGE_LIMIT.shodan * 12) {
    retire(run, '21歳までに初段になれなかった');
    return;
  }
  if (run.day.results.length >= GAMES_PER_DAY) startReikaiDay(run, rng, userLevel);
  else setReikaiPending(run, rng, userLevel);
}

function recordLeague(run, rng, win, opponent, userLevel) {
  const league = run.league;
  const games = league.pendingOthers ?? [];
  delete league.pendingOthers;
  league.results.push([...games, { a: USER_ID, b: opponent.id, winner: win ? USER_ID : opponent.id }]);
  run.day.results.push(win ? 'win' : 'loss');
  league.round += 1;
  if (league.round >= league.rounds) {
    closeUserLeague(run, rng, userLevel);
    return;
  }
  if (run.day.results.length >= GAMES_PER_DAY) startLeagueDay(run, rng, userLevel);
  else setLeaguePending(run, rng, userLevel);
}

/**
 * 最終日の結果発表の並び(四段を争った人。最終日の前の勝ち数と、最終日の結果)。
 * @param {any} league
 * @param {ReturnType<typeof leagueStandings>} rows
 * @param {Record<string, { name: string, story: string | null }>} people 締める前の名前(四段になった人は世界から外れるため)
 * @param {string[]} promoted
 * @param {string | null} jiten
 */
function finalReveal(league, rows, people, promoted, jiten) {
  const finalRounds = league.results.slice(-GAMES_PER_DAY);
  const resultsOf = (id) => finalRounds.map((round) => {
    const game = round.find((item) => item.a === id || item.b === id);
    return game ? (game.winner === id ? 'win' : 'loss') : 'rest';
  });
  const cut = league.promote + 2;
  const contenders = rows.filter((row) => row.place <= cut || row.id === USER_ID || promoted.includes(row.id));
  return contenders.map((row) => {
    const last = resultsOf(row.id);
    const lastWins = last.filter((result) => result === 'win').length;
    return {
      id: row.id,
      name: people[row.id]?.name ?? '',
      you: row.id === USER_ID,
      story: people[row.id]?.story ?? null,
      before: row.wins - lastWins,
      last,
      wins: row.wins,
      losses: row.losses,
      place: row.place,
      promoted: promoted.includes(row.id),
      jiten: jiten === row.id,
    };
  }).sort((a, b) => a.place - b.place);
}

/** プレイヤーの三段リーグの1期を締める。四段・次点・降段点・年齢制限。続けるなら次の期へ。 */
function closeUserLeague(run, rng, userLevel) {
  const league = run.league;
  const world = run.world;
  const people = Object.fromEntries(league.order.map((id) => [id, {
    name: id === USER_ID ? run.userName : world.members[id]?.name ?? '',
    story: world.members[id]?.story ?? null,
  }]));
  const result = closeLeague(world, league);
  const me = result.rows.find((row) => row.id === USER_ID);
  const promotedNow = result.promoted.includes(USER_ID);
  let jitenNow = result.jiten === USER_ID;
  if (jitenNow) run.jiten += 1;
  const byJiten = !promotedNow && jitenNow && run.jiten >= 2;
  run.lastTerm = {
    term: league.term,
    rounds: league.rounds,
    promote: league.promote,
    wins: me.wins,
    losses: me.losses,
    place: me.place,
    promoted: promotedNow || byJiten,
    jiten: jitenNow,
    byJiten,
    endedAtGame: run.games.length,
    reveal: finalReveal(league, result.rows, people, result.promoted, result.jiten),
    rows: result.rows.map((row) => ({ id: row.id, wins: row.wins, losses: row.losses, place: row.place, name: people[row.id]?.name ?? '', you: row.id === USER_ID })),
  };
  run.league = null;
  world.termEndsAt = Math.floor(world.month) + MONTHS_PER_TERM;
  if (promotedNow || byJiten) {
    world.sandanOrder = world.sandanOrder.filter((id) => id !== USER_ID);
    run.phase = 'pro';
    run.rank = PRO;
    run.best = PRO;
    world.proCount += 1;
    run.kishiNumber = KISHI_NUMBER_BASE + world.proCount;
    run.pending = null;
    run.events.push({ kind: 'pro', text: byJiten ? '次点2回で四段昇段' : '四段昇段' });
    run.history.push({ day: run.dayNo, kind: 'pro', text: `第${league.term}期三段リーグ${byJiten ? 'で2回目の次点。' : `${me.place}位で`}四段昇段（棋士番号${run.kishiNumber}）` });
    return;
  }
  if (jitenNow) {
    run.events.push({ kind: 'jiten', text: `次点（${run.jiten}回目）` });
    run.history.push({ day: run.dayNo, kind: 'jiten', text: `第${league.term}期三段リーグ ${me.place}位・次点（${run.jiten}回目）` });
  } else {
    run.history.push({ day: run.dayNo, kind: 'league', text: `第${league.term}期三段リーグ ${me.wins}勝${me.losses}敗・${me.place}位` });
  }
  // 降段点(勝率2割5分以下)。2期続けたら二段へ。
  if (me.wins <= sandanDemoteWins(league.rounds)) {
    run.sandanPoints += 1;
    run.events.push({ kind: 'sandan-point', text: run.sandanPoints >= 2 ? '二段に降段' : '降段点' });
  } else {
    run.sandanPoints = 0;
  }
  if (run.sandanPoints >= 2) {
    world.sandanOrder = world.sandanOrder.filter((id) => id !== USER_ID);
    run.sandanPoints = 0;
    run.rank = SANDAN - 1;
    run.phase = 'reikai';
    run.record = emptyRecord();
    run.history.push({ day: run.dayNo, kind: 'demote', text: '二段に降段' });
    startReikaiDay(run, rng, userLevel);
    return;
  }
  // 年齢制限(選んだ人だけ)。26歳の期で四段になれなければ退会。勝ち越せば1期ずつ延長(29歳まで)。
  if (run.settings.ageLimit && run.age >= AGE_LIMIT.pro * 12) {
    const winning = me.wins * 2 > league.rounds;
    if (!winning || run.age >= (AGE_LIMIT.pro + 3) * 12) {
      retire(run, '年齢制限');
      return;
    }
    run.extended = true;
    run.events.push({ kind: 'extend', text: '勝ち越しで延長' });
  }
  startLeague(run, rng, userLevel);
}

function retire(run, reason) {
  run.world.sandanOrder = run.world.sandanOrder.filter((id) => id !== USER_ID);
  run.phase = 'retired';
  run.pending = null;
  run.events.push({ kind: 'retired', text: `退会（${reason}）` });
  run.history.push({ day: run.dayNo, kind: 'retired', text: `奨励会を退会（${reason}）` });
}

// ---- 画面に出す形

/** 名札掛け(段級ごとの列に名札)。自分・同期・羽音には印。 */
export function nameboard(run) {
  if (!run?.world) return [];
  const world = run.world;
  const columns = RANKS.slice(0, SANDAN + 1).map((label, rank) => ({ rank, label, tags: [] }));
  for (const member of membersOf(world)) {
    if (member.kind !== 'shoreikai') continue;
    const column = columns[Math.min(member.rank, SANDAN)];
    column.tags.push({ id: member.id, name: member.name, you: false, peer: Boolean(member.peer), rival: member.story === HANANE, rating: member.rating });
  }
  const inBoard = run.phase === 'reikai' || run.phase === 'league';
  if (inBoard) columns[Math.min(run.rank, SANDAN)].tags.push({ id: USER_ID, name: run.userName, you: true, peer: false, rival: false, rating: 0 });
  // 列の中は、上の段級に近い(強い)人から。三段は前期の順位。
  for (const column of columns) {
    if (column.rank === SANDAN) {
      const order = run.league?.order ?? world.sandanOrder;
      column.tags.sort((a, b) => (order.indexOf(a.id) + 999 * Number(order.indexOf(a.id) < 0)) - (order.indexOf(b.id) + 999 * Number(order.indexOf(b.id) < 0)));
    } else {
      column.tags.sort((a, b) => Number(b.you) - Number(a.you) || b.rating - a.rating);
    }
  }
  return columns;
}

/** 相手の札に出す形。 */
function opponentBrief(member) {
  if (!member) return null;
  return {
    id: member.id,
    name: member.name,
    dan: member.dan,
    age: Math.floor(member.age ?? 0),
    level: member.level ?? null,
    rating: member.rating,
    kind: member.kind,
    story: member.story ?? null,
    peer: Boolean(member.peer),
    style: member.style ?? null,
    character: member.character ?? null,
    repertoire: member.repertoire ?? null,
  };
}

/**
 * 画面に出す形。phaseごとに、いま何をしていて、次の1局は何で、あと何勝で上がるか。
 * @param {any} run
 */
export function describeShoreikai(run) {
  if (!run) return null;
  const scale = shoreikaiScale(run.settings.scale);
  const all = players(run);
  const pending = run.pending ? { ...run.pending, opponent: opponentBrief(all[run.pending.opponentId]) } : null;
  const rule = run.rank < SANDAN ? promotionRule(scale, run.rank) : null;
  const progress = rule ? promotionProgress(rule, run.record) : null;
  const league = run.league
    ? (() => {
      const league = run.league;
      const rows = leagueStandings(league);
      const nextId = run.pending?.kind === 'league' ? run.pending.opponentId : null;
      // 回戦ごとの○●(休みの回戦は空)。
      const marksOf = (id) => Array.from({ length: league.rounds }, (_, round) => {
        const game = league.results[round]?.find((item) => item.a === id || item.b === id);
        return game ? (game.winner === id ? 'win' : 'loss') : null;
      });
      return {
        term: league.term,
        round: league.round,
        rounds: league.rounds,
        promote: league.promote,
        outlook: leagueOutlook(rows, USER_ID, league.rounds, league.promote),
        demoteWins: sandanDemoteWins(league.rounds),
        rows: rows.map((row) => {
          const member = run.world.members[row.id];
          return {
            id: row.id,
            place: row.place,
            wins: row.wins,
            losses: row.losses,
            you: row.id === USER_ID,
            next: row.id === nextId,
            name: row.id === USER_ID ? run.userName : member?.name ?? '',
            dan: row.id === USER_ID ? '三段' : `${Math.floor(member?.age ?? 0)}歳`,
            story: member?.story ?? null,
            peer: Boolean(member?.peer),
            points: row.id === USER_ID ? run.sandanPoints : member?.sandan?.points ?? 0,
            zone: row.place <= league.promote ? 'promote' : row.place === league.promote + 1 ? 'point' : 'mid',
            marks: marksOf(row.id),
          };
        }),
      };
    })()
    : null;
  const peers = run.peers.map((id) => run.world.members[id]).filter(Boolean).map((member) => ({ id: member.id, name: member.name, dan: member.dan, rank: member.rank }));
  const hanane = membersOf(run.world).find((member) => member.story === HANANE);
  const wins = run.games.filter((game) => game.win).length;
  return {
    runId: run.id,
    phase: run.phase,
    rank: run.rank,
    rankLabel: run.phase === 'exam' || run.phase === 'failed' ? `${rankLabel(run.exam?.rank ?? run.rank)}受験` : rankLabel(run.rank),
    word: run.rank < SANDAN ? promotionWord(run.rank) : '',
    nextRankLabel: rankLabel(run.rank + 1),
    age: Math.floor(run.age / 12),
    ageLimit: Boolean(run.settings.ageLimit),
    settings: run.settings,
    scale: { id: scale.id, label: scale.label },
    exam: run.exam ? {
      rank: run.exam.rank,
      stage: run.exam.stage,
      wins: run.exam.wins,
      losses: run.exam.losses,
      results: run.exam.results,
      secondResults: run.exam.secondResults,
      tries: run.exam.tries,
    } : null,
    progress,
    rule: rule ? { streak: rule.streak, marks: rule.marks.map(([w, l]) => `${w}勝${l}敗`) } : null,
    point: run.point,
    slumpWarning: run.rank < SANDAN && slumpWarning(scale, run.slump),
    day: run.day ? { no: run.day.no, results: run.day.results } : null,
    pending,
    board: nameboard(run),
    league,
    lastTerm: run.lastTerm,
    // いま終えた1局で、三段リーグの1期が終わった(最終日の結果発表を出す)。
    termJustEnded: Boolean(run.lastTerm) && run.lastTerm.endedAtGame === run.games.length,
    jiten: run.jiten,
    sandanPoints: run.sandanPoints,
    peers,
    hanane: hanane ? { name: hanane.name, dan: hanane.dan } : { name: STORY_PEOPLE[HANANE].name, dan: '四段' },
    mentor: run.mentor,
    feed: run.world.feed ?? [],
    history: run.history,
    events: run.events,
    games: run.games.length,
    wins,
    losses: run.games.length - wins,
    bestStreak: bestStreak(run.games),
    kishiNumber: run.kishiNumber,
    resultSeen: run.resultSeen,
  };
}

/** 最長連勝。 */
export function bestStreak(games) {
  let best = 0;
  let now = 0;
  for (const game of games) {
    now = game.win ? now + 1 : 0;
    best = Math.max(best, now);
  }
  return best;
}

// ---- キャリアと保存

/** 奨励会のキャリア(いまの挑戦と、これまでの挑戦の要約)。 */
export function createShoreikaiCareer() {
  return { version: SHOREIKAI_VERSION, ladder: LADDER_VERSION, settings: { ...DEFAULT_SETTINGS }, run: null, history: [], pro: null };
}

/**
 * 挑戦を終えた(四段・退会)ら、要約を残す。四段になったら、棋士番号をキャリアに残す。
 * @param {ReturnType<typeof createShoreikaiCareer>} career
 */
export function closeShoreikaiRun(career) {
  const run = career.run;
  if (!run || (run.phase !== 'pro' && run.phase !== 'retired')) return career;
  const wins = run.games.filter((game) => game.win).length;
  const summary = {
    id: run.id,
    result: run.phase,
    rank: rankLabel(run.best),
    entry: rankLabel(run.entryRank),
    games: run.games.length,
    wins,
    losses: run.games.length - wins,
    days: run.dayNo,
    kishiNumber: run.kishiNumber,
    mentor: run.mentor ? `${run.mentor.name}${run.mentor.dan}` : '',
  };
  return {
    ...career,
    run: null,
    history: [summary, ...career.history.filter((item) => item.id !== run.id)].slice(0, 20),
    pro: run.phase === 'pro' ? (career.pro ?? { kishiNumber: run.kishiNumber, entry: summary.entry, games: summary.games, mentor: summary.mentor }) : career.pro,
  };
}

export function loadShoreikai(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(SHOREIKAI_KEY) ?? 'null');
    if (!parsed || parsed.version !== SHOREIKAI_VERSION) return createShoreikaiCareer();
    const career = { ...createShoreikaiCareer(), ...parsed, ladder: LADDER_VERSION, settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) } };
    // 50段階の表(2026-10-23)より前の保存は、奨励会員の指すLv(41段階の表)を同じ強さの今のLvへ移す。
    if (parsed.ladder !== LADDER_VERSION && career.run?.world?.members) {
      for (const member of Object.values(career.run.world.members)) {
        if (member && Number.isFinite(member.level)) member.level = ladderLevelIndexFromV2(member.level);
      }
    }
    if (career.run?.world?.members) link(career.run);
    else career.run = null;
    return career;
  } catch {
    return createShoreikaiCareer();
  }
}

/** 保存する(相手の表playersは、世界から付け直せるので保存しない)。 */
export function saveShoreikai(storage, career) {
  try {
    storage?.setItem(SHOREIKAI_KEY, JSON.stringify(career, (key, value) => (key === 'players' ? undefined : value)));
  } catch {
    // 保存できない環境でも、この挑戦は続けられる。
  }
}

