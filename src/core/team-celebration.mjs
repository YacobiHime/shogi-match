// 団体戦の優勝を喜べる仕組み(docs/team-battle-design.mdの21章)。画面に依存しない。
// 優勝インタビューの台本(ノベルの場面の形。答えは選択肢)、号外(新聞の札)、トロフィー棚、称号、連覇。
// 優勝したかの記録(run.celebrations)は team-battle.mjs が作る(closeSchoolStage・finishRun)。
// 羽音は敬語と「！」なし(docs/hanane-character.md)。百花は明るく「！」を使う(0章)。

import { SCHOOL_SEATS, SCHOOL_STAGES, TEAM_FORMATS, TEAM_USER_ID, USER_TEAM } from './team-battle.mjs';
import { stageKnockout, stageMatchIds, stageTallies } from './team-ceremony.mjs';

const STAGE_ORDER = Object.freeze(['district', 'prefecture', 'national', 'pro']);
const stageInfo = (id) => SCHOOL_STAGES.find((stage) => stage.id === id) ?? null;
const shortName = (name) => String(name ?? '').replace(/^天鷺|^桜乃/, '');

/** まだ見ていない優勝インタビューの段階(なければnull)。 */
export function pendingCelebration(run) {
  const celebrations = run?.celebrations ?? {};
  return STAGE_ORDER.find((stage) => celebrations[stage] && !celebrations[stage].seen) ?? null;
}

/** 全国優勝・プロの優勝(大会の優勝)か。 */
const isGrand = (stage) => stage === 'national' || stage === 'pro';

/**
 * インタビューの質問と答え(21章の3の2)。replyは百花と羽音の返し(プロは羽音だけ)。
 * {name}は百花がプレイヤーを呼ぶ名前。
 */
export const INTERVIEW_QUESTIONS = Object.freeze([
  Object.freeze({
    id: 'feeling',
    answers: Object.freeze([
      Object.freeze({
        id: 'thanks', label: '仲間のおかげです', say: '仲間のおかげです。2人がいなかったら、ここまで来られませんでした。',
        momoka: ['wry', 'えへへ……そんなこと言われたら、泣いちゃうよ！'], hanane: ['gentle', '……そういうこと、さらっと言えるんだね。私も、同じ気持ちだよ。'],
      }),
      Object.freeze({
        id: 'joy', label: '最高にうれしいです', say: '最高にうれしいです！',
        momoka: ['wry', '私も！ 今日はずっと笑っちゃう！'], hanane: ['smile', '顔に全部出てる。……まぁ、私もだけど。'],
      }),
      Object.freeze({
        id: 'unreal', label: 'まだ実感がありません', say: 'まだ実感がありません。夢みたいです。',
        momoka: ['wry', 'ほっぺ、つねってあげようか！'], hanane: ['neutral', '夢じゃないよ。賞状、ちゃんと君の名前だったでしょ。'],
      }),
    ]),
  }),
  Object.freeze({
    id: 'goal',
    answers: Object.freeze([
      Object.freeze({
        id: 'repeat', label: '次も優勝します', say: '次も、このチームで優勝します。',
        momoka: ['wry', '連覇だね！ がんばろう！'], hanane: ['smile', '言ったね。……付き合うよ。'],
      }),
      Object.freeze({
        id: 'stronger', label: 'もっと強くなります', say: 'もっと強くなります。まだ勝てない相手がいるので。',
        momoka: ['neutral', 'えっ、もっと！？ すごいなぁ……！'], hanane: ['neutral', 'うん。……君なら、まだ伸びる。'],
      }),
      Object.freeze({
        id: 'party', label: 'みんなでお祝いがしたいです', say: 'まずは、みんなでお祝いがしたいです。',
        momoka: ['wry', 'やったー！ ケーキ食べよう、ケーキ！'], hanane: ['gentle', '果物のケーキなら、いいよ。'],
      }),
    ]),
  }),
]);

/** 段階の名前(高校は地区大会・県大会・全国大会、プロは大会の名前)。 */
function stageLabel(run, stage) {
  return run.format === 'school' ? stageInfo(stage)?.name ?? '全国大会' : TEAM_FORMATS.pro.name;
}

/**
 * 優勝インタビューの場面(NovelScene.vueの形。答えの行はchoices)。段階の優勝は質問1つ、全国優勝・プロは2つ(21章の3の2)。
 * @param {any} run
 * @param {string} stage
 * @param {{ playerName?: string }} [options]
 */
