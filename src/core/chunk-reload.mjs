// 遅れて読み込む部分(画面や終盤戦の局面のデータ)が読めなかったときの扱い(docs/chunk-reload-design.md)。
// 公開し直すと、名前に中身のハッシュを持つ部分のファイルが入れ替わる。前に開いたままのページは古い名前を読みに行き、
// 見つからずに失敗する。そのときはページを1回だけ読み込み直して新しい版にする。続けて失敗したら、読み込み直しを繰り返さず一言で知らせる。

/** 読み込み直した時刻(sessionStorage。タブを閉じれば消える。データリセットの対象外の設定)。 */
export const CHUNK_RELOAD_KEY = 'yacobihime:shogi-match:chunk-reload';
/** この時間のうちに2回目の失敗があったら、読み込み直さない(繰り返しを防ぐ)。 */
export const CHUNK_RELOAD_WINDOW_MS = 60_000;

/** 読めなかったときに、やこび姫が言う一言。 */
export const CHUNK_FAIL_TEXT = '読み込めなかったよ。ページを読み込み直して、もう一度押してみてね';

/**
 * 遅れて読み込む部分が読めなかった失敗か(ブラウザごとに言い方が違う)。
 * @param {unknown} error
 */
export function isChunkLoadError(error) {
  const message = String(/** @type {{ message?: unknown }} */ (error)?.message ?? error ?? '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk .* failed|ChunkLoadError|Unable to preload CSS/i.test(message);
}

/**
 * 読み込み直してよいか。よければ時刻を記録する(同じ失敗で何度も読み込み直さない)。
 * @param {Pick<Storage, 'getItem' | 'setItem'> | null | undefined} storage
 * @param {number} [now]
 */
export function claimChunkReload(storage, now = Date.now()) {
  let last = 0;
  try {
    last = Number(storage?.getItem(CHUNK_RELOAD_KEY) ?? 0) || 0;
  } catch {
    last = 0;
  }
  if (now - last < CHUNK_RELOAD_WINDOW_MS) return false;
  try {
    storage?.setItem(CHUNK_RELOAD_KEY, String(now));
  } catch {
    // 記録できないなら、繰り返しを防げないので読み込み直さない。
    return false;
  }
  return true;
}
