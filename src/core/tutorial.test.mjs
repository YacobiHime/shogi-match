import { describe, expect, it } from "vitest";
import { Position } from "tsshogi";
import { createGameRecord, enumerateLegalMoves } from "../game-state";
import { TUTORIAL_LESSONS, TUTORIAL_VOLUMES, tutorialLesson } from "./tutorial-curriculum.mjs";
import {
  attemptTutorialChoice,
  attemptTutorialMove,
  autoAdvancesOnSolve,
  captureMinMoves,
  captureTargets,
  choiceAdvanceDelay,
  createStepState,
  isCheckmate,
  lessonStars,
  matchLessonComment,
  matchLessonStars,
  replayMoveLabel,
  replaySfen,
  replaySpeech,
  seekReplay,
  tutorialGraphPly,
  tutorialGraphPoints,
  tutorialHint,
  tutorialMatchOutcome,
  tutorialMatchSettings,
  tutorialStepSfen,
  withBlackToMove,
} from "./tutorial-runner.mjs";
import {
  TUTORIAL_PROGRESS_KEY,
  TUTORIAL_PROVERBS_KEY,
  emptyTutorialProgress,
  loadCollectedProverbs,
  recordProverb,
  isLessonUnlocked,
  lessonsProgress,
  loadTutorialProgress,
  nextLesson,
  recordLessonCleared,
  recordLessonSkipped,
  saveTutorialProgress,
} from "./tutorial-progress.mjs";
import { referenceDexEntries } from "./reference-dex.mjs";
import { buildFormationStart } from "./learning-setup.mjs";
import { CPU_STRENGTH_PRESETS } from "./strength-settings.mjs";
import { problemById } from "./problem-set.mjs";
import { createProblemState } from "./tutorial-problem.mjs";
import { OPENING_CASTLES, OPENING_STRATEGIES } from "./opening-guide.mjs";
import { OPENING_GUIDE_OVERRIDES } from "../data/opening-guide-overrides.mjs";
import { ATTACK_TEST_HOLD_PLIES } from "./tutorial-problem.mjs";
import { findMateLine } from "./problem-solver";
import { buildLowerBound, buildMissingTargets } from "./tutorial-runner.mjs";
import { kingEscapeMap } from "./board-insight.mjs";
import { openingFormationSteps } from "./opening-formation.mjs";
import { bestGainMove, dropThreat } from "./material-tactics.mjs";

const STEP_TYPES = ["explain", "move-piece", "find-move", "mate", "choose", "play", "replay", "capture", "problem", "build", "attack-test"];
/** 二歩の筋。同じ側の成っていない歩が2枚以上ある筋を「▲3筋」のように返す。 */
function doublePawnFiles(sfen) {
  const files = [];
  const rows = String(sfen).split(" ")[0].split("/");
  for (const color of ["P", "p"]) {
    const counts = new Map();
    for (const row of rows) {
      let file = 9;
      for (let index = 0; index < row.length; index += 1) {
        const char = row[index];
        if (/\d/.test(char)) {
          file -= Number(char);
          continue;
        }
        if (char === "+") {
          index += 1;
        } else if (char === color) {
          counts.set(file, (counts.get(file) ?? 0) + 1);
        }
        file -= 1;
      }
    }
    for (const [file, count] of counts) if (count > 1) files.push(`${color === "P" ? "▲" : "△"}${file}筋`);
  }
  return files;
}
const legalMoves = (sfen) => enumerateLegalMoves(createGameRecord(sfen).position).map(({ usi }) => usi);

function afterMove(sfen, usi) {
  const record = createGameRecord(sfen);
  record.append(record.position.createMoveByUSI(usi));
  return record.position.sfen;
}

/** 王手で1手で詰ませる手の一覧。 */
function mateInOneMoves(sfen) {
  return legalMoves(sfen).filter((usi) => isCheckmate(afterMove(sfen, usi)));
}

/** 指定した駒だけを動かして、maxMoves手以内に目的のマスへ届くか。 */
function reachable(sfen, from, target, maxMoves) {
  let frontier = [{ sfen, square: from }];
  for (let depth = 0; depth < maxMoves; depth += 1) {
    const next = [];
    for (const node of frontier) {
      for (const usi of legalMoves(node.sfen).filter((move) => move.slice(0, 2) === node.square)) {
        if (usi.slice(2, 4) === target) return true;
        const record = createGameRecord(node.sfen);
        record.append(record.position.createMoveByUSI(usi));
        next.push({ sfen: withBlackToMove(record.position.sfen), square: usi.slice(2, 4) });
      }
    }
    frontier = next;
  }
  return false;
}

