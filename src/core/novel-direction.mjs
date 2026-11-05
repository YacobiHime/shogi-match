import { playerAddress } from './player-name.mjs';
// ノベルの場面の演出(docs/novel-scene-design.mdの12章)。画面に依存しない。
// 台本の行に足す演出の語彙(キャラの動き・漫符・画面の効果・背景・色・登場と退場・効果音・文の大きさと速さ・間)、
// 人物と表情の一覧、行ごとの舞台の状態(誰が出ているか・表情・背景・色)、台本の検査(書きまちがいを教える)。
// 書き方の説明はdocs/novel-authoring-guide.md。語彙を足したら、ガイドの表も直す(novel-library.test.mjsが見張る)。

import { NOVEL_PEOPLE, sceneText } from './team-story.mjs';
import { NOVEL_BACKGROUND_CSS } from './novel-ui.mjs';
import { SFX } from './novel-sound.mjs';

/** 1つの場面の行の上限の目安(遊びを止めない。D:8-2)。超えたら検査が「分けて」と言う。 */
export const SCENE_LINE_LIMIT = 12;
/** 1行の字数の目安(窓に収まる)。 */
export const LINE_CHAR_LIMIT = 60;
/** 同時に立てる人の数(席は左・中・右の3つ)。 */
export const STAGE_MAX = 3;
/** 間(wait)の上限(ミリ秒)。 */
export const WAIT_MAX_MS = 3000;

/**
 * 人物。faceは表情のid、labelは台本で書く短い名前、aliasesは台本で使える別の書き方。portraitは立ち絵があるか。
 * rulesは口調のきまり(検査で使う。noKeigo: 敬語を使わない、noExclaim: 「！」を使わない)。
 * 人物を足すときは、ここに1つ足し、立ち絵があればteam-story.mjsのportraitUrl・portraitAspect・PORTRAIT_HEIGHT_CMにも足す。
 */
export const NOVEL_CHARACTERS = Object.freeze({
  hanane: Object.freeze({
    id: 'hanane', name: NOVEL_PEOPLE.hanane.name, label: '羽音', aliases: Object.freeze(['羽音', '天鷺羽音', 'はのん']),
    faces: NOVEL_PEOPLE.hanane.faces, portrait: true, rules: Object.freeze({ noKeigo: true, noExclaim: true }),
    note: '敬語と「！」を使わない。淡々としていて、問いかけの形が多い(docs/hanane-character.md)',
  }),
  momoka: Object.freeze({
    id: 'momoka', name: NOVEL_PEOPLE.momoka.name, label: '百花', aliases: Object.freeze(['百花', '桜乃百花', 'ももか']),
    faces: NOVEL_PEOPLE.momoka.faces, portrait: true, rules: Object.freeze({}),
    note: '明るく、「！」を使う。プレイヤーを{you}と呼ぶ',
  }),
  you: Object.freeze({
    id: 'you', name: '{name}', label: 'あなた', aliases: Object.freeze(['あなた', 'プレイヤー', '自分']),
    faces: Object.freeze(['neutral']), portrait: false, rules: Object.freeze({}),
    note: 'プレイヤー。名前の札はプレイヤーの名前。台詞は少なめに(プレイヤーの気持ちを決めつけない)',
  }),
  host: Object.freeze({
    id: 'host', name: '司会', label: '司会', aliases: Object.freeze(['司会']),
    faces: Object.freeze(['neutral']), portrait: false, rules: Object.freeze({}), note: '声だけ(立ち絵なし)',
  }),
  narration: Object.freeze({
    id: 'narration', name: '', label: '地の文', aliases: Object.freeze([]),
    faces: Object.freeze(['neutral']), portrait: false, rules: Object.freeze({}), note: '名前の札なし。台本では「: 」で始める',
  }),
});

/** 声だけの人(台本の`voices:`に書いた名前)のwho。名前は行のnameに持つ。 */
export const EXTRA_WHO = 'extra';

/** 表情の呼び名(台本で`羽音(笑顔)`のように書ける)。 */
export const FACE_LABELS = Object.freeze({
  neutral: Object.freeze(['ふつう']),
  smile: Object.freeze(['笑顔', 'にっこり']),
  gentle: Object.freeze(['やさしい', 'やさしく']),
  worried: Object.freeze(['心配', '困り顔']),
  wry: Object.freeze(['苦笑い']),
});

