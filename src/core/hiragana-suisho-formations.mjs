function parseSfenBoard(sfen) {
  const ranks = String(sfen).replace(/^sfen\s+/, '').trim().split(/\s+/)[0].split('/');
  if (ranks.length !== 9) throw new Error('SFENの盤面は9段にしてください');
  const board = new Map();
  ranks.forEach((rank, rankIndex) => {
    let file = 9;
    let promoted = false;
    for (const symbol of rank) {
      if (/[1-9]/.test(symbol)) {
        file -= Number(symbol);
      } else if (symbol === '+') {
        if (promoted) throw new Error('SFENの成駒表現が不正です');
        promoted = true;
      } else {
        if (file < 1 || !/[prnbgslkPRNBGSLK]/.test(symbol)) {
          throw new Error('SFENの駒配置が不正です');
        }
        board.set(`${file}${rankIndex + 1}`, `${promoted ? '+' : ''}${symbol}`);
        file -= 1;
        promoted = false;
      }
    }
    if (promoted || file !== 0) throw new Error('SFENの段は9筋にしてください');
  });
  return board;
}

function matchPattern(board, patternSfen, mode) {
  const pattern = parseSfenBoard(patternSfen);
  const checks = [...pattern].map(([square, piece]) => board.get(square) === piece);
  return mode === 'all' ? checks.every(Boolean) : checks.some(Boolean);
}

function evaluate(board, expression) {
  if (expression.match) {
    return matchPattern(board, expression.match.sfen, expression.match.mode);
  }
  if (expression.not) return !evaluate(board, expression.not);
  if (expression.all) return expression.all.every((item) => evaluate(board, item));
  if (expression.any) return expression.any.some((item) => evaluate(board, item));
  return false;
}

const RULE_GROUPS = new Set([
  'enc_match',
  'bt_match1',
  'bt_match2',
  'sente_tac_match',
  'gote_tac_match',
]);

function validateExpression(expression) {
  if (!expression || typeof expression !== 'object' || Array.isArray(expression)) {
    throw new Error('HiraganaSuisho戦形判定式が不正です');
  }
  const keys = ['match', 'not', 'all', 'any'].filter((key) => key in expression);
  if (keys.length !== 1) throw new Error('HiraganaSuisho戦形判定式の演算子が不正です');
  if (expression.match) {
    const { mode, sfen } = expression.match;
    if (!['all', 'any'].includes(mode) || typeof sfen !== 'string') {
      throw new Error('HiraganaSuisho部分SFEN判定が不正です');
    }
    parseSfenBoard(sfen);
    return;
  }
  if (expression.not) {
    validateExpression(expression.not);
    return;
  }
  const children = expression.all || expression.any;
  if (!Array.isArray(children) || children.length === 0) {
    throw new Error('HiraganaSuisho複合判定が不正です');
  }
  children.forEach(validateExpression);
}

export function validateHiraganaSuishoFormations(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.rules)) {
    throw new Error('HiraganaSuisho戦形判定データが不正です');
  }
  const ids = new Set();
  for (const rule of value.rules) {
    if (
      !rule
      || typeof rule.id !== 'string'
      || ids.has(rule.id)
      || !RULE_GROUPS.has(rule.group)
      || typeof rule.name !== 'string'
      || rule.name.length === 0
    ) {
      throw new Error('HiraganaSuisho戦形判定ルールが不正です');
    }
    ids.add(rule.id);
    validateExpression(rule.expression);
  }
  return value;
}

export function detectHiraganaSuishoFormations(sfen, master) {
  const board = parseSfenBoard(sfen);
  const rules = validateHiraganaSuishoFormations(master).rules;
  const firstOnly = new Set(['enc_match', 'bt_match1', 'bt_match2']);
  const foundGroups = new Set();
  return rules.filter((rule) => {
    if (firstOnly.has(rule.group) && foundGroups.has(rule.group)) return false;
    if (!evaluate(board, rule.expression)) return false;
    if (firstOnly.has(rule.group)) foundGroups.add(rule.group);
    return true;
  });
}

export function findNewHiraganaSuishoFormations(sfen, master, announcedIds = []) {
  const announced = new Set(announcedIds);
  return detectHiraganaSuishoFormations(sfen, master)
    .filter((rule) => !announced.has(`hiragana:${rule.name}`));
}
