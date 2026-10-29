// 本局: 観戦する対局を、エンジンが本当に指して勝ち負けを決める(docs/tournament-relay-design.mdの20章、段階1)。
// 両側とも、プレイヤーが当たるときと同じCPU(Lvの強さ設定・棋風と特徴・得意戦法の定跡)で指す。勝ち負けは盤の上で決まる。
// 1手ごとに中継の棋譜と同じ形(relay-game.mjsのRelayMoveEntry)で渡すので、中継の画面と回戦のボードはそのまま使える。
// エンジンの呼び出しは、引数のsearchに任せる(画面に依存しない)。途中までの棋譜(resume)から続きを指せる。

import { appendUsiMove, createGameRecord, enumerateLegalMoves, STANDARD_SFEN } from '../game-state';
import { createRng } from './ryuo-random.mjs';
import { CPU_STRENGTH_PRESETS, getStrengthSearchSettings, logicLevelOf } from './strength-settings.mjs';
import { applyCharacter, characterSituation } from './player-character.mjs';
import { canBlunder, chooseCpuMove, isBlunderChoice } from './cpu-move-choice.mjs';
import { chooseAwareMove } from './aware-move-choice.mjs';
import { chooseLogicMove } from './logic-ai.mjs';
import { classifyWin } from './ryuo-simulation.mjs';
import {
  CP_PER_RATING, ONLY_MOVE_GAP, PLAN_LOSS_LIMIT, RELAY_MAX_PLIES, RELAY_VERSION, THEORY_PLY, createRelayClock, isMateCp,
  openingPlanMove, openingPlanOf, rankedCandidates, relayPlan, valueToCp,
} from './relay-game.mjs';
import { winRate } from './move-selection.mjs';
import { createFormationState, detectFormationSnapshot, updateFormationState } from './formation-tracker.mjs';
import { packRelayGame, unpackRelayGame } from './relay-store.mjs';
import { HANANE, HANANE_RIVAL_RUN_RATING, YOSHIHIKO } from './ryuo-story.mjs';
import { MAX_CPU_LEVEL, REAL_WORLD, WORLD_BASE_RATING, isRealWorld, worldCpuLevel } from './ryuo-strength.mjs';
import { resignStyleById, resignStyleOf, resignsBy } from './resign-style.mjs';

/** ロジックAIで指すLvの手の、形勢を見るための読み(画面のバーと解説に使う)。 */
export const EVAL_NODES = 3000;
/** 手の印の、最善手との差(点)。 */
export const MARK_LOSS = Object.freeze({ decisive: 600, error: 250, slip: 100 });
/** 投了は、この手数までは投げない(序盤の大差は、まだ指す)。いつ投げるかは、棋士の投了の早さ(resign-style.mjs。29章)。 */
const RESIGN_MIN_PLY = 40;

const sideOf = (ply) => (ply % 2 === 0 ? 'black' : 'white');
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
 */
export const LEVEL_STRENGTH = Object.freeze({
  full: Object.freeze([[14, 0], [18, 157], [22, 541], [26, 823], [30, 1043], [34, 1389], [38, 1542], [42, 1782], [46, 1882], [49, 2220]]),
  light: Object.freeze([[14, 0], [18, 157], [22, 541], [26, 823], [30, 1043], [34, 1130], [38, 1205], [42, 1423], [46, 1593], [49, 2000]]),
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
  const ratingOf = (player) => (Number(player.rating) || 0) + (player.story === HANANE ? HANANE_RIVAL_RUN_RATING : 0);
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
 *   search: (request: { moves: string[], nodes: number, multiPv: number, searchMoves?: string[], threads?: number }) => Promise<any>,
 *   formationMaster?: any,
 *   onMove?: (entry: import('./relay-game.mjs').RelayMoveEntry, index: number) => void,
 *   isCancelled?: () => boolean,
 *   resume?: import('./relay-game.mjs').RelayMoveEntry[],
 * }} options
 * @returns {Promise<import('./relay-game.mjs').RelayGame | null>} 止めたらnull
 */
export async function playEngineGame({ spec, search, formationMaster = null, onMove = () => {}, isCancelled = () => false, resume = [] }) {
  const light = Boolean(spec.light);
  const strengths = { black: engineStrength(spec.black, { light }), white: engineStrength(spec.white, { light }) };
  // 持ち時間の時計だけに使う筋書き(勝ち負けは決めない。手数の目安で時間を配る)。
  const clock = createRelayClock(spec, relayPlan({ ...spec, winner: spec.winner ?? 'black' }));
  const plans = { black: openingPlanOf(spec, 'black'), white: openingPlanOf(spec, 'white') };
  const resignStyles = { black: resignStyleOf(spec.black), white: resignStyleOf(spec.white) };
  const record = createGameRecord(STANDARD_SFEN);
  const moves = [];
  const entries = [];
  const seen = new Map([[positionKey(record.position.sfen), 1]]);
  const blunderPlies = { black: [], white: [] };
  const lastBest = { black: null, white: null };
  let formations = createFormationState();
  let lastEval = 40;
  let lastCapture = false;

  const play = (usi) => {
    if (!appendUsiMove(record, usi)) return false;
    moves.push(usi);
    const move = record.current?.move;
    lastCapture = Boolean(move && typeof move === 'object' && 'capturedPieceType' in move && move.capturedPieceType);
    const key = positionKey(record.position.sfen);
    seen.set(key, (seen.get(key) ?? 0) + 1);
    if (formationMaster) formations = updateFormationState(formations, detectFormationSnapshot(record.position.sfen, formationMaster));
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
    const situation = player?.character ? characterSituation({ sfen, ply }) : null;
    const withCharacter = (advantage) => (situation
      ? applyCharacter(strength.settings, player.character, { ...situation, advantage }, { skill: strength.skill })
      : strength.settings);
    const planMove = openingPlanMove({ plans, side, ply, record, moves, legal: allowed, formations, lastCapture });

    const before = withCharacter();
    const read = strength.logicLevel !== null || !(before.nodes > 0)
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
    if (strength.logicLevel !== null || !(before.nodes > 0)) {
      choice = chooseLogicMove({ sfen, legalMoves: allowed, moveHistory: moves, level: strength.logicLevel ?? 1, planMove, random });
    } else {
      const selection = withCharacter(best?.value);
      const verify = (searchMoves, nodes) => search({ moves: [...moves], nodes, multiPv: searchMoves.length, searchMoves });
      const probe = (extra, { nodes, multiPv }) => search({ moves: [...moves, ...extra], nodes, multiPv });
      if (selection.logicHybrid) {
        choice = await chooseAwareMove({
          strength: selection, sfen, legalMoves: allowed, moveHistory: moves, search: read, planMove,
          planScoreLossLimit: PLAN_LOSS_LIMIT * (selection.openingPlanScoreScale ?? 1),
          blunderAllowed: canBlunder(selection, blunderPlies[side], ply), verify, probe, random,
        });
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
      pv: (chosen?.pv ?? []).slice(1, 5).join(' '),
      best: best && usi !== best.move ? best.move : '',
      loss: Math.round(loss),
      time: seconds,
      mark,
    };
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
