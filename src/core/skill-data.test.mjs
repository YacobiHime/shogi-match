import { describe, expect, it } from 'vitest';
import {
  MAX_SENT_ANSWERS, SKILL_DATA_ENDPOINT, canSendSkillData, firestoreValue, gamePayload, loadSkillDataConsent, saveSkillDataConsent,
  sendSkillData, skillDataAnonId, testPayload,
} from './skill-data.mjs';

const memoryStorage = () => {
  const map = new Map();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)) };
};

describe('匿名の答えの送信', () => {
  it('送るのは、公式の公開先で開いたときだけ(展示用・埋め込み・ローカルでは送らない)', () => {
    expect(canSendSkillData({ hostname: 'shogi-64125.web.app' })).toBe(true);
    expect(canSendSkillData({ hostname: 'shogi-64125.firebaseapp.com' })).toBe(true);
    expect(canSendSkillData({ hostname: 'shogi-64125.web.app', exhibit: true })).toBe(false);
    expect(canSendSkillData({ hostname: '127.0.0.1' })).toBe(false);
    expect(canSendSkillData({ hostname: 'example.com' })).toBe(false);
  });

  it('同意はまだ聞いていない・送る・送らないの3つ。番号は1回作って使い続ける', () => {
    const storage = memoryStorage();
    expect(loadSkillDataConsent(storage)).toBe('');
    saveSkillDataConsent(storage, 'yes');
    expect(loadSkillDataConsent(storage)).toBe('yes');
    saveSkillDataConsent(storage, 'whatever');
    expect(loadSkillDataConsent(storage)).toBe('no');
    const id = skillDataAnonId(storage);
    expect(id).toMatch(/^[a-z0-9]{20}$/);
    expect(skillDataAnonId(storage)).toBe(id);
  });

  it('名前や棋譜は入れず、答えの上限・文字の長さを守る', () => {
    const answers = Array.from({ length: 30 }, (_, index) => ({ id: `st-take-${index}`, type: 'take', correct: index % 2 === 0, ms: 12345.6 }));
    const payload = testPayload({ anon: 'a'.repeat(20), app: 'x'.repeat(60), at: new Date(0), answers, result: { level: 20.123, spread: 3.456 }, band: [16, 24] });
    expect(payload.test.answers).toHaveLength(MAX_SENT_ANSWERS);
    expect(payload.test.answers[0]).toEqual({ id: 'st-take-0', type: 'take', correct: true, skipped: false, ms: 12346 });
    expect(payload).toMatchObject({ v: 1, kind: 'test', app: 'x'.repeat(40), test: { level: 20.12, spread: 3.46, band: [16, 24] } });
    expect(JSON.stringify(payload)).not.toMatch(/name|sfen|moves/);
    const game = gamePayload({ anon: 'b'.repeat(20), at: new Date(0), opponent: 20.4, outcome: 'win', event: 'ryuo', plies: 98, content: { level: 18.333, spread: 4 } });
    expect(game.game).toEqual({ opponent: 20, outcome: 'win', event: 'ryuo', plies: 98, content: { level: 18.33, spread: 4 } });
  });

  it('FirestoreのRESTの形にして送り、失敗しても止まらない', async () => {
    expect(firestoreValue({ a: 1, b: 1.5, c: 'x', d: true, e: [1], f: null, g: new Date(0) })).toEqual({
      mapValue: { fields: {
        a: { integerValue: '1' }, b: { doubleValue: 1.5 }, c: { stringValue: 'x' }, d: { booleanValue: true },
        e: { arrayValue: { values: [{ integerValue: '1' }] } }, f: { nullValue: null }, g: { timestampValue: '1970-01-01T00:00:00.000Z' },
      } },
    });
    const calls = [];
    const ok = await sendSkillData({ payload: { v: 1 }, fetchImpl: async (url, init) => { calls.push([url, init]); return { ok: true }; } });
    expect(ok).toBe(true);
    expect(calls[0][0]).toBe(SKILL_DATA_ENDPOINT);
    expect(JSON.parse(calls[0][1].body)).toEqual({ fields: { v: { integerValue: '1' } } });
    expect(await sendSkillData({ payload: { v: 1 }, fetchImpl: async () => { throw new Error('offline'); } })).toBe(false);
  });
});
