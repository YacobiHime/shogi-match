/**
 * Googleアカウントで記録を同期する(docs/cloud-sync-design.md)。
 * ログインはログインのページ(auth.html・src/auth/login-page.ts)がFirebaseのSDKで行い、得た「更新のための印」をこの端末に置く。
 * 対局画面はSDKを使わず、RESTで印を作り直し、Firestoreの cloudSaves/{uid} を読み書きする(最初に読むJSを重くしない)。
 * - 記録の単位は引き継ぎと同じまとめ(save-transfer.mjs)。縮めて分けて置く(save-cloud.mjsのpackText・splitParts)。
 * - 前に合わせた時点(base)を覚え、両方の端末で別々に遊んだときだけ、どちらを使うか聞く(decideSync)。
 * - 見出しと分けた文書は1回のまとめ書き(documents:commit)で書き、見出しに「前に読んだ版のときだけ」の条件を付ける。
 * 画面に依存しない。fetchは引数で差し替えられる(テストのため)。
 */

import { FIREBASE_EMULATORS, FIREBASE_WEB_CONFIG, isLocalHost } from "./firebase-config.mjs";
import { RESET_GROUPS, isMatchSnapshotKey } from "./data-reset.mjs";
import { MAX_PARTS, packText, splitParts, unpackText } from "./save-cloud.mjs";
import { SKILL_DATA_HOSTS } from "./skill-data.mjs";
import { formatSaveTime, summaryLines } from "./save-transfer.mjs";

/** この端末のログインの印と、前に合わせた時点。引き継ぎでは運ばない(save-transfer.mjsのTRANSFER_SKIP_KEYS)。 */
export const CLOUD_SYNC_KEY = "yacobihime:shogi-match:cloud-sync:v1";
export const CLOUD_COLLECTION = "cloudSaves";
/** 遊んでいるあいだ、送る間の最小(ミリ秒)。無料の枠の書き込みを使いすぎないため(4章)。 */
export const PUSH_INTERVAL_MS = 3 * 60 * 1000;
/** 画面が隠れたとき、送る間の最小(別の端末へ移る前の最後の手を残すため、短くする)。 */
export const HIDDEN_PUSH_INTERVAL_MS = 5 * 1000;
/** 戻ってきたとき、クラウドを見直すまでの隠れていた時間。 */
export const RETURN_CHECK_MS = 60 * 1000;
/** 指紋を見る間(遊んでいるあいだ)。 */
export const TICK_MS = 60 * 1000;
/** 混んでいる(無料の枠を超えた)・断られたときに休む時間。 */
export const PAUSE_MS = 60 * 60 * 1000;
/** 見出しの要約の文字の上限(ルールと同じ)。 */
const SUMMARY_CHARS = 2000;

const PROJECT_ID = FIREBASE_WEB_CONFIG.projectId;
const DOC_ROOT = `projects/${PROJECT_ID}/databases/(default)/documents`;

/** 失敗の理由。画面の言葉はCLOUD_SYNC_TEXTの errors。 */
export class CloudSyncError extends Error {
  /** @param {'offline' | 'signed-out' | 'conflict' | 'busy' | 'denied' | 'too-large' | 'broken'} reason */
  constructor(reason) {
    super(reason);
    this.reason = reason;
  }
}

/**
 * @typedef {{ rev: number, updateTime: string, hash: string, at: number, parts?: number }} CloudBase
 * @typedef {{ v: 1, uid: string, email: string, name: string, refreshToken: string, device: string, signedInAt: number,
 *   emulator?: { auth: string, firestore: string } | null, base?: CloudBase | null, notice?: string, pulledAt?: number,
 *   changedAt?: number, changedHash?: string }} CloudState
 * @typedef {{ rev: number, updateTime: string, at: number, device: string, parts: number, size: number, summary: string, hash: string }} CloudHead
 * @typedef {{ idToken: string, expiresAt: number }} CloudSession
 */

