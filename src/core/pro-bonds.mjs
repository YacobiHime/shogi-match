// 棋士の1年の「人との関係」(docs/pro-year-design.mdの15-3の1〜4)。画面に依存しない。
// 師匠・兄弟子・同期3人(羽音と研究会の2人)の5人と、会う・指すで深まる絆(段0〜5。下がらない・年度をまたいで続く)。

import { createRng } from './ryuo-random.mjs';
import { HANANE } from './ryuo-story.mjs';

/** 段ごとに要る絆の合計(段1は出会い。段2まで3、段3まで5、段4まで7、段5まで9)。 */
export const BOND_STEPS = Object.freeze([0, 0, 3, 8, 15, 24]);
export const BOND_MAX = 5;
/** 会ったときの絆。研究会で指した相手・公式戦で当たった相手・師匠への報告は1。 */
export const BOND_MEET = 2;
export const BOND_SMALL = 1;

/** 5人の間柄(並びは画面の順)。 */
export const BOND_ROLES = Object.freeze(['mentor', 'senior', 'hanane', 'peer1', 'peer2']);

/**
 * 間柄ごとの、会うとすること・効き目・分身の経験・段5の効き目。gainsは分身の経験(pro-avatar.mjsの能力の鍵)。
 */
export const BOND_DEFS = Object.freeze({
  mentor: Object.freeze({ rel: '師匠', icon: '師', day: 1, meet: '師匠の家で近況を話す', effect: '調子＋1', gains: Object.freeze({ stability: 1 }), perk: '大一番の週の始めに、調子＋1（師匠の電話）', scenes: Object.freeze([2, 3, 4, 5]) }),
  senior: Object.freeze({ rel: '兄弟子', icon: '兄', day: 3, meet: 'VS（1対1の研究）', effect: '次の相手の対策★＋1', gains: Object.freeze({ opening: 1 }), perk: '研究の★の上限＋1', scenes: Object.freeze([2, 3, 4, 5]) }),
  hanane: Object.freeze({ rel: '同期', icon: '羽', day: 4, meet: '将棋会館の帰りに話す', effect: '次の羽音戦の閃き＋1', gains: Object.freeze({ idea: 1 }), perk: '羽音との公式戦で、毎局閃き＋1', scenes: Object.freeze([2, 3, 4, 5]) }),
  peer1: Object.freeze({ rel: '同期', icon: '', day: 4, meet: 'ご飯', effect: '調子＋1', gains: Object.freeze({ reading: 1 }), perk: '研究会の練習対局で、分身の経験が2倍', scenes: Object.freeze([3, 5]) }),
  peer2: Object.freeze({ rel: '同期', icon: '', day: 4, meet: 'ご飯', effect: '調子＋1', gains: Object.freeze({ reading: 1 }), perk: '研究会の練習対局で、分身の経験が2倍', scenes: Object.freeze([3, 5]) }),
});

/** 絆の合計から段(1〜5。0は出会う前)。 */
export function bondLevel(points) {
  const value = Math.max(0, Number(points) || 0);
  let level = 1;
  while (level < BOND_MAX && value >= BOND_STEPS[level + 1]) level += 1;
  return level;
}

/** 次の段までの残り(段5ならnull)と、いまの段の中での進み(0〜1)。 */
export function bondNext(points) {
  const value = Math.max(0, Number(points) || 0);
  const level = bondLevel(value);
  if (level >= BOND_MAX) return null;
  const from = BOND_STEPS[level];
  const to = BOND_STEPS[level + 1];
  return { level: level + 1, need: to - value, ratio: (value - from) / (to - from) };
}

/**
 * 5人を選ぶ(年度をまたいで同じ人)。
 * 師匠は奨励会で選んだ師匠(名前で探す)、いなければ40歳以上のベテランから種で。兄弟子は26〜38歳の上位の棋士から種で。
 * 同期は羽音と研究会の2人。
 * @param {Record<string, any>} players
 * @param {{ seed: number, mentorName?: string, studyMembers?: string[], userId?: string }} options
 * @returns {Record<string, string | null>}
 */
