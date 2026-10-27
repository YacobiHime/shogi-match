// 棋力テストの問題。scripts/build-skill-test-items.mjs で生成したもので、手で書き換えない(docs/skill-assessment-design.mdの4章)。
// いろいろなLvのCPUどうしの対局の局面から、審判のエンジンで問題になる局面を選んだ。
// acceptedは正解の手(USI)、choicesは3択の選択肢、bestは最善手、pvは答えのあとの読み筋。
// cpuBは、CPUの各Lvに解かせて半分が解けたLv(難しさの元。人に合わせた補正はskill-test.mjsのTYPE_OFFSETS)。
// 生成: seed 20261027、対局 160、審判 60000nodes、解かせたLv 1,4,7,10,13,16,19,22,25,28,31,34×2回。

export const SKILL_TEST_ITEMS = Object.freeze([
 {
  "id": "st-save-0",
  "type": "save",
  "sfen": "lnsgk1snl/6gb1/p1ppppppp/9/7P1/1r7/PpPPPPP1P/1B4RS1/LNSGKG1NL b P 1",
  "accepted": [
   "9g9f"
  ],
  "best": "9g9f",
  "pv": [
   "9g9f",
   "8g8h+",
   "3h8h",
   "8f8h+",
   "7i8h",
   "R*8e",
   "6i7h"
  ],
  "cpuB": 33
 },
 {
  "id": "st-save-1",
  "type": "save",
  "sfen": "lnsgk2nl/1r3sgb1/p2pppppp/2p6/1p2B4/2P1P2P1/PP1PSPP1P/2G4R1/LN2KGSNL w - 1",
  "accepted": [
   "8b9b"
  ],
  "best": "8b9b",
  "pv": [
   "8b9b",
   "2f2e",
   "5c5d",
   "5e7g",
   "7a6b",
   "2e2d",
   "2c2d"
  ],
  "cpuB": 20
 },
 {
  "id": "st-take-2",
  "type": "take",
  "sfen": "lnsgk2nl/1r3sgb1/p2p1pppp/2p1p4/1p2B4/2P1P2P1/PP1PSPP1P/2G4R1/LN2KGSNL b - 1",
  "accepted": [
   "5e8b+"
  ],
  "best": "5e8b+",
  "pv": [
   "5e8b+",
   "7a8b",
   "5g6f",
   "3c3d",
   "3i4h",
   "5a4a",
   "2f2e"
  ],
  "cpuB": 11
 },
 {
  "id": "st-take-3",
  "type": "take",
  "sfen": "lng1k2nl/5sgb1/pRsp1pppp/2p1p4/bp7/2P1P2P1/PPNPSPP1P/2G2S1R1/L3KG1NL b - 1",
  "accepted": [
   "8c8e+"
  ],
  "best": "8c8e+",
  "pv": [
   "8c8e+",
   "9e8d",
   "7g6e",
   "3c3d",
   "6e7c+",
   "8d7c",
   "5g6f"
  ],
  "cpuB": 10
 },
 {
  "id": "st-save-4",
  "type": "save",
  "sfen": "lng1k2nl/5sgb1/p2p1pppp/1sp1p4/b+R7/2P1P2P1/PPNPSPP1P/2G2S1R1/L3KG1NL b P 1",
  "accepted": [
   "8e6e"
  ],
  "best": "8e6e",
  "pv": [
   "8e6e",
   "3c3d",
   "5g6f",
   "7d7e",
   "9g9f",
   "7e7f",
   "9f9e"
  ],
  "cpuB": 48
 },
 {
  "id": "st-tactic-5",
  "type": "tactic",
  "sfen": "lng1k2nl/3s2gb1/p4pppp/1sppp4/b6+R1/2PSP2P1/PPNP1PP1P/2GK1S1R1/L4G1NL b P 1",
  "accepted": [
   "9g9f"
  ],
  "best": "9g9f",
  "pv": [
   "9g9f",
   "9e7g+",
   "6f7g",
   "8a7c",
   "6h5h",
   "7c6e",
   "7g6f"
  ],
  "cpuB": 16.75
 },
 {
  "id": "st-save-6",
  "type": "save",
  "sfen": "lns1ggsnl/1r3k3/pppp1p1pp/3bp1p2/5P3/1PP4P1/P2PP1PRP/1B1S1S3/LN1GKG1NL w - 1",
  "accepted": [
   "2a3c",
   "5d5e"
  ],
  "best": "2a3c",
  "pv": [
   "2a3c",
   "6i7h"
  ],
  "cpuB": 21.75
 },
 {
  "id": "st-save-7",
  "type": "save",
  "sfen": "ln2k3l/2gsr1gb1/pppp1pnpp/6ps1/9/4pP1P1/PPPPS1P1P/1B1KGG1R1/LNS4NL b p 1",
  "accepted": [
   "5g6f",
   "7g7f"
  ],
  "best": "5g6f",
  "pv": [
   "5g6f",
   "2d3e",
   "4h4g",
   "5a6a",
   "3g3f",
   "3e4d",
   "6h7h"
  ],
  "cpuB": 11
 },
 {
  "id": "st-save-8",
  "type": "save",
  "sfen": "ln1kr3l/2gs2g2/pppp1p1pp/5bp2/5n1P1/3Sp2sP/PPPP2PR1/1BK1GG3/LNS4NL b 2p 1",
  "accepted": [
   "2g2h"
  ],
  "best": "2g2h",
  "pv": [
   "2g2h",
   "4d6f",
   "6g6f",
   "5f5g+",
   "4h5g",
   "4e5g+",
   "P*5b"
  ],
  "cpuB": 2.5
 },
 {
  "id": "st-take-9",
  "type": "take",
  "sfen": "lnk1r3l/2gs2g2/pp1p1p1pp/2p2bp2/7PP/3Sp4/PPPP2n1+s/1BK1GG1R1/LNS5L b n3p 1",
  "accepted": [
   "1i1g"
  ],
  "best": "1i1g",
  "pv": [
   "1i1g",
   "4d1g+",
   "2h3h",
   "N*4e",
   "7g7f",
   "1g3e",
   "4h3g"
  ],
  "cpuB": 6.75
 },
 {
  "id": "st-save-10",
  "type": "save",
  "sfen": "ln2k2nl/1r1sgsgb1/p1pppppPp/1p5R1/9/2P6/PP1PPPP1P/1B3S3/LNSGKG1NL w p 1",
  "accepted": [
   "2b3a"
  ],
  "best": "2b3a",
  "pv": [
   "2b3a",
   "3g3f"
  ],
  "cpuB": 7
 },
 {
  "id": "st-save-11",
  "type": "save",
  "sfen": "ln2k1bnl/1s3sg2/prppp1pPp/5pgR1/9/1PP2PP2/P1BPP1N1P/2GSGS3/LN2K3L b Pp 1",
  "accepted": [
   "2d2i",
   "2d2h"
  ],
  "best": "2d2i",
  "pv": [
   "2d2i",
   "5c5d"
  ],
  "cpuB": 5.25
 },
 {
  "id": "st-take-12",
  "type": "take",
  "sfen": "lnsgkg1nl/4rs3/pppppp1pp/6p2/7P1/2P6/PP1PPPP1P/1+b1G2SR1/LNS1KG1NL b b 1",
  "accepted": [
   "7i8h"
  ],
  "best": "7i8h",
  "pv": [
   "7i8h",
   "4a3b",
   "8h7g",
   "5a6b",
   "5i6i",
   "6b7b",
   "6i7h"
  ],
  "cpuB": -0.25
 },
 {
  "id": "st-save-13",
  "type": "save",
  "sfen": "lns1kg1nl/2g4r1/ppppp1s1p/6p2/5p1p1/2P2B3/PPSPPPPSP/2G4R1/LN2KG1NL b bp 1",
  "accepted": [
   "4f5e"
  ],
  "best": "4f5e",
  "pv": [
   "4f5e",
   "5c5d",
   "5e6f",
   "6c6d",
   "7g6h",
   "5a6b",
   "2g3f"
  ],
  "cpuB": 6.25
 },
 {
  "id": "st-take-14",
  "type": "take",
  "sfen": "lns1kg1nl/2g4r1/ppppp1s1p/6p2/4bp1p1/2P1P4/PPSP1PPSP/2G4R1/LN2KG1NL b bp 1",
  "accepted": [
   "5f5e"
  ],
  "best": "5f5e",
  "pv": [
   "5f5e",
   "4e4f",
   "4g4f",
   "B*5g",
   "2g3f",
   "5g4f+",
   "3f2e"
  ],
  "cpuB": 5.5
 },
 {
  "id": "st-save-15",
  "type": "save",
  "sfen": "ln2kg2l/1r1sg1s2/p1ppppn1p/1p3bpR1/9/2PB5/PPNPPPP1P/2S6/L2GKGSNL b Pp 1",
  "accepted": [
   "6f4d"
  ],
  "best": "6f4d",
  "pv": [
   "6f4d",
   "4c4d"
  ],
  "cpuB": 21.75
 },
 {
  "id": "st-take-16",
  "type": "take",
  "sfen": "ln2kg2l/1r1sg1s2/p1ppppn1p/1p3BpR1/9/2P6/PPNPPPP1P/2S6/L2GKGSNL w BPp 1",
  "accepted": [
   "4c4d"
  ],
  "best": "4c4d",
  "pv": [
   "4c4d",
   "2d2b+",
   "B*8h",
   "2b1a",
   "8h9i+",
   "P*2b",
   "3c4e"
  ],
  "cpuB": 7.75
 },
 {
  "id": "st-save-17",
  "type": "save",
  "sfen": "ln2kgsnl/2sg3b1/p3r1ppp/1ppPpp3/3N5/2P2P1P1/PP1GPSP1P/1B1S3R1/L3KG1NL w P 1",
  "accepted": [
   "5c4c"
  ],
  "best": "5c4c",
  "pv": [
   "5c4c",
   "4g5f",
   "3c3d",
   "2f2e",
   "2b3c",
   "4f4e",
   "4d4e"
  ],
  "cpuB": 18.75
 },
 {
  "id": "st-tactic-18",
  "type": "tactic",
  "sfen": "ln3ksnl/1r1sg2b1/pppppp1gp/6p2/7p1/4P2P1/PPPP1PP1P/2GS1GSR1/LNB1K2NL w - 1",
  "accepted": [
   "2e2f"
  ],
  "best": "2e2f",
  "pv": [
   "2e2f",
   "3g3f",
   "8c8d",
   "3h3g",
   "2f2g+",
   "2h2g",
   "P*2d"
  ],
  "cpuB": 19
 },
 {
  "id": "st-save-19",
  "type": "save",
  "sfen": "lnsgk1snl/1r4g2/pppppp1pp/6p2/9/2PP5/PPSbPPPPP/2B4R1/LN1GKGSNL w - 1",
  "accepted": [
   "6g7h+"
  ],
  "best": "6g7h+",
  "pv": [
   "6g7h+",
   "6i7h",
   "7a6b",
   "5i6h",
   "6c6d",
   "3i4h",
   "3a2b"
  ],
  "cpuB": 5.75
 },
 {
  "id": "st-tactic-20",
  "type": "tactic",
  "sfen": "ln5nl/1r1sgkg2/ppppps1pp/5pp2/3P5/2PS5/PPN1PPPPP/2G1RK3/L4GSNL w Bb 1",
  "accepted": [
   "B*6i"
  ],
  "best": "B*6i",
  "pv": [
   "B*6i",
   "B*8i",
   "6i5h+",
   "4h5h",
   "1c1d",
   "3i3h"
  ],
  "cpuB": 25.5
 },
 {
  "id": "st-save-21",
  "type": "save",
  "sfen": "ln5nl/1r1sgkg2/ppppps1pp/5pp2/3P5/2PS5/PPN1PPPPP/2G1RK3/L2b1GSNL b B 1",
  "accepted": [
   "7h7i",
   "3i3h",
   "B*8i"
  ],
  "best": "7h7i",
  "pv": [
   "7h7i",
   "6i8g+",
   "5h6h",
   "8g7f",
   "7i7h",
   "8c8d",
   "7h6g"
  ],
  "cpuB": 33
 },
 {
  "id": "st-take-22",
  "type": "take",
  "sfen": "ln5nl/1r1sgkg2/ppppps1pp/5pp2/3P5/2PS5/PPN1PPPPP/2G1+bK3/L3G1SNL b Br 1",
  "accepted": [
   "4h5h"
  ],
  "best": "4h5h",
  "pv": [
   "4h5h",
   "8c8d",
   "7h7i",
   "4b3a",
   "1g1f",
   "1c1d",
   "3g3f"
  ],
  "cpuB": 9.25
 },
 {
  "id": "st-take-23",
  "type": "take",
  "sfen": "ln5nl/1r1sg1g2/pppppskpp/5pp2/3P5/2PS5/PPN1PPPPP/1B2K4/L1+r1G1SNL b Bg 1",
  "accepted": [
   "8h7i"
  ],
  "best": "8h7i",
  "pv": [
   "8h7i",
   "G*7h",
   "7i6h",
   "5c5d",
   "5h6g",
   "7h6h",
   "6g6h"
  ],
  "cpuB": 5.25
 },
 {
  "id": "st-save-24",
  "type": "save",
  "sfen": "ln5nl/1r1sg1g2/pppppskpp/5pp2/3P5/2PS5/PPN1PPPPP/2g1K4/L1B1G1SNL b RB 1",
  "accepted": [
   "7i6h"
  ],
  "best": "7i6h",
  "pv": [
   "7i6h",
   "5c5d",
   "5h6g",
   "7h6h",
   "6g6h",
   "3c2b",
   "G*6g"
  ],
  "cpuB": 23.25
 },
 {
  "id": "st-save-25",
  "type": "save",
  "sfen": "ln5nl/1r1sg1gk1/ppppps1pp/5pp2/3P5/2PSP4/PPN2PPPP/1b1GK4/L5SNL b RBG 1",
  "accepted": [
   "G*8i"
  ],
  "best": "G*8i",
  "pv": [
   "G*8i",
   "8h9i+",
   "8i9i",
   "5b5a",
   "3i4h",
   "8c8d",
   "4h5g"
  ],
  "cpuB": 14.75
 },
 {
  "id": "st-take-26",
  "type": "take",
  "sfen": "ln5nl/1r1sg1gk1/ppppps1pp/5pp2/3P5/2PSP4/PPN2PPPP/3GK4/+b3R1SNL b BGl 1",
  "accepted": [
   "5i9i"
  ],
  "best": "5i9i",
  "pv": [
   "5i9i",
   "5c5d",
   "3i4h",
   "7c7d",
   "4h5g",
   "8a7c",
   "1g1f"
  ],
  "cpuB": 1.75
 },
 {
  "id": "st-tactic-27",
  "type": "tactic",
  "sfen": "ln5nl/2rsg1gk1/pp1pps1pp/2p2pp2/3P5/2PSP4/PPN2PPPP/3G1K3/R5SNL b 2BGl 1",
  "accepted": [
   "B*6a"
  ],
  "best": "B*6a",
  "pv": [
   "B*6a",
   "7b7a",
   "6a8c+",
   "8a7c",
   "9i8i",
   "1c1d",
   "1g1f"
  ],
  "cpuB": 12.75
 },
 {
  "id": "st-save-28",
  "type": "save",
  "sfen": "ln1B3nl/2rsg1gk1/pp1pps1pp/2p2pp2/3P5/2PSP4/PPN2PPPP/3G1K3/R5SNL w BGl 1",
  "accepted": [
   "7b8b",
   "6b7a",
   "L*7a"
  ],
  "best": "7b8b",
  "pv": [
   "7b8b",
   "G*7b"
  ],
  "cpuB": 14.25
 },
 {
  "id": "st-take-29",
  "type": "take",
  "sfen": "lnsB3nl/1r2g1gk1/pp1p1s1pp/2p1ppp2/3PB4/2PSP3P/PPN2PPP1/3G1K3/R5SNL b Gl 1",
  "accepted": [
   "5e8b+"
  ],
  "best": "5e8b+",
  "pv": [
   "5e8b+",
   "7a8b",
   "R*7b",
   "B*8d",
   "6a5b+",
   "8d6f",
   "4h3h"
  ],
  "cpuB": 6
 },
 {
  "id": "st-save-30",
  "type": "save",
  "sfen": "ln2R2nl/1s2s1gk1/pp1p3pp/2p1ppp2/3P5/2PSP3P/PPN2PPP1/3G1K3/R5SNL w 2G2bl 1",
  "accepted": [
   "B*6a"
  ],
  "best": "B*6a",
  "pv": [
   "B*6a",
   "G*5c",
   "5b5c",
   "5a6a+",
   "G*7a",
   "6a4a"
  ],
  "cpuB": 48
 },
 {
  "id": "st-take-31",
  "type": "take",
  "sfen": "ln1bR2nl/1s1Gs1gk1/pp1p3pp/2p1pppb1/3P5/2PSP3P/PPN2PPP1/3G1K3/3R2SNL w Gl 1",
  "accepted": [
   "2d5a"
  ],
  "best": "2d5a",
  "pv": [
   "2d5a",
   "6b5a",
   "7d7e",
   "5a6a",
   "5b6a",
   "B*5c",
   "7e7f"
  ],
  "cpuB": 6.25
 },
 {
  "id": "st-save-32",
  "type": "save",
  "sfen": "ln1bG1rnl/1s2s1gk1/pp1p3pp/2p1ppp2/3P5/2PSP3P/PPN2PPP1/3G1K3/3R2SNL b BGl 1",
  "accepted": [
   "5a5b",
   "G*6b"
  ],
  "best": "5a5b",
  "pv": [
   "5a5b",
   "6a5b",
   "B*5c",
   "3a4a",
   "G*6b",
   "G*4b",
   "5c4d+"
  ],
  "cpuB": 15.75
 },
 {
  "id": "st-take-33",
  "type": "take",
  "sfen": "ln4rnl/1s2G1g1k/pp1p3pp/4ppp2/B2P5/2pSP3P/PPN2PPP1/3G1K3/4R1SNL w BSglp 1",
  "accepted": [
   "7f7g+"
  ],
  "best": "7f7g+",
  "pv": [
   "7f7g+",
   "9e7g",
   "G*7f",
   "B*5c",
   "L*6g",
   "5b4b",
   "3b4b"
  ],
  "cpuB": 31
 },
 {
  "id": "st-save-34",
  "type": "save",
  "sfen": "ln1g1gsnl/1s2rk1b1/pp1p3pp/2p2ppP1/9/1PP1P4/P1BP1PP1P/3SG2R1/LNGK1S1NL w P 1",
  "accepted": [
   "2c2d"
  ],
  "best": "2c2d",
  "pv": [
   "2c2d",
   "2h2d",
   "4a3b",
   "3g3f",
   "7d7e",
   "7f7e",
   "5b5f"
  ],
  "cpuB": 16
 },
 {
  "id": "st-save-35",
  "type": "save",
  "sfen": "ln1g1gsnl/1sr2k3/pp1p2bPp/2p1pppp1/4B4/1PP1P4/P2P1PP1P/1G1SG2R1/LN1K1S1NL b - 1",
  "accepted": [
   "5e4f"
  ],
  "best": "5e4f",
  "pv": [
   "5e4f",
   "3a3b",
   "4f2d",
   "3b2c",
   "2d1c+",
   "2a1c",
   "2h2c+"
  ],
  "cpuB": 14.5
 },
 {
  "id": "st-take-36",
  "type": "take",
  "sfen": "ln1gk2nl/1s2rs1+P1/pp1p1gb1p/2p1pppp1/9/1PP1P4/PGBP1PP1P/4GS1R1/LNS1K2NL w - 1",
  "accepted": [
   "3c2b"
  ],
  "best": "3c2b",
  "pv": [
   "3c2b",
   "2h2d",
   "4b3c",
   "2d2c+",
   "8b7c",
   "5i6i",
   "7c6d"
  ],
  "cpuB": 3
 },
 {
  "id": "st-take-37",
  "type": "take",
  "sfen": "ln2k2+Pl/2g1r4/ppspsgb1p/2p1pppp1/1N7/1PP1P4/PGBPSPP1P/4G2R1/LNS1K2NL b - 1",
  "accepted": [
   "8e7c+"
  ],
  "best": "8e7c+",
  "pv": [
   "8e7c+",
   "8a7c",
   "5g6f",
   "4d4e",
   "7g6h",
   "5a6a",
   "6h2d"
  ],
  "cpuB": 48
 },
 {
  "id": "st-save-38",
  "type": "save",
  "sfen": "ln2k1S1+P/7r1/ppgpsgb1p/2p1pppp1/9/1PP1P4/PG1PGPP1P/3B3R1/LNS1K2NL w NLs 1",
  "accepted": [
   "2b5b"
  ],
  "best": "2b5b",
  "pv": [
   "2b5b",
   "5g5h",
   "5d5e",
   "5f5e",
   "5c6d",
   "8g7g",
   "6d5e"
  ],
  "cpuB": 48
 },
 {
  "id": "st-save-39",
  "type": "save",
  "sfen": "ln1gkg1nl/1r3s1b1/p1pp1pppp/1p1s5/4B2P1/2P6/PP1PPPP1P/3S1S1R1/LN1GKG1NL b P 1",
  "accepted": [
   "2e2d"
  ],
  "best": "2e2d",
  "pv": [
   "2e2d",
   "6d5e",
   "2d2c+",
   "4b3a",
   "P*2d",
   "B*8h",
   "2c2b"
  ],
  "cpuB": 22
 },
 {
  "id": "st-take-40",
  "type": "take",
  "sfen": "ln1gkg1nl/1r3s1b1/p1pp1pppp/1p5P1/4s4/2P6/PP1PPPP1P/3S1S1R1/LN1GKG1NL b Pb 1",
  "accepted": [
   "2d2c+"
  ],
  "best": "2d2c+",
  "pv": [
   "2d2c+",
   "4b3a",
   "2c2b",
   "8b2b",
   "2h2b+",
   "3a2b",
   "R*8b"
  ],
  "cpuB": 6.75
 },
 {
  "id": "st-save-41",
  "type": "save",
  "sfen": "ln1gkgb+Pl/1r3s3/p1pp1pp+Pp/9/1p2s4/2P6/PP1PPPP1P/3S1S1R1/LN1GKG1NL w NPb 1",
  "accepted": [
   "8e8f"
  ],
  "best": "8e8f",
  "pv": [
   "8e8f",
   "2a3a",
   "4b3a",
   "8g8f",
   "8b8f"
  ],
  "cpuB": 26.5
 },
 {
  "id": "st-take-42",
  "type": "take",
  "sfen": "l3k3l/1r2gg1b1/p1nsppnp1/1ppp2p1p/4Ps3/2P2SP2/PP1P1P1PP/2GBRS3/LN2KG1NL b - 1",
  "accepted": [
   "4f4e"
  ],
  "best": "4f4e",
  "pv": [
   "4f4e",
   "3c4e",
   "S*5f",
   "5c5d",
   "5f4e",
   "2b5e",
   "5h5e"
  ],
  "cpuB": 24.25
 },
 {
  "id": "st-save-43",
  "type": "save",
  "sfen": "l1S1k3l/1r2gg1b1/p1nspp1p1/1ppp2p1p/4P4/2P2PP2/PP1PR2PP/2GB3s1/LN2KG1NL w SN 1",
  "accepted": [
   "8b7b"
  ],
  "best": "8b7b",
  "pv": [
   "8b7b",
   "N*2f",
   "7b7a",
   "2f3d",
   "2b1c",
   "3d4b+",
   "5a4b"
  ],
  "cpuB": 10.5
 },
 {
  "id": "st-save-44",
  "type": "save",
  "sfen": "l1S1k3l/1r2gg1b1/p2spp1p1/1ppp2p1p/3nP4/2P2PP2/PP1P3PP/2GB3R1/LN2KG1NL w SNs 1",
  "accepted": [
   "8b7b"
  ],
  "best": "8b7b",
  "pv": [
   "8b7b",
   "N*8c",
   "5a4a",
   "6g6f",
   "2b5e",
   "6f6e",
   "5e9i+"
  ],
  "cpuB": 20.25
 },
 {
  "id": "st-save-45",
  "type": "save",
  "sfen": "l2rk3l/4gg1b1/pN1spp1p1/1ppp2p1p/3nP4/2PPSPP2/PP2s2PP/2GB3R1/LN2KG1NL b s 1",
  "accepted": [
   "6f6e"
  ],
  "best": "6f6e",
  "pv": [
   "6f6e",
   "5g6h",
   "7h6h",
   "S*7b",
   "8c9a+",
   "6a9a",
   "N*2f"
  ],
  "cpuB": 26.25
 },
 {
  "id": "st-take-46",
  "type": "take",
  "sfen": "l2rk3l/4gg1b1/pN1spp1p1/1ppp2p1p/3nP4/2PPSPP2/PP1Gs2PP/2sB3R1/LN2KG1NL b - 1",
  "accepted": [
   "6g5g"
  ],
  "best": "6g5g",
  "pv": [
   "6g5g",
   "6e5g+",
   "6h5g",
   "7h8i+",
   "N*2f",
   "5c5d",
   "5e5d"
  ],
  "cpuB": 12.25
 },
 {
  "id": "st-defend-47",
  "type": "defend",
  "sfen": "l2rk3l/4gg1b1/pN1spp1p1/1ppp2p1p/4P4/2PPSPP2/PP2+n2PP/2sB3R1/LN2KG1NL b Sg 1",
  "accepted": [
   "6h5g"
  ],
  "best": "6h5g",
  "pv": [
   "6h5g",
   "7h8i+",
   "6f6e",
   "N*4d",
   "5f4g",
   "5a4a",
   "5g8d"
  ],
  "cpuB": -10
 },
 {
  "id": "st-save-48",
  "type": "save",
  "sfen": "l2rk3l/4gg1b1/pN1spp1p1/1ppp2p1p/4P4/2PPSPP2/PP1gB2PP/2s4R1/LN2KG1NL b SN 1",
  "accepted": [
   "5g3i",
   "5g4h"
  ],
  "best": "5g3i",
  "pv": [
   "5g3i",
   "6a8a",
   "8c9a+",
   "8a9a",
   "S*8b",
   "9a6a",
   "8b7c+"
  ],
  "cpuB": 8
 },
 {
  "id": "st-take-49",
  "type": "take",
  "sfen": "+Nr2k3l/4gg1b1/p2spp1p1/1ppp2p1p/4P4/2PPSPP2/PP1g3PP/2s2B1R1/LN2KG1NL w SNL 1",
  "accepted": [
   "8a9a"
  ],
  "best": "8a9a",
  "pv": [
   "8a9a",
   "S*8b",
   "9a9b",
   "8b7c+",
   "N*5g",
   "4h2f",
   "5g4i+"
  ],
  "cpuB": 0.75
 },
 {
  "id": "st-defend-50",
  "type": "defend",
  "sfen": "r3k3l/4gg1b1/p2spp1p1/1ppp2p1p/4PS3/2PPSPP2/PP1gn2PP/2s2B1R1/LN2KG1NL b NL 1",
  "accepted": [
   "4h5g"
  ],
  "best": "4h5g",
  "pv": [
   "4h5g",
   "6g5g",
   "2h7h",
   "5c5d",
   "S*5h"
  ],
  "cpuB": 22
 },
 {
  "id": "st-take-51",
  "type": "take",
  "sfen": "r3k3l/4gg1b1/p2sp2p1/1ppp1pp1p/4PS3/2PPSPP2/PP1gB2PP/2s1G2R1/LN2K2NL w 2NL 1",
  "accepted": [
   "6g5g"
  ],
  "best": "6g5g",
  "pv": [
   "6g5g",
   "5h5g",
   "B*7i",
   "L*6h",
   "4d4e",
   "5f4e",
   "2b5e"
  ],
  "cpuB": 10.75
 },
 {
  "id": "st-tactic-52",
  "type": "tactic",
  "sfen": "r3k3l/4gg1b1/p2sp2p1/1ppp1pp1p/4PS3/2PPSPP2/PP2G2PP/2s4R1/LN2K2NL w G2NLb 1",
  "accepted": [
   "B*3i"
  ],
  "best": "B*3i",
  "pv": [
   "B*3i",
   "2h5h",
   "4d4e",
   "5i4i",
   "3i5g+",
   "5h5g",
   "9a9b"
  ],
  "cpuB": 16.25
 },
 {
  "id": "st-save-53",
  "type": "save",
  "sfen": "r3k3l/4gg1b1/p2sp2p1/1ppp1pp1p/4PS3/2PPSPP2/PP2G2PP/2s4R1/LN2K1bNL b G2NL 1",
  "accepted": [
   "2h7h"
  ],
  "best": "2h7h",
  "pv": [
   "2h7h",
   "3i5g+",
   "G*6g",
   "5g4f",
   "4e3d"
  ],
  "cpuB": 7
 },
 {
  "id": "st-take-54",
  "type": "take",
  "sfen": "r3k3l/4gg1b1/p2sp2p1/1ppp1pp1p/4PS3/2PPSPP2/PP2G2PP/4R4/L+s3KbNL w G2NLn 1",
  "accepted": [
   "3i5g+"
  ],
  "best": "3i5g+",
  "pv": [
   "3i5g+",
   "5h5g",
   "4d4e",
   "B*7c",
   "5a4a",
   "7c9a+",
   "4e4f"
  ],
  "cpuB": 7.75
 },
 {
  "id": "st-save-55",
  "type": "save",
  "sfen": "r3k3l/4gg1b1/p2sp2p1/1ppp2p1p/4Pp3/2PPSPP2/PP2R2PP/9/L+s3K1NL b BG2NLgsn 1",
  "accepted": [
   "B*7c"
  ],
  "best": "B*7c",
  "pv": [
   "B*7c",
   "5a4a",
   "7c9a+",
   "4e4f",
   "N*2f",
   "S*6h",
   "R*7a"
  ],
  "cpuB": 21.5
 },
 {
  "id": "st-tactic-56",
  "type": "tactic",
  "sfen": "5k2l/r3gg1b1/p1Bsp2p1/1ppp2p1p/4Pp3/2PPSPP2/PP2R2PP/5L3/L+s1s1K1NL w G2Ngn 1",
  "accepted": [
   "G*8c"
  ],
  "best": "G*8c",
  "pv": [
   "G*8c",
   "G*6h",
   "8c7c",
   "6h6i",
   "4e4f",
   "4h4f",
   "8i9i"
  ],
  "cpuB": 23.5
 },
 {
  "id": "st-take-57",
  "type": "take",
  "sfen": "5k2l/r3gg1b1/p1Bsp2p1/1ppp2p1p/4Pp3/2PPSPP2/PP5PP/4+sL3/L+s3K1NL b 2G2Nrn 1",
  "accepted": [
   "4i5h"
  ],
  "best": "4i5h",
  "pv": [
   "4i5h",
   "8i9i"
  ],
  "cpuB": -10
 },
 {
  "id": "st-save-58",
  "type": "save",
  "sfen": "3n1k2l/r3gg1b1/p1Bsp2p1/1ppp2p1p/4Pp3/2PPSPP2/PP5PP/4KL3/L+s5NL b 2GS2Nr 1",
  "accepted": [
   "7c8d+"
  ],
  "best": "7c8d+",
  "pv": [
   "7c8d+",
   "R*8h",
   "N*6h",
   "8i7i",
   "G*8c",
   "9b6b",
   "5f4e"
  ],
  "cpuB": 1
 },
 {
  "id": "st-save-59",
  "type": "save",
  "sfen": "5k2l/G3gg1b1/p1nsp2p1/1ppp2p1p/4Pp3/2PPSPP2/PP5PP/2b1KL1G1/L+s4rNL b RS2N 1",
  "accepted": [
   "R*8a",
   "R*9a"
  ],
  "best": "R*8a",
  "pv": [
   "R*8a",
   "5b5a",
   "S*6b",
   "7h5f+",
   "8a5a+",
   "4a3b",
   "G*6g"
  ],
  "cpuB": 30.75
 },
 {
  "id": "st-defend-60",
  "type": "defend",
  "sfen": "5knRl/G3g2b1/p1nspg1p1/1ppp1sp1p/4Pp3/2PPKPP2/PP2N2PP/4+rLG2/L+s5NL b BS 1",
  "accepted": [
   "3f3e"
  ],
  "best": "3f3e",
  "pv": [
   "3f3e",
   "4d5e",
   "5f4e",
   "5h5g",
   "3e3d"
  ],
  "cpuB": 32.75
 },
 {
  "id": "st-save-61",
  "type": "save",
  "sfen": "ln1gkg1nl/2s4b1/p4pps1/1pps3+rp/3pB4/2P5P/PP1P2PG1/2SG1P1R1/LNK4NL b P3p 1",
  "accepted": [
   "5e4f"
  ],
  "best": "5e4f",
  "pv": [
   "5e4f",
   "2d5d",
   "P*2d",
   "2c2d",
   "2g3f",
   "P*2c"
  ],
  "cpuB": 11
 },
 {
  "id": "st-save-62",
  "type": "save",
  "sfen": "ln1gk2nl/2s3gbs/p4pp2/1pp1+r2Pp/3ps4/2P2BG1P/PP1P2P2/2SG1P1R1/LN1K3NL b 3p 1",
  "accepted": [
   "4f5e"
  ],
  "best": "4f5e",
  "pv": [
   "4f5e",
   "5d5e",
   "7h7g",
   "3c3d",
   "S*2c",
   "B*3i",
   "2c3b+"
  ],
  "cpuB": 25.75
 },
 {
  "id": "st-take-63",
  "type": "take",
  "sfen": "ln1gk2nl/2s3gb1/p4pp2/1p2+r2sp/2Pps1B2/6G1P/PP1P2P2/2SG1P1R1/LN1K3NL b P4p 1",
  "accepted": [
   "2h2d"
  ],
  "best": "2h2d",
  "pv": [
   "2h2d",
   "5d2d",
   "3e2d",
   "R*4i",
   "P*5i",
   "4i2i+",
   "R*2e"
  ],
  "cpuB": 26.5
 },
 {
  "id": "st-save-64",
  "type": "save",
  "sfen": "ln1g3nl/2s1Pkgb1/p4pp2/1p2+r2Rp/2Pps1B2/6G1P/PP1P2P2/2SG1P3/LN1K3NL w S4p 1",
  "accepted": [
   "5d2d"
  ],
  "best": "5d2d",
  "pv": [
   "5d2d",
   "S*5c",
   "4b3a",
   "3e2d",
   "R*3i",
   "R*5i",
   "3i5i+"
  ],
  "cpuB": 29.5
 },
 {
  "id": "st-take-65",
  "type": "take",
  "sfen": "l2g3nl/2s1Pk+Sb1/p1n3p2/1p2+rp1Rp/2Pps1B2/6G1P/PP1P2P2/2SG1P3/LN1K3NL w G4p 1",
  "accepted": [
   "4b3b"
  ],
  "best": "4b3b",
  "pv": [
   "4b3b",
   "G*2c",
   "3b4b",
   "2c2b",
   "6e6f",
   "6g6f",
   "P*5f"
  ],
  "cpuB": -10
 },
 {
  "id": "st-save-66",
  "type": "save",
  "sfen": "l2g2bnl/2s1P4/p1n2k1G1/1p2+rpp1p/2Pps4/6GRP/PP1PB1P2/2SG1P3/LN1K3NL b s4p 1",
  "accepted": [
   "2c2b"
  ],
  "best": "2c2b",
  "pv": [
   "2c2b",
   "3a6d"
  ],
  "cpuB": 8
 },
 {
  "id": "st-save-67",
  "type": "save",
  "sfen": "l2g4G/2s1kb3/p1n6/1p2+rpp1p/2Pps4/4p1GRP/PP1PB1P2/2SG1P3/LN1K3NL b NLs4p 1",
  "accepted": [
   "5g1c+"
  ],
  "best": "5g1c+",
  "pv": [
   "5g1c+",
   "4b7e"
  ],
  "cpuB": 10.5
 },
 {
  "id": "st-tactic-68",
  "type": "tactic",
  "sfen": "l2g4G/2s1kb3/p1n3s1+B/1p1+r1pp1p/2Pps4/4pNGRP/PP1P2P2/2SG1P3/LN1K3NL b L4p 1",
  "accepted": [
   "2f2a+"
  ],
  "best": "2f2a+",
  "pv": [
   "2f2a+",
   "6e6f",
   "1c1d",
   "5f5g+",
   "6h5g",
   "P*5f",
   "5g5h"
  ],
  "cpuB": 19.25
 },
 {
  "id": "st-save-69",
  "type": "save",
  "sfen": "l2g4G/2s2b3/p1n1k1s+R1/1p1+r1pN1+B/2Pps4/2p1p1G1P/PP1P2P2/2SG1P3/LN1K3NL w L2P3p 1",
  "accepted": [
   "4b5a",
   "P*2b"
  ],
  "best": "4b5a",
  "pv": [
   "4b5a",
   "1d2d"
  ],
  "cpuB": 11.25
 },
 {
  "id": "st-take-70",
  "type": "take",
  "sfen": "l2gb2+RG/2s+r5/p1n1k1s2/1p3pN1+B/2Pps4/2p1p1G1P/PP1P2P2/2SG1P3/LN1K3NL w L2P3p 1",
  "accepted": [
   "3c3d"
  ],
  "best": "3c3d",
  "pv": [
   "3c3d",
   "L*5h",
   "P*2h",
   "8g8f",
   "2h2i+",
   "1d4a",
   "2i1i"
  ],
  "cpuB": 10.25
 },
 {
  "id": "st-take-71",
  "type": "take",
  "sfen": "l2gb2+RG/2s1+r4/p1n6/1p2kpG1+B/2Pps4/1Lp1p3P/PPnP2P2/2SG1P3/LN1K3NL b S2P3p 1",
  "accepted": [
   "8i7g"
  ],
  "best": "8i7g",
  "pv": [
   "8i7g",
   "7f7g+",
   "7h7g",
   "5f5g+",
   "6h5g",
   "P*5f",
   "5g4g"
  ],
  "cpuB": 8.75
 },
 {
  "id": "st-save-72",
  "type": "save",
  "sfen": "l2gb2+RG/2s1+r4/p1n6/1p2kpG1+B/2Pps4/1L2p3P/PP+pP2P2/2SG1P3/L2K3NL b SN2Pn3p 1",
  "accepted": [
   "1d3f"
  ],
  "best": "1d3f",
  "pv": [
   "1d3f",
   "5d6d",
   "7h7g",
   "6d7e"
  ],
  "cpuB": 48
 },
 {
  "id": "st-tactic-73",
  "type": "tactic",
  "sfen": "l2gb2+RG/4+r4/psn6/1p2kpG1+B/2Pps4/1L2p3P/PPSP2P2/3G1P1S1/L2K3NL w N3Pn3p 1",
  "accepted": [
   "8d8e"
  ],
  "best": "8d8e",
  "pv": [
   "8d8e",
   "1d3f",
   "5d6d",
   "N*4g",
   "8e8f",
   "4g5e",
   "8f8g+"
  ],
  "cpuB": 33
 },
 {
  "id": "st-save-74",
  "type": "save",
  "sfen": "l2gb3G/4+r4/ps2k1p+R1/1p3pG2/1nPps4/1L2p1+B1P/PPSP2P2/3G1P1S1/L2K3NL b N3Pn2p 1",
  "accepted": [
   "8f8e"
  ],
  "best": "8f8e",
  "pv": [
   "8f8e",
   "8d8e",
   "N*4g",
   "L*2b",
   "2c1b",
   "5e6d",
   "P*5d"
  ],
  "cpuB": 15.25
 },
 {
  "id": "st-tactic-75",
  "type": "tactic",
  "sfen": "l2gb2+RG/4+r4/p8/s2k1pG2/1pPps4/4p1+B1P/PPSP2P2/3G1P1S1/L2K3NL w 2N4Pnl2p 1",
  "accepted": [
   "P*7f"
  ],
  "best": "P*7f",
  "pv": [
   "P*7f",
   "7g7f",
   "N*8d",
   "6i5h",
   "8d7f"
  ],
  "cpuB": 48
 },
 {
  "id": "st-save-76",
  "type": "save",
  "sfen": "l2gb2+RG/4+r4/pl1N5/s2k1pG2/1pPps4/4p1+B1P/PPSP2P2/3G1P1S1/L2K3NL w N4Pn2p 1",
  "accepted": [
   "5a9e"
  ],
  "best": "5a9e",
  "pv": [
   "5a9e",
   "P*5c"
  ],
  "cpuB": 26.5
 },
 {
  "id": "st-tactic-77",
  "type": "tactic",
  "sfen": "l2g3+RG/3b+r4/pl1N5/s4pG2/1pkps4/P1N1p1+B1P/1PSP2P2/3G1P1S1/L2K3NL b 4Pn3p 1",
  "accepted": [
   "P*5c"
  ],
  "best": "P*5c",
  "pv": [
   "P*5c",
   "5f5g+",
   "5c5b+",
   "5g6h",
   "7g6h",
   "6a5b",
   "2a9a"
  ],
  "cpuB": 32.75
 },
 {
  "id": "st-take-78",
  "type": "take",
  "sfen": "l1+Ngn2+RG/4+r4/plb6/s4pG2/1pkps4/P1N1p1+B1P/1PSP2P2/2PG1P1S1/L2K3NL b 3P3p 1",
  "accepted": [
   "7a6a"
  ],
  "best": "7a6a",
  "pv": [
   "7a6a",
   "5b6a",
   "G*7b",
   "5f5g+",
   "7b7c",
   "5g6h",
   "6i6h"
  ],
  "cpuB": 27.75
 },
 {
  "id": "st-defend-79",
  "type": "defend",
  "sfen": "l1+Ngn3G/4+r4/plb4+R1/s4pG2/1pkps4/P1N1p1+B1P/1PSP2P2/2PG1P1S1/L2K3NL w 3P3p 1",
  "accepted": [
   "6a6b"
  ],
  "best": "6a6b",
  "pv": [
   "6a6b",
   "3f4g",
   "6b6c",
   "2c2d",
   "8e8f",
   "8g8f",
   "8c8f"
  ],
  "cpuB": 15.75
 },
 {
  "id": "st-save-80",
  "type": "save",
  "sfen": "ln2k1b+Rl/1r1sgsg2/p1ppp1p1p/5p3/1p7/2P6/PP1PPPP1P/1B1S1S3/LN1GKG1NL w NPp 1",
  "accepted": [
   "3b2b"
  ],
  "best": "3b2b",
  "pv": [
   "3b2b",
   "2a1a",
   "8e8f",
   "L*2d",
   "P*2c",
   "8g8f"
  ],
  "cpuB": 19
 },
 {
  "id": "st-save-81",
  "type": "save",
  "sfen": "ln2k1b1+R/3sgs1g1/p1ppp1p1p/1r3p3/1p7/NLP6/P1SPPPP1P/1B3S3/LN1GKG1NL w 2Pp 1",
  "accepted": [
   "8d6d"
  ],
  "best": "8d6d",
  "pv": [
   "8d6d",
   "8f8e",
   "6d6g+",
   "4i5h",
   "6g6d",
   "P*2c",
   "2b2c"
  ],
  "cpuB": 29.5
 },
 {
  "id": "st-save-82",
  "type": "save",
  "sfen": "l+L2k1b1+R/3sgs1g1/p1ppp1p1p/4rp3/9/N1P2N3/P1SPPPP1P/1B3S3/LN1GKG1+pL w 3Pn 1",
  "accepted": [
   "5d6d"
  ],
  "best": "5d6d",
  "pv": [
   "5d6d",
   "8a9a",
   "6d6g+",
   "4i5h",
   "6g6e",
   "L*2f",
   "P*2c"
  ],
  "cpuB": 17.75
 },
 {
  "id": "st-save-83",
  "type": "save",
  "sfen": "l+L2skb+R1/3sg4/p1ppp1pgp/r4p3/9/N1PS1N2P/P2PPPP2/1BGK1S3/LN3G1+pL w 3Pn 1",
  "accepted": [
   "2c2b"
  ],
  "best": "2c2b",
  "pv": [
   "2c2b",
   "2a3a",
   "4a3a",
   "4i5i",
   "4d4e"
  ],
  "cpuB": 8.5
 },
 {
  "id": "st-take-84",
  "type": "take",
  "sfen": "5kb1+R/l+L1s1s1g1/p1ppp1s1p/r1n3p2/5p3/N1P2N2P/P2PPPP1L/1BGK5/LN2SG1+p1 w G3P 1",
  "accepted": [
   "4e4f"
  ],
  "best": "4e4f",
  "pv": [
   "4e4f",
   "G*1b",
   "2b3b",
   "4g4f",
   "N*8f",
   "8b9b",
   "8f7h+"
  ],
  "cpuB": 5.5
 },
 {
  "id": "st-take-85",
  "type": "take",
  "sfen": "6bk1/l+L1s1s3/pGppp1s1p/r1n3p2/5p3/N1P2N2P/P1BPPPP1L/2GK5/LN2SG1+p1 w G3Pr 1",
  "accepted": [
   "4e4f"
  ],
  "best": "4e4f",
  "pv": [
   "4e4f",
   "4g4f",
   "N*6e",
   "8b9b",
   "6e7g+",
   "8i7g",
   "9d9e"
  ],
  "cpuB": 9.75
 },
 {
  "id": "st-defend-86",
  "type": "defend",
  "sfen": "6bk1/l+L1s1s3/pGppp1sGp/r1n3p2/9/N1P2P2P/P1BPP1P1+r/2GK1S3/LN3G1+p1 w 4Pnl 1",
  "accepted": [
   "N*6f",
   "L*6f",
   "L*4d"
  ],
  "best": "N*6f",
  "pv": [
   "N*6f",
   "6g6f",
   "L*2b",
   "P*2d",
   "3c2d",
   "2c2d",
   "2b2d"
  ],
  "cpuB": 29.5
 },
 {
  "id": "st-take-87",
  "type": "take",
  "sfen": "7k1/l+L1s1s1b1/pGppp3p/r1n3p2/9/N1P2P2P/P1BPP1P1+r/2GK1S3/LN3G1+p1 b S4Pgnl 1",
  "accepted": [
   "7g2b+"
  ],
  "best": "7g2b+",
  "pv": [
   "7g2b+",
   "2a2b",
   "B*4d",
   "2b3b",
   "4d1g",
   "7d8f",
   "7h7g"
  ],
  "cpuB": 15.75
 },
 {
  "id": "st-tactic-88",
  "type": "tactic",
  "sfen": "9/l+L1s1s1k1/pGppp3p/r1n3p2/9/N1P2P2P/P2PP1P1+r/2GK1S3/LN3G1+p1 b BS4Pbgnl 1",
  "accepted": [
   "B*4d"
  ],
  "best": "B*4d",
  "pv": [
   "B*4d",
   "2b3b",
   "4d1g"
  ],
  "cpuB": 17.5
 },
 {
  "id": "st-save-89",
  "type": "save",
  "sfen": "l8/l+LRs3k1/pGppp1s1p/r1n3p2/9/N1P2P2P/P2PP1P1B/2GK1S3/LN3G1+p1 w S4Pbgn 1",
  "accepted": [
   "G*6a"
  ],
  "best": "G*6a",
  "pv": [
   "G*6a",
   "P*2d",
   "3c2d",
   "1g4d",
   "2b3b",
   "8b9b",
   "6a7b"
  ],
  "cpuB": 17.5
 },
 {
  "id": "st-tactic-90",
  "type": "tactic",
  "sfen": "lnsg1g1nl/1r3k3/p1ppppbsp/1p4pp1/7P1/2P6/PPSPPPP1P/2G4R1/LN2KGSNL b B 1",
  "accepted": [
   "2e2d"
  ],
  "best": "2e2d",
  "pv": [
   "2e2d",
   "3c2d",
   "B*2b",
   "1a1b",
   "2b6f+",
   "4b3b",
   "1g1f"
  ],
  "cpuB": 24.75
 },
 {
  "id": "st-take-91",
  "type": "take",
  "sfen": "ln4gnl/1r3gks1/p1p2pppp/1ps1p4/3N3RP/5BP2/PP1PPP3/2GS2S2/L3KG1NL b 2Pbp 1",
  "accepted": [
   "6e7c+"
  ],
  "best": "6e7c+",
  "pv": [
   "6e7c+",
   "B*8i",
   "7c7d",
   "8i7h+",
   "4f8b+",
   "G*6i",
   "5i4h"
  ],
  "cpuB": 19
 },
 {
  "id": "st-save-92",
  "type": "save",
  "sfen": "ln4gnl/1r3gks1/p1+N2pppp/1ps1p4/7RP/5BP2/PP1PPP3/2GS2S2/L3KG1NL w 3Pbp 1",
  "accepted": [
   "8a7c"
  ],
  "best": "8a7c",
  "pv": [
   "8a7c",
   "4f7c+"
  ],
  "cpuB": -0.75
 },
 {
  "id": "st-defend-93",
  "type": "defend",
  "sfen": "ln1gk1s+Rl/1r1s5/p1pppp2p/1p4p2/9/2P6/PP1PPPP1P/1+b7/LNSGKGSNL w GNPbp 1",
  "accepted": [
   "8h2b"
  ],
  "best": "8h2b",
  "pv": [
   "8h2b",
   "2a2b",
   "3a2b",
   "P*2c"
  ],
  "cpuB": 8.5
 },
 {
  "id": "st-save-94",
  "type": "save",
  "sfen": "ln1gk1s+Rl/1r1s3+b1/p1pppp2p/1p4p2/9/2P6/PP1PPPP1P/9/LNSGKGSNL b GNPbp 1",
  "accepted": [
   "2a2b"
  ],
  "best": "2a2b",
  "pv": [
   "2a2b",
   "3a2b",
   "P*2c",
   "2b3c",
   "G*3b",
   "B*4d",
   "B*7g"
  ],
  "cpuB": -10
 },
 {
  "id": "st-tactic-95",
  "type": "tactic",
  "sfen": "ln1gk3l/1r1s3s1/p1pppp2p/1p4p2/9/2P6/PP1PPPP1P/9/LNSGKGSNL b BGNPrbp 1",
  "accepted": [
   "B*6e"
  ],
  "best": "B*6e",
  "pv": [
   "B*6e",
   "5a5b",
   "G*8c",
   "8b8c",
   "6e8c+",
   "B*9e",
   "5i4h"
  ],
  "cpuB": 48
 },
 {
  "id": "st-save-96",
  "type": "save",
  "sfen": "ln1gk3l/1r1s5/p1pppps1p/1p4p2/4b4/2PG4B/PP1PPPP1P/1S7/LN1GKGSNL w NPrp 1",
  "accepted": [
   "5e4d"
  ],
  "best": "5e4d",
  "pv": [
   "5e4d",
   "5i6h",
   "6c6d",
   "4g4f",
   "6b6c",
   "4f4e",
   "4d6f"
  ],
  "cpuB": 16
 },
 {
  "id": "st-take-97",
  "type": "take",
  "sfen": "ln1gk3l/1r1s5/p1pp1ps1p/1p2p1p2/4G4/2P5B/PP1PPPP1P/1S7/LN1GKGSNL w BNPrp 1",
  "accepted": [
   "5d5e"
  ],
  "best": "5d5e",
  "pv": [
   "5d5e",
   "3g3f",
   "6a5b",
   "3f3e",
   "3c4d",
   "3e3d",
   "5a6a"
  ],
  "cpuB": 6.75
 },
 {
  "id": "st-save-98",
  "type": "save",
  "sfen": "ln1gk3l/1r1s5/p1pp1ps1p/1p4pr1/4p3B/2P3P1B/PP1PPP2P/1S7/LN1GKGSNL w NPgp 1",
  "accepted": [
   "2d2c",
   "2d2i+"
  ],
  "best": "2d2c",
  "pv": [
   "2d2c",
   "1f3d",
   "2c2i+",
   "1e3c+",
   "G*4b",
   "3d4c+",
   "6b5c"
  ],
  "cpuB": 7.5
 },
 {
  "id": "st-take-99",
  "type": "take",
  "sfen": "ln1gk3l/1r1s5/p1pp1ps1p/1p4B2/4p3B/2P3P2/PP1PPP2P/1S7/LN1GKGS+rL b N2Pgnp 1",
  "accepted": [
   "1e3c+"
  ],
  "best": "1e3c+",
  "pv": [
   "1e3c+",
   "G*4b",
   "3c5e",
   "2i2d",
   "3d5f",
   "6a7b",
   "5e1a"
  ],
  "cpuB": 2
 },
 {
  "id": "st-save-100",
  "type": "save",
  "sfen": "ln1gk1snl/1r4g2/pp1pppbpp/9/2s3p2/7P1/PPNPPPS1P/2GS3R1/L3KG1NL w BP2p 1",
  "accepted": [
   "P*7f"
  ],
  "best": "P*7f",
  "pv": [
   "P*7f",
   "B*4f",
   "7e6d",
   "2f2e",
   "7f7g+",
   "6h7g",
   "P*7f"
  ],
  "cpuB": 23
 },
 {
  "id": "st-save-101",
  "type": "save",
  "sfen": "ln1gk1snl/1r4g2/pp1ppp1pp/5bP2/2s3p2/2p2S1P1/PPSPPP2P/2G4R1/L3KG1NL b BPn 1",
  "accepted": [
   "7g8h"
  ],
  "best": "7g8h",
  "pv": [
   "7g8h",
   "7e6d",
   "5g5f",
   "8b7b",
   "2f2e",
   "3a4b"
  ],
  "cpuB": 22.25
 },
 {
  "id": "st-take-102",
  "type": "take",
  "sfen": "ln1gk2nl/1r4gs1/pp1ppp1pp/5bP2/2s1B1p2/2p2S1P1/PP1PPP2P/1SG4R1/L3KG1NL w Pn 1",
  "accepted": [
   "4d5e"
  ],
  "best": "4d5e",
  "pv": [
   "4d5e",
   "4f5e",
   "3e3f",
   "5g5f",
   "8b7b"
  ],
  "cpuB": 26.5
 },
 {
  "id": "st-take-103",
  "type": "take",
  "sfen": "ln1gk2nl/1r4gs1/ppbppp1pp/6P2/4S1p2/2p4P1/Ps1PPP2P/1SGB3R1/L3KG1NL b n2p 1",
  "accepted": [
   "7h8g"
  ],
  "best": "7h8g",
  "pv": [
   "7h8g",
   "7c5e",
   "S*4f",
   "N*3f",
   "2h5h"
  ],
  "cpuB": 5.5
 },
 {
  "id": "st-tactic-104",
  "type": "tactic",
  "sfen": "ln1g2knl/1r4gs1/pplppp1pp/6P2/4B1p2/7P1/PS1PPP2P/1SG5R/1+b2KG1NL b Psn2p 1",
  "accepted": [
   "P*7d"
  ],
  "best": "P*7d",
  "pv": [
   "P*7d",
   "S*6d",
   "7d7c+",
   "8a7c",
   "5e4f",
   "8b7b",
   "8g7f"
  ],
  "cpuB": 17.5
 },
 {
  "id": "st-save-105",
  "type": "save",
  "sfen": "ln4knl/1r1g2gs1/pp+Pppp1pp/5sP2/4B1p2/4P2P1/PS1P1P2P/1SG5R/1+b2KG1NL w Ln2p 1",
  "accepted": [
   "8a7c",
   "6b7c"
  ],
  "best": "8a7c",
  "pv": [
   "8a7c",
   "5e4f",
   "4d4e",
   "4f5e",
   "5c5d",
   "5e6f",
   "4e3d"
  ],
  "cpuB": 9.75
 },
 {
  "id": "st-tactic-106",
  "type": "tactic",
  "sfen": "lr4knl/3g2gs1/ppnppp1pp/4nsP2/6p2/4P2P1/PS1P1PB1P/1SG5R/1+b2KG1NL b L3p 1",
  "accepted": [
   "5f5e"
  ],
  "best": "5f5e",
  "pv": [
   "5f5e",
   "3e3f",
   "3g2h",
   "7c6e",
   "5e5d",
   "P*7g",
   "8h7g"
  ],
  "cpuB": 31
 },
 {
  "id": "st-take-107",
  "type": "take",
  "sfen": "lr4knl/3g2gs1/pp1ppp1pp/4n1P2/3n1sp2/4P2P1/PS1P1PB1P/1S1K4R/2+b2G1NL b Lg3p 1",
  "accepted": [
   "6h7i"
  ],
  "best": "6h7i",
  "pv": [
   "6h7i",
   "4e5f"
  ],
  "cpuB": 6.25
 },
 {
  "id": "st-tactic-108",
  "type": "tactic",
  "sfen": "lr4knl/3g2gs1/pp1ppp1pp/4n1P2/3n1sp2/4P2P1/PS1P1PB1P/1S6R/2K2G1NL w BLg3p 1",
  "accepted": [
   "4e5f"
  ],
  "best": "4e5f",
  "pv": [
   "4e5f",
   "3g5e",
   "5f6g+",
   "B*9e",
   "8c8d",
   "4i5h",
   "6g5h"
  ],
  "cpuB": 32.75
 },
 {
  "id": "st-save-109",
  "type": "save",
  "sfen": "lr4knl/3g2gs1/pp1ppp1pp/4n1P2/3n1sp2/4P2P1/PS1P1PBgP/1S6R/2K2G1NL b BL3p 1",
  "accepted": [
   "1h5h"
  ],
  "best": "1h5h",
  "pv": [
   "1h5h",
   "2g3g",
   "2i3g",
   "4e3d",
   "5f5e",
   "B*2g",
   "5h5i"
  ],
  "cpuB": 35
 },
 {
  "id": "st-save-110",
  "type": "save",
  "sfen": "lr4knl/3g2gs1/pp1ppp1pp/4n1P2/3n2pN1/4P1sP1/PS1P1P1bP/1S2R4/2K2G2L b BGL3p 1",
  "accepted": [
   "4i4h",
   "4i3h"
  ],
  "best": "4i4h",
  "pv": [
   "4i4h",
   "3f2e",
   "2f2e",
   "2g4e+",
   "G*7f",
   "6c6d",
   "B*5e"
  ],
  "cpuB": 17.5
 },
 {
  "id": "st-take-111",
  "type": "take",
  "sfen": "lr4knl/3g2gs1/pp1ppp1pp/4n1P2/6pN1/4P1sP1/PS1PRP1bP/1S4G2/2K5L w BGNL3p 1",
  "accepted": [
   "2g3h+"
  ],
  "best": "2g3h+",
  "pv": [
   "2g3h+",
   "7i8i",
   "3h4h",
   "N*7d",
   "4h5g",
   "7d6b+",
   "3f2e"
  ],
  "cpuB": 4
 },
 {
  "id": "st-defend-112",
  "type": "defend",
  "sfen": "lr1g2knl/6gs1/pp1pppNpp/4n1P2/B5pN1/4P1sP1/PS1PRP2P/1S4+b2/2K5L w GLg3p 1",
  "accepted": [
   "2a3c"
  ],
  "best": "2a3c",
  "pv": [
   "2a3c",
   "3d3c+",
   "2b3c",
   "2e3c+",
   "3b3c",
   "7i8i",
   "G*3b"
  ],
  "cpuB": 29
 },
 {
  "id": "st-take-113",
  "type": "take",
  "sfen": "l2g2knl/6gs1/pp1pppNpp/4n1P2/B5pN1/4P1sP1/PS1PRP2P/1S+r3+b2/2K5L b Ggl3p 1",
  "accepted": [
   "7i7h"
  ],
  "best": "7i7h",
  "pv": [
   "7i7h",
   "2a3c",
   "3d3c+",
   "2b3c"
  ],
  "cpuB": 8.5
 },
 {
  "id": "st-save-114",
  "type": "save",
  "sfen": "lRlg3kl/5ggs1/pp1ppp+Ppp/4n4/B5pN1/4P1sP1/PS1PRP2P/1S3+b3/1K6L w GNn3p 1",
  "accepted": [
   "4b3c"
  ],
  "best": "4b3c",
  "pv": [
   "4b3c",
   "2e3c",
   "2b3c",
   "G*5h",
   "4h5g",
   "5h5g",
   "N*6e"
  ],
  "cpuB": 31
 },
 {
  "id": "st-take-115",
  "type": "take",
  "sfen": "lRlg3kl/6gs1/pp1pppgpp/4n4/B5pN1/4P1sP1/PS1PRP2P/1S2G+b3/1K6L w Nn4p 1",
  "accepted": [
   "4h5g"
  ],
  "best": "4h5g",
  "pv": [
   "4h5g",
   "2e3c",
   "2b3c",
   "5h5g",
   "N*6e",
   "8a9a+",
   "6e5g+"
  ],
  "cpuB": 8.25
 },
 {
  "id": "st-save-116",
  "type": "save",
  "sfen": "lRlg3kl/7s1/1p1pppgpp/p3n4/6p2/1B2P1sP1/PS1PGP2P/1S7/1K6L w BGNr2n4p 1",
  "accepted": [
   "N*9e"
  ],
  "best": "N*9e",
  "pv": [
   "N*9e",
   "G*4b",
   "9e8g+",
   "8h8g",
   "R*7i",
   "8i9h",
   "N*9e"
  ],
  "cpuB": 29.5
 },
 {
  "id": "st-save-117",
  "type": "save",
  "sfen": "lRlg3kl/1B5s1/1p1pppgpp/p3n4/n1p3p2/SB2P1sP1/P2PGP2P/1S4r2/1K3G2L w Nn3p 1",
  "accepted": [
   "N*7d"
  ],
  "best": "N*7d",
  "pv": [
   "N*7d",
   "4i3h"
  ],
  "cpuB": 48
 },
 {
  "id": "st-save-118",
  "type": "save",
  "sfen": "lnsgkgsnl/9/p1ppppbpp/6p2/7P1/1r7/P1PPPPP1P/1B1SGS1R1/LN1GK2NL b Pp 1",
  "accepted": [
   "6i7h"
  ],
  "best": "6i7h",
  "pv": [
   "6i7h",
   "P*8g"
  ],
  "cpuB": 17.25
 },
 {
  "id": "st-take-119",
  "type": "take",
  "sfen": "ln1g1g2+B/3sks3/prpbpN1pp/1p1p1pp2/2P6/7P1/PP1PPPP1P/2GKGS1R1/LNS4NL w L 1",
  "accepted": [
   "4b4c"
  ],
  "best": "4b4c",
  "pv": [
   "4b4c",
   "2f2e",
   "N*2g",
   "2e2d",
   "2c2d",
   "L*4f",
   "4a3a"
  ],
  "cpuB": 11
 },
 {
  "id": "st-save-120",
  "type": "save",
  "sfen": "ln1g2s2/3sk1g2/prp1p1+Bpp/1p1pbpp2/2P6/7P1/PP1PPPP1P/2GKGS1R1/LNS4NL b Ln 1",
  "accepted": [
   "3c3d"
  ],
  "best": "3c3d",
  "pv": [
   "3c3d",
   "5b5a",
   "3d5f",
   "6a7b",
   "2f2e",
   "N*2g",
   "5f8c"
  ],
  "cpuB": 10.5
 },
 {
  "id": "st-take-121",
  "type": "take",
  "sfen": "lnsg5/1r3+L1+B1/p1pkpg3/1p1pbp3/N1P6/5P1P1/PP1PP1P1P/2GKGS1R1/LNS4NL w S3P 1",
  "accepted": [
   "8b4b"
  ],
  "best": "8b4b",
  "pv": [
   "8b4b",
   "2b3a",
   "L*2g",
   "3a4b",
   "4c4b"
  ],
  "cpuB": 5
 },
 {
  "id": "st-tactic-122",
  "type": "tactic",
  "sfen": "lnsg2+B2/5r3/p1pkpg3/1p1pbp3/N1P6/5P1P1/PP1PP1P1P/2GKGS1R1/LNS4NL w S3Pl 1",
  "accepted": [
   "L*2g"
  ],
  "best": "L*2g",
  "pv": [
   "L*2g",
   "2h1h",
   "2g2i+",
   "9e8c+",
   "5d2g+",
   "3a4b",
   "4c4b"
  ],
  "cpuB": 17.25
 },
 {
  "id": "st-take-123",
  "type": "take",
  "sfen": "1ng2+S+B2/r8/l1pkpg3/pp1pbp3/2P6/5P1P1/PP1PP1PlP/2GKGS2R/LNS4NL w S3Pn 1",
  "accepted": [
   "2g2i+"
  ],
  "best": "2g2i+",
  "pv": [
   "2g2i+",
   "S*5f",
   "N*7f",
   "6h6i",
   "5d1h+",
   "1i1h"
  ],
  "cpuB": 31.25
 },
 {
  "id": "st-save-124",
  "type": "save",
  "sfen": "ln2kg1nl/2g4b1/1pp1sppSp/p2pr4/4p4/2PB2P2/PP1PPPS1P/3K5/LNSG1G1NL w R2p 1",
  "accepted": [
   "6d6e"
  ],
  "best": "6d6e",
  "pv": [
   "6d6e",
   "6f5e",
   "5d5e",
   "2c2b+",
   "6e6f",
   "B*2c",
   "5e2e"
  ],
  "cpuB": 48
 },
 {
  "id": "st-take-125",
  "type": "take",
  "sfen": "ln2kg1nl/2g4+S1/1pp1spp1p/p2p3r1/4p4/2PB2P2/PP1PPPS1P/3K5/LNSG1G1NL w RB2p 1",
  "accepted": [
   "2d2b"
  ],
  "best": "2d2b",
  "pv": [
   "2d2b",
   "B*1f",
   "4a4b",
   "4i3i",
   "5c5d",
   "6f7e",
   "S*2g"
  ],
  "cpuB": 8.5
 },
 {
  "id": "st-tactic-126",
  "type": "tactic",
  "sfen": "ln3g1nl/2g2k1r1/1pp1spp1p/p2p5/4p4/1BPB2P2/PP1PPPS1P/3K5/LNSG1GRNL w s2p 1",
  "accepted": [
   "P*2h"
  ],
  "best": "P*2h",
  "pv": [
   "P*2h",
   "3g2h",
   "2b2h+",
   "4i3h",
   "2h2b",
   "6f5e",
   "S*5d"
  ],
  "cpuB": 17.25
 },
 {
  "id": "st-save-127",
  "type": "save",
  "sfen": "ln3g1nl/2g2k1r1/1pp1spp1p/p2p5/1s2p4/1BPB2P2/PP1PPPS1P/3K5/LNSG1GRNL b 2p 1",
  "accepted": [
   "6f5e"
  ],
  "best": "6f5e",
  "pv": [
   "6f5e",
   "8e8f",
   "8g8f",
   "P*2f",
   "P*2h",
   "B*8g",
   "S*7g"
  ],
  "cpuB": 29
 },
 {
  "id": "st-save-128",
  "type": "save",
  "sfen": "ln1S1g1nl/2g2k3/1p2spp1p/p1pp3r1/1N2p4/1BPB1SPp1/PP1PPP2P/3K5/L1SG1GRNL w p 1",
  "accepted": [
   "7b6b"
  ],
  "best": "7b6b",
  "pv": [
   "7b6b",
   "4f3e",
   "2d5d",
   "2i3g",
   "2f2g+"
  ],
  "cpuB": 17.5
 },
 {
  "id": "st-save-129",
  "type": "save",
  "sfen": "lngSkg1nl/9/1p2spprp/p1Pp5/1N2p1S2/1B1B2Pp1/PP1PPP2P/3K5/L1SG1GRNL w Pp 1",
  "accepted": [
   "5a6a"
  ],
  "best": "5a6a",
  "pv": [
   "5a6a",
   "8e7c+"
  ],
  "cpuB": 48
 },
 {
  "id": "st-tactic-130",
  "type": "tactic",
  "sfen": "ln3r1nl/4k1g2/pppg2s2/3ppppp1/8p/2PP1P1R1/PPSGPSP2/3KG4/LN5NL b S2b2p 1",
  "accepted": [
   "S*8b"
  ],
  "best": "S*8b",
  "pv": [
   "S*8b",
   "3b2c",
   "8b9a",
   "5b4b",
   "9a8b+",
   "4b3b",
   "8b8c"
  ],
  "cpuB": 26.5
 },
 {
  "id": "st-save-131",
  "type": "save",
  "sfen": "ln3r1nl/1S2k1g2/p1pg2s2/1p1ppppp1/8p/2PP1P1R1/PPSGPSP2/2K1G4/LN5NL w 2b2p 1",
  "accepted": [
   "9a9b"
  ],
  "best": "9a9b",
  "pv": [
   "9a9b"
  ],
  "cpuB": 30.75
 },
 {
  "id": "st-tactic-132",
  "type": "tactic",
  "sfen": "+Sn3r1nl/l4kg2/1bpg2s2/pp1ppppp1/8p/2PPPPPR1/PPSG1S3/2K1G4/LN5NL b b2p 1",
  "accepted": [
   "9a8a"
  ],
  "best": "9a8a",
  "pv": [
   "9a8a",
   "4a8a",
   "N*7e",
   "8c7d",
   "7e6c+",
   "7d6c",
   "2i3g"
  ],
  "cpuB": 28
 },
 {
  "id": "st-save-133",
  "type": "save",
  "sfen": "+S4r1nl/l4kg2/nbpg2s2/pp1ppppp1/8p/P1PPPPPR1/1PSG1S3/2K1G4/LN5NL b b2p 1",
  "accepted": [
   "9a9b"
  ],
  "best": "9a9b",
  "pv": [
   "9a9b",
   "8c9b",
   "9f9e",
   "9c8e",
   "7g8f",
   "1e1f",
   "9e9d"
  ],
  "cpuB": 8.5
 },
 {
  "id": "st-take-134",
  "type": "take",
  "sfen": "5r1nl/+S4kg2/nbpg2s2/pp1ppppp1/8p/P1PPPPPR1/1PSG1S3/2K1G4/LN5NL w Lb2p 1",
  "accepted": [
   "8c9b"
  ],
  "best": "8c9b",
  "pv": [
   "8c9b",
   "9f9e"
  ],
  "cpuB": 2.5
 },
 {
  "id": "st-take-135",
  "type": "take",
  "sfen": "5r1nl/5kg2/L1pg2s2/ppbppppp1/P1P5p/3PPPPR1/1P+nG1S3/2K1G4/LN5NL b b2s2p 1",
  "accepted": [
   "8i7g"
  ],
  "best": "8i7g",
  "pv": [
   "8i7g",
   "7d8c",
   "2i3g",
   "7c7d",
   "9e9d",
   "7d7e",
   "P*2e"
  ],
  "cpuB": 11.5
 },
 {
  "id": "st-save-136",
  "type": "save",
  "sfen": "ln1g3nl/1r1s1kg2/p1pp1pspp/4p1p2/1p2B4/2PP3P1/PPS1PPP1P/1G5R1/LN2KGSNL b b 1",
  "accepted": [
   "5e4f"
  ],
  "best": "5e4f",
  "pv": [
   "5e4f",
   "6b5c",
   "5i6h",
   "3c4d",
   "3i4h"
  ],
  "cpuB": 6
 },
 {
  "id": "st-take-137",
  "type": "take",
  "sfen": "ln4knl/2gs2g2/p1p1ppsPp/1r1p1Bp2/9/1pP3P2/PP1PPPN1P/2GS1S3/LN2KG1RL w Bp 1",
  "accepted": [
   "4c4d"
  ],
  "best": "4c4d",
  "pv": [
   "4c4d",
   "8g8f",
   "8d8f",
   "P*8g",
   "8f7f",
   "8i7g",
   "3a4b"
  ],
  "cpuB": 22.5
 },
 {
  "id": "st-save-138",
  "type": "save",
  "sfen": "ln5nl/2gs1kgB1/p1p1pp1Pp/1r1p1sp2/9/1PP3P2/P2PPPN1P/2GS1S3/LN2KG1RL w Pbp 1",
  "accepted": [
   "B*3c"
  ],
  "best": "B*3c",
  "pv": [
   "B*3c",
   "2b3c+",
   "4d3c",
   "3g4e",
   "P*2h",
   "2i2h",
   "B*5e"
  ],
  "cpuB": 32.75
 },
 {
  "id": "st-save-139",
  "type": "save",
  "sfen": "ln5n+P/2gs1k3/p1p1pp2p/3p1sp2/1r6b/2P3P2/PG1PPPN1P/2GS1S3/LN2KG1RL w LPb2p 1",
  "accepted": [
   "P*2f"
  ],
  "best": "P*2f",
  "pv": [
   "P*2f",
   "8i7g",
   "B*8i",
   "7g8e",
   "8i7h+",
   "R*2b",
   "G*3b"
  ],
  "cpuB": 27.75
 },
 {
  "id": "st-save-140",
  "type": "save",
  "sfen": "ln6+P/2gs1k3/p1p1ppn1p/1r1p1sp2/2B5P/1PP3Pp1/PG1PPPNb1/2GS1S3/LN2KG1RL w Lp 1",
  "accepted": [
   "8d8b"
  ],
  "best": "8d8b",
  "pv": [
   "8d8b",
   "L*4f",
   "2g3f+"
  ],
  "cpuB": 20.25
 },
 {
  "id": "st-take-141",
  "type": "take",
  "sfen": "ln6+P/1rgs1k3/ppp1ppn1p/1L1p2p2/2B3s1P/1PP4p1/PG1PPPNb1/2GS1S3/LN1K1G1RL w p 1",
  "accepted": [
   "8c8d"
  ],
  "best": "8c8d",
  "pv": [
   "8c8d",
   "1a1b",
   "2g4i+",
   "2i4i"
  ],
  "cpuB": 33
 },
 {
  "id": "st-save-142",
  "type": "save",
  "sfen": "ln6+P/1rgs1k3/pLp1ppn1p/3p+b1p2/2B3s1P/1PP4p1/PG1PPPN2/2GS1S3/LN1K1G1RL w Pp 1",
  "accepted": [
   "8b8c"
  ],
  "best": "8b8c",
  "pv": [
   "8b8c",
   "4i3h",
   "6d6e",
   "1a1b",
   "L*7d",
   "1b1c",
   "7d7e"
  ],
  "cpuB": 12.25
 },
 {
  "id": "st-take-143",
  "type": "take",
  "sfen": "ln6+P/2gs1k3/pr2pp+B1p/2p1+b1p1P/3p2s2/1PP4p1/PG1PPPNl1/2GS1S1P1/LN1K1G1RL w Np 1",
  "accepted": [
   "4b3c"
  ],
  "best": "4b3c",
  "pv": [
   "4b3c",
   "4i3h",
   "1c1d",
   "2h2g",
   "2f2g+",
   "3h2g",
   "B*3h"
  ],
  "cpuB": 4.5
 },
 {
  "id": "st-take-144",
  "type": "take",
  "sfen": "ln6+P/2g6/prs1pk2+P/2p1+bpp2/3p2s2/1PP3bp1/P1GPPPNl1/2GS1SGP1/LN1K2NRL b Pp 1",
  "accepted": [
   "2h2g"
  ],
  "best": "2h2g",
  "pv": [
   "2h2g",
   "7d7e",
   "7f7e",
   "7c6d",
   "2g2f",
   "6d7e",
   "P*7f"
  ],
  "cpuB": 20.25
 },
 {
  "id": "st-tactic-145",
  "type": "tactic",
  "sfen": "ln6+P/2g6/prs1pk2+P/2p1+bpp2/1p1p2s2/1PP3bp1/P1GPPPNP1/2GS1SG2/LN1K2NRL b LP 1",
  "accepted": [
   "8f8e"
  ],
  "best": "8f8e",
  "pv": [
   "8f8e",
   "4c5b",
   "2g2f",
   "5b6b",
   "1c2c",
   "4d4e",
   "3h2g"
  ],
  "cpuB": 48
 },
 {
  "id": "st-take-146",
  "type": "take",
  "sfen": "ln6+P/2gk5/pr2p3+P/2Ps+bpp2/1P1p2s2/6b2/PLGPPPN+p1/2GS1SGR1/LN1K2N1L b 3Pp 1",
  "accepted": [
   "3h2g"
  ],
  "best": "3h2g",
  "pv": [
   "3h2g",
   "3f2g+",
   "3i2g",
   "3e2f",
   "8e8d",
   "8c6c"
  ],
  "cpuB": 12.25
 },
 {
  "id": "st-save-147",
  "type": "save",
  "sfen": "lns1k2nl/1r2gsgb1/p1ppppppp/9/9/1pP1P4/PPSP1PPPP/1B2RS3/LN1GKG1NL b - 1",
  "accepted": [
   "7g8f",
   "8g8f"
  ],
  "best": "7g8f",
  "pv": [
   "7g8f",
   "7a6b",
   "6i7h",
   "5a4a",
   "3g3f",
   "5c5d",
   "4h3g"
  ],
  "cpuB": 10
 },
 {
  "id": "st-tactic-148",
  "type": "tactic",
  "sfen": "ln2k1snl/3s1ggb1/1rpp1pppp/p3p4/2B6/1SP1R4/PP1P1PPPP/5SG2/LN1GK2NL w Pp 1",
  "accepted": [
   "3c3d"
  ],
  "best": "3c3d",
  "pv": [
   "3c3d",
   "5f5d",
   "P*5c",
   "5d8d",
   "8c8d",
   "7e8d",
   "2b9i+"
  ],
  "cpuB": 26.25
 },
 {
  "id": "st-save-149",
  "type": "save",
  "sfen": "ln3ksnl/3s1gg2/1rpp1p1pp/4R1p2/1p7/P1PB5/1P1P1PPPP/L2S1SG2/+bN1GK2NL w 3P 1",
  "accepted": [
   "9i6f"
  ],
  "best": "9i6f",
  "pv": [
   "9i6f",
   "6g6f",
   "8e8f",
   "B*5f",
   "8c8b",
   "8i7g",
   "B*8h"
  ],
  "cpuB": 12.75
 },
 {
  "id": "st-take-150",
  "type": "take",
  "sfen": "ln3ksnl/3s1gg2/1rpp1p1pp/4R1p2/1p7/P1P+b5/1P1P1PPPP/L2S1SG2/1N1GK2NL b 3Pb 1",
  "accepted": [
   "6g6f"
  ],
  "best": "6g6f",
  "pv": [
   "6g6f",
   "8e8f",
   "B*5f",
   "8c8b",
   "5i4i",
   "6b5c",
   "5d3d"
  ],
  "cpuB": 4.5
 },
 {
  "id": "st-defend-151",
  "type": "defend",
  "sfen": "ln3ksnl/3s1gg2/1+Bpp1p1pp/6p2/1p7/P1bP5/1P3PPPP/L2S1SG2/1N1GK2NL b R3Prp 1",
  "accepted": [
   "3h3i",
   "P*5h"
  ],
  "best": "3h3i",
  "pv": [
   "3h3i",
   "R*8h",
   "R*6a",
   "6b5a",
   "8c5f",
   "8h9h+",
   "6a8a+"
  ],
  "cpuB": 48
 },
 {
  "id": "st-take-152",
  "type": "take",
  "sfen": "ln1r1ksnl/3sg1g2/1+Bpp1p+bpp/6p2/1p7/P8/1P1PSPPPP/L1S1P1G2/1N1GK2NL b Pr2p 1",
  "accepted": [
   "8c6a"
  ],
  "best": "8c6a",
  "pv": [
   "8c6a",
   "5b5a",
   "6a5a",
   "6b5a",
   "R*8b",
   "8a9c"
  ],
  "cpuB": 6.5
 },
 {
  "id": "st-save-153",
  "type": "save",
  "sfen": "ln2rksnl/r1+Bsg1g2/2pp1p1pp/5+bp2/1p7/P2S5/1P1P1PPPP/L1S1PKG2/1N1G3NL b P2p 1",
  "accepted": [
   "7b8c"
  ],
  "best": "7b8c",
  "pv": [
   "7b8c",
   "9b9d",
   "9f9e",
   "9d5d",
   "9e9d",
   "2a3c",
   "9d9c+"
  ],
  "cpuB": 5.25
 },
 {
  "id": "st-tactic-154",
  "type": "tactic",
  "sfen": "ln2rksnl/3sg1g2/1+Bpp1p1pp/r4+bp2/1p7/P2S5/1P1P1PPPP/L1S1PKG2/1N1G3NL b P2p 1",
  "accepted": [
   "8c9d"
  ],
  "best": "8c9d",
  "pv": [
   "8c9d",
   "9a9d",
   "9f9e",
   "9d9e",
   "9h9e",
   "P*9g",
   "L*5g"
  ],
  "cpuB": 14
 },
 {
  "id": "st-take-155",
  "type": "take",
  "sfen": "ln2rksnl/3sg1g2/2pp1p1pp/+B4+bp2/1p7/P2S5/1P1P1PPPP/L1S1PKG2/1N1G3NL w RP2p 1",
  "accepted": [
   "9a9d"
  ],
  "best": "9a9d",
  "pv": [
   "9a9d",
   "9f9e",
   "9d9e",
   "9h9e",
   "P*9g",
   "L*5g",
   "9g9h+"
  ],
  "cpuB": 5.25
 },
 {
  "id": "st-save-156",
  "type": "save",
  "sfen": "1n2rksnl/3sg1g2/2pp1p1pp/lR3+bp2/1p7/P8/1PSP1PPPP/LbS1PKG2/1N1G3NL w P2p 1",
  "accepted": [
   "8h9i+"
  ],
  "best": "8h9i+",
  "pv": [
   "8h9i+",
   "8d9d",
   "8e8f",
   "7g8f",
   "9i9h",
   "9d9b+",
   "P*9a"
  ],
  "cpuB": 8.25
 },
 {
  "id": "st-tactic-157",
  "type": "tactic",
  "sfen": "1n2rksnl/1l2g1g2/2pp1p1pp/5sp2/1p7/P2S4P/1PNP1PPP1/+b1S1PKG2/1L1G3NL b BPr2p 1",
  "accepted": [
   "P*7d"
  ],
  "best": "P*7d",
  "pv": [
   "P*7d",
   "7c7d",
   "B*9e",
   "3b4b",
   "9e5a+",
   "5b5a",
   "R*7a"
  ],
  "cpuB": 48
 },
 {
  "id": "st-save-158",
  "type": "save",
  "sfen": "1n2rksnl/1l2g1g2/2p2p1pp/r2p1sp2/1pSB5/PP6P/+bSNP1PPP1/4PKG2/1L1G3NL b P2p 1",
  "accepted": [
   "6e7f"
  ],
  "best": "6e7f",
  "pv": [
   "6e7f",
   "7c7d",
   "7e6d",
   "3a4b",
   "4h3i"
  ],
  "cpuB": 20.25
 },
 {
  "id": "st-tactic-159",
  "type": "tactic",
  "sfen": "1n2rk1nl/1l2gsg2/2p2p1pp/r2p1sp2/1pS6/PPB5P/+bSNP1PPP1/4PKG2/1L1G3NL b P2p 1",
  "accepted": [
   "7g8e"
  ],
  "best": "7g8e",
  "pv": [
   "7g8e",
   "7c7d",
   "7e6d",
   "4a3a",
   "8e7c+",
   "9d9b",
   "7c7d"
  ],
  "cpuB": 31
 },
 {
  "id": "st-tactic-160",
  "type": "tactic",
  "sfen": "ln2r3l/1kg1g4/pp1pbpnpp/2p1s1p2/4p4/Ps3PP2/2PPPK1PP/R2G3G1/LNB1S1SNL b p 1",
  "accepted": [
   "5i4h"
  ],
  "best": "5i4h",
  "pv": [
   "5i4h",
   "8f8g+",
   "9h8h",
   "3d3e",
   "8h8g",
   "3e3f",
   "4g3f"
  ],
  "cpuB": 48
 },
 {
  "id": "st-save-161",
  "type": "save",
  "sfen": "ln2r3l/1kg1g4/pp1pbpnpp/2p1s1p2/4p4/P4PP2/1+sPPP2PP/R2G2KG1/LNB1S1SNL b p 1",
  "accepted": [
   "9h8h"
  ],
  "best": "9h8h",
  "pv": [
   "9h8h",
   "8g8h",
   "7i8h",
   "2c2d",
   "5i4h",
   "2d2e",
   "2h3g"
  ],
  "cpuB": 29.5
 },
 {
  "id": "st-take-162",
  "type": "take",
  "sfen": "ln2r3l/1kg1g4/pp1pbpnpp/2p1s1p2/9/P4PP2/2PP+p1KPP/L2G1S1G1/1NB1SrSNL b 2p 1",
  "accepted": [
   "6h5g"
  ],
  "best": "6h5g",
  "pv": [
   "6h5g",
   "P*5f",
   "5g5f",
   "P*5e",
   "3g3h",
   "4i5i+",
   "4h5i"
  ],
  "cpuB": 11.5
 },
 {
  "id": "st-save-163",
  "type": "save",
  "sfen": "ln2r3l/1kg1g4/pp1pbpnpp/2p1s1p2/9/P4PP2/2PPG1KPP/L1s4G1/1NB1S1SNL b RP2p 1",
  "accepted": [
   "7i9g"
  ],
  "best": "7i9g",
  "pv": [
   "7i9g",
   "3c2e",
   "3g3h",
   "5c9g+",
   "9h9g"
  ],
  "cpuB": 13
 },
 {
  "id": "st-tactic-164",
  "type": "tactic",
  "sfen": "ln1g1g1nl/4k1sp1/1rp1sp2p/p2pp1pPb/1pB6/2PPP1PR1/PPS2PN1P/2G1GS3/LN2K3L w - 1",
  "accepted": [
   "7c7d"
  ],
  "best": "7c7d",
  "pv": [
   "7c7d",
   "3g4e",
   "7d7e",
   "4e5c+",
   "8c5c",
   "7f7e",
   "B*4d"
  ],
  "cpuB": 11
 },
 {
  "id": "st-save-165",
  "type": "save",
  "sfen": "ln1g1g1nl/4k1sp1/1r2sp2p/p1ppp1pPb/1pB6/2PPP1PR1/PPS2PN1P/2G1GS3/LN2K3L b - 1",
  "accepted": [
   "1g1f"
  ],
  "best": "1g1f",
  "pv": [
   "1g1f",
   "7d7e",
   "1f1e",
   "7e7f",
   "1e1d",
   "7f7g+",
   "B*7d"
  ],
  "cpuB": 33
 },
 {
  "id": "st-take-166",
  "type": "take",
  "sfen": "ln1g1g1nl/4k1sp1/1r2sp2p/p1ppp1pPb/1pB2N3/2PPP1PR1/PPS2P2P/2G1GS3/LN2K3L w - 1",
  "accepted": [
   "7d7e"
  ],
  "best": "7d7e",
  "pv": [
   "7d7e",
   "4e5c+",
   "8c5c"
  ],
  "cpuB": 10.5
 },
 {
  "id": "st-tactic-167",
  "type": "tactic",
  "sfen": "ln1g1g1nl/6sp1/1r2kp2p/p2pp1pPb/1p5Sb/2pPP1P2/PPS2P2P/2G1GS1R1/LN2K3L b np 1",
  "accepted": [
   "7g7f"
  ],
  "best": "7g7f",
  "pv": [
   "7g7f",
   "8c7c",
   "P*7e",
   "2a3c",
   "2e1d",
   "1c1d"
  ],
  "cpuB": 11.25
 },
 {
  "id": "st-save-168",
  "type": "save",
  "sfen": "ln1g1g1nl/6sp1/1r2kp2p/p2pp1pPb/1p5Sb/2pPP1P2/PP3P2P/1SG1GS1R1/LN2K3L w np 1",
  "accepted": [
   "2a3c",
   "3d3e"
  ],
  "best": "2a3c",
  "pv": [
   "2a3c",
   "2e1d",
   "1c1d",
   "1g1f",
   "S*3g",
   "2h2i",
   "3g3h+"
  ],
  "cpuB": 48
 },
 {
  "id": "st-take-169",
  "type": "take",
  "sfen": "ln1g1g1nl/6sp1/1r2k3p/p2ppppPS/1p6b/2pPP1P2/PP3P2P/1SG1GS1R1/LN2K3L w Bnp 1",
  "accepted": [
   "1c1d"
  ],
  "best": "1c1d",
  "pv": [
   "1c1d",
   "1g1f",
   "S*3g",
   "2h2g",
   "3g4h+",
   "5h4h",
   "1e4h+"
  ],
  "cpuB": 6
 },
 {
  "id": "st-save-170",
  "type": "save",
  "sfen": "ln1g1s1nl/7p1/4k4/pr1ppppPp/1p6b/3PP1P1P/PPS2Pb2/2G1GS1R1/LN2K3L b GPsnp 1",
  "accepted": [
   "2h2i"
  ],
  "best": "2h2i",
  "pv": [
   "2h2i",
   "S*2h",
   "1f1e",
   "3g4h+",
   "5h4h",
   "2h2i+",
   "B*3a"
  ],
  "cpuB": 19.25
 },
 {
  "id": "st-take-171",
  "type": "take",
  "sfen": "ln1g1s1nl/7p1/4k4/pr1ppppPp/1p6b/3PP1P1P/PPS2Pb2/2G1GSR2/LN2K3L w GPsnp 1",
  "accepted": [
   "3g4h+"
  ],
  "best": "3g4h+",
  "pv": [
   "3g4h+",
   "3h4h",
   "1e4h+",
   "5i4h",
   "N*4e"
  ],
  "cpuB": 17.25
 },
 {
  "id": "st-take-172",
  "type": "take",
  "sfen": "ln1g1s1nl/7p1/4k4/pr1ppppPp/1p3n2P/3PP1P2/PPS2P3/2GKGS1+b1/LN4R2 w BGPslp 1",
  "accepted": [
   "2h3i"
  ],
  "best": "2h3i",
  "pv": [
   "2h3i",
   "4h3i",
   "R*4i",
   "G*7e",
   "S*6i",
   "7e8d"
  ],
  "cpuB": 26.5
 },
 {
  "id": "st-save-173",
  "type": "save",
  "sfen": "ln1g1s1nl/7p1/4k4/pr1ppppPp/1pB2n2P/3PP1P2/PPS2P3/2GKGS+s+b1/LNR6 w GPlp 1",
  "accepted": [
   "8d7d"
  ],
  "best": "8d7d",
  "pv": [
   "8d7d",
   "P*7f",
   "5c4c",
   "6f6e",
   "8a7c",
   "7e6d",
   "7d6d"
  ],
  "cpuB": 9.75
 },
 {
  "id": "st-take-174",
  "type": "take",
  "sfen": "ln1g1s1nl/7p1/2l1k4/p2ppppPp/1prG1n2P/2SPP1P2/PP3P3/2GKGS+s+b1/LNR6 b Pbp 1",
  "accepted": [
   "6e7e"
  ],
  "best": "6e7e",
  "pv": [
   "6e7e",
   "B*2f",
   "4h5i",
   "7c7e",
   "R*8c",
   "5c4b",
   "7f7e"
  ],
  "cpuB": 9.5
 },
 {
  "id": "st-save-175",
  "type": "save",
  "sfen": "ln1g1s1nl/7p1/2l1k4/p2ppppPp/b1G2n2P/1pSPP1P2/PPN2P3/2GKGS+s+b1/L1R6 b RPp 1",
  "accepted": [
   "P*7d"
  ],
  "best": "P*7d",
  "pv": [
   "P*7d",
   "5d5e",
   "7d7c+",
   "8a7c",
   "5f5e",
   "3h4h",
   "5h4h"
  ],
  "cpuB": 17.5
 },
 {
  "id": "st-take-176",
  "type": "take",
  "sfen": "ln1g1s1nl/7p1/2l1k4/p1PppppPp/b1G2n2P/2SPP1P2/P+pN2P3/2GKGS+s+b1/L1R6 b R2p 1",
  "accepted": [
   "7f8g"
  ],
  "best": "7f8g",
  "pv": [
   "7f8g",
   "P*8f",
   "8g7f",
   "3h4h",
   "5h4h",
   "S*8g",
   "7d7c+"
  ],
  "cpuB": 16.5
 },
 {
  "id": "st-take-177",
  "type": "take",
  "sfen": "ln1g1s1nl/7p1/2l1k4/p1PppppPp/b1G2n2P/3PP1P2/PSN2P3/2GKG+s1+b1/L1R6 b R2Psp 1",
  "accepted": [
   "5h4h"
  ],
  "best": "5h4h",
  "pv": [
   "5h4h",
   "5d5e",
   "7d7c+",
   "8a7c",
   "R*3a",
   "S*5g",
   "4h5g"
  ],
  "cpuB": 11
 },
 {
  "id": "st-tactic-178",
  "type": "tactic",
  "sfen": "ln1g1s1nl/7p1/2l1k4/p1PppppPp/b1G5P/3PP1P2/PSN2P+n2/2GK1G1+b1/L1R6 b RS2Psp 1",
  "accepted": [
   "4h5h"
  ],
  "best": "4h5h",
  "pv": [
   "4h5h",
   "7c7d",
   "7e7d",
   "4a5b",
   "R*3a"
  ],
  "cpuB": 17.5
 },
 {
  "id": "st-save-179",
  "type": "save",
  "sfen": "ln1g1s1nl/7p1/2l1k4/p1PppppPp/b1G5P/Sp1PP1P2/P1N2P+n2/2GKG2+b1/L1R6 w RS2Ps 1",
  "accepted": [
   "8f8g+"
  ],
  "best": "8f8g+",
  "pv": [
   "8f8g+",
   "9f8g",
   "5c4b",
   "7d7c+",
   "9e7c",
   "P*7d",
   "7c5a"
  ],
  "cpuB": 48
 },
 {
  "id": "st-take-180",
  "type": "take",
  "sfen": "ln1g1s1nl/7p1/2l1k4/p1PppppPp/b1G5P/Ss1PP1P2/PGN2P+n2/3KG2+b1/L1R6 b RS3P 1",
  "accepted": [
   "7d7c+"
  ],
  "best": "7d7c+",
  "pv": [
   "7d7c+",
   "8f8g+",
   "R*6c",
   "5c4b",
   "9f8g",
   "4a5b",
   "S*5c"
  ],
  "cpuB": 25
 },
 {
  "id": "st-save-181",
  "type": "save",
  "sfen": "l2g1s1nl/7p1/2n1k4/p2ppppPp/2G5P/SbRPP1P2/P1N2P+n2/3KG2+b1/L1R6 w 2SL3Pgp 1",
  "accepted": [
   "P*8e"
  ],
  "best": "P*8e",
  "pv": [
   "P*8e",
   "L*8i",
   "2h3h",
   "8i8f"
  ],
  "cpuB": 15.25
 },
 {
  "id": "st-take-182",
  "type": "take",
  "sfen": "l2g1s1nl/7p1/2n1k4/p2ppppPp/1pb5P/S1RPP1P2/PLN2P+n2/3KG2+b1/L1R6 b 2S3P2g 1",
  "accepted": [
   "7f7e"
  ],
  "best": "7f7e",
  "pv": [
   "7f7e",
   "G*6c",
   "7g8e",
   "7c8e",
   "7e8e",
   "3g3f",
   "P*7d"
  ],
  "cpuB": 3.5
 },
 {
  "id": "st-save-183",
  "type": "save",
  "sfen": "l2g1s1nl/7p1/2ngk4/p2ppppPp/1pR5P/S2PP1P2/PLN2P+n2/3KG2+b1/L1R3S2 w BS3Pg 1",
  "accepted": [
   "2h1g",
   "2h2i",
   "2h3i"
  ],
  "best": "2h1g",
  "pv": [
   "2h1g",
   "7g8e",
   "7c8e",
   "7e8e",
   "G*8h",
   "N*7e",
   "8h7i"
  ],
  "cpuB": 13
 },
 {
  "id": "st-save-184",
  "type": "save",
  "sfen": "ln4snl/1r2g1kb1/p1pp1pg1p/6pP1/4p1s2/1PP4R1/PGBPPPP1P/2KS1S3/LN4GNL b 2P 1",
  "accepted": [
   "2f2h",
   "2f2g"
  ],
  "best": "2f2h",
  "pv": [
   "2f2h",
   "3e2d",
   "3g3f",
   "1c1d",
   "4h3g",
   "P*8e",
   "8f8e"
  ],
  "cpuB": 10.5
 },
 {
  "id": "st-save-185",
  "type": "save",
  "sfen": "ln4snl/1r4kb1/p1ppgpg1p/7P1/4p1p2/1PP3sR1/PGBPPP2P/2KS1S3/LN4GNL b 2Pp 1",
  "accepted": [
   "P*3d"
  ],
  "best": "P*3d",
  "pv": [
   "P*3d",
   "3c2d",
   "2f2d",
   "P*2c",
   "2d2h"
  ],
  "cpuB": 22
 },
 {
  "id": "st-take-186",
  "type": "take",
  "sfen": "ln4snl/1r5G1/p1ppgp2p/6kP1/4p1pp1/1PP3sR1/PGBPPP2P/2KS1S3/LN4GNL w BPp 1",
  "accepted": [
   "3a2b"
  ],
  "best": "3a2b",
  "pv": [
   "3a2b",
   "2f2h",
   "5c4d",
   "3i3h",
   "G*5h",
   "4h3g",
   "P*8e"
  ],
  "cpuB": 15.5
 },
 {
  "id": "st-save-187",
  "type": "save",
  "sfen": "ln1gk2nl/1r4g2/p1pspp1pp/3p1sp2/1p3N1P1/2P3P2/PPGPPP2P/3K2SR1/LNS2G2L b Bb 1",
  "accepted": [
   "4g4f"
  ],
  "best": "4g4f",
  "pv": [
   "4g4f",
   "B*5e",
   "B*3g",
   "2a3c",
   "4e3c+",
   "4d3c",
   "7i8h"
  ],
  "cpuB": 24.5
 },
 {
  "id": "st-save-188",
  "type": "save",
  "sfen": "ln2k2nl/1r2g1g2/p1pspp1pp/3p1s3/1p2bNPP1/2P1PP3/PPGP2B1P/3K2SR1/LNS2G2L w P 1",
  "accepted": [
   "5e7g+"
  ],
  "best": "5e7g+",
  "pv": [
   "5e7g+",
   "8i7g",
   "8e8f",
   "3g1e",
   "2a3c",
   "8g8f",
   "8b8f"
  ],
  "cpuB": 9.25
 },
 {
  "id": "st-take-189",
  "type": "take",
  "sfen": "ln2k2nl/2r1g1g2/p1ps+Bp1pp/3p5/1p3NsP1/2P1PP3/PPKP2B1P/6SR1/LNS2G2L w 2Pgp 1",
  "accepted": [
   "5b5c"
  ],
  "best": "5b5c",
  "pv": [
   "5b5c",
   "4e5c+",
   "B*4d",
   "7g7h",
   "4d5c",
   "P*3f",
   "3e4d"
  ],
  "cpuB": 1
 },
 {
  "id": "st-save-190",
  "type": "save",
  "sfen": "ln2k2nl/2r3g2/p1psgp1pp/3p5/1p3NsP1/2P1PP3/PPKP2B1P/6SR1/LNS2G2L b 2Pbgp 1",
  "accepted": [
   "4e5c+"
  ],
  "best": "4e5c+",
  "pv": [
   "4e5c+",
   "B*4d",
   "7g7h",
   "4d5c",
   "P*3f",
   "3e4d",
   "3h4g"
  ],
  "cpuB": 15.5
 },
 {
  "id": "st-tactic-191",
  "type": "tactic",
  "sfen": "ln2+B2nl/2r3g2/p1pskp1pp/3p5/1p4sP1/2P1PP3/PP1Pb3P/1K4SR1/LNS2G2L w G2Pgnp 1",
  "accepted": [
   "G*6i"
  ],
  "best": "G*6i",
  "pv": [
   "G*6i",
   "G*7h",
   "5g4f+",
   "P*3f",
   "3e3f",
   "2e2d",
   "4f2h"
  ],
  "cpuB": 48
 },
 {
  "id": "st-take-192",
  "type": "take",
  "sfen": "ln3R2l/2skg1g2/p1p2pnpp/3p5/2N3sP1/1PP1+b4/P2Pg1P1P/1S2b1SR1/LN4K1L b G3P2p 1",
  "accepted": [
   "4a1a+",
   "P*4h"
  ],
  "best": "4a1a+",
  "pv": [
   "4a1a+",
   "P*3a",
   "L*3f",
   "3e3f",
   "3g3f",
   "6b5c",
   "P*5d"
  ],
  "cpuB": 48
 },
 {
  "id": "st-tactic-193",
  "type": "tactic",
  "sfen": "ln3R2l/2skg1g2/p1p2pnpp/3p5/2N3sP1/1PPG1+b3/P2Pg1P1P/1S2b1SR1/LN4K1L b 3P2p 1",
  "accepted": [
   "P*5c"
  ],
  "best": "P*5c",
  "pv": [
   "P*5c",
   "6b5c",
   "P*5d",
   "5c6b",
   "4a1a+"
  ],
  "cpuB": 48
 },
 {
  "id": "st-tactic-194",
  "type": "tactic",
  "sfen": "lns2gs1l/1r2gk1b1/p1p2p2p/1p1p2p2/4pn1p1/2PB2P2/PPNPPP1PP/2GSG1RS1/L2K3NL b - 1",
  "accepted": [
   "4g4f"
  ],
  "best": "4g4f",
  "pv": [
   "4g4f",
   "4e5g",
   "6h5g",
   "7c7d",
   "3f3e"
  ],
  "cpuB": 28.75
 },
 {
  "id": "st-take-195",
  "type": "take",
  "sfen": "ln2g1s1l/1s1rgk1b1/p1p2p2p/1B1p2p2/4p2p1/2P3P2/PPNPPPnPP/2GS1GRS1/L1K5L b Pn 1",
  "accepted": [
   "2h3g"
  ],
  "best": "2h3g",
  "pv": [
   "2h3g",
   "4b4a",
   "3g4f",
   "8b8c",
   "8d6f",
   "N*5d"
  ],
  "cpuB": 26.5
 },
 {
  "id": "st-take-196",
  "type": "take",
  "sfen": "ln2g1s1l/2r1gk1b1/pspn4p/1B1p1pp2/4p2p1/N1P3P2/PPNPPPSPP/LG1SG1R2/2K5L w P 1",
  "accepted": [
   "8c8d"
  ],
  "best": "8c8d",
  "pv": [
   "8c8d",
   "9f8d",
   "7b8b",
   "3f3e",
   "3a3b",
   "3e3d",
   "8b8d"
  ],
  "cpuB": 11.75
 },
 {
  "id": "st-tactic-197",
  "type": "tactic",
  "sfen": "ln2g1s1l/3rg2b1/p1pn1k2p/1N1P1pp2/b3p2p1/2P3P2/PPN1PPSPP/LG1SG1R2/2K5L b S2P 1",
  "accepted": [
   "S*8e",
   "3f3e"
  ],
  "best": "S*8e",
  "pv": [
   "S*8e",
   "6b8b",
   "3f3e",
   "9e8d",
   "6d6c+",
   "5b6c",
   "3e3d"
  ],
  "cpuB": 35
 },
 {
  "id": "st-tactic-198",
  "type": "tactic",
  "sfen": "ln1g3nl/1r2k1gb1/p1ppspp1p/4s4/5P1R1/1PP3P2/P1BSP1N1P/2GKG1S2/LN6L b 2P3p 1",
  "accepted": [
   "P*2d"
  ],
  "best": "P*2d",
  "pv": [
   "P*2d",
   "3c3d",
   "7g2b+",
   "3b2b",
   "2d2c+",
   "P*8h",
   "2c2b"
  ],
  "cpuB": 23.5
 },
 {
  "id": "st-take-199",
  "type": "take",
  "sfen": "ln5nl/1r3kg2/p1p1pgspp/3p1pp2/1p7/5PPR1/PP+sPP1N1P/2GB1S3/LN2KG2L b Pbsp 1",
  "accepted": [
   "6h7g"
  ],
  "best": "6h7g",
  "pv": [
   "6h7g",
   "4b3a",
   "4f4e",
   "S*7f",
   "7g6h",
   "4d4e",
   "5g5f"
  ],
  "cpuB": 10
 },
 {
  "id": "st-take-200",
  "type": "take",
  "sfen": "ln4knl/1r4g2/p1p1pgspp/3p1pp2/1p6b/5PPR1/PPBPPSN1P/2G6/LN2KG2L w 2SPp 1",
  "accepted": [
   "1e2f"
  ],
  "best": "1e2f",
  "pv": [
   "1e2f",
   "S*3h",
   "3a2b",
   "5i5h",
   "1c1d",
   "1g1f",
   "3c2d"
  ],
  "cpuB": 1.5
 },
 {
  "id": "st-take-201",
  "type": "take",
  "sfen": "ln4knl/1r4g2/p1p1pgspp/3p1pp2/1p7/5PP+r1/PPBPP1+b1P/2GK2S2/LN3GS1L b SPnp 1",
  "accepted": [
   "3h3g"
  ],
  "best": "3h3g",
  "pv": [
   "3h3g",
   "2f3g",
   "B*6c",
   "3g4f",
   "4i5i",
   "N*6e",
   "7g6f"
  ],
  "cpuB": 9.5
 },
 {
  "id": "st-take-202",
  "type": "take",
  "sfen": "l+S4knl/1+Br3g2/p1p1pgspp/3p1pp2/1p7/5P+r2/PPsPP3P/2GK1S3/LN3G2L b NPbn2p 1",
  "accepted": [
   "6h7g"
  ],
  "best": "6h7g",
  "pv": [
   "6h7g",
   "7b8b",
   "8a8b",
   "3a2b",
   "R*6a",
   "B*2g",
   "4i5i"
  ],
  "cpuB": 14
 },
 {
  "id": "st-take-203",
  "type": "take",
  "sfen": "l5knl/1+S4g2/p1p1pgspp/3p1pp2/1p7/5P+r2/PP1PP3P/2+bK1S3/LN3G2L b RSNPbgn2p 1",
  "accepted": [
   "6h7h"
  ],
  "best": "6h7h",
  "pv": [
   "6h7h",
   "3a2b"
  ],
  "cpuB": -0.75
 },
 {
  "id": "st-take-204",
  "type": "take",
  "sfen": "l5knl/1+S4g2/p1p1p1spp/3pgpp2/1pn1b4/2P2P+r2/PPSPP3P/2K2S3/LNg2G2L b RBN2p 1",
  "accepted": [
   "7h7i"
  ],
  "best": "7h7i",
  "pv": [
   "7h7i",
   "7e6g+",
   "G*7h",
   "6g7h",
   "7i7h",
   "5e4f",
   "8b9a"
  ],
  "cpuB": -10
 },
 {
  "id": "st-defend-205",
  "type": "defend",
  "sfen": "l5knl/1+S4g2/p1p1p1spp/3pgpp2/1p7/2P2P+r2/PP+b+nP3P/2G2S3/LNK2G2L b RBNs3p 1",
  "accepted": [
   "8i7g"
  ],
  "best": "8i7g",
  "pv": [
   "8i7g",
   "S*6f",
   "R*5a",
   "3a2b",
   "B*4a",
   "6g7h",
   "7i7h"
  ],
  "cpuB": 11
 },
 {
  "id": "st-take-206",
  "type": "take",
  "sfen": "l1R4nl/1+S4gk1/p1p1p1spp/3pgpp2/1p7/2Ps1P+r2/PPN+nP3P/2G1BS3/L1K2G2L w BN3p 1",
  "accepted": [
   "6g5h"
  ],
  "best": "6g5h",
  "pv": [
   "6g5h",
   "4i5h",
   "B*4i",
   "7i6i",
   "4d4e",
   "8b9a"
  ],
  "cpuB": 9.5
 },
 {
  "id": "st-tactic-207",
  "type": "tactic",
  "sfen": "l1R4nl/1+S4gk1/p1p1p1spp/3pgpp2/1p7/2Ps1+r3/PPN1PB2P/2G1GS3/L1K2b2L b 2N4p 1",
  "accepted": [
   "4h5i"
  ],
  "best": "4h5i",
  "pv": [
   "4h5i",
   "4d4e",
   "N*2e",
   "6f5g+",
   "2e3c+",
   "2b3c",
   "N*2e"
  ],
  "cpuB": 48
 },
 {
  "id": "st-take-208",
  "type": "take",
  "sfen": "l1R4nl/1+S4gk1/p1p1p1spp/3pgpp2/1p7/2P2+r3/PP+s1PB2P/2GKGS3/L4b2L b 2Nn4p 1",
  "accepted": [
   "7h7g"
  ],
  "best": "7h7g",
  "pv": [
   "7h7g",
   "4i5h+",
   "6h5h",
   "N*3f",
   "4g3f",
   "4f3f",
   "S*4g"
  ],
  "cpuB": 8.5
 },
 {
  "id": "st-take-209",
  "type": "take",
  "sfen": "l1R4nl/1+S4gk1/p1p1p2p1/3pgppsp/1p1n+r2N1/2P3S2/PP2PB2P/2GKGS3/L4b2L w N4p 1",
  "accepted": [
   "2d2e"
  ],
  "best": "2d2e",
  "pv": [
   "2d2e",
   "3f2e",
   "N*6f",
   "S*6g",
   "6f7h+",
   "6g7h",
   "5e6f"
  ],
  "cpuB": 22
 },
 {
  "id": "st-take-210",
  "type": "take",
  "sfen": "l1R4nl/1+S4gk1/p1p1p2p1/3pgpp1p/1p3s1+r1/2PS5/PP1B+n3P/2G1K4/L7L b B2Ngs5p 1",
  "accepted": [
   "6f5g"
  ],
  "best": "6f5g",
  "pv": [
   "6f5g",
   "2e2h",
   "5h6i",
   "2h1i",
   "N*4i",
   "L*5e",
   "N*5i"
  ],
  "cpuB": 9
 },
 {
  "id": "st-take-211",
  "type": "take",
  "sfen": "ln1gk3l/1r1s1sg2/p3ppnpp/1ppp2B2/9/2P3P2/PP+bPPPSPP/4G2R1/LN1GK2NL b Ps 1",
  "accepted": [
   "8i7g"
  ],
  "best": "8i7g",
  "pv": [
   "8i7g",
   "S*8h",
   "6i7h",
   "8h9i+",
   "3d5f",
   "8d8e",
   "5f7d"
  ],
  "cpuB": -10
 },
 {
  "id": "st-tactic-212",
  "type": "tactic",
  "sfen": "ln2k3l/1r2gsg2/p3ppnpp/1ppps4/5sP2/2PB4B/PPNPPPSPP/4G2R1/L2GK2NL b P 1",
  "accepted": [
   "4g4f"
  ],
  "best": "4g4f",
  "pv": [
   "4g4f",
   "6d6e",
   "7g6e",
   "8b6b",
   "4f4e",
   "6b6e",
   "3e3d"
  ],
  "cpuB": 48
 },
 {
  "id": "st-take-213",
  "type": "take",
  "sfen": "ln2k3l/1r2gsg2/p3ppnpp/1pp1s4/3N1sP2/2PB4B/PP1PPPSPP/2G1G2R1/L3K2NL w 2P 1",
  "accepted": [
   "5d6e",
   "8d8e",
   "9c9d"
  ],
  "best": "5d6e",
  "pv": [
   "5d6e",
   "6f5e",
   "8b9b",
   "3e3d",
   "1c1d",
   "2g2f",
   "6e5d"
  ],
  "cpuB": 7.25
 },
 {
  "id": "st-take-214",
  "type": "take",
  "sfen": "ln2k3l/r3gsg2/p3pp+Ppp/1pp4n1/3sBs3/2P5B/PP1PPPSPP/2G1G2R1/L3K2NL w N2P 1",
  "accepted": [
   "4b3c"
  ],
  "best": "4b3c",
  "pv": [
   "4b3c",
   "1f2e"
  ],
  "cpuB": 16.75
 },
 {
  "id": "st-tactic-215",
  "type": "tactic",
  "sfen": "ln2k3l/r3gs3/p3p1gpp/1pp1sp1n1/5s1B1/2P2S3/PPBPPP1PP/2G1G2R1/L3K2NL w N2Pp 1",
  "accepted": [
   "4e4f"
  ],
  "best": "4e4f",
  "pv": [
   "4e4f",
   "4g4f",
   "S*3f",
   "2e5b+",
   "5a5b",
   "7g6f",
   "9b6b"
  ],
  "cpuB": 48
 },
 {
  "id": "st-take-216",
  "type": "take",
  "sfen": "ln2k3l/r3gs3/p3p1gpp/1pp1sp1n1/9/2P2SB2/PPBPPP1PP/2G1G2R1/L3K2NL w SN2Pp 1",
  "accepted": [
   "2d3f"
  ],
  "best": "2d3f",
  "pv": [
   "2d3f",
   "2h3h",
   "B*2h",
   "3h3f",
   "2h1i+",
   "P*3d",
   "3c4c"
  ],
  "cpuB": -0.75
 },
 {
  "id": "st-take-217",
  "type": "take",
  "sfen": "ln1gk1snl/1r1s2g2/p1ppppbpp/6pP1/9/1p7/PPPPPPPRP/1BG3S2/LNS1KG1NL w - 1",
  "accepted": [
   "8f8g+"
  ],
  "best": "8f8g+",
  "pv": [
   "8f8g+",
   "7h8g",
   "3c2d",
   "P*8f",
   "2d5g+",
   "7i6h",
   "5g3e"
  ],
  "cpuB": 16.5
 },
 {
  "id": "st-take-218",
  "type": "take",
  "sfen": "ln1gkg1nl/1r1s2s2/p1pppp1pp/6p2/1p5P1/2P6/PP1PPPP1P/1+bG4R1/LNS1KGSNL b b 1",
  "accepted": [
   "7i8h"
  ],
  "best": "7i8h",
  "pv": [
   "7i8h",
   "B*3c",
   "8h7g",
   "7c7d",
   "9g9f",
   "8a7c",
   "B*6f"
  ],
  "cpuB": 14
 },
 {
  "id": "st-take-219",
  "type": "take",
  "sfen": "ln1g3nl/1r1s1kg2/p1ppppspp/6p2/1p5P1/2Pb5/PP1PPPP1P/1G1SG4/LN2K1SNL b Br 1",
  "accepted": [
   "6g6f"
  ],
  "best": "6g6f",
  "pv": [
   "6g6f",
   "6c6d",
   "B*7g",
   "R*2g",
   "B*3h",
   "2g2e+",
   "8h7h"
  ],
  "cpuB": 0
 },
 {
  "id": "st-take-220",
  "type": "take",
  "sfen": "l2gkgsnl/3s5/p1nppp1pp/2p2bp2/1+r7/4P1P2/P+pPP1PSPP/1P1S4R/LNBGKG1NL b - 1",
  "accepted": [
   "8h8g"
  ],
  "best": "8h8g",
  "pv": [
   "8h8g",
   "8e8g",
   "P*8h",
   "8g8d",
   "1h3h",
   "9c9d",
   "6i7h"
  ],
  "cpuB": 15
 },
 {
  "id": "st-tactic-221",
  "type": "tactic",
  "sfen": "l4g2l/1r1sgks2/p5npp/2ppp1p2/1p1n1p3/2P2bPP1/PPSPPS2P/2G1G3R/LN2K2NL b Bp 1",
  "accepted": [
   "7g6f"
  ],
  "best": "7g6f",
  "pv": [
   "7g6f",
   "6e5g+",
   "6f5g",
   "4f5e"
  ],
  "cpuB": 20.5
 },
 {
  "id": "st-take-222",
  "type": "take",
  "sfen": "l4g2l/1r1sgks2/p5npp/2ppp1p2/3n1p3/B1PS1bPP1/P+p1PPS2P/2G1G3R/LN2K2NL b Pp 1",
  "accepted": [
   "7h8g"
  ],
  "best": "7h8g",
  "pv": [
   "7h8g",
   "P*8f",
   "8g8h",
   "4f2d",
   "7f7e",
   "7d7e",
   "P*7d"
  ],
  "cpuB": 12.75
 },
 {
  "id": "st-take-223",
  "type": "take",
  "sfen": "l4g2l/3sgk3/p4snpp/2ppp1p2/3n1p3/BpPS1SPP1/P2PP2gP/4G3R/LN2K2NL w RBPp 1",
  "accepted": [
   "2g1h"
  ],
  "best": "2g1h",
  "pv": [
   "2g1h",
   "1i1h",
   "4e4f",
   "P*4d",
   "4c4d",
   "6f6e",
   "6d6e"
  ],
  "cpuB": 7.75
 },
 {
  "id": "st-take-224",
  "type": "take",
  "sfen": "l4g2l/1B1sgk3/p5npp/2pppsp2/3n1p3/BpPS1SPP1/P2PP3P/4G3g/LN2KRrNL w 2p 1",
  "accepted": [
   "3i4i+"
  ],
  "best": "3i4i+",
  "pv": [
   "3i4i+",
   "5i4i",
   "R*7i",
   "4i4h",
   "4e4f",
   "1i1h",
   "6b5c"
  ],
  "cpuB": 8
 },
 {
  "id": "st-tactic-225",
  "type": "tactic",
  "sfen": "l4g2l/1B2gk3/p3s1npp/2pppsp2/3S1p3/BpP2SPP1/P2PP3P/4G3g/LN3K1NL w RNr2p 1",
  "accepted": [
   "1h2h"
  ],
  "best": "1h2h",
  "pv": [
   "1h2h",
   "4i5i",
   "R*3i",
   "5i6h",
   "3i8i+",
   "6e6d",
   "8f8g+"
  ],
  "cpuB": 48
 },
 {
  "id": "st-take-226",
  "type": "take",
  "sfen": "l4g2l/1B2gk3/p3S1npp/2p1psp2/9/BpP2pPP1/P2PP3P/4G4/LNr1NK1gL w RSPsn2p 1",
  "accepted": [
   "4d5c"
  ],
  "best": "4d5c",
  "pv": [
   "4d5c",
   "8b4f+",
   "7i7f+",
   "4f4g",
   "N*4f",
   "4g2i",
   "3c4e"
  ],
  "cpuB": 26
 },
 {
  "id": "st-take-227",
  "type": "take",
  "sfen": "l4g2l/1B3+Pk2/p3s1npp/2p1p1p2/9/BpP2pPP1/P2PP3P/4G4/LNr1NK1gL w RG3sn2p 1",
  "accepted": [
   "4a4b"
  ],
  "best": "4a4b",
  "pv": [
   "4a4b",
   "8b4f+",
   "7i7f+",
   "5g5f",
   "S*4e",
   "4f9a",
   "N*4f"
  ],
  "cpuB": 15.75
 },
 {
  "id": "st-defend-228",
  "type": "defend",
  "sfen": "l1R2p2l/6k2/p2+Bsgnpp/4p1p2/9/1p1G1+BPP1/P2PP3P/4G4/LN+r1NK1gL w SP2sn4p 1",
  "accepted": [
   "7i7a"
  ],
  "best": "7i7a",
  "pv": [
   "7i7a",
   "S*5b",
   "4c4b",
   "P*4c",
   "R*3i",
   "4i4h",
   "4b5b"
  ],
  "cpuB": -0.25
 },
 {
  "id": "st-tactic-229",
  "type": "tactic",
  "sfen": "l1+r2p2l/3s+Bsk2/p6pp/4p4/5Nr2/1p1GPP1P1/P2P4P/4G1G2/LN2NK1gs b Lbsn6p 1",
  "accepted": [
   "L*3d"
  ],
  "best": "L*3d",
  "pv": [
   "L*3d",
   "P*3c",
   "3d3c+",
   "4b3c",
   "4e3c+",
   "3b3c",
   "5i4g"
  ],
  "cpuB": 48
 },
 {
  "id": "st-defend-230",
  "type": "defend",
  "sfen": "l1+r2p2l/3sks3/p5+Npp/4p4/6RP1/1p1GPP3/P2P2L1P/4G2g1/LN2NK2s b NP2bgs5p 1",
  "accepted": [
   "3c4b"
  ],
  "best": "3c4b",
  "pv": [
   "3c4b",
   "4a4b",
   "N*6d",
   "5b6c"
  ],
  "cpuB": 6.25
 },
 {
  "id": "st-tactic-231",
  "type": "tactic",
  "sfen": "ln1gk2nl/1r1s2g2/pppppp1pp/6p2/8P/2PBP4/PPNP1PPP1/1b3S1R1/L2GKG1NL w Ss 1",
  "accepted": [
   "2a3c"
  ],
  "best": "2a3c",
  "pv": [
   "2a3c",
   "9i9h",
   "S*8i",
   "4h3i",
   "8i9h+",
   "2h8h",
   "9h8h"
  ],
  "cpuB": 20.75
 },
 {
  "id": "st-tactic-232",
  "type": "tactic",
  "sfen": "ln1gk2Sl/1r1s1g1B1/ppppppnpp/4l1p2/1N6P/2+b1P4/Ps2GPPP1/5K1R1/5GSNL w 3p 1",
  "accepted": [
   "7f7e"
  ],
  "best": "7f7e",
  "pv": [
   "7f7e",
   "2b1a+",
   "5d5f",
   "L*5h",
   "5f5g+",
   "5h5g",
   "8g7f+"
  ],
  "cpuB": 28
 },
 {
  "id": "st-tactic-233",
  "type": "tactic",
  "sfen": "ln1gk2Sl/1r1s1g1B1/pppppp1pp/4l1p2/1+b2Pn2P/3G5/Ps3PPP1/6KR1/5GSNL w n3p 1",
  "accepted": [
   "4e5g+"
  ],
  "best": "4e5g+",
  "pv": [
   "4e5g+",
   "4i4h",
   "5g4h",
   "3i4h",
   "8e5h",
   "5e5d",
   "G*4i"
  ],
  "cpuB": 33
 },
 {
  "id": "st-tactic-234",
  "type": "tactic",
  "sfen": "ln1gk2Sl/1r1s1g1B1/pppppp1pp/2+b1l1p2/4P3P/2+s1G4/P4PNP1/5NKR1/5GS1L w n4p 1",
  "accepted": [
   "N*3f"
  ],
  "best": "N*3f",
  "pv": [
   "N*3f",
   "5e5d",
   "3f2h+",
   "3h2h",
   "5c5d",
   "2b1a+",
   "6b5c"
  ],
  "cpuB": 29.5
 },
 {
  "id": "st-tactic-235",
  "type": "tactic",
  "sfen": "lnk4Sl/1r1sgg3/pppppplpp/6p2/5G1NP/3+B5/P1S1nP1P1/4GN1K1/1r4S1L w B5p 1",
  "accepted": [
   "5g4i+"
  ],
  "best": "5g4i+",
  "pv": [
   "5g4i+",
   "2e3c+",
   "4b3c",
   "6f6g",
   "8i6i+",
   "5h6h",
   "6i5i"
  ],
  "cpuB": 17.5
 },
 {
  "id": "st-tactic-236",
  "type": "tactic",
  "sfen": "lnk4Sl/1r1sgg3/pppppplpp/6p2/5G1NP/3+B5/P1SB1P1P1/4GN1K1/2s1+r2+nL b 5p 1",
  "accepted": [
   "2h1g"
  ],
  "best": "2h1g",
  "pv": [
   "2h1g",
   "5i3i",
   "2e3c+",
   "2i1i",
   "3c4b",
   "5b4b",
   "4e3d"
  ],
  "cpuB": 32.75
 },
 {
  "id": "st-defend-237",
  "type": "defend",
  "sfen": "lnsgkg1nl/7s1/p1pppp1p1/6p1p/9/2PBP1P2/P2P1PGPP/2S2K1R1/3+r2SNL b BPgnlp 1",
  "accepted": [
   "7h6i"
  ],
  "best": "7h6i",
  "pv": [
   "7h6i",
   "2a3c",
   "6i5h",
   "G*6h",
   "4g4f",
   "L*6d",
   "6f5e"
  ],
  "cpuB": -10
 },
 {
  "id": "st-tactic-238",
  "type": "tactic",
  "sfen": "lnsgkg1nl/1p7/p1ppppsp1/3l2p1p/9/2P1P1P2/P1BPKPGPP/1R5R1/3S2SNL w BPgn 1",
  "accepted": [
   "N*6e"
  ],
  "best": "N*6e",
  "pv": [
   "N*6e",
   "5g6f",
   "6e7g+",
   "6f7g",
   "B*5g",
   "8h3h",
   "5g7i+"
  ],
  "cpuB": 20
 },
 {
  "id": "st-tactic-239",
  "type": "tactic",
  "sfen": "ln2k1bnl/1r1sgsg2/p1pppppPp/7R1/9/1pP6/PPBPPPP1P/2GS5/LN2KGSNL b p 1",
  "accepted": [
   "8g8f"
  ],
  "best": "8g8f",
  "pv": [
   "8g8f",
   "4c4d",
   "2d4d",
   "5c5d",
   "4d4e",
   "4b4c",
   "4e8e"
  ],
  "cpuB": 16.75
 },
 {
  "id": "st-tactic-240",
  "type": "tactic",
  "sfen": "l1sgk2nl/1r4gs1/p1nppp1p1/2p3p1p/2P4P1/1P7/PSNPPPP1P/2G4R1/L3KGSNL w BPb 1",
  "accepted": [
   "B*9b"
  ],
  "best": "B*9b",
  "pv": [
   "B*9b",
   "7g8e",
   "7c8e",
   "2e2d",
   "2c2d",
   "8f8e",
   "5a4b"
  ],
  "cpuB": 35
 },
 {
  "id": "st-tactic-241",
  "type": "tactic",
  "sfen": "l1s1k2nl/b5gs1/p2ppp1p1/1rg3p1p/1Np4P1/BP7/PS1PPPP1P/2G2K1R1/L4GSNL b Pnp 1",
  "accepted": [
   "8e9c+"
  ],
  "best": "8e9c+",
  "pv": [
   "8e9c+",
   "9b8a",
   "9c8c",
   "9a9f",
   "8c8d",
   "7d8d",
   "9g9f"
  ],
  "cpuB": 18.75
 },
 {
  "id": "st-tactic-242",
  "type": "tactic",
  "sfen": "l1s1k2nl/b5gs1/pr1ppp3/6pRp/1N1g5/BPP6/PS1PPPP1P/2G2K3/L4GSNL w Pn3p 1",
  "accepted": [
   "6e6d"
  ],
  "best": "6e6d",
  "pv": [
   "6e6d",
   "2d3d",
   "5a4b",
   "3d3b+",
   "4b3b"
  ],
  "cpuB": 48
 },
 {
  "id": "st-tactic-243",
  "type": "tactic",
  "sfen": "lns1kgsnl/2g1r4/1ppppp1p1/p4bp1p/9/P1P5P/1P1PPPPP1/1B2RSG2/LNSGK2NL b - 1",
  "accepted": [
   "8h4d"
  ],
  "best": "8h4d",
  "pv": [
   "8h4d",
   "4c4d",
   "B*4c",
   "4a3b",
   "4c3d+",
   "7a6b",
   "5i4i"
  ],
  "cpuB": 22.75
 },
 {
  "id": "st-tactic-244",
  "type": "tactic",
  "sfen": "lns1kg2l/2g1rs3/1p1pp1np1/p1p2pp1p/9/P1P3P1P/1P1PPPNP1/4RSG2/LNSGK3L b Bb 1",
  "accepted": [
   "B*2b"
  ],
  "best": "B*2b",
  "pv": [
   "B*2b",
   "4a3b",
   "2b1a+",
   "5a6b",
   "5g5f",
   "5b5a",
   "1a1b"
  ],
  "cpuB": 20.25
 },
 {
  "id": "st-tactic-245",
  "type": "tactic",
  "sfen": "l7l/1r2gkgps/p1npppn1p/2ps3P1/6pN1/1PP4R1/PSBPPP2P/2KG1S3/LN1G4L w b2p 1",
  "accepted": [
   "B*1e"
  ],
  "best": "B*1e",
  "pv": [
   "B*1e",
   "7g3c+",
   "3b3c",
   "2e3c+",
   "4b3c",
   "4h3g",
   "3c4b"
  ],
  "cpuB": 28
 },
 {
  "id": "st-judge-246",
  "type": "judge",
  "sfen": "ln4s1l/1r3kgb1/pppgps1pp/3p2p2/5p3/3PP1P2/PPP2PnPP/1BGSRS3/LN3KG1L b n 1",
  "accepted": [
   "4h3g"
  ],
  "choices": [
   "4i3h",
   "4h3g",
   "4i5i"
  ],
  "best": "4h3g",
  "pv": [
   "4h3g",
   "N*7d",
   "5h5i",
   "7d6f",
   "7h7i",
   "6c5d",
   "4g4f"
  ],
  "cpuB": 30
 },
 {
  "id": "st-tactic-247",
  "type": "tactic",
  "sfen": "lns1k1snl/4g1g2/p1pppp1pp/3r1bp2/1P1B5/P8/1GNPPPP1P/4K2R1/L1S2GSNL b P2p 1",
  "accepted": [
   "6e8c+"
  ],
  "best": "6e8c+",
  "pv": [
   "6e8c+",
   "P*8f",
   "8g8h",
   "5a4a",
   "P*7b",
   "7a6b",
   "8c8b"
  ],
  "cpuB": 20.75
 },
 {
  "id": "st-tactic-248",
  "type": "tactic",
  "sfen": "lns1k1snl/4g1g2/2pppp1pp/p5p2/2S6/P8/1+b1PPPP1P/4K1SR1/L4G1NL b RGbn4p 1",
  "accepted": [
   "R*8c"
  ],
  "best": "R*8c",
  "pv": [
   "R*8c",
   "B*6i",
   "5h5i",
   "P*8b",
   "8c8e+",
   "8a9c"
  ],
  "cpuB": 48
 },
 {
  "id": "st-defend-249",
  "type": "defend",
  "sfen": "ln1gk3l/1r4g2/p1pp1pn+b1/4P2p1/6p1p/4bSPR1/PPN+p1PN2/1SP3S2/LK1G1G2L b SP3p 1",
  "accepted": [
   "S*4e"
  ],
  "best": "S*4e",
  "pv": [
   "S*4e",
   "3c4e"
  ],
  "cpuB": 35.25
 },
 {
  "id": "st-defend-250",
  "type": "defend",
  "sfen": "lr4knl/4g1g2/p1ns2+Npp/2pp5/7P1/2+BPS1p2/PPNSP1b1P/2GKG1R2/L7L w S3P3p 1",
  "accepted": [
   "3b3c"
  ],
  "best": "3b3c",
  "pv": [
   "3b3c",
   "P*3d",
   "3c3b",
   "P*4d",
   "7d7e",
   "7f7e",
   "N*4f"
  ],
  "cpuB": 22.5
 },
 {
  "id": "st-tactic-251",
  "type": "tactic",
  "sfen": "lr5n+B/4g1k2/p1ns3pp/2ppp1P2/2l4P1/2PP2p2/PPNSPS2P/2G1KG3/+r3b3L w GSL2Pnp 1",
  "accepted": [
   "3f3g+"
  ],
  "best": "3f3g+",
  "pv": [
   "3f3g+",
   "4h4i",
   "3g4g",
   "5h4g",
   "5i7g+",
   "L*7i",
   "N*5e"
  ],
  "cpuB": 20.5
 },
 {
  "id": "st-defend-252",
  "type": "defend",
  "sfen": "lr5n+B/4g1k2/p1ns3pp/2ppp1P2/2l4P1/2PP5/PPNSPS+p1P/2G1KG3/+r3b3L b GSL2Pnp 1",
  "accepted": [
   "4h4i"
  ],
  "best": "4h4i",
  "pv": [
   "4h4i",
   "3g4g",
   "5h4g",
   "5i7g+",
   "L*7i",
   "N*5e",
   "4g3g"
  ],
  "cpuB": 25.75
 },
 {
  "id": "st-tactic-253",
  "type": "tactic",
  "sfen": "ln5nl/3rgkg2/p1pspp1p1/1p3sP1p/3P1+b1N1/2P2B1PP/PPS1PP3/2G1G4/LNK1S2RL w 2P 1",
  "accepted": [
   "4e3d"
  ],
  "best": "4e3d",
  "pv": [
   "4e3d",
   "P*3c",
   "3b2b",
   "1f1e",
   "1d1e",
   "5g5f",
   "2c2d"
  ],
  "cpuB": 22.5
 },
 {
  "id": "st-tactic-254",
  "type": "tactic",
  "sfen": "ln5nl/3rgkg2/p1p1pp1p1/1p2ss+b1p/3P2pN1/2PS1BPPP/PP2PP3/2G1G4/LNK1S1R1L w P 1",
  "accepted": [
   "3e3f"
  ],
  "best": "3e3f",
  "pv": [
   "3e3f",
   "1f1e",
   "2c2d",
   "2e1c",
   "1a1c",
   "1e1d",
   "1c1d"
  ],
  "cpuB": 23.75
 },
 {
  "id": "st-tactic-255",
  "type": "tactic",
  "sfen": "ln1gk3l/1r1s1s1g1/pppppp1pp/5bp2/5n1P1/2PB5/PP1PPPP1P/2G1GS1R1/LNS1K2NL b - 1",
  "accepted": [
   "4g4f"
  ],
  "best": "4g4f",
  "pv": [
   "4g4f",
   "4e3g",
   "4h3g",
   "7c7d",
   "6f4d",
   "4c4d",
   "2e2d"
  ],
  "cpuB": 23.5
 },
 {
  "id": "st-tactic-256",
  "type": "tactic",
  "sfen": "lngks2nl/3r5/pp1p1pgpp/2psP1p2/9/2P6/PPSP1PPPP/1G2R1GS1/LN2K2NL b BPb 1",
  "accepted": [
   "5d5c+"
  ],
  "best": "5d5c+",
  "pv": [
   "5d5c+",
   "6d5c",
   "5h5c+",
   "6b5b",
   "5c5b",
   "5a5b",
   "R*3a"
  ],
  "cpuB": 12.75
 },
 {
  "id": "st-judge-257",
  "type": "judge",
  "sfen": "ln3k1nl/1r2g1gs1/p1sp1p2p/2p1p1pp1/9/1PP1P1P2/P2P1PN1P/1SG1GS1R1/LNK5L w BPbp 1",
  "accepted": [
   "8b8f"
  ],
  "choices": [
   "2b3c",
   "1c1d",
   "8b8f"
  ],
  "best": "8b8f",
  "pv": [
   "8b8f",
   "8h7g",
   "8f8b",
   "B*7a",
   "8b7b",
   "7a2f+",
   "7c6d"
  ],
  "cpuB": 18.75
 },
 {
  "id": "st-tactic-258",
  "type": "tactic",
  "sfen": "ln3k1nl/6g2/p1s1r1s1p/3p1pR2/4pN3/1PS3P2/P2P1P2P/2G1GS3/LNK5L w G3P2b4p 1",
  "accepted": [
   "4d4e"
  ],
  "best": "4d4e",
  "pv": [
   "4d4e",
   "P*5d",
   "5c5b",
   "3d3e",
   "5b5d",
   "3e4e",
   "P*4d"
  ],
  "cpuB": 11.25
 },
 {
  "id": "st-defend-259",
  "type": "defend",
  "sfen": "ln2rk1nl/9/p1s3+R1p/3p5/4pp3/1PS3P2/P2P1P2P/2G1GS3/LNK5L w GS3P2bgn4p 1",
  "accepted": [
   "2a3c"
  ],
  "best": "2a3c",
  "pv": [
   "2a3c",
   "S*4c",
   "G*4b",
   "G*4d",
   "R*2i",
   "4h5i",
   "B*2a"
  ],
  "cpuB": 5.25
 },
 {
  "id": "st-defend-260",
  "type": "defend",
  "sfen": "ln1skn1bl/2+Rs5/p3+P1n1p/2Pp1G3/4pp3/1PS3P2/P1KP1P2P/2G1GS3/L+r6L w BPgn4p 1",
  "accepted": [
   "6a7b"
  ],
  "best": "6a7b",
  "pv": [
   "6a7b",
   "P*5d",
   "4a5c",
   "4d5c",
   "N*6e",
   "7f6e",
   "6d6e"
  ],
  "cpuB": 2
 },
 {
  "id": "st-defend-261",
  "type": "defend",
  "sfen": "ln3n1bl/2sk1B3/p5n1p/2P1PG3/3ppp3/1P4P2/P1KP1P2P/2G1GS3/L+r6L b SNrgs5p 1",
  "accepted": [
   "S*8g"
  ],
  "best": "S*8g",
  "pv": [
   "S*8g",
   "6b7a",
   "4b6d+",
   "S*6c",
   "6d9a"
  ],
  "cpuB": 48
 },
 {
  "id": "st-defend-262",
  "type": "defend",
  "sfen": "l2k1n1bl/9/p1nsG1n1p/2P1PG3/3+Bpp3/1P4P2/P1KPsP2P/2GG1+r3/L+r6L b P2sn5p 1",
  "accepted": [
   "7d7c+"
  ],
  "best": "7d7c+",
  "pv": [
   "7d7c+",
   "5g6h",
   "7h6h"
  ],
  "cpuB": -10
 },
 {
  "id": "st-tactic-263",
  "type": "tactic",
  "sfen": "Gnkgs3l/2s1r2Ps/p1pp1pp1n/1p2pb1+Rp/5N3/2PL2P2/PP1PPP2P/1BS6/LN1GKG2L w p 1",
  "accepted": [
   "P*2c"
  ],
  "best": "P*2c",
  "pv": [
   "P*2c",
   "2d3c",
   "4d3c",
   "4e3c+",
   "7a8b",
   "9a8a",
   "8b8a"
  ],
  "cpuB": 20.25
 },
 {
  "id": "st-tactic-264",
  "type": "tactic",
  "sfen": "ln1g1k1nl/1r3sgb1/2pppp2p/ps4pp1/1NP6/1P7/P1SPPPPPP/1B2RGS2/L2GK2NL w P 1",
  "accepted": [
   "8d7e"
  ],
  "best": "8d7e",
  "pv": [
   "8d7e",
   "5h7h",
   "P*8d",
   "7g6h",
   "2b8h+",
   "7h8h",
   "7e6d"
  ],
  "cpuB": 22.5
 },
 {
  "id": "st-tactic-265",
  "type": "tactic",
  "sfen": "l4k1nl/1r2gsg2/2nppp2p/ps4pp1/2P6/1PS6/P2PPPPPP/1R3GS2/L2GK2NL w B2Pbn 1",
  "accepted": [
   "B*7g"
  ],
  "best": "B*7g",
  "pv": [
   "B*7g",
   "8h6h",
   "7g8f+",
   "P*8c",
   "8b6b",
   "B*5e",
   "8f7f"
  ],
  "cpuB": 18.75
 },
 {
  "id": "st-tactic-266",
  "type": "tactic",
  "sfen": "ln1gkrsn1/2s3g2/prpppp1pp/6p2/1p5P1/2P+B3b1/PPGPPPP1P/3SKS3/LN3G1NL b L 1",
  "accepted": [
   "L*8d"
  ],
  "best": "L*8d",
  "pv": [
   "L*8d",
   "8c8d",
   "6f8d",
   "2f4d",
   "4i3h",
   "L*8h",
   "R*5i"
  ],
  "cpuB": 31.25
 },
 {
  "id": "st-tactic-267",
  "type": "tactic",
  "sfen": "ln1gkr1n1/1rsb1s3/p1pp2gpp/6p2/1PP+Bpp1P1/2G6/P1NPP1P1P/L+p2KSGL1/4S2NL w P 1",
  "accepted": [
   "8h7h"
  ],
  "best": "8h7h",
  "pv": [
   "8h7h",
   "5i6h",
   "7h6h",
   "5h6h",
   "6b4d",
   "3g3f",
   "S*6d"
  ],
  "cpuB": 48
 },
 {
  "id": "st-tactic-268",
  "type": "tactic",
  "sfen": "ln1gkr1n1/1rs2s3/p1ppn1g1p/4+Bbpp1/1PP2p3/3Gp4/P1+pPP1P1P/L4S1L1/4SKGNL b Pp 1",
  "accepted": [
   "6f5e"
  ],
  "best": "6f5e",
  "pv": [
   "6f5e",
   "4d5e",
   "5d5e",
   "5f5g+",
   "4h5g",
   "7g6g",
   "P*4c"
  ],
  "cpuB": 19
 },
 {
  "id": "st-tactic-269",
  "type": "tactic",
  "sfen": "ln1g2B+R1/1rs2kbPg/p1ppngnsp/6pp1/1PP2p3/4P1P2/P2P1S2P/L2+pS1KL1/6GNL w Pp 1",
  "accepted": [
   "4b5b"
  ],
  "best": "4b5b",
  "pv": [
   "4b5b",
   "P*4d",
   "4c4d",
   "2a1b",
   "2c1b",
   "G*4b",
   "5b6b"
  ],
  "cpuB": 22.75
 },
 {
  "id": "st-tactic-270",
  "type": "tactic",
  "sfen": "lr3ksnl/3s1g1b1/p2pp2gp/2p2pPp1/1p5P1/2P2s3/PPBPPN2P/2G1GS1R1/LN2K2NL b 2p 1",
  "accepted": [
   "2e2d"
  ],
  "best": "2e2d",
  "pv": [
   "2e2d",
   "2c3d",
   "2d2c+",
   "P*2e",
   "2c2b",
   "3a2b",
   "B*7b"
  ],
  "cpuB": 15.25
 },
 {
  "id": "st-tactic-271",
  "type": "tactic",
  "sfen": "l8/3sk1gS1/p2pp2gp/2p2B3/6s2/1PP6/P2PP2pP/2G2SR2/LN2K2NL w R2NL3Pbg3p 1",
  "accepted": [
   "P*3g"
  ],
  "best": "P*3g",
  "pv": [
   "P*3g",
   "3h3g",
   "P*3f",
   "4d3e",
   "3f3g+",
   "2i3g",
   "3b2b"
  ],
  "cpuB": 48
 },
 {
  "id": "st-judge-272",
  "type": "judge",
  "sfen": "ln1gk2nl/1r1s1sgb1/p1pppp1pp/1p4p2/9/2P6/PP1PPPPPP/1KS1G1SR1/LN1G3NL b B 1",
  "accepted": [
   "7h7g"
  ],
  "choices": [
   "8h9h",
   "8i7g",
   "7h7g"
  ],
  "best": "7h7g",
  "pv": [
   "7h7g",
   "6c6d"
  ],
  "cpuB": 17.75
 },
 {
  "id": "st-tactic-273",
  "type": "tactic",
  "sfen": "l6nl/3sgkg2/p1np1pspp/1r1bp1p2/2p4R1/1P1SB1P2/P2PPP2P/2GKGS3/LN5NL w 2Pp 1",
  "accepted": [
   "2c2d"
  ],
  "best": "2c2d",
  "pv": [
   "2c2d",
   "2e7e",
   "8d8f",
   "P*8g",
   "8f6f",
   "6g6f",
   "6d7e"
  ],
  "cpuB": 29.5
 },
 {
  "id": "st-tactic-274",
  "type": "tactic",
  "sfen": "l6nl/2Gsk1g2/p1n2ps1p/1r1p2pp1/4pB3/6P2/PP1PPP2P/2G2S3/LNK1G2+rL b 2Pbsn2p 1",
  "accepted": [
   "7b6b"
  ],
  "best": "7b6b",
  "pv": [
   "7b6b",
   "5b4b",
   "4e6c+",
   "4b3a",
   "6c7c"
  ],
  "cpuB": 31
 },
 {
  "id": "st-tactic-275",
  "type": "tactic",
  "sfen": "l3sk1nl/6g2/p2G1ps1p/2P+B2pp1/br2p4/P5P2/1n1PPP2P/2GN1S3/LNK1G2+rL b 2Ps3p 1",
  "accepted": [
   "7i6i"
  ],
  "best": "7i6i",
  "pv": [
   "7i6i",
   "8g9i+",
   "P*8g",
   "L*7e",
   "9f9e",
   "9i8i",
   "B*7c"
  ],
  "cpuB": 9.75
 },
 {
  "id": "st-defend-276",
  "type": "defend",
  "sfen": "l3sk1nl/6g2/p2G1ps1p/2P+B2pp1/br2p4/P5P2/3PPP2P/2GN1S3/+nN1KG2+rL b 2Psl3p 1",
  "accepted": [
   "P*8g"
  ],
  "best": "P*8g",
  "pv": [
   "P*8g",
   "L*7e",
   "P*2b",
   "7e7h+",
   "6i7h",
   "P*6b",
   "7d7c+"
  ],
  "cpuB": 29.5
 },
 {
  "id": "st-tactic-277",
  "type": "tactic",
  "sfen": "ln2k2nl/1r1sg1g2/p1ppppspp/6p2/1p5P1/2P6/PPBPPPP1P/2GKG2R1/LNS1S+b1NL b - 1",
  "accepted": [
   "5i4h"
  ],
  "best": "5i4h",
  "pv": [
   "5i4h",
   "7c7d",
   "5h5i",
   "4i5i",
   "4h5i",
   "6b7c",
   "7i8h"
  ],
  "cpuB": 23.5
 },
 {
  "id": "st-tactic-278",
  "type": "tactic",
  "sfen": "ln5nl/1r2gkg2/p1psp1sp1/3p1pp1p/1p5P1/2PP1P1RP/PPB1P1P2/1GSK1G3/LN2S1+bNL b - 1",
  "accepted": [
   "6h5h"
  ],
  "best": "6h5h",
  "pv": [
   "6h5h",
   "4b3a",
   "4h4i",
   "3i4i",
   "5h4i",
   "4d4e",
   "7h6g"
  ],
  "cpuB": 48
 },
 {
  "id": "st-tactic-279",
  "type": "tactic",
  "sfen": "l1r2bsnl/2n2k1b1/pG1pppgpp/3s2p2/2p4P1/1PPGN4/PG1PS1P1P/4RK3/L5SNL b P2p 1",
  "accepted": [
   "8c8b"
  ],
  "best": "8c8b",
  "pv": [
   "8c8b",
   "7a5a",
   "8b7b",
   "4b3b",
   "7b6b",
   "5a8a",
   "P*5b"
  ],
  "cpuB": 16
 },
 {
  "id": "st-tactic-280",
  "type": "tactic",
  "sfen": "l3rbsnl/1Gn3kb1/3pppgpp/p2N2p2/2p4P1/1PPG5/PG1PS1P1P/4RK3/L4PSNL b S2p 1",
  "accepted": [
   "S*6b"
  ],
  "best": "S*6b",
  "pv": [
   "S*6b",
   "3a4b",
   "6b5a",
   "7b6d",
   "R*7b",
   "2b3a",
   "7f7e"
  ],
  "cpuB": 22
 },
 {
  "id": "st-tactic-281",
  "type": "tactic",
  "sfen": "2p2bsnl/1p1s3k1/G2p1p1pp/p1+R1pg3/3N3P1/LP2P4/P2GS1N1P/2N2PK2/L3R3L w BS2Pg2p 1",
  "accepted": [
   "P*3f"
  ],
  "best": "P*3f",
  "pv": [
   "P*3f",
   "5g4f",
   "3f3g+",
   "4f3g",
   "9d9e",
   "9f9e",
   "P*3f"
  ],
  "cpuB": 23.25
 },
 {
  "id": "st-tactic-282",
  "type": "tactic",
  "sfen": "lnsg1g1nl/1r3k3/ppppppspp/6p2/9/2P4P1/PPNPPPP1P/2G2S2R/L1S1KG1NL w Bb 1",
  "accepted": [
   "B*2g"
  ],
  "best": "B*2g",
  "pv": [
   "B*2g",
   "1h2h",
   "2g5d+",
   "7i6h",
   "5d7f",
   "3g3f",
   "4a3b"
  ],
  "cpuB": 22
 },
 {
  "id": "st-tactic-283",
  "type": "tactic",
  "sfen": "lnsg1g1nl/1r3k3/pppppp1pp/4+bsp2/7P1/5B3/PPNPPPP1P/2G1GS2R/L1SK3NL w p 1",
  "accepted": [
   "5d1h"
  ],
  "best": "5d1h",
  "pv": [
   "5d1h",
   "1i1h",
   "R*4i",
   "4h5i",
   "4i2i+",
   "B*2b",
   "4a3a"
  ],
  "cpuB": 31.25
 },
 {
  "id": "st-tactic-284",
  "type": "tactic",
  "sfen": "lnsg1g1nl/1r3k3/p1pppp1pp/1p2+bsp2/7PP/5B3/PPNPPPP1R/2G1GS3/L1SK3NL w p 1",
  "accepted": [
   "4d4e"
  ],
  "best": "4d4e",
  "pv": [
   "4d4e",
   "1g1f",
   "4e4f",
   "4g4f",
   "B*3h",
   "1f2f",
   "3h7d+"
  ],
  "cpuB": 31.25
 },
 {
  "id": "st-tactic-285",
  "type": "tactic",
  "sfen": "lnsg1g1nl/1r3k3/p1pppp1pp/1p2+b1p2/7PP/5R3/PPNPPPP1L/2G1GS1b1/L1SK3N1 w Sp 1",
  "accepted": [
   "4a3b"
  ],
  "best": "4a3b",
  "pv": [
   "4a3b",
   "2e2d",
   "2c2d",
   "4f2f",
   "2h1i+",
   "2f2d",
   "P*2b"
  ],
  "cpuB": 48
 },
 {
  "id": "st-tactic-286",
  "type": "tactic",
  "sfen": "ln3g1nl/1r1sg1k2/p2ppp1sp/6pp1/1pP5b/3PPPP2/PPN2SN1P/1SG2G1R1/L3K3L b BPp 1",
  "accepted": [
   "B*5e"
  ],
  "best": "B*5e",
  "pv": [
   "B*5e",
   "8a7c",
   "7e7d",
   "P*7f",
   "7d7c+",
   "6b7c",
   "5e7c+"
  ],
  "cpuB": 15.75
 },
 {
  "id": "st-tactic-287",
  "type": "tactic",
  "sfen": "ln1g1k2l/1r2s1s2/p3p2gp/3pbppp1/1pP1Nn3/+B2PPSP2/PP1S1P2P/2G1G2R1/L1K4NL w 2P 1",
  "accepted": [
   "9c9d"
  ],
  "best": "9c9d",
  "pv": [
   "9c9d",
   "4f4e",
   "5d4e",
   "P*2e",
   "2d2e",
   "2h2e"
  ],
  "cpuB": 24.75
 },
 {
  "id": "st-judge-288",
  "type": "judge",
  "sfen": "ln5nl/1kgs1g1r1/1pp2s1pp/p3ppp2/3p3P1/P1P1P4/1P1SSPP1P/1KG1G2R1/LN5NL b Bbp 1",
  "accepted": [
   "7f7e"
  ],
  "choices": [
   "2h2f",
   "7f7e",
   "1g1f"
  ],
  "best": "7f7e",
  "pv": [
   "7f7e",
   "4c5b",
   "6g7f",
   "6b6c",
   "8i7g",
   "2a3c",
   "4g4f"
  ],
  "cpuB": 16.5
 },
 {
  "id": "st-tactic-289",
  "type": "tactic",
  "sfen": "ln5nl/1k1s2gr1/1ppg1s2p/p2pppp2/3N5/P1PSP2p1/BP1S1PP1P/1KG1G2R1/L6NL w Pbp 1",
  "accepted": [
   "2f2g+"
  ],
  "best": "2f2g+",
  "pv": [
   "2f2g+",
   "6f7e"
  ],
  "cpuB": 14.5
 },
 {
  "id": "st-defend-290",
  "type": "defend",
  "sfen": "1n5nl/1k1s2gr1/1pp2s2p/3Pppp2/2gp5/1BP1P2p1/+lP1S1PP1P/2G1G2R1/K6NL b Bsnl3p 1",
  "accepted": [
   "8f9g"
  ],
  "best": "8f9g",
  "pv": [
   "8f9g",
   "L*9a",
   "L*9h",
   "9a9g+",
   "9h9g",
   "2f2g+",
   "7f7e"
  ],
  "cpuB": 9.5
 },
 {
  "id": "st-defend-291",
  "type": "defend",
  "sfen": "1n5nl/1k1s2gr1/1pp2s2p/3Pppp2/2Pp5/4P2p1/+nP1S1PP1P/2G1G2R1/K6NL b BGLbsl3p 1",
  "accepted": [
   "9i8i"
  ],
  "best": "9i8i",
  "pv": [
   "9i8i",
   "2f2g+"
  ],
  "cpuB": 31
 },
 {
  "id": "st-tactic-292",
  "type": "tactic",
  "sfen": "+Rn2g1snl/2+S2kg2/pppppp1pp/9/9/PLP6/1P1PPPP1P/1+bS2S1+r1/LN1GKG2L w BPnp 1",
  "accepted": [
   "N*2f"
  ],
  "best": "N*2f",
  "pv": [
   "N*2f",
   "B*1e",
   "2a3c",
   "1e2f",
   "2h2f",
   "N*3d",
   "4b4a"
  ],
  "cpuB": 48
 },
 {
  "id": "st-tactic-293",
  "type": "tactic",
  "sfen": "3+RB1snl/2+S2ggk1/pppppp1pp/9/9/PLP6/1PSPPPPbP/5S3/LN1GKG1P+r b Nnlp 1",
  "accepted": [
   "N*3d"
  ],
  "best": "N*3d",
  "pv": [
   "N*3d",
   "2b1b",
   "3d4b+",
   "2g4i+",
   "5i4i",
   "3a4b"
  ],
  "cpuB": 48
 },
 {
  "id": "st-judge-294",
  "type": "judge",
  "sfen": "6snl/2+S2ggk1/p+L+B1pp1p1/2+R3N1p/6+b2/PKPS1P3/1P1PP1P+lP/2g2Sp1+l/+r3G2P1 w 2P2np 1",
  "accepted": [
   "2b1c"
  ],
  "choices": [
   "2b1c",
   "2b3c",
   "2b1b"
  ],
  "best": "2b1c",
  "pv": [
   "2b1c",
   "3d4b+",
   "3a4b",
   "7d6e",
   "3e1g",
   "8f7e",
   "3b3a"
  ],
  "cpuB": 20.5
 },
 {
  "id": "st-tactic-295",
  "type": "tactic",
  "sfen": "6snl/2+S2g3/p+L1+Rp2p1/1K3p1kp/2S1+B4/PPP2PG1+b/3PP1P1+l/+r1g2SpP+l/4G4 b 2P3n2p 1",
  "accepted": [
   "5e4d"
  ],
  "best": "5e4d",
  "pv": [
   "5e4d",
   "9h9f",
   "8d7c",
   "4b4c",
   "4d1a",
   "2d1e",
   "6c6e"
  ],
  "cpuB": 28
 },
 {
  "id": "st-tactic-296",
  "type": "tactic",
  "sfen": "6s1+B/2+S2g3/p+L1+Rp2pn/1K5kp/2S6/+rPP2PG1+b/n2PP1P1+l/2g2SpP+l/L3G4 b 3P2n3p 1",
  "accepted": [
   "6c6e"
  ],
  "best": "6c6e",
  "pv": [
   "6c6e",
   "N*2e",
   "6e3e",
   "2d1e",
   "3e3a",
   "N*2d",
   "3f2e"
  ],
  "cpuB": 20.75
 },
 {
  "id": "st-defend-297",
  "type": "defend",
  "sfen": "6s1+B/2+S2g3/p+L2p2pn/1K5kp/2S+R5/+rPP2PG1+b/n2PP1P1+l/2g2SpP+l/L3G4 w 3P2n3p 1",
  "accepted": [
   "N*4c",
   "P*4e"
  ],
  "best": "N*4c",
  "pv": [
   "N*4c",
   "6e6a",
   "3a3b",
   "1a2b",
   "3b3c",
   "9i9g",
   "9f9g"
  ],
  "cpuB": 48
 },
 {
  "id": "st-judge-298",
  "type": "judge",
  "sfen": "ln1g3nl/1r1s1kgs1/p1p1pp2p/3p2pB1/9/1PP4R1/PSNPPPP1P/2G2S3/L3KG1NL w Pb2p 1",
  "accepted": [
   "2a3c"
  ],
  "choices": [
   "4b5b",
   "4b4a",
   "2a3c"
  ],
  "best": "2a3c",
  "pv": [
   "2a3c",
   "2d4f",
   "6a5b",
   "4f6d",
   "4c4d",
   "2f2h"
  ],
  "cpuB": 24.5
 },
 {
  "id": "st-defend-299",
  "type": "defend",
  "sfen": "lS3kn1l/2G+Lgsg2/4ppn1p/7p1/pr3+bp2/1pP2N1PP/4PPPS1/1+b3G1K1/3R3NL w Ps4p 1",
  "accepted": [
   "P*6f",
   "P*6g",
   "5b6b",
   "P*6e",
   "4b5a"
  ],
  "best": "P*6f",
  "pv": [
   "P*6f",
   "6b5b",
   "4a5b"
  ],
  "cpuB": 20
 },
 {
  "id": "st-defend-300",
  "type": "defend",
  "sfen": "lS1+Rs1n1l/3G1kg2/4ppn1p/7p1/pr3+bp2/1pP2N1PP/4PPPS1/1+b3G1K1/7NL w GPsl4p 1",
  "accepted": [
   "3c2e"
  ],
  "best": "3c2e",
  "pv": [
   "3c2e",
   "6b5a",
   "8h4d",
   "5a4a",
   "4b3c",
   "4a3a",
   "8e8a"
  ],
  "cpuB": 26.5
 },
 {
  "id": "st-defend-301",
  "type": "defend",
  "sfen": "ln2k3l/8s/2pspp1gp/1p1pb1pP1/1n7/2P3P2/PPGPPP1pP/3K1SR2/L+r1s1G1NL b BGNP 1",
  "accepted": [
   "4h3g"
  ],
  "best": "4h3g",
  "pv": [
   "4h3g",
   "8e7g+",
   "6h7g",
   "2g2h+",
   "3h2h",
   "8i7i",
   "G*7h"
  ],
  "cpuB": 33
 },
 {
  "id": "st-defend-302",
  "type": "defend",
  "sfen": "l4k1nl/2R+Sg1gbs/p2ppp2p/6pp1/1p2Ps2N/3S2P2/PPGP1P1+bP/4G4/L2K2RNL w Pn2p 1",
  "accepted": [
   "3b4b",
   "5b6b"
  ],
  "best": "3b4b",
  "pv": [
   "3b4b",
   "7b7a+",
   "N*5a",
   "6b5b",
   "4b5b",
   "G*6b",
   "5b6b"
  ],
  "cpuB": 11
 },
 {
  "id": "st-defend-303",
  "type": "defend",
  "sfen": "l2+Rsk1nl/5g1bs/p2ppp1Pp/6pp1/1p2Ps2N/3S2P+b1/PPGP1P2P/2K1G4/L5RNL w Gn2p 1",
  "accepted": [
   "2b3c",
   "2b4d"
  ],
  "best": "2b3c",
  "pv": [
   "2b3c",
   "G*6b",
   "2f1e",
   "6a5a",
   "4a3b",
   "1g1f",
   "1e2f"
  ],
  "cpuB": 3.75
 },
 {
  "id": "st-defend-304",
  "type": "defend",
  "sfen": "+R4g1nl/3GS1k2/p2ppp1sp/2n2bppP/1p2Ps3/3S2P2/PPKP1P3/4G4/L5RNL w BLPgn2p 1",
  "accepted": [
   "G*3a",
   "G*4b"
  ],
  "best": "G*3a",
  "pv": [
   "G*3a",
   "5b4a",
   "3a4a",
   "9a8b",
   "7d6f",
   "6b6c",
   "N*4b"
  ],
  "cpuB": 31
 },
 {
  "id": "st-defend-305",
  "type": "defend",
  "sfen": "ln1s1k1nl/3g2sg1/p1pp3pp/5Pp2/1PP4P1/4rpP2/PG1Pp1S1P/2R3G2/LNSK1b1NL b BPp 1",
  "accepted": [
   "3h4h",
   "P*5i"
  ],
  "best": "3h4h",
  "pv": [
   "3h4h",
   "4i6g+",
   "8g7g",
   "5g5h+",
   "4h5h",
   "6g7h",
   "7i7h"
  ],
  "cpuB": 19.5
 },
 {
  "id": "st-defend-306",
  "type": "defend",
  "sfen": "ln4kn1/1r2g2bl/3p1ps+Rp/2p1p4/pPs2Pp2/1p1B4P/P1NPP1P2/LSK1G4/3GS2NL w G2Pp 1",
  "accepted": [
   "5b4b"
  ],
  "best": "5b4b",
  "pv": [
   "5b4b",
   "7h6h",
   "7e6f",
   "6g6f",
   "B*3d",
   "2c2f",
   "P*2e"
  ],
  "cpuB": 17.25
 },
 {
  "id": "st-judge-307",
  "type": "judge",
  "sfen": "lns1kg1nl/3rg1sb1/pppppp1pp/6p2/3P3P1/2P3P2/PP2PP2P/1K1G2R2/LNSG2SNL b B 1",
  "accepted": [
   "8i7g"
  ],
  "choices": [
   "8i7g",
   "8h9h",
   "6h7g"
  ],
  "best": "8i7g",
  "pv": [
   "8i7g",
   "5a4b",
   "6i7h",
   "6c6d",
   "6e6d",
   "6b6d",
   "3f3e"
  ],
  "cpuB": 26.5
 },
 {
  "id": "st-judge-308",
  "type": "judge",
  "sfen": "lnsgk2nl/1r4gs1/p1pppp1pp/6p2/9/1pP6/PP1PPPPPP/2GS3R1/LN2KGSNL b Bb 1",
  "accepted": [
   "8g8f"
  ],
  "choices": [
   "B*9h",
   "B*9f",
   "8g8f"
  ],
  "best": "8g8f",
  "pv": [
   "8g8f",
   "8b8f",
   "P*8g",
   "8f7f",
   "6h7g",
   "7f7d",
   "7g6f"
  ],
  "cpuB": 15.5
 },
 {
  "id": "st-judge-309",
  "type": "judge",
  "sfen": "ln1g1g1nl/1rs2ks2/p1ppppbpp/1p4p2/7P1/9/PPPPPPP1P/1BGSGS1R1/LN2K2NL b - 1",
  "accepted": [
   "5i6i"
  ],
  "choices": [
   "5i4i",
   "2e2d",
   "5i6i"
  ],
  "best": "5i6i",
  "pv": [
   "5i6i",
   "8d8e"
  ],
  "cpuB": 24.5
 },
 {
  "id": "st-judge-310",
  "type": "judge",
  "sfen": "ln1g3nl/1rs2kg2/p1ppppspp/6p2/1p5P1/2P6/PPSPPPP1P/2G1GS1R1/LN2K2NL b Bb 1",
  "accepted": [
   "3g3f"
  ],
  "choices": [
   "2e2d",
   "5h6h",
   "3g3f"
  ],
  "best": "3g3f",
  "pv": [
   "3g3f",
   "7c7d",
   "5i6h",
   "7b7c",
   "9g9f",
   "7c6d",
   "6g6f"
  ],
  "cpuB": 21.25
 },
 {
  "id": "st-judge-311",
  "type": "judge",
  "sfen": "ln5nl/2s1gkg2/p1ppppspp/1r3bp2/1p5P1/2P6/PPSPPPP1P/2GKGS1R1/LN5NL b B 1",
  "accepted": [
   "4g4f"
  ],
  "choices": [
   "3g3f",
   "9g9f",
   "4g4f"
  ],
  "best": "4g4f",
  "pv": [
   "4g4f",
   "7c7d",
   "4f4e",
   "4d7g+",
   "7h7g",
   "8a7c",
   "4h4g"
  ],
  "cpuB": 55
 },
 {
  "id": "st-judge-312",
  "type": "judge",
  "sfen": "ln+B4nl/1rs1gkg2/3ppp1pp/p1p3ps1/4b4/1PP2P3/P1SPP1P1P/2G1GS1R1/LK5NL b 2Pn 1",
  "accepted": [
   "5g5f"
  ],
  "choices": [
   "5g5f",
   "7a8b",
   "8i7i"
  ],
  "best": "5g5f",
  "pv": [
   "5g5f",
   "5e6d",
   "4h5g",
   "N*6e",
   "5g6f",
   "6e7g+"
  ],
  "cpuB": 55
 },
 {
  "id": "st-judge-313",
  "type": "judge",
  "sfen": "ln+B4nl/r1s1gkg2/3ppp1pp/p1p2bps1/3n5/PPP2P3/3PPSP1P/1SG1G2R1/LK5NL b 2P 1",
  "accepted": [
   "4f4e"
  ],
  "choices": [
   "7f7e",
   "1g1f",
   "4f4e"
  ],
  "best": "4f4e",
  "pv": [
   "4f4e",
   "4d3c"
  ],
  "cpuB": 17.25
 },
 {
  "id": "st-judge-314",
  "type": "judge",
  "sfen": "l1+B4nl/r3gkg2/1snppp1pp/2p2bps1/P2n5/1PP1SP3/3PPGP1P/1SG4R1/LK5NL b 3P 1",
  "accepted": [
   "P*2e"
  ],
  "choices": [
   "P*2e",
   "7a8a",
   "5f4e"
  ],
  "best": "P*2e",
  "pv": [
   "P*2e",
   "2d3e",
   "7a8a",
   "5c5d",
   "8a9b",
   "8c9b",
   "R*6a"
  ],
  "cpuB": 55
 },
 {
  "id": "st-judge-315",
  "type": "judge",
  "sfen": "ln1gk2nl/3sr1gb1/p1ppppspp/1p4p2/7P1/2P1P1P2/PPGP1PS1P/1B5R1/LNSK1G1NL b - 1",
  "accepted": [
   "4i5h"
  ],
  "choices": [
   "2h2g",
   "4i5h",
   "6g6f"
  ],
  "best": "4i5h",
  "pv": [
   "4i5h",
   "7c7d",
   "3g4f",
   "5c5d",
   "2i3g",
   "6c6d",
   "7g6f"
  ],
  "cpuB": 20.75
 },
 {
  "id": "st-judge-316",
  "type": "judge",
  "sfen": "lnsgk1snl/6gb1/prppppppp/9/9/7P1/PPPPPPP1P/1BS2SGR1/LN1GK2NL b p 1",
  "accepted": [
   "3g3f"
  ],
  "choices": [
   "3g3f",
   "6i7i",
   "5g5f"
  ],
  "best": "3g3f",
  "pv": [
   "3g3f",
   "3c3d",
   "2f2e",
   "2b3c",
   "4h3g",
   "7a7b",
   "3g4f"
  ],
  "cpuB": 22.75
 },
 {
  "id": "st-judge-317",
  "type": "judge",
  "sfen": "ln1gk1snl/3s2g2/prppppbpp/6p2/7P1/9/PPPPPPP1P/1BSK2GR1/LN1GS2NL b p 1",
  "accepted": [
   "6h7i"
  ],
  "choices": [
   "5i4h",
   "8h7i",
   "6h7i"
  ],
  "best": "6h7i",
  "pv": [
   "6h7i",
   "3a2b",
   "7g7f",
   "9c9d",
   "8h3c+",
   "2b3c",
   "5i6h"
  ],
  "cpuB": 22.5
 },
 {
  "id": "st-judge-318",
  "type": "judge",
  "sfen": "ln1gk2nl/3s2gs1/1rppppbpp/6p2/p6P1/6P2/PPPPPP2P/1BS1S1GR1/LNKG3NL b p 1",
  "accepted": [
   "3h3g"
  ],
  "choices": [
   "3h4h",
   "5g5f",
   "3h3g"
  ],
  "best": "3h3g",
  "pv": [
   "3h3g",
   "7c7d",
   "3g4f",
   "8a7c",
   "2h3h",
   "P*8f",
   "8g8f"
  ],
  "cpuB": 23.5
 },
 {
  "id": "st-judge-319",
  "type": "judge",
  "sfen": "ln1gk2nl/3s2gs1/1r1pppbpp/2p6/p5pP1/2PP2P2/PP2PPNGP/1BS1S2R1/LNKG4L w p 1",
  "accepted": [
   "9e9f"
  ],
  "choices": [
   "9e9f",
   "1c1d",
   "5a5b"
  ],
  "best": "9e9f",
  "pv": [
   "9e9f",
   "9g9f"
  ],
  "cpuB": 55
 },
 {
  "id": "st-judge-320",
  "type": "judge",
  "sfen": "ln2k2nl/3sg1gs1/1r1ppp1pp/5b3/p1p3pP1/2PP2P2/PPBSPPNGP/2S3R2/LNKG4L w p 1",
  "accepted": [
   "8a7c"
  ],
  "choices": [
   "8a7c",
   "5a4a",
   "8c8d"
  ],
  "best": "8a7c",
  "pv": [
   "8a7c",
   "3f3e",
   "7c8e",
   "7g8h",
   "7e7f",
   "6g7f",
   "4d3e"
  ],
  "cpuB": 24.5
 },
 {
  "id": "st-judge-321",
  "type": "judge",
  "sfen": "ln5nl/3sgkgs1/3ppp1pp/1r3b3/p1P3pP1/1P1P2P2/P1BSPPNGP/1KS3R2/LN1G4L w Pp 1",
  "accepted": [
   "8a7c"
  ],
  "choices": [
   "9e9f",
   "8a7c",
   "8a9c"
  ],
  "best": "8a7c",
  "pv": [
   "8a7c",
   "6g7f",
   "P*8e",
   "7h8g",
   "2b3c",
   "6i7h",
   "8e8f"
  ],
  "cpuB": 20.5
 },
 {
  "id": "st-judge-322",
  "type": "judge",
  "sfen": "l6nl/3sgkg2/2npppspp/4rb3/p1P3pP1/1P1PP1P2/PS1S1PNGP/1K1B2R2/LN1G4L w Pp 1",
  "accepted": [
   "6c6d"
  ],
  "choices": [
   "5d9d",
   "9e9f",
   "6c6d"
  ],
  "best": "6c6d",
  "pv": [
   "6c6d",
   "7e7d",
   "6d6e",
   "7d7c+"
  ],
  "cpuB": 19.25
 },
 {
  "id": "st-judge-323",
  "type": "judge",
  "sfen": "4s1knl/4g1g2/4pp1pp/r3n1P2/2PSN2P1/pPS1P2b1/PS1K+BPN1P/2G3R2/L7L w L4Pgp 1",
  "accepted": [
   "G*2g"
  ],
  "choices": [
   "P*3f",
   "G*6f",
   "G*2g"
  ],
  "best": "G*2g",
  "pv": [
   "G*2g",
   "3h3i",
   "2g3g",
   "L*3c",
   "N*4e",
   "3c3b+",
   "3a3b"
  ],
  "cpuB": 55
 },
 {
  "id": "st-judge-324",
  "type": "judge",
  "sfen": "4s1k1l/4g4/4pp1pp/r3n2g1/2PSNN3/pPS1P2b1/PS1K+BP2P/2G6/L5g1L b N4Prl3p 1",
  "accepted": [
   "7f8e"
  ],
  "choices": [
   "7f8e",
   "P*3b",
   "4e3c+"
  ],
  "best": "7f8e",
  "pv": [
   "7f8e",
   "R*6i",
   "6g7f",
   "9d9b",
   "9g9f",
   "2f5i+",
   "5g3i"
  ],
  "cpuB": 55
 },
 {
  "id": "st-judge-325",
  "type": "judge",
  "sfen": "ln1gk2nl/1r1s1sg2/pppppp1pp/5bp2/9/2P4P1/PPSPPPP1P/2G2S1R1/LN2KG1NL b B 1",
  "accepted": [
   "3g3f"
  ],
  "choices": [
   "7f7e",
   "5i5h",
   "3g3f"
  ],
  "best": "3g3f",
  "pv": [
   "3g3f",
   "7c7d"
  ],
  "cpuB": 25
 },
 {
  "id": "st-judge-326",
  "type": "judge",
  "sfen": "ln2k1bnl/1rs1gsg2/p1ppppppp/1p7/9/2P4P1/PPBPPPP1P/2GS1S1R1/LN2KG1NL b - 1",
  "accepted": [
   "2f2e"
  ],
  "choices": [
   "6g6f",
   "2f2e",
   "5i6i"
  ],
  "best": "2f2e",
  "pv": [
   "2f2e",
   "7b8c",
   "3g3f",
   "9c9d",
   "4h3g",
   "5c5d",
   "2e2d"
  ],
  "cpuB": 27.25
 },
 {
  "id": "st-judge-327",
  "type": "judge",
  "sfen": "lnsgkgsnl/3r5/ppp1pp1pp/3p2p2/4b4/6PP1/PPPPPPN1P/1BGS1S1R1/LN2KG2L b - 1",
  "accepted": [
   "5g5f"
  ],
  "choices": [
   "5g5f",
   "4i3i",
   "2h2g"
  ],
  "best": "5g5f",
  "pv": [
   "5g5f",
   "5e3c",
   "3g4e",
   "3c4d",
   "6h5g",
   "6b2b",
   "5g4f"
  ],
  "cpuB": 23.25
 },
 {
  "id": "st-judge-328",
  "type": "judge",
  "sfen": "lnsg3nl/3krsgb1/ppp1pp2p/3P2pR1/9/2Pp5/PPN1PPP1P/1B1S5/L2GKGSNL w 2p 1",
  "accepted": [
   "5b5a"
  ],
  "choices": [
   "P*2c",
   "7c7d",
   "5b5a"
  ],
  "best": "5b5a",
  "pv": [
   "5b5a",
   "2d3d",
   "2b3c",
   "5i4h"
  ],
  "cpuB": 32.25
 },
 {
  "id": "st-judge-329",
  "type": "judge",
  "sfen": "ln1g3nl/2skr1gb1/ppp1pp2p/3P3s1/3N5/2Pp2R2/PP2PPP1P/1B1S5/L2GKGSNL w P2p 1",
  "accepted": [
   "2d2e"
  ],
  "choices": [
   "2d2e",
   "P*2e",
   "P*3e"
  ],
  "best": "2d2e",
  "pv": [
   "2d2e",
   "3f5f",
   "2e3d",
   "8h6f",
   "2b6f",
   "5f6f",
   "B*5e"
  ],
  "cpuB": 26
 },
 {
  "id": "st-judge-330",
  "type": "judge",
  "sfen": "ln1g3nl/2skr1g2/ppp1pp2p/3P3s1/3N2p2/2PR5/PP2PPP1P/3S5/L2GKGSNL w B2Pbp 1",
  "accepted": [
   "B*8h"
  ],
  "choices": [
   "B*5e",
   "B*3c",
   "B*8h"
  ],
  "best": "B*8h",
  "pv": [
   "B*8h",
   "6f5f",
   "8h9i+",
   "B*4a",
   "3b4b",
   "4a5b+",
   "6b5b"
  ],
  "cpuB": 55
 },
 {
  "id": "st-judge-331",
  "type": "judge",
  "sfen": "ln1g3nl/2skr1g2/pp2pp2p/2pP3s1/3N2p2/2P6/PPR1PPP1P/3S5/L2GKGSNL w B2Pbp 1",
  "accepted": [
   "B*3c"
  ],
  "choices": [
   "B*3c",
   "2a3c",
   "6b5a"
  ],
  "best": "B*3c",
  "pv": [
   "B*3c",
   "5i4h",
   "P*6c",
   "6d6c+",
   "7b6c",
   "B*4a",
   "P*6d"
  ],
  "cpuB": 55
 },
 {
  "id": "st-judge-332",
  "type": "judge",
  "sfen": "+Bn1g3nl/l1skr1g2/pp2pp2p/2pP+b2s1/3N2p2/2P6/PP1RPPP1P/3S5/L2GKGSNL w 2Pp 1",
  "accepted": [
   "6b5a"
  ],
  "choices": [
   "4c4d",
   "3e3f",
   "6b5a"
  ],
  "best": "6b5a",
  "pv": [
   "6b5a",
   "7f7e",
   "5b6b",
   "P*2c",
   "5a5b",
   "7e7d",
   "5d6d"
  ],
  "cpuB": 21.25
 },
 {
  "id": "st-judge-333",
  "type": "judge",
  "sfen": "ln1gk2nl/1r1s1sg2/p1ppppbpp/1p4p2/7P1/5P3/PPPPP1PRP/1BSK5/LN1G1GSNL b - 1",
  "accepted": [
   "4i5h"
  ],
  "choices": [
   "4i5h",
   "3g3f",
   "1g1f"
  ],
  "best": "4i5h",
  "pv": [
   "4i5h",
   "8d8e",
   "3i4h",
   "8e8f",
   "8g8f",
   "8b8f",
   "P*8g"
  ],
  "cpuB": 55
 },
 {
  "id": "st-judge-334",
  "type": "judge",
  "sfen": "lns1k2nl/1r2gsg2/2ppppbpp/pp4p2/7P1/P4P3/1PPPP1PRP/1BS3G2/LNKG2SNL b - 1",
  "accepted": [
   "3h4g"
  ],
  "choices": [
   "2g2h",
   "3h4g",
   "2e2d"
  ],
  "best": "3h4g",
  "pv": [
   "3h4g",
   "8d8e",
   "3g3f",
   "4c4d",
   "2i3g",
   "4b4c",
   "3i4h"
  ],
  "cpuB": 26.25
 },
 {
  "id": "st-judge-335",
  "type": "judge",
  "sfen": "ln2k2nl/1r1sg1g2/1bppppspp/pp4p2/7P1/P1P2P3/1P1PPBPRP/1KS3GS1/LN1G3NL b - 1",
  "accepted": [
   "5g5f"
  ],
  "choices": [
   "5g5f",
   "4g5f",
   "2e2d"
  ],
  "best": "5g5f",
  "pv": [
   "5g5f",
   "5a4a",
   "3g3f",
   "8d8e",
   "6g6f",
   "7c7d",
   "7h6g"
  ],
  "cpuB": 20.5
 },
 {
  "id": "st-judge-336",
  "type": "judge",
  "sfen": "lnsgk1snl/1r7/p1ppppgpp/6p2/1p2B4/2P1P4/PP1P1PPPP/1G1S3R1/LN2KGSNL b b 1",
  "accepted": [
   "2h5h"
  ],
  "choices": [
   "2h5h",
   "4i4h",
   "5e4f"
  ],
  "best": "2h5h",
  "pv": [
   "2h5h",
   "6a5b",
   "1g1f",
   "1c1d",
   "8h7h",
   "4c4d",
   "6h7g"
  ],
  "cpuB": -10
 },
 {
  "id": "st-judge-337",
  "type": "judge",
  "sfen": "lnsgk2nl/1r7/p1pp1pspp/4p1p2/1p7/P1P1P2P1/1PSP1PP1P/G4S1R1/Lg2KG1NL b Bbn 1",
  "accepted": [
   "5i6h"
  ],
  "choices": [
   "3g3f",
   "4i5h",
   "5i6h"
  ],
  "best": "5i6h",
  "pv": [
   "5i6h",
   "N*6e",
   "7g6f",
   "8e8f",
   "8g8f"
  ],
  "cpuB": 55
 },
 {
  "id": "st-judge-338",
  "type": "judge",
  "sfen": "ln2k2nl/1r1sg4/p1pp1pspp/4pnp2/1p3B3/P1P1P1PP1/1PSPSP2P/G6R1/Lg2KG1NL b b 1",
  "accepted": [
   "2f2e"
  ],
  "choices": [
   "2f2e",
   "1g1f",
   "2i3g"
  ],
  "best": "2f2e",
  "pv": [
   "2f2e",
   "6b5c",
   "5g4f",
   "5c6d",
   "3f3e",
   "3c2b",
   "3e3d"
  ],
  "cpuB": 27
 },
 {
  "id": "st-judge-339",
  "type": "judge",
  "sfen": "lnsgk1snl/4r1g2/pppp1pbpp/6p2/4p4/7P1/PPPPPPPRP/1BG2S3/LNSK1G1NL w - 1",
  "accepted": [
   "3a4b"
  ],
  "choices": [
   "8c8d",
   "6c6d",
   "3a4b"
  ],
  "best": "3a4b",
  "pv": [
   "3a4b",
   "3g3f",
   "9c9d",
   "7g7f",
   "5a6b",
   "4h3g",
   "4b5c"
  ],
  "cpuB": 23.5
 },
 {
  "id": "st-judge-340",
  "type": "judge",
  "sfen": "lnsgk2nl/5sg2/pp1prp1pp/2p3pb1/4p4/5PPP1/PPPPPS1RP/1BG6/LNSK1G1NL b - 1",
  "accepted": [
   "7g7f"
  ],
  "choices": [
   "2g2h",
   "7g7f",
   "4i5i"
  ],
  "best": "7g7f",
  "pv": [
   "7g7f",
   "2d3c",
   "2i3g",
   "5c5b",
   "2f2e",
   "4c4d",
   "4f4e"
  ],
  "cpuB": 21
 },
 {
  "id": "st-judge-341",
  "type": "judge",
  "sfen": "ln1gk2nl/3s1sg2/pp1p1pb1p/2p1r1pp1/4p4/2P2PP2/PP1PPS1RP/1BG1G4/LNSK3NL b p 1",
  "accepted": [
   "7i6h"
  ],
  "choices": [
   "2g2f",
   "8h7g",
   "7i6h"
  ],
  "best": "7i6h",
  "pv": [
   "7i6h",
   "6a7b",
   "4f4e",
   "6b7c",
   "6i7i",
   "5a6a",
   "4g4f"
  ],
  "cpuB": 28.75
 },
 {
  "id": "st-judge-342",
  "type": "judge",
  "sfen": "ln2k2nl/2g2sg2/1psp1pb1p/p1p1r1pp1/4p4/2PB1PP2/PP1PPS1RP/1G1SG4/LN1K3NL b p 1",
  "accepted": [
   "6f7g"
  ],
  "choices": [
   "1g1f",
   "1i1h",
   "6f7g"
  ],
  "best": "6f7g",
  "pv": [
   "6f7g",
   "5a6a",
   "6g6f",
   "3b2c",
   "6h6g",
   "6a7a",
   "9g9f"
  ],
  "cpuB": 55
 },
 {
  "id": "st-judge-343",
  "type": "judge",
  "sfen": "lnk1s2nl/2g3g2/1psp1pb1p/p1p1r1pp1/4p4/PPPB1PP2/3PPS1RP/1GKSG4/LN5NL b p 1",
  "accepted": [
   "2i3g"
  ],
  "choices": [
   "7h7i",
   "2i3g",
   "5g5f"
  ],
  "best": "2i3g",
  "pv": [
   "2i3g",
   "5a6b",
   "8h8g",
   "3b2c",
   "8i7g",
   "5d5a",
   "3g4e"
  ],
  "cpuB": 18.5
 },
 {
  "id": "st-judge-344",
  "type": "judge",
  "sfen": "ln2s2nl/1kg1r4/1psp1pbgp/p1p3pp1/2P1pP3/PP1B2P1R/2KPPS2P/1G1SG4/LN5NL b p 1",
  "accepted": [
   "7g7h"
  ],
  "choices": [
   "4g4f",
   "5g5f",
   "7g7h"
  ],
  "best": "7g7h",
  "pv": [
   "7g7h",
   "7d7e",
   "6f7e",
   "7c6d",
   "7e6f",
   "5a6b",
   "8h8g"
  ],
  "cpuB": 34
 },
 {
  "id": "st-judge-345",
  "type": "judge",
  "sfen": "ln5nl/1kg1r4/1p1p2bgp/P1ss1ppp1/6P2/1P1BpS2R/2KP4P/1G1SG4/LN5NL w 2P4p 1",
  "accepted": [
   "7d7e"
  ],
  "choices": [
   "7d7e",
   "P*7f",
   "P*7e"
  ],
  "best": "7d7e",
  "pv": [
   "7d7e",
   "9d9c+"
  ],
  "cpuB": 24
 },
 {
  "id": "st-judge-346",
  "type": "judge",
  "sfen": "l1k5l/2g6/1p1pr1ngp/P1s2P1p1/7b1/1P2Sp3/3KS3P/1G4R2/LN5NL b BN3Pgs6p 1",
  "accepted": [
   "P*7c"
  ],
  "choices": [
   "4d4c+",
   "P*7c",
   "N*6f"
  ],
  "best": "P*7c",
  "pv": [
   "P*7c",
   "7b7c",
   "P*5d",
   "5c5d"
  ],
  "cpuB": 19
 },
 {
  "id": "st-judge-347",
  "type": "judge",
  "sfen": "lnsg1gsnl/3kr2b1/ppp1p1ppp/3p1p3/9/1P3P1P1/P1PPP1PRP/1BGS5/LN2KGSNL b - 1",
  "accepted": [
   "2f2e"
  ],
  "choices": [
   "3i4h",
   "2f2e",
   "4i5h"
  ],
  "best": "2f2e",
  "pv": [
   "2f2e",
   "3a3b",
   "2e2d",
   "2c2d",
   "2g2d",
   "P*2c",
   "2d4d"
  ],
  "cpuB": 21.5
 },
 {
  "id": "st-judge-348",
  "type": "judge",
  "sfen": "l3r4/ks1g3+P1/n1p3pPp/p1b2P3/3pps1p1/P1N3P2/LGPPP3P/G3S4/1NS1KG1NL b B2Prl 1",
  "accepted": [
   "9f9e"
  ],
  "choices": [
   "9f9e",
   "B*4b",
   "P*8d"
  ],
  "best": "9f9e",
  "pv": [
   "9f9e",
   "9d9e",
   "4d4c+",
   "5e5f",
   "B*4d",
   "6b6a",
   "5g5f"
  ],
  "cpuB": 21.25
 },
 {
  "id": "st-judge-349",
  "type": "judge",
  "sfen": "l2l1+P3/1s1g1+P3/n1p3pPp/pkb6/3pp1sp1/P1P6/LG1PS+rB1P/G2K5/1NS3GNL b N2Pr2p 1",
  "accepted": [
   "3i4h"
  ],
  "choices": [
   "3i4h",
   "P*5h",
   "P*8e"
  ],
  "best": "3i4h",
  "pv": [
   "3i4h",
   "4g3f",
   "7f7e",
   "7d6c",
   "6h7h"
  ],
  "cpuB": 9.5
 },
 {
  "id": "st-judge-350",
  "type": "judge",
  "sfen": "l2r5/1s1g1+r3/n1p3pPp/pk7/1b1pp2p1/P1P6/LG1PNs2P/G2K1S1B1/1NS3GNL b L6p 1",
  "accepted": [
   "L*4e"
  ],
  "choices": [
   "L*4e",
   "4h3g",
   "2h3g"
  ],
  "best": "L*4e",
  "pv": [
   "L*4e",
   "4b5b",
   "4h4g",
   "5e5f",
   "2h4f",
   "8d8c",
   "4f1c+"
  ],
  "cpuB": 10.75
 },
 {
  "id": "st-judge-351",
  "type": "judge",
  "sfen": "l2r1+L3/4g4/1sp1b1pPp/p1k6/1n1pp2p1/P1P6/LG1PN3P/G2KS2B1/2S2RGNL b Psn5p 1",
  "accepted": [
   "P*8f"
  ],
  "choices": [
   "P*8f",
   "6h6i",
   "7f7e"
  ],
  "best": "P*8f",
  "pv": [
   "P*8f",
   "P*4d",
   "2h5e",
   "P*5f",
   "5e4d",
   "5f5g+",
   "5h5g"
  ],
  "cpuB": 55
 },
 {
  "id": "st-judge-352",
  "type": "judge",
  "sfen": "ln1gkgsnl/3s3r1/p1pppp1pp/1p4p2/7P1/2P1P4/PPSP1PP1P/5S1R1/LN1GKG1NL w Bb 1",
  "accepted": [
   "6a7b"
  ],
  "choices": [
   "B*6d",
   "B*6e",
   "6a7b"
  ],
  "best": "6a7b",
  "pv": [
   "6a7b",
   "B*6f",
   "B*3c",
   "6f8d",
   "3a4b",
   "3g3f",
   "4a3b"
  ],
  "cpuB": 24
 },
 {
  "id": "st-judge-353",
  "type": "judge",
  "sfen": "ln1gkg1nl/1r1s1s3/p1ppp1bpp/1p3pp2/9/P1P4P1/1P1PPPP1P/1B1G3R1/LNS1KGSNL w - 1",
  "accepted": [
   "8d8e"
  ],
  "choices": [
   "8d8e",
   "6c6d",
   "6a7b"
  ],
  "best": "8d8e",
  "pv": [
   "8d8e",
   "8h7g",
   "7c7d",
   "3i4h",
   "6b7c",
   "6h7h",
   "7c6d"
  ],
  "cpuB": 22.5
 },
 {
  "id": "st-judge-354",
  "type": "judge",
  "sfen": "ln1gkg1nl/1r3s3/p1sp2bpp/1pp1ppp2/9/P1P4P1/1P1PPPP1P/1BGS1S1R1/LN2KG1NL w - 1",
  "accepted": [
   "8d8e"
  ],
  "choices": [
   "5a5b",
   "8d8e",
   "6c6d"
  ],
  "best": "8d8e",
  "pv": [
   "8d8e",
   "6h7g",
   "4a3b",
   "5i6i",
   "5a4a",
   "3g3f",
   "7c6d"
  ],
  "cpuB": 23.75
 },
 {
  "id": "st-judge-355",
  "type": "judge",
  "sfen": "ln1gk2nl/1r4g2/p2p1sbpp/1sp1ppp2/1p7/P1P4P1/1PSPPPP1P/1BGKGS1R1/LN5NL b - 1",
  "accepted": [
   "3g3f"
  ],
  "choices": [
   "3g3f",
   "2h3h",
   "7g6f"
  ],
  "best": "3g3f",
  "pv": [
   "3g3f",
   "6a5b",
   "6h7i",
   "7d7e",
   "7f7e",
   "8d7e",
   "P*7f"
  ],
  "cpuB": 25.5
 },
 {
  "id": "st-judge-356",
  "type": "judge",
  "sfen": "ln1gk2nl/2r3g2/p2p1sbpp/1s2ppp2/2p6/PpP2P1P1/1P1PP1P1P/1BGSGS1R1/LNK4NL b - 1",
  "accepted": [
   "8h6f"
  ],
  "choices": [
   "8h9g",
   "8h6f",
   "4f4e"
  ],
  "best": "8h6f",
  "pv": [
   "8h6f",
   "8f8g+"
  ],
  "cpuB": 18.5
 },
 {
  "id": "st-judge-357",
  "type": "judge",
  "sfen": "ln1g1gsnl/1r1s1k3/p1pppp1p1/1p4p1p/9/2P4P1/PPNPPPP1P/2G1GS1R1/L1S1K2NL w Bb 1",
  "accepted": [
   "3a2b"
  ],
  "choices": [
   "3a2b",
   "4c4d",
   "5c5d"
  ],
  "best": "3a2b",
  "pv": [
   "3a2b",
   "3g3f",
   "7c7d",
   "6g6f",
   "4b3b",
   "2f2e",
   "2b3c"
  ],
  "cpuB": 26
 },
 {
  "id": "st-judge-358",
  "type": "judge",
  "sfen": "ln4snl/1r1sgkg2/p1ppp4/1p3pppp/9/2P6/PPNPPPP1P/2GSGS1R1/L3K2NL b Bbp 1",
  "accepted": [
   "2h2d"
  ],
  "choices": [
   "9g9f",
   "B*6f",
   "2h2d"
  ],
  "best": "2h2d",
  "pv": [
   "2h2d",
   "3a2b",
   "3g3f",
   "8d8e",
   "2d2h",
   "P*2c",
   "6g6f"
  ],
  "cpuB": 17.75
 },
 {
  "id": "st-judge-359",
  "type": "judge",
  "sfen": "ln5nl/1r1sgkgs1/p1ppp4/5pp1p/9/1PP4R1/P1NPPPP1P/2GSGS3/L2K3NL w B2Pbp 1",
  "accepted": [
   "8b8f"
  ],
  "choices": [
   "P*2c",
   "8b8f",
   "B*3h"
  ],
  "best": "8b8f",
  "pv": [
   "8b8f",
   "P*8g",
   "8f8b",
   "3g3f",
   "6c6d",
   "4g4f",
   "6b6c"
  ],
  "cpuB": 19
 },
 {
  "id": "st-judge-360",
  "type": "judge",
  "sfen": "ln1gk1snl/r2s2gb1/1pppppppp/9/p8/2P1P1P2/PPSP1P1PP/1B3S1R1/LN1GKG1NL b - 1",
  "accepted": [
   "4h3g"
  ],
  "choices": [
   "2i3g",
   "3f3e",
   "4h3g"
  ],
  "best": "4h3g",
  "pv": [
   "4h3g",
   "3a4b",
   "2g2f",
   "4c4d",
   "2f2e",
   "4b4c",
   "3g4f"
  ],
  "cpuB": 24.25
 },
 {
  "id": "st-judge-361",
  "type": "judge",
  "sfen": "ln1gk2nl/r4sgb1/1ppsppppp/3p5/p8/2P1PSPP1/PPSP1P2P/1B5R1/LN1GKG1NL b - 1",
  "accepted": [
   "2f2e"
  ],
  "choices": [
   "8h7i",
   "6i5h",
   "2f2e"
  ],
  "best": "2f2e",
  "pv": [
   "2f2e",
   "3c3d",
   "3f3e",
   "3d3e",
   "4f3e",
   "7c7d",
   "2e2d"
  ],
  "cpuB": -10
 },
 {
  "id": "st-judge-362",
  "type": "judge",
  "sfen": "lns1k2nl/1r2gsgb1/p1pppp2p/1p4pp1/9/2P3PP1/PP1PPPN1P/1BG2S1R1/LNS1KG2L b - 1",
  "accepted": [
   "2f2e"
  ],
  "choices": [
   "4i3h",
   "9g9f",
   "2f2e"
  ],
  "best": "2f2e",
  "pv": [
   "2f2e",
   "2d2e"
  ],
  "cpuB": 55
 },
 {
  "id": "st-judge-363",
  "type": "judge",
  "sfen": "lns1k2nl/1r2gs1g1/p1ppppb1p/1p4pp1/9/2P2PPP1/PPBPP1N1P/2GS1S1R1/LN2KG2L w - 1",
  "accepted": [
   "5a4a"
  ],
  "choices": [
   "4b3a",
   "4c4d",
   "5a4a"
  ],
  "best": "5a4a",
  "pv": [
   "5a4a",
   "2h2i"
  ],
  "cpuB": 33
 },
 {
  "id": "st-judge-364",
  "type": "judge",
  "sfen": "ln1gk2nl/1r1s1sgb1/p1ppppppp/1p7/7P1/2P3P2/PPBPPP2P/2S1G2R1/LN1GK1SNL w - 1",
  "accepted": [
   "3c3d"
  ],
  "choices": [
   "6b7a",
   "9c9d",
   "3c3d"
  ],
  "best": "3c3d",
  "pv": [
   "3c3d",
   "3i4h",
   "2b7g+",
   "7h7g",
   "4b3c",
   "5i6h",
   "7c7d"
  ],
  "cpuB": 14.5
 },
 {
  "id": "st-judge-365",
  "type": "judge",
  "sfen": "ln3k1nl/3sgsgb1/prppppppp/1p7/6PP1/2P6/PPBPPPS1P/2S1G2R1/LN1GK2NL w - 1",
  "accepted": [
   "8d8e"
  ],
  "choices": [
   "8d8e",
   "5b5a",
   "9c9d"
  ],
  "best": "8d8e",
  "pv": [
   "8d8e",
   "9g9f",
   "7c7d",
   "3g3f",
   "8a7c",
   "2e2d",
   "2c2d"
  ],
  "cpuB": 24
 },
 {
  "id": "st-judge-366",
  "type": "judge",
  "sfen": "ln3k1nl/3sgsgb1/pr1p1pp1p/2p1p2p1/1p4P2/2P2S3/PPBPPP2P/2SKG2R1/LN1G3NL b p 1",
  "accepted": [
   "2h2d"
  ],
  "choices": [
   "2i3g",
   "3e3d",
   "2h2d"
  ],
  "best": "2h2d",
  "pv": [
   "2h2d",
   "P*2c",
   "2d2f",
   "6b5c",
   "2i3g",
   "5c6d",
   "1g1f"
  ],
  "cpuB": 21.25
 },
 {
  "id": "st-judge-367",
  "type": "judge",
  "sfen": "l4k1nl/3sgsgb1/pr1p1pppp/2p1p4/1p1n1SP2/2PB3R1/PP1PPP2P/2SKG4/LN1G3NL w P 1",
  "accepted": [
   "6b5c"
  ],
  "choices": [
   "4a3a",
   "5b5a",
   "6b5c"
  ],
  "best": "6b5c",
  "pv": [
   "6b5c",
   "2i3g",
   "1c1d",
   "1g1f",
   "5c6d",
   "4e5d",
   "7d7e"
  ],
  "cpuB": 15
 },
 {
  "id": "st-judge-368",
  "type": "judge",
  "sfen": "l4k1nl/4gsgb1/pr1pspppp/2p1p4/1p3SP1N/2P4R1/PPSPPP2P/3KG4/L2G3NL w NPb 1",
  "accepted": [
   "3c3d"
  ],
  "choices": [
   "4b3a",
   "B*1d",
   "3c3d"
  ],
  "best": "3c3d",
  "pv": [
   "3c3d",
   "4e3d",
   "2b7g+",
   "6h7g",
   "B*9e",
   "7g7h",
   "8e8f"
  ],
  "cpuB": 55
 },
 {
  "id": "st-judge-369",
  "type": "judge",
  "sfen": "l2gk1snl/1r1s2gb1/p1nppp1pp/1pp3p2/9/4P2P1/PPPP1PP1P/3S1S1R1/LNBGK1GNL b - 1",
  "accepted": [
   "2f2e"
  ],
  "choices": [
   "2f2e",
   "2h2g",
   "4g4f"
  ],
  "best": "2f2e",
  "pv": [
   "2f2e",
   "8d8e",
   "6i7h",
   "2b3c",
   "3g3f",
   "8e8f",
   "8g8f"
  ],
  "cpuB": 22.75
 },
 {
  "id": "st-judge-370",
  "type": "judge",
  "sfen": "ln1gkg1nl/1r1s3b1/p1pppp1sp/1p4pp1/9/9/PPPPPPP1P/1BSK2SR1/LN1G1G1NL b p 1",
  "accepted": [
   "3g3f"
  ],
  "choices": [
   "6g6f",
   "2h2f",
   "3g3f"
  ],
  "best": "3g3f",
  "pv": [
   "3g3f",
   "8d8e",
   "3h3g",
   "4a3b",
   "3g4f",
   "7c7d",
   "3f3e"
  ],
  "cpuB": 28.75
 },
 {
  "id": "st-judge-371",
  "type": "judge",
  "sfen": "ln1gk2nl/1r1s2gb1/p1pppp1sp/1p4pp1/9/4P4/PPPP1PP1P/1BS1G1SR1/LNKG3NL b p 1",
  "accepted": [
   "1g1f"
  ],
  "choices": [
   "4g4f",
   "1g1f",
   "2h2g"
  ],
  "best": "1g1f",
  "pv": [
   "1g1f",
   "8d8e",
   "3g3f",
   "7c7d",
   "3h3g",
   "8a7c"
  ],
  "cpuB": 55
 },
 {
  "id": "st-judge-372",
  "type": "judge",
  "sfen": "ln2kgs1l/1r1sg4/p1ppppnpp/1p4p2/7P1/2P6/PP1PPPP1P/2GK1S1R1/LNS2G1NL w Bb 1",
  "accepted": [
   "8d8e"
  ],
  "choices": [
   "B*5d",
   "8d8e",
   "7c7d"
  ],
  "best": "8d8e",
  "pv": [
   "8d8e",
   "7i8h",
   "4a3b",
   "B*5f",
   "8e8f",
   "8g8f",
   "8b8f"
  ],
  "cpuB": 32
 },
 {
  "id": "st-judge-373",
  "type": "judge",
  "sfen": "ln2k1s1l/1r1sg1g2/p1ppp1npp/1p3pp2/9/2P6/PP1PPPP1P/1SGK1S1R1/LN3G1NL w BPb 1",
  "accepted": [
   "3a4b"
  ],
  "choices": [
   "3a4b",
   "3a2b",
   "5a6a"
  ],
  "best": "3a4b",
  "pv": [
   "3a4b",
   "4g4f"
  ],
  "cpuB": 24.25
 },
 {
  "id": "st-judge-374",
  "type": "judge",
  "sfen": "ln2k3l/1r1sgsg2/p2p2npp/1pp1ppp2/9/2P2PP2/PPSPP3P/2GK1S1R1/LN3G1NL w BPb 1",
  "accepted": [
   "B*6d"
  ],
  "choices": [
   "B*6d",
   "5b4c",
   "9c9d"
  ],
  "best": "B*6d",
  "pv": [
   "B*6d",
   "4h4g",
   "4b4c",
   "6h7i",
   "8d8e",
   "B*3g",
   "5a4b"
  ],
  "cpuB": 16
 },
 {
  "id": "st-judge-375",
  "type": "judge",
  "sfen": "ln2k3l/1r1sgsg2/p2p2npp/1ppbppp2/9/2P2PP2/PPSPP3P/2GK1S1R1/LN3G1NL w BP 1",
  "accepted": [
   "4b4c"
  ],
  "choices": [
   "9c9d",
   "1c1d",
   "4b4c"
  ],
  "best": "4b4c",
  "pv": [
   "4b4c",
   "4h3g",
   "4d4e",
   "4i5h",
   "4e4f",
   "P*4g",
   "4f4g+"
  ],
  "cpuB": -10
 },
 {
  "id": "st-judge-376",
  "type": "judge",
  "sfen": "ln2k3l/1r1sgsg2/p1bp2npp/2p1pp3/6p2/1PP6/P1SPP1B1P/2GKGS1R1/LN5NL b 2P2p 1",
  "accepted": [
   "7f7e"
  ],
  "choices": [
   "9g9f",
   "7g6f",
   "7f7e"
  ],
  "best": "7f7e",
  "pv": [
   "7f7e",
   "7c3g+",
   "4h3g",
   "3c4e",
   "3g4f",
   "3e3f",
   "5h4g"
  ],
  "cpuB": 31.75
 },
 {
  "id": "st-judge-377",
  "type": "judge",
  "sfen": "ln2k3l/1r1sg1g2/p1bp1snpp/2p1pp3/6p2/1PP4R1/P1SPP1B1P/2GKGS3/LN5NL b 2P2p 1",
  "accepted": [
   "9g9f"
  ],
  "choices": [
   "9g9f",
   "1g1f",
   "7h8h"
  ],
  "best": "9g9f",
  "pv": [
   "9g9f",
   "9c9d",
   "P*3d",
   "3c4e",
   "3g7c+",
   "8a7c"
  ],
  "cpuB": 55
 },
 {
  "id": "st-judge-378",
  "type": "judge",
  "sfen": "lr6l/3sgk1+P1/p1np1sn1p/2p1pp3/3b2p2/1PP4R1/P1SPP3P/2GK1G3/LN5NL w BGs4p 1",
  "accepted": [
   "P*2e"
  ],
  "choices": [
   "4b5c",
   "S*4g",
   "P*2e"
  ],
  "best": "P*2e",
  "pv": [
   "P*2e",
   "2f2h",
   "S*3i",
   "G*7b",
   "3i2h+",
   "7b8a",
   "6e2i+"
  ],
  "cpuB": 24
 },
 {
  "id": "st-judge-379",
  "type": "judge",
  "sfen": "lnsgkgsnl/1r5b1/p1pppp1pp/6p2/9/2P4P1/PP1PPPP1P/1BGK3R1/LNS2GSNL b p 1",
  "accepted": [
   "3i4h"
  ],
  "choices": [
   "4g4f",
   "3i4h",
   "8h2b+"
  ],
  "best": "3i4h",
  "pv": [
   "3i4h",
   "6a5b",
   "2f2e",
   "4a3b",
   "4g4f",
   "2b8h+",
   "7i8h"
  ],
  "cpuB": 55
 },
 {
  "id": "st-judge-380",
  "type": "judge",
  "sfen": "lnsgk2nl/1r3sg2/p1pppp1pp/6p2/9/2P4P1/PPSPPPP1P/2GK3R1/LN3GSNL b Bbp 1",
  "accepted": [
   "3i3h"
  ],
  "choices": [
   "3i3h",
   "7g6f",
   "5g5f"
  ],
  "best": "3i3h",
  "pv": [
   "3i3h",
   "7a6b",
   "2f2e",
   "6c6d",
   "3g3f",
   "6a5b",
   "4g4f"
  ],
  "cpuB": 24.5
 },
 {
  "id": "st-judge-381",
  "type": "judge",
  "sfen": "ln1gk2nl/1r1s2g2/p1ppp1spp/5pp2/9/2P3PP1/PPSPPPS1P/2GK3R1/LN3G1NL b Bbp 1",
  "accepted": [
   "6h7i"
  ],
  "choices": [
   "4i5i",
   "6h7i",
   "6g6f"
  ],
  "best": "6h7i",
  "pv": [
   "6h7i",
   "6c6d",
   "3g4f",
   "6b6c",
   "2f2e",
   "6c5d",
   "3f3e"
  ],
  "cpuB": 29.75
 },
 {
  "id": "st-judge-382",
  "type": "judge",
  "sfen": "ln2k2nl/1r1sg1g2/p2pp1spp/2p2p3/6SP1/2P6/PPSPPP2P/2GK3R1/LN3G1NL w BPb2p 1",
  "accepted": [
   "5b4c"
  ],
  "choices": [
   "P*8h",
   "P*3d",
   "5b4c"
  ],
  "best": "5b4c",
  "pv": [
   "5b4c",
   "7f7e",
   "7d7e",
   "2e2d",
   "2c2d"
  ],
  "cpuB": 24.75
 },
 {
  "id": "st-judge-383",
  "type": "judge",
  "sfen": "ln2k2nl/1r1sg1gs1/p2pp2pp/2p2pP2/6SP1/2P2P3/PPSPP3P/2GKG2R1/LN5NL w Bb2p 1",
  "accepted": [
   "5b4c"
  ],
  "choices": [
   "5b4b",
   "9c9d",
   "5b4c"
  ],
  "best": "5b4c",
  "pv": [
   "5b4c",
   "7g6f",
   "P*3f",
   "2h2f",
   "8b8e",
   "2f3f",
   "B*2h"
  ],
  "cpuB": 25.5
 },
 {
  "id": "st-judge-384",
  "type": "judge",
  "sfen": "ln2k2nl/1r1sg1gs1/p2p3pp/2pbpSP2/5N1P1/2P2Pp2/PPSPP3P/2GKG2R1/LN6L w BPp 1",
  "accepted": [
   "3f3g+"
  ],
  "choices": [
   "P*8f",
   "8b8e",
   "3f3g+"
  ],
  "best": "3f3g+",
  "pv": [
   "3f3g+",
   "B*1e",
   "6d4b",
   "1e4b+",
   "5b4b",
   "2h2f",
   "P*4g"
  ],
  "cpuB": 55
 },
 {
  "id": "st-judge-385",
  "type": "judge",
  "sfen": "ln5nl/1r2k1gs1/p2p1p1pp/2pbpsP2/7P1/2P3pB1/PPSPP3P/2GKG4/LN5RL w GSPnp 1",
  "accepted": [
   "8a7c"
  ],
  "choices": [
   "8a7c",
   "N*4e",
   "P*8h"
  ],
  "best": "8a7c",
  "pv": [
   "8a7c",
   "7f7e"
  ],
  "cpuB": 55
 },
 {
  "id": "st-judge-386",
  "type": "judge",
  "sfen": "lnsg3nl/1r3kgb1/pppppsp1p/5p1p1/4P4/5P3/PPPP2PPP/1B1SRKS2/LN1G1G1NL w - 1",
  "accepted": [
   "8c8d"
  ],
  "choices": [
   "8b7b",
   "9c9d",
   "8c8d"
  ],
  "best": "8c8d",
  "pv": [
   "8c8d",
   "7g7f",
   "6a5b",
   "8h7g",
   "7a6b",
   "4h3i",
   "7c7d"
  ],
  "cpuB": -10
 },
 {
  "id": "st-judge-387",
  "type": "judge",
  "sfen": "ln2gs1nl/1r2skgb1/ppp3p1p/3pp2p1/5P3/2P3P2/PP1PSS1PP/1B6R/LN1GKG1NL b Pp 1",
  "accepted": [
   "6i7h"
  ],
  "choices": [
   "5g4f",
   "6i7h",
   "1h4h"
  ],
  "best": "6i7h",
  "pv": [
   "6i7h",
   "4b3a",
   "2g2f",
   "5a4b",
   "3f3e",
   "5b5c",
   "2f2e"
  ],
  "cpuB": 55
 },
 {
  "id": "st-judge-388",
  "type": "judge",
  "sfen": "ln3k1nl/1r1sgsgb1/p1ppppppp/1p7/9/2P1P4/PPBPSPPPP/4RS3/LN1GKG1NL w - 1",
  "accepted": [
   "3c3d"
  ],
  "choices": [
   "3c3d",
   "5c5d",
   "7c7d"
  ],
  "best": "3c3d",
  "pv": [
   "3c3d",
   "7g2b+",
   "3b2b",
   "B*5e",
   "4b3c",
   "5g4f",
   "8d8e"
  ],
  "cpuB": 55
 },
 {
  "id": "st-judge-389",
  "type": "judge",
  "sfen": "l4k1nl/1r1sgsgb1/p1np1pppp/1pp1p4/9/2PSPB3/PP1P1PPPP/4RS3/LN1GKG1NL w - 1",
  "accepted": [
   "3c3d"
  ],
  "choices": [
   "3c3d",
   "8b7b",
   "8b8a"
  ],
  "best": "3c3d",
  "pv": [
   "3c3d",
   "5f5e",
   "5d5e",
   "7f7e",
   "7d7e",
   "6f5e",
   "8d8e"
  ],
  "cpuB": 24.25
 },
 {
  "id": "st-judge-390",
  "type": "judge",
  "sfen": "ln1gk1snl/1r1s2gb1/p1pppp1pp/1p4p2/7P1/2PB5/PPNPPPP1P/7R1/L1SGKGSNL b - 1",
  "accepted": [
   "2e2d"
  ],
  "choices": [
   "2e2d",
   "5i6h",
   "6i6h"
  ],
  "best": "2e2d",
  "pv": [
   "2e2d",
   "2b6f",
   "6g6f",
   "2c2d",
   "6i7h",
   "6a5b",
   "2h2d"
  ],
  "cpuB": 55
 }
]);

