import { describe, expect, it } from 'vitest';
import { advanceToNextGame, createProYear, recordProGame } from './pro-year.mjs';
import { createRoster } from './ryuo-roster.mjs';
import { HANANE, YOSHIHIKO } from './ryuo-story.mjs';
import { PRO_YEAR_SCENES, markProYearScene, proYearScene, proYearSceneDue, seenProYearScene } from './pro-year-story.mjs';

const roster = createRoster({ seed: 3 });
const start = () => createProYear({ seed: 7, fiscalYear: 2026, roster, settings: { world: 30 }, userLevel: 30, userName: 'やこび' });

describe('棋士の1年の場面(docs/pro-year-design.mdの12章)', () => {
  it('台本: 12行まで、羽音は敬語と「！」を使わない', () => {
    for (const scene of Object.values(PRO_YEAR_SCENES)) {
      expect(scene.lines.length).toBeLessThanOrEqual(12);
      for (const entry of scene.lines.filter(({ who }) => who === 'hanane')) {
        expect(entry.text).not.toMatch(/！|です|ます|ございま|お願いします/);
      }
    }
  });

  it('名前・百花の呼び方・棋戦の言葉を差し込む。読み直しのときは決まった言葉', () => {
    const eve = proYearScene('pro-title-eve', { playerName: 'やこび', momokaCall: 'やこびちゃん', vars: { title: '棋王', holder: '天鷺善彦' } });
    expect(eve.lines[1].text).toBe('明日、やこびは天鷺善彦棋王に挑む。');
    expect(eve.lines[2].text).toContain('やこびちゃん');
    expect(proYearScene('pro-title-eve').lines[1].text).toBe('明日、あなたはタイトル保持者のタイトルに挑む。');
    expect(eve.lines.every(({ text }) => !/\{\w+\}/.test(text))).toBe(true);
    expect(proYearScene('none')).toBeNull();
  });

  it('デビューの日は、1年目のまだ指していないときに1回だけ', () => {
    const state = start();
    expect(proYearSceneDue(state)).toMatchObject({ key: 'pro-debut' });
    const seen = markProYearScene(state, 'pro-debut');
    expect(seenProYearScene(seen, 'pro-debut')).toBe(true);
    expect(proYearSceneDue(seen)).toBeNull();
    expect(proYearSceneDue({ ...state, history: [{}] })).toBeNull();
  });

  it('羽音とはじめて当たる対局の前に1回。タイトル戦の第1局の前は、タイトルごとに1回', () => {
    let state = markProYearScene(start(), 'pro-debut');
    let hanane = null;
    let eve = null;
    for (let step = 0; step < 200 && !(hanane && eve); step += 1) {
      state = advanceToNextGame(state);
      if (state.yearDone) break;
      const due = proYearSceneDue(state);
      const opponent = state.players[state.pending.opponentId];
      if (opponent.story === HANANE && !hanane) {
        expect(due).toMatchObject({ key: 'pro-hanane' });
        hanane = due;
        state = markProYearScene(state, due.key);
      } else if (due?.id.startsWith('pro-title-eve') && !eve) {
        expect(state.pending.kind).toBe('finals');
        expect(due.vars.title).toBe(state.pending.titleName);
        eve = due;
        state = markProYearScene(state, due.key);
        expect(proYearSceneDue(state)).toBeNull();
      }
      state = recordProGame(state, 'win').state;
    }
    expect(hanane).not.toBeNull();
    expect(eve).not.toBeNull();
  });
});

describe('封じ手の夜の場面(docs/seal-break-design.mdの2-5)', () => {
  it('番勝負の星で、リード・タイ・カド番の場面を選ぶ', async () => {
    const { proYearSealSceneId, proYearScene } = await import('./pro-year-story.mjs');
    expect(proYearSealSceneId({ winsUser: 2, winsOpponent: 1, need: 4 })).toBe('pro-seal-lead');
    expect(proYearSealSceneId({ winsUser: 1, winsOpponent: 1, need: 4 })).toBe('pro-seal-tie');
    expect(proYearSealSceneId({ winsUser: 0, winsOpponent: 0, need: 4 })).toBe('pro-seal-tie');
    expect(proYearSealSceneId({ winsUser: 1, winsOpponent: 3, need: 4 })).toBe('pro-seal-kado');
    for (const id of ['pro-seal-lead', 'pro-seal-tie', 'pro-seal-kado']) {
      const scene = proYearScene(id, { playerName: 'やこび', vars: { title: '竜王' } });
      expect(scene?.lines.length).toBeGreaterThan(4);
      expect(scene.lines.every((line) => !/\{(name|you|title)\}/.test(line.text))).toBe(true);
      // 羽音は敬語と「！」を使わない。
      for (const line of scene.lines.filter((entry) => entry.who === 'hanane')) expect(line.text).not.toMatch(/！|です|ます/);
    }
  });
});

describe('羽音・善彦との公式戦の場面(docs/pro-year-design.mdの22-3の5)', () => {
  /** 羽音・善彦と当たる公式戦(番勝負でない対局)で止まった状態。 */
  function nextGameVs(state, story) {
    let current = markProYearScene(state, 'pro-debut');
    for (let step = 0; step < 300; step += 1) {
      current = advanceToNextGame(current);
      if (current.yearDone) return null;
      if (current.pending.kind === 'game' && current.players[current.pending.opponentId]?.story === story) return current;
      current = recordProGame(current, 'win').state;
    }
    return null;
  }

  it('羽音の初手合は、羽音との公式戦がもう終わっていれば出さない(分身に任せた対局も数える)', () => {
    const state = nextGameVs(start(), HANANE);
    expect(proYearSceneDue(state)).toMatchObject({ id: 'pro-hanane' });
    const met = structuredClone(state);
    met.games.gPast = { id: 'gPast', a: 'user', b: state.pending.opponentId, user: true, winner: 'b', auto: true };
    expect(proYearSceneDue(met)).toBeNull();
  });

  it('羽音との大一番(決勝など)は、初手合のあとに棋戦ごとに1回', () => {
    const state = nextGameVs(start(), HANANE);
    const big = structuredClone(state);
    big.scenes = [...(big.scenes ?? []), 'pro-hanane'];
    big.pending.stakes = { ...big.pending.stakes, boss: true };
    const due = proYearSceneDue(big);
    const event = big.games[big.pending.gameId].event;
    expect(due).toMatchObject({ key: `pro-hanane-big:${event}`, id: 'pro-hanane-big' });
    expect(proYearSceneDue({ ...big, scenes: [...big.scenes, due.key] })).toBeNull();
    big.pending.stakes.boss = false;
    expect(proYearSceneDue(big)).toBeNull();
  });

  it('善彦とはじめて当たる公式戦の前に「天鷺善彦との初手合」。善彦は声だけで、名前の札が出る', () => {
    const state = nextGameVs(start(), HANANE);
    const vsFather = structuredClone(state);
    vsFather.players[vsFather.pending.opponentId].story = YOSHIHIKO;
    const due = proYearSceneDue(vsFather);
    expect(due).toMatchObject({ key: 'pro-yoshihiko', id: 'pro-yoshihiko' });
    const scene = proYearScene(due.id, { playerName: 'やこび', vars: due.vars });
    expect(scene.lines.filter((entry) => entry.who === 'extra').map((entry) => entry.name)).toEqual(['天鷺善彦', '天鷺善彦']);
    expect(proYearSceneDue({ ...vsFather, scenes: [...(vsFather.scenes ?? []), 'pro-yoshihiko'] })).toBeNull();
  });
});
