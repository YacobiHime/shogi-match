import { describe, expect, it } from 'vitest';
import {
  insightPraise,
  meaningAdvice,
  missedChanceAdvice,
  moveMeaning,
  opponentSlipAdvice,
  selfMatePraise,
  weaknessOvercomeLine,
  weaknessReminder,
} from './coach-insight.mjs';
import { coachAdvicePriority } from './coach-advice-scheduler.mjs';

const cp = (value) => ({ type: 'cp', value });
const mate = (value) => ({ type: 'mate', value });

describe('N1 最善手の翻訳', () => {
  it('タダで取る手と、取り返される取り合いを見分ける', () => {
    expect(moveMeaning('4k4/9/9/9/4s4/9/9/9/4R3K b - 1', '5i5e')).toEqual({ kind: 'free-capture', captured: 'S', square: '5e' });
    expect(moveMeaning('4k4/9/9/4g4/4s4/9/9/9/4R3K b - 1', '5i5e')?.kind).toBe('capture');
  });

  it('後手の手も、後手から見て同じように見分ける', () => {
    expect(moveMeaning('k3r4/9/9/9/4S4/9/9/9/4K4 w - 1', '5a5e')).toEqual({ kind: 'free-capture', captured: 'S', square: '5e' });
  });

  it('王手・打つ・逃げる・守る', () => {
    expect(moveMeaning('4k4/9/9/9/9/9/9/9/K2R5 b - 1', '6i5i')?.kind).toBe('check');
    expect(moveMeaning('8k/9/9/9/9/9/9/9/K8 b P 1', 'P*5e')).toEqual({ kind: 'drop', piece: 'P' });
    expect(moveMeaning('k8/9/9/9/4S3r/9/9/9/K8 b - 1', '5e6d')).toEqual({ kind: 'escape', piece: 'S' });
    expect(moveMeaning('k8/9/9/9/9/9/9/9/4K4 b - 1', '5i4h')).toEqual({ kind: 'defend', piece: 'K' });
  });

  it('手筋の形は名前で言う(ふんどしの桂)', () => {
    const meaning = moveMeaning('k8/9/9/3r1g3/9/9/9/9/K8 b N 1', 'N*5f');
    expect(meaning).toEqual({ kind: 'tesuji', tesuji: 'knight-fork' });
    expect(meaningAdvice(meaning)?.text).toContain('ふんどしの桂');
  });

  it('台詞は答えの手を言わず、評価の崖と同じ優先度にする', () => {
    const advice = meaningAdvice(moveMeaning('4k4/9/9/9/4s4/9/9/9/4R3K b - 1', '5i5e'));
    expect(advice?.text).toBe('タダで取れる駒があるよ！ 探してみて');
    expect(advice?.text).not.toMatch(/5五|5e/);
    expect(coachAdvicePriority(advice)).toBe(70);
    expect(meaningAdvice(null)).toBeNull();
  });
});

describe('N4 見逃し', () => {
  it('指す前にあった詰みを逃したら、王手の連続かで言い分けて知らせる', () => {
    const sfen = '4k4/9/4P4/9/9/9/9/9/4K4 b RG 1';
    expect(missedChanceAdvice({
      sfenBefore: sfen, playedUsi: '5i4h', before: mate(3), after: cp(1500), beforePv: ['R*5b', '5a6a', 'G*7b'],
    })?.text).toBe('いま、3手詰めがあったよ！ 次は王手の続く手から探してみよう');
    expect(missedChanceAdvice({
      sfenBefore: sfen, playedUsi: '5i4h', before: mate(3), after: cp(1500), beforePv: ['5i4h'],
    })?.text).toContain('3手で詰ませる手順');
    // 別の詰み筋で詰ませ続けているなら、見逃しではない。
    expect(missedChanceAdvice({ sfenBefore: sfen, playedUsi: 'G*5b', before: mate(3), after: mate(1), beforePv: [] })).toBeNull();
  });

  it('タダで取れた銀以上の駒を逃したときだけ、どの駒だったかを言う', () => {
    const sfen = '4k4/9/9/9/4s4/9/9/9/4R3K b - 1';
    const missed = missedChanceAdvice({ sfenBefore: sfen, playedUsi: '1i2i', before: cp(800), after: cp(100), beforePv: ['5i5e'] });
    expect(missed?.text).toBe('△5五の銀がタダで取れたよ。次は、取れる駒がないか先に探してみよう！');
    expect(coachAdvicePriority(missed)).toBe(90);
    // 損が小さい・最善手を指した・取れるのが歩なら言わない。
    expect(missedChanceAdvice({ sfenBefore: sfen, playedUsi: '1i2i', before: cp(800), after: cp(700), beforePv: ['5i5e'] })).toBeNull();
    expect(missedChanceAdvice({ sfenBefore: sfen, playedUsi: '5i5e', before: cp(800), after: cp(100), beforePv: ['5i5e'] })).toBeNull();
    expect(missedChanceAdvice({
      sfenBefore: '4k4/9/9/9/4p4/9/9/9/4R3K b - 1', playedUsi: '1i2i', before: cp(500), after: cp(100), beforePv: ['5i5e'],
    })).toBeNull();
  });
});

