import { appendUsiMove, createGameRecord, enumerateLegalMoves } from "../game-state";
import { TSUME_PROBLEMS } from "../data/tsume-problems.mjs";
import { ZUKOU_PROBLEMS } from "../data/zukou-problems.mjs";
import { formatHintMove } from "./match-assists.mjs";
import { analyzeProblem, findEscapeReply } from "./problem-solver";

/**
 * やこび姫の将棋問題集。詰ませる問題と、王手から逃げる問題を出す。
 * 正解は問題に書かず、problem-solver.tsの詰み探索で合法手をすべて調べて決める。
 * 問題に書くのは、局面・種類・探索の深さと、やこび姫の出題・解説・ヒントの台詞だけ。
 * 局面には、詰将棋と同じく攻め方の玉を置かなくてよい。
 *
 * 自分の手が2回以上ある問題では、正解のたびに相手が応じ、プレイヤーは次の手も盤で指す。
 * - 詰ませる問題: 相手は最も長く逃れる応手を指す。残りの深さは、正解のたびに2手ずつ減る。
 * - 逃げる問題: 正解のあと、相手はrepliesに書いた王手を指す。repliesを指し終えたら正解。
 * repliesには、正解のたびに相手が指す手を順に書く（正解ではなく、相手の手の好み）。
 * 詰ませる問題では、探索で最も長く逃れる応手の1つと確かめられたときだけ使う。
 *
 * 逃げる問題は、正解のあとも、なぜ詰まないのかが分かるところまで指す（続きの1手）。
 * 相手は、まちがえた逃げ方なら詰んでいた王手を指し、プレイヤーはもう一度逃げる。
 *
 * 問題集は「練習問題」「詰め将棋」「詰将棋図巧」の3区分。練習問題（PROBLEMS）だけが上の探索で正解を決める。
 * 詰め将棋（src/data/tsume-problems.mjs）と図巧（src/data/zukou-problems.mjs）は外部データの手順（kind: "line"）で判定する。
 * - 長い図巧はブラウザの探索では読み切れないため、データ作成側が検証した手順を正とする。
 * - 詰め将棋は7手詰め以下で余詰めがない（攻め方の正解が各手で1つ）問題だけを選んでいる。
 * - どちらも、最後の1手は詰ませる手ならどれでも正解にする。
 */

/** 続きの1手で、相手の王手の候補として調べる数の上限（探索で画面を止めすぎないため）。 */
const FOLLOW_UP_CHECK_LIMIT = 12;

export const PROBLEM_SET_TITLE = "やこび姫の将棋問題集";

