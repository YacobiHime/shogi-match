var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};

// node_modules/shogi.js/cjs/Color.js
var require_Color = __commonJS({
  "node_modules/shogi.js/cjs/Color.js"(exports) {
    "use strict";
    exports.__esModule = true;
    exports.colorToString = void 0;
    var Color;
    (function(Color2) {
      Color2[Color2["Black"] = 0] = "Black";
      Color2[Color2["White"] = 1] = "White";
    })(Color || (Color = {}));
    exports["default"] = Color;
    function colorToString(color) {
      switch (color) {
        case Color.Black:
          return "\u5148\u624B";
        case Color.White:
          return "\u5F8C\u624B";
      }
    }
    exports.colorToString = colorToString;
  }
});

// node_modules/shogi.js/cjs/Kind.js
var require_Kind = __commonJS({
  "node_modules/shogi.js/cjs/Kind.js"(exports) {
    "use strict";
    exports.__esModule = true;
    exports.isRawKind = exports.kindToString = exports.values = void 0;
    var KindEnum;
    (function(KindEnum2) {
      KindEnum2[KindEnum2["FU"] = 0] = "FU";
      KindEnum2[KindEnum2["KY"] = 1] = "KY";
      KindEnum2[KindEnum2["KE"] = 2] = "KE";
      KindEnum2[KindEnum2["GI"] = 3] = "GI";
      KindEnum2[KindEnum2["KI"] = 4] = "KI";
      KindEnum2[KindEnum2["KA"] = 5] = "KA";
      KindEnum2[KindEnum2["HI"] = 6] = "HI";
      KindEnum2[KindEnum2["OU"] = 7] = "OU";
      KindEnum2[KindEnum2["TO"] = 8] = "TO";
      KindEnum2[KindEnum2["NY"] = 9] = "NY";
      KindEnum2[KindEnum2["NK"] = 10] = "NK";
      KindEnum2[KindEnum2["NG"] = 11] = "NG";
      KindEnum2[KindEnum2["UM"] = 12] = "UM";
      KindEnum2[KindEnum2["RY"] = 13] = "RY";
    })(KindEnum || (KindEnum = {}));
    var rawKinds = ["FU", "KY", "KE", "GI", "KI", "KA", "HI"];
    exports.values = Object.keys(KindEnum).filter(function(k) {
      return Number.isNaN(parseInt(k));
    });
    function kindToString(kind, short) {
      if (short === void 0) {
        short = false;
      }
      return {
        FU: "\u6B69",
        KY: "\u9999",
        KE: "\u6842",
        GI: "\u9280",
        KI: "\u91D1",
        KA: "\u89D2",
        HI: "\u98DB",
        OU: "\u7389",
        TO: "\u3068",
        NY: short ? "\u674F" : "\u6210\u9999",
        NK: short ? "\u572D" : "\u6210\u6842",
        NG: short ? "\u5168" : "\u6210\u9280",
        UM: "\u99AC",
        RY: "\u9F8D"
      }[kind];
    }
    exports.kindToString = kindToString;
    function isRawKind(kind) {
      return rawKinds.indexOf(kind) >= 0;
    }
    exports.isRawKind = isRawKind;
  }
});

// node_modules/shogi.js/cjs/moveDefinitions.js
var require_moveDefinitions = __commonJS({
  "node_modules/shogi.js/cjs/moveDefinitions.js"(exports) {
    "use strict";
    exports.__esModule = true;
    exports.getMoveDefinitions = void 0;
    var F = [0, -1];
    var B = [0, 1];
    var L = [1, 0];
    var R = [-1, 0];
    var FR = [-1, -1];
    var FL = [1, -1];
    var BR = [-1, 1];
    var BL = [1, 1];
    var kin = { just: [FR, F, FL, R, L, B] };
    var MOVE_DEF = {
      FU: { just: [F] },
      KY: { fly: [F] },
      KE: {
        just: [
          [-1, -2],
          [1, -2]
        ]
      },
      GI: { just: [FR, F, FL, BR, BL] },
      KI: kin,
      TO: kin,
      NY: kin,
      NK: kin,
      NG: kin,
      KA: { fly: [FR, FL, BR, BL] },
      HI: { fly: [F, R, L, B] },
      OU: { just: [FR, F, FL, R, L, BR, B, BL] },
      UM: { fly: [FR, FL, BR, BL], just: [F, R, L, B] },
      RY: { fly: [F, R, L, B], just: [FR, FL, BR, BL] }
    };
    function getMoveDefinitions(kind) {
      return MOVE_DEF[kind];
    }
    exports.getMoveDefinitions = getMoveDefinitions;
  }
});

