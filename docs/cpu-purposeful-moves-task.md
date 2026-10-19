# 実装指示：CPUが意味の無い手を指さないようにし、全レベルをロジックで指す

この文書は、`docs/cpu-purposeful-moves-design.md`（設計。以下「設計」）を実装する人への指示です。設計の決定はすべて済んでいます。
指示にない判断が必要になったら、設計の考え方（9-1「ねらい」）に沿って決め、何をどう決めたかを設計の文書とコミットの本文に書いてください。

---

## 0. 始める前に

### 0-1. 必ず読むもの（この順に）

1. `AGENTS.md`（リポジトリの決まり。この文書と食い違ったら`AGENTS.md`に従う）
2. `docs/cpu-purposeful-moves-design.md`（設計。とくに2章・3章・7〜9章）
3. `docs/logic-ai-design.md`（いまのLv1〜10のロジックAI）
4. `docs/difficulty-calibration.md`（強さの割り付けと計測の記録）
5. `docs/nintendo-design/Game_Nintendo_Implementation.md`の1章・8章・12章（CPUの決まりとチェックリスト）

### 0-2. 守ること

- **CPUの強さの上限はLv40「藤井聡太並み」。** Lv40の手の選び方（エンジンの最善手）は変えない。Lv41以上を足さない。
- **エンジンは同時に1つの探索しかできない。** 追加の読みは、CPUの手番の中で直列に行う。CPUが指す前に助言用の探索を積まない。
- **JavaScript側の重い処理には時間の上限を付ける。** 詰み探索（`findMateLine`）は、いまのロジックAIと同じくノード数と時間の上限を付ける。
- **対局画面から重いモジュールを静的にimportしない**（`AGENTS.md`の「生成物と公開」）。今回足すモジュールは盤の計算だけの軽い処理なので、対局画面から読んでよい。教室・問題集・図鑑だけが使うモジュールはimportしない。
- **型チェックのエラーは0件のまま。** `.mjs`の関数は、JSDocの`@param`で引数の型を書く（`fn({ a = 1, b } = {})`の形で既定値のない引数が型から落ちる問題に注意）。
- **判定と演出を混ぜない。** 今回は手の選び方だけを変える。助言・ほめ言葉・神の一手の判定（`god-move.mjs`）、棋譜解析は変えない。
- **pushとデプロイは、ユーザーが明示的に頼んだときだけ。** 作業ブランチへのコミットは段階ごとに行う。
- コミットメッセージは`AGENTS.md`の形式（日本語、`<種別>: <内容>。`、本文は箇条書き）。

### 0-3. 各段階の終わりに必ず実行するもの

```sh
npm test
npm run typecheck
npm run build
git diff --check
```

---

## 1. いまのコードの要点

| 場所 | 中身 |
|---|---|
| `src/core/move-naturalness.mjs`の`createNaturalnessEvaluator` | 手の自然さ（重み0.02〜8）とタグ。取る手は`free-capture`×3.0・`winning-capture`×2.5・`even-trade`×1.5・`losing-capture`×0.4。王手を受ける手、逃げる手（`escape`×2.0）、前進（`advance`×1.2）、成り（`promote`×2.0）、囲い（`castle-build`×1.3）など。`simplicity`が0より大きいときだけ、分かりやすい手の加点と「目的の無い手」（`aimless`、×(1−0.6×simplicity)）の減点をする。**端歩以外の前進には`develop`を付け、目的のある手（`PURPOSEFUL_TAGS`）に数えている**（これが香上がりの原因）。駒を打つ手だけ、取られそうな駒が減るかを見ている（`countHanging`） |
| `src/core/logic-ai.mjs`の`chooseLogicMove` | Lv1〜10。気づき（`PERCEPTION_TABLE`）をくじで決め、候補ごとに`scoreMove`で点数（取る得・指したあとに取られる損`reply`・狙い`threat`・成り・王手・玉への圧力・自然さの対数×80・定跡の加点）を付け、温度つきのソフトマックスで選ぶ。`reply`は`captureSearch`（取る手だけの読み）で求める |
| `src/core/cpu-move-choice.mjs`の`chooseCpuMove` | Lv0とLv11〜40。詰み → 読まない手 → 見落とし（`tryOversight`）→ 危険への態度（`chooseRiskAwareMove`）→ 棋風（`chooseStyledMove`）→ 視野の狭さ（`chooseWithinVision`。自然さの上位`visionWidth`手と探索上位`engineVision`手だけを読み直す）→ 探索候補からの抽選（`selectMoveByRank`）の順。`ATTACK_TAGS`・`DEFENSE_TAGS`で手の攻め・受けを分ける |
| `src/core/strength-settings.mjs` | 技量（0〜1）からレベルの設定を作る（`strengthParametersForSkill`）。`CPU_STRENGTH_PRESETS`がLv0〜40。`getStrengthSearchSettings`が対局で使う設定 |
| `src/ShogiMatchGame.vue`の`scheduleCpuMove`（「Lv1〜10はロジックAIで指す」のコメントのあたり）と`scheduleReviewCpuMove` | 手の選び方の分かれ道。`usesLogicAi(level)`ならロジックAI、そうでなければ`chooseCpuMove`。`verify`（`cpuOversightVerifier`、`searchmoves`つきの追加探索）と`probe`（`cpuRiskProbe`）を渡している。序盤の作戦の手（`allowedOpeningMove`）と序盤傾向で絞った合法手（`allowedCpuMoveList`）もここで決まる |
| `src/core/piece-movement.mjs` | 盤の計算（`parseSfenState`・`applyUsiToBoard`・`attackedSquares`・`attackersOf`・`isHanging`・`countHanging`・`relativeRank`・`relativeFile`など） |
| `src/core/player-character.mjs` | 竜王戦の棋士の棋風（`style`）・特徴（`traits`）・詰みを見つける確率（`mateFinding`） |
| `scripts/lib/node-engine.mjs` | Node上でエンジンを動かす（`createNodeEngine`・`search`）。自己対局（`scripts/cpu-level-selfplay.mjs`）と人間らしさの計測（`scripts/cpu-humanlike-report.mjs`）が使う |