/**
 * キャラの動き(立ち絵の見た目だけ。押して進むのは待たない。G:3-2)。msは画面の動きの長さ(NovelScene.vueのCSSと同じ)。
 */
export const NOVEL_ACTS = Object.freeze({
  hop: Object.freeze({ label: 'ぴょん', aliases: Object.freeze(['ぴょん', '跳ねる']), ms: 260, use: '小さくうれしい・気づいた' }),
  jump: Object.freeze({ label: '大喜び', aliases: Object.freeze(['大喜び', 'ぴょんぴょん']), ms: 620, use: 'とてもうれしい(優勝など)' }),
  nod: Object.freeze({ label: 'うなずく', aliases: Object.freeze(['うなずく']), ms: 420, use: 'そうだね・分かった' }),
  shake: Object.freeze({ label: '首を振る', aliases: Object.freeze(['首を振る', 'いやいや']), ms: 480, use: 'ちがう・いやだ' }),
  tilt: Object.freeze({ label: 'かしげる', aliases: Object.freeze(['かしげる', '首をかしげる']), ms: 600, use: '分からない・不思議' }),
  bow: Object.freeze({ label: 'おじぎ', aliases: Object.freeze(['おじぎ', '礼']), ms: 700, use: 'あいさつ・対局の礼' }),
  shiver: Object.freeze({ label: 'ぶるぶる', aliases: Object.freeze(['ぶるぶる', '震える']), ms: 500, use: '緊張・こわい・寒い' }),
  lean: Object.freeze({ label: '前に出る', aliases: Object.freeze(['前に出る', 'ぐいっ']), ms: 420, use: '身を乗り出す・強く言う' }),
  recoil: Object.freeze({ label: 'のけぞる', aliases: Object.freeze(['のけぞる']), ms: 360, use: '驚いて引く' }),
  sink: Object.freeze({ label: 'しょんぼり', aliases: Object.freeze(['しょんぼり', '落ち込む']), ms: 700, use: '残念・落ち込む' }),
});

/** 漫符(頭の上に小さく出る印)。glyphは画面に出す字。 */
export const NOVEL_EMOTES = Object.freeze({
  surprise: Object.freeze({ label: '！', glyph: '！', aliases: Object.freeze(['！', '!', 'びっくり']), use: '驚く' }),
  question: Object.freeze({ label: '？', glyph: '？', aliases: Object.freeze(['？', '?', 'はてな']), use: '分からない' }),
  sweat: Object.freeze({ label: '汗', glyph: '💦', aliases: Object.freeze(['汗', 'あせ']), use: '困る・あせる' }),
  heart: Object.freeze({ label: 'ハート', glyph: '♥', aliases: Object.freeze(['ハート']), use: 'うれしい・好き' }),
  anger: Object.freeze({ label: '怒', glyph: '💢', aliases: Object.freeze(['怒', 'むっ']), use: '怒る・むっとする' }),
  note: Object.freeze({ label: '音符', glyph: '♪', aliases: Object.freeze(['音符', '♪']), use: '楽しい・ごきげん' }),
  idea: Object.freeze({ label: 'ひらめき', glyph: '💡', aliases: Object.freeze(['ひらめき']), use: '思いつく' }),
  sigh: Object.freeze({ label: 'ため息', glyph: '…', aliases: Object.freeze(['ため息', '…']), use: 'あきれる・言葉が出ない' }),
  sparkle: Object.freeze({ label: 'きらきら', glyph: '✦', aliases: Object.freeze(['きらきら']), use: '目を輝かせる' }),
});

/** 画面の効果(その行のはじめに1回)。blackoutは暗くなってから明け、文は明けてから出る。 */
export const NOVEL_SCREEN = Object.freeze({
  flash: Object.freeze({ label: '光る', aliases: Object.freeze(['光る', 'フラッシュ']), ms: 220, use: 'ひらめき・衝撃' }),
  quake: Object.freeze({ label: '揺れる', aliases: Object.freeze(['揺れる']), ms: 400, use: '大きな驚き・ぶつかる' }),
  blackout: Object.freeze({ label: '暗転', aliases: Object.freeze(['暗転']), ms: 900, textDelayMs: 450, use: '時間が飛ぶ・場所が変わる' }),
});

