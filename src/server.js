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

// Default health settings
const DEFAULT_MAX_HEALTH = 100;
const DEFAULT_HEALTH = 100;

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // Handle player spawn
    socket.on('playerSpawned', (data) => {
        // Validate and store nickname
        const nickname = validateNickname(data.nickname || `Player${socket.id.slice(0, 4)}`);

        // Store player data with health
        players.set(socket.id, {
            position: data.position,
            rotation: { y: 0 },
            nickname: nickname,
            health: DEFAULT_HEALTH,
            maxHealth: DEFAULT_MAX_HEALTH,
            isDead: false
        });

        // Broadcast to all other players that a new player has joined
        socket.broadcast.emit('playerJoined', {
            id: socket.id,
            position: data.position,
            nickname: nickname,
            health: DEFAULT_HEALTH,
            maxHealth: DEFAULT_MAX_HEALTH
        });

        // Send current players to the new player
        const currentPlayers = Array.from(players.entries()).map(([id, data]) => ({
            id,
            position: data.position,
            nickname: data.nickname,
            health: data.health,
            maxHealth: data.maxHealth
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

    // Handle health updates
    socket.on('healthUpdate', (data) => {
        const playerData = players.get(socket.id);
        if (playerData) {
            // Update health
            playerData.health = Math.max(0, Math.min(data.health, playerData.maxHealth));
            playerData.isDead = playerData.health <= 0;

            // Broadcast health update to all players
            io.emit('healthUpdate', {
                id: socket.id,
                health: playerData.health,
                maxHealth: playerData.maxHealth,
                isDead: playerData.isDead
            });

            // If player died, broadcast death event
            if (playerData.isDead) {
                io.emit('playerDied', {
                    id: socket.id
                });
            }
        }
    });

    // Handle player respawn
    socket.on('playerRespawned', (data) => {
        const playerData = players.get(socket.id);
        if (playerData) {
            // Reset health and position
            playerData.health = playerData.maxHealth;
            playerData.isDead = false;
            playerData.position = data.position;

            // Broadcast respawn to all players
            io.emit('playerRespawned', {
                id: socket.id,
                position: data.position,
                health: playerData.health,
                maxHealth: playerData.maxHealth
            });
        }
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