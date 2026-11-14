// 物語モードのストーリー選択(docs/story-mode-design.md)。話の目録・カードの状態・進み具合の保存。画面に依存しない。
// メインは本編(まだ準備中)、サブは大会で見た場面をもう一度読む話(いまは団体戦の場面。team-story.mjs)。
// 話を足すときは、STORY_EPISODESに1行足す(5章)。メインの話の台本はsrc/story/scenes/<id>.md(docs/novel-authoring-guide.md)。

import { TEAM_SCENES, teamScene } from './team-story.mjs';
import { PRO_YEAR_SCENES, proYearScene } from './pro-year-story.mjs';
import { isSceneRead } from './novel-ui.mjs';
import { hasLibraryScene, libraryParsed, libraryScene } from './novel-library.mjs';

export const STORY_PROGRESS_KEY = 'yacobihime:shogi-match:story:v1';

/** 押せない話を押したときの一言を出す時間(ms)。そのあと、もとの案内の一文に戻る(3章の5)。 */
export const STORY_NOTICE_MS = 4000;

/** タブ(ユーザーの指定でメインとサブ)。toneは色(メインは桃色、サブは水色)。 */
export const STORY_TABS = Object.freeze([
  Object.freeze({ id: 'main', label: 'メイン', tone: 'pink' }),
  Object.freeze({ id: 'sub', label: 'サブ', tone: 'blue' }),
]);
export const STORY_TAB_IDS = Object.freeze(STORY_TABS.map((tab) => tab.id));

/** 画面の言葉(U:4 文言はまとめる)。案内の一文は、参考の画像と同じく丁寧な形にする。 */
export const STORY_TEXT = Object.freeze({
  title: 'ストーリー選択',
  intro: Object.freeze({
    main: 'メインストーリーの一覧です。読みたい話を選んでください。',
    sub: 'サブストーリーの一覧です。大会で見た場面を、もう一度読めます。',
  }),
  ribbon: Object.freeze({ soon: '準備中', locked: '未開放' }),
  read: '読んだ',
  readMark: '済',
  isNew: 'NEW',
});

/** 押せない話の一言(不可の分類。理由と、どうすれば読めるか。UD:5-3)。 */
export function storyNotice(card) {
  if (!card) return '';
  if (card.state === 'soon') return `${card.title ? `${card.label}「${card.title}」` : 'この話'}はただいま準備中です。完成をお楽しみに。`;
  if (card.state === 'locked') return `まだ読めません。${card.unlock || '大会を進めると読めます。'}`;
  return '';
}

const KANJI_DIGITS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
/** 1〜99を漢数字に(第一話・第十二話)。 */
export function kanjiNumber(value) {
  const n = Math.max(1, Math.min(99, Math.round(Number(value) || 1)));
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return `${tens ? `${tens > 1 ? KANJI_DIGITS[tens] : ''}十` : ''}${KANJI_DIGITS[ones]}`;
}

const sub = (scene, label, unlock) => {
  const pro = scene in PRO_YEAR_SCENES;
  const source = pro ? PRO_YEAR_SCENES[/** @type {keyof typeof PRO_YEAR_SCENES} */ (scene)] : TEAM_SCENES[/** @type {keyof typeof TEAM_SCENES} */ (scene)];
  return Object.freeze({
    id: `${pro ? 'pro' : 'team'}:${scene}`,
    tab: 'sub',
    label,
    title: source.title,
    cast: Object.freeze([...source.cast]),
    background: source.background,
    scene,
    unlock,
  });
};

