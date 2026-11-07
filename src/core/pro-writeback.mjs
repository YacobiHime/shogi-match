// 棋士の1年の結果を、棋士の世界(名簿)へ書き戻す(docs/pro-year-design.mdの15-3の8)。画面と保存に依存しない。
// 書くのは、自分の竜王戦の組と竜王、順位戦のクラスと名人、ほかの棋士のタイトル保持者。レーティングと能力は書かない(世界の物差しを崩さない)。
// 竜王戦・名人戦の期の途中なら、その棋戦の部分だけ書かない。書き戻しは一方向(棋士の1年は名簿を読み直さない)。

import { USER_HOLDER } from './ryuo-roster.mjs';
import { syncJunni } from './ryuo-league.mjs';

const PRO_USER_ID = 'user';
const CLASS_NAMES = Object.freeze({ A: 'A級', B1: 'B級1組', B2: 'B級2組', C1: 'C級1組', C2: 'C級2組' });
const NEXT_CLASS = Object.freeze({ C2: 'C1', C1: 'B2', B2: 'B1', B1: 'A', A: 'A' });
/** 名簿に書くほかのタイトル(竜王は名簿のholder、名人は順位戦の世界のholder)。 */
const OTHER_TITLES = Object.freeze(['eio', 'kisei', 'oi', 'oza', 'kio', 'osho']);
const TITLE_SHORT = Object.freeze({ eio: '叡王', kisei: '棋聖', oi: '王位', oza: '王座', kio: '棋王', osho: '王将', ryuo: '竜王', meijin: '名人' });

/**
 * 書き戻す中身(画面の札。書く前に見せる)。
 * @param {any} state 年度を終えた棋士の1年の状態
 * @param {{ roster: any, ryuoBusy?: boolean, meijinBusy?: boolean }} options ryuoBusy・meijinBusyは、その棋戦の期の途中か
 * @returns {{ items: { ok: boolean, text: string }[], plan: any }}
 */
export function writeBackPlan(state, { roster, ryuoBusy = false, meijinBusy = false }) {
  const items = [];
  const plan = { ryuo: null, junni: null, titles: {} };
  if (!state || !roster) return { items, plan };
  const nameOf = (id) => (id === PRO_USER_ID ? 'あなた' : roster.players?.[id]?.name ?? state.players?.[id]?.name ?? '');
  // 竜王戦: 来期の組(ランキング戦の結果)と竜王。
  const group = state.user?.ryuoResult?.next ?? state.user?.group ?? 6;
  const ryuoHolder = state.titles?.ryuo ?? null;
  if (ryuoBusy) items.push({ ok: false, text: '竜王戦の組：竜王戦の期の途中なので、期が終わってから書きます' });
  else {
    plan.ryuo = { group, champion: ryuoHolder === PRO_USER_ID, holder: ryuoHolder === PRO_USER_ID ? USER_HOLDER : (roster.players?.[ryuoHolder] ? ryuoHolder : null) };
    items.push({ ok: true, text: `竜王戦：あなたは${group}組${plan.ryuo.champion ? '・竜王' : ''}` });
  }
  // 順位戦: 来期のクラスと名人。
  const junni = state.user?.junniResult ?? null;
  const cls = junni?.promoted ? NEXT_CLASS[junni.cls] ?? junni.cls : state.user?.cls ?? 'C2';
  const meijinHolder = state.titles?.meijin ?? null;
  if (!roster.junni) items.push({ ok: false, text: '順位戦：名簿に順位戦の世界がないので書きません' });
  else if (meijinBusy) items.push({ ok: false, text: '順位戦のクラス：名人戦の期の途中なので、期が終わってから書きます' });
  else {
    plan.junni = { cls, meijin: meijinHolder === PRO_USER_ID, holder: meijinHolder === PRO_USER_ID ? PRO_USER_ID : (roster.players?.[meijinHolder] ? meijinHolder : null) };
    const from = state.user?.cls && state.user.cls !== cls ? `${CLASS_NAMES[state.user.cls]} → ` : '';
    items.push({ ok: true, text: `順位戦：あなたは${plan.junni.meijin ? '名人' : `${from}${CLASS_NAMES[cls]}`}` });
  }
  // ほかのタイトル保持者(名簿の棋士だけ。あなたのタイトルは名簿の外の記録)。
  const changed = [];
  const mine = [];
  for (const id of OTHER_TITLES) {
    const holder = state.titles?.[id];
    if (holder === PRO_USER_ID) mine.push(TITLE_SHORT[id]);
    else if (holder && roster.players?.[holder]) {
      plan.titles[id] = holder;
      if (roster.titles?.[id] !== holder) changed.push(`${TITLE_SHORT[id]}は${nameOf(holder)}`);
    }
  }
  items.push({ ok: true, text: changed.length ? `タイトル：${changed.slice(0, 3).join('・')}${changed.length > 3 ? ' ほか' : ''}` : 'タイトル：保持者はいまの名簿のまま' });
  if (mine.length) items.push({ ok: false, text: `あなたの${mine.join('・')}は、棋士の1年の記録に残します（名簿の世界には竜王と名人だけを書きます）` });
  return { items, plan };
}

/**
 * 書き戻す(名簿と竜王戦のキャリアを新しく作って返す。もとは変えない)。
 * @param {any} roster
 * @param {any} career 竜王戦のキャリア
 * @param {ReturnType<typeof writeBackPlan>['plan']} plan
 */
export function applyWriteBack(roster, career, plan) {
  // 画面のリアクティブな値(Proxy)も渡ってくるので、JSONで写す(保存と同じ形)。
  const next = JSON.parse(JSON.stringify(roster));
  const nextCareer = career ? JSON.parse(JSON.stringify(career)) : career;
  if (plan?.ryuo) {
    if (nextCareer) {
      nextCareer.group = Math.max(1, Math.min(6, plan.ryuo.group));
      nextCareer.bestGroup = Math.min(nextCareer.bestGroup ?? 6, nextCareer.group);
      nextCareer.champion = plan.ryuo.champion;
    }
    if (plan.ryuo.holder) {
      const previous = next.holder;
      next.holder = plan.ryuo.holder;
      // 竜王を失った名簿の棋士は1組へ(名簿の決まり)。
      if (previous && previous !== USER_HOLDER && previous !== next.holder && next.players?.[previous]) next.players[previous].group = 1;
    }
  }
  if (plan?.junni && next.junni) {
    const world = next.junni;
    for (const key of Object.keys(world.classes)) world.classes[key] = world.classes[key].filter((id) => id !== PRO_USER_ID);
    if (world.holder === PRO_USER_ID) world.holder = null;
    if (plan.junni.meijin) {
      if (world.holder) world.classes.A = [world.holder, ...(world.classes.A ?? [])];
      world.holder = PRO_USER_ID;
    } else {
      if (plan.junni.holder && plan.junni.holder !== world.holder) {
        if (world.holder) world.classes.A = [world.holder, ...(world.classes.A ?? [])];
        for (const key of Object.keys(world.classes)) world.classes[key] = world.classes[key].filter((id) => id !== plan.junni.holder);
        world.holder = plan.junni.holder;
      }
      world.classes[plan.junni.cls] = [...(world.classes[plan.junni.cls] ?? []), PRO_USER_ID];
    }
    world.userJoined = true;
    syncJunni(next);
  }
  next.titles = { ...(next.titles ?? {}), ...(plan?.titles ?? {}) };
  return { roster: next, career: nextCareer };
}
