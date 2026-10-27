// タイトル戦の二日制(docs/title-match-day-design.md)。1日目のまとめ・控室の声・封じ手の開封・勝負メシ・観戦記。
// 画面に依存しない。手の言葉(▲4五歩など)は画面が作って渡す。

/** 勝負メシの札を出す手数。この手数を越えた最初の自分の手番で出す。 */
export const LUNCH_PLY = 20;
/** 札が出てから、選ばずにこの手数を指したら「おまかせ」(1品目)を運ぶ(docs/title-match-day-design.mdの8章)。 */
export const LUNCH_WAIT_PLIES = 6;
/** 選んでからこの手数で、控室に「注文が相次いでいます」の声が出る。 */
export const LUNCH_RUSH_PLIES = 4;
/** 勝負メシ帳(対局場ごとの食べた回数と勝った回数)の保存。 */
export const MEAL_BOOK_KEY = 'yacobihime:shogi-match:meal-book:v1';
/** 1手の考えた時間の上限(置きっぱなしで記録がゆがまないように)。 */
export const THINK_CAP_MS = 10 * 60 * 1000;
/** 観戦記を残す局数(新しい順)。 */
export const KANSENKI_LIMIT = 30;
export const KANSENKI_KEY = 'yacobihime:shogi-match:kansenki:v1';

/** 対局場ごとの勝負メシ(3品。1品目は「おまかせ」)。対局場はmatch-stage.mjsのSTAGE_VENUES。 */
export const STAGE_MEALS = Object.freeze({
  '東京・庭園のある料亭': ['うな重', '天ぷらそば', '親子丼'],
  '京都・古いお寺の大広間': ['湯豆腐御膳', 'にしんそば', 'カレーうどん'],
  '福岡・海の見えるホテル': ['博多ラーメン', '明太子パスタ', 'ちゃんぽん'],
  '北海道・湖のほとりの宿': ['海鮮丼', '味噌ラーメン', 'ジンギスカン定食'],
  '山形・桜の城下町の旅館': ['牛肉のすき焼き重', '冷たい肉そば', '芋煮定食'],
  '静岡・富士山の見えるホテル': ['桜えびのかき揚げ丼', 'ひつまぶし', '富士宮やきそば'],
  '鹿児島・湯けむりの宿': ['黒豚とんかつ定食', '鶏飯', 'さつま揚げ定食'],
  '新潟・雪見の宿': ['へぎそば', 'のどぐろ御膳', 'タレカツ丼'],
  '石川・茶室のある料亭': ['治部煮御膳', '金沢カレー', '海鮮ちらし'],
  '大阪・お城の見える料亭': ['きつねうどん', 'お好み焼き定食', '串カツ定食'],
  '奈良・古いお寺の書院': ['柿の葉寿司', '三輪そうめん', '茶粥御膳'],
  '広島・瀬戸内の島の宿': ['穴子めし', '牡蠣フライ定食', 'お好み焼き'],
  '宮城・松島をのぞむ宿': ['牛たん定食', '牡蠣丼', 'はらこめし'],
  '長野・高原のホテル': ['信州そば', 'ソースカツ丼', 'おやき定食'],
});
const DEFAULT_MEALS = Object.freeze(['幕の内弁当', 'ざるそば', 'カツカレー']);

/** 駒の損得の言い方の境目(AI_PIECE_POINTSの点数。歩が90、角が855)。 */
const MATERIAL_EVEN = 150;
const MATERIAL_BIG = 800;

/** 観戦記者(架空)。 */
const REPORTERS = Object.freeze(['青柳', '森田', '高瀬', '小野寺', '宮内']);

