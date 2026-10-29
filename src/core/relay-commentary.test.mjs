import { describe, expect, it } from 'vitest';
import { appendUsiMove, createGameRecord, enumerateLegalMoves, STANDARD_SFEN } from '../game-state';
import { HANANE, YOSHIHIKO } from './ryuo-story.mjs';
import { resignStyleOf } from './resign-style.mjs';
import { relaySeed, relayTimeControl, relayTimeline } from './relay-game.mjs';
import {
  callName, createRelayScript, kingGuard, materialSwap, materialText, moveFacts, moveMeaning, moveTextOf, pvTextOf, relayAudience, relayCast,
} from './relay-commentary.mjs';

/** 30章の同情の一言(秒読み・寄せ。分身には出さない)を除いた文(責める言葉を調べる)。 */
const sympathyRemoved = (text) => String(text).replace(/1分だからそりゃミスも出るか|珍しく.+先生が寄せでミスったな…/, '');

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
function longScript({
  weight = 'plain', news = [], variant = '', venue = '', cast: castOverride = null, white = null, evalOf = null, end = { winner: 'black', reason: 'resign' }, how = 'middle', series = null,
} = {}) {
  const spec = {
    key: `ryuo:9:main:long-${weight}${variant}`, venue, event: 'ryuo', kind: weight === 'title' ? 'finals' : 'game', label: '決勝トーナメント 準決勝', weight,
    black: player('a', '中村大輔', { age: 41, character: { attack: 0.4, traits: [{ id: 'demon-reading' }], abilities: {} } }),
    white: white ?? player('h', '天鷺羽音', { story: HANANE, age: 16 }), winner: end.winner, how, story: [80, 300, 900], news, series,
  };
  const cast = castOverride ?? { id: 'y', name: '天鷺善彦', dan: '竜王', story: YOSHIHIKO, voice: 'yoshihiko' };
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
    eval: evalOf ? evalOf(index) : Math.round(Math.sin(index / 9) * 400 + index * 6),
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
      before: timeline[index], after: timeline[index + 1], last, end: last ? end : null,
    });
  });
  return Object.assign(script, { sfens, moves, spec });
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
    expect(script.comments.every(({ text }) => !/ひどい|大悪手|ミス|下手/.test(sympathyRemoved(text)))).toBe(true);
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
    expect(all.every(({ text }) => !/ひどい|大悪手|ミス|下手/.test(sympathyRemoved(text)))).toBe(true);
  });
});