/** 色(次に変えるまで続く)。 */
export const NOVEL_TONES = Object.freeze({
  none: Object.freeze({ label: 'もとの色', aliases: Object.freeze(['もとの色', '回想おわり']) }),
  memory: Object.freeze({ label: '回想', aliases: Object.freeze(['回想']) }),
  dim: Object.freeze({ label: '暗く', aliases: Object.freeze(['暗く']) }),
});

/** 背景の呼び名(絵はnovel-ui.mjsのNOVEL_BACKGROUND_CSS)。 */
export const BACKGROUND_LABELS = Object.freeze({
  classroom: '教室（夕方）',
  hall: '将棋会館',
  venue: '会場',
  night: '夜',
  street: '帰り道（夕方）',
  room: '部屋',
  black: '黒',
  white: '白',
});
export const NOVEL_BACKGROUND_IDS = Object.freeze(Object.keys(NOVEL_BACKGROUND_CSS));

/** 文の見せ方(その行だけ)。 */
export const NOVEL_TEXT_STYLES = Object.freeze({
  big: Object.freeze({ kind: 'size', label: '大きく', aliases: Object.freeze(['大きく']) }),
  small: Object.freeze({ kind: 'size', label: '小さく', aliases: Object.freeze(['小さく']) }),
  slow: Object.freeze({ kind: 'speed', label: 'ゆっくり', aliases: Object.freeze(['ゆっくり']), factor: 2.2 }),
  fast: Object.freeze({ kind: 'speed', label: '早口', aliases: Object.freeze(['早口']), factor: 0.45 }),
});

/** 登場の向き。 */
export const ENTER_FROM = Object.freeze({ fade: 'ふわっと', left: '左から', right: '右から' });
const ENTER_FROM_ALIASES = Object.freeze({ 左: 'left', 右: 'right', ふわっと: 'fade', left: 'left', right: 'right', fade: 'fade' });

/** 行に書ける演出の欄(組み込みの場面からteamScene・proYearSceneがそのまま渡す)。 */
export const DIRECTION_KEYS = Object.freeze(['act', 'emote', 'acts', 'emotes', 'faces', 'enter', 'exit', 'screen', 'bg', 'tone', 'sfx', 'wait', 'size', 'speed']);

/** 行から演出の欄だけを写す(ほかの欄は写さない)。 */
export function directionFields(line) {
  /** @type {Record<string, any>} */
  const out = {};
  for (const key of DIRECTION_KEYS) if (line?.[key] !== undefined) out[key] = line[key];
  return out;
}

const list = (value) => (value === undefined || value === null ? [] : Array.isArray(value) ? value : [value]);

/**
 * 行の演出を、決まった形にそろえる。act・emoteは文字なら話す人の、{who, act}ならその人の。
 * @param {any} line
 */
export function lineDirection(line) {
  const speaker = line?.who ?? 'narration';
  const target = (entry, key) => (typeof entry === 'string' ? { who: speaker, [key]: entry } : { who: entry?.who ?? speaker, [key]: entry?.[key] });
  return {
    acts: [...list(line?.act), ...list(line?.acts)].map((entry) => target(entry, 'act')),
    emotes: [...list(line?.emote), ...list(line?.emotes)].map((entry) => target(entry, 'emote')),
    faces: line?.faces && typeof line.faces === 'object' ? { ...line.faces } : {},
    enter: list(line?.enter).map((entry) => (typeof entry === 'string' ? { who: entry, from: 'fade' } : { who: entry?.who, from: entry?.from ?? 'fade' })),
    exit: list(line?.exit),
    screen: line?.screen ?? '',
    bg: line?.bg ?? '',
    tone: line?.tone ?? '',
    sfx: list(line?.sfx),
    wait: Number(line?.wait) || 0,
    size: line?.size ?? '',
    speed: line?.speed ?? '',
  };
}

/** 立ち絵のある人か。 */
export const hasPortrait = (who) => Boolean(NOVEL_CHARACTERS[/** @type {keyof typeof NOVEL_CHARACTERS} */ (who)]?.portrait);

