// ノベルの台本のテキスト形式を読む(docs/novel-scene-design.mdの12-3、書き方はdocs/novel-authoring-guide.md)。画面に依存しない。
// マークダウンのような文から、NovelScene.vueが読む場面の形を作り、書きまちがいを行の番号つきで返す。
//
//   # 題名
//   id: main-01
//   bg: classroom
//   cast: hanane momoka
//   summary: あらすじ(1〜2文)
//
//   : 地の文
//   羽音: 台詞 [ぴょん]
//   百花(worried): 台詞 [！] [羽音:うなずく]
//   [暗転] [bg:night]
//   - 答え {値}
//     羽音: 返し

import {
  BACKGROUND_LABELS, ENTER_FROM, EXTRA_WHO, FACE_LABELS, NOVEL_ACTS, NOVEL_BACKGROUND_IDS, NOVEL_CHARACTERS, NOVEL_EMOTES,
  NOVEL_SCREEN, NOVEL_TEXT_STYLES, NOVEL_TONES, checkScene,
} from './novel-direction.mjs';
import { SFX } from './novel-sound.mjs';

/** 頭に書ける項目。 */
export const SCRIPT_META_KEYS = Object.freeze(['id', 'bg', 'cast', 'summary', 'voices', 'vars', 'start']);

/** @typedef {import('./novel-direction.mjs').NovelProblem} NovelProblem */

const words = (value) => String(value ?? '').split(/[\s,、]+/).map((word) => word.trim()).filter(Boolean);

/** 呼び名からidを引く表を作る(idそのもの・呼び名・別の書き方)。 */
function aliasTable(table) {
  /** @type {Map<string, string>} */
  const map = new Map();
  for (const [id, entry] of Object.entries(table)) {
    map.set(id, id);
    map.set(id.toLowerCase(), id);
    if (entry?.label) map.set(entry.label, id);
    for (const alias of entry?.aliases ?? []) map.set(alias, id);
  }
  return map;
}
const ACT_ALIAS = aliasTable(NOVEL_ACTS);
const EMOTE_ALIAS = aliasTable(NOVEL_EMOTES);
const SCREEN_ALIAS = aliasTable(NOVEL_SCREEN);
const TONE_ALIAS = aliasTable(NOVEL_TONES);
const STYLE_ALIAS = aliasTable(NOVEL_TEXT_STYLES);
const SFX_ALIAS = aliasTable(SFX);
const BG_ALIAS = (() => {
  /** @type {Map<string, string>} */
  const map = new Map();
  for (const id of NOVEL_BACKGROUND_IDS) map.set(id, id);
  for (const [id, label] of Object.entries(BACKGROUND_LABELS)) {
    map.set(label, id);
    map.set(label.replace(/（.*）/, ''), id);
  }
  return map;
})();
const PERSON_ALIAS = (() => {
  /** @type {Map<string, string>} */
  const map = aliasTable(NOVEL_CHARACTERS);
  map.delete('地の文');
  return map;
})();
const FACE_ALIAS = (() => {
  /** @type {Map<string, string>} */
  const map = new Map();
  for (const [id, aliases] of Object.entries(FACE_LABELS)) {
    map.set(id, id);
    for (const alias of aliases) map.set(alias, id);
  }
  return map;
})();
/** `名前:値`の形の、名前の側に来る決まった言葉。 */
const KEYWORDS = Object.freeze({
  enter: 'enter', 登場: 'enter', exit: 'exit', 退場: 'exit',
  bg: 'bg', 背景: 'bg', sfx: 'sfx', 音: 'sfx', wait: 'wait', 間: 'wait', tone: 'tone', 色: 'tone', face: 'face', 顔: 'face',
});

/**
 * 台本の文を読む。
 * @param {string} source
 * @returns {{ scene: any, problems: NovelProblem[] }}
 */