describe('N5 相手のミス', () => {
  it('CPUが読みの最善より300点以上悪い手を指したら、チャンスと言う', () => {
    expect(opponentSlipAdvice({ best: cp(200), selected: cp(-200) })?.key).toBe('chance-opponent-slip');
    expect(opponentSlipAdvice({ best: cp(200), selected: cp(0) })).toBeNull();
    expect(coachAdvicePriority({ key: 'chance-opponent-slip' })).toBe(75);
  });

  it('次の一手で駒が取れるなら「駒が浮いた」と言う(手は言わない)', () => {
    const advice = opponentSlipAdvice({
      best: cp(100), selected: cp(-500), sfenAfter: '4k4/9/9/9/4s4/9/9/9/4R3K b - 1', reply: '5i5e',
    });
    expect(advice?.key).toBe('chance-opponent-loose');
    expect(advice?.text).not.toMatch(/5五/);
  });

  it('相手が詰みを逃したら知らせ、大差で負けているときや詰みの絡む差は言わない', () => {
    expect(opponentSlipAdvice({ best: mate(5), selected: cp(800) })?.key).toBe('chance-escaped-mate');
    expect(opponentSlipAdvice({ best: cp(3000), selected: cp(1500) })).toBeNull();
    expect(opponentSlipAdvice({ best: cp(100), selected: mate(-3) })).toBeNull();
  });
});

describe('N8 弱点の記憶', () => {
  it('いちばん上の弱点を、前に言ってから3局たってから言う', () => {
    const weaknesses = [{ kind: 'mate' }, { kind: 'free' }];
    expect(weaknessReminder(weaknesses, {}, 10)?.kind).toBe('mate');
    expect(weaknessReminder(weaknesses, { mate: 9 }, 10)?.kind).toBe('free');
    expect(weaknessReminder(weaknesses, { mate: 7 }, 10)?.kind).toBe('mate');
    expect(weaknessReminder([], {}, 10)).toBeNull();
  });

  it('乗り越えたら、何が良くなったかを言う', () => {
    expect(weaknessOvercomeLine(['mate'], { won: true, checkmate: true })).toContain('詰み、今日は見つけたね');
    expect(weaknessOvercomeLine(['mate'], { won: true, checkmate: false })).toBe('');
    expect(weaknessOvercomeLine(['ending'], { won: true, checkmate: false })).toContain('勝ちきったね');
    expect(weaknessOvercomeLine(['opening'], { won: false, checkmate: false, standing30: 50 })).toContain('序盤');
    expect(weaknessOvercomeLine(['opening'], { won: false, checkmate: false, standing30: -400 })).toBe('');
  });
});

describe('N10 ほめる', () => {
  it('チャンスを生かした・狙いを受けた・AIと同じ手の連続の順にほめる', () => {
    expect(insightPraise({ seizedChance: true, defendedThreat: true })?.key).toBe('praise-seized-chance');
    expect(insightPraise({ defendedThreat: true, aiStreak: 3 })?.key).toBe('praise-threat-defended');
    expect(insightPraise({ aiStreak: 3 })?.text).toBe('AIと同じ手が3手続いたね！ 冴えてる！');
    expect(insightPraise({ aiStreak: 4 })).toBeNull();
    expect(coachAdvicePriority({ key: 'praise-ai-streak-5' })).toBe(60);
  });

  it('自分で詰ませたときは手数を添える', () => {
    expect(selfMatePraise(7)).toBe('自分の力で7手の詰みを読みきったね！ お見事！');
    expect(selfMatePraise(1)).toBe('自分の力で詰ませたね！ お見事！');
  });
});
