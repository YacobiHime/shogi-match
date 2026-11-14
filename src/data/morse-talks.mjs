// モールス信号で話す「無線で話す」の交信(docs/brain-training-design.mdの18-5)。
// sendは相手が送る文(A〜Zと空白)、meanはその訳、leadは届いたときの相手の一言(sendの中身は言わない。耳だけで読めるように)。
// repliesは通じる返事。wordsのどれか(空白は無視)なら通じる。freeは何でも受け取る(名前など)。reactは通じたときの相手の一言。
// 文の中の{TEXT}は届いた返事、{GREET}は時刻のあいさつ(GM・GA・GE)、{GREET_MEAN}はその訳に置きかえる(morse-talk.mjs)。
// endの交信は、相手が送り終えたらおしまい。sayはそのときの一言。clueは2回伝わらなかったときの一言(返事の符号も見せる)。
// 羽音は敬語と「！」を使わない(docs/hanane-character.md)。

export const TALK_PARTNERS = Object.freeze({
  yacobi: Object.freeze({ id: 'yacobi', name: 'やこび姫', mark: '姫', faster: false, agn: 'ごめん、うまく読めなかった。AGNは「もう一度」だよ。' }),
  hanane: Object.freeze({ id: 'hanane', name: '天鷺羽音', mark: '羽', faster: true, agn: '……読めなかった。AGN、もう一度。' }),
});

const PIECES = [
  { words: ['FU'], mean: '歩', react: '歩は小さいけど、と金になると強いよね。' },
  { words: ['KYO', 'KYOSHA'], mean: '香車', react: 'まっすぐ一直線、かっこいい！' },
  { words: ['KEI', 'KEIMA'], mean: '桂馬', react: 'ぴょんと跳ぶ桂馬、ふしぎな動きだよね。' },
  { words: ['GIN'], mean: '銀', react: '銀は攻めにも守りにも使えるね。' },
  { words: ['KIN'], mean: '金', react: '玉のそばを守る、たよれる駒だね。' },
  { words: ['KAKU'], mean: '角', react: 'ななめに遠くまで、気持ちいいよね。' },
  { words: ['HISHA', 'HI'], mean: '飛車', react: '飛車は攻めの主役！' },
  { words: ['OU', 'GYOKU'], mean: '玉', react: '玉を選ぶなんて、通だね！' },
];