---

## 2. 局面集（テストと計測で使う）

設計の調査で使った局面です。テスト用に`src/core/cpu-position-set.mjs`（新規。テストとスクリプトから読む）へ定数として置いてください。
手順（`moves`）は平手から指す手で、`moveHistory`として渡します（直前の手の判定に使う）。手順がない局面は、`lastMove`を書いておきます。
**先後の両方**で確かめるため、各局面を盤ごと反転した局面も作れる関数を用意してください（駒の色・筋・段・持ち駒を入れ替える。`opening-guide.mjs`の`mirrorUsiMove`を手の反転に使える）。

| ID | 局面（後手番） | 期待すること |
|---|---|---|
| `bougin-push` | 手順`2g2f 8c8d 2f2e 8d8e 3i3h 4a3b 3h2g 7a7b 2g2f 9c9d 2f1e 5a4b 2e2d`（SFEN `ln1g2snl/1rs2kgb1/2ppppppp/p6P1/1p6S/9/PPPPPPP1P/1B5R1/LNSGKG1NL w - 1`） | 同歩（`2c2d`）が多い。目的の無い手0% |
| `bougin-silver` | 上に`2c2d 1e2d`を足す（SFEN `ln1g2snl/1rs2kgb1/2ppppp1p/p6S1/1p7/9/PPPPPPP1P/1B5R1/LNSGKG1NL w Pp 1`） | 2筋の受け（2三歩打・2二の地点への利きを足す手など）か、意味のある反撃。目的の無い手0% |
| `center-trade` | 手順`7g7f 3c3d 2g2f 4c4d 2f2e 2b3c 5g5f 8b4b 5f5e 5a6b 5e5d`（SFEN `lnsg1gsnl/3k1r3/ppppp1bpp/4Ppp2/7P1/2P6/PP1P1PP1P/1B5R1/LNSGKGSNL w - 1`） | 同歩（`5c5d`）が多い。目的の無い手0% |
| `rook-attacked` | SFEN `lnsgkgsnl/1r5b1/p2pppppp/2p6/4B4/2P4R1/PP1PPPP1P/2S6/LN1GKGSNL w Pp 1`、直前の手`8h5e`（角が5五に出て飛車取り） | 関係ない歩打ち（8筋の`P*8c`〜`P*8f`・`P*8h`など、目的の無い打つ手）0%。飛車を逃がすか、意味のある手（`3c3d`・`6c6d`など）の割合がレベルとともに上がる |
| `anaguma` | 居飛車穴熊（`opening-guide.mjs`の`ibisha-anaguma`）の組み途中で、玉が9八にいて9九香がまだの局面（自分で作る。先手番） | `9i9h`（香上がり）が目的のある手（`develop`）になる |
| `hopeless` | 受けが無く、どの手でも金以上を取られる局面（自分で作る。例: 相手の竜と金が自陣に入り、玉の横の金が両取りになっている） | Lv1は「取りに行く」が多く、Lv10・Lv20は相手玉への王手・攻めが多い |

いまの値（設計の1章・8章。ロジックAI、各レベル200〜300回、乱数の種を固定）:

| 局面 | Lv2 | Lv5 | Lv8 | Lv10 |
|---|---|---|---|---|
| `bougin-push` の目的の無い手 | 44% | 19% | 6% | 2% |
| `bougin-silver` の目的の無い手 | 57% | 48% | 37% | 28% |
| `center-trade` の目的の無い手 | 62% | 33% | 20% | 12% |

