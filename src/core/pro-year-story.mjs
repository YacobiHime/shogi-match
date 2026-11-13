// 棋士の1年の物語の場面(docs/pro-year-design.mdの12章)。デビューの日・羽音との公式戦・タイトル戦の前夜。
// 台本の形は団体戦と同じ(team-story.mjs。NovelScene.vueで見せる)。物語のストーリー選択のサブからも読み直せる。
// 羽音は敬語と「！」を使わない(docs/hanane-character.md)。百花は明るく「！」を使う。ノベルのミステリーの部分は使わない。
// 遊びを止めない(D:8-2)ので、どの場面も12行まで。

import { NOVEL_PEOPLE, sceneText } from './team-story.mjs';
import { HANANE } from './ryuo-story.mjs';
import { originSceneVars } from './pro-year-origin.mjs';

/** 台本の1行。fxは演出(docs/novel-scene-design.mdの12章、書き方はdocs/novel-authoring-guide.md)。 */
const line = (who, face, text, fx = {}) => Object.freeze({ who, face, text, ...fx });

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
    summary: '羽音と公式戦ではじめて当たる日。研究会では何度も指したが、今日のは記録に残る1局。二人そろって一礼し、対局が始まる。',
    background: 'venue',
    cast: ['hanane'],
    lines: [
      line('narration', 'neutral', '{event} {round}。対局室に入ると、羽音がもう座っていた。'),
      line('hanane', 'neutral', '公式戦で当たるのは、はじめてだね。'),
      line('hanane', 'neutral', '研究会では何度も指したけど、今日のは記録に残る1局。'),
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
});

/**
 * 封じ手の夜の場面(docs/seal-break-design.mdの2-5)。番勝負の星から、リード・タイ・カド番のどれかの場面のid。
 * @param {{ winsUser: number, winsOpponent: number, need: number }} series
 */
export function proYearSealSceneId({ winsUser = 0, winsOpponent = 0, need = 0 } = {}) {
  if (need > 0 && winsOpponent >= need - 1 && winsOpponent > winsUser) return 'pro-seal-kado';
  if (winsUser > winsOpponent) return 'pro-seal-lead';
  return 'pro-seal-tie';
}

/**
 * ストーリー選択から読み直すときに、そのときの対局がないので入れる言葉。
 * 奨励会からのデビューの言葉(date・kishi・mentor・peers・half。18章)は、記録がなくても読める既定の言葉か空。
 */
const DEFAULT_VARS = Object.freeze({
  title: 'タイトル', holder: 'タイトル保持者の', event: '棋戦', round: '本戦',
  date: 'デビューの日', kishi: '', mentor: '師匠', peers: '仲間', half: '',
});

/**
 * 場面を画面に出す形にする(名前と、棋戦の言葉を差し込む)。
 * @param {string} id
 * @param {{ playerName?: string, momokaCall?: string, vars?: { title?: string, holder?: string, event?: string, round?: string, date?: string, kishi?: string, mentor?: string, peers?: string, half?: string } }} [options]
 */
export function proYearScene(id, { playerName = '', momokaCall = '', vars = {} } = {}) {
  const scene = PRO_YEAR_SCENES[/** @type {keyof typeof PRO_YEAR_SCENES} */ (id)];
  if (!scene) return null;
  const words = { ...DEFAULT_VARS, ...Object.fromEntries(Object.entries(vars).filter(([, value]) => value)) };
  const fill = (text) => sceneText(text, playerName, momokaCall).replace(/\{(title|holder|event|round|date|kishi|mentor|peers|half)\}/g, (_, key) => words[key]);
  return {
    id: scene.id,
    title: scene.title,
    summary: fill(scene.summary),
    background: scene.background,
    cast: [...scene.cast],
    // 演出の欄もそのまま渡す。
    lines: scene.lines.map((entry) => ({
      ...entry,
      name: NOVEL_PEOPLE[/** @type {keyof typeof NOVEL_PEOPLE} */ (entry.who)]?.name ?? '',
      text: fill(entry.text),
    })),
  };
}

/** 見た場面の印(state.scenes)。タイトル戦の前夜は、タイトルごとに1回(`pro-title-eve:<棋戦>`)。 */
export const seenProYearScene = (state, key) => Array.isArray(state?.scenes) && state.scenes.includes(key);

/** 場面を見た印をつける(state.scenesに足す。保存はpro-year:v1のまま)。 */
export function markProYearScene(state, key) {
  if (!state || !key || seenProYearScene(state, key)) return state;
  return { ...state, scenes: [...(Array.isArray(state.scenes) ? state.scenes : []), key] };
}

/**
 * いま見せる場面(なければnull)。デビューの日は、まだ1局も指していない1年目に1回。羽音との場面は、公式戦ではじめて当たる対局の前に1回。
 * タイトル戦の前夜は、そのタイトルの番勝負の第1局の前に、タイトルごとに1回(相手が羽音のときは羽音の場面を先に)。
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
  const vars = { title: pending.titleName ?? '', holder: opponent?.name ?? '', event: pending.eventText ?? '', round: pending.label ?? '' };
  if (opponent?.story === HANANE) return seenProYearScene(state, 'pro-hanane') ? null : { key: 'pro-hanane', id: 'pro-hanane', vars };
  const event = String(pending.gameId && state.games?.[pending.gameId]?.event || '');
  const firstGame = pending.kind === 'finals' && pending.series && (pending.series.games?.length ?? 0) === 0;
  const key = `pro-title-eve:${event}`;
  if (firstGame && !seenProYearScene(state, key)) return { key, id: 'pro-title-eve', vars };
  return null;
}
