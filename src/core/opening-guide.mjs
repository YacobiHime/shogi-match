export const OPENING_STRATEGIES = [
  {
    id: "ibisha",
    label: "居飛車",
    family: "ibisha",
    // 「居飛車」は戦法ではなく大きな方針なので、プレイヤー向け候補には表示しない。
    // CPUや奇襲不成立時の内部フォールバックとしてID自体は維持する。
    guideSelectable: false,
    detectionNames: [],
    blackMoves: ["2g2f", "2f2e"],
  },
  {
    id: "aigakari",
    label: "相掛かり",
    family: "aigakari",
    guideSelectable: false,
    detectionNames: ["相掛かり", "AlphaZero流相掛かり"],
    blackMoves: ["2g2f", "2f2e"],
  },
  {
    id: "yokofudori",
    label: "横歩取り",
    family: "yokofudori",
    guideSelectable: false,
    detectionNames: ["横歩取り"],
    strictOrder: true,
    historyCompletes: true,
    // 横歩を取って3四へ回った飛車と、3六歩を基準に盤面からも判定する。
    completionSquares: [["3d", "R"], ["3f", "P"]],
    blackMoves: ["7g7f", "2g2f", "2f2e", "6i7h", "2e2d", "2h2d", "8g8f", "2d3d"],
  },
  {
    id: "hineribisha",
    label: "ひねり飛車",
    family: "aigakari",
    detectionNames: ["ひねり飛車"],
    strictOrder: true,
    historyCompletes: true,
    completionSquares: [["3f", "R"], ["7g", "N"], ["7h", "G"]],
    blackMoves: [
      "2g2f", "2f2e", "6i7h", "2e2d", "2h2d", "8g8f", "2d2f", "2f3f",
      "7g7f", "8i7g",
    ],
  },
  {
    id: "aigakari-bougin",
    label: "相掛かり棒銀",
    family: "aigakari",
    detectionNames: ["相掛かり棒銀", "棒銀"],
    strictOrder: true,
    historyCompletes: true,
    completionSquares: [["2f", "S"]],
    completionRequiredMoves: ["2g2f", "2f2e", "6i7h"],
    blackMoves: ["2g2f", "2f2e", "6i7h", "3i3h", "3h2g", "2g2f"],
  },
  {
    id: "aigakari-hayaguri-gin",
    label: "相掛かり早繰り銀",
    family: "aigakari",
    detectionNames: ["相掛かり早繰り銀", "早繰り銀"],
    strictOrder: true,
    historyCompletes: true,
    completionSquares: [["4f", "S"]],
    completionRequiredMoves: ["2g2f", "2f2e", "6i7h"],
    blackMoves: ["2g2f", "2f2e", "6i7h", "3g3f", "3i4h", "4h3g", "3g4f"],
  },
  {
    id: "aigakari-koshikake-gin",
    label: "相掛かり腰掛け銀",
    family: "aigakari",
    detectionNames: ["相掛かり腰掛け銀", "腰掛け銀"],
    strictOrder: true,
    historyCompletes: true,
    completionSquares: [["5f", "S"]],
    completionRequiredMoves: ["2g2f", "2f2e", "6i7h"],
    blackMoves: ["2g2f", "2f2e", "6i7h", "4g4f", "3i4h", "4h4g", "4g5f"],
  },
  {
    id: "gangi-strategy",
    label: "雁木戦法",
    family: "gangi",
    guideSelectable: false,
    detectionNames: ["雁木"],
    strictOrder: true,
    completionSquares: [
      ["6g", "S"], ["7h", "G"], ["5h", "G"], ["6i", "K"],
    ],
    blackMoves: ["7g7f", "6g6f", "7i6h", "6h6g", "6i7h", "4i5h", "5i6i"],
  },
  {
    id: "kakugawari",
    label: "角換わり",
    family: "kakugawari",
    guideSelectable: false,
    detectionNames: ["角換わり", "一手損角換わり"],
    blackMoves: ["7g7f", "2g2f", "2f2e", "8h2b+"],
  },
  {
    id: "kakugawari-bougin",
    label: "角換わり棒銀",
    family: "kakugawari",
    detectionNames: ["角換わり棒銀"],
    strictOrder: true,
    historyCompletes: true,
    completionSquares: [["2f", "S"]],
    completionRequiredMoves: ["8h2b+", "7i8h"],
    blackMoves: ["7g7f", "2g2f", "2f2e", "8h2b+", "7i8h", "3i3h", "3h2g", "2g2f"],
  },
  {
    id: "kakugawari-hayaguri-gin",
    label: "角換わり早繰り銀",
    family: "kakugawari",
    detectionNames: ["角換わり早繰り銀"],
    strictOrder: true,
    historyCompletes: true,
    completionSquares: [["4f", "S"]],
    completionRequiredMoves: ["8h2b+", "7i8h"],
    blackMoves: ["7g7f", "2g2f", "2f2e", "8h2b+", "7i8h", "3g3f", "3i4h", "4h3g", "3g4f"],
  },
  {
    id: "kakugawari-koshikake-gin",
    label: "角換わり腰掛け銀",
    family: "kakugawari",
    detectionNames: ["角換わり腰掛け銀"],
    strictOrder: true,
    historyCompletes: true,
    completionSquares: [["5f", "S"]],
    completionRequiredMoves: ["8h2b+", "7i8h"],
    blackMoves: ["7g7f", "2g2f", "2f2e", "8h2b+", "7i8h", "4g4f", "3i4h", "4h4g", "4g5f"],
  },
  {
    id: "yagura-strategy",
    label: "矢倉戦法",
    family: "yagura",
    guideSelectable: false,
    detectionNames: ["矢倉", "金矢倉"],
    blackMoves: ["7g7f", "6g6f", "7i6h", "6h7g"],
  },
  {
    id: "yagura-bougin",
    label: "矢倉棒銀",
    family: "yagura",
    detectionNames: ["矢倉棒銀"],
    strictOrder: true,
    historyCompletes: true,
    completionSquares: [["7g", "S"], ["2f", "S"]],
    completionRequiredMoves: ["6h7g"],
    blackMoves: [
      "7g7f", "6g6f", "7i6h", "6h7g", "2g2f", "2f2e", "3i3h", "3h2g", "2g2f",
    ],
  },
  {
    id: "yagura-hayaguri-gin",
    label: "急戦矢倉早繰り銀",
    family: "yagura",
    detectionNames: ["急戦矢倉早繰り銀", "矢倉早繰り銀"],
    strictOrder: true,
    historyCompletes: true,
    completionSquares: [["7g", "S"], ["4f", "S"]],
    completionRequiredMoves: ["6h7g"],
    blackMoves: [
      "7g7f", "6g6f", "7i6h", "6h7g", "3g3f", "3i4h", "4h3g", "3g4f",
    ],
  },
  {
    id: "yagura-koshikake-gin",
    label: "矢倉腰掛け銀",
    family: "yagura",
    detectionNames: ["矢倉腰掛け銀"],
    strictOrder: true,
    historyCompletes: true,
    completionSquares: [["7g", "S"], ["5f", "S"]],
    completionRequiredMoves: ["6h7g"],
    blackMoves: [
      "7g7f", "6g6f", "7i6h", "6h7g", "4g4f", "3i4h", "4h4g", "4g5f",
    ],
  },
  {
    id: "suzume-zashi",
    label: "雀刺し",
    family: "yagura",
    detectionNames: ["雀刺し"],
    strictOrder: true,
    historyCompletes: true,
    completionSquares: [["7g", "S"], ["1g", "L"], ["1h", "R"]],
    blackMoves: [
      "7g7f", "6g6f", "7i6h", "6h7g", "1g1f", "1f1e", "1i1g", "2h1h",
    ],
  },
  {
    id: "yagura-37-silver",
    label: "矢倉3七銀",
    family: "yagura",
    detectionNames: ["矢倉3七銀", "矢倉３七銀"],
    strictOrder: true,
    historyCompletes: true,
    completionSquares: [["7g", "S"], ["3g", "S"]],
    blackMoves: ["7g7f", "6g6f", "7i6h", "6h7g", "3g3f", "3i4h", "4h3g"],
  },
  {
    id: "morishita-system",
    label: "森下システム",
    family: "yagura",
    detectionNames: ["森下システム"],
    strictOrder: true,
    historyCompletes: true,
    completionSquares: [["7g", "S"], ["3g", "S"], ["6i", "K"], ["7h", "G"]],
    blackMoves: [
      "7g7f", "6g6f", "7i6h", "6h7g", "3g3f", "3i4h", "4h3g",
      "4g4f", "6i7h", "5i6i",
    ],
  },
  {
    id: "kakugawari-45-knight",
    label: "角換わり4五桂速攻",
    family: "kakugawari",
    detectionNames: ["角換わり4五桂速攻", "角換わり４五桂速攻"],
    strictOrder: true,
    historyCompletes: true,
    completionSquares: [["4e", "N"]],
    completionRequiredMoves: ["8h2b+", "7i8h"],
    blackMoves: [
      "7g7f", "2g2f", "2f2e", "8h2b+", "7i8h",
      "4g4f", "3g3f", "2i3g", "3g4e",
    ],
  },
  {
    id: "aono-ryu",
    label: "横歩取り青野流",
    family: "yokofudori",
    detectionNames: ["横歩取り青野流", "青野流"],
    strictOrder: true,
    historyCompletes: true,
    completionSquares: [["3d", "R"], ["3f", "P"]],
    blackMoves: [
      "7g7f", "2g2f", "2f2e", "6i7h", "2e2d", "2h2d", "8g8f", "2d3d",
      "3g3f", "8i7g",
    ],
  },
  {
    id: "gangi-right-shiken",
    label: "雁木右四間",
    family: "gangi",
    detectionNames: ["雁木右四間", "右四間飛車"],
    strictOrder: true,
    historyCompletes: true,
    completionSquares: [["6g", "S"], ["5g", "S"], ["4h", "R"]],
    blackMoves: [
      "7g7f", "6g6f", "7i6h", "6h6g", "5g5f", "4g4f", "3i4h", "4h5g", "2h4h",
    ],
  },
  {
    id: "shiken",
    label: "ノーマル四間飛車",
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
    label: "ノーマル三間飛車",
    family: "sangen",
    detectionNames: ["三間飛車", "ノーマル三間飛車"],
    blackMoves: ["7g7f", "6g6f", "2h7h"],
  },
  {
    id: "nakabisha",
    label: "原始中飛車",
    family: "nakabisha",
    detectionNames: ["中飛車", "ゴキゲン中飛車"],
    strictOrder: true,
    historyCompletes: true,
    completionSquares: [["5h", "R"], ["5e", "P"], ["5g", "S"]],
    blackMoves: ["5g5f", "2h5h", "5f5e", "7i6h", "6h5g"],
  },
  {
    id: "gokigen",
    label: "ゴキゲン中飛車",
    family: "nakabisha",
    detectionNames: ["ゴキゲン中飛車"],
    strictOrder: true,
    adaptiveOrder: true,
    historyCompletes: true,
    completionVariants: [
      [["5h", "R"], ["5e", "P"], ["5g", "S"], ["3h", "K"]],
      [["5h", "R"], ["5e", "P"], ["6f", "S"], ["3h", "K"]],
      [["8h", "R"], ["7g", "S"], ["3h", "K"]],
      [["5h", "R"], ["2h", "K"], ["3h", "S"]],
    ],
    blackMoves: [
      "7g7f", "5g5f", "2h5h", "5f5e", "7i6h", "6h5g", "5i4h", "4h3h",
    ],
    planVariants: {
      superSpeedSilver: [
        "7g7f", "5g5f", "2h5h", "5f5e", "7i6h", "6h5g", "5g6f", "5i4h", "4h3h",
      ],
      maruyamaVaccine: [
        "7g7f", "5g5f", "2h5h", "7i8h", "8h7g", "5h8h", "5i4h", "4h3h",
      ],
      avoidUltraRapid: [
        "7g7f", "5g5f", "2h5h", "5i4h", "4h3h", "3h2h", "3i3h",
      ],
    },
    movePrerequisites: {
      "5g5f": ["7g7f"],
      "2h5h": ["5g5f"],
      "5f5e": ["2h5h"],
      "7i6h": ["2h5h"],
      "6h5g": ["7i6h"],
      "5i4h": ["2h5h"],
      "4h3h": ["5i4h"],
    },
    movePrerequisitesByVariant: {
      superSpeedSilver: {
        "5g6f": ["6h5g"],
        "5i4h": ["5g6f"],
      },
      maruyamaVaccine: {
        "7i8h": ["2h5h"],
        "8h7g": ["7i8h"],
        "5h8h": ["8h7g"],
        "5i4h": ["5h8h"],
      },
      avoidUltraRapid: {
        "5i4h": ["2h5h"],
        "4h3h": ["5i4h"],
        "3h2h": ["4h3h"],
        "3i3h": ["3h2h"],
      },
    },
    planReservations: [
      {
        until: "2h5h",
        squares: ["3h", "4h", "5h"],
        fromSquares: ["2h"],
      },
    ],
  },
  {
    id: "mukai",
    label: "ノーマル向かい飛車",
    family: "mukai",
    detectionNames: ["向かい飛車", "ダイレクト向かい飛車"],
    blackMoves: ["7g7f", "8h7g", "2h8h"],
  },
  {
    id: "ishida",
    label: "早石田",
    family: "sangen",
    detectionNames: ["石田流", "早石田"],
    blackMoves: ["7g7f", "7f7e", "2h7h", "7h7f"],
  },
  {
    id: "bougin",
    label: "原始棒銀",
    // 相掛かり・角換わり・矢倉・対振り飛車などで使われる戦型横断の作戦。
    family: "ibisha",
    detectionNames: ["棒銀"],
    // 2七銀はまだ途中。盤面検出が「棒銀」を返しても、2六銀までは定跡手として案内する。
    completionSquares: [["2f", "S"]],
    // 最初の2六歩と同じUSIになるため、現在の駒種を見て最後の2六銀を区別する。
    completionAdvance: { from: "2g", kind: "S", move: "2g2f" },
    // 2六銀から攻撃へ出た後も、2六歩・2六銀の2回を指した履歴で完成状態を保つ。
    completionMoveCounts: { "2g2f": 2 },
    blackMoves: ["2g2f", "2f2e", "3i3h", "3h2g", "2g2f"],
  },
  {
    id: "right-shiken",
    label: "右四間飛車",
    family: "anti-ranging",
    detectionNames: ["右四間飛車"],
    strictOrder: true,
    historyCompletes: true,
    completionSquares: [["4h", "R"], ["5f", "S"], ["4f", "P"]],
    blackMoves: ["7g7f", "4g4f", "3i4h", "4h4g", "4g5f", "2h4h"],
  },
  {
    id: "hayaguri-gin",
    label: "早繰り銀",
    family: "ibisha",
    guideSelectable: false,
    detectionNames: ["早繰り銀"],
    blackMoves: ["3g3f", "3i4h", "4h3g", "3g4f"],
  },
  {
    id: "koshikake-gin",
    label: "腰掛け銀",
    family: "ibisha",
    guideSelectable: false,
    detectionNames: ["腰掛け銀"],
    blackMoves: ["4g4f", "3i4h", "4h4g", "4g5f"],
  },
  {
    id: "sodebisha",
    label: "袖飛車",
    family: "anti-ranging",
    detectionNames: ["袖飛車"],
    strictOrder: true,
    completionSquares: [["3h", "R"], ["3f", "P"]],
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
    family: "nakabisha",
    detectionNames: ["端角中飛車"],
    strictOrder: true,
    historyCompletes: true,
    completionSquares: [["9g", "B"], ["5h", "R"], ["5g", "S"]],
    blackMoves: ["9g9f", "8h9g", "5g5f", "2h5h", "7i6h", "6h5g"],
    planReservations: [
      { until: "8h9g", squares: ["9g"], fromSquares: ["8h"] },
      { until: "2h5h", squares: ["5h"], fromSquares: ["2h"] },
      { until: "6h5g", squares: ["6h", "5g"], fromSquares: ["7i", "6h"] },
    ],
  },
  {
    id: "shin-onigoroshi",
    label: "新鬼殺し",
    family: "sangen",
    detectionNames: ["新鬼殺し"],
    strictOrder: true,
    availability: { colors: ["black"] },
    blackMoves: ["7g7f", "7f7e", "2h7h", "7h7f", "8i7g", "7i6h"],
  },
  {
    id: "first-78-rook",
    label: "7八飛戦法",
    family: "sangen",
    detectionNames: ["7八飛戦法"],
    strictOrder: true,
    availability: { colors: ["black"], maxHistoryLength: 0 },
    blackMoves: ["2h7h", "7g7f", "7f7e", "7h7f"],
  },
  {
    id: "second-32-rook",
    label: "2手目3二飛戦法",
    family: "sangen",
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
    family: "anti-ranging",
    detectionNames: ["鳥刺し"],
    strictOrder: true,
    completionSquares: [["7i", "B"], ["4f", "S"]],
    blackMoves: ["5g5f", "7i6h", "6h5g", "8h7i", "5g4f"],
  },
  {
    id: "ahiru",
    label: "アヒル囲い",
    family: "special",
    detectionNames: ["アヒル囲い", "アヒル戦法"],
    strictOrder: true,
    historyCompletes: true,
    completionSquares: [
      ["5h", "K"], ["3i", "G"], ["7i", "G"], ["2f", "R"],
      ["4h", "S"], ["6h", "S"], ["9g", "B"],
    ],
    blackMoves: [
      "2g2f", "2f2e", "3i4h", "9g9f", "2h2f", "7i6h",
      "6i7i", "8h9g", "4i3i", "5i5h", "1g1f",
    ],
    planVariants: {
      bishopHeadAttack: ["2g2f", "2f2e", "3i4h", "2h2f", "2f3f"],
    },
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
    strictOrder: true,
    completionSquares: [["5g", "S"]],
    blackMoves: ["7i6h", "5g5f", "6h5g"],
  },
];