describe('解説の掛け合いと、コメントの例の取り込み(25章)', () => {
  const yoshihiko = { id: 'y', name: '天鷺善彦', dan: '名人', story: YOSHIHIKO, voice: 'yoshihiko' };
  const variants = ['', 'b', 'c', 'd', 'e', 'f'];
  const scripts = variants.map((variant) => longScript({ variant, cast: yoshihiko, white: player('s', '鈴木蓮', { age: 28 }) }));

  it('棋譜読み上げが振り駒の結果を告げ、視聴者が先手を言う', () => {
    const [script] = scripts;
    expect(script.lines.find(({ role }) => role === 'reader')?.text).toBe('振り駒の結果、先手は中村大輔七段に決まりました。それでは、お願いいたします。');
    expect(script.comments.some(({ at, text }) => at === 0 && /中村/.test(text) && /先手/.test(text))).toBe(true);
  });

  it('善彦の解説は謙遜から始まり、視聴者がつっこむ。羽音の対局を解説するときは親子のやりとりにする', () => {
    const [script] = scripts;
    const intro = script.lines.filter(({ at }) => at === 0).map(({ text }) => text);
    expect(intro).toContain('まあ、専門家じゃないんで。全然分かんないという感じなんですけど。');
    expect(script.comments.some(({ kind, text }) => kind === 'cast' && /専門家/.test(text))).toBe(true);
    const family = longScript().lines.filter(({ at }) => at === 0).map(({ text }) => text);
    expect(family.some((text) => /専門家じゃない/.test(text))).toBe(false);
  });

  it('仕掛け・互角・終局のふり返りで、善彦らしい言い方をし、聞き手がたずねる', () => {
    const all = scripts.flatMap(({ lines }) => lines.map(({ text }) => text));
    expect(all).toContain('決断としては非常に良かったような、えぇ、ええ。感じがありますね、えぇ。');
    expect(all).toContain('出だしから意外な将棋でしたけど、まあ、あのー、大熱戦だったと、思います。はい。');
    expect(all).toContain('この一局、ふり返ってどうだった？');
    expect(scripts.some(({ comments }) => comments.some(({ text }) => /言うなら|まてｗ|よくねえよ/.test(text)))).toBe(true);
  });

  it('見せ場の一言は、下に止まる大きな字。続けて出さない', () => {
    const unders = scripts.flatMap(({ comments }) => comments.filter(({ pos }) => pos === 'bottom'));
    expect(unders.length).toBeGreaterThan(0);
    expect(unders.every(({ size }) => size === 'big')).toBe(true);
    for (const { comments } of scripts) {
      const ats = comments.filter(({ pos }) => pos === 'bottom').map(({ at }) => at);
      for (let i = 1; i < ats.length; i += 1) expect(ats[i] - ats[i - 1]).toBeGreaterThanOrEqual(6);
    }
  });

  it('戦型予想・駒の見せ場などの新しいコメントが出る。穴埋めが残らず、責める言葉もない', () => {
    const all = scripts.flatMap(({ comments }) => comments);
    expect(all.some(({ at, when, kind }) => at === 1 && when === 'think' && kind === 'predict')).toBe(true);
    expect(all.every(({ text }) => !/\{\w+\}|undefined|NaN/.test(text))).toBe(true);
    // 少しきつい笑い(「酷いｗ」)は27章で入れた。分身の手には出さない(下の27章のテスト)。
    expect(all.every(({ text }) => !/ひどい|大悪手|ミス|下手/.test(sympathyRemoved(text)))).toBe(true);
  });

  it('羽音の解説は、新しい言い方でも敬語を使わない', () => {
    const hanane = { id: 'h', name: '天鷺羽音', dan: '四段', story: HANANE, voice: 'hanane' };
    for (const variant of variants) {
      const script = longScript({ variant, cast: hanane, white: player('s', '鈴木蓮', { age: 28 }) });
      expect(script.lines.filter(({ role }) => role === 'commentator').every(({ text }) => !/です|ます/.test(text))).toBe(true);
    }
  });
});