/** 問題集の詰将棋(初手)を、CPUの各Lvに解かせて半分が解けたLv。 */
export const SKILL_TEST_MATE_CPU_B = Object.freeze({
 "gts-37b566722ebd": 9.75,
 "gts-394e4189aa15": 3.75,
 "gts-0eec1555d42e": 8.5,
 "gts-3db44c887f1e": 8.5,
 "gts-0c3934f54244": 5.25,
 "gts-22d2d6dacae5": 5.75,
 "gts-3324a4730c28": 8.5,
 "gts-2dc3c1a6911d": 7,
 "gts-269e7716f34a": 5.25,
 "gts-17bcd0ed7302": 7,
 "gts-21cc8a1e589d": 7,
 "gts-28e42a137439": 8.5,
 "gts-416e809cffa7": 8.5,
 "gts-0602901a2b65": 5.25,
 "gts-29be2ce56ff5": 5.25,
 "gts-0be7440e0da0": 8.5,
 "gts-1808da26901b": 7,
 "gts-13d144fe7963": 13.25,
 "gts-18cef7673a76": 5.5,
 "gts-274978cb3760": 2,
 "gts-2bd0cc985bf6": 11.75,
 "gts-2ee7a9e93d50": 14.5,
 "gts-1879c85bae07": 11,
 "gts-1202f6a0e589": 7,
 "gts-1bd46b57caec": 7,
 "gts-0b7030fbef8e": 8.5,
 "gts-20432e82b2a4": 9.5,
 "gts-4225f4b01902": 10.25,
 "gts-2615c5701880": 8.5,
 "gts-2cf356376934": 9,
 "gts-1420ac6da3ce": 5.5,
 "gts-19bfe67e67aa": 17.5,
 "gts-18b835801826": 11.25,
 "gts-09300d8d51d8": 19,
 "gts-305cf124e2ca": 14.5,
 "gts-080c403e59a3": 15.75,
 "gts-0de430fc13e6": 6.75,
 "gts-41d725db95c6": 15.75,
 "gts-13acdd343c7a": 9.75,
 "gts-36ca70155b6c": 3.5,
 "gts-11d8e8382143": 14.25,
 "gts-24907f600390": 14.25,
 "gts-19eaae531414": 6.25,
 "gts-0764e6133db7": 16,
 "gts-241cb02b89b1": 5,
 "gts-2c9882f63c86": 15.75,
 "gts-39e5f457ca27": 9.75,
 "gts-28441f55bab7": 15.5,
 "gts-1cc087296997": 17.5,
 "gts-38ac47b63352": 17.5,
 "gts-08338246766a": 17.5,
 "gts-408dc5dbfe65": -10,
 "gts-33aeebfce0fc": 9,
 "gts-3e7cfe19b63b": 7.5,
 "gts-3a1ec1e7ae41": 12.5,
 "gts-1dbe9fce47be": 17.25,
 "gts-1b9a04eaca2e": 15.75,
 "gts-39dabe6a98e8": 11.5,
 "gts-0cfee0bae1e1": 14.5,
 "gts-0369f6fa09da": 15.75,
 "gts-2d72959c6ed1": 17.25,
 "gts-08d9575be313": 13,
 "gts-11a9ed80f3ab": -0.75,
 "gts-29233a2206fe": 13,
 "gts-22d15e560558": 20.25,
 "gts-340a8fb8fd1b": 12.25,
 "gts-0543c4e7937d": 6.25,
 "gts-15bd593c7213": 12.75,
 "gts-35a1f97adced": 22,
 "gts-03fcbffec868": 14.25,
 "gts-2e53703d58d3": 19,
 "gts-300690cbe721": 11.25,
 "gts-38d0cf7ec343": 13,
 "gts-15d60b07badd": 12.75,
 "gts-0a21c63c01cb": 15.75,
 "gts-2c2ea68f1aa8": 14.5,
 "gts-0c0954cae788": 19,
 "gts-1c4e3c07e0af": 17.5,
 "gts-12387d52e29e": 19,
 "gts-08385abd1971": 14.5,
 "gts-147650ee9574": 11.25,
 "gts-250ad434c5e6": 29.5,
 "gts-1a4692f6f43b": 10.75,
 "gts-325aaac28da7": 12.75,
 "gts-1049cd948b15": 14.25,
 "gts-4251138a4f0d": 24.75,
 "gts-11b4d02ce092": 15.75,
 "gts-0491d95961df": 14.25,
 "gts-1369283752a1": 12.75,
 "gts-1d06aabbf14e": 13,
 "gts-249739d8f434": 6.25,
 "gts-3a4f13bedc4e": 14.25,
 "gts-1cdfc95200fd": 19,
 "gts-029c2c3b62a3": 17.5,
 "gts-2e03da641ac1": 16.75,
 "gts-3fa8e8d6f21c": 14.25,
 "gts-2570937512fc": 17.5,
 "gts-067e8c17282b": 17.5,
 "gts-34e4ec19a037": 17.5,
 "gts-410e88d67713": 17.5,
 "gts-2620ca76c256": 15.75,
 "gts-070152d4228a": 16.75,
 "gts-398ceca84c57": 19,
 "gts-03213b0f79ad": 10,
 "gts-222b6eb83a82": 17.25,
 "gts-1fe18cb1eaf9": 20.5,
 "gts-25c9ad79cdcf": 11.5,
 "gts-18ff90018ce3": 5.25,
 "gts-085c681aae03": 25,
 "gts-38cbc1c48af1": 8.5,
 "gts-10f86aea5305": 21.25,
 "gts-2f9944756249": 1,
 "gts-0fa982bc54d9": 48,
 "gts-1b81545b4958": 33,
 "gts-04f653c8619a": 26.25,
 "gts-2bcfc33f89df": 28,
 "gts-04e191797857": 28,
 "gts-33e4f31dc1f8": 8.5,
 "gts-1bff44cc0642": 15.75,
 "gts-0968719770a6": 8.5,
 "yo-1-1172": 9.5,
 "yo-1-1075": 8,
 "yo-1-1394": 5.25,
 "yo-1-1337": 5.25,
 "yo-1-1340": 8.5,
 "yo-1-1385": 8.5,
 "yo-1-1061": 5.25,
 "yo-1-1392": 10.5,
 "yo-1-1346": 13,
 "yo-1-1348": 7,
 "yo-1-1255": 5.25,
 "yo-1-1035": 9.75,
 "yo-1-1108": 5.25,
 "yo-1-1296": 11.5,
 "yo-1-1314": 8.5,
 "yo-1-1220": 9.75,
 "yo-1-1074": 8.5,
 "yo-1-1138": -0.25,
 "yo-1-1081": 12.25,
 "yo-1-1285": 8.5,
 "yo-1-1047": 8.5,
 "yo-1-1190": 48,
 "yo-1-1249": 11.75,
 "yo-1-1286": 12.25,
 "yo-1-1379": 10.25,
 "yo-1-1089": 5.5,
 "yo-1-1373": 7.5,
 "yo-1-1079": 12.5,
 "yo-1-1243": 10.5,
 "yo-1-1160": 12.75,
 "yo-3-1128": 20.5,
 "yo-3-1291": 27.75,
 "yo-3-1336": 7,
 "yo-3-1334": 20.5,
 "yo-3-1015": 16,
 "yo-3-1358": 11.25,
 "yo-3-1247": 17.25,
 "yo-3-1021": 19,
 "yo-3-1157": 19,
 "yo-3-1094": 17.5,
 "yo-3-1042": 17.5,
 "yo-3-1273": 20.5,
 "yo-3-1022": 19,
 "yo-3-1149": 14,
 "yo-3-1322": 0.5,
 "yo-3-1111": 20.5,
 "yo-3-1191": 14.5,
 "yo-3-1188": 12,
 "yo-3-1120": 16,
 "yo-3-1159": 18.5,
 "yo-3-1342": 18.5,
 "yo-3-1183": 17.25,
 "yo-3-1145": 17.5,
 "yo-3-1039": 18.25,
 "yo-3-1352": 17.25,
 "yo-3-1298": 19.5,
 "yo-3-1227": 24.25,
 "yo-3-1036": 12.25,
 "yo-3-1062": 17.75,
 "yo-3-1400": 17.25,
 "yo-5-1222": 19,
 "yo-5-1206": 15,
 "yo-5-1166": 20.75,
 "yo-5-1203": 10.5,
 "yo-5-1178": 20.5,
 "yo-5-1124": 19,
 "yo-5-1187": 9.75,
 "yo-5-1068": 27.75,
 "yo-5-1225": 17.25,
 "yo-5-1234": 25,
 "yo-5-1003": 15.75,
 "yo-5-1023": 19.75,
 "yo-5-1152": 23.5,
 "yo-5-1181": 24.75,
 "yo-5-1032": 11,
 "yo-5-1066": 14.5,
 "yo-5-1142": 20.25,
 "yo-5-1155": 18.25,
 "yo-5-1029": 20.5,
 "yo-5-1052": 23.5,
 "yo-5-1210": 23.5,
 "yo-5-1131": 19,
 "yo-5-1194": 19.5,
 "yo-5-1212": 29.5,
 "yo-5-1138": 10.5,
 "yo-5-1209": 24.25,
 "yo-5-1031": 17.5,
 "yo-5-1148": 6.75,
 "yo-5-1205": 22.25,
 "yo-5-1106": 19,
 "yo-7-1214": 11.25,
 "yo-7-1319": 20.5,
 "yo-7-1051": 20.5,
 "yo-7-1191": 23.5,
 "yo-7-1067": 19,
 "yo-7-1071": 31,
 "yo-7-1240": 32.75,
 "yo-7-1164": 20.25,
 "yo-7-1107": 11.5,
 "yo-7-1253": 48,
 "yo-7-1042": 19,
 "yo-7-1225": 48,
 "yo-7-1088": 48,
 "yo-7-1174": 15.75,
 "yo-7-1066": 19,
 "yo-7-1276": 48,
 "yo-7-1254": 20.25,
 "yo-7-1315": 25,
 "yo-7-1145": 23.5,
 "yo-7-1224": 29.5,
 "yo-7-1057": 31,
 "yo-7-1188": 19,
 "yo-7-1220": 29.5,
 "yo-7-1009": 48,
 "yo-7-1148": 33,
 "yo-7-1197": 12.75,
 "yo-7-1091": 29.5,
 "yo-7-1131": 19,
 "yo-7-1040": 24.75,
 "yo-7-1298": 2.25
});
