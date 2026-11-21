// 師匠の1年(docs/disciple-mode-design.md)の、お守り(10章の3)と問題の場面(12-2の前半)。26章。
// 画面と保存に依存しない。場面はノベルの台本(src/story/scenes/disciple-*.md)で見せ、選んだ答えの効き目をここで決める。
// 場面は予定を止めない(画面が上に重ねて出し、答えたら`resolveScene`)。同じ場面ばかりにならないよう、起きる条件と回数を決める。

import { APTITUDE_STEPS, STAT_KEYS, addGains, raiseAptitude, skillById } from './disciple-strength.mjs';

const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));

// ---- お守り(10章の3)

/** お守り。大一番に1つ持たせると、その日の対局だけ効く(使うとなくなる)。 */
export const CHARMS = Object.freeze([
  Object.freeze({ id: 'kachi', name: '勝守', text: 'やる気を1段上げて臨む', mood: 1 }),
  Object.freeze({ id: 'sensu', name: '扇子', text: '落ち着いて指す（安定＋80）', stats: Object.freeze({ steady: 80 }) }),
  Object.freeze({ id: 'techo', name: '詰将棋の手帳', text: '終盤がよく見える（詰み＋80）', stats: Object.freeze({ mate: 80 }) }),
  Object.freeze({ id: 'tokei', name: '懐中時計', text: '早指しの適性が1段上がる', aptitude: 'fast' }),
]);
export const charmById = (id) => CHARMS.find((charm) => charm.id === id) ?? null;
/** 同じお守りを持てる数。 */
export const CHARM_MAX = 3;
/** 出かけた先でお守りをもらえる割合。 */
export const OUTING_CHARM_CHANCE = 0.25;
/** 仲間との絆でもらえるお守り(1回ずつ)。 */
export const CHARM_GIFTS = Object.freeze([
  Object.freeze({ friend: 'momoka', bond: 3, charm: 'sensu', text: '百花が扇子をくれた' }),
  Object.freeze({ friend: 'hayase', bond: 3, charm: 'tokei', text: '早瀬が懐中時計を貸してくれた' }),
  Object.freeze({ friend: 'makabe', bond: 3, charm: 'techo', text: '真壁が詰将棋の手帳をくれた' }),
]);

/**
 * お守りを1つ足す(持てる数まで)。足せたらtrue。
 * @param {any} state 書き換えてよい写し
 * @param {string} id
 */
export function addCharm(state, id) {
  if (!charmById(id)) return false;
  state.charms ??= {};
  if ((state.charms[id] ?? 0) >= CHARM_MAX) return false;
  state.charms[id] = (state.charms[id] ?? 0) + 1;
  return true;
}

/** 持っているお守り(画面の一覧)。 */
export const charmList = (state) => CHARMS.filter((charm) => (state.charms?.[charm.id] ?? 0) > 0).map((charm) => ({ ...charm, count: state.charms[charm.id] }));

/**
 * お守りを持たせた弟子(その日の強さを決めるための写し。もとの状態は変えない)。持っていなければそのまま。
 * @param {any} state
 * @param {string | null | undefined} id
 */
export function withCharm(state, id) {
  const charm = charmById(id ?? '');
  if (!charm || (state.charms?.[charm.id] ?? 0) <= 0) return state;
  const next = { ...state, stats: { ...state.stats }, aptitudes: { ...state.aptitudes } };
  if (charm.mood) next.mood = clamp(next.mood + charm.mood, -2, 2);
  if (charm.stats) next.stats = addGains(next.stats, charm.stats);
  if (charm.aptitude && next.aptitudes[charm.aptitude]) next.aptitudes[charm.aptitude] = raiseAptitude(next.aptitudes[charm.aptitude], APTITUDE_STEPS - (Number(next.aptitudes[charm.aptitude].meter) || 0));
  return next;
}

/**
 * お守りを使う(1つ減らす)。使えたらtrue。
 * @param {any} state 書き換えてよい写し
 * @param {string | null | undefined} id
 */
export function useCharm(state, id) {
  if (!id || (state.charms?.[id] ?? 0) <= 0) return false;
  state.charms[id] -= 1;
  if (state.charms[id] <= 0) delete state.charms[id];
  return true;
}

/**
 * 出かけた先と仲間の絆で、お守りを受け取る(状態に書き足し、受け取ったお守りのidを返す)。
 * @param {any} state 書き換えてよい写し
 * @param {{ outing?: boolean, rng?: { next(): number } }} [options]
 */
