import React, { useState, useEffect } from 'react';
import { PlayerColor, Player } from '../types/game';
import { Sounds } from '../helpers/Sounds';
import './LudoBoard.css';

interface LudoBoardProps {
  localPlayerColor?: PlayerColor;
  onPawnClick?: (playerColor: PlayerColor, pawnId: number) => void;
  onDieRoll?: (result: number) => void;
  gameId?: string;
  socketRollDie?: (gameId: string) => Promise<{ result: number }>;
  switchTurn?: (gameId: string) => Promise<{ success: boolean }>;
  moveDisc?: (gameId: string, playerColor: PlayerColor, discIndex: number, newPosition: [number, number]) => Promise<{ success: boolean }>;
  socket?: any;
  currentGame?: any;
  setDieRollCallback?: (callback: (result: number) => void) => void;
  pendingDieRoll?: number | null;
}

export const LudoBoard: React.FC<LudoBoardProps> = ({ localPlayerColor, onPawnClick, onDieRoll, gameId, socketRollDie, switchTurn, moveDisc, socket, currentGame, setDieRollCallback, pendingDieRoll }) => {
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
  const [blueDiscs, setBlueDiscs] = useState<[number, number][]>([
    [11, 2], [11, 3], [12, 2], [12, 3] // Starting positions
  ]);

   // Green disc positions: [row, col]
   const [greenDiscs, setGreenDiscs] = useState<[number, number][]>([
    [2, 11], [2, 12], [3, 11], [3, 12] // Starting positions
  ]);

   // Yellow disc positions: [row, col]
   const [yellowDiscs, setYellowDiscs] = useState<[number, number][]>([
    [11, 11], [11, 12], [12, 11], [12, 12] // Starting positions
  ]);

   // Red disc positions: [row, col]
   const [redDiscs, setRedDiscs] = useState<[number, number][]>([
    [2, 2], [2, 3], [3, 2], [3, 3] // Starting positions
  ]);
  
  // Animation state
  const [animatingDisc, setAnimatingDisc] = useState<number | null>(null);
  const [animationPath, setAnimationPath] = useState<[number, number][]>([]);
  const [animationIndex, setAnimationIndex] = useState(0);
  
  // Removed animation state - using instant movement instead

  // Celebration state
  const [showVictory, setShowVictory] = useState(false);
  const [winnerColor, setWinnerColor] = useState<PlayerColor | null>(null);
  const [confetti, setConfetti] = useState<Array<{id: number, x: number, y: number, color: string, rotation: number, velocity: number}>>([]);
  const [explosions, setExplosions] = useState<Array<{id: number, x: number, y: number}>>([]);

  


  // Disable the die completely when rolling or when player has already rolled
  const handleDieClick = async () => {
    if (isRolling) {
      console.log('Die click blocked - already rolling');
      return;
    }
    
    // Prevent rolling if player has already rolled and hasn't made a move yet
    if (hasRolled && !moveMade) {
      console.log('Die click blocked - already rolled, waiting for move');
      return;
    }
    
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
      setDieResult(null);
      setMoveMade(false);
      setHasRolled(false);
      setIsRolling(false);
      setShouldGetExtraRoll(false);
    }
  }, [currentTurnColor, localPlayerColor]);

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
        } else if (playerColor === PlayerColor.RED) {
          currentDiscs = redDiscs;
          path = redPath;
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
            Sounds.playSound().catch(error => console.log('Error playing sound:', error));
            
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
                } else if (playerColor === PlayerColor.RED) {
                  setRedDiscs(prev => {
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
                    // Grant extra roll if this is the local player's move - ONLY at final position
                    if (playerColor === localPlayerColor) {
                      setShouldGetExtraRoll(true);
                      console.log('Extra roll granted for landing on extra roll square at final position');
                    }
                  } else if (stepIndex === animationSteps.length - 1) {
                    // Play regular sound for final position if it's not an extra roll square
                    Sounds.playSound().catch(error => console.log('Error playing sound:', error));
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
      } else if (playerColor === PlayerColor.RED) {
        setRedDiscs(prev => {
          const newDiscs = [...prev];
          newDiscs[discIndex] = newPosition;
          return newDiscs;
        });
      }
      
      // Handle disc collision after immediate movement
      handleDiscCollision(newPosition, playerColor);
      
      // Play sound for immediate movement
      if (isExtraRollSquare(newPosition)) {
        Sounds.playExtraRollSound().catch(error => console.log('Error playing extra roll sound:', error));
        // Grant extra roll if this is the local player's move
        if (playerColor === localPlayerColor) {
          setShouldGetExtraRoll(true);
          console.log('Extra roll granted for landing on extra roll square');
        }
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
      } else if (playerColor === PlayerColor.RED) {
        currentDiscPosition = redDiscs[discIndex];
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
        // Handle extra roll logic
        if (localPlayerColor === currentTurnColor) {
          if (shouldGetExtraRoll) {
            // Player landed on extra roll square, they get another turn regardless of die result
            console.log('Player landed on extra roll square, granting extra roll');
            setShouldGetExtraRoll(false); // Reset the flag
            // Don't auto-switch turn, let them roll again
          } else if (result !== 6) {
            // Normal case: check if player has valid moves
            const hasMoves = hasValidMoves(result, currentTurnColor);
            console.log(`Current player check - hasMoves: ${hasMoves}, result: ${result}`);
            if (!hasMoves) {
              console.log('No valid moves available, auto-switching turn');
              setTimeout(() => {
                setDieResult(null);
                setHasRolled(false); // Reset rolled state when turn switches
                if (switchTurn && gameId) {
                  switchTurn(gameId).catch(error => {
                    console.error('Error switching turn:', error);
                  });
                }
              }, 2000); // Give 2 seconds for the player to see the result
            }
          } else if (result === 6) {
            // Player rolled a 6, they get another turn - don't auto-switch
            console.log('Player rolled a 6, waiting for them to make a move');
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

  const redSquares = [
    // Top row
    [0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5],
    // Left and right columns
    [1, 0], [1, 5], [2, 0], [2, 5], [3, 0], [3, 5], [4, 0], [4, 5],
    // Bottom row
    [5, 0], [5, 1], [5, 2], [5, 3], [5, 4], [5, 5],
    // Path
    [6, 1], [7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]
  ];

  const greenSquares = [
    // Top row
    [0, 9], [0, 10], [0, 11], [0, 12], [0, 13], [0, 14],
    // Left and right columns
    [1, 9], [1, 14], [2, 9], [2, 14], [3, 9], [3, 14], [4, 9], [4, 14],
    // Bottom row
    [5, 9], [5, 10], [5, 11], [5, 12], [5, 13], [5, 14],
    // Path
    [1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [1, 8], [6, 7]
  ];

  const blueSquares = [
    // Top row
    [9, 0], [9, 1], [9, 2], [9, 3], [9, 4], [9, 5],
    // Left and right columns
    [10, 0], [10, 5], [11, 0], [11, 5], [12, 0], [12, 5], [13, 0], [13, 5],
    // Bottom row
    [14, 0], [14, 1], [14, 2], [14, 3], [14, 4], [14, 5],
    // Path
    [13, 6], [13, 7], [9, 7], [10, 7], [11, 7], [12, 7], [8, 7]
  ];

  const yellowSquares = [
    // Top row
    [9, 9], [9, 10], [9, 11], [9, 12], [9, 13], [9, 14],
    // Left and right columns
    [10, 9], [10, 14], [11, 9], [11, 14], [12, 9], [12, 14], [13, 9], [13, 14],
    // Bottom row
    [14, 9], [14, 10], [14, 11], [14, 12], [14, 13], [14, 14],
    // Path
    [7, 9], [7, 10], [7, 11], [7, 12], [7, 13], [8, 13], [7, 8]
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

    // Red player's complete path from start to finish
  const redPath = [
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
    // Red corner
    ...Object.fromEntries(redSquares.map(([row, col]) => [`${row},${col}`, 'board-cell red-corner'])),
    
    // Green corner
    ...Object.fromEntries(greenSquares.map(([row, col]) => [`${row},${col}`, 'board-cell green-corner'])),
    
    // Blue corner
    ...Object.fromEntries(blueSquares.map(([row, col]) => [`${row},${col}`, 'board-cell blue-corner'])),
    
    // Yellow corner
    ...Object.fromEntries(yellowSquares.map(([row, col]) => [`${row},${col}`, 'board-cell yellow-corner'])),
    
    // Black path
    ...Object.fromEntries(graySquares.map(([row, col]) => [`${row},${col}`, 'board-cell black-path'])),
  };

  const getCellClass = (row: number, col: number) => {
    const key = `${row},${col}`;
    const baseClass = cellClassMap[key] || 'board-cell';
    
    // Check if this cell is part of any player's path
    const isPathCell = bluePath.some(([pathRow, pathCol]) => pathRow === row && pathCol === col) ||
                      greenPath.some(([pathRow, pathCol]) => pathRow === row && pathCol === col) ||
                      yellowPath.some(([pathRow, pathCol]) => pathRow === row && pathCol === col) ||
                      redPath.some(([pathRow, pathCol]) => pathRow === row && pathCol === col);
    
    // Add path-cell class if it's a path square, regardless of whether it's also a corner square
    return isPathCell ? `${baseClass} path-cell` : baseClass;
  };

  const getDieColor = (playerColor?: PlayerColor) => {
    const color = playerColor || currentTurnColor;
    switch (color) {
      case PlayerColor.RED: return '#ff6b6b';
      case PlayerColor.GREEN: return '#51cf66';
      case PlayerColor.BLUE: return '#339af0';
      case PlayerColor.YELLOW: return '#ffd43b';
      default: return '#ccc';
    }
  };

  const handleDiscClick = async (discIndex: number) => {
    
    if (!dieResult || currentTurnColor !== PlayerColor.BLUE || animatingDisc !== null) return;
    
    const discPosition = blueDiscs[discIndex];
    const isInStartingPosition = [11, 2].includes(discPosition[0]) && [2, 3].includes(discPosition[1]) ||
                                [12, 2].includes(discPosition[0]) && [2, 3].includes(discPosition[1]);
    
    // If disc is in starting position, it can only move on a 6
    if (isInStartingPosition && dieResult !== 6) {
      return;
    }
    
    // If disc is in starting position and we rolled a 6, move to starting path position
    if (isInStartingPosition && dieResult === 6) {
      // Animate from starting position to [13, 6]
      const animationSteps: [number, number][] = [[13, 6]];
      setAnimatingDisc(discIndex);
      setAnimationPath(animationSteps);
      setAnimationIndex(0);
      
      // Play sound immediately when animation starts
      Sounds.playSound().catch(error => console.log('Error playing sound:', error));
      
      const newDiscs = [...blueDiscs];
      newDiscs[discIndex] = animationSteps[0];
      setBlueDiscs(newDiscs);
      
      // Emit socket event for disc movement
      if (moveDisc && gameId) {
        moveDisc(gameId, PlayerColor.BLUE, discIndex, animationSteps[0]).catch(error => {
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
        setHasRolled(false); // Reset rolled state after move
        
        // Handle disc collision after movement
        handleDiscCollision(animationSteps[0], PlayerColor.BLUE);
        
        // Check for victory FIRST - this should override all other logic
        if (checkForWinner(PlayerColor.BLUE)) {
          console.log('Blue player has won!');
          triggerVictory(PlayerColor.BLUE);
          return; // Exit immediately - no more turns or extra rolls
        }
        
        // Only check for extra roll squares and turn switching if the player hasn't won
        if (isExtraRollSquare(animationSteps[0])) {
          console.log('Blue player landed on extra roll square from starting position, granting extra roll');
          setShouldGetExtraRoll(true);
        } else {
          // Only switch turn if we didn't roll a 6 (6 gives another turn)
          if (dieResult !== 6) {
            console.log('Blue player starting position move completed, switching turn to green (not a 6)');
            setTimeout(() => {
              if (switchTurn && gameId) {
                console.log('Calling switchTurn function');
                switchTurn(gameId).then(result => {
                  console.log('SwitchTurn result:', result);
                }).catch(error => {
                  console.error('Error switching turn:', error);
                });
              }
            }, 100); // Small delay to ensure animation is complete
          } else {
            console.log('Blue player rolled a 6, keeping turn for another roll');
          }
        }
      }, 200);
      return;
    }
    
    // For discs already on the path, follow the exact path with animation
    const currentPathIndex = bluePath.findIndex(([row, col]) => row === discPosition[0] && col === discPosition[1]);
    
    console.log('Blue disc path movement - currentPathIndex:', currentPathIndex, 'discPosition:', discPosition);
    
    if (currentPathIndex !== -1) {
      // Check if this move would go beyond the final square
      const finalSquareIndex = bluePath.length - 1;
      const distanceToFinal = finalSquareIndex - currentPathIndex;
      
      // If the die roll would go beyond the final square, the move is invalid
      if (currentPathIndex + dieResult > finalSquareIndex) {
        console.log('Blue disc: Invalid move - would go beyond final square');
        return;
      }
      
      const newPathIndex = currentPathIndex + dieResult;
      const animationSteps: [number, number][] = bluePath.slice(currentPathIndex + 1, newPathIndex + 1) as [number, number][];
      
      console.log('Blue disc animation steps:', animationSteps);
      
      if (animationSteps.length > 0) {
        setAnimatingDisc(discIndex);
        setAnimationPath(animationSteps);
        setAnimationIndex(0);
        
        console.log('Blue disc - playing initial sound');
        // Play sound immediately when animation starts
        Sounds.playSound().catch(error => console.log('Error playing sound:', error));
        
        // Start animation
        const animateStep = (stepIndex: number) => {
          if (stepIndex < animationSteps.length) {
            const newDiscs = [...blueDiscs];
            newDiscs[discIndex] = animationSteps[stepIndex];
            setBlueDiscs(newDiscs);
            setAnimationIndex(stepIndex);
            
            // Emit socket event for disc movement (only on final position)
            if (stepIndex === animationSteps.length - 1 && moveDisc && gameId) {
              console.log('Emitting blue disc movement to server');
              moveDisc(gameId, PlayerColor.BLUE, discIndex, animationSteps[stepIndex]).catch(error => {
                console.error('Error emitting disc movement:', error);
              });
            }
            
            // Play landing sound for each step (except the first one, which is handled by initial sound)
            if (stepIndex > 0) {
              // Only play extra roll sound if this is the final position and it's an extra roll square
              if (stepIndex === animationSteps.length - 1 && isExtraRollSquare(animationSteps[stepIndex])) {
                Sounds.playExtraRollSound().catch(error => console.log('Error playing extra roll sound:', error));
              } else if (stepIndex === animationSteps.length - 1) {
                // Play regular sound for final position if it's not an extra roll square
                Sounds.playSound().catch(error => console.log('Error playing sound:', error));
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
            setHasRolled(false); // Reset rolled state after move
            
            // Handle disc collision after movement
            const finalPosition = animationSteps[animationSteps.length - 1];
            handleDiscCollision(finalPosition, PlayerColor.BLUE);
            
            // Check for victory FIRST - this should override all other logic
            if (checkForWinner(PlayerColor.BLUE)) {
              console.log('Blue player has won!');
              triggerVictory(PlayerColor.BLUE);
              return; // Exit immediately - no more turns or extra rolls
            }
            
            // Check for extra roll after knocking opponent home
            if (shouldGetExtraRoll) {
              console.log('Blue player knocked opponent home, granting extra roll');
              setShouldGetExtraRoll(false); // Reset the flag
              // Don't switch turn, let them roll again
            } else if (isExtraRollSquare(finalPosition)) {
              console.log('Blue player landed on extra roll square, granting extra roll');
              setShouldGetExtraRoll(true);
            } else {
              // Only switch turn if we didn't roll a 6 (6 gives another turn)
              if (dieResult !== 6) {
                console.log('Blue player move completed, switching turn to green (not a 6)');
                setTimeout(() => {
                  if (switchTurn && gameId) {
                    console.log('Calling switchTurn function');
                    switchTurn(gameId).then(result => {
                      console.log('SwitchTurn result:', result);
                    }).catch(error => {
                      console.error('Error switching turn:', error);
                    });
                  }
                }, 100); // Small delay to ensure animation is complete
              } else {
                console.log('Blue player rolled a 6, keeping turn for another roll');
              }
            }
          }
        };
        
        animateStep(0);
      }
    }
  };

  const handleGreenDiscClick = async (discIndex: number) => {
    
    console.log('Green disc clicked - dieResult:', dieResult, 'currentTurnColor:', currentTurnColor, 'animatingDisc:', animatingDisc);
    if (!dieResult || currentTurnColor !== PlayerColor.GREEN || animatingDisc !== null) {
      console.log('Green disc click blocked - dieResult:', dieResult, 'currentTurnColor:', currentTurnColor, 'animatingDisc:', animatingDisc);
      return;
    }
    
    const discPosition = greenDiscs[discIndex];
    const isInStartingPosition = (discPosition[0] === 2 && (discPosition[1] === 11 || discPosition[1] === 12)) ||
                                (discPosition[0] === 3 && (discPosition[1] === 11 || discPosition[1] === 12));
    
    // If disc is in starting position, it can only move on a 6
    if (isInStartingPosition && dieResult !== 6) {
      return;
    }
    
    // If disc is in starting position and we rolled a 6, move to starting path position
    if (isInStartingPosition && dieResult === 6) {
      // Animate from starting position to [1, 8]
      const animationSteps: [number, number][] = [[1, 8]];
      setAnimatingDisc(discIndex);
      setAnimationPath(animationSteps);
      setAnimationIndex(0);
      
      // Play sound immediately when animation starts
      Sounds.playSound().catch(error => console.log('Error playing sound:', error));
      
      const newDiscs = [...greenDiscs];
      newDiscs[discIndex] = animationSteps[0];
      setGreenDiscs(newDiscs);
      
      // Emit socket event for disc movement
      if (moveDisc && gameId) {
        moveDisc(gameId, PlayerColor.GREEN, discIndex, animationSteps[0]).catch(error => {
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
        setHasRolled(false); // Reset rolled state after move
        
        // Handle disc collision after movement
        handleDiscCollision(animationSteps[0], PlayerColor.GREEN);
        
        // Check for victory FIRST - this should override all other logic
        if (checkForWinner(PlayerColor.GREEN)) {
          console.log('Green player has won!');
          triggerVictory(PlayerColor.GREEN);
          return; // Exit immediately - no more turns or extra rolls
        }
        
        // Check for extra roll after knocking opponent home
        if (shouldGetExtraRoll) {
          console.log('Green player knocked opponent home, granting extra roll');
          setShouldGetExtraRoll(false); // Reset the flag
          // Don't switch turn, let them roll again
        } else if (isExtraRollSquare(animationSteps[0])) {
          console.log('Green player landed on extra roll square from starting position, granting extra roll');
          setShouldGetExtraRoll(true);
        } else {
          // Only switch turn if we didn't roll a 6 (6 gives another turn)
          if (dieResult !== 6) {
            console.log('Green player move completed, switching turn to blue (not a 6)');
            setTimeout(() => {
              if (switchTurn && gameId) {
                console.log('Calling switchTurn function');
                switchTurn(gameId).then(result => {
                  console.log('SwitchTurn result:', result);
                }).catch(error => {
                  console.error('Error switching turn:', error);
                });
              }
            }, 100); // Small delay to ensure animation is complete
          } else {
            console.log('Green player rolled a 6, keeping turn for another roll');
          }
        }
      }, 200);
      return;
    }
    
    // For discs already on the path, follow the exact path with animation
    const currentPathIndex = greenPath.findIndex(([row, col]) => row === discPosition[0] && col === discPosition[1]);
    
    console.log('Green disc path movement - currentPathIndex:', currentPathIndex, 'discPosition:', discPosition);
    
    if (currentPathIndex !== -1) {
      // Check if this move would go beyond the final square
      const finalSquareIndex = greenPath.length - 1;
      const distanceToFinal = finalSquareIndex - currentPathIndex;
      
      // If the die roll would go beyond the final square, the move is invalid
      if (currentPathIndex + dieResult > finalSquareIndex) {
        console.log('Green disc: Invalid move - would go beyond final square');
        return;
      }
      
      const newPathIndex = currentPathIndex + dieResult;
      const animationSteps: [number, number][] = greenPath.slice(currentPathIndex + 1, newPathIndex + 1) as [number, number][];
      
      console.log('Green disc animation steps:', animationSteps);
      
      if (animationSteps.length > 0) {
        setAnimatingDisc(discIndex);
        setAnimationPath(animationSteps);
        setAnimationIndex(0);
        
        console.log('Green disc - playing initial sound');
        // Play sound immediately when animation starts
        Sounds.playSound().catch(error => console.log('Error playing sound:', error));
        
        // Start animation
        const animateStep = (stepIndex: number) => {
          if (stepIndex < animationSteps.length) {
            const newDiscs = [...greenDiscs];
            newDiscs[discIndex] = animationSteps[stepIndex];
            setGreenDiscs(newDiscs);
            setAnimationIndex(stepIndex);
            
            // Emit socket event for disc movement (only on final position)
            if (stepIndex === animationSteps.length - 1 && moveDisc && gameId) {
              console.log('Emitting green disc movement to server');
              moveDisc(gameId, PlayerColor.GREEN, discIndex, animationSteps[stepIndex]).catch(error => {
                console.error('Error emitting disc movement:', error);
              });
            }
            
            // Play landing sound for each step (except the first one, which is handled by initial sound)
            if (stepIndex > 0) {
              console.log('Green disc - playing step sound for step:', stepIndex);
              // Only play extra roll sound if this is the final position and it's an extra roll square
              if (stepIndex === animationSteps.length - 1 && isExtraRollSquare(animationSteps[stepIndex])) {
                Sounds.playExtraRollSound().catch(error => console.log('Error playing extra roll sound:', error));
              } else if (stepIndex === animationSteps.length - 1) {
                // Play regular sound for final position if it's not an extra roll square
                Sounds.playSound().catch(error => console.log('Error playing sound:', error));
              }
            }
            
            setTimeout(() => animateStep(stepIndex + 1), 175);
          } else {
            // Animation complete
            setAnimatingDisc(null);
            setAnimationPath([]);
            setAnimationIndex(0);
            setDieResult(null);
            setMoveMade(true); // Mark that a move was made
            setHasRolled(false); // Reset rolled state after move
            
            // Handle disc collision after movement
            const finalPosition = animationSteps[animationSteps.length - 1];
            handleDiscCollision(finalPosition, PlayerColor.GREEN);
            
            // Check for victory FIRST - this should override all other logic
            if (checkForWinner(PlayerColor.GREEN)) {
              console.log('Green player has won!');
              triggerVictory(PlayerColor.GREEN);
              return; // Exit immediately - no more turns or extra rolls
            }
            
            // Check for extra roll after knocking opponent home
            if (shouldGetExtraRoll) {
              console.log('Green player knocked opponent home, granting extra roll');
              setShouldGetExtraRoll(false); // Reset the flag
              // Don't switch turn, let them roll again
            } else if (isExtraRollSquare(finalPosition)) {
              console.log('Green player landed on extra roll square, granting extra roll');
              setShouldGetExtraRoll(true);
            } else {
              // Only switch turn if we didn't roll a 6 (6 gives another turn)
              if (dieResult !== 6) {
                console.log('Green player path move completed, switching turn to blue (not a 6)');
                setTimeout(() => {
                  if (switchTurn && gameId) {
                    console.log('Calling switchTurn function');
                    switchTurn(gameId).then(result => {
                      console.log('SwitchTurn result:', result);
                    }).catch(error => {
                      console.error('Error switching turn:', error);
                    });
                  }
                }, 100); // Small delay to ensure animation is complete
              } else {
                console.log('Green player rolled a 6, keeping turn for another roll');
              }
            }
          }
        };
        
        animateStep(0);
      }
    }
  };

  const handleYellowDiscClick = async (discIndex: number) => {
    
    console.log('Yellow disc clicked - dieResult:', dieResult, 'currentTurnColor:', currentTurnColor, 'animatingDisc:', animatingDisc);
    if (!dieResult || currentTurnColor !== PlayerColor.YELLOW || animatingDisc !== null) {
      console.log('Yellow disc click blocked - dieResult:', dieResult, 'currentTurnColor:', currentTurnColor, 'animatingDisc:', animatingDisc);
      return;
    }
    
    const discPosition = yellowDiscs[discIndex];
    const isInStartingPosition = (discPosition[0] === 11 && (discPosition[1] === 11 || discPosition[1] === 12)) ||
                                (discPosition[0] === 12 && (discPosition[1] === 11 || discPosition[1] === 12));
    
    // If disc is in starting position, it can only move on a 6
    if (isInStartingPosition && dieResult !== 6) {
      return;
    }
    
    // If disc is in starting position and we rolled a 6, move to starting path position
    if (isInStartingPosition && dieResult === 6) {
      // Animate from starting position to [8, 13]
      const animationSteps: [number, number][] = [[8, 13]];
      setAnimatingDisc(discIndex);
      setAnimationPath(animationSteps);
      setAnimationIndex(0);
      
      // Play sound immediately when animation starts
      Sounds.playSound().catch(error => console.log('Error playing sound:', error));
      
      const newDiscs = [...yellowDiscs];
      newDiscs[discIndex] = animationSteps[0];
      setYellowDiscs(newDiscs);
      
      // Emit socket event for disc movement
      if (moveDisc && gameId) {
        moveDisc(gameId, PlayerColor.YELLOW, discIndex, animationSteps[0]).catch(error => {
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
        setHasRolled(false); // Reset rolled state after move
        
        // Handle disc collision after movement
        handleDiscCollision(animationSteps[0], PlayerColor.YELLOW);
        
        // Check for victory FIRST - this should override all other logic
        if (checkForWinner(PlayerColor.YELLOW)) {
          console.log('Yellow player has won!');
          triggerVictory(PlayerColor.YELLOW);
          return; // Exit immediately - no more turns or extra rolls
        }
        
        // Check for extra roll after knocking opponent home
        if (shouldGetExtraRoll) {
          console.log('Yellow player knocked opponent home, granting extra roll');
          setShouldGetExtraRoll(false); // Reset the flag
          // Don't switch turn, let them roll again
        } else if (isExtraRollSquare(animationSteps[0])) {
          console.log('Yellow player landed on extra roll square from starting position, granting extra roll');
          setShouldGetExtraRoll(true);
        } else {
          // Only switch turn if we didn't roll a 6 (6 gives another turn)
          if (dieResult !== 6) {
            console.log('Yellow player move completed, switching turn to green (not a 6)');
            setTimeout(() => {
              if (switchTurn && gameId) {
                console.log('Calling switchTurn function');
                switchTurn(gameId).then(result => {
                  console.log('SwitchTurn result:', result);
                }).catch(error => {
                  console.error('Error switching turn:', error);
                });
              }
            }, 100); // Small delay to ensure animation is complete
          } else {
            console.log('Yellow player rolled a 6, keeping turn for another roll');
          }
        }
      }, 200);
      return;
    }
    
    // For discs already on the path, follow the exact path with animation
    const currentPathIndex = yellowPath.findIndex(([row, col]) => row === discPosition[0] && col === discPosition[1]);
    
    console.log('Yellow disc path movement - currentPathIndex:', currentPathIndex, 'discPosition:', discPosition);
    
    if (currentPathIndex !== -1) {
      // Check if this move would go beyond the final square
      const finalSquareIndex = yellowPath.length - 1;
      const distanceToFinal = finalSquareIndex - currentPathIndex;
      
      // If the die roll would go beyond the final square, the move is invalid
      if (currentPathIndex + dieResult > finalSquareIndex) {
        console.log('Yellow disc: Invalid move - would go beyond final square');
        return;
      }
      
      const newPathIndex = currentPathIndex + dieResult;
      const animationSteps: [number, number][] = yellowPath.slice(currentPathIndex + 1, newPathIndex + 1) as [number, number][];
      
      console.log('Yellow disc animation steps:', animationSteps);
      
      if (animationSteps.length > 0) {
        setAnimatingDisc(discIndex);
        setAnimationPath(animationSteps);
        setAnimationIndex(0);
        
        console.log('Yellow disc - playing initial sound');
        // Play sound immediately when animation starts
        Sounds.playSound().catch(error => console.log('Error playing sound:', error));
        
        // Start animation
        const animateStep = (stepIndex: number) => {
          if (stepIndex < animationSteps.length) {
            const newDiscs = [...yellowDiscs];
            newDiscs[discIndex] = animationSteps[stepIndex];
            setYellowDiscs(newDiscs);
            setAnimationIndex(stepIndex);
            
            // Emit socket event for disc movement (only on final position)
            if (stepIndex === animationSteps.length - 1 && moveDisc && gameId) {
              console.log('Emitting yellow disc movement to server');
              moveDisc(gameId, PlayerColor.YELLOW, discIndex, animationSteps[stepIndex]).catch(error => {
                console.error('Error emitting disc movement:', error);
              });
            }
            
            // Play landing sound for each step (except the first one, which is handled by initial sound)
            if (stepIndex > 0) {
              console.log('Yellow disc - playing step sound for step:', stepIndex);
              // Only play extra roll sound if this is the final position and it's an extra roll square
              if (stepIndex === animationSteps.length - 1 && isExtraRollSquare(animationSteps[stepIndex])) {
                Sounds.playExtraRollSound().catch(error => console.log('Error playing extra roll sound:', error));
              } else if (stepIndex === animationSteps.length - 1) {
                // Play regular sound for final position if it's not an extra roll square
                Sounds.playSound().catch(error => console.log('Error playing sound:', error));
              }
            }
            
            setTimeout(() => animateStep(stepIndex + 1), 175);
          } else {
            // Animation complete
            setAnimatingDisc(null);
            setAnimationPath([]);
            setAnimationIndex(0);
            setDieResult(null);
            setMoveMade(true); // Mark that a move was made
            setHasRolled(false); // Reset rolled state after move
            
            // Handle disc collision after movement
            const finalPosition = animationSteps[animationSteps.length - 1];
            handleDiscCollision(finalPosition, PlayerColor.YELLOW);
            
            // Check for victory FIRST - this should override all other logic
            if (checkForWinner(PlayerColor.YELLOW)) {
              console.log('Yellow player has won!');
              triggerVictory(PlayerColor.YELLOW);
              return; // Exit immediately - no more turns or extra rolls
            }
            
            // Check for extra roll after knocking opponent home
            if (shouldGetExtraRoll) {
              console.log('Yellow player knocked opponent home, granting extra roll');
              setShouldGetExtraRoll(false); // Reset the flag
              // Don't switch turn, let them roll again
            } else if (isExtraRollSquare(finalPosition)) {
              console.log('Yellow player landed on extra roll square, granting extra roll');
              setShouldGetExtraRoll(true);
            } else {
              // Only switch turn if we didn't roll a 6 (6 gives another turn)
              if (dieResult !== 6) {
                console.log('Yellow player path move completed, switching turn to green (not a 6)');
                setTimeout(() => {
                  if (switchTurn && gameId) {
                    console.log('Calling switchTurn function');
                    switchTurn(gameId).then(result => {
                      console.log('SwitchTurn result:', result);
                    }).catch(error => {
                      console.error('Error switching turn:', error);
                    });
                  }
                }, 100); // Small delay to ensure animation is complete
              } else {
                console.log('Yellow player rolled a 6, keeping turn for another roll');
              }
            }
          }
        };
        
        animateStep(0);
      }
    }
  };

  const handleRedDiscClick = async (discIndex: number) => {
    
    console.log('Red disc clicked - dieResult:', dieResult, 'currentTurnColor:', currentTurnColor, 'animatingDisc:', animatingDisc);
    if (!dieResult || currentTurnColor !== PlayerColor.RED || animatingDisc !== null) {
      console.log('Red disc click blocked - dieResult:', dieResult, 'currentTurnColor:', currentTurnColor, 'animatingDisc:', animatingDisc);
      return;
    }
    
    const discPosition = redDiscs[discIndex];
    const isInStartingPosition = (discPosition[0] === 2 && (discPosition[1] === 2 || discPosition[1] === 3)) ||
                                (discPosition[0] === 3 && (discPosition[1] === 2 || discPosition[1] === 3));
    
    // If disc is in starting position, it can only move on a 6
    if (isInStartingPosition && dieResult !== 6) {
      return;
    }
    
    // If disc is in starting position and we rolled a 6, move to starting path position
    if (isInStartingPosition && dieResult === 6) {
      // Animate from starting position to [2, 6]
      const animationSteps: [number, number][] = [[2, 6]];
      setAnimatingDisc(discIndex);
      setAnimationPath(animationSteps);
      setAnimationIndex(0);
      
      // Play sound immediately when animation starts
      Sounds.playSound().catch(error => console.log('Error playing sound:', error));
      
      const newDiscs = [...redDiscs];
      newDiscs[discIndex] = animationSteps[0];
      setRedDiscs(newDiscs);
      
      // Emit socket event for disc movement
      if (moveDisc && gameId) {
        moveDisc(gameId, PlayerColor.RED, discIndex, animationSteps[0]).catch(error => {
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
        setHasRolled(false); // Reset rolled state after move
        
        // Handle disc collision after movement
        handleDiscCollision(animationSteps[0], PlayerColor.RED);
        
        // Check for victory FIRST - this should override all other logic
        if (checkForWinner(PlayerColor.RED)) {
          console.log('Red player has won!');
          triggerVictory(PlayerColor.RED);
          return; // Exit immediately - no more turns or extra rolls
        }
        
        // Check for extra roll after knocking opponent home
        if (shouldGetExtraRoll) {
          console.log('Red player knocked opponent home, granting extra roll');
          setShouldGetExtraRoll(false); // Reset the flag
          // Don't switch turn, let them roll again
        } else if (isExtraRollSquare(animationSteps[0])) {
          console.log('Red player landed on extra roll square from starting position, granting extra roll');
          setShouldGetExtraRoll(true);
        } else {
          // Only switch turn if we didn't roll a 6 (6 gives another turn)
          if (dieResult !== 6) {
            console.log('Red player move completed, switching turn to yellow (not a 6)');
            setTimeout(() => {
              if (switchTurn && gameId) {
                console.log('Calling switchTurn function');
                switchTurn(gameId).then(result => {
                  console.log('SwitchTurn result:', result);
                }).catch(error => {
                  console.error('Error switching turn:', error);
                });
              }
            }, 100); // Small delay to ensure animation is complete
          } else {
            console.log('Red player rolled a 6, keeping turn for another roll');
          }
        }
      }, 200);
      return;
    }
    
    // For discs already on the path, follow the exact path with animation
    const currentPathIndex = redPath.findIndex(([row, col]) => row === discPosition[0] && col === discPosition[1]);
    
    console.log('Red disc path movement - currentPathIndex:', currentPathIndex, 'discPosition:', discPosition);
    
    if (currentPathIndex !== -1) {
      // Check if this move would go beyond the final square
      const finalSquareIndex = redPath.length - 1;
      const distanceToFinal = finalSquareIndex - currentPathIndex;
      
      // If the die roll would go beyond the final square, the move is invalid
      if (currentPathIndex + dieResult > finalSquareIndex) {
        console.log('Red disc: Invalid move - would go beyond final square');
        return;
      }
      
      const newPathIndex = currentPathIndex + dieResult;
      const animationSteps: [number, number][] = redPath.slice(currentPathIndex + 1, newPathIndex + 1) as [number, number][];
      
      console.log('Red disc animation steps:', animationSteps);
      
      if (animationSteps.length > 0) {
        setAnimatingDisc(discIndex);
        setAnimationPath(animationSteps);
        setAnimationIndex(0);
        
        console.log('Red disc - playing initial sound');
        // Play sound immediately when animation starts
        Sounds.playSound().catch(error => console.log('Error playing sound:', error));
        
        // Start animation
        const animateStep = (stepIndex: number) => {
          if (stepIndex < animationSteps.length) {
            const newDiscs = [...redDiscs];
            newDiscs[discIndex] = animationSteps[stepIndex];
            setRedDiscs(newDiscs);
            setAnimationIndex(stepIndex);
            
            // Emit socket event for disc movement (only on final position)
            if (stepIndex === animationSteps.length - 1 && moveDisc && gameId) {
              console.log('Emitting red disc movement to server');
              moveDisc(gameId, PlayerColor.RED, discIndex, animationSteps[stepIndex]).catch(error => {
                console.error('Error emitting disc movement:', error);
              });
            }
            
            // Play landing sound for each step (except the first one, which is handled by initial sound)
            if (stepIndex > 0) {
              console.log('Red disc - playing step sound for step:', stepIndex);
              // Only play extra roll sound if this is the final position and it's an extra roll square
              if (stepIndex === animationSteps.length - 1 && isExtraRollSquare(animationSteps[stepIndex])) {
                Sounds.playExtraRollSound().catch(error => console.log('Error playing extra roll sound:', error));
              } else if (stepIndex === animationSteps.length - 1) {
                // Play regular sound for final position if it's not an extra roll square
                Sounds.playSound().catch(error => console.log('Error playing sound:', error));
              }
            }
            
            setTimeout(() => animateStep(stepIndex + 1), 175);
          } else {
            // Animation complete
            setAnimatingDisc(null);
            setAnimationPath([]);
            setAnimationIndex(0);
            setDieResult(null);
            setMoveMade(true); // Mark that a move was made
            setHasRolled(false); // Reset rolled state after move
            
            // Handle disc collision after movement
            const finalPosition = animationSteps[animationSteps.length - 1];
            handleDiscCollision(finalPosition, PlayerColor.RED);
            
            // Check for victory FIRST - this should override all other logic
            if (checkForWinner(PlayerColor.RED)) {
              console.log('Red player has won!');
              triggerVictory(PlayerColor.RED);
              return; // Exit immediately - no more turns or extra rolls
            }
            
            // Check for extra roll after knocking opponent home
            if (shouldGetExtraRoll) {
              console.log('Red player knocked opponent home, granting extra roll');
              setShouldGetExtraRoll(false); // Reset the flag
              // Don't switch turn, let them roll again
            } else if (isExtraRollSquare(finalPosition)) {
              console.log('Red player landed on extra roll square, granting extra roll');
              setShouldGetExtraRoll(true);
            } else {
              // Only switch turn if we didn't roll a 6 (6 gives another turn)
              if (dieResult !== 6) {
                console.log('Red player path move completed, switching turn to yellow (not a 6)');
                setTimeout(() => {
                  if (switchTurn && gameId) {
                    console.log('Calling switchTurn function');
                    switchTurn(gameId).then(result => {
                      console.log('SwitchTurn result:', result);
                    }).catch(error => {
                      console.error('Error switching turn:', error);
                    });
                  }
                }, 100); // Small delay to ensure animation is complete
              } else {
                console.log('Red player rolled a 6, keeping turn for another roll');
              }
            }
          }
        };
        
        animateStep(0);
      }
    }
  };

  // Check if a disc is in its home position
  const isInHome = (disc: [number, number], playerColor: PlayerColor): boolean => {
    const homePositions: Record<PlayerColor, [number, number][]> = {
      [PlayerColor.BLUE]: [[11, 2], [11, 3], [12, 2], [12, 3]],
      [PlayerColor.GREEN]: [[2, 11], [2, 12], [3, 11], [3, 12]],
      [PlayerColor.YELLOW]: [[11, 11], [11, 12], [12, 11], [12, 12]],
      [PlayerColor.RED]: [[2, 2], [2, 3], [3, 2], [3, 3]]
    };
    
    const positions = homePositions[playerColor] || [];
    return positions.some((pos: [number, number]) => pos[0] === disc[0] && pos[1] === disc[1]);
  };





  // Helper function to generate confetti
  const generateConfetti = () => {
    const colors = ['#ff6b6b', '#51cf66', '#339af0', '#ffd43b', '#ff922b', '#be4bdb'];
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
      case PlayerColor.RED:
        discs = redDiscs;
        finalSquare = [7, 6];
        break;
      default:
        return false;
    }
    
    // Check if all 4 discs are in the final square
    return discs.every(disc => disc[0] === finalSquare[0] && disc[1] === finalSquare[1]);
  };

  // Helper function to trigger victory celebration
  const triggerVictory = (winnerColor: PlayerColor) => {
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
    
    // Hide victory message after 5 seconds
    setTimeout(() => {
      setShowVictory(false);
      setConfetti([]);
    }, 5000);
  };

  // Helper function to test celebration
  const testCelebration = () => {
    const colors = [PlayerColor.BLUE, PlayerColor.GREEN, PlayerColor.YELLOW, PlayerColor.RED];
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
        return [[11, 2], [11, 3], [12, 2], [12, 3]];
      case PlayerColor.GREEN:
        return [[2, 11], [2, 12], [3, 11], [3, 12]];
      case PlayerColor.YELLOW:
        return [[11, 11], [11, 12], [12, 11], [12, 12]];
      case PlayerColor.RED:
        return [[2, 2], [2, 3], [3, 2], [3, 3]];
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
    // Don't handle collisions on safe squares
    if (isSafeSquare(landingPosition)) {
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
    
    // Check red discs
    redDiscs.forEach((disc, index) => {
      if (disc[0] === landingPosition[0] && disc[1] === landingPosition[1]) {
        allDiscsAtPosition.push({ color: PlayerColor.RED, index });
      }
    });

    // Find opponent discs (discs of different colors)
    const opponentDiscs = allDiscsAtPosition.filter(disc => disc.color !== landingPlayerColor);
    
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
            switchTurn(gameId).catch(error => {
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
        
        // Check red discs in home
        if (opponentDisc.color === PlayerColor.RED) {
          redDiscs.forEach(disc => {
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
          } else if (opponentDisc.color === PlayerColor.RED) {
            currentDiscPosition = redDiscs[opponentDisc.index];
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

  // Check if the current player has any valid moves available
  const hasValidMoves = (dieValue: number, playerColor: PlayerColor): boolean => {
    if (!dieValue) return false;
    
    // Get the current player's discs
    let currentDiscs: [number, number][];
    if (playerColor === PlayerColor.BLUE) {
      currentDiscs = blueDiscs;
    } else if (playerColor === PlayerColor.GREEN) {
      currentDiscs = greenDiscs;
    } else if (playerColor === PlayerColor.YELLOW) {
      currentDiscs = yellowDiscs;
    } else if (playerColor === PlayerColor.RED) {
      currentDiscs = redDiscs;
    } else {
      currentDiscs = [];
    }
    
    console.log(`hasValidMoves called for ${playerColor}, dieValue: ${dieValue}, discs:`, currentDiscs);
    
    // Check if any disc can move
    for (let i = 0; i < currentDiscs.length; i++) {
      const disc = currentDiscs[i];
      const inHome = isInHome(disc, playerColor);
      
      console.log(`Disc ${i} at ${disc}, inHome: ${inHome}`);
      
      // If disc is in home, it can only move out with a 6
      if (inHome) {
        if (dieValue === 6) {
          console.log(`Disc ${i} can move out of home with 6`);
          return true; // Can move out of home
        }
      } else {
        // Disc is on the path, can always move (we'll add more validation later)
        console.log(`Disc ${i} is on path, can move`);
        return true;
      }
    }
    
    // If we get here, all discs are in home and we didn't roll a 6
    // In this case, the player cannot move, so return false
    console.log(`No valid moves for ${playerColor}`);
    return false;
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
    } else if (playerColor === PlayerColor.RED) {
      setRedDiscs(prev => {
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
    await Sounds.playDiceRollSound();
    
    try {
      console.log('Rolling die - socketRollDie:', !!socketRollDie, 'gameId:', gameId);
      
      // Use socket rolling if available, otherwise fallback to local
      if (socketRollDie && gameId) {
        console.log('Using socket rolling');
        const response = await socketRollDie(gameId);
        const result = response.result;
        console.log('Socket die result:', result);
        
        // The result will be handled by the dieRolled event listener
        // which will show the animation and result for all players
      } else {
        console.log('Using local rolling fallback');
        setTimeout(() => {
          const result = forcedRollNumber || Math.floor(Math.random() * 6) + 1;
          console.log('Local die result:', result);
          
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
    return <div className="extra-roll-symbol">🎲</div>;
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
    
    if (currentGame?.players.some((player: Player) => player.color === 'red')) {
      redDiscs.forEach((disc, index) => {
        allDiscs.push({ position: disc, color: PlayerColor.RED, index });
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
            onClickHandler = handleDiscClick;
          } else if (color === PlayerColor.GREEN) {
            onClickHandler = handleGreenDiscClick;
          } else if (color === PlayerColor.YELLOW) {
            onClickHandler = handleYellowDiscClick;
          } else if (color === PlayerColor.RED) {
            onClickHandler = handleRedDiscClick;
          } else {
            onClickHandler = () => {}; // No handler for other colors yet
          }
          
          // Calculate offset for stacking - each disc is slightly offset
          const offsetX = stackIndex * 2; // 2px horizontal offset
          const offsetY = stackIndex * 2; // 2px vertical offset
          
          return (
            <div
              key={`${color}-disc-${discIndex}`}
              className={`${color.toLowerCase()}-disc stacked-disc`}
              onClick={() => onClickHandler(discIndex)}
              style={{
                cursor: dieResult && currentTurnColor === color ? 'pointer' : 'default',
                zIndex: zIndex,
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
                  opacity: ((localPlayerColor && localPlayerColor !== currentTurnColor && currentGame?.currentPlayerIndex !== 0) || (hasRolled && !moveMade)) ? 0.5 : 1,
                  cursor: ((localPlayerColor && localPlayerColor !== currentTurnColor && currentGame?.currentPlayerIndex !== 0) || (hasRolled && !moveMade)) ? 'not-allowed' : 'pointer'
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
                  // For the first player, allow rolling even if they haven't selected their final color yet
                  if (localPlayerColor && localPlayerColor !== currentTurnColor && currentGame?.currentPlayerIndex !== 0) {
                    console.log('Not your turn to roll');
                    return;
                  }
                  
                  // Prevent rolling if player has already rolled and hasn't made a move yet
                  if (hasRolled && !moveMade) {
                    console.log('Die click blocked - already rolled, waiting for move');
                    return;
                  }
                  
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
                            switchTurn(gameId).catch(error => {
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
            className="test-sound-btn"
            onClick={async () => {
              try {
                await Sounds.playSadSound();
              } catch (error) {
                console.log('Error playing sad sound:', error);
              }
            }}
            title="Test the sad sound (plays when knocking opponent discs)"
          >
            Test Sad Sound
          </button>
        </div>
      )}
      <div className="board-wrapper">
        <div className="board-grid">
          {Array.from({ length: 15 }, (_, row) => (
            <div key={row} className="board-row">
              {Array.from({ length: 15 }, (_, col) => (
              <div key={col} className={getCellClass(row, col)} data-row={row} data-col={col}>
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
                {/* Red arrow pointing right at [7,0] */}
                {row === 7 && col === 0 && (
                  <div className="home-arrow red-arrow">
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
                  
                  // Red home area - show pill centered across squares 1,1 to 1,4
                  if (player.color === 'red' && row === 1 && col === 2) {
                    return (
                      <div key={`${player.id}-red`} className="player-name-overlay red-name home-pill red-home-pill">
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
                {/* Red home squares: [2,2], [2,3], [3,2], [3,3] */}
                {!currentGame?.players.some((player: Player) => player.color === 'red') && 
                 ((row === 2 && (col === 2 || col === 3)) || (row === 3 && (col === 2 || col === 3))) && (
                  <div className="placeholder-disc red-placeholder" />
                )}
                
                {/* Yellow home squares: [11,11], [11,12], [12,11], [12,12] */}
                {!currentGame?.players.some((player: Player) => player.color === 'yellow') && 
                 ((row === 11 && (col === 11 || col === 12)) || (row === 12 && (col === 11 || col === 12))) && (
                  <div className="placeholder-disc yellow-placeholder" />
                )}
                
                {/* Green home squares: [2,11], [2,12], [3,11], [3,12] */}
                {!currentGame?.players.some((player: Player) => player.color === 'green') && 
                 ((row === 2 && (col === 11 || col === 12)) || (row === 3 && (col === 11 || col === 12))) && (
                  <div className="placeholder-disc green-placeholder" />
                )}
                
                {/* Blue home squares: [11,2], [11,3], [12,2], [12,3] */}
                {!currentGame?.players.some((player: Player) => player.color === 'blue') && 
                 ((row === 11 && (col === 2 || col === 3)) || (row === 12 && (col === 2 || col === 3))) && (
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
          
          // Position dice next to their name pills consistently
          let diePosition = {};
          if (player.color === 'red') {
            diePosition = { top: '7.5%', left: '26%' }; // Same as green but left side, moved 16px right
          } else if (player.color === 'green') {
            diePosition = { top: '7.5%', right: '10%' }; // Position slightly higher (about 1px up)
          } else if (player.color === 'blue') {
            diePosition = { bottom: '27.5%', left: '25%' }; // Position halfway between previous positions
          } else if (player.color === 'yellow') {
            diePosition = { bottom: '27.5%', right: '10%' }; // Same as blue but right side, moved 20px right total
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
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
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

      {/* Victory Celebration */}
      {showVictory && (
        <div className="victory-overlay">
          <div 
            className="victory-message"
            style={{
              background: winnerColor === PlayerColor.BLUE ? 'linear-gradient(135deg, #339af0 0%, #1c7ed6 100%)' :
                         winnerColor === PlayerColor.GREEN ? 'linear-gradient(135deg, #51cf66 0%, #37b24d 100%)' :
                         winnerColor === PlayerColor.YELLOW ? 'linear-gradient(135deg, #ffd43b 0%, #fcc419 100%)' :
                         winnerColor === PlayerColor.RED ? 'linear-gradient(135deg, #ff6b6b 0%, #fa5252 100%)' :
                         'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            }}
          >
            <h1 className="victory-title">
              🎉 {winnerColor?.toUpperCase()} WINS! 🎉
            </h1>
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
