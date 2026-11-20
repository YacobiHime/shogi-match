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

describe('場合分けを増やした夜(docs/pro-year-design.mdの31章)', async () => {
  const { proYearSealSceneId, sealKind, rotateScene, sceneryText, titleEveId, defenseEveId, proYearScene } = await import('./pro-year-story.mjs');
  const { PRO_YEAR_MORE_SCENES, SEAL_ROTATIONS } = await import('./pro-year-story-more.mjs');

  it('番勝負の星に、王手(あと1勝)と最終局を足す', () => {
    expect(sealKind({ winsUser: 3, winsOpponent: 1, need: 4 })).toBe('oute');
    expect(sealKind({ winsUser: 3, winsOpponent: 3, need: 4 })).toBe('final');
    expect(sealKind({ winsUser: 1, winsOpponent: 3, need: 4 })).toBe('kado');
    expect(sealKind({ winsUser: 2, winsOpponent: 1, need: 4 })).toBe('lead');
    expect(sealKind({ winsUser: 0, winsOpponent: 0, need: 4 })).toBe('tie');
    expect(proYearSealSceneId({ winsUser: 3, winsOpponent: 3, need: 4, rival: 'hanane' })).toBe('pro-seal-hanane-final');
  });

  it('同じ場合が続く夜は、局ごとに別の台本になる。同じ局ならいつも同じ', () => {
    const seed = '王位戦:2027';
    const nights = [0, 1, 2].map((turn) => rotateScene(SEAL_ROTATIONS.tie, turn, seed));
    expect(new Set(nights).size).toBe(3);
    expect(proYearSealSceneId({ winsUser: 1, winsOpponent: 1, need: 4, seed })).toBe(proYearSealSceneId({ winsUser: 1, winsOpponent: 1, need: 4, seed }));
    expect(proYearSealSceneId({ winsUser: 1, winsOpponent: 1, need: 4 })).toBe('pro-seal-tie');
  });

  it('回す台本は、どれも台本の目録にある', () => {
    for (const ids of Object.values(SEAL_ROTATIONS)) for (const id of ids) expect(proYearScene(id), id).not.toBeNull();
  });

  it('季節の1行は、対局の月から選ぶ', () => {
    expect(sceneryText('2027-08-10', 'oi')).toMatch(/虫|熱|夏祭り/);
    expect(sceneryText('2028-02-01', 'osho')).toMatch(/雪|冷たい|白く/);
    expect(sceneryText('', 'x')).toBe('');
  });

  it('前夜の場合分け: 奪還＞2度目＞冠を持って＞挑戦の経験あり＞はじめて。防衛は冠の数＞連覇＞はじめて', () => {
    expect(titleEveId({ heldBefore: true, challengedHere: true })).toBe('pro-title-eve-retake');
    expect(titleEveId({ challengedHere: true, crowns: 2 })).toBe('pro-title-eve-again');
    expect(titleEveId({ crowns: 1, challengedAny: true })).toBe('pro-title-eve-crowned');
    expect(titleEveId({ challengedAny: true })).toBe('pro-title-eve-next');
    expect(titleEveId({})).toBe('pro-title-eve');
    expect(defenseEveId({ crowns: 2, streak: 5 })).toBe('pro-defense-eve-crowns');
    expect(defenseEveId({ streak: 2 })).toBe('pro-defense-eve-again');
    expect(defenseEveId({ streak: 1 })).toBe('pro-defense-eve');
  });

  it('新しい台本は、差し込みがなくても読め、題名に差し込みを書かない', () => {
    for (const id of Object.keys(PRO_YEAR_MORE_SCENES)) {
      const scene = proYearScene(id, { playerName: 'やこび' });
      expect(scene.title, id).not.toMatch(/\{/);
      expect(scene.lines.map((entry) => entry.text).join(''), id).not.toMatch(/\{[a-zA-Z]+\}/);
      expect(scene.lines.length, id).toBeGreaterThanOrEqual(6);
    }
  });

  it('次の年度の同じタイトルの番勝負でも、前夜を出す(見た印は棋戦と年度ごと)', () => {
    let state = markProYearScene(start(), 'pro-debut');
    for (let step = 0; step < 300; step += 1) {
      state = advanceToNextGame(state);
      if (state.yearDone) break;
      const due = proYearSceneDue(state);
      if (due?.id.startsWith('pro-title-eve')) {
        expect(due.key.endsWith(`:${state.fy}`)).toBe(true);
        expect(proYearSceneDue(markProYearScene(state, due.key))).toBeNull();
        const nextYear = { ...state, fy: state.fy + 1, scenes: [...(state.scenes ?? []), due.key] };
        const again = proYearSceneDue(nextYear);
        expect(again).not.toBeNull();
        // 羽音・善彦でない相手なら、同じ棋戦に次の年度も挑むと2度目の挑戦の前夜になる。
        if (due.id === 'pro-title-eve') expect(again.id).toBe('pro-title-eve-again');
        return;
      }
      if (due) state = markProYearScene(state, due.key);
      state = recordProGame(state, 'win').state;
    }
    throw new Error('タイトル戦の第1局に届かなかった');
  });
});

describe('勝ち方・負け方と調子で分かれる夜(docs/pro-year-design.mdの32章)', async () => {
  const { seriesShape, seriesNightId, proYearSealSceneId, titleEveId, defenseEveId, proYearScene } = await import('./pro-year-story.mjs');
  const { PRO_YEAR_MOOD_SCENES } = await import('./pro-year-story-more.mjs');
  const W = true;
  const L = false;

  it('番勝負の流れ: ストレート・カド番からの逆転・王手から逆転された・フルセット', () => {
    expect(seriesShape([W, W, W, W], 4)).toBe('sweep');
    expect(seriesShape([L, L, L, L], 4)).toBe('sweep');
    expect(seriesShape([L, L, L, W, W, W, W], 4)).toBe('comeback');
    expect(seriesShape([W, W, W, L, L, L, L], 4)).toBe('collapse');
    expect(seriesShape([W, L, W, L, W, L, W], 4)).toBe('fullset');
    expect(seriesShape([W, L, W, W, W], 4)).toBe('plain');
    expect(seriesShape([W, L, W, L, W], 3)).toBe('fullset');
  });

  it('番勝負のあとの夜: 取ったら流れで、節目の夜があればなし。負けたら流れと歩みで', () => {
    expect(seriesNightId({ kind: 'take', shape: 'sweep' })).toBe('pro-series-sweep-win');
    expect(seriesNightId({ kind: 'defend', shape: 'comeback' })).toBe('pro-series-comeback-win');
    expect(seriesNightId({ kind: 'retake', shape: 'plain' })).toBe('pro-series-win');
    expect(seriesNightId({ kind: 'take', shape: 'sweep', special: true })).toBeNull();
    expect(seriesNightId({ kind: 'lost', shape: 'sweep', longHeld: true })).toBe('pro-series-sweep-loss');
    expect(seriesNightId({ kind: 'lost', shape: 'plain', longHeld: true })).toBe('pro-title-lost-long');
    expect(seriesNightId({ kind: 'lost', shape: 'fullset', crownsOther: 2 })).toBe('pro-series-close-loss');
    expect(seriesNightId({ kind: 'lost', shape: 'plain', crownsOther: 2 })).toBe('pro-title-lost-still');
    expect(seriesNightId({ kind: 'miss', shape: 'collapse' })).toBe('pro-series-collapse-loss');
    expect(seriesNightId({ kind: 'miss', shape: 'plain' })).toBe('pro-series-miss');
  });

  it('封じ手の夜: 2連敗・2連勝して迎えたタイ・リードの夜。カド番と羽音の夜は今までどおり', () => {
    expect(proYearSealSceneId({ winsUser: 2, winsOpponent: 2, need: 4, recent: [W, W, L, L] })).toBe('pro-seal-after-losses');
    expect(proYearSealSceneId({ winsUser: 2, winsOpponent: 0, need: 4, recent: [W, W] })).toBe('pro-seal-momentum');
    expect(proYearSealSceneId({ winsUser: 1, winsOpponent: 3, need: 4, recent: [W, L, L, L] })).toBe('pro-seal-kado');
    expect(proYearSealSceneId({ winsUser: 2, winsOpponent: 2, need: 4, recent: [W, W, L, L], rival: 'hanane' })).toBe('pro-seal-hanane-tie');
  });

  it('前夜: 雪辱・連敗のあと・連勝中・同じ挑戦者', () => {
    expect(titleEveId({ revenge: true, challengedHere: true })).toBe('pro-title-eve-revenge');
    expect(titleEveId({ heldBefore: true, revenge: true })).toBe('pro-title-eve-retake');
    expect(titleEveId({ run: -3, challengedHere: true })).toBe('pro-title-eve-slump');
    expect(titleEveId({ run: 6, crowns: 1 })).toBe('pro-eve-hot');
    expect(defenseEveId({ rematch: true, run: -5 })).toBe('pro-defense-eve-rematch');
    expect(defenseEveId({ run: -3, crowns: 3 })).toBe('pro-defense-eve-slump');
    expect(defenseEveId({ run: 6, streak: 3 })).toBe('pro-eve-hot');
  });

  it('台本は差し込みがなくても読め、局の数を決めて書かない', () => {
    for (const id of Object.keys(PRO_YEAR_MOOD_SCENES)) {
      const scene = proYearScene(id, { playerName: 'やこび' });
      expect(scene.title, id).not.toMatch(/\{/);
      const text = scene.lines.map((entry) => entry.text).join('');
      expect(text, id).not.toMatch(/\{[a-zA-Z]+\}/);
      expect(text, id).not.toMatch(/[47]局/);
    }
  });

  it('公式戦の連敗で調子の夜、連敗を抜けた勝ちで抜けた夜を積む', () => {
    let state = markProYearScene(start(), 'pro-debut');
    const queued = [];
    const results = ['loss', 'loss', 'loss', 'loss', 'win'];
    for (const outcome of results) {
      state = advanceToNextGame(state);
      if (state.yearDone) break;
      state = recordProGame(state, outcome).state;
      for (const item of state.sceneQueue ?? []) if (!queued.includes(item.id)) queued.push(item.id);
    }
    expect(state.user.form.run).toBe(1);
    expect(state.user.form.recent).toEqual([0, 0, 0, 0, 1]);
    expect(queued.some((id) => id === 'pro-slump' || id === 'pro-slump-2')).toBe(true);
    expect(queued).toContain('pro-slump-end');
  });
});

describe('調子と番勝負の記録の保存(32-3)', async () => {
  const { packProYear, unpackProYear } = await import('./pro-year.mjs');
  it('保存から戻しても、連勝・連敗と番勝負の記録が残る', () => {
    const state = start();
    state.user.form = { run: -3, recent: [1, 0, 0, 0] };
    state.user.seriesLog = [{ event: 'kio', fy: 2026, opponentId: 'p1', won: false, kind: 'miss', score: [1, 3], shape: 'plain' }];
    const back = unpackProYear(packProYear(state));
    expect(back.user.form).toEqual(state.user.form);
    expect(back.user.seriesLog).toEqual(state.user.seriesLog);
  });
});

describe('何年目か・絆・相手の格(docs/pro-year-design.mdの33章)', async () => {
  const { eveFlavor, deepBond, careerYears, seriesNightId, titleEveId, defenseEveId, proYearScene, UPSET_GAP } = await import('./pro-year-story.mjs');
  const { PRO_YEAR_LIFE_SCENES } = await import('./pro-year-story-more.mjs');

  it('絆の段4以上の人(番勝負の相手と羽音は除く)から、いちばん深い人を選ぶ', () => {
    const state = {
      people: { mentor: 'm', senior: 's', hanane: 'h', peer1: 'p', peer2: null },
      bonds: { m: { points: 15 }, s: { points: 24 }, h: { points: 24 }, p: { points: 3 } },
      players: { m: { name: '師匠の人' }, s: { name: '兄弟子の人' }, h: { name: '羽音' }, p: { name: '同期の人' } },
    };
    expect(deepBond(state)).toEqual({ role: 'senior', name: '兄弟子の人' });
    expect(deepBond(state, 's')).toEqual({ role: 'mentor', name: '師匠の人' });
    expect(deepBond({ ...state, bonds: {} })).toBeNull();
  });

  it('前夜の色づけは、絆の電話・ベテラン・出さない年を種で回す', () => {
    const bond = { role: 'peer1', name: 'x' };
    const picks = new Set(Array.from({ length: 30 }, (_, i) => eveFlavor({ years: 9, bond, seed: `kio:${2030 + i}` })));
    expect(picks).toEqual(new Set(['pro-eve-bond-peer', 'pro-eve-veteran', '']));
    expect(eveFlavor({ years: 2 })).toBe('');
    expect(titleEveId({ challengedHere: true, flavor: 'pro-eve-veteran' })).toBe('pro-title-eve-again');
    expect(titleEveId({ crowns: 1, flavor: 'pro-eve-veteran' })).toBe('pro-eve-veteran');
    expect(defenseEveId({ crowns: 3, flavor: 'pro-eve-bond-mentor' })).toBe('pro-eve-bond-mentor');
    expect(defenseEveId({ rematch: true, flavor: 'pro-eve-bond-mentor' })).toBe('pro-defense-eve-rematch');
  });

  it('何年目かは、半年の年度を数えない', () => {
    expect(careerYears({ history: [{}, { half: true }, {}] })).toBe(3);
    expect(careerYears({})).toBe(1);
  });

  it('大金星とまさかの夜', () => {
    expect(seriesNightId({ kind: 'take', shape: 'plain', gap: UPSET_GAP })).toBe('pro-series-upset-win');
    expect(seriesNightId({ kind: 'take', shape: 'sweep', gap: UPSET_GAP })).toBe('pro-series-sweep-win');
    expect(seriesNightId({ kind: 'lost', shape: 'fullset', gap: -UPSET_GAP, longHeld: true })).toBe('pro-series-upset-loss');
    expect(seriesNightId({ kind: 'miss', shape: 'plain', gap: -UPSET_GAP })).toBe('pro-series-upset-loss');
    expect(seriesNightId({ kind: 'miss', shape: 'plain', gap: UPSET_GAP })).toBe('pro-series-miss');
  });

  it('台本は、名前の札にも絆の人の名前が入り、差し込みが残らない', () => {
    const scene = proYearScene('pro-eve-bond-mentor', { playerName: 'やこび', vars: { bondName: '山田九段', title: '王位' } });
    expect(scene.lines.filter((entry) => entry.who === 'extra').every((entry) => entry.name === '山田九段')).toBe(true);
    for (const id of Object.keys(PRO_YEAR_LIFE_SCENES)) {
      const plain = proYearScene(id, { playerName: 'やこび' });
      expect(plain.title, id).not.toMatch(/\{/);
      expect(plain.lines.map((entry) => `${entry.name}${entry.text}`).join(''), id).not.toMatch(/\{[a-zA-Z]+\}/);
    }
  });

  it('5年目の年度の始まりに、節目の夜を積む(4年目の始まりには積まない)', async () => {
    const { startNextYear } = await import('./pro-year.mjs');
    const done = (history) => ({ ...structuredClone(start()), yearDone: true, summary: { fy: 2026 }, history });
    const fifth = startNextYear(done([{}, {}, {}]));
    expect(fifth.sceneQueue?.find((item) => item.id === 'pro-anniversary')).toMatchObject({ key: 'pro-anniversary:5', vars: { years: '5' } });
    const fourth = startNextYear(done([{}, {}]));
    expect(fourth.sceneQueue?.some((item) => item.id === 'pro-anniversary') ?? false).toBe(false);
  });
});

describe('羽音から取った夜・羽音の挑戦を退けた夜(docs/pro-year-design.mdの34章)', async () => {
  const { hananeBeatId, HANANE_TAKE_ROTATION, HANANE_DEFEND_ROTATION } = await import('./pro-year-story.mjs');
  const { PRO_YEAR_HANANE_SCENES } = await import('./pro-year-story-more.mjs');
  const { storyEpisode } = await import('./story-mode.mjs');

  it('永世称号＞取り返した＞はじめて＞無冠＞続けて退けた＞流れ＞回す', () => {
    expect(hananeBeatId({ kind: 'take', shape: 'sweep', beats: 3, eternal: true })).toBe('pro-beat-hanane-eternal');
    expect(hananeBeatId({ kind: 'retake', shape: 'sweep', beats: 0, retake: true })).toBe('pro-beat-hanane-retake');
    expect(hananeBeatId({ kind: 'take', shape: 'sweep', beats: 0, mukan: true })).toBe('pro-beat-hanane-take-first');
    expect(hananeBeatId({ kind: 'defend', shape: 'sweep', beats: 0, defendRun: 1 })).toBe('pro-beat-hanane-defend-first');
    expect(hananeBeatId({ kind: 'take', shape: 'sweep', beats: 1, mukan: true })).toBe('pro-beat-hanane-mukan');
    expect(hananeBeatId({ kind: 'defend', shape: 'sweep', beats: 1, defendRun: 2 })).toBe('pro-beat-hanane-defend-again');
    for (const [shape, take, defend] of [['comeback', 'take-comeback', 'defend-comeback'], ['sweep', 'take-sweep', 'defend-sweep'], ['fullset', 'take-fullset', 'defend-fullset']]) {
      expect(hananeBeatId({ kind: 'take', shape, beats: 1 })).toBe(`pro-beat-hanane-${take}`);
      expect(hananeBeatId({ kind: 'defend', shape, beats: 1, defendRun: 1 })).toBe(`pro-beat-hanane-${defend}`);
    }
    // 流れで決まらないときは、勝った回数で回す。5度目の番勝負からは「何度目か」の夜も入る。
    const takes = [1, 2, 3, 4].map((beats) => hananeBeatId({ kind: 'take', shape: 'plain', beats }));
    expect(takes).toEqual([...HANANE_TAKE_ROTATION]);
    const defends = [1, 2, 3, 4].map((beats) => hananeBeatId({ kind: 'defend', shape: 'plain', beats, defendRun: 1 }));
    expect(defends).toEqual([...HANANE_DEFEND_ROTATION]);
    expect(hananeBeatId({ kind: 'take', shape: 'plain', beats: 5, series: 4 })).toBe('pro-beat-hanane-long');
    expect(hananeBeatId({ kind: 'take', shape: 'plain', beats: 5, series: 2 })).toBe('pro-beat-hanane');
  });

  it('台本: 羽音は慰めも応援も言わず、差し込みが残らず、物語のサブで読み直せる', () => {
    expect(Object.keys(PRO_YEAR_HANANE_SCENES).length).toBeGreaterThanOrEqual(15);
    for (const id of Object.keys(PRO_YEAR_HANANE_SCENES)) {
      expect(storyEpisode(`pro:${id}`)?.scene, id).toBe(id);
      const plain = proYearScene(id, { playerName: 'やこび' });
      expect(plain.title, id).not.toMatch(/\{/);
      expect(plain.lines.map((entry) => `${entry.name ?? ''}${entry.text}`).join(''), id).not.toMatch(/\{[a-zA-Z]+\}/);
      for (const entry of plain.lines.filter((line) => line.who === 'hanane')) expect(entry.text, id).not.toMatch(/応援|がんば|！|です|ます/);
      for (const entry of plain.lines.filter((line) => line.who === 'momoka')) expect(entry.face, id).not.toBe('smile');
    }
    const filled = proYearScene('pro-beat-hanane-take-sweep', { playerName: 'やこび', vars: { title: '王座', score: '3勝0敗', played: '3', result: '王座戦の番勝負が終わった。' } });
    const text = filled.lines.map((entry) => entry.text).join('\n');
    expect(text).toContain('3勝0敗');
    expect(text).toContain('3局、一度も勝たせてもらえなかった。');
  });
});

describe('羽音に取られた夜・羽音に挑んで届かなかった夜(docs/pro-year-design.mdの35章)', async () => {
  const { hananeLostId, HANANE_LOST_ROTATION, HANANE_MISS_ROTATION } = await import('./pro-year-story.mjs');
  const { PRO_YEAR_HANANE_LOST_SCENES } = await import('./pro-year-story-more.mjs');
  const { storyEpisode } = await import('./story-mode.mjs');

  it('取られた：取り返された＞はじめて＞無冠＞長く守った＞流れ＞回す', () => {
    expect(hananeLostId({ kind: 'lost', shape: 'sweep', losses: 0, retaken: true })).toBe('pro-lost-hanane-retaken');
    expect(hananeLostId({ kind: 'lost', shape: 'sweep', losses: 0, mukan: true })).toBe('pro-lost-hanane-lost-first');
    expect(hananeLostId({ kind: 'lost', shape: 'sweep', losses: 1, mukan: true, longHeld: true })).toBe('pro-lost-hanane-mukan');
    expect(hananeLostId({ kind: 'lost', shape: 'sweep', losses: 1, longHeld: true })).toBe('pro-lost-hanane-lost-long');
    for (const shape of ['collapse', 'sweep', 'fullset']) expect(hananeLostId({ kind: 'lost', shape, losses: 1 })).toBe(`pro-lost-hanane-lost-${shape}`);
    expect([1, 2, 3, 4].map((losses) => hananeLostId({ kind: 'lost', shape: 'plain', losses }))).toEqual([...HANANE_LOST_ROTATION]);
  });

  it('届かなかった：はじめて＞続けて届かない＞流れ＞回す。5度目の番勝負からは「何度目か」も回しに入る', () => {
    expect(hananeLostId({ kind: 'miss', shape: 'sweep', losses: 0, missRun: 3 })).toBe('pro-lost-hanane-miss-first');
    expect(hananeLostId({ kind: 'miss', shape: 'sweep', losses: 2, missRun: 2 })).toBe('pro-lost-hanane-miss-again');
    for (const shape of ['collapse', 'sweep', 'fullset']) expect(hananeLostId({ kind: 'miss', shape, losses: 1, missRun: 1 })).toBe(`pro-lost-hanane-miss-${shape}`);
    expect([1, 2, 3, 4].map((losses) => hananeLostId({ kind: 'miss', shape: 'plain', losses, missRun: 1 }))).toEqual([...HANANE_MISS_ROTATION]);
    expect(hananeLostId({ kind: 'miss', shape: 'plain', losses: 5, series: 4, missRun: 1 })).toBe('pro-lost-hanane-long');
  });

  it('台本: 羽音は慰めも応援も言わず、百花は笑顔を使わず、差し込みが残らず、物語のサブで読み直せる', () => {
    expect(Object.keys(PRO_YEAR_HANANE_LOST_SCENES).length).toBeGreaterThanOrEqual(15);
    for (const id of Object.keys(PRO_YEAR_HANANE_LOST_SCENES)) {
      expect(storyEpisode(`pro:${id}`)?.scene, id).toBe(id);
      const plain = proYearScene(id, { playerName: 'やこび' });
      expect(plain.title, id).not.toMatch(/\{/);
      expect(plain.lines.map((entry) => `${entry.name ?? ''}${entry.text}`).join(''), id).not.toMatch(/\{[a-zA-Z]+\}/);
      for (const entry of plain.lines.filter((line) => line.who === 'hanane')) expect(entry.text, id).not.toMatch(/応援|がんば|！|です|ます/);
      for (const entry of plain.lines.filter((line) => line.who === 'momoka')) expect(entry.face, id).not.toBe('smile');
    }
  });
});
