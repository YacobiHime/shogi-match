export const OPENING_STRATEGIES = [
  {
    id: "ibisha",
    label: "居飛車",
    family: "ibisha",
    detectionNames: [],
    blackMoves: ["2g2f", "2f2e"],
  },
  {
    id: "aigakari",
    label: "相掛かり",
    family: "ibisha",
    detectionNames: ["相掛かり", "AlphaZero流相掛かり"],
    blackMoves: ["2g2f", "2f2e"],
  },
  {
    id: "kakugawari",
    label: "角換わり",
    family: "kakugawari",
    detectionNames: ["角換わり", "一手損角換わり"],
    blackMoves: ["7g7f", "2g2f", "2f2e", "8h2b+"],
  },
  {
    id: "yagura-strategy",
    label: "矢倉戦法",
    family: "ibisha",
    detectionNames: ["矢倉", "金矢倉"],
    blackMoves: ["7g7f", "6g6f", "7i6h", "6h7g"],
  },
  {
    id: "shiken",
    label: "四間飛車",
    family: "shiken",
    detectionNames: ["四間飛車", "ノーマル四間飛車"],
    blackMoves: ["7g7f", "6g6f", "2h6h"],
  },
  {
    id: "yababozu",
    label: "やばボーズ流",
    family: "special",
    detectionNames: ["やばボーズ流"],
    strictOrder: true,
    adaptiveOrder: true,
    // 角交換後の金・銀・右玉型を一度組めば、その後に攻めへ転じても完成扱いを保つ。
    historyCompletes: true,
    // 通常形（6九飛・7七桂）と、腰掛け銀へ5六銀で対抗する形のどちらも完成形とする。
    completionVariants: [
      [["6i", "R"], ["6g", "S"], ["7h", "G"], ["7g", "N"], ["3h", "K"]],
      [["2h", "R"], ["5f", "S"], ["7h", "G"], ["3h", "K"]],
    ],
    availability: {
      colors: ["white"],
      requiredHistory: ["7g7f"],
      requiredHistoryBeforeMoves: [
        { move: "4a3b", required: "7i8h" },
        { move: "3a4b", required: "7i8h" },
      ],
    },
    // 先手側へ正規化した通常形。後手では左右反転して案内する。
    blackMoves: [
      "7g7f", "8h2b+", "6i7h", "7i6h", "6g6f", "6h6g",
      "2h6h", "5i4h", "4h3h", "8i7g", "6h6i",
    ],
    planVariants: {
      // 相手の腰掛け銀が6筋へ歩を進めた場合は、飛車を振らず5六銀で争点を受ける。
      koshikakeSixthFile: [
        "7g7f", "8h2b+", "6i7h", "7i6h", "6g6f", "6h6g",
        "6g5f", "5i4h", "4h3h", "8i7g",
      ],
    },
    movePrerequisites: {
      "8h2b+": ["7g7f"],
      "6i7h": ["8h2b+"],
      // やばボーズ流の土台は「角交換→7八金」。銀より先に必ず金を上がる。
      "7i6h": ["6i7h"],
      "6g6f": ["6i7h", "7i6h"],
      "6h6g": ["6g6f", "7i6h"],
      "2h6h": ["6h6g"],
      "5i4h": ["2h6h"],
      "4h3h": ["5i4h"],
      "8i7g": ["4h3h"],
      "6h6i": ["8i7g"],
    },
    movePrerequisitesByVariant: {
      koshikakeSixthFile: {
        "6g5f": ["6h6g"],
        "5i4h": ["6g5f"],
        "4h3h": ["5i4h"],
        "8i7g": ["4h3h"],
      },
    },
    // 飛車を四間へ振るまでは、金などが横移動の経路を塞がないようにする。
    planReservations: [
      {
        until: "2h6h",
        squares: ["3h", "4h", "5h", "6h"],
        fromSquares: ["2h", "6i", "7i", "6g", "6h", "7h"],
      },
      {
        until: "4h3h",
        squares: ["4h", "3h"],
        fromSquares: ["5i", "4h"],
      },
      {
        until: "6h6i",
        squares: ["6i"],
        fromSquares: ["6h"],
      },
    ],
  },
  {
    id: "fujii-system",
    label: "藤井システム",
    family: "shiken",
    detectionNames: ["藤井システム"],
    blackMoves: ["7g7f", "6g6f", "2h6h", "1g1f", "8h7g", "3i3h", "6i5h", "7i7h"],
  },
  {
    id: "sangen",
    label: "三間飛車",
    family: "sangen",
    detectionNames: ["三間飛車", "ノーマル三間飛車"],
    blackMoves: ["7g7f", "6g6f", "2h7h"],
  },
  {
    id: "nakabisha",
    label: "中飛車",
    family: "nakabisha",
    detectionNames: ["中飛車", "ゴキゲン中飛車"],
    blackMoves: ["5g5f", "2h5h"],
  },
  {
    id: "gokigen",
    label: "ゴキゲン中飛車",
    family: "nakabisha",
    detectionNames: ["ゴキゲン中飛車"],
    blackMoves: ["5g5f", "2h5h", "7g7f"],
  },
  {
    id: "mukai",
    label: "向かい飛車",
    family: "mukai",
    detectionNames: ["向かい飛車", "ダイレクト向かい飛車"],
    blackMoves: ["7g7f", "8h7g", "2h8h"],
  },
  {
    id: "ishida",
    label: "石田流",
    family: "sangen",
    detectionNames: ["石田流", "早石田"],
    blackMoves: ["7g7f", "7f7e", "2h7h", "7h7f"],
  },
  {
    id: "bougin",
    label: "棒銀",
    family: "kakugawari",
    detectionNames: ["棒銀"],
    blackMoves: ["2g2f", "2f2e", "3i3h", "3h2g", "2g2f"],
  },
  {
    id: "right-shiken",
    label: "右四間飛車",
    family: "ibisha",
    detectionNames: ["右四間飛車"],
    blackMoves: ["7g7f", "6g6f", "5g5f", "4g4f", "3i4h", "4h4g", "2h4h"],
  },
  {
    id: "hayaguri-gin",
    label: "早繰り銀",
    family: "kakugawari",
    detectionNames: ["早繰り銀"],
    blackMoves: ["3g3f", "3i4h", "4h3g", "3g4f"],
  },
  {
    id: "koshikake-gin",
    label: "腰掛け銀",
    family: "kakugawari",
    detectionNames: ["腰掛け銀"],
    blackMoves: ["4g4f", "3i4h", "4h4g", "4g5f"],
  },
  {
    id: "sodebisha",
    label: "袖飛車",
    family: "ibisha",
    detectionNames: ["袖飛車"],
    blackMoves: ["3g3f", "2h3h"],
  },
  {
    id: "onigoroshi",
    label: "鬼殺し",
    family: "special",
    detectionNames: ["鬼殺し"],
    blackMoves: ["7g7f", "7f7e", "8i7g"],
  },
  {
    id: "sujichigai-kaku",
    label: "筋違い角",
    family: "special",
    detectionNames: ["筋違い角"],
    strictOrder: true,
    availability: {
      colors: ["black"],
      requiredHistory: ["3c3d"],
      requiredHistoryBeforeMoves: [
        { move: "8h2b+", required: "3c3d" },
        { move: "B*4e", required: "3a2b" },
      ],
    },
    blackMoves: ["7g7f", "8h2b+", "B*4e", "4e3d", "6g6f"],
  },
  {
    id: "kakuto-fu",
    label: "角頭歩戦法",
    family: "special",
    detectionNames: ["角頭歩"],
    strictOrder: true,
    availability: {
      colors: ["black"],
      requiredHistory: ["3c3d"],
    },
    blackMoves: ["7g7f", "8g8f", "8f8e", "8h7g"],
  },
  {
    id: "hashikaku-nakabisha",
    label: "端角中飛車",
    family: "special",
    detectionNames: ["端角中飛車"],
    strictOrder: true,
    blackMoves: ["9g9f", "8h9g", "5g5f", "2h5h", "7i6h", "6h5g"],
  },
  {
    id: "shin-onigoroshi",
    label: "新鬼殺し",
    family: "special",
    detectionNames: ["新鬼殺し"],
    strictOrder: true,
    availability: { colors: ["black"] },
    blackMoves: ["7g7f", "7f7e", "2h7h", "7h7f", "8i7g", "7i6h"],
  },
  {
    id: "first-78-rook",
    label: "7八飛戦法",
    family: "special",
    detectionNames: ["7八飛戦法"],
    strictOrder: true,
    availability: { colors: ["black"], maxHistoryLength: 0 },
    blackMoves: ["2h7h", "7g7f", "7f7e", "7h7f"],
  },
  {
    id: "second-32-rook",
    label: "2手目3二飛戦法",
    family: "special",
    detectionNames: ["2手目3二飛戦法"],
    strictOrder: true,
    availability: {
      colors: ["white"],
      opponentFirstMove: "7g7f",
      maxHistoryLength: 1,
    },
    // 先手側の7八飛を180度反転すると、後手の3二飛になる。
    blackMoves: ["2h7h", "7g7f", "7f7e", "7h7f"],
  },
  {
    id: "torizashi",
    label: "鳥刺し",
    family: "special",
    detectionNames: ["鳥刺し"],
    strictOrder: true,
    blackMoves: ["7g7f", "5g5f", "7i6h", "6h5g", "8h7i", "5g4f"],
  },
  {
    id: "ahiru",
    label: "アヒル戦法",
    family: "special",
    detectionNames: ["アヒル囲い", "アヒル戦法"],
    strictOrder: true,
    completionSquares: [
      ["5h", "K"], ["3h", "G"], ["7h", "G"], ["2f", "R"],
    ],
    blackMoves: ["2g2f", "2f2e", "2h2f", "5i5h", "4i3h", "6i7h", "9g9f", "1g1f"],
  },
  {
    id: "pacman",
    label: "パックマン",
    family: "special",
    detectionNames: ["パックマン", "シン・パックマン"],
    // 後手が初手7六歩へ4四歩と誘い、角で取られた場合だけ成立する。
    availability: {
      colors: ["white"],
      opponentFirstMove: "7g7f",
      requiredHistoryBeforeMoves: [{ move: "8b4b", required: "8h4d" }],
    },
    blackMoves: ["6g6f", "2h6h"],
  },
  {
    id: "ureshino",
    label: "嬉野流",
    family: "special",
    detectionNames: ["嬉野流"],
    blackMoves: ["6g6f", "7i6h", "6h6g"],
  },
];

