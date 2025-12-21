"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const GameManager_1 = require("./game/GameManager");
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
// CORS configuration - allow localhost and local network IPs
// Socket.io needs an array format for CORS origins
const allowedOrigins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://192.168.4.66:3000" // Current network IP
];
const io = new socket_io_1.Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"]
    }
});
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const HOST = process.env.HOST || '0.0.0.0'; // Listen on all network interfaces
const gameManager = new GameManager_1.GameManager(io);
app.use((0, cors_1.default)({
    origin: allowedOrigins,
    methods: ["GET", "POST"]
}));
app.use(express_1.default.json());
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
    socket.on('rollDie', async ({ gameId, forcedRoll }, callback) => {
        console.log('Roll die request received for game:', gameId, 'from socket:', socket.id, 'forcedRoll:', forcedRoll);
        const result = gameManager.rollDie(gameId, socket.id, forcedRoll);
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
    socket.on('switchTurn', ({ gameId, force = false }, callback) => {
        console.log('Switch turn request received for game:', gameId, 'from socket:', socket.id, 'force:', force);
        const result = gameManager.switchTurn(gameId, force);
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
server.listen(PORT, HOST, () => {
    console.log(`Server running on ${HOST}:${PORT}`);
    console.log(`Local network access: http://192.168.4.66:${PORT}`);
});
//# sourceMappingURL=index.js.map