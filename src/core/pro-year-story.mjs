// 棋士の1年の物語の場面(docs/pro-year-design.mdの12章)。デビューの日・羽音との公式戦・タイトル戦の前夜。
// 台本の形は団体戦と同じ(team-story.mjs。NovelScene.vueで見せる)。物語のストーリー選択のサブからも読み直せる。
// 羽音は敬語と「！」を使わない(docs/hanane-character.md)。百花は明るく「！」を使う。ノベルのミステリーの部分は使わない。
// 遊びを止めない(D:8-2)ので、どの場面も12行まで。

import { NOVEL_PEOPLE, sceneText } from './team-story.mjs';
import { HANANE, YOSHIHIKO } from './ryuo-story.mjs';
import { originSceneVars } from './pro-year-origin.mjs';

/** 台本の1行。fxは演出(docs/novel-scene-design.mdの12章、書き方はdocs/novel-authoring-guide.md)。 */
const line = (who, face, text, fx = {}) => Object.freeze({ who, face, text, ...fx });
/** 立ち絵のない、声だけの人の台詞(善彦。novel-direction.mjsのEXTRA_WHO。docs/novel-authoring-guide.mdの4-1)。 */
const voice = (name, text, fx = {}) => Object.freeze({ who: 'extra', face: 'neutral', name, text, ...fx });
const YOSHIHIKO_NAME = '天鷺善彦';
/** 羽音との公式戦の場面の、研究会で指したことがあるか(studied)・ないか(fresh)の羽音の1行(23章)。 */
const STUDY_LINES = Object.freeze({
  pro: Object.freeze({ studied: '研究会では何度も指したけど、今日のは記録に残る1局。', fresh: '今日のは、記録に残る1局。' }),
  big: Object.freeze({ studied: '研究会の君とは何度も指した。でも、大一番の君は知らない。', fresh: '公式戦の君は知ってる。でも、大一番の君は知らない。' }),
});

/**
 * 場面。{name}はプレイヤーの名前、{you}は百花の呼び方、{title}はタイトルの名前(棋王など)、{holder}はタイトル保持者の名前、
 * {event}は棋戦の名前、{round}は対局の名前(本戦1回戦など)。
 */
