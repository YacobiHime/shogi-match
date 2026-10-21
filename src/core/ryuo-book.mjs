// 棋士名鑑。名簿から、画面に出す一覧とプロフィールを作る。画面に依存しない。

import { describeCharacter, specialAbilityChips } from './player-character.mjs';
import { ABILITIES, abilityRank, abilityTypeLabel, abilityValues } from './player-abilities.mjs';
import { proOpening, staticShare, usageRows } from './opening-usage.mjs';
import { HOW_LABELS } from './ryuo-simulation.mjs';
import { repertoireText } from './ryuo-repertoire.mjs';
import { OTHER_TITLES, awardLabel, careerSummary, titleLabel, winRate } from './ryuo-league.mjs';
import { characterCatchphrase } from './ryuo-oshi.mjs';
import { styleEntry } from './ryuo-repertoire.mjs';
import { HANANE, STORY_PEOPLE, YOSHIHIKO } from './ryuo-story.mjs';

/** 基本の居飛車は、どの居飛車の戦法にも付くので、結びつきには使わない。 */
const GENERIC_STRATEGIES = new Set(['ibisha']);

/**
 * 棋士の得意戦法が使う、定跡図鑑の戦法・囲いのID。コレクション(組んだ形)との結びつきに使う。
 * @returns {{ kind: 'strategy' | 'castle', id: string }[]}
 */
export function memberFormations(member) {
  const result = [];
  for (const styleId of member?.repertoire?.styles ?? []) {
    const style = styleEntry(styleId);
    if (style.strategy && !GENERIC_STRATEGIES.has(style.strategy)) result.push({ kind: 'strategy', id: style.strategy });
    if (style.castle) result.push({ kind: 'castle', id: style.castle });
  }
  return result.filter((entry, index) => result.findIndex(({ kind, id }) => kind === entry.kind && id === entry.id) === index);
}

/**
 * その戦法・囲いを得意にしている棋士(上の組から)。プレイヤーが組んだ形から、名鑑の棋士へつなぐのに使う。
 * @returns {{ id: string, name: string, group: number }[]}
 */
export function formationFans(roster, { kind, id }, limit = 3) {
  if (!roster) return [];
  return Object.values(roster.players)
    .filter((member) => memberFormations(member).some((entry) => entry.kind === kind && entry.id === id))
    .sort((a, b) => a.group - b.group || a.name.localeCompare(b.name, 'ja'))
    .slice(0, limit)
    .map(({ id: memberId, name, group }) => ({ id: memberId, name, group }));
}

const KIND_LABELS = Object.freeze({ pro: '棋士', woman: '女流棋士', amateur: 'アマチュア', shoreikai: '奨励会員' });

const rateText = (record) => {
  const rate = record ? winRate(record) : null;
  return rate === null ? '' : `勝率${rate.toFixed(3).replace(/^0/, '')}`;
};

/** プレイヤーとの対戦成績の言葉。 */
export function vsUserText(vsUser) {
  if (!vsUser) return 'まだ対戦していない';
  const streak = vsUser.streak > 1 ? `(あなたの${vsUser.streak}連勝中)` : vsUser.streak < -1 ? `(あなたの${-vsUser.streak}連敗中)` : '';
  return `あなたの${vsUser.wins}勝${vsUser.losses}敗${streak}`;
}

/** 勝ち方の短い言葉(名鑑の統計)。 */
const HOW_SHORT = Object.freeze({ opening: '序盤のリード', middle: '中盤の抜け出し', ending: '終盤の競り合い', comeback: '逆転', recover: '序盤の不利から挽回' });

const percentText = ([wins, losses]) => (wins + losses ? `${wins}勝${losses}敗（${Math.round((wins / (wins + losses)) * 100)}%）` : '');

/**
 * 能力値・特殊能力・使用率(名鑑と、次の相手の札で共通)。棋士の写し(期の棋士)でも、名簿の棋士でもよい。
 * @param {any} member
 */
export function memberAbilityView(member) {
  if (!member?.character?.abilities) return null;
  const values = abilityValues(member);
  const totalOpenings = member.record?.total?.byOpening ?? {};
  const usage = member.repertoire?.usage ?? null;
  return {
    abilities: ABILITIES.map(({ key, label, hint }) => ({ key, label, hint, value: values[key], rank: abilityRank(values[key]) })),
    type: abilityTypeLabel(member),
    specials: specialAbilityChips(member.character),
    staticShare: usage ? staticShare(usage) : null,
    openings: usageRows(usage).slice(0, 6).map((row) => ({
      ...row,
      record: totalOpenings[row.id] && totalOpenings[row.id][0] + totalOpenings[row.id][1] >= 3 ? percentText(totalOpenings[row.id]) : '',
    })),
  };
}

