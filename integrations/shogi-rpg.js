/**
 * shogi-match/integrations/shogi-rpg.js
 *
 * 対局UIのエントリポイント。
 * 盤面(BoardView)とエンジン(ShogiEngine)を繋ぎ、人間(先手) vs エンジン(後手)の
 * 対局を成立させるゲームループ。RPGマスタとM3セーブ状態を対局条件へ反映する。
 */

import {
  applyAssistLimitUpgrades,
  BoardView,
  buildMatchPath,
  calculateEffectiveNodeLimit,
  calculateEffectiveMoveRank,
  Color,
  evaluateEnteringKingDeclaration,
  findNewFormationCallouts,
  findNewHiraganaSuishoFormations,
  formatHintEvaluation,
  formatHintMove,
  formatHintPrincipalVariation,
  getAvailableFormations,
  getEnemyOpeningDecision,
  getHintMoves,
  getNodeDebuffMultiplier,
  loadEngineFactories,
  loadMatchSetupOptions,
  mountShogiMatchUiBoard,
  RepetitionTracker,
  resolveMatchSelection,
  resolveNnuePath,
  selectMoveByRank,
  ShogiEngine,
  TurnHistory,
  varyNodeLimit,
} from './shogi-match.js';
import { createNovelResultReporter } from '../novel-bridge.mjs';
import { decodeSaveCode, encodeSaveCode, formatSaveCode } from '../../save/save-code.mjs';
import { normalizeSaveState, recordDefeatedBoss } from '../../save/save-state.mjs';
import { loadSaveState, saveSaveState } from '../../save/save-storage.mjs';

window.__shogiRpgBoardUiStarted = true;

const STANDARD_BOOK_PATH = '../../assets/books/standard_book.db';
const STANDARD_BOOK_VIRTUAL_PATH = '/user_book1.db';
const STANDARD_BOOK_MAX_MOVES = 40;
const HINT_MULTI_PV = 3;
const HINT_PV_MOVE_LIMIT = 6;
const HINT_ANALYSIS_NODE_CHUNK = 1_000;
const HINT_ANALYSIS_PAUSE_MS = 100;
const HINT_UI_UPDATE_INTERVAL_MS = 250;

const statusEl = document.getElementById('status');
const resignButton = document.getElementById('resign-button');
const declareWinButton = document.getElementById('declare-win-button');
const restartButton = document.getElementById('restart-button');
const hintButton = document.getElementById('hint-button');
const undoButton = document.getElementById('undo-button');
const hintMessageEl = document.getElementById('hint-message');
const connectionStatusEl = document.getElementById('connection-status');
const resultOverlay = document.getElementById('result-overlay');
const resultMessageEl = document.getElementById('result-message');
const resultCloseButton = document.getElementById('result-close');
const resultRetryButton = document.getElementById('result-retry');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingMessageEl = document.getElementById('loading-message');
const loadingSpinner = document.getElementById('loading-spinner');
const loadingRetryButton = document.getElementById('loading-retry');
const setupScreen = document.getElementById('setup-screen');
const setupForm = document.getElementById('setup-form');
const setupEnemy = document.getElementById('setup-enemy');
const setupFormation = document.getElementById('setup-formation');
const setupDifficulty = document.getElementById('setup-difficulty');
const setupItem = document.getElementById('setup-item');
const setupNote = document.getElementById('setup-note');
const saveStatusEl = document.getElementById('save-status');
const saveCodeOutput = document.getElementById('save-code-output');
const saveCodeIssueButton = document.getElementById('save-code-issue');
const saveCodeInput = document.getElementById('save-code-input');
const saveCodeRestoreButton = document.getElementById('save-code-restore');
const saveCodeMessage = document.getElementById('save-code-message');
const gameScreen = document.getElementById('game-screen');
const yakobihimeGuide = document.getElementById('yakobihime-guide');
const yakobihimeSpeech = document.getElementById('yakobihime-speech');
let wakeLock = null;

function reloadPage() {
  window.location.reload();
}

function showOptions(select, options, valueKey, nameKey) {
  select.replaceChildren(...options.map((item) => {
    const option = document.createElement('option');
    option.value = item[valueKey];
    option.textContent = item[nameKey];
    return option;
  }));
}

