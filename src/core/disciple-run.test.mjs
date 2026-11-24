import { describe, expect, it } from 'vitest';
import {
  EXAM_TURN, MAX_TURNS, PLAN_STUDY_EVERY, learnPlan, skipLearn, applyFindings, praiseLine, masteryView, MASTERY_GAIN, chooseAction, watchSpec, chooseWords, createDiscipleRun, discipleView, isBigEvent, loadDiscipleRun, nextGoal, planFit, playEvent, saveDiscipleRun, trainingPreview, turnCalendar, turnKind, placeText, discipleAgeMonths, eventOpponent, SHOREIKAI_BASE_LEVEL, shoreikaiOpponentLevel, HARD_TURNS,
} from './disciple-run.mjs';
import { dayResultView, endCardText } from './disciple-run.mjs';
import { STAT_KEYS } from './disciple-strength.mjs';

function memoryStorage() {
  const map = new Map();
  return { getItem: (key) => (map.has(key) ? map.get(key) : null), setItem: (key, value) => map.set(key, String(value)), removeItem: (key) => map.delete(key) };
}
const TRAIN_FOR = { reading: 'jissen', plan: 'kifu', steady: 'fast', mate: 'tsume' };
/** よい師匠のまね: 体力が減ったら休み、いちばん低い能力を稽古する。 */
function playGood(state, { until = null } = {}) {
  let s = state;
  for (let i = 0; i < 600 && !s.end && !(until && until(s)); i += 1) {
    const kind = turnKind(s);
    if (kind === 'free') {
      if (s.stamina < 45) s = chooseAction(s, { kind: 'rest' }).state;
      else {
        const weakest = STAT_KEYS.reduce((a, b) => (s.stats[b] < s.stats[a] ? b : a));
        s = chooseAction(s, { kind: 'train', id: TRAIN_FOR[weakest] }).state;
      }
    } else if (kind === 'exam' || kind === 'reikai') s = playEvent(s, { plan: { opening: 'own', ending: 'wait' } }).state;
    else if (kind === 'words') s = chooseWords(s, 'review').state;
  }
  return s;
}

