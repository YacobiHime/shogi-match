// 棋士の1年の「世界が反応する」(docs/pro-year-design.mdの14-3の3〜6)。画面に依存しない。
// 週の出来事から将棋ニュースの見出しと記事を作り、記録のランキング・取材・ファンレターを決める。
// 見出しは自分の名前を段つきで書き、負けた週も責めない言い方にする(D:5-4・5-8・7-2)。

/** 見出しにする出来事の強さ(大きいほど先)。 */
export const NEWS_WEIGHT = Object.freeze({
  eternal: 110, crowns: 105, crown: 100, defend: 100, champion: 95, lostTitle: 90, challenge: 85, mainStage: 80, danUp: 79, promote: 78,
  streak: 70, hanane: 65, firstWin: 60, winsMark: 55, kaisetsuDebut: 50, fansMark: 48,
  titleDecided: 40, hananeBig: 35, win: 20, loss: 10, work: 8, world: 1,
});

/** 取材が来る出来事。 */
export const INTERVIEW_KINDS = Object.freeze(['firstWin', 'streak', 'mainStage', 'challenge', 'promote', 'danUp', 'crown', 'defend', 'eternal', 'crowns', 'champion', 'kaisetsuDebut']);

/** ファンレターが届くファンの数。 */
export const FAN_MARKS = Object.freeze([100, 300, 1000, 3000]);

/** 連勝の節目(3・5・7・10、そのあとは5ごと)。 */
export const isStreakMark = (streak) => streak === 3 || streak === 5 || streak === 7 || (streak >= 10 && streak % 5 === 0);
/** 勝ち数の節目(10ごと)。 */
export const isWinsMark = (wins) => wins > 0 && wins % 10 === 0;

const pickBy = (seed, list) => list[Math.abs(Math.trunc(Number(seed) || 0)) % list.length];

/**
 * 1つの出来事の見出し。you は段つきの自分の名前(「やこび四段」)。
 * @param {{ kind: string, [key: string]: any }} event
 * @param {string} you
 */
export function headlineOf(event, you) {
  const e = event;
  switch (e.kind) {
    case 'crown': return `${you}、${e.short}を${e.retake ? '奪還' : '獲得'}`;
    // 防衛・失冠・永世称号・○冠(docs/pro-year-design.mdの19章)。
    case 'defend': return `${you}、${e.short}を防衛${e.streak >= 2 ? ` ${e.streak}連覇` : ''}`;
    case 'lostTitle': return `${e.winner}、${e.short}を奪取 ${you}は失冠`;
    case 'eternal': return `${you}、${e.name}の資格を得る`;
    case 'crowns': return e.count >= 8 ? `${you}、全冠制覇 八冠に` : `${you}、${e.text}に`;
    case 'champion': return `${you}、${e.name}で優勝`;
    case 'challenge': return `${you}、${e.name}の挑戦者に`;
    case 'mainStage': return `${you}、${e.text}`;
    case 'promote': return `${you}、${e.text || '順位戦で昇級'}`;
    case 'danUp': return `${e.name ?? you}、${e.dan}に昇段`;
    case 'streak': return `${you}、${e.streak}連勝${e.where ? `で${e.where}` : ''}`;
    case 'hanane': return e.won ? `${you}、同期対決を制す 天鷺羽音四段に勝利` : `${you}、天鷺羽音四段に惜敗 次の対局へ`;
    case 'firstWin': return `新四段${you.replace(/四段$/, '')}、公式戦で初勝利`;
    case 'winsMark': return `${you}、今年度${e.wins}勝目`;
    case 'kaisetsuDebut': return `${you}、大盤解説デビュー`;
    case 'fansMark': return `${you}のファン、${e.fans}人に`;
    case 'titleDecided': return `${e.name}、${e.winner}が${e.short}を${e.keep ? '防衛' : '獲得'}`;
    case 'hananeBig': return `天鷺羽音四段、${e.text}`;
    case 'win': return `${you}、${e.label}で勝利`;
    case 'loss': return `${you}、${e.label}で惜敗 次へ切り替え`;
    case 'work': return `${you}、${e.text}`;
    default: return e.text ?? '今週の将棋界';
  }
}

/**
 * 週の出来事から見出しの出来事を1つ選ぶ(強い順。同じ強さなら後の出来事)。
 * @param {{ kind: string }[]} events
 */
