// 速い局面(docs/disciple-mode-design.mdの34-14・34-15。段階E2.5)。
// 盤を数字の並び(Int8Array)で持ち、手を指す・戻すを同じ盤の上で行う。全部の手を数手読む探索(logic-search.mjs)の土台。
// 升の番号は 段(a=0〜i=8)×9 + (筋-1)。駒は先手が正・後手が負。種類: 1歩 2香 3桂 4銀 5金 6角 7飛 8玉、成り駒は+8(9と 10成香 11成桂 12成銀 14馬 15龍)。
// 手は数字1つ: 移動元(0〜80、打つ手は81+駒の種類) | 移動先<<7 | 成る<<14。

export const PAWN = 1, LANCE = 2, KNIGHT = 3, SILVER = 4, GOLD = 5, BISHOP = 6, ROOK = 7, KING = 8;
const PROMOTE = 8;
const HAND_KINDS = [ROOK, BISHOP, GOLD, SILVER, KNIGHT, LANCE, PAWN];
const LETTERS = 'PLNSGBRK';
const SFEN_KIND = { P: PAWN, L: LANCE, N: KNIGHT, S: SILVER, G: GOLD, B: BISHOP, R: ROOK, K: KING };

const at = (x, y) => (x >= 1 && x <= 9 && y >= 0 && y <= 8 ? y * 9 + (x - 1) : -1);
const fileOf = (sq) => (sq % 9) + 1;
const rankOf = (sq) => Math.floor(sq / 9);

// 先手から見た動き(dx=筋の差、dy=段の差。前はdy=-1)。
const GOLD_STEPS = [[0, -1], [-1, -1], [1, -1], [-1, 0], [1, 0], [0, 1]];
const KING_STEPS = [[0, -1], [-1, -1], [1, -1], [-1, 0], [1, 0], [0, 1], [-1, 1], [1, 1]];
const ORTHO = [[0, -1], [0, 1], [-1, 0], [1, 0]];
const DIAG = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
const STEPS = {
  [PAWN]: [[0, -1]], [KNIGHT]: [[-1, -2], [1, -2]], [SILVER]: [[0, -1], [-1, -1], [1, -1], [-1, 1], [1, 1]],
  [GOLD]: GOLD_STEPS, [KING]: KING_STEPS, [LANCE]: [], [BISHOP]: [], [ROOK]: [],
  [PAWN + PROMOTE]: GOLD_STEPS, [LANCE + PROMOTE]: GOLD_STEPS, [KNIGHT + PROMOTE]: GOLD_STEPS, [SILVER + PROMOTE]: GOLD_STEPS,
  [BISHOP + PROMOTE]: ORTHO, [ROOK + PROMOTE]: DIAG,
};
const SLIDES = {
  [LANCE]: [[0, -1]], [BISHOP]: DIAG, [ROOK]: ORTHO, [BISHOP + PROMOTE]: DIAG, [ROOK + PROMOTE]: ORTHO,
};

// 升ごと・駒ごと・手番ごとの、1歩で行ける升と走る向き(前もって作る)。
const STEP_TABLE = new Array(2 * 16 * 81);
const SLIDE_TABLE = new Array(2 * 16 * 81);
for (let color = 0; color < 2; color += 1) {
  const flip = color === 0 ? 1 : -1;
  for (let kind = 1; kind < 16; kind += 1) {
    for (let sq = 0; sq < 81; sq += 1) {
      const x = fileOf(sq);
      const y = rankOf(sq);
      STEP_TABLE[(color * 16 + kind) * 81 + sq] = (STEPS[kind] ?? []).map(([dx, dy]) => at(x + dx * flip, y + dy * flip)).filter((t) => t >= 0);
      SLIDE_TABLE[(color * 16 + kind) * 81 + sq] = (SLIDES[kind] ?? []).map(([dx, dy]) => {
        const ray = [];
        for (let k = 1; k < 9; k += 1) {
          const t = at(x + dx * flip * k, y + dy * flip * k);
          if (t < 0) break;
          ray.push(t);
        }
        return ray;
      }).filter((ray) => ray.length);
    }
  }
}
const stepsOf = (color, kind, sq) => STEP_TABLE[(color * 16 + kind) * 81 + sq];
const slidesOf = (color, kind, sq) => SLIDE_TABLE[(color * 16 + kind) * 81 + sq];

