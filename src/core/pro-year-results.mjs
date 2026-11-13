// 棋士の1年の結果の札(docs/pro-year-design.mdの19-3の7)。pro-year.mjsが積んだ結果(state.results)を、
// 1枚ずつめくる札の形にする。画面(ProYearResults.vue)はこの形をそのまま描く。
// 重さ(G:3-1): gold=段階6(判子・紙吹雪・音)、good=段階5、plain=段階4、calm=負け・失冠(短く控えめ。G:7)。

import { moneyText } from './pro-life.mjs';

/** 札が出てから「次へ」を受け付けるまで(続けて押して読み飛ばさない。19-3の7)。 */
export const RESULT_GUARD_MS = 600;

const seriesMarks = (series) => (series ? { me: series.me, them: series.them, need: series.need } : null);

/**
 * 「この1局」の札。
 * @param {any} item
 */
function gamePage(item) {
  const lines = [...(item.lines ?? [])];
  return {
    kind: 'game', tone: item.won ? 'good' : 'calm', seal: item.won ? '勝' : '負', stamp: item.won ? 'win' : 'loss',
    eyebrow: item.auto ? 'この1局（分身）' : 'この1局',
    heading: item.label, sub: `対 ${item.opponent}${item.opponentDan ?? ''}`,
    series: seriesMarks(item.series), seriesText: item.series?.status ?? '', defense: Boolean(item.series?.defense),
    lines,
    facts: [
      item.earned ? { label: '対局料・賞金', value: moneyText(item.earned) } : null,
      item.record ? { label: '今年度', value: `${item.record.w}勝${item.record.l}敗` } : null,
    ].filter(Boolean),
    coach: '',
  };
}

/** 対局がいくつも続いたとき(分身に任せた週など)の一覧の札。 */
function gamesPage(items) {
  const wins = items.filter((item) => item.won).length;
  const last = items.at(-1);
  return {
    kind: 'games', tone: 'plain', seal: '', stamp: '', eyebrow: '対局の結果', heading: `${items.length}局 ${wins}勝${items.length - wins}敗`,
    sub: last?.record ? `今年度 ${last.record.w}勝${last.record.l}敗` : '',
    rows: items.map((item) => ({
      won: item.won, label: item.label, opponent: `${item.opponent}${item.opponentDan ?? ''}`, auto: item.auto,
      note: [item.series?.status ?? '', ...(item.lines ?? [])].filter(Boolean).join('・'),
    })),
    lines: [], facts: [], coach: '',
  };
}

/**
 * 番勝負の結果の札(防衛・獲得・奪還・失冠・届かず)。
 * @param {any} item
 */
function titlePage(item) {
  const [w, l] = item.score ?? [0, 0];
  const score = item.opponent ? `${w}勝${l}敗 対 ${item.opponent}` : '挑戦者なし';
  const eternal = item.eternal?.reached ? '' : item.eternal?.text ?? '';
  if (item.kind === 'defend') {
    return {
      kind: 'title', tone: 'gold', seal: '防', stamp: 'title', confetti: true, eyebrow: `${item.name}`,
      heading: `${item.short} 防衛`, sub: item.streak >= 2 ? `${item.streak}連覇` : '初防衛',
      lines: [score, `通算${item.total}期・防衛${item.defenses}回`, eternal].filter(Boolean), facts: [], coach: item.line ?? '',
    };
  }
  if (item.kind === 'take' || item.kind === 'retake') {
    return {
      kind: 'title', tone: 'gold', seal: '冠', stamp: 'title', confetti: true, eyebrow: `${item.name}`,
      heading: `${item.short} ${item.kind === 'retake' ? '奪還' : '獲得'}`, sub: item.first ? 'はじめてのタイトル' : `通算${item.total}期`,
      lines: [score, eternal].filter(Boolean), facts: [], coach: item.line ?? '',
    };
  }
  if (item.kind === 'lost') {
    return {
      kind: 'title', tone: 'calm', seal: '', stamp: '', eyebrow: `${item.name}`, heading: `${item.short} 失冠`, sub: score,
      lines: [`通算${item.total}期`], facts: [], coach: item.line ?? '',
    };
  }
  return {
    kind: 'title', tone: 'calm', seal: '', stamp: '', eyebrow: `${item.name}`, heading: `${item.short}への挑戦`, sub: `${w}勝${l}敗で届かず`,
    lines: item.opponent ? [`${item.opponent}${item.short}`] : [], facts: [], coach: item.line ?? '',
  };
}

/**
 * @typedef {{
 *   id: string, index: number, last: boolean, kind: string, tone: string, seal: string, stamp: string, confetti?: boolean,
 *   eyebrow: string, heading: string, sub: string, lines: string[], facts: { label: string, value: string }[], coach: string, note?: string,
 *   series?: { me: number, them: number, need: number } | null, seriesText?: string, defense?: boolean,
 *   rows?: { won: boolean, label: string, opponent: string, auto: boolean, note: string }[],
 * }} ResultPage
 */

