import { describe, expect, it } from 'vitest';
import {
  CHARMS, CHARM_GIFTS, CHARM_MAX, DISCIPLE_SCENES, FAMILY_SCENE, SLUMP_SCENE, addCharm, charmList, checkScenes, overcomeSlump, pendingScene, queueScene,
  receiveCharms, resolveScene, useCharm, withCharm,
} from './disciple-events.mjs';
import { chooseAction, createDiscipleRun, currentStrength, playEvent, turnKind, watchSpec } from './disciple-run.mjs';
import { effectiveLevel } from './disciple-strength.mjs';
import { hasLibraryScene, libraryScene } from './novel-library.mjs';
import { DISCIPLES } from './disciple-strength.mjs';

const fresh = (id = 'minato', seed = 7) => createDiscipleRun({ seed, discipleId: id });

describe('お守り(26-1)', () => {
  it('持てる数まで足せ、持たせると強くなり、使うとなくなる', () => {
    const s = structuredClone(fresh());
    for (let i = 0; i < CHARM_MAX + 1; i += 1) addCharm(s, 'sensu');
    expect(s.charms.sensu).toBe(CHARM_MAX);
    expect(addCharm(s, 'nothing')).toBe(false);
    expect(charmList(s).map((c) => c.id)).toEqual(['sensu']);
    const base = effectiveLevel(currentStrength(s));
    for (const charm of CHARMS) {
      addCharm(s, charm.id);
      expect(effectiveLevel(currentStrength(withCharm(s, charm.id))), charm.id).toBeGreaterThanOrEqual(base);
    }
    expect(effectiveLevel(currentStrength(withCharm(s, 'sensu')))).toBeGreaterThan(base);
    expect(withCharm({ ...s, charms: {} }, 'sensu')).toEqual({ ...s, charms: {} });
    expect(withCharm(s, 'tokei').aptitudes.fast.rank).not.toBe(s.aptitudes.fast.rank);
    expect(useCharm(s, 'kachi')).toBe(true);
    expect(s.charms.kachi).toBeUndefined();
  });

  it('仲間の絆と出かけた先でもらえる', () => {
    const s = structuredClone(fresh());
    s.bonds.momoka = CHARM_GIFTS[0].bond;
    expect(receiveCharms(s)).toEqual(['sensu']);
    expect(receiveCharms(s)).toEqual([]);
    const lucky = { next: () => 0 };
    expect(receiveCharms(s, { outing: true, rng: lucky })).toEqual([CHARMS[0].id]);
  });

  it('大一番にだけ使い、観戦の本局にも効く', () => {
    let s = fresh('ao', 11);
    while (turnKind(s) === 'free') s = chooseAction(s, { kind: 'rest' }).state;
    expect(turnKind(s)).toBe('exam');
    s = structuredClone(s);
    addCharm(s, 'techo');
    const plain = watchSpec(s, {});
    const charmed = watchSpec(s, { charm: 'techo' });
    const side = charmed.side;
    expect(charmed.spec[side].disciple.strength.mateLevel).toBeGreaterThan(plain.spec[side].disciple.strength.mateLevel);
    const { state: after, result } = playEvent(s, { charm: 'techo' });
    expect(result.charm).toBe('techo');
    expect(after.charms.techo).toBeUndefined();
  });
});

describe('問題の場面(26-2)', () => {
  it('どの場面にも台本があり、弟子ごとの入門と、答えごとの効き目がある', () => {
    for (const [key, def] of Object.entries(DISCIPLE_SCENES)) {
      const ids = def.script.includes('{disciple}') ? DISCIPLES.map((d) => def.script.replace('{disciple}', d.id)) : def.variants ?? [def.script];
      for (const id of ids) {
        expect(hasLibraryScene(id), id).toBe(true);
        const scene = libraryScene(id, { playerName: '師匠', vars: { disciple: '相沢 湊' } });
        const values = scene.lines.flatMap((line) => line.choices ?? []).map((choice) => choice.value);
        expect(values.sort(), key).toEqual(Object.keys(def.effects).sort());
        expect(JSON.stringify(scene)).not.toContain('{disciple}');
      }
    }
  });

  it('入門の場面から始まり、答えるとやる気が動き、合う答えはもう1段', () => {
    const s = { ...fresh('minato'), mood: 0 };
    expect(pendingScene(s)).toMatchObject({ key: 'intro', script: 'disciple-intro-minato', vars: { disciple: s.name } });
    const fit = resolveScene(s, 'child');
    expect(fit.fit).toBe(true);
    expect(fit.state.mood).toBe(2);
    expect(fit.state.sceneQueue).toEqual([]);
    expect(resolveScene(s, 'promise').state.mood).toBe(1);
    const skipped = resolveScene(s, null);
    expect(skipped.state.mood).toBe(0);
    expect(skipped.state.scenesSeen.intro.count).toBe(1);
    expect(resolveScene(skipped.state, 'child').text).toBe('');
  });

  it('場面は予定を止めない', () => {
    const s = fresh();
    expect(pendingScene(s)).not.toBeNull();
    expect(turnKind(s)).toBe('free');
    expect(chooseAction(s, { kind: 'rest' }).result.kind).toBe('rest');
  });

  it('学校の試験は7月の前半に1年1回、家族の心配は勝てない日が続くと', () => {
    const s = structuredClone(fresh());
    s.sceneQueue = [];
    checkScenes(s, { calendar: { year: 1, month: 7, half: '前半' } });
    checkScenes(s, { calendar: { year: 1, month: 7, half: '前半' } });
    expect(s.sceneQueue).toEqual(['school']);
    expect(pendingScene(s).script).toBe('disciple-school');
    const second = resolveScene(s, null).state;
    second.sceneQueue = ['school'];
    expect(pendingScene(second).script).toBe('disciple-school-2');
    s.sceneQueue = [];
    s.turn = 20;
    for (let i = 0; i < FAMILY_SCENE.zeroDays; i += 1) checkScenes(s, { event: { big: false, wins: 0, losses: 2, promoted: false } });
    expect(s.sceneQueue).toEqual(['family']);
  });

  it('大一番で続けて負けるとスランプ、次の大一番に勝つと乗り越えて不屈を覚える', () => {
    const s = structuredClone(fresh());
    s.sceneQueue = [];
    s.turn = 30;
    for (let i = 0; i < SLUMP_SCENE.losses; i += 1) checkScenes(s, { event: { big: true, wins: 0, losses: 1, promoted: false } });
    expect(s.sceneQueue).toEqual(['slump']);
    expect(s.slump).toBe(true);
    const steady = s.stats.steady;
    expect(overcomeSlump(s, { big: false, wins: 2, losses: 0 }, 6)).toBe(false);
    expect(overcomeSlump(s, { big: true, wins: 2, losses: 0 }, 6)).toBe(true);
    expect(s.stats.steady).toBe(steady + SLUMP_SCENE.overcome.steady);
    expect(s.skills).toContain('unbroken');
  });

  it('はじめての昇級は1回だけ。勝守を渡せる', () => {
    const s = structuredClone(fresh());
    s.sceneQueue = [];
    checkScenes(s, { event: { big: false, wins: 2, losses: 0, promoted: true } });
    expect(s.sceneQueue).toEqual(['promote']);
    const { state: after, charm } = resolveScene(s, 'charm');
    expect(charm).toBe('kachi');
    expect(after.charms.kachi).toBe(1);
    checkScenes(after, { event: { big: false, wins: 2, losses: 0, promoted: true } });
    expect(after.sceneQueue).toEqual([]);
    expect(queueScene(after, 'nope')).toBe(false);
  });
});
