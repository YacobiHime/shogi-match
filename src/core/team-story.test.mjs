import { describe, expect, it } from 'vitest';
import { NOVEL_BACKGROUNDS, NOVEL_MAX_LINES, NOVEL_PEOPLE, TEAM_SCENES, momentScene, portraitScale, portraitUrl, sceneText, teamMomentFor, teamScene } from './team-story.mjs';

const KEIGO = /です|ます|ございます|よろしくお願いします|ありがとうございました|負けました/;

describe('団体戦のノベルの場面(docs/team-battle-design.mdの6章)', () => {
  it('どの場面も12行まで。話す人・表情・背景は決まったものだけ', () => {
    for (const scene of Object.values(TEAM_SCENES)) {
      expect(scene.lines.length, scene.id).toBeGreaterThan(0);
      expect(scene.lines.length, scene.id).toBeLessThanOrEqual(NOVEL_MAX_LINES);
      expect(NOVEL_BACKGROUNDS).toContain(scene.background);
      for (const entry of scene.lines) {
        expect(Object.keys(NOVEL_PEOPLE)).toContain(entry.who);
        expect(NOVEL_PEOPLE[entry.who].faces, `${scene.id} ${entry.text}`).toContain(entry.face);
        if (entry.who !== 'narration') expect(scene.cast).toContain(entry.who);
      }
    }
  });

  it('羽音は敬語と「！」を使わない(docs/hanane-character.md)', () => {
    for (const scene of Object.values(TEAM_SCENES)) {
      for (const entry of scene.lines.filter(({ who }) => who === 'hanane')) {
        expect(entry.text, `${scene.id}: ${entry.text}`).not.toMatch(KEIGO);
        expect(entry.text, `${scene.id}: ${entry.text}`).not.toMatch(/！|!/);
      }
    }
  });

  it('最初は羽音に団体戦メンバーに誘われる(高校は百花も)', () => {
    const scene = teamScene('invite-school', 'やこび');
    expect(scene.cast).toEqual(['hanane', 'momoka']);
    expect(scene.lines[2].text).toMatch(/団体戦/);
    expect(scene.lines.some((entry) => entry.text.includes('やこびさん'))).toBe(true);
    expect(scene.lines.at(-1).text).toMatch(/やこびは、燈ヶ丘（ともりがおか）高校将棋部/);
    expect(teamScene('invite-pro').cast).toEqual(['hanane']);
  });

  it('名前がなければ「あなた」で呼ぶ', () => {
    expect(sceneText('{you}がいて', '')).toBe('あなたがいて');
    expect(sceneText('{name}は', '')).toBe('あなたは');
    expect(sceneText('{you}がいて', '羽')).toBe('羽さんがいて');
  });

  it('立ち絵は羽音と百花のファイル。百花は対局画面のやこび姫と同じ絵', () => {
    expect(portraitUrl('.', 'hanane', 'smile')).toBe('./characters/hanane-smile.webp?v=1');
    expect(portraitUrl('.', 'momoka', 'wry', { small: true })).toMatch(/^\.\/characters\/sakurano-momoka-wry-320\.webp\?v=/);
    expect(portraitUrl('.', 'momoka', 'neutral')).toMatch(/sakurano-momoka\.webp/);
  });

  it('節目の場面は形式と結果で選ぶ', () => {
    expect(momentScene({ format: 'school' }, 'start')).toBe('school-start');
    expect(momentScene({ format: 'pro' }, 'start')).toBeNull();
    expect(momentScene({ format: 'school', result: { place: 1 } }, 'end')).toBe('school-champion');
    expect(momentScene({ format: 'pro', result: { place: 8 } }, 'end')).toBe('pro-end');
    for (const moment of ['district', 'prefecture', 'start', 'knockout', 'final', 'end']) {
      for (const format of ['school', 'pro']) {
        const id = momentScene({ format, result: { place: 1 } }, moment);
        if (id) expect(TEAM_SCENES[id]).toBeTruthy();
      }
    }
  });

  it('高校は地区大会・県大会の始めに場面。決勝トーナメントと決勝の前は全国大会だけ(docs/team-battle-design.mdの15章)', () => {
    const view = (over) => ({ format: 'school', phase: 'ko', stage: 'district', seen: [], next: { label: '地区大会 1回戦', games: [] }, ...over });
    expect(teamMomentFor(view())).toBe('school-district');
    expect(teamMomentFor(view({ seen: ['school-district'] }))).toBe('');
    // 地区大会の決勝は、決勝の前の場面(全国の決勝)を出さない。
    expect(teamMomentFor(view({ seen: ['school-district'], next: { label: '地区大会 決勝', games: [] } }))).toBe('');
    expect(teamMomentFor(view({ stage: 'prefecture', seen: ['school-district'], next: { label: '県大会 準々決勝', games: [] } }))).toBe('school-prefecture');
    expect(teamMomentFor(view({ stage: 'national', phase: 'swiss', swiss: { round: 1 }, next: { label: '予選1回戦', games: [] } }))).toBe('school-start');
    expect(teamMomentFor(view({ stage: 'national', seen: ['school-knockout'], next: { label: '決勝トーナメント 決勝', games: [] } }))).toBe('school-final');
    expect(teamMomentFor(view({ stage: 'national', next: { label: '決勝トーナメント 1回戦', games: [] } }))).toBe('school-knockout');
    // 前の版の大会(段階がない)は全国大会。
    expect(teamMomentFor(view({ stage: undefined, phase: 'swiss', swiss: { round: 1 }, next: { label: '予選1回戦', games: [] } }))).toBe('school-start');
    expect(teamMomentFor(view({ phase: 'done', result: { place: 208 } }))).toBe('school-end');
    expect(teamMomentFor({ format: 'pro', phase: 'ko', seen: [], next: { label: '本戦 決勝', games: [] } })).toBe('pro-knockout');
    expect(teamMomentFor(null)).toBe('');
  });
});

describe('立ち絵の身長差(docs/novel-scene-design.mdの8・9章)', () => {
  it('羽音147cm・百花158cmの差を少し縮めて見せ(実際の差の6割)、1人のときはそのままの大きさ', () => {
    expect(portraitScale('momoka', ['hanane', 'momoka'])).toBe(1);
    expect(portraitScale('hanane', ['hanane', 'momoka'])).toBeCloseTo(1 - (1 - 147 / 158) * 0.6, 5);
    expect(portraitScale('hanane', ['hanane', 'momoka'])).toBeGreaterThan(147 / 158);
    expect(portraitScale('hanane', ['hanane', 'momoka'])).toBeLessThan(1);
    expect(portraitScale('hanane', ['hanane'])).toBe(1);
  });
});