/** 成績の内訳(先手・後手、戦法ごと、勝ち方)。記録が始まる前(版3より前)の対局は数えない。 */
export function memberStats(member) {
  const total = member?.record?.total ?? {};
  const season = member?.record?.season ?? {};
  const color = (bucket, side) => (bucket.byColor ? percentText(bucket.byColor[side]) : '');
  const hows = (bucket) => Object.entries(bucket.hows ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([how, count]) => `${HOW_SHORT[how] ?? HOW_LABELS[how] ?? how} ${count}`);
  const best = Object.entries(total.byOpening ?? {})
    .filter(([, [wins, losses]]) => wins + losses >= 5)
    .map(([id, [wins, losses]]) => ({ label: proOpening(id)?.label ?? id, rate: wins / (wins + losses), wins, losses }))
    .sort((a, b) => b.rate - a.rate)[0] ?? null;
  return {
    blackTotal: color(total, 'black'),
    whiteTotal: color(total, 'white'),
    blackSeason: color(season, 'black'),
    whiteSeason: color(season, 'white'),
    howsTotal: hows(total),
    bestOpening: best ? `${best.label}（${best.wins}勝${best.losses}敗）` : '',
  };
}

/** 1人分のプロフィール。 */
export function memberProfile(roster, member) {
  const career = careerSummary(roster, member);
  const character = describeCharacter(member.character ?? null);
  const vsUser = roster.vsUser?.[member.id] ?? null;
  const season = member.record?.season;
  return {
    id: member.id,
    name: member.name,
    dan: member.dan,
    kind: KIND_LABELS[member.kind] ?? member.kind,
    age: member.age,
    group: member.group,
    ryuoHolder: roster.holder === member.id,
    junni: career.junni,
    held: career.held,
    former: career.former,
    titleCounts: career.titleCounts,
    totalTitles: career.totalTitles,
    repertoire: repertoireText(member.repertoire),
    style: character.style,
    // 一覧の行にも出す、個性の一言(棋風と、いちばん目立つ特徴)。物語の人物は、立場の一言。
    catchphrase: member.story === HANANE ? 'ライバル' : member.story === YOSHIHIKO ? '羽音の父・史上最強' : characterCatchphrase(character),
    // 物語の人物(core/ryuo-story.mjs)。読みと紹介の文を、名鑑のくわしい情報に出す。
    story: member.story ?? null,
    reading: STORY_PEOPLE[member.story]?.reading ?? '',
    intro: STORY_PEOPLE[member.story]?.intro ?? '',
    formations: memberFormations(member),
    strengths: character.strengths,
    weaknesses: character.weaknesses,
    lastSeason: season && season.games ? `${season.wins}勝${season.losses}敗 ${rateText(season)}` : '',
    total: member.record ? `${member.record.total.wins}勝${member.record.total.losses}敗 ${rateText(member.record.total)}` : '',
    awards: career.awards.map(({ no, label }) => `${no > 0 ? `第${no}期` : ''}${label}`),
    vsUser: vsUserText(vsUser),
    played: Boolean(vsUser),
    ability: memberAbilityView(member),
    stats: memberStats(member),
  };
}

const DAN_RANK = ['九段', '八段', '七段', '六段', '五段', '四段'];

/**
 * 名鑑の全体。タイトル保持者、前年度の将棋大賞、組ごとの棋士(タイトルの多い順・段位順)。
 * @returns {{ holders: { title: string, name: string }[], awards: { label: string, name: string }[], groups: { group: number, members: ReturnType<typeof memberProfile>[] }[], season: number }}
 */
export function rosterBook(roster) {
  if (!roster) return null;
  const holderName = (id) => (id === 'user' ? 'あなた' : roster.players[id]?.name ?? '—');
  const holders = [
    { title: '竜王', name: holderName(roster.holder) },
    ...OTHER_TITLES.map(({ id }) => ({ title: titleLabel(id), name: holderName(roster.titles?.[id]) })),
  ];
  const lastNo = roster.lastYear?.no ?? null;
  const awards = (roster.awards ?? []).filter(({ no }) => no === lastNo).map(({ id, name }) => ({ label: awardLabel(id), name }));
  // ライバルは、組のいちばん上に出す(竜王を除く)。
  const order = (a, b) => Number(b.ryuoHolder) - Number(a.ryuoHolder)
    || Number(b.story === HANANE) - Number(a.story === HANANE)
    || b.held.length - a.held.length
    || b.totalTitles - a.totalTitles
    || DAN_RANK.indexOf(a.dan) - DAN_RANK.indexOf(b.dan)
    || a.name.localeCompare(b.name, 'ja');
  const groups = [1, 2, 3, 4, 5, 6].map((group) => ({
    group,
    members: Object.values(roster.players).filter((member) => member.group === group).map((member) => memberProfile(roster, member)).sort(order),
  }));
  return { holders, awards, groups, season: roster.season };
}