const OPENING_CASTLE_DEFINITIONS = [
  {
    id: "half-mino",
    label: "片美濃",
    detectionNames: ["片美濃"],
    strictOrder: true,
    completionSquares: [["2h", "K"], ["3h", "S"], ["4i", "G"]],
    blackMoves: ["5i4h", "4h3h", "3h2h", "3i3h"],
  },
  {
    id: "mino",
    label: "本美濃",
    detectionNames: ["美濃囲い", "本美濃", "高美濃囲い", "銀冠"],
    completionSquares: [["2h", "K"], ["3h", "S"], ["5h", "G"]],
    blackMoves: ["2h6h", "5i4h", "4h3h", "3h2h", "3i3h", "6i5h"],
  },
  {
    id: "high-mino",
    label: "高美濃",
    detectionNames: ["高美濃", "高美濃囲い"],
    completionSquares: [["2h", "K"], ["3h", "S"], ["4g", "G"], ["4i", "G"]],
    blackMoves: ["2h6h", "5i4h", "4h3h", "3h2h", "3i3h", "6i5h", "4g4f", "5h4g"],
  },
  {
    id: "diamond-mino",
    label: "ダイヤモンド美濃",
    detectionNames: ["ダイヤモンド美濃"],
    strictOrder: true,
    completionSquares: [
      ["2h", "K"], ["3h", "S"], ["4g", "S"], ["4i", "G"], ["5h", "G"],
    ],
    blackMoves: [
      "5g5f", "5f5e", "4g4f", "7i7h", "7h6g", "6g5f", "5f4g",
      "2h6h", "5i4h", "4h3h", "3h2h", "3i3h", "6i5h",
    ],
  },
  {
    id: "renmei-mino",
    label: "連盟美濃",
    detectionNames: ["連盟美濃"],
    strictOrder: true,
    completionSquares: [["2h", "K"], ["3i", "S"], ["4h", "G"], ["5i", "G"]],
    blackMoves: ["7g7f", "6g6f", "2h6h", "5i4h", "4h3h", "3h2h", "4i4h", "6i5i"],
  },
  {
    id: "silver-crown",
    label: "振り飛車銀冠",
    detectionNames: ["銀冠", "端玉銀冠"],
    completionSquares: [["2h", "K"], ["2g", "S"], ["3h", "G"], ["4g", "G"]],
    blackMoves: ["2h6h", "5i4h", "4h3h", "3h2h", "3i3h", "6i5h", "4g4f", "5h4g", "2g2f", "3h2g", "4i3h"],
  },
  {
    id: "furibisha-anaguma",
    label: "振り飛車穴熊",
    detectionNames: ["振り飛車穴熊", "四枚穴熊", "銀冠穴熊"],
    strictOrder: true,
    completionSquares: [["1i", "K"], ["2h", "S"], ["3i", "G"], ["3h", "G"]],
    blackMoves: [
      "5i4h", "4h3h", "3h2h", "1i1h", "2h1i", "3i2h",
      "4i3i", "6i5h", "5h4h", "4h3h",
    ],
  },
  {
    id: "furibisha-elmo",
    label: "振り飛車エルモ",
    detectionNames: ["振り飛車エルモ"],
    strictOrder: true,
    completionSquares: [["3h", "K"], ["4h", "S"], ["3i", "G"]],
    blackMoves: ["5i4h", "4h3h", "3i4h", "4i3i"],
  },
  {
    id: "funagakoi",
    label: "舟囲い",
    detectionNames: ["舟囲い", "箱入り娘"],
    completionSquares: [["7h", "K"], ["5h", "G"], ["7i", "S"], ["8h", "B"]],
    blackMoves: ["5i6h", "6h7h", "4i5h"],
  },
  {
    id: "hakoiri-musume",
    label: "箱入り娘",
    detectionNames: ["箱入り娘"],
    strictOrder: true,
    completionSquares: [["7h", "K"], ["6h", "G"], ["6i", "G"], ["8h", "B"]],
    blackMoves: ["5i6h", "6h7h", "4i5h", "5h6h"],
  },
  {
    id: "early-castle",
    label: "早囲い",
    detectionNames: ["早囲い"],
    strictOrder: true,
    completionSquares: [
      ["8h", "K"], ["7g", "S"], ["7h", "G"], ["6g", "G"], ["7i", "B"],
    ],
    blackMoves: [
      "7g7f", "7i6h", "6h7g", "4i5h", "6g6f", "5h6g",
      "8h7i", "5i6h", "6h7h", "7h8h", "6i7h",
    ],
  },
  {
    id: "yagura",
    label: "金矢倉",
    detectionNames: ["矢倉", "金矢倉", "銀矢倉", "総矢倉"],
    strictOrder: true,
    completionSquares: [["8h", "K"], ["7g", "S"], ["7h", "G"], ["6g", "G"]],
    blackMoves: [
      "7g7f", "6g6f", "7i6h", "6h7g", "8h7i",
      "4i5h", "5h6g", "5i6h", "6h7h", "7h8h", "6i7h",
    ],
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
    strictOrder: true,
    completionSquares: [["7h", "K"], ["6h", "S"], ["7i", "G"], ["5i", "G"]],
    blackMoves: ["5i6h", "6h7h", "7i6h", "6i7i", "4i5i"],
  },
  {
    id: "gangi",
    label: "雁木",
    detectionNames: ["雁木"],
    strictOrder: true,
    completionSquares: [
      ["6i", "K"], ["7h", "G"], ["5h", "G"], ["6g", "S"], ["5g", "S"],
    ],
    blackMoves: [
      "7g7f", "6g6f", "7i6h", "6h6g", "6i7h", "4i5h",
      "5i6i", "3i4h", "5g5f", "4h5g",
    ],
  },
  {
    id: "left-mino",
    label: "左美濃",
    detectionNames: ["左美濃", "居角左美濃", "天守閣美濃"],
    strictOrder: true,
    completionSquares: [["8h", "K"], ["7h", "S"], ["6h", "G"], ["6f", "B"]],
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
    blackMoves: [
      "7g7f", "8h6f", "8i7g", "7i8h", "6i7h", "9i9h",
      "5i6i", "6i7i", "7i8i", "8i9i",
    ],
  },
  {
    id: "matsuo-anaguma",
    label: "松尾流穴熊",
    detectionNames: ["松尾流穴熊"],
    strictOrder: true,
    completionSquares: [
      ["9i", "K"], ["9h", "L"], ["8i", "N"], ["8h", "S"],
      ["7i", "S"], ["7h", "G"], ["6g", "G"],
    ],
    blackMoves: [
      "7g7f", "8h6f", "6f5e", "6g6f", "5g5f",
      "5i6h", "6h7h", "7h8h", "9i9h", "8h9i",
      "7i8h", "6i7h", "4i5h", "5h6g",
      "3i4h", "4h5g", "5g6h", "6h7i",
    ],
  },
  {
    id: "millennium",
    label: "ミレニアム",
    detectionNames: ["ミレニアム", "振り飛車ミレニアム"],
    strictOrder: true,
    completionSquares: [
      ["8i", "K"], ["8h", "S"], ["7h", "G"], ["7i", "G"], ["7g", "N"],
    ],
    blackMoves: [
      "7g7f", "3i4h", "5g5f", "4i5h", "5i6h", "6h7h",
      "8h6f", "8i7g", "7i8h", "6i7i", "7h8i", "5h6h", "6h7h",
    ],
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
      ["3h", "K"], ["2h", "S"], ["4h", "G"], ["5h", "G"],
    ],
    blackMoves: [
      "5i4h", "4h3h", "3i2h", "4i4h", "6i5h",
    ],
  },
  {
    id: "half-kinmusou",
    label: "片金無双",
    detectionNames: ["片金無双"],
    strictOrder: true,
    completionSquares: [["3h", "K"], ["2h", "S"], ["4h", "G"]],
    blackMoves: ["5i4h", "4h3h", "3i2h", "4i4h"],
  },
  {
    id: "right-yagura",
    label: "右矢倉",
    detectionNames: ["右矢倉"],
    strictOrder: true,
    completionSquares: [["2h", "K"], ["3g", "S"], ["3h", "G"], ["8h", "R"]],
    blackMoves: [
      "3g3f", "3i4h", "4h3g",
      "5i4h", "4h3h", "3h2h", "4i3h",
    ],
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
    strictOrder: true,
    completionSquares: [["5h", "K"], ["3h", "G"], ["7h", "G"], ["4h", "S"]],
    blackMoves: ["5i5h", "6i7h", "4i3h", "3i4h"],
  },
  {
    id: "nakahara",
    label: "中原囲い",
    detectionNames: ["中原囲い"],
    strictOrder: true,
    completionSquares: [["6i", "K"], ["7h", "G"], ["5i", "G"], ["4h", "S"]],
    blackMoves: ["6i7h", "3i4h", "5i6i", "4i5i"],
  },
  {
    id: "kanigakoi",
    label: "カニ囲い",
    detectionNames: ["カニ囲い"],
    strictOrder: true,
    completionSquares: [["6i", "K"], ["7h", "G"], ["6h", "S"], ["5h", "G"]],
    blackMoves: ["6i7h", "7i6h", "5i6i", "4i5h"],
  },
  {
    id: "bonanza",
    label: "ボナンザ囲い",
    detectionNames: ["ボナンザ囲い"],
    completionSquares: [["6f", "B"], ["7g", "S"], ["7h", "K"], ["6h", "G"], ["5h", "G"]],
    blackMoves: ["7g7f", "8h6f", "7i7h", "7h7g", "5i6h", "6h7h", "6i6h", "4i5h"],
  },
];

