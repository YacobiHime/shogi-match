# ゲームの文章を推敲する道具の検討

## 1. yomiyasuと、ほかの道具の比べ（2026-11-28、調べただけ）

ユーザーの依頼：「yomiyasuのような、自然な日本語に推敲するプログラムを利用して推敲したい。まずは、yomiyasuよりもこのゲームの文章の推敲において優秀なものが無いか探そう。」

### 1-1. このゲームの文章の種類と、推敲で守ること

| 種類 | 例 | 守ること |
| --- | --- | --- |
| 画面の言葉 | ボタン・札・知らせ（`ShogiDisciple.vue`・`*-speech.mjs`の`TEXT`） | 短さ・UI論の言い方（`docs/nintendo-design/UI_Nintendo_Design.md`）。文字数で画面に収まる |
| 人物の台詞 | やこび姫・羽音・善彦・百花・弟子 | 人物ごとの口調（羽音は敬語と「！」なし。`docs/hanane-character.md`）。揃えすぎると個性が消える |
| ノベルの台本 | `src/story/scenes/*.md` | 演出の書式（`docs/novel-authoring-guide.md`）を崩さない。地の文と台詞が混ざる |
| 中継のコメント | `relay-commentary.mjs` | わざと崩した言葉（視聴者の書き込み）。直してはいけない |
| 設計文書・README | `docs/*.md` | 意味を変えない。決めた数字・コードの名前を変えない |

一般の校正道具の多くは技術文書かビジネス文書が相手で、人物の台詞と口調の書き分けを扱えない。ここが比べのいちばんの物差しになる。

### 1-2. 候補

| 道具 | 中身 | 相手の文章 | 人物の台詞 | 意味を変えない仕組み | 合わせ方 | ライセンス |
| --- | --- | --- | --- | --- | --- | --- |
| [yomiyasu](https://github.com/nanaism/yomiyasu)（基準） | AIの手順書（Agent Skill）＋Pythonの検査（lint・前後の差分） | AIが書いた技術文書など。文書の種類13（`script`・`essay`もある） | 扱わない。敬体・常体の割合を文書全体で数えるので、口調の違う台詞が「揺れ」に見えるおそれ | 前後の差分で数字・否定・助詞の変化を知らせる（意味そのものは人が見る） | 単語の表（使わない語→使う語・正規表現）、文書の種類、読み手の段 | MIT |
| [stop-ai-slop-jp](https://github.com/iKora128/stop-ai-slop-jp) | AIの手順書だけ | 一般の文章 | 扱わない。「不要な「」」やダッシュをAIらしさとして指摘するので、台詞に当たる | 「意味は変えず」と書くだけで、確かめる仕組みはない | 参考の文の表を直すだけ | MIT |
| [ja-writing-tools（proofread-ja・refine-ja）](https://github.com/finelagusaz/proofread-ja) | AIの手順書2つ（校正と推敲） | 小説・技術文書・ブログ・ビジネス | 小説の型はあるが、台詞と口調の扱いは書いていない。推敲は表現を強める（意味が動く） | なし | 文書の型だけ | MIT |
| kousei（[thkt/dotclaude](https://mcpmarket.com/tools/skills/kousei-japanese-text-proofreader)） | textlint＋AIの構造の見直し | 仕事・技術の文章、GitHubの課題とPR | 扱わない | 手元のファイルは直接書き換える | textlintの設定 | 未記載 |
| [textlint-rule-preset-ai-writing](https://github.com/textlint-ja/textlint-rule-preset-ai-writing) | textlintの規則（決まった検査） | AIらしい書き方（技術文書の例） | 扱わない（太字・誇張の検査が台詞に当たることがある） | 知らせるだけで直さない | 規則ごとの許す語・切る | MIT |
| [textlint-rule-general-novel-style-ja](https://github.com/io-monad/textlint-rule-general-novel-style-ja) | textlintの規則 | 日本の小説の作法（字下げ・閉じ括弧の前の句点・三点リーダーの数など） | 書式だけ（口調は見ない）。「ありがとう。」のような閉じ括弧の前の句点も指摘する | 知らせる（直せる規則もある） | 規則ごと | 記載はリポジトリ |
| [文賢](https://aipicks.jp/mag/bunken-compare-2026)・[Shodo](https://aismiley.co.jp/ai_news/proofreading-ai/)など | 有料のWebの校正 | 仕事の文章 | 扱わない | 画面で確かめる | 辞書 | 有料 |
| [小説AI校正（アルファポリス）](https://www.itmedia.co.jp/news/article/2109/30/1210930149/) | 小説投稿サイトの機能 | 小説の誤字・慣用句 | 誤字と慣用句だけ | なし | なし | 投稿サイトの中だけ |

ほかに、ゲーム会社の社内の道具（バンダイナムコ研究所の「AIセリフ監督」は、台詞の「そのキャラらしさ」を数値にする。Cygamesの執筆支援は方言と矛盾の確かめ）があり、台詞の口調を見る考えはこれがいちばん近い。ただし社内の道具で、使えない（[ITmedia](https://www.itmedia.co.jp/news/article/2109/30/1210930149/)・[GameBusiness.jp](https://www.gamebusiness.jp/article/2026/09/02/27866.html)）。

### 1-3. 結論

- **yomiyasuより全体で優れた道具は見つからなかった。** 意味を変えない仕組み（前後の差分）、単語の表、文書の種類、ローカルで動く検査を持つのはyomiyasuだけ。ほかのAIの手順書は確かめる仕組みがなく、textlintの規則は知らせるだけで推敲はしない。
- **ただし、どの道具も人物の台詞と口調を扱わない。** yomiyasuも、口調の違う台詞を「揺れ」として見るおそれがある。このゲームで推敲がいちばん要るのは台詞なので、ここは自分で足す必要がある。
- 使い分けの案（次の段で試して決める）：
  1. **設計文書・README・画面の説明文**：yomiyasu（文書の種類は`pr`・`manual`・`article`など）と、決まった検査としてtextlint（`preset-ai-writing`と単語の表）。
  2. **人物の台詞・ノベルの台本**：yomiyasuは使わないか、`script`の型と「台詞の中は直さない」約束で地の文だけ。台詞は、人物の口調の約束（羽音は敬語と「！」なし、など）を表にした**このリポジトリ専用の検査**で見る。人物の文書（`docs/hanane-character.md`など）から作る。
  3. **中継のコメント**：推敲しない（わざと崩してある）。
- 有料のWebの校正（文賢・Shodo）は、コードの中の文字列にかけにくく、文章を外へ送るので使わない。

### 1-4. 次の段（ユーザーが決める）

- yomiyasuとtextlintを、それぞれの種類の見本（画面の言葉・やこび姫の台詞・ノベルの台本1本・設計文書1章）にかけ、何を直すか・何を壊すかを並べて見る。入れるのは、その結果を見てから。
- 台詞の口調の検査（人物ごとの禁止語・語尾・「！」の数）を、`src/core/`の小さな検査として作る案。
