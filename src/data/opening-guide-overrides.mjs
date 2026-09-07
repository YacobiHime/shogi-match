// 定跡エディターで保存した下書きから生成。
// npm run import:opening-library で再生成する。
export const OPENING_GUIDE_OVERRIDES = Object.freeze({
  "strategy:right-shiken": {
    "id": "right-shiken",
    "kind": "strategy",
    "label": "右四間飛車",
    "side": "black",
    "classification": {
      "name": "対抗型／居飛車側",
      "family": "anti-ranging",
      "rookStyle": "static",
      "menuGroup": "",
      "contexts": []
    },
    "guideMoves": [
      "7g7f",
      "2g2f",
      "3i4h",
      "4g4f",
      "4h4g",
      "4g5f",
      "2h4h"
    ],
    "completionVariants": [
      [
        [
          "4h",
          "R"
        ],
        [
          "5f",
          "S"
        ],
        [
          "4f",
          "P"
        ]
      ]
    ],
    "movePositionPrerequisites": {},
    "moveConditionBranches": {},
    "completionChoices": {
      "enabled": false,
      "prompt": "",
      "strategyIds": []
    },
    "updatedAt": "2026-09-04T13:35:54.974Z"
  },
  "strategy:hayaguri-gin": {
    "id": "hayaguri-gin",
    "kind": "strategy",
    "label": "早繰り銀",
    "side": "black",
    "classification": {
      "name": "居飛車/基本戦法",
      "family": "ibisha",
      "rookStyle": "static",
      "menuGroup": "",
      "contexts": []
    },
    "guideMoves": [
      "2g2f",
      "2f2e",
      "3i4h",
      "3g3f",
      "4h3g",
      "3g4f"
    ],
    "completionVariants": [],
    "movePositionPrerequisites": {},
    "moveConditionBranches": {},
    "completionChoices": {
      "enabled": false,
      "prompt": "",
      "strategyIds": []
    },
    "updatedAt": "2026-09-06T02:14:10.009Z"
  },
  "strategy:koshikake-gin": {
    "id": "koshikake-gin",
    "kind": "strategy",
    "label": "腰掛け銀",
    "side": "black",
    "classification": {
      "name": "居飛車/基本戦法",
      "family": "ibisha",
      "rookStyle": "static",
      "menuGroup": "",
      "contexts": []
    },
    "guideMoves": [
      "3i4h",
      "4g4f",
      "4h4g",
      "4g5f"
    ],
    "completionVariants": [],
    "movePositionPrerequisites": {},
    "moveConditionBranches": {},
    "completionChoices": {
      "enabled": false,
      "prompt": "",
      "strategyIds": []
    },
    "updatedAt": "2026-09-06T02:16:21.436Z"
  },
  "strategy:kakugawari-koshikake-gin": {
    "id": "kakugawari-koshikake-gin",
    "kind": "strategy",
    "label": "角換わり腰掛け銀▲4八金▲2九飛型",
    "side": "black",
    "classification": {
      "name": "相居飛車／角換わり",
      "family": "kakugawari",
      "rookStyle": "static",
      "menuGroup": "",
      "contexts": []
    },
    "guideMoves": [
      "@kakugawari",
      "7i8h",
      "8h7g",
      "6i7h",
      "2g2f",
      "3i4h",
      "3g3f",
      "2i3g",
      "2h2i",
      "4g4f",
      "4h4g",
      "4i4h",
      "5i6h",
      "4g5f"
    ],
    "completionVariants": [
      [
        [
          "5f",
          "S"
        ]
      ]
    ],
    "movePositionPrerequisites": {},
    "moveConditionBranches": {},
    "completionChoices": {
      "enabled": false,
      "prompt": "",
      "strategyIds": []
    },
    "updatedAt": "2026-09-06T08:43:49.416Z"
  },
  "castle:gangi": {
    "id": "gangi",
    "kind": "castle",
    "label": "雁木",
    "side": "black",
    "classification": {
      "name": "相居飛車／雁木系",
      "family": "gangi",
      "rookStyle": "static",
      "menuGroup": "aibisha-gangi",
      "contexts": [
        "aibisha"
      ]
    },
    "guideMoves": [
      "7g7f",
      "6g6f",
      "8h7g",
      "7i7h",
      "7h6g",
      "6i7h",
      "4i5h",
      "5i6i",
      "3i4h",
      "5g5f",
      "4h5g"
    ],
    "completionVariants": [
      [
        [
          "6i",
          "K"
        ],
        [
          "7h",
          "G"
        ],
        [
          "5h",
          "G"
        ],
        [
          "6g",
          "S"
        ],
        [
          "5g",
          "S"
        ]
      ]
    ],
    "movePositionPrerequisites": {},
    "moveConditionBranches": {},
    "completionChoices": {
      "enabled": false,
      "prompt": "",
      "strategyIds": []
    },
    "updatedAt": "2026-09-06T04:33:16.995Z"
  },
  "castle:ibisha-anaguma": {
    "id": "ibisha-anaguma",
    "kind": "castle",
    "label": "居飛車穴熊",
    "side": "black",
    "classification": {
      "name": "対抗型・居飛車側／穴熊系",
      "family": "anaguma",
      "rookStyle": "static",
      "menuGroup": "static-anaguma",
      "contexts": [
        "anti-ranging-static"
      ]
    },
    "guideMoves": [
      "7g7f",
      "6g6f",
      "8h7g",
      "5i6h",
      "6h7h",
      "7h8h",
      "9i9h",
      "8h9i",
      "7i8h",
      "6i7i",
      "4i5i",
      "5i6i",
      "6i7h"
    ],
    "completionVariants": [
      [
        [
          "9i",
          "K"
        ],
        [
          "9h",
          "L"
        ],
        [
          "8h",
          "S"
        ],
        [
          "7h",
          "G"
        ],
        [
          "7g",
          "N"
        ]
      ]
    ],
    "movePositionPrerequisites": {},
    "moveConditionBranches": {},
    "completionChoices": {
      "enabled": false,
      "prompt": "",
      "strategyIds": []
    },
    "updatedAt": "2026-09-06T04:39:34.252Z"
  },
  "castle:right-king": {
    "id": "right-king",
    "kind": "castle",
    "label": "右玉",
    "side": "black",
    "classification": {
      "name": "相居飛車／バランス型・その他",
      "family": "balance",
      "rookStyle": "static",
      "menuGroup": "aibisha-balance",
      "contexts": [
        "aibisha",
        "anti-ranging-static"
      ]
    },
    "guideMoves": [
      "2g2f",
      "2f2e",
      "3i4h",
      "3g3f",
      "2i3g",
      "2h2i",
      "4g4f",
      "4h4g",
      "4i4h",
      "5i4i",
      "4i3h"
    ],
    "completionVariants": [
      [
        [
          "4h",
          "K"
        ],
        [
          "7h",
          "G"
        ],
        [
          "6g",
          "S"
        ],
        [
          "4g",
          "S"
        ],
        [
          "3g",
          "N"
        ],
        [
          "2i",
          "R"
        ]
      ]
    ],
    "movePositionPrerequisites": {},
    "moveConditionBranches": {},
    "completionChoices": {
      "enabled": false,
      "prompt": "",
      "strategyIds": []
    },
    "updatedAt": "2026-09-06T04:45:17.678Z"
  },
  "castle:migigyoku-habu": {
    "id": "migigyoku-habu",
    "kind": "castle",
    "label": "羽生流右玉",
    "side": "both",
    "classification": {
      "name": "相居飛車／バランス型・その他",
      "family": "balance",
      "rookStyle": "static",
      "menuGroup": "aibisha-balance",
      "contexts": [
        "aibisha"
      ]
    },
    "guideMoves": [
      "@kakugawari",
      "7i8h",
      "8h7g",
      "6i7h",
      "3i4h",
      "3g3f",
      "2i3g",
      "2h2i",
      "4g4f",
      "4h4g",
      "4i3h",
      "5i4h"
    ],
    "completionVariants": [
      [
        [
          "4h",
          "K"
        ],
        [
          "7h",
          "G"
        ],
        [
          "7g",
          "S"
        ],
        [
          "3h",
          "G"
        ],
        [
          "4g",
          "S"
        ],
        [
          "3g",
          "N"
        ],
        [
          "2i",
          "R"
        ]
      ]
    ],
    "movePositionPrerequisites": {},
    "moveConditionBranches": {},
    "completionChoices": {
      "enabled": false,
      "prompt": "",
      "strategyIds": []
    },
    "updatedAt": "2026-09-06T08:44:04.730Z"
  },
  "strategy:bougin": {
    "id": "bougin",
    "kind": "strategy",
    "label": "原始棒銀",
    "side": "black",
    "classification": {
      "name": "居飛車/基本戦法",
      "family": "ibisha",
      "rookStyle": "static",
      "menuGroup": "",
      "contexts": []
    },
    "guideMoves": [
      "2g2f",
      "2f2e",
      "3i3h",
      "3h2g",
      "2g2f"
    ],
    "completionVariants": [
      [
        [
          "2f",
          "S"
        ]
      ]
    ],
    "movePositionPrerequisites": {},
    "moveConditionBranches": {},
    "completionChoices": {
      "enabled": false,
      "prompt": "",
      "strategyIds": []
    },
    "updatedAt": "2026-09-06T08:27:28.117Z"
  },
  "strategy:kakugawari": {
    "id": "kakugawari",
    "kind": "strategy",
    "label": "角換わり",
    "side": "black",
    "classification": {
      "name": "相居飛車／角換わり",
      "family": "kakugawari",
      "rookStyle": "static",
      "menuGroup": "",
      "contexts": []
    },
    "guideMoves": [
      "@kakugawari",
      "7i8h",
      "8h7g"
    ],
    "completionVariants": [],
    "movePositionPrerequisites": {},
    "moveConditionBranches": {},
    "completionChoices": {
      "enabled": true,
      "prompt": "角換わりができたよ。次に目指す攻め方を選んでね",
      "strategyIds": [
        "koshikake-gin",
        "bougin",
        "hayaguri-gin"
      ]
    },
    "updatedAt": "2026-09-06T08:43:43.184Z"
  },
  "strategy:aigakari": {
    "id": "aigakari",
    "kind": "strategy",
    "label": "相掛かり",
    "side": "black",
    "classification": {
      "name": "相居飛車／相掛かり",
      "family": "aigakari",
      "rookStyle": "static",
      "menuGroup": "",
      "contexts": []
    },
    "guideMoves": [
      "2g2f",
      "2f2e",
      "6i7h",
      "5i5h",
      "3i3h"
    ],
    "completionVariants": [],
    "movePositionPrerequisites": {},
    "moveConditionBranches": {},
    "completionChoices": {
      "enabled": true,
      "prompt": "相掛かりの形ができたよ。次に目指す戦法を選んでね",
      "strategyIds": [
        "yokofudori",
        "hineribisha"
      ]
    },
    "updatedAt": "2026-09-06T09:00:38.355Z"
  },
  "strategy:hineribisha": {
    "id": "hineribisha",
    "kind": "strategy",
    "label": "ひねり飛車",
    "side": "black",
    "classification": {
      "name": "相居飛車／相掛かり",
      "family": "aigakari",
      "rookStyle": "static",
      "menuGroup": "",
      "contexts": []
    },
    "guideMoves": [
      "2g2f",
      "2f2e",
      "6i7h",
      "2e2d",
      "2h2d",
      "2d2f",
      "3i3h",
      "2f3f",
      "7g7f",
      "8i7g",
      "7f7e",
      "3f7f"
    ],
    "completionVariants": [
      [
        [
          "3f",
          "R"
        ],
        [
          "7g",
          "N"
        ],
        [
          "7h",
          "G"
        ]
      ]
    ],
    "movePositionPrerequisites": {
      "2h2d": [
        {
          "alternatives": [
            {
              "square": "2d",
              "owner": "opponent",
              "kind": "P"
            }
          ]
        }
      ]
    },
    "moveConditionBranches": {},
    "completionChoices": {
      "enabled": false,
      "prompt": "",
      "strategyIds": []
    },
    "updatedAt": "2026-09-06T10:00:18.303Z"
  },
  "strategy:kakugawari-45-knight": {
    "id": "kakugawari-45-knight",
    "kind": "strategy",
    "label": "角換わり4五桂速攻",
    "side": "black",
    "classification": {
      "name": "相居飛車／角換わり",
      "family": "kakugawari",
      "rookStyle": "static",
      "menuGroup": "",
      "contexts": []
    },
    "guideMoves": [
      "@kakugawari",
      "7i8h",
      "8h7g",
      "3i4h",
      "4g4f",
      "3g3f",
      "2i3g",
      "3g4e"
    ],
    "completionVariants": [
      [
        [
          "4e",
          "N"
        ]
      ]
    ],
    "movePositionPrerequisites": {
      "3g4e": [
        {
          "alternatives": [
            {
              "square": "3c",
              "owner": "opponent",
              "kind": "S"
            }
          ]
        }
      ]
    },
    "moveConditionBranches": {},
    "completionChoices": {
      "enabled": false,
      "prompt": "",
      "strategyIds": []
    },
    "updatedAt": "2026-09-06T10:06:36.380Z"
  },
  "strategy:suzume-zashi": {
    "id": "suzume-zashi",
    "kind": "strategy",
    "label": "雀刺し",
    "side": "black",
    "classification": {
      "name": "相居飛車／矢倉",
      "family": "yagura",
      "rookStyle": "static",
      "menuGroup": "",
      "contexts": []
    },
    "guideMoves": [
      "7g7f",
      "6g6f",
      "7i7h",
      "7h7g",
      "1g1f",
      "3i4h",
      "3g3f",
      "2i3g",
      "1i1g",
      "2h1h",
      "1f1e",
      "3g2e"
    ],
    "completionVariants": [
      [
        [
          "7g",
          "S"
        ],
        [
          "1g",
          "L"
        ],
        [
          "1h",
          "R"
        ]
      ]
    ],
    "movePositionPrerequisites": {},
    "moveConditionBranches": {},
    "completionChoices": {
      "enabled": false,
      "prompt": "",
      "strategyIds": []
    },
    "updatedAt": "2026-09-06T10:10:56.808Z"
  },
  "strategy:morishita-system": {
    "id": "morishita-system",
    "kind": "strategy",
    "label": "森下システム",
    "side": "black",
    "classification": {
      "name": "相居飛車／矢倉",
      "family": "yagura",
      "rookStyle": "static",
      "menuGroup": "",
      "contexts": []
    },
    "guideMoves": [
      "7g7f",
      "6g6f",
      "7i7h",
      "7h7g",
      "4i5h",
      "6i7h",
      "5h6g",
      "8h7i",
      "3i4h",
      "3g3f",
      "5i6i",
      "7i6h",
      "2g2f",
      "2f2e"
    ],
    "completionVariants": [
      [
        [
          "7g",
          "S"
        ],
        [
          "3g",
          "S"
        ],
        [
          "6i",
          "K"
        ],
        [
          "7h",
          "G"
        ]
      ]
    ],
    "movePositionPrerequisites": {},
    "moveConditionBranches": {},
    "completionChoices": {
      "enabled": false,
      "prompt": "",
      "strategyIds": []
    },
    "updatedAt": "2026-09-06T10:20:26.081Z"
  },
  "strategy:nakabisha": {
    "id": "nakabisha",
    "kind": "strategy",
    "label": "原始中飛車",
    "side": "black",
    "classification": {
      "name": "中飛車",
      "family": "nakabisha",
      "rookStyle": "ranging",
      "menuGroup": "",
      "contexts": []
    },
    "guideMoves": [
      "5g5f",
      "2h5h",
      "6i7h",
      "5f5e",
      "7i6h",
      "6h5g",
      "5g5f"
    ],
    "completionVariants": [
      [
        [
          "5h",
          "R"
        ],
        [
          "5e",
          "P"
        ],
        [
          "5g",
          "S"
        ]
      ]
    ],
    "movePositionPrerequisites": {},
    "moveConditionBranches": {},
    "completionChoices": {
      "enabled": false,
      "prompt": "",
      "strategyIds": []
    },
    "updatedAt": "2026-09-06T10:55:46.199Z"
  },
  "strategy:fujii-system": {
    "id": "fujii-system",
    "kind": "strategy",
    "label": "藤井システム",
    "side": "black",
    "classification": {
      "name": "四間飛車",
      "family": "shiken",
      "rookStyle": "ranging",
      "menuGroup": "",
      "contexts": []
    },
    "guideMoves": [
      "7g7f",
      "6g6f",
      "2h6h",
      "1g1f",
      "8h7g",
      "3i3h",
      "6i5h",
      "7i7h",
      "4g4f"
    ],
    "completionVariants": [],
    "movePositionPrerequisites": {},
    "moveConditionBranches": {},
    "completionChoices": {
      "enabled": false,
      "prompt": "",
      "strategyIds": []
    },
    "updatedAt": "2026-09-06T11:07:06.949Z"
  },
  "strategy:onigoroshi": {
    "id": "onigoroshi",
    "kind": "strategy",
    "label": "原始鬼殺し",
    "side": "black",
    "classification": {
      "name": "奇襲・特殊戦法",
      "family": "special",
      "rookStyle": "both",
      "menuGroup": "",
      "contexts": []
    },
    "guideMoves": [
      "7g7f",
      "8i7g",
      "8h2b+",
      "7g6e",
      "B*5e"
    ],
    "completionVariants": [],
    "movePositionPrerequisites": {
      "8h2b+": [
        {
          "alternatives": [
            {
              "square": "3d",
              "owner": "opponent",
              "kind": "B"
            }
          ]
        }
      ],
      "B*5e": [
        {
          "alternatives": [
            {
              "square": "6d",
              "owner": "opponent",
              "kind": "P"
            }
          ]
        },
        {
          "alternatives": [
            {
              "square": "6b",
              "owner": "opponent",
              "kind": "S"
            }
          ]
        },
        {
          "alternatives": [
            {
              "square": "2b",
              "owner": "opponent",
              "kind": "S"
            }
          ]
        }
      ]
    },
    "moveConditionBranches": {},
    "completionChoices": {
      "enabled": false,
      "prompt": "",
      "strategyIds": []
    },
    "updatedAt": "2026-09-06T11:32:44.575Z"
  },
  "strategy:sujichigai-kaku": {
    "id": "sujichigai-kaku",
    "kind": "strategy",
    "label": "筋違い角",
    "side": "black",
    "classification": {
      "name": "奇襲・特殊戦法",
      "family": "special",
      "rookStyle": "static",
      "menuGroup": "",
      "contexts": []
    },
    "guideMoves": [
      "@kakugawari",
      "B*4e"
    ],
    "completionVariants": [],
    "movePositionPrerequisites": {},
    "moveConditionBranches": {},
    "completionChoices": {
      "enabled": false,
      "prompt": "",
      "strategyIds": []
    },
    "updatedAt": "2026-09-06T11:36:09.491Z"
  },
  "strategy:kakuto-fu": {
    "id": "kakuto-fu",
    "kind": "strategy",
    "label": "角頭歩戦法",
    "side": "both",
    "classification": {
      "name": "奇襲・特殊戦法",
      "family": "special",
      "rookStyle": "static",
      "menuGroup": "",
      "contexts": []
    },
    "guideMoves": [
      "7g7f",
      "8g8f",
      "8h7g",
      "@kakugawari",
      "8i7g"
    ],
    "completionVariants": [],
    "movePositionPrerequisites": {},
    "moveConditionBranches": {},
    "completionChoices": {
      "enabled": false,
      "prompt": "",
      "strategyIds": []
    },
    "updatedAt": "2026-09-06T11:55:17.846Z"
  },
  "strategy:pacman": {
    "id": "pacman",
    "kind": "strategy",
    "label": "パックマン",
    "side": "white",
    "classification": {
      "name": "奇襲・特殊戦法",
      "family": "special",
      "rookStyle": "both",
      "menuGroup": "",
      "contexts": []
    },
    "guideMoves": [
      "6g6f",
      "2h6h"
    ],
    "completionVariants": [],
    "movePositionPrerequisites": {
      "6g6f": [
        {
          "alternatives": [
            {
              "square": "3d",
              "owner": "opponent",
              "kind": "P"
            }
          ]
        }
      ]
    },
    "moveConditionBranches": {},
    "completionChoices": {
      "enabled": false,
      "prompt": "",
      "strategyIds": []
    },
    "updatedAt": "2026-09-06T11:56:39.872Z"
  },
  "strategy:ureshino": {
    "id": "ureshino",
    "kind": "strategy",
    "label": "嬉野流",
    "side": "black",
    "classification": {
      "name": "奇襲・特殊戦法",
      "family": "special",
      "rookStyle": "static",
      "menuGroup": "",
      "contexts": []
    },
    "guideMoves": [
      "7i6h",
      "5g5f",
      "6h5g"
    ],
    "completionVariants": [
      [
        [
          "5g",
          "S"
        ]
      ]
    ],
    "movePositionPrerequisites": {},
    "moveConditionBranches": {},
    "completionChoices": {
      "enabled": false,
      "prompt": "",
      "strategyIds": []
    },
    "updatedAt": "2026-09-06T11:59:06.276Z"
  },
  "castle:doi-yagura": {
    "id": "doi-yagura",
    "kind": "castle",
    "label": "土居矢倉",
    "side": "black",
    "classification": {
      "name": "相居飛車／矢倉系",
      "family": "yagura",
      "rookStyle": "static",
      "menuGroup": "aibisha-yagura",
      "contexts": [
        "aibisha"
      ]
    },
    "guideMoves": [
      "7g7f",
      "6g6f",
      "7i7h",
      "7h7g",
      "4i5h",
      "5h6g",
      "6i5h",
      "5i6h",
      "6h7h",
      "8h7i",
      "5g5f"
    ],
    "completionVariants": [
      [
        [
          "7h",
          "K"
        ],
        [
          "7g",
          "S"
        ],
        [
          "6g",
          "G"
        ],
        [
          "5h",
          "G"
        ]
      ]
    ],
    "movePositionPrerequisites": {},
    "moveConditionBranches": {},
    "completionChoices": {
      "enabled": false,
      "prompt": "",
      "strategyIds": []
    },
    "updatedAt": "2026-09-06T12:03:03.520Z"
  },
  "castle:kikusui-yagura": {
    "id": "kikusui-yagura",
    "kind": "castle",
    "label": "菊水矢倉",
    "side": "black",
    "classification": {
      "name": "相居飛車／矢倉系",
      "family": "yagura",
      "rookStyle": "static",
      "menuGroup": "aibisha-yagura",
      "contexts": [
        "aibisha"
      ]
    },
    "guideMoves": [
      "7g7f",
      "6f5e",
      "6g6f",
      "7i7h",
      "7h7g",
      "6i7h",
      "4i5h",
      "5h6g",
      "5i6i",
      "8h7i",
      "5g5f",
      "7i6h",
      "6i7i",
      "7g8h",
      "8i7g",
      "7i8i"
    ],
    "completionVariants": [
      [
        [
          "8i",
          "K"
        ],
        [
          "8h",
          "S"
        ],
        [
          "7h",
          "G"
        ],
        [
          "7g",
          "N"
        ],
        [
          "6g",
          "G"
        ]
      ]
    ],
    "movePositionPrerequisites": {},
    "moveConditionBranches": {},
    "completionChoices": {
      "enabled": false,
      "prompt": "",
      "strategyIds": []
    },
    "updatedAt": "2026-09-06T12:07:53.257Z"
  },
  "castle:matsuo-anaguma": {
    "id": "matsuo-anaguma",
    "kind": "castle",
    "label": "松尾流穴熊",
    "side": "black",
    "classification": {
      "name": "対抗型・居飛車側／穴熊系",
      "family": "anaguma",
      "rookStyle": "static",
      "menuGroup": "static-anaguma",
      "contexts": [
        "anti-ranging-static"
      ]
    },
    "guideMoves": [
      "7g7f",
      "6g6f",
      "8h7g",
      "6g6f",
      "5g5f",
      "5i6h",
      "6h7h",
      "7h8h",
      "9i9h",
      "8h9i",
      "7i8h",
      "6i7h",
      "4i5h",
      "5h6g",
      "3i4h",
      "4h5g",
      "5g6h",
      "6h7i"
    ],
    "completionVariants": [
      [
        [
          "9i",
          "K"
        ],
        [
          "9h",
          "L"
        ],
        [
          "8i",
          "N"
        ],
        [
          "8h",
          "S"
        ],
        [
          "7i",
          "S"
        ],
        [
          "7h",
          "G"
        ],
        [
          "6g",
          "G"
        ]
      ]
    ],
    "movePositionPrerequisites": {},
    "moveConditionBranches": {},
    "completionChoices": {
      "enabled": false,
      "prompt": "",
      "strategyIds": []
    },
    "updatedAt": "2026-09-06T12:09:54.783Z"
  },
  "castle:millennium": {
    "id": "millennium",
    "kind": "castle",
    "label": "ミレニアム",
    "side": "black",
    "classification": {
      "name": "複数戦型／その他",
      "family": "millennium",
      "rookStyle": "both",
      "menuGroup": "shared-other",
      "contexts": [
        "anti-ranging-static",
        "anti-static-ranging"
      ]
    },
    "guideMoves": [
      "7g7f",
      "3i4h",
      "5g5f",
      "4i5h",
      "5i6h",
      "6h7h",
      "8h6f",
      "8i7g",
      "7i8h",
      "7h8i",
      "6i7i",
      "5h6h",
      "6h7h",
      "4h5i",
      "5i6h",
      "6f5g"
    ],
    "completionVariants": [
      [
        [
          "8i",
          "K"
        ],
        [
          "8h",
          "S"
        ],
        [
          "7h",
          "G"
        ],
        [
          "7i",
          "G"
        ],
        [
          "7g",
          "N"
        ]
      ]
    ],
    "movePositionPrerequisites": {},
    "moveConditionBranches": {},
    "completionChoices": {
      "enabled": false,
      "prompt": "",
      "strategyIds": []
    },
    "updatedAt": "2026-09-06T12:13:52.737Z"
  },
  "castle:tenshukaku-mino": {
    "id": "tenshukaku-mino",
    "kind": "castle",
    "label": "天守閣美濃",
    "side": "black",
    "classification": {
      "name": "対抗型・居飛車側／左美濃系",
      "family": "left-mino",
      "rookStyle": "static",
      "menuGroup": "static-left-mino",
      "contexts": [
        "anti-ranging-static"
      ]
    },
    "guideMoves": [
      "7g7f",
      "3i4h",
      "5g5f",
      "5i6h",
      "6h7h",
      "4h5g",
      "4i5h",
      "9g9f",
      "8g8f",
      "7h8g",
      "7i7h"
    ],
    "completionVariants": [
      [
        [
          "8g",
          "K"
        ],
        [
          "7h",
          "S"
        ],
        [
          "6i",
          "G"
        ]
      ]
    ],
    "movePositionPrerequisites": {},
    "moveConditionBranches": {},
    "completionChoices": {
      "enabled": false,
      "prompt": "",
      "strategyIds": []
    },
    "updatedAt": "2026-09-06T12:18:15.726Z"
  },
  "strategy:chikatetsu-bisha": {
    "id": "chikatetsu-bisha",
    "kind": "strategy",
    "label": "地下鉄飛車",
    "side": "black",
    "classification": {
      "name": "対抗型／居飛車側",
      "family": "anti-ranging",
      "rookStyle": "static",
      "menuGroup": "",
      "contexts": []
    },
    "guideMoves": [
      "7g7f",
      "8h6f",
      "7i8h",
      "8i7g",
      "6i6h",
      "5i6i",
      "6i7h",
      "4i5h",
      "5g5f",
      "9i9h",
      "3g3f",
      "2i3g",
      "3i4h",
      "2h2i",
      "2i9i"
    ],
    "completionVariants": [
      [
        [
          "9i",
          "R"
        ],
        [
          "9h",
          "L"
        ],
        [
          "6f",
          "B"
        ],
        [
          "7g",
          "N"
        ],
        [
          "8h",
          "S"
        ],
        [
          "7h",
          "K"
        ],
        [
          "3g",
          "N"
        ],
        [
          "4h",
          "S"
        ]
      ]
    ],
    "movePositionPrerequisites": {},
    "moveConditionBranches": {},
    "completionChoices": {
      "enabled": false,
      "prompt": "",
      "strategyIds": []
    },
    "updatedAt": "2026-09-06T12:19:25.011Z"
  },
  "castle:muteki": {
    "id": "muteki",
    "kind": "castle",
    "label": "無敵囲い",
    "side": "both",
    "classification": {
      "name": "複数戦型／その他",
      "family": "muteki",
      "rookStyle": "ranging",
      "menuGroup": "shared-other",
      "contexts": [
        "anti-static-ranging",
        "double-ranging"
      ]
    },
    "guideMoves": [
      "2h5h",
      "3i4h",
      "7i6h"
    ],
    "completionVariants": [
      [
        [
          "5i",
          "K"
        ],
        [
          "5h",
          "R"
        ],
        [
          "4h",
          "S"
        ],
        [
          "6h",
          "S"
        ]
      ]
    ],
    "movePositionPrerequisites": {},
    "moveConditionBranches": {},
    "completionChoices": {
      "enabled": false,
      "prompt": "",
      "strategyIds": []
    },
    "updatedAt": "2026-09-06T12:23:20.739Z"
  }
});
