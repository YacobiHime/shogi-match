import { describe, expect, it } from 'vitest';
import {
  KANSENKI_LIMIT, LUNCH_PLY, LUNCH_RUSH_PLIES, LUNCH_WAIT_PLIES, MEAL_BOOK_KEY, MEAL_NOTES, STAGE_MEALS, THINK_CAP_MS, daySummary,
  emptyDay, emptyMealBook, loadKansenki, loadMealBook, lunchAutoDue, lunchCard, lunchCoachLine, lunchMenu, lunchOpponentLine,
  lunchRushDue, lunchRushLine, mealBookView, dayHighlights, mealPowerDue, mealPowerLine, normalizeDay, noteDayRate, noteDayThink, noteMealBook,
  opponentMeal, ratePoints, roomMembers, roomVoices, saveKansenki, saveMealBook, trimDay, turningPoint, unsealCard, winningMeals,
  writeKansenki,
} from './title-day.mjs';
import { STAGE_VENUES } from './match-stage.mjs';

const memoryStorage = () => {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)) };
};

describe('勝負メシ', () => {
  it('どの対局場にも3品の献立がある', () => {
    for (const venue of STAGE_VENUES) expect(STAGE_MEALS[venue]).toHaveLength(3);
    expect(lunchMenu('どこか')).toHaveLength(3);
  });
  it('相手の勝負メシは対局場と相手で決まる', () => {
    const venue = STAGE_VENUES[0];
    expect(opponentMeal(venue, 'r1')).toBe(opponentMeal(venue, 'r1'));
    expect(lunchMenu(venue)).toContain(opponentMeal(venue, 'r1'));
  });
});

describe('勝負メシのその後(8章)', () => {
  it('どの献立にも料理の一言があり、やこび姫はそれを使って話す', () => {
    for (const menu of Object.values(STAGE_MEALS)) for (const meal of menu) expect(MEAL_NOTES[meal], meal).toBeTruthy();
    for (const meal of lunchMenu('どこか')) expect(MEAL_NOTES[meal], meal).toBeTruthy();
    expect(lunchCoachLine('海鮮丼')).toBe('海鮮丼、海の幸たっぷりだね！ 午後もがんばろう！');
    expect(lunchCoachLine('海鮮丼', { auto: true })).toBe('おまかせで海鮮丼が来たよ。海の幸たっぷりだね！ 午後もがんばろう！');
    expect(lunchCoachLine('')).toBe('');
  });
  it('相手の一言は棋風で言い分け、羽音は敬語を使わない', () => {
    expect(lunchOpponentLine('天ぷらそば', 'attack')).toBe('天ぷらそばで腹ごしらえ。午後は攻めますよ');
    expect(lunchOpponentLine('天ぷらそば', 'defense')).toContain('じっくり');
    expect(lunchOpponentLine('天ぷらそば', 'balance')).toBe('天ぷらそば、いただきます');
    expect(lunchOpponentLine('天ぷらそば', 'hanane')).not.toMatch(/ます|です/);
    expect(lunchOpponentLine('天ぷらそば', 'yoshihiko')).toContain('名物');
  });
  it('札は料理と一言と相手の注文。同じ品なら「同じ」と言う', () => {
    expect(lunchCard({ meal: '海鮮丼', opponentName: '天鷺善彦九段', opponentMeal: '味噌ラーメン' })).toEqual({
      title: 'お昼の休憩', meal: '海鮮丼', note: '海の幸たっぷり', other: '天鷺善彦九段は 味噌ラーメン', same: false,
    });
    expect(lunchCard({ meal: '海鮮丼', opponentName: '天鷺善彦九段', opponentMeal: '海鮮丼', auto: true })).toMatchObject({
      title: 'お昼の休憩・おまかせ', other: '天鷺善彦九段も 同じ海鮮丼！', same: true,
    });
    expect(lunchRushLine('海鮮丼')).toBe('控室：海鮮丼の注文が相次いでいます');
    expect(mealPowerLine('海鮮丼')).toBe('海鮮丼パワーだね！');
  });
  it('選ばずに指し続けたらおまかせ、選んだら少しして控室の声、午後のパワーは封じ手まで1回', () => {
    const day = emptyDay();
    expect(lunchAutoDue(day, LUNCH_PLY + LUNCH_WAIT_PLIES)).toBe(false);
    expect(lunchAutoDue(day, LUNCH_PLY + LUNCH_WAIT_PLIES + 1)).toBe(true);
    expect(lunchAutoDue({ ...day, meal: '海鮮丼', mealAt: 22 }, 40)).toBe(false);
    const chosen = { ...day, meal: '海鮮丼', mealAt: 22 };
    expect(lunchRushDue(chosen, 22 + LUNCH_RUSH_PLIES - 1)).toBe(false);
    expect(lunchRushDue(chosen, 22 + LUNCH_RUSH_PLIES)).toBe(true);
    expect(lunchRushDue({ ...chosen, rush: true }, 30)).toBe(false);
    expect(mealPowerDue(chosen)).toBe(true);
    expect(mealPowerDue({ ...chosen, power: true })).toBe(false);
    // 封じ手で決まった勝負メシ(選ばなかった)と、封じ手のあとは、パワーも控室の声も出さない。
    expect(mealPowerDue({ ...day, meal: '海鮮丼', mealAt: 0 })).toBe(false);
    expect(mealPowerDue({ ...chosen, seal: { ply: 41, move: '2g2f', predicted: '' } })).toBe(false);
    expect(normalizeDay({ ...chosen, power: true, rush: 'x' })).toMatchObject({ meal: '海鮮丼', mealAt: 22, power: true, rush: false });
  });
  it('勝負メシ帳は食べた回数と勝った回数。勝った品は勝ちメシになり、ノートでは献立の3品を並べる', () => {
    const storage = memoryStorage();
    const venue = '北海道・湖のほとりの宿';
    let book = loadMealBook(storage);
    expect(book).toEqual(emptyMealBook());
    book = noteMealBook(book, { venue, meal: '海鮮丼', win: true });
    book = noteMealBook(book, { venue, meal: '海鮮丼', win: false });
    book = noteMealBook(book, { venue, meal: '味噌ラーメン', win: false });
    saveMealBook(storage, book);
    expect(loadMealBook(storage).venues[venue]).toEqual({ 海鮮丼: { eaten: 2, wins: 1 }, 味噌ラーメン: { eaten: 1, wins: 0 } });
    expect(winningMeals(book, venue)).toEqual(['海鮮丼']);
    const view = mealBookView(book);
    expect(view.total).toBe(42);
    expect(view.tried).toBe(2);
    expect(view.wins).toBe(1);
    expect(view.venues).toEqual([{ venue, meals: [
      { meal: '海鮮丼', state: 'win', wins: 1 }, { meal: '味噌ラーメン', state: 'eaten', wins: 0 }, { meal: 'ジンギスカン定食', state: 'new', wins: 0 },
    ] }]);
    storage.setItem(MEAL_BOOK_KEY, '{');
    expect(loadMealBook(storage)).toEqual(emptyMealBook());
    storage.setItem(MEAL_BOOK_KEY, JSON.stringify({ venues: { [venue]: { 海鮮丼: { eaten: 1, wins: 5 }, 鶏飯: { eaten: 0 } } } }));
    expect(loadMealBook(storage).venues[venue]).toEqual({ 海鮮丼: { eaten: 1, wins: 1 } });
  });
});