/** 舞台の席(出ている人の数で決まる。1人は中、2人は左右、3人は左・中・右)。 */
export function stageSlots(count) {
  if (count <= 1) return ['center'];
  if (count === 2) return ['left', 'right'];
  return ['left', 'center', 'right'];
}

/** 行と、選択肢の返しの行を、出てくる順に並べる。 */
function flatLines(lines) {
  /** @type {any[]} */
  const out = [];
  for (const entry of lines ?? []) {
    out.push(entry);
    for (const choice of entry?.choices ?? []) out.push(...flatLines(choice.reply ?? []));
  }
  return out;
}

/**
 * はじめから舞台に出ている人。startがあればそれ、なければcastのうち、最初の出来事が登場(enter)でない人。
 * 台本の全部の行(選択肢の返しも)から決める。
 * @param {{ cast?: string[], start?: string[], lines?: any[] }} scene
 * @param {any[]} [lines] sceneに行がないときに使う行
 */
export function initialStage(scene, lines = []) {
  if (Array.isArray(scene?.start)) return scene.start.filter(hasPortrait);
  const all = flatLines(scene?.lines ?? lines);
  return (scene?.cast ?? []).filter((who) => {
    if (!hasPortrait(who)) return false;
    for (const entry of all) {
      const dir = lineDirection(entry);
      if (dir.enter.some((item) => item.who === who)) return false;
      if (dir.exit.includes(who)) return true;
    }
    return true;
  });
}

/**
 * 行ごとの舞台(その行を見せるときの状態)。onStageはcastの順に並べた、出ている人。facesは人ごとのいまの表情。
 * 登場(enter)はその行のはじめに、退場(exit)はその行を言い終えてから(次の行のはじめに)。
 * 表情は、話した人はその行のface、話していない人はfacesの指定。背景と色は変えるまで続く。
 * @param {{ cast?: string[], start?: string[], background?: string }} scene
 * @param {any[]} lines
 * @param {number} index
 */
export function stageAt(scene, lines, index) {
  const cast = scene?.cast ?? [];
  const on = new Set(initialStage(scene, lines));
  /** @type {Record<string, string>} */
  const faces = {};
  let bg = scene?.background ?? 'venue';
  let tone = 'none';
  /** @type {Record<string, string>} */
  let entering = {};
  /** @type {string[]} */
  let leaving = [];
  const last = Math.min(index, (lines?.length ?? 0) - 1);
  /** 前の行で退場した人(退場は、その行を言い終えてから。次の行のはじめに舞台から消える)。 */
  /** @type {string[]} */
  let exitNext = [];
  for (let at = 0; at <= last; at += 1) {
    const entry = lines[at];
    const dir = lineDirection(entry);
    entering = {};
    leaving = [];
    for (const who of exitNext) {
      if (on.delete(who)) leaving.push(who);
    }
    exitNext = dir.exit;
    for (const item of dir.enter) {
      if (!on.has(item.who)) entering[item.who] = item.from;
      on.add(item.who);
    }
    if (hasPortrait(entry?.who) && entry?.face) faces[entry.who] = entry.face;
    Object.assign(faces, dir.faces);
    if (dir.bg) bg = dir.bg;
    if (dir.tone) tone = dir.tone;
  }
  const onStage = [...cast.filter((who) => on.has(who)), ...[...on].filter((who) => !cast.includes(who))];
  const slots = stageSlots(onStage.length);
  return {
    onStage,
    seats: Object.fromEntries(onStage.map((who, at) => [who, slots[Math.min(at, slots.length - 1)]])),
    faces: Object.fromEntries(onStage.map((who) => [who, faces[who] ?? 'neutral'])),
    entering,
    leaving,
    bg,
    tone,
  };
}

/**
 * 1行の文が出始めるまでの待ち(ミリ秒)。間(wait)と、暗転の明けを待つ分。
 * @param {any} line
 */
export function lineStartDelayMs(line) {
  const dir = lineDirection(line);
  const blackout = dir.screen === 'blackout' ? NOVEL_SCREEN.blackout.textDelayMs : 0;
  return Math.max(0, Math.min(WAIT_MAX_MS, dir.wait)) + blackout;
}

