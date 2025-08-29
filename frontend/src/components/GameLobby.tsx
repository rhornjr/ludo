import React, { useState } from 'react';
import './GameLobby.css';

interface GameLobbyProps {
  onCreateGame: (playerName: string) => void;
  onJoinGame: (gameId: string, playerName: string) => void;
}

export const GameLobby: React.FC<GameLobbyProps> = ({ onCreateGame, onJoinGame }) => {
  const [gameId, setGameId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [createPlayerName, setCreatePlayerName] = useState('');

  const handleJoinGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (gameId.trim() && playerName.trim()) {
      onJoinGame(gameId.trim(), playerName.trim());
    }
  };

  const handleCreateGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (createPlayerName.trim()) {
      onCreateGame(createPlayerName.trim());
    }
  };

  return (
    <div className="game-lobby">
      <div className="lobby-container">
        <h1>🎲 Ludo</h1>
        <p>Create a new game or join an existing one</p>
        
        <div className="lobby-actions">
          <div className="action-section">
            <h2>Create New Game</h2>
            <form onSubmit={handleCreateGame} className="create-form">
              <div className="form-group">
                <label htmlFor="createPlayerName">Your Name:</label>
                <input
                  id="createPlayerName"
                  type="text"
                  value={createPlayerName}
                  onChange={(e) => setCreatePlayerName(e.target.value)}
                  placeholder="Enter your name"
                  required
                />
              </div>
              
              <button 
                type="submit" 
                className="create-game-btn"
                disabled={!createPlayerName.trim()}
              >
                Create Game
              </button>
            </form>
          </div>
          
          <div className="divider">OR</div>
          
          <div className="action-section">
            <h2>Join Existing Game</h2>
            <form onSubmit={handleJoinGame} className="join-form">
              <div className="form-group">
                <label htmlFor="playerName">Your Name:</label>
                <input
                  id="playerName"
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter your name"
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="gameId">Game ID:</label>
                <input
                  id="gameId"
                  type="text"
                  value={gameId}
                  onChange={(e) => setGameId(e.target.value)}
                  placeholder="Enter game ID"
                  required
                />
              </div>
              
              <button 
                type="submit" 
                className="join-game-btn"
                disabled={!gameId.trim() || !playerName.trim()}
              >
                Join Game
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
