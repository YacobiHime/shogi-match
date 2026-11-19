// 観戦記を新聞の記事のように書く(docs/mate-finish-design.md の6章)。
// 棋譜を読み直して局の出来事(開戦・大駒の取り合い・竜や馬・王手の連続・詰み)を拾い、勝率の記録から形勢の流れ
// (逆転・頓死・熱戦・完勝など)を見立て、その局だけの見出し・リード・小見出しつきの段落・局後の談話を書く。
// 言い回しは局ごとの種で選ぶので、同じ流れの局でも毎回同じ文にならない。画面と保存の仕組みに依存しない。

import { appendUsiMove, createGameRecord, STANDARD_SFEN } from '../game-state';

// ---- 局の出来事(棋譜から)

/** 駒の値段(駒の損得の流れに使う。勝率の記録がない局の代わり)。 */
const PIECE_VALUE = Object.freeze({
  pawn: 1, lance: 3, knight: 4, silver: 5, gold: 6, bishop: 8, rook: 10, king: 0,
  promPawn: 6, promLance: 6, promKnight: 6, promSilver: 6, horse: 10, dragon: 12,
});
const UNPROMOTED = Object.freeze({ promPawn: 'pawn', promLance: 'lance', promKnight: 'knight', promSilver: 'silver', horse: 'bishop', dragon: 'rook' });
const BIG = new Set(['rook', 'bishop', 'dragon', 'horse']);
export const PIECE_NAME = Object.freeze({
  pawn: '歩', lance: '香', knight: '桂', silver: '銀', gold: '金', bishop: '角', rook: '飛車', king: '玉',
  promPawn: 'と金', promLance: '成香', promKnight: '成桂', promSilver: '成銀', horse: '馬', dragon: '竜',
});

/**
 * 棋譜の出来事。手ごとに、指した側(user・opp)・手の言葉・取った駒・打ったか・成ったか・王手か、と駒の損得(あなたから見た点)。
 * @param {string[]} moves USIの手
 * @param {{ initialSfen?: string, userColor?: 'black' | 'white' }} [options]
 */
export function gameFacts(moves, { initialSfen = STANDARD_SFEN, userColor = 'black' } = {}) {
  let record;
  try {
    record = createGameRecord(initialSfen);
  } catch {
    return { moves: [], material: [] };
  }
  const list = [];
  const material = [];
  let balance = 0;
  for (const usi of moves ?? []) {
    if (!appendUsiMove(record, usi)) break;
    const move = record.current.move;
    if (!move || typeof move !== 'object' || !('to' in move)) break;
    const side = move.color === userColor ? 'user' : 'opp';
    const sign = side === 'user' ? 1 : -1;
    const captured = move.capturedPieceType ?? null;
    if (captured) balance += sign * ((PIECE_VALUE[captured] ?? 0) + (PIECE_VALUE[UNPROMOTED[captured] ?? captured] ?? 0));
    if (move.promote) balance += sign * Math.max(0, (PIECE_VALUE[promoted(move.pieceType)] ?? 0) - (PIECE_VALUE[move.pieceType] ?? 0));
    const entry = {
      ply: list.length + 1,
      side,
      text: String(record.current.displayText ?? '').replace('☗', '▲').replace('☖', '△').replace(/\s/g, ''),
      piece: move.pieceType,
      capture: captured,
      drop: typeof move.from === 'string',
      promote: Boolean(move.promote),
      check: Boolean(record.position.checked),
    };
    list.push(entry);
    material.push(balance);
  }
  return { moves: list, material };
}

function promoted(piece) {
  return { pawn: 'promPawn', lance: 'promLance', knight: 'promKnight', silver: 'promSilver', bishop: 'horse', rook: 'dragon' }[piece] ?? piece;
}

// ---- 形勢の流れ(勝率の記録と駒の損得から)

/**
 * 形勢の見立て。kindは逆転勝ち(comeback)・逆転負け(collapse)・頓死(tonshi)・熱戦(seesaw)・完勝/完敗(rout)・接戦(close)・ふつう(steady)。
 * 勝率の記録([手数, あなたから見た勝率%])が少ない局は、駒の損得の流れで見立てる。
 * @param {{ rates?: Array<[number, number]>, win: boolean, plies: number, facts: ReturnType<typeof gameFacts>,
 *   mate?: { plies: number, from: number, by: 'user' | 'opp' } | null }} input
 */
