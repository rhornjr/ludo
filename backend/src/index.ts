import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { GameManager } from './game/GameManager';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "http://192.168.4.42:3000"],
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0'; // Listen on all network interfaces
const gameManager = new GameManager(io);

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Ludo game server is running' });
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('createGame', (callback) => {
    const gameId = gameManager.createGame();
    socket.join(gameId);
    callback({ gameId });
  });

  socket.on('joinGame', ({ gameId, playerName, playerColor }, callback) => {
    const result = gameManager.joinGame(gameId, socket.id, playerName, playerColor);
    if (result.success) {
      socket.join(gameId);
    }
    callback(result);
  });

  socket.on('getAvailableColors', ({ gameId, excludePlayerId }, callback) => {
    const result = gameManager.getAvailableColors(gameId, excludePlayerId);
    callback(result);
  });

  socket.on('assignColor', ({ gameId, playerColor }, callback) => {
    const result = gameManager.assignColor(gameId, socket.id, playerColor);
    callback(result);
  });

  socket.on('startGame', ({ gameId }, callback) => {
    console.log('Start game request received for game:', gameId, 'from socket:', socket.id);
    const result = gameManager.startGameWithRandomSelection(gameId);
    callback(result);
  });

  socket.on('rollDie', async ({ gameId }, callback) => {
    console.log('Roll die request received for game:', gameId, 'from socket:', socket.id);
    const result = gameManager.rollDie(gameId, socket.id);
    if (result.success) {
      console.log('Broadcasting die roll result:', result.result, 'to game:', gameId);
      // Get all sockets in the game room
      const sockets = await io.in(gameId).fetchSockets();
      console.log('Sockets in game room:', sockets.map(s => s.id));
      // Broadcast the die roll to all players in the game (including sender)
      io.to(gameId).emit('dieRolled', { result: result.result });
    }
    callback(result);
  });

  socket.on('switchTurn', ({ gameId }, callback) => {
    console.log('Switch turn request received for game:', gameId, 'from socket:', socket.id);
    const result = gameManager.switchTurn(gameId);
    console.log('SwitchTurn result:', result);
    if (result.success) {
      console.log('Broadcasting turn switch to game:', gameId, 'new player index:', result.game?.currentPlayerIndex);
      // Broadcast the turn switch to all players in the game
      io.to(gameId).emit('turnSwitched', { game: result.game });
    }
    callback(result);
  });

  socket.on('moveDisc', ({ gameId, playerColor, discIndex, newPosition }, callback) => {
    console.log('Move disc request received for game:', gameId, 'player:', playerColor, 'disc:', discIndex, 'position:', newPosition);
    const result = gameManager.moveDisc(gameId, playerColor, discIndex, newPosition);
    if (result.success) {
      console.log('Broadcasting disc movement to game:', gameId, 'updated game state:', result.game);
      // Broadcast the disc movement to all players in the game (including sender)
      io.to(gameId).emit('discMoved', { 
        playerColor, 
        discIndex, 
        newPosition,
        game: result.game 
      });
    }
    callback(result);
  });

  socket.on('discReturnedToHome', ({ gameId, playerColor, discIndex, homePosition }) => {
    console.log('Disc returned to home event received for game:', gameId, 'player:', playerColor, 'disc:', discIndex, 'home position:', homePosition);
    // Broadcast the disc return to home to all players in the game (including sender)
    io.to(gameId).emit('discReturnedToHome', { 
      playerColor, 
      discIndex, 
      homePosition
    });
  });

  socket.on('playerWon', ({ gameId, playerColor }, callback) => {
    console.log('Player won event received for game:', gameId, 'player:', playerColor);
    const result = gameManager.playerWon(gameId, playerColor);
    callback(result);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    gameManager.handlePlayerDisconnect(socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on ${HOST}:${PORT}`);
  console.log(`Local network access: http://192.168.4.42:${PORT}`);
});