export const PRO_YEAR_SCENES = Object.freeze({
  'pro-debut': Object.freeze({
    id: 'pro-debut',
    title: '四段の朝',
    summary: '4月1日、プロ棋士になった朝。同じ日に四段になった羽音と将棋会館の前で会い、上の舞台で会おうと約束する。百花からも電話で「おめでとう」。',
    background: 'hall',
    cast: ['hanane', 'momoka'],
    lines: [
      line('narration', 'neutral', '4月1日。{name}は、将棋会館の前に立っていた。今日から四段、プロ棋士だ。'),
      line('hanane', 'neutral', 'おはよう。早いね。'),
      line('hanane', 'neutral', '私も今日から四段。同じ日にスタートだから、勝ち数も負け数も、ここから横に並ぶ。'),
      line('momoka', 'neutral', '{you}、おめでとう！ 羽音ちゃんも！ 電話でごめんね、学校の前に言いたくて！', { act: 'hop' }),
      line('hanane', 'gentle', '百花、朝から元気だね。……でも、ありがと。'),
      line('narration', 'neutral', '会館の掲示板には、今年度の棋戦の予定がびっしり並んでいる。どれも予選の一番下からだ。'),
      line('hanane', 'neutral', '上に行けば、タイトル戦がある。父さんもいる。'),
      line('hanane', 'smile', '上の舞台で会おう。君とは、そこで指したい。'),
      line('momoka', 'neutral', '二人とも、いってらっしゃい！ ずっと応援してるからね！'),
      line('narration', 'neutral', 'こうして{name}の、棋士としての1年が始まった。'),
    ],
  }),
  // 奨励会から四段になってデビューする朝(18章)。羽音は奨励会で先に四段になっている。
  // {date}はデビューの日、{kishi}は棋士番号の文、{mentor}は師匠、{peers}は奨励会の同期、{half}は秋のデビューの一言(なければ空)。
  'pro-debut-shoreikai': Object.freeze({
    id: 'pro-debut-shoreikai',
    title: '四段の朝（奨励会から）',
    summary: '三段リーグを抜けて迎えた、デビューの朝。将棋会館の前で、一足先に四段になっていた羽音が待っている。師匠と奨励会の同期からも便りが届く。',
    background: 'hall',
    cast: ['hanane', 'momoka'],
    lines: [
      line('narration', 'neutral', '{date}。{name}は、将棋会館の前に立っていた。奨励会の例会に通った、いつもの入口だ。'),
      line('narration', 'neutral', '三段リーグを抜けて、今日から四段。{kishi}'),
      line('hanane', 'neutral', '来たね。今日は、例会の日じゃないよ。'),
      line('hanane', 'gentle', '私は一足先に上がっただけ。ここからは同じ四段。勝ち数も負け数も、横に並ぶ。'),
      line('narration', 'neutral', '{mentor}からは、朝いちばんに短い電話があった。「ここからが本当の勝負だ」'),
      line('momoka', 'neutral', '{you}、四段おめでとう！ 奨励会、ほんとうにほんとうにおつかれさま！', { act: 'hop' }),
      line('hanane', 'gentle', '百花、声が大きい。……でも、私からも。おめでとう。'),
      line('narration', 'neutral', '奨励会の同期の{peers}からも、短い便りが届いていた。「次は、上で会おう」。'),
      line('narration', 'neutral', '会館の掲示板には、棋戦の予定がびっしり並んでいる。どれも予選の一番下からだ。{half}'),
      line('hanane', 'smile', '上の舞台で会おう。君とは、そこで指したい。'),
      line('narration', 'neutral', 'こうして{name}の、棋士としての日々が始まった。'),
    ],
  }),
  'pro-hanane': Object.freeze({
    id: 'pro-hanane',
    title: '公式戦の初手合',
    summary: '羽音と公式戦ではじめて当たる日。今日のは記録に残る1局。二人そろって一礼し、対局が始まる。',
    background: 'venue',
    cast: ['hanane'],
    lines: [
      line('narration', 'neutral', '{event} {round}。対局室に入ると、羽音がもう座っていた。'),
      line('hanane', 'neutral', '公式戦で当たるのは、はじめてだね。'),
      line('hanane', 'neutral', '{study}'),
      line('hanane', 'gentle', '手加減はしない。君も、しないでしょ。'),
      line('narration', 'neutral', '駒を並べる音だけが、静かな部屋に響く。'),
      line('hanane', 'smile', '……楽しみにしてた。どう、君は？'),
      line('narration', 'neutral', '二人そろって一礼する。対局の始まりだ。', { act: { who: 'hanane', act: 'bow' }, sfx: 'koma' }),
    ],
  }),
  'pro-title-eve': Object.freeze({
    id: 'pro-title-eve',
    title: 'タイトル戦の前夜',
    summary: 'はじめてのタイトル戦、第1局の前の夜。対局場の旅館で、羽音と百花から電話がかかってくる。番勝負は長い。でも最初の1局を取った人が、いちばん楽に指せる。',
    background: 'night',
    cast: ['hanane', 'momoka'],
    lines: [
      line('narration', 'neutral', '{title}戦の番勝負、第1局の前の夜。対局場の旅館の窓から、明かりの消えた町が見える。'),
      line('narration', 'neutral', '明日、{name}は{holder}{title}に挑む。'),
      line('momoka', 'neutral', '{you}、電話つながった！ 明日、中継で見てるからね！'),
      line('momoka', 'wry', '緊張してる？ 私だったら、もう眠れないかも……'),
      line('hanane', 'neutral', '百花、あんまり緊張させないで。'),
      line('hanane', 'gentle', '前夜祭、どうだった。ああいう席、私はまだ慣れない。'),
      line('hanane', 'neutral', '番勝負は長いよ。1局目で全部決まるわけじゃない。'),
      line('hanane', 'smile', 'でも、最初の1局を取った人がいちばん楽に指せる。……君なら取れると思う。'),
      line('momoka', 'neutral', 'がんばって！ あったかくして寝てね！'),
      line('narration', 'neutral', '電話を切ると、部屋は静かになった。明日の朝、対局が始まる。', { tone: 'dim' }),
    ],
  }),
  // 防衛戦の夜(docs/pro-year-design.mdの20章)。保持者として受けて立つ側の前夜と、永世称号がかかる「記録の前夜」。
  'pro-defense-eve': Object.freeze({
    id: 'pro-defense-eve',
    title: '防衛戦の前夜',
    summary: '保持者としてはじめて迎える{title}戦。第1局の前の夜、羽音と百花から電話。挑戦する側から、受けて立つ側へ。',
    background: 'night',
    cast: ['hanane', 'momoka'],
    lines: [
      line('narration', 'neutral', '{title}戦の番勝負、第1局の前の夜。今度は、{name}が待つ側だ。'),
      line('narration', 'neutral', '明日、{challenger}が挑戦者として{name}に挑んでくる。'),
      line('momoka', 'neutral', '{you}、もしもし！ 今年は{title}として迎えるんだね！'),
      line('momoka', 'wry', 'この前までは挑戦する側だったのに、なんだか不思議な感じ……'),
      line('hanane', 'neutral', '挑戦する側より、受ける側のほうが怖いよ。'),
      line('hanane', 'gentle', '相手はこの1年、君の将棋ばかり研究してきたはずだから。'),
      line('hanane', 'neutral', 'でも、それだけ君の将棋を見てきたってことでしょ。'),
      line('hanane', 'smile', '君はいつもどおりでいい。それがいちばん研究しにくい。'),
      line('momoka', 'neutral', '中継、最初から見てるからね！ おやすみ！'),
      line('narration', 'neutral', '電話を切る。明日、{title}の座をかけた番勝負が始まる。', { tone: 'dim' }),
    ],
  }),
  'pro-defense-eternal': Object.freeze({
    id: 'pro-defense-eternal',
    title: '記録の前夜',
    summary: 'この番勝負を勝てば{eternal}。第1局の前の夜、羽音と百花から電話。記録は、勝ったあとで数えればいい。',
    background: 'night',
    cast: ['hanane', 'momoka'],
    lines: [
      line('narration', 'neutral', '{title}戦の番勝負、第1局の前の夜。宿の廊下まで、記者の声が聞こえる。'),
      line('narration', 'neutral', 'この番勝負を勝てば、{name}は{eternal}の資格を得る。'),
      line('momoka', 'neutral', '{you}、ニュース見た？ どこも{eternal}の話ばっかり！'),
      line('momoka', 'worried', 'あっ……こういうの、言わないほうがよかった？', { emote: 'sweat' }),
      line('hanane', 'neutral', 'もう遅いよ、百花。'),
      line('hanane', 'gentle', '記録がかかった番勝負って、盤の外の声が大きくなるね。'),
      line('hanane', 'neutral', 'でも、盤の上はいつもの1局。相手の{challenger}も、そう思ってる。'),
      line('hanane', 'smile', '記録は、勝ったあとで数えればいい。……おやすみ。'),
      line('momoka', 'neutral', 'がんばって！ 明日の朝、いちばんに中継つけるね！'),
      line('narration', 'neutral', '明かりを消す。考えるのは、明日の1手目だけでいい。', { tone: 'dim' }),
    ],
  }),
  // 番勝負が終わったあとの節目の夜(20-3の4)。結果の札を見終えたあと、1年の画面で出す。
  'pro-defense-streak': Object.freeze({
    id: 'pro-defense-streak',
    title: '連覇の夜',
    summary: '{title}を防衛して{streak}連覇。対局場の宿で、羽音と百花から電話。',
    background: 'night',
    cast: ['hanane', 'momoka'],
    lines: [
      line('narration', 'neutral', '{title}戦の番勝負が終わった。{name}は{title}を防衛し、{streak}連覇になった。'),
      line('narration', 'neutral', '感想戦を終えて宿に戻ると、電話が鳴った。'),
      line('momoka', 'neutral', '{you}、{streak}連覇おめでとう！ 中継のコメント、すごかったよ！', { act: 'hop' }),
      line('hanane', 'neutral', 'おめでとう。挑戦者、毎年強くなってるね。'),
      line('hanane', 'gentle', 'それでも勝つんだから、君も毎年強くなってるってことでしょ。'),
      line('hanane', 'smile', '……次に君から取るのは、私だから。待ってて。'),
      line('momoka', 'wry', 'もう、羽音ったら。今日くらいは素直にお祝いしようよ！'),
      line('narration', 'neutral', '電話を切る。窓の外に、対局場の灯りがまだ点いている。', { tone: 'dim' }),
    ],
  }),
  'pro-eternal': Object.freeze({
    id: 'pro-eternal',
    title: '永世称号の夜',
    summary: '{eternal}の資格を得た夜。羽音と百花から電話。記録の話をしても、羽音はいつもどおり。',
    background: 'night',
    cast: ['hanane', 'momoka'],
    lines: [
      line('narration', 'neutral', '{title}戦が終わった。{name}は{eternal}の資格を得た。', { size: 'big' }),
      line('narration', 'neutral', '記者会見の言葉は、もうほとんど覚えていない。'),
      line('momoka', 'neutral', '{you}、{eternal}だよ！ 将棋の歴史に名前が残るんだよ！', { act: 'jump', emote: 'sparkle' }),
      line('hanane', 'neutral', 'へえ。君の名前、ずっと残るんだ。'),
      line('hanane', 'gentle', '……なんか、遠くへ行かれた気がする。'),
      line('hanane', 'smile', 'でも、盤の前に座れば同じ1局だよ。次の対局も、ちゃんと指して。'),
      line('momoka', 'wry', '羽音、それお祝いの言葉なの？ ……でも、羽音らしいかも！'),
      line('narration', 'neutral', '電話を切る。手のひらに、まだ駒の感触が残っている。', { tone: 'dim' }),
    ],
  }),
  'pro-all-crowns': Object.freeze({
    id: 'pro-all-crowns',
    title: '全冠制覇の夜',
    summary: '八つのタイトルを、すべて手にした夜。羽音と百花から電話。',
    background: 'night',
    cast: ['hanane', 'momoka'],
    lines: [
      line('narration', 'neutral', '最後の番勝負が終わった。八つのタイトルが、すべて{name}のものになった。', { size: 'big' }),
      line('narration', 'neutral', '全冠制覇。ニュースの速報が、何度も同じ言葉をくり返している。'),
      line('momoka', 'neutral', '{you}、八冠だよ！ 八冠！ 私、中継の前で泣いちゃった！', { act: 'jump' }),
      line('hanane', 'neutral', '……すごい。としか言えない。'),
      line('hanane', 'gentle', '全部持ってる人は、全部の挑戦を受けるんだよね。来年から大変だよ。'),
      line('hanane', 'smile', 'その挑戦者の中に、私もいるから。'),
      line('momoka', 'wry', '羽音、今日くらい「おめでとう」だけでいいのに……'),
      line('hanane', 'gentle', '……おめでとう。ほんとに。'),
      line('narration', 'neutral', '電話を切る。明日から、また新しい1年が始まる。', { tone: 'dim' }),
    ],
  }),
  'pro-title-lost': Object.freeze({
    id: 'pro-title-lost',
    title: '失冠の夜',
    summary: '{title}を失った夜。宿の部屋にいると、羽音と百花から電話。取り返しに行くんでしょ、と羽音は言う。',
    background: 'night',
    cast: ['hanane', 'momoka'],
    lines: [
      line('narration', 'neutral', '{title}戦の番勝負が終わった。{title}の座は、{challenger}に移った。'),
      line('narration', 'neutral', '宿の部屋は、昨日より広く感じる。'),
      line('momoka', 'worried', '{you}……おつかれさま。中継、最後まで見てたよ。'),
      line('hanane', 'neutral', '……起きてる？'),
      line('hanane', 'gentle', '慰めの言葉、私は上手く言えない。だから言わない。'),
      line('hanane', 'neutral', '取り返しに行くんでしょ。次の期は、少し上から始められるよ。'),
      line('momoka', 'neutral', '私、次の番勝負も最初から中継見るからね！'),
      line('hanane', 'smile', 'その番勝負の前に、私が君を倒しちゃうかもしれないけど。'),
      line('narration', 'neutral', '電話を切る。明日から、また挑戦する側だ。', { tone: 'dim' }),
    ],
  }),
  // 封じ手の夜(docs/seal-break-design.mdの2-5)。二日制の番勝負の1日目のあと。番勝負の星で3通り(リード・タイ・カド番)。
  'pro-seal-lead': Object.freeze({
    id: 'pro-seal-lead',
    title: '封じ手の夜（リード）',
    summary: '番勝負をリードして迎えた封じ手の夜。宿の夕食のあと、羽音から電話。あと少しだからこそ、いつもどおりに。',
    background: 'night',
    cast: ['hanane', 'momoka'],
    lines: [
      line('narration', 'neutral', '1日目が終わった。封じ手の封筒は、立会人の手で金庫にしまわれた。'),
      line('narration', 'neutral', '宿の夕食は、一口ずつがやけに長く感じる。{title}戦は、{name}がリードしている。'),
      line('hanane', 'neutral', 'もしもし。中継、見てた。封じ手、もう書いたんでしょ。'),
      line('hanane', 'gentle', 'リードしてる番勝負の夜って、勝ちを数え始めちゃう。数えないほうがいいよ。'),
      line('momoka', 'neutral', '{you}、ごはん食べた？ 明日もいつもどおりでいいんだよ！'),
      line('hanane', 'smile', '百花の言うとおり。いつもどおりの1手が、いちばん強い。……おやすみ。'),
      line('narration', 'neutral', '明かりを消す。明日の朝、封筒が開く。', { tone: 'dim' }),
    ],
  }),
  'pro-seal-tie': Object.freeze({
    id: 'pro-seal-tie',
    title: '封じ手の夜',
    summary: '番勝負の1局の、1日目の夜。宿で羽音と百花から電話。封じ手はもう書いた。あとは明日の朝、盤の前に座るだけ。',
    background: 'night',
    cast: ['hanane', 'momoka'],
    lines: [
      line('narration', 'neutral', '1日目が終わった。{name}の封じ手は、封筒に入って立会人に渡された。'),
      line('narration', 'neutral', '宿の部屋に戻ると、静かすぎて自分の心臓の音が聞こえる。'),
      line('momoka', 'neutral', '{you}、おつかれさま！ 封じ手ってどんな気分？ どきどきする？'),
      line('hanane', 'neutral', '百花、それは聞いちゃいけないやつ。中身は明日まで秘密。'),
      line('hanane', 'gentle', '相手も今ごろ、どの手か考えてる。考えさせてる時間も、勝負のうちだよ。'),
      line('momoka', 'neutral', 'じゃあ、今日はもう寝よう！ 明日の朝、中継の前で待ってるね！'),
      line('narration', 'neutral', '布団に入っても、盤の局面が目の裏に浮かぶ。……明日の朝が来る。', { tone: 'dim' }),
    ],
  }),
  'pro-seal-kado': Object.freeze({
    id: 'pro-seal-kado',
    title: '封じ手の夜（カド番）',
    summary: 'あと1つ負けたら終わり、カド番の封じ手の夜。羽音は短い言葉で、百花は明るく励ます。',
    background: 'night',
    cast: ['hanane', 'momoka'],
    lines: [
      line('narration', 'neutral', '1日目が終わった。この1局を落とせば、{title}戦はここで終わる。カド番だ。'),
      line('narration', 'neutral', '封じ手の封筒が金庫にしまわれる音が、いつまでも耳に残っている。'),
      line('hanane', 'neutral', '……起きてると思った。'),
      line('hanane', 'gentle', 'カド番の夜は、負けたあとのことばかり考える。でも、今考えるのは明日の1手目だけでいい。'),
      line('momoka', 'neutral', '{you}、ここからだよ！ 逆転の番勝負、私は何回も見てきたもん！', { act: 'hop' }),
      line('hanane', 'smile', '私も、君が盤の前で粘るところ、何回も見てる。……だから大丈夫。'),
      line('narration', 'neutral', '窓の外は真っ暗だ。それでも、朝はちゃんと来る。', { tone: 'dim' }),
    ],
  }),
  // 封じ手の夜（防衛戦）(20-3の3)。保持者として迎える二日制の番勝負の1日目のあと。
  'pro-seal-defense-lead': Object.freeze({
    id: 'pro-seal-defense-lead',
    title: '封じ手の夜（防衛まであと少し）',
    summary: '防衛戦をリードして迎えた封じ手の夜。羽音から電話。守ろうとすると手が小さくなる、と短く言う。',
    background: 'night',
    cast: ['hanane', 'momoka'],
    lines: [
      line('narration', 'neutral', '1日目が終わった。封じ手の封筒は、立会人の手で金庫にしまわれた。'),
      line('narration', 'neutral', '{title}戦は、{name}がリードしている。防衛まで、あと少しだ。'),
      line('hanane', 'neutral', 'もしもし。中継、見てた。'),
      line('hanane', 'gentle', 'リードしてる防衛戦の夜って、守りたくなるでしょ。'),
      line('hanane', 'neutral', '守ろうとすると、手が小さくなる。いつもの将棋で取りに行って。'),
      line('momoka', 'neutral', '{you}、ごはん食べた？ 明日もいつもどおりでいいんだよ！'),
      line('narration', 'neutral', '明かりを消す。明日の朝、封筒が開く。', { tone: 'dim' }),
    ],
  }),
  'pro-seal-defense-tie': Object.freeze({
    id: 'pro-seal-defense-tie',
    title: '封じ手の夜（防衛戦）',
    summary: '防衛戦の1局の、1日目の夜。宿で羽音と百花から電話。挑戦者は勢いがある。受けるだけでなく、こちらからも。',
    background: 'night',
    cast: ['hanane', 'momoka'],
    lines: [
      line('narration', 'neutral', '1日目が終わった。{name}の封じ手は、封筒に入って立会人に渡された。'),
      line('narration', 'neutral', '盤の向こうの挑戦者は、1日じゅう前のめりだった。'),
      line('momoka', 'neutral', '{you}、おつかれさま！ 挑戦者の人、すごく気合い入ってたね！'),
      line('hanane', 'neutral', '挑戦者は失うものがないから、思い切って来るよ。'),
      line('hanane', 'gentle', '受けるだけだと押される。君からも1回、踏み込んでいいと思う。'),
      line('momoka', 'neutral', '明日の朝、中継の前で待ってるね！'),
      line('narration', 'neutral', '布団に入っても、盤の局面が目の裏に浮かぶ。……明日の朝が来る。', { tone: 'dim' }),
    ],
  }),
  'pro-seal-defense-kado': Object.freeze({
    id: 'pro-seal-defense-kado',
    title: '封じ手の夜（防衛戦のカド番）',
    summary: 'あと1つ負けたら失冠、カド番の封じ手の夜。羽音は短く、百花は明るく励ます。',
    background: 'night',
    cast: ['hanane', 'momoka'],
    lines: [
      line('narration', 'neutral', '1日目が終わった。この1局を落とせば、{title}の座を明け渡すことになる。'),
      line('narration', 'neutral', '封じ手の封筒が金庫にしまわれる音が、いつまでも耳に残っている。'),
      line('hanane', 'neutral', '……起きてると思った。'),
      line('hanane', 'gentle', '失うかもしれない夜は、取った夜よりずっと長いでしょ。'),
      line('momoka', 'neutral', '{you}、ここからだよ！ 防衛の逆転、私は信じてるもん！', { act: 'hop' }),
      line('hanane', 'smile', '私も。君が盤の前で粘るところ、何回も見てる。……だから大丈夫。'),
      line('narration', 'neutral', '窓の外は真っ暗だ。それでも、朝はちゃんと来る。', { tone: 'dim' }),
    ],
  }),
  // 相手が羽音・善彦のときの場面(docs/pro-year-design.mdの22章)。羽音が相手なら、羽音は電話で応援しない。
  // 善彦は立ち絵がないので声だけ。{record}は永世称号・連覇の1行(なければ行ごと出さない)、{series}は番勝負の星の1行、
  // {result}は番勝負の結果の1行。
  'pro-yoshihiko': Object.freeze({
    id: 'pro-yoshihiko',
    title: '天鷺善彦との初手合',
    summary: '羽音の父、天鷺善彦と公式戦ではじめて当たる日。朝、羽音から短いメッセージが届く。対局室で、善彦は穏やかに一礼する。',
    background: 'venue',
    cast: ['hanane'],
    lines: [
      line('narration', 'neutral', '{event} {round}。今日の相手は、天鷺善彦。羽音の父だ。'),
      line('narration', 'neutral', '朝、羽音から短いメッセージが届いていた。'),
      line('hanane', 'neutral', '今日、父さんとでしょ。'),
      line('hanane', 'gentle', '父さんは、序盤で何もしないように見える。でも、中盤で全部決めてる。'),
      line('hanane', 'neutral', '……これ、父さんには言わないで。', { exit: 'hanane' }),
      line('narration', 'neutral', '対局室に入ると、上座で善彦が静かに目を閉じていた。'),
      voice(YOSHIHIKO_NAME, 'よろしくお願いします。羽音から、よく話を聞いています。'),
      voice(YOSHIHIKO_NAME, '今日は、楽しみにしてきました。いい将棋にしたいですね。'),
      line('narration', 'neutral', '二人そろって一礼する。対局の始まりだ。', { sfx: 'koma' }),
    ],
  }),
  'pro-hanane-big': Object.freeze({
    id: 'pro-hanane-big',
    title: '羽音との大一番',
    summary: '勝てば先へ進める大一番の相手は、羽音だった。対局室で、羽音はいつもより少し早く座っていた。',
    background: 'venue',
    cast: ['hanane'],
    lines: [
      line('narration', 'neutral', '{event} {round}。大一番の相手は、羽音だった。'),
      line('narration', 'neutral', '対局室に入ると、羽音はもう座っていた。いつもより、少し早い。'),
      line('hanane', 'neutral', 'ここで当たると思ってた。表を見たときから。'),
      line('hanane', 'gentle', '{studyBig}'),
      line('hanane', 'neutral', '勝ったほうが、上に行く。分かりやすくて、いいね。'),
      line('hanane', 'smile', 'どう、準備はできてる？'),
      line('narration', 'neutral', '二人そろって一礼する。対局の始まりだ。', { act: { who: 'hanane', act: 'bow' }, sfx: 'koma' }),
    ],
  }),
  'pro-title-eve-hanane': Object.freeze({
    id: 'pro-title-eve-hanane',
    title: '羽音とのタイトル戦の前夜',
    summary: '羽音の持つ{title}に挑む番勝負の前夜。前夜祭の壇の上で、羽音は四段の朝の約束を口にする。部屋に戻ると、百花から電話。',
    background: 'venue',
    cast: ['hanane', 'momoka'],
    lines: [
      line('narration', 'neutral', '{title}戦の番勝負、第1局の前の夜。前夜祭の壇の上で、{name}は羽音と並んだ。'),
      line('narration', 'neutral', '明日、{name}は羽音の持つ{title}に挑む。'),
      line('hanane', 'neutral', '四段の朝に言ったこと、覚えてる？ 上の舞台で会おうって。'),
      line('hanane', 'smile', '本当に来たね。……少し、うれしい。'),
      line('hanane', 'neutral', '明日からは、全部見せる。君も、全部見せて。', { exit: 'hanane' }),
      line('narration', 'neutral', '部屋に戻ると、百花から電話が鳴った。', { screen: 'blackout', bg: 'night' }),
      line('momoka', 'wry', '{you}、羽音ちゃんと{title}戦なんて……私、どっちを応援すればいいの？', { enter: 'momoka' }),
      line('momoka', 'neutral', '決めた！ 二人とも応援する！ いい将棋を見せてね！', { act: 'hop' }),
      line('narration', 'neutral', '電話を切る。同じ宿のどこかで、羽音も明日の盤を考えている。', { tone: 'dim' }),
    ],
  }),
  'pro-defense-eve-hanane': Object.freeze({
    id: 'pro-defense-eve-hanane',
    title: '挑戦者は羽音',
    summary: '{title}の防衛戦、挑戦者は羽音。前夜祭の壇の上で、羽音は「この1年、君の将棋ばかり見てた」と言う。部屋に戻ると、百花から電話。',
    background: 'venue',
    cast: ['hanane', 'momoka'],
    lines: [
      line('narration', 'neutral', '{title}戦の番勝負、第1局の前の夜。前夜祭の壇に、挑戦者の羽音が上がった。'),
      line('narration', 'neutral', '{record}'),
      line('hanane', 'neutral', '挑戦者として来たよ。この1年、君の将棋ばかり見てた。'),
      line('hanane', 'gentle', '受けて立つ側の夜って、長いでしょ。私なら、きっと眠れない。'),
      line('hanane', 'smile', '明日、それを取りに行く。手加減はしないよ。', { exit: 'hanane' }),
      line('narration', 'neutral', '部屋に戻ると、百花から電話が鳴った。', { screen: 'blackout', bg: 'night' }),
      line('momoka', 'neutral', '{you}、挑戦者が羽音ちゃんだなんて！ 私、二人とも応援するからね！', { enter: 'momoka', act: 'hop' }),
      line('momoka', 'wry', 'それでね、終わったら3人でごはん行こうね。約束だよ！'),
      line('narration', 'neutral', '電話を切る。明日、{title}の座をかけて、羽音と指す。', { tone: 'dim' }),
    ],
  }),
  'pro-title-eve-yoshihiko': Object.freeze({
    id: 'pro-title-eve-yoshihiko',
    title: '天鷺善彦に挑む前夜',
    summary: '天鷺善彦の持つ{title}に挑む番勝負の前夜。羽音と百花から電話。羽音は、どっちの味方かは聞かないで、と言う。',
    background: 'night',
    cast: ['hanane', 'momoka'],
    lines: [
      line('narration', 'neutral', '{title}戦の番勝負、第1局の前の夜。明日、{name}は天鷺善彦の持つ{title}に挑む。'),
      line('narration', 'neutral', '前夜祭の善彦は「いい将棋にしたいですね」とだけ言って、穏やかに笑っていた。'),
      line('momoka', 'neutral', '{you}、明日から羽音ちゃんのお父さんとだね！ 私、手がふるえてきた……', { act: 'shiver' }),
      line('hanane', 'neutral', '百花が緊張してどうするの。'),
      line('hanane', 'gentle', '父さん、前の夜でもいつもどおり寝てるよ。そういう人だから。'),
      line('hanane', 'neutral', 'どっちの味方かは、聞かないで。私にも分からないから。'),
      line('hanane', 'smile', '……でも、君が父さんとどう指すのかは、いちばん見たい。'),
      line('momoka', 'neutral', 'がんばって！ あったかくして寝てね！'),
      line('narration', 'neutral', '電話を切る。明日、羽音の父と盤をはさむ。', { tone: 'dim' }),
    ],
  }),
  'pro-defense-eve-yoshihiko': Object.freeze({
    id: 'pro-defense-eve-yoshihiko',
    title: '挑戦者は善彦',
    summary: '{title}の防衛戦、挑戦者は天鷺善彦。羽音と百花から電話。善彦が家で並べていたのは、ずっと{name}の棋譜だった。',
    background: 'night',
    cast: ['hanane', 'momoka'],
    lines: [
      line('narration', 'neutral', '{title}戦の番勝負、第1局の前の夜。今年の挑戦者は、天鷺善彦だ。'),
      line('narration', 'neutral', '{record}'),
      line('narration', 'neutral', '前夜祭の会場には、いつもの倍の記者が来ていた。'),
      line('hanane', 'neutral', 'もしもし。……父さんが挑戦者って、変な感じ。'),
      line('hanane', 'gentle', '家で並べてたの、この何か月か、ずっと君の棋譜だった。'),
      line('hanane', 'neutral', '父さんが一人の将棋をあんなに並べるの、はじめて見たよ。'),
      line('momoka', 'neutral', '{you}、それって、すごく認められてるってことだよ！', { act: 'hop' }),
      line('hanane', 'smile', 'そういうこと。……明日、いい将棋にして。'),
      line('narration', 'neutral', '電話を切る。明日、挑戦者の席にあの人が座る。', { tone: 'dim' }),
    ],
  }),
  // 羽音・善彦との番勝負の封じ手の夜(22-3の3)。羽音とは同じ宿で少しだけ会う(封じ手の話はしない)。百花はメッセージ。
  'pro-seal-hanane-lead': Object.freeze({
    id: 'pro-seal-hanane-lead',
    title: '封じ手の夜（羽音と・リード）',
    summary: '羽音との番勝負をリードして迎えた封じ手の夜。宿の自販機の前で、羽音とばったり会う。封じ手の話はしない。',
    background: 'night',
    cast: ['hanane'],
    lines: [
      line('narration', 'neutral', '1日目が終わった。封じ手の封筒は、立会人の手で金庫にしまわれた。'),
      line('narration', 'neutral', '{title}戦は、{name}がリードしている。同じ宿のどこかに、羽音がいる。'),
      line('narration', 'neutral', '夜、自販機の前で、羽音とばったり会った。', { enter: { who: 'hanane', from: 'right' } }),
      line('hanane', 'neutral', '……あ。封じ手の話は、しないよ。'),
      line('hanane', 'gentle', 'リードされてる側の夜って、思ったより静かなんだね。'),
      line('hanane', 'smile', 'でも、まだ終わってない。明日の朝、盤の前で。', { exit: 'hanane' }),
      line('narration', 'neutral', '部屋に戻ると、百花からメッセージ。「二人とも、早く寝ること！」'),
      line('narration', 'neutral', '明かりを消す。明日の朝、封筒が開く。', { tone: 'dim' }),
    ],
  }),
  'pro-seal-hanane-tie': Object.freeze({
    id: 'pro-seal-hanane-tie',
    title: '封じ手の夜（羽音と）',
    summary: '羽音との番勝負、星が並んだまま迎えた封じ手の夜。夕食のあと、宿の廊下で羽音とすれちがう。',
    background: 'night',
    cast: ['hanane'],
    lines: [
      line('narration', 'neutral', '1日目が終わった。{name}の封じ手は、封筒に入って立会人に渡された。'),
      line('narration', 'neutral', '{title}戦は、星が並んでいる。夕食のあと、宿の廊下で羽音とすれちがった。', { enter: 'hanane' }),
      line('hanane', 'neutral', '今日の1日目、面白かった。……封じ手の話じゃないよ。'),
      line('hanane', 'gentle', '五分の番勝負の夜って、いちばん長いね。'),
      line('hanane', 'neutral', 'おやすみ。明日、続きを指そう。', { exit: 'hanane' }),
      line('narration', 'neutral', '部屋に戻ると、百花からメッセージ。「どっちもがんばれ！」'),
      line('narration', 'neutral', '布団に入っても、盤の局面が目の裏に浮かぶ。……明日の朝が来る。', { tone: 'dim' }),
    ],
  }),
  'pro-seal-hanane-kado': Object.freeze({
    id: 'pro-seal-hanane-kado',
    title: '封じ手の夜（羽音と・カド番）',
    summary: 'あと1つ負けたら終わり、羽音との番勝負のカド番の夜。眠れずに宿の庭へ出ると、先に羽音がいた。',
    background: 'night',
    cast: ['hanane'],
    lines: [
      line('narration', 'neutral', '1日目が終わった。この1局を落とせば、{title}戦はここで終わる。'),
      line('narration', 'neutral', '眠れずに宿の庭へ出ると、先に羽音がいた。', { enter: 'hanane' }),
      line('hanane', 'neutral', '……君も、眠れないんだ。'),
      line('hanane', 'gentle', 'あと1つで決まる夜って、勝ってる側も長いんだね。知らなかった。'),
      line('hanane', 'neutral', '慰めは言わない。明日、私は勝ちに行くから。'),
      line('hanane', 'smile', 'だから君も、最後まで全部見せて。', { exit: 'hanane' }),
      line('narration', 'neutral', '部屋に戻ると、百花からメッセージ。「最後まで、どっちもがんばれ！」'),
      line('narration', 'neutral', '窓の外は真っ暗だ。それでも、朝はちゃんと来る。', { tone: 'dim' }),
    ],
  }),
  'pro-seal-yoshihiko': Object.freeze({
    id: 'pro-seal-yoshihiko',
    title: '封じ手の夜（善彦と）',
    summary: '天鷺善彦との番勝負の封じ手の夜。羽音と百花から電話。父さんは封じ手の夜、いつも早く寝る、と羽音は言う。',
    background: 'night',
    cast: ['hanane', 'momoka'],
    lines: [
      line('narration', 'neutral', '1日目が終わった。封じ手の封筒は、立会人の手で金庫にしまわれた。'),
      line('narration', 'neutral', '{series}'),
      line('hanane', 'neutral', 'もしもし。……父さん、たぶんもう寝てる。封じ手の夜は、いつも早いから。'),
      line('hanane', 'gentle', '1日目の父さん、楽しそうだった。家では、あんな顔あんまりしない。'),
      line('momoka', 'neutral', '{you}、おつかれさま！ 羽音ちゃん、中継ずっと見てたんだよ！'),
      line('hanane', 'neutral', '百花、それは言わなくていい。'),
      line('hanane', 'smile', '……君も早く寝て。2日目の父さんは、もっと強いから。'),
      line('narration', 'neutral', '布団に入っても、盤の局面が目の裏に浮かぶ。……明日の朝が来る。', { tone: 'dim' }),
    ],
  }),
  // 羽音・善彦との番勝負のあとの夜(22-3の4)。結果の札を見終えたあとに出す。
  'pro-beat-hanane': Object.freeze({
    id: 'pro-beat-hanane',
    title: '羽音との番勝負のあと',
    summary: '羽音との{title}戦の番勝負に勝った日。対局室で、羽音は「悔しい」と短く言う。その夜、百花から電話。',
    background: 'venue',
    cast: ['hanane', 'momoka'],
    lines: [
      line('narration', 'neutral', '{result}'),
      line('narration', 'neutral', '{record}'),
      line('narration', 'neutral', '感想戦が終わっても、羽音は盤の前から動かなかった。'),
      line('hanane', 'neutral', '……悔しい。'),
      line('hanane', 'gentle', 'でも、全部見せてもらった。君の将棋、また少し分かった。'),
      line('hanane', 'neutral', '次は、私が勝つから。待ってて。', { exit: 'hanane' }),
      line('narration', 'neutral', 'その夜、百花から電話がかかってきた。', { screen: 'blackout', bg: 'night' }),
      line('momoka', 'neutral', '{you}、おめでとう！ ……羽音ちゃんにも、さっき電話したよ。', { enter: 'momoka' }),
      line('momoka', 'wry', '「悔しい」って3回言ってた。でも、ちょっとうれしそうだった！'),
      line('narration', 'neutral', '電話を切る。窓の外に、対局場の灯りがまだ点いている。', { tone: 'dim' }),
    ],
  }),
  'pro-lost-hanane': Object.freeze({
    id: 'pro-lost-hanane',
    title: '羽音に届かなかった夜',
    summary: '羽音との{title}戦の番勝負に敗れた日。羽音は慰めを言わず、「上の舞台で、また会おう」と言う。その夜、百花から電話。',
    background: 'venue',
    cast: ['hanane', 'momoka'],
    lines: [
      line('narration', 'neutral', '{result}'),
      line('narration', 'neutral', '感想戦のあと、羽音は少しだけ盤の前に残っていた。'),
      line('hanane', 'neutral', '慰めは言わないよ。君も、言われたくないでしょ。'),
      line('hanane', 'gentle', '君の将棋、何度もひやっとした。'),
      line('hanane', 'smile', '次の期、待ってる。上の舞台で、また会おう。', { exit: 'hanane' }),
      line('narration', 'neutral', 'その夜、百花から電話がかかってきた。', { screen: 'blackout', bg: 'night' }),
      line('momoka', 'worried', '{you}……おつかれさま。中継、最後まで見てたよ。', { enter: 'momoka' }),
      line('momoka', 'wry', '羽音ちゃんへのおめでとうは、明日にする。今日は、{you}と話したかったから。'),
      line('narration', 'neutral', '電話を切る。また、挑戦する側から始まる。', { tone: 'dim' }),
    ],
  }),
  'pro-beat-yoshihiko': Object.freeze({
    id: 'pro-beat-yoshihiko',
    title: '善彦との番勝負のあと',
    summary: '天鷺善彦との{title}戦の番勝負に勝った日。廊下で善彦に呼び止められる。その夜、羽音から電話。',
    background: 'venue',
    cast: ['hanane'],
    lines: [
      line('narration', 'neutral', '{result}'),
      line('narration', 'neutral', '{record}'),
      line('narration', 'neutral', '記者会見のあと、廊下で善彦に呼び止められた。'),
      voice(YOSHIHIKO_NAME, 'おめでとうございます。……いい番勝負でした。'),
      voice(YOSHIHIKO_NAME, '途中から、あなたの手を予想するのをやめました。そのほうが面白かったので。'),
      line('narration', 'neutral', 'その夜、羽音から電話がかかってきた。', { screen: 'blackout', bg: 'night' }),
      line('hanane', 'neutral', '……父さんに、勝ったんだ。', { enter: 'hanane' }),
      line('hanane', 'gentle', '家に帰ったら、父さんにどんな顔すればいいか分からない。'),
      line('hanane', 'smile', 'でも、次は私の番。君から取るのは、父さんじゃなくて私だから。'),
      line('narration', 'neutral', '電話を切る。手のひらに、まだ駒の感触が残っている。', { tone: 'dim' }),
    ],
  }),
  'pro-lost-yoshihiko': Object.freeze({
    id: 'pro-lost-yoshihiko',
    title: '善彦に届かなかった夜',
    summary: '天鷺善彦との{title}戦の番勝負に敗れた日。感想戦で善彦がひとこと。その夜、羽音から電話。',
    background: 'venue',
    cast: ['hanane'],
    lines: [
      line('narration', 'neutral', '{result}'),
      line('narration', 'neutral', '感想戦で、善彦は{name}の指した手を、何度も並べ直していた。'),
      voice(YOSHIHIKO_NAME, 'この手は、私には指せない手だったかなという気がします。また指しましょう。'),
      line('narration', 'neutral', 'その夜、羽音から電話がかかってきた。', { screen: 'blackout', bg: 'night' }),
      line('hanane', 'neutral', '……起きてる？ 父さん、帰りの車でずっと君の将棋の話してた。', { enter: 'hanane' }),
      line('hanane', 'gentle', '慰めじゃないよ。父さんが、勝った将棋の話をするのは珍しいから。'),
      line('hanane', 'neutral', '次は届くよ。私が言うんだから、たぶん当たる。'),
      line('narration', 'neutral', '電話を切る。次の挑戦は、もう始まっている。', { tone: 'dim' }),
    ],
  }),
});

