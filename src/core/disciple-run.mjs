// 師匠の1年(docs/disciple-mode-design.md)の育成の進み(23章)。弟子を選び、半月ごとに予定を選んで能力を伸ばし、
// 研修会の入会試験と例会を弟子が指して、奨励会への編入の資格(A2)を目指す。
// 画面と保存の仕組みに依存しない(保存の文字列にするのはsaveDiscipleRun)。研修会の規定と世界はkenshukai.mjsをそのまま使い、
// 勝ち負けだけをこのモジュールが能力値から決める(観戦しない局。disciple-strength.mjsのeffectiveLevel・winChance)。

import { createRng } from './ryuo-random.mjs';
import {
  APTITUDE_KEYS, DISCIPLES, MOOD_SCALE, REVEAL_AFTER, STAT_KEYS, STAT_LABELS, TRAININGS, addGains, diminish, discipleById, discipleStrength, effectiveLevel,
  failChance, judgeGuess, raiseAptitude, skillById, statRank, trainingById, trainingGains, winChance,
} from './disciple-strength.mjs';
import { cardById, lessonDeck, lessonHands, newSkills, scoreLesson, skillProgress } from './disciple-lesson.mjs';
import { A2, CLASS_RATINGS, TOP, classLabel, createKenshukaiRun, describeKenshukai, recordKenshukaiGame } from './kenshukai.mjs';

export const DISCIPLE_RUN_KEY = 'yacobihime:shogi-match:disciple:v1';
export const DISCIPLE_RUN_VERSION = 1;

/** 入門から入会試験までのターン(9章の「あと3ターン」)。 */
export const EXAM_TURN = 3;
/** 1回の育成のターンの上限(4年。長くても1回3時間ほど。8-1)。 */
export const MAX_TURNS = 96;
/** 研修会の世界の物差し(F2の相手のLv)と、1クラスで上がるLv(23-3)。 */
export const OPPONENT_BASE_LEVEL = 17;
export const OPPONENT_CLASS_STEP = 2.2;
/** 例会と試験の1局のあとに弟子が伸びる量(実戦の経験)。 */
export const GAME_EXP = Object.freeze({ played: 2, won: 2 });
/** 観戦した局で、ここまで劣勢になってから勝つと「劣勢から勝った」(逆境の粘りの条件)。 */
export const COMEBACK_EVAL = -300;
/** 大一番の作戦が合ったとき・合わないときの勝つ割合の増減(10章)。 */
export const PLAN_FIT = Object.freeze({ good: 0.06, bad: -0.04 });

/** 予定(9-1)。研究会と師匠の予定は段階2で足す。 */
export const ACTIONS = Object.freeze({ train: '稽古', rest: '休む', outing: '出かける', study: '研究会', master: '師匠の予定' });
/** 研究会(9-1。25-2): 読みと安定が伸び、顔を出した仲間みんなと絆が深まる。 */
export const STUDY = Object.freeze({ reading: 14, steady: 8, stamina: 18, friendBoost: 0.15 });
/** 師匠の予定(9-1。25-2): 連れていく先は3つから(暦で決まる)。 */
export const MASTER_EVENTS = Object.freeze([
  Object.freeze({ id: 'kengaku', label: '対局の見学', text: '師匠の対局を控室で見学した', gains: { plan: 12 }, mood: 1, stamina: -5 }),
  Object.freeze({ id: 'kaisetsu', label: '解説の仕事', text: '師匠の大盤解説を手伝った', gains: { plan: 8, reading: 6 }, mood: 0, stamina: -8 }),
  Object.freeze({ id: 'matsuri', label: '将棋まつり', text: '将棋まつりで指導対局を手伝った', gains: { steady: 6 }, mood: 2, stamina: 5 }),
]);
/** 引き出しに増えるカード(25-1)。 */
export const CARD_UNLOCKS = Object.freeze([
  Object.freeze({ card: 'notebook', text: '百花との絆が深まった', check: (state) => (state.bonds?.momoka ?? 0) >= 5 }),
  Object.freeze({ card: 'dojo', text: '出かけた先で道場を見つけた', check: (state) => (state.outings ?? 0) >= 3 }),
]);

/** 仲間(11章)。段階1は3人(百花と研究会の2人)。likesは顔を出しやすい稽古。 */
export const FRIENDS = Object.freeze([
  Object.freeze({ id: 'momoka', name: '百花', likes: Object.freeze(['tsume', 'kifu']), portrait: 'sakurano-momoka-320.webp' }),
  Object.freeze({ id: 'hayase', name: '早瀬', likes: Object.freeze(['jissen', 'shisho']), portrait: '' }),
  Object.freeze({ id: 'makabe', name: '真壁', likes: Object.freeze(['fast', 'jissen']), portrait: '' }),
]);
/** 仲間が顔を出す割合。 */
export const FRIEND_SHOW = 0.7;

