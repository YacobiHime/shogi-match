import { describe, expect, it } from 'vitest';
import { PRO_USER_ID, addDays, weekdayOf, advanceToNextGame, createProYear, packProYear, proYearView, recordProGame, startNextYear, unpackProYear } from './pro-year.mjs';
import { createRoster } from './ryuo-roster.mjs';

const roster = createRoster({ seed: 11, userGroup: 6 });
function seeded() {
  const state = createProYear({seed:7,fiscalYear:2026,roster,userLevel:30,userName:'やこび'});
  // 前年の成績で「挑戦者決定戦から」のシードを得た状態を再現する。
  state.user.seeds.oi = 2;
  state.cycles['oi-2026'].entry = 2;
  return state;
}
function seek(source, event, stage, outcome = 'loss') {
  let state = source;
  for(let i=0;i<400;i++) {
    state = advanceToNextGame(state);
    const game = state.pending ? state.games[state.pending.gameId] : null;
    if(game?.event===event && game.stage===stage) return state;
    if(state.yearDone) {
      if(state.fy>=2027) return state;
      state=startNextYear(state);
    } else state=recordProGame(state,outcome).state;
  }
  throw Error('年の進行が完了しません');
}

describe('王位戦の挑戦者決定戦からのシード',()=>{
  it('表示した出場段階の6月にプレイヤーの予定が組まれ、勝てば七番勝負へ進める',()=>{
    const state = seek(seeded(),'oi',2);
    expect(state.pending?.eventId).toBe('oi');
    const game=state.games[state.pending?.gameId];
    expect(game).toMatchObject({stage:2,user:true});
    expect([game.a,game.b]).toContain(PRO_USER_ID);
    expect(game.date.slice(0,7)).toBe('2027-06');
    expect(state.cycles[game.cycle].stages[2].entrants).toContain(PRO_USER_ID);
    const won=recordProGame(state,'win').state;
    const title=seek(won,'oi',3);
    expect(title.pending?.eventId).toBe('oi');
    expect(title.games[title.pending.gameId]).toMatchObject({stage:3,user:true});
  });
  it('シードのない通常のリーグ勝者同士の挑戦者決定戦を変えない',()=>{
    const source=seeded();
    source.user.seeds.oi=1;
    source.cycles['oi-2026'].entry=1;
    const state=seek(source,'oi',2,'win');
    expect(state.pending?.eventId).toBe('oi');
    const cycle=state.cycles[state.games[state.pending.gameId].cycle];
    expect(cycle.stages[2].entrants).toEqual(cycle.stages[1].winners);
  });

  it('シードの挑戦者決定戦で負けた場合は七番勝負へ進めない',()=>{
    const state=seek(seeded(),'oi',2);
    expect(state.pending?.eventId).toBe('oi');
    const cycleId=state.games[state.pending.gameId].cycle;
    const lost=recordProGame(state,'loss').state;
    const after=seek(lost,'oi',3);
    const final=after.cycles[cycleId].stages[3].series;
    expect([final.a,final.b]).not.toContain(PRO_USER_ID);
    expect(after.cycles[cycleId].stages[2].winners).not.toContain(PRO_USER_ID);
  });

  it('前の保存にある未実施のNPC同士の対局を復旧し、ほかの予定と重ねず二重登録もしない',()=>{
    const state=seek(seeded(),'oi',2);
    const game=state.games[state.pending.gameId];
    const cycle=state.cycles[game.cycle];
    const stage=cycle.stages[2];
    const [a,b]=cycle.stages[1].winners;
    state.pending=null;
    stage.entrants=[a,b];stage.user=false;
    stage.series={...stage.series,a,b,wins:{[a]:0,[b]:0}};
    game.a=a;game.b=b;delete game.user;delete game.label;
    // 同じ日にほかの自分の対局がある状態で、日程の衝突も検証する。
    const other=Object.values(state.games).find(g=>g.user&&!g.winner&&g.id!==game.id);
    expect(other).toBeDefined();
    let blocked=addDays(state.date,1);
    while([0,6].includes(weekdayOf(blocked))) blocked=addDays(blocked,1);
    other.date=blocked;
    const packed=packProYear(state);
    const before=structuredClone(packed);
    const restored=unpackProYear(packed,roster);
    expect(packed).toEqual(before);
    const fixed=restored.games[game.id];
    expect(fixed).toMatchObject({user:true,a:PRO_USER_ID,b:a});
    expect(fixed.date>state.date).toBe(true);
    expect(fixed.date).not.toBe(blocked);
    expect(Object.values(restored.games).filter(g=>g.user&&g.id!==game.id).some(g=>g.date===fixed.date)).toBe(false);
    expect(restored.cycles[game.cycle].stages[2].entrants).toEqual([PRO_USER_ID,a]);
    const again=unpackProYear(packProYear(restored),roster);
    expect(again.games[game.id]).toEqual(fixed);
    expect(Object.keys(again.games)).toHaveLength(Object.keys(restored.games).length);
    const ready=seek(restored,'oi',2);
    expect(ready.pending?.gameId).toBe(game.id);
  });

  it('既に結果が決まった対局は読み込みで書き換えない',()=>{
    const state=seek(seeded(),'oi',2);
    const game=state.games[state.pending.gameId];
    const cycle=state.cycles[game.cycle];
    const stage=cycle.stages[2];
    const [a,b]=cycle.stages[1].winners;
    state.pending=null;
    stage.entrants=[a,b];stage.user=false;stage.done=true;stage.winners=[a];cycle.done=true;
    stage.series={...stage.series,a,b,wins:{[a]:1,[b]:0}};
    game.a=a;game.b=b;game.winner='a';delete game.user;delete game.label;
    const restored=unpackProYear(packProYear(state),roster);
    expect(restored.cycles[game.cycle].stages[2]).toEqual(stage);
    expect(restored.games[game.id]).toMatchObject({a,b,winner:'a'});
    expect(restored.games[game.id].user).not.toBe(true);
    const status=proYearView(restored).events.find(event=>event.id==='oi').status;
    expect(status).toMatchObject({text:'今期の棋戦は終了',alive:false});
    expect(status.waiting).not.toBe(true);
  });

});
