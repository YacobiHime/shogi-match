// 自作の形の規則(docs/formation-detect-design.mdの7章の語彙、F2)。ひらがなすいしょうの規則に無い形と、数マスしか見ずに
// 不正確だった形を、ここで書く。同じ名前のひらがなすいしょうの規則があれば、こちらに置き換える(replaces)。
//
// 形は先手から見て書く(後手は盤を回して同じ式で見る)。マスは「99K」のように、筋・段・駒の記号(成り駒は「+P」)。
//   own     : 自分のこの駒が全部ある
//   ownAny  : 組ごとに、どれか1つがある(「金が7八か7七」など)
//   ownNot  : 自分のこの駒がない(似た形と見分ける)
// 1つの名前に形(variants)をいくつか書け、どれか1つがそろえば当たる。具体的さは own の数＋ ownAny の組の数。
// 囲いの形には、必ず玉のマスを入れる(玉が囲いの中にいるときだけ囲いと呼ぶ。7-1)。

export const FORMATION_CASTLE_RULES = Object.freeze([
  {
    // 穴熊の銀を8七に上げて冠にした形。ビッグ4はこれに7七銀と7八金を足した形(ひらがなすいしょうの規則)。
    // 前の規則は8七銀・9八香・9九玉・8九桂の4マスだけで、居飛車穴熊の銀が上がっただけでも付いていた。
    name: '銀冠穴熊',
    replaces: true,
    variants: [{ own: ['99K', '98L', '89N', '88G', '87S'], ownAny: [['78G', '77G', '79G']] }],
  },
  {
    // 矢倉から玉を9九へ潜った形(金矢倉の7七銀・6七金を残す)。
    name: '矢倉穴熊',
    variants: [{ own: ['99K', '98L', '89N', '88S', '78G', '77S', '67G', '76P'] }],
  },
  {
    // 美濃の銀を2七へ上げ、金は1枚(4七に金がない)。銀冠になる前の形。
    name: '片銀冠',
    variants: [{ own: ['28K', '27S', '38G', '26P'], ownNot: ['47G'] }],
  },
  {
    // 左美濃から銀を8七へ上げた居飛車の銀冠(振り飛車銀冠を左右に写した形)。
    // ひらがなすいしょうにも同じ形の「銀冠」があり、そちらは振り飛車銀冠に寄せていたので、居飛車の形はこちらを先に選ぶ。
    name: '居飛車銀冠',
    variants: [{ own: ['88K', '87S', '78G', '67G'] }],
  },
  {
    // 居飛車銀冠から玉を9八へ寄せた形。前の規則は8七銀と9八玉の2マスだけで、振り飛車の囲いとして数えていた。
    name: '端玉銀冠',
    replaces: true,
    variants: [{ own: ['98K', '87S', '86P'], ownAny: [['88G', '78G']] }],
  },
  {
    // 玉を飛車の側(4八・3八など)に置き、玉のまわり(3〜6筋の5〜8段)に金と銀を1枚ずつ。
    // 前の規則は玉と2筋の飛車だけで、序盤に玉が1つ寄っただけでも付いていた。
    // 図鑑の代表局(第36期竜王戦第4局の後手)の6二玉・6三金・5四銀の形に当たるように、金銀のマスは広めにとる。
    name: '右玉',
    replaces: true,
    variants: [{
      own: [],
      ownAny: [
        ['48K', '38K', '49K', '39K'],
        ['28R', '29R', '18R', '19R'],
        ['37G', '47G', '57G', '67G', '38G', '58G', '68G', '59G'],
        ['36S', '46S', '56S', '66S', '37S', '47S', '57S', '67S'],
      ],
    }],
  },
  {
    // 玉が5八で、左右に金。前の規則は金が片側でも付いていた。
    name: '中住まい',
    replaces: true,
    variants: [{ own: ['58K'], ownAny: [['68G', '78G', '69G'], ['48G', '38G', '49G']] }],
  },
]);

