// 弟子ごとの定跡ファイル(研究ノート)で強くなるかを、理由で指す棋士どうしの自己対局で測る(docs/disciple-mode-design.mdの49章のB0)。
// 同じ能力値・同じ熟練度のAとBが、2つの作戦を先後で入れ替えて指す。Aだけ、対局のあとに「研究」する:
// その局でAが指した局面のうち、作戦の定跡が終わったあとの序盤〜中盤(--max-ply手まで)で、まだファイルにない局面を
// 早い順に--study局面まで、深く読んで(--nodes)、最善の手をファイル(研究メモと同じ「局面→手」)に残す。次の局からその局面ではその手を指す。
// --book offは研究しない比べの組(同じ種)。2つの組の勝率の差が、研究ノートの効き目。
// 使い方: npx vite-node scripts/disciple-book-strength.mjs -- [--book on|off] [--games 16] [--level 25] [--mastery 40]
//   [--a-mastery 70] [--study 6] [--nodes 400000] [--max-ply 60] [--plies 160] [--budget 700] [--cap 300] [--seed 1] [--out out.json]
// 本番と同じ定跡(定跡エディターの上書きデータを含む)で測るため、環境変数を立ててからモジュールを読む。
process.env.OPENING_GUIDE_EDITOR_OVERRIDES = '1';
const fs = await import('node:fs');
const { createNodeEngine } = await import('./lib/node-engine.mjs');
const { playEngineGame } = await import('../src/core/engine-game.mjs');
const { planCard, planSpec } = await import('../src/core/disciple-plans.mjs');
const { rankedCandidates } = await import('../src/core/relay-game.mjs');
const { STANDARD_SFEN, createGameRecord, appendUsiMove } = await import('../src/game-state.ts');

const args = process.argv.slice(2);
const option = (key, fallback) => {
  const index = args.indexOf(`--${key}`);
  return index >= 0 ? args[index + 1] : fallback;
};
const useBook = option('book', 'on') !== 'off';
const games = Number(option('games', 16));
const level = Number(option('level', 25));
const mastery = Number(option('mastery', 40));
/** Aだけの熟練度(研究のカードで熟練度を上げたときの効き目を測る。省けばBと同じ)。 */
const aMastery = Number(option('a-mastery', mastery));
const studyPer = Number(option('study', 6));
const studyNodes = Number(option('nodes', 400000));
const maxPly = Number(option('max-ply', 60));
const plies = Number(option('plies', 160));
const budget = Number(option('budget', 700));
const cap = Number(option('cap', 300));
const seedBase = Number(option('seed', 1));
const out = option('out', '');
/** 止めた局の勝ち負けを決める評価値の差(disciple-plan-strength.mjsと同じ)。 */
const JUDGE_MARGIN = 500;
/** 2つの作戦(居飛車と振り飛車)。Aは局ごとに先後と作戦を入れ替える。 */
const PLANS = String(option('plans', 'ibisha+yagura,shiken+mino')).split(',').map((id) => planCard(id));

const engine = await createNodeEngine();
const search = async ({ moves, nodes, multiPv = 1, searchMoves }) => {
  engine.applyStrengthOptions({ multiPv: Math.max(1, multiPv) });
  await engine.setSearchThreads(1);
  engine.setPosition(`startpos${moves.length ? ` moves ${moves.join(' ')}` : ''}`);
  return engine.go({ nodes, maxTimeMs: 30000, ...(searchMoves ? { searchMoves } : {}) });
};
const positionKey = (sfen) => String(sfen).split(' ').slice(0, 3).join(' ');
const levels = { reading: level, plan: level, steady: level, mate: level };