describe('師匠の1年の育成の進み(23章)', () => {
  it('入門から入会試験までは予定を選び、試験のあとは月の後半が例会', () => {
    let s = createDiscipleRun({ seed: 1, discipleId: 'minato' });
    expect(turnKind(s)).toBe('free');
    expect(nextGoal(s)).toEqual({ text: '研修会 入会試験', left: EXAM_TURN });
    for (let i = 0; i < EXAM_TURN; i += 1) s = chooseAction(s, { kind: 'rest' }).state;
    expect(turnKind(s)).toBe('exam');
    expect(isBigEvent(s)).toBe(true);
    s = playEvent(s, { plan: { opening: 'own', ending: 'wait' } }).state;
    expect(s.kenshukai.phase).toBe('reikai');
    expect(s.lastEvent.games.length).toBeGreaterThan(0);
    if (s.words) s = chooseWords(s, 'praise').state;
    expect(turnKind(s)).toBe(s.turn % 2 === 1 ? 'reikai' : 'free');
  });

  it('稽古は能力を伸ばして体力を減らし、休むと体力が戻る', () => {
    const s = createDiscipleRun({ seed: 2, discipleId: 'ao' });
    const preview = trainingPreview(s, 'tsume');
    const { state: trained, result } = chooseAction(s, { kind: 'train', id: 'tsume' });
    expect(trained.turn).toBe(1);
    if (!result.failed) expect(trained.stats.mate).toBe(s.stats.mate + preview.gains.mate);
    expect(trained.stamina).toBeLessThan(s.stamina);
    const rested = chooseAction(trained, { kind: 'rest' }).state;
    expect(rested.stamina).toBeGreaterThan(trained.stamina);
  });

  it('棋譜並べは戦型の適性の目盛り、早指しは早指しの適性の目盛りを上げる', () => {
    let s = createDiscipleRun({ seed: 3, discipleId: 'tsumugi' });
    s = { ...s, stamina: 100 };
    const before = s.aptitudes.fast.meter;
    const after = chooseAction(s, { kind: 'train', id: 'fast' });
    if (!after.result.failed) expect(after.state.aptitudes.fast.meter + (after.state.aptitudes.fast.rank !== s.aptitudes.fast.rank ? 4 : 0)).toBe(before + 1);
  });

  it('作戦が弟子に合うと勝つ割合が上がり、合わないと下がる', () => {
    const s = createDiscipleRun({ seed: 4, discipleId: 'minato' });
    // 湊は読みが作戦より高く、安定が詰みより高い。
    const good = planFit(s, { opening: 'wild', ending: 'wait' }, { level: 20 });
    expect(good.fits).toEqual(['good', 'good']);
    const bad = planFit(s, { opening: 'own', ending: 'attack' }, { level: 20 });
    expect(bad.fits).toEqual(['bad', 'bad']);
    expect(bad.bonus).toBeLessThan(good.bonus);
  });

  it('よい育て方なら、ふつうは上限のターンより前に奨励会へ編入する', () => {
    const turns = [];
    for (const id of ['minato', 'tsumugi', 'ao']) {
      for (const seed of [11, 12, 13]) {
        // 28章: A2に届くと育成は終わらず、奨励会の6級へ編入する。
        const s = playGood(createDiscipleRun({ seed, discipleId: id }), { until: (x) => Boolean(x.shoreikai) });
        expect(s.shoreikai || s.end).toBeTruthy();
        turns.push(s.shoreikai ? s.turn : MAX_TURNS);
      }
    }
    turns.sort((a, b) => a - b);
    expect(turns[Math.floor(turns.length / 2)]).toBeLessThan(MAX_TURNS);
    expect(turns[0]).toBeGreaterThan(30);
  }, 15000);

  it('休んでばかりでは強くならず、上限のターンで終わる', () => {
    let s = createDiscipleRun({ seed: 5, discipleId: 'tsumugi' });
    for (let i = 0; i < 300 && !s.end; i += 1) {
      const kind = turnKind(s);
      if (kind === 'free') s = chooseAction(s, { kind: 'rest' }).state;
      else if (kind === 'words') s = chooseWords(s, 'quiet').state;
      else s = playEvent(s).state;
    }
    expect(s.end.kind).toBe('timeup');
  });

  it('暦は4月前半から半月ずつ進み、学年が上がる', () => {
    expect(turnCalendar(0, '中1').label).toBe('中1 4月');
    expect(turnCalendar(1, '中1').half).toBe('後半');
    expect(turnCalendar(18, '中1').month).toBe(1);
    expect(turnCalendar(24, '中1').grade).toBe('中2');
    expect(turnCalendar(0, createDiscipleRun({ seed: 1, discipleId: 'ao' }).startGrade).label).toBe('小6 4月');
  });

  it('保存して読み直しても続きから遊べる', () => {
    const storage = memoryStorage();
    let s = createDiscipleRun({ seed: 6, discipleId: 'ao' });
    for (let i = 0; i < EXAM_TURN; i += 1) s = chooseAction(s, { kind: 'rest' }).state;
    s = playEvent(s).state;
    saveDiscipleRun(storage, s);
    const loaded = loadDiscipleRun(storage);
    expect(loaded.turn).toBe(s.turn);
    expect(discipleView(loaded).kenshukai.classLabel).toBe(discipleView(s).kenshukai.classLabel);
    expect(storage.getItem('yacobihime:shogi-match:disciple:v1')).not.toContain('"players"');
  });
});

