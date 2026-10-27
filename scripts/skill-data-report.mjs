#!/usr/bin/env node
// 集めた棋力テストの答えと対局の結果を集計する(docs/skill-assessment-design.mdの7-4と8章)。
// 問題ごとの人の正答率と、人に合わせ直した難しさ(b)、テストと勝ち負けのずれ(偏り・個人のずれτ・±2Lv以内の割合)を出す。
//
// 使い方:
//   node scripts/skill-data-report.mjs --input answers.json      # 書き出したJSON(配列)を読む
//   FIRESTORE_TOKEN="$(gcloud auth print-access-token)" node scripts/skill-data-report.mjs --fetch
//                                                                # Firestoreから直接読む(プロジェクトの持ち主の権限で)
//   --json report.json で、結果をJSONにも書き出す。
// ルールは誰にも読ませないので、読むときはプロジェクトの持ち主のトークン(ルールを通らない)を使う。

import { readFileSync, writeFileSync } from 'node:fs';
import './lib/ts-register.mjs';
import { estimateProfile } from '../src/core/skill-profile.mjs';
import { successProbability } from '../src/core/skill-test.mjs';
import { SKILL_DATA_ENDPOINT } from '../src/core/skill-data.mjs';

// 問題集のデータ(TypeScriptを含む)を読むので、登録のあとに読む。
const { SKILL_TEST_BANK } = await import('../src/core/skill-test-bank.mjs');

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

/** FirestoreのRESTの値を、JSの値に戻す。 */
export function plainValue(value) {
  if (!value || typeof value !== 'object') return value;
  if ('nullValue' in value) return null;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('stringValue' in value) return value.stringValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) return (value.arrayValue.values ?? []).map(plainValue);
  if ('mapValue' in value) return plainFields(value.mapValue.fields ?? {});
  return value;
}
const plainFields = (fields) => Object.fromEntries(Object.entries(fields).map(([key, entry]) => [key, plainValue(entry)]));
const plainDocument = (doc) => (doc?.fields ? plainFields(doc.fields) : doc);

