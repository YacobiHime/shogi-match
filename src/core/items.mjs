const ITEM_TYPES = new Set([
  'hint',
  'undo',
  'handicap',
  'formation_start',
  'extra_hand_pieces',
  'enemy_debuff_nodes',
  'enemy_debuff_rank',
]);

/**
 * items.jsonの内容を検証して返す。
 * @param {unknown} data
 */
export function validateItems(data) {
  if (!Array.isArray(data)) {
    throw new Error('items.jsonのルートは配列にしてください');
  }

  const ids = new Set();
  for (const item of data) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error('items.jsonの各要素はオブジェクトにしてください');
    }
    if (typeof item.item_id !== 'string' || item.item_id.length === 0) {
      throw new Error('item_idは空でない文字列にしてください');
    }
    if (ids.has(item.item_id)) {
      throw new Error(`item_idが重複しています: ${item.item_id}`);
    }
    ids.add(item.item_id);

    if (typeof item.name !== 'string' || item.name.length === 0) {
      throw new Error(`${item.item_id}.nameは空でない文字列にしてください`);
    }
    if (!ITEM_TYPES.has(item.type)) {
      throw new Error(`${item.item_id}.typeが未対応です: ${item.type}`);
    }
    if (!Number.isInteger(item.unlock_level) || item.unlock_level < 1) {
      throw new Error(`${item.item_id}.unlock_levelは1以上の整数にしてください`);
    }
    if (!Number.isFinite(item.effect_value)) {
      throw new Error(`${item.item_id}.effect_valueは数値にしてください`);
    }
    if (typeof item.stackable !== 'boolean') {
      throw new Error(`${item.item_id}.stackableは真偽値にしてください`);
    }
    if (typeof item.consumable !== 'boolean') {
      throw new Error(`${item.item_id}.consumableは真偽値にしてください`);
    }
    if (item.type === 'enemy_debuff_nodes'
      && (item.effect_value <= 0 || item.effect_value > 1)) {
      throw new Error(
        `${item.item_id}.effect_valueは0より大きく1以下の探索ノード倍率にしてください`
      );
    }
    if ((item.type === 'hint' || item.type === 'undo')
      && (!Number.isInteger(item.effect_value) || item.effect_value < 1)) {
      throw new Error(`${item.item_id}.effect_valueは1以上の使用回数にしてください`);
    }
  }

  return data;
}

/**
 * アイテム／スキルマスタを取得して検証する。
 * @param {{ fetchImpl?: typeof fetch, url?: string }} [options]
 */
export async function loadItems(options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(options.url || '../../data/items.json');
  if (!response.ok) {
    throw new Error(`アイテムデータを取得できませんでした（HTTP ${response.status}）`);
  }
  return validateItems(await response.json());
}

/**
 * IDに対応するアイテムを返す。未装備を表す空値はnullにする。
 * @param {Array<{ item_id: string }>} items
 * @param {string | null | undefined} itemId
 */
export function selectItem(items, itemId) {
  if (!itemId) return null;
  const item = items.find((candidate) => candidate.item_id === itemId);
  if (!item) {
    throw new Error(`指定されたアイテムが見つかりません: ${itemId}`);
  }
  return item;
}

/**
 * 現在のレベルで装備可能な、敵探索量デバフの恒久スキルだけを返す。
 * @param {Array<{ type: string, consumable: boolean, unlock_level: number }>} items
 * @param {number} [playerLevel]
 */
export function getNodeDebuffSkills(items, playerLevel = 1) {
  if (!Number.isInteger(playerLevel) || playerLevel < 1) {
    throw new Error('playerLevelは1以上の整数にしてください');
  }
  return items.filter(
    (item) => item.type === 'enemy_debuff_nodes'
      && !item.consumable
      && item.unlock_level <= playerLevel
  );
}

/**
 * 敵探索量へ掛ける倍率を返す。未装備なら1倍。
 * @param {{ type: string, effect_value: number } | null} item
 */
export function getNodeDebuffMultiplier(item) {
  if (item === null) return 1;
  if (item.type !== 'enemy_debuff_nodes') {
    throw new Error('敵探索量デバフ以外のアイテムはノード数へ適用できません');
  }
  if (!Number.isFinite(item.effect_value)
    || item.effect_value <= 0
    || item.effect_value > 1) {
    throw new Error('探索ノード倍率は0より大きく1以下にしてください');
  }
  return item.effect_value;
}

/**
 * セーブデータ未使用の単独対局用に、解禁済みの補助機能の使用回数を返す。
 * M3結線後は対局開始構成のhints/undoを優先する。
 */
export function getStandaloneAssistLimits(items, playerLevel = 1) {
  if (!Number.isInteger(playerLevel) || playerLevel < 1) {
    throw new Error('playerLevelは1以上の整数にしてください');
  }
  const limitFor = (type) => items
    .filter((item) => item.type === type && item.unlock_level <= playerLevel)
    .reduce((sum, item) => sum + item.effect_value, 0);
  return { hints: limitFor('hint'), undo: limitFor('undo') };
}
