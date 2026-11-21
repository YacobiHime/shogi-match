import { describe, expect, it } from 'vitest';
import {
  AIM, CAUSES, DISCIPLES, PLAY_STYLES, SKILLS, STAT_KEYS, addGains, applyAptitudes, causeOf, diminish, discipleMoveSettings, discipleSelfplaySettings, discipleStrength, discipleWatchMoves, effectiveLevel, failChance, phaseSettings,
  judgeGuess, overallLevel, raiseAptitude, skillEffects, statLevel, statRank, trainingGains, watchMarks, winChance,
} from './disciple-strength.mjs';
import { sourceLevelOf, sourceLevelSettings } from './strength-settings.mjs';

const even = (value) => Object.fromEntries(STAT_KEYS.map((key) => [key, value]));

describe('師匠の1年の能力値(20章)', () => {
  it('能力値はLv12〜49に、ランクはG〜SSになる', () => {
    expect(statLevel(0)).toBe(12);
    expect(statLevel(1200)).toBe(49);
    expect(statLevel(600)).toBeCloseTo(30.5, 5);
    expect(statRank(0)).toBe('G');
    expect(statRank(899)).toBe('B');
    expect(statRank(900)).toBe('A');
    expect(statRank(1200)).toBe('SS');
  });

  it('全体の強さは、いちばん弱い能力に引っ張られる', () => {
    expect(overallLevel(even(600))).toBeCloseTo(statLevel(600), 5);
    const spiky = { reading: 1200, plan: 1200, steady: 1200, mate: 0 };
    const flat = even(900);
    // 平均は同じ(900)でも、尖らせると弱く出る。
    expect(overallLevel(spiky)).toBeLessThan(overallLevel(flat));
  });

  it('4つが同じ能力なら、その能力のLvのCPUと同じ設定になる', () => {
    const strength = discipleStrength({ stats: even(600) });
    const lv = statLevel(600);
    const base = sourceLevelSettings(sourceLevelOf(Math.floor(lv)) + (sourceLevelOf(Math.ceil(lv)) - sourceLevelOf(Math.floor(lv))) * (lv - Math.floor(lv)));
    expect(strength.level).toBeCloseTo(lv, 1);
    expect(strength.settings.nodes).toBe(base.nodes);
    expect(strength.settings.human.sigma).toBe(base.human.sigma);
    expect(strength.settings.human.belief.mateSight).toBe(base.human.belief.mateSight);
  });

  it('局面ごとに主役の能力が違う(序盤は作戦、中盤は読み、終盤は詰み)', () => {
    const base = discipleStrength({ stats: even(400) });
    const reader = discipleStrength({ stats: { ...even(400), reading: 1100 } });
    const planner = discipleStrength({ stats: { ...even(400), plan: 1100 } });
    const mate = discipleStrength({ stats: { ...even(400), mate: 1100 } });
    expect(reader.phases.middle - base.phases.middle).toBeGreaterThan(reader.phases.opening - base.phases.opening);
    expect(planner.phases.opening - base.phases.opening).toBeGreaterThan(planner.phases.middle - base.phases.middle);
    expect(mate.phases.ending - base.phases.ending).toBeGreaterThan(mate.phases.middle - base.phases.middle);
    expect(phaseSettings(reader, 'middle').nodes).toBeGreaterThan(phaseSettings(base, 'middle').nodes);
    expect(phaseSettings(planner, 'opening').nodes).toBeGreaterThan(phaseSettings(base, 'opening').nodes);
    expect(phaseSettings(mate, 'ending').human.belief.mateSight).toBeGreaterThan(phaseSettings(base, 'ending').human.belief.mateSight);
    expect(mate.mateLevel).toBeGreaterThan(base.mateLevel);
  });

  it('安定は見落としと、どの局面のLvにも効く', () => {
    const base = discipleStrength({ stats: even(400) });
    const steady = discipleStrength({ stats: { ...even(400), steady: 1100 } });
    expect(phaseSettings(steady, 'middle').human.miss.other).toBeLessThan(phaseSettings(base, 'middle').human.miss.other);
    for (const phase of ['opening', 'middle', 'ending']) expect(steady.phases[phase]).toBeGreaterThan(base.phases[phase]);
  });

  it('適性で能力に倍率が掛かり、やる気でLvが動く', () => {
    const stats = even(800);
    const aptitudes = { ranging: 'A', long: 'G' };
    expect(applyAptitudes(stats, aptitudes, { battle: 'ranging' }).reading).toBe(840);
    expect(applyAptitudes(stats, aptitudes, { time: 'long' }).reading).toBe(640);
    expect(applyAptitudes(stats, aptitudes, {}).reading).toBe(800);
    const high = discipleStrength({ stats, mood: 2 });
    const low = discipleStrength({ stats, mood: -2 });
    expect(high.level).toBeGreaterThan(low.level);
  });

  it('適性は目盛りがたまると1段上がり、Aで止まる', () => {
    expect(raiseAptitude({ rank: 'C', meter: 3 })).toEqual({ rank: 'B', meter: 0 });
    expect(raiseAptitude({ rank: 'C', meter: 1 })).toEqual({ rank: 'C', meter: 2 });
    expect(raiseAptitude({ rank: 'A', meter: 0 }, 9)).toEqual({ rank: 'A', meter: 0 });
  });

  it('戦い方は攻めの向きだけを変え、強さは変えない', () => {
    const lead = discipleStrength({ stats: even(500), style: 'lead' });
    const counter = discipleStrength({ stats: even(500), style: 'counter' });
    expect(lead.attack).toBeGreaterThan(0);
    expect(counter.attack).toBeLessThan(0);
    expect(lead.settings.nodes).toBe(counter.settings.nodes);
    expect(lead.level).toBe(counter.level);
  });
});

