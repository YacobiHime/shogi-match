import { describe, expect, it } from 'vitest';
import { formatProblems, parseNovelScript } from './novel-script.mjs';

const head = '# 題\nid: t-1\nbg: classroom\ncast: hanane momoka\nsummary: あらすじ。\n\n';
const read = (body, header = head) => parseNovelScript(header + body);
const errorsOf = (result) => result.problems.filter((problem) => problem.level === 'error');

describe('台本のテキストを読む(docs/novel-scene-design.mdの12-3)', () => {
  it('頭の項目・地の文・台詞・表情の呼び名', () => {
    const { scene, problems } = read(': 地の文。\n羽音: やあ。\n百花(苦笑い): えへへ！\nmomoka(worried): どうしよう！');
    expect(errorsOf({ problems })).toEqual([]);
    expect(scene).toMatchObject({ id: 't-1', title: '題', background: 'classroom', cast: ['hanane', 'momoka'], summary: 'あらすじ。' });
    expect(scene.lines.map((line) => [line.who, line.face, line.text, line.src])).toEqual([
      ['narration', 'neutral', '地の文。', 7], ['hanane', 'neutral', 'やあ。', 8], ['momoka', 'wry', 'えへへ！', 9], ['momoka', 'worried', 'どうしよう！', 10],
    ]);
    expect(scene.lines[1].name).toBe('天鷺羽音');
  });

  it('演出: 話す人の動き・漫符、ほかの人の動き・表情、画面・背景・色・音・間・文', () => {
    const { scene, problems } = read('羽音: x [ぴょん] [！] [百花:うなずく 百花:worried] [揺れる] [bg:夜] [回想] [音:きらり] [間:300] [大きく] [ゆっくり]\n百花: y');
    expect(errorsOf({ problems })).toEqual([]);
    expect(scene.lines[0]).toMatchObject({
      acts: [{ who: 'hanane', act: 'hop' }, { who: 'momoka', act: 'nod' }],
      emotes: [{ who: 'hanane', emote: 'surprise' }],
      faces: { momoka: 'worried' }, screen: 'quake', bg: 'night', tone: 'memory', sfx: ['chime'], wait: 300, size: 'big', speed: 'slow',
    });
  });

  it('演出だけの行は次の行に付く。登場・退場', () => {
    const { scene, problems } = read('羽音: ひとり。\n[暗転] [sfx:door]\n百花: 来たよ！ [enter:左]\n百花: またね！ [退場]\n羽音: うん。');
    expect(errorsOf({ problems })).toEqual([]);
    expect(scene.lines[1]).toMatchObject({ screen: 'blackout', sfx: ['door'], enter: [{ who: 'momoka', from: 'left' }] });
    expect(scene.lines[2].exit).toEqual(['momoka']);
  });

  it('選択肢と返し、声だけの人、変数、メモ', () => {
    const { scene, problems } = read('// メモ\n店員: 好きな戦法は？\n- 居飛車 {ibisha}\n  羽音(smile): 私も。\n- 振り飛車\n  羽音: そうなんだ。\n: 拍手。', head.replace('summary', 'voices: 店員\nvars: title\nsummary'));
    expect(errorsOf({ problems })).toEqual([]);
    expect(scene.vars).toEqual(['title']);
    expect(scene.lines).toHaveLength(2);
    expect(scene.lines[0]).toMatchObject({ who: 'extra', name: '店員' });
    expect(scene.lines[0].choices).toEqual([
      { label: '居飛車', value: 'ibisha', reply: [expect.objectContaining({ who: 'hanane', face: 'smile', text: '私も。' })] },
      { label: '振り飛車', value: '', reply: [expect.objectContaining({ text: 'そうなんだ。' })] },
    ]);
  });

  it('まちがいは行の番号と直し方で返す', () => {
    const result = read('善彦: こんにちは。\n羽音: よろしくお願いします！\n百花: x [おどる]\nふつうの文\n  羽音: 下げた行');
    const lines = formatProblems(result.problems);
    expect(lines.some((text) => text.startsWith('7: まちがい') && text.includes('「善彦」'))).toBe(true);
    expect(lines.filter((text) => text.startsWith('8: まちがい'))).toHaveLength(2);
    expect(lines.some((text) => text.startsWith('9: まちがい') && text.includes('「おどる」'))).toBe(true);
    expect(lines.some((text) => text.startsWith('10: まちがい') && text.includes('読めない行'))).toBe(true);
    expect(lines.some((text) => text.startsWith('11: まちがい') && text.includes('選択肢'))).toBe(true);
  });

  it('id・題名・本文がなければまちがい', () => {
    expect(errorsOf(parseNovelScript('')).map((problem) => problem.message).join()).toMatch(/id.*題名.*本文/s);
  });
});