describe("やこび姫の将棋教室のカリキュラム", () => {
  it("5巻の構成で、すべてのレッスンが一意のIDを持つ", () => {
    expect(TUTORIAL_VOLUMES.map(({ title }) => title)).toEqual([
      "盤と駒をおぼえよう", "一局の流れをつかもう", "攻めと守りのひみつ", "戦法マスターへの道", "形勢を読んで、格言を生かそう",
    ]);
    expect(TUTORIAL_VOLUMES.flatMap(({ chapters }) => chapters)).toHaveLength(13);
    const ids = TUTORIAL_LESSONS.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(TUTORIAL_LESSONS.filter(({ comingSoon }) => comingSoon)).toEqual([]);
    for (const volume of TUTORIAL_VOLUMES) {
      for (const chapter of volume.chapters) expect(chapter.lessons.length, chapter.id).toBeGreaterThan(0);
    }
  });

  // 詰みの探索と駒の損得の読みで、全部のステップを確かめるため時間がかかる(並列で動かすと5秒を超える)。
  it("すべてのステップの盤面・正解・参照先が正しい", () => {
    const dexIds = {
      piece: new Set(referenceDexEntries("piece").map(({ id }) => id)),
      tesuji: new Set(referenceDexEntries("tesuji").map(({ id }) => id)),
      world: new Set(referenceDexEntries("world").map(({ id }) => id)),
      opening: new Set([...OPENING_STRATEGIES, ...OPENING_CASTLES].map(({ id }) => id)),
    };
    for (const lesson of TUTORIAL_LESSONS.filter(({ comingSoon }) => !comingSoon)) {
      expect(lesson.steps.length, lesson.id).toBeGreaterThan(0);
      lesson.steps.forEach((step, index) => {
        const label = `${lesson.id}#${index} ${step.type}`;
        expect(STEP_TYPES, label).toContain(step.type);
        // 問題集の問題は、台詞を省くと問題集の出題の台詞を使う。
        if (step.type !== "problem") expect(step.speech ?? step.question, label).toEqual(expect.any(String));
        const sfen = tutorialStepSfen(step);
        if (sfen) {
          expect(() => createGameRecord(sfen), label).not.toThrow();
          const fields = sfen.split(" ");
          fields[1] = fields[1] === "b" ? "w" : "b";
          expect(Position.newBySFEN(fields.join(" "))?.checked, `${label}: 手番でない側が王手されている`).toBe(false);
        }
        if (["move-piece", "find-move", "mate", "capture", "build", "attack-test"].includes(step.type)) {
          expect(sfen.split(" ")[1], `${label}: 先手番で始める`).toBe("b");
        }
        if (step.type === "capture") {
          // 目標の手数(par)は、探索で求めた最短の手数と同じ。相手の駒が残っている。
          expect(captureTargets(sfen).length, label).toBeGreaterThan(0);
          // 相手の玉は置かない(玉のレッスンでは、自分の玉で取る)。
          expect(sfen.split(" ")[0], label).not.toMatch(/k/);
          expect(captureMinMoves(sfen, step.from), `${label}: 最短の手数`).toBe(step.par);
        }
        if (step.type === "problem") {
          const problem = problemById(step.problemId);
          expect(problem, `${label}: ${step.problemId}`).toBeTruthy();
          expect(createProblemState(step).sfen.split(" ")[1], `${label}: 先手番で始める`).toBe("b");
        }
        if (step.praise) expect(step.praise, label).toEqual(expect.any(String));
        if (step.type === "find-move") {
          const legal = legalMoves(sfen);
          if (step.anyDropOf) expect(legal.some((usi) => usi.startsWith(`${step.anyDropOf}*`)), label).toBe(true);
          else if (step.line) {
            // 相手の応手を決めた手順は、自分の手を順に指すと正解になる。
            let state = createStepState(step);
            let result;
            for (let ply = 0; ply < step.line.length; ply += 2) {
              result = attemptTutorialMove(step, state, step.line[ply]);
              expect(result.outcome, `${label}: ${step.line[ply]}`).not.toBe("wrong");
              state = result.state;
            }
            expect(result.outcome, label).toBe("correct");
          } else {
            expect(step.answers?.length, label).toBeGreaterThan(0);
            for (const usi of step.answers) expect(legal, `${label}: ${usi}`).toContain(usi);
          }
          if (step.untilGain) {
            // 駒得するまで指す課題は、お手本(1手目・手筋の続き・いちばん得な取り方)で、相手のいちばん良い受けに対して目標の損得に届く。
            let state = createStepState(step);
            let result = attemptTutorialMove(step, state, step.answers[0]);
            for (let round = 1; result.outcome === "continue" && round < 6; round += 1) {
              state = result.state;
              const next = round <= (step.plan ?? []).length ? step.plan[round - 1][0] : bestGainMove(state.sfen).usi;
              result = attemptTutorialMove(step, state, next);
            }
            expect(result.outcome, `${label}: 駒得まで指せる`).toBe("correct");
            expect(result.swing, label).toBeGreaterThanOrEqual(step.untilGain);
            // 手筋をかけずに、ほかの手で取りにいっても目標に届かない(手筋を教える課題になっている)。
            expect(bestGainMove(sfen).gain, `${label}: 手筋なしでは駒得できない`).toBeLessThan(step.untilGain);
          }
          if (step.guardDrop) {
            // 指す前は、相手に打ち込まれる隙があり、お手本の手で消える。
            expect(dropThreat(sfen.replace(" b ", " w "), step.guardDrop), `${label}: 隙がある`).not.toBeNull();
            for (const usi of step.answers) expect(attemptTutorialMove(step, createStepState(step), usi).outcome, `${label}: ${usi}`).toBe("correct");
          }
          if (step.threat === "mate") {
            // 詰めろの課題: 王手で詰む手はなく、お手本は王手でない詰めろ。
            expect(mateInOneMoves(sfen), `${label}: 1手詰めがない`).toEqual([]);
            for (const usi of step.answers) expect(attemptTutorialMove(step, createStepState(step), usi).outcome, `${label}: ${usi}`).toBe("correct");
          }
          if (step.defend === "mate") {
            // 受けの課題: 相手の番なら1手で詰まされる形で、お手本の手で受かる。
            expect(mateInOneMoves(sfen.replace(" b ", " w ")).length, `${label}: 詰めろがかかっている`).toBeGreaterThan(0);
            for (const usi of step.answers) expect(attemptTutorialMove(step, createStepState(step), usi).outcome, `${label}: ${usi}`).toBe("correct");
          }
        }
        if (step.type === "move-piece") {
          expect(reachable(sfen, step.from, step.target, step.maxMoves), label).toBe(true);
        }
        if (step.type === "build") {
          expect(buildMissingTargets(step, sfen).length, label).toBeGreaterThan(0);
          if (step.castle) {
            // 完成形と手順は定跡図鑑の囲いの定義と同じ。本番で上書きデータに置き換わらない囲いを使う。
            const castle = OPENING_CASTLES.find(({ id }) => id === step.castle);
            expect(step.targets, label).toEqual(castle.completionSquares);
            expect(OPENING_GUIDE_OVERRIDES?.[`castle:${step.castle}`], `${label}: 上書きデータ`).toBeUndefined();
          }
          // お手本の手順で完成し、目標の手数(par)は手順の長さ。下限と同じなら最短。
          // 持ち駒を打って並べるときは、空いているマスへ1枚ずつ打つ手順をお手本にする。
          const moves = step.drop ? buildMissingTargets(step, sfen).map(([square, kind]) => `${kind}*${square}`) : step.moves;
          let state = createStepState(step);
          let result;
          for (const usi of moves) {
            result = attemptTutorialMove(step, state, usi);
            expect(result.outcome, `${label}: ${usi}`).not.toBe("wrong");
            state = result.state;
          }
          expect(result.outcome, label).toBe("correct");
          expect(step.par, label).toBe(moves.length);
          expect(buildLowerBound(step), label).toBeLessThanOrEqual(step.par);
        }
        if (step.type === "attack-test") {
          if (step.expect === "mate") {
            expect(findMateLine(sfen, step.plies, { nodeLimit: 2_000_000, maxTimeMs: 20000 })?.length, `${label}: ${step.plies}手以内に詰む`).toBeLessThanOrEqual(step.plies);
          } else {
            expect(findMateLine(sfen, ATTACK_TEST_HOLD_PLIES, { nodeLimit: 2_000_000, maxTimeMs: 20000 }), `${label}: 詰まない`).toBeNull();
          }
        }
        for (const color of step.escapeMap === "both" ? ["black", "white"] : step.escapeMap ? [step.escapeMap] : []) {
          expect(kingEscapeMap(sfen, color), label).not.toBeNull();
        }
        if (step.kiki) expect(["both", "black", "white"], label).toContain(step.kiki);
        if (step.type === "mate") {
          let state = createStepState(step);
          for (let ply = 0; ply < step.solution.length; ply += 2) {
            const result = attemptTutorialMove(step, state, step.solution[ply]);
            expect(result.outcome, `${label}: ${step.solution[ply]}`).not.toBe("wrong");
            state = result.state;
          }
          expect(isCheckmate(state.sfen), `${label}: 詰みになる`).toBe(true);
          if (step.solution.length === 3) {
            // 本当の3手詰め：1手詰めがなく、初手に相手がどう応じても次の1手で詰む。
            expect(mateInOneMoves(sfen), `${label}: 1手詰めがない`).toEqual([]);
            const afterFirst = afterMove(sfen, step.solution[0]);
            for (const reply of legalMoves(afterFirst)) {
              expect(mateInOneMoves(afterMove(afterFirst, reply)).length, `${label}: ${reply}`).toBeGreaterThan(0);
            }
          }
        }
        if (step.type === "replay") {
          expect(step.from, label).toBeGreaterThanOrEqual(0);
          expect(step.from, label).toBeLessThan(step.moves.length);
          expect(() => replaySfen(step, step.moves.length), `${label}: 棋譜が指せる`).not.toThrow();
          for (const ply of Object.keys(step.notes ?? {}).map(Number)) {
            expect(ply > step.from && ply <= step.moves.length, `${label}: ${ply}手目の解説`).toBe(true);
            // 解説の先頭に書いた指し手が、棋譜の手と一致している。
            const mark = step.notes[ply].match(/^[▲△][^。]+/)?.[0];
            if (mark) expect(replayMoveLabel(step, ply), `${label}: ${ply}手目`).toBe(mark);
          }
        }
        if (step.graph) {
          expect(step.graph.evaluations, `${label}: 0手目から全局面の評価値`).toHaveLength(step.graph.moves.length + 1);
          const moves = step.moves ?? [];
          expect(step.graph.moves.slice(0, moves.length), `${label}: 盤の手順がグラフの対局と同じ`).toEqual(moves);
          const points = tutorialGraphPoints(step);
          expect(points.every(({ graphValue }) => Number.isFinite(graphValue)), label).toBe(true);
          // 台詞で読み上げる評価値が、その手数のグラフの値と一致している。
          const texts = step.type === "replay"
            ? [[step.from, step.speech], ...Object.entries(step.notes ?? {}).map(([ply, note]) => [Number(ply), note])]
            : [[tutorialGraphPly(step, createStepState(step)), step.speech]];
          for (const [ply, text] of texts) {
            const spoken = text.match(/評価値[はが]([+-]\d+)/)?.[1];
            if (spoken) expect(Number(spoken), `${label}: ${ply}手目の評価値`).toBe(step.graph.evaluations[ply]);
          }
        }
        if (step.type === "choose") {
          expect(step.options.length, label).toBeGreaterThanOrEqual(2);
          expect(step.answer, label).toBeGreaterThanOrEqual(0);
          expect(step.answer, label).toBeLessThan(step.options.length);
        }
        // その場の図鑑は、図鑑にある項目を参照し、定跡の小さな盤は手順のある作戦を描く。
        if (step.dex) {
          expect(step.type, label).toBe("explain");
          expect(dexIds[step.dex.kind]?.has(step.dex.id), label).toBe(true);
          for (const page of step.pages ?? []) expect(page.title && page.text, label).toBeTruthy();
          for (const formation of step.formations ?? []) {
            expect(formation.label, label).toBeTruthy();
            expect(openingFormationSteps(formation.strategyId, formation.castleId).steps.length, label).toBeGreaterThan(0);
          }
        }
        if (step.type === "play" && step.preset.startType === "formation") {
          const result = buildFormationStart({
            black: { strategyId: step.preset.playerStrategy, castleId: step.preset.playerCastle },
            white: { strategyId: step.preset.opponentStrategy, castleId: step.preset.opponentCastle },
          });
          expect(result.ok, `${label}: ${result.message}`).toBe(true);
        }
      });
    }
  }, 60_000);

  it("台詞に図鑑の見出し向けの「〜こと！」をつながない", () => {
    for (const lesson of TUTORIAL_LESSONS) {
      for (const text of [lesson.summary, ...lesson.steps.flatMap(({ speech, question }) => [speech, question])]) {
        if (text) expect(text, lesson.id).not.toMatch(/こと！/);
      }
    }
    expect(tutorialLesson("v1-king").steps[1].speech).toBe("玉を5七（緑のマス）まで動かしてみよう！ 2手以内で届くよ。");
  });

  it("図鑑の画面へ移るステップを使わず、その場の図鑑で見せる(設計16-4)", () => {
    const steps = TUTORIAL_LESSONS.flatMap(({ steps: list }) => list);
    expect(steps.filter(({ type }) => type === "open-dex")).toEqual([]);
    const dex = steps.filter(({ dex: entry }) => entry);
    expect(dex.map(({ dex: entry }) => `${entry.kind}:${entry.id}`)).toEqual(expect.arrayContaining([
      "piece:piece-values", "tesuji:head-gold", "opening:yagura", "opening:shiken",
    ]));
    // 図鑑の項目の局面と印は、図鑑のデータと同じ(二重に持たない)。
    const headGold = dex.find(({ dex: entry }) => entry.id === "head-gold");
    const entry = referenceDexEntries("tesuji").find(({ id }) => id === "head-gold");
    expect(headGold).toMatchObject({ sfen: entry.sfen, marks: entry.marks, arrows: entry.arrows, speech: entry.overview, headline: entry.label });
    expect(headGold.pages.length).toBe(entry.rows.length);
    expect(dex.find(({ dex: item }) => item.id === "piece-values").values.map(({ label, points }) => `${label}${points}`).slice(0, 7))
      .toEqual(["歩1", "香3", "桂4", "銀5", "金6", "角8", "飛10"]);
  });

  it("格言札は手筋図鑑の格言を、課題に1レッスン1枚まで付け、第1巻から第4巻のどの巻にもある(設計16-5)", () => {
    const tesuji = new Set(referenceDexEntries("tesuji").map(({ id }) => id));
    const volumes = new Set();
    for (const lesson of TUTORIAL_LESSONS) {
      const cards = lesson.steps.filter(({ proverb }) => proverb);
      expect(cards.length, lesson.id).toBeLessThanOrEqual(1);
      for (const step of cards) {
        expect(tesuji.has(step.proverb), `${lesson.id} ${step.proverb}`).toBe(true);
        expect(["move-piece", "find-move", "mate", "capture", "build", "attack-test"], lesson.id).toContain(step.type);
        volumes.add(lesson.volumeId);
      }
    }
    expect([...volumes].sort()).toEqual(expect.arrayContaining(["v1", "v2", "v3", "v4"]));
    // 第1巻の最初の駒のレッスンから出会う。
    expect(tutorialLesson("v1-silver").steps.some(({ proverb }) => proverb === "silver-zigzag")).toBe(true);
  });

  it("格言帳は出会った格言を重ねずに残し、壊れた記録でも空の帳面で遊べる", () => {
    const store = new Map();
    const storage = { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) };
    expect(loadCollectedProverbs(storage)).toEqual([]);
    expect(recordProverb(storage, "silver-zigzag")).toEqual({ ids: ["silver-zigzag"], isNew: true });
    expect(recordProverb(storage, "silver-zigzag")).toEqual({ ids: ["silver-zigzag"], isNew: false });
    expect(JSON.parse(store.get(TUTORIAL_PROVERBS_KEY))).toEqual(["silver-zigzag"]);
    store.set(TUTORIAL_PROVERBS_KEY, "{broken");
    expect(loadCollectedProverbs(storage)).toEqual([]);
    const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(recordProverb(blocked, "head-gold")).toEqual({ ids: ["head-gold"], isNew: true });
  });

  it("教室と図鑑の局面に二歩がない(攻めくらべの局面で後手の3三歩と3四歩が並んでいたことがあった)", () => {
    expect(doublePawnFiles("4k4/9/6p2/6p2/9/9/9/9/4K4 b - 1")).toEqual(["△3筋"]);
    expect(doublePawnFiles("4k4/9/6+p2/6p2/9/9/9/9/4K4 b - 1")).toEqual([]);
    for (const lesson of TUTORIAL_LESSONS) {
      lesson.steps.forEach((step, index) => {
        const sfen = step.type === "problem" ? createProblemState(step).sfen : tutorialStepSfen(step);
        if (sfen) expect(doublePawnFiles(sfen), `${lesson.id}#${index}`).toEqual([]);
      });
    }
    for (const kind of ["piece", "tesuji", "glossary"]) {
      for (const entry of referenceDexEntries(kind)) {
        if (entry.sfen) expect(doublePawnFiles(entry.sfen), `${kind}:${entry.id}`).toEqual([]);
      }
    }
  });

  it("吹き出しの文は1ステップ60字まで(大事なことは盤の上のひとことで見せる。設計16-3)", () => {
    for (const lesson of TUTORIAL_LESSONS) {
      lesson.steps.forEach(({ speech, question }, index) => {
        for (const text of [speech, question]) {
          if (text) expect([...text].length, `${lesson.id}#${index} ${text}`).toBeLessThanOrEqual(60);
        }
      });
    }
  });

  it("章の腕だめしは章の最後に置き、課題を4問以上持つ", () => {
    const tasks = new Set(["move-piece", "find-move", "mate", "choose", "capture", "problem", "build", "attack-test"]);
    for (const volume of TUTORIAL_VOLUMES) {
      for (const chapter of volume.chapters) {
        const bosses = chapter.lessons.filter(({ boss }) => boss);
        expect(bosses.length, chapter.id).toBeLessThanOrEqual(1);
        if (!bosses.length) continue;
        expect(chapter.lessons.at(-1).boss, chapter.id).toBe(true);
        expect(bosses[0].steps.filter(({ type }) => tasks.has(type)).length, chapter.id).toBeGreaterThanOrEqual(4);
      }
    }
    // 観戦だけの章には置かない(平地)。それ以外の章には置く。
    const chapters = TUTORIAL_VOLUMES.flatMap(({ chapters: list }) => list);
    expect(chapters.filter((chapter) => chapter.lessons.some(({ boss }) => boss)).map(({ id }) => id)).toEqual([
      "v1-c1", "v1-c2", "v2-c1", "v2-c3", "v3-c1", "v3-c3", "v4-c1", "v4-c2", "v5-c1", "v5-plan", "v5-c2",
    ]);
  });

  it("課題を増やし、説明を読むだけのステップを全体の半分未満にする", () => {
    const steps = TUTORIAL_LESSONS.flatMap(({ steps: list }) => list);
    const reading = steps.filter(({ type }) => type === "explain").length;
    expect(reading / steps.length).toBeLessThan(0.5);
    // 第1巻は、レッスンごとに盤で指す課題がある(話を聞くだけのレッスンを作らない)。
    const board = new Set(["move-piece", "find-move", "mate", "capture", "problem", "build", "attack-test"]);
    const volume1 = TUTORIAL_LESSONS.filter(({ volumeId, id }) => volumeId === "v1" && id !== "v1-win" && id !== "v1-setup");
    for (const lesson of volume1) expect(lesson.steps.some(({ type }) => board.has(type)), lesson.id).toBe(true);
  });

  it("評価値のレッスンは、盤面と評価値グラフを合わせて見せる", () => {
    const lesson = tutorialLesson("v5-evaluation");
    const boardSteps = lesson.steps.filter(({ type }) => type !== "choose");
    for (const step of boardSteps) {
      expect(tutorialStepSfen(step), step.speech).not.toBe("");
      expect(tutorialGraphPoints(step).length, step.speech).toBeGreaterThan(0);
    }
    const replay = lesson.steps.find(({ type }) => type === "replay");
    const points = tutorialGraphPoints(replay);
    expect(points).toHaveLength(68);
    expect(points[30]).toMatchObject({ label: "30手目 △5二金", scoreLabel: "評価値 +2055" });
    expect(points[32]).toMatchObject({ label: "32手目 △7一飛", scoreLabel: "評価値 +4191" });
    // 詰んだ最後の局面も、グラフを0へ落とさない。
    expect(points[67].scoreLabel).toBe("詰み");
    expect(points[67].graphValue).toBe(points[66].graphValue);
    expect(tutorialGraphPly(replay, seekReplay(replay, createStepState(replay), 31))).toBe(31);
  });

  it("「端玉には端歩」は、端歩の突き捨てで香が玉まで通る", () => {
    const step = tutorialLesson("v5-pawn-proverbs").steps.find(({ type }) => type === "find-move");
    expect(step.answers).toEqual(["1e1d"]);
    const sfen = ["1e1d", "1c1d", "1i1d"].reduce((current, usi) => {
      expect(legalMoves(current), usi).toContain(usi);
      return afterMove(current, usi);
    }, step.sfen);
    expect(Position.newBySFEN(sfen).checked).toBe(true);
  });

  it("定跡の練習は、図鑑の手順を順番に指させる", () => {
    const lesson = tutorialLesson("v4-shiken");
    expect(lesson.steps.filter(({ type }) => type === "find-move").map(({ answers }) => answers[0]))
      .toEqual(["7g7f", "6g6f", "2h6h"]);
  });
});

