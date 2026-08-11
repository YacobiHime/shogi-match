/**
 * src/engine/engine.js
 *
 * YaneuraOu.wasm(USIプロトコル)のメインスレッド直接呼び出しラッパー。
 *
 * 実装パターンは tools/m0-verification/index-mainthread.html の initEngine() を
 * そのまま移植したもの。以下の制約は docs/CLAUDE.md「WASM将棋エンジン統合時の必須知識」
 * に従っているので、変更する場合は必ずそちらを読むこと。
 *
 * - Web Workerを一切使わず、メインスレッドから直接エンジンのファクトリ関数を呼び出す
 *   （入れ子Worker構成はcreateObjectURLエラーで動作しないためNG）
 * - 評価関数(nn.bin)はpreRunフックでモジュール初期化前に仮想FSへ書き込む
 * - 開発用HTTPサーバーはContent-Lengthヘッダーを明示的に返す必要がある
 *   （tools/m0-verification-suisho5/server.js に実装例あり）
 */

const USI_MOVE_PATTERN = /^(?:[1-9][a-i][1-9][a-i]\+?|[PLNSGBR]\*[1-9][a-i])$/;
const DEFAULT_STARTUP_TIMEOUT_MS = 30_000;

function writeVirtualFile(mod, virtualPath, bytes) {
  const lastSlash = virtualPath.lastIndexOf('/');
  const directory = lastSlash > 0 ? virtualPath.slice(0, lastSlash) : '/';
  const fileName = virtualPath.slice(lastSlash + 1);
  if (!fileName || !virtualPath.startsWith('/') || virtualPath.includes('..')) {
    throw new Error(`仮想FSパスが不正です: ${virtualPath}`);
  }

  if (mod.FS?.writeFile) {
    if (directory !== '/') mod.FS.mkdirTree(directory);
    mod.FS.writeFile(virtualPath, bytes);
    return;
  }
  if (typeof mod.FS_createDataFile === 'function') {
    if (directory !== '/') {
      if (typeof mod.FS_createPath !== 'function') {
        throw new Error('仮想FSのディレクトリ作成APIがありません');
      }
      mod.FS_createPath('/', directory.slice(1), true, true);
    }
    mod.FS_createDataFile(directory, fileName, bytes, true, true, true);
    return;
  }
  throw new Error('仮想FSへファイルを書き込むAPIがありません');
}

/**
 * @typedef {Object} EngineOptions
 * @property {() => Promise<any>} factory
 *   エンジンのグローバルファクトリ関数（例: window.YaneuraOu）。
 *   npmパッケージ同梱のyaneuraou.jsを読み込むとグローバルに生える。
 * @property {() => Promise<any>} [fallbackFactory]
 *   NNUE取得または主エンジン初期化に失敗した場合に使う内蔵評価版ファクトリ。
 * @property {string} [nnuePath]
 *   評価関数ファイル(nn.bin等)のURL。本番エンジン(水匠5/hao)では必須。
 *   軽量版(arashigaoka)のように評価関数がwasm.data内に同梱されている場合は不要。
 * @property {string} [nnueVirtualPath] 仮想FS上の書き込み先パス（省略時 '/nn.bin'）
 * @property {string} [bookPath] やねうら王形式の定跡DBのURL（省略時は読み込まない）
 * @property {string} [bookVirtualPath]
 *   仮想FS上の定跡DB書き込み先（省略時 '/user_book1.db'）
 * @property {typeof fetch} [fetchImpl] 評価関数の取得処理（テスト差し替え用）
 * @property {(details: { path: string, error: Error, stage: string }) => void} [onNnueFallback]
 *   評価関数を取得できず、内蔵評価関数へフォールバックした際の通知先。
 * @property {(details: { path: string, error: Error, stage: string }) => void} [onBookFallback]
 *   定跡DBを取得できず、定跡なしで続行する際の通知先。
 * @property {number} [startupTimeoutMs]
 *   WASM起動とUSI初期応答を待つ上限時間。
 */

