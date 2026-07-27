/**
 * src/board-ui/board.js
 *
 * 盤面表示・駒移動UI。
 *
 * ルール判定(合法手・成り・持ち駒・王手/詰み)は shogi.js (na2hiro/Shogi.js, MIT)
 * に委譲する。盤面の見た目(SVG描画)はこのファイルで自作する。
 *
 * 注意: shogi.js は開発時に `npm install shogi.js` した上で、ビルド済みモジュールを
 * このファイルと同じ vendor/ ディレクトリにコピーして使う想定（README参照）。
 * 実装するにあたっては、使用するバージョンのAPI仕様を
 * https://github.com/na2hiro/Kifu-for-JS/tree/master/packages/shogi.js の
 * TypeDocドキュメント・testディレクトリで必ず確認すること
 * （move/drop/getMovesFromの引数順、座標系(x:筋 1-9, y:段 1-9)等）。
 */

// shogi.js(cjs)をesbuildでESM単一ファイルにバンドルしたもの。
// 名前付きexportは持たないため、default importしてから分割代入する。
// 駒種(Kind)は実行時にはただの文字列("FU","NY","NK","NG"等)であり、
// TypeScriptの型としてのみ存在するため実行時オブジェクトとしてimportできない。
import shogiLib from './vendor/shogi.esm.js';
import {
  BOARD_PIECE_POINTS,
  BOARD_THEME,
  HAND_PIECE_POINTS,
  isPromotedKind,
  summarizeHand,
} from './board-theme.mjs';
import { isLegalDrop, isLegalMove } from './legal-moves.mjs';
import { getLegalDestinations, toggleHandSelection } from './selection-highlights.mjs';
const { Shogi, Color, Piece, kindToString } = shogiLib;
export { Color };

const BOARD_SIZE = 9;
const CELL = 56; // px相当のSVG座標単位
const MARGIN = 40;
const SVG_NS = 'http://www.w3.org/2000/svg';

// USIの打ち駒表記(P/L/N/S/G/B/R)とshogi.jsのkind文字列("FU"等)の対応表
const KIND_TO_USI = { FU: 'P', KY: 'L', KE: 'N', GI: 'S', KI: 'G', KA: 'B', HI: 'R' };
const USI_TO_KIND = { P: 'FU', L: 'KY', N: 'KE', S: 'GI', G: 'KI', B: 'KA', R: 'HI' };

function parseSquare(file, rank) {
  return {
    x: Number(file),
    y: rank.charCodeAt(0) - 'a'.charCodeAt(0) + 1,
  };
}

export function parseUsiMove(usiMove) {
  const move = /^([1-9])([a-i])([1-9])([a-i])(\+)?$/.exec(usiMove);
  if (move) {
    return {
      from: parseSquare(move[1], move[2]),
      to: parseSquare(move[3], move[4]),
      kind: null,
      promote: Boolean(move[5]),
    };
  }
  const drop = /^([PLNSGBR])\*([1-9])([a-i])$/.exec(usiMove);
  if (drop) {
    return {
      from: null,
      to: parseSquare(drop[2], drop[3]),
      kind: USI_TO_KIND[drop[1]],
      promote: false,
    };
  }
  throw new Error(`不正なUSI指し手です: ${usiMove}`);
}

export class BoardView {
  /**
   * @param {HTMLElement} container
   * @param {{ onMove?: (usiMove: string) => void, startSfen?: string }} [callbacks]
   */
  constructor(container, callbacks = {}) {
    this.container = container;
    this.onMove = callbacks.onMove || (() => {});
    this.shogi = new Shogi();
    if (callbacks.startSfen) {
      this.shogi.initializeFromSFENString(callbacks.startSfen);
    }
    this.selected = null; // { x, y } または { hand: { color, kind } }
    this.lastEnemyMove = null; // { from: { x, y } | null, to: { x, y } }
    this.humanColor = Color.Black; // M1では人間=先手固定
    this.locked = false; // 対局終了後の入力を無効化する
    this._awaitingPromotion = false; // 成り/不成り選択ダイアログの表示中は入力を無視する
    this._buildSvg();
    this.render();
  }