export const OPENING_CASTLE_GROUPS = [
  { id: "static-quick", label: "対抗型・居飛車側／急戦囲い" },
  { id: "static-left-mino", label: "対抗型・居飛車側／左美濃系" },
  { id: "static-anaguma", label: "対抗型・居飛車側／穴熊系" },
  { id: "aibisha-yagura", label: "相居飛車／矢倉系" },
  { id: "aibisha-gangi", label: "相居飛車／雁木系" },
  { id: "aibisha-nakazumai", label: "相居飛車／中住まい系" },
  { id: "aibisha-balance", label: "相居飛車／バランス型・その他" },
  { id: "ranging-mino", label: "振り飛車側／美濃囲い系" },
  { id: "ranging-anaguma", label: "振り飛車側／穴熊系" },
  { id: "ranging-elmo", label: "振り飛車側／エルモ系" },
  { id: "double-ranging", label: "相振り飛車／金無双・矢倉系" },
  { id: "shared-other", label: "複数戦型／その他" },
];

const CASTLE_CLASSIFICATION = {
  "half-mino": { family: "mino", contexts: ["anti-static-ranging", "double-ranging"], menuGroup: "ranging-mino" },
  mino: { family: "mino", contexts: ["anti-static-ranging", "double-ranging"], menuGroup: "ranging-mino" },
  "high-mino": { family: "mino", contexts: ["anti-static-ranging", "double-ranging"], menuGroup: "ranging-mino" },
  "diamond-mino": { family: "mino", contexts: ["anti-static-ranging", "double-ranging"], menuGroup: "ranging-mino" },
  "renmei-mino": { family: "mino", contexts: ["anti-static-ranging", "double-ranging"], menuGroup: "ranging-mino" },
  "silver-crown": { family: "mino", contexts: ["anti-static-ranging", "double-ranging"], menuGroup: "ranging-mino" },
  "furibisha-anaguma": { family: "anaguma", contexts: ["anti-static-ranging", "double-ranging"], menuGroup: "ranging-anaguma" },
  "furibisha-elmo": { family: "elmo", contexts: ["anti-static-ranging"], menuGroup: "ranging-elmo" },
  funagakoi: { family: "funagakoi", contexts: ["anti-ranging-static"], menuGroup: "static-quick" },
  "hakoiri-musume": { family: "funagakoi", contexts: ["anti-ranging-static"], menuGroup: "static-quick" },
  "early-castle": { family: "yagura", contexts: ["aibisha"], menuGroup: "aibisha-yagura" },
  elmo: { family: "elmo", contexts: ["anti-ranging-static"], menuGroup: "static-quick" },
  yagura: { family: "yagura", contexts: ["aibisha"], menuGroup: "aibisha-yagura" },
  "doi-yagura": { family: "yagura", contexts: ["aibisha"], menuGroup: "aibisha-yagura" },
  "kikusui-yagura": { family: "yagura", contexts: ["aibisha"], menuGroup: "aibisha-yagura" },
  gangi: { family: "gangi", contexts: ["aibisha"], menuGroup: "aibisha-gangi" },
  "left-mino": { family: "left-mino", contexts: ["anti-ranging-static"], menuGroup: "static-left-mino" },
  "tenshukaku-mino": { family: "left-mino", contexts: ["anti-ranging-static"], menuGroup: "static-left-mino" },
  "ibisha-anaguma": { family: "anaguma", contexts: ["anti-ranging-static"], menuGroup: "static-anaguma" },
  "matsuo-anaguma": { family: "anaguma", contexts: ["anti-ranging-static"], menuGroup: "static-anaguma" },
  millennium: { family: "millennium", contexts: ["anti-ranging-static", "anti-static-ranging"], menuGroup: "shared-other" },
  "right-king": { family: "balance", contexts: ["aibisha", "anti-ranging-static"], menuGroup: "aibisha-balance" },
  kinmusou: { family: "kinmusou", contexts: ["double-ranging"], menuGroup: "double-ranging" },
  "half-kinmusou": { family: "kinmusou", contexts: ["double-ranging"], menuGroup: "double-ranging" },
  "right-yagura": { family: "yagura", contexts: ["double-ranging"], menuGroup: "double-ranging" },
  osumi: { family: "funagakoi", contexts: ["anti-ranging-static"], menuGroup: "static-quick" },
  nakazumai: { family: "nakazumai", contexts: ["aibisha"], menuGroup: "aibisha-nakazumai" },
  nakahara: { family: "nakazumai", contexts: ["aibisha"], menuGroup: "aibisha-nakazumai" },
  kanigakoi: { family: "balance", contexts: ["aibisha"], menuGroup: "aibisha-balance" },
  bonanza: { family: "balance", contexts: ["aibisha"], menuGroup: "aibisha-balance" },
};