function createSaveContext(options) {
  return {
    formations: options.formations,
    items: options.items,
    levelUnlocks: options.levelUnlocks,
    // 専用ボスマスタ導入までは敵マスタの順序を呪文の固定ビット位置として扱う。
    bossIds: options.enemies.map((enemy) => enemy.enemy_id),
    difficultyIds: options.difficulties.map((difficulty) => difficulty.difficulty_id),
  };
}

function createSaveCatalog(context) {
  return {
    formationIds: context.formations.map((formation) => formation.formation_id),
    bossIds: context.bossIds,
  };
}

function loadPlayerSave(options, params) {
  const context = createSaveContext(options);
  const loaded = loadSaveState(window.localStorage, context, {
    // 旧ブックマークとの互換用。保存済みデータがある場合はこの値を使わない。
    playerLevel: params.get('level') || undefined,
  });
  let state = loaded.state;
  let warning = loaded.warning;
  try {
    state = saveSaveState(window.localStorage, state);
  } catch (error) {
    console.warn(error.message, error);
    warning = [warning, error.message].filter(Boolean).join(' ');
  }
  return { state, context, warning };
}

function persistPlayerSave(state, messageElement = null) {
  try {
    const saved = saveSaveState(window.localStorage, state);
    if (messageElement) messageElement.textContent = '自動保存しました。';
    return saved;
  } catch (error) {
    console.warn(error.message, error);
    if (messageElement) messageElement.textContent = error.message;
    return state;
  }
}

async function showMatchSetup(params) {
  setStatus('対局条件を読み込み中...');
  setLoading('対局条件を読み込み中...');
  const options = await loadMatchSetupOptions();
  const loadedSave = loadPlayerSave(options, params);
  let playerSave = loadedSave.state;
  const { context } = loadedSave;
  const playerLevel = playerSave.player_level;
  const unlockedFormationIds = new Set(playerSave.unlocked_formations);
  const unlockedItemIds = new Set(playerSave.unlocked_items);

  showOptions(setupEnemy, options.enemies, 'enemy_id', 'name');
  showOptions(setupDifficulty, options.difficulties, 'difficulty_id', 'name');
  showOptions(setupItem, [
    { item_id: '', name: '装備しない' },
    ...options.items.filter((item) => item.type === 'enemy_debuff_nodes'
      && !item.consumable && unlockedItemIds.has(item.item_id)),
  ], 'item_id', 'name');
  setupNote.textContent = `プレイヤーレベル${playerLevel}／あなたが先手で対局します。`;
  saveStatusEl.textContent = loadedSave.warning
    || `第${playerSave.chapter}章・レベル${playerLevel}の進行を自動保存しています。`;

  const requestedEnemy = params.get('enemy');
  if (options.enemies.some((enemy) => enemy.enemy_id === requestedEnemy)) {
    setupEnemy.value = requestedEnemy;
  }
  const requestedDifficulty = params.get('difficulty') || playerSave.difficulty;
  if (options.difficulties.some((difficulty) => difficulty.difficulty_id === requestedDifficulty)) {
    setupDifficulty.value = requestedDifficulty;
  }
  const requestedItem = params.get('item') || '';
  if ([...setupItem.options].some((option) => option.value === requestedItem)) {
    setupItem.value = requestedItem;
  }

  function updateFormationOptions() {
    const enemy = options.enemies.find((item) => item.enemy_id === setupEnemy.value);
    const available = getAvailableFormations(
      enemy, options.formations, unlockedFormationIds
    );
    const previous = setupFormation.value;
    showOptions(setupFormation, available, 'formation_id', 'name');
    const requested = params.get('formation') || previous || 'standard';
    if (available.some((formation) => formation.formation_id === requested)) {
      setupFormation.value = requested;
    }
  }

  setupEnemy.addEventListener('change', updateFormationOptions);
  setupDifficulty.addEventListener('change', () => {
    playerSave = persistPlayerSave(
      { ...playerSave, difficulty: setupDifficulty.value }, saveStatusEl
    );
  });
  updateFormationOptions();
  setupForm.addEventListener('submit', (event) => {
    event.preventDefault();
    window.location.assign(buildMatchPath(window.location.pathname, {
      enemyId: setupEnemy.value,
      formationId: setupFormation.value,
      difficultyId: setupDifficulty.value,
      itemId: setupItem.value,
    }));
  });

  const catalog = createSaveCatalog(context);
  saveCodeIssueButton.addEventListener('click', () => {
    saveCodeOutput.value = formatSaveCode(encodeSaveCode(playerSave, catalog));
    saveCodeMessage.textContent = '復活の呪文を発行しました。大切に保管してください。';
  });
  saveCodeRestoreButton.addEventListener('click', () => {
    try {
      const decoded = decodeSaveCode(saveCodeInput.value, catalog);
      const restored = normalizeSaveState(decoded, context);
      playerSave = saveSaveState(window.localStorage, restored);
      saveCodeMessage.textContent = '復活の呪文から復元しました。画面を更新します。';
      window.location.assign(window.location.pathname);
    } catch (error) {
      saveCodeMessage.textContent = error.message;
    }
  });

  gameScreen.hidden = true;
  setupScreen.hidden = false;
  loadingOverlay.hidden = true;
  setStatus('対局条件を選んでください。');
}

