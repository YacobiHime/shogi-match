// 棋士名鑑。名簿から、画面に出す一覧とプロフィールを作る。画面に依存しない。

import { describeCharacter } from './player-character.mjs';
import { repertoireText } from './ryuo-repertoire.mjs';
import { OTHER_TITLES, awardLabel, careerSummary, titleLabel, winRate } from './ryuo-league.mjs';

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
    strengths: character.strengths,
    weaknesses: character.weaknesses,
    lastSeason: season && season.games ? `${season.wins}勝${season.losses}敗 ${rateText(season)}` : '',
    total: member.record ? `${member.record.total.wins}勝${member.record.total.losses}敗 ${rateText(member.record.total)}` : '',
    awards: career.awards.map(({ no, label }) => `${no > 0 ? `第${no}期` : ''}${label}`),
    vsUser: vsUserText(vsUser),
    played: Boolean(vsUser),
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
  const order = (a, b) => Number(b.ryuoHolder) - Number(a.ryuoHolder)
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
