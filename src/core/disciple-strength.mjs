// 師匠の1年(docs/disciple-mode-design.md)の、弟子の能力値・適性・戦い方・スキルを、将棋AIの設定と勝ち負けに換える部分(20章)。
// 画面と保存に依存しない。CPUの表は今の`strength-settings.mjs`(Lvごとの設定)と`human-model.mjs`(人間らしい選び方)をそのまま引く。
// - 能力値4つ(読み・作戦・安定・詰み。0〜1200)は、それぞれLv12〜49に換え、能力ごとに別のLvで設定の列を引く(19-2)。
// - 全体の強さは0.6×平均＋0.4×最低(いちばん弱い能力に引っ張られる。20-3)。
// - 適性(G〜A)は、対局ごとに能力に倍率を掛ける(20-4)。戦い方は指し方の向きだけ(強さは変えない。20-5)。
// - 観戦の見立て(崩れた手の理由の5択と狙い目。19-5)と、稽古の伸び(20-6)。

import { sourceLevelOf, sourceLevelSettings } from './strength-settings.mjs';

/** 能力値の並び(画面の順)。 */
export const STAT_KEYS = Object.freeze(['reading', 'plan', 'steady', 'mate']);
export const STAT_LABELS = Object.freeze({ reading: '読み', plan: '作戦', steady: '安定', mate: '詰み' });
/** 能力値の上限。 */
export const STAT_MAX = 1200;
/** 能力値0と上限のLv(間は直線。19-2)。 */
export const STAT_LEVEL_MIN = 12;
export const STAT_LEVEL_MAX = 49;
/** ランクの境目(20-6・19-7)。 */
export const STAT_RANKS = Object.freeze([
  ['SS', 1150], ['S', 1050], ['A', 900], ['B', 750], ['C', 600], ['D', 450], ['E', 300], ['F', 150], ['G', 0],
]);

const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));
const round1 = (value) => Math.round(value * 10) / 10;

/** 能力値のランク(G〜SS)。 */
export function statRank(value) {
  const v = Number(value) || 0;
  return STAT_RANKS.find(([, edge]) => v >= edge)?.[0] ?? 'G';
}

/** 能力値をLv(小数)に換える。0＝Lv12、1200＝Lv49。 */
export function statLevel(value) {
  const t = clamp(Number(value) || 0, 0, STAT_MAX) / STAT_MAX;
  return STAT_LEVEL_MIN + (STAT_LEVEL_MAX - STAT_LEVEL_MIN) * t;
}

/** 全体の強さのLv(小数)。0.6×平均＋0.4×最低(20-3)。 */
export function overallLevel(stats) {
  const levels = STAT_KEYS.map((key) => statLevel(stats?.[key]));
  const mean = levels.reduce((sum, level) => sum + level, 0) / levels.length;
  return 0.6 * mean + 0.4 * Math.min(...levels);
}

// ---- 適性(20-4)

/** 適性の段と、能力に掛ける倍率。 */
export const APTITUDE_RANKS = Object.freeze(['G', 'F', 'E', 'D', 'C', 'B', 'A']);
export const APTITUDE_SCALE = Object.freeze({ A: 1.05, B: 1, C: 0.95, D: 0.9, E: 0.85, F: 0.82, G: 0.8 });
/** 戦型の適性と持ち時間の適性。 */
export const APTITUDE_KEYS = Object.freeze(['static', 'ranging', 'aifuri', 'kakugawari', 'fast', 'long']);
export const APTITUDE_LABELS = Object.freeze({
  static: '対居飛車', ranging: '対振り飛車', aifuri: '相振り', kakugawari: '角換わり', fast: '早指し', long: '長時間',
});
/** 適性の目盛り(稽古で1目盛りずつ上がり、この数で1段上がる)。 */
export const APTITUDE_STEPS = 4;

/** 適性の倍率。分からない適性は1。 */
export const aptitudeScale = (rank) => APTITUDE_SCALE[rank] ?? 1;

/**
 * 対局の条件で、適性の倍率を掛けた能力値。戦型と持ち時間の倍率を両方掛ける。
 * @param {Record<string, number>} stats
 * @param {Record<string, string>} aptitudes
 * @param {{ battle?: string | null, time?: 'fast' | 'long' | null }} context battleは相手との戦型(APTITUDE_KEYSの前の4つ)
 */
