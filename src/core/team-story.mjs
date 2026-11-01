// 団体戦のノベルの場面(docs/team-battle-design.mdの6章)。羽音に誘われるところから、試合の節目ごとの短い掛け合い。
// 仮の台本。ノベルのリポジトリはミステリーの部分だけ使わず、人物・舞台は参考にしてよい(docs/novel-reference.md)。物語モードで考え直す(13章)。
// 台本の形 { id, title, summary, background, lines: [{ who, face, text }] } は、後の物語モードでも使う(NovelScene.vue)。
// summaryは「飛ばす」で見せるあらすじ(docs/novel-scene-design.mdの4-2)。
// 羽音は敬語と「！」を使わない(docs/hanane-character.md)。百花は明るく、「！」を使う(この依頼で決めた初期値。0章)。
// 長い場面で遊びを止めない(D:8-2)ので、どの場面も12行まで。

import { hananePortraitFile } from './ryuo-story.mjs';
import { COACH_EXPRESSION_ASSET_VERSION } from './coach-expression.mjs';

/** 話す人。narrationは地の文(名前の札なし)。 */
export const NOVEL_PEOPLE = Object.freeze({
  hanane: Object.freeze({ name: '天鷺羽音', faces: Object.freeze(['neutral', 'smile', 'gentle', 'worried']) }),
  momoka: Object.freeze({ name: '桜乃百花', faces: Object.freeze(['neutral', 'wry', 'worried']) }),
  narration: Object.freeze({ name: '', faces: Object.freeze(['neutral']) }),
});

/** 背景(CSSのグラデーションで描く。NovelScene.vueのnovel--<id>)。 */
export const NOVEL_BACKGROUNDS = Object.freeze(['classroom', 'hall', 'venue', 'night']);

/** 1つの場面の行の上限(D:8-2)。 */
export const NOVEL_MAX_LINES = 12;

const line = (who, face, text) => Object.freeze({ who, face, text });

/**
 * 場面。{name}はプレイヤーの名前(地の文)、{you}は百花の呼び方(名前に「さん」)。
 * castは出てくる人(左から)。
 */
export const TEAM_SCENES = Object.freeze({
  'invite-school': Object.freeze({
    id: 'invite-school',
    title: '放課後の空き教室',
    summary: '放課後の空き教室で、羽音と百花に夏の団体戦に誘われる。3人で1チーム、3局のうち2つ勝てばいい。こうして燈ヶ丘高校将棋部の団体戦メンバーになった。',
    background: 'classroom',
    cast: ['hanane', 'momoka'],
    lines: [
      line('narration', 'neutral', '放課後。資料の山に囲まれた空き教室に、羽音がいた。'),
      line('hanane', 'neutral', 'あ、来た。ちょうどよかった。'),
      line('hanane', 'neutral', '夏の団体戦、一緒に出ない？ 3人で1チームなんだけど、あと1人足りなくて。'),
      line('momoka', 'wry', '私も出るんだ！ 将棋は羽音ちゃんに教わり始めたばっかりだけど……'),
      line('momoka', 'neutral', '{you}がいてくれたら、すっごく心強いな！'),
      line('hanane', 'gentle', '団体戦は、3局のうち2つ勝てばいい。1人で全部勝たなくていいんだよ。'),
      line('hanane', 'neutral', '私が1つ取る。君と百花で、もう1つ。どう？'),
      line('momoka', 'neutral', 'お願い！ 一緒に出よう！'),
      line('narration', 'neutral', 'こうして{name}は、燈ヶ丘（ともりがおか）高校将棋部の団体戦メンバーになった。'),
    ],
  }),
  'invite-pro': Object.freeze({
    id: 'invite-pro',
    title: '将棋会館の控室',
    summary: '将棋会館の控室で、羽音に早指しの団体戦に誘われる。リーダーは君で、3人目は君が選ぶ（迷ったら羽音に任せられる）。',
    background: 'hall',
    cast: ['hanane'],
    lines: [
      line('hanane', 'neutral', '早指しの団体戦、出ることにした。3人のチームで、リーダーは君。'),
      line('hanane', 'neutral', '1人は私。もう1人は、君が選んで。'),
      line('hanane', 'smile', '迷ったら、私に任せて。君に足りないところを埋められる人を探すから。'),
    ],
  }),
  'school-start': Object.freeze({
    id: 'school-start',
    title: '大会の会場',
    summary: '大会の会場。緊張する百花に、羽音が「いつもどおり指せばいい」と声をかける。予選は3回勝てば抜け、2回負けたら終わり。',
    background: 'venue',
    cast: ['hanane', 'momoka'],
    lines: [
      line('momoka', 'worried', 'うう、人がいっぱい……。緊張してきた！'),
      line('hanane', 'gentle', '大丈夫。いつもどおり指せばいいよ。'),
      line('hanane', 'neutral', '予選は3回勝てば抜けられる。2回負けたら終わり。数えるのは私がやるから。'),
    ],
  }),
  'school-knockout': Object.freeze({
    id: 'school-knockout',
    title: '決勝トーナメントへ',
    summary: '予選を抜けて決勝トーナメントへ。ここからは1回負けたら終わり。',
    background: 'venue',
    cast: ['hanane', 'momoka'],
    lines: [
      line('momoka', 'wry', 'やった、決勝トーナメントだよ！'),
      line('hanane', 'smile', 'ここからは1回負けたら終わり。でも、やることは同じでしょ。'),
    ],
  }),
  'school-final': Object.freeze({
    id: 'school-final',
    title: '決勝の前',
    summary: '決勝まで来た。あと1つ、3人で取りに行く。',
    background: 'venue',
    cast: ['hanane', 'momoka'],
    lines: [
      line('momoka', 'neutral', 'ほんとに決勝まで来ちゃった……！'),
      line('hanane', 'neutral', 'あと1つ。3人で取りに行こう。'),
    ],
  }),
  'school-champion': Object.freeze({
    id: 'school-champion',
    title: '優勝',
    summary: '優勝。百花は大喜びし、羽音は「君がいてよかった」と言う。',
    background: 'venue',
    cast: ['hanane', 'momoka'],
    lines: [
      line('momoka', 'wry', '優勝……！ 私たち、日本一だよ！'),
      line('hanane', 'gentle', '……うん。3人で取った優勝だね。'),
      line('hanane', 'smile', 'ありがとう。君がいてよかった。'),
    ],
  }),
  'school-end': Object.freeze({
    id: 'school-end',
    title: '大会のあと',
    summary: '大会が終わった。悔しいけど、いい大会だった。また3人で出ようと約束する。',
    background: 'night',
    cast: ['hanane', 'momoka'],
    lines: [
      line('momoka', 'worried', '終わっちゃった……。悔しいな。'),
      line('hanane', 'neutral', '悔しいけど、いい大会だった。次は勝つから。'),
      line('momoka', 'wry', 'また3人で出ようね！'),
    ],
  }),
  'pro-knockout': Object.freeze({
    id: 'pro-knockout',
    title: '本戦へ',
    summary: '予選を抜けて本戦へ。羽音は「勝負どころは君に回す」と言う。',
    background: 'hall',
    cast: ['hanane'],
    lines: [
      line('hanane', 'smile', '予選は抜けた。本戦は負けたら終わりだよ。'),
      line('hanane', 'neutral', '勝負どころは君に回す。そのほうが勝てると思うから。'),
    ],
  }),
  'pro-champion': Object.freeze({
    id: 'pro-champion',
    title: '優勝',
    summary: '優勝。羽音は「リーダーが君でよかった」と言う。',
    background: 'hall',
    cast: ['hanane'],
    lines: [
      line('hanane', 'gentle', '優勝。……リーダーが君でよかった。'),
    ],
  }),
  'pro-end': Object.freeze({
    id: 'pro-end',
    title: '大会のあと',
    summary: '大会が終わった。羽音は「また組もう。君となら、もっと上に行ける」と言う。',
    background: 'night',
    cast: ['hanane'],
    lines: [
      line('hanane', 'neutral', '悔しいけど、ここまで。次は勝つから。'),
      line('hanane', 'smile', 'また組もう。君となら、もっと上に行ける。'),
    ],
  }),
});