export const OPENING_CASTLES = [
  {
    id: "half-mino",
    label: "片美濃",
    detectionNames: ["片美濃"],
    strictOrder: true,
    completionSquares: [["2h", "K"], ["3h", "S"], ["4i", "G"], ["6h", "R"]],
    blackMoves: ["7g7f", "6g6f", "2h6h", "5i4h", "4h3h", "3h2h", "3i3h"],
  },
  {
    id: "mino",
    label: "美濃囲い",
    detectionNames: ["美濃囲い", "本美濃", "高美濃囲い", "銀冠"],
    blackMoves: ["2h6h", "5i4h", "4h3h", "3h2h", "3i3h", "6i5h"],
  },
  {
    id: "high-mino",
    label: "高美濃囲い",
    detectionNames: ["高美濃", "高美濃囲い"],
    blackMoves: ["2h6h", "5i4h", "4h3h", "3h2h", "3i3h", "6i5h", "4g4f", "5h4g"],
  },
  {
    id: "diamond-mino",
    label: "ダイヤモンド美濃",
    detectionNames: ["ダイヤモンド美濃"],
    strictOrder: true,
    completionSquares: [
      ["2h", "K"], ["3h", "S"], ["4g", "S"], ["4i", "G"], ["5h", "G"], ["6h", "R"],
    ],
    blackMoves: [
      "7g7f", "6g6f", "5g5f", "4g4f", "7i6h", "6h5g", "5g4h", "4h4g",
      "2h6h", "5i4h", "4h3h", "3h2h", "3i3h", "6i5h",
    ],
  },
  {
    id: "renmei-mino",
    label: "連盟美濃",
    detectionNames: ["連盟美濃"],
    strictOrder: true,
    completionSquares: [["2h", "K"], ["3i", "S"], ["4h", "G"], ["5i", "G"], ["6h", "R"]],
    blackMoves: ["7g7f", "6g6f", "2h6h", "5i4h", "4h3h", "3h2h", "4i4h", "6i5i"],
  },
  {
    id: "silver-crown",
    label: "銀冠",
    detectionNames: ["銀冠", "端玉銀冠"],
    blackMoves: ["2h6h", "5i4h", "4h3h", "3h2h", "3i3h", "6i5h", "4g4f", "5h4g", "2g2f", "3h2g", "4i3h"],
  },
  {
    id: "furibisha-anaguma",
    label: "振り飛車穴熊",
    detectionNames: ["振り飛車穴熊", "四枚穴熊", "銀冠穴熊"],
    blackMoves: ["2h6h", "1i1h", "5i4h", "4h3h", "3h2h", "2h1i", "3i2h"],
  },
  {
    id: "furibisha-elmo",
    label: "振り飛車エルモ",
    detectionNames: ["振り飛車エルモ"],
    strictOrder: true,
    completionSquares: [["3h", "K"], ["4h", "S"], ["3i", "G"], ["6h", "R"]],
    blackMoves: ["7g7f", "6g6f", "2h6h", "5i4h", "4h3h", "3i4h", "4i3i"],
  },
  {
    id: "right-elmo",
    label: "右エルモ",
    detectionNames: ["右エルモ"],
    strictOrder: true,
    completionSquares: [["3h", "K"], ["4h", "S"], ["3i", "G"], ["5h", "G"], ["6h", "R"]],
    blackMoves: ["7g7f", "6g6f", "2h6h", "5i4h", "4h3h", "3i4h", "4i3i", "6i5h"],
  },
  {
    id: "funagakoi",
    label: "舟囲い",
    detectionNames: ["舟囲い", "箱入り娘"],
    blackMoves: ["5i6h", "6h7h", "4i5h"],
  },
  {
    id: "early-castle",
    label: "早囲い",
    detectionNames: ["早囲い"],
    strictOrder: true,
    completionSquares: [["7h", "K"], ["7g", "S"], ["8h", "B"]],
    blackMoves: ["7g7f", "7i6h", "6h7g", "5i6h", "6h7h"],
  },
  {
    id: "yagura",
    label: "矢倉",
    detectionNames: ["矢倉", "金矢倉", "銀矢倉", "総矢倉"],
    blackMoves: ["7g7f", "8h6f", "7i6h", "6h7g", "5i6h", "6h7i", "7i8h", "6i7h", "4i5h", "5h6h"],
  },
  {
    id: "doi-yagura",
    label: "土居矢倉",
    detectionNames: ["土居矢倉"],
    strictOrder: true,
    completionSquares: [["7h", "K"], ["7g", "S"], ["6g", "G"], ["5h", "G"]],
    blackMoves: [
      "7g7f", "8h6f", "6f5e", "6g6f", "7i6h", "6h7g", "5i6h", "6h7h",
      "6i6h", "6h6g", "4i5h",
    ],
  },
  {
    id: "kikusui-yagura",
    label: "菊水矢倉",
    detectionNames: ["菊水矢倉"],
    strictOrder: true,
    completionSquares: [["8i", "K"], ["8h", "S"], ["7h", "G"], ["7g", "N"], ["6g", "G"]],
    blackMoves: [
      "7g7f", "8h6f", "6f5e", "6g6f", "7i6h", "6h7g", "7g8h", "8i7g",
      "5i6h", "6h7h", "7h8i", "6i7h", "4i5h", "5h6h", "6h6g",
    ],
  },
  {
    id: "elmo",
    label: "エルモ囲い",
    detectionNames: ["エルモ囲い"],
    blackMoves: ["7i6h", "6i7i", "5i6i", "6i7h"],
  },
  {
    id: "gangi",
    label: "雁木",
    detectionNames: ["雁木"],
    blackMoves: ["7g7f", "8h7g", "6g6f", "7i6h", "6h6g", "5i6h", "6h7i", "7i8h", "6i7h"],
  },
  {
    id: "left-mino",
    label: "左美濃",
    detectionNames: ["左美濃", "居角左美濃", "天守閣美濃"],
    blackMoves: ["7g7f", "8h6f", "7i7h", "5i6h", "6h7i", "7i8h", "6i6h"],
  },
  {
    id: "tenshukaku-mino",
    label: "天守閣美濃",
    detectionNames: ["天守閣美濃"],
    strictOrder: true,
    completionSquares: [["8g", "K"], ["7h", "S"], ["6i", "G"]],
    blackMoves: ["7g7f", "8g8f", "8h6f", "7i7h", "5i6h", "6h7i", "7i8h", "8h8g"],
  },
  {
    id: "ibisha-anaguma",
    label: "居飛車穴熊",
    detectionNames: ["居飛車穴熊", "松尾流穴熊"],
    strictOrder: true,
    completionSquares: [
      ["9i", "K"], ["9h", "L"], ["8h", "S"], ["7h", "G"], ["7g", "N"],
    ],
    blackMoves: ["9i9h", "7g7f", "8h6f", "8i7g", "7i8h", "6i7h", "5i6i", "6i7i", "7i8i", "8i9i"],
  },
  {
    id: "matsuo-anaguma",
    label: "松尾流穴熊",
    detectionNames: ["松尾流穴熊"],
    strictOrder: true,
    completionSquares: [
      ["9i", "K"], ["9h", "L"], ["8i", "N"], ["8h", "S"], ["7i", "S"], ["7h", "G"],
    ],
    blackMoves: [
      "9i9h", "7g7f", "8h6f", "6f5e", "6g6f", "7i6h", "6h7g",
      "5i6h", "6h7i", "7i8h", "8h9i", "7g8h",
      "5g5f", "3i4h", "4h5g", "5g6h", "6h7i", "6i7h",
    ],
  },
  {
    id: "millennium",
    label: "ミレニアム",
    detectionNames: ["ミレニアム", "振り飛車ミレニアム"],
    blackMoves: ["7g7f", "8h6f", "8i7g", "7i8h", "6i7i", "5i6h", "6h7h", "7h8i"],
  },
  {
    id: "right-king",
    label: "右玉",
    // 戦型判定は4八玉だけでも成立するため、補助では完成形を直接確認する。
    detectionNames: [],
    strictOrder: true,
    completionSquares: [
      ["4h", "K"], ["7h", "G"], ["6g", "S"],
      ["4g", "S"], ["3g", "N"], ["2i", "R"],
    ],
    blackMoves: [
      "7g7f", "6g6f", "7i6h", "6h6g", "3i4h", "4g4f",
      "4h4g", "3g3f", "6i7h", "5i4h", "2i3g", "2h2i",
    ],
  },
  {
    id: "kinmusou",
    label: "金無双",
    detectionNames: ["金無双", "離れ金無双", "銀冠金無双"],
    strictOrder: true,
    completionSquares: [
      ["3h", "K"], ["2h", "S"], ["4h", "G"], ["5h", "G"], ["6h", "R"],
    ],
    // 金無双を単独で選んでも、先に四間へ振って玉の退路と2八銀の場所を空ける。
    blackMoves: [
      "7g7f", "6g6f", "2h6h", "5i4h", "4h3h", "3i2h", "4i4h", "6i5h",
    ],
  },
  {
    id: "half-kinmusou",
    label: "片金無双",
    detectionNames: ["片金無双"],
    strictOrder: true,
    completionSquares: [["3h", "K"], ["2h", "S"], ["4h", "G"], ["6h", "R"]],
    blackMoves: ["7g7f", "6g6f", "2h6h", "5i4h", "4h3h", "3i2h", "4i4h"],
  },
  {
    id: "osumi",
    label: "大隅囲い",
    detectionNames: ["大隅囲い"],
    strictOrder: true,
    completionSquares: [["3h", "K"], ["4h", "G"]],
    blackMoves: ["5i4h", "4h3h", "4i4h"],
  },
  {
    id: "nakazumai",
    label: "中住まい",
    detectionNames: ["中住まい", "中原囲い"],
    blackMoves: ["5i5h", "4i3h", "6i7h"],
  },
  {
    id: "kanigakoi",
    label: "カニ囲い",
    detectionNames: ["カニ囲い"],
    blackMoves: ["6i7h", "7i6h", "5i6i", "4i5h"],
  },
  {
    id: "bonanza",
    label: "ボナンザ囲い",
    detectionNames: ["ボナンザ囲い"],
    blackMoves: ["7g7f", "8h6f", "7i7h", "7h7g", "5i6h", "6h7h", "6i6h", "4i5h"],
  },
];