export function applyAptitudes(stats, aptitudes, { battle = null, time = null } = {}) {
  const scale = (battle ? aptitudeScale(aptitudes?.[battle]) : 1) * (time ? aptitudeScale(aptitudes?.[time]) : 1);
  return Object.fromEntries(STAT_KEYS.map((key) => [key, Math.round((Number(stats?.[key]) || 0) * scale)]));
}

/** 適性を1目盛り上げる(目盛りがたまったら1段上げる。Aが上限)。 */
export function raiseAptitude(aptitude, step = 1) {
  const rank = APTITUDE_RANKS.includes(aptitude?.rank) ? aptitude.rank : 'G';
  let index = APTITUDE_RANKS.indexOf(rank);
  let meter = (Number(aptitude?.meter) || 0) + step;
  while (meter >= APTITUDE_STEPS && index < APTITUDE_RANKS.length - 1) {
    meter -= APTITUDE_STEPS;
    index += 1;
  }
  if (index === APTITUDE_RANKS.length - 1) meter = 0;
  return { rank: APTITUDE_RANKS[index], meter };
}

// ---- 戦い方(20-5)

/** 戦い方。attackは今の棋士の棋風の攻めの重み(player-character.mjsのattack、-1〜1)。 */
export const PLAY_STYLES = Object.freeze({
  lead: Object.freeze({ id: 'lead', label: '主導型', attack: 0.6, note: '序盤から攻めの手を好む', skills: Object.freeze(['researcher', 'myoshu', 'closer']) }),
  counter: Object.freeze({ id: 'counter', label: 'カウンター型', attack: -0.5, note: '受けて、攻めが切れたところで反撃する', skills: Object.freeze(['defense-master', 'adversity', 'gamesmanship']) }),
  grit: Object.freeze({ id: 'grit', label: '粘り型', attack: -0.2, note: '不利でも崩れない手を選ぶ', skills: Object.freeze(['adversity', 'unbroken', 'clairvoyance']) }),
  study: Object.freeze({ id: 'study', label: '研究型', attack: 0.1, note: '定跡を長く指し、序盤で差をつける', skills: Object.freeze(['researcher', 'anti-plan', 'long-think']) }),
});

// ---- スキル(19-4)

/**
 * スキル15。starは格(★4は虹)。段階1で効き目を作るのは`staged: 1`の5つ(20-8)。
 * 効き目の数字は初期値(自己対局で直す)。
 */
export const SKILLS = Object.freeze([
  { id: 'fujii-curve', name: '藤井曲線', star: 4, staged: 1, when: 'いつも', text: '序盤・中盤・終盤に隙がなく、優勢を保つ。評価値のグラフがなめらかな曲線になる' },
  { id: 'adversity', name: '逆境の粘り', star: 2, staged: 1, when: '劣勢', text: '不利になるほど読みが深くなり、崩れにくくなる' },
  { id: 'gamesmanship', name: '勝負術', star: 3, when: '大きく劣勢', text: '最善に近い手の中から、相手が間違えやすい手を選ぶ' },
  { id: 'closer', name: '勝ちきる力', star: 2, staged: 1, when: '優勢', text: '優勢になっても緩まない' },
  { id: 'researcher', name: '研究家', star: 2, when: '序盤', text: '定跡を長く、迷わず指す' },
  { id: 'endgame-demon', name: '終盤の鬼', star: 3, staged: 1, when: '終盤', text: '長い詰みを見つけ、詰めろに早く気づく' },
  { id: 'defense-master', name: '受けの達人', star: 3, when: '自玉が危ないとき', text: '深く読んで受け、詰めろを見落とさない' },
  { id: 'clairvoyance', name: '千里眼', star: 2, when: 'いつも', text: '遠くの角・飛車の利きを見落としにくい' },
  { id: 'myoshu', name: '妙手', star: 2, when: '中盤・終盤', text: '捨て駒や見えにくい手を思いつく' },
  { id: 'quick-sight', name: '早見え', star: 1, when: 'いつも', text: '読む量が少なくても、最善の候補を落とさない' },
  { id: 'byoyomi', name: '秒読みに強い', star: 1, staged: 1, when: '秒読み', text: '残り時間が少なくても手が荒れにくい' },
  { id: 'long-think', name: '長考派', star: 1, when: '中盤の勝負どころ', text: '勝負どころで時間を使って深く読む' },
  { id: 'big-stage', name: '大舞台', star: 2, when: '大一番', text: '大一番で力を出す' },
  { id: 'anti-plan', name: '対策の鬼', star: 2, when: '相手の得意戦法が分かっているとき', text: '相手の得意を外す作戦がうまい' },
  { id: 'unbroken', name: '不屈', star: 1, when: '育成', text: '大一番で負けても、次の対局でやる気が下がらない' },
].map((skill) => Object.freeze(skill)));
export const skillById = (id) => SKILLS.find((skill) => skill.id === id) ?? null;

