import { describe, expect, it } from 'vitest';
import { proAutoChance, simulateProAutoGame } from './pro-auto-game.mjs';
import { createRng } from './ryuo-random.mjs';
import { createRoster } from './ryuo-roster.mjs';
import { YOSHIHIKO } from './ryuo-story.mjs';
import { emptyAvatar } from './pro-avatar.mjs';
import { PRO_USER_ID, advanceToNextGame, createProYear, proYearView, recordProGame } from './pro-year.mjs';

const roster = createRoster({ seed: 11, userGroup: 6 });
const yoshihiko = Object.values(roster.players).find(player => player.story === YOSHIHIKO);
function fixture(color = 'black') {
  return {
    rng: 20261118, condition: 2, avatar: emptyAvatar(),
    players: { user: { id:'user', rating:yoshihiko.rating + 400 * Math.log10(.61 / .39) }, [yoshihiko.id]:yoshihiko },
    pending: { gameId:'test', opponentId:yoshihiko.id, color, prep:{stars:0} },
    games: { test: { a:color === 'black' ? 'user' : yoshihiko.id, b:color === 'black' ? yoshihiko.id : 'user' } },
  };
}

describe('分身の表示と抽選が同じ確率と先後を使う', () => {
  it.each([['black',.5508875598239512],['white',.5021344144904702]])('旧61%%の条件を補正後の確率に直す: %s', (color, expected) => {
    const state=fixture(color);
    expect(proAutoChance(state)).toBeCloseTo(expected,12);
    const actual=simulateProAutoGame(state,createRng(state.rng));
    expect(actual.probability).toBe(proAutoChance(state));
    expect(actual.aColor).toBe(color);
  });

  it('表示を繰り返しても保存と乱数を変更せず、後の勝敗も変えない', () => {
    const state=fixture();
    const before=structuredClone(state);
    const expected=simulateProAutoGame(state,createRng(state.rng));
    for(let i=0;i<20;i++) expect(proAutoChance(state)).toBe(expected.probability);
    expect(state).toEqual(before);
    expect(simulateProAutoGame(state,createRng(state.rng))).toEqual(expected);
  });

  it('調子・事前研究・成長が表示と抽選の両方に効く', () => {
    const state=fixture();
    const base=proAutoChance(state);
    state.condition=0;
    expect(proAutoChance(state)).toBeLessThan(base);
    state.condition=4;
    expect(proAutoChance(state)).toBeGreaterThan(base);
    state.condition=2;state.pending.prep.stars=3;
    expect(proAutoChance(state)).toBeGreaterThan(base);
    state.pending.prep.stars=0;
    state.avatar.exp=Object.fromEntries(Object.keys(state.avatar.exp).map(key=>[key,180]));
    expect(proAutoChance(state)).toBeGreaterThan(base);
    expect(simulateProAutoGame(state,createRng(state.rng)).probability).toBe(proAutoChance(state));
  });

  it.each(['black','white'])('先後のない前の保存は対局の組み合わせから復元する: %s', color => {
    const state=fixture(color);
    const expected=proAutoChance(state);
    delete state.pending.color;
    expect(proAutoChance(state)).toBe(expected);
    expect(simulateProAutoGame(state).aColor).toBe(color);
  });

  it('戦法相性のある相手でも、各乱数の表示と抽選が一致する', () => {
    const state=fixture();
    state.players.user.character={traits:[{id:'vs-ranging',degree:2}],abilities:{}};
    state.players.user.repertoire=yoshihiko.repertoire;
    const probabilities=new Set();
    for(let seed=1;seed<=100;seed++) {
      state.rng=seed;
      const probability=proAutoChance(state);
      probabilities.add(probability);
      expect(simulateProAutoGame(state,createRng(seed)).probability).toBe(probability);
    }
    expect(probabilities.size).toBeGreaterThan(1);
  });

  it('実際に表示61%となる条件の多数回抽選は約61%になる', () => {
    const state=fixture();
    let low=yoshihiko.rating-400,high=yoshihiko.rating+400;
    for(let i=0;i<45;i++) {
      state.players.user.rating=(low+high)/2;
      if(proAutoChance(state)<.61) low=state.players.user.rating;
      else high=state.players.user.rating;
    }
    expect(proAutoChance(state)).toBeCloseTo(.61,10);
    const rng=createRng(20261118);
    let wins=0,expected=0;
    const games=20000;
    for(let i=0;i<games;i++) {
      state.rng=rng.state;
      const shown=proAutoChance(state);
      const actual=simulateProAutoGame(state,rng);
      expect(actual.probability).toBe(shown);
      wins+=Number(actual.aWins);expected+=shown;
    }
    expect(expected/games).toBeCloseTo(.61,10);
    expect(Math.abs(wins/games-.61)).toBeLessThan(.015);
  });

  it('公式戦以外や相手のない状態では確率を出さない', () => {
    expect(proAutoChance(null)).toBeNull();
    expect(proAutoChance({...fixture(),pending:{kind:'study'}})).toBeNull();
    expect(proAutoChance({...fixture(),players:{}})).toBeNull();
  });
});

describe('棋士の1年への接続', () => {
  const ready=advanceToNextGame(createProYear({seed:7,fiscalYear:2026,roster,userLevel:30,userName:'やこび'}));
  it('画面に渡す確率と実際の勝敗が同じで、千日手で先後が替わっても一致する', () => {
    for(const source of [ready,recordProGame(ready,'draw').state]) {
      for(let seed=1;seed<=20;seed++) {
        const state=structuredClone(source);state.rng=seed;
        const before=structuredClone(state);
        const expected=simulateProAutoGame(state);
        expect(proYearView(state).pending.autoChance).toBe(expected.probability);
        expect(state).toEqual(before);
        const actual=recordProGame(state,'auto').state;
        expect(actual.lastGame.won).toBe(expected.aWins);
        const game=actual.games[state.pending.gameId];
        expect(game.winner==='a'?game.a:game.b).toBe(expected.aWins?PRO_USER_ID:state.pending.opponentId);
      }
    }
  });
});
