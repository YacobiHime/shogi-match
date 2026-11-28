// 師匠の1年の棋士が序盤に使う作戦(戦法＋囲い)の目録(docs/disciple-mode-design.mdの35章)。
// 作戦の手順は書き写さず、定跡補助の定義(opening-guide.mjs。定跡エディターの上書きデータを含む)をそのまま使う。
// ここでは、どの組を1枚のカードにするか・段・相手の飛車の向き・囲いの続きだけを持つ。
// 全部のカードと続きは、先後とも案内の手だけで完成まで指せることをテストで確かめる(disciple-plans.test.mjs)。

import {
  OPENING_CASTLES, OPENING_STRATEGIES, bishopExchangeState, isIntegratedOpening, isOpeningPlanComplete,
  openingDefinitionRookStyle,
} from './opening-guide.mjs';
import { CPU_ADAPTIVE_CASTLES, castleStartedForPlan, opponentOpeningStance } from './cpu-opening-repertoire.mjs';
import { appendUsiMove, createGameRecord, STANDARD_SFEN } from '../game-state';
import { parseSfenBoard } from './sfen-board.mjs';

/** 段(覚える順番)。 */
export const PLAN_TIERS = Object.freeze(['start', 'basic', 'advanced', 'special', 'surprise']);
export const PLAN_TIER_LABELS = Object.freeze({
  start: 'はじめ', basic: '基本', advanced: '応用', special: '特殊な囲い', surprise: '奇襲',
});

/**
 * カード。[戦法, 囲い, 段, 相手の飛車の向き(static・ranging・both), 指せる手番(省くと両方)]。
 * 一体の作戦は、戦法か囲いの片方だけ。相手の手しだいで成り立つ作戦(横歩取り・ひねり飛車・4五桂速攻・鬼殺し・筋違い角・パックマン)と、
 * 案内の手だけでは完成しない組(菊水矢倉)は、今は入れない(35-10)。
 */
const CARD_ROWS = [
  ['shiken', 'mino', 'start', 'both'],
  ['bougin', 'kanigakoi', 'start', 'static'],
  ['bougin', 'ibisha-anaguma', 'basic', 'ranging'],
  ['right-shiken', 'elmo', 'basic', 'both'],
  ['right-shiken-elmo', '', 'basic', 'both'],
  ['sangen', 'mino', 'basic', 'both'],
  ['ibisha', 'yagura', 'basic', 'static'],
  ['hayaguri-gin', 'yagura', 'basic', 'static'],
  ['hayaguri-gin', 'left-mino', 'basic', 'ranging'],
  ['koshikake-gin', 'yagura', 'basic', 'static'],
  ['nakabisha', 'half-mino', 'basic', 'both'],
  ['gangi-right-shiken', '', 'basic', 'static'],
  ['mukai', 'mino', 'basic', 'both'],
  ['ibisha', 'left-mino', 'basic', 'ranging'],
  ['ibisha', 'ibisha-anaguma', 'basic', 'ranging'],
  ['ibisha', 'gangi', 'basic', 'static'],
  ['kakugawari-koshikake-gin', '', 'advanced', 'static'],
  ['', 'migigyoku-habu', 'advanced', 'static'],
  ['', 'right-king', 'advanced', 'static'],
  ['kakugawari', 'yagura', 'advanced', 'static'],
  ['ishida', 'mino', 'advanced', 'both'],
  ['gokigen', 'high-mino', 'advanced', 'both'],
  ['yagura-37-silver', '', 'advanced', 'static'],
  ['morishita-system', '', 'advanced', 'static'],
  ['suzume-zashi', '', 'advanced', 'static', ['black']],
  ['fujii-system', '', 'advanced', 'static'],
  ['aigakari', 'nakahara', 'advanced', 'static'],
  ['chikatetsu-bisha', '', 'advanced', 'static'],
  ['shiken', 'furibisha-anaguma', 'advanced', 'both'],
  ['ibisha', 'millennium', 'special', 'ranging'],
  ['ibisha', 'matsuo-anaguma', 'special', 'ranging'],
  ['ibisha', 'doi-yagura', 'special', 'static'],
  ['ibisha', 'tenshukaku-mino', 'special', 'ranging'],
  ['ibisha', 'bonanza', 'special', 'static'],
  ['ibisha', 'amano-yagura', 'special', 'static'],
  ['shiken', 'kimura-mino', 'special', 'both'],
  ['nakabisha', 'muteki', 'special', 'both'],
  ['yababozu', 'osumi', 'surprise', 'static'],
  ['shin-onigoroshi', 'mino', 'surprise', 'both'],
  ['kakuto-fu', 'nakazumai', 'surprise', 'static'],
  ['hashikaku-nakabisha', 'half-mino', 'surprise', 'both'],
  ['first-78-rook', 'mino', 'surprise', 'both'],
  ['second-32-rook', 'mino', 'surprise', 'both'],
  ['torizashi', '', 'surprise', 'static'],
  ['ahiru', '', 'surprise', 'static'],
  ['ureshino', '', 'surprise', 'static'],
  ['sodebisha', 'left-mino', 'surprise', 'ranging'],
];