/** 戦い方とかみ合うスキルの効き目の増し(20-5)。 */
export const STYLE_SKILL_BOOST = 1.1;

/**
 * 場面ごとのスキルの効き目(段階1の5つ)。値は強さ設定に掛ける倍率・足す数。
 * @param {readonly string[]} skills
 * @param {{ advantage?: number, phase?: 'opening' | 'middle' | 'ending', clock?: string | null, style?: string }} situation
 *   advantageは弟子から見た評価値(cp)。clockは時計の重圧(time-control.mjsのcpuThinkPlanのpressure)
 */
export function skillEffects(skills, { advantage = 0, phase = 'middle', clock = null, style = '' } = {}) {
  const has = (id) => skills?.includes(id);
  const fit = (id) => (PLAY_STYLES[style]?.skills.includes(id) ? STYLE_SKILL_BOOST : 1);
  const effect = { nodes: 1, sigma: 1, missScale: 1, ruinLimitZero: false, mateSightPlus: 0, mateFindPlus: 0, clockScale: 1, noLoosening: false, active: [] };
  if (has('fujii-curve')) {
    effect.sigma *= 0.4;
    effect.missScale = 0;
    effect.ruinLimitZero = true;
    effect.noLoosening = true;
    effect.active.push('fujii-curve');
  }
  if (has('adversity') && advantage <= -300) {
    effect.nodes *= 1 + 0.5 * fit('adversity');
    effect.sigma *= 1 - 0.3 * fit('adversity');
    effect.active.push('adversity');
  }
  if (has('closer') && advantage >= 500) {
    effect.sigma *= 1 - 0.5 * fit('closer');
    effect.noLoosening = true;
    effect.active.push('closer');
  }
  if (has('endgame-demon') && phase === 'ending') {
    effect.mateFindPlus += Math.round(4 * fit('endgame-demon'));
    effect.mateSightPlus += Math.round(3 * fit('endgame-demon'));
    effect.active.push('endgame-demon');
  }
  if (has('byoyomi') && (clock === 'byoyomi' || clock === 'low')) {
    effect.clockScale *= 0.5;
    effect.active.push('byoyomi');
  }
  return effect;
}

// ---- 能力値からAIの設定へ(19-2)

/** 表示のLv(小数)から、もとの校正のLv(小数)。整数のLvの間は直線でつなぐ。 */
export function sourceOfLevel(level) {
  const lv = clamp(level, STAT_LEVEL_MIN, STAT_LEVEL_MAX);
  const lo = Math.floor(lv);
  const hi = Math.ceil(lv);
  if (lo === hi) return sourceLevelOf(lo);
  return sourceLevelOf(lo) + (sourceLevelOf(hi) - sourceLevelOf(lo)) * (lv - lo);
}

/** 表示のLv(小数)の設定。 */
const settingsAtLevel = (level) => sourceLevelSettings(sourceOfLevel(level));

/**
 * 弟子の対局の強さ設定。全体の強さのLvの設定を土台に、能力ごとのLvの列で差し替える。
 * - 読み: 探索の量`nodes`・候補数`human.candidates`・取り合いの手数`human.belief.depth`
 * - 作戦: 大局観の重み`human.belief.w`・作戦の定跡手の優先`openingPlanScoreScale`
 * - 安定: 判断のぶれ`human.sigma`・`scoreTemperature`・見落とし`human.miss`・確認`human.prevent`・台無しの上限`human.limit`
 * - 詰み: 詰めろに気づく手数`human.belief.mateSight`と、詰みを見つける技量の目安`mateLevel`(player-character.mjsのbaseMateFindingに渡す)
 * @param {{ stats: Record<string, number>, aptitudes?: Record<string, string>, style?: string, skills?: readonly string[],
 *   context?: { battle?: string | null, time?: 'fast' | 'long' | null }, mood?: number }} disciple moodは-2〜2(やる気。能力のLvを±)
 */