function hashText(text) {
  let hash = 2166136261;
  for (const char of String(text)) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** 対局場の勝負メシの献立。 */
export function lunchMenu(venue) {
  return [...(STAGE_MEALS[venue] ?? DEFAULT_MEALS)];
}

/** 相手の勝負メシ(対局場と相手で決まる)。 */
export function opponentMeal(venue, opponentId) {
  const menu = lunchMenu(venue);
  return menu[hashText(`${venue}:${opponentId}`) % menu.length];
}

// ---- 勝負メシのその後(docs/title-match-day-design.mdの8章)。強さ・助言・時間には効かせない。

/** 料理ごとの一言(やこび姫の「○○、△△だね！」と、札の一言)。 */
export const MEAL_NOTES = Object.freeze({
  うな重: 'スタミナ満点',
  天ぷらそば: 'さくさくの天ぷら',
  親子丼: 'ふわとろの卵',
  湯豆腐御膳: 'やさしい味',
  にしんそば: '京都の名物',
  カレーうどん: '体がぽかぽか',
  博多ラーメン: '細めんのとんこつ',
  明太子パスタ: 'ぴりっと明太子',
  ちゃんぽん: '具だくさん',
  海鮮丼: '海の幸たっぷり',
  味噌ラーメン: 'こくのある味噌',
  ジンギスカン定食: 'お肉でスタミナ満点',
  牛肉のすき焼き重: '甘辛のお肉',
  冷たい肉そば: 'つるつるの冷たいそば',
  芋煮定食: '山形の秋の味',
  桜えびのかき揚げ丼: '香ばしい桜えび',
  ひつまぶし: '3回楽しめる',
  富士宮やきそば: 'もちもちのめん',
  黒豚とんかつ定食: 'ジューシーな黒豚',
  鶏飯: 'さらさら食べられる',
  さつま揚げ定食: '揚げたて',
  へぎそば: 'つるっとしたのどごし',
  のどぐろ御膳: 'とろける白身',
  タレカツ丼: '甘辛のタレ',
  治部煮御膳: '金沢の味',
  金沢カレー: '濃いルー',
  海鮮ちらし: '彩りあざやか',
  きつねうどん: 'おあげが甘い',
  お好み焼き定食: '大阪らしい',
  串カツ定食: 'さくさくの衣',
  柿の葉寿司: '柿の葉の香り',
  三輪そうめん: '細くてつるつる',
  茶粥御膳: 'おなかにやさしい',
  穴子めし: 'ふっくら穴子',
  牡蠣フライ定食: 'ぷりぷりの牡蠣',
  お好み焼き: 'めんが入って食べごたえあり',
  牛たん定食: '歯ごたえばつぐん',
  牡蠣丼: '海のミルク',
  はらこめし: 'いくらがきらきら',
  信州そば: '香り高い',
  ソースカツ丼: 'ソースがしみしみ',
  おやき定食: '素朴な味',
  幕の内弁当: 'いろいろ楽しめる',
  ざるそば: 'さっぱり',
  カツカレー: '勝つカレー',
});

/** 料理の一言(分からない料理は空)。 */
export function mealNote(meal) {
  return MEAL_NOTES[meal] ?? '';
}

/** 選んだ勝負メシへの、やこび姫の一言。 */
export function lunchCoachLine(meal, { auto = false } = {}) {
  if (!meal) return '';
  const note = mealNote(meal);
  const head = auto ? `おまかせで${meal}が来たよ。` : `${meal}、`;
  return note ? `${head}${note}だね！ 午後もがんばろう！` : `${head}おいしそう！ 午後もがんばろう！`;
}

/**
 * 相手の勝負メシの一言(中継の1行)。口調は match-presence.mjs の opponentVoice(棋風・物語の人物)。
 * @param {string} meal 相手の勝負メシ
 * @param {string} voice 'attack' | 'defense' | 'balance' | 'hanane' | 'yoshihiko'
 */
export function lunchOpponentLine(meal, voice) {
  if (!meal) return '';
  if (voice === 'attack') return `${meal}で腹ごしらえ。午後は攻めますよ`;
  if (voice === 'defense') return `${meal}で、じっくり力をためます`;
  // 羽音は敬語を使わない(ryuo-story.mjsのHANANE_LINESと同じ書き方)。
  if (voice === 'hanane') return `……${meal}。午後も負けないから`;
  if (voice === 'yoshihiko') return `${meal}か。ここの名物だよ`;
  return `${meal}、いただきます`;
}

/**
 * 「お昼の休憩」の札の中身。
 * @param {{ meal: string, opponentName: string, opponentMeal: string, auto?: boolean }} input
 */
export function lunchCard({ meal, opponentName, opponentMeal: theirMeal, auto = false }) {
  const same = Boolean(theirMeal) && theirMeal === meal;
  return {
    title: auto ? 'お昼の休憩・おまかせ' : 'お昼の休憩',
    meal,
    note: mealNote(meal),
    other: !theirMeal ? '' : same ? `${opponentName}も 同じ${meal}！` : `${opponentName}は ${theirMeal}`,
    same,
  };
}

/** 選んでから少したって、控室が勝負メシで湧く(中継の1行)。 */
export function lunchRushLine(meal) {
  return meal ? `控室：${meal}の注文が相次いでいます` : '';
}

/** 午後の最初の好手のほめ言葉に添える一言。 */
export function mealPowerLine(meal) {
  return meal ? `${meal}パワーだね！` : '';
}

/** 選ばずに指し続けて、おまかせを運ぶときか(札が出てからLUNCH_WAIT_PLIES手)。 */
export function lunchAutoDue(day, ply) {
  return Boolean(day) && !day.meal && !day.seal && ply > LUNCH_PLY + LUNCH_WAIT_PLIES;
}

/** 控室の注文の声を出すときか(選んでからLUNCH_RUSH_PLIES手、封じ手の前、1局1回)。 */
export function lunchRushDue(day, ply) {
  return Boolean(day?.meal) && day.mealAt > 0 && !day.rush && !day.seal && ply >= day.mealAt + LUNCH_RUSH_PLIES;
}

/** 午後のパワーを添えるときか(選んでから封じ手まで、1局1回)。 */
export function mealPowerDue(day) {
  return Boolean(day?.meal) && day.mealAt > 0 && !day.power && !day.seal;
}

// ---- 勝負メシ帳(対局場ごとの食べた回数と勝った回数。勝った局の勝負メシは「勝ちメシ」)

/** 空の勝負メシ帳。venues[対局場][料理] = { eaten, wins } */
export function emptyMealBook() {
  return { venues: {} };
}

/** 保存した勝負メシ帳。読めなければ空。 */
export function loadMealBook(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(MEAL_BOOK_KEY) ?? 'null');
    if (!parsed || typeof parsed !== 'object' || !parsed.venues || typeof parsed.venues !== 'object') return emptyMealBook();
    const venues = {};
    for (const [venue, meals] of Object.entries(parsed.venues)) {
      if (!meals || typeof meals !== 'object') continue;
      const kept = {};
      for (const [meal, entry] of Object.entries(meals)) {
        const eaten = Math.max(0, Math.floor(Number(entry?.eaten) || 0));
        if (eaten) kept[meal] = { eaten, wins: Math.min(eaten, Math.max(0, Math.floor(Number(entry?.wins) || 0))) };
      }
      if (Object.keys(kept).length) venues[venue] = kept;
    }
    return { venues };
  } catch {
    return emptyMealBook();
  }
}

