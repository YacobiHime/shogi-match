import { describe, expect, it } from 'vitest';
import {
  addRecentTalk,
  adviceReason,
  endgamePolicyAdvice,
  insightPraise,
  isEndgame,
  meaningAdvice,
  missedChanceAdvice,
  moveMeaning,
  opponentSlipAdvice,
  proverbAdvice,
  selfMatePraise,
  storyAdvice,
  weaknessOvercomeLine,
  weaknessReminder,
} from './coach-insight.mjs';
import { coachAdvicePriority } from './coach-advice-scheduler.mjs';
import { getIdleCoachAdvice } from './idle-coach-advice.mjs';

const cp = (value) => ({ type: 'cp', value });
const mate = (value) => ({ type: 'mate', value });

describe('N1 最善手の翻訳', () => {
  it('タダで取る手と、取り返される取り合いを見分ける', () => {
    expect(moveMeaning('4k4/9/9/9/4s4/9/9/9/4R3K b - 1', '5i5e')).toEqual({ kind: 'free-capture', captured: 'S', square: '5e',
      reason: '△5五の銀は、取っても取り返されないよ！' });
    expect(moveMeaning('4k4/9/9/4g4/4s4/9/9/9/4R3K b - 1', '5i5e')?.kind).toBe('capture');
  });

  it('後手の手も、後手から見て同じように見分ける', () => {
    expect(moveMeaning('k3r4/9/9/9/4S4/9/9/9/4K4 w - 1', '5a5e')).toMatchObject({ kind: 'free-capture', captured: 'S', square: '5e',
      reason: '▲5五の銀は、取っても取り返されないよ！' });
  });

  it('王手・打つ・逃げる・守る', () => {
    expect(moveMeaning('4k4/9/9/9/9/9/9/9/K2R5 b - 1', '6i5i')?.kind).toBe('check');
    expect(moveMeaning('8k/9/9/9/9/9/9/9/K8 b P 1', 'P*5e')).toEqual({ kind: 'drop', piece: 'P' });
    expect(moveMeaning('k8/9/9/9/4S3r/9/9/9/K8 b - 1', '5e6d')).toEqual({ kind: 'escape', piece: 'S',
      reason: '相手の飛車が、銀をねらってるよ。取られない升へ動かそう！' });
    expect(moveMeaning('k8/9/9/9/9/9/9/9/4K4 b - 1', '5i4h')).toEqual({ kind: 'defend', piece: 'K' });
  });

  it('手筋の形は名前で言う(ふんどしの桂)', () => {
    const meaning = moveMeaning('k8/9/9/3r1g3/9/9/9/9/K8 b N 1', 'N*5f');
    expect(meaning).toEqual({ kind: 'tesuji', tesuji: 'knight-fork', reason: 'ふんどしの桂を打てるよ！ 飛車と金の両取りだよ' });
    expect(meaningAdvice(meaning)?.text).toContain('ふんどしの桂');
  });

  it('「なぜ？」は、探し方ではなく、その手で何ができるかを言う(11-4)', () => {
    // 割り打ちの銀: 一言は「持ち駒の銀が光る場面だよ！」、なぜ？で手筋の名前と、ねらう駒。
    const split = meaningAdvice(moveMeaning('8k/1r1g5/9/9/9/9/9/9/K8 b S 1', 'S*7a'));
    expect(split).toMatchObject({ text: '持ち駒の銀が光る場面だよ！', reason: '割り打ちの銀を打てるよ！ 飛車と金の両取りだよ' });
    // 名前の付いた形がない打つ手は、ねらう駒を言う。
    expect(moveMeaning('4k4/9/9/9/9/9/2g6/9/K8 b S 1', 'S*7h')?.reason).toBe('銀を打って、△7七の金をねらえるよ！');
    expect(moveMeaning('4k4/9/9/9/9/9/9/9/K8 b G 1', 'G*5b')?.reason).toBe('金で王手をかけられるよ！ 相手は受けるしかないよ');
    // 中身の分からない手は付けない(鍵で決まる一般の理由になる)。
    expect(moveMeaning('k8/9/9/9/9/9/9/9/4K4 b - 1', '5i4h')?.reason).toBeUndefined();
    expect(adviceReason('candidate-evaluation-cliff-drop')).not.toMatch(/2つ/);
    // 考えているあいだの一言にも、同じ中身を渡す。
    expect(getIdleCoachAdvice({ usi: 'S*7a', formattedMove: '▲7一銀', pieceType: 'silver', capturedPieceType: '', toRank: 1, color: 'black', insight: split }))
      .toMatchObject({ reason: '割り打ちの銀を打てるよ！ 飛車と金の両取りだよ' });
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
  it('9手より長い詰みは、見逃しとして言わない', () => {
    expect(missedChanceAdvice({ sfenBefore: '4k4/9/9/9/9/9/9/9/4K4 b R 1', playedUsi: 'R*5e', before: mate(21), after: cp(3000), beforePv: [] })).toBeNull();
  });

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

describe('段階2: N3 終盤の方針', () => {
  it('61手目からと、玉のまわりに相手の利きが集まったときを終盤とする', () => {
    const quiet = 'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1';
    expect(isEndgame(quiet, 20)).toBe(false);
    expect(isEndgame(quiet, 40)).toBe(false);
    expect(isEndgame(quiet, 60)).toBe(true);
    // 先手の玉(5九)のまわりに後手の竜と馬が利いている。
    expect(isEndgame('4k4/9/9/9/9/9/2+B6/4+r4/4K4 b - 1', 40)).toBe(true);
    expect(isEndgame('4k4/9/9/9/9/9/2+B6/4+r4/4K4 b - 1', 20)).toBe(false);
  });

  it('詰めろなら受けか王手、詰めろでなければ攻め合いか守り', () => {
    expect(endgamePolicyAdvice({ mateThreat: true, bestGivesCheck: true })?.key).toBe('endgame-threat-check');
    expect(endgamePolicyAdvice({ mateThreat: true, bestGivesCheck: false })?.key).toBe('endgame-threat-defend');
    expect(endgamePolicyAdvice({ mateThreat: false, bestGivesCheck: false, bestGivesMateThreat: true })?.key).toBe('endgame-race-attack');
    expect(endgamePolicyAdvice({ mateThreat: false, bestGivesCheck: false, bestIsDefensive: true })?.key).toBe('endgame-defend-first');
    expect(endgamePolicyAdvice({ mateThreat: false, bestGivesCheck: true, bestGivesMateThreat: true })).toBeNull();
    expect(endgamePolicyAdvice({ mateThreat: true, bestGivesCheck: false, playerScore: mate(3) })).toBeNull();
    expect(coachAdvicePriority({ key: 'endgame-threat-defend' })).toBeGreaterThan(coachAdvicePriority({ key: 'threat-capture-5e5d' }));
    expect(coachAdvicePriority({ key: 'endgame-race-attack' })).toBeLessThan(coachAdvicePriority({ key: 'move-blunder' }));
  });
});

describe('段階3: N6 格言', () => {
  it('居玉: 取り合いが始まり、最善手が玉を動かす手のときだけ', () => {
    const sfen = 'lnsgkgsnl/1r5b1/pppppp1pp/6p2/9/2P6/PP1PPPPPP/1B5R1/LNSGKGSNL b P 27';
    expect(proverbAdvice({ sfen, ply: 26, color: 'black', bestMove: '5i6h' })?.key).toBe('proverb-idle-king');
    expect(proverbAdvice({ sfen, ply: 26, color: 'black', bestMove: '2h2d' })).toBeNull();
    expect(proverbAdvice({ sfen, ply: 20, color: 'black', bestMove: '5i6h' })).toBeNull();
    expect(proverbAdvice({ sfen, ply: 26, color: 'black', bestMove: '5i6h', said: ['idle-king'] })).toBeNull();
    expect(proverbAdvice({ sfen: sfen.replace(' P ', ' - '), ply: 26, color: 'black', bestMove: '5i6h' })).toBeNull();
  });

  it('玉飛接近: 玉と飛車が隣り合い、最善手がどちらかを離す手', () => {
    const sfen = 'lnsgkgsnl/7b1/ppppppppp/9/9/9/PPPPPPPPP/1B7/LNSGKRSNL b - 9';
    expect(proverbAdvice({ sfen, ply: 8, color: 'black', bestMove: '4i4h' })?.text).toContain('玉飛接近すべからず');
    expect(proverbAdvice({ sfen, ply: 44, color: 'black', bestMove: '4i4h' })).toBeNull();
  });

  it('桂の高跳び: 跳ねた桂が相手の歩にねらわれる(後手も同じ)', () => {
    expect(proverbAdvice({ sfen: '4k4/9/4p4/4N4/9/9/9/9/4K4 b - 1', ply: 30, color: 'black', lastPlayerMove: '6f5d' })?.key).toBe('proverb-high-knight');
    expect(proverbAdvice({ sfen: '4k4/9/9/4N4/9/9/9/9/4K4 b - 1', ply: 30, color: 'black', lastPlayerMove: '6f5d' })).toBeNull();
    expect(proverbAdvice({ sfen: '4k4/9/9/9/9/4n4/4P4/9/4K4 w - 1', ply: 30, color: 'white', lastPlayerMove: '4d5f' })?.dex).toBe('high-knight');
  });
});

describe('段階3: N9 大会の物語', () => {
  const opponent = (traits, id = 'p1') => ({ id, name: '中村', character: { traits: traits.map((trait) => ({ id: trait })) } });
  it('相手の特徴・賭けているもの・カド番・羽音の逆転', () => {
    expect(storyAdvice({ playerScore: cp(1200), endgame: false, opponent: opponent(['comeback']) })?.text).toBe('中村さんは逆転の名手。最後まで気を抜かないで！');
    expect(storyAdvice({ playerScore: cp(100), endgame: true, opponent: opponent(['endgame-collapse']) })?.key).toBe('story-endgame-weak');
    expect(storyAdvice({ playerScore: cp(100), endgame: false, opponent: opponent(['endgame-collapse']) })).toBeNull();
    expect(storyAdvice({ playerScore: cp(2000), endgame: true, opponent: opponent([]), stakes: '勝てば竜王' })?.text).toBe('勝てば竜王！ 最後の詰みまで、丁寧にいこう');
    expect(storyAdvice({ playerScore: cp(0), endgame: true, opponent: opponent([]), tone: 'kadoban' })?.key).toBe('story-crunch');
    expect(storyAdvice({ playerScore: cp(400), previousScore: cp(-500), endgame: false, opponent: opponent([], 'hanane') })?.text).toContain('羽音ちゃん');
    expect(storyAdvice({ playerScore: cp(1200), endgame: false, opponent: opponent(['comeback']), said: ['story-comeback'] })).toBeNull();
    expect(storyAdvice({ playerScore: mate(3), endgame: true, opponent: opponent(['comeback']) })).toBeNull();
    expect(coachAdvicePriority({ key: 'story-comeback' })).toBeLessThan(coachAdvicePriority({ key: 'plan-swing-x' }));
    expect(coachAdvicePriority({ key: 'story-comeback' })).toBeGreaterThan(coachAdvicePriority({ key: 'situation-good' }));
  });
});

describe('段階3: N11 もう一言', () => {
  it('なぜ？の1行は答えの手を言わず、鍵の頭で決まる', () => {
    expect(adviceReason('candidate-evaluation-cliff-free-capture')).toContain('守られていない駒');
    expect(adviceReason('candidate-evaluation-cliff-drop-N')).toContain('持ち駒');
    expect(adviceReason('threat-capture-2b8h+')).toContain('点線');
    expect(adviceReason('situation-good')).toBe('');
    expect(adviceReason('idle-defend')).toBe(adviceReason('candidate-evaluation-cliff-defend'));
    expect(adviceReason('idle-recapture-pawn')).toBe('');
  });
  it('さっきの話は新しい順に3つまで、同じ台詞は1つ', () => {
    let talk = [];
    for (const [ply, text] of [[1, 'a'], [3, 'b'], [5, 'a'], [7, 'c'], [9, 'd']]) talk = addRecentTalk(talk, { ply, text });
    expect(talk.map(({ text }) => text)).toEqual(['d', 'c', 'a']);
  });
});