export function discipleStrength({ stats, aptitudes = {}, style = '', skills = [], context = {}, mood = 0 }) {
  const scaled = applyAptitudes(stats, aptitudes, context);
  const shift = clamp(Number(mood) || 0, -2, 2) * 0.75;
  const levels = Object.fromEntries(STAT_KEYS.map((key) => [key, clamp(statLevel(scaled[key]) + shift, STAT_LEVEL_MIN, STAT_LEVEL_MAX)]));
  const overall = clamp(overallLevel(scaled) + shift, STAT_LEVEL_MIN, STAT_LEVEL_MAX);
  const base = settingsAtLevel(overall);
  const reading = settingsAtLevel(levels.reading);
  const plan = settingsAtLevel(levels.plan);
  const steady = settingsAtLevel(levels.steady);
  const mate = settingsAtLevel(levels.mate);
  const human = base.human ? {
    ...base.human,
    miss: steady.human?.miss ?? base.human.miss,
    prevent: steady.human?.prevent ?? base.human.prevent,
    sigma: steady.human?.sigma ?? base.human.sigma,
    limit: steady.human?.limit ?? base.human.limit,
    candidates: reading.human?.candidates ?? base.human.candidates,
    belief: {
      ...base.human.belief,
      w: plan.human?.belief.w ?? base.human.belief.w,
      depth: reading.human?.belief.depth ?? base.human.belief.depth,
      mateSight: mate.human?.belief.mateSight ?? base.human.belief.mateSight,
    },
  } : undefined;
  const settings = {
    ...base,
    nodes: reading.nodes,
    scoreTemperature: steady.scoreTemperature ?? base.scoreTemperature,
    openingPlanScoreScale: plan.openingPlanScoreScale ?? base.openingPlanScoreScale,
    ...(human ? { human } : {}),
  };
  return {
    level: round1(overall),
    levels: Object.fromEntries(STAT_KEYS.map((key) => [key, round1(levels[key])])),
    settings,
    mateLevel: round1(levels.mate),
    attack: PLAY_STYLES[style]?.attack ?? 0,
    skills: [...skills],
  };
}

// ---- 観戦しない局の勝ち負け(19-6)

/** 1Lvの差を、勝つ割合のレーティングの差に換える目安(docs/difficulty-calibration.mdの1Lvあたり約100前後)。 */
export const ELO_PER_LEVEL = 100;

/**
 * 観戦しない局で、弟子が勝つ割合。観戦してエンジンで指したときと同じになるよう、全体の強さのLvで比べる。
 * @param {number} discipleLevel discipleStrengthのlevel
 * @param {number} opponentLevel 相手のLv
 */
export function winChance(discipleLevel, opponentLevel) {
  const diff = (Number(discipleLevel) - Number(opponentLevel)) * ELO_PER_LEVEL;
  return 1 / (1 + 10 ** (-diff / 400));
}

// ---- 観戦の見立て(19-5)

/** 崩れた手の理由の5択と、狙い目になる能力(時間切迫は持ち時間の適性)。 */
export const CAUSES = Object.freeze({
  reading: Object.freeze({ id: 'reading', label: '読み負け', note: '相手の狙いに遅れた', target: 'reading' }),
  plan: Object.freeze({ id: 'plan', label: '作戦負け', note: '序盤から不利', target: 'plan' }),
  careless: Object.freeze({ id: 'careless', label: 'うっかり', note: '取られる駒の見落とし', target: 'steady' }),
  mate: Object.freeze({ id: 'mate', label: '詰み逃し', note: '詰みや詰めろ', target: 'mate' }),
  time: Object.freeze({ id: 'time', label: '時間切迫', note: '秒読みで手が荒れた', target: 'time' }),
});
export const CAUSE_ORDER = Object.freeze(['reading', 'plan', 'careless', 'mate', 'time']);
/** 印を付ける落ち幅の下限(cp)と、1局の印の数(師匠の眼の段で増える)。 */
export const MARK_MIN_LOSS = 250;
export const MARK_COUNT = Object.freeze({ base: 2, perDan: 3, max: 4 });
/** 序盤とみなす手数(作戦負けの手がかり)。 */
export const OPENING_PLY = 40;

