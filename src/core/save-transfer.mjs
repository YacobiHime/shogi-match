/**
 * 引き継ぎ(docs/save-transfer-design.md)。この端末の記録を1つにまとめ、別の端末で置き換える。
 * ファイルでも引き継ぎコード(save-cloud.mjs)でも、運ぶ中身はこのまとめ(bundle)。画面と通信に依存しない。
 */

import { isAppStorageKey } from "./exhibit-reset.mjs";
import { normalizePlayerProfile } from "./player-name.mjs";

export const SAVE_FORMAT = "yacobihime-shogi-save";
/** まとめの形の版。形を変えたら上げ、古い版を読む処理を足す。新しい版は読まない。 */
export const SAVE_VERSION = 1;

const Y = "yacobihime:shogi-match:";

/**
 * 持っていかない鍵。端末ごとの番号と同意(匿名送信。端末が替われば聞き直す)、読み直しの印、画面の覚え書き。
 * 音と盤・駒の見た目は持っていく(その人の好みなので)。
 */
export const TRANSFER_SKIP_KEYS = Object.freeze([
  `${Y}skill-data-anon:v1`,
  `${Y}skill-data-consent:v1`,
  `${Y}chunk-reload`,
  `${Y}note-tab`,
  `${Y}note-album-page`,
]);

/** 引き継ぎで運ぶ鍵か。 */
export function isTransferKey(key) {
  return isAppStorageKey(key) && !TRANSFER_SKIP_KEYS.includes(key);
}

/**
 * この端末の記録をまとめる。読めない鍵は飛ばす。
 * @param {Storage | null | undefined} storage
 * @param {{ now?: number }} [options]
 * @returns {{ format: string, v: number, at: number, entries: Record<string, string> }}
 */
export function collectSave(storage, { now = Date.now() } = {}) {
  /** @type {Record<string, string>} */
  const entries = {};
  try {
    for (let index = 0; index < (storage?.length ?? 0); index += 1) {
      const key = storage?.key(index);
      if (!key || !isTransferKey(key)) continue;
      const value = storage?.getItem(key);
      if (typeof value === "string") entries[key] = value;
    }
  } catch {
    // 一覧が読めない環境では、読めたところまで。
  }
  return { format: SAVE_FORMAT, v: SAVE_VERSION, at: now, entries };
}

/** まとめを文字にする(ファイル・引き継ぎコードの中身)。 */
export function encodeSave(bundle) {
  return JSON.stringify(bundle);
}

/**
 * 文字からまとめを読み、確かめる。
 * reasonは 'broken'(読めない・このゲームの記録でない)・'newer'(新しい版のゲームで作った)・'empty'(記録がない)。
 * @param {string} text
 * @returns {{ ok: true, bundle: { format: string, v: number, at: number, entries: Record<string, string> } } | { ok: false, reason: 'broken' | 'newer' | 'empty' }}
 */
export function decodeSave(text) {
  let value;
  try {
    value = JSON.parse(String(text ?? ""));
  } catch {
    return { ok: false, reason: "broken" };
  }
  if (!value || typeof value !== "object" || value.format !== SAVE_FORMAT || !Number.isInteger(value.v)) return { ok: false, reason: "broken" };
  if (value.v > SAVE_VERSION) return { ok: false, reason: "newer" };
  if (!value.entries || typeof value.entries !== "object" || Array.isArray(value.entries)) return { ok: false, reason: "broken" };
  /** @type {Record<string, string>} */
  const entries = {};
  for (const [key, entry] of Object.entries(value.entries)) {
    // このゲームの鍵で、文字の値だけを受け取る(ほかのサイトの鍵や、運ばない鍵は書かない)。
    if (isTransferKey(key) && typeof entry === "string") entries[key] = entry;
  }
  if (!Object.keys(entries).length) return { ok: false, reason: "empty" };
  return { ok: true, bundle: { format: SAVE_FORMAT, v: value.v, at: Number(value.at) || 0, entries } };
}

function parsed(entries, key) {
  try {
    return JSON.parse(entries[key] ?? "null");
  } catch {
    return null;
  }
}

/**
 * 確認の窓に出す要約(名前・レーティング・対局数・竜王戦の期数・記録の数と大きさ・まとめた日時)。
 * @param {{ at?: number, entries: Record<string, string> }} bundle
 */
export function summarizeSave(bundle) {
  const entries = bundle?.entries ?? {};
  const profile = normalizePlayerProfile(parsed(entries, `${Y}player-name:v1`));
  const rating = parsed(entries, `${Y}player-rating`);
  const career = parsed(entries, `${Y}ryuo-career`);
  const bytes = Object.entries(entries).reduce((sum, [key, value]) => sum + key.length + value.length, 0);
  return {
    name: profile.name || "",
    rating: Number.isFinite(rating?.rating) ? Math.round(rating.rating) : null,
    games: Number.isFinite(rating?.games) ? Math.max(0, Math.round(rating.games)) : 0,
    ryuoSeasons: Number.isFinite(career?.seasons) ? Math.max(0, Math.round(career.seasons)) : 0,
    keys: Object.keys(entries).length,
    bytes,
    at: Number(bundle?.at) || 0,
  };
}

