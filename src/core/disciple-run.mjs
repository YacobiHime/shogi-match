// 師匠の1年(docs/disciple-mode-design.md)の育成の進み(23章)。弟子を選び、半月ごとに予定を選んで能力を伸ばし、
// 研修会の入会試験と例会を弟子が指して、奨励会への編入の資格(A2)を目指す。
// 画面と保存の仕組みに依存しない(保存の文字列にするのはsaveDiscipleRun)。研修会の規定と世界はkenshukai.mjsをそのまま使い、
// 勝ち負けだけをこのモジュールが能力値から決める(観戦しない局。disciple-strength.mjsのeffectiveLevel・winChance)。

import { createRng } from './ryuo-random.mjs';
import {
  APTITUDE_KEYS, DISCIPLES, ELO_PER_LEVEL, MOOD_SCALE, REVEAL_AFTER, STAT_KEYS, STAT_LABELS, TRAININGS, addGains, diminish, discipleById, discipleStrength, effectiveLevel,
  failChance, judgeGuess, raiseAptitude, skillById, statRank, trainingById, trainingGains, winChance,
} from './disciple-strength.mjs';
import { MAX_SKILLS, cardById, lessonDeck, lessonHands, newSkills, scoreLesson, skillProgress } from './disciple-lesson.mjs';
import { BASE_FRIENDS, friendWeight } from './disciple-ichimon.mjs';
import {
  createRival, growRivalBook, noteRivalBookGame, noteRivalGame, placeRivalInKenshukai, placeRivalInShoreikai, rivalBook, rivalCard, rivalFate,
  rivalPlanSpec, rivalStyle, syncRival,
} from './disciple-rival.mjs';
import { REVIEW_CAUSES, judgeReviewGuess, spottedCounts } from './disciple-causes.mjs';
import { masteryForLevel, startingMastery } from './strategy-mastery.mjs';
import {
  battleKey, bookChainSteps, bookChoices, bookHeadline, bookRows, chooseBookCard, createPlanBook, learnCard, noteSeen, notePlanGames, offerLearn,
  noteResearch, opponentPlanSpec, planCard, planSpec, researchNotes, surpriseToLearn, unlockChain,
} from './disciple-plans.mjs';
import { charmList, checkAgeLimit, checkClash, checkScenes, overcomeSlump, pendingScene, queueScene, receiveCharms, useCharm, withCharm } from './disciple-events.mjs';
import { A2, CLASS_RATINGS, TOP, classLabel, createKenshukaiRun, describeKenshukai, recordKenshukaiGame } from './kenshukai.mjs';
import { RANK_RATINGS, SANDAN, SHODAN, createShoreikaiRun, describeShoreikai, rankLabel, recordShoreikaiGame } from './shoreikai.mjs';
import { TEAI_RATING } from './teai.mjs';

export const DISCIPLE_RUN_KEY = 'yacobihime:shogi-match:disciple:v1';
export const DISCIPLE_RUN_VERSION = 1;

/** 入門から入会試験までのターン(9章の「あと3ターン」)。 */
export const EXAM_TURN = 3;
/** 研修会で過ごせるターンの上限(4年。A2に届かなければ育成はここまで。8-1)。 */
export const MAX_TURNS = 96;
/** 1回の育成のターンの上限(奨励会では年齢制限で終わるので、ふつうは届かない。28章)。 */
export const HARD_TURNS = 24 * 16;
/** 奨励会の相手のLv(28章): 6級の基準のレーティングでSHOREIKAI_BASE_LEVEL(研修会A2のLv39とつながる)、三段の基準(1490)で50.5(CPUの上限のLv49で止まる)。 */
export const SHOREIKAI_BASE_LEVEL = 39;
export const SHOREIKAI_LEVEL_PER_RATING = 11.5 / (1490 - 1150);
/** 奨励会の規定(みじかい規模・年齢制限あり。21歳で初段・26歳で四段)。 */
export const SHOREIKAI_SETTINGS = Object.freeze({ scale: 'mini', ageLimit: true, teai: true });
/** 研修会の設定(36-4)。手合いと指導対局(名簿がないので架空の幹事の先生)。 */
export const KENSHUKAI_SETTINGS = Object.freeze({ shido: true, teai: true, fallbackTeachers: true });
/** 指導対局の先生の強さ(いまのクラスの研修会員のLvに足す。指導なので本当の強さでは指さない。36-4)。 */
export const SHIDO_LEVEL_PLUS = 0.25;
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

/** はじめからいる仲間(11章。百花と研究会の2人)。育成に連れていく仲間は状態の`team`(29章。一門の先輩も入る)。 */
export const FRIENDS = BASE_FRIENDS;
/** 育成に連れていく仲間(前の版の保存ははじめからの3人)。 */
export const teamOf = (state) => (Array.isArray(state?.team) && state.team.length ? state.team : BASE_FRIENDS);
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
 * @param {{ seed: number, discipleId: string, team?: readonly any[] | null }} input teamは連れていく仲間(disciple-ichimon.mjsのpickTeam。なければはじめからの3人)
 */
export function createDiscipleRun({ seed, discipleId, team = null }) {
  const members = (team?.length ? team : BASE_FRIENDS).map((friend) => ({ ...friend, likes: [...friend.likes] }));
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
    team: members,
    bonds: Object.fromEntries(members.map((friend) => [friend.id, 0])),
    // 一門の先輩が残した教え方のカード(受け継ぎ。11-1)。
    deck: [...new Set(members.map((friend) => friend.card).filter(Boolean))],
    friends: {},
    kenshukai: null,
    words: null,
    lastEvent: null,
    // 入門の場面(12-1)から始まる。場面は予定を止めない(26章)。
    sceneQueue: ['intro'],
    // 羽音の一門(30章)。研修会に入ったときに、羽音の弟子が同期として入る。
    rival: createRival(),
    scenesSeen: {},
    charms: {},
    log: [{ turn: 0, text: `${base.name}が弟子入りした` }],
    end: null,
  };
  state.friends = assignFriends(rng, members);
  // 作戦帳(35章のO2)。はじめは2つの作戦だけを知っている。
  state.planBook = planBookOf(state);
  state.rng = rng.state;
  return state;
}

