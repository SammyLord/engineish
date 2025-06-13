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

// Default health settings (matching Engine.js)
const DEFAULT_MAX_HEALTH = 100;
const DEFAULT_HEALTH = 100;
const INVULNERABILITY_DURATION = 2000; // 2 seconds of invulnerability after respawn

// Tool action validation
function validateToolAction(data) {
    if (!data.toolName || !data.context) {
        return false;
    }
    return true;
}

// Hopperbin validation
function validateHopperbin(data) {
    if (!data.name || !data.options) {
        return false;
    }
    return true;
}

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // Handle player spawn
    socket.on('playerSpawned', (data) => {
        // Validate and store nickname
        const nickname = validateNickname(data.nickname || `Player${socket.id.slice(0, 4)}`);

        // Store player data with health (matching Character.js properties)
        players.set(socket.id, {
            position: data.position,
            rotation: { y: 0 },
            nickname: nickname,
            health: DEFAULT_HEALTH,
            maxHealth: DEFAULT_MAX_HEALTH,
            isDead: false,
            isInvulnerable: false,
            lastDamageTime: 0,
            hopperbins: new Map() // Store player's hopperbins
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

    // Handle health updates (matching Character.js takeDamage method)
    socket.on('healthUpdate', (data) => {
        const playerData = players.get(socket.id);
        if (playerData) {
            // Check invulnerability
            if (playerData.isInvulnerable) return;

            const currentTime = Date.now();
            if (currentTime - playerData.lastDamageTime < INVULNERABILITY_DURATION) {
                return;
            }

            // Update health
            playerData.health = Math.max(0, Math.min(data.health, playerData.maxHealth));
            playerData.lastDamageTime = currentTime;
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

    // Handle player respawn (matching Engine.js respawnPlayer method)
    socket.on('playerRespawned', (data) => {
        const playerData = players.get(socket.id);
        if (playerData) {
            // Reset health and position
            playerData.health = playerData.maxHealth;
            playerData.isDead = false;
            playerData.position = data.position;
            playerData.isInvulnerable = true;
            playerData.lastDamageTime = Date.now();

            // Broadcast respawn to all players
            io.emit('playerRespawned', {
                id: socket.id,
                position: data.position,
                health: playerData.health,
                maxHealth: playerData.maxHealth
            });

            // Remove invulnerability after duration
            setTimeout(() => {
                if (playerData) {
                    playerData.isInvulnerable = false;
                }
            }, INVULNERABILITY_DURATION);
        }
    });

    // Handle tool actions (matching Scripting.js tool action handling)
    socket.on('toolAction', (data) => {
        // Validate tool action data
        if (!validateToolAction(data)) {
            console.warn('Invalid tool action received:', data);
            return;
        }

        // Broadcast tool action to all other players
        socket.broadcast.emit('toolAction', {
            id: socket.id,
            toolName: data.toolName,
            context: data.context
        });
    });

    // Handle hopperbin actions
    socket.on('hopperbinAction', (data) => {
        const playerData = players.get(socket.id);
        if (!playerData || !validateHopperbin(data)) {
            console.warn('Invalid hopperbin action received:', data);
            return;
        }

        // Store hopperbin in player's inventory
        playerData.hopperbins.set(data.name, data);

        // Broadcast hopperbin action to all other players
        socket.broadcast.emit('hopperbinAction', {
            id: socket.id,
            name: data.name,
            options: data.options,
            action: data.action // 'equip', 'unequip', 'activate', 'deactivate'
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