function updateConnectionStatus() {
  connectionStatusEl.hidden = navigator.onLine;
}

async function requestScreenWakeLock() {
  if (wakeLock || !navigator.wakeLock || document.visibilityState !== 'visible') return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => {
      wakeLock = null;
    });
  } catch (error) {
    // Wake Lock非対応・省電力設定等でも対局機能には影響させない。
    console.warn('画面スリープの抑止を有効にできませんでした', error);
  }
}

function setStatus(text) {
  statusEl.textContent = text;
}

function setLoading(text) {
  loadingMessageEl.textContent = text;
}

function showResult(board, message) {
  resignButton.disabled = true;
  declareWinButton.disabled = true;
  hintButton.disabled = true;
  undoButton.disabled = true;
  board.lock();
  resultMessageEl.textContent = message;
  resultOverlay.hidden = false;
}

resultCloseButton.addEventListener('click', () => {
  resultOverlay.hidden = true;
});

restartButton.addEventListener('click', () => {
  if (window.confirm('現在の対局を終了して、対局条件の選択へ戻りますか？')) {
    window.location.assign(window.location.pathname);
  }
});
resultRetryButton.addEventListener('click', reloadPage);
loadingRetryButton.addEventListener('click', reloadPage);
window.addEventListener('online', updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);
document.addEventListener('pointerdown', requestScreenWakeLock, { once: true });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') requestScreenWakeLock();
});
updateConnectionStatus();