/** 大一番の作戦(10章)。序盤の方針と終盤の構え。 */
export const PLANS = Object.freeze({
  opening: Object.freeze([
    Object.freeze({ id: 'avoid', label: '相手の得意を外す', note: '力の差を消す' }),
    Object.freeze({ id: 'own', label: '得意で行く', note: '得意な形で押す' }),
    Object.freeze({ id: 'wild', label: '力戦にする', note: '読み勝負' }),
  ]),
  ending: Object.freeze([
    Object.freeze({ id: 'attack', label: '攻め切る', note: '詰みの力で' }),
    Object.freeze({ id: 'wait', label: '受けて待つ', note: '安定の力で' }),
  ]),
});

/** 対局のあとの言葉(10章)。弟子の性格で効き方が違う。 */
export const WORDS = Object.freeze([
  Object.freeze({ id: 'praise', label: 'よくがんばったね', note: 'ほめる' }),
  Object.freeze({ id: 'review', label: '一緒に振り返ろう', note: '弱いところの稽古が伸びる' }),
  Object.freeze({ id: 'quiet', label: '今日はもう休もう', note: 'そっとしておく' }),
]);
/** 弟子ごとの言葉の効き方(やる気の増減・狙い目の倍率・体力)。 */
export const WORD_EFFECTS = Object.freeze({
  minato: Object.freeze({ praise: { mood: 1 }, review: { aim: 1.25, stamina: -10 }, quiet: { stamina: 15 } }),
  tsumugi: Object.freeze({ praise: { mood: 0 }, review: { aim: 1.5, stamina: -10, mood: 1 }, quiet: { stamina: 10 } }),
  ao: Object.freeze({ praise: { mood: 0, stamina: 5 }, review: { aim: 1.25, mood: -1 }, quiet: { mood: 1, stamina: 15 } }),
});

const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));
const GRADES = Object.freeze(['小1', '小2', '小3', '小4', '小5', '小6', '中1', '中2', '中3', '高1', '高2', '高3']);
const MONTHS = Object.freeze([4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3]);
/** 「中学1年」を「中1」に(暦の札は短く)。 */
export const shortGrade = (grade) => String(grade ?? '').replace(/^小学(\d)年$/, '小$1').replace(/^中学(\d)年$/, '中$1').replace(/^高校(\d)年$/, '高$1');

/**
 * 新しい育成を始める。
 * @param {{ seed: number, discipleId: string }} input
 */
export function createDiscipleRun({ seed, discipleId }) {
  const base = discipleById(discipleId) ?? DISCIPLES[0];
  const rng = createRng(seed);
  const state = {
    version: DISCIPLE_RUN_VERSION,
    seed,
    rng: 0,
    discipleId: base.id,
    name: base.name,
    startAge: base.age,
    startGrade: shortGrade(base.grade),
    stats: { ...base.stats },
    aptitudes: Object.fromEntries(APTITUDE_KEYS.map((key) => [key, { rank: base.aptitudes[key] ?? 'E', meter: 0 }])),
    style: base.style,
    skills: [...base.skills],
    weakness: base.weakness,
    weaknessKnown: false,
    turn: 0,
    stamina: 100,
    mood: 1,
    aims: {},
    trainCounts: {},
    bonds: Object.fromEntries(FRIENDS.map((friend) => [friend.id, 0])),
    friends: {},
    kenshukai: null,
    words: null,
    lastEvent: null,
    log: [{ turn: 0, text: `${base.name}が弟子入りした` }],
    end: null,
  };
  state.friends = assignFriends(rng);
  state.rng = rng.state;
  return state;
}

/** その週に、仲間がどの稽古に顔を出すか(稽古ごとの仲間のid)。 */
function assignFriends(rng) {
  const byTraining = Object.fromEntries(TRAININGS.map((training) => [training.id, []]));
  for (const friend of FRIENDS) {
    if (rng.next() >= FRIEND_SHOW) continue;
    const pool = rng.next() < 0.75 ? friend.likes : TRAININGS.map((training) => training.id);
    byTraining[pool[Math.floor(rng.next() * pool.length)]].push(friend.id);
  }
  return byTraining;
}

/** 適性の段だけの表(discipleStrengthに渡す形)。 */
export const aptitudeRanks = (state) => Object.fromEntries(Object.entries(state.aptitudes).map(([key, value]) => [key, value.rank]));

/** 弟子のいまの強さ(やる気と、対局の条件の適性を入れる)。 */
export function currentStrength(state, context = {}) {
  return discipleStrength({ stats: state.stats, aptitudes: aptitudeRanks(state), style: state.style, skills: state.skills, context, mood: state.mood });
}

/** ターンの暦(4月前半から)。 */
export function turnCalendar(turn, startGrade = '中1') {
  const year = Math.floor(turn / 24);
  const inYear = turn % 24;
  const month = MONTHS[Math.floor(inYear / 2)];
  const half = inYear % 2 === 0 ? '前半' : '後半';
  const gradeIndex = GRADES.indexOf(startGrade);
  const grade = gradeIndex >= 0 && gradeIndex + year < GRADES.length ? GRADES[gradeIndex + year] : `${year + 1}年目`;
  return { year: year + 1, month, half, grade, label: `${grade} ${month}月`, sub: `${half}・${year + 1}年目` };
}

