import { Position, RecordMetadataKey, Square, importKIF } from "tsshogi";
import { appendUsiMove, createGameRecord } from "../game-state";
import { AMANO_SOHO_KIFU, HABU_YOSHIHARU_52GIN_KIFU, KOYAMA_REO_ENTRANCE_KIFU, OHASHI_SOKEI_SANSA_KIFU } from "../data/reference-kifu.mjs";

/**
 * 駒図鑑・手筋図鑑・将棋界図鑑の収録内容。
 * 各項目は盤面（SFENまたは平手からの手順）と、升の色付け・矢印・解説を持つ。
 * 代表局の棋譜（KIF形式）を持つ項目は、定跡図鑑と同じように1手ずつ並べられる。
 * flipを付けた項目は、後手を下にした盤面で開く。
 * 升はUSI表記（例: 5e）。先手側から見た盤面で書く。
 */

const STANDARD = "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1";

/** 5五に1枚だけ駒を置いた局面。玉は動きの範囲に入らない8一・2九へ置く。 */
function lonePieceSfen(symbol) {
  if (symbol === "K") return "1k7/9/9/9/4K4/9/9/9/9 b - 1";
  return `1k7/9/9/9/4${symbol}4/9/9/9/7K1 b - 1`;
}

export const REFERENCE_DEX_KINDS = Object.freeze({
  piece: {
    title: "駒図鑑",
    listLabel: "駒一覧",
    description: "駒の動き・役割・弱点を、盤面で確かめよう。",
  },
  tesuji: {
    title: "手筋図鑑",
    listLabel: "格言一覧",
    description: "「端玉には端歩」のような格言と、その使いどころ。",
  },
  world: {
    title: "将棋界図鑑",
    listLabel: "項目一覧",
    description: "将棋の歴史や、名棋士の逸話を紹介するよ。",
  },
});