/** 同期を使える場所か。公式の公開先のhttps、または確かめのエミュレーター(127.0.0.1・localhostで、印にエミュレーターがあるとき)。 */
export function canUseCloudSync({ hostname = "", secure = true, emulator = false } = {}) {
  if (isLocalHost(hostname)) return Boolean(emulator);
  return secure && SKILL_DATA_HOSTS.includes(hostname);
}

/** 端末の印(8文字)。 */
export function newDeviceId(fill = (bytes) => globalThis.crypto.getRandomValues(bytes)) {
  return Array.from(fill(new Uint8Array(6)), (byte) => byte.toString(36).padStart(2, "0")).join("").slice(0, 10);
}

function str(value, max) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function readBase(value) {
  if (!value || typeof value !== "object") return null;
  const { rev, updateTime, hash, at, parts } = value;
  if (!Number.isInteger(rev) || typeof updateTime !== "string" || typeof hash !== "string") return null;
  return { rev, updateTime, hash, at: Number(at) || 0, parts: Number.isInteger(parts) && parts >= 1 && parts <= MAX_PARTS ? parts : 1 };
}

/**
 * この端末の印を読む。ログインしていなければnull。
 * @param {Storage | null | undefined} storage
 * @returns {CloudState | null}
 */
export function loadCloudState(storage) {
  try {
    const value = JSON.parse(storage?.getItem(CLOUD_SYNC_KEY) ?? "null");
    if (!value || typeof value !== "object" || typeof value.uid !== "string" || !value.uid || typeof value.refreshToken !== "string" || !value.refreshToken) return null;
    const emulator = value.emulator && typeof value.emulator.auth === "string" && typeof value.emulator.firestore === "string"
      ? { auth: value.emulator.auth, firestore: value.emulator.firestore }
      : null;
    return {
      v: 1,
      uid: value.uid,
      email: str(value.email, 200),
      name: str(value.name, 100),
      refreshToken: value.refreshToken,
      device: str(value.device, 16) || newDeviceId(),
      signedInAt: Number(value.signedInAt) || 0,
      emulator,
      base: readBase(value.base),
      notice: str(value.notice, 20),
      pulledAt: Number(value.pulledAt) || 0,
      changedAt: Number(value.changedAt) || 0,
      changedHash: str(value.changedHash, 40),
    };
  } catch {
    return null;
  }
}

/** 印を書く(書けない環境では何もしない)。 */
export function saveCloudState(storage, state) {
  try {
    storage?.setItem(CLOUD_SYNC_KEY, JSON.stringify(state));
  } catch {
    // 書けないときは、次に開いたとき前の時点から合わせ直す。
  }
}

/** ログアウト(印と前に合わせた時点を消す。この端末の記録は残る)。 */
export function clearCloudState(storage) {
  try {
    storage?.removeItem(CLOUD_SYNC_KEY);
  } catch {
    // 消せない環境では何もしない。
  }
}

/**
 * ログインのページで得たものから、新しい印を作る(前に合わせた時点はない＝この端末で初めて)。
 * @param {{ uid: string, email?: string | null, name?: string | null, refreshToken: string, emulator?: boolean, now?: number }} input
 * @returns {CloudState}
 */
export function newCloudState({ uid, email, name, refreshToken, emulator = false, now = Date.now() }) {
  return {
    v: 1,
    uid,
    email: str(email ?? "", 200),
    name: str(name ?? "", 100),
    refreshToken,
    device: newDeviceId(),
    signedInAt: now,
    emulator: emulator ? { ...FIREBASE_EMULATORS } : null,
    base: null,
    notice: "signed-in",
    pulledAt: 0,
  };
}

/** 記録の指紋(鍵を並べた中身のFNV-1aを2本。16文字の16進)。 */
export function saveFingerprint(entries) {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ 0x5bd1e995;
  const mix = (text) => {
    for (let index = 0; index < text.length; index += 1) {
      const code = text.charCodeAt(index);
      a = Math.imul(a ^ code, 0x01000193);
      b = Math.imul(b ^ code, 0x01000193) ^ (b >>> 15);
    }
  };
  for (const key of Object.keys(entries ?? {}).sort()) {
    mix(key);
    mix("\u0000");
    mix(entries[key]);
    mix("\u0001");
  }
  return (a >>> 0).toString(16).padStart(8, "0") + (b >>> 0).toString(16).padStart(8, "0");
}

