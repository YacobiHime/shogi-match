import { describe, expect, it } from 'vitest';
import {
  KANSENKI_LIMIT, STAGE_MEALS, THINK_CAP_MS, daySummary, emptyDay, loadKansenki, lunchMenu, normalizeDay, noteDayRate,
  noteDayThink, opponentMeal, ratePoints, roomMembers, roomVoices, saveKansenki, trimDay, turningPoint, unsealCard, writeKansenki,
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
    expect(normalizeDay({ rates: [[1, 'x'], [2, 40]], think: 'x', meal: 3, seal: { ply: 'a' } })).toEqual({ rates: [[2, 40]], think: [], meal: '', seal: null });
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
  });
  it('封じ手の前に終わった負けの局も、責めずに書く', () => {
    const text = writeKansenki({ ...base, day: emptyDay(), win: false, plies: 33 });
    expect(text.headline).toBe('天鷺善彦が33手で制す　やこびは次の局へ');
    expect(text.paragraphs.join('')).toContain('決着は、1日目のうちについた');
    expect(text.paragraphs.length).toBeLessThanOrEqual(5);
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