| `rook-attacked` | Lv1 | Lv3 | Lv5 | Lv8 | Lv10 |
|---|---|---|---|---|---|
| 飛車を逃がす | 41% | 48% | 41% | 29% | 24% |
| 関係ない歩打ち | 8% | 5% | 5% | 3% | 2% |

「目的の無い手」は、段階1で作る判定（`purposeful`が偽）で数えます。

---

## 3. 段階1：手の自然さと目的（全レベル）

対象: `src/core/move-naturalness.mjs`、`src/core/cpu-move-choice.mjs`の`DEFENSE_TAGS`、テスト`src/core/move-naturalness.test.mjs`（なければ作る）。

### 3-1. 目的の判定を、分かりやすさ（simplicity）と切り離す

- いまは`simplicity > 0`のときだけ`develop`・`aimless`を付けている。目的の判定は、`simplicity`に関係なくいつも行い、評価の戻り値に`purposeful: boolean`を足す。
- `aimless`の減点（×(1−0.6×simplicity)）は、いまどおり`simplicity`に応じて掛ける（`simplicity`が0なら減点しない）。ただし`purposeful`はいつも返す。
- 王手は目的のある手。いまの`PURPOSEFUL_TAGS`に加え、下で足す`guard`・`desperado`も目的のある手に数える。

### 3-2. 前進の加点を、目的のある前進だけにする

いまの「玉以外が前に進めば×1.2（`advance`）、端歩以外の前進は`develop`」を、駒の種類で分ける。

| 駒 | `advance`（×1.2）と`develop`を付ける条件 | 条件に合わないとき |
|---|---|---|
| 香 | 次のどれか: (a) 動いたあとの香の利きの先（同じ筋の前方）に相手の駒がある、(b) 穴熊を組む形（自玉がその香と同じ端の隅から2マス以内にいて、自玉の相対段が8以上）、(c) その手が評価のオプションで渡された作戦の手（下の3-6） | `advance`も`develop`も付けない（目的の無い手になりうる） |
| 桂 | 次のどれか: (a) 跳ねた先から相手の駒（玉以外、価値3以上）に当たる、(b) 跳ねた先が相手の駒に当たらなくても、相対段が5以下（攻めの筋）、(c) 作戦の手 | 付けない |
| 金 | 前進では付けない（金の目的は`castle-build`・`guard`・`threaten`・作戦の手で判定する） | ― |
| 銀・角・飛・歩 | いまどおり（歩は端歩に`develop`を付けない、もいまどおり） | ― |

- `relativeRank`・`relativeFile`は自分から見た段・筋（1が相手側・右端）。端は相対筋1か9。
- 香の「利きの先に相手の駒」は、`attackedSquares(after, to)`の中に相手の駒がある、で判定できる。

### 3-3. 受け（`guard`）を足す

駒を動かす手・打つ手のどちらでも、次のどれかに当たるとき×1.5を掛け、タグ`guard`を付ける（重複しても1回だけ掛ける）。

1. 取られそうな自分の駒が減る: `countHanging(after, me) < countHanging(board, me)`。いまは打つ手だけで見ているのを、動かす手にも広げる。動かした駒自身が逃げた場合は`escape`が付くので、`guard`は付けない（二重に加点しない）。
2. 突破を止める: 自陣の「突破されそうなマス」が減る。「突破されそうなマス」は、自分から見た相対段7〜9のマスのうち、相手の駒（玉以外）が次の1手で動いて入れて、相手の利きの数が自分の利きの数より多いマス。動かした後にこの数が減れば受けとする。関数`breakthroughSquares(board, me)`（新規、`move-naturalness.mjs`の中か`piece-movement.mjs`）で求める。
3. 王手・詰めろに関係する受けは、いまの`king-escape`・`drop-block`・`move-block`・`capture-checker`がある。そのままにする。

`cpu-move-choice.mjs`の`DEFENSE_TAGS`に`guard`を足す。

### 3-4. 取られる前に取る（`desperado`）

- 動かす駒がもう取られそう（`isHanging(board, from)`）なときの取る手は、取り返されても`losing-capture`にしない。×1.5を掛け、タグ`desperado`を付ける（`even-trade`と同じ重み）。
- 大駒をただで渡す取り（`piece-sacrifice`の判定。いまの「取り返しの見込みなく相手に渡す」）は、これまでどおり重みを0.05〜0.1に抑える。ただし、取られそうな駒で取る場合は「取られる前に取る」ので、`lostValue`の計算で、元々取られそうだった駒の価値を差し引いて判定する（取らなくても失う駒なので）。

### 3-5. 弱いほど取る手を好む

- `losing-capture`の重みを、`0.4 + 0.6 × simplicity`にする（`simplicity`が1なら×1.0、0なら×0.4）。
- `piece-sacrifice`の上限（0.05〜0.1）は、これまでどおり後から掛ける（大きな損の取りは選ばない）。

