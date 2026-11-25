// 理由で指す棋士の手が、プロの手とどれだけ同じかを測る(一致率。docs/disciple-mode-design.mdの40章)。
// 手元に集めた棋譜(scripts/fetch-pro-kifu.mjsの.kifu-cache/)から、局面をいくつか選び、その局面で理由で指す棋士が選ぶ手とプロの指した手を比べる。
// 使い方(problem-solverがTypeScriptなのでvite-nodeで動かす):
//   npx vite-node scripts/reason-match-report.mjs -- [--players T30-30-30-30b,T45-45-45-45b] [--games 40] [--positions 8] [--groups edo,early,showa,heisei,reiwa,shoreikai] [--seed 1]
// 選手の書き方は自己対局と同じT<読み>-<作戦>-<安定>-<詰み>(末尾b=観戦の時間の上限、c=前の版の駒の価値と形の点)。
// 出すもの: 序盤(30手まで)・中盤(31〜80手)・終盤(81手から)ごとの一致率と、時代ごとの一致率。

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { importCSA } from 'tsshogi';
import { WATCH_THINK_BUDGET_MS, budgetProfile, chooseThinkingMove, thinkProfile } from '../src/core/reason-think.mjs';
import { createRng } from '../src/core/ryuo-random.mjs';
import { eraOf } from './fetch-pro-kifu.mjs';

const CACHE = '.kifu-cache';

function parseArgs(argv) {
  const options = { players: 'T30-30-30-30b,T45-45-45-45b', games: '40', positions: '8', groups: 'edo,early,showa,heisei,reiwa,shoreikai', seed: '1' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) {
      options[argv[i].slice(2)] = argv[i + 1];
      i += 1;
    }
  }
  return options;
}

/** 選手の書き方から、考え方の形。 */
export function playerProfile(spec) {
  const match = String(spec).match(/^T(\d+)-(\d+)-(\d+)-(\d+)(b)?(c)?$/);
  if (!match) throw new Error(`選手の書き方が違います: ${spec}`);
  const [reading, plan, steady, mate] = match.slice(1, 5).map(Number);
  let profile = thinkProfile({ reading, plan, steady, mate });
  if (match[5]) profile = budgetProfile(profile, WATCH_THINK_BUDGET_MS);
  if (match[6]) profile = { ...profile, classic: true };
  return profile;
}

/**
 * CSAの棋譜から、はじめの局面と指し手(USI)。読めなければnull。
 * @param {string} text
 */
export function csaMoves(text) {
  const record = importCSA(text);
  if (record instanceof Error) return null;
  const moves = [];
  const sfens = [];
  record.goto(0);
  sfens.push(record.position.sfen);
  for (let node = record.first.next; node; node = node.next) {
    const move = node.move;
    if (!move || typeof move.usi !== 'string') break;
    moves.push(move.usi);
  }
  // 局面の並び: tsshogiのrecordを1手ずつ進める。
  for (let ply = 1; ply <= moves.length; ply += 1) {
    record.goto(ply);
    sfens.push(record.position.sfen);
  }
  return { start: sfens[0], moves, sfens };
}

const phaseOf = (ply) => (ply <= 30 ? 'opening' : ply <= 80 ? 'middle' : 'ending');

// vite-nodeでは、自分のパスがprocess.argvに入らないので、いつも動かす(ほかから読まない道具)。
{
  const options = parseArgs(process.argv.slice(2).filter((arg) => arg !== '--'));
  const index = JSON.parse(readFileSync(join(CACHE, 'index.json'), 'utf8'));
  const groups = options.groups.split(',');
  const players = options.players.split(',');
  const rng = createRng(Number(options.seed) >>> 0);
  const byGroup = new Map(groups.map((g) => [g, []]));
  for (const game of Object.values(index.games)) {
    if (!existsSync(join(CACHE, 'games', `${game.id}.csa`))) continue;
    const group = game.group ?? (game.tournament === '奨励会' ? 'shoreikai' : eraOf(game.date.slice(0, 4)));
    if (byGroup.has(group)) byGroup.get(group).push(game);
  }
  /** @type {Record<string, Record<string, { hit: number, total: number }>>} */
  const tally = {};
  const add = (player, key, hit) => {
    tally[player] ??= {};
    tally[player][key] ??= { hit: 0, total: 0 };
    tally[player][key].hit += hit ? 1 : 0;
    tally[player][key].total += 1;
  };
  const started = Date.now();
  for (const [group, list] of byGroup) {
    const games = [...list].sort((a, b) => a.id.localeCompare(b.id)).slice(0, Number(options.games));
    for (const game of games) {
      const parsed = csaMoves(readFileSync(join(CACHE, 'games', `${game.id}.csa`), 'utf8'));
      if (!parsed || parsed.moves.length < 20) continue;
      // 局面は、1手目から終局の2手前までを均等に選ぶ(少しずらす)。
      const count = Number(options.positions);
      const span = parsed.moves.length - 2;
      for (let k = 0; k < count; k += 1) {
        const ply = Math.min(span, Math.max(0, Math.floor(((k + rng.next()) / count) * span)));
        const sfen = parsed.sfens[ply];
        const pro = parsed.moves[ply];
        for (const player of players) {
          const profile = playerProfile(player);
          const seeded = createRng((Number(options.seed) * 7919 + ply * 31 + k) >>> 0);
          const thought = chooseThinkingMove({ sfen, profile, random: () => seeded.next(), lastMove: ply > 0 ? parsed.moves[ply - 1] : null });
          const hit = thought?.move === pro;
          add(player, `phase:${phaseOf(ply + 1)}`, hit);
          add(player, `group:${group}`, hit);
          add(player, 'all', hit);
        }
      }
    }
    console.error(`${group}: ${games.length}局 (${Math.round((Date.now() - started) / 1000)}秒)`);
  }
  const pct = (cell) => (cell ? `${((cell.hit / cell.total) * 100).toFixed(1)}%(${cell.total})` : '-');
  const keys = ['all', 'phase:opening', 'phase:middle', 'phase:ending', ...groups.map((g) => `group:${g}`)];
  console.log(`| 選手 | ${keys.join(' | ')} |`);
  console.log(`| --- | ${keys.map(() => '---:').join(' | ')} |`);
  for (const player of players) console.log(`| ${player} | ${keys.map((key) => pct(tally[player]?.[key])).join(' | ')} |`);
}