describe("やこび姫の将棋教室の正誤判定", () => {
  it("駒を目的のマスまで動かすと正解、手数を使い切るとやり直し", () => {
    const step = tutorialLesson("v1-pawn").steps.find(({ type }) => type === "move-piece");
    let state = createStepState(step);
    let result = attemptTutorialMove(step, state, "5g5f");
    expect(result.outcome).toBe("continue");
    expect(result.state.sfen.split(" ")[1]).toBe("b");
    result = attemptTutorialMove(step, result.state, "5f5e");
    expect(result.outcome).toBe("correct");

    const knight = tutorialLesson("v1-knight").steps.find(({ type }) => type === "move-piece");
    state = createStepState(knight);
    result = attemptTutorialMove(knight, state, "5i6g");
    result = attemptTutorialMove(knight, result.state, "6g7e");
    expect(result.outcome).toBe("wrong");
    expect(result.state.square).toBe("5i");
    // ほかの駒（玉）を動かすのも不正解。
    expect(attemptTutorialMove(knight, createStepState(knight), "1i2h").outcome).toBe("wrong");
  });

  it("正解の一手と、持ち駒をどこに打ってもよい問題を判定する", () => {
    const promotion = tutorialLesson("v1-promotion").steps.find(({ type }) => type === "find-move");
    expect(attemptTutorialMove(promotion, createStepState(promotion), "4d4c").outcome).toBe("wrong");
    expect(attemptTutorialMove(promotion, createStepState(promotion), "4d4c+").outcome).toBe("correct");
    const drop = tutorialLesson("v1-hand").steps.find(({ anyDropOf }) => anyDropOf);
    expect(attemptTutorialMove(drop, createStepState(drop), "G*2e").outcome).toBe("correct");
    expect(attemptTutorialMove(drop, createStepState(drop), "5d5c").outcome).toBe("wrong");
  });

  it("詰将棋は詰みになる手を正解にする", () => {
    const step = tutorialLesson("v2-mate-head-gold").steps.find(({ type }) => type === "mate");
    expect(attemptTutorialMove(step, createStepState(step), "G*4b").outcome).toBe("wrong");
    expect(attemptTutorialMove(step, createStepState(step), "G*5b").outcome).toBe("correct");
  });

  it("3手詰めは、決めた応手を返して続きを指させる", () => {
    const step = tutorialLesson("v2-mate-three").steps.find(({ type }) => type === "mate");
    const first = attemptTutorialMove(step, createStepState(step), step.solution[0]);
    expect(first).toMatchObject({ outcome: "continue", reply: step.solution[1] });
    expect(attemptTutorialMove(step, first.state, step.solution[2]).outcome).toBe("correct");
  });

  it("観戦は棋譜を1手ずつ進め、最後まで見たら次へ進める", () => {
    const step = tutorialLesson("v2-watch-opening").steps.find(({ type }) => type === "replay");
    let state = createStepState(step);
    expect(state.ply).toBe(0);
    expect(replaySpeech(step, 0)).toBe(step.speech);
    state = seekReplay(step, state, -3);
    expect(state.ply).toBe(0);
    state = seekReplay(step, state, 1);
    expect(replayMoveLabel(step, 1)).toBe("▲7六歩");
    expect(replaySpeech(step, 1)).toBe(step.notes[1]);
    expect(replaySpeech(step, 2)).toBe("△3四歩と指したよ。");
    expect(state.solved).toBe(false);
    state = seekReplay(step, state, step.moves.length + 5);
    expect(state).toMatchObject({ ply: step.moves.length, solved: true });
    // 戻っても、最後まで見た記録は残す。
    expect(seekReplay(step, state, 3).solved).toBe(true);

    const later = tutorialLesson("v2-watch-endgame").steps[0];
    expect(createStepState(later).ply).toBe(later.from);
    expect(seekReplay(later, createStepState(later), 0).ply).toBe(later.from);
  });

  it("盤で指すステップだけ、正解したら自動で次へ進める", () => {
    expect(["move-piece", "find-move", "mate"].map((type) => autoAdvancesOnSolve({ type }))).toEqual([true, true, true]);
    expect(["choose", "explain", "replay", "play"].map((type) => autoAdvancesOnSolve({ type })))
      .toEqual([false, false, false, false]);
  });

  it("選択肢・ヒント・★を判定する", () => {
    const choose = tutorialLesson("v1-board").steps.find(({ type }) => type === "choose");
    expect(attemptTutorialChoice(choose, choose.answer)).toBe("correct");
    expect(attemptTutorialChoice(choose, (choose.answer + 1) % choose.options.length)).toBe("wrong");
    const find = tutorialLesson("v1-turns").steps.find(({ type }) => type === "find-move");
    expect(tutorialHint(find, createStepState(find), 1).arrows).toEqual([]);
    expect(tutorialHint(find, createStepState(find), 2).arrows).toEqual(["7g7f"]);
    expect([lessonStars({}), lessonStars({ mistakes: 1, hints: 1 }), lessonStars({ mistakes: 3 })]).toEqual([3, 2, 1]);
    // 選択問題は、解説を読む時間をとってから自動で進める。長い解説ほど長く、上限がある。
    expect(choiceAdvanceDelay("")).toBe(1400);
    expect(choiceAdvanceDelay("あいうえお")).toBe(1625);
    expect(choiceAdvanceDelay("あ".repeat(200))).toBe(4200);
  });
});

