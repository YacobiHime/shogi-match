import { OPENING_GUIDE_ROUTINES, OPENING_STRATEGIES } from "./opening-guide.mjs";
import { openingExplanation } from "./opening-explanations.mjs";
import { buildOpeningDexSteps } from "./opening-dex-replay.mjs";
import { formatHintMove } from "./match-assists.mjs";
import { referenceDexEntries } from "./reference-dex.mjs";
import { STANDARD_SFEN } from "./tutorial-runner.mjs";

/**
 * やこび姫の将棋教室のカリキュラム。巻 → 章 → レッスン → ステップの4階層。
 * 学ぶ順番は市販の入門書の構成を参考にしたが、教材の文章・局面はすべて自作している。
 *
 * ステップの種類:
 * - explain    盤面と説明。sfen / moves、marks、pieceSquare（動けるマスを青い点で示す）、arrows
 * - move-piece fromの駒をtargetまで動かす（maxMoves手以内）
 * - find-move  正解の一手（answers）を指す。anyDropOfを指定すると、その駒を打てば正解
 * - mate       詰将棋。solutionは自分と相手の手を交互に並べ、最後の自分の手で詰む
 * - choose     選択肢から答える（answerは正解の番号）
 * - open-dex   図鑑の項目を開く（kind: piece / tesuji / world / opening）
 * - play       学習対局の設定を用意して対局へ進む
 */

const PIECES = Object.fromEntries(referenceDexEntries("piece").map((entry) => [entry.id, entry]));
const TESUJI = Object.fromEntries(referenceDexEntries("tesuji").map((entry) => [entry.id, entry]));

const FILE_1 = ["1a", "1b", "1c", "1d", "1e", "1f", "1g", "1h", "1i"];
const RANK_1 = ["9a", "8a", "7a", "6a", "5a", "4a", "3a", "2a", "1a"];
const ENEMY_CAMP = ["a", "b", "c"].flatMap((rank) => [9, 8, 7, 6, 5, 4, 3, 2, 1].map((file) => `${file}${rank}`));

// ===== 第1巻 =====

function pieceLesson(id, { entryId, sfen, from, target, maxMoves, targetLabel, quiz }) {
  const entry = PIECES[entryId];
  return {
    id,
    title: entry.label.replace(/（.*）/, ""),
    summary: entry.overview,
    steps: [
      { type: "explain", sfen: entry.sfen, pieceSquare: entry.pieceSquare, speech: `${entry.overview} 青い点が動けるマスだよ。` },
      { type: "explain", sfen: entry.sfen, pieceSquare: entry.pieceSquare, speech: entry.rows[0][1] },
      { type: "move-piece", sfen, from, target, maxMoves, speech: `${entry.label.replace(/（.*）/, "")}を${targetLabel}（緑のマス）まで動かしてみよう！${maxMoves > 1 ? `${maxMoves}手以内でね。` : ""}` },
      { type: "explain", sfen: entry.sfen, pieceSquare: entry.pieceSquare, speech: `${entry.rows[2][0]}：${entry.rows[2][1]}` },
      { type: "choose", ...quiz },
    ],
  };
}

