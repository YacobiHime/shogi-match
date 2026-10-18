/**
 * やこび姫補助の「作戦カード」の目録(docs/opening-guide-ux-design.md)。
 * 1枚のカードは「戦法」と「その戦法に合う囲い」の組。手順と完成の判定はopening-guide.mjsのまま使い、
 * ここには、選ぶための情報(群・解放の段・札・難しさ・合う囲い)だけを書く。対局画面から読むので軽く保つ。
 *
 * - group: static 居飛車で攻める / ranging 振り飛車で受ける / surprise びっくり作戦 / castle 囲いだけ
 * - tier: entry 入門(最初から) / basic 基本 / advanced 応用 / surprise びっくり作戦(解放の段。opening-unlocks.mjs)
 * - style: attack 攻め / defense 受け / counter カウンター
 * - difficulty: 1〜3(★の数)
 * - castles: 合う囲いのid。最初が◎(いちばん合う)、残りが○。解説(opening-explanations.mjs)の「相性の良い囲い」から起こし、
 *   テストで、戦法だけなら完成局面まで指せる戦法について、すべての組も先手・後手で指せることを確かめる
 *   (相手の応手しだいの戦法は、相手を待たせて指し進める確かめ方ができないため)。指せない組は書かない。
 * - name: カードの名前。省くと戦法の名前(囲いだけのカードは囲いの名前)。
 * - explanation: くわしい画面の解説(opening-explanations.mjs)のid。省くと戦法のid(囲いだけのカードは囲いのid)。
 */

export const OPENING_PLAN_GROUPS = Object.freeze([
  Object.freeze({ id: "static", label: "居飛車で攻める" }),
  Object.freeze({ id: "ranging", label: "振り飛車で受ける" }),
  Object.freeze({ id: "surprise", label: "びっくり作戦" }),
  Object.freeze({ id: "castle", label: "囲いだけを組む" }),
]);

export const OPENING_PLAN_TIERS = Object.freeze([
  Object.freeze({ id: "entry", label: "入門" }),
  Object.freeze({ id: "basic", label: "基本" }),
  Object.freeze({ id: "advanced", label: "応用" }),
  Object.freeze({ id: "surprise", label: "びっくり作戦" }),
]);

export const OPENING_STYLE_LABELS = Object.freeze({ attack: "攻め", defense: "受け", counter: "カウンター" });

/** @typedef {{ id: string, strategyId: string, castles: string[], group: string, tier: string, style: string, difficulty: number, name?: string, catch?: string, explanation?: string }} OpeningPlan */

const plan = (id, strategyId, castles, group, tier, style, difficulty, extra = {}) => Object.freeze({
  id, strategyId, castles: Object.freeze(castles), group, tier, style, difficulty, ...extra,
});

