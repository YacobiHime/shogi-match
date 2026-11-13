/**
 * 引き継ぎコード(docs/save-transfer-design.mdの3章)。まとめた記録(save-transfer.mjs)を暗号にして、
 * 公開先のFirebaseプロジェクトのFirestoreに7日間だけ預け、12文字のコードで別の端末から受け取る。
 * - 暗号の鍵とFirestoreの文書の名前は、どちらもコードから作る。コードはこの端末と受け取る端末にしかなく、
 *   預けた中身(名前を含む)は、コードを知らない人には読めない(Firestoreの持ち主にも)。
 * - SDKは使わずRESTで送る(最初に読むJSを重くしない。skill-data.mjsと同じ)。
 * - 文書は1件1MBまでなので、縮めて暗号にした文字を分けて置く(MAX_PARTSまで)。
 * 画面に依存しない。fetchとcryptoは引数で差し替えられる(テストのため)。
 */

import { SKILL_DATA_HOSTS } from "./skill-data.mjs";

const PROJECT_ID = "shogi-64125";
export const SAVE_CLOUD_COLLECTION = "saveTransfers";
export const SAVE_CLOUD_ENDPOINT = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${SAVE_CLOUD_COLLECTION}`;
/** 預ける日数。過ぎたら受け取れない(firestore.rulesでも断る)。 */
export const SAVE_CLOUD_DAYS = 7;
/** 1件の文書に入れる文字の数(ルールの上限700000より少し小さく)。 */
export const PART_CHARS = 650_000;
/** 分ける数の上限(ルールと同じ)。縮めたあとで約3MBまで。 */
export const MAX_PARTS = 6;
/** コードの文字(見まちがえやすい0・O・1・I・Lを除く31文字)。 */
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const CODE_LENGTH = 12;

/** 引き継ぎコードを使える場所か(公式の公開先で、暗号が使えるとき。展示用・ローカルではファイルで運ぶ)。 */
export function canUseSaveCloud({ hostname = "", secure = true } = {}) {
  return secure && SKILL_DATA_HOSTS.includes(hostname);
}

/**
 * 新しいコード(12文字)。
 * @param {(bytes: Uint8Array) => Uint8Array} [fill] 乱数で埋める関数(既定はcrypto.getRandomValues)
 */
export function newTransferCode(fill = (bytes) => globalThis.crypto.getRandomValues(bytes)) {
  const bytes = fill(new Uint8Array(CODE_LENGTH * 2));
  let code = "";
  for (const byte of bytes) {
    // 248以上を捨てて、31文字に偏りなく当てる(248 = 31 × 8)。
    if (byte >= 248) continue;
    code += CODE_ALPHABET[byte % 31];
    if (code.length === CODE_LENGTH) return code;
  }
  return code.length === CODE_LENGTH ? code : newTransferCode(fill);
}

/** 見せる形(XXXX-XXXX-XXXX)。 */
export function formatTransferCode(code) {
  return String(code).match(/.{1,4}/g)?.join("-") ?? "";
}

/**
 * 入れた文字をコードに直す。空白・ハイフンを除き、大文字にし、見まちがえやすい字を寄せる(O→0は使わないので断る)。
 * 12文字で、使う文字だけなら返す。違えば空。
 */
export function normalizeTransferCode(input) {
  const code = String(input ?? "")
    .normalize("NFKC")
    .toUpperCase()
    .replace(/[\s\-ー－‐]/g, "");
  if (code.length !== CODE_LENGTH) return "";
  return [...code].every((char) => CODE_ALPHABET.includes(char)) ? code : "";
}

const encoder = new TextEncoder();

async function sha256(text, subtle) {
  return new Uint8Array(await subtle.digest("SHA-256", encoder.encode(text)));
}

function hex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** コードからFirestoreの文書の名前(40文字の16進)を作る。 */
export async function transferDocId(code, subtle = globalThis.crypto.subtle) {
  return hex(await sha256(`yacobihime-save-id:${code}`, subtle)).slice(0, 40);
}

async function transferKey(code, subtle) {
  const raw = await sha256(`yacobihime-save-key:${code}`, subtle);
  return subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function toBase64(bytes) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}

function fromBase64(text) {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function pipe(bytes, stream) {
  const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

/**
 * 文字を縮めて暗号にし、base64の文字にする。先頭1文字は縮めたか(g=縮めた・p=そのまま)。
 * @param {string} text
 * @param {string} code
 */
export async function sealSaveText(text, code, { subtle = globalThis.crypto.subtle, fill = (bytes) => globalThis.crypto.getRandomValues(bytes) } = {}) {
  let body = encoder.encode(text);
  let mark = "p";
  if (typeof CompressionStream === "function") {
    body = await pipe(body, new CompressionStream("gzip"));
    mark = "g";
  }
  const iv = fill(new Uint8Array(12));
  const cipher = new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv }, await transferKey(code, subtle), body));
  const joined = new Uint8Array(iv.length + cipher.length);
  joined.set(iv, 0);
  joined.set(cipher, iv.length);
  return mark + toBase64(joined);
}

/**
 * 文字をgzipで縮めてbase64にする(暗号にしない。同期の記録はルールで本人だけが読めるため。cloud-sync.mjs)。
 * 先頭1文字は縮めたか(g=縮めた・p=そのまま)。
 * @param {string} text
 */
export async function packText(text) {
  if (typeof CompressionStream !== "function") return `p${text}`;
  return `g${toBase64(await pipe(encoder.encode(text), new CompressionStream("gzip")))}`;
}

/** packTextの逆。壊れているときは投げる。 */
export async function unpackText(packed) {
  if (packed[0] === "p") return packed.slice(1);
  if (packed[0] !== "g") throw new Error("broken");
  return new TextDecoder().decode(await pipe(fromBase64(packed.slice(1)), new DecompressionStream("gzip")));
}

/** sealSaveTextの逆。鍵が違う・壊れているときは投げる。 */
export async function openSaveText(sealed, code, { subtle = globalThis.crypto.subtle } = {}) {
  const mark = sealed[0];
  const joined = fromBase64(sealed.slice(1));
  const iv = joined.subarray(0, 12);
  const plain = new Uint8Array(await subtle.decrypt({ name: "AES-GCM", iv }, await transferKey(code, subtle), joined.subarray(12)));
  if (mark === "g") return new TextDecoder().decode(await pipe(plain, new DecompressionStream("gzip")));
  return new TextDecoder().decode(plain);
}

/** 文字を、文書1件に入る長さで分ける。 */
export function splitParts(text, size = PART_CHARS) {
  const parts = [];
  for (let index = 0; index < text.length; index += size) parts.push(text.slice(index, index + size));
  return parts.length ? parts : [""];
}

/** n番目の文書の名前(0番はコードの名前そのもの、1番からは「-1」などを付ける)。 */
export const partDocId = (docId, part) => (part === 0 ? docId : `${docId}-${part}`);

/** FirestoreのRESTの形の文書。 */
export function partDocument({ part, parts, data, at, expireAt }) {
  return {
    fields: {
      v: { integerValue: "1" },
      part: { integerValue: String(part) },
      parts: { integerValue: String(parts) },
      data: { stringValue: data },
      at: { timestampValue: new Date(at).toISOString() },
      expireAt: { timestampValue: new Date(expireAt).toISOString() },
    },
  };
}

/** 失敗の理由。画面の言葉はSAVE_TRANSFER_TEXTの errors。 */
export class SaveCloudError extends Error {
  /** @param {'offline' | 'too-large' | 'not-found' | 'expired' | 'broken'} reason */
  constructor(reason) {
    super(reason);
    this.reason = reason;
  }
}

/**
 * 記録を預けて、コードを返す。分けた文書は1番から先に置き、最後に0番を置く(0番があれば全部そろっている)。
 * @param {string} text encodeSaveの文字
 * @param {{ fetchImpl?: typeof fetch, now?: number, code?: string, subtle?: SubtleCrypto, fill?: (bytes: Uint8Array) => Uint8Array }} [options]
 * @returns {Promise<{ code: string, expireAt: number, parts: number }>}
 */
export async function uploadSave(text, { fetchImpl = globalThis.fetch, now = Date.now(), code = newTransferCode(), subtle = globalThis.crypto.subtle, fill } = {}) {
  const sealed = await sealSaveText(text, code, fill ? { subtle, fill } : { subtle });
  const parts = splitParts(sealed);
  if (parts.length > MAX_PARTS) throw new SaveCloudError("too-large");
  const docId = await transferDocId(code, subtle);
  const expireAt = now + SAVE_CLOUD_DAYS * 24 * 60 * 60 * 1000;
  const order = [...parts.keys()].slice(1).concat(0);
  for (const part of order) {
    let response;
    try {
      response = await fetchImpl(`${SAVE_CLOUD_ENDPOINT}?documentId=${partDocId(docId, part)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partDocument({ part, parts: parts.length, data: parts[part], at: now, expireAt })),
      });
    } catch {
      throw new SaveCloudError("offline");
    }
    if (!response.ok) throw new SaveCloudError("offline");
  }
  return { code, expireAt, parts: parts.length };
}

