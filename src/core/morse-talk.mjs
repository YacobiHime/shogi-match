// モールス信号で話す「無線で話す」(docs/brain-training-design.mdの18章)。画面に依存しない。
// 交信の進め方(届く文・通じる返事・相手の一言)、返事の照らし合わせ、自由に話すの返事、進み具合。

import { MORSE_TALKS, TALK_PARTNERS } from '../data/morse-talks.mjs';
import { fasterSpeed, keySpeed } from './morse-key.mjs';
import { MORSE_SESSIONS } from './palace-morse.mjs';

export { MORSE_TALKS, TALK_PARTNERS };

/** 1文字ちがいでも通じたことにする言葉の長さ(これより短い言葉は、ちがえば通じない)。 */
export const NEAR_MIN_LENGTH = 3;
/** 何回伝わらなかったら、返事の符号を見せるか(安全網。18-1)。 */
export const CLUE_AFTER_MISSES = 2;
/** 名前など、何でも受け取る返事の長さの上限。 */
export const FREE_MAX_LETTERS = 12;

/** 交信。 */
export function talkById(id) {
  return MORSE_TALKS.find((talk) => talk.id === id) ?? null;
}

/** 交信の相手。 */
export function partnerOf(talk) {
  return TALK_PARTNERS[talk?.partner] ?? TALK_PARTNERS.yacobi;
}

/** 相手の信号の速さ(羽音は1つ速い。18-4)。 */
export function incomingSpeed(talk, speedId) {
  return partnerOf(talk).faster ? fasterSpeed(speedId) : keySpeed(speedId).id;
}

/** 時刻のあいさつ(18-5)。5〜11時はGM、11〜17時はGA、ほかはGE。 */
export function greetFor(hour) {
  if (hour >= 5 && hour < 11) return { word: 'GM', mean: 'おはよう' };
  if (hour >= 11 && hour < 17) return { word: 'GA', mean: 'こんにちは' };
  return { word: 'GE', mean: 'こんばんは' };
}

/**
 * 文の{TEXT}・{GREET}・{GREET_MEAN}を置きかえる。
 * @param {string} value
 * @param {{ text?: string, hour?: number }} context
 */
export function fillTalkText(value, context = {}) {
  const greet = greetFor(context.hour ?? 12);
  return String(value ?? '')
    .replaceAll('{TEXT}', context.text ?? '')
    .replaceAll('{GREET_MEAN}', greet.mean)
    .replaceAll('{GREET}', greet.word)
    .replace(/ +/g, ' ')
    .trim();
}

/**
 * 交信の1つのやりとり(置きかえ済み)。
 * @param {ReturnType<typeof talkById>} talk
 * @param {string} nodeId
 * @param {{ text?: string, hour?: number }} context
 */
export function talkNode(talk, nodeId, context = {}) {
  const node = talk?.nodes?.[nodeId];
  if (!node) return null;
  const fill = (value) => fillTalkText(value, context);
  return {
    id: nodeId,
    send: fill(node.send),
    mean: fill(node.mean),
    lead: fill(node.lead ?? ''),
    say: fill(node.say ?? ''),
    clue: fill(node.clue ?? ''),
    end: Boolean(node.end),
    replies: (node.replies ?? []).map((reply) => ({
      free: Boolean(reply.free),
      words: [...new Set((reply.words ?? []).map((word) => compact(fill(word))))],
      mean: fill(reply.mean ?? ''),
      next: reply.next,
      react: fill(reply.react ?? ''),
    })),
  };
}

/** 返事の文を整える(大文字・空白は1つ)。 */
export function normalizeReply(text) {
  return String(text ?? '').toUpperCase().replace(/[^A-Z? ]/g, '').replace(/ +/g, ' ').trim();
}

function compact(text) {
  return normalizeReply(text).replace(/ /g, '');
}