/** Aの研究ノート(局面→手)。入れた順を覚えて、多すぎたら古い順に忘れる。 */
const notes = {};
const rows = [];
let score = 0;
for (let game = 0; game < games; game += 1) {
  const aSide = game % 2 === 0 ? 'black' : 'white';
  const bSide = aSide === 'black' ? 'white' : 'black';
  // 2局ごとに作戦の組を入れ替え、Aが両方の作戦を先後で同じ数だけ指すようにする。
  const pair = Math.floor(game / 2) % 2 === 0 ? PLANS : [PLANS[1], PLANS[0]];
  const aPlan = pair[0];
  const bPlan = pair[1];
  const spec = {
    key: `book-strength:${game}`, seed: (seedBase * 0x9e3779b1 + game * 7919) >>> 0, event: 'kenshukai', kind: 'game', label: '測定',
    thinkBudgetMs: budget,
    [aSide]: { id: 'a', name: 'A', level, kind: 'kenshukai', reasonRecord: true, reason: { levels, mastery: aMastery, notes: useBook ? { ...notes } : {} } },
    [bSide]: { id: 'b', name: 'B', level, kind: 'kenshukai', reason: { levels, mastery } },
    plans: { [aSide]: planSpec(aPlan, { steps: 1 }), [bSide]: planSpec(bPlan, { steps: 1 }) },
  };
  const started = Date.now();
  const seen = [];
  const result = await playEngineGame({ spec, search, onMove: (entry) => seen.push(entry), isCancelled: () => seen.length >= plies });
  const lastEval = Number(seen.at(-1)?.eval) || 0;
  const winner = result?.end?.winner ?? (lastEval >= JUDGE_MARGIN ? 'black' : lastEval <= -JUDGE_MARGIN ? 'white' : null);
  const point = !winner ? 0.5 : winner === aSide ? 1 : 0;
  score += point;
  // Aの手のうち、ノートの手(memo)の数と損。ノートの外の手の損と比べる。
  const aEntries = seen.filter((_, index) => (index % 2 === 0 ? 'black' : 'white') === aSide);
  const memoMoves = aEntries.filter((entry) => entry.d?.s === 'memo');
  const early = aEntries.filter((entry, index) => index * 2 < maxPly && entry.d?.s !== 'memo' && entry.d?.s !== 'book');
  // 損は中央値(詰みの大きな値に引っぱられないように)。
  const avg = (list) => {
    if (!list.length) return null;
    const values = list.map((entry) => Number(entry.loss) || 0).sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)];
  };
  // 研究: この局でAが指した局面(定跡の手のあと、maxPly手まで)のうち、ファイルにない局面を早い順に読む。
  let studied = 0;
  if (useBook) {
    const record = createGameRecord(STANDARD_SFEN);
    const moves = [];
    for (let index = 0; index < seen.length && index < maxPly && studied < studyPer; index += 1) {
      const entry = seen[index];
      const mine = (index % 2 === 0 ? 'black' : 'white') === aSide;
      const stage = entry.d?.s ?? '';
      const key = positionKey(record.position.sfen);
      if (mine && stage !== 'book' && !(key in notes)) {
        const deep = await search({ moves: [...moves], nodes: studyNodes, multiPv: 1 });
        const best = rankedCandidates(deep)[0]?.move ?? null;
        if (best) {
          notes[key] = best;
          studied += 1;
        }
      }
      if (!appendUsiMove(record, entry.move)) break;
      moves.push(entry.move);
    }
    const keys = Object.keys(notes);
    for (const key of keys.slice(0, Math.max(0, keys.length - cap))) delete notes[key];
  }
  const row = {
    game, aSide, aPlan: aPlan.id, point, plies: seen.length, memo: memoMoves.length, memoLoss: avg(memoMoves), otherLoss: avg(early),
    studied, notes: Object.keys(notes).length, seconds: Math.round((Date.now() - started) / 1000),
  };
  rows.push(row);
  console.log(`${game + 1}/${games} A=${aSide} ${aPlan.label} ${point === 1 ? '勝' : point === 0 ? '負' : '分'} ${seen.length}手 ノートの手${row.memo}（損${row.memoLoss ?? '-'}・ほかの序盤の手の損${row.otherLoss ?? '-'}） 研究${studied} ノート${row.notes} ${row.seconds}秒  累計${score}/${game + 1}`);
}
console.log(`研究ノート${useBook ? 'あり' : 'なし'}: Aの勝率 ${Math.round((score / games) * 100)}%（${games}局）`);
if (out) fs.writeFileSync(out, JSON.stringify({ useBook, games, level, mastery, studyPer, studyNodes, maxPly, rows, score }));
process.exit(0);