/** その週に、仲間がどの稽古に顔を出すか(稽古ごとの仲間のid)。 */
function assignFriends(rng, team = BASE_FRIENDS) {
  const byTraining = Object.fromEntries(TRAININGS.map((training) => [training.id, []]));
  for (const friend of team) {
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
  if (state.shoreikai) return state.shoreikai.pending && state.turn % 2 === 1 ? 'reikai' : 'free';
  if (!state.kenshukai) return state.turn >= EXAM_TURN ? 'exam' : 'free';
  return state.turn % 2 === 1 ? 'reikai' : 'free';
}

/** 次の目標と残りのターン(9章の上の帯)。 */
export function nextGoal(state) {
  if (state.shoreikai) {
    const view = describeShoreikai(state.shoreikai);
    if (view?.phase === 'league') return { text: view.pending?.stakes?.goal ?? '三段リーグで四段昇段', left: view.league ? view.league.rounds - view.league.round : 0, unit: '局' };
    if (view?.phase === 'pro') return { text: '四段昇段', left: 0 };
    return { text: `${view?.nextRankLabel ?? ''}に${view?.word ?? '昇級'}`, left: view?.progress?.winsLeft ?? 0, unit: '勝' };
  }
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
  const gains = trainingGains(state.stats, id, { choice, level: trainingLevel(state, id), mood: state.mood, aim: aimTable(state), friends: friendWeight(teamOf(state), friends) });
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
  state.friends = assignFriends(rng, teamOf(state));
  if (!state.end && ((!state.shoreikai && state.turn >= MAX_TURNS) || state.turn >= HARD_TURNS)) finish(state, 'timeup');
  checkScenes(state, { calendar: turnCalendar(state.turn, state.startGrade) });
  // 次のターンが弟子の大一番なら、師匠の大一番と重なる場面(32章)。
  checkClash(state, isBigEvent(state));
  checkSystemScenes(state);
}

/** 三段リーグの最終日の前夜の場面を出す見込み(自力・他力のとき。36-6)。 */
const FINAL_OUTLOOKS = Object.freeze(['self', 'others']);
/** 年齢制限の延長の場面を出す歳(26歳の前の年。36-6)。 */
const EXTEND_SCENE_AGE = 25;

/**
 * 制度を教える場面を積む(36-6)。その制度が初めて効く瞬間に、1つずつ(1回のターンに1つまで)。
 * 入会試験の前・はじめての例会の朝・はじめての香落ちと指導対局・降級点・B1(研修会の出口)、奨励会のはじめての平香交じり・
 * 三段リーグの最終日の前夜・延長。
 * @param {any} state 書き換えてよい写し
 */
function checkSystemScenes(state) {
  if (state.end) return;
  const seen = (key) => (state.scenesSeen?.[key]?.count ?? 0) > 0 || (state.sceneQueue ?? []).includes(key);
  const due = [];
  if (!state.kenshukai && !state.shoreikai && state.turn >= EXAM_TURN) due.push('sys-kenshukai');
  const ken = state.kenshukai && !state.kenshukai.done ? state.kenshukai : null;
  if (ken?.phase === 'reikai') {
    due.push('sys-reikai');
    if (ken.day?.teai?.some((item) => item?.teai === 'lance')) due.push('sys-teai');
    if (ken.day?.kinds?.includes('shido')) due.push('sys-shido');
    if (ken.point) due.push('sys-point');
    if (ken.cls >= EXIT_SCENE_CLASS) due.push('sys-exit');
  }
  const sho = state.shoreikai;
  if (sho?.phase === 'reikai' && sho.day?.teai?.some((item) => item && item.rule !== 'hirate')) due.push('sys-hanko');
  if (sho?.point) due.push('sys-point');
  if (sho?.phase === 'league' && sho.league && sho.league.round === sho.league.rounds - 1 && FINAL_OUTLOOKS.includes(sho.pending?.stakes?.outlook)) due.push('sys-final');
  if (sho && sho.rank >= SANDAN && discipleAgeMonths(state) >= EXTEND_SCENE_AGE * 12) due.push('sys-extend');
  const key = due.find((item) => !seen(item));
  if (key) queueScene(state, key);
}
/** 研修会の出口の場面を出すクラス(B1。A2のすぐ下)。 */
const EXIT_SCENE_CLASS = 9;

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
      // 棋譜並べを2回するごとに、新しい作戦を覚えられる(作戦の勉強。35-12)。候補は作戦帳の札に出し、師匠が選ぶ。
      if (training.id === 'kifu') {
        next.planStudy = (next.planStudy ?? 0) + 1;
        next.planBook = planBookOf(next);
        if (next.planStudy % PLAN_STUDY_EVERY === 0 && offerLearn(next.planBook, { planLevel: currentStrength(next).levels?.plan, random: () => rng.next() }).length) {
          result.text += '。新しい作戦を覚えられる';
          result.learnOffer = true;
        }
      }
    }
  } else if (action.kind === 'rest') {
    next.stamina = clamp(next.stamina + 40, 0, 100);
    if (rng.next() < 0.3) next.mood = clamp(next.mood + 1, -2, 2);
    result = { kind: 'rest', text: 'ゆっくり休んだ。体力が戻った' };
  } else if (action.kind === 'study') {
    // 研究会: 今週どこかに顔を出した仲間がみんな来る。
    const present = [...new Set(Object.values(next.friends).flat())];
    const scale = (MOOD_SCALE[clamp(Math.round(next.mood), -2, 2)] ?? 1) * (1 + STUDY.friendBoost * friendWeight(teamOf(next), present));
    const gains = {
      reading: Math.round(STUDY.reading * scale * diminish(next.stats.reading) * (next.aims.reading?.boost ?? 1)),
      steady: Math.round(STUDY.steady * scale * diminish(next.stats.steady) * (next.aims.steady?.boost ?? 1)),
    };
    next.stats = addGains(next.stats, gains);
    next.stamina = clamp(next.stamina - STUDY.stamina, 0, 100);
    for (const id of present) next.bonds[id] = (next.bonds[id] ?? 0) + 1;
    const who = present.map((id) => teamOf(next).find((friend) => friend.id === id)?.name).filter(Boolean).join('・');
    const masteryUp = growMastery(next, MASTERY_GAIN.study);
    // 研究会では、ときどき先輩から奇襲を教わる(35-12)。
    let taught = '';
    if (rng.next() < STUDY_SURPRISE_CHANCE) {
      const id = surpriseToLearn(next.planBook, () => rng.next());
      if (id) taught = learnCard(next.planBook, id);
    }
    result = {
      kind: 'study', gains, learned: taught,
      text: `研究会で実戦（${who || '弟子と2人で'}）。読み＋${gains.reading}・安定＋${gains.steady}${masteryUp ? `・戦法熟練度＋${masteryUp}` : ''}${taught ? `。${taught}を教わった` : ''}`,
    };
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
  Object.assign(result, growth(next, { outing: action.kind === 'outing', rng }));
  advanceTurn(next, rng);
  next.rng = rng.state;
  return { state: next, result };
}

/**
 * 引き出しに増えたカードと、覚えたスキル(25章)。状態に書き足し、知らせる中身を返す。
 * @param {any} state 書き換えてよい写し
 */
function growth(state, { outing = false, rng = undefined } = {}) {
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
  // お守り(26章): 仲間の絆と、出かけた先で。
  const newCharms = receiveCharms(state, { outing, rng });
  return { newCards, newSkills: learned, newCharms };
}

/** 入会試験を受けるクラス。相手が弟子より少しだけ弱いクラス(大一番の勝つ見込みが6割前後になる。23-3)。 */
export function examClassFor(level) {
  return clamp(Math.round((level - EXAM_MARGIN - OPPONENT_BASE_LEVEL) / OPPONENT_CLASS_STEP), 0, 7);
}
/** 入会試験の相手を、弟子のLvからどれだけ下に置くか。 */
export const EXAM_MARGIN = 1;

/** 研修会の相手のLv(クラスと強さから。23-3)。 */
export function opponentLevel(member, cls) {
  if (Number.isFinite(member?.rivalLevel)) return member.rivalLevel;
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
  // 奨励会: 昇級・昇段がかかる局と、三段リーグの勝負どころ(shoreikai.mjsの賭けているものboss)。
  if (state.shoreikai) return kind === 'reikai' && (Boolean(state.shoreikai.pending?.stakes?.boss) || pendingIsRival(state));
  if (kind === 'exam') return true;
  if (kind !== 'reikai') return false;
  const view = describeKenshukai(state.kenshukai);
  return Boolean(view?.progress && view.progress.winsLeft <= 2) || pendingIsRival(state);
}

/** この例会のはじめの相手が羽音の弟子か(30章。羽音の一門との局は大一番)。 */
export function pendingIsRival(state) {
  const run = state.shoreikai ?? state.kenshukai;
  const id = run?.pending?.opponentId;
  return Boolean(id && state.rival?.id === id && run.world?.members?.[id]);
}

/** 大一番の相手の札(試験・例会の最初の相手)。 */
export function eventOpponent(state) {
  if (state.shoreikai) {
    const run = state.shoreikai;
    const member = run.world.members[run.pending?.opponentId ?? ''];
    if (!member) return null;
    return { name: member.name, cls: run.rank, label: `奨励会 ${member.dan ?? ''}${member.rival ? '・羽音の弟子' : ''}`, level: round1(pendingOpponentLevel(state, member)), rival: Boolean(member.rival), id: member.id, teai: pendingTeaiText(state) };
  }
  if (turnKind(state) === 'exam') {
    const level = effectiveLevel(discipleStrength({ stats: state.stats, aptitudes: aptitudeRanks(state), style: state.style, skills: state.skills }));
    const cls = examClassFor(level);
    return { name: '入会試験の相手', cls, label: `${classLabel(cls)}クラスの研修会員`, level: round1(opponentLevel(null, cls)) };
  }
  const pending = describeKenshukai(state.kenshukai)?.pending;
  if (!pending?.opponent) return null;
  const member = state.kenshukai.world.members[pending.opponent.id];
  const teacher = pending.kind === 'shido';
  const label = teacher ? `${pending.opponent.dan ?? ''}・研修会の幹事` : `${classLabel(member?.cls ?? state.kenshukai.cls)}クラス${member?.rival ? '・羽音の弟子' : ''}`;
  return { name: pending.opponent.name, cls: state.kenshukai.cls, label, level: round1(pendingOpponentLevel(state, member)), rival: Boolean(member?.rival), id: pending.opponent.id, teai: pendingTeaiText(state) };
}
const round1 = (value) => Math.round(value * 10) / 10;