describe('観戦(24章)', () => {
  const atExam = () => {
    let s = createDiscipleRun({ seed: 21, discipleId: 'ao' });
    for (let i = 0; i < EXAM_TURN; i += 1) s = chooseAction(s, { kind: 'rest' }).state;
    return s;
  };

  it('観戦する1局の本局の設定を作り、授けた作戦が戦法と攻めの向きになる', () => {
    const s = atExam();
    const own = watchSpec(s, { plan: { opening: 'own', ending: 'attack' } });
    const wild = watchSpec(s, { plan: { opening: 'wild', ending: 'wait' } });
    expect(own.spec[own.side].disciple).toBeTruthy();
    // 作戦は作戦帳のカードを、定跡補助の戦法と囲いのidで渡す(35章)。力戦なら定跡なし。
    expect(Object.keys(s.planBook.cards)).toContain(own.card);
    expect(own.spec.plans[own.side]).toMatchObject({ strategyId: expect.any(String) });
    expect(own.plans.own).toBeTruthy();
    expect(wild.spec.plans[wild.side]).toBeNull();
    expect(wild.plans.own).toBe('力戦');
    expect(own.spec[own.side].disciple.strength.attack).toBeGreaterThan(wild.spec[wild.side].disciple.strength.attack);
    expect(own.state.kenshukai).toBeTruthy();
    expect(s.kenshukai).toBeNull();
  });

  it('観戦した局はエンジンの勝ち負けで記録し、あとの局は観戦しないときと同じ', () => {
    const s = atExam();
    const plain = playEvent(s).result;
    const forcedWin = playEvent(s, { forced: [true] }).result;
    const forcedLoss = playEvent(s, { forced: [false] }).result;
    expect(forcedWin.games[0]).toMatchObject({ win: true, watched: true });
    expect(forcedLoss.games[0]).toMatchObject({ win: false, watched: true });
    expect(forcedWin.games.slice(1).map((game) => game.win)).toEqual(plain.games.slice(1).map((game) => game.win));
  });

  it('見立ての答えで狙い目と見抜いた数が増え、同じ理由を3回見抜くと弱点の名前が出る', () => {
    let s = atExam();
    // 蒼の隠れた弱点は「うっかり」。
    const marks = [{ cause: 'careless' }, { cause: 'mate' }];
    let out = applyFindings(s, marks, ['careless', 'reading']);
    expect(out.state.aims.steady.boost).toBe(1.5);
    expect(out.state.aims.mate.boost).toBe(1.25);
    expect(out.state.eye).toBe(1);
    expect(out.revealed).toBe('');
    s = out.state;
    out = applyFindings(s, [{ cause: 'careless' }, { cause: 'careless' }], ['careless', 'plan']);
    expect(out.revealed).toBe('うっかりが多い');
    expect(discipleView(out.state).weakness).toBe('うっかりが多い');
    // 見抜いた回数は、主の分類を当てたときだけ数える(33-6)。
    expect(out.state.spotted).toEqual({ careless: 2 });
  });

  it('分かれ目を見抜くと師匠の眼に1つ、好手をほめるとやる気が1つ上がる(33-6)', () => {
    const s = { ...atExam(), mood: 0 };
    const out = applyFindings(s, [], [], { seekHit: true, praised: '叩きの歩' });
    expect(out.state.eye).toBe((s.eye ?? 0) + 1);
    expect(out.state.mood).toBe(1);
    expect(out.state.log.at(-1).text).toBe('好手「叩きの歩」をほめた');
    expect(applyFindings({ ...s, mood: 2 }, [], [], { praised: 'x' }).state.mood).toBe(2);
    expect(praiseLine('ao', '叩きの歩')).toMatch(/^あの叩きの歩、/);
  });
});

describe('奨励会へ続く育成(28章)', () => {
  const toShoreikai = (id = 'minato', seed = 11) => playGood(createDiscipleRun({ seed, discipleId: id }), { until: (x) => Boolean(x.shoreikai) });

  it('A2に届くと育成は終わらず、奨励会の6級に編入して編入の場面が積まれる', () => {
    const s = toShoreikai();
    expect(s.end).toBeNull();
    expect(s.shoreikai.rank).toBe(0);
    expect(s.shoreikai.transfer.label).toMatch(/^研修会/);
    expect(s.sceneQueue).toContain('shoreikai');
    expect(placeText(s)).toBe('奨励会 6級');
    expect(Math.floor(s.shoreikai.age / 12)).toBe(Math.floor(discipleAgeMonths(s) / 12));
  });

  it('奨励会の例会は対局日に弟子が指し、相手のLvは6級でSHOREIKAI_BASE_LEVELあたり', () => {
    let s = toShoreikai();
    for (let i = 0; i < 6 && turnKind(s) !== 'reikai'; i += 1) s = turnKind(s) === 'words' ? chooseWords(s, 'quiet').state : chooseAction(s, { kind: 'rest' }).state;
    expect(turnKind(s)).toBe('reikai');
    const opponent = eventOpponent(s);
    // 羽音の弟子(30章)は弟子の強さに合わせるので、ほかの6級の相手だけ物差しを見る。
    if (!opponent.rival) {
      expect(opponent.level).toBeGreaterThan(SHOREIKAI_BASE_LEVEL - 3);
      expect(opponent.level).toBeLessThan(SHOREIKAI_BASE_LEVEL + 4);
    }
    expect(shoreikaiOpponentLevel({ rating: 1320 })).toBeCloseTo(SHOREIKAI_BASE_LEVEL + 11.5 / 2, 5);
    // CPUの強さの上限はLv49(AGENTS.md)。
    expect(shoreikaiOpponentLevel({ rating: 1600 })).toBe(49);
    expect(watchSpec(s, {}).spec.event).toBe('shoreikai');
    // 奨励会の級位者の持ち時間は1時間・秒読み1分(38章)。観戦の1手の時間には上限がある。
    expect(watchSpec(s, {}).spec.control).toMatchObject({ main: 3600, byoyomi: 60, breaks: [] });
    expect(watchSpec(s, {}).spec.thinkBudgetMs).toBeGreaterThan(0);
    const { state: after, result } = playEvent(s, {});
    expect(result.games.length).toBeGreaterThan(0);
    expect(after.shoreikai.games.length).toBe(s.shoreikai.games.length + result.games.length);
    expect(after.turn).toBe(s.turn + 1);
  });

  it('四段になると四段の場面と評価で終わり、退会なら退会の場面', () => {
    let s = toShoreikai('ao', 12);
    s = { ...s, stats: { reading: 1200, plan: 1200, steady: 1200, mate: 1200 } };
    s = playGood(s);
    expect(['pro', 'retired']).toContain(s.end.kind);
    expect(s.sceneQueue).toContain(s.end.kind);
    if (s.end.kind === 'pro') {
      expect(s.end.text).toContain('四段');
      expect(['S', 'A']).toContain(s.end.rank);
      expect(placeText(s)).toBe('四段');
    }
  });

  it('研修会のあいだはMAX_TURNSで終わるが、奨励会ではHARD_TURNSまで続けられる', () => {
    expect(HARD_TURNS).toBeGreaterThan(MAX_TURNS);
  });
});

