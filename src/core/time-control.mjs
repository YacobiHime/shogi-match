// 大会の対局の持ち時間(docs/tournament-match-presence-design.mdの15章)。画面と保存の仕組みに依存しない。
// 持ち時間の長さは、実際の大会の決まり(公開されている持ち時間)に合わせる。考慮時間(NHK杯・JT杯)は入れない。
// プレイヤーは時間を使い切っても負けにしない(秒読みの0秒で「時間いっぱい」。Game 4-1)。
// 相手(CPU)は、1手ごとに「考えた時間」を決めて持ち時間から引き、残りが少ないと読みが浅く、秒読みでは手が荒くなる。

/** 時間の決まり。main=持ち時間(秒)、byoyomi=使い切ったあとの1手の秒、increment=1手ごとに足す秒(フィッシャー)。 */
const rule = (main, byoyomi, increment = 0, days = 1) => Object.freeze({ main, byoyomi, increment, days });
const H = 3600;
const M = 60;

/** 決まりの名前ごとの表(同じ長さの大会は同じ決まりを使う)。 */
export const TIME_RULES = Object.freeze({
  h9: rule(9 * H, 60, 0, 2),
  h8: rule(8 * H, 60, 0, 2),
  h6: rule(6 * H, 60),
  h5: rule(5 * H, 60),
  h4: rule(4 * H, 60),
  h3: rule(3 * H, 60),
  h1: rule(1 * H, 60),
  m90: rule(90 * M, 60),
  m40: rule(40 * M, 60),
  m30: rule(30 * M, 30),
  m10: rule(10 * M, 30),
  fischer: rule(5 * M, 0, 5),
});

/**
 * 棋士の1年の棋戦の、段階ごとの決まり(pro-year.mjsのPRO_EVENTSの棋戦のidと段階のid)。
 * 実際の棋戦の持ち時間(予選・本戦・番勝負)に合わせる。
 */
export const PRO_EVENT_RULES = Object.freeze({
  eio: { q: 'h1', main: 'h3', title: 'h4' },
  meijin: { junni: 'h6', title: 'h9' },
  kisei: { q1: 'h1', q2: 'h3', main: 'h4', title: 'h4' },
  oi: { q: 'h4', league: 'h4', playoff: 'h4', title: 'h8' },
  oza: { q1: 'h5', q2: 'h5', main: 'h5', title: 'h5' },
  ryuo: { ranking: 'h5', main: 'h5', title: 'h8' },
  osho: { q1: 'h3', q2: 'h3', league: 'h4', title: 'h8' },
  kio: { q: 'h3', main: 'h4', title: 'h4' },
  nhk: { q: 'm10', main: 'm10' },
  asahi: { q1: 'm40', q2: 'm40', main: 'm40' },
  shinjin: { main: 'h3', final: 'h3' },
  jt: { main: 'm10' },
});

/** 決まりの言葉(「持ち時間5時間・秒読み1分」)。 */
export function timeRuleText(control) {
  if (!control) return '';
  const main = control.main >= H && control.main % H === 0 ? `${control.main / H}時間`
    : control.main >= H ? `${Math.floor(control.main / H)}時間${Math.round((control.main % H) / M)}分` : `${Math.round(control.main / M)}分`;
  if (control.increment) return `持ち時間${main}・1手ごとに${control.increment}秒加算`;
  const byoyomi = control.byoyomi >= 60 ? `${control.byoyomi / 60}分` : `${control.byoyomi}秒`;
  return `持ち時間${main}・秒読み${byoyomi}${control.days === 2 ? '（二日制）' : ''}`;
}

const withName = (key) => (key && TIME_RULES[key] ? { key, ...TIME_RULES[key], text: timeRuleText(TIME_RULES[key]) } : null);

/**
 * 大会の対局の決まり。持ち時間のない対局(研究会の練習対局・まつりの指導対局・仕事の指導)はnull。
 * @param {{ event?: string, season?: any }} options eventは対局画面のryuoGame.event、seasonは対局画面に渡る期の形
 */
export function tournamentTimeControl({ event = '', season = null } = {}) {
  const pending = season?.pending ?? null;
  if (!pending) return null;
  const kind = pending.kind ?? 'game';
  if (event === 'ryuo') return withName(kind === 'finals' ? 'h8' : 'h5');
  if (event === 'meijin') return withName(kind === 'finals' ? 'h9' : 'h6');
  if (event === 'shoreikai') return withName('m90');
  if (event === 'kenshukai') return withName('m30');
  if (event === 'team') return withName(season?.format === 'pro' ? 'fischer' : 'm30');
  if (event === 'pro-year') {
    if (kind === 'study' || kind === 'shidou') return null;
    // 棋戦と段階は、対局の写し(pending.eventId・stageId)から。前の版の保存にはないので、5時間にする。
    const game = pending.gameId ? season?.games?.[pending.gameId] : null;
    const eventId = pending.eventId ?? game?.event ?? '';
    return withName(PRO_EVENT_RULES[eventId]?.[pending.stageId ?? ''] ?? 'h5');
  }
  return null;
}