const STATIC_ROOK_STRATEGIES = new Set([
  "ibisha", "aigakari", "kakugawari", "yagura-strategy", "bougin",
  "right-shiken", "hayaguri-gin", "koshikake-gin", "ureshino",
  "sujichigai-kaku", "kakuto-fu", "torizashi", "ahiru",
]);
const RANGING_ROOK_STRATEGIES = new Set([
  "shiken", "yababozu", "fujii-system", "sangen", "nakabisha", "gokigen",
  "mukai", "ishida", "sodebisha", "hashikaku-nakabisha", "shin-onigoroshi",
  "first-78-rook", "second-32-rook",
]);
const STATIC_ROOK_CASTLES = new Set([
  "funagakoi", "early-castle", "yagura", "doi-yagura", "kikusui-yagura", "elmo",
  "gangi", "left-mino", "tenshukaku-mino", "ibisha-anaguma", "matsuo-anaguma",
  "right-king", "nakazumai", "kanigakoi", "bonanza",
]);
const RANGING_ROOK_CASTLES = new Set([
  "half-mino", "mino", "high-mino", "diamond-mino", "renmei-mino", "silver-crown",
  "furibisha-anaguma", "furibisha-elmo", "right-elmo", "kinmusou", "half-kinmusou",
]);

export function openingDefinitionRookStyle(id, kind) {
  const staticIds = kind === "strategy" ? STATIC_ROOK_STRATEGIES : STATIC_ROOK_CASTLES;
  const rangingIds = kind === "strategy" ? RANGING_ROOK_STRATEGIES : RANGING_ROOK_CASTLES;
  if (staticIds.has(id)) return "static";
  if (rangingIds.has(id)) return "ranging";
  return undefined;
}