// ゾブリストの鍵(2つの32ビットを1つの数にする)。
let seed = 0x9e3779b9;
const rand32 = () => {
  seed ^= seed << 13; seed >>>= 0;
  seed ^= seed >>> 17;
  seed ^= seed << 5; seed >>>= 0;
  return seed;
};
const Z_BOARD_LO = new Uint32Array(32 * 81).map(() => rand32());
const Z_BOARD_HI = new Uint32Array(32 * 81).map(() => rand32());
const Z_HAND_LO = new Uint32Array(2 * 8 * 19).map(() => rand32());
const Z_HAND_HI = new Uint32Array(2 * 8 * 19).map(() => rand32());
const Z_SIDE_LO = rand32();
const Z_SIDE_HI = rand32();
const zIndex = (piece) => (piece > 0 ? piece : 16 - piece);

/** 局面。 */
export class FastBoard {
  constructor() {
    this.sq = new Int8Array(81);
    this.hand = new Int8Array(16);
    this.turn = 0;
    this.king = [-1, -1];
    this.lo = 0;
    this.hi = 0;
    this.history = [];
  }

  /** SFEN(盤・手番・持ち駒)から作る。 */
  static fromSfen(sfen) {
    const board = new FastBoard();
    const [placement, side, hands] = String(sfen).replace(/^sfen\s+/, '').trim().split(/\s+/);
    let y = 0;
    let x = 9;
    let promoted = false;
    for (const ch of placement) {
      if (ch === '/') { y += 1; x = 9; continue; }
      if (ch === '+') { promoted = true; continue; }
      if (/[1-9]/.test(ch)) { x -= Number(ch); continue; }
      const kind = SFEN_KIND[ch.toUpperCase()] + (promoted ? PROMOTE : 0);
      const piece = ch === ch.toUpperCase() ? kind : -kind;
      board.put(at(x, y), piece);
      x -= 1;
      promoted = false;
    }
    board.turn = side === 'w' ? 1 : 0;
    if (board.turn) { board.lo ^= Z_SIDE_LO; board.hi ^= Z_SIDE_HI; }
    if (hands && hands !== '-') {
      let count = '';
      for (const ch of hands) {
        if (/[0-9]/.test(ch)) { count += ch; continue; }
        const color = ch === ch.toUpperCase() ? 0 : 1;
        const n = count ? Number(count) : 1;
        for (let i = 0; i < n; i += 1) board.addHand(color, SFEN_KIND[ch.toUpperCase()]);
        count = '';
      }
    }
    return board;
  }

  put(s, piece) {
    this.sq[s] = piece;
    this.lo ^= Z_BOARD_LO[zIndex(piece) * 81 + s];
    this.hi ^= Z_BOARD_HI[zIndex(piece) * 81 + s];
    if (piece === KING) this.king[0] = s;
    else if (piece === -KING) this.king[1] = s;
  }

  remove(s) {
    const piece = this.sq[s];
    this.lo ^= Z_BOARD_LO[zIndex(piece) * 81 + s];
    this.hi ^= Z_BOARD_HI[zIndex(piece) * 81 + s];
    this.sq[s] = 0;
    return piece;
  }

  addHand(color, kind) {
    const i = color * 8 + kind;
    const n = this.hand[i];
    this.lo ^= Z_HAND_LO[(color * 8 + kind) * 19 + n] ^ Z_HAND_LO[(color * 8 + kind) * 19 + n + 1];
    this.hi ^= Z_HAND_HI[(color * 8 + kind) * 19 + n] ^ Z_HAND_HI[(color * 8 + kind) * 19 + n + 1];
    this.hand[i] = n + 1;
  }

  takeHand(color, kind) {
    const i = color * 8 + kind;
    const n = this.hand[i];
    this.lo ^= Z_HAND_LO[(color * 8 + kind) * 19 + n] ^ Z_HAND_LO[(color * 8 + kind) * 19 + n - 1];
    this.hi ^= Z_HAND_HI[(color * 8 + kind) * 19 + n] ^ Z_HAND_HI[(color * 8 + kind) * 19 + n - 1];
    this.hand[i] = n - 1;
  }

  /** 局面の鍵(置き換え表の鍵)。 */
  key() {
    return (this.hi & 0xfffff) * 4294967296 + (this.lo >>> 0);
  }