describe('観戦した日の結果発表(33-3)', () => {
  it('終局の札は勝ち負けと終わり方', () => {
    expect(endCardText({ win: true, reason: 'mate', plies: 97 })).toEqual({ stamp: '勝ち', line: '97手で終局　詰ませて' });
    expect(endCardText({ win: false, reason: 'resign', plies: 88 })).toEqual({ stamp: '負け', line: '88手で終局　投了' });
    expect(endCardText({ win: true, plies: 120 }).line).toContain('相手が投了');
  });
  it('その日の局を○●で並べ、観戦した局に印。大一番は見出しを変える', () => {
    const view = dayResultView({ label: '例会', games: [{ name: 'A', win: true, chance: 0.6, watched: true }, { name: 'B', win: false, chance: 0.45 }], wins: 1, losses: 1, events: ['C級に昇級'], big: true });
    expect(view.marks).toBe('○●');
    expect(view.games[0]).toMatchObject({ no: 1, watched: true, chance: 60 });
    expect(view.headline).toBe('大一番　五分');
    expect(view.events).toEqual(['C級に昇級']);
    expect(dayResultView({ games: [{ name: 'A', win: true }], wins: 1, losses: 0 }).headline).toBe('1勝0敗');
    expect(dayResultView(null).games).toEqual([]);
  });
});

describe('戦法熟練度(34-17)と作戦帳(35章のO2)', () => {
  it('研究会で作戦の熟練度が上がり、札に出る', () => {
    const s = createDiscipleRun({ seed: 3, discipleId: 'minato' });
    const before = masteryView(s);
    expect(before).toMatchObject({ count: 2 });
    const { state: next, result } = chooseAction(s, { kind: 'study' });
    expect(masteryView(next).value).toBe(before.value + MASTERY_GAIN.study);
    expect(result.text).toMatch(/戦法熟練度＋5/);
  });

  it('弟子をとった日は2つの作戦を知っていて、指した日の作戦に局数・勝ち数・熟練度を数える', () => {
    let s = createDiscipleRun({ seed: 21, discipleId: 'ao' });
    expect(Object.keys(s.planBook.cards).sort()).toEqual(['bougin+kanigakoi', 'shiken+mino']);
    for (let i = 0; i < EXAM_TURN; i += 1) s = chooseAction(s, { kind: 'rest' }).state;
    const made = watchSpec(s, {});
    // 研修会の持ち時間は30分・秒読み30秒(38章)。
    expect(made.spec.control).toMatchObject({ main: 1800, byoyomi: 30 });
    expect(made.timeText).toBe('持ち時間30分・秒読み30秒');
    const { state: after, result } = playEvent(s, { forced: [true] });
    const entry = after.planBook.cards[made.card];
    expect(entry.games).toBe(result.games.length);
    expect(entry.wins).toBe(result.wins);
    expect(entry.mastery).toBe(s.planBook.cards[made.card].mastery + result.games.length * MASTERY_GAIN.game);
    expect(after.planBook.last).toBe(made.card);
    expect(result.plan).toBe(made.plans.own);
  });

  it('大一番で師匠が選んだ作戦で指す', () => {
    let s = createDiscipleRun({ seed: 21, discipleId: 'ao' });
    for (let i = 0; i < EXAM_TURN; i += 1) s = chooseAction(s, { kind: 'rest' }).state;
    for (const id of Object.keys(s.planBook.cards)) {
      const made = watchSpec(s, { plan: { opening: 'own', ending: 'wait', card: id } });
      expect(made.card).toBe(id);
    }
  });

  it('前の版の記録は、得意戦法の熟練度をその戦法の作戦へ写す', () => {
    const s = createDiscipleRun({ seed: 3, discipleId: 'minato' });
    const old = { ...s, planBook: undefined, mastery: { yagura: 55 } };
    const view = masteryView(old);
    expect(view.count).toBeGreaterThan(2);
    const book = discipleView(old).book;
    expect(book.count).toBe(view.count);
  });
});