/** カードのid(戦法+囲い。片方がなければ空のまま)。 */
export const planCardId = (strategyId, castleId) => `${strategyId ?? ''}+${castleId ?? ''}`;

const strategyLabel = (id) => OPENING_STRATEGIES.find((entry) => entry.id === id)?.label ?? '';
const castleLabel = (id) => OPENING_CASTLES.find((entry) => entry.id === id)?.label ?? '';

/** カードの目録。 */
export const PLAN_CARDS = Object.freeze(CARD_ROWS.map(([strategyId, castleId, tier, vs, colors]) => Object.freeze({
  id: planCardId(strategyId, castleId),
  strategyId,
  castleId,
  tier,
  vs,
  colors: Object.freeze(colors ?? ['black', 'white']),
  rook: openingDefinitionRookStyle(strategyId || castleId, strategyId ? 'strategy' : 'castle') ?? 'static',
  integrated: isIntegratedOpening(strategyId, 'strategy') || isIntegratedOpening(castleId, 'castle'),
  label: [strategyLabel(strategyId), castleLabel(castleId)].filter(Boolean).join('＋'),
})));
const CARD_BY_ID = new Map(PLAN_CARDS.map((card) => [card.id, card]));
export const planCard = (id) => CARD_BY_ID.get(id) ?? null;

/**
 * 囲いの続き(完成のあと、同じ対局のまま組める次の囲い。先頭がふつうの続き)。
 * 定義の進化のもと(evolvesFrom)に、組めると確かめた美濃・舟囲いの続きを足す。ビッグ4は、居飛車穴熊の手順から組めないので今は入れない(35-10)。
 */
export const CASTLE_CHAINS = Object.freeze({
  'half-mino': Object.freeze(['mino', 'half-silver-crown']),
  mino: Object.freeze(['high-mino', 'diamond-mino']),
  'high-mino': Object.freeze(['silver-crown', 'four-mino']),
  funagakoi: Object.freeze(['left-mino']),
  'left-mino': Object.freeze(['ibisha-silver-crown']),
  yagura: Object.freeze(['hishi-yagura', 'gintachi-yagura', 'yagura-anaguma']),
  'ibisha-anaguma': Object.freeze(['silver-crown-anaguma']),
});

/** その囲いから、ふつうの続きをたどった並び(長さはsteps)。 */
export function castleChain(castleId, steps) {
  const chain = [];
  let current = castleId;
  for (let index = 0; index < steps; index += 1) {
    const next = CASTLE_CHAINS[current]?.[0];
    if (!next) break;
    chain.push(next);
    current = next;
  }
  return chain;
}

/** 作戦の能力値のLvから、続けて組む囲いの数(作戦が高いほど、囲いを固めてから戦う)。 */
export const chainSteps = (planLevel) => ((Number(planLevel) || 0) < 20 ? 0 : (Number(planLevel) || 0) < 32 ? 1 : 2);

/** 定跡を指す窓を広げる(囲いの続きを組むため)。ふつうのCPUは32手・自分の16手まで。 */
const LONG_WINDOW = Object.freeze({ ply: 70, own: 35 });

/**
 * 本局に渡す作戦(engine-game.mjsのspec.plans)。カードと、続けて組む囲いの数から作る。
 * @param {{ strategyId: string, castleId: string }} card
 * @param {{ steps?: number, adapt?: boolean, castles?: string[] | null }} [options] adaptは、相手の飛車の向きで囲いを組み替えるか。
 *   castlesは組み替えてよい囲い(弟子は作戦帳で知っている囲いだけ。省くとCPUと同じ候補)
 */
export function planSpec(card, { steps = 0, adapt = true, castles = null } = {}) {
  if (!card) return null;
  const chain = card.castleId && !card.integrated ? castleChain(card.castleId, steps) : [];
  return {
    strategyId: card.strategyId ?? '',
    castleId: card.castleId ?? '',
    chain,
    adapt: Boolean(adapt && card.strategyId && !card.integrated && CPU_ADAPTIVE_CASTLES[card.strategyId]),
    window: chain.length ? LONG_WINDOW : null,
    ...(castles ? { castles: [...castles] } : {}),
  };
}

/** 戦い方ごとの、作戦帳がまだないときの作戦(O1。作戦帳はO2)。 */
const STYLE_CARDS = Object.freeze({
  lead: { static: 'hayaguri-gin+yagura', ranging: 'hayaguri-gin+left-mino' },
  counter: { static: 'ibisha+yagura', ranging: 'ibisha+left-mino' },
  grit: { static: 'ibisha+yagura', ranging: 'ibisha+ibisha-anaguma' },
  study: { static: 'kakugawari-koshikake-gin+', ranging: 'ibisha+left-mino' },
});
const DEFAULT_CARDS = Object.freeze({ static: 'shiken+mino', ranging: 'shiken+mino' });
/** 大一番で相手の得意を外すとき。 */
const AVOID_CARDS = Object.freeze({ static: 'ibisha+yagura', ranging: 'ibisha+ibisha-anaguma' });

