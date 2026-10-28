import { describe, expect, it } from 'vitest';
import { appendUsiMove, createGameRecord, enumerateLegalMoves, STANDARD_SFEN } from '../game-state';
import { HANANE, YOSHIHIKO } from './ryuo-story.mjs';
import { relaySeed, relayTimeControl, relayTimeline } from './relay-game.mjs';
import {
  callName, createRelayScript, kingGuard, materialSwap, materialText, moveFacts, moveMeaning, moveTextOf, pvTextOf, relayAudience, relayCast,
} from './relay-commentary.mjs';

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

/** 決まった手順で長い1局を作り、台本を通す(コメントの種類を確かめる)。 */
function longScript({ weight = 'plain', news = [], variant = '', venue = '' } = {}) {
  const spec = {
    key: `ryuo:9:main:long-${weight}${variant}`, venue, event: 'ryuo', kind: weight === 'title' ? 'finals' : 'game', label: '決勝トーナメント 準決勝', weight,
    black: player('a', '中村大輔', { age: 41, character: { attack: 0.4, traits: [{ id: 'demon-reading' }], abilities: {} } }),
    white: player('h', '天鷺羽音', { story: HANANE, age: 16 }), winner: 'black', how: 'middle', story: [80, 300, 900], news,
  };
  const cast = { id: 'y', name: '天鷺善彦', dan: '竜王', story: YOSHIHIKO, voice: 'yoshihiko' };
  const script = createRelayScript({ spec, cast, nextId: 'a' });
  const record = createGameRecord();
  const sfens = [record.position.sfen];
  const moves = [];
  for (let ply = 0; ply < 110; ply += 1) {
    const legal = enumerateLegalMoves(record.position).map(({ usi }) => usi).sort();
    if (!legal.length) break;
    const move = legal[relaySeed(`long${variant}:${ply}`) % legal.length];
    appendUsiMove(record, move);
    moves.push(move);
    sfens.push(record.position.sfen);
  }
  const entries = moves.map((move, index) => ({
    move,
    eval: Math.round(Math.sin(index / 9) * 400 + index * 6),
    // 偶数の手は、次の手を読み筋の1手目にする(視聴者の予想が当たる)。
    pv: index % 2 === 0 && moves[index + 1] ? moves[index + 1] : '',
    best: index === 40 ? moves[index] : moves[index],
    loss: index === 41 ? 520 : 0,
    time: index === 30 || index === 55 ? 5400 : index > 90 ? 50 : 300 + (index % 7) * 200,
    mark: index < 14 ? 'book' : index === 41 ? 'error' : index === 70 ? 'only' : '',
  }));
  const timeline = relayTimeline({ entries }, relayTimeControl({ event: spec.event, kind: spec.kind }));
  entries.forEach((entry, index) => {
    const last = index === entries.length - 1;
    script.add({
      index, entry, previousEval: index ? entries[index - 1].eval : 40, sfenBefore: sfens[index], sfenAfter: sfens[index + 1],
      before: timeline[index], after: timeline[index + 1], last, end: last ? { winner: 'black', reason: 'resign' } : null,
    });
  });
  return Object.assign(script, { sfens });
}

describe('視聴者のコメントの種類(12章)', () => {
  const script = longScript();

  it('1局に、6種類以上の書き手が出る', () => {
    const kinds = new Set(script.comments.map(({ kind }) => kind));
    expect(kinds.size).toBeGreaterThanOrEqual(6);
    for (const kind of ['play', 'hype', 'cheer', 'cast', 'theory', 'clock']) expect(kinds.has(kind), kind).toBe(true);
  });

  it('予想は、当たったときだけ「的中」と言う', () => {
    const predicts = script.comments.filter(({ kind, when }) => kind === 'predict' && when === 'think');
    expect(predicts.length).toBeGreaterThan(0);
    for (const hit of script.comments.filter(({ text }) => /予想的中|当たった|読み通り|的中/.test(text))) {
      expect(script.comments.some(({ at, kind, when }) => at === hit.at && kind === 'predict' && when === 'think')).toBe(true);
    }
  });

  it('初心者の質問のすぐあとに、答えが続く。AI勢は青、応援はピンク', () => {
    const list = script.comments;
    list.forEach((item, index) => {
      if (item.kind === 'newbie') expect(list[index + 1]).toMatchObject({ kind: 'answer', at: item.at, tone: 'green' });
    });
    expect(list.filter(({ kind }) => kind === 'ai').every(({ tone }) => tone === 'blue')).toBe(true);
    expect(list.some(({ text }) => /親子解説|パパ解説|善彦先生の解説|照れてる/.test(text))).toBe(true);
  });

  it('盛り上がりは大きな字、運営は上に止まる帯。終局と休憩を知らせる', () => {
    expect(script.comments.filter(({ kind }) => kind === 'hype').some(({ size }) => size === 'big')).toBe(true);
    const official = script.comments.filter(({ kind }) => kind === 'official');
    expect(official.every(({ pos }) => pos === 'top')).toBe(true);
    expect(official.some(({ text }) => text.startsWith('【終局】'))).toBe(true);
    expect(official.some(({ text }) => text.startsWith('【お知らせ】'))).toBe(true);
  });

  it('同じ回戦のほかの結果を、運営が少しずつ知らせる', () => {
    const withNews = longScript({ news: ['鈴木蓮七段 勝ち', '佐藤誠九段 勝ち'] });
    const items = withNews.comments.filter(({ text }) => text.startsWith('【他の対局】'));
    expect(items.map(({ text }) => text)).toEqual(['【他の対局】鈴木蓮七段 勝ち', '【他の対局】佐藤誠九段 勝ち']);
    expect(items[1].at).toBeGreaterThan(items[0].at);
  });

  it('責める言葉を使わない。タイトル戦ほどコメントが多い', () => {
    expect(script.comments.every(({ text }) => !/ひどい|大悪手|ミス|下手/.test(text))).toBe(true);
    expect(script.comments.every(({ text }) => !/\{\w+\}/.test(text))).toBe(true);
    expect(longScript({ weight: 'title' }).comments.length).toBeGreaterThan(script.comments.length);
  });
});