### 3-6. 作戦の手を渡せるようにする

- `createNaturalnessEvaluator(sfen, options)`のオプションに`planMoves?: string[]`（いまの作戦の次の手。USI）を足す。ここに含まれる手は目的のある手（タグ`plan`）にする。重みは変えない（作戦の加点はロジックAI・新しい選び方の側で行う）。

### 3-7. テスト（`move-naturalness.test.mjs`）

- 局面集`rook-attacked`で、`P*8d`などの関係ない歩打ちは`purposeful`が偽。`8b8d`などの飛車を逃がす手は`escape`が付く。
- 平手の初期局面で、`9i9h`・`1i1h`（香上がり）は`purposeful`が偽。`anaguma`の局面の`9i9h`は`develop`が付く。
- `bougin-silver`の局面で、2筋の受けになる手（例: `P*2c`）に`guard`が付く。`9a9b`・`1a1b`・`6a6b`は`purposeful`が偽。
- 取られそうな銀で相手の歩を取る手（取り返されても）に`desperado`が付き、`losing-capture`が付かない（局面は自分で作る）。
- `simplicity`が1と0で、`losing-capture`の重みが1.0と0.4になる。
- 既存のテスト（神の一手・好手の判定など、自然さを使うテスト）が通ること。通らない場合は、守りたい性質が保たれているかを確かめてから直す。

### 3-8. 受け入れ条件

- 上のテストが通る。`npm test`・`typecheck`・`build`・`git diff --check`が通る。
- 局面集でロジックAI（いまの`chooseLogicMove`のまま）の「目的の無い手」の割合が、2章の表より下がっている（数を記録する。0%でなくてよい。0%は段階2で達成する）。
- コミット例: `fix: 手の自然さで、香・桂・金の目的の無い前進を駒組みに数えず、受けと取られる前に取る手を足す。`

---

## 4. 段階2：局面の気づきの表と、ロジックAI（Lv1〜10）

対象: 新規`src/core/position-awareness.mjs`（とテスト）、`src/core/logic-ai.mjs`（とテスト）、`docs/logic-ai-design.md`。

### 4-1. `position-awareness.mjs`

手番の側から見た局面の気づきを一覧にする。エンジンは使わない（盤の計算だけ。数ミリ秒）。

```js
/**
 * @param {string} sfen
 * @param {{ moveHistory?: string[] }} [options]
 * @returns {{
 *   me: "black" | "white",
 *   threats: Array<{
 *     kind: "capture" | "breakthrough" | "check" | "mate-threat",
 *     square: string,          // 取られそうな駒のマス／突破されそうなマス／自玉のマス
 *     value: number,           // 失う駒の価値(歩=100の単位。logic-ai.mjsのLOGIC_PIECE_VALUESと同じ)
 *     salience: "last-move-major" | "last-move-minor" | "other",
 *     attackers: string[],     // 当てている相手の駒のマス
 *   }>,
 *   chances: Array<{ kind: "free-capture" | "winning-capture" | "fork" | "promote" | "check" | "mate", moves: string[], value: number }>,
 * }}
 */
export function analyzePosition(sfen, options) { ... }
```

- `salience`: 相手の直前の手（`moveHistory`の最後）で、新しく当たりになった駒（直前の手の前には当たっていなかった）なら`last-move-*`。飛・角・竜・馬は`major`、金・銀・桂・香（成り駒を含む）は`minor`。歩と、前から当たっていた駒は`other`。
- `capture`の脅威は、取られた後の取り返しを考えた損（`logic-ai.mjs`の`captureSearch`と同じ考え方）で、損が0より大きいものだけ。
- `breakthrough`は、段階1の`breakthroughSquares`のマス。`value`は、そこへ入って成る駒の成って増える価値。
- `mate-threat`は、相手に手番を渡したとき1手詰めがあるか（`findMateLine(…, 1, { nodeLimit: 3000, maxTimeMs: 60 })`。時間の上限を必ず付ける）。
- `chances`は、ロジックAIがいま見ている機会（取る・両取り・成る・王手・詰み）を一覧にしたもの。`fork`は、指したあとに価値3以上の相手の駒2つ以上に当たる手。

### 4-2. 気づきの確率（`logic-ai.mjs`の`PERCEPTION_TABLE`）

`hanging`を、脅威の目立ち方で3つに分ける（設計8-3）。表の点（Lv1・3・5・8・10）の間は、いまと同じく直線で補う。

| キー | Lv1 | Lv3 | Lv5 | Lv8 | Lv10 |
|---|---|---|---|---|---|
| `hangingLastMoveMajor`（直前の手で当たった大駒） | 0.70 | 0.80 | 0.90 | 0.95 | 0.98 |
| `hangingLastMoveMinor`（直前の手で当たった金・銀・桂・香） | 0.40 | 0.55 | 0.70 | 0.85 | 0.92 |
| `hanging`（それ以外。いまの値） | 0.10 | 0.30 | 0.50 | 0.75 | 0.85 |

