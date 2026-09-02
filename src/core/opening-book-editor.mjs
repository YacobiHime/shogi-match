import { Position } from "tsshogi";

export const OPENING_BOOK_SCHEMA_VERSION = 1;
export const OPENING_BOOK_STORAGE_KEY = "shogi-match-opening-book-draft-v1";
export const OPENING_BOOK_LIBRARY_STORAGE_KEY = "shogi-match-opening-book-library-v1";

export function openingBookDraftKey(book) {
  const kind = ["strategy", "castle"].includes(book?.kind) ? book.kind : "strategy";
  return `${kind}:${String(book?.id ?? "new-opening")}`;
}

export function createOpeningBookLibrary() {
  return { schemaVersion: OPENING_BOOK_SCHEMA_VERSION, activeKey: "", books: {}, deletedKeys: [] };
}

export function parseOpeningBookLibrary(text) {
  if (!text) return createOpeningBookLibrary();
  const value = JSON.parse(text);
  if (!value || Array.isArray(value) || typeof value !== "object") throw new Error("下書き一覧が不正です。");
  return {
    schemaVersion: OPENING_BOOK_SCHEMA_VERSION,
    activeKey: typeof value.activeKey === "string" ? value.activeKey : "",
    books: value.books && !Array.isArray(value.books) && typeof value.books === "object" ? value.books : {},
    deletedKeys: Array.isArray(value.deletedKeys) ? [...new Set(value.deletedKeys.filter((key) => typeof key === "string"))] : [],
  };
}

export function saveOpeningBookToLibrary(library, book) {
  const key = openingBookDraftKey(book);
  return {
    schemaVersion: OPENING_BOOK_SCHEMA_VERSION,
    activeKey: key,
    books: { ...(library?.books ?? {}), [key]: JSON.parse(serializeOpeningBook(book)) },
    deletedKeys: (library?.deletedKeys ?? []).filter((deletedKey) => deletedKey !== key),
  };
}

export function deleteOpeningBookFromLibrary(library, key) {
  const books = { ...(library?.books ?? {}) };
  delete books[key];
  return {
    schemaVersion: OPENING_BOOK_SCHEMA_VERSION,
    activeKey: library?.activeKey === key ? "" : library?.activeKey ?? "",
    books,
    deletedKeys: [...(library?.deletedKeys ?? [])],
  };
}

export function deleteOpeningDefinitionFromLibrary(library, key) {
  const next = deleteOpeningBookFromLibrary(library, key);
  return {
    ...next,
    deletedKeys: [...new Set([...(next.deletedKeys ?? []), key])],
  };
}

export function serializeOpeningBookLibrary(library) {
  return `${JSON.stringify({ ...createOpeningBookLibrary(), ...library }, null, 2)}\n`;
}

export function normalizeMovePositionPrerequisiteGroups(conditions) {
  if (!Array.isArray(conditions)) return [];
  return conditions.map((group) => ({
    alternatives: (Array.isArray(group?.alternatives) ? group.alternatives : [group])
      .map((condition) => ({ ...condition })),
  }));
}

export function normalizeMovePositionPrerequisites(prerequisites) {
  if (!prerequisites || Array.isArray(prerequisites) || typeof prerequisites !== "object") return {};
  return Object.fromEntries(Object.entries(prerequisites).map(
    ([move, conditions]) => [move, normalizeMovePositionPrerequisiteGroups(conditions)],
  ));
}

export function createOpeningBookDraft({ definition, kind = "strategy", side = "black", initialSfen }) {
  const now = new Date().toISOString().slice(0, 10);
  return {
    schemaVersion: OPENING_BOOK_SCHEMA_VERSION,
    id: definition?.id ?? "new-opening",
    label: definition?.label ?? "新しい定跡",
    kind,
    side,
    classification: {
      name: definition?.classificationName ?? "",
      family: definition?.family ?? "",
      rookStyle: definition?.rookStyle ?? "",
      menuGroup: definition?.menuGroup ?? "",
      contexts: [...(definition?.contexts ?? [])],
    },
    initialSfen,
    guideMoves: [...(definition?.blackMoves ?? [])],
    completionVariants: (definition?.completionVariants?.length
      ? definition.completionVariants
      : definition?.completionSquares?.length ? [definition.completionSquares] : []
    ).map((variant) => variant.map(([square, kind]) => [square, kind])),
    movePositionPrerequisites: normalizeMovePositionPrerequisites(definition?.movePositionPrerequisites),
    completionChoices: {
      enabled: Boolean(definition?.completionChoices?.strategyIds?.length),
      prompt: definition?.completionChoices?.prompt ?? "",
      strategyIds: [...(definition?.completionChoices?.strategyIds ?? [])],
    },
    sources: [{ title: "", url: "", checkedAt: now }],
    branches: [{ id: "main", label: "本線", moves: [] }],
    notes: "",
    engineReview: { checked: false, note: "" },
    updatedAt: new Date().toISOString(),
  };
}