/**
 * 対局の相手が羽音・善彦か(docs/pro-year-design.mdの22-3の1)。相手ごとに場面を変える。
 * @param {{ story?: string | null } | null | undefined} opponent
 * @returns {'hanane' | 'yoshihiko' | ''}
 */
export function proYearRival(opponent) {
  if (opponent?.story === HANANE) return 'hanane';
  if (opponent?.story === YOSHIHIKO) return 'yoshihiko';
  return '';
}

/**
 * 封じ手の夜の場面(docs/seal-break-design.mdの2-5)。番勝負の星から、リード・タイ・カド番のどれかの場面のid。
 * defenseは保持者として指す防衛戦(防衛戦の3本。docs/pro-year-design.mdの20-3の3)。
 * rivalは相手が羽音・善彦のとき(22-3の3)。羽音は挑戦でも防衛でも星で3本、善彦は1本(星は`sealSeriesText`の1行で言う)。
 * @param {{ winsUser?: number, winsOpponent?: number, need?: number, defense?: boolean, rival?: string }} series
 */
export function proYearSealSceneId({ winsUser = 0, winsOpponent = 0, need = 0, defense = false, rival = '' } = {}) {
  const kind = need > 0 && winsOpponent >= need - 1 && winsOpponent > winsUser ? 'kado' : winsUser > winsOpponent ? 'lead' : 'tie';
  if (rival === 'hanane') return `pro-seal-hanane-${kind}`;
  if (rival === 'yoshihiko') return 'pro-seal-yoshihiko';
  return defense ? `pro-seal-defense-${kind}` : `pro-seal-${kind}`;
}

