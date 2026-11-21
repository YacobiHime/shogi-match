// 物語モードのストーリー選択(docs/story-mode-design.md)。話の目録・カードの状態・進み具合の保存。画面に依存しない。
// メインは本編(まだ準備中)、サブは大会で見た場面をもう一度読む話(いまは団体戦の場面。team-story.mjs)。
// 話を足すときは、STORY_EPISODESに1行足す(5章)。メインの話の台本はsrc/story/scenes/<id>.md(docs/novel-authoring-guide.md)。

import { TEAM_SCENES, teamScene } from './team-story.mjs';
import { PRO_YEAR_SCENES, proYearScene } from './pro-year-story.mjs';
import { isSceneRead } from './novel-ui.mjs';
import { hasLibraryScene, libraryParsed, libraryScene } from './novel-library.mjs';
import { DISCIPLES } from './disciple-strength.mjs';

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

/** 台本のファイルの場面のサブ(棋士の1年の絆の場面。15-3の4)。物語の画面から読むときの差し込みはvars。idの頭はprefix。 */
const fileSub = (scene, label, unlock, vars = {}, prefix = 'pro') => {
  const source = libraryParsed(scene)?.scene;
  return Object.freeze({
    id: `${prefix}:${scene}`,
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

/** 師匠の1年の場面(docs/disciple-mode-design.mdの26・27章)。入門は弟子ごと、ほかは「弟子」と読む。読んだ場面はノベルの読んだ印で開く。 */
const discipleSubs = () => [
  ...DISCIPLES.map((disciple) => fileSub(`disciple-intro-${disciple.id}`, '師匠の1年', `師匠の1年で、${disciple.name}を弟子にすると読めます。`, { disciple: disciple.name }, 'disciple')),
  ...[
    ['disciple-school', '師匠の1年で、弟子の1年目の夏の試験の前に読めます。'],
    ['disciple-school-2', '師匠の1年で、弟子の2年目の夏の試験の前に読めます。'],
    ['disciple-school-3', '師匠の1年で、弟子の3年目の夏の試験の前に読めます。'],
    ['disciple-promote', '師匠の1年で、弟子が研修会ではじめて昇級すると読めます。'],
    ['disciple-family', '師匠の1年で、弟子が例会で勝てない日が続くと読めます。'],
    ['disciple-slump', '師匠の1年で、弟子が大一番で続けて負けると読めます。'],
  ].map(([scene, unlock]) => fileSub(scene, '師匠の1年', unlock, { disciple: '弟子' }, 'disciple')),
];

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
  // 相手が羽音・善彦のときの場面(docs/pro-year-design.mdの22章)。
  sub('pro-yoshihiko', '棋士の1年', '棋士の1年で、天鷺善彦と公式戦ではじめて当たると読めます。'),
  sub('pro-hanane-big', '棋士の1年', '棋士の1年で、決勝などの大一番で羽音と当たると読めます。'),
  sub('pro-title-eve-hanane', '棋士の1年', '棋士の1年で、羽音の持つタイトルに挑むと読めます。'),
  sub('pro-defense-eve-hanane', '棋士の1年', '棋士の1年で、羽音の挑戦を受けると読めます。'),
  sub('pro-title-eve-yoshihiko', '棋士の1年', '棋士の1年で、天鷺善彦の持つタイトルに挑むと読めます。'),
  sub('pro-defense-eve-yoshihiko', '棋士の1年', '棋士の1年で、天鷺善彦の挑戦を受けると読めます。'),
  sub('pro-beat-hanane', '棋士の1年', '棋士の1年で、羽音との番勝負に勝つと読めます。'),
  sub('pro-lost-hanane', '棋士の1年', '棋士の1年で、羽音との番勝負に敗れると読めます。'),
  sub('pro-beat-yoshihiko', '棋士の1年', '棋士の1年で、天鷺善彦との番勝負に勝つと読めます。'),
  sub('pro-lost-yoshihiko', '棋士の1年', '棋士の1年で、天鷺善彦との番勝負に敗れると読めます。'),
  // 場合分けを増やした夜(docs/pro-year-design.mdの31章)。同じ場合の中で回す台本も、見たら読み直せる。
  sub('pro-first-title', '棋士の1年', '棋士の1年で、はじめてタイトルを取ると読めます。'),
  sub('pro-title-eve-next', '棋士の1年', '棋士の1年で、2つ目のタイトル戦に挑むと読めます。'),
  sub('pro-title-eve-again', '棋士の1年', '棋士の1年で、同じタイトルに2度挑むと読めます。'),
  sub('pro-title-eve-retake', '棋士の1年', '棋士の1年で、失ったタイトルを取り返しに行くと読めます。'),
  sub('pro-title-eve-crowned', '棋士の1年', '棋士の1年で、タイトルを持ったまま別のタイトルに挑むと読めます。'),
  sub('pro-defense-eve-again', '棋士の1年', '棋士の1年で、2期以上守ったタイトルの防衛戦に出ると読めます。'),
  sub('pro-defense-eve-crowns', '棋士の1年', '棋士の1年で、3つ以上のタイトルを持って防衛戦に出ると読めます。'),
  sub('pro-defense-streak-long', '棋士の1年', '棋士の1年で、タイトルを5連覇すると読めます。'),
  sub('pro-title-lost-long', '棋士の1年', '棋士の1年で、3期以上守ったタイトルを失うと読めます。'),
  sub('pro-title-lost-still', '棋士の1年', '棋士の1年で、ほかのタイトルを持ったまま1つ失うと読めます。'),
  sub('pro-beat-hanane-2', '棋士の1年', '棋士の1年で、羽音との番勝負に2度勝つと読めます。'),
  sub('pro-lost-hanane-2', '棋士の1年', '棋士の1年で、羽音との番勝負に2度敗れると読めます。'),
  // 勝ち方・負け方と調子で分かれる夜(docs/pro-year-design.mdの32章)。
  sub('pro-series-sweep-win', '棋士の1年', '棋士の1年で、番勝負をストレートで勝つと読めます。'),
  sub('pro-series-comeback-win', '棋士の1年', '棋士の1年で、カド番から番勝負を逆転すると読めます。'),
  sub('pro-series-fullset-win', '棋士の1年', '棋士の1年で、フルセットの番勝負を勝つと読めます。'),
  sub('pro-series-win', '棋士の1年', '棋士の1年で、タイトルを取るか守ると読めます。'),
  sub('pro-series-sweep-loss', '棋士の1年', '棋士の1年で、番勝負をストレートで落とすと読めます。'),
  sub('pro-series-collapse-loss', '棋士の1年', '棋士の1年で、先にあと1勝としてから番勝負を落とすと読めます。'),
  sub('pro-series-close-loss', '棋士の1年', '棋士の1年で、フルセットの番勝負を落とすと読めます。'),
  sub('pro-series-miss', '棋士の1年', '棋士の1年で、タイトルに挑んで届かないと読めます。'),
  sub('pro-title-eve-revenge', '棋士の1年', '棋士の1年で、前の番勝負で負けた相手にもう一度挑むと読めます。'),
  sub('pro-title-eve-slump', '棋士の1年', '棋士の1年で、負けが続いたままタイトル戦に挑むと読めます。'),
  sub('pro-defense-eve-slump', '棋士の1年', '棋士の1年で、負けが続いたまま防衛戦を迎えると読めます。'),
  sub('pro-eve-hot', '棋士の1年', '棋士の1年で、連勝中にタイトル戦を迎えると読めます。'),
  sub('pro-defense-eve-rematch', '棋士の1年', '棋士の1年で、前と同じ挑戦者を迎えると読めます。'),
  sub('pro-seal-after-losses', '棋士の1年', '棋士の1年で、番勝負で2連敗して封じ手の夜を迎えると読めます。'),
  sub('pro-seal-momentum', '棋士の1年', '棋士の1年で、番勝負で2連勝して封じ手の夜を迎えると読めます。'),
  sub('pro-slump', '棋士の1年', '棋士の1年で、公式戦で4連敗すると読めます。'),
  sub('pro-slump-2', '棋士の1年', '棋士の1年で、公式戦の4連敗を2度経験すると読めます。'),
  sub('pro-slump-end', '棋士の1年', '棋士の1年で、4連敗以上を勝ちで止めると読めます。'),
  sub('pro-hot-streak', '棋士の1年', '棋士の1年で、公式戦で10連勝すると読めます。'),
  // 何年目か・絆・相手の格で分かれる夜(docs/pro-year-design.mdの33章)。
  sub('pro-eve-bond-mentor', '棋士の1年', '棋士の1年で、師匠との絆が深まってから番勝負を迎えると読めます。'),
  sub('pro-eve-bond-senior', '棋士の1年', '棋士の1年で、兄弟子との絆が深まってから番勝負を迎えると読めます。'),
  sub('pro-eve-bond-peer', '棋士の1年', '棋士の1年で、同期との絆が深まってから番勝負を迎えると読めます。'),
  sub('pro-eve-veteran', '棋士の1年', '棋士の1年で、8年目からの番勝負を迎えると読めます。'),
  sub('pro-anniversary', '棋士の1年', '棋士の1年で、5年目の年度を迎えると読めます。'),
  sub('pro-series-upset-win', '棋士の1年', '棋士の1年で、格上からタイトルを取ると読めます。'),
  sub('pro-series-upset-loss', '棋士の1年', '棋士の1年で、格下に番勝負を落とすと読めます。'),
  // 羽音から取った夜・羽音の挑戦を退けた夜(docs/pro-year-design.mdの34章)。
  sub('pro-beat-hanane-take-first', '棋士の1年', '棋士の1年で、はじめて羽音からタイトルを取ると読めます。'),
  sub('pro-beat-hanane-retake', '棋士の1年', '棋士の1年で、羽音に取られたタイトルを羽音から取り返すと読めます。'),
  sub('pro-beat-hanane-take-sweep', '棋士の1年', '棋士の1年で、羽音からストレートでタイトルを取ると読めます。'),
  sub('pro-beat-hanane-take-comeback', '棋士の1年', '棋士の1年で、カド番から羽音のタイトルを取ると読めます。'),
  sub('pro-beat-hanane-take-fullset', '棋士の1年', '棋士の1年で、フルセットで羽音からタイトルを取ると読めます。'),
  sub('pro-beat-hanane-mukan', '棋士の1年', '棋士の1年で、羽音の最後のタイトルを取ると読めます。'),
  sub('pro-beat-hanane-take-3', '棋士の1年', '棋士の1年で、羽音から何度かタイトルを取ると読めます。'),
  sub('pro-beat-hanane-take-4', '棋士の1年', '棋士の1年で、羽音から何度もタイトルを取ると読めます。'),
  sub('pro-beat-hanane-defend-first', '棋士の1年', '棋士の1年で、はじめて挑戦者の羽音を退けると読めます。'),
  sub('pro-beat-hanane-defend-again', '棋士の1年', '棋士の1年で、同じタイトル戦で羽音を続けて退けると読めます。'),
  sub('pro-beat-hanane-defend-sweep', '棋士の1年', '棋士の1年で、挑戦者の羽音をストレートで退けると読めます。'),
  sub('pro-beat-hanane-defend-comeback', '棋士の1年', '棋士の1年で、カド番から羽音の挑戦を退けると読めます。'),
  sub('pro-beat-hanane-defend-fullset', '棋士の1年', '棋士の1年で、フルセットで羽音の挑戦を退けると読めます。'),
  sub('pro-beat-hanane-defend-3', '棋士の1年', '棋士の1年で、羽音の挑戦を何度か退けると読めます。'),
  sub('pro-beat-hanane-defend-4', '棋士の1年', '棋士の1年で、羽音の挑戦を何度も退けると読めます。'),
  sub('pro-beat-hanane-eternal', '棋士の1年', '棋士の1年で、羽音との番勝負で永世称号を得ると読めます。'),
  sub('pro-beat-hanane-long', '棋士の1年', '棋士の1年で、羽音とタイトル戦を5度戦うと読めます。'),
  // 羽音に取られた夜・羽音に挑んで届かなかった夜(docs/pro-year-design.mdの35章)。
  sub('pro-lost-hanane-lost-first', '棋士の1年', '棋士の1年で、はじめて羽音にタイトルを取られると読めます。'),
  sub('pro-lost-hanane-retaken', '棋士の1年', '棋士の1年で、羽音から取ったタイトルを取り返されると読めます。'),
  sub('pro-lost-hanane-mukan', '棋士の1年', '棋士の1年で、最後のタイトルを羽音に取られると読めます。'),
  sub('pro-lost-hanane-lost-long', '棋士の1年', '棋士の1年で、3期以上守ったタイトルを羽音に取られると読めます。'),
  sub('pro-lost-hanane-lost-collapse', '棋士の1年', '棋士の1年で、あと1勝から羽音にタイトルを取られると読めます。'),
  sub('pro-lost-hanane-lost-sweep', '棋士の1年', '棋士の1年で、ストレートで羽音にタイトルを取られると読めます。'),
  sub('pro-lost-hanane-lost-fullset', '棋士の1年', '棋士の1年で、フルセットで羽音にタイトルを取られると読めます。'),
  sub('pro-lost-hanane-lost-3', '棋士の1年', '棋士の1年で、羽音に何度かタイトルを取られると読めます。'),
  sub('pro-lost-hanane-lost-4', '棋士の1年', '棋士の1年で、羽音に何度もタイトルを取られると読めます。'),
  sub('pro-lost-hanane-miss-first', '棋士の1年', '棋士の1年で、はじめて羽音に挑んで届かないと読めます。'),
  sub('pro-lost-hanane-miss-again', '棋士の1年', '棋士の1年で、同じタイトル戦で羽音に続けて届かないと読めます。'),
  sub('pro-lost-hanane-miss-collapse', '棋士の1年', '棋士の1年で、あと1勝から羽音に届かないと読めます。'),
  sub('pro-lost-hanane-miss-sweep', '棋士の1年', '棋士の1年で、羽音にストレートで退けられると読めます。'),
  sub('pro-lost-hanane-miss-fullset', '棋士の1年', '棋士の1年で、フルセットで羽音に届かないと読めます。'),
  sub('pro-lost-hanane-miss-3', '棋士の1年', '棋士の1年で、羽音に何度か挑んで届かないと読めます。'),
  sub('pro-lost-hanane-miss-4', '棋士の1年', '棋士の1年で、羽音に何度も挑んで届かないと読めます。'),
  sub('pro-lost-hanane-long', '棋士の1年', '棋士の1年で、羽音とのタイトル戦の5度目以降に敗れると読めます。'),
  // 善彦との番勝負のあとの夜(docs/pro-year-design.mdの36章)。
  sub('pro-beat-yoshihiko-take-first', '棋士の1年', '棋士の1年で、はじめて善彦からタイトルを取ると読めます。'),
  sub('pro-beat-yoshihiko-retake', '棋士の1年', '棋士の1年で、善彦に取られたタイトルを善彦から取り返すと読めます。'),
  sub('pro-beat-yoshihiko-defend-first', '棋士の1年', '棋士の1年で、はじめて挑戦者の善彦を退けると読めます。'),
  sub('pro-beat-yoshihiko-defend-again', '棋士の1年', '棋士の1年で、同じタイトル戦で善彦を続けて退けると読めます。'),
  sub('pro-beat-yoshihiko-mukan', '棋士の1年', '棋士の1年で、善彦の最後のタイトルを取ると読めます。'),
  sub('pro-beat-yoshihiko-comeback', '棋士の1年', '棋士の1年で、カド番から善彦に勝つと読めます。'),
  sub('pro-beat-yoshihiko-sweep', '棋士の1年', '棋士の1年で、ストレートで善彦に勝つと読めます。'),
  sub('pro-beat-yoshihiko-fullset', '棋士の1年', '棋士の1年で、フルセットで善彦に勝つと読めます。'),
  sub('pro-beat-yoshihiko-2', '棋士の1年', '棋士の1年で、善彦に何度か勝つと読めます。'),
  sub('pro-beat-yoshihiko-3', '棋士の1年', '棋士の1年で、善彦に何度も勝つと読めます。'),
  sub('pro-beat-yoshihiko-eternal', '棋士の1年', '棋士の1年で、善彦との番勝負で永世称号を得ると読めます。'),
  sub('pro-lost-yoshihiko-lost-first', '棋士の1年', '棋士の1年で、はじめて善彦にタイトルを取られると読めます。'),
  sub('pro-lost-yoshihiko-retaken', '棋士の1年', '棋士の1年で、善彦から取ったタイトルを取り返されると読めます。'),
  sub('pro-lost-yoshihiko-mukan', '棋士の1年', '棋士の1年で、最後のタイトルを善彦に取られると読めます。'),
  sub('pro-lost-yoshihiko-miss-first', '棋士の1年', '棋士の1年で、はじめて善彦に挑んで届かないと読めます。'),
  sub('pro-lost-yoshihiko-miss-again', '棋士の1年', '棋士の1年で、同じタイトル戦で善彦に続けて届かないと読めます。'),
  sub('pro-lost-yoshihiko-collapse', '棋士の1年', '棋士の1年で、あと1勝から善彦に敗れると読めます。'),
  sub('pro-lost-yoshihiko-sweep', '棋士の1年', '棋士の1年で、ストレートで善彦に敗れると読めます。'),
  sub('pro-lost-yoshihiko-fullset', '棋士の1年', '棋士の1年で、フルセットで善彦に敗れると読めます。'),
  sub('pro-lost-yoshihiko-2', '棋士の1年', '棋士の1年で、善彦に何度か敗れると読めます。'),
  sub('pro-lost-yoshihiko-3', '棋士の1年', '棋士の1年で、善彦に何度も敗れると読めます。'),
  sub('pro-yoshihiko-long', '棋士の1年', '棋士の1年で、善彦とタイトル戦を5度戦うと読めます。'),
  // 封じ手の夜(今までの台本。休憩の画面で読むと、ノベルの読んだ印から開く)。
  sub('pro-seal-tie', '棋士の1年', '棋士の1年で、二日制の番勝負を指すと読めます。'),
  sub('pro-seal-lead', '棋士の1年', '棋士の1年で、二日制の番勝負をリードすると読めます。'),
  sub('pro-seal-kado', '棋士の1年', '棋士の1年で、カド番の封じ手の夜を迎えると読めます。'),
  sub('pro-seal-defense-tie', '棋士の1年', '棋士の1年で、二日制の防衛戦を指すと読めます。'),
  sub('pro-seal-defense-lead', '棋士の1年', '棋士の1年で、二日制の防衛戦をリードすると読めます。'),
  sub('pro-seal-defense-kado', '棋士の1年', '棋士の1年で、防衛戦のカド番の封じ手の夜を迎えると読めます。'),
  sub('pro-seal-hanane-tie', '棋士の1年', '棋士の1年で、羽音との二日制の番勝負を指すと読めます。'),
  sub('pro-seal-hanane-lead', '棋士の1年', '棋士の1年で、羽音との番勝負をリードすると読めます。'),
  sub('pro-seal-hanane-kado', '棋士の1年', '棋士の1年で、羽音との番勝負でカド番を迎えると読めます。'),
  sub('pro-seal-yoshihiko', '棋士の1年', '棋士の1年で、天鷺善彦との二日制の番勝負を指すと読めます。'),
  sub('pro-seal-oute', '棋士の1年', '棋士の1年で、あと1勝でタイトルという封じ手の夜を迎えると読めます。'),
  sub('pro-seal-oute-2', '棋士の1年', '棋士の1年で、あと1勝の封じ手の夜を何度か迎えると読めます。'),
  sub('pro-seal-final', '棋士の1年', '棋士の1年で、番勝負の最終局の封じ手の夜を迎えると読めます。'),
  sub('pro-seal-tie-2', '棋士の1年', '棋士の1年で、二日制の番勝負を指すと読めます。'),
  sub('pro-seal-tie-3', '棋士の1年', '棋士の1年で、二日制の番勝負を指すと読めます。'),
  sub('pro-seal-lead-2', '棋士の1年', '棋士の1年で、二日制の番勝負をリードすると読めます。'),
  sub('pro-seal-kado-2', '棋士の1年', '棋士の1年で、カド番の封じ手の夜を迎えると読めます。'),
  sub('pro-seal-defense-tie-2', '棋士の1年', '棋士の1年で、二日制の防衛戦を指すと読めます。'),
  sub('pro-seal-defense-tie-3', '棋士の1年', '棋士の1年で、二日制の防衛戦を指すと読めます。'),
  sub('pro-seal-defense-lead-2', '棋士の1年', '棋士の1年で、二日制の防衛戦をリードすると読めます。'),
  sub('pro-seal-defense-oute', '棋士の1年', '棋士の1年で、あと1勝で防衛という封じ手の夜を迎えると読めます。'),
  sub('pro-seal-defense-final', '棋士の1年', '棋士の1年で、防衛戦の最終局の封じ手の夜を迎えると読めます。'),
  sub('pro-seal-defense-kado-2', '棋士の1年', '棋士の1年で、防衛戦のカド番の封じ手の夜を迎えると読めます。'),
  sub('pro-seal-hanane-tie-2', '棋士の1年', '棋士の1年で、羽音との二日制の番勝負を指すと読めます。'),
  sub('pro-seal-hanane-final', '棋士の1年', '棋士の1年で、羽音との番勝負の最終局を迎えると読めます。'),
  sub('pro-seal-yoshihiko-2', '棋士の1年', '棋士の1年で、天鷺善彦との二日制の番勝負を指すと読めます。'),
  sub('pro-seal-yoshihiko-3', '棋士の1年', '棋士の1年で、天鷺善彦との二日制の番勝負を指すと読めます。'),
  ...bondSubs(),
  ...discipleSubs(),
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