/** 台本のファイルの場面のサブ(棋士の1年の絆の場面。15-3の4)。物語の画面から読むときの差し込みはvars。 */
const fileSub = (scene, label, unlock, vars = {}) => {
  const source = libraryParsed(scene)?.scene;
  return Object.freeze({
    id: `pro:${scene}`,
    tab: 'sub',
    label,
    title: source?.title ?? '',
    cast: Object.freeze([...(source?.cast ?? [])]),
    background: source?.background ?? 'room',
    scene,
    unlock,
    vars: Object.freeze({ ...vars }),
  });
};
/** 物語の画面から読み直すときの、5人の呼び名(棋士の1年の中では本当の名前が入る)。 */
const BOND_VARS = Object.freeze({ mentor: '師匠', senior: '兄弟子', peer: '同期の仲間' });
const BOND_LABELS = Object.freeze({ mentor: '師匠', senior: '兄弟子', hanane: '羽音', peer: '同期' });
const bondSubs = () => [['mentor', [2, 3, 4, 5]], ['senior', [2, 3, 4, 5]], ['hanane', [2, 3, 4, 5]], ['peer', [3, 5]]]
  .flatMap(([role, levels]) => levels.map((level) => fileSub(`pro-bond-${role}-${level}`, '棋士の1年', `棋士の1年で、${BOND_LABELS[role]}との絆が段${level}になると読めます。`, BOND_VARS)));

/**
 * 話の目録(並びは画面の並び)。
 * メインはno(第○話)と、まだ書いていない話のstatus: 'soon'。台本(src/story/scenes/<scene>.md)ができたら、scene: '<台本のid>'を書き、
 * status: 'soon'を消すと読める(第一話はいつでも、第二話からは前の話を読むと開く。docs/novel-scene-design.mdの12-6)。
 * サブはscene(台本のid)と、開き方の一言unlock。
 * @type {readonly { id: string, tab: 'main' | 'sub', no?: number, label?: string, title: string, cast: readonly string[], background: string, scene?: string, status?: 'soon', unlock?: string, vars?: Record<string, string>, relationships?: any }[]}
 */
export const STORY_EPISODES = Object.freeze([
  Object.freeze({ id: 'main:1', tab: 'main', no: 1, title: 'プロローグ', cast: Object.freeze(['momoka']), background: 'classroom', status: 'soon' }),
  Object.freeze({ id: 'main:2', tab: 'main', no: 2, title: '', cast: Object.freeze(['momoka']), background: 'classroom', status: 'soon' }),
  sub('invite-school', '団体戦（高校）', '団体戦で、羽音に誘われると読めます。'),
  sub('school-district', '団体戦（高校）', '高校の団体戦の地区大会に出ると読めます。'),
  sub('school-prefecture', '団体戦（高校）', '地区大会を勝ち抜くと読めます。'),
  sub('school-start', '団体戦（高校）', '県大会で優勝すると読めます。'),
  sub('school-knockout', '団体戦（高校）', '全国大会の予選を抜けると読めます。'),
  sub('school-final', '団体戦（高校）', '全国大会の決勝まで進むと読めます。'),
  sub('school-champion', '団体戦（高校）', '全国大会で優勝すると読めます。'),
  sub('school-end', '団体戦（高校）', '高校の団体戦を最後まで戦うと読めます。'),
  sub('invite-pro', '団体戦（プロ）', '団体戦で、プロの早指し団体戦を選ぶと読めます。'),
  sub('pro-knockout', '団体戦（プロ）', '早指し団体戦の予選を抜けると読めます。'),
  sub('pro-champion', '団体戦（プロ）', '早指し団体戦で優勝すると読めます。'),
  sub('pro-end', '団体戦（プロ）', '早指し団体戦を最後まで戦うと読めます。'),
  sub('pro-debut', '棋士の1年', '棋士の1年でデビューすると読めます。'),
  sub('pro-debut-shoreikai', '棋士の1年', '奨励会で四段になって、棋士の1年でデビューすると読めます。'),
  sub('pro-hanane', '棋士の1年', '棋士の1年で、羽音と公式戦で当たると読めます。'),
  sub('pro-title-eve', '棋士の1年', '棋士の1年で、タイトル戦に出ると読めます。'),
  // 防衛戦の夜(docs/pro-year-design.mdの20章)。
  sub('pro-defense-eve', '棋士の1年', '棋士の1年で、タイトルの防衛戦に出ると読めます。'),
  sub('pro-defense-eternal', '棋士の1年', '棋士の1年で、永世称号がかかる防衛戦に出ると読めます。'),
  sub('pro-defense-streak', '棋士の1年', '棋士の1年で、タイトルを3連覇すると読めます。'),
  sub('pro-eternal', '棋士の1年', '棋士の1年で、永世称号の資格を得ると読めます。'),
  sub('pro-all-crowns', '棋士の1年', '棋士の1年で、八つのタイトルをすべて持つと読めます。'),
  sub('pro-title-lost', '棋士の1年', '棋士の1年で、タイトルを失うと読めます。'),
  ...bondSubs(),
]);

