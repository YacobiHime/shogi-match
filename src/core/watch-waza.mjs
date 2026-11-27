// 弟子の対局の観戦の技の演出(docs/disciple-mode-design.mdの42章)。対局と同じ判定と見せ方(move-waza.mjs)を、観戦の1手ずつに当てる。
// 弟子の手は「自分の手」と同じ大きな帯(帯の頭に弟子の名前)、相手の手は小さな帯。その日の作戦の形ができたら「作戦どおり！」を添える。
// 画面に依存しない。囲い・戦法は形の追跡(formation-tracker.mjs)を1手ずつ進めて見つける。

import hiraganaFormationMaster from "../data/hiragana_suisho_formations.json";
import { OPENING_CASTLES, OPENING_STRATEGIES } from "./opening-guide.mjs";
import {
  collectionFormationNames, createFormationState, detectFormationSnapshot, formationMove, formedNamesFromState, updateFormationState,
} from "./formation-tracker.mjs";
import { evolvedFrom, formationCatalog, formationGlowSquares, formationShapes } from "./formation-catalog.mjs";
import { collectionCatalog } from "./collection.mjs";
import { detectWazaTesuji, formationWaza, pickWaza, wazaPresentation, wazaRepeatKey } from "./move-waza.mjs";
import { parseSfenBoard } from "./sfen-board.mjs";

const CATALOG = formationCatalog(collectionCatalog({ strategies: OPENING_STRATEGIES, castles: OPENING_CASTLES }));
const CASTLE_LABELS = new Set(CATALOG.filter(({ kind }) => kind === "castle").map(({ label }) => label));
const STRATEGY_LABELS = new Set(CATALOG.filter(({ kind }) => kind === "strategy").map(({ label }) => label));
const FORMATION_LABELS = new Set(CATALOG.map(({ label }) => label));
let shapes = null;
const shapesOf = () => (shapes ??= formationShapes(hiraganaFormationMaster, [...OPENING_CASTLES, ...OPENING_STRATEGIES]));

/** 観戦の1局の演出の記録(形の追跡と、出した技)。 */
export function createWatchWaza() {
  return { formation: createFormationState(), shown: new Set() };
}

/** 「作戦どおり！」の札。 */
export const WATCH_PLAN_BADGE = "作戦どおり！";

/**
 * その日の作戦の名前(「ノーマル四間飛車＋本美濃」)を、戦法と囲いの名前に分ける。
 * @param {string | null | undefined} label
 */
export function planNames(label) {
  return String(label ?? "").split(/[＋+]/).map((part) => part.trim()).filter(Boolean);
}

/**
 * 観戦の1手を進め、出す技があれば帯と盤の光の形を返す。
 * @param {{ formation: any, shown: Set<string> }} tracker createWatchWazaの記録(この関数の中で進める)
 * @param {{ before: string, usi: string, after: string, ply: number, side: 'black' | 'white', name?: string, plan?: string[], simple?: boolean }} move
 *   before・afterは指す前とあとの局面、plyは指したあとの手数、sideは弟子の側、nameは弟子の名前、planはその日の作戦の名前
 * @returns {{ cutin: ReturnType<typeof wazaPresentation> & { mover: 'black' | 'white' }, glow: { square: string, tier: string, mine: boolean, targets: string[], pieces: string[], edge: boolean, look: string } } | null}
 */
export function watchWazaStep(tracker, { before, usi, after, ply, side, name = "", plan = [], simple = false }) {
  const mover = String(before).split(" ")[1] === "w" ? "white" : "black";
  const namesBefore = collectionFormationNames(formedNamesFromState(tracker.formation, mover), FORMATION_LABELS);
  tracker.formation = updateFormationState(tracker.formation, detectFormationSnapshot(after, hiraganaFormationMaster), formationMove(after, ply));
  const namesAfter = collectionFormationNames(formedNamesFromState(tracker.formation, mover), FORMATION_LABELS);
  const formations = formationWaza({ before: namesBefore, after: namesAfter, castles: CASTLE_LABELS, strategies: STRATEGY_LABELS });
  let waza = null;
  try {
    waza = pickWaza([...detectWazaTesuji({ sfenBefore: before, usi }), ...formations]);
  } catch {
    waza = pickWaza(formations);
  }
  if (!waza) return null;
  const mine = mover === side;
  const key = wazaRepeatKey(mine ? "player" : "cpu", waza);
  const repeat = tracker.shown.has(key);
  tracker.shown.add(key);
  const evolved = waza.kind === "tesuji" ? "" : evolvedFrom(waza.name, namesBefore);
  const view = wazaPresentation(waza, { mine, repeat, first: false, tip: false, evolved, simple });
  // 弟子の手は、帯の頭に弟子の名前を出す(自分で指していないので「あなたの」ではない)。
  const kindLabel = mine && name ? `${name}の${view.kindLabel}` : view.kindLabel;
  const onPlan = mine && waza.kind !== "tesuji" && plan.some((part) => part === waza.name || part.includes(waza.name) || waza.name.includes(part));
  const badge = onPlan && !view.badge ? WATCH_PLAN_BADGE : view.badge;
  const pieces = view.glow && waza.kind !== "tesuji"
    ? formationGlowSquares(shapesOf().get(waza.name) ?? [], parseSfenBoard(after), mover, { kind: waza.kind, moved: usi.slice(2, 4) })
    : [];
  return {
    cutin: { ...view, kindLabel, badge, mover },
    glow: { square: usi.slice(2, 4), tier: waza.tier, mine, targets: waza.targets ?? [], pieces, edge: Boolean(view.edge), look: view.look },
  };
}