/** 1字の間隔に掛ける倍率(slow・fast)。 */
export function speedFactor(line) {
  const style = NOVEL_TEXT_STYLES[/** @type {keyof typeof NOVEL_TEXT_STYLES} */ (lineDirection(line).speed)];
  return style && 'factor' in style ? style.factor : 1;
}

/** 行の中で、いちばん長い動き・漫符の時間(ミリ秒。動きの印を外す時間)。 */
export function lineMotionMs(line) {
  const dir = lineDirection(line);
  const acts = dir.acts.map((entry) => NOVEL_ACTS[/** @type {keyof typeof NOVEL_ACTS} */ (entry.act)]?.ms ?? 0);
  return Math.max(0, ...acts, dir.emotes.length ? EMOTE_MS : 0);
}
/** 漫符の出ている時間(ミリ秒)。 */
export const EMOTE_MS = 1100;

/**
 * 差し込み({name}・{you}・varsの{title}など)を入れて、画面に出す形にする。行・選択肢・返しのすべて。
 * @param {any} scene
 * @param {{ playerName?: string, momokaCall?: string, playerProfile?: any, relationships?: Record<string, { part?: 'family' | 'given', style?: 'polite' | 'familiar' | 'bare' }>, vars?: Record<string, string> }} [options]
 */
export function fillScene(scene, { playerName = '', momokaCall = '', playerProfile = null, relationships = {}, vars = {} } = {}) {
  if (!scene) return null;
  const fill = (text) => sceneText(String(text ?? ''), playerName, momokaCall)
    .replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (whole, key) => (vars[key] !== undefined ? String(vars[key]) : whole));
  const fillLine = (line) => ({
    ...line,
    name: fill(line.name ?? ''),
    text: fill(playerProfile ? String(line.text).replaceAll('{you}', playerAddress(playerProfile, relationships[line.who] ?? {})) : line.text),
    ...(line.choices ? { choices: line.choices.map((choice) => ({ ...choice, label: fill(choice.label), reply: (choice.reply ?? []).map(fillLine) })) } : {}),
  });
  return { ...scene, summary: fill(scene.summary ?? ''), lines: scene.lines.map(fillLine) };
}

// ===== 検査 =====

/** 羽音の敬語(使わない言葉)。 */
const KEIGO = /(です|ます[。、？…）」\s]|ます$|ません|ました|ましょう|ください|ございます|お願いします|ありがとうございま)/;
const PLACEHOLDER = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

/**
 * @typedef {{ level: 'error' | 'warn', line: number | null, message: string }} NovelProblem
 */

/**
 * 場面を検査する。まちがい(error)は直さないと正しく見えないもの、気をつけたいこと(warn)はきまりから外れるもの。
 * lineは台本のファイルの行の番号(行のsrc)、なければ場面の何行目か。
 * @param {any} scene
 * @param {{ vars?: string[] }} [options]
 * @returns {NovelProblem[]}
 */