/**
 * 弟子の1局の作戦のカード。
 * @param {{ style?: string, opponentRook?: string, opening?: string | null, color?: string }} options openingは大一番の作戦(avoid・wild)
 */
export function disciplePlanCard({ style = '', opponentRook = 'static', opening = null, color = 'black' } = {}) {
  if (opening === 'wild') return null;
  const stance = opponentRook === 'ranging' ? 'ranging' : 'static';
  const table = opening === 'avoid' ? AVOID_CARDS : STYLE_CARDS[style] ?? DEFAULT_CARDS;
  const card = planCard(table[stance]);
  return card?.colors.includes(color) ? card : planCard(DEFAULT_CARDS[stance]);
}

/**
 * 相手の得意戦法(研修会・奨励会が1局ごとに選んだpending.style。{ strategy, castle, rook })から、本局に渡す作戦。
 * @param {{ strategy?: string, castle?: string } | null} style
 * @param {number} level 相手のLv(作戦の能力値と同じに見る)
 */
export function opponentPlanSpec(style, level) {
  if (!style?.strategy && !style?.castle) return null;
  const strategyId = style.strategy ?? '';
  const castleId = isIntegratedOpening(strategyId, 'strategy') ? '' : style.castle ?? '';
  return planSpec({
    strategyId,
    castleId,
    integrated: isIntegratedOpening(strategyId, 'strategy') || isIntegratedOpening(castleId, 'castle'),
  }, { steps: chainSteps(level) });
}

/** 対局での戦型の適性(対居飛車・対振り飛車・相振り・角換わり)。 */
export function battleKey(card, opponentRook) {
  const family = OPENING_STRATEGIES.find((entry) => entry.id === card?.strategyId)?.family;
  if (family === 'kakugawari' || card?.castleId === 'migigyoku-habu') return 'kakugawari';
  if (opponentRook === 'ranging') return card?.rook === 'ranging' ? 'aifuri' : 'ranging';
  return 'static';
}

/**
 * 手番ごとに作戦を進める。
 * - 相手の飛車の向きが見えたら、まだ囲いを動かしていなければ、合う囲いに組み替える(CPUと同じ候補の先頭)。
 * - 戦法と囲いが完成したら、続きの囲いへ進む(戦法は済んだものとして、囲いだけを案内する)。
 * @param {any} plan planSpecの形
 * @param {{ color: string, ownMoves: string[], opponentMoves: string[], sfen: string }} context
 */
export function advancePlan(plan, { color, ownMoves, opponentMoves, sfen }) {
  if (!plan) return plan;
  let next = plan;
  if (next.adapt && !next.adapted && next.castleId) {
    const opponentColor = color === 'black' ? 'white' : 'black';
    const stance = opponentOpeningStance({ opponentColor, opponentMoves, currentSfen: sfen });
    const pools = CPU_ADAPTIVE_CASTLES[next.strategyId];
    if (stance && pools) {
      const pool = (pools[stance] ?? []).filter((castle) => !next.castles || next.castles.includes(castle));
      // 角換わりになったら、矢倉の候補があれば矢倉へ(CPUと同じ)。
      const wanted = stance === 'static' && bishopExchangeState(sfen, color) === 'exchanged' && pool.includes('yagura') ? 'yagura' : pool[0];
      if (pool.includes(next.castleId) || !wanted || castleStartedForPlan(next, color, ownMoves)) {
        next = { ...next, adapted: true };
      } else {
        next = { ...next, castleId: wanted, chain: castleChain(wanted, next.chain.length), adapted: true };
      }
    }
  }
  if (next.chain?.length && isOpeningPlanComplete({
    strategyId: next.strategyId, castleId: next.castleId, color, playedMoves: ownMoves, opponentMoves, currentSfen: sfen,
  })) {
    const [castleId, ...rest] = next.chain;
    next = { ...next, strategyId: '', castleId, chain: rest, adapt: false, previous: [...(next.previous ?? []), next.castleId] };
  }
  return next;
}

// ---- 作戦帳(O2。35-3・35-5)。弟子の記録(disciple:v1)の planBook に持つ。

/** 弟子をとった日に知っている作戦(35-4の「はじめ」)。 */
export const START_CARDS = Object.freeze(['shiken+mino', 'bougin+kanigakoi']);
/** 戦い方ごとの、はじめに少し熟練度の高い作戦。 */
const FAVORITE_START = Object.freeze({ lead: 'bougin+kanigakoi', study: 'bougin+kanigakoi', counter: 'shiken+mino', grit: 'shiken+mino' });
const FAVORITE_BONUS = 10;
/** 大一番で選べる作戦の数(同じ種類の選択肢は3つほどに。UD:9)。 */
export const BOOK_CHOICES = 3;

