// 中継の声(docs/tournament-relay-design.mdの5章)。解説者と聞き手(やこび姫)・視聴者のコメント・対局者の心の声を、棋譜から作る。
// どれも盤の事実(手の種類・評価値・時間・戦型の判定)と、棋士の能力・特殊能力から作り、言い切れないことは言わない。
// 対局者を責める言葉は使わない(U:4-3, 8)。種(対局の鍵)が同じなら、同じ中継になる。保存はしない。画面に依存しない。

import { createRng, pick } from './ryuo-random.mjs';
import { HANANE, YOSHIHIKO } from './ryuo-story.mjs';
import { opponentVoice } from './match-presence.mjs';
import {
  applyUsiToBoard, attackedSquares, findKing, isKingAttacked, opponentOf, parseSfenState, relativeRank, squareXY, xySquare,
} from './piece-movement.mjs';
import { pieceAt } from './sfen-piece.mjs';
import { detectTesuji, TESUJI_NAMES } from './move-tesuji.mjs';
import { formatHintMove } from './match-assists.mjs';
import { appendUsiMove, createGameRecord } from '../game-state';
import { attackStyleLabel, isGoldTrait, traitById, traitLabel } from './player-character.mjs';
import { proOpening, usageRows } from './opening-usage.mjs';
import { SURNAME_WEIGHTS } from './ryuo-names.mjs';
import { HOW_LABELS } from './ryuo-simulation.mjs';
import { STAGE_MEALS } from './title-day.mjs';
import { PIECE_POINTS } from './piece-points.mjs';
import { blackWinRate, clockText, isMateCp, relayPlan, relaySeed, thinkTimeText } from './relay-game.mjs';

