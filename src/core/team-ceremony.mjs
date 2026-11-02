// 団体戦の段階ごとの表彰式(docs/team-battle-design.mdの20章)。画面に依存しない。
// 表彰式の記録(run.ceremony)は、段階が終わったときに team-battle.mjs が作る(closeSchoolStage・finishRun)。
// ここでは、その段階の表と試合から、団体の部(3位・準優勝・優勝)・個人の部・自分の学校の成績・記念撮影・一言・賞状を決める。
// 羽音は敬語と「！」なし(docs/hanane-character.md)。百花は明るく「！」を使う(0章)。

import { SCHOOL_SEATS, SCHOOL_STAGES, TEAM_FORMATS, TEAM_USER_ID, USER_TEAM } from './team-battle.mjs';

/** 表彰式で1つずつ呼ぶ間(ミリ秒)。団体の部・個人の部。 */
export const CEREMONY_STEP_MS = Object.freeze({ place: 900, prize: 600 });

const other = (side) => (side === 'a' ? 'b' : 'a');
const stageInfo = (id) => SCHOOL_STAGES.find((stage) => stage.id === id) ?? null;
const shortName = (name) => String(name ?? '').replace(/^天鷺|^桜乃/, '');

/** その段階のトーナメント(地区大会・県大会は記録、全国大会とプロはいまの表)。 */
function stageKnockout(run, stage) {
  if (stage === 'district' || stage === 'prefecture') {
    const log = (run.stageLog ?? []).find((entry) => entry.id === stage);
    return log ? { ko: log.ko, champion: log.champion, log } : null;
  }
  return run.ko ? { ko: run.ko, champion: run.champion ?? null, log: null } : null;
}

/** その段階の試合のid(地区大会・県大会はトーナメント、全国大会は予選とトーナメント、プロはリーグとトーナメント)。 */
function stageMatchIds(run, stage, ko) {
  const koIds = (ko?.rounds ?? []).flat().map((entry) => entry.match).filter(Boolean);
  if (stage === 'national') return [...(run.swiss?.rounds ?? []).flat(), ...koIds];
  if (stage === 'pro') return [...(run.leagues ?? []).flatMap((league) => league.matches), ...koIds];
  return koIds;
}

/** トーナメントの1位・2位・3位(準決勝で負けた学校。3位は2校)。 */
function knockoutPlaces(run, ko, champion) {
  const rounds = ko?.rounds ?? [];
  const finalEntry = rounds.at(-1)?.[0];
  const final = finalEntry?.match ? run.matches[finalEntry.match] : null;
  const first = champion ?? (final?.winner ? final[final.winner] : finalEntry?.bye ?? null);
  const second = final?.winner ? final[other(final.winner)] : null;
  const thirds = rounds.length >= 2
    ? rounds.at(-2).map((entry) => (entry.match ? run.matches[entry.match] : null)).filter((match) => match?.winner).map((match) => match[other(match.winner)])
    : [];
  return { first, second, thirds };
}

const teamCard = (run, id) => {
  const team = run.teams?.[id];
  return team ? { id, name: team.name, area: team.area ?? '', you: id === USER_TEAM } : null;
};

/**
 * 段階の個人の成績(選手ごとの勝ち負けと席)。
 * @returns {Map<string, { id: string, team: string, seat: number | null, wins: number, losses: number }>}
 */
function stageTallies(run, matchIds) {
  const tallies = new Map();
  for (const id of matchIds) {
    const match = run.matches[id];
    if (!match) continue;
    for (const game of match.games) {
      if (!game.winner) continue;
      for (const side of ['a', 'b']) {
        const player = game[side];
        const entry = tallies.get(player) ?? { id: player, team: match[side], seat: game.seat ?? null, wins: 0, losses: 0 };
        if (game.winner === side) entry.wins += 1;
        else entry.losses += 1;
        tallies.set(player, entry);
      }
    }
  }
  return tallies;
}

/**
 * 表彰式の画面の形。まだ見ていない表彰式がなければnull。
 * @param {any} run 団体戦の大会
 * @param {{ playerName?: string }} [options]
 */
