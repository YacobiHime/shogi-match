import { describe, expect, it } from 'vitest';
import { appendUsiMove, createGameRecord, STANDARD_SFEN } from '../game-state';
import { HANANE, YOSHIHIKO } from './ryuo-story.mjs';
import { relaySeed, relayTimeControl, relayTimeline } from './relay-game.mjs';
import { callName, createRelayScript, moveFacts, moveMeaning, moveTextOf, pvTextOf, relayAudience, relayCast } from './relay-commentary.mjs';

const player = (id, name, extra = {}) => ({ id, name, dan: '七段', rating: 1600, character: { attack: 0, traits: [], abilities: {} }, repertoire: null, ...extra });

describe('名前と配役', () => {
  it('苗字＋さんで呼ぶ。羽音と善彦は下の名前。同じ苗字なら全部', () => {
    expect(callName(player('a', '中村大輔'))).toBe('中村さん');
    expect(callName(player('a', '中村大輔'), player('b', '中村翔'))).toBe('中村大輔さん');
    expect(callName(player('h', '天鷺羽音', { story: HANANE }))).toBe('羽音さん');
    expect(callName(player('y', '天鷺善彦', { story: YOSHIHIKO }))).toBe('善彦さん');
  });

  it('羽音の対局の解説は善彦、善彦の対局の解説は羽音(敬語を使わない)', () => {
    const pool = [player('h', '天鷺羽音', { story: HANANE }), player('y', '天鷺善彦', { story: YOSHIHIKO }), player('c', '佐藤誠', { rating: 1900 })];
    const withHanane = relayCast({ spec: { key: 'k', black: pool[0], white: player('x', '鈴木蓮') }, pool });
    expect(withHanane.name).toBe('天鷺善彦');
    const withFather = relayCast({ spec: { key: 'k', black: pool[1], white: player('x', '鈴木蓮') }, pool });
    expect(withFather.voice).toBe('hanane');
    const plain = relayCast({ spec: { key: 'k', black: player('p', '田中翼'), white: player('q', '鈴木蓮') }, pool, oshiId: 'c' });
    expect(plain.name).toBe('佐藤誠');
  });
});

describe('手の事実と表記', () => {
  it('「▲7六歩」「△同歩」の形にし、読み筋を矢印でつなぐ', () => {
    expect(moveTextOf(STANDARD_SFEN, '7g7f')).toBe('▲7六歩');
    const record = createGameRecord();
    for (const move of ['7g7f', '3c3d', '8h2b+']) appendUsiMove(record, move);
    expect(moveTextOf(record.position.sfen, '3a2b', '8h2b+')).toBe('△同銀');
    expect(pvTextOf(STANDARD_SFEN, '7g7f 3c3d 2g2f')).toBe('▲7六歩 → △3四歩 → ▲2六歩');
  });

  it('駒を取る・王手・飛車を振る手の意味を、盤から言う', () => {
    const record = createGameRecord();
    for (const move of ['7g7f', '3c3d']) appendUsiMove(record, move);
    const capture = moveFacts(record.position.sfen, '8h2b+');
    expect(capture.captured).toBe('B');
    expect(moveMeaning(capture)).toBe('角を取る手');
    expect(moveMeaning(moveFacts(STANDARD_SFEN, '2h6h'), { ply: 3 })).toMatch(/飛車を横に振って/);
  });
});