/** 将棋会館の対局(1日制)の昼食・夕食の出前。 */
export const KAIKAN_MEALS = Object.freeze(['うな重', 'カツ丼', '天ぷらそば', 'カレーライス', 'オムライス', 'ざるそば', '親子丼', 'チャーハン', '鍋焼きうどん', 'ハンバーグ定食']);
/** 聞き手の名前。 */
export const RELAY_HOST = 'やこび姫';
/** 棋譜読み上げ(記録係の読み上げ。振り駒の結果と対局開始を告げる。25章)。 */
export const RELAY_READER = '棋譜読み上げ';
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
  start: ['きたー', '待ってた', 'わこつ', 'よろしくお願いします', 'どっち応援する？', '今日はこの対局', '期待', '深呼吸して、からの～？', 'ワクワク', '興奮してきた', 'これは楽しみ'],
  opening: ['定跡どおり', '研究会でやってたやつ', 'ここまでは早い', 'この戦型好き', 'まだ定跡', '前例沢山ある', '何か研究ありそうだが', '様子見だな'],
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
    'この駆け引きが堪らん', '駆け引きですねえ', 'どきどき', 'ざわわ…', '理想の局面ですわ',
    '駒音いいね', '勉強になる', '解説わかりやすい', 'やこび姫かわいい', '初見です', '今日は長いぞ', '盤がきれい', 'ほうほう', 'なるほど',
    'いい対局', 'この局面むずい', 'わからん', '先手持ちたい', '後手持ちたい', '形勢わからん', '渋い', '見入ってしまう', '今北', '何手目？',
  ],
  rival: ['羽音ちゃん！', 'はのんちゃんきた', '羽音ちゃんがんばれ', '天才少女'],
  father: ['善彦先生だ', '最強きた', '六冠の人', '善彦先生の将棋が見られる'],
  oshi: ['推しの{name}！', '{name}がんばれ', '{name}きたー'],
  cheer: ['{name}がんばれ', '{name}ファイト'],
  title: ['タイトル戦きた', '七番勝負！', '和服かっこいい', '大舞台だ', '頂上決戦', 'すげぇ絵面だ', 'どっちも好きだから困る'],
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
  neta: ['正座つらそう', 'お茶飲んだ', '扇子パタパタしてる', '記録係さんおつかれ', '外は雨らしい', '首をかしげてる', '記録さんベテランだな', '動かないｗ', '先生集中してるな'],
  oyatsu: ['おやつの時間', 'おやつ何？', '3時のおやつ', 'おやつタイム', 'ケーキかな'],
  // 解説への反応。
  castStart: ['{cast}先生の解説だ', '解説たすかる', '{cast}先生！', '解説の人好き'],
  castHanane: ['羽音ちゃん解説！', '羽音ちゃんの解説めずらしい', '辛口解説きた', 'お父さんの対局を解説'],
  castFather: ['親子解説！', 'パパ解説', '善彦先生の解説ぜいたく', '照れてる'],
  castAgree: ['解説の通りだ', 'さすが解説', '解説が見えてる'],
  // 応援(特殊能力の持ち主)と、次の相手の対局。
  trait: ['{name}の{trait}見たい', '{trait}くる？', '{trait}の{name}', '{trait}出せ'],
  next: ['次の相手の研究タイム', 'よく見ておこう', '対策メモ'],
  // 観戦の期の分身(13章)。
  avatar: ['分身きた！', '分身がんばれ', '本人より強い？', '{name}の分身だ', '分身の終盤見たい'],
  // 盛り上がり(大きな字)。
  hype: ['うおおおお', '!?!?', 'ｷﾀ━━', 'えええ', 'すげえ', 'まじか'],
  // ---- 25章で足した書き手(ユーザーにもらったコメントの例から)。
  // 振り駒の結果(先手が決まった)。
  furigoma: ['{name}さん先手だ', '先手{name}さんかーｗ', '{name}先手か', 'うひょー', 'おー', 'あ！'],
  // 初手の前の戦型予想(考慮中)。
  openingGuess: ['7六かな', '8四指したら驚くわｗ', '居飛車かな', '振り飛車ありそう', '相振り見たいな', 'エルモ急戦かな', 'ゴキゲン中飛車ありえるやん', '藤井システム来るか'],
  // 初手が7六歩・2六歩でなかった。
  firstSurprise: ['「おおおおおお」とどよめくのが聞こえる', 'なんだこれ！', 'そんで？', 'えっ、そこ？'],
  // 序盤に角道を止めた(先手の6六歩・後手の4四歩)。
  bishopClose: ['{move}キター！', 'きたあああああああ', "キターーー(*'▽')ーーー！！！", '角道止めただけで沸く', '止めるのか', '止めた！'],
  bishopCloseGuess: ['角道止めるだろうな', '止めるかどうか', '止める？'],
  // 振り飛車・相振り飛車。
  furi: ['王道をゆく{name}', '不利飛車', '振り飛車きた', '{name}好き'],
  aifuri: ['相振りきたあああ', '相振り研究してきてる'],
  notAifuri: ['相振りではない', '対抗形か'],
  // 穴熊に組みにいった。
  anagumaGo: ['まじで穴熊？', '{name}の穴熊は組めれば強いだろうが、相手は組ませないだろう。'],
  // 中盤で大きく差がついた(気の早い人)。
  bath: ['よし、勝ったな　風呂入ってくる', 'よし風呂行ってくるか', '勝ったな'],
  // 顔文字(ごくまれに)。
  emoji: ['わがります✋🤡🤚', '🌜🤡🌛ﾊﾟｶｯ', '🐻'],
  // 意外な手・形勢が大きく動いた手(笑い。指した人を責める言葉は使わない)。
  chaos: ['えｗｗｗｗｗｗ', 'どうなってんだこれｗｗｗｗｗ', 'おいｗ', 'どういうことなの・・・', 'シュールすぎるｗｗ', 'ファッ！？', 'え？', 'ん？',
    '無理っぽいｗｗｗｗ', 'wwwwwwwwww', 'ｪﾝ？', '？', '面白すぎるｗｗ', 'なんだそりゃｗ', 'あーｗｗｗ', 'ちょｗｗ', '通常の3倍ｗｗｗ'],
  // 駒の見せ場。
  knightHonki: ['桂の本気ｗ', '桂跳ねたー', 'つえええええええｗ'],
  bishopIji: ['角の意地ｗｗｗｗ', '角が働いた'],
  kakuto: ['角頭歩ｗｗ', '角頭の歩！'],
  ouhisha: ['王手飛車取りｗｗｗ', '王手飛車！', 'ひえええええええええ'],
  rookTwoStep: ['飛車の二段階右折', '二段階右折ｗｗｗｗ', '二段階右折ﾜﾛﾀ'],
  noPromote: ['成らないの！？', '不成ｗ', '成らない方が強い？'],
  tempo: ['タン！タン！', '早い早い'],
  // 終局のあと。
  endGag: ['名勝負や', 'これが勝者の表情だ！', '名局になっちゃう', 'えええええええええ'],
  loserVoice: ['（・・・あれ？俺負けたの・・・？）'],
  // 解説への反応(解説者の言い方に、視聴者がつっこむ)。{cast}は解説者の苗字。
  castHumble: ['お前が専門家じゃないなら誰が専門家なんだよｗ', 'あんた以上の専門家いないだろｗｗｗ', '専門家じゃないｗｗｗｗｗ', '振り飛車の専門家とかだろう'],
  castJudge: ['{cast}さんが言うならしょうがないｗ', 'まあ{cast}さんが言うなら…', 'まあお前が言うならｗ', 'まてｗｗｗｗｗ', 'よくねえよｗｗｗ'],
  castShikata: ['しょうがないのかｗ', 'しょうがないｗｗ', '{cast}さんが言うならしょうがないｗ'],
  castIji: ['なにがなんでもｗ', 'いじでも！', '意地でもｗ'],
  castDousuru: ['どうするんでしょうか←こっちが聞きたい', 'それを聞きたいｗ'],
  castIgai: ['意外しかないｗｗｗｗ', '大熱戦だった'],
  castGood: ['解説が{cast}さんで良かった'],
  // ---- 12-5で足した書き手。どれも盤・時間・棋士の記録から言える事実だけを言う。
  // 棋譜並べ勢: 定跡の手数と総手数。
  kifu: ['ここまで定跡どおり{at}手', '{at}手目まで前例ありそう', 'ここまでは研究範囲だね', '{at}手まで並べたことある形'],
  kifuNew: ['定跡は{at}手目まで', '{at}手目から新しい形', '{at}手目で前例を離れた'],
  toryo: ['美しい投了図', '投了図きれい', '{at}手の熱戦', 'あとで棋譜並べしよう', '総手数{at}手'],
  mateEnd: ['詰みまで指した', '最後まで指したね', '詰め上がり図きれい', '{at}手で詰み'],
  // 駒割り勢: 盤と持ち駒の駒の数(materialSwap)。
  material: ['駒割りは{text}', '数えると{text}', '{text}だね', 'いま{text}'],
  materialEven: ['駒割りは互角', '駒の損得はなし', '駒割りは五分'],
  // 玉の堅さ勢: 玉のまわりの金銀の数(kingGuard)。
  kingSolid: ['{side}玉、金銀{n}枚で堅い', '{side}の玉は守りが{n}枚', '{side}玉まだ堅い'],
  kingThin: ['{side}玉が薄い', '{side}玉、守りが{n}枚しかない', '{side}の玉こわい', '{side}玉むき出し'],
  anaguma: ['{side}は穴熊', '穴熊は遠い', '{side}穴熊、王手がかからない形'],
  // 素人の形勢判断(駒の数で見る)と、AI勢の返事(評価値)。
  layman: ['駒得してる{a}が良さそう', '{a}の方が駒多いし{a}持ち', '素人目には{a}よし'],
  laymanReply: ['→AIは{b}持ち、{rate}%', '→駒より玉の堅さと攻めの速さらしい', '→駒得だけじゃないんだよね、AIだと{b}'],
  // ご当地勢: 対局場(番勝負は対局場、ほかは将棋会館)。
  local: ['地元{city}から見てる', '{city}行ってみたい', '{city}の対局場きれい', '{city}の名物食べたい'],
  localKaikan: ['千駄ヶ谷から見てる', '将棋会館行ってみたい', '会館の近くで見てる', '鳩森神社にお参りしてから見てる'],
  // 控室: 検討陣の様子(AIの推奨・読み筋・鋭い一手)。
  room: ['控室では{move}が有力', '控室の検討は{move}', '控室も{move}を本線に見てる'],
  roomOnly: ['控室どよめいてる', '控室の検討陣も唸ってる', '控室が静かになった'],
  roomSwing: ['控室ざわざわ', '控室では{best}を検討してた', '控室の検討と違う手だ'],
  // 古参ファン(年齢と段位から)と、若手のファン。
  veteran: ['{name}、{dan}になったんだな', '{name}は昔から見てる', '{age}歳の{name}、円熟の将棋', 'ベテランの{name}、渋い'],
  rookie: ['{name}まだ{age}歳！', '若手の{name}', '{name}、{age}歳でこの落ち着き'],
  // 海外のファン(かんたんな英語)。
  overseas: ['hello from Paris', 'watching from Brazil', 'first time watching shogi', 'こんにちは from Taiwan'],
  overseasWow: ['nice move!', 'wow', 'brilliant', 'what a move'],
  overseasEnd: ['GG', 'gg wp', 'great game', 'otsukaresama!'],
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
  furigoma: 'hype', openingGuess: 'predict', firstSurprise: 'hype', bishopClose: 'hype', bishopCloseGuess: 'predict', furi: 'theory', aifuri: 'theory', notAifuri: 'theory',
  anagumaGo: 'theory', bath: 'hype', emoji: 'idle', chaos: 'hype', knightHonki: 'play', bishopIji: 'play', kakuto: 'play', ouhisha: 'play', rookTwoStep: 'play',
  noPromote: 'play', tempo: 'play', endGag: 'hype', loserVoice: 'hype',
  castHumble: 'cast', castJudge: 'cast', castShikata: 'cast', castIji: 'cast', castDousuru: 'cast', castIgai: 'cast', castGood: 'cast',
  neta: 'neta', oyatsu: 'neta', castStart: 'cast', castHanane: 'cast', castFather: 'cast', castAgree: 'cast', trait: 'cheer', next: 'cheer', avatar: 'cheer', hype: 'hype',
  kifu: 'kifu', kifuNew: 'kifu', toryo: 'kifu', mateEnd: 'kifu', material: 'material', materialEven: 'material',
  kingSolid: 'king', kingThin: 'king', anaguma: 'king', layman: 'layman', laymanReply: 'ai', local: 'local', localKaikan: 'local',
  room: 'room', roomOnly: 'room', roomSwing: 'room', veteran: 'veteran', rookie: 'veteran', overseas: 'overseas', overseasWow: 'overseas', overseasEnd: 'overseas',
});