export function checkScene(scene, { vars = [] } = {}) {
  /** @type {NovelProblem[]} */
  const problems = [];
  const add = (level, line, message) => problems.push({ level, line, message });
  if (!scene || typeof scene !== 'object') return [{ level: 'error', line: null, message: '場面がありません。' }];
  if (!scene.id) add('error', null, '`id:`がありません。場面の名前(英数字とハイフン。例: main-01)を書きます。');
  else if (!/^[a-z0-9][a-z0-9-]*$/.test(scene.id)) add('error', null, `id「${scene.id}」は、小文字の英数字とハイフンで書きます(例: main-01)。`);
  if (!scene.title) add('error', null, '題名がありません。いちばん上に「# 題名」を書きます。');
  if (!scene.summary) add('warn', null, '`summary:`(あらすじ)がありません。「飛ばす」で見せるので、1〜2文で書きます。');
  if (!NOVEL_BACKGROUND_IDS.includes(scene.background)) add('error', null, `背景「${scene.background}」は知りません。使えるのは ${NOVEL_BACKGROUND_IDS.join('・')} です。`);
  for (const who of scene.cast ?? []) {
    if (!hasPortrait(who)) add('error', null, `castの「${who}」は立ち絵のある人ではありません。castに書けるのは ${Object.values(NOVEL_CHARACTERS).filter((c) => c.portrait).map((c) => `${c.id}(${c.label})`).join('・')} です。声だけの人は「voices:」に書きます。`);
  }
  const lines = Array.isArray(scene.lines) ? scene.lines : [];
  if (!lines.length) add('error', null, '本文の行がありません。');
  if (lines.length > SCENE_LINE_LIMIT) add('warn', null, `本文が${lines.length}行あります。遊びを止めないよう、1つの場面は${SCENE_LINE_LIMIT}行までを目安に、場面を分けます(D:8-2)。`);
  const allowed = new Set(['name', 'you', ...vars]);
  const checkLines = (seq, prefix) => {
    seq.forEach((line, at) => {
      const where = line?.src ?? at + 1;
      const context = prefix.concat(seq.slice(0, at), [line]);
      checkLine(line, where, stageAt(scene, context, context.length - 1), add, allowed);
      for (const choice of line?.choices ?? []) {
        if (!String(choice?.label ?? '').trim()) add('error', where, '選択肢の答えの文が空です。');
        if (!(choice?.reply ?? []).length) add('error', where, `選択肢「${choice?.label ?? ''}」の返しの台詞がありません。答えの下に、2つ下げて返しの台詞を書きます。`);
        else checkLines(choice.reply, prefix.concat(seq.slice(0, at + 1)));
      }
    });
  };
  checkLines(lines, []);
  return problems;
}

/**
 * 1行の検査。nowはこの行を見せるときの舞台(この行の登場は済み、この行の退場はまだ)。
 */
