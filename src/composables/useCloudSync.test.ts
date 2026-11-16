import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({ mounted: [] as (() => void)[], unmounted: [] as (() => void)[], refresh: vi.fn(), head: vi.fn(), upload: vi.fn(), download: vi.fn(), remove: vi.fn() }));
vi.mock("vue", async () => ({ ...await vi.importActual("vue"), onMounted: (fn: () => void) => fake.mounted.push(fn), onBeforeUnmount: (fn: () => void) => fake.unmounted.push(fn) }));
vi.mock("../core/cloud-sync.mjs", async () => ({ ...await vi.importActual("../core/cloud-sync.mjs"), refreshSession: fake.refresh, readCloudHead: fake.head, uploadCloudSave: fake.upload, downloadCloudSave: fake.download, deleteCloudSave: fake.remove }));
import { useCloudSync } from "./useCloudSync";
import { CLOUD_SYNC_KEY, CloudSyncError, newCloudState, saveCloudState, saveFingerprint } from "../core/cloud-sync.mjs";
import { collectSave, encodeSave } from "../core/save-transfer.mjs";
const KEY = "yacobihime:shogi-match:player-rating";
function memory(): Storage {
  const data = new Map<string, string>();
  return { get length() { return data.size; }, key: i => [...data.keys()][i] ?? null, getItem: k => data.get(k) ?? null, setItem: (k,v) => { data.set(k,String(v)); }, removeItem: k => { data.delete(k); }, clear: () => data.clear() };
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
let store: Storage;
let base: {rev:number;updateTime:string;hash:string;at:number;parts:number};
beforeEach(() => {
  vi.useFakeTimers(); fake.mounted.length = 0; fake.unmounted.length = 0;
  for (const fn of [fake.refresh, fake.head, fake.upload, fake.download, fake.remove]) fn.mockReset();
  store = memory(); store.setItem(KEY, JSON.stringify({ rating: 100, games: 1 }));
  base = { rev:1, updateTime:"v1", hash:saveFingerprint(collectSave(store).entries), at:1000, parts:1 };
  saveCloudState(store, { ...newCloudState({ uid:"test-user",refreshToken:"test-refresh" }), base, notice:"" });
  fake.refresh.mockResolvedValue({ idToken:"test-token", expiresAt:Date.now()+60_000 });
  fake.head.mockResolvedValue({ ...base, device:"other", size:100, summary:"{}" });
  fake.upload.mockResolvedValue({ ...base, rev:2, updateTime:"v2" });
  const win = Object.assign(new EventTarget(), { localStorage:store, isSecureContext:true, location:{ hostname:"shogi-64125.web.app",pathname:"/game.html",search:"",href:"https://shogi-64125.web.app/game.html",reload:vi.fn() }, setTimeout,clearTimeout,setInterval,clearInterval });
  vi.stubGlobal("window",win); vi.stubGlobal("document",Object.assign(new EventTarget(),{visibilityState:"visible"}));
});
afterEach(() => { fake.unmounted.forEach(fn => fn()); vi.useRealTimers(); vi.unstubAllGlobals(); });
function start(extra: Parameters<typeof useCloudSync>[0] = { enabled:true }) { const api = useCloudSync(extra); fake.mounted.forEach(fn=>fn()); return api; }
async function idle(extra?: Parameters<typeof useCloudSync>[0]) { const api=start(extra); await api.syncNow(); return api; }
function remoteSave() { const remote=memory();remote.setItem(KEY,JSON.stringify({rating:200,games:2}));return { text:encodeSave(collectSave(remote)),head:{...base,rev:2,updateTime:"v2",hash:saveFingerprint(collectSave(remote).entries),device:"other",size:100,summary:"{}"} }; }

describe("同期中の記録とログイン状態を守る", () => {
  it("更新トークンの通信中にログアウトしてもログイン状態を復活させない", async () => {
    const pending=deferred<{idToken:string;expiresAt:number}>();
    fake.refresh.mockImplementation(async (state) => { const result=await pending.promise;state.refreshToken="rotated";return result; });
    const api=start();api.signOut();pending.resolve({idToken:"old",expiresAt:Date.now()+60_000});await flush();
    expect(api.signedIn.value).toBe(false);expect(store.getItem(CLOUD_SYNC_KEY)).toBeNull();expect(fake.head).not.toHaveBeenCalled();
  });
  it("アップロード中にログアウトしても完了した通信で印を保存し直さない", async () => {
    const api=await idle();const pending=deferred<typeof base>();fake.upload.mockReturnValue(pending.promise);
    store.setItem(KEY,JSON.stringify({rating:110,games:2}));const task=api.syncNow();await flush();api.signOut();pending.resolve({...base,rev:2,updateTime:"v2"});await task;
    expect(store.getItem(CLOUD_SYNC_KEY)).toBeNull();expect(api.status.value).toBe("off");
  });
  it("ダウンロード中に遊んだ記録は上書きせず、どちらを使うか聞き直す", async () => {
    const api=await idle();const got=remoteSave();fake.head.mockResolvedValue(got.head);const pending=deferred<typeof got>();fake.download.mockReturnValue(pending.promise);
    const task=api.syncNow();await flush();store.setItem(KEY,JSON.stringify({rating:150,games:3}));pending.resolve(got);await flush();
    expect(JSON.parse(store.getItem(KEY)!).rating).toBe(150);expect(api.status.value).toBe("choose");expect(window.location.reload).not.toHaveBeenCalled();void task;
  });
  it("ほかのタブでログアウトしたあとは受信した記録を適用しない", async () => {
    const api=await idle();const got=remoteSave();fake.head.mockResolvedValue(got.head);const pending=deferred<typeof got>();fake.download.mockReturnValue(pending.promise);
    void api.syncNow();await flush();store.removeItem(CLOUD_SYNC_KEY);const event=new Event("storage");Object.assign(event,{key:CLOUD_SYNC_KEY});window.dispatchEvent(event);pending.resolve(got);await flush();
    expect(JSON.parse(store.getItem(KEY)!).rating).toBe(100);expect(api.signedIn.value).toBe(false);expect(window.location.reload).not.toHaveBeenCalled();
  });
  it("対局などで適用できない間は読み直さず選択を保留する", async () => {
    const api=await idle({enabled:true,canApply:()=>false});const got=remoteSave();fake.head.mockResolvedValue(got.head);fake.download.mockResolvedValue(got);
    void api.syncNow();await flush();expect(api.status.value).toBe("choose");expect(window.location.reload).not.toHaveBeenCalled();
  });
  it("選択した記録の送信中に別の同期を重ねない", async () => {
    const api=await idle();const got=remoteSave();fake.head.mockResolvedValue(got.head);store.setItem(KEY,JSON.stringify({rating:150,games:3}));await api.syncNow();
    const pending=deferred<typeof base>();fake.upload.mockReturnValue(pending.promise);const local=api.useLocal();await flush();const check=api.syncNow();await flush();
    expect(fake.head).toHaveBeenCalledTimes(2);pending.resolve({...base,rev:3,updateTime:"v3"});await Promise.all([local,check]);
  });
  it("選択中にクラウドの版が変わっても待ち合わせで固まらず聞き直す", async () => {
    const api=await idle();const got=remoteSave();fake.head.mockResolvedValue(got.head);store.setItem(KEY,JSON.stringify({rating:150,games:3}));await api.syncNow();
    fake.upload.mockRejectedValueOnce(new CloudSyncError("conflict"));fake.head.mockResolvedValue({...got.head,rev:3,updateTime:"v3"});
    await api.useLocal();expect(api.status.value).toBe("choose");expect(api.choice.value?.head.updateTime).toBe("v3");
  });
  it("見出しを読むあいだに増えた記録も無視しない", async () => {
    const api=await idle();const got=remoteSave();const pending=deferred<typeof got.head>();fake.head.mockReturnValue(pending.promise);
    const task=api.syncNow();await flush();store.setItem(KEY,JSON.stringify({rating:160,games:4}));pending.resolve(got.head);await task;
    expect(api.status.value).toBe("choose");expect(fake.download).not.toHaveBeenCalled();
  });
  it("画面を離れたあとは古いダウンロードを適用しない", async () => {
    const api=await idle();const got=remoteSave();fake.head.mockResolvedValue(got.head);const pending=deferred<typeof got>();fake.download.mockReturnValue(pending.promise);
    void api.syncNow();await flush();fake.unmounted.forEach(fn=>fn());pending.resolve(got);await flush();
    expect(JSON.parse(store.getItem(KEY)!).rating).toBe(100);expect(window.location.reload).not.toHaveBeenCalled();
  });

  it("削除中に別のアカウントへ変わっても新しいログインを消さない", async () => {
    const api=await idle();const pending=deferred<void>();fake.remove.mockReturnValue(pending.promise);
    const task=api.deleteCloud();await flush();
    const next=newCloudState({uid:"next-user",refreshToken:"next-refresh"});saveCloudState(store,next);
    const event=new Event("storage");Object.assign(event,{key:CLOUD_SYNC_KEY});window.dispatchEvent(event);
    pending.resolve();await task;
    expect(JSON.parse(store.getItem(CLOUD_SYNC_KEY)!).uid).toBe("next-user");expect(window.location.reload).toHaveBeenCalledTimes(1);
  });

});