function readField(doc, name) {
  const field = doc?.fields?.[name];
  if (!field) return null;
  if ("integerValue" in field) return Number(field.integerValue);
  if ("stringValue" in field) return field.stringValue;
  if ("timestampValue" in field) return Date.parse(field.timestampValue);
  return null;
}

async function getPart(fetchImpl, docId, part) {
  let response;
  try {
    response = await fetchImpl(`${SAVE_CLOUD_ENDPOINT}/${partDocId(docId, part)}`);
  } catch {
    throw new SaveCloudError("offline");
  }
  // 期限を過ぎた文書はルールが断る(403)。ない文書は404。どちらも「見つからない」にまとめる(期限は0番で見分ける)。
  if (response.status === 404 || response.status === 403) throw new SaveCloudError("not-found");
  if (!response.ok) throw new SaveCloudError("offline");
  return response.json();
}

/**
 * コードで記録を受け取る(encodeSaveの文字と、分けた数を返す)。
 * @param {string} code normalizeTransferCodeを通したコード
 * @param {{ fetchImpl?: typeof fetch, now?: number, subtle?: SubtleCrypto }} [options]
 */
export async function downloadSave(code, { fetchImpl = globalThis.fetch, now = Date.now(), subtle = globalThis.crypto.subtle } = {}) {
  const docId = await transferDocId(code, subtle);
  const head = await getPart(fetchImpl, docId, 0);
  const expireAt = readField(head, "expireAt");
  if (!Number.isFinite(expireAt) || expireAt <= now) throw new SaveCloudError("expired");
  const parts = readField(head, "parts");
  if (!Number.isInteger(parts) || parts < 1 || parts > MAX_PARTS) throw new SaveCloudError("broken");
  const chunks = [readField(head, "data")];
  for (let part = 1; part < parts; part += 1) chunks.push(readField(await getPart(fetchImpl, docId, part), "data"));
  if (chunks.some((chunk) => typeof chunk !== "string")) throw new SaveCloudError("broken");
  try {
    return { text: await openSaveText(chunks.join(""), code, { subtle }), parts };
  } catch {
    throw new SaveCloudError("broken");
  }
}