describe('休憩のふりかえり(9章)', () => {
  it('形勢が動いたところは差の大きい順に3か所まで、手数の順に並べる', () => {
    const rates = [[0, 50], [2, 52], [4, 70], [6, 68], [8, 50], [10, 51], [12, 40], [14, 41]];
    expect(dayHighlights(rates, 20)).toEqual([
      { from: 3, to: 4, delta: 18 }, { from: 7, to: 8, delta: -18 }, { from: 11, to: 12, delta: -11 },
    ]);
    expect(dayHighlights(rates, 6)).toEqual([{ from: 3, to: 4, delta: 18 }]);
    expect(dayHighlights([[0, 50], [6, 90]], 20)).toEqual([]);
  });
});

describe('1日目の記録', () => {
  it('勝率と考えた時間を手数ごとに残し、待ったで戻すと後ろを消す', () => {
    let day = emptyDay();
    day = noteDayRate(day, 0, 50);
    day = noteDayRate(day, 2, 55.4);
    day = noteDayRate(day, 2, 57);
    day = noteDayThink(day, 1, 3000);
    day = noteDayThink(day, 3, THINK_CAP_MS * 3);
    expect(day.rates).toEqual([[0, 50], [2, 57]]);
    expect(day.think).toEqual([[1, 3000], [3, THINK_CAP_MS]]);
    day = { ...day, seal: { ply: 3, move: '2g2f', predicted: '' } };
    expect(normalizeDay(day).seal).toMatchObject({ ply: 3, material: 0, black: '' });
    expect(trimDay(day, 1)).toMatchObject({ rates: [[0, 50]], think: [[1, 3000]], seal: null });
  });
  it('保存の形が崩れていても空の記録に戻す', () => {
    expect(normalizeDay(null)).toEqual(emptyDay());
    expect(normalizeDay({ rates: [[1, 'x'], [2, 40]], think: 'x', meal: 3, seal: { ply: 'a' } })).toEqual({
      rates: [[2, 40]], think: [], meal: '', mealAt: 0, power: false, rush: false, seal: null,
    });
  });
  it('まとめは封じ手までの勝率と、いちばん長く考えた手', () => {
    const day = { ...emptyDay(), rates: [[0, 50], [20, 60], [40, 64], [50, 30]], think: [[21, 5000], [41, 240000], [51, 999]] };
    const summary = daySummary({ day, untilPly: 41 });
    expect(summary.rate).toBe(64);
    expect(summary.rates).toHaveLength(3);
    expect(summary.longest).toEqual({ ply: 41, ms: 240000 });
    expect(summary.thinkTotal).toBe(245000);
    expect(ratePoints(summary.rates, 41).split(' ')).toHaveLength(3);
  });
});