/** 記録の進み具合の鍵(データリセットの種類の鍵)。名前と設定はここに入らない。 */
const PROGRESS_KEYS = new Set(RESET_GROUPS.flatMap((group) => group.keys));

/** 記録がない(進み具合の鍵も中断した対局もない。名前と設定だけ)か。 */
export function isFreshSave(entries) {
  return !Object.keys(entries ?? {}).some((key) => PROGRESS_KEYS.has(key) || isMatchSnapshotKey(key));
}

/**
 * することを決める(3章の表)。
 * - none：何もしない / push：送る / pull：受け取って置き換える / adopt：中身が同じなので時点だけ合わせる / choose：どちらを使うか聞く
 * - gone：前に合わせたのにクラウドの記録がない(ほかの端末で消した)。この端末もログアウトする(作り直さない)。
 * @param {{ head: CloudHead | null, base: CloudBase | null | undefined, localHash: string, localFresh: boolean }} input
 * @returns {'none' | 'push' | 'pull' | 'adopt' | 'choose' | 'gone'}
 */
export function decideSync({ head, base, localHash, localFresh }) {
  if (!head) {
    if (base) return "gone";
    return localFresh ? "none" : "push";
  }
  if (head.hash && head.hash === localHash) return base && base.updateTime === head.updateTime ? "none" : "adopt";
  if (!base) return localFresh ? "pull" : "choose";
  if (head.updateTime === base.updateTime) return localHash === base.hash ? "none" : "push";
  return localHash === base.hash ? "pull" : "choose";
}

/** RESTの道。エミュレーターのときはエミュレーターへ。 */
export function cloudEndpoints(state) {
  const firestore = state?.emulator?.firestore ?? "https://firestore.googleapis.com";
  const token = state?.emulator?.auth ? `${state.emulator.auth}/securetoken.googleapis.com` : "https://securetoken.googleapis.com";
  return {
    documents: `${firestore}/v1/${DOC_ROOT}`,
    commit: `${firestore}/v1/${DOC_ROOT}:commit`,
    token: `${token}/v1/token?key=${FIREBASE_WEB_CONFIG.apiKey}`,
  };
}

const headName = (uid) => `${DOC_ROOT}/${CLOUD_COLLECTION}/${uid}`;
const partName = (uid, part) => `${DOC_ROOT}/${CLOUD_COLLECTION}/${uid}/parts/${part}`;

/** ログアウトになる印の更新の失敗(パスワードの変更・アカウントの停止・印の取り消しなど)。 */
const SIGNED_OUT_ERRORS = ["TOKEN_EXPIRED", "USER_DISABLED", "USER_NOT_FOUND", "INVALID_REFRESH_TOKEN", "INVALID_GRANT_TYPE", "MISSING_REFRESH_TOKEN", "PROJECT_NUMBER_MISMATCH"];

async function errorMessage(response) {
  try {
    const body = await response.json();
    return String(body?.error?.message ?? body?.error?.status ?? body?.[0]?.error?.status ?? "");
  } catch {
    return "";
  }
}

/**
 * 1時間有効の印(IDトークン)を作り直す。更新の印が変わったら state.refreshToken を書き換える(呼ぶ側が保存する)。
 * @param {CloudState} state
 * @param {{ fetchImpl?: typeof fetch, now?: number }} [options]
 * @returns {Promise<CloudSession>}
 */