/** 目録の話(idから)。 */
export const storyEpisode = (id) => STORY_EPISODES.find((episode) => episode.id === id) ?? null;
/** 台本のidから、その場面を読むサブの話。 */
export const episodeOfScene = (sceneId) => STORY_EPISODES.find((episode) => episode.scene === sceneId) ?? null;

/** 帯の言葉(メインは「第一話」、サブは出どころ)。 */
export function episodeLabel(episode) {
  if (!episode) return '';
  if (episode.tab === 'main') return `第${kanjiNumber(episode.no ?? 1)}話`;
  return episode.label ?? '';
}

/** 空の進み具合。unlocked・read・openedは話のidと時刻。lastは最後に見たタブと話(次に開いたときの位置)。 */
export function emptyStoryProgress() {
  return { version: 1, unlocked: {}, read: {}, opened: {}, last: { tab: 'main', id: '' } };
}

/** 読み込んだ値を整える(壊れていたら空)。 */
export function normalizeStoryProgress(value) {
  const base = emptyStoryProgress();
  if (!value || typeof value !== 'object' || value.version !== 1) return base;
  const stamps = (entry) => Object.fromEntries(Object.entries(entry && typeof entry === 'object' ? entry : {})
    .filter(([id, at]) => storyEpisode(id) && Number.isFinite(at)));
  const tab = STORY_TAB_IDS.includes(value.last?.tab) ? value.last.tab : 'main';
  const id = storyEpisode(value.last?.id)?.tab === tab ? value.last.id : '';
  return { version: 1, unlocked: stamps(value.unlocked), read: stamps(value.read), opened: stamps(value.opened), last: { tab, id } };
}

/**
 * @param {Pick<Storage, 'getItem'> | null | undefined} storage
 */
export function loadStoryProgress(storage) {
  try {
    const raw = storage?.getItem(STORY_PROGRESS_KEY);
    return normalizeStoryProgress(raw ? JSON.parse(raw) : null);
  } catch {
    return emptyStoryProgress();
  }
}

/**
 * @param {Pick<Storage, 'setItem'> | null | undefined} storage
 * @param {any} progress
 */
