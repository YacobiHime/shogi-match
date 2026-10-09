// 竜王戦の再現に使う、登場する棋士のデータ(架空の名前と段位、得意戦法・囲い)。
// 登場する棋士はすべて架空で、実在の棋士とは関係がない。

export const SURNAMES = Object.freeze([
  '青木', '秋山', '浅野', '池田', '石川', '今井', '上田', '内田', '遠藤', '大野',
  '岡田', '小川', '加藤', '金子', '川口', '木下', '小林', '近藤', '坂本', '桜井',
  '柴田', '杉山', '関口', '高田', '竹内', '田村', '土屋', '中島', '中村', '永井',
  '西田', '野口', '橋本', '浜田', '原田', '平野', '福田', '藤田', '堀内', '前田',
  '松井', '三浦', '宮崎', '村上', '森田', '八木', '山口', '吉田', '和田', '渡部',
]);

export const GIVEN_NAMES = Object.freeze([
  '健太', '直樹', '大輔', '拓也', '翔太', '隆司', '誠一', '和也', '啓介', '慶太',
  '俊介', '達也', '悠斗', '龍之介', '康平', '裕介', '光輝', '雄大', '智哉', '蒼太',
  '颯太', '陽介', '修平', '輝彦', '洋平', '正樹', '賢治', '孝明', '航平', '涼介',
  '秀樹', '哲也', '勇気', '亮太', '祐介', '剛志', '尚人', '宗一郎', '貴志', '淳也',
  '英司', '敦史', '玲央', '千尋', '一真', '潤', '大地', '寛', '昌平', '真吾',
]);

export const WOMEN_GIVEN_NAMES = Object.freeze([
  '美咲', '彩花', '結衣', '真央', '莉子', '優奈', '沙織', '千尋', '志保', '麻衣', '咲希', '葵',
]);

/**
 * 戦法と囲いの組。CPUが対応している戦法・囲いだけを使い、飛車の振り方(居飛車・振り飛車)が合う組にする。
 * strategyとcastleは、opening-guideの戦法・囲いのid。囲いと一体の戦法(腰掛け銀・藤井システム)は、castleを空にする。
 */
export const OPPONENT_STYLES = Object.freeze([
  { id: 'yagura', label: '矢倉', strategy: 'yagura-strategy', castle: 'yagura' },
  { id: 'kakugawari', label: '角換わり', strategy: 'kakugawari', castle: 'early-castle' },
  { id: 'kakugawari-kg', label: '角換わり腰掛け銀', strategy: 'kakugawari-koshikake-gin', castle: '' },
  { id: 'aigakari', label: '相掛かり', strategy: 'aigakari', castle: 'funagakoi' },
  { id: 'ibisha-anaguma', label: '居飛車穴熊', strategy: 'ibisha', castle: 'ibisha-anaguma' },
  { id: 'gangi', label: '雁木', strategy: 'ibisha', castle: 'gangi' },
  { id: 'left-mino', label: '居飛車左美濃', strategy: 'ibisha', castle: 'left-mino' },
  { id: 'right-shiken', label: '右四間飛車', strategy: 'right-shiken', castle: 'elmo' },
  { id: 'hayaguri', label: '早繰り銀', strategy: 'hayaguri-gin', castle: 'funagakoi' },
  { id: 'bougin', label: '棒銀', strategy: 'bougin', castle: 'funagakoi' },
  { id: 'shiken-mino', label: '四間飛車（美濃）', strategy: 'shiken', castle: 'mino' },
  { id: 'shiken-anaguma', label: '四間飛車（穴熊）', strategy: 'shiken', castle: 'furibisha-anaguma' },
  { id: 'shiken-silver-crown', label: '四間飛車（銀冠）', strategy: 'shiken', castle: 'silver-crown' },
  { id: 'sangen', label: '三間飛車', strategy: 'sangen', castle: 'mino' },
  { id: 'gokigen', label: 'ゴキゲン中飛車', strategy: 'gokigen', castle: 'high-mino' },
  { id: 'mukai', label: '向かい飛車', strategy: 'mukai', castle: 'mino' },
  { id: 'ishida', label: '早石田', strategy: 'ishida', castle: 'half-mino' },
  { id: 'fujii-system', label: '藤井システム', strategy: 'fujii-system', castle: '' },
]);

/**
 * 組ごとの棋力(CPUのLv)の平均。難易度の初期値(5)でのLv。
 * 上の組ほど強い。1組はプロの上位で、Lv40(藤井聡太並み)に近い。
 */
export const GROUP_MEAN_LEVEL = Object.freeze({ 1: 37, 2: 36, 3: 34.5, 4: 33, 5: 31.5, 6: 30 });

/** 組ごとの棋力のばらつき(標準偏差)。6組は、アマ・女流・奨励会員が混じるので広い。 */
export const GROUP_LEVEL_SPREAD = Object.freeze({ 1: 1.6, 2: 1.8, 3: 2, 4: 2.2, 5: 2.5, 6: 3.4 });

/** 組ごとの段位の分布。[段位, 重み]。 */
export const GROUP_DAN_WEIGHTS = Object.freeze({
  6: [['四段', 55], ['五段', 35], ['六段', 10]],
  5: [['四段', 20], ['五段', 55], ['六段', 25]],
  4: [['五段', 30], ['六段', 50], ['七段', 20]],
  3: [['六段', 40], ['七段', 45], ['八段', 15]],
  2: [['七段', 40], ['八段', 45], ['九段', 15]],
  1: [['八段', 45], ['九段', 55]],
});