export async function refreshSession(state, { fetchImpl = globalThis.fetch, now = Date.now() } = {}) {
  let response;
  try {
    response = await fetchImpl(cloudEndpoints(state).token, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(state.refreshToken)}`,
    });
  } catch {
    throw new CloudSyncError("offline");
  }
  if (!response.ok) {
    const message = await errorMessage(response);
    if (SIGNED_OUT_ERRORS.some((code) => message.startsWith(code))) throw new CloudSyncError("signed-out");
    throw new CloudSyncError(response.status === 429 ? "busy" : "offline");
  }
  const body = await response.json();
  if (typeof body?.id_token !== "string" || (body.user_id && body.user_id !== state.uid)) throw new CloudSyncError("signed-out");
  if (typeof body.refresh_token === "string" && body.refresh_token) state.refreshToken = body.refresh_token;
  return { idToken: body.id_token, expiresAt: now + Math.max(60, Number(body.expires_in) || 3600) * 1000 - 60_000 };
}

function failure(response, message) {
  if (response.status === 401) return new CloudSyncError("signed-out");
  if (response.status === 403) return new CloudSyncError("denied");
  if (response.status === 429) return new CloudSyncError("busy");
  if (response.status === 409 || /FAILED_PRECONDITION|ALREADY_EXISTS|NOT_FOUND|ABORTED/.test(message)) return new CloudSyncError("conflict");
  return new CloudSyncError("offline");
}

function readField(doc, name) {
  const field = doc?.fields?.[name];
  if (!field) return null;
  if ("integerValue" in field) return Number(field.integerValue);
  if ("stringValue" in field) return field.stringValue;
  if ("timestampValue" in field) return Date.parse(field.timestampValue);
  return null;
}

async function call(fetchImpl, url, session, init = {}) {
  try {
    return await fetchImpl(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${session.idToken}` } });
  } catch {
    throw new CloudSyncError("offline");
  }
}

/**
 * クラウドの見出しを読む。まだなければnull。
 * @param {CloudState} state
 * @param {CloudSession} session
 * @param {{ fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<CloudHead | null>}
 */
export async function readCloudHead(state, session, { fetchImpl = globalThis.fetch } = {}) {
  const response = await call(fetchImpl, `${cloudEndpoints(state).documents}/${CLOUD_COLLECTION}/${state.uid}`, session);
  if (response.status === 404) return null;
  if (!response.ok) throw failure(response, await errorMessage(response));
  const doc = await response.json();
  const parts = readField(doc, "parts");
  const rev = readField(doc, "rev");
  if (!Number.isInteger(parts) || parts < 1 || parts > MAX_PARTS || !Number.isInteger(rev) || typeof doc.updateTime !== "string") throw new CloudSyncError("broken");
  return {
    rev,
    updateTime: doc.updateTime,
    at: readField(doc, "at") ?? 0,
    device: readField(doc, "device") ?? "",
    parts,
    size: readField(doc, "size") ?? 0,
    summary: readField(doc, "summary") ?? "",
    hash: readField(doc, "hash") ?? "",
  };
}

/**
 * クラウドの記録を受け取る(encodeSaveの文字)。見出しと分けた文書の版がそろわないときは、1回だけ読み直す。
 * @param {CloudState} state
 * @param {CloudSession} session
 * @param {CloudHead} head
 * @param {{ fetchImpl?: typeof fetch, retry?: boolean }} [options]
 * @returns {Promise<{ text: string, head: CloudHead }>}
 */
export async function downloadCloudSave(state, session, head, { fetchImpl = globalThis.fetch, retry = true } = {}) {
  const base = `${cloudEndpoints(state).documents}/${CLOUD_COLLECTION}/${state.uid}/parts`;
  const chunks = [];
  for (let part = 0; part < head.parts; part += 1) {
    const response = await call(fetchImpl, `${base}/${part}`, session);
    if (!response.ok) {
      if (response.status === 404 && retry) break;
      throw failure(response, await errorMessage(response));
    }
    const doc = await response.json();
    if (readField(doc, "rev") !== head.rev) break;
    chunks.push(readField(doc, "data"));
  }
  if (chunks.length !== head.parts || chunks.some((chunk) => typeof chunk !== "string")) {
    // 読むあいだに、ほかの端末が書いた。見出しから読み直す。
    if (!retry) throw new CloudSyncError("broken");
    const again = await readCloudHead(state, session, { fetchImpl });
    if (!again) throw new CloudSyncError("conflict");
    return downloadCloudSave(state, session, again, { fetchImpl, retry: false });
  }
  try {
    return { text: await unpackText(chunks.join("")), head };
  } catch {
    throw new CloudSyncError("broken");
  }
}