const PIECE_ENTRIES = [
  {
    id: "piece-values", group: "駒の価値", label: "駒の価値 tier表",
    // 盤面の代わりに表を出す項目。点数はよく使われる目安で、局面によって変わる。
    table: [
      { tier: "別格", pieces: [{ label: "玉将・王将", images: ["black_king2", "black_king"], points: "∞" }] },
      { tier: "S", pieces: [
        { label: "竜王", images: ["black_dragon"], points: 12 },
        { label: "竜馬", images: ["black_horse"], points: 10 },
        { label: "飛車", images: ["black_rook"], points: 10 },
      ] },
      { tier: "A", pieces: [
        { label: "角行", images: ["black_bishop"], points: 8 },
        { label: "と金", images: ["black_prom_pawn"], points: 7 },
      ] },
      { tier: "B", pieces: [
        { label: "金将", images: ["black_gold"], points: 6 },
        { label: "成銀・成桂・成香", images: ["black_prom_silver", "black_prom_knight", "black_prom_lance"], points: 6 },
        { label: "銀将", images: ["black_silver"], points: 5 },
      ] },
      { tier: "C", pieces: [
        { label: "桂馬", images: ["black_knight"], points: 4 },
        { label: "香車", images: ["black_lance"], points: 3 },
      ] },
      { tier: "D", pieces: [{ label: "歩兵", images: ["black_pawn"], points: 1 }] },
    ],
    // やねうら王の探索で、駒得の見積もり（静的交換評価など）に使う駒の値。歩＝90を基準とする。
    aiTable: {
      title: "将棋AI（やねうら王）が使う駒の価値",
      note: "歩を90点としたときの点数。右は歩を1としたときの目安だよ。",
      pieces: [
        { label: "歩兵", images: ["black_pawn"], value: 90 },
        { label: "香車", images: ["black_lance"], value: 315 },
        { label: "桂馬", images: ["black_knight"], value: 405 },
        { label: "銀将", images: ["black_silver"], value: 495 },
        { label: "金将", images: ["black_gold"], value: 540 },
        { label: "角行", images: ["black_bishop"], value: 855 },
        { label: "飛車", images: ["black_rook"], value: 990 },
        { label: "と金・成香・成桂・成銀", images: ["black_prom_pawn", "black_prom_lance", "black_prom_knight", "black_prom_silver"], value: 540 },
        { label: "竜馬", images: ["black_horse"], value: 945 },
        { label: "竜王", images: ["black_dragon"], value: 1395 },
      ],
    },
    overview: "駒にはだいたいの「価値」があるよ。交換するときの損得の目安にしよう！",
    rows: [
      ["強さの順番", "成る前の駒は、歩＜香車＜桂馬＜銀＜金＜角＜飛車の順に価値が高いよ。大駒の飛車と角は別格で、金銀は玉の守りに欠かせないんだ。桂は動ける場所こそ少ないけれど、駒を飛び越えて両取りをかけられる分、香より価値が高いとされるよ。"],
      ["使い方", "駒を交換するときは、取った駒と取られた駒の点数を比べよう。たとえば銀（5点）で金（6点）を取れれば1点の得だよ。"],
      ["将棋AIの見方", "やねうら王も駒の価値を点数で持っていて、歩の約3.5倍が香、約6倍が金、11倍が飛車だよ。ただし実際の形勢判断は、駒の位置や玉の堅さまで含めて評価関数（NNUE）で行うんだ。"],
      ["注意点", "点数はあくまで目安だよ。玉の近くの駒や、攻めに欠かせない駒は、局面によって点数以上の価値になるんだ。"],
      ["格言", "「終盤は駒の損得より速度」。終盤では、駒得よりも早く相手玉に迫ることが大事になるよ。"],
    ],
  },
  {
    id: "pawn", group: "基本の駒", label: "歩兵（ふ）", pieceSquare: "5e", sfen: lonePieceSfen("P"),
    overview: "一番たくさんある小さな駒だよ。でも、歩の使い方で強さが決まるんだ！",
    rows: [
      ["動き", "前に1マスだけ進めるよ。敵陣（相手側の3段）に入ると「と金」に成れるよ。"],
      ["役割", "最前線で相手の駒とぶつかり、攻めのきっかけを作るよ。持ち駒の歩は、壁や受けにも大活躍！"],
      ["弱点", "後ろにも横にも動けないよ。同じ筋に2枚打つ「二歩」と、歩を打って詰ませる「打ち歩詰め」は反則だから注意してね。"],
      ["格言", "「歩のない将棋は負け将棋」。持ち駒に歩が1枚あるだけで、受けも攻めもぐっと楽になるよ。"],
    ],
  },
  {
    id: "lance", group: "基本の駒", label: "香車（きょう）", pieceSquare: "5e", sfen: lonePieceSfen("L"),
    overview: "まっすぐ前だけに突き進む、一直線の駒だよ！",
    rows: [
      ["動き", "前にどこまでも進めるよ。ほかの駒を飛び越えることはできないんだ。"],
      ["役割", "端攻めの主役！ 相手の駒を2枚まとめて串刺しにする「田楽刺し」も得意だよ。"],
      ["弱点", "後ろにも横にも動けないよ。前に駒を置かれると、そこで止まっちゃう。"],
      ["格言", "「下段の香に力あり」。自陣の一番下から打つと、筋全体ににらみが利くよ。"],
    ],
  },
  {
    id: "knight", group: "基本の駒", label: "桂馬（けい）", pieceSquare: "5e", sfen: lonePieceSfen("N"),
    overview: "駒を飛び越えられるただ一つの駒！ ぴょんと跳ねる動きがおもしろいよ。",
    rows: [
      ["動き", "2つ前の、左右どちらかのマスへ跳ぶよ。途中に駒があっても飛び越えられるんだ。"],
      ["役割", "2枚の駒を同時にねらう「両取り」が得意！ 攻めの援軍として、銀と一緒に使うと強いよ。"],
      ["弱点", "前にしか進めず、戻れないよ。跳ねた先で歩に取られやすいから気をつけてね。"],
      ["格言", "「桂の高跳び歩の餌食」。むやみに跳ねると、歩で簡単に取られちゃうよ。"],
    ],
  },
  {
    id: "silver", group: "基本の駒", label: "銀将（ぎん）", pieceSquare: "5e", sfen: lonePieceSfen("S"),
    overview: "前に強くて、斜めに下がれる駒。攻めでも守りでも頼りになるよ！",
    rows: [
      ["動き", "前の3マスと、斜め後ろの2マスに動けるよ。"],
      ["役割", "棒銀や早繰り銀のように攻めの主力になるよ。美濃囲いや矢倉囲いでは守りの要にもなるんだ。"],
      ["弱点", "真横と真後ろには動けないよ。横から攻められると受けにくいんだ。"],
      ["格言", "「銀は千鳥に使え」。斜めにジグザグ動かすと、銀の力を引き出せるよ。"],
    ],
  },
  {
    id: "gold", group: "基本の駒", label: "金将（きん）", pieceSquare: "5e", sfen: lonePieceSfen("G"),
    overview: "玉を守る一番の頼れる駒！ 詰みの最後の一手にもよく使うよ。",
    rows: [
      ["動き", "前の3マス、左右の2マス、真後ろの1マスに動けるよ。斜め後ろにだけは動けないんだ。"],
      ["役割", "玉のそばで囲いの中心になるよ。「頭金」のように、相手玉の頭に打って詰ませるのも得意！"],
      ["弱点", "斜め後ろに下がれないから、前に出すぎると戻れなくなるよ。金は成ることができないんだ。"],
      ["格言", "「金はとどめに残せ」。詰ませる最後の一手用に、持ち駒の金を取っておこう。"],
    ],
  },
  {
    id: "bishop", group: "大駒", label: "角行（かく）", pieceSquare: "5e", sfen: lonePieceSfen("B"),
    overview: "斜めにどこまでも利く大駒！ 遠くから相手をねらえるよ。",
    rows: [
      ["動き", "斜め4方向にどこまでも進めるよ。成ると「竜馬（馬）」になるんだ。"],
      ["役割", "遠くから2つの駒をねらう両取りが得意だよ。角道を開けるか閉じるかで、戦型が大きく変わるんだ。"],
      ["弱点", "縦と横の隣のマスには動けないよ。特に真上（角の頭）が弱点になりやすいんだ。"],
      ["格言", "「遠見の角に好手あり」。盤の遠くから打つ角が、思わぬ好手になることがあるよ。"],
    ],
  },
  {
    id: "rook", group: "大駒", label: "飛車（ひしゃ）", pieceSquare: "5e", sfen: lonePieceSfen("R"),
    overview: "縦横どこまでも走れる、最強の攻め駒だよ！",
    rows: [
      ["動き", "縦と横にどこまでも進めるよ。成ると「竜王（竜）」になるんだ。"],
      ["役割", "攻めの主役！ 飛車を2筋に置いたままが「居飛車」、左に動かすのが「振り飛車」だよ。"],
      ["弱点", "斜めには動けないよ。角や銀に斜めからねらわれると、逃げ場がなくなることがあるんだ。"],
      ["格言", "「玉飛接近すべからず」。玉と飛車が近いと、両方まとめてねらわれやすいよ。"],
    ],
  },
  {
    id: "king", group: "玉", label: "玉将・王将（ぎょく・おう）", pieceSquare: "5e", sfen: lonePieceSfen("K"),
    overview: "取られたら負けの一番大事な駒！ しっかり囲って守ろうね。",
    rows: [
      ["動き", "周りの8マスに1マスずつ動けるよ。"],
      ["役割", "玉を詰まされると負けだよ。囲いを作って、金銀で守るのが基本なんだ。"],
      ["弱点", "動きは1マスずつだから、大駒や持ち駒で包囲されると逃げられないよ。"],
      ["豆知識", "対局では、上位の人が「王将」、下位の人が「玉将」を使う習わしがあるよ。"],
    ],
  },
  {
    id: "tokin", group: "成り駒", label: "と金", pieceSquare: "5e", sfen: lonePieceSfen("+P"),
    overview: "歩が成った駒。金と同じ動きになるのに、取られても相手には歩しか渡らないよ！",
    rows: [
      ["動き", "金と同じで、斜め後ろ以外の6マスに動けるよ。"],
      ["役割", "相手の金銀をはがす攻めに最適！ 取られても相手の持ち駒は歩1枚だけなんだ。"],
      ["弱点", "動きはゆっくりだから、遠くの駒を攻めるには時間がかかるよ。"],
      ["格言", "「と金のおそはや」。と金の攻めは遅いようで、実は速いという意味だよ。"],
    ],
  },
  {
    id: "promoted-minor", group: "成り駒", label: "成香・成桂・成銀", pieceSquare: "5e", sfen: lonePieceSfen("+S"),
    overview: "香車・桂馬・銀将が成ると、みんな金と同じ動きになるよ。",
    rows: [
      ["動き", "金と同じで、斜め後ろ以外の6マスに動けるよ。盤面は成銀の例だよ。"],
      ["役割", "香や桂は成ると横や後ろにも動けるようになり、戦力がぐっと上がるよ。"],
      ["注意点", "銀は成ると斜め後ろに下がれなくなるよ。わざと成らない「不成」を選ぶ場面も多いんだ。"],
      ["コツ", "成香・成桂は横や後ろにも動けるから、攻めのあとで自陣に引き戻して守りに使うこともできるよ。"],
    ],
  },
  {
    id: "dragon", group: "成り駒", label: "竜王（りゅう）", pieceSquare: "5e", sfen: lonePieceSfen("+R"),
    overview: "飛車が成った最強クラスの駒！ 斜めにも1マス動けるようになるよ。",
    rows: [
      ["動き", "飛車の動きに加えて、斜めの4マスにも1マス動けるよ。"],
      ["役割", "敵陣に入って暴れる攻めの切り札！ 横から玉をねらうと受けにくいよ。"],
      ["弱点", "強いぶん相手にねらわれやすいよ。取られると一気に形勢が傾くから大事にしよう。"],
      ["格言", "「竜は敵陣に、馬は自陣に」。竜は攻めに、馬は守りに使うと力を発揮するよ。"],
    ],
  },
  {
    id: "horse", group: "成り駒", label: "竜馬（うま）", pieceSquare: "5e", sfen: lonePieceSfen("+B"),
    overview: "角が成った駒。縦横にも1マス動けて、守りにもとっても強いよ！",
    rows: [
      ["動き", "角の動きに加えて、縦と横の4マスにも1マス動けるよ。"],
      ["役割", "自陣に引いて玉のそばに置くと、とても堅い守りになるよ。"],
      ["弱点", "遠くまで利くぶん、利きをさえぎられると力が半減するよ。"],
      ["格言", "「馬の守りは金銀三枚」。自陣の馬は、金銀3枚分の守りの力があるといわれるよ。"],
    ],
  },
];