export function storyOf({ rates = [], win, plies, facts, mate = null }) {
  const curve = rates.length >= 4 ? rates.map(([ply, rate]) => [ply, rate]) : materialCurve(facts.material);
  const fromRates = rates.length >= 4;
  const middle = curve.filter(([ply]) => ply >= Math.min(24, plies / 3));
  const values = middle.map(([, rate]) => rate);
  const best = values.length ? Math.max(...values) : 50;
  const worst = values.length ? Math.min(...values) : 50;
  // 形勢の入れ替わり(40%と60%の外へ出たときだけ数える)。
  let leader = null;
  let changes = 0;
  for (const [, rate] of middle) {
    const now = rate >= 60 ? 'user' : rate <= 40 ? 'opp' : null;
    if (now && leader && now !== leader) changes += 1;
    if (now) leader = now;
  }
  const turning = biggestSwing(curve);
  // 頓死: 詰まされた側が、寄せの始まる直前まで悪くなかった。
  const before = mate ? rateAt(curve, mate.from - 1) : null;
  let tonshi = null;
  if (mate && mate.plies >= 1 && before !== null) {
    if (mate.by === 'user' && before <= (fromRates ? 55 : 52)) tonshi = 'opp';
    if (mate.by === 'opp' && before >= (fromRates ? 45 : 48)) tonshi = 'user';
  }
  let kind = 'steady';
  if (tonshi) kind = 'tonshi';
  else if (win && worst <= (fromRates ? 25 : 30)) kind = 'comeback';
  else if (!win && best >= (fromRates ? 75 : 70)) kind = 'collapse';
  else if (changes >= 3) kind = 'seesaw';
  else if ((win && worst >= 55) || (!win && best <= 45)) kind = 'rout';
  else if (values.length && values.filter((rate) => rate >= 35 && rate <= 65).length / values.length >= 0.75) kind = 'close';
  return { kind, tonshi, changes, best, worst, turning, fromRates, curve };
}

/** 駒の損得を、あなたから見た勝率のような値(50が五分)にする。 */
function materialCurve(material = []) {
  return material.map((value, index) => [index + 1, Math.max(5, Math.min(95, 50 + value * 2.2))]);
}

function rateAt(curve, ply) {
  let found = null;
  for (const [at, rate] of curve) if (at <= ply) found = rate;
  return found;
}

/** いちばん大きく動いた所(2手以内の差で15以上)。 */
function biggestSwing(curve) {
  let best = null;
  for (let index = 1; index < curve.length; index += 1) {
    const [beforePly, before] = curve[index - 1];
    const [afterPly, after] = curve[index];
    if (afterPly - beforePly > 2) continue;
    const delta = after - before;
    if (!best || Math.abs(delta) > Math.abs(best.delta)) best = { delta, ply: delta >= 0 ? beforePly + 1 : afterPly, by: delta >= 0 ? 'user' : 'opp' };
  }
  return best && Math.abs(best.delta) >= 15 ? best : null;
}

// ---- 言い回し

/** 局ごとの種で言い回しを選ぶ(同じ流れの局でも毎回同じ文にならない)。 */
function chooser(seed) {
  let state = 2166136261;
  for (const char of String(seed)) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0;
  return (list) => {
    state = Math.imul(state ^ (state >>> 15), 2246822507) >>> 0;
    state = Math.imul(state ^ (state >>> 13), 3266489909) >>> 0;
    state = (state ^ (state >>> 16)) >>> 0;
    return list[state % list.length];
  };
}

const fill = (text, vars) => text.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');

