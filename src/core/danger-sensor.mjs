/**
 * 危機感知センサー(docs/coach-advice-expansion-design.mdの12章)。相手が指した直後に、取られて損をする自分の駒
 * (相手の今の手で当たりが掛かった駒)を見つけ、盤の赤い輪とやこび姫の一言で知らせる。相手の狙い(coach-reason.mjsのthreatAdvice)の強化版。
 * - CPU(ロジックAI)と同じ取り合いの計算(exchange-eval.mjs)だけで決める。エンジンの読みを待たないので、知らせが遅れない。
 * - 歩は数えない(歩の当たりは多く、言いすぎる)。守りが足りていて取られても損をしない駒は言わない。
 * - 前の局面(相手が指す前)から当たっていた駒は、もう一度は言わない(同じ知らせを毎手くり返さない)。
 * - 答えの手(どう逃げるか)は言わない。どの駒が、何に狙われているかだけ。
 * 画面に依存しない。
 */
import { exchangeGain } from './exchange-eval.mjs';
import { opponentOf, parseSfenState } from './piece-movement.mjs';

/** 知らせる損の下限(取り合いの計算の点。歩=100)。歩1枚より大きく失う駒だけを言う。 */
export const SENSOR_MIN_GAIN = 200;
/** 盤に輪を出す駒の数の上限。 */
export const SENSOR_MAX_SQUARES = 3;
/** 自動で付ける強さの上限(CPUのLv)。7級までの相手と指す人を、初心者として手伝う。 */
export const SENSOR_AUTO_MAX_LEVEL = 18;

const PIECE_NAMES = Object.freeze({
  L: '香', N: '桂', S: '銀', G: '金', B: '角', R: '飛車',
  '+P': 'と金', '+L': '成香', '+N': '成桂', '+S': '成銀', '+B': '馬', '+R': '竜', P: '歩', K: '玉',
});

/**
 * 取られて損をする、colorの側の駒(玉と歩を除く)。損の大きい順。
 * @param {string} sfen
 * @param {'black' | 'white'} color
 * @returns {{ square: string, kind: string, gain: number, attacker: string }[]}
 */
export function endangeredPieces(sfen, color) {
  let board;
  try {
    ({ board } = parseSfenState(sfen));
  } catch {
    return [];
  }
  const enemy = opponentOf(color);
  const found = [];
  for (const [square, piece] of board) {
    if (piece.color !== color || piece.kind === 'K' || piece.kind === 'P') continue;
    const { gain, line } = exchangeGain(board, square, enemy, { mode: 'full' });
    if (gain < SENSOR_MIN_GAIN) continue;
    const from = /^([1-9][a-i])/.exec(line[0] ?? '')?.[1] ?? '';
    found.push({ square, kind: piece.kind, gain, attacker: board.get(from)?.kind ?? '' });
  }
  return found.sort((a, b) => b.gain - a.gain);
}

/**
 * 相手が指した直後の知らせ。相手の今の手で新しく取られて損をする形になった駒があれば、輪を出す升と一言を返す。なければnull。
 * @param {{ sfen: string, previousSfen?: string, color: 'black' | 'white' }} input
 *   sfen: 相手が指したあとの局面(自分の手番)。previousSfen: 相手が指す前の局面。color: 自分の色
 * @returns {{ squares: string[], key: string, text: string } | null}
 */
export function dangerSensor({ sfen, previousSfen = '', color }) {
  const now = endangeredPieces(sfen, color);
  if (!now.length) return null;
  const before = previousSfen ? endangeredPieces(previousSfen, color) : [];
  const fresh = now.filter((piece) => !before.some((old) => old.square === piece.square && old.kind === piece.kind));
  if (!fresh.length) return null;
  const shown = fresh.slice(0, SENSOR_MAX_SQUARES);
  const [top, second] = shown;
  const name = (kind) => PIECE_NAMES[kind] ?? '駒';
  const text = second
    ? `${name(top.kind)}と${name(second.kind)}が狙われてるよ！`
    : top.attacker
      ? `${name(top.kind)}が${name(top.attacker)}に狙われてるよ！`
      : `${name(top.kind)}が狙われてるよ！`;
  // 鍵は「相手の狙い」と同じ頭(threat-)にして、同じ重さで出す(危険の知らせは、ほめ言葉より先。coach-advice-scheduler.mjs)。
  return { squares: shown.map(({ square }) => square), key: `threat-sensor-${shown.map(({ square }) => square).join('-')}`, text };
}

/**
 * 自動のとき、センサーを付けるか。学習対局と、7級(Lv18)までの相手との対局。
 * @param {{ learning?: boolean, cpuLevel?: number }} input
 */
export function dangerSensorAuto({ learning = false, cpuLevel = 0 } = {}) {
  return learning || (Number.isFinite(cpuLevel) && cpuLevel <= SENSOR_AUTO_MAX_LEVEL);
}