const TESUJI_ENTRY_LIST = [
  {
    id: "edge-king-edge-pawn", group: "攻めの格言", label: "端玉には端歩",
    sfen: "8k/9/7pp/9/8P/9/9/9/4K3L b - 1",
    arrows: ["1e1d"], marks: [["1a", "target"], ["1d", "key"], ["1i", "key"]],
    overview: "端に逃げた玉には、端の歩を突いて攻めよう！",
    rows: [
      ["意味", "端歩を突いて相手の歩とぶつけると、1九の香の前があいて、香が1筋をまっすぐ玉までにらめるよ。同歩と取られても同香と取り返して、玉のすぐそばまで迫れるんだ。"],
      ["使いどころ", "端歩を突き捨てて筋を開け、香や桂、持ち駒の歩で端から攻めると、少ない駒でも崩せるよ。"],
    ],
  },
  {
    id: "drop-to-bottom", group: "攻めの格言", label: "玉は下段に落とせ",
    sfen: "4k4/9/4P4/9/9/9/9/9/4K4 b G 1",
    arrows: ["G*5b"], marks: [["5a", "target"], ["5b", "key"]],
    overview: "玉は一番下の段に追い込むと、詰ませやすくなるよ！",
    rows: [
      ["意味", "下段の玉は後ろに逃げられないから、上から押さえるだけで詰みやすいんだ。"],
      ["例", "盤面では、歩に支えられた5二へ金を打つ「頭金」で詰みだよ。玉が上に逃げていると、こうはいかないんだ。"],
      ["関連", "「金はとどめに残せ」。最後の頭金のために、持ち駒の金は取っておこう。"],
    ],
  },
  {
    id: "one-gap-dragon", group: "攻めの格言", label: "一間竜は受けにくい",
    sfen: "4k4/9/6+R2/9/9/9/9/9/4K4 b - 1",
    arrows: ["3c3a"], marks: [["5a", "target"], ["4a", "key"]],
    overview: "玉と竜の間を1マスあけた「一間竜」は、とっても強い形だよ！",
    rows: [
      ["意味", "竜が玉から1マス離れて横から王手すると、合い駒をしても竜の斜めの利きで取られやすいんだ。"],
      ["使いどころ", "盤面の3一竜のように、一間あけて王手すると相手は受けに困るよ。詰めの基本形として覚えておこう。"],
    ],
  },
  {
    id: "knight-fork", group: "攻めの格言", label: "ふんどしの桂",
    sfen: "k2r1g3/9/9/9/5N3/9/9/9/4K4 b - 1",
    arrows: ["4e5c"], marks: [["6a", "target"], ["4a", "target"], ["5c", "key"]],
    overview: "桂馬で2枚の駒を同時にねらう、両取りの形だよ！",
    rows: [
      ["意味", "桂馬の跳ぶ先2か所に相手の駒がいると、どちらかを必ず取れるんだ。ふんどしの形に似ているから、この名前がついたよ。"],
      ["使いどころ", "盤面では5三へ跳ねると、6一の飛車と4一の金の両取りになるよ。桂馬は駒を飛び越えられるから、守りにくいんだ。"],
      ["ポイント", "ここでは成らずに跳ねるのが大事！ 成桂になると金と同じ動きになって、両取りが消えちゃうよ。"],
    ],
  },
  {
    id: "rook-pawn-exchange", group: "攻めの格言", label: "飛車先の歩交換三つの得あり",
    moves: ["2g2f", "8c8d", "2f2e", "8d8e", "6i7h", "4a3b"],
    arrows: ["2e2d"], marks: [["2d", "key"]],
    overview: "飛車の前の歩を交換すると、いいことが3つもあるよ！",
    rows: [
      ["意味", "歩を1枚手に入れられる、飛車が前に出て働きやすくなる、相手の陣形を押さえ込める、という3つの得があるといわれるよ。"],
      ["使いどころ", "盤面から2四歩と突き、同歩・同飛と進めるのが基本の歩交換だよ。相手が受けていないときはチャンス！"],
    ],
  },
  {
    id: "chasing-check", group: "寄せの格言", label: "王手は追う手",
    sfen: "9/4k4/9/9/7R1/9/9/9/4K4 b - 1",
    arrows: ["2e2b"], marks: [["5b", "target"]],
    overview: "むやみに王手をかけると、相手の玉を逃がしちゃうよ！",
    rows: [
      ["意味", "王手をかけても、玉が広い方へ逃げるだけなら、かえって寄せにくくなるという戒めだよ。"],
      ["例", "盤面の2二飛のような王手は、玉を4一や6三の広い場所へ逃がすだけ。王手より、逃げ道をふさぐ手を考えよう。"],
    ],
  },
  {
    id: "wrap-the-king", group: "寄せの格言", label: "玉は包むように寄せよ",
    sfen: "9/4k4/2S3G2/9/9/9/9/9/4K4 b - 1",
    marks: [["5b", "target"], ["4b", "key"], ["6b", "key"]],
    overview: "玉は、左右から包み込むように寄せていこう！",
    rows: [
      ["意味", "片側からだけ攻めると、玉は反対側へ逃げてしまうよ。逃げ道を両側からふさぐのが寄せのコツなんだ。"],
      ["例", "盤面では7三の銀と3三の金が、玉の左右の逃げ道をにらんでいるよ。ここから包むように迫ろう。"],
    ],
  },
  {
    id: "lure-gold-diagonally", group: "寄せの格言", label: "金は斜めに誘え",
    sfen: "4k4/4g4/9/9/9/9/9/9/4K4 b P 1",
    arrows: ["P*4c"], marks: [["5b", "target"], ["4c", "key"]],
    overview: "守りの金は、斜め前へおびき出すと弱くなるよ！",
    rows: [
      ["意味", "金は斜め後ろに下がれないから、斜め前へ誘い出すと元の位置に戻れなくなるんだ。"],
      ["例", "盤面で4三に歩を打ち、同金と取らせると、金は5二へ戻れず玉の守りが薄くなるよ。"],
    ],
  },
  {
    id: "focal-pawn", group: "歩の手筋", label: "焦点の歩に好手あり",
    sfen: "4k4/3g1s3/9/9/9/9/9/9/4K4 b P 1",
    arrows: ["P*5c"], marks: [["5c", "key"], ["6b", "target"], ["4b", "target"]],
    overview: "相手の駒の利きが集まるマスに歩を打つと、好手になりやすいよ！",
    rows: [
      ["意味", "2枚以上の駒が守っているマス（焦点）に歩を打つと、どの駒で取っても、ほかの場所の守りが崩れるんだ。"],
      ["例", "盤面の5三は、6二の金と4二の銀の両方が守っているマス。ここへ歩を打つと、同金でも同銀でも形が乱れるよ。"],
    ],
  },
  {
    id: "dangling-pawn", group: "歩の手筋", label: "垂れ歩",
    sfen: "4k4/9/9/9/9/9/9/9/4K4 b P 1",
    arrows: ["P*2d"], marks: [["2c", "key"]],
    overview: "敵陣の一歩手前に歩を打って、と金作りをねらう手筋だよ！",
    rows: [
      ["意味", "敵陣の手前（4段目）に打った歩は、次に敵陣へ進んで「と金」になれるよ。これを「垂れ歩」というんだ。"],
      ["使いどころ", "相手がすぐに取れない場所へ垂らすのがコツ。と金ができると、相手の金銀をはがす強い攻め駒になるよ。"],
    ],
  },
  {
    id: "tapping-pawn", group: "歩の手筋", label: "叩きの歩",
    sfen: "4k4/5g3/9/9/9/9/9/9/4K4 b P 1",
    arrows: ["P*4c"], marks: [["4b", "target"]],
    overview: "相手の駒の頭に歩を打って、動かしたり取らせたりする手筋だよ！",
    rows: [
      ["意味", "駒の真正面に歩を打つ（叩く）と、相手は取るか逃げるかを迫られるよ。駒の位置をずらして、陣形を崩せるんだ。"],
      ["例", "盤面で4三に歩を打つと、4二の金は取るか逃げるかしかないよ。どちらでも元の守りの形が変わるんだ。"],
    ],
  },
  {
    id: "one-pawn", group: "歩の手筋", label: "一歩千金",
    sfen: "4k4/9/7+r1/9/9/9/9/9/7K1 b P 1",
    arrows: ["P*2h"], marks: [["2i", "target"], ["2h", "key"]],
    overview: "持ち駒の歩1枚には、千金の値打ちがあるよ！",
    rows: [
      ["意味", "歩はたった1点の駒だけど、持ち駒に1枚あるだけで受けも攻めもできる、とても大事な駒という意味だよ。"],
      ["例", "盤面では竜の王手を、持ち駒の歩を2八に打って止められるよ。歩がなければ、もっと価値の高い駒で受けるしかないんだ。"],
    ],
  },
  {
    id: "early-escape", group: "守りの格言", label: "玉の早逃げ八手の得",
    sfen: "4k4/9/8+r/9/9/9/7PP/7S1/8K b - 1",
    arrows: ["1i2i"], marks: [["1i", "target"], ["2i", "key"]],
    overview: "危なくなる前に、玉を一手早く逃がしておこう！",
    rows: [
      ["意味", "王手をかけられる前に玉を安全な場所へ逃がしておくと、何手分もの得になるという教えだよ。"],
      ["使いどころ", "盤面では1筋の竜が玉をにらんでいるよ。歩で防げているうちに、玉を2九へ寄せておくと安心だね。"],
    ],
  },
  {
    id: "avoid-idle-king", group: "守りの格言", label: "居玉は避けよ",
    moves: ["7g7f", "3c3d", "2g2f", "4c4d"],
    arrows: ["5i6h"], marks: [["5i", "target"]],
    overview: "玉が最初の位置のまま戦うと、あっという間に攻められちゃうよ！",
    rows: [
      ["意味", "最初の5九のままの玉を「居玉」というよ。飛車や角の利きに入りやすく、戦いが始まると危ないんだ。"],
      ["使いどころ", "戦いを始める前に、6八玉などと一手でも玉を動かして囲いを作ろう。"],
    ],
  },
  {
    id: "three-guards", group: "守りの格言", label: "玉の守りは金銀三枚",
    sfen: "4k4/9/9/9/9/9/PPPPPPPPP/3RG1SK1/5G3 b - 1",
    marks: [["5h", "key"], ["3h", "key"], ["4i", "key"]],
    overview: "玉は、金と銀あわせて3枚で守ると堅いよ！",
    rows: [
      ["意味", "囲いは金銀3枚で作るのが基本という教えだよ。2枚では薄く、4枚使うと攻めの駒が足りなくなりやすいんだ。"],
      ["例", "盤面は振り飛車の「美濃囲い」。3八の銀と4九・5八の金の3枚で、2八の玉をしっかり守っているよ。"],
    ],
  },
  {
    id: "high-knight", group: "駒の使い方", label: "桂の高跳び歩の餌食",
    sfen: "4k4/4s4/4p4/9/4N4/9/9/9/4K4 w - 1",
    arrows: ["5c5d"], marks: [["5e", "target"], ["4c", "key"], ["6c", "key"]],
    overview: "桂馬を跳ねすぎると、歩で取られちゃうよ！",
    rows: [
      ["意味", "高く跳ねた桂馬は戻れないから、歩で頭をたたかれると逃げ場がなくなるんだ。"],
      ["例", "盤面で後手が5四歩と突くと、桂は4三か6三にしか逃げられず、どちらも銀に取られるよ。"],
    ],
  },
  {
    id: "bottom-lance", group: "駒の使い方", label: "下段の香に力あり",
    sfen: "4k3l/8p/9/9/9/9/9/9/4K3L b - 1",
    pieceSquare: "1i", marks: [["1b", "target"]],
    overview: "香車は一番下の段から打つと、筋全体ににらみが利くよ！",
    rows: [
      ["意味", "香は前にどこまでも利くから、下段に置くと筋のすべてのマスを守ったりねらったりできるんだ。"],
      ["使いどころ", "端攻めでは、下段の香の後押しで歩を進めると、相手は受けにくくなるよ。"],
    ],
  },

  {
    id: "head-gold", label: "頭金",
    sfen: "4k4/9/5S3/9/9/9/9/9/4K4 b G 1",
    arrows: ["G*5b"], marks: [["5a", "target"], ["5b", "key"]],
    overview: "玉の頭（真上）に金を打って詰ませる、詰みの一番の基本形だよ！",
    rows: [
      ["形", "玉のすぐ上に、ほかの駒の利きで守られた金を打つよ。金は前と横に利くから、下段の玉は逃げ場がなくなるんだ。"],
      ["例", "盤面では4三の銀が5二を守っているから、5二金で詰み。金を取られない支えがあるかを確かめよう。"],
    ],
  },
  {
    id: "belly-silver", label: "腹銀（玉の腹から銀を打て）",
    sfen: "4k4/9/9/9/9/9/9/9/K4L3 b GS 1",
    arrows: ["S*4a"], marks: [["5a", "target"], ["4a", "key"], ["5b", "key"]],
    overview: "玉の真横（腹）に銀を打って、逃げ道をふさぐ手筋だよ！",
    rows: [
      ["形", "玉の横に打った銀は王手ではないけれど、斜め後ろの利きで玉の上をふさぎ、次の詰みをねらえるんだ。"],
      ["例", "盤面で4一に銀を打つと（4九の香が銀を守っているよ）、次に5二金と打てば詰み。玉の横からじわっと迫ろう。"],
    ],
  },
  {
    id: "double-check", label: "鬼より怖い両王手",
    sfen: "4k4/9/9/9/4N4/9/9/4R4/8K b - 1",
    arrows: ["5e4c"], marks: [["5a", "target"], ["5h", "key"]],
    overview: "2つの駒で同時に王手をかける「両王手」は、とっても強力だよ！",
    rows: [
      ["意味", "両王手は、合い駒でも王手をかけた駒を取ることでも防げないよ。玉が逃げるしかないんだ。"],
      ["例", "盤面で桂を4三へ跳ねると、桂の王手と、後ろにいた5八の飛車の王手が同時にかかるよ。"],
    ],
  },
  {
    id: "gold-bottom-pawn", label: "金底の歩、岩よりも堅し",
    sfen: "4k4/9/9/9/9/9/9/6GK1/2+r6 b P 1",
    arrows: ["P*3i"], marks: [["3h", "key"], ["3i", "key"], ["7i", "target"]],
    overview: "金の真下に打つ歩（金底の歩）は、岩のように堅い守りになるよ！",
    rows: [
      ["意味", "一番下の段に打った歩は、横から来る竜や飛車の利きを止めてくれるよ。真上の金が歩を守るから、簡単には取られないんだ。"],
      ["例", "盤面では、7九の竜が一段目から玉の下をねらっているよ。3九に歩を打てば、竜の横利きが止まるね。"],
    ],
  },
  {
    id: "joined-pawns", label: "三歩持ったら継ぎ歩と垂れ歩",
    sfen: "4k4/9/7p1/9/7P1/9/9/7R1/4K4 b 3P 1",
    arrows: ["2e2d"], marks: [["2c", "target"], ["2d", "key"]],
    overview: "持ち歩が3枚あれば、歩だけで相手の陣形を崩せるよ！",
    rows: [
      ["意味", "歩を突き捨てて取らせ、同じ筋にもう一度歩を打つ「継ぎ歩」や、敵陣の手前に打つ「垂れ歩」を組み合わせると、歩だけで攻めを作れるんだ。"],
      ["例", "盤面ではまず2四歩と突き捨てて、同歩と取らせたところへ歩を打ち直していくよ。持ち歩の数を数えながら攻めよう。"],
    ],
  },
  {
    id: "edge-pawn-when-idle", label: "手のない時は端歩を突け",
    moves: ["7g7f", "3c3d", "2g2f", "8c8d", "2f2e", "8d8e", "6i7h", "4a3b"],
    arrows: ["1g1f"], marks: [["1g", "key"]],
    overview: "指す手に迷ったら、端歩を突いておくのがおすすめだよ！",
    rows: [
      ["意味", "端歩は、玉の逃げ道を広げたり、あとで端攻めに使えたりする、損の少ない一手なんだ。"],
      ["使いどころ", "駒組みが一段落して、どちらから動くか様子を見たいときに、1六歩のような端歩が役に立つよ。"],
    ],
  },
  {
    id: "pawn-against-advanced-silver", label: "歩越し銀には歩で受けよ",
    sfen: "4k4/9/5ps2/9/5S3/9/5P3/9/4K4 w - 1",
    arrows: ["4c4d"], marks: [["4e", "target"]],
    overview: "歩より前に出てきた銀は、歩を突いて追い返そう！",
    rows: [
      ["意味", "自分の歩より前に出た銀（歩越し銀）は、後ろ盾がなく不安定なんだ。歩を突いて追い払うのが効果的だよ。"],
      ["例", "盤面で後手が4四歩と突くと、3三の銀が歩を守っているから、4五の銀は歩を取れずに逃げるしかなくなるよ。"],
    ],
  },
  {
    id: "knight-check", label: "桂の王手は合駒きかず",
    sfen: "4k4/9/9/9/9/9/9/9/4K4 b N 1",
    arrows: ["N*4c"], marks: [["5a", "target"], ["4c", "key"]],
    overview: "桂馬の王手は、間に駒を置いて防ぐことができないよ！",
    rows: [
      ["意味", "桂は駒を飛び越えて利くから、合い駒で王手をさえぎれないんだ。桂を取るか、玉が逃げるしかないよ。"],
      ["例", "盤面で4三に桂を打つと王手。5一の玉は逃げるしかないね。詰みの仕上げにとても頼りになるよ。"],
    ],
  },
  {
    id: "silver-zigzag", label: "銀は千鳥に使え",
    sfen: "4k4/9/9/9/9/9/9/5S3/4K4 b - 1",
    arrows: ["4h3g"], marks: [["4h", "key"]],
    overview: "銀は斜めにジグザグと動かすと、力を発揮するよ！",
    rows: [
      ["意味", "銀は斜め4方向に動けるから、斜めに進んだり戻ったりを繰り返す「千鳥」の動きが得意なんだ。"],
      ["例", "盤面では4八の銀を3七へ斜めに上がり、次は4六や2六へと斜めに進めていくよ。棒銀や早繰り銀もこの動きだね。"],
    ],
  },
  {
    id: "silver-without-promotion", label: "銀は成らずに好手あり",
    sfen: "k8/9/5S3/9/9/9/9/9/4K4 b - 1",
    arrows: ["4c3b"], marks: [["3b", "key"]],
    overview: "敵陣の銀は、あえて成らないほうが強いことがあるよ！",
    rows: [
      ["意味", "銀は成ると金と同じ動きになり、斜め後ろに下がれなくなるよ。成らなければ、斜めに引いてまた攻め直せるんだ。"],
      ["例", "盤面で3二へ成らずに進めば、次に4三や2三へ斜めに引くこともできるよ。"],
    ],
  },
  {
    id: "silver-attacks-gold-defends", label: "攻めは銀、受けは金",
    moves: ["2g2f", "8c8d", "2f2e", "8d8e", "3i3h", "4a3b", "3h2g", "7a7b"],
    arrows: ["2g2f"], marks: [["6i", "key"], ["4i", "key"]],
    overview: "銀は攻めに、金は守りに使うのが基本だよ！",
    rows: [
      ["意味", "前に強い銀は攻めに、横や後ろにも利く金は玉の守りに向いているという教えだよ。"],
      ["例", "盤面は棒銀。銀を2六へ出して攻める一方、4九と6九の金は玉のそばで守りに残しておくよ。"],
    ],
  },
  {
    id: "tokin-on-53", label: "5三のと金に負けなし",
    sfen: "4k4/9/4+P4/9/9/9/9/9/4K4 b - 1",
    marks: [["5c", "key"]],
    overview: "敵陣の真ん中（5三）にできたと金は、とっても強いよ！",
    rows: [
      ["意味", "5三は相手の玉の頭で、金銀の連結の中心になるマス。ここにと金ができると、相手の守りがばらばらになりやすいんだ。"],
      ["ポイント", "と金は取られても相手に渡るのは歩1枚だけ。遠慮なく相手の金銀にぶつけていこう。"],
    ],
  },
  {
    id: "no-center-pawn-after-exchange", label: "角交換に5筋の歩を突くな",
    moves: ["7g7f", "3c3d", "8h2b+", "3a2b", "7i8h", "2b3c"],
    marks: [["5g", "key"]],
    overview: "角交換した後は、5筋の歩を突くと危ないよ！",
    rows: [
      ["意味", "角交換の後に5筋の歩を突くと、自陣に角を打ち込まれるすきが増えるという教えだよ。"],
      ["使いどころ", "角換わりの駒組みでは、5七の歩を突かずに、打ち込まれる場所がない形を保とう。"],
    ],
  },
  {
    id: "rook-cross-fork", label: "飛車は十字に使え",
    sfen: "k8/4g4/9/9/7s1/9/9/9/8K b R 1",
    arrows: ["R*5e"], marks: [["5b", "target"], ["2e", "target"], ["5e", "key"]],
    overview: "飛車は縦と横の十字に利くから、両取りをかけやすいよ！",
    rows: [
      ["意味", "飛車は縦横どこまでも利くので、十字の先にある2枚の駒を同時にねらえるんだ。"],
      ["例", "盤面で5五に飛車を打つと、縦の5二の金と、横の2五の銀の両取りになるよ。"],
    ],
  },
  {
    id: "weak-player-loves-rook", label: "へぼ将棋、玉より飛車を可愛がり",
    sfen: STANDARD,
    marks: [["5i", "key"], ["2h", "target"]],
    overview: "飛車を大事にしすぎて、玉を危なくしちゃだめだよ！",
    rows: [
      ["意味", "飛車は強い駒だけど、一番大事なのは玉。飛車を守るために玉の守りを後回しにするのは、よくある失敗なんだ。"],
      ["使いどころ", "飛車を取られそうになっても、玉の安全を優先しよう。飛車を渡しても勝てる局面はたくさんあるよ。"],
    ],
  },
  {
    id: "dragon-enemy-horse-home", label: "竜は敵陣に馬は自陣に",
    sfen: "4k4/6+R2/9/9/9/9/9/1K1+B5/9 b - 1",
    marks: [["3b", "key"], ["6h", "key"]],
    overview: "竜は攻めに、馬は守りに使うと力を発揮するよ！",
    rows: [
      ["意味", "竜は敵陣で横から玉をねらうと強く、馬は自陣に引くと玉のそばを守る強い駒になるという教えだよ。"],
      ["例", "盤面では3二の竜が相手玉をにらみ、6八の馬が自玉の守りについているよ。"],
      ["関連", "「馬の守りは金銀三枚」。自陣の馬には、金銀3枚分の守りの力があるといわれるよ。"],
    ],
  },
  {
    id: "drop-major-far", label: "大駒は離して打て",
    sfen: "4k4/9/9/9/9/9/9/9/8K b R 1",
    arrows: ["R*5h"], marks: [["5a", "target"]],
    overview: "飛車や角は、相手の玉から離して打つのが基本だよ！",
    rows: [
      ["意味", "大駒を玉の近くに打つと、玉や金銀に取られたり、逃げられたりしやすいよ。離して打てば取られにくく、利きも長く保てるんだ。"],
      ["例", "盤面では5八に飛車を打って、遠くから王手。玉が逃げても、飛車の利きがずっと残るよ。"],
    ],
  },
  {
    id: "attack-pieces", label: "攻めは飛車角銀桂",
    sfen: STANDARD,
    marks: [["2h", "key"], ["8h", "key"], ["3i", "key"], ["2i", "key"]],
    overview: "攻めには、飛車・角・銀・桂の4つの駒を使おう！",
    rows: [
      ["意味", "攻めの主力は飛車・角・銀・桂。金は玉の守りに残し、この4枚を連携させて攻めるのが基本だよ。"],
      ["関連", "「4枚の攻めは切れない」。攻めに4枚の駒が参加していれば、攻めが続きやすいといわれるよ。"],
    ],
  },
];