export function parseNovelScript(source) {
  /** @type {NovelProblem[]} */
  const problems = [];
  const error = (line, message) => problems.push({ level: 'error', line, message });
  const rows = String(source ?? '').replace(/\r\n?/g, '\n').split('\n');
  const scene = { id: '', title: '', summary: '', background: 'classroom', cast: /** @type {string[]} */ ([]), lines: /** @type {any[]} */ ([]) };
  /** @type {string[]} */
  let vars = [];
  /** @type {Set<string>} */
  const voices = new Set();
  let inHeader = true;
  /** 演出だけの行(次の行に付ける)。 */
  /** @type {{ tokens: string[], row: number }[]} */
  let pending = [];
  /** いまの選択肢(返しの行を足す先)。 */
  /** @type {any} */
  let choice = null;
  /** 選択肢を持つ行。 */
  /** @type {any} */
  let choiceOwner = null;

  const resolvePerson = (name) => PERSON_ALIAS.get(name) ?? PERSON_ALIAS.get(name.toLowerCase()) ?? (voices.has(name) ? EXTRA_WHO : null);

  rows.forEach((raw, at) => {
    const row = at + 1;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('//')) return;
    // 題名
    const title = trimmed.match(/^#\s+(.+)$/);
    if (title && inHeader && !scene.title) {
      scene.title = title[1].trim();
      return;
    }
    // 頭の項目
    const meta = trimmed.match(/^([a-z]+)\s*:\s*(.*)$/);
    if (inHeader && meta && SCRIPT_META_KEYS.includes(meta[1])) {
      const value = meta[2].trim();
      if (meta[1] === 'id') scene.id = value;
      else if (meta[1] === 'summary') scene.summary = value;
      else if (meta[1] === 'bg') {
        const bg = BG_ALIAS.get(value);
        if (!bg) error(row, `背景「${value}」は知りません。使えるのは ${NOVEL_BACKGROUND_IDS.join('・')} です。`);
        scene.background = bg ?? value;
      } else if (meta[1] === 'cast' || meta[1] === 'start') {
        const ids = words(value).map((name) => {
          const id = PERSON_ALIAS.get(name) ?? PERSON_ALIAS.get(name.toLowerCase());
          if (!id) error(row, `「${meta[1]}:」の「${name}」は知りません。立ち絵のある人(${Object.values(NOVEL_CHARACTERS).filter((c) => c.portrait).map((c) => `${c.id}・${c.label}`).join('、')})を書きます。`);
          return id ?? name;
        });
        if (meta[1] === 'cast') scene.cast = ids;
        else /** @type {any} */ (scene).start = ids;
      } else if (meta[1] === 'voices') for (const name of words(value)) voices.add(name);
      else if (meta[1] === 'vars') vars = words(value);
      return;
    }
    inHeader = false;
    // 演出を取り出す
    /** @type {string[]} */
    const tokens = [];
    const body = raw.replace(/[[［]([^\]］]*)[\]］]/g, (_, inner) => {
      tokens.push(...words(inner));
      return '';
    });
    const indented = /^(\s{2,}|\t)/.test(body) && body.trim() !== '';
    const text = body.trim();
    if (!text) {
      if (tokens.length) pending.push({ tokens, row });
      return;
    }
    // 選択肢
    const option = text.match(/^[-・]\s+(.+)$/);
    if (option && !indented) {
      const owner = choiceOwner ?? scene.lines.at(-1);
      if (!owner) {
        error(row, '選択肢の前に、問いかけの行がありません。');
        return;
      }
      const label = option[1].match(/^(.*?)\s*[{｛]([^}｝]*)[}｝]\s*$/);
      choice = { label: (label ? label[1] : option[1]).trim(), value: label ? label[2].trim() : '', reply: [] };
      owner.choices = [...(owner.choices ?? []), choice];
      choiceOwner = owner;
      return;
    }
    const line = readLine(text, row);
    if (!line) return;
    const allTokens = [...pending.flatMap((item) => item.tokens), ...tokens];
    pending = [];
    applyTokens(line, allTokens, row);
    if (indented) {
      if (!choice) error(row, '下げた行は、選択肢(「- 答え」)の返しにだけ書けます。');
      else choice.reply.push(line);
      return;
    }
    choice = null;
    choiceOwner = null;
    scene.lines.push(line);
  });
  if (pending.length) error(pending[0].row, '演出だけの行のあとに、本文の行がありません(演出は次の行に付きます)。');
  if (vars.length) /** @type {any} */ (scene).vars = vars;
  const checked = checkScene(scene, { vars });
  return { scene, problems: [...problems, ...checked].sort((a, b) => (a.line ?? 0) - (b.line ?? 0)) };

  /** 地の文・台詞の1行を読む。 */
  function readLine(text, row) {
    const narration = text.match(/^[:：]\s*(.*)$/);
    if (narration) return { who: 'narration', face: 'neutral', name: '', text: narration[1].trim(), src: row };
    const spoken = text.match(/^([^:：(（\s][^:：(（]*?)\s*(?:[(（]([^)）]*)[)）])?\s*[:：]\s*(.*)$/);
    if (!spoken) {
      error(row, `読めない行です:「${text.slice(0, 20)}」。地の文は「: 」、台詞は「名前: 」で始めます。`);
      return null;
    }
    const name = spoken[1].trim();
    const who = resolvePerson(name);
    if (!who) {
      error(row, `「${name}」はだれか分かりません。人物(${Object.values(NOVEL_CHARACTERS).filter((c) => c.id !== 'narration').map((c) => c.label).join('・')})か、頭の「voices:」に書いた名前を使います。`);
      return null;
    }
    const faceName = (spoken[2] ?? '').trim();
    const face = faceName ? FACE_ALIAS.get(faceName) ?? faceName : 'neutral';
    const person = NOVEL_CHARACTERS[/** @type {keyof typeof NOVEL_CHARACTERS} */ (who)];
    return { who, face, name: who === EXTRA_WHO ? name : person?.name ?? name, text: spoken[3].trim(), src: row };
  }

  /** 演出の言葉を、行の欄にする。 */
  function applyTokens(line, list, row) {
    for (const token of list) {
      const colon = token.replace('：', ':');
      const split = colon.indexOf(':');
      const head = split > 0 ? colon.slice(0, split) : colon;
      const tail = split > 0 ? colon.slice(split + 1) : '';
      if (split > 0 && head in KEYWORDS) {
        keyword(line, KEYWORDS[/** @type {keyof typeof KEYWORDS} */ (head)], tail, line.who, row, token);
        continue;
      }
      if (split > 0) {
        const target = resolvePerson(head);
        if (!target || target === EXTRA_WHO) {
          error(row, `演出「${token}」の「${head}」がだれか分かりません。`);
          continue;
        }
        personToken(line, target, tail, row, token);
        continue;
      }
      if (token in KEYWORDS) {
        keyword(line, KEYWORDS[/** @type {keyof typeof KEYWORDS} */ (token)], '', line.who, row, token);
        continue;
      }
      if (SCREEN_ALIAS.has(token)) line.screen = SCREEN_ALIAS.get(token);
      else if (TONE_ALIAS.has(token)) line.tone = TONE_ALIAS.get(token);
      else if (STYLE_ALIAS.has(token)) {
        const id = /** @type {keyof typeof NOVEL_TEXT_STYLES} */ (STYLE_ALIAS.get(token));
        line[NOVEL_TEXT_STYLES[id].kind] = id;
      } else personToken(line, line.who, token, row, token);
    }
  }

  /** だれかの動き・漫符・表情・登場・退場。 */
  function personToken(line, who, token, row, original) {
    const [head, tail = ''] = token.split(':');
    if (head in KEYWORDS && (KEYWORDS[/** @type {keyof typeof KEYWORDS} */ (head)] === 'enter' || KEYWORDS[/** @type {keyof typeof KEYWORDS} */ (head)] === 'exit')) {
      keyword(line, KEYWORDS[/** @type {keyof typeof KEYWORDS} */ (head)], tail, who, row, original);
      return;
    }
    if (ACT_ALIAS.has(token)) line.acts = [...(line.acts ?? []), { who, act: ACT_ALIAS.get(token) }];
    else if (EMOTE_ALIAS.has(token)) line.emotes = [...(line.emotes ?? []), { who, emote: EMOTE_ALIAS.get(token) }];
    else if (FACE_ALIAS.has(token)) line.faces = { ...(line.faces ?? {}), [who]: FACE_ALIAS.get(token) };
    else error(row, `演出「${original}」は知りません。動き・漫符・表情・画面の効果の名前は、docs/novel-authoring-guide.mdの表を見ます。`);
  }

  /** 決まった言葉(enter・bg・sfxなど)。 */
  function keyword(line, kind, value, who, row, original) {
    if (kind === 'enter') {
      const from = value ? ENTER_FROM_ALIAS(value) : 'fade';
      if (!from) error(row, `登場の向き「${value}」は知りません。left(左)・right(右)・fade(ふわっと)のどれかです。`);
      line.enter = [...(line.enter ?? []), { who, from: from ?? 'fade' }];
    } else if (kind === 'exit') line.exit = [...(line.exit ?? []), who];
    else if (kind === 'bg') {
      const bg = BG_ALIAS.get(value);
      if (!bg) error(row, `背景「${value}」は知りません。使えるのは ${NOVEL_BACKGROUND_IDS.join('・')} です。`);
      else line.bg = bg;
    } else if (kind === 'sfx') {
      const id = SFX_ALIAS.get(value);
      if (!id) error(row, `効果音「${value}」は知りません。使えるのは ${Object.keys(SFX).join('・')} です。`);
      else line.sfx = [...(line.sfx ?? []), id];
    } else if (kind === 'wait') {
      const ms = Number(value);
      if (!Number.isFinite(ms)) error(row, `間「${original}」は、ミリ秒の数で書きます(例: [間:600])。`);
      else line.wait = ms;
    } else if (kind === 'tone') {
      const tone = TONE_ALIAS.get(value);
      if (!tone) error(row, `色「${value}」は知りません。使えるのは ${Object.keys(NOVEL_TONES).join('・')} です。`);
      else line.tone = tone;
    } else if (kind === 'face') {
      const face = FACE_ALIAS.get(value) ?? value;
      line.faces = { ...(line.faces ?? {}), [who]: face };
    }
  }
}

/** 登場の向きの呼び名。 */
function ENTER_FROM_ALIAS(value) {
  const map = { 左: 'left', 右: 'right', ふわっと: 'fade' };
  if (value in ENTER_FROM) return value;
  return map[/** @type {keyof typeof map} */ (value)] ?? null;
}

/**
 * 検査の結果を1行ずつの文にする(道具と試し読みのページで使う)。
 * @param {NovelProblem[]} problems
 * @param {string} [file]
 */
export function formatProblems(problems, file = '') {
  return problems.map((problem) => `${file ? `${file}:` : ''}${problem.line ?? '-'}: ${problem.level === 'error' ? 'まちがい' : '注意'} ${problem.message}`);
}
