// 本局: 観戦する対局を、エンジンが本当に指して勝ち負けを決める(docs/tournament-relay-design.mdの20章、段階1)。
// 両側とも、プレイヤーが当たるときと同じCPU(Lvの強さ設定・棋風と特徴・得意戦法の定跡)で指す。勝ち負けは盤の上で決まる。
// 1手ごとに中継の棋譜と同じ形(relay-game.mjsのRelayMoveEntry)で渡すので、中継の画面と回戦のボードはそのまま使える。
// エンジンの呼び出しは、引数のsearchに任せる(画面に依存しない)。途中までの棋譜(resume)から続きを指せる。

import { discipleMoveSettings } from './disciple-strength.mjs';
import { thinkHere } from './reason-think.mjs';
import { createBookTracker, followUpTurn, noteBook } from './strategy-mastery.mjs';
import { advancePlan } from './disciple-plans.mjs';
import { appendUsiMove, createGameRecord, enumerateLegalMoves, STANDARD_SFEN } from '../game-state';
import { createRng } from './ryuo-random.mjs';
import { CPU_STRENGTH_PRESETS, getStrengthSearchSettings, logicLevelOf } from './strength-settings.mjs';
import { currentLevelFromV3 } from './level-ladder.mjs';
import { applyCharacter, characterSituation } from './player-character.mjs';
import { canBlunder, chooseCpuMove, isBlunderChoice } from './cpu-move-choice.mjs';
import { humanBlunderAllowance, noteHumanBlunder } from './human-model.mjs';
import { chooseAwareMove } from './aware-move-choice.mjs';
import { chooseLogicMove } from './logic-ai.mjs';
import { classifyWin } from './ryuo-simulation.mjs';
import {
  CP_PER_RATING, ONLY_MOVE_GAP, PLAN_LOSS_LIMIT, RELAY_MAX_PLIES, RELAY_VERSION, THEORY_PLY, createRelayClock, isMateCp,
  openingPlanMove, openingPlanOf, rankedCandidates, relayPlan, storedPv, valueToCp,
} from './relay-game.mjs';
import { winRate } from './move-selection.mjs';
import { createFormationState, detectFormationSnapshot, formationMove, updateFormationState } from './formation-tracker.mjs';
import { packRelayGame, unpackRelayGame } from './relay-store.mjs';
import { HANANE, YOSHIHIKO } from './ryuo-story.mjs';
import { MAX_CPU_LEVEL, REAL_WORLD, WORLD_BASE_RATING, isRealWorld, worldCpuLevel } from './ryuo-strength.mjs';
import { resignStyleById, resignStyleOf, resignsBy } from './resign-style.mjs';

/** ロジックAIで指すLvの手の、形勢を見るための読み(画面のバーと解説に使う)。 */
export const EVAL_NODES = 3000;
/** 弟子の時計の「残りが少ない」(持ち時間の1割より少ない)。 */
const DISCIPLE_LOW_TIME = 0.1;
/** 手の印の、最善手との差(点)。 */
export const MARK_LOSS = Object.freeze({ decisive: 600, error: 250, slip: 100 });
/** 投了は、この手数までは投げない(序盤の大差は、まだ指す)。いつ投げるかは、棋士の投了の早さ(resign-style.mjs。29章)。 */
const RESIGN_MIN_PLY = 40;

/** 平手の、何手目(0から)をどちらが指すか。駒落ちの局はplayEngineGameの中で、はじめの局面から決め直す。 */
const standardSideOf = (ply) => (ply % 2 === 0 ? 'black' : 'white');
const other = (side) => (side === 'black' ? 'white' : 'black');
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
/** 盤の局面の鍵(手数を除く)。千日手を避けるのに使う。 */
const positionKey = (sfen) => sfen.split(' ').slice(0, 3).join(' ');

// ---- 主要キャラと、観戦用の読み(20-9)

/** 主要キャラ(分身・羽音・善彦)か。主要キャラの対局は、対局用と同じ読みの量で指す(ユーザーの判断)。 */
export function isMainCharacter(player) {
  return player?.id === 'user' || player?.story === HANANE || player?.story === YOSHIHIKO;
}

/** 観戦用の読み: 主要キャラ以外の対局は、読む量を4分の1にする(10,000ノードより少なくはしない。それ以下のLvは同じ)。 */
export const LIGHT_NODES_FLOOR = 10000;
export function lightReading(settings) {
  if (!(settings.nodes > LIGHT_NODES_FLOOR)) return settings;
  return { ...settings, nodes: Math.max(LIGHT_NODES_FLOOR, Math.round(settings.nodes / 4)), searchThreads: 1 };
}

