// 師匠の1年の検討の、崩れ方の見立て(docs/disciple-mode-design.mdの33-5。段階C)。
// 弟子の手で形勢が落ちた場面を、盤面で起きたこと(駒の損得の動き・相手の次の手の手筋・王手の続き・詰み)から6つに分ける。
// 「序盤の悪手なら作戦負け」のような手数だけの決め方はしない。作戦負けは1手ではなく、序盤の区間で少しずつ不利になったこと。
// 時間切迫は理由ではなく背景の札(秒読みで出たうっかり、のように添える)。画面に依存しない。新しくエンジンで読まない。

import { appendUsiMove, createGameRecord, STANDARD_SFEN } from '../game-state';
import { captureOf, materialSwing } from './piece-points.mjs';
import { detectTesujiShape, TESUJI_SHAPES } from './tesuji-shape.mjs';
import { isSideToMoveInCheck } from './coach-advice.mjs';
import { discipleWatchMoves, MARK_COUNT, MARK_MIN_LOSS } from './disciple-strength.mjs';
import { evalWord } from './disciple-review.mjs';

/** 6つの崩れ方と、狙い目になる能力(33-5の表)。 */
export const REVIEW_CAUSES = Object.freeze({
  careless: Object.freeze({ id: 'careless', label: 'うっかり', note: '取られる駒の見落とし', target: 'steady' }),
  tactic: Object.freeze({ id: 'tactic', label: '手筋をくらった', note: '両取り・捨て駒を読めなかった', target: 'reading' }),
  policy: Object.freeze({ id: 'policy', label: '方針の誤り', note: '攻め急ぎ・緩手', target: 'plan' }),
  defense: Object.freeze({ id: 'defense', label: '受け損ない', note: '自玉の危険を見落とした', target: 'mate' }),
  yose: Object.freeze({ id: 'yose', label: '寄せの誤り', note: '勝ちを逃した', target: 'mate' }),
  plan: Object.freeze({ id: 'plan', label: '作戦負け', note: '序盤で少しずつ不利に', target: 'plan' }),
});
export const REVIEW_CAUSE_ORDER = Object.freeze(['careless', 'tactic', 'policy', 'defense', 'yose', 'plan']);
/** 前の版の理由(棋譜帳に残った答え)の名前。 */
const LEGACY_LABELS = Object.freeze({ reading: '読み負け', mate: '詰み逃し', time: '時間切迫' });
export const causeLabel = (id) => REVIEW_CAUSES[id]?.label ?? LEGACY_LABELS[id] ?? '';

/** 判定の物差し。 */
export const CAUSE_RULES = Object.freeze({
  /** 駒の損得をこれだけ損したら「駒を損した」(教室の駒の点数。歩1・金6・飛10)。 */
  lostPoints: 2,
  /** 指したあとに見る手数(相手の手を含む)。 */
  window: 4,
  /** 勝っている(寄せの誤りを考える)形勢。 */
  winning: 800,
  /** 詰みの評価値(engine-game.mjsの評価値。詰みは±30000から手数を引いた値)。 */
  mate: 20000,
  /** 序盤の終わり(最初の駒の取り合いか、この手数の早いほう)。 */
  openingMax: 40,
  /** 作戦負けとみなす、序盤の終わりの形勢(弟子から見て)。 */
  planBehind: -300,
  /** 受け損ない: 相手の王手が続いた回数。 */
  checkChain: 2,
  /** 印にする勝つ見込みの落ち幅(勝勢から優勢のように、勝ち負けの変わらない落ち方は印にしない)。 */
  winDrop: 0.12,
  /** 評価値を勝つ見込みにする幅(中継の勝率と同じ考え方)。 */
  winScale: 600,
});

/** 評価値(弟子から見た値)を、勝つ見込み(0〜1)にする。 */
export const winChanceOf = (cp) => 1 / (1 + Math.exp(-Math.max(-CAUSE_RULES.mate, Math.min(CAUSE_RULES.mate, Number(cp) || 0)) / CAUSE_RULES.winScale));
/** 答えの重み(33-5): 主を当てる・副(おしい)・外れ。 */
export const REVIEW_AIM = Object.freeze({ right: 1.5, near: 1.35, wrong: 1.25, turns: 3 });