const HEADLINES = Object.freeze({
  comeback: ['{user}、劣勢をはね返す逆転勝ち', '{user}、土俵際から大逆転', '粘りが実った　{user}が逆転で制す'],
  collapse: ['{opp}、執念の逆転　{user}は好局を逃す', '{opp}が逆転勝ち　終盤にドラマ', '最後に笑ったのは{opp}'],
  tonshiWin: ['まさかの頓死　{user}が一瞬のすきを突く', '{opp}に落とし穴　{user}が逆転の詰み', '一手で暗転　{user}が{mate}手詰めで仕留める'],
  tonshiLoss: ['{user}に痛恨の頓死　{opp}が拾う', '一瞬の暗転　{opp}が{mate}手詰めで逆転', '{opp}、好機を逃さず　勝負は詰みで決着'],
  seesaw: ['形勢{changes}度入れ替わる熱戦　{winner}が制す', '二転三転の大熱戦、{winner}に軍配', '息詰まる攻防　最後は{winner}'],
  routWin: ['{user}、完勝　{plies}手で押し切る', '{user}の快勝　一度も主導権を渡さず', '{user}、隙なく寄せ切る'],
  routLoss: ['{opp}が完勝　{user}は立て直しを誓う', '{opp}の快勝　{plies}手で押し切る', '{opp}、隙のない指し回し'],
  close: ['最後まで互角　紙一重で{winner}', '息の長い接戦、{winner}が抜け出す', '一手の差で{winner}が勝つ'],
  steadyWin: ['{user}、{plies}手で制す', '{user}が着実に寄せ切る', '{user}、手堅く白星'],
  steadyLoss: ['{opp}が{plies}手で制す　{user}は次の局へ', '{opp}に軍配　{user}は次へ', '{opp}が押し切る'],
});

const OPENING = Object.freeze({
  early: ['{first}手目に早くも駒がぶつかった。', '序盤早々、{first}手目から戦いが始まった。', '{first}手目の駒交換で、局面は一気に動き出した。'],
  normal: ['{first}手目に最初の駒がぶつかり、中盤戦に入った。', '駒組みが一段落した{first}手目、開戦となった。'],
  slow: ['両者じっくりと駒組みを進め、最初に駒がぶつかったのは{first}手目だった。', '{first}手目まで駒がぶつからない、静かな序盤となった。'],
  none: ['大きな駒の取り合いのないまま、局面は終盤へ向かった。'],
});

const COMMENTS = Object.freeze({
  winnerUser: ['「途中は苦しいと思っていました。最後まで粘れてよかったです」', '「{turn}のあたりで、少しよくなったと感じました」', '「一局を通して、自分の将棋が指せたと思います」'],
  winnerOpp: ['「{turn}のあたりで手応えがありました」', '「難しい将棋でした。最後は運もありました」', '「相手の粘りが強く、最後まで気が抜けませんでした」'],
  loserUser: ['「どこかでよくする手があったと思う。感想戦で確かめたい」', '「次の一局に生かします」', '「勉強になる一局でした」'],
  loserOpp: ['「{turn}が悪かったかもしれません」', '「最後に読み抜けがありました」', '「力負けです。また出直します」'],
});

// ---- 記事

/**
 * 観戦記(新聞の記事の形)。見出し・副見出し・リード・小見出しつきの段落・局後の談話・形勢の線(グラフ用)・記録の欄。
 * paragraphsは前の読み手のために、全部の段落を順に並べたものも入れる。
 * @param {{
 *   eventText: string, label: string, venue?: string, userName: string, opponentName: string, opponentDan?: string,
 *   opponentStyle?: string, userColor: 'black' | 'white', formations: { black: string, white: string }, win: boolean,
 *   plies: number, reason?: string, decided?: string, score?: string, rates?: Array<[number, number]>,
 *   moves?: string[], initialSfen?: string, seed?: string | number, oversights?: number[],
 *   dayBlocks?: { title: string, paragraphs: string[] }[], winningMeal?: string, moveText?: ((ply: number) => string) | null,
 *   mate?: { plies: number, from: number } | null,
 * }} input
 *   reasonはresignation・checkmate・repetitionなど。oversightsは相手(CPU)が気づかなかったことのある手数。
 *   dayBlocksはタイトル戦(二日制)の1日目の段落(昼食・封じ手。title-day.mjsのwriteKansenkiが作る)。
 */