export function saveStoryProgress(storage, progress) {
  try {
    storage?.setItem(STORY_PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // 保存できなくても読める。
  }
}

const stamp = (progress, field, id, at) => (!id || progress[field][id] ? progress : { ...progress, [field]: { ...progress[field], [id]: at } });

/** 台本の場面を見たら、その場面のサブの話を開く(団体戦で場面を見た直後。3章の7)。 */
export function unlockStoryScene(progress, sceneId, at = Date.now()) {
  const episode = episodeOfScene(sceneId);
  return episode ? stamp(progress, 'unlocked', episode.id, at) : progress;
}
/** 物語の画面で話を開いた(NEWを消す)。 */
export const markStoryOpened = (progress, id, at = Date.now()) => stamp(progress, 'opened', id, at);
/** 最後の行まで読んだ(「済」の印)。 */
export const markStoryRead = (progress, id, at = Date.now()) => stamp(progress, 'read', id, at);
/** 最後に見たタブと話(次に開いたときの位置)。 */
export function rememberStoryPlace(progress, tab, id) {
  const nextTab = STORY_TAB_IDS.includes(tab) ? tab : 'main';
  const nextId = storyEpisode(id)?.tab === nextTab ? id : '';
  if (progress.last?.tab === nextTab && progress.last?.id === nextId) return progress;
  return { ...progress, last: { tab: nextTab, id: nextId } };
}

/**
 * 遊びの中で見た場面から、開いたサブの話を拾う(消さない)。読んだ印(novel-read:v1)に行がある場面、
 * 団体戦の経歴の誘い(invited)と、いまの大会の見た場面(seen)。
 * @param {any} progress
 * @param {{ read?: { scenes?: Record<string, string[]> } | null, teamCareer?: any, at?: number }} sources
 * @returns {{ progress: any, changed: boolean }}
 */
export function syncStoryUnlocks(progress, { read = null, teamCareer = null, at = Date.now() } = {}) {
  const seen = new Set(Object.entries(read?.scenes ?? {}).filter(([, keys]) => Array.isArray(keys) && keys.length).map(([id]) => id));
  if (teamCareer?.invited?.school) seen.add('invite-school');
  if (teamCareer?.invited?.pro) seen.add('invite-pro');
  for (const id of teamCareer?.current?.seen ?? []) seen.add(id);
  let next = progress;
  for (const sceneId of seen) next = unlockStoryScene(next, sceneId, at);
  return { progress: next, changed: next !== progress };
}

/** 話をノベルの場面の形にする(いまは団体戦の台本)。読めない話はnull。 */
export function storyScene(episode, playerName = '', momokaCall = '', playerProfile = null) {
  if (!episode?.scene) return null;
  if (hasLibraryScene(episode.scene)) return libraryScene(episode.scene, { playerName, momokaCall, playerProfile, relationships: episode.relationships ?? { momoka: { style: 'familiar' } }, vars: episode.vars ?? {} });
  if (episode.scene in PRO_YEAR_SCENES) return proYearScene(episode.scene, { playerName, momokaCall });
  return teamScene(episode.scene, playerName, momokaCall);
}

/**
 * タブのカード(画面の形)。stateは読める(open)・準備中(soon)・未開放(locked)。
 * 読んだかは、物語の画面で最後まで読んだ印か、ノベルの場面の読んだ印で全部の行を読んだか。
 * @param {any} progress
 * @param {'main' | 'sub'} tab
 * @param {{ read?: any, playerName?: string }} [options]
 */
export function storyCards(progress, tab, { read = null, playerName = '' } = {}) {
  return STORY_EPISODES.filter((episode) => episode.tab === tab).map((episode) => {
    const state = episodeState(episode, progress);
    const scene = state === 'open' ? storyScene(episode, playerName) : null;
    const done = state === 'open' && (Boolean(progress.read[episode.id]) || Boolean(read && scene && isSceneRead(read, scene)));
    return {
      id: episode.id,
      tab: episode.tab,
      label: episodeLabel(episode),
      // 題名のない準備中の話と未開放の話は、題名を出さない(模様と札だけ。1章)。
      title: state === 'locked' ? '' : episode.title,
      state,
      read: done,
      isNew: state === 'open' && !done && !progress.opened[episode.id],
      cast: [...episode.cast],
      background: episode.background,
      unlock: episode.unlock ?? (episode.tab === 'main' ? '前の話を読むと読めます。' : ''),
      patterned: state === 'locked' || (state === 'soon' && !episode.title),
    };
  });
}

/** メインの話が開いているか(第一話はいつでも、第二話からは前の話を読んだら)。 */
export function mainEpisodeOpen(episode, progress, episodes = STORY_EPISODES) {
  const mains = episodes.filter((entry) => entry.tab === 'main');
  const at = mains.indexOf(episode);
  if (at <= 0) return at === 0;
  return Boolean(progress.read?.[mains[at - 1].id]);
}

/**
 * 話の状態。準備中(soon)・読める(open)・未開放(locked)。メインは台本があって前の話を読んだら、サブは大会で場面を見たら読める。
 * @param {any} episode
 * @param {any} progress
 * @param {readonly any[]} [episodes]
 */
export function episodeState(episode, progress, episodes = STORY_EPISODES) {
  if (episode.status === 'soon') return 'soon';
  if (!episode.scene) return 'locked';
  if (episode.tab === 'main') return hasLibraryScene(episode.scene) && mainEpisodeOpen(episode, progress, episodes) ? 'open' : 'locked';
  return progress.unlocked[episode.id] ? 'open' : 'locked';
}

/** タブのNEWの数(タブの札に小さく出す)。 */
export function storyNewCount(progress, tab, options = {}) {
  return storyCards(progress, tab, options).filter((card) => card.isNew).length;
}