async function main() {
  const params = new URLSearchParams(window.location.search);
  const novelResultReporter = createNovelResultReporter(window, params);
  const hasDirectMatch = ['formation', 'enemy', 'difficulty']
    .some((key) => params.has(key));
  if (!hasDirectMatch) {
    await showMatchSetup(params);
    return;
  }

  setupScreen.hidden = true;
  gameScreen.hidden = false;
  const formationId = params.get('formation') || 'standard';
  const enemyId = params.get('enemy') || 'training_partner';
  const requestedDifficultyId = params.get('difficulty');
  const itemId = params.get('item');
  setStatus('対局データを読み込み中...');
  setLoading('対局データを読み込み中...');
  const options = await loadMatchSetupOptions();
  const loadedSave = loadPlayerSave(options, params);
  let playerSave = loadedSave.state;
  const playerLevel = playerSave.player_level;
  const difficultyId = requestedDifficultyId || playerSave.difficulty;
  if (!options.difficulties.some((item) => item.difficulty_id === difficultyId)) {
    throw new Error(`指定された難易度が見つかりません: ${difficultyId}`);
  }
  if (playerSave.difficulty !== difficultyId) {
    playerSave = persistPlayerSave({ ...playerSave, difficulty: difficultyId });
  }
  const { formation, enemy, openingBook, difficulty, equippedItem, unlockState } =
    resolveMatchSelection(options, {
      formationId,
      enemyId,
      difficultyId,
      itemId,
      playerLevel,
      unlockedFormationIds: new Set(playerSave.unlocked_formations),
      unlockedItemIds: new Set(playerSave.unlocked_items),
    });
  if (equippedItem?.consumable) {
    const count = playerSave.item_counts[equippedItem.item_id] || 0;
    if (count < 1) throw new Error(`「${equippedItem.name}」を持っていません`);
    const remaining = count - 1;
    playerSave = persistPlayerSave({
      ...playerSave,
      equipped_item: remaining === 0 ? null : playerSave.equipped_item,
      item_counts: { ...playerSave.item_counts, [equippedItem.item_id]: remaining },
    });
  }
  const nodeDebuffMultiplier = equippedItem?.type === 'enemy_debuff_nodes'
    ? getNodeDebuffMultiplier(equippedItem) : 1;
  const moveRankDebuff = equippedItem?.type === 'enemy_debuff_rank'
    ? equippedItem.effect_value : 0;
  const assistLimits = applyAssistLimitUpgrades(
    {
      hints: playerSave.item_counts.hint_ticket || 0,
      undo: playerSave.item_counts.undo_ticket || 0,
    },
    unlockState
  );
  const localHintTest = ['localhost', '127.0.0.1'].includes(window.location.hostname)
    && params.get('test_hints') === '1';
  if (localHintTest) assistLimits.hints = Math.max(assistLimits.hints, 99);
  const effectiveNodeLimit = calculateEffectiveNodeLimit(
    enemy.node_limit,
    difficulty.node_limit_mult * nodeDebuffMultiplier
  );
  const effectiveMoveRank = calculateEffectiveMoveRank(
    enemy.move_rank,
    difficulty.move_rank_max_bonus + moveRankDebuff
  );
  const nnuePath = resolveNnuePath(enemy.nnue_file);

  setStatus('エンジンを初期化中...');
  setLoading('エンジンを初期化中...');

  const handleNnueFallback = ({ path, error }) => {
    console.warn(`NNUE ${path} を使用できないため内蔵評価関数を使用します`, error);
    setLoading('NNUEエンジンを使用できないため、内蔵評価関数を使用します...');
  };
  const handleBookFallback = ({ path, error }) => {
    console.warn(`定跡DB ${path} を使用できないため、探索だけで対局を続けます`, error);
  };
  const engineFactories = await loadEngineFactories(nnuePath, {
    onFallback: handleNnueFallback,
  });
  const engine = new ShogiEngine({
    factory: engineFactories.factory,
    fallbackFactory: engineFactories.fallbackFactory,
    nnuePath: engineFactories.useNnue ? nnuePath : null,
    bookPath: STANDARD_BOOK_PATH,
    bookVirtualPath: STANDARD_BOOK_VIRTUAL_PATH,
    onNnueFallback: handleNnueFallback,
    onBookFallback: handleBookFallback,
  });

  await engine.init();
  const standardBookEnabled = engine.enablePreloadedBook();
  if (standardBookEnabled) {
    engine.setOption('BookMoves', STANDARD_BOOK_MAX_MOVES);
    engine.setOption('BookIgnoreRate', 0);
    // YaneuraOuの自己定跡はsearchmovesより先に着手を決めるため、村固有の
    // 戦法がある対局では敵専用定跡マスタを優先する。囲い完成後も再び
    // 居飛車へ戻る手を選ばせないよう、この対局中は自己定跡を再開しない。
    if (openingBook) engine.disableOwnBook();
  } else {
    engine.disableOwnBook();
  }
  const bookLabel = openingBook
    ? '／戦法定跡DB'
    : (standardBookEnabled ? '／標準定跡DB' : '');
  engine.applyStrengthOptions({ multiPv: effectiveMoveRank.max });
  // GUI側の宣言条件（先手28点・後手27点）とエンジン側を一致させる。
  engine.send('setoption name EnteringKingRule value CSARule27');
  setStatus('エンジン初期化完了。isready送信中...');
  setLoading('評価関数と定跡を解析中...');
  await engine.ready();
  engine.newGame();
  loadingOverlay.hidden = true;

  const board = new BoardView(document.getElementById('board-container'), {
    startSfen: enemy.start_sfen_override || formation.start_sfen,
    onMove: async (usiMove) => {
      await onHumanMove(usiMove);
    },
  });

  let moveHistory = [];
  const announcedFormationIds = new Set();
  let gameOver = false;
  let engineBusy = false;
  let hintAnalyzing = false;
  let hintStopRequested = false;
  let hintsUsed = 0;
  let undoUsed = 0;
  const repetitionTracker = new RepetitionTracker(board.toSfen());
  const turnHistory = new TurnHistory({
    sfen: board.toSfen(),
    moveHistoryLength: 0,
    repetitionLength: repetitionTracker.length,
  });
  // ShogiHomeの盤面を標準表示にする。比較が必要な場合だけboard_ui=legacyで旧盤面を使う。
  const shogiMatchBoard = params.get('board_ui') === 'legacy'
    ? null
    : mountShogiMatchUiBoard(
      board, document.getElementById('board-container'), onHumanMove
    );

  function hintCandidateLines(candidate, currentSfen) {
    const labels = new Map([[1, '最善手'], [2, '次善手'], [3, '3番手']]);
    const lines = [
      `${labels.get(candidate.rank) || `${candidate.rank}番手`}：${formatHintMove(candidate.move, currentSfen)}　${formatHintEvaluation(candidate.score)}`,
    ];
    const variation = formatHintPrincipalVariation(
      candidate.pv || [candidate.move], currentSfen, HINT_PV_MOVE_LIMIT
    );
    if (variation) lines.push(`　読み筋：${variation}`);
    return lines;
  }

  function setYakobihimeSpeech(text, animate = false) {
    yakobihimeSpeech.textContent = text;
    if (!animate) return;
    yakobihimeGuide.classList.remove('speaking');
    void yakobihimeGuide.offsetWidth;
    yakobihimeGuide.classList.add('speaking');
  }

  function announceDetectedFormation() {
    const detected = findNewFormationCallouts(
      board.toSfen(), options.formationCallouts, announcedFormationIds
    );
    const callout = detected[0];
    if (callout) {
      announcedFormationIds.add(callout.callout_id);
      setYakobihimeSpeech(callout.speech, true);
      return;
    }
    const formations = findNewHiraganaSuishoFormations(
      board.toSfen(), options.hiraganaSuishoFormations, announcedFormationIds
    );
    const formation = formations[0];
    if (!formation) return;
    announcedFormationIds.add(`hiragana:${formation.name}`);
    setYakobihimeSpeech(`${formation.name}！`, true);
  }

  setYakobihimeSpeech(options.formationCallouts.initial_speech);
  announceDetectedFormation();

  function finishMatch({ outcome, reason, status, message }) {
    if (gameOver) return false;
    gameOver = true;
    if (outcome === 'win' && novelResultReporter.embedded) {
      playerSave = persistPlayerSave(recordDefeatedBoss(playerSave, enemyId));
    }
    setStatus(status);
    showResult(board, message);
    novelResultReporter.send({
      outcome,
      reason,
      moveCount: moveHistory.length,
    });
    return true;
  }

  function updateAssistButtons() {
    const humanTurn = board.isHumanTurn();
    const hintsRemaining = Math.max(0, assistLimits.hints - hintsUsed);
    const undoRemaining = Math.max(0, assistLimits.undo - undoUsed);
    if (shogiMatchBoard) {
      shogiMatchBoard.allowMove = !gameOver && humanTurn
        && (!engineBusy || hintAnalyzing);
    }
    hintButton.textContent = hintAnalyzing
      ? '解析を止める'
      : `ヒント（残り${hintsRemaining}）`;
    undoButton.textContent = `待った（残り${undoRemaining}）`;
    hintButton.disabled = hintAnalyzing
      ? false
      : gameOver || engineBusy || !humanTurn || hintsRemaining === 0;
    undoButton.disabled = gameOver || engineBusy || !humanTurn
      || undoRemaining === 0 || !turnHistory.canUndo();
  }

  function humanDeclarationStatus() {
    return evaluateEnteringKingDeclaration(
      board.toSfen(), Color.Black, board.isCheck(Color.Black)
    );
  }

  function updateDeclareWinButton() {
    declareWinButton.disabled = gameOver || engineBusy || !humanDeclarationStatus().eligible;
  }

  function finishByRepetition(result) {
    if (!result) return false;

    if (result.type === 'draw') {
      finishMatch({
        outcome: 'draw',
        reason: 'repetition',
        status: '千日手が成立しました。',
        message: '千日手により引き分けです。',
      });
    } else if (result.loserColor === Color.Black) {
      finishMatch({
        outcome: 'loss',
        reason: 'perpetual_check',
        status: '連続王手の千日手により反則負けです。',
        message: '連続王手の千日手によりあなたの敗北です。',
      });
    } else {
      finishMatch({
        outcome: 'win',
        reason: 'perpetual_check',
        status: '相手の連続王手により反則勝ちです。',
        message: '連続王手の千日手によりあなたの勝利です。',
      });
    }
    return true;
  }

  resignButton.disabled = false;
  resignButton.addEventListener('click', () => {
    if (gameOver) return;
    finishMatch({
      outcome: 'loss',
      reason: 'resignation',
      status: 'あなたの投了により終了しました。',
      message: 'あなたの投了により敗北しました。',
    });
  });

  declareWinButton.addEventListener('click', () => {
    if (gameOver || !humanDeclarationStatus().eligible) return;
    finishMatch({
      outcome: 'win',
      reason: 'entering_king',
      status: '入玉宣言が成立しました。',
      message: '入玉宣言によりあなたの勝利です。',
    });
  });

  hintButton.addEventListener('click', async () => {
    if (hintAnalyzing) {
      hintStopRequested = true;
      hintButton.textContent = '停止中...';
      hintButton.disabled = true;
      return;
    }
    if (gameOver || engineBusy || !board.isHumanTurn()
      || hintsUsed >= assistLimits.hints) return;
    engineBusy = true;
    hintAnalyzing = true;
    hintStopRequested = false;
    shogiMatchBoard?.setRecommendedMoves();
    hintMessageEl.textContent = '解析を開始しています...\nもう一度押すと停止します。';
    updateAssistButtons();
    updateDeclareWinButton();
    const restoreStandardBook = standardBookEnabled && !openingBook;
    let latestUpdate = null;
    let latestSearchResult = null;
    let renderFrame = null;
    let renderTimer = null;
    let lastRenderedAt = 0;
    const hintCandidatesByRank = new Map();
    try {
      const moves = moveHistory.length ? ' moves ' + moveHistory.join(' ') : '';
      const currentSfen = board.toSfen();
      engine.applyStrengthOptions({ multiPv: HINT_MULTI_PV });
      if (restoreStandardBook) engine.disableOwnBook();
      engine.setPosition((enemy.start_sfen_override || formation.start_sfen) + moves);
      while (!hintStopRequested) {
        latestSearchResult = await engine.go({
          nodes: HINT_ANALYSIS_NODE_CHUNK,
          onUpdate: (update) => {
            for (const candidate of update.candidates) {
              hintCandidatesByRank.set(candidate.rank, candidate);
            }
            latestUpdate = {
              ...update,
              candidates: [...hintCandidatesByRank.values()]
                .sort((a, b) => a.rank - b.rank),
            };
            if (renderTimer !== null || renderFrame !== null) return;
            const elapsed = performance.now() - lastRenderedAt;
            const delay = Math.max(0, HINT_UI_UPDATE_INTERVAL_MS - elapsed);
            renderTimer = setTimeout(() => {
              renderTimer = null;
              renderFrame = requestAnimationFrame(() => {
                renderFrame = null;
                if (!hintAnalyzing || hintStopRequested) return;
                lastRenderedAt = performance.now();
                const depth = latestUpdate.depth ? `深さ ${latestUpdate.depth}` : '深さ —';
                const nodes = Number.isFinite(latestUpdate.nodes)
                  ? `${latestUpdate.nodes.toLocaleString('ja-JP')}局面`
                  : '局面数 —';
                hintMessageEl.textContent = [
                  `解析中（${depth}／直近 ${nodes}）`,
                  ...latestUpdate.candidates.slice(0, HINT_MULTI_PV)
                    .flatMap((candidate) => hintCandidateLines(candidate, currentSfen)),
                  'もう一度押すと停止します。',
                ].join('\n');
                shogiMatchBoard?.setRecommendedMoves(
                  latestUpdate.candidates.slice(0, HINT_MULTI_PV)
                    .map(({ move, score }) => ({ usi: move, score }))
                );
              });
            }, delay);
          },
        });
        await new Promise((resolve) => setTimeout(resolve, HINT_ANALYSIS_PAUSE_MS));
      }
      if (!latestSearchResult) throw new Error('ヒントの探索結果を取得できませんでした');
      const hintMoves = getHintMoves(latestSearchResult, HINT_MULTI_PV);
      const positionUnchanged = board.toSfen() === currentSfen;
      hintAnalyzing = false;
      if (renderTimer !== null) clearTimeout(renderTimer);
      if (renderFrame !== null) cancelAnimationFrame(renderFrame);
      hintsUsed += 1;
      if ((playerSave.item_counts.hint_ticket || 0) > 0) {
        playerSave = persistPlayerSave({
          ...playerSave,
          item_counts: {
            ...playerSave.item_counts,
            hint_ticket: playerSave.item_counts.hint_ticket - 1,
          },
        });
      }
      const detailByRank = new Map(
        (latestUpdate?.candidates || []).map((candidate) => [candidate.rank, candidate])
      );
      const stats = latestUpdate
        ? `（深さ ${latestUpdate.depth || '—'}／${Number.isFinite(latestUpdate.nodes)
          ? `${latestUpdate.nodes.toLocaleString('ja-JP')}局面` : '局面数 —'}）`
        : '';
      if (positionUnchanged) {
        hintMessageEl.textContent = [
          `解析結果${stats}`,
          ...hintMoves.flatMap(({ rank, move }) => hintCandidateLines({
            rank,
            move,
            ...detailByRank.get(rank),
          }, currentSfen)),
        ].join('\n');
        shogiMatchBoard?.setRecommendedMoves(
          hintMoves.map(({ rank, move }) => ({
            usi: move,
            score: detailByRank.get(rank)?.score,
          }))
        );
      }
    } catch (error) {
      console.error('ヒントの取得に失敗しました', error);
      hintMessageEl.textContent = 'ヒントを取得できませんでした。';
    } finally {
      hintAnalyzing = false;
      if (renderTimer !== null) clearTimeout(renderTimer);
      if (renderFrame !== null) cancelAnimationFrame(renderFrame);
      engine.applyStrengthOptions({ multiPv: effectiveMoveRank.max });
      if (restoreStandardBook) engine.enablePreloadedBook();
      engineBusy = false;
      updateAssistButtons();
      updateDeclareWinButton();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && hintAnalyzing) hintStopRequested = true;
  });

  undoButton.addEventListener('click', () => {
    if (gameOver || engineBusy || !board.isHumanTurn()
      || undoUsed >= assistLimits.undo) return;
    const snapshot = turnHistory.undo();
    if (!snapshot) return;
    undoUsed += 1;
    if ((playerSave.item_counts.undo_ticket || 0) > 0) {
      playerSave = persistPlayerSave({
        ...playerSave,
        item_counts: {
          ...playerSave.item_counts,
          undo_ticket: playerSave.item_counts.undo_ticket - 1,
        },
      });
    }
    moveHistory.length = snapshot.moveHistoryLength;
    repetitionTracker.truncate(snapshot.repetitionLength);
    board.restoreSfen(snapshot.sfen);
    shogiMatchBoard?.setRecommendedMoves();
    shogiMatchBoard?.setLastMove();
    setYakobihimeSpeech(options.formationCallouts.undo_speech);
    hintMessageEl.textContent = '';
    setStatus('待ったを使いました。指し直してください。');
    updateDeclareWinButton();
    updateAssistButtons();
  });

  async function onHumanMove(usiMove) {
    if (gameOver) return;
    if (hintAnalyzing) {
      hintStopRequested = true;
      shogiMatchBoard?.setRecommendedMoves();
      hintMessageEl.textContent = '着手したため解析を終了しています...';
      while (hintAnalyzing) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }
    engineBusy = true;
    shogiMatchBoard?.setRecommendedMoves();
    hintMessageEl.textContent = '';
    declareWinButton.disabled = true;
    updateAssistButtons();
    moveHistory.push(usiMove);
    announceDetectedFormation();

    if (finishByRepetition(repetitionTracker.record(
      board.toSfen(), Color.Black, board.isCheck(Color.White)
    ))) return;

    // 人間の指し手でエンジン側(後手)が詰み・打つ手なしになっていないか確認する
    if (!board.hasLegalMoves(Color.White)) {
      finishMatch({
        outcome: 'win',
        reason: 'checkmate',
        status: '相手を詰ませました。',
        message: 'あなたの勝利です（詰み）。',
      });
      return;
    }

    setStatus('エンジン思考中...');
    const moves = moveHistory.length ? ' moves ' + moveHistory.join(' ') : '';
    engine.setPosition((enemy.start_sfen_override || formation.start_sfen) + moves);
    const openingDecision = getEnemyOpeningDecision(
      openingBook, board.toSfen(), moveHistory
    );
    if (openingDecision.status === 'active') {
      setStatus(`${enemy.name}が${openingBook.name}を組んでいます...`);
    } else if (openingDecision.status === 'constrained') {
      setStatus(`${enemy.name}が${openingBook.name}の形を保っています...`);
    }
    const searchResult = await engine.go({
      nodes: varyNodeLimit(effectiveNodeLimit, difficulty.node_limit_stddev_ratio),
      maxTimeMs: enemy.max_think_time_ms,
      searchMoves: ['active', 'constrained'].includes(openingDecision.status)
        ? openingDecision.moves
        : undefined,
    });
    const { move } = selectMoveByRank(searchResult, effectiveMoveRank);

    if (move === 'resign') {
      finishMatch({
        outcome: 'win',
        reason: 'resignation',
        status: 'エンジンが投了しました。勝利！',
        message: 'エンジンの投了によりあなたの勝利です。',
      });
      return;
    }
    if (move === 'win') {
      finishMatch({
        outcome: 'loss',
        reason: 'entering_king',
        status: '相手の入玉宣言が成立しました。',
        message: '相手の入玉宣言によりあなたの敗北です。',
      });
      return;
    }

    moveHistory.push(move);
    board.applyUsiMove(move);
    shogiMatchBoard?.setLastMove(move);
    announceDetectedFormation();

    if (finishByRepetition(repetitionTracker.record(
      board.toSfen(), Color.White, board.isCheck(Color.Black)
    ))) return;

    // エンジンの指し手で人間(先手)が詰み・打つ手なしになっていないか確認する
    if (!board.hasLegalMoves(Color.Black)) {
      finishMatch({
        outcome: 'loss',
        reason: 'checkmate',
        status: 'あなたは詰まされました。',
        message: 'あなたの敗北です（詰み）。',
      });
      return;
    }

    engineBusy = false;
    turnHistory.record({
      sfen: board.toSfen(),
      moveHistoryLength: moveHistory.length,
      repetitionLength: repetitionTracker.length,
    });
    updateDeclareWinButton();
    updateAssistButtons();
    const skillLabel = equippedItem ? `／${equippedItem.name}` : '';
    setStatus(`${enemy.name}／${formation.name}／${difficulty.name}${skillLabel}${bookLabel}：あなたの番です`);
  }

  updateDeclareWinButton();
  updateAssistButtons();
  const skillLabel = equippedItem ? `／${equippedItem.name}` : '';
  setStatus(`${enemy.name}／${formation.name}／${difficulty.name}${skillLabel}${bookLabel}：あなたの番です（先手）`);
}

main().catch((e) => {
  console.error(e);
  setStatus('エラーが発生しました: ' + e.message);
  setLoading(
    '読み込みに失敗しました。通信状況を確認して「再試行」を押してください。' +
    `（${e.message}）`
  );
  loadingSpinner.hidden = true;
  loadingRetryButton.hidden = false;
});
