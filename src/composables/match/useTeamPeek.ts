import { reactive } from "vue";
import type { RelayGame, RelayMoveEntry } from "../../core/relay-game.mjs";
import type { EngineFactory } from "./analysisEngines";
import { useRelayGenerator } from "./useRelayGenerator";

type PeekGame = { entries: RelayMoveEntry[]; end: RelayGame["end"] | null; failed: boolean };

/*
 * 団体戦の仲間の局の棋譜を作る(docs/team-battle-design.mdの14章の3)。中継と同じ軽いエンジン(useRelayGenerator)で、
 * 決めてある勝ち負けに沿って1局ずつ作る。作り始めるのは「仲間の盤」をはじめて押したときだけ(押さなければエンジンを動かさない)。
 * 中継の決まり「自分の対局中は棋譜を作らない」の例外: プレイヤーが自分で見に行ったときだけ、読む量は少ない側(compact)に固定。
 * 自分の対局が終わったら止める(stop)。
 */
export function useTeamPeek({ engineFactory, storage }: { engineFactory: () => Promise<EngineFactory>; storage: () => Storage | null }) {
  const games = reactive<Record<string, PeekGame>>({});
  let generator: ReturnType<typeof useRelayGenerator> | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const specs = new Map<string, any>();
  let order: string[] = [];
  let busy = "";

  /**
   * 仲間の局を作り始める(firstを先に。作り終わった局は作らない)。
   * @param boardSpecs 中継の局の設定(team-peek.mjsの`peekBoards`のspec)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function start(boardSpecs: any[], first = "") {
    for (const spec of boardSpecs) {
      specs.set(spec.key, spec);
      games[spec.key] ??= { entries: [], end: null, failed: false };
    }
    const keys = boardSpecs.map((spec) => spec.key);
    order = first && keys.includes(first) ? [first, ...keys.filter((key) => key !== first)] : keys;
    void pump();
  }

  async function pump() {
    if (busy) return;
    const key = order.find((entry) => !games[entry]?.end && !games[entry]?.failed);
    if (!key) return;
    busy = key;
    generator ??= useRelayGenerator({ engineFactory, compact: () => true, storage });
    const game = games[key];
    game.entries = [];
    try {
      const done = await generator.play(specs.get(key), (entry, index) => {
        if (busy !== key) return;
        game.entries[index] = entry;
      });
      if (done && busy === key) game.end = done.end;
    } catch {
      game.failed = true;
    }
    if (busy !== key) return;
    busy = "";
    void pump();
  }

  /** 止める(自分の対局が終わったとき・別の対局を始めたとき)。作った局は、次に開いたときに中継の保存から読む。 */
  function stop() {
    busy = "";
    order = [];
    generator?.dispose();
    generator = null;
    for (const key of Object.keys(games)) if (!games[key].end) delete games[key];
  }

  return { games, start, stop };
}