- 局面ごとのくじ: 局面にある脅威のうち、いちばん目立つもの（`major` > `minor` > `other`）の確率で、「取られることに気づく」（いまの`noticed.hanging`）を決める。脅威がなければ、いまの`hanging`の確率で決める（自分の手で取られる駒を作ることに気づくか、の意味が残るため）。
- 突破（`breakthrough`）の損も、`noticed.hanging`のときに数える（4-3）。
- テストで、`rook-attacked`ではLv1でも約70%の局面で「気づく」ことを確かめる（乱数の種を固定して数える）。

### 4-3. 成り込みも損に数える

- `captureSearch`の手の一覧に、相手の「成る手」（取らずに敵陣へ入って成る手、敵陣の中で成る手）を加える。得点は、成って増える駒の価値（例: 歩→と金は`LOGIC_PIECE_VALUES["+P"] - LOGIC_PIECE_VALUES.P`）。打つ手は加えない。
- 静止探索の深さと枝刈りはいまどおり。成る手は取る手の後に並べる。
- テスト: `bougin-silver`の局面で、2筋の受けをしない手（例: `9a9b`）の`reply`が、受ける手（例: `P*2c`）より小さい（損が大きい）。

### 4-4. 目的の無い手を選ばない

- 候補の点数を付けたあと、段階1の`purposeful`が偽の手を除く。作戦の手（`planMove`）、王手、取る手は除かない。
- 除いた結果、候補が1つもなくなったら、除く前の候補から選ぶ（ほぼ起きない）。
- 見落としの記録（`missed`）は、いまどおり。

### 4-5. 受からないときの方針

- 「受からない」の判定: 気づいた項目の範囲で、どの候補でも`reply`（指したあとの損）が−600以下（金1枚以上を失う）。気づいていないときは判定しない（受からないことにも気づかない）。
- くじで「取りに行く」か「ほかを攻める」を決める。取りに行く確率（設計3-2）:

  | Lv | 1 | 5 | 10 |
  |---|---|---|---|
  | 取りに行く | 0.90 | 0.70 | 0.50 |

  （Lv11以上は段階3の設定で、Lv20で0.30、Lv30で0.10、Lv35以上で0。間は直線で補う。）
- 「取りに行く」: 取る手（`captureGain > 0`）に＋250。
- 「ほかを攻める」: その局面だけ、`check`・`pressure`・`threat`の部分を2倍にする。
- 選んだ方針を、戻り値に`policy: "take" | "attack" | null`として残す。

### 4-6. テスト（新規`src/core/logic-ai-purpose.test.mjs`）

乱数の種を固定し、局面集の各局面・先後の両方で、Lv1・3・5・8・10に各200回選ばせる。

- 目的の無い手の割合: どの局面・どのレベルでも0%。
- `rook-attacked`: 関係ない歩打ち0%。飛車を逃がすか`3c3d`・`6c6d`などの意味のある手の割合が、Lv1 < Lv5 < Lv10。
- `bougin-push`・`center-trade`: 同歩の割合がLv1よりLv10で高い。
- `hopeless`: Lv1の`policy`は`take`が約90%、Lv10は約50%（±10%）。
- 1手にかかる時間: 局面集の各局面で、`maxTimeMs`（600ミリ秒）を超えない。
- 既存の`logic-ai.test.mjs`が通る。

### 4-7. 受け入れ条件と記録

- 上のテストが通る。4つの検証コマンドが通る。
- `docs/logic-ai-design.md`に、変えたこと（気づきの3分け・成り込み・目的の無い手を外す・受からないときの方針）を追記する。
- ロジックAI同士の自己対局（いまの記録と同じく各10局でよい: Lv10対Lv1、Lv10対Lv5、Lv5対Lv1）を行い、結果を`docs/difficulty-calibration.md`の「2026-10-13 Lv1〜10をロジックAIにした」の後に節を足して記録する。極端に強くなった（例: Lv5がLv10に勝ち越す、Lv1がLv5に勝てる）場合は、気づきの確率と温度を調整する。
- コミット例: `feat: ロジックAIが目立つ脅威に気づき、成り込みを受け、目的の無い手を指さないようにする。`

---

## 5. 段階3：Lv11〜39をロジックと評価値で指す（切り替えの設定つき）

対象: 新規`src/core/aware-move-choice.mjs`（とテスト）、`src/core/strength-settings.mjs`、`src/ShogiMatchGame.vue`の`scheduleCpuMove`と`scheduleReviewCpuMove`、`scripts/cpu-humanlike-report.mjs`・`scripts/cpu-level-selfplay.mjs`。

### 5-1. 設定（`strength-settings.mjs`）

