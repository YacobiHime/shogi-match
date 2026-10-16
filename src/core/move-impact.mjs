/**
 * 出来事の重さ(Game_Nintendo_Implementation.mdの3-1)。段階が上がるほど、止め・音・見た目を強くする。
 *
 * | 段階 | 出来事 |
 * |---|---|
 * | 0 | メニュー操作、駒を選ぶ |
 * | 1 | 通常の着手 |
 * | 2 | 駒を取る、成る、打つ |
 * | 3 | 大駒を取る、王手 |
 * | 4 | 好手、詰めろを掛ける、受け切る(ほめ言葉) |
 * | 5 | 神の一手 |
 * | 6 | 詰ませる(勝ち) |
 *
 * 段階は、判定済みの結果(駒を取ったか、ほめ言葉の種類など)から決める。ここで新しい判定は作らない。
 */

export const IMPACT_STAGE = Object.freeze({
  MENU: 0,
  MOVE: 1,
  CAPTURE: 2,
  STRONG: 3,
  GOOD: 4,
  GOD: 5,
  FINISH: 6,
});

/**
 * 段階ごとの止め(ミリ秒)。止めるのは「次に起きること」(CPUの応手、結果画面)の開始だけで、
 * プレイヤーの入力は止めない。値は初期値で、触って調整したら文書の表も直す。
 */
export const IMPACT_STOP_MS = Object.freeze([0, 0, 0, 80, 80, 250, 400]);
/** 詰まされたときの止め。負けは勝ちより短く控えめにする。 */
export const DEFEAT_STOP_MS = 200;

const MAJOR_PIECE_TYPES = new Set(['rook', 'bishop', 'dragon', 'horse']);

/**
 * 着手1つの段階と駒音。
 * 駒音は、強い音(王手・大駒を取る・詰み) → 成る → 取る → 打つ → 普通、の順に選ぶ。
 * @param {{ capturedPieceType?: string | null, promote?: boolean, drop?: boolean, check?: boolean, checkmate?: boolean }} [move]
 * @returns {{ stage: number, sound: 'normal' | 'strong' | 'capture' | 'drop' | 'promote' }}
 */
export function moveImpact({
  capturedPieceType = null,
  promote = false,
  drop = false,
  check = false,
  checkmate = false,
} = {}) {
  const majorCapture = Boolean(capturedPieceType) && MAJOR_PIECE_TYPES.has(String(capturedPieceType));
  if (checkmate) return { stage: IMPACT_STAGE.FINISH, sound: 'strong' };
  if (check || majorCapture) return { stage: IMPACT_STAGE.STRONG, sound: 'strong' };
  if (promote) return { stage: IMPACT_STAGE.CAPTURE, sound: 'promote' };
  if (capturedPieceType) return { stage: IMPACT_STAGE.CAPTURE, sound: 'capture' };
  if (drop) return { stage: IMPACT_STAGE.CAPTURE, sound: 'drop' };
  return { stage: IMPACT_STAGE.MOVE, sound: 'normal' };
}

/**
 * やこび姫のほめ言葉の段階。神の一手は5、ほかのほめ言葉(好手・詰めろ・受け切り・駒得・逆転など)は4。
 * ほめ言葉でないものは0。
 * @param {string} [key] 助言のキー(core/move-praise.mjs)
 */
export function praiseImpactStage(key = '') {
  if (key === 'praise-god-move') return IMPACT_STAGE.GOD;
  return key.startsWith('praise-') ? IMPACT_STAGE.GOOD : IMPACT_STAGE.MENU;
}

/** 段階の止め(ミリ秒)。 */
export function impactStopMs(stage) {
  return IMPACT_STOP_MS[Math.max(0, Math.min(IMPACT_STOP_MS.length - 1, Math.trunc(stage) || 0))];
}

/**
 * 終局の止めと音。詰みで勝ったときがいちばん重く、詰まされたときは短く控えめにする。
 * 投了・千日手などは止めない(盤の上で決着の瞬間がないため)。引き分けは音を鳴らさない。
 * @param {{ reason: string, outcome: 'win' | 'loss' | 'draw' | 'none' }} finish
 *   outcomeはプレイヤーから見た結果。ローカル対局など、プレイヤーのいない対局は'none'。
 * @returns {{ stopMs: number, sound: 'win' | 'lose' | null }}
 */
export function finishImpact({ reason, outcome }) {
  const mate = reason === 'checkmate';
  if (outcome === 'win') return { stopMs: mate ? impactStopMs(IMPACT_STAGE.FINISH) : 0, sound: 'win' };
  if (outcome === 'loss') return { stopMs: mate ? DEFEAT_STOP_MS : 0, sound: 'lose' };
  if (outcome === 'none') return { stopMs: mate ? impactStopMs(IMPACT_STAGE.FINISH) : 0, sound: mate ? 'win' : null };
  return { stopMs: 0, sound: null };
}
