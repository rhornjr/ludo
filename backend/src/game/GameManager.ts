import { Server, Socket } from 'socket.io';
import { Game, Player, PlayerColor, GameState, GameResult } from '../types/game';

export class GameManager {
  private games: Map<string, Game> = new Map();
  private playerToGame: Map<string, string> = new Map();
  private usedGameIds: Set<string> = new Set();

  constructor(private io: Server) {}

  createGame(): string {
    let gameId: string;
    do {
      gameId = Math.floor(Math.random() * 900 + 100).toString(); // Generate 100-999
    } while (this.usedGameIds.has(gameId));
    
    this.usedGameIds.add(gameId);
    const game: Game = {
      id: gameId,
      players: [],
      currentPlayerIndex: 0,
      diceValue: 0,
      gameState: GameState.WAITING,
      board: this.createBoard(),
      createdAt: new Date(),
      gameLocked: false
    };

    this.games.set(gameId, game);
    return gameId;
  }

  joinGame(gameId: string, playerId: string, playerName: string, playerColor?: PlayerColor): GameResult {
    const game = this.games.get(gameId);
    
    if (!game) {
      return { success: false, error: 'Game not found' };
    }

    if (game.players.length >= 4) {
      return { success: false, error: 'Game is full' };
    }

    if (game.gameState !== GameState.WAITING) {
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
    let finalColor: PlayerColor;
    if (playerColor) {
      finalColor = playerColor;
    } else {
      // Find first available color for temporary assignment
      const usedColors = game.players.map(p => p.color);
      const allColors = [PlayerColor.RED, PlayerColor.GREEN, PlayerColor.BLUE, PlayerColor.YELLOW];
      finalColor = allColors.find(color => !usedColors.includes(color)) || PlayerColor.RED;
    }
    
    const player: Player = {
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

  assignColor(gameId: string, playerId: string, playerColor: PlayerColor): GameResult {
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

  getAvailableColors(gameId: string, excludePlayerId?: string): { success: boolean; availableColors?: PlayerColor[]; error?: string } {
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
    
    const allColors = [PlayerColor.RED, PlayerColor.GREEN, PlayerColor.BLUE, PlayerColor.YELLOW];
    const availableColors = allColors.filter(color => !usedColors.includes(color));

    return { success: true, availableColors };
  }

  handlePlayerDisconnect(playerId: string): void {
    const gameId = this.playerToGame.get(playerId);
    if (!gameId) return;

    const game = this.games.get(gameId);
    if (!game) return;

    // Remove player from game
    game.players = game.players.filter(p => p.id !== playerId);
    this.playerToGame.delete(playerId);

    // If no players left, remove the game
    if (game.players.length === 0) {
      this.games.delete(gameId);
      this.usedGameIds.delete(gameId);
    } else {
      // Notify remaining players
      this.io.to(gameId).emit('playerLeft', { playerId, game });
    }
  }

  rollDie(gameId: string, playerId: string): { success: boolean; result?: number; error?: string } {
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

  switchTurn(gameId: string): { success: boolean; game?: Game; error?: string } {
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

  moveDisc(gameId: string, playerColor: PlayerColor, discIndex: number, newPosition: [number, number]): { success: boolean; game?: Game; error?: string } {
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

  private createBoard() {
    // This is a simplified board structure
    // In a real implementation, you'd have the full Ludo board layout
    return {
      paths: [],
      homeAreas: []
    };
  }

  private createPawns() {
    return Array.from({ length: 4 }, (_, i) => ({
      id: i,
      position: 0,
      isHome: false,
      isFinished: false
    }));
  }

  private startGame(gameId: string): void {
    const game = this.games.get(gameId);
    if (!game) return;

    game.gameState = GameState.PLAYING;
    game.currentPlayerIndex = 0;

    this.io.to(gameId).emit('gameStarted', { game });
  }
}