/** 局面の列(はじめから何手指した局面か。0〜手数)。 */
function sfenList(entries, sfen = STANDARD_SFEN) {
  const record = createGameRecord(sfen);
  const list = [record.position.sfen];
  for (const entry of entries) {
    if (!appendUsiMove(record, entry.move)) break;
    list.push(record.position.sfen);
  }
  return list;
}

/** 攻めの手か(駒を取る・王手・相手の陣に入る・相手の陣に打つ)。 */
function isAttackMove(sfen, usi, side) {
  if (!usi || !sfen) return false;
  if (captureOf(sfen, usi)) return true;
  const record = createGameRecord(sfen);
  if (!appendUsiMove(record, usi)) return false;
  if (isSideToMoveInCheck(record.position.sfen)) return true;
  const rank = Number(String(usi).charCodeAt(3) - 96);
  return side === 'black' ? rank <= 3 : rank >= 7;
}

/** 序盤の終わりの手数(最初の駒の取り合いか、openingMaxの早いほう)。 */
export function openingEnd(entries, sfens = sfenList(entries)) {
  for (let index = 0; index < Math.min(entries.length, CAUSE_RULES.openingMax); index += 1) {
    if (captureOf(sfens[index], entries[index].move)) return Math.max(1, index);
  }
  return Math.min(entries.length, CAUSE_RULES.openingMax);
}

/**
 * 弟子の1手の崩れ方。盤面の事実が足りなければnull(印にしない)。
 * @param {readonly { move: string, eval?: number, best?: string, d?: { o?: number, m?: number, c?: string, k?: string[] } }[]} entries 本局の棋譜(評価値は先手から見た値)
 * @param {'black' | 'white'} side 弟子の側
 * @param {number} ply 弟子の手(1から)
 * @param {{ sfens?: string[], openingPly?: number, sfen?: string }} [cache] sfenははじめの局面(ふつうは平手)
 * @returns {{ cause: string, alt: string | null, sub: string, swing: number, facts: string[], rings: string[], threat: string, tags: string[] } | null}
 */
