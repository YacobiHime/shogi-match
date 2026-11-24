// 研修会・奨励会の手合い(docs/disciple-mode-design.mdの36-4)。段級(研修会はクラス)の差で、平手・平香交じり・香落ちを決める。
// 奨励会の例会の実物の手合い: 同じ段級は平手(はじめは振り駒、次からは先後を交互)、1つ差は平香交じり(平手と香落ちを交互)、
// 2つ以上の差は香落ち(上位者が左香を落とす)。三段リーグはすべて平手。研修会員どうしも同じ決まりを使う(実物の表は見つけていない)。
// 画面・保存の仕組みに依存しない。組み合わせごとの前の手合いは、呼ぶ側が持つ表(memory)に書く。

/** 手合いの名前。 */
export const TEAI_LABELS = Object.freeze({ hirate: '平手', lance: '香落ち' });
/** 段級の差ごとの手合いの決め方。 */
export const TEAI_RULES = Object.freeze({ same: 'hirate', one: 'hanko', more: 'lance' });
/** 平香交じりの呼び名。 */
export const HANKO_LABEL = '平香交じり';
/** 香落ちの下手の、結果だけの局での強さの上乗せ(レーティング相当。初期値。36-4)。 */
export const TEAI_RATING = 90;

/** 2人の組み合わせの鍵(順番によらない)。 */
export const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * 段級の差から決まる手合いの種類。
 * @param {number} diff 2人の段級(クラス)の差
 * @returns {'hirate' | 'hanko' | 'lance'}
 */
export function teaiRule(diff) {
  const gap = Math.abs(Math.round(Number(diff) || 0));
  if (gap === 0) return /** @type {'hirate'} */ (TEAI_RULES.same);
  if (gap === 1) return /** @type {'hanko'} */ (TEAI_RULES.one);
  return /** @type {'lance'} */ (TEAI_RULES.more);
}

/**
 * 次の1局の手合いを決め、組み合わせの表に書く。
 * 平手は、その組み合わせのはじめは振り駒、次からは前の局と先後を入れ替える。
 * 平香交じりは、はじめは平手、次は香落ち、と交互(平手の局の先後も交互)。
 * 香落ちは、上位者(上手)が左香を落とし、下手が先手の側に座る(指すのは上手が先)。
 * @param {{ a: { id: string, rank: number }, b: { id: string, rank: number }, memory: Record<string, any>, rng: { next(): number } }} input
 *   rankは段級(クラス)の高さ(大きいほど上)。memoryは呼ぶ側が持つ表(書き換える)。
 * @returns {{ teai: 'hirate' | 'lance', rule: 'hirate' | 'hanko' | 'lance', black: string, giver: string | null, label: string }}
 *   blackは先手の側に座る人、giverは香を落とす人(上手)。
 */
export function nextTeai({ a, b, memory, rng }) {
  const rule = teaiRule(a.rank - b.rank);
  const key = pairKey(a.id, b.id);
  const last = memory[key] ?? null;
  const upper = a.rank > b.rank ? a : b;
  const lower = upper === a ? b : a;
  /** @type {'hirate' | 'lance'} */
  let teai = 'hirate';
  if (rule === 'lance') teai = 'lance';
  else if (rule === 'hanko') teai = last?.teai === 'hirate' ? 'lance' : 'hirate';
  let black;
  let giver = null;
  if (teai === 'lance') {
    black = lower.id;
    giver = upper.id;
  } else {
    // 平手の先後: 前の平手の局と入れ替える。はじめは振り駒。
    const lastBlack = last?.hirateBlack ?? null;
    if (lastBlack === a.id) black = b.id;
    else if (lastBlack === b.id) black = a.id;
    else black = rng.next() < 0.5 ? a.id : b.id;
  }
  memory[key] = { teai, hirateBlack: teai === 'hirate' ? black : last?.hirateBlack ?? null };
  return { teai, rule, black, giver, label: TEAI_LABELS[teai] };
}

/**
 * 結果だけの局のために、2人のレーティングに手合いのぶんを足す(香落ちの下手に+TEAI_RATING)。
 * @param {{ teai: string, giver: string | null }} decided
 * @param {string} id
 */
export function teaiRatingBonus(decided, id) {
  if (decided?.teai !== 'lance' || !decided.giver) return 0;
  return decided.giver === id ? 0 : TEAI_RATING;
}

/**
 * 手合いの短い言葉(対戦表の札)。「平手」「香落ち（湊が下手）」。
 * @param {{ teai: string, giver: string | null, black: string }} decided
 * @param {(id: string) => string} nameOf
 */
export function teaiText(decided, nameOf) {
  if (!decided) return '';
  if (decided.teai === 'lance') {
    const lower = decided.black;
    return `香落ち（${nameOf(lower)}が下手）`;
  }
  return `平手（${nameOf(decided.black)}の先）`;
}
