import type { MatchResult } from "./game-state";

export const MATCH_RESULT_TYPE = "shogi-match:result";
export const MATCH_PROTOCOL_VERSION = 1;

const MATCH_ID_PATTERN = /^[A-Za-z0-9._:-]{1,64}$/;
const MODES = new Set(["cpu", "local"]);
const COLORS = new Set(["black", "white"]);

export type ShogiMatchFrameOptions = {
  matchId: string;
  gameUrl?: string;
  mode?: "cpu" | "local";
  playerColor?: "black" | "white";
  initialSfen?: string;
  blackName?: string;
  whiteName?: string;
  cpuName?: string;
  engineNodes?: number;
};

export type ShogiMatchResultMessage = {
  type: typeof MATCH_RESULT_TYPE;
  version: typeof MATCH_PROTOCOL_VERSION;
  matchId: string;
  result: MatchResult;
};

export function normalizeFrameOptions(options: ShogiMatchFrameOptions): Required<
  Pick<ShogiMatchFrameOptions, "matchId" | "gameUrl" | "mode" | "playerColor">
> & Omit<ShogiMatchFrameOptions, "matchId" | "gameUrl" | "mode" | "playerColor"> {
  if (!options || typeof options !== "object") {
    throw new Error("対局設定が必要です。");
  }
  if (!MATCH_ID_PATTERN.test(options.matchId)) {
    throw new Error(`matchIdが不正です: ${String(options.matchId)}`);
  }
  const mode = options.mode ?? "cpu";
  const playerColor = options.playerColor ?? "black";
  if (!MODES.has(mode)) throw new Error(`modeが不正です: ${mode}`);
  if (!COLORS.has(playerColor)) throw new Error(`playerColorが不正です: ${playerColor}`);
  return {
    ...options,
    matchId: options.matchId,
    gameUrl: options.gameUrl ?? "./game.html",
    mode,
    playerColor,
  };
}

export function buildGameUrl(
  options: ShogiMatchFrameOptions,
  baseUrl = window.location.href,
): URL {
  const value = normalizeFrameOptions(options);
  const url = new URL(value.gameUrl, baseUrl);
  url.searchParams.set("match_id", value.matchId);
  url.searchParams.set("mode", value.mode);
  url.searchParams.set("player_color", value.playerColor);
  for (const [key, parameter] of [
    ["initial_sfen", value.initialSfen],
    ["black_name", value.blackName],
    ["white_name", value.whiteName],
    ["cpu_name", value.cpuName],
  ]) {
    if (parameter) url.searchParams.set(key, parameter);
  }
  if (Number.isFinite(value.engineNodes) && value.engineNodes! > 0) {
    url.searchParams.set("engine_nodes", String(Math.trunc(value.engineNodes!)));
  }
  return url;
}

export function parseMatchResultMessage(
  value: unknown,
  expectedMatchId: string,
): ShogiMatchResultMessage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const message = value as Partial<ShogiMatchResultMessage>;
  if (
    message.type !== MATCH_RESULT_TYPE ||
    message.version !== MATCH_PROTOCOL_VERSION ||
    message.matchId !== expectedMatchId ||
    !message.result ||
    typeof message.result !== "object"
  ) return null;
  const result = message.result;
  if (
    !["black-win", "white-win", "draw"].includes(result.outcome) ||
    !["black", "white", null].includes(result.winner) ||
    !["checkmate", "resignation", "repetition", "perpetual-check"].includes(result.reason) ||
    !Number.isInteger(result.moveCount) ||
    result.moveCount < 0 ||
    !Array.isArray(result.moves) ||
    typeof result.finalSfen !== "string"
  ) {
    throw new Error("対局結果メッセージが不正です。");
  }
  return message as ShogiMatchResultMessage;
}

export function openShogiMatch(
  options: ShogiMatchFrameOptions,
  environment: { windowObject?: Window; documentObject?: Document; container?: HTMLElement } = {},
): Promise<ShogiMatchResultMessage> {
  const windowObject = environment.windowObject ?? window;
  const documentObject = environment.documentObject ?? document;
  const normalized = normalizeFrameOptions(options);
  const frameUrl = buildGameUrl(normalized, windowObject.location.href);
  const overlay = documentObject.createElement("div");
  overlay.setAttribute("data-shogi-match-overlay", "");
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483647",
    background: "#2d2419",
  });
  const frame = documentObject.createElement("iframe");
  frame.title = "将棋対局";
  frame.src = frameUrl.href;
  Object.assign(frame.style, { width: "100%", height: "100%", border: "0", display: "block" });
  overlay.append(frame);

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      windowObject.removeEventListener("message", onMessage);
      overlay.remove();
    };
    const onMessage = (event: MessageEvent) => {
      if (
        event.origin !== windowObject.location.origin ||
        event.source !== frame.contentWindow
      ) return;
      try {
        const message = parseMatchResultMessage(event.data, normalized.matchId);
        if (!message) return;
        cleanup();
        resolve(message);
      } catch (error) {
        cleanup();
        reject(error);
      }
    };
    windowObject.addEventListener("message", onMessage);
    (environment.container ?? documentObject.body).append(overlay);
  });
}

export function registerTyranoShogiMatch(
  tyranoObject: any = (window as any).tyrano,
  defaults: Partial<ShogiMatchFrameOptions> = {},
) {
  const tags = tyranoObject?.plugin?.kag?.tag;
  if (!tags) throw new Error("ティラノスクリプトの初期化後にタグを登録してください。");
  tags.shogi_match = {
    vital: ["match_id"],
    pm: {
      match_id: "",
      src: defaults.gameUrl ?? "./game.html",
      mode: defaults.mode ?? "cpu",
      player_color: defaults.playerColor ?? "black",
      initial_sfen: defaults.initialSfen ?? "",
      black_name: defaults.blackName ?? "",
      white_name: defaults.whiteName ?? "",
      cpu_name: defaults.cpuName ?? "",
      engine_nodes: defaults.engineNodes ? String(defaults.engineNodes) : "",
    },
    start(pm: Record<string, string>) {
      const kag = this.kag;
      openShogiMatch({
        matchId: pm.match_id,
        gameUrl: pm.src,
        mode: pm.mode === "local" ? "local" : "cpu",
        playerColor: pm.player_color === "white" ? "white" : "black",
        initialSfen: pm.initial_sfen || undefined,
        blackName: pm.black_name || undefined,
        whiteName: pm.white_name || undefined,
        cpuName: pm.cpu_name || undefined,
        engineNodes: Number(pm.engine_nodes) > 0 ? Number(pm.engine_nodes) : undefined,
      }).then((message) => {
        kag.stat.f.match_result = message.result;
        kag.ftag.nextOrder();
      }).catch((error) => {
        kag.stat.f.match_result = {
          error: error instanceof Error ? error.message : String(error),
        };
        kag.ftag.nextOrder();
      });
    },
  };
  return tags.shogi_match;
}
