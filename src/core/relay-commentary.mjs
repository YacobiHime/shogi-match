// 中継の声(docs/tournament-relay-design.mdの5章)。解説者と聞き手(やこび姫)・視聴者のコメント・対局者の心の声を、棋譜から作る。
// どれも盤の事実(手の種類・評価値・時間・戦型の判定)と、棋士の能力・特殊能力から作り、言い切れないことは言わない。
// 対局者を責める言葉は使わない(U:4-3, 8)。種(対局の鍵)が同じなら、同じ中継になる。保存はしない。画面に依存しない。

import { createRng, pick } from './ryuo-random.mjs';
import { HANANE, YOSHIHIKO } from './ryuo-story.mjs';
import { resignStyleOf } from './resign-style.mjs';
import { opponentVoice } from './match-presence.mjs';
import {
  applyUsiToBoard, attackedSquares, attackersOf, findKing, isKingAttacked, opponentOf, parseSfenState, parseUsiMove, relativeRank, squareXY, xySquare,
} from './piece-movement.mjs';
import { pieceAt } from './sfen-piece.mjs';
import { detectTesuji, TESUJI_NAMES } from './move-tesuji.mjs';
import { formatHintMove } from './match-assists.mjs';
import { appendUsiMove, createGameRecord } from '../game-state';
import { mateStreak } from './mate-finish.mjs';
import { attackStyleLabel, isGoldTrait, traitById, traitLabel } from './player-character.mjs';
import { proOpening, usageRows } from './opening-usage.mjs';
import { SURNAME_WEIGHTS } from './ryuo-names.mjs';
import { HOW_LABELS } from './ryuo-simulation.mjs';
import { STAGE_MEALS } from './title-day.mjs';
import { PIECE_POINTS } from './piece-points.mjs';
import { MATE_CP, blackWinRate, clockText, isMateCp, relayPlan, relaySeed, relayTimeControl, thinkTimeText } from './relay-game.mjs';

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
/** 分身か、プレイヤー本人(自分の対局の中継)か。きつい笑いのコメントを出さない(責めない。G:7)。 */
const isYou = (player) => player?.kind === 'avatar' || player?.kind === 'user';
/** その局面で、手番の側が王手されているか。 */
function givesCheck(sfen) {
  try {
    return Boolean(createGameRecord(sfen).position.checked);
  } catch {
    return false;
  }
}

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
  // 棋譜読み上げは、解説者でも対局者でもない若手(強さの低いほうから種で1人)。名簿がなければ名前なし。
  const juniors = free.filter((member) => member !== chosen && !member.story).sort((a, b) => (a.rating ?? 0) - (b.rating ?? 0));
  const readerMember = juniors[relaySeed(`${spec.key}:reader`) % Math.max(1, Math.min(4, juniors.length))] ?? null;
  const reader = readerMember ? surnameOf(readerMember.name ?? '') : '';
  if (!chosen) return { id: '', name: '解説者', dan: '', title: '', story: null, voice: 'polite', reader };
  return {
    id: chosen.id, name: chosen.name, dan: chosen.dan ?? '', title: titleOf(chosen), story: chosen.story ?? null,
    voice: chosen.story === HANANE ? 'hanane' : chosen.story === YOSHIHIKO ? 'yoshihiko' : 'polite',
    reader,
  };
}

/** 苗字(名簿の苗字の表から。分からなければ名前の頭2字)。 */
function surnameOf(name) {
  return SURNAMES.find((candidate) => name.startsWith(candidate) && name.length > candidate.length) ?? name.slice(0, 2);
}