// ---- 時計の状態(1手ごとの残り。待ったで戻せるよう、手数ごとに残す)

/**
 * 時計を作る。usedPliesは、勝負どころから指すときに、そこまでに指したとみなす手数(使った分を引いておく)。
 * @param {{ main: number }} control
 * @param {{ usedPlies?: number }} [options]
 */
export function createClock(control, { usedPlies = 0 } = {}) {
  // 途中の局面から指すときは、手数に応じて使った分を引く(140手で使い切る見込みの、ふつうの減り方)。
  const used = usedPlies > 0 ? Math.min(0.85, usedPlies / 140) : 0;
  const left = Math.round(control.main * (1 - used));
  return { startPly: 0, marks: { 0: { black: left, white: left } } };
}

/** その手数の残り(なければ、その前でいちばん近い手数の残り)。 */
export function clockAt(clock, ply) {
  if (!clock?.marks) return null;
  let best = null;
  let bestPly = -1;
  for (const [key, value] of Object.entries(clock.marks)) {
    const at = Number(key);
    if (at <= ply && at > bestPly) {
      best = value;
      bestPly = at;
    }
  }
  return best ? { ...best } : null;
}

/**
 * 1手を時計に記録する。plyは指したあとの手数、sideは指した側、spentは考えた秒。
 * 持ち時間を使い切ったら0(以後は秒読み)。フィッシャーは、指すたびに足す。
 * @param {{ startPly: number, marks: Record<string, { black: number, white: number }> }} clock
 * @param {{ ply: number, side: 'black' | 'white', spent: number, control: { main: number, byoyomi: number, increment?: number } }} move
 */
export function commitClock(clock, { ply, side, spent, control }) {
  const before = clockAt(clock, ply - 1) ?? { black: control.main, white: control.main };
  const left = Math.max(0, before[side] - Math.max(0, Math.round(spent)));
  const next = { ...before, [side]: control.increment ? left + control.increment : left };
  // 待ったで戻した先の手数より後ろの記録は捨てる。
  const marks = Object.fromEntries(Object.entries(clock.marks).filter(([key]) => Number(key) < ply));
  return { ...clock, marks: { ...marks, [ply]: next } };
}

/**
 * 保存から戻した時計を確かめる(形が違えばnull)。
 * @param {any} value
 * @returns {{ startPly: number, marks: Record<string, { black: number, white: number }> } | null}
 */
export function restoreClock(value) {
  if (!value || typeof value !== 'object' || !value.marks || typeof value.marks !== 'object') return null;
  /** @type {Record<string, { black: number, white: number }>} */
  const marks = {};
  for (const [key, entry] of Object.entries(value.marks)) {
    const ply = Number(key);
    if (!Number.isInteger(ply) || ply < 0 || !entry) continue;
    const black = Number(entry.black);
    const white = Number(entry.white);
    if (Number.isFinite(black) && Number.isFinite(white)) marks[ply] = { black: Math.max(0, black), white: Math.max(0, white) };
  }
  if (!Object.keys(marks).length) return null;
  return { startPly: Number.isInteger(value.startPly) ? value.startPly : 0, marks };
}

/**
 * プレイヤーの手番の時計の見え方。usedは、この手番で使った秒。
 * 持ち時間が残っていれば残り、使い切ったら秒読みの残り(0で「時間いっぱい」。負けにはしない)。
 */
export function playerClockView(left, used, control) {
  const remaining = Math.max(0, left - used);
  if (remaining > 0 || control.increment) return { remaining, byoyomi: false, byoyomiLeft: 0 };
  const over = Math.max(0, used - left);
  return { remaining: 0, byoyomi: true, byoyomiLeft: Math.max(0, control.byoyomi - over) };
}

// ---- 相手(CPU)の考えた時間