export class ShogiEngine {
  /** @param {EngineOptions} options */
  constructor(options) {
    this.factory = options.factory;
    this.fallbackFactory = options.fallbackFactory || null;
    this.nnuePath = options.nnuePath || null;
    this.nnueVirtualPath = options.nnueVirtualPath || '/nn.bin';
    this.bookPath = options.bookPath || null;
    this.bookVirtualPath = options.bookVirtualPath || '/user_book1.db';
    this.fetchImpl = options.fetchImpl || fetch;
    this.onNnueFallback = options.onNnueFallback || null;
    this.onBookFallback = options.onBookFallback || null;
    this.startupTimeoutMs = options.startupTimeoutMs ?? DEFAULT_STARTUP_TIMEOUT_MS;
    if (!Number.isInteger(this.startupTimeoutMs) || this.startupTimeoutMs < 1) {
      throw new Error('startupTimeoutMsは1以上の整数にしてください');
    }
    this.activeNnuePath = null;
    this.activeBookPath = null;
    this.instance = null;
    this._usiOptions = new Set();
    /** @type {((line: string) => void)[]} */
    this._listeners = [];
  }

  /**
   * 出力行のリスナーを登録する。"usiok" "readyok" "bestmove ..." 等の
   * USI出力テキストが1行ずつそのまま渡される。
   * @param {(line: string) => void} listener
   */
  onOutput(listener) {
    this._listeners.push(listener);
  }

  _emit(line) {
    for (const listener of this._listeners) listener(line);
  }