/** 手筋図鑑は駒ごとの格言と詰みの形にまとめて並べる。 */
const TESUJI_GROUPS = [
  ["詰みの形", ["head-gold", "belly-silver", "one-gap-dragon", "double-check"]],
  ["歩の格言", [
    "one-pawn", "gold-bottom-pawn", "focal-pawn", "joined-pawns", "dangling-pawn", "tapping-pawn",
    "edge-pawn-when-idle", "pawn-against-advanced-silver", "rook-pawn-exchange", "edge-king-edge-pawn",
  ]],
  ["香の格言", ["bottom-lance"]],
  ["桂の格言", ["high-knight", "knight-check", "knight-fork"]],
  ["銀の格言", ["silver-zigzag", "silver-without-promotion", "silver-attacks-gold-defends"]],
  ["金の格言", ["lure-gold-diagonally", "tokin-on-53"]],
  ["角の格言", ["no-center-pawn-after-exchange"]],
  ["飛車の格言", ["rook-cross-fork", "weak-player-loves-rook"]],
  ["玉の格言", [
    "drop-to-bottom", "wrap-the-king", "avoid-idle-king", "early-escape", "three-guards",
  ]],
  ["全般の格言", ["chasing-check", "dragon-enemy-horse-home", "drop-major-far", "attack-pieces"]],
];

