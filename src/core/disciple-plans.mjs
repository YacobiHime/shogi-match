// 師匠の1年の棋士が序盤に使う作戦(戦法＋囲い)の目録(docs/disciple-mode-design.mdの35章)。
// 作戦の手順は書き写さず、定跡補助の定義(opening-guide.mjs。定跡エディターの上書きデータを含む)をそのまま使う。
// ここでは、どの組を1枚のカードにするか・段・相手の飛車の向き・囲いの続きだけを持つ。
// 全部のカードと続きは、先後とも案内の手だけで完成まで指せることをテストで確かめる(disciple-plans.test.mjs)。

import {
  OPENING_CASTLES, OPENING_STRATEGIES, bishopExchangeState, isIntegratedOpening, isOpeningPlanComplete,
  openingDefinitionRookStyle,
} from './opening-guide.mjs';
import { CPU_ADAPTIVE_CASTLES, castleStartedForPlan, opponentOpeningStance } from './cpu-opening-repertoire.mjs';

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
