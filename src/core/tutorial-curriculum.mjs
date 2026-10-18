import { OPENING_GUIDE_ROUTINES, OPENING_STRATEGIES } from "./opening-guide.mjs";
import { openingExplanation } from "./opening-explanations.mjs";
import { buildOpeningDexSteps } from "./opening-dex-replay.mjs";
import { formatHintMove } from "./match-assists.mjs";
import { referenceDexEntries } from "./reference-dex.mjs";
import { STANDARD_SFEN } from "./tutorial-runner.mjs";
import { WATCH_GAME_FUNAGAKOI, WATCH_GAME_KURIDASHI, WATCH_GAME_KURIDASHI_EVALUATIONS } from "./tutorial-watch-games.mjs";

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
 * - replay     棋譜（moves）をfrom手目から1手ずつ再生する。notesは手数ごとの解説。最後の手まで見たら次へ進める
 * - capture    駒取りゲーム。fromの駒だけを動かして、相手の駒を全部取る。parは最短の手数（テストで確かめる）
 * - problem    問題集の問題（problemId）を、問題集と同じ判定で解く（判定は tutorial-problem.mjs）
 *
 * 課題のステップには、正解したときのほめ言葉（praise）を書ける。何が良かったかを1文で言う（Game_Nintendo_Implementation.mdの5章）。
 * 章の最後のレッスンは、腕だめし（boss: true）にできる。その章の課題に、前の章の課題を混ぜて復習させる。
 *
 * explain / replay に graph（平手からの { moves, evaluations }）を付けると、盤の横に評価値グラフを出す。
 */

const PIECES = Object.fromEntries(referenceDexEntries("piece").map((entry) => [entry.id, entry]));
const TESUJI = Object.fromEntries(referenceDexEntries("tesuji").map((entry) => [entry.id, entry]));

const FILE_1 = ["1a", "1b", "1c", "1d", "1e", "1f", "1g", "1h", "1i"];
const RANK_1 = ["9a", "8a", "7a", "6a", "5a", "4a", "3a", "2a", "1a"];
const ENEMY_CAMP = ["a", "b", "c"].flatMap((rank) => [9, 8, 7, 6, 5, 4, 3, 2, 1].map((file) => `${file}${rank}`));

// ===== 腕だめし =====

/** 課題のステップの種類（腕だめしの問題数を数える）。 */
const TASK_TYPES = new Set(["move-piece", "find-move", "mate", "choose", "capture", "problem"]);

/**
 * 章の腕だめし。最初に、問題の数と、まちがえずに解けば金メダルになることを伝える。
 * stepsには、その章の課題と、前の章の復習の課題を混ぜる。
 */
function bossLesson(id, { title, summary, chapterLabel, steps }) {
  const count = steps.filter(({ type }) => TASK_TYPES.has(type)).length;
  return {
    id,
    title: `腕だめし：${title}`,
    summary,
    boss: true,
    icon: "試",
    steps: [
      { type: "explain", speech: `腕だめし！ ${chapterLabel}で覚えたことを、${count}問で試そう。前の章の問題もまざっているよ。まちがえずに解けたら金メダル！` },
      ...steps,
    ],
  };
}

// ===== 第1巻 =====

/** 台詞で呼ぶ駒の名前。図鑑の見出し（歩兵・玉将・王将など）より短く、ふだんの呼び方にする。 */
const PIECE_NAMES = { pawn: "歩", lance: "香車", knight: "桂馬", silver: "銀", gold: "金", bishop: "角", rook: "飛車", king: "玉" };

function pieceLesson(id, { entryId, sfen, from, target, maxMoves, targetLabel, capture, quiz, praise }) {
  const entry = PIECES[entryId];
  const name = PIECE_NAMES[entryId];
  return {
    id,
    title: entry.label.replace(/（.*）/, ""),
    // めあて(見出しの帯と章クリアの札に出す)は短く。駒の説明は最初の台詞で話す。
    summary: `${name}の動きがわかる`,
    // 地図のマスに描く文字。駒のレッスンは、その駒の1文字にする。
    icon: entry.label[0],
    steps: [
      { type: "explain", sfen: entry.sfen, pieceSquare: entry.pieceSquare, speech: `これが「${name}」。${entry.overview} 青い点が、${name}の動けるマスだよ。` },
      { type: "move-piece", sfen, from, target, maxMoves, praise, speech: `${name}を${targetLabel}（緑のマス）まで動かしてみよう！${maxMoves > 1 ? ` ${maxMoves}手以内で届くよ。` : ""}` },
      {
        type: "capture",
        ...capture,
        speech: `駒取りゲーム！ ${name}だけで、赤いマスの相手の駒を全部取ろう。${capture.par}手で取りきれたら最短だよ。`,
      },
      { type: "explain", sfen: entry.sfen, pieceSquare: entry.pieceSquare, speech: `${name}にも弱点があるよ。${entry.rows[2][1]}` },
      { type: "choose", ...quiz },
    ],
  };
}

/** 盤の上に玉だけを置いた局面。マスの名前を覚える課題で、玉を動かす。 */
const KING_CENTER = "9/9/9/9/4K4/9/9/9/9 b - 1";