export function interviewScene(run, stage, { playerName = '' } = {}) {
  const school = run.format === 'school';
  const you = playerName || 'あなた';
  const call = playerName ? `${playerName}さん` : 'あなた';
  const label = stageLabel(run, stage);
  const reporter = school ? '新聞部の記者' : '将棋記者';
  const questions = isGrand(stage) ? INTERVIEW_QUESTIONS : INTERVIEW_QUESTIONS.slice(0, 1);
  const team = run.teams?.[USER_TEAM]?.name ?? '';
  const asks = {
    feeling: school
      ? `${label}優勝、おめでとうございます。${call}、今のお気持ちは？`
      : `${team}、優勝おめでとうございます。リーダーの${you}さん、今のお気持ちは？`,
    goal: '最後に、次の目標を教えてください。',
  };
  const lines = [
    { who: 'narration', face: 'neutral', name: '', text: school ? `表彰式のあと、新聞部の記者がマイクを向けてきた。` : '表彰式のあと、将棋記者たちが集まってきた。' },
  ];
  for (const question of questions) {
    lines.push({
      who: 'host', face: 'neutral', name: reporter, text: asks[question.id],
      choices: question.answers.map((answer) => ({
        label: answer.label,
        value: answer.id,
        reply: [
          { who: 'you', face: 'neutral', name: you, text: `「${answer.say}」` },
          ...(school ? [{ who: 'momoka', face: answer.momoka[0], name: '桜乃百花', text: answer.momoka[1].replaceAll('{name}', call) }] : []),
          { who: 'hanane', face: answer.hanane[0], name: '天鷺羽音', text: answer.hanane[1] },
        ],
      })),
    });
  }
  lines.push({ who: 'host', face: 'neutral', name: reporter, text: school ? 'ありがとうございました。号外、すぐに出しますね。' : 'ありがとうございました。明日の紙面に載せます。' });
  const summary = `${label}の優勝のあと、${reporter}のインタビュー。答えは号外に載る。`;
  return { id: `interview-${run.id}-${stage}`, title: '優勝インタビュー', summary, background: school ? 'venue' : 'hall', cast: school ? ['hanane', 'momoka'] : ['hanane'], lines };
}

/** 選んだ答えのidから、号外に載せる言葉(飛ばしたら1つ目の質問のはじめの答え)。 */
export function interviewQuotes(answers = []) {
  const picked = INTERVIEW_QUESTIONS.map((question, index) => question.answers.find((answer) => answer.id === answers[index]) ?? null).filter(Boolean);
  return (picked.length ? picked : [INTERVIEW_QUESTIONS[0].answers[0]]).map((answer) => answer.say);
}

/**
 * 連覇の数(同じ形式の前の大会から続く優勝の数＋今回。21章の3の5)。
 * @param {{ history?: { format: string, place: number }[] }} career
 * @param {string} format
 */
export function teamStreak(career, format) {
  const history = (career?.history ?? []).filter((entry) => entry.format === format && entry.label !== '棄権');
  let streak = 1;
  for (let index = history.length - 1; index >= 0 && history[index].place === 1; index -= 1) streak += 1;
  return streak;
}