/** このターンにすること(予定を選ぶ・入会試験・例会・終わり)。 */
export function turnKind(state) {
  if (state.end) return 'end';
  if (state.words) return 'words';
  if (!state.kenshukai) return state.turn >= EXAM_TURN ? 'exam' : 'free';
  return state.turn % 2 === 1 ? 'reikai' : 'free';
}

/** 次の目標と残りのターン(9章の上の帯)。 */
export function nextGoal(state) {
  if (!state.kenshukai) return { text: '研修会 入会試験', left: Math.max(0, EXAM_TURN - state.turn) };
  const view = describeKenshukai(state.kenshukai);
  if (state.kenshukai.cls >= A2) return { text: '奨励会への編入の資格', left: 0 };
  const left = view?.progress ? view.progress.winsLeft : 0;
  return { text: `${view?.nextClassLabel ?? ''}クラスに昇級`, left, unit: '勝' };
}

/** 稽古の段(同じ稽古を4回で1段、5段まで)。 */
export const trainingLevel = (state, id) => clamp(1 + Math.floor((state.trainCounts[id] ?? 0) / 4), 1, 5);

/** 狙い目の倍率の表(能力→倍率)。 */
const aimTable = (state) => Object.fromEntries(Object.entries(state.aims).map(([key, aim]) => [key, aim.boost]));

/**
 * 稽古の札の中身(伸びる数字・失敗の割合・顔を出した仲間)。
 * @param {any} state
 * @param {string} id
 * @param {{ choice?: string }} [options]
 */
export function trainingPreview(state, id, { choice = 'steady' } = {}) {
  const training = trainingById(id);
  const friends = state.friends[id] ?? [];
  const gains = trainingGains(state.stats, id, { choice, level: trainingLevel(state, id), mood: state.mood, aim: aimTable(state), friends: friends.length });
  const aimed = Object.keys(gains).some((key) => state.aims[key]);
  return {
    id, label: training?.label ?? '', gains, friends, level: trainingLevel(state, id),
    stamina: training?.stamina ?? 0, fail: Math.round(failChance(state.stamina) * 100), aimed,
    aptitude: training?.aptitude === 'battle' ? 'ranging' : training?.aptitude ?? null,
  };
}

function advanceTurn(state, rng) {
  state.turn += 1;
  for (const [key, aim] of Object.entries(state.aims)) {
    if (aim.turns <= 1) delete state.aims[key];
    else state.aims[key] = { ...aim, turns: aim.turns - 1 };
  }
  // やる気は少しずつ真ん中へ戻り、ときどき揺れる。
  if (rng.next() < 0.12) state.mood = clamp(state.mood + (rng.next() < 0.5 ? -1 : 1), -2, 2);
  state.friends = assignFriends(rng);
  if (state.turn >= MAX_TURNS && !state.end) finish(state, 'timeup');
}

/**
 * 予定を1つ選んでターンを進める(このターンが予定を選ぶターンのときだけ)。
 * @param {any} state
 * @param {{ kind: 'train' | 'rest' | 'outing' | 'study' | 'master', id?: string, choice?: string, cards?: string[] }} action cardsは指導の引き出しで選んだカード(25-1)
 * @returns {{ state: any, result: { kind: string, gains?: Record<string, number>, failed?: boolean, text: string, newSkills?: string[], newCards?: string[], [key: string]: any } }}
 */