/** 勝負メシ帳を保存する。保存できなくても遊びは止めない。 */
export function saveMealBook(storage, book) {
  try {
    storage?.setItem(MEAL_BOOK_KEY, JSON.stringify(book));
  } catch {
    // 保存できない環境では、この局の勝ちメシだけ見せる。
  }
  return book;
}

/** タイトル戦の1局の勝負メシを記録する(勝った局は勝ちメシ)。 */
export function noteMealBook(book, { venue, meal, win }) {
  if (!venue || !meal) return book;
  const meals = book.venues[venue] ?? {};
  const entry = meals[meal] ?? { eaten: 0, wins: 0 };
  return {
    ...book,
    venues: { ...book.venues, [venue]: { ...meals, [meal]: { eaten: entry.eaten + 1, wins: entry.wins + (win ? 1 : 0) } } },
  };
}

/** この対局場の勝ちメシ(勝った回数が1回以上の料理)。 */
export function winningMeals(book, venue) {
  return Object.entries(book?.venues?.[venue] ?? {}).filter(([, entry]) => entry.wins > 0).map(([meal]) => meal);
}

/**
 * やこびノートの勝負メシ帳。行ったことのある対局場ごとに、献立の3品の状態(win 勝ちメシ / eaten 食べた / new まだ)。
 * 対局場の並びは STAGE_MEALS の順。食べた品の数は、対局場の献立(14か所×3品)のうち。
 */