describe('スキル(19-4)', () => {
  it('15個あり、藤井曲線だけが★4', () => {
    expect(SKILLS).toHaveLength(15);
    expect(SKILLS.filter((skill) => skill.star === 4).map((skill) => skill.id)).toEqual(['fujii-curve']);
    expect(SKILLS.filter((skill) => skill.staged === 1)).toHaveLength(5);
    for (const style of Object.values(PLAY_STYLES)) for (const id of style.skills) expect(SKILLS.some((skill) => skill.id === id)).toBe(true);
  });

  it('藤井曲線はいつも効き、逆境の粘りは劣勢だけ、勝ちきる力は優勢だけ', () => {
    const fujii = skillEffects(['fujii-curve'], { advantage: 0 });
    expect(fujii.sigma).toBeCloseTo(0.4);
    expect(fujii.missScale).toBe(0);
    expect(fujii.noLoosening).toBe(true);
    expect(skillEffects(['adversity'], { advantage: 0 }).active).toEqual([]);
    expect(skillEffects(['adversity'], { advantage: -400 }).nodes).toBeGreaterThan(1);
    expect(skillEffects(['closer'], { advantage: 200 }).active).toEqual([]);
    expect(skillEffects(['closer'], { advantage: 600 }).noLoosening).toBe(true);
    expect(skillEffects(['endgame-demon'], { phase: 'ending' }).mateSightPlus).toBe(3);
    expect(skillEffects(['byoyomi'], { clock: 'byoyomi' }).clockScale).toBe(0.5);
  });

  it('戦い方とかみ合うスキルは効き目が1割増す', () => {
    const plain = skillEffects(['adversity'], { advantage: -400 });
    const fit = skillEffects(['adversity'], { advantage: -400, style: 'counter' });
    expect(fit.nodes).toBeGreaterThan(plain.nodes);
  });
});