describe("やこび姫の将棋教室の対局", () => {
  it("対局ステップは強さや閃き・待ったの回数まで固定の条件を持つ", () => {
    const plays = TUTORIAL_LESSONS.flatMap(({ steps = [] }) => steps.filter(({ type }) => type === "play"));
    expect(plays.length).toBeGreaterThan(0);
    for (const step of plays) {
      const settings = tutorialMatchSettings(step.preset);
      expect(CPU_STRENGTH_PRESETS.some(({ level }) => level === settings.cpuLevel)).toBe(true);
      expect(settings.playerColor).toBe("black");
      expect(Number.isInteger(settings.hintLimit)).toBe(true);
      expect(Number.isInteger(settings.undoLimit)).toBe(true);
      expect(["off", "encourage", "detailed"]).toContain(settings.coachLevel);
    }
  });

  it("終局結果から勝敗・★・やこび姫の一言を決める", () => {
    expect(tutorialMatchOutcome({ outcome: "black-win" }, "black")).toBe("win");
    expect(tutorialMatchOutcome({ outcome: "black-win" }, "white")).toBe("lose");
    expect(tutorialMatchOutcome({ outcome: "draw" }, "black")).toBe("draw");
    expect(matchLessonStars({ outcome: "win", assistsUsed: 0 })).toBe(3);
    expect(matchLessonStars({ outcome: "win", assistsUsed: 2 })).toBe(2);
    expect(matchLessonStars({ outcome: "lose" })).toBe(1);
    expect(matchLessonStars({ outcome: "draw" })).toBe(1);
    expect(matchLessonComment({ outcome: "win", reason: "checkmate" }, { win: "囲いのおかげだね。" }))
      .toBe("相手の玉を詰ませたね、おみごと！囲いのおかげだね。");
    expect(matchLessonComment({ outcome: "lose", reason: "resignation" })).toContain("負けちゃった");
  });
});