/**
 * 弟子の1手の理由。AIが手を選んだときの記録から決める(何に気づかなかったか・詰みを逃したか・時計・手数)。
 * @param {{ ply: number, loss: number, oversights?: readonly unknown[], missedMate?: boolean, allowedMate?: boolean, clock?: string | null }} move
 */
export function causeOf(move) {
  if (move.missedMate || move.allowedMate) return 'mate';
  if (move.clock === 'byoyomi' || move.clock === 'low') return 'time';
  if (move.oversights?.length) return 'careless';
  if (move.ply < OPENING_PLY) return 'plan';
  return 'reading';
}

/**
 * 観戦の印。弟子の手で形勢が大きく落ちた場面を、落ちた幅の大きい順に(師匠の眼の段で数が増える)。
 * @param {readonly { ply: number, loss: number, oversights?: readonly unknown[], missedMate?: boolean, allowedMate?: boolean, clock?: string | null }[]} moves 弟子の手
 * @param {{ dan?: number }} [options] 師匠の眼の段(1〜9)
 */
export function watchMarks(moves, { dan = 1 } = {}) {
  const count = Math.min(MARK_COUNT.max, MARK_COUNT.base + Math.floor((Math.max(1, dan) - 1) / MARK_COUNT.perDan));
  return moves
    .filter((move) => (Number(move.loss) || 0) >= MARK_MIN_LOSS)
    .sort((a, b) => b.loss - a.loss || a.ply - b.ply)
    .slice(0, count)
    .sort((a, b) => a.ply - b.ply)
    .map((move) => ({ ply: move.ply, loss: Math.round(move.loss), cause: causeOf(move), clues: clues(move) }));
}

/** 印の場面の手がかり(画面に並べる札)。将棋の力がなくても理由を当てられるように。 */
function clues(move) {
  const list = [`${move.ply}手目${move.ply < OPENING_PLY ? '（序盤）' : move.ply < 90 ? '（中盤）' : '（終盤）'}`];
  if (move.clock === 'byoyomi') list.push('秒読み');
  else if (move.clock === 'low') list.push('残り時間が少ない');
  if (move.oversights?.length) list.push('赤い輪：取られる駒');
  if (move.missedMate) list.push('詰みがあった');
  if (move.allowedMate) list.push('詰めろを見落とした');
  return list;
}

/** 狙い目の伸びの倍率と長さ(当てた・外した)。 */
export const AIM = Object.freeze({ right: 1.5, wrong: 1.25, turns: 3 });
/** 同じ理由を何回見抜くと、隠れた弱点の名前が出るか。 */
export const REVEAL_AFTER = 3;

/**
 * 理由の5択を判定する。
 * @param {{ cause: string }} mark
 * @param {string} guess
 */
export function judgeGuess(mark, guess) {
  const right = mark.cause === guess;
  return { right, cause: mark.cause, target: CAUSES[mark.cause]?.target ?? '', boost: right ? AIM.right : AIM.wrong, turns: AIM.turns };
}

// ---- 稽古(20-6)

/** 稽古5種。gainsは主に伸びる能力と少し伸びる能力、aptitudeは上がる適性。 */
export const TRAININGS = Object.freeze([
  { id: 'tsume', label: '詰将棋', main: 'mate', sub: 'reading', aptitude: null, stamina: 20 },
  { id: 'kifu', label: '棋譜並べ', main: 'plan', sub: null, aptitude: 'battle', stamina: 15 },
  { id: 'jissen', label: '実戦', main: 'reading', sub: 'steady', aptitude: null, stamina: 22 },
  { id: 'fast', label: '早指し', main: 'steady', sub: null, aptitude: 'fast', stamina: 25 },
  { id: 'shisho', label: '師匠と指す', main: 'choice', sub: null, aptitude: null, stamina: 12, style: true },
].map((training) => Object.freeze(training)));
export const trainingById = (id) => TRAININGS.find((training) => training.id === id) ?? null;

/** 伸びの初期値(主に・少し)と、稽古の段ごとの増し。 */
export const GAIN = Object.freeze({ main: 16, sub: 6, perLevel: 0.1, maxLevel: 5 });
/** やる気(-2〜2)の倍率。 */
export const MOOD_SCALE = Object.freeze({ '-2': 0.8, '-1': 0.9, 0: 1, 1: 1.1, 2: 1.2 });

