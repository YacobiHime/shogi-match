// 師匠の1年の「会の画面」(docs/disciple-mode-design.mdの36-5)。弟子が通う研修会・奨励会の中を見せる。
// 名札掛け・対戦表(次の例会と前回の例会)・会員(弟子と同じ4つの能力)・規定(昇級の規定と進み・降級点・手合い・年齢制限・三段リーグ)。
// 画面と保存の仕組みに依存しない。会員の能力は保存せず、会員のidとLvから毎回同じものを作る。

import { STAT_KEYS, STAT_LABELS, STAT_MAX, STAT_LEVEL_MAX, STAT_LEVEL_MIN, overallLevel, statRank } from './disciple-strength.mjs';
import { HANDICAP_LABELS, TOP, classLabel, describeKenshukai, nameboard as kenshukaiBoard, shidoHandicap } from './kenshukai.mjs';
import { AGE_LIMIT, SANDAN, describeShoreikai, nameboard as shoreikaiBoard, rankLabel } from './shoreikai.mjs';
import { opponentLevel, shoreikaiOpponentLevel, discipleAgeMonths, pendingTeaiText } from './disciple-run.mjs';
import { HANKO_LABEL, TEAI_LABELS } from './teai.mjs';
import { USER_ID } from './ryuo.mjs';
import { repertoireText } from './ryuo-repertoire.mjs';
import { staticShare, usageRows } from './opening-usage.mjs';

const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));