describe('観戦の見立て(19-5)', () => {
  it('理由は、詰み・時計・見落とし・手数の順に決まる', () => {
    expect(causeOf({ ply: 80, loss: 900, missedMate: true, clock: 'byoyomi' })).toBe('mate');
    expect(causeOf({ ply: 80, loss: 500, clock: 'byoyomi', oversights: [{}] })).toBe('time');
    expect(causeOf({ ply: 80, loss: 500, oversights: [{}] })).toBe('careless');
    expect(causeOf({ ply: 20, loss: 300 })).toBe('plan');
    expect(causeOf({ ply: 70, loss: 300 })).toBe('reading');
  });

  it('印は落ち幅の大きい場面から、師匠の眼の段で数が増える', () => {
    const moves = [
      { ply: 21, loss: 120 }, { ply: 35, loss: 300 }, { ply: 61, loss: 700, oversights: [{}] }, { ply: 77, loss: 400 }, { ply: 101, loss: 1500, missedMate: true },
    ];
    const marks = watchMarks(moves);
    expect(marks.map((mark) => mark.ply)).toEqual([61, 101]);
    expect(marks[0].cause).toBe('careless');
    expect(marks[0].clues).toContain('赤い輪：取られる駒');
    expect(watchMarks(moves, { dan: 4 })).toHaveLength(3);
  });

  it('本局の棋譜から弟子の手を取り出し、印を付けられる', () => {
    const entries = [
      { loss: 0 }, { loss: 10 }, { loss: 30, d: { o: 0, m: 0, c: '' } }, { loss: 0 },
      { loss: 650, d: { o: 1, m: 0, c: '' } }, { loss: 0 }, { loss: 900, d: { o: 0, m: 1, c: 'byoyomi' } },
    ];
    const moves = discipleWatchMoves(entries, 'black');
    expect(moves.map((move) => move.ply)).toEqual([1, 3, 5, 7]);
    const marks = watchMarks(moves);
    expect(marks.map((mark) => mark.cause)).toEqual(['careless', 'mate']);
    // 指したあとも大きく勝っている手(詰みの手数が延びただけ)は数えない。
    const winning = discipleWatchMoves([{ loss: 5000, eval: 30000, d: { o: 0, m: 0, c: '' } }], 'black');
    expect(winning[0].loss).toBe(0);
    expect(discipleWatchMoves([{ loss: 5000, eval: -200 }], 'black')[0].loss).toBe(3000);
  });

  it('当てると伸び×1.5、外しても×1.25で正しい理由が分かる', () => {
    const mark = { cause: 'careless' };
    expect(judgeGuess(mark, 'careless')).toMatchObject({ right: true, boost: AIM.right, target: 'steady' });
    expect(judgeGuess(mark, 'reading')).toMatchObject({ right: false, boost: AIM.wrong, cause: 'careless' });
    expect(CAUSES.time.target).toBe('time');
  });
});

describe('稽古と勝ち負け', () => {
  it('稽古は主な能力を大きく、狙い目とやる気で伸びが増え、Aより上は鈍る', () => {
    const stats = even(400);
    const gains = trainingGains(stats, 'tsume');
    expect(gains.mate).toBeGreaterThan(gains.reading);
    expect(trainingGains(stats, 'tsume', { aim: { mate: 1.5 } }).mate).toBeGreaterThan(gains.mate);
    expect(trainingGains(stats, 'tsume', { mood: 2 }).mate).toBeGreaterThan(trainingGains(stats, 'tsume', { mood: -2 }).mate);
    expect(trainingGains({ ...stats, mate: 950 }, 'tsume').mate).toBeLessThan(gains.mate);
    expect(trainingGains(stats, 'shisho', { choice: 'plan' })).toHaveProperty('plan');
    expect(diminish(1100)).toBe(0.4);
    expect(addGains({ ...stats, mate: 1195 }, { mate: 20 }).mate).toBe(1200);
  });

  it('体力が少ないほど失敗しやすい', () => {
    expect(failChance(80)).toBeLessThan(failChance(50));
    expect(failChance(50)).toBeCloseTo(0.05);
    expect(failChance(30)).toBeCloseTo(0.2);
    expect(failChance(10)).toBeCloseTo(0.45);
  });

  it('観戦しない局の勝つ割合は、Lvの差で決まる', () => {
    expect(winChance(30, 30)).toBeCloseTo(0.5);
    expect(winChance(32, 30)).toBeGreaterThan(0.6);
    expect(winChance(28, 30)).toBeLessThan(0.4);
  });

  it('観戦しない局の強さは、4つが同じなら全体の強さのLvで、尖った能力と藤井曲線は自己対局の差に近い', () => {
    const flat = discipleStrength({ stats: even(600) });
    expect(effectiveLevel(flat)).toBeCloseTo(flat.level, 0);
    // 22-3の自己対局: 読み・作戦・安定・詰みを＋600すると、レーティングで約＋670・＋340・＋550・＋370(勝率9割を超え、上はぶれが大きい)。
    const gain = (stats) => (effectiveLevel(discipleStrength({ stats })) - effectiveLevel(flat)) * 100;
    expect(gain({ ...even(600), plan: 1200 })).toBeGreaterThan(250);
    expect(gain({ ...even(600), plan: 1200 })).toBeLessThan(450);
    expect(gain({ ...even(600), mate: 1200 })).toBeGreaterThan(250);
    expect(gain({ ...even(600), steady: 1200 })).toBeGreaterThan(380);
    expect(gain({ ...even(600), reading: 1200 })).toBeGreaterThan(380);
    const fujii = discipleStrength({ stats: even(900), skills: ['fujii-curve'] });
    expect(effectiveLevel(fujii) - effectiveLevel(discipleStrength({ stats: even(900) }))).toBeCloseTo(2.3, 1);
  });

  it('弟子の候補3人は、能力・適性・戦い方・スキルを持つ', () => {
    expect(DISCIPLES).toHaveLength(3);
    for (const disciple of DISCIPLES) {
      expect(Object.keys(disciple.stats).sort()).toEqual([...STAT_KEYS].sort());
      expect(PLAY_STYLES[disciple.style]).toBeTruthy();
      for (const id of disciple.skills) expect(SKILLS.some((skill) => skill.id === id)).toBe(true);
    }
  });
});

