/** ログイン後、今回のアカウントの印を保存できたと確かめてからゲームへ戻る。 */
import { loadCloudState, newCloudState, saveCloudState } from '../core/cloud-sync.mjs';

/** @param {Storage | null} storage @param {Parameters<typeof newCloudState>[0]} account */
export function rememberLogin(storage, account) {
  const next = newCloudState(account);
  saveCloudState(storage, next);
  const saved = loadCloudState(storage);
  if (saved?.uid !== next.uid || saved?.device !== next.device || saved?.refreshToken !== next.refreshToken) {
    throw Object.assign(new Error('ログイン状態を保存できません'), { code: 'app/storage' });
  }
  return next;
}