const VOLUME_1 = {
  id: "v1",
  title: "盤と駒をおぼえよう",
  description: "盤と駒の名前、駒の動きを、やこび姫といっしょにおぼえよう！",
  chapters: [
    {
      id: "v1-c1",
      title: "盤と駒にごあいさつ",
      lessons: [
        {
          id: "v1-board",
          title: "将棋盤を見てみよう",
          summary: "マスの名前で駒を動かせる",
          steps: [
            { type: "explain", sfen: STANDARD_SFEN, speech: "将棋は、たて9マス×よこ9マス、81マスの盤で遊ぶよ。手前が自分（先手）、向こうが相手（後手）なんだ。" },
            { type: "explain", sfen: STANDARD_SFEN, marks: FILE_1.map((usi) => [usi, "key"]), speech: "たての列は「筋」。右から1筋、2筋…と数えるよ。緑が1筋だね。" },
            { type: "explain", sfen: STANDARD_SFEN, marks: RANK_1.map((usi) => [usi, "key"]), speech: "よこの行は「段」。上から一段目、二段目…。緑が一段目だよ。マスは「筋→段」の順に、「5五」のように呼ぶんだ。" },
            {
              type: "move-piece", sfen: KING_CENTER, from: "5e", target: "4d", maxMoves: 1, hideTarget: true,
              speech: "まん中の5五に玉がいるよ。玉を「4四」へ動かしてみよう！ 筋は右から、段は上から数えてね。",
              praise: "4四は、右から4つ目・上から4つ目のマス。マスの名前で動かせたね！",
            },
            { type: "choose", sfen: STANDARD_SFEN, marks: [["7c", "key"]], question: "緑のマスはどこかな？", options: ["3七", "7三", "7七"], answer: 1, explanation: "右から7筋目、上から三段目だから「7三」だよ！" },
            {
              type: "move-piece", sfen: KING_CENTER, from: "5e", target: "6g", maxMoves: 2, hideTarget: true,
              speech: "こんどは玉を「6七」へ！ 玉は1手で1マス。2手で届くよ。",
              praise: "6七に着いたね。もうマスの名前はばっちり！",
            },
          ],
        },
        {
          id: "v1-setup",
          title: "駒を並べよう",
          summary: "最初の並べ方がわかる",
          steps: [
            { type: "explain", sfen: STANDARD_SFEN, speech: "最初はこんなふうに並べるよ。自分も相手も20枚ずつ、駒は8種類あるんだ。" },
            { type: "choose", sfen: STANDARD_SFEN, question: "取られたら負けの、いちばん大事な「玉」。自分の玉はどこかな？", options: ["5九", "5一", "1九"], answer: 0, explanation: "一番下のまん中、5九が自分の玉だよ。5一にいるのは相手の玉だね。" },
            { type: "explain", sfen: STANDARD_SFEN, marks: [["2h", "key"], ["8h", "key"]], speech: "二段目にいるのが「飛車」と「角」。どちらも遠くまで動ける強い駒だよ。" },
            { type: "choose", sfen: STANDARD_SFEN, question: "自分の飛車はどこにあるかな？", options: ["8八", "5九", "2八"], answer: 2, explanation: "飛車は右側の2八にいるよ。左側の8八にいるのが角だね。" },
          ],
        },
        {
          id: "v1-turns",
          title: "交互に指そう",
          summary: "1手ずつ交互に指せる",
          steps: [
            { type: "explain", sfen: STANDARD_SFEN, speech: "将棋は、先手と後手が1手ずつ交互に指すよ。先に指すのは先手なんだ。" },
            { type: "find-move", sfen: STANDARD_SFEN, answers: ["7g7f"], marks: [["7f", "key"]], speech: "7七の歩を、1つ前の7六へ進めてみよう！ 駒を選んでから、動かしたいマスを選ぶよ。", praise: "7六歩は、角の通り道を開ける、いちばん指される最初の一手なんだ！" },
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
        bossLesson("v1-c1-boss", {
          title: "盤と駒",
          summary: "盤のマスと駒の場所がわかる",
          chapterLabel: "この章",
          steps: [
            {
              type: "move-piece", sfen: KING_CENTER, from: "5e", target: "6d", maxMoves: 1, hideTarget: true,
              speech: "玉を「6四」へ動かそう！",
              praise: "6四、正解！ 筋と段の数え方は完ぺきだね。",
            },
            { type: "choose", sfen: STANDARD_SFEN, marks: [["8b", "key"]], question: "緑のマスの名前は？", options: ["8二", "2八", "8八"], answer: 0, explanation: "右から8筋目、上から二段目で「8二」。相手の飛車がいるマスだね。" },
            { type: "choose", sfen: STANDARD_SFEN, question: "相手の玉はどこかな？", options: ["5一", "5九", "1一"], answer: 0, explanation: "相手の玉は、向こう側のまん中の5一だよ。" },
            { type: "find-move", sfen: STANDARD_SFEN, answers: ["2g2f"], marks: [["2f", "key"]], speech: "飛車の前の歩を、1つ前の2六へ進めよう！", praise: "2六歩は、飛車で攻める準備の一手。これも定番の最初の一手だよ！" },
            { type: "choose", question: "将棋に「パス」はある？", options: ["ない", "ある"], answer: 0, explanation: "自分の番では、必ずどれかの駒を動かすか、持ち駒を打つよ。" },
          ],
        }),
      ],
    },
    {
      id: "v1-c2",
      title: "駒となかよくなろう",
      lessons: [
        pieceLesson("v1-pawn", {
          entryId: "pawn", sfen: "k8/9/9/9/9/9/4P4/9/8K b - 1", from: "5g", target: "5e", maxMoves: 2, targetLabel: "5五",
          praise: "歩は1手で1マスずつ。2手で5五に着いたね！",
          capture: { sfen: "9/9/9/9/4p4/9/4P4/9/9 b - 1", from: "5g", par: 2, praise: "歩は前の駒しか取れないよ。まっすぐ進んで取れたね！" },
          quiz: { question: "歩はどこへ動けるかな？", options: ["前に1マス", "横に1マス", "斜め前に1マス"], answer: 0, explanation: "歩は前に1マスだけ進めるよ！" },
        }),
        pieceLesson("v1-lance", {
          entryId: "lance", sfen: "k8/9/9/9/9/9/9/9/4L3K b - 1", from: "5i", target: "5c", maxMoves: 1, targetLabel: "5三",
          praise: "香車は前ならどこまでも。1手で5三まで飛んでいけたね！",
          capture: { sfen: "9/9/8s/9/9/8p/9/9/8L b - 1", from: "1i", par: 2, praise: "香車は、前にいる駒まで一気に進んで取れるよ！" },
          quiz: { question: "香車が動けないのはどれ？", options: ["前に2マス", "後ろに1マス", "前に5マス"], answer: 1, explanation: "香車は前にだけ進めて、後ろには戻れないよ。" },
        }),
        pieceLesson("v1-knight", {
          entryId: "knight", sfen: "k8/9/9/9/9/9/9/9/4N3K b - 1", from: "5i", target: "5e", maxMoves: 2, targetLabel: "5五",
          praise: "桂馬は「前に2つ、横に1つ」。ジグザグに跳んで5五に着いたね！",
          capture: { sfen: "9/9/3p5/9/4p4/9/5p3/9/4N4 b - 1", from: "5i", par: 3, praise: "桂馬は駒を飛び越えて跳べる。跳ねるたびに駒が取れたね！" },
          quiz: { question: "桂馬の特徴はどれ？", options: ["後ろに下がれる", "横に動ける", "駒を飛び越えられる"], answer: 2, explanation: "桂馬は、駒を飛び越えられるただ一つの駒だよ！" },
        }),
        pieceLesson("v1-silver", {
          entryId: "silver", sfen: "k8/9/9/9/9/9/9/4S4/8K b - 1", from: "5h", target: "3f", maxMoves: 2, targetLabel: "3六",
          praise: "銀は斜めに強い駒。斜めに2回で3六に着いたね！",
          capture: { sfen: "9/9/9/9/3p5/4p4/5p3/9/4S4 b - 1", from: "5i", par: 4, praise: "銀は斜め前に進めるから、斜めに並んだ駒を順に取れるんだ！" },
          quiz: { question: "銀が動けないのはどこ？", options: ["真横", "斜め後ろ", "真正面"], answer: 0, explanation: "銀は真横と真後ろには動けないよ。" },
        }),
        pieceLesson("v1-gold", {
          entryId: "gold", sfen: "k8/9/9/9/9/9/9/4G4/8K b - 1", from: "5h", target: "3g", maxMoves: 2, targetLabel: "3七",
          praise: "金は横にも動ける。横と斜めを組み合わせて3七に着いたね！",
          capture: { sfen: "9/9/9/9/9/9/1pp6/3p5/4G4 b - 1", from: "5i", par: 3, praise: "金は横にも斜め前にも動けるから、小回りがきくね！" },
          quiz: { question: "金が動けないのはどこ？", options: ["真横", "斜め後ろ", "真後ろ"], answer: 1, explanation: "金は斜め後ろにだけは動けないよ。" },
        }),
        pieceLesson("v1-bishop", {
          entryId: "bishop", sfen: "k8/9/9/9/9/9/9/1B7/8K b - 1", from: "8h", target: "4d", maxMoves: 1, targetLabel: "4四",
          praise: "角は斜めならどこまでも。1手で盤の反対側まで届くね！",
          capture: { sfen: "9/3p5/9/5p3/9/9/9/1B7/9 b - 1", from: "8h", par: 2, praise: "角は斜めに遠くまで利く。離れた駒も一気に取れたね！" },
          quiz: { question: "角はどう動くかな？", options: ["縦と横にどこまでも", "斜めにどこまでも", "周りに1マス"], answer: 1, explanation: "角は斜めにどこまでも進めるよ！" },
        }),
        pieceLesson("v1-rook", {
          entryId: "rook", sfen: "k8/9/9/9/9/9/9/7R1/8K b - 1", from: "2h", target: "5e", maxMoves: 2, targetLabel: "5五",
          praise: "飛車は縦と横にどこまでも。曲がり角で向きを変えて5五に着いたね！",
          capture: { sfen: "9/9/2p4p1/9/9/9/9/2s4R1/9 b - 1", from: "2h", par: 3, praise: "飛車は縦横に遠くまで利く、いちばん強い駒だよ！" },
          quiz: { question: "飛車はどう動くかな？", options: ["縦と横にどこまでも", "斜めにどこまでも", "前に1マス"], answer: 0, explanation: "飛車は縦と横にどこまでも進めるよ！" },
        }),
        pieceLesson("v1-king", {
          entryId: "king", sfen: "k8/9/9/9/9/9/9/9/4K4 b - 1", from: "5i", target: "5g", maxMoves: 2, targetLabel: "5七",
          praise: "玉は周りに1マスずつ。2手で5七に着いたね！",
          capture: { sfen: "9/9/9/9/9/9/6p2/5p3/4K4 b - 1", from: "5i", par: 2, praise: "玉も駒を取れるよ。でも、取られない場所だけに動けるんだ！" },
          quiz: { question: "玉が取られたらどうなる？", options: ["引き分け", "そのまま続ける", "負け"], answer: 2, explanation: "玉を取られたら（詰まされたら）負けだよ。" },
        }),
        {
          id: "v1-promotion",
          title: "駒が成る",
          summary: "敵陣に入って駒を成れる",
          steps: [
            { type: "explain", sfen: "k8/9/9/9/9/9/9/9/8K b - 1", marks: ENEMY_CAMP.filter((usi) => usi !== "9a").map((usi) => [usi, "reach"]), speech: "相手側の3段（敵陣）に駒が入ったり、敵陣の中で動いたりすると「成る」ことができるよ。" },
            { type: "find-move", sfen: "k8/9/9/5S3/9/9/9/9/8K b - 1", answers: ["4d4c+"], marks: [["4c", "key"]], speech: "銀を4三へ進めて成ってみよう！ 成るか聞かれたら「成」を選んでね。", praise: "成銀は金と同じ動き。横にも動けるようになったよ！" },
            { type: "explain", sfen: "k8/9/5+S3/9/9/9/9/9/8K b - 1", pieceSquare: "4c", speech: "成銀は、金と同じ動きになったよ！ 駒を裏返すと、動きが変わるんだ。" },
            {
              type: "capture", sfen: "9/5pp2/4p4/4P4/9/9/9/9/9 b - 1", from: "5d", par: 3,
              speech: "駒取りゲーム！ 歩だけで相手の駒を全部取ろう。5三で歩を取ったら成って「と金」にしよう。と金は金と同じ動きだよ！",
              praise: "と金は金と同じ動き。成ると、歩でも斜めや横の駒を取れるんだ！",
            },
            { type: "choose", question: "成れない駒はどれかな？", options: ["銀", "金", "歩"], answer: 1, explanation: "金と玉は成れないよ。" },
          ],
        },
        {
          id: "v1-hand",
          title: "持ち駒を打とう",
          summary: "取った駒を打てる",
          steps: [
            { type: "explain", sfen: "k8/9/9/4g4/4S4/9/9/9/8K b - 1", marks: [["5d", "target"]], speech: "相手の駒を取ると、その駒は自分の「持ち駒」になるよ。" },
            { type: "find-move", sfen: "k8/9/9/4g4/4S4/9/9/9/8K b - 1", answers: ["5e5d"], speech: "銀で5四の金を取ってみよう！", praise: "金を取ったよ！ 駒台に乗った金は、もう自分の駒なんだ。" },
            { type: "find-move", sfen: "k8/9/9/4S4/9/9/9/9/8K b G 1", anyDropOf: "G", speech: "持ち駒の金を、好きな空きマスに打ってみよう！ 駒台の金を選んでから、打つマスを選ぶよ。", praise: "持ち駒は、空いているマスならどこにでも打てるよ！" },
            { type: "choose", question: "持ち駒を打てないマスはどれ？", options: ["駒があるマス", "空いているマス"], answer: 0, explanation: "持ち駒は、空いているマスにだけ打てるよ。" },
          ],
        },
        {
          id: "v1-fouls",
          title: "反則に気をつけよう",
          summary: "やってはいけない手がわかる",
          steps: [
            { type: "explain", sfen: "k8/9/9/9/9/9/4P4/9/8K b P 1", marks: ["5a", "5b", "5c", "5d", "5e", "5f", "5h", "5i"].map((usi) => [usi, "target"]), speech: "自分の歩がある筋に、もう1枚歩を打つ「二歩」は反則だよ。この盤面だと、5筋には歩を打てないんだ。" },
            { type: "find-move", sfen: "k8/9/9/9/9/9/4P4/9/8K b P 1", anyDropOf: "P", speech: "二歩にならないマスに、持ち駒の歩を打ってみよう！ 5筋に打とうとしても、打てないよ。", praise: "5筋をよけて打てたね。二歩はうっかりやりやすい反則だよ！" },
            { type: "explain", sfen: "k8/9/9/9/9/9/9/9/8K b P 1", marks: RANK_1.filter((usi) => usi !== "9a").map((usi) => [usi, "target"]), speech: "一段目に歩や香を打つと、もう前に進めないから反則。桂は一段目と二段目に打てないよ。" },
            { type: "explain", sfen: "4k4/9/4G4/9/9/9/9/9/8K b P 1", marks: [["5b", "target"]], speech: "歩を打って玉を詰ませる「打ち歩詰め」も反則。盤にある歩を突いて詰ませるのはOKだよ。" },
            { type: "choose", question: "反則ではないのはどれ？", options: ["二歩", "盤の歩を突いて詰ませる", "打ち歩詰め"], answer: 1, explanation: "盤にある歩を突いて詰ませるのは反則じゃないよ！" },
          ],
        },
        bossLesson("v1-c2-boss", {
          title: "駒の動き",
          summary: "8種類の駒を自由に動かせる",
          chapterLabel: "駒の動き",
          steps: [
            {
              type: "capture", sfen: "9/9/9/9/4p4/5p3/6p2/5s3/4S4 b - 1", from: "5i", par: 4,
              speech: "銀だけで、相手の駒を全部取ろう！ 斜めに進むのがコツだよ。",
              praise: "銀の斜めの動きを使いこなせたね！",
            },
            {
              type: "capture", sfen: "9/9/1p7/9/2p6/9/3p5/9/4N4 b - 1", from: "5i", par: 3,
              speech: "こんどは桂馬！ 跳ねる先を考えて、全部取ろう。",
              praise: "桂馬は前にしか跳べないから、取る順番が大事。うまく回れたね！",
            },
            { type: "choose", question: "斜めにどこまでも進めるのは？", options: ["飛車", "角", "香車"], answer: 1, explanation: "角は斜めにどこまでも。飛車は縦と横、香車は前にどこまでもだよ。" },
            { type: "find-move", sfen: "k8/9/9/7P1/9/9/9/9/8K b - 1", answers: ["2d2c+"], marks: [["2c", "key"]], speech: "歩を2三へ進めて、成ってみよう！", praise: "と金のできあがり！ 歩が金と同じ強さになったよ。" },
            { type: "choose", sfen: "k8/9/9/9/9/9/2P6/9/8K b P 1", question: "持ち駒の歩を打つと反則になるのは、どの筋？", options: ["5筋", "7筋", "3筋"], answer: 1, explanation: "7筋にはもう7七の歩があるから、7筋に打つと二歩になるよ。" },
            { type: "choose", sfen: STANDARD_SFEN, marks: [["4i", "key"]], question: "【前の章から】緑のマスの名前は？", options: ["6九", "4九", "4一"], answer: 1, explanation: "右から4筋目、上から九段目で「4九」。金がいるマスだね。" },
          ],
        }),
      ],
    },
  ],
};

// ===== 第2巻 =====

function tesujiFindStep(entryId, speech, praise) {
  const entry = TESUJI[entryId];
  return { type: "find-move", sfen: entry.sfen, moves: entry.moves, answers: entry.arrows, marks: entry.marks, speech, ...(praise ? { praise } : {}) };
}

/** 問題集の問題を解くステップ。台詞を省くと、問題集の出題の台詞を使う。 */
function problemStep(problemId, extra = {}) {
  return { type: "problem", problemId, ...extra };
}

/** 観戦の棋譜を、from手目の局面からto手目まで1手ずつ再生する。 */
function watchReplay(game, from, to, speech, notes, graph) {
  return { type: "replay", moves: game.slice(0, to), from, speech, notes, ...(graph ? { graph } : {}) };
}

/** 観戦の棋譜のply手目まで進めた局面で、実力者が指した次の一手を当てる。 */
function watchQuestion(game, ply, speech) {
  return { type: "find-move", moves: game.slice(0, ply), answers: [game[ply]], speech };
}

/** 観戦の棋譜の最後の一手（詰み）を指させる。 */
function watchFinish(game, speech) {
  return { type: "mate", moves: game.slice(0, -1), solution: [game.at(-1)], speech };
}

const G1 = WATCH_GAME_FUNAGAKOI;
const G2 = WATCH_GAME_KURIDASHI;
const G2_GRAPH = Object.freeze({ moves: G2, evaluations: WATCH_GAME_KURIDASHI_EVALUATIONS });

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
            { type: "find-move", sfen: "k8/9/9/7s1/9/9/9/7R1/8K b - 1", answers: ["2h2d"], speech: "飛車で2四の銀を取ってみよう！", praise: "守られていない銀を、ただで取れたね！" },
            { type: "explain", sfen: "k8/9/7p1/7s1/9/9/9/7R1/8K b - 1", marks: [["2c", "target"], ["2d", "target"]], speech: "でも、こんどは2三に歩がいるよ。銀を取ると、歩で飛車を取り返されちゃうんだ。" },
            { type: "choose", sfen: "k8/9/7p1/7s1/9/9/9/7R1/8K b - 1", question: "2四の銀を飛車で取ると、どうなる？", options: ["何も起きない", "歩で飛車を取り返される"], answer: 1, explanation: "銀（5点）を取っても、飛車（10点）を取られたら大損だね。" },
            {
              type: "find-move", sfen: "k8/9/7p1/7s1/9/9/9/3g3R1/8K b - 1", answers: ["2h6h"],
              speech: "取れる駒が2つあるよ。取り返されない、ただの駒のほうを取ろう！",
              praise: "6八の金は誰にも守られていないから、ただで取れる。取る前に「取り返されないか」を見るのが大事だよ！",
            },
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
            {
              type: "find-move", sfen: "8k/5s3/4g4/9/9/9/9/1b2R4/8K b - 1", answers: ["5h8h"],
              speech: "三手の読みで考えよう。5三の金を取ると、4二の銀に取り返されるね。取り返されないのはどっち？",
              praise: "8八の角は守られていないから、ただ。三手の読みで、損をしない手を選べたね！",
            },
          ],
        },
        {
          id: "v2-fork",
          title: "両取りをかけよう",
          summary: "2枚の駒を同時にねらう",
          steps: [
            { type: "explain", sfen: TESUJI["knight-fork"].sfen, marks: TESUJI["knight-fork"].marks, speech: "1つの駒で2枚の駒を同時にねらう手を「両取り」というよ。相手はどちらか1枚しか守れないんだ。" },
            tesujiFindStep("knight-fork", "桂馬を跳ねて、飛車と金の両取りをかけてみよう！", "飛車と金の両取り！ 相手はどちらか1枚しか逃がせないね。"),
            {
              type: "find-move", sfen: "k8/9/3r1g3/9/3SP4/9/9/9/8K b - 1", answers: ["6e5d"],
              speech: "こんどは銀で両取り！ 銀は斜め前に2つ利くよ。飛車と金を同時にねらえるマスはどこかな？",
              praise: "5四の銀が、飛車と金を同時にねらっているよ。5五の歩が銀を守っているから、取られても取り返せるんだ！",
            },
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
        bossLesson("v2-c1-boss", {
          title: "三手の読み",
          summary: "損をしない手と、両取りを見つけられる",
          chapterLabel: "三手の読み",
          steps: [
            {
              type: "find-move", sfen: "k8/9/5p3/5b3/9/9/9/9/2s2R2K b - 1", answers: ["4i7i"],
              speech: "取れる駒が2つ。取り返されない、ただの駒を取ろう！",
              praise: "7九の銀は守られていない。4四の角は4三の歩に守られているから、取ると飛車を取り返されちゃうね！",
            },
            {
              type: "find-move", sfen: "k8/9/3g1r3/9/4PS3/9/9/9/8K b - 1", answers: ["4e5d"],
              speech: "銀で両取りをかけよう！",
              praise: "金と飛車の両取り！ 5五の歩が銀を守っているよ。",
            },
            { type: "choose", question: "金（6点）を取って、銀（5点）を取られたら？", options: ["駒得", "駒損", "同じ"], answer: 0, explanation: "6点もらって5点渡したから、1点の駒得だね。" },
            { type: "choose", question: "三手の読みの2手目は、だれの手？", options: ["自分", "相手"], answer: 1, explanation: "自分 → 相手 → 自分。相手の応手を考えるのが2手目だよ。" },
            {
              type: "capture", sfen: "9/9/1p5p1/9/9/1s7/9/7R1/9 b - 1", from: "2h", par: 3,
              speech: "【前の巻から】駒取りゲーム！ 飛車だけで全部取ろう。",
              praise: "飛車の縦横の動き、ばっちりだね！",
            },
          ],
        }),
      ],
    },
    {
      id: "v2-c2",
      title: "強い人の対局を観戦しよう",
      lessons: [
        {
          id: "v2-watch-opening",
          title: "序盤の駒組みを観戦しよう",
          summary: "囲ってから戦いを始める",
          steps: [
            { type: "explain", sfen: STANDARD_SFEN, speech: "強い人（先手）と、将棋をおぼえたての人（後手）の対局を観戦しよう！ 戦いが始まるまでに、二人がどんな駒組みをするか注目してね。" },
            watchReplay(G1, 0, 26, "「次の手」を押して、1手ずつ進めてみよう。戻ることもできるよ。", {
              1: "▲7六歩。まずは角道を開けて、角が働けるようにしたよ。",
              3: "▲2六歩。飛車の前の歩を突いて、飛車で攻める準備をしたよ。",
              4: "△4四歩。後手は角道を止めたね。振り飛車によくある指し方だよ。",
              5: "▲2五歩。さらに飛車先の歩を伸ばしたよ。",
              6: "△3三角。後手は角で2筋を守ったね。",
              7: "▲4八銀。銀を上がって、攻めにも守りにも使える準備だよ。",
              8: "△4二飛。後手は飛車を4筋に振ったよ。「四間飛車」だね。",
              11: "▲6八玉。先手は玉を左へ動かし始めたよ。戦いの前に、玉を飛車から遠ざけて囲うんだ。",
              17: "▲7八玉。玉が7八に入ったよ。",
              18: "△2二銀。後手の玉は左の7二にいるのに、金と銀が右に残っていて、玉を守れていないよ。",
              19: "▲5八金。金を玉のそばに寄せたよ。玉を7八、金を5八と6九に置いたこの形が「舟囲い」なんだ。",
              23: "▲3八飛。飛車を3筋へ回したよ。3筋の歩をぶつけて攻めるための作戦なんだ。",
              25: "▲5七銀。銀も5七に上がって、囲いと攻めの形がととのったね。",
            }),
            watchQuestion(G1, 26, "駒組みを終えた先手は、ここで3筋の歩を3五へ突いて戦いを始めたよ。指してみよう！"),
            watchReplay(G1, 27, 30, "歩をぶつけて戦いを始めることを「開戦」というよ。続きを見てみよう。", {
              28: "△5四歩。ここは△3五歩と、ぶつかった歩を取るのが自然だったよ。",
              29: "▲3四歩。先手は歩を取り込んで、3三の角に当てたよ。3筋の歩が敵陣にせまってきた！",
              30: "△5一角。後手は角を逃がしたけれど、先手の攻めが一歩リードしたね。",
            }),
            { type: "choose", question: "先手が戦いを始める前にやったことは？", options: ["玉を囲った", "すぐに飛車を成り込んだ", "角を交換した"], answer: 0, explanation: "強い人は、戦いを始める前に玉を囲うんだ。囲ってから攻めると、安心して戦えるよ。" },
          ],
        },
        {
          id: "v2-watch-endgame",
          title: "終盤の寄せを観戦しよう",
          summary: "と金で玉をつつみこむ",
          steps: [
            watchReplay(G1, 30, 44, "さっきの対局の続きだよ。先手が玉をどうやって寄せていくか見ていこう！", {
              31: "▲5五歩。3筋に続いて、5筋でも歩をぶつけたよ。",
              35: "▲5五銀。銀で歩を取り返して、銀が前に出てきたね。",
              37: "▲3六飛。飛車を3六へ浮いて、横にも利かせたよ。",
              41: "▲3七桂。桂馬も攻めに加わったよ。飛車・角・銀・桂がそろうと攻めが強くなる。「攻めは飛角銀桂」だね。",
              43: "▲4五歩。4筋の歩も伸ばして、と金を作るねらいだよ。",
              44: "△1三銀。後手は端の銀を動かしたけれど、守りには役立たない手だよ。ここは5筋を守るべきだった。",
            }),
            watchQuestion(G1, 44, "後手が守らなかった5筋に、先手は持ち駒の歩を打ったよ。5四に歩を打って、次の5三歩成をねらおう！"),
            watchReplay(G1, 45, 72, "ここから、と金の攻めが始まるよ。", {
              47: "▲4四歩。4筋の歩をもう一つ進めたよ。",
              49: "▲4三歩成。と金ができた！ と金は金と同じ動きなのに、取られても相手には歩1枚しか渡らない。攻めにぴったりの駒だよ。",
              51: "▲5三歩成。2枚目のと金！",
              53: "▲3三歩成。3筋でもと金を作ったよ。",
              55: "▲3三飛成。飛車が敵陣に入って、龍になったよ。",
              57: "▲3六龍。龍をいったん引いて、自分の陣地にも利かせたよ。",
              59: "▲5二と。と金が1マスずつ玉に近づいていくよ。",
              61: "▲6二と。と金の攻めはおそく見えて、実はとても速いんだ。「と金のおそはや」という格言があるよ。",
              65: "▲7一と。と金で角を取ったよ。",
              67: "▲7二と。こんどは銀を取った！ 後手の玉のまわりがどんどん薄くなっていくね。",
              69: "▲7三と。金も取ったよ。と金が玉をつつみこんでいくね。",
              71: "▲7一角打。持ち駒の角を打って、玉の逃げ道をふさいだよ。",
              72: "△6六歩。後手の最後の反撃。でも、先手にはもう詰みがあるよ。",
            }),
            watchFinish(G1, "最後の一手！ 持ち駒の金で、後手の玉を詰ませよう！"),
            { type: "explain", speech: "先手は、囲ってから歩で戦いを始めて、と金で玉をつつみこんで勝ったね。と金は取られても損が少ないから、どんどん作って攻めよう！" },
          ],
        },
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
            { type: "explain", sfen: "4k4/9/9/9/9/9/9/9/4R3K w - 1", marks: [["5a", "target"], ["5i", "key"]], speech: "次に玉を取ろうとする手を「王手」というよ。この盤面では、5九の飛車が王手をかけているね。" },
            { type: "explain", speech: "王手をかけられたら、①玉が逃げる ②王手している駒を取る ③間に駒を置く（合駒）のどれかで防ぐよ。" },
            { type: "explain", sfen: "4k4/4G4/5S3/9/9/9/9/9/4K4 w - 1", marks: [["5a", "target"]], speech: "どの方法でも防げない王手が「詰み」。ここまでくれば勝ちだよ！" },
            { type: "choose", question: "王手の防ぎ方ではないのは？", options: ["玉が逃げる", "間に駒を置く", "ほかの駒を動かして知らんぷり"], answer: 2, explanation: "王手を放っておくのは反則だよ。" },
            {
              type: "find-move", sfen: "4k4/9/9/9/7R1/9/9/9/8K b - 1", answers: ["2e2a+", "2e2a", "2e5e"],
              speech: "飛車で、相手の玉に王手をかけてみよう！ 王手のかけ方は1つじゃないよ。",
              praise: "王手！ 飛車の利きが、玉までまっすぐ通ったね。",
            },
          ],
        },
        {
          id: "v2-escape-drill",
          title: "王手から逃げよう",
          summary: "王手を受けて、詰まされずにすむ",
          icon: "逃",
          steps: [
            { type: "explain", speech: "こんどは守る番！ 王手をかけられたら、逃げる・取る・間に駒を打つ、のどれかで防ぐよ。逃げたあとに詰まされないか、三手の読みで考えてね。" },
            problemStep("escape-from-gold"),
            problemStep("block-with-pawn"),
            problemStep("escape-twice"),
          ],
        },
        {
          id: "v2-mate-head-gold",
          title: "1手詰め：頭金",
          summary: "玉の頭に金を打つ",
          steps: [
            { type: "explain", sfen: TESUJI["head-gold"].sfen, marks: TESUJI["head-gold"].marks, speech: "玉の頭（真上）に金を打つ「頭金」は、詰みの基本の形だよ。" },
            { type: "mate", sfen: TESUJI["head-gold"].sfen, solution: ["G*5b"], speech: "1手で詰ませてみよう！", praise: "頭金！ 4三の銀が金を守っているから、玉は金を取れないんだ。" },
          ],
        },
        {
          id: "v2-mate-knight",
          title: "1手詰め：桂の王手",
          summary: "合駒できない王手",
          steps: [
            { type: "explain", sfen: "7nk/7bp/9/9/9/9/9/9/1K7 b N 1", marks: [["1a", "target"]], speech: "桂馬の王手は、間に駒を置いて防げないよ。玉のまわりが自分の駒でふさがっていたら大チャンス！" },
            { type: "mate", sfen: "7nk/7bp/9/9/9/9/9/9/1K7 b N 1", solution: ["N*2c"], speech: "持ち駒の桂馬で、1手で詰ませてみよう！", praise: "玉のまわりは自分の駒でいっぱい。桂の王手は間に駒を置けないから、詰みだよ！" },
          ],
        },
        {
          id: "v2-double-check",
          title: "両王手",
          summary: "2つの王手を同時にかける",
          steps: [
            { type: "explain", sfen: TESUJI["double-check"].sfen, marks: TESUJI["double-check"].marks, speech: "2つの駒で同時に王手をかける「両王手」は、玉が逃げるしかない強力な王手だよ。" },
            tesujiFindStep("double-check", "桂馬を跳ねて、両王手をかけてみよう！", "桂と飛車の両王手！ 2つの王手は、間に駒を置いても防げないんだ。"),
          ],
        },
        {
          id: "v2-mate-drill",
          title: "1手詰めドリル",
          summary: "1手詰めを5問解ける",
          icon: "詰",
          steps: [
            { type: "explain", speech: "1手詰めドリル！ 将棋問題集の問題を5問解いてみよう。解いた問題は、問題集にも記録されるよ。" },
            problemStep("head-gold-or-silver"),
            problemStep("gts-2dc3c1a6911d", { speech: "後手玉を1手で詰ませてみよう！ 玉の頭に注目してね。" }),
            problemStep("gts-0be7440e0da0", { speech: "持ち駒の桂馬で、1手で詰ませてみよう！" }),
            problemStep("gts-1879c85bae07", { speech: "持ち駒の飛車で、1手で詰ませてみよう！ 打つ場所がポイントだよ。" }),
            problemStep("mate-over-rook"),
          ],
        },
        {
          id: "v2-mate-three",
          title: "3手詰めに挑戦",
          summary: "捨て駒で守りをくずす",
          steps: [
            { type: "explain", speech: "3手詰めは「王手 → 相手の応手 → 詰み」の3手。三手の読みと同じ順番だね。1手目に、わざと駒を取らせる「捨て駒」がよく出てくるよ。" },
            { type: "mate", sfen: "7gk/9/7BP/9/9/9/9/9/K8 b G 1", solution: ["G*1b", "2a1b", "1c1b+"], speech: "3手で詰ませてみよう！ 1手目は、取られてもいい場所に金を打つのがポイントだよ。" },
            { type: "explain", sfen: "8k/8g/7BP/9/9/9/9/9/K8 b g 1", marks: [["1b", "key"]], arrows: ["1c1b+"], speech: "金を捨てると、相手の金が1二へ動いたね。そこを歩で取って成れば詰み！ 捨て駒で、相手の駒を取りやすい場所へおびき寄せたんだ。" },
            { type: "mate", sfen: "6k2/5g3/6G2/9/9/9/9/9/K8 b GN 1", solution: ["N*4c", "4b4c", "G*3b"], speech: "次の問題！ 玉の横にいる4二の金が、じゃまをしているよ。3手で詰ませてみよう！" },
            { type: "mate", sfen: "3sk4/2+R2p3/3s2N2/9/9/9/9/9/K8 b NS 1", solution: ["N*4c", "4b4c", "S*4b"], speech: "最後の問題！ 桂馬と銀を使って、3手で詰ませてみよう！" },
            { type: "explain", speech: "3手詰めクリア！ 捨て駒で相手の守りの駒を動かしてから詰ませる。これが詰みを見つけるコツだよ。" },
          ],
        },
        {
          id: "v2-mate3-drill",
          title: "3手詰めドリル",
          summary: "3手詰めを4問解ける",
          icon: "詰",
          steps: [
            { type: "explain", speech: "3手詰めドリル！ 王手 → 相手の応手 → 詰み。1手目の王手を、いろいろ試してみてね。" },
            problemStep("take-knight-and-drop"),
            problemStep("where-to-drop-bishop"),
            problemStep("two-rooks"),
            problemStep("kings-face-to-face"),
          ],
        },
        {
          id: "v2-mating-shapes",
          title: "詰みの形を覚えよう",
          summary: "頭金と腹銀",
          steps: [
            { type: "explain", speech: "詰みには、よく出てくる「形」があるよ。形を覚えておくと、実戦ですぐに気づけるんだ。" },
            { type: "open-dex", kind: "tesuji", id: "head-gold", speech: "手筋図鑑の「頭金」を見てみよう！" },
            { type: "explain", sfen: TESUJI["belly-silver"].sfen, marks: TESUJI["belly-silver"].marks, speech: "次は「腹銀」。玉の真横（お腹）に銀を打つ形だよ。" },
            tesujiFindStep("belly-silver", "持ち駒の銀を、玉のお腹に打ってみよう！", "腹銀！ 玉は横にも後ろにも逃げられないね。"),
          ],
        },
        bossLesson("v2-c3-boss", {
          title: "玉をつかまえよう",
          summary: "1手詰め・3手詰めと、王手の受けができる",
          chapterLabel: "玉のつかまえ方",
          steps: [
            problemStep("gts-3db44c887f1e", { speech: "1手で詰ませよう！" }),
            problemStep("gts-2ee7a9e93d50", { speech: "持ち駒の銀で、1手で詰ませよう！" }),
            problemStep("gts-09300d8d51d8", { speech: "3手で詰ませよう！ 1手目は、駒を成る王手から考えてみてね。" }),
            problemStep("rook-and-bishop"),
            { type: "choose", question: "両王手をかけられたら、防ぎ方は？", options: ["玉が逃げる", "間に駒を打つ", "王手の駒を1つ取る"], answer: 0, explanation: "2つの王手は、間に打っても1つ取っても防げない。玉が逃げるしかないよ。" },
            {
              type: "find-move", sfen: "k8/9/3r1g3/9/3SP4/9/9/9/8K b - 1", answers: ["6e5d"],
              speech: "【前の章から】銀で両取りをかけよう！",
              praise: "飛車と金の両取り、思い出せたね！",
            },
          ],
        }),
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
            { type: "explain", moves: ["7g7f", "3c3d", "6g6f", "8c8d", "2h6h"], marks: [["6h", "key"]], speech: "飛車を左へ動かして戦うのが「振り飛車」。この盤面は、飛車を6筋に振った「四間飛車」だよ。" },
            { type: "choose", question: "飛車を左に動かして戦うのは？", options: ["居飛車", "振り飛車"], answer: 1, explanation: "飛車を振るから「振り飛車」だよ！" },
            { type: "choose", moves: ["7g7f", "3c3d", "7f7e", "8c8d", "2h7h"], marks: [["7h", "key"]], question: "この盤面の先手は、居飛車と振り飛車のどっち？", options: ["居飛車", "振り飛車"], answer: 1, explanation: "飛車が7筋に動いているから振り飛車。7筋の飛車は「三間飛車」だよ。" },
          ],
        },
        {
          id: "v3-castles",
          title: "囲いで玉を守ろう",
          summary: "金銀で玉を囲う",
          steps: [
            { type: "explain", sfen: TESUJI["three-guards"].sfen, marks: TESUJI["three-guards"].marks, speech: "戦う前に、金と銀で玉を守る形を作るよ。これを「囲い」というんだ。この形が「美濃囲い」だよ。" },
            { type: "explain", speech: "囲いの基本は「金銀3枚」。攻めに使う駒と、守りに使う駒を分けて考えよう。" },
            { type: "open-dex", kind: "opening", id: "mino", speech: "定跡図鑑の「囲い」で、いろいろな囲いを見てみよう！" },
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
                // 十五級程度。
                cpuLevel: 12,
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
        bossLesson("v3-c1-boss", {
          title: "戦法と囲い",
          summary: "居飛車・振り飛車と囲いを見分けられる",
          chapterLabel: "戦法と囲い",
          steps: [
            { type: "choose", moves: ["7g7f", "3c3d", "2g2f", "8c8d", "2f2e"], marks: [["2h", "key"]], question: "この先手は、居飛車と振り飛車のどっち？", options: ["居飛車", "振り飛車"], answer: 0, explanation: "飛車が最初の2筋のまま。2筋の歩を伸ばして攻める居飛車だね。" },
            { type: "choose", sfen: TESUJI["three-guards"].sfen, marks: TESUJI["three-guards"].marks, question: "この囲いの名前は？", options: ["美濃囲い", "矢倉囲い", "穴熊"], answer: 0, explanation: "玉を2八に置いて、金銀で横から包む形が「美濃囲い」。振り飛車の代表的な囲いだよ。" },
            { type: "choose", question: "玉の守りの基本は？", options: ["金銀3枚", "飛車と角", "歩をたくさん"], answer: 0, explanation: "「玉の守りは金銀3枚」。この格言を覚えておこう！" },
            problemStep("gts-22d2d6dacae5", { speech: "【前の巻から】1手で詰ませよう！ 歩を成るのもありだよ。" }),
          ],
        }),
      ],
    },
    {
      id: "v3-c2",
      title: "攻めと受けを観戦しよう",
      lessons: [
        {
          id: "v3-watch-attack",
          title: "攻めと受けの対局を観戦しよう",
          summary: "銀の繰り出しと玉の早逃げ",
          steps: [
            { type: "explain", speech: "こんどは攻めと受けに注目して観戦しよう！ 先手が強い人、後手が将棋をおぼえたての人だよ。" },
            watchReplay(G2, 18, 30, "駒組みが進んだところから見ていくよ。先手の銀の動きに注目してね。", {
              19: "▲3八飛。攻めたい3筋へ飛車を回したよ。",
              20: "△5二飛。後手は飛車を5筋へ動かして「中飛車」にしたよ。",
              21: "▲5七銀。銀が飛車の応援に向かうよ。",
              23: "▲7八玉。攻める前に、玉を安全な場所へ移しておくのを忘れないね。",
              25: "▲3五歩。歩をぶつけて開戦！",
              27: "▲4六銀。銀を5七から4六へ、さらに前へ出していくよ。",
              29: "▲3五銀。飛車と銀が3筋に集まった！ 飛車の前に銀を出して、2枚の力で攻めるのが攻めのコツだよ。",
              30: "△5二金。後手は3筋の攻めに備えていないよ。",
            }),
            watchQuestion(G2, 30, "ここで先手は、持ち駒の歩を使った手筋を指したよ。3四に歩を打って、3三の角の頭をたたこう！"),
            watchReplay(G2, 31, 44, "たたかれた角を、後手はどう受けるかな？", {
              32: "△7一飛。後手は飛車を動かしたけれど、角を逃がさなかったよ。ここは△4二角と角を逃がすのがよかったんだ。",
              33: "▲3三歩成。角をただで取ったうえに、と金までできたよ！",
              35: "▲2四歩。次は2筋の歩で、2三へ成り込むねらいだよ。",
              37: "▲2三歩成。2枚目のと金！ 歩は敵陣に入ると、と金になって強くなるんだ。",
              39: "▲4六銀。4五の桂に、銀でねらいをつけたよ。",
              40: "△5四銀。後手は銀で桂を守ったけれど、ここは△7二玉と、先に玉を安全な場所へ逃がすのがよかったよ。これが「玉の早逃げ」だね。",
              41: "▲4四角。盤の角を4四へ出して、敵陣をにらんだよ。",
              43: "▲4五銀。桂を取ったよ。",
              44: "△9二香。ここでも△7二玉と早逃げするべきだった。受けは、攻められている場所から玉を遠ざけるのが大事だよ。",
            }),
            watchReplay(G2, 44, 66, "ここから先手の大駒が敵陣に入っていくよ。", {
              45: "▲3二飛成。飛車が敵陣に入って龍になった！",
              47: "▲1一角成。角も香を取って馬になったよ。龍と馬がそろうと、攻めがぐっと強くなるんだ。",
              49: "▲5五馬。馬を中央へ引いたよ。馬は真ん中にいると、攻めにも守りにもよく利くんだ。",
              51: "▲1二龍。4二の金に当たった龍を、1二へ逃がしたよ。敵陣にいる龍は、横に動いて相手の駒をねらえるんだ。",
              53: "▲6五馬。馬で銀を取ったよ。",
              55: "▲8五桂打。持ち駒の桂馬も、玉の近くに打って攻めに使うよ。",
              57: "▲3二と。と金が玉に向かって進んでいくよ。",
              59: "▲4一と。と金で金を取った！",
              61: "▲5一と。こんどは飛車まで取ったよ。後手の玉の守りがほとんどなくなったね。",
              63: "▲9二飛打。取った飛車を打って、玉を上からねらうよ。",
              65: "▲7二香打。香を打って王手！",
              66: "△7二金。後手は金で香を取ったけれど、ここで先手に詰みがあるよ。",
            }),
            watchFinish(G2, "最後の一手！ 9二の飛車で7二の金を取って、詰ませよう！"),
            { type: "choose", question: "攻められている側が気をつけることは？", options: ["玉を早めに安全な場所へ逃がす", "攻められている場所に玉を近づける", "受けずに駒をたくさん動かす"], answer: 0, explanation: "「玉の早逃げ八手の得」。危なくなる前に玉を逃がしておくと、なかなか詰まされないよ。" },
          ],
        },
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
            tesujiFindStep("one-pawn", "持ち駒の歩を、玉と竜の間に打ってみよう！", "歩1枚で竜の王手を止めたね。安い駒の合駒が「一歩千金」だよ！"),
          ],
        },
        {
          id: "v3-early-escape",
          title: "玉の早逃げ",
          summary: "危なくなる前に逃げる",
          steps: [
            { type: "explain", sfen: TESUJI["early-escape"].sfen, marks: TESUJI["early-escape"].marks, speech: "「玉の早逃げ八手の得」。王手をかけられる前に、玉を安全な場所へ動かしておこう。" },
            tesujiFindStep("early-escape", "玉を2九へ逃がしてみよう！", "王手をかけられる前に、竜から離れられたね。早逃げは何手分もの得になるよ！"),
          ],
        },
        {
          id: "v3-bottom-pawn",
          title: "金底の歩",
          summary: "一段目の歩は堅い",
          steps: [
            { type: "explain", sfen: TESUJI["gold-bottom-pawn"].sfen, marks: TESUJI["gold-bottom-pawn"].marks, speech: "竜が一段目から、玉の下をねらっているよ。こういうときは「金底の歩」が効くんだ。" },
            tesujiFindStep("gold-bottom-pawn", "金の真下の3九に歩を打って、竜の横利きを止めよう！", "金底の歩で竜の横利きが止まった。「岩よりも堅し」だね！"),
          ],
        },
        bossLesson("v3-c3-boss", {
          title: "攻めと守り",
          summary: "攻めの駒と、受けの手筋を使える",
          chapterLabel: "攻めと守りのコツ",
          steps: [
            { type: "choose", question: "攻めの主役は？", options: ["飛車・角・銀・桂", "金・玉・歩・香"], answer: 0, explanation: "「攻めは飛車角銀桂」。金は玉の守りに残しておこう。" },
            tesujiFindStep("one-pawn", "竜の王手！ 持ち駒で合駒しよう。", "合駒で王手を止めたね！"),
            tesujiFindStep("gold-bottom-pawn", "竜が一段目から玉の下をねらっているよ。受けの手筋で止めよう！", "金底の歩、覚えていたね！"),
            tesujiFindStep("early-escape", "竜がせまってきた。王手される前に、玉を安全な場所へ！", "早逃げ、ばっちり！"),
            problemStep("escape-twice", { speech: "【前の巻から】金で王手！ 持ち駒の金は2枚。詰まないように逃げよう！" }),
            problemStep("gts-36ca70155b6c", { speech: "【前の巻から】3手で詰ませよう！" }),
          ],
        }),
      ],
    },
  ],
};

