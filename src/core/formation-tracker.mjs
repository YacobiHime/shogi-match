import {
  detectHiraganaSuishoFormations,
  invertHiraganaSuishoSfen,
} from './hiragana-suisho-formations.mjs';

function withTurn(sfen, turn) {
  const fields = String(sfen).replace(/^sfen\s+/, '').trim().split(/\s+/);
  if (fields.length !== 4) throw new Error('SFENは4フィールドにしてください');
  fields[1] = turn;
  return fields.join(' ');
}

function namesByGroup(rules, groups) {
  const allowed = new Set(groups);
  return rules.filter((rule) => allowed.has(rule.group)).map((rule) => rule.name);
}

function firstByGroup(rules, group) {
  return rules.find((rule) => rule.group === group)?.name ?? '';
}

export function createFormationState() {
  return {
    battle: '',
    black: { rook: '', castle: '', tactics: [] },
    white: { rook: '', castle: '', tactics: [] },
  };
}

/** 原典の先手・後手別の呼び分けに合わせて、現局面の分類を返す。 */
export function detectFormationSnapshot(sfen, master) {
  const direct = withTurn(sfen, 'w');
  const inverted = withTurn(invertHiraganaSuishoSfen(sfen), 'w');
  const goteDirect = withTurn(sfen, 'b');
  const directRules = detectHiraganaSuishoFormations(direct, master);
  const invertedRules = detectHiraganaSuishoFormations(inverted, master);
  const goteRules = detectHiraganaSuishoFormations(goteDirect, master);
  return {
    battle: firstByGroup(directRules, 'bt_match1'),
    black: {
      rook: firstByGroup(directRules, 'bt_match2'),
      castle: firstByGroup(directRules, 'enc_match'),
      tactics: namesByGroup(directRules, ['sente_tac_match', 'tac_match']),
    },
    white: {
      rook: firstByGroup(invertedRules, 'bt_match2'),
      castle: firstByGroup(invertedRules, 'enc_match'),
      tactics: [
        ...namesByGroup(goteRules, ['gote_tac_match']),
        ...namesByGroup(invertedRules, ['tac_match']),
      ],
    },
  };
}

export function updateFormationState(previous, snapshot) {
  const next = {
    battle: previous.battle,
    black: { ...previous.black, tactics: [...previous.black.tactics] },
    white: { ...previous.white, tactics: [...previous.white.tactics] },
  };
  if (!next.battle && snapshot.battle) next.battle = snapshot.battle;
  for (const color of ['black', 'white']) {
    if (!next[color].rook && snapshot[color].rook) next[color].rook = snapshot[color].rook;
    next[color].castle = snapshot[color].castle;
    next[color].tactics = [...new Set([
      ...next[color].tactics,
      ...snapshot[color].tactics,
    ])];
  }
  return next;
}

export function formationNamesFromState(state, color, limit = Infinity) {
  const side = state[color];
  const battle = state.battle === '一手損角換わり' && color === 'black'
    ? []
    : [state.battle];
  return [...new Set([
    ...battle,
    side.rook,
    side.castle,
    ...side.tactics,
  ].filter(Boolean))].slice(0, limit);
}

export function formationNamesFromSnapshot(snapshot, color) {
  return formationNamesFromState({ ...snapshot }, color);
}