// ---- 戦法の規則(F3)。囲いの語彙に、次の条件を足す。
//   opp       : 相手の駒(自分から見たマス。先手なら盤のまま、後手なら盤を回した向き)が全部ある
//   oppAny    : 相手の駒の組ごとに、どれか1つ
//   oppRook   : 相手の飛車が 'ranging'(振り飛車。相手から見て5〜9筋)か 'static'(居飛車。1〜4筋)
//   visited   : 1局のうちに、自分のその駒がそのマスにいたことがある(駒の通り道。「四間から三間」など)
//   battle    : 戦型(相掛かり・矢倉など。formation-trackerのbattle)がこの名前
//   maxPly    : 名前を付けるのはこの手数まで(既定は戦法の60手。奇襲・急戦は早く)
// 形は一般の説明(定跡書・用語辞典の図)から書いた目安で、監査(scripts/formation-audit.mjs)と実戦で確かめて直す。
export const FORMATION_STRATEGY_RULES = Object.freeze([
  // 相居飛車
  { name: '脇システム', variants: [{ own: ['46B', '77S'], ownAny: [['78G', '67G']], opp: ['64B'] }] },
  { name: '矢倉棒銀', variants: [{ own: ['77S', '28R'], ownAny: [['78G', '67G'], ['26S', '15S']] }] },
  { name: '矢倉中飛車', variants: [{ own: ['77S', '58R'], ownAny: [['78G', '67G']], oppRook: 'static' }] },
  { name: 'カニカニ銀', maxPly: 50, variants: [{ own: ['46S', '66S'], oppRook: 'static' }] },
  { name: '相掛かり棒銀', battle: '相掛かり', variants: [{ own: ['28R'], ownAny: [['27S', '26S', '15S']] }] },
  // 位は銀で支える(歩の交換の直後の5五歩だけでは付けない。監査で見つけた)。
  { name: '5筋位取り', maxPly: 40, variants: [{ own: ['55P'], ownAny: [['46S', '56S', '66S']], ownNot: ['58R', '55R'], oppRook: 'static' }] },
  // 角を7九に引き、銀を7七に上げた形(角が引いただけでは付けない。監査で見つけた)。
  { name: '飯島流引き角戦法', maxPly: 40, variants: [{ own: ['79B', '77S'], oppRook: 'static' }] },
  { name: 'ツノ銀雁木', variants: [{ own: ['67S', '47S'], ownAny: [['78G', '58G']], ownNot: ['58R'] }] },
  // 対振り飛車(相手の飛車が振られてから)
  { name: '4六銀右急戦', maxPly: 50, variants: [{ own: ['46S', '28R'], ownAny: [['77S', '68S', '79S', '78S']], oppRook: 'ranging' }] },
  { name: '左美濃急戦', maxPly: 50, variants: [{ own: ['88K', '78S'], ownAny: [['46S', '57S', '35S']], oppRook: 'ranging' }] },
  { name: '右四間飛車急戦', maxPly: 50, variants: [{ own: ['48R'], ownAny: [['78K', '68K', '69K', '79K']], oppRook: 'ranging' }] },
  { name: '右四間飛車左美濃', variants: [{ own: ['48R', '88K', '78S'] }] },
  // 玉を居飛車の側に囲ってから飛車を3筋へ(玉が中央のままの飛車の寄りには付けない。監査で見つけた)。
  { name: '7二飛亜急戦', maxPly: 50, variants: [{ own: ['38R'], ownAny: [['78K', '68K', '79K', '88K']], oppRook: 'ranging' }] },
  { name: '玉頭位取り', variants: [{ own: ['35P'], ownAny: [['36S', '46S', '26S']], oppRook: 'ranging' }] },
  { name: '対振り持久戦', variants: [{ own: ['28R'], ownAny: [['99K', '88K', '98K', '87K']], oppRook: 'ranging' }] },
  { name: '5七金戦法', maxPly: 50, variants: [{ own: ['57G'], opp: ['52R'] }] },
  // 振り飛車
  { name: 'ツノ銀中飛車', variants: [{ own: ['58R', '47S', '67S'] }] },
  { name: '中飛車左穴熊', variants: [{ own: ['58R', '99K', '98L'] }] },
  { name: '4→3戦法', variants: [{ own: ['78R'], visited: ['68R'] }] },
  { name: '鬼殺し向かい飛車', maxPly: 20, variants: [{ own: ['88R', '77N'] }] },
]);