/** いま持っているタイトル(名人を先に)。なければ段位。棋士の写しは、期の棋士のprofile.heldか、中継の写しのheldを持つ。 */
export function titleOf(player) {
  const held = player?.held ?? player?.profile?.held ?? [];
  return (held.includes('名人') ? '名人' : held[0]) ?? player?.dan ?? '';
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
// 責める言葉(「ひどい」「大悪手」「ミス」)は使わない。例外は、分身ではない棋士への少しきつい笑い(27章の「酷いｗ」)と、
// 同情の一言(30章の「1分だからそりゃミスも出るか」「珍しく○○先生が寄せでミスったな…」)だけ。

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
  only: ['すごい', 'うますぎる', 'これは見えない', '!!', '神の一手？', 'さすが', 'これほんとどうやってんだ？ｗ'],
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
  predictHit: ['予想的中', '当たった！', '読み通り', 'やっぱり{move}', '的中ｷﾀ', 'これは読めたｗｗｗ'],
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
  neta: ['正座つらそう', 'お茶飲んだ', '扇子パタパタしてる', '記録係さんおつかれ', '外は雨らしい', '首をかしげてる', '記録さん{title}戦のベテランだな。', '動かないｗ', '先生集中してるな'],
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
  furigoma: ['{name}さん先手だ', '先手{name}さんかーｗ', '{name}先手か', 'うひょー', 'おー', 'あ！', 'うわあぁぁあぁぁぁぁ'],
  // 27章: 振り駒の前と、強い棋士(人気の棋士)が先手・後手になったときの反応。{name}は視聴者の呼び方(苗字)。
  furigomaWho: ['先手どっちｗｗｗｗｗ'],
  furigomaWin: ['{name}先手勝ったわ', '勝ったな'],
  furigomaLose: ['{name}後手はアカン～～～'],
  chi: ['{name}「ちっ」'],
  // 格上の棋士が、格下の相手に(番勝負は肩書、ほかは段位)。
  kimino: ['{name}{title}「君の一番強いところみせてよ」'],
  // 初手の前の戦型予想(考慮中)。
  openingGuess: ['7六かな', '8四指したら驚くわｗ', '居飛車かな', '振り飛車ありそう', '相振り見たいな'],
  // 27章: 対局者の得意戦法から予想する({opening}は使用率のいちばん上の戦法)。
  openingGuessFav: ['{opening}来るか', '{opening}かな', '{opening}ありえるやん', '{name}なら{opening}でしょ'],
  senichite: ['千日手からの一手損あるで'],
  // 初手7六歩に、どよめく人と、つっこむ人(2つで1組)。
  doyomeki: ['「おおおおおお」とどよめくのが聞こえる'],
  ooSugi: ['※おおすぎｗ　{move}'],
  // 初手が7六歩・2六歩でなかった。
  firstSurprise: ['「おおおおおお」とどよめくのが聞こえる', 'なんだこれ！', 'そんで？', 'えっ、そこ？'],
  // 序盤に角道を止めた(先手の6六歩・後手の4四歩)。
  bishopClose: ['{move}キター！', 'きたあああああああ', "キターーー(*'▽')ーーー！！！", '角道止めただけで沸く', '止めるのか', '止めた！'],
  bishopCloseGuess: ['角道止めるだろうな', '止めるかどうか', '止める？'],
  // 振り飛車党(得意戦法が振り飛車)が角道を止めた。
  bishopCloseFuri: ['角道止めただけで沸く唯一の棋士'],
  // 27章: 序盤の角交換(取った升の読み「8八かくなり～」)と、気合。
  kakunari: ['{sq}かくなり～'],
  kiai: ['気合が入ってるんや'],
  // 序盤の端歩。
  hashi: ['端歩？？？'],
  // 戦法を判定したとき。予想どおり(得意戦法)なら当然と受け止め、劣勢側なら心配する。{short}は「システム」「四間」など短い呼び方。
  formationSure: ['まぁ{short}ですよね', 'よし{side}{name}だな', '{name}来たな、風呂入ってくる'],
  formationHard: ['{side}{short}は厳しいなｗ'],
  treasure: ['伝家の宝刀', '見せ場を分かっている'],
  // 珍しい囲いと、囲いの発展形。
  rareCastle: ['まさかの{castle}'],
  evolve: ['ここから{next}でもいいぞ'],
  // 序盤の定跡の手(歩は現代的、角はよく指す手)と、序盤のリード。
  modern: ['{move}は現代的'],
  often: ['{move}はよく指す手ですよ'],
  joban: ['序盤は{name}'],
  // 早く終盤になった。
  mouEnd: ['もう終盤？'],
  // 考慮中、読み筋の1手目が香車を上がる手。
  kyosha: ['香車上がるか？'],
  // 振り飛車・相振り飛車。
  furi: ['王道をゆく{name}', '不利飛車', '振り飛車きた', '{name}好き'],
  aifuri: ['相振りきたあああ', '相振り研究してきてる'],
  notAifuri: ['相振りではない', '対抗形か'],
  // 穴熊に組みにいった。
  anagumaGo: ['まじで穴熊？', '{name}の穴熊は組めれば強いだろうが、{opp}は組ませないだろう。'],
  // 中盤で大きく差がついた(気の早い人)。
  bath: ['よし、勝ったな　風呂入ってくる', 'よし風呂行ってくるか', '勝ったな'],
  // 顔文字(ごくまれに)。
  emoji: ['わがります✋🤡🤚', '🌜🤡🌛ﾊﾟｶｯ', '🐻'],
  // 意外な手・形勢が大きく動いた手(笑い。指した人を責める言葉は使わない)。
  chaos: ['えｗｗｗｗｗｗ', 'どうなってんだこれｗｗｗｗｗ', 'おいｗ', 'どういうことなの・・・', 'シュールすぎるｗｗ', 'ファッ！？', 'え？', 'ん？',
    '無理っぽいｗｗｗｗ', 'wwwwwwwwww', 'ｪﾝ？', '？', '面白すぎるｗｗ', 'なんだそりゃｗ', 'あーｗｗｗ', 'ちょｗｗ', '通常の3倍ｗｗｗ',
    '手ｗｗｗｗｗｗｗｗｗｗｗｗｗ', '無理すぎるｗｗｗ', '久々に腹筋崩壊したｗｗｗｗｗｗｗｗｗ', 'あｗ', 'あーーーーーーー', '涙出てきたわｗ', '大変すぎるｗｗｗ'],
  // 少しきつい笑い。指したのが分身(プレイヤー自身の能力で戦う棋士)のときは出さない。
  chaosHarsh: ['明らかにおかしいだろｗｗ', '酷いｗ'],
  // 27章: 盤の上の事実から言える見せ場。
  uchu: ['宇宙将棋ｗ'],
  utitai: ['{best}ちてえええ'],
  naruImi: ['取らなきゃ成った意味が無いｗｗｗｗｗ'],
  bishopWonder: ['（角ってどう動くんだっけ？）'],
  kakuAwase: ['角合わせればOK'],
  retreat: ['{move}？'],
  mushi: ['無視ｗ'],
  hishaKawaii: ['王より飛車を可愛がり。。。', '飛車可愛がりすぎだろ'],
  // 駒の見せ場。
  knightHonki: ['桂の本気ｗ', '桂跳ねたー', 'つえええええええｗ'],
  bishopIji: ['角の意地ｗｗｗｗ', '角が働いた'],
  kakuto: ['角頭歩ｗｗ', '角頭の歩！'],
  ouhisha: ['王手飛車取りｗｗｗ', '王手飛車！', 'ひえええええええええ'],
  rookTwoStep: ['飛車の二段階右折', '二段階右折ｗｗｗｗ', '二段階右折ﾜﾛﾀ'],
  noPromote: ['成らないの！？', '不成ｗ', '成らない方が強い？', '成らない方が強いだろｗｗｗ'],
  tempo: ['タン！タン！', '早い早い'],
  // 終局のあと。
  endGag: ['名勝負や', 'これが勝者の表情だ！', '名局になっちゃう', 'えええええええええ'],
  loserVoice: ['（・・・あれ？俺負けたの・・・？）'],
  // 解説への反応(解説者の言い方に、視聴者がつっこむ)。{cast}は解説者の苗字。
  castHumble: ['お前が専門家じゃないなら誰が専門家なんだよｗ', 'あんた以上の専門家いないだろｗｗｗ', '専門家じゃないｗｗｗｗｗ', '振り飛車の専門家とかだろう'],
  castJudge: ['{cast}さんが言うならしょうがないｗ', 'まてｗｗｗｗｗ', 'よくねえよふざけんなｗｗｗ'],
  castSo: ['まあ{cast}さんが言うなら…', 'まあお前が言うならｗ'],
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
  // 投了の早さ(29章): 詰みまで指す人・潔い人・粘る人の終局。
  fullMate: ['最後まで指すのが{name}流', '最後まで諦めない{name}', '詰みまで指すのかっこいい', '{name}は最後まで指す人だからな'],
  cleanResign: ['潔い投了', 'さすが{name}、潔い', '投げっぷりがいい', '早いけど、もう詰んでるのか'],
  stubbornResign: ['よく粘った', '{name}粘ったなあ', '粘り強い', '3手詰めまで指したね'],
  // ---- 30章: 二日制のタイトル戦の配信の例から(名詞は会場・棋士・手・駒・視聴者の数で差し替える)。
  venueAsk: ['これどこでやってるんだろう'],
  venueAnswer: ['{city}の「{place}」です'],
  venueRude: ['場所なんか自ら調べろや'],
  greet: ['こんにちは！本日も配信ありがとうございます。', '♪───Ｏ（≧∇≦）Ｏ────♪'],
  audience: ['{n}人いったよ', '{n}人行ったよ。', '{n}人オメ', 'もう{n}人超えとる。'],
  audienceBig: ['㊗{word}！'],
  resume: ['対局再開'],
  day2: ['流石二日目', 'タイトルの将棋ってなんで２日もかけるんでしょう'],
  unsealGuess: ['まあ　{name}さんも予想してたやろな'],
  unsealMorning: ['今北　おはようございます　封じ手は{move}'],
  unsealBest: ['ほー最善と言われていた{move}'],
  imakita: ['今北産業'],
  dropGuess: ['{piece}打つのかな？'],
  recaptureGuess: ['{move}かな。'],
  umaOk: ['へぇ{piece}作られても平気だと'],
  lunchCurious: ['{name}先生の昼飯メニューが気になりますね'],
  lunchMenu: ['昼飯は{meal}らしいよ'],
  lunchUnknown: ['まだわかりません'],
  lunchJoke: ['あ、昼飯の話ではないです💦'],
  mochi: ['{side}持ちたい'],
  mochiOther: ['私は{side}持ちです'],
  mochiNeither: ['どっちも持ちたくない'],
  lookGood: ['{side}だいぶ良く見えてます'],
  starBehind: ['だからこそ、{name}先生が今回{side}でどういう手を指すか'],
  laymanDoubt: ['これで互角か{side}良しなら自分の棋力が足りてないです'],
  tsukkomi: ['{move}突っ込んだｗｗｗ'],
  bold: ['これ指せるのか', '怖いですねぇ', 'なんか毒饅頭っぽい気が…', 'はえー', 'おお'],
  boldLosing: ['形作りにも見えるけどそういう表情じゃないっすね'],
  weather: ['雨で洗車できそう'],
  takeOnly: ['取るしかないですかね。'],
  took: ['とったか'],
  shousei: ['{side}勝勢じゃない？'],
  igyoku: ['居玉の弱点を突きにきたということか'],
  unclear: ['あーはっきりしない局面だ'],
  stillChance: ['捕まらなければ{name}さんまだ勝ちの目ある'],
  aseri: ['{full}焦ってる　なかなか見られへんでこの対局は', '{name}焦っとるな'],
  legend: ['かつての{pair}の激戦を思い起こされる'],
  handOnly: ['持ち駒{piece}だけなのはつらいなあ'],
  twoNari: ['{name}「僕の飛車は……二度、“成る”」'],
  twoNariReply: ['森内竜王の飛車は二度曲がるけどな'],
  longImportant: ['ここで長考するってことは大事な場面だろうけど、この後はどうなるのかわからない', '天井見た！', '迷い道クネクネ'],
  maegami: ['{name}さん、前髪気になる'],
  unbeaten: ['二日制のタイトル戦まだ失陥したことなかったはず。というか無敗'],
  beatLegend: ['全タイトル制覇した人だしな。その人に勝った{name}さんも強い'],
  zenkan: ['この二人で全冠持っています'],
  tokin: ['{move}「ワシは飛車の生まれ変わりなんや！頑張らなあかん！」'],
  kyoDeban: ['香車「出番っすか？」'],
  douDame: ['同{piece}はダメ', 'ここで同{piece}は罠'],
  toreNai: ['とれないのか'],
  nanda: ['{move}なんだ'],
  miseru: ['魅せますねぇ'],
  douHisha: ['同{piece}は覚悟決まりすぎだろｗｗ'],
  douHishaThink: ['同{piece}はいきすぎな感じがする'],
  yomikiri: ['読み切ってるね', '読み切った感', '間違えないな', '流石だわ', 'もう間違えようがない'],
  owari: ['あぁ終わっちまったかなぁ…', '詰みではないけどほぼ終わり', 'まもなく決着', '終わりの予感', 'さすがに無理だ', 'ここまでか', 'やむなし',
    'まだ詰みはないんだろうけど、逃げ切れる気はしない', '即詰みはなくてももうどうしようもない', '詰みはないけど、ここから受けなしか'],
  owariPiece: ['{piece}がきておわりか'],
  reversal: ['大逆転しすぎ', '二転三転したなあ', 'あの展開で{side}勝てるんだ…', 'あの展開で{side}勝つとか恐ろしい', '大逆転劇'],
  magic: ['マジックありますな', 'ってかこれは形勢もどるのでは', '揺らぐな'],
  wasted: ['いやー{move}すごかったけどなぁ勝ち切れんかったか'],
  nebare: ['粘ればまだあるぞ', 'まだ全然終わってはない'],
  byoMiss: ['1分だからそりゃミスも出るか'],
  byoRisk: ['一分将棋なんで外れる危険はまだありうる'],
  muhon: ['飛車の謀反ｗ'],
  muzukashii: ['将棋難しすぎぃ'],
  dameDrop: ['{move}はダメだろ　絶対打ったらアカンやつや'],
  teban: ['{move}で手番渡したの痛かった'],
  ocha: ['お茶飲む余裕がある'],
  ippute: ['1手詰ですｗ'],
  tsumero: ['詰めろ'],
  hisshi: ['{move}で必死'],
  tsunderu: ['詰んでる。'],
  namepu: ['これは舐めプ{name}'],
  saizen: ['最善手しか指してなくて草'],
  yonaga: ['米長先生「わっはっは」'],
  toryoAru: ['投了ある', 'もうさすがに投げるかな'],
  nageDokoro: ['投了するなら　{move}が投げ所でしょう'],
  nageLine: ['{line}で投了やな'],
  nageNai: ['投げきれないか'],
  ryu: ['投了せずに行ける所まで行くのが{name}流'],
  boei: ['これで負けたら防衛だから粘るんやろ？'],
  tanoshi: ['{name}さん楽しそうだね😆'],
  wakaran: ['なんでこれで詰むのか分からん'],
  wakaranReply: ['わしも分からん'],
  owatteta: ['{move}で終わってたんじゃないの？'],
  taeru: ['ギリギリ詰まないけども', '耐えてますかね？', '結構耐えてはいるのか'],
  jikan: ['考える時間稼いでるっぽい？'],
  madaka: ['{move}までか'],
  sokuuchi: ['詰んでるなら{name}さんが即指しするやろうし、まだじゃないの？'],
  sokuuchiReply: ['即指ししないのは確認作業やろ'],
  seikai: ['さあ、正解を見せてください', 'まだ読めない、、、'],
  kyosoku: ['強く同{piece}'],
  kyosokuReply: ['強く同{piece}は草'],
  docchi: ['どっち優勢なん？{side}？'],
  leadChain: ['{a}勝ちそう→{b}勝ちそう→{a}勝ちそう→さすがに{b}勝ち'],
  tataki: ['詰みを探す歩のたたきか'],
  jitto: ['じっと{move}かー'],
  hmm: ['ん？', 'なんか違う手だけど', 'おや', 'おほー', 'あら', 'やっと見えてきた', 'にゃるほど'],
  omoide: ['思い出王手キターーーーーー( ﾉД`)ｼｸｼｸ…'],
  endPraise: ['激闘だった　見応え満点', 'すごい将棋だった', '名局賞щ(ﾟДﾟщ)ｶﾓｰﾝ'],
  endBye: ['お疲れさまでした', 'お疲れ様でした', '８８８８８８', '拍手👏👏👏👏👏', 'おめでとう🎊', 'え、終わりました？', '終了'],
  turning: ['転機は{move}かぁ…'],
  munen: ['{given}　無念'],
  yoseMiss: ['珍しく{name}先生が寄せでミスったな…'],
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
  castHumble: 'cast', castJudge: 'cast', castSo: 'cast',
  furigomaWho: 'hype', furigomaWin: 'cheer', furigomaLose: 'cheer', chi: 'idle', kimino: 'cheer', openingGuessFav: 'predict', senichite: 'theory',
  doyomeki: 'hype', ooSugi: 'idle', bishopCloseFuri: 'hype', kakunari: 'play', kiai: 'hype', hashi: 'hype', formationSure: 'theory', formationHard: 'theory',
  treasure: 'cheer', rareCastle: 'theory', evolve: 'theory', modern: 'theory', often: 'theory', joban: 'theory', mouEnd: 'hype', kyosha: 'predict',
  chaosHarsh: 'hype', uchu: 'hype', utitai: 'predict', naruImi: 'play', bishopWonder: 'newbie', kakuAwase: 'theory', retreat: 'play', mushi: 'play', hishaKawaii: 'theory', castShikata: 'cast', castIji: 'cast', castDousuru: 'cast', castIgai: 'cast', castGood: 'cast',
  neta: 'neta', oyatsu: 'neta', castStart: 'cast', castHanane: 'cast', castFather: 'cast', castAgree: 'cast', trait: 'cheer', next: 'cheer', avatar: 'cheer', hype: 'hype',
  kifu: 'kifu', kifuNew: 'kifu', toryo: 'kifu', mateEnd: 'kifu', fullMate: 'cheer', cleanResign: 'kifu', stubbornResign: 'cheer',
  venueAsk: 'newbie', venueAnswer: 'answer', venueRude: 'idle', greet: 'hype', audience: 'hype', audienceBig: 'hype', resume: 'play', day2: 'idle',
  unsealGuess: 'predict', unsealMorning: 'idle', unsealBest: 'ai', imakita: 'idle', dropGuess: 'predict', recaptureGuess: 'predict', umaOk: 'play',
  lunchCurious: 'neta', lunchMenu: 'neta', lunchUnknown: 'idle', lunchJoke: 'idle', mochi: 'idle', mochiOther: 'idle', mochiNeither: 'idle',
  lookGood: 'idle', starBehind: 'cheer', laymanDoubt: 'idle', tsukkomi: 'hype', bold: 'hype', boldLosing: 'idle', weather: 'idle', takeOnly: 'predict',
  took: 'play', shousei: 'ai', igyoku: 'theory', unclear: 'idle', stillChance: 'cheer', aseri: 'hype', legend: 'history', handOnly: 'theory',
  twoNari: 'neta', twoNariReply: 'history', longImportant: 'clock', maegami: 'neta', unbeaten: 'history', beatLegend: 'history', zenkan: 'history',
  tokin: 'neta', kyoDeban: 'neta', douDame: 'predict', toreNai: 'play', nanda: 'play', miseru: 'hype', douHisha: 'hype', douHishaThink: 'theory',
  yomikiri: 'hype', owari: 'idle', owariPiece: 'play', reversal: 'hype', magic: 'hype', wasted: 'idle', nebare: 'cheer', byoMiss: 'clock', byoRisk: 'clock',
  muhon: 'neta', muzukashii: 'idle', dameDrop: 'play', teban: 'theory', ocha: 'clock', ippute: 'ai', tsumero: 'ai', hisshi: 'ai', tsunderu: 'ai',
  namepu: 'neta', saizen: 'ai', yonaga: 'history', toryoAru: 'idle', nageDokoro: 'theory', nageLine: 'predict', nageNai: 'idle', ryu: 'cheer', boei: 'theory', tanoshi: 'cheer',
  wakaran: 'newbie', wakaranReply: 'idle', owatteta: 'ai', taeru: 'idle', jikan: 'clock', madaka: 'predict', sokuuchi: 'idle', sokuuchiReply: 'idle',
  seikai: 'hype', kyosoku: 'play', kyosokuReply: 'idle', docchi: 'newbie', leadChain: 'idle', tataki: 'theory', jitto: 'play', hmm: 'idle', omoide: 'hype',
  endPraise: 'hype', endBye: 'kifu', turning: 'theory', munen: 'cheer', yoseMiss: 'idle', material: 'material', materialEven: 'material',
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

// ---- 27章: コメントの名詞を状況で差し替える材料

/** 戦法の短い呼び方(「藤井システム」→「システム」、「四間飛車」→「四間」)。 */
function shortOpening(name) {
  if (/システム/.test(name)) return 'システム';
  const furi = /^(四間|三間|向かい|中)飛車$/.exec(name);
  return furi ? furi[1] : name;
}
/** 珍しい囲い(「まさかの○○」)と、囲いの発展形(「ここから○○でもいいぞ」。上から順に合わせる)。 */
const RARE_CASTLE = /ミレニアム|エルモ|elmo|銀冠|天守閣|菊水|カニ囲い|木村美濃|中住まい/;
const CASTLE_NEXT = Object.freeze([[/舟囲い/, 'エルモ'], [/片美濃/, '銀冠'], [/美濃囲い/, '銀冠']]);
/** 8つのタイトル(記録係の経歴の言い方)。 */
const TITLE_NAMES = Object.freeze(['竜王', '名人', '叡王', '王位', '王座', '棋王', '王将', '棋聖']);
/** 解説へのつっこみは、解説の言葉が出てから少し遅れて流す(ミリ秒)。 */
const REACT_LAG = 1600;
/** 手の表記から先手・後手の印を外す(「▲7六歩」→「7六歩」)。 */
const bareMove = (text) => String(text ?? '').replace(/^[▲△☗☖]/, '');
/** 数の3桁区切り(「7,500」)。 */
const grouped = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
/** 視聴者の数の節目(30章)。 */
const AUDIENCE_MARKS = Object.freeze([1000, 2000, 5000, 7500, 10000, 20000, 50000, 100000, 200000]);
/** 視聴者が思い出す、昔の激戦の2人(30章)。 */
const LEGEND_PAIRS = Object.freeze(['羽生森内', '大山升田', '中原米長', '谷川羽生']);
/** 持ち駒の種類(sfenの持ち駒の欄から、その側の駒の字と数)。 */
function handPieces(sfen, side) {
  const hand = String(sfen).replace(/^sfen\s+/, '').trim().split(/\s+/)[2] ?? '-';
  const pieces = [];
  if (hand === '-') return pieces;
  for (const [, count, letter] of hand.matchAll(/(\d*)([a-zA-Z])/g)) {
    const own = side === 'black' ? letter === letter.toUpperCase() : letter === letter.toLowerCase();
    if (own) pieces.push({ kind: letter.toUpperCase(), count: Number(count || 1) });
  }
  return pieces;
}

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
   * @param {{ size?: string, pos?: string, lag?: number }} [style] lag: 流し始めを遅らせるミリ秒(解説へのつっこみ・振り駒の結果への反応)
   */
  const comment = (at, when, pool, values = {}, count = 1, tone = '', style = {}) => {
    const kind = POOL_KIND[pool] ?? pool;
    for (let index = 0; index < count; index += 1) {
      comments.push({
        at, when, text: fill(pickFresh(pool), values), tone: tone || KIND_TONE[kind] || '', kind, size: style.size ?? '', pos: style.pos ?? '',
        ...(style.lag ? { lag: style.lag } : {}),
      });
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
  /**
   * 善彦の言い方を、案の中から局ごとに選ぶ(37章)。善彦でないときは1つ目を返し、種も使わない。
   * 善彦の選びは別の種にし、ほかのコメントの選び方を動かさない。
   */
  const yoshihikoRng = createRng(relaySeed(`${spec.key}:yoshihiko`));
  /** 善彦の解説へのつっこみの順(38章)。ほかの選び方を動かさないよう、別の種。 */
  const yoshihikoReactRng = createRng(relaySeed(`${spec.key}:yoshihiko-react`));
  const yo = (...options) => (cast.voice === 'yoshihiko' ? pick(yoshihikoRng, options) : options[0]);
  /**
   * 羽音の言い方を、案の中から局ごとに選ぶ(39章)。短く平らに、感嘆符なし・敬語なし。羽音でないときは1つ目を返し、種も使わない。
   */
  const hananeRng = createRng(relaySeed(`${spec.key}:hanane`));
  const ha = (...options) => (cast.voice === 'hanane' ? pick(hananeRng, options) : options[0]);
  const news = [...(spec.news ?? [])];
  let newsShown = 0;
  let lastAi = 0;
  let clockGapSaid = false;
  const line = (at, when, role, text) => lines.push({ at, when, role, text });
  /** 解説への視聴者のつっこみ({cast}は解説者の苗字)。解説の言葉が出てから流す(27章)。 */
  const react = (at, pool, count = 1) => comment(at, 'move', pool, { cast: castSurname }, count, '', { lag: REACT_LAG });
  /**
   * 善彦の解説への視聴者のつっこみは、その場面の組の行を全部流す(配信の例のとおり。38章)。
   * 順は種で混ぜ、少しずつずらして流す。善彦でなければ、ふだんのreactと同じ数だけ。
   */
  const reactAll = (at, pool, count = 1) => {
    if (cast.voice !== 'yoshihiko') {
      react(at, pool, count);
      return;
    }
    const kind = POOL_KIND[pool] ?? pool;
    const texts = [...VIEWER[pool]];
    for (let index = texts.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(yoshihikoReactRng.next() * (index + 1));
      [texts[index], texts[swap]] = [texts[swap], texts[index]];
    }
    texts.forEach((text, index) => comments.push({
      at, when: 'move', text: fill(text, { cast: castSurname }), tone: KIND_TONE[kind] || '', kind, size: '', pos: '', lag: REACT_LAG + index * 700,
    }));
  };
  /** 視聴者の呼び方(苗字。羽音は「羽音」、善彦は「天鷺」。同じ苗字の2人なら名前全部。27章)。 */
  const fan = (side) => {
    const player = players[side];
    if (player?.story === HANANE) return '羽音';
    if (player?.story === YOSHIHIKO) return '天鷺';
    const name = player?.name ?? '';
    const surname = SURNAMES.find((candidate) => name.startsWith(candidate) && name.length > candidate.length);
    return surname && !(players[other(side)]?.name ?? '').startsWith(surname) ? surname : name;
  };
  const star = (side) => players[side]?.story === HANANE || players[side]?.story === YOSHIHIKO;
  /** 格上の側(物語の人物と、そうでない棋士。または強さの差が200以上)。どちらでもなければnull。 */
  const stronger = (() => {
    if (star('black') !== star('white')) return star('black') ? 'black' : 'white';
    const gap = (players.black?.rating ?? 0) - (players.white?.rating ?? 0);
    return gap >= 200 ? 'black' : gap <= -200 ? 'white' : null;
  })();
  /** 記録係の経歴に出すタイトル(この棋戦のタイトルではないもの)。 */
  const recordTitle = pick(rng, TITLE_NAMES.filter((title) => title !== (spec.event === 'meijin' ? '名人' : '竜王')));
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
    if (cast.voice === 'yoshihiko') {
      // 善彦の解説は、聞き手が肩書で紹介する(配信の例のまま)。
      line(0, 'move', 'host', `${cast.name}${cast.title || cast.dan}です。先生よろしくお願いします。`);
      line(0, 'move', 'commentator', 'あぁ、よろしくお願いします。');
    } else {
      line(0, 'move', 'commentator', cast.voice === 'hanane'
        ? `解説の${cast.name}。……よろしく。`
        : `解説の${cast.name}${cast.dan}です。よろしくお願いします。`);
    }
    if (spec.black?.story === HANANE || spec.white?.story === HANANE) {
      if (cast.voice === 'yoshihiko') {
        line(0, 'move', 'host', 'お父さんとして、羽音さんの将棋は、いかがですか？');
        line(0, 'move', 'commentator', 'まあ、あの……親子なんで。こう、なかなか、言いにくいんですけど。えぇ。');
      }
    } else if ((spec.black?.story === YOSHIHIKO || spec.white?.story === YOSHIHIKO) && cast.voice === 'hanane') {
      line(0, 'move', 'commentator', '父さんの将棋。……いつも通り、隙がないと思う。');
    }
    line(0, 'move', 'host', `先手の${call('black')}は${playerHighlight(black)}。後手の${call('white')}は${playerHighlight(white)}。`);
    // 観戦の期の分身(あなたの対局から出した能力で戦う棋士)。
    const avatarSide = (['black', 'white']).find((side) => players[side]?.kind === 'avatar');
    // 自分の対局の中継(docs/mate-finish-design.md)。プレイヤー本人が指した局を振り返る。
    const userSide = (['black', 'white']).find((side) => players[side]?.kind === 'user');
    if (userSide) line(0, 'move', 'host', `今日は、あなたの対局をふり返るよ。${SIDE_NAME[userSide]}が、あなた！ 解説つきで、もう一度見ていこう。`);
    // 分身の対局の相手は「次の相手」だが、いま戦っている相手なので「よく見ておこう」は言わない(34章)。自分の対局も同じ。
    const next = nextId && !avatarSide && !userSide ? (['black', 'white']).find((side) => players[side]?.id === nextId) : null;
    if (next) line(0, 'move', 'host', `${call(next)}は、あなたの次の相手。どんな将棋を指すか、よく見ておこう！`);
    if (avatarSide) {
      line(0, 'move', 'host', `${SIDE_NAME[avatarSide]}は、あなたの分身！ あなたの対局から出した能力で戦うよ。`);
      comment(0, 'move', 'avatar', { name: players[avatarSide].name }, 2, 'pink');
    }
    const favorite = favoriteOpening(black);
    if (favorite) {
      if (cast.voice === 'yoshihiko') line(0, 'move', 'host', `${call('black')}の得意な形ですけれども。`);
      line(0, 'move', 'commentator', speak(cast, `${call('black')}は${favorite}が得意です。${call('white')}がどう応じるか、注目ですね。`, ha(`${call('black')}は${favorite}が多い。${call('white')}が、どう外すか。`, `${favorite}。……${call('black')}は、たぶん今日もそれ。`),
        yo(`${call('black')}は${favorite}を、まあ、よく指されますよね。えぇ。`, `${favorite}が得意ということで。まあ、あの、今日も出るんでは無いかな…という感じはありますね。`)));
    }
    // 善彦の解説は、謙遜から始まる(視聴者がつっこむ。25章)。親子の対局は、上の親子のやりとりにする。
    // 両者がタイトルを持っていれば「タイトルホルダー同士」。そのあと聞き手が棋譜読み上げに振る(36章)。
    if (cast.voice === 'yoshihiko' && spec.black?.story !== HANANE && spec.white?.story !== HANANE) {
      const holders = (black.held ?? []).length > 0 && (white.held ?? []).length > 0;
      line(0, 'move', 'host', holders ? 'タイトルホルダー同士の一戦ですけれども。' : spec.weight === 'title' ? 'タイトル戦の大舞台ですけれども。' : '注目の一戦ですけれども。');
      line(0, 'move', 'commentator', '…そうですね、まあ、あの、専門家じゃないんで。全然、分かんないという感じなんですけど。');
      line(0, 'move', 'host', 'はい、どうもありがとうございました。');
      reactAll(0, 'castHumble', 2);
    }
    if (cast.voice === 'yoshihiko') {
      line(0, 'move', 'host', cast.reader ? `それでは棋譜読み上げの${cast.reader}さん、よろしくお願いします。` : 'それでは棋譜読み上げ、よろしくお願いします。');
    }
    // 棋譜読み上げが、先手と対局の開始を告げる(番勝負の2局目からは振り駒をしない)。
    if ((spec.gameNo ?? 0) > 1) {
      line(0, 'move', 'reader', `先手は${black.name}${black.dan}です。それでは、対局を開始してください。`);
    } else {
      // 振り駒の前に「先手どっち」、結果の読み上げのあとに反応(27章)。格上が先手なら「勝ったわ」、後手なら「アカン」。
      comment(0, 'move', 'furigomaWho');
      line(0, 'move', 'reader', `振り駒の結果、先手は${black.name}${black.dan}に決まりました。それでは、お願いいたします。`);
      const after = { lag: 1100 };
      comment(0, 'move', 'furigoma', { name: fan('black') }, 1, '', after);
      if (stronger === 'black' && rng.next() < 0.7) comment(0, 'move', 'furigomaWin', { name: fan('black') }, 1, '', after);
      // 視聴者は羽音を「羽音ちゃん」、ほかの棋士を「○○先生」と呼ぶ。
      else if (stronger === 'white') comment(0, 'move', 'furigomaLose', { name: players.white?.story === HANANE ? '羽音ちゃん' : `${fan('white')}先生` }, 1, '', after);
      if (rng.next() < 0.2) comment(0, 'move', 'chi', { name: fan('white') }, 1, '', after);
    }
    // 格上の棋士の心の声を、視聴者が想像する(27章)。番勝負は肩書(竜王・名人)、ほかは段位。
    if (stronger && !isYou(players[stronger]) && rng.next() < 0.5) {
      const title = spec.kind === 'finals' ? (spec.event === 'meijin' ? '名人' : '竜王') : (players[stronger]?.dan || '先生');
      comment(0, 'move', 'kimino', { name: fan(stronger), title });
    }
    comment(0, 'move', 'start', {}, 3);
    // 30章: 配信のあいさつと、会場をたずねる人(番勝負は対局場、ほかは将棋会館)。答えと、きつい返しは遅れて流れる。
    maybe(0.5, 0, 'move', 'greet');
    if (rng.next() < 0.45 * density) {
      const [city, place] = spec.venue ? String(spec.venue).split('・') : ['東京', '将棋会館'];
      comment(0, 'move', 'venueAsk');
      comment(0, 'move', 'venueAnswer', { city, place: place ?? city }, 1, '', { lag: 1400 });
      if (rng.next() < 0.4) comment(0, 'move', 'venueRude', {}, 1, '', { lag: 2700 });
    }
    // 番勝負の善彦(二日制で無敗)。善彦と羽音の番勝負なら「この二人で全冠」。
    if (spec.kind === 'finals') {
      const father = (/** @type {const} */ (['black', 'white'])).find((color) => players[color]?.story === YOSHIHIKO);
      if (father && rng.next() < 0.6) comment(0, 'move', 'unbeaten');
      if (father && players[other(father)]?.story === HANANE) maybe(0.6, 0, 'move', 'zenkan');
    }
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
      if (!player || isYou(player) || !player.age || !Number.isFinite(age) || rng.next() >= 0.5) continue;
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
  /** 各手のあとに王手だったか(手数-1の位置)と、詰みで終わったときの寄せの手数。 */
  const checks = [];
  let endMate = 0;
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
  /** 27章: 駒を取らずに成った駒(次の手で、その駒が動かなければ「成った意味が無い」)。 */
  const promotedQuiet = { black: null, white: null };
  /** 30章: 視聴者の数の節目、形勢の入れ替わり(優勢の側の並び)、いちばんの悪手と鋭い一手、詰みが読めた最初の手、続けて最善を指した数。 */
  let audienceShown = relayAudience(spec, 0);
  const leaders = [];
  const worstMove = { black: null, white: null };
  const sharpMove = { black: '', white: '' };
  let firstMate = null;
  const bestRun = { black: 0, white: 0 };
  const rookPromotions = { black: 0, white: 0 };
  let resumeAt = -1;
  /** 決着が見えたあとの一言を最後に言った手数。 */
  let settledAt = -99;
  const lunchAt = relayTimeControl({ event: spec.event, kind: spec.kind }).breaks.find(({ kind }) => kind === 'lunch')?.at ?? 12 * 60;
  /** 名前(苗字を除いた部分)。苗字が分からなければ名前全部。 */
  const givenName = (side) => {
    const name = players[side]?.name ?? '';
    const surname = SURNAMES.find((candidate) => name.startsWith(candidate) && name.length > candidate.length);
    return surname ? name.slice(surname.length) : name;
  };

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
    // 王手だったか(終局のときに、最後の寄せが何手詰めだったかを数える。docs/mate-finish-design.md)。
    checks[index] = givesCheck(sfenAfter);
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
      // 27章: 対局者の得意戦法から予想する(角換わりの得意な棋士なら、千日手からの一手損も)。
      for (const guessSide of /** @type {const} */ (['white', 'black'])) {
        const favorite = favoriteOpening(players[guessSide]);
        if (favorite && rng.next() < 0.6) comment(at, 'think', 'openingGuessFav', { opening: favorite, name: fan(guessSide) });
        if (/角換わり|一手損/.test(favorite) && once('senichite')) maybe(0.5, at, 'think', 'senichite');
      }
      if (!['7g7f', '2g2f'].includes(entry.move)) comment(at, 'move', 'firstSurprise', {}, 2, '', { size: 'big' });
      else if (entry.move === '7g7f' && rng.next() < 0.3) {
        comment(at, 'move', 'doyomeki');
        comment(at, 'move', 'ooSugi', { move: bareMove(text) }, 1, '', { lag: 1200 });
      }
    }
    // 25章: 序盤に角道を止める手(先手の6六歩・後手の4四歩)。角が初めの升にいるときだけ。
    const closesBishop = at <= 16 && facts?.kind === 'P' && !facts.drop
      && ((side === 'black' && entry.move === '6g6f' && pieceAt(sfenBefore, '8h') === 'B') || (side === 'white' && entry.move === '4c4d' && pieceAt(sfenBefore, '2b') === 'b'));
    if (closesBishop && once('bishop-close')) {
      maybe(0.4, at, 'think', 'bishopCloseGuess');
      comment(at, 'move', 'bishopClose', { move: bareMove(text) }, 2);
      if (isFuri(favoriteOpening(players[side]))) maybe(0.7, at, 'move', 'bishopCloseFuri');
    }

    // 考慮中(指す前): 予想・長考と秒読み。
    if (predicted && at >= 7 && rng.next() < Math.min(0.9, (at > plan.middleEnd ? 0.3 : 0.16) * density)) {
      const guess = moveTextOf(sfenBefore, predicted, previousUsi);
      if (!/[a-z*]/.test(guess)) {
        comment(at, 'think', 'predict', { move: guess });
        predictedAt = at;
      }
    }
    // 27章: 読み筋の1手目が香車を上がる手(穴熊に組む・端攻め)。
    const predictedParts = parseUsiMove(predicted);
    if (predictedParts?.from && /^[Ll]$/.test(pieceAt(sfenBefore, predictedParts.from) ?? '') && once(`kyosha:${side}`)) maybe(0.5, at, 'think', 'kyosha');
    if (entry.time >= LONG_THINK_SECONDS) {
      longThinks += 1;
      if (once(`long:${side}`) || rng.next() < 0.5) {
        if (cast.voice === 'yoshihiko') line(at, 'think', 'host', 'ここで長考ですけれども。');
        line(at, 'think', 'commentator', speak(cast, `${call(side)}、ここで長考に入りました。`, ha('……長考。ここは、考える場面。', `${call(side)}、止まった。候補が多い局面だから。`),
          yo('……まあ、考えますよね。ここは。', '長考ですね。まあ、私でも、ここは考えると思います。えぇ。')));
      }
      // 2回目の長考で、聞き手が対局者の表情をたずねる(25章)。善彦には最初の長考で、苗字と肩書(タイトルか段位)で丁寧にたずねる(36章)。
      if (longThinks >= (cast.voice === 'yoshihiko' ? 1 : 2) && once('face')) {
        line(at, 'think', 'host', cast.voice === 'yoshihiko'
          ? `${shortName(side)}${titleOf(players[side])}の対局中の表情とかは、どうですか？`
          : `${shortName(side)}${players[side]?.dan ?? ''}の対局中の表情とかは、どう？`);
        line(at, 'think', 'commentator', speak(cast, '落ち着いていますね。表情からは何も読めません。', ha('……変わらない。いつも通り。', '表情は、見てない。盤を見てる。'), '変わらない。いつも変わらないですね。'));
      }
      comment(at, 'think', 'longThink', {}, 2);
      maybe(0.45, at, 'think', 'neta', { title: recordTitle });
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

      // ---- 27章: 盤の上の事実から言える見せ場(どれも1局に1回まで)。
      const boardBefore = parseSfenState(sfenBefore).board;
      const bare = bareMove(text);
      const fresh = !bare.startsWith('同');
      // 序盤の端歩(1筋・9筋の歩を突く)。
      if (facts.kind === 'P' && !facts.drop && !facts.captured && at <= 24 && [1, 9].includes(squareXY(facts.to).x) && once(`hashi:${side}`)) maybe(0.6, at, 'move', 'hashi');
      // 玉が盤の真ん中より前へ出た。
      if (facts.kingMove && relativeRank(facts.to, side) <= 5 && once('uchu')) comment(at, 'move', 'uchu', {}, 1, '', { size: 'big' });
      // 中盤からの角打ち(角を合わせて消せる)。
      if (facts.drop && facts.kind === 'B' && at >= 15 && once(`kaku-awase:${side}`)) maybe(0.35, at, 'move', 'kakuAwase');
      // 角が遠くまで動いた(初心者のつぶやき)。
      if ((facts.kind === 'B' || facts.kind === '+B') && facts.from && distance(facts.from, facts.to) >= 5 && once('bishop-wonder')) maybe(0.3, at, 'move', 'bishopWonder');
      // 大駒が自陣のほうへ引いた(「6八角？」)。
      if (MAJOR.has(facts.kind) && facts.from && !facts.captured && fresh && at >= 16
        && relativeRank(facts.to, side) > relativeRank(facts.from, side) && once(`retreat:${side}`)) maybe(0.3, at, 'move', 'retreat', { move: bare });
      // 駒を取らずに成った駒が、次の手番で動かなかった。
      const quiet = promotedQuiet[side];
      if (quiet && quiet.at === at - 2) {
        if (facts.from !== quiet.square && boardBefore.get(quiet.square)?.color === side && once(`naru-imi:${side}`)) maybe(0.4, at, 'move', 'naruImi');
        promotedQuiet[side] = null;
      }
      if (facts.promote && !facts.captured && facts.kind !== 'B' && facts.kind !== 'R') promotedQuiet[side] = { square: facts.to, at };
      // 直前の相手の手で大駒に当たりがかかったのに、逃げずに別の手(王手の受けは除く)。
      const lastTo = parseUsiMove(previousUsi)?.to;
      if (lastTo && !isKingAttacked(boardBefore, side) && facts.to !== lastTo && once(`mushi:${side}`)) {
        const hanging = [...boardBefore].filter(([square, piece]) => piece.color === side && MAJOR.has(piece.kind)
          && square !== facts.from && attackersOf(boardBefore, square, other(side)).some(({ square: from }) => from === lastTo));
        if (hanging.length) maybe(0.5, at, 'move', 'mushi');
        else said.delete(`mushi:${side}`);
      }
      // 終盤、自玉が薄いのに、当たりの飛車を逃がした(格言の逆)。
      if ((facts.kind === 'R' || facts.kind === '+R') && facts.from && !facts.captured && at > plan.middleEnd
        && attackersOf(boardBefore, facts.from, other(side)).length && (kingGuard(sfenBefore, side)?.guards ?? 9) <= 1 && once('hisha-kawaii')) {
        maybe(0.6, at, 'move', 'hishaKawaii');
      }
    }

    // 実況(駒を打つ・取る・長考のあとの手)。
    if (facts?.drop) {
      maybe(at > plan.openingEnd ? 0.35 : 0.2, at, 'move', 'drop', { move: text, piece: PIECE_NAMES[facts.kind] ?? '' });
      if (at >= 15) newbie(at, 'move', 'drop', {}, 0.5);
      // 持ち駒が少ないときの歩打ち(攻め手が少ない。25章)。
      if (facts.kind === 'P' && at > plan.openingEnd && handCount(sfenAfter, side) <= 1 && once('shikata')) {
        line(at, 'move', 'host', 'これは……一体……？');
        line(at, 'move', 'commentator', speak(cast, '持ち駒が少ないので、歩で手をつなぐ場面ですね。', ha('持ち駒が少ないから、歩でつなぐしかない。', '……歩しかない。だから、歩。'), 'まぁ、しょうがないんですね。攻め手がちょっと少ないので。'));
        if (cast.voice === 'yoshihiko') {
          line(at, 'move', 'commentator', 'やっぱりちょっと、手駒を増やさないことには、仕方がないという…');
          reactAll(at, 'castShikata', 2);
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
          line(at, 'move', 'commentator', speak(cast, '角を持ち合うと、打ち込みのすきに気をつける将棋になりますね。', ha('角が持ち駒になった。ここからは、打ち込みの隙の探し合い。', '角交換。……隙を作ったほうが、損をする。'),
            yo('角交換ですね。まあ、打ち込みには、お互い気をつけないといけないという…', 'えー、角が持ち駒になったので。まあ、あの、隙は作りにくいという感じは、ありますね。')));
        }
        comment(at, 'move', 'bishop', {}, 2);
        maybe(0.4, at, 'move', 'kiai');
        newbie(at, 'move', 'bishop');
      } else {
        comment(at, 'move', 'major', { piece: PIECE_NAMES[facts.captured] }, 2);
        if (at > plan.middleEnd && once('uwaa')) {
          // 終盤の大駒の取り(うわぁ！ 25章)。
          line(at, 'move', 'host', 'うわぁ！');
          line(at, 'move', 'commentator', speak(cast, 'これは大きいですね。どう受けるでしょうか。', ha('これは大きい。……受けが要る。', '……取られた。ここからは、受け方の問題。'), 'うわぁ～流石に……'));
          if (cast.voice === 'yoshihiko') {
            line(at, 'move', 'commentator', 'う～ん、どうするんでしょうか……');
            reactAll(at, 'castDousuru');
          }
        } else if (rng.next() < 0.5) line(at, 'move', 'host', `${PIECE_NAMES[facts.captured]}を取った！`);
      }
      // 27章: 序盤に角を取って成る(「8八かくなり～」)。
      if (facts.captured === 'B' && facts.kind === 'B' && facts.promote && at < 30 && !bareMove(text).startsWith('同') && once('kakunari')) {
        maybe(0.6, at, 'move', 'kakunari', { sq: bareMove(text).replace(/角成$/, '') });
      }
      if (facts.captured === 'B') lastBishopCapture = at;
    } else if (facts?.captured && rng.next() < 0.3) {
      comment(at, 'move', 'capture');
    }
    if (facts?.check) {
      // 続けて王手(なにがなんでも。25章)。
      if (lastCheckAt[side] === at - 2 && once('iji')) {
        line(at, 'move', 'host', 'あ、なにがなんでも……');
        line(at, 'move', 'commentator', speak(cast, '攻めを続けますね。手を緩めません。', ha('……続けて王手。止まる気はないみたい。', '王手の連続。……攻めが切れたら、そこで終わり。'), 'え～～～～～～、意地でも。'));
        reactAll(at, 'castIji');
      }
      lastCheckAt[side] = at;
      comment(at, 'move', 'check', {}, at > plan.middleEnd ? 2 : 1, 'red');
      if (once(`check:${side}`)) line(at, 'move', 'host', `王手！ ${call(side)}が攻めかかったよ。`);
      newbie(at, 'move', 'check', {}, 0.4);
    }
    if (facts?.promote && (facts.after === '+R' || facts.after === '+B') && once(`promote:${side}:${facts.after}`)) {
      comment(at, 'move', 'promote', { piece: PIECE_NAMES[facts.after] });
      newbie(at, 'move', 'promote', {}, 0.5);
      line(at, 'move', 'commentator', speak(cast, `${call(side)}、${PIECE_NAMES[facts.after]}を作りました。大きいですね。`, ha(`${call(side)}、${PIECE_NAMES[facts.after]}。……大きい。`, `${PIECE_NAMES[facts.after]}ができた。この駒は、働く。`),
        yo(`${PIECE_NAMES[facts.after]}ができましたね。まあ、これは大きいんでは無いかな…`, `え～、${PIECE_NAMES[facts.after]}ですか。いやぁ、これは、えぇ、ええ。大きいですね。`)));
    }

    // 戦型と囲い(判定が初めて付いたとき)。
    if (formations) {
      const rook = (color) => formations[color]?.rook ?? '';
      const castle = (color) => formations[color]?.castle ?? '';
      if (!formationsSeen.battle && formations.battle) {
        formationsSeen.battle = formations.battle;
        line(at, 'move', 'commentator', speak(cast, `戦型は${formations.battle}になりました。`, ha(`${formations.battle}。……よくある形。`, `戦型は${formations.battle}。ここまでは、予定通りだと思う。`),
          yo(`まあ、${formations.battle}ということで。えぇ。`, `${formations.battle}ですか。……まあ、最近よく見る形ではありますね、はい。`)));
        comment(at, 'move', 'formation', { name: formations.battle });
        maybe(0.3, at, 'move', 'formationSure', { name: formations.battle, short: shortOpening(formations.battle), side: '' });
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
          maybe(0.5, at, 'move', 'treasure');
        }
      }
      for (const color of /** @type {const} */ (['black', 'white'])) {
        if (!formationsSeen[color] && rook(color) && rook(color) !== formationsSeen.battle) {
          formationsSeen[color] = rook(color);
          if (once(`rook:${color}`) && at < 40) {
            line(at, 'move', 'host', `${SIDE_NAME[color]}は${rook(color)}だね！`);
            comment(at, 'move', 'formation', { name: rook(color) });
            if (isFuri(rook(color))) maybe(0.6, at, 'move', 'furi', { name: rook(color) });
            // 27章: 得意戦法どおりなら当然と受け止め、その側が苦しければ心配する(名詞は判定した戦法)。
            const name = rook(color);
            const favorite = favoriteOpening(players[color]);
            const values = { name, short: shortOpening(name), side: SIDE_NAME[color] };
            const colorRate = color === 'black' ? rateAfter : 1 - rateAfter;
            if (colorRate <= 0.4) maybe(0.6, at, 'move', 'formationHard', values);
            else if (favorite && (name.includes(favorite) || favorite.includes(name))) maybe(0.6, at, 'move', 'formationSure', values);
          }
        }
        const castleKey = color === 'black' ? 'castleBlack' : 'castleWhite';
        if (!formationsSeen[castleKey] && castle(color) && at >= 10) {
          formationsSeen[castleKey] = castle(color);
          line(at, 'move', 'host', `${SIDE_NAME[color]}の${call(color)}、${castle(color)}が完成！`);
          if (rng.next() < 0.6) {
            line(at, 'move', 'commentator', speak(cast, 'しっかり囲いましたね。これで戦いの準備ができました。', ha('囲いができた。……これで、戦える。', `${castle(color)}。……堅い。`),
              yo('しっかり、囲いましたね。まあ、これで一応、準備はできたという感じで。', `えー、${castle(color)}が完成と。まあ、固いのは固いですよね、えぇ。`)));
          }
          comment(at, 'move', 'castle', { name: castle(color) });
          const guard = kingGuard(sfenAfter, color);
          if (/穴熊/.test(castle(color)) && once(`anaguma-go:${color}`)) maybe(0.6, at, 'move', 'anagumaGo', { name: fan(color), opp: fan(other(color)) });
          // 27章: 珍しい囲い(「まさかのミレニアム」)と、発展形(「ここからエルモでもいいぞ」)。
          if (RARE_CASTLE.test(castle(color))) maybe(0.7, at, 'move', 'rareCastle', { castle: castle(color).replace(/囲い$/, '') });
          const next = CASTLE_NEXT.find(([pattern]) => pattern.test(castle(color)))?.[1];
          if (next && at < plan.middleEnd) maybe(0.4, at, 'move', 'evolve', { next });
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
        line(at, 'move', 'commentator', speak(cast, 'ここで定跡を離れました。ここからが本当の勝負です。', ha('ここで、前例から外れた。……ここからが、本当の勝負。', '……知らない形。私も、読みながら見る。'),
          yo('この辺から、まあ、前例は無いんでは無いかな…という印象ですね。', 'ここからは、えー、もう分かんないです。正直。')));
        comment(at, 'move', 'opening');
        maybe(0.5, at, 'move', 'theory');
        maybe(0.4, at, 'move', 'kifuNew', { at });
        newbie(at, 'move', 'theory', {}, 0.5);
      }
    }

    if (entry.mark === 'book' && bookRun && (at === 10 || at === 20)) maybe(0.45, at, 'move', 'kifu', { at });
    // 27章: 定跡の手への通の一言(歩は「現代的」、角は「よく指す手」)。
    if (entry.mark === 'book' && facts && !facts.captured && !facts.drop && at >= 6 && at <= 30 && !bareMove(text).startsWith('同')) {
      // それぞれ1局に1回(言わなかった手は数えず、次の機会を待つ)。
      const pool = facts.kind === 'P' && at >= 10 ? 'modern' : facts.kind === 'B' ? 'often' : '';
      if (pool && !said.has(pool) && rng.next() < Math.min(0.9, (pool === 'modern' ? 0.12 : 0.4) * density)) {
        said.add(pool);
        comment(at, 'move', pool, { move: bareMove(text) });
      }
    }

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
        line(at, 'move', 'commentator', speak(cast, `${meaning}です。`, ha(`${meaning}。`, `……${meaning}。ほかの手も、あったけど。`),
          yo(`まあ、${meaning}という感じですかね。えぇ。`, `えー、${meaning}……という、まあ、そういう手なんでは無いかな…`)));
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
        line(at, 'move', 'commentator', 'なんか実践的な手ですよね。反則ですけど。');
      } else if (heavy && once('odd')) {
        line(at, 'move', 'host', 'これは……？');
      }
      if (heavy) {
        comment(at, 'move', 'chaos', {}, 2);
        if (!isYou(players[side]) && once('chaos-harsh')) maybe(0.5, at, 'move', 'chaosHarsh');
        under(at, rng.next() < 0.5 ? 'sasshi' : 'oi', 0.5);
      }
      if (collapse) {
        line(at, 'move', 'commentator', speak(cast, `……これは、${call(side)}の玉に危ない筋が残ったかもしれません。終盤の頓死の癖が出てしまったか。`, ha(`……${call(side)}の玉、危ない筋が残ってる。`, '……玉が薄い。見落としがあったかも。'),
          yo('あぁ～……玉が、ちょっと、危ないかもしれないですね。', 'これは、まあ、あの……見落としがあったかな、という。')));
        cards.push({ at, when: 'move', kind: 'trait', tier: 'red', title: `${players[side].name}『終盤での頓死』`, text: '自玉の危険を見落とした' });
      } else {
        line(at, 'move', 'commentator', heavy
          ? speak(cast, `今の${text}は、${call(side)}にとって痛い一手になりそうです。AIの推奨は${bestText}でした。`,
            ha(`AIの推奨は${bestText}。……今の${text}は、少し痛い。`, `……${bestText}なら、まだ互角だった。`),
            yo(`今の${text}は、まあ、痛かったかもしれないですね。AIは${bestText}と言ってるんですけど。`, `あの、AIは${bestText}らしいです。……人間には、ちょっと、難しいですよね。`))
          : speak(cast, `今の${text}は、少し疑問手だったかもしれません。AIの推奨は${bestText}でした。`,
            ha(`${bestText}のほうが、少し良かった。`, `……${bestText}もあった。でも、今の${text}も悪くはない。`),
            yo(`まあ、AIは${bestText}と言ってるんですけど。人間には、ちょっと、あの、難しいですよね。`, `あの、${bestText}が良かったらしいです。……まあ、言われてみれば、という感じですけど。`)));
      }
      const [fromRate, toRate] = [Math.round(moverRate(rateBefore) * 100), Math.round(moverRate(rateAfter) * 100)];
      if (Math.abs(fromRate - toRate) >= 2) line(at, 'move', 'host', `勝率が、${SIDE_NAME[side]}${fromRate}%から${toRate}%に動いたよ。`);
      comment(at, 'move', 'swing', {}, heavy ? 3 : 2);
      if (rng.next() < 0.6) comment(at, 'move', 'aiBest', { best: bestText });
      // 27章: AIの推奨が駒を打つ手だった(「7一銀打ちてえええ」)。
      if (entry.best.includes('*') && bareMove(bestText).endsWith('打') && once(`utitai:${side}`)) maybe(0.5, at, 'move', 'utitai', { best: bareMove(bestText) });
      maybe(0.35, at, 'move', 'roomSwing', { best: bestText });
      if (heavy) hype(at, 1);
      lastAi = at;
      pendingRegret = { side, at: at + 1 };
      think(at, 'move', other(side), 'chance');
      // 勝者の特殊能力が、相手の悪手を引き出した場面。
      const opponent = other(side);
      if (opponent === winner) {
        if (at <= plan.openingEnd && has(players[opponent], 'research-demon') && once('trait:research-demon')) {
          line(at, 'move', 'commentator', speak(cast, `これが${call(opponent)}の『研究の鬼』。序盤で差をつけました。`, ha(`${call(opponent)}の研究。……序盤で、もう差がついてた。`, `序盤で差がついた。${call(opponent)}は、よく調べてる。`),
            yo(`まあ、${call(opponent)}は、研究が深いので。えぇ。ここで差がついたという感じはありますね。`, `この辺は、${call(opponent)}の、まあ、得意なところという印象は、あるんですけど。`)));
          cards.push({ at, when: 'move', kind: 'trait', tier: 'gold', title: `${players[opponent].name}『研究の鬼』`, text: '序盤の研究で差をつけた' });
        } else if (at > plan.openingEnd && at <= plan.middleEnd && has(players[opponent], 'grand-view') && once('trait:grand-view')) {
          line(at, 'move', 'commentator', speak(cast, `${call(opponent)}の『大局観』。中盤の形勢判断が正確です。`, ha(`${call(opponent)}は、形勢判断が正確。……ここで差がついた。`, `……${call(opponent)}、この辺の判断がうまい。`),
            yo(`まあ、${call(opponent)}は、形勢判断が正確なので。えぇ。この辺で差がついたという感じはありますね。`, `この辺は、${call(opponent)}の、まあ、得意なところという印象は、あるんですけど。`)));
          cards.push({ at, when: 'move', kind: 'trait', tier: 'gold', title: `${players[opponent].name}『大局観』`, text: '中盤の形勢判断で上回った' });
        } else if (entry.mark === 'decisive' && spec.how === 'comeback' && has(players[opponent], 'comeback') && once('trait:comeback')) {
          line(at, 'move', 'commentator', speak(cast, `${call(opponent)}の勝負手に、${call(side)}が間違えました。これが『逆転の名手』です。`, ha(`${call(opponent)}の勝負手。……${call(side)}が、間違えた。`, `……逆転。${call(opponent)}は、こういう手を探すのがうまい。`),
            yo(`まあ、${call(opponent)}は、こういうところで、あの、勝負手を出してくるので。えぇ。`, `この辺は、${call(opponent)}の、まあ、得意なところという印象は、あるんですけど。`)));
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
      line(at, 'move', 'commentator', speak(cast, `${text}、見事な一手です。ここはこれしかありませんでした。`, ha(`${text}。……これしかない。`, `……${text}。見えてたなら、すごい。`),
        yo('……いやぁ、これは。まあ、これしか無いんですけど、指せないですよね、普通。', `あぁ～、${text}。えぇ、ええ。これは、凄いですね。`)));
      comment(at, 'move', 'only', {}, 2, 'gold');
      maybe(0.25, at, 'move', 'chi', { name: fan(other(side)) });
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
      line(at, 'move', 'commentator', speak(cast, `詰将棋が得意な${call(side)}、詰みを読み切っていますね。`, ha(`……詰んでる。${call(side)}は、読み切ってる。`, `${call(side)}、もう最後まで見えてると思う。`),
        yo('これは、まあ、読み切ってるんでは無いかな…という感じですね。', 'えー、詰んでますね。たぶん。えぇ、ええ。')));
      cards.push({ at, when: 'move', kind: 'trait', tier: 'blue', title: `${players[side].name}『詰将棋が得意』`, text: '詰みを読み切った' });
    }

    // 25章: 仕掛け(序盤の終わりから中盤の、最初の駒の取り)。善彦は、ぽつぽつと評価する。
    if (facts?.captured && at >= plan.openingEnd - 6 && at <= plan.middleEnd && once('shikake')) {
      if (cast.voice === 'yoshihiko') {
        line(at, 'move', 'host', 'ちょっと無理っぽいような…');
        line(at, 'move', 'commentator', '凄いところから仕掛けたなっていう印象は、あるんですけど。');
        line(at, 'move', 'commentator', 'ただ、まあもう行かざるを得ないという部分も、あったんでは無いかな…');
        line(at, 'move', 'host', 'はい。');
        line(at, 'move', 'commentator', '決断としては非常に良かったような、えぇ、ええ。感じがありますね、えぇ。');
        reactAll(at, 'castJudge', 2);
        under(at, 'judge', 0.6);
      } else {
        line(at, 'move', 'host', 'ここで仕掛けたね！');
        line(at, 'move', 'commentator', speak(cast, 'いよいよ仕掛けました。ここから本格的な戦いですね。', ha('仕掛けた。……悪くない判断。', '仕掛けた。……少し早い。でも、悪くない。')));
      }
    }
    // 中盤の互角(1局に1回)。
    // 善彦は、互角に近い局面(55%まで)で必ず一度言い、言葉に詰まる(36章)。
    const yoshihikoBalanced = cast.voice === 'yoshihiko';
    if (at > plan.openingEnd + 4 && at < plan.middleEnd && Math.abs(rateAfter - 0.5) < (yoshihikoBalanced ? 0.1 : 0.05)
      && once('balanced') && (yoshihikoBalanced || rng.next() < 0.7)) {
      line(at, 'move', 'commentator', speak(cast, '形勢は互角。どちらも譲りませんね。', ha('互角。……どっちも引かない。', '……互角。どっちを持っても、指せる。'),
        'まあ非常に、えー拮抗しているというか。まあ、あと、大きなところでの対局が多いという印象が、ありますね。はい。'));
      if (yoshihikoBalanced) {
        line(at, 'move', 'commentator', 'え…');
        reactAll(at, 'castSo');
      }
    }
    // 中盤で大きく差がついた(気の早い視聴者)。
    if (at > plan.openingEnd && at <= plan.middleEnd && moverRate(rateAfter) >= 0.8 && once('bath')) maybe(0.7, at, 'move', 'bath');
    // 終盤に、形勢が大きく傾いた(1局に1回)。
    if (at > plan.middleEnd && swing <= -0.25 && once('taihen')) {
      line(at, 'move', 'host', 'あぁ～……');
      line(at, 'move', 'commentator', speak(cast, '……これは大変な局面になりました。', ha('……大変。', '……ここ、難しい。'), 'うーん……いやぁ、大変です。'));
    }

    // 局面の節目。
    // 27章: 序盤の終わりに差がついていたら「序盤は○○」。早く終盤になったら「もう終盤？」。
    if (at === plan.openingEnd && Math.abs(rateAfter - 0.5) >= 0.1) maybe(0.5, at, 'move', 'joban', { name: fan(rateAfter >= 0.5 ? 'black' : 'white') });
    // 終盤の始まりは筋書きで76〜96手目。早いほう(80手目まで)なら「もう終盤？」。
    if (at === plan.middleEnd && at <= 80) maybe(0.45, at, 'move', 'mouEnd');
    if (at === plan.openingEnd && once('middle')) {
      if (cast.voice === 'yoshihiko') line(at, 'move', 'host', 'この辺りは、いかがですか？');
      if (cast.voice === 'hanane') line(at, 'move', 'host', '羽音さん、ここはどう見る？');
      line(at, 'move', 'commentator', speak(cast, 'ここから中盤戦。両者、作戦の方向がはっきりしてきました。', ha('ここから中盤。……作戦が、はっきりしてきた。', '……ここから、読み合い。'),
        yo('まあ、そろそろ中盤という感じですかね。えぇ。', '方針は、まあ、だいたい見えてきたかな…という印象は、あるんですけど。')));
    }
    if (at === plan.middleEnd && once('ending')) {
      const lead = rateAfter >= 0.5 ? 'black' : 'white';
      const leadRate = Math.round((lead === 'black' ? rateAfter : 1 - rateAfter) * 100);
      line(at, 'move', 'commentator', speak(cast, `いよいよ終盤戦。勝率は${SIDE_NAME[lead]}${leadRate}%です。`, ha(`終盤。勝率は${SIDE_NAME[lead]}${leadRate}%。`, `……終盤。${SIDE_NAME[lead]}${leadRate}%。でも、まだ終わってない。`),
        yo(`まあ、ここからは終盤ですね。勝率は${SIDE_NAME[lead]}${leadRate}%と出てますけど。……数字ほどは、分かんないです。`, `いよいよ、という感じですね。えぇ。勝率は${SIDE_NAME[lead]}${leadRate}%ですか。`)));
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
      line(at, 'move', 'commentator', speak(cast, `${call(side)}、持ち時間を使い切りました。ここから1手60秒未満の秒読みです。`, ha(`${call(side)}、秒読み。……ここから、1手1分。`, `${call(side)}、時間が切れた。……でも、読めてるなら、関係ない。`),
        yo(`${call(side)}、秒読みですね。まあ、ここからは、あの、大変なんでは無いかな…`, `${call(side)}、1分将棋に入りました。……私も、苦手なんですよね、えぇ。`)));
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
        // 30章: 「昼飯は○○らしいよ」→「まだわかりません」→「あ、昼飯の話ではないです」(遅れて流れる掛け合い)。
        if (rest.kind === 'lunch' && rng.next() < 0.5) {
          comment(at, 'move', 'lunchMenu', { meal: pick(rng, [food.black, food.white]) });
          comment(at, 'move', 'lunchUnknown', {}, 1, '', { lag: 1300 });
          comment(at, 'move', 'lunchJoke', {}, 1, '', { lag: 2700 });
        }
        resumeAt = at + 1;
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
      // 30章: 2日目の朝の視聴者(封じ手が最善なら「最善と言われていた」、相手も予想していた)。
      comment(at, 'move', 'resume');
      maybe(0.6, at, 'move', 'unsealMorning', { move: bareMove(text) });
      if (!entry.best) maybe(0.6, at, 'move', 'unsealBest', { move: bareMove(text) });
      maybe(0.4, at, 'move', 'unsealGuess', { name: fan(other(side)) });
      maybe(0.5, at, 'move', 'day2');
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

    // ---- 30章: 二日制のタイトル戦の配信の例。盤・形勢・時刻・視聴者の数から言える条件で流し、名詞は差し替える。
    {
      const ending = at > plan.middleEnd;
      const opp = other(side);
      const moverNow = moverRate(rateAfter);
      const oppNow = 1 - moverNow;
      const moverEval = side === 'black' ? entry.eval : -entry.eval;
      /** 指した側の詰み(指す前から数えた手数)。詰みが読めていなければnull。 */
      const moverMate = isMateCp(moverEval) && moverEval > 0 ? MATE_CP - moverEval : null;
      const prevMover = side === 'black' ? previousEval : -previousEval;
      const boardBefore = parseSfenState(sfenBefore).board;
      const boardAfter = parseSfenState(sfenAfter).board;
      const lastTo = parseUsiMove(previousUsi)?.to ?? null;
      const bare = bareMove(text);
      /** 分身(プレイヤー自身の能力で戦う棋士)の手には、少しきつい言葉(ダメ・ミス・舐めプ)を出さない(27章と同じ)。 */
      const gentle = isYou(players[side]);

      // 視聴者の数の節目(1,000人・7,500人・1万人…)。
      const audienceNow = relayAudience(spec, at);
      const mark = AUDIENCE_MARKS.filter((n) => audienceShown < n && audienceNow >= n).at(-1);
      if (mark) {
        audienceShown = mark;
        comment(at, 'move', 'audience', { n: grouped(mark) });
        if (mark === 10000 || mark === 100000) comment(at, 'move', 'audienceBig', { word: mark === 10000 ? '一万人' : '十万人' }, 1, 'gold');
      }
      // 休憩のあとの再開、昼食の少し前、途中から来た人、天気。
      if (at === resumeAt) maybe(0.6, at, 'think', 'resume');
      if ((before.clock ?? 0) < lunchAt - 30 && (after.clock ?? 0) >= lunchAt - 30 && once('lunch-curious')) {
        maybe(0.6, at, 'move', 'lunchCurious', { name: fan(stronger ?? (rng.next() < 0.5 ? 'black' : 'white')) });
      }
      if (at >= 40 && !said.has('imakita') && rng.next() < 0.01 * density) { said.add('imakita'); comment(at, 'move', 'imakita'); }
      if (spec.weight === 'title' && !said.has('weather') && rng.next() < 0.01) { said.add('weather'); comment(at, 'move', 'weather'); }

      // 考慮中の予想(駒を打つ・同○○)。
      if (predicted && at >= 20) {
        const guess = bareMove(moveTextOf(sfenBefore, predicted, previousUsi));
        if (predicted.includes('*') && rng.next() < 0.06 * density) comment(at, 'think', 'dropGuess', { piece: PIECE_NAMES[predicted[0]] ?? '駒' });
        if (guess.startsWith('同') && !/[a-z*]/.test(guess) && rng.next() < 0.08 * density) comment(at, 'think', 'recaptureGuess', { move: guess });
      }
      // 勝ちが見えている側の考慮中(「さあ、正解を見せてください」)。負けが見えている側の考慮中(「○○までか」「時間稼いでる？」)。
      if (isMateCp(prevMover) && prevMover > 0 && once(`seikai:${side}`)) maybe(0.4, at, 'think', 'seikai');
      if (ending && moverRate(rateBefore) <= 0.05 && predicted) {
        const guess = bareMove(moveTextOf(sfenBefore, predicted, previousUsi));
        if (!/[a-z*]/.test(guess) && once('madaka')) maybe(0.25, at, 'think', 'madaka', { move: guess });
        if (entry.time >= 5 * 60 && once('jikan')) maybe(0.5, at, 'think', 'jikan');
      }

      // 直前に動いた相手の駒を取れるとき(取るしかない／取れない・同○○はダメ)。
      if (lastTo && at >= 30 && !isKingAttacked(boardBefore, side)) {
        const target = boardBefore.get(lastTo);
        const takers = target && target.color === opp && target.kind !== 'K' ? attackersOf(boardBefore, lastTo, side) : [];
        if (takers.length) {
          if (facts?.to === lastTo && facts.captured) {
            maybe(0.15, at, 'think', 'takeOnly');
            maybe(0.25, at, 'move', 'took');
          } else if (at >= 40 && !said.has('dou-dame') && rng.next() < 0.05) {
            // 取り返さなかった(1局に1回)。
            said.add('dou-dame');
            comment(at, 'think', 'douDame', { piece: PIECE_NAMES[takers[0].kind] ?? '' });
            comment(at, 'move', 'toreNai');
          }
        }
      }

      if (facts) {
        // 敵陣に飛び込んだ(取られる升へ)。負けている側なら「形作りにも見えるけど」。
        if (at >= 30 && !facts.kingMove && !facts.captured && relativeRank(facts.to, side) <= 3
          && attackersOf(boardAfter, facts.to, opp).length && once(`tsukkomi:${side}`) && rng.next() < 0.45 * density) {
          comment(at, 'move', 'tsukkomi', { move: bare.replace(/(打|成|不成)$/, '') });
          comment(at, 'move', 'bold', {}, rng.next() < 0.5 ? 2 : 1, '', { lag: 1200 });
          if (moverNow <= 0.2) comment(at, 'move', 'boldLosing', {}, 1, '', { lag: 2400 });
        }
        // 大駒を成られても平気(成った側がまだ苦しい)。
        if (facts.promote && (facts.after === '+B' || facts.after === '+R') && moverNow <= 0.45 && once(`uma-ok:${side}`)) {
          maybe(0.5, at, 'move', 'umaOk', { piece: PIECE_NAMES[facts.after] });
        }
        // 飛車が二度成った(「僕の飛車は……二度、“成る”」)。
        if (facts.promote && facts.after === '+R') {
          rookPromotions[side] += 1;
          if (rookPromotions[side] === 2 && once(`two-nari:${side}`)) {
            comment(at, 'move', 'twoNari', { name: fan(side) });
            comment(at, 'move', 'twoNariReply', {}, 1, '', { lag: 1500 });
          }
        }
        // と金ができた・香車が動いた(終盤の駒のせりふ)。
        if (facts.promote && facts.kind === 'P' && at > plan.openingEnd && once('tokin')) maybe(0.4, at, 'move', 'tokin', { move: bare.replace(/歩成$/, 'と') });
        if (ending && facts.kind === 'L' && once('kyo-deban')) maybe(0.4, at, 'move', 'kyoDeban');
        // 大駒で取り返した(終盤の「同飛車」)。取られる升なら、覚悟が決まりすぎ。
        if (ending && bare.startsWith('同') && MAJOR.has(facts.kind) && attackersOf(boardAfter, facts.to, opp).length && once('dou-hisha')) {
          comment(at, 'move', 'douHisha', { piece: PIECE_NAMES[facts.kind] });
          maybe(0.6, at, 'move', 'douHishaThink', { piece: PIECE_NAMES[facts.kind] });
        }
        // 玉で取り返した(強く同玉)。
        if (facts.kingMove && bare.startsWith('同') && once('kyosoku') && rng.next() < 0.6) {
          comment(at, 'move', 'kyosoku', { piece: '玉' });
          comment(at, 'move', 'kyosokuReply', { piece: '玉' }, 1, '', { lag: 1300 });
        }
        // 居玉への攻め・玉の前の歩のたたき・持ち駒が1枚だけ。
        const kingHome = opp === 'black' ? ['5i', 'K'] : ['5a', 'k'];
        if (at >= 30 && (facts.check || facts.nearEnemyKing) && pieceAt(sfenAfter, kingHome[0]) === kingHome[1] && once('igyoku')) maybe(0.5, at, 'move', 'igyoku');
        if (ending && facts.drop && facts.kind === 'P' && facts.nearEnemyKing && once('tataki')) maybe(0.5, at, 'move', 'tataki');
        // 取られた飛車が、もとの持ち主の玉に向かう(飛車の謀反)。
        if (ending && facts.drop && facts.kind === 'R' && (facts.check || facts.nearEnemyKing) && once('muhon')) maybe(0.5, at, 'move', 'muhon');
        const hand = handPieces(sfenAfter, side);
        if (ending && hand.length === 1 && hand[0].count === 1 && once('hand-only')) maybe(0.4, at, 'move', 'handOnly', { piece: PIECE_NAMES[hand[0].kind] });
        // 負けが見えている側の王手(思い出王手)。
        if (facts.check && moverNow <= 0.05 && once('omoide')) maybe(0.7, at, 'move', 'omoide');
        // 終盤の静かな好手(じっと○○)。
        if (ending && moverNow >= 0.7 && !facts.check && !facts.captured && !facts.drop && !entry.loss && once('jitto')) maybe(0.25, at, 'move', 'jitto', { move: bare });
        // 勝ちに向かう駒(○○がきておわりか)。
        if (ending && oppNow <= 0.1 && facts.nearEnemyKing && ['N', 'S', 'G'].includes(facts.kind) && once('owari-piece')) maybe(0.4, at, 'move', 'owariPiece', { piece: PIECE_NAMES[facts.kind] });
      }

      // 予想と違う手(「○○なんだ」「ん？」「おや」)。
      if (predictedAt === at && entry.move !== predicted && (entry.loss ?? 0) < 150) {
        maybe(0.3, at, 'move', 'nanda', { move: bare });
        if (ending) maybe(0.3, at, 'move', 'hmm');
      }
      if (entry.mark === 'only') maybe(0.4, at, 'move', 'miseru');

      // 悪手の種類(打った手・手番を渡した手)、秒読みのミス。
      if (entry.mark === 'error' || entry.mark === 'decisive') {
        if (facts?.drop && !gentle) maybe(0.5, at, 'move', 'dameDrop', { move: bare });
        else if (facts && !facts.captured && !facts.check) maybe(0.4, at, 'move', 'teban', { move: bare });
        if (before.byoyomi[side] && !gentle) maybe(0.6, at, 'move', 'byoMiss');
      }
      if (swing <= -0.25) {
        maybe(0.3, at, 'move', 'muzukashii');
        if (!said.has('yonaga') && rng.next() < 0.05) { said.add('yonaga'); comment(at, 'move', 'yonaga'); }
      }
      // 中盤の形勢(どっちを持ちたいか・良く見える・格上が苦しい・駒割りと評価値の食い違い)。
      if (at > plan.openingEnd && at <= plan.middleEnd) {
        const lead = rateAfter >= 0.5 ? 'black' : 'white';
        const leadRate = lead === 'black' ? rateAfter : 1 - rateAfter;
        if (leadRate >= 0.6 && once('mochi')) {
          comment(at, 'move', 'mochi', { side: SIDE_NAME[lead] });
          maybe(0.6, at, 'move', 'mochiOther', { side: SIDE_NAME[other(lead)] });
          if (leadRate < 0.7) maybe(0.4, at, 'move', 'mochiNeither');
        }
        if (leadRate >= 0.62 && once('look-good')) {
          maybe(0.5, at, 'move', 'lookGood', { side: SIDE_NAME[lead] });
          if (stronger === other(lead)) maybe(0.7, at, 'move', 'starBehind', { name: fan(stronger), side: SIDE_NAME[stronger] });
        }
        if (at >= 30 && facts?.captured && !said.has('layman-doubt')) {
          const { lead: materialLead } = materialText(sfenAfter);
          const materialRate = materialLead === 'black' ? rateAfter : materialLead === 'white' ? 1 - rateAfter : 1;
          if (materialLead && materialRate <= 0.5 && rng.next() < 0.4) {
            said.add('layman-doubt');
            comment(at, 'move', 'laymanDoubt', { side: SIDE_NAME[other(materialLead)] });
          }
        }
        // 格上(物語の人物か、強さの差200以上)が苦しい(焦っている)。
        if (stronger && (stronger === 'black' ? rateAfter : 1 - rateAfter) <= 0.35 && once('aseri')) {
          maybe(0.6, at, 'move', 'aseri', { full: players[stronger]?.name ?? '', name: givenName(stronger) });
        }
      }
      // 長考(大事な場面・天井を見た・前髪)。
      if (entry.time >= LONG_THINK_SECONDS && at > plan.openingEnd) {
        maybe(0.3, at, 'think', 'longImportant');
        if (spec.weight !== 'plain' && once('maegami')) maybe(0.15, at, 'think', 'maegami', { name: fan(side) });
      }
      // 長い熱戦で互角(昔の激戦を思い出す)。
      if (at >= 100 && Math.abs(rateAfter - 0.5) < 0.1 && spec.weight !== 'plain' && once('legend')) maybe(0.5, at, 'move', 'legend', { pair: pick(rng, LEGEND_PAIRS) });

      // 形勢の入れ替わり(優勢の側の並び。65%と35%で区切る)。
      const nowLeader = rateAfter >= 0.65 ? 'black' : rateAfter <= 0.35 ? 'white' : null;
      if (nowLeader && leaders.at(-1) !== nowLeader) leaders.push(nowLeader);
      // 終盤の形勢の言葉。
      if (ending) {
        if (moverNow >= 0.9 && once('shousei')) maybe(0.5, at, 'move', 'shousei', { side: SIDE_NAME[side] });
        if (Math.max(rateAfter, 1 - rateAfter) >= 0.8 && once('docchi')) maybe(0.25, at, 'move', 'docchi', { side: SIDE_NAME[rateAfter >= 0.5 ? 'black' : 'white'] });
        if (Math.abs(rateAfter - 0.5) < 0.1 && once('unclear')) maybe(0.5, at, 'move', 'unclear');
        if (facts?.check && oppNow >= 0.2 && oppNow <= 0.4 && once('still-chance')) maybe(0.5, at, 'move', 'stillChance', { name: fan(opp) });
        if (moverRate(rateBefore) <= 0.4 && moverNow >= 0.55) maybe(0.5, at, 'move', 'magic');
        if (oppNow >= 0.15 && oppNow <= 0.4) maybe(0.1, at, 'move', 'nebare');
        if (lastCheckAt[opp] === at - 1 && moverNow >= 0.15 && moverNow <= 0.5) maybe(0.3, at, 'move', 'taeru');
        if (after.byoyomi.black && after.byoyomi.white && Math.max(rateAfter, 1 - rateAfter) >= 0.8 && once('byo-risk')) maybe(0.4, at, 'move', 'byoRisk');
        if ((after.remaining[side] ?? 0) >= 3600 && after.byoyomi[opp] && once('ocha')) maybe(0.5, at, 'move', 'ocha');
        if (moverNow >= 0.85 && !entry.loss) maybe(0.12, at, 'move', 'yomikiri');
        if (moverNow >= 0.9 && entry.mark === 'slip' && (entry.loss ?? 0) >= 100 && !gentle && once('namepu')) maybe(0.4, at, 'move', 'namepu', { name: fan(side) });
        bestRun[side] = entry.loss ? 0 : bestRun[side] + 1;
        if (bestRun[side] === 8 && once('saizen')) comment(at, 'move', 'saizen');
        // 負けが見えてきた(相手の勝率10%以下)。投げどころ・詰みまで指す人・楽しそう。
        // 決着が見えたあとの一言(終わり・投了ある・投げきれない)は、続けて言わない(10手あける)。投了が遅い人(29章)では長く続くため。
        const settled = (pool, p) => {
          if (at - settledAt < 10 || rng.next() >= Math.min(0.95, p * density)) return;
          settledAt = at;
          comment(at, 'move', pool);
        };
        if (oppNow <= 0.1) settled('owari', 0.15);
        if (oppNow <= 0.03 && !(last && end)) {
          settled('toryoAru', 0.15);
          if (once('nage-dokoro')) maybe(0.3, at, 'move', 'nageDokoro', { move: bare });
          const line3 = pvTextOf(sfenAfter, entry.pv, entry.move, 3).replace(/[▲△]/g, '').split(' → ').join('　');
          if (line3 && once('nage-line')) maybe(0.3, at, 'move', 'nageLine', { line: line3 });
          const style = resignStyleOf(players[opp]).id;
          if ((style === 'full' || style === 'stubborn') && once('ryu')) {
            maybe(0.6, at, 'move', 'ryu', { name: fan(opp) });
            maybe(0.3, at, 'move', 'tanoshi', { name: fan(opp) });
          }
          settled('nageNai', 0.08);
          // 番勝負で、挑戦者があと1敗で防衛を許す局(角番)。
          const series = spec.series;
          if (series && opp !== series.holder && series.wins[series.holder] === series.need - 1 && once('boei')) maybe(0.6, at, 'move', 'boei');
        }
      }
      // 詰み(詰めろ・必死・1手詰・詰んでる・分からん)。
      if (moverMate !== null) {
        if (firstMate === null) {
          firstMate = { move: bare, at };
          maybe(0.5, at, 'move', 'tsunderu');
          if (moverMate >= 9 && once('wakaran')) {
            comment(at, 'move', 'wakaran');
            comment(at, 'move', 'wakaranReply', {}, 1, '', { lag: 1300 });
          }
        }
        if (!facts?.check) {
          if (once('tsumero')) maybe(0.6, at, 'move', 'tsumero');
          else if (once('hisshi')) maybe(0.5, at, 'move', 'hisshi', { move: bare });
        }
        if (moverMate === 3 && once('ippute')) maybe(0.6, at, 'move', 'ippute');
        if (entry.time >= 60 && once('sokuuchi')) {
          comment(at, 'think', 'sokuuchi', { name: fan(side) });
          comment(at, 'think', 'sokuuchiReply', {}, 1, '', { lag: 1300 });
        }
      }
      // いちばんの悪手と、鋭い一手(終局のふり返りで使う)。
      if ((entry.loss ?? 0) > (worstMove[side]?.loss ?? 0)) worstMove[side] = { loss: entry.loss, move: bare, at };
      if (entry.mark === 'only') sharpMove[side] = bare;

      // 終局のふり返り(大逆転・転機・惜しかった一手・名局・無念)。
      if (last && end) {
        const loser = other(end.winner);
        if (leaders.length >= 4 && leaders.at(-1) === end.winner && once('lead-chain')) {
          comment(at, 'move', 'leadChain', { a: fan(leaders.at(-4)), b: fan(leaders.at(-3)) });
        }
        if (leaders.length >= 3 || spec.how === 'comeback') comment(at, 'move', 'reversal', { side: SIDE_NAME[end.winner] }, 2);
        if (at >= 120 || leaders.length >= 3) comment(at, 'move', 'endPraise', {}, rng.next() < 0.5 ? 2 : 1);
        comment(at, 'move', 'endBye', {}, 2);
        const worst = worstMove[loser];
        if (worst && worst.loss >= 300) maybe(0.6, at, 'move', 'turning', { move: worst.move });
        if (sharpMove[loser]) maybe(0.6, at, 'move', 'wasted', { move: sharpMove[loser] });
        if (firstMate && at - firstMate.at >= 6) maybe(0.4, at, 'move', 'owatteta', { move: firstMate.move });
        if (spec.weight !== 'plain') maybe(0.5, at, 'move', 'munen', { given: givenName(loser) });
        if (worst && worst.at > plan.middleEnd && !isYou(players[loser]) && (star(loser) || (players[loser]?.rating ?? 0) >= 1700)) maybe(0.6, at, 'move', 'yoseMiss', { name: fan(loser) });
        if (spec.kind === 'finals' && players[loser]?.story === YOSHIHIKO) comment(at, 'move', 'beatLegend', { name: fan(end.winner) });
      }
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
        const plies = mateStreak(checks.slice(0, at));
        line(at, 'move', 'host', plies
          ? `詰みました！ 最後は${plies}手詰め、${call(end.winner)}が寄せ切りました！ ${at}手まで、${players[end.winner].name}${players[end.winner].dan}の勝ち！`
          : `詰みました！ ${at}手まで、${players[end.winner].name}${players[end.winner].dan}の勝ち！`);
        endMate = plies;
      }
      think(at, 'move', end.winner, 'win');
      const how = HOW_LABELS[spec.how];
      if (how) {
        line(at, 'move', 'commentator', speak(cast, `${call(end.winner)}が、${how}一局でした。`, ha(`${call(end.winner)}が、${how}一局。`, `……${how}。${call(end.winner)}の将棋だった。`),
          yo(`まあ、${call(end.winner)}らしい、${how}一局だったという印象ですね。はい。`, `${call(end.winner)}が、${how}一局でしたね。えぇ、ええ。`)));
      }
      // 聞き手が一局をふり返ってたずね、解説者が答え、聞き手がお礼を言う(25章)。
      line(at, 'move', 'host', cast.voice === 'yoshihiko' ? 'この一局振り返っていかがだったでしょうか。' : 'この一局、ふり返ってどうだった？');
      line(at, 'move', 'commentator', cast.voice === 'yoshihiko' && players[end.winner]?.story === HANANE
        ? 'まあ、あの……強くなったな、という感じは、ありますね。……いや、すみません。はい。'
        : speak(cast, '最後まで見ごたえのある将棋でした。', ha('最後まで見ごたえのある将棋だった。', '……いい将棋だった。私も、指してみたい。'),
          '出だしから意外な将棋でしたけど、まあ、あのー、大熱戦だったと、思います。はい。'));
      line(at, 'move', 'host', cast.voice === 'yoshihiko' ? 'はい、どうもありがとうございました。' : 'ありがとうございました！');
      if (cast.voice === 'yoshihiko' && players[end.winner]?.story !== HANANE) reactAll(at, 'castIgai');
      cards.push({ at, when: 'move', kind: 'end', tier: spec.weight === 'title' ? 'gold' : '', title: `${at}手まで ${SIDE_NAME[end.winner]}の勝ち`, text: end.reason === 'resign' ? `${players[loser].name}の投了` : endMate ? `${endMate}手詰め` : '詰み' });
      comment(at, 'move', 'resign', {}, 5, spec.weight === 'title' ? 'gold' : '');
      hype(at, spec.weight === 'title' ? 3 : 2, spec.weight === 'title' ? 'gold' : '');
      official(at, 'move', `【終局】${at}手で${players[end.winner].name}${players[end.winner].dan}の勝ち`);
      comment(at, 'move', 'winner', { name: call(end.winner).replace(/さん$/, '') }, 2);
      comment(at, 'move', end.reason === 'resign' ? 'toryo' : 'mateEnd', { at });
      comment(at, 'move', 'endGag');
      if (end.reason === 'resign') maybe(0.4, at, 'move', 'loserVoice');
      // 投了の早さ(29章)。詰みまで指した人は解説者が一言添え、潔い人・粘る人には視聴者が反応する。
      const loserStyle = resignStyleOf(players[loser]);
      const loserName = call(loser).replace(/さん$/, '');
      if (end.reason === 'mate' && loserStyle.id === 'full') {
        line(at, 'move', 'commentator', speak(cast, `${call(loser)}は、最後まで指す棋士なんです。`, ha(`${call(loser)}は、最後まで指す人。……そういうの、嫌いじゃない。`, `${call(loser)}は、投げない。……最後まで。`),
          `${call(loser)}は、最後まで指すんですよね。まあ、それも一つの、あのー、美学かと。`));
        comment(at, 'move', 'fullMate', { name: loserName });
      } else if (end.reason === 'resign' && loserStyle.id === 'clean') {
        comment(at, 'move', 'cleanResign', { name: loserName });
      } else if (end.reason === 'resign' && loserStyle.id === 'stubborn') {
        comment(at, 'move', 'stubbornResign', { name: loserName });
      }
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