const TESUJI_ENTRIES = TESUJI_GROUPS.flatMap(([group, ids]) => ids.map((id) => {
  const entry = TESUJI_ENTRY_LIST.find((candidate) => candidate.id === id);
  if (!entry) throw new Error(`手筋図鑑の項目がありません: ${id}`);
  return { ...entry, group };
}));

const WORLD_ENTRIES = [
  {
    id: "origin", group: "将棋の歴史", label: "将棋のはじまり",
    sfen: STANDARD,
    overview: "将棋はとっても長い歴史をもつゲームなんだ！",
    rows: [
      ["起源", "古代インドの盤上遊戯「チャトランガ」が起源とされ、各地へ伝わってチェスや中国の象棋などに分かれていったといわれるよ。"],
      ["日本での将棋", "平安時代の文献には、すでに将棋の記述が見られるよ。駒の数や盤の大きさの違う、いろいろな将棋があったんだ。"],
      ["持ち駒", "取った駒を自分の駒として使える「持ち駒」のルールは、日本の将棋ならではの大きな特徴だよ。"],
    ],
  },
  {
    id: "edo-meijin", group: "将棋の歴史", label: "江戸時代の名人",
    kifu: OHASHI_SOKEI_SANSA_KIFU,
    kifuTitle: "現存最古の棋譜（慶長12年・1607年）",
    overview: "江戸時代には、将棋は幕府に保護されていたんだよ。",
    rows: [
      ["家元", "大橋家・伊藤家などの家元が将棋を受け継ぎ、名人の地位を担ったよ。初代の大橋宗桂が一世名人とされているんだ。"],
      ["御城将棋", "毎年、江戸城で将軍の前で対局する「御城将棋」が行われていたよ。"],
      ["最古の棋譜", "盤面は、今に残るいちばん古い棋譜。1607年に初代大橋宗桂と本因坊算砂が指した一局で、後手の算砂は四間飛車。133手で宗桂が勝ったよ。"],
      ["本因坊算砂", "囲碁の本因坊家を開いた人だけど、将棋も強かったんだ。今に残る二人の平手の将棋は、宗桂の7勝1敗だよ。"],
    ],
  },
  {
    id: "tsume-classic", group: "将棋の歴史", label: "詰将棋の名作",
    sfen: "4k4/9/4P4/9/9/9/9/9/4K4 b G 1",
    arrows: ["G*5b"],
    overview: "王手の連続で玉を詰ませるパズル、詰将棋にも長い歴史があるよ！",
    rows: [
      ["将棋図巧", "江戸時代の伊藤看寿による詰将棋集『将棋図巧』は、今でも最高傑作のひとつとされているよ。"],
      ["寿", "『将棋図巧』に収められた「寿」は611手もの長さで知られる、とても有名な作品なんだ。"],
      ["盤面", "盤面は1手で詰む一番やさしい形「頭金」。詰将棋はまずここから始めよう！"],
    ],
  },
  {
    id: "modern-titles", group: "将棋の歴史", label: "実力制名人とタイトル戦",
    sfen: STANDARD,
    overview: "今の将棋界では、実力でタイトルを争っているよ！",
    rows: [
      ["実力制名人", "1935年に実力で名人を決める名人戦が始まり、1937年に木村義雄が初代の実力制名人になったよ。"],
      ["八大タイトル", "竜王・名人・王位・王座・棋王・叡王・王将・棋聖の8つのタイトル戦があるよ。"],
      ["永世称号", "同じタイトルを何度も獲得すると、「十五世名人」のような永世称号が贈られるんだ。"],
    ],
  },
  {
    id: "amano-soho", group: "名棋士", label: "天野宗歩",
    kifu: AMANO_SOHO_KIFU,
    kifuTitle: "弘化2年（1845年）",
    // 宗歩は後手なので、宗歩の側を下にして並べる。
    flip: true,
    overview: "江戸時代の終わりごろに活躍した、伝説の強さをもつ棋士だよ！",
    rows: [
      ["人物", "江戸時代後期（1816〜1859年）の棋士。名人は家元から出るきまりだったので名人にはならなかったけれど、のちに「棋聖」とたたえられたんだ。"],
      ["実力十三段", "段位は七段だったけれど、その強さは「実力十三段」と言われたよ。"],
      ["棋譜", "盤面は、大橋宗珉との一局。角交換から腰掛銀に組んで戦い、宗歩が勝ったよ。宗歩は後手なので、宗歩の側を下にして並べているよ。"],
    ],
  },
  {
    id: "masuda", group: "名棋士", label: "升田幸三",
    moves: ["7g7f", "3c3d", "7f7e", "8c8d", "2h7h", "8d8e", "7h7f", "4a3b"],
    overview: "「新手一生」を掲げて、新しい指し方を次々に生み出した棋士だよ！",
    rows: [
      ["人物", "実力制の時代を代表する棋士で、名人をはじめ多くのタイトルを獲得したよ。"],
      ["新手一生", "「新手一生」という言葉を残し、常に新しい手を追い求めたんだ。"],
      ["盤面", "盤面は升田が得意とした「升田式石田流」につながる石田流の形だよ。"],
    ],
  },
  {
    id: "oyama", group: "名棋士", label: "大山康晴",
    moves: ["7g7f", "3c3d", "6g6f", "8c8d", "2h6h", "8d8e", "8h7g", "4a3b", "5i4h", "5a4b", "4h3h", "6a5b", "3h2h", "7a7b", "3i3h"],
    overview: "振り飛車の名手で、長い間トップに立ち続けた大棋士だよ！",
    rows: [
      ["人物", "十五世名人。タイトルを通算80期獲得し、長く将棋界の頂点に立ったよ。"],
      ["棋風", "粘り強い受けと、四間飛車などの振り飛車を得意としたんだ。"],
      ["盤面", "盤面は大山も得意とした、四間飛車と美濃囲いの形だよ。"],
    ],
  },
  {
    id: "nakahara", group: "名棋士", label: "中原誠",
    moves: ["7g7f", "8c8d", "6g6f", "3c3d", "7i6h", "7a6b", "6h7g", "6c6d"],
    overview: "「自然流」と呼ばれた、のびのびとした指し回しの名人だよ！",
    rows: [
      ["人物", "十六世名人。1972年に大山康晴から名人を奪い、その後の将棋界の第一人者として活躍したよ。"],
      ["棋風", "無理のない自然な指し回しから「自然流」と呼ばれたんだ。"],
      ["盤面", "盤面は、相居飛車の代表的な戦型のひとつ「矢倉」の出だしだよ。"],
    ],
  },
  {
    id: "tanigawa", group: "名棋士", label: "谷川浩司",
    sfen: STANDARD,
    overview: "鋭い寄せで「光速の寄せ」と呼ばれた棋士だよ！",
    rows: [
      ["人物", "1983年に21歳で名人になり、当時の史上最年少名人となったよ。十七世名人の資格を持っているんだ。"],
      ["棋風", "一気に相手玉を追い詰める終盤の速さから「光速の寄せ」と呼ばれたよ。"],
    ],
  },
  {
    id: "habu", group: "名棋士", label: "羽生善治",
    kifu: HABU_YOSHIHARU_52GIN_KIFU,
    kifuTitle: "NHK杯 加藤一二三九段戦（1989年1月9日）",
    overview: "七つのタイトルを独占したこともある、平成を代表する棋士だよ！",
    rows: [
      ["七冠", "1996年、当時の七大タイトルをすべて独占する「七冠」を達成したよ。"],
      ["永世七冠", "2017年には、7つのタイトルで永世称号の資格を得る「永世七冠」を達成したんだ。"],
      ["国民栄誉賞", "2018年に国民栄誉賞を受賞したよ。"],
      ["棋譜", "盤面は「伝説の5二銀」で知られる、NHK杯の加藤一二三九段との一局。角換わり棒銀の戦いで、61手目の▲5二銀が決め手になったよ。"],
    ],
  },
  {
    id: "fujii", group: "名棋士", label: "藤井聡太",
    moves: ["7g7f", "8c8d", "2g2f", "3c3d", "8h2b+", "3a2b", "7i8h", "2b3c"],
    overview: "次々に最年少記録を塗り替えている、令和の大スターだよ！",
    rows: [
      ["デビュー", "2016年、14歳2か月で史上最年少のプロ棋士（四段）になったよ。"],
      ["29連勝", "2017年には、デビューから公式戦29連勝という新記録を打ち立てたんだ。"],
      ["八冠", "2023年に、竜王・名人を含む8つのタイトルをすべて独占する「八冠」を達成したよ。"],
      ["盤面", "盤面は、トップ棋士の対局でよく指される「角換わり」の出だしだよ。"],
    ],
  },
  {
    id: "koyama", group: "名棋士", label: "小山怜央",
    kifu: KOYAMA_REO_ENTRANCE_KIFU,
    kifuTitle: "棋士編入試験 第4局（2023年2月13日）",
    overview: "奨励会を経ずにプロになった、岩手県出身で初めての棋士だよ！",
    rows: [
      ["人物", "1993年生まれ、岩手県釜石市出身。北島忠雄七段の門下だよ。小学2年生で将棋を始め、2011年の東日本大震災では自分も被災して、約半年間の避難所生活を送ったんだ。"],
      ["アマチュア時代", "奨励会の試験には合格できず、三段編入試験も2勝3敗で届かなかったよ。それでも大学生・会社員として指し続け、全日本学生名人戦・アマ名人戦・アマ竜王などで優勝したんだ。2021年には将棋に集中するため会社を辞めたよ。"],
      ["プロ編入", "プロの公式戦で10勝5敗の成績を挙げて棋士編入試験を受け、2023年に3勝1敗で合格。同年4月に四段になったよ。奨励会を経験せずにプロになった戦後初の棋士で、岩手県出身では初めての棋士なんだ。"],
      ["棋風", "角換わりを得意とする居飛車党だよ。穴熊も大得意で、相手がどんな指し手をしてきても、穴熊を組むことができるんだ。"],
      ["プロ入り後", "2024年のNHK杯で谷川浩司十七世名人に勝って、順位戦のC級2組へ上がることを決めたよ。2025年度には13連勝して、将棋大賞の連勝賞を受賞したんだ。"],
      ["棋譜", "盤面は編入試験の第4局で、横山友紀四段との一局だよ。四間飛車に居飛車穴熊で組んで勝ち、3勝目を挙げて合格を決めたんだ。"],
    ],
  },
  {
    id: "computer-shogi", group: "トピック", label: "コンピュータ将棋",
    sfen: STANDARD,
    overview: "今ではAIもとっても強くなって、プロの研究にも使われているよ！",
    rows: [
      ["電王戦", "プロ棋士とコンピュータが対戦する「電王戦」が行われ、2017年には名人がソフトに敗れて話題になったよ。"],
      ["研究への活用", "今ではプロ棋士もAIで研究するのが当たり前になり、中継ではAIの評価値が表示されるようになったんだ。"],
      ["このアプリ", "このアプリのCPUや棋譜解析も、将棋AI（やねうら王）の力を借りているよ。"],
    ],
  },
];

