// 物語モードのストーリー選択(docs/story-mode-design.md)。話の目録・カードの状態・進み具合の保存。画面に依存しない。
// メインは本編(まだ準備中)、サブは大会で見た場面をもう一度読む話(いまは団体戦の場面。team-story.mjs)。
// 話を足すときは、STORY_EPISODESに1行足す(5章)。

import { TEAM_SCENES, teamScene } from './team-story.mjs';
import { isSceneRead } from './novel-ui.mjs';

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
  bar: Object.freeze({ tab: 'タブ切り替え', select: '選択', decide: '決定', back: '戻る' }),
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
  const source = TEAM_SCENES[/** @type {keyof typeof TEAM_SCENES} */ (scene)];
  return Object.freeze({
    id: `team:${scene}`,
    tab: 'sub',
    label,
    title: source.title,
    cast: Object.freeze([...source.cast]),
    background: source.background,
    scene,
    unlock,
  });
};

/**
 * 話の目録(並びは画面の並び)。
 * メインはno(第○話)と、まだ書いていない話のstatus: 'soon'。サブはscene(台本のid)と、開き方の一言unlock。
 * @type {readonly { id: string, tab: 'main' | 'sub', no?: number, label?: string, title: string, cast: readonly string[], background: string, scene?: string, status?: 'soon', unlock?: string }[]}
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
export function storyScene(episode, playerName = '', momokaCall = '') {
  if (!episode?.scene) return null;
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
    const state = episode.status === 'soon' ? 'soon' : episode.scene && progress.unlocked[episode.id] ? 'open' : 'locked';
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
      unlock: episode.unlock ?? '',
      patterned: state === 'locked' || (state === 'soon' && !episode.title),
    };
  });
}

/** タブのNEWの数(タブの札に小さく出す)。 */
export function storyNewCount(progress, tab, options = {}) {
  return storyCards(progress, tab, options).filter((card) => card.isNew).length;
}