export function mirrorUsiMove(usi) {
  return usi.replace(/([1-9])([a-i])/g, (_, file, rank) => (
    `${10 - Number(file)}${String.fromCharCode(
      "a".charCodeAt(0) + "i".charCodeAt(0) - rank.charCodeAt(0),
    )}`
  ));
}

/** 現在の飛車位置と序盤の着手から、居飛車／振り飛車への確定を判定する。 */
export function inferOpeningRookStyle({ color = "black", playedMoves = [], currentSfen = "" }) {
  const canonicalMoves = color === "white" ? playedMoves.map(mirrorUsiMove) : playedMoves;
  const board = parseSfenBoard(currentSfen);
  const rook = [...board.entries()].find(([, piece]) => (
    piece.color === color && piece.kind === "R"
  ));
  if (rook) {
    const square = color === "white" ? mirrorUsiMove(rook[0]) : rook[0];
    // 初期筋以外へ飛車を振っていれば、他の手順より強い確定材料とする。
    // 4筋へ出す右四間飛車だけは、飛車を横へ動かしても居飛車として扱う。
    if (square[0] !== "2") return square[0] === "4" ? "static" : "ranging";
  }
  if (canonicalMoves.some((move) => /^2h4[a-i]/.test(move))) return "static";
  if (canonicalMoves.some((move) => /^2h[3-9][a-i]/.test(move))) return "ranging";
  // 飛車先、4八銀、角交換はいずれも居飛車側へ進んだ明確な手掛かり。
  if (canonicalMoves.some((move) => (
    move === "2g2f" || move === "2f2e" || move === "3i4h" || move === "8h2b+"
  ))) return "static";
  return undefined;
}

