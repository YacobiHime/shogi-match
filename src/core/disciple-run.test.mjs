import { describe, expect, it } from 'vitest';
import {
  EXAM_TURN, MAX_TURNS, chooseAction, chooseWords, createDiscipleRun, discipleView, isBigEvent, loadDiscipleRun, nextGoal, planFit,
  playEvent, saveDiscipleRun, trainingPreview, turnCalendar, turnKind,
} from './disciple-run.mjs';
import { STAT_KEYS } from './disciple-strength.mjs';

function memoryStorage() {
  const map = new Map();
  return { getItem: (key) => (map.has(key) ? map.get(key) : null), setItem: (key, value) => map.set(key, String(value)), removeItem: (key) => map.delete(key) };
}
const TRAIN_FOR = { reading: 'jissen', plan: 'kifu', steady: 'fast', mate: 'tsume' };
/** よい師匠のまね: 体力が減ったら休み、いちばん低い能力を稽古する。 */
function playGood(state) {
  let s = state;
  for (let i = 0; i < 400 && !s.end; i += 1) {
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

  it('よい育て方なら、ふつうは上限のターンより前に奨励会への編入の資格に届く', () => {
    const turns = [];
    for (const id of ['minato', 'tsumugi', 'ao']) {
      for (const seed of [11, 12, 13]) {
        const s = playGood(createDiscipleRun({ seed, discipleId: id }));
        expect(s.end).toBeTruthy();
        turns.push(s.end.kind === 'qualified' || s.end.kind === 'top' ? s.end.turn : MAX_TURNS);
      }
    }
    turns.sort((a, b) => a - b);
    expect(turns[Math.floor(turns.length / 2)]).toBeLessThan(MAX_TURNS);
    expect(turns[0]).toBeGreaterThan(30);
  });

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
