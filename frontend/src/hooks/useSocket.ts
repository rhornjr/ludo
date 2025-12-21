import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Game, GameResult, PlayerColor } from '../types/game';
import { SERVER_URL } from '../config';

export const useSocket = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentGame, setCurrentGame] = useState<Game | null>(null);
  
  // Debug the setCurrentGame function
  const debugSetCurrentGame = (game: Game | null) => {
    console.log('=== SET CURRENT GAME CALLED ===');
    console.log('Setting currentGame to:', game);
    console.trace('Stack trace for setCurrentGame call:');
    setCurrentGame(game);
  };
  
  // Debug when currentGame changes
  useEffect(() => {
    console.log('=== USE SOCKET CURRENT GAME STATE CHANGED ===');
    console.log('useSocket currentGame:', currentGame);
    if (currentGame === null) {
      console.log('WARNING: useSocket currentGame was set to null!');
      console.trace('Stack trace for useSocket currentGame being set to null:');
    } else {
      console.log('SUCCESS: useSocket currentGame was set to:', currentGame.id);
    }
  }, [currentGame]);
  const [error, setError] = useState<string | null>(null);
  const [dieRollCallback, setDieRollCallback] = useState<((result: number) => void) | null>(null);
  const [pendingDieRoll, setPendingDieRoll] = useState<number | null>(null);

  useEffect(() => {
    console.log('=== INITIALIZING SOCKET CONNECTION ===');
    console.log('Connecting to SERVER_URL:', SERVER_URL);
    
    const newSocket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    
    console.log('Socket instance created:', newSocket.id || 'pending connection');
    
    newSocket.on('connect', () => {
      console.log('✅ Socket connected successfully! Socket ID:', newSocket.id);
      setIsConnected(true);
      setError(null);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected. Reason:', reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (err: Error) => {
      console.error('❌ Socket connection error:', err);
      console.error('Error details:', {
        message: err.message,
        name: err.name,
        stack: err.stack
      });
      setError(`Failed to connect to server: ${err.message}`);
    });

    newSocket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`🔄 Reconnection attempt ${attemptNumber}`);
    });

    newSocket.on('reconnect', (attemptNumber) => {
      console.log(`✅ Reconnected after ${attemptNumber} attempts`);
      setIsConnected(true);
      setError(null);
    });

    newSocket.on('reconnect_failed', () => {
      console.error('❌ Reconnection failed after all attempts');
      setError('Failed to reconnect to server after multiple attempts');
    });

    setSocket(newSocket);

    return () => {
      console.log('Cleaning up socket connection');
      newSocket.close();
    };
  }, []);

  const createGame = (): Promise<{ gameId: string }> => {
    return new Promise((resolve, reject) => {
      if (!socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      socket.emit('createGame', (response: { gameId: string }) => {
        resolve(response);
      });
    });
  };

  const joinGame = (gameId: string, playerName: string, playerColor?: PlayerColor): Promise<GameResult> => {
    console.log('=== JOIN GAME FUNCTION CALLED ===');
    console.log('Game ID:', gameId, 'Player Name:', playerName, 'Player Color:', playerColor);
    
    return new Promise((resolve, reject) => {
      if (!socket) {
        console.log('Socket not connected, rejecting');
        reject(new Error('Socket not connected'));
        return;
      }

      console.log('=== JOINING GAME ===');
      console.log('Game ID:', gameId, 'Player Name:', playerName, 'Player Color:', playerColor);
      
      socket.emit('joinGame', { gameId, playerName, playerColor }, (result: GameResult) => {
        console.log('Join game result:', result);
        if (result.success) {
          console.log('Setting current game from join result:', result.game);
          console.log('Current game before setting:', currentGame);
          console.log('About to call setCurrentGame with:', result.game);
          debugSetCurrentGame(result.game || null);
          console.log('setCurrentGame called, current game after setting should be:', result.game);
          console.log('But currentGame state will not update until next render');
          // Find the current player in the game
          if (result.game) {
            const player = result.game.players.find(p => p.name === playerName);
            if (player) {
              console.log('Current player identified:', player);
            }
          }
        } else {
          console.log('Join game failed:', result.error);
        }
        resolve(result);
      });
    });
  };

  const getAvailableColors = (gameId: string, excludePlayerId?: string): Promise<{ success: boolean; availableColors?: PlayerColor[]; error?: string }> => {
    return new Promise((resolve, reject) => {
      if (!socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      socket.emit('getAvailableColors', { gameId, excludePlayerId }, (result: { success: boolean; availableColors?: PlayerColor[]; error?: string }) => {
        resolve(result);
      });
    });
  };

  const assignColor = (gameId: string, playerColor: PlayerColor): Promise<GameResult> => {
    return new Promise((resolve, reject) => {
      if (!socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      socket.emit('assignColor', { gameId, playerColor }, (result: GameResult) => {
        resolve(result);
      });
    });
  };

  const startGame = (gameId: string): Promise<GameResult> => {
    return new Promise((resolve, reject) => {
      if (!socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      socket.emit('startGame', { gameId }, (result: GameResult) => {
        resolve(result);
      });
    });
  };

  const rollDie = (gameId: string, forcedRoll?: number): Promise<{ success: boolean; result?: number; error?: string }> => {
    return new Promise((resolve, reject) => {
      if (!socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      socket.emit('rollDie', { gameId, forcedRoll }, (response: { success: boolean; result?: number; error?: string }) => {
        resolve(response);
      });
    });
  };

  const switchTurn = (gameId: string, force: boolean = false): Promise<{ success: boolean }> => {
    console.log('=== SWITCH TURN FUNCTION CALLED ===');
    console.log('Game ID:', gameId);
    console.log('Force switch:', force);
    return new Promise((resolve, reject) => {
      if (!socket) {
        console.log('Socket not connected, rejecting');
        reject(new Error('Socket not connected'));
        return;
      }

      console.log('Emitting switchTurn event to server');
      socket.emit('switchTurn', { gameId, force }, (response: { success: boolean }) => {
        console.log('SwitchTurn response received:', response);
        resolve(response);
      });
    });
  };

  const moveDisc = (gameId: string, playerColor: PlayerColor, discIndex: number, newPosition: [number, number]): Promise<{ success: boolean }> => {
    return new Promise((resolve, reject) => {
      if (!socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      socket.emit('moveDisc', { gameId, playerColor, discIndex, newPosition }, (response: { success: boolean }) => {
        resolve(response);
      });
    });
  };

  const playerWon = (gameId: string, playerColor: PlayerColor): Promise<{ success: boolean }> => {
    return new Promise((resolve, reject) => {
      if (!socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      socket.emit('playerWon', { gameId, playerColor }, (response: { success: boolean }) => {
        resolve(response);
      });
    });
  };

  useEffect(() => {
    if (!socket) return;

    const handlePlayerJoined = ({ player, game }: { player: any; game: Game }) => {
      console.log('=== PLAYER JOINED EVENT RECEIVED ===');
      console.log('Player joined:', player.name, 'Game state:', game);
      console.log('Current game before update:', currentGame);
      debugSetCurrentGame(game);
      console.log('Current game after update should be:', game);
    };

    const handlePlayerLeft = ({ playerId, game }: { playerId: string; game: Game }) => {
      console.log('Player left:', playerId, 'Game state:', game);
      debugSetCurrentGame(game);
    };

    const handleGameStarted = ({ game }: { game: Game }) => {
      console.log('Game started:', game);
      // Clear any pending die roll when game starts
      setPendingDieRoll(null);
      debugSetCurrentGame(game);
    };

    const handleStarterSelectionStarted = ({ game }: { game: Game }) => {
      console.log('Starter selection started:', game);
      // Clear any pending die roll when starter selection starts
      setPendingDieRoll(null);
      debugSetCurrentGame(game);
    };

    const handleDieRolled = ({ result }: { result: number }) => {
      console.log('=== DIE ROLLED EVENT RECEIVED ===');
      console.log('Result:', result);
      console.log('Current game before update:', currentGame);
      
      // Call the callback if available
      console.log('Checking if dieRollCallback is available:', !!dieRollCallback);
      if (dieRollCallback) {
        console.log('Calling die roll callback with result:', result);
        dieRollCallback(result);
      } else {
        console.log('No dieRollCallback available - storing pending die roll');
        setPendingDieRoll(result);
      }
      
      // Update the current game with the die result
      if (currentGame) {
        const updatedGame = { ...currentGame, diceValue: result };
        console.log('Updated game:', updatedGame);
        debugSetCurrentGame(updatedGame);
      } else {
        console.log('No current game to update - this should not happen if player is in game');
      }
    };

    const handleTurnSwitched = ({ game }: { game: Game }) => {
      console.log('=== TURN SWITCHED EVENT RECEIVED ===');
      console.log('New game state:', game);
      console.log('New currentPlayerIndex:', game.currentPlayerIndex);
      console.log('New current player color:', game.players[game.currentPlayerIndex]?.color);
      console.log('Die value after turn switch:', game.diceValue);
      
      // Clear any pending die roll when turn switches
      setPendingDieRoll(null);
      
      // Update the game state immediately
      debugSetCurrentGame(game);
      
      // Force a re-render to ensure the turn change is reflected
      setTimeout(() => {
        debugSetCurrentGame({ ...game });
      }, 100);
    };

    const handleDiscMoved = ({ playerColor, discIndex, newPosition, game }: { playerColor: PlayerColor; discIndex: number; newPosition: [number, number]; game: Game }) => {
      console.log('=== DISC MOVED EVENT RECEIVED ===');
      console.log('Player:', playerColor, 'Disc:', discIndex, 'New position:', newPosition);
      console.log('Updated game state:', game);
      console.log('Current player index after disc move:', game.currentPlayerIndex);
      console.log('Current player color after disc move:', game.players[game.currentPlayerIndex]?.color);
      debugSetCurrentGame(game);
    };

    const handlePlayerColorChanged = ({ player, game }: { player: any; game: Game }) => {
      console.log('=== PLAYER COLOR CHANGED EVENT RECEIVED ===');
      console.log('Player color changed:', player.name, 'New color:', player.color);
      console.log('Updated game state:', game);
      debugSetCurrentGame(game);
      
      // If we're still in color selection, refresh the available colors
      // This will be handled by the App component when it detects the game state change
    };

    const handlePlayerWon = ({ playerColor }: { playerColor: PlayerColor }) => {
      console.log('=== PLAYER WON EVENT RECEIVED ===');
      console.log('Player won:', playerColor);
      
      // Trigger victory celebration for all players
      if (dieRollCallback) {
        // We'll use the dieRollCallback to trigger the victory celebration
        // This is a bit of a hack, but it will work for now
        setTimeout(() => {
          // Trigger a custom victory event
          window.dispatchEvent(new CustomEvent('playerWon', { detail: { playerColor } }));
        }, 100);
      }
    };

    socket.on('playerJoined', handlePlayerJoined);
    socket.on('playerLeft', handlePlayerLeft);
    socket.on('gameStarted', handleGameStarted);
    socket.on('starterSelectionStarted', handleStarterSelectionStarted);
    socket.on('dieRolled', handleDieRolled);
    socket.on('turnSwitched', handleTurnSwitched);
    socket.on('discMoved', handleDiscMoved);
    socket.on('playerColorChanged', handlePlayerColorChanged);
    socket.on('playerWon', handlePlayerWon);

    return () => {
      socket.off('playerJoined', handlePlayerJoined);
      socket.off('playerLeft', handlePlayerLeft);
      socket.off('gameStarted', handleGameStarted);
      socket.off('starterSelectionStarted', handleStarterSelectionStarted);
      socket.off('dieRolled', handleDieRolled);
      socket.off('turnSwitched', handleTurnSwitched);
          socket.off('discMoved', handleDiscMoved);
    socket.off('playerColorChanged', handlePlayerColorChanged);
    socket.off('playerWon', handlePlayerWon);
    };
  }, [socket]);

  return {
    socket,
    isConnected,
    currentGame,
    error,
    createGame,
    joinGame,
    getAvailableColors,
    assignColor,
    startGame,
    rollDie,
    switchTurn,
    moveDisc,
    playerWon,
    setDieRollCallback,
    pendingDieRoll
  };
};