export function chooseAction(state, action) {
  if (turnKind(state) !== 'free') return { state, result: { kind: 'none', text: '' } };
  const next = structuredClone(state);
  const rng = createRng(next.rng);
  let result;
  if (action.kind === 'train') {
    const training = trainingById(action.id ?? '');
    if (!training) return { state, result: { kind: 'none', text: '' } };
    const preview = trainingPreview(next, training.id, { choice: action.choice });
    // 指導の引き出しで選んだカード(25-1)。手札にないカードは数えない。
    const hands = lessonHands(next, training.id);
    const cards = (action.cards ?? []).filter((id, index) => hands[index]?.includes(id));
    const lesson = cards.length ? scoreLesson(next, cards) : null;
    if (rng.next() < failChance(next.stamina)) {
      next.stamina = clamp(next.stamina - Math.round(training.stamina / 2), 0, 100);
      next.mood = clamp(next.mood - 1, -2, 2);
      result = { kind: 'train', failed: true, gains: {}, lesson, text: `${training.label}の稽古は、疲れて身が入らなかった` };
    } else {
      const scale = lesson?.grade.scale ?? 1;
      const gains = Object.fromEntries(Object.entries(preview.gains).map(([key, value]) => [key, Math.round(value * scale)]));
      next.stats = addGains(next.stats, gains);
      next.stamina = clamp(next.stamina - training.stamina + (lesson?.stamina ?? 0), 0, 100);
      next.mood = clamp(next.mood + (lesson?.mood ?? 0), -2, 2);
      next.trainCounts[training.id] = (next.trainCounts[training.id] ?? 0) + 1;
      for (const id of preview.friends) next.bonds[id] = (next.bonds[id] ?? 0) + 1;
      if (preview.aptitude) next.aptitudes[preview.aptitude] = raiseAptitude(next.aptitudes[preview.aptitude], 1);
      const text = Object.entries(gains).map(([key, value]) => `${STAT_LABELS[key]}＋${value}`).join('・');
      result = { kind: 'train', failed: false, gains, lesson, text: `${training.label}の稽古${lesson ? `（${lesson.grade.label}）` : ''}。${text}` };
    }
  } else if (action.kind === 'rest') {
    next.stamina = clamp(next.stamina + 40, 0, 100);
    if (rng.next() < 0.3) next.mood = clamp(next.mood + 1, -2, 2);
    result = { kind: 'rest', text: 'ゆっくり休んだ。体力が戻った' };
  } else if (action.kind === 'study') {
    // 研究会: 今週どこかに顔を出した仲間がみんな来る。
    const present = [...new Set(Object.values(next.friends).flat())];
    const scale = (MOOD_SCALE[clamp(Math.round(next.mood), -2, 2)] ?? 1) * (1 + STUDY.friendBoost * present.length);
    const gains = {
      reading: Math.round(STUDY.reading * scale * diminish(next.stats.reading) * (next.aims.reading?.boost ?? 1)),
      steady: Math.round(STUDY.steady * scale * diminish(next.stats.steady) * (next.aims.steady?.boost ?? 1)),
    };
    next.stats = addGains(next.stats, gains);
    next.stamina = clamp(next.stamina - STUDY.stamina, 0, 100);
    for (const id of present) next.bonds[id] = (next.bonds[id] ?? 0) + 1;
    const who = present.map((id) => FRIENDS.find((friend) => friend.id === id)?.name).filter(Boolean).join('・');
    result = { kind: 'study', gains, text: `研究会で実戦（${who || '弟子と2人で'}）。読み＋${gains.reading}・安定＋${gains.steady}` };
  } else if (action.kind === 'master') {
    const event = MASTER_EVENTS[(next.turn + Math.floor(rng.next() * 3)) % MASTER_EVENTS.length];
    const gains = Object.fromEntries(Object.entries(event.gains).map(([key, value]) => [key, Math.round(value * diminish(next.stats[key]))]));
    next.stats = addGains(next.stats, gains);
    next.mood = clamp(next.mood + event.mood, -2, 2);
    next.stamina = clamp(next.stamina + event.stamina, 0, 100);
    const text = Object.entries(gains).map(([key, value]) => `${STAT_LABELS[key]}＋${value}`).join('・');
    result = { kind: 'master', gains, event: event.id, text: `${event.label}：${event.text}。${text}` };
  } else {
    next.mood = clamp(next.mood + 1, -2, 2);
    next.stamina = clamp(next.stamina + 10, 0, 100);
    next.outings = (next.outings ?? 0) + 1;
    const key = STAT_KEYS[Math.floor(rng.next() * STAT_KEYS.length)];
    next.stats = addGains(next.stats, { [key]: 5 });
    result = { kind: 'outing', gains: { [key]: 5 }, text: `一緒に出かけた。やる気が上がった（${STAT_LABELS[key]}＋5）` };
  }
  next.log.push({ turn: next.turn, text: result.text });
  Object.assign(result, growth(next));
  advanceTurn(next, rng);
  next.rng = rng.state;
  return { state: next, result };
}

/**
 * 引き出しに増えたカードと、覚えたスキル(25章)。状態に書き足し、知らせる中身を返す。
 * @param {any} state 書き換えてよい写し
 */
function growth(state) {
  state.deck ??= [];
  const newCards = [];
  for (const unlock of CARD_UNLOCKS) {
    if (state.deck.includes(unlock.card) || !unlock.check(state)) continue;
    state.deck.push(unlock.card);
    newCards.push(unlock.card);
    state.log.push({ turn: state.turn, text: `${unlock.text}。引き出しに「${cardById(unlock.card)?.label}」が増えた` });
  }
  const learned = newSkills(state);
  for (const id of learned) {
    state.skills.push(id);
    state.log.push({ turn: state.turn, text: `スキル「${skillById(id)?.name}」を覚えた` });
  }
  return { newCards, newSkills: learned };
}

/** 入会試験を受けるクラス。相手が弟子より少しだけ弱いクラス(大一番の勝つ見込みが6割前後になる。23-3)。 */
export function examClassFor(level) {
  return clamp(Math.round((level - EXAM_MARGIN - OPPONENT_BASE_LEVEL) / OPPONENT_CLASS_STEP), 0, 7);
}
/** 入会試験の相手を、弟子のLvからどれだけ下に置くか。 */
export const EXAM_MARGIN = 1;

