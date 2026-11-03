// 思い出しの箱(docs/brain-training-design.mdの14-9)。長く覚えておきたい組を宝物用の宮殿に置き、
// 1日・3日・1週間・2週間・1か月あとに思い出す。8割思い出せたら次の段、届かなければその場で覚え直して1段戻る。
// 1か月あとも思い出せたら宝物の棚へ。画面・保存の仕組み・宮殿の選び方(memory-palace.mjs)に依存しない。

/** 段ごとの、次に思い出すまでの日数(段0=入れた日。14-3のB22・B23)。段5は宝物の棚。 */
export const REVIEW_DAYS = Object.freeze([1, 3, 7, 14, 30]);
/** 宝物の棚に入る段。 */
export const SHELF_STAGE = REVIEW_DAYS.length;
/** 同時に入れておける組の数(14-5の上級者の深さ)。 */
export const BOX_MAX = 3;
/** 次の段に上がる割合。 */
export const BOX_PASS = 0.8;
/** 1つの組の数。 */
export const BOX_ITEM_MIN = 3;
export const BOX_ITEM_MAX = 12;
/** 宝物の棚に残す数。 */
export const SHELF_MAX = 60;

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function isDay(value) {
  return typeof value === 'string' && DAY_PATTERN.test(value);
}
function utc(day) {
  const [year, month, date] = day.split('-').map(Number);
  return Date.UTC(year, month - 1, date);
}
function pad(value) {
  return String(value).padStart(2, '0');
}

/** 日付に日数を足す(YYYY-MM-DD)。 */
export function addDays(day, count) {
  const date = new Date(utc(day) + count * 86400000);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** fromからtoまでの日数。 */
export function daysBetween(from, to) {
  return Math.round((utc(to) - utc(from)) / 86400000);
}

function cleanText(value, max) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : '';
}

/**
 * 1つの覚えるもの。wordは答え、askは思い出すときの問い、cueは絵の手がかり(「{場}」を含む文)、
 * pictureは絵の文に入れる言葉、emojiは絵。形の違う値は捨てる。
 * @returns {{ word: string, ask?: string, cue?: string, picture?: string, emoji?: string } | null}
 */
export function cleanBoxItem(value) {
  const source = typeof value === 'string' ? { word: value } : value;
  if (!isPlainObject(source)) return null;
  const word = cleanText(source.word, 24);
  if (!word) return null;
  const item = { word };
  const ask = cleanText(source.ask, 16);
  if (ask) item.ask = ask;
  const cue = cleanText(source.cue, 80);
  if (cue && cue.includes('{場}')) item.cue = cue;
  const picture = cleanText(source.picture, 16);
  if (picture) item.picture = picture;
  const emoji = cleanText(source.emoji, 8);
  if (emoji) item.emoji = emoji;
  return item;
}

/** 組の覚えるもの(3〜12個。同じ言葉は1つに)。足りなければnull。 */
export function cleanBoxItems(list) {
  if (!Array.isArray(list)) return null;
  const seen = new Set();
  const items = [];
  for (const value of list) {
    const item = cleanBoxItem(value);
    if (!item || seen.has(item.word)) continue;
    seen.add(item.word);
    items.push(item);
    if (items.length >= BOX_ITEM_MAX) break;
  }
  return items.length >= BOX_ITEM_MIN ? items : null;
}

/** 組が使う場所の範囲(startから、覚えるものの数だけ)。 */
export function boxRange(box) {
  return [box.start, box.start + box.items.length];
}

function overlaps(a, b) {
  const [aStart, aEnd] = boxRange(a);
  const [bStart, bEnd] = boxRange(b);
  return aStart < bEnd && bStart < aEnd;
}

