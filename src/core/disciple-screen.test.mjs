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
    expect(source).toMatch(/v-for="\(mark, index\) in \(watch\.phase === 'review' && !seeking \? watch\.marks : \[\]\)"/);
    expect(source).toMatch(/if \(current\.phase !== "review"\) return;\s*if \(current\.guesses\.some\(Boolean\)\) saveToBook\(current\);/);
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
    expect(source).toMatch(/const next = unansweredMark\(current\.upto \+ 1\) \? null : aiHint\(current\.entries, current\.upto \+ 1, start\);/);
    expect(source).toMatch(/const now = current\.upto > 0 && !unansweredMark\(current\.upto\) \? aiHint\(current\.entries, current\.upto, start\) : null;/);
  });
  it('研究で開く・棋譜帳(棋譜帳から開いたものは答えを入れない)', () => {
    expect(source).toMatch(/emit\("research", \{ sfen: current\.sfen \|\| STANDARD_SFEN, moves: current\.entries\.map/);
    expect(source).toMatch(/if \(current\.mode === "book"\) return;/);
    expect(source).toMatch(/commit\(addBookGame\(structuredClone\(state\.value\), entry\)\);/);
  });
  it('スマホの検討は、盤を動かさず手の一覧だけを動かす', () => {
    expect(source).toMatch(/\.disciple__watch--review \{ overflow: hidden; \}/);
    expect(source).toMatch(/list\.scrollTop = Math\.max\(0,/);
  });
});

describe('崩れ方の見立て(docs/disciple-mode-design.mdの33-5)', () => {
  it('印は盤面から決めた6つの崩れ方で、主・副・外れで答え、盤に取られた駒の赤い輪と相手の次の手の点線を出す', () => {
    expect(source).toMatch(/current\.marks = reviewMarks\(current\.entries, current\.side, \{ dan: eyeDan\(state\.value\?\.eye\), big: Boolean\(current\.plan\), start: current\.sfen \?\? "" \}\);/);
    expect(source).toMatch(/v-for="id in REVIEW_CAUSE_ORDER"/);
    expect(source).toMatch(/selectedJudge\.right \? '見抜いた！' : selectedJudge\.near \? `おしい！/);
    expect(source).toMatch(/:risk-squares="clueRings"\s*:threat-arrows="clueArrows"/);
    expect(source).toMatch(/data-disciple-section-start/);
  });
});

describe('見立てを面白くする(docs/disciple-mode-design.mdの33-6)', () => {
  it('分かれ目さがしは印を見る前。印・形勢の言葉・グラフの線・AIの検討を伏せ、「印を見る」で飛ばせる', () => {
    expect(source).toMatch(/const point = current\.marks\.length \? turningPoint\(current\.entries, current\.side\) : null;/);
    expect(source).toMatch(/data-disciple-seek-here @click="seekHere"/);
    expect(source).toMatch(/data-disciple-seek-skip @click="closeSeek"/);
    expect(source).toMatch(/<polyline v-if="!seeking"/);
    expect(source).toMatch(/\{\{ seeking \? '' : row\.word \}\}/);
    expect(source).toMatch(/if \(!current \|\| current\.phase !== "review" \|\| seeking\.value\) return null;/);
  });
  it('好手は金の印で、ほめるのは1局に1回。棋譜帳から開いたものはほめない', () => {
    expect(source).toMatch(/current\.good = goodMoves\(current\.entries, current\.side, \{ start: current\.sfen \?\? "" \}\);/);
    expect(source).toMatch(/disciple__dot--gold/);
    expect(source).toMatch(/if \(!current \|\| !good \|\| current\.praised \|\| current\.mode === "book"\) return;/);
    expect(source).toMatch(/applyFindings\(state\.value, current\.marks, current\.guesses, \{ seekHit, praised: current\.praised \}\)/);
  });
  it('弟子の札に、崩れ方ごとの見抜いた回数', () => {
    expect(source).toMatch(/data-disciple-spotted/);
  });
});

describe('理由で指す棋士の考えの一言と読み筋(34-17・34-18)', () => {
  it('考えの一言は、観戦の欄のv-if/v-else-ifの並びの前に置く(並びの途中に置くと検討の段が消える)', () => {
    expect(source).toMatch(/data-disciple-thought>[\s\S]*?<\/p>\s*<p v-if="watch\.error" class="disciple__ask">/);
    expect(source).toMatch(/<p v-else-if="!watch\.end" class="disciple__ask">[^\n]*\n\s*<template v-else-if="watch\.phase === 'review'">/);
  });
  it('検討では、弟子の手の読み筋と、読んでいなかった相手の手を出す', () => {
    expect(source).toMatch(/return thoughtReading\(current\.entries as any, current\.upto, \{ start: current\.sfen \?\? "" \}\);/);
    expect(source).toMatch(/data-disciple-reading/);
  });
});