const VOLUME_1 = {
  id: "v1",
  title: "将棋ってなあに？",
  description: "盤と駒のことを、やこび姫といっしょに知ろう！",
  chapters: [
    {
      id: "v1-c1",
      title: "盤と駒にごあいさつ",
      lessons: [
        {
          id: "v1-board",
          title: "将棋盤を見てみよう",
          summary: "マスの呼び方を覚えよう",
          steps: [
            { type: "explain", sfen: STANDARD_SFEN, speech: "将棋は、たて9マス×よこ9マス、全部で81マスの盤で遊ぶよ。手前が自分（先手）、向こうが相手（後手）なんだ。" },
            { type: "explain", sfen: STANDARD_SFEN, marks: FILE_1.map((usi) => [usi, "key"]), speech: "たての列は「筋」というよ。右から1筋、2筋…9筋と数えるんだ。緑が1筋だよ。" },
            { type: "explain", sfen: STANDARD_SFEN, marks: RANK_1.map((usi) => [usi, "key"]), speech: "よこの行は「段」というよ。上から一段目、二段目…九段目。緑が一段目だよ。" },
            { type: "explain", sfen: STANDARD_SFEN, marks: [["5e", "key"]], speech: "マスは「筋→段」の順に呼ぶよ。盤のまん中は「5五（ごのご）」！" },
            { type: "choose", sfen: STANDARD_SFEN, marks: [["7c", "key"]], question: "緑のマスはどこかな？", options: ["3七", "7三", "7七"], answer: 1, explanation: "右から7筋目、上から三段目だから「7三」だよ！" },
          ],
        },
        {
          id: "v1-setup",
          title: "駒を並べよう",
          summary: "最初の並べ方を知ろう",
          steps: [
            { type: "explain", sfen: STANDARD_SFEN, speech: "最初はこんなふうに並べるよ。自分も相手も20枚ずつ、駒は8種類あるんだ。" },
            { type: "explain", sfen: STANDARD_SFEN, marks: [["5i", "key"]], speech: "一番下のまん中が「玉」。取られたら負けの、いちばん大事な駒だよ。" },
            { type: "explain", sfen: STANDARD_SFEN, marks: [["2h", "key"], ["8h", "key"]], speech: "二段目にいるのが「飛車」と「角」。どちらも遠くまで動ける強い駒だよ。" },
            { type: "choose", sfen: STANDARD_SFEN, question: "自分の飛車はどこにあるかな？", options: ["8八", "5九", "2八"], answer: 2, explanation: "飛車は右側の2八にいるよ。左側の8八にいるのが角だね。" },
          ],
        },
        {
          id: "v1-turns",
          title: "交互に指そう",
          summary: "1手ずつ交互に動かすよ",
          steps: [
            { type: "explain", sfen: STANDARD_SFEN, speech: "将棋は、先手と後手が1手ずつ交互に指すよ。先に指すのは先手なんだ。" },
            { type: "find-move", sfen: STANDARD_SFEN, answers: ["7g7f"], marks: [["7f", "key"]], speech: "7七の歩を、1つ前の7六へ進めてみよう！ 駒を選んでから、動かしたいマスを選ぶよ。" },
            { type: "explain", sfen: STANDARD_SFEN, speech: "将棋に「パス」はないよ。自分の番では、必ずどれかの駒を動かすか、持ち駒を打つんだ。" },
            { type: "choose", question: "最初に指すのはどっち？", options: ["後手", "先手"], answer: 1, explanation: "最初は先手から指すよ！" },
          ],
        },
        {
          id: "v1-win",
          title: "勝ち負けのルール",
          summary: "玉を詰ませたら勝ち！",
          steps: [
            { type: "explain", sfen: "4k4/4G4/5S3/9/9/9/9/9/4K4 w - 1", marks: [["5a", "target"]], speech: "相手の玉が、どこへ逃げても取られてしまう形を「詰み」というよ。詰ませたら勝ち！" },
            { type: "explain", sfen: STANDARD_SFEN, marks: [["5i", "key"]], speech: "反対に、自分の玉が詰まされたら負け。負けを認めて「投了」することもできるよ。" },
            { type: "choose", question: "将棋で勝つには？", options: ["相手の駒を全部取る", "相手の玉を詰ませる", "先に敵陣に入る"], answer: 1, explanation: "相手の玉を詰ませたら勝ちだよ！" },
          ],
        },
      ],
    },
    {
      id: "v1-c2",
      title: "駒となかよくなろう",
      lessons: [
        pieceLesson("v1-pawn", {
          entryId: "pawn", sfen: "k8/9/9/9/9/9/4P4/9/8K b - 1", from: "5g", target: "5e", maxMoves: 2, targetLabel: "5五",
          quiz: { question: "歩はどこへ動けるかな？", options: ["前に1マス", "横に1マス", "斜め前に1マス"], answer: 0, explanation: "歩は前に1マスだけ進めるよ！" },
        }),
        pieceLesson("v1-lance", {
          entryId: "lance", sfen: "k8/9/9/9/9/9/9/9/4L3K b - 1", from: "5i", target: "5c", maxMoves: 1, targetLabel: "5三",
          quiz: { question: "香車が動けないのはどれ？", options: ["前に2マス", "後ろに1マス", "前に5マス"], answer: 1, explanation: "香車は前にだけ進めて、後ろには戻れないよ。" },
        }),
        pieceLesson("v1-knight", {
          entryId: "knight", sfen: "k8/9/9/9/9/9/9/9/4N3K b - 1", from: "5i", target: "5e", maxMoves: 2, targetLabel: "5五",
          quiz: { question: "桂馬の特徴はどれ？", options: ["後ろに下がれる", "横に動ける", "駒を飛び越えられる"], answer: 2, explanation: "桂馬は、駒を飛び越えられるただ一つの駒だよ！" },
        }),
        pieceLesson("v1-silver", {
          entryId: "silver", sfen: "k8/9/9/9/9/9/9/4S4/8K b - 1", from: "5h", target: "3f", maxMoves: 2, targetLabel: "3六",
          quiz: { question: "銀が動けないのはどこ？", options: ["真横", "斜め後ろ", "真正面"], answer: 0, explanation: "銀は真横と真後ろには動けないよ。" },
        }),
        pieceLesson("v1-gold", {
          entryId: "gold", sfen: "k8/9/9/9/9/9/9/4G4/8K b - 1", from: "5h", target: "3g", maxMoves: 2, targetLabel: "3七",
          quiz: { question: "金が動けないのはどこ？", options: ["真横", "斜め後ろ", "真後ろ"], answer: 1, explanation: "金は斜め後ろにだけは動けないよ。" },
        }),
        pieceLesson("v1-bishop", {
          entryId: "bishop", sfen: "k8/9/9/9/9/9/9/1B7/8K b - 1", from: "8h", target: "4d", maxMoves: 1, targetLabel: "4四",
          quiz: { question: "角はどう動くかな？", options: ["縦と横にどこまでも", "斜めにどこまでも", "周りに1マス"], answer: 1, explanation: "角は斜めにどこまでも進めるよ！" },
        }),
        pieceLesson("v1-rook", {
          entryId: "rook", sfen: "k8/9/9/9/9/9/9/7R1/8K b - 1", from: "2h", target: "5e", maxMoves: 2, targetLabel: "5五",
          quiz: { question: "飛車はどう動くかな？", options: ["縦と横にどこまでも", "斜めにどこまでも", "前に1マス"], answer: 0, explanation: "飛車は縦と横にどこまでも進めるよ！" },
        }),
        pieceLesson("v1-king", {
          entryId: "king", sfen: "k8/9/9/9/9/9/9/9/4K4 b - 1", from: "5i", target: "5g", maxMoves: 2, targetLabel: "5七",
          quiz: { question: "玉が取られたらどうなる？", options: ["引き分け", "そのまま続ける", "負け"], answer: 2, explanation: "玉を取られたら（詰まされたら）負けだよ。" },
        }),
        {
          id: "v1-promotion",
          title: "駒が成る",
          summary: "敵陣に入ると強くなれる",
          steps: [
            { type: "explain", sfen: "k8/9/9/9/9/9/9/9/8K b - 1", marks: ENEMY_CAMP.filter((usi) => usi !== "9a").map((usi) => [usi, "reach"]), speech: "相手側の3段（敵陣）に駒が入ったり、敵陣の中で動いたりすると「成る」ことができるよ。" },
            { type: "find-move", sfen: "k8/9/9/5S3/9/9/9/9/8K b - 1", answers: ["4d4c+"], marks: [["4c", "key"]], speech: "銀を4三へ進めて成ってみよう！ 成るか聞かれたら「成」を選んでね。" },
            { type: "explain", sfen: "k8/9/5+S3/9/9/9/9/9/8K b - 1", pieceSquare: "4c", speech: "成銀は、金と同じ動きになったよ！ 駒を裏返すと、動きが変わるんだ。" },
            { type: "choose", question: "成れない駒はどれかな？", options: ["銀", "金", "歩"], answer: 1, explanation: "金と玉は成れないよ。" },
          ],
        },
        {
          id: "v1-hand",
          title: "持ち駒を打とう",
          summary: "取った駒は自分の味方",
          steps: [
            { type: "explain", sfen: "k8/9/9/4g4/4S4/9/9/9/8K b - 1", marks: [["5d", "target"]], speech: "相手の駒を取ると、その駒は自分の「持ち駒」になるよ。" },
            { type: "find-move", sfen: "k8/9/9/4g4/4S4/9/9/9/8K b - 1", answers: ["5e5d"], speech: "銀で5四の金を取ってみよう！" },
            { type: "explain", sfen: "k8/9/9/4S4/9/9/9/9/8K b G 1", speech: "取った金は駒台に乗ったね。持ち駒は、空いているマスならどこにでも打てるよ。" },
            { type: "find-move", sfen: "k8/9/9/4S4/9/9/9/9/8K b G 1", anyDropOf: "G", speech: "持ち駒の金を、好きな空きマスに打ってみよう！ 駒台の金を選んでから、打つマスを選ぶよ。" },
            { type: "choose", question: "持ち駒を打てないマスはどれ？", options: ["駒があるマス", "空いているマス"], answer: 0, explanation: "持ち駒は、空いているマスにだけ打てるよ。" },
          ],
        },
        {
          id: "v1-fouls",
          title: "反則に気をつけよう",
          summary: "やってはいけない手",
          steps: [
            { type: "explain", sfen: "k8/9/9/9/9/9/4P4/9/8K b P 1", marks: ["5a", "5b", "5c", "5d", "5e", "5f", "5h", "5i"].map((usi) => [usi, "target"]), speech: "自分の歩がある筋に、もう1枚歩を打つ「二歩」は反則だよ。盤面なら5筋には歩を打てないんだ。" },
            { type: "choose", sfen: "k8/9/9/9/9/9/4P4/9/8K b P 1", question: "二歩になってしまうのはどっち？", options: ["4五に歩を打つ", "5五に歩を打つ"], answer: 1, explanation: "5筋にはもう5七の歩があるから、5五に打つと二歩だね。" },
            { type: "explain", sfen: "k8/9/9/9/9/9/9/9/8K b P 1", marks: RANK_1.filter((usi) => usi !== "9a").map((usi) => [usi, "target"]), speech: "一段目に歩や香を打つと、もう前に進めないから反則。桂は一段目と二段目に打てないよ。" },
            { type: "explain", sfen: "4k4/9/4G4/9/9/9/9/9/8K b P 1", marks: [["5b", "target"]], speech: "歩を打って玉を詰ませる「打ち歩詰め」も反則。盤にある歩を突いて詰ませるのはOKだよ。" },
            { type: "explain", sfen: "4k4/9/9/9/9/9/9/9/4K3r b - 1", marks: [["1i", "target"], ["5i", "key"]], speech: "王手をかけられたら、必ず防ごう。放っておいて玉を取られる「王手放置」も反則だよ。" },
            { type: "choose", question: "反則ではないのはどれ？", options: ["二歩", "盤の歩を突いて詰ませる", "打ち歩詰め"], answer: 1, explanation: "盤にある歩を突いて詰ませるのは反則じゃないよ！" },
          ],
        },
      ],
    },
  ],
};

