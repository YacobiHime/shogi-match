/**
 * SFENの盤面・手番・持ち駒部分を局面キーとして返す。
 * 最後の手数は同一局面の判定に影響しないため除外する。
 */
export function positionKeyFromSfen(sfen) {
  const fields = sfen.trim().split(/\s+/);
  if (fields.length < 4) {
    throw new Error('Invalid SFEN');
  }
  return fields.slice(0, 3).join(' ');
}

/** 同一局面4回と、連続王手による千日手を記録・判定する。 */
export class RepetitionTracker {
  constructor(initialSfen) {
    this.records = [{
      key: positionKeyFromSfen(initialSfen),
      moverColor: null,
      gaveCheck: false,
    }];
  }

  /**
   * 着手後の局面を記録する。
   * @returns {{ type: 'draw' } | { type: 'perpetual-check', loserColor: number } | null}
   */
  record(sfen, moverColor, gaveCheck) {
    const key = positionKeyFromSfen(sfen);
    this.records.push({ key, moverColor, gaveCheck });

    const occurrences = [];
    for (let i = 0; i < this.records.length; i++) {
      if (this.records[i].key === key) occurrences.push(i);
    }
    if (occurrences.length < 4) return null;

    const cycleStart = occurrences.at(-4);
    const cycleRecords = this.records.slice(cycleStart + 1);
    const movers = [...new Set(
      cycleRecords.map((record) => record.moverColor).filter((color) => color !== null)
    )];
    const perpetualCheckers = movers.filter((color) => {
      const moves = cycleRecords.filter((record) => record.moverColor === color);
      return moves.length > 0 && moves.every((record) => record.gaveCheck);
    });

    if (perpetualCheckers.length === 1) {
      return { type: 'perpetual-check', loserColor: perpetualCheckers[0] };
    }
    return { type: 'draw' };
  }

  get length() {
    return this.records.length;
  }

  /** 待ったで局面を戻す際に、同じ手数以降の判定履歴を捨てる。 */
  truncate(length) {
    if (!Number.isInteger(length) || length < 1 || length > this.records.length) {
      throw new Error('千日手履歴の長さが不正です');
    }
    this.records.length = length;
  }
}
