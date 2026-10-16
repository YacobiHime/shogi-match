/**
 * 竜王戦の応援(段階5)。推しの棋士と、組優勝の予想。
 * 観戦は、どちらかに肩入れすると面白くなる(Game_Nintendo_Design.mdの8-3『応援する楽しみ』)。
 * 予想の見返りは小さくし(当たったら記録に残るだけ)、肩入れする理由として使う。
 *
 * 画面に依存しない。期の様子は、describeSeason(core/ryuo.mjs)が作る表示用の内容から読む。
 */

export const OSHI_STORAGE_KEY = 'yacobihime:shogi-match:ryuo-oshi';
export const PREDICTION_STORAGE_KEY = 'yacobihime:shogi-match:ryuo-prediction';

/** 推しの棋士のID。いなければ空文字。 */
export function loadOshi(storage) {
  try {
    const id = storage?.getItem(OSHI_STORAGE_KEY);
    return typeof id === 'string' ? id : '';
  } catch {
    return '';
  }
}

export function saveOshi(storage, id) {
  try {
    if (id) storage?.setItem(OSHI_STORAGE_KEY, id);
    else storage?.removeItem?.(OSHI_STORAGE_KEY);
  } catch {
    // 保存できない環境では、この画面の間だけ使う。
  }
}

/**
 * 棋士の個性を一言で(4-7『平均と平凡は同じ』、8-1『キャラ立ち』)。棋風に、いちばん目立つ特徴を1つ添える。
 * 「とても」の付く特徴を先に選ぶ。特徴がなければ棋風だけ。
 * @param {{ style: string, strengths: string[], weaknesses: string[] }} described describeCharacter(core/player-character.mjs)の結果
 */
export function characterCatchphrase(described) {
  const pick = (list) => list.find((text) => text.includes('とても') || text.includes('まったく')) ?? list[0];
  const feature = pick(described.strengths) ?? pick(described.weaknesses);
  return feature ? `${described.style}・${feature}` : described.style;
}

/** 台詞での呼び方。プレイヤーは「あなた」、棋士は「◯◯さん」。 */
const callName = (brief) => (!brief ? '' : brief.id === 'user' ? 'あなた' : `${brief.name}さん`);

/**
 * 期の中の、推しの棋士の対局。トーナメント表(ランキング戦・敗者復活戦・決勝トーナメント)と番勝負を、進む順に見る。
 * 推しがこの期に出ていなければnull。
 * @param {any} view describeSeason(core/ryuo.mjs)の結果
 * @param {string} oshiId
 * @returns {{ games: { win: boolean, opponent: string, label: string }[], wins: number, losses: number, alive: boolean, champion: boolean } | null}
 */
export function oshiSeasonStatus(view, oshiId) {
  if (!view || !oshiId) return null;
  const games = [];
  let appears = false;
  let waiting = false;
  for (const table of view.tables ?? []) {
    for (const round of table.rounds ?? []) {
      for (const match of round.matches ?? []) {
        const side = match.a?.id === oshiId ? 'a' : match.b?.id === oshiId ? 'b' : null;
        if (!side) continue;
        appears = true;
        const opponent = callName(side === 'a' ? match.b : match.a);
        if (match.winner) games.push({ win: match.winner === oshiId, opponent, label: `${table.title} ${round.label}`.trim() });
        else waiting = true;
      }
    }
  }
  for (const series of view.series ?? []) {
    const side = series.a?.id === oshiId ? 'a' : series.b?.id === oshiId ? 'b' : null;
    if (!side) continue;
    appears = true;
    const opponent = callName(side === 'a' ? series.b : series.a);
    if (series.winner) games.push({ win: series.winner === oshiId, opponent, label: series.label });
    else waiting = true;
  }
  if (!appears) return null;
  const wins = games.filter(({ win }) => win).length;
  const last = games.at(-1);
  const champion = view.champion?.id === oshiId;
  return { games, wins, losses: games.length - wins, alive: champion || waiting || !last || last.win, champion };
}

