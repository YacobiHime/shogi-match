// 大会(竜王戦・名人戦)の期の終わりの表彰式で渡す賞状と、賞状帳(これまでの賞状)の保存。
// 設計は docs/season-award-design.md。賞状は縦書きで見せるので、数字は漢数字にして返す。

export const AWARDS_KEY = 'yacobihime:shogi-match:awards';
const MAX_AWARDS = 200;

/** 賞状の格。金(タイトル)・銀(タイトル戦に出た)・朱(優勝・昇級・進出)・敢闘(それ以外。最後まで戦ったことをたたえる)。 */
export const AWARD_GRADES = Object.freeze(['gold', 'silver', 'red', 'fight']);

const DIGITS = '〇一二三四五六七八九';

/** 整数を漢数字に(1〜9999。十・百・千の位取り。0は〇)。 */
export function kanjiNumber(value) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 0) return String(value);
  if (n === 0) return DIGITS[0];
  if (n >= 10000) return String(n).split('').map((digit) => DIGITS[Number(digit)]).join('');
  let text = '';
  const units = [[1000, '千'], [100, '百'], [10, '十']];
  let rest = n;
  for (const [unit, label] of units) {
    const digit = Math.floor(rest / unit);
    if (digit) text += (digit === 1 ? '' : DIGITS[digit]) + label;
    rest %= unit;
  }
  if (rest) text += DIGITS[rest];
  return text;
}

/** 文の中の数字を漢数字に。 */
export const kanjiText = (text) => String(text ?? '').replace(/\d+/g, (digits) => kanjiNumber(Number(digits)));

/** 日付を賞状の書き方に(年は一字ずつ、例: 二〇二六年十月二十二日)。 */
export function kanjiDate(at) {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return '';
  const year = String(date.getFullYear()).split('').map((digit) => DIGITS[Number(digit)]).join('');
  return `${year}年${kanjiNumber(date.getMonth() + 1)}月${kanjiNumber(date.getDate())}日`;
}

const record = (wins, losses) => `${wins}勝${losses}敗`;

/**
 * 竜王戦の期の賞状。
 * @param {{ no: number, mode: string, result: { outcome: string, startGroup: number, newGroup: number, promoted?: boolean, wins: number, losses: number, path?: { stage: string, text: string }[] } }} season 終わった期
 * @param {{ playerName?: string, at?: number }} [options]
 */
export function ryuoAward(season, { playerName = 'あなた', at = Date.now() } = {}) {
  const result = season.result;
  const group = `${result.startGroup}組`;
  const ranking = result.path?.find((step) => step.stage === 'ranking');
  const defense = season.mode === 'defense';
  /** @type {{ grade: string, prize: string }} */
  let rank;
  switch (result.outcome) {
    case 'champion': rank = { grade: 'gold', prize: defense ? '竜王防衛' : '竜王獲得' }; break;
    case 'defense-lost': rank = { grade: 'silver', prize: '竜王戦七番勝負 出場' }; break;
    case 'finals-lost': rank = { grade: 'silver', prize: '竜王挑戦' }; break;
    case 'playoff-lost': rank = { grade: 'red', prize: '挑戦者決定三番勝負 進出' }; break;
    case 'main-out': rank = { grade: 'red', prize: '決勝トーナメント 進出' }; break;
    default:
      if (ranking?.text === '優勝') rank = { grade: 'red', prize: `${group} 優勝` };
      else if (ranking?.text?.startsWith('準優勝')) rank = { grade: 'red', prize: `${group} 準優勝` };
      else if (result.promoted) rank = { grade: 'red', prize: `${group} 昇級` };
      else rank = { grade: 'fight', prize: `${group}ランキング戦 出場` };
  }
  // 昇級は、組の賞(朱・敢闘)にだけ添える(竜王・挑戦者は1組に入るので、書かなくてよい)。
  const notes = result.promoted && (rank.grade === 'red' || rank.grade === 'fight') && !rank.prize.endsWith('昇級') ? [`${result.newGroup}組へ昇級`] : [];
  return makeAward({
    tournament: 'ryuo', name: '竜王戦', seal: '竜', no: season.no, ...rank, notes,
    entry: defense ? '竜王' : `${group}ランキング戦`, wins: result.wins, losses: result.losses, playerName, at,
  });
}

/**
 * 名人戦(順位戦)の期の賞状。
 * @param {{ no: number, mode?: string, cls: string, result: { cls: string, outcome: string, wins: number, losses: number, place: number | null } }} season 終わった期
 * @param {{ playerName?: string, at?: number, classLabels: Record<string, string>, nextClass?: string | null }} options
 */