export function pickHeadline(events) {
  let best = null;
  for (const event of events ?? []) {
    const weight = NEWS_WEIGHT[event.kind] ?? 0;
    if (!best || weight >= (NEWS_WEIGHT[best.kind] ?? 0)) best = event;
  }
  return best;
}

/**
 * 週の将棋ニュース。
 * @param {{ number: number, start: string, end: string, events: any[], lines: string[], you: string, world?: string, quote?: string | null, letter?: any, record?: string, hanane?: string }} input
 */
export function buildNews({ number, start, end, events, lines, you, world = '', quote = null, letter = null, record = '', hanane = '' }) {
  const top = pickHeadline(events);
  const headline = top ? headlineOf(top, you) : world || '今週の将棋界';
  // 記事: 見出しの出来事の言い足しと、取材の答え。
  const lead = [top?.lead ?? '', quote ? `取材に「${quote}」と語った。` : ''].filter(Boolean).join('');
  return {
    number, start, end, headline, lead, lines: (lines ?? []).slice(0, 4), record, letter, hanane,
    kind: top?.kind ?? 'world', mine: Boolean(top && top.kind !== 'world' && top.kind !== 'titleDecided' && top.kind !== 'hananeBig'),
    weight: NEWS_WEIGHT[top?.kind ?? 'world'] ?? 0,
  };
}

/** 年度の見出し(強い順に3本)。 */
export function yearHeadlines(news) {
  return [...(news ?? [])].filter((item) => item.mine).sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0) || (a.number ?? 0) - (b.number ?? 0))
    .slice(0, 3).map((item) => ({ number: item.number, headline: item.headline }));
}

// ---- 記録のランキング(14-3の4)

export const RECORD_KINDS = Object.freeze([
  { id: 'wins', label: '勝数', unit: '勝' },
  { id: 'rate', label: '勝率（10局以上）', unit: '' },
  { id: 'games', label: '対局数', unit: '局' },
  { id: 'streak', label: '連勝', unit: '連勝' },
]);
/** 勝率の部門に入る局数。 */
export const RATE_MIN_GAMES = 10;
const RANK_LIMIT = 10;

const valueOf = (kind, record) => {
  const games = (record.w ?? 0) + (record.l ?? 0);
  if (kind === 'wins') return record.w ?? 0;
  if (kind === 'games') return games;
  if (kind === 'streak') return record.best ?? 0;
  return games >= RATE_MIN_GAMES ? (record.w ?? 0) / games : null;
};
export const recordValueText = (kind, value) => {
  if (value === null || value === undefined) return '';
  if (kind === 'rate') return value.toFixed(3).replace(/^0/, '');
  return `${value}${RECORD_KINDS.find((item) => item.id === kind)?.unit ?? ''}`;
};

/**
 * 1部門のランキング(上位3人と自分。10位の外なら近い目当て)。数え方は年度のまとめの将棋大賞の記録部門と同じ。
 * @param {Record<string, { w: number, l: number, streak?: number, best?: number }>} records
 * @param {string} kind
 * @param {string} userId
 */
export function recordRanking(records, kind, userId) {
  const rows = Object.entries(records ?? {})
    .map(([id, record]) => ({ id, value: valueOf(kind, record) }))
    .filter((row) => row.value !== null && row.value > 0)
    .sort((a, b) => b.value - a.value || String(a.id).localeCompare(String(b.id)));
  // 同じ値は同じ順位。
  let rank = 0;
  let last = null;
  rows.forEach((row, index) => {
    if (row.value !== last) rank = index + 1;
    last = row.value;
    row.rank = rank;
  });
  const top = rows.slice(0, 3);
  const you = rows.find((row) => row.id === userId) ?? null;
  let near = '';
  const tenth = rows[RANK_LIMIT - 1];
  if (!you || you.rank > RANK_LIMIT) {
    const mine = records?.[userId] ?? { w: 0, l: 0 };
    if (kind === 'wins' && tenth) near = `10位まで あと${Math.max(1, tenth.value - (mine.w ?? 0))}勝`;
    else if (kind === 'games' && tenth) near = `10位まで あと${Math.max(1, tenth.value - ((mine.w ?? 0) + (mine.l ?? 0)))}局`;
    else if (kind === 'rate') near = (mine.w ?? 0) + (mine.l ?? 0) < RATE_MIN_GAMES ? `${RATE_MIN_GAMES}局から入る（あと${RATE_MIN_GAMES - ((mine.w ?? 0) + (mine.l ?? 0))}局）` : '10位まで もう少し';
    else if (kind === 'streak' && tenth) near = `10位まで あと${Math.max(1, tenth.value - (mine.best ?? 0))}連勝`;
  }
  return { kind, top, you: you && you.rank <= RANK_LIMIT ? you : null, near };
}