/**
 * やこび姫が話す、推しの棋士の様子。
 * @param {ReturnType<typeof oshiSeasonStatus>} status
 * @param {string} name
 */
export function oshiSeasonLine(status, name) {
  if (!status) return `推しの${name}さんは、ほかの組で戦っているよ。期が終わったら、やこびノートの棋士名鑑で成績を見てみよう！`;
  if (status.champion) return `推しの${name}さんが、竜王になったよ！ ずっと応援してきたかいがあったね！`;
  const last = status.games.at(-1);
  if (!last) return `推しの${name}さんは、まだ対局前だよ。いっしょに応援しよう！`;
  if (!status.alive) return `推しの${name}さんは、${last.label}で${last.opponent}に敗れて、今期はここまで…。また来期を応援しよう！`;
  return `推しの${name}さん、${last.label}で${last.opponent}に勝ったよ！（今期${status.wins}勝${status.losses}敗）`;
}

// ---- 組優勝の予想

/** 予想。seasonは期の名前(第◯期竜王戦)、pidは予想した棋士(プレイヤー自身は'user')。 */
export function loadPrediction(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(PREDICTION_STORAGE_KEY) ?? 'null');
    return parsed && typeof parsed.season === 'string' && typeof parsed.pid === 'string'
      ? { season: parsed.season, pid: parsed.pid, name: String(parsed.name ?? ''), counted: parsed.counted === true }
      : null;
  } catch {
    return null;
  }
}

export function savePrediction(storage, prediction) {
  try {
    storage?.setItem(PREDICTION_STORAGE_KEY, JSON.stringify(prediction));
  } catch {
    // 保存できない環境では、この画面の間だけ使う。
  }
}

/** ランキング戦の表(組の優勝を決める表)。 */
function rankingTable(view) {
  return (view?.tables ?? []).find(({ key }) => key === 'ranking') ?? null;
}

/**
 * 予想できるか。プレイヤーのランキング戦の1局目が決まる前だけ。
 * 期に入るとほかの対局は先に進むので、選べるのはまだ負けていない棋士(プレイヤーを含む)だけにする。
 * @returns {{ id: string, name: string }[] | null} 予想できる棋士。できなければnull。
 */
export function predictionChoices(view) {
  const table = rankingTable(view);
  if (!table || view.phase !== 'ranking') return null;
  const matches = table.rounds.flatMap(({ matches }) => matches);
  const involvesUser = (match) => match.a?.id === 'user' || match.b?.id === 'user';
  if (matches.some((match) => match.winner && involvesUser(match))) return null;
  const out = new Set();
  for (const match of matches) {
    if (!match.winner) continue;
    for (const side of [match.a, match.b]) if (side?.id && side.id !== match.winner) out.add(side.id);
  }
  const players = new Map();
  for (const match of matches) {
    for (const side of [match.a, match.b]) {
      if (side?.id && !out.has(side.id)) players.set(side.id, side.id === 'user' ? 'あなた' : side.name);
    }
  }
  return [...players].map(([id, name]) => ({ id, name }));
}

/**
 * 予想の結果。組の優勝が決まる前はnull。
 * @returns {'hit' | 'miss' | null}
 */
export function predictionOutcome(view, prediction) {
  if (!prediction || prediction.season !== view?.title) return null;
  const table = rankingTable(view);
  const final = table?.rounds.flatMap(({ matches }) => matches).find(({ final }) => final);
  if (!final?.winner) return null;
  return final.winner === prediction.pid ? 'hit' : 'miss';
}

/** やこび姫が話す、予想の一言。 */
export function predictionLine(prediction, outcome) {
  const who = prediction.pid === 'user' ? 'あなた自身' : `${prediction.name}さん`;
  if (outcome === 'hit') return `組優勝の予想、${who}で大当たり！ 見る目があるね！`;
  if (outcome === 'miss') return `組優勝の予想（${who}）は、はずれちゃった。来期こそ当てよう！`;
  return `組優勝は${who}と予想したね。どうなるかな？`;
}
