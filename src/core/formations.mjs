const REQUIRED_FIELDS = [
  'formation_id',
  'name',
  'side',
  'start_sfen',
  'unlock_level',
  'strong_against',
  'weak_against',
];

const VALID_SIDES = new Set(['player', 'enemy', 'both']);

function assertString(value, field, index) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`戦形データ[${index}].${field}は空でない文字列にしてください`);
  }
}

function validateSfen(sfen, index) {
  const fields = sfen.trim().split(/\s+/);
  if (fields.length !== 4) {
    throw new Error(`戦形データ[${index}].start_sfenは4フィールドのSFENにしてください`);
  }

  const ranks = fields[0].split('/');
  if (ranks.length !== 9 || !['b', 'w'].includes(fields[1]) || !/^\d+$/.test(fields[3])) {
    throw new Error(`戦形データ[${index}].start_sfenの形式が不正です`);
  }
}

/**
 * formations.jsonの内容を検証して返す。
 * @param {unknown} data
 * @returns {Array<{
 *   formation_id: string,
 *   name: string,
 *   side: 'player'|'enemy'|'both',
 *   start_sfen: string,
 *   unlock_level: number,
 *   strong_against: string[],
 *   weak_against: string[]
 * }>}
 */
export function validateFormations(data) {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('formations.jsonは1件以上の戦形を含む配列にしてください');
  }

  const ids = new Set();
  for (const [index, formation] of data.entries()) {
    if (!formation || typeof formation !== 'object' || Array.isArray(formation)) {
      throw new Error(`戦形データ[${index}]はオブジェクトにしてください`);
    }

    for (const field of REQUIRED_FIELDS) {
      if (!(field in formation)) {
        throw new Error(`戦形データ[${index}].${field}がありません`);
      }
    }

    assertString(formation.formation_id, 'formation_id', index);
    assertString(formation.name, 'name', index);
    assertString(formation.start_sfen, 'start_sfen', index);

    if (ids.has(formation.formation_id)) {
      throw new Error(`formation_idが重複しています: ${formation.formation_id}`);
    }
    ids.add(formation.formation_id);

    if (!VALID_SIDES.has(formation.side)) {
      throw new Error(`戦形データ[${index}].sideが不正です: ${formation.side}`);
    }
    if (!Number.isInteger(formation.unlock_level) || formation.unlock_level < 1) {
      throw new Error(`戦形データ[${index}].unlock_levelは1以上の整数にしてください`);
    }
    for (const field of ['strong_against', 'weak_against']) {
      if (!Array.isArray(formation[field]) || formation[field].some((id) => typeof id !== 'string')) {
        throw new Error(`戦形データ[${index}].${field}は文字列の配列にしてください`);
      }
    }

    validateSfen(formation.start_sfen, index);
  }

  for (const formation of data) {
    for (const referencedId of [...formation.strong_against, ...formation.weak_against]) {
      if (!ids.has(referencedId)) {
        throw new Error(`${formation.formation_id}が未定義の戦形を参照しています: ${referencedId}`);
      }
    }
  }

  return data;
}

/**
 * 戦形マスタを取得し、指定IDの戦形を返す。
 * @param {string} formationId
 * @param {{ fetchImpl?: typeof fetch, url?: string }} [options]
 */
export async function loadFormation(formationId, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const url = options.url || '../../data/formations.json';
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`戦形データを取得できませんでした（HTTP ${response.status}）`);
  }

  const formations = validateFormations(await response.json());
  const formation = formations.find((item) => item.formation_id === formationId);
  if (!formation) {
    throw new Error(`指定された戦形が見つかりません: ${formationId}`);
  }
  return formation;
}