/** 奨励会の相手のLv(28章)。相手のレーティングから(伸びる相手は強くなる)。 */
export function shoreikaiOpponentLevel(member) {
  return clamp(SHOREIKAI_BASE_LEVEL + ((Number(member?.rating) || RANK_RATINGS[0]) - RANK_RATINGS[0]) * SHOREIKAI_LEVEL_PER_RATING, 12, 49);
}

/**
 * 例会のいまの局の、結果だけの勝ち負けに使う相手のLv(36-4)。指導対局は、いまのクラスの研修会員に少し足した強さ。
 * 香落ちは、相手が上手なら相手を弱く、弟子が上手なら相手を強く(香のぶん。TEAI_RATING)。
 * @param {any} state
 * @param {any} member
 */
export function pendingOpponentLevel(state, member) {
  const run = state.shoreikai ?? state.kenshukai;
  const pending = run?.pending;
  if (!state.shoreikai && pending?.kind === 'shido') return clamp(opponentLevel(null, run.cls) + SHIDO_LEVEL_PLUS, 12, 49);
  const base = state.shoreikai ? shoreikaiOpponentLevel(member) : opponentLevel(member, run.cls);
  const shift = pending?.handicap === 'lance' ? TEAI_RATING / ELO_PER_LEVEL : 0;
  if (pending?.handicapGiver === 'opponent') return clamp(base - shift, 12, 49);
  if (pending?.handicapGiver === 'player') return clamp(base + shift, 12, 49);
  return base;
}

/** いまの局が駒落ちか(駒落ちの局はまだ観戦しない。36-4)。 */
export function pendingIsHandicap(state) {
  const run = state.shoreikai ?? state.kenshukai;
  return Boolean(run?.pending?.handicap);
}

/** いまの局の手合いの言葉(「香落ち（相沢 湊が下手）」「平手」「指導対局 飛車落ち」)。手合いのない局は空。 */
export function pendingTeaiText(state) {
  const run = state.shoreikai ?? state.kenshukai;
  const pending = run?.pending;
  if (!pending) return '';
  if (pending.kind === 'shido') return `指導対局 ${pending.handicapLabel || '平手'}`;
  if (!pending.teai) return '';
  if (pending.teai === 'lance') return `香落ち（${pending.handicapGiver === 'player' ? `${state.name}が上手` : `${state.name}が下手`}）`;
  return `平手（${state.name}の${pending.color === 'black' ? '先手' : '後手'}）`;
}

/** 弟子の年齢(か月)。半月で1ターン。 */
export const discipleAgeMonths = (state) => (Number(state.startAge) || 12) * 12 + Math.floor((Number(state.turn) || 0) / 2);

/**
 * 研修会のA2(とS)から、奨励会の6級へ編入する(育成は続く。28章)。
 * @param {any} state 書き換えてよい写し
 * @param {string} label 編入のもとの言葉
 */
function enterShoreikai(state, label) {
  const level = effectiveLevel(discipleStrength({ stats: state.stats, aptitudes: aptitudeRanks(state), style: state.style, skills: state.skills }));
  const run = createShoreikaiRun({
    seed: (state.seed ^ 0x27d4eb2f) >>> 0, settings: { ...SHOREIKAI_SETTINGS }, examRank: 0, userName: state.name, userLevel: level,
    transfer: { from: 'kenshukai', label },
  });
  // 奨励会の年齢は弟子の年齢から(年齢制限は弟子の歳で数える)。
  run.age = discipleAgeMonths(state);
  state.shoreikai = run;
  // 研修会の記録はまとめだけ残す(研修会員の世界は使わないので、保存を軽くする)。
  const ken = state.kenshukai;
  state.kenshukai = { done: true, cls: ken?.cls ?? A2, best: ken?.best ?? ken?.cls ?? A2, qualified: true };
  state.log.push({ turn: state.turn, text: `${state.name}は${label}から奨励会6級に編入した` });
  if (state.rival && !state.rival.gone) placeRivalInShoreikai(state.rival, run, { level, ageYears: discipleAgeMonths(state) / 12 });
  queueScene(state, 'shoreikai');
}

/**
 * 入会試験の日なら研修会の挑戦を作る(試験の相手が決まる)。すでにあればそのまま。
 * @param {any} state 書き換えてよい写し
 */
function ensureKenshukai(state) {
  if (state.kenshukai) return state;
  // 試験のクラスは、やる気を入れない弟子の強さで決める(調子のよい日に高いクラスを受けすぎない)。
  const level = effectiveLevel(discipleStrength({ stats: state.stats, aptitudes: aptitudeRanks(state), style: state.style, skills: state.skills }));
  state.kenshukai = createKenshukaiRun({
    seed: (state.seed ^ 0x5bd1e995) >>> 0, settings: { ...KENSHUKAI_SETTINGS, world: OPPONENT_BASE_LEVEL }, entryClass: examClassFor(level),
    userName: state.name, userLevel: level,
  });
  return state;
}

/**
 * 入会試験・例会を弟子が指す(観戦しない局)。その日の局を全部決め、ターンを進める。
 * @param {any} state
 * @param {{ plan?: { opening?: string, ending?: string, card?: string } | null, forced?: boolean[], watchedMin?: number | null, charm?: string | null, entries?: any[] }} [options] forcedは観戦してエンジンで決めた、はじめの局の勝ち負け。entriesは観戦した本局の手(研究メモに使う)。
 *   charmは大一番に持たせたお守り(その日の局だけ効き、使うとなくなる。26章)
 *   watchedMinは観戦した局の弟子から見たいちばん低い評価値(劣勢から勝つと逆境の粘りの条件に数える)
 * @returns {{ state: any, result: { kind: 'exam' | 'reikai', games: { name: string, level: number, win: boolean, chance: number }[], wins: number, losses: number, text: string, events: string[], newSkills?: string[], newCards?: string[], charm?: string | null, overcome?: boolean } }}
 */
/** 戦法熟練度の伸び(34-17): 対局1局ごとと、研究会。熟練度は作戦帳のカードごと(35章のO2)。 */
export const MASTERY_GAIN = Object.freeze({ game: 1, study: 5 });
/** 棋譜並べを何回するごとに新しい作戦を覚えられるか、研究会で奇襲を教わる見込み(35-12。初期値)。 */
export const PLAN_STUDY_EVERY = 2;
export const STUDY_SURPRISE_CHANCE = 0.25;

/**
 * 作戦帳の候補から作戦を覚える(35-12)。
 * @returns {{ state: any, text: string }}
 */
export function learnPlan(state, cardId) {
  const next = structuredClone(state);
  next.planBook = planBookOf(next);
  if (!next.planBook.offer?.includes(cardId)) return { state, text: '' };
  const label = learnCard(next.planBook, cardId);
  if (!label) return { state, text: '' };
  // 候補はひとつ覚えたら閉じる(残りは次の作戦の勉強でまた出る)。
  delete next.planBook.offer;
  next.log.push({ turn: next.turn, text: `${label}を覚えた` });
  return { state: next, text: `${label}を覚えました。次の対局で使ってみます` };
}

/** 作戦の候補を、いまは覚えずに閉じる(候補は次の作戦の勉強でまた出る)。 */
export function skipLearn(state) {
  if (!state?.planBook?.offer) return state;
  const next = structuredClone(state);
  delete next.planBook.offer;
  return next;
}

/** 弟子の作戦帳(なければ作る。前の版の記録は、戦い方の得意戦法の熟練度を写す)。 */
export function planBookOf(state) {
  return state?.planBook ?? createPlanBook({
    style: state?.style ?? '', aptitudes: state?.aptitudes ? aptitudeRanks(state) : {},
    legacy: state?.mastery ?? null, legacyOpening: STYLE_OPENINGS[state?.style] ?? null, startingMastery,
  });
}