const ENTRIES = Object.freeze({ piece: PIECE_ENTRIES, tesuji: TESUJI_ENTRIES, world: WORLD_ENTRIES });

export function referenceDexEntries(kind) {
  return ENTRIES[kind] ?? [];
}

// 駒の価値の表に並べた駒画像と、その駒を説明する項目。
const PIECE_IMAGE_ENTRY_IDS = Object.freeze({
  black_king: "king",
  black_king2: "king",
  black_rook: "rook",
  black_bishop: "bishop",
  black_gold: "gold",
  black_silver: "silver",
  black_knight: "knight",
  black_lance: "lance",
  black_pawn: "pawn",
  black_dragon: "dragon",
  black_horse: "horse",
  black_prom_pawn: "tokin",
  black_prom_silver: "promoted-minor",
  black_prom_knight: "promoted-minor",
  black_prom_lance: "promoted-minor",
});

/** 駒の価値の表で押した駒画像から、説明の項目IDを引く。対応がなければ空文字。 */
export function referencePieceImageEntryId(image) {
  return PIECE_IMAGE_ENTRY_IDS[image] ?? "";
}

/** 図鑑の項目を、グループごとにまとめた一覧にする。 */
export function referenceDexGroups(kind) {
  const groups = [];
  for (const entry of referenceDexEntries(kind)) {
    let group = groups.find(({ label }) => label === entry.group);
    if (!group) {
      group = { id: `${kind}-${groups.length}`, label: entry.group, items: [] };
      groups.push(group);
    }
    group.items.push({ id: entry.id, label: entry.label });
  }
  return groups;
}

