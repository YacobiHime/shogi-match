import { describe, expect, it } from 'vitest';
import {
  NOVEL_ACTS, NOVEL_CHARACTERS, NOVEL_EMOTES, checkScene, directionFields, fillScene, initialStage, lineDirection, lineMotionMs,
  lineStartDelayMs, speedFactor, stageAt, stageSlots,
} from './novel-direction.mjs';

const scene = (lines, extra = {}) => ({ id: 'test-scene', title: '題', summary: 'あらすじ', background: 'classroom', cast: ['hanane', 'momoka'], lines, ...extra });
const say = (who, text, fx = {}) => ({ who, face: 'neutral', name: '', text, ...fx });
const errors = (problems) => problems.filter((problem) => problem.level === 'error').map((problem) => problem.message);
const warns = (problems) => problems.filter((problem) => problem.level === 'warn').map((problem) => problem.message);

describe('演出の形(docs/novel-scene-design.mdの12-2)', () => {
  it('act・emoteは文字なら話す人、{who, …}ならその人。書かなければ空', () => {
    expect(lineDirection(say('hanane', 'あ', { act: 'hop', emote: { who: 'momoka', emote: 'heart' } }))).toMatchObject({
      acts: [{ who: 'hanane', act: 'hop' }], emotes: [{ who: 'momoka', emote: 'heart' }], screen: '', wait: 0,
    });
    expect(lineDirection(say('narration', 'x'))).toMatchObject({ acts: [], emotes: [], enter: [], exit: [], sfx: [] });
    expect(directionFields({ who: 'x', text: 'y', act: 'hop', bg: 'night', other: 1 })).toEqual({ act: 'hop', bg: 'night' });
  });

  it('文の待ち・速さ・動きの長さ', () => {
    expect(lineStartDelayMs(say('narration', 'x', { wait: 500 }))).toBe(500);
    expect(lineStartDelayMs(say('narration', 'x', { screen: 'blackout' }))).toBe(450);
    expect(lineStartDelayMs(say('narration', 'x', { wait: 99999 }))).toBe(3000);
    expect(speedFactor(say('hanane', 'x', { speed: 'slow' }))).toBeGreaterThan(1);
    expect(speedFactor(say('hanane', 'x'))).toBe(1);
    expect(lineMotionMs(say('hanane', 'x', { act: 'jump' }))).toBe(NOVEL_ACTS.jump.ms);
  });

  it('動きと漫符には、使い道の言葉と呼び名がある(ガイドの表の元)', () => {
    for (const entry of [...Object.values(NOVEL_ACTS), ...Object.values(NOVEL_EMOTES)]) {
      expect(entry.label).toBeTruthy();
      expect(entry.use).toBeTruthy();
      expect(entry.aliases.length).toBeGreaterThan(0);
    }
  });
});

describe('舞台の状態', () => {
  it('席は1人なら中、2人なら左右、3人なら左・中・右', () => {
    expect(stageSlots(1)).toEqual(['center']);
    expect(stageSlots(2)).toEqual(['left', 'right']);
    expect(stageSlots(3)).toEqual(['left', 'center', 'right']);
  });

  it('あとで登場する人ははじめ出ていない。登場はその行のはじめ、退場は言い終えてから', () => {
    const lines = [
      say('hanane', 'ひとり'),
      say('momoka', '来たよ', { enter: { who: 'momoka', from: 'right' } }),
      say('momoka', 'またね', { exit: 'momoka' }),
      say('hanane', 'ひとり'),
    ];
    const s = scene(lines);
    expect(initialStage(s)).toEqual(['hanane']);
    expect(stageAt(s, lines, 0)).toMatchObject({ onStage: ['hanane'], seats: { hanane: 'center' } });
    expect(stageAt(s, lines, 1)).toMatchObject({ onStage: ['hanane', 'momoka'], entering: { momoka: 'right' }, seats: { hanane: 'left', momoka: 'right' } });
    expect(stageAt(s, lines, 2).onStage).toEqual(['hanane', 'momoka']);
    expect(stageAt(s, lines, 3)).toMatchObject({ onStage: ['hanane'], leaving: ['momoka'] });
  });

  it('表情は話した行のface、話していない人はfacesで変わる。背景と色は続く', () => {
    const lines = [
      say('hanane', 'a', { face: 'smile' }),
      say('narration', 'b', { faces: { momoka: 'worried' }, bg: 'night', tone: 'memory' }),
      say('narration', 'c'),
    ];
    const state = stageAt(scene(lines), lines, 2);
    expect(state.faces).toEqual({ hanane: 'smile', momoka: 'worried' });
    expect(state).toMatchObject({ bg: 'night', tone: 'memory' });
  });
});