export function teamCeremonyView(run, { playerName = '' } = {}) {
  const ceremony = run?.ceremony;
  if (!ceremony || ceremony.seen) return null;
  const stage = ceremony.stage;
  const school = run.format === 'school';
  const format = TEAM_FORMATS[run.format] ?? TEAM_FORMATS.school;
  const info = stageInfo(stage);
  const stageName = school ? info?.name ?? '全国大会' : '本戦';
  const found = stageKnockout(run, stage);
  if (!found) return null;
  const { first, second, thirds } = knockoutPlaces(run, found.ko, found.champion);
  const placeOf = (id) => (id === first ? 1 : id === second ? 2 : thirds.includes(id) ? 3 : 0);
  const places = [
    { rank: 3, label: '第3位', teams: thirds.map((id) => teamCard(run, id)).filter(Boolean) },
    { rank: 2, label: '準優勝', teams: [teamCard(run, second)].filter(Boolean) },
    { rank: 1, label: '優勝', teams: [teamCard(run, first)].filter(Boolean) },
  ].filter((place) => place.teams.length);
  const userPlace = placeOf(USER_TEAM);
  const userPlaceLabel = userPlace ? ['', '優勝', '準優勝', '第3位'][userPlace] : (found.log?.label ?? run.result?.label ?? '');

  // 個人の部: 高校は席ごと、プロは最多勝利。同じなら負けの少ない順・学校の成績の順・強さの順。
  const tallies = [...stageTallies(run, stageMatchIds(run, stage, found.ko)).values()];
  const rank = (entry) => {
    const place = placeOf(entry.team);
    return place || 9;
  };
  const better = (x, y) => y.wins - x.wins || x.losses - y.losses || rank(x) - rank(y)
    || (run.players[y.id]?.rating ?? 0) - (run.players[x.id]?.rating ?? 0);
  const prizeOf = (entry, label) => {
    const player = run.players[entry.id];
    const you = entry.id === TEAM_USER_ID;
    return {
      label,
      id: entry.id,
      name: you ? (playerName || 'あなた') : player?.name ?? '',
      school: run.teams[entry.team]?.name ?? '',
      record: `${entry.wins}勝${entry.losses}敗`,
      wins: entry.wins,
      losses: entry.losses,
      perfect: entry.losses === 0 && entry.wins >= 2,
      you,
      seat: school && Number.isFinite(entry.seat) ? SCHOOL_SEATS[entry.seat] : '',
    };
  };
  const prizes = school
    ? SCHOOL_SEATS.map((seat, index) => {
      const best = tallies.filter((entry) => entry.seat === index && entry.wins > 0).sort(better)[0];
      return best ? prizeOf(best, `${seat}賞`) : null;
    }).filter(Boolean)
    : [tallies.filter((entry) => entry.wins > 0).sort(better)[0]].filter(Boolean).map((entry) => prizeOf(entry, '最多勝利賞'));
  const myPrize = prizes.find((prize) => prize.you) ?? null;
  const mine = tallies.find((entry) => entry.id === TEAM_USER_ID) ?? { wins: 0, losses: 0 };

  const log = found.log;
  const next = log?.advanced ? stageInfo(stage === 'district' ? 'prefecture' : 'national') : null;
  const outcome = !userPlace
    ? (log?.advanced ? 'advance' : 'out')
    : userPlace === 1 ? (stage === 'national' || stage === 'pro' ? 'grand' : 'champion')
      : log?.advanced ? 'advance' : userPlace === 2 && (stage === 'national' || stage === 'pro') ? 'second' : 'placed';
  const usTeam = run.teams[USER_TEAM];
  const eventName = format.name;
  const title = `${school ? stageName : eventName} 表彰式`;
  return {
    id: `${run.id}-${stage}`,
    stage,
    format: run.format,
    eventName,
    stageName,
    title,
    host: `ただいまより、${eventName}${school ? ` ${stageName}` : ''}の表彰式を行います。`,
    places,
    trophy: stage === 'national' ? '優勝旗' : '優勝杯',
    you: { place: userPlace, label: userPlaceLabel, team: usTeam?.name ?? '' },
    prizes,
    myPrize,
    photo: {
      members: (usTeam?.members ?? []).map((id) => ({ id, name: id === TEAM_USER_ID ? (playerName || 'あなた') : shortName(run.players[id]?.name), you: id === TEAM_USER_ID })),
      caption: [usTeam?.name ?? '', school ? stageName : eventName, userPlaceLabel].filter(Boolean).join(' '),
    },
    lines: ceremonyLines({ outcome, school, stageName, myPrize, placeLabel: userPlaceLabel }),
    nextLabel: next ? `${next.name}へ` : '閉会',
    awards: ceremonyAwards(run, { stage, stageName, eventName, userPlace, myPrize, mine, school }),
  };
}