// node_modules/shogi.js/cjs/Piece.js
var require_Piece = __commonJS({
  "node_modules/shogi.js/cjs/Piece.js"(exports) {
    "use strict";
    exports.__esModule = true;
    var Color_1 = require_Color();
    var Piece = (
      /** @class */
      (function() {
        function Piece2(csa) {
          this.color = csa.slice(0, 1) === "+" ? Color_1["default"].Black : Color_1["default"].White;
          this.kind = csa.slice(1);
        }
        Piece2.promote = function(kind) {
          return {
            FU: "TO",
            KY: "NY",
            KE: "NK",
            GI: "NG",
            KA: "UM",
            HI: "RY"
          }[kind] || kind;
        };
        Piece2.unpromote = function(kind) {
          return {
            TO: "FU",
            NY: "KY",
            NK: "KE",
            NG: "GI",
            KI: "KI",
            UM: "KA",
            RY: "HI",
            OU: "OU"
          }[kind] || kind;
        };
        Piece2.canPromote = function(kind) {
          return Piece2.promote(kind) !== kind;
        };
        Piece2.isPromoted = function(kind) {
          return ["TO", "NY", "NK", "NG", "UM", "RY"].indexOf(kind) >= 0;
        };
        Piece2.oppositeColor = function(color) {
          return color === Color_1["default"].Black ? Color_1["default"].White : Color_1["default"].Black;
        };
        Piece2.fromSFENString = function(sfen) {
          var promoted = sfen[0] === "+";
          if (promoted) {
            sfen = sfen.slice(1);
          }
          var color = sfen.match(/[A-Z]/) ? "+" : "-";
          var kind = {
            P: "FU",
            L: "KY",
            N: "KE",
            S: "GI",
            G: "KI",
            B: "KA",
            R: "HI",
            K: "OU"
          }[sfen.toUpperCase()];
          var piece = new Piece2(color + kind);
          if (promoted) {
            piece.promote();
          }
          return piece;
        };
        Piece2.prototype.promote = function() {
          this.kind = Piece2.promote(this.kind);
        };
        Piece2.prototype.unpromote = function() {
          this.kind = Piece2.unpromote(this.kind);
        };
        Piece2.prototype.inverse = function() {
          this.color = this.color === Color_1["default"].Black ? Color_1["default"].White : Color_1["default"].Black;
        };
        Piece2.prototype.toCSAString = function() {
          return (this.color === Color_1["default"].Black ? "+" : "-") + this.kind;
        };
        Piece2.prototype.toSFENString = function() {
          var sfenPiece = {
            FU: "P",
            KY: "L",
            KE: "N",
            GI: "S",
            KI: "G",
            KA: "B",
            HI: "R",
            OU: "K"
          }[Piece2.unpromote(this.kind)];
          return (Piece2.isPromoted(this.kind) ? "+" : "") + (this.color === Color_1["default"].Black ? sfenPiece : sfenPiece.toLowerCase());
        };
        return Piece2;
      })()
    );
    exports["default"] = Piece;
  }
});