export function meijinAward(season, { playerName = 'あなた', at = Date.now(), classLabels, nextClass = null }) {
  const result = season.result;
  const cls = classLabels[result.cls] ?? '';
  /** @type {{ grade: string, prize: string }} */
  let rank;
  switch (result.outcome) {
    case 'meijin': rank = { grade: 'gold', prize: '名人獲得' }; break;
    case 'defend': rank = { grade: 'gold', prize: '名人防衛' }; break;
    case 'challenger': rank = { grade: 'silver', prize: '名人挑戦' }; break;
    case 'lost-title': rank = { grade: 'silver', prize: '名人戦七番勝負 出場' }; break;
    case 'promote': rank = { grade: 'red', prize: `${cls}順位戦 ${result.place ?? ''}位`.replace(/ 位$/, '') }; break;
    default: rank = { grade: 'fight', prize: `${cls}順位戦 出場` };
  }
  const notes = result.outcome === 'promote' && nextClass && classLabels[nextClass] ? [`${classLabels[nextClass]}へ昇級`] : [];
  return makeAward({
    tournament: 'meijin', name: '名人戦', seal: '名', no: season.no, ...rank, notes,
    entry: season.mode === 'defense' ? '名人' : `${cls}順位戦`, wins: result.wins, losses: result.losses, playerName, at,
  });
}

/** @param {{ tournament: string, name: string, seal: string, no: number, grade: string, prize: string, notes: string[], entry: string, wins: number, losses: number, playerName: string, at: number }} fields */
function makeAward(fields) {
  return {
    id: `${fields.tournament}-${fields.no}`,
    tournament: fields.tournament,
    name: fields.name,
    seal: fields.seal,
    no: fields.no,
    grade: fields.grade,
    prize: fields.prize,
    notes: fields.notes,
    entry: fields.entry,
    wins: fields.wins,
    losses: fields.losses,
    playerName: fields.playerName || 'あなた',
    at: fields.at,
  };
}

/**
 * 賞状に書く文(縦書き。数字は漢数字)。
 * @param {ReturnType<typeof makeAward>} award
 */
export function awardText(award) {
  const fight = award.grade === 'fight';
  const title = `第${award.no}期${award.name}`;
  const games = record(award.wins, award.losses);
  const body = fight
    ? `あなたは${title}の${award.entry}に出場し、${games}の成績で、最後まで力を尽くして戦いました。その健闘をたたえ、ここに賞します。`
    : `あなたは${title}において、${games}のすばらしい成績を収め、頭書の栄誉を得られました。よってここに、これを賞します。`;
  return {
    heading: fight ? '敢闘賞' : '賞状',
    title: kanjiText(title),
    prize: kanjiText(award.prize),
    notes: award.notes.map(kanjiText),
    name: `${award.playerName} 殿`,
    body: kanjiText(body),
    date: kanjiDate(award.at),
  };
}

/** 表彰式で、やこび姫が言うひとこと(どの格でも、まず「おつかれさま」。負けを責めない)。 */
export function awardTalk(award) {
  const head = `第${award.no}期、おつかれさま！`;
  switch (award.grade) {
    case 'gold': return `${head} ${award.prize.replace(/ /g, '')}、ほんとうにおめでとう！`;
    case 'silver': return `${head} タイトル戦の大舞台、かっこよかったよ`;
    case 'red': return `${head} ${award.prize.replace(/ /g, '')}、よくがんばったね`;
    default: return `${head} 勝った対局も負けた対局も、ぜんぶ次の力になるよ`;
  }
}

/** 賞状帳の1行(横書き。例: 「第2期 竜王戦 5組 優勝」)。 */
export const awardLine = (award) => `第${award.no}期 ${award.name} ${award.prize}`;

const validAward = (award) => award && typeof award === 'object'
  && typeof award.id === 'string' && Number.isFinite(award.no) && AWARD_GRADES.includes(award.grade)
  && typeof award.prize === 'string' && typeof award.name === 'string' && Array.isArray(award.notes);

/** 賞状帳(古い順)。 */
export function loadAwards(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(AWARDS_KEY) ?? 'null');
    return Array.isArray(parsed) ? parsed.filter(validAward) : [];
  } catch {
    return [];
  }
}

/** 賞状を賞状帳に足す。同じ大会の同じ期は1枚だけ(先にあるほうを残す)。足したあとの賞状帳を返す。 */
export function addAward(storage, award) {
  const awards = loadAwards(storage);
  if (awards.some((item) => item.id === award.id)) return awards;
  const next = [...awards, award].slice(-MAX_AWARDS);
  try {
    storage?.setItem(AWARDS_KEY, JSON.stringify(next));
  } catch {
    // 保存できない環境では、その場かぎり。
  }
  return next;
}
