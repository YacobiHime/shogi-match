import { describe, expect, it } from 'vitest';
import { NOVEL_BACKGROUNDS, NOVEL_MAX_LINES, NOVEL_PEOPLE, TEAM_SCENES, momentScene, portraitUrl, sceneText, teamScene } from './team-story.mjs';

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
    for (const moment of ['start', 'knockout', 'final', 'end']) {
      for (const format of ['school', 'pro']) {
        const id = momentScene({ format, result: { place: 1 } }, moment);
        if (id) expect(TEAM_SCENES[id]).toBeTruthy();
      }
    }
  });
});