/** 研修会の相手のLv(クラスと強さから。23-3)。 */
export function opponentLevel(member, cls) {
  const classOf = Number.isFinite(member?.cls) ? member.cls : cls;
  const offset = ((Number(member?.rating) || CLASS_RATINGS[classOf] || CLASS_RATINGS[0]) - (CLASS_RATINGS[classOf] ?? CLASS_RATINGS[0])) / 25 * 0.6;
  return clamp(OPPONENT_BASE_LEVEL + OPPONENT_CLASS_STEP * classOf + offset, 12, 45);
}

/**
 * 大一番の作戦が弟子と相手に合うか(10章)。
 * @param {any} state
 * @param {{ opening?: string, ending?: string }} plan
 * @param {{ level: number }} opponent
 */
export function planFit(state, plan, opponent) {
  const strength = currentStrength(state);
  const { reading, plan: planLv, steady, mate } = strength.levels;
  const fits = [];
  if (plan.opening === 'avoid') fits.push(opponent.level > strength.level ? 'good' : 'bad');
  else if (plan.opening === 'own') fits.push(planLv >= reading - 1 ? 'good' : 'bad');
  else if (plan.opening === 'wild') fits.push(reading > planLv + 1 ? 'good' : 'bad');
  if (plan.ending === 'attack') fits.push(mate >= steady ? 'good' : 'bad');
  else if (plan.ending === 'wait') fits.push(steady > mate || state.style === 'counter' ? 'good' : 'bad');
  return { fits, bonus: fits.reduce((sum, fit) => sum + PLAN_FIT[fit], 0) };
}

/** この例会・試験が大一番か(入会試験と、昇級がかかる例会)。 */
export function isBigEvent(state) {
  const kind = turnKind(state);
  if (kind === 'exam') return true;
  if (kind !== 'reikai') return false;
  const view = describeKenshukai(state.kenshukai);
  return Boolean(view?.progress && view.progress.winsLeft <= 2);
}

/** 大一番の相手の札(試験・例会の最初の相手)。 */
export function eventOpponent(state) {
  if (turnKind(state) === 'exam') {
    const level = effectiveLevel(discipleStrength({ stats: state.stats, aptitudes: aptitudeRanks(state), style: state.style, skills: state.skills }));
    const cls = examClassFor(level);
    return { name: '入会試験の相手', cls, label: `${classLabel(cls)}クラスの研修会員`, level: round1(opponentLevel(null, cls)) };
  }
  const pending = describeKenshukai(state.kenshukai)?.pending;
  if (!pending?.opponent) return null;
  const member = state.kenshukai.world.members[pending.opponent.id];
  return { name: pending.opponent.name, cls: state.kenshukai.cls, label: `${classLabel(member?.cls ?? state.kenshukai.cls)}クラス`, level: round1(opponentLevel(member, state.kenshukai.cls)) };
}
const round1 = (value) => Math.round(value * 10) / 10;

/**
 * 入会試験の日なら研修会の挑戦を作る(試験の相手が決まる)。すでにあればそのまま。
 * @param {any} state 書き換えてよい写し
 */
function ensureKenshukai(state) {
  if (state.kenshukai) return state;
  // 試験のクラスは、やる気を入れない弟子の強さで決める(調子のよい日に高いクラスを受けすぎない)。
  const level = effectiveLevel(discipleStrength({ stats: state.stats, aptitudes: aptitudeRanks(state), style: state.style, skills: state.skills }));
  state.kenshukai = createKenshukaiRun({
    seed: (state.seed ^ 0x5bd1e995) >>> 0, settings: { shido: false, world: OPPONENT_BASE_LEVEL }, entryClass: examClassFor(level),
    userName: state.name, userLevel: level,
  });
  return state;
}

/**
 * 入会試験・例会を弟子が指す(観戦しない局)。その日の局を全部決め、ターンを進める。
 * @param {any} state
 * @param {{ plan?: { opening?: string, ending?: string } | null, forced?: boolean[], watchedMin?: number | null }} [options] forcedは観戦してエンジンで決めた、はじめの局の勝ち負け。
 *   watchedMinは観戦した局の弟子から見たいちばん低い評価値(劣勢から勝つと逆境の粘りの条件に数える)
 * @returns {{ state: any, result: { kind: 'exam' | 'reikai', games: { name: string, level: number, win: boolean, chance: number }[], wins: number, losses: number, text: string, events: string[], newSkills?: string[], newCards?: string[] } }}
 */