async function fetchAll(token) {
  const docs = [];
  let pageToken = '';
  do {
    const url = `${SKILL_DATA_ENDPOINT}?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`読めませんでした: ${response.status} ${await response.text()}`);
    const body = await response.json();
    docs.push(...(body.documents ?? []));
    pageToken = body.nextPageToken ?? '';
  } while (pageToken);
  return docs;
}

const mean = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : NaN);
const sd = (values) => {
  if (values.length < 2) return NaN;
  const m = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - m) ** 2, 0) / (values.length - 1));
};
const fixed = (value, digits = 1) => (Number.isFinite(value) ? value.toFixed(digits) : '—');
const time = (value) => Date.parse(value) || 0;

/** 解いた人の強さ(テストのθ)から、その問題の難しさbをいちばんよく合う値で求める。 */
function fitDifficulty(responses, guess) {
  let best = { b: NaN, log: -Infinity };
  for (let b = 0; b <= 47; b += 0.5) {
    const log = responses.reduce((sum, { level, correct }) => {
      const p = Math.min(0.999, Math.max(0.001, successProbability(level, { b, guess })));
      return sum + Math.log(correct ? p : 1 - p);
    }, 0);
    if (log > best.log) best = { b, log };
  }
  return best.b;
}

/**
 * 集計する。
 * @param {any[]} records 送られた1件ずつ(kindがtestかgame)
 */
export function skillDataReport(records) {
  const bank = new Map(SKILL_TEST_BANK.map((item) => [item.id, item]));
  const byAnon = new Map();
  for (const record of records) {
    if (!record?.anon || !['test', 'game'].includes(record.kind)) continue;
    if (!byAnon.has(record.anon)) byAnon.set(record.anon, { tests: [], games: [] });
    byAnon.get(record.anon)[record.kind === 'test' ? 'tests' : 'games'].push(record);
  }
  for (const person of byAnon.values()) {
    person.tests.sort((a, b) => time(a.at) - time(b.at));
    person.games.sort((a, b) => time(a.at) - time(b.at));
  }

  // 問題ごと: 解いた人のテストのθで、正答率と難しさを見直す。
  const responses = new Map();
  for (const person of byAnon.values()) {
    for (const test of person.tests) {
      for (const answer of test.test?.answers ?? []) {
        if (!responses.has(answer.id)) responses.set(answer.id, []);
        responses.get(answer.id).push({ level: test.test.level, correct: Boolean(answer.correct), skipped: Boolean(answer.skipped), ms: answer.ms });
      }
    }
  }
  const items = [...responses.entries()].map(([id, list]) => {
    const item = bank.get(id);
    const fitted = list.length >= 10 ? fitDifficulty(list, item?.guess ?? 0) : NaN;
    return {
      id,
      type: item?.type ?? list[0]?.type ?? '?',
      n: list.length,
      correctRate: mean(list.map(({ correct }) => (correct ? 1 : 0))),
      skipRate: mean(list.map(({ skipped }) => (skipped ? 1 : 0))),
      medianMs: [...list.map(({ ms }) => ms)].sort((a, b) => a - b)[Math.floor(list.length / 2)],
      takerLevel: mean(list.map(({ level }) => level)),
      b: item?.b ?? NaN,
      fitted,
      shift: fitted - (item?.b ?? NaN),
    };
  }).sort((a, b) => b.n - a.n);

  // 種類ごと: 難しさをどれだけ動かすとよいか(TYPE_OFFSETSを直す目安)。
  const types = [...new Set(items.map(({ type }) => type))].map((type) => {
    const shifts = items.filter((item) => item.type === type && Number.isFinite(item.shift)).map(({ shift }) => shift);
    return { type, items: shifts.length, shift: mean(shifts) };
  });

  // 人ごと: 最初のテストと、そのあとの平手の勝ち負け(10局以上)からのθを比べる。場面採点も同じく比べる。
  const compare = [];
  const contentCompare = [];
  for (const [anon, person] of byAnon) {
    const games = person.games.filter((game) => Number.isFinite(game.game?.opponent) && game.game.opponent >= 1);
    const fromResults = (list) => estimateProfile({
      history: list.map((game) => ({ opponentLevel: game.game.opponent, outcome: game.game.outcome, event: game.game.event })),
    });
    const test = person.tests[0];
    if (test) {
      const after = games.filter((game) => time(game.at) >= time(test.at));
      if (after.length >= 10) compare.push({ anon, test: test.test.level, results: fromResults(after).level, games: after.length });
    }
    const contents = games.filter((game) => Number.isFinite(game.game?.content?.level));
    if (contents.length >= 3 && games.length >= 10) {
      contentCompare.push({ anon, content: mean(contents.map((game) => game.game.content.level)), results: fromResults(games).level, games: games.length });
    }
  }
  const gapSummary = (list, key) => {
    const gaps = list.map((entry) => entry[key] - entry.results);
    return {
      people: list.length,
      bias: mean(gaps),
      spread: sd(gaps),
      within2: mean(gaps.map((gap) => (Math.abs(gap) <= 2 ? 1 : 0))),
      within4: mean(gaps.map((gap) => (Math.abs(gap) <= 4 ? 1 : 0))),
      worst: gaps.length ? Math.max(...gaps.map(Math.abs)) : NaN,
    };
  };

  return {
    people: byAnon.size,
    tests: [...byAnon.values()].reduce((sum, person) => sum + person.tests.length, 0),
    games: [...byAnon.values()].reduce((sum, person) => sum + person.games.length, 0),
    items,
    types,
    test: gapSummary(compare, 'test'),
    content: gapSummary(contentCompare, 'content'),
  };
}

function print(report) {
  console.log(`人 ${report.people}・テスト ${report.tests}回・対局 ${report.games}局`);
  console.log('\n■ テストと、そのあとの勝ち負け(10局以上)のずれ。目標は8割が±2Lv以内、外れても±4Lv');
  for (const [label, gap] of [['テスト', report.test], ['場面採点', report.content]]) {
    console.log(`${label}: ${gap.people}人 偏り${fixed(gap.bias)}Lv(正なら勝ち負けより高く出る) ばらつき${fixed(gap.spread)}Lv(τの目安) ±2以内${fixed(gap.within2 * 100, 0)}% ±4以内${fixed(gap.within4 * 100, 0)}% いちばん外れ${fixed(gap.worst)}Lv`);
  }
  console.log('\n■ 種類ごとの難しさの動かし方(TYPE_OFFSETSに足す目安。解いた人10人以上の問題)');
  for (const type of report.types) console.log(`${type.type}: ${type.items}問 ${fixed(type.shift)}Lv`);
  console.log('\n■ 問題ごと(解いた人の多い順、上位40)');
  console.log('id\t種類\t人数\t正答\t飛ばし\t時間(秒)\t解いた人のLv\tb\t見直したb');
  for (const item of report.items.slice(0, 40)) {
    console.log([item.id, item.type, item.n, fixed(item.correctRate * 100, 0) + '%', fixed(item.skipRate * 100, 0) + '%', fixed(item.medianMs / 1000), fixed(item.takerLevel), fixed(item.b), fixed(item.fitted)].join('\t'));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const input = option('--input');
  let docs;
  if (args.includes('--fetch')) {
    const token = process.env.FIRESTORE_TOKEN;
    if (!token) throw new Error('FIRESTORE_TOKENに、gcloud auth print-access-tokenの値を入れてください。');
    docs = await fetchAll(token);
  } else if (input) {
    docs = JSON.parse(readFileSync(input, 'utf8'));
  } else {
    console.log('--input <JSON> か --fetch を付けてください。');
    process.exit(1);
  }
  const report = skillDataReport(docs.map(plainDocument));
  print(report);
  const out = option('--json');
  if (out) writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
}