/**
 * 封じ手の夜の、番勝負の星の1行(`{series}`。善彦との封じ手の夜)。{name}はあとで差し込む。
 * @param {{ winsUser?: number, winsOpponent?: number, need?: number, title?: string }} series
 */
export function sealSeriesText({ winsUser = 0, winsOpponent = 0, need = 0, title = '' } = {}) {
  const name = title ? `${title}戦` : '番勝負';
  if (!winsUser && !winsOpponent) return `${name}の第1局。まだ、どちらにも星はない。`;
  const score = `${name}は、ここまで{name}の${winsUser}勝${winsOpponent}敗。`;
  return need > 0 && winsOpponent >= need - 1 && winsOpponent > winsUser ? `${score}この1局を落とせば、番勝負は終わる。` : score;
}

/**
 * 羽音・善彦との番勝負の結果の1行(`{result}`。22-3の4)。kindは19章の結果(take・retake・defend・lost・miss)。
 * @param {{ rival: string, kind: string, title: string }} input
 */
export function rivalResultText({ rival, kind, title }) {
  const who = rival === 'hanane' ? '羽音' : YOSHIHIKO_NAME;
  const head = `${title}戦の番勝負が終わった。`;
  if (kind === 'defend') return `${head}{name}は挑戦者の${who}を退け、${title}を守った。`;
  if (kind === 'take' || kind === 'retake') return `${head}{name}は${who}に勝ち、${title}を手にした。`;
  if (kind === 'lost') return `${head}${title}の座は、${who}に移った。`;
  return `${head}${who}は、${title}を守った。`;
}