  /**
   * エンジンを初期化し、'usiok' を受け取るまで待つ。
   * @returns {Promise<void>}
   */
  async init() {
    if (this.instance) throw new Error('既に初期化済みです');

    /** @type {{ preRun: ((mod: any) => void)[] }} */
    const moduleArgs = { preRun: [] };
    let bookPreRun = null;

    if (this.bookPath) {
      try {
        const fetchImpl = this.fetchImpl;
        const response = await this._waitForStartup(
          fetchImpl(this.bookPath),
          '定跡DBの取得'
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const bookBytes = new Uint8Array(await this._waitForStartup(
          response.arrayBuffer(),
          '定跡DBの読み込み'
        ));
        if (bookBytes.byteLength === 0) throw new Error('定跡DBファイルが空です');
        bookPreRun = (mod) => {
          try {
            writeVirtualFile(mod, this.bookVirtualPath, bookBytes);
          } catch (cause) {
            const error = cause instanceof Error ? cause : new Error(String(cause));
            this.activeBookPath = null;
            if (this.onBookFallback) {
              this.onBookFallback({ path: this.bookPath, error, stage: 'filesystem' });
            }
          }
        };
        moduleArgs.preRun.push(bookPreRun);
        this.activeBookPath = this.bookPath;
      } catch (cause) {
        const error = cause instanceof Error ? cause : new Error(String(cause));
        this.activeBookPath = null;
        if (this.onBookFallback) {
          this.onBookFallback({ path: this.bookPath, error, stage: 'fetch' });
        }
      }
    }

    let factory = this.factory;
    if (this.nnuePath) {
      // CLAUDE.md 2. の注意事項:
      // preRunフックでモジュール初期化前に仮想ファイルシステムへ書き込む。
      // 初期化後にFS.writeFile()すると別スレッドから見えず失敗する。
      try {
        // Window.fetchはメソッドとして別オブジェクトへ束縛するとIllegal invocationになる。
        const fetchImpl = this.fetchImpl;
        const response = await this._waitForStartup(
          fetchImpl(this.nnuePath),
          '評価関数の取得'
        );
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const nnBytes = new Uint8Array(await this._waitForStartup(
          response.arrayBuffer(),
          '評価関数の読み込み'
        ));
        if (nnBytes.byteLength === 0) {
          throw new Error('評価関数ファイルが空です');
        }
        moduleArgs.preRun.push((mod) => writeVirtualFile(mod, this.nnueVirtualPath, nnBytes));
        this.activeNnuePath = this.nnuePath;
      } catch (cause) {
        const error = cause instanceof Error ? cause : new Error(String(cause));
        this.activeNnuePath = null;
        if (this.onNnueFallback) {
          this.onNnueFallback({ path: this.nnuePath, error, stage: 'fetch' });
        }
        if (this.fallbackFactory) factory = this.fallbackFactory;
      }
    }

    try {
      this.instance = await this._waitForStartup(
        factory(moduleArgs),
        'エンジン本体の起動'
      );
    } catch (cause) {
      if (!this.fallbackFactory || factory === this.fallbackFactory) throw cause;
      const error = cause instanceof Error ? cause : new Error(String(cause));
      this.activeNnuePath = null;
      if (this.onNnueFallback) {
        this.onNnueFallback({ path: this.nnuePath, error, stage: 'engine' });
      }
      this.instance = await this._waitForStartup(
        this.fallbackFactory({ preRun: bookPreRun ? [bookPreRun] : [] }),
        '内蔵評価エンジンの起動'
      );
    }
    this.instance.addMessageListener((line) => this._emit(line));

    this._usiOptions.clear();
    await this._sendAndWaitFor(
      'usi',
      (line) => line === 'usiok',
      (line) => {
        const match = /^option name (.+?) type\s+\S+/.exec(line);
        if (match) this._usiOptions.add(match[1]);
      },
      'usi応答',
    );
  }

  /**
   * 'isready' を送り 'readyok' を待つ。本番評価関数では1.3〜1.4秒程度かかる
   * （CLAUDE.md 6. 参照）ので、呼び出し側でローディングUIを出すこと。
   */
  async ready() {
    await this._sendAndWaitFor(
      'isready',
      (line) => line === 'readyok',
      null,
      'isready応答',
    );
  }

  /** @param {string} sfen 'startpos' または 'sfen ...' の形式は付けず局面文字列のみ渡す */
  newGame() {
    this.send('usinewgame');
  }

  /** @param {string} sfenOrStartpos 例: 'startpos' か 'sfen <SFEN> moves ...' */
  setPosition(sfenOrStartpos) {
    if (sfenOrStartpos === 'startpos' || sfenOrStartpos.startsWith('startpos')) {
      this.send('position ' + sfenOrStartpos);
    } else {
      this.send('position sfen ' + sfenOrStartpos);
    }
  }

  /**
   * 思考を開始し、bestmoveを待って返す。
   * nodesを強さの基準とし、maxTimeMsは極端に遅い端末向けの安全上限として使う。
   * @param {{
   *   movetime?: number,
   *   nodes?: number,
   *   maxTimeMs?: number,
   *   searchMoves?: string[],
   *   onUpdate?: (update: {
   *     depth?: number,
   *     nodes?: number,
   *     nps?: number,
   *     candidates: {
   *       rank: number,
   *       move: string,
   *       pv: string[],
   *       depth?: number,
   *       score?: { type: 'cp' | 'mate', value: number }
   *     }[]
   *   }) => void
   * }} goOptions
   * @returns {Promise<{
   *   move: string,
   *   ponder?: string,
   *   candidates: { rank: number, move: string }[]
   * }>}
   */
  async go(goOptions = {}) {
    let cmd = 'go';
    if (goOptions.movetime) cmd += ' movetime ' + goOptions.movetime;
    if (goOptions.nodes) cmd += ' nodes ' + goOptions.nodes;
    if (goOptions.searchMoves !== undefined) {
      if (!Array.isArray(goOptions.searchMoves) || goOptions.searchMoves.length === 0
        || goOptions.searchMoves.some(
          (move) => typeof move !== 'string' || !USI_MOVE_PATTERN.test(move)
        )) {
        throw new Error('searchMovesは1件以上のUSI指し手配列にしてください');
      }
      const searchMoves = [...new Set(goOptions.searchMoves)];
      // やねうら王はsearchmoves以降の全トークンを指し手として読むため、必ず末尾に置く。
      cmd += ' searchmoves ' + searchMoves.join(' ');
    }

    return new Promise((resolve) => {
      const candidates = new Map();
      const candidateDetails = new Map();
      let latestStats = {};
      const timeoutId = goOptions.maxTimeMs
        ? setTimeout(() => this.send('stop'), goOptions.maxTimeMs)
        : null;
      const listener = (line) => {
        if (line.startsWith('info ')) {
          const rankMatch = line.match(/\bmultipv\s+(\d+)\b/);
          const pvMatch = line.match(/\bpv\s+(.+)$/);
          const depthMatch = line.match(/\bdepth\s+(\d+)\b/);
          const nodesMatch = line.match(/\bnodes\s+(\d+)\b/);
          const npsMatch = line.match(/\bnps\s+(\d+)\b/);
          const scoreMatch = line.match(/\bscore\s+(cp|mate)\s+([+-]?\d+)\b/);
          latestStats = {
            depth: depthMatch ? Number(depthMatch[1]) : latestStats.depth,
            nodes: nodesMatch ? Number(nodesMatch[1]) : latestStats.nodes,
            nps: npsMatch ? Number(npsMatch[1]) : latestStats.nps,
          };
          if (rankMatch && pvMatch) {
            const rank = Number(rankMatch[1]);
            const pv = pvMatch[1].trim().split(/\s+/).filter((move) => USI_MOVE_PATTERN.test(move));
            if (pv.length === 0) return;
            const detail = {
              rank,
              move: pv[0],
              pv,
              depth: depthMatch ? Number(depthMatch[1]) : undefined,
              score: scoreMatch ? {
                type: scoreMatch[1],
                value: Number(scoreMatch[2]),
              } : undefined,
            };
            candidates.set(rank, detail.move);
            candidateDetails.set(rank, detail);
            if (typeof goOptions.onUpdate === 'function') {
              goOptions.onUpdate({
                ...latestStats,
                candidates: [...candidateDetails.values()]
                  .sort((left, right) => left.rank - right.rank),
              });
            }
          }
        }
        if (line.startsWith('bestmove')) {
          const parts = line.split(' ');
          this._listeners.splice(this._listeners.indexOf(listener), 1);
          if (timeoutId !== null) clearTimeout(timeoutId);
          candidates.set(1, parts[1]);
          const bestDetail = candidateDetails.get(1);
          candidateDetails.set(1, {
            ...(bestDetail || {}),
            rank: 1,
            move: parts[1],
          });
          resolve({
            move: parts[1],
            ponder: parts[3],
            candidates: [...candidateDetails.values()]
              .sort((left, right) => left.rank - right.rank),
          });
        }
      };
      this.onOutput(listener);
      this.send(cmd);
    });
  }

  /**
   * USIの詰み専用探索を実行する。通常評価探索とは独立しているため、
   * CPU難易度のnodes設定に左右されず、詰み手順そのものを返せる。
   * @param {{ movetime?: number, maxTimeMs?: number }} options
   * @returns {Promise<{ status: 'mate'|'nomate'|'timeout'|'unsupported', moves: string[] }>}
   */
  async goMate(options = {}) {
    const movetime = options.movetime ?? 3000;
    const maxTimeMs = options.maxTimeMs ?? movetime + 1500;
    if (!Number.isInteger(movetime) || movetime < 1) {
      throw new Error('詰み探索時間は1以上の整数にしてください');
    }
    if (!Number.isInteger(maxTimeMs) || maxTimeMs < movetime) {
      throw new Error('詰み探索の上限時間が不正です');
    }

    return new Promise((resolve) => {
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        const index = this._listeners.indexOf(listener);
        if (index >= 0) this._listeners.splice(index, 1);
        resolve(result);
      };
      const listener = (line) => {
        if (!line.startsWith('checkmate')) return;
        const payload = line.slice('checkmate'.length).trim();
        if (payload === 'nomate') return finish({ status: 'nomate', moves: [] });
        if (payload === 'timeout') return finish({ status: 'timeout', moves: [] });
        if (payload === 'notimplemented') return finish({ status: 'unsupported', moves: [] });
        const moves = payload.split(/\s+/).filter((move) => USI_MOVE_PATTERN.test(move));
        finish(moves.length > 0
          ? { status: 'mate', moves }
          : { status: 'unsupported', moves: [] });
      };
      const timeoutId = setTimeout(() => {
        try { this.send('stop'); } catch { /* 終了処理中なら何もしない */ }
        finish({ status: 'timeout', moves: [] });
      }, maxTimeMs);
      this.onOutput(listener);
      this.send(`go mate ${movetime}`);
    });
  }