/**
 * 下に止まる大きなコメント(ニコニコ動画の下コメ。5秒。25章)。見せ場の一言だけ。{cast}は解説者の名前と肩書。
 * 責める言葉は使わない。
 */
const UNDER = Object.freeze({
  god: ['神の一手！'],
  judge: ['結論：非常に良かった'],
  bishop: ['角「ちょっと本気だすわ」'],
  sasshi: ['あー（察し）', 'あー（？）'],
  nattoku: ['{cast}も納得の一手'],
  oushou: ['王将「え・・・」'],
  oi: ['おい', '！？'],
});

/** 書き手の種類の色(盤の升の強調とは別の、縁取りの文字)。 */
const KIND_TONE = Object.freeze({ ai: 'blue', newbie: 'green', answer: 'green', cheer: 'pink', material: 'orange', overseas: 'lavender' });

/** 対局の重さで、コメントの数を増やす(タイトル戦ほど多い)。 */
const DENSITY = Object.freeze({ plain: 1, big: 1.3, title: 1.7 });

/** 振り飛車の名前(対抗形・相振り飛車を見分ける)。 */
const FURIBISHA = /(四間|三間|中|向かい)飛車|ゴキゲン|石田|振り飛車/;
const isFuri = (name) => Boolean(name) && FURIBISHA.test(name) && !/右四間/.test(name);