/**
 * 見出しの要約(確認の窓に出す行の元。名前・レーティング・対局数・竜王戦の期数)。
 * @param {{ name?: string, rating?: number | null, games?: number, ryuoSeasons?: number }} summary
 */
export function headSummary(summary) {
  return JSON.stringify({ name: summary.name ?? "", rating: summary.rating ?? null, games: summary.games ?? 0, ryuoSeasons: summary.ryuoSeasons ?? 0 }).slice(0, SUMMARY_CHARS);
}

/** 見出しの要約を、確認の窓の行にする(壊れていれば空)。 */
export function headSummaryLines(head) {
  try {
    const value = JSON.parse(head?.summary ?? "{}");
    return summaryLines({ name: str(value.name, 100), rating: Number.isFinite(value.rating) ? value.rating : null, games: Number(value.games) || 0, ryuoSeasons: Number(value.ryuoSeasons) || 0, at: head?.at ?? 0 });
  } catch {
    return [];
  }
}

/**
 * 記録を送る。見出しと分けた文書を1回のまとめ書きで書く。
 * expectは前に読んだ見出し(その版のときだけ書く)。nullなら「まだないときだけ」。ほかの端末が先に書いていたら conflict。
 * @param {CloudState} state
 * @param {CloudSession} session
 * @param {{ text: string, hash: string, summary: string, expect: CloudHead | null, now?: number }} input
 * @param {{ fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<CloudBase & { parts: number }>}
 */
export async function uploadCloudSave(state, session, { text, hash, summary, expect, now = Date.now() }, { fetchImpl = globalThis.fetch } = {}) {
  const parts = splitParts(await packText(text));
  if (parts.length > MAX_PARTS) throw new CloudSyncError("too-large");
  const rev = (expect?.rev ?? 0) + 1;
  const at = new Date(now).toISOString();
  const writes = [
    {
      update: {
        name: headName(state.uid),
        fields: {
          v: { integerValue: "1" },
          rev: { integerValue: String(rev) },
          at: { timestampValue: at },
          device: { stringValue: state.device },
          parts: { integerValue: String(parts.length) },
          size: { integerValue: String(text.length) },
          summary: { stringValue: summary.slice(0, SUMMARY_CHARS) },
          hash: { stringValue: hash },
        },
      },
      currentDocument: expect ? { updateTime: expect.updateTime } : { exists: false },
    },
    ...parts.map((data, part) => ({
      update: { name: partName(state.uid, part), fields: { v: { integerValue: "1" }, rev: { integerValue: String(rev) }, data: { stringValue: data } } },
    })),
    // 前の版が多く分けていたら、余った文書を消す。
    ...Array.from({ length: Math.max(0, (expect?.parts ?? 0) - parts.length) }, (_, index) => ({ delete: partName(state.uid, parts.length + index) })),
  ];
  const response = await call(fetchImpl, cloudEndpoints(state).commit, session, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ writes }),
  });
  if (!response.ok) throw failure(response, await errorMessage(response));
  const body = await response.json();
  const updateTime = body?.writeResults?.[0]?.updateTime ?? body?.commitTime;
  if (typeof updateTime !== "string") throw new CloudSyncError("broken");
  return { rev, updateTime, hash, at: now, parts: parts.length };
}


/**
 * クラウドの記録を消す(見出しと分けた文書を全部)。
 * @param {CloudState} state
 * @param {CloudSession} session
 * @param {{ fetchImpl?: typeof fetch }} [options]
 */