function checkLine(line, where, now, add, allowed) {
  const who = line?.who;
  const person = NOVEL_CHARACTERS[/** @type {keyof typeof NOVEL_CHARACTERS} */ (who)];
  if (who === EXTRA_WHO) {
    if (!line.name) add('error', where, '声だけの人の名前がありません。');
  } else if (!person) {
    add('error', where, `話す人「${who}」は知りません。人物は ${Object.values(NOVEL_CHARACTERS).map((c) => `${c.id}(${c.label || '地の文'})`).join('・')}、ほかの人は「voices:」に書きます。`);
    return;
  }
  if (person && line.face && !person.faces.includes(line.face)) {
    add('error', where, `${person.label}の表情「${line.face}」は知りません。使えるのは ${person.faces.join('・')} です。`);
  }
  const text = String(line?.text ?? '');
  if (!text.trim()) add('error', where, '文が空です。演出だけを書くときは、[...]だけの行にすると次の行に付きます。');
  const length = Array.from(text.replace(PLACEHOLDER, '○○')).length;
  if (length > LINE_CHAR_LIMIT) add('warn', where, `1行が${length}字あります。窓に収まるよう${LINE_CHAR_LIMIT}字までにし、長いときは2行に分けます。`);
  for (const match of text.matchAll(PLACEHOLDER)) {
    if (!allowed.has(match[1])) add('warn', where, `差し込み「{${match[1]}}」は知りません。使えるのは {name}(プレイヤーの名前)・{you}(百花の呼び方)と、「vars:」に書いた名前です。`);
  }
  if (person?.rules?.noKeigo) {
    const keigo = text.match(KEIGO);
    if (keigo) add('error', where, `${person.label}は敬語を使いません:「${keigo[1].trim()}」。「〜だよ」「〜でしょ」「よろしく」のように書きます(docs/hanane-character.md)。`);
  }
  if (person?.rules?.noExclaim && /[！!]/.test(text)) add('error', where, `${person.label}は「！」を使いません。「。」か「……」にします。`);

  const dir = lineDirection(line);
  const on = new Set(now.onStage);
  for (const item of dir.enter) {
    if (!hasPortrait(item.who)) add('error', where, `登場できるのは立ち絵のある人だけです:「${item.who}」。`);
    else if (!(item.who in now.entering)) add('warn', where, `${label(item.who)}はもう出ています(登場は要りません)。`);
    if (!(item.from in ENTER_FROM)) add('error', where, `登場の向き「${item.from}」は知りません。left・right・fadeのどれかです。`);
  }
  for (const gone of dir.exit) {
    if (!on.has(gone)) add('error', where, `${label(gone)}は出ていないので、退場できません。`);
  }
  if (on.size > STAGE_MAX) add('error', where, `舞台に${on.size}人います。立てるのは${STAGE_MAX}人までです。だれかを退場させます。`);
  if (hasPortrait(who) && !on.has(who)) add('warn', where, `${label(who)}は舞台に出ていないのに話しています。castに入れるか、[enter]で登場させます(声だけでよいなら、このままでかまいません)。`);
  for (const [target, face] of Object.entries(dir.faces)) {
    const p = NOVEL_CHARACTERS[/** @type {keyof typeof NOVEL_CHARACTERS} */ (target)];
    if (!p?.portrait) add('error', where, `表情を変えられるのは立ち絵のある人だけです:「${target}」。`);
    else if (!p.faces.includes(face)) add('error', where, `${p.label}の表情「${face}」は知りません。使えるのは ${p.faces.join('・')} です。`);
  }
  for (const item of dir.acts) {
    if (!(item.act in NOVEL_ACTS)) add('error', where, `動き「${item.act}」は知りません。使えるのは ${Object.keys(NOVEL_ACTS).join('・')} です。`);
    else if (!hasPortrait(item.who)) add('error', where, item.who === 'narration' ? '地の文の行の動きは、だれの動きかを書きます(例: [百花:ぴょん])。' : `${label(item.who)}は立ち絵がないので動けません。`);
    else if (!on.has(item.who)) add('error', where, `${label(item.who)}は舞台に出ていないので動けません。`);
  }
  for (const item of dir.emotes) {
    if (!(item.emote in NOVEL_EMOTES)) add('error', where, `漫符「${item.emote}」は知りません。使えるのは ${Object.keys(NOVEL_EMOTES).join('・')} です。`);
    else if (!hasPortrait(item.who)) add('error', where, item.who === 'narration' ? '地の文の行の漫符は、だれの印かを書きます(例: [羽音:？])。' : `${label(item.who)}は立ち絵がないので漫符を出せません。`);
    else if (!on.has(item.who)) add('error', where, `${label(item.who)}は舞台に出ていないので漫符を出せません。`);
  }
  if (dir.acts.length > 2 || dir.emotes.length > 2) add('warn', where, '1行の動きと漫符は、それぞれ2つまでにします(多いと何が大事か伝わらない。G:3-1)。');
  if (dir.screen && !(dir.screen in NOVEL_SCREEN)) add('error', where, `画面の効果「${dir.screen}」は知りません。使えるのは ${Object.keys(NOVEL_SCREEN).join('・')} です。`);
  if (dir.bg && !NOVEL_BACKGROUND_IDS.includes(dir.bg)) add('error', where, `背景「${dir.bg}」は知りません。使えるのは ${NOVEL_BACKGROUND_IDS.join('・')} です。`);
  if (dir.tone && !(dir.tone in NOVEL_TONES)) add('error', where, `色「${dir.tone}」は知りません。使えるのは ${Object.keys(NOVEL_TONES).join('・')} です。`);
  for (const id of dir.sfx) if (!(id in SFX)) add('error', where, `効果音「${id}」は知りません。使えるのは ${Object.keys(SFX).join('・')} です。`);
  if (dir.size && (!(dir.size in NOVEL_TEXT_STYLES) || NOVEL_TEXT_STYLES[/** @type {keyof typeof NOVEL_TEXT_STYLES} */ (dir.size)].kind !== 'size')) add('error', where, `文の大きさ「${dir.size}」は、bigかsmallです。`);
  if (dir.speed && (!(dir.speed in NOVEL_TEXT_STYLES) || NOVEL_TEXT_STYLES[/** @type {keyof typeof NOVEL_TEXT_STYLES} */ (dir.speed)].kind !== 'speed')) add('error', where, `文の速さ「${dir.speed}」は、slowかfastです。`);
  if (dir.wait < 0 || dir.wait > WAIT_MAX_MS) add('error', where, `間は0〜${WAIT_MAX_MS}ミリ秒にします(いま${dir.wait})。`);
}

const label = (who) => NOVEL_CHARACTERS[/** @type {keyof typeof NOVEL_CHARACTERS} */ (who)]?.label ?? who;