export function pickPeople(players, { seed, mentorName = '', studyMembers = [], userId = 'user' }) {
  const rng = createRng(((Number(seed) || 0) ^ 0x2b0d5) >>> 0);
  const all = Object.values(players ?? {}).filter((member) => member.kind === 'pro' && member.id !== userId);
  const plain = all.filter((member) => !member.story).sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const hanane = all.find((member) => member.story === HANANE)?.id ?? null;
  const taken = new Set([hanane, ...studyMembers].filter(Boolean));
  const named = mentorName ? plain.find((member) => mentorName.startsWith(member.name)) : null;
  const veterans = plain.filter((member) => (member.age ?? 0) >= 40 && !taken.has(member.id));
  const mentorPool = veterans.length ? veterans : plain.filter((member) => !taken.has(member.id));
  const mentor = named?.id ?? (mentorPool.length ? mentorPool[Math.floor(rng.next() * mentorPool.length)].id : null);
  taken.add(mentor);
  const seniors = plain.filter((member) => !taken.has(member.id) && (member.age ?? 0) >= 26 && (member.age ?? 0) <= 38)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 5);
  const senior = seniors.length ? seniors[Math.floor(rng.next() * seniors.length)].id : null;
  const peers = studyMembers.filter((id) => id && id !== hanane && id !== mentor && id !== senior);
  return { mentor, senior, hanane, peer1: peers[0] ?? null, peer2: peers[1] ?? null };
}

/** 5人の絆の初め(全員、段1)。 */
export const emptyBonds = (people) => Object.fromEntries(Object.values(people ?? {}).filter(Boolean).map((id) => [id, { points: 0, seen: [] }]));

/**
 * 絆を足す。段が上がったら{ from, to }を返す。
 * @param {Record<string, { points: number, seen: number[] }>} bonds
 * @param {string} id
 * @param {number} amount
 */
export function addBond(bonds, id, amount) {
  if (!id || !bonds?.[id] || !(amount > 0)) return { bonds, up: null };
  const before = bondLevel(bonds[id].points);
  const next = { ...bonds, [id]: { ...bonds[id], points: (bonds[id].points ?? 0) + amount } };
  const after = bondLevel(next[id].points);
  return { bonds: next, up: after > before ? { from: before, to: after } : null };
}

/** 人のidから間柄。 */
export const roleOf = (people, id) => BOND_ROLES.find((role) => people?.[role] === id) ?? null;

/** 段5の効き目を持っているか。 */
export function hasPerk(state, role) {
  const id = state?.people?.[role];
  return Boolean(id && bondLevel(state?.bonds?.[id]?.points) >= BOND_MAX);
}
/** 同期2人のどちらかが段5か(研究会の経験が2倍)。 */
export const peerPerk = (state) => hasPerk(state, 'peer1') || hasPerk(state, 'peer2');

/** 場面のid(段が上がったときの場面。同期2人は同じ台本に名前を差し込む)。 */
export const bondSceneId = (role, level) => `pro-bond-${role.startsWith('peer') ? 'peer' : role}-${level}`;

/**
 * まだ見ていない場面(段が上がった人のうち、いちばん古いもの)。
 * @param {any} state
 * @param {{ hold?: string[] }} [options]
 * @returns {{ role: string, id: string, level: number, scene: string } | null}
 */
export function bondSceneDue(state, { hold = [] } = {}) {
  for (const role of BOND_ROLES) {
    const id = state?.people?.[role];
    const bond = id ? state?.bonds?.[id] : null;
    // holdは番勝負を戦っている相手(docs/pro-year-design.mdの23章)。その人の場面は番勝負が終わるまで後回し。
    if (!bond || hold.includes(id)) continue;
    const level = bondLevel(bond.points);
    for (const at of BOND_DEFS[role].scenes) {
      if (at <= level && !(bond.seen ?? []).includes(at)) return { role, id, level: at, scene: bondSceneId(role, at) };
    }
  }
  return null;
}

/** 場面を見た印。 */
export function markBondScene(bonds, id, level) {
  if (!bonds?.[id]) return bonds;
  const seen = [...new Set([...(bonds[id].seen ?? []), level])].sort((a, b) => a - b);
  return { ...bonds, [id]: { ...bonds[id], seen } };
}
