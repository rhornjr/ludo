import React, { useState, useEffect } from 'react';
import { PlayerColor, Player, GameState } from '../types/game';
import './StarterSelection.css';

interface StarterSelectionProps {
  players: Player[];
  onSelectionComplete: (selectedPlayer: Player) => void;
  currentGame?: any;
}

export const StarterSelection: React.FC<StarterSelectionProps> = ({ players, onSelectionComplete, currentGame }) => {
  const [currentColorIndex, setCurrentColorIndex] = useState(0);
  const [isSpinning, setIsSpinning] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  useEffect(() => {
    if (!isSpinning) return;

    const interval = setInterval(() => {
      setCurrentColorIndex((prev) => (prev + 1) % players.length);
    }, 200); // Change color every 200ms

    // Stop spinning after 2 seconds
    const timeout = setTimeout(() => {
      setIsSpinning(false);
    }, 2000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [isSpinning, players]);

  // Watch for game state change to PLAYING to know who was selected
  useEffect(() => {
    if (!isSpinning && currentGame?.gameState === GameState.PLAYING && currentGame?.currentPlayerIndex !== undefined) {
      const selectedPlayer = players[currentGame.currentPlayerIndex];
      if (selectedPlayer) {
        setSelectedPlayer(selectedPlayer);
        
        // Call the callback after 3 seconds to show the final selection
        setTimeout(() => {
          onSelectionComplete(selectedPlayer);
        }, 3000);
      }
    }
  }, [isSpinning, currentGame?.gameState, currentGame?.currentPlayerIndex, players, onSelectionComplete]);

  const getColorClass = (color: PlayerColor) => {
    switch (color) {
      case PlayerColor.RED: return 'red';
      case PlayerColor.GREEN: return 'green';
      case PlayerColor.BLUE: return 'blue';
      case PlayerColor.YELLOW: return 'yellow';
      default: return '';
    }
  };

  const getColorName = (color: PlayerColor) => {
    switch (color) {
      case PlayerColor.RED: return 'Red';
      case PlayerColor.GREEN: return 'Green';
      case PlayerColor.BLUE: return 'Blue';
      case PlayerColor.YELLOW: return 'Yellow';
      default: return '';
    }
  };

  if (!isSpinning && selectedPlayer) {
    return (
      <div className="starter-selection">
        <div className="selection-container">
          <h2>🎲 Starter Selected!</h2>
          <div className={`selected-player ${getColorClass(selectedPlayer.color)}`}>
            <div className="player-avatar"></div>
            <div className="player-info">
              <h3>{selectedPlayer.name}</h3>
            </div>
          </div>
          <p className="starting-message">Starting the game...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="starter-selection">
      <div className="selection-container">
        <h2>🎲 Selecting Starter</h2>
        <div className="spinning-container">
          <div className={`spinning-player ${getColorClass(players[currentColorIndex]?.color)}`}>
            <div className="player-avatar"></div>
            <div className="player-info">
              <h3>{players[currentColorIndex]?.name}</h3>
            </div>
          </div>
        </div>
        <p className="spinning-message">Spinning...</p>
      </div>
    </div>
  );
};