export const PROBLEMS = Object.freeze([
  {
    id: "head-gold-or-silver",
    kind: "mate",
    // 1手詰め。
    depth: 1,
    title: "金と銀、どっちで詰ます？",
    sfen: "4k4/9/4P4/9/9/9/9/9/9 b GS 1",
    question: "後手玉を詰ますには、金銀どちらを使うかな？ 1手で詰ませてみよう！",
    hint: "玉の真上（5二）に打つと、どうなるかな？ 金と銀の動ける方向を比べてみてね。",
    hintSquare: "5b",
    explanation: "金は真横にも動けるから、玉の逃げ道の4二と6二もふさげるんだ。5三の歩が金を守っているから、玉は金を取れないよ。玉の頭に金を打つこの形を「頭金」というよ！",
  },
  {
    id: "escape-from-gold",
    kind: "escape",
    // 逃げたあと、相手に3手以内の詰みがないか調べる。
    depth: 3,
    title: "どこへ逃げる？",
    sfen: "9/9/9/9/9/4s4/4g4/2G1K1S2/9 b g 1",
    question: "5七の金で王手をかけられちゃった！ 相手は持ち駒に金を持っているよ。どこへ逃げたら詰まないかな？",
    hint: "玉は6九・5九・4九のどこかへ逃げるしかないよ。逃げた先で金を打たれたとき、味方の駒が助けてくれるのはどこかな？",
    hintSquare: "7h",
    explanation: "6九なら、5八に金を打たれても7九へ逃げられるし、6八に打たれたら7八の金で取れるんだ。困ったときは、味方の駒がいる方へ逃げるのが基本だよ！",
  },
  {
    id: "escape-twice",
    kind: "escape",
    // 逃げたあと、相手に3手以内の詰みがないか調べる。正解のあと、相手は4七に金を打って王手する。
    depth: 3,
    replies: ["G*4g"],
    title: "金2枚から逃げきれ！",
    sfen: "9/9/9/9/4s4/4g4/4K4/1S5G1/9 b 2g 1",
    question: "5六の金で王手！ 相手は持ち駒に金を2枚持っているよ。どのように逃げる？",
    hint: "5六の金は銀に守られているから取れないね。逃げた先で金を打たれても、味方の駒が助けてくれるのはどっちの方向かな？",
    hintSquare: "2h",
    explanation: "4八から3九へ逃げておけば、4八に金を打たれても2九へ逃げられるし、3八に打たれたら2八の金で取れるんだ。何回王手されても、味方の金の近くへ逃げるのが正解だったね！",
  },
  {
    id: "block-with-pawn",
    kind: "escape",
    depth: 3,
    title: "投了するしかない？",
    sfen: "9/9/9/1rb6/P8/K1P6/L8/9/9 b P 1",
    question: "7四の角で王手！ 逃げ道は無いよ、どうする？ 投了するしかないのかな？",
    hint: "玉が動けないときは、王手している駒と玉の間に駒を打って、王手をさえぎる方法があるよ。持ち駒をよく見てね。",
    hintSquare: "8e",
    explanation: "角と玉の間に歩を打って、王手をさえぎったよ。このように間に駒を打つことを「合駒」というんだ。歩を角に取られても、今度はその角が8四の飛車の利きを止めるから、玉は8六や8七へ逃げられるよ。逃げ道が無くても、すぐにあきらめないでね！",
  },
  {
    id: "take-knight-and-drop",
    kind: "mate",
    // 3手詰め。
    depth: 3,
    replies: ["3b3c"],
    title: "取った桂をすぐ使おう",
    sfen: "3gkg3/6s2/2s1+Ppn2/9/4B4/9/9/9/9 b 2rb2g2s3n4l16p 1",
    question: "後手玉は3手で詰むよ！ 最初の一手を考えてみよう。",
    hint: "5五の角で、3三の桂を取って王手できるね。取った桂は、あとでどこに打てるかな？",
    hintSquare: "3c",
    explanation: "角で3三の桂を取って王手し、取り返されたら、手に入れた桂を6三に打って詰みだよ。5三のとが、玉の逃げ道の4二・5二・6二をふさいでいたんだ。取った駒をすぐに使うのが、詰ませるコツだよ！",
  },
  {
    id: "where-to-drop-bishop",
    kind: "mate",
    depth: 3,
    replies: ["1a1b"],
    title: "角をどこに打つ？",
    sfen: "8k/9/7P1/9/6s2/9/9/9/9 b Br4g3s4n4l17p 1",
    question: "角をどこに打てば詰むかな？ 3手で詰ませてみよう！",
    hint: "遠くから角を打つと、3五の銀に間に入られたり、取られたりするよ。銀が届かない場所はどこかな？",
    hintSquare: "3c",
    explanation: "3三に角を打てば、3五の銀は届かないね。玉が逃げたら、2二で角を成って馬にすれば詰みだよ。2三の歩が馬を守っているんだ！",
  },
  {
    id: "two-rooks",
    kind: "mate",
    depth: 3,
    replies: ["3b4a"],
    title: "二枚飛車で討ち取れ！",
    sfen: "1R3gknl/1R4s2/5p1pp/6p2/9/9/9/9/9 b 2b3g3s3n3l14p 1",
    question: "飛車が二枚で攻めているね。これを二枚飛車というよ。一気に3手詰めで討ち取ろう！",
    hint: "まずは8一の飛車で、4一の金を取ってみよう。取った金は、玉のすぐ近くに打てるよ。",
    hintSquare: "4a",
    explanation: "4一の金を飛車で取って成り、取り返されたら、その金を2二に打って詰みだよ。8二の飛車が横から2二の金を守っているんだ。二枚飛車は横の利きがとっても強いね！",
  },
  {
    id: "rook-and-bishop",
    kind: "mate",
    depth: 3,
    title: "飛車と角の連携",
    sfen: "8k/9/7p1/9/8B/9/9/8R/9 b rb4g4s4n4l17p 1",
    question: "飛車と角で、3手で詰まそう！",
    hint: "1五の角が動くと、1八の飛車の利きが玉まで通るね。角と飛車の両方で王手できる場所はどこかな？",
    hintSquare: "3c",
    explanation: "角が3三で成ると、馬と飛車の両方で王手する「両王手」になるよ。両王手は間に駒を打っても防げないから、玉は逃げるしかないんだ。最後は飛車を1一で成って詰みだよ！",
  },
  {
    id: "kings-face-to-face",
    kind: "mate",
    depth: 3,
    title: "玉と玉が近いとき",
    sfen: "6r2/7k1/6+B2/9/6K2/9/9/9/9 b Gr2b3g4s4n4l18p 1",
    question: "互いの玉が近くにいるね。詰ましてみよう！",
    hint: "金を打つなら、3三の馬が守ってくれる場所がいいね。玉が逃げたら、その金をもう一度動かしてみよう。",
    hintSquare: "2c",
    explanation: "2三に金を打って王手し、玉が2一へ逃げたら、金を2二へ寄って詰みだよ。2三でも2二でも、金は3三の馬に守られているから、玉は取れないんだ！",
  },
  {
    id: "mate-over-rook",
    kind: "mate",
    depth: 1,
    title: "飛車を取る？",
    sfen: "6gnk/1r5sl/9/6ppp/4B4/9/9/9/9 b N 1",
    question: "飛車は取れるけど、それでいいのかな？ もっと良い手は無い？",
    hint: "持ち駒の桂を打って王手できる場所があるよ。2二の銀は、本当に動けるかな？",
    hintSquare: "2c",
    explanation: "2三に桂を打てば詰みだよ！ 2二の銀で桂を取ると、5五の角の利きが玉まで通ってしまうから、銀は動けないんだ。駒を取るより、詰ませるほうがずっと大事だね！",
  },
]);