describe('控室', () => {
  const roster = {
    players: {
      a: { id: 'a', name: '老', dan: '九段', age: 70, ryuo: 3, titleCounts: { meijin: 2 }, rating: 1800 },
      b: { id: 'b', name: '若', dan: '四段', age: 20, rating: 1900 },
      h: { id: 'h', name: '羽音', dan: '三段', age: 15, story: 'hanane', rating: 1700 },
      o: { id: 'o', name: '相手', dan: '八段', age: 60, ryuo: 9, rating: 2000 },
    },
  };
  it('立会人は年長でタイトルの多い棋士、解説は推し→羽音。相手は除く', () => {
    expect(roomMembers({ roster, opponentId: 'o' }).witness.name).toBe('老');
    expect(roomMembers({ roster, opponentId: 'o' }).commentator.name).toBe('羽音');
    expect(roomMembers({ roster, opponentId: 'o', oshiId: 'b' }).commentator.name).toBe('若');
    expect(roomMembers({ roster: null, opponentId: 'o' }).reporter.name).toMatch(/^観戦記者/);
  });
  it('声は盤の事実を先手・後手で言い、勧める言葉を使わない', () => {
    const members = roomMembers({ roster, opponentId: 'o' });
    const summary = daySummary({ day: { ...emptyDay(), rates: [[10, 40], [26, 58], [40, 75]], think: [[29, 300000]] }, untilPly: 41 });
    const voices = roomVoices({
      summary, members, userColor: 'white', formations: { black: '矢倉', white: '雁木' }, material: 300,
      userName: 'やこび', opponentName: '相手', meal: 'うな重', opponentMeal: '親子丼', longestText: '29手目 △4五歩',
    });
    expect(voices.map(({ role }) => role)).toEqual(['立会人', '解説', '記者']);
    expect(voices[0].text).toContain('後手がはっきり良く');
    expect(voices[1].text).toContain('戦型は矢倉対雁木');
    expect(voices[1].text).toContain('後手が少し駒得');
    expect(voices[1].text).toContain('後手が盛り返し');
    expect(voices[2].text).toContain('5分の長考');
    expect(voices[2].text).toContain('うな重');
    expect(voices.map(({ text }) => text).join('')).not.toMatch(/指そう|指すべき|がいい手/);
    // 解説が羽音なら、敬語を使わない。ほかの棋士はていねいに話す。
    expect(voices[1].text).not.toMatch(/です|ます|ました|ません|ございます|お願い/);
    expect(voices[0].text).toMatch(/です|でしょう/);    // 昼休みのふりかえりでは、「1日目」「2日目」ではなく「午前」「午後」で言う。
    const lunch = roomVoices({
      summary, members, userColor: 'white', formations: { black: '', white: '' }, material: 0,
      userName: 'やこび', opponentName: '相手', meal: 'うな重', opponentMeal: '親子丼', moment: 'lunch',
    });
    expect(lunch[0].text).toContain('午後に注目');
    expect(lunch.map(({ text }) => text).join('')).not.toMatch(/1日目|2日目/);
  });
  it('開封は予想と同じなら「予想どおり」', () => {
    expect(unsealCard({ witness: '老九段', moveText: '▲4五歩', predictedText: '▲4五歩' })).toMatchObject({ matched: true, verdict: '控室の予想どおり！' });
    expect(unsealCard({ witness: '', moveText: '▲4五歩', predictedText: '▲3五歩' }).verdict).toContain('控室の予想は▲3五歩');
    expect(unsealCard({ witness: '', moveText: '▲4五歩', predictedText: '' }).verdict).toBe('');
  });
});