/** カードの熟練度のはじめの値に使う適性(振り飛車は対居飛車、対振り飛車のカードは対振り飛車、角換わりは角換わり)。 */
export function cardAptitudeKey(card) {
  if (!card) return 'static';
  if (battleKey(card, 'static') === 'kakugawari') return 'kakugawari';
  return card.rook !== 'ranging' && card.vs === 'ranging' ? 'ranging' : 'static';
}

/**
 * 作戦帳を作る。前の版の記録(戦い方の得意戦法ごとの熟練度 state.mastery)があれば、その戦法のカードを足して熟練度を写す。
 * @param {{ style?: string, aptitudes?: Record<string, string>, legacy?: Record<string, number> | null, legacyOpening?: string | null, startingMastery: (rank: string) => number }} options
 */
export function createPlanBook({ style = '', aptitudes = {}, legacy = null, legacyOpening = null, startingMastery }) {
  const cards = {};
  for (const id of START_CARDS) {
    const card = planCard(id);
    const base = startingMastery(aptitudes[cardAptitudeKey(card)]);
    cards[id] = { mastery: Math.min(100, base + (FAVORITE_START[style] === id ? FAVORITE_BONUS : 0)), games: 0, wins: 0 };
  }
  const old = legacyOpening ? legacy?.[legacyOpening] : undefined;
  if (Number.isFinite(old) && STYLE_CARDS[style]) {
    for (const id of Object.values(STYLE_CARDS[style])) cards[id] ??= { mastery: Math.min(100, Math.max(0, old)), games: 0, wins: 0 };
  }
  return { cards, last: null };
}

/** 作戦帳の中で、手番と相手の飛車の向きに合うカード(熟練度の高い順)。 */
export function bookFits(book, { opponentRook = 'static', color = 'black' } = {}) {
  const stance = opponentRook === 'ranging' ? 'ranging' : 'static';
  const known = Object.keys(book?.cards ?? {}).map(planCard).filter((card) => card && card.colors.includes(color));
  const fits = known.filter((card) => card.vs === 'both' || card.vs === stance);
  const mastery = (card) => book.cards[card.id]?.mastery ?? 0;
  return (fits.length ? fits : known).sort((a, b) => mastery(b) - mastery(a) || a.id.localeCompare(b.id));
}

/**
 * その日の作戦のカード(35-5)。大一番で師匠が選んだカードがあればそれ、力戦なら定跡なし。
 * 相手の得意を外すときは、相手と違う飛車の向きのカードを先に見る。ほかは熟練度で重みを付けて選ぶ。
 * @param {any} book
 * @param {{ opponentRook?: string, opening?: string | null, cardId?: string | null, color?: string, random?: () => number }} options
 */
export function chooseBookCard(book, { opponentRook = 'static', opening = null, cardId = null, color = 'black', random = Math.random } = {}) {
  if (opening === 'wild') return null;
  const picked = cardId && book?.cards?.[cardId] ? planCard(cardId) : null;
  if (picked?.colors.includes(color)) return picked;
  let fits = bookFits(book, { opponentRook, color });
  if (opening === 'avoid') {
    const other = fits.filter((card) => card.rook !== (opponentRook === 'ranging' ? 'ranging' : 'static'));
    if (other.length) fits = other;
  }
  if (!fits.length) return planCard(DEFAULT_CARDS.static);
  const weights = fits.map((card) => 10 + (book.cards[card.id]?.mastery ?? 0));
  let roll = random() * weights.reduce((sum, value) => sum + value, 0);
  for (let index = 0; index < fits.length; index += 1) {
    roll -= weights[index];
    if (roll <= 0) return fits[index];
  }
  return fits.at(-1);
}

/** 大一番の作戦の欄(おまかせのほかに、合う作戦を熟練度の高い順に3つまで)。 */
export function bookChoices(book, options = {}) {
  return bookFits(book, options).slice(0, BOOK_CHOICES).map((card) => ({
    id: card.id, label: card.label, mastery: book.cards[card.id]?.mastery ?? 0, tier: card.tier,
  }));
}

/**
 * 指した日の記録(熟練度の伸び・局数・勝ち数)。書き換えてよい写しを渡す。
 * @returns {number} 熟練度の伸び
 */
export function notePlanGames(book, cardId, { games = 0, wins = 0, gain = 0 } = {}) {
  const entry = book?.cards?.[cardId];
  if (!entry) return 0;
  const before = entry.mastery;
  entry.mastery = Math.min(100, before + gain);
  entry.games += games;
  entry.wins += wins;
  book.last = cardId;
  return entry.mastery - before;
}