export function playEvent(state, { plan = null, forced = [], watchedMin = null } = {}) {
  const kind = turnKind(state);
  if (kind !== 'exam' && kind !== 'reikai') return { state, result: { kind: 'reikai', games: [], wins: 0, losses: 0, text: '', events: [] } };
  const next = ensureKenshukai(structuredClone(state));
  const rng = createRng(next.rng);
  const big = isBigEvent(state);
  const games = [];
  const events = [];
  const startDay = next.kenshukai.dayNo;
  const startPhase = next.kenshukai.phase;
  // 試験は全局、例会はその日の局を指す(次の日の局が決まったら止める)。
  for (let guard = 0; guard < 12 && next.kenshukai.pending; guard += 1) {
    const run = next.kenshukai;
    if (startPhase === 'reikai' && run.dayNo !== startDay) break;
    if (startPhase === 'exam' && run.phase !== 'exam') break;
    const member = run.world.members[run.pending.opponentId] ?? run.guests?.[run.pending.opponentId];
    const level = opponentLevel(member, run.cls);
    const battle = member?.style === 'ranging' ? 'ranging' : 'static';
    const strength = currentStrength(next, { battle, time: 'fast' });
    const fit = big && plan ? planFit(next, plan, { level }).bonus : 0;
    const chance = clamp(winChance(effectiveLevel(strength), level) + fit, 0.03, 0.97);
    // 観戦した局は、エンジンが盤の上で決めた勝ち負け(19-6)。乱数は同じだけ進める(観戦してもしなくても、あとの局は同じ)。
    const roll = rng.next();
    const watched = games.length < forced.length;
    const win = watched ? Boolean(forced[games.length]) : roll < chance;
    games.push({ name: member?.name ?? '', level: round1(level), win, chance: Math.round(chance * 100) / 100, watched });
    const gain = GAME_EXP.played + (win ? GAME_EXP.won : 0);
    next.stats = addGains(next.stats, Object.fromEntries(STAT_KEYS.map((key) => [key, gain])));
    next.kenshukai = recordKenshukaiGame(run, win ? 'win' : 'loss', { userLevel: effectiveLevel(strength) });
    for (const event of next.kenshukai.events ?? []) events.push(event.text);
  }
  const wins = games.filter((game) => game.win).length;
  const losses = games.length - wins;
  if (big) next.bigWins = (next.bigWins ?? 0) + wins;
  if (games[0]?.watched && games[0].win && Number(watchedMin) <= COMEBACK_EVAL) next.comebacks = (next.comebacks ?? 0) + 1;
  const label = kind === 'exam' ? '入会試験' : `第${startDay + 1}回例会`;
  const text = `${label} ${wins}勝${losses}敗${events.length ? `。${events.join('・')}` : ''}`;
  next.log.push({ turn: next.turn, text });
  next.stamina = clamp(next.stamina - 10, 0, 100);
  next.lastEvent = { kind, label, games, wins, losses, events, big };
  const grown = growth(next);
  next.lastEvent.newSkills = grown.newSkills;
  next.lastEvent.newCards = grown.newCards;
  if (big || losses > 0) next.words = { big, lost: losses > 0 };
  if (next.kenshukai.cls >= A2 || next.kenshukai.qualified) finish(next, 'qualified');
  else if (next.kenshukai.cls >= TOP) finish(next, 'top');
  else advanceTurn(next, rng);
  next.rng = rng.state;
  return { state: next, result: { kind, games, wins, losses, text, events, newSkills: grown.newSkills, newCards: grown.newCards } };
}

// ---- 観戦(19-5・19-6・24章)

/** 弟子の戦い方ごとの、得意で行くときの戦法(relay-game.mjsのopeningPlanOfの戦法の名前)。 */
export const STYLE_OPENINGS = Object.freeze({ lead: 'hayaguri', counter: 'yagura', grit: 'ibisha', study: 'kakugawari-kg' });
/** 終盤の構えで、攻めの向きをどれだけずらすか(作戦がエンジンの指し手にも効く)。 */
export const ENDING_ATTACK = Object.freeze({ attack: 0.3, wait: -0.3 });

/**
 * 観戦する1局(その日のはじめの局)の本局の設定(engine-game.mjsのplayEngineGameに渡す)。授けた作戦は戦法と攻めの向きになる。
 * 研修会の挑戦がまだなければ作った状態も返す(試験の相手を決めるため)。
 * @param {any} state
 * @param {{ plan?: { opening?: string, ending?: string } | null }} [options]
 */
