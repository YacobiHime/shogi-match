const MAX_PLAYER_LEVEL = 255;

export function parsePlayerLevel(value, fallback = 1) {
  const candidate = value === null || value === undefined || value === ''
    ? fallback
    : Number(value);
  if (!Number.isInteger(candidate) || candidate < 1 || candidate > MAX_PLAYER_LEVEL
    || (typeof value === 'string' && !/^[1-9]\d*$/.test(value))) {
    throw new Error(`プレイヤーレベルは1〜${MAX_PLAYER_LEVEL}の整数にしてください`);
  }
  return candidate;
}

function validateIdList(value, field, level) {
  if (!Array.isArray(value)) {
    throw new Error(`レベル${level}.${field}は配列にしてください`);
  }
  const ids = new Set();
  for (const id of value) {
    if (typeof id !== 'string' || id.length === 0) {
      throw new Error(`レベル${level}.${field}のIDは空でない文字列にしてください`);
    }
    if (ids.has(id)) {
      throw new Error(`レベル${level}.${field}でIDが重複しています: ${id}`);
    }
    ids.add(id);
  }
  return ids;
}

/** 解禁テーブルとマスタの参照・unlock_levelの一致を検証する。 */
export function validateLevelUnlocks(data, formations = [], items = []) {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('level_unlocks.jsonのルートは1件以上の配列にしてください');
  }

  const formationMap = new Map(formations.map((item) => [item.formation_id, item]));
  const itemMap = new Map(items.map((item) => [item.item_id, item]));
  const seenLevels = new Set();
  const seenFormationIds = new Set();
  const seenItemIds = new Set();
  let previousLevel = 0;

  for (const entry of data) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('level_unlocks.jsonの各要素はオブジェクトにしてください');
    }
    if (!Number.isInteger(entry.level) || entry.level < 1 || entry.level > MAX_PLAYER_LEVEL) {
      throw new Error(`levelは1〜${MAX_PLAYER_LEVEL}の整数にしてください`);
    }
    if (seenLevels.has(entry.level) || entry.level <= previousLevel) {
      throw new Error('level_unlocks.jsonはlevelの昇順かつ重複なしにしてください');
    }
    seenLevels.add(entry.level);
    previousLevel = entry.level;

    const unlocks = entry.unlocks;
    if (!unlocks || typeof unlocks !== 'object' || Array.isArray(unlocks)) {
      throw new Error(`レベル${entry.level}.unlocksはオブジェクトにしてください`);
    }
    const formationIds = validateIdList(unlocks.formations, 'formations', entry.level);
    const itemIds = validateIdList(unlocks.items, 'items', entry.level);
    const upgrades = unlocks.skill_upgrades;
    if (!upgrades || typeof upgrades !== 'object' || Array.isArray(upgrades)) {
      throw new Error(`レベル${entry.level}.skill_upgradesはオブジェクトにしてください`);
    }
    for (const key of ['undo_max', 'hint_max']) {
      if (!Number.isInteger(upgrades[key]) || upgrades[key] < 0) {
        throw new Error(`レベル${entry.level}.${key}は0以上の整数にしてください`);
      }
    }

    for (const id of formationIds) {
      if (seenFormationIds.has(id)) throw new Error(`戦形が複数レベルで解禁されています: ${id}`);
      seenFormationIds.add(id);
      const formation = formationMap.get(id);
      if (formations.length && !formation) throw new Error(`未定義の戦形を解禁しています: ${id}`);
      if (formation && formation.unlock_level !== entry.level) {
        throw new Error(`${id}.unlock_levelと解禁テーブルのレベルが一致しません`);
      }
    }
    for (const id of itemIds) {
      if (seenItemIds.has(id)) throw new Error(`アイテムが複数レベルで解禁されています: ${id}`);
      seenItemIds.add(id);
      const item = itemMap.get(id);
      if (items.length && !item) throw new Error(`未定義のアイテムを解禁しています: ${id}`);
      if (item && item.unlock_level !== entry.level) {
        throw new Error(`${id}.unlock_levelと解禁テーブルのレベルが一致しません`);
      }
    }
  }

  for (const id of formationMap.keys()) {
    if (!seenFormationIds.has(id)) throw new Error(`解禁テーブルに戦形がありません: ${id}`);
  }
  for (const id of itemMap.keys()) {
    if (!seenItemIds.has(id)) throw new Error(`解禁テーブルにアイテムがありません: ${id}`);
  }
  return data;
}

export function getUnlockState(levelUnlocks, playerLevel) {
  const level = parsePlayerLevel(playerLevel);
  const formationIds = new Set();
  const itemIds = new Set();
  let undoMaxBonus = 0;
  let hintMaxBonus = 0;

  for (const entry of levelUnlocks) {
    if (entry.level > level) break;
    entry.unlocks.formations.forEach((id) => formationIds.add(id));
    entry.unlocks.items.forEach((id) => itemIds.add(id));
    undoMaxBonus += entry.unlocks.skill_upgrades.undo_max;
    hintMaxBonus += entry.unlocks.skill_upgrades.hint_max;
  }
  return { formationIds, itemIds, undoMaxBonus, hintMaxBonus };
}

export function applyAssistLimitUpgrades(limits, unlockState) {
  return {
    hints: limits.hints + unlockState.hintMaxBonus,
    undo: limits.undo + unlockState.undoMaxBonus,
  };
}