describe('観戦記', () => {
  const base = {
    eventText: '第3期 竜王戦', label: '七番勝負 第2局', venue: '新潟・雪見の宿', userName: 'やこび', opponentName: '天鷺善彦',
    userColor: 'black', formations: { black: '矢倉', white: '雁木' }, opponentMeal: 'へぎそば', moveText: (ply) => `${ply}手目の手`,
  };
  it('2日目の分かれ目は、封じ手のあとで勝率がいちばん動いたところ', () => {
    expect(turningPoint([[40, 50], [42, 52], [44, 80], [46, 78]], 41)).toMatchObject({ ply: 43, by: 'user' });
    expect(turningPoint([[40, 50], [42, 30]], 41)).toMatchObject({ ply: 42, by: 'opponent' });
    expect(turningPoint([[10, 50], [12, 90]], 41)).toBeNull();
  });
  it('勝った局は見出しに抜け出した手、封じ手と予想を書く', () => {
    const day = { rates: [[0, 50], [40, 52], [42, 55], [44, 82]], think: [], meal: 'のどぐろ御膳', seal: { ply: 41, move: '4f4e', predicted: '4f4e' } };
    const text = writeKansenki({ ...base, day, sealText: '▲4五歩', predictedText: '▲4五歩', win: true, plies: 97, score: '2勝0敗' });
    expect(text.headline).toBe('やこび、2日目に43手目の手で抜け出す');
    expect(text.paragraphs.join('')).toContain('▲4五歩を封じて');
    expect(text.paragraphs.join('')).toContain('控室の予想どおり');
    expect(text.paragraphs.join('')).toContain('のどぐろ御膳');
    expect(text.paragraphs.at(-1)).toContain('97手まで、やこびの勝ち。これで2勝0敗。');
    // 勝った局の勝負メシは勝ちメシになる(負けた局は書かない)。
    expect(text.paragraphs.at(-1)).toContain('昼ののどぐろ御膳は、やこびの勝ちメシになった。');
    expect(writeKansenki({ ...base, day, win: false, plies: 97 }).paragraphs.join('')).not.toContain('勝ちメシ');
  });
  it('封じ手の前に終わった負けの局も、責めずに書く', () => {
    const text = writeKansenki({ ...base, day: emptyDay(), win: false, plies: 33 });
    expect(text.headline).toBe('天鷺善彦が33手で制す　やこびは次の局へ');
    expect(text.paragraphs.join('')).toContain('決着は、1日目のうちについた');
    expect(text.paragraphs.length).toBeLessThanOrEqual(5);
  });
  it('詰ませて勝った局は、寄せの手数を見出しと最後の段落に書く(docs/mate-finish-design.md)', () => {
    const text = writeKansenki({ ...base, day: emptyDay(), win: true, plies: 101, mate: { plies: 7, from: 95 } });
    expect(text.headline).toBe('やこび、7手詰めで寄せ切る');
    expect(text.paragraphs.at(-1)).toBe('最後は95手目95手目の手からの7手詰め。やこびが鮮やかに寄せ切った。101手まで、やこびの勝ち。');
    // タイトルが決まった勝ちは、決まったことを見出しにする(寄せは最後の段落に書く)。
    const crowned = writeKansenki({ ...base, day: emptyDay(), win: true, plies: 101, decided: '竜王獲得', mate: { plies: 7, from: 95 } });
    expect(crowned.headline).toBe('やこび、竜王獲得');
    expect(crowned.paragraphs.at(-1)).toContain('7手詰め');
  });
  it('タイトルが決まった勝ちは見出しにする', () => {
    expect(writeKansenki({ ...base, day: emptyDay(), win: true, plies: 120, decided: '竜王獲得' }).headline).toBe('やこび、竜王獲得');
    expect(writeKansenki({ ...base, day: emptyDay(), win: true, plies: 120, decided: '竜王防衛' }).paragraphs.at(-1)).toContain('竜王の座を守った');
    expect(writeKansenki({ ...base, day: emptyDay(), win: true, plies: 120, decided: '竜王獲得' }).paragraphs.at(-1)).toContain('竜王の座についた');
  });
  it('保存は新しい順に上限まで。壊れた保存は空', () => {
    const storage = memoryStorage();
    for (let index = 0; index < KANSENKI_LIMIT + 3; index += 1) saveKansenki(storage, { id: String(index), headline: 'h', paragraphs: [] });
    const list = loadKansenki(storage);
    expect(list).toHaveLength(KANSENKI_LIMIT);
    expect(list[0].id).toBe(String(KANSENKI_LIMIT + 2));
    storage.setItem('yacobihime:shogi-match:kansenki:v1', '{');
    expect(loadKansenki(storage)).toEqual([]);
  });
});
