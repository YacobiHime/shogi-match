// 棋士の1年の「棋士人生の目標」(docs/pro-year-design.mdの27章)。
// 年度の目標(pro-week.mjsのGOAL_DEFS)とは別に、何年度も遊ぶあいだ置いておく長い目当て。
// 画面・保存の仕組みに依存しない。数はpro-year.mjsのcareerGoalsが集めて渡す。

/** 目標の道(段を順に越える)。announceFromより下の段は、ほかの札(タイトル獲得・優勝・昇段・○冠)がもう祝うので札を出さない。 */
export const CAREER_TRACKS = Object.freeze([
  Object.freeze({ id: 'wins', label: '通算勝数', unit: '勝', tiers: Object.freeze([50, 100, 200, 300, 400, 500, 600, 800, 1000, 1200, 1500]), announceFrom: 50 }),
  Object.freeze({ id: 'titles', label: 'タイトル通算', unit: '期', tiers: Object.freeze([1, 3, 5, 10, 20, 30, 50, 70, 100]), announceFrom: 3 }),
  Object.freeze({ id: 'crowns', label: '同時に持つタイトル', unit: '冠', tiers: Object.freeze([2, 3, 4, 5, 6, 7, 8]), announceFrom: Infinity }),
  Object.freeze({ id: 'cups', label: '棋戦優勝', unit: '回', tiers: Object.freeze([1, 3, 5, 10, 20, 30, 50]), announceFrom: 3 }),
  Object.freeze({ id: 'dan', label: '段位', unit: '', tiers: Object.freeze([1, 2, 3, 4, 5]), announceFrom: Infinity }),
]);

/** いちばん上の目標。 */
export const ULTIMATE_GOAL = '永世八冠';

const NUMERALS = ['', '一', '二', '三', '四', '五', '六', '七', '八'];
const DANS = ['四段', '五段', '六段', '七段', '八段', '九段'];

/** 段の名前(「通算300勝」「タイトル通算10期」「三冠」など)。 */
export function tierLabel(trackId, target) {
  if (trackId === 'wins') return `通算${target}勝`;
  if (trackId === 'titles') return target === 1 ? 'タイトル初獲得' : `タイトル通算${target}期`;
  if (trackId === 'crowns') return target >= 8 ? '八冠（全冠制覇）' : `${NUMERALS[target] ?? target}冠`;
  if (trackId === 'cups') return target === 1 ? '棋戦初優勝' : `棋戦優勝${target}回`;
  if (trackId === 'dan') return DANS[target] ?? '';
  return String(target);
}

/** 今の値の言葉。 */
function valueText(track, value) {
  if (track.id === 'dan') return DANS[value] ?? '四段';
  if (track.id === 'crowns') return value >= 2 ? `最高${NUMERALS[value] ?? value}冠` : value === 1 ? '最高1つ' : 'まだ';
  return `${value}${track.unit}`;
}

/** 段位の名前を道の値(四段=0〜九段=5)にする。 */
export const danValue = (dan) => Math.max(0, DANS.indexOf(dan));

/**
 * 1つの道の進み具合。
 * @param {typeof CAREER_TRACKS[number]} track
 * @param {number} value
 */
export function trackProgress(track, value) {
  const v = Math.max(0, Number(value) || 0);
  const cleared = track.tiers.filter((target) => v >= target);
  const nextTarget = track.tiers.find((target) => v < target) ?? null;
  const prev = cleared.at(-1) ?? 0;
  const ratio = nextTarget === null ? 1 : Math.min(1, Math.max(0, (v - prev) / (nextTarget - prev)));
  const left = nextTarget === null ? 0 : nextTarget - v;
  const leftText = nextTarget === null ? '' : track.id === 'dan' ? 'これから' : track.id === 'crowns' ? `あと${left}つ` : `あと${left}${track.unit}`;
  return {
    id: track.id,
    label: track.label,
    value: v,
    valueText: valueText(track, v),
    cleared: cleared.length,
    tiers: track.tiers.length,
    last: cleared.length ? tierLabel(track.id, prev) : '',
    next: nextTarget === null ? null : { target: nextTarget, label: tierLabel(track.id, nextTarget), left, leftText },
    ratio,
    done: nextTarget === null,
  };
}

/**
 * 棋士人生の目標の全体(成績のタブと目標のシート)。
 * @param {{ wins: number, titles: number, crowns: number, cups: number, dan: string,
 *   eternal: { id: string, short: string, name?: string, reached: boolean, text: string }[] }} input
 */
export function careerGoalsFrom(input) {
  const values = { wins: input.wins, titles: input.titles, crowns: input.crowns, cups: input.cups, dan: danValue(input.dan) };
  const tracks = CAREER_TRACKS.map((track) => trackProgress(track, values[track.id]));
  const eternal = input.eternal ?? [];
  const count = eternal.filter((item) => item.reached).length;
  const ultimate = {
    label: ULTIMATE_GOAL,
    count,
    total: eternal.length,
    done: eternal.length > 0 && count >= eternal.length,
    titles: eternal,
    text: count >= eternal.length && eternal.length ? `${ULTIMATE_GOAL}達成` : `永世称号 ${count}/${eternal.length}`,
  };
  // いちばん近い次の段(シートの1行と上の帯)。割合が大きいもの、同じなら残りが少ないもの。
  const nearest = tracks.filter((track) => track.next).sort((a, b) => b.ratio - a.ratio || (a.next?.left ?? 0) - (b.next?.left ?? 0))[0] ?? null;
  return { ultimate, tracks, nearest };
}

/**
 * 越えた段の印と、新しく越えた段(札を出すもの)。marksがない(前の版の保存)ときは、今の値で黙って印を付ける。
 * @param {Record<string, number> | undefined} marks 道ごとの越えた段の目標の値
 * @param {{ id: string, value: number }[]} tracks
 * @returns {{ marks: Record<string, number>, fresh: { id: string, target: number, label: string }[] }}
 */
export function crossedTiers(marks, tracks) {
  const silent = !marks;
  const next = { ...(marks ?? {}) };
  const fresh = [];
  for (const progress of tracks) {
    const track = CAREER_TRACKS.find((item) => item.id === progress.id);
    if (!track) continue;
    const reached = track.tiers.filter((target) => progress.value >= target).at(-1) ?? 0;
    const before = next[track.id] ?? 0;
    if (reached <= before) continue;
    next[track.id] = reached;
    // 1度に何段も越えたら、いちばん上の段だけ祝う。
    if (!silent && reached >= track.announceFrom) fresh.push({ id: track.id, target: reached, label: tierLabel(track.id, reached) });
  }
  return { marks: next, fresh };
}

/** 達成の札のやこび姫の一言。 */
export function careerCoachLine(id, target) {
  if (id === 'wins') return target >= 1000 ? `${target}勝！ 将棋の歴史に残る数だよ。` : `${target}勝！ 1局ずつ積み上げた数だね。`;
  if (id === 'titles') return target >= 100 ? 'タイトル100期！ だれも届いたことのない場所だよ。' : `タイトル${target}期！ 次の大台も見えてきたね。`;
  if (id === 'cups') return `優勝${target}回！ 勝ち切る強さが身についてきたね。`;
  return '';
}