// ===== 第2巻 =====

function tesujiFindStep(entryId, speech) {
  const entry = TESUJI[entryId];
  return { type: "find-move", sfen: entry.sfen, moves: entry.moves, answers: entry.arrows, marks: entry.marks, speech };
}

const VOLUME_2 = {
  id: "v2",
  title: "一局の流れをつかもう",
  description: "先を読む力と、玉のつかまえ方を身につけよう！",
  chapters: [
    {
      id: "v2-c1",
      title: "三手先まで考えよう",
      lessons: [
        {
          id: "v2-free-piece",
          title: "ただで取れる駒",
          summary: "取られない駒を取ろう",
          steps: [
            { type: "explain", sfen: "k8/9/9/7s1/9/9/9/7R1/8K b - 1", marks: [["2d", "target"]], speech: "2四の銀は、どの駒にも守られていないよ。こういう駒は「ただ」で取れるんだ。" },
            { type: "find-move", sfen: "k8/9/9/7s1/9/9/9/7R1/8K b - 1", answers: ["2h2d"], speech: "飛車で2四の銀を取ってみよう！" },
            { type: "explain", sfen: "k8/9/7p1/7s1/9/9/9/7R1/8K b - 1", marks: [["2c", "target"], ["2d", "target"]], speech: "でも、こんどは2三に歩がいるよ。銀を取ると、歩で飛車を取り返されちゃうんだ。" },
            { type: "choose", sfen: "k8/9/7p1/7s1/9/9/9/7R1/8K b - 1", question: "2四の銀を飛車で取ると、どうなる？", options: ["何も起きない", "歩で飛車を取り返される"], answer: 1, explanation: "銀（5点）を取っても、飛車（10点）を取られたら大損だね。" },
          ],
        },
        {
          id: "v2-three-moves",
          title: "三手の読み",
          summary: "自分→相手→自分の順に考える",
          steps: [
            { type: "explain", speech: "強い人は、指す前に「自分の手 → 相手の応手 → 自分の次の手」の3手を考えているよ。これを「三手の読み」というんだ。" },
            { type: "explain", sfen: "k8/9/7p1/7s1/9/9/9/7R1/8K b - 1", marks: [["2d", "target"]], speech: "たとえば、2四の銀を取る（自分）→ 歩で取り返される（相手）→ 飛車を損した（自分の番）。3手まで考えると、取ってはいけないと分かるね。" },
            { type: "choose", question: "三手の読みで考える順番は？", options: ["自分 → 自分 → 自分", "自分 → 相手 → 自分", "相手 → 相手 → 自分"], answer: 1, explanation: "相手の応手まで考えるのがポイントだよ！" },
          ],
        },
        {
          id: "v2-fork",
          title: "両取りをかけよう",
          summary: "2枚の駒を同時にねらう",
          steps: [
            { type: "explain", sfen: TESUJI["knight-fork"].sfen, marks: TESUJI["knight-fork"].marks, speech: "1つの駒で2枚の駒を同時にねらう手を「両取り」というよ。相手はどちらか1枚しか守れないんだ。" },
            tesujiFindStep("knight-fork", "桂馬を跳ねて、飛車と金の両取りをかけてみよう！"),
            { type: "open-dex", kind: "tesuji", id: "knight-fork", speech: "手筋図鑑の「ふんどしの桂」も見てみよう！" },
          ],
        },
        {
          id: "v2-values",
          title: "駒の価値を知ろう",
          summary: "駒得と駒損",
          steps: [
            { type: "explain", speech: "駒にはだいたいの価値があるよ。価値の高い駒を取って、低い駒を渡すのが「駒得」なんだ。" },
            { type: "open-dex", kind: "piece", id: "piece-values", speech: "駒図鑑の「駒の価値 tier表」で、点数を見てみよう！" },
            { type: "choose", question: "一番価値が高いのはどれ？", options: ["銀", "飛車", "桂馬"], answer: 1, explanation: "飛車は10点。銀は5点、桂馬は4点だよ。" },
          ],
        },
      ],
    },
    {
      id: "v2-c2",
      title: "強い人の対局を観戦しよう",
      lessons: [
        { id: "v2-watch-opening", title: "序盤の駒組みを観戦しよう", summary: "準備中", comingSoon: true },
        { id: "v2-watch-endgame", title: "終盤の寄せを観戦しよう", summary: "準備中", comingSoon: true },
      ],
    },
    {
      id: "v2-c3",
      title: "玉をつかまえよう",
      lessons: [
        {
          id: "v2-check",
          title: "王手と詰み",
          summary: "王手のかけ方と防ぎ方",
          steps: [
            { type: "explain", sfen: "4k4/9/9/9/9/9/9/9/4R3K w - 1", marks: [["5a", "target"], ["5i", "key"]], speech: "次に玉を取ろうとする手を「王手」というよ。盤面では5九の飛車が王手をかけているね。" },
            { type: "explain", speech: "王手をかけられたら、①玉が逃げる ②王手している駒を取る ③間に駒を置く（合駒）のどれかで防ぐよ。" },
            { type: "explain", sfen: "4k4/4G4/5S3/9/9/9/9/9/4K4 w - 1", marks: [["5a", "target"]], speech: "どの方法でも防げない王手が「詰み」。ここまでくれば勝ちだよ！" },
            { type: "choose", question: "王手の防ぎ方ではないのは？", options: ["玉が逃げる", "間に駒を置く", "ほかの駒を動かして知らんぷり"], answer: 2, explanation: "王手を放っておくのは反則だよ。" },
          ],
        },
        {
          id: "v2-mate-head-gold",
          title: "1手詰め：頭金",
          summary: "玉の頭に金を打つ",
          steps: [
            { type: "explain", sfen: TESUJI["head-gold"].sfen, marks: TESUJI["head-gold"].marks, speech: "玉の頭（真上）に金を打つ「頭金」は、詰みの基本の形だよ。" },
            { type: "mate", sfen: TESUJI["head-gold"].sfen, solution: ["G*5b"], speech: "1手で詰ませてみよう！" },
          ],
        },
        {
          id: "v2-mate-knight",
          title: "1手詰め：桂の王手",
          summary: "合駒できない王手",
          steps: [
            { type: "explain", sfen: "7nk/7bp/9/9/9/9/9/9/1K7 b N 1", marks: [["1a", "target"]], speech: "桂馬の王手は、間に駒を置いて防げないよ。玉のまわりが自分の駒でふさがっていたら大チャンス！" },
            { type: "mate", sfen: "7nk/7bp/9/9/9/9/9/9/1K7 b N 1", solution: ["N*2c"], speech: "持ち駒の桂馬で、1手で詰ませてみよう！" },
          ],
        },
        {
          id: "v2-double-check",
          title: "両王手",
          summary: "2つの王手を同時にかける",
          steps: [
            { type: "explain", sfen: TESUJI["double-check"].sfen, marks: TESUJI["double-check"].marks, speech: "2つの駒で同時に王手をかける「両王手」は、玉が逃げるしかない強力な王手だよ。" },
            tesujiFindStep("double-check", "桂馬を跳ねて、両王手をかけてみよう！"),
          ],
        },
        { id: "v2-mate-three", title: "3手詰めに挑戦", summary: "準備中", comingSoon: true },
        {
          id: "v2-mating-shapes",
          title: "詰みの形を覚えよう",
          summary: "頭金と腹銀",
          steps: [
            { type: "explain", speech: "詰みには、よく出てくる「形」があるよ。形を覚えておくと、実戦ですぐに気づけるんだ。" },
            { type: "open-dex", kind: "tesuji", id: "head-gold", speech: "手筋図鑑の「頭金」を見てみよう！" },
            { type: "open-dex", kind: "tesuji", id: "belly-silver", speech: "次は「腹銀」。玉の真横に銀を打つ形だよ。" },
          ],
        },
      ],
    },
  ],
};