/** 弟子の札の作戦(最後に指した作戦。まだなければ熟練度のいちばん高い作戦)。 */
export function bookHeadline(book) {
  const ids = Object.keys(book?.cards ?? {});
  if (!ids.length) return null;
  const id = book.last && book.cards[book.last] ? book.last
    : ids.sort((a, b) => book.cards[b].mastery - book.cards[a].mastery || a.localeCompare(b))[0];
  const card = planCard(id);
  return card ? { id, label: card.label, value: book.cards[id].mastery, count: ids.length } : null;
}

// ---- 作戦の覚え方(O3。35-4・35-12)。

/** 段の並び(覚えてよい段は作戦の能力値で決める)。奇襲は研究会で教わるだけ。 */
const TIER_ORDER = Object.freeze(['start', 'basic', 'advanced', 'special']);
/** 作戦の能力値のLvで、覚えてよい段のいちばん上。 */
export function learnableTier(planLevel) {
  const lv = Number(planLevel) || 0;
  return lv < 20 ? 'basic' : lv < 32 ? 'advanced' : 'special';
}
/** 新しく覚えた作戦のはじめの熟練度。 */
export const LEARNED_MASTERY = 10;
/** 囲いの続きが1段開くまでに、その作戦で指す局数(もとの囲いを何度も組む、の見立て)。 */
export const CHAIN_GAMES = 6;
/** 覚えられそうな作戦(負けた相手の作戦)を覚えておく数。 */
const SEEN_MAX = 6;
/** 覚える候補の数(UD:9 同じ種類の選択肢は3つほど)。 */
const LEARN_CHOICES = 3;

const tierIndex = (tier) => TIER_ORDER.indexOf(tier);

/** 戦法と囲いのidから、近いカード(同じ組がなければ、矢倉戦法は居飛車＋矢倉に寄せる)。 */
export function cardFor(strategyId, castleId) {
  const exact = planCard(planCardId(strategyId, castleId)) ?? planCard(planCardId(strategyId, ''));
  if (exact) return exact;
  const strategy = strategyId === 'yagura-strategy' || strategyId === 'gangi-strategy' ? 'ibisha' : strategyId;
  return planCard(planCardId(strategy, castleId));
}

/**
 * 負けた相手の作戦を、覚えられそうな作戦に入れる(やられて覚える。35-2)。書き換えてよい写しを渡す。
 * @returns {string} 入れたカードのid(知っている作戦・目録にない作戦なら空)
 */
export function noteSeen(book, style) {
  const card = style ? cardFor(style.strategy, style.castle) : null;
  if (!card || book.cards[card.id] || card.tier === 'surprise') return '';
  book.seen = [card.id, ...(book.seen ?? []).filter((id) => id !== card.id)].slice(0, SEEN_MAX);
  return card.id;
}

/**
 * 新しく覚える作戦の候補(3つまで)。負けた相手の作戦を先に、知っている作戦で足りない相手の向き(振り飛車の相手など)に合う作戦を1つ入れ、
 * あとは低い段から選ぶ(D:4-1 いきなり全部は開かない)。
 * @param {any} book
 * @param {{ planLevel?: number, color?: string, random?: () => number }} options
 */
export function learnChoices(book, { planLevel = 0, random = Math.random } = {}) {
  const top = tierIndex(learnableTier(planLevel));
  const pool = PLAN_CARDS.filter((card) => !book.cards[card.id] && tierIndex(card.tier) >= 0 && tierIndex(card.tier) <= top);
  if (!pool.length) return [];
  const picked = [];
  const take = (card) => { if (card && !picked.includes(card.id) && picked.length < LEARN_CHOICES) picked.push(card.id); };
  for (const id of book.seen ?? []) take(pool.find((card) => card.id === id));
  const known = Object.keys(book.cards).map(planCard).filter(Boolean);
  for (const stance of ['ranging', 'static']) {
    if (!known.some((card) => card.vs === stance || card.vs === 'both')) {
      const fits = pool.filter((card) => card.vs === stance || card.vs === 'both');
      take(fits[Math.floor(random() * fits.length)]);
    }
  }
  // 残りは低い段を先に(同じ段の中は種で混ぜる)。
  const rest = pool.map((card) => ({ card, key: tierIndex(card.tier) + random() * 0.9 })).sort((a, b) => a.key - b.key);
  for (const { card } of rest) take(card);
  return picked;
}

/** 覚える候補を出す(もう出ていれば出し直さない)。書き換えてよい写しを渡す。 */
export function offerLearn(book, options = {}) {
  if (book.offer?.length) return book.offer;
  const choices = learnChoices(book, options);
  if (choices.length) book.offer = choices;
  return book.offer ?? [];
}

/**
 * 作戦を覚える。書き換えてよい写しを渡す。
 * @returns {string} 覚えた作戦の名前(覚えられなければ空)
 */