function canonicalMovesForColor(moves, color) {
  return color === "white" ? moves.map(mirrorUsiMove) : moves;
}

function openingStrategyPlan(strategy, {
  color = "black",
  playedMoves = [],
  opponentMoves = [],
  opponentFormations = [],
} = {}) {
  if (!strategy) return { moves: [], variant: "default" };
  if (strategy.id !== "yababozu") {
    return { moves: strategy.blackMoves ?? [], variant: "default" };
  }
  const played = new Set(canonicalMovesForColor(playedMoves, color));
  const opponent = new Set(canonicalMovesForColor(
    opponentMoves,
    color === "black" ? "white" : "black",
  ));
  // 一度飛車を振った後で別枝へ切り替えたり、5六銀型から飛車を振ったりしない。
  const normalLocked = played.has("2h6h") || played.has("6h6i");
  const counterLocked = played.has("6g5f");
  const koshikakeDetected = opponentFormations.includes("腰掛け銀");
  const sixthFilePressure = opponent.has("6g6f") || opponent.has("6f6e");
  const useCounter = counterLocked || (!normalLocked && koshikakeDetected && sixthFilePressure);
  return useCounter
    ? { moves: strategy.planVariants?.koshikakeSixthFile ?? strategy.blackMoves, variant: "koshikakeSixthFile" }
    : { moves: strategy.blackMoves ?? [], variant: "default" };
}

export function openingPlanSteps(strategyId, castleId, color = "black", context = {}) {
  const strategy = OPENING_STRATEGIES.find(({ id }) => id === strategyId);
  const castle = OPENING_CASTLES.find(({ id }) => id === castleId);
  const convert = color === "white" ? mirrorUsiMove : (move) => move;
  const strategyPlan = openingStrategyPlan(strategy, { ...context, color });
  const seen = new Set();
  return [
    ...strategyPlan.moves.map((usi) => ({ usi: convert(usi), phase: "strategy" })),
    ...(castle?.blackMoves ?? []).map((usi) => ({ usi: convert(usi), phase: "castle" })),
  ].filter(({ usi }) => {
    if (seen.has(usi)) return false;
    seen.add(usi);
    return true;
  });
}

