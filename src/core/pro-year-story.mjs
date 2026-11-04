// 棋士の1年の物語の場面(docs/pro-year-design.mdの12章)。デビューの日・羽音との公式戦・タイトル戦の前夜。
// 台本の形は団体戦と同じ(team-story.mjs。NovelScene.vueで見せる)。物語のストーリー選択のサブからも読み直せる。
// 羽音は敬語と「！」を使わない(docs/hanane-character.md)。百花は明るく「！」を使う。ノベルのミステリーの部分は使わない。
// 遊びを止めない(D:8-2)ので、どの場面も12行まで。

import { NOVEL_PEOPLE, sceneText } from './team-story.mjs';
import { HANANE } from './ryuo-story.mjs';

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
});

/** ストーリー選択から読み直すときに、そのときの対局がないので入れる言葉。 */
const DEFAULT_VARS = Object.freeze({ title: 'タイトル', holder: 'タイトル保持者の', event: '棋戦', round: '本戦' });

/**
 * 場面を画面に出す形にする(名前と、棋戦の言葉を差し込む)。
 * @param {string} id
 * @param {{ playerName?: string, momokaCall?: string, vars?: { title?: string, holder?: string, event?: string, round?: string } }} [options]
 */
export function proYearScene(id, { playerName = '', momokaCall = '', vars = {} } = {}) {
  const scene = PRO_YEAR_SCENES[/** @type {keyof typeof PRO_YEAR_SCENES} */ (id)];
  if (!scene) return null;
  const words = { ...DEFAULT_VARS, ...Object.fromEntries(Object.entries(vars).filter(([, value]) => value)) };
  const fill = (text) => sceneText(text, playerName, momokaCall).replace(/\{(title|holder|event|round)\}/g, (_, key) => words[key]);
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
  if (!played && !state.pending && !(state.history?.length) && !seenProYearScene(state, 'pro-debut')) return { key: 'pro-debut', id: 'pro-debut', vars: {} };
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
