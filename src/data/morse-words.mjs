// モールス信号の語呂(docs/brain-training-design.mdの17-2)。
// 頭文字がその文字で、拍ごとに言うと符号のリズムになる言葉。伸ばす音(「ー」で終わる拍)はツー、ほかの1音はトン。
// chantは拍の並び(かなで、伸ばす音は「ー」で書く)。符号は拍から作り、テストで本当の符号と同じかを確かめる(palace-morse.test.mjs)。
// cueは場所とからむ絵の文(「{場}」を1回含む。14-9)。initialは頭文字の手がかり。

export const MORSE_WORDS = Object.freeze([
  { letter: 'A', word: 'アロー（矢）', chant: ['ア', 'ロー'], emoji: '🏹', initial: 'Arrow の A', cue: '{場}に、アロー（矢）がシュッと飛んできて、ストンと刺さる！' },
  { letter: 'B', word: 'ブーメラン', chant: ['ブー', 'メ', 'ラ', 'ン'], emoji: '🪃', initial: 'Boomerang の B', cue: '{場}から、ブーメランがブーンと飛び出して、くるっと戻ってくる！' },
  { letter: 'C', word: 'チーズケーキ', chant: ['チー', 'ズ', 'ケー', 'キ'], emoji: '🍰', initial: 'Cheese cake の C', cue: '{場}に、大きなチーズケーキがドンと置かれて、甘いにおいがする！' },
  { letter: 'D', word: 'ドーナツ', chant: ['ドー', 'ナ', 'ツ'], emoji: '🍩', initial: 'Donut の D', cue: '{場}で、ドーナツがころころ転がって、穴から向こうがのぞける！' },
  { letter: 'E', word: '絵（え）', chant: ['エ'], emoji: '🖼️', initial: 'え（e）の E', cue: '{場}に、大きな絵がかざってあって、絵の中の人が手をふる！' },
  { letter: 'F', word: 'フラフープ', chant: ['フ', 'ラ', 'フー', 'プ'], emoji: '⭕', initial: 'ふ（fu）の F', cue: '{場}で、フラフープがくるくる回って、ぜんぜん止まらない！' },
  { letter: 'G', word: 'ゴーカート', chant: ['ゴー', 'カー', 'ト'], emoji: '🏎️', initial: 'Go-kart の G', cue: '{場}を、ゴーカートがブオーンと走りぬける！' },
  { letter: 'H', word: '歯みがき', chant: ['ハ', 'ミ', 'ガ', 'キ'], emoji: '🪥', initial: 'は（ha）の H', cue: '{場}で、大きな歯ブラシが、シャカシャカ歯をみがいている！' },
  { letter: 'I', word: 'イカ', chant: ['イ', 'カ'], emoji: '🦑', initial: 'いか（ika）の I', cue: '{場}から、イカがにゅるっと出てきて、墨をはく！' },
  { letter: 'J', word: '自動走行（じどうそうこう）', chant: ['ジ', 'ドー', 'ソー', 'コー'], emoji: '🚘', initial: 'じどう（jidō）の J', cue: '{場}を、だれも乗っていない車が、自動でスーッと走っていく！' },
  { letter: 'K', word: 'カードキー', chant: ['カー', 'ド', 'キー'], emoji: '💳', initial: 'かーど（kādo）の K', cue: '{場}で、カードキーをピッとかざすと、扉がパッと開く！' },
  { letter: 'L', word: 'レディーバグ（てんとう虫）', chant: ['レ', 'ディー', 'バ', 'グ'], emoji: '🐞', initial: 'Ladybug の L', cue: '{場}に、てんとう虫（レディーバグ）がびっしり止まって、赤く光る！' },
  { letter: 'M', word: 'モーモー（牛）', chant: ['モー', 'モー'], emoji: '🐄', initial: 'もーもー（mōmō）の M', cue: '{場}で、牛が「モーモー」と鳴きながら、草を食べている！' },
  { letter: 'N', word: 'ノート', chant: ['ノー', 'ト'], emoji: '📓', initial: 'Note の N', cue: '{場}に、ノートが山づみになって、ページがパラパラめくれる！' },
  { letter: 'O', word: '大入道（おおにゅうどう）', chant: ['オー', 'ニュー', 'ドー'], emoji: '👻', initial: 'おお（ō）の O', cue: '{場}に、大入道がぬうっと現れて、天井に頭がつかえる！' },
  { letter: 'P', word: 'ポニーテール', chant: ['ポ', 'ニー', 'テー', 'ル'], emoji: '👧', initial: 'Ponytail の P', cue: '{場}で、ポニーテールの女の子が、髪をぶんぶんふり回している！' },
  { letter: 'Q', word: '急行がゴー', chant: ['キュー', 'コー', 'ガ', 'ゴー'], emoji: '🚄', initial: '「キュー」の音（急行の きゅう）で Q', cue: '{場}を、急行列車が「ゴー！」と音を立ててかけぬける！' },
  { letter: 'R', word: 'レコード', chant: ['レ', 'コー', 'ド'], emoji: '💿', initial: 'Record の R', cue: '{場}で、レコードがくるくる回って、音楽が流れてくる！' },
  { letter: 'S', word: 'スイカ', chant: ['ス', 'イ', 'カ'], emoji: '🍉', initial: 'すいか（suika）の S', cue: '{場}に、大きなスイカがゴロンと置かれて、パカッと割れる！' },
  { letter: 'T', word: '塔（とう）', chant: ['トー'], emoji: '🗼', initial: 'とう（tō）の T', cue: '{場}から、高い塔がにょきにょき伸びて、天井をつきぬける！' },
  { letter: 'U', word: 'うりぼう（いのししの赤ちゃん）', chant: ['ウ', 'リ', 'ボー'], emoji: '🐗', initial: 'うりぼう（uribō）の U', cue: '{場}で、うりぼうがちょこちょこ走り回って、鼻でつついてくる！' },
  { letter: 'V', word: 'ビクトリー', chant: ['ビ', 'ク', 'ト', 'リー'], emoji: '✌️', initial: 'Victory の V', cue: '{場}で、優勝した人が「ビクトリー！」とVサインをする！' },
  { letter: 'W', word: 'ウオーター（水）', chant: ['ウ', 'オー', 'ター'], emoji: '💧', initial: 'Water の W', cue: '{場}から、ウオーター（水）がザバーッとあふれ出す！' },
  { letter: 'X', word: 'ほうれん草に×（バツ）', chant: ['ホー', 'レ', 'ン', 'ソー'], emoji: '🥬', initial: 'X は ×（バツ）の形', cue: '{場}に、きらいなほうれん草が置いてあって、大きな×（バツ）がついている！' },
  { letter: 'Y', word: 'ヨーロレーヒー（ヨーデル）', chant: ['ヨー', 'ロ', 'レー', 'ヒー'], emoji: '🎶', initial: 'Yodel の Y', cue: '{場}で、アルプスの人が「ヨーロレーヒー」とヨーデルを歌っている！' },
  { letter: 'Z', word: 'ずうずうしい', chant: ['ズー', 'ズー', 'シ', 'イ'], emoji: '😏', initial: 'ずうずう（zūzū）の Z', cue: '{場}に、ずうずうしいお客さんが、どっかり座って動かない！' },
].map((item) => Object.freeze({ ...item, chant: Object.freeze([...item.chant]) })));

/** 最後の回で読む言葉(17-5)。 */
export const MORSE_READ_WORDS = Object.freeze([
  Object.freeze({ word: 'SOS', meaning: '助けて（遭難信号）' }),
  Object.freeze({ word: 'SHOGI', meaning: '将棋' }),
]);