/** 手順で判定する問題を作る。lineは作意手順（USI）、pliesは手数。 */
function lineProblem({ id, source, title, sfen, line, number }) {
  const moves = line.split(" ");
  return Object.freeze({ id, kind: "line", source, title, sfen, line: Object.freeze(moves), plies: moves.length, number });
}

/** 詰め将棋。手数ごとに、データの並び（やさしい順）で番号を振る。 */
export const TSUME_SET = Object.freeze(TSUME_PROBLEMS.map((entry, index, list) => {
  const plies = entry.line.split(" ").length;
  const number = list.slice(0, index + 1).filter((other) => other.line.split(" ").length === plies).length;
  return lineProblem({ ...entry, source: "tsume", title: `${plies}手詰め 第${number}問`, number });
}));

/**
 * 図巧のうち、名前で呼ばれている作品。図巧の各番には題名がなく、通称があるのは一部だけ。
 * 第94・98・99・100番はWikipedia「将棋図巧」、第6番は「ネコ印 二百科事典 有名な詰将棋作品」による（2026-10-07確認）。
 * 第97番の「実戦初形」は駒の配置の説明なので、名前には入れない。
 */
export const ZUKOU_NICKNAMES = Object.freeze({
  6: "朝霧",
  94: "襷詰",
  98: "裸玉",
  99: "煙詰",
  100: "寿",
});