/** 研究会で、最後に指した作戦(なければ熟練度のいちばん高い作戦)の熟練度を伸ばす(書き換えてよい写しを渡す)。 */
function growMastery(next, amount) {
  if (!(amount > 0)) return 0;
  next.planBook = planBookOf(next);
  const head = bookHeadline(next.planBook);
  return head ? notePlanGames(next.planBook, head.id, { gain: amount }) : 0;
}

/** 弟子の札の作戦と熟練度。 */
export function masteryView(state) {
  const head = bookHeadline(planBookOf(state));
  return head ? { card: head.id, label: head.label, value: head.value, count: head.count } : null;
}

/** その日の局を指す前の形(研修会の挑戦がまだなければ作る)。watchSpecとplayEventで同じものを見る。 */
function prepareDay(state) {
  return state.shoreikai ? structuredClone(state) : ensureKenshukai(structuredClone(state));
}

/**
 * その日の作戦(35-5)。相手が研修会・奨励会のその局に選んだ得意戦法と、弟子の作戦帳から決める。種から決まるので、観戦しても結果だけ見ても同じ。
 * @param {any} next prepareDayの形
 * @param {{ opening?: string, card?: string } | null} plan 大一番の作戦(cardは師匠が選んだ作戦帳のカード)
 */
function dayPlan(next, plan) {
  const run = next.shoreikai ?? next.kenshukai;
  const member = run?.world.members[run.pending?.opponentId] ?? run?.guests?.[run?.pending?.opponentId];
  const side = run?.pending?.color === 'white' ? 'white' : 'black';
  const book = planBookOf(next);
  const rng = createRng((next.seed ^ Math.imul(next.turn + 1, 0x2c1b3c6d) ^ Math.imul((run?.dayNo ?? 0) + 7, 0x297a2d39)) >>> 0);
  // 羽音の弟子は、自分の作戦帳から選ぶ(35-14)。弟子がよく指す作戦の飛車の向きに備える。
  const rivalPick = member?.rival && next.rival
    ? rivalCard(next.rival, { opponentRook: planCard(bookHeadline(book)?.id ?? '')?.rook ?? 'static', color: side === 'black' ? 'white' : 'black', random: () => rng.next() })
    : null;
  const opponentStyle = rivalPick ? rivalStyle(rivalPick) : run?.pending?.style ?? member?.style ?? null;
  const opponentRook = opponentStyle?.rook === 'ranging' ? 'ranging' : 'static';
  const card = chooseBookCard(book, { opponentRook, opening: plan?.opening ?? null, cardId: plan?.card ?? null, color: side, random: () => rng.next() });
  return { card, book, opponentStyle, opponentRook, side, member, run, rivalCard: rivalPick };
}

export function playEvent(state, options = {}) {
  const kind = turnKind(state);
  const today = kind === 'exam' || kind === 'reikai' ? dayPlan(prepareDay(state), options.plan ?? null) : null;
  const played = playEventInner(withRivalStyle(state, today), options);
  const games = played.result?.games?.length ?? 0;
  if (!games) return played;
  const next = structuredClone(played.state);
  const rivalNews = noteRivalDay(next, played.result.games, today, options);
  // その日の局は、その日の作戦で指したものとして作戦帳に数える(熟練度・局数・勝ち数。35章のO2)。
  next.planBook = planBookOf(next);
  const news = [];
  if (today?.card) {
    notePlanGames(next.planBook, today.card.id, { games, wins: played.result.wins, gain: games * MASTERY_GAIN.game });
    // 囲いの続きは、その作戦で指した局数で開く(35-12)。
    const chained = unlockChain(next.planBook, today.card.id);
    if (chained) news.push(`${chained}まで組めるようになった`);
    // 観戦した局から、研究メモを書き足す(35-13)。メモの手で勝てば「研究が当たった」。
    if (options.entries?.length) {
      const memo = noteResearch(next.planBook, today.card.id, options.entries, { side: today.side, win: Boolean(played.result.games[0]?.win) });
      if (memo.used && played.result.games[0]?.win) news.push(`研究が当たった（研究メモの手${memo.used}手）`);
      if (memo.added) news.push(`研究メモに${memo.added}つ書き足した`);
      if (memo.forgot) news.push('外れた研究を消した');
    }
  }
  // 1局目に負けた相手の作戦は、覚えられそうな作戦に入る(やられて覚える。35-12)。
  if (played.result.games[0] && !played.result.games[0].win && noteSeen(next.planBook, today?.opponentStyle)) news.push('相手の作戦を覚えられそう');
  news.push(...rivalNews);
  if (next.lastEvent) {
    next.lastEvent.plan = today?.card ? today.card.label : '';
    next.lastEvent.events = [...next.lastEvent.events, ...news];
  }
  return { ...played, state: next, result: { ...played.result, plan: today?.card?.label ?? '', events: [...played.result.events, ...news] } };
}

/** その日のはじめの相手が羽音の弟子なら、研修会・奨励会の相手の得意戦法を、羽音の弟子の作戦にそろえる(結果だけ見ても観戦しても同じ作戦。35-14)。 */
function withRivalStyle(state, today) {
  if (!today?.rivalCard) return state;
  const next = structuredClone(state);
  const run = next.shoreikai ?? next.kenshukai;
  if (run?.pending) run.pending.style = rivalStyle(today.rivalCard);
  return next;
}

/**
 * 羽音の弟子の作戦帳に、その日の局を数えて育てる(35-14)。書き換えてよい状態を渡す。
 * はじめの局はその日の作戦、ほかの局は羽音の弟子の得意(最後に指した作戦)で指したものとして数える。
 * @returns {string[]} 知らせ
 */
function noteRivalDay(next, games, today, { entries = null } = {}) {
  const rival = next.rival;
  if (!rival?.id || rival.gone) return [];
  const news = [];
  games.forEach((game, index) => {
    if (!game.rival) return;
    const first = index === 0 && today?.rivalCard;
    const cardId = first ? today.rivalCard.id : bookHeadline(rivalBook(rival))?.id;
    if (!cardId) return;
    const other = today?.side === 'white' ? 'black' : 'white';
    news.push(...noteRivalBookGame(rival, cardId, { win: !game.win, entries: first ? entries : null, side: other }));
  });
  const run = next.shoreikai ?? next.kenshukai;
  const level = Number(run?.world?.members?.[rival.id]?.rivalLevel) || OPPONENT_BASE_LEVEL;
  const learned = growRivalBook(rival, { level });
  if (learned && rival.met) news.push(`羽音の弟子の${rival.name}が、${learned}を指しはじめたらしい`);
  return news;
}

