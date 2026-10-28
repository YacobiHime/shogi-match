// 中継の声(docs/tournament-relay-design.mdの5章)。解説者と聞き手(やこび姫)・視聴者のコメント・対局者の心の声を、棋譜から作る。
// どれも盤の事実(手の種類・評価値・時間・戦型の判定)と、棋士の能力・特殊能力から作り、言い切れないことは言わない。
// 対局者を責める言葉は使わない(U:4-3, 8)。種(対局の鍵)が同じなら、同じ中継になる。保存はしない。画面に依存しない。

import { createRng, pick } from './ryuo-random.mjs';
import { HANANE, YOSHIHIKO } from './ryuo-story.mjs';
import { opponentVoice } from './match-presence.mjs';
import { applyUsiToBoard, findKing, isKingAttacked, opponentOf, parseSfenState, relativeRank } from './piece-movement.mjs';
import { detectTesuji, TESUJI_NAMES } from './move-tesuji.mjs';
import { formatHintMove } from './match-assists.mjs';
import { appendUsiMove, createGameRecord } from '../game-state';
import { attackStyleLabel, isGoldTrait, traitById, traitLabel } from './player-character.mjs';
import { proOpening, usageRows } from './opening-usage.mjs';
import { SURNAME_WEIGHTS } from './ryuo-names.mjs';
import { HOW_LABELS } from './ryuo-simulation.mjs';
import { STAGE_MEALS } from './title-day.mjs';
import { blackWinRate, clockText, isMateCp, relayPlan, relaySeed, thinkTimeText } from './relay-game.mjs';

/** 将棋会館の対局(1日制)の昼食・夕食の出前。 */
export const KAIKAN_MEALS = Object.freeze(['うな重', 'カツ丼', '天ぷらそば', 'カレーライス', 'オムライス', 'ざるそば', '親子丼', 'チャーハン', '鍋焼きうどん', 'ハンバーグ定食']);
/** 聞き手の名前。 */
export const RELAY_HOST = 'やこび姫';
/** 長考とみなす考えた時間(秒)。 */
export const LONG_THINK_SECONDS = 30 * 60;
/** 形勢が動いたとみなす勝率の動き(0〜1)。 */
const SWING = 0.12;
/** 1局で出す心の声の上限。 */
const THOUGHT_LIMIT = 12;
/** 鋭い一手をほめる回数の上限。 */
const ONLY_LIMIT = 3;

const SIDE_MARK = Object.freeze({ black: '▲', white: '△' });
const SIDE_NAME = Object.freeze({ black: '先手', white: '後手' });
const PIECE_NAMES = Object.freeze({
  P: '歩', L: '香', N: '桂', S: '銀', G: '金', B: '角', R: '飛車', K: '玉',
  '+P': 'と金', '+L': '成香', '+N': '成桂', '+S': '成銀', '+B': '馬', '+R': '龍',
});
const MAJOR = new Set(['B', 'R', '+B', '+R']);
const SURNAMES = [...SURNAME_WEIGHTS.map(([surname]) => surname)].sort((a, b) => b.length - a.length);

const other = (side) => (side === 'black' ? 'white' : 'black');

// ---- 名前と配役

/** 解説・聞き手が呼ぶ名前(苗字＋さん。羽音と善彦は下の名前。同じ苗字の2人なら全部)。 */
export function callName(player, rival = null) {
  if (!player) return '';
  if (player.story === HANANE) return '羽音さん';
  if (player.story === YOSHIHIKO) return '善彦さん';
  const name = player.name ?? '';
  const surname = SURNAMES.find((candidate) => name.startsWith(candidate) && name.length > candidate.length);
  if (!surname || (rival?.name ?? '').startsWith(surname)) return `${name}さん`;
  return `${surname}さん`;
}

/**
 * 解説者を選ぶ。羽音の対局は善彦、善彦の対局は羽音。それ以外は推しの棋士、いなければ上位の棋士から種で選ぶ。
 * @param {{ spec: any, pool: any[], oshiId?: string | null }} options poolは名簿か期の棋士(id・name・dan・rating・story)
 * @returns {{ id: string, name: string, dan: string, story: string | null, voice: 'hanane' | 'yoshihiko' | 'polite' }}
 */
export function relayCast({ spec, pool = [], oshiId = null }) {
  const playing = new Set([spec.black?.id, spec.white?.id]);
  const free = pool.filter((member) => member && !playing.has(member.id) && member.kind !== 'user' && member.id !== 'user' && member.kind !== 'amateur');
  const stories = [spec.black?.story, spec.white?.story];
  const byStory = (story) => free.find((member) => member.story === story);
  const chosen = (stories.includes(HANANE) ? byStory(YOSHIHIKO) : null)
    ?? (stories.includes(YOSHIHIKO) ? byStory(HANANE) : null)
    ?? (oshiId ? free.find((member) => member.id === oshiId) : null)
    ?? [...free].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[relaySeed(`${spec.key}:cast`) % Math.max(1, Math.min(8, free.length))]
    ?? null;
  if (!chosen) return { id: '', name: '解説者', dan: '', story: null, voice: 'polite' };
  return {
    id: chosen.id, name: chosen.name, dan: chosen.dan ?? '', story: chosen.story ?? null,
    voice: chosen.story === HANANE ? 'hanane' : chosen.story === YOSHIHIKO ? 'yoshihiko' : 'polite',
  };
}

// ---- 手の事実と表記

/**
 * 手の事実(盤から言えることだけ)。sideは指した側。
 * @param {string} sfenBefore
 * @param {string} usi
 */
export function moveFacts(sfenBefore, usi) {
  const { board, turn } = parseSfenState(sfenBefore);
  const applied = applyUsiToBoard(board, usi, turn);
  if (!applied) return null;
  const { moved, captured, board: after } = applied;
  const originalKind = moved.drop ?? board.get(moved.from)?.kind ?? moved.kind;
  const enemy = opponentOf(turn);
  const enemyKing = findKing(after, enemy);
  const ownKing = findKing(after, turn);
  let tesuji = [];
  try {
    tesuji = detectTesuji({ sfenBefore, usi });
  } catch {
    tesuji = [];
  }
  return {
    side: turn,
    kind: originalKind,
    after: moved.kind,
    from: moved.from ?? null,
    to: moved.to,
    drop: Boolean(moved.drop),
    promote: moved.kind !== originalKind,
    captured: captured?.kind ?? null,
    check: Boolean(enemyKing && isKingAttacked(after, enemy)),
    kingMove: originalKind === 'K',
    nearEnemyKing: Boolean(enemyKing && distance(enemyKing, moved.to) <= 2),
    nearOwnKing: Boolean(ownKing && distance(ownKing, moved.to) <= 2),
    rank: relativeRank(moved.to, turn),
    tesuji,
  };
}

