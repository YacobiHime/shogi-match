// 棋力テストの問題。scripts/build-skill-test-items.mjs で生成したもので、手で書き換えない(docs/skill-assessment-design.mdの4章と10章)。
// いろいろなLvのCPUどうしの対局の局面から、問いの約束と審判のエンジンが一致する局面を選んだ(v2)。
// acceptedは正解の手(USI。約束を守る手のすべて)、choicesは3択の選択肢、bestは最善手、pvは答えからの読み筋、lineは答えのあとに盤で見せる3手。
// threatは何もしないときの相手の手(守る: 駒を取る手、受け: 詰み筋の1手目)、targetは取られそうな駒のマス、tesujiは手筋の形のid、targetsはその形でねらう駒のマス。
// cpuBは、CPUの各Lvに解かせて半分が解けたLv(難しさの元。人に合わせた補正はskill-test-bank.mjsのTYPE_OFFSETS)。
// 生成: CPUどうしの対局480局(seed 20261031〜20261034、各120局)、審判 60000nodes(二度目 400000nodes)、解かせたLv 1,4,7,10,13,16,19,22,25,28,31,34×2回。

export const SKILL_TEST_ITEMS = Object.freeze([
 {
  "id": "st2-take-0",
  "type": "take",
  "sfen": "ln3g2+B/1r1sgks2/p1pppp1pp/1p4P2/9/2P3bP1/PP1PPPN1P/2GSK2s1/LN3G1RL b NPl 1",
  "accepted": [
   "2i2h"
  ],
  "best": "2i2h",
  "pv": [
   "2i2h",
   "8d8e",
   "S*4e",
   "3f1d",
   "3g2e",
   "8e8f",
   "3d3c+"
  ],
  "cpuB": 0
 },
 {
  "id": "st2-take-1",
  "type": "take",
  "sfen": "ln1skgb+Pl/1r2g1s2/p1pp1pp2/4p2RP/9/1p7/PPPPPPP2/1BS1G4/LN2KGSNL w N2P 1",
  "accepted": [
   "8f8g+"
  ],
  "best": "8f8g+",
  "pv": [
   "8f8g+",
   "P*8c",
   "8b8c",
   "2a3a",
   "8g7h",
   "2d2b+",
   "S*6i"
  ],
  "cpuB": 18.75
 },
 {
  "id": "st2-take-2",
  "type": "take",
  "sfen": "ln1gk2n1/1r1s2g2/ppppppspl/3b3P1/6p2/1lP6/P2PPPP1P/1G3S1R1/+bNS1K1GNL b Pp 1",
  "accepted": [
   "2d2c+"
  ],
  "best": "2d2c+",
  "pv": [
   "2d2c+",
   "3b2c"
  ],
  "cpuB": 6.25
 },
 {
  "id": "st2-take-3",
  "type": "take",
  "sfen": "lr4knl/6g2/p1ng1p2p/2pps+Bpp1/1p2p4/2PPP1P2/PPS2PN1P/1KGSG2R1/LN6L w Sbp 1",
  "accepted": [
   "4c4d"
  ],
  "best": "4c4d",
  "pv": [
   "4c4d",
   "5f5e",
   "8e8f",
   "8g8f",
   "P*8e",
   "5e5d",
   "6c5d"
  ],
  "cpuB": 3.75
 },
 {
  "id": "st2-take-4",
  "type": "take",
  "sfen": "lns1kg1nl/4g4/p1pppp1pp/5+Bp2/1+r7/2P4P1/P1SPPPP1P/5S1R1/L1G1KG1NL w BSPnp 1",
  "accepted": [
   "4c4d"
  ],
  "best": "4c4d",
  "pv": [
   "4c4d",
   "P*8f",
   "8e8d",
   "B*2b",
   "N*3f",
   "2h1h",
   "3f4h+"
  ],
  "cpuB": 4.5
 },
 {
  "id": "st2-take-5",
  "type": "take",
  "sfen": "ln1gk1snl/1r1s2g2/p1pppp1pp/6p2/1p7/2P4R1/PP1PPPP1P/1+bG2S3/LNS1KG1NL b Pb 1",
  "accepted": [
   "7h8h",
   "7i8h"
  ],
  "best": "7i8h",
  "pv": [
   "7i8h",
   "3a2b",
   "8h7g",
   "6c6d",
   "5i6h",
   "7c7d",
   "3g3f"
  ],
  "cpuB": 1.5
 },
 {
  "id": "st2-take-6",
  "type": "take",
  "sfen": "lnsgk1snl/6g2/p1pppp2p/2r3pp1/9/3b5/P1GPPPP1P/3K1S1R1/LNS2G1NL b Pb3p 1",
  "accepted": [
   "7g6f",
   "6g6f"
  ],
  "best": "6g6f",
  "pv": [
   "6g6f",
   "7d8d",
   "P*8g",
   "3b2c",
   "3g3f",
   "6a5b",
   "4i5h"
  ],
  "cpuB": -10
 },
 {
  "id": "st2-take-7",
  "type": "take",
  "sfen": "ln5nl/4gbkg1/pr1p4+N/3sppsp1/P1p6/2P1P2RP/BpNG1P3/2GK5/L1S1S3L w 4P2p 1",
  "accepted": [
   "2a1c",
   "1a1c",
   "2b1c"
  ],
  "best": "2b1c",
  "pv": [
   "2b1c",
   "P*6e",
   "6d7c",
   "5f5e",
   "2d2e",
   "2f6f",
   "7c7d"
  ],
  "cpuB": 3.75
 },
 {
  "id": "st2-take-8",
  "type": "take",
  "sfen": "ln4knl/1r2g1g2/p1bpp1sp1/2pS1pp1p/1p5P1/2P1PBPR1/PP1P1PN1P/2G2S3/LN2KG2L w S 1",
  "accepted": [
   "7c6d",
   "6c6d"
  ],
  "best": "7c6d",
  "pv": [
   "7c6d",
   "4f6d",
   "6c6d",
   "4i5h",
   "8e8f",
   "8g8f",
   "8b8f"
  ],
  "cpuB": 3.5
 },
 {
  "id": "st2-take-9",
  "type": "take",
  "sfen": "+Bn1r1g1nl/6sk1/pp1g1p1p1/b1PpG1p1p/2S6/2pSKPP2/PP1P3P1/9/LNR2GSNL b LP2p 1",
  "accepted": [
   "5d6c"
  ],
  "best": "5d6c",
  "pv": [
   "5d6c",
   "6a6c",
   "9a8a",
   "6c6a",
   "8a7b",
   "8c8d",
   "7b6a"
  ],
  "cpuB": 13.75
 },
 {
  "id": "st2-take-10",
  "type": "take",
  "sfen": "l5+Pnl/1r2gks2/p1n1pp2p/2pps1PR1/1p4S2/2P6/PPGPPP2P/1B2G4/LNSK3N+b w Gl2p 1",
  "accepted": [
   "4b3a"
  ],
  "best": "4b3a",
  "pv": [
   "4b3a",
   "G*2b",
   "3a4b",
   "7g7h",
   "L*5e",
   "5g5f",
   "P*2c"
  ],
  "cpuB": 2.5
 },
 {
  "id": "st2-take-11",
  "type": "take",
  "sfen": "ln1g1+B2l/1r1s1s3/p1pppk2p/7P1/1p2B2+r1/2P3P2/PP1PPPS1P/3G5/LNS1K1GNL w N2Pgp 1",
  "accepted": [
   "2e5e"
  ],
  "best": "2e5e",
  "pv": [
   "2e5e",
   "N*3e",
   "5e3e",
   "3f3e",
   "6a5a",
   "R*2c",
   "G*3c"
  ],
  "cpuB": 9.75
 },
 {
  "id": "st2-take-12",
  "type": "take",
  "sfen": "ln1gk2nl/1rs2s1g1/p1p1pp2p/1p1p1Bpp1/5N3/2P3P2/PP1PPP2P/3S2SR1/LN1GKG2L w Bp 1",
  "accepted": [
   "4c4d"
  ],
  "best": "4c4d",
  "pv": [
   "4c4d",
   "4e5c+",
   "8d8e",
   "5c4b",
   "5a4b",
   "5i5h",
   "N*3b"
  ],
  "cpuB": 5.25
 },
 {
  "id": "st2-take-13",
  "type": "take",
  "sfen": "ln1g1g1nl/5k3/ppr+B2s1p/4pppp1/g2p5/2p1P1P2/PP1PSPN1P/1B1SK2R1/LN3G2L w S2p 1",
  "accepted": [
   "7c6c"
  ],
  "best": "7c6c",
  "pv": [
   "7c6c",
   "5f5e",
   "B*7h",
   "5e5d",
   "6a5b",
   "8h5e",
   "7h8i+"
  ],
  "cpuB": -10
 },
 {
  "id": "st2-take-14",
  "type": "take",
  "sfen": "ln2k1snl/1r1sg1g2/p1pppp2p/1p4pp1/9/2P6/PP1PPPP1P/1+bGSGS1R1/LN2K2NL b bp 1",
  "accepted": [
   "7h8h"
  ],
  "best": "7h8h",
  "pv": [
   "7h8h",
   "3a2b",
   "6h7g",
   "2b2c",
   "3g3f",
   "4c4d",
   "8h7h"
  ],
  "cpuB": -10
 },
 {
  "id": "st2-take-15",
  "type": "take",
  "sfen": "l2r2knl/2s2g3/p1n2ps2/2P1p2pp/1p2l1p2/1G1PP4/P2B1PP1P/3GRSK1+b/LN5N1 w GSP3p 1",
  "accepted": [
   "8e8f"
  ],
  "best": "8e8f",
  "pv": [
   "8e8f",
   "7d7c+",
   "G*2g",
   "3h4i",
   "1h2i",
   "7c7b",
   "6a6f"
  ],
  "cpuB": -0.25
 },
 {
  "id": "st2-take-16",
  "type": "take",
  "sfen": "ln2k1snl/1rs1g1g+P1/p1ppppp1p/7R1/1p7/2P6/PP1PPPP1P/1B7/LNSGKGSNL w Bp 1",
  "accepted": [
   "3a2b",
   "3b2b"
  ],
  "best": "3b2b",
  "pv": [
   "3b2b",
   "8h6f",
   "7c7d",
   "2d2e",
   "7b7c",
   "8i7g",
   "8e8f"
  ],
  "cpuB": 4.5
 },
 {
  "id": "st2-take-17",
  "type": "take",
  "sfen": "ln1sg1k1l/3r2g2/pGpbPp2p/3p2pP1/1SN6/2PPpGP1P/PPN1sP3/R4S3/L3K3L w B2Pn 1",
  "accepted": [
   "6c8e",
   "5g4f",
   "5g4f+",
   "5g4h",
   "5g4h+"
  ],
  "best": "5g4h",
  "pv": [
   "5g4h",
   "5i4h",
   "S*5g",
   "4h3h",
   "5g4f",
   "7e6c+",
   "G*3g"
  ],
  "cpuB": 15.25
 },
 {
  "id": "st2-take-18",
  "type": "take",
  "sfen": "l4r2l/2S2k2g/n3pp2n/p2p3p1/1ppb1PP1p/6GP1/1+n2RSN1P/1+l3SG1K/2+b5L w G3Ps3p 1",
  "accepted": [
   "7i5g"
  ],
  "best": "7i5g",
  "pv": [
   "7i5g",
   "4e4d",
   "5g6f",
   "4d4c+",
   "4b4c",
   "P*4d",
   "4c3b"
  ],
  "cpuB": 29.5
 },
 {
  "id": "st2-take-19",
  "type": "take",
  "sfen": "ln1g4l/1k2r4/1gsp1p1pp/ppp3p2/5n3/2P1PPsP1/PPNPSgP1P/3S1B1R1/L1K2GBNL b p 1",
  "accepted": [
   "4f4e",
   "3g3f"
  ],
  "best": "3g3f",
  "pv": [
   "3g3f",
   "4e5g+",
   "4h5g",
   "5b5f",
   "S*5h",
   "4g5g",
   "3i5g"
  ],
  "cpuB": -10
 },
 {
  "id": "st2-take-20",
  "type": "take",
  "sfen": "ln2g3l/rg1s1kg2/2pp1sn1p/5p3/p1Pbp2P1/P4PG1P/LPNPPS3/3S3R1/1+p2K2NL b 3Pb 1",
  "accepted": [
   "7g6e"
  ],
  "best": "7g6e",
  "pv": [
   "7g6e",
   "9e9f",
   "2e2d",
   "P*2e",
   "2i3g",
   "9f9g+",
   "3g2e"
  ],
  "cpuB": 2
 },
 {
  "id": "st2-take-21",
  "type": "take",
  "sfen": "lnsgk2nl/3r1sgb1/pp2ppppp/2p6/7P1/3pP4/PPPPGPPRP/1B1S1S3/LN1GK2NL w - 1",
  "accepted": [
   "6f6g+"
  ],
  "best": "6f6g+",
  "pv": [
   "6f6g+",
   "6h6g",
   "3c3d",
   "P*6f",
   "7a7b",
   "3g3f",
   "7b6c"
  ],
  "cpuB": 18.75
 },
 {
  "id": "st2-take-22",
  "type": "take",
  "sfen": "ln5nl/1r4gk1/p2p1gsp1/2p2pp2/4p3p/2sP1PPP1/P+p4S2/1PG2SGK1/LN2B2NL b Rb3p 1",
  "accepted": [
   "8h8g",
   "7h8g"
  ],
  "best": "8h8g",
  "pv": [
   "8h8g",
   "7f8g",
   "7h6h",
   "8g7f+",
   "8i7g",
   "8b8h+",
   "R*6a"
  ],
  "cpuB": 7.25
 },
 {
  "id": "st2-take-23",
  "type": "take",
  "sfen": "l5s1l/3g2k2/p2pppnpp/4n1p1b/2S4P1/5PP2/P1NPPS2P/7R1/L+B+pGKG1NL w RGPs2p 1",
  "accepted": [
   "7i8i",
   "7i6i"
  ],
  "best": "7i8i",
  "pv": [
   "7i8i",
   "R*8b",
   "S*6a",
   "7g6e",
   "3c2e",
   "6i6h",
   "B*4d"
  ],
  "cpuB": 5.25
 },
 {
  "id": "st2-take-24",
  "type": "take",
  "sfen": "lnsg3nl/1r1k2g2/p1pppp1pp/1pB2sP2/9/2P6/PPNPPPNPP/1S2G2R1/L2GK1S1L w BP 1",
  "accepted": [
   "7c7d"
  ],
  "best": "7c7d",
  "pv": [
   "7c7d",
   "3i4h",
   "7a7b",
   "4g4f",
   "8d8e",
   "6i7h",
   "B*6d"
  ],
  "cpuB": 5
 },
 {
  "id": "st2-take-25",
  "type": "take",
  "sfen": "1+R1Rp1snl/1+L2+Sbgk1/3p3pp/p1p2pps1/9/2P6/P1GP1PPPP/5SG2/L+p3K1NL w BGP2np 1",
  "accepted": [
   "5a5b"
  ],
  "best": "5a5b",
  "pv": [
   "5a5b",
   "G*4a",
   "2d3c",
   "7g6f",
   "2b1b",
   "B*5d",
   "S*4e"
  ],
  "cpuB": 8.5
 },
 {
  "id": "st2-take-26",
  "type": "take",
  "sfen": "l2+r2knl/5ggs1/p2p1ppp1/1P+S1p3p/3n2Ps1/B3R4/P1NPPP2P/1ppBK4/L2G1GSNL w Pp 1",
  "accepted": [
   "6e7g",
   "6e7g+"
  ],
  "best": "6e7g+",
  "pv": [
   "6e7g+",
   "6h7g",
   "8h8i+",
   "6i7h",
   "8i9i",
   "5f6f",
   "L*6d"
  ],
  "cpuB": 5.25
 },
 {
  "id": "st2-take-27",
  "type": "take",
  "sfen": "ln5nl/r1g2s1k1/3ppgbsp/p4pp2/2SP3pB/P2SP4/1GP2PP1P/1K5R1/LNG4NL w 3Pp 1",
  "accepted": [
   "3c1e"
  ],
  "best": "3c1e",
  "pv": [
   "3c1e",
   "7i7h",
   "9b8b",
   "P*8d",
   "4d4e",
   "1g1f",
   "1e2d"
  ],
  "cpuB": 13
 },
 {
  "id": "st2-take-28",
  "type": "take",
  "sfen": "lnS3knl/5r3/2p3Gp1/p3pp2p/2PP2Pg1/PP3P1nP/1GSSP1+b2/1K7/LN1R4L w 4Pbgs 1",
  "accepted": [
   "2a3c"
  ],
  "best": "2a3c",
  "pv": [
   "2a3c",
   "6e6d",
   "3g4g",
   "6i4i",
   "4g5g",
   "4i6i",
   "2e3e"
  ],
  "cpuB": 7.5
 },
 {
  "id": "st2-take-29",
  "type": "take",
  "sfen": "lns2k1nl/1r2g1g2/2pp1pspp/1p2p4/p4PpP1/9/PPPPP1+b1P/1BS1G3R/LNKG3NL b sp 1",
  "accepted": [
   "2i3g"
  ],
  "best": "2i3g",
  "pv": [
   "2i3g",
   "3e3f",
   "5h4g",
   "3f3g+",
   "4g3g",
   "P*3d",
   "7g7f"
  ],
  "cpuB": 2
 },
 {
  "id": "st2-take-30",
  "type": "take",
  "sfen": "ln3g2l/4g1sk1/p1p2p1pp/1r1sp1p2/7nP/1PPP1P3/P1S1P1P2/2GK3R1/LN3G2L b 2B3Psn 1",
  "accepted": [
   "2h2e"
  ],
  "best": "2h2e",
  "pv": [
   "2h2e",
   "6d5e",
   "N*5h",
   "N*9d",
   "B*9e",
   "8d8b",
   "B*7a"
  ],
  "cpuB": 11
 },
 {
  "id": "st2-take-31",
  "type": "take",
  "sfen": "ln4s1l/1Grk2g2/pSpp1pnpp/1p2p1p+r1/4b4/2P6/PP1PPPP1P/1SG2S3/LN2K1GNL w Pb 1",
  "accepted": [
   "7b8b"
  ],
  "best": "7b8b",
  "pv": [
   "7b8b",
   "8c8b+",
   "G*2h",
   "3i4i",
   "2h1i",
   "8b9a",
   "2d2i"
  ],
  "cpuB": 4
 },
 {
  "id": "st2-take-32",
  "type": "take",
  "sfen": "ln3g1nl/1r1s1k3/pp2ppsp1/3pb1p1p/1N7/PPpg2P1P/3PPP1P1/1R1S1GG2/L4KSNL b bp 1",
  "accepted": [
   "8e9c+",
   "6g6f"
  ],
  "best": "8e9c+",
  "pv": [
   "8e9c+",
   "9a9c"
  ],
  "cpuB": 7.25
 },
 {
  "id": "st2-take-33",
  "type": "take",
  "sfen": "ln2gg2l/1r1s1ks2/pppppp1pp/4b1P2/9/2P3SP1/PPBPPP+n1P/2GS3R1/LN2KG1NL b P 1",
  "accepted": [
   "2i3g"
  ],
  "best": "2i3g",
  "pv": [
   "2i3g",
   "5d3f",
   "4i3h",
   "4a3a",
   "7g1a+",
   "S*2b",
   "1a1b"
  ],
  "cpuB": 4.25
 },
 {
  "id": "st2-take-34",
  "type": "take",
  "sfen": "ln6l/1r1g2k2/pspp1p2p/1p2p1p2/5P3/2P1P4/PP1P2PsP/2GSG1bR1/LN2K2NL w BGSNPp 1",
  "accepted": [
   "2g2h",
   "2g2h+"
  ],
  "best": "2g2h",
  "pv": [
   "2g2h",
   "5i6i",
   "6b5b",
   "4e4d",
   "R*4i",
   "5h5i",
   "4i2i+"
  ],
  "cpuB": 9.75
 },
 {
  "id": "st2-take-35",
  "type": "take",
  "sfen": "lnsgk1s1l/4g2r1/pppppBnpp/6p2/9/2P6/PP1PPPPPP/2G2S1R1/LNS1KG1NL b Pb 1",
  "accepted": [
   "4c3d+"
  ],
  "best": "4c3d+",
  "pv": [
   "4c3d+",
   "3a3b",
   "3d5f",
   "3b4c",
   "5f8c",
   "4c5d",
   "8c5f"
  ],
  "cpuB": 3.25
 },
 {
  "id": "st2-take-36",
  "type": "take",
  "sfen": "l7r/3kg1s2/p2sp1n1p/2pp1ppg1/1p1nb2p1/2PP1PP2/PP2P3P/1SGKGS1R1/LN5NL b Lbp 1",
  "accepted": [
   "6f6e"
  ],
  "best": "6f6e",
  "pv": [
   "6f6e",
   "6d6e",
   "4h4g",
   "4d4e",
   "8i7g",
   "1a4a",
   "6h7i"
  ],
  "cpuB": 23.25
 },
 {
  "id": "st2-take-37",
  "type": "take",
  "sfen": "lns1kgg2/1r3s3/p1pp1pnp1/1p2p1p2/1P5P+B/2P6/PS2PSP1P/2GKG2Rp/LN5NL w BLPp 1",
  "accepted": [
   "1h1i+"
  ],
  "best": "1h1i+",
  "pv": [
   "1h1i+",
   "1e2f"
  ],
  "cpuB": -0.25
 },
 {
  "id": "st2-take-38",
  "type": "take",
  "sfen": "lng2g1nl/1r2sksb1/p1ppp2pp/1p3ppP1/9/2P6/PP1PPPP1P/2GS1S1R1/LN2KG1NL b b 1",
  "accepted": [
   "2d2c+"
  ],
  "best": "2d2c+",
  "pv": [
   "2d2c+",
   "3b2c",
   "2h2c+",
   "4a3b",
   "2c3d",
   "5b4c",
   "3d2e"
  ],
  "cpuB": 6.75
 },
 {
  "id": "st2-take-39",
  "type": "take",
  "sfen": "ln3ksnl/2rsg1g2/pp3p+Bpp/3pp1pP1/2p5P/2P1P4/PP1PSPP2/2GS3R1/LN2KG1NL w B 1",
  "accepted": [
   "2a3c",
   "3b3c"
  ],
  "best": "2a3c",
  "pv": [
   "2a3c",
   "2d2c+",
   "3b4b",
   "2c3c",
   "4b3c",
   "2h2a+",
   "5b4b"
  ],
  "cpuB": 2
 },
 {
  "id": "st2-take-40",
  "type": "take",
  "sfen": "lnsgkg1nl/5s1b1/p1ppr1ppp/4pp3/9/2P4P1/P+p1PPPP1P/1BGS1S1R1/LN2KG1NL b p 1",
  "accepted": [
   "7h8g"
  ],
  "best": "7h8g",
  "pv": [
   "7h8g",
   "3c3d",
   "5i6i",
   "5c5b",
   "6i7h",
   "4b3c",
   "4g4f"
  ],
  "cpuB": -10
 },
 {
  "id": "st2-take-41",
  "type": "take",
  "sfen": "ln5nl/6gk1/p2p1gsp1/2p2pp2/1r2p3p/1psP1PPP1/P1B3S2/1P+b1RSGK1/LN5NL b g3p 1",
  "accepted": [
   "5h7h"
  ],
  "best": "5h7h",
  "pv": [
   "5h7h",
   "7f6g",
   "7h7i",
   "5e5f",
   "B*4a",
   "8e5e",
   "4a6c+"
  ],
  "cpuB": 6.75
 },
 {
  "id": "st2-take-42",
  "type": "take",
  "sfen": "l1l+r2knl/5ggs1/p1P2ppp1/1P+Spp3p/1B1n2Ps1/1R1P5/P3PP2P/+npGBK4/5GSNL b Pp 1",
  "accepted": [
   "6f6e"
  ],
  "best": "6f6e",
  "pv": [
   "6f6e",
   "8h8i+",
   "7h7g",
   "8i8h",
   "P*2f",
   "2e2f",
   "8f2f"
  ],
  "cpuB": 31.25
 },
 {
  "id": "st2-take-43",
  "type": "take",
  "sfen": "lns1k2nl/1r2gs1+B1/pppppp1gp/6pp1/9/2P3P2/PP1PPP2P/7R1/LNSGKGSNL w Bp 1",
  "accepted": [
   "2c2b"
  ],
  "best": "2c2b",
  "pv": [
   "2c2b",
   "7i8h",
   "B*6d",
   "B*4f",
   "6d4f",
   "4g4f",
   "B*4g"
  ],
  "cpuB": -10
 },
 {
  "id": "st2-take-44",
  "type": "take",
  "sfen": "l2g2k1l/4s4/prnp1+Bngp/2p1sppp1/1p2p4/2PP1P3/PPS2KP1P/1G1R2G2/LN5NL b bs2p 1",
  "accepted": [
   "4c5d"
  ],
  "best": "4c5d",
  "pv": [
   "4c5d",
   "2c2b",
   "5d5e",
   "S*7i",
   "6h4h",
   "7i8h+",
   "4h8h"
  ],
  "cpuB": 8
 },
 {
  "id": "st2-take-45",
  "type": "take",
  "sfen": "lnsgk1snl/5g1r1/p2ppp1pp/2pB2p2/9/2P4P1/PP1PPPP1P/1S5R1/LN1GKGSNL w BP 1",
  "accepted": [
   "6c6d"
  ],
  "best": "6c6d",
  "pv": [
   "6c6d",
   "B*6c",
   "7a7b",
   "6c7d+",
   "B*6e",
   "7d6d",
   "6e4g+"
  ],
  "cpuB": 1.5
 },
 {
  "id": "st2-take-46",
  "type": "take",
  "sfen": "ln2k2nl/1r1sgsg+B1/p1pppp1pp/6p2/7P1/1pP6/PP1PPPP1P/2GS1S1R1/LN2KG1NL w B 1",
  "accepted": [
   "3b2b",
   "8f8g+"
  ],
  "best": "8f8g+",
  "pv": [
   "8f8g+",
   "7h8g",
   "3b2b",
   "P*8f",
   "B*7h",
   "8g8h",
   "8b8f"
  ],
  "cpuB": 0.5
 },
 {
  "id": "st2-take-47",
  "type": "take",
  "sfen": "l6nl/5ggk1/p2p2sp1/2p2pp2/2s5p/1+R1PpPPP1/P4S3/4PSGK1/LN5NL w RGN2b4p 1",
  "accepted": [
   "7e8f"
  ],
  "best": "7e8f",
  "pv": [
   "7e8f",
   "N*2e",
   "3c2d",
   "R*6a",
   "R*8h",
   "G*4a",
   "4b4a"
  ],
  "cpuB": 4.25
 },
 {
  "id": "st2-take-48",
  "type": "take",
  "sfen": "ln6l/3gksg2/1r1pspnpp/p1p1p4/6p2/P2b1P1P1/NpPPPSP1P/7R1/L1SGKG1NL b bp 1",
  "accepted": [
   "6g6f"
  ],
  "best": "6g6f",
  "pv": [
   "6g6f",
   "9d9e",
   "9f9e",
   "P*9f",
   "9e9d",
   "B*6g",
   "9d9c+"
  ],
  "cpuB": 7.75
 },
 {
  "id": "st2-take-49",
  "type": "take",
  "sfen": "ln5nl/1r1sgkg2/p1p+Bp1spp/1p1p1pp2/7P1/2PPSP3/PPS1P1P1P/2GKG2R1/LN5NL w B 1",
  "accepted": [
   "6b6c",
   "5b6c"
  ],
  "best": "6b6c",
  "pv": [
   "6b6c",
   "6h7i",
   "1c1d",
   "3g3f",
   "6c5d",
   "7i8h",
   "1d1e"
  ],
  "cpuB": 3.5
 },
 {
  "id": "st2-take-50",
  "type": "take",
  "sfen": "l5knl/1r2g2g1/p1n1pp2p/1pppsb1s1/6P2/2PPP1p1P/PPBSSPN2/2G1G4/LN2K2RL b 2p 1",
  "accepted": [
   "2i2d"
  ],
  "best": "2i2d",
  "pv": [
   "2i2d",
   "P*2c",
   "2d2g",
   "3f3g+",
   "2g3g",
   "N*4e",
   "3g3i"
  ],
  "cpuB": 15
 },
 {
  "id": "st2-take-51",
  "type": "take",
  "sfen": "lng5l/r5k2/p+Bpsp1s1p/4g1sp1/6n2/2P5R/PP2PP2P/2S1GK3/1N3G2L b LPbn6p 1",
  "accepted": [
   "8c9b"
  ],
  "best": "8c9b",
  "pv": [
   "8c9b",
   "9a9b",
   "R*5a",
   "P*3f",
   "4h5i",
   "N*6f",
   "5a7a+"
  ],
  "cpuB": 11
 },
 {
  "id": "st2-take-52",
  "type": "take",
  "sfen": "ln2k3l/3sg2g1/p1pb2npp/r2pSpp2/1p5P1/2P6/PPNS1PP1P/2GKG2R1/L5BNL w S2Pp 1",
  "accepted": [
   "6c5d"
  ],
  "best": "6c5d",
  "pv": [
   "6c5d",
   "3i6f",
   "5d7b",
   "2e2d",
   "2c2d",
   "2h2d",
   "P*2c"
  ],
  "cpuB": 8.25
 },
 {
  "id": "st2-take-53",
  "type": "take",
  "sfen": "lng6/1rs2k3/p3ppnp1/2gp1s3/1pG2b2p/2P1P+Bp2/P1NP1P1PP/3SGS1R1/L2K4L w Nl3p 1",
  "accepted": [
   "7d7e"
  ],
  "best": "7d7e",
  "pv": [
   "7d7e",
   "7f7e",
   "7b6c",
   "7e7d",
   "G*3e",
   "G*7c",
   "8a7c"
  ],
  "cpuB": 20.5
 },
 {
  "id": "st2-take-54",
  "type": "take",
  "sfen": "ln2kg1nl/6sb1/ps1pp1ppp/2pBr4/1P1N1p3/2P1P2P1/P2P1PP1P/3S1SGR1/L1G1K2NL w GP 1",
  "accepted": [
   "6c6d",
   "5d6d"
  ],
  "best": "5d6d",
  "pv": [
   "5d6d",
   "G*5e"
  ],
  "cpuB": 3.5
 },
 {
  "id": "st2-take-55",
  "type": "take",
  "sfen": "ln4knl/2r1g1g2/+B1sppp1pp/2p2sp2/1p1S3P1/2P2PP2/PPSPP3P/2G3GR1/LN2K2NL w Pb 1",
  "accepted": [
   "9a9c",
   "8a9c"
  ],
  "best": "9a9c",
  "pv": [
   "9a9c",
   "5i6h",
   "7b8b",
   "9g9f",
   "5b4b",
   "3h4g",
   "4d3c"
  ],
  "cpuB": 5.75
 },
 {
  "id": "st2-take-56",
  "type": "take",
  "sfen": "ln1gk1snl/1r1s2g2/p1pppp1pp/1p4p2/9/2P6/PP1PPPPPP/1+bG1RK3/LN2SGSNL b b 1",
  "accepted": [
   "7h8h"
  ],
  "best": "7h8h",
  "pv": [
   "7h8h",
   "B*4e",
   "3i3h",
   "4e6g+",
   "5h6h",
   "6g7f",
   "8h7g"
  ],
  "cpuB": 3.5
 },
 {
  "id": "st2-take-57",
  "type": "take",
  "sfen": "1n2gg1n1/l6+N1/2p1p1kp1/2s2p3/9/2P1SNb1l/PP2PP2P/2GK1S3/L3G2+rL b S7Prbp 1",
  "accepted": [
   "2b2a"
  ],
  "best": "2b2a",
  "pv": [
   "2b2a",
   "2i1i",
   "1g1f",
   "3f2g+",
   "P*3b",
   "3c2d",
   "3b3a+"
  ],
  "cpuB": 6.5
 },
 {
  "id": "st2-take-58",
  "type": "take",
  "sfen": "ln2kgsnl/3sg2p1/p1p1pp2p/3p1gpR1/9/2PB2P2/P1NPPPN1P/2BK1SG2/L+rS5L w 2Pp 1",
  "accepted": [
   "8i9i"
  ],
  "best": "8i9i",
  "pv": [
   "8i9i",
   "2d2i"
  ],
  "cpuB": 3.5
 },
 {
  "id": "st2-take-59",
  "type": "take",
  "sfen": "ln1k3nl/2g2s1b1/p1pppGppp/3s4r/1p7/3P1P1PP/PPP1RSP2/2S1G4/LNB1K2NL w G2P 1",
  "accepted": [
   "4b4c"
  ],
  "best": "4b4c",
  "pv": [
   "4b4c",
   "6f6e",
   "6d6e",
   "5g5c+",
   "G*5b",
   "5c5e",
   "6c6d"
  ],
  "cpuB": 1.75
 },
 {
  "id": "st2-take-60",
  "type": "take",
  "sfen": "6knl/1r2g1gs1/3pp2pp/6P2/1snP3P1/2S1Spn2/PPG1P3P/3K2G2/L6RL b N6P2bl 1",
  "accepted": [
   "7f8e",
   "7f7e"
  ],
  "best": "7f7e",
  "pv": [
   "7f7e",
   "L*7f",
   "7g6g",
   "B*4g",
   "2i3i",
   "B*7i",
   "3i7i"
  ],
  "cpuB": 9.25
 },
 {
  "id": "st2-take-61",
  "type": "take",
  "sfen": "ln5nl/3rg1k2/pS1pp1sg1/1ppB1pppp/9/2P1P1PRP/PP1P1PN2/2G2S3/LN2KG2L w Bsp 1",
  "accepted": [
   "6c6d"
  ],
  "best": "6c6d",
  "pv": [
   "6c6d",
   "B*7b",
   "4d4e",
   "3g4e",
   "B*4d",
   "4e3c+",
   "2c3c"
  ],
  "cpuB": 3.5
 },
 {
  "id": "st2-take-62",
  "type": "take",
  "sfen": "lns2k1nl/5r1g1/p1ppp+S1p1/8p/5pP2/1PP4R1/P2PPP2P/2GS5/+bN1K1G1NL b 3Pbgsl 1",
  "accepted": [
   "4c4b"
  ],
  "best": "4c4b",
  "pv": [
   "4c4b",
   "4a4b",
   "8i7g",
   "S*5b",
   "1g1f",
   "G*8h",
   "2i3g"
  ],
  "cpuB": 5.75
 },
 {
  "id": "st2-take-63",
  "type": "take",
  "sfen": "2r4nl/2+Bs2gk1/p1Ng1pspp/2ppp4/5Pp2/1g1SP+B1P1/P1N2S2P/1P1K4L/L1R2G1N1 b L4p 1",
  "accepted": [
   "7b7a"
  ],
  "best": "7b7a",
  "pv": [
   "7b7a",
   "6b7a",
   "7c6a+",
   "8f7f",
   "6f5g",
   "P*8g",
   "7g8e"
  ],
  "cpuB": 7
 },
 {
  "id": "st2-take-64",
  "type": "take",
  "sfen": "l5knl/5gg2/2np1p1pp/pr1spbp2/2P1sN3/1PSPPPP1P/P1BG1S3/4G2R1/LN1K4L b 3P 1",
  "accepted": [
   "5f5e"
  ],
  "best": "5f5e",
  "pv": [
   "5f5e",
   "4d5e",
   "P*5f",
   "5e4d",
   "S*7d",
   "P*8h",
   "7g8h"
  ],
  "cpuB": 19
 },
 {
  "id": "st2-take-65",
  "type": "take",
  "sfen": "ln1gk3l/1r3s1B1/p1pp1pnpp/4p4/8P/1PP3s2/P1BPPPN2/1G1KGS3/LNS3G+rL w 4P 1",
  "accepted": [
   "2i1i"
  ],
  "best": "2i1i",
  "pv": [
   "2i1i",
   "P*2i",
   "3f3g",
   "4h3g",
   "3c4e",
   "3g4f",
   "L*3d"
  ],
  "cpuB": 4.75
 },
 {
  "id": "st2-take-66",
  "type": "take",
  "sfen": "l2g2snl/2s2k3/p2pppgpp/2p3p1b/7P1/NPr2PP2/P1NPPS2P/1+p1K3R1/LG3G1NL b BSP 1",
  "accepted": [
   "8i8h"
  ],
  "best": "8i8h",
  "pv": [
   "8i8h",
   "7f8f",
   "P*8g",
   "8f8a",
   "1g1f",
   "9c9d",
   "1f1e"
  ],
  "cpuB": 5.5
 },
 {
  "id": "st2-take-67",
  "type": "take",
  "sfen": "ln6l/1r2g2g1/p1p1psk1p/1p1psp1p1/9/2P1PS1PB/PPSP1P+p1P/2KG1R3/LN1G3bL b Nnp 1",
  "accepted": [
   "4f3g"
  ],
  "best": "4f3g",
  "pv": [
   "4f3g",
   "P*3h",
   "1f3h",
   "2i3h+",
   "4h3h",
   "8d8e",
   "3g4h"
  ],
  "cpuB": 7
 },
 {
  "id": "st2-take-68",
  "type": "take",
  "sfen": "ln2g2nl/5gk2/p2ps2p+P/gBp2pps1/4p4/2PP5/P3PPP2/1BKSG4/LN2S2NL w RPr3p 1",
  "accepted": [
   "9d8d"
  ],
  "best": "9d8d",
  "pv": [
   "9d8d",
   "R*8b"
  ],
  "cpuB": 3.75
 },
 {
  "id": "st2-take-69",
  "type": "take",
  "sfen": "lnk4nl/2g4b1/p1pppsp1p/3R3p1/1pg5L/3P1P1P1/PPP1RSP1G/2S1G4/LNB1K2N1 w S2Pp 1",
  "accepted": [
   "6c6d"
  ],
  "best": "6c6d",
  "pv": [
   "6c6d",
   "5g5c+",
   "R*2h",
   "S*3h",
   "7e6f",
   "5c4c",
   "P*5g"
  ],
  "cpuB": -10
 },
 {
  "id": "st2-take-70",
  "type": "take",
  "sfen": "lr6l/3g1k2g/n2spp2n/p1ppS2p1/1p4P1p/5P1P1/1+n2RSN1P/1+l+b3G1K/4S3L b G2Pb4p 1",
  "accepted": [
   "5d6c",
   "5d6c+"
  ],
  "best": "5d6c+",
  "pv": [
   "5d6c+",
   "6b6c",
   "S*7b",
   "B*7e",
   "5g5h",
   "6c6b",
   "7b8a"
  ],
  "cpuB": 11.5
 },
 {
  "id": "st2-take-71",
  "type": "take",
  "sfen": "ln1g1k1nl/1r3sg2/p2ppp1pp/6p2/9/2sbPG3/P1P2PPPP/1+pGS2R2/LNB1KS1NL b P2p 1",
  "accepted": [
   "7h8h"
  ],
  "best": "7h8h",
  "pv": [
   "7h8h",
   "7f8g+",
   "6h6g",
   "8g8h",
   "3h8h",
   "8b8h+",
   "7i8h"
  ],
  "cpuB": 9.5
 },
 {
  "id": "st2-take-72",
  "type": "take",
  "sfen": "lnrn3nl/5kg2/p2p1gspp/1pP1s1p2/1B2p3P/2pP2P2/PP1S2SP1/2G1R1GK1/L6NL w BP2p 1",
  "accepted": [
   "8d8e"
  ],
  "best": "8d8e",
  "pv": [
   "8d8e",
   "5h4h",
   "6a5c",
   "6g7f",
   "7a7d",
   "7h6g",
   "3d3e"
  ],
  "cpuB": 3.75
 },
 {
  "id": "st2-take-73",
  "type": "take",
  "sfen": "lnsgkgsnl/7+B1/p1pppp1pp/6p2/2P6/1r7/Pp1PPPPPP/2G1GS1R1/LNS1K2NL w BP 1",
  "accepted": [
   "3a2b"
  ],
  "best": "3a2b",
  "pv": [
   "3a2b",
   "B*7g",
   "8f8b",
   "P*8c",
   "8b6b",
   "4g4f",
   "4a3b"
  ],
  "cpuB": 1.75
 },
 {
  "id": "st2-take-74",
  "type": "take",
  "sfen": "ln1gk2nl/5g1s1/p1rppp2p/1P1N1bpp1/2p6/1p1P1P3/P1P2G2B/2S2K2L/L5SN1 b RSg4p 1",
  "accepted": [
   "1g4d"
  ],
  "best": "1g4d",
  "pv": [
   "1g4d",
   "4c4d",
   "8d8c+",
   "7c8c",
   "B*6e",
   "8c7c",
   "6e2a+"
  ],
  "cpuB": 7.75
 },
 {
  "id": "st2-take-75",
  "type": "take",
  "sfen": "l3r1s1l/2g1kb3/ppspppNpp/9/7P1/1S1P2p1P/PP1GPP3/2GK1S1R1/LN6L w G2NPb2p 1",
  "accepted": [
   "4b3c"
  ],
  "best": "4b3c",
  "pv": [
   "4b3c",
   "2h3h",
   "3c5e",
   "3h3f",
   "5e1i+",
   "3f3c+",
   "1i5e"
  ],
  "cpuB": 9
 },
 {
  "id": "st2-take-76",
  "type": "take",
  "sfen": "l1sgk3+P/7+r1/p3ppp1p/2Np3ns/1Pg5b/1NGPPPL2/P1K2RP1P/1BS1G2P1/L1P1S3L w NPp 1",
  "accepted": [
   "7e7f"
  ],
  "best": "7e7f",
  "pv": [
   "7e7f",
   "7g7f",
   "2d3f",
   "1g1f",
   "1e2d",
   "3g3f",
   "P*7c"
  ],
  "cpuB": 4
 },
 {
  "id": "st2-take-77",
  "type": "take",
  "sfen": "l6nl/4gkg2/p4sb1p/1p1ppspp1/2rn1p3/1PP1P1P2/P2P1PN1P/1GK4R1/LNSG2S1L b Pbp 1",
  "accepted": [
   "7f7e"
  ],
  "best": "7f7e",
  "pv": [
   "7f7e",
   "6e5g+",
   "3i4h",
   "5g4h",
   "2h4h",
   "3d3e",
   "4g4f"
  ],
  "cpuB": 5.5
 },
 {
  "id": "st2-take-78",
  "type": "take",
  "sfen": "1k4+Ln1/l3r4/p1g1s4/1pp1+bgP+R1/N2ps4/2P2PpP1/1PSPP3P/2G1K1S2/LNN1BG2L b 5P 1",
  "accepted": [
   "3a2a",
   "2d2a"
  ],
  "best": "3a2a",
  "pv": [
   "3a2a",
   "9c9d",
   "3d3c+",
   "5e4f",
   "P*4g",
   "4f5g+",
   "5h5g"
  ],
  "cpuB": 9.5
 },
 {
  "id": "st2-take-79",
  "type": "take",
  "sfen": "ln1gk2nl/1rs2sg2/p1pppp1pp/6p2/7P1/2P6/PP1PPPP1P/1+bGS3R1/LN1K1GSNL b bp 1",
  "accepted": [
   "7h8h"
  ],
  "best": "7h8h",
  "pv": [
   "7h8h",
   "4b3c",
   "3i4h",
   "7c7d",
   "6g6f",
   "6c6d",
   "4i5h"
  ],
  "cpuB": 2
 },
 {
  "id": "st2-save-0",
  "type": "save",
  "sfen": "ln3k1nl/1sr1gs3/pp1p2gpp/2p1Ppp2/8b/2PBR3P/PPNP1PPP1/3S1SG2/L2GK2NL w P 1",
  "accepted": [
   "1e2d"
  ],
  "best": "1e2d",
  "pv": [
   "1e2d",
   "7g6e",
   "3c4c",
   "5i4i",
   "4a3b",
   "5f5i",
   "8a7c"
  ],
  "threat": "1f1e",
  "target": "1e",
  "cpuB": -0.75
 },
 {
  "id": "st2-save-1",
  "type": "save",
  "sfen": "ln2s1gnl/1r5b1/p1ppk1gpp/1p1s1pP2/4p4/1PP2P1P1/P1BP1S2P/2GSK1R2/LN1G3NL w Pp 1",
  "accepted": [
   "3c3b",
   "3c4c",
   "3c2d",
   "P*3g"
  ],
  "best": "3c4c",
  "pv": [
   "3c4c",
   "6g6f",
   "5c4b",
   "6h6g",
   "4b3b",
   "5h6h",
   "5a4b"
  ],
  "threat": "3d3c+",
  "target": "3c",
  "cpuB": 3.5
 },
 {
  "id": "st2-save-2",
  "type": "save",
  "sfen": "rn5nl/3s2gk1/1p1p1g1p1/2p1pp3/p6Np/2PPP1sP1/PPNSSP1RP/2GKG4/L7L b LP2bp 1",
  "accepted": [
   "2g2h",
   "2g2i"
  ],
  "best": "2g2i",
  "pv": [
   "2g2i",
   "B*3h",
   "2i3i",
   "3h2g+",
   "1g1f",
   "B*2h",
   "3i2i"
  ],
  "threat": "3f2g",
  "target": "2g",
  "cpuB": 9.75
 },
 {
  "id": "st2-save-3",
  "type": "save",
  "sfen": "ln3kbnl/2gs1s3/prpp1gppp/1p3P3/4B4/P1P1P4/1P1PS1PPP/4RSG2/LN1GK2NL w 2P 1",
  "accepted": [
   "4c5c",
   "4c5d",
   "4c3d"
  ],
  "best": "4c5d",
  "pv": [
   "4c5d",
   "5i4i",
   "8d8e",
   "4i3i",
   "5d5e",
   "5f5e",
   "8e8f"
  ],
  "threat": "4d4c+",
  "target": "4c",
  "cpuB": 7
 },
 {
  "id": "st2-save-4",
  "type": "save",
  "sfen": "ln5nl/1r1sg1kg1/p1p1bpsp1/3Sp1p1p/5P1P1/1PP1PBP1P/P2P1SN2/2GK2G2/LN5RL w 2P 1",
  "accepted": [
   "5c3a",
   "5c4b"
  ],
  "best": "5c4b",
  "pv": [
   "5c4b"
  ],
  "threat": "6d5c",
  "target": "5c",
  "cpuB": 5.25
 },
 {
  "id": "st2-save-5",
  "type": "save",
  "sfen": "ln2g2nl/5gkb1/pr1pspspp/2p1p1pP1/1p6P/2PP3R1/PP2PPP2/1BGSG4/LN1KS2NL w - 1",
  "accepted": [
   "3c2d",
   "2c2d"
  ],
  "best": "3c2d",
  "pv": [
   "3c2d",
   "8h7g",
   "8a7c",
   "6h6g",
   "6c6d",
   "5i6h",
   "6d6e"
  ],
  "threat": "2d2c+",
  "target": "2c",
  "cpuB": 7
 },
 {
  "id": "st2-save-6",
  "type": "save",
  "sfen": "l4k1nl/4gsgb1/n1p1ppppp/pr1p5/1s7/PBPP2PP1/1P2PP2P/3R1SG2/LNSGK2NL b P 1",
  "accepted": [
   "8f7e",
   "8f9g"
  ],
  "best": "8f7e",
  "pv": [
   "8f7e",
   "8d8b",
   "9f9e",
   "9d9e",
   "7i7h",
   "3c3d",
   "P*9d"
  ],
  "threat": "8e8f",
  "target": "8f",
  "cpuB": 5
 },
 {
  "id": "st2-save-7",
  "type": "save",
  "sfen": "ln2kg1nl/1r2g1s2/p2spp1pp/1ppp5/4b1SP1/2P6/PPGPPP2P/1B5R1/LNS1KG1NL b Pp 1",
  "accepted": [
   "3e4f",
   "4g4f",
   "2h1h",
   "P*3g"
  ],
  "best": "4g4f",
  "pv": [
   "4g4f",
   "P*3d",
   "5g5f",
   "5e7g+",
   "8h7g",
   "3d3e",
   "7g1a+"
  ],
  "threat": "5e2h+",
  "target": "2h",
  "cpuB": 8.5
 },
 {
  "id": "st2-save-8",
  "type": "save",
  "sfen": "lnsgk1gnl/2r6/pp1pp1spp/2p2p3/8b/2PS+B3P/PP1PPPPP1/2G1G2R1/LN1K2SNL w P 1",
  "accepted": [
   "1e2d"
  ],
  "best": "1e2d",
  "pv": [
   "1e2d",
   "5f2c",
   "7b2b",
   "2c5f",
   "7a7b",
   "2g2f",
   "3c4b"
  ],
  "threat": "1f1e",
  "target": "1e",
  "cpuB": 6.25
 },
 {
  "id": "st2-save-9",
  "type": "save",
  "sfen": "ln5nl/2gsgskb1/prppp2Pp/5pp2/2P2g1R1/3B5/P1NPPPP1P/2G2S3/L1K3SNL w 2Pp 1",
  "accepted": [
   "2b3a",
   "2b3c"
  ],
  "best": "2b3a",
  "pv": [
   "2b3a",
   "2c2b+",
   "3a2b",
   "P*2d",
   "4e3e",
   "2d2c+",
   "3b4a"
  ],
  "threat": "2c2b+",
  "target": "2b",
  "cpuB": 10
 },
 {
  "id": "st2-save-10",
  "type": "save",
  "sfen": "ln1gk2nl/1r1s1g3/p1ppps1pp/1p4p2/5P2b/4P2PP/PPPPG1P2/1BSK3R1/LN1GS2NL w P 1",
  "accepted": [
   "1e3c",
   "1e2d"
  ],
  "best": "1e3c",
  "pv": [
   "1e3c",
   "6h7i",
   "4b3b",
   "2h4h",
   "8d8e",
   "5i6h",
   "8e8f"
  ],
  "threat": "1f1e",
  "target": "1e",
  "cpuB": 1.5
 },
 {
  "id": "st2-save-11",
  "type": "save",
  "sfen": "l5snl/3sgkgb1/p2pppppp/2p1P4/3n5/1rP6/Pp1P1PPPP/1BGSRSG2/LN2K2NL b P 1",
  "accepted": [
   "5d5c+",
   "8h5e",
   "8h6f",
   "8h7i"
  ],
  "best": "8h6f",
  "pv": [
   "8h6f",
   "5c5d",
   "5i4i",
   "3c3d",
   "6h7i",
   "8f7f",
   "6f2b+"
  ],
  "threat": "8g8h+",
  "target": "8h",
  "cpuB": 2
 },
 {
  "id": "st2-save-12",
  "type": "save",
  "sfen": "ln2k3l/3sgs1g1/p1pbp1npp/1r1p1pp2/1p1SP4/2P4P1/PPNS1PP1P/2G1G2R1/L3K1BNL w P 1",
  "accepted": [
   "8d8b",
   "8d8c",
   "8d9d"
  ],
  "best": "8d8b",
  "pv": [
   "8d8b",
   "6e6d",
   "6c7b",
   "2f2e",
   "5a4a",
   "5i6i",
   "4b4c"
  ],
  "threat": "3i8d",
  "target": "8d",
  "cpuB": 3.75
 },
 {
  "id": "st2-save-13",
  "type": "save",
  "sfen": "lng1k2nl/3s2gr1/ppp1p1bpp/3p1s3/5+B3/2PP1P3/PPS1P1PPP/7R1/LNKG1GSNL b 2P 1",
  "accepted": [
   "4e3d",
   "4e5f",
   "4e3f",
   "4e6g",
   "4e7h"
  ],
  "best": "4e3d",
  "pv": [
   "4e3d",
   "6b6c"
  ],
  "threat": "4d4e",
  "target": "4e",
  "cpuB": 1.5
 },
 {
  "id": "st2-save-14",
  "type": "save",
  "sfen": "ln2s2nl/1r3gks1/p2pp1gpp/2pb1pp2/1pB4P1/2P3P2/PPSPPPS1P/1G5R1/LN1K1G1NL b - 1",
  "accepted": [
   "7e6d",
   "7e6f"
  ],
  "best": "7e6d",
  "pv": [
   "7e6d",
   "6c6d",
   "3g4f",
   "5a5b",
   "2i3g",
   "5b6c",
   "4i4h"
  ],
  "threat": "7d7e",
  "target": "7e",
  "cpuB": 5
 },
 {
  "id": "st2-save-15",
  "type": "save",
  "sfen": "ln2k2nl/1r1sgs1g1/p1pppp2p/1p1b2pR1/9/2PS5/PP1PPPP1P/2GK1S3/LN3G1NL w BPp 1",
  "accepted": [
   "4b3a",
   "4b3c",
   "P*2c"
  ],
  "best": "P*2c",
  "pv": [
   "P*2c",
   "2d3d",
   "8d8e",
   "8i7g",
   "5a4a",
   "6f7e",
   "6d5e"
  ],
  "threat": "2d2b+",
  "target": "2b",
  "cpuB": 8.5
 },
 {
  "id": "st2-save-16",
  "type": "save",
  "sfen": "ln1g3nl/1GsksBrg1/1ppp1p1pp/3gL3n/P3p4/2PP4R/1P2PP+p1P/3K4B/1S4SNL w P2p 1",
  "accepted": [
   "3b4b",
   "6d5d"
  ],
  "best": "6d5d",
  "pv": [
   "6d5d",
   "1h5d",
   "3b4b",
   "2i3g",
   "4b3b",
   "P*3h",
   "B*9g"
  ],
  "threat": "5d5b+",
  "target": "5b",
  "cpuB": 6.75
 },
 {
  "id": "st2-save-17",
  "type": "save",
  "sfen": "ln1gkgsnl/2s5r/ppp1pp1p1/3p2p1p/1bP4P1/1P7/P1BPPPP1P/3S1SGR1/LN1GK2NL w - 1",
  "accepted": [
   "8e5b",
   "8e6c",
   "8e9d",
   "8e7f"
  ],
  "best": "8e6c",
  "pv": [
   "8e6c",
   "2e2d",
   "2c2d",
   "2h2d",
   "P*2b",
   "2d3d",
   "5a6b"
  ],
  "threat": "8f8e",
  "target": "8e",
  "cpuB": 3.5
 },
 {
  "id": "st2-save-18",
  "type": "save",
  "sfen": "ln1gk2nl/1rs2sg2/p1pppp1pp/6p2/1p3l3/2P2BPP1/PP2PP2P/1G1K2SR1/+bNS2G1NL b p 1",
  "accepted": [
   "4f5e",
   "4f3g"
  ],
  "best": "4f5e",
  "pv": [
   "4f5e",
   "2a3c",
   "6h7h",
   "8e8f",
   "8g8f",
   "8b8f",
   "5e7g"
  ],
  "threat": "4e4f",
  "target": "4f",
  "cpuB": 3.5
 },
 {
  "id": "st2-save-19",
  "type": "save",
  "sfen": "lr2k1g2/2s5+P/+S3g1p1L/3pp2p1/2P3Pn1/3PP+R3/PP1S1S2b/2GK1P1+bl/L4G3 b 3N5Pp 1",
  "accepted": [
   "N*4c"
  ],
  "best": "N*4c",
  "pv": [
   "N*4c",
   "5a5b",
   "4c3a+",
   "9a9c",
   "N*7d",
   "P*4e",
   "4f4e"
  ],
  "threat": "2h4f",
  "target": "4f",
  "cpuB": 32.75
 },
 {
  "id": "st2-save-20",
  "type": "save",
  "sfen": "ln5nl/2s1gk3/p2ppgspp/1rp3pb1/5p1P1/1PPS2P2/P2PPPN1P/4RKS2/LNBG1G2L w P 1",
  "accepted": [
   "2d1e"
  ],
  "best": "2d1e",
  "pv": [
   "2d1e",
   "5h8h",
   "8a7c",
   "1g1f",
   "1e2f",
   "3h2g",
   "2f4d"
  ],
  "threat": "2e2d",
  "target": "2d",
  "cpuB": 2.75
 },
 {
  "id": "st2-save-21",
  "type": "save",
  "sfen": "1n+B4nl/5kg2/p1ppng1pp/+br2ssp2/Pp2p3P/3P1pPP1/1P1S3G1/2G2S1K1/L2+p1R1NL w l2p 1",
  "accepted": [
   "9d8c"
  ],
  "best": "9d8c",
  "pv": [
   "9d8c",
   "6f6e",
   "8c6e",
   "2g3g",
   "5e5f",
   "4i6i",
   "5f5g+"
  ],
  "threat": "9e9d",
  "target": "9d",
  "cpuB": 6.75
 },
 {
  "id": "st2-save-22",
  "type": "save",
  "sfen": "ln1gkg1nl/2s3sb1/prppppppp/1p5R1/9/9/PPPPPPP1P/1BGS5/LN2KGSNL b P 1",
  "accepted": [
   "2d2e",
   "2d2f",
   "2d2g",
   "2d2h"
  ],
  "best": "2d2f",
  "pv": [
   "2d2f",
   "3c3d",
   "2f2h",
   "4c4d",
   "7g7f",
   "8d8e",
   "8h7g"
  ],
  "threat": "2c2d",
  "target": "2d",
  "cpuB": 1.5
 },
 {
  "id": "st2-save-23",
  "type": "save",
  "sfen": "lng2gb1l/1r3k3/p1pp1snPp/4p2S1/1p2bp3/2P1P3+R/PPNP1PP1P/L1GS1S3/4KG1NL w 2P 1",
  "accepted": [
   "5e6d",
   "5e4d"
  ],
  "best": "5e6d",
  "pv": [
   "5e6d",
   "4h5g",
   "4a3b",
   "5g6f",
   "8e8f",
   "8g8f",
   "6d8f"
  ],
  "threat": "5f5e",
  "target": "5e",
  "cpuB": 5.25
 },
 {
  "id": "st2-save-24",
  "type": "save",
  "sfen": "lnsgk1snl/6g2/p1ppppprb/7PR/9/9/PPPPPPP1P/1BS3S2/LN1GKG1NL w 3p 1",
  "accepted": [
   "2c2b",
   "2c2d"
  ],
  "best": "2c2b",
  "pv": [
   "2c2b",
   "1g1f",
   "P*2h",
   "2i1g",
   "P*1b",
   "1d1e",
   "2b2d"
  ],
  "threat": "2d2c+",
  "target": "2c",
  "cpuB": -10
 },
 {
  "id": "st2-save-25",
  "type": "save",
  "sfen": "ln3g1nl/3sgk1s1/p1p1pp1pp/1r4p2/B2N5/2PP1P1P1/PP1SP1P1P/2G2S1R1/L3KG1NL w Pbp 1",
  "accepted": [
   "8d8b",
   "8d8c",
   "8d9d",
   "8d7d",
   "8d6d",
   "8d5d",
   "8d4d",
   "8d8e"
  ],
  "best": "8d8c",
  "pv": [
   "8d8c",
   "9e7g",
   "P*6d",
   "4h4g",
   "4b3b",
   "4i5h",
   "7c7d"
  ],
  "threat": "9e8d",
  "target": "8d",
  "cpuB": 1.75
 },
 {
  "id": "st2-save-26",
  "type": "save",
  "sfen": "ln1gkg1nl/3s1s1b1/prpp1p1pp/1p2p1p2/3B1P3/2PP5/PPG1P1PPP/3KGS1R1/LNS4NL w - 1",
  "accepted": [
   "8c8b",
   "7c7d"
  ],
  "best": "8c8b",
  "pv": [
   "8c8b",
   "2g2f",
   "6c6d",
   "6e5f",
   "4a3b",
   "2f2e",
   "4b3c"
  ],
  "threat": "6e8c+",
  "target": "8c",
  "cpuB": -8
 },
 {
  "id": "st2-save-27",
  "type": "save",
  "sfen": "lns2g1nl/4g1ks1/p1pppp1pp/7s1/1P3B3/4B1P2/PGNPP1S1P/3K3R1/L3G+r1NL w 5p 1",
  "accepted": [
   "4i3i"
  ],
  "best": "4i3i",
  "pv": [
   "4i3i",
   "2h2f",
   "2a3c",
   "4e3d",
   "2d2e",
   "3d2e",
   "3c2e"
  ],
  "threat": "5i4i",
  "target": "4i",
  "cpuB": 2
 },
 {
  "id": "st2-save-28",
  "type": "save",
  "sfen": "ln4snl/1r1sgkg2/p1p1pp1pp/1p1p2pR1/9/2P3P2/PPSPPP2P/5S3/LN1GKG1NL b BPb 1",
  "accepted": [
   "2d3d",
   "2d2e",
   "2d2f",
   "2d2g",
   "2d2h"
  ],
  "best": "2d2h",
  "pv": [
   "2d2h",
   "6b6c",
   "4g4f",
   "1c1d",
   "4h4g",
   "9c9d",
   "4i4h"
  ],
  "threat": "2c2d",
  "target": "2d",
  "cpuB": -0.75
 },
 {
  "id": "st2-save-29",
  "type": "save",
  "sfen": "lnsgkgsnl/4r2b1/ppp2pp1p/7p1/3pp4/2PB5/PP1PPPPPP/2GS2R2/LN2KGSNL b - 1",
  "accepted": [
   "6f7e",
   "6f7g",
   "6f8h"
  ],
  "best": "6f7g",
  "pv": [
   "6f7g",
   "7c7d",
   "3i4h",
   "4a3b",
   "3g3f",
   "7a6b",
   "5i6i"
  ],
  "threat": "6e6f",
  "target": "6f",
  "cpuB": 3.5
 },
 {
  "id": "st2-save-30",
  "type": "save",
  "sfen": "ln1gkg1nl/1r1s5/p2+bp1spp/2p2pp2/1pBp5/2P1P2P1/PP1P1PG1P/L1GSR4/1N2K1SNL b p 1",
  "accepted": [
   "7e5g",
   "7e4h"
  ],
  "best": "7e4h",
  "pv": [
   "7e4h",
   "8e8f",
   "8g8f",
   "8b8f",
   "P*8g",
   "8f8b",
   "6g6f"
  ],
  "threat": "7d7e",
  "target": "7e",
  "cpuB": 1.5
 },
 {
  "id": "st2-save-31",
  "type": "save",
  "sfen": "ln2kgsnl/1r1s2g2/pppppp1pp/1b4p2/1P7/5P3/P1PSP1PPP/1BG1GS1R1/LN2K2NL w p 1",
  "accepted": [
   "8d9e",
   "8d7e"
  ],
  "best": "8d9e",
  "pv": [
   "8d9e",
   "4h4g",
   "3a2b",
   "9g9f",
   "9e8f",
   "5i6i",
   "8f6d"
  ],
  "threat": "8e8d",
  "target": "8d",
  "cpuB": 3.5
 },
 {
  "id": "st2-save-32",
  "type": "save",
  "sfen": "ln1gk1snl/1r1s2gb1/p1pppp1pp/1p4pR1/9/9/PPPPPPP1P/1B1S5/LN1GKGSNL b P 1",
  "accepted": [
   "2d3d",
   "2d2e",
   "2d2f",
   "2d2g",
   "2d2h"
  ],
  "best": "2d3d",
  "pv": [
   "2d3d",
   "8d8e",
   "3d3f",
   "5a4a",
   "6i7h",
   "6a5b",
   "3i2h"
  ],
  "threat": "2c2d",
  "target": "2d",
  "cpuB": 1.75
 },
 {
  "id": "st2-save-33",
  "type": "save",
  "sfen": "1n1gkg1nl/+B1s6/pp1p1pspp/1bp3p2/9/2P3PP1/PP1P+rPS1P/2K1G2R1/LNSG3NL w LPp 1",
  "accepted": [
   "5g5b",
   "5g5c",
   "5g5d",
   "5g5e",
   "5g5f"
  ],
  "best": "5g5d",
  "pv": [
   "5g5d",
   "5h4h",
   "3c4d",
   "7i6h",
   "5d6e",
   "3g4f",
   "P*5f"
  ],
  "threat": "5h5g",
  "target": "5g",
  "cpuB": -10
 },
 {
  "id": "st2-save-34",
  "type": "save",
  "sfen": "lngkg2nl/5s3/pp1p1p1pp/1sP3p2/4r2Pn/1P1P1PP2/P3G1S1P/2+pSP2R1/L3KG1NL b BPb 1",
  "accepted": [
   "6h6g"
  ],
  "best": "6h6g",
  "pv": [
   "6h6g",
   "B*7g",
   "5i4h",
   "7g9i+",
   "B*2b",
   "5e7e",
   "2b1a+"
  ],
  "threat": "7h6h",
  "target": "6h",
  "cpuB": 13
 },
 {
  "id": "st2-save-35",
  "type": "save",
  "sfen": "ln1s2knl/5gsb1/p1+P1p1ppp/1rG2p3/1p2B4/6P2/PPSPPP2P/9/LN1GKGSNL w 3Pr 1",
  "accepted": [
   "8d9d"
  ],
  "best": "8d9d",
  "pv": [
   "8d9d",
   "P*7b",
   "6a7b",
   "7c7b",
   "9d7d",
   "5e9a+",
   "4d4e"
  ],
  "threat": "7d8d",
  "target": "8d",
  "cpuB": 3.5
 },
 {
  "id": "st2-save-36",
  "type": "save",
  "sfen": "lnr2k1nl/3g1sgb1/p2pppppp/1p1s3R1/2P6/1P1P5/P1NSPPP1P/1BG1GS3/L3K2NL b 2P 1",
  "accepted": [
   "2d2e",
   "2d2f",
   "2d2g",
   "2d2h"
  ],
  "best": "2d2e",
  "pv": [
   "2d2e",
   "3c3d"
  ],
  "threat": "2c2d",
  "target": "2d",
  "cpuB": 1.5
 },
 {
  "id": "st2-save-37",
  "type": "save",
  "sfen": "ln3k1nl/1r2sggb1/3pp1s1p/p1p3pp1/Bp3p3/2P3PR1/PP1PPPS1P/1SKGG4/LN5NL b p 1",
  "accepted": [
   "9e7g"
  ],
  "best": "9e7g",
  "pv": [
   "9e7g",
   "5c5d",
   "3f3e",
   "3d3e",
   "4g4f",
   "5b4c",
   "4f4e"
  ],
  "threat": "9d9e",
  "target": "9e",
  "cpuB": 5.25
 },
 {
  "id": "st2-save-38",
  "type": "save",
  "sfen": "ln2kg1nl/3p1b1b1/ps1G1sppp/2p6/1P3p3/1r5P1/P1PPPPP1P/3S1SGR1/L1G2K1NL b Pnp 1",
  "accepted": [
   "8e8d"
  ],
  "best": "8e8d",
  "pv": [
   "8e8d",
   "8f8d",
   "P*8b",
   "6b6c",
   "8b8a+",
   "3c3d",
   "8a9a"
  ],
  "threat": "6b6c",
  "target": "6c",
  "cpuB": 17.75
 },
 {
  "id": "st2-save-39",
  "type": "save",
  "sfen": "ln1gk1snl/3sr1gb1/pppp1pppp/4p2R1/9/9/PPPPPPP1P/1B1S1S3/LN1GKG1NL b P 1",
  "accepted": [
   "2d2e",
   "2d2f",
   "2d2g",
   "2d2h"
  ],
  "best": "2d2h",
  "pv": [
   "2d2h",
   "6b5c",
   "6i7h",
   "4c4d",
   "5i6i",
   "3c3d",
   "3g3f"
  ],
  "threat": "2c2d",
  "target": "2d",
  "cpuB": -0.75
 },
 {
  "id": "st2-save-40",
  "type": "save",
  "sfen": "ln5nl/2gsgskb1/p1ppp1pPp/5p3/5r1p1/1pP6/P2PPPP1P/1BG1GS1R1/LNK3SNL w p 1",
  "accepted": [
   "3b2c",
   "2b3a"
  ],
  "best": "2b3a",
  "pv": [
   "2b3a"
  ],
  "threat": "2c2b+",
  "target": "2b",
  "cpuB": 1.5
 },
 {
  "id": "st2-save-41",
  "type": "save",
  "sfen": "lns2g1nl/4g1k2/p1pppp1pp/5r1s1/1P7/2+b1B1P2/PSNPP1S1P/2GKG2R1/L6NL w 5p 1",
  "accepted": [
   "7f5d",
   "7f7e"
  ],
  "best": "7f7e",
  "pv": [
   "7f7e",
   "5h4g",
   "P*8f",
   "8g9f",
   "7c7d",
   "4g4f",
   "4d5d"
  ],
  "threat": "8g7f",
  "target": "7f",
  "cpuB": -0.25
 },
 {
  "id": "st2-save-42",
  "type": "save",
  "sfen": "lng1bg2l/1r4kb1/p1pp1snPp/4p2S1/P4p3/1pP1P1+R2/1PNP1PP1P/L1GSGS3/4K2NL w Pp 1",
  "accepted": [
   "2b3a"
  ],
  "best": "2b3a",
  "pv": [
   "2b3a",
   "8g8f",
   "8b8f",
   "P*8h",
   "P*3d",
   "1g1f",
   "3a5c"
  ],
  "threat": "2c2b+",
  "target": "2b",
  "cpuB": 3.25
 },
 {
  "id": "st2-save-43",
  "type": "save",
  "sfen": "lns1kgs1l/3rg4/2pp1pnpp/4p1p2/pp2b4/2PB1SPP1/PPNPPP2P/2S1G2R1/L1KG3NL w - 1",
  "accepted": [
   "5e4d",
   "5e6f"
  ],
  "best": "5e6f",
  "pv": [
   "5e6f",
   "6g6f",
   "6b8b",
   "3f3e",
   "3d3e",
   "2f2e",
   "4a3b"
  ],
  "threat": "4f5e",
  "target": "5e",
  "cpuB": 8
 },
 {
  "id": "st2-save-44",
  "type": "save",
  "sfen": "1+r4s1l/3+BG1sk1/4pl1p1/2p2gBnp/5nnS1/2P1P2P1/3P2P1P/2g1SK2R/5G1+lL b 5Pn3p 1",
  "accepted": [
   "3d4e"
  ],
  "best": "3d4e",
  "pv": [
   "3d4e",
   "4d4e",
   "N*3d",
   "2b1b",
   "P*4d",
   "4e4d",
   "P*4f"
  ],
  "threat": "4d3d",
  "target": "3d",
  "cpuB": 17
 },
 {
  "id": "st2-save-45",
  "type": "save",
  "sfen": "lns1kg1nl/7r1/p1gppsb1p/1pp2pp2/9/2P1PPP2/PP1PSS1+pP/1B1GG2R1/LN2K2NL b p 1",
  "accepted": [
   "2h4h"
  ],
  "best": "2h4h",
  "pv": [
   "2h4h",
   "P*2h",
   "4f4e",
   "2h2i+",
   "4g4f",
   "2i1i",
   "5i6i"
  ],
  "threat": "2g2h",
  "target": "2h",
  "cpuB": 3.75
 },
 {
  "id": "st2-save-46",
  "type": "save",
  "sfen": "ln3b1nl/4s1k2/p2bp1gpp/1P1p1pP2/GNP3R1P/2S4P1/PSNP1P1S1/4G4/+p2GK2RL w 2Plp 1",
  "accepted": [
   "3c4c",
   "3c2d"
  ],
  "best": "3c2d",
  "pv": [
   "3c2d",
   "3e3h",
   "P*3g",
   "3h3g",
   "L*3e",
   "3d3c+",
   "2a3c"
  ],
  "threat": "3d3c+",
  "target": "3c",
  "cpuB": 9.5
 },
 {
  "id": "st2-save-47",
  "type": "save",
  "sfen": "ln1gkg1nl/6s2/p2pppbpp/1sp2b3/1p4p2/2P3RP1/PPSPPPPRP/2G1G4/LNK3SNL b - 1",
  "accepted": [
   "3f5f",
   "3f4f"
  ],
  "best": "3f5f",
  "pv": [
   "3f5f",
   "7d7e",
   "2f2e",
   "8a7c",
   "2g2h",
   "5a4b",
   "5f2f"
  ],
  "threat": "3e3f",
  "target": "3f",
  "cpuB": 5.25
 },
 {
  "id": "st2-save-48",
  "type": "save",
  "sfen": "lnsgk1s1l/6gr1/p1ppppnp1/1p6p/4b1p1B/P1P5P/1P1PPPPP1/R4SG2/LNSGK2NL b - 1",
  "accepted": [
   "1e2f",
   "5g5f"
  ],
  "best": "1e2f",
  "pv": [
   "1e2f",
   "5e4d",
   "4g4f",
   "3a4b",
   "4h4g",
   "2c2d",
   "3g3f"
  ],
  "threat": "1d1e",
  "target": "1e",
  "cpuB": 1.5
 },
 {
  "id": "st2-save-49",
  "type": "save",
  "sfen": "lnsgkg1nl/7b1/p1ppppspp/6p2/9/1rP6/PP1PPPPPP/1BGK2GR1/LNS1S2NL w p 1",
  "accepted": [
   "8f8b",
   "8f8c",
   "8f8d",
   "8f8e",
   "8f7f"
  ],
  "best": "8f7f",
  "pv": [
   "8f7f",
   "2g2f",
   "3c4d",
   "2f2e",
   "2b3c",
   "9g9f",
   "4a3b"
  ],
  "threat": "8g8f",
  "target": "8f",
  "cpuB": -0.25
 },
 {
  "id": "st2-save-50",
  "type": "save",
  "sfen": "lnB5l/5rg2/4S1n1p/p1pppgpPk/1p7/P1P1S1P2/1P1PP3P/2GKG4/LNS5L w Srbn3p 1",
  "accepted": [
   "4b4a",
   "4b7b"
  ],
  "best": "4b7b",
  "pv": [
   "4b7b",
   "5c4d+",
   "7b7a",
   "4d3d",
   "R*2i",
   "G*1f",
   "B*3g"
  ],
  "threat": "5c4b",
  "target": "4b",
  "cpuB": 8.5
 },
 {
  "id": "st2-save-51",
  "type": "save",
  "sfen": "ln1g3nl/1ks2r1s1/pppp1g1pp/4p4/5pbP1/4P1P2/PPPP1PN1P/1BGSG1S2/LNK4RL w p 1",
  "accepted": [
   "3e7a",
   "3e6b",
   "3e5c",
   "3e4d"
  ],
  "best": "3e4d",
  "pv": [
   "3e4d",
   "7g7f",
   "4d8h+",
   "7i8h",
   "4b3b",
   "B*6f",
   "5d5e"
  ],
  "threat": "3f3e",
  "target": "3e",
  "cpuB": 5.25
 },
 {
  "id": "st2-save-52",
  "type": "save",
  "sfen": "ln6l/1r3kg1s/p1ppbgn2/3S1ppPp/4s4/1PP3PRP/P1NPPP3/2G6/L1K2G2L w BS3Pn 1",
  "accepted": [
   "6c6d",
   "5c6d",
   "5e6d",
   "N*8g"
  ],
  "best": "5c6d",
  "pv": [
   "5c6d",
   "B*6a",
   "8b6b",
   "6a4c+",
   "4b4c",
   "G*6e",
   "B*3g"
  ],
  "threat": "6d5c",
  "target": "5c",
  "cpuB": -0.25
 },
 {
  "id": "st2-save-53",
  "type": "save",
  "sfen": "ln1gk2nl/3s1sgb1/p1ppppppp/9/7P1/1r2P4/PpPP1PP1P/1BGSR1G2/LN2K1SNL b P 1",
  "accepted": [
   "8h7i"
  ],
  "best": "8h7i",
  "pv": [
   "8h7i",
   "3c3d",
   "5f5e",
   "5a4a",
   "7g7f",
   "8f8e",
   "6h7g"
  ],
  "threat": "8g8h+",
  "target": "8h",
  "cpuB": 8.5
 },
 {
  "id": "st2-save-54",
  "type": "save",
  "sfen": "lns1gg1nl/1r3ks2/p1p1p2p1/1p1p2p1p/4P4/1P3pP1P/P1PP3PN/1BSGG4/LN1K2SrL b Bp 1",
  "accepted": [
   "B*2h"
  ],
  "best": "B*2h",
  "pv": [
   "B*2h",
   "8d8e",
   "7g7f",
   "2a3c",
   "8f8e",
   "8b8e",
   "P*8g"
  ],
  "threat": "2i3i+",
  "target": "3i",
  "cpuB": 10.75
 },
 {
  "id": "st2-save-55",
  "type": "save",
  "sfen": "lnsgkg1nl/1r4sb1/p1ppppppp/1p5R1/9/2P6/PP1PPPP1P/1B1S5/LN1GKGSNL b P 1",
  "accepted": [
   "2d3d",
   "2d2e",
   "2d2f",
   "2d2g",
   "2d2h"
  ],
  "best": "2d2e",
  "pv": [
   "2d2e",
   "8d8e",
   "8h7g",
   "7a6b",
   "3g3f",
   "7c7d",
   "6i7h"
  ],
  "threat": "2c2d",
  "target": "2d",
  "cpuB": 5.25
 },
 {
  "id": "st2-save-56",
  "type": "save",
  "sfen": "ln2g2nl/1r4ks1/2pps1ppp/p3pp3/Bp7/2P1+B3P/PP1PPPPS1/1SG6/LN2KG1NG b Prl 1",
  "accepted": [
   "9e7g",
   "9e6h"
  ],
  "best": "9e7g",
  "pv": [
   "9e7g",
   "5a5b",
   "1i2h",
   "5b4c",
   "4g4f",
   "3c3d",
   "2h3h"
  ],
  "threat": "9d9e",
  "target": "9e",
  "cpuB": -10
 },
 {
  "id": "st2-save-57",
  "type": "save",
  "sfen": "ln3g1nl/1r1s1k1s1/pp1gpp1p1/2ppb1p1p/2P6/P2B4P/1PNPPPPP1/1R4G2/L1S1GKSNL w - 1",
  "accepted": [
   "4a3a",
   "4a3b",
   "2a3c",
   "4b3a",
   "4b3b",
   "2b3c",
   "4c4d"
  ],
  "best": "4b3b",
  "pv": [
   "4b3b",
   "7e7d",
   "6c7d",
   "3i4h",
   "P*7f",
   "4i3i",
   "2b3c"
  ],
  "threat": "6f2b+",
  "target": "2b",
  "cpuB": 5.25
 },
 {
  "id": "st2-save-58",
  "type": "save",
  "sfen": "ln3gb1l/1rg3k2/p1pp1snPp/4pb3/1p3pS2/2P1P1+R2/PPNP1PP1P/L1GSGS3/4K2NL w 2P 1",
  "accepted": [
   "4d7a",
   "4d6b",
   "4d5c",
   "4d3e"
  ],
  "best": "4d3e",
  "pv": [
   "4d3e",
   "3f3e",
   "S*3d",
   "3e2f",
   "8e8f",
   "8g8f",
   "8b8f"
  ],
  "threat": "3e4d",
  "target": "4d",
  "cpuB": -10
 },
 {
  "id": "st2-save-59",
  "type": "save",
  "sfen": "ln5nl/7sr/p1p1kp1S1/r2g1gpP1/1pP4Sp/3BSBP2/PP1PPP2P/2GKG4/L7L w 3P2n 1",
  "accepted": [
   "2b2c",
   "N*7f"
  ],
  "best": "2b2c",
  "pv": [
   "2b2c",
   "2d2c+",
   "1b8b",
   "S*6e",
   "6d6c",
   "4f2d",
   "5c5b"
  ],
  "threat": "2c1b+",
  "target": "1b",
  "cpuB": 20.75
 },
 {
  "id": "st2-save-60",
  "type": "save",
  "sfen": "ln2kgsnl/1r7/p1ppspg1p/4pbBp1/3P3P1/2P1P4/PS1G1PP1P/1PK2S1R1/LN1G3NL b Pp 1",
  "accepted": [
   "3d4e"
  ],
  "best": "3d4e",
  "pv": [
   "3d4e",
   "P*8f",
   "8g9h",
   "2d2e",
   "2h2e",
   "P*2d",
   "2e2h"
  ],
  "threat": "3c3d",
  "target": "3d",
  "cpuB": 3.75
 },
 {
  "id": "st2-save-61",
  "type": "save",
  "sfen": "lnsgkg1nl/1r7/p1ppppspp/1p2+b1p2/4B4/3P5/PPN1PPPPP/1S3S1R1/L2GKG1NL b p 1",
  "accepted": [
   "5e4f",
   "5g5f"
  ],
  "best": "5e4f",
  "pv": [
   "5e4f",
   "6c6d",
   "5g5f",
   "4a3b",
   "6i7h",
   "3c4d",
   "4i5h"
  ],
  "threat": "5d5e",
  "target": "5e",
  "cpuB": -0.25
 },
 {
  "id": "st2-save-62",
  "type": "save",
  "sfen": "l1sg3+Pl/3k5/p1n1ppp1p/2gp3P1/2r4Sb/1P1PPP3/PGN3+p1P/1BSKGRP2/L1P1S3L b NPn 1",
  "accepted": [
   "3h3g"
  ],
  "best": "3h3g",
  "pv": [
   "3h3g",
   "7e2e",
   "N*4i",
   "2e2i+",
   "2a1a",
   "1e2d",
   "7g8e"
  ],
  "threat": "3g4h",
  "target": "4h",
  "cpuB": 23.25
 },
 {
  "id": "st2-save-63",
  "type": "save",
  "sfen": "ln3k1nl/1r1sgsg2/p1p1pp1pp/1p1p2p2/3B5/2PP1PP2/PPN1P1SPP/1SK4R1/L2G1G1NL b b 1",
  "accepted": [
   "6e5f",
   "6e4g",
   "6e3h"
  ],
  "best": "6e5f",
  "pv": [
   "6e5f",
   "6b6c",
   "4f4e",
   "4a3a",
   "6i6h",
   "6d6e",
   "6f6e"
  ],
  "threat": "6d6e",
  "target": "6e",
  "cpuB": -10
 },
 {
  "id": "st2-save-64",
  "type": "save",
  "sfen": "ln2k2nl/4gs3/3p1pgpp/prp1p1p2/1p2sP1P1/P1P2bP2/1P1PP3P/2GSS2R1/LN2KG1NL b B 1",
  "accepted": [
   "2h1h",
   "B*3g"
  ],
  "best": "2h1h",
  "pv": [
   "2h1h",
   "3d3e",
   "3f3e",
   "4f3e",
   "6h7g",
   "4b3a",
   "1g1f"
  ],
  "threat": "4f2h+",
  "target": "2h",
  "cpuB": 11.25
 },
 {
  "id": "st2-save-65",
  "type": "save",
  "sfen": "ln2k2nl/2gs1sgb1/p1pppp1pp/1r4p2/9/P4P1P1/1pPPP1P1P/1BR6/LNSGKGSNL b p 1",
  "accepted": [
   "8h9g"
  ],
  "best": "8h9g",
  "pv": [
   "8h9g",
   "7c7d",
   "7i6h",
   "5a5b",
   "5i4h",
   "8a7c",
   "4h3h"
  ],
  "threat": "8g8h+",
  "target": "8h",
  "cpuB": 9.5
 },
 {
  "id": "st2-save-66",
  "type": "save",
  "sfen": "l7l/3s3k1/p+Pnp1gr1b/5pPsp/3PP1pp1/1n2SB2P/P1N2PRG1/8L/L2GK4 w GS2Pn3p 1",
  "accepted": [
   "4c3d",
   "3c3d",
   "P*5h"
  ],
  "best": "3c3d",
  "pv": [
   "3c3d",
   "1f1e",
   "3e3f",
   "P*2c",
   "2b3c",
   "2g3f",
   "N*4e"
  ],
  "threat": "3d3c+",
  "target": "3c",
  "cpuB": 9.25
 },
 {
  "id": "st2-save-67",
  "type": "save",
  "sfen": "lng2g1nl/1r2sksB1/p1ppp2pp/1p3pp2/7Pb/2P4R1/PP1PPPP1P/2GS1S3/LN2KG1NL b - 1",
  "accepted": [
   "2b4d+",
   "2f6f",
   "2f5f",
   "2f4f",
   "2f3f",
   "2f1f",
   "2f2g",
   "2f2h"
  ],
  "best": "2f2h",
  "pv": [
   "2f2h",
   "1e3c",
   "2b3c+",
   "3b3c",
   "4g4f",
   "5b4c",
   "6h7g"
  ],
  "threat": "1e2f",
  "target": "2f",
  "cpuB": -0.25
 },
 {
  "id": "st2-save-68",
  "type": "save",
  "sfen": "ln1gk2nl/3s1sg2/p1pppp1pp/6p2/1r2b2P1/1P7/PpPP1PP1P/2GSRSG2/LNB1K2NL w p 1",
  "accepted": [
   "8e9e",
   "8e7e",
   "8e6e",
   "8g8h+"
  ],
  "best": "8e6e",
  "pv": [
   "8e6e",
   "2e2d",
   "2c2d",
   "7h8g",
   "5e6d",
   "7g7f",
   "6e2e"
  ],
  "threat": "8f8e",
  "target": "8e",
  "cpuB": 5.75
 },
 {
  "id": "st2-save-69",
  "type": "save",
  "sfen": "ln3gknl/1r2s4/p1p1pgspp/1p1p1pp2/4Pb3/4R2PP/PPBP1P3/2GS2G2/LNS1K2NL b 2p 1",
  "accepted": [
   "5f9f",
   "5f8f",
   "5f7f",
   "5f6f",
   "5f4f",
   "5f5g",
   "5f5h"
  ],
  "best": "5f6f",
  "pv": [
   "5f6f",
   "4e7b",
   "6f6d",
   "5b6c",
   "6d6f",
   "4a5b",
   "2f2e"
  ],
  "threat": "4e5f",
  "target": "5f",
  "cpuB": 1.5
 },
 {
  "id": "st2-save-70",
  "type": "save",
  "sfen": "l3k1s1l/r1sg5/pp1bgpnpp/2p1p1P2/N2p5/2P4P1/1P1PPPB1P/2GS2R2/LN2KGSNL w Pp 1",
  "accepted": [
   "3c4e",
   "P*3f"
  ],
  "best": "3c4e",
  "pv": [
   "3c4e",
   "3g4f",
   "9c9d",
   "3d3c+",
   "9d9e",
   "3c4c",
   "P*3g"
  ],
  "threat": "3d3c+",
  "target": "3c",
  "cpuB": 7
 },
 {
  "id": "st2-save-71",
  "type": "save",
  "sfen": "ln1gkg1nl/2r6/pp1spps1p/3p1bpp1/9/2p1P1P2/PPGPSP1RP/3SK4/LNB2G1NL b 2p 1",
  "accepted": [
   "7g6f"
  ],
  "best": "7g6f",
  "pv": [
   "7g6f",
   "4d6f",
   "5g6f",
   "G*7h",
   "2i3g",
   "7h8i",
   "3g4e"
  ],
  "threat": "7f7g+",
  "target": "7g",
  "cpuB": 8.5
 },
 {
  "id": "st2-save-72",
  "type": "save",
  "sfen": "ln2k3l/3g1sg2/1rppspnpp/p3p1p2/3B5/P4P1P1/NpPPPSP1P/7R1/L1SGKG1NL w bp 1",
  "accepted": [
   "8c8b",
   "8c8d",
   "8c8f",
   "7c7d",
   "B*7d"
  ],
  "best": "8c8d",
  "pv": [
   "8c8d",
   "3g3f",
   "7c7d",
   "6i7h",
   "9d9e",
   "9f9e",
   "P*9f"
  ],
  "threat": "6e8c+",
  "target": "8c",
  "cpuB": 0.25
 },
 {
  "id": "st2-save-73",
  "type": "save",
  "sfen": "lnsgkg2l/2r6/p+bpppp1pp/3b2p2/5n1P1/2P2S3/P2PP3P/2SK1S1R1/LN1GG2NL b 4p 1",
  "accepted": [
   "2h2f"
  ],
  "best": "2h2f",
  "pv": [
   "2h2f",
   "P*8g",
   "7h8g",
   "7b8b",
   "4f4e",
   "6d1i+",
   "4e3d"
  ],
  "threat": "6d4f",
  "target": "4f",
  "cpuB": 10
 },
 {
  "id": "st2-save-74",
  "type": "save",
  "sfen": "ln2k1snl/1r1sg1gb1/p1ppppppp/1p5R1/9/9/PPPPPPP1P/1BG1G4/LNS1K1SNL b P 1",
  "accepted": [
   "2d2e",
   "2d2f",
   "2d2g",
   "2d2h"
  ],
  "best": "2d2f",
  "pv": [
   "2d2f",
   "8d8e",
   "7g7f",
   "8e8f",
   "8g8f",
   "8b8f",
   "P*8g"
  ],
  "threat": "2c2d",
  "target": "2d",
  "cpuB": 3.5
 },
 {
  "id": "st2-save-75",
  "type": "save",
  "sfen": "lnsg3nl/3ks1rg1/1ppp1p1pp/p2gBl2n/4p1p2/P1PP4R/1P2PPP1P/9/1S1K2SNL b BGP 1",
  "accepted": [
   "5d2g",
   "5d1h"
  ],
  "best": "5d1h",
  "pv": [
   "5d1h",
   "6b7b",
   "4g4f",
   "3b3d",
   "6i7h",
   "2b3b"
  ],
  "threat": "6d5d",
  "target": "5d",
  "cpuB": 9.5
 },
 {
  "id": "st2-save-76",
  "type": "save",
  "sfen": "ln1gk2nl/1r1ssg3/p1ppp2pp/1p3Pp2/4P2P1/4Gb2P/PPPP2P2/1BS1K2R1/LN1GS2NL w P 1",
  "accepted": [
   "4f3e"
  ],
  "best": "4f3e",
  "pv": [
   "4f3e",
   "5f4e",
   "8d8e",
   "4e3d",
   "8e8f",
   "3d3e",
   "8f8g+"
  ],
  "threat": "5f4f",
  "target": "4f",
  "cpuB": -0.25
 },
 {
  "id": "st2-save-77",
  "type": "save",
  "sfen": "ln2k3l/1r1s2g2/1ppppg+bpp/p5p2/9/P1+b6/1PP1PPPPP/R1S1NKS2/LN1G1G1NL w S2p 1",
  "accepted": [
   "7f5d",
   "7f8e",
   "7f7e",
   "7f6e"
  ],
  "best": "7f8e",
  "pv": [
   "7f8e",
   "4h3i"
  ],
  "threat": "7g7f",
  "target": "7f",
  "cpuB": 3.75
 },
 {
  "id": "st2-save-78",
  "type": "save",
  "sfen": "lng5l/1rb1k1gs1/pp2sp1pp/2ppp1p2/3P1P3/PPP1P1P1B/2S1S2+nn/3K5/LN1G1GR1L w 2p 1",
  "accepted": [
   "2g2f",
   "2g2h"
  ],
  "best": "2g2f",
  "pv": [
   "2g2f",
   "1f3h",
   "6d6e",
   "1i1g",
   "7a6b",
   "3h4g",
   "2f1g"
  ],
  "threat": "1f2g",
  "target": "2g",
  "cpuB": 5
 },
 {
  "id": "st2-save-79",
  "type": "save",
  "sfen": "lns1k1snl/1r2g1g2/pppppp1pp/6p1+b/9/2P1PP1P1/PP1P1BP1P/1R1SG4/LN2KGSNL w - 1",
  "accepted": [
   "1d2d",
   "1d1e"
  ],
  "best": "1d1e",
  "pv": [
   "1d1e",
   "2f2e",
   "1e3c",
   "6h7g",
   "3a4b",
   "3g3f",
   "4c4d"
  ],
  "threat": "4g1d",
  "target": "1d",
  "cpuB": -1.75
 },
 {
  "id": "st2-tactic-0",
  "type": "tactic",
  "sfen": "l2gkg2l/1r1s2s2/p1npppnpp/2p3p2/9/1pPB3P1/P2PPPP1P/LKG1GS1R1/1N5NL w BPs 1",
  "accepted": [
   "S*8g"
  ],
  "best": "S*8g",
  "pv": [
   "S*8g",
   "8h7i",
   "8g7h",
   "7i7h",
   "8f8g+",
   "7h6i",
   "8b8f"
  ],
  "tesuji": "ryodori",
  "targets": [
   "8h",
   "7h"
  ],
  "line": [
   "S*8g",
   "8h7i",
   "8g7h"
  ],
  "cpuB": 17.25
 },
 {
  "id": "st2-tactic-1",
  "type": "tactic",
  "sfen": "1n6l/1g1s1gkp1/2p2sn1p/3ppp3/2PN5/3B1PGRP/+l+s3BN2/1+p2S4/+r+l3K2L b G6P2p 1",
  "accepted": [
   "P*3d"
  ],
  "best": "P*3d",
  "pv": [
   "P*3d",
   "4c3d",
   "6f4d",
   "8b7b",
   "G*5c",
   "P*4a",
   "3g4e"
  ],
  "tesuji": "tapping-pawn",
  "targets": [
   "3c"
  ],
  "line": [
   "P*3d",
   "4c3d",
   "6f4d"
  ],
  "cpuB": 22.5
 },
 {
  "id": "st2-tactic-2",
  "type": "tactic",
  "sfen": "lnsgkg1nl/1r5s1/p1pppp1p1/1p4p2/8P/2P6/PP1PPPP+b1/2SR1K3/LN1G1GSNL w BPp 1",
  "accepted": [
   "P*1h"
  ],
  "best": "P*1h",
  "pv": [
   "P*1h",
   "3i3h",
   "2g2h",
   "1i1h",
   "2h1h",
   "7f7e",
   "2b3c"
  ],
  "tesuji": "tapping-pawn",
  "targets": [
   "1i"
  ],
  "line": [
   "P*1h",
   "3i3h",
   "2g2h"
  ],
  "cpuB": 10.75
 },
 {
  "id": "st2-tactic-3",
  "type": "tactic",
  "sfen": "ln5nl/4gb2n/pr1p3kg/1s2ppsp1/P1pP5/1G2P3P/BpN2P3/2GK2R2/L1S1S3L b 3P3p 1",
  "accepted": [
   "P*8e",
   "P*2b"
  ],
  "best": "P*8e",
  "pv": [
   "P*8e",
   "8d7c",
   "1f1e",
   "P*3f",
   "1e1d",
   "1c1d",
   "1i1d"
  ],
  "tesuji": "tapping-pawn",
  "targets": [
   "8d"
  ],
  "line": [
   "P*8e",
   "8d7c",
   "1f1e"
  ],
  "cpuB": 18.75
 },
 {
  "id": "st2-tactic-4",
  "type": "tactic",
  "sfen": "l1l+r2knl/5ggs1/p1P2ppp1/1P+Spp3p/1B1n2Ps1/1R1P5/P3PP2P/+npGBK1S2/5G1NL w Pp 1",
  "accepted": [
   "P*7g"
  ],
  "best": "P*7g",
  "pv": [
   "P*7g",
   "7h6g",
   "7g7h+",
   "6f6e",
   "7h6h",
   "6g6h",
   "6d6e"
  ],
  "tesuji": "focal-pawn",
  "targets": [
   "7g"
  ],
  "line": [
   "P*7g",
   "7h6g",
   "7g7h+"
  ],
  "cpuB": 16
 },
 {
  "id": "st2-tactic-5",
  "type": "tactic",
  "sfen": "l2g4l/3s1kgs1/p1np1p1pp/2P3p2/3lp2n1/2S1PPPP1/2RP1S2P/1+r2G1KG1/+n+p5NL b BPb2p 1",
  "accepted": [
   "B*9g"
  ],
  "best": "B*9g",
  "pv": [
   "B*9g",
   "8h9g",
   "7g9g",
   "5e5f",
   "7d7c+",
   "5f5g+",
   "5h5g"
  ],
  "tesuji": "ote-bisha",
  "targets": [
   "4b",
   "8h"
  ],
  "line": [
   "B*9g",
   "8h9g",
   "7g9g"
  ],
  "cpuB": 23.25
 },
 {
  "id": "st2-tactic-6",
  "type": "tactic",
  "sfen": "ln4k1l/1r2gsg2/p1Ppppnpp/1p3bp2/3N5/1P1P5/P1G1PPP1P/1BG2S1R1/Ls2K2NL w SPp 1",
  "accepted": [
   "P*7f"
  ],
  "best": "P*7f",
  "pv": [
   "P*7f",
   "S*7b",
   "8d8e",
   "7b8a+",
   "8b8a",
   "7c7b+",
   "7f7g+"
  ],
  "tesuji": "tapping-pawn",
  "targets": [
   "7g"
  ],
  "line": [
   "P*7f",
   "S*7b",
   "8d8e"
  ],
  "cpuB": 22.5
 },
 {
  "id": "st2-tactic-7",
  "type": "tactic",
  "sfen": "lns3knl/4r2g1/p1ppp2p1/5bg1p/5pP2/1PP4R1/P2PPP2P/2GS5/LN1K1G1NL b S3Pbs 1",
  "accepted": [
   "S*4c"
  ],
  "best": "S*4c",
  "pv": [
   "S*4c",
   "5b8b",
   "4c3d",
   "B*1e",
   "2f5f",
   "4d9i+",
   "1g1f"
  ],
  "tesuji": "ryodori",
  "targets": [
   "5b",
   "3d"
  ],
  "line": [
   "S*4c",
   "5b8b",
   "4c3d"
  ],
  "cpuB": 25
 },
 {
  "id": "st2-tactic-8",
  "type": "tactic",
  "sfen": "l1+Rp4l/1G2p4/p3+P3k/1S3pnsp/1pNSP4/3S2GpP/P1P1RPPb1/+n7L/+b2GK4 w GN3Plp 1",
  "accepted": [
   "P*3e"
  ],
  "best": "P*3e",
  "pv": [
   "P*3e",
   "N*2e",
   "1c2c",
   "G*3c",
   "2d3c",
   "2e3c+",
   "2c3c"
  ],
  "tesuji": "tapping-pawn",
  "targets": [
   "3f"
  ],
  "line": [
   "P*3e",
   "N*2e",
   "1c2c"
  ],
  "cpuB": 22.75
 },
 {
  "id": "st2-tactic-9",
  "type": "tactic",
  "sfen": "l2gkgsnl/3s5/p1nppp1p1/6p1p/2P6/Ps1b1B1P1/1pN1PPP1P/2GG1S1R1/L1K4NL w RP2p 1",
  "accepted": [
   "P*7f"
  ],
  "best": "P*7f",
  "pv": [
   "P*7f",
   "7e7d",
   "7f7g+",
   "7d7c+",
   "8g8h+",
   "7h8h",
   "N*7f"
  ],
  "tesuji": "tapping-pawn",
  "targets": [
   "7g"
  ],
  "line": [
   "P*7f",
   "7e7d",
   "7f7g+"
  ],
  "cpuB": 17.25
 },
 {
  "id": "st2-tactic-10",
  "type": "tactic",
  "sfen": "l2gkgsnl/3s5/p1npppbp1/6p1p/2P6/P4B1P1/2NPPPP1P/1K1G1S1R1/L2G3NL w RPs2p 1",
  "accepted": [
   "P*7f"
  ],
  "best": "P*7f",
  "pv": [
   "P*7f",
   "8h8g"
  ],
  "tesuji": "tapping-pawn",
  "targets": [
   "7g"
  ],
  "line": [
   "P*7f",
   "8h8g"
  ],
  "cpuB": 16.5
 },
 {
  "id": "st2-tactic-11",
  "type": "tactic",
  "sfen": "ln5nl/1r2g1kb1/p1p1psgp1/1p1ps4/5pS2/2PP2PRL/PP1SPPN2/1BG1G4/LN2K4 w 3Pp 1",
  "accepted": [
   "P*1e"
  ],
  "best": "P*1e",
  "pv": [
   "P*1e",
   "1f1e",
   "1a1e",
   "P*1f",
   "L*3d",
   "1f1e",
   "3d3e"
  ],
  "tesuji": "tapping-pawn",
  "targets": [
   "1f"
  ],
  "line": [
   "P*1e",
   "1f1e",
   "1a1e"
  ],
  "cpuB": 17.5
 },
 {
  "id": "st2-tactic-12",
  "type": "tactic",
  "sfen": "1n5nl/3+BSgk2/4p1spp/L1p2pp2/9/2PgPP1P1/+rPN3P1P/2L1SK1R1/5G1NL b B4Pgsp 1",
  "accepted": [
   "P*6g"
  ],
  "best": "P*6g",
  "pv": [
   "P*6g",
   "6f7g",
   "7h7g",
   "3b2b",
   "G*4c",
   "G*3a",
   "4c3c"
  ],
  "tesuji": "tapping-pawn",
  "targets": [
   "6f"
  ],
  "line": [
   "P*6g",
   "6f7g",
   "7h7g"
  ],
  "cpuB": 28
 },
 {
  "id": "st2-tactic-13",
  "type": "tactic",
  "sfen": "lnS4nl/5r1k1/2p1p1gp1/p3spgPp/2PP5/PP3PGRP/2SSP1N2/1KG5B/LN1+b4L b 3Pp 1",
  "accepted": [
   "P*3e"
  ],
  "best": "P*3e",
  "pv": [
   "P*3e",
   "3d2d",
   "P*2e",
   "4b3b",
   "2e2d",
   "3c2d",
   "2f2i"
  ],
  "tesuji": "tapping-pawn",
  "targets": [
   "3d"
  ],
  "line": [
   "P*3e",
   "3d2d",
   "P*2e"
  ],
  "cpuB": 48
 },
 {
  "id": "st2-tactic-14",
  "type": "tactic",
  "sfen": "l2g3nl/1s2k1gb1/pprpp1ppp/4sp3/2PP1P3/1P2P4/P3B1PPP/1S1R1KS2/L3GG1NL w NPn 1",
  "accepted": [
   "N*7f"
  ],
  "best": "N*7f",
  "pv": [
   "N*7f",
   "6h5h",
   "7f8h+",
   "4h3i",
   "3c3d",
   "5g6f",
   "8h9i"
  ],
  "tesuji": "knight-fork",
  "targets": [
   "8h",
   "6h"
  ],
  "line": [
   "N*7f",
   "6h5h",
   "7f8h+"
  ],
  "cpuB": 18.75
 },
 {
  "id": "st2-tactic-15",
  "type": "tactic",
  "sfen": "ln1kb3l/1g2r1gs1/1ppP1pnpp/p2p2p2/4PP3/2P2SPP1/Pg1+s1G2P/L2B3R1/5K1NL b Sn2p 1",
  "accepted": [
   "S*4a"
  ],
  "best": "S*4a",
  "pv": [
   "S*4a",
   "3b4b",
   "4a5b+",
   "4b5b",
   "6h5i",
   "8b7b",
   "5e5d"
  ],
  "tesuji": "waruuchi",
  "targets": [
   "3b",
   "5b"
  ],
  "line": [
   "S*4a",
   "3b4b",
   "4a5b+"
  ],
  "cpuB": 23.5
 },
 {
  "id": "st2-tactic-16",
  "type": "tactic",
  "sfen": "ln2kg1nl/1r1sg2s1/p2ppp1pp/2p3p2/1p7/2P3P2/PP1PPPNPP/2SK3R1/LN1G1GS1L b Bb 1",
  "accepted": [
   "B*5e"
  ],
  "best": "B*5e",
  "pv": [
   "B*5e",
   "B*6d",
   "5e2b+",
   "6d3g+",
   "2b1a",
   "8e8f",
   "8g8f"
  ],
  "tesuji": "ryodori",
  "targets": [
   "2b",
   "8b"
  ],
  "line": [
   "B*5e",
   "B*6d",
   "5e2b+"
  ],
  "cpuB": 18.75
 },
 {
  "id": "st2-tactic-17",
  "type": "tactic",
  "sfen": "l6nl/5k1b1/r1ngps1gp/pPp3s2/5pSp1/1SP1P4/P1NPBP2P/2GKG2R1/L6NL b 3P2p 1",
  "accepted": [
   "P*2d"
  ],
  "best": "P*2d",
  "pv": [
   "P*2d",
   "2c3c",
   "3e3d",
   "3c3d",
   "2d2c+",
   "7c6e",
   "7g6e"
  ],
  "tesuji": "tapping-pawn",
  "targets": [
   "2c"
  ],
  "line": [
   "P*2d",
   "2c3c",
   "3e3d"
  ],
  "cpuB": 14.25
 },
 {
  "id": "st2-tactic-18",
  "type": "tactic",
  "sfen": "ln2g2nl/5bsk1/p4S2p/3ppPpp1/9/1r+sPPBP1P/PpN3N2/1PG1GS1R1/L1K5L w g4p 1",
  "accepted": [
   "8g8h+"
  ],
  "best": "8g8h+",
  "pv": [
   "8g8h+",
   "7i6h",
   "8h7h",
   "6h5g",
   "7f6f",
   "5g4g",
   "6f5f"
  ],
  "tesuji": "ryodori",
  "targets": [
   "7i",
   "7h"
  ],
  "line": [
   "8g8h+",
   "7i6h",
   "8h7h"
  ],
  "cpuB": 26.5
 },
 {
  "id": "st2-tactic-19",
  "type": "tactic",
  "sfen": "ln1s1gk1l/5r1g1/p+Np1P4/1G1p+S1p1p/1Nr2p2N/3P2P1P/PP3P3/5SK2/L1B1S3L b B4Pgp 1",
  "accepted": [
   "P*2c",
   "P*7f"
  ],
  "best": "P*2c",
  "pv": [
   "P*2c",
   "2b1b"
  ],
  "tesuji": "tapping-pawn",
  "targets": [
   "2b"
  ],
  "line": [
   "P*2c",
   "2b1b"
  ],
  "cpuB": 31
 },
 {
  "id": "st2-tactic-20",
  "type": "tactic",
  "sfen": "ln4snl/3rg1g2/1Spl1p1pk/4S1P1p/Pp1P5/2P2Rp+b+n/1PSGPB3/1K1G5/LN7 w 5Pp 1",
  "accepted": [
   "2f3g"
  ],
  "best": "2f3g",
  "pv": [
   "2f3g",
   "4f3f",
   "3g4g",
   "3f1f",
   "3a2b",
   "P*4h",
   "4g3g"
  ],
  "tesuji": "ryodori",
  "targets": [
   "4g",
   "4f"
  ],
  "line": [
   "2f3g",
   "4f3f",
   "3g4g"
  ],
  "cpuB": 18.25
 },
 {
  "id": "st2-tactic-21",
  "type": "tactic",
  "sfen": "ln2k3l/1+B1sg1g2/p2ppsnpp/2p3p2/7P1/1PP6/P2PP1P2/1SGG2S2/LN1K3NL w RB2Pr2p 1",
  "accepted": [
   "R*3i"
  ],
  "best": "R*3i",
  "pv": [
   "R*3i",
   "P*4i",
   "3i3h+",
   "7h7i",
   "3h2i",
   "8b8a",
   "2i4i"
  ],
  "tesuji": "rook-cross-fork",
  "targets": [
   "3h",
   "6i"
  ],
  "line": [
   "R*3i",
   "P*4i",
   "3i3h+"
  ],
  "cpuB": 29.5
 },
 {
  "id": "st2-tactic-22",
  "type": "tactic",
  "sfen": "l1r5l/5GGSk/p2pp1pp1/1p3P2p/6Pb1/2PP+r+b2P/PP7/2GSS1+p2/LNK1G3L b Ns2n3p 1",
  "accepted": [
   "1f1e"
  ],
  "best": "1f1e",
  "pv": [
   "1f1e",
   "P*7g",
   "8i7g",
   "S*1c",
   "P*5g",
   "1c2b",
   "3b2b"
  ],
  "tesuji": "edge-king-edge-pawn",
  "targets": [
   "1b"
  ],
  "line": [
   "1f1e",
   "P*7g",
   "8i7g"
  ],
  "cpuB": 48
 },
 {
  "id": "st2-tactic-23",
  "type": "tactic",
  "sfen": "ln1gkgsnl/1+r1s3b1/p1ppp2pp/5pp2/2P6/7P1/P1RPPPP1P/1B2K4/LNSG1GSNL w Pp 1",
  "accepted": [
   "P*8g"
  ],
  "best": "P*8g",
  "pv": [
   "P*8g",
   "7g7h",
   "8g8h+",
   "7h8h",
   "B*8c",
   "8i7g",
   "4d4e"
  ],
  "tesuji": "tapping-pawn",
  "targets": [
   "8h"
  ],
  "line": [
   "P*8g",
   "7g7h",
   "8g8h+"
  ],
  "cpuB": 19
 },
 {
  "id": "st2-tactic-24",
  "type": "tactic",
  "sfen": "ln2gg1nl/1r1s1ks2/p4p1pp/2ppp1p2/3N1PP2/2P1PB1P1/P+pSP1S2P/2G3R2/L3KG1NL b bp 1",
  "accepted": [
   "4f6d"
  ],
  "best": "4f6d",
  "pv": [
   "4f6d",
   "4b3c",
   "6d8b+",
   "8g7h",
   "7g6f",
   "B*6h",
   "5i4h"
  ],
  "tesuji": "ote-bisha",
  "targets": [
   "4b",
   "8b"
  ],
  "line": [
   "4f6d",
   "4b3c",
   "6d8b+"
  ],
  "cpuB": 10
 },
 {
  "id": "st2-tactic-25",
  "type": "tactic",
  "sfen": "ln5n1/3r1kgb1/s3pp3/p1+Sp1gspL/1pP6/4R4/PPSPPPN2/1BGG5/LNK6 w L4P2p 1",
  "accepted": [
   "P*1c"
  ],
  "best": "P*1c",
  "pv": [
   "P*1c",
   "1d1c",
   "2a1c",
   "L*3i",
   "3b2c",
   "7g7f",
   "P*7c"
  ],
  "tesuji": "tapping-pawn",
  "targets": [
   "1d"
  ],
  "line": [
   "P*1c",
   "1d1c",
   "2a1c"
  ],
  "cpuB": 15.75
 },
 {
  "id": "st2-tactic-26",
  "type": "tactic",
  "sfen": "1n4bnl/lksgs1g2/ppp1pppPp/7b1/P1PR5/9/1PSGPPP1P/2G2S3/LNK4NL b 2Prp 1",
  "accepted": [
   "6e6b+"
  ],
  "best": "6e6b+",
  "pv": [
   "6e6b+",
   "P*6f",
   "6g6h",
   "R*4i",
   "G*5i",
   "4i5i+",
   "4h5i"
  ],
  "tesuji": "ryodori",
  "targets": [
   "5b",
   "7b"
  ],
  "line": [
   "6e6b+",
   "P*6f",
   "6g6h"
  ],
  "cpuB": 8.5
 },
 {
  "id": "st2-tactic-27",
  "type": "tactic",
  "sfen": "l3k2nl/1r1sg1g2/p1n2pspp/2Ppp1p2/B4S3/1p3P3/PsNPP1P1P/2G1G2R1/L3K2NL b 2Pbp 1",
  "accepted": [
   "7d7c+"
  ],
  "best": "7d7c+",
  "pv": [
   "7d7c+",
   "8g7h+",
   "7c8b",
   "5a4b",
   "8b7b",
   "6b5c",
   "R*6a"
  ],
  "tesuji": "ryodori",
  "targets": [
   "6b",
   "8b"
  ],
  "line": [
   "7d7c+",
   "8g7h+",
   "7c8b"
  ],
  "cpuB": 26.25
 },
 {
  "id": "st2-tactic-28",
  "type": "tactic",
  "sfen": "ln4gnl/1g2+Bs3/3+Ppgk1p/p4pps1/1+rS1R3b/P2SP4/2P2PP1P/1P1G5/LK5NL b 3Pn2p 1",
  "accepted": [
   "6c5c"
  ],
  "best": "6c5c",
  "pv": [
   "6c5c",
   "8e8c",
   "5c4c",
   "4b4c",
   "5b6a",
   "P*5d",
   "6a8c"
  ],
  "tesuji": "ryodori",
  "targets": [
   "4b",
   "4c"
  ],
  "line": [
   "6c5c",
   "8e8c",
   "5c4c"
  ],
  "cpuB": 11.25
 },
 {
  "id": "st2-tactic-29",
  "type": "tactic",
  "sfen": "lnr5l/4g2n1/2p1p1k1p/pp1S1psp1/4Nbg2/2P1P2PB/PP1P2S1P/2KGG4/LN6L b S3Prp 1",
  "accepted": [
   "P*3f"
  ],
  "best": "P*3f",
  "pv": [
   "P*3f",
   "4e3f",
   "3g3f",
   "3e3f",
   "5e6c+",
   "5b6c",
   "6d6c+"
  ],
  "tesuji": "focal-pawn",
  "targets": [
   "3f"
  ],
  "line": [
   "P*3f",
   "4e3f",
   "3g3f"
  ],
  "cpuB": 35.25
 },
 {
  "id": "st2-tactic-30",
  "type": "tactic",
  "sfen": "4+RS1nl/4+Ng1k1/p4pspp/2g1p4/3p1PpL1/1g1bP+B1P1/P1+p2S2P/1P2G3L/L1R1K2N1 w sn4p 1",
  "accepted": [
   "N*6g"
  ],
  "best": "N*6g",
  "pv": [
   "N*6g",
   "5i4i",
   "6g7i+",
   "4i3h",
   "R*3i",
   "3h2h",
   "S*2g"
  ],
  "tesuji": "knight-fork",
  "targets": [
   "7i",
   "5i"
  ],
  "line": [
   "N*6g",
   "5i4i",
   "6g7i+"
  ],
  "cpuB": 19
 },
 {
  "id": "st2-tactic-31",
  "type": "tactic",
  "sfen": "ln3g1nl/1r5k1/2p1pg1p1/p2pspsPp/1pP6/P2P1PGRP/1PSSP1N2/1KG5B/LN1+b4L b Pp 1",
  "accepted": [
   "P*3e"
  ],
  "best": "P*3e",
  "pv": [
   "P*3e",
   "2c2d",
   "3e3d",
   "4a3b",
   "S*3e",
   "6d6e",
   "6f6e"
  ],
  "tesuji": "tapping-pawn",
  "targets": [
   "3d"
  ],
  "line": [
   "P*3e",
   "2c2d",
   "3e3d"
  ],
  "cpuB": 26.5
 },
 {
  "id": "st2-tactic-32",
  "type": "tactic",
  "sfen": "ln3s1nl/8n/pr2g2kg/1spPpb1p1/P2G1pP2/2G1P3P/B1N1KP3/9/L1S1S2RL b 4P3p 1",
  "accepted": [
   "6e7d"
  ],
  "best": "6e7d",
  "pv": [
   "6e7d",
   "8c8b",
   "6d6c+",
   "P*7e",
   "7f6f",
   "P*6e",
   "7g6e"
  ],
  "tesuji": "ryodori",
  "targets": [
   "8c",
   "8d"
  ],
  "line": [
   "6e7d",
   "8c8b",
   "6d6c+"
  ],
  "cpuB": 12.25
 },
 {
  "id": "st2-tactic-33",
  "type": "tactic",
  "sfen": "lng5l/5kgs1/1r1b1p1pp/1p1Np1Pb1/2ps1P3/PP1pP3L/1nS1S4/L1P1G4/1N1G1KR2 b 2P3p 1",
  "accepted": [
   "P*2e"
  ],
  "best": "P*2e",
  "pv": [
   "P*2e",
   "2d5g+",
   "5h5g",
   "S*5c",
   "7g6f",
   "6e6f",
   "5g6f"
  ],
  "tesuji": "tapping-pawn",
  "targets": [
   "2d"
  ],
  "line": [
   "P*2e",
   "2d5g+",
   "5h5g"
  ],
  "cpuB": 20.75
 },
 {
  "id": "st2-tactic-34",
  "type": "tactic",
  "sfen": "1+B5nl/3rg2k1/p1n1p1sg1/1ppp1ppp1/1s6p/2P1P1PRP/PP1P1PN2/1G2GS3/LNL1K3L b bsp 1",
  "accepted": [
   "1f1e"
  ],
  "best": "1f1e",
  "pv": [
   "1f1e",
   "6d6e",
   "8a7a",
   "6b6d",
   "7a9c",
   "B*9e",
   "5i6i"
  ],
  "tesuji": "edge-king-edge-pawn",
  "targets": [
   "2b"
  ],
  "line": [
   "1f1e",
   "6d6e",
   "8a7a"
  ],
  "cpuB": 26.75
 },
 {
  "id": "st2-tactic-35",
  "type": "tactic",
  "sfen": "l5bnl/1sg1s1g2/1pnp1r2p/k1p1P1pp1/lP1P1p3/2PS2PB1/2NGSP1PP/R8/3KG2NL b 3P 1",
  "accepted": [
   "P*9f"
  ],
  "best": "P*9f",
  "pv": [
   "P*9f",
   "8c8d",
   "9f9e",
   "9d8c",
   "8e8d",
   "8c8d",
   "P*8e"
  ],
  "tesuji": "tapping-pawn",
  "targets": [
   "9e"
  ],
  "line": [
   "P*9f",
   "8c8d",
   "9f9e"
  ],
  "cpuB": 14.5
 },
 {
  "id": "st2-tactic-36",
  "type": "tactic",
  "sfen": "lnr3gnl/4g1sk1/pp1pppbpp/4P1p2/2S5P/2RS2P2/PP1P1P1P1/1B3K3/LN3GSNL w Pgp 1",
  "accepted": [
   "G*8e"
  ],
  "best": "G*8e",
  "pv": [
   "G*8e",
   "7f7h",
   "8e7e",
   "6f7e",
   "3c8h+",
   "7h8h",
   "7a7e"
  ],
  "tesuji": "ryodori",
  "targets": [
   "7f",
   "7e"
  ],
  "line": [
   "G*8e",
   "7f7h",
   "8e7e"
  ],
  "cpuB": 11.75
 },
 {
  "id": "st2-tactic-37",
  "type": "tactic",
  "sfen": "l3gk1nl/1r1s1sg2/p1n2pbpp/2pPp1p2/1p7/1PP6/PSN1PPPPP/2BGG2R1/L2KS2NL b P 1",
  "accepted": [
   "8f8e"
  ],
  "best": "8f8e",
  "pv": [
   "8f8e",
   "7c8e",
   "7g8e",
   "8b8e",
   "N*7g",
   "8e8b",
   "P*8e"
  ],
  "tesuji": "focal-pawn",
  "targets": [
   "8e"
  ],
  "line": [
   "8f8e",
   "7c8e",
   "7g8e"
  ],
  "cpuB": 29
 },
 {
  "id": "st2-tactic-38",
  "type": "tactic",
  "sfen": "l7l/4r1k2/2s2sgpp/p1psNpp2/1p1+BN4/2P3P2/PPNPPP2P/2G2S1+n1/L1K2G2L b G3Prb 1",
  "accepted": [
   "G*6c"
  ],
  "best": "G*6c",
  "pv": [
   "G*6c",
   "R*2i",
   "4i5i",
   "5b9b",
   "6c6d",
   "7c6d",
   "6e6d"
  ],
  "tesuji": "ryodori",
  "targets": [
   "5b",
   "7c",
   "6d"
  ],
  "line": [
   "G*6c",
   "R*2i",
   "4i5i"
  ],
  "cpuB": 26.5
 },
 {
  "id": "st2-tactic-39",
  "type": "tactic",
  "sfen": "l6kl/3sr4/p1np1g1Pb/1P3p1sp/3PP1pp1/1n2SB2P/P1N2PRG1/8N/L2GK2sL w G3P2p 1",
  "accepted": [
   "P*7f"
  ],
  "best": "P*7f",
  "pv": [
   "P*7f",
   "5i6h",
   "2i1h+",
   "1i1h",
   "N*3d",
   "S*4a",
   "7f7g+"
  ],
  "tesuji": "tapping-pawn",
  "targets": [
   "7g"
  ],
  "line": [
   "P*7f",
   "5i6h",
   "2i1h+"
  ],
  "cpuB": 18.75
 },
 {
  "id": "st2-tactic-40",
  "type": "tactic",
  "sfen": "l6nl/3sgkg2/p1npp1spp/1rpb5/5pBS1/2PS3R1/PP1PPP2P/1KG1G4/LN5NL w 2P2p 1",
  "accepted": [
   "P*3d"
  ],
  "best": "P*3d",
  "pv": [
   "P*3d",
   "P*2b",
   "3b2b",
   "2e3d",
   "3c3d",
   "3e4d",
   "2b3c"
  ],
  "tesuji": "tapping-pawn",
  "targets": [
   "3e"
  ],
  "line": [
   "P*3d",
   "P*2b",
   "3b2b"
  ],
  "cpuB": 23.75
 },
 {
  "id": "st2-tactic-41",
  "type": "tactic",
  "sfen": "lnr2k1nl/3g1sgb1/p2ppp1pp/1p4p2/2s4R1/1P1P5/P1NSPPP1P/1BG1GS3/L3K2NL b 2Pp 1",
  "accepted": [
   "P*7f"
  ],
  "best": "P*7f",
  "pv": [
   "P*7f",
   "7e7f",
   "6g7f",
   "7a7f",
   "5h6g",
   "7f7d",
   "P*7f"
  ],
  "tesuji": "tapping-pawn",
  "targets": [
   "7e"
  ],
  "line": [
   "P*7f",
   "7e7f",
   "6g7f"
  ],
  "cpuB": 25.75
 },
 {
  "id": "st2-tactic-42",
  "type": "tactic",
  "sfen": "ln5nl/1b5s1/p2pkp1pp/1gp3p2/1p2s2P1/2P3P2/PP1P1P2P/4RSG2/LN2G1KNL b RPbgsp 1",
  "accepted": [
   "R*3b",
   "R*7b"
  ],
  "best": "R*3b",
  "pv": [
   "R*3b",
   "8b7c",
   "3b2b+",
   "P*5f",
   "2b2a",
   "S*5g",
   "N*6e"
  ],
  "tesuji": "ryodori",
  "targets": [
   "2b",
   "8b"
  ],
  "line": [
   "R*3b",
   "8b7c",
   "3b2b+"
  ],
  "cpuB": 22
 },
 {
  "id": "st2-tactic-43",
  "type": "tactic",
  "sfen": "lns1kg1nl/1rg2bs2/p1pp3pp/4ppp2/7P1/B1P2P2P/PGNPPGPR1/1SK2S3/L6NL w Pp 1",
  "accepted": [
   "P*8f"
  ],
  "best": "P*8f",
  "pv": [
   "P*8f",
   "8g8f",
   "8b8f",
   "P*8g",
   "8f8b",
   "2e2d",
   "4b2d"
  ],
  "tesuji": "tapping-pawn",
  "targets": [
   "8g"
  ],
  "line": [
   "P*8f",
   "8g8f",
   "8b8f"
  ],
  "cpuB": 15.75
 },
 {
  "id": "st2-tactic-44",
  "type": "tactic",
  "sfen": "lns1k1g1l/4g2b1/p2pp3n/2p+r1p+R1p/9/1PP1BS3/P2PPPP1P/3SKS3/L1G2G1NL w Pn3p 1",
  "accepted": [
   "4d4e"
  ],
  "best": "4d4e",
  "pv": [
   "4d4e",
   "3d6d",
   "6c6d",
   "5f4e",
   "N*5d",
   "7i8i",
   "5a6b"
  ],
  "tesuji": "focal-pawn",
  "targets": [
   "4e"
  ],
  "line": [
   "4d4e",
   "3d6d",
   "6c6d"
  ],
  "cpuB": 33
 },
 {
  "id": "st2-tactic-45",
  "type": "tactic",
  "sfen": "lnr3gnl/4g1sk1/pp1pppbpp/4P1p2/8P/2pS2P2/PP1P1P1P1/1BG1RK3/LN3GSNL w sp 1",
  "accepted": [
   "S*6i"
  ],
  "best": "S*6i",
  "pv": [
   "S*6i",
   "5h6h",
   "6i7h+",
   "6h7h",
   "G*5f",
   "4i5h",
   "5c5d"
  ],
  "tesuji": "waruuchi",
  "targets": [
   "5h",
   "7h"
  ],
  "line": [
   "S*6i",
   "5h6h",
   "6i7h+"
  ],
  "cpuB": 14.75
 },
 {
  "id": "st2-tactic-46",
  "type": "tactic",
  "sfen": "ln1gk2nl/1s2r2+P1/p2p1ps1p/1pp1b1g2/4p4/2P6/PP1PPPPBP/2GS1S1+R1/LN2KG1NL w 2P 1",
  "accepted": [
   "5b2b"
  ],
  "best": "5b2b",
  "pv": [
   "5b2b",
   "4i3h",
   "5d2g+",
   "3h2g",
   "B*4d",
   "3g3f",
   "5e5f"
  ],
  "tesuji": "dengaku",
  "targets": [
   "2g",
   "2h"
  ],
  "line": [
   "5b2b",
   "4i3h",
   "5d2g+"
  ],
  "cpuB": 12.25
 },
 {
  "id": "st2-tactic-47",
  "type": "tactic",
  "sfen": "ln1gkg1nl/2s1r1s2/pppp1p1pp/6pb1/5P3/3P3P1/PPPSS1P1P/1BGK1G1R1/LN5NL w Pp 1",
  "accepted": [
   "P*5f"
  ],
  "best": "P*5f",
  "pv": [
   "P*5f",
   "6g5f",
   "5b5f",
   "7h6g",
   "S*3i",
   "6g5f",
   "3i2h+"
  ],
  "tesuji": "focal-pawn",
  "targets": [
   "5f"
  ],
  "line": [
   "P*5f",
   "6g5f",
   "5b5f"
  ],
  "cpuB": 22.75
 },
 {
  "id": "st2-tactic-48",
  "type": "tactic",
  "sfen": "l5rkl/6g2/p1+Bpp1ppp/1p3gN2/5nP2/2PP+rP2P/PP7/2GSS1+pb1/LNK1G3L b SPsn2p 1",
  "accepted": [
   "P*2b"
  ],
  "best": "P*2b",
  "pv": [
   "P*2b",
   "2a1b",
   "S*2a",
   "3a2a",
   "2b2a+",
   "3c3d",
   "4f4e"
  ],
  "tesuji": "focal-pawn",
  "targets": [
   "2b"
  ],
  "line": [
   "P*2b",
   "2a1b",
   "S*2a"
  ],
  "cpuB": 29.5
 },
 {
  "id": "st2-tactic-49",
  "type": "tactic",
  "sfen": "ln+R2s2l/r5k2/p1p1pgppp/1p1p2g2/9/P1P1NPPN1/1PBP3SP/1K2+p4/LN1+b3GL w GSPsp 1",
  "accepted": [
   "S*7h"
  ],
  "best": "S*7h",
  "pv": [
   "S*7h",
   "S*2a",
   "3b3a",
   "G*3b",
   "9b3b",
   "2a3b",
   "3a3b"
  ],
  "tesuji": "belly-silver",
  "targets": [
   "8h"
  ],
  "line": [
   "S*7h",
   "S*2a",
   "3b3a"
  ],
  "cpuB": 21.75
 },
 {
  "id": "st2-tactic-50",
  "type": "tactic",
  "sfen": "ln1g4l/1r4g2/2s5p/1pp1psk2/p4n1P1/b+BP3S2/NPSPPP2P/L2G3R1/2K2G2L w 5Pnp 1",
  "accepted": [
   "4e3g+"
  ],
  "best": "4e3g+",
  "pv": [
   "4e3g+",
   "P*3e",
   "3d3c",
   "8f9f",
   "3g2h",
   "9f8f",
   "R*2i"
  ],
  "tesuji": "ryodori",
  "targets": [
   "2h",
   "3f"
  ],
  "line": [
   "4e3g+",
   "P*3e",
   "3d3c"
  ],
  "cpuB": 13
 },
 {
  "id": "st2-tactic-51",
  "type": "tactic",
  "sfen": "lns1k2nl/1r4g2/p1pgp1spp/5pp2/2P6/PbK2B3/1p1PPPPPP/2GG1S1R1/LNS4NL w 2P 1",
  "accepted": [
   "8g8h+"
  ],
  "best": "8g8h+",
  "pv": [
   "8g8h+",
   "P*8d"
  ],
  "tesuji": "ryodori",
  "targets": [
   "7i",
   "7h"
  ],
  "line": [
   "8g8h+",
   "P*8d"
  ],
  "cpuB": 28
 },
 {
  "id": "st2-tactic-52",
  "type": "tactic",
  "sfen": "l2gkg2l/1r1s2s2/p1npppnpp/2p3p2/9/2PB3P1/PS1PPPP1P/1K2GS1R1/LN1G3NL w Pbp 1",
  "accepted": [
   "P*8f"
  ],
  "best": "P*8f",
  "pv": [
   "P*8f",
   "8g7h",
   "B*8g",
   "8h7g",
   "7c6e",
   "7g6h",
   "8g7h+"
  ],
  "tesuji": "tapping-pawn",
  "targets": [
   "8g"
  ],
  "line": [
   "P*8f",
   "8g7h",
   "B*8g"
  ],
  "cpuB": 20.5
 },
 {
  "id": "st2-tactic-53",
  "type": "tactic",
  "sfen": "l3k1+B1l/1r1g1g2g/n2spp2n/p1ppP1pp1/1p3S2p/4RPPP1/+n2+b1SN1P/1+l4G1K/4S3L w 4p 1",
  "accepted": [
   "5c5d"
  ],
  "best": "5c5d",
  "pv": [
   "5c5d",
   "5i4h",
   "4b4a",
   "3a2a",
   "5a6a",
   "4e5d",
   "6a7b"
  ],
  "tesuji": "focal-pawn",
  "targets": [
   "5d"
  ],
  "line": [
   "5c5d",
   "5i4h",
   "4b4a"
  ],
  "cpuB": 12.5
 },
 {
  "id": "st2-tactic-54",
  "type": "tactic",
  "sfen": "ln1gk3l/3s2gs1/p1p1ppnpp/3p5/9/1rPP3P1/P1NBPPP1P/+b1GSGS1R1/4K2NL b 2Plp 1",
  "accepted": [
   "P*8g"
  ],
  "best": "P*8g",
  "pv": [
   "P*8g",
   "8f8b",
   "3g3f",
   "L*8d",
   "3f3e",
   "8d8g+",
   "7h8g"
  ],
  "tesuji": "focal-pawn",
  "targets": [
   "8g"
  ],
  "line": [
   "P*8g",
   "8f8b",
   "3g3f"
  ],
  "cpuB": 15
 },
 {
  "id": "st2-tactic-55",
  "type": "tactic",
  "sfen": "ln2gk1nl/6g2/p1rspp1pp/3pbs3/1Gp6/3P+B1PP1/PPK1PP2P/3SGS1R1/LN5NL w 2Pp 1",
  "accepted": [
   "5d7f"
  ],
  "best": "5d7f",
  "pv": [
   "5d7f",
   "5f6g",
   "6d6e",
   "7g7h",
   "6e6f",
   "6g7f",
   "7e7f"
  ],
  "tesuji": "ryodori",
  "targets": [
   "5h",
   "8e"
  ],
  "line": [
   "5d7f",
   "5f6g",
   "6d6e"
  ],
  "cpuB": 20.75
 },
 {
  "id": "st2-tactic-56",
  "type": "tactic",
  "sfen": "ln2g3l/1lk4g1/p1spp1ppn/2pn3r1/3+R5/1P5+BP/P2PPPP2/2PSKS3/L1G4G1 b B4Psn 1",
  "accepted": [
   "P*2e"
  ],
  "best": "P*2e",
  "pv": [
   "P*2e",
   "2d3d",
   "B*4e",
   "S*3e",
   "2f2g",
   "5a6b",
   "4e3d"
  ],
  "tesuji": "focal-pawn",
  "targets": [
   "2e"
  ],
  "line": [
   "P*2e",
   "2d3d",
   "B*4e"
  ],
  "cpuB": 16.75
 },
 {
  "id": "st2-tactic-57",
  "type": "tactic",
  "sfen": "ln1g3n1/1+Rs2kgs1/p1pppp1p1/6p1p/1p7/P1PB3P1/1gNPPPP1P/1b1SG2R1/L4KSNL w Lp 1",
  "accepted": [
   "8h9i+"
  ],
  "best": "8h9i+",
  "pv": [
   "8h9i+",
   "L*5f",
   "L*5b",
   "8b8e",
   "8g7h",
   "P*8b",
   "5c5d"
  ],
  "tesuji": "dengaku",
  "targets": [
   "7g",
   "6f"
  ],
  "line": [
   "8h9i+",
   "L*5f",
   "L*5b"
  ],
  "cpuB": 33
 },
 {
  "id": "st2-tactic-58",
  "type": "tactic",
  "sfen": "lr5nl/3kg4/2n1p2+Pp/p1ps1b3/3pPNp2/PPP2B3/3P3pP/1SG1R4/LNK5L w GS4Pgs 1",
  "accepted": [
   "G*4g"
  ],
  "best": "G*4g",
  "pv": [
   "G*4g",
   "5h5i",
   "4g4f",
   "2c3b",
   "B*4h",
   "5i2i",
   "4f4e"
  ],
  "tesuji": "ryodori",
  "targets": [
   "5h",
   "4f"
  ],
  "line": [
   "G*4g",
   "5h5i",
   "4g4f"
  ],
  "cpuB": 25.25
 },
 {
  "id": "st2-tactic-59",
  "type": "tactic",
  "sfen": "ln3s1nl/8n/prs1g1bkg/2pPpp1p1/PP1G2P2/2G1P3P/B1N1KP3/6R2/L1S1S3L b 4P2p 1",
  "accepted": [
   "6d6c+"
  ],
  "best": "6d6c+",
  "pv": [
   "6d6c+",
   "5c6c",
   "9g3a+",
   "4a3b",
   "P*6d",
   "6c6b",
   "6e5d"
  ],
  "tesuji": "ryodori",
  "targets": [
   "5c",
   "7c"
  ],
  "line": [
   "6d6c+",
   "5c6c",
   "9g3a+"
  ],
  "cpuB": 31
 },
 {
  "id": "st2-tactic-60",
  "type": "tactic",
  "sfen": "l6nl/1pg1ksg2/3ppp1pp/p1ps2P2/9/1RP1P4/PPGP1G1sP/5K3/L3R2NL w 2B2N2Psp 1",
  "accepted": [
   "S*6h"
  ],
  "best": "S*6h",
  "pv": [
   "S*6h",
   "B*6f",
   "6h5i",
   "4h5i",
   "2g3h",
   "4g4h",
   "R*3i"
  ],
  "tesuji": "ryodori",
  "targets": [
   "5i",
   "7g"
  ],
  "line": [
   "S*6h",
   "B*6f",
   "6h5i"
  ],
  "cpuB": 17.25
 },
 {
  "id": "st2-tactic-61",
  "type": "tactic",
  "sfen": "+S4pkn1/2+R1g1g2/pp1p3p1/2l1psb1p/4sNN2/4nPPP1/PP+pP1+B1RP/4G1p2/L1LGK1s1L w Pp 1",
  "accepted": [
   "P*7h"
  ],
  "best": "P*7h",
  "pv": [
   "P*7h",
   "7b7d",
   "7h7i+",
   "7d7g",
   "5e4f",
   "4g5f",
   "4d4e"
  ],
  "tesuji": "focal-pawn",
  "targets": [
   "7h"
  ],
  "line": [
   "P*7h",
   "7b7d",
   "7h7i+"
  ],
  "cpuB": 17.75
 },
 {
  "id": "st2-tactic-62",
  "type": "tactic",
  "sfen": "1n3g1nl/3s2k2/4p1spp/L1p2pp2/r2g5/2PBPP1P1/1PN3P1P/2L1SK1R1/5G1NL b B4Pgsp 1",
  "accepted": [
   "6f8d"
  ],
  "best": "6f8d",
  "pv": [
   "6f8d",
   "9e9h+",
   "8d6b+",
   "6e6f",
   "6b8d",
   "P*6e",
   "P*6g"
  ],
  "tesuji": "ryodori",
  "targets": [
   "6b",
   "9e"
  ],
  "line": [
   "6f8d",
   "9e9h+",
   "8d6b+"
  ],
  "cpuB": 23.25
 },
 {
  "id": "st2-tactic-63",
  "type": "tactic",
  "sfen": "ln5nl/1rg2s3/3ppg1kp/p2P1pps1/2S1R3b/P2SP4/1GP2PP1P/3G5/LK5NL w B3Pn2p 1",
  "accepted": [
   "8b8g+"
  ],
  "best": "8b8g+",
  "pv": [
   "8b8g+",
   "P*8h",
   "8g8c",
   "P*2e",
   "2d3c",
   "B*4a",
   "2c2b"
  ],
  "tesuji": "one-gap-dragon",
  "targets": [
   "8i"
  ],
  "line": [
   "8b8g+",
   "P*8h",
   "8g8c"
  ],
  "cpuB": 6.75
 },
 {
  "id": "st2-defend-0",
  "type": "defend",
  "sfen": "lns1kgsnl/3rg4/2pppp1pp/6p2/pp7/2P3PP1/PP+bPPP2P/2S1GS1R1/LNKG3NL b b 1",
  "accepted": [
   "7h7g",
   "8i7g",
   "6i6h",
   "6i5i"
  ],
  "best": "7h7g",
  "pv": [
   "7h7g",
   "6b8b",
   "2f2e",
   "4a3b",
   "6i7h",
   "7a6b",
   "4h3g"
  ],
  "threat": "B*8h",
  "threatMate": 1,
  "cpuB": 5.25
 },
 {
  "id": "st2-defend-1",
  "type": "defend",
  "sfen": "l3gksnl/1r4g2/p1nppp1pp/2p3R2/1p7/3b2P2/PPPP1PG1P/2SK1s3/LNBG3NL b 2Psp 1",
  "accepted": [
   "6g6f",
   "3d3b+"
  ],
  "best": "6g6f",
  "pv": [
   "6g6f",
   "8e8f"
  ],
  "threat": "S*5g",
  "threatMate": 1,
  "cpuB": 3
 },
 {
  "id": "st2-defend-2",
  "type": "defend",
  "sfen": "l4gk1l/3+R2g2/p5n2/3nP2pp/1b7/3PSP3/PP2S1P1P/2P1G4/+b2KN+r2L b GSNL6Psp 1",
  "accepted": [
   "S*6g",
   "N*2c",
   "G*6g",
   "G*6h",
   "N*6g",
   "G*4h",
   "G*7f",
   "N*4c",
   "N*7f",
   "L*7f",
   "G*4b",
   "S*2b",
   "S*4b",
   "L*6g",
   "G*2b",
   "G*2a",
   "6b3b",
   "S*7f",
   "5f6g",
   "6b4b"
  ],
  "best": "S*6g",
  "pv": [
   "S*6g",
   "6d5f",
   "5g5f"
  ],
  "threat": "8e5h+",
  "threatMate": 3,
  "cpuB": 10.25
 },
 {
  "id": "st2-defend-3",
  "type": "defend",
  "sfen": "l1r5l/5G3/p2pp1Gpk/1p3P+S1p/6P2/2P+r4P/PP3+b3/2GB2+p2/LNK1G3L w NP3s2n4p 1",
  "accepted": [
   "S*1b",
   "N*6g",
   "N*3a",
   "6f2f",
   "S*2b",
   "7a2a",
   "6f6h",
   "S*3b",
   "4g6i"
  ],
  "best": "S*1b",
  "pv": [
   "S*1b",
   "4b3b"
  ],
  "threat": "3c2c",
  "threatMate": 1,
  "cpuB": 5
 },
 {
  "id": "st2-defend-4",
  "type": "defend",
  "sfen": "l5knl/2r1g2g1/pBn1p2pp/1ppBsp3/5nP2/2PPP3P/PP1S1P3/2GSG1+p2/LN2KSr1L b Pp 1",
  "accepted": [
   "5h4h",
   "5i6i",
   "6h5g",
   "6h7i",
   "6d5c+"
  ],
  "best": "5h4h",
  "pv": [
   "5h4h",
   "3h4h",
   "5i4h",
   "7b6b",
   "6d7c+",
   "3i2i+",
   "8c7d+"
  ],
  "threat": "3i4i+",
  "threatMate": 1,
  "cpuB": 7
 },
 {
  "id": "st2-defend-5",
  "type": "defend",
  "sfen": "l+R3Gs1l/3g2k2/p2pppnpp/2s1n1p1b/P6P1/5PP2/3PPS2P/7R1/L2K1G1NL w B2Pgsn2p 1",
  "accepted": [
   "G*2a",
   "G*6a",
   "S*2b",
   "N*7a",
   "P*7a",
   "S*4b",
   "3a4b",
   "N*7g",
   "N*6a",
   "S*5h",
   "S*6a",
   "3a2b",
   "S*7a",
   "S*7h",
   "G*7i",
   "S*6h",
   "2c2d",
   "6b6a",
   "G*5i",
   "G*7h",
   "3b2b",
   "G*5h",
   "G*6h",
   "G*7a"
  ],
  "best": "P*7a",
  "pv": [
   "P*7a",
   "4a3a",
   "3b3a",
   "8a7a",
   "G*6a",
   "7a7d",
   "P*7g"
  ],
  "threat": "4a3a",
  "threatMate": 7,
  "cpuB": 12.75
 },
 {
  "id": "st2-defend-6",
  "type": "defend",
  "sfen": "5S1nl/3+N+R1gk1/p4pspp/2gpp4/2p2Pp2/1g1bP+B1P1/P1N2S2P/1P1KG3L/L1R4N1 w Ls4p 1",
  "accepted": [
   "3b4b",
   "S*3a",
   "6f7g+",
   "8f7g",
   "S*4b",
   "2b1b",
   "3c4b",
   "1c1d",
   "6f5g+",
   "S*5g",
   "S*6g"
  ],
  "best": "3b4b",
  "pv": [
   "3b4b",
   "5b6a",
   "7e7f",
   "6b5b"
  ],
  "threat": "5b3b",
  "threatMate": 1,
  "cpuB": 6.75
 },
 {
  "id": "st2-defend-7",
  "type": "defend",
  "sfen": "l2g2s1l/3gk4/p1pppp1pp/4n1p1S/P4N3/2+R2PP2/4+nSB1P/5S1R1/L2bK3L b GN2Pg4p 1",
  "accepted": [
   "G*6h",
   "4h5g",
   "N*4d",
   "5i4i",
   "P*5h",
   "G*5h",
   "N*6d",
   "N*5h",
   "7f7h",
   "4e5c+",
   "7f6g",
   "G*5a",
   "G*4b",
   "4h3i"
  ],
  "best": "G*6h",
  "pv": [
   "G*6h",
   "5g6h",
   "5i6h",
   "G*7h",
   "6h5g",
   "1c1d",
   "N*5h"
  ],
  "threat": "G*5h",
  "threatMate": 3,
  "cpuB": 13
 },
 {
  "id": "st2-defend-8",
  "type": "defend",
  "sfen": "ln6l/1r1g2k2/pspp1p2p/1p2p1p2/5P3/2P1P4/PP1P2P1P/2GSG1bs1/LN2K2NL b BGSNPrp 1",
  "accepted": [
   "5i6i",
   "6h5g",
   "N*2d",
   "N*4d",
   "N*4i",
   "6h7i",
   "6h7g",
   "G*4h",
   "5h4h",
   "G*4i",
   "S*4i",
   "5i4h",
   "G*3a",
   "G*2b",
   "S*3c",
   "G*3c",
   "S*2c",
   "S*2a",
   "G*3i",
   "G*4b",
   "B*2a",
   "S*4a",
   "G*2c",
   "B*4i",
   "B*4a",
   "B*2c",
   "B*1d"
  ],
  "best": "5i6i",
  "pv": [
   "5i6i",
   "R*3i",
   "5h5i",
   "6b5b",
   "S*3c",
   "3b3c"
  ],
  "threat": "R*4i",
  "threatMate": 1,
  "cpuB": 5.25
 },
 {
  "id": "st2-defend-9",
  "type": "defend",
  "sfen": "l7l/4s2k1/2+Pgpsn1p/p1p4g1/3p1pP2/1SP1P1pp1/P1NPBP2P/2GKG4/Lr5NL b BSNr2p 1",
  "accepted": [
   "7h7i",
   "N*6i",
   "7g8e",
   "N*7i",
   "N*3d",
   "7g6e",
   "S*7i",
   "N*1d",
   "S*6i",
   "B*7i",
   "5h5i",
   "B*6i",
   "5g4h",
   "5g8d",
   "7h8g",
   "5g7e",
   "5g9c+",
   "S*2c",
   "B*3a",
   "5g6f",
   "5g3i",
   "S*3a",
   "5g4f",
   "7h8h"
  ],
  "best": "7h7i",
  "pv": [
   "7h7i",
   "8i9i+",
   "7c6c",
   "R*4i",
   "N*5i",
   "5b6c",
   "7g6e"
  ],
  "threat": "R*6i",
  "threatMate": 1,
  "cpuB": 7
 },
 {
  "id": "st2-defend-10",
  "type": "defend",
  "sfen": "3+R3nl/1P1+N2gk1/p1+P1p1spp/1g2spp2/P8/Lp1K5/3PPPNPP/1L3S1g1/1+r6L b BGS2Pbnp 1",
  "accepted": [
   "6b6c",
   "S*5e",
   "6f5f",
   "B*5e",
   "S*6d",
   "G*5e",
   "B*6d",
   "6b5b",
   "7c6c",
   "6b5a",
   "S*6e",
   "G*7e",
   "6b7b",
   "6a2a",
   "6b7a",
   "G*6c",
   "B*3a",
   "G*6e",
   "G*6d",
   "7c7d",
   "S*7e",
   "G*7d",
   "B*4f",
   "S*3a"
  ],
  "best": "G*6e",
  "pv": [
   "G*6e",
   "8i8h",
   "B*4a",
   "B*8g",
   "6e5d",
   "5c5d"
  ],
  "threat": "B*5e",
  "threatMate": 5,
  "cpuB": 29.5
 },
 {
  "id": "st2-defend-11",
  "type": "defend",
  "sfen": "lns3+Rn1/3kg4/p+Bppp3p/1p7/b4Sp+r1/2P6/PP1PPPP1P/1S2KS3/L2G2GNL w 2Pgnlp 1",
  "accepted": [
   "5b5a",
   "7a7b",
   "G*7b",
   "P*4a",
   "G*5a",
   "L*5a",
   "N*5a",
   "L*4a",
   "N*4a",
   "L*7b",
   "N*7b",
   "N*6f",
   "9e6h+",
   "N*4f",
   "9e5i+",
   "5c5d"
  ],
  "best": "G*7b",
  "pv": [
   "G*7b",
   "9g9f"
  ],
  "threat": "3a6a",
  "threatMate": 1,
  "cpuB": 8.5
 },
 {
  "id": "st2-defend-12",
  "type": "defend",
  "sfen": "4g3l/3s5/p2pp1+Rpp/2p1s1p2/3n2kP1/1PP+BP4/P2P1bP2/1SGGL4/LN1KN+r1NL w G3Psp 1",
  "accepted": [
   "4g2e+",
   "P*4c",
   "S*4c",
   "S*5e",
   "6e7g",
   "4i5i",
   "5d4c",
   "5d5e",
   "4g5h+",
   "4i5h"
  ],
  "best": "P*4c",
  "pv": [
   "P*4c",
   "G*4f",
   "3e2f",
   "4f4g",
   "4i2i",
   "3c3d",
   "2i1i"
  ],
  "threat": "6f4d",
  "threatMate": 5,
  "cpuB": 23.5
 },
 {
  "id": "st2-defend-13",
  "type": "defend",
  "sfen": "ln1g1+R1nl/1r1k1G1p1/pspppp+b1p/1p4p2/9/2P6/PP1PPPP1P/3S1S3/1N1GKG1NL w SPbl 1",
  "accepted": [
   "L*5a",
   "6b7b",
   "7c7d",
   "6c6d",
   "3c4b",
   "L*5h",
   "B*5a",
   "6b7a",
   "5c5d",
   "8c7d",
   "8c9d",
   "8b7b",
   "8c9b"
  ],
  "best": "3c4b",
  "pv": [
   "3c4b",
   "4a4b",
   "6b7a",
   "4b5c"
  ],
  "threat": "4b5b",
  "threatMate": 7,
  "cpuB": 29
 },
 {
  "id": "st2-defend-14",
  "type": "defend",
  "sfen": "l1r3S1l/5GG1k/p1+bpp1ppp/1p3P3/6Pb1/2PP+r3P/PP7/2GSS1+p2/LNK1G3L w Ns2n3p 1",
  "accepted": [
   "1c1d",
   "N*6g",
   "7a3a",
   "S*2a"
  ],
  "best": "1c1d",
  "pv": [
   "1c1d",
   "3a2b",
   "7c4f",
   "3b3c",
   "7a7f",
   "4b3b",
   "5f6f"
  ],
  "threat": "3b2b",
  "threatMate": 1,
  "cpuB": 8.5
 },
 {
  "id": "st2-defend-15",
  "type": "defend",
  "sfen": "ln2+B3l/1rs3k1g/pppgp1nPp/5sR2/5N3/2P3p2/PP2PP2P/5S3/LNSGKG2L w Pb4p 1",
  "accepted": [
   "B*5e",
   "B*6f",
   "B*4b",
   "3b4c",
   "B*9e",
   "P*4b"
  ],
  "best": "B*5e",
  "pv": [
   "B*5e",
   "4e3c+",
   "4d3c",
   "3d3f",
   "3b4c",
   "5a4a",
   "5e9i+"
  ],
  "threat": "4e3c+",
  "threatMate": 5,
  "cpuB": 14.5
 },
 {
  "id": "st2-defend-16",
  "type": "defend",
  "sfen": "l1B1gksnl/6g2/p1nppp1pp/2p3R2/9/1r1P2P2/P1P2PG1P/2SK1s3/LNBG3NL b 3Ps2p 1",
  "accepted": [
   "6h5h",
   "6i5h",
   "7g7f",
   "6h6g",
   "P*5h",
   "P*5g",
   "3d3b+",
   "7h6g",
   "7h8g",
   "7a9c+",
   "3d5d",
   "7i8h",
   "3d6d"
  ],
  "best": "7g7f",
  "pv": [
   "7g7f",
   "P*8h",
   "7a5c+",
   "8f8e",
   "8i7g",
   "8e2e",
   "P*2g"
  ],
  "threat": "S*5g",
  "threatMate": 3,
  "cpuB": 9.75
 },
 {
  "id": "st2-defend-17",
  "type": "defend",
  "sfen": "l4s2l/2k2bs+N1/pp1P1pp1p/2p1g4/3pp1P+B1/N1Sn1P3/PG2PS1PP/3+n5/LK2G2RL b Prg2p 1",
  "accepted": [
   "5i6h",
   "6c6b+",
   "P*7c",
   "9f8d",
   "8i9h",
   "5i6i"
  ],
  "best": "5i6h",
  "pv": [
   "5i6h",
   "R*4h",
   "N*5h",
   "G*8f",
   "2e3f",
   "8f8g",
   "7f8g"
  ],
  "threat": "6h7h",
  "threatMate": 9,
  "cpuB": 12.75
 },
 {
  "id": "st2-defend-18",
  "type": "defend",
  "sfen": "lnR1g2n1/1+Bsk5/p1ppp3p/1p4SP1/b4lp2/2P6/PP1PPPP1P/1S2KS3/L2G2GNL w Prgnp 1",
  "accepted": [
   "5a6a",
   "4e4g+",
   "G*6a",
   "7b8c",
   "N*6f",
   "9e5i+",
   "N*4f",
   "7b6a",
   "G*6h",
   "G*5i",
   "R*5i",
   "9e6h+",
   "R*7h",
   "R*6h",
   "6b5b"
  ],
  "best": "7b6a",
  "pv": [
   "7b6a",
   "7a8a+"
  ],
  "threat": "7a7b+",
  "threatMate": 1,
  "cpuB": 7
 },
 {
  "id": "st2-defend-19",
  "type": "defend",
  "sfen": "+BnRp1g2l/4p1g1k/p1p+S1Pngp/+b1s3pp1/2n6/SK1PP1P1P/P1N6/2P4R1/8L b S2L2Pg2p 1",
  "accepted": [
   "S*7f",
   "P*8e",
   "L*7f",
   "L*8e",
   "S*8e",
   "S*8g",
   "7g8e",
   "S*2a",
   "S*6g"
  ],
  "best": "P*8e",
  "pv": [
   "P*8e",
   "7d6c",
   "9a8a"
  ],
  "threat": "G*7f",
  "threatMate": 1,
  "cpuB": 14.5
 },
 {
  "id": "st2-defend-20",
  "type": "defend",
  "sfen": "ln2+B1gnl/1g7/3p1s1kp/p4pps1/1+rS1R2P1/P2SP2bP/2P2PP2/1P1G5/LK5NL w G3Pn2p 1",
  "accepted": [
   "2d3c",
   "2f3e",
   "N*9g",
   "2f1e",
   "2d3e",
   "2a3c"
  ],
  "best": "2d3e",
  "pv": [
   "2d3e"
  ],
  "threat": "2e2d",
  "threatMate": 3,
  "cpuB": 7
 },
 {
  "id": "st2-defend-21",
  "type": "defend",
  "sfen": "lnsB1k1n+P/2g1gs3/prppp3p/6p2/2P2p3/3B5/PgNPPPP1P/2G2S3/L1K3SNL b LPr2p 1",
  "accepted": [
   "L*8e",
   "6a5b+",
   "P*8e",
   "P*8h",
   "P*8d",
   "L*8d",
   "7g6e",
   "P*8i",
   "P*8f",
   "7g8e",
   "7i6i",
   "7i6h",
   "L*8f",
   "7h8g"
  ],
  "best": "L*8e",
  "pv": [
   "L*8e",
   "8g7h",
   "7i7h",
   "4a5a"
  ],
  "threat": "8g7h",
  "threatMate": 5,
  "cpuB": 13.75
 },
 {
  "id": "st2-defend-22",
  "type": "defend",
  "sfen": "ln+B6/5rk1l/pspp1p2p/1p2p1p2/5P3/2P1Pn3/PP1PGGP1P/2G6/LN1KS+b+r1L b SNPgsp 1",
  "accepted": [
   "S*6h",
   "N*2d",
   "S*4h",
   "6i7i",
   "S*3c",
   "N*4d",
   "S*2c",
   "S*2a",
   "S*4a"
  ],
  "best": "S*4h",
  "pv": [
   "S*4h",
   "S*5h",
   "6i7i",
   "4i4h",
   "4g4h",
   "5h5i",
   "7a5c"
  ],
  "threat": "4i5i",
  "threatMate": 7,
  "cpuB": 12.25
 },
 {
  "id": "st2-defend-23",
  "type": "defend",
  "sfen": "ln5rl/3+N2sn1/2p2S1kp/pp1SG1gp1/4+B4/2P1P2P1/PP1Pb3P/2KG2+r2/LN6L b G3Ps3p 1",
  "accepted": [
   "G*5h",
   "4c3d+",
   "4c3b",
   "G*6i",
   "G*5i",
   "5e7g",
   "G*7i",
   "4c3d",
   "P*4h",
   "5e2b",
   "G*4h",
   "5e3c"
  ],
  "best": "G*5h",
  "pv": [
   "G*5h",
   "5g6h+",
   "7h6h",
   "3b4c",
   "5d4c"
  ],
  "threat": "3h6h",
  "threatMate": 1,
  "cpuB": 3.75
 },
 {
  "id": "st2-defend-24",
  "type": "defend",
  "sfen": "l4g1nl/4sk1+S1/p3pp2p/2pg2pP1/3+bPP3/1PP6/P+b2S1P1P/3SGG3/1r1PK2NL b RNLn3p 1",
  "accepted": [
   "N*7i",
   "L*7i",
   "5i4i",
   "N*7h",
   "2b3b",
   "N*5d",
   "R*7i",
   "6h7i",
   "4h4g",
   "4h4i",
   "L*7h",
   "R*3b",
   "R*7h",
   "R*9i"
  ],
  "best": "L*7i",
  "pv": [
   "L*7i",
   "6e2i"
  ],
  "threat": "8i6i+",
  "threatMate": 1,
  "cpuB": 7.5
 },
 {
  "id": "st2-defend-25",
  "type": "defend",
  "sfen": "ln3g1nl/1r5k1/2p1pg1p1/p2pspsPp/2P3P2/Pp1P1PGRP/1PSSP1N2/1KG5B/LN1+b4L b p 1",
  "accepted": [
   "8g8f",
   "7g8f",
   "6g7f",
   "7g7f",
   "2d2c+",
   "9i9h"
  ],
  "best": "8g8f",
  "pv": [
   "8g8f",
   "2c2d",
   "3e3d",
   "6i4g",
   "S*3e",
   "4a3b",
   "3e2d"
  ],
  "threat": "8f8g+",
  "threatMate": 3,
  "cpuB": 8.25
 },
 {
  "id": "st2-defend-26",
  "type": "defend",
  "sfen": "lnS1k2nl/2r4g1/2p3sPp/3B1ppp1/pnSB5/2P1PPP2/PP1P4P/1KS1+r4/L6+nL b GP2g2p 1",
  "accepted": [
   "G*6b",
   "7e6f",
   "7e8f",
   "6d5e",
   "G*4a"
  ],
  "best": "7e8f",
  "pv": [
   "7e8f",
   "G*6h",
   "G*8i"
  ],
  "threat": "G*7g",
  "threatMate": 3,
  "cpuB": 14
 },
 {
  "id": "st2-defend-27",
  "type": "defend",
  "sfen": "l4g1nl/4sk1p1/p3pp1Sp/2pg2pP1/3PPP3/1PP6/P3S1P1P/+b2SG1+b2/4K2NL b RGNLrn2p 1",
  "accepted": [
   "5h4h",
   "G*4h",
   "5i6i",
   "L*4i",
   "R*4h",
   "N*5d",
   "6h6g",
   "N*4i",
   "6h7i",
   "R*4i",
   "2c3b+",
   "G*3b",
   "R*4g",
   "6h7g",
   "G*4i",
   "G*3i",
   "R*4f",
   "G*3c",
   "R*3b",
   "R*3i"
  ],
  "best": "G*4h",
  "pv": [
   "G*4h",
   "3h6e",
   "2c2b+",
   "R*3i",
   "R*4i",
   "3i4i+",
   "4h4i"
  ],
  "threat": "R*4i",
  "threatMate": 1,
  "cpuB": 7
 },
 {
  "id": "st2-defend-28",
  "type": "defend",
  "sfen": "l6nl/4gkg2/p1n1psbpp/3S2p2/4Sp1P1/1PBp1P3/P2sP1P1P/9/LN1KG1RNL b R4Pg 1",
  "accepted": [
   "7f4c+",
   "5i5h",
   "7f8g",
   "7f6g",
   "5i6h",
   "6d5c",
   "3i3h",
   "P*7h",
   "6d5c+",
   "P*7i",
   "R*1h",
   "R*8h",
   "R*4h",
   "R*2h",
   "R*7g",
   "R*7h",
   "R*7i",
   "R*9h",
   "R*6h",
   "R*5h",
   "R*3h",
   "R*4a"
  ],
  "best": "7f8g",
  "pv": [
   "7f8g",
   "7c6e",
   "R*7a",
   "6e5g+",
   "P*6h"
  ],
  "threat": "G*7h",
  "threatMate": 1,
  "cpuB": 3.75
 },
 {
  "id": "st2-defend-29",
  "type": "defend",
  "sfen": "3+R3nl/1P1+N2gk1/p1+P1p+Sspp/4spp2/Pp7/L8/3PPP1PP/1LK2S1g1/rN5NL w B2G2Pbp 1",
  "accepted": [
   "5d4c",
   "P*7g",
   "B*6i",
   "9i8i+",
   "4d4e",
   "1c1d",
   "B*4a",
   "B*8g",
   "B*4b"
  ],
  "best": "5d4c",
  "pv": [
   "5d4c",
   "8b8a+"
  ],
  "threat": "4c3b",
  "threatMate": 9,
  "cpuB": 7
 },
 {
  "id": "st2-defend-30",
  "type": "defend",
  "sfen": "lr5nl/3kg4/2n1p2+Pp/p1ps1b3/3pPNp2/PPP2B3/3P3pP/1SG1+s3R/LNK5L b G4Pgs 1",
  "accepted": [
   "8h7g",
   "4e5c+",
   "1h5h",
   "8h8g",
   "G*6h",
   "8h9g",
   "8i7g",
   "8i9g",
   "G*6a",
   "7h7g",
   "7h6h",
   "G*6i",
   "G*5i",
   "G*7b",
   "G*6c"
  ],
  "best": "8h7g",
  "pv": [
   "8h7g",
   "G*4g",
   "5e5d",
   "4g4f",
   "5d5c+",
   "6d5c"
  ],
  "threat": "G*6i",
  "threatMate": 1,
  "cpuB": 2
 },
 {
  "id": "st2-defend-31",
  "type": "defend",
  "sfen": "lns1k2nl/4g1g2/p1ppppspp/6p2/9/4P1PP1/P1SP1PS1P/1+r7/LN2KG1NL b 2Brg3p 1",
  "accepted": [
   "7g8h",
   "B*4b",
   "B*6b",
   "B*6h",
   "B*9f",
   "7g6h",
   "B*4f",
   "B*6i",
   "B*5h",
   "B*5g",
   "B*3e",
   "B*8g",
   "B*2d",
   "4i5h",
   "B*7i"
  ],
  "best": "7g8h",
  "pv": [
   "7g8h",
   "R*7h",
   "R*8c",
   "G*6h",
   "5i4h",
   "P*8b",
   "8c8f+"
  ],
  "threat": "G*6i",
  "threatMate": 3,
  "cpuB": -0.25
 },
 {
  "id": "st2-defend-32",
  "type": "defend",
  "sfen": "ln6l/1b2g1+P+R1/1ss2k2p/2p1p4/pp4s2/b1P3p2/NP1PPP2P/LS1G5/2K2G2L w N5Prgn 1",
  "accepted": [
   "4c5c",
   "4c4d",
   "5d5e",
   "G*3d",
   "N*4a",
   "5b6c",
   "5b6b",
   "5b5a",
   "R*3d",
   "5b5c",
   "4c3d",
   "N*2a",
   "5b4b",
   "3e4d",
   "G*4b",
   "3e2d",
   "G*8i",
   "G*6i",
   "G*7h",
   "R*7h",
   "R*9i",
   "R*8i",
   "R*7g",
   "R*6i",
   "R*5i"
  ],
  "best": "4c5c",
  "pv": [
   "4c5c",
   "2b1a",
   "8e8f",
   "1a1c",
   "N*4c",
   "8g8f",
   "R*2i"
  ],
  "threat": "2b3c",
  "threatMate": 1,
  "cpuB": 7.5
 },
 {
  "id": "st2-defend-33",
  "type": "defend",
  "sfen": "ln2S1r1l/4+B2s1/2pp2kpp/p1b2s3/1p2pg3/2P2N2P/PPSPPPP2/2G2G1P1/LN2K2NG w 2Prl 1",
  "accepted": [
   "3c2d",
   "R*4a",
   "2c2d",
   "L*4a",
   "R*3i",
   "4e4f",
   "3c3b",
   "4d3e",
   "R*4c",
   "R*8b",
   "R*7b",
   "L*5h",
   "4d5c",
   "R*9b",
   "3a5a",
   "3a4a",
   "R*6b",
   "R*7i",
   "R*6i",
   "R*5h",
   "R*4i"
  ],
  "best": "R*4a",
  "pv": [
   "R*4a",
   "5b3d",
   "3c3b",
   "5a6b+",
   "6c6d",
   "5g5f",
   "4e5f"
  ],
  "threat": "5b4b",
  "threatMate": 1,
  "cpuB": 1.5
 },
 {
  "id": "st2-defend-34",
  "type": "defend",
  "sfen": "7+Rl/l+S2grSs1/p1p1p1sPk/4+bNgpp/4N4/2gP1P3/PP2G3P/1K7/LNB4NL b 2P5p 1",
  "accepted": [
   "8h7h",
   "6f6e",
   "2a2b",
   "7i6h",
   "2a1a",
   "2a1b"
  ],
  "best": "8h7h",
  "pv": [
   "8h7h",
   "5d4d"
  ],
  "threat": "7f8g",
  "threatMate": 1,
  "cpuB": 9.5
 },
 {
  "id": "st2-defend-35",
  "type": "defend",
  "sfen": "ln2k3l/1r1p3g1/p1s2s2p/1p2pp1p1/2PS5/+B3+B4/PPGPS1+p1P/1K7/LNg2r1PL b G2N3Pp 1",
  "accepted": [
   "6g6f",
   "G*4a",
   "8g8f",
   "7g7h",
   "7g7f",
   "P*5i",
   "7g8f",
   "5g6h",
   "P*5b",
   "N*6i",
   "N*6c",
   "8h9h",
   "N*5i",
   "G*5b",
   "G*4b",
   "G*6a",
   "7g6f",
   "G*5i",
   "G*6i",
   "9f4a",
   "9f5b"
  ],
  "best": "6g6f",
  "pv": [
   "6g6f",
   "7i8i",
   "5f8i"
  ],
  "threat": "7i8i",
  "threatMate": 5,
  "cpuB": 8.5
 },
 {
  "id": "st2-defend-36",
  "type": "defend",
  "sfen": "ln3g1nl/1r5s1/p1ppsk1pp/1p3pp2/b8/1PPb1P1R1/P2PPSP1P/3KG4/L1SG3NL b Pgnp 1",
  "accepted": [
   "6g6f",
   "6h5i",
   "6h7h",
   "5h5i",
   "6i7h",
   "5h4h",
   "6i5i",
   "2f2c+"
  ],
  "best": "6g6f",
  "pv": [
   "6g6f",
   "9e8f",
   "6h7h",
   "G*7g",
   "7h8i",
   "5c5d",
   "7i7h"
  ],
  "threat": "9e8f",
  "threatMate": 7,
  "cpuB": 0.25
 },
 {
  "id": "st2-defend-37",
  "type": "defend",
  "sfen": "l2gkg2l/1r1s2s2/p1npppnpp/2p3p2/9/1pPB3P1/Pb1PPPP1P/SK2GS1R1/LN1G3NL b P 1",
  "accepted": [
   "6i7h",
   "8h7i",
   "9h8g",
   "6i6h",
   "5h5i",
   "6i5i",
   "6f3c+",
   "6i7i"
  ],
  "best": "9h8g",
  "pv": [
   "9h8g",
   "8f8g+",
   "8h7i",
   "S*8h",
   "7i6h",
   "8h8i+",
   "B*2b"
  ],
  "threat": "8g6i+",
  "threatMate": 7,
  "cpuB": 4.75
 },
 {
  "id": "st2-defend-38",
  "type": "defend",
  "sfen": "ln2g2nl/1k2r4/1gsp1p1pp/ppp3p2/9/2P1PPsP1/PP+bPS3P/3SGBPR1/LNK4NL b gp 1",
  "accepted": [
   "8i7g",
   "6h7g",
   "7i6i"
  ],
  "best": "8i7g",
  "pv": [
   "8i7g",
   "G*2g",
   "2h2g",
   "3f2g",
   "G*4i",
   "7d7e",
   "B*6e"
  ],
  "threat": "G*7h",
  "threatMate": 1,
  "cpuB": 5
 },
 {
  "id": "st2-defend-39",
  "type": "defend",
  "sfen": "ln5rl/3+NR1gn1/2p4kp/pp1S+B1gp1/9/2P1P2P1/PP1P4P/3KG4/LN4P1L w S2Pbg2s3p 1",
  "accepted": [
   "G*4a",
   "B*3e",
   "P*4c",
   "S*4b",
   "S*4a",
   "P*3a",
   "S*3a",
   "2a3a",
   "G*3a",
   "G*3c",
   "P*4b",
   "3d3c",
   "G*4b",
   "G*4c",
   "B*9e",
   "B*4f",
   "S*4c",
   "S*5i",
   "B*4a",
   "S*5g",
   "S*7i",
   "G*5g",
   "S*7g",
   "G*7g",
   "B*4c",
   "G*6i",
   "B*5i",
   "3b3c",
   "B*7g",
   "3b3a",
   "G*7h",
   "B*4b",
   "B*5g",
   "B*8f",
   "B*7i",
   "3b4b",
   "3b4c",
   "2c1d",
   "2c1b"
  ],
  "best": "P*4b",
  "pv": [
   "P*4b",
   "5d3b",
   "2c3b",
   "5b5e+"
  ],
  "threat": "5d3b",
  "threatMate": 3,
  "cpuB": 8.5
 },
 {
  "id": "st2-defend-40",
  "type": "defend",
  "sfen": "2R4nl/1P1+N1kg2/p1+P1pbspp/4spp2/Pp7/L8/3PPP1PP/1LK2S1g1/rN5NL w 2GSPb2p 1",
  "accepted": [
   "P*6a",
   "3b3a",
   "3c2b",
   "3c2d",
   "P*7g",
   "B*6a",
   "B*4a",
   "B*6i",
   "B*8g",
   "4c6a",
   "9i8i+"
  ],
  "best": "P*6a",
  "pv": [
   "P*6a",
   "S*5b",
   "4b3a",
   "5b4c+",
   "5d4c",
   "7h7g",
   "9i9f+"
  ],
  "threat": "G*4a",
  "threatMate": 1,
  "cpuB": 7
 },
 {
  "id": "st2-defend-41",
  "type": "defend",
  "sfen": "lrs3knl/2g4b1/2n2g+B1p/p1p1p1pp1/3p1p3/1PP4P1/PKSPPPPGP/1GR2S3/LN5NL w SP 1",
  "accepted": [
   "2b3c",
   "4c3c",
   "2a3c",
   "8a8f",
   "4c4b"
  ],
  "best": "2b3c",
  "pv": [
   "2b3c",
   "7h7i",
   "3a3b",
   "2g3f",
   "B*2h",
   "7f7e",
   "7d7e"
  ],
  "threat": "S*3b",
  "threatMate": 1,
  "cpuB": 2
 },
 {
  "id": "st2-defend-42",
  "type": "defend",
  "sfen": "lns1sB+N1l/2gks3g/pppp5/4ppp1p/9/4P4/PPPP1PP1P/1B1GG2+r1/LN2K1SNL b 2Pr 1",
  "accepted": [
   "3i2h",
   "4a5b+",
   "5i4i",
   "6h6i",
   "5i6i",
   "3i3h",
   "6h7h"
  ],
  "best": "3i2h",
  "pv": [
   "3i2h",
   "5b4a",
   "3a4a",
   "5a5b",
   "7g7f",
   "5b4a",
   "8h4d"
  ],
  "threat": "2h3i",
  "threatMate": 1,
  "cpuB": -0.75
 },
 {
  "id": "st2-defend-43",
  "type": "defend",
  "sfen": "+S4p3/1+B2g1k2/p2p2np1/1p2p1b1p/2+R3N1n/4g1sP1/PP3+p2P/6pR1/L1LG1K2L b G2SLn5p 1",
  "accepted": [
   "6i6h",
   "3e2c+",
   "L*5h",
   "S*5h",
   "S*6h",
   "G*4c",
   "G*5h",
   "S*7f",
   "L*4e",
   "8b4f",
   "6i7h",
   "S*4c",
   "7e7f",
   "G*6h",
   "7e7g",
   "4i5i",
   "3e4c+",
   "7i7h",
   "S*4e",
   "7e6e",
   "7e4e",
   "S*6f",
   "G*4e",
   "S*4f",
   "S*5g",
   "G*4b",
   "7e6d",
   "7e5e",
   "7e6f",
   "L*5g",
   "G*6f",
   "G*2b",
   "G*6g",
   "S*2a",
   "G*3a",
   "G*5g"
  ],
  "best": "6i6h",
  "pv": [
   "6i6h",
   "3f3g",
   "8b3g",
   "4g3g",
   "4i5i",
   "3g2h"
  ],
  "threat": "N*5g",
  "threatMate": 9,
  "cpuB": 12.5
 },
 {
  "id": "st2-defend-44",
  "type": "defend",
  "sfen": "ln2g1k1l/5sg2/p2p1pn2/5b1pp/4P4/3PR4/PP+rS1PP1P/2S6/LNKG3NL b S5Pbgp 1",
  "accepted": [
   "7h7g",
   "8i7g",
   "S*2b",
   "S*8h",
   "6i6h",
   "6i5h",
   "6i5i"
  ],
  "best": "7h7g",
  "pv": [
   "7h7g",
   "B*3h"
  ],
  "threat": "B*8h",
  "threatMate": 1,
  "cpuB": 7
 },
 {
  "id": "st2-defend-45",
  "type": "defend",
  "sfen": "4+RS1nl/4+Ng1k1/p4pspp/2g1p4/3p1PpL1/1g1bP+B1P1/P1+p2S2P/1P2G3L/L1+n2K1N1 b rs4p 1",
  "accepted": [
   "4i3h",
   "5h4h",
   "5h5g",
   "4f5g",
   "4f2h",
   "4a3b+",
   "5a4b",
   "2e2c+",
   "2e2c"
  ],
  "best": "4i3h",
  "pv": [
   "4i3h",
   "S*4i",
   "3h2h",
   "4b4a",
   "5b4a",
   "4i5h",
   "4a4b"
  ],
  "threat": "R*3i",
  "threatMate": 1,
  "cpuB": 6.75
 },
 {
  "id": "st2-defend-46",
  "type": "defend",
  "sfen": "ln6l/1rs3k2/p1p1pgppp/1p1p2g2/4+r4/2P2PP2/PP1P1s1SP/1BSNG1N2/LN2K2GL b Pb2p 1",
  "accepted": [
   "8h5e",
   "P*5f"
  ],
  "best": "8h5e",
  "pv": [
   "8h5e",
   "B*3g",
   "5i6i",
   "4g5h",
   "6i5h",
   "7b6c",
   "R*5a"
  ],
  "threat": "5e5h",
  "threatMate": 1,
  "cpuB": -0.25
 },
 {
  "id": "st2-defend-47",
  "type": "defend",
  "sfen": "l7l/5bs2/pp1k1pp1p/4g4/2Gpp1P2/N4P3/Ps1PPSSPP/3G3p1/LKR5L b R2N2Pbgnp 1",
  "accepted": [
   "P*8h",
   "7e7d",
   "N*8h",
   "R*8h",
   "R*6a",
   "R*7h",
   "7i7h",
   "R*7c",
   "R*5c",
   "R*6d",
   "R*9h",
   "7e6d",
   "R*6b"
  ],
  "best": "P*8h",
  "pv": [
   "P*8h",
   "B*9e",
   "7e7d",
   "6c5c",
   "R*7c",
   "5c5b",
   "8h8g"
  ],
  "threat": "G*8h",
  "threatMate": 1,
  "cpuB": 9.5
 },
 {
  "id": "st2-defend-48",
  "type": "defend",
  "sfen": "ln5kB/3s1s2l/p1p2p2p/3Pg1gg1/1pP1BP3/6RP1/PP1S2P1P/3KPS1R1/LN6L w N4Pgn 1",
  "accepted": [
   "G*3a",
   "G*3b",
   "5d5e",
   "N*7f",
   "N*5f",
   "N*4d",
   "4b3a",
   "2a3a",
   "2a3b",
   "2d2c",
   "4c4d",
   "N*3c",
   "G*2c",
   "G*6i",
   "G*7h",
   "G*3c",
   "G*5g",
   "G*7g"
  ],
  "best": "5d5e",
  "pv": [
   "5d5e",
   "1a5e+",
   "B*3c",
   "5e3c",
   "3d3c"
  ],
  "threat": "1a2b+",
  "threatMate": 1,
  "cpuB": 3.5
 },
 {
  "id": "st2-defend-49",
  "type": "defend",
  "sfen": "ln6l/1rs3k2/p1p1pgppp/1p1p2g2/4B4/2P2PP2/PP1P2bSP/2SNK1N2/LN3+p1GL b RSPgp 1",
  "accepted": [
   "R*6b",
   "5h6i",
   "6g6f",
   "5e6d",
   "S*2a",
   "5e6f",
   "S*4a",
   "6h5f",
   "R*5b",
   "S*5g",
   "2i3i",
   "S*3i",
   "5e3c+",
   "R*4g",
   "S*6f"
  ],
  "best": "5h6i",
  "pv": [
   "5h6i",
   "3g5i+",
   "6i7i",
   "4i4h",
   "5e7g",
   "4h5h",
   "R*5a"
  ],
  "threat": "3g5i+",
  "threatMate": 5,
  "cpuB": 15.75
 },
 {
  "id": "st2-defend-50",
  "type": "defend",
  "sfen": "l4g1nl/3+Lsk1+S1/p3pp1+Pp/2p3p2/4gP3/1P+b6/P1n1S1P1P/3SGG3/1rNP1K1+bL w Rn5p 1",
  "accepted": [
   "5c5d",
   "4c4d",
   "N*3b",
   "7f5h",
   "2i3h",
   "2i3i"
  ],
  "best": "4c4d",
  "pv": [
   "4c4d",
   "6h7g",
   "7f7g"
  ],
  "threat": "R*3b",
  "threatMate": 3,
  "cpuB": 31
 },
 {
  "id": "st2-defend-51",
  "type": "defend",
  "sfen": "ln1gkgsnl/1P1s5/p1ppppbp1/6p1p/9/PrP6/3PPPPPP/1SK1GS1R1/LN1G3NL b Bp 1",
  "accepted": [
   "8i7g",
   "6g6f",
   "6i7i",
   "B*7g",
   "B*6f",
   "8h7g",
   "8h8g",
   "B*8g",
   "8h9g",
   "B*7i",
   "B*9g",
   "8h7i",
   "B*5e",
   "B*4b",
   "B*4d",
   "7h6h"
  ],
  "best": "6g6f",
  "pv": [
   "6g6f",
   "3c6f"
  ],
  "threat": "8f8h+",
  "threatMate": 1,
  "cpuB": 7
 },
 {
  "id": "st2-defend-52",
  "type": "defend",
  "sfen": "ln4+R1l/2ks5/p1ppp1g2/8p/5pP2/1PP6/P2PPP2P/2GS5/+bN1K1G1+rL b S3Pbgs2nlp 1",
  "accepted": [
   "S*3h",
   "S*3i",
   "S*8c",
   "4i5i",
   "S*5h",
   "6h5i",
   "S*6a",
   "3a8a",
   "3a6a"
  ],
  "best": "S*3h",
  "pv": [
   "S*3h",
   "2i1i"
  ],
  "threat": "2i4i",
  "threatMate": 5,
  "cpuB": 6.75
 },
 {
  "id": "st2-defend-53",
  "type": "defend",
  "sfen": "ln5nl/1r2g2k1/p1pspp2p/1p1p5/6P2/2P1+BP3/PPGPP3P/1r3S3/LN2KG1NL b S3Pbgs 1",
  "accepted": [
   "S*7h",
   "S*6i",
   "5f5e",
   "S*7i",
   "4i5h",
   "5f6f",
   "4h3g",
   "P*2c",
   "S*2c",
   "7g7h",
   "5f1b",
   "5f2c"
  ],
  "best": "S*7h",
  "pv": [
   "S*7h",
   "2b3b",
   "4h3g",
   "G*7i",
   "6g6f",
   "3b4b",
   "3e3d"
  ],
  "threat": "G*6h",
  "threatMate": 1,
  "cpuB": 7
 },
 {
  "id": "st2-defend-54",
  "type": "defend",
  "sfen": "9/3+Bg1k2/p3p3g/1ppp1pps1/1s6b/2P1P1PR1/PP1P+nPN2/1G3S3/LNL1K4 b RNL3Pgslp 1",
  "accepted": [
   "4h5g",
   "L*3c",
   "R*7h",
   "R*6h",
   "R*5h",
   "R*2b",
   "R*3c",
   "R*3a",
   "R*4b",
   "R*1b"
  ],
  "best": "4h5g",
  "pv": [
   "4h5g",
   "5b6b",
   "L*2g",
   "B*3i",
   "N*4h",
   "S*3h",
   "P*1d"
  ],
  "threat": "G*5h",
  "threatMate": 1,
  "cpuB": 9.5
 },
 {
  "id": "st2-defend-55",
  "type": "defend",
  "sfen": "lnr5l/6g2/6n1p/p1ppp1+SPk/1p7/P1P1S1P1P/1P1PP4/2GKG4/LNS3S+rL w GP2bn3p 1",
  "accepted": [
   "B*2f",
   "B*3g",
   "B*8f",
   "B*7g",
   "B*5i",
   "B*9e"
  ],
  "best": "B*2f",
  "pv": [
   "B*2f",
   "G*1e"
  ],
  "threat": "G*1e",
  "threatMate": 1,
  "cpuB": 31
 },
 {
  "id": "st2-defend-56",
  "type": "defend",
  "sfen": "ln1gk1snl/1r1s5/p1pppp+Rpp/1p5P1/4b4/9/PPPPPPP1P/1BG2S3/LNS1KG1NL w GP 1",
  "accepted": [
   "2a3c",
   "5e3c",
   "3a4b",
   "5e7g+",
   "5a5b",
   "6b7a",
   "5c5d",
   "6c6d"
  ],
  "best": "2a3c",
  "pv": [
   "2a3c",
   "2d2c+",
   "R*2h",
   "G*2d",
   "2h2i+",
   "4i3i",
   "2i1i"
  ],
  "threat": "3c3a",
  "threatMate": 3,
  "cpuB": 3.5
 },
 {
  "id": "st2-defend-57",
  "type": "defend",
  "sfen": "ln2kgsnl/1P1sg4/pp2pp1pp/2pp1gp2/9/P1PB2P2/2NPPPN1P/+r1BK1S3/1LS3+r1L b Pg 1",
  "accepted": [
   "4h3i",
   "4h5i"
  ],
  "best": "4h3i",
  "pv": [
   "4h3i",
   "6d6e"
  ],
  "threat": "3i4h",
  "threatMate": 3,
  "cpuB": 2
 },
 {
  "id": "st2-defend-58",
  "type": "defend",
  "sfen": "l2g2k1l/4s4/prnp3gp/2p1+B1pp1/1p2pR3/2PPb4/PPS1K1P1P/1G4G2/LNs4NL w SNP3p 1",
  "accepted": [
   "5f4e",
   "7c6e",
   "P*4c",
   "7i6h",
   "P*4d",
   "5f4g+",
   "5f6g+"
  ],
  "best": "5f4e",
  "pv": [
   "5f4e",
   "5d4e",
   "7i8h",
   "7g8h",
   "R*5i",
   "5g4h",
   "5i2i+"
  ],
  "threat": "S*3b",
  "threatMate": 9,
  "cpuB": 23.5
 },
 {
  "id": "st2-defend-59",
  "type": "defend",
  "sfen": "l1r5l/5G2s/p2pp+PG1k/1p4+Spp/6P1L/2PB1+r3/PP3+b3/2G3+p2/LNK1G4 w 2NP2sn5p 1",
  "accepted": [
   "4f6f",
   "1d1e",
   "N*5e",
   "N*6g",
   "P*3b",
   "7a2a",
   "P*4d",
   "N*4a",
   "S*2a",
   "N*2a",
   "N*4d",
   "S*6h",
   "N*3a",
   "S*5e",
   "S*4d",
   "4g6i",
   "S*3a",
   "S*2b",
   "4f4c",
   "7a3a",
   "S*3b",
   "4g5g",
   "4f5e",
   "4f4d"
  ],
  "best": "4f6f",
  "pv": [
   "4f6f",
   "8i7g"
  ],
  "threat": "3c2c",
  "threatMate": 9,
  "cpuB": 3.5
 },
 {
  "id": "st2-defend-60",
  "type": "defend",
  "sfen": "ln5nl/2sG1kg2/prppp1ppp/4np1P1/1p7/2P1B4/PPBPGP2P/2S1KS1+r1/LN1G2s1L b 2p 1",
  "accepted": [
   "7g5i",
   "6i5i",
   "5h6h",
   "6g6f",
   "6b5b"
  ],
  "best": "6i5i",
  "pv": [
   "6i5i",
   "8c8b",
   "2d2c+",
   "3b2c",
   "7g5e",
   "3i4h+",
   "5i4h"
  ],
  "threat": "2h4h",
  "threatMate": 1,
  "cpuB": 9.75
 },
 {
  "id": "st2-defend-61",
  "type": "defend",
  "sfen": "l2gkgsnl/3s5/p1nppp1p1/6p1p/2P6/P4B1P1/1ps1PPP1P/5S1R1/L2K3NL b RB2P2gnp 1",
  "accepted": [
   "6i5h",
   "6i5i",
   "4h3i",
   "5g5f",
   "B*7i",
   "R*6g",
   "4f2d",
   "R*5h",
   "4h5i",
   "B*4b",
   "B*1e",
   "B*2d",
   "B*3c",
   "R*9h",
   "R*6f",
   "R*6d",
   "R*7h",
   "R*8h",
   "R*6h",
   "R*6e",
   "R*5b"
  ],
  "best": "6i5h",
  "pv": [
   "6i5h",
   "N*6f",
   "5h4i",
   "G*4e",
   "R*8a",
   "4e4f"
  ],
  "threat": "G*6h",
  "threatMate": 1,
  "cpuB": 8.5
 },
 {
  "id": "st2-defend-62",
  "type": "defend",
  "sfen": "ln4knl/1r2g1g2/p1pspp2p/6pp1/9/2+bPP1B2/PP3P2P/1K1G3R1/LN4SNL b GSPs4p 1",
  "accepted": [
   "G*7g",
   "6h7g",
   "8h7i",
   "6h7h",
   "G*7h",
   "S*7h",
   "S*8c",
   "8g8f",
   "S*8f",
   "S*9f",
   "G*8f",
   "6h6i",
   "G*8c",
   "S*2b",
   "S*9h",
   "S*8e",
   "G*2b",
   "S*4b",
   "S*8d",
   "G*9h",
   "G*4a",
   "S*7g",
   "G*8d",
   "G*4b",
   "G*8e",
   "P*7h",
   "8h7h",
   "3f5d",
   "6h5g"
  ],
  "best": "G*7g",
  "pv": [
   "G*7g",
   "S*7e",
   "2h2d",
   "P*2c",
   "2d3d"
  ],
  "threat": "7f8g",
  "threatMate": 3,
  "cpuB": 7.5
 },
 {
  "id": "st2-judge-0",
  "type": "judge",
  "sfen": "lns2g1nl/1r2g1ks1/p5b1p/1ppppppP1/9/2P3P2/PP1PPP2P/1BGKGS1R1/LNS4NL w p 1",
  "accepted": [
   "1c1d"
  ],
  "choices": [
   "1c1d",
   "7d7e",
   "7a7b"
  ],
  "best": "1c1d",
  "pv": [
   "1c1d",
   "4g4f",
   "4a4b",
   "4h4g",
   "5b4c",
   "2i3g",
   "7a6b"
  ],
  "gap": 235,
  "line": [
   "1c1d",
   "4g4f",
   "4a4b"
  ],
  "cpuB": 55
 },
 {
  "id": "st2-judge-1",
  "type": "judge",
  "sfen": "lnsgk1snl/1r4g2/p1pppp1pp/3b2p2/1p7/2P4P1/PPKPPPP1P/5S1R1/LNSG1G1NL b B 1",
  "accepted": [
   "7i8h"
  ],
  "choices": [
   "B*6f",
   "7g8h",
   "7i8h"
  ],
  "best": "7i8h",
  "pv": [
   "7i8h",
   "8e8f",
   "8g8f",
   "8b8f",
   "P*8g",
   "8f8c",
   "7g7h"
  ],
  "gap": 320,
  "line": [
   "7i8h",
   "8e8f",
   "8g8f"
  ],
  "cpuB": 23
 },
 {
  "id": "st2-judge-2",
  "type": "judge",
  "sfen": "ln3g1nl/1r4k2/p3sgbsp/2ppppp2/Bp3P3/2P1S1P2/PP1PP1N1P/2GKG2R1/LNS5L w Pp 1",
  "accepted": [
   "P*2d"
  ],
  "choices": [
   "P*2d",
   "9a9b",
   "3c1e"
  ],
  "best": "P*2d",
  "pv": [
   "P*2d",
   "4e4d",
   "5c4d",
   "2h4h",
   "1c1d",
   "9g9f",
   "4a5b"
  ],
  "gap": 270,
  "line": [
   "P*2d",
   "4e4d",
   "5c4d"
  ],
  "cpuB": 55
 },
 {
  "id": "st2-judge-3",
  "type": "judge",
  "sfen": "ln1gk2nl/3s1sgb1/p2ppp1pp/2p3p2/9/1r2S4/PpPP1PPPP/2GSRKG2/LNB4NL b Pp 1",
  "accepted": [
   "4h3i"
  ],
  "choices": [
   "5f6e",
   "4h3i",
   "2g2f"
  ],
  "best": "4h3i",
  "pv": [
   "4h3i",
   "8f8e",
   "9g9f",
   "8a7c",
   "8i9g",
   "8e8a",
   "3i2h"
  ],
  "gap": 275,
  "line": [
   "4h3i",
   "8f8e",
   "9g9f"
  ],
  "cpuB": 25.75
 },
 {
  "id": "st2-judge-5",
  "type": "judge",
  "sfen": "ln1gk1snl/1r1s2g2/p1pppp1p1/1p4p1p/9/2P6/PPNPPPPPP/5S1R1/L1SGKG1NL b Bb 1",
  "accepted": [
   "7i8h"
  ],
  "choices": [
   "B*6f",
   "2h3h",
   "7i8h"
  ],
  "best": "7i8h",
  "pv": [
   "7i8h",
   "6c6d",
   "4i5h",
   "3a4b",
   "4g4f",
   "7c7d",
   "6i7h"
  ],
  "gap": 376,
  "line": [
   "7i8h",
   "6c6d",
   "4i5h"
  ],
  "cpuB": 24.5
 },
 {
  "id": "st2-judge-6",
  "type": "judge",
  "sfen": "ln5nl/1r2gkg2/p2sppspp/1ppp2p2/7P1/2P6/PPSPPPP1P/3KGS1R1/LN1G3NL b Bb 1",
  "accepted": [
   "9g9f"
  ],
  "choices": [
   "9g9f",
   "6g6f",
   "7g8h"
  ],
  "best": "9g9f",
  "pv": [
   "9g9f",
   "1c1d",
   "4g4f",
   "1d1e",
   "9f9e",
   "4b3a",
   "4h4g"
  ],
  "gap": 232,
  "line": [
   "9g9f",
   "1c1d",
   "4g4f"
  ],
  "cpuB": 55
 },
 {
  "id": "st2-judge-8",
  "type": "judge",
  "sfen": "ln1gkg1nl/3s2s2/p2pppbpp/1rp3p2/1p7/2P4P1/PP1PPPPRP/1BGSG4/LNK3SNL b - 1",
  "accepted": [
   "8h3c+"
  ],
  "choices": [
   "8h3c+",
   "6h7g",
   "5g5f"
  ],
  "best": "8h3c+",
  "pv": [
   "8h3c+",
   "3b3c",
   "6h7g",
   "6b7c",
   "2f2e",
   "5a4b",
   "3g3f"
  ],
  "gap": 255,
  "line": [
   "8h3c+",
   "3b3c",
   "6h7g"
  ],
  "cpuB": 19.5
 },
 {
  "id": "st2-judge-10",
  "type": "judge",
  "sfen": "ln1gk2nl/1r1s1sgb1/p2ppp1pp/2p3p2/1p7/4P4/PPPP1PPPP/1BS1R1S2/LN1GK1GNL b - 1",
  "accepted": [
   "3i4h"
  ],
  "choices": [
   "3i4h",
   "3i2h",
   "5i6h"
  ],
  "best": "3i4h",
  "pv": [
   "3i4h",
   "5a4a",
   "5i4i",
   "6a5b",
   "1g1f",
   "1c1d",
   "4i3i"
  ],
  "gap": 228,
  "line": [
   "3i4h",
   "5a4a",
   "5i4i"
  ],
  "cpuB": 27.25
 },
 {
  "id": "st2-judge-11",
  "type": "judge",
  "sfen": "lnsgk2nl/1r3sgb1/p1pppp1pp/6p2/9/2P3PP1/PPSPPP2P/1BG1GS1R1/LN2K2NL b p 1",
  "accepted": [
   "4h3g"
  ],
  "choices": [
   "2i3g",
   "4h3g",
   "2h2g"
  ],
  "best": "4h3g",
  "pv": [
   "4h3g",
   "7a6b",
   "5i6i",
   "7c7d",
   "2f2e",
   "4b3c",
   "3g4f"
  ],
  "gap": 200,
  "line": [
   "4h3g",
   "7a6b",
   "5i6i"
  ],
  "cpuB": 27.5
 },
 {
  "id": "st2-judge-12",
  "type": "judge",
  "sfen": "ln4knl/1r2gbg2/p1sp3sp/2p1pppp1/9/1PPPP1P2/PSN2PN1P/2GBGS1R1/L1K5L b 2p 1",
  "accepted": [
   "6h4f"
  ],
  "choices": [
   "5h5i",
   "6h4f",
   "7i6i"
  ],
  "best": "6h4f",
  "pv": [
   "6h4f",
   "6c6d",
   "1g1f",
   "1c1d",
   "9g9f",
   "5b4c",
   "9f9e"
  ],
  "gap": 267,
  "line": [
   "6h4f",
   "6c6d",
   "1g1f"
  ],
  "cpuB": -10
 },
 {
  "id": "st2-judge-14",
  "type": "judge",
  "sfen": "ln1gkg1nl/1r1s3s1/p3pp1pp/2pp2p2/1p7/2P2P3/PP1PP1PPP/2GS1SGR1/LN2K2NL b Bb 1",
  "accepted": [
   "6h7g"
  ],
  "choices": [
   "6h7g",
   "5i6i",
   "5g5f"
  ],
  "best": "6h7g",
  "pv": [
   "6h7g",
   "6b6c",
   "3g3f",
   "8a7c",
   "2i3g",
   "9c9d",
   "4h4g"
  ],
  "gap": 210,
  "line": [
   "6h7g",
   "6b6c",
   "3g3f"
  ],
  "cpuB": 22.25
 },
 {
  "id": "st2-judge-15",
  "type": "judge",
  "sfen": "ln4snl/1rs1gkgb1/pppppp1p1/6R2/8p/2PP2P2/PP2PPS1P/1BG6/LNS1KG1NL w 2P 1",
  "accepted": [
   "2b4d"
  ],
  "choices": [
   "4b4a",
   "7c7d",
   "2b4d"
  ],
  "best": "2b4d",
  "pv": [
   "2b4d",
   "3d3e",
   "4d3e",
   "3f3e",
   "4c4d",
   "6f6e",
   "3b4c"
  ],
  "gap": 207,
  "line": [
   "2b4d",
   "3d3e",
   "4d3e"
  ],
  "cpuB": 31.5
 },
 {
  "id": "st2-judge-17",
  "type": "judge",
  "sfen": "ln2k2nl/1r1sg1g2/p1p1ppspp/1p1p2p2/7P1/2P2P3/PPSPPSP1P/3KG2R1/LN1G3NL w Bb 1",
  "accepted": [
   "7c7d"
  ],
  "choices": [
   "1a1b",
   "7c7d",
   "9a9b"
  ],
  "best": "7c7d",
  "pv": [
   "7c7d",
   "3g3f",
   "6b6c",
   "1g1f",
   "1c1d",
   "9g9f",
   "9c9d"
  ],
  "gap": 230,
  "line": [
   "7c7d",
   "3g3f",
   "6b6c"
  ],
  "cpuB": -10
 },
 {
  "id": "st2-judge-18",
  "type": "judge",
  "sfen": "ln1g2snl/1rs2k3/p1ppppgpp/6p2/1p7/2P4P1/PPSPPPP1P/2GK1S1R1/LN3G1NL w Bb 1",
  "accepted": [
   "7c7d"
  ],
  "choices": [
   "6a7a",
   "5c5d",
   "7c7d"
  ],
  "best": "7c7d",
  "pv": [
   "7c7d",
   "4i5h",
   "7b7c",
   "3g3f",
   "7c6d",
   "2i3g",
   "4c4d"
  ],
  "gap": 237,
  "line": [
   "7c7d",
   "4i5h",
   "7b7c"
  ],
  "cpuB": 22.75
 },
 {
  "id": "st2-judge-19",
  "type": "judge",
  "sfen": "ln1g2snl/1r1s1kgb1/p2pppppp/2p6/1p2P4/9/PPPP1PPPP/1B1SRSG2/LN1GK2NL b - 1",
  "accepted": [
   "7g7f"
  ],
  "choices": [
   "3h3i",
   "8h7i",
   "7g7f"
  ],
  "best": "7g7f",
  "pv": [
   "7g7f",
   "6b7c",
   "5i4i",
   "7c6d",
   "6h7g",
   "3c3d",
   "7g6f"
  ],
  "gap": 251,
  "line": [
   "7g7f",
   "6b7c",
   "5i4i"
  ],
  "cpuB": -10
 },
 {
  "id": "st2-judge-20",
  "type": "judge",
  "sfen": "lnsgkgsnl/1r5b1/p1pppp1p1/6p1p/1p7/2P4P1/PP1PPPP1P/1BGS3R1/LN2KGSNL b - 1",
  "accepted": [
   "6h7g"
  ],
  "choices": [
   "3i3h",
   "7h7g",
   "6h7g"
  ],
  "best": "6h7g",
  "pv": [
   "6h7g",
   "3a3b",
   "2f2e",
   "3b3c",
   "3i4h",
   "7c7d",
   "8h7i"
  ],
  "gap": 235,
  "line": [
   "6h7g",
   "3a3b",
   "2f2e"
  ],
  "cpuB": 29.5
 },
 {
  "id": "st2-judge-21",
  "type": "judge",
  "sfen": "ln4snl/1r2gkgb1/p1ppspppp/1p2p4/9/2P6/PPBPPPPPP/3SRSG2/LN1G1K1NL b - 1",
  "accepted": [
   "5g5f"
  ],
  "choices": [
   "5g5f",
   "6i7i",
   "4h5i"
  ],
  "best": "5g5f",
  "pv": [
   "5g5f",
   "4c4d",
   "6h5g",
   "3c3d",
   "5g6f",
   "3b4c",
   "3g3f"
  ],
  "gap": 234,
  "line": [
   "5g5f",
   "4c4d",
   "6h5g"
  ],
  "cpuB": -10
 },
 {
  "id": "st2-judge-22",
  "type": "judge",
  "sfen": "ln3g1nl/2r2gkb1/p2pspspp/1pp1p1p2/7P1/2P5P/PP1PPPP2/1BGSGS1R1/LN1K3NL b - 1",
  "accepted": [
   "3g3f"
  ],
  "choices": [
   "6i7i",
   "7h7i",
   "3g3f"
  ],
  "best": "3g3f",
  "pv": [
   "3g3f",
   "7d7e",
   "7f7e",
   "7b7e",
   "2i3g",
   "5c6d",
   "4g4f"
  ],
  "gap": 206,
  "line": [
   "3g3f",
   "7d7e",
   "7f7e"
  ],
  "cpuB": 28.25
 },
 {
  "id": "st2-judge-23",
  "type": "judge",
  "sfen": "ln2k3l/1r1sg1s2/p1ppppngp/1p4pp1/9/2P4R1/PPSPPPP1P/1G1KGS3/LN5NL w Bbp 1",
  "accepted": [
   "4c4d"
  ],
  "choices": [
   "9a9b",
   "7c7d",
   "4c4d"
  ],
  "best": "4c4d",
  "pv": [
   "4c4d",
   "3g3f",
   "6c6d",
   "4h3g",
   "5b4c",
   "5g5f",
   "7c7d"
  ],
  "gap": 239,
  "line": [
   "4c4d",
   "3g3f",
   "6c6d"
  ],
  "cpuB": 55
 },
 {
  "id": "st2-judge-24",
  "type": "judge",
  "sfen": "ln3g1nl/1r1sgksb1/p1ppppppp/1p7/9/2P6/PPBPPPPRP/2G6/LNS1KGSNL w P 1",
  "accepted": [
   "5c5d"
  ],
  "choices": [
   "6b5a",
   "5c5d",
   "9a9b"
  ],
  "best": "5c5d",
  "pv": [
   "5c5d",
   "3g3f",
   "6b5c",
   "3i3h",
   "5c6d",
   "2i3g",
   "8d8e"
  ],
  "gap": 261,
  "line": [
   "5c5d",
   "3g3f",
   "6b5c"
  ],
  "cpuB": 8.5
 },
 {
  "id": "st2-judge-25",
  "type": "judge",
  "sfen": "ln3g1nl/3sg1ks1/p1p1pp1pp/6p2/1r1N5/1BPP1P1P1/PP1SP1P1P/2G2S1R1/L3KG1NL b Pbp 1",
  "accepted": [
   "4i5h"
  ],
  "choices": [
   "8f7g",
   "4i5h",
   "4f4e"
  ],
  "best": "4i5h",
  "pv": [
   "4i5h",
   "8e8d",
   "4h4g",
   "P*6d",
   "8f7e",
   "8d9d",
   "3g3f"
  ],
  "gap": 204,
  "line": [
   "4i5h",
   "8e8d",
   "4h4g"
  ],
  "cpuB": 28.5
 },
 {
  "id": "st2-judge-26",
  "type": "judge",
  "sfen": "ln2sk1nl/1r2gsg2/p1pppp1pp/1p4p2/3B5/2PP1PP2/PP2P1SPP/1SK4R1/LN1G1G1NL w b 1",
  "accepted": [
   "4a3a"
  ],
  "choices": [
   "4a3a",
   "5b6b",
   "3b2b"
  ],
  "best": "4a3a",
  "pv": [
   "4a3a",
   "6e5f",
   "4b3c",
   "4i5h",
   "5a4b",
   "3g2f",
   "6c6d"
  ],
  "gap": 250,
  "line": [
   "4a3a",
   "6e5f",
   "4b3c"
  ],
  "cpuB": 19.5
 },
 {
  "id": "st2-judge-27",
  "type": "judge",
  "sfen": "ln4snl/1r1sgkgb1/p1pppp1pp/1p4p2/7P1/2P6/PPBPPPP1P/1S3S1R1/LN1GKG1NL b - 1",
  "accepted": [
   "2e2d"
  ],
  "choices": [
   "2e2d",
   "6g6f",
   "4i3i"
  ],
  "best": "2e2d",
  "pv": [
   "2e2d",
   "2c2d",
   "2h2d",
   "P*2c",
   "2d2h",
   "6c6d",
   "4g4f"
  ],
  "gap": 202,
  "line": [
   "2e2d",
   "2c2d",
   "2h2d"
  ],
  "cpuB": 26
 },
 {
  "id": "st2-judge-28",
  "type": "judge",
  "sfen": "ln2k2nl/3sgs1b1/prpppppgp/1p5p1/9/2P3P2/PPBPPP2P/2GKGS1R1/LNS4NL b p 1",
  "accepted": [
   "4h3g"
  ],
  "choices": [
   "4h3g",
   "1g1f",
   "5g5f"
  ],
  "best": "4h3g",
  "pv": [
   "4h3g",
   "3c3d",
   "7g2b+",
   "2c2b",
   "2h2d",
   "P*2c",
   "B*5f"
  ],
  "gap": 215,
  "line": [
   "4h3g",
   "3c3d",
   "7g2b+"
  ],
  "cpuB": 22.75
 },
 {
  "id": "st2-judge-29",
  "type": "judge",
  "sfen": "ln2k3l/1r1sg1g2/p2ppsnpp/2p3p2/1p3p3/2P4P1/PP1PPSP1P/1SGG3R1/LN1K3NL b Bbp 1",
  "accepted": [
   "6i7i"
  ],
  "choices": [
   "5g5f",
   "1i1h",
   "6i7i"
  ],
  "best": "6i7i",
  "pv": [
   "6i7i",
   "5c5d",
   "8h7g",
   "6b5c",
   "9g9f",
   "5a4b",
   "2f2e"
  ],
  "gap": 296,
  "line": [
   "6i7i",
   "5c5d",
   "8h7g"
  ],
  "cpuB": 14.25
 },
 {
  "id": "st2-judge-30",
  "type": "judge",
  "sfen": "lng1k1snl/3sr4/ppp2pgpp/3p5/5B1P1/2P1PP3/PP1P2P1P/1SK2S1R1/LN1G1G1NL w 2Pb 1",
  "accepted": [
   "5a6a"
  ],
  "choices": [
   "5a4b",
   "5a6a",
   "5a4a"
  ],
  "best": "5a6a",
  "pv": [
   "5a6a",
   "4i5h",
   "7a7b",
   "8g8f",
   "6a7a",
   "8h8g",
   "9c9d"
  ],
  "gap": 246,
  "line": [
   "5a6a",
   "4i5h",
   "7a7b"
  ],
  "cpuB": 2.5
 },
 {
  "id": "st2-judge-31",
  "type": "judge",
  "sfen": "ln1gk1snl/3s2gb1/p2ppp1pp/2p3p2/9/1r2P4/PpPP1PPPP/2GSRGS2/LNB1K2NL b P 1",
  "accepted": [
   "5i4i"
  ],
  "choices": [
   "4h5g",
   "2g2f",
   "5i4i"
  ],
  "best": "5i4i",
  "pv": [
   "5i4i",
   "3a4b",
   "4i3i",
   "8a7c",
   "5f5e",
   "8f8e",
   "6g6f"
  ],
  "gap": 229,
  "line": [
   "5i4i",
   "3a4b",
   "4i3i"
  ],
  "cpuB": 18.5
 },
 {
  "id": "st2-judge-32",
  "type": "judge",
  "sfen": "ln1gkg1nl/1r1s1s3/p1pppp1pp/1p4p2/9/2P6/PPGPPPPPP/3KGS1R1/LNS4NL w Bb 1",
  "accepted": [
   "4a3b"
  ],
  "choices": [
   "4a3b",
   "9a9b",
   "B*3c"
  ],
  "best": "4a3b",
  "pv": [
   "4a3b",
   "3g3f",
   "6a5b",
   "4h3g",
   "4c4d",
   "2g2f",
   "4b3c"
  ],
  "gap": 296,
  "line": [
   "4a3b",
   "3g3f",
   "6a5b"
  ],
  "cpuB": 14.25
 },
 {
  "id": "st2-judge-33",
  "type": "judge",
  "sfen": "ln2k2nl/1r1sgs1g1/pppppp1pp/6p2/7P1/2P2P3/PP1PP1P1P/2GSGS1R1/LN2K2NL w Bb 1",
  "accepted": [
   "4b3c"
  ],
  "choices": [
   "4b3c",
   "2a3c",
   "5a6a"
  ],
  "best": "4b3c",
  "pv": [
   "4b3c",
   "3g3f",
   "8c8d",
   "2i3g",
   "2b3b",
   "6h7g",
   "6c6d"
  ],
  "gap": 247,
  "line": [
   "4b3c",
   "3g3f",
   "8c8d"
  ],
  "cpuB": 22.5
 },
 {
  "id": "st2-judge-34",
  "type": "judge",
  "sfen": "ln3g1nl/1r2gk1s1/p1spppbpp/2p3p2/1p7/2P3PP1/PPNPPP2P/1SGKGS1R1/L6NL b B 1",
  "accepted": [
   "2f2e"
  ],
  "choices": [
   "2f2e",
   "B*3g",
   "6h7i"
  ],
  "best": "2f2e",
  "pv": [
   "2f2e",
   "7c6d",
   "5g5f",
   "7d7e",
   "7f7e",
   "6d7e",
   "B*4f"
  ],
  "gap": 276,
  "line": [
   "2f2e",
   "7c6d",
   "5g5f"
  ],
  "cpuB": 33.75
 },
 {
  "id": "st2-judge-35",
  "type": "judge",
  "sfen": "ln1g2snl/1r3kg2/p1pp1pb1p/1s2p1pp1/2P6/1P1P4P/P1N1PPPPB/2GS4R/L3KGSNL w P 1",
  "accepted": [
   "1c1d"
  ],
  "choices": [
   "6a7b",
   "8b8c",
   "1c1d"
  ],
  "best": "1c1d",
  "pv": [
   "1c1d",
   "3g3f",
   "8d7e",
   "8f8e",
   "P*8f",
   "6h6g",
   "1d1e"
  ],
  "gap": 282,
  "line": [
   "1c1d",
   "3g3f",
   "8d7e"
  ],
  "cpuB": 16.25
 },
 {
  "id": "st2-judge-36",
  "type": "judge",
  "sfen": "lnsgr2nl/2k2g3/ppp3bpp/3p1ps2/6p2/2PBp4/PP1P1PSPP/2GSG1R2/LNK4NL w Pp 1",
  "accepted": [
   "7b8b"
  ],
  "choices": [
   "4b5b",
   "4b5c",
   "7b8b"
  ],
  "best": "7b8b",
  "pv": [
   "7b8b",
   "7i8h",
   "4d4e",
   "6f3c+",
   "2a3c",
   "6g6f",
   "B*4i"
  ],
  "gap": 290,
  "line": [
   "7b8b",
   "7i8h",
   "4d4e"
  ],
  "cpuB": 23.75
 },
 {
  "id": "st2-judge-37",
  "type": "judge",
  "sfen": "ln1gk2nl/1rs2sgb1/p1pppp1pp/6p2/7P1/2PP5/PPB1PPP1P/2S2S1R1/LN1GKG1NL b p 1",
  "accepted": [
   "4i5h"
  ],
  "choices": [
   "4i5h",
   "2h2g",
   "4i3h"
  ],
  "best": "4i5h",
  "pv": [
   "4i5h",
   "6c6d",
   "5g5f",
   "7b6c",
   "9g9f",
   "2b3c",
   "4h5g"
  ],
  "gap": 204,
  "line": [
   "4i5h",
   "6c6d",
   "5g5f"
  ],
  "cpuB": 25.5
 },
 {
  "id": "st2-judge-38",
  "type": "judge",
  "sfen": "ln5nl/1r1sgkg2/p2pppspp/1pp3p2/9/2P3PP1/PPSPPPS1P/2G4R1/LNK2G1NL b Bb 1",
  "accepted": [
   "2f2e"
  ],
  "choices": [
   "2f2e",
   "7g6f",
   "2h3h"
  ],
  "best": "2f2e",
  "pv": [
   "2f2e",
   "6b7c",
   "3g4f",
   "4c4d",
   "3f3e",
   "5b4c",
   "4i5h"
  ],
  "gap": 232,
  "line": [
   "2f2e",
   "6b7c",
   "3g4f"
  ],
  "cpuB": 23.5
 },
 {
  "id": "st2-judge-39",
  "type": "judge",
  "sfen": "ln5nl/2s1gkgb1/prppppspp/1p4p2/7P1/2P3P2/PPBPPPN1P/2SG1S1R1/LN1GK3L w - 1",
  "accepted": [
   "8d8e"
  ],
  "choices": [
   "8d8e",
   "3c4d",
   "9a9b"
  ],
  "best": "8d8e",
  "pv": [
   "8d8e",
   "4g4f",
   "6c6d",
   "1g1f",
   "1c1d",
   "3g4e",
   "3c4d"
  ],
  "gap": 312,
  "line": [
   "8d8e",
   "4g4f",
   "6c6d"
  ],
  "cpuB": 15.25
 },
 {
  "id": "st2-judge-40",
  "type": "judge",
  "sfen": "lnsg2s1l/3r1kg2/ppp1ppnpp/6p2/3P5/2+bpP4/PPN2PP1P/1SG1GS1R1/L3K2NL b B2P 1",
  "accepted": [
   "4h5g"
  ],
  "choices": [
   "5i6i",
   "4h5g",
   "5i6h"
  ],
  "best": "4h5g",
  "pv": [
   "4h5g",
   "3a2b",
   "5f5e",
   "4b3a",
   "8g8f",
   "9c9d",
   "8h8g"
  ],
  "gap": 225,
  "line": [
   "4h5g",
   "3a2b",
   "5f5e"
  ],
  "cpuB": 26.75
 },
 {
  "id": "st2-judge-41",
  "type": "judge",
  "sfen": "ln1gkgsnl/1r1s5/p1pppp1pp/1p4p2/9/2P4P1/PPNPPPP1P/1S3SR2/L2GKG1NL w Bb 1",
  "accepted": [
   "3a3b"
  ],
  "choices": [
   "B*4d",
   "2a3c",
   "3a3b"
  ],
  "best": "3a3b",
  "pv": [
   "3a3b",
   "6i7h",
   "6c6d",
   "4i5h",
   "3b3c",
   "3g3f",
   "7c7d"
  ],
  "gap": 360,
  "line": [
   "3a3b",
   "6i7h",
   "6c6d"
  ],
  "cpuB": 20.5
 },
 {
  "id": "st2-judge-42",
  "type": "judge",
  "sfen": "ln4knl/1r1sg1gb1/p1pp1pspp/4p1p2/1p7/2P2PP2/PPBPP3P/2GSGS1R1/LN1K3NL w P 1",
  "accepted": [
   "7c7d"
  ],
  "choices": [
   "7c7d",
   "8b8d",
   "3c4d"
  ],
  "best": "7c7d",
  "pv": [
   "7c7d",
   "6g6f",
   "6b7c",
   "6h6g",
   "7c8d",
   "5g5f",
   "7d7e"
  ],
  "gap": 289,
  "line": [
   "7c7d",
   "6g6f",
   "6b7c"
  ],
  "cpuB": 24.5
 },
 {
  "id": "st2-judge-44",
  "type": "judge",
  "sfen": "ln2g2nl/1r1s1kgs1/p1ppppbpp/1p4p2/7P1/9/PPPPPPP1P/2GSG2R1/LNB1K1SNL b - 1",
  "accepted": [
   "3i4h"
  ],
  "choices": [
   "3g3f",
   "7i8h",
   "3i4h"
  ],
  "best": "3i4h",
  "pv": [
   "3i4h",
   "8d8e",
   "5g5f",
   "4b3a",
   "3g3f",
   "5c5d",
   "4h3g"
  ],
  "gap": 226,
  "line": [
   "3i4h",
   "8d8e",
   "5g5f"
  ],
  "cpuB": 20.5
 },
 {
  "id": "st2-judge-45",
  "type": "judge",
  "sfen": "lnsgk2nl/1r3s1b1/p1pppp1gp/1p4pp1/9/2P6/PPSPPPP1P/1B5R1/LN1GKGSNL b p 1",
  "accepted": [
   "8h7i"
  ],
  "choices": [
   "8h7i",
   "7g6f",
   "4g4f"
  ],
  "best": "8h7i",
  "pv": [
   "8h7i",
   "2b3c",
   "5g5f",
   "7a7b",
   "3g3f",
   "7c7d",
   "7i4f"
  ],
  "gap": 200,
  "line": [
   "8h7i",
   "2b3c",
   "5g5f"
  ],
  "cpuB": 19
 },
 {
  "id": "st2-judge-46",
  "type": "judge",
  "sfen": "ln2k1snl/1r1s1gg2/pppppp1pp/1b4p2/9/9/PPPSPPPPP/1BG1GS1R1/LN2K2NL w p 1",
  "accepted": [
   "5a4a"
  ],
  "choices": [
   "1a1b",
   "4b3c",
   "5a4a"
  ],
  "best": "5a4a",
  "pv": [
   "5a4a",
   "3g3f",
   "3a2b",
   "4h3g",
   "4a3a",
   "3g4f",
   "6c6d"
  ],
  "gap": 304,
  "line": [
   "5a4a",
   "3g3f",
   "3a2b"
  ],
  "cpuB": 22
 },
 {
  "id": "st2-judge-47",
  "type": "judge",
  "sfen": "lnsgkgsnl/1r5b1/p1pppp1p1/6p2/8p/P1P6/1P1PPPPPP/1BGKGS1R1/LNS4NL b p 1",
  "accepted": [
   "3g3f"
  ],
  "choices": [
   "4h3i",
   "4h5i",
   "3g3f"
  ],
  "best": "3g3f",
  "pv": [
   "3g3f",
   "6c6d",
   "4h3g",
   "7a6b",
   "2g2f",
   "4a3b",
   "2f2e"
  ],
  "gap": 298,
  "line": [
   "3g3f",
   "6c6d",
   "4h3g"
  ],
  "cpuB": 20.5
 },
 {
  "id": "st2-judge-48",
  "type": "judge",
  "sfen": "ln3kgnl/1r1sgs1b1/p1pp1pppp/1p2p4/9/2P3P2/PP1PPP1PP/1BGS1S1R1/LN1GK2NL w - 1",
  "accepted": [
   "8d8e"
  ],
  "choices": [
   "4a5a",
   "8d8e",
   "5b5c"
  ],
  "best": "8d8e",
  "pv": [
   "8d8e",
   "2g2f",
   "8e8f",
   "8g8f",
   "8b8f",
   "4h3g",
   "8f8b"
  ],
  "gap": 248,
  "line": [
   "8d8e",
   "2g2f",
   "8e8f"
  ],
  "cpuB": 21.25
 },
 {
  "id": "st2-judge-49",
  "type": "judge",
  "sfen": "ln1g2knl/1r3sg2/p1p1ppbpp/1p1ps1p2/7P1/2PPP4/PP1SSPP1P/1BG1G2R1/LN2K2NL b - 1",
  "accepted": [
   "3g3f"
  ],
  "choices": [
   "3g3f",
   "5i4h",
   "7f7e"
  ],
  "best": "3g3f",
  "pv": [
   "3g3f",
   "8b6b",
   "5i6i",
   "7c7d",
   "6i7i",
   "8a7c",
   "2i3g"
  ],
  "gap": 240,
  "line": [
   "3g3f",
   "8b6b",
   "5i6i"
  ],
  "cpuB": 25.25
 },
 {
  "id": "st2-judge-50",
  "type": "judge",
  "sfen": "ln3g1nl/1r1sgksb1/p1ppppppp/1p7/9/2P6/PPBPPPP1P/2GS3R1/LN2KGSNL b P 1",
  "accepted": [
   "3i3h"
  ],
  "choices": [
   "3i3h",
   "4g4f",
   "5g5f"
  ],
  "best": "3i3h",
  "pv": [
   "3i3h",
   "4a3a",
   "3h2g",
   "3c3d",
   "2g3f",
   "8d8e",
   "6g6f"
  ],
  "gap": 223,
  "line": [
   "3i3h",
   "4a3a",
   "3h2g"
  ],
  "cpuB": 26.5
 },
 {
  "id": "st2-judge-51",
  "type": "judge",
  "sfen": "ln1gk1snl/6gb1/p2ppp1pp/3s2p2/2p6/1r1SP4/PpPP1PPPP/2G1RG3/LNB1KS1NL b P 1",
  "accepted": [
   "7i5g"
  ],
  "choices": [
   "7i5g",
   "4h5g",
   "3g3f"
  ],
  "best": "7i5g",
  "pv": [
   "7i5g",
   "5a4a",
   "6f7e",
   "8f5f",
   "P*8b",
   "8a7c",
   "7e6d"
  ],
  "gap": 418,
  "line": [
   "7i5g",
   "5a4a",
   "6f7e"
  ],
  "cpuB": 25.75
 },
 {
  "id": "st2-judge-53",
  "type": "judge",
  "sfen": "l2gk2nl/3s1sgb1/p1nppp1pp/1r4p2/1pp6/4P4/PPPP1PPPP/1BS1RKS2/LNG2G1NL b - 1",
  "accepted": [
   "4h3i"
  ],
  "choices": [
   "4i5i",
   "2g2f",
   "4h3i"
  ],
  "best": "4h3i",
  "pv": [
   "4h3i",
   "4c4d",
   "1g1f",
   "1c1d",
   "6g6f",
   "8e8f",
   "8g8f"
  ],
  "gap": 220,
  "line": [
   "4h3i",
   "4c4d",
   "1g1f"
  ],
  "cpuB": 13.25
 },
 {
  "id": "st2-judge-54",
  "type": "judge",
  "sfen": "ln1g1gsnl/1rs2k3/pppppp1pp/6p2/9/2P3P2/PP1PPPNPP/1G1S2SR1/LN2KG2L w Bb 1",
  "accepted": [
   "3a2b"
  ],
  "choices": [
   "4b3b",
   "3a2b",
   "B*3c"
  ],
  "best": "3a2b",
  "pv": [
   "3a2b",
   "2g2f",
   "4a3b",
   "4g4f",
   "2b3c",
   "3h4g",
   "8c8d"
  ],
  "gap": 214,
  "line": [
   "3a2b",
   "2g2f",
   "4a3b"
  ],
  "cpuB": 24.25
 },
 {
  "id": "st2-judge-56",
  "type": "judge",
  "sfen": "ln3g1nl/5gkb1/pr1pspspp/2p1p1p2/1p5PP/2P4R1/PP1PPPP2/1BGSG4/LN1KS2NL b - 1",
  "accepted": [
   "9g9f"
  ],
  "choices": [
   "8h6f",
   "8h7g",
   "9g9f"
  ],
  "best": "9g9f",
  "pv": [
   "9g9f",
   "8e8f",
   "8g8f",
   "8c8f",
   "P*8g",
   "8f8b",
   "3g3f"
  ],
  "gap": 213,
  "line": [
   "9g9f",
   "8e8f",
   "8g8f"
  ],
  "cpuB": 55
 },
 {
  "id": "st2-judge-57",
  "type": "judge",
  "sfen": "lnsgk2nl/6gs1/p1ppppbpp/4r1p2/7P1/P8/2BP1PP1P/2GSGS1R1/LN2K2NL b P3p 1",
  "accepted": [
   "5i6i"
  ],
  "choices": [
   "9i9h",
   "2e2d",
   "5i6i"
  ],
  "best": "5i6i",
  "pv": [
   "5i6i",
   "5d8d",
   "P*8g",
   "3c7g+",
   "8i7g",
   "2b3c",
   "6g6f"
  ],
  "gap": 289,
  "line": [
   "5i6i",
   "5d8d",
   "P*8g"
  ],
  "cpuB": 55
 },
 {
  "id": "st2-judge-58",
  "type": "judge",
  "sfen": "ln3gsnl/1r2g1k2/ppspppbpp/2p3p2/4P4/2P6/PP1P1PPPP/1BS1RK3/LN1G1GSNL b - 1",
  "accepted": [
   "7h7g"
  ],
  "choices": [
   "7h7g",
   "3g3f",
   "3i2h"
  ],
  "best": "7h7g",
  "pv": [
   "7h7g",
   "1c1d",
   "7g6f",
   "1d1e",
   "4h3h",
   "8c8d",
   "3h2h"
  ],
  "gap": 227,
  "line": [
   "7h7g",
   "1c1d",
   "7g6f"
  ],
  "cpuB": 27.5
 },
 {
  "id": "st2-judge-59",
  "type": "judge",
  "sfen": "ln1sk2nl/1r3ggb1/p1ppp1spp/1p3pp2/7P1/2P3P2/PPBPPPS1P/1SG1G2R1/LN1K3NL w - 1",
  "accepted": [
   "2b3a"
  ],
  "choices": [
   "6a7b",
   "8b6b",
   "2b3a"
  ],
  "best": "2b3a",
  "pv": [
   "2b3a",
   "3g4f",
   "6a5b",
   "5g5f",
   "4b4c",
   "5f5e",
   "8d8e"
  ],
  "gap": 216,
  "line": [
   "2b3a",
   "3g4f",
   "6a5b"
  ],
  "cpuB": 55
 },
 {
  "id": "st2-judge-60",
  "type": "judge",
  "sfen": "ln2k1gnl/2g1r2b1/ppppspspp/4p1p2/3P5/2P1PP3/PPGS2PPP/1B3S1R1/LN2KG1NL w - 1",
  "accepted": [
   "3c4b"
  ],
  "choices": [
   "3c4b",
   "4c4d",
   "3a4a"
  ],
  "best": "3c4b",
  "pv": [
   "3c4b",
   "2g2f",
   "7c7d",
   "2f2e",
   "3a3b",
   "4i5h",
   "8a7c"
  ],
  "gap": 217,
  "line": [
   "3c4b",
   "2g2f",
   "7c7d"
  ],
  "cpuB": 32.5
 },
 {
  "id": "st2-judge-61",
  "type": "judge",
  "sfen": "ln2k2nl/1r3sgb1/p2gspppp/2ppp4/6PP1/1SP1PS3/PP1P1P2P/1BG4R1/LNK2G1NL w P 1",
  "accepted": [
   "4c4d"
  ],
  "choices": [
   "8b8c",
   "4c4d",
   "5c4d"
  ],
  "best": "4c4d",
  "pv": [
   "4c4d",
   "6g6f",
   "8a7c",
   "4i5h",
   "4b4c",
   "9g9f",
   "1c1d"
  ],
  "gap": 201,
  "line": [
   "4c4d",
   "6g6f",
   "8a7c"
  ],
  "cpuB": 23.5
 },
 {
  "id": "st2-judge-62",
  "type": "judge",
  "sfen": "lnsg3nl/3krsgb1/pppppp1pp/6p2/9/P1P6/1P1PPPPRP/1B3S3/LNSGKG1NL w P 1",
  "accepted": [
   "2b8h+"
  ],
  "choices": [
   "2b8h+",
   "9a9b",
   "3b3c"
  ],
  "best": "2b8h+",
  "pv": [
   "2b8h+",
   "7i8h",
   "B*4e",
   "2g2f",
   "4e6g+",
   "6i7i",
   "5b5a"
  ],
  "gap": 793,
  "line": [
   "2b8h+",
   "7i8h",
   "B*4e"
  ],
  "cpuB": 23.75
 },
 {
  "id": "st2-judge-63",
  "type": "judge",
  "sfen": "ln4gnl/1r1sg1kb1/p1pps1ppp/1p2pp3/4P4/2P2PPP1/PPBP4P/2GS1S1R1/LN1GK2NL w - 1",
  "accepted": [
   "8d8e"
  ],
  "choices": [
   "8d8e",
   "3a4a",
   "9a9b"
  ],
  "best": "8d8e",
  "pv": [
   "8d8e",
   "5e5d",
   "5c5d",
   "2i3g",
   "3c3d",
   "2f2e",
   "6b5c"
  ],
  "gap": 227,
  "line": [
   "8d8e",
   "5e5d",
   "5c5d"
  ],
  "cpuB": -10
 },
 {
  "id": "st2-judge-64",
  "type": "judge",
  "sfen": "ln2k1snl/1r1sg1g2/p1pppp1pp/5bp2/1p5P1/4P4/PPPPSPP1P/1B2RK3/LN1G1GSNL b - 1",
  "accepted": [
   "6i7h"
  ],
  "choices": [
   "5g6f",
   "9i9h",
   "6i7h"
  ],
  "best": "6i7h",
  "pv": [
   "6i7h",
   "8e8f",
   "8g8f",
   "8b8f",
   "P*8g",
   "8f8e",
   "3i3h"
  ],
  "gap": 302,
  "line": [
   "6i7h",
   "8e8f",
   "8g8f"
  ],
  "cpuB": 22.25
 },
 {
  "id": "st2-judge-65",
  "type": "judge",
  "sfen": "ln2k3l/2gsrs2g/ppppppnpp/6p2/4B4/2P4P1/PP1PPPP1P/3G1S1R1/LNS1KG1NL w b 1",
  "accepted": [
   "5c5d"
  ],
  "choices": [
   "B*8e",
   "B*9d",
   "5c5d"
  ],
  "best": "5c5d",
  "pv": [
   "5c5d",
   "5e7g",
   "6b5c",
   "2f2e",
   "4c4d",
   "2e2d",
   "2c2d"
  ],
  "gap": 231,
  "line": [
   "5c5d",
   "5e7g",
   "6b5c"
  ],
  "cpuB": 19.5
 },
 {
  "id": "st2-judge-66",
  "type": "judge",
  "sfen": "ln4gnl/1r1s1g1b1/p1pp1k1pp/1p1s1pp2/4p4/1PP2PPP1/P1BP1S2P/2G1K2R1/LN1GS2NL b p 1",
  "accepted": [
   "6g6f"
  ],
  "choices": [
   "2h3h",
   "9i9h",
   "6g6f"
  ],
  "best": "6g6f",
  "pv": [
   "6g6f",
   "7c7d",
   "5i6h",
   "4c3b",
   "6h6g",
   "6b5c",
   "1g1f"
  ],
  "gap": 202,
  "line": [
   "6g6f",
   "7c7d",
   "5i6h"
  ],
  "cpuB": 20.5
 },
 {
  "id": "st2-judge-67",
  "type": "judge",
  "sfen": "lns2gsnl/1r2g1kb1/p1p1pp1pp/1p1p2p2/9/2P4P1/PP1PPPP1P/1BGKGS1R1/LNS4NL b - 1",
  "accepted": [
   "2f2e"
  ],
  "choices": [
   "2f2e",
   "8h2b+",
   "8h7g"
  ],
  "best": "2f2e",
  "pv": [
   "2f2e",
   "4a4b",
   "2e2d",
   "2c2d",
   "2h2d",
   "2b8h+",
   "7i8h"
  ],
  "gap": 243,
  "line": [
   "2f2e",
   "4a4b",
   "2e2d"
  ],
  "cpuB": 25.75
 },
 {
  "id": "st2-judge-68",
  "type": "judge",
  "sfen": "ln3g1nl/1r1sgk3/p2pppspp/2p3p2/1p7/2P2P1P1/PP1PP1P1P/1SGKGS1R1/LN5NL b Bb 1",
  "accepted": [
   "4h4g"
  ],
  "choices": [
   "5h4g",
   "5g5f",
   "4h4g"
  ],
  "best": "4h4g",
  "pv": [
   "4h4g",
   "8e8f",
   "8g8f",
   "8b8f",
   "8h8g",
   "8f8b",
   "P*8f"
  ],
  "gap": 216,
  "line": [
   "4h4g",
   "8e8f",
   "8g8f"
  ],
  "cpuB": 27
 },
 {
  "id": "st2-judge-71",
  "type": "judge",
  "sfen": "ln1g3nl/3s1kg2/p2pppsp1/1r4p2/2P5p/P2P1bPP1/1PNGP1N1P/1S1KGS1R1/L7L b BP2p 1",
  "accepted": [
   "2f2e"
  ],
  "choices": [
   "2f2e",
   "9f9e",
   "6g5f"
  ],
  "best": "2f2e",
  "pv": [
   "2f2e"
  ],
  "gap": 263,
  "line": [
   "2f2e"
  ],
  "cpuB": 26.25
 },
 {
  "id": "st2-judge-72",
  "type": "judge",
  "sfen": "ln1g2gnl/2s2ksb1/prp1pp1pp/1p1p2p2/9/2P6/PPBPPPP1P/2GS2SR1/LN2KG1NL b P 1",
  "accepted": [
   "3g3f"
  ],
  "choices": [
   "3g3f",
   "7g2b+",
   "5g5f"
  ],
  "best": "3g3f",
  "pv": [
   "3g3f",
   "6a5b",
   "3h3g",
   "7c7d",
   "1g1f",
   "8d8e",
   "3g4f"
  ],
  "gap": 217,
  "line": [
   "3g3f",
   "6a5b",
   "3h3g"
  ],
  "cpuB": 24.5
 },
 {
  "id": "st2-judge-74",
  "type": "judge",
  "sfen": "lng1k2nl/4rsgb1/p1s1ppppp/1pp6/4B1P2/2P4P1/PP1PPPS1P/2GS3R1/LN1K1G1NL w P 1",
  "accepted": [
   "7a6b"
  ],
  "choices": [
   "7a6b",
   "4b3a",
   "9a9b"
  ],
  "best": "7a6b",
  "pv": [
   "7a6b",
   "2f2e",
   "5c5d",
   "5e8h",
   "8d8e",
   "2e2d",
   "2c2d"
  ],
  "gap": 340,
  "line": [
   "7a6b",
   "2f2e",
   "5c5d"
  ],
  "cpuB": 18.75
 },
 {
  "id": "st2-judge-75",
  "type": "judge",
  "sfen": "ln1gkg1nl/1rs3s2/p1ppppbpp/9/1p4pP1/9/PPPPPPPRP/1BSGGS3/LN2K2NL w - 1",
  "accepted": [
   "7b8c"
  ],
  "choices": [
   "5c5d",
   "8b8c",
   "7b8c"
  ],
  "best": "7b8c",
  "pv": [
   "7b8c",
   "9g9f",
   "8c8d",
   "8h9g",
   "6a5b",
   "2g2f",
   "9c9d"
  ],
  "gap": 516,
  "line": [
   "7b8c",
   "9g9f",
   "8c8d"
  ],
  "cpuB": 27.25
 },
 {
  "id": "st2-judge-77",
  "type": "judge",
  "sfen": "ln2k2nl/1r1sgs1g1/pppppp1pp/5bp2/9/2P6/PPBPPPP1P/2S4R1/LN1GKGSNL w P 1",
  "accepted": [
   "7c7d"
  ],
  "choices": [
   "6b7a",
   "4b3a",
   "7c7d"
  ],
  "best": "7c7d",
  "pv": [
   "7c7d",
   "3i4h",
   "4d7g+",
   "7h7g",
   "6c6d",
   "4g4f",
   "4c4d"
  ],
  "gap": 246,
  "line": [
   "7c7d",
   "3i4h",
   "4d7g+"
  ],
  "cpuB": 24.5
 },
 {
  "id": "st2-judge-78",
  "type": "judge",
  "sfen": "ln3kbnl/1r2gsg2/pspppppPp/9/1p7/2P1P1PR1/PPBP1P2P/2GS1S3/LN2KG1NL w p 1",
  "accepted": [
   "4c4d"
  ],
  "choices": [
   "4c4d",
   "5c5d",
   "P*2d"
  ],
  "best": "4c4d",
  "pv": [
   "4c4d",
   "3f3e",
   "4b4c",
   "4g4f",
   "5c5d",
   "1g1f",
   "8c7d"
  ],
  "gap": 287,
  "line": [
   "4c4d",
   "3f3e",
   "4b4c"
  ],
  "cpuB": 23
 },
 {
  "id": "st2-judge-79",
  "type": "judge",
  "sfen": "ln1g1k2l/1r1s1s3/p1ppp1ngp/1p3ppp1/5b3/2P1P4/PP1P1PP1P/1G1SRSG2/LN2K2NL w Bp 1",
  "accepted": [
   "4e5d"
  ],
  "choices": [
   "6a7a",
   "2c2b",
   "4e5d"
  ],
  "best": "4e5d",
  "pv": [
   "4e5d",
   "6h7g",
   "7c7d",
   "8h7h",
   "6b7c",
   "4g4f",
   "7c6d"
  ],
  "gap": 255,
  "line": [
   "4e5d",
   "6h7g",
   "7c7d"
  ],
  "cpuB": -10
 }
]);

/** 問題集の詰将棋(初手)を、CPUの各Lvに解かせて半分が解けたLv(前の版の値を引き継ぐ)。 */
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
