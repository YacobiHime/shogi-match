export function createPositionAnalysisCache(maxEntries = 4) {
  if (!Number.isInteger(maxEntries) || maxEntries < 1) throw new Error("maxEntries must be positive");
  const entries = new Map();

  return {
    get(key, { multiPv = 1, nodes = 0 } = {}) {
      const entry = entries.get(key);
      if (!entry || entry.multiPv < multiPv || entry.nodes < nodes) return null;
      entries.delete(key);
      entries.set(key, entry);
      return entry.candidates;
    },
    set(key, candidates, { multiPv = 1, nodes = 0 } = {}) {
      entries.delete(key);
      entries.set(key, { candidates, multiPv, nodes });
      while (entries.size > maxEntries) entries.delete(entries.keys().next().value);
    },
    clear() {
      entries.clear();
    },
  };
}