`getStrengthSearchSettings`の戻り値に、Lv11〜39だけ次を足す。値はレベル（`CPU_STRENGTH_PRESETS`の`level`）から、表の点の間を直線で補って決める。

| 設定 | Lv11 | Lv20 | Lv30 | Lv35 | Lv39 |
|---|---|---|---|---|---|
| `logicHybrid` | 段階3では`false`（開発用に`true`にできる）。段階4で`true` | ← | ← | ← | ← |
| `engineBestVisibility`（エンジンの最善手が候補に入る確率） | 0.25 | 0.45 | 0.70 | 0.90 | 0.98 |
| `engineTopVisibility`（探索2〜3位の手が候補に入る確率。最善手の確率の半分） | 0.125 | 0.225 | 0.35 | 0.45 | 0.49 |
| `logicBonusCap`（ロジックの加点の上限。評価値の単位） | 200 | 120 | 60 | 40 | 20 |
| `takePolicyRate`（受からないとき取りに行く確率） | 0.48 | 0.30 | 0.10 | 0 | 0 |
| 気づきの確率（`hangingLastMoveMajor`など4-2の3つと、`freeCapture`・`exchange`・`threat`・`mate1`・`defendMate`） | Lv10の値から始めて | Lv20で全部1.0 | 1.0 | 1.0 | 1.0 |

- Lv40は足さない（`logicHybrid`なし。いまどおりエンジンの最善手）。Lv0もいまどおり（自然さだけ）。
- 竜王戦の棋士の特徴（`player-character.mjs`の効果）は、いまどおり設定に掛かる。棋風（`style.attack`）は5-4の加点で使う。

### 5-2. `chooseAwareMove`の形

```js
/**
 * Lv11〜39の手の選び方。気づきの表から候補を作り、評価値で読み、ロジックの加点とばらつきで選ぶ。
 * @param {{
 *   strength: ReturnType<typeof import('./strength-settings.mjs').getStrengthSearchSettings>,
 *   sfen: string,
 *   legalMoves: string[],            // 序盤傾向で絞った合法手(allowedCpuMoveList)
 *   moveHistory?: string[],
 *   planMove?: string | null,        // 作戦の次の手(allowedOpeningMove)
 *   search: { move: string, candidates?: { rank: number, move: string, score?: any, pv?: string[] }[] },
 *   verify?: (searchMoves: string[], nodes: number) => Promise<any>,
 *   probe?: (moves: string[], options: { nodes: number, multiPv: number }) => Promise<any>,
 *   random?: () => number,
 *   blunderAllowed?: boolean,
 * }} options
 * @returns {Promise<{ move: string, rank: number, kind: string, naturalness: number, loss?: number,
 *   reason: string, missed: string[], policy: "take" | "attack" | null } | null>}
 */
export async function chooseAwareMove(options) { ... }
```

戻り値は、いまの`chooseCpuMove`と同じ項目（`move`・`rank`・`kind`・`naturalness`・`loss`）を持つ。対局画面は`kind`を竜王戦の記録に、`loss`を大きな悪手の回数（`isBlunderChoice`）に使っているため。`reason`・`missed`・`policy`を足す。

### 5-3. 手順（設計9-3〜9-6）

1. **詰み**: いまの`chooseMatingMove`をそのまま使う（竜王戦の`mateFinding`）。
2. **気づきのくじ**: `analyzePosition`と、5-1の気づきの確率でくじを引く（4-2と同じやり方）。
3. **候補を作る**（設計9-4の表）:
   - 気づいた脅威ごとに: その駒を逃がす手、守る手（段階1の`guard`が付く手）、当てている駒を取る手、間に駒を置く手、より大きな狙いで返す手（相手の大駒に当てる・王手）。
   - 突破: `guard`が付く手、突破してくる駒を取る手。
   - 王手されている: 合法手を全部（王手を外す手だけになる）。詰めろ: 指したあと相手の1手詰めがない手（時間の上限つき）。
   - 気づいた機会の手（取る・両取り・成る・王手）。
   - 作戦の手（`planMove`）。
   - 静かな局面の手: 自然さで`purposeful`が真の手のうち、自然さの上位4手（`castle-build`・`develop`・`open-line`など）。
   - 受からない局面: 4-5と同じくじ（確率は`takePolicyRate`）で方針を決め、「取りに行く」なら取る手を、「ほかを攻める」なら王手・相手玉の周りに利きを足す手・`threat`の手を候補に足す。
   - エンジンの手: `search.move`を`engineBestVisibility`の確率で、探索2〜3位の手を`engineTopVisibility`の確率で足す。ただし、ロジックで作った候補にすでにある手は確率に関係なく残る。
   - **目的の無い手は入れない**（段階1の`purposeful`が偽の手は、エンジンの手であっても除く。王手・取る手・作戦の手は除かない）。
   - 候補は最大12手。多いときは、気づきの目立ち方・機会の価値・自然さの順で残す。候補が0なら、合法手から`purposeful`の手を自然さで選ぶ。それもなければ合法手から自然さで選ぶ。