function parseSfenBoard(sfen) {
  const boardPart = String(sfen ?? "").trim().split(/\s+/)[0];
  const ranks = boardPart.split("/");
  if (ranks.length !== 9) return new Map();
  const board = new Map();
  ranks.forEach((rank, rankIndex) => {
    let file = 9;
    let promoted = false;
    for (const symbol of rank) {
      if (/[1-9]/.test(symbol)) {
        file -= Number(symbol);
      } else if (symbol === "+") {
        promoted = true;
      } else {
        board.set(`${file}${String.fromCharCode(97 + rankIndex)}`, {
          color: symbol === symbol.toUpperCase() ? "black" : "white",
          kind: `${promoted ? "+" : ""}${symbol.toUpperCase()}`,
        });
        file -= 1;
        promoted = false;
      }
    }
  });
  return board;
}

function matchesCompletionSquares(definition, currentSfen, color) {
  const variants = definition?.completionVariants?.length
    ? definition.completionVariants
    : definition?.completionSquares?.length
      ? [definition.completionSquares]
      : [];
  if (!variants.length || !currentSfen) return undefined;
  const board = parseSfenBoard(currentSfen);
  return variants.some((squares) => squares.every(([blackSquare, kind]) => {
    const square = color === "white" ? mirrorUsiMove(blackSquare) : blackSquare;
    const piece = board.get(square);
    return piece?.color === color && piece.kind === kind;
  }));
}

function definitionDetectedComplete(definition, detected, currentSfen, color) {
  const exact = matchesCompletionSquares(definition, currentSfen, color);
  if (exact !== undefined) return exact;
  return definition?.detectionNames.some((name) => detected.has(name)) ?? false;
}

/** 現在の局面から着手可能な手順が残っている戦法・囲いだけを返す。 */
export function availableOpeningDefinitions({
  definitions,
  kind,
  color = "black",
  playedMoves = [],
  moveHistory = [],
  legalMoves = [],
  detectedFormations = [],
  currentSfen = "",
  rookStyle,
}) {
  const played = new Set(playedMoves);
  const history = new Set(moveHistory);
  const detected = new Set(detectedFormations);
  return definitions.filter((definition) => {
    const definitionStyle = openingDefinitionRookStyle(definition.id, kind);
    if (rookStyle && definitionStyle && rookStyle !== definitionStyle) return false;
    const steps = openingPlanSteps(
      kind === "strategy" ? definition.id : "",
      kind === "castle" ? definition.id : "",
      color,
    );
    const started = steps.some(({ usi }) => played.has(usi));
    const availability = definition.availability;
    if (availability?.colors && !availability.colors.includes(color)) return false;
    if (!started && availability) {
      if (
        Number.isInteger(availability.maxHistoryLength)
        && moveHistory.length > availability.maxHistoryLength
      ) return false;
      if (
        availability.requiredHistory
        && !availability.requiredHistory.every((move) => history.has(move))
      ) return false;
      if (
        availability.opponentFirstMove
        && moveHistory[0] !== availability.opponentFirstMove
      ) return false;
    }
    if (definitionDetectedComplete(definition, detected, currentSfen, color)) return true;
    if (steps.length > 0 && steps.every(({ usi }) => played.has(usi))) return true;

    const next = nextOpeningPlanMove({
      strategyId: kind === "strategy" ? definition.id : "",
      castleId: kind === "castle" ? definition.id : "",
      color,
      playedMoves,
      moveHistory,
      legalMoves,
      detectedFormations,
      currentSfen,
    });
    if (!next) return false;
    const requirement = availability?.requiredHistoryBeforeMoves?.find(
      ({ move }) => move === next.usi,
    );
    return !requirement || history.has(requirement.required);
  });
}

/**
 * 相手の応手によって奇襲の成立条件が失われたかを判定する。
 * 一時的に予定手が指せないだけの局面とは分け、確実に不成立になった場合だけ返す。
 */
export function openingPlanInterruption({
  strategyId,
  color = "black",
  playedMoves = [],
  opponentMoves = [],
  moveHistory = [],
} = {}) {
  const own = new Set(canonicalMovesForColor(playedMoves, color));
  const opponent = new Set(canonicalMovesForColor(
    opponentMoves,
    color === "black" ? "white" : "black",
  ));
  const lastMove = moveHistory.at(-1);

  if (
    strategyId === "yababozu"
    && own.has("7g7f") && !own.has("8h2b+")
    && opponent.has("6g6f")
  ) {
    return {
      fallbackStrategyId: "shiken",
      message: "うわー！相手が角道を閉じちゃった。うぅ～やばボーズ流はできないね。普通の四間飛車で攻めよっか。",
    };
  }

  if (strategyId === "pacman" && own.has("6g6f") && moveHistory.length >= 3) {
    const requiredCapture = color === "white" ? "8h4d" : "2b6f";
    if (!moveHistory.includes(requiredCapture)) {
      return {
        fallbackStrategyId: "shiken",
        message: "あっ、相手は歩を取らなかったね。パックマンは不成立だから、普通の四間飛車に切り替えよっか。",
      };
    }
  }

  if (
    strategyId === "sujichigai-kaku"
    && own.has("8h2b+") && !own.has("B*4e")
    && lastMove && !["3a2b", "3c2b", "4a2b"].includes(lastMove)
  ) {
    return {
      fallbackStrategyId: "ibisha",
      message: "角交換の受け方が想定と違うね。筋違い角を無理に続けず、角の打ち込みに気を付けて居飛車で戦おう。",
    };
  }

  return null;
}