/** 1手の考えた時間の、局面ごとの重み(中継の時計と同じ考え方。relay-game.mjsのcreateRelayClock)。 */
const PHASE_WEIGHT = { opening: 0.45, middle: 1.35, ending: 0.85 };
/** この手数より前は序盤(定跡の手はすぐ指す)。 */
const OPENING_PLY = 24;
/** この手数から終盤。 */
const ENDING_PLY = 90;
/** 対局の終わりの見込みの手数。 */
const EXPECTED_END = 130;
/** 残りがこの割合を切ったら「時間が少ない」。 */
export const LOW_TIME_RATIO = 0.1;

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
function gauss(rng) {
  const u = Math.max(1e-9, rng.next());
  const v = rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const traitDegree = (character, id) => {
  const trait = character?.traits?.find((entry) => entry.id === id);
  return trait ? (trait.degree === 2 ? 2 : 1) : 0;
};

/**
 * 相手のこの1手で考える時間と、時間の重圧。
 * pressureは calm(ふつう)・long(長考。読みが冴える)・low(残りが少ない)・byoyomi(秒読み)。
 * @param {{ control: { main: number, byoyomi: number, increment?: number }, left: number, ply: number, rng: { next(): number }, character?: any }} options
 * @returns {{ seconds: number, pressure: 'calm' | 'long' | 'low' | 'byoyomi', short: boolean }}
 */
export function cpuThinkPlan({ control, left, ply, rng, character = null }) {
  const short = control.increment ? true : control.byoyomi <= 30;
  const byoyomiThink = () => Math.round(clamp(control.byoyomi * (0.4 + rng.next() * 0.55), 2, Math.max(2, control.byoyomi - 1)));
  if (left <= 0 && !control.increment) return { seconds: byoyomiThink(), pressure: 'byoyomi', short };
  const phase = ply < OPENING_PLY ? 'opening' : ply < ENDING_PLY ? 'middle' : 'ending';
  const movesLeft = Math.max(6, (EXPECTED_END - ply) / 2);
  const trouble = traitDegree(character, 'time-trouble');
  const reading = clamp(Number(character?.abilities?.reading) || 0, -30, 30);
  // 読みの力がある棋士ほど、じっくり考える(中継の時計と同じ)。時間に追われる棋士は中盤で使いすぎる。
  const tempo = Math.exp(reading / 60) * (phase === 'middle' && trouble ? 1.3 + 0.3 * trouble : 1);
  const budget = left / movesLeft + (control.increment ?? 0) * 0.8;
  let seconds = budget * PHASE_WEIGHT[phase] * tempo * Math.exp(gauss(rng) * 0.55);
  let long = false;
  // ときどき長考(目安の2.5〜5.5倍)。
  if (ply >= OPENING_PLY && rng.next() < 0.08) {
    seconds *= 2.5 + rng.next() * 3;
    long = true;
  }
  seconds = Math.max(1, Math.round(Math.min(seconds, left * 0.4 + control.byoyomi * 0.5, 3 * 3600)));
  if (!control.increment && seconds >= left) {
    // 持ち時間を使い切って、秒読みの中で指した。
    return { seconds: left + byoyomiThink(), pressure: 'byoyomi', short };
  }
  if (control.increment) seconds = Math.min(seconds, Math.max(1, left + control.increment - 1));
  const after = left - seconds;
  if (after < control.main * LOW_TIME_RATIO || (control.increment && left < 30)) return { seconds, pressure: 'low', short };
  return { seconds, pressure: long ? 'long' : 'calm', short };
}

/**
 * 時間の重圧を、棋風の特徴と同じつまみ(探索量の倍率nodes・手の選び方の冴えsharpen)にする(player-character.mjsのapplyCharacter)。
 * 秒読みが短いほど、浅く読み、手が荒くなる。長考の手は、少し冴える。
 * @param {{ pressure?: string, short?: boolean } | null | undefined} clock
 */
export function clockEffect(clock) {
  switch (clock?.pressure) {
    case 'byoyomi': return clock.short ? { nodes: 0.6, sharpen: -0.45 } : { nodes: 0.75, sharpen: -0.3 };
    case 'low': return { nodes: 0.88, sharpen: -0.15 };
    case 'long': return { nodes: 1, sharpen: 0.2 };
    default: return null;
  }
}

// ---- 相手の時計の早送り(考えているあいだ、時計が爆速で減る)

/** 早送りの見込みの長さ(秒)。長く考えた手ほど、長く回す(1手で回し終える長さの上限つき)。 */
export function fastForwardSeconds(spent) {
  return clamp(0.7 + Math.log10(1 + Math.max(0, spent) / 30) * 0.55, 0.7, 2.2);
}

/**
 * 早送りの進み(0〜1)。見込みの長さで、ほぼ回し終える(緩やかに近づく)。
 * @param {number} elapsed 考え始めてからの実際の秒
 * @param {number} spent この手で使う持ち時間の秒
 */
export function fastForwardProgress(elapsed, spent) {
  const tau = fastForwardSeconds(spent) / 3;
  return clamp(1 - Math.exp(-Math.max(0, elapsed) / tau), 0, 1);
}

/** 時計の言葉(1:23:45・12:34)。 */
export function clockText(seconds) {
  const value = Math.max(0, Math.round(seconds));
  const h = Math.floor(value / 3600);
  const m = Math.floor((value % 3600) / 60);
  const s = value % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
