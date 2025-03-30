const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files from the dist directory
app.use(express.static('dist'));

// Store connected players
const players = new Map();

// Validate nickname
function validateNickname(nickname) {
    // Remove any HTML tags
    nickname = nickname.replace(/<[^>]*>/g, '');
    // Limit length to 20 characters
    nickname = nickname.substring(0, 20);
    // Remove any non-alphanumeric characters except spaces
    nickname = nickname.replace(/[^a-zA-Z0-9\s]/g, '');
    return nickname.trim();
}

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // Handle player spawn
    socket.on('playerSpawned', (data) => {
        // Validate and store nickname
        const nickname = validateNickname(data.nickname || `Player${socket.id.slice(0, 4)}`);

        // Store player data
        players.set(socket.id, {
            position: data.position,
            rotation: { y: 0 },
            nickname: nickname
        });

        // Broadcast to all other players that a new player has joined
        socket.broadcast.emit('playerJoined', {
            id: socket.id,
            position: data.position,
            nickname: nickname
        });

        // Send current players to the new player
        const currentPlayers = Array.from(players.entries()).map(([id, data]) => ({
            id,
            position: data.position,
            nickname: data.nickname
        }));
        socket.emit('currentPlayers', currentPlayers);
    });

    // Handle player updates
    socket.on('playerUpdate', (data) => {
        // Update player data
        const playerData = players.get(socket.id);
        if (playerData) {
            playerData.position = data.position;
            playerData.rotation = data.rotation;
        }

        // Broadcast update to all other players
        socket.broadcast.emit('playerUpdate', {
            id: socket.id,
            position: data.position,
            rotation: data.rotation
        });
    });

    // Handle nickname changes
    socket.on('nicknameChange', (data) => {
        // Validate the new nickname
        const newNickname = validateNickname(data.nickname);
        
        // Update player data
        const playerData = players.get(socket.id);
        if (playerData) {
            playerData.nickname = newNickname;
        }

        // Broadcast nickname change to all other players
        socket.broadcast.emit('nicknameChange', {
            id: socket.id,
            nickname: newNickname
        });
    });

    // Handle character color changes
    socket.on('characterColorChange', (data) => {
        // Update player data with the new color
        const playerData = players.get(socket.id);
        if (playerData) {
            playerData.colors = playerData.colors || {};
            playerData.colors[data.partName] = data.color;
        }

        // Broadcast color change to all other players
        socket.broadcast.emit('characterColorChange', {
            id: socket.id,
            partName: data.partName,
            color: data.color
        });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        
        // Remove player from storage
        players.delete(socket.id);
        
        // Notify other players
        socket.broadcast.emit('playerLeft', {
            id: socket.id
        });
    });
});

// Start server
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 