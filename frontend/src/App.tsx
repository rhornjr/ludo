import React, { useState } from 'react';
import { GameLobby } from './components/GameLobby';
import { LudoBoard } from './components/LudoBoard';
import { ColorSelection } from './components/ColorSelection';
import { useSocket } from './hooks/useSocket';
import { PlayerColor } from './types/game';
import './App.css';

function App() {
  const { socket, isConnected, currentGame, error, createGame, joinGame, getAvailableColors, assignColor, startGame, rollDie, switchTurn, moveDisc, playerWon, setDieRollCallback, pendingDieRoll } = useSocket();
  const [gameId, setGameId] = useState<string | null>(null);
  const [showLobby, setShowLobby] = useState(true);
  const [currentPlayer, setCurrentPlayer] = useState<{ id: string; name: string; color: PlayerColor } | null>(null);
  const [showColorSelection, setShowColorSelection] = useState(false);
  const [pendingPlayerName, setPendingPlayerName] = useState<string>('');
  const [availableColors, setAvailableColors] = useState<PlayerColor[]>([]);
  
  // Debug logging
  console.log('App state:', { isConnected, currentGame, gameId, showLobby, currentPlayer, showColorSelection });

  // Effect to refresh available colors when game state changes (e.g., when another player changes color)
  React.useEffect(() => {
    if (currentGame && showColorSelection && gameId && currentPlayer) {
      console.log('Refreshing available colors due to game state change');
      getAvailableColors(gameId, currentPlayer.id).then(result => {
        if (result.success && result.availableColors) {
          console.log('Updated available colors:', result.availableColors);
          setAvailableColors(result.availableColors);
        }
      });
    }
  }, [currentGame, showColorSelection, gameId, currentPlayer]);



  const handleCreateGame = async (playerName: string) => {
    try {
      const { gameId: newGameId } = await createGame();
      setGameId(newGameId);
      setShowLobby(false);
      setPendingPlayerName(playerName);
      // Join the game immediately without a color
      const result = await joinGame(newGameId, playerName);
      if (result.success) {
        // Find the current player in the game
        if (result.game) {
          const player = result.game.players.find(p => p.name === playerName);
          if (player) {
            setCurrentPlayer({ id: player.id, name: player.name, color: player.color });
          }
        }
        // Get available colors, excluding the current player's temporary color
        const colorsResult = await getAvailableColors(newGameId, result.game?.players.find(p => p.name === playerName)?.id);
        if (colorsResult.success && colorsResult.availableColors) {
          setAvailableColors(colorsResult.availableColors);
        } else {
          // Fallback to all colors if getAvailableColors fails
          setAvailableColors([PlayerColor.ORANGE, PlayerColor.GREEN, PlayerColor.BLUE, PlayerColor.YELLOW]);
        }
        setShowColorSelection(true);
      } else {
        alert('Failed to join created game');
      }
    } catch (err) {
      alert('Failed to create game');
    }
  };

  const handleJoinGame = async (gameId: string, playerName: string) => {
    try {
      setGameId(gameId);
      setShowLobby(false);
      setPendingPlayerName(playerName);
      // Join the game immediately without a color
      const result = await joinGame(gameId, playerName);
      if (result.success) {
        // Find the current player in the game
        let currentPlayerId: string | undefined;
        if (result.game) {
          const player = result.game.players.find(p => p.name === playerName);
          if (player) {
            setCurrentPlayer({ id: player.id, name: player.name, color: player.color });
            currentPlayerId = player.id;
          }
        }
        // Get available colors for the existing game, excluding current player's temporary color
        const colorsResult = await getAvailableColors(gameId, currentPlayerId);
        if (colorsResult.success && colorsResult.availableColors) {
          setAvailableColors(colorsResult.availableColors);
        } else {
          alert(colorsResult.error || 'Failed to get available colors');
          return;
        }
        setShowColorSelection(true);
      } else {
        alert(result.error || 'Failed to join game');
      }
    } catch (err) {
      alert('Failed to join game');
    }
  };

  const handleColorSelect = async (selectedColor: PlayerColor) => {
    if (!gameId || !currentPlayer) return;
    
    try {
      const result = await assignColor(gameId, selectedColor);
      if (result.success) {
        // Update the current player's color
        setCurrentPlayer(prev => prev ? { ...prev, color: selectedColor } : null);
        setShowColorSelection(false);
        setPendingPlayerName('');
      } else {
        alert(result.error || 'Failed to assign color');
      }
    } catch (err) {
      alert('Failed to assign color');
    }
  };

  const handlePawnClick = (playerColor: PlayerColor, pawnId: number) => {
    console.log(`Clicked pawn ${pawnId} for player ${playerColor}`);
    // TODO: Implement pawn movement logic
  };

  if (!isConnected) {
    return (
      <div className="app">
        <div className="loading">
          <h2>Connecting to server...</h2>
          {error && <p className="error">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {showLobby ? (
        <GameLobby 
          onCreateGame={handleCreateGame}
          onJoinGame={handleJoinGame}
        />
      ) : (
        <div className="game-container">
          <div className="game-header">
            <h1>🎲 Ludo</h1>
            {gameId && (
              <div className="game-id-container">
                <span>Game ID: {gameId}</span>
                <button 
                  className="copy-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(gameId);
                    // Show a brief "Copied!" message
                    const btn = document.querySelector('.copy-btn') as HTMLButtonElement;
                    if (btn) {
                      const originalSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
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
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                </button>
              </div>
            )}
            {currentGame?.gameLocked && (
              <div className="game-locked-indicator">
                <span className="lock-icon">🔒</span>
                <span>Game Locked - No new players</span>
              </div>
            )}
            {currentPlayer && (
              <div className="player-info">
                <span className={`player-color ${currentPlayer.color.toLowerCase()}`}>
                  {currentPlayer.name}
                </span>
              </div>
            )}
            <button 
              className="back-to-lobby-btn"
              onClick={() => {
                setShowLobby(true);
                setCurrentPlayer(null);
                setShowColorSelection(false);
                setPendingPlayerName('');
              }}
            >
              Back to Lobby
            </button>
          </div>
          
          {currentGame ? (
            <div className="game-content">
              {(() => {
                console.log('App - currentGame:', currentGame, 'currentPlayer:', currentPlayer);
                return null;
              })()}
              <LudoBoard 
                localPlayerColor={currentPlayer?.color}
                onPawnClick={handlePawnClick}
                gameId={gameId || undefined}
                              socketRollDie={rollDie}
              switchTurn={switchTurn}
              moveDisc={moveDisc}
              playerWon={playerWon}
              startGame={startGame}
              socket={socket}
              currentGame={currentGame}
              setDieRollCallback={setDieRollCallback}
              pendingDieRoll={pendingDieRoll}
              />
            </div>
          ) : (
            <div className="waiting">
              <h2>Waiting for players...</h2>
              <p>Share the game ID with other players to start!</p>
            </div>
          )}
          
          {/* Color Selection Overlay */}
          {showColorSelection && (
            <ColorSelection
              availableColors={availableColors}
              onColorSelect={handleColorSelect}
              playerName={pendingPlayerName}
              gameId={gameId || undefined}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default App;