  /** 手を指す(合法性は呼び出し側で確かめる)。取った駒は戻すときのために覚える。 */
  make(move) {
    const from = move & 127;
    const to = (move >> 7) & 127;
    const promote = (move >> 14) & 1;
    const color = this.turn;
    const sign = color === 0 ? 1 : -1;
    let captured = 0;
    if (from >= 81) {
      const kind = from - 81;
      this.takeHand(color, kind);
      this.put(to, sign * kind);
    } else {
      captured = this.sq[to];
      if (captured) {
        this.remove(to);
        const abs = Math.abs(captured);
        if (abs !== KING) this.addHand(color, abs > PROMOTE ? abs - PROMOTE : abs);
      }
      const piece = this.remove(from);
      this.put(to, promote ? piece + sign * PROMOTE : piece);
    }
    this.history.push(captured);
    this.turn ^= 1;
    this.lo ^= Z_SIDE_LO;
    this.hi ^= Z_SIDE_HI;
  }

  /** 指した手を戻す。 */
  unmake(move) {
    const from = move & 127;
    const to = (move >> 7) & 127;
    const promote = (move >> 14) & 1;
    this.turn ^= 1;
    this.lo ^= Z_SIDE_LO;
    this.hi ^= Z_SIDE_HI;
    const color = this.turn;
    const sign = color === 0 ? 1 : -1;
    const captured = this.history.pop();
    if (from >= 81) {
      this.remove(to);
      this.addHand(color, from - 81);
      return;
    }
    const piece = this.remove(to);
    this.put(from, promote ? piece - sign * PROMOTE : piece);
    if (captured) {
      const abs = Math.abs(captured);
      if (abs !== KING) this.takeHand(color, abs > PROMOTE ? abs - PROMOTE : abs);
      this.put(to, captured);
    }
  }

  /** 手番だけを相手に渡す(何もしない1手。探索の打ち切りに使う)。2回呼ぶと元に戻る。 */
  pass() {
    this.turn ^= 1;
    this.lo ^= Z_SIDE_LO;
    this.hi ^= Z_SIDE_HI;
  }

  /** colorの駒が升sに利いているか。 */
  attacked(s, color) {
    const sign = color === 0 ? 1 : -1;
    const enemy = color ^ 1;
    // 1歩で届く駒: まわり8升と桂の升にいるcolorの駒が、その駒の動きでsへ行けるか。
    for (const t of stepsOf(enemy, KING, s)) {
      const p = this.sq[t];
      if (!p || (p > 0) !== (color === 0)) continue;
      const abs = p > 0 ? p : -p;
      if (stepsOf(color, abs, t).includes(s)) return true;
    }
    for (const t of stepsOf(enemy, KNIGHT, s)) {
      if (this.sq[t] === sign * KNIGHT) return true;
    }
    // 走る駒: sから8方向に最初の駒を見る。
    for (const ray of slidesOf(enemy, ROOK, s)) {
      for (const t of ray) {
        const p = this.sq[t];
        if (!p) continue;
        if (p === sign * ROOK || p === sign * (ROOK + PROMOTE)) return true;
        break;
      }
    }
    for (const ray of slidesOf(enemy, BISHOP, s)) {
      for (const t of ray) {
        const p = this.sq[t];
        if (!p) continue;
        if (p === sign * BISHOP || p === sign * (BISHOP + PROMOTE)) return true;
        break;
      }
    }
    for (const ray of slidesOf(enemy, LANCE, s)) {
      for (const t of ray) {
        const p = this.sq[t];
        if (!p) continue;
        if (p === sign * LANCE) return true;
        break;
      }
    }
    return false;
  }

  /** 手番の側が王手されているか。 */
  inCheck(color = this.turn) {
    const k = this.king[color];
    return k >= 0 && this.attacked(k, color ^ 1);
  }

