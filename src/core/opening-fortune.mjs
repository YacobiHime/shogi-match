/**
 * 戦法占い(YES/NOチャート)。3つの質問に答えると、初心者が指しやすい8つの作戦カードのどれかに着く
 * (docs/opening-guide-ux-design.mdの7章)。8つの結果は2の3乗なので、どの道も3問で終わる(遅さは罪。D:3-3)。
 * 画面から独立した純粋な処理にする。
 */

/** 占いで出る作戦カード(opening-catalog.mjsのid)。 */
export const FORTUNE_PLAN_IDS = Object.freeze([
  "bougin", "hayaguri-gin", "koshikake-gin", "yagura", "shiken", "sangen", "nakabisha", "mukai",
]);

/** 占いで出た作戦。まだ使えない段の作戦でも、出たらその場で使えるようにする(占いのごほうび)。 */
export const OPENING_FORTUNE_KEY = "yacobihime:shogi-match:opening-fortune:v1";

/**
 * @typedef {{ label: string, next?: string, result?: string }} FortuneAnswer
 * @typedef {{ id: string, question: string, answers: readonly [FortuneAnswer, FortuneAnswer] }} FortuneNode
 */

/** 質問の木。答えは「はい・いいえ」ではなく、何を選んだかが分かる言葉にする(U実装:8)。 */
/** @type {Readonly<{ [id: string]: FortuneNode }>} */
export const FORTUNE_NODES = Object.freeze({
  rook: {
    id: "rook",
    question: "飛車を横に動かして、戦ってみたい？",
    answers: [
      { label: "動かしてみたい！", next: "ranging" },
      { label: "動かさずに戦う", next: "static" },
    ],
  },
  static: {
    id: "static",
    question: "相手より先に、攻めたい？",
    answers: [
      { label: "先に攻めたい！", next: "static-attack" },
      { label: "準備してから", next: "static-build" },
    ],
  },
  "static-attack": {
    id: "static-attack",
    question: "好きな攻め方は？",
    answers: [
      { label: "まっすぐ一直線！", result: "bougin" },
      { label: "とにかく速く！", result: "hayaguri-gin" },
    ],
  },
  "static-build": {
    id: "static-build",
    question: "先に作りたいのは？",
    answers: [
      { label: "がっちりした守り", result: "yagura" },
      { label: "どっしりした攻めの土台", result: "koshikake-gin" },
    ],
  },
  ranging: {
    id: "ranging",
    question: "相手の攻めを受け止めるのは好き？",
    answers: [
      { label: "受け止めて反撃！", next: "ranging-defense" },
      { label: "自分から攻めたい", next: "ranging-attack" },
    ],
  },
  "ranging-defense": {
    id: "ranging-defense",
    question: "まずは定番の形から覚えたい？",
    answers: [
      { label: "定番から！", result: "shiken" },
      { label: "ちょっと変わった形も", result: "sangen" },
    ],
  },
  "ranging-attack": {
    id: "ranging-attack",
    question: "どこから攻めたい？",
    answers: [
      { label: "ど真ん中から！", result: "nakabisha" },
      { label: "相手の飛車の正面から", result: "mukai" },
    ],
  },
});

export const FORTUNE_ROOT = "rook";