/** 決まった手順の棋譜から、台本を作る。 */
function scriptFor(spec, moves, { evals = null, times = null, end = null } = {}) {
  const cast = { id: 'c', name: '佐藤誠', dan: '九段', story: null, voice: 'polite' };
  const script = createRelayScript({ spec, cast });
  const record = createGameRecord();
  const entries = moves.map((move, index) => ({ move, eval: evals?.[index] ?? 0, pv: '', best: index === 5 ? '8c8d' : '', loss: index === 5 ? 600 : 0, time: times?.[index] ?? 60, mark: index === 5 ? 'error' : '' }));
  const timeline = relayTimeline({ entries }, relayTimeControl({ event: spec.event, kind: spec.kind }));
  let previousEval = 40;
  entries.forEach((entry, index) => {
    const before = record.position.sfen;
    appendUsiMove(record, entry.move);
    script.add({
      index, entry, previousEval, sfenBefore: before, sfenAfter: record.position.sfen,
      before: timeline[index], after: timeline[index + 1], last: index === entries.length - 1, end: index === entries.length - 1 ? end : null,
    });
    previousEval = entry.eval;
  });
  return script;
}

describe('createRelayScript', () => {
  const spec = {
    key: 'ryuo:1:ranking:rk-m1', event: 'ryuo', kind: 'game', label: '6組ランキング戦 1回戦', weight: 'plain',
    black: player('a', '中村大輔'), white: player('b', '鈴木蓮'), winner: 'black', how: 'middle', story: [100, 250, 300], seed: relaySeed('ryuo:1:ranking:rk-m1'),
  };
  const moves = ['7g7f', '3c3d', '2g2f', '4c4d', '2f2e', '2b3c', '3i4h', '3a2b'];
  const evals = [40, 40, 50, 40, 60, 400, 410, 420];

  it('始めに聞き手と解説者があいさつし、対局者を紹介する', () => {
    const script = scriptFor(spec, moves, { evals });
    const intro = script.lines.filter(({ at }) => at === 0);
    expect(intro[0]).toMatchObject({ role: 'host' });
    expect(intro[0].text).toContain('6組ランキング戦 1回戦');
    expect(intro.some(({ role, text }) => role === 'commentator' && text.includes('佐藤誠九段'))).toBe(true);
    expect(script.comments.some(({ at }) => at === 0)).toBe(true);
    expect(script.thoughts.filter(({ at }) => at === 0)).toHaveLength(2);
  });

  it('形勢が動いた手には、責めずにAIの推奨手と勝率の動きを添える', () => {
    const script = scriptFor(spec, moves, { evals });
    const swing = script.lines.filter(({ at }) => at === 6);
    expect(swing.some(({ text }) => /AIの推奨は△8四歩/.test(text) && /疑問手|痛い一手/.test(text))).toBe(true);
    expect(swing.some(({ text }) => /勝率が/.test(text))).toBe(true);
    expect(script.lines.every(({ text }) => !/ひどい|大悪手|ミス/.test(text))).toBe(true);
  });

  it('長考・休憩・投了を、時間と結果から言う', () => {
    const times = moves.map((_, index) => (index === 3 ? 7200 : index === 4 ? 4000 : 900));
    const script = scriptFor(spec, moves, { evals, times, end: { winner: 'black', reason: 'resign' } });
    expect(script.lines.some(({ when, text }) => when === 'think' && text.includes('長考'))).toBe(true);
    expect(script.cards.some(({ kind }) => kind === 'lunch')).toBe(true);
    expect(script.cards.some(({ kind }) => kind === 'end')).toBe(true);
    expect(script.thoughts.some(({ text }) => text.startsWith('（'))).toBe(true);
    // 同じ種なら同じ中継。
    expect(scriptFor(spec, moves, { evals, times, end: { winner: 'black', reason: 'resign' } }).comments).toEqual(script.comments);
  });

  it('羽音の心の声は敬語を使わない', () => {
    const hanane = { ...spec, black: player('h', '天鷺羽音', { story: HANANE }) };
    const script = scriptFor(hanane, moves, { evals });
    const lines = script.thoughts.filter(({ side }) => side === 'black').map(({ text }) => text);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((text) => !/です|ます/.test(text))).toBe(true);
  });

  it('来場者数は、タイトル戦ほど多い', () => {
    expect(relayAudience({ ...spec, weight: 'title' }, 50)).toBeGreaterThan(relayAudience(spec, 50));
  });
});
