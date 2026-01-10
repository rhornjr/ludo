import React, { useState, useEffect } from 'react';
import { PlayerColor, Player, GameState } from '../types/game';
import { Sounds } from '../helpers/Sounds';
import { StarterSelection } from './StarterSelection';
import './LudoBoard.css';

interface LudoBoardProps {
  localPlayerColor?: PlayerColor;
  onPawnClick?: (playerColor: PlayerColor, pawnId: number) => void;
  onDieRoll?: (result: number) => void;
  gameId?: string;
  socketRollDie?: (gameId: string, forcedRoll?: number) => Promise<{ success: boolean; result?: number; error?: string }>;
  switchTurn?: (gameId: string, force?: boolean) => Promise<{ success: boolean }>;
  moveDisc?: (gameId: string, playerColor: PlayerColor, discIndex: number, newPosition: [number, number]) => Promise<{ success: boolean }>;
  playerWon?: (gameId: string, playerColor: PlayerColor) => Promise<{ success: boolean }>;
  startGame?: (gameId: string) => Promise<{ success: boolean; error?: string }>;
  socket?: any;
  currentGame?: any;
  setDieRollCallback?: (callback: (result: number) => void) => void;
  pendingDieRoll?: number | null;
}

export const LudoBoard: React.FC<LudoBoardProps> = ({ localPlayerColor, onPawnClick, onDieRoll, gameId, socketRollDie, switchTurn, moveDisc, playerWon, startGame, socket, currentGame, setDieRollCallback, pendingDieRoll }) => {
  // Derive current turn from game state
  const currentTurnColor = currentGame?.players[currentGame.currentPlayerIndex]?.color;
  const [showCoordinates, setShowCoordinates] = useState(false);
  const [forcedRollNumber, setForcedRollNumber] = useState<number | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [dieResult, setDieResult] = useState<number | null>(null);
  const [moveMade, setMoveMade] = useState(false);
  const [shouldGetExtraRoll, setShouldGetExtraRoll] = useState(false);
  const [hasRolled, setHasRolled] = useState(false);
  const [showDebugMode, setShowDebugMode] = useState(false);
  const [dieRollCallback, setDieRollCallbackState] = useState<((result: number) => void) | null>(null);
  const [pulsatingDiscs, setPulsatingDiscs] = useState<Set<string>>(new Set());

  // Debug logging
  console.log('=== CURRENT TURN DEBUG ===');
  console.log('currentGame:', currentGame);
  console.log('currentPlayerIndex:', currentGame?.currentPlayerIndex);
  console.log('currentTurnColor:', currentTurnColor);
  console.log('localPlayerColor:', localPlayerColor);
  console.log('Can roll:', !(localPlayerColor && localPlayerColor !== currentTurnColor));
  console.log('Die result:', dieResult);
  console.log('Is rolling:', isRolling);

  
  // Blue disc positions: [row, col]
  // All four discs in the same row, centered below the name tag
  const [blueDiscs, setBlueDiscs] = useState<[number, number][]>([
    [11, 1], [11, 2], [11, 3], [11, 4] // Starting positions - all in row 11, shifted left to center
  ]);

   // Green disc positions: [row, col]
   // All four discs in the same row, centered below the name tag
   const [greenDiscs, setGreenDiscs] = useState<[number, number][]>([
    [2, 10], [2, 11], [2, 12], [2, 13] // Starting positions - all in row 2, shifted left to center
  ]);

   // Yellow disc positions: [row, col]
   // All four discs in the same row, centered below the name tag
   const [yellowDiscs, setYellowDiscs] = useState<[number, number][]>([
    [11, 10], [11, 11], [11, 12], [11, 13] // Starting positions - all in row 11, shifted left to center
  ]);

   // Orange disc positions: [row, col]
   // All four discs in the same row, centered below the name tag
   const [orangeDiscs, setOrangeDiscs] = useState<[number, number][]>([
    [2, 1], [2, 2], [2, 3], [2, 4] // Starting positions - all in row 2, shifted left to center
  ]);
  
  // Animation state
  const [animatingDisc, setAnimatingDisc] = useState<number | null>(null);
  const [animationPath, setAnimationPath] = useState<[number, number][]>([]);
  const [animationIndex, setAnimationIndex] = useState(0);
  
  // Removed animation state - using instant movement instead

  // Celebration state
  const [showVictory, setShowVictory] = useState(false);
  const [winnerColor, setWinnerColor] = useState<PlayerColor | null>(null);
  
  // Debug effect to track victory state changes
  useEffect(() => {
    console.log('Victory state changed - showVictory:', showVictory, 'winnerColor:', winnerColor);
  }, [showVictory, winnerColor]);

  // Listen for playerWon events from other players
  useEffect(() => {
    const handlePlayerWonEvent = (event: CustomEvent) => {
      console.log('=== PLAYER WON EVENT RECEIVED IN LUDOBOARD ===');
      console.log('Event detail:', event.detail);
      const { playerColor } = event.detail;
      triggerVictory(playerColor);
    };

    window.addEventListener('playerWon', handlePlayerWonEvent as EventListener);

    return () => {
      window.removeEventListener('playerWon', handlePlayerWonEvent as EventListener);
    };
  }, []);
  const [confetti, setConfetti] = useState<Array<{id: number, x: number, y: number, color: string, rotation: number, velocity: number}>>([]);
  const [explosions, setExplosions] = useState<Array<{id: number, x: number, y: number}>>([]);

  // Starter selection state
  const [showStarterSelection, setShowStarterSelection] = useState(false);

  // Handle starting the game
  const handleStartGame = async () => {
    if (!gameId || !startGame) return;
    
    try {
      const result = await startGame(gameId);
      if (!result.success) {
        alert(result.error || 'Failed to start game');
      }
    } catch (error) {
      console.error('Error starting game:', error);
      alert('Failed to start game');
    }
  };

  // Handle starter selection completion
  const handleStarterSelectionComplete = (selectedPlayer: Player) => {
    console.log('Starter selection completed:', selectedPlayer);
    setShowStarterSelection(false);
  };

  // Show starter selection when game state is SELECTING_STARTER
  useEffect(() => {
    if (currentGame?.gameState === GameState.SELECTING_STARTER) {
      setShowStarterSelection(true);
    }
    // Don't automatically hide it - let the StarterSelection component control its own visibility
  }, [currentGame?.gameState]);

  // Disable the die completely when rolling or when player has already rolled
  const handleDieClick = async () => {
    if (isRolling) {
      console.log('Die click blocked - already rolling');
      return;
    }
    
    // Prevent rolling if player has already rolled and hasn't made a move yet
    // EXCEPT when they rolled a 6 - they always get to roll again
    if (hasRolled && !moveMade && dieResult !== 6) {
      console.log('Die click blocked - already rolled, waiting for move (not a 6)');
      return;
    }
    
    // If player rolled a 6, they can always roll again
    if (hasRolled && !moveMade && dieResult === 6) {
      console.log('Player rolled a 6, allowing them to roll again');
    }
    
    // Don't reset shouldGetExtraRoll here - let collision detection handle it
    console.log(`=== DIE CLICK - shouldGetExtraRoll state: ${shouldGetExtraRoll} ===`);
    
    rollDie();
  };

  // Set up die roll callback
  useEffect(() => {
    console.log('Setting up die roll callback');
    const callback = (result: number) => {
      console.log('=== DIRECT DIE ROLL CALLBACK ===');
      console.log('Setting die result to:', result);
      setDieResult(result);
      setIsRolling(false);
      
      // Add a brief highlight to make the die roll more visible
      const dieElement = document.querySelector('.die') as HTMLElement;
      if (dieElement) {
        dieElement.style.boxShadow = '0 0 20px #ffd700';
        setTimeout(() => {
          dieElement.style.boxShadow = '';
        }, 1000);
      }
    };
    
    setDieRollCallbackState(callback);
    
    if (setDieRollCallback) {
      setDieRollCallback(callback);
      console.log('Die roll callback set up successfully');
    } else {
      console.log('setDieRollCallback not available');
    }
  }, [setDieRollCallback]);

  // Effect to reset local state when turn changes
  useEffect(() => {
    console.log('=== TURN CHANGE DETECTED ===');
    console.log('Current turn color:', currentTurnColor);
    console.log('Local player color:', localPlayerColor);
    console.log('Is local player turn:', localPlayerColor === currentTurnColor);
    console.log('Current hasRolled state:', hasRolled);
    console.log('Current moveMade state:', moveMade);
    
    // Reset local state when turn changes
    if (localPlayerColor !== currentTurnColor) {
      console.log('Resetting local state for turn change');
      console.log(`Previous shouldGetExtraRoll: ${shouldGetExtraRoll}`);
      setDieResult(null);
      setMoveMade(false);
      setHasRolled(false);
      setIsRolling(false);
      setShouldGetExtraRoll(false);
      setPulsatingDiscs(new Set()); // Clear pulsating discs on turn change
      console.log('shouldGetExtraRoll reset to false');
    }
  }, [currentTurnColor, localPlayerColor]);

  // Effect to reset local state when game starts (for the first player)
  useEffect(() => {
    console.log('=== GAME STATE CHANGE DETECTED ===');
    console.log('Game state:', currentGame?.gameState);
    console.log('Current turn color:', currentTurnColor);
    console.log('Local player color:', localPlayerColor);
    console.log('Is local player turn:', localPlayerColor === currentTurnColor);
    
    // Reset local state when game transitions to PLAYING and it's the local player's turn
    if (currentGame?.gameState === 'PLAYING' && localPlayerColor === currentTurnColor) {
      console.log('Game just started and it\'s local player\'s turn - resetting local state');
      setDieResult(null);
      setMoveMade(false);
      setHasRolled(false);
      setIsRolling(false);
      setShouldGetExtraRoll(false);
      setPulsatingDiscs(new Set()); // Clear pulsating discs on game start
      console.log('Local state reset for game start');
    }
  }, [currentGame?.gameState, currentTurnColor, localPlayerColor]);

  // Additional effect to reset state when game starts (for all players)
  useEffect(() => {
    if (currentGame?.gameState === 'PLAYING') {
      console.log('=== GAME STARTED - RESETTING ALL PLAYER STATE ===');
      console.log('Resetting state for all players when game starts');
      setDieResult(null);
      setMoveMade(false);
      setHasRolled(false);
      setIsRolling(false);
      setShouldGetExtraRoll(false);
      setPulsatingDiscs(new Set()); // Clear pulsating discs on game start
      // Clear any pending die roll to prevent it from being processed
      if (pendingDieRoll) {
        console.log('Clearing pending die roll on game start');
        // We can't directly clear pendingDieRoll as it's passed as a prop,
        // but we can ensure our local state is clean
      }
      console.log('All player state reset for game start');
    }
  }, [currentGame?.gameState, pendingDieRoll]);

  // Simple effect to clear die result when turn switches
  useEffect(() => {
    if (currentGame?.diceValue === 0 && dieResult !== null) {
      // Only clear die result if it's not the current player's turn anymore
      // or if a move has been made
      if (localPlayerColor !== currentTurnColor || moveMade) {
        console.log('Clearing die result due to turn switch or move completion');
        setDieResult(null);
        setMoveMade(false);
        setHasRolled(false); // Reset rolled state when turn switches
      }
    }
  }, [currentGame?.diceValue, localPlayerColor, currentTurnColor, moveMade]);

  // Simple effect to handle pending die rolls
  useEffect(() => {
    if (pendingDieRoll && !dieResult && !isRolling) {
      console.log('Processing pending die roll:', pendingDieRoll);
      console.log('⚠️ WARNING: pendingDieRoll is being processed - this might be causing the repeated 6s!');
      setDieResult(pendingDieRoll);
      setIsRolling(false);
      setHasRolled(true); // Mark that the player has rolled
    }
  }, [pendingDieRoll, dieResult, isRolling]);



  // Listen for disc movement events from other players
  useEffect(() => {
    if (!socket || !currentGame) return;

    const handleDiscMoved = ({ playerColor, discIndex, newPosition }: { playerColor: PlayerColor; discIndex: number; newPosition: [number, number] }) => {
      console.log('=== DISC MOVED EVENT RECEIVED IN LUDOBOARD ===');
      console.log('Player:', playerColor, 'Disc:', discIndex, 'New position:', newPosition);
      
      // Only update if it's not the local player's move (to avoid double updates)
      if (playerColor !== localPlayerColor) {
        // Get current disc position
        let currentDiscs: [number, number][];
        let path: number[][];
        
        if (playerColor === PlayerColor.BLUE) {
          currentDiscs = blueDiscs;
          path = bluePath;
        } else if (playerColor === PlayerColor.GREEN) {
          currentDiscs = greenDiscs;
          path = greenPath;
        } else if (playerColor === PlayerColor.YELLOW) {
          currentDiscs = yellowDiscs;
          path = yellowPath;
          } else if (playerColor === PlayerColor.ORANGE) {
    currentDiscs = orangeDiscs;
    path = orangePath;
        } else {
          return; // Unknown player color
        }
        
        const currentPosition = currentDiscs[discIndex];
        
        // Find current position in path
        const currentPathIndex = path.findIndex(([row, col]) => row === currentPosition[0] && col === currentPosition[1]);
        const newPathIndex = path.findIndex(([row, col]) => row === newPosition[0] && col === newPosition[1]);
        
        if (currentPathIndex !== -1 && newPathIndex !== -1 && newPathIndex > currentPathIndex) {
          // Animate through the path
          const animationSteps: [number, number][] = path.slice(currentPathIndex + 1, newPathIndex + 1) as [number, number][];
          
          if (animationSteps.length > 0) {
            setAnimatingDisc(discIndex);
            setAnimationPath(animationSteps);
            setAnimationIndex(0);
            
            // Play sound immediately when animation starts
            Sounds.playMovementSound().catch(error => console.log('Error playing movement sound:', error));
            
            // Start animation
            const animateStep = (stepIndex: number) => {
              if (stepIndex < animationSteps.length) {
                if (playerColor === PlayerColor.BLUE) {
                  setBlueDiscs(prev => {
                    const newDiscs = [...prev];
                    newDiscs[discIndex] = animationSteps[stepIndex];
                    return newDiscs;
                  });
                } else if (playerColor === PlayerColor.GREEN) {
                  setGreenDiscs(prev => {
                    const newDiscs = [...prev];
                    newDiscs[discIndex] = animationSteps[stepIndex];
                    return newDiscs;
                  });
                } else if (playerColor === PlayerColor.YELLOW) {
                  setYellowDiscs(prev => {
                    const newDiscs = [...prev];
                    newDiscs[discIndex] = animationSteps[stepIndex];
                    return newDiscs;
                  });
                } else if (playerColor === PlayerColor.ORANGE) {
                  setOrangeDiscs(prev => {
                    const newDiscs = [...prev];
                    newDiscs[discIndex] = animationSteps[stepIndex];
                    return newDiscs;
                  });
                }
                setAnimationIndex(stepIndex);
                
                // Play landing sound for each step (except the first one, which is handled by initial sound)
                if (stepIndex > 0) {
                  // Only play extra roll sound if this is the final position and it's an extra roll square
                  if (stepIndex === animationSteps.length - 1 && isExtraRollSquare(animationSteps[stepIndex])) {
                    Sounds.playExtraRollSound().catch(error => console.log('Error playing extra roll sound:', error));
                  } else if (stepIndex === animationSteps.length - 1) {
                    // Play regular sound for final position if it's not an extra roll square
                    Sounds.playSound().catch(error => console.log('Error playing sound:', error));
                  } else {
                    // Play movement sound for each intermediate step
                    Sounds.playMovementSound().catch(error => console.log('Error playing movement sound:', error));
                  }
                }
                
                setTimeout(() => animateStep(stepIndex + 1), 175);
              } else {
                // Animation complete
                setAnimatingDisc(null);
                setAnimationPath([]);
                setAnimationIndex(0);
                
                // Handle disc collision after movement for other players
                handleDiscCollision(newPosition, playerColor);
                
                // Check for victory for other players' moves
                if (checkForWinner(playerColor)) {
                  console.log(`${playerColor} player has won!`);
                  triggerVictory(playerColor);
                  return; // Exit immediately - no more processing
                }
              }
            };
            
            animateStep(0);
          }
        } else {
      // Fallback: immediate update for non-path movements (like starting position)
      if (playerColor === PlayerColor.BLUE) {
        setBlueDiscs(prev => {
          const newDiscs = [...prev];
          newDiscs[discIndex] = newPosition;
          return newDiscs;
        });
      } else if (playerColor === PlayerColor.GREEN) {
        setGreenDiscs(prev => {
          const newDiscs = [...prev];
          newDiscs[discIndex] = newPosition;
          return newDiscs;
        });
      } else if (playerColor === PlayerColor.YELLOW) {
        setYellowDiscs(prev => {
          const newDiscs = [...prev];
          newDiscs[discIndex] = newPosition;
          return newDiscs;
        });
      } else if (playerColor === PlayerColor.ORANGE) {
        setOrangeDiscs(prev => {
          const newDiscs = [...prev];
          newDiscs[discIndex] = newPosition;
          return newDiscs;
        });
      }
      
      // Handle disc collision after immediate movement
      handleDiscCollision(newPosition, playerColor);
      
      // Check for victory for other players' immediate movements
      if (checkForWinner(playerColor)) {
        console.log(`${playerColor} player has won!`);
        triggerVictory(playerColor);
        return; // Exit immediately - no more processing
      }
      
      // Play sound for immediate movement
      if (isExtraRollSquare(newPosition)) {
        Sounds.playExtraRollSound().catch(error => console.log('Error playing extra roll sound:', error));
      } else {
        Sounds.playSound().catch(error => console.log('Error playing sound:', error));
      }
    }
      }
    };

    socket.on('discMoved', handleDiscMoved);
    
    // Listen for disc return to home events
    const handleDiscReturnedToHome = ({ playerColor, discIndex, homePosition }: { playerColor: PlayerColor; discIndex: number; homePosition: [number, number] }) => {
      console.log('=== DISC RETURNED TO HOME EVENT RECEIVED ===');
      console.log('Player:', playerColor, 'Disc:', discIndex, 'Home position:', homePosition);
      
      // Get the current position of the disc
      let currentDiscPosition: [number, number];
      if (playerColor === PlayerColor.BLUE) {
        currentDiscPosition = blueDiscs[discIndex];
      } else if (playerColor === PlayerColor.GREEN) {
        currentDiscPosition = greenDiscs[discIndex];
      } else if (playerColor === PlayerColor.YELLOW) {
        currentDiscPosition = yellowDiscs[discIndex];
      } else if (playerColor === PlayerColor.ORANGE) {
        currentDiscPosition = orangeDiscs[discIndex];
      } else {
        currentDiscPosition = [0, 0]; // Fallback
      }
      
      // Prevent infinite loop by checking if disc is already at the target home position
      if (currentDiscPosition[0] === homePosition[0] && currentDiscPosition[1] === homePosition[1]) {
        console.log('Disc already at target home position, skipping to prevent infinite loop');
        return;
      }
      
      // Move the disc instantly to home
      moveKnockedDiscToHome(
        playerColor,
        discIndex,
        currentDiscPosition,
        homePosition
      );
    };
    
    socket.on('discReturnedToHome', handleDiscReturnedToHome);
    
    return () => {
      socket.off('discMoved', handleDiscMoved);
      socket.off('discReturnedToHome', handleDiscReturnedToHome);
    };
  }, [socket, currentGame, localPlayerColor, blueDiscs, greenDiscs]);

  // No animation state to clean up

  // Listen for die roll events from other players
  useEffect(() => {
    if (!socket || !currentGame) return;

    const handleDieRolled = ({ result }: { result: number }) => {
      console.log('=== DIE ROLLED EVENT RECEIVED IN LUDOBOARD ===');
      console.log('Die result:', result);
      
      // Start the rolling animation for all players
      setIsRolling(true);
      setDieResult(null);
      
      // Play rolling sound
      Sounds.playDiceRollSound();
      
      // Show the result after the animation delay
      setTimeout(() => {
        setDieResult(result);
        setIsRolling(false);
        setMoveMade(false); // Reset move flag
        onDieRoll?.(result);
        
        // Add a brief highlight to make the die roll more visible
        const dieElement = document.querySelector('.die') as HTMLElement;
        if (dieElement) {
          dieElement.style.boxShadow = '0 0 20px #ffd700';
          setTimeout(() => {
            dieElement.style.boxShadow = '';
          }, 1000);
        }
        
        // Check if the current player has any valid moves (only for the current player)
        // Note: shouldGetExtraRoll is handled in handleTurnLogic after the move is completed
        if (localPlayerColor === currentTurnColor) {
          // The shouldGetExtraRoll flag will be checked and reset in handleTurnLogic
          // after the player makes their move
          if (result !== 6) {
            // Normal case: check if player has valid moves
            const hasMoves = hasValidMoves(result, currentTurnColor);
            console.log(`Current player check - hasMoves: ${hasMoves}, result: ${result}`);
            if (!hasMoves) {
              console.log('No valid moves available, auto-switching turn');
              setTimeout(() => {
                setDieResult(null);
                setHasRolled(false); // Reset rolled state when turn switches
                if (switchTurn && gameId) {
                  switchTurn(gameId, false).catch(error => {
                    console.error('Error switching turn:', error);
                  });
                }
              }, 2000); // Give 2 seconds for the player to see the result
            }
          } else if (result === 6) {
            // Player rolled a 6 - they always get to roll again, regardless of valid moves
            console.log('Player rolled a 6 - they get to roll again (regardless of valid moves)');
            // Don't switch turn - player keeps their turn for another roll
            // If they have valid moves, they can make a move first, then roll again
            // If they don't have valid moves, they just roll again
          }
        }
      }, 1000); // Animation delay
    };

    socket.on('dieRolled', handleDieRolled);
    return () => {
      socket.off('dieRolled', handleDieRolled);
    };
  }, [socket, currentGame, localPlayerColor, currentTurnColor, switchTurn, gameId, onDieRoll]);

  // Keyboard event listener for debug mode toggle (Ctrl+Shift+D)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        event.preventDefault();
        setShowDebugMode(prev => !prev);
        console.log('Debug mode toggled:', !showDebugMode);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showDebugMode]);

  const orangeSquares = [
    // Top row
    [0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5],
    // Left and right columns
    [1, 0], [1, 5], [2, 0], [2, 5], [3, 0], [3, 5], [4, 0], [4, 5],
    // Bottom row
    [5, 0], [5, 1], [5, 2], [5, 3], [5, 4], [5, 5],
    // Path
    [6, 1], [7, 1], [7, 2], [7, 3], [7, 4], [7, 5]
  ];

  const greenSquares = [
    // Top row
    [0, 9], [0, 10], [0, 11], [0, 12], [0, 13], [0, 14],
    // Left and right columns
    [1, 9], [1, 14], [2, 9], [2, 14], [3, 9], [3, 14], [4, 9], [4, 14],
    // Bottom row
    [5, 9], [5, 10], [5, 11], [5, 12], [5, 13], [5, 14],
    // Path
    [1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [1, 8]
  ];

  const blueSquares = [
    // Top row
    [9, 0], [9, 1], [9, 2], [9, 3], [9, 4], [9, 5],
    // Left and right columns
    [10, 0], [10, 5], [11, 0], [11, 5], [12, 0], [12, 5], [13, 0], [13, 5],
    // Bottom row
    [14, 0], [14, 1], [14, 2], [14, 3], [14, 4], [14, 5],
    // Path
    [13, 6], [13, 7], [9, 7], [10, 7], [11, 7], [12, 7]
  ];

  const yellowSquares = [
    // Top row
    [9, 9], [9, 10], [9, 11], [9, 12], [9, 13], [9, 14],
    // Left and right columns
    [10, 9], [10, 14], [11, 9], [11, 14], [12, 9], [12, 14], [13, 9], [13, 14],
    // Bottom row
    [14, 9], [14, 10], [14, 11], [14, 12], [14, 13], [14, 14],
    // Path
    [7, 9], [7, 10], [7, 11], [7, 12], [7, 13], [8, 13]
  ];

  const graySquares = [
    [6, 6], [6, 8], [8, 6], [8, 8]
  ];

  const safeSquares = [
    [13, 6], [8, 2], [6, 1], [2, 6], [1, 8], [6, 12], [8, 13], [12, 8]
  ];

  const cornerExtraRollSquares = [
    [6, 0], [0, 8], [8, 14], [14, 6] // Corner squares that show die icons
  ];

  const extraRollSquares = [
    ...cornerExtraRollSquares, // Corner squares
    [8, 7], [6, 7], [7, 8], [7, 6]   // Final squares for each player
  ];

  // Blue player's complete path from start to finish
  const bluePath = [
    [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
    [8, 5], [8, 4], [8, 3], [8, 2], [8, 1],
    [8, 0], [7, 0],
    [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], 
    [5, 6], [4, 6], [3, 6], [2, 6], [1, 6],
    [0, 6], [0, 7],
    [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
    [6, 9], [6, 10], [6, 11], [6, 12], [6, 13],
    [6, 14], [7, 14],
    [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
    [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
    [14, 7], [13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]
  ];

    // Green player's complete path from start to finish
  const greenPath = [
      [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
      [6, 9], [6, 10], [6, 11], [6, 12], [6, 13],
      [6, 14], [7, 14],
      [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
      [9, 8], [10, 8], [11, 8], [12, 8], [13, 8],
      [14, 8], [14, 7],
      [14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
      [8, 5], [8, 4], [8, 3], [8, 2], [8, 1],
      [8, 0], [7, 0],
      [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], 
      [5, 6], [4, 6], [3, 6], [2, 6], [1, 6],
      [0, 6], [0, 7], [1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]
    ];

    // Yellow player's complete path from start to finish
  const yellowPath = [
      [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
      [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
      [14, 7],
      [14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
      [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
      [7,0],
      [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
      [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
      [0, 7],
      [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
      [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
      [7, 14], [7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]
    ];

    // Orange player's complete path from start to finish
  const orangePath = [
      [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], 
      [5, 6], [4, 6], [3, 6], [2, 6], [1, 6],
      [0, 6], [0, 7],
      [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
      [6, 9], [6, 10], [6, 11], [6, 12], [6, 13],
      [6, 14], [7, 14],
      [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
      [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8], [14, 7],
      [14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
      [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
      [7, 0], [7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]
    ];

  const cellClassMap: Record<string, string> = {
    // Orange corner
    ...Object.fromEntries(orangeSquares.map(([row, col]) => [`${row},${col}`, 'board-cell orange-corner'])),
    
    // Green corner
    ...Object.fromEntries(greenSquares.map(([row, col]) => [`${row},${col}`, 'board-cell green-corner'])),
    
    // Blue corner
    ...Object.fromEntries(blueSquares.map(([row, col]) => [`${row},${col}`, 'board-cell blue-corner'])),
    
    // Yellow corner
    ...Object.fromEntries(yellowSquares.map(([row, col]) => [`${row},${col}`, 'board-cell yellow-corner'])),
    
    // Black path
    ...Object.fromEntries(graySquares.map(([row, col]) => [`${row},${col}`, 'board-cell black-path'])),
    
    // Final squares with colored borders
    '7,6': 'board-cell final-square-orange',
    '6,7': 'board-cell final-square-green', 
    '7,8': 'board-cell final-square-yellow',
    '8,7': 'board-cell final-square-blue',
  };

  const getCellClass = (row: number, col: number) => {
    const key = `${row},${col}`;
    const baseClass = cellClassMap[key] || 'board-cell';
    
    // Check if this cell is part of any player's path
    const isPathCell = bluePath.some(([pathRow, pathCol]) => pathRow === row && pathCol === col) ||
                      greenPath.some(([pathRow, pathCol]) => pathRow === row && pathCol === col) ||
                      yellowPath.some(([pathRow, pathCol]) => pathRow === row && pathCol === col) ||
                      orangePath.some(([pathRow, pathCol]) => pathRow === row && pathCol === col);
    
    // Don't add path-cell class to final squares to avoid border conflicts
    const isFinalSquare = (row === 7 && col === 6) || (row === 6 && col === 7) || 
                         (row === 7 && col === 8) || (row === 8 && col === 7);
    
    // Add path-cell class if it's a path square but not a final square
    const pathClass = (isPathCell && !isFinalSquare) ? ' path-cell' : '';
    return `${baseClass}${pathClass}`;
  };

  const getDieColor = (playerColor?: PlayerColor) => {
    const color = playerColor || currentTurnColor;
    switch (color) {
      case PlayerColor.ORANGE: return '#ff9500';
      case PlayerColor.GREEN: return '#51cf66';
      case PlayerColor.BLUE: return '#339af0';
      case PlayerColor.YELLOW: return '#ffd43b';
      default: return '#ccc';
    }
  };

  // Helper function to get color-specific data
  const getColorData = (playerColor: PlayerColor) => {
    switch (playerColor) {
      case PlayerColor.BLUE:
        return {
          discs: blueDiscs,
          setDiscs: setBlueDiscs,
          path: bluePath,
          startingPositions: [[11, 1], [11, 2], [11, 3], [11, 4]] as [number, number][],
          startingPathPosition: [13, 6] as [number, number]
        };
      case PlayerColor.GREEN:
        return {
          discs: greenDiscs,
          setDiscs: setGreenDiscs,
          path: greenPath,
          startingPositions: [[2, 10], [2, 11], [2, 12], [2, 13]] as [number, number][],
          startingPathPosition: [1, 8] as [number, number]
        };
      case PlayerColor.YELLOW:
        return {
          discs: yellowDiscs,
          setDiscs: setYellowDiscs,
          path: yellowPath,
          startingPositions: [[11, 10], [11, 11], [11, 12], [11, 13]] as [number, number][],
          startingPathPosition: [8, 13] as [number, number]
        };
      case PlayerColor.ORANGE:
        return {
          discs: orangeDiscs,
          setDiscs: setOrangeDiscs,
          path: orangePath,
          startingPositions: [[2, 1], [2, 2], [2, 3], [2, 4]] as [number, number][],
          startingPathPosition: [6, 1] as [number, number]
        };
      default:
        return null;
    }
  };

  // Helper function to handle starting position moves
  const handleStartingPositionMove = async (playerColor: PlayerColor, discIndex: number, startingPathPosition: [number, number]) => {
    const colorData = getColorData(playerColor);
    if (!colorData) return;

    const { discs, setDiscs } = colorData;
    const animationSteps: [number, number][] = [startingPathPosition];
    
    setAnimatingDisc(discIndex);
    setAnimationPath(animationSteps);
    setAnimationIndex(0);
    
    // Play sound immediately when animation starts
    Sounds.playSound().catch(error => console.log('Error playing sound:', error));
    
    const newDiscs = [...discs];
    newDiscs[discIndex] = animationSteps[0];
    setDiscs(newDiscs);
    
    // Emit socket event for disc movement
    if (moveDisc && gameId) {
      moveDisc(gameId, playerColor, discIndex, animationSteps[0]).catch(error => {
        console.error('Error emitting disc movement:', error);
      });
    }
    
    // Play landing sound for starting position movement
    if (isExtraRollSquare(animationSteps[0])) {
      Sounds.playExtraRollSound().catch(error => console.log('Error playing extra roll sound:', error));
    } else {
      Sounds.playSound().catch(error => console.log('Error playing sound:', error));
    }
    
    setTimeout(() => {
      setAnimatingDisc(null);
      setAnimationPath([]);
      setAnimationIndex(0);
      setDieResult(null);
      setMoveMade(true); // Mark that a move was made
      
      // If player rolled a 6, they get to roll again, so don't reset hasRolled
      // If they didn't roll a 6, reset hasRolled so they can't roll again
      if (dieResult !== 6) {
        setHasRolled(false); // Reset rolled state after move (not a 6)
      } else {
        console.log('Player rolled a 6, keeping hasRolled true so they can roll again');
      }
      
      // Handle disc collision after movement
      handleDiscCollision(animationSteps[0], playerColor);
      
      // Check for victory FIRST - this should override all other logic
      // Use the final position to check if this move resulted in a win
      const finalPosition = animationSteps[0];
      console.log(`Checking for victory after starting position move to ${finalPosition}`);
      
      // Create a temporary disc array with the updated position
      const tempDiscs = [...discs];
      tempDiscs[discIndex] = finalPosition;
      
      // Check if all discs are in the final square
      let finalSquare: [number, number];
      switch (playerColor) {
        case PlayerColor.BLUE: finalSquare = [8, 7]; break;
        case PlayerColor.GREEN: finalSquare = [6, 7]; break;
        case PlayerColor.YELLOW: finalSquare = [7, 8]; break;
        case PlayerColor.ORANGE: finalSquare = [7, 6]; break;
        default: finalSquare = [0, 0];
      }
      
      const hasWon = tempDiscs.every(disc => disc[0] === finalSquare[0] && disc[1] === finalSquare[1]);
      console.log(`Temporary discs:`, tempDiscs);
      console.log(`Final square:`, finalSquare);
      console.log(`Has won:`, hasWon);
      
      if (hasWon) {
        console.log(`${playerColor} player has won!`);
        triggerVictory(playerColor);
        return; // Exit immediately - no more turns or extra rolls
      }
      
      // Handle turn logic
      handleTurnLogic(playerColor, animationSteps[0]);
    }, 200);
  };

  // Helper function to handle path moves
  const handlePathMove = async (playerColor: PlayerColor, discIndex: number, currentPathIndex: number, path: number[][]) => {
    const colorData = getColorData(playerColor);
    if (!colorData) return;

    const { discs, setDiscs } = colorData;
    
    // Check if this move would go beyond the final square
    const finalSquareIndex = path.length - 1;
    
    // If the die roll would go beyond the final square, the move is invalid
    if (dieResult && currentPathIndex + dieResult > finalSquareIndex) {
      console.log(`${playerColor} disc: Invalid move - would go beyond final square`);
      return;
    }
    
    const newPathIndex = currentPathIndex + (dieResult || 0);
    const animationSteps: [number, number][] = path.slice(currentPathIndex + 1, newPathIndex + 1) as [number, number][];
    
    console.log(`${playerColor} disc animation steps:`, animationSteps);
    
    if (animationSteps.length > 0) {
      setAnimatingDisc(discIndex);
      setAnimationPath(animationSteps);
      setAnimationIndex(0);
      
      console.log(`${playerColor} disc - playing initial sound`);
      // Play sound immediately when animation starts
      Sounds.playMovementSound().catch(error => console.log('Error playing movement sound:', error));
      
      // Start animation
      const animateStep = (stepIndex: number) => {
        if (stepIndex < animationSteps.length) {
          const newDiscs = [...discs];
          newDiscs[discIndex] = animationSteps[stepIndex];
          setDiscs(newDiscs);
          setAnimationIndex(stepIndex);
          
          // Emit socket event for disc movement (only on final position)
          if (stepIndex === animationSteps.length - 1 && moveDisc && gameId) {
            console.log(`Emitting ${playerColor} disc movement to server`);
            moveDisc(gameId, playerColor, discIndex, animationSteps[stepIndex]).catch(error => {
              console.error('Error emitting disc movement:', error);
            });
          }
          
          // Play landing sound for each step (except the first one, which is handled by initial sound)
          if (stepIndex > 0) {
            console.log(`${playerColor} disc - playing step sound for step:`, stepIndex);
            // Only play extra roll sound if this is the final position and it's an extra roll square
            if (stepIndex === animationSteps.length - 1 && isExtraRollSquare(animationSteps[stepIndex])) {
              Sounds.playExtraRollSound().catch(error => console.log('Error playing extra roll sound:', error));
            } else if (stepIndex === animationSteps.length - 1) {
              // Play regular sound for final position if it's not an extra roll square
              Sounds.playSound().catch(error => console.log('Error playing sound:', error));
            } else {
              // Play movement sound for each intermediate step
              Sounds.playMovementSound().catch(error => console.log('Error playing movement sound:', error));
            }
          }
          
          setTimeout(() => animateStep(stepIndex + 1), 175);
        } else {
          // Animation complete
          setAnimatingDisc(null);
          setAnimationPath([]);
          setAnimationIndex(0);
          setDieResult(null);
          console.log('Move completed, setting moveMade to true');
          setMoveMade(true); // Mark that a move was made
          
          // If player rolled a 6, they get to roll again, so don't reset hasRolled
          // If they didn't roll a 6, reset hasRolled so they can't roll again
          if (dieResult !== 6) {
            setHasRolled(false); // Reset rolled state after move (not a 6)
          } else {
            console.log('Player rolled a 6, keeping hasRolled true so they can roll again');
          }
          
          // Handle disc collision after movement
          const finalPosition = animationSteps[animationSteps.length - 1];
          handleDiscCollision(finalPosition, playerColor);
          
          // Check for victory FIRST - this should override all other logic
          // Use the final position to check if this move resulted in a win
          const winCheckPosition = animationSteps[animationSteps.length - 1];
          console.log(`Checking for victory after path move to ${winCheckPosition}`);
          
          // Create a temporary disc array with the updated position
          const tempDiscs = [...discs];
          tempDiscs[discIndex] = finalPosition;
          
          // Check if all discs are in the final square
          let finalSquare: [number, number];
          switch (playerColor) {
            case PlayerColor.BLUE: finalSquare = [8, 7]; break;
            case PlayerColor.GREEN: finalSquare = [6, 7]; break;
            case PlayerColor.YELLOW: finalSquare = [7, 8]; break;
            case PlayerColor.ORANGE: finalSquare = [7, 6]; break;
            default: finalSquare = [0, 0];
          }
          
          const hasWon = tempDiscs.every(disc => disc[0] === finalSquare[0] && disc[1] === finalSquare[1]);
          console.log(`Temporary discs:`, tempDiscs);
          console.log(`Final square:`, finalSquare);
          console.log(`Has won:`, hasWon);
          
          if (hasWon) {
            console.log(`${playerColor} player has won!`);
            triggerVictory(playerColor);
            return; // Exit immediately - no more turns or extra rolls
          }
          
          // Handle turn logic
          handleTurnLogic(playerColor, finalPosition);
        }
      };
      
      animateStep(0);
    }
  };

  // Helper function to handle turn logic
  const handleTurnLogic = (playerColor: PlayerColor, finalPosition: [number, number]) => {
    console.log(`=== HANDLE TURN LOGIC ===`);
    console.log(`Player: ${playerColor}, Final Position: ${finalPosition}`);
    console.log(`Current shouldGetExtraRoll: ${shouldGetExtraRoll}`);
    console.log(`Is extra roll square: ${isExtraRollSquare(finalPosition)}`);
    console.log(`Die result: ${dieResult}`);
    
    // First, check if the player landed on an extra roll square in THIS move
    if (isExtraRollSquare(finalPosition)) {
      console.log(`${playerColor} player landed on extra roll square, granting extra roll`);
      setShouldGetExtraRoll(true);
      console.log(`shouldGetExtraRoll set to true for landing on extra roll square`);
    } else {
      // Player did NOT land on an extra roll square
      console.log(`${playerColor} player did NOT land on extra roll square`);
      
      // Check if they had an extra roll from a previous action (roll-again square or knocking opponent home)
      if (shouldGetExtraRoll) {
        console.log(`${playerColor} player had extra roll from previous action, using it up`);
        setShouldGetExtraRoll(false); // Reset the flag
        // After using up the extra roll, switch turn (unless they rolled a 6)
        if (dieResult !== 6) {
          const nextPlayer = getNextPlayer(playerColor);
          console.log(`${playerColor} player used up extra roll, switching turn to ${nextPlayer} (not a 6)`);
          setTimeout(() => {
            if (switchTurn && gameId) {
              console.log('Calling switchTurn function after using extra roll');
              switchTurn(gameId, false).then(result => {
                console.log('SwitchTurn result:', result);
              }).catch(error => {
                console.error('Error switching turn:', error);
              });
            }
          }, 100); // Small delay to ensure animation is complete
        } else {
          console.log(`${playerColor} player used up extra roll but rolled a 6, keeping turn for another roll`);
        }
      } else {
        // No extra roll conditions met, switch turn (unless they rolled a 6)
        console.log(`${playerColor} player no extra roll conditions met, checking if turn should switch`);
        if (dieResult !== 6) {
          const nextPlayer = getNextPlayer(playerColor);
          console.log(`${playerColor} player move completed, switching turn to ${nextPlayer} (not a 6)`);
          setTimeout(() => {
            if (switchTurn && gameId) {
              console.log('Calling switchTurn function');
              switchTurn(gameId, false).then(result => {
                console.log('SwitchTurn result:', result);
              }).catch(error => {
                console.error('Error switching turn:', error);
              });
            }
          }, 100); // Small delay to ensure animation is complete
        } else {
          console.log(`${playerColor} player rolled a 6, keeping turn for another roll`);
        }
      }
    }
  };

  // Helper function to get next player
  const getNextPlayer = (currentPlayer: PlayerColor): string => {
    switch (currentPlayer) {
      case PlayerColor.BLUE: return 'green';
      case PlayerColor.GREEN: return 'blue';
      case PlayerColor.YELLOW: return 'green';
      case PlayerColor.ORANGE: return 'yellow';
      default: return 'unknown';
    }
  };

  // Shared function to handle disc clicks for all colors
  const handleDiscClick = async (playerColor: PlayerColor, discIndex: number) => {
    console.log(`${playerColor} disc clicked - dieResult:`, dieResult, 'currentTurnColor:', currentTurnColor, 'animatingDisc:', animatingDisc);
    if (!dieResult || currentTurnColor !== playerColor || animatingDisc !== null) {
      console.log(`${playerColor} disc click blocked - dieResult:`, dieResult, 'currentTurnColor:', currentTurnColor, 'animatingDisc:', animatingDisc);
      return;
    }

    // Stop pulsating for this disc immediately when clicked
    stopPulsating(playerColor, discIndex);

    // Don't reset shouldGetExtraRoll here - let collision detection handle it
    console.log(`=== DISC CLICK - shouldGetExtraRoll state: ${shouldGetExtraRoll} ===`);

    // Get color-specific data
    const colorData = getColorData(playerColor);
    if (!colorData) return;

    const { discs, setDiscs, path, startingPositions, startingPathPosition } = colorData;
    const discPosition = discs[discIndex];
    
    const isInStartingPosition = startingPositions.some(([row, col]) => 
      discPosition[0] === row && discPosition[1] === col
    );
    
    // If disc is in starting position, it can only move on a 6
    if (isInStartingPosition && dieResult !== 6) {
      return;
    }
    
    // If disc is in starting position and we rolled a 6, move to starting path position
    if (isInStartingPosition && dieResult === 6) {
      await handleStartingPositionMove(playerColor, discIndex, startingPathPosition);
      return;
    }
    
    // For discs already on the path, follow the exact path with animation
    const currentPathIndex = path.findIndex(([row, col]) => row === discPosition[0] && col === discPosition[1]);
    
    console.log(`${playerColor} disc path movement - currentPathIndex:`, currentPathIndex, 'discPosition:', discPosition);
    
    if (currentPathIndex !== -1) {
      await handlePathMove(playerColor, discIndex, currentPathIndex, path);
    }
  };

  // Individual color handlers that call the shared function
  const handleBlueDiscClick = async (discIndex: number) => {
    await handleDiscClick(PlayerColor.BLUE, discIndex);
  };

  const handleGreenDiscClick = async (discIndex: number) => {
    await handleDiscClick(PlayerColor.GREEN, discIndex);
  };

  const handleYellowDiscClick = async (discIndex: number) => {
    await handleDiscClick(PlayerColor.YELLOW, discIndex);
  };

  const handleOrangeDiscClick = async (discIndex: number) => {
    await handleDiscClick(PlayerColor.ORANGE, discIndex);
  };

  // Check if a disc is in its home position
  const isInHome = (disc: [number, number], playerColor: PlayerColor): boolean => {
    const homePositions: Record<PlayerColor, [number, number][]> = {
      [PlayerColor.BLUE]: [[11, 1], [11, 2], [11, 3], [11, 4]],
      [PlayerColor.GREEN]: [[2, 10], [2, 11], [2, 12], [2, 13]],
      [PlayerColor.YELLOW]: [[11, 10], [11, 11], [11, 12], [11, 13]],
      [PlayerColor.ORANGE]: [[2, 1], [2, 2], [2, 3], [2, 4]]
    };
    
    const positions = homePositions[playerColor] || [];
    return positions.some((pos: [number, number]) => pos[0] === disc[0] && pos[1] === disc[1]);
  };





  // Helper function to generate confetti
  const generateConfetti = () => {
    console.log('Generating confetti...');
    const colors = ['#ff9500', '#51cf66', '#339af0', '#ffd43b', '#ff922b', '#be4bdb'];
    const newConfetti = [];
    
    for (let i = 0; i < 100; i++) {
      newConfetti.push({
        id: i,
        x: Math.random() * window.innerWidth,
        y: -10,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        velocity: Math.random() * 3 + 2
      });
    }
    
    console.log('Setting confetti with', newConfetti.length, 'pieces');
    setConfetti(newConfetti);
  };

  // Helper function to check if a player has won
  const checkForWinner = (playerColor: PlayerColor): boolean => {
    let discs: [number, number][];
    let finalSquare: [number, number];
    
    switch (playerColor) {
      case PlayerColor.BLUE:
        discs = blueDiscs;
        finalSquare = [8, 7];
        break;
      case PlayerColor.GREEN:
        discs = greenDiscs;
        finalSquare = [6, 7];
        break;
      case PlayerColor.YELLOW:
        discs = yellowDiscs;
        finalSquare = [7, 8];
        break;
      case PlayerColor.ORANGE:
        discs = orangeDiscs;
        finalSquare = [7, 6];
        break;
      default:
        return false;
    }
    
    // Debug logging for winner check
    console.log(`=== WINNER CHECK FOR ${playerColor} ===`);
    console.log('Discs:', discs);
    console.log('Final square:', finalSquare);
    console.log('All discs in final square:', discs.every(disc => disc[0] === finalSquare[0] && disc[1] === finalSquare[1]));
    
    // Check if all 4 discs are in the final square
    return discs.every(disc => disc[0] === finalSquare[0] && disc[1] === finalSquare[1]);
  };

  // Helper function to trigger victory celebration
  const triggerVictory = (winnerColor: PlayerColor) => {
    console.log(`=== TRIGGERING VICTORY FOR ${winnerColor} ===`);
    console.log('Setting winner color:', winnerColor);
    console.log('Setting showVictory to true');
    setWinnerColor(winnerColor);
    setShowVictory(true);
    generateConfetti();
    (async () => {
      try {
        await Sounds.playVictorySound();
      } catch (error) {
        console.log('Error playing victory sound:', error);
      }
    })();
    
    // Broadcast victory to all players
    if (playerWon && gameId) {
      console.log('Broadcasting victory to all players');
      playerWon(gameId, winnerColor).then(result => {
        console.log('Victory broadcast result:', result);
      }).catch(error => {
        console.error('Error broadcasting victory:', error);
      });
    }
    
    // Hide victory message after 5 seconds
    const timeoutId = setTimeout(() => {
      console.log('Hiding victory message after 5 seconds');
      setShowVictory(false);
      setConfetti([]);
    }, 5000);
    
    // Store timeout ID for potential clearing
    console.log('Victory timeout set with ID:', timeoutId);
  };

  // Helper function to test celebration
  const testCelebration = () => {
    const colors = [PlayerColor.BLUE, PlayerColor.GREEN, PlayerColor.YELLOW, PlayerColor.ORANGE];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    triggerVictory(randomColor);
  };

  // Helper function to check if a position is an extra roll square
  const isExtraRollSquare = (position: [number, number]): boolean => {
    return extraRollSquares.some(([row, col]) => row === position[0] && col === position[1]);
  };

  // Helper function to get home positions for a player color
  const getHomePositions = (playerColor: PlayerColor): [number, number][] => {
    switch (playerColor) {
      case PlayerColor.BLUE:
        return [[11, 1], [11, 2], [11, 3], [11, 4]];
      case PlayerColor.GREEN:
        return [[2, 10], [2, 11], [2, 12], [2, 13]];
      case PlayerColor.YELLOW:
        return [[11, 10], [11, 11], [11, 12], [11, 13]];
      case PlayerColor.ORANGE:
        return [[2, 1], [2, 2], [2, 3], [2, 4]];
      default:
        return [];
    }
  };

  // Helper function to check if a position is a safe square (where discs can't be captured)
  const isSafeSquare = (position: [number, number]): boolean => {
    return safeSquares.some(([row, col]) => row === position[0] && col === position[1]);
  };

  // Helper function to handle disc collisions and send opponent discs back to home
  const handleDiscCollision = (landingPosition: [number, number], landingPlayerColor: PlayerColor): void => {
    console.log(`=== HANDLE DISC COLLISION ===`);
    console.log(`Landing position: ${landingPosition}, Landing player: ${landingPlayerColor}`);
    console.log(`Is safe square: ${isSafeSquare(landingPosition)}`);
    
    // Don't handle collisions on safe squares
    if (isSafeSquare(landingPosition)) {
      console.log(`Position is safe square, no collision handling needed`);
      return;
    }

    // Get all discs at the landing position
    const allDiscsAtPosition: { color: PlayerColor; index: number }[] = [];
    
    // Check blue discs
    blueDiscs.forEach((disc, index) => {
      if (disc[0] === landingPosition[0] && disc[1] === landingPosition[1]) {
        allDiscsAtPosition.push({ color: PlayerColor.BLUE, index });
      }
    });
    
    // Check green discs
    greenDiscs.forEach((disc, index) => {
      if (disc[0] === landingPosition[0] && disc[1] === landingPosition[1]) {
        allDiscsAtPosition.push({ color: PlayerColor.GREEN, index });
      }
    });
    
    // Check yellow discs
    yellowDiscs.forEach((disc, index) => {
      if (disc[0] === landingPosition[0] && disc[1] === landingPosition[1]) {
        allDiscsAtPosition.push({ color: PlayerColor.YELLOW, index });
      }
    });
    
    // Check orange discs
    orangeDiscs.forEach((disc, index) => {
      if (disc[0] === landingPosition[0] && disc[1] === landingPosition[1]) {
        allDiscsAtPosition.push({ color: PlayerColor.ORANGE, index });
      }
    });

    // Find opponent discs (discs of different colors)
    const opponentDiscs = allDiscsAtPosition.filter(disc => disc.color !== landingPlayerColor);
    
    console.log(`All discs at position: ${JSON.stringify(allDiscsAtPosition)}`);
    console.log(`Opponent discs: ${JSON.stringify(opponentDiscs)}`);
    
    if (opponentDiscs.length > 0) {
      console.log(`Collision detected! ${landingPlayerColor} disc landed on ${opponentDiscs.length} opponent disc(s)`);
      
      // Grant extra turn for capturing opponent discs
      if (landingPlayerColor === localPlayerColor) {
        console.log(`${landingPlayerColor} player captured opponent disc(s), granting extra roll`);
        setShouldGetExtraRoll(true);
      } else {
        // If it's not the local player's move, switch turn after knocking disc home
        if (switchTurn && gameId) {
          console.log('Non-local player knocked disc home, switching turn');
          setTimeout(() => {
            switchTurn(gameId, false).catch(error => {
              console.error('Error switching turn after knock home:', error);
            });
          }, 1000);
        }
      }
      
      // Create explosion effect at the collision position
  const createExplosion = (position: [number, number]) => {
    const explosionId = Date.now() + Math.random();
    const newExplosion = {
      id: explosionId,
      x: position[1] * 40 + 20, // Convert grid position to pixel position
      y: position[0] * 40 + 20
    };
    
    setExplosions(prev => [...prev, newExplosion]);
    
    // Remove explosion after animation completes
    setTimeout(() => {
      setExplosions(prev => prev.filter(exp => exp.id !== explosionId));
    }, 600);
  };
  
  // Create explosion at collision position
  createExplosion(landingPosition);
      
      // Send each opponent disc back to its home
      opponentDiscs.forEach(opponentDisc => {
        const homePositions = getHomePositions(opponentDisc.color);
        
        // Find an empty home position
        let targetHomePosition: [number, number] | null = null;
        
        // Check which home positions are occupied
        const occupiedHomePositions = new Set<string>();
        
        // Check blue discs in home
        if (opponentDisc.color === PlayerColor.BLUE) {
          blueDiscs.forEach(disc => {
            if (homePositions.some(home => home[0] === disc[0] && home[1] === disc[1])) {
              occupiedHomePositions.add(`${disc[0]},${disc[1]}`);
            }
          });
        }
        
        // Check green discs in home
        if (opponentDisc.color === PlayerColor.GREEN) {
          greenDiscs.forEach(disc => {
            if (homePositions.some(home => home[0] === disc[0] && home[1] === disc[1])) {
              occupiedHomePositions.add(`${disc[0]},${disc[1]}`);
            }
          });
        }
        
        // Check yellow discs in home
        if (opponentDisc.color === PlayerColor.YELLOW) {
          yellowDiscs.forEach(disc => {
            if (homePositions.some(home => home[0] === disc[0] && home[1] === disc[1])) {
              occupiedHomePositions.add(`${disc[0]},${disc[1]}`);
            }
          });
        }
        
        // Check orange discs in home
        if (opponentDisc.color === PlayerColor.ORANGE) {
          orangeDiscs.forEach(disc => {
            if (homePositions.some(home => home[0] === disc[0] && home[1] === disc[1])) {
              occupiedHomePositions.add(`${disc[0]},${disc[1]}`);
            }
          });
        }
        
        // Find first available home position
        for (const homePos of homePositions) {
          if (!occupiedHomePositions.has(`${homePos[0]},${homePos[1]}`)) {
            targetHomePosition = homePos;
            break;
          }
        }
        
        if (targetHomePosition) {
          console.log(`Sending ${opponentDisc.color} disc ${opponentDisc.index} back to home at ${targetHomePosition}`);
          
          // Get the current position of the disc being knocked home
          let currentDiscPosition: [number, number];
          if (opponentDisc.color === PlayerColor.BLUE) {
            currentDiscPosition = blueDiscs[opponentDisc.index];
          } else if (opponentDisc.color === PlayerColor.GREEN) {
            currentDiscPosition = greenDiscs[opponentDisc.index];
          } else if (opponentDisc.color === PlayerColor.YELLOW) {
            currentDiscPosition = yellowDiscs[opponentDisc.index];
          } else if (opponentDisc.color === PlayerColor.ORANGE) {
            currentDiscPosition = orangeDiscs[opponentDisc.index];
          } else {
            currentDiscPosition = [0, 0]; // Fallback
          }
          
          // Move the disc instantly to home
          moveKnockedDiscToHome(
            opponentDisc.color,
            opponentDisc.index,
            currentDiscPosition,
            targetHomePosition
          );
        }
      });
    }
  };

  // Helper function to get player-specific data (discs and path)
  const getPlayerData = (playerColor: PlayerColor): { discs: [number, number][], path: number[][] } => {
    if (playerColor === PlayerColor.BLUE) {
      return { discs: blueDiscs, path: bluePath };
    } else if (playerColor === PlayerColor.GREEN) {
      return { discs: greenDiscs, path: greenPath };
    } else if (playerColor === PlayerColor.YELLOW) {
      return { discs: yellowDiscs, path: yellowPath };
          } else if (playerColor === PlayerColor.ORANGE) {
              return { discs: orangeDiscs, path: orangePath };
    } else {
      return { discs: [], path: [] };
    }
  };

  // Helper function to check if a specific disc can move
  const canDiscMove = (disc: [number, number], discIndex: number, dieValue: number, playerColor: PlayerColor, path: number[][]): boolean => {
    const inHome = isInHome(disc, playerColor);
    
    if (inHome) {
      // If disc is in home, it can only move out with a 6
      return dieValue === 6;
    } else {
      // Disc is on the path - check if it can move without going past the final square
      const currentPathIndex = path.findIndex(([row, col]) => row === disc[0] && col === disc[1]);
      
      if (currentPathIndex !== -1) {
        // Check if moving by dieValue would go beyond the final square
        const finalSquareIndex = path.length - 1;
        return currentPathIndex + dieValue <= finalSquareIndex;
      }
    }
    
    return false;
  };

  // Check if the current player has any valid moves available
  const hasValidMoves = (dieValue: number, playerColor: PlayerColor): boolean => {
    if (!dieValue) return false;
    
    const { discs, path } = getPlayerData(playerColor);
    
    console.log(`hasValidMoves called for ${playerColor}, dieValue: ${dieValue}, discs:`, discs);
    
    // Check if any disc can move
    for (let i = 0; i < discs.length; i++) {
      if (canDiscMove(discs[i], i, dieValue, playerColor, path)) {
        console.log(`Disc ${i} can move`);
        return true;
      }
    }
    
    // If we get here, no discs can move
    console.log(`No valid moves for ${playerColor}`);
    return false;
  };

  // Function to determine which specific discs can be moved
  const getMovableDiscs = (dieValue: number, playerColor: PlayerColor): number[] => {
    if (!dieValue) return [];
    
    const { discs, path } = getPlayerData(playerColor);
    const movableDiscs: number[] = [];
    
    for (let i = 0; i < discs.length; i++) {
      if (canDiscMove(discs[i], i, dieValue, playerColor, path)) {
        movableDiscs.push(i);
      }
    }
    
    return movableDiscs;
  };

  // Effect to update pulsating discs when die result changes
  useEffect(() => {
    // Clear pulsating discs when turn changes (dieResult might be from previous turn)
    if (currentTurnColor !== localPlayerColor) {
      setPulsatingDiscs(new Set());
      return;
    }
    
    // Only show pulsating discs if:
    // 1. There's a die result (player has rolled)
    // 2. It's the current player's turn
    // 3. It's the local player's turn
    // 4. The player hasn't made a move yet (moveMade is false)
    // 5. The die result is for the current turn (not from a previous turn)
    if (dieResult && currentTurnColor === localPlayerColor && !moveMade && hasRolled) {
      const movableDiscs = getMovableDiscs(dieResult, currentTurnColor);
      const newPulsatingDiscs = new Set<string>();
      
      movableDiscs.forEach(discIndex => {
        newPulsatingDiscs.add(`${currentTurnColor}-${discIndex}`);
      });
      
      setPulsatingDiscs(newPulsatingDiscs);
      console.log(`Setting pulsating discs for ${currentTurnColor}:`, Array.from(newPulsatingDiscs));
    } else {
      setPulsatingDiscs(new Set());
    }
  }, [dieResult, currentTurnColor, localPlayerColor, moveMade, hasRolled, blueDiscs, greenDiscs, yellowDiscs, orangeDiscs]);

  // Function to stop pulsating for a specific disc
  const stopPulsating = (playerColor: PlayerColor, discIndex: number) => {
    setPulsatingDiscs(prev => {
      const newSet = new Set(prev);
      newSet.delete(`${playerColor}-${discIndex}`);
      return newSet;
    });
  };

  // Function to instantly move a knocked disc to home
  const moveKnockedDiscToHome = (
    playerColor: PlayerColor,
    discIndex: number,
    startPosition: [number, number],
    endPosition: [number, number]
  ) => {
    console.log(`Moving ${playerColor} disc ${discIndex} from ${startPosition} to ${endPosition}`);
    
    // Removed thump sound to prevent crashes
    
    // Update the disc position instantly
    if (playerColor === PlayerColor.BLUE) {
      setBlueDiscs(prev => {
        const newDiscs = [...prev];
        newDiscs[discIndex] = endPosition;
        return newDiscs;
      });
    } else if (playerColor === PlayerColor.GREEN) {
      setGreenDiscs(prev => {
        const newDiscs = [...prev];
        newDiscs[discIndex] = endPosition;
        return newDiscs;
      });
    } else if (playerColor === PlayerColor.YELLOW) {
      setYellowDiscs(prev => {
        const newDiscs = [...prev];
        newDiscs[discIndex] = endPosition;
        return newDiscs;
      });
    } else if (playerColor === PlayerColor.ORANGE) {
      setOrangeDiscs(prev => {
        const newDiscs = [...prev];
        newDiscs[discIndex] = endPosition;
        return newDiscs;
      });
    }

    // Removed moveDisc call to prevent infinite loop
    // The disc position is updated locally and will sync through other mechanisms

    // Removed socket emission to prevent infinite loop
    // The disc return to home is already handled by the collision detection
  };

  const rollDie = async () => {
    // Set rolling state immediately to prevent multiple clicks
    setIsRolling(true);
    
    console.log('🎲 Rolling die - current forcedRollNumber:', forcedRollNumber);
    console.log('Roll die called - localPlayerColor:', localPlayerColor, 'currentTurnColor:', currentTurnColor);
    
    // Only allow rolling if it's the current player's turn
    if (localPlayerColor && localPlayerColor !== currentTurnColor) {
      console.log('Not your turn to roll');
      setIsRolling(false); // Reset if not allowed
      return;
    }
    
    // Mark that the player has rolled
    setHasRolled(true);
    
    setDieResult(null);
    
    // Add a small delay to ensure the rolling state is set before any async operations
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Play dice rolling sound
    Sounds.playDiceRollSound(); // don't await because we want the sound to overlap with the rolling animation below.
    
    try {
      console.log('Rolling die - socketRollDie:', !!socketRollDie, 'gameId:', gameId);
      
      // Use socket rolling if available, otherwise fallback to local
      if (socketRollDie && gameId) {
        console.log('Using socket rolling');
        if (forcedRollNumber) {
          console.log('⚠️ WARNING: Sending forced roll number to socket:', forcedRollNumber);
        }
        const response = await socketRollDie(gameId, forcedRollNumber || undefined);
        const result = response.result;
        console.log('Socket die result:', result);
        
        // The result will be handled by the dieRolled event listener
        // which will show the animation and result for all players
      } else {
        console.log('Using local rolling fallback');
        setTimeout(() => {
          const result = forcedRollNumber || Math.floor(Math.random() * 6) + 1;
          console.log('Local die result:', result);
          if (forcedRollNumber) {
            console.log('⚠️ WARNING: Using forced roll number:', forcedRollNumber, 'instead of random roll!');
          }
          
          // Use the same callback that socket rolling uses
          if (dieRollCallback) {
            dieRollCallback(result);
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Error rolling die:', error);
      setIsRolling(false);
    }
  };

  const getDieDisplay = () => {
    if (isRolling) {
      return '🎲';
    }
    if (dieResult) {
      return null; // We'll render the die face with CSS instead
    }
    return '🎲';
  };

  const renderDieFace = (number: number) => {
    const dots = [];
    const positions = {
      1: [[1, 1]],
      2: [[0, 0], [2, 2]],
      3: [[0, 0], [1, 1], [2, 2]],
      4: [[0, 0], [0, 2], [2, 0], [2, 2]],
      5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
      6: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]]
    };
    
    const positionsForNumber = positions[number as keyof typeof positions] || [];
    
    return (
      <div className="die-face">
        {positionsForNumber.map(([row, col], index) => (
          <div 
            key={index}
            className="die-dot"
            style={{
              gridRow: row + 1,
              gridColumn: col + 1
            }}
          />
        ))}
      </div>
    );
  };

  const renderExtraRollDie = () => {
    return (
      <div className="extra-roll-symbol">
        <img 
          src="/die-with-question-marks.png" 
          alt="Roll again" 
          style={{ 
            width: '100%', 
            height: '100%', 
            objectFit: 'contain' 
          }} 
        />
      </div>
    );
  };

  // Helper function to group all discs by position (for mixed colors)
  const groupAllDiscsByPosition = () => {
    const allDiscs: { position: [number, number]; color: PlayerColor; index: number }[] = [];
    
    // Only add discs for players that exist in the game
    if (currentGame?.players.some((player: Player) => player.color === 'blue')) {
      blueDiscs.forEach((disc, index) => {
        allDiscs.push({ position: disc, color: PlayerColor.BLUE, index });
      });
    }
    
    if (currentGame?.players.some((player: Player) => player.color === 'green')) {
      greenDiscs.forEach((disc, index) => {
        allDiscs.push({ position: disc, color: PlayerColor.GREEN, index });
      });
    }
    
    if (currentGame?.players.some((player: Player) => player.color === 'yellow')) {
      yellowDiscs.forEach((disc, index) => {
        allDiscs.push({ position: disc, color: PlayerColor.YELLOW, index });
      });
    }
    
    if (currentGame?.players.some((player: Player) => player.color === 'orange')) {
      console.log('Adding orange discs to allDiscs:', orangeDiscs);
      orangeDiscs.forEach((disc, index) => {
        allDiscs.push({ position: disc, color: PlayerColor.ORANGE, index });
      });
    }
    
    const groups: { [key: string]: { position: [number, number]; discs: { color: PlayerColor; index: number }[] } } = {};
    
    allDiscs.forEach(({ position, color, index }) => {
      const key = `${position[0]},${position[1]}`;
      if (!groups[key]) {
        groups[key] = { position, discs: [] };
      }
      groups[key].discs.push({ color, index });
    });
    
    return Object.values(groups);
  };



  // Helper function to render a group of discs with offsets (mixed colors)
  const renderMixedDiscGroup = (group: { position: [number, number]; discs: { color: PlayerColor; index: number }[] }) => {
    const [row, col] = group.position;
    const discCount = group.discs.length;
    const isSafeSquare = safeSquares.some(([safeRow, safeCol]) => safeRow === row && safeCol === col);
    const isExtraRollSquare = extraRollSquares.some(([extraRow, extraCol]) => extraRow === row && extraCol === col);
    
    // Debug logging for extra roll squares
    if (isExtraRollSquare) {
      console.log(`Rendering disc group on extra roll square [${row}, ${col}] with z-index: 100`);
    }
    
    return (
      <div 
        key={`mixed-${row}-${col}`} 
        className="disc-group"
        style={{
          zIndex: 100 // Always use high z-index for discs to ensure they appear on top
        }}
      >
        {/* Render all discs with offsets for stacking */}
        {group.discs.map(({ color, index: discIndex }, stackIndex) => {
          const zIndex = 100 + stackIndex; // Always use high z-index for discs
          
          let onClickHandler: (discIndex: number) => void;
          if (color === PlayerColor.BLUE) {
            onClickHandler = handleBlueDiscClick;
          } else if (color === PlayerColor.GREEN) {
            onClickHandler = handleGreenDiscClick;
          } else if (color === PlayerColor.YELLOW) {
            onClickHandler = handleYellowDiscClick;
          } else if (color === PlayerColor.ORANGE) {
            onClickHandler = handleOrangeDiscClick;
          } else {
            onClickHandler = () => {}; // No handler for other colors yet
          }
          
          // Calculate offset for stacking - each disc is slightly offset
          const offsetX = stackIndex * 2; // 2px horizontal offset
          const offsetY = stackIndex * 2; // 2px vertical offset
          
          // Check if this disc should pulsate
          const shouldPulsate = pulsatingDiscs.has(`${color}-${discIndex}`);
          
          return (
            <div
              key={`${color}-disc-${discIndex}`}
              className={`${color.toLowerCase()}-disc stacked-disc ${shouldPulsate ? 'pulsating-disc' : ''}`}
              onClick={() => {
                if (shouldPulsate) {
                  stopPulsating(color, discIndex);
                }
                onClickHandler(discIndex);
              }}
              style={{
                cursor: dieResult && currentTurnColor === color ? 'pointer' : 'default',
                zIndex: shouldPulsate ? 200 : zIndex, // Higher z-index for pulsating discs
                position: 'absolute',
                transform: `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`,
                transition: 'transform 0.2s ease',
                '--offset-x': `${offsetX}px`,
                '--offset-y': `${offsetY}px`
              } as React.CSSProperties}
              title={`${color} disc ${discIndex + 1}`}
            >

            </div>
          );
        })}
      </div>
    );
  };



  return (
    <div className="ludo-board">
      {showDebugMode && (
        <div className="dev-options">
          <div className="debug-info" style={{ 
            fontSize: '12px', 
            color: '#666', 
            marginBottom: '10px',
            padding: '8px',
            backgroundColor: '#f0f0f0',
            borderRadius: '4px',
            border: '1px solid #ddd'
          }}>
            <strong>Debug Mode Active</strong> - Press Ctrl+Shift+D to toggle. Use these tools to test and fix game issues.
          </div>
          <div className="coordinate-toggle">
            <label>
              <input
                type="checkbox"
                checked={showCoordinates}
                onChange={(e) => setShowCoordinates(e.target.checked)}
              />
              Show Coordinates
            </label>
          </div>
          <div className="force-roll-dice">
            {[1, 2, 3, 4, 5, 6].map((number) => (
              <button
                key={number}
                className={`force-die ${forcedRollNumber === number ? 'active' : ''}`}
                style={{
                  opacity: ((localPlayerColor && localPlayerColor !== currentTurnColor) || (hasRolled && !moveMade)) ? 0.5 : 1,
                  cursor: ((localPlayerColor && localPlayerColor !== currentTurnColor) || (hasRolled && !moveMade)) ? 'not-allowed' : 'pointer'
                }}
                onClick={() => {
                  console.log('Die clicked:', number);
                  console.log('Current isRolling state:', isRolling);
                  
                  // Prevent multiple rapid clicks
                  if (isRolling) {
                    console.log('Already rolling, ignoring click');
                    return;
                  }
                  
                  if (isRolling) {
                    console.log('Already rolling (state), ignoring click');
                    return;
                  }
                  
                  // Only allow rolling if it's the current player's turn
                  if (localPlayerColor && localPlayerColor !== currentTurnColor) {
                    console.log('Not your turn to roll');
                    return;
                  }
                  
                  // Prevent rolling if player has already rolled and hasn't made a move yet
                  if (hasRolled && !moveMade) {
                    console.log('Die click blocked - already rolled, waiting for move');
                    return;
                  }
                  
                  // Play dice rolling sound
                  Sounds.playDiceRollSound();
                  
                  // Set the forced roll number
                  setForcedRollNumber(number);
                  
                  // Set rolling state immediately to prevent multiple clicks
                  console.log('Starting roll for number:', number);
                  setIsRolling(true);
                  setHasRolled(true); // Mark that the player has rolled
                  setDieResult(null);
                  
                  // Simulate rolling animation
                  setTimeout(() => {
                    console.log('Roll complete, setting result to:', number);
                    setDieResult(number);
                    setMoveMade(false); // Reset move flag
                    setIsRolling(false);
                    onDieRoll?.(number);
                    
                    // Check if the current player has any valid moves (only for the current player)
                    // Only auto-switch if no valid moves AND not a 6
                    if (localPlayerColor === currentTurnColor && number !== 6) {
                      const hasMoves = hasValidMoves(number, currentTurnColor);
                      console.log(`Current player check - hasMoves: ${hasMoves}, result: ${number}`);
                      if (!hasMoves) {
                        console.log('No valid moves available, auto-switching turn');
                        setTimeout(() => {
                          setDieResult(null);
                          setHasRolled(false); // Reset rolled state when turn switches
                          if (switchTurn && gameId) {
                            switchTurn(gameId, false).catch(error => {
                              console.error('Error switching turn:', error);
                            });
                          }
                        }, 2000); // Give 2 seconds for the player to see the result
                      }
                    } else if (localPlayerColor === currentTurnColor && number === 6) {
                      // Player rolled a 6, they get another turn - don't auto-switch
                      console.log('Player rolled a 6, waiting for them to make a move');
                    }
                  }, 1000);
                }}
                title={`Roll ${number}`}
              >
                {number}
              </button>
            ))}
          </div>
          <button
            className="show-celebration-btn"
            onClick={testCelebration}
            title="Test the victory celebration"
          >
            Show Celebration
          </button>


          <button
            className="test-win-btn"
            onClick={() => {
              // Force all discs to final position for testing
              const finalDiscs = [[8, 7], [8, 7], [8, 7], [8, 7]] as [number, number][];
              setBlueDiscs(finalDiscs);
              console.log('Forced blue discs to final position for testing');
              
              // Check win condition directly with the new positions
              const finalSquare: [number, number] = [8, 7];
              const hasWon = finalDiscs.every(disc => disc[0] === finalSquare[0] && disc[1] === finalSquare[1]);
              console.log('Final discs:', finalDiscs);
              console.log('Final square:', finalSquare);
              console.log('Has won:', hasWon);
              
              if (hasWon) {
                console.log('Blue should win now - triggering victory');
                triggerVictory(PlayerColor.BLUE);
              } else {
                console.log('Blue did not win - something is wrong with the check');
              }
            }}
            title="Force blue player to win for testing"
          >
            Force Blue Win
          </button>

          <button
            className="force-switch-button"
            onClick={() => {
              console.log('Force switch turn clicked');
              if (switchTurn && gameId) {
                console.log('Calling switchTurn function from debug menu with force=true');
                switchTurn(gameId, true).then(result => {
                  console.log('Force switch turn result:', result);
                  // Reset die state
                  setDieResult(null);
                  setHasRolled(false);
                  setMoveMade(false);
                  setForcedRollNumber(null);
                }).catch(error => {
                  console.error('Error force switching turn:', error);
                });
              }
            }}
            title="Force switch to next player's turn"
          >
            🔄 Force Switch Turn
          </button>




        </div>
      )}
      <div className="board-wrapper">
        <div className="board-grid">
          {Array.from({ length: 15 }, (_, row) => (
            <div key={row} className="board-row">
              {Array.from({ length: 15 }, (_, col) => (
              <div 
                key={col} 
                className={getCellClass(row, col)} 
                data-row={row} 
                data-col={col}
                style={{
                  // Final squares with colored borders using outline
                  ...(row === 7 && col === 6 && { 
                    backgroundColor: 'white',
                    outline: '3px solid #ff9500',
                    outlineOffset: '-3px'
                  }), // Orange final square
                  ...(row === 6 && col === 7 && { 
                    backgroundColor: 'white',
                    outline: '3px solid #51cf66',
                    outlineOffset: '-3px'
                  }), // Green final square
                  ...(row === 7 && col === 8 && { 
                    backgroundColor: 'white',
                    outline: '3px solid #ffd43b',
                    outlineOffset: '-3px'
                  }), // Yellow final square
                  ...(row === 8 && col === 7 && { 
                    backgroundColor: 'white',
                    outline: '3px solid #339af0',
                    outlineOffset: '-3px'
                  }), // Blue final square
                }}
              >
                {showCoordinates && (
                  <span className="coordinate-label">
                    {row},{col}
                  </span>
                )}
                {safeSquares.some(([safeRow, safeCol]) => safeRow === row && safeCol === col) && (
                  <div className="safe-shield"></div>
                )}
                {cornerExtraRollSquares.some(([dieRow, dieCol]) => dieRow === row && dieCol === col) && (
                  <div className="extra-roll-die-container">
                    {renderExtraRollDie()}
                  </div>
                )}
                {groupAllDiscsByPosition()
                  .filter(group => group.position[0] === row && group.position[1] === col)
                  .map(group => renderMixedDiscGroup(group))
                }
                
                {/* Center trophy */}
                {row === 7 && col === 7 && (
                  <div className="center-trophy">
                    🏆
                  </div>
                )}
                
                {/* Home stretch arrows */}
                {/* Orange arrow pointing right at [7,0] */}
                {row === 7 && col === 0 && (
                                      <div className="home-arrow orange-arrow">
                    ➡️
                  </div>
                )}
                
                {/* Green arrow pointing down at [0,7] */}
                {row === 0 && col === 7 && (
                  <div className="home-arrow green-arrow">
                    ⬇️
                  </div>
                )}
                
                {/* Yellow arrow pointing left at [7,14] */}
                {row === 7 && col === 14 && (
                  <div className="home-arrow yellow-arrow">
                    ⬅️
                  </div>
                )}
                
                {/* Blue arrow pointing up at [14,7] */}
                {row === 14 && col === 7 && (
                  <div className="home-arrow blue-arrow">
                    ⬆️
                  </div>
                )}
                
                {/* Player names in home areas */}
                {currentGame?.players.map((player: Player) => {
                  // Green home area - show pill centered across squares 1,10 to 1,13
                  if (player.color === 'green' && row === 1 && col === 11) {
                    return (
                      <div key={`${player.id}-green`} className="player-name-overlay green-name home-pill green-home-pill">
                        {player.name}
                      </div>
                    );
                  }
                  
                  // Blue home area - show pill centered across squares 10,1 to 10,4
                  if (player.color === 'blue' && row === 10 && col === 2) {
                    return (
                      <div key={`${player.id}-blue`} className="player-name-overlay blue-name home-pill blue-home-pill">
                        {player.name}
                      </div>
                    );
                  }
                  
                  // Orange home area - show pill centered across squares 1,1 to 1,4
                  if (player.color === 'orange' && row === 1 && col === 2) {
                    return (
                                              <div key={`${player.id}-orange`} className="player-name-overlay orange-name home-pill orange-home-pill">
                        {player.name}
                      </div>
                    );
                  }
                  
                  // Yellow home area - show pill centered across squares 10,10 to 10,13
                  if (player.color === 'yellow' && row === 10 && col === 11) {
                    return (
                      <div key={`${player.id}-yellow`} className="player-name-overlay yellow-name home-pill yellow-home-pill">
                        {player.name}
                      </div>
                    );
                  }
                  
                  return null;
                })}
                
                {/* Placeholder indicators for colors without players */}
                                  {/* Orange home squares: [2,1], [2,2], [2,3], [2,4] */}
                {!currentGame?.players.some((player: Player) => player.color === 'orange') && 
                 (row === 2 && (col === 1 || col === 2 || col === 3 || col === 4)) && (
                                      <div className="placeholder-disc orange-placeholder" />
                )}
                
                {/* Yellow home squares: [11,10], [11,11], [11,12], [11,13] */}
                {!currentGame?.players.some((player: Player) => player.color === 'yellow') && 
                 (row === 11 && (col === 10 || col === 11 || col === 12 || col === 13)) && (
                  <div className="placeholder-disc yellow-placeholder" />
                )}
                
                {/* Green home squares: [2,10], [2,11], [2,12], [2,13] */}
                {!currentGame?.players.some((player: Player) => player.color === 'green') && 
                 (row === 2 && (col === 10 || col === 11 || col === 12 || col === 13)) && (
                  <div className="placeholder-disc green-placeholder" />
                )}
                
                {/* Blue home squares: [11,1], [11,2], [11,3], [11,4] */}
                {!currentGame?.players.some((player: Player) => player.color === 'blue') && 
                 (row === 11 && (col === 1 || col === 2 || col === 3 || col === 4)) && (
                  <div className="placeholder-disc blue-placeholder" />
                )}
              </div>
            ))}
          </div>
        ))}
        {/* Individual dice in home areas */}
        {currentGame?.players.map((player: Player) => {
          const isCurrentTurn = player.color === currentTurnColor;
          const isLocalPlayer = player.color === localPlayerColor;
          const canRoll = isCurrentTurn && isLocalPlayer && !isRolling && !(hasRolled && !moveMade);
          
          // Debug logging for the first player's die
          if (isLocalPlayer && isCurrentTurn) {
            console.log(`=== DIE ROLL DEBUG FOR ${player.color.toUpperCase()} ===`);
            console.log('isCurrentTurn:', isCurrentTurn);
            console.log('isLocalPlayer:', isLocalPlayer);
            console.log('isRolling:', isRolling);
            console.log('hasRolled:', hasRolled);
            console.log('moveMade:', moveMade);
            console.log('canRoll:', canRoll);
            console.log('Game state:', currentGame?.gameState);
          }
          
          // Position dice below the row of discs, centered horizontally
          // The die should be as big as the space that the four original discs take
          // Each grid cell is 43.125px
          const cellSize = 43.125;
          let diePosition: React.CSSProperties = {};
          if (player.color === 'orange') {
            // Orange discs are in row 2, cols 1-4 (center at col 2.5)
            // Die should be below in row 3.85 (moved down to center between discs and bottom), centered horizontally at col 2.95 (moved right slightly)
            diePosition = { 
              top: `${3.85 * cellSize}px`, 
              left: `${2.95 * cellSize}px`,
              transform: 'translate(-50%, -50%)'
            };
          } else if (player.color === 'green') {
            // Green discs are in row 2, cols 10-13 (center at col 11.5)
            // Die should be below in row 3.85 (perfect vertically), centered horizontally at col 11.95 (moved right slightly more)
            diePosition = { 
              top: `${3.85 * cellSize}px`, 
              left: `${11.95 * cellSize}px`,
              transform: 'translate(-50%, -50%)'
            };
          } else if (player.color === 'blue') {
            // Blue discs are in row 11, cols 1-4 (center at col 2.5)
            // Die should be below in row 12.9 (moved down slightly more), centered horizontally at col 2.95
            diePosition = { 
              top: `${12.9 * cellSize}px`, 
              left: `${2.95 * cellSize}px`,
              transform: 'translate(-50%, -50%)'
            };
          } else if (player.color === 'yellow') {
            // Yellow discs are in row 11, cols 10-13 (center at col 11.5)
            // Die should be below in row 12, centered horizontally at col 11.1 (moved left slightly)
            diePosition = { 
              top: `${12 * cellSize}px`, 
              left: `${11.1 * cellSize}px`,
              transform: 'translate(-50%, -50%)'
            };
          }
          
          return (
            <button 
              key={`die-${player.color}`}
              className={`player-die ${isCurrentTurn ? 'active' : ''} ${isRolling && isCurrentTurn ? 'rolling' : ''} ${dieResult && isCurrentTurn ? 'result' : ''}`}
              style={{ 
                ...diePosition,
                backgroundColor: dieResult && isCurrentTurn ? 'white' : getDieColor(player.color),
                opacity: canRoll ? 1 : 0.5,
                cursor: canRoll ? 'pointer' : 'not-allowed',
                userSelect: 'none',
                border: 'none',
                padding: 0,
                margin: 0,
                width: '86.25px', // 2 squares * 43.125px - as big as the space that the four original discs take
                height: '86.25px', // 2 squares * 43.125px
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '40px', // Larger font for bigger die
                position: 'absolute',
                zIndex: 15
              }}
              onClick={canRoll ? handleDieClick : undefined}
              disabled={!canRoll}
              title={`${player.name}'s die${isCurrentTurn ? ' - Your turn!' : ''}`}
            >
              {dieResult && isCurrentTurn ? renderDieFace(dieResult) : <span className="die-text" style={{ fontSize: '14px' }}>🎲</span>}
            </button>
          );
        })}

        </div>
      </div>

      {/* Starter Selection Overlay */}
      {showStarterSelection && currentGame?.players && (
        <StarterSelection
          players={currentGame.players}
          onSelectionComplete={handleStarterSelectionComplete}
          currentGame={currentGame}
        />
      )}

      {/* Waiting for Players Screen */}
      {currentGame?.gameState === GameState.WAITING && currentGame?.players && currentGame.players.length === 1 && (
        <div className="start-game-overlay">
          <div className="start-game-container">
            <button 
              className="close-dialog-btn"
              onClick={() => {
                // Close the dialog by going back to lobby
                window.location.reload(); // Simple approach - reload to go back to lobby
              }}
              title="Close"
            >
              ✕
            </button>
            <h2>Waiting for Players</h2>
            <p>Share the Game ID with other players to join!</p>
            {gameId && (
              <div className="game-id-display">
                <span className="game-id-label">Game ID:</span>
                <span className="game-id-value">{gameId}</span>
                <button 
                  className="copy-game-id-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(gameId);
                    // Show a brief "Copied!" message
                    const btn = document.querySelector('.copy-game-id-btn') as HTMLButtonElement;
                    if (btn) {
                      const originalSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2v1"></path>
                      </svg>`;
                      btn.innerHTML = '✓';
                      btn.style.color = '#51cf66';
                      setTimeout(() => {
                        btn.innerHTML = originalSVG;
                        btn.style.color = 'white';
                      }, 2000);
                    }
                  }}
                  title="Copy Game ID"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2v1"></path>
                  </svg>
                </button>
              </div>
            )}
            <div className="waiting-players">
              <div className="current-players">
                <h3>Current Players:</h3>
                {currentGame.players.map((player: any, index: number) => (
                  <div key={player.id} className={`player-item ${player.color}`}>
                    <span className="player-name">{player.name}</span>
                    <span className="player-color-badge">{player.color}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Start Game Button */}
      {currentGame?.gameState === GameState.WAITING && currentGame?.players && currentGame.players.length >= 2 && (
        <div className="start-game-overlay">
          <div className="start-game-container">
            <h2>Ready to Start?</h2>
            <p>{currentGame.players.length} players have joined</p>
            <div className="waiting-players">
              <div className="current-players">
                <h3>Players:</h3>
                {currentGame.players.map((player: any, index: number) => (
                  <div key={player.id} className={`player-item ${player.hasChosenColor ? player.color : 'pick'}`}>
                    <span className="player-name">{player.name}</span>
                    <span className={`player-color-badge ${player.hasChosenColor ? player.color : 'pick'}`}>
                      {player.hasChosenColor ? player.color.toUpperCase() : 'PICK'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <button 
              className="start-game-button"
              onClick={handleStartGame}
              disabled={!currentGame.players.every((player: any) => player.hasChosenColor)}
            >
              🎲 Start Game
            </button>
            {!currentGame.players.every((player: any) => player.hasChosenColor) && (
              <p className="waiting-message">
                Waiting for all players to choose their colors...
              </p>
            )}
          </div>
        </div>
      )}

      {/* Victory Celebration - Always show if showVictory is true */}
      {showVictory && (
        <div className="victory-overlay" style={{ zIndex: 9999 }}>
          <div 
            className="victory-message"
            style={{
              background: winnerColor === PlayerColor.BLUE ? 'linear-gradient(135deg, #339af0 0%, #1c7ed6 100%)' :
                         winnerColor === PlayerColor.GREEN ? 'linear-gradient(135deg, #51cf66 0%, #37b24d 100%)' :
                         winnerColor === PlayerColor.YELLOW ? 'linear-gradient(135deg, #ffd43b 0%, #fcc419 100%)' :
                         winnerColor === PlayerColor.ORANGE ? 'linear-gradient(135deg, #ff9500 0%, #ff8c00 100%)' :
                         'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            }}
          >
            <h1 className="victory-title">
              🎉 {winnerColor?.toUpperCase()} WINS! 🎉
            </h1>
            <p style={{ marginTop: '10px', fontSize: '18px' }}>
              Game State: {currentGame?.gameState || 'unknown'}
            </p>
            <button
              className="close-victory-btn"
              onClick={() => {
                console.log('Manual close button clicked');
                setShowVictory(false);
                setConfetti([]);
              }}
              style={{
                marginTop: '20px',
                padding: '10px 20px',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                border: '2px solid white',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Confetti Animation */}
      {confetti.map((piece) => (
        <div
          key={piece.id}
          className="confetti-piece"
          style={{
            position: 'fixed',
            left: `${piece.x}px`,
            top: `${piece.y}px`,
            width: '8px',
            height: '8px',
            backgroundColor: piece.color,
            borderRadius: '50%',
            transform: `rotate(${piece.rotation}deg)`,
            zIndex: 1000,
            pointerEvents: 'none',
            animation: `fall ${piece.velocity}s linear infinite`
          }}
        />
      ))}

      {/* Explosion Effects */}
      {explosions.map((explosion) => (
        <div
          key={explosion.id}
          className="explosion"
          style={{
            left: `${explosion.x}px`,
            top: `${explosion.y}px`,
            transform: 'translate(-50%, -50%)'
          }}
        />
      ))}
    </div>
  );
};