// ===== 第3巻 =====

const VOLUME_3 = {
  id: "v3",
  title: "攻めと守りのひみつ",
  description: "戦法と囲い、攻めと守りのコツを学ぼう！",
  chapters: [
    {
      id: "v3-c1",
      title: "戦法と囲いを知ろう",
      lessons: [
        {
          id: "v3-rook-styles",
          title: "居飛車と振り飛車",
          summary: "飛車の使い方で2つに分かれる",
          steps: [
            { type: "explain", moves: ["2g2f", "8c8d", "2f2e", "8d8e"], marks: [["2h", "key"]], speech: "飛車を最初の2筋のまま使って戦うのが「居飛車」だよ。" },
            { type: "explain", moves: ["7g7f", "3c3d", "6g6f", "8c8d", "2h6h"], marks: [["6h", "key"]], speech: "飛車を左へ動かして戦うのが「振り飛車」。盤面は6筋に振った「四間飛車」だよ。" },
            { type: "choose", question: "飛車を左に動かして戦うのは？", options: ["居飛車", "振り飛車"], answer: 1, explanation: "飛車を振るから「振り飛車」だよ！" },
          ],
        },
        {
          id: "v3-castles",
          title: "囲いで玉を守ろう",
          summary: "金銀で玉を囲う",
          steps: [
            { type: "explain", sfen: TESUJI["three-guards"].sfen, marks: TESUJI["three-guards"].marks, speech: "戦う前に、金と銀で玉を守る形を作るよ。これを「囲い」というんだ。盤面は「美濃囲い」だよ。" },
            { type: "explain", speech: "囲いの基本は「金銀3枚」。攻めに使う駒と、守りに使う駒を分けて考えよう。" },
            { type: "open-dex", kind: "opening", speech: "定跡図鑑の「囲い」で、いろいろな囲いを見てみよう！" },
            { type: "choose", question: "囲いの基本はどれ？", options: ["金銀3枚で玉を守る", "玉をひとりにする", "飛車で玉を守る"], answer: 0, explanation: "玉の守りは金銀3枚が基本だよ！" },
          ],
        },
        {
          id: "v3-play-formation",
          title: "囲いを完成させて指そう",
          summary: "完成した形から対局",
          steps: [
            { type: "explain", speech: "四間飛車と美濃囲いが完成した局面から、CPUと指してみよう！ 相手は舟囲いの居飛車だよ。" },
            {
              type: "play",
              speech: "対局の条件はわたしが決めておいたよ。準備ができたら「対局をはじめる」を押してね！",
              // 対局条件はレッスンで固定し、プレイヤーには変更させない。
              preset: {
                startType: "formation",
                playerStrategy: "shiken",
                playerCastle: "mino",
                opponentStrategy: "ibisha",
                opponentCastle: "funagakoi",
                cpuLevel: 1,
                hintLimit: 3,
                undoLimit: 3,
              },
              comments: {
                win: "美濃囲いがしっかりしていると、安心して攻められたでしょ？",
                lose: "美濃囲いは横からの攻めに強いよ。囲いを崩さないように戦ってみよう！",
                draw: "囲いが堅いと、なかなか負けないんだよ。",
              },
            },
          ],
        },
      ],
    },
    {
      id: "v3-c2",
      title: "攻めと受けを観戦しよう",
      lessons: [
        { id: "v3-watch-attack", title: "攻めと受けの対局を観戦しよう", summary: "準備中", comingSoon: true },
      ],
    },
    {
      id: "v3-c3",
      title: "攻めと守りのコツ",
      lessons: [
        {
          id: "v3-attack-pieces",
          title: "攻めは飛角銀桂",
          summary: "攻めに使う駒",
          steps: [
            { type: "explain", sfen: TESUJI["attack-pieces"].sfen, marks: TESUJI["attack-pieces"].marks, speech: "攻めの主役は、飛車・角・銀・桂の4枚だよ。金は玉の守りに残しておくのが基本なんだ。" },
            { type: "choose", question: "攻めに使う駒として、ふつう残しておくのは？", options: ["飛車", "金", "桂"], answer: 1, explanation: "金は玉を守る大事な駒だよ。" },
          ],
        },
        {
          id: "v3-defense",
          title: "王手を受けよう",
          summary: "合駒で防ぐ",
          steps: [
            { type: "explain", sfen: TESUJI["one-pawn"].sfen, marks: TESUJI["one-pawn"].marks, speech: "竜に王手をかけられたよ！ 玉が逃げられないときは、間に駒を置く「合駒」で防ごう。" },
            tesujiFindStep("one-pawn", "持ち駒の歩を、玉と竜の間に打ってみよう！"),
          ],
        },
        {
          id: "v3-early-escape",
          title: "玉の早逃げ",
          summary: "危なくなる前に逃げる",
          steps: [
            { type: "explain", sfen: TESUJI["early-escape"].sfen, marks: TESUJI["early-escape"].marks, speech: "「玉の早逃げ八手の得」。王手をかけられる前に、玉を安全な場所へ動かしておこう。" },
            tesujiFindStep("early-escape", "玉を2九へ逃がしてみよう！"),
          ],
        },
        {
          id: "v3-bottom-pawn",
          title: "金底の歩",
          summary: "一段目の歩は堅い",
          steps: [
            { type: "explain", sfen: TESUJI["gold-bottom-pawn"].sfen, marks: TESUJI["gold-bottom-pawn"].marks, speech: "竜が一段目から、玉の下をねらっているよ。こういうときは「金底の歩」が効くんだ。" },
            tesujiFindStep("gold-bottom-pawn", "金の真下の3九に歩を打って、竜の横利きを止めよう！"),
          ],
        },
      ],
    },
  ],
};

