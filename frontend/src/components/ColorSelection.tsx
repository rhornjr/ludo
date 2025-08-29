import React from 'react';
import { PlayerColor } from '../types/game';
import './ColorSelection.css';

interface ColorSelectionProps {
  availableColors: PlayerColor[];
  onColorSelect: (color: PlayerColor) => void;
  playerName: string;
}

export const ColorSelection: React.FC<ColorSelectionProps> = ({ 
  availableColors, 
  onColorSelect, 
  playerName 
}) => {
  return (
    <div className="color-selection-overlay">
      <div className="color-selection-modal">
        <h2>Choose Your Color</h2>
        <p>Welcome, {playerName}! Pick your color to start playing.</p>
        
        <div className="color-grid">
          {[PlayerColor.RED, PlayerColor.GREEN, PlayerColor.BLUE, PlayerColor.YELLOW].map((color) => {
            const isAvailable = availableColors.includes(color);
            const isTaken = !isAvailable;
            
            return (
              <button
                key={color}
                className={`color-option ${isTaken ? 'taken' : ''}`}
                onClick={() => isAvailable && onColorSelect(color)}
                disabled={isTaken}
                style={{
                  backgroundColor: color === 'red' ? '#ff6b6b' : 
                                 color === 'green' ? '#51cf66' : 
                                 color === 'blue' ? '#339af0' : '#ffd43b',
                  color: color === 'yellow' ? '#333' : 'white',
                  opacity: isTaken ? 0.5 : 1,
                  cursor: isTaken ? 'not-allowed' : 'pointer'
                }}
              >
                <div className="color-name">{color.charAt(0).toUpperCase() + color.slice(1)}</div>
                {isTaken && <div className="taken-indicator">Taken</div>}
              </button>
            );
          })}
        </div>
        
        <div className="color-selection-info">
          <p>Select a color to join the game and start playing!</p>
        </div>
      </div>
    </div>
  );
};