function cleanBox(value) {
  if (!isPlainObject(value)) return null;
  const id = cleanText(value.id, 40);
  const items = cleanBoxItems(value.items);
  if (!id || !items || !isDay(value.added) || !isDay(value.next)) return null;
  if (!Number.isInteger(value.start) || value.start < 0 || value.start > 60) return null;
  if (!Number.isInteger(value.stage) || value.stage < 0 || value.stage >= SHELF_STAGE) return null;
  const pics = Array.isArray(value.pics) ? value.pics.slice(0, items.length).map((pic) => (Number.isInteger(pic) && pic >= 0 && pic < 20 ? pic : 0)) : [];
  return {
    id,
    set: cleanText(value.set, 24) || 'custom',
    title: cleanText(value.title, 24) || '自分の組',
    emoji: cleanText(value.emoji, 8) || '📦',
    items,
    start: value.start,
    stage: value.stage,
    added: value.added,
    next: value.next,
    last: isDay(value.last) ? value.last : '',
    pics: items.map((_, index) => pics[index] ?? 0),
  };
}

/** 箱の組を整える。形の違う組・同じid・場所の重なる組は捨て、3つまで。 */
export function cleanBoxes(value) {
  if (!Array.isArray(value)) return [];
  const boxes = [];
  for (const raw of value) {
    const box = cleanBox(raw);
    if (!box || boxes.some((other) => other.id === box.id || overlaps(other, box))) continue;
    boxes.push(box);
    if (boxes.length >= BOX_MAX) break;
  }
  return boxes;
}

/** 宝物の棚を整える。 */
export function cleanShelf(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isPlainObject)
    .map((entry) => ({
      set: cleanText(entry.set, 24) || 'custom',
      title: cleanText(entry.title, 24),
      emoji: cleanText(entry.emoji, 8) || '📦',
      count: Number.isInteger(entry.count) && entry.count > 0 ? Math.min(entry.count, BOX_ITEM_MAX) : 0,
      day: isDay(entry.day) ? entry.day : '',
    }))
    .filter((entry) => entry.title && entry.count && entry.day)
    .slice(-SHELF_MAX);
}

/**
 * 宮殿の空いた場所で、size個続けて置ける最初の場所(0から数える)。なければ-1。
 * 宝物の棚に入った組の場所は空いている(14-9)。
 */
export function freeStart(boxes, lociCount, size) {
  for (let start = 0; start + size <= lociCount; start += 1) {
    const candidate = { start, items: { length: size } };
    if (!boxes.some((box) => overlaps(box, candidate))) return start;
  }
  return -1;
}

/**
 * 組を箱に入れられるか。'max'は箱が3つ、'room'は宮殿の場所が足りない、'items'は数が合わない。
 * @returns {'' | 'max' | 'room' | 'items'}
 */
export function addBlocker(boxes, lociCount, size) {
  if (boxes.length >= BOX_MAX) return 'max';
  if (size < BOX_ITEM_MIN || size > BOX_ITEM_MAX) return 'items';
  return freeStart(boxes, lociCount, size) < 0 ? 'room' : '';
}

function boxId(boxes, set, day) {
  const base = `${set}-${day}`;
  let id = base;
  for (let n = 2; boxes.some((box) => box.id === id); n += 1) id = `${base}-${n}`;
  return id;
}

/**
 * 組を箱に入れる。入れた日はテストせず、最初の思い出しは次の日(14-3のB22)。
 * picsは場所に置いたときに選んだ絵の番号(思い出したあとに同じ絵を見せる)。
 * @param {ReturnType<typeof cleanBoxes>} boxes
 * @param {{ set: string, title: string, emoji: string, items: unknown[], pics?: number[] }} input
 * @param {number} lociCount
 * @param {string} day
 */
export function addBox(boxes, input, lociCount, day) {
  const items = cleanBoxItems(input.items);
  if (!items) return { boxes, box: null, blocker: 'items' };
  const blocker = addBlocker(boxes, lociCount, items.length);
  if (blocker) return { boxes, box: null, blocker };
  const box = cleanBox({
    id: boxId(boxes, cleanText(input.set, 24) || 'custom', day),
    set: input.set,
    title: input.title,
    emoji: input.emoji,
    items,
    start: freeStart(boxes, lociCount, items.length),
    stage: 0,
    added: day,
    next: addDays(day, REVIEW_DAYS[0]),
    last: '',
    pics: input.pics ?? [],
  });
  return { boxes: [...boxes, box], box, blocker: '' };
}