function distance(a, b) {
  const [ax, ay] = [Number(a[0]), a.charCodeAt(1) - 96];
  const [bx, by] = [Number(b[0]), b.charCodeAt(1) - 96];
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

/** 手の表記(「▲7六歩」。直前の手と同じマスなら「△同歩」)。 */
export function moveTextOf(sfenBefore, usi, previousUsi = '') {
  const side = sfenBefore.split(' ')[1] === 'w' ? 'white' : 'black';
  let text;
  try {
    text = formatHintMove(usi, sfenBefore);
  } catch {
    return `${SIDE_MARK[side]}${usi}`;
  }
  const destination = usi.includes('*') ? usi.slice(2, 4) : usi.slice(2, 4);
  if (previousUsi && !usi.includes('*') && previousUsi.slice(2, 4) === destination) text = `同${text.slice(2)}`;
  return `${SIDE_MARK[side]}${text}`;
}

/** 読み筋の表記(「△同歩 → ▲同飛 → △2三歩」)。指せない手が出たらそこまで。 */
export function pvTextOf(sfen, pv, previousUsi = '', limit = 4) {
  const moves = (Array.isArray(pv) ? pv : String(pv ?? '').split(' ')).filter(Boolean).slice(0, limit);
  const record = createGameRecord(sfen);
  const labels = [];
  let previous = previousUsi;
  for (const usi of moves) {
    const before = record.position.sfen;
    if (!appendUsiMove(record, usi)) break;
    labels.push(moveTextOf(before, usi, previous));
    previous = usi;
  }
  return labels.join(' → ');
}

/** 手の意味(解説者の答え。盤から言えることだけ)。「〜する手」の形の言葉で、言えなければ空。 */
export function moveMeaning(facts, { ply = 99 } = {}) {
  if (!facts) return '';
  const name = PIECE_NAMES[facts.kind] ?? '駒';
  if (facts.tesuji.length) return `「${TESUJI_NAMES[facts.tesuji[0]]}」という手筋`;
  if (facts.captured && facts.check) return `${PIECE_NAMES[facts.captured] ?? '駒'}を取りながら王手をかける手`;
  if (facts.captured) return `${PIECE_NAMES[facts.captured] ?? '駒'}を取る手`;
  if (facts.check) return facts.drop ? `${name}を打って王手をかける手` : `${name}で王手をかける手`;
  if (facts.promote) return `${name}が成って${PIECE_NAMES[facts.after] ?? '成り駒'}になる手`;
  if (facts.drop) {
    if (facts.nearEnemyKing) return `${name}を相手の玉の近くに打って、攻めの拠点を作る手`;
    if (facts.nearOwnKing) return `${name}を自分の玉の近くに打って、守りを固める手`;
    return `持ち駒の${name}を打つ手`;
  }
  if (facts.kingMove) return ply < 50 ? '玉を囲いの奥へ寄せる手' : '玉を逃がして、安全なところへ移す手';
  if (facts.kind === 'R' && facts.from && facts.from[1] === facts.to[1] && ply < 30) return '飛車を横に振って、作戦の方針を決める手';
  if (facts.kind === 'P' && ply < 20) return '歩を突いて、駒の通り道を作る手';
  if ((facts.kind === 'G' || facts.kind === 'S') && facts.nearOwnKing) return `${name}を玉に近づけて、囲いを固める手`;
  if (facts.nearEnemyKing) return `${name}を相手の玉に近づける、攻めの手`;
  if (facts.rank <= 4) return `${name}を前に進めて、攻めに参加させる手`;
  return '';
}

// ---- 視聴者のコメント(5-2・12章)
// 書き手の種類(kind)ごとに言い方を持つ。{move}は指し手(▲2四歩)、{piece}は駒、{name}は棋士の呼び名など。
// 責める言葉(「ひどい」「大悪手」「ミス」)は使わない。

const VIEWER = Object.freeze({
  start: ['きたー', '待ってた', 'わこつ', 'よろしくお願いします', 'どっち応援する？', '今日はこの対局'],
  opening: ['定跡どおり', '研究会でやってたやつ', 'ここまでは早い', 'この戦型好き'],
  formation: ['{name}だ', '{name}きた！', '出た{name}'],
  castle: ['{name}完成', '堅い', '囲い合いだ', 'しっかり囲った'],
  capture: ['取った', 'ここで取るか', 'ふむ'],
  major: ['大駒取った！', 'おおお', 'これは大きい', '{piece}取った！'],
  bishop: ['角交換きた', '角換わった', '打ち込みに注意'],
  check: ['王手！', 'おおお', '迫る迫る', 'こわい'],
  promote: ['成った！', '{piece}できた', '成り込んだ'],
  longThink: ['長考きた', '考えてる考えてる', 'これは悩む', '長考入ったー', 'おやつ何かな', '時間使うねー'],
  byoyomi: ['秒読み入った', '1分将棋！', '50秒…', 'がんばれー', '時間ない！'],
  // 秒読みの最中(記録係の読み上げをまねる)。
  byoyomiOn: ['30秒…', '40秒', '50秒…', '1、2、3…', '早く早く', 'ドキドキする', '秒読みの中でよく指す'],
  swing: ['あれ？', '形勢動いた？', '勝率が…', 'えっ', 'これは痛い？', 'ガクッときた'],
  only: ['すごい', 'うますぎる', 'これは見えない', '!!', '神の一手？', 'さすが'],
  ending: ['終盤だ', '詰む？', '詰まない？', '手に汗にぎる', 'どっちだ', '見てられない'],
  winning: ['決まった？', 'これは寄った', 'もう勝ちかな', '受けがない？'],
  resign: ['投了', 'ありがとうございました', '8888888', 'おつかれさま', '名局だった', '888'],
  winner: ['{name}おめでとう', '{name}強い', '{name}さすが'],
  lunch: ['昼食休憩', '{meal}うまそう', '勝負メシきた', 'おなかすいた', 'お昼だー'],
  dinner: ['夕食休憩', '夜戦だ', '{meal}いいな', '長くなりそう'],
  seal: ['封じ手だ', '明日も楽しみ', '封じ手予想しよう', 'おつかれさま1日目'],
  idle: [
    '駒音いいね', '勉強になる', '解説わかりやすい', 'やこび姫かわいい', '初見です', '今日は長いぞ', '盤がきれい', 'ほうほう', 'なるほど',
    'いい対局', 'この局面むずい', 'わからん', '先手持ちたい', '後手持ちたい', '形勢わからん', '渋い', '見入ってしまう', '今北', '何手目？',
  ],
  rival: ['羽音ちゃん！', 'はのんちゃんきた', '羽音ちゃんがんばれ', '天才少女'],
  father: ['善彦先生だ', '最強きた', '六冠の人', '善彦先生の将棋が見られる'],
  oshi: ['推しの{name}！', '{name}がんばれ', '{name}きたー'],
  cheer: ['{name}がんばれ', '{name}ファイト'],
  title: ['タイトル戦きた', '七番勝負！', '和服かっこいい', '大舞台だ'],
  // 実況: 指し手をそのまま言う。
  play: ['{move}', '{move}きた', '{move}か', '{move}！', 'はい{move}'],
  drop: ['{piece}打ち！', '{move}', 'ここに{piece}を打つか', '{piece}を打った'],
  // 予想: 考慮中に前の手の読み筋から。指したあとに当たり外れ。
  predict: ['次は{move}と見た', '{move}でしょ', '{move}が見える', '{move}かな？', '自分なら{move}'],
  predictHit: ['予想的中', '当たった！', '読み通り', 'やっぱり{move}', '的中ｷﾀ'],
  predictMiss: ['そっちか', '予想外れた', 'え、そっち？', '{move}じゃないんだ', 'なるほどそっちか'],
  // AI勢: 評価値と勝率。
  ai: ['AI{side}{rate}%', '評価値{eval}', 'AI的には{side}よし', '評価値{eval}か', 'AIの読みだと{side}'],
  aiEven: ['AIだと互角', '評価値ほぼ0', 'まだ互角', 'AI的には五分'],
  aiBest: ['AIだと{best}らしい', 'AI推奨は{best}', '{best}が最善だったのか', '{best}は見えない'],
  // 戦法通: 戦型・囲い・定跡。
  battleKind: ['{kind}だ', '{kind}きた', 'これは{kind}', '{kind}好き'],
  castles: ['{a}対{b}', '{a}と{b}か', '囲い合い、{a}対{b}'],
  specialty: ['{opening}は{name}の十八番', '出た{name}の{opening}', '{name}といえば{opening}'],
  theory: ['ここから未知の局面', '研究が外れた？', '定跡を離れた', '前例のない形'],
  // 時計勢: 残り時間と配分。
  clock: ['{name}残り{time}', '残り{time}か', '{name}の残り{time}'],
  clockGap: ['持ち時間の差すごい', '時間の使い方が対照的', '{name}だいぶ時間残してる'],
  fast: ['{name}早指しだな', 'ノータイムだ', '準備してたな'],
  // ネタ: 対局室の様子とおやつ。
  neta: ['正座つらそう', 'お茶飲んだ', '扇子パタパタしてる', '記録係さんおつかれ', '外は雨らしい', '首をかしげてる'],
  oyatsu: ['おやつの時間', 'おやつ何？', '3時のおやつ', 'おやつタイム', 'ケーキかな'],
  // 解説への反応。
  castStart: ['{cast}先生の解説だ', '解説たすかる', '{cast}先生！', '解説の人好き'],
  castHanane: ['羽音ちゃん解説！', '羽音ちゃんの解説めずらしい', '辛口解説きた', 'お父さんの対局を解説'],
  castFather: ['親子解説！', 'パパ解説', '善彦先生の解説ぜいたく', '照れてる'],
  castAgree: ['解説の通りだ', 'さすが解説', '解説が見えてる'],
  // 応援(特殊能力の持ち主)と、次の相手の対局。
  trait: ['{name}の{trait}見たい', '{trait}くる？', '{trait}の{name}', '{trait}出せ'],
  next: ['次の相手の研究タイム', 'よく見ておこう', '対策メモ'],
  // 盛り上がり(大きな字)。
  hype: ['うおおおお', '!?!?', 'ｷﾀ━━', 'えええ', 'すげえ', 'まじか'],
});

/** 初心者の質問と、ほかの視聴者の答え(用語が出た場面で、1局に1回ずつ。D:6-2)。 */
const NEWBIE = Object.freeze({
  bishop: ['角交換って？', '→角どうしを取り合うこと。打ち込みのすきに注意'],
  promote: ['成るとどうなるの？', '→裏返って強くなる。飛車は龍、角は馬'],
  check: ['王手って何？', '→次に玉を取るぞ、という手'],
  byoyomi: ['秒読みって？', '→持ち時間がなくなったら、1手60秒以内に指すルール'],
  seal: ['封じ手って？', '→次の手を紙に書いて、封筒に入れておくやつ'],
  castle: ['{name}ってなに？', '→玉を金や銀で守る形。囲いっていうよ'],
  drop: ['取った駒って使えるの？', '→持ち駒になって、好きなところに打てるよ'],
  theory: ['定跡って？', '→昔から研究されてる、決まった手順のこと'],
  lunch: ['休憩中は何してるの？', '→ごはんを食べながら、作戦を考えてる'],
  meaning: ['今の{move}ってどういう意味？', '→{meaning}'],
});

/** コメントの書き手の種類(色を決める)。 */
const POOL_KIND = Object.freeze({
  start: 'hype', opening: 'theory', formation: 'theory', castle: 'theory', capture: 'play', major: 'play', bishop: 'play', check: 'play',
  promote: 'play', longThink: 'clock', byoyomi: 'clock', byoyomiOn: 'clock', swing: 'hype', only: 'hype', ending: 'hype', winning: 'hype', resign: 'hype',
  winner: 'cheer', lunch: 'neta', dinner: 'neta', seal: 'neta', idle: 'idle', rival: 'cheer', father: 'cheer', oshi: 'cheer', cheer: 'cheer',
  title: 'hype', play: 'play', drop: 'play', predict: 'predict', predictHit: 'predict', predictMiss: 'predict', ai: 'ai', aiEven: 'ai',
  aiBest: 'ai', battleKind: 'theory', castles: 'theory', specialty: 'theory', theory: 'theory', clock: 'clock', clockGap: 'clock', fast: 'clock',
  neta: 'neta', oyatsu: 'neta', castStart: 'cast', castHanane: 'cast', castFather: 'cast', castAgree: 'cast', trait: 'cheer', next: 'cheer', hype: 'hype',
});

/** 書き手の種類の色(盤の升の強調とは別の、縁取りの文字)。 */
const KIND_TONE = Object.freeze({ ai: 'blue', newbie: 'green', answer: 'green', cheer: 'pink' });

/** 対局の重さで、コメントの数を増やす(タイトル戦ほど多い)。 */
const DENSITY = Object.freeze({ plain: 1, big: 1.3, title: 1.7 });

/** 振り飛車の名前(対抗形・相振り飛車を見分ける)。 */
const FURIBISHA = /(四間|三間|中|向かい)飛車|ゴキゲン|石田|振り飛車/;
const isFuri = (name) => Boolean(name) && FURIBISHA.test(name) && !/右四間/.test(name);

// ---- 心の声(5-3)

const THOUGHTS = Object.freeze({
  attack: {
    start: '今日も攻めて勝つ', think: '踏み込むか……いや、もう一手深く', ahead: 'よし、一気に決める', behind: '攻め合いに持ち込むしかない',
    byoyomi: '時間がない。直感でいく', regret: 'しまった……読み抜けだ', chance: '来た、ここがチャンスだ', resign: '……ここまでか', win: 'よし、勝ち切った',
  },
  defense: {
    start: 'じっくり、手厚く', think: '一番固い手は、どれだ', ahead: '焦らず、手厚く', behind: 'まだ粘れる。辛抱だ',
    byoyomi: '落ち着け。受けは見えている', regret: '……甘かったか', chance: '相手が無理をした。じっくり咎めよう', resign: '……ここまでか', win: '最後まで、崩れずに済んだ',
  },
  balance: {
    start: '自分の将棋を指そう', think: 'ここは大事な局面だ', ahead: '良くなった。丁寧にいこう', behind: '苦しいが、何かあるはず',
    byoyomi: '時間がない。落ち着いて', regret: 'しまった……', chance: '今の手は、甘いんじゃないか', resign: '……負けだ', win: '勝てた。いい将棋だった',
  },
  // 羽音は敬語を使わない(ryuo-story.mjsのHANANE_LINESと同じ書き方)。
  hanane: {
    start: '……落ち着いて。いつも通り', think: '……もう少し、深く', ahead: '……このまま、正確に', behind: '……まだ、終わってない',
    byoyomi: '大丈夫。読めてる', regret: '……今の、甘かった', chance: '……見えた', resign: '……私の負け', win: '……勝った',
  },
  yoshihiko: {
    start: 'さて、楽しませてもらおう', think: 'この局面は、深いな', ahead: 'ここは厚く指そう', behind: 'なるほど……面白い',
    byoyomi: '久しぶりの秒読みだ', regret: 'おっと、これは見落とした', chance: 'ほう、そう来たか', resign: '負けだ。見事だった', win: 'いい将棋だった',
  },
});

/** 心の声の口調。 */
export function thoughtVoice(player) {
  return opponentVoice({ character: player?.character ?? null, story: player?.story ?? null });
}

// ---- 解説と聞き手の言い方

/** 解説者の口調(羽音は敬語を使わないので、plainを使う)。 */
function speak(cast, polite, plain) {
  return cast.voice === 'hanane' ? plain : polite;
}

/** 棋士の紹介の見どころ(棋風と、いちばんの特殊能力)。 */
function playerHighlight(player) {
  const style = attackStyleLabel(player?.character?.attack);
  const gold = (player?.character?.traits ?? []).find(({ id }) => isGoldTrait(id));
  const strong = (player?.character?.traits ?? []).find(({ id }) => traitById(id)?.kind === 'strength' && !isGoldTrait(id));
  if (gold) return `${style}で、『${traitLabel(gold)}』の持ち主`;
  if (strong) return `${style}。${traitLabel(strong)}`;
  return style;
}

/** 得意戦法(使用率のいちばん上)。 */
function favoriteOpening(player) {
  const row = usageRows(player?.repertoire?.usage)[0];
  return row?.label ?? '';
}

const has = (player, id) => Boolean(player?.character?.traits?.some((trait) => trait.id === id));

/** 評価値の言い方(先手から見た値。「+350」「-120」。詰みは「詰み」)。 */
function signedEval(cp) {
  if (isMateCp(cp)) return cp > 0 ? '先手勝ち' : '後手勝ち';
  const value = Math.round(cp / 10) * 10;
  return value > 0 ? `+${value}` : `${value}`;
}

/**
 * 中継の台本を、1手ずつ足して作る。
 * 項目のatは手数(1から。0は対局開始前)、whenは、その手を指す前の考慮中('think')か、指したとき('move')。
 * nextIdは、プレイヤーの次の相手(その棋士の対局なら、聞き手が「よく見ておこう」と言う。対策の手がかり)。
 * @param {{ spec: any, cast: ReturnType<typeof relayCast>, oshiId?: string | null, nextId?: string | null }} options
 */
export function createRelayScript({ spec, cast, oshiId = null, nextId = null }) {
  const rng = createRng(relaySeed(`${spec.key}:script`));
  const plan = relayPlan(spec);
  const players = { black: spec.black, white: spec.white };
  const call = (side) => callName(players[side], players[other(side)]);
  const voices = { black: thoughtVoice(spec.black), white: thoughtVoice(spec.white) };
  const lines = [];
  const comments = [];
  const thoughts = [];
  const cards = [];
  const said = new Set();
  const thoughtCount = { black: 0, white: 0 };
  let onlyCount = 0;
  const once = (key) => (said.has(key) ? false : (said.add(key), true));
  const fill = (text, values = {}) => text.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
  const density = DENSITY[spec.weight] ?? 1;
  /** 同じ書き手の種類で、最近の言い方をくり返さない(残りがなければ、くり返してよい)。 */
  const recent = new Map();
  const pickFresh = (pool) => {
    const used = recent.get(pool) ?? [];
    const fresh = VIEWER[pool].filter((text) => !used.includes(text));
    const text = pick(rng, fresh.length ? fresh : VIEWER[pool]);
    recent.set(pool, [...used, text].slice(-Math.max(1, Math.floor(VIEWER[pool].length / 2))));
    return text;
  };
  /**
   * 視聴者のコメントを足す。toneを渡さなければ、書き手の種類の色。
   * @param {number} at @param {string} when @param {string} pool
   * @param {Record<string, string | number>} [values] @param {number} [count] @param {string} [tone]
   * @param {{ size?: string, pos?: string }} [style]
   */
  const comment = (at, when, pool, values = {}, count = 1, tone = '', style = {}) => {
    const kind = POOL_KIND[pool] ?? pool;
    for (let index = 0; index < count; index += 1) {
      comments.push({ at, when, text: fill(pickFresh(pool), values), tone: tone || KIND_TONE[kind] || '', kind, size: style.size ?? '', pos: style.pos ?? '' });
    }
  };
  /**
   * 確率pで1件(重さで増える)。
   * @param {number} p @param {number} at @param {string} when @param {string} pool @param {Record<string, string | number>} [values]
   */
  const maybe = (p, at, when, pool, values = {}) => {
    if (rng.next() < Math.min(0.95, p * density)) comment(at, when, pool, values);
  };
  /** 初心者の質問と答え(1局に1回ずつ)。 */
  const newbie = (at, when, topic, values = {}, p = 0.6) => {
    if (said.has(`newbie:${topic}`) || rng.next() >= p) return;
    said.add(`newbie:${topic}`);
    const [question, answer] = NEWBIE[topic];
    comments.push({ at, when, text: fill(question, values), tone: 'green', kind: 'newbie', size: '', pos: '' });
    comments.push({ at, when, text: fill(answer, values), tone: 'green', kind: 'answer', size: '', pos: '' });
  };
  /** 運営のコメント(上に止まる帯)。 */
  const official = (at, when, text) => comments.push({ at, when, text, tone: 'official', kind: 'official', size: '', pos: 'top' });
  /** 盛り上がりの弾幕(大きな字)。 */
  const hype = (at, count, tone = '') => comment(at, 'move', 'hype', {}, count, tone, { size: 'big' });
  const shortName = (side) => call(side).replace(/さん$/, '');
  const news = [...(spec.news ?? [])];
  let newsShown = 0;
  let lastAi = 0;
  let clockGapSaid = false;
  const line = (at, when, role, text) => lines.push({ at, when, role, text });
  const think = (at, when, side, moment) => {
    if (thoughtCount[side] + thoughtCount[other(side)] >= THOUGHT_LIMIT) return;
    if (!once(`thought:${side}:${moment}`)) return;
    thoughtCount[side] += 1;
    thoughts.push({ at, when, side, text: `（${THOUGHTS[voices[side]][moment]}）` });
  };
  const cheerPool = (side) => {
    const player = players[side];
    if (player?.story === HANANE) return 'rival';
    if (player?.story === YOSHIHIKO) return 'father';
    if (oshiId && player?.id === oshiId) return 'oshi';
    return 'cheer';
  };
  const meals = (() => {
    const menu = spec.kind === 'finals' ? [...(STAGE_MEALS[spec.venue] ?? KAIKAN_MEALS)] : KAIKAN_MEALS;
    const choose = (side, kind) => menu[relaySeed(`${spec.key}:${kind}:${players[side]?.id ?? side}`) % menu.length];
    return { lunch: { black: choose('black', 'lunch'), white: choose('white', 'lunch') }, dinner: { black: choose('black', 'dinner'), white: choose('white', 'dinner') } };
  })();

  // ---- 対局開始前
  {
    const black = players.black;
    const white = players.white;
    line(0, 'move', 'host', `こんにちは、${RELAY_HOST}だよ。今日は${spec.label}、${black.name}${black.dan}と${white.name}${white.dan}の一局を見ていくよ。`);
    line(0, 'move', 'commentator', cast.voice === 'hanane'
      ? `解説の${cast.name}。……よろしく。`
      : `解説の${cast.name}${cast.dan}です。よろしくお願いします。`);
    if (spec.black?.story === HANANE || spec.white?.story === HANANE) {
      if (cast.voice === 'yoshihiko') {
        line(0, 'move', 'host', 'お父さんとして、羽音さんの将棋をどう見てる？');
        line(0, 'move', 'commentator', '親としてではなく、一人の棋士として見ますよ。……少し照れますけどね。');
      }
    } else if ((spec.black?.story === YOSHIHIKO || spec.white?.story === YOSHIHIKO) && cast.voice === 'hanane') {
      line(0, 'move', 'commentator', '父さんの将棋。……いつも通り、隙がないと思う。');
    }
    line(0, 'move', 'host', `先手の${call('black')}は${playerHighlight(black)}。後手の${call('white')}は${playerHighlight(white)}。`);
    const next = nextId ? (['black', 'white']).find((side) => players[side]?.id === nextId) : null;
    if (next) line(0, 'move', 'host', `${call(next)}は、あなたの次の相手。どんな将棋を指すか、よく見ておこう！`);
    const favorite = favoriteOpening(black);
    if (favorite) {
      line(0, 'move', 'commentator', speak(cast, `${call('black')}は${favorite}が得意です。${call('white')}がどう応じるか、注目ですね。`, `${call('black')}は${favorite}が得意。${call('white')}がどう応じるか、見どころ。`));
    }
    comment(0, 'move', 'start', {}, 3);
    if (spec.weight === 'title') comment(0, 'move', 'title', {}, 2, 'gold');
    // 解説への反応(羽音の解説・親子の解説は特別)。
    const hananePlaying = black?.story === HANANE || white?.story === HANANE;
    if (cast.voice === 'hanane') comment(0, 'move', 'castHanane', {}, 2);
    else if (cast.voice === 'yoshihiko' && hananePlaying) comment(0, 'move', 'castFather', {}, 2);
    else comment(0, 'move', 'castStart', { cast: cast.name.slice(0, 2) });
    if (next) comment(0, 'move', 'next');
    // 特殊能力の持ち主への期待。
    for (const side of /** @type {const} */ (['black', 'white'])) {
      const trait = (players[side]?.character?.traits ?? []).find(({ id }) => isGoldTrait(id));
      if (trait && rng.next() < 0.7) comment(0, 'move', 'trait', { name: shortName(side), trait: traitLabel(trait) }, 1, 'pink');
    }
    for (const side of ['black', 'white']) {
      const pool = cheerPool(side);
      comment(0, 'move', pool, { name: call(side).replace(/さん$/, '') }, pool === 'cheer' ? 1 : 2, pool === 'cheer' ? '' : 'pink');
      think(0, 'move', side, 'start');
    }
  }

  let previousUsi = '';
  let formationsSeen = { battle: '', black: '', white: '', castleBlack: '', castleWhite: '' };
  let bookRun = true;
  let lastBishopCapture = -9;
  let pendingRegret = null;
  /** 前の手の読み筋の1手目(視聴者の予想)と、予想を言った手数。 */
  let predicted = '';
  let predictedAt = 0;

  /**
   * 1手を足す。
   * @param {{
   *   index: number, entry: { move: string, eval: number, pv: string, best: string, loss: number, time: number, mark: string },
   *   previousEval: number, sfenBefore: string, sfenAfter: string,
   *   before: { remaining: { black: number, white: number }, byoyomi: { black: boolean, white: boolean }, clock?: number, day?: number },
   *   after: { remaining: { black: number, white: number }, byoyomi: { black: boolean, white: boolean }, clock: number, day: number, breaks: { kind: string, from: number, to: number, day: number }[] },
   *   formations?: { battle?: string, black?: { rook?: string, castle?: string }, white?: { rook?: string, castle?: string } } | null,
   *   last?: boolean, end?: { winner: 'black' | 'white', reason: string } | null,
   * }} move
   */
  function add({ index, entry, previousEval, sfenBefore, sfenAfter, before, after, formations = null, last = false, end = null }) {
    const at = index + 1;
    const side = index % 2 === 0 ? 'black' : 'white';
    const facts = moveFacts(sfenBefore, entry.move);
    const text = moveTextOf(sfenBefore, entry.move, previousUsi);
    const rateBefore = blackWinRate(previousEval);
    const rateAfter = blackWinRate(entry.eval);
    const moverRate = (rate) => (side === 'black' ? rate : 1 - rate);
    const swing = moverRate(rateAfter) - moverRate(rateBefore);
    const winner = spec.winner;

    // 考慮中(指す前): 予想・長考と秒読み。
    if (predicted && at >= 7 && rng.next() < Math.min(0.9, (at > plan.middleEnd ? 0.3 : 0.16) * density)) {
      const guess = moveTextOf(sfenBefore, predicted, previousUsi);
      if (!/[a-z*]/.test(guess)) {
        comment(at, 'think', 'predict', { move: guess });
        predictedAt = at;
      }
    }
    if (entry.time >= LONG_THINK_SECONDS) {
      if (once(`long:${side}`) || rng.next() < 0.5) line(at, 'think', 'commentator', speak(cast, `${call(side)}、ここで長考に入りました。`, `${call(side)}、ここで長考に入った。`));
      comment(at, 'think', 'longThink', {}, 2);
      maybe(0.45, at, 'think', 'neta');
      if (!before.byoyomi[side]) maybe(0.5, at, 'think', 'clock', { name: shortName(side), time: thinkTimeText(Math.max(0, before.remaining[side] - entry.time)) });
      think(at, 'think', side, 'think');
    }
    if (before.byoyomi[side]) {
      if (rng.next() < 0.25) comment(at, 'think', 'byoyomiOn');
      think(at, 'think', side, 'byoyomi');
    }

    // 予想の当たり外れ(外れても、指した手が悪くないときだけ「そっちか」)。
    if (predictedAt === at) {
      const played = moveTextOf(sfenBefore, entry.move, previousUsi);
      if (entry.move === predicted) comment(at, 'move', 'predictHit', { move: played }, rng.next() < 0.4 * density ? 2 : 1);
      else if ((entry.loss ?? 0) < 150 && rng.next() < 0.7) comment(at, 'move', 'predictMiss', { move: moveTextOf(sfenBefore, predicted, previousUsi) });
    }

    // 実況(駒を打つ・取る・長考のあとの手)。
    if (facts?.drop) {
      maybe(at > plan.openingEnd ? 0.35 : 0.2, at, 'move', 'drop', { move: text, piece: PIECE_NAMES[facts.kind] ?? '' });
      if (at >= 15) newbie(at, 'move', 'drop', {}, 0.5);
    } else if (facts?.captured && !MAJOR.has(facts.captured)) {
      maybe(0.18, at, 'move', 'play', { move: text });
    } else if (entry.time >= LONG_THINK_SECONDS || (facts?.check && at > plan.middleEnd)) {
      maybe(0.4, at, 'move', 'play', { move: text });
    }

    // 指した手。
    if (facts?.captured && MAJOR.has(facts.captured)) {
      if (facts.captured === 'B' && at - lastBishopCapture <= 2 && at < 50) {
        if (once('bishop-exchange')) {
          line(at, 'move', 'host', '角交換になったね！');
          line(at, 'move', 'commentator', speak(cast, '角を持ち合うと、打ち込みのすきに気をつける将棋になりますね。', '角を持ち合うと、打ち込みのすきに気をつける将棋になる。'));
        }
        comment(at, 'move', 'bishop', {}, 2);
        newbie(at, 'move', 'bishop');
      } else {
        comment(at, 'move', 'major', { piece: PIECE_NAMES[facts.captured] }, 2);
        if (rng.next() < 0.5) line(at, 'move', 'host', `${PIECE_NAMES[facts.captured]}を取った！`);
      }
      if (facts.captured === 'B') lastBishopCapture = at;
    } else if (facts?.captured && rng.next() < 0.3) {
      comment(at, 'move', 'capture');
    }
    if (facts?.check) {
      comment(at, 'move', 'check', {}, at > plan.middleEnd ? 2 : 1, 'red');
      if (once(`check:${side}`)) line(at, 'move', 'host', `王手！ ${call(side)}が攻めかかったよ。`);
      newbie(at, 'move', 'check', {}, 0.4);
    }
    if (facts?.promote && (facts.after === '+R' || facts.after === '+B') && once(`promote:${side}:${facts.after}`)) {
      comment(at, 'move', 'promote', { piece: PIECE_NAMES[facts.after] });
      newbie(at, 'move', 'promote', {}, 0.5);
      line(at, 'move', 'commentator', speak(cast, `${call(side)}、${PIECE_NAMES[facts.after]}を作りました。大きいですね。`, `${call(side)}、${PIECE_NAMES[facts.after]}を作った。これは大きい。`));
    }

    // 戦型と囲い(判定が初めて付いたとき)。
    if (formations) {
      const rook = (color) => formations[color]?.rook ?? '';
      const castle = (color) => formations[color]?.castle ?? '';
      if (!formationsSeen.battle && formations.battle) {
        formationsSeen.battle = formations.battle;
        line(at, 'move', 'commentator', speak(cast, `戦型は${formations.battle}になりました。`, `戦型は${formations.battle}。`));
        comment(at, 'move', 'formation', { name: formations.battle });
      }
      // 対抗形・相振り飛車(両方の飛車の形が分かったとき)。
      if (rook('black') && rook('white') && once('battle-kind')) {
        const furi = [isFuri(rook('black')), isFuri(rook('white'))].filter(Boolean).length;
        if (furi > 0) comment(at, 'move', 'battleKind', { kind: furi === 2 ? '相振り飛車' : '対抗形' });
      }
      // 得意戦法を指した(使用率のいちばん上と、戦型の判定が合ったとき)。
      for (const color of /** @type {const} */ (['black', 'white'])) {
        const favorite = favoriteOpening(players[color]);
        const shown = [formations.battle, rook(color)].filter(Boolean);
        if (favorite && shown.some((name) => name.includes(favorite) || favorite.includes(name)) && once(`specialty:${color}`) && rng.next() < 0.8) {
          comment(at, 'move', 'specialty', { name: shortName(color), opening: favorite });
        }
      }
      for (const color of /** @type {const} */ (['black', 'white'])) {
        if (!formationsSeen[color] && rook(color) && rook(color) !== formationsSeen.battle) {
          formationsSeen[color] = rook(color);
          if (once(`rook:${color}`) && at < 40) {
            line(at, 'move', 'host', `${SIDE_NAME[color]}は${rook(color)}だね！`);
            comment(at, 'move', 'formation', { name: rook(color) });
          }
        }
        const castleKey = color === 'black' ? 'castleBlack' : 'castleWhite';
        if (!formationsSeen[castleKey] && castle(color) && at >= 10) {
          formationsSeen[castleKey] = castle(color);
          line(at, 'move', 'host', `${SIDE_NAME[color]}の${call(color)}、${castle(color)}が完成！`);
          if (rng.next() < 0.6) line(at, 'move', 'commentator', speak(cast, 'しっかり囲いましたね。これで戦いの準備ができました。', 'しっかり囲った。これで戦いの準備ができた。'));
          comment(at, 'move', 'castle', { name: castle(color) });
          newbie(at, 'move', 'castle', { name: castle(color) }, 0.45);
          const otherCastle = formationsSeen[color === 'black' ? 'castleWhite' : 'castleBlack'];
          if (otherCastle && once('castles')) {
            const [a, b] = color === 'black' ? [castle(color), otherCastle] : [otherCastle, castle(color)];
            comment(at, 'move', 'castles', { a, b });
          }
        }
      }
    }

    // 定跡を離れた。
    if (entry.mark !== 'book' && bookRun && at >= 12) {
      bookRun = false;
      if (once('theory')) {
        line(at, 'move', 'commentator', speak(cast, 'ここで定跡を離れました。ここからが本当の勝負です。', 'ここで定跡を離れた。ここからが本当の勝負。'));
        comment(at, 'move', 'opening');
        maybe(0.5, at, 'move', 'theory');
        newbie(at, 'move', 'theory', {}, 0.5);
      }
    }

    // 手の意味(聞き手がたずねて、解説者が答える。ときどき)。
    if (at >= 6 && !entry.loss && rng.next() < (at < 40 ? 0.12 : 0.08)) {
      const meaning = moveMeaning(facts, { ply: at });
      if (meaning) {
        line(at, 'move', 'host', `今の${text}は、どういう手？`);
        line(at, 'move', 'commentator', speak(cast, `${meaning}です。`, `${meaning}だね。`));
      }
    }

    // 初心者が手の意味をたずね、ほかの視聴者が答える(1局に1回)。
    if (at >= 8 && at <= 60 && !entry.loss && !said.has('newbie:meaning') && rng.next() < 0.08) {
      const meaning = moveMeaning(facts, { ply: at });
      if (meaning) newbie(at, 'move', 'meaning', { move: text, meaning }, 1);
    }

    // AI勢: 15手ごとくらいに、評価値か勝率を言う。
    if (at - lastAi >= 15 && at >= 20 && rng.next() < 0.5) {
      lastAi = at;
      const lead = rateAfter >= 0.5 ? 'black' : 'white';
      const rate = Math.round((lead === 'black' ? rateAfter : 1 - rateAfter) * 100);
      if (rate <= 55) comment(at, 'move', 'aiEven');
      else comment(at, 'move', 'ai', { side: SIDE_NAME[lead], rate, eval: signedEval(entry.eval) });
    }

    // 時計勢: 持ち時間の差が1時間以上ひらいた(1局に1回)。早指し。
    if (!clockGapSaid && at >= 30 && Math.abs(after.remaining.black - after.remaining.white) >= 3600) {
      clockGapSaid = true;
      const rich = after.remaining.black > after.remaining.white ? 'black' : 'white';
      comment(at, 'move', 'clockGap', { name: shortName(rich) });
    }
    if (entry.time <= 15 && at > 30 && at <= plan.middleEnd && rng.next() < 0.05 * density) comment(at, 'move', 'fast', { name: shortName(side) });

    // 形勢が動いた(分かれ目の手)。AIの推奨手と勝率の動きを添える。指した人を責めない。
    if ((entry.mark === 'error' || entry.mark === 'decisive' || swing <= -SWING) && entry.best) {
      const bestText = moveTextOf(sfenBefore, entry.best, previousUsi);
      const heavy = entry.loss >= 500 || swing <= -0.25;
      const collapse = entry.mark === 'decisive' && has(players[side], 'endgame-collapse') && at > plan.middleEnd;
      if (collapse) {
        line(at, 'move', 'commentator', speak(cast, `……これは、${call(side)}の玉に危ない筋が残ったかもしれません。終盤の頓死の癖が出てしまったか。`, `……${call(side)}の玉に、危ない筋が残ったかも。頓死の癖が出たのかな。`));
        cards.push({ at, when: 'move', kind: 'trait', tier: 'red', title: `${players[side].name}『終盤での頓死』`, text: '自玉の危険を見落とした' });
      } else {
        line(at, 'move', 'commentator', heavy
          ? speak(cast, `今の${text}は、${call(side)}にとって痛い一手になりそうです。AIの推奨は${bestText}でした。`,
            `今の${text}は、${call(side)}にとって痛い一手になりそう。AIの推奨は${bestText}。`)
          : speak(cast, `今の${text}は、少し疑問手だったかもしれません。AIの推奨は${bestText}でした。`,
            `今の${text}は、少し疑問手だったかも。AIの推奨は${bestText}。`));
      }
      const [fromRate, toRate] = [Math.round(moverRate(rateBefore) * 100), Math.round(moverRate(rateAfter) * 100)];
      if (Math.abs(fromRate - toRate) >= 2) line(at, 'move', 'host', `勝率が、${SIDE_NAME[side]}${fromRate}%から${toRate}%に動いたよ。`);
      comment(at, 'move', 'swing', {}, heavy ? 3 : 2);
      if (rng.next() < 0.6) comment(at, 'move', 'aiBest', { best: bestText });
      if (heavy) hype(at, 1);
      lastAi = at;
      pendingRegret = { side, at: at + 1 };
      think(at, 'move', other(side), 'chance');
      // 勝者の特殊能力が、相手の悪手を引き出した場面。
      const opponent = other(side);
      if (opponent === winner) {
        if (at <= plan.openingEnd && has(players[opponent], 'research-demon') && once('trait:research-demon')) {
          line(at, 'move', 'commentator', speak(cast, `これが${call(opponent)}の『研究の鬼』。序盤で差をつけました。`, `これが${call(opponent)}の『研究の鬼』。序盤で差をつけた。`));
          cards.push({ at, when: 'move', kind: 'trait', tier: 'gold', title: `${players[opponent].name}『研究の鬼』`, text: '序盤の研究で差をつけた' });
        } else if (at > plan.openingEnd && at <= plan.middleEnd && has(players[opponent], 'grand-view') && once('trait:grand-view')) {
          line(at, 'move', 'commentator', speak(cast, `${call(opponent)}の『大局観』。中盤の形勢判断が正確です。`, `${call(opponent)}の『大局観』。中盤の形勢判断が正確。`));
          cards.push({ at, when: 'move', kind: 'trait', tier: 'gold', title: `${players[opponent].name}『大局観』`, text: '中盤の形勢判断で上回った' });
        } else if (entry.mark === 'decisive' && spec.how === 'comeback' && has(players[opponent], 'comeback') && once('trait:comeback')) {
          line(at, 'move', 'commentator', speak(cast, `${call(opponent)}の勝負手に、${call(side)}が間違えました。これが『逆転の名手』です。`, `${call(opponent)}の勝負手に、${call(side)}が間違えた。これが『逆転の名手』。`));
          cards.push({ at, when: 'move', kind: 'trait', tier: 'gold', title: `${players[opponent].name}『逆転の名手』`, text: '劣勢から勝負手で逆転' });
        }
      }
    } else if (pendingRegret && pendingRegret.at === at) {
      think(at, 'move', pendingRegret.side, 'regret');
      pendingRegret = null;
    }

    // 鋭い一手。
    if (entry.mark === 'only' && onlyCount < ONLY_LIMIT && at >= 20) {
      onlyCount += 1;
      line(at, 'move', 'commentator', speak(cast, `${text}、見事な一手です。ここはこれしかありませんでした。`, `${text}、見事な一手。ここはこれしかなかった。`));
      comment(at, 'move', 'only', {}, 2, 'gold');
      if (rng.next() < 0.5) comment(at, 'move', 'castAgree');
      hype(at, 1, 'gold');
      if (at > plan.middleEnd && has(players[side], 'demon-reading') && once('trait:demon-reading')) {
        line(at, 'move', 'host', `${call(side)}の『鬼の読み』だね！`);
        cards.push({ at, when: 'move', kind: 'trait', tier: 'gold', title: `${players[side].name}『鬼の読み』`, text: '深く正確な読み' });
      }
    }
    if (entry.mark === 'mate' && side === winner && has(players[side], 'tsume') && once('trait:tsume')) {
      line(at, 'move', 'commentator', speak(cast, `詰将棋が得意な${call(side)}、詰みを読み切っていますね。`, `詰将棋が得意な${call(side)}、詰みを読み切ってる。`));
      cards.push({ at, when: 'move', kind: 'trait', tier: 'blue', title: `${players[side].name}『詰将棋が得意』`, text: '詰みを読み切った' });
    }

    // 局面の節目。
    if (at === plan.openingEnd && once('middle')) {
      line(at, 'move', 'commentator', speak(cast, 'ここから中盤戦。両者、作戦の方向がはっきりしてきました。', 'ここから中盤戦。両者の作戦の方向が、はっきりしてきた。'));
    }
    if (at === plan.middleEnd && once('ending')) {
      const lead = rateAfter >= 0.5 ? 'black' : 'white';
      const leadRate = Math.round((lead === 'black' ? rateAfter : 1 - rateAfter) * 100);
      line(at, 'move', 'commentator', speak(cast, `いよいよ終盤戦。勝率は${SIDE_NAME[lead]}${leadRate}%です。`, `いよいよ終盤戦。勝率は${SIDE_NAME[lead]}${leadRate}%。`));
      comment(at, 'move', 'ending', {}, 2);
    }
    // 形勢が傾いたときの心の声(それぞれ1回)。
    if (at > plan.openingEnd) {
      const moverNow = moverRate(rateAfter);
      if (moverNow >= 0.7) think(at, 'move', side, 'ahead');
      if (moverNow <= 0.3) think(at, 'move', side, 'behind');
      if (moverNow >= 0.85 && at > plan.middleEnd && rng.next() < 0.4) comment(at, 'move', 'winning');
    }
    if (at > plan.middleEnd && rng.next() < 0.25) comment(at, 'move', 'ending');

    // 秒読みに入った。
    if (!before.byoyomi[side] && after.byoyomi[side]) {
      line(at, 'move', 'commentator', speak(cast, `${call(side)}、持ち時間を使い切りました。ここから1手60秒未満の秒読みです。`, `${call(side)}、持ち時間を使い切った。ここから1手60秒未満の秒読み。`));
      cards.push({ at, when: 'move', kind: 'byoyomi', tier: '', title: '秒読み', text: `${players[side].name}、1分将棋に` });
      comment(at, 'move', 'byoyomi', {}, 2);
      newbie(at, 'move', 'byoyomi', {}, 0.6);
      if (has(players[side], 'time-trouble') && once('trait:time-trouble')) {
        line(at, 'move', 'host', `${call(side)}は、終盤で時間に追われやすいんだよね……。`);
        cards.push({ at, when: 'move', kind: 'trait', tier: 'red', title: `${players[side].name}『時間に追われる』`, text: '早くも秒読みに' });
      }
    }
    // 長考のあとの一手。
    if (entry.time >= LONG_THINK_SECONDS) {
      line(at, 'move', 'host', `${thinkTimeText(entry.time)}の長考で、${text}！`);
    }

    // 休憩・封じ手。
    for (const rest of after.breaks ?? []) {
      if (rest.kind === 'lunch' || rest.kind === 'dinner') {
        const food = meals[rest.kind];
        const title = rest.kind === 'lunch' ? '昼食休憩' : '夕食休憩';
        cards.push({ at, when: 'move', kind: rest.kind, tier: '', title, text: `${clockText(rest.from)}〜${clockText(rest.to)}` });
        line(at, 'move', 'host', `${title}に入ったよ。${call('black')}は${food.black}、${call('white')}は${food.white}を注文したんだって。`);
        comment(at, 'move', rest.kind, { meal: pick(rng, [food.black, food.white]) }, 2);
        official(at, 'move', `【お知らせ】${title}は${clockText(rest.to)}まで`);
        if (rest.kind === 'lunch') newbie(at, 'move', 'lunch', {}, 0.5);
      } else if (rest.kind === 'seal') {
        const sealer = other(side);
        cards.push({ at, when: 'move', kind: 'seal', tier: '', title: '封じ手', text: `${players[sealer].name}が封じ手を記入。1日目が終わりました` });
        line(at, 'move', 'host', `1日目はここまで。${call(sealer)}が次の手を封じたよ。明日の朝、開封だね。`);
        comment(at, 'move', 'seal', {}, 2);
        official(at, 'move', '【お知らせ】1日目の対局は終了しました。続きは明日9時から');
        newbie(at, 'move', 'seal', {}, 0.8);
        said.add(`unseal:${at + 1}`);
      }
    }
    if (said.has(`unseal:${at}`)) {
      cards.push({ at, when: 'move', kind: 'unseal', tier: '', title: '2日目', text: `封じ手は${text}` });
      line(at, 'move', 'host', `2日目の朝。封じ手は${text}だったよ！`);
    }

    // 3時のおやつ(1日目の15時をまたいだ手)。
    if ((before.clock ?? 0) < 15 * 60 && (after.clock ?? 0) >= 15 * 60 && after.day === 1 && once('oyatsu')) {
      comment(at, 'move', 'oyatsu', {}, 2);
    }
    // 運営: 同じ回戦のほかの結果を、少しずつ知らせる。
    if (newsShown < news.length && at >= 18 + newsShown * 24) {
      official(at, 'move', `【他の対局】${news[newsShown]}`);
      newsShown += 1;
    }

    // ふだんのざわめき。
    if (rng.next() < 0.22 * density) comment(at, 'move', 'idle');
    if (rng.next() < 0.06) {
      const target = rng.next() < 0.5 ? 'black' : 'white';
      const pool = cheerPool(target);
      comment(at, 'move', pool, { name: call(target).replace(/さん$/, '') }, 1, pool === 'cheer' ? '' : 'pink');
    }

    // 終局。
    if (last && end) {
      const loser = other(end.winner);
      if (end.reason === 'resign') {
        think(at, 'move', loser, 'resign');
        line(at, 'move', 'host', `${players[loser].name}${players[loser].dan}が投了。${at}手まで、${players[end.winner].name}${players[end.winner].dan}の勝ち！`);
      } else {
        line(at, 'move', 'host', `詰みました！ ${at}手まで、${players[end.winner].name}${players[end.winner].dan}の勝ち！`);
      }
      think(at, 'move', end.winner, 'win');
      const how = HOW_LABELS[spec.how];
      if (how) line(at, 'move', 'commentator', speak(cast, `${call(end.winner)}が、${how}一局でした。`, `${call(end.winner)}が、${how}一局だった。`));
      line(at, 'move', 'commentator', cast.voice === 'yoshihiko' && players[end.winner]?.story === HANANE
        ? '……強くなったな。いや、失礼。良い将棋でした。'
        : speak(cast, '最後まで見ごたえのある将棋でした。', '最後まで見ごたえのある将棋だった。'));
      cards.push({ at, when: 'move', kind: 'end', tier: spec.weight === 'title' ? 'gold' : '', title: `${at}手まで ${SIDE_NAME[end.winner]}の勝ち`, text: end.reason === 'resign' ? `${players[loser].name}の投了` : '詰み' });
      comment(at, 'move', 'resign', {}, 5, spec.weight === 'title' ? 'gold' : '');
      hype(at, spec.weight === 'title' ? 3 : 2, spec.weight === 'title' ? 'gold' : '');
      official(at, 'move', `【終局】${at}手で${players[end.winner].name}${players[end.winner].dan}の勝ち`);
      comment(at, 'move', 'winner', { name: call(end.winner).replace(/さん$/, '') }, 2);
    }
    previousUsi = entry.move;
    predicted = String(entry.pv ?? '').split(' ')[0] ?? '';
  }

  return {
    add,
    lines, comments, thoughts, cards,
    meals,
  };
}

/**
 * 来場者数(見出しの飾り)。対局の重さと、人気の棋士で決まる。手が進むほど増える。
 * @param {any} spec
 * @param {number} ply
 */
export function relayAudience(spec, ply) {
  const base = spec.weight === 'title' ? 60000 : spec.weight === 'big' ? 9000 : 2500;
  const stars = [spec.black, spec.white].reduce((sum, player) => sum
    + (player?.story === YOSHIHIKO ? 1.5 : player?.story === HANANE ? 1.2 : Math.max(0, ((player?.rating ?? 1500) - 1500) / 800)), 1);
  const spread = 0.85 + (relaySeed(`${spec.key}:aud`) % 30) / 100;
  return Math.round((base * stars * spread * (1 + Math.min(ply, 150) / 120)) / 10) * 10;
}

/** 戦法の名前(記録の戦法のid)。 */
export function openingLabel(id) {
  return proOpening(id)?.label ?? '';
}