/** 詰将棋図巧。原典の番号順（第1番〜第100番）に並べ、通称のある作品は『』で添える。 */
export const ZUKOU_SET = Object.freeze(ZUKOU_PROBLEMS
  .map((entry) => lineProblem({
    ...entry,
    id: `zukou-${String(entry.number).padStart(3, "0")}`,
    source: "zukou",
    title: `第${entry.number}番${ZUKOU_NICKNAMES[entry.number] ? `『${ZUKOU_NICKNAMES[entry.number]}』` : ""}（${entry.line.split(" ").length}手）`,
  }))
  .sort((a, b) => a.number - b.number));

/** 問題集の区分。groupsは一覧の見出しごとのまとまり。 */
export const PROBLEM_SECTIONS = Object.freeze([
  { id: "practice", label: "練習問題", groups: [{ label: "", problems: PROBLEMS }] },
  {
    id: "tsume",
    label: "詰め将棋",
    groups: [1, 3, 5, 7].map((plies) => ({
      label: `${plies}手詰め`,
      problems: TSUME_SET.filter((problem) => problem.plies === plies),
    })),
  },
  { id: "zukou", label: "詰将棋図巧", groups: [{ label: "", problems: ZUKOU_SET }] },
]);

/** 区分の問題を、一覧の順に並べる。 */
export function sectionProblems(sectionId) {
  return PROBLEM_SECTIONS.find(({ id }) => id === sectionId)?.groups.flatMap(({ problems }) => problems) ?? [];
}

/** 問題が属する区分。 */
export function problemSectionId(problem) {
  if (problem?.kind !== "line") return "practice";
  return problem.source;
}

export function problemById(id) {
  return PROBLEMS.find((problem) => problem.id === id)
    ?? TSUME_SET.find((problem) => problem.id === id)
    ?? ZUKOU_SET.find((problem) => problem.id === id)
    ?? null;
}

/** step回正解したあとの、探索の深さ。 */
function stepDepth(problem, step) {
  return problem.kind === "mate" ? problem.depth - 2 * step : problem.depth;
}

/**
 * 問題の局面（step回正解したあとの局面sfen）の合法手をすべて判定する。
 * 結果は局面ごとに覚えておく（問題の局面は変わらないため）。
 */
const analysisCache = new Map();
export function problemAnalysis(problem, sfen = problem.sfen, step = 0) {
  const key = `${problem.id}|${step}|${sfen}`;
  if (!analysisCache.has(key)) {
    analysisCache.set(key, analyzeProblem({ sfen, kind: problem.kind, depth: stepDepth(problem, step) }));
  }
  return analysisCache.get(key);
}

/** 正解の手。 */
export function problemAnswers(problem, sfen = problem.sfen, step = 0) {
  return problemAnalysis(problem, sfen, step).verdicts.filter(({ correct }) => correct).map(({ usi }) => usi);
}

/** 手順を指し進めた局面。指せない手があればnull。 */
function positionAfter(sfen, line) {
  const record = createGameRecord(sfen);
  for (const usi of line) {
    if (!appendUsiMove(record, usi)) return null;
  }
  return record.position;
}

/**
 * 正解のあとに相手が指す手。なければnull（そこで問題は終わり）。
 * - 詰ませる問題: repliesの手が最も長く逃れる応手の1つならそれを、違えば探索で見つけた応手を指す。
 * - 逃げる問題: repliesの手が王手になるときだけ指す。
 */
function opponentReply(problem, sfen, step, verdict) {
  const preferred = problem.replies?.[step];
  if (problem.kind === "mate") {
    if (verdict.line.length < 2) return null;
    const after = preferred ? positionAfter(sfen, [verdict.usi, preferred]) : null;
    if (after) {
      const lengths = problemAnalysis(problem, after.sfen, step + 1).verdicts
        .filter(({ correct }) => correct)
        .map(({ line }) => line.length);
      if (lengths.length && Math.min(...lengths) === verdict.line.length - 2) return preferred;
    }
    return verdict.line[1];
  }
  if (preferred) return positionAfter(sfen, [verdict.usi, preferred])?.checked ? preferred : null;
  return isAnswerStep(problem, step) ? followUpCheck(problem, sfen, step, verdict) : null;
}