/**
 * 棋士のLvの強さ設定。Lv1〜49(大会の棋士にLv0はいない)。sourceが10以下のLvはロジックAIで指す。
 * lightは観戦用の読み(主要キャラ以外どうしの対局)。
 * @param {{ level?: number | null }} player
 * @param {{ light?: boolean }} [options]
 */
export function engineStrength(player, { light = false } = {}) {
  const level = clamp(Math.round(Number(player?.level) || 1), 1, 49);
  const preset = CPU_STRENGTH_PRESETS.find((entry) => entry.level === level) ?? CPU_STRENGTH_PRESETS.at(-1);
  const settings = getStrengthSearchSettings(preset.value);
  return { level, skill: preset.skill, settings: light ? lightReading(settings) : settings, logicLevel: logicLevelOf(preset.value) };
}

/**
 * CPU同士の自己対局で測った、Lvごとの強さ(L14を0とするレーティング。docs/tournament-relay-design.mdの20-6・20-9)。
 * fullは対局用の読み、lightは観戦用の読み(L30以下はほぼ同じ読みなので、同じ値。L34から上は、L22・L26・L30で尺度を合わせた測定値)。
 * lightのL49は、測定でほかに全勝して値が決まらなかったので、対局用のL46とL49のあいだに置いた見積もり。測り直したら、ここを差し替える。
 * 測定はLvの割り当てが2026-10-23の版(level-ladder.mjsのV3_SOURCES)のときのもの。強さはsourceで決まるので、
 * 表の点のLvを、同じsourceの今のLvへ引き直して使う(currentLevelFromV3。2026-11-13・2026-11-14にLv20〜47のsourceを直した。
 * docs/difficulty-calibration.md)。割り当てを直しても、この表は自動でついてくる。
 */
const V3_LEVEL_STRENGTH = Object.freeze({
  full: [[14, 0], [18, 157], [22, 541], [26, 823], [30, 1043], [34, 1389], [38, 1542], [42, 1782], [46, 1882], [49, 2220]],
  light: [[14, 0], [18, 157], [22, 541], [26, 823], [30, 1043], [34, 1130], [38, 1205], [42, 1423], [46, 1593], [49, 2000]],
});
const toCurrentLevels = (table) => Object.freeze(table.map(([level, strength]) => Object.freeze([Math.round(currentLevelFromV3(level) * 100) / 100, strength])));
export const LEVEL_STRENGTH = Object.freeze({
  full: toCurrentLevels(V3_LEVEL_STRENGTH.full),
  light: toCurrentLevels(V3_LEVEL_STRENGTH.light),
});
/** 表の外(L14より下)の、1Lvあたりの強さ(段級位の表の間隔)。 */
const STRENGTH_PER_LEVEL_BELOW = 60;

/** Lv(小数)の強さ。表の点を直線でつなぐ。 */
export function levelStrength(level, table = LEVEL_STRENGTH.full) {
  if (level <= table[0][0]) return table[0][1] - (table[0][0] - level) * STRENGTH_PER_LEVEL_BELOW;
  for (let index = 1; index < table.length; index += 1) {
    const [l1, s1] = table[index];
    const [l0, s0] = table[index - 1];
    if (level <= l1) return s0 + ((s1 - s0) * (level - l0)) / (l1 - l0);
  }
  const [l0, s0] = table.at(-2);
  const [l1, s1] = table.at(-1);
  return s1 + ((s1 - s0) * (level - l1)) / (l1 - l0);
}

/**
 * CPU同士の本局で指すLv。エンジン同士の勝率が、見ない対局の自動対局(Elo式)とそろうように、
 * 基準の棋士(6組の平均)を世界の基準Lv(world)に置き、レーティングの差だけ強さの表を上り下りしたLv(20-6の決めたこと2)。
 * @param {number} rating 棋士のレーティング(名簿の尺度)
 * @param {number} world 世界の基準Lv
 * @param {{ light?: boolean, base?: number }} [options]
 */