export async function deleteCloudSave(state, session, { fetchImpl = globalThis.fetch } = {}) {
  const writes = [{ delete: headName(state.uid) }, ...Array.from({ length: MAX_PARTS }, (_, part) => ({ delete: partName(state.uid, part) }))];
  const response = await call(fetchImpl, cloudEndpoints(state).commit, session, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ writes }),
  });
  if (!response.ok) throw failure(response, await errorMessage(response));
}

/** ホームの小さな状態の文(ログインしていなければ空)。 */
export function syncStatusText(status, savedAt) {
  const T = CLOUD_SYNC_TEXT.status;
  if (status === "syncing") return T.syncing;
  if (status === "choose") return T.choose;
  if (status === "paused") return T.paused;
  if (status === "offline") return T.offline;
  if (savedAt) return T.saved(formatSaveTime(savedAt).replace(/^\d+年/, ""));
  return T.ready;
}

/** 同期の言葉(UI_Nintendo_Implementation.mdの4章。文言は1か所に)。 */
export const CLOUD_SYNC_TEXT = Object.freeze({
  head: "Googleアカウントで同期",
  signIn: "Googleでログイン",
  signInNote: "どの端末でも、自動で同じ記録になるよ",
  signedInAs: (who) => `${who}でログイン中`,
  lastSaved: (when) => `最後に保存：${when}`,
  notSavedYet: "まだクラウドに保存していないよ",
  syncNow: "今すぐ同期",
  signOut: "ログアウト",
  signedOut: "ログアウトしたよ。この端末の記録はそのまま残るよ。",
  deleteCloud: "クラウドの記録を消す",
  deleteHead: "クラウドの記録を消して、ログアウトします。",
  deleteNote: "この端末の記録は残るよ。ほかの端末では、次に開いたときにログアウトになるよ。",
  deleteGo: "消す",
  deleted: "クラウドの記録を消して、ログアウトしたよ。",
  gone: "クラウドの記録がほかの端末で消されたので、ログアウトしたよ。この端末の記録は残っているよ。",
  chooseHead: "どちらの記録を使う？",
  chooseLead: "この端末とクラウドで、別々に遊んだ記録があるよ。",
  chooseFirst: "クラウドにも、この端末にも記録があるよ。",
  chooseNote: "選ばなかったほうの記録は消えるよ。",
  local: "この端末の記録",
  cloud: "クラウドの記録",
  useThis: "この記録を使う",
  later: "あとで決める",
  keepLocal: "この端末の記録をファイルに残す",
  keptLocal: "この端末の記録をファイルに残したよ",
  synced: "クラウドと合わせたよ。",
  pulled: "ほかの端末の続きを読み込んだよ。",
  signedInPushed: "ログインしたよ。この端末の記録をクラウドに保存したよ。",
  signedInPulled: "ログインしたよ。クラウドの記録を読み込んだよ。",
  signedIn: "ログインしたよ。",
  status: Object.freeze({
    saved: (when) => `☁ ${when} 保存`,
    ready: "☁ ログイン中",
    syncing: "☁ 合わせています…",
    choose: "☁ どちらを使うか決めてね",
    paused: "☁ 休んでいます",
    offline: "☁ つながっていません",
  }),
  errors: Object.freeze({
    offline: "通信できなかったよ。つながったら、自動でまた合わせるね。",
    "signed-out": "ログインが切れたよ。もう一度ログインしてね。",
    busy: "クラウドが混んでいるよ。1時間あとに、また合わせるね。",
    denied: "クラウドに書けなかったよ。1時間あとに、また合わせるね。",
    "too-large": "記録が大きすぎて、クラウドに保存できないよ。ファイルで運んでね。",
    broken: "クラウドの記録が読めなかったよ。この端末の記録で保存し直すときは「この記録を使う」を押してね。",
    conflict: "ほかの端末が先に保存したよ。もう一度合わせるね。",
    apply: "この端末に書ききれなかったよ。記録は前のままだよ。",
  }),
  resetSynced: "ログイン中なので、ほかの端末でも消えます。",
  resetAllSignedIn: "ログアウトします。クラウドの記録は残ります。",
});
