// 竜王戦のキャリア(何期目か、いま何組か、竜王を何期獲ったか)の記録。結果は1期ごとに保存する。

export const CAREER_STORAGE_KEY = 'yacobihime:shogi-match:ryuo-career';
export const SEASON_STORAGE_KEY = 'yacobihime:shogi-match:ryuo-season';
const MAX_HISTORY = 40;

/** 永世竜王の条件: 連続5期、または通算7期。 */
export const ETERNAL_STREAK = 5;
export const ETERNAL_TOTAL = 7;

export const DEFAULT_ENTRY_SETTINGS = Object.freeze({
  scale: 3,
  revival: true,
  coachLevel: 'detailed',
  hintLimit: 3,
  undoLimit: 3,
});

export function createCareer() {
  return {
    group: 6,
    bestGroup: 6,
    seasons: 0,
    champion: false,
    titles: 0,
    streak: 0,
    bestStreak: 0,
    challenges: 0,
    eternal: false,
    history: [],
    settings: { ...DEFAULT_ENTRY_SETTINGS },
  };
}

/**
 * 次に参加する期。竜王なら防衛戦、そうでなければ、いまの組から挑戦する。
 * @returns {{ no: number, mode: 'challenge' | 'defense', group: number }}
 */
export function nextEntry(career) {
  return { no: career.seasons + 1, mode: career.champion ? 'defense' : 'challenge', group: career.group };
}

const OUTCOME_TEXT = Object.freeze({
  champion: '竜王獲得',
  'defense-lost': '防衛失敗',
  'finals-lost': '七番勝負で敗退',
  'playoff-lost': '挑戦者決定戦で敗退',
  'main-out': '決勝トーナメントで敗退',
  'ranking-out': 'ランキング戦で敗退',
});
export const outcomeText = (outcome) => OUTCOME_TEXT[outcome] ?? outcome;

/**
 * 終えた1期をキャリアに反映する。昇級・降級、竜王の獲得、永世竜王を決める。
 * @param {ReturnType<typeof createCareer>} career
 * @param {{ no: number, mode: string, result: object }} season 終了したシーズン
 * @returns {{ career: ReturnType<typeof createCareer>, titles: { id: string, label: string, detail: string, rank: number }[] }}
 */
export function applySeason(career, season) {
  const { result } = season;
  const titles = [];
  const next = { ...career, history: [...career.history] };
  next.seasons += 1;
  next.group = result.newGroup;
  next.bestGroup = Math.min(next.bestGroup, result.newGroup);
  if (result.challenger) {
    next.challenges += 1;
    titles.push({ id: 'ryuo-challenger', label: '竜王戦挑戦者', detail: `第${season.no}期竜王戦で、挑戦者になった`, rank: 10 });
  }
  if (result.wonTitle) {
    next.titles += 1;
    next.streak = career.champion ? career.streak + 1 : 1;
    next.bestStreak = Math.max(next.bestStreak, next.streak);
    next.champion = true;
    titles.push({
      id: 'ryuo',
      label: '竜王',
      detail: `第${season.no}期に、竜王を獲得（通算${next.titles}期）`,
      rank: 20,
    });
  } else {
    next.streak = 0;
    next.champion = false;
  }
  if (!career.eternal && (next.streak >= ETERNAL_STREAK || next.titles >= ETERNAL_TOTAL)) {
    next.eternal = true;
    titles.push({
      id: 'ryuo-eternal',
      label: '永世竜王',
      detail: next.streak >= ETERNAL_STREAK ? `竜王を連続${ETERNAL_STREAK}期、保持した` : `竜王を通算${ETERNAL_TOTAL}期、獲得した`,
      rank: 30,
    });
  }
  next.history.push({
    no: season.no,
    mode: season.mode,
    startGroup: result.startGroup,
    newGroup: result.newGroup,
    outcome: result.outcome,
    wins: result.wins,
    losses: result.losses,
    promoted: result.promoted,
    relegated: result.relegated,
  });
  next.history = next.history.slice(-MAX_HISTORY);
  return { career: next, titles };
}

const count = (value, fallback = 0) => (Number.isInteger(value) && value >= 0 ? value : fallback);

export function loadCareer(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(CAREER_STORAGE_KEY) ?? 'null');
    if (!parsed || typeof parsed !== 'object') return createCareer();
    const base = createCareer();
    const group = Math.min(6, Math.max(1, count(parsed.group, 6)));
    return {
      ...base,
      group,
      bestGroup: Math.min(group, Math.min(6, Math.max(1, count(parsed.bestGroup, 6)))),
      seasons: count(parsed.seasons),
      champion: parsed.champion === true,
      titles: count(parsed.titles),
      streak: count(parsed.streak),
      bestStreak: count(parsed.bestStreak),
      challenges: count(parsed.challenges),
      eternal: parsed.eternal === true,
      history: Array.isArray(parsed.history)
        ? parsed.history.filter((entry) => entry && Number.isInteger(entry.no)).slice(-MAX_HISTORY)
        : [],
      settings: { ...DEFAULT_ENTRY_SETTINGS, ...(parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : {}) },
    };
  } catch {
    return createCareer();
  }
}

export function saveCareer(storage, career) {
  try {
    storage?.setItem(CAREER_STORAGE_KEY, JSON.stringify(career));
    return true;
  } catch {
    return false;
  }
}

/** 進行中の期。シーズンは丸ごと保存し、リロードしても続きから指せる。 */
export function loadSeason(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(SEASON_STORAGE_KEY) ?? 'null');
    if (!parsed || ![1, 2].includes(parsed.version) || typeof parsed.phase !== 'string' || !parsed.players) return null;
    // 版1の期は難易度が1〜10だった。下へ2段階足したので、同じ強さになるよう2つずらす。
    if (parsed.version === 1) {
      const difficulty = Number(parsed.settings?.difficulty);
      return {
        ...parsed,
        version: 2,
        settings: { ...parsed.settings, ...(Number.isFinite(difficulty) ? { difficulty: difficulty + 2 } : {}) },
      };
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveSeason(storage, season) {
  try {
    if (season) storage?.setItem(SEASON_STORAGE_KEY, JSON.stringify(season));
    else storage?.removeItem(SEASON_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