export function engineLevel(rating, world, { light = false, base = WORLD_BASE_RATING } = {}) {
  const table = light ? LEVEL_STRENGTH.light : LEVEL_STRENGTH.full;
  const target = levelStrength(world, table) + (rating - base);
  let best = 1;
  for (let level = 1; level <= 49; level += 1) {
    if (Math.abs(levelStrength(level, table) - target) < Math.abs(levelStrength(best, table) - target)) best = level;
  }
  return best;
}

/**
 * 本局の設定。分身の対局は、期の棋士のLv(プレイヤーが当たるときと同じ世界の物差し)のまま。
 * CPU同士の対局は、engineLevelのLvにし、主要キャラがいなければ観戦用の読み(light)にする。
 * 本局は分身のいる表の対局なので、羽音は自動対局と同じく勝ち上がりやすい(ryuo.mjsのadvanceBracket)。
 * @param {any} spec 中継の項目(blackとwhiteにレーティング)
 * @param {{ world?: number | null }} options
 */
export function realGameSpec(spec, { world = null } = {}) {
  const avatar = spec.black?.id === 'user' || spec.white?.id === 'user';
  // 本物の世界(docs/tournament-strength-spread-design.mdの9章)は、プロどうしの対局を見せるので、観戦用の読みにしない。
  const real = isRealWorld(world);
  const light = !real && !isMainCharacter(spec.black) && !isMainCharacter(spec.white);
  const base = { ...spec, winner: null, how: null, story: null, light };
  if (avatar || !Number.isFinite(world)) return base;
  // 羽音の勝ち上がり補正は外した(docs/hanane-rival-design.mdの13章)。羽音もレーティングのまま。
  const ratingOf = (player) => Number(player.rating) || 0;
  // 本物の世界は、プレイヤーが当たるときと同じ段級位の強さのLv(天鷺善彦は藤井聡太並みのLv49)。ほかの世界は、強さの表で当て直す。
  const levelOf = (player) => ({
    ...player,
    level: real ? realPlayerLevel(player, ratingOf(player)) : engineLevel(ratingOf(player), /** @type {number} */ (world), { light }),
  });
  return { ...base, black: levelOf(spec.black), white: levelOf(spec.white) };
}

/** 本物の世界で棋士が指すLv。天鷺善彦は、いつも藤井聡太並み(Lv49。読む量も最上位のまま)。 */
export function realPlayerLevel(player, rating = Number(player?.rating) || 0) {
  if (player?.story === YOSHIHIKO) return MAX_CPU_LEVEL;
  return worldCpuLevel(rating, REAL_WORLD);
}

/**
 * 指した手の印(中継の解説が使う)。定跡・詰み・大きな悪手・悪手・緩手・これしかない手。
 * @param {{ planned: boolean, mate: boolean, loss: number, onlyMove: boolean }} facts
 */
export function engineMark({ planned, mate, loss, onlyMove }) {
  if (planned) return 'book';
  if (mate) return 'mate';
  if (loss >= MARK_LOSS.decisive) return 'decisive';
  if (loss >= MARK_LOSS.error) return 'error';
  if (loss >= MARK_LOSS.slip) return 'slip';
  return onlyMove ? 'only' : '';
}

/**
 * 投了するか。bestは、手番の側から見た最善の候補(valueは比べられる値)。lastValueは、同じ側の1つ前の手番の最善の値。
 * styleは、その棋士の投了の早さ(29章。ふつうは5手詰めあたりまで指す。詰みまで指す人もいる)。
 * @param {{ ply: number, best: { value: number, score?: any } | null, lastValue: number | null, style?: ReturnType<typeof resignStyleById> }} input
 */
export function shouldEngineResign({ ply, best, lastValue, style = resignStyleById('normal') }) {
  if (!best || ply < RESIGN_MIN_PLY) return false;
  return resignsBy(style, { best, lastValue });
}

/**
 * 1局を本当に指す。searchは、初期局面からmovesを指した局面を読む関数(候補は手番の側から見た評価値)。
 * resumeは、途中まで指した手(保存していた棋譜)。onMoveは、新しく指した1手ごとに呼ぶ。
 * @param {{
 *   spec: any,
 *   search: (request: { moves: string[], nodes: number, multiPv: number, searchMoves?: string[], threads?: number, base?: string | null }) => Promise<any>,
 *   formationMaster?: any,
 *   onMove?: (entry: import('./relay-game.mjs').RelayMoveEntry, index: number) => void,
 *   isCancelled?: () => boolean,
 *   resume?: import('./relay-game.mjs').RelayMoveEntry[],
 *   think?: (request: { sfen: string, levels: Record<string, number>, planMove: string | null, seed: number }) => Promise<any>,
 * }} options
 * @returns {Promise<import('./relay-game.mjs').RelayGame | null>} 止めたらnull
 */