// ===== 第4巻 =====

/** 定跡図鑑の手順をなぞる練習。相手の応手は定跡図鑑と同じく省いた盤面で進める。 */
function openingDrillLesson(id, strategyId) {
  const definition = OPENING_STRATEGIES.find((strategy) => strategy.id === strategyId);
  const explanation = openingExplanation(strategyId);
  const replay = buildOpeningDexSteps(definition, {
    initialSfen: STANDARD_SFEN,
    routines: OPENING_GUIDE_ROUTINES,
    formatLabel: (usi, beforeSfen) => formatHintMove(usi, beforeSfen),
  });
  const steps = [{ type: "explain", sfen: STANDARD_SFEN, speech: `「${definition.label}」を指してみよう！ ${explanation?.overview ?? ""}` }];
  for (let index = 1; index < replay.length; index += 1) {
    const step = replay[index];
    if (step.label.startsWith("相手：")) {
      steps.push({ type: "explain", sfen: step.sfen, speech: `相手は${step.label.replace("相手：", "")}と指したよ。` });
    } else {
      steps.push({
        type: "find-move",
        sfen: replay[index - 1].sfen,
        answers: [step.lastMove],
        speech: `次は「${step.label}」と指してみよう！`,
      });
    }
  }
  steps.push({ type: "explain", sfen: replay.at(-1).sfen, speech: `${definition.label}の形ができたね！ ${explanation?.aim ?? ""}` });
  steps.push({ type: "open-dex", kind: "opening", speech: "定跡図鑑で、手順をもう一度確かめてみよう！" });
  return { id, title: definition.label, summary: explanation?.aim ?? "", steps };
}

