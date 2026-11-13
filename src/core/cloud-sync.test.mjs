import { describe, expect, it } from "vitest";
import {
  CLOUD_SYNC_KEY, CloudSyncError, canUseCloudSync, clearCloudState, cloudEndpoints, decideSync, deleteCloudSave, downloadCloudSave,
  headSummary, headSummaryLines, isFreshSave, loadCloudState, newCloudState, readCloudHead, refreshSession, saveCloudState,
  saveFingerprint, uploadCloudSave,
} from "./cloud-sync.mjs";
import { packText, unpackText } from "./save-cloud.mjs";
import { TRANSFER_SKIP_KEYS } from "./save-transfer.mjs";

const Y = "yacobihime:shogi-match:";

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    get length() { return map.size; },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
    map,
  };
}

/**
 * Firestoreとログインの印の更新のまね。ルールと同じく、本人の印でだけ読み書きでき、
 * まとめ書きの条件(updateTime・exists)を守らない書き込みは全部断る。
 */
function fakeCloud({ uid = "user-1", refresh = "refresh-1" } = {}) {
  const docs = new Map();
  let clock = Date.parse("2026-11-13T00:00:00Z");
  let commits = 0;
  const endpoints = cloudEndpoints(null);
  const reply = (status, body = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
  const fetchImpl = async (url, init = {}) => {
    const method = init.method ?? "GET";
    if (url.startsWith(endpoints.token.split("?")[0])) {
      const token = new URLSearchParams(init.body).get("refresh_token");
      if (token !== refresh) return reply(400, { error: { message: "INVALID_REFRESH_TOKEN" } });
      return reply(200, { id_token: `id:${uid}`, refresh_token: refresh, expires_in: "3600", user_id: uid });
    }
    const auth = init.headers?.Authorization ?? "";
    if (auth !== `Bearer id:${uid}`) return reply(401);
    if (url === endpoints.commit) {
      const { writes } = JSON.parse(init.body);
      // まず条件を全部確かめ、通ったら全部書く(まとめ書き)。
      for (const write of writes) {
        const name = write.update?.name ?? write.delete;
        if (!name.includes(`/cloudSaves/${uid}`)) return reply(403);
        const current = docs.get(name);
        if (write.currentDocument?.exists === false && current) return reply(409, { error: { status: "ALREADY_EXISTS" } });
        if (write.currentDocument?.updateTime && current?.updateTime !== write.currentDocument.updateTime) {
          return reply(current ? 400 : 404, { error: { status: current ? "FAILED_PRECONDITION" : "NOT_FOUND" } });
        }
      }
      commits += 1;
      clock += 1000;
      const updateTime = new Date(clock).toISOString();
      for (const write of writes) {
        if (write.delete) docs.delete(write.delete);
        else docs.set(write.update.name, { name: write.update.name, fields: write.update.fields, updateTime });
      }
      return reply(200, { writeResults: writes.map(() => ({ updateTime })), commitTime: updateTime });
    }
    const name = url.slice(url.indexOf("projects/"));
    if (!name.includes(`/cloudSaves/${uid}`)) return reply(403);
    const doc = docs.get(name);
    return doc ? reply(200, doc) : reply(404);
  };
  return { docs, fetchImpl, get commits() { return commits; } };
}

function account(overrides = {}) {
  return { ...newCloudState({ uid: "user-1", email: "a@example.com", name: "やこび", refreshToken: "refresh-1" }), ...overrides };
}

describe("同期の決め方", () => {
  const head = { rev: 3, updateTime: "t3", at: 0, device: "x", parts: 1, size: 10, summary: "", hash: "cloud" };
  const base = { rev: 3, updateTime: "t3", hash: "local-base", at: 0 };

  it("クラウドがまだないとき、記録があれば送り、なければ何もしない", () => {
    expect(decideSync({ head: null, base: null, localHash: "h", localFresh: false })).toBe("push");
    expect(decideSync({ head: null, base: null, localHash: "h", localFresh: true })).toBe("none");
  });

  it("前に合わせたのにクラウドがないときは、ほかの端末で消されたのでログアウトする(作り直さない)", () => {
    expect(decideSync({ head: null, base, localHash: "h", localFresh: false })).toBe("gone");
  });

  it("前に合わせた時点のままなら、この端末が変わったときだけ送る", () => {
    expect(decideSync({ head, base, localHash: "local-base", localFresh: false })).toBe("none");
    expect(decideSync({ head, base, localHash: "changed", localFresh: false })).toBe("push");
  });

  it("ほかの端末が進めたとき、この端末が変わっていなければ受け取り、変わっていれば聞く", () => {
    const newer = { ...head, rev: 4, updateTime: "t4" };
    expect(decideSync({ head: newer, base, localHash: "local-base", localFresh: false })).toBe("pull");
    expect(decideSync({ head: newer, base, localHash: "changed", localFresh: false })).toBe("choose");
  });

  it("この端末で初めてログインしたとき、記録がなければ受け取り、あれば聞く", () => {
    expect(decideSync({ head, base: null, localHash: "h", localFresh: true })).toBe("pull");
    expect(decideSync({ head, base: null, localHash: "h", localFresh: false })).toBe("choose");
  });

  it("中身が同じなら、聞かずに時点だけ合わせる", () => {
    expect(decideSync({ head, base: null, localHash: "cloud", localFresh: false })).toBe("adopt");
    expect(decideSync({ head: { ...head, updateTime: "t9" }, base, localHash: "cloud", localFresh: false })).toBe("adopt");
    expect(decideSync({ head, base: { ...base, hash: "cloud" }, localHash: "cloud", localFresh: false })).toBe("none");
  });
});

describe("指紋と、記録があるか", () => {
  it("指紋は鍵の並びによらず、中身が変われば変わる", () => {
    const a = saveFingerprint({ [`${Y}x`]: "1", [`${Y}y`]: "2" });
    const b = saveFingerprint({ [`${Y}y`]: "2", [`${Y}x`]: "1" });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(saveFingerprint({ [`${Y}x`]: "1", [`${Y}y`]: "3" })).not.toBe(a);
    expect(saveFingerprint({ [`${Y}x1`]: "", [`${Y}y`]: "2" })).not.toBe(saveFingerprint({ [`${Y}x`]: "1", [`${Y}y`]: "2" }));
  });

  it("名前と設定だけなら記録がないと数え、大会・レーティング・中断した対局があれば記録がある", () => {
    expect(isFreshSave({ [`${Y}player-name:v1`]: "{}", [`${Y}sound`]: "on" })).toBe(true);
    expect(isFreshSave({ [`${Y}ryuo-career`]: "{}" })).toBe(false);
    expect(isFreshSave({ [`${Y}player-rating`]: "{}" })).toBe(false);
    expect(isFreshSave({ [`${Y}%2Fgame.html`]: "{}" })).toBe(false);
  });
});

describe("この端末の印", () => {
  it("書いて読め、ログアウトで消え、壊れた印は読まない", () => {
    const storage = memoryStorage();
    const state = account();
    saveCloudState(storage, state);
    expect(loadCloudState(storage)).toMatchObject({ uid: "user-1", email: "a@example.com", base: null, device: state.device });
    clearCloudState(storage);
    expect(loadCloudState(storage)).toBeNull();
    storage.setItem(CLOUD_SYNC_KEY, "{broken");
    expect(loadCloudState(storage)).toBeNull();
    storage.setItem(CLOUD_SYNC_KEY, JSON.stringify({ uid: "u" }));
    expect(loadCloudState(storage)).toBeNull();
  });

  it("印と引き継ぎコードの覚えは、引き継ぎで運ばない", () => {
    expect(TRANSFER_SKIP_KEYS).toContain(CLOUD_SYNC_KEY);
    expect(TRANSFER_SKIP_KEYS).toContain(`${Y}transfer-codes:v1`);
  });

  it("使えるのは公式の公開先(https)と、エミュレーターの印があるときの127.0.0.1だけ", () => {
    expect(canUseCloudSync({ hostname: "shogi-64125.web.app" })).toBe(true);
    expect(canUseCloudSync({ hostname: "shogi-64125.web.app", secure: false })).toBe(false);
    expect(canUseCloudSync({ hostname: "example.com" })).toBe(false);
    expect(canUseCloudSync({ hostname: "127.0.0.1" })).toBe(false);
    expect(canUseCloudSync({ hostname: "127.0.0.1", emulator: true })).toBe(true);
    expect(cloudEndpoints(account({ emulator: { auth: "http://127.0.0.1:9099", firestore: "http://127.0.0.1:8080" } })).commit)
      .toBe("http://127.0.0.1:8080/v1/projects/shogi-64125/databases/(default)/documents:commit");
  });
});

describe("クラウドとのやりとり", () => {
  it("印を作り直し、無効な印ならログアウトの理由で断る", async () => {
    const cloud = fakeCloud();
    const session = await refreshSession(account(), { fetchImpl: cloud.fetchImpl, now: 0 });
    expect(session.idToken).toBe("id:user-1");
    expect(session.expiresAt).toBeGreaterThan(3_000_000);
    await expect(refreshSession(account({ refreshToken: "old" }), { fetchImpl: cloud.fetchImpl })).rejects.toMatchObject({ reason: "signed-out" });
    await expect(refreshSession(account(), { fetchImpl: async () => { throw new Error("net"); } })).rejects.toMatchObject({ reason: "offline" });
  });

  it("送ると見出しと分けた文書ができ、受け取ると同じ文字に戻る", async () => {
    const cloud = fakeCloud();
    const state = account();
    const session = await refreshSession(state, { fetchImpl: cloud.fetchImpl });
    expect(await readCloudHead(state, session, { fetchImpl: cloud.fetchImpl })).toBeNull();
    const text = JSON.stringify({ entries: { a: "歩".repeat(5000) } });
    const summary = headSummary({ name: "やこび", rating: 1500, games: 12, ryuoSeasons: 2 });
    const saved = await uploadCloudSave(state, session, { text, hash: "h1", summary, expect: null, now: 1000 }, { fetchImpl: cloud.fetchImpl });
    expect(saved).toMatchObject({ rev: 1, hash: "h1", parts: 1 });
    const head = await readCloudHead(state, session, { fetchImpl: cloud.fetchImpl });
    expect(head).toMatchObject({ rev: 1, updateTime: saved.updateTime, parts: 1, hash: "h1", device: state.device });
    expect(headSummaryLines(head)).toEqual(expect.arrayContaining(["名前：やこび", "レーティング：R1500（12局）", "竜王戦：2期"]));
    expect((await downloadCloudSave(state, session, head, { fetchImpl: cloud.fetchImpl })).text).toBe(text);
  });

  it("ほかの端末が先に書いていたら、上書きせずに conflict", async () => {
    const cloud = fakeCloud();
    const phone = account();
    const pc = account();
    const session = await refreshSession(phone, { fetchImpl: cloud.fetchImpl });
    const first = await uploadCloudSave(phone, session, { text: "a", hash: "a", summary: "{}", expect: null }, { fetchImpl: cloud.fetchImpl });
    const read = await readCloudHead(phone, session, { fetchImpl: cloud.fetchImpl });
    expect(read.updateTime).toBe(first.updateTime);
    // PCが先に書く。
    await uploadCloudSave(pc, session, { text: "b", hash: "b", summary: "{}", expect: read }, { fetchImpl: cloud.fetchImpl });
    // スマホは前の版のつもりで書こうとして断られる。
    const error = await uploadCloudSave(phone, session, { text: "c", hash: "c", summary: "{}", expect: read }, { fetchImpl: cloud.fetchImpl }).catch((cause) => cause);
    expect(error).toBeInstanceOf(CloudSyncError);
    expect(error.reason).toBe("conflict");
    // まだないつもりで書いても断られる。
    const again = await uploadCloudSave(phone, session, { text: "d", hash: "d", summary: "{}", expect: null }, { fetchImpl: cloud.fetchImpl }).catch((cause) => cause);
    expect(again.reason).toBe("conflict");
    const head = await readCloudHead(phone, session, { fetchImpl: cloud.fetchImpl });
    expect(head).toMatchObject({ hash: "b", rev: 2, device: pc.device });
    expect(cloud.commits).toBe(2);
  });

  it("大きな記録は分けて置き、小さくなったら余った文書を消す", async () => {
    const cloud = fakeCloud();
    const state = account();
    const session = await refreshSession(state, { fetchImpl: cloud.fetchImpl });
    // 縮みにくい文字(乱数)で2件以上に分かれる大きさにする。
    let big = "";
    let seed = 7;
    while (big.length < 1_200_000) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      big += seed.toString(36);
    }
    const one = await uploadCloudSave(state, session, { text: big, hash: "big", summary: "{}", expect: null }, { fetchImpl: cloud.fetchImpl });
    expect(one.parts).toBeGreaterThan(1);
    const head = await readCloudHead(state, session, { fetchImpl: cloud.fetchImpl });
    expect((await downloadCloudSave(state, session, head, { fetchImpl: cloud.fetchImpl })).text).toBe(big);
    await uploadCloudSave(state, session, { text: "small", hash: "small", summary: "{}", expect: head }, { fetchImpl: cloud.fetchImpl });
    const parts = [...cloud.docs.keys()].filter((name) => name.includes("/parts/"));
    expect(parts).toHaveLength(1);
  });

  it("ほかの人の印では読めず、消すと見出しも分けた文書もなくなる", async () => {
    const cloud = fakeCloud();
    const state = account();
    const session = await refreshSession(state, { fetchImpl: cloud.fetchImpl });
    await uploadCloudSave(state, session, { text: "x", hash: "x", summary: "{}", expect: null }, { fetchImpl: cloud.fetchImpl });
    await expect(readCloudHead(state, { idToken: "id:someone", expiresAt: 0 }, { fetchImpl: cloud.fetchImpl })).rejects.toMatchObject({ reason: "signed-out" });
    await deleteCloudSave(state, session, { fetchImpl: cloud.fetchImpl });
    expect(cloud.docs.size).toBe(0);
    expect(await readCloudHead(state, session, { fetchImpl: cloud.fetchImpl })).toBeNull();
  });

  it("縮めた文字は元に戻る", async () => {
    const text = "竜王".repeat(2000);
    const packed = await packText(text);
    expect(packed[0]).toBe("g");
    expect(packed.length).toBeLessThan(text.length);
    expect(await unpackText(packed)).toBe(text);
    expect(await unpackText("pそのまま")).toBe("そのまま");
  });
});