/** 時期の来た組(次の日が今日より前か今日)。早い順。 */
export function dueBoxes(boxes, day) {
  return boxes.filter((box) => box.next <= day).sort((a, b) => (a.next < b.next ? -1 : a.next > b.next ? 1 : 0));
}

/** 次に時期の来る日(今日より後でいちばん早い日)。なければ''。 */
export function nextBoxDay(boxes, day) {
  return boxes.map(({ next }) => next).filter((next) => next > day).sort()[0] ?? '';
}

/**
 * 思い出したあとの段と次の日。8割以上で1段上がり、段5なら宝物の棚へ。届かなければ1段戻す(0より下にならない)。
 * 遅れて思い出しても、その日から次の間隔を数える(遅れを責めない。14-9)。
 * @param {{ stage: number, items: unknown[] }} box
 * @param {boolean[]} results 場所ごとに思い出せたか
 * @param {string} day
 */
export function reviewOutcome(box, results, day) {
  const total = box.items.length;
  const correct = results.slice(0, total).filter(Boolean).length;
  const passed = total > 0 && correct / total >= BOX_PASS;
  const stage = passed ? box.stage + 1 : Math.max(0, box.stage - 1);
  const shelved = stage >= SHELF_STAGE;
  return {
    passed,
    correct,
    total,
    from: box.stage,
    stage: Math.min(stage, SHELF_STAGE),
    shelved,
    next: shelved ? '' : addDays(day, REVIEW_DAYS[stage]),
    missed: box.items.map((_, index) => !results[index]),
  };
}

/** 思い出した結果を箱と宝物の棚に入れる。 */
export function applyReview(boxes, shelf, id, results, day) {
  const box = boxes.find((item) => item.id === id);
  if (!box) return { boxes, shelf, outcome: null };
  const outcome = reviewOutcome(box, results, day);
  if (outcome.shelved) {
    const entry = { set: box.set, title: box.title, emoji: box.emoji, count: box.items.length, day };
    return { boxes: boxes.filter((item) => item.id !== id), shelf: [...shelf, entry].slice(-SHELF_MAX), outcome };
  }
  const next = { ...box, stage: outcome.stage, next: outcome.next, last: day };
  return { boxes: boxes.map((item) => (item.id === id ? next : item)), shelf, outcome };
}

/** 組を箱から外す(取り消せるように、外した組と場所の番号を返す)。 */
export function removeBox(boxes, id) {
  const index = boxes.findIndex((box) => box.id === id);
  if (index < 0) return { boxes, removed: null, index: -1 };
  return { boxes: boxes.filter((box) => box.id !== id), removed: boxes[index], index };
}

/** 外した組を戻す(5秒の「取り消す」)。場所が重なるなら戻さない。 */
export function restoreBox(boxes, box, index) {
  if (!box || boxes.length >= BOX_MAX || boxes.some((other) => other.id === box.id || overlaps(other, box))) return boxes;
  const next = [...boxes];
  next.splice(Math.max(0, Math.min(index, next.length)), 0, box);
  return next;
}

/** 間隔の言い方(「1日」「1週間」「1か月」)。 */
export function intervalText(days) {
  if (days >= 30) return `${Math.floor(days / 30)}か月`;
  if (days >= 7 && days % 7 === 0) return `${days / 7}週間`;
  return `${days}日`;
}

/** 前に思い出した日(なければ入れた日)から、何日ぶりか(「3日ぶり」「1週間ぶり」)。 */
export function sinceText(box, day) {
  const days = Math.max(1, daysBetween(box.last || box.added, day));
  if (days >= 30) return `${Math.floor(days / 30)}か月ぶり`;
  if (days >= 7) return `${Math.floor(days / 7)}週間ぶり`;
  return `${days}日ぶり`;
}

/** 箱の札の「今日」「あと4日」。 */
export function dueText(box, day) {
  const left = daysBetween(day, box.next);
  return left <= 0 ? '今日' : `あと${left}日`;
}

/** 段の言い方(いまの段で待っている間隔。「3日目」ではなく「次は3日あと」の意味で使う)。 */
export function stageText(stage) {
  return stage >= SHELF_STAGE ? '宝物' : `${intervalText(REVIEW_DAYS[stage])}あと`;
}