// ===== 第4巻 =====

/**
 * 定跡の練習の台詞。定跡図鑑の「目的」（〜すること！）は見出し向けの文なので、
 * 教室では形ができたあとに次にやることを話しかける文を使う。
 */
const DRILL_TEXTS = {
  shiken: {
    name: "四間飛車",
    summary: "美濃囲いで受けて、さばいて反撃",
    next: "ここから美濃囲いで玉を固めて、相手の攻めを受け止めよう！ 攻めてきた駒を飛車と角でさばいて、反撃していこう！",
  },
  sangen: {
    name: "三間飛車",
    summary: "相手の急戦をさばいて反撃",
    next: "ここから玉を美濃囲いに入れて、相手の急戦に備えよう！ 攻めてきたら、飛車と角でさばいて反撃していこう！",
  },
  nakabisha: {
    name: "中飛車",
    summary: "5筋から中央を突破",
    next: "ここから5筋に攻め駒を集めて、中央から突破していこう！",
  },
  mukai: {
    name: "向かい飛車",
    summary: "相手の飛車先交換をむかえうつ",
    next: "ここから、相手が飛車先の歩を交換しに来たら、向かい合った飛車で逆襲していこう！",
  },
  bougin: {
    name: "棒銀",
    summary: "銀をまっすぐ出して2筋を突破",
    next: "ここから銀をさらに前へ進めて、2筋を突破していこう！ 飛車が敵陣で成れたら大成功だよ！",
  },
  "hayaguri-gin": {
    name: "早繰り銀",
    summary: "相手が囲う前に仕掛ける",
    next: "ここから、相手の駒組みが整う前に、銀と歩で攻めていこう！",
  },
  "koshikake-gin": {
    name: "腰掛け銀",
    summary: "銀・桂・飛車で厚く攻める",
    next: "ここから桂馬も跳ねて、銀・桂・飛車の力で厚く攻めていこう！",
  },
  "yagura-strategy": {
    name: "矢倉",
    summary: "堅く囲ってから攻める",
    next: "ここから矢倉囲いを完成させて、玉を堅くしてから攻めていこう！",
  },
};