// ---- 盤の数え方(12-5。駒割り勢・玉の堅さ勢・素人の形勢判断)

/** 駒の種類ごとの初めの枚数(先手・後手それぞれ)。 */
const START_COUNTS = Object.freeze({ R: 1, B: 1, G: 2, S: 2, N: 2, L: 2, P: 9 });
const SWAP_ORDER = Object.freeze(['R', 'B', 'G', 'S', 'N', 'L', 'P']);
const SWAP_NAMES = Object.freeze({ R: '飛車', B: '角', G: '金', S: '銀', N: '桂', L: '香', P: '歩' });

/**
 * 駒割り(盤と持ち駒で、先手が初めより何枚多いか。成駒は元の駒で数える)。後手はこの逆。
 * @param {string} sfen
 * @returns {Record<string, number>}
 */
export function materialSwap(sfen) {
  const counts = Object.fromEntries(SWAP_ORDER.map((kind) => [kind, 0]));
  for (const [, piece] of parseSfenState(sfen).board) {
    const kind = piece.kind.replace('+', '');
    if (piece.color === 'black' && kind in counts) counts[kind] += 1;
  }
  const hands = String(sfen ?? '').replace(/^sfen\s+/, '').trim().split(/\s+/)[2] ?? '-';
  for (const [, count, letter] of hands.matchAll(/(\d*)([PLNSGBR])/g)) counts[letter] += Number(count) || 1;
  return Object.fromEntries(SWAP_ORDER.map((kind) => [kind, counts[kind] - START_COUNTS[kind]]));
}

/** 駒の並び(「金銀」「歩2枚」)。 */
function piecesText(swap, sign) {
  return SWAP_ORDER.filter((kind) => swap[kind] * sign > 0)
    .map((kind) => `${SWAP_NAMES[kind]}${Math.abs(swap[kind]) > 1 ? `${Math.abs(swap[kind])}枚` : ''}`).join('と');
}

/**
 * 駒割りの言い方(「先手の銀得」「先手が角を渡して金銀」)。互角ならtextは空。leadは駒の値段(PIECE_POINTS)で得をしている側。
 * @param {string} sfen
 * @returns {{ text: string, lead: 'black' | 'white' | null, points: number }}
 */
export function materialText(sfen) {
  const swap = materialSwap(sfen);
  const points = SWAP_ORDER.reduce((sum, kind) => sum + swap[kind] * PIECE_POINTS[kind], 0);
  const gained = piecesText(swap, 1);
  const lost = piecesText(swap, -1);
  if (!gained && !lost) return { text: '', lead: null, points: 0 };
  const lead = points > 0 ? 'black' : points < 0 ? 'white' : null;
  if (!lost) return { text: `先手の${gained}得`, lead, points };
  if (!gained) return { text: `後手の${lost}得`, lead, points };
  // 交換: 得をしている側から言う(同じ値段なら先手から)。
  return lead === 'white'
    ? { text: `後手が${gained}を渡して${lost}`, lead, points }
    : { text: `先手が${lost}を渡して${gained}`, lead, points };
}

/**
 * 玉の守り(玉のまわり8マスの金・銀・成駒の数と、隅の穴熊)。
 * @param {string} sfen @param {'black' | 'white'} side
 * @returns {{ guards: number, anaguma: boolean } | null}
 */
export function kingGuard(sfen, side) {
  const { board } = parseSfenState(sfen);
  const king = findKing(board, side);
  if (!king) return null;
  let guards = 0;
  for (const [square, piece] of board) {
    if (piece.color !== side || square === king) continue;
    if (['G', 'S', '+P', '+L', '+N', '+S'].includes(piece.kind) && distance(square, king) <= 1) guards += 1;
  }
  const corners = side === 'black' ? ['9i', '1i'] : ['1a', '9a'];
  return { guards, anaguma: corners.includes(king) };
}

/** 手番の側の持ち駒の数(SFENの持ち駒の欄から)。 */
function handCount(sfen, side) {
  const hand = String(sfen).replace(/^sfen\s+/, '').trim().split(/\s+/)[2] ?? '-';
  if (hand === '-') return 0;
  let total = 0;
  for (const [, count, letter] of hand.matchAll(/(\d*)([a-zA-Z])/g)) {
    const own = side === 'black' ? letter === letter.toUpperCase() : letter === letter.toLowerCase();
    if (own) total += Number(count || 1);
  }
  return total;
}

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

/**
 * 解説者の口調(羽音は敬語を使わないので、plainを使う)。善彦は、言葉を選びながらぽつぽつ話す独特の口調(25章)。
 * yoshihikoを渡さなければ、善彦もpoliteを使う。
 */
