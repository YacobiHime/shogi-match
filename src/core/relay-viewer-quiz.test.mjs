import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// 中継の画面(RelayViewer.vue)の当てもの(docs/tournament-relay-design.mdの52章)を、ソースの形で確かめる。
const source = readFileSync(new URL('../RelayViewer.vue', import.meta.url), 'utf8');

describe('大盤解説の当てもの(画面)', () => {
  it('出題は、見た一番先の手で、前に見た手数より先で、終局まで見ていないときだけ', () => {
    expect(source).toMatch(/ply === revealed\.value && ply > seenAtOpen\s*&& !\(finished\.value && ply >= entries\.value\.length\)/);
    // 見た手数は、手を進めたその場で数える(出題の判定と同じ時に)。
    expect(source).toMatch(/if \(value > revealed\.value\) revealed\.value = value;\s*\}, \{ flush: "sync" \}\);/);
    // 見たところまでを保存し、開き直しても数えない。
    expect(source).toMatch(/const seenAtOpen = seenPly\(quizStore\.value, props\.spec\.key\);/);
    expect(source).toMatch(/markSeen\(quizStore\.value, props\.spec\.key, value\)/);
    // 自分の対局では出さない。
    expect(source).toMatch(/const quizEnabled = !props\.spec\.tags\?\.mine;/);
  });

  it('解説者が選んだ局面に着いたら止めて出題し、形勢当ての問いのあいだは勝率と読み筋を伏せる', () => {
    expect(source).toMatch(/if \(askAtSpot\(cursor\.value\)\) return;/);
    expect(source).toMatch(/judgeHidden \? "？" : blackPercent/);
    expect(source).toMatch(/judgeHidden \? "形勢は？" : verdictText/);
    expect(source).toMatch(/readingText && !\(quiz && !quiz\.result\)/);
    expect(source).toMatch(/JUDGE_REVEAL_MS = 1200/);
  });

  it('大盤解説の仕事は「次の問いまで進める」で、出来高は当たった問題の数', () => {
    expect(source).toMatch(/data-relay-job-quiz @click="goNextSpot">次の問いまで進める</);
    expect(source).toMatch(/emit\("job-done", jobHits\.value\)/);
  });
});
