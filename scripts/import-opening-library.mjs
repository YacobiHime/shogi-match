import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inputPath = path.resolve(projectRoot, process.argv[2] ?? "opening-library-export.json");
const outputPath = path.resolve(projectRoot, "src/data/opening-guide-overrides.mjs");
const library = JSON.parse(fs.readFileSync(inputPath, "utf8"));

const castleFixups = {
  "migigyoku-habu": {
    classification: { name: "相居飛車／バランス型・その他", contexts: ["aibisha"] },
    completionVariants: [[
      ["4h", "K"], ["7h", "G"], ["7g", "S"], ["3h", "G"],
      ["4g", "S"], ["3g", "N"], ["2i", "R"],
    ]],
  },
  muteki: {
    classification: {
      name: "複数戦型／その他",
      contexts: ["anti-static-ranging", "double-ranging"],
    },
    completionVariants: [[
      ["5i", "K"], ["5h", "R"], ["4h", "S"], ["6h", "S"],
    ]],
  },
};

const choicePrompts = {
  kakugawari: "角換わりができたよ。次に目指す攻め方を選んでね",
  aigakari: "相掛かりの形ができたよ。次に目指す戦法を選んでね",
};

const overrides = {};
for (const [key, saved] of Object.entries(library.books ?? {})) {
  const fixup = saved.kind === "castle" ? castleFixups[saved.id] : undefined;
  const rawGuideMoves = [...(saved.guideMoves ?? [])];
  const routineIndex = rawGuideMoves.indexOf("@kakugawari");
  // The routine itself already handles 7七角 and 8八銀. Old editor previews could
  // leave these immediately after the routine token, which would otherwise try to
  // move the silver on 8八 as though it were still the bishop.
  const guideMoves = rawGuideMoves.filter((move, index) => (
    routineIndex < 0 || index <= routineIndex || !["8h7g", "7i8h"].includes(move)
  ));
  const movePositionPrerequisites = Object.fromEntries(
    Object.entries(saved.movePositionPrerequisites ?? {}).filter(([move]) => guideMoves.includes(move)),
  );
  const moveConditionBranches = Object.fromEntries(
    Object.entries(saved.moveConditionBranches ?? {}).filter(([move]) => guideMoves.includes(move)),
  );
  const completionChoices = {
    ...(saved.completionChoices ?? {}),
    prompt: saved.completionChoices?.enabled
      ? saved.completionChoices.prompt || choicePrompts[saved.id] || `${saved.label}の次の戦法を選んでね`
      : saved.completionChoices?.prompt ?? "",
  };
  overrides[key] = {
    id: saved.id,
    kind: saved.kind,
    label: saved.label,
    side: saved.side,
    classification: { ...(saved.classification ?? {}), ...(fixup?.classification ?? {}) },
    guideMoves,
    completionVariants: fixup?.completionVariants ?? saved.completionVariants ?? [],
    movePositionPrerequisites,
    moveConditionBranches,
    completionChoices,
    updatedAt: saved.updatedAt,
  };
}

const output = `// 定跡エディターで保存した下書きから生成。\n// npm run import:opening-library で再生成する。\nexport const OPENING_GUIDE_OVERRIDES = Object.freeze(${JSON.stringify(overrides, null, 2)});\n`;
fs.writeFileSync(outputPath, output, "utf8");
console.log(`${Object.keys(overrides).length}件を ${path.relative(projectRoot, outputPath)} へ反映しました。`);
