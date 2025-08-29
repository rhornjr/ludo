import { Server } from 'socket.io';
import { Game, PlayerColor, GameResult } from '../types/game';
export declare class GameManager {
    private io;
    private games;
    private playerToGame;
    private usedGameIds;
    constructor(io: Server);
    createGame(): string;
    joinGame(gameId: string, playerId: string, playerName: string, playerColor?: PlayerColor): GameResult;
    assignColor(gameId: string, playerId: string, playerColor: PlayerColor): GameResult;
    getAvailableColors(gameId: string, excludePlayerId?: string): {
        success: boolean;
        availableColors?: PlayerColor[];
        error?: string;
    };
    handlePlayerDisconnect(playerId: string): void;
    rollDie(gameId: string, playerId: string): {
        success: boolean;
        result?: number;
        error?: string;
    };
    switchTurn(gameId: string): {
        success: boolean;
        game?: Game;
        error?: string;
    };
    moveDisc(gameId: string, playerColor: PlayerColor, discIndex: number, newPosition: [number, number]): {
        success: boolean;
        game?: Game;
        error?: string;
    };
    private createBoard;
    private createPawns;
    private startGame;
}
//# sourceMappingURL=GameManager.d.ts.map