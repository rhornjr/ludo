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
      console.log(`Player ${playerName} joining with specified color: ${playerColor}`);
    } else {
      // Find first available color for temporary assignment
      const usedColors = game.players.map(p => p.color);
      const allColors = [PlayerColor.RED, PlayerColor.GREEN, PlayerColor.BLUE, PlayerColor.YELLOW];
      finalColor = allColors.find(color => !usedColors.includes(color)) || PlayerColor.RED;
      console.log(`Player ${playerName} joining without color, assigned temporary color: ${finalColor}`);
      console.log(`Used colors in game: ${usedColors.join(', ')}`);
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
    this.io.to(gameId).emit('playerJoined', { player, game: this.serializeGameForSocket(game) });

    // Don't automatically start the game - let players manually start it
    // if (game.players.length === 4) {
    //   console.log(`Starting game ${gameId} with 4 players`);
    //   this.startGame(gameId);
    // }

    return { success: true, gameId, game: this.serializeGameForSocket(game) };
  }

  assignColor(gameId: string, playerId: string, playerColor: PlayerColor): GameResult {
    const game = this.games.get(gameId);
    
    if (!game) {
      return { success: false, error: 'Game not found' };
    }

    console.log(`=== ASSIGN COLOR DEBUG ===`);
    console.log(`Game ID: ${gameId}, Player ID: ${playerId}, Requested Color: ${playerColor}`);
    console.log(`Current players in game:`, game.players.map(p => ({ id: p.id, name: p.name, color: p.color })));

    // Check if the requested color is available (excluding the current player)
    console.log(`Checking if color ${playerColor} is taken by other players...`);
    const playersWithSameColor = game.players.filter(p => p.color === playerColor);
    console.log(`Players with color ${playerColor}:`, playersWithSameColor.map(p => ({ id: p.id, name: p.name })));
    
    // Find the current player to check if they're trying to assign their own current color
    const currentPlayer = game.players.find(p => p.id === playerId);
    const isAssigningOwnColor = currentPlayer && currentPlayer.color === playerColor;
    
    const isColorTaken = game.players.some(p => p.color === playerColor && p.id !== playerId);
    console.log(`Is color taken by other player: ${isColorTaken}`);
    console.log(`Is player assigning their own current color: ${isAssigningOwnColor}`);
    console.log(`Current player ID: ${playerId}`);
    console.log(`Players with same color but different ID:`, game.players.filter(p => p.color === playerColor && p.id !== playerId).map(p => ({ id: p.id, name: p.name })));
    
    if (isColorTaken) {
      console.log(`Color ${playerColor} is already taken by another player`);
      return { success: false, error: `Color ${playerColor} is already taken` };
    }

    // Find the player and update their color
    const player = game.players.find(p => p.id === playerId);
    if (!player) {
      console.log(`Player with ID ${playerId} not found in game`);
      return { success: false, error: 'Player not found' };
    }

    console.log(`Updating player ${player.name} color from ${player.color} to ${playerColor}`);
    player.color = playerColor;

    // Notify all players in the game about the color change
    this.io.to(gameId).emit('playerColorChanged', { player, game: this.serializeGameForSocket(game) });

    console.log(`Color assignment successful`);
    return { success: true, gameId, game: this.serializeGameForSocket(game) };
  }

  getAvailableColors(gameId: string, excludePlayerId?: string): { success: boolean; availableColors?: PlayerColor[]; error?: string } {
    const game = this.games.get(gameId);
    
    if (!game) {
      return { success: false, error: 'Game not found' };
    }

    console.log(`=== GET AVAILABLE COLORS DEBUG ===`);
    console.log(`Game ID: ${gameId}, Exclude Player ID: ${excludePlayerId}`);
    console.log(`All players in game:`, game.players.map(p => ({ id: p.id, name: p.name, color: p.color })));

    let usedColors = game.players.map(p => p.color);
    console.log(`Used colors before exclusion: ${usedColors.join(', ')}`);
    
    // If excluding a specific player, remove their color from used colors
    if (excludePlayerId) {
      const excludePlayer = game.players.find(p => p.id === excludePlayerId);
      if (excludePlayer) {
        console.log(`Excluding player ${excludePlayer.name} with color ${excludePlayer.color}`);
        usedColors = usedColors.filter(color => color !== excludePlayer.color);
        console.log(`Used colors after exclusion: ${usedColors.join(', ')}`);
      } else {
        console.log(`Player with ID ${excludePlayerId} not found for exclusion`);
      }
    } else {
      console.log(`No player ID provided for exclusion - this might be the issue!`);
    }
    
    const allColors = [PlayerColor.RED, PlayerColor.GREEN, PlayerColor.BLUE, PlayerColor.YELLOW];
    const availableColors = allColors.filter(color => !usedColors.includes(color));
    console.log(`Available colors: ${availableColors.join(', ')}`);

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
      this.io.to(gameId).emit('playerLeft', { playerId, game: this.serializeGameForSocket(game) });
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
    console.log('Current dice value:', game.diceValue);
    
    // If the current player rolled a 6, they should get another turn
    if (game.diceValue === 6) {
      console.log('Player rolled a 6, keeping turn for another roll');
      // Reset dice value but keep the same player
      game.diceValue = 0;
      return { success: true, game: this.serializeGameForSocket(game) };
    }
    
    // Switch to the next player
    game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
    game.diceValue = 0; // Reset die value

    console.log('Turn switched to player index:', game.currentPlayerIndex, 'player color:', game.players[game.currentPlayerIndex]?.color);

    return { success: true, game: this.serializeGameForSocket(game) };
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

  playerWon(gameId: string, playerColor: PlayerColor): { success: boolean; error?: string } {
    const game = this.games.get(gameId);
    
    if (!game) {
      return { success: false, error: 'Game not found' };
    }

    console.log('Player won event received for game:', gameId, 'player:', playerColor);
    
    // Broadcast the victory to all players in the game
    this.io.to(gameId).emit('playerWon', { playerColor });
    
    return { success: true };
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

  private serializeGameForSocket(game: Game): Omit<Game, 'starterSelectionTimeout'> {
    const { starterSelectionTimeout, ...serializedGame } = game;
    return serializedGame;
  }

  private startGame(gameId: string): void {
    const game = this.games.get(gameId);
    if (!game) return;

    game.gameState = GameState.PLAYING;
    game.currentPlayerIndex = 0;

    this.io.to(gameId).emit('gameStarted', { game: this.serializeGameForSocket(game) });
  }

  startGameWithRandomSelection(gameId: string): { success: boolean; game?: Game; error?: string } {
    const game = this.games.get(gameId);
    
    if (!game) {
      return { success: false, error: 'Game not found' };
    }

    if (game.gameState !== GameState.WAITING) {
      return { success: false, error: 'Game has already started' };
    }

    if (game.players.length < 2) {
      return { success: false, error: 'Need at least 2 players to start the game' };
    }

    // Enter the selecting starter state
    game.gameState = GameState.SELECTING_STARTER;
    
    // Notify all players that we're starting the selection process
    this.io.to(gameId).emit('starterSelectionStarted', { game: this.serializeGameForSocket(game) });

    // After a brief delay, randomly select the starting player
    // Use a single timeout per game to prevent multiple selections
    if (game.starterSelectionTimeout) {
      clearTimeout(game.starterSelectionTimeout);
    }
    
    game.starterSelectionTimeout = setTimeout(() => {
      this.selectRandomStarter(gameId);
      game.starterSelectionTimeout = null;
    }, 1000);

    return { success: true, game: this.serializeGameForSocket(game) };
  }

  private selectRandomStarter(gameId: string): void {
    const game = this.games.get(gameId);
    if (!game || game.gameState !== GameState.SELECTING_STARTER) return;

    // Randomly select a starting player
    const randomIndex = Math.floor(Math.random() * game.players.length);
    game.currentPlayerIndex = randomIndex;
    game.gameState = GameState.PLAYING;

    console.log(`Game ${gameId} started with player ${game.players[randomIndex].name} (${game.players[randomIndex].color})`);

    // Notify all players about the selected starter and game start
    this.io.to(gameId).emit('gameStarted', { game: this.serializeGameForSocket(game) });
  }
}
