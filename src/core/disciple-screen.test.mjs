// 師匠の1年の画面(ShogiDisciple.vue)のソースを調べるテスト。守りたい性質が書き方を変えても保たれているかを見る。
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../ShogiDisciple.vue', import.meta.url), 'utf8');

describe('観戦の結果発表の順番(docs/disciple-mode-design.mdの33-3)', () => {
  it('終局したら、終局の札→その日の結果発表→検討の順に段を進める', () => {
    expect(source).toMatch(/phase: "playing" \| "end" \| "result" \| "review";/);
    expect(source).toMatch(/current\.day = dayResultView\(state\.value\?\.lastEvent\);\s*current\.phase = "end";/);
    expect(source).toMatch(/function showDayResult\(\) \{\s*if \(watch\.value\?\.phase === "end"\) watch\.value = \{ \.\.\.watch\.value, phase: "result" \};/);
    expect(source).toMatch(/data-disciple-endcard/);
    expect(source).toMatch(/v-if="watch\.phase === 'result' && watch\.day"[^>]*data-disciple-result/);
  });
  it('印と理由の5択は検討の段だけ。検討しないで閉じたら答えを入れない', () => {
    expect(source).toMatch(/<template v-else-if="watch\.phase === 'review'">/);
    expect(source).toMatch(/v-for="\(mark, index\) in \(watch\.phase === 'review' \? watch\.marks : \[\]\)"/);
    expect(source).toMatch(/if \(current\.phase === "review" && current\.marks\.length && current\.guesses\.some\(Boolean\)\) \{/);
  });
  it('観戦の盤の重なりは盤の枠の中に閉じ、終局の札と結果発表を盤の上に出す', () => {
    expect(source).toMatch(/\.disciple__watch-board \{ (?:grid-area: board; )?position: relative; z-index: 0; isolation: isolate;/);
    expect(source).toMatch(/\.disciple__endcard \{ position: absolute; z-index: 20;/);
    expect(source).toMatch(/\.disciple__result \{ position: absolute; inset: 0; z-index: 20;/);
  });
  it('観戦した日は、声をかけるの札の結果を1行にまとめる', () => {
    expect(source).toMatch(/<p v-if="resultSeen" class="disciple__muted" data-disciple-words-summary>/);
  });
});

describe('検討の盤(docs/disciple-mode-design.mdの33-4)', () => {
  it('検討の段は、1手ずつのボタン・手の一覧・グラフで好きな手へ動かせる', () => {
    expect(source).toMatch(/data-disciple-nav-first @click="goPly\(0\)"/);
    expect(source).toMatch(/data-disciple-nav-prev @click="goPly\(watch\.upto - 1\)"/);
    expect(source).toMatch(/:data-disciple-move="row\.ply" @click="goPly\(row\.ply\)"/);
    expect(source).toMatch(/data-disciple-graph @click="onGraphClick"/);
    expect(source).toMatch(/const watchUpto = computed\(\(\) => \(watch\.value\?\.phase === "review" \? watch\.value\.upto/);
  });
  it('まだ答えていない印の手は、AIの検討を見せない', () => {
    expect(source).toMatch(/const next = unansweredMark\(current\.upto \+ 1\) \? null : aiHint\(current\.entries, current\.upto \+ 1\);/);
    expect(source).toMatch(/const now = current\.upto > 0 && !unansweredMark\(current\.upto\) \? aiHint\(current\.entries, current\.upto\) : null;/);
  });
  it('研究で開く・棋譜帳(棋譜帳から開いたものは答えを入れない)', () => {
    expect(source).toMatch(/emit\("research", \{ sfen: STANDARD_SFEN, moves: current\.entries\.map/);
    expect(source).toMatch(/if \(current\.mode === "book"\) return;/);
    expect(source).toMatch(/commit\(addBookGame\(structuredClone\(state\.value\), entry\)\);/);
  });
  it('スマホの検討は、盤を動かさず手の一覧だけを動かす', () => {
    expect(source).toMatch(/\.disciple__watch--review \{ overflow: hidden; \}/);
    expect(source).toMatch(/list\.scrollTop = Math\.max\(0,/);
  });
});