function speak(cast, polite, plain, yoshihiko = polite) {
  if (cast.voice === 'hanane') return plain;
  return cast.voice === 'yoshihiko' ? yoshihiko : polite;
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
  /** 解説者の苗字(視聴者のつっこみに使う)と、名前と肩書(「○○も納得の一手」)。 */
  const castSurname = SURNAMES.find((surname) => cast.name.startsWith(surname) && cast.name.length > surname.length) ?? cast.name.slice(0, 2);
  const castTitle = `${cast.name}${cast.dan}`;
  /** 下に止まる大きなコメント(5秒。25章)。見せ場だけで、続けて出さない(6手あける)。 */
  let lastUnder = -99;
  const under = (at, key, p = 1) => {
    if (at - lastUnder < 6 || rng.next() >= p) return;
    lastUnder = at;
    comments.push({ at, when: 'move', text: fill(pick(rng, UNDER[key]), { cast: castTitle }), tone: 'gold', kind: 'under', size: 'big', pos: 'bottom' });
  };
  const shortName = (side) => call(side).replace(/さん$/, '');
  const news = [...(spec.news ?? [])];
  let newsShown = 0;
  let lastAi = 0;
  let clockGapSaid = false;
  const line = (at, when, role, text) => lines.push({ at, when, role, text });
  /** 解説への視聴者のつっこみ({cast}は解説者の苗字)。 */
  const react = (at, pool, count = 1) => comment(at, 'move', pool, { cast: castSurname }, count);
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
    // 善彦の解説は、謙遜から始まる(視聴者がつっこむ。25章)。親子の対局は、上の親子のやりとりにする。
    if (cast.voice === 'yoshihiko' && spec.black?.story !== HANANE && spec.white?.story !== HANANE) {
      line(0, 'move', 'host', spec.weight === 'title' ? 'タイトル戦の大舞台ですけれども。' : '注目の一戦ですけれども。');
      line(0, 'move', 'commentator', '…そうですね、まあ、あの、専門家じゃないんで。全然、分かんないという感じなんですけど。');
      line(0, 'move', 'host', 'はい、どうもありがとうございました。');
      react(0, 'castHumble', 2);
    }
    line(0, 'move', 'host', `先手の${call('black')}は${playerHighlight(black)}。後手の${call('white')}は${playerHighlight(white)}。`);
    const next = nextId ? (['black', 'white']).find((side) => players[side]?.id === nextId) : null;
    if (next) line(0, 'move', 'host', `${call(next)}は、あなたの次の相手。どんな将棋を指すか、よく見ておこう！`);
    // 観戦の期の分身(あなたの対局から出した能力で戦う棋士)。
    const avatarSide = (['black', 'white']).find((side) => players[side]?.kind === 'avatar');
    if (avatarSide) {
      line(0, 'move', 'host', `${SIDE_NAME[avatarSide]}は、あなたの分身！ あなたの対局から出した能力で戦うよ。`);
      comment(0, 'move', 'avatar', { name: players[avatarSide].name }, 2, 'pink');
    }
    const favorite = favoriteOpening(black);
    if (favorite) {
      line(0, 'move', 'commentator', speak(cast, `${call('black')}は${favorite}が得意です。${call('white')}がどう応じるか、注目ですね。`, `${call('black')}は${favorite}が得意。${call('white')}がどう応じるか、見どころ。`));
    }
    // 棋譜読み上げが、先手と対局の開始を告げる(番勝負の2局目からは振り駒をしない)。
    if ((spec.gameNo ?? 0) > 1) {
      line(0, 'move', 'reader', `先手は${black.name}${black.dan}です。それでは、対局を開始してください。`);
    } else {
      line(0, 'move', 'reader', `振り駒の結果、先手は${black.name}${black.dan}に決まりました。それでは、お願いいたします。`);
      comment(0, 'move', 'furigoma', { name: shortName('black') });
    }
    comment(0, 'move', 'start', {}, 3);
    if (cast.voice === 'polite' && rng.next() < 0.3) react(0, 'castGood');
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
    // 古参ファンと若手のファン(年齢と段位)・ご当地勢・海外のファン(12-5)。
    for (const side of /** @type {const} */ (['black', 'white'])) {
      const player = players[side];
      const age = Number(player?.age);
      if (!player || player.kind === 'avatar' || !player.age || !Number.isFinite(age) || rng.next() >= 0.5) continue;
      const values = { name: shortName(side), dan: player.dan || '棋士', age };
      if (age <= 22) comment(0, 'move', 'rookie', values);
      else if (age >= 35 || /[八九]段/.test(player.dan ?? '')) comment(0, 'move', 'veteran', values);
    }
    const city = String(spec.venue ?? '').split('・')[0];
    if (rng.next() < 0.6) comment(0, 'move', city ? 'local' : 'localKaikan', { city });
    maybe(0.35, 0, 'move', 'overseas');
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
  /** 駒割り勢と素人の形勢判断を最後に言った手数(言いすぎない)。 */
  let lastMaterial = 0;
  let lastLayman = 0;
  /** 25章: 王手を最後にかけた手数(続けて王手 → 「意地でも」)、飛車を最後に動かした手数(二段階右折)、前の手の考慮時間。 */
  const lastCheckAt = { black: -9, white: -9 };
  const lastRookAt = { black: -9, white: -9 };
  let previousTime = 999;
  let longThinks = 0;

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

    // 25章: 初手の前の戦型予想と、初手の驚き。
    if (at === 1) {
      comment(at, 'think', 'openingGuess', {}, rng.next() < 0.5 * density ? 2 : 1);
      if (!['7g7f', '2g2f'].includes(entry.move)) comment(at, 'move', 'firstSurprise', {}, 2, '', { size: 'big' });
    }
    // 25章: 序盤に角道を止める手(先手の6六歩・後手の4四歩)。角が初めの升にいるときだけ。
    const closesBishop = at <= 16 && facts?.kind === 'P' && !facts.drop
      && ((side === 'black' && entry.move === '6g6f' && pieceAt(sfenBefore, '8h') === 'B') || (side === 'white' && entry.move === '4c4d' && pieceAt(sfenBefore, '2b') === 'b'));
    if (closesBishop && once('bishop-close')) {
      maybe(0.4, at, 'think', 'bishopCloseGuess');
      comment(at, 'move', 'bishopClose', { move: text }, 2);
    }

    // 考慮中(指す前): 予想・長考と秒読み。
    if (predicted && at >= 7 && rng.next() < Math.min(0.9, (at > plan.middleEnd ? 0.3 : 0.16) * density)) {
      const guess = moveTextOf(sfenBefore, predicted, previousUsi);
      if (!/[a-z*]/.test(guess)) {
        comment(at, 'think', 'predict', { move: guess });
        predictedAt = at;
      }
    }
    if (entry.time >= LONG_THINK_SECONDS) {
      longThinks += 1;
      if (once(`long:${side}`) || rng.next() < 0.5) line(at, 'think', 'commentator', speak(cast, `${call(side)}、ここで長考に入りました。`, `${call(side)}、ここで長考に入った。`));
      // 2回目の長考で、聞き手が対局者の表情をたずねる(25章)。
      if (longThinks >= 2 && once('face')) {
        const dan = players[side]?.dan ?? '';
        line(at, 'think', 'host', `${shortName(side)}${dan}の対局中の表情とかは、どう？`);
        line(at, 'think', 'commentator', speak(cast, '落ち着いていますね。表情からは何も読めません。', '……変わらない。いつも通り。', '変わらない。いつも変わらないですね。'));
      }
      comment(at, 'think', 'longThink', {}, 2);
      maybe(0.45, at, 'think', 'neta');
      if (predicted) {
        const guess = moveTextOf(sfenBefore, predicted, previousUsi);
        if (!/[a-z*]/.test(guess)) maybe(0.5, at, 'think', 'room', { move: guess });
      }
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

    // 25章: 駒の見せ場(桂・角の取り、角頭の歩、王手飛車、飛車の二段階右折、成らない手、早指しの応酬)。
    if (facts) {
      const afterBoard = parseSfenState(sfenAfter).board;
      if (facts.kind === 'N' && (facts.captured || facts.tesuji.includes('knight-fork'))) maybe(0.45, at, 'move', 'knightHonki');
      if ((facts.kind === 'B' || facts.kind === '+B') && facts.captured && facts.captured !== 'B' && facts.captured !== 'P') maybe(0.4, at, 'move', 'bishopIji');
      if (facts.after === '+B' && facts.promote && once(`under-bishop:${side}`)) under(at, 'bishop', 0.6);
      if (facts.kind === 'P') {
        const { x, y } = squareXY(facts.to);
        const behind = xySquare(x, side === 'black' ? y - 1 : y + 1);
        const bishop = behind ? pieceAt(sfenAfter, behind) : '';
        if (bishop && (side === 'black' ? bishop === 'b' : bishop === 'B') && once(`kakuto:${side}`)) maybe(0.7, at, 'move', 'kakuto');
      }
      if (facts.check && attackedSquares(afterBoard, facts.to).some((square) => {
        const target = afterBoard.get(square);
        return target && target.color !== side && (target.kind === 'R' || target.kind === '+R');
      }) && once(`ouhisha:${side}`)) {
        comment(at, 'move', 'ouhisha', {}, 2);
        under(at, 'oi', 0.5);
      }
      const rookMove = (facts.kind === 'R' || facts.kind === '+R') && !facts.drop && !facts.captured;
      if (rookMove && lastRookAt[side] === at - 2 && once(`two-step:${side}`)) maybe(0.7, at, 'move', 'rookTwoStep');
      if (rookMove) lastRookAt[side] = at;
      const zone = (square) => relativeRank(square, side) <= 3;
      if (['B', 'R', 'P'].includes(facts.kind) && !facts.drop && !facts.promote && (zone(facts.to) || (facts.from && zone(facts.from)))
        && once(`no-promote:${side}`)) maybe(0.6, at, 'move', 'noPromote');
      if (entry.time <= 10 && previousTime <= 10 && at > 40) maybe(0.1, at, 'move', 'tempo');
    }

    // 実況(駒を打つ・取る・長考のあとの手)。
    if (facts?.drop) {
      maybe(at > plan.openingEnd ? 0.35 : 0.2, at, 'move', 'drop', { move: text, piece: PIECE_NAMES[facts.kind] ?? '' });
      if (at >= 15) newbie(at, 'move', 'drop', {}, 0.5);
      // 持ち駒が少ないときの歩打ち(攻め手が少ない。25章)。
      if (facts.kind === 'P' && at > plan.openingEnd && handCount(sfenAfter, side) <= 1 && once('shikata')) {
        line(at, 'move', 'host', 'これは……一体……？');
        line(at, 'move', 'commentator', speak(cast, '持ち駒が少ないので、歩で手をつなぐ場面ですね。', '持ち駒が少ないから、歩でつなぐしかない。', 'まぁ、しょうがないんですね。攻め手がちょっと少ないので。'));
        if (cast.voice === 'yoshihiko') {
          line(at, 'move', 'commentator', 'やっぱりちょっと、手駒を増やさないことには、仕方がないという…');
          react(at, 'castShikata', 2);
        }
      }
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
        if (at > plan.middleEnd && once('uwaa')) {
          // 終盤の大駒の取り(うわぁ！ 25章)。
          line(at, 'move', 'host', 'うわぁ！');
          line(at, 'move', 'commentator', speak(cast, 'これは大きいですね。どう受けるでしょうか。', 'これは大きい。どう受けるか。', 'うわぁ～流石に……'));
          if (cast.voice === 'yoshihiko') {
            line(at, 'move', 'commentator', 'う～ん、どうするんでしょうか……');
            react(at, 'castDousuru');
          }
        } else if (rng.next() < 0.5) line(at, 'move', 'host', `${PIECE_NAMES[facts.captured]}を取った！`);
      }
      if (facts.captured === 'B') lastBishopCapture = at;
    } else if (facts?.captured && rng.next() < 0.3) {
      comment(at, 'move', 'capture');
    }
    if (facts?.check) {
      // 続けて王手(なにがなんでも。25章)。
      if (lastCheckAt[side] === at - 2 && once('iji')) {
        line(at, 'move', 'host', 'あ、なにがなんでも……');
        line(at, 'move', 'commentator', speak(cast, '攻めを続けますね。手を緩めません。', '意地でも攻める気だ。', 'え～～～～～～、意地でも。'));
        react(at, 'castIji', cast.voice === 'yoshihiko' ? 2 : 1);
      }
      lastCheckAt[side] = at;
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
        if (furi === 2) comment(at, 'move', 'aifuri', {}, 2);
        else if (furi === 1) maybe(0.5, at, 'move', 'notAifuri');
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
            if (isFuri(rook(color))) maybe(0.6, at, 'move', 'furi', { name: rook(color) });
          }
        }
        const castleKey = color === 'black' ? 'castleBlack' : 'castleWhite';
        if (!formationsSeen[castleKey] && castle(color) && at >= 10) {
          formationsSeen[castleKey] = castle(color);
          line(at, 'move', 'host', `${SIDE_NAME[color]}の${call(color)}、${castle(color)}が完成！`);
          if (rng.next() < 0.6) line(at, 'move', 'commentator', speak(cast, 'しっかり囲いましたね。これで戦いの準備ができました。', 'しっかり囲った。これで戦いの準備ができた。'));
          comment(at, 'move', 'castle', { name: castle(color) });
          const guard = kingGuard(sfenAfter, color);
          if (/穴熊/.test(castle(color)) && once(`anaguma-go:${color}`)) maybe(0.6, at, 'move', 'anagumaGo', { name: shortName(color) });
          if (guard?.anaguma) maybe(0.6, at, 'move', 'anaguma', { side: SIDE_NAME[color] });
          else if (guard && guard.guards >= 3) maybe(0.35, at, 'move', 'kingSolid', { side: SIDE_NAME[color], n: guard.guards });
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
        maybe(0.4, at, 'move', 'kifuNew', { at });
        newbie(at, 'move', 'theory', {}, 0.5);
      }
    }

    if (entry.mark === 'book' && bookRun && (at === 10 || at === 20)) maybe(0.45, at, 'move', 'kifu', { at });

    // 駒割り勢(駒を取った手のあと、12手あけて)と、素人の形勢判断(駒の数と評価値が食い違うとき。AI勢が答える)。
    if (facts?.captured && at >= 16 && at - lastMaterial >= 12 && rng.next() < Math.min(0.9, 0.4 * density)) {
      lastMaterial = at;
      const { text: swapText } = materialText(sfenAfter);
      comment(at, 'move', swapText ? 'material' : 'materialEven', { text: swapText });
    }
    if (at >= 30 && at - lastLayman >= 30 && (facts?.captured || at % 10 === 0) && !isMateCp(entry.eval)) {
      const { lead } = materialText(sfenAfter);
      const leadRate = lead === 'black' ? rateAfter : lead === 'white' ? 1 - rateAfter : 1;
      if (lead && leadRate <= 0.35 && rng.next() < 0.6) {
        lastLayman = at;
        comment(at, 'move', 'layman', { a: SIDE_NAME[lead] });
        comment(at, 'move', 'laymanReply', { b: SIDE_NAME[other(lead)], rate: Math.round((1 - leadRate) * 100) });
      }
    }
    // 玉の堅さ勢: 終盤の王手で、王手をかけられた玉の守りが1枚以下(それぞれ1回)。
    if (facts?.check && at > plan.middleEnd) {
      const checked = other(side);
      const guard = kingGuard(sfenAfter, checked);
      if (guard && guard.guards <= 1 && once(`king-thin:${checked}`)) comment(at, 'move', 'kingThin', { side: SIDE_NAME[checked], n: guard.guards });
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
      // 意外な手(形勢が大きく動いた)への、善彦の第一声と聞き手(25章)。
      if (heavy && cast.voice === 'yoshihiko' && once('odd')) {
        line(at, 'move', 'commentator', 'あぁ～～～～……？');
        line(at, 'move', 'host', 'これは……？');
        line(at, 'move', 'commentator', 'なんか実践的な手ですよね。');
      } else if (heavy && once('odd')) {
        line(at, 'move', 'host', 'これは……？');
      }
      if (heavy) {
        comment(at, 'move', 'chaos', {}, 2);
        under(at, rng.next() < 0.5 ? 'sasshi' : 'oi', 0.5);
      }
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
      maybe(0.35, at, 'move', 'roomSwing', { best: bestText });
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
      under(at, onlyCount === 1 ? 'god' : 'nattoku', 0.7);
      if (rng.next() < 0.5) comment(at, 'move', 'castAgree');
      maybe(0.45, at, 'move', 'roomOnly');
      maybe(0.3, at, 'move', 'overseasWow');
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

    // 25章: 仕掛け(序盤の終わりから中盤の、最初の駒の取り)。善彦は、ぽつぽつと評価する。
    if (facts?.captured && at >= plan.openingEnd - 6 && at <= plan.middleEnd && once('shikake')) {
      if (cast.voice === 'yoshihiko') {
        line(at, 'move', 'host', 'ちょっと無理っぽいような…');
        line(at, 'move', 'commentator', '凄いところから仕掛けたなっていう印象は、あるんですけど。');
        line(at, 'move', 'commentator', 'ただ、まあもう行かざるを得ないという部分も、あったんでは無いかな…');
        line(at, 'move', 'commentator', '決断としては非常に良かったような、えぇ、ええ。感じがありますね、えぇ。');
        react(at, 'castJudge', 2);
        under(at, 'judge', 0.6);
      } else {
        line(at, 'move', 'host', 'ここで仕掛けたね！');
        line(at, 'move', 'commentator', speak(cast, 'いよいよ仕掛けました。ここから本格的な戦いですね。', '仕掛けた。……悪くない判断。'));
      }
    }
    // 中盤の互角(1局に1回)。
    if (at > plan.openingEnd + 4 && at < plan.middleEnd && Math.abs(rateAfter - 0.5) < 0.05 && once('balanced') && rng.next() < 0.7) {
      line(at, 'move', 'commentator', speak(cast, '形勢は互角。どちらも譲りませんね。', '互角。……どっちも引かない。',
        'まあ非常に、えー拮抗しているというか。まあ、あと、大きなところでの対局が多いという印象が、ありますね。はい。'));
    }
    // 中盤で大きく差がついた(気の早い視聴者)。
    if (at > plan.openingEnd && at <= plan.middleEnd && moverRate(rateAfter) >= 0.8 && once('bath')) maybe(0.7, at, 'move', 'bath');
    // 終盤に、形勢が大きく傾いた(1局に1回)。
    if (at > plan.middleEnd && swing <= -0.25 && once('taihen')) {
      line(at, 'move', 'host', 'あぁ～……');
      line(at, 'move', 'commentator', speak(cast, '……これは大変な局面になりました。', '……大変。', 'うーん……いやぁ、大変です。'));
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
    if (rng.next() < 0.015) comment(at, 'move', 'emoji');
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
      // 聞き手が一局をふり返ってたずね、解説者が答え、聞き手がお礼を言う(25章)。
      line(at, 'move', 'host', 'この一局、ふり返ってどうだった？');
      line(at, 'move', 'commentator', cast.voice === 'yoshihiko' && players[end.winner]?.story === HANANE
        ? '……強くなったな。いや、失礼。良い将棋でした。'
        : speak(cast, '最後まで見ごたえのある将棋でした。', '最後まで見ごたえのある将棋だった。',
          '出だしから意外な将棋でしたけど、まあ、あのー、大熱戦だったと、思います。はい。'));
      line(at, 'move', 'host', 'ありがとうございました！');
      if (cast.voice === 'yoshihiko' && players[end.winner]?.story !== HANANE) react(at, 'castIgai');
      cards.push({ at, when: 'move', kind: 'end', tier: spec.weight === 'title' ? 'gold' : '', title: `${at}手まで ${SIDE_NAME[end.winner]}の勝ち`, text: end.reason === 'resign' ? `${players[loser].name}の投了` : '詰み' });
      comment(at, 'move', 'resign', {}, 5, spec.weight === 'title' ? 'gold' : '');
      hype(at, spec.weight === 'title' ? 3 : 2, spec.weight === 'title' ? 'gold' : '');
      official(at, 'move', `【終局】${at}手で${players[end.winner].name}${players[end.winner].dan}の勝ち`);
      comment(at, 'move', 'winner', { name: call(end.winner).replace(/さん$/, '') }, 2);
      comment(at, 'move', end.reason === 'resign' ? 'toryo' : 'mateEnd', { at });
      comment(at, 'move', 'endGag');
      if (end.reason === 'resign') maybe(0.4, at, 'move', 'loserVoice');
      if (end.reason === 'mate') under(at, 'oushou', 0.5);
      maybe(0.6, at, 'move', 'overseasEnd');
    }
    previousUsi = entry.move;
    previousTime = entry.time;
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
