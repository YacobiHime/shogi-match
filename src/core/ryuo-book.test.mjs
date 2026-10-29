import { describe, expect, it } from 'vitest';
import { BOOK_JUNNI_TABS, bookMembers, junniText, memberProfile, memberTone, rosterBook } from './ryuo-book.mjs';
import { createRoster } from './ryuo-roster.mjs';
import { addVsUser } from './ryuo-roster.mjs';
import { HANANE, storyMemberId } from './ryuo-story.mjs';

describe('棋士名鑑(やこびノートの棋士名鑑)', () => {
  const roster = createRoster({ seed: 51 });
  const hanane = storyMemberId(roster, HANANE);
  const opponent = roster.junni.classes.C2[3];
  addVsUser(roster, [{ opponentId: opponent, win: true }, { opponentId: opponent, win: true }], { no: 1, event: 'ryuo' });
  addVsUser(roster, [{ opponentId: opponent, win: false }], { no: 1, event: 'meijin' });
  const book = rosterBook(roster);
  const profile = (id) => book.groups.flatMap((entry) => entry.members).find((member) => member.id === id);

  it('一覧の行に、顔の判子・棋風の色・順位戦のクラスと順位・あなたとの対戦成績(大会ごとの内訳)を持つ', () => {
    const row = profile(opponent);
    expect(row.face).toBe(roster.players[opponent].name.slice(0, 1));
    expect(['attack', 'defense', 'balance']).toContain(row.tone);
    expect(row.junniClass).toBe('C2');
    expect(row.junniText).toBe('C級2組 4位');
    expect(row.record).toEqual({ wins: 2, losses: 1 });
    expect(row.ahead).toBe(true);
    expect(row.vsEvents).toEqual([
      { event: 'ryuo', label: '竜王戦', wins: 2, losses: 0 },
      { event: 'meijin', label: '名人戦', wins: 0, losses: 1 },
    ]);
  });

  it('名人は順位戦の世界の名人。タイトル保持者には顔の判子が付く', () => {
    expect(junniText(roster, roster.junni.holder)).toBe('名人');
    const meijin = book.holders.find(({ title }) => title === '名人');
    expect(meijin.id).toBe(roster.junni.holder);
    expect(meijin.face).toBe(roster.players[roster.junni.holder].name.slice(0, 1));
    expect(memberTone({ character: { attack: 0.5 } })).toBe('attack');
    expect(memberTone({ character: { attack: -0.5 } })).toBe('defense');
  });

  it('絞り込み: 順位戦は順位の順、タイトルは持っている数の順、あなたのまわりは羽音と同じ組・クラスの棋士', () => {
    const c2 = bookMembers(book, { filter: 'junni', junni: 'C2' });
    expect(c2.map(({ id }) => id)).toEqual(roster.junni.classes.C2);
    expect(bookMembers(book, { filter: 'junni', junni: 'meijin' }).map(({ id }) => id)).toEqual([roster.junni.holder]);
    const titles = bookMembers(book, { filter: 'titles' });
    expect(titles.length).toBeGreaterThan(0);
    expect(titles.every((member, index) => index === 0 || member.held.length <= titles[index - 1].held.length)).toBe(true);
    const around = bookMembers(book, { filter: 'around', userGroup: 6, userJunni: 'C2', userPlace: 20 });
    expect(around[0].id).toBe(hanane);
    // 羽音・対戦した棋士・順位戦の前後5位・同じ組の強い10人だけ(多すぎない)。
    expect(around.length).toBeLessThanOrEqual(1 + 1 + 11 + 10);
    expect(around.map(({ id }) => id)).toContain(opponent);
    expect(around.filter((member) => member.junniClass === 'C2' && Math.abs(member.junniPlace - 20) <= 5).length).toBeGreaterThanOrEqual(10);
    expect(bookMembers(book, { filter: 'ryuo', group: 1 }).every((member) => member.group === 1)).toBe(true);
    const watch = bookMembers(book, { filter: 'watch', oshiId: '' });
    expect(watch.map(({ id }) => id)).toContain(opponent);
    expect(watch.map(({ id }) => id)).toContain(hanane);
    expect(BOOK_JUNNI_TABS.map(({ id }) => id)).toEqual(['meijin', 'A', 'B1', 'B2', 'C1', 'C2', 'F']);
  });
});

describe('名鑑の投了の早さ(docs/tournament-relay-design.mdの29章)', () => {
  it('どの棋士にも投了の早さの一言があり、羽音は粘る', () => {
    const roster = createRoster({ seed: 51 });
    const profiles = Object.values(roster.players).slice(0, 60).map((member) => memberProfile(roster, member));
    expect(profiles.every(({ resign }) => /^(潔い|ふつう|粘る|最後まで指す)（/.test(resign))).toBe(true);
    expect(memberProfile(roster, roster.players[storyMemberId(roster, HANANE)]).resign.startsWith('粘る')).toBe(true);
  });
});