// ---- 取材(14-3の5)

const QUESTIONS = Object.freeze({
  firstWin: '公式戦の初勝利、おめでとうございます。いまの気持ちは？',
  streak: '連勝が続いています。いまの手ごたえは？',
  mainStage: '本戦入り、おめでとうございます。目標は？',
  challenge: 'タイトル挑戦、おめでとうございます。番勝負への意気込みを。',
  promote: '昇級、おめでとうございます。来期の目標は？',
  danUp: '昇段、おめでとうございます。いまの気持ちは？',
  crown: 'タイトル獲得、おめでとうございます。いまの気持ちは？',
  defend: '防衛、おめでとうございます。挑戦者の印象は？',
  eternal: '永世称号、おめでとうございます。いまの気持ちは？',
  crowns: 'タイトルを同時にいくつも持つことになりました。いまの気持ちは？',
  champion: '優勝、おめでとうございます。勝因は？',
  kaisetsuDebut: '大盤解説はいかがでしたか？',
});
const ANSWERS = Object.freeze([
  { id: 'bold', label: '意気込み', icon: '強', lines: ['次は羽音さんにも勝ちます', 'もっと上を目指します', 'まだまだ通過点です'] },
  { id: 'thanks', label: '感謝', icon: '謝', lines: ['研究会の仲間のおかげです', '応援してくれる人のおかげです', '支えてくれた皆さんのおかげです'] },
  { id: 'fun', label: 'ひとこと面白く', icon: '笑', lines: ['勝った日は、毎朝カレーです', '対局の前は、猫の動画を見ます', '勝負メシの力です'] },
]);
/** 取材に答えたときに増えるファン。 */
export const INTERVIEW_FANS = 15;

/**
 * 出来事から取材の依頼を作る(答えは種で決める)。
 * @param {{ kind: string }} event
 * @param {number} seed
 */
export function interviewFor(event, seed) {
  if (!INTERVIEW_KINDS.includes(event?.kind)) return null;
  return {
    kind: event.kind,
    reporter: pickBy(seed, ['将棋新報の記者', '将棋ウィークリーの記者', 'テレビ局の記者']),
    question: QUESTIONS[event.kind],
    answers: ANSWERS.map((answer, index) => ({ id: answer.id, label: answer.label, icon: answer.icon, text: pickBy(seed + index * 7, answer.lines) })),
  };
}

// ---- ファンレター(14-3の6)

const LETTERS = Object.freeze({
  100: [
    { from: '小学3年生のゆうと', text: 'テレビで初勝利を見ました。ぼくも将棋教室に通いはじめました。' },
    { from: '中学生のさくら', text: '新聞で名前を見つけました。同じ戦法を指してみたいです。' },
  ],
  300: [
    { from: '港町の将棋道場の席主', text: '道場のみんなで応援しています。いつか指導に来てください。' },
    { from: '定年後に将棋を始めた男性', text: '毎週の結果を楽しみにしています。私も初段を目指します。' },
  ],
  1000: [
    { from: '羽音のファンの高校生', text: '羽音さんとの対局、どちらも応援しています。名勝負をまた見たいです。' },
    { from: '入院中のおばあさん', text: '中継を見るのが毎週の楽しみです。元気をもらっています。' },
  ],
  3000: [
    { from: '将棋部の部長', text: '部員みんなで棋譜を並べています。あの寄せは忘れられません。' },
    { from: '海外のファン', text: 'I watch every game. Your shogi is beautiful. 応援しています。' },
  ],
});

/**
 * ファンの数がまたいだ節目の手紙。
 * @param {number} before
 * @param {number} after
 * @param {number} seed
 */
export function fanLettersBetween(before, after, seed) {
  return FAN_MARKS.filter((mark) => before < mark && after >= mark).map((mark) => ({ mark, ...pickBy(seed + mark, LETTERS[mark]) }));
}

/** 次の手紙までのファンの数(全部届いたらnull)。 */
export function nextLetter(fans) {
  const mark = FAN_MARKS.find((value) => value > (fans ?? 0));
  return mark ? { mark, need: mark - (fans ?? 0) } : null;
}
