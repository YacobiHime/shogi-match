// 師匠の1年の作戦(戦法＋囲い)ごとの強さを、理由で指す棋士どうしの自己対局で測る(docs/disciple-mode-design.mdの35-14。O5)。
// 両側とも同じ能力値・同じ熟練度にして、作戦だけを変える。測る作戦は、相手の作戦(居飛車と振り飛車の2枚)と先後を入れ替えて指す。
// 段の高い作戦ほど、熟練度が同じなら少し勝ちやすいか、を見る。
// 使い方: npx vite-node scripts/disciple-plan-strength.mjs -- [--cards shiken+mino,ibisha+yagura] [--games 4] [--level 25] [--mastery 40] [--plies 160]
// 本番と同じ定跡(定跡エディターの上書きデータを含む)で測るため、環境変数を立ててからモジュールを読む。
process.env.OPENING_GUIDE_EDITOR_OVERRIDES = '1';
const { createNodeEngine } = await import('./lib/node-engine.mjs');
const { playEngineGame } = await import('../src/core/engine-game.mjs');
const { PLAN_TIER_LABELS, planCard, planSpec } = await import('../src/core/disciple-plans.mjs');

const args = process.argv.slice(2);
const option = (key, fallback) => {
  const index = args.indexOf(`--${key}`);
  return index >= 0 ? args[index + 1] : fallback;
};
/** はじめ・基本・応用・特殊な囲いから2枚ずつ(初期値)。 */
const DEFAULT_CARDS = [
  'shiken+mino', 'bougin+kanigakoi',
  'ibisha+yagura', 'nakabisha+half-mino',
  'kakugawari-koshikake-gin+', 'ishida+mino',
  'ibisha+millennium', 'shiken+kimura-mino',
];
const cards = String(option('cards', DEFAULT_CARDS.join(','))).split(',').map((id) => planCard(id)).filter(Boolean);
const games = Number(option('games', 4));
const level = Number(option('level', 25));
const mastery = Number(option('mastery', 40));
const plies = Number(option('plies', 160));
/** 止めた局の勝ち負けを決める評価値の差。 */
const JUDGE_MARGIN = 500;
/** 相手の作戦(居飛車の相手と振り飛車の相手)。 */
const OPPONENTS = ['ibisha+yagura', 'shiken+mino'].map((id) => planCard(id));

const engine = await createNodeEngine();
const search = async ({ moves, nodes, multiPv = 1, searchMoves }) => {
  engine.applyStrengthOptions({ multiPv: Math.max(1, multiPv) });
  await engine.setSearchThreads(1);
  engine.setPosition(`startpos${moves.length ? ` moves ${moves.join(' ')}` : ''}`);
  return engine.go({ nodes, maxTimeMs: 20000, ...(searchMoves ? { searchMoves } : {}) });
};

const levels = { reading: level, plan: level, steady: level, mate: level };
const player = (id, name) => ({ id, name, level, kind: 'kenshukai', reason: { levels, mastery } });

const rows = [];
for (const card of cards) {
  let wins = 0;
  let played = 0;
  let draws = 0;
  const started = Date.now();
  for (let game = 0; game < games; game += 1) {
    const opponent = OPPONENTS[Math.floor(game / 2) % OPPONENTS.length];
    const side = card.colors.includes('white') && game % 2 ? 'white' : 'black';
    const other = side === 'black' ? 'white' : 'black';
    if (!opponent.colors.includes(other)) continue;
    const spec = {
      key: `plan-strength:${card.id}:${game}`, seed: (0x5eed + game * 7919 + card.id.length * 104729) >>> 0, event: 'kenshukai', kind: 'game', label: '測定',
      [side]: player('a', card.label), [other]: player('b', opponent.label),
      plans: { [side]: planSpec(card, { steps: 1 }), [other]: planSpec(opponent, { steps: 1 }) },
    };
    // 長い局はplies手で止め、そのときの形勢(先手から見た評価値。500以上の差)で勝ち負けを決める。届かなければ引き分け。
    const seen = [];
    const result = await playEngineGame({ spec, search, onMove: (entry) => seen.push(entry), isCancelled: () => seen.length >= plies });
    const lastEval = Number(seen.at(-1)?.eval) || 0;
    const winner = result?.end?.winner ?? (lastEval >= JUDGE_MARGIN ? 'black' : lastEval <= -JUDGE_MARGIN ? 'white' : null);
    played += 1;
    if (!winner) draws += 1;
    else if (winner === side) wins += 1;
  }
  const rate = played ? (wins + draws / 2) / played : 0;
  rows.push({ card, wins, draws, played, rate });
  console.log(`${card.label}（${PLAN_TIER_LABELS[card.tier]}）: ${wins}勝${played - wins - draws}敗${draws ? `${draws}分` : ''}  勝率${Math.round(rate * 100)}%  ${Math.round((Date.now() - started) / 1000)}秒`);
}
// 段ごとのまとめ。
const byTier = {};
for (const row of rows) {
  const entry = byTier[row.card.tier] ??= { score: 0, played: 0 };
  entry.score += row.rate * row.played;
  entry.played += row.played;
}
console.log('段ごと:', Object.entries(byTier).map(([tier, entry]) => `${PLAN_TIER_LABELS[tier]} ${Math.round((entry.score / Math.max(1, entry.played)) * 100)}%（${entry.played}局）`).join('  '));
process.exit(0);
