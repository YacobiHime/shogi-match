// 棋力スカウター(docs/power-scouter-design.md)。大会の次の相手の「戦闘力」を測り、自分と比べる。画面に依存しない。
// 戦闘力は、CPUのLv(大会の世界の物差し)を、勝ちやすさの比になる数にしたもの。
// プレイヤーのレーティングは1Lv=60点のイロ式(player-rating.mjs)なので、10^(Lv×60/400)を戦闘力にすると、
// 2人の戦闘力の比が、そのまま勝ちやすさの比になる(勝つ見込み = 自分 ÷ (自分 + 相手))。

/** 1Lvのレーティングの幅(player-rating.mjsのRATING_PER_LEVELと同じ)。 */
export const SCOUTER_RATING_PER_LEVEL = 60;
/** Lv0の戦闘力(はじめたばかりでも数百、Lv20で約50万、Lv49で約100億)。 */
export const SCOUTER_BASE = 500;
/** 1Lv上がると何倍になるか(約1.41倍。2Lvで約2倍)。 */
export const SCOUTER_GROWTH = 10 ** (SCOUTER_RATING_PER_LEVEL / 400);
/** 相手がこれだけ上回ると、レンズにひびが入る(計測の限界)。 */
export const SCOUTER_CRACK_RATIO = 10;

const finite = (value) => typeof value === 'number' && Number.isFinite(value);

/**
 * Lvから戦闘力。Lvは小数でもよい(世界の物差しのLv)。
 * @param {number} level
 */
export function battlePower(level) {
  if (!finite(level)) return null;
  return Math.max(1, Math.round(SCOUTER_BASE * SCOUTER_GROWTH ** Math.max(0, level)));
}

/** 数の見せ方(1万以上は「12万3400」のように万・億を使う)。 */
export function powerText(power) {
  if (!finite(power)) return '???';
  const value = Math.round(power);
  if (value >= 1e8) {
    const oku = Math.floor(value / 1e8);
    const man = Math.floor((value % 1e8) / 1e4);
    return man ? `${oku}億${man}万` : `${oku}億`;
  }
  if (value >= 1e4) {
    const man = Math.floor(value / 1e4);
    const rest = value % 1e4;
    return rest ? `${man}万${rest}` : `${man}万`;
  }
  return String(value);
}

/**
 * やこび姫の見立ての段(相手の戦闘力 ÷ 自分の戦闘力)。
 * @param {number} ratio
 * @returns {'beyond' | 'much' | 'above' | 'even' | 'below' | 'far-below'}
 */
export function scouterGrade(ratio) {
  if (!finite(ratio)) return 'even';
  if (ratio >= SCOUTER_CRACK_RATIO) return 'beyond';
  if (ratio >= 2) return 'much';
  if (ratio >= 1.25) return 'above';
  if (ratio > 0.8) return 'even';
  if (ratio > 0.4) return 'below';
  return 'far-below';
}

/** 段ごとの札の言葉と、やこび姫の一言。 */
export const SCOUTER_TEXT = Object.freeze({
  beyond: Object.freeze({ tag: '計測の限界', line: 'け、桁が違う……！ でも将棋は一手で逆転できるよ。相手の読みにない手を探そう！' }),
  much: Object.freeze({ tag: '格上', line: 'かなりの格上だね。無理に攻めず、じっくり指して相手のミスを待とう！' }),
  above: Object.freeze({ tag: 'やや格上', line: '少し相手のほうが上だね。序盤で互角を保てば、十分に戦えるよ！' }),
  even: Object.freeze({ tag: '互角', line: 'ほぼ互角！ 勝負は最後の一手まで分からないよ。' }),
  below: Object.freeze({ tag: 'やや格下', line: 'あなたのほうが少し上だよ。油断せず、いつもどおり指そう！' }),
  'far-below': Object.freeze({ tag: '格下', line: 'あなたのほうがずっと上だね。でも油断は禁物。最後まで丁寧に！' }),
});

/**
 * 測った結果。opponentLevelは相手のLv(期の世界の物差し)、userLevelは自分のLv(レーティングから)。
 * @param {{ opponentLevel: number, userLevel: number }} options
 */
export function scoutReading({ opponentLevel, userLevel }) {
  const opponent = battlePower(opponentLevel);
  const you = battlePower(userLevel);
  if (!opponent || !you) return null;
  const ratio = opponent / you;
  const grade = scouterGrade(ratio);
  return {
    opponent,
    you,
    ratio,
    // 勝つ見込み(戦闘力の比が勝ちやすさの比)。1%〜99%に収める。
    winChance: Math.min(99, Math.max(1, Math.round((you / (you + opponent)) * 100))),
    // 綱引きの棒で、自分の側の割合(0〜1)。
    share: you / (you + opponent),
    grade,
    crack: grade === 'beyond',
    tag: SCOUTER_TEXT[grade].tag,
    line: SCOUTER_TEXT[grade].line,
  };
}

/**
 * 測っているあいだの数の進み(0〜1の進みから、表示する数)。はじめはでたらめに跳ね、だんだん本当の数に寄る。
 * @param {number} target
 * @param {number} progress 0〜1
 * @param {number} noise 0〜1の乱数
 */
export function rollingPower(target, progress, noise) {
  if (!finite(target)) return 0;
  const p = Math.min(1, Math.max(0, progress));
  if (p >= 1) return target;
  // 対数で寄せる(小さな数から桁が上がっていくように見える)。
  const settled = Math.exp(Math.log(Math.max(1, target)) * p);
  const jitter = 1 + (noise - 0.5) * 0.6 * (1 - p);
  return Math.max(1, Math.round(settled * jitter));
}
