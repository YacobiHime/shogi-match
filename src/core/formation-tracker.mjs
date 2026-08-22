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

// 具体的な派生戦型が判定されたときに、同時表示しない一般名。
// 棒銀など複数の戦型で現れる作戦は、誤って親子扱いしない。
const FORMATION_PARENTS_BY_SPECIFIC = new Map([
  ['鬼殺し', ['三間飛車', '早石田']],
  ['新鬼殺し', ['三間飛車', '石田流', '早石田']],
  ['ゴキゲン中飛車', ['中飛車']],
  ['端角中飛車', ['中飛車']],
  ['ノーマル四間飛車', ['四間飛車']],
  ['藤井システム', ['四間飛車', 'ノーマル四間飛車']],
  ['角交換四間飛車', ['四間飛車']],
  ['やばボーズ流', ['四間飛車', '角交換四間飛車']],
  ['立石流四間飛車', ['四間飛車']],
  ['ノーマル三間飛車', ['三間飛車']],
  ['角交換三間飛車', ['三間飛車']],
  ['石田流', ['三間飛車']],
  ['早石田', ['三間飛車']],
  ['7八飛戦法', ['三間飛車']],
  ['2手目3二飛戦法', ['三間飛車']],
  ['ダイレクト向かい飛車', ['向かい飛車']],
  ['メリケン向かい飛車', ['向かい飛車']],
  ['阪田流向かい飛車', ['向かい飛車']],
  ['菜々河流向かい飛車', ['向かい飛車']],
  ['天彦流向かい飛車', ['向かい飛車']],
  ['一手損角換わり', ['角換わり']],
  ['角換わり29手目基本図', ['角換わり']],
  ['角換わり37手目基本図', ['角換わり']],
  ['4五桂速攻', ['角換わり']],
  ['横歩取り青野流', ['横歩取り']],
  ['横歩取り勇気流', ['横歩取り']],
  ['横歩取り2三歩戦法', ['横歩取り']],
  ['横歩取り3三角戦法', ['横歩取り']],
  ['横歩取り3三桂戦法', ['横歩取り']],
  ['相横歩取り', ['横歩取り']],
  ['横歩取り4五角戦法', ['横歩取り']],
  ['横歩取り8五飛戦法', ['横歩取り']],
  ['AlphaZero流相掛かり', ['相掛かり']],
  ['6二金・8一飛車型', ['相掛かり']],
  ['相掛かり横歩取らせ', ['相掛かり']],
  ['菱矢倉', ['矢倉']],
  ['総矢倉', ['矢倉']],
  ['金矢倉', ['矢倉']],
  ['銀矢倉', ['矢倉']],
  ['菊水矢倉', ['矢倉']],
  ['土居矢倉', ['矢倉']],
  ['天野矢倉', ['矢倉']],
  ['銀立ち矢倉', ['矢倉']],
  ['右矢倉', ['矢倉']],
  ['シン・パックマン', ['パックマン']],
]);

export function preferSpecificFormationNames(names) {
  const unique = [...new Set(names.filter(Boolean))];
  const hiddenParents = new Set();
  for (const name of unique) {
    for (const parent of FORMATION_PARENTS_BY_SPECIFIC.get(name) ?? []) {
      hiddenParents.add(parent);
    }
  }
  return unique.filter((name) => !hiddenParents.has(name));
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
  return preferSpecificFormationNames([
    ...battle,
    side.rook,
    side.castle,
    ...side.tactics,
  ]).slice(0, limit);
}

export function formationNamesFromSnapshot(snapshot, color) {
  return formationNamesFromState({ ...snapshot }, color);
}