export function classifyMove(entries, side, ply, { sfen = STANDARD_SFEN, sfens = sfenList(entries, sfen), openingPly = openingEnd(entries, sfens) } = {}) {
  const entry = entries[ply - 1];
  if (!entry) return null;
  const sign = side === 'black' ? 1 : -1;
  const pov = (index) => (index >= 0 ? sign * (Number(entries[index]?.eval) || 0) : 0);
  const before = pov(ply - 2);
  const after = pov(ply - 1);
  const moves = entries.map((item) => item.move);
  const swing = materialSwing(sfens[ply - 1], moves.slice(ply - 1, ply + CAUSE_RULES.window), side);
  const reply = moves[ply] ?? '';
  const replyCapture = reply ? captureOf(sfens[ply], reply) : null;
  const tesuji = reply ? detectTesujiShape({ sfenBefore: sfens[ply], usi: reply }) : null;
  const tesujiName = tesuji ? TESUJI_SHAPES.find((shape) => shape.id === tesuji.id)?.name ?? '' : '';
  // 相手の王手の続き(弟子の手のあとの、相手の手番ごと)。
  let checks = 0;
  for (let at = ply + 1; at < sfens.length; at += 2) {
    if (!isSideToMoveInCheck(sfens[at])) break;
    checks += 1;
  }
  const missedMate = Boolean(entry.d?.m);
  const allowedMate = after <= -CAUSE_RULES.mate && before > -CAUSE_RULES.mate;
  const oversight = entry.d?.k ?? [];
  // 相手が駒を取った最初の升(取られた駒の赤い輪)と、その手(点線の矢印)。
  let firstTake = { square: '', usi: '' };
  for (let index = ply; index < Math.min(moves.length, ply + CAUSE_RULES.window); index += 2) {
    const taken = captureOf(sfens[index], moves[index]);
    if (taken) {
      firstTake = { square: taken.square, usi: moves[index] };
      break;
    }
  }
  const tags = entry.d?.c === 'byoyomi' || entry.d?.c === 'low' ? ['time'] : [];
  const facts = [];
  if (swing <= -CAUSE_RULES.lostPoints) facts.push(`このあと${CAUSE_RULES.window}手で駒を${-swing}点損した`);
  else if (swing < CAUSE_RULES.lostPoints) facts.push('駒の損得はほとんど動かない');
  if (checks >= 1) facts.push(`相手の王手が${checks}回続いた`);
  if (before >= CAUSE_RULES.winning) facts.push('指す前は勝っていた');
  const result = (cause, alt = null, sub = '', rings = [], threat = '') => ({ cause, alt, sub, swing, facts, rings, threat, tags, tesuji: tesujiName });

  if (missedMate) return result('yose', null, 'mate', [], '');
  if (allowedMate || (checks >= CAUSE_RULES.checkChain && (swing <= -CAUSE_RULES.lostPoints || after <= -1500))) {
    return result('defense', tesuji ? 'tactic' : null, '', firstTake.square ? [firstTake.square] : [], reply);
  }
  if (swing <= -CAUSE_RULES.lostPoints) {
    // 相手の次の手が手筋の形か、駒を取らない手のあとに損をした → 手筋をくらった。次の手でそのまま取られた → うっかり。
    if ((tesuji || !replyCapture) && !oversight.includes('hanging')) {
      return result('tactic', 'careless', tesuji?.id ?? '', tesuji?.targets?.length ? tesuji.targets : [firstTake.square].filter(Boolean), reply);
    }
    return result('careless', tesuji ? 'tactic' : null, '', [firstTake.square].filter(Boolean), firstTake.usi || reply);
  }
  if (before >= CAUSE_RULES.winning) return result('yose', 'policy', 'slow', [], '');
  // 駒の損得がほとんど動かない(歩1枚の損得まで)のに形勢を損ねた。
  if (swing < CAUSE_RULES.lostPoints) {
    const bestAttack = isAttackMove(sfens[ply - 1], entry.best ?? '', side);
    const playedAttack = isAttackMove(sfens[ply - 1], entry.move, side);
    const sub = bestAttack && !playedAttack ? 'slow' : playedAttack && !bestAttack ? 'rush' : '';
    return result('policy', ply <= openingPly ? 'plan' : null, sub, [], '');
  }
  return null;
}

/**
 * 作戦負けの区間(33-5)。序盤の終わりの形勢が弟子から見て−300点以下で、その区間に大きく落ちた1手がない(少しずつ落ちた)とき。
 * @param {readonly { move: string, eval?: number }[]} entries
 * @param {'black' | 'white'} side
 */
export function planSection(entries, side, { sfens = sfenList(entries), openingPly = openingEnd(entries, sfens) } = {}) {
  const sign = side === 'black' ? 1 : -1;
  const pov = (index) => sign * (Number(entries[index]?.eval) || 0);
  if (openingPly < 10) return null;
  const end = pov(openingPly - 1);
  if (end > CAUSE_RULES.planBehind) return null;
  const big = discipleWatchMoves(entries.slice(0, openingPly), side).some((move) => move.loss >= MARK_MIN_LOSS);
  if (big) return null;
  return { from: 1, to: openingPly, loss: Math.round(-end), startWord: evalWord(0).word, endWord: evalWord(end).word };
}

/** 崩れ方の手がかりの札(何手目と局面・背景・盤面の事実)。 */
function phaseText(ply, openingPly) {
  if (ply <= openingPly) return '序盤';
  return ply <= openingPly + 50 ? '中盤' : '終盤';
}

/**
 * 検討の印(33-5)。崩れた手のうち、崩れ方を言える手を落ち幅の大きい順に(師匠の眼の段で数が増える)。作戦負けの区間は別に1つ。
 * @param {readonly any[]} entries
 * @param {'black' | 'white'} side
 * @param {{ dan?: number, big?: boolean }} [options]
 */