export const OPENING_CASTLES = OPENING_CASTLE_DEFINITIONS.map((castle) => ({
  ...castle,
  ...CASTLE_CLASSIFICATION[castle.id],
}));

const STATIC_ROOK_STRATEGIES = new Set([
  "ibisha", "aigakari", "yokofudori", "hineribisha", "gangi-strategy",
  "aigakari-bougin", "aigakari-hayaguri-gin", "aigakari-koshikake-gin",
  "kakugawari", "yagura-strategy", "suzume-zashi", "yagura-37-silver",
  "kakugawari-bougin", "kakugawari-hayaguri-gin", "kakugawari-koshikake-gin",
  "yagura-bougin", "yagura-hayaguri-gin", "yagura-koshikake-gin",
  "morishita-system", "kakugawari-45-knight", "aono-ryu", "gangi-right-shiken", "bougin",
  "right-shiken", "hayaguri-gin", "koshikake-gin", "ureshino",
  "sujichigai-kaku", "kakuto-fu", "torizashi", "ahiru", "sodebisha",
]);
const RANGING_ROOK_STRATEGIES = new Set([
  "shiken", "yababozu", "fujii-system", "sangen", "nakabisha", "gokigen",
  "mukai", "ishida", "hashikaku-nakabisha", "shin-onigoroshi",
  "first-78-rook", "second-32-rook",
]);
const STATIC_ROOK_CASTLES = new Set([
  "funagakoi", "hakoiri-musume", "early-castle", "yagura", "doi-yagura", "kikusui-yagura", "elmo",
  "gangi", "left-mino", "tenshukaku-mino", "ibisha-anaguma", "matsuo-anaguma",
  "right-king", "osumi", "nakazumai", "nakahara", "kanigakoi", "bonanza",
]);
const RANGING_ROOK_CASTLES = new Set([
  "half-mino", "mino", "high-mino", "diamond-mino", "renmei-mino", "silver-crown",
  "furibisha-anaguma", "furibisha-elmo", "kinmusou", "half-kinmusou", "right-yagura",
]);