export function replayOpeningBranch(book, branch, moveCount = branch?.moves?.length ?? 0) {
  let position;
  try {
    position = Position.newBySFEN(book?.initialSfen);
    if (!position) throw new Error();
  } catch {
    return { position: null, applied: 0, error: "開始局面のSFENが不正です。" };
  }
  const limit = Math.min(moveCount, branch?.moves?.length ?? 0);
  for (let index = 0; index < limit; index += 1) {
    const usi = branch.moves[index]?.usi;
    const move = typeof usi === "string" ? position.createMoveByUSI(usi) : null;
    if (!move || !position.isValidMove(move) || !position.doMove(move)) {
      return { position, applied: index, error: `${index + 1}手目「${usi || "空欄"}」は、この局面では指せません。` };
    }
  }
  return { position, applied: limit, error: null };
}

export function validateOpeningBook(book) {
  const errors = [];
  const warnings = [];
  if (book?.schemaVersion !== OPENING_BOOK_SCHEMA_VERSION) errors.push("未対応のschemaVersionです。");
  if (!/^[a-z0-9][a-z0-9-]*$/.test(book?.id ?? "")) errors.push("IDは半角英小文字・数字・ハイフンで入力してください。");
  if (!String(book?.label ?? "").trim()) errors.push("名称を入力してください。");
  if (!["strategy", "castle"].includes(book?.kind)) errors.push("種類は戦法か囲いにしてください。");
  if (!["black", "white", "both"].includes(book?.side)) errors.push("対象手番が不正です。");
  if (!String(book?.classification?.family ?? "").trim()) errors.push("分類IDを入力してください。");
  if (!String(book?.classification?.name ?? "").trim()) errors.push("分類名を入力してください。");
  if (!["static", "ranging", "both"].includes(book?.classification?.rookStyle)) errors.push("居飛車／振り飛車分類を選択してください。");
  if (book?.kind === "castle") {
    if (!String(book?.classification?.menuGroup ?? "").trim()) errors.push("囲い一覧の分類IDを入力してください。");
    if (!Array.isArray(book?.classification?.contexts) || !book.classification.contexts.length) errors.push("囲いが対応する対局分類を1つ以上選択してください。");
  }
  if (book?.completionChoices?.enabled) {
    if (book.kind !== "strategy") errors.push("完成後の派生選択は戦法だけに設定できます。");
    if (!String(book.completionChoices.prompt ?? "").trim()) errors.push("完成後の選択案内文を入力してください。");
    const choiceIds = book.completionChoices.strategyIds ?? [];
    if (!Array.isArray(choiceIds) || !choiceIds.length) errors.push("完成後に選ばせる派生戦法を1つ以上追加してください。");
    if (new Set(choiceIds).size !== choiceIds.length) errors.push("完成後の派生戦法が重複しています。");
  }
  for (const [move, conditions] of Object.entries(book?.movePositionPrerequisites ?? {})) {
    if (!(book?.guideMoves ?? []).includes(move)) errors.push(`条件対象の案内手「${move}」が案内手一覧にありません。`);
    if (!Array.isArray(conditions) || !conditions.length) {
      errors.push(`案内手「${move}」の局面条件が空です。`);
      continue;
    }
    for (const [groupIndex, group] of conditions.entries()) {
      const alternatives = Array.isArray(group?.alternatives) ? group.alternatives : [group];
      if (!alternatives.length) {
        errors.push(`案内手「${move}」の条件${groupIndex + 1}: OR候補が空です。`);
        continue;
      }
      for (const [alternativeIndex, condition] of alternatives.entries()) {
        const suffix = alternatives.length > 1 ? `のOR候補${alternativeIndex + 1}` : "";
        const prefix = `案内手「${move}」の条件${groupIndex + 1}${suffix}`;
        if (!/^[1-9][a-i]$/.test(condition?.square ?? "")) errors.push(`${prefix}: マスが不正です。`);
        if (!["player", "opponent"].includes(condition?.owner)) errors.push(`${prefix}: 駒の所有者が不正です。`);
        if (!["P", "L", "N", "S", "G", "B", "R", "K"].includes(condition?.kind)) errors.push(`${prefix}: 駒種が不正です。`);
      }
    }
  }
  if (book?.kind === "castle") {
    if (!Array.isArray(book?.completionVariants) || !book.completionVariants.length) {
      errors.push("囲いの完成形を1つ以上登録してください。");
    }
    for (const [variantIndex, variant] of (book?.completionVariants ?? []).entries()) {
      if (!Array.isArray(variant) || !variant.length) {
        errors.push(`完成形${variantIndex + 1}: 必要な駒を1つ以上登録してください。`);
        continue;
      }
      const seenSquares = new Set();
      for (const [pieceIndex, piece] of variant.entries()) {
        const [square, kind] = Array.isArray(piece) ? piece : [];
        const prefix = `完成形${variantIndex + 1}の駒${pieceIndex + 1}`;
        if (!/^[1-9][a-i]$/.test(square ?? "")) errors.push(`${prefix}: マスが不正です。`);
        if (!["P", "L", "N", "S", "G", "B", "R", "K"].includes(kind)) errors.push(`${prefix}: 駒種が不正です。`);
        if (seenSquares.has(square)) errors.push(`完成形${variantIndex + 1}: 同じマス「${square}」が重複しています。`);
        seenSquares.add(square);
      }
    }
  }

  const branchIds = new Set();
  const exactLines = new Set();
  for (const [branchIndex, branch] of (book?.branches ?? []).entries()) {
    const prefix = `変化${branchIndex + 1}`;
    if (!branch?.id || branchIds.has(branch.id)) errors.push(`${prefix}: 分岐IDが空か重複しています。`);
    branchIds.add(branch?.id);
    if (!branch?.moves?.length) continue;
    const replay = replayOpeningBranch(book, branch);
    if (replay.error) errors.push(`${prefix}: ${replay.error}`);
    const line = (branch?.moves ?? []).map(({ usi }) => usi).join(" ");
    if (line && exactLines.has(line)) errors.push(`${prefix}: 同一手順の分岐が重複しています。`);
    exactLines.add(line);
  }
  if (!(book?.branches?.length > 0)) errors.push("分岐を1つ以上作成してください。");

  const validSources = (book?.sources ?? []).filter((source) => source?.title || source?.url);
  if (!validSources.length) errors.push("Wikipedia等で確認した出典を1件以上登録してください。");
  for (const [index, source] of validSources.entries()) {
    if (!String(source.title ?? "").trim()) errors.push(`出典${index + 1}: ページ名が必要です。`);
    try {
      const url = new URL(source.url);
      if (url.protocol !== "https:") throw new Error();
    } catch {
      errors.push(`出典${index + 1}: HTTPSのURLを入力してください。`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(source.checkedAt ?? "")) errors.push(`出典${index + 1}: 確認日はYYYY-MM-DDで入力してください。`);
  }
  if (!book?.engineReview?.checked) warnings.push("エンジン安全確認が未実施です。実装へ反映する前に評価値も確認してください。");
  return { valid: errors.length === 0, errors, warnings };
}

export function serializeOpeningBook(book) {
  return `${JSON.stringify({ ...book, schemaVersion: OPENING_BOOK_SCHEMA_VERSION, updatedAt: new Date().toISOString() }, null, 2)}\n`;
}

export function parseOpeningBook(text) {
  const value = JSON.parse(text);
  if (!value || Array.isArray(value) || typeof value !== "object") throw new Error("JSONの最上位はオブジェクトにしてください。");
  return value;
}