export function receiveCharms(state, { outing = false, rng } = {}) {
  const got = [];
  state.charmGifts ??= [];
  for (const gift of CHARM_GIFTS) {
    if (state.charmGifts.includes(gift.charm) || (state.bonds?.[gift.friend] ?? 0) < gift.bond) continue;
    state.charmGifts.push(gift.charm);
    if (addCharm(state, gift.charm)) {
      got.push(gift.charm);
      state.log.push({ turn: state.turn, text: `${gift.text}（お守り）` });
    }
  }
  if (outing && rng && rng.next() < OUTING_CHARM_CHANCE) {
    const charm = CHARMS[Math.floor(rng.next() * CHARMS.length)];
    if (addCharm(state, charm.id)) {
      got.push(charm.id);
      state.log.push({ turn: state.turn, text: `出かけた先で「${charm.name}」を見つけた（お守り）` });
    }
  }
  return got;
}

// ---- 問題の場面(12-2の前半)

/**
 * 場面の目録。scriptは台本のid(弟子ごとに違う場面は{disciple}を弟子のidにする)。variantsは、見た回数で替える台本(同じ場面を何度も流さない。docs/pro-year-design.mdの31章の考え方)。
 * effectsは答え(台本の{値})ごとの効き目。fitsは、その答えがよく効く弟子(やる気がもう1段上がる。2作の育成の「その子だけの出来事」)。
 * 効き目の欄: mood・stamina・stats・bonds・aim(いちばん低い能力の稽古の狙い目の倍率)・charm。
 */
export const DISCIPLE_SCENES = Object.freeze({
  intro: Object.freeze({
    label: '入門', script: 'disciple-intro-{disciple}',
    effects: Object.freeze({
      promise: { mood: 1, text: '学校のことも見ると約束した' },
      honest: { stats: { steady: 20 }, text: '厳しい世界だと正直に話した' },
      child: { mood: 1, text: '本人の気持ちを聞いた' },
    }),
    fits: Object.freeze({ promise: ['ao'], honest: ['tsumugi'], child: ['minato'] }),
  }),
  school: Object.freeze({
    label: '学校の試験', script: 'disciple-school', variants: Object.freeze(['disciple-school', 'disciple-school-2', 'disciple-school-3']),
    effects: Object.freeze({
      study: { stamina: 30, text: '試験の勉強に集中させた' },
      shogi: { stats: { reading: 14 }, mood: -1, text: '将棋の稽古を続けた' },
      momoka: { bonds: { momoka: 2 }, stamina: 10, text: '百花に勉強を見てもらった' },
    }),
    fits: Object.freeze({ study: ['tsumugi'], shogi: ['ao'], momoka: ['minato'] }),
  }),
  family: Object.freeze({
    label: '家族の心配', script: 'disciple-family',
    effects: Object.freeze({
      visit: { mood: 1, text: '家族に会って話した' },
      results: { stats: { reading: 10, steady: 10 }, mood: -1, text: '結果で示そうと話した' },
      pause: { stamina: 40, text: '少し将棋を休ませた' },
    }),
    fits: Object.freeze({ visit: ['minato'], results: ['ao'], pause: ['tsumugi'] }),
  }),
  slump: Object.freeze({
    label: 'スランプ', script: 'disciple-slump',
    effects: Object.freeze({
      outing: { mood: 2, stamina: 20, text: '盤を離れて出かけた' },
      together: { aim: 1.5, text: '負けた将棋を一緒に並べた' },
      wait: { mood: 1, text: '何も言わずに待った' },
    }),
    fits: Object.freeze({ outing: ['minato'], together: ['tsumugi'], wait: ['ao'] }),
  }),
  promote: Object.freeze({
    label: 'はじめての昇級', script: 'disciple-promote',
    effects: Object.freeze({
      celebrate: { mood: 1, stamina: 10, text: 'お祝いをした' },
      next: { aim: 1.25, text: '次の目標を話した' },
      charm: { charm: 'kachi', text: '勝守を渡した' },
    }),
    fits: Object.freeze({ celebrate: ['minato'], next: ['tsumugi'], charm: ['ao'] }),
  }),
  // 奨励会の節目(28章)。四段と退会は答えのない場面(育成の終わり)。
  shoreikai: Object.freeze({
    label: '奨励会へ', script: 'disciple-shoreikai',
    effects: Object.freeze({
      serious: { stats: { steady: 15 }, text: '気を引き締めるよう話した' },
      enjoy: { mood: 1, text: '楽しもうと話した' },
      peers: { bonds: { hayase: 1, makabe: 1 }, text: '同期と仲良くするよう話した' },
    }),
    fits: Object.freeze({ serious: ['tsumugi'], enjoy: ['minato'], peers: ['ao'] }),
  }),
  shodan: Object.freeze({
    label: '初段の日', script: 'disciple-shodan',
    effects: Object.freeze({
      celebrate: { mood: 1, stamina: 10, text: 'お祝いをした' },
      next: { aim: 1.25, text: '三段リーグまでの目標を決めた' },
      charm: { charm: 'kachi', text: '勝守を渡した' },
    }),
    fits: Object.freeze({ celebrate: ['minato'], next: ['tsumugi'], charm: ['ao'] }),
  }),
  sandan: Object.freeze({
    label: '三段リーグ', script: 'disciple-sandan',
    effects: Object.freeze({
      calm: { mood: 1, stamina: 10, text: '一期ずつでいいと話した' },
      push: { stats: { reading: 15 }, mood: -1, text: '一期で抜けようと話した' },
      study: { aim: 1.5, text: 'リーグの相手の棋譜を一緒に調べた' },
    }),
    fits: Object.freeze({ calm: ['minato'], push: ['ao'], study: ['tsumugi'] }),
  }),
  pro: Object.freeze({ label: '四段昇段', script: 'disciple-pro', effects: Object.freeze({}), fits: Object.freeze({}) }),
  retired: Object.freeze({ label: '退会の日', script: 'disciple-retired', effects: Object.freeze({}), fits: Object.freeze({}) }),
});