/**
 * 表彰式で渡す賞状(20章の2の4)。団体の入賞(全国優勝・プロの優勝は今までの団体優勝の賞状なので除く)と個人賞。
 * @returns {{ id: string, kind: 'team' | 'player' | 'grand', name: string, stageName: string, prize: string, grade: string, team: string, seat?: string, wins: number, losses: number }[]}
 */
function ceremonyAwards(run, { stage, stageName, eventName, userPlace, myPrize, mine, school }) {
  const team = run.teams[USER_TEAM]?.name ?? '';
  const awards = [];
  const grand = userPlace === 1 && (stage === 'national' || stage === 'pro');
  // 全国優勝(プロは優勝)は、今までの団体優勝の賞状(season-award.mjsのteamAward。対局の記録のときに作る)を表彰式で渡す。
  if (grand) awards.push({ id: `team-${run.id}`, kind: 'grand', name: eventName, stageName: school ? stageName : '', prize: '団体優勝', grade: 'gold', team, wins: mine.wins, losses: mine.losses });
  if (userPlace && !grand) {
    const label = ['', '優勝', '準優勝', '第3位'][userPlace];
    awards.push({
      id: `team-${run.id}-${stage}`, kind: 'team', name: eventName, stageName: school ? stageName : '', prize: school ? `${stageName} ${label}` : label,
      grade: userPlace === 2 && (stage === 'national' || stage === 'pro') ? 'silver' : 'red', team, wins: mine.wins, losses: mine.losses,
    });
  }
  if (myPrize) {
    awards.push({
      id: `team-${run.id}-${stage}-player`, kind: 'player', name: eventName, stageName: school ? stageName : '', prize: school ? `${stageName} ${myPrize.label}` : myPrize.label,
      grade: 'red', team, seat: myPrize.seat, wins: myPrize.wins, losses: myPrize.losses,
    });
  }
  return awards;
}

/**
 * 羽音と百花の一言(優勝・入賞・通過・敗退で言い分ける。個人賞を取ったら羽音が先にたたえる)。プロは羽音だけ。
 * @param {{ outcome: string, school: boolean, stageName: string, myPrize: { label: string } | null, placeLabel?: string }} options
 * @returns {{ who: 'hanane' | 'momoka', text: string }[]}
 */
export function ceremonyLines({ outcome, school, stageName, myPrize, placeLabel = '第3位' }) {
  const hanane = {
    grand: school ? '全国優勝。……ねえ、これ、本当に私たちが取ったんだよね' : '優勝。このチームで取れてよかった',
    champion: `${stageName}優勝。でも、ここはまだ通過点でしょ`,
    advance: '通過は通過。次で取り返せばいい',
    second: school ? '準優勝。……悔しいけど、次はあの旗を取りに行くよ' : '準優勝。次は、いちばん上だね',
    placed: `${placeLabel.replace(/^第/, '')}。……あと一歩だった。君の将棋は、ちゃんと通用してた`,
    out: school ? 'ここで終わり。でも、君と組めてよかった。……次は、もっと上まで行こう' : 'ここまで。……でも、いい団体戦だった',
  }[outcome] ?? '';
  const lines = [{ who: 'hanane', text: myPrize ? `${myPrize.label}は君。おめでとう。${hanane}` : hanane }];
  if (!school) return lines;
  const momoka = {
    grand: '優勝……！ 夢みたい！ 3人で取った優勝だよ！',
    champion: '表彰台のいちばん上だよ！ 次も3人で頑張ろうね！',
    advance: '次の大会にも行けるんだ！ わくわくするね！',
    second: '全国で2番目……！ すごいよ、私たち！',
    placed: '賞状、もらっちゃった！ 部室に飾ろうね！',
    out: '悔しいけど……楽しかった！ また3人で出ようね！',
  }[outcome] ?? '';
  lines.push({ who: 'momoka', text: momoka });
  return lines;
}

/**
 * 表彰式の段取りの長さ(ミリ秒)。開式・団体の部・個人の部のあと、記念撮影。
 * @param {{ places: unknown[], prizes: unknown[] }} view
 */
export function ceremonyRevealMs(view) {
  return CEREMONY_STEP_MS.place * (view.places.length + 1) + CEREMONY_STEP_MS.prize * (view.prizes.length + 1);
}