describe('検査(12-4)', () => {
  it('組み込みの形のよい場面はまちがいなし', () => {
    expect(errors(checkScene(scene([say('hanane', 'よろしく。'), say('momoka', 'よろしくね！', { act: 'hop' })])))).toEqual([]);
  });

  it('羽音の敬語と「！」はまちがい', () => {
    const problems = errors(checkScene(scene([say('hanane', 'よろしくお願いします。'), say('hanane', 'すごい！'), say('hanane', 'そうですね。')])));
    expect(problems).toHaveLength(3);
    expect(problems[0]).toContain('敬語');
    expect(problems[1]).toContain('「！」');
  });

  it('知らない人・表情・動き・背景、出ていない人の動き、4人目はまちがい', () => {
    const problems = errors(checkScene(scene([
      say('nobody', 'x'),
      say('momoka', 'x', { face: 'smile' }),
      say('hanane', 'x', { act: 'dance' }),
      say('narration', 'x', { bg: 'moon' }),
      say('narration', 'x', { act: 'hop' }),
    ])));
    expect(problems).toHaveLength(5);
    expect(problems[1]).toContain('neutral・wry・worried');
    expect(problems[4]).toContain('だれの動き');
  });

  it('退場は出ている人だけ。もう出ている人の登場は注意', () => {
    const problems = checkScene(scene([say('hanane', 'x', { exit: 'momoka' }), say('momoka', 'x', { exit: 'momoka' }), say('narration', 'x', { exit: 'momoka' })]));
    expect(errors(problems)).toEqual(['百花は出ていないので、退場できません。', '百花は出ていないので、退場できません。']);
    expect(warns(checkScene(scene([say('momoka', 'x', { enter: 'momoka' }), say('momoka', 'y', { enter: 'momoka' })])))[0]).toContain('もう出ています');
  });

  it('長い行・多い行・知らない差し込み・あらすじなしは注意(warn)', () => {
    const long = say('narration', 'あ'.repeat(61));
    const many = Array.from({ length: 13 }, () => say('narration', 'x'));
    expect(warns(checkScene(scene([long])))[0]).toContain('61字');
    expect(warns(checkScene(scene(many)))[0]).toContain('13行');
    expect(warns(checkScene(scene([say('narration', '{title}の日')]))).join()).toContain('{title}');
    expect(warns(checkScene(scene([say('narration', '{title}の日')]), { vars: ['title'] }))).toEqual([]);
    expect(warns(checkScene(scene([say('narration', 'x')], { summary: '' })))[0]).toContain('あらすじ');
  });

  it('選択肢の返しも検査する', () => {
    const lines = [{ ...say('host', '好きな駒は？'), choices: [{ label: '飛車', reply: [say('hanane', 'いいですね。')] }, { label: '', reply: [] }] }];
    const problems = errors(checkScene(scene(lines)));
    expect(problems.some((message) => message.includes('敬語'))).toBe(true);
    expect(problems.some((message) => message.includes('答えの文が空'))).toBe(true);
    expect(problems.some((message) => message.includes('返しの台詞がありません'))).toBe(true);
  });
});

describe('差し込み', () => {
  it('{name}・{you}・varsを、行・名前・選択肢・返しに入れる', () => {
    const filled = fillScene({
      id: 'x', summary: '{name}の話', lines: [
        { who: 'you', face: 'neutral', name: NOVEL_CHARACTERS.you.name, text: '{title}だ' },
        { who: 'host', face: 'neutral', name: '司会', text: '？', choices: [{ label: '{you}', reply: [{ who: 'momoka', face: 'neutral', name: '', text: '{you}！' }] }] },
      ],
    }, { playerName: 'やこび', vars: { title: '竜王' } });
    expect(filled.summary).toBe('やこびの話');
    expect(filled.lines[0]).toMatchObject({ name: 'やこび', text: '竜王だ' });
    expect(filled.lines[1].choices[0]).toMatchObject({ label: 'やこびさん', reply: [{ text: 'やこびさん！' }] });
  });
});

it('人物ごとの呼びかけを場面の関係で替え、百花だけに限定しない', () => {
  const input = scene([say('hanane', '{you}'), say('momoka', '{you}')]);
  const playerProfile = { family: '天鷺', given: '羽音', gender: 'female' };
  const result = fillScene(input, { playerProfile, relationships: { hanane: { part: 'given', style: 'bare' }, momoka: { style: 'familiar' } } });
  expect(result.lines.map(line => line.text)).toEqual(['羽音', '天鷺ちゃん']);
  expect(fillScene(input, { playerProfile }).lines[0].text).toBe('天鷺さん');
});