/** 結果のやこび姫の一言。「君は◯◯タイプ！」と言い切り、なぜ合うかを1文で添える(D:5-8 情報として伝える)。 */
export const FORTUNE_RESULTS = Object.freeze({
  bougin: { type: "棒銀タイプ", line: "まっすぐ攻めるのが好きな君には、銀を前に出して2筋を突破する棒銀がぴったり！" },
  "hayaguri-gin": { type: "早繰り銀タイプ", line: "スピード勝負が好きな君には、右の銀を素早く4六へ出す早繰り銀がぴったり！" },
  "koshikake-gin": { type: "腰掛け銀タイプ", line: "攻めの土台をどっしり作りたい君には、銀を5六に座らせる腰掛け銀がぴったり！" },
  yagura: { type: "矢倉タイプ", line: "玉をがっちり守ってから戦いたい君には、居飛車の王道の矢倉がぴったり！" },
  shiken: { type: "四間飛車タイプ", line: "受けてさばくのが好きな君には、振り飛車の基本の四間飛車がぴったり！" },
  sangen: { type: "三間飛車タイプ", line: "受けてから反撃したい、ちょっと変わった形も好きな君には、三間飛車がぴったり！" },
  nakabisha: { type: "中飛車タイプ", line: "ど真ん中から力強く攻めたい君には、中飛車がぴったり！" },
  mukai: { type: "向かい飛車タイプ", line: "相手の攻めを逆手に取りたい君には、相手の飛車と向かい合う向かい飛車がぴったり！" },
});

/**
 * 答えの並び(0か1)をたどる。nodeはまだ答えていない質問(結果に着いたらnull)。
 * @param {readonly number[]} answers
 * @returns {{ node: FortuneNode | null, path: { nodeId: string, question: string, answer: string, index: number }[], result: string }}
 */
export function walkFortune(answers = []) {
  /** @type {{ nodeId: string, question: string, answer: string, index: number }[]} */
  const path = [];
  let node = FORTUNE_NODES[FORTUNE_ROOT];
  for (const index of answers) {
    const answer = node.answers[index];
    if (!answer) break;
    path.push({ nodeId: node.id, question: node.question, answer: answer.label, index });
    if (answer.result) return { node: null, path, result: answer.result };
    node = FORTUNE_NODES[answer.next ?? ""];
    if (!node) break;
  }
  return { node: node ?? null, path, result: "" };
}

/**
 * 木の図の配置。結果を左から右へ並べ、質問はその子の真ん中に置く(あみだくじのように上から下へ道が分かれる)。
 * @returns {{ nodes: { id: string, depth: number, x: number }[], leaves: { planId: string, x: number, parent: string, index: number }[], edges: { from: string, to: string, index: number }[], depth: number }}
 */
export function fortuneLayout() {
  /** @type {{ id: string, depth: number, x: number }[]} */
  const nodes = [];
  /** @type {{ planId: string, x: number, parent: string, index: number }[]} */
  const leaves = [];
  /** @type {{ from: string, to: string, index: number }[]} */
  const edges = [];
  let maxDepth = 0;
  const place = (id, depth) => {
    const node = FORTUNE_NODES[id];
    maxDepth = Math.max(maxDepth, depth + 1);
    const xs = node.answers.map((answer, index) => {
      if (answer.result) {
        const x = leaves.length;
        leaves.push({ planId: answer.result, x, parent: id, index });
        return x;
      }
      edges.push({ from: id, to: answer.next ?? "", index });
      return place(answer.next ?? "", depth + 1);
    });
    const x = (xs[0] + xs[1]) / 2;
    nodes.push({ id, depth, x });
    return x;
  };
  place(FORTUNE_ROOT, 0);
  return { nodes, leaves, edges, depth: maxDepth };
}

/** 占いで出た作戦のid(古い順)。読めない環境では空。 */
export function loadFortunePlans(storage) {
  try {
    const value = JSON.parse(storage?.getItem(OPENING_FORTUNE_KEY) ?? "null");
    return Array.isArray(value?.plans) ? value.plans.filter((id) => FORTUNE_PLAN_IDS.includes(id)) : [];
  } catch {
    return [];
  }
}

/** 占いの結果を残す。同じ作戦は1つにまとめる。 */
export function recordFortunePlan(storage, planId) {
  const plans = [...new Set([...loadFortunePlans(storage), planId])].filter((id) => FORTUNE_PLAN_IDS.includes(id));
  try {
    storage?.setItem(OPENING_FORTUNE_KEY, JSON.stringify({ plans, last: planId }));
  } catch {
    // 保存できない環境では、この画面のあいだだけ使える。
  }
  return plans;
}