/** @type {readonly OpeningPlan[]} */
export const OPENING_PLANS = Object.freeze([
  // ===== 居飛車で攻める =====
  plan("bougin", "bougin", ["nakazumai", "kanigakoi"], "static", "entry", "attack", 1),
  plan("ibisha", "ibisha", ["funagakoi", "yagura", "gangi"], "static", "basic", "attack", 1),
  plan("hayaguri-gin", "hayaguri-gin", ["yagura", "nakazumai"], "static", "basic", "attack", 2),
  plan("koshikake-gin", "koshikake-gin", ["yagura"], "static", "basic", "attack", 2),
  // 矢倉は、居飛車(飛車先の歩交換)と金矢倉の組。矢倉戦法の定義はやこび姫補助で選べないため、この組で目指す。
  plan("yagura", "ibisha", ["yagura"], "static", "basic", "defense", 2, {
    name: "矢倉",
    explanation: "yagura-strategy",
    catch: "金銀を玉の上に積み上げて、堅く囲ってから攻める居飛車の王道だよ！",
  }),
  plan("right-shiken", "right-shiken", ["elmo", "funagakoi", "left-mino"], "static", "advanced", "attack", 2),
  plan("kakugawari", "kakugawari", ["nakazumai"], "static", "advanced", "attack", 3),
  plan("kakugawari-koshikake-gin", "kakugawari-koshikake-gin", [], "static", "advanced", "attack", 3),
  plan("kakugawari-45-knight", "kakugawari-45-knight", ["nakazumai"], "static", "advanced", "attack", 3),
  plan("aigakari", "aigakari", ["nakazumai"], "static", "advanced", "attack", 3),
  plan("hineribisha", "hineribisha", ["nakazumai"], "static", "advanced", "attack", 3),
  plan("yokofudori-33-bishop", "yokofudori-33-bishop", ["nakazumai", "nakahara"], "static", "advanced", "attack", 3),
  plan("aono-ryu", "aono-ryu", ["nakazumai"], "static", "advanced", "attack", 3),
  plan("yagura-37-silver", "yagura-37-silver", [], "static", "advanced", "attack", 3),
  plan("suzume-zashi", "suzume-zashi", [], "static", "advanced", "attack", 3),
  plan("morishita-system", "morishita-system", [], "static", "advanced", "defense", 3),
  plan("gangi-right-shiken", "gangi-right-shiken", [], "static", "advanced", "attack", 3),
  plan("right-shiken-elmo", "right-shiken-elmo", [], "static", "advanced", "attack", 2),
  plan("sodebisha", "sodebisha", ["funagakoi", "elmo"], "static", "advanced", "attack", 2),
  plan("chikatetsu-bisha", "chikatetsu-bisha", [], "static", "advanced", "attack", 3),
  plan("torizashi", "torizashi", [], "static", "advanced", "attack", 2),
  // ===== 振り飛車で受ける =====
  plan("shiken", "shiken", ["mino", "high-mino", "silver-crown", "furibisha-anaguma"], "ranging", "entry", "defense", 1),
  plan("nakabisha", "nakabisha", ["half-mino", "mino"], "ranging", "entry", "attack", 1),
  plan("sangen", "sangen", ["mino", "high-mino", "furibisha-anaguma"], "ranging", "basic", "defense", 1),
  plan("mukai", "mukai", ["mino", "kinmusou", "furibisha-anaguma"], "ranging", "basic", "counter", 2),
  plan("gokigen", "gokigen", ["mino", "high-mino"], "ranging", "advanced", "attack", 2),
  plan("ishida", "ishida", ["mino", "kinmusou"], "ranging", "advanced", "attack", 2),
  plan("fujii-system", "fujii-system", [], "ranging", "advanced", "attack", 3),
  plan("yababozu", "yababozu", ["osumi"], "ranging", "advanced", "counter", 3),
  plan("first-78-rook", "first-78-rook", ["mino", "kinmusou"], "ranging", "advanced", "attack", 2),
  plan("second-32-rook", "second-32-rook", ["mino", "kinmusou"], "ranging", "advanced", "attack", 2),
  // ===== びっくり作戦(奇襲) =====
  plan("onigoroshi", "onigoroshi", ["mino", "kinmusou"], "surprise", "surprise", "attack", 1),
  plan("shin-onigoroshi", "shin-onigoroshi", ["mino", "kinmusou"], "surprise", "surprise", "attack", 2),
  plan("sujichigai-kaku", "sujichigai-kaku", ["nakazumai"], "surprise", "surprise", "attack", 2),
  plan("kakuto-fu", "kakuto-fu", ["nakazumai"], "surprise", "surprise", "counter", 2),
  plan("hashikaku-nakabisha", "hashikaku-nakabisha", ["mino", "half-mino"], "surprise", "surprise", "attack", 2),
  plan("pacman", "pacman", ["mino", "kinmusou"], "surprise", "surprise", "counter", 2),
  plan("ahiru", "ahiru", [], "surprise", "surprise", "counter", 2),
  plan("ureshino", "ureshino", [], "surprise", "surprise", "attack", 2),
]);

/** 囲いだけのカードにする囲い(応用の段で使えるようになる)。戦法と一体の囲い(右玉)は戦法のカードとして扱わない。 */
export const OPENING_CASTLE_PLAN_IDS = Object.freeze([
  "funagakoi", "yagura", "mino", "half-mino", "high-mino", "silver-crown",
  "ibisha-anaguma", "left-mino", "elmo", "gangi", "nakazumai", "kinmusou", "kanigakoi",
  "early-castle", "doi-yagura", "tenshukaku-mino", "matsuo-anaguma",
  "hakoiri-musume", "osumi", "nakahara", "bonanza", "millennium", "furibisha-elmo", "half-kinmusou",
]);

/**
 * 囲いだけのカード。idは`castle:<囲いのid>`。
 * @type {readonly OpeningPlan[]}
 */
export const OPENING_CASTLE_PLANS = Object.freeze(OPENING_CASTLE_PLAN_IDS.map((castleId) => Object.freeze({
  id: `castle:${castleId}`,
  strategyId: "",
  castles: Object.freeze([castleId]),
  group: "castle",
  tier: "advanced",
  style: "defense",
  difficulty: 2,
})));

/** @type {readonly OpeningPlan[]} */
export const ALL_OPENING_PLANS = Object.freeze([...OPENING_PLANS, ...OPENING_CASTLE_PLANS]);

export function openingPlanById(id) {
  return ALL_OPENING_PLANS.find((entry) => entry.id === id) ?? null;
}

/** 戦法と囲いの組から、いちばん近いカード。選び方が古い(戦法と囲いを別々に選んだ)保存の復元に使う。 */
export function openingPlanFor(strategyId, castleId = "") {
  if (strategyId) {
    return OPENING_PLANS.find((entry) => entry.strategyId === strategyId && entry.castles[0] === castleId)
      ?? OPENING_PLANS.find((entry) => entry.strategyId === strategyId && !entry.name)
      ?? null;
  }
  return castleId ? openingPlanById(`castle:${castleId}`) : null;
}

/** 戦法のカードの、教室の第4巻の練習レッスン(終えるとその作戦が使えるようになる)。 */
export const OPENING_PLAN_LESSONS = Object.freeze({
  shiken: "v4-shiken",
  sangen: "v4-sangen",
  nakabisha: "v4-nakabisha",
  mukai: "v4-mukai",
  bougin: "v4-bougin",
  "hayaguri-gin": "v4-hayaguri",
  "koshikake-gin": "v4-koshikake",
  yagura: "v4-yagura",
});
