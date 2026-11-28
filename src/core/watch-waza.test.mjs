import { describe, expect, it } from 'vitest';
import { WATCH_MEMO_BADGE, WATCH_MEMO_NAME, WATCH_PLAN_BADGE, createWatchWaza, planNames, watchMemoStep, watchWazaStep } from './watch-waza.mjs';
import { sfenAfter } from './pro-cut.mjs';

const STANDARD = 'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1';
// 先手が四間飛車と美濃囲いを組み、後手は端歩などを突くだけ。
const MOVES = ['7g7f', '3c3d', '6g6f', '8c8d', '2h6h', '8d8e', '5i4h', '9c9d', '4h3h', '1c1d', '3h2h', '7a6b', '3i3h', '5a4b', '6i5h', '4b3b'];

function replay(side, options = {}) {
  const tracker = createWatchWaza();
  const shown = [];
  let sfen = STANDARD;
  MOVES.forEach((usi, index) => {
    const after = sfenAfter([usi], sfen);
    const step = watchWazaStep(tracker, { before: sfen, usi, after, ply: index + 1, side, ...options });
    if (step) shown.push(step);
    sfen = after;
  });
  return shown;
}

describe('弟子の観戦の技の演出(docs/disciple-mode-design.mdの42章)', () => {
  it('その日の作戦の名前を戦法と囲いに分ける', () => {
    expect(planNames('ノーマル四間飛車＋本美濃')).toEqual(['ノーマル四間飛車', '本美濃']);
    expect(planNames('')).toEqual([]);
  });

  it('弟子が組んだ囲い・戦法は弟子の名前つきの帯で、作戦どおりなら札を添える', () => {
    const shown = replay('black', { name: '湊', plan: ['ノーマル四間飛車', '本美濃'] });
    const mine = shown.filter(({ cutin }) => cutin.mover === 'black');
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every(({ cutin }) => cutin.kindLabel.startsWith('湊の'))).toBe(true);
    expect(mine.some(({ cutin }) => cutin.badge === WATCH_PLAN_BADGE)).toBe(true);
    expect(mine.some(({ cutin }) => /美濃/.test(cutin.name))).toBe(true);
  });

  it('相手の形は「相手の」の小さな帯になる', () => {
    const shown = replay('white', { name: '湊' });
    const theirs = shown.filter(({ cutin }) => cutin.mover === 'black');
    expect(theirs.length).toBeGreaterThan(0);
    expect(theirs.every(({ cutin }) => cutin.kindLabel.startsWith('相手の') && cutin.size === 'small' && !cutin.badge)).toBe(true);
  });

  it('研究ノートの手(49章): 1局のはじめは大きな「研究どおり！」の帯、2手目からは小さな帯', () => {
    const tracker = createWatchWaza();
    const first = watchMemoStep(tracker, { usi: '7g7f', name: '湊' });
    expect(first.cutin).toMatchObject({ size: 'big', badge: WATCH_MEMO_BADGE, kindLabel: '湊の研究', name: WATCH_MEMO_NAME });
    expect(first.glow.square).toBe('7f');
    expect(watchMemoStep(tracker, { usi: '2g2f', name: '湊' }).cutin.size).toBe('small');
  });
});