/** 2つの言葉のちがい(1文字の入れかえ・足す・消すの回数)。 */
export function editDistance(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  let previous = Array.from({ length: cols }, (_, index) => index);
  for (let i = 1; i < rows; i += 1) {
    const current = [i];
    for (let j = 1; j < cols; j += 1) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[cols - 1];
}

/**
 * 返事を照らし合わせる(18-1)。空白は無視する。
 * ok：通じた / near：1文字ちがいだが通じた(長い言葉だけ) / miss：通じない(guessは1文字ちがいの言葉) / unreadable：読めない文字(?)がある / empty：何も打っていない。
 * @param {NonNullable<ReturnType<typeof talkNode>>} node
 * @param {string} text
 */
export function matchReply(node, text) {
  const normal = normalizeReply(text);
  const given = normal.replace(/ /g, '');
  if (!given) return { kind: 'empty', reply: null, guess: '' };
  if (given.includes('?')) return { kind: 'unreadable', reply: null, guess: '' };
  for (const reply of node.replies) {
    if (!reply.free && reply.words.includes(given)) return { kind: 'ok', reply, guess: '' };
  }
  let guess = '';
  for (const reply of node.replies) {
    for (const word of reply.words) {
      if (editDistance(word, given) !== 1) continue;
      if (word.length >= NEAR_MIN_LENGTH) return { kind: 'near', reply, guess: word };
      guess ||= word;
    }
  }
  const free = node.replies.find((reply) => reply.free);
  if (free && given.length <= FREE_MAX_LETTERS) return { kind: 'ok', reply: free, guess: '', text: normal };
  return { kind: 'miss', reply: null, guess };
}

/** 交信の中で、返事が要るやりとりの数(いちばん短い道のり。交信の一覧の「耳だけ ○/○」の分母の目安)。 */
export function talkReplyCount(talk) {
  if (!talk || talk.free) return 0;
  let id = talk.start;
  let count = 0;
  const seen = new Set();
  while (id && !seen.has(id)) {
    seen.add(id);
    const node = talk.nodes[id];
    if (!node || node.end) break;
    count += 1;
    id = node.replies?.[0]?.next ?? '';
  }
  return count;
}

// ===== 自由に話す =====

/** 自由に話すで、やこび姫が中身で返す言葉(18-5)。sendは送り返す文、meanは訳、sayは一言。 */
const FREE_WORDS = Object.freeze({
  HI: { send: 'HI', mean: 'やあ', say: 'やあ！ 聞こえてるよ。' },
  HELLO: { send: 'HI', mean: 'やあ', say: 'やあ！ 聞こえてるよ。' },
  SOS: { send: 'R', mean: '受け取った', say: 'SOS、受け取った！ すぐ行くね。' },
  SHOGI: { send: 'FB', mean: 'いいね', say: '将棋、指そう！' },
  YES: { send: 'FB', mean: 'いいね', say: 'うん！' },
  NO: { send: 'OK', mean: 'わかった', say: 'わかった。' },
  OK: { send: 'R', mean: '受け取った', say: 'オッケー！' },
  R: { send: 'R', mean: '受け取った', say: 'こっちも受け取ったよ。' },
  TU: { send: 'FB', mean: 'いいね', say: 'どういたしまして！' },
  GM: { send: 'GM', mean: 'おはよう', say: 'おはよう！' },
  GA: { send: 'GA', mean: 'こんにちは', say: 'こんにちは！' },
  GE: { send: 'GE', mean: 'こんばんは', say: 'こんばんは！' },
  GN: { send: 'GN', mean: 'おやすみ', say: 'おやすみ。また明日ね。' },
  GB: { send: 'GB', mean: 'さようなら', say: 'またね！' },
  CQ: { send: 'R K', mean: '受け取った、どうぞ', say: '呼んだ？ ここにいるよ。' },
  FB: { send: 'TU', mean: 'ありがとう', say: 'ありがとう！' },
  AGN: { send: '{LAST}', mean: '（さっきの言葉）', say: 'もう一度送るね。' },
  HIME: { send: 'HI', mean: 'やあ', say: '呼んだ？' },
  YACOBI: { send: 'HI', mean: 'やあ', say: '呼んだ？' },
  HANANE: { send: 'FB', mean: 'いいね', say: '羽音は、モールスもすごく速いんだよ。' },
  FU: { send: 'FB FU', mean: 'いいね、歩', say: '歩、いいね！' },
  KIN: { send: 'FB KIN', mean: 'いいね、金', say: '金、いいね！' },
  GIN: { send: 'FB GIN', mean: 'いいね、銀', say: '銀、いいね！' },
  KAKU: { send: 'FB KAKU', mean: 'いいね、角', say: '角、いいね！' },
  HISHA: { send: 'FB HISHA', mean: 'いいね、飛車', say: '飛車、いいね！' },
  OU: { send: 'FB OU', mean: 'いいね、玉', say: '玉、いいね！' },
});

/**
 * 自由に話すの返事。知っている言葉には中身で返し、知らない言葉は「R ○○」(受け取った)と送り返す。読めない文字があればAGN。
 * @param {string} text
 * @param {string} [last] さっきやこび姫が送った文(AGNのとき送り直す)
 */
export function freeAnswer(text, last = 'HI') {
  const normal = normalizeReply(text);
  if (!normal) return null;
  if (normal.includes('?')) return { send: 'AGN', mean: 'もう一度', say: '「？」の文字が読めなかった。もう一度送って！', known: false };
  const known = FREE_WORDS[normal.replace(/ /g, '')];
  if (known) return { send: known.send.replace('{LAST}', last), mean: known.mean, say: known.say, known: true };
  return { send: `R ${normal}`.slice(0, 24), mean: `受け取った、${normal}`, say: `「${normal}」って届いたよ！`, known: false };
}

// ===== 一覧と進み具合 =====

/** 「無線で話す」が開いているか(17章のコースの回3を終えたら。18-5)。 */
export function talkRoomOpen(morseProgress) {
  return (morseProgress?.done ?? 0) >= MORSE_SESSIONS.length;
}

/**
 * 交信の一覧。前の交信を終えると開く。
 * @param {{ done: string[], ears: Record<string, { ears: number, total: number }> }} talkProgress
 */
export function talkList(talkProgress) {
  const done = new Set(talkProgress.done);
  return MORSE_TALKS.map((talk) => {
    const open = !talk.after || done.has(talk.after);
    const before = talk.after ? talkById(talk.after) : null;
    return {
      talk,
      partner: partnerOf(talk),
      open,
      done: done.has(talk.id),
      best: talkProgress.ears[talk.id] ?? null,
      lock: open ? '' : `「${before?.title ?? ''}」のあとに開く`,
    };
  });
}

/**
 * 交信を終えた。終えた印・耳だけのいちばん良い数・送った文字を残す。開いた次の交信を返す。
 * @param {ReturnType<typeof import('./palace-morse.mjs').emptyTalkProgress>} talkProgress
 * @param {string} id
 * @param {{ ears: number, total: number, sent: number }} result
 */
export function completeTalk(talkProgress, id, result) {
  const before = new Set(talkList(talkProgress).filter((row) => row.open).map((row) => row.talk.id));
  const best = talkProgress.ears[id];
  const better = !best || result.ears > best.ears || (result.ears === best.ears && result.total < best.total);
  const progress = {
    ...talkProgress,
    done: talkProgress.done.includes(id) ? talkProgress.done : [...talkProgress.done, id],
    ears: result.total > 0 && better ? { ...talkProgress.ears, [id]: { ears: result.ears, total: result.total } } : talkProgress.ears,
    sent: talkProgress.sent + Math.max(0, result.sent),
  };
  const opened = talkList(progress).filter((row) => row.open && !before.has(row.talk.id)).map((row) => row.talk);
  return { progress, opened };
}

/** 耳だけで読めた割合(%。道場の記録の値)。 */
export function earsPercent(ears, total) {
  return total > 0 ? Math.round((100 * ears) / total) : 0;
}
