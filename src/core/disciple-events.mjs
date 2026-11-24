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
    label: '学校の試験', script: 'disciple-school', variants: Object.freeze(['disciple-school', 'disciple-school-2', 'disciple-school-3']), max: 3,
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
    label: 'はじめての昇級', script: 'disciple-promote', cards: Object.freeze(['promote']),
    effects: Object.freeze({
      celebrate: { mood: 1, stamina: 10, text: 'お祝いをした' },
      next: { aim: 1.25, text: '次の目標を話した' },
      charm: { charm: 'kachi', text: '勝守を渡した' },
    }),
    fits: Object.freeze({ celebrate: ['minato'], next: ['tsumugi'], charm: ['ao'] }),
  }),
  // 奨励会の節目(28章)。四段と退会は答えのない場面(育成の終わり)。
  shoreikai: Object.freeze({
    label: '奨励会へ', script: 'disciple-shoreikai', cards: Object.freeze(['shoreikai', 'agelimit']),
    effects: Object.freeze({
      serious: { stats: { steady: 15 }, text: '気を引き締めるよう話した' },
      enjoy: { mood: 1, text: '楽しもうと話した' },
      peers: { bonds: { hayase: 1, makabe: 1 }, text: '同期と仲良くするよう話した' },
    }),
    fits: Object.freeze({ serious: ['tsumugi'], enjoy: ['minato'], peers: ['ao'] }),
  }),
  shodan: Object.freeze({
    label: '初段の日', script: 'disciple-shodan', cards: Object.freeze(['dan']),
    effects: Object.freeze({
      celebrate: { mood: 1, stamina: 10, text: 'お祝いをした' },
      next: { aim: 1.25, text: '三段リーグまでの目標を決めた' },
      charm: { charm: 'kachi', text: '勝守を渡した' },
    }),
    fits: Object.freeze({ celebrate: ['minato'], next: ['tsumugi'], charm: ['ao'] }),
  }),
  sandan: Object.freeze({
    label: '三段リーグ', script: 'disciple-sandan', cards: Object.freeze(['league', 'jiten']),
    effects: Object.freeze({
      calm: { mood: 1, stamina: 10, text: '一期ずつでいいと話した' },
      push: { stats: { reading: 15 }, mood: -1, text: '一期で抜けようと話した' },
      study: { aim: 1.5, text: 'リーグの相手の棋譜を一緒に調べた' },
    }),
    fits: Object.freeze({ calm: ['minato'], push: ['ao'], study: ['tsumugi'] }),
  }),
  // 羽音の一門(30章)。勝った日・負けた日の場面は、見た回数で台本を替え、台本の数まで(max)。
  'rival-first': Object.freeze({
    label: '羽音の一門', script: 'disciple-rival-first',
    effects: Object.freeze({
      respect: { mood: 1, text: '羽音と、互いの弟子をたたえた' },
      rivalry: { stats: { reading: 12 }, text: '羽音に、次も負けないと言った' },
      study: { aim: 1.25, text: '羽音の弟子のことを考えた' },
    }),
    fits: Object.freeze({ respect: ['minato'], rivalry: ['ao'], study: ['tsumugi'] }),
  }),
  'rival-win': Object.freeze({
    label: '羽音の弟子に勝った日', script: 'disciple-rival-win-1', variants: Object.freeze(['disciple-rival-win-1', 'disciple-rival-win-2']), max: 2,
    effects: Object.freeze({}), fits: Object.freeze({}),
  }),
  'rival-lose': Object.freeze({
    label: '羽音の弟子に負けた日', script: 'disciple-rival-lose-1', variants: Object.freeze(['disciple-rival-lose-1', 'disciple-rival-lose-2']), max: 2,
    effects: Object.freeze({
      rematch: { aim: 1.5, text: '次の一局のために、一緒に並べ直した' },
      rest: { mood: 1, stamina: 10, text: '焦らせずに休ませた' },
    }),
    fits: Object.freeze({ rematch: ['tsumugi', 'ao'], rest: ['minato'] }),
  }),
  // 段階3の残りの場面(32章)。どれも1回の育成で1回だけ。
  jealous: Object.freeze({
    label: '一門のやきもち', script: 'disciple-jealous', max: 1,
    effects: Object.freeze({
      own: { mood: 1, text: '比べていないと、まっすぐ伝えた' },
      learn: { senpaiBond: 2, stats: { plan: 10 }, text: '先輩に教わってみるよう勧めた' },
      beat: { stats: { reading: 12 }, text: '先輩を越えてみろと言った' },
    }),
    fits: Object.freeze({ own: ['minato'], learn: ['tsumugi'], beat: ['ao'] }),
  }),
  clash: Object.freeze({
    label: '師匠の大一番と重なる', script: 'disciple-clash', max: 1,
    effects: Object.freeze({
      go: { stats: { steady: 15 }, text: 'ひとりで行ってこいと、電話で送り出した' },
      visit: { mood: 1, stamina: -10, text: '朝いちばんに、弟子の会場へ寄ってから対局へ向かった' },
      letter: { stats: { plan: 12 }, text: '作戦のメモを書いて渡した' },
    }),
    fits: Object.freeze({ go: ['ao'], visit: ['minato'], letter: ['tsumugi'] }),
  }),
  agelimit: Object.freeze({
    label: '年齢制限の先輩', script: 'disciple-agelimit', max: 1,
    effects: Object.freeze({
      talk: { mood: 1, text: 'やめていく先輩のことを、一緒に話した' },
      resolve: { stats: { steady: 15, reading: 8 }, mood: -1, text: '自分は届くまで指すと決めさせた' },
      rest: { stamina: 30, text: '今日は将棋を休ませた' },
    }),
    fits: Object.freeze({ talk: ['minato'], resolve: ['ao'], rest: ['tsumugi'] }),
  }),
  // 制度を教える場面(docs/disciple-mode-design.mdの36-6)。制度が初めて効く瞬間に1回だけ。見ると(飛ばしても)制度の札(cards)が入る。
  'sys-kenshukai': Object.freeze({
    label: '研修会の面談', script: 'disciple-sys-kenshukai', max: 1, cards: Object.freeze(['kenshukai', 'exam']),
    effects: Object.freeze({
      calm: { mood: 1, text: '試験はいつもどおりでいいと話した' },
      push: { stats: { reading: 10 }, text: '1つでも上のクラスをと励ました' },
      momoka: { bonds: { momoka: 1 }, text: '百花に研修会の話を頼んだ' },
    }),
    fits: Object.freeze({ calm: ['minato'], push: ['ao'], momoka: ['tsumugi'] }),
  }),
  'sys-reikai': Object.freeze({
    label: '名札掛けの前で', script: 'disciple-sys-reikai', max: 1, cards: Object.freeze(['reikai', 'promote']),
    effects: Object.freeze({
      count: { aim: 1.25, text: '昇級まで1つずつ数えようと話した' },
      scout: { stats: { plan: 10 }, text: '相手の札を見ておくよう話した' },
      care: { stamina: 10, mood: 1, text: '休み時間の甘いものを持たせた' },
    }),
    fits: Object.freeze({ count: ['tsumugi'], scout: ['ao'], care: ['minato'] }),
  }),
  'sys-teai': Object.freeze({
    label: '香一本の差', script: 'disciple-sys-teai', max: 1, cards: Object.freeze(['teai']),
    effects: Object.freeze({
      use: { stats: { plan: 10 }, text: '香一本の差を活かそうと話した' },
      guard: { stats: { steady: 10 }, text: '上手の攻めを受けようと話した' },
      same: { mood: 1, text: '平手も香落ちも同じ一局だと話した' },
    }),
    fits: Object.freeze({ use: ['ao'], guard: ['tsumugi'], same: ['minato'] }),
  }),
  'sys-shido': Object.freeze({
    label: '先生との駒落ち', script: 'disciple-sys-shido', max: 1, cards: Object.freeze(['shido']),
    effects: Object.freeze({
      borrow: { mood: 1, text: '胸を借りるつもりでと送り出した' },
      study: { stats: { plan: 12 }, text: '駒落ちの定跡をおさらいした' },
      steal: { stats: { reading: 10 }, text: '先生の手を盗んでおいでと言った' },
    }),
    fits: Object.freeze({ borrow: ['minato'], study: ['tsumugi'], steal: ['ao'] }),
  }),
  'sys-point': Object.freeze({
    label: '降級点', script: 'disciple-sys-point', max: 1, cards: Object.freeze(['point']),
    effects: Object.freeze({
      one: { stats: { steady: 12 }, text: '次の1局目だけに集中しようと話した' },
      rest: { stamina: 25, mood: 1, text: '将棋を休ませた' },
      review: { aim: 1.5, text: '負けた将棋を一緒に並べた' },
    }),
    fits: Object.freeze({ one: ['ao'], rest: ['minato'], review: ['tsumugi'] }),
  }),
  'sys-exit': Object.freeze({
    label: '研修会の出口', script: 'disciple-sys-exit', max: 1, cards: Object.freeze(['exit']),
    effects: Object.freeze({
      go: { mood: 1, text: 'A2まで行こうと話した' },
      wait: { stats: { steady: 12 }, text: '研修会で力をつけてからと話した' },
      rival: { stats: { reading: 10 }, text: '羽音の弟子と同じ道を行くと話した' },
    }),
    fits: Object.freeze({ go: ['minato'], wait: ['tsumugi'], rival: ['ao'] }),
  }),
  'sys-hanko': Object.freeze({
    label: '半香', script: 'disciple-sys-hanko', max: 1, cards: Object.freeze(['shoreikai-teai']),
    effects: Object.freeze({
      next: { mood: 1, text: '悔しさを次の平手にと話した' },
      study: { stats: { plan: 12 }, text: '香落ちの下手の指し方を調べた' },
      both: { stats: { steady: 10 }, text: '上手も下手も経験だと話した' },
    }),
    fits: Object.freeze({ next: ['ao'], study: ['tsumugi'], both: ['minato'] }),
  }),
  'sys-final': Object.freeze({
    label: '最終日の前夜', script: 'disciple-sys-final', max: 1, cards: Object.freeze(['jiten']),
    effects: Object.freeze({
      own: { stats: { steady: 12 }, text: '自分の盤だけを見ればいいと話した' },
      next: { mood: 1, text: '次点でも来期につながると話した' },
      sleep: { stamina: 20, text: '早く寝るよう言った' },
    }),
    fits: Object.freeze({ own: ['ao'], next: ['minato'], sleep: ['tsumugi'] }),
  }),
  'sys-extend': Object.freeze({
    label: '延長', script: 'disciple-sys-extend', max: 1, cards: Object.freeze(['agelimit']),
    effects: Object.freeze({
      calm: { mood: 1, text: 'まだ時間はあると話した' },
      push: { stats: { reading: 12 }, mood: -1, text: 'この期で決めようと話した' },
      stay: { stamina: 20, mood: 1, text: 'どんな結果でも将棋は残ると話した' },
    }),
    fits: Object.freeze({ calm: ['minato'], push: ['ao'], stay: ['tsumugi'] }),
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

/** 一門のやきもち(32章): 連れてきた一門の先輩との絆がこれだけになったら、育成に入って半年より後に1回。 */
export const JEALOUS_SCENE = Object.freeze({ bond: 3, minTurn: 12 });
/** 師匠の大一番と重なる(32章): 育成に入って1年より後の、弟子の大一番の前に1回(ほかの場面が積まれていないとき)。 */
export const CLASH_SCENE = Object.freeze({ minTurn: 24 });

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
  const max = /** @type {any} */ (DISCIPLE_SCENES[key]).max;
  if (max && seenOf(state, key).count >= max) return false;
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
  if (!event) {
    // 一門のやきもち: 連れてきた先輩のうち、絆のいちばん深い人(32章)。
    if (state.turn >= JEALOUS_SCENE.minTurn && seenOf(state, 'jealous').count === 0 && !state.sceneQueue?.length) {
      const senpai = (state.team ?? []).filter((friend) => friend?.senpai)
        .sort((a, b) => (state.bonds?.[b.id] ?? 0) - (state.bonds?.[a.id] ?? 0))[0];
      if (senpai && (state.bonds?.[senpai.id] ?? 0) >= JEALOUS_SCENE.bond) {
        state.sceneVars = { ...state.sceneVars, senpai: senpai.name, senpaiId: senpai.id };
        queueScene(state, 'jealous');
      }
    }
    return;
  }
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
 * 師匠の大一番と重なる場面を積む(32章)。次のターンが弟子の大一番のときに呼ぶ。積んだらtrue。
 * 師匠(プレイヤー)の大会の暦は動かさない。重なったという設定の場面で、答えは弟子の育ちだけに効く。
 * @param {any} state 書き換えてよい写し
 * @param {boolean} big 次のターンが大一番か
 */
export function checkClash(state, big) {
  if (!big || state.end || state.turn < CLASH_SCENE.minTurn || state.sceneQueue?.length) return false;
  if (seenOf(state, 'clash').count > 0) return false;
  return queueScene(state, 'clash');
}

/**
 * 年齢制限の先輩の場面を積む(32章)。奨励会の知らせに、年齢制限で去った人が新しく出たときに呼ぶ。積んだらtrue。
 * @param {any} state 書き換えてよい写し
 * @param {string} name 去った先輩の名前
 */
export function checkAgeLimit(state, name) {
  if (!name || state.end || seenOf(state, 'agelimit').count > 0) return false;
  state.sceneVars = { ...state.sceneVars, ageSenpai: name };
  return queueScene(state, 'agelimit');
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
  const rival = state.rival?.name ?? '';
  const result = state.rival?.last === 'win' ? `${state.name}の勝ち` : `${rival}の勝ち`;
  const senpai = state.sceneVars?.senpai ?? '';
  const ageSenpai = state.sceneVars?.ageSenpai ?? '';
  return { key, label: def.label, script: script.replace('{disciple}', state.discipleId), vars: { disciple: state.name, rival, result, senpai, ageSenpai } };
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
  // 制度の札(36-6)。飛ばしても入る(あとで会の画面の規定のタブで読める)。
  const cards = /** @type {readonly string[] | undefined} */ (/** @type {any} */ (def).cards);
  if (cards?.length) next.systemCards = [...new Set([...(next.systemCards ?? []), ...cards])];
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
  // 一門の先輩との絆(32章。先輩のidは場面を積んだときに残す)。
  const senpaiId = next.sceneVars?.senpaiId;
  if (effect.senpaiBond && senpaiId) next.bonds[senpaiId] = (next.bonds[senpaiId] ?? 0) + effect.senpaiBond;
  if (effect.aim) {
    const weakest = STAT_KEYS.reduce((low, stat) => (next.stats[stat] < next.stats[low] ? stat : low), STAT_KEYS[0]);
    next.aims[weakest] = { boost: Math.max(next.aims[weakest]?.boost ?? 1, effect.aim), turns: 3 };
  }
  const charm = effect.charm && addCharm(next, effect.charm) ? effect.charm : null;
  const text = `${def.label}：${effect.text}${fit ? '（この子に合った）' : ''}`;
  next.log.push({ turn: next.turn, text });
  return { state: next, text, fit, charm };
}

