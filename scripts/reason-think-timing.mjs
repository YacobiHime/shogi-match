// 理由で指す棋士(docs/disciple-mode-design.mdの34-16)の1手の時間を、能力値ごとに測る。
// 同じ能力値どうしで1局指し、理由の手の時間の中央・最大・1局の合計を出す。
// 使い方: npx vite-node scripts/reason-think-timing.mjs -- [--levels 20,30,40,49] [--plies 120]
import { FastBoard } from '../src/core/fast-board.mjs';
import { thinkHere } from '../src/core/reason-think.mjs';

const args = process.argv.slice(2);
const option = (key, fallback) => {
  const index = args.indexOf(`--${key}`);
  return index >= 0 ? args[index + 1] : fallback;
};
const levels = String(option('levels', '20,30,40,49')).split(',').map(Number);
const maxPlies = Number(option('plies', 120));
const START = 'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1';

for (const lv of levels) {
  const board = FastBoard.fromSfen(START);
  const times = [];
  for (let ply = 0; ply < maxPlies; ply += 1) {
    if (!board.legal().length) break;
    const started = Date.now();
    const thought = await thinkHere({ sfen: board.toSfen(), levels: { reading: lv, plan: lv, steady: lv, mate: lv }, planMove: null, seed: 1000 + ply });
    times.push(Date.now() - started);
    const move = thought?.move ? board.fromUsi(thought.move) : 0;
    if (!move) break;
    board.make(move);
  }
  const sorted = [...times].sort((a, b) => a - b);
  const total = times.reduce((a, b) => a + b, 0);
  console.log(`Lv${lv}: ${times.length}手 中央${sorted[Math.floor(sorted.length / 2)]}ms 最大${sorted.at(-1)}ms 合計${Math.round(total / 1000)}秒`);
}
process.exit(0);