const VOLUME_4 = {
  id: "v4",
  title: "戦法マスターへの道",
  description: "いろいろな戦法の手順を、実際に指して覚えよう！",
  chapters: [
    {
      id: "v4-c1",
      title: "振り飛車にチャレンジ",
      lessons: [
        openingDrillLesson("v4-shiken", "shiken"),
        openingDrillLesson("v4-sangen", "sangen"),
        openingDrillLesson("v4-nakabisha", "nakabisha"),
        openingDrillLesson("v4-mukai", "mukai"),
      ],
    },
    {
      id: "v4-c2",
      title: "居飛車にチャレンジ",
      lessons: [
        openingDrillLesson("v4-bougin", "bougin"),
        openingDrillLesson("v4-hayaguri", "hayaguri-gin"),
        openingDrillLesson("v4-koshikake", "koshikake-gin"),
        openingDrillLesson("v4-yagura", "yagura-strategy"),
      ],
    },
  ],
};

// ===== 第5巻 =====

/** 手筋図鑑の格言を、実際に指して確かめる。 */
function proverbLesson(id, title, entryIds) {
  const steps = entryIds.flatMap((entryId) => {
    const entry = TESUJI[entryId];
    return [
      { type: "explain", sfen: entry.sfen, moves: entry.moves, marks: entry.marks, speech: `「${entry.label}」 ${entry.overview}` },
      { type: "find-move", sfen: entry.sfen, moves: entry.moves, answers: entry.arrows, marks: entry.marks, speech: "格言どおりの一手を指してみよう！" },
      { type: "explain", sfen: entry.sfen, moves: entry.moves, marks: entry.marks, arrows: entry.arrows, speech: entry.rows[0][1] },
    ];
  });
  return { id, title, summary: entryIds.map((entryId) => TESUJI[entryId].label).join("・"), steps };
}