/** 文字列から決まった数を作る(会員の能力の偏りの種)。 */
function hashOf(text) {
  let hash = 2166136261;
  for (const char of String(text)) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Lvを、4つがそろったときの能力値に換える(statLevelの逆)。 */
const statForLevel = (level) => ((clamp(level, STAT_LEVEL_MIN, STAT_LEVEL_MAX) - STAT_LEVEL_MIN) / (STAT_LEVEL_MAX - STAT_LEVEL_MIN)) * STAT_MAX;

/** 会員の能力の偏り(1つだけ高い・1つだけ低い。D:8-1 とがらせる)。 */
const SPREAD = Object.freeze({ high: 160, low: -130, rest: 45 });

/**
 * 会員の4つの能力(弟子と同じ物差し)。全体の強さのLvが、その会員と指すときのLvになるように作る。
 * @param {string} id 会員のid(偏りの種)
 * @param {number} level その会員のLv
 * @returns {{ key: string, label: string, value: number, rank: string }[]}
 */
export function memberAbilities(id, level) {
  const hash = hashOf(id);
  const high = STAT_KEYS[hash % 4];
  const low = STAT_KEYS[(hash >>> 3) % 4 === hash % 4 ? ((hash >>> 3) + 1) % 4 : (hash >>> 3) % 4];
  const base = statForLevel(level);
  const offset = (key, index) => (key === high ? SPREAD.high : key === low ? SPREAD.low : (((hash >>> (8 + index * 4)) % 9) - 4) / 4 * SPREAD.rest);
  let stats = Object.fromEntries(STAT_KEYS.map((key, index) => [key, base + offset(key, index)]));
  // 全体の強さがLvになるよう、そろえて動かす(2回で十分に近づく)。
  for (let round = 0; round < 2; round += 1) {
    const shift = statForLevel(level) - statForLevel(overallLevel(stats));
    stats = Object.fromEntries(STAT_KEYS.map((key) => [key, clamp(stats[key] + shift, 0, STAT_MAX)]));
  }
  return STAT_KEYS.map((key) => ({ key, label: STAT_LABELS[key], value: Math.round(stats[key]), rank: statRank(stats[key]) }));
}

/** 4つの能力の説明(会員の札のレーダーチャートのランクに添える。41章の局面ごとの効き)。 */
export const STAT_HINTS = Object.freeze({
  reading: '中盤に数手先まで読む力',
  plan: '序盤の組み立てと、定跡を知っているか',
  steady: 'うっかりの少なさ',
  mate: '終盤に詰みを読み切る力',
});
/** 型の一言を出す、いちばん高い能力といちばん低い能力の差。 */
const TYPE_GAP = 150;

/**
 * 会員の札の能力の形(やこびノートの棋士名鑑と同じ部品PlayerAbilityPanelに渡す。docs/disciple-mode-design.mdの44章)。
 * 師匠の1年の対局に効く4つの能力と、得意戦法の使用率だけを出す(特殊能力・棋風は師匠の1年の対局に効かないので出さない)。
 * @param {{ repertoire?: any } | null | undefined} member
 * @param {ReturnType<typeof memberAbilities>} abilities
 */
export function memberAbilityPanel(member, abilities) {
  const sorted = [...abilities].sort((a, b) => b.value - a.value);
  const top = sorted[0];
  const bottom = sorted.at(-1);
  const type = top && bottom && top.value - bottom.value >= TYPE_GAP ? `${top.label}が得意・${bottom.label}が苦手` : 'バランス型';
  const usage = member?.repertoire?.usage ?? null;
  return {
    abilities: abilities.map((stat) => ({ ...stat, hint: STAT_HINTS[stat.key] ?? '' })),
    type,
    specials: [],
    staticShare: usage ? staticShare(usage) : null,
    openings: usageRows(usage).slice(0, 6).map((row) => ({ ...row, record: '' })),
  };
}

/** いまの所属の会(研修会・奨励会・三段リーグ)。会の画面がないときはnull。 */
export function societyRun(state) {
  if (!state || state.end) return null;
  if (state.shoreikai?.world) return { kind: state.shoreikai.phase === 'league' ? 'league' : 'shoreikai', run: state.shoreikai };
  if (state.kenshukai?.world && !state.kenshukai.done) return { kind: 'kenshukai', run: state.kenshukai };
  return null;
}

/** 会の名前(上の帯のボタン)。 */
export const SOCIETY_TITLES = Object.freeze({ kenshukai: '研修会', shoreikai: '奨励会', league: '三段リーグ' });

/** 手合いの短い言葉(対戦表の札)。 */
function teaiLabel(decided, nameOf, { shido = '' } = {}) {
  if (shido) return `指導対局 ${shido}`;
  if (!decided) return '';
  if (decided.teai === 'lance') return `香落ち・${nameOf(decided.giver)}が上手`;
  return `${TEAI_LABELS.hirate}・${nameOf(decided.black)}の先`;
}

/**
 * 次の例会の対戦表(弟子の局と、近い段級のほかの局)。ほかの局の結果は、指すまで伏せる。
 * @param {any} state
 * @param {'kenshukai' | 'shoreikai' | 'league'} kind
 * @param {any} run
 */
function upcomingDay(state, kind, run) {
  const all = { ...run.world.members, ...(run.guests ?? {}) };
  const nameOf = (id) => (id === USER_ID ? state.name : all[id]?.name ?? '');
  const placeOf = (id) => {
    if (id === USER_ID) return kind === 'kenshukai' ? classLabel(run.cls) : rankLabel(run.rank);
    const member = all[id];
    if (!member) return '';
    if (member.kind === 'teacher') return member.dan ?? '';
    return kind === 'kenshukai' ? classLabel(member.cls ?? 0) : member.dan ?? '';
  };
  if (kind === 'league') {
    const league = run.league;
    if (!league) return null;
    const round = league.schedule?.[league.round] ?? [];
    return {
      title: `第${league.term}期 三段リーグ ${league.round + 1}回戦`,
      mine: round.filter((pair) => pair.includes(USER_ID)).map((pair) => {
        const id = pair[0] === USER_ID ? pair[1] : pair[0];
        return { name: nameOf(id), place: '三段', teai: '平手', rival: Boolean(all[id]?.rival), result: null };
      }),
      others: round.filter((pair) => !pair.includes(USER_ID)).map(([a, b]) => ({ a: { name: nameOf(a), place: '三段' }, b: { name: nameOf(b), place: '三段' }, teai: '平手', winner: null })),
    };
  }
  const day = run.day;
  if (!day || run.phase === 'exam') return null;
  const rankOf = (id) => (kind === 'kenshukai' ? all[id]?.cls : all[id]?.rank);
  const myRank = kind === 'kenshukai' ? run.cls : run.rank;
  const mine = (day.opponents ?? []).map((id, index) => {
    const shido = day.kinds?.[index] === 'shido';
    const handicap = shido ? HANDICAP_LABELS[/** @type {keyof typeof HANDICAP_LABELS} */ (shidoHandicap(run.cls))] : '';
    return {
      name: nameOf(id), place: placeOf(id), rival: Boolean(all[id]?.rival),
      teai: teaiLabel(day.teai?.[index] ?? null, nameOf, { shido: shido ? handicap || '駒落ち' : '' }),
      result: day.results?.[index] ?? null,
    };
  });
  const others = (day.others ?? [])
    .filter((game) => all[game.a] && all[game.b])
    .map((game) => ({ game, near: Math.min(Math.abs((rankOf(game.a) ?? myRank) - myRank), Math.abs((rankOf(game.b) ?? myRank) - myRank)) }))
    .filter(({ near }) => near <= 1)
    .sort((x, y) => x.near - y.near || (x.game.round ?? 0) - (y.game.round ?? 0))
    .slice(0, 12)
    .sort((x, y) => (x.game.round ?? 0) - (y.game.round ?? 0) || x.near - y.near)
    .map(({ game }) => ({ round: game.round ?? null, a: { name: nameOf(game.a), place: placeOf(game.a) }, b: { name: nameOf(game.b), place: placeOf(game.b) }, teai: teaiLabel(game.teai ? game : null, nameOf), winner: null }));
  return { title: kind === 'kenshukai' ? `第${day.no}回例会（研修会 ${classLabel(run.cls)}）` : `第${day.no}回例会（奨励会 ${rankLabel(run.rank)}）`, mine, others };
}

/** 前回の例会の対戦表(disciple-run.mjsのdayRecord)を、画面の形に。 */
function lastDayView(state) {
  const last = state.lastDay;
  if (!last) return null;
  const nameOf = (seat) => (seat?.id === USER_ID ? state.name : seat?.name ?? '');
  const byId = (id, a, b) => (id === a.id ? a.name : id === b.id ? b.name : id === USER_ID ? state.name : '');
  return {
    title: last.kind === 'league' && last.league ? `第${last.league.term}期 三段リーグ ${last.league.round + 1}回戦〜` : `第${last.no}回例会`,
    mine: last.mine.map((game) => ({
      name: nameOf(game.opponent), place: game.opponent.place, rival: Boolean(game.opponent.rival),
      teai: game.kind === 'shido' ? '指導対局' : game.teai ? (game.teai.teai === 'lance' ? `香落ち・${game.teai.giver === USER_ID ? state.name : game.opponent.name}が上手` : `平手・${game.teai.black === USER_ID ? state.name : game.opponent.name}の先`) : '',
      result: game.win ? 'win' : 'loss',
    })),
    others: last.others.map((game) => ({
      round: game.round ?? null,
      a: { name: game.a.name, place: game.a.place }, b: { name: game.b.name, place: game.b.place },
      teai: game.teai === 'lance' ? `香落ち・${byId(game.giver, game.a, game.b)}が上手` : game.teai ? `平手・${byId(game.black, game.a, game.b)}の先` : '',
      winner: game.winner === game.a.id ? 'a' : 'b',
    })),
  };
}

/** 会員の一覧(弟子に近いクラス・段級から)。 */
function membersView(state, kind, run) {
  const rows = [];
  const myRank = kind === 'kenshukai' ? run.cls : run.rank;
  const vs = {};
  for (const game of run.games ?? []) {
    if (!game.opponentId) continue;
    const entry = (vs[game.opponentId] ??= { w: 0, l: 0 });
    if (game.win) entry.w += 1;
    else entry.l += 1;
  }
  for (const member of Object.values(run.world.members)) {
    if (kind !== 'kenshukai' && member.kind !== 'shoreikai') continue;
    const rank = kind === 'kenshukai' ? member.cls : member.rank;
    const level = Number.isFinite(member.rivalLevel) ? member.rivalLevel : kind === 'kenshukai' ? opponentLevel(member, member.cls) : shoreikaiOpponentLevel(member);
    rows.push({
      id: member.id,
      name: member.name,
      place: kind === 'kenshukai' ? `${classLabel(member.cls)}クラス` : member.dan ?? '',
      rank,
      age: Math.floor(member.age ?? 0),
      record: { w: member.w ?? 0, l: member.l ?? 0 },
      vs: vs[member.id] ?? { w: 0, l: 0 },
      peer: Boolean(member.peer),
      rival: Boolean(member.rival),
      style: member.style?.label ?? '',
      repertoire: member.repertoire ? repertoireText(member.repertoire) : member.style?.label ?? '',
      abilities: memberAbilities(member.id, level),
      ability: memberAbilityPanel(member, memberAbilities(member.id, level)),
      near: Math.abs(rank - myRank),
    });
  }
  return rows.sort((a, b) => Number(b.rival) - Number(a.rival) || a.near - b.near || b.rank - a.rank || a.name.localeCompare(b.name, 'ja'));
}

/** 手合いの表(規定のタブ)。 */
export const TEAI_TABLE = Object.freeze([
  { gap: '同じ', teai: `${TEAI_LABELS.hirate}（先後は交互）` },
  { gap: '1つ差', teai: `${HANKO_LABEL}（平手と香落ちを交互）` },
  { gap: '2つ差', teai: `${TEAI_LABELS.lance}（上の人が香を落とす）` },
]);

/** 規定のタブ。 */
function rulesView(state, kind, run) {
  if (kind === 'kenshukai') {
    const view = describeKenshukai(run);
    return {
      place: `${view?.classLabel ?? ''}クラス`,
      next: run.cls < TOP ? `${view?.nextClassLabel ?? ''}クラス` : '',
      rule: view?.rule ? `${view.rule.streak}連勝か、${view.rule.marks.join('・')}` : '',
      progress: view?.progress ? { record: view.progress.record, streak: view.progress.streak, winsLeft: view.progress.winsLeft } : null,
      point: Boolean(view?.point),
      slump: Boolean(view?.slumpWarning),
      teai: TEAI_TABLE,
      shido: Boolean(run.settings?.shido && (run.teachers ?? []).length),
      age: null,
      league: null,
      exit: 'A2クラスに上がると、奨励会6級に編入できる',
    };
  }
  const view = describeShoreikai(run);
  const ageYears = Math.floor(discipleAgeMonths(state) / 12);
  return {
    place: view?.rankLabel ?? '',
    next: run.rank < SANDAN ? rankLabel(run.rank + 1) : '四段',
    rule: view?.rule ? `${view.rule.streak}連勝か、${view.rule.marks.join('・')}` : '',
    progress: view?.progress ? { record: view.progress.record, streak: view.progress.streak, winsLeft: view.progress.winsLeft } : null,
    point: Boolean(view?.point),
    slump: Boolean(view?.slumpWarning),
    teai: kind === 'league' ? [{ gap: '三段リーグ', teai: 'すべて平手' }] : TEAI_TABLE,
    shido: false,
    age: { now: ageYears, shodan: AGE_LIMIT.shodan, pro: AGE_LIMIT.pro, passedShodan: run.rank >= 6 },
    league: view?.league ? {
      term: view.league.term, round: view.league.round, rounds: view.league.rounds, promote: view.league.promote,
      rows: view.league.rows.map((row) => ({ place: row.place, name: row.you ? state.name : row.name, wins: row.wins, losses: row.losses, you: row.you, zone: row.zone, marks: row.marks })),
    } : null,
    exit: kind === 'league' ? `上位${view?.league?.promote ?? 1}人が四段。次点を2回取っても四段` : '三段になると三段リーグへ',
  };
}

/**
 * 会の画面の形。
 * @param {any} state
 */
export function societyView(state) {
  const found = societyRun(state);
  if (!found) return null;
  const { kind, run } = found;
  const rawBoard = kind === 'kenshukai' ? kenshukaiBoard(run) : shoreikaiBoard(run);
  // 羽音の弟子の名札は紫(名札掛けの「羽音」の縁)。弟子の名札の名前は弟子の名前。
  const board = rawBoard.map((column) => ({
    ...column,
    tags: column.tags.map((tag) => ({ ...tag, name: tag.you ? state.name : tag.name, rival: Boolean(run.world.members[tag.id]?.rival) })),
  }));
  return {
    kind,
    title: SOCIETY_TITLES[kind],
    board,
    topRank: kind === 'kenshukai' ? TOP : SANDAN,
    upcoming: upcomingDay(state, kind, run),
    last: lastDayView(state),
    members: membersView(state, kind, run),
    rules: rulesView(state, kind, run),
    teaiNow: pendingTeaiText(state),
  };
}

/**
 * 制度の札(36-6)。制度が初めて効く瞬間の場面を見ると、その札が規定のタブに入る(あとで読み返せる)。
 * 数は、このゲームの規模(みじかい)のもの。
 */
export const SYSTEM_CARDS = Object.freeze([
  { id: 'kenshukai', title: '研修会', text: 'プロを目指す子と、強くなりたい子が通う会。F2からSまで13のクラスがあり、月に2回の例会で1日4局指す。' },
  { id: 'exam', title: '入会試験', text: '受けるクラスの研修会員と4局指し、その成績で入るクラスが決まる。落ちることはない。' },
  { id: 'reikai', title: '名札掛けと例会', text: '会員の名札は、クラスごとの列に掛けてある。例会の相手は、同じクラスか1つ上下の人。' },
  { id: 'teai', title: '手合い', text: 'クラス（段級）の差で手合いが付く。同じなら平手、1つ差は平手と香落ちを交互（平香交じり）、2つ差は香落ち。香を落とすのは上の人（上手）で、下の人（下手）が先手の側に座り、上手が先に指す。香落ちでも勝ちは勝ち。' },
  { id: 'shido', title: '指導対局', text: '2回に1回の例会の4局目は、幹事の先生との駒落ち。手合いはクラスで決まり（F二枚落ち〜B香落ち）、勝ち負けは昇級の成績に数える。' },
  { id: 'promote', title: '昇級の規定', text: 'クラスごとに「何連勝か、何勝何敗」で1つ上がる。負けが込むと数え直し。上がると名札が右の列へ掛け替わる。' },
  { id: 'point', title: '降級点', text: '負けが込むと降級点が付く。勝ち越せば消えるが、付いたままもう一度負けが込むと、クラスが1つ下がる。' },
  { id: 'exit', title: '研修会の出口', text: 'A2クラスに上がると、試験なしで奨励会6級に編入できる。奨励会は、プロ（四段）になるための会。' },
  { id: 'shoreikai', title: '奨励会', text: '6級から三段まで。例会は月に1回、1日2局。級は「昇級」、初段からは「昇段」。三段になると三段リーグで四段（プロ）を目指す。' },
  { id: 'agelimit', title: '年齢制限', text: '21歳の誕生日までに初段、26歳の誕生日までに四段になれないと、奨励会を去る。最後の三段リーグで勝ち越せば、29歳まで延びる。' },
  { id: 'shoreikai-teai', title: '奨励会の手合い', text: '同じ段級は平手、1つ差は平香交じり（半香）、2つ差は香落ち。三段リーグだけは、すべて平手。' },
  { id: 'dan', title: '昇段の規定', text: '初段からは昇段の規定が重くなる（このゲームでは4連勝か、6勝2敗・7勝3敗）。' },
  { id: 'league', title: '三段リーグ', text: '三段だけの半年のリーグ。上位（このゲームでは1人）が四段。総当たりではなく、決まった回数を指す。すべて平手。' },
  { id: 'jiten', title: '次点', text: '四段に届く順位のすぐ下が次点。次点を2回取ると、四段（フリークラス）になれる。' },
]);

/**
 * 見た場面で入った制度の札。
 * @param {any} state
 */
export function systemCardsOf(state) {
  const have = new Set(state?.systemCards ?? []);
  return SYSTEM_CARDS.filter((card) => have.has(card.id));
}