export function openingPlanCandidates({
  strategyId,
  castleId,
  color = "black",
  playedMoves = [],
  moveHistory = [],
  legalMoves = [],
  detectedFormations = [],
  opponentFormations = [],
  opponentMoves = [],
  currentSfen = "",
}) {
  const strategy = OPENING_STRATEGIES.find(({ id }) => id === strategyId);
  const castle = OPENING_CASTLES.find(({ id }) => id === castleId);
  const detected = new Set(detectedFormations);
  const strategyComplete = definitionDetectedComplete(strategy, detected, currentSfen, color);
  const castleComplete = definitionDetectedComplete(castle, detected, currentSfen, color);
  const played = new Set(playedMoves);
  const history = new Set(moveHistory);
  const legal = new Set(legalMoves);
  const convert = color === "white" ? mirrorUsiMove : (move) => move;

  const planContext = { playedMoves, opponentMoves, opponentFormations };
  const steps = openingPlanSteps(strategyId, castleId, color, planContext);
  const strategyVariant = openingStrategyPlan(strategy, { ...planContext, color }).variant;
  for (const phase of ["strategy", "castle"]) {
    const definition = phase === "strategy" ? strategy : castle;
    const complete = phase === "strategy" ? strategyComplete : castleComplete;
    if (!definition || complete) continue;
    const pending = steps.filter((entry) => entry.phase === phase && !played.has(entry.usi));
    const combinedPrerequisites = {
      ...(definition.movePrerequisites ?? {}),
      ...(phase === "strategy"
        ? definition.movePrerequisitesByVariant?.[strategyVariant] ?? {}
        : {}),
    };
    const prerequisites = new Map(Object.entries(combinedPrerequisites).map(
      ([move, required]) => [convert(move), required.map(convert)],
    ));
    const isReady = (entry) => {
      if (!legal.has(entry.usi)) return false;
      if (!(prerequisites.get(entry.usi) ?? []).every((move) => played.has(move))) return false;
      const historyRequirement = definition.availability?.requiredHistoryBeforeMoves?.find(
        ({ move }) => move === entry.usi,
      );
      return !historyRequirement || history.size === 0 || history.has(historyRequirement.required);
    };
    if (definition.strictOrder && !definition.adaptiveOrder) {
      const next = pending[0];
      if (next) return isReady(next) ? [next] : [];
      continue;
    }
    const candidates = pending.filter(isReady);
    if (candidates.length) return candidates;
  }
  return [];
}

export function nextOpeningPlanMove(options) {
  return openingPlanCandidates(options)[0] ?? null;
}

export function isOpeningPlanComplete({
  strategyId,
  castleId,
  color = "black",
  playedMoves = [],
  detectedFormations = [],
  opponentFormations = [],
  opponentMoves = [],
  currentSfen = "",
}) {
  if (!strategyId && !castleId) return false;
  const detected = new Set(detectedFormations);
  const played = new Set(playedMoves);
  const steps = openingPlanSteps(strategyId, castleId, color, {
    playedMoves, opponentMoves, opponentFormations,
  });
  const phaseComplete = (id, phase, entries) => {
    if (!id) return true;
    const definitions = phase === "strategy" ? OPENING_STRATEGIES : OPENING_CASTLES;
    const definition = definitions.find(({ id: candidateId }) => candidateId === id);
    if (!definition) return false;
    const exact = matchesCompletionSquares(definition, currentSfen, color);
    if (exact === true) return true;
    if (exact === false && !definition?.historyCompletes) return false;
    if (definition.detectionNames.some((name) => detected.has(name))) return true;
    return entries.length > 0 && entries.every(({ usi }) => played.has(usi));
  };
  return phaseComplete(
    strategyId,
    "strategy",
    steps.filter(({ phase }) => phase === "strategy"),
  ) && phaseComplete(
    castleId,
    "castle",
    steps.filter(({ phase }) => phase === "castle"),
  );
}

export function openingFollowupCount(random = Math.random) {
  const value = Number(random());
  const normalized = Number.isFinite(value) ? Math.max(0, Math.min(0.999999, value)) : 0;
  return 3 + Math.floor(normalized * 3);
}

/** 相手の定跡進行に対し、形作りより先に必要となる応手を返す。 */
export function openingUrgentResponse({
  strategyId,
  color = "black",
  moveHistory = [],
  legalMoves = [],
}) {
  if (strategyId !== "aigakari") return null;
  const played = new Set(moveHistory);
  const legal = new Set(legalMoves);
  const lastMove = moveHistory.at(-1);
  if (
    color === "black"
    && lastMove === "8d8e"
    && played.has("2g2f") && played.has("2f2e")
    && legal.has("6i7h")
  ) {
    return {
      usi: "6i7h",
      reason: "相手が8五歩まで伸ばしたから、先に7八金で角頭を守ろう！",
    };
  }
  if (
    color === "white"
    && lastMove === "2f2e"
    && played.has("8c8d")
    && legal.has("4a3b")
  ) {
    return {
      usi: "4a3b",
      reason: "相手が2五歩まで伸ばしたから、先に3二金で角頭を守ろう！",
    };
  }
  return null;
}

