// ホームの「つぎはこれ」の段階3(docs/home-next-adaptive-design.mdの15章)。
// その日初めての「今日の1局」と、まだ開いたことのない遊びの紹介。画面に依存しない。

/** 開いたことのある遊びを覚える鍵。 */
export const SEEN_FEATURES_KEY = 'yacobihime:shogi-match:seen-features:v1';

/** まだ見ていない遊びを紹介する順と、カードの見出し・1行。 */
export const DISCOVER_FEATURES = Object.freeze([
  { id: 'endgame', title: '終盤戦をやってみよう', reason: '名局の終盤の局面から、すぐ指せるよ。まだ遊んでいないね' },
  { id: 'opening-dex', title: '定跡図鑑をのぞいてみよう', reason: '戦法と囲いの組み方を、1手ずつ再生して見られるよ' },
  { id: 'brain', title: '脳トレをやってみよう', reason: '盤をちらっと見て当てる、局面を覚えて並べる。5分で終わるよ' },
  { id: 'tesuji', title: '手筋図鑑をのぞいてみよう', reason: '叩きの歩や割り打ちの銀。知っていると一気に強くなるよ' },
  { id: 'world', title: '将棋界図鑑をのぞいてみよう', reason: 'タイトル戦や名局のこと。AIの解析つきで並べられるよ' },
  { id: 'piece', title: '駒図鑑をのぞいてみよう', reason: '駒の動きと値段を、もう一度たしかめよう' },
  { id: 'glossary', title: '用語辞典を開いてみよう', reason: '「筋違い角」「穴熊」…気になる言葉を引けるよ' },
  { id: 'measure', title: '棋力を測ってみよう', reason: '1局指すと、やこび姫が今の棋力を見立てるよ' },
]);
const FEATURE_IDS = new Set(DISCOVER_FEATURES.map(({ id }) => id));
/** まだ見ていない遊びを勧める、レーティングの対局数の間隔。 */
export const DISCOVER_EVERY = 3;

/** 開いたことのある遊びのID。読めない値は捨てる。 */
export function loadSeenFeatures(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(SEEN_FEATURES_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((id) => FEATURE_IDS.has(id)) : [];
  } catch {
    return [];
  }
}

/** 遊びを開いたことを残す。新しく残したら真。 */
export function markFeatureSeen(storage, id) {
  if (!FEATURE_IDS.has(id)) return false;
  const seen = loadSeenFeatures(storage);
  if (seen.includes(id)) return false;
  try {
    storage?.setItem(SEEN_FEATURES_KEY, JSON.stringify([...seen, id]));
  } catch {
    // 保存できなくても、遊びは開ける。
  }
  return true;
}

/**
 * まだ見ていない遊びの紹介。今日1局以上指していて、レーティングの対局数が3の倍数のときだけ(同じ状態なら同じカード)。
 * @param {{ seen: string[], games: number, playedToday: boolean, measured?: boolean }} input
 *   measuredは、棋力を測った記録があるか(あれば棋力測定は見たことにする)
 * @returns {{ id: string, title: string, reason: string } | null}
 */
export function discoveryPlan({ seen, games, playedToday, measured = false }) {
  if (!playedToday || games < DISCOVER_EVERY || games % DISCOVER_EVERY !== 0) return null;
  const known = new Set(seen);
  if (measured) known.add('measure');
  return DISCOVER_FEATURES.find(({ id }) => !known.has(id)) ?? null;
}

/**
 * 今日の1局。今日まだ1局も指していなければ、見出しと1行。続けている日があれば日数、途切れていれば「おかえり！」。
 * @param {{ playedToday: boolean, streak: number, level: number, everPlayed: boolean }} input
 *   streakは、昨日までで続けて遊んだ日の数(play-streak.mjsのcurrentStreak)、everPlayedは今までに遊んだことがあるか
 * @returns {{ title: string, reason: string } | null}
 */
export function todayPlan({ playedToday, streak, level, everPlayed }) {
  if (playedToday) return null;
  if (streak >= 1) {
    const days = streak + 1;
    return { title: '今日の1局', reason: `${days}日続けて指そう。今日もLv.${level}と1局` };
  }
  return { title: '今日の1局', reason: everPlayed ? `おかえり！ Lv.${level}と、肩ならしに1局` : `Lv.${level}と、今日の1局を指そう` };
}

/**
 * あと少しのご褒美の1行(「対局する」の言い換えの候補)。
 * @param {{ level: number, wonLevels: number[], themeRemaining: number | null }} input
 * @returns {string[]}
 */
export function nearRewardLines({ level, wonLevels, themeRemaining }) {
  const lines = [];
  if (level >= 1 && !wonLevels.includes(level)) lines.push(`Lv.${level}にはまだ勝っていないね。初めて勝つと★がもらえるよ`);
  if (themeRemaining !== null && themeRemaining >= 1 && themeRemaining <= 2) lines.push(`次の着せ替えまで、印あと${themeRemaining}個。新しい戦法や囲いを組むと増えるよ`);
  return lines;
}