describe('コメントの条件と名詞の差し替え、解説との連動(27章)', () => {
  const yoshihiko = { id: 'y', name: '天鷺善彦', dan: '名人', story: YOSHIHIKO, voice: 'yoshihiko' };
  const variants = ['', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

  it('善彦の「専門家じゃない」には、解説が出てから4種類のつっこみが流れる', () => {
    const texts = new Set();
    for (const variant of variants) {
      const script = longScript({ variant, cast: yoshihiko, white: player('s', '鈴木蓮') });
      const humble = script.comments.filter(({ at, kind, text }) => at === 0 && kind === 'cast' && /専門家/.test(text));
      expect(humble.length).toBeGreaterThan(0);
      expect(humble.every(({ lag }) => lag >= 1000)).toBe(true);
      for (const { text } of humble) texts.add(text);
    }
    expect([...texts].sort()).toEqual(['あんた以上の専門家いないだろｗｗｗ', 'お前が専門家じゃないなら誰が専門家なんだよｗ', '専門家じゃないｗｗｗｗｗ', '振り飛車の専門家とかだろう'].sort());
  });

  it('解説へのつっこみ(しょうがない・意地でも・非常に良かった)は、解説と同じ手で遅れて流れる', () => {
    for (const variant of variants) {
      const script = longScript({ variant, cast: yoshihiko, white: player('s', '鈴木蓮') });
      for (const item of script.comments.filter((comment) => comment.kind === 'cast' && item_is_reaction(comment))) {
        expect(item.lag, item.text).toBeGreaterThanOrEqual(1000);
        expect(script.lines.some(({ at, role }) => at === item.at && role === 'commentator'), `${item.at} ${item.text}`).toBe(true);
      }
    }
    function item_is_reaction(item) { return /しょうがない|意地|いじでも|なにがなんでも|まてｗ|よくねえよ|言うなら|こっちが聞きたい|意外しかない/.test(item.text); }
  });

  it('振り駒: 前に「先手どっち」、結果のあとに反応。格上が後手なら「後手はアカン」(名前は苗字)', () => {
    const spec = {
      key: 'ryuo:3:main:m1', event: 'ryuo', kind: 'game', label: '決勝トーナメント 1回戦', weight: 'big',
      black: player('a', '中村大輔'), white: player('y', '天鷺善彦', { story: YOSHIHIKO }), winner: 'white', how: 'middle', story: [100, 250, 300],
    };
    const script = createRelayScript({ spec, cast: { id: 'c', name: '佐藤誠', dan: '九段', story: null, voice: 'polite' } });
    const zero = script.comments.filter(({ at }) => at === 0);
    expect(zero.find(({ text }) => text === '先手どっちｗｗｗｗｗ')?.lag).toBeUndefined();
    expect(zero.some(({ text, lag }) => text === '天鷺先生後手はアカン～～～' && lag >= 1000)).toBe(true);
    // 振り駒の結果への反応も、読み上げのあとに流れる。
    expect(zero.filter(({ kind, lag }) => kind === 'hype' && lag >= 1000).length).toBeGreaterThan(0);
  });

  it('得意戦法から戦型を予想する(名詞は対局者の戦法。決め打ちの「藤井システム」は使わない)', () => {
    const fujii = player('f', '大山康', { repertoire: { usage: { black: { 'fujii-system': 80, shiken: 20 }, white: { 'fujii-system': 70, shiken: 30 } } } });
    const guesses = variants.flatMap((variant) => longScript({ variant, white: fujii }).comments.filter(({ at, when }) => at === 1 && when === 'think'));
    expect(guesses.some(({ text }) => /藤井システム/.test(text))).toBe(true);
    const plain = variants.flatMap((variant) => longScript({ variant, white: player('s', '鈴木蓮') }).comments);
    expect(plain.some(({ text }) => /藤井システム|エルモ急戦|ゴキゲン中飛車ありえるやん/.test(text))).toBe(false);
  });

  it('分身(プレイヤー自身の能力で戦う棋士)の手には、きつい笑いを出さない', () => {
    for (const variant of variants) {
      const script = longScript({ variant, white: player('v', 'やこび', { kind: 'avatar' }) });
      expect(script.comments.some(({ text }) => /酷いｗ|明らかにおかしい/.test(text))).toBe(false);
    }
  });

  it('分身の対局では、相手が次の相手でも「よく見ておこう」と言わない(34章)', () => {
    const plain = longScript({ variant: 'n0' });
    expect(plain.lines.some(({ text }) => text.includes('あなたの次の相手'))).toBe(true);
    for (const variant of variants) {
      const script = longScript({ variant, white: player('v', 'やこび', { kind: 'avatar' }) });
      expect(script.lines.some(({ text }) => text.includes('あなたの次の相手'))).toBe(false);
      expect(script.comments.some(({ text }) => /次の相手の研究タイム|よく見ておこう|対策メモ/.test(text))).toBe(false);
    }
  });

  it('玉が盤の真ん中より前に出たら「宇宙将棋ｗ」(1回だけ)', () => {
    const spec = {
      key: 'ryuo:3:ranking:u1', event: 'ryuo', kind: 'game', label: '6組ランキング戦 1回戦', weight: 'plain',
      black: player('a', '中村大輔'), white: player('b', '鈴木蓮'), winner: 'black', how: 'middle', story: [100, 250, 300],
    };
    const moves = ['5g5f', '1c1d', '5f5e', '9c9d', '5e5d', '1a1b', '5i5h', '9a9b', '5h5g', '1d1e', '5g5f', '9d9e', '5f5e'];
    const script = scriptFor(spec, moves);
    expect(script.comments.filter(({ text }) => text === '宇宙将棋ｗ').map(({ at }) => at)).toEqual([13]);
  });

  it('序盤の角交換は「2二かくなり～」、初手7六歩には、どよめきとつっこみ', () => {
    const spec = {
      key: 'ryuo:3:ranking:k1', event: 'ryuo', kind: 'game', label: '6組ランキング戦 1回戦', weight: 'plain',
      black: player('a', '中村大輔'), white: player('b', '鈴木蓮'), winner: 'black', how: 'middle', story: [100, 250, 300],
    };
    const texts = [];
    for (const key of ['k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7', 'k8']) {
      const script = scriptFor({ ...spec, key: `ryuo:3:ranking:${key}` }, ['7g7f', '3c3d', '8h2b+', '3a2b']);
      texts.push(...script.comments.map(({ text, lag }) => [text, lag ?? 0]));
    }
    expect(texts.some(([text]) => text === '2二かくなり～')).toBe(true);
    expect(texts.some(([text]) => text === '※おおすぎｗ　7六歩')).toBe(true);
    expect(texts.filter(([text]) => text === '※おおすぎｗ　7六歩').every(([, lag]) => lag >= 1000)).toBe(true);
  });

  it('新しいコメントの穴埋め({name}など)が全部埋まる', () => {
    const fujii = player('f', '大山康', { repertoire: { usage: { black: { 'fujii-system': 80 }, white: { 'fujii-system': 70 } } } });
    for (const variant of variants) {
      for (const script of [longScript({ variant, white: fujii }), longScript({ variant, weight: 'title', cast: yoshihiko, white: fujii })]) {
        expect(script.comments.every(({ text }) => text && !/\{\w+\}|undefined|NaN|null/.test(text))).toBe(true);
      }
    }
  });
});

describe('投了の早さの終局(29章)', () => {
  const base = {
    key: 'ryuo:3:ranking:e1', event: 'ryuo', kind: 'game', label: '6組ランキング戦 1回戦', weight: 'plain', winner: 'black', how: 'middle', story: [100, 250, 300],
  };
  const moves = ['7g7f', '3c3d', '2g2f', '8c8d'];
  /** 投了の早さが指定の段になる棋士のid。 */
  const idOf = (style) => {
    for (let index = 0; index < 500; index += 1) if (resignStyleOf({ id: `z${index}` }).id === style) return `z${index}`;
    throw new Error(style);
  };

  it('詰みまで指した人には、解説者が一言添え、視聴者が「最後まで」と反応する', () => {
    const loser = player(idOf('full'), '鈴木蓮');
    const script = scriptFor({ ...base, black: player('a', '中村大輔'), white: loser }, moves, { end: { winner: 'black', reason: 'mate', plies: 4 } });
    expect(script.lines.some(({ role, text }) => role === 'commentator' && text.includes('最後まで指す棋士'))).toBe(true);
    expect(script.comments.some(({ text }) => /最後まで|詰みまで/.test(text))).toBe(true);
  });

  it('潔い人の投了・粘った人の投了には、それぞれの反応', () => {
    const clean = scriptFor({ ...base, black: player('a', '中村大輔'), white: player(idOf('clean'), '鈴木蓮') }, moves, { end: { winner: 'black', reason: 'resign', plies: 4 } });
    expect(clean.comments.some(({ text }) => /潔い|投げっぷり|もう詰んでる/.test(text))).toBe(true);
    const stubborn = scriptFor({ ...base, black: player('a', '中村大輔'), white: player(idOf('stubborn'), '鈴木蓮') }, moves, { end: { winner: 'black', reason: 'resign', plies: 4 } });
    expect(stubborn.comments.some(({ text }) => /粘/.test(text) || text === '3手詰めまで指したね')).toBe(true);
  });
});

describe('二日制のタイトル戦の配信のコメント(30章)', () => {
  const variants = ['', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const suzuki = (extra = {}) => player('s', '鈴木蓮', { age: 28, ...extra });
  /** 投了の早さが指定の段になる棋士のid。 */
  const idOf = (style) => {
    for (let index = 0; index < 500; index += 1) if (resignStyleOf({ id: `z${index}` }).id === style) return `z${index}`;
    throw new Error(style);
  };
  const strip = (text) => text.replace(/^[▲△]/, '');

  it('会場をたずねる人には、対局場の町と場所(番勝負でなければ将棋会館)が遅れて答え、きつい返しはさらに遅れる', () => {
    let asked = 0;
    for (const variant of variants) {
      for (const [venue, answer] of [['神奈川・元湯陣屋', '神奈川の「元湯陣屋」です'], ['', '東京の「将棋会館」です']]) {
        const zero = longScript({ variant, venue, weight: venue ? 'title' : 'plain' }).comments.filter(({ at }) => at === 0);
        const reply = zero.find(({ text }) => text === answer);
        if (!zero.some(({ text }) => text === 'これどこでやってるんだろう')) {
          expect(reply).toBeUndefined();
          continue;
        }
        asked += 1;
        expect(reply?.lag).toBeGreaterThanOrEqual(1000);
        const rude = zero.find(({ text }) => text === '場所なんか自ら調べろや');
        if (rude) expect(rude.lag).toBeGreaterThan(reply.lag);
      }
    }
    expect(asked).toBeGreaterThan(0);
  });

  it('視聴者の数が節目を越えた手で「○人いったよ」(3桁区切り)。1万人には㊗', () => {
    const marks = [];
    for (const variant of variants) {
      const script = longScript({ variant });
      for (const { at, text } of script.comments.filter(({ text }) => /^(もう)?[\d,]+人(いった|行った|オメ|超え)/.test(text))) {
        const n = Number(text.match(/[\d,]+/)[0].replace(/,/g, ''));
        expect(relayAudience(script.spec, at)).toBeGreaterThanOrEqual(n);
        expect(relayAudience(script.spec, at - 1)).toBeLessThan(n);
        if (n >= 1000) expect(text).toContain(n.toLocaleString('en-US'));
        marks.push(n);
      }
      if (script.comments.some(({ text }) => text === '㊗一万人！')) marks.push('㊗');
    }
    expect(marks).toContain(7500);
    expect(marks).toContain('㊗');
  });

  it('昼食休憩: 「昼飯は○○らしいよ」(注文した料理)→「まだわかりません」→「昼飯の話ではないです」が、遅れて順に流れる', () => {
    let seen = 0;
    for (const variant of variants) {
      const script = longScript({ variant, weight: 'title', venue: '神奈川・元湯陣屋' });
      const menu = script.comments.find(({ text }) => /^昼飯は.+らしいよ$/.test(text));
      if (!menu) continue;
      seen += 1;
      const host = script.lines.find(({ at, role, text }) => at === menu.at && role === 'host' && text.includes('昼食休憩'));
      expect(host?.text).toContain(menu.text.replace(/^昼飯は|らしいよ$/g, ''));
      const same = script.comments.filter(({ at }) => at === menu.at);
      expect(same.find(({ text }) => text === 'まだわかりません')?.lag).toBe(1300);
      expect(same.find(({ text }) => text === 'あ、昼飯の話ではないです💦')?.lag).toBe(2700);
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('2日目の朝は「対局再開」。封じ手の手を言う', () => {
    let seen = 0;
    for (const variant of variants) {
      const script = longScript({ variant, weight: 'title', venue: '神奈川・元湯陣屋' });
      const card = script.cards.find(({ kind }) => kind === 'unseal');
      if (!card) continue;
      seen += 1;
      const same = script.comments.filter(({ at }) => at === card.at);
      expect(same.some(({ text }) => text === '対局再開')).toBe(true);
      const sealed = strip(card.text.replace(/^封じ手は/, ''));
      for (const { text } of same.filter(({ text }) => /封じ手は|最善と言われていた/.test(text))) expect(text).toContain(sealed);
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('形勢が3回入れ替わって勝ったら「A勝ちそう→B勝ちそう→A勝ちそう→さすがにB勝ち」と大逆転', () => {
    const evalOf = (index) => (index < 20 ? 0 : index < 45 ? 1200 : index < 70 ? -1200 : index < 90 ? 1200 : -1500);
    const script = longScript({ variant: 'b', white: suzuki(), evalOf, end: { winner: 'white', reason: 'resign' }, how: 'comeback' });
    const last = script.sfens.length - 1;
    const end = script.comments.filter(({ at }) => at === last).map(({ text }) => text);
    expect(end).toContain('中村勝ちそう→鈴木勝ちそう→中村勝ちそう→さすがに鈴木勝ち');
    expect(end.some((text) => /大逆転|二転三転|あの展開で後手/.test(text))).toBe(true);
    // 入れ替わりのない対局では言わない。
    const plain = longScript({ variant: 'b', white: suzuki(), evalOf: () => 300 });
    expect(plain.comments.some(({ text }) => /勝ちそう→/.test(text))).toBe(false);
  });

  it('負けが見えても投げない人(詰みまで指す・粘る)には「投了せずに行ける所まで行くのが○○流」。潔い人には言わない', () => {
    const evalOf = (index) => (index < 90 ? 100 : 5000);
    const said = (style) => variants.some((variant) => longScript({ variant, white: suzuki({ id: idOf(style) }), evalOf })
      .comments.some(({ text }) => text === '投了せずに行ける所まで行くのが鈴木流'));
    expect(said('full')).toBe(true);
    expect(said('clean')).toBe(false);
  });

  it('番勝負で挑戦者があと1敗で防衛を許す局(角番)、負けが見えたら「これで負けたら防衛だから粘るんやろ？」', () => {
    const evalOf = (index) => (index < 90 ? 100 : 5000);
    const said = (wins) => variants.some((variant) => longScript({ variant, weight: 'title', white: suzuki(), evalOf, series: { holder: 'black', need: 4, wins } })
      .comments.some(({ text }) => text === 'これで負けたら防衛だから粘るんやろ？'));
    expect(said({ black: 3, white: 1 })).toBe(true);
    expect(said({ black: 2, white: 1 })).toBe(false);
  });

  it('負けた側のいちばんの悪手を「転機は○○かぁ…」とふり返る(名詞はその手)', () => {
    let seen = 0;
    for (const variant of variants) {
      const script = longScript({ variant, white: suzuki() });
      const turning = script.comments.find(({ text }) => text.startsWith('転機は'));
      if (!turning) continue;
      seen += 1;
      // 後手(負けた側)の損の大きい手は、42手目(損520)。
      expect(turning.text).toBe(`転機は${strip(moveTextOf(script.sfens[41], script.moves[41], script.moves[40]))}かぁ…`);
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('分身の手には、ダメ・ミス・舐めプの一言を出さない', () => {
    const evalOf = (index) => (index < 80 ? Math.round(Math.sin(index / 7) * 900) : 4000);
    for (const variant of variants) {
      const script = longScript({ variant, weight: 'title', white: player('v', 'やこび', { kind: 'avatar' }), evalOf });
      // 後手(分身)の手は、偶数の手数。
      const harsh = script.comments.filter(({ at, text }) => at % 2 === 0 && /ダメだろ|ミス|舐めプ/.test(text));
      expect(harsh).toEqual([]);
      expect(script.comments.some(({ text }) => /やこび先生が寄せで/.test(text))).toBe(false);
    }
  });

  it('30章のコメントの穴埋め({name}など)が全部埋まり、同情の一言のほかに責める言葉がない', () => {
    const evalOf = (index) => (index < 20 ? 0 : index < 45 ? 1200 : index < 70 ? -1200 : index < 90 ? 1200 : -30000 + 120 - index);
    for (const variant of variants) {
      for (const script of [
        longScript({ variant, weight: 'title', venue: '神奈川・元湯陣屋', white: suzuki({ id: idOf('full') }), evalOf, end: { winner: 'white', reason: 'mate' } }),
        longScript({ variant, weight: 'big', white: player('y', '天鷺善彦', { story: YOSHIHIKO }) }),
      ]) {
        expect(script.comments.every(({ text }) => text && !/\{\w+\}|undefined|NaN|null/.test(text))).toBe(true);
        expect(script.comments.every(({ text }) => !/ひどい|大悪手|ミス|下手/.test(sympathyRemoved(text)))).toBe(true);
      }
    }
  });
});