describe('視聴者のコメントの種類を増やす(12-5)', () => {
  it('駒割りは、盤と持ち駒の駒の数から言う(角交換は互角、銀を持てば銀得、交換は得をした側から)', () => {
    const record = createGameRecord();
    for (const move of ['7g7f', '3c3d', '8h2b+', '3a2b']) appendUsiMove(record, move);
    expect(materialText(record.position.sfen)).toMatchObject({ text: '', lead: null });
    const silver = 'lnsgkg1nl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b S 1';
    expect(materialSwap(silver).S).toBe(1);
    expect(materialText(silver)).toMatchObject({ text: '先手の銀得', lead: 'black' });
    const swap = 'lnsgk2nl/1r7/ppppppppp/9/9/9/PPPPPPPPP/7R1/LNSGKGSNL b GSb 1';
    expect(materialText(swap)).toMatchObject({ text: '先手が角を渡して金と銀', lead: 'black' });
  });

  it('玉の守りは、まわり8マスの金銀を数え、隅の玉を穴熊と言う', () => {
    expect(kingGuard(STANDARD_SFEN, 'black')).toEqual({ guards: 2, anaguma: false });
    expect(kingGuard('lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/KNSG1GSNL b - 1', 'black')?.anaguma).toBe(true);
  });

  const scripts = ['', '-b', '-c', '-d'].flatMap((variant) => [
    longScript({ variant }), longScript({ variant, weight: 'title', venue: '京都・古いお寺の大広間' }),
  ]);
  const NEW_KINDS = ['kifu', 'material', 'king', 'layman', 'local', 'room', 'veteran', 'overseas'];

  it('いくつかの対局で、新しい書き手が6種類以上出る。終局では棋譜並べ勢が総手数を言う', () => {
    const kinds = new Set(scripts.flatMap(({ comments }) => comments.map(({ kind }) => kind)));
    expect(NEW_KINDS.filter((kind) => kinds.has(kind)).length).toBeGreaterThanOrEqual(6);
    for (const script of scripts) {
      const plies = script.sfens.length - 1;
      expect(script.comments.some(({ kind, at }) => kind === 'kifu' && at === plies)).toBe(true);
      for (const { text } of script.comments.filter(({ kind, at }) => kind === 'kifu' && at === plies)) {
        if (/\d+手/.test(text)) expect(text).toContain(`${plies}手`);
      }
    }
  });

  it('駒割り勢の言う駒割りは、その手の盤と合う。素人の形勢判断には、AI勢(青)が評価値で答える', () => {
    for (const script of scripts) {
      for (const item of script.comments.filter(({ kind }) => kind === 'material')) {
        const { text } = materialText(script.sfens[item.at]);
        expect(item.tone).toBe('orange');
        if (text) expect(item.text).toContain(text);
        else expect(item.text).toMatch(/互角|損得はなし|五分/);
      }
      for (const item of script.comments.filter(({ kind }) => kind === 'veteran')) expect(item.text).toMatch(/中村|羽音/);
      script.comments.forEach((item, index) => {
        if (item.kind !== 'layman') return;
        const { lead } = materialText(script.sfens[item.at]);
        expect(item.text).toContain(lead === 'black' ? '先手' : '後手');
        expect(script.comments[index + 1]).toMatchObject({ kind: 'ai', tone: 'blue', at: item.at });
      });
    }
  });

  it('ご当地勢は対局場の町を言い、海外のファンは薄紫。言い方の穴埋めが残らない', () => {
    const title = scripts.filter((_, index) => index % 2 === 1).flatMap(({ comments }) => comments);
    for (const { text } of title.filter(({ kind }) => kind === 'local')) expect(text).toMatch(/京都/);
    const all = scripts.flatMap(({ comments }) => comments);
    expect(all.filter(({ kind }) => kind === 'overseas').every(({ tone }) => tone === 'lavender')).toBe(true);
    expect(all.every(({ text }) => !/\{\w+\}|undefined|NaN/.test(text))).toBe(true);
    expect(all.every(({ text }) => !/ひどい|大悪手|ミス|下手/.test(text))).toBe(true);
  });
});