/**
 * 羽音・善彦との番勝負で届いた記録の1行(`{record}`。永世称号か連覇。なければ空で、行ごと出さない)。
 * @param {{ eternal?: string, streak?: number }} input
 */
export function rivalRecordText({ eternal = '', streak = 0 } = {}) {
  if (eternal) return `この番勝負で、{name}は${eternal}の資格を得た。`;
  if (streak >= 2) return `これで、{name}は${streak}連覇になった。`;
  return '';
}

/**
 * ストーリー選択から読み直すときに、そのときの対局がないので入れる言葉。
 * 奨励会からのデビューの言葉(date・kishi・mentor・peers・half。18章)は、記録がなくても読める既定の言葉か空。
 */
const DEFAULT_VARS = Object.freeze({
  title: 'タイトル', holder: 'タイトル保持者の', event: '棋戦', round: '本戦',
  date: 'デビューの日', kishi: '', mentor: '師匠', peers: '仲間', half: '',
  // 防衛戦の夜(20-3の5)。
  challenger: '若手の棋士', streak: '3', eternal: '永世称号',
  // 相手が羽音・善彦のとき(22-3の6)。recordは空なら行ごと出さない。
  series: '番勝負は、まだ続いている。', result: 'タイトル戦の番勝負が終わった。', record: '',
  // 研究会で指したことがあるかで変える羽音の1行(23章。研究会に出ていないのに「何度も指した」と言わない)。
  study: STUDY_LINES.pro.studied, studyBig: STUDY_LINES.big.studied,
});

