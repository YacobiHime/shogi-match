import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { SAMPLE_SCENE_ID, hasLibraryScene, libraryParsed, libraryScene, librarySceneIds } from './novel-library.mjs';
import { BACKGROUND_LABELS, ENTER_FROM, NOVEL_ACTS, NOVEL_BACKGROUND_IDS, NOVEL_CHARACTERS, NOVEL_EMOTES, NOVEL_SCREEN, NOVEL_TEXT_STYLES, NOVEL_TONES, checkScene } from './novel-direction.mjs';
import { SFX } from './novel-sound.mjs';
import { TEAM_SCENES, teamScene } from './team-story.mjs';
import { PRO_YEAR_SCENES, proYearScene } from './pro-year-story.mjs';
import { STORY_EPISODES, episodeState, mainEpisodeOpen } from './story-mode.mjs';

const errors = (problems) => problems.filter((problem) => problem.level === 'error');

describe('台本のファイル(src/story/scenes。docs/novel-scene-design.mdの12-4)', () => {
  it('どの台本もまちがいがなく、ファイルの名前とidが同じ', () => {
    expect(librarySceneIds()).toContain(SAMPLE_SCENE_ID);
    for (const id of librarySceneIds()) {
      const result = libraryParsed(id);
      expect(errors(result.problems), `${id}.md`).toEqual([]);
      expect(result.scene.id, `${id}.md`).toBe(id);
    }
  });

  it('見本の台本は注意もなく、すべての種類の演出を使う', () => {
    const { scene, problems } = libraryParsed(SAMPLE_SCENE_ID);
    expect(problems).toEqual([]);
    const used = JSON.stringify(scene.lines);
    for (const key of ['acts', 'emotes', 'enter', 'exit', 'screen', 'bg', 'tone', 'sfx', 'wait', 'size', 'speed']) expect(used, key).toContain(`"${key}"`);
    const filled = libraryScene(SAMPLE_SCENE_ID, { playerName: 'やこび' });
    expect(filled.lines.length).toBe(scene.lines.length);
    expect(hasLibraryScene('nope')).toBe(false);
    expect(libraryScene('nope')).toBeNull();
  });
});

describe('組み込みの場面の検査', () => {
  it('団体戦と棋士の1年の場面に、まちがいも注意もない(羽音の敬語と「！」も含む)', () => {
    for (const id of Object.keys(TEAM_SCENES)) expect(checkScene(teamScene(id, 'やこび')), id).toEqual([]);
    for (const id of Object.keys(PRO_YEAR_SCENES)) expect(checkScene(proYearScene(id, { playerName: 'やこび' }), { vars: ['title', 'holder', 'event', 'round'] }), id).toEqual([]);
  });

  it('演出の欄は場面の形まで届く', () => {
    expect(teamScene('school-champion').lines.some((line) => line.act === 'jump')).toBe(true);
    expect(proYearScene('pro-hanane').lines.some((line) => line.sfx === 'koma')).toBe(true);
  });
});

describe('物語のメインの話(12-6)', () => {
  const episodes = [
    { id: 'main:1', tab: 'main', no: 1, scene: SAMPLE_SCENE_ID },
    { id: 'main:2', tab: 'main', no: 2, scene: SAMPLE_SCENE_ID },
    { id: 'main:3', tab: 'main', no: 3, status: 'soon' },
  ];
  it('第一話はいつでも、第二話からは前の話を読むと開く。準備中はそのまま', () => {
    const empty = { unlocked: {}, read: {} };
    expect(episodeState(episodes[0], empty, episodes)).toBe('open');
    expect(episodeState(episodes[1], empty, episodes)).toBe('locked');
    expect(mainEpisodeOpen(episodes[1], { read: { 'main:1': 1 } }, episodes)).toBe(true);
    expect(episodeState(episodes[1], { unlocked: {}, read: { 'main:1': 1 } }, episodes)).toBe('open');
    expect(episodeState(episodes[2], empty, episodes)).toBe('soon');
    expect(episodeState({ ...episodes[0], scene: 'no-file' }, empty, episodes)).toBe('locked');
  });
  it('いまの目録のメインは準備中のまま(台本はまだない)', () => {
    expect(STORY_EPISODES.filter((episode) => episode.tab === 'main').every((episode) => episode.status === 'soon')).toBe(true);
  });
});

describe('作り方ガイドが語彙とそろっている(docs/novel-authoring-guide.md)', () => {
  const guide = readFileSync(new URL('../../docs/novel-authoring-guide.md', import.meta.url), 'utf8');
  it('人物・表情・動き・漫符・画面・色・背景・効果音・文・登場の向きのidを、ガイドの表に全部書いてある', () => {
    const ids = [
      ...Object.keys(NOVEL_CHARACTERS), ...Object.values(NOVEL_CHARACTERS).flatMap((c) => c.faces), ...Object.keys(NOVEL_ACTS),
      ...Object.keys(NOVEL_EMOTES), ...Object.keys(NOVEL_SCREEN), ...Object.keys(NOVEL_TONES), ...NOVEL_BACKGROUND_IDS,
      ...Object.keys(SFX), ...Object.keys(NOVEL_TEXT_STYLES), ...Object.keys(ENTER_FROM),
    ];
    for (const id of new Set(ids)) expect(guide, id).toContain(`\`${id}\``);
    for (const label of Object.values(BACKGROUND_LABELS)) expect(guide).toContain(label);
  });
});
