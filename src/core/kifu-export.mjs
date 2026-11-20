/** 現在表示中の局面までの経路だけをKIFに複製する（docs/kifu-export-design.md）。 */
import { Record, RecordMetadataKey, exportKIF } from "tsshogi";

export const KIFU_EXPORT_TEXT = Object.freeze({
  button: "棋譜を書き出す",
  exported: (ply) => `${ply}手目までの棋譜ファイルを書き出したよ。`,
  failed: "棋譜を書き出せなかったよ。もう一度ためしてね。",
});

/**
 * 元の棋譜のカーソルや分岐を変えず、表示している経路を別の棋譜にする。
 * @param {import("tsshogi").ImmutableRecord} source
 * @param {{ blackName?: string, whiteName?: string, at?: number }} options
 */
export function currentKifuFile(source, { blackName = "先手", whiteName = "後手", at = Date.now() } = {}) {
  const copy = new Record(source.initialPosition.clone());
  const cleanName = (value) => String(value).replace(/[\r\n\u0000-\u001f\u007f]/g, " ");
  copy.metadata.setStandardMetadata(RecordMetadataKey.BLACK_NAME, cleanName(blackName));
  copy.metadata.setStandardMetadata(RecordMetadataKey.WHITE_NAME, cleanName(whiteName));
  for (const node of source.movesBefore) {
    if (node.ply && !copy.append(node.move)) throw new Error("棋譜を複製できません");
    copy.current.setElapsedMs(node.elapsedMs);
    copy.current.comment = node.comment;
  }
  const date = new Date(at);
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return {
    text: exportKIF(copy, { comment: "KIF version=2.0 encoding=UTF-8" }),
    name: `shogi-match-${stamp}-${source.current.ply}.kifu`,
    ply: source.current.ply,
  };
}