/**
 * 結果の札の並び。続いた「この1局」は1枚の一覧にまとめ(2局以上)、大きな節目は1枚ずつ。
 * @param {any[]} results pro-year.mjsのstate.results
 * @param {{ dropped?: number }} [options] 上限を超えて消した古い対局の数
 * @returns {ResultPage[]}
 */
export function resultPages(results, { dropped = 0 } = {}) {
  const pages = [];
  let games = [];
  const flush = () => {
    if (games.length === 1) pages.push(gamePage(games[0]));
    else if (games.length > 1) pages.push(gamesPage(games));
    games = [];
  };
  for (const item of results ?? []) {
    if (item.type === 'game') {
      games.push(item);
      continue;
    }
    flush();
    const page = pageOf(item);
    if (page) pages.push(page);
  }
  flush();
  if (dropped > 0 && pages.length) pages[0] = { ...pages[0], note: `前の${dropped}局の札は省いたよ（勝ち負けは今年度の成績に入っているよ）` };
  return pages.map((page, index) => ({ ...page, id: `${index}-${page.kind}`, index, last: index === pages.length - 1 }));
}

/** 大きな節目の札。 */
function pageOf(item) {
  switch (item.type) {
    case 'title': return titlePage(item);
    case 'eternal':
      return {
        kind: 'eternal', tone: 'gold', seal: '永', stamp: 'title', confetti: true, eyebrow: '永世称号', heading: item.name, sub: `${item.rule}に届いた`,
        lines: [`${item.short} 通算${item.total}期`], facts: [], coach: `${item.name}！ 歴史に名前が残る記録だよ。ほんとうにおめでとう！`,
      };
    case 'crowns':
      return {
        kind: 'crowns', tone: 'gold', seal: '冠', stamp: 'title', confetti: true, eyebrow: 'タイトルを同時に', heading: item.count >= 8 ? '全冠制覇' : item.label,
        sub: item.count >= 8 ? '八冠' : `${item.count}つのタイトル`, lines: [item.titles.join('・')], facts: [],
        coach: item.count >= 8 ? '八つのタイトルを全部持ったよ！ これ以上は、もうないんだね。' : `${item.label}だね！ 持っているタイトルを守りながら、次のタイトルも取りに行こう。`,
      };
    case 'cup':
      return { kind: 'cup', tone: 'good', seal: '優', stamp: 'title', eyebrow: '棋戦優勝', heading: `${item.name} 優勝`, sub: '', lines: [], facts: [], coach: `${item.name}優勝！ 最後まで勝ち切ったね。` };
    case 'challenge':
      return {
        kind: 'challenge', tone: 'good', seal: '挑', stamp: 'title', eyebrow: `${item.name}`, heading: `${item.short}の挑戦者に`, sub: item.series,
        lines: [`${item.opponent.name}${item.short}に挑む`], facts: opponentFacts(item), coach: item.line ?? '',
      };
    case 'challenger':
      return {
        kind: 'challenger', tone: 'plain', seal: '', stamp: 'nameplate', eyebrow: `${item.name}`, heading: '防衛戦の相手が決まった', sub: item.series,
        lines: [
          `挑戦者 ${item.opponent.name}${item.opponent.dan}`,
          item.streak ? `防衛すれば${item.streak + 1}連覇` : '',
          item.eternal?.left === 1 ? `防衛すれば${item.eternal.name}の資格` : item.eternal?.text ?? '',
        ].filter(Boolean),
        facts: opponentFacts(item), coach: item.line ?? '',
      };
    case 'dan':
      return { kind: 'dan', tone: 'good', seal: '昇', stamp: 'title', eyebrow: '昇段', heading: `${item.to}に昇段`, sub: `${item.from} → ${item.to}`, lines: [], facts: [], coach: `${item.to}！ 積み上げてきた勝ちが、段になったね。` };
    case 'promote':
      return { kind: 'promote', tone: 'good', seal: '昇', stamp: 'title', eyebrow: '昇級', heading: item.text, sub: item.sub ?? '', lines: [], facts: [], coach: '次の舞台でも、いつもの将棋でいこう！' };
    case 'goal':
      return { kind: 'goal', tone: 'good', seal: '達', stamp: 'nameplate', eyebrow: '今年の目標', heading: '目標達成', sub: `「${item.label}」`, lines: [], facts: [], coach: '' };
    default: return null;
  }
}

/** 番勝負の相手の段・レーティング・今年度の成績・最近の対戦。 */
function opponentFacts(item) {
  const other = item.opponent ?? {};
  return [
    other.rating ? { label: 'レーティング', value: `R${other.rating}` } : null,
    { label: '今年度', value: `${other.wins ?? 0}勝${other.losses ?? 0}敗` },
    item.met ? { label: '最近の対戦', value: `${item.met[0]}勝${item.met[1]}敗` } : null,
  ].filter(Boolean);
}

/** 終局の窓のボタンを「結果を見る」にするか(大きな節目の札があるか。19-3の8)。 */
export function hasBigResult(results) {
  return (results ?? []).some((item) => item.type !== 'game');
}
