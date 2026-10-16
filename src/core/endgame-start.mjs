/**
 * 終盤戦。名局の終盤の局面から、CPUと1局指す(段階4の「短く遊ぶ」)。
 * 『世界のアソビ大全51』が5五将棋を「いきなりクッパとの戦いから楽しめる」と紹介したように、
 * 一局のクライマックスから遊ばせる(Game_Nintendo_Design.mdの3-3、6-4)。
 *
 * 開始局面は、将棋界図鑑の代表局から、終局の少し前(24〜40手前)で、駒の損得が大きすぎない局面を選ぶ。
 * エンジンを待たずにすぐ始められるよう、形勢は駒の損得で見る。プレイヤーは、その局面で手番の側を持つ。
 *
 * このモジュールは代表局の棋譜を含むので、対局画面からは使うときに読み込む(dynamic import)。
 */
import { importKIF } from 'tsshogi';
import {
  AMANO_SOHO_KIFU,
  COMPUTER_SHOGI_TOP_KIFU,
  FUJII_SOTA_29_WINS_KIFU,
  FUJII_SOTA_RYUOH_36_4_KIFU,
  HABU_YOSHIHARU_52GIN_KIFU,
  KIMURA_YOSHIO_FIRST_MEIJIN_KIFU,
  KOYAMA_REO_ENTRANCE_KIFU,
  MASUDA_KOZO_35GIN_KIFU,
  NAKAHARA_MAKOTO_MEIJIN_KIFU,
  OHASHI_SOKEI_SANSA_KIFU,
  OYAMA_YASUHARU_FIRST_MEIJIN_KIFU,
  TANIGAWA_KOJI_YOUNGEST_MEIJIN_KIFU,
} from '../data/reference-kifu.mjs';

/** 平手の代表局(駒落ちの香落ちの一局は除く)。 */
const SOURCES = [
  AMANO_SOHO_KIFU,
  COMPUTER_SHOGI_TOP_KIFU,
  FUJII_SOTA_29_WINS_KIFU,
  FUJII_SOTA_RYUOH_36_4_KIFU,
  HABU_YOSHIHARU_52GIN_KIFU,
  KIMURA_YOSHIO_FIRST_MEIJIN_KIFU,
  KOYAMA_REO_ENTRANCE_KIFU,
  MASUDA_KOZO_35GIN_KIFU,
  NAKAHARA_MAKOTO_MEIJIN_KIFU,
  OHASHI_SOKEI_SANSA_KIFU,
  OYAMA_YASUHARU_FIRST_MEIJIN_KIFU,
  TANIGAWA_KOJI_YOUNGEST_MEIJIN_KIFU,
];

/** 終局の何手前から始めるか。 */
export const ENDGAME_PLIES_BEFORE_END = Object.freeze({ min: 24, max: 40 });
/** 駒の損得(歩=1)がこれより大きい局面は、決着がついているとみて選ばない。 */
export const ENDGAME_MAX_MATERIAL_GAP = 6;

const PIECE_VALUES = {
  p: 1, l: 3, n: 3, s: 5, g: 6, b: 8, r: 10,
  '+p': 6, '+l': 6, '+n': 6, '+s': 6, '+b': 10, '+r': 12,
};

/**
 * 駒の損得(先手から見た、盤上と持ち駒の駒の価値の差)。玉は数えない。
 * @param {string} sfen
 */
export function materialBalance(sfen) {
  const [board = '', , hands = '-'] = sfen.replace(/^sfen\s+/, '').trim().split(/\s+/);
  let total = 0;
  for (const match of board.matchAll(/(\+?)([a-zA-Z])/g)) {
    const letter = match[2];
    const value = PIECE_VALUES[`${match[1]}${letter.toLowerCase()}`] ?? 0;
    total += letter === letter.toUpperCase() ? value : -value;
  }
  if (hands !== '-') {
    for (const match of hands.matchAll(/(\d*)([a-zA-Z])/g)) {
      const value = (PIECE_VALUES[match[2].toLowerCase()] ?? 0) * (Number(match[1]) || 1);
      total += match[2] === match[2].toUpperCase() ? value : -value;
    }
  }
  return total;
}

/**
 * 棋譜を、開始局面からの局面の並びにする。投了・詰みで終わった棋譜だけを使う。
 * @param {string} kifu KIF
 * @returns {{ title: string, sfens: string[], winner: 'black' | 'white' } | null}
 */
export function parseEndgameSource(kifu) {
  const record = importKIF(kifu);
  if (record instanceof Error) return null;
  const sente = record.metadata.getStandardMetadata('blackName') ?? '';
  const gote = record.metadata.getStandardMetadata('whiteName') ?? '';
  const sfens = [];
  let ending = '';
  record.goto(0);
  for (const node of record.moves) {
    if (node.ply > 0) record.goForward();
    if (node.ply > 0 && !node.move?.usi) {
      ending = node.displayText;
      break;
    }
    sfens.push(record.position.sfen);
  }
  if (!['投了', '詰み'].includes(ending) || sfens.length < ENDGAME_PLIES_BEFORE_END.max + 20) return null;
  const last = sfens[sfens.length - 1];
  return {
    title: [sente, gote].filter(Boolean).join(' 対 '),
    sfens,
    // 最後の手を指した側の勝ち。最後の局面の手番の反対側。
    winner: last.split(' ')[1] === 'w' ? 'black' : 'white',
  };
}

let parsedSources = null;
/** 代表局を一度だけ読み込む。 */
export function endgameSources() {
  parsedSources ??= SOURCES.map(parseEndgameSource).filter(Boolean);
  return parsedSources;
}

/**
 * 終盤戦の開始局面を選ぶ。終局の24〜40手前で、駒の損得がENDGAME_MAX_MATERIAL_GAP以内の局面から、ランダムに1つ。
 * @param {{ title: string, sfens: string[], winner: 'black' | 'white' }[]} sources
 * @param {{ random?: () => number, excludeSfen?: string }} [options]
 * @returns {{ title: string, sfen: string, playerColor: 'black' | 'white', winner: 'black' | 'white', pliesLeft: number } | null}
 */
export function pickEndgameStart(sources, { random = Math.random, excludeSfen = '' } = {}) {
  const candidates = [];
  for (const source of sources) {
    const end = source.sfens.length - 1;
    for (let left = ENDGAME_PLIES_BEFORE_END.min; left <= ENDGAME_PLIES_BEFORE_END.max; left += 1) {
      const sfen = source.sfens[end - left];
      if (!sfen || sfen === excludeSfen) continue;
      if (Math.abs(materialBalance(sfen)) > ENDGAME_MAX_MATERIAL_GAP) continue;
      candidates.push({
        title: source.title,
        sfen,
        playerColor: sfen.split(' ')[1] === 'w' ? 'white' : 'black',
        winner: source.winner,
        pliesLeft: left,
      });
    }
  }
  if (!candidates.length) return null;
  return candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))];
}

/** 終盤戦を始めるときの、やこび姫の一言。実戦でどちらが勝ったかを添える(負けている側を持つこともある)。 */
export function endgameIntro({ title, playerColor, winner }) {
  const side = playerColor === 'black' ? '先手' : '後手';
  const result = winner === playerColor ? 'この局面を持った側が勝ったよ。勝ち切れるかな？' : '相手の側が勝ったよ。ひっくり返せるかな？';
  return `「${title}」の終盤から、あなたは${side}を持つよ。実戦では、${result}`;
}