  /** 実行中の探索を停止し、bestmoveの応答を待たせる。 */
  stop() {
    this.send('stop');
  }

  /**
   * 敵の強さパラメータ(docs/SYSTEM_DESIGN.md 2.3節)をUSIオプションへ反映する。
   * @param {{ multiPv?: number }} params
   */
  applyStrengthOptions(params = {}) {
    if (params.multiPv !== undefined) {
      if (!Number.isInteger(params.multiPv) || params.multiPv < 1) {
        throw new Error('multiPvは1以上の整数にしてください');
      }
      this.send('setoption name MultiPV value ' + params.multiPv);
    }
  }

  supportsOption(name) {
    if (typeof name !== 'string' || name.trim() === '') return false;
    return this._usiOptions.has(name);
  }

  setOption(name, value) {
    if (!this.supportsOption(name)) return false;
    this.send(`setoption name ${name} value ${String(value)}`);
    return true;
  }

  /** preRunで配置済みの定跡DBを、対応オプションがあるエンジンだけで有効化する。 */
  enablePreloadedBook() {
    if (!this.activeBookPath || !this.supportsOption('BookFile')) return false;
    const lastSlash = this.bookVirtualPath.lastIndexOf('/');
    const directory = lastSlash > 0 ? this.bookVirtualPath.slice(0, lastSlash) : '.';
    const fileName = this.bookVirtualPath.slice(lastSlash + 1);
    if (this.supportsOption('BookDir')) this.setOption('BookDir', directory);
    if (this.supportsOption('USI_OwnBook')) this.setOption('USI_OwnBook', true);
    return this.setOption('BookFile', fileName);
  }