export async function playEngineGame({ spec, search: baseSearch, formationMaster = null, onMove = () => {}, isCancelled = () => false, resume = [], think = thinkHere }) {
  // 駒落ちの局(spec.sfen。docs/disciple-mode-design.mdの37章)は、その局面から指す。上手(後手の側)が先に指す。
  const startSfen = spec.sfen || STANDARD_SFEN;
  const whiteFirst = startSfen.split(' ')[1] === 'w';
  const sideOf = (ply) => (whiteFirst ? standardSideOf(ply + 1) : standardSideOf(ply));
  const base = startSfen === STANDARD_SFEN ? null : startSfen;
  /** @type {typeof baseSearch} */
  const search = (request) => baseSearch(base ? { ...request, base } : request);
  const light = Boolean(spec.light);
  const strengths = { black: engineStrength(spec.black, { light }), white: engineStrength(spec.white, { light }) };
  // 持ち時間の時計だけに使う筋書き(勝ち負けは決めない。手数の目安で時間を配る)。
  const clock = createRelayClock(spec, relayPlan({ ...spec, winner: spec.winner ?? 'black' }));
  const plans = { black: openingPlanOf(spec, 'black'), white: openingPlanOf(spec, 'white') };
  const resignStyles = { black: resignStyleOf(spec.black), white: resignStyleOf(spec.white) };
  const record = createGameRecord(startSfen);
  const moves = [];
  const entries = [];
  const seen = new Map([[positionKey(record.position.sfen), 1]]);
  const blunderPlies = { black: [], white: [] };
  /** 人間らしいCPUの台無しの手(A級・B級を分けて1局の上限まで数える。docs/cpu-human-model-design.mdの14章)。 */
  const humanBlunders = { black: [], white: [] };
  const lastBest = { black: null, white: null };
  let formations = createFormationState();
  /** 理由で指す棋士の定跡の歩み(戦法熟練度で、定跡のあとエンジンで指す手を決める。34-10)。 */
  let books = createBookTracker();
  let lastEval = 40;
  let lastCapture = false;

  const play = (usi) => {
    if (!appendUsiMove(record, usi)) return false;
    moves.push(usi);
    const move = record.current?.move;
    lastCapture = Boolean(move && typeof move === 'object' && 'capturedPieceType' in move && move.capturedPieceType);
    const key = positionKey(record.position.sfen);
    seen.set(key, (seen.get(key) ?? 0) + 1);
    if (formationMaster) formations = updateFormationState(formations, detectFormationSnapshot(record.position.sfen, formationMaster), formationMove(record.position.sfen, moves.length));
    return true;
  };
  // 保存していた手を並べ直す(時計の残りも、使った時間だけ減らす)。
  for (const entry of resume) {
    const side = sideOf(moves.length);
    if (!play(entry.move)) break;
    entries.push(entry);
    clock.remaining[side] = Math.max(0, clock.remaining[side] - entry.time);
    lastEval = entry.eval;
  }

  let end = null;
  for (let ply = moves.length; ply < RELAY_MAX_PLIES; ply += 1) {
    if (isCancelled()) return null;
    const sfen = record.position.sfen;
    const side = sideOf(ply);
    const sign = side === 'black' ? 1 : -1;
    const legal = enumerateLegalMoves(record.position).map(({ usi }) => usi);
    if (!legal.length) {
      end = { winner: other(side), reason: 'mate', plies: ply };
      break;
    }
    // 千日手にしない(同じ局面の4回目になる手は、ほかに手があれば選ばない)。
    const repeats = (usi) => {
      const probe = createGameRecord(sfen);
      return appendUsiMove(probe, usi) && (seen.get(positionKey(probe.position.sfen)) ?? 0) >= 3;
    };
    const fresh = legal.filter((usi) => !repeats(usi));
    const allowed = fresh.length ? fresh : legal;
    const player = spec[side];
    const strength = strengths[side];
    const rng = createRng(((spec.seed ?? 0) ^ Math.imul(ply + 1, 0x9e3779b1)) >>> 0);
    const random = () => rng.next();
    const disciple = player?.disciple ?? null;
    const situation = player?.character || disciple ? characterSituation({ sfen, ply }) : null;
    // 師匠の1年の弟子(docs/disciple-mode-design.mdの22章)は、能力値・スキル・戦い方・持ち時間の適性で1手ごとの設定を作る。
    const pressure = clock.remaining[side] <= 0 ? 'byoyomi' : clock.remaining[side] < clock.control.main * DISCIPLE_LOW_TIME ? 'low' : null;
    const withCharacter = (advantage) => (disciple
      ? discipleMoveSettings(disciple.strength, disciple.profile ?? {}, {
        ...situation, ply, advantage: advantage ?? 0, time: disciple.time ?? null,
        clock: pressure ? { pressure, short: clock.control.byoyomi <= 30 } : null,
      })
      : situation
        ? applyCharacter(strength.settings, player.character, { ...situation, advantage }, { skill: strength.skill })
        : strength.settings);
    // 師匠の1年の棋士の作戦は、相手の飛車の向きで囲いを組み替え、完成したら囲いの続きへ進む(docs/disciple-mode-design.mdの35章)。
    if (plans[side]?.adapt || plans[side]?.chain?.length) {
      plans[side] = advancePlan(plans[side], {
        color: side, sfen,
        ownMoves: moves.filter((_, index) => sideOf(index) === side),
        opponentMoves: moves.filter((_, index) => sideOf(index) !== side),
      });
    }
    const planMove = openingPlanMove({ plans, side, ply, record, moves, legal: allowed, formations, lastCapture });

    const reasoner = player?.reason ?? null;
    const ownMoves = moves.filter((_, index) => sideOf(index) === side).length;
    if (reasoner) books = noteBook(books, side, { planMove, ownMoves });
    const before = withCharacter();
    const read = reasoner || strength.logicLevel !== null || !(before.nodes > 0)
      ? await search({ moves: [...moves], nodes: EVAL_NODES, multiPv: 2 })
      : await search({ moves: [...moves], nodes: before.nodes, multiPv: Math.max(1, before.multiPv), threads: before.searchThreads });
    if (isCancelled()) return null;
    const ranked = rankedCandidates(read).filter(({ move }) => legal.includes(move));
    const best = ranked[0] ?? null;
    if (shouldEngineResign({ ply, best, lastValue: lastBest[side], style: resignStyles[side] })) {
      end = { winner: other(side), reason: 'resign', plies: ply };
      break;
    }
    lastBest[side] = best?.value ?? null;

    let choice = null;
    if (reasoner) {
      // 理由で指す棋士(34-16)。定跡のあとの研究の続きだけエンジンで指す(34-10)。エンジンの読み(read)は判定役。
      // 研究メモ(前の局で研究の続きに指して形勢を保った手。35-13)。定跡が終わったあと、同じ局面ならエンジンに聞かずにその手を指す。
      const memo = planMove ? null : reasoner.notes?.[positionKey(sfen)];
      if (memo && allowed.includes(memo)) choice = { move: memo, reason: { stage: 'memo', reason: 'memo', skipped: [] } };
      const follow = choice ? null : followUpTurn(books, side, ownMoves, reasoner.mastery ?? 0);
      if (follow) {
        const deep = await search({ moves: [...moves], nodes: follow.nodes, multiPv: 1 });
        if (isCancelled()) return null;
        const pick = rankedCandidates(deep).find(({ move }) => allowed.includes(move));
        if (pick) choice = { move: pick.move, reason: { stage: 'follow', reason: 'follow', skipped: [] } };
      }
      if (!choice) {
        const thought = await think({ sfen, levels: reasoner.levels ?? {}, planMove, seed: (spec.seed ?? 0) ^ Math.imul(ply + 7, 0x85ebca6b) });
        if (isCancelled()) return null;
        if (thought?.move && allowed.includes(thought.move)) choice = { move: thought.move, reason: thought };
      }
    } else if (strength.logicLevel !== null || !(before.nodes > 0)) {
      choice = chooseLogicMove({ sfen, legalMoves: allowed, moveHistory: moves, level: strength.logicLevel ?? 1, planMove, random });
    } else {
      const selection = withCharacter(best?.value);
      const verify = (searchMoves, nodes) => search({ moves: [...moves], nodes, multiPv: searchMoves.length, searchMoves });
      const probe = (extra, { nodes, multiPv }) => search({ moves: [...moves, ...extra], nodes, multiPv });
      if (selection.logicHybrid) {
        choice = await chooseAwareMove({
          strength: selection, sfen, legalMoves: allowed, moveHistory: moves, search: read, planMove,
          planScoreLossLimit: PLAN_LOSS_LIMIT * (selection.openingPlanScoreScale ?? 1),
          blunderAllowed: canBlunder(selection, blunderPlies[side], ply),
          blunderAllowance: humanBlunderAllowance(selection.human?.limit, humanBlunders[side], ply), verify, probe, random,
        });
        humanBlunders[side] = noteHumanBlunder(humanBlunders[side], ply, choice?.blunderKind);
        choice ??= chooseLogicMove({ sfen, legalMoves: allowed, moveHistory: moves, level: 10, planMove, random });
      } else {
        const planned = planMove ? ranked.find(({ move }) => move === planMove) : null;
        choice = planned && best && best.value - planned.value <= PLAN_LOSS_LIMIT
          ? { move: planMove }
          : await chooseCpuMove({
            strength: selection, sfen, legalMoves: allowed, moveHistory: moves, search: read,
            blunderAllowed: canBlunder(selection, blunderPlies[side], ply), verify, probe, random,
          });
      }
    }
    if (isCancelled()) return null;
    const usi = choice?.move && allowed.includes(choice.move) ? choice.move : (best?.move && allowed.includes(best.move) ? best.move : allowed[0]);
    if (isBlunderChoice(choice)) blunderPlies[side].push(ply);

    // 指した手の評価(候補になければ、その手だけ読む)。
    let chosen = ranked.find(({ move }) => move === usi) ?? null;
    if (!chosen) {
      const single = await search({ moves: [...moves], nodes: EVAL_NODES, multiPv: 1, searchMoves: [usi] });
      if (isCancelled()) return null;
      chosen = rankedCandidates(single).find(({ move }) => move === usi) ?? null;
    }
    const value = chosen?.value ?? best?.value ?? 0;
    const loss = best && chosen ? Math.max(0, best.value - chosen.value) : 0;
    const second = ranked[1];
    const mark = engineMark({
      planned: usi === planMove,
      mate: chosen?.score?.type === 'mate' && chosen.score.value > 0,
      loss,
      onlyMove: Boolean(best && second && usi === best.move && ply >= THEORY_PLY && !isMateCp(valueToCp(best.value)) && best.value - second.value >= ONLY_MOVE_GAP),
    });
    const evalCp = valueToCp(value) * sign;
    const gap = best && second ? Math.abs((winRate(best.score) ?? 50) - (winRate(second.score) ?? 50)) : 50;
    const seconds = clock.think({ side, ply, kind: mark, gap, surprise: Math.abs(evalCp - lastEval), rng, character: player?.character });
    if (!play(usi)) {
      end = { winner: other(side), reason: 'resign', plies: ply };
      break;
    }
    const entry = {
      move: usi,
      eval: Math.round(evalCp),
      pv: storedPv(chosen),
      best: best && usi !== best.move ? best.move : '',
      loss: Math.round(loss),
      time: seconds,
      mark,
    };
    // 弟子の手は、観戦の見立て(崩れた理由。disciple-strength.mjsのcauseOf)のために、気づかなかったこと・詰みを逃したか・時計を残す。
    // 気づかなかったことの種類(hanging・free・mate)も残す(崩れ方の見立て。disciple-causes.mjs、33-5)。
    if (disciple && !reasoner) entry.d = { o: choice?.oversights?.length ? 1 : 0, m: choice?.ownMateMissed && !(chosen?.score?.type === 'mate' && chosen.score.value > 0) ? 1 : 0, c: pressure ?? '', k: [...new Set((choice?.oversights ?? []).map((item) => item?.kind).filter(Boolean))] };
    // 理由で指す棋士の思考の記録(34-7): 決めた段s・理由r・飛ばした確かめk・読み筋l(4手まで)。詰みを逃したかmはエンジンの読みで見る。
    if (reasoner && (disciple || player?.reasonRecord)) {
      const thought = choice?.reason ?? {};
      const bestMate = best?.score?.type === 'mate' && best.score.value > 0;
      const chosenMate = chosen?.score?.type === 'mate' && chosen.score.value > 0;
      entry.d = {
        o: thought.skipped?.length ? 1 : 0, m: bestMate && !chosenMate ? 1 : 0, c: pressure ?? '', k: [...(thought.skipped ?? [])],
        s: thought.stage ?? '', r: thought.reason ?? '', l: (thought.line ?? []).slice(0, 4).join(' '), p: thought.depth ?? 0,
      };
    }
    entries.push(entry);
    lastEval = evalCp;
    onMove(entry, entries.length - 1);
  }
  // 手数の上限(ほぼ起きない。詰みまで指す人が負けて、勝つ側が詰ませきれないとき)は、最後の形勢(先手から見た値)で決める。
  if (!end) end = { winner: (entries.at(-1)?.eval ?? 0) >= 0 ? 'black' : 'white', reason: 'resign', plies: moves.length };
  if (end.reason === 'resign' && !end.plies) end.plies = moves.length;
  return { v: RELAY_VERSION, key: spec.key, entries, end };
}