4. **読む**: `search.candidates`（局面全体のMultiPV）に無い候補だけを、`verify(候補, strength.nodes)`で1回読む（`searchmoves`つき）。評価値は`move-selection.mjs`の`comparableScore`で比べる（詰みの評価も扱える）。**エンジンを使うのは、いまの通常の探索と合わせて1手あたり2回まで**（見落としを使うときは5-3の6を参照）。
5. **点数**: 点数＝評価値（候補を指したあとの、自分から見た値）＋ロジックの加点。加点は次の和を`logicBonusCap`で切る。
   - 作戦の手: ＋`logicBonusCap`（序盤の30手まで。いまの`openingGuideScoreLossLimit`と`openingPlanScoreScale`の考え方を残し、評価値の差が大きすぎる作戦の手は選ばないようにする）。
   - 棋風: `style.attack`が正なら攻めの手（`moveLeaning`が1）に＋`logicBonusCap × style.attack`、負なら受けの手に同じだけ。
   - 分かりやすさ: 取る手・交換・取り返しに＋`logicBonusCap × simplicity × 0.5`（`simplicity`はいまの設定値）。
   - 受からないときの方針: 「取りに行く」なら取る手に＋`logicBonusCap`、「ほかを攻める」なら攻めの手に＋`logicBonusCap`。
6. **選ぶ**:
   - いまの設定の`moveLossCap`（大きな悪手を使い切ったら`BLUNDER_LOSS - 1`）より評価値が下がる候補は除く。最善の候補（評価値の最大）は必ず残す。
   - 見落とし（`oversightRate`がある設定）は、いまの`tryOversight`の考え方を、候補の中だけで行う（浅く読むと良く見えて、深く読むと悪い手）。追加の読みが2回増えるので、見落としのくじが当たった手番だけ行う。
   - 危険への態度（`riskAttitude`がある設定）は、いまの`chooseRiskAwareMove`を、候補の中だけで使う（`probe`を使う）。
   - それ以外は、点数の温度つきソフトマックス（温度は`strength.scoreTemperature`）で選ぶ。
7. **理由**: 選んだ手が応じた気づき（`escape`・`guard`・`breakthrough`・`capture`・`fork`・`check`・`plan`・`develop`・`engine`など）を`reason`に、気づかなかった脅威・機会を`missed`に入れる。

### 5-4. 対局画面とのつなぎ（`ShogiMatchGame.vue`）

- `scheduleCpuMove`と`scheduleReviewCpuMove`で、`!logicLevel && selectionStrength.logicHybrid`のとき、`chooseCpuMove`の代わりに`chooseAwareMove`を呼ぶ。`verify`・`probe`は、いまの`chooseCpuMove`に渡しているものをそのまま渡す。
- 序盤傾向で作戦の手を強制する場合（`forceConfiguredOpening`）と、作戦の手を別に読む処理（「作戦の定跡手が候補に入っていない局面でも専用探索で評価してから」のところ）は、いまどおり残す。`chooseSafeOpeningMove`は、`logicHybrid`のときは使わず、作戦の手を候補に入れて5-3の加点で扱う。
- エンジンが使えない・`chooseAwareMove`がnullを返した・時間切れのときは、`chooseLogicMove`をLv10として呼んで手を決める（いまは自然さだけで選んでいる）。
- `match-ui-regression.test.mjs`が`ShogiMatchGame.vue`のソースを正規表現で調べている。失敗したら、守りたい性質（例: エンジンの探索を直列に使う、Lv1〜10はロジックAI）が保たれているかを確かめてから、パターンを直す。

### 5-5. テスト（新規`src/core/aware-move-choice.test.mjs`）

エンジンは使わず、`search`と`verify`は決まった評価値を返す偽物を作って確かめる。

- 目的の無い手は、エンジンの最善手であっても候補に入らない（王手・取る手・作戦の手は入る）。
- `engineBestVisibility`が0.25なら、乱数の種を変えて1000回呼んだとき、エンジンの最善手が候補に入る割合が約25%（±5%）。ロジックでも作れる手（タダで取れる駒を取る手など）は、確率に関係なく入る。
- `rook-attacked`の局面で、関係ない歩打ちを選ばない。
- `logicBonusCap`を超える加点をしない。`moveLossCap`より損な手を選ばない（最善の候補は残る）。
- 受からない局面で、`takePolicyRate`の割合で`policy`が`take`になる。
- `verify`を呼ぶのは1回まで（見落としを使わない設定で）。
- 戻り値に`move`・`rank`・`kind`・`loss`・`reason`・`missed`・`policy`がある。

### 5-6. 計測（スクリプト）