/**
 * 場面を画面に出す形にする(名前と、棋戦の言葉を差し込む)。
 * 棋戦の言葉を先に入れ、名前をあとで入れる(言葉の中に{name}を書けるように。22-3の6)。中身が空になった行は出さない(`{record}`だけの行)。
 * 声だけの人(善彦)の名前の札は、行の名前を使う。
 * @param {string} id
 * @param {{ playerName?: string, momokaCall?: string, vars?: { title?: string, holder?: string, event?: string, round?: string, date?: string, kishi?: string, mentor?: string, peers?: string, half?: string, challenger?: string, streak?: string, eternal?: string, series?: string, result?: string, record?: string, study?: string, studyBig?: string } }} [options]
 */
export function proYearScene(id, { playerName = '', momokaCall = '', vars = {} } = {}) {
  const scene = PRO_YEAR_SCENES[/** @type {keyof typeof PRO_YEAR_SCENES} */ (id)];
  if (!scene) return null;
  const words = { ...DEFAULT_VARS, ...Object.fromEntries(Object.entries(vars).filter(([, value]) => value)) };
  const fill = (text) => sceneText(
    String(text).replace(/\{(title|holder|event|round|date|kishi|mentor|peers|half|challenger|streak|eternal|series|result|record|study|studyBig)\}/g, (_, key) => words[key]),
    playerName,
    momokaCall,
  );
  return {
    id: scene.id,
    title: scene.title,
    summary: fill(scene.summary),
    background: scene.background,
    cast: [...scene.cast],
    // 演出の欄もそのまま渡す。
    lines: scene.lines
      .map((entry) => ({
        ...entry,
        name: entry.who === 'extra' ? entry.name ?? '' : NOVEL_PEOPLE[/** @type {keyof typeof NOVEL_PEOPLE} */ (entry.who)]?.name ?? '',
        text: fill(entry.text),
      }))
      .filter((entry) => entry.text.trim()),
  };
}

