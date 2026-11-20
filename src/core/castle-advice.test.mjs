// 囲いのおすすめと組み替え(docs/opening-guide-ux-design.mdの14-3・14-4)。
import { describe, expect, it } from 'vitest';
import { AUTO_CASTLE, castleAdviceApplies, castleAdviceLine, castleSwitch, recommendCastle } from './castle-advice.mjs';
import { OPENING_PLANS, openingPlanById } from './opening-catalog.mjs';

const ibisha = openingPlanById('ibisha');

describe('囲いのおすすめ', () => {
  it('分からない・居飛車・角換わりは矢倉、振り飛車は左美濃。舟囲いは勧めない', () => {
    expect(recommendCastle({ castles: ibisha.castles })).toBe('yagura');
    expect(recommendCastle({ castles: ibisha.castles, opponentRook: 'static' })).toBe('yagura');
    expect(recommendCastle({ castles: ibisha.castles, opponentRook: 'ranging' })).toBe('left-mino');
    expect(recommendCastle({ castles: ibisha.castles, bishopExchanged: true })).toBe('yagura');
    for (const opponentRook of ['', 'static', 'ranging']) expect(recommendCastle({ castles: ibisha.castles, opponentRook })).not.toBe('funagakoi');
  });

  it('居飛車の作戦では、舟囲いを先頭(◎)に置かない', () => {
    for (const plan of OPENING_PLANS.filter(({ group }) => group === 'static')) expect(plan.castles[0], plan.id).not.toBe('funagakoi');
  });

  it('おすすめを出すのは、合う囲いが2つ以上の居飛車の作戦だけ', () => {
    expect(castleAdviceApplies(ibisha)).toBe(true);
    expect(castleAdviceApplies(openingPlanById('yagura'))).toBe(false);
    expect(castleAdviceApplies(openingPlanById('shiken'))).toBe(false);
    expect(castleAdviceApplies(openingPlanById('castle:mino'))).toBe(false);
    expect(AUTO_CASTLE).toBe('auto');
  });
});

describe('対局中の組み替え', () => {
  const base = { auto: true, current: 'yagura', castles: ibisha.castles, started: false, complete: false };
  it('まだ囲いの駒を動かしていなければ、相手が振ったら黙って左美濃へ', () => {
    expect(castleSwitch({ ...base, opponentRook: 'ranging' })).toMatchObject({ action: 'switch', to: 'left-mino', situation: 'ranging' });
  });
  it('組み始めていたら1回だけ聞く', () => {
    const asked = castleSwitch({ ...base, started: true, opponentRook: 'ranging' });
    expect(asked).toMatchObject({ action: 'ask', to: 'left-mino' });
    expect(castleSwitch({ ...base, started: true, opponentRook: 'ranging', asked: ['ranging'] }).action).toBe('none');
  });
  it('左美濃のまま角換わりになったら矢倉へ', () => {
    expect(castleSwitch({ ...base, current: 'left-mino', bishopExchanged: true, started: true })).toMatchObject({ action: 'ask', to: 'yagura', situation: 'exchanged' });
  });
  it('自分で選んだ囲い・完成した囲いは替えない', () => {
    expect(castleSwitch({ ...base, auto: false, opponentRook: 'ranging' }).action).toBe('none');
    expect(castleSwitch({ ...base, complete: true, opponentRook: 'ranging' }).action).toBe('none');
    expect(castleSwitch({ ...base, opponentRook: 'static' }).action).toBe('none');
  });
  it('やこび姫の一言に囲いの名前が入る', () => {
    expect(castleAdviceLine('switch', 'ranging', '左美濃')).toBe('振り飛車だね。囲いは左美濃にするよ！');
    expect(castleAdviceLine('ask', 'exchanged', '金矢倉')).toBe('角換わりになったよ。金矢倉に組み替える？');
  });
});