export function learnCard(book, cardId, { mastery = LEARNED_MASTERY } = {}) {
  const card = planCard(cardId);
  if (!card || book.cards[cardId]) return '';
  book.cards[cardId] = { mastery, games: 0, wins: 0 };
  book.offer = (book.offer ?? []).filter((id) => id !== cardId);
  if (!book.offer.length) delete book.offer;
  book.seen = (book.seen ?? []).filter((id) => id !== cardId);
  return card.label;
}

/** 研究会で教わる奇襲(まだ知らない奇襲のうち1つ)。 */
export function surpriseToLearn(book, random = Math.random) {
  const pool = PLAN_CARDS.filter((card) => card.tier === 'surprise' && !book.cards[card.id]);
  return pool.length ? pool[Math.floor(random() * pool.length)].id : '';
}

/** その作戦で組める囲いの続きの深さ(続きの表の長さまで)。 */
const chainDepth = (card) => (card?.castleId && !card.integrated ? castleChain(card.castleId, 3).length : 0);

/**
 * 指した局数で囲いの続きを開く(35-4。6局で1段)。書き換えてよい写しを渡す。
 * @returns {string} 新しく組めるようになった囲いの名前(なければ空)
 */
export function unlockChain(book, cardId) {
  const entry = book?.cards?.[cardId];
  const card = planCard(cardId);
  if (!entry || !card) return '';
  const before = entry.chain ?? 0;
  const now = Math.min(chainDepth(card), Math.floor(entry.games / CHAIN_GAMES));
  if (now <= before) return '';
  entry.chain = now;
  return castleLabel(castleChain(card.castleId, now).at(-1));
}

/** 作戦帳のシートの行(段の順・熟練度の順)。囲いの続きは、組めるところまでと次の段までの局数。 */
export function bookRows(book) {
  return Object.entries(book?.cards ?? {}).map(([id, entry]) => {
    const card = planCard(id);
    if (!card) return null;
    const depth = chainDepth(card);
    const steps = Math.min(entry.chain ?? 0, depth);
    const chain = card.castleId ? castleChain(card.castleId, depth) : [];
    return {
      id, label: card.label, tier: card.tier, tierLabel: PLAN_TIER_LABELS[card.tier], mastery: entry.mastery, games: entry.games, wins: entry.wins,
      vs: card.vs === 'both' ? '相手を選ばない' : card.vs === 'ranging' ? '振り飛車の相手に' : '居飛車の相手に',
      chainNow: chain.slice(0, steps).map(castleLabel),
      chainNext: steps < depth ? { label: castleLabel(chain[steps]), left: (steps + 1) * CHAIN_GAMES - entry.games } : null,
      memo: Object.keys(book.notes?.[id] ?? {}).length,
    };
  }).filter(Boolean).sort((a, b) => [...TIER_ORDER, 'surprise'].indexOf(a.tier) - [...TIER_ORDER, 'surprise'].indexOf(b.tier) || b.mastery - a.mastery);
}

/** 囲いの続きを組める段の数(作戦帳で開いた段と、作戦の能力値の小さいほう)。 */
export function bookChainSteps(book, cardId, planLevel) {
  return Math.min(chainSteps(planLevel), book?.cards?.[cardId]?.chain ?? 0);
}

// ---- 研究メモ(O4。小さな定跡ファイル。35-3・35-13)。

/** 研究メモに残す手の損の上限(形勢を保った手だけ覚える)と、忘れる手の損(負けた局で大きく損をした研究の手)。 */
export const MEMO_KEEP_LOSS = 120;
export const MEMO_FORGET_LOSS = 250;
/** 作戦ごとに覚えておける局面の数(熟練度0で20、100で80。先輩・師匠の棋譜から写した局面も数える。49-14)。 */
export const memoLimit = (mastery) => 20 + Math.round((Math.max(0, Math.min(100, Number(mastery) || 0)) / 100) * 60);

/** 局面の見分け(盤・手番・持ち駒。手数は見ない。engine-game.mjsの千日手の見分けと同じ形)。 */
const memoKey = (sfen) => String(sfen).split(' ').slice(0, 3).join(' ');

/**
 * 研究ノートの1局面(49章。前の版は手の文字だけだった)。mは指す手、nは指した回数、wは勝った回数、sは出どころ
 * (exp 経験=観戦した局の研究の続き。ほかの出どころ(師匠の棋譜・一門の先輩)は後で足す。49-9のF5)、xは負けた局で大きく損をして外した手(避ける。次はその手を指さない)。
 * @typedef {{ m?: string, n: number, w: number, s: string, x?: string }} NoteEntry
 */

/** ノートの1局面を今の形にする(前の版の手の文字は、経験で1回覚えた手として読む)。 */
export function noteEntry(value) {
  if (typeof value === 'string') return { m: value, n: 1, w: 0, s: 'exp' };
  if (!value || typeof value !== 'object') return null;
  const entry = { n: Math.max(0, Number(value.n) || 0), w: Math.max(0, Number(value.w) || 0), s: typeof value.s === 'string' && value.s ? value.s : 'exp' };
  if (typeof value.m === 'string' && value.m) entry.m = value.m;
  if (typeof value.x === 'string' && value.x) entry.x = value.x;
  return entry.m || entry.x ? entry : null;
}