// node_modules/shogi.js/cjs/polyfills.js
var require_polyfills = __commonJS({
  "node_modules/shogi.js/cjs/polyfills.js"(exports) {
    "use strict";
    exports.__esModule = true;
    if (!Array.prototype.some) {
      Array.prototype.some = function(fun) {
        "use strict";
        if (this == null) {
          throw new TypeError();
        }
        var t = Object(this), len = t.length >>> 0;
        if (typeof fun != "function") {
          throw new TypeError();
        }
        var thisp = arguments[1];
        for (var i = 0; i < len; i++) {
          if (i in t && fun.call(thisp, t[i], i, t)) {
            return true;
          }
        }
        return false;
      };
    }
  }
});

// node_modules/shogi.js/cjs/presets.js
var require_presets = __commonJS({
  "node_modules/shogi.js/cjs/presets.js"(exports) {
    "use strict";
    exports.__esModule = true;
    exports.pieceHistogram = exports.getInitialFromPreset = void 0;
    var Color_1 = require_Color();
    var EMPTY = " *  *  *  *  *  *  *  *  * ";
    var BOARD3_9 = [
      "-FU-FU-FU-FU-FU-FU-FU-FU-FU",
      EMPTY,
      EMPTY,
      EMPTY,
      "+FU+FU+FU+FU+FU+FU+FU+FU+FU",
      " * +KA *  *  *  *  * +HI * ",
      "+KY+KE+GI+KI+OU+KI+GI+KE+KY"
    ];
    var BOARD2_9 = [EMPTY].concat(BOARD3_9);
    var presetDefinitions = {
      HIRATE: {
        board: ["-KY-KE-GI-KI-OU-KI-GI-KE-KY", " * -HI *  *  *  *  * -KA * "].concat(BOARD3_9),
        turn: Color_1["default"].Black
      },
      KY: {
        board: ["-KY-KE-GI-KI-OU-KI-GI-KE * ", " * -HI *  *  *  *  * -KA * "].concat(BOARD3_9),
        turn: Color_1["default"].White
      },
      KY_R: {
        board: [" * -KE-GI-KI-OU-KI-GI-KE-KY", " * -HI *  *  *  *  * -KA * "].concat(BOARD3_9),
        turn: Color_1["default"].White
      },
      KA: {
        board: ["-KY-KE-GI-KI-OU-KI-GI-KE-KY", " * -HI *  *  *  *  *  *  * "].concat(BOARD3_9),
        turn: Color_1["default"].White
      },
      HI: {
        board: ["-KY-KE-GI-KI-OU-KI-GI-KE-KY", " *  *  *  *  *  *  * -KA * "].concat(BOARD3_9),
        turn: Color_1["default"].White
      },
      HIKY: {
        board: ["-KY-KE-GI-KI-OU-KI-GI-KE * ", " *  *  *  *  *  *  * -KA * "].concat(BOARD3_9),
        turn: Color_1["default"].White
      },
      "2": {
        board: ["-KY-KE-GI-KI-OU-KI-GI-KE-KY"].concat(BOARD2_9),
        turn: Color_1["default"].White
      },
      "3": {
        board: ["-KY-KE-GI-KI-OU-KI-GI-KE * "].concat(BOARD2_9),
        turn: Color_1["default"].White
      },
      "4": {
        board: [" * -KE-GI-KI-OU-KI-GI-KE * "].concat(BOARD2_9),
        turn: Color_1["default"].White
      },
      "5": {
        board: [" *  * -GI-KI-OU-KI-GI-KE * "].concat(BOARD2_9),
        turn: Color_1["default"].White
      },
      "5_L": {
        board: [" * -KE-GI-KI-OU-KI-GI *  * "].concat(BOARD2_9),
        turn: Color_1["default"].White
      },
      "6": {
        board: [" *  * -GI-KI-OU-KI-GI *  * "].concat(BOARD2_9),
        turn: Color_1["default"].White
      },
      "7_R": {
        board: [" *  *  * -KI-OU-KI-GI *  * "].concat(BOARD2_9),
        turn: Color_1["default"].White
      },
      "7_L": {
        board: [" *  * -GI-KI-OU-KI *  *  * "].concat(BOARD2_9),
        turn: Color_1["default"].White
      },
      "8": {
        board: [" *  *  * -KI-OU-KI *  *  * "].concat(BOARD2_9),
        turn: Color_1["default"].White
      },
      "10": {
        board: [" *  *  *  * -OU *  *  *  * "].concat(BOARD2_9),
        turn: Color_1["default"].White
      }
    };
    var getInitialFromPreset = function(preset) {
      var definition = presetDefinitions[preset];
      if (!definition) {
        throw new Error("Unknown preset: ".concat(preset));
      }
      return definition;
    };
    exports.getInitialFromPreset = getInitialFromPreset;
    var presets = Object.keys(presetDefinitions);
    exports["default"] = presets;
    exports.pieceHistogram = {
      FU: 18,
      KY: 4,
      KE: 4,
      GI: 4,
      KI: 4,
      KA: 2,
      HI: 2,
      OU: 2
    };
  }
});