export function writeArticle(input) {
  const {
    eventText, label, venue = '', userName, opponentName, opponentDan = '', opponentStyle = '', userColor, formations, win, plies,
    reason = '', decided = '', score = '', rates = [], moves = [], initialSfen = STANDARD_SFEN, seed = '', oversights = [],
    dayBlocks = [], winningMeal = '', moveText = null,
  } = input;
  const pick = chooser(`${seed}:${eventText}:${label}:${plies}:${win}`);
  const facts = gameFacts(moves, { initialSfen, userColor });
  // 棋譜がない(前の版・テスト)ときは、渡された寄せ(mate-finish.mjsのfinishingMate)を使う。
  const mate = facts.moves.length
    ? (reason === 'checkmate' || (!reason && facts.moves.at(-1)?.check) ? finalMate(facts.moves) : null)
    : input.mate ? { ...input.mate, by: win ? 'user' : 'opp' } : null;
  const story = storyOf({ rates, win, plies, facts, mate });
  const winner = win ? userName : opponentName;
  const loser = win ? opponentName : userName;
  const black = userColor === 'black' ? userName : opponentName;
  const white = userColor === 'black' ? opponentName : userName;
  const textOf = (ply) => facts.moves[ply - 1]?.text || moveText?.(ply) || '';
  const turnText = story.turning ? `${story.turning.ply}手目${textOf(story.turning.ply)}` : '中盤';
  const vars = {
    user: userName, opp: opponentName, winner, loser, plies, changes: story.changes, mate: mate?.plies ?? '',
    turn: turnText,
  };

  // 見出しと副見出し
  let headline;
  if (win && decided) headline = `${userName}、${decided}`;
  else if (story.kind === 'tonshi') headline = fill(pick(win ? HEADLINES.tonshiWin : HEADLINES.tonshiLoss), vars);
  else if (story.kind === 'rout') headline = fill(pick(win ? HEADLINES.routWin : HEADLINES.routLoss), vars);
  else if (story.kind === 'steady') headline = fill(pick(win ? HEADLINES.steadyWin : HEADLINES.steadyLoss), vars);
  else headline = fill(pick(HEADLINES[story.kind]), vars);
  const decisive = story.turning ? `${story.turning.ply}手目${textOf(story.turning.ply)}` : '';
  const subhead = [
    formations.black && formations.white ? `${formations.black}対${formations.white}` : '力戦',
    mate && mate.plies >= 3 ? `${mate.plies}手詰めの寄せ` : decisive ? `決め手は${decisive}` : `${plies}手の熱局`,
  ].join('　');

  // リード
  const kindLead = pick({
    comeback: [`一時は苦しい形勢に追い込まれた${userName}が、粘り強く指して逆転勝ちを収めた。`, `劣勢から${userName}が盛り返し、最後は逆転で制した。`],
    collapse: [`優位に立っていた${userName}だったが、終盤に${opponentName}が追い上げ、逆転された。`, `${userName}がリードを広げたかに見えたが、${opponentName}が終盤で逆転した。`],
    tonshi: story.tonshi === 'opp'
      ? [`互角に近い終盤、${opponentName}の玉に詰みが生じ、${userName}が一瞬の好機をものにした。`, `勝負の行方が見えない終盤、${opponentName}の玉に詰み筋が生まれ、${userName}が仕留めた。`]
      : [`勝負どころで${userName}の玉に詰み筋が生じ、${opponentName}がそれを逃さなかった。`, `互角の終盤、${userName}の玉に思わぬ詰みがあり、${opponentName}が勝ちを拾った。`],
    seesaw: [`形勢が${story.changes}度入れ替わる激しい攻防の末、${winner}が制した。`, `優劣が何度も入れ替わる熱戦となり、最後は${winner}が抜け出した。`],
    rout: [`${winner}が序盤から主導権を握り、${loser}に反撃の機会を与えなかった。`, `${winner}が一度もリードを譲らない完勝だった。`],
    close: [`最後まで互角に近い形勢が続いた一局は、紙一重の差で${winner}が抜け出した。`, `最後まで均衡の破れない接戦を、${winner}が制した。`],
    steady: [`${winner}が要所で正確に指し、${plies}手で勝ちを収めた。`, `${winner}が着実にリードを広げ、${plies}手で勝った。`],
  }[story.kind]);
  const lead = `${eventText}${label}は、${venue || '将棋会館'}で行われ、${kindLead}${score ? `これで${score}となった。` : ''}${win && decided ? `${userName}は${decided}を決めた。` : ''}`;

  // 序盤
  const firstCapture = facts.moves.find((move) => move.capture);
  const pace = !firstCapture ? 'none' : firstCapture.ply <= 24 ? 'early' : firstCapture.ply >= 50 ? 'slow' : 'normal';
  const openingParas = [
    `先手は${black}、後手は${white}。${formations.black && formations.white ? `戦型は${formations.black}対${formations.white}となった。` : '序盤から定跡を離れた力戦となった。'}${opponentStyle ? `${opponentName}${opponentDan}は${opponentStyle}の使い手として知られる。` : ''}`,
    fill(pick(OPENING[pace]), { first: firstCapture?.ply ?? '' }),
  ];

  // 中盤
  const middleParas = [];
  // 大駒を取った最初の手と、竜・馬を作った最初の手(同じ手ならまとめる)。手数の順に書く。
  const bigTrades = facts.moves.filter((move) => move.capture && BIG.has(move.capture));
  const firstBig = bigTrades[0];
  const madeBig = facts.moves.find((move) => move.promote && (move.piece === 'rook' || move.piece === 'bishop'));
  const events = [];
  if (firstBig) {
    const by = firstBig.side === 'user' ? userName : opponentName;
    const made = madeBig && madeBig.ply === firstBig.ply ? `${PIECE_NAME[firstBig.capture]}を取って${madeBig.piece === 'rook' ? '竜' : '馬'}を作り` : `${PIECE_NAME[firstBig.capture]}を取り`;
    events.push([firstBig.ply, `${firstBig.ply}手目、${by}が${firstBig.text}と${made}、${bigTrades.length >= 2 ? '大駒が飛び交う激しい展開となった。' : '局面の主導権を争った。'}`]);
  }
  if (madeBig && madeBig.ply !== firstBig?.ply) {
    const by = madeBig.side === 'user' ? userName : opponentName;
    events.push([madeBig.ply, fill(pick([
      '{ply}手目{move}で{by}が{piece}を作り、敵陣に食い込んだ。',
      '{by}は{ply}手目{move}と{piece}を作り、攻めの拠点を築いた。',
    ]), { ply: madeBig.ply, move: madeBig.text, by, piece: madeBig.piece === 'rook' ? '竜' : '馬' })]);
  }
  for (const [, text] of events.sort((a, b) => a[0] - b[0])) middleParas.push(text);
  if (story.turning) {
    const who = story.turning.by === 'user' ? userName : opponentName;
    middleParas.push(fill(pick([
      '勝負を分けたのは{ply}手目、{who}の{move}。この一手で形勢は{who}に傾いた。',
      '{ply}手目の{move}が大きかった。{who}がはっきり優位に立った。',
      '流れを変えたのは{who}の{move}({ply}手目)。控室もこの手に注目した。',
    ]), { ply: story.turning.ply, who, move: textOf(story.turning.ply) }));
  }
  const slip = oversights.find((ply) => ply > 20 && ply < plies - 2);
  if (slip && !win) {
    // 負けた局は責めない(N:6-3)。相手の見落としは勝った局だけ書く。
  } else if (slip) {
    middleParas.push(`${slip}手目、${opponentName}は${userName}の狙いを見落としたか。局後、${opponentName}は首をかしげていた。`);
  }
  if (story.kind === 'seesaw') middleParas.push(`形勢は${story.changes}度入れ替わり、どちらが勝ってもおかしくない展開が続いた。`);
  if (story.kind === 'comeback') middleParas.push(`一時は形勢を損ねた${userName}だったが、受けに回って辛抱を続けた。`);
  if (story.kind === 'collapse') middleParas.push(`中盤は${userName}がはっきり優位に立ち、勝利が近づいたかに見えた。`);
  if (story.kind === 'rout') middleParas.push(`${winner}は一度も形勢を譲らず、着実にリードを広げた。`);
  if (!middleParas.length) middleParas.push('中盤は互いに慎重な指し手が続き、形勢は大きく動かなかった。');

  // 終盤
  const endParas = [];
  const checks = facts.moves.filter((move) => move.check);
  const winnerSide = win ? 'user' : 'opp';
  const finalChecks = mate ? mate.plies : 0;
  if (story.kind === 'tonshi') {
    endParas.push(story.tonshi === 'opp'
      ? `終盤、${opponentName}の玉に思わぬ詰み筋が生じた。${userName}はこれを見逃さず、${mate.from}手目${textOf(mate.from)}から${mate.plies}手で詰ませた。`
      : `終盤、${userName}の玉に詰み筋が生じていた。${opponentName}は${mate.from}手目${textOf(mate.from)}から${mate.plies}手で詰め上げた。`);
  } else if (mate && mate.plies >= 3) {
    endParas.push(fill(pick([
      '最後は{from}手目{move}からの{mate}手詰め。{winner}が鮮やかに寄せ切った。',
      '{from}手目{move}から王手の連続。{mate}手で{loser}の玉を仕留めた。',
      '{winner}は{from}手目{move}から一気に寄せ、{mate}手詰めで決着をつけた。',
    ]), { from: mate.from, move: textOf(mate.from), mate: mate.plies, winner, loser }));
  } else if (mate) {
    endParas.push(`最後は${mate.from}手目${textOf(mate.from)}で詰み。`);
  } else if (reason === 'resignation') {
    endParas.push(fill(pick([
      '{loser}は勝ち目なしとみて、{plies}手で投了した。',
      '{plies}手目を見て、{loser}が駒を投じた。',
      '{loser}の投了で、{plies}手の熱戦に幕が下りた。',
    ]), { loser, plies }));
  }
  const winnerChecks = checks.filter((move) => move.side === winnerSide).length;
  if (winnerChecks >= 8 && finalChecks < winnerChecks) endParas.push(`${winner}はこの将棋で${winnerChecks}回の王手を重ね、${loser}の玉を追い詰めた。`);
  endParas.push(win
    ? `${plies}手まで、${userName}の勝ち。${winningMeal}`
    : `${plies}手まで、${opponentName}の勝ち。`);

  // 局後
  const afterParas = [];
  const winnerComment = fill(pick(win ? COMMENTS.winnerUser : COMMENTS.winnerOpp), vars);
  const loserComment = fill(pick(win ? COMMENTS.loserOpp : COMMENTS.loserUser), vars);
  afterParas.push(`局後、${winner}は${winnerComment}と話した。${loser}は${loserComment}と振り返った。`);
  if (!win) afterParas.push(`${userName}は、次の局へ静かに闘志を燃やしていた。`);

  const sections = [
    { title: '序盤', paragraphs: openingParas },
    ...dayBlocks,
    { title: dayBlocks.length ? '2日目' : '中盤', paragraphs: middleParas },
    { title: '終盤', paragraphs: endParas },
    { title: '局後', paragraphs: afterParas },
  ];
  return {
    headline,
    subhead,
    lead,
    sections,
    paragraphs: [lead, ...sections.flatMap((section) => section.paragraphs)],
    // 形勢の線(グラフ用。あなたから見た勝率%。多すぎる点は間引く)と、どちらの見立てか。
    curve: /** @type {[number, number][]} */ (thin(story.curve, 60).map(([ply, rate]) => [ply, Math.round(rate)])),
    curveKind: /** @type {'rate' | 'material'} */ (story.fromRates ? 'rate' : 'material'),
    story: story.kind,
    facts: [
      { label: '手数', value: `${plies}手` },
      { label: '戦型', value: formations.black && formations.white ? `${formations.black}対${formations.white}` : '力戦' },
      { label: '決着', value: mate ? (mate.plies >= 3 ? `${mate.plies}手詰め` : '詰み') : reason === 'resignation' ? '投了' : reason === 'repetition' ? '千日手' : '—' },
      { label: '王手（あなた・相手）', value: `${checks.filter((move) => move.side === 'user').length}回・${checks.filter((move) => move.side === 'opp').length}回` },
    ],
  };
}

/** 最後の王手の連続(詰ませた側・何手詰め・始まりの手数)。 */
function finalMate(moves) {
  const last = moves.at(-1);
  if (!last?.check) return null;
  let start = moves.length - 1;
  while (start - 2 >= 0 && moves[start - 2].check) start -= 2;
  return { plies: moves.length - start, from: start + 1, by: last.side };
}

function thin(curve, limit) {
  if (curve.length <= limit) return curve;
  const step = curve.length / limit;
  return Array.from({ length: limit }, (_, index) => curve[Math.floor(index * step)]).concat([curve.at(-1)]);
}