/**
 * 観戦した本局から、その作戦の研究ノートを書き足す(書き換えてよい写しを渡す)。
 * 研究の続き(エンジン)とノートの手のうち、損の小さい手を局面ごとに覚える。ノートの手を指した局は回数と勝ちを数える。
 * 負けた局で大きく損をしたノートの手は外して「避ける」印を残す(次はその局面で自分で考える)。
 * @param {any} book
 * @param {string} cardId
 * @param {readonly { move: string, loss?: number, d?: { s?: string } }[]} entries
 * @param {{ side: 'black' | 'white', win: boolean, start?: string }} game startは駒落ちの開始局面
 * @returns {{ added: number, used: number, forgot: number }}
 */
export function noteResearch(book, cardId, entries, { side, win, start = STANDARD_SFEN }) {
  const entry = book?.cards?.[cardId];
  if (!entry || !entries?.length) return { added: 0, used: 0, forgot: 0 };
  book.notes ??= {};
  const notes = {};
  for (const [key, value] of Object.entries(book.notes[cardId] ?? {})) {
    const item = noteEntry(value);
    if (item) notes[key] = item;
  }
  const record = createGameRecord(start || STANDARD_SFEN);
  const firstMover = String(start || STANDARD_SFEN).split(' ')[1] === 'w' ? 'white' : 'black';
  let added = 0;
  let used = 0;
  let forgot = 0;
  entries.forEach((item, index) => {
    const mover = index % 2 === 0 ? firstMover : firstMover === 'black' ? 'white' : 'black';
    const mine = mover === side;
    const key = memoKey(record.position.sfen);
    const stage = item?.d?.s;
    if (mine && (stage === 'follow' || stage === 'memo')) {
      const loss = Number(item.loss) || 0;
      const now = notes[key];
      if (stage === 'memo' && now?.m === item.move) {
        used += 1;
        now.n += 1;
        if (win) now.w += 1;
      }
      if (!win && loss >= MEMO_FORGET_LOSS && now?.m === item.move) {
        notes[key] = { n: now.n, w: now.w, s: now.s, x: item.move };
        forgot += 1;
      } else if (loss <= MEMO_KEEP_LOSS && now?.m !== item.move && now?.x !== item.move) {
        delete notes[key];
        notes[key] = { m: item.move, n: 1, w: win ? 1 : 0, s: 'exp' };
        added += 1;
      }
    }
    if (!appendUsiMove(record, item.move)) return;
  });
  // 多すぎたら古い局面から忘れる。
  const keys = Object.keys(notes);
  for (const key of keys.slice(0, Math.max(0, keys.length - memoLimit(entry.mastery)))) delete notes[key];
  book.notes[cardId] = notes;
  return { added, used, forgot };
}

/** 本局に渡す、その作戦の研究ノート(局面→手。避ける印だけの局面は渡さない)。 */
export function researchNotes(book, cardId) {
  const out = {};
  for (const [key, value] of Object.entries(book?.notes?.[cardId] ?? {})) {
    const item = noteEntry(value);
    if (item?.m) out[key] = item.m;
  }
  return out;
}

/**
 * 作戦帳のシートの研究ノートの行(49章)。新しく覚えた順。sfenは盤に出す局面(手数は1にする)。
 * @returns {{ key: string, sfen: string, move: string, avoid: string, games: number, wins: number, source: string }[]}
 */
export function noteRows(book, cardId) {
  return Object.entries(book?.notes?.[cardId] ?? {}).map(([key, value]) => {
    const item = noteEntry(value);
    return item ? { key, sfen: `${key} 1`, move: item.m ?? '', avoid: item.x ?? '', games: item.n, wins: item.w, source: item.s } : null;
  }).filter(Boolean).reverse();
}

// ---- 研究ノートの出どころ(49-9のF5): 一門の先輩と、師匠(あなた)の棋譜。

/** 出どころの呼び名(研究ノートの一覧)。 */
export const NOTE_SOURCE_LABELS = Object.freeze({ exp: '', senpai: '先輩から', master: '師匠の棋譜' });
/** 一門に残す研究ノートの局面の数と、師匠の棋譜を1回で写す局面の数。 */
export const INHERIT_NOTES = 20;
export const MASTER_NOTES = 8;
/** 師匠の棋譜を写す手数の範囲(はじめの数手は作戦の手順どおりに指すので写さない)。 */
export const MASTER_NOTE_PLIES = Object.freeze({ from: 8, to: 40 });

/**
 * 一門に残す研究ノート(49-9のF5)。いちばん多く指した作戦の、手のある局面を、指して勝った順に20局面まで。
 * @returns {{ card: string, notes: Record<string, { m: string, n: number, w: number }> } | null}
 */