function playEventInner(state, { plan = null, forced = [], watchedMin = null, charm = null } = {}) {
  if (state.shoreikai) return playShoreikaiEvent(state, { plan, forced, watchedMin, charm });
  const kind = turnKind(state);
  if (kind !== 'exam' && kind !== 'reikai') return { state, result: { kind: 'reikai', games: [], wins: 0, losses: 0, text: '', events: [] } };
  const next = ensureKenshukai(structuredClone(state));
  const rng = createRng(next.rng);
  const big = isBigEvent(state);
  const charmUsed = big && charm && (state.charms?.[charm] ?? 0) > 0 ? charm : null;
  const games = [];
  const events = [];
  const startDay = next.kenshukai.dayNo;
  const startClass = state.kenshukai ? state.kenshukai.cls : null;
  const startPhase = next.kenshukai.phase;
  // 前回の例会の対戦表(会の画面。36-5)のため、この日の組み合わせを覚えておく。
  const dayBefore = startPhase === 'reikai' && next.kenshukai.day ? structuredClone(next.kenshukai.day) : null;
  const worldBefore = { ...next.kenshukai.world.members, ...(next.kenshukai.guests ?? {}) };
  const rivalNews = rivalBeforeDay(next, 'kenshukai', rng);
  if (rivalNews) events.push(rivalNews);
  const rivalMet = next.rival?.met ?? 0;
  // 試験は全局、例会はその日の局を指す(次の日の局が決まったら止める)。
  for (let guard = 0; guard < 12 && next.kenshukai.pending; guard += 1) {
    const run = next.kenshukai;
    if (startPhase === 'reikai' && run.dayNo !== startDay) break;
    if (startPhase === 'exam' && run.phase !== 'exam') break;
    const member = run.world.members[run.pending.opponentId] ?? run.guests?.[run.pending.opponentId];
    const level = pendingOpponentLevel(next, member);
    // 相手の飛車の向きは、その局に選んだ得意戦法で見る(前は比べ方の誤りで、いつも対居飛車だった。35-1)。
    const battle = (run.pending?.style ?? member?.style)?.rook === 'ranging' ? 'ranging' : 'static';
    const charmed = withCharm(next, charmUsed);
    const strength = currentStrength(charmed, { battle, time: 'fast' });
    const fit = big && plan ? planFit(charmed, plan, { level }).bonus : 0;
    const chance = clamp(winChance(effectiveLevel(strength), level) + fit, 0.03, 0.97);
    // 観戦した局は、エンジンが盤の上で決めた勝ち負け(19-6)。乱数は同じだけ進める(観戦してもしなくても、あとの局は同じ)。
    const roll = rng.next();
    const watched = games.length < forced.length;
    const win = watched ? Boolean(forced[games.length]) : roll < chance;
    games.push({ name: member?.name ?? '', level: round1(level), win, chance: Math.round(chance * 100) / 100, watched, rival: Boolean(member?.rival) });
    if (member?.rival && next.rival) noteRivalGame(next.rival, win);
    const gain = GAME_EXP.played + (win ? GAME_EXP.won : 0);
    next.stats = addGains(next.stats, Object.fromEntries(STAT_KEYS.map((key) => [key, gain])));
    next.kenshukai = recordKenshukaiGame(run, win ? 'win' : 'loss', { userLevel: effectiveLevel(strength) });
    for (const event of next.kenshukai.events ?? []) events.push(event.text);
  }
  const wins = games.filter((game) => game.win).length;
  const losses = games.length - wins;
  // 入会試験を終えたら、羽音の弟子が同じクラスの同期として入る(30章。試験の相手にはしない)。
  next.rival ??= createRival();
  if (!next.rival.id && next.kenshukai.phase !== 'exam') {
    placeRivalInKenshukai(next.rival, next.kenshukai, { level: effectiveLevel(currentStrength(next)), ageYears: discipleAgeMonths(next) / 12 });
  }
  if (big) next.bigWins = (next.bigWins ?? 0) + wins;
  if (dayBefore) next.lastDay = dayRecord(dayBefore, worldBefore, games, { kind: 'kenshukai', rank: startClass ?? next.kenshukai.cls });
  if (games[0]?.watched && games[0].win && Number(watchedMin) <= COMEBACK_EVAL) next.comebacks = (next.comebacks ?? 0) + 1;
  if (charmUsed) useCharm(next, charmUsed);
  // 大一番で負け越すとやる気が1段下がる(不屈を覚えていれば下がらない。19-4の15)。
  const bigLost = big && wins < losses;
  if (bigLost && !next.skills.includes('unbroken')) next.mood = clamp(next.mood - 1, -2, 2);
  const promoted = startClass !== null && next.kenshukai.cls > startClass;
  const overcome = overcomeSlump(next, { big, wins, losses }, MAX_SKILLS);
  const label = kind === 'exam' ? '入会試験' : `第${startDay + 1}回例会`;
  const text = `${label} ${wins}勝${losses}敗${events.length ? `。${events.join('・')}` : ''}`;
  next.log.push({ turn: next.turn, text });
  next.stamina = clamp(next.stamina - 10, 0, 100);
  next.lastEvent = { kind, label, games, wins, losses, events, big, charm: charmUsed, overcome };
  const grown = growth(next);
  next.lastEvent.newSkills = grown.newSkills;
  next.lastEvent.newCards = grown.newCards;
  if (big || losses > 0) next.words = { big, lost: losses > 0 };
  const queued = next.sceneQueue?.length ?? 0;
  checkScenes(next, { event: { big, wins, losses, promoted } });
  rivalScene(next, games, rivalMet, queued);
  // A2で奨励会への編入の資格(28章: 育成は終わらず、奨励会の6級へ編入する)。
  if (next.kenshukai.cls >= A2 || next.kenshukai.qualified || next.kenshukai.cls >= TOP) {
    next.kenshukai.qualified = true;
    enterShoreikai(next, `研修会${classLabel(next.kenshukai.cls)}`);
  }
  advanceTurn(next, rng);
  next.rng = rng.state;
  return { state: next, result: { kind, games, wins, losses, text, events, newSkills: grown.newSkills, newCards: grown.newCards, charm: charmUsed, overcome } };
}

/**
 * 例会の前に、羽音の弟子の強さを弟子に合わせる(30章)。先に進んでいなくなったら、その知らせを返す。
 * @param {any} state 書き換えてよい写し
 * @param {'kenshukai' | 'shoreikai'} kind
 * @param {{ next(): number }} rng
 */
function rivalBeforeDay(state, kind, rng) {
  const run = kind === 'shoreikai' ? state.shoreikai : state.kenshukai;
  if (!state.rival || !run) return '';
  const level = effectiveLevel(discipleStrength({ stats: state.stats, aptitudes: aptitudeRanks(state), style: state.style, skills: state.skills }));
  const news = syncRival(state.rival, run, { level, ageYears: discipleAgeMonths(state) / 12, kind, rng });
  if (news) state.log.push({ turn: state.turn, text: news });
  return news;
}

/**
 * 羽音の弟子と当たった日の場面(30章)。はじめて当たった日はいつも、そのあとは、ほかの場面がこの日に積まれていなければ。
 * @param {any} state 書き換えてよい写し
 * @param {readonly { rival?: boolean, win: boolean }[]} games
 * @param {number} metBefore この日より前に当たった数
 * @param {number} queuedBefore この日の場面を積む前の数
 */
function rivalScene(state, games, metBefore, queuedBefore) {
  const game = games.find((item) => item.rival);
  if (!game || state.end) return;
  if (metBefore === 0) {
    queueScene(state, 'rival-first');
    return;
  }
  if ((state.sceneQueue?.length ?? 0) > queuedBefore) return;
  queueScene(state, game.win ? 'rival-win' : 'rival-lose');
}

/** 対戦表の1人(名前と、そのときのクラス・段級)。 */
function seatOf(all, id, kind) {
  const member = all[id];
  if (!member) return { id, name: '', place: '' };
  const place = kind === 'kenshukai'
    ? (member.kind === 'teacher' ? member.dan ?? '' : `${classLabel(member.cls ?? 0)}`)
    : member.dan ?? '';
  return { id, name: member.name ?? '', place, rival: Boolean(member.rival), peer: Boolean(member.peer) };
}

/** 前回の例会の対戦表に出す、ほかの局の数の上限(弟子の段級に近い局から)。 */
const LAST_DAY_OTHERS = 12;

/**
 * 終えた例会の対戦表(会の画面の「前回の例会」。36-5)。名前とクラスは、そのときのものを残す。
 * @param {any} day 研修会・奨励会のその日の形(opponents・kinds・teai・others)
 * @param {Record<string, any>} all その日の会員と先生
 * @param {{ win: boolean, name?: string }[]} games 弟子の局の結果(その日の順)
 * @param {{ kind: 'kenshukai' | 'shoreikai' | 'league', rank: number, league?: { term: number, round: number } | null }} info
 */
function dayRecord(day, all, games, { kind, rank, league = null }) {
  const placeKind = kind === 'kenshukai' ? 'kenshukai' : 'shoreikai';
  const rankOf = (id) => (kind === 'kenshukai' ? all[id]?.cls : all[id]?.rank);
  // 三段リーグの日は組み合わせが表にないので、局の相手の名前から。
  const mine = games.map((game, index) => ({
    opponent: day.opponents?.[index] ? seatOf(all, day.opponents[index], placeKind) : { id: '', name: game.name ?? '', place: '三段' },
    kind: day.kinds?.[index] ?? 'game',
    teai: day.teai?.[index] ?? null,
    win: Boolean(games[index]?.win),
  }));
  const others = (day.others ?? [])
    .filter((game) => all[game.a] && all[game.b])
    .map((game) => ({ ...game, near: Math.min(Math.abs((rankOf(game.a) ?? rank) - rank), Math.abs((rankOf(game.b) ?? rank) - rank)) }))
    .sort((a, b) => a.near - b.near || (a.round ?? 0) - (b.round ?? 0))
    .slice(0, LAST_DAY_OTHERS)
    .sort((a, b) => (a.round ?? 0) - (b.round ?? 0) || a.near - b.near)
    .map((game) => ({ round: game.round ?? null, a: seatOf(all, game.a, placeKind), b: seatOf(all, game.b, placeKind), winner: game.winner, teai: game.teai ?? null, giver: game.giver ?? null, black: game.black ?? null }));
  return { kind, no: day.no, league, mine, others };
}