export function reviewMarks(entries, side, { dan = 1, big = false } = {}) {
  const sfens = sfenList(entries);
  const openingPly = openingEnd(entries, sfens);
  const count = Math.min(MARK_COUNT.max, MARK_COUNT.base + Math.floor((Math.max(1, dan) - 1) / MARK_COUNT.perDan));
  const sign = side === 'black' ? 1 : -1;
  const pov = (index) => (index >= 0 ? sign * (Number(entries[index]?.eval) || 0) : 0);
  // 勝つ見込みの落ち幅で並べる(勝勢から優勢のような、勝ち負けの変わらない落ち方は印にしない)。
  const drop = (ply) => winChanceOf(pov(ply - 2)) - winChanceOf(pov(ply - 1));
  const marks = discipleWatchMoves(entries, side)
    .filter((move) => move.loss >= MARK_MIN_LOSS && drop(move.ply) >= CAUSE_RULES.winDrop)
    .sort((a, b) => drop(b.ply) - drop(a.ply) || a.ply - b.ply)
    .map((move) => {
      const judged = classifyMove(entries, side, move.ply, { sfens, openingPly });
      if (!judged) return null;
      const tags = [...judged.tags, ...(big ? ['big'] : [])];
      const clues = [`${move.ply}手目（${phaseText(move.ply, openingPly)}）`, ...(tags.includes('time') ? ['秒読み'] : []), ...judged.facts];
      if (judged.rings.length) clues.push('赤い輪：取られた・ねらわれた駒');
      if (judged.threat) clues.push('点線の矢印：相手の次の手');
      return { ply: move.ply, loss: Math.round(move.loss), cause: judged.cause, alt: judged.alt, sub: judged.sub, tesuji: judged.tesuji, tags, clues, rings: judged.rings, threat: judged.threat };
    })
    .filter(Boolean)
    .slice(0, count);
  const section = planSection(entries, side, { sfens, openingPly });
  if (section && !marks.some((mark) => mark.ply <= section.to)) {
    marks.push({
      ply: section.to, loss: section.loss, cause: 'plan', alt: 'policy', sub: 'section', tesuji: '', tags: big ? ['big'] : [], rings: [], threat: '',
      from: section.from, to: section.to, startWord: section.startWord, endWord: section.endWord,
      clues: [`序盤（${section.from}〜${section.to}手）`, `形勢 ${section.startWord} → ${section.endWord}`, '大きく落ちた1手はない'],
    });
  }
  return marks.sort((a, b) => a.ply - b.ply);
}

/**
 * 答えの判定(33-5)。主の分類なら見抜いた(×1.5)、副ならおしい(×1.35)、外れは答えを見せる(×1.25)。
 * 秒読みの手なら、早指し(持ち時間の適性)も狙い目に足す。
 * @param {{ cause: string, alt?: string | null, tags?: string[] }} mark
 * @param {string} guess
 */
export function judgeReviewGuess(mark, guess) {
  const right = mark.cause === guess;
  const near = !right && Boolean(mark.alt) && mark.alt === guess;
  const target = REVIEW_CAUSES[mark.cause]?.target ?? '';
  return {
    right, near, cause: mark.cause, target, time: Boolean(mark.tags?.includes('time')),
    boost: right ? REVIEW_AIM.right : near ? REVIEW_AIM.near : REVIEW_AIM.wrong, turns: REVIEW_AIM.turns,
  };
}

/** 答えのあとの一言(崩れ方の中身を、その手の言葉で)。 */
export function causeExplain(mark) {
  const time = mark.tags?.includes('time') ? '（秒読み）' : '';
  switch (mark.cause) {
    case 'careless': return `うっかり${time}。次の手で駒をただで取られる形だった`;
    case 'tactic': return `手筋をくらった${time}。${mark.tesuji ? `相手の「${mark.tesuji}」` : '相手の次の手からの取り合い'}を読めていなかった`;
    case 'policy': return `方針の誤り${time}。${mark.sub === 'slow' ? '攻めるべきところで守った（緩手）' : mark.sub === 'rush' ? '守るべきところで攻めた（攻め急ぎ）' : '駒の損得は動かないのに、形勢を損ねた'}`;
    case 'defense': return `受け損ない${time}。自分の玉の危険を見落とした`;
    case 'yose': return `寄せの誤り${time}。${mark.sub === 'mate' ? 'この局面には詰みがあった' : '勝っている終盤で、寄せが遅れた'}`;
    case 'plan': return `作戦負け。序盤の駒組みのあいだに、少しずつ形勢を損ねた（${mark.startWord ?? '互角'} → ${mark.endWord ?? ''}）`;
    default: return causeLabel(mark.cause);
  }
}