  /**
   * 王手放置を確かめない手を、配列に足す。
   * @param {number[]} out
   * @param {{ captures?: boolean }} [only] capturesなら取る手と成る手だけ
   */
  pseudo(out, only) {
    const color = this.turn;
    const sign = color === 0 ? 1 : -1;
    const noisy = only?.captures;
    for (let s = 0; s < 81; s += 1) {
      const p = this.sq[s];
      if (!p || (p > 0) !== (color === 0)) continue;
      const kind = p * sign;
      const canPromote = kind < PROMOTE && kind !== GOLD && kind !== KING;
      for (const t of stepsOf(color, kind, s)) {
        const q = this.sq[t];
        if (q && (q > 0) === (color === 0)) continue;
        this.pushMove(out, s, t, kind, canPromote, color, noisy, q !== 0);
      }
      for (const ray of slidesOf(color, kind, s)) {
        for (const t of ray) {
          const q = this.sq[t];
          if (q && (q > 0) === (color === 0)) break;
          this.pushMove(out, s, t, kind, canPromote, color, noisy, q !== 0);
          if (q) break;
        }
      }
    }
    if (noisy) return out;
    let pawnFiles = 0;
    for (let s = 0; s < 81; s += 1) if (this.sq[s] === sign * PAWN) pawnFiles |= 1 << (s % 9);
    for (const kind of HAND_KINDS) {
      if (!this.hand[color * 8 + kind]) continue;
      for (let t = 0; t < 81; t += 1) {
        if (this.sq[t]) continue;
        const rel = color === 0 ? rankOf(t) : 8 - rankOf(t);
        if ((kind === PAWN || kind === LANCE) && rel === 0) continue;
        if (kind === KNIGHT && rel <= 1) continue;
        if (kind === PAWN && pawnFiles & (1 << (t % 9))) continue;
        out.push((81 + kind) | (t << 7));
      }
    }
    return out;
  }

  pushMove(out, s, t, kind, canPromote, color, noisy, capture) {
    const relFrom = color === 0 ? rankOf(s) : 8 - rankOf(s);
    const relTo = color === 0 ? rankOf(t) : 8 - rankOf(t);
    const zone = canPromote && (relFrom <= 2 || relTo <= 2);
    const dead = ((kind === PAWN || kind === LANCE) && relTo === 0) || (kind === KNIGHT && relTo <= 1);
    if (zone) out.push(s | (t << 7) | (1 << 14));
    if (!dead && (!noisy || capture)) out.push(s | (t << 7));
  }

  /** 合法手(自玉に王手が残る手・打ち歩詰めを除く)。 */
  legal(out = []) {
    const list = this.pseudo([]);
    const color = this.turn;
    for (const m of list) {
      this.make(m);
      const ok = !this.inCheck(color);
      let mated = false;
      if (ok && (m & 127) === 81 + PAWN && this.inCheck(color ^ 1) && !this.hasLegal()) mated = true;
      this.unmake(m);
      if (ok && !mated) out.push(m);
    }
    return out;
  }

  /** 合法手が1つでもあるか(打ち歩詰めの確かめは省く)。 */
  hasLegal() {
    const color = this.turn;
    for (const m of this.pseudo([])) {
      this.make(m);
      const ok = !this.inCheck(color);
      this.unmake(m);
      if (ok) return true;
    }
    return false;
  }

  /** 指した手が王手か(指したあとの局面で、手番の側の玉が王手されているか)。 */
  givesCheck(move) {
    this.make(move);
    const check = this.inCheck();
    this.unmake(move);
    return check;
  }

  /** SFEN(盤・手番・持ち駒。手数は1)。 */
  toSfen() {
    const names = ['', 'p', 'l', 'n', 's', 'g', 'b', 'r', 'k', '+p', '+l', '+n', '+s', '', '+b', '+r'];
    const rows = [];
    for (let y = 0; y < 9; y += 1) {
      let row = '';
      let empty = 0;
      for (let x = 9; x >= 1; x -= 1) {
        const p = this.sq[y * 9 + x - 1];
        if (!p) { empty += 1; continue; }
        if (empty) { row += empty; empty = 0; }
        const name = names[Math.abs(p)];
        row += p > 0 ? name.toUpperCase() : name;
      }
      if (empty) row += empty;
      rows.push(row);
    }
    let hands = '';
    for (const color of [0, 1]) {
      for (const kind of HAND_KINDS) {
        const n = this.hand[color * 8 + kind];
        if (n) hands += (n > 1 ? n : '') + (color === 0 ? names[kind].toUpperCase() : names[kind]);
      }
    }
    return `${rows.join('/')} ${this.turn ? 'w' : 'b'} ${hands || '-'} 1`;
  }

  toUsi(move) {
    const from = move & 127;
    const to = (move >> 7) & 127;
    const sqName = (s) => `${fileOf(s)}${String.fromCharCode(97 + rankOf(s))}`;
    if (from >= 81) return `${LETTERS[from - 82]}*${sqName(to)}`;
    return `${sqName(from)}${sqName(to)}${(move >> 14) & 1 ? '+' : ''}`;
  }

  /** USIの手を数字の手にする(合法手の中から探す)。 */
  fromUsi(usi) {
    return this.legal().find((m) => this.toUsi(m) === usi) ?? 0;
  }
}

export const squareOf = at;
export { fileOf, rankOf, stepsOf, slidesOf };
