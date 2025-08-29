"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PositionType = exports.GameState = exports.PlayerColor = void 0;
var PlayerColor;
(function (PlayerColor) {
    PlayerColor["RED"] = "red";
    PlayerColor["GREEN"] = "green";
    PlayerColor["BLUE"] = "blue";
    PlayerColor["YELLOW"] = "yellow";
})(PlayerColor || (exports.PlayerColor = PlayerColor = {}));
var GameState;
(function (GameState) {
    GameState["WAITING"] = "waiting";
    GameState["SELECTING_STARTER"] = "selecting_starter";
    GameState["PLAYING"] = "playing";
    GameState["FINISHED"] = "finished";
})(GameState || (exports.GameState = GameState = {}));
var PositionType;
(function (PositionType) {
    PositionType["START"] = "start";
    PositionType["PATH"] = "path";
    PositionType["HOME"] = "home";
    PositionType["SAFE"] = "safe";
})(PositionType || (exports.PositionType = PositionType = {}));
//# sourceMappingURL=game.js.map