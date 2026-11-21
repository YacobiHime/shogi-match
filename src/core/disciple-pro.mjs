// 師匠の1年(docs/disciple-mode-design.mdの31章)の、四段になった弟子のデビューと恩返し。
// 一門の弟子のうち四段になった人を、竜王戦・名人戦の棋士の名簿(ryuo-roster.mjs)に新四段として入れる(6組・C級2組)。
// 大会で師匠(プレイヤー)と弟子が当たり、弟子が勝てば「恩返し」。画面と保存に依存しない。

import { STAT_KEYS } from './disciple-strength.mjs';
import { addNamedPro } from './ryuo-roster.mjs';

/** 新四段のレーティング(名簿の新四段は1430前後。能力が高い弟子ほど、少し上から始める)。 */
export const DEBUT_RATING = Object.freeze({ base: 1430, bonus: 90, from: 900, span: 300 });

const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));

/** 名簿にまだ入っていない、四段になった一門の弟子。 */
export const pendingDebuts = (ichimon) => (ichimon?.members ?? []).filter((member) => member.kind === 'pro' && !member.rosterId);

/** 羽音の弟子の新四段のレーティング(32章。羽音の弟子は、名簿の新四段の真ん中から)。 */
export const RIVAL_DEBUT_RATING = 1450;

/** 名簿にまだ入っていない、四段になった羽音の弟子の行(一門で1人だけ。すでに入っていればnull)。 */
export const pendingRivalDebut = (ichimon) => (ichimon?.rival?.rosterId ? null : (ichimon?.members ?? []).find((member) => member.rivalPro && member.rivalName) ?? null);

/** 弟子の新四段のレーティング。 */
export function debutRating(entry) {
  const mean = STAT_KEYS.reduce((sum, key) => sum + (Number(entry.stats?.[key]) || 0), 0) / STAT_KEYS.length;
  return Math.round(DEBUT_RATING.base + DEBUT_RATING.bonus * clamp((mean - DEBUT_RATING.from) / DEBUT_RATING.span, 0, 1));
}

/**
 * 四段になった弟子を名簿に入れる(まだ入っていない人だけ。名簿と一門の新しい写しと、入った人の名前を返す)。
 * @param {any} roster 竜王戦・名人戦の棋士の名簿(なければ何もしない)
 * @param {{ version: number, members: any[], rival?: any }} ichimon
 */
export function debutDisciples(roster, ichimon) {
  const debuts = pendingDebuts(ichimon);
  const rivalEntry = pendingRivalDebut(ichimon);
  if (!roster || (!debuts.length && !rivalEntry)) return { roster, ichimon, debuts: [] };
  let next = roster;
  const members = ichimon.members.map((member) => ({ ...member }));
  const names = [];
  for (const entry of debuts) {
    const seed = [...String(entry.id)].reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0, 0x811c9dc5);
    const added = addNamedPro(next, {
      seed, name: entry.name, rating: debutRating(entry), age: clamp(Number(entry.age) || 20, 15, 29),
      tag: { disciple: { ichimonId: entry.id, discipleId: entry.discipleId } },
    });
    next = added.roster;
    const target = members.find((member) => member.id === entry.id);
    if (target) Object.assign(target, { rosterId: added.id, debutSeason: Number(roster.season) || 0 });
    names.push(entry.name);
  }
  // 羽音の弟子(32章)。弟子の印は付けず、羽音の弟子の印を付ける。
  let rival = ichimon.rival ?? null;
  if (rivalEntry) {
    const added = addNamedPro(next, {
      seed: 0x6e696d75 ^ (Number(rivalEntry.id) || 0), name: rivalEntry.rivalName, rating: RIVAL_DEBUT_RATING, age: clamp(Number(rivalEntry.age) || 20, 15, 29),
      tag: { rivalDisciple: { master: '羽音' } },
    });
    next = added.roster;
    rival = { name: rivalEntry.rivalName, rosterId: added.id, from: rivalEntry.id, debutSeason: Number(roster.season) || 0 };
    names.push(rivalEntry.rivalName);
  }
  return { roster: next, ichimon: { ...ichimon, members, ...(rival ? { rival } : {}) }, debuts: names };
}

/**
 * 大会の1局の相手が弟子なら、恩返し(弟子の勝ち)か師匠の壁(師匠の勝ち)の一言。弟子でなければ空。
 * @param {any} opponent 名簿・期の棋士(discipleの印を持つ)
 * @param {boolean} masterWon プレイヤー(師匠)が勝ったか
 */
export function ongaeshiLine(opponent, masterWon) {
  if (!opponent?.disciple) return '';
  return masterWon ? `弟子の${opponent.name}を退けた。師匠の壁は、まだ高い` : `弟子の${opponent.name}に敗れた。恩返しの一局になった`;
}

/**
 * 師匠と弟子の対戦を一門の名簿に数える(恩返しは弟子がはじめて勝った日)。
 * @param {{ version: number, members: any[] }} ichimon
 * @param {string} ichimonId
 * @param {boolean} masterWon
 */
export function noteMasterGame(ichimon, ichimonId, masterWon) {
  const members = ichimon.members.map((member) => {
    if (member.id !== ichimonId) return member;
    const vs = { wins: member.vsMaster?.wins ?? 0, losses: member.vsMaster?.losses ?? 0 };
    if (masterWon) vs.losses += 1;
    else vs.wins += 1;
    return { ...member, vsMaster: vs, ongaeshi: member.ongaeshi || !masterWon };
  });
  return { ...ichimon, members };
}