// node_modules/shogi.js/cjs/Serialization.js
var require_Serialization = __commonJS({
  "node_modules/shogi.js/cjs/Serialization.js"(exports) {
    "use strict";
    exports.__esModule = true;
    exports.toSfen = exports.fromSfen = exports.toCSA = exports.fromPreset = void 0;
    var Color_1 = require_Color();
    var presets_1 = require_presets();
    var Piece_1 = require_Piece();
    function fromPreset(shogi, setting) {
      var board = [];
      var hands = [[], []];
      var turn;
      if (setting.preset !== "OTHER") {
        var initial = (0, presets_1.getInitialFromPreset)(setting.preset);
        for (var i = 0; i < 9; i++) {
          board[i] = [];
          for (var j = 0; j < 9; j++) {
            var csa = initial.board[j].slice(24 - i * 3, 24 - i * 3 + 3);
            board[i][j] = csa === " * " ? null : new Piece_1["default"](csa);
          }
        }
        turn = initial.turn;
      } else {
        for (var i = 0; i < 9; i++) {
          board[i] = [];
          for (var j = 0; j < 9; j++) {
            var p = setting.data.board[i][j];
            board[i][j] = p.kind ? new Piece_1["default"]((p.color === Color_1["default"].Black ? "+" : "-") + p.kind) : null;
          }
        }
        turn = setting.data.color;
        for (var c = 0; c < 2; c++) {
          for (var k in setting.data.hands[c]) {
            if (setting.data.hands[c].hasOwnProperty(k)) {
              var csa = (c === 0 ? "+" : "-") + k;
              for (var i = 0; i < setting.data.hands[c][k]; i++) {
                hands[c].push(new Piece_1["default"](csa));
              }
            }
          }
        }
      }
      shogi.board = board;
      shogi.turn = turn;
      shogi.hands = hands;
    }
    exports.fromPreset = fromPreset;
    function toCSA(shogi) {
      var ret = [];
      for (var y = 0; y < 9; y++) {
        var line = "P" + (y + 1);
        for (var x = 8; x >= 0; x--) {
          var piece = shogi.board[x][y];
          line += piece == null ? " * " : piece.toCSAString();
        }
        ret.push(line);
      }
      for (var i = 0; i < 2; i++) {
        var line = "P" + "+-"[i];
        for (var _i = 0, _a = shogi.hands[i]; _i < _a.length; _i++) {
          var hand = _a[_i];
          line += "00" + hand.kind;
        }
        ret.push(line);
      }
      ret.push(shogi.turn === Color_1["default"].Black ? "+" : "-");
      return ret.join("\n");
    }
    exports.toCSA = toCSA;
    function fromSfen(shogi, sfen) {
      var board = [];
      for (var i = 0; i < 9; i++) {
        board[i] = [];
        for (var j = 0; j < 9; j++) {
          board[i][j] = null;
        }
      }
      var segments = sfen.split(" ");
      if (segments[1] !== "w" && segments[1] !== "b")
        throw new Error("Invalid SFEN");
      var sfenBoard = segments[0];
      var x = 8;
      var y = 0;
      for (var i = 0; i < sfenBoard.length; i++) {
        var c = sfenBoard[i];
        if (c === "+") {
          i++;
          c += sfenBoard[i];
        }
        if (c.match(/^[1-9]$/)) {
          x -= Number(c);
        } else if (c === "/") {
          y++;
          x = 8;
        } else {
          board[x][y] = Piece_1["default"].fromSFENString(c);
          x--;
        }
      }
      shogi.board = board;
      shogi.turn = segments[1] === "b" ? Color_1["default"].Black : Color_1["default"].White;
      var hands = [[], []];
      var sfenHands = segments[2];
      if (sfenHands !== "-") {
        while (sfenHands.length > 0) {
          var count = 1;
          var m = sfenHands.match(/^[0-9]+/);
          if (m) {
            count = Number(m[0]);
            sfenHands = sfenHands.slice(m[0].length);
          }
          for (var i = 0; i < count; i++) {
            var piece = Piece_1["default"].fromSFENString(sfenHands[0]);
            hands[piece.color].push(piece);
          }
          sfenHands = sfenHands.slice(1);
        }
      }
      shogi.hands = hands;
    }
    exports.fromSfen = fromSfen;
    function toSfen(shogi, moveCount) {
      var ret = [];
      var sfenBoard = [];
      for (var y = 0; y < 9; y++) {
        var line = "";
        var empty = 0;
        for (var x = 8; x >= 0; x--) {
          var piece = shogi.board[x][y];
          if (piece == null) {
            empty++;
          } else {
            if (empty > 0) {
              line += "" + empty;
              empty = 0;
            }
            line += piece.toSFENString();
          }
        }
        if (empty > 0) {
          line += "" + empty;
        }
        sfenBoard.push(line);
      }
      ret.push(sfenBoard.join("/"));
      ret.push(shogi.turn === Color_1["default"].Black ? "b" : "w");
      if (shogi.hands[0].length === 0 && shogi.hands[1].length === 0) {
        ret.push("-");
      } else {
        var sfenHands = "";
        var kinds = ["R", "B", "G", "S", "N", "L", "P", "r", "b", "g", "s", "n", "l", "p"];
        var count = {};
        for (var i = 0; i < 2; i++) {
          for (var _i = 0, _a = shogi.hands[i]; _i < _a.length; _i++) {
            var hand = _a[_i];
            var key = hand.toSFENString();
            count[key] = (count[key] || 0) + 1;
          }
        }
        for (var _b = 0, kinds_1 = kinds; _b < kinds_1.length; _b++) {
          var kind = kinds_1[_b];
          if (count[kind] > 0) {
            sfenHands += (count[kind] > 1 ? count[kind] : "") + kind;
          }
        }
        ret.push(sfenHands);
      }
      ret.push("" + moveCount);
      return ret.join(" ");
    }
    exports.toSfen = toSfen;
  }
});