/** Aより上は伸びが鈍る(20-3)。 */
export function diminish(value) {
  if (value >= 1050) return 0.4;
  if (value >= 900) return 0.6;
  return 1;
}

/**
 * 稽古の伸び。
 * @param {Record<string, number>} stats
 * @param {string} trainingId
 * @param {{ choice?: string, level?: number, mood?: number, aim?: Record<string, number>, friends?: number }} options
 *   choiceは「師匠と指す」で伸ばす能力、levelは稽古の段(1〜5)、aimは狙い目(能力→倍率)、friendsは顔を出した仲間の数
 * @returns {Record<string, number>} 能力ごとの伸び
 */
export function trainingGains(stats, trainingId, { choice = 'steady', level = 1, mood = 0, aim = {}, friends = 0 } = {}) {
  const training = trainingById(trainingId);
  if (!training) return {};
  const main = training.main === 'choice' ? (STAT_KEYS.includes(choice) ? choice : 'steady') : training.main;
  const scale = (1 + GAIN.perLevel * (clamp(level, 1, GAIN.maxLevel) - 1)) * (MOOD_SCALE[clamp(Math.round(mood), -2, 2)] ?? 1) * (1 + 0.15 * clamp(friends, 0, 2));
  const gains = {};
  const add = (key, amount) => {
    const value = Number(stats?.[key]) || 0;
    gains[key] = Math.round(amount * scale * (aim[key] ?? 1) * diminish(value));
  };
  add(main, GAIN.main);
  if (training.sub) add(training.sub, GAIN.sub);
  return gains;
}

/** 体力から稽古の失敗の割合(19-7の表。体力50で5%、30で20%、10で45%)。 */
export function failChance(stamina) {
  const s = clamp(Number(stamina) || 0, 0, 100);
  if (s >= 50) return Math.max(0, 0.05 - (s - 50) * 0.001);
  if (s >= 30) return 0.05 + (50 - s) * 0.0075;
  if (s >= 10) return 0.2 + (30 - s) * 0.0125;
  return Math.min(0.6, 0.45 + (10 - s) * 0.015);
}

/** 能力値に伸びを足す(上限つき)。 */
export function addGains(stats, gains) {
  return Object.fromEntries(STAT_KEYS.map((key) => [key, clamp((Number(stats?.[key]) || 0) + (Number(gains?.[key]) || 0), 0, STAT_MAX)]));
}

// ---- 弟子の候補(3-1・20-5。名前は仮)

export const DISCIPLES = Object.freeze([
  Object.freeze({
    id: 'minato', name: '相沢 湊', age: 12, grade: '中学1年', style: 'counter', difficulty: 2,
    intro: '将棋教室の大会で負けて泣いた日、あなたに「弟子にしてください」と頼みに来た。',
    stats: Object.freeze({ reading: 330, plan: 260, steady: 480, mate: 380 }),
    aptitudes: Object.freeze({ static: 'C', ranging: 'B', aifuri: 'E', kakugawari: 'D', fast: 'C', long: 'E' }),
    skills: Object.freeze(['quick-sight']), weakness: 'weak-attack',
  }),
  Object.freeze({
    id: 'tsumugi', name: '朝比奈 紬', age: 15, grade: '高校1年', style: 'study', difficulty: 3,
    intro: '将棋を始めたのは中学3年。遅く始めた分、研究ノートは誰よりも厚い。',
    stats: Object.freeze({ reading: 360, plan: 520, steady: 380, mate: 250 }),
    aptitudes: Object.freeze({ static: 'B', ranging: 'C', aifuri: 'D', kakugawari: 'B', fast: 'E', long: 'C' }),
    skills: Object.freeze(['researcher']), weakness: 'time-trouble',
  }),
  Object.freeze({
    id: 'ao', name: '結城 蒼', age: 11, grade: '小学6年', style: 'lead', difficulty: 1,
    intro: '詰将棋の大会で名前を知られた、口数の少ない子。盤の外のことはまだ知らない。',
    stats: Object.freeze({ reading: 420, plan: 200, steady: 300, mate: 540 }),
    aptitudes: Object.freeze({ static: 'C', ranging: 'C', aifuri: 'C', kakugawari: 'E', fast: 'B', long: 'E' }),
    skills: Object.freeze(['endgame-demon']), weakness: 'careless',
  }),
]);
export const discipleById = (id) => DISCIPLES.find((disciple) => disciple.id === id) ?? null;