export function mealBookView(book) {
  const venues = Object.keys(STAGE_MEALS)
    .filter((venue) => book?.venues?.[venue])
    .map((venue) => ({
      venue,
      meals: STAGE_MEALS[venue].map((meal) => {
        const entry = book.venues[venue][meal];
        return { meal, state: entry?.wins ? 'win' : entry?.eaten ? 'eaten' : 'new', wins: entry?.wins ?? 0 };
      }),
    }));
  const meals = venues.flatMap(({ meals: items }) => items);
  return {
    venues,
    tried: meals.filter(({ state }) => state !== 'new').length,
    wins: meals.filter(({ state }) => state === 'win').length,
    total: Object.values(STAGE_MEALS).reduce((sum, items) => sum + items.length, 0),
  };
}

// ---- 記録

/**
 * タイトル戦の1局の記録(対局の保存に入れる)。
 * mealAtは勝負メシを選んだ手数(封じ手で決まったときは0)、powerは午後のパワーを添えたか、rushは控室の注文の声を出したか。
 */
export function emptyDay() {
  return { rates: [], think: [], meal: '', mealAt: 0, power: false, rush: false, seal: null };
}

const pairs = (value) => (Array.isArray(value)
  ? value.filter((item) => Array.isArray(item) && item.length === 2 && item.every(Number.isFinite)).map(([a, b]) => [a, b])
  : []);

/** 保存から戻すときに、形を整える。 */
export function normalizeDay(raw) {
  if (!raw || typeof raw !== 'object') return emptyDay();
  const seal = raw.seal && typeof raw.seal === 'object' && Number.isFinite(raw.seal.ply) && typeof raw.seal.move === 'string'
    ? {
      ply: raw.seal.ply,
      move: raw.seal.move,
      predicted: typeof raw.seal.predicted === 'string' ? raw.seal.predicted : '',
      material: Number.isFinite(raw.seal.material) ? raw.seal.material : 0,
      black: typeof raw.seal.black === 'string' ? raw.seal.black : '',
      white: typeof raw.seal.white === 'string' ? raw.seal.white : '',
    }
    : null;
  return {
    rates: pairs(raw.rates),
    think: pairs(raw.think),
    meal: typeof raw.meal === 'string' ? raw.meal : '',
    mealAt: Number.isFinite(raw.mealAt) && raw.mealAt > 0 ? raw.mealAt : 0,
    power: raw.power === true,
    rush: raw.rush === true,
    seal,
  };
}

/** 手番の勝率(%)を記録する。同じ手数は上書き。 */
export function noteDayRate(day, ply, rate) {
  if (!Number.isFinite(rate)) return day;
  const rates = day.rates.filter(([at]) => at !== ply);
  rates.push([ply, Math.round(rate)]);
  rates.sort((a, b) => a[0] - b[0]);
  return { ...day, rates };
}

/** プレイヤーが指した手(指したあとの手数)の考えた時間を記録する。 */
export function noteDayThink(day, ply, ms) {
  const think = day.think.filter(([at]) => at !== ply);
  think.push([ply, Math.max(0, Math.min(THINK_CAP_MS, Math.round(ms)))]);
  think.sort((a, b) => a[0] - b[0]);
  return { ...day, think };
}

/** 待ったで戻したときは、戻した手数より後の記録を消す。 */
export function trimDay(day, ply) {
  return {
    ...day,
    rates: day.rates.filter(([at]) => at <= ply),
    think: day.think.filter(([at]) => at <= ply),
    seal: day.seal && day.seal.ply > ply ? null : day.seal,
  };
}

// ---- 1日目のまとめ

const sideName = (color) => (color === 'black' ? '先手' : '後手');
const other = (color) => (color === 'black' ? 'white' : 'black');