export function watchSpec(state, { plan = null } = {}) {
  const kind = turnKind(state);
  if (kind !== 'exam' && kind !== 'reikai') return null;
  const next = ensureKenshukai(structuredClone(state));
  const run = next.kenshukai;
  const member = run.world.members[run.pending?.opponentId] ?? run.guests?.[run.pending?.opponentId];
  if (!member) return null;
  const level = opponentLevel(member, run.cls);
  const battle = member.style === 'ranging' ? 'ranging' : 'static';
  const strength = currentStrength(next, { battle, time: 'fast' });
  const attack = clamp(strength.attack + (ENDING_ATTACK[plan?.ending ?? ''] ?? 0), -1, 1);
  const side = run.pending.color === 'white' ? 'white' : 'black';
  const other = side === 'black' ? 'white' : 'black';
  const opponentOpening = battle === 'ranging' ? 'shiken' : 'aigakari';
  // 相手の得意を外すなら、相手の戦型に合う形(振り飛車には対抗形の居飛車、居飛車には矢倉)。力戦なら定跡なし。
  const ownOpening = plan?.opening === 'wild' ? null : plan?.opening === 'avoid' ? (battle === 'ranging' ? 'ibisha' : 'yagura') : STYLE_OPENINGS[next.style] ?? null;
  const disciple = {
    id: 'disciple', name: next.name, level: Math.round(effectiveLevel(strength)), kind: 'kenshukai',
    disciple: { strength: { ...strength, attack }, profile: { weakness: next.weakness, aptitudes: aptitudeRanks(next), style: next.style }, time: 'fast' },
  };
  const opponent = {
    id: member.id, name: member.name, level: Math.round(level), kind: 'kenshukai', character: member.character ?? null,
    repertoire: member.repertoire ?? null, style: member.style ?? null,
  };
  const spec = {
    key: `disciple:${next.seed}:${next.turn}:${run.dayNo}:${run.games.length}`, seed: (next.seed ^ Math.imul(next.turn + 1, 0x9e3779b1)) >>> 0,
    event: 'kenshukai', kind: 'game', label: kind === 'exam' ? '入会試験' : `第${run.dayNo}回例会`,
    [side]: disciple, [other]: opponent,
    openings: { [side]: ownOpening, [other]: opponentOpening },
  };
  return { spec, side, opponent: { name: member.name, level: round1(level) }, state: next };
}

/** 師匠の眼の段(見抜いた数で上がる。19-5)。 */
export const eyeDan = (found) => clamp(1 + Math.floor((Number(found) || 0) / 5), 1, 9);
/** 隠れた弱点と、それを見抜く理由(同じ理由を3回見抜くと名前が出る)。 */
export const WEAKNESS_CAUSE = Object.freeze({ careless: 'careless', 'time-trouble': 'time', 'big-stage-weak': 'reading', 'loose-when-ahead': 'reading', 'endgame-collapse': 'mate' });
export const WEAKNESS_LABELS = Object.freeze({
  careless: 'うっかりが多い', 'time-trouble': '時間に追われる', 'big-stage-weak': '大舞台で硬くなる', 'loose-when-ahead': '優勢で緩む', 'endgame-collapse': '終盤で頓死する',
});

/**
 * 観戦の見立ての答えを入れる(19-5)。印ごとの理由の5択から、狙い目・見抜いた数・隠れた弱点の名前を決める。
 * @param {any} state
 * @param {readonly { cause: string }[]} marks
 * @param {readonly (string | null)[]} guesses 印ごとに選んだ理由(選ばなかった印はnull)
 */
export function applyFindings(state, marks, guesses) {
  const next = structuredClone(state);
  next.causes ??= {};
  next.eye ??= 0;
  const results = [];
  marks.forEach((mark, index) => {
    const guess = guesses[index];
    if (!guess) return;
    const judged = judgeGuess(mark, guess);
    // 時間切迫は持ち時間の適性(早指しの稽古)の狙い目。
    const target = judged.target === 'time' ? 'steady' : judged.target;
    if (target) next.aims[target] = { boost: Math.max(next.aims[target]?.boost ?? 1, judged.boost), turns: judged.turns };
    next.causes[mark.cause] = (next.causes[mark.cause] ?? 0) + 1;
    if (judged.right) next.eye += 1;
    results.push({ ...judged, target });
  });
  let revealed = '';
  if (!next.weaknessKnown && (next.causes[WEAKNESS_CAUSE[next.weakness]] ?? 0) >= REVEAL_AFTER) {
    next.weaknessKnown = true;
    revealed = WEAKNESS_LABELS[next.weakness] ?? next.weakness;
    next.log.push({ turn: next.turn, text: `弱点が分かった：${revealed}` });
  }
  return { state: next, results, revealed, dan: eyeDan(next.eye) };
}

/**
 * 対局のあとの言葉を選ぶ(10章)。
 * @param {any} state
 * @param {string} wordId
 */
export function chooseWords(state, wordId) {
  if (!state.words) return { state, text: '' };
  const next = structuredClone(state);
  const effect = WORD_EFFECTS[next.discipleId]?.[wordId] ?? {};
  if (effect.mood) next.mood = clamp(next.mood + effect.mood, -2, 2);
  if (effect.stamina) next.stamina = clamp(next.stamina + effect.stamina, 0, 100);
  if (effect.aim) {
    // いちばん低い能力の稽古を狙い目に(観戦していないので、理由までは分からない。19-5)。
    const weakest = STAT_KEYS.reduce((low, key) => (next.stats[key] < next.stats[low] ? key : low), STAT_KEYS[0]);
    next.aims[weakest] = { boost: effect.aim, turns: 2 };
  }
  const word = WORDS.find((entry) => entry.id === wordId);
  next.words = null;
  next.log.push({ turn: next.turn, text: `「${word?.label ?? ''}」と声をかけた` });
  return { state: next, text: wordLine(next, wordId, effect) };
}