describe('作戦の覚え方(35-12)', () => {
  it('棋譜並べを2回すると新しい作戦の候補が出て、1つ覚えられる。あとで閉じることもできる', () => {
    let s = createDiscipleRun({ seed: 5, discipleId: 'minato' });
    s = { ...s, stamina: 100 };
    let offered = null;
    for (let i = 0; i < 8 && !offered; i += 1) {
      const { state: next, result } = chooseAction({ ...s, stamina: 100 }, { kind: 'train', id: 'kifu' });
      s = next;
      if (result.learnOffer) offered = result;
    }
    expect(offered?.text).toMatch(/新しい作戦を覚えられる/);
    expect(s.planStudy % PLAN_STUDY_EVERY).toBe(0);
    const offer = discipleView(s).book.offer;
    expect(offer.length).toBeGreaterThan(0);
    expect(skipLearn(s).planBook.offer).toBeUndefined();
    const { state: learned, text } = learnPlan(s, offer[0].id);
    expect(text).toMatch(/覚えました/);
    expect(learned.planBook.cards[offer[0].id]).toBeTruthy();
    expect(learned.planBook.offer).toBeUndefined();
    expect(learnPlan(learned, offer[1]?.id ?? 'x').text).toBe('');
  });

  it('研究会で、ときどき奇襲を教わる', () => {
    let taught = '';
    for (let seed = 1; seed < 40 && !taught; seed += 1) {
      const s = createDiscipleRun({ seed, discipleId: 'ao' });
      taught = chooseAction(s, { kind: 'study' }).result.learned;
    }
    expect(taught).toBeTruthy();
  });

  it('1局目に負けた相手の作戦は、覚えられそうな作戦に入る', () => {
    let found = null;
    for (let seed = 21; seed < 60 && !found; seed += 1) {
      let s = createDiscipleRun({ seed, discipleId: 'ao' });
      for (let i = 0; i < EXAM_TURN; i += 1) s = chooseAction(s, { kind: 'rest' }).state;
      const { state: after, result } = playEvent(s, { forced: [false] });
      if (result.events.includes('相手の作戦を覚えられそう')) found = { before: s, after };
    }
    expect(found).toBeTruthy();
    const [seen] = found.after.planBook.seen;
    expect(found.before.planBook.cards[seen]).toBeUndefined();
    expect(found.after.lastEvent.events).toContain('相手の作戦を覚えられそう');
  });
});

describe('研究メモ(35-13)', () => {
  it('観戦した局の研究の続きの手を作戦の研究メモに書き足し、次の本局に渡す', () => {
    let s = createDiscipleRun({ seed: 21, discipleId: 'ao' });
    for (let i = 0; i < EXAM_TURN; i += 1) s = chooseAction(s, { kind: 'rest' }).state;
    const made = watchSpec(s, {});
    const entries = made.side === 'black'
      ? [{ move: '7g7f', loss: 10, d: { s: 'follow' } }]
      : [{ move: '7g7f', loss: 0 }, { move: '3c3d', loss: 10, d: { s: 'follow' } }];
    const { state: after, result } = playEvent(s, { forced: [true], entries });
    expect(result.events).toContain('研究メモに1つ書き足した');
    expect(Object.values(after.planBook.notes[made.card])).toHaveLength(1);
    // 同じ作戦の次の本局は、研究メモを受け取る。
    const book = after.planBook;
    expect(Object.keys(book.notes[made.card])).toHaveLength(1);
    expect(discipleView(after).book.rows.find((row) => row.id === made.card).memo).toBe(1);
  });
});