/** 見た場面の印(state.scenes)。タイトル戦の前夜は、タイトルごとに1回(`pro-title-eve:<棋戦>`)。 */
export const seenProYearScene = (state, key) => Array.isArray(state?.scenes) && state.scenes.includes(key);

/** 場面を見た印をつける(state.scenesに足す。保存はpro-year:v1のまま)。 */
export function markProYearScene(state, key) {
  if (!state || !key || seenProYearScene(state, key)) return state;
  return { ...state, scenes: [...(Array.isArray(state.scenes) ? state.scenes : []), key] };
}

/** 相手とプレイヤーの公式戦が、もう終わっているか(分身に任せた対局も数える。研究会の練習対局は数えない)。 */
function metInOfficialGame(state, opponentId) {
  return Object.values(state.games ?? {}).some((game) => game?.user && game.winner && (game.a === opponentId || game.b === opponentId));
}

/**
 * いま見せる場面(なければnull)。デビューの日は、まだ1局も指していない1年目に1回。羽音との場面は、公式戦ではじめて当たる対局の前に1回
 * (公式戦がもう終わっていたら出さない)。タイトル戦の前夜は、そのタイトルの番勝負の第1局の前に、タイトルごとに1回。
 * 相手が羽音・善彦のときは、相手ごとの場面(docs/pro-year-design.mdの22章)。羽音・善彦の番勝負の前夜は、今までの前夜の代わりに出す。
 * 研究会・指導対局の前には出さない(公式戦の場面のため)。
 * @param {any} state
 * @returns {{ key: string, id: string, vars: Record<string, string> } | null}
 */
