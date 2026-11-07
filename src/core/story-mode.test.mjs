import { libraryParsed } from './novel-library.mjs';
import { PRO_YEAR_SCENES } from './pro-year-story.mjs';
import { describe, expect, it } from 'vitest';
import {
  STORY_EPISODES, STORY_PROGRESS_KEY, STORY_TABS, emptyStoryProgress, episodeLabel, episodeOfScene, kanjiNumber, loadStoryProgress,
  markStoryOpened, markStoryRead, normalizeStoryProgress, rememberStoryPlace, saveStoryProgress, storyCards, storyEpisode,
  storyNewCount, storyNotice, storyScene, syncStoryUnlocks, unlockStoryScene,
} from './story-mode.mjs';
import { TEAM_SCENES } from './team-story.mjs';
import { lineKey, markLineRead } from './novel-ui.mjs';

const memory = () => {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), data };
};

describe('ストーリー選択の目録(docs/story-mode-design.md)', () => {
  it('タブはメインとサブ。メインは「第一話」、サブは出どころの帯', () => {
    expect(STORY_TABS.map((tab) => tab.id)).toEqual(['main', 'sub']);
    expect(STORY_TABS.map((tab) => tab.label)).toEqual(['メイン', 'サブ']);
    expect(episodeLabel(storyEpisode('main:1'))).toBe('第一話');
    expect(episodeLabel(storyEpisode('team:invite-school'))).toBe('団体戦（高校）');
    expect(kanjiNumber(1)).toBe('一');
    expect(kanjiNumber(10)).toBe('十');
    expect(kanjiNumber(12)).toBe('十二');
    expect(kanjiNumber(25)).toBe('二十五');
  });

  it('サブの話は団体戦と棋士の1年の台本の場面で、idと場面は1対1。メインは準備中', () => {
    const ids = STORY_EPISODES.map((episode) => episode.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const episode of STORY_EPISODES.filter((entry) => entry.tab === 'sub')) {
      // サブは団体戦の場面と、棋士の1年の場面(pro-year-story.mjs と、絆の場面の台本のファイル)。
      const source = TEAM_SCENES[episode.scene] ?? PRO_YEAR_SCENES[episode.scene] ?? libraryParsed(episode.scene)?.scene;
      expect(source).toBeTruthy();
      expect(episode.title).toBe(source.title);
      expect(episode.unlock).toMatch(/読めます。$/);
      expect(episodeOfScene(episode.scene)).toBe(episode);
    }
    // 団体戦の場面はどれもサブで読める。
    for (const sceneId of Object.keys(TEAM_SCENES)) expect(episodeOfScene(sceneId)).toBeTruthy();
    expect(STORY_EPISODES.filter((entry) => entry.tab === 'main').every((entry) => entry.status === 'soon')).toBe(true);
  });

  it('棋士の1年の絆の場面14本は、物語の画面から呼び名を入れて読める(15-3の4)', () => {
    const bonds = STORY_EPISODES.filter((entry) => /^pro-bond-/.test(entry.scene ?? ''));
    expect(bonds).toHaveLength(14);
    const scene = storyScene(bonds[0], 'やこび');
    expect(scene.lines.some((line) => line.name === '師匠')).toBe(true);
    expect(scene.lines.every((line) => !/\{(mentor|senior|peer)\}/.test(`${line.name}${line.text}`))).toBe(true);
  });
});

