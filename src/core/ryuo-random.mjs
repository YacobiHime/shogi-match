// 竜王戦の乱数。状態を保存して、続きから同じ乱数列を再現できる。

/** seedは、最初の種でも、保存した状態(`rng.state`)でもよい。後者を渡すと、続きから同じ乱数列になる。 */
export function createRng(seed) {
  let state = seed >>> 0;
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    get state() { return state; },
  };
}

export function gauss(rng) {
  const u = Math.max(rng.next(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng.next());
}

export function pick(rng, list) {
  return list[Math.min(list.length - 1, Math.floor(rng.next() * list.length))];
}

export function weightedPick(rng, entries) {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rng.next() * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll < 0) return value;
  }
  return entries.at(-1)[0];
}