/** 呼び方を差し込んだ文(名前がなければ「あなた」)。 */
export function sceneText(text, playerName = '') {
  const name = String(playerName ?? '').trim();
  return String(text)
    .replaceAll('{you}', name ? `${name}さん` : 'あなた')
    .replaceAll('{name}', name || 'あなた');
}

/**
 * 場面を、画面に出す形にする(名前を差し込み、話す人の名前の札を付ける)。
 * @param {string} id
 * @param {string} [playerName]
 */
export function teamScene(id, playerName = '') {
  const scene = TEAM_SCENES[/** @type {keyof typeof TEAM_SCENES} */ (id)];
  if (!scene) return null;
  return {
    id: scene.id,
    title: scene.title,
    summary: scene.summary,
    background: scene.background,
    cast: [...scene.cast],
    lines: scene.lines.map((entry) => ({
      who: entry.who,
      face: entry.face,
      name: NOVEL_PEOPLE[/** @type {keyof typeof NOVEL_PEOPLE} */ (entry.who)]?.name ?? '',
      text: sceneText(entry.text, playerName),
    })),
  };
}

/**
 * 立ち絵の画像(羽音・百花)。smallは小さい画面用の-320。
 * @param {string} assetBaseUrl
 * @param {string} who
 * @param {string} face
 * @param {{ small?: boolean }} [options]
 */
export function portraitUrl(assetBaseUrl, who, face, { small = false } = {}) {
  if (who === 'hanane') return `${assetBaseUrl}/characters/${hananePortraitFile(face, { small })}?v=1`;
  if (who === 'momoka') {
    const base = face === 'wry' ? 'sakurano-momoka-wry' : face === 'worried' ? 'sakurano-momoka-worried' : 'sakurano-momoka';
    return `${assetBaseUrl}/characters/${base}${small ? '-320' : ''}.webp?v=${COACH_EXPRESSION_ASSET_VERSION}`;
  }
  return '';
}

/**
 * 大会の節目で見せる場面(見たものは経歴に覚え、同じ大会で2回は出さない)。
 * @param {any} run 団体戦の大会
 * @param {'start' | 'knockout' | 'final' | 'end'} moment
 */
export function momentScene(run, moment) {
  const school = run?.format === 'school';
  if (moment === 'start') return school ? 'school-start' : null;
  if (moment === 'knockout') return school ? 'school-knockout' : 'pro-knockout';
  if (moment === 'final') return school ? 'school-final' : null;
  if (moment === 'end') {
    const won = run?.result?.place === 1;
    if (school) return won ? 'school-champion' : 'school-end';
    return won ? 'pro-champion' : 'pro-end';
  }
  return null;
}