describe('カードの状態', () => {
  it('はじめは、メインは準備中・サブは未開放。題名のない準備中と未開放は模様だけ', () => {
    const progress = emptyStoryProgress();
    const main = storyCards(progress, 'main');
    expect(main[0]).toMatchObject({ label: '第一話', title: 'プロローグ', state: 'soon', patterned: false, isNew: false });
    expect(main[1]).toMatchObject({ label: '第二話', title: '', state: 'soon', patterned: true });
    const sub = storyCards(progress, 'sub');
    expect(sub.every((card) => card.state === 'locked' && card.patterned && card.title === '')).toBe(true);
    expect(storyNotice(main[0])).toBe('第一話「プロローグ」はただいま準備中です。完成をお楽しみに。');
    expect(storyNotice(main[1])).toBe('この話はただいま準備中です。完成をお楽しみに。');
    expect(storyNotice(sub[0])).toBe('まだ読めません。団体戦で、羽音に誘われると読めます。');
  });

  it('場面を見ると開き、NEW。物語の画面で開くとNEWが消え、最後まで読むと「済」', () => {
    let progress = unlockStoryScene(emptyStoryProgress(), 'invite-school', 10);
    let card = storyCards(progress, 'sub')[0];
    expect(card).toMatchObject({ id: 'team:invite-school', state: 'open', title: '放課後の空き教室', isNew: true, read: false, patterned: false });
    expect(storyNewCount(progress, 'sub')).toBe(1);
    expect(storyNotice(card)).toBe('');
    progress = markStoryOpened(progress, card.id, 11);
    card = storyCards(progress, 'sub')[0];
    expect(card.isNew).toBe(false);
    progress = markStoryRead(progress, card.id, 12);
    expect(storyCards(progress, 'sub')[0].read).toBe(true);
    // 同じ記録は時刻を変えない(何度読んでも)。
    expect(markStoryRead(progress, card.id, 99)).toBe(progress);
  });

  it('団体戦で全部の行を読んだ場面は、物語の画面で読まなくても「済」', () => {
    const progress = unlockStoryScene(emptyStoryProgress(), 'pro-champion', 1);
    const scene = storyScene(storyEpisode('team:pro-champion'), 'やこび');
    let read = { order: [], scenes: {} };
    for (const line of scene.lines) read = markLineRead(read, scene.id, lineKey(line));
    const card = storyCards(progress, 'sub', { read, playerName: 'やこび' }).find((entry) => entry.id === 'team:pro-champion');
    expect(card).toMatchObject({ read: true, isNew: false });
  });
});

describe('開いた話を拾う(3章の7)', () => {
  it('読んだ印に行がある場面・団体戦の誘い・いまの大会の見た場面から開く。消さない', () => {
    const read = { order: ['school-final'], scenes: { 'school-final': ['x'], 'talk-1': ['y'], empty: [] } };
    const teamCareer = { invited: { school: true, pro: false }, current: { seen: ['school-district'] } };
    const { progress, changed } = syncStoryUnlocks(emptyStoryProgress(), { read, teamCareer, at: 5 });
    expect(changed).toBe(true);
    expect(Object.keys(progress.unlocked).sort()).toEqual(['team:invite-school', 'team:school-district', 'team:school-final']);
    // もう一度拾っても変わらない。読んだ印が消えても、開いた話は残る。
    expect(syncStoryUnlocks(progress, { read, teamCareer, at: 9 })).toEqual({ progress, changed: false });
    expect(syncStoryUnlocks(progress, {}).progress.unlocked).toEqual(progress.unlocked);
  });

  it('知らない場面は開かない', () => {
    expect(unlockStoryScene(emptyStoryProgress(), 'talk-3', 1)).toEqual(emptyStoryProgress());
  });
});

describe('保存', () => {
  it('開いた話・読んだ話・最後に見たタブと話を残す。壊れた保存は空', () => {
    const storage = memory();
    let progress = unlockStoryScene(emptyStoryProgress(), 'invite-pro', 3);
    progress = rememberStoryPlace(progress, 'sub', 'team:invite-pro');
    saveStoryProgress(storage, progress);
    expect(JSON.parse(storage.data.get(STORY_PROGRESS_KEY))).toEqual(progress);
    expect(loadStoryProgress(storage)).toEqual(progress);
    // タブと合わない話・目録にない話は捨てる。
    expect(rememberStoryPlace(progress, 'main', 'team:invite-pro').last).toEqual({ tab: 'main', id: '' });
    expect(normalizeStoryProgress({ version: 1, unlocked: { 'team:nope': 1, 'team:invite-pro': 2 }, last: { tab: 'x' } }))
      .toEqual({ ...emptyStoryProgress(), unlocked: { 'team:invite-pro': 2 } });
    storage.setItem(STORY_PROGRESS_KEY, '{broken');
    expect(loadStoryProgress(storage)).toEqual(emptyStoryProgress());
    expect(loadStoryProgress(null)).toEqual(emptyStoryProgress());
  });
});