/** 定跡図鑑の手順(相手の応手は省いた盤面)。 */
function drillReplay(strategyId) {
  const definition = OPENING_STRATEGIES.find((strategy) => strategy.id === strategyId);
  return buildOpeningDexSteps(definition, {
    initialSfen: STANDARD_SFEN,
    routines: OPENING_GUIDE_ROUTINES,
    formatLabel: (usi, beforeSfen) => formatHintMove(usi, beforeSfen),
  });
}

/** 定跡の練習で組んだ形を見せて、どの戦法かを当てる(腕だめし)。選択肢は短い呼び名(DRILL_TEXTSのname)。 */
function drillIdentifyStep(strategyId, options) {
  const { name, summary } = DRILL_TEXTS[strategyId];
  return {
    type: "choose",
    sfen: drillReplay(strategyId).at(-1).sfen,
    question: "この形の戦法はどれ？",
    options,
    answer: options.indexOf(name),
    explanation: `${name}だよ。作戦は「${summary}」だね。`,
  };
}

/** 定跡図鑑の手順をなぞる練習。相手の応手は定跡図鑑と同じく省いた盤面で進める。 */
function openingDrillLesson(id, strategyId) {
  const definition = OPENING_STRATEGIES.find((strategy) => strategy.id === strategyId);
  const explanation = openingExplanation(strategyId);
  const replay = drillReplay(strategyId);
  const steps = [{ type: "explain", sfen: STANDARD_SFEN, speech: `「${definition.label}」を指してみよう！ ${explanation?.overview ?? ""} 手順どおりに1手ずつ指していくよ。` }];
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
        praise: `${step.label}、定跡どおり！`,
      });
    }
  }
  steps.push({ type: "explain", sfen: replay.at(-1).sfen, speech: `${definition.label}の形ができたね！ ${DRILL_TEXTS[strategyId].next}` });
  steps.push({ type: "open-dex", kind: "opening", id: strategyId, speech: "定跡図鑑で、手順をもう一度確かめてみよう！" });
  return { id, title: definition.label, summary: DRILL_TEXTS[strategyId].summary, steps };
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
        bossLesson("v4-c1-boss", {
          title: "振り飛車",
          summary: "振り飛車の4つの戦法を見分けられる",
          chapterLabel: "振り飛車",
          steps: [
            drillIdentifyStep("shiken", ["四間飛車", "三間飛車", "中飛車"]),
            drillIdentifyStep("nakabisha", ["向かい飛車", "中飛車", "四間飛車"]),
            drillIdentifyStep("mukai", ["三間飛車", "中飛車", "向かい飛車"]),
            drillIdentifyStep("sangen", ["三間飛車", "四間飛車", "向かい飛車"]),
            { type: "choose", sfen: TESUJI["three-guards"].sfen, marks: TESUJI["three-guards"].marks, question: "【前の巻から】振り飛車でよく組む、この囲いは？", options: ["舟囲い", "美濃囲い", "矢倉囲い"], answer: 1, explanation: "美濃囲い。横からの攻めに強い囲いだよ。" },
          ],
        }),
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
        bossLesson("v4-c2-boss", {
          title: "居飛車",
          summary: "居飛車の4つの戦法を見分けられる",
          chapterLabel: "居飛車",
          steps: [
            drillIdentifyStep("bougin", ["棒銀", "腰掛け銀", "矢倉"]),
            drillIdentifyStep("koshikake-gin", ["早繰り銀", "腰掛け銀", "棒銀"]),
            drillIdentifyStep("hayaguri-gin", ["早繰り銀", "棒銀", "矢倉"]),
            drillIdentifyStep("yagura-strategy", ["腰掛け銀", "早繰り銀", "矢倉"]),
            problemStep("gts-13acdd343c7a", { speech: "【前の巻から】3手で詰ませよう！ 持ち駒の香をどこに打つかな？" }),
          ],
        }),
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
      { type: "explain", sfen: entry.sfen, moves: entry.moves, marks: entry.marks, speech: `「${entry.label}」という格言があるよ。${entry.overview}` },
      { type: "find-move", sfen: entry.sfen, moves: entry.moves, answers: entry.arrows, marks: entry.marks, speech: `この局面で、「${entry.label}」のとおりに指してみよう！`, praise: `「${entry.label}」のとおり！` },
      { type: "explain", sfen: entry.sfen, moves: entry.moves, marks: entry.marks, arrows: entry.arrows, speech: entry.rows[0][1] },
    ];
  });
  return { id, title, summary: entryIds.map((entryId) => TESUJI[entryId].label).join("・"), steps };
}

