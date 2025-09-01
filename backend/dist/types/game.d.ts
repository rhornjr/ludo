export interface Player {
    id: string;
    name: string;
    color: PlayerColor;
    pawns: Pawn[];
    isReady: boolean;
    hasChosenColor: boolean;
}
export interface Pawn {
    id: number;
    position: number;
    isHome: boolean;
    isFinished: boolean;
}
export interface Game {
    id: string;
    players: Player[];
    currentPlayerIndex: number;
    diceValue: number;
    gameState: GameState;
    board: Board;
    createdAt: Date;
    gameLocked: boolean;
    starterSelectionTimeout?: NodeJS.Timeout | null;
}
export interface Board {
    paths: Path[];
    homeAreas: HomeArea[];
}
export interface Path {
    playerColor: PlayerColor;
    positions: Position[];
}
export interface Position {
    x: number;
    y: number;
    type: PositionType;
}
export interface HomeArea {
    playerColor: PlayerColor;
    positions: Position[];
}
export declare enum PlayerColor {
    ORANGE = "orange",
    GREEN = "green",
    BLUE = "blue",
    YELLOW = "yellow"
}
export declare enum GameState {
    WAITING = "waiting",
    SELECTING_STARTER = "selecting_starter",
    PLAYING = "playing",
    FINISHED = "finished"
}
export declare enum PositionType {
    START = "start",
    PATH = "path",
    HOME = "home",
    SAFE = "safe"
}
export interface GameResult {
    success: boolean;
    gameId?: string;
    error?: string;
    game?: Game;
}
//# sourceMappingURL=game.d.ts.map