const kifuCache = new Map();

/**
 * 代表局の棋譜を、初期局面から1手ずつの局面に展開する。
 * 各局面は、SFEN・指し手の表記・直前の手（USI）・その手への解説・見せ場の名前を持つ。棋譜のない項目はnull。
 */
export function referenceEntryKifu(entry) {
  if (!entry?.kifu) return null;
  if (kifuCache.has(entry.kifu)) return kifuCache.get(entry.kifu);
  const record = importKIF(entry.kifu);
  if (record instanceof Error) throw new Error(`${entry.id}: ${record.message}`);
  const steps = [];
  const metadata = (key) => record.metadata.getStandardMetadata(key) ?? "";
  // 投了などの終局は、最後の指し手の局面に「投了」と書き添える。
  let ending = "";
  record.goto(0);
  for (const node of record.moves) {
    if (node.ply > 0) record.goForward();
    if (node.ply > 0 && !node.move?.usi) {
      ending = node.displayText;
      break;
    }
    steps.push({
      sfen: record.position.sfen,
      label: node.ply === 0 ? "" : node.displayText.replace("☗", "▲").replace("☖", "△"),
      lastMove: node.move?.usi ?? "",
      comment: node.comment.trim(),
      // KIFのしおり（「&」の行）は、その対局の見せ場の名前として扱う。
      highlight: node.bookmark.trim(),
    });
  }
  // 投了・詰みで終わった棋譜は、最後の手を指した側の勝ち。
  const lastPly = steps.length - 1;
  const winner = ["投了", "詰み"].includes(ending) && lastPly > 0
    ? (lastPly % 2 === 1 ? "black" : "white")
    : "";
  const kifu = Object.freeze({
    black: metadata(RecordMetadataKey.BLACK_NAME),
    white: metadata(RecordMetadataKey.WHITE_NAME),
    ending,
    winner,
    steps,
  });
  kifuCache.set(entry.kifu, kifu);
  return kifu;
}