export function bestNotes(book, limit = INHERIT_NOTES) {
  const cards = Object.entries(book?.cards ?? {})
    .filter(([id]) => Object.keys(book?.notes?.[id] ?? {}).length)
    .sort((a, b) => (b[1].games ?? 0) - (a[1].games ?? 0));
  const card = cards[0]?.[0];
  if (!card) return null;
  const rows = Object.entries(book.notes[card]).map(([key, value]) => [key, noteEntry(value)])
    .filter(([, item]) => item?.m)
    .sort((a, b) => (b[1].w - a[1].w) || (b[1].n - a[1].n))
    .slice(0, limit);
  return rows.length ? { card, notes: Object.fromEntries(rows.map(([key, item]) => [key, { m: item.m, n: item.n, w: item.w }])) } : null;
}

/**
 * 先輩の研究ノートを受け継ぐ(書き換えてよい写しを渡す)。弟子のノートにない局面だけ、出どころ「先輩から」で足す。
 * 弟子がまだその作戦を知らなくても残しておき、覚えたときに使う。
 * @returns {number} 足した局面の数
 */
export function inheritNotes(book, inherited, source = 'senpai') {
  if (!book || !inherited?.card || !inherited.notes) return 0;
  book.notes ??= {};
  const notes = { ...(book.notes[inherited.card] ?? {}) };
  let added = 0;
  for (const [key, value] of Object.entries(inherited.notes)) {
    const item = noteEntry(value);
    if (!item?.m || notes[key]) continue;
    notes[key] = { m: item.m, n: 0, w: 0, s: source };
    added += 1;
  }
  book.notes[inherited.card] = notes;
  return added;
}

/** 棋譜の手番の側の飛車の向き(その手数の盤で、飛車がもとの筋から左へ動いていれば振り飛車)。 */
function rookStyleAt(sfen, color) {
  const board = parseSfenBoard(sfen);
  for (const [square, piece] of board) {
    if (piece.color !== color || (piece.kind !== 'R' && piece.kind !== '+R')) continue;
    const file = Number(square[0]);
    return color === 'black' ? (file >= 5 ? 'ranging' : 'static') : (file <= 5 ? 'ranging' : 'static');
  }
  return null;
}

/** 師匠の棋譜が、その作戦と同じ先後に入れて、飛車の向き(24手目の盤。短い対局は最後)が同じか。 */
function masterGameFits(card, game) {
  if (!card.colors.includes(game.userColor)) return false;
  const probe = createGameRecord(STANDARD_SFEN);
  const plies = Math.min(game.moves.length, 24);
  for (let index = 0; index < plies; index += 1) {
    if (!appendUsiMove(probe, game.moves[index])) return false;
  }
  return rookStyleAt(probe.position.sfen, game.userColor) === card.rook;
}

/** 研究で並べられる師匠の棋譜の数(作戦と飛車の向きが同じ対局)。 */
export function masterGameCount(cardId, games) {
  const card = planCard(cardId);
  return card ? (games ?? []).filter((game) => masterGameFits(card, game)).length : 0;
}

/**
 * 師匠(あなた)の棋譜を並べて、その作戦の研究ノートに写す(書き換えてよい写しを渡す。49-9のF5)。
 * 作戦と飛車の向きが同じ対局だけを使い、あなたの手番の局面(8〜40手目)のうち、ノートにない局面を新しい対局から順に写す。
 * @param {any} book
 * @param {string} cardId
 * @param {readonly { moves: readonly string[], userColor: 'black' | 'white' }[]} games 新しい順
 * @returns {{ added: number, games: number }}
 */
export function masterNotes(book, cardId, games, limit = MASTER_NOTES) {
  const card = planCard(cardId);
  if (!card || !book?.cards?.[cardId] || !games?.length) return { added: 0, games: 0 };
  book.notes ??= {};
  const notes = { ...(book.notes[cardId] ?? {}) };
  let added = 0;
  let used = 0;
  for (const game of games) {
    if (added >= limit) break;
    const color = game.userColor;
    if (!masterGameFits(card, game)) continue;
    const record = createGameRecord(STANDARD_SFEN);
    let took = 0;
    for (let index = 0; index < Math.min(game.moves.length, MASTER_NOTE_PLIES.to) && added < limit; index += 1) {
      const mover = index % 2 === 0 ? 'black' : 'white';
      const key = memoKey(record.position.sfen);
      const usi = game.moves[index];
      if (mover === color && index >= MASTER_NOTE_PLIES.from && !notes[key]) {
        notes[key] = { m: usi, n: 0, w: 0, s: 'master' };
        added += 1;
        took += 1;
      }
      if (!appendUsiMove(record, usi)) break;
    }
    if (took) used += 1;
  }
  book.notes[cardId] = notes;
  return { added, games: used };
}
