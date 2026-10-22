import { Position } from "tsshogi";
import { moveImpact } from "./move-impact.mjs";

/** 着手の駒音。強い音は王手・大駒を取る手・詰み。 */
export type MoveSoundKind = "normal" | "strong" | "capture" | "drop" | "promote";
/** 着手以外も含めた効果音。 */
/**
 * furigomaは、歩を振る音から駒台に撒く音まで(2.5秒。撒く音はFURIGOMA_LAND_ATの位置)。
 * furigoma-landは、撒く音だけ(0.6秒。演出を飛ばしたときに鳴らす)。
 */
/**
 * climbは、竜王への道で1段登る音(ド・ミ・ソ・ドを上へ。0.4秒)。
 * stampは、竜王戦の節目(突破・組優勝・昇級・挑戦権・竜王)の判子の音(低い「トン」。0.3秒)。
 */
export type SoundKind = MoveSoundKind | "god" | "win" | "lose" | "furigoma" | "furigoma-land" | "climb" | "stamp";

/** furigoma.mp3の中で、駒を撒く音が鳴る位置(ミリ秒)。振り駒の結果は、この瞬間に見せる。 */
export const FURIGOMA_LAND_AT = 1930;

/** 効果音のファイル名(public/audio/)。 */
export const SOUND_FILES: Readonly<Record<SoundKind, string>> = Object.freeze({
  normal: "komaoto_normal.mp3",
  strong: "komaoto_strong.mp3",
  capture: "komaoto_capture.mp3",
  drop: "komaoto_drop.mp3",
  promote: "promote.mp3",
  god: "god_move.mp3",
  win: "win.mp3",
  lose: "lose.mp3",
  furigoma: "furigoma.mp3",
  "furigoma-land": "furigoma_land.mp3",
  climb: "road_climb.mp3",
  stamp: "road_stamp.mp3",
});

/**
 * public/audio/に置いてある音。素材が届いたら、ここに足すと鳴るようになる。
 * ない音は、SOUND_FALLBACKの代わりの音を鳴らすか、鳴らさない(存在しないファイルを読みに行かない)。
 */
export const AVAILABLE_SOUNDS: ReadonlySet<SoundKind> = new Set<SoundKind>(["normal", "strong", "furigoma", "furigoma-land", "climb", "stamp"]);

/** 素材がないときの代わりの音。ここにない音は、素材がなければ鳴らさない。 */
const SOUND_FALLBACK: Partial<Record<SoundKind, SoundKind>> = {
  capture: "normal",
  drop: "normal",
  promote: "normal",
  god: "strong",
};

/** 音量。重要度の高い出来事ほど大きくする(Game_Nintendo_Implementation.mdの3-3)。 */
export const SOUND_VOLUME: Readonly<Record<SoundKind, number>> = Object.freeze({
  normal: 0.8,
  drop: 0.75,
  capture: 0.85,
  promote: 0.85,
  strong: 1,
  god: 1,
  win: 0.9,
  lose: 0.7,
  furigoma: 0.8,
  "furigoma-land": 0.8,
  climb: 0.6,
  stamp: 0.9,
});

/** 実際に鳴らす音。素材がなければ代わりの音、代わりもなければnull。 */
export function resolveSound(kind: SoundKind, available: ReadonlySet<SoundKind> = AVAILABLE_SOUNDS): SoundKind | null {
  if (available.has(kind)) return kind;
  const fallback = SOUND_FALLBACK[kind];
  return fallback && available.has(fallback) ? fallback : null;
}

/**
 * 着手の駒音。強い音(王手・大駒を取る手) → 成る → 取る → 打つ → 普通、の順に選ぶ(core/move-impact.mjs)。
 */
export function selectMoveSound(
  capturedPieceType: string | null,
  givesCheck: boolean,
  { promote = false, drop = false }: { promote?: boolean; drop?: boolean } = {},
): MoveSoundKind {
  return moveImpact({ capturedPieceType, check: givesCheck, promote, drop }).sound;
}

/** 局面でusiの手を指したときの駒音。指せない手はnull。 */
export function moveSoundForUsi(sfen: string, usi: string): MoveSoundKind | null {
  const position = Position.newBySFEN(sfen);
  const move = position?.createMoveByUSI(usi);
  if (!position || !move || !position.doMove(move)) return null;
  return selectMoveSound(move.capturedPieceType ?? null, position.checked, {
    promote: move.promote,
    drop: usi.includes("*"),
  });
}

/** 効果音のオン/オフの保存先。 */
export const SOUND_ENABLED_KEY = "yacobihime:shogi-match:sound";

/** 効果音がオンか。保存がない・読めないときはオン。 */
export function loadSoundEnabled(storage: Pick<Storage, "getItem"> | null | undefined): boolean {
  try {
    return storage?.getItem(SOUND_ENABLED_KEY) !== "off";
  } catch {
    return true;
  }
}

export function saveSoundEnabled(storage: Pick<Storage, "setItem"> | null | undefined, enabled: boolean) {
  try {
    storage?.setItem(SOUND_ENABLED_KEY, enabled ? "on" : "off");
  } catch {
    // 保存できない環境では、この画面の間だけ使う。
  }
}

function defaultSoundEnabled() {
  try {
    return loadSoundEnabled(typeof localStorage === "undefined" ? null : localStorage);
  } catch {
    return true;
  }
}

export type MoveSoundPlayer = {
  /** 音声を先に読み込んでおく。 */
  preload: () => void;
  /** 鳴らした音声を返す(途中で止めるため)。鳴らさなかったときはnull。 */
  play: (kind: SoundKind) => HTMLAudioElement | null;
};

/**
 * 効果音の再生。連続して指しても重ねて鳴らせるよう、読み込んだ音声を複製して再生する。
 * enabledが偽を返す間は鳴らさない。既定では、対局画面のメニューで選んだオン/オフ(SOUND_ENABLED_KEY)に従う。
 */
export function createMoveSoundPlayer(
  assetBaseUrl: () => string,
  { enabled = defaultSoundEnabled }: { enabled?: () => boolean } = {},
): MoveSoundPlayer {
  let templates: Partial<Record<SoundKind, HTMLAudioElement>> | null = null;
  const url = (fileName: string) => `${assetBaseUrl().replace(/\/$/, "")}/audio/${fileName}`;
  const preload = () => {
    if (templates || typeof Audio === "undefined") return;
    templates = {};
    for (const kind of AVAILABLE_SOUNDS) {
      const audio = new Audio(url(SOUND_FILES[kind]));
      audio.preload = "auto";
      audio.load();
      templates[kind] = audio;
    }
  };
  const play = (kind: SoundKind) => {
    if (!enabled()) return null;
    const resolved = resolveSound(kind);
    if (!resolved) return null;
    preload();
    const template = templates?.[resolved];
    if (!template) return null;
    const audio = template.cloneNode(true) as HTMLAudioElement;
    audio.volume = SOUND_VOLUME[kind];
    void audio.play().catch(() => undefined);
    return audio;
  };
  return { preload, play };
}