function comparableOpeningScore(score) {
  if (score?.type === "cp" && Number.isFinite(score.value)) return score.value;
  if (score?.type === "mate" && Number.isFinite(score.value)) {
    if (score.value > 0) return 100000 - score.value;
    if (score.value < 0) return -100000 + Math.abs(score.value);
  }
  return undefined;
}

/** 固定手順がAI上位候補から外れる、または大きく評価を落とす場合は安全な手へ差し替える。 */
export function chooseSafeOpeningMove(plannedMove, candidates = [], maxScoreLoss = 250) {
  const ranked = [...candidates]
    .filter(({ rank, move }) => Number.isInteger(rank) && rank >= 1 && typeof move === "string")
    .sort((left, right) => left.rank - right.rank);
  const best = ranked.find(({ rank }) => rank === 1);
  if (!plannedMove || !best?.move) return plannedMove
    ? { usi: plannedMove, source: "plan", scoreLoss: 0 }
    : null;
  const planned = ranked.find(({ move }) => move === plannedMove);
  if (!planned) return { usi: best.move, source: "ai", scoreLoss: undefined };
  const bestScore = comparableOpeningScore(best.score);
  const plannedScore = comparableOpeningScore(planned.score);
  if (bestScore === undefined || plannedScore === undefined) {
    return { usi: plannedMove, source: "plan", scoreLoss: 0 };
  }
  const scoreLoss = bestScore - plannedScore;
  return scoreLoss >= maxScoreLoss
    ? { usi: best.move, source: "ai", scoreLoss }
    : { usi: plannedMove, source: "plan", scoreLoss };
}

/** 前提条件を満たす複数の予定手から評価値の良い手を選び、危険ならAI最善手へ退避する。 */
export function chooseAdaptiveOpeningMove(plannedMoves = [], candidates = [], maxScoreLoss = 250) {
  const plans = plannedMoves.map((entry) => typeof entry === "string" ? entry : entry?.usi).filter(Boolean);
  if (!plans.length) return chooseSafeOpeningMove(null, candidates, maxScoreLoss);
  const ranked = [...candidates]
    .filter(({ rank, move }) => Number.isInteger(rank) && rank >= 1 && typeof move === "string")
    .sort((left, right) => left.rank - right.rank);
  const availablePlans = plans
    .map((move, order) => ({ move, order, candidate: ranked.find((entry) => entry.move === move) }))
    .filter(({ candidate }) => candidate);
  if (!availablePlans.length) return chooseSafeOpeningMove(plans[0], candidates, maxScoreLoss);
  const scoredPlans = availablePlans
    .map((entry) => ({ ...entry, value: comparableOpeningScore(entry.candidate.score) }))
    .filter(({ value }) => value !== undefined)
    .sort((left, right) => right.value - left.value || left.order - right.order);
  const selectedPlan = scoredPlans[0] ?? availablePlans[0];
  return chooseSafeOpeningMove(selectedPlan.move, candidates, maxScoreLoss);
}

/** 残りの駒組みを不可能にする「安全な寄り道」を候補から外す。 */
export function filterOpeningCompatibleCandidates({
  strategyId,
  color = "black",
  playedMoves = [],
  plannedMoves = [],
  candidates = [],
}) {
  const definition = OPENING_STRATEGIES.find(({ id }) => id === strategyId);
  if (!definition?.planReservations?.length) return candidates;
  const convert = color === "white" ? mirrorUsiMove : (move) => move;
  const played = new Set(playedMoves);
  const planned = new Set(plannedMoves.map((entry) => typeof entry === "string" ? entry : entry?.usi));
  const activeReservations = definition.planReservations
    .map(({ until, squares, fromSquares = [] }) => ({
      until: convert(until),
      squares: new Set(squares.map((square) => color === "white" ? mirrorUsiMove(square) : square)),
      fromSquares: new Set(fromSquares.map(
        (square) => color === "white" ? mirrorUsiMove(square) : square,
      )),
    }))
    .filter(({ until }) => !played.has(until));
  if (!activeReservations.length) return candidates;
  return candidates
    .filter(({ move }) => {
      if (planned.has(move)) return true;
      const normalizedMove = typeof move === "string" ? move.replace("+", "") : "";
      const origin = normalizedMove.slice(0, 2);
      const destination = normalizedMove.slice(-2);
      return !activeReservations.some(({ squares, fromSquares }) => (
        squares.has(destination) || fromSquares.has(origin)
      ));
    })
    .sort((left, right) => left.rank - right.rank)
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));
}

/** 戦法固有の予定手をどこまで評価値より優先するか。 */
export function openingGuideScoreLossLimit(strategyId, phase = "strategy") {
  // やばボーズ流は角交換・4三銀・4二飛の骨格を作ること自体が練習目的。
  // 駒損級の悪化は避けつつ、通常より広い評価値差まで定跡手を維持する。
  if (strategyId === "yababozu" && phase === "strategy") return 600;
  return 250;
}