/** 分と秒の言葉(「4分」「40秒」)。 */
export function thinkText(ms) {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}秒`;
  return `${Math.round(seconds / 60)}分`;
}

/**
 * 1日目のまとめの数字。
 * @param {{ day: ReturnType<typeof emptyDay>, untilPly: number }} input
 */
export function daySummary({ day, untilPly }) {
  const rates = day.rates.filter(([ply]) => ply <= untilPly);
  const think = day.think.filter(([ply]) => ply <= untilPly);
  const longest = think.reduce((best, item) => (!best || item[1] > best[1] ? item : best), null);
  return {
    rate: rates.length ? rates.at(-1)[1] : null,
    rates: rates.map(([ply, rate]) => ({ ply, rate })),
    thinkTotal: think.reduce((sum, [, ms]) => sum + ms, 0),
    longest: longest ? { ply: longest[0], ms: longest[1] } : null,
  };
}

/** 勝率の線(SVGのpoints)。幅100・高さ40、真ん中が50%。 */
export function ratePoints(rates, untilPly) {
  if (!rates.length) return '';
  const last = Math.max(untilPly, rates.at(-1).ply, 1);
  return rates.map(({ ply, rate }) => `${((ply / last) * 100).toFixed(1)},${(40 - (rate / 100) * 40).toFixed(1)}`).join(' ');
}

/**
 * 控室の顔ぶれ。立会人は年長でタイトルの多い棋士、解説は推し→羽音→上位の棋士。相手は除く。
 * @param {{ roster: any, opponentId: string, oshiId?: string | null, seed?: string }} input
 */
export function roomMembers({ roster, opponentId, oshiId = null, seed = '' }) {
  const members = Object.values(roster?.players ?? {}).filter((member) => member && member.id !== opponentId && member.kind !== 'amateur');
  const titles = (member) => (member.ryuo ?? 0) + Object.values(member.titleCounts ?? {}).reduce((sum, count) => sum + (Number(count) || 0), 0);
  const elders = members.filter((member) => (member.age ?? 0) >= 50);
  const witness = [...(elders.length ? elders : members)].sort((a, b) => titles(b) - titles(a) || (b.age ?? 0) - (a.age ?? 0))[0] ?? null;
  const rest = members.filter((member) => member !== witness);
  const commentator = rest.find((member) => member.id === oshiId)
    ?? rest.find((member) => member.story === 'hanane')
    ?? [...rest].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[hashText(seed) % Math.max(1, Math.min(8, rest.length))]
    ?? null;
  const pick = (member) => (member ? { name: member.name, dan: member.dan ?? '', story: member.story ?? null } : null);
  return {
    witness: pick(witness),
    commentator: pick(commentator),
    reporter: { name: `観戦記者 ${REPORTERS[hashText(`${seed}:reporter`) % REPORTERS.length]}`, dan: '' },
  };
}

/** 勝率(プレイヤーの%)から、どちらがどのくらい良いか。 */
function balance(rate, userColor) {
  if (rate === null) return null;
  const lead = rate >= 50 ? userColor : other(userColor);
  return { lead: sideName(lead), trail: sideName(other(lead)), diff: Math.abs(rate - 50) };
}

/**
 * 控室の声(3人)。盤の事実だけを言い、どちらの次の手も勧めない。
 * @param {{
 *   summary: ReturnType<typeof daySummary>, members: ReturnType<typeof roomMembers>, userColor: 'black' | 'white',
 *   formations: { black: string, white: string }, material: number, userName: string, opponentName: string,
 *   meal: string, opponentMeal: string, longestText?: string,
 * }} input
 *   materialはプレイヤーから見た駒の損得の点数(piece-points.mjsのAI_PIECE_POINTS。歩が90)。longestTextは、いちばん長く考えた手の言葉(「29手目 ▲4五歩」)。
 */
export function roomVoices({ summary, members, userColor, formations, material, userName, opponentName, meal, opponentMeal, longestText = '' }) {
  const voices = [];
  const state = balance(summary.rate, userColor);
  if (members.witness) {
    const text = !state ? 'じっくりした1日目でしたね。勝負は2日目です'
      : state.diff < 8 ? 'ほぼ互角で1日目を終えました。勝負は2日目ですね'
        : state.diff < 20 ? `${state.lead}が少し指しやすいでしょうか。ただ、まだまだ長い将棋です`
          : `${state.lead}がはっきり良くなりました。${state.trail}がどう粘るか、2日目に注目です`;
    voices.push({ role: '立会人', name: `${members.witness.name}${members.witness.dan}`, text });
  }
  if (members.commentator) {
    // 羽音が解説のときは、敬語を使わない(ryuo-story.mjsのHANANE_LINESと同じ書き方)。
    const plain = members.commentator.story === 'hanane';
    const known = formations.black && formations.white;
    const parts = [known ? `戦型は${formations.black}対${formations.white}。` : plain ? '定跡を離れた力戦になった。' : '定跡を離れた力戦になりました。'];
    const materialSide = sideName(material >= 0 ? userColor : other(userColor));
    const degree = Math.abs(material) >= MATERIAL_BIG ? '大きく' : '少し';
    parts.push(Math.abs(material) < MATERIAL_EVEN
      ? (plain ? '駒の損得は、ほとんどない。' : '駒の損得はほとんどありません。')
      : (plain ? `${materialSide}が${degree}駒得してる。` : `${materialSide}が${degree}駒得しています。`));
    const rates = summary.rates;
    const recent = rates.at(-1);
    const earlier = recent ? [...rates].reverse().find(({ ply }) => ply <= recent.ply - 14) : null;
    if (recent && earlier && Math.abs(recent.rate - earlier.rate) >= 10) {
      parts.push(`ここ十数手で${sideName(recent.rate > earlier.rate ? userColor : other(userColor))}が盛り返し${plain ? 'た' : 'ました'}。`);
    }
    voices.push({ role: '解説', name: `${members.commentator.name}${members.commentator.dan}`, text: parts.join('') });
  }
  const longest = summary.longest;
  const reporterParts = [longest && longest.ms >= 120000 && longestText
    ? `${userName}は${longestText}で${thinkText(longest.ms)}の長考。`
    : `${userName}はテンポよく指し進めた。`];
  if (meal) reporterParts.push(`昼食は${userName}が${meal}、${opponentName}が${opponentMeal}。`);
  voices.push({ role: '記者', name: members.reporter.name, text: reporterParts.join('') });
  // 「」に入れて見せるので、最後の句点は付けない。
  return voices.map((voice) => ({ ...voice, text: voice.text.replace(/。$/, '') }));
}

/**
 * 封じ手の開封の言葉。
 * @param {{ witness: string, moveText: string, predictedText: string }} input
 */
export function unsealCard({ witness, moveText, predictedText }) {
  const matched = Boolean(predictedText) && predictedText === moveText;
  return {
    opener: witness ? `立会人の${witness}が封筒を開けた` : '立会人が封筒を開けた',
    move: `封じ手は${moveText}`,
    verdict: !predictedText ? '' : matched ? '控室の予想どおり！' : `控室の予想は${predictedText}。控室もうなる一手`,
    matched,
  };
}

// ---- 観戦記

/**
 * 封じ手のあとで、勝率がいちばん大きく動いたところ(2日目の分かれ目)。
 * 勝率はプレイヤーの手番ごとの記録。上がったならプレイヤーの手、下がったなら相手の手として言う。
 */
export function turningPoint(rates, sealPly) {
  let best = null;
  for (let index = 1; index < rates.length; index += 1) {
    const [beforePly, before] = rates[index - 1];
    const [afterPly, after] = rates[index];
    if (beforePly < sealPly - 1 || afterPly - beforePly > 2) continue;
    const delta = after - before;
    if (!best || Math.abs(delta) > Math.abs(best.delta)) {
      best = { delta, ply: delta >= 0 ? beforePly + 1 : afterPly, by: delta >= 0 ? 'user' : 'opponent' };
    }
  }
  return best && Math.abs(best.delta) >= 15 ? best : null;
}

/**
 * 観戦記(見出しと4段落まで)。
 * @param {{
 *   eventText: string, label: string, venue: string, userName: string, opponentName: string, userColor: 'black' | 'white',
 *   formations: { black: string, white: string }, day: ReturnType<typeof emptyDay>, opponentMeal: string,
 *   sealText?: string, predictedText?: string, win: boolean, plies: number, decided?: string, score?: string,
 *   moveText: (ply: number) => string,
 * }} input
 *   decidedは、この勝ちで決まったもの(「竜王獲得」「名人防衛」など)。scoreは、この局のあとの星(「2勝1敗」)。
 */
export function writeKansenki({
  eventText, label, venue, userName, opponentName, userColor, formations, day, opponentMeal: theirMeal,
  sealText = '', predictedText = '', win, plies, decided = '', score = '', moveText,
}) {
  const black = userColor === 'black' ? userName : opponentName;
  const white = userColor === 'black' ? opponentName : userName;
  const sealed = Boolean(day.seal) && plies >= day.seal.ply;
  const turning = sealed ? turningPoint(day.rates, day.seal.ply) : null;
  const turningText = turning ? moveText(turning.ply) : '';
  let headline;
  if (win && decided) headline = `${userName}、${decided}`;
  else if (win && turning?.by === 'user' && turningText) headline = `${userName}、2日目に${turningText}で抜け出す`;
  else if (win) headline = `${userName}、${plies}手で制す`;
  else headline = `${opponentName}が${plies}手で制す　${userName}は次の局へ`;
  const known = formations.black && formations.white;
  const paragraphs = [
    `${eventText}${label}は、${venue || '対局場'}で行われた。先手は${black}、後手は${white}。${known ? `戦型は${formations.black}対${formations.white}となった。` : '序盤から定跡を離れた力戦となった。'}`,
  ];
  const sealRate = sealed ? daySummary({ day, untilPly: day.seal.ply }).rate : null;
  const flow = (() => {
    const state = balance(sealRate, userColor);
    if (!state) return '1日目は、両者じっくりと駒組みを進めた。';
    if (state.diff < 8) return '1日目は、ほぼ互角のまま進んだ。';
    return `1日目は、${state.lead}${state.diff < 20 ? 'が少しリードして' : 'が大きくリードして'}終えた。`;
  })();
  const lunch = day.meal ? `昼食に${userName}は${day.meal}、${opponentName}は${theirMeal}を注文。` : '';
  if (sealed) {
    const matched = predictedText && predictedText === sealText;
    paragraphs.push(`${flow}${lunch}${day.seal.ply}手目、${userName}が${sealText}を封じて1日目を終えた。${matched ? '控室の予想どおりの一手だった。' : predictedText ? `控室の予想は${predictedText}だった。` : ''}`);
  } else {
    paragraphs.push(`${lunch}決着は、1日目のうちについた。`);
  }
  if (turning && turningText) {
    const who = turning.by === 'user' ? userName : opponentName;
    paragraphs.push(`2日目、勝負を分けたのは${turning.ply}手目、${who}の${turningText}。この一手で、形勢は${who}に傾いた。`);
  }
  // 勝った局の勝負メシは「勝ちメシ」として残る(8章)。
  const winningMeal = win && day.meal ? `昼の${day.meal}は、${userName}の勝ちメシになった。` : '';
  paragraphs.push(win
    ? `${plies}手まで、${userName}の勝ち。${score ? `これで${score}。` : ''}${decided ? `${userName}が${decided.replace(/(獲得|防衛)$/, '')}の座${decided.endsWith('防衛') ? 'を守った' : 'についた'}。` : ''}${winningMeal}`
    : `${plies}手まで、${opponentName}の勝ち。${score ? `これで${score}。` : ''}${userName}は、次の局へ静かに闘志を燃やしていた。`);
  return { headline, paragraphs };
}

/** 保存した観戦記(新しい順)。読めなければ空。 */
export function loadKansenki(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(KANSENKI_KEY) ?? '[]');
    return Array.isArray(parsed)
      ? parsed.filter((item) => item && typeof item.headline === 'string' && Array.isArray(item.paragraphs))
      : [];
  } catch {
    return [];
  }
}

/** 観戦記を1つ足す(同じidは置き換え)。保存できなくても遊びは止めない。 */
export function saveKansenki(storage, entry) {
  const list = [entry, ...loadKansenki(storage).filter((item) => item.id !== entry.id)].slice(0, KANSENKI_LIMIT);
  try {
    storage?.setItem(KANSENKI_KEY, JSON.stringify(list));
  } catch {
    // 保存できない環境では、この局の観戦記だけ見せる。
  }
  return list;
}