/** 逃げる問題で、repliesを指し終えて答えが決まる手番か。このあとに続きの1手がある。 */
function isAnswerStep(problem, step) {
  return problem.kind === "escape" && step === (problem.replies?.length ?? 0);
}

/**
 * 逃げる問題の答えのあと、なぜ詰まないのかを見せるために相手が指す王手。
 * まちがえた逃げ方を詰ませていた王手を優先し、なければ逃げ方が最も少ない王手を選ぶ。
 * どちらも、プレイヤーに詰まない逃げ方が残る王手に限る。
 */
function followUpCheck(problem, sfen, step, verdict) {
  const position = positionAfter(sfen, [verdict.usi]);
  if (!position) return null;
  const threats = problemAnalysis(problem, sfen, step).verdicts
    .filter(({ reason }) => reason === "mated")
    .map(({ line }) => line[1]);
  const checks = enumerateLegalMoves(position)
    .map(({ usi }) => usi)
    .filter((usi) => positionAfter(position.sfen, [usi])?.checked)
    .sort((a, b) => Number(threats.includes(b)) - Number(threats.includes(a)))
    .slice(0, FOLLOW_UP_CHECK_LIMIT);
  let best = null;
  for (const usi of checks) {
    const { verdicts, exhausted } = problemAnalysis(problem, positionAfter(position.sfen, [usi]).sfen, step + 1);
    const safe = verdicts.filter(({ correct }) => correct).length;
    if (exhausted || safe === 0) continue;
    const candidate = { usi, threat: threats.includes(usi), safe };
    if (!best || Number(candidate.threat) > Number(best.threat) || (candidate.threat === best.threat && safe < best.safe)) best = candidate;
  }
  return best?.usi ?? null;
}

/** 手順を指し進めた局面の列。sfens[i]はline[i]を指す前の局面。 */
export function lineSfens(sfen, line) {
  const record = createGameRecord(sfen);
  const sfens = [record.position.sfen];
  for (const usi of line) {
    if (!appendUsiMove(record, usi)) break;
    sfens.push(record.position.sfen);
  }
  return sfens;
}

function moveLabels(sfen, line) {
  const sfens = lineSfens(sfen, line);
  return line.map((usi, index) => formatHintMove(usi, sfens[index]));
}

/**
 * 指した手の判定と、やこび姫の台詞。sfenはstep回正解したあとの局面。
 * lineは盤に並べる手順（指した手と、相手の応手や詰み手順）。
 * 正解でも問題が続くときは、lineの最後が相手の応手で、nextの局面から次の手を指す。
 * solvedは、この手で問題に正解したか（逃げる問題では、このあとに続きの1手があってもtrue）。
 * @returns {{ correct: boolean, solved: boolean, speech: string, line: string[], next: { sfen: string, step: number } | null }}
 */