const VOLUME_5 = {
  id: "v5",
  title: "考えるって楽しい！",
  description: "形勢の読み方と、格言の使いどころを身につけよう！",
  chapters: [
    {
      id: "v5-c1",
      title: "形勢を読んでみよう",
      lessons: [
        {
          id: "v5-judgement",
          title: "形勢の3つのものさし",
          summary: "駒の損得・玉の堅さ・駒の働き",
          steps: [
            { type: "explain", speech: "どちらが有利かを「形勢」というよ。形勢は、①駒の損得 ②玉の堅さ ③駒の働き の3つで考えるんだ。" },
            { type: "explain", sfen: TESUJI["three-guards"].sfen, marks: TESUJI["three-guards"].marks, speech: "玉の堅さ：金銀で囲われた玉は、なかなか詰まされないよ。" },
            { type: "explain", sfen: TESUJI["dragon-enemy-horse-home"].sfen, marks: TESUJI["dragon-enemy-horse-home"].marks, speech: "駒の働き：同じ駒でも、よく利いている場所にあると強いんだ。敵陣の竜や、自陣の馬がその例だよ。" },
            { type: "choose", question: "形勢を考える3つのものさしに入らないのは？", options: ["駒の損得", "玉の堅さ", "指した手の数"], answer: 2, explanation: "手の数ではなく、駒の損得・玉の堅さ・駒の働きで考えるよ。" },
          ],
        },
        {
          id: "v5-evaluation",
          title: "評価値ってなに？",
          summary: "AIの形勢判断を読む",
          steps: [
            { type: "explain", speech: "将棋AIは、形勢を「評価値」という数字で表すよ。プラスなら先手が有利、マイナスなら後手が有利なんだ。" },
            { type: "explain", speech: "対局のあと「棋譜解析」を開くと、評価値のグラフが見られるよ。グラフが大きく動いたところが勝負の分かれ目なんだ。" },
            { type: "choose", question: "評価値がプラスのときは？", options: ["先手が有利", "後手が有利", "引き分け"], answer: 0, explanation: "プラスは先手、マイナスは後手が有利だよ。" },
          ],
        },
      ],
    },
    {
      id: "v5-c2",
      title: "格言で強くなろう",
      lessons: [
        proverbLesson("v5-pawn-proverbs", "歩の格言にチャレンジ", ["edge-king-edge-pawn", "rook-pawn-exchange", "dangling-pawn", "focal-pawn"]),
        proverbLesson("v5-minor-proverbs", "駒の格言にチャレンジ", ["knight-fork", "knight-check", "silver-without-promotion"]),
        proverbLesson("v5-major-proverbs", "大駒の格言にチャレンジ", ["rook-cross-fork", "drop-major-far", "one-gap-dragon"]),
      ],
    },
  ],
};

export const TUTORIAL_TITLE = "やこび姫の将棋教室";
export const TUTORIAL_VOLUMES = Object.freeze([VOLUME_1, VOLUME_2, VOLUME_3, VOLUME_4, VOLUME_5]);

/** 教室全体を通した順番のレッスン一覧。解放の判定に使う。 */
export const TUTORIAL_LESSONS = Object.freeze(TUTORIAL_VOLUMES.flatMap((volume, volumeIndex) => (
  volume.chapters.flatMap((chapter) => chapter.lessons.map((lesson) => ({
    ...lesson,
    volumeId: volume.id,
    volumeNumber: volumeIndex + 1,
    chapterId: chapter.id,
  })))
)));

export function tutorialLesson(id) {
  return TUTORIAL_LESSONS.find((lesson) => lesson.id === id) ?? null;
}