/**
 * 本局の結果を、期の記録(ryuo-simulation.mjsのsimulateMemberGameの形。gameRecordOfに渡す)にする。
 * 序盤・中盤・終局のあとの形勢は、30手目・80手目・最後の評価値(勝者の側に寄せる)。勝ち方もそこから決める。
 * @param {any} spec 本局の設定(blackとwhiteに棋士のid)
 * @param {import('./relay-game.mjs').RelayGame} game
 * @param {string} aId 記録の主(分身ならuser)
 */
export function engineGameResult(spec, game, aId) {
  const aColor = spec.black.id === aId ? 'black' : 'white';
  const bColor = other(aColor);
  const sign = aColor === 'black' ? 1 : -1;
  const aWins = game.end.winner === aColor;
  const evalAt = (ply) => game.entries[Math.min(game.entries.length, ply) - 1]?.eval ?? 0;
  const toRating = (cp) => clamp(cp / CP_PER_RATING, -1500, 1500) * sign;
  const last = Math.abs(toRating(evalAt(game.entries.length)));
  const phases = [toRating(evalAt(30)), toRating(evalAt(80)), (aWins ? 1 : -1) * Math.max(300, last)].map(Math.round);
  const winnerSign = aWins ? 1 : -1;
  return {
    aWins,
    how: classifyWin([phases[0] * winnerSign, phases[1] * winnerSign]),
    aColor,
    openings: { a: spec.openings?.[aColor] ?? null, b: spec.openings?.[bColor] ?? null },
    castles: { a: spec.castles?.[aColor] ?? null, b: spec.castles?.[bColor] ?? null },
    phases,
    probability: null,
  };
}

