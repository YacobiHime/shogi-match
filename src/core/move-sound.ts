import { PieceType, Position } from "tsshogi";

export type MoveSoundKind = "normal" | "strong";

const MAJOR_PIECE_TYPES = new Set<PieceType>([
  PieceType.ROOK,
  PieceType.BISHOP,
  PieceType.DRAGON,
  PieceType.HORSE,
]);

export function selectMoveSound(
  capturedPieceType: PieceType | null,
  givesCheck: boolean,
): MoveSoundKind {
  return givesCheck || (capturedPieceType !== null && MAJOR_PIECE_TYPES.has(capturedPieceType))
    ? "strong"
    : "normal";
}

/** 局面でusiの手を指したときの駒音。大駒を取る手と王手は強い音にする。指せない手はnull。 */
export function moveSoundForUsi(sfen: string, usi: string): MoveSoundKind | null {
  const position = Position.newBySFEN(sfen);
  const move = position?.createMoveByUSI(usi);
  if (!position || !move || !position.doMove(move)) return null;
  return selectMoveSound(move.capturedPieceType ?? null, position.checked);
}

export type MoveSoundPlayer = {
  /** 音声を先に読み込んでおく。 */
  preload: () => void;
  play: (kind: MoveSoundKind) => void;
};

/** 駒音の再生。連続して指しても重ねて鳴らせるよう、読み込んだ音声を複製して再生する。 */
export function createMoveSoundPlayer(assetBaseUrl: () => string): MoveSoundPlayer {
  let templates: Record<MoveSoundKind, HTMLAudioElement> | null = null;
  const url = (fileName: string) => `${assetBaseUrl().replace(/\/$/, "")}/audio/${fileName}`;
  const preload = () => {
    if (templates || typeof Audio === "undefined") return;
    templates = {
      normal: new Audio(url("komaoto_normal.mp3")),
      strong: new Audio(url("komaoto_strong.mp3")),
    };
    for (const audio of Object.values(templates)) {
      audio.preload = "auto";
      audio.load();
    }
  };
  const play = (kind: MoveSoundKind) => {
    preload();
    const template = templates?.[kind];
    if (!template) return;
    const audio = template.cloneNode(true) as HTMLAudioElement;
    void audio.play().catch(() => undefined);
  };
  return { preload, play };
}
