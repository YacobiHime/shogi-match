import { describe, expect, it } from "vitest";
import {
  CODE_ALPHABET, CODE_LENGTH, MAX_PARTS, PART_CHARS, SAVE_CLOUD_ENDPOINT, SaveCloudError, canUseSaveCloud, deleteSave, downloadSave,
  formatTransferCode, newTransferCode, normalizeTransferCode, openSaveText, sealSaveText, splitParts, transferDocId, uploadSave,
} from "./save-cloud.mjs";

/** Firestoreのまね。期限はルールと同じく、読むときに断る。 */
function fakeFirestore(now = () => Date.now()) {
  const docs = new Map();
  const fetchImpl = async (url, init = {}) => {
    const method = init.method ?? "GET";
    const reply = (status, body = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
    if (method === "POST") {
      const id = new URL(url).searchParams.get("documentId");
      if (!/^[0-9a-f]{40}(-[1-5])?$/.test(id) || docs.has(id)) return reply(403);
      const body = JSON.parse(init.body);
      if (body.fields.data.stringValue.length > 700000) return reply(403);
      docs.set(id, body);
      return reply(200, body);
    }
    const id = url.slice(SAVE_CLOUD_ENDPOINT.length + 1);
    if (method === "DELETE") {
      docs.delete(id);
      return reply(200);
    }
    const doc = docs.get(id);
    if (!doc) return reply(404);
    if (Date.parse(doc.fields.expireAt.timestampValue) <= now()) return reply(403);
    return reply(200, doc);
  };
  return { docs, fetchImpl };
}

describe("引き継ぎコード", () => {
  it("コードは見まちがえやすい字を使わない12文字で、入れた文字を整えて読む", () => {
    const code = newTransferCode();
    expect(code).toHaveLength(CODE_LENGTH);
    expect([...code].every((char) => CODE_ALPHABET.includes(char))).toBe(true);
    expect(CODE_ALPHABET).not.toMatch(/[01OIL]/);
    expect(formatTransferCode("ABCDEFGHJKMN")).toBe("ABCD-EFGH-JKMN");
    expect(normalizeTransferCode(" abcd-efgh-jkmn ")).toBe("ABCDEFGHJKMN");
    expect(normalizeTransferCode("ＡＢＣＤーＥＦＧＨーＪＫＭＮ")).toBe("ABCDEFGHJKMN");
    expect(normalizeTransferCode("ABCD-EFGH-JKM0")).toBe("");
    expect(normalizeTransferCode("ABCD")).toBe("");
  });

  it("使えるのは公式の公開先だけ", () => {
    expect(canUseSaveCloud({ hostname: "shogi-64125.web.app" })).toBe(true);
    expect(canUseSaveCloud({ hostname: "localhost" })).toBe(false);
    expect(canUseSaveCloud({ hostname: "shogi-64125.web.app", secure: false })).toBe(false);
  });

  it("暗号にした文字は、同じコードでだけ戻せる", async () => {
    const text = JSON.stringify({ name: "やこび", body: "歩".repeat(3000) });
    const sealed = await sealSaveText(text, "ABCDEFGHJKMN");
    expect(sealed).not.toContain("やこび");
    expect(sealed.length).toBeLessThan(text.length);
    expect(await openSaveText(sealed, "ABCDEFGHJKMN")).toBe(text);
    await expect(openSaveText(sealed, "ABCDEFGHJKMP")).rejects.toThrow();
  });

  it("預けて受け取り、受け取ったら消せる。文書の名前はコードから作り、中身に名前は出ない", async () => {
    const store = fakeFirestore();
    const text = JSON.stringify({ entries: { a: "やこび" } });
    const { code, parts } = await uploadSave(text, { fetchImpl: store.fetchImpl, now: Date.now() });
    expect(parts).toBe(1);
    expect([...store.docs.keys()]).toEqual([await transferDocId(code)]);
    expect(JSON.stringify([...store.docs.values()])).not.toContain("やこび");
    expect(await downloadSave(code, { fetchImpl: store.fetchImpl })).toEqual({ text, parts: 1 });
    await deleteSave(code, { fetchImpl: store.fetchImpl, parts: 1 });
    await expect(downloadSave(code, { fetchImpl: store.fetchImpl })).rejects.toMatchObject({ reason: "not-found" });
  });

  it("大きな記録は分けて置き、1番から先に置く", async () => {
    const store = fakeFirestore();
    // 縮まない中身(乱数)で、2件以上に分かれる大きさにする。
    const noise = Array.from({ length: PART_CHARS }, () => String.fromCharCode(33 + Math.floor(Math.random() * 90))).join("");
    const { code, parts } = await uploadSave(noise, { fetchImpl: store.fetchImpl });
    expect(parts).toBeGreaterThan(1);
    const ids = [...store.docs.keys()];
    expect(ids.at(-1)).toBe(await transferDocId(code));
    expect((await downloadSave(code, { fetchImpl: store.fetchImpl })).text).toBe(noise);
  });

  it("分ける数が上限を超える記録は預けない", async () => {
    const store = fakeFirestore();
    const noise = Array.from({ length: PART_CHARS * MAX_PARTS }, () => String.fromCharCode(33 + Math.floor(Math.random() * 90))).join("");
    await expect(uploadSave(noise, { fetchImpl: store.fetchImpl })).rejects.toMatchObject({ reason: "too-large" });
    expect(store.docs.size).toBe(0);
  });

  it("期限を過ぎたら受け取れない・通信できないときは offline", async () => {
    let clock = Date.now();
    const store = fakeFirestore(() => clock);
    const { code } = await uploadSave("{}", { fetchImpl: store.fetchImpl, now: clock });
    clock += 8 * 24 * 60 * 60 * 1000;
    await expect(downloadSave(code, { fetchImpl: store.fetchImpl, now: clock })).rejects.toMatchObject({ reason: "not-found" });
    const offline = async () => { throw new TypeError("network"); };
    await expect(uploadSave("{}", { fetchImpl: offline })).rejects.toBeInstanceOf(SaveCloudError);
    await expect(downloadSave(code, { fetchImpl: offline })).rejects.toMatchObject({ reason: "offline" });
  });

  it("文字を決まった長さで分ける", () => {
    expect(splitParts("abcdefg", 3)).toEqual(["abc", "def", "g"]);
    expect(splitParts("", 3)).toEqual([""]);
  });
});