/** 学校の試験の場面が起きる時期(期末の試験の前。1年に1回)。 */
export const SCHOOL_SCENE = Object.freeze({ month: 7, half: '前半' });
/** 家族の心配: 1局も勝てない日が続いた回数と、場面の回数の上限と間。 */
export const FAMILY_SCENE = Object.freeze({ zeroDays: 2, max: 2, gap: 12 });
/** スランプ: 大一番で続けて負けた回数と、場面の回数の上限と間。乗り越えると安定が伸び、不屈を覚える。 */
export const SLUMP_SCENE = Object.freeze({ losses: 2, max: 2, gap: 12, overcome: Object.freeze({ steady: 30 }) });

/** その場面をこれまでに見た回数と、最後に見たターン。 */
const seenOf = (state, key) => state.scenesSeen?.[key] ?? { count: 0, turn: -Infinity };

/**
 * 場面を積む(同じ場面はまだ見ていなければ1つだけ積む)。
 * @param {any} state 書き換えてよい写し
 * @param {string} key
 */
export function queueScene(state, key) {
  if (!DISCIPLE_SCENES[key]) return false;
  state.sceneQueue ??= [];
  if (state.sceneQueue.includes(key)) return false;
  state.sceneQueue.push(key);
  return true;
}

/**
 * ターンの終わりと、例会・試験のあとに、起きる場面を積む。
 * @param {any} state 書き換えてよい写し
 * @param {{ calendar?: { year: number, month: number, half: string }, event?: { big: boolean, wins: number, losses: number, promoted: boolean } | null }} context
 */
export function checkScenes(state, { calendar, event = null } = {}) {
  if (state.end) return;
  // 学校の試験・家族の心配・スランプは、研修会のあいだと奨励会のあいだで同じ。
  if (calendar && calendar.month === SCHOOL_SCENE.month && calendar.half === SCHOOL_SCENE.half) {
    state.schoolYears ??= [];
    if (!state.schoolYears.includes(calendar.year)) {
      state.schoolYears.push(calendar.year);
      queueScene(state, 'school');
    }
  }
  if (!event) return;
  // 1回の例会・試験で積む場面は1つまで(はじめての昇級＞スランプ＞家族の心配。続けて場面ばかりにしない。12-2)。
  const due = [];
  state.zeroDays = event.wins === 0 ? (state.zeroDays ?? 0) + 1 : 0;
  if (event.big) state.bigLosses = event.wins < event.losses ? (state.bigLosses ?? 0) + 1 : 0;
  if (event.promoted && seenOf(state, 'promote').count === 0) due.push('promote');
  const slump = seenOf(state, 'slump');
  if (event.big && state.bigLosses >= SLUMP_SCENE.losses && slump.count < SLUMP_SCENE.max && state.turn - slump.turn >= SLUMP_SCENE.gap) due.push('slump');
  const family = seenOf(state, 'family');
  if (state.zeroDays >= FAMILY_SCENE.zeroDays && family.count < FAMILY_SCENE.max && state.turn - family.turn >= FAMILY_SCENE.gap) due.push('family');
  const key = due[0];
  if (!key) return;
  if (key === 'slump') {
    state.bigLosses = 0;
    state.slump = true;
  }
  if (key === 'family') state.zeroDays = 0;
  queueScene(state, key);
}