/**
 * 受け取ったあと、預けた文書を消す(コードは1回だけ使える)。消せなくても受け取りは済んでいるので、黙って続ける。
 * @param {string} code
 * @param {{ fetchImpl?: typeof fetch, parts?: number, subtle?: SubtleCrypto }} [options]
 */
export async function deleteSave(code, { fetchImpl = globalThis.fetch, parts = MAX_PARTS, subtle = globalThis.crypto.subtle } = {}) {
  const docId = await transferDocId(code, subtle);
  await Promise.all(
    Array.from({ length: parts }, (_, part) =>
      fetchImpl(`${SAVE_CLOUD_ENDPOINT}/${partDocId(docId, part)}`, { method: "DELETE" }).catch(() => null),
    ),
  );
}

/** 作ったコードの覚え(期限のあとに預けた文書を消すため。docs/save-transfer-design.mdの6章)。引き継ぎでは運ばない。 */
export const TRANSFER_CODES_KEY = "yacobihime:shogi-match:transfer-codes:v1";
/** 覚えておくコードの数(新しい順)。 */
export const MAX_REMEMBERED_CODES = 10;

/**
 * 覚えたコードを読む。読めない・形の違うものは除く。
 * @param {Storage | null | undefined} storage
 * @returns {{ code: string, parts: number, expireAt: number }[]}
 */
export function loadTransferCodes(storage) {
  try {
    const value = JSON.parse(storage?.getItem(TRANSFER_CODES_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((entry) => entry && normalizeTransferCode(entry.code) && Number.isInteger(entry.parts) && entry.parts >= 1 && entry.parts <= MAX_PARTS && Number.isFinite(entry.expireAt));
  } catch {
    return [];
  }
}

function writeTransferCodes(storage, list) {
  try {
    if (list.length) storage?.setItem(TRANSFER_CODES_KEY, JSON.stringify(list));
    else storage?.removeItem(TRANSFER_CODES_KEY);
  } catch {
    // 書けない環境では覚えない(掃除しないだけ)。
  }
}

/**
 * 作ったコードを覚える(新しい順にMAX_REMEMBERED_CODESまで)。
 * @param {Storage | null | undefined} storage
 * @param {{ code: string, parts: number, expireAt: number }} entry
 */
export function rememberTransferCode(storage, { code, parts, expireAt }) {
  const list = loadTransferCodes(storage).filter((entry) => entry.code !== code);
  writeTransferCodes(storage, [{ code, parts, expireAt }, ...list].slice(0, MAX_REMEMBERED_CODES));
}

/**
 * 期限を過ぎたコードの文書を消し、覚えから外す。消した数を返す。通信できなければ覚えたまま(次に開いたとき)。
 * 受け取られたコードの文書はもう消えているので、消しても何も起きない。
 * @param {Storage | null | undefined} storage
 * @param {{ now?: number, fetchImpl?: typeof fetch, subtle?: SubtleCrypto }} [options]
 */
export async function sweepTransferCodes(storage, { now = Date.now(), fetchImpl = globalThis.fetch, subtle = globalThis.crypto.subtle } = {}) {
  const list = loadTransferCodes(storage);
  const expired = list.filter((entry) => entry.expireAt <= now);
  if (!expired.length) return 0;
  const done = new Set();
  for (const entry of expired) {
    const docId = await transferDocId(entry.code, subtle);
    const results = await Promise.all(
      Array.from({ length: entry.parts }, (_, part) =>
        fetchImpl(`${SAVE_CLOUD_ENDPOINT}/${partDocId(docId, part)}`, { method: "DELETE" }).then((response) => response.ok || response.status === 404, () => false),
      ),
    );
    if (results.every(Boolean)) done.add(entry.code);
  }
  // 消しているあいだに新しく覚えたコードを消さないよう、読み直してから外す。
  writeTransferCodes(storage, loadTransferCodes(storage).filter((entry) => !done.has(entry.code)));
  return done.size;
}