/** 言葉のあとの弟子の一言(仮の台詞。段階2で場面にする)。 */
function wordLine(state, wordId, effect) {
  const happy = (effect.mood ?? 0) > 0 || (effect.aim ?? 0) >= 1.5;
  if (wordId === 'review') return happy ? 'はい。もう一度、最初から並べてみます' : '……はい。どこが悪かったんだろう';
  if (wordId === 'praise') return happy ? '先生にそう言ってもらえると、次もがんばれます' : 'ありがとうございます。でも、まだまだです';
  return happy ? '少し休んだら、また指したくなってきました' : '今日は早めに寝ます';
}

function finish(state, kind) {
  const best = state.kenshukai ? classLabel(state.kenshukai.best ?? state.kenshukai.cls) : '';
  const text = kind === 'qualified' ? `${state.name}は研修会A2クラスに昇級し、奨励会への編入の資格を得た`
    : kind === 'top' ? `${state.name}は研修会Sクラスに昇級した`
      : `${state.name}の育成はここまで（研修会 ${best || '入会前'}）`;
  state.end = { kind, text, turn: state.turn, best, rank: endRank(state, kind) };
  state.log.push({ turn: state.turn, text });
}

/** 育成の評価(13章)。到達したクラスと、かかったターンから。 */
function endRank(state, kind) {
  const cls = state.kenshukai?.best ?? -1;
  let score = (cls + 1) * 10 + (kind === 'qualified' || kind === 'top' ? Math.max(0, MAX_TURNS - state.turn) : 0);
  score += Math.round(STAT_KEYS.reduce((sum, key) => sum + state.stats[key], 0) / 80);
  return score >= 200 ? 'S' : score >= 150 ? 'A' : score >= 110 ? 'B' : score >= 70 ? 'C' : 'D';
}

/**
 * 画面に出す形(育成のホーム)。
 * @param {any} state
 */
export function discipleView(state) {
  if (!state) return null;
  const strength = currentStrength(state);
  const calendar = turnCalendar(state.turn, state.startGrade);
  const kenshukai = state.kenshukai ? describeKenshukai(state.kenshukai) : null;
  return {
    name: state.name,
    discipleId: state.discipleId,
    calendar,
    kind: turnKind(state),
    goal: nextGoal(state),
    stats: STAT_KEYS.map((key) => ({ key, label: STAT_LABELS[key], value: state.stats[key], rank: statRank(state.stats[key]), aimed: Boolean(state.aims[key]) })),
    level: effectiveLevel(strength),
    mood: state.mood,
    stamina: state.stamina,
    style: state.style,
    skills: state.skills,
    weakness: state.weaknessKnown ? WEAKNESS_LABELS[state.weakness] ?? state.weakness : null,
    eye: { found: state.eye ?? 0, dan: eyeDan(state.eye) },
    aptitudes: state.aptitudes,
    trainings: TRAININGS.map((training) => trainingPreview(state, training.id)),
    deck: lessonDeck(state),
    skillProgress: skillProgress(state),
    friends: FRIENDS.map((friend) => ({ ...friend, bond: state.bonds[friend.id] ?? 0 })),
    kenshukai: kenshukai ? { classLabel: kenshukai.classLabel, progress: kenshukai.progress, board: kenshukai.board, phase: kenshukai.phase } : null,
    big: isBigEvent(state),
    opponent: turnKind(state) === 'exam' || turnKind(state) === 'reikai' ? eventOpponent(state) : null,
    words: state.words,
    lastEvent: state.lastEvent,
    log: state.log.slice(-6),
    end: state.end,
  };
}

/** 保存の形(研修会の相手の表は世界から付け直せるので書かない)。 */
export function packDiscipleRun(state) {
  return state ? JSON.stringify(state, (key, value) => (key === 'players' ? undefined : value)) : '';
}

/** @param {Storage | null | undefined} storage */
export function loadDiscipleRun(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(DISCIPLE_RUN_KEY) ?? 'null');
    if (!parsed || parsed.version !== DISCIPLE_RUN_VERSION || !parsed.stats) return null;
    if (parsed.kenshukai?.world?.members) parsed.kenshukai.players = { ...parsed.kenshukai.world.members, ...(parsed.kenshukai.guests ?? {}) };
    return parsed;
  } catch {
    return null;
  }
}

/** @param {Storage | null | undefined} storage */
export function saveDiscipleRun(storage, state) {
  try {
    if (state) storage?.setItem(DISCIPLE_RUN_KEY, packDiscipleRun(state));
    else storage?.removeItem(DISCIPLE_RUN_KEY);
  } catch {
    // 保存できなくても遊べる。
  }
}