// ---- 指している途中の本局の保存(画面を離れても、戻ったら続きから指す)

export const ENGINE_GAME_KEY = 'yacobihime:shogi-match:engine-game:v1';
/** 途中の本局を残す数(回戦の全局を本局にするので、1回戦ぶんより多く)。 */
const PROGRESS_LIMIT = 40;

function loadProgressStore(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(ENGINE_GAME_KEY) ?? 'null');
    return parsed && typeof parsed.games === 'object' && Array.isArray(parsed.order) ? parsed : { games: {}, order: [] };
  } catch {
    return { games: {}, order: [] };
  }
}
function saveProgressStore(storage, store) {
  try {
    storage?.setItem(ENGINE_GAME_KEY, JSON.stringify(store));
  } catch {
    // 保存できなくても、本局は指せる(戻ったら、はじめから)。
  }
}

/** 途中まで指した手(なければ空)。 */
export function loadEngineGameProgress(storage, key) {
  const packed = loadProgressStore(storage).games[key];
  if (!packed) return [];
  return unpackRelayGame(key, { ...packed, end: { winner: 'black', reason: 'resign', plies: 0 } })?.entries ?? [];
}

/** 途中まで指した手を残す。 */
export function saveEngineGameProgress(storage, key, entries) {
  const store = loadProgressStore(storage);
  const order = [...store.order.filter((other) => other !== key), key];
  const drop = order.slice(0, Math.max(0, order.length - PROGRESS_LIMIT));
  const games = { ...store.games, [key]: packRelayGame({ entries, end: null }) };
  for (const old of drop) delete games[old];
  saveProgressStore(storage, { games, order: order.slice(-PROGRESS_LIMIT) });
}

/** 終わった本局の途中の保存を消す(終わった棋譜は中継の保存relay-store.mjsに残す)。 */
export function clearEngineGameProgress(storage, key) {
  const store = loadProgressStore(storage);
  if (!store.games[key]) return;
  const games = { ...store.games };
  delete games[key];
  saveProgressStore(storage, { games, order: store.order.filter((other) => other !== key) });
}