- `scripts/cpu-humanlike-report.mjs`と`scripts/cpu-level-selfplay.mjs`に、`--hybrid`（`logicHybrid`を真にする）を足す。
- 局面集の計測スクリプト（新規`scripts/cpu-position-set-report.mjs`）: Node上のエンジン（`createNodeEngine`・`search`）で、局面集の各局面・先後の両方を、Lv11・20・30・39に各100回選ばせ、手の分布・目的の無い手の割合・関係ない歩打ちの割合・`policy`を出力する。新旧（`--hybrid`の有無）を並べる。
- 計測の結果（新旧の表）は、段階4で`docs/difficulty-calibration.md`に記録する。段階3では、コミットの本文に要点を書く。

### 5-7. 受け入れ条件

- 5-5のテストが通る。4つの検証コマンドが通る。
- `--hybrid`の局面集の計測で、Lv11〜39の目的の無い手と関係ない歩打ちが0%。
- `logicHybrid`が偽（既定）のとき、いまの対局の振る舞いが変わらない（既存のテストが通る）。
- 1手にかかる時間が、いまより長くならない（Node上の計測で、各レベルの平均と最大を新旧で比べ、コミットの本文に書く）。
- コミット例: `feat: Lv11〜39を、気づきの表から候補を作り評価値で読んで選ぶ指し方を足す(設定で切り替え)。`

---

## 6. 段階4：強さを合わせて切り替える

1. **人間らしさ**（`cpu-humanlike-report.mjs --hybrid`と、なし）: 1手当たりの平均損失・300以上の損の割合・自然さの低い手の割合を、Lv11・15・20・25・30・35・39で新旧比べる。
2. **強さ**（`cpu-level-selfplay.mjs`）: 新旧の同じレベル同士、新の隣のレベル同士（1つ上と2つ上）で指させる。各レベルの強さ（1レベルでR約80。`docs/difficulty-calibration.md`の「校正方法」）を、いまと同じに保つように、`engineBestVisibility`・`logicBonusCap`・温度（`scoreTemperature`）・読みの量を調整する。
   - Lv10（ロジックAI）とLv11（新しい選び方）の間に、強さと指し方の段差がないことも確かめる（Lv11がLv10に勝ち越し、勝ちすぎない）。
3. 合わせ終えたら、`logicHybrid`の既定を真にする。古い選び方のうち使わなくなった処理（`chooseWithinVision`・`visibleMoves`など、`chooseCpuMove`の中でLv11〜39だけが使う部分）を消す。Lv0（自然さだけ）とLv40（最善手）、竜王戦・教室の対局が使う部分は残す。消した後もテストが通ること。
4. **文書**:
   - `docs/difficulty-calibration.md`: 新しい節（日付）に、計測の新旧の表、調整した値、技量の表の変更を書く。「現在の設定」の表を直す。
   - `docs/cpu-purposeful-moves-design.md`: 実装の節（設計の16-11と同じように「実装」の節）を足し、実際の値と、設計から変えたことを書く。
   - `docs/logic-ai-design.md`: Lv11以上も同じ考え方で指すことを書く。
   - `AGENTS.md`の「最初に確認する場所」の「CPU難易度」の行に、`src/core/position-awareness.mjs`（局面の気づきの表）と`src/core/aware-move-choice.mjs`（Lv11〜39の手の選び方）を足す。
   - `README.md`に、CPUの強さや指し方の説明があれば、合わせて直す（公開の設定やURLパラメーターは変えないこと）。
5. コミット例: `tune: Lv11〜39の新しい指し方の強さを合わせ、既定に切り替える。`

---

## 7. やってはいけないこと

- 目的の無い手を、確率で「ときどき」残すこと（全く指さないと決まっている）。
- 弱さを出すために、意味の無い手や、大駒をただで渡す手を選ぶこと。弱さは、気づかない・好手が見えない・浅く読む・迷う、の4つで出す。
- Lv40の手の選び方を変えること。Lv41以上を足すこと。
- エンジンの探索を並べて（同時に）走らせること。CPUが指す前に助言用の探索を積むこと。
- 助言・ほめ言葉・神の一手・棋譜解析の判定を変えること。
- 利用者が新旧の指し方を選べる設定を、対局準備などの画面に出すこと（計測は開発用の設定とスクリプトで行う）。
- 手で数値を決めて、計測せずに既定を切り替えること。
- ユーザーに頼まれていないpush（main）とデプロイ。

---

## 8. 完了の報告

各段階の終わりに、次を報告してください。

1. 変えたファイルと、変えたことの要点。
2. 局面集の数（2章の表と同じ形。前と後）。
3. 4つの検証コマンドの結果。
4. 段階2以降は自己対局の結果、段階3以降は1手の時間の新旧。
5. 設計から変えたことと、その理由（設計の文書にも書く）。
6. 手で確かめてほしいこと（実際にCPUと対局して、意味の無い手が出ないか、受けるべき局面で受けるか）。