/** 奨励会の知らせのうち、年齢制限で去った人の行(shoreikai.mjsのcloseLeagueの言葉)。 */
const AGE_LIMIT_FEED = /^(.+?)さんが、年齢制限で奨励会を去った$/;

/** 奨励会の節目の場面(28章)。 */
const SHOREIKAI_MILESTONES = Object.freeze({ shodan: SHODAN, sandan: SANDAN });

/**
 * 奨励会の例会・三段リーグを弟子が指す(28章)。その日の局を全部決め、ターンを進める。研修会のplayEventと同じ形の結果を返す。
 * @param {any} state
 * @param {{ plan?: { opening?: string, ending?: string } | null, forced?: boolean[], watchedMin?: number | null, charm?: string | null }} options
 */
function playShoreikaiEvent(state, { plan = null, forced = [], watchedMin = null, charm = null }) {
  const next = structuredClone(state);
  const rng = createRng(next.rng);
  const big = isBigEvent(state);
  const charmUsed = big && charm && (state.charms?.[charm] ?? 0) > 0 ? charm : null;
  const games = [];
  const events = [];
  const startDay = next.shoreikai.dayNo;
  const startRank = next.shoreikai.rank;
  const label = next.shoreikai.pending?.eventText ?? '奨励会';
  const dayBefore = next.shoreikai.day ? structuredClone(next.shoreikai.day) : null;
  const leagueBefore = next.shoreikai.phase === 'league' && next.shoreikai.league ? { term: next.shoreikai.league.term, round: next.shoreikai.league.round } : null;
  const worldBefore = { ...next.shoreikai.world.members };
  const rivalNews = rivalBeforeDay(next, 'shoreikai', rng);
  if (rivalNews) events.push(rivalNews);
  const rivalMet = next.rival?.met ?? 0;
  // 年齢制限の先輩の場面(32章)のため、この日の前の知らせを覚えておく。
  const feedBefore = new Set((next.shoreikai.world?.feed ?? []).map((entry) => `${entry.month}|${entry.text}`));
  for (let guard = 0; guard < 12 && next.shoreikai.pending; guard += 1) {
    const run = next.shoreikai;
    if (run.dayNo !== startDay) break;
    const member = run.world.members[run.pending.opponentId];
    const level = pendingOpponentLevel(next, member);
    // 相手の飛車の向きは、その局に選んだ得意戦法で見る(前は比べ方の誤りで、いつも対居飛車だった。35-1)。
    const battle = (run.pending?.style ?? member?.style)?.rook === 'ranging' ? 'ranging' : 'static';
    const charmed = withCharm(next, charmUsed);
    // 三段リーグは長い持ち時間ではないが、1局の重みが大きい(大一番の作戦が効く)。
    const strength = currentStrength(charmed, { battle, time: 'fast' });
    const fit = big && plan ? planFit(charmed, plan, { level }).bonus : 0;
    const chance = clamp(winChance(effectiveLevel(strength), level) + fit, 0.03, 0.97);
    const roll = rng.next();
    const watched = games.length < forced.length;
    const win = watched ? Boolean(forced[games.length]) : roll < chance;
    games.push({ name: member?.name ?? '', level: round1(level), win, chance: Math.round(chance * 100) / 100, watched, rival: Boolean(member?.rival) });
    if (member?.rival && next.rival) noteRivalGame(next.rival, win);
    const gain = GAME_EXP.played + (win ? GAME_EXP.won : 0);
    next.stats = addGains(next.stats, Object.fromEntries(STAT_KEYS.map((key) => [key, gain])));
    next.shoreikai = recordShoreikaiGame(run, win ? 'win' : 'loss', { userLevel: effectiveLevel(strength) });
    for (const event of next.shoreikai.events ?? []) events.push(event.text);
    if (next.shoreikai.phase === 'pro' || next.shoreikai.phase === 'retired') break;
  }
  const wins = games.filter((game) => game.win).length;
  const losses = games.length - wins;
  if (big) next.bigWins = (next.bigWins ?? 0) + wins;
  if (dayBefore) next.lastDay = dayRecord(dayBefore, worldBefore, games, { kind: leagueBefore ? 'league' : 'shoreikai', rank: startRank, league: leagueBefore });
  if (games[0]?.watched && games[0].win && Number(watchedMin) <= COMEBACK_EVAL) next.comebacks = (next.comebacks ?? 0) + 1;
  if (charmUsed) useCharm(next, charmUsed);
  const bigLost = big && wins < losses;
  if (bigLost && !next.skills.includes('unbroken')) next.mood = clamp(next.mood - 1, -2, 2);
  const overcome = overcomeSlump(next, { big, wins, losses }, MAX_SKILLS);
  const run = next.shoreikai;
  const text = `${label} ${wins}勝${losses}敗${events.length ? `。${events.join('・')}` : ''}`;
  next.log.push({ turn: next.turn, text });
  next.stamina = clamp(next.stamina - 10, 0, 100);
  next.lastEvent = { kind: 'reikai', label, games, wins, losses, events, big, charm: charmUsed, overcome };
  const grown = growth(next);
  next.lastEvent.newSkills = grown.newSkills;
  next.lastEvent.newCards = grown.newCards;
  if (big || losses > 0) next.words = { big, lost: losses > 0 };
  const queued = next.sceneQueue?.length ?? 0;
  checkScenes(next, { event: { big, wins, losses, promoted: false } });
  rivalScene(next, games, rivalMet, queued);
  // 年齢制限で去った先輩が知らせに出たら、ほかの場面が積まれていないときに1回(32章)。
  if ((next.sceneQueue?.length ?? 0) === queued) {
    const left = (next.shoreikai.world?.feed ?? []).filter((entry) => !feedBefore.has(`${entry.month}|${entry.text}`))
      .map((entry) => AGE_LIMIT_FEED.exec(entry.text)?.[1]).find(Boolean);
    if (left) checkAgeLimit(next, left);
  }
  // 節目(初段・三段リーグ入り)の場面。
  for (const [key, rank] of Object.entries(SHOREIKAI_MILESTONES)) {
    if (startRank < rank && run.rank >= rank && !(next.scenesSeen?.[key])) queueScene(next, key);
  }
  if (run.phase === 'pro') {
    next.words = null;
    queueScene(next, 'pro');
    finish(next, 'pro');
  } else if (run.phase === 'retired') {
    next.words = null;
    queueScene(next, 'retired');
    finish(next, 'retired');
  } else advanceTurn(next, rng);
  next.rng = rng.state;
  return { state: next, result: { kind: 'reikai', games, wins, losses, text, events, newSkills: grown.newSkills, newCards: grown.newCards, charm: charmUsed, overcome } };
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
 * @param {{ plan?: { opening?: string, ending?: string, card?: string } | null, charm?: string | null }} [options] charmは大一番に持たせたお守り
 */
export function watchSpec(state, { plan = null, charm = null } = {}) {
  const kind = turnKind(state);
  if (kind !== 'exam' && kind !== 'reikai') return null;
  const next = prepareDay(state);
  // 駒落ちの局は、まだ観戦しない(結果だけ。36-4)。
  if (pendingIsHandicap(next)) return null;
  const { card: ownCard, book, opponentStyle, opponentRook, side, member, run, rivalCard: rivalPick } = dayPlan(next, plan);
  if (!member) return null;
  const level = next.shoreikai ? shoreikaiOpponentLevel(member) : opponentLevel(member, run.cls);
  const eventKind = next.shoreikai ? 'shoreikai' : 'kenshukai';
  const other = side === 'black' ? 'white' : 'black';
  // 相手の作戦は、研修会・奨励会が1局ごとに相手の得意戦法から選んだもの(pending.style)。前は比べ方の誤りで、いつも相掛かり＋舟囲いだった(35-1)。
  // 弟子の作戦は、作戦帳の中から、相手の飛車の向きに合うカードを熟練度で選ぶ(35-5)。力戦なら定跡なし。
  const battle = battleKey(ownCard, opponentRook);
  const strength = currentStrength(isBigEvent(state) ? withCharm(next, charm) : next, { battle, time: 'fast' });
  const attack = clamp(strength.attack + (ENDING_ATTACK[plan?.ending ?? ''] ?? 0), -1, 1);
  const mastery = ownCard ? book.cards[ownCard.id]?.mastery ?? 0 : 0;
  // 組み替えてよい囲いは、作戦帳で知っている囲いだけ。
  const knownCastles = [...new Set(Object.keys(book.cards).map((id) => planCard(id)?.castleId).filter(Boolean))];
  const disciple = {
    id: 'disciple', name: next.name, level: Math.round(effectiveLevel(strength)), kind: eventKind,
    disciple: { strength: { ...strength, attack }, profile: { weakness: next.weakness, aptitudes: aptitudeRanks(next), style: next.style }, time: 'fast' },
    reason: { levels: { ...strength.levels }, mastery, notes: ownCard ? researchNotes(book, ownCard.id) : {} },
  };
  const opponentLevels = { reading: level, plan: level, steady: level, mate: level };
  const plans = {
    [side]: ownCard ? planSpec(ownCard, { steps: bookChainSteps(book, ownCard.id, strength.levels?.plan), castles: knownCastles }) : null,
    [other]: rivalPick ? rivalPlanSpec(next.rival, rivalPick, level) : opponentPlanSpec(opponentStyle, level),
  };
  const opponent = {
    id: member.id, name: member.name, level: Math.round(level), kind: eventKind, character: member.character ?? null,
    repertoire: member.repertoire ?? null, style: member.style ?? null,
    // 羽音の弟子は作戦帳の熟練度と研究メモで指す(35-14)。
    reason: rivalPick
      ? { levels: opponentLevels, mastery: rivalBook(next.rival).cards[rivalPick.id]?.mastery ?? 0, notes: researchNotes(rivalBook(next.rival), rivalPick.id) }
      : { levels: opponentLevels, mastery: masteryForLevel(level) },
  };
  const spec = {
    key: `disciple:${next.seed}:${next.turn}:${run.dayNo}:${run.games.length}`, seed: (next.seed ^ Math.imul(next.turn + 1, 0x9e3779b1)) >>> 0,
    event: eventKind, kind: 'game', label: next.shoreikai ? run.pending?.label ?? '奨励会' : kind === 'exam' ? '入会試験' : `第${run.dayNo}回例会`,
    [side]: disciple, [other]: opponent,
    openings: { [side]: null, [other]: opponentStyle?.opening ?? opponentStyle?.id ?? null },
    plans,
  };
  // 観戦の札の「今日の作戦」(35-7)。
  const today = { own: ownCard?.label ?? '力戦', opponent: opponentStyle?.label ?? '' };
  return { spec, side, opponent: { name: member.name, level: round1(level) }, state: next, card: ownCard?.id ?? null, plans: today };
}

/** 師匠の眼の段(見抜いた数で上がる。19-5)。 */
/** 終局の札の言葉(33-3)。reasonは本局の終わり方(engine-game.mjsのend.reason)。 */
export function endCardText({ win, reason = 'resign', plies = 0 }) {
  const how = reason === 'mate' ? (win ? '詰ませて' : '詰まされて') : (win ? '相手が投了' : '投了');
  return { stamp: win ? '勝ち' : '負け', line: `${plies}手で終局　${how}` };
}

/**
 * 観戦した日の結果発表の札(33-3)。その日の局の○●・勝ち負けの数・知らせ・大一番か。観戦した局に印。
 * @param {{ label?: string, games?: { name: string, win: boolean, chance?: number, watched?: boolean, rival?: boolean }[], wins?: number, losses?: number, events?: string[], big?: boolean } | null | undefined} event その日の記録(lastEvent)
 */
export function dayResultView(event) {
  const games = (event?.games ?? []).map((game, index) => ({
    no: index + 1, name: game.name, win: Boolean(game.win), watched: Boolean(game.watched), rival: Boolean(game.rival),
    chance: Math.round((Number(game.chance) || 0) * 100),
  }));
  const wins = event?.wins ?? games.filter((game) => game.win).length;
  const losses = event?.losses ?? games.length - wins;
  const big = Boolean(event?.big);
  const headline = big ? `大一番　${wins > losses ? '勝ち越し' : wins === losses ? '五分' : '負け越し'}` : `${wins}勝${losses}敗`;
  return {
    label: event?.label ?? '', games, wins, losses, big, headline,
    marks: games.map((game) => (game.win ? '○' : '●')).join(''),
    events: [...(event?.events ?? [])],
  };
}

export const eyeDan = (found) => clamp(1 + Math.floor((Number(found) || 0) / 5), 1, 9);
/** 隠れた弱点と、それを見抜く理由(同じ理由を3回見抜くと名前が出る)。 */
/** 隠れた弱点と、それを見抜くために数える崩れ方(33-5。時間に追われるは、秒読みの背景の札を数える)。 */
export const WEAKNESS_CAUSE = Object.freeze({ careless: 'careless', 'time-trouble': 'time', 'big-stage-weak': 'policy', 'loose-when-ahead': 'yose', 'endgame-collapse': 'defense' });
export const WEAKNESS_LABELS = Object.freeze({
  careless: 'うっかりが多い', 'time-trouble': '時間に追われる', 'big-stage-weak': '大舞台で硬くなる', 'loose-when-ahead': '優勢で緩む', 'endgame-collapse': '終盤で頓死する',
});

/**
 * 観戦の見立ての答えを入れる(19-5)。印ごとの理由の5択から、狙い目・見抜いた数・隠れた弱点の名前を決める。
 * @param {any} state
 * @param {readonly { cause: string, alt?: string | null, tags?: string[] }[]} marks
 * @param {readonly (string | null)[]} guesses 印ごとに選んだ理由(選ばなかった印はnull)
 * @param {{ seekHit?: boolean, praised?: string }} [extra] 分かれ目さがしを見抜いたか・ほめた好手の名前(33-6)
 */
export function applyFindings(state, marks, guesses, { seekHit = false, praised = '' } = {}) {
  const next = structuredClone(state);
  next.causes ??= {};
  next.spotted ??= {};
  next.eye ??= 0;
  // 分かれ目さがしを見抜いたら師匠の眼に1つ(33-6)。
  if (seekHit) {
    next.eye += 1;
    next.log.push({ turn: next.turn, text: '分かれ目を見抜いた' });
  }
  // 好手をほめたら、1局に1回やる気が上がる(33-6。D:5-4)。
  if (praised) {
    next.mood = clamp((next.mood ?? 0) + 1, -2, 2);
    next.log.push({ turn: next.turn, text: `好手「${praised}」をほめた` });
  }
  const results = [];
  marks.forEach((mark, index) => {
    const guess = guesses[index];
    if (!guess) return;
    // 6つの崩れ方(33-5)は主・副・外れで判定する。前の版の理由(棋譜帳に残ったもの)は前の判定。
    const judged = REVIEW_CAUSES[mark.cause] ? judgeReviewGuess(mark, guess) : judgeGuess(mark, guess);
    // 時間切迫は持ち時間の適性(早指しの稽古)の狙い目。
    const target = judged.target === 'time' ? 'steady' : judged.target;
    if (target) next.aims[target] = { boost: Math.max(next.aims[target]?.boost ?? 1, judged.boost), turns: judged.turns };
    // 秒読みの手は、早指しの稽古(安定)も狙い目にし、背景の札として数える。
    if (/** @type {any} */ (judged).time) {
      next.aims.steady = { boost: Math.max(next.aims.steady?.boost ?? 1, judged.boost), turns: judged.turns };
      next.causes.time = (next.causes.time ?? 0) + 1;
    }
    next.causes[mark.cause] = (next.causes[mark.cause] ?? 0) + 1;
    if (judged.right) {
      next.eye += 1;
      if (REVIEW_CAUSES[mark.cause]) next.spotted[mark.cause] = (next.spotted[mark.cause] ?? 0) + 1;
    }
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

/** 好手をほめたときの弟子の一言(33-6。仮の台詞)。 */
const PRAISE_LINES = Object.freeze({
  minato: (name) => `あの${name}、見ててくれたんですね。ちょっと自信がつきました`,
  tsumugi: (name) => `あの${name}は、ちゃんと読んで指しました。気づいてもらえてうれしいです`,
  ao: (name) => `あの${name}、すごかった？　やったー、次もねらってみる！`,
});
/** @param {string} discipleId @param {string} name */
export function praiseLine(discipleId, name) {
  return (PRAISE_LINES[discipleId] ?? PRAISE_LINES.minato)(name);
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
  const best = state.shoreikai ? `奨励会${rankLabel(state.shoreikai.best ?? state.shoreikai.rank)}`
    : state.kenshukai ? classLabel(state.kenshukai.best ?? state.kenshukai.cls) : '';
  const text = kind === 'pro' ? `${state.name}は四段に昇段し、プロ棋士になった（棋士番号${state.shoreikai?.kishiNumber ?? ''}）`
    : kind === 'retired' ? `${state.name}は奨励会を退会した（最高 ${best}）`
      : state.shoreikai ? `${state.name}の育成はここまで（${best}）`
        : kind === 'qualified' ? `${state.name}は研修会A2クラスに昇級し、奨励会への編入の資格を得た`
    : kind === 'top' ? `${state.name}は研修会Sクラスに昇級した`
      : `${state.name}の育成はここまで（研修会 ${best || '入会前'}）`;
  state.end = { kind, text, turn: state.turn, best, rank: endRank(state, kind) };
  state.log.push({ turn: state.turn, text });
}

/** 四段になってS評価になるターンの上限(8年)。 */
export const PRO_FAST_TURNS = 24 * 8;

/** 育成の評価(13章)。到達したクラスと、かかったターンから。 */
function endRank(state, kind) {
  // 奨励会まで進んだ育成(28章): 四段は早さで、退会はどこまで上がったかで。
  if (state.shoreikai) {
    const best = state.shoreikai.best ?? state.shoreikai.rank;
    if (kind === 'pro') return state.turn <= PRO_FAST_TURNS ? 'S' : 'A';
    return best >= SANDAN ? 'B' : best >= SHODAN ? 'C' : 'D';
  }
  const cls = state.kenshukai?.best ?? -1;
  let score = (cls + 1) * 10 + (kind === 'qualified' || kind === 'top' ? Math.max(0, MAX_TURNS - state.turn) : 0);
  score += Math.round(STAT_KEYS.reduce((sum, key) => sum + state.stats[key], 0) / 80);
  return score >= 200 ? 'S' : score >= 150 ? 'A' : score >= 110 ? 'B' : score >= 70 ? 'C' : 'D';
}

/** 羽音の弟子の札(30章)。まだ会っていなければnull。 */
export function rivalView(state) {
  const rival = state.rival;
  if (!rival?.id) return null;
  const run = state.shoreikai ?? state.kenshukai;
  const member = run?.world?.members?.[rival.id];
  const where = rival.gone === 'pro' ? '四段' : member ? member.dan ?? '' : rival.ahead ? '奨励会' : '';
  // 育成が終わったら、羽音の弟子も四段になるか(32章)。
  // 羽音の弟子の得意(最後に指した作戦)と、知っている作戦の数(35-14)。
  const head = bookHeadline(rivalBook(rival));
  return { name: rival.name, where, wins: rival.wins, losses: rival.losses, met: rival.met, plan: head?.label ?? '', plans: head?.count ?? 0, pro: Boolean(state.end) && rivalFate(state) === 'pro' };
}

/** いまいる場所の短い言葉(能力の欄・記録の札)。 */
export function placeText(state) {
  if (state.shoreikai) {
    const run = state.shoreikai;
    if (run.phase === 'pro') return '四段';
    return run.phase === 'league' ? '奨励会 三段（三段リーグ）' : `奨励会 ${rankLabel(run.rank)}`;
  }
  return state.kenshukai ? `研修会 ${classLabel(Number.isFinite(state.kenshukai.cls) ? state.kenshukai.cls : 0)}` : '研修会前';
}

/** 本番の札の題名。 */
function eventTitle(state) {
  if (state.shoreikai) return state.shoreikai.pending?.eventText ?? '奨励会';
  return turnKind(state) === 'exam' ? '研修会 入会試験' : '研修会の例会';
}

/**
 * 画面に出す形(育成のホーム)。
 * @param {any} state
 */
/** 作戦帳の見え方(知っている作戦の数と、その日の相手に合う作戦の候補)。 */
function bookView(state) {
  const book = planBookOf(state);
  const kind = turnKind(state);
  const day = kind === 'exam' || kind === 'reikai' ? dayPlan(prepareDay(state), null) : null;
  return {
    count: Object.keys(book.cards).length,
    choices: day ? bookChoices(book, { opponentRook: day.opponentRook, color: day.side }) : [],
    opponentStyle: day?.opponentStyle?.label ?? '',
    /** 作戦帳のシートの行と、覚えられる候補・覚えられそうな作戦(35-12)。 */
    rows: bookRows(book),
    offer: (book.offer ?? []).map((id) => planCard(id)).filter(Boolean).map((card) => ({ id: card.id, label: card.label, tier: card.tier, vs: card.vs })),
    seen: (book.seen ?? []).map((id) => planCard(id)?.label).filter(Boolean),
  };
}

export function discipleView(state) {
  if (!state) return null;
  const strength = currentStrength(state);
  const calendar = turnCalendar(state.turn, state.startGrade);
  const kenshukai = state.kenshukai && !state.kenshukai.done ? describeKenshukai(state.kenshukai) : null;
  const shoreikai = state.shoreikai ? describeShoreikai(state.shoreikai) : null;
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
    /** 崩れ方ごとの見抜いた回数(33-6)。 */
    spotted: spottedCounts(state.spotted),
    /** 得意戦法の熟練度(34-17)。 */
    mastery: masteryView(state),
    aptitudes: state.aptitudes,
    trainings: TRAININGS.map((training) => trainingPreview(state, training.id)),
    deck: lessonDeck(state),
    skillProgress: skillProgress(state),
    charms: charmList(state),
    rival: rivalView(state),
    scene: pendingScene(state),
    friends: teamOf(state).map((friend) => ({ ...friend, bond: state.bonds[friend.id] ?? 0 })),
    kenshukai: kenshukai ? { classLabel: kenshukai.classLabel, progress: kenshukai.progress, board: kenshukai.board, phase: kenshukai.phase } : null,
    shoreikai: shoreikai ? { rankLabel: shoreikai.rankLabel, phase: shoreikai.phase, progress: shoreikai.progress, league: shoreikai.league ? { term: shoreikai.league.term, round: shoreikai.league.round, rounds: shoreikai.league.rounds } : null, point: shoreikai.point, age: shoreikai.age } : null,
    place: placeText(state),
    age: Math.floor(discipleAgeMonths(state) / 12),
    stakes: state.shoreikai?.pending?.stakes?.text ? `${state.shoreikai.pending.stakes.text}${state.shoreikai.pending.stakes.goal ? `　${state.shoreikai.pending.stakes.goal}` : ''}` : '',
    eventTitle: eventTitle(state),
    big: isBigEvent(state),
    opponent: turnKind(state) === 'exam' || turnKind(state) === 'reikai' ? eventOpponent(state) : null,
    /** 今日の1局目を観戦できるか(駒落ちの局はまだ観戦しない。36-4)。 */
    watchable: !pendingIsHandicap(state),
    /** 作戦帳(35章のO2)。大一番の作戦の欄は、相手の飛車の向きに合う作戦を3つまで。 */
    book: bookView(state),
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
    if (parsed.shoreikai?.world?.members) parsed.shoreikai.players = { ...parsed.shoreikai.world.members };
    // 前の版の保存にも、次の例会から手合いを付ける(36-4)。指導対局は、先生のいない前の挑戦では付かない。
    if (parsed.kenshukai?.settings && !parsed.kenshukai.done) parsed.kenshukai.settings.teai ??= true;
    if (parsed.shoreikai?.settings) parsed.shoreikai.settings.teai ??= true;
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
