// 囲いのおすすめ(相手の飛車で決める)と、対局中の組み替え(docs/opening-guide-ux-design.mdの14-3・14-4)。
// 画面に依存しない。相手の向きは呼ぶ側が`inferOpeningRookStyle`で、角換わりは`bishopExchangeState`で出して渡す。

/** 作戦カードの囲いの欄の「おすすめ(相手の飛車で決める)」の値。 */
export const AUTO_CASTLE = 'auto';

/**
 * 相手の飛車ごとの、おすすめの順(先に並ぶほど勧める)。
 * まだ分からない・居飛車は矢倉、振り飛車は左美濃、角換わりは矢倉(14-3)。舟囲いは勧めない。
 */
export const CASTLE_ADVICE_ORDER = Object.freeze({
  static: Object.freeze(['yagura', 'left-mino', 'gangi', 'nakazumai', 'kanigakoi']),
  ranging: Object.freeze(['left-mino', 'ibisha-anaguma', 'elmo', 'yagura', 'funagakoi']),
  exchanged: Object.freeze(['yagura', 'left-mino', 'nakazumai']),
});

/**
 * いまの相手の様子(おすすめの順の名前)。
 * @param {{ opponentRook?: string | null, bishopExchanged?: boolean }} input opponentRookは'ranging'・'static'か、分からなければ空
 * @returns {'static' | 'ranging' | 'exchanged'}
 */
export function castleSituation({ opponentRook = '', bishopExchanged = false } = {}) {
  if (opponentRook === 'ranging') return 'ranging';
  return bishopExchanged ? 'exchanged' : 'static';
}

/**
 * 合う囲いの中から、相手の飛車で決めたおすすめの囲い。合う囲いが表になければ最初の囲い。
 * @param {{ castles: readonly string[], opponentRook?: string | null, bishopExchanged?: boolean }} input
 * @returns {string}
 */
export function recommendCastle({ castles, opponentRook = '', bishopExchanged = false }) {
  const order = CASTLE_ADVICE_ORDER[castleSituation({ opponentRook, bishopExchanged })];
  return order.find((id) => castles.includes(id)) ?? castles[0] ?? '';
}

/**
 * 「おすすめ」を選べる作戦か。居飛車の作戦で、合う囲いが2つ以上あり、表のおすすめが入っているとき。
 * @param {{ group: string, strategyId: string, name?: string, castles: readonly string[] }} plan
 */
export function castleAdviceApplies(plan) {
  return Boolean(plan && plan.group === 'static' && plan.strategyId && !plan.name
    && plan.castles.length >= 2 && plan.castles.some((id) => CASTLE_ADVICE_ORDER.static.includes(id) || CASTLE_ADVICE_ORDER.ranging.includes(id)));
}

/**
 * 対局中の組み替え(14-4)。おすすめに任せているときだけ。
 * - まだ囲いの駒(歩のほか)を動かしていなければ、黙って替える('switch')。
 * - 組み始めていたら、1つの節目で1回だけ聞く('ask')。
 * - 自分で選んだ囲い・完成した囲い・聞いたあとの節目は替えない('none')。
 * @param {{ auto: boolean, current: string, castles: readonly string[], opponentRook?: string | null, bishopExchanged?: boolean,
 *   started: boolean, complete: boolean, asked?: readonly string[] }} input
 * @returns {{ action: 'none' | 'switch' | 'ask', to: string, situation: string }}
 */
export function castleSwitch({ auto, current, castles, opponentRook = '', bishopExchanged = false, started, complete, asked = [] }) {
  const situation = castleSituation({ opponentRook, bishopExchanged });
  const none = { action: /** @type {const} */ ('none'), to: current, situation };
  if (!auto || complete) return none;
  const to = recommendCastle({ castles, opponentRook, bishopExchanged });
  if (!to || to === current) return none;
  if (!started) return { action: 'switch', to, situation };
  if (asked.includes(situation)) return none;
  return { action: 'ask', to, situation };
}

/** やこび姫の一言(14-4)。{castle}は囲いの名前。 */
export const CASTLE_ADVICE_TEXT = Object.freeze({
  switch: Object.freeze({
    ranging: '振り飛車だね。囲いは{castle}にするよ！',
    exchanged: '角換わりになったね。囲いは{castle}にするよ！',
    static: '相手は居飛車だね。囲いは{castle}にするよ！',
  }),
  ask: Object.freeze({
    ranging: '相手が飛車を振ったよ。{castle}に組み替える？',
    exchanged: '角換わりになったよ。{castle}に組み替える？',
    static: '相手は居飛車みたい。{castle}に組み替える？',
  }),
  done: '相手を見て組めたね！',
  auto: 'おすすめ',
});

/**
 * 一言に囲いの名前を入れる。
 * @param {'switch' | 'ask'} kind
 * @param {string} situation
 * @param {string} castleLabel
 */
export function castleAdviceLine(kind, situation, castleLabel) {
  const table = CASTLE_ADVICE_TEXT[kind];
  return (table[situation] ?? table.static).replace('{castle}', castleLabel);
}