/** 格言の課題を1問だけ出す(腕だめし)。どの格言かは伏せて、局面から考えさせる。 */
function proverbFindStep(entryId) {
  const entry = TESUJI[entryId];
  return {
    type: "find-move", sfen: entry.sfen, moves: entry.moves, answers: entry.arrows, marks: entry.marks,
    speech: "この局面で、いちばん良い手を指そう！ 格言がヒントになるよ。",
    praise: `「${entry.label}」の手だね！`,
  };
}

const VOLUME_5 = {
  id: "v5",
  title: "形勢を読んで、格言を生かそう",
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
            { type: "explain", sfen: STANDARD_SFEN, graph: G2_GRAPH, speech: "将棋AIは、形勢を「評価値」という数字で表すよ。プラスなら先手が有利、マイナスなら後手が有利なんだ。" },
            { type: "explain", sfen: STANDARD_SFEN, graph: G2_GRAPH, speech: "下のグラフは、第3巻で観戦した対局の評価値だよ。横が手数、縦が評価値。はじめの局面は+70で、ほとんど互角なんだ。" },
            watchReplay(G2, 28, 33, "28手目まで進んだところ。評価値は+772で、先手が少し有利だよ。「次の手」で進めて、グラフの動きを見てみよう。", {
              29: "▲3五銀。評価値は+801で、ほとんど変わらないね。どちらも悪い手を指していないあいだは、グラフはあまり動かないんだ。",
              30: "△5二金。評価値が+2055にはね上がった！ 3筋の攻めに備えなかったこの手が、後手の失敗だったんだ。",
              31: "▲3四歩打。角の頭をたたく手筋だよ。評価値は+2156で、先手はリードを保っているね。",
              32: "△7一飛。評価値は+4191！ 角を逃がさなかったから、また大きく先手に傾いたよ。",
              33: "▲3三歩成。角を取って、と金もできた。このあともグラフは先手のほうへ伸びていくよ。",
            }, G2_GRAPH),
            { type: "explain", moves: G2, graph: G2_GRAPH, speech: "最後まで進めると、グラフはこうなるよ。30手目と32手目で大きくはね上がっているね。グラフが大きく動いたところが勝負の分かれ目なんだ。" },
            { type: "explain", moves: G2, graph: G2_GRAPH, speech: "自分の対局でも、終わったあと「棋譜解析」を開くと、このグラフが見られるよ。グラフが大きく動いた手を見直すと、強くなれるんだ。" },
            { type: "choose", question: "評価値がプラスのときは？", options: ["先手が有利", "後手が有利", "引き分け"], answer: 0, explanation: "プラスは先手、マイナスは後手が有利だよ。" },
            { type: "choose", question: "評価値のグラフが大きく動いたところは？", options: ["勝負の分かれ目", "何も起きていない", "対局が終わった"], answer: 0, explanation: "大きく動いた手は、どちらかが失敗した手だよ。そこを見直そう！" },
          ],
        },
        bossLesson("v5-c1-boss", {
          title: "形勢判断",
          summary: "形勢の3つのものさしと評価値を使える",
          chapterLabel: "形勢の読み方",
          steps: [
            { type: "choose", sfen: TESUJI["dragon-enemy-horse-home"].sfen, marks: TESUJI["dragon-enemy-horse-home"].marks, question: "敵陣の竜と、自陣の馬。3つのものさしのどれに当たる？", options: ["駒の損得", "玉の堅さ", "駒の働き"], answer: 2, explanation: "よく利く場所にいる駒は強い。「駒の働き」だね。" },
            { type: "choose", question: "評価値が -1500 のときは？", options: ["先手が有利", "後手が有利", "互角"], answer: 1, explanation: "マイナスは後手が有利。1500は大きな差だよ。" },
            { type: "choose", question: "飛車（10点）と金（6点）を交換したら？", options: ["飛車を渡したほうが駒損", "飛車を渡したほうが駒得", "同じ"], answer: 0, explanation: "10点を渡して6点もらうから、4点の駒損だね。" },
            problemStep("where-to-drop-bishop", { speech: "【前の巻から】角をどこに打てば詰むかな？ 3手で詰ませよう！" }),
          ],
        }),
      ],
    },
    {
      id: "v5-c2",
      title: "格言で強くなろう",
      lessons: [
        proverbLesson("v5-pawn-proverbs", "歩の格言にチャレンジ", ["edge-king-edge-pawn", "rook-pawn-exchange", "dangling-pawn", "focal-pawn"]),
        proverbLesson("v5-minor-proverbs", "駒の格言にチャレンジ", ["knight-fork", "knight-check", "silver-without-promotion"]),
        proverbLesson("v5-major-proverbs", "大駒の格言にチャレンジ", ["rook-cross-fork", "drop-major-far", "one-gap-dragon"]),
        bossLesson("v5-c2-boss", {
          title: "卒業試験",
          summary: "格言と詰みの力で、実戦の手が見つけられる",
          chapterLabel: "教室の全部",
          steps: [
            proverbFindStep("rook-cross-fork"),
            proverbFindStep("knight-check"),
            proverbFindStep("focal-pawn"),
            problemStep("gts-41d725db95c6", { speech: "3手で詰ませよう！ 最後の試験だよ。" }),
            problemStep("two-rooks"),
            {
              type: "capture", sfen: "9/1p7/1s7/3p5/9/9/6p2/9/8B b - 1", from: "1i", par: 4,
              speech: "【第1巻から】駒取りゲーム！ 角だけで全部取ろう。敵陣で成って馬になると、縦横にも1マス動けるよ！",
              praise: "角の斜めと、成った馬の縦横を使いこなせたね！",
            },
          ],
        }),
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
