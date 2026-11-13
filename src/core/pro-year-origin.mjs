// 奨励会から棋士の1年へ(docs/pro-year-design.mdの18章)。画面と保存の仕組みに依存しない。
// 奨励会の四段の記録(shoreikai.mjsのcloseShoreikaiRunが残すcareer.pro)から、棋士の1年のはじまり(origin)と
// デビューの日を決め、デビューの場面・棋士の歩み・やこびノートの札に出す言葉を作る。
//
// 三段リーグの期は、奨励会の世界の月(world.month。0を1月とみなす)で半年ごとに締まる。
// 第1期(羽音が四段になる期)は3月に終わる後期、第2期は9月に終わる前期、と交互になる。
// 実物と同じく、後期(3月)で四段になったら4月1日に、前期(9月)で四段になったら10月1日にデビューする。

/** デビューの季節。spring: 後期の三段リーグ→4月1日、autumn: 前期の三段リーグ→10月1日。 */
export const DEBUT_SEASONS = Object.freeze({
  spring: Object.freeze({ id: 'spring', month: 4, label: '4月1日', term: '後期' }),
  autumn: Object.freeze({ id: 'autumn', month: 10, label: '10月1日', term: '前期' }),
});

/** 三段リーグの期の番号から、デビューの季節(奇数は後期で春、偶数は前期で秋)。 */
export const seasonOfTerm = (term) => (Number.isInteger(Number(term)) && Number(term) > 0 && Number(term) % 2 === 0 ? 'autumn' : 'spring');

const text = (value) => (typeof value === 'string' ? value : '');
const count = (value) => (Number.isFinite(Number(value)) ? Math.max(0, Math.round(Number(value))) : null);

/**
 * 奨励会の四段の記録(career.pro)から、棋士の1年のはじまり。記録がなければnull。
 * 前の版の記録(期の番号を持たない)は、春のデビューにする。
 * @param {any} pro shoreikai.mjsのcareer.pro
 * @returns {null | {
 *   kind: 'shoreikai', kishiNumber: number | null, entry: string, mentor: string, games: number | null, wins: number | null, losses: number | null,
 *   term: number | null, place: number | null, byJiten: boolean, leagueTerms: number | null, peers: string[], season: 'spring' | 'autumn',
 * }}
 */
export function shoreikaiOrigin(pro) {
  if (!pro || typeof pro !== 'object') return null;
  const term = count(pro.term);
  return {
    kind: 'shoreikai',
    kishiNumber: count(pro.kishiNumber),
    entry: text(pro.entry),
    mentor: text(pro.mentor),
    games: count(pro.games),
    wins: count(pro.wins),
    losses: count(pro.losses),
    term: term || null,
    place: count(pro.place) || null,
    byJiten: Boolean(pro.byJiten),
    leagueTerms: count(pro.leagueTerms) || null,
    peers: Array.isArray(pro.peers) ? pro.peers.filter((name) => typeof name === 'string' && name).slice(0, 2) : [],
    season: term ? seasonOfTerm(term) : 'spring',
  };
}

/**
 * デビューの日と年度。春は今の年度の4月1日。秋は前の年度の10月1日から(1年目は3月までの半年。
 * 次の年度は今の年度になり、ふつうの入口と同じ年度を丸ごと指す)。
 * 羽音は奨励会で先に四段になっているので、秋のデビューでも、その年度の4月1日から棋戦に出る(rivalDebut)。
 * @param {ReturnType<typeof shoreikaiOrigin>} origin
 * @param {number} currentFy 今日の年度
 */
export function originDebut(origin, currentFy) {
  const fy = Number(currentFy);
  if (origin?.season === 'autumn') {
    return { fiscalYear: fy - 1, debut: `${fy - 1}-10-01`, rivalDebut: `${fy - 1}-04-01`, half: true, label: DEBUT_SEASONS.autumn.label };
  }
  return { fiscalYear: fy, debut: `${fy}-04-01`, rivalDebut: `${fy}-04-01`, half: false, label: DEBUT_SEASONS.spring.label };
}

/** 「第3期三段リーグ1位で四段」のような、四段になった期の言葉(期の番号がなければ「三段リーグを抜けて四段」)。 */
function leagueText(origin) {
  if (!origin?.term) return '三段リーグを抜けて四段';
  if (origin.byJiten) return `第${origin.term}期三段リーグで2回目の次点、四段`;
  return `第${origin.term}期三段リーグ${origin.place ? `${origin.place}位` : ''}で四段`;
}

/**
 * 画面の言葉(入口の札・棋士の歩み・ノートの札)。
 * @param {ReturnType<typeof shoreikaiOrigin>} origin
 */
export function originText(origin) {
  if (!origin) return null;
  const season = DEBUT_SEASONS[origin.season] ?? DEBUT_SEASONS.spring;
  const number = origin.kishiNumber ? `棋士番号第${origin.kishiNumber}号` : '';
  const record = origin.games ? `${origin.games}局${origin.wins !== null && origin.losses !== null ? `（${origin.wins}勝${origin.losses}敗）` : ''}` : '';
  return {
    title: '奨励会から',
    number,
    debut: season.label,
    // 入口の札の1行と、季節の一言(秋は1年目が半年)。
    chip: [number, `${season.label}デビュー`].filter(Boolean).join('・'),
    note: origin.season === 'autumn'
      ? '1年目は10月から3月までの半年。最初の公式戦は12月の竜王戦で、順位戦は次の4月から指すよ。'
      : '4月1日から、1年度まるごと指すよ。',
    // 棋士の歩みの奨励会の行。
    road: `${[origin.entry ? `${origin.entry}で入会` : '', leagueText(origin)].filter(Boolean).join(' → ')}${number ? `（${number}）` : ''}`,
    detail: [record ? `奨励会 ${record}` : '', origin.mentor ? `師匠 ${origin.mentor}` : ''].filter(Boolean).join('・'),
    // やこびノートの札。
    noteLine: `奨励会から${number ? `（${number}）` : ''}・${season.label}デビュー`,
  };
}

/**
 * デビューの場面(pro-year-story.mjsの'pro-debut-shoreikai')に差し込む言葉。空の言葉は、場面の既定の言葉になる。
 * @param {ReturnType<typeof shoreikaiOrigin>} origin
 */
export function originSceneVars(origin) {
  if (!origin) return {};
  const season = DEBUT_SEASONS[origin.season] ?? DEBUT_SEASONS.spring;
  return {
    date: season.label,
    kishi: origin.kishiNumber ? `棋士番号は、第${origin.kishiNumber}号。` : '',
    mentor: origin.mentor ? `師匠の${origin.mentor}` : '',
    peers: origin.peers.length ? origin.peers.map((name) => `${name}さん`).join('と') : '',
    half: origin.season === 'autumn' ? '最初の1年は半年だけ。順位戦は、次の4月から始まる。' : '',
  };
}