/** 日付(号外の題字の下)。 */
function dateText(at) {
  const date = new Date(at);
  return Number.isNaN(date.getTime()) ? '' : `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

/**
 * 号外(21章の3の3)。その段階の勝ち上がり・3人の成績・あなたの言葉・仲間の一言。
 * @param {any} run
 * @param {string} stage
 * @param {{ playerName?: string, answers?: string[], streak?: number, at?: number }} [options]
 */
export function championNewspaper(run, stage, { playerName = '', answers = [], streak = 1, at = Date.now() } = {}) {
  const school = run.format === 'school';
  const you = playerName || 'あなた';
  const team = run.teams?.[USER_TEAM]?.name ?? '';
  const label = stageLabel(run, stage);
  const found = stageKnockout(run, stage);
  const ids = stageMatchIds(run, stage, found?.ko ?? null);
  const mine = ids.map((id) => run.matches[id]).filter((match) => match && (match.a === USER_TEAM || match.b === USER_TEAM) && match.winner);
  const path = mine.map((match) => {
    const side = match.a === USER_TEAM ? 'a' : 'b';
    const other = side === 'a' ? 'b' : 'a';
    return { label: match.label, rival: run.teams[match[other]]?.name ?? '', score: `${match.score[side]}-${match.score[other]}`, won: match.winner === side };
  });
  const final = path.at(-1) ?? null;
  const wins = path.filter((entry) => entry.won).length;
  const losses = path.length - wins;
  const tallies = stageTallies(run, ids);
  const members = (run.teams?.[USER_TEAM]?.members ?? []).map((id, index) => {
    const entry = tallies.get(id) ?? { wins: 0, losses: 0 };
    return {
      id,
      name: id === TEAM_USER_ID ? you : run.players[id]?.name ?? '',
      seat: school ? SCHOOL_SEATS[index] : index === 0 ? 'リーダー' : '',
      wins: entry.wins,
      losses: entry.losses,
      record: `${entry.wins}勝${entry.losses}敗`,
    };
  });
  // 殊勲は勝ちの多い人。同じなら、あなた(あなたの号外なので)。
  const mineFirst = (member) => (member.id === TEAM_USER_ID ? 0 : 1);
  const top = [...members].sort((x, y) => y.wins - x.wins || x.losses - y.losses || mineFirst(x) - mineFirst(y))[0] ?? null;
  const grand = isGrand(stage);
  const headline = !school
    ? `${team} ${streak >= 2 ? `${streak}連覇` : '優勝'}`
    : grand ? `${team} ${streak >= 2 ? `全国${streak}連覇` : '全国制覇'}` : `${team} ${label}優勝`;
  const roster = members.map((member) => `${member.seat ? `${member.seat} ` : ''}${member.name}`).join('、');
  const record = losses ? `${wins}勝${losses}敗` : '全勝';
  return {
    stage,
    format: run.format,
    masthead: school ? '燈ヶ丘新聞' : '将棋日報',
    edition: '号外',
    date: dateText(at),
    headline,
    sub: final ? `決勝で${final.rival}を${final.score}で破る` : '',
    lead: `${TEAM_FORMATS[run.format]?.name ?? ''}${school ? ` ${label}` : ''}で、${team}（${roster}）が${record}で優勝した。${top && top.wins ? `殊勲は${top.name}で、${top.record}。` : ''}`,
    path,
    members: members.map((member) => ({ ...member, top: Boolean(top && member.id === top.id && member.wins) })),
    quotes: interviewQuotes(answers),
    comments: school
      ? [
        { who: 'hanane', name: shortName(run.players.hanane?.name ?? '天鷺羽音'), text: grand ? '3人で取った優勝。……ちゃんと書いておいて。' : 'まだ通過点。次も勝つよ。' },
        { who: 'momoka', name: shortName(run.players.momoka?.name ?? '桜乃百花'), text: grand ? 'みんなのおかげです！ 優勝旗、部室に飾ります！' : '優勝杯、ぴかぴかです！ 次も3人でがんばります！' },
      ]
      : [{ who: 'hanane', name: shortName(run.players.hanane?.name ?? '天鷺羽音'), text: 'このチームで取れてよかった。リーダーの采配、悪くなかったよ。' }],
    playerName: you,
  };
}

/** トロフィー棚の杯の種類(21章の3の4)。 */
export const TROPHY_SLOTS = Object.freeze([
  Object.freeze({ stage: 'district', format: 'school', label: '地区大会の優勝杯', glyph: '杯' }),
  Object.freeze({ stage: 'prefecture', format: 'school', label: '県大会の優勝杯', glyph: '杯' }),
  Object.freeze({ stage: 'national', format: 'school', label: '全国大会の優勝旗', glyph: '旗' }),
  Object.freeze({ stage: 'pro', format: 'pro', label: '早指し団体戦の優勝杯', glyph: '杯' }),
]);

/**
 * トロフィー棚に入れる優勝(号外ごと)。
 * @param {any} run
 * @param {string} stage
 * @param {ReturnType<typeof championNewspaper>} paper
 * @param {number} [at]
 */
export function teamTrophy(run, stage, paper, at = Date.now()) {
  const slot = TROPHY_SLOTS.find((entry) => entry.stage === stage);
  return { id: `${run.id}-${stage}`, format: run.format, stage, label: slot?.label ?? '優勝杯', team: run.teams?.[USER_TEAM]?.name ?? '', at, paper };
}

/**
 * トロフィー棚の形。杯ごとの数と号外(新しい順)。まだの杯は数0(影で見せる)。
 * @param {{ trophies?: any[] }} career
 */
export function trophyShelf(career) {
  const trophies = career?.trophies ?? [];
  const slots = TROPHY_SLOTS.map((slot) => {
    const won = trophies.filter((entry) => entry.stage === slot.stage).sort((x, y) => (y.at ?? 0) - (x.at ?? 0));
    return { ...slot, count: won.length, trophies: won };
  });
  return { slots, total: trophies.length };
}

/**
 * 大会の優勝の称号(21章の3の5)。全国優勝・プロの優勝だけ。
 * @param {'school' | 'pro'} format
 * @param {number} count 通算の優勝の回数
 */
export function championTitle(format, count) {
  return format === 'school'
    ? { id: 'team-school-champion', label: '全国高校団体優勝', detail: `全国高校将棋団体戦で優勝（通算${count}回）`, rank: 8 }
    : { id: 'team-pro-champion', label: '早指し団体戦優勝', detail: `早指し団体戦で優勝（通算${count}回）`, rank: 9 };
}

/** 優勝決定の帯の文字(結果発表。21章の3の1)。 */
export function championBanner(run, stage) {
  if (run?.format !== 'school') return '優勝';
  return stage === 'national' ? '全国制覇' : `${stageInfo(stage)?.name ?? ''} 優勝`;
}