export function proYearSceneDue(state) {
  if (!state) return null;
  const played = Object.values(state.games ?? {}).some((game) => game.user && game.winner);
  // 奨励会から四段になってデビューしたときは、奨励会からの朝の場面(18章。見た印は同じ'pro-debut')。
  if (!played && !state.pending && !(state.history?.length) && !seenProYearScene(state, 'pro-debut')) {
    return state.origin?.kind === 'shoreikai'
      ? { key: 'pro-debut', id: 'pro-debut-shoreikai', vars: originSceneVars(state.origin) }
      : { key: 'pro-debut', id: 'pro-debut', vars: {} };
  }
  const pending = state.pending;
  if (!pending || pending.kind === 'study' || pending.kind === 'shidou') return null;
  const opponent = state.players?.[pending.opponentId];
  const rival = proYearRival(opponent);
  // 研究会でその相手と指したことがあるか(羽音の「研究会では何度も指した」の1行。23章)。
  const studyRecord = state.study?.records?.[pending.opponentId];
  const studied = Boolean(studyRecord && (studyRecord.w ?? 0) + (studyRecord.l ?? 0) + (studyRecord.d ?? 0) > 0);
  const vars = {
    title: pending.titleName ?? '', holder: opponent?.name ?? '', event: pending.eventText ?? '', round: pending.label ?? '',
    study: studied ? STUDY_LINES.pro.studied : STUDY_LINES.pro.fresh, studyBig: studied ? STUDY_LINES.big.studied : STUDY_LINES.big.fresh,
  };
  const event = String(pending.gameId && state.games?.[pending.gameId]?.event || '');
  const firstGame = pending.kind === 'finals' && pending.series && (pending.series.games?.length ?? 0) === 0;
  const due = (key, id, extra = {}) => (seenProYearScene(state, key) ? null : { key, id, vars: { ...vars, ...extra } });
  if (rival) {
    // 羽音・善彦との番勝負の前夜(22-3の2)。永世称号がかかる防衛戦は、見たことがあっても記録の1行をつけて出す。
    if (firstGame) {
      const id = `pro-${pending.defense ? 'defense' : 'title'}-eve-${rival}`;
      const eternal = pending.defense ? pending.titleStakes?.eternal ?? null : null;
      const record = eternal && !eternal.reached && eternal.left === 1 ? `この番勝負を勝てば、${eternal.name}の資格に届く。` : '';
      return due(`${id}:${event}${record ? ':eternal' : ''}`, id, { holder: '', record });
    }
    // 公式戦ではじめて当たる対局(番勝負の途中でも、公式戦がもう終わっていれば出さない)。
    if (!metInOfficialGame(state, pending.opponentId)) {
      const met = due(rival === 'hanane' ? 'pro-hanane' : 'pro-yoshihiko', rival === 'hanane' ? 'pro-hanane' : 'pro-yoshihiko');
      if (met) return met;
    }
    // 羽音との大一番(決勝・挑戦者決定戦など。番勝負の対局は封じ手の夜と前夜にまかせる)。棋戦ごとに1回。
    if (rival === 'hanane' && pending.kind !== 'finals' && pending.stakes?.boss) return due(`pro-hanane-big:${event}`, 'pro-hanane-big');
    return null;
  }
  if (!firstGame) return null;
  // 防衛戦は受けて立つ側の前夜(20-3の1・2)。挑戦者向けの前夜は出さない(「保持者」に挑戦者の名前が入って逆さまになるため)。
  if (pending.defense) {
    const defenseVars = { ...vars, holder: '', challenger: opponent?.name ?? '' };
    const eternal = pending.titleStakes?.eternal ?? null;
    const eternalKey = `pro-defense-eternal:${event}`;
    if (eternal && !eternal.reached && eternal.left === 1 && !seenProYearScene(state, eternalKey)) {
      return { key: eternalKey, id: 'pro-defense-eternal', vars: { ...defenseVars, eternal: eternal.name } };
    }
    const key = `pro-defense-eve:${event}`;
    return seenProYearScene(state, key) ? null : { key, id: 'pro-defense-eve', vars: defenseVars };
  }
  const key = `pro-title-eve:${event}`;
  if (!seenProYearScene(state, key)) return { key, id: 'pro-title-eve', vars };
  return null;
}

/**
 * 番勝負が終わったあとの節目の夜(連覇・永世称号・全冠制覇・失冠。20-3の4)。保存の`sceneQueue`に積んだもののうち、
 * まだ見ていない最初の場面。結果の札を見終えたあと、1年の画面で出す。
 * @param {any} state
 * @returns {{ key: string, id: string, vars: Record<string, string> } | null}
 */
export function queuedProYearScene(state) {
  const queue = Array.isArray(state?.sceneQueue) ? state.sceneQueue.map((item) => rivalQueued(state, item)) : [];
  return queue.find((item) => item?.key && item.id in PRO_YEAR_SCENES && !seenProYearScene(state, item.key)) ?? null;
}

/**
 * 22章より前の版で積んだ失冠の夜(`pro-title-lost`)のうち、タイトルを取ったのが羽音・善彦のものを、相手ごとの場面に読みかえる
 * (docs/pro-year-design.mdの23章。羽音に取られた夜に、羽音が慰めの電話をかけてこないように)。見た印の鍵も読みかえる。
 * @param {any} state
 * @param {any} item
 */
function rivalQueued(state, item) {
  if (item?.id !== 'pro-title-lost' || !item.vars?.challenger) return item;
  const winner = Object.values(state?.players ?? {}).find((player) => player?.name === item.vars.challenger);
  const rival = proYearRival(winner);
  if (!rival) return item;
  const id = `pro-lost-${rival}`;
  const title = item.vars.title ?? '';
  return {
    key: `${id}:${String(item.key).split(':').slice(1).join(':')}`,
    id,
    vars: { title, result: rivalResultText({ rival, kind: 'lost', title: title || 'タイトル' }) },
  };
}

/**
 * 節目の夜を積む(見た場面は消し、多くて6つ)。stateを書き換える(pro-year.mjsのsettleUserTitle・noteCrownsから)。
 * @param {any} state
 * @param {{ key: string, id: string, vars?: Record<string, string> }} item
 */
export function queueProYearScene(state, item) {
  if (!state || !item?.key || seenProYearScene(state, item.key)) return;
  const queue = (Array.isArray(state.sceneQueue) ? state.sceneQueue : []).filter((entry) => entry.key !== item.key && !seenProYearScene(state, entry.key));
  state.sceneQueue = [...queue, { key: item.key, id: item.id, vars: { ...(item.vars ?? {}) } }].slice(-6);
}

/** 連覇の夜を出す連覇の数(3連覇と、5の倍数。20-3の4)。 */
export const isStreakSceneMark = (streak) => streak === 3 || (streak >= 5 && streak % 5 === 0);