export function judgeProblemMove(problem, usi, sfen = problem.sfen, step = 0) {
  if (problem.kind === "line") return judgeLineMove(problem, usi, sfen, step);
  const verdict = problemAnalysis(problem, sfen, step).verdicts.find((entry) => entry.usi === usi);
  if (!verdict) return { correct: false, solved: false, speech: "その手は指せないよ。駒の動きをもう一度確かめてみよう！", line: [], next: null };
  const reply = verdict.correct ? opponentReply(problem, sfen, step, verdict) : null;
  if (reply) {
    const line = [usi, reply];
    const [played, replied] = moveLabels(sfen, line);
    const answered = isAnswerStep(problem, step);
    let speech = `いいね！ ${played}なら大丈夫。でも、相手は${replied}と王手してきたよ。次はどう逃げる？`;
    if (problem.kind === "mate") speech = `いいね！ ${played}に、相手は${replied}。続けて詰ませてみよう！`;
    if (answered) speech = `正解！ ${played}なら、もう詰まないよ。どうして大丈夫なのか、続きを指して確かめよう。相手が${replied}と王手してきたら、どう逃げる？`;
    return {
      correct: true,
      solved: answered,
      speech,
      line,
      next: { sfen: positionAfter(sfen, line).sfen, step: step + 1 },
    };
  }
  const result = finalVerdict(problem, sfen, verdict);
  // 続きの1手を指し終えたときは、正解はもう伝えてあるので、逃げられたことと解説を伝える。
  if (result.correct && problem.kind === "escape" && step > (problem.replies?.length ?? 0)) {
    result.speech = `そのとおり！ ${moveLabels(sfen, [usi])[0]}で逃げられるね。${problem.explanation}`;
  }
  return { ...result, solved: result.correct, line: verdict.line, next: null };
}

/** 問題が終わる手（最後の正解か、まちがい）の判定と台詞。 */
function finalVerdict(problem, sfen, verdict) {
  const [played, ...rest] = moveLabels(sfen, verdict.line);
  switch (verdict.reason) {
    case "mate":
      return {
        correct: true,
        speech: `正解！ ${played}で詰みだよ。${problem.explanation}`,
      };
    case "safe":
      return {
        correct: true,
        speech: `正解！ ${played}なら、もう詰まないよ。${problem.explanation}`,
      };
    case "not-check":
      return { correct: false, speech: `${played}は王手になっていないよ。相手の玉に王手をかけてみよう！` };
    case "escapes":
      return {
        correct: false,
        speech: rest.length
          ? `${played}だと、${rest[0]}と逃げられちゃう…。もう一度考えてみよう！`
          : `${played}では詰まないよ。もう一度考えてみよう！`,
      };
    case "mated":
      return {
        correct: false,
        speech: `${played}だと、${rest.join("、")}で詰んじゃう…。もう一度考えてみよう！`,
      };
    default:
      return { correct: false, speech: "ごめんね、この手は読み切れなかったよ。ほかの手を考えてみよう！" };
  }
}

/** 詰ませた局面か。 */
function isCheckmate(position) {
  return Boolean(position?.checked) && enumerateLegalMoves(position).length === 0;
}

/**
 * 手順で判定する問題（詰め将棋・図巧）の判定。stepは攻め方が正解した回数で、line[2 * step]が次の正解。
 * その場で詰ませる手は、手順と違っても正解にする。
 * 作意手順の最後の手は、無駄合い（間に打っても取られて詰む合駒）が残っていても正解にする（図巧の第26・73・93番）。
 */
function judgeLineMove(problem, usi, sfen, step) {
  const position = positionAfter(sfen, [usi]);
  if (!position) return { correct: false, solved: false, speech: "その手は指せないよ。駒の動きをもう一度確かめてみよう！", line: [], next: null };
  const index = 2 * step;
  const expected = problem.line[index];
  const [played] = moveLabels(sfen, [usi]);
  const mated = isCheckmate(position);
  if (mated || (usi === expected && index === problem.line.length - 1)) {
    const mate = mated ? `${played}で詰みだよ。` : `${played}で詰みだよ。間に駒を打っても、取れば詰むよ。`;
    return {
      correct: true,
      solved: true,
      speech: problem.source === "zukou"
        ? `お見事！ ${mate}伊藤看寿の${problem.title}を解ききったね！`
        : `正解！ ${mate}${problem.plies}手詰め、クリア！`,
      line: [usi],
      next: null,
    };
  }
  if (usi === expected && index + 1 < problem.line.length) {
    const line = [usi, problem.line[index + 1]];
    const [, replied] = moveLabels(sfen, line);
    const progress = problem.source === "zukou" ? `（${index + 2}/${problem.plies}手）` : "";
    return {
      correct: true,
      solved: false,
      speech: `いいね！ ${played}に、相手は${replied}${progress}。続けて詰ませてみよう！`,
      line,
      next: { sfen: positionAfter(sfen, line).sfen, step: step + 1 },
    };
  }
  if (!position.checked) {
    return { correct: false, solved: false, speech: `${played}は王手になっていないよ。詰将棋は、王手を続けて詰ませるよ！`, line: [usi], next: null };
  }
  if (problem.source === "zukou") {
    return {
      correct: false,
      solved: false,
      speech: `${played}は、作者の手順とは違う手だよ。もう一度考えてみよう！ 「答えを見る」で作者の手順も確かめられるよ。`,
      line: [usi],
      next: null,
    };
  }
  // 詰め将棋は手順の外の王手でも詰まないので、詰まない逃げ方を探して見せる。
  const reply = findEscapeReply(position.sfen, problem.plies - index - 2);
  const [, escaped] = reply ? moveLabels(sfen, [usi, reply]) : [];
  return {
    correct: false,
    solved: false,
    speech: escaped
      ? `${played}だと、${escaped}と逃げられちゃう…。もう一度考えてみよう！`
      : `${played}では詰まないよ。もう一度考えてみよう！`,
    line: reply ? [usi, reply] : [usi],
    next: null,
  };
}