describe('対局の1手ごとの設定(22章)', () => {
  const strength = (skills = [], style = '') => discipleStrength({ stats: even(600), skills, style });
  it('詰みの能力で、詰みを見つける確率の中心の手数が変わる', () => {
    const low = discipleMoveSettings(discipleStrength({ stats: { ...even(600), mate: 200 } }), {}, {});
    const high = discipleMoveSettings(discipleStrength({ stats: { ...even(600), mate: 1100 } }), {}, {});
    expect(high.mateFinding.center).toBeGreaterThan(low.mateFinding.center);
  });

  it('藤井曲線は見落としをなくし、ぶれを小さくする', () => {
    const plain = discipleMoveSettings(strength(), {}, {});
    const fujii = discipleMoveSettings(strength(['fujii-curve']), {}, {});
    expect(fujii.human.sigma).toBeLessThan(plain.human.sigma);
    expect(Object.values(fujii.human.miss).every((value) => value === 0)).toBe(true);
    expect(fujii.human.limit).toEqual({ A: 0, B: 0 });
    expect(fujii.discipleSkills).toContain('fujii-curve');
  });

  it('秒読みの重圧は、持ち時間の適性が低いほど重く、秒読みに強いで軽くなる', () => {
    const clock = { pressure: 'byoyomi', short: true };
    const good = discipleMoveSettings(strength(), { aptitudes: { fast: 'A' } }, { clock, time: 'fast' });
    const bad = discipleMoveSettings(strength(), { aptitudes: { fast: 'G' } }, { clock, time: 'fast' });
    const skilled = discipleMoveSettings(strength(['byoyomi']), { aptitudes: { fast: 'G' } }, { clock, time: 'fast' });
    expect(good.nodes).toBeGreaterThan(bad.nodes);
    expect(skilled.nodes).toBeGreaterThan(bad.nodes);
    expect(bad.human.sigma).toBeGreaterThan(good.human.sigma);
  });

  it('戦い方は攻めの好みとして手の選び方に渡る', () => {
    expect(discipleMoveSettings(strength([], 'lead'), { style: 'lead' }, {}).style.attack).toBeGreaterThan(0);
    expect(discipleMoveSettings(strength([], 'counter'), { style: 'counter' }, {}).style.attack).toBeLessThan(0);
  });

  it('隠れた弱点は今の棋士の特徴として効き、勝ちきる力は優勢で緩むを打ち消す', () => {
    const loose = discipleMoveSettings(strength(), { weakness: 'loose-when-ahead' }, { advantage: 800 });
    const closer = discipleMoveSettings(strength(['closer']), { weakness: 'loose-when-ahead' }, { advantage: 800 });
    expect(loose.activeTraits).toContain('loose-when-ahead');
    expect(closer.activeTraits ?? []).not.toContain('loose-when-ahead');
  });

  it('自己対局の選手の指定を読む', () => {
    const settings = discipleSelfplaySettings('D900-900-900-900+fujii-curve');
    expect(settings.level).toBe(Math.round(statLevel(900)));
    expect(settings.discipleSkills).toEqual(['fujii-curve']);
    expect(discipleSelfplaySettings('L30')).toBeNull();
  });
});