  /** 内蔵定跡を無効化し、go searchmovesの候補外を選ばないようにする。 */
  disableOwnBook() {
    const ownBookDisabled = this.setOption('USI_OwnBook', false);
    const bookFileDisabled = this.setOption('BookFile', 'no_book');
    return ownBookDisabled || bookFileDisabled;
  }

  send(command) {
    if (!this.instance) throw new Error('エンジンが初期化されていません');
    this.instance.postMessage(command);
  }

  quit() {
    if (this.instance) this.send('quit');
  }

  _waitForStartup(promise, label) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`${label}が${this.startupTimeoutMs / 1000}秒以内に完了しませんでした`));
      }, this.startupTimeoutMs);
      Promise.resolve(promise).then(
        (value) => {
          clearTimeout(timeoutId);
          resolve(value);
        },
        (error) => {
          clearTimeout(timeoutId);
          reject(error);
        },
      );
    });
  }

  _sendAndWaitFor(command, predicate, onLine = null, label = `${command}応答`) {
    return new Promise((resolve, reject) => {
      const removeListener = (listener) => {
        const index = this._listeners.indexOf(listener);
        if (index >= 0) this._listeners.splice(index, 1);
      };
      const listener = (line) => {
        if (onLine) onLine(line);
        if (predicate(line)) {
          clearTimeout(timeoutId);
          removeListener(listener);
          resolve();
        }
      };
      const timeoutId = setTimeout(() => {
        removeListener(listener);
        reject(new Error(`${label}が${this.startupTimeoutMs / 1000}秒以内にありませんでした`));
      }, this.startupTimeoutMs);
      this.onOutput(listener);
      try {
        this.send(command);
      } catch (error) {
        clearTimeout(timeoutId);
        removeListener(listener);
        reject(error);
      }
    });
  }
}