// node_modules/shogi.js/cjs/shogi.js
var require_shogi = __commonJS({
  "node_modules/shogi.js/cjs/shogi.js"(exports) {
    exports.__esModule = true;
    exports.colorToString = exports.kindToString = exports.Piece = exports.Color = exports.Shogi = void 0;
    var Color_1 = require_Color();
    exports.Color = Color_1["default"];
    exports.colorToString = Color_1.colorToString;
    var Kind_1 = require_Kind();
    exports.kindToString = Kind_1.kindToString;
    var moveDefinitions_1 = require_moveDefinitions();
    var Piece_1 = require_Piece();
    exports.Piece = Piece_1["default"];
    require_polyfills();
    var Serialization_1 = require_Serialization();
    var Shogi = (
      /** @class */
      (function() {
        function Shogi2(setting) {
          this.initialize(setting);
        }
        Shogi2.getIllegalUnpromotedRow = function(kind) {
          switch (kind) {
            case "FU":
            case "KY":
              return 1;
            case "KE":
              return 2;
            default:
              return 0;
          }
        };
        Shogi2.getRowToOppositeEnd = function(y, color) {
          return color === Color_1["default"].Black ? y : 10 - y;
        };
        Shogi2.prototype.initialize = function(setting) {
          if (setting === void 0) {
            setting = { preset: "HIRATE" };
          }
          (0, Serialization_1.fromPreset)(this, setting);
          this.flagEditMode = false;
        };
        Shogi2.prototype.initializeFromSFENString = function(sfen) {
          (0, Serialization_1.fromSfen)(this, sfen);
        };
        Shogi2.prototype.toCSAString = function() {
          return (0, Serialization_1.toCSA)(this);
        };
        Shogi2.prototype.toSFENString = function(moveCount) {
          if (moveCount === void 0) {
            moveCount = 1;
          }
          return (0, Serialization_1.toSfen)(this, moveCount);
        };
        Shogi2.prototype.editMode = function(flag) {
          this.flagEditMode = flag;
        };
        Shogi2.prototype.move = function(fromx, fromy, tox, toy, promote) {
          if (promote === void 0) {
            promote = false;
          }
          var piece = this.get(fromx, fromy);
          if (piece == null) {
            throw new Error("no piece found at " + fromx + ", " + fromy);
          }
          this.checkTurn(piece.color);
          if (!this.flagEditMode) {
            if (!this.getMovesFrom(fromx, fromy).some(function(move) {
              return move.to.x === tox && move.to.y === toy;
            })) {
              throw new Error("cannot move from " + fromx + ", " + fromy + " to " + tox + ", " + toy);
            }
          }
          if (this.get(tox, toy) != null) {
            this.capture(tox, toy);
          }
          var deadEnd = Shogi2.getIllegalUnpromotedRow(piece.kind) >= Shogi2.getRowToOppositeEnd(toy, piece.color);
          if (promote || deadEnd) {
            piece.promote();
          }
          this.set(tox, toy, piece);
          this.set(fromx, fromy, null);
          this.nextTurn();
        };
        Shogi2.prototype.unmove = function(fromx, fromy, tox, toy, promote, capture) {
          if (promote === void 0) {
            promote = false;
          }
          var piece = this.get(tox, toy);
          if (piece == null) {
            throw new Error("no piece found at " + tox + ", " + toy);
          }
          this.checkTurn(Piece_1["default"].oppositeColor(piece.color));
          var captured;
          if (capture) {
            captured = this.popFromHand(Piece_1["default"].unpromote(capture), piece.color);
            captured.inverse();
          }
          var editMode = this.flagEditMode;
          this.editMode(true);
          this.move(tox, toy, fromx, fromy);
          if (promote) {
            piece.unpromote();
          }
          if (capture) {
            if (Piece_1["default"].isPromoted(capture)) {
              captured.promote();
            }
            this.set(tox, toy, captured);
          }
          this.editMode(editMode);
          this.prevTurn();
        };
        Shogi2.prototype.drop = function(tox, toy, kind, color) {
          if (color === void 0) {
            color = this.turn;
          }
          this.checkTurn(color);
          if (this.get(tox, toy) != null) {
            throw new Error("there is a piece at " + tox + ", " + toy);
          }
          if (!this.getDropsBy(color).some(function(move) {
            return move.to.x === tox && move.to.y === toy && move.kind === kind;
          })) {
            throw new Error("Cannot move");
          }
          var piece = this.popFromHand(kind, color);
          this.set(tox, toy, piece);
          this.nextTurn();
        };
        Shogi2.prototype.undrop = function(tox, toy) {
          var piece = this.get(tox, toy);
          if (piece == null) {
            throw new Error("there is no piece at " + tox + ", " + toy);
          }
          this.checkTurn(Piece_1["default"].oppositeColor(piece.color));
          this.pushToHand(piece);
          this.set(tox, toy, null);
          this.prevTurn();
        };
        Shogi2.prototype.getMovesFrom = function(x, y) {
          var legal = function(x2, y2, color) {
            if (x2 < 1 || 9 < x2 || y2 < 1 || 9 < y2) {
              return false;
            }
            var piece2 = this.get(x2, y2);
            return piece2 == null || piece2.color !== color;
          }.bind(this);
          var shouldStop = function(x2, y2, color) {
            var piece2 = this.get(x2, y2);
            return piece2 != null && piece2.color !== color;
          }.bind(this);
          var piece = this.get(x, y);
          if (piece == null) {
            return [];
          }
          var moveDef = (0, moveDefinitions_1.getMoveDefinitions)(piece.kind);
          var ret = [];
          var from = { x, y };
          var unit = piece.color === Color_1["default"].Black ? 1 : -1;
          if (moveDef.just) {
            for (var _i = 0, _a = moveDef.just; _i < _a.length; _i++) {
              var def = _a[_i];
              var to = { x: from.x + def[0] * unit, y: from.y + def[1] * unit };
              if (legal(to.x, to.y, piece.color)) {
                ret.push({ from, to });
              }
            }
          }
          if (moveDef.fly) {
            for (var _b = 0, _c = moveDef.fly; _b < _c.length; _b++) {
              var def = _c[_b];
              var to = { x: from.x + def[0] * unit, y: from.y + def[1] * unit };
              while (legal(to.x, to.y, piece.color)) {
                ret.push({ from, to: { x: to.x, y: to.y } });
                if (shouldStop(to.x, to.y, piece.color)) {
                  break;
                }
                to.x += def[0] * unit;
                to.y += def[1] * unit;
              }
            }
          }
          return ret;
        };
        Shogi2.prototype.getDropsBy = function(color) {
          var ret = [];
          var places = [];
          var fuExistsArray = [];
          for (var i = 1; i <= 9; i++) {
            var fuExists = false;
            for (var j = 1; j <= 9; j++) {
              var piece = this.get(i, j);
              if (piece == null) {
                places.push({ x: i, y: j });
              } else if (piece.color === color && piece.kind === "FU") {
                fuExists = true;
              }
            }
            fuExistsArray.push(fuExists);
          }
          var done = {};
          for (var _i = 0, _a = this.hands[color]; _i < _a.length; _i++) {
            var hand = _a[_i];
            var kind = hand.kind;
            if (done[kind]) {
              continue;
            }
            done[kind] = true;
            var illegalUnpromotedRow = Shogi2.getIllegalUnpromotedRow(kind);
            for (var _b = 0, places_1 = places; _b < places_1.length; _b++) {
              var place = places_1[_b];
              if (kind === "FU" && fuExistsArray[place.x - 1]) {
                continue;
              }
              if (illegalUnpromotedRow >= Shogi2.getRowToOppositeEnd(place.y, color)) {
                continue;
              }
              ret.push({ to: place, color, kind });
            }
          }
          return ret;
        };
        Shogi2.prototype.getMovesTo = function(x, y, kind, color) {
          if (color === void 0) {
            color = this.turn;
          }
          var to = { x, y };
          var ret = [];
          for (var i = 1; i <= 9; i++) {
            for (var j = 1; j <= 9; j++) {
              var piece = this.get(i, j);
              if (!piece || piece.kind !== kind || piece.color !== color) {
                continue;
              }
              var moves = this.getMovesFrom(i, j);
              if (moves.some(function(move) {
                return move.to.x === x && move.to.y === y;
              })) {
                ret.push({ from: { x: i, y: j }, to });
              }
            }
          }
          return ret;
        };
        Shogi2.prototype.get = function(x, y) {
          return this.board[x - 1][y - 1];
        };
        Shogi2.prototype.getHandsSummary = function(color) {
          var ret = {
            FU: 0,
            KY: 0,
            KE: 0,
            GI: 0,
            KI: 0,
            KA: 0,
            HI: 0
          };
          for (var _i = 0, _a = this.hands[color]; _i < _a.length; _i++) {
            var hand = _a[_i];
            ret[hand.kind]++;
          }
          return ret;
        };
        Shogi2.prototype.isCheck = function(color) {
          var x = null;
          var y = null;
          for (var i = 1; i <= 9; i++) {
            for (var j = 1; j <= 9; j++) {
              var piece = this.get(i, j);
              if (!piece || piece.color !== color) {
                continue;
              }
              if (piece.kind === "OU") {
                x = i;
                y = j;
              }
            }
          }
          if (x === null || y === null) {
            return false;
          }
          for (var i = 1; i <= 9; i++) {
            for (var j = 1; j <= 9; j++) {
              var piece = this.get(i, j);
              if (!piece || piece.color === color) {
                continue;
              }
              var moves = this.getMovesFrom(i, j);
              if (moves.some(function(move) {
                return move.to.x === x && move.to.y === y;
              })) {
                return true;
              }
            }
          }
          return false;
        };
        Shogi2.prototype.captureByColor = function(x, y, color) {
          if (!this.flagEditMode) {
            throw new Error("cannot edit board without editMode");
          }
          var piece = this.get(x, y);
          this.set(x, y, null);
          piece.unpromote();
          if (piece.color !== color) {
            piece.inverse();
          }
          this.pushToHand(piece);
        };
        Shogi2.prototype.flip = function(x, y) {
          if (!this.flagEditMode) {
            throw new Error("cannot edit board without editMode");
          }
          var piece = this.get(x, y);
          if (!piece) {
            return false;
          }
          if (Piece_1["default"].isPromoted(piece.kind)) {
            piece.unpromote();
            piece.inverse();
          } else if (Piece_1["default"].canPromote(piece.kind)) {
            piece.promote();
          } else {
            piece.inverse();
          }
          return true;
        };
        Shogi2.prototype.setTurn = function(color) {
          if (!this.flagEditMode) {
            throw new Error("cannot set turn without editMode");
          }
          this.turn = color;
        };
        Shogi2.prototype.set = function(x, y, piece) {
          this.board[x - 1][y - 1] = piece;
        };
        Shogi2.prototype.capture = function(x, y) {
          var piece = this.get(x, y);
          this.set(x, y, null);
          piece.unpromote();
          piece.inverse();
          this.pushToHand(piece);
        };
        Shogi2.prototype.pushToHand = function(piece) {
          this.hands[piece.color].push(piece);
        };
        Shogi2.prototype.popFromHand = function(kind, color) {
          var hand = this.hands[color];
          for (var i = 0; i < hand.length; i++) {
            if (hand[i].kind !== kind) {
              continue;
            }
            var piece = hand[i];
            hand.splice(i, 1);
            return piece;
          }
          throw new Error(color + " has no " + kind);
        };
        Shogi2.prototype.nextTurn = function() {
          if (this.flagEditMode) {
            return;
          }
          this.turn = this.turn === Color_1["default"].Black ? Color_1["default"].White : Color_1["default"].Black;
        };
        Shogi2.prototype.prevTurn = function() {
          if (this.flagEditMode) {
            return;
          }
          this.nextTurn();
        };
        Shogi2.prototype.checkTurn = function(color) {
          if (!this.flagEditMode && color !== this.turn) {
            throw new Error("cannot move opposite piece");
          }
        };
        return Shogi2;
      })()
    );
    exports.Shogi = Shogi;
  }
});
export default require_shogi();
/*! Bundled license information:

shogi.js/cjs/shogi.js:
  (** @license
   * Shogi.js
   * Copyright (c) 2014 na2hiro (https://github.com/na2hiro)
   * This software is released under the MIT License.
   * http://opensource.org/licenses/mit-license.php
   *)
*/