/** 要約を、確認の窓の1行ずつの文にする。 */
export function summaryLines(summary) {
  const lines = [];
  lines.push(summary.name ? `名前：${summary.name}` : "名前：まだ決めていない");
  if (summary.rating !== null) lines.push(`レーティング：R${summary.rating}（${summary.games}局）`);
  if (summary.ryuoSeasons > 0) lines.push(`竜王戦：${summary.ryuoSeasons}期`);
  if (summary.at) lines.push(`まとめた日時：${formatSaveTime(summary.at)}`);
  return lines;
}

/** 日時を「2026年11月11日 14:05」の形に(その端末の時刻で)。 */
export function formatSaveTime(at) {
  const date = new Date(at);
  if (!Number.isFinite(date.getTime())) return "";
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 大きさを「1.2MB」「340KB」の形に。 */
export function formatSaveSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

/**
 * この端末の記録を、まとめの中身に置き換える。運ぶ鍵のうち、まとめにないものは消す(引き継いだ端末と同じにする)。
 * 書けなかった(容量を超えたなど)ときは、置き換える前の記録に戻して ok:false を返す。
 * @param {Storage | null | undefined} storage
 * @param {{ entries: Record<string, string> }} bundle
 * @returns {{ ok: boolean, written: number }}
 */
export function applySave(storage, bundle) {
  if (!storage) return { ok: false, written: 0 };
  const before = collectSave(storage).entries;
  const clear = () => {
    for (const key of Object.keys(collectSave(storage).entries)) {
      try {
        storage.removeItem(key);
      } catch {
        // 消せない鍵は飛ばす。
      }
    }
  };
  try {
    clear();
    let written = 0;
    for (const [key, value] of Object.entries(bundle.entries)) {
      storage.setItem(key, value);
      written += 1;
    }
    return { ok: true, written };
  } catch {
    clear();
    for (const [key, value] of Object.entries(before)) {
      try {
        storage.setItem(key, value);
      } catch {
        // 戻せない鍵は飛ばす(もとは入っていたので、ふつうは戻せる)。
      }
    }
    return { ok: false, written: 0 };
  }
}

/** 書き出すファイルの名前(yacobihime-shogi-20261111.json)。 */
export function saveFileName(at = Date.now()) {
  const date = new Date(at);
  const pad = (value) => String(value).padStart(2, "0");
  return `yacobihime-shogi-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}.json`;
}

/** 引き継ぎの画面の言葉(UI_Nintendo_Implementation.mdの4章。文言は1か所に)。 */
export const SAVE_TRANSFER_TEXT = Object.freeze({
  title: "引き継ぎ",
  lead: "別の端末で、続きから遊べるよ。",
  sendHead: "この端末から送る",
  receiveHead: "この端末で受け取る",
  makeCode: "引き継ぎコードを作る",
  makeCodeNote: "暗号にして7日間あずけるよ",
  exportFile: "ファイルに書き出す",
  exportFileNote: "インターネットなしでも運べるよ",
  enterCode: "コードを入れる",
  enterCodeNote: "もう1台で作ったコード",
  importFile: "ファイルを読み込む",
  importFileNote: "書き出したファイル",
  cloudOff: "引き継ぎコードは、公開ページ（shogi-64125.web.app）でだけ使えるよ。ここではファイルで運んでね。",
  close: "閉じる",
  back: "戻る",
  uploading: "記録をあずけているよ…",
  downloading: "記録を受け取っているよ…",
  codeHead: "引き継ぎコード",
  codeUntil: (until) => `${until}まで使えるよ。1回受け取ると消えるよ。`,
  codeHow: "もう1台でこのゲームを開いて、ホームの「引き継ぎ」→「コードを入れる」に入れてね。この端末の記録はそのまま残るよ。",
  copy: "コピーする",
  copied: "コピーしたよ",
  enterHead: "コードを入れてね",
  enterHint: "12文字（ハイフンはなくてもいいよ）",
  receive: "受け取る",
  exported: (name) => `「${name}」を保存したよ。もう1台で「ファイルを読み込む」から開いてね。`,
  confirmHead: "この端末の記録を、引き継いだ記録に置き換えます。",
  confirmNote: "いまのこの端末の記録は消えます。",
  incoming: "引き継ぐ記録",
  current: "この端末の今の記録",
  keepCurrent: "今の記録をファイルに残す",
  keptCurrent: "今の記録をファイルに残したよ",
  replace: "置き換える",
  errors: Object.freeze({
    code: "コードは12文字だよ。0・1・O・I・Lは使わないよ。",
    offline: "通信できなかったよ。インターネットにつないで、もう一度ためしてね。",
    "too-large": "記録が大きすぎて、コードではあずけられないよ。ファイルで運んでね。",
    "not-found": "そのコードの記録が見つからないよ。打ち間違いか、7日を過ぎたか、もう受け取ったのかも。",
    expired: "このコードは7日を過ぎたよ。もう1台で作り直してね。",
    broken: "記録が読めなかったよ。もう1台で作り直してね。",
    file: "このゲームの記録のファイルではないみたい。",
    newer: "新しい版のゲームで作った記録だよ。ページを読み直してから、もう一度ためしてね。",
    empty: "このファイルには記録が入っていないよ。",
    apply: "この端末に書ききれなかったよ。記録は前のままだよ。",
  }),
});
