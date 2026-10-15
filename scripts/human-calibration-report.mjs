// 人間の戦績から、CPUのレベルの表示名(段級位)のずれを調べる開発用スクリプト。
// 入力は、やこびノートの「戦績データをコピー」で取り出したJSON。1ファイルに1人分か、その配列を入れる。
// 使い方:
//   node scripts/human-calibration-report.mjs [--min-games 20] a.json b.json ...
// 申告した段級位ごとに、勝率50%になるLvと、表示名のLvとの差をMarkdownの表で出す。
import fs from "node:fs";
import { calibrationReport, formatCalibrationReport } from "../src/core/human-calibration.mjs";

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}
const minGames = Number(option("min-games", "20"));
const files = process.argv.slice(2).filter((arg, index, args) => !arg.startsWith("--") && !args[index - 1]?.startsWith("--"));
if (!files.length) throw new Error("戦績データのJSONファイルを指定してください");

const exports = files.flatMap((file) => {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  return Array.isArray(data) ? data : [data];
});

console.log(`${exports.length}人分の戦績(対局数が${minGames}局未満の申告は判断しない)`);
console.log("");
console.log(formatCalibrationReport(calibrationReport(exports, { minGames })));