export const MORSE_TALKS = Object.freeze([
  {
    id: 'first',
    title: 'はじめての交信',
    partner: 'yacobi',
    desc: 'やこび姫と、モールスであいさつ',
    after: '',
    start: 'hi',
    nodes: {
      hi: {
        send: 'HI',
        mean: 'やあ',
        lead: '聞こえる？ はじめての無線だよ。キーを短く押すとトン、長く押すとツー。同じ言葉を返してみて！',
        replies: [{ words: ['HI', 'HELLO'], mean: 'やあ', next: 'shogi', react: '届いた！ ちゃんと読めたよ。' }],
      },
      shogi: {
        send: 'SHOGI',
        mean: '将棋しよう？',
        lead: '次は少し長いよ。YES か NO で答えてね。',
        replies: [
          { words: ['YES', 'OK'], mean: 'いいよ', next: 'yes', react: 'やった！' },
          { words: ['NO'], mean: 'いやだ', next: 'no', react: 'えー！ じゃあ、また今度。' },
        ],
      },
      yes: { send: 'FB', mean: 'すばらしい（無線の言葉）', end: true, say: 'FBは無線で「いいね」のこと。はじめての交信、大成功！' },
      no: { send: 'OK GN', mean: 'わかった、おやすみ', end: true, say: 'GNは「おやすみ」。はじめての交信、大成功！' },
    },
  },
  {
    id: 'ham',
    title: '無線のあいさつ',
    partner: 'yacobi',
    desc: '本物の無線の呼びかけと返事',
    after: 'first',
    start: 'cq',
    nodes: {
      cq: {
        send: 'CQ DE HIME K',
        mean: 'だれか聞こえますか、こちら姫、どうぞ',
        lead: '本物の無線の呼びかけを送るよ。長いから、何度聞いてもいいよ。受け取ったら R と返してね。',
        replies: [{ words: ['R', 'RR', 'OK'], mean: '受け取った', next: 'name', react: 'つながった！ CQは「だれか聞こえますか」、DEは「こちらは」、Kは「どうぞ」だよ。' }],
      },
      name: {
        send: 'NAME',
        mean: 'お名前は？',
        lead: 'あなたの名前を、ローマ字で送ってみて。',
        replies: [{ free: true, mean: '名前（ローマ字）', next: 'hello', react: '' }],
      },
      hello: {
        send: 'HI {TEXT} {GREET}',
        mean: 'やあ、{TEXT}。{GREET_MEAN}',
        lead: '名前と、いまの時間のあいさつを送ったよ。同じあいさつを返してね。',
        replies: [{ words: ['GM', 'GA', 'GE', '{GREET}'], mean: '{GREET_MEAN}', next: 'bye', react: 'GMはおはよう、GAはこんにちは、GEはこんばんは。無線の人は、時間であいさつを変えるんだ。' }],
      },
      bye: {
        send: 'TU GB',
        mean: 'ありがとう、さようなら',
        lead: '最後のあいさつだよ。届いた言葉を、そのまま返せばおしまい。',
        replies: [{ words: ['TU GB', 'TU', 'GB'], mean: 'ありがとう、さようなら', next: 'end', react: 'TUは「ありがとう」、GBは「さようなら」だよ。' }],
      },
      end: { send: 'GB', mean: 'さようなら', end: true, say: '交信おわり！ CQ・DE・K・R・TU、無線の言葉を5つ使えたね。' },
    },
  },
  {
    id: 'koma',
    title: '好きな駒は？',
    partner: 'yacobi',
    desc: 'ローマ字で、将棋の話',
    after: 'ham',
    start: 'shogi',
    nodes: {
      shogi: {
        send: 'SHOGI',
        mean: '将棋は好き？',
        lead: '将棋の話をしよう。YES か NO で答えてね。',
        replies: [
          { words: ['YES', 'OK'], mean: '好き', next: 'fav', react: 'わたしも！' },
          { words: ['NO'], mean: 'まだそうでもない', next: 'fav', react: 'これから好きになるよ、きっと。' },
        ],
      },
      fav: {
        send: 'FAV KOMA',
        mean: '好きな駒は？',
        lead: '駒の名前をローマ字で送ってね（FU・KYO・KEI・GIN・KIN・KAKU・HISHA・OU）。',
        replies: PIECES.map((piece) => ({ ...piece, next: 'sente' })),
      },
      sente: {
        send: 'SENTE GOTE',
        mean: '先手と後手、どっちがいい？',
        lead: '2つの言葉が届くよ。読めたら、好きなほうを1つ送ってね。',
        replies: [
          { words: ['SENTE'], mean: '先手', next: 'gl', react: '先手は先に指せるね。' },
          { words: ['GOTE'], mean: '後手', next: 'gl', react: '後手は、相手を見てから動けるね。' },
        ],
      },
      gl: { send: 'GL', mean: '幸運を（Good Luck）', end: true, say: '次の対局、がんばってね！ GLは「幸運を」っていう無線の言葉だよ。' },
    },
  },
  {
    id: 'hanane',
    title: '羽音からの信号',
    partner: 'hanane',
    desc: '少し速い信号と、羽音の謎かけ',
    after: 'koma',
    start: 'hi',
    nodes: {
      hi: {
        send: 'HI',
        mean: '……やあ',
        lead: 'モールス、覚えたんだ。少し速く送るから。',
        replies: [{ words: ['HI', 'HELLO'], mean: 'やあ', next: 'seq', react: '聞こえてるね。' }],
      },
      seq: {
        send: 'E I S',
        mean: 'E、I、S……',
        lead: '次に来る文字を1つ送って。並び、分かる？',
        clue: 'トンの数を数えてみて。',
        replies: [{ words: ['H'], mean: '次の文字', next: 'seq2', react: 'そういうこと。トンが1つずつ増えてる。' }],
      },
      seq2: {
        send: 'T M',
        mean: 'T、M……',
        lead: 'じゃあ、これは？',
        clue: '今度はツー。',
        replies: [{ words: ['O'], mean: '次の文字', next: 'end', react: '正解。ツーが3つ。' }],
      },
      end: { send: 'FB', mean: 'やるね（すばらしい）', end: true, say: '君、けっこう速いね。また送るよ。' },
    },
  },
  {
    id: 'free',
    title: '自由に話す',
    partner: 'yacobi',
    desc: '何を送っても、やこび姫が受け取る',
    after: 'first',
    free: true,
    start: '',
    nodes: {},
  },
].map((talk) => Object.freeze(talk)));