describe("やこび姫の将棋教室の進捗", () => {
  const lessons = TUTORIAL_LESSONS;

  it("前のレッスンを終えると次が解放され、スキップでも進める", () => {
    let progress = emptyTutorialProgress();
    expect(isLessonUnlocked(lessons, progress, lessons[0].id)).toBe(true);
    expect(isLessonUnlocked(lessons, progress, lessons[1].id)).toBe(false);
    progress = recordLessonCleared(progress, lessons[0].id, 2);
    expect(isLessonUnlocked(lessons, progress, lessons[1].id)).toBe(true);
    progress = recordLessonSkipped(progress, lessons[1].id);
    expect(isLessonUnlocked(lessons, progress, lessons[2].id)).toBe(true);
    expect(nextLesson(lessons, progress).id).toBe(lessons[2].id);
  });

  it("準備中のレッスンは解放の妨げにならない", () => {
    const withComingSoon = [{ id: "a" }, { id: "b", comingSoon: true }, { id: "c" }];
    const progress = recordLessonCleared(emptyTutorialProgress(), "a", 3);
    expect(isLessonUnlocked(withComingSoon, progress, "c")).toBe(true);
  });

  it("★は最高記録を残し、スキップでクリア記録を消さない", () => {
    let progress = recordLessonCleared(emptyTutorialProgress(), "v1-board", 3);
    progress = recordLessonCleared(progress, "v1-board", 1);
    progress = recordLessonSkipped(progress, "v1-board");
    expect(progress.lessons["v1-board"]).toEqual({ status: "cleared", stars: 3 });
    const summary = lessonsProgress(lessons.slice(0, 2), progress);
    expect(summary).toMatchObject({ cleared: 1, total: 2, stars: 3, maxStars: 6 });
  });

  it("保存と読み込みで不正な記録を捨てる", () => {
    const storage = new Map();
    const fake = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
    const progress = recordLessonCleared(emptyTutorialProgress(), "v1-board", 2);
    expect(saveTutorialProgress(fake, progress)).toBe(true);
    expect(loadTutorialProgress(fake)).toEqual(progress);
    storage.set(TUTORIAL_PROGRESS_KEY, JSON.stringify({ lessons: { a: { status: "cleared", stars: 9 }, b: { status: "skipped" } } }));
    expect(loadTutorialProgress(fake)).toEqual({ lessons: { b: { status: "skipped", stars: 0 } } });
    storage.set(TUTORIAL_PROGRESS_KEY, "{broken");
    expect(loadTutorialProgress(fake)).toEqual(emptyTutorialProgress());
  });
});