  _buildSvg() {
    const width = MARGIN * 2 + CELL * BOARD_SIZE;
    const height = MARGIN * 2 + CELL * BOARD_SIZE + 80; // 上下の持ち駒表示分
    this.svg = document.createElementNS(SVG_NS, 'svg');
    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    this.svg.setAttribute('width', '100%');
    this.svg.setAttribute('role', 'img');
    this.svg.setAttribute('aria-label', '将棋盤');
    this.svg.classList.add('shogi-board');
    this.container.appendChild(this.svg);
  }

  /** 現局面をSVGへ再描画する */
  render() {
    while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);
    this._drawDefinitions();
    this._drawGrid();
    this._drawEnemyMoveHighlights();
    this._drawSelectionHighlights();
    this._drawPieces();
    this._drawHands();
  }

  _drawGrid() {
    const boardTop = MARGIN + 40;
    const boardLength = CELL * BOARD_SIZE;
    const frame = document.createElementNS(SVG_NS, 'rect');
    frame.setAttribute('x', MARGIN - 9);
    frame.setAttribute('y', boardTop - 9);
    frame.setAttribute('width', boardLength + 18);
    frame.setAttribute('height', boardLength + 18);
    frame.setAttribute('rx', '3');
    frame.setAttribute('fill', `url(#board-wood)`);
    frame.setAttribute('stroke', BOARD_THEME.boardEdge);
    frame.setAttribute('stroke-width', '6');
    frame.setAttribute('filter', 'url(#board-shadow)');
    this.svg.appendChild(frame);

    for (let i = 0; i <= BOARD_SIZE; i++) {
      const line1 = this._line(
        MARGIN + i * CELL, boardTop,
        MARGIN + i * CELL, boardTop + boardLength,
        i === 0 || i === BOARD_SIZE ? 2.2 : 1
      );
      const line2 = this._line(
        MARGIN, boardTop + i * CELL,
        MARGIN + boardLength, boardTop + i * CELL,
        i === 0 || i === BOARD_SIZE ? 2.2 : 1
      );
      this.svg.appendChild(line1);
      this.svg.appendChild(line2);
    }
    this._drawCoordinates();
    this._drawStarPoints();
    this._drawCellHitboxes();
  }

  _drawDefinitions() {
    const defs = document.createElementNS(SVG_NS, 'defs');
    defs.innerHTML = `
      <linearGradient id="board-wood" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${BOARD_THEME.boardLight}"/>
        <stop offset="0.5" stop-color="#dca45a"/>
        <stop offset="1" stop-color="${BOARD_THEME.boardDark}"/>
      </linearGradient>
      <linearGradient id="piece-wood" x1="0" y1="0" x2="0.85" y2="1">
        <stop offset="0" stop-color="${BOARD_THEME.pieceLight}"/>
        <stop offset="1" stop-color="${BOARD_THEME.pieceDark}"/>
      </linearGradient>
      <linearGradient id="piece-selected" x1="0" y1="0" x2="0.85" y2="1">
        <stop offset="0" stop-color="${BOARD_THEME.selectedLight}"/>
        <stop offset="1" stop-color="${BOARD_THEME.selectedDark}"/>
      </linearGradient>
      <filter id="board-shadow" x="-15%" y="-15%" width="130%" height="130%">
        <feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#000" flood-opacity="0.42"/>
      </filter>
      <filter id="piece-shadow" x="-25%" y="-25%" width="150%" height="150%">
        <feDropShadow dx="0" dy="2" stdDeviation="1.4" flood-color="#2f1808" flood-opacity="0.48"/>
      </filter>`;
    this.svg.appendChild(defs);
  }

  _drawCoordinates() {
    const ranks = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
    for (let i = 0; i < BOARD_SIZE; i++) {
      const file = document.createElementNS(SVG_NS, 'text');
      file.setAttribute('x', MARGIN + i * CELL + CELL / 2);
      file.setAttribute('y', MARGIN + 27);
      file.setAttribute('class', 'board-coordinate');
      file.textContent = String(BOARD_SIZE - i);
      this.svg.appendChild(file);

      const rank = document.createElementNS(SVG_NS, 'text');
      rank.setAttribute('x', MARGIN + CELL * BOARD_SIZE + 20);
      rank.setAttribute('y', MARGIN + 40 + i * CELL + CELL / 2 + 5);
      rank.setAttribute('class', 'board-coordinate');
      rank.textContent = ranks[i];
      this.svg.appendChild(rank);
    }
  }

  _drawStarPoints() {
    for (const col of [3, 6]) {
      for (const row of [3, 6]) {
        const point = document.createElementNS(SVG_NS, 'circle');
        point.setAttribute('cx', MARGIN + col * CELL);
        point.setAttribute('cy', MARGIN + 40 + row * CELL);
        point.setAttribute('r', '3.2');
        point.setAttribute('fill', BOARD_THEME.grid);
        this.svg.appendChild(point);
      }
    }
  }

  /**
   * 全81マスに透明なクリック領域を敷く。駒の有無に関わらずクリックを拾う必要があるため
   * （移動先が空きマスの場合、駒側のクリックハンドラだけでは着手を検知できない）。
   */
  _drawCellHitboxes() {
    for (let x = 1; x <= BOARD_SIZE; x++) {
      for (let y = 1; y <= BOARD_SIZE; y++) {
        const { cx, cy } = this._cellCenter(x, y);
        const rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('x', cx - CELL / 2);
        rect.setAttribute('y', cy - CELL / 2);
        rect.setAttribute('width', CELL);
        rect.setAttribute('height', CELL);
        rect.setAttribute('fill', 'transparent');
        rect.classList.add('board-cell-hitbox');
        rect.dataset.square = this._squareName(x, y);
        rect.style.cursor = 'pointer';
        rect.addEventListener('click', () => this._handleCellClick(x, y));
        this.svg.appendChild(rect);
      }
    }
  }

  _line(x1, y1, x2, y2, width = 1) {
    const el = document.createElementNS(SVG_NS, 'line');
    el.setAttribute('x1', x1); el.setAttribute('y1', y1);
    el.setAttribute('x2', x2); el.setAttribute('y2', y2);
    el.setAttribute('stroke', BOARD_THEME.grid);
    el.setAttribute('stroke-width', String(width));
    return el;
  }

  /** 盤上マス(x:1-9筋, y:1-9段)の中心座標(SVG座標)を返す */
  _cellCenter(x, y) {
    // x=9が左端(1筋)になるよう反転して描画する
    const col = BOARD_SIZE - x;
    const row = y - 1;
    return {
      cx: MARGIN + col * CELL + CELL / 2,
      cy: MARGIN + 40 + row * CELL + CELL / 2,
    };
  }

  _drawPieces() {
    for (let x = 1; x <= BOARD_SIZE; x++) {
      for (let y = 1; y <= BOARD_SIZE; y++) {
        const piece = this.shogi.get(x, y); // shogi.board は0-indexedのため公開APIのget(x,y)(1-indexed)を使う
        if (!piece) continue;
        this._drawPieceAt(x, y, piece);
      }
    }
  }

  _drawPieceAt(x, y, piece) {
    const isSelected =
      this.selected && !this.selected.hand &&
      this.selected.x === x && this.selected.y === y;
    const { cx, cy } = this._cellCenter(x, y);
    const g = document.createElementNS(SVG_NS, 'g');
    g.classList.add('board-piece');
    if (isSelected) g.classList.add('selected-piece');
    g.dataset.square = this._squareName(x, y);
    g.setAttribute('transform', `translate(${cx},${cy})${piece.color === Color.White ? ' rotate(180)' : ''}`);
    g.style.cursor = 'pointer';
    g.addEventListener('click', () => this._handleCellClick(x, y));

    const shape = document.createElementNS(SVG_NS, 'polygon');
    shape.setAttribute('points', BOARD_PIECE_POINTS);
    shape.setAttribute('fill', isSelected ? 'url(#piece-selected)' : 'url(#piece-wood)');
    shape.setAttribute('stroke', isSelected ? BOARD_THEME.selectedEdge : BOARD_THEME.pieceEdge);
    shape.setAttribute('stroke-width', isSelected ? '3' : '1.5');
    shape.setAttribute('filter', 'url(#piece-shadow)');
    g.appendChild(shape);

    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('x', '0'); text.setAttribute('y', '8');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-size', '21');
    text.setAttribute('font-weight', '700');
    text.setAttribute('font-family', 'Yu Mincho, Hiragino Mincho ProN, serif');
    text.setAttribute('fill', isPromotedKind(piece.kind)
      ? BOARD_THEME.promotedText : BOARD_THEME.text);
    text.textContent = kindToString(piece.kind) || '?';
    g.appendChild(text);

    this.svg.appendChild(g);
  }

  _drawHands() {
    // 持ち駒表示。駒種ごとに個別のSVG要素として描画し、クリックで選択→
    // 着手先マスをクリックの2段階操作で打てるようにする。
    [Color.Black, Color.White].forEach((color, i) => {
      const hand = this.shogi.hands[color] || [];
      const y = i === 0 ? MARGIN + 40 + CELL * BOARD_SIZE + 20 : 20;

      const label = document.createElementNS(SVG_NS, 'text');
      label.setAttribute('x', MARGIN);
      label.setAttribute('y', y);
      label.setAttribute('font-size', '14');
      label.setAttribute('class', 'hand-label');
      label.textContent = `${color === Color.Black ? '先手' : '後手'}持ち駒:${hand.length ? '' : '（なし）'}`;
      this.svg.appendChild(label);

      summarizeHand(hand).forEach(({ kind, count }, index) => {
        const hx = MARGIN + 102 + index * 52;
        this._drawHandPiece(color, kind, count, hx, y - 6);
      });
    });
  }

  _drawHandPiece(color, kind, count, cx, cy) {
    const isSelected =
      this.selected && this.selected.hand &&
      this.selected.hand.color === color && this.selected.hand.kind === kind;
    const selectable = !this.locked && color === this.humanColor;

    const g = document.createElementNS(SVG_NS, 'g');
    g.classList.add('hand-piece');
    if (isSelected) g.classList.add('selected-piece');
    g.dataset.kind = kind;
    g.dataset.count = String(count);
    g.setAttribute('transform', `translate(${cx},${cy})`);
    g.style.cursor = selectable ? 'pointer' : 'default';

    const shape = document.createElementNS(SVG_NS, 'polygon');
    shape.setAttribute('points', HAND_PIECE_POINTS);
    shape.setAttribute('fill', isSelected ? 'url(#piece-selected)' : 'url(#piece-wood)');
    shape.setAttribute('stroke', isSelected ? BOARD_THEME.selectedEdge : BOARD_THEME.pieceEdge);
    shape.setAttribute('stroke-width', isSelected ? '3' : '1.2');
    shape.setAttribute('filter', 'url(#piece-shadow)');
    g.appendChild(shape);

    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('x', '0'); text.setAttribute('y', '5');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-size', '13');
    text.setAttribute('font-weight', '700');
    text.setAttribute('font-family', 'Yu Mincho, Hiragino Mincho ProN, serif');
    text.setAttribute('fill', BOARD_THEME.text);
    text.textContent = kindToString(kind) || '?';
    g.appendChild(text);

    if (count > 1) {
      const countText = document.createElementNS(SVG_NS, 'text');
      countText.setAttribute('x', '18');
      countText.setAttribute('y', '10');
      countText.setAttribute('class', 'hand-piece-count');
      countText.textContent = `×${count}`;
      g.appendChild(countText);
    }

    if (selectable) {
      g.addEventListener('click', () => {
        if (this.locked || this._awaitingPromotion) return;
        if (this.shogi.turn !== this.humanColor) return;
        this.selected = toggleHandSelection(this.selected, color, kind);
        this.render();
      });
    }

    this.svg.appendChild(g);
  }

  _drawSelectionHighlights() {
    if (!this.selected || this.locked || this.shogi.turn !== this.humanColor) return;

    if (!this.selected.hand) {
      this._drawSquareHighlight(
        this.selected.x, this.selected.y, 'selected-square', '#2563eb', 0.38
      );
    }

    const destinations = getLegalDestinations(
      this.shogi, Shogi, this.selected, this.humanColor
    );
    destinations.forEach(({ x, y }) => {
      this._drawSquareHighlight(x, y, 'legal-destination', '#22c55e', 0.42);
    });
  }

  _drawEnemyMoveHighlights() {
    if (!this.lastEnemyMove) return;
    if (this.lastEnemyMove.from) {
      this._drawSquareHighlight(
        this.lastEnemyMove.from.x,
        this.lastEnemyMove.from.y,
        'last-enemy-move-from',
        BOARD_THEME.lastMoveFrom,
        0.3,
      );
    }
    this._drawSquareHighlight(
      this.lastEnemyMove.to.x,
      this.lastEnemyMove.to.y,
      'last-enemy-move-to',
      BOARD_THEME.lastMoveTo,
      0.46,
    );
  }

  _drawSquareHighlight(x, y, className, color, opacity) {
    const { cx, cy } = this._cellCenter(x, y);
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.classList.add(className);
    rect.dataset.square = this._squareName(x, y);
    rect.setAttribute('x', cx - CELL / 2 + 2);
    rect.setAttribute('y', cy - CELL / 2 + 2);
    rect.setAttribute('width', CELL - 4);
    rect.setAttribute('height', CELL - 4);
    rect.setAttribute('rx', '6');
    rect.setAttribute('fill', color);
    rect.setAttribute('fill-opacity', String(opacity));
    rect.setAttribute('stroke', color);
    rect.setAttribute('stroke-width', '3');
    rect.setAttribute('pointer-events', 'none');
    this.svg.appendChild(rect);
  }

  _squareName(x, y) {
    return `${x}${String.fromCharCode('a'.charCodeAt(0) + y - 1)}`;
  }

  /** 対局終了後に盤面クリックを無効化する */
  lock() {
    this.locked = true;
  }

  /** 待ったで保存済みの局面へ戻し、選択状態と敵の直前手表示も解除する。 */
  restoreSfen(sfen) {
    this.shogi.initializeFromSFENString(sfen);
    this.selected = null;
    this.lastEnemyMove = null;
    this._awaitingPromotion = false;
    this.render();
  }

  isHumanTurn() {
    return !this.locked && this.shogi.turn === this.humanColor;
  }

  _handleCellClick(x, y) {
    if (this.locked || this._awaitingPromotion) return;
    if (this.shogi.turn !== this.humanColor) return; // 自分の手番以外は無視

    if (this.selected && this.selected.hand) {
      this._tryDrop(this.selected.hand.color, this.selected.hand.kind, x, y);
      this.selected = null;
      this.render();
      return;
    }

    if (!this.selected) {
      const piece = this.shogi.get(x, y);
      if (piece && piece.color === this.humanColor) {
        this.selected = { x, y };
        this.render();
      }
      return;
    }

    this._tryMove(this.selected.x, this.selected.y, x, y);
    this.selected = null;
    this.render();
  }

  async _tryMove(fromX, fromY, toX, toY) {
    const moves = this.shogi.getMovesFrom(fromX, fromY);
    const candidate = moves.find((m) => m.to.x === toX && m.to.y === toY);
    if (!candidate) return; // 合法手でない

    const piece = this.shogi.get(fromX, fromY);
    let promote = false;
    if (Piece.canPromote(piece.kind)) {
      // 「行き所のない駒」（例: 最終段の歩・香、最終2段の桂）は不成りを選べず必ず成る
      // （shogi.js の move() 内部と同じ判定基準、Shogi.getIllegalUnpromotedRow/getRowToOppositeEnd参照）
      const forcedPromotion =
        Shogi.getIllegalUnpromotedRow(piece.kind) >= Shogi.getRowToOppositeEnd(toY, piece.color);
      if (forcedPromotion) {
        promote = true;
      } else if (this._canChoosePromote(fromX, fromY, toX, toY)) {
        this._awaitingPromotion = true;
        promote = await this._promptPromotion();
        this._awaitingPromotion = false;
      }
    }

    // getMovesFrom()は王手放置を除外しないため、複製盤面で着手後の自玉を確認する。
    if (!isLegalMove(
      this.shogi, Shogi, fromX, fromY, toX, toY, promote, this.humanColor
    )) return;

    this.shogi.move(fromX, fromY, toX, toY, promote);
    this.render();
    this.onMove(this._toUsiMove(fromX, fromY, toX, toY, promote));
  }

  /**
   * 成り／不成りの選択ダイアログを表示し、選択結果(boolean)を返す。
   * containerに重ねてオーバーレイDOMを直接構築する（BoardViewの見た目の一部として自己完結させる）。
   */
  _promptPromotion() {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.style.cssText =
        'position:absolute; inset:0; background:rgba(0,0,0,0.6); ' +
        'display:flex; align-items:center; justify-content:center; z-index:10;';

      const dialog = document.createElement('div');
      dialog.style.cssText =
        'background:#333; color:#eee; padding:16px 24px; border-radius:8px; text-align:center;';
      dialog.innerHTML = '<p style="margin:0 0 12px;">成りますか？</p>';

      const makeButton = (label, value) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.style.cssText = 'margin:0 8px; padding:6px 16px;';
        button.addEventListener('click', () => {
          overlay.remove();
          resolve(value);
        });
        return button;
      };

      dialog.appendChild(makeButton('成る', true));
      dialog.appendChild(makeButton('成らない', false));
      overlay.appendChild(dialog);

      if (getComputedStyle(this.container).position === 'static') {
        this.container.style.position = 'relative';
      }
      this.container.appendChild(overlay);
    });
  }

  async _tryDrop(color, kind, x, y) {
    if (color !== this.humanColor) return;
    if (!isLegalDrop(this.shogi, Shogi, x, y, kind, color)) return;
    try {
      this.shogi.drop(x, y, kind);
      this.render();
      this.onMove(this._toUsiDrop(kind, x, y));
    } catch (e) {
      console.warn('打てないマスです', e);
    }
  }

  _canChoosePromote(fromX, fromY, toX, toY) {
    // 成れるかどうかの簡易判定は shogi.js 側の候補手情報(promote可否)に委ねるべきだが、
    // M1最小構成では「相手陣に入る/出る動きなら確認ダイアログを出す」程度の簡略実装とする。
    const enemyZone = (y) => (this.humanColor === Color.Black ? y <= 3 : y >= 7);
    return enemyZone(fromY) || enemyZone(toY);
  }

  _toUsiMove(fromX, fromY, toX, toY, promote) {
    const file = (x) => String(x);
    const rank = (y) => String.fromCharCode('a'.charCodeAt(0) + y - 1);
    return `${file(fromX)}${rank(fromY)}${file(toX)}${rank(toY)}${promote ? '+' : ''}`;
  }

  _toUsiDrop(kind, x, y) {
    const rank = (y) => String.fromCharCode('a'.charCodeAt(0) + y - 1);
    return `${KIND_TO_USI[kind]}*${x}${rank(y)}`;
  }

  /** エンジンから返されたUSI形式の指し手をこちらの盤面にも反映する（敵の指し手適用用） */
  applyUsiMove(usiMove) {
    const parsed = parseUsiMove(usiMove);
    if (parsed.kind) {
      this.shogi.drop(parsed.to.x, parsed.to.y, parsed.kind);
    } else {
      this.shogi.move(
        parsed.from.x,
        parsed.from.y,
        parsed.to.x,
        parsed.to.y,
        parsed.promote,
      );
    }
    this.lastEnemyMove = { from: parsed.from, to: parsed.to };
    this.render();
  }

  toSfen() {
    return this.shogi.toSFENString(1); // TODO: 引数(手数)の扱いを要確認
  }

  isCheck(color) {
    return this.shogi.isCheck(color);
  }

  /**
   * colorに合法手が1つでもあるか判定する（詰み・持将棋判定用）。
   *
   * shogi.jsのgetMovesFrom/getDropsByは盤外・自駒取りのみ除外し、王手放置となる手を
   * 除外しない（クラスコメント「盤外，自分の駒取りは除外．二歩，王手放置などはチェックせず．」参照）。
   * そのため各候補手を一時的な盤面（SFEN経由で複製、本体には影響しない）に適用し、
   * 適用後もcolor側の玉が王手されたままかをisCheck()で確認して真の合法手のみを数える。
   */
  hasLegalMoves(color) {
    const sfen = this.shogi.toSFENString(1);

    for (let x = 1; x <= BOARD_SIZE; x++) {
      for (let y = 1; y <= BOARD_SIZE; y++) {
        const piece = this.shogi.get(x, y);
        if (!piece || piece.color !== color) continue;
        const moves = this.shogi.getMovesFrom(x, y);
        for (const move of moves) {
          if (this._staysLegalAfterMove(sfen, x, y, move.to.x, move.to.y, color)) {
            return true;
          }
        }
      }
    }

    const drops = this.shogi.getDropsBy(color);
    for (const drop of drops) {
      if (this._staysLegalAfterDrop(sfen, drop.to.x, drop.to.y, drop.kind, color)) {
        return true;
      }
    }

    return false;
  }

  _staysLegalAfterMove(sfen, fromX, fromY, toX, toY, color) {
    const temp = new Shogi();
    temp.initializeFromSFENString(sfen);
    return isLegalMove(temp, Shogi, fromX, fromY, toX, toY, false, color);
  }

  _staysLegalAfterDrop(sfen, x, y, kind, color) {
    const temp = new Shogi();
    temp.initializeFromSFENString(sfen);
    return isLegalDrop(temp, Shogi, x, y, kind, color);
  }
}
