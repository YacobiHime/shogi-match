// 師匠の1年(docs/disciple-mode-design.md)の、弟子の能力値・適性・戦い方・スキルを、将棋AIの設定と勝ち負けに換える部分(20章)。
// 画面と保存に依存しない。CPUの表は今の`strength-settings.mjs`(Lvごとの設定)と`human-model.mjs`(人間らしい選び方)をそのまま引く。
// - 能力値4つ(読み・作戦・安定・詰み。0〜1200)は、それぞれLv12〜49に換え、能力ごとに別のLvで設定の列を引く(19-2)。
// - 全体の強さは0.6×平均＋0.4×最低(いちばん弱い能力に引っ張られる。20-3)。
// - 適性(G〜A)は、対局ごとに能力に倍率を掛ける(20-4)。戦い方は指し方の向きだけ(強さは変えない。20-5)。
// - 観戦の見立て(崩れた手の理由の5択と狙い目。19-5)と、稽古の伸び(20-6)。

import { PHASE_LIMITS, applyCharacter } from './player-character.mjs';
import { calibrationSkill, sourceLevelOf, sourceLevelSettings } from './strength-settings.mjs';

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
  const effect = { levelPlus: 0, nodes: 1, sigma: 1, missScale: 1, ruinLimitZero: false, mateSightPlus: 0, mateFindPlus: 0, clockScale: 1, noLoosening: false, candidatesMin: 0, active: [] };
  if (has('fujii-curve')) {
    // どの局面も隙がない: 局面のLvを＋3し、ぶれを小さく、見落としと台無しをなくす(22-3で測って決めた)。
    effect.levelPlus += 3;
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
  // 25章で足した3つ(効き目は仮。自己対局で測り直す)。
  if (has('researcher') && phase === 'opening') {
    effect.levelPlus += 1.5 * fit('researcher');
    effect.active.push('researcher');
  }
  if (has('clairvoyance')) {
    effect.missScale *= 0.5;
    effect.active.push('clairvoyance');
  }
  if (has('quick-sight')) {
    effect.candidatesMin = 8;
    effect.active.push('quick-sight');
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
const settingsAtLevel = (level) => sourceLevelSettings(sourceOfLevel(clamp(level, STAT_LEVEL_MIN, STAT_LEVEL_MAX)));

/**
 * 局面ごとの能力の重み(22章。自己対局で測って決めた)。序盤は作戦、中盤は読み(と少し作戦)、終盤は詰みが主役。
 * 安定はどの局面にも、全体の強さ(いちばん弱い能力に引っ張られる)も効く。各局面の重みの合計は1(4つが同じなら、どの局面も同じLv)。
 */
export const PHASE_WEIGHTS = Object.freeze({
  opening: Object.freeze({ plan: 0.45, steady: 0.2, overall: 0.35 }),
  middle: Object.freeze({ reading: 0.35, plan: 0.1, steady: 0.2, overall: 0.35 }),
  ending: Object.freeze({ mate: 0.45, steady: 0.2, overall: 0.35 }),
});
/** 局面の主役の能力(画面の説明・観戦の手がかり)。 */
export const PHASE_LEAD = Object.freeze({ opening: 'plan', middle: 'reading', ending: 'mate' });

/** 手数から局面(player-character.mjsと同じ境目)。 */
export const phaseOfPly = (ply) => (ply < PHASE_LIMITS.opening ? 'opening' : ply < PHASE_LIMITS.middle ? 'middle' : 'ending');

/**
 * 弟子の対局の強さ。能力値・適性・やる気から、能力ごとのLv・全体の強さ・局面ごとのLvを出す。
 * 1手ごとの設定はdiscipleMoveSettingsで、局面のLvの設定(探索量・ぶれ・大局観など、そのLvのCPUのまま)を土台に、
 * 安定のLvで見落とし・確認・台無しの上限を、詰みのLvで詰めろに気づく手数と詰みを見つける力を差し替える。
 * @param {{ stats: Record<string, number>, aptitudes?: Record<string, string>, style?: string, skills?: readonly string[],
 *   context?: { battle?: string | null, time?: 'fast' | 'long' | null }, mood?: number }} disciple moodは-2〜2(やる気。能力のLvを±)
 */
export function discipleStrength({ stats, aptitudes = {}, style = '', skills = [], context = {}, mood = 0 }) {
  const scaled = applyAptitudes(stats, aptitudes, context);
  const shift = clamp(Number(mood) || 0, -2, 2) * 0.75;
  const levels = Object.fromEntries(STAT_KEYS.map((key) => [key, clamp(statLevel(scaled[key]) + shift, STAT_LEVEL_MIN, STAT_LEVEL_MAX)]));
  const overall = clamp(overallLevel(scaled) + shift, STAT_LEVEL_MIN, STAT_LEVEL_MAX);
  const phases = Object.fromEntries(Object.entries(PHASE_WEIGHTS).map(([phase, weights]) => [
    phase, round1(Object.entries(weights).reduce((sum, [key, weight]) => sum + weight * (key === 'overall' ? overall : levels[key]), 0)),
  ]));
  const strength = {
    level: round1(overall),
    levels: Object.fromEntries(STAT_KEYS.map((key) => [key, round1(levels[key])])),
    phases,
    mateLevel: round1(levels.mate),
    steadyLevel: round1(levels.steady),
    attack: PLAY_STYLES[style]?.attack ?? 0,
    skills: [...skills],
  };
  return { ...strength, settings: phaseSettings(strength, 'middle') };
}

/**
 * 局面のLvの設定に、安定と詰みのLvの列を差し替える。plusは局面のLvに足す(スキル)。
 * @param {{ phases: Record<string, number>, steadyLevel: number, mateLevel: number }} strength
 * @param {'opening' | 'middle' | 'ending'} phase
 * @param {number} [plus]
 */
export function phaseSettings(strength, phase, plus = 0) {
  const base = settingsAtLevel((strength.phases[phase] ?? strength.phases.middle) + plus);
  const steady = settingsAtLevel(strength.steadyLevel + plus);
  const mate = settingsAtLevel(strength.mateLevel + plus);
  if (!base.human) return base;
  return {
    ...base,
    human: {
      ...base.human,
      miss: steady.human?.miss ?? base.human.miss,
      prevent: steady.human?.prevent ?? base.human.prevent,
      limit: steady.human?.limit ?? base.human.limit,
      belief: { ...base.human.belief, mateSight: mate.human?.belief.mateSight ?? base.human.belief.mateSight },
    },
  };
}

// ---- 対局の1手ごとの設定(スキル・戦い方・弱点・時計。19-4・20-4・20-5)

/** 持ち時間の適性ごとの、時計の重圧の効き方(Cで今のまま。Aは軽く、Gは重く)。 */
export const TIME_APTITUDE_PRESSURE = Object.freeze({ A: 0.6, B: 0.8, C: 1, D: 1.15, E: 1.3, F: 1.4, G: 1.5 });

/**
 * 弟子の1手の強さ設定。discipleStrengthの設定に、戦い方(攻めの向き)と隠れた弱点を、今の棋士の特徴の仕組み(applyCharacter)で掛け、
 * 段階1のスキルの効き目と、持ち時間の適性で強めた・弱めた時計の重圧を足す。元の設定は変えない。
 * @param {ReturnType<typeof discipleStrength>} strength
 * @param {{ weakness?: string | null, aptitudes?: Record<string, string>, style?: string }} disciple
 * @param {{ advantage?: number, phase?: 'opening' | 'middle' | 'ending', clock?: { pressure: string, short?: boolean } | null,
 *   time?: 'fast' | 'long' | null, sfen?: string, ply?: number, [key: string]: unknown }} situation
 */
export function discipleMoveSettings(strength, disciple, situation = {}) {
  const effect = skillEffects(strength.skills, {
    advantage: situation.advantage ?? 0, phase: situation.phase ?? (Number.isFinite(situation.ply) ? phaseOfPly(situation.ply) : 'middle'), clock: situation.clock?.pressure ?? null, style: disciple?.style ?? '',
  });
  const weakness = disciple?.weakness && !(effect.noLoosening && disciple.weakness === 'loose-when-ahead') ? [{ id: disciple.weakness, degree: 1 }] : [];
  const character = { attack: strength.attack, traits: weakness };
  // 時計の重圧は、持ち時間の適性とスキルで強さを変えてから掛ける。applyCharacterには渡さない。
  const phase = situation.phase ?? (Number.isFinite(situation.ply) ? phaseOfPly(situation.ply) : 'middle');
  const mateSkill = calibrationSkill(sourceOfLevel(clamp(strength.mateLevel + effect.levelPlus, STAT_LEVEL_MIN, STAT_LEVEL_MAX)));
  const next = applyCharacter(phaseSettings(strength, phase, effect.levelPlus), character, { ...situation, phase, clock: null }, { skill: mateSkill });
  const pressure = situation.clock?.pressure;
  const timeRank = situation.time ? disciple?.aptitudes?.[situation.time] : null;
  const clockK = (pressure === 'byoyomi' || pressure === 'low') ? (TIME_APTITUDE_PRESSURE[timeRank] ?? 1) * effect.clockScale : 0;
  let nodes = effect.nodes;
  let sigma = effect.sigma;
  if (clockK > 0) {
    const base = pressure === 'byoyomi' ? (situation.clock?.short ? { nodes: 0.6, noise: 0.45 } : { nodes: 0.75, noise: 0.3 }) : { nodes: 0.88, noise: 0.15 };
    nodes *= Math.max(0.3, 1 - (1 - base.nodes) * clockK);
    sigma *= 1 + base.noise * clockK;
  }
  if (Number.isFinite(next.nodes) && next.nodes > 0 && nodes !== 1) next.nodes = Math.max(1, Math.round(next.nodes * nodes));
  if (Number.isFinite(next.scoreTemperature) && sigma !== 1) next.scoreTemperature = Math.max(1, Math.round(next.scoreTemperature * sigma));
  if (next.human) {
    const human = { ...next.human, sigma: Math.round(next.human.sigma * sigma * 1000) / 1000 };
    if (effect.missScale !== 1) human.miss = Object.fromEntries(Object.entries(human.miss).map(([key, value]) => [key, Math.round(value * effect.missScale * 10000) / 10000]));
    if (effect.ruinLimitZero) {
      human.limit = { A: 0, B: 0 };
      human.prevent = { A: 1, B: 1, small: 1 };
    }
    if (effect.mateSightPlus) human.belief = { ...human.belief, mateSight: human.belief.mateSight + effect.mateSightPlus };
    if (effect.candidatesMin && Number.isFinite(human.candidates)) human.candidates = Math.max(human.candidates, effect.candidatesMin);
    next.human = human;
  }
  if (effect.mateFindPlus && next.mateFinding && next.mateFinding.center !== Infinity) {
    next.mateFinding = { ...next.mateFinding, center: Math.round((next.mateFinding.center + effect.mateFindPlus) * 100) / 100 };
  }
  next.discipleSkills = effect.active;
  return next;
}

/**
 * 自己対局の選手の指定から、弟子の設定を作る(scripts/cpu-level-selfplay.mjsのD選手)。
 * 形は`D<読み>-<作戦>-<安定>-<詰み>`、後ろに`+<スキルのid>`を何個でも(例: D900-900-900-900+fujii-curve)。
 * 自己対局は評価値の場面を渡さないので、局面で効くスキルと、いつも効くスキル(藤井曲線)だけが効く。
 * @param {string} spec
 */
export function discipleSelfplaySettings(spec) {
  const match = String(spec).match(/^D(\d+)-(\d+)-(\d+)-(\d+)((?:\+[a-z-]+)*)$/);
  if (!match) return null;
  const stats = { reading: Number(match[1]), plan: Number(match[2]), steady: Number(match[3]), mate: Number(match[4]) };
  const skills = match[5] ? match[5].split('+').filter(Boolean) : [];
  const strength = discipleStrength({ stats, skills });
  const byPhase = Object.fromEntries(Object.keys(PHASE_LEAD).map((phase) => [phase, { ...discipleMoveSettings(strength, {}, { phase }), level: Math.round(strength.level) }]));
  // 自己対局は手ごとにperMoveで局面の設定を引く(関数は結果のJSONに残らない)。
  return { ...byPhase.middle, perMove: ({ ply }) => byPhase[phaseOfPly(ply)] };
}

// ---- 観戦しない局の勝ち負け(19-6)

/** 1Lvの差を、勝つ割合のレーティングの差に換える目安(前は100。docs/disciple-mode-design.mdの34-17)。 */
// 2026-11-21: 弟子と相手が理由で指すようになり(34-16・34-17)、能力値の1Lvは実際の強さで約0.6Lv(約60)に縮んだ。
// 観戦しない局をそれに合わせて60にすると、休んでばかりの弟子でも運で上がれてしまう(育て方が効かない)ので、間の80にした。
export const ELO_PER_LEVEL = 80;

/** 観戦しない局の強さで、局面ごとのLvをどれだけ重く見るか(22-3の自己対局に合わせた)。 */
export const EFFECTIVE_PHASE_WEIGHTS = Object.freeze({ opening: 0.15, middle: 0.55, ending: 0.3 });
/** いつも効くスキルが、観戦しない局の強さに足すLv(藤井曲線は22-3で測った約＋230のレーティング。ほかは仮の見積もり)。 */
export const SKILL_LEVEL_PLUS = Object.freeze({ 'fujii-curve': 2.3, researcher: 0.2, clairvoyance: 0.5, 'quick-sight': 0.3 });

/**
 * 観戦しない局で使う弟子の強さ(Lv)。局面ごとのLvの重みつきの平均と、いつも効くスキル。
 * エンジンで指したときの勝ちやすさに合わせる(4つが同じなら、全体の強さのLvと同じ)。
 * @param {ReturnType<typeof discipleStrength>} strength
 */
export function effectiveLevel(strength) {
  const phases = Object.entries(EFFECTIVE_PHASE_WEIGHTS).reduce((sum, [phase, weight]) => sum + weight * (strength.phases[phase] ?? strength.level), 0);
  const plus = (strength.skills ?? []).reduce((sum, id) => sum + (SKILL_LEVEL_PLUS[id] ?? 0), 0);
  return round1(phases + plus);
}

/**
 * 観戦しない局で、弟子が勝つ割合。
 * @param {number} discipleLevel effectiveLevelの値
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
export const OPENING_PLY = PHASE_LIMITS.opening;

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
  const list = [`${move.ply}手目${({ opening: '（序盤）', middle: '（中盤）', ending: '（終盤）' })[phaseOfPly(move.ply)]}`];
  if (move.clock === 'byoyomi') list.push('秒読み');
  else if (move.clock === 'low') list.push('残り時間が少ない');
  if (move.oversights?.length) list.push('赤い輪：取られる駒');
  if (move.missedMate) list.push('詰みがあった');
  if (move.allowedMate) list.push('詰めろを見落とした');
  return list;
}

/**
 * はじめの局面で先に指す側。駒落ちは上手(後手の側)が先に指すので、手番が「w」の局面は後手から(docs/disciple-mode-design.mdの37章)。
 * @param {string} [sfen] はじめの局面(空なら平手)
 * @returns {'black' | 'white'}
 */
export const firstMover = (sfen) => (String(sfen ?? '').split(' ')[1] === 'w' ? 'white' : 'black');

/**
 * 何手目(1から)をどちらが指したか。
 * @param {number} ply
 * @param {string} [sfen] はじめの局面
 * @returns {'black' | 'white'}
 */
export function moverOfPly(ply, sfen) {
  const first = firstMover(sfen);
  return (Number(ply) % 2 === 1) === (first === 'black') ? 'black' : 'white';
}

/**
 * 本局の棋譜(engine-game.mjsのentries)から、弟子の手を観戦の見立ての形にする。弟子の手には`d`(気づかなかったこと・詰み逃し・時計)がある。
 * @param {readonly { loss?: number, d?: { o?: number, m?: number, c?: string } }[]} entries
 * @param {'black' | 'white'} side 弟子の側
 * @param {{ start?: string }} [options] startははじめの局面(駒落ち。空なら平手)
 */
export function discipleWatchMoves(entries, side, { start = '' } = {}) {
  const first = moverOfPly(1, start) === side ? 0 : 1;
  const sign = side === 'black' ? 1 : -1;
  const moves = [];
  for (let index = first; index < entries.length; index += 2) {
    const entry = entries[index];
    // 落ち幅は、評価値のグラフで見える落ち方(相手の手のあとの形勢から、弟子の手のあとの形勢へ)。
    // 指したあとも大きく勝っている手(詰みの手数が延びただけなど)は、崩れた手に数えない。
    const before = clampEval(sign * (Number(entries[index - 1]?.eval) || 0));
    const after = clampEval(sign * (Number(entry?.eval) || 0));
    const loss = after >= STILL_WINNING ? 0 : Math.max(0, before - after);
    moves.push({
      ply: index + 1, loss, oversights: entry?.d?.o ? [{ kind: 'seen' }] : [],
      missedMate: Boolean(entry?.d?.m), clock: entry?.d?.c || null,
    });
  }
  return moves;
}
/** 指したあとの形勢(弟子から見た評価値)がこれ以上なら、まだ大きく勝っている。 */
export const STILL_WINNING = 1000;
/** 評価値の頭打ち(詰みの点数の大きさで印の順が決まらないように)。 */
export const MAX_MARK_LOSS = 3000;
const clampEval = (value) => Math.max(-MAX_MARK_LOSS, Math.min(MAX_MARK_LOSS, value));

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
export const GAIN = Object.freeze({ main: 28, sub: 10, perLevel: 0.1, maxLevel: 5 });
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
    skills: Object.freeze(['quick-sight']), weakness: 'big-stage-weak',
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
