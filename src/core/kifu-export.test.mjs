import { describe, expect, it } from "vitest";
import { InitialPositionSFEN, Position, Record, RecordMetadataKey, exportKIF, importKIF } from "tsshogi";
import { currentKifuFile } from "./kifu-export.mjs";

function play(record, ...moves) {
  for (const usi of moves) {
    const move = record.position.createMoveByUSI(usi);
    expect(move).toBeTruthy();
    expect(record.append(move)).toBe(true);
  }
  return record;
}
function read(text) {
  const result = importKIF(text);
  expect(result).not.toBeInstanceOf(Error);
  result.goto(result.length);
  return result;
}

describe("表示中の局面までのKIFファイル", () => {
  it("途中で戻った局面までに切り詰め、元の手順と表示局面は変えない", () => {
    const source = play(new Record(), "7g7f", "3c3d", "2g2f", "8c8d");
    source.goto(2);
    const before = exportKIF(source);
    const cursor = source.current;
    const file = currentKifuFile(source, { blackName: "山田 太郎", whiteName: "羽音", at: 0 });
    const loaded = read(file.text);
    expect(loaded.length).toBe(2);
    expect(loaded.position.sfen).toBe(source.position.sfen);
    expect(loaded.metadata.getStandardMetadata(RecordMetadataKey.BLACK_NAME)).toBe("山田 太郎");
    expect(loaded.metadata.getStandardMetadata(RecordMetadataKey.WHITE_NAME)).toBe("羽音");
    expect(file.name).toMatch(/^shogi-match-\d{8}-\d{6}-2\.kifu$/);
    expect(file.text).not.toMatch(/投了|変化：/);
    expect(source.current).toBe(cursor);
    expect(exportKIF(source)).toBe(before);
  });
  it("選んでいる分岐だけを残し、別の分岐を混ぜない", () => {
    const source = play(new Record(), "7g7f", "3c3d", "2g2f");
    source.goto(1);
    play(source, "8c8d");
    const loaded = read(currentKifuFile(source).text);
    expect(loaded.position.sfen).toBe(source.position.sfen);
    expect(loaded.movesBefore.slice(1).map(node => node.move.usi)).toEqual(["7g7f", "8c8d"]);
    expect(loaded.length).toBe(2);
  });
  it.each([
    InitialPositionSFEN.HANDICAP_BISHOP,
    "4k4/9/9/9/9/9/9/9/4K4 b R2P 1",
  ])("駒落ち・任意局面の開始局面と手番・持ち駒を保つ: %s", sfen => {
    const initial = new Position();
    expect(initial.resetBySFEN(sfen)).toBe(true);
    const source = new Record(initial);
    play(source, sfen.includes(" w ") ? "3c3d" : "R*5e");
    const loaded = read(currentKifuFile(source).text);
    expect(loaded.initialPosition.sfen).toBe(source.initialPosition.sfen);
    expect(loaded.position.sfen).toBe(source.position.sfen);
  });
  it("消費時間とコメントを残す", () => {
    const source = play(new Record(), "7g7f");
    source.first.comment = "開始局面";
    source.current.setElapsedMs(12000);
    source.current.comment = "この局面を検討する";
    const loaded = read(currentKifuFile(source).text);
    expect(loaded.first.comment.trim()).toBe("開始局面");
    expect(loaded.current.comment.trim()).toBe("この局面を検討する");
    expect(loaded.current.elapsedMs).toBe(12000);
  });
  it("0手の開始局面も保存でき、名前の改行を棋譜に挿入させない", () => {
    const file = currentKifuFile(new Record(), { blackName: "名前\n後手：別人", whiteName: "後手" });
    const loaded = read(file.text);
    expect(file.ply).toBe(0);
    expect(loaded.length).toBe(0);
    expect(loaded.metadata.getStandardMetadata(RecordMetadataKey.WHITE_NAME)).toBe("後手");
    expect(file.text).toContain("encoding=UTF-8");
  });
});