/**
 * スランプのあとの大一番で勝ったら乗り越えた(安定が伸び、不屈を覚える)。乗り越えたらtrue。
 * @param {any} state 書き換えてよい写し
 * @param {{ big: boolean, wins: number, losses: number }} event
 * @param {number} maxSkills
 */
export function overcomeSlump(state, event, maxSkills) {
  if (!state.slump || !event.big || event.wins <= event.losses) return false;
  state.slump = false;
  state.stats = addGains(state.stats, SLUMP_SCENE.overcome);
  if (!state.skills.includes('unbroken') && state.skills.length < maxSkills) state.skills.push('unbroken');
  state.log.push({ turn: state.turn, text: `スランプを乗り越えた（安定＋${SLUMP_SCENE.overcome.steady}${state.skills.includes('unbroken') ? `・スキル「${skillById('unbroken')?.name}」` : ''}）` });
  return true;
}

/**
 * いま見せる場面(なければnull)。台本のidと差し込み。
 * @param {any} state
 */
export function pendingScene(state) {
  const key = state.sceneQueue?.[0];
  const def = key ? DISCIPLE_SCENES[key] : null;
  if (!def) return null;
  const variants = /** @type {readonly string[] | undefined} */ (/** @type {any} */ (def).variants);
  const script = variants ? variants[Math.min(seenOf(state, key).count, variants.length - 1)] : def.script;
  return { key, label: def.label, script: script.replace('{disciple}', state.discipleId), vars: { disciple: state.name } };
}

/**
 * 場面の答えを入れる(飛ばしたら答えなし。効き目はなく、見た印だけ付く)。
 * @param {any} state
 * @param {string | null} value 台本の{値}
 * @returns {{ state: any, text: string, fit: boolean, charm: string | null }}
 */
export function resolveScene(state, value) {
  const key = state.sceneQueue?.[0];
  const def = key ? DISCIPLE_SCENES[key] : null;
  if (!def) return { state, text: '', fit: false, charm: null };
  const next = structuredClone(state);
  next.sceneQueue.shift();
  next.scenesSeen ??= {};
  const seen = seenOf(next, key);
  next.scenesSeen[key] = { count: seen.count + 1, turn: next.turn };
  const effect = value ? def.effects[value] : null;
  if (!effect) {
    next.log.push({ turn: next.turn, text: `場面「${def.label}」` });
    return { state: next, text: '', fit: false, charm: null };
  }
  const fit = Boolean(def.fits?.[value]?.includes(next.discipleId));
  const mood = (effect.mood ?? 0) + (fit ? 1 : 0);
  if (mood) next.mood = clamp(next.mood + mood, -2, 2);
  if (effect.stamina) next.stamina = clamp(next.stamina + effect.stamina, 0, 100);
  if (effect.stats) next.stats = addGains(next.stats, effect.stats);
  for (const [id, amount] of Object.entries(effect.bonds ?? {})) next.bonds[id] = (next.bonds[id] ?? 0) + amount;
  if (effect.aim) {
    const weakest = STAT_KEYS.reduce((low, stat) => (next.stats[stat] < next.stats[low] ? stat : low), STAT_KEYS[0]);
    next.aims[weakest] = { boost: Math.max(next.aims[weakest]?.boost ?? 1, effect.aim), turns: 3 };
  }
  const charm = effect.charm && addCharm(next, effect.charm) ? effect.charm : null;
  const text = `${def.label}：${effect.text}${fit ? '（この子に合った）' : ''}`;
  next.log.push({ turn: next.turn, text });
  return { state: next, text, fit, charm };
}