const PIECE_NAMES = Object.freeze({
  pawn: "歩", lance: "香", knight: "桂", silver: "銀", gold: "金", bishop: "角", rook: "飛車", king: "玉",
  promPawn: "と", promLance: "成香", promKnight: "成桂", promSilver: "成銀", horse: "馬", dragon: "竜",
});

/**
 * ヒント。練習問題は1手目だけ、問題に書いた台詞とマス。手順で判定する問題は、次に動かす駒を伝え、
 * 盤上の駒を動かすならそのマスを示す。
 * @returns {{ text: string, square?: string } | null}
 */
export function problemHint(problem, sfen = problem.sfen, step = 0) {
  if (problem.kind !== "line") return step === 0 ? { text: problem.hint, square: problem.hintSquare } : null;
  const usi = problem.line[2 * step];
  const move = usi ? createGameRecord(sfen).position.createMoveByUSI(usi) : null;
  if (!move) return null;
  const name = PIECE_NAMES[move.pieceType] ?? "駒";
  if (usi.includes("*")) return { text: `持ち駒の${name}を打つ手だよ。どこに打てば王手が続くかな？` };
  return { text: `${name}を動かす手だよ。緑のマスの駒に注目してみよう！`, square: usi.slice(0, 2) };
}

/** 出題の台詞。 */
export function problemQuestion(problem) {
  if (problem.source === "zukou") {
    return `詰将棋図巧 ${problem.title}。伊藤看寿の名作だよ。王手を続けて、後手玉を詰ませてみよう！`;
  }
  if (problem.source === "tsume") return `${problem.title}。後手玉を${problem.plies}手で詰ませてみよう！`;
  return `第${PROBLEMS.indexOf(problem) + 1}問 ${problem.question}`;
}

// ===== 進み具合（端末に保存） =====

export const PROBLEM_PROGRESS_KEY = "shogi-match:problem-set:v1";

export function loadProblemProgress(storage) {
  try {
    const value = JSON.parse(storage?.getItem(PROBLEM_PROGRESS_KEY) ?? "null");
    return value && typeof value.solved === "object" && value.solved ? { solved: { ...value.solved } } : { solved: {} };
  } catch {
    return { solved: {} };
  }
}

export function saveProblemProgress(storage, progress) {
  try {
    storage?.setItem(PROBLEM_PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // 保存できない端末では、その場限りの記録にする。
  }
}

/** 解いた記録。一度でも一発で解けたら、その記録を残す。 */
export function recordProblemSolved(progress, id, { firstTry }) {
  const before = progress.solved[id];
  return { solved: { ...progress.solved, [id]: { firstTry: Boolean(before?.firstTry || firstTry) } } };
}
