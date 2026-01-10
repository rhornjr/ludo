# 🎲 Ludo Game

A multiplayer Ludo game built with React, TypeScript, and Node.js using Socket.IO for real-time communication.

## Features

- 🎮 Real-time multiplayer gameplay
- 🎨 Beautiful, modern UI with colorful design
- 🔄 Live game state synchronization
- 👥 Player lobby system
- 📱 Responsive design

## Tech Stack

### Frontend
- React 18 with TypeScript
- Socket.IO Client
- CSS3 with modern styling

### Backend
- Node.js with TypeScript
- Express.js
- Socket.IO
- UUID for game ID generation

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ludo
```

2. Install dependencies for both frontend and backend:
```bash
npm run install:all
```

### Running the Application

1. Start the backend server:
```bash
cd backend
npm run dev
```

2. In a new terminal, start the frontend:
```bash
cd frontend
npm start
# or if I want others to join on my network:
npm run start:network
```

3. Open your browser and navigate to `http://localhost:3000`

### Alternative: Run Both Simultaneously

From the root directory:
```bash
npm run dev
```

This will start both the backend (port 3001) and frontend (port 3000) simultaneously.

## How to Play

1. **Create a Game**: Click "Create Game" to start a new game. You'll receive a unique Game ID.

2. **Join a Game**: Share the Game ID with other players. They can join by entering the Game ID and their name.

3. **Start Playing**: Once 4 players have joined, the game will automatically start.

4. **Game Rules**: 
   - Each player has 4 pawns
   - Roll a 6 to move a pawn out of the starting area
   - Move pawns around the board to reach the center
   - First player to get all 4 pawns to the center wins

## Project Structure

```
ludo/
├── frontend/                 # React frontend
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── types/          # TypeScript type definitions
│   │   └── App.tsx         # Main application component
│   └── package.json
├── backend/                 # Node.js backend
│   ├── src/
│   │   ├── game/           # Game logic
│   │   ├── types/          # TypeScript type definitions
│   │   └── index.ts        # Server entry point
│   └── package.json
└── package.json            # Root package.json for workspaces
```

## Development

### Backend Development
- The backend runs on port 3001
- Uses TypeScript with strict type checking
- Socket.IO handles real-time communication
- Game state is managed in memory (not persistent)

### Frontend Development
- The frontend runs on port 3000
- React with TypeScript for type safety
- Modern CSS with flexbox and grid layouts
- Responsive design for different screen sizes

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source and available under the [MIT License](LICENSE).

## Future Enhancements

- [ ] Persistent game state with database
- [ ] User authentication
- [ ] Game history
- [ ] Chat functionality
- [ ] Sound effects
- [ ] Animations
- [ ] Mobile app
- [ ] AI opponents
