// 順位戦の世界を1期進める(docs/player-world-note-design.mdの2章)。
// 世界は名簿のroster.junniに1つだけあり、作る・名簿と照らし合わせる・控えを書くのはryuo-league.mjs。
// ここは、世界を1期進める2つの道と、プレイヤーの参加、前の保存の移しかえ:
// - 名人戦の期が終わった(プレイヤーのクラスは実際の成績、ほかは自動): applyMeijinSeasonToRoster
// - プレイヤーが名人戦に出る前の、棋界の1年(全クラスと七番勝負を自動): autoJunniYear
// どちらも、名人が替わったら名簿のタイトル・獲得期数・タイトルの履歴・段位を直す。

import { advanceLeague, autoMeijinSeason } from './meijin.mjs';
import { USER_ID } from './ryuo.mjs';
import { addVsUser } from './ryuo-roster.mjs';
import { applyDanRules, createJunniWorld, ensureLeagueFields, syncJunni, writeJunniToMembers } from './ryuo-league.mjs';

/** 写し。名簿もキャリアも保存できる形(JSON)なので、画面の反応する値(Proxy)を渡されても写せるようにJSONで写す。 */
const clone = (value) => JSON.parse(JSON.stringify(value));

/**
 * 名簿に順位戦の世界がなければ作る(前の保存の移しかえ)。名人戦のキャリアに順位戦の世界(league)があれば、
 * それを正にして名簿へ移す(プレイヤーは名人戦に出たことがある)。なければ、名簿の今の順位戦から作る。
 * 名簿とキャリアの両方を書き換えずに、新しいものを返す。
 * @param {any} roster
 * @param {any} career 名人戦のキャリア(meijin.mjsのloadMeijinCareer)
 * @returns {{ roster: any, career: any, changed: boolean }}
 */
export function ensureJunniWorld(roster, career) {
  if (!roster || (roster.junni && !career?.league)) return { roster, career, changed: false };
  const next = clone(roster);
  const league = career?.league;
  if (league) {
    next.junni = {
      version: 1,
      no: career.no ?? 0,
      holder: league.holder ?? null,
      classes: clone(league.classes),
      points: { ...(league.points ?? {}) },
      even: { ...(league.even ?? {}) },
      free: [],
      userJoined: true,
    };
    // フリークラスは、名簿の控えから(名人戦の世界はフリークラスを持っていなかった)。
    const known = new Set([league.holder, ...Object.values(league.classes).flat()]);
    next.junni.free = Object.values(next.players).filter((member) => member.kind === 'pro' && member.junni === 'F' && !known.has(member.id)).map(({ id }) => id);
    syncJunni(next);
    for (const member of Object.values(next.players)) applyDanRules(member);
  } else if (!next.junni) {
    createJunniWorld(next);
  }
  const { league: _drop, ...rest } = career ?? {};
  return { roster: next, career: career ? rest : career, changed: true };
}

/** プレイヤーを順位戦に入れる(名人戦に初めて出るとき。C級2組の最後)。入ったら、棋界の1年は順位戦を進めない。 */
export function joinJunni(roster) {
  const world = roster?.junni;
  if (!world) return roster;
  const inWorld = world.holder === USER_ID || Object.values(world.classes).some((ids) => ids.includes(USER_ID));
  if (inWorld && world.userJoined) return roster;
  const next = clone(roster);
  if (!inWorld) next.junni.classes.C2.push(USER_ID);
  next.junni.userJoined = true;
  return next;
}

/**
 * 名人が決まった期を、名簿のタイトルに書く。名人の獲得期数を1つ足し(防衛も1期)、履歴に残し、段位を直す。
 * @param {any} roster 書き換える名簿
 * @param {{ no: number, holderBefore: string | null, holder: string | null }} result
 */
function recordMeijinTitle(roster, { no, holderBefore, holder }) {
  if (!holder) return;
  const member = roster.players[holder];
  if (member) {
    ensureLeagueFields(member);
    member.titleCounts.meijin = (member.titleCounts.meijin ?? 0) + 1;
    applyDanRules(member);
  }
  const name = holder === USER_ID ? 'あなた' : member?.name ?? '';
  roster.titleHistory = [...(roster.titleHistory ?? []), { no, title: 'meijin', holder, name, changed: holder !== holderBefore, event: 'meijin' }];
}

/**
 * 終わった名人戦の期で、順位戦の世界を1期進めて名簿へ書き戻す。期は始めの世界の写しで指したので、
 * 期の途中の引退・新四段は、書き戻したあとに名簿と照らし合わせて直す。名人戦の対局は、プレイヤーとの対戦成績にも数える。
 * @param {any} roster
 * @param {any} season 終わった名人戦の期(phase: 'done')
 */
export function applyMeijinSeasonToRoster(roster, season) {
  if (!roster || season?.phase !== 'done') return roster;
  if ((roster.junni?.no ?? 0) >= season.no) return roster;
  const next = clone(roster);
  const holderBefore = season.league.holder ?? null;
  const advanced = advanceLeague(season);
  next.junni = {
    ...(next.junni ?? {}),
    version: 1,
    no: season.no,
    holder: advanced.holder,
    classes: advanced.classes,
    points: advanced.points,
    even: advanced.even,
    free: next.junni?.free ?? [],
    userJoined: true,
  };
  syncJunni(next);
  recordMeijinTitle(next, { no: season.no, holderBefore, holder: advanced.holder });
  for (const member of Object.values(next.players)) applyDanRules(member);
  addVsUser(next, season.userGames ?? [], { no: season.no, event: 'meijin' });
  return next;
}

/**
 * プレイヤーが名人戦に出る前の、棋界の1年の順位戦(竜王戦の期の終わりに呼ぶ)。全クラスと七番勝負を自動で進め、
 * 名簿へ書き戻す。プレイヤーが名人戦に出たあと(userJoined)は、何もしない(順位戦は名人戦を指したときだけ進む)。
 * @param {any} roster
 * @param {{ next(): number }} rng
 * @returns {{ roster: any, result: { no: number, challenger: string | null, holder: string | null, changed: boolean } | null }}
 */
export function autoJunniYear(roster, rng) {
  if (!roster?.junni || roster.junni.userJoined) return { roster, result: null };
  const next = clone(roster);
  const world = next.junni;
  const holderBefore = world.holder ?? null;
  const { league, challenger, titleWinner } = autoMeijinSeason(world, { players: next.players, rng });
  const no = (world.no ?? 0) + 1;
  next.junni = { ...world, ...league, no, free: world.free ?? [], userJoined: false };
  syncJunni(next);
  recordMeijinTitle(next, { no, holderBefore, holder: titleWinner });
  for (const member of Object.values(next.players)) applyDanRules(member);
  writeJunniToMembers(next);
  return { roster: next, result: { no, challenger, holder: titleWinner, changed: titleWinner !== holderBefore } };
}
