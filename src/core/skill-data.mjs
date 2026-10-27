// 棋力テストの答えと対局の結果を、同意を取って匿名で送る(docs/skill-assessment-design.mdの7章)。
// 送り先はこのゲームの公開先のFirebaseプロジェクトのFirestore(REST)。SDKは使わない(最初に読むJSを重くしない)。
// 公式の公開先で開いたときだけ送る。失敗しても遊びは止めない。名前・棋譜・端末の情報は送らない。

export const SKILL_DATA_CONSENT_KEY = 'yacobihime:shogi-match:skill-data-consent:v1';
export const SKILL_DATA_ANON_KEY = 'yacobihime:shogi-match:skill-data-anon:v1';
export const SKILL_DATA_VERSION = 1;
const PROJECT_ID = 'shogi-64125';
export const SKILL_DATA_ENDPOINT = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/skillAnswers`;
/** 送ってよい公開先(公式のFirebase Hosting)。展示用・埋め込み・ローカルの開発では送らない。 */
export const SKILL_DATA_HOSTS = Object.freeze([`${PROJECT_ID}.web.app`, `${PROJECT_ID}.firebaseapp.com`]);
/** 1件に入れるテストの答えの上限(ルールと同じ)。 */
export const MAX_SENT_ANSWERS = 24;

/** 同意の状態。'yes'・'no'・''(まだ聞いていない)。 */
export function loadSkillDataConsent(storage) {
  try {
    const value = storage?.getItem(SKILL_DATA_CONSENT_KEY);
    return value === 'yes' || value === 'no' ? value : '';
  } catch {
    return '';
  }
}

export function saveSkillDataConsent(storage, value) {
  try {
    storage?.setItem(SKILL_DATA_CONSENT_KEY, value === 'yes' ? 'yes' : 'no');
  } catch {
    // 保存できなければ、その場限り。
  }
}

/** 端末ごとのでたらめな番号(名前やメールとは結び付かない)。なければ作る。 */
export function skillDataAnonId(storage, random = Math.random) {
  try {
    const stored = storage?.getItem(SKILL_DATA_ANON_KEY);
    if (stored && /^[a-z0-9]{16,32}$/.test(stored)) return stored;
    const id = Array.from({ length: 20 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(random() * 36)]).join('');
    storage?.setItem(SKILL_DATA_ANON_KEY, id);
    return id;
  } catch {
    return '';
  }
}

/** 送ってよい場所で開いているか(公式の公開先で、展示用ではない)。 */
export function canSendSkillData({ hostname = '', exhibit = false } = {}) {
  return !exhibit && SKILL_DATA_HOSTS.includes(hostname);
}

/** JSの値を、FirestoreのRESTの値の形にする(整数・小数・文字・真偽・配列・入れ子)。 */
export function firestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (typeof value === 'string') return { stringValue: value };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(firestoreValue) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, firestoreValue(entry)])) } };
}

const round = (value, digits = 2) => (Number.isFinite(value) ? Math.round(value * 10 ** digits) / 10 ** digits : null);

/**
 * 棋力テストの1回分。答えは問題のid・種類・正誤・飛ばしたか・考えた時間(ミリ秒)。結果はテストで見たLvと幅。
 * @param {{ anon: string, app?: string, at?: Date, answers: { id: string, type: string, correct: boolean, skipped?: boolean, ms?: number }[], result: { level: number, spread: number }, band?: readonly number[] | null }} input
 */
export function testPayload({ anon, app = '', at = new Date(), answers, result, band = null }) {
  return {
    v: SKILL_DATA_VERSION,
    anon,
    kind: 'test',
    at,
    app: String(app).slice(0, 40),
    test: {
      answers: answers.slice(0, MAX_SENT_ANSWERS).map(({ id, type, correct, skipped = false, ms = 0 }) => ({
        id: String(id).slice(0, 40), type: String(type).slice(0, 12), correct: Boolean(correct), skipped: Boolean(skipped), ms: Math.max(0, Math.min(3600000, Math.round(ms))),
      })),
      level: round(result.level),
      spread: round(result.spread),
      band: band ? [band[0], band[1]] : null,
    },
  };
}

/**
 * 平手のCPUとの対局の1局分。相手のLv・勝ち負け・棋戦・手数と、場面採点の要約(あれば)。
 * @param {{ anon: string, app?: string, at?: Date, opponent: number, outcome: string, event: string, plies: number, content?: { level: number, spread: number } | null }} input
 */
export function gamePayload({ anon, app = '', at = new Date(), opponent, outcome, event, plies, content = null }) {
  return {
    v: SKILL_DATA_VERSION,
    anon,
    kind: 'game',
    at,
    app: String(app).slice(0, 40),
    game: {
      opponent: Math.round(opponent),
      outcome: ['win', 'loss', 'draw'].includes(outcome) ? outcome : 'loss',
      event: String(event).slice(0, 12),
      plies: Math.max(0, Math.min(1000, Math.round(plies))),
      content: content ? { level: round(content.level), spread: round(content.spread) } : null,
    },
  };
}

/**
 * 1件を送る。送れなかったら捨てる(遊びは止めない)。
 * @param {{ payload: object, fetchImpl?: typeof fetch }} input
 * @returns {Promise<boolean>}
 */
export async function sendSkillData({ payload, fetchImpl = globalThis.fetch }) {
  if (typeof fetchImpl !== 'function') return false;
  try {
    const response = await fetchImpl(SKILL_DATA_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: firestoreValue(payload).mapValue.fields }),
      keepalive: true,
    });
    return Boolean(response?.ok);
  } catch {
    return false;
  }
}
