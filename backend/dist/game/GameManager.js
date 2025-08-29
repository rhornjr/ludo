"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameManager = void 0;
const game_1 = require("../types/game");
class GameManager {
    constructor(io) {
        this.io = io;
        this.games = new Map();
        this.playerToGame = new Map();
        this.usedGameIds = new Set();
    }
    createGame() {
        let gameId;
        do {
            gameId = Math.floor(Math.random() * 900 + 100).toString(); // Generate 100-999
        } while (this.usedGameIds.has(gameId));
        this.usedGameIds.add(gameId);
        const game = {
            id: gameId,
            players: [],
            currentPlayerIndex: 0,
            diceValue: 0,
            gameState: game_1.GameState.WAITING,
            board: this.createBoard(),
            createdAt: new Date(),
            gameLocked: false
        };
        this.games.set(gameId, game);
        return gameId;
    }
    joinGame(gameId, playerId, playerName, playerColor) {
        const game = this.games.get(gameId);
        if (!game) {
            return { success: false, error: 'Game not found' };
        }
        if (game.players.length >= 4) {
            return { success: false, error: 'Game is full' };
        }
        if (game.gameState !== game_1.GameState.WAITING) {
            return { success: false, error: 'Game has already started' };
        }
        if (game.gameLocked) {
            return { success: false, error: 'Game is locked - no new players can join' };
        }
        // If color is provided, check if it's available
        if (playerColor) {
            const isColorTaken = game.players.some(p => p.color === playerColor);
            if (isColorTaken) {
                return { success: false, error: `Color ${playerColor} is already taken` };
            }
        }
        // Create player with provided color or first available color as temporary
        let finalColor;
        if (playerColor) {
            finalColor = playerColor;
        }
        else {
            // Find first available color for temporary assignment
            const usedColors = game.players.map(p => p.color);
            const allColors = [game_1.PlayerColor.RED, game_1.PlayerColor.GREEN, game_1.PlayerColor.BLUE, game_1.PlayerColor.YELLOW];
            finalColor = allColors.find(color => !usedColors.includes(color)) || game_1.PlayerColor.RED;
        }
        const player = {
            id: playerId,
            name: playerName,
            color: finalColor,
            pawns: this.createPawns(),
            isReady: false
        };
        game.players.push(player);
        this.playerToGame.set(playerId, gameId);
        // Notify all players in the game
        console.log(`Player ${playerName} joined game ${gameId}. Total players: ${game.players.length}`);
        this.io.to(gameId).emit('playerJoined', { player, game });
        // If we have 4 players, start the game
        if (game.players.length === 4) {
            console.log(`Starting game ${gameId} with 4 players`);
            this.startGame(gameId);
        }
        return { success: true, gameId, game };
    }
    assignColor(gameId, playerId, playerColor) {
        const game = this.games.get(gameId);
        if (!game) {
            return { success: false, error: 'Game not found' };
        }
        // Check if the requested color is available (excluding the current player)
        const isColorTaken = game.players.some(p => p.color === playerColor && p.id !== playerId);
        if (isColorTaken) {
            return { success: false, error: `Color ${playerColor} is already taken` };
        }
        // Find the player and update their color
        const player = game.players.find(p => p.id === playerId);
        if (!player) {
            return { success: false, error: 'Player not found' };
        }
        player.color = playerColor;
        // Notify all players in the game about the color change
        this.io.to(gameId).emit('playerColorChanged', { player, game });
        return { success: true, gameId, game };
    }
    getAvailableColors(gameId, excludePlayerId) {
        const game = this.games.get(gameId);
        if (!game) {
            return { success: false, error: 'Game not found' };
        }
        let usedColors = game.players.map(p => p.color);
        // If excluding a specific player, remove their color from used colors
        if (excludePlayerId) {
            const excludePlayer = game.players.find(p => p.id === excludePlayerId);
            if (excludePlayer) {
                usedColors = usedColors.filter(color => color !== excludePlayer.color);
            }
        }
        const allColors = [game_1.PlayerColor.RED, game_1.PlayerColor.GREEN, game_1.PlayerColor.BLUE, game_1.PlayerColor.YELLOW];
        const availableColors = allColors.filter(color => !usedColors.includes(color));
        return { success: true, availableColors };
    }
    handlePlayerDisconnect(playerId) {
        const gameId = this.playerToGame.get(playerId);
        if (!gameId)
            return;
        const game = this.games.get(gameId);
        if (!game)
            return;
        // Remove player from game
        game.players = game.players.filter(p => p.id !== playerId);
        this.playerToGame.delete(playerId);
        // If no players left, remove the game
        if (game.players.length === 0) {
            this.games.delete(gameId);
            this.usedGameIds.delete(gameId);
        }
        else {
            // Notify remaining players
            this.io.to(gameId).emit('playerLeft', { playerId, game });
        }
    }
    rollDie(gameId, playerId) {
        const game = this.games.get(gameId);
        if (!game) {
            return { success: false, error: 'Game not found' };
        }
        // Generate a random die result (1-6)
        const dieResult = Math.floor(Math.random() * 6) + 1;
        game.diceValue = dieResult;
        // Lock the game on the first roll
        if (!game.gameLocked) {
            game.gameLocked = true;
            console.log(`Game ${gameId} is now locked - no new players can join`);
        }
        return { success: true, result: dieResult };
    }
    switchTurn(gameId) {
        const game = this.games.get(gameId);
        if (!game) {
            return { success: false, error: 'Game not found' };
        }
        console.log('Switching turn in game:', gameId, 'from player index:', game.currentPlayerIndex);
        // Switch to the next player
        game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
        game.diceValue = 0; // Reset die value
        console.log('Turn switched to player index:', game.currentPlayerIndex, 'player color:', game.players[game.currentPlayerIndex]?.color);
        return { success: true, game };
    }
    moveDisc(gameId, playerColor, discIndex, newPosition) {
        const game = this.games.get(gameId);
        if (!game) {
            return { success: false, error: 'Game not found' };
        }
        console.log('Moving disc in game:', gameId, 'player:', playerColor, 'disc:', discIndex, 'to position:', newPosition);
        // Find the player with the specified color
        const player = game.players.find(p => p.color === playerColor);
        if (!player) {
            return { success: false, error: 'Player not found' };
        }
        // Update the pawn position in the game state
        if (player.pawns[discIndex]) {
            // Convert [row, col] position to a single position value for storage
            // For now, we'll store the position as a string representation
            player.pawns[discIndex].position = parseInt(`${newPosition[0]}${newPosition[1]}`);
            console.log('Updated pawn position for player:', playerColor, 'disc:', discIndex, 'to:', player.pawns[discIndex].position);
        }
        return { success: true, game };
    }
    createBoard() {
        // This is a simplified board structure
        // In a real implementation, you'd have the full Ludo board layout
        return {
            paths: [],
            homeAreas: []
        };
    }
    createPawns() {
        return Array.from({ length: 4 }, (_, i) => ({
            id: i,
            position: 0,
            isHome: false,
            isFinished: false
        }));
    }
    startGame(gameId) {
        const game = this.games.get(gameId);
        if (!game)
            return;
        game.gameState = game_1.GameState.PLAYING;
        game.currentPlayerIndex = 0;
        this.io.to(gameId).emit('gameStarted', { game });
    }
}
exports.GameManager = GameManager;
//# sourceMappingURL=GameManager.js.map