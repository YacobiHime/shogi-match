// 理由で指す棋士(docs/disciple-mode-design.mdの34-16)が、序盤に定跡の手をどれだけ指すかを測る。
// 両側に戦法と囲いを持たせ、40手まで指して、定跡の手が出た数・指した数・外れた理由を数える。
// 上書きデータを入れて測る(35-10)。
// 使い方: npx vite-node scripts/reason-book-report.mjs -- [--levels 12,20,30,40,49] [--games 4]
// 本番と同じ定跡(定跡エディターの上書きデータを含む)で測るため、環境変数を立ててからモジュールを読む。
process.env.OPENING_GUIDE_EDITOR_OVERRIDES = '1';
const { appendUsiMove, createGameRecord, enumerateLegalMoves, STANDARD_SFEN } = await import('../src/game-state');
const { openingPlanMove } = await import('../src/core/relay-game.mjs');
const { createFormationState } = await import('../src/core/formation-tracker.mjs');
const { thinkHere } = await import('../src/core/reason-think.mjs');

const args = process.argv.slice(2);
const option = (key, fallback) => {
  const index = args.indexOf(`--${key}`);
  return index >= 0 ? args[index + 1] : fallback;
};
const levels = String(option('levels', '12,20,30,40,49')).split(',').map(Number);
const games = Number(option('games', 4));
const PAIRS = [
  [{ strategyId: 'shiken', castleId: 'mino' }, { strategyId: 'bougin', castleId: 'funagakoi' }],
  [{ strategyId: 'yagura-strategy', castleId: 'yagura' }, { strategyId: 'shiken', castleId: 'mino' }],
];

for (const lv of levels) {
  let offered = 0;
  let played = 0;
  let firstMiss = [];
  const stages = {};
  for (let g = 0; g < games; g += 1) {
    const [a, b] = PAIRS[g % PAIRS.length];
    const plans = g % 2 ? { black: b, white: a } : { black: a, white: b };
    const record = createGameRecord(STANDARD_SFEN);
    const moves = [];
    let lastCapture = false;
    const formations = createFormationState();
    let missed = null;
    for (let ply = 0; ply < 40; ply += 1) {
      const side = ply % 2 ? 'white' : 'black';
      const legal = enumerateLegalMoves(record.position).map(({ usi }) => usi);
      if (!legal.length) break;
      const planMove = openingPlanMove({ plans, side, ply, record, moves, legal, formations, lastCapture });
      const thought = await thinkHere({ sfen: record.position.sfen, levels: { reading: lv, plan: lv, steady: lv, mate: lv }, planMove, seed: g * 1000 + ply });
      if (planMove) {
        offered += 1;
        if (thought.move === planMove) played += 1;
        else if (missed === null) missed = ply;
        if (thought.move !== planMove) stages[thought.stage + ':' + thought.reason + (thought.skipped?.length ? '(うっかり)' : '')] = (stages[thought.stage + ':' + thought.reason + (thought.skipped?.length ? '(うっかり)' : '')] ?? 0) + 1;
      }
      appendUsiMove(record, thought.move);
      const move = record.current?.move;
      lastCapture = Boolean(move && typeof move === 'object' && move.capturedPieceType);
      moves.push(thought.move);
    }
    firstMiss.push(missed ?? '-');
  }
  console.log(`Lv${lv}: 定跡の手 ${played}/${offered} (${Math.round((played / Math.max(1, offered)) * 100)}%) 最初に外れた手数 ${firstMiss.join(',')}`);
  console.log('  外れたときの手:', JSON.stringify(stages));
}
process.exit(0);