/** 項目の盤面SFEN。手順で指定した項目は平手から指し進める。表だけの項目は盤面を持たない。 */
export function referenceEntrySfen(entry) {
  if (entry?.table) return "";
  if (entry?.sfen) return entry.sfen;
  const kifu = referenceEntryKifu(entry);
  if (kifu) return kifu.steps.at(-1).sfen;
  const record = createGameRecord(STANDARD);
  for (const usi of entry?.moves ?? []) {
    if (!appendUsiMove(record, usi)) throw new Error(`${entry.id}: ${usi}を指せません`);
  }
  return record.position.sfen;
}

/** 指定した升の駒が動けるマス。駒図鑑で動きを色付けする。 */
export function pieceReachSquares(sfen, squareUsi) {
  const position = Position.newBySFEN(sfen);
  const from = Square.newByUSI(squareUsi);
  if (!position || !from) return [];
  return Square.all
    .filter((square) => position.listAttackers(square).some((attacker) => attacker.equals(from)))
    .map((square) => square.usi);
}

/** 盤面に重ねる色付け。駒の動きは青、ねらう駒は赤、大事なマスは緑。 */
export function referenceEntryMarks(entry) {
  if (entry?.table) return [];
  const sfen = referenceEntrySfen(entry);
  const marks = new Map();
  if (entry?.pieceSquare) {
    for (const usi of pieceReachSquares(sfen, entry.pieceSquare)) marks.set(usi, "reach");
  }
  for (const [usi, tone] of entry?.marks ?? []) marks.set(usi, tone);
  return [...marks].map(([usi, tone]) => ({
    file: Number(usi[0]),
    rank: usi.charCodeAt(1) - 96,
    tone,
  }));
}