export function openingDefinitionRookStyle(id, kind) {
  const staticIds = kind === "strategy" ? STATIC_ROOK_STRATEGIES : STATIC_ROOK_CASTLES;
  const rangingIds = kind === "strategy" ? RANGING_ROOK_STRATEGIES : RANGING_ROOK_CASTLES;
  if (staticIds.has(id)) return "static";
  if (rangingIds.has(id)) return "ranging";
  return undefined;
}

const BASIC_RANGING_ROOK_CHOICES = Object.freeze([
  { id: "shiken", label: "四間飛車（基本）" },
  { id: "sangen", label: "三間飛車" },
  { id: "nakabisha", label: "中飛車" },
  { id: "mukai", label: "向かい飛車" },
]);

/** 振り飛車専用の囲いを選んだとき、先に選ばせる基本的な振り先。 */
export function rangingRookStrategyChoices(castleId, availableStrategyIds) {
  if (openingDefinitionRookStyle(castleId, "castle") !== "ranging") return [];
  const compatibleIds = castleId === "right-yagura"
    ? new Set(["mukai"])
    : null;
  const available = Array.isArray(availableStrategyIds)
    ? new Set(availableStrategyIds)
    : null;
  return BASIC_RANGING_ROOK_CHOICES.filter(({ id }) => (
    (!compatibleIds || compatibleIds.has(id))
    && (!available || available.has(id))
  ));
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
  if (strategy.id === "gokigen") {
    const played = new Set(canonicalMovesForColor(playedMoves, color));
    const opponent = new Set(canonicalMovesForColor(
      opponentMoves,
      color === "black" ? "white" : "black",
    ));
    const vaccineLocked = played.has("5h8h");
    const superSpeedLocked = played.has("5g6f");
    const ultraAvoidanceLocked = played.has("3h2h") || played.has("3i3h");
    const opponentExchangedBishop = opponent.has("8h2b+");
    const opponentShowsUltraRapid = opponent.has("4i5h") && !played.has("5f5e");
    const opponentShowsSuperSpeed = ["3g3f", "3i3h", "3h3g", "3g4f"]
      .some((move) => opponent.has(move));
    if (vaccineLocked || opponentExchangedBishop) {
      return {
        moves: strategy.planVariants?.maruyamaVaccine ?? strategy.blackMoves,
        variant: "maruyamaVaccine",
      };
    }
    if (ultraAvoidanceLocked || opponentShowsUltraRapid) {
      return {
        moves: strategy.planVariants?.avoidUltraRapid ?? strategy.blackMoves,
        variant: "avoidUltraRapid",
      };
    }
    if (superSpeedLocked || opponentShowsSuperSpeed) {
      return {
        moves: strategy.planVariants?.superSpeedSilver ?? strategy.blackMoves,
        variant: "superSpeedSilver",
      };
    }
    return { moves: strategy.blackMoves ?? [], variant: "default" };
  }
  if (strategy.id === "ahiru") {
    const opponent = new Set(canonicalMovesForColor(
      opponentMoves,
      color === "black" ? "white" : "black",
    ));
    const played = new Set(canonicalMovesForColor(playedMoves, color));
    const attackLocked = played.has("2f3f");
    const fullCastleLocked = ["9g9f", "7i6h", "6i7i", "8h9g", "4i3i", "5i5h"]
      .some((move) => played.has(move));
    // 相手側へ正規化すると、こちらから見た3四歩・3三角は7六歩・7七角になる。
    const opponentHasBishopWall = opponent.has("7g7f") && opponent.has("8h7g");
    return attackLocked || (!fullCastleLocked && opponentHasBishopWall)
      ? { moves: strategy.planVariants?.bishopHeadAttack ?? strategy.blackMoves, variant: "bishopHeadAttack" }
      : { moves: strategy.blackMoves ?? [], variant: "default" };
  }
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
  const strategyRookMove = strategyPlan.moves.find((move) => /^2h[3-9]h$/.test(move));
  const castleMoves = (castle?.blackMoves ?? []).filter((move) => (
    !strategyRookMove || !/^2h[3-9]h$/.test(move) || move === strategyRookMove
  ));
  const strategyMoves = strategyPlan.moves.map(convert);
  const sharedWithStrategy = new Set(strategyMoves);
  return [
    // 同じ表記の手を別の駒で後から指す手順があるため、同一フェーズ内は重複を残す。
    ...strategyMoves.map((usi) => ({ usi, phase: "strategy" })),
    // 戦法と囲いの双方に含まれる序盤の一手だけは一度指せばよい。
    ...castleMoves.map(convert)
      .filter((usi) => !sharedWithStrategy.has(usi))
      .map((usi) => ({ usi, phase: "castle" })),
  ];
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

function matchesCompletionMoveCounts(definition, playedMoves, color) {
  const required = Object.entries(definition?.completionMoveCounts ?? {});
  if (!required.length) return false;
  const counts = new Map();
  for (const move of playedMoves) counts.set(move, (counts.get(move) ?? 0) + 1);
  const convert = color === "white" ? mirrorUsiMove : (move) => move;
  return required.every(([move, count]) => (counts.get(convert(move)) ?? 0) >= count);
}

function definitionDetectedComplete(definition, detected, currentSfen, color, playedMoves = []) {
  if (matchesCompletionMoveCounts(definition, playedMoves, color)) return true;
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
    if (definitionDetectedComplete(definition, detected, currentSfen, color, playedMoves)) return true;
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
  const strategy = OPENING_STRATEGIES.find(({ id }) => id === strategyId);

  if (
    strategy?.family === "kakugawari"
    && opponent.has("6g6f")
    && !own.has("8h2b+")
    && !opponent.has("8h2b+")
  ) {
    const closingMove = color === "black" ? "△4四歩" : "▲6六歩";
    return {
      fallbackStrategyId: "right-shiken",
      message: `${closingMove}で相手が角道を閉じたね。角交換ができないから角換わりはここで中断して、閉じた角道を狙いやすい右四間飛車へ切り替えよう！`,
    };
  }

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

/** 相手の対策に応じて選ばれたゴキゲン中飛車の分岐を、やこび姫の台詞にする。 */
export function openingPlanBranchMessage({
  strategyId,
  color = "black",
  playedMoves = [],
  opponentMoves = [],
} = {}) {
  if (strategyId !== "gokigen") return "";
  const strategy = OPENING_STRATEGIES.find(({ id }) => id === strategyId);
  const { variant } = openingStrategyPlan(strategy, { color, playedMoves, opponentMoves });
  if (variant === "superSpeedSilver") {
    return color === "white"
      ? "相手は超速3七銀を狙っているね。4二銀から5三銀、4四銀へ進めて銀対抗で受けよう！"
      : "相手は超速7三銀を狙っているね。6八銀から5七銀、6六銀へ進めて銀対抗で受けよう！";
  }
  if (variant === "maruyamaVaccine") {
    return "丸山ワクチンだね。同銀から銀を一つ進め、向かい飛車へ切り替えてゆっくり囲おう！";
  }
  if (variant === "avoidUltraRapid") {
    return "5八金右は超急戦の合図だよ。今回は5五歩を急がず、先に美濃囲いへ入って乱戦を避けよう。";
  }
  return "";
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
  const strategyComplete = definitionDetectedComplete(
    strategy, detected, currentSfen, color, playedMoves,
  );
  const castleComplete = definitionDetectedComplete(
    castle, detected, currentSfen, color, playedMoves,
  );
  const played = new Set(playedMoves);
  const history = new Set(moveHistory);
  const legal = new Set(legalMoves);
  const convert = color === "white" ? mirrorUsiMove : (move) => move;

  const completionAdvance = strategy?.completionAdvance;
  if (strategy && !strategyComplete && completionAdvance && currentSfen) {
    const source = convert(completionAdvance.from);
    const move = convert(completionAdvance.move);
    const piece = parseSfenBoard(currentSfen).get(source);
    if (piece?.color === color && piece.kind === completionAdvance.kind && legal.has(move)) {
      return [{ usi: move, phase: "strategy" }];
    }
  }

  const planContext = { playedMoves, opponentMoves, opponentFormations };
  const steps = openingPlanSteps(strategyId, castleId, color, planContext);
  const strategyVariant = openingStrategyPlan(strategy, { ...planContext, color }).variant;
  for (const phase of ["strategy", "castle"]) {
    const definition = phase === "strategy" ? strategy : castle;
    const complete = phase === "strategy" ? strategyComplete : castleComplete;
    if (!definition || complete) continue;
    // 同じUSIでも、駒が入れ替わって後からもう一度現れる手がある
    // （例: ミレニアムの玉7八と金7八）。履歴を集合に潰さず出現回数で消化する。
    const playedCounts = new Map();
    for (const move of playedMoves) playedCounts.set(move, (playedCounts.get(move) ?? 0) + 1);
    const pending = steps.filter((entry) => {
      if (entry.phase !== phase) return false;
      const remaining = playedCounts.get(entry.usi) ?? 0;
      if (remaining <= 0) return true;
      playedCounts.set(entry.usi, remaining - 1);
      return false;
    });
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
    const requiredMoves = (definition.completionRequiredMoves ?? []).map(
      color === "white" ? mirrorUsiMove : (move) => move,
    );
    if (!requiredMoves.every((move) => played.has(move))) return false;
    if (matchesCompletionMoveCounts(definition, playedMoves, color)) return true;
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

/** 原始棒銀の完成後、AI候補より先に飛車先の歩交換まで案内する定跡手。 */
export function openingCanonicalFollowupCandidates({
  strategyId = "",
  color = "black",
  currentSfen = "",
  legalMoves = [],
} = {}) {
  if (strategyId !== "bougin" || !currentSfen) return [];
  const convert = color === "white" ? mirrorUsiMove : (move) => move;
  const board = parseSfenBoard(currentSfen);
  const legal = new Set(legalMoves);
  const ownPiece = (square, kind) => {
    const piece = board.get(convert(square));
    return piece?.color === color && piece.kind === kind;
  };
  const opponentColor = color === "black" ? "white" : "black";
  const opponentPiece = (square, kind) => {
    const piece = board.get(convert(square));
    return piece?.color === opponentColor && piece.kind === kind;
  };
  const candidates = (moves, kind) => moves
    .map(convert)
    .filter((usi) => legal.has(usi))
    .map((usi) => ({ usi, kind }));

  // 2六銀で原始棒銀は完成。中央へ逃げず、端側の1五銀か3五銀へ出る。
  if (ownPiece("2f", "S")) {
    return candidates(["2f1e", "2f3e"], "silver-advance");
  }

  const silverAdvanced = ownPiece("1e", "S") || ownPiece("3e", "S");
  if (!silverAdvanced) return [];
  if (ownPiece("2e", "P")) {
    return candidates(["2e2d"], "pawn-exchange");
  }
  if (ownPiece("2h", "R") && opponentPiece("2d", "P")) {
    return candidates(["2h2d"], "pawn-exchange");
  }
  return [];
}

/** 戦法だけを選び、その戦法が完成した場合に限り完成後の候補手を表示する。 */
export function shouldShowOpeningFollowup({
  strategyId = "",
  castleId = "",
  planComplete = false,
  planExpired = false,
} = {}) {
  return Boolean(strategyId && !castleId && planComplete && !planExpired);
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

/**
 * 序盤補助の期限を判定する。
 *
 * 選択時点からの猶予だけでなく対局全体の手数にも上限を設ける。これにより、
 * 戦法や囲いを選んだ時点から、形作りを長時間続けないための期限を設ける。
 * 対局全体の手数では打ち切らない。途中局面からでも到達可能な囲いを選び直せるようにする。
 */
export function isOpeningGuideExpired(currentPly, startedAtPly = 0, maxPlies = 40) {
  const current = Math.max(0, Math.trunc(Number(currentPly) || 0));
  const started = Math.max(0, Math.trunc(Number(startedAtPly) || 0));
  const limit = Math.max(0, Math.trunc(Number(maxPlies) || 0));
  return current - started >= limit;
}

/** 予定手へ戻れないまま許容する「安全な寄り道」の手数。 */
// やこび姫が安全策として案内した寄り道だけで、補助が早々に終了しないようにする。
// 形作り全体には isOpeningGuideExpired の期限が別にある。
export const OPENING_GUIDE_MAX_DETOURS = 6;

export function shouldAbandonOpeningGuide(
  detourCount,
  maxDetours = OPENING_GUIDE_MAX_DETOURS,
) {
  const count = Math.max(0, Math.trunc(Number(detourCount) || 0));
  const limit = Math.max(1, Math.trunc(Number(maxDetours) || 1));
  return count >= limit;
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
    return planned.rank === 1
      ? { usi: plannedMove, source: "plan", scoreLoss: 0 }
      : { usi: best.move, source: "ai", scoreLoss: undefined };
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

/** 危険な定跡手1手と、代わりに選べるAI上位3候補を矢印用にまとめる。 */
export function openingDetourArrowCandidates(plannedMove, candidates = [], limit = 3) {
  if (typeof plannedMove !== "string" || !plannedMove) return [];
  const count = Math.max(1, Math.trunc(Number(limit) || 1));
  const aiMoves = [...candidates]
    .filter(({ rank, move }) => (
      Number.isInteger(rank) && rank >= 1 && typeof move === "string"
      && move && move !== plannedMove
    ))
    .sort((left, right) => left.rank - right.rank)
    .slice(0, count)
    .map(({ move, score }) => ({ usi: move, source: "ai", score }));
  return [
    { usi: plannedMove, source: "unsafe-plan" },
    ...aiMoves,
  ];
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
  const convert = color === "white" ? mirrorUsiMove : (move) => move;
  const played = new Set(playedMoves);
  const planned = new Set(plannedMoves.map((entry) => typeof entry === "string" ? entry : entry?.usi));
  const plannedOrigins = new Set([...planned].map((move) => move?.slice(0, 2)).filter(Boolean));
  const plannedDestinations = new Set(
    [...planned].map((move) => move?.replace("+", "").slice(-2)).filter(Boolean),
  );
  const activeReservations = (definition?.planReservations ?? [])
    .map(({ until, squares, fromSquares = [] }) => ({
      until: convert(until),
      squares: new Set(squares.map((square) => color === "white" ? mirrorUsiMove(square) : square)),
      fromSquares: new Set(fromSquares.map(
        (square) => color === "white" ? mirrorUsiMove(square) : square,
      )),
    }))
    .filter(({ until }) => !played.has(until));
  return candidates
    .filter(({ move }) => {
      if (planned.has(move)) return true;
      const normalizedMove = typeof move === "string" ? move.replace("+", "") : "";
      const origin = normalizedMove.slice(0, 2);
      const destination = normalizedMove.slice(-2);
      // 次の囲い手・戦法手に使う駒や着地点を、AIの寄り道で先に壊さない。
      if (plannedOrigins.has(origin) || plannedDestinations.has(destination)) return false;
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
  // 囲い補助では完成を優先する。ただし駒損級の悪化では従来どおり安全な寄り道へ切り替える。
  if (phase === "castle") return 500;
  return 250;
}
