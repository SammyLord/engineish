import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Character } from './Character';
import { Part } from './Part';
import { Folder } from './Folder';
import { Group } from './Group';
import { SpawnPoint } from './SpawnPoint';
import { io } from 'socket.io-client';

export class Engine {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            enableMultiplayer: false,
            websocketUrl: 'http://localhost:3000',
            enableHealth: false,
            maxHealth: 100,
            ...options
        };
        
        // Initialize multiplayer state
        this.remotePlayers = new Map();
        this.socket = null;
        this.playerId = null;
        this.playerNickname = null;
        
        // Create nickname input UI if multiplayer is enabled
        if (this.options.enableMultiplayer) {
            this.createNicknameUI();
        }
        
        // Initialize THREE.js scene
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        container.appendChild(this.renderer.domElement);

        // Initialize camera settings
        this.cameraOffset = new THREE.Vector3(0, 5, 10);
        this.cameraLookAt = new THREE.Vector3();
        this.cameraLerpFactor = 0.1; // Smoothing factor for camera movement
        this.cameraDistance = 10; // Default camera distance
        this.cameraMinDistance = 2; // Minimum camera distance
        this.cameraMaxDistance = 50; // Maximum camera distance

        // Setup OrbitControls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 2;
        this.controls.maxDistance = 50;
        this.controls.maxPolarAngle = Math.PI / 2;
        this.controls.target.set(0, 1.5, 0); // Look at player height

        // Prevent context menu on right click
        this.renderer.domElement.addEventListener('contextmenu', (event) => {
            event.preventDefault();
        });

        // Initialize core objects
        this.workspace = new Folder('Workspace');
        this.workspace.setEngine(this);
        this.starterCharacter = new Character();
        this.localPlayer = null;
        
        // Setup lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(0, 10, 0);
        this.scene.add(directionalLight);

        // Position camera
        this.camera.position.set(0, 5, 10);
        this.camera.lookAt(0, 0, 0);

        // Initialize collision system
        this.collidableParts = new Set();
        this.groups = new Set(); // Initialize groups Set

        // Initialize spawn points array
        this.spawnPoints = [];

        // Initialize multiplayer if enabled
        if (this.options.enableMultiplayer) {
            this.initializeMultiplayer();
        }

        // Start animation loop
        this.animate();

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);
    }

    createNicknameUI() {
        // Create container for nickname input
        const nicknameContainer = document.createElement('div');
        nicknameContainer.style.position = 'fixed';
        nicknameContainer.style.top = '20px';
        nicknameContainer.style.left = '20px';
        nicknameContainer.style.zIndex = '1000';
        nicknameContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        nicknameContainer.style.padding = '10px';
        nicknameContainer.style.borderRadius = '5px';
        nicknameContainer.style.color = 'white';
        nicknameContainer.style.fontFamily = 'Arial, sans-serif';

        // Create input field
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Enter your nickname';
        input.style.padding = '5px';
        input.style.marginRight = '5px';
        input.style.borderRadius = '3px';
        input.style.border = 'none';

        // Create submit button
        const button = document.createElement('button');
        button.textContent = 'Join Game';
        button.style.padding = '5px 10px';
        button.style.borderRadius = '3px';
        button.style.border = 'none';
        button.style.backgroundColor = '#4CAF50';
        button.style.color = 'white';
        button.style.cursor = 'pointer';

        // Add elements to container
        nicknameContainer.appendChild(input);
        nicknameContainer.appendChild(button);

        // Add container to document
        document.body.appendChild(nicknameContainer);

        // Handle nickname submission
        const handleSubmit = () => {
            const nickname = input.value.trim();
            if (nickname) {
                this.playerNickname = nickname;
                nicknameContainer.style.display = 'none';
                this.initializeMultiplayer();
            }
        };

        // Add event listeners
        button.addEventListener('click', handleSubmit);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleSubmit();
            }
        });
    }

    initializeMultiplayer() {
        // Connect to WebSocket server
        this.socket = io(this.options.websocketUrl);

        // Handle connection events
        this.socket.on('connect', () => {
            console.log('Connected to multiplayer server');
            this.playerId = this.socket.id;
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from multiplayer server');
            this.playerId = null;
        });

        // Handle player events
        this.socket.on('playerJoined', (data) => {
            if (data.id !== this.playerId) {
                this.createRemotePlayer(data.id, data.position, data.nickname);
            }
        });

        this.socket.on('playerLeft', (data) => {
            this.removeRemotePlayer(data.id);
        });

        this.socket.on('playerUpdate', (data) => {
            if (data.id !== this.playerId) {
                this.updateRemotePlayer(data.id, data.position, data.rotation);
            }
        });

        this.socket.on('currentPlayers', (players) => {
            players.forEach(player => {
                if (player.id !== this.playerId) {
                    this.createRemotePlayer(player.id, player.position, player.nickname);
                }
            });
        });
    }

    createRemotePlayer(id, position, nickname) {
        const character = new Character();
        character.spawn(this.scene, this);
        character.setPosition(position.x, position.y, position.z);
        
        // Create nickname label
        const label = this.createNicknameLabel(nickname);
        character.group.add(label);
        
        this.remotePlayers.set(id, character);
    }

    createNicknameLabel(nickname) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 64;

        // Draw background
        context.fillStyle = 'rgba(0, 0, 0, 0.5)';
        context.fillRect(0, 0, canvas.width, canvas.height);

        // Draw text
        context.font = 'bold 32px Arial';
        context.fillStyle = 'white';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(nickname, canvas.width / 2, canvas.height / 2);

        // Create texture
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(material);
        
        // Position the label above the character
        sprite.position.set(0, 3, 0);
        sprite.scale.set(2, 0.5, 1);

        return sprite;
    }

    removeRemotePlayer(id) {
        const character = this.remotePlayers.get(id);
        if (character) {
            this.scene.remove(character.group);
            this.remotePlayers.delete(id);
        }
    }

    updateRemotePlayer(id, position, rotation) {
        const character = this.remotePlayers.get(id);
        if (character) {
            character.setPosition(position.x, position.y, position.z);
            character.group.rotation.y = rotation.y;
        }
    }

    updateCamera() {
        if (!this.localPlayer) return;

        const playerPos = this.localPlayer.group.position;
        
        // Safety check for player position
        const maxAllowedDistance = 100;
        if (Math.abs(playerPos.x) > maxAllowedDistance || 
            Math.abs(playerPos.y) > maxAllowedDistance || 
            Math.abs(playerPos.z) > maxAllowedDistance) {
            this.localPlayer.setPosition(0, 2, 0);
            return;
        }

        // Calculate target position (slightly above player)
        const targetPos = new THREE.Vector3(
            playerPos.x,
            playerPos.y + 1.5,
            playerPos.z
        );

        // Get current camera offset from target
        const currentOffset = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
        
        // Calculate new camera position while maintaining rotation
        const newCameraPos = new THREE.Vector3().addVectors(targetPos, currentOffset);
        
        // Update OrbitControls target
        this.controls.target.copy(targetPos);
        
        // Update camera position
        this.camera.position.copy(newCameraPos);

        // Check for camera collisions
        const direction = new THREE.Vector3().subVectors(this.camera.position, targetPos).normalize();
        const distance = this.camera.position.distanceTo(targetPos);

        const raycaster = new THREE.Raycaster(
            targetPos,
            direction,
            2, // Minimum distance
            distance
        );

        const intersects = raycaster.intersectObjects(this.scene.children, true);
        if (intersects.length > 0) {
            // If we hit something, adjust camera position
            const hitPoint = intersects[0].point;
            const newDistance = hitPoint.distanceTo(targetPos) - 0.5; // Stay slightly before hit point
            const newPos = new THREE.Vector3()
                .subVectors(this.camera.position, targetPos)
                .normalize()
                .multiplyScalar(newDistance)
                .add(targetPos);
            
            this.camera.position.copy(newPos);
        }

        // Make character rotate with camera's horizontal rotation
        const cameraDirection = new THREE.Vector3();
        this.camera.getWorldDirection(cameraDirection);
        // Only use the horizontal direction (ignore vertical rotation)
        cameraDirection.y = 0;
        cameraDirection.normalize();
        
        // Calculate the angle between the camera's direction and the world's forward direction
        const angle = Math.atan2(cameraDirection.x, cameraDirection.z);
        
        // Apply the rotation to the character
        this.localPlayer.group.rotation.y = angle;
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Update character if it exists
        if (this.localPlayer) {
            // First update character (apply forces, input, etc)
            this.localPlayer.update();
            // Then check and resolve collisions
            this.checkCollisions();
            // Finally update camera
            this.updateCamera();

            // Update health UI if enabled
            if (this.options.enableHealth) {
                this.updateHealthUI();
            }

            // Check if player is dead and respawn if needed
            if (this.options.enableHealth && this.localPlayer.isDead()) {
                this.respawnPlayer();
            }

            // If multiplayer is enabled, send position update
            if (this.options.enableMultiplayer && this.socket) {
                this.socket.emit('playerUpdate', {
                    position: {
                        x: this.localPlayer.group.position.x,
                        y: this.localPlayer.group.position.y,
                        z: this.localPlayer.group.position.z
                    },
                    rotation: {
                        y: this.localPlayer.group.rotation.y
                    }
                });
            }
        }

        // Update remote players
        for (const [id, character] of this.remotePlayers) {
            // Update remote player animations if needed
            // This is where you would implement interpolation for smooth movement
        }

        // Update OrbitControls
        this.controls.update();

        // Update spawn points in animation loop
        this.updateSpawnPoints();

        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // Core API methods
    spawn(startX = -32, startY = 4, startZ = 20) {
        // Create and spawn the character
        this.localPlayer = this.starterCharacter.spawn(this.scene, this);
        
        // Add nickname label for local player
        if (this.playerNickname) {
            const label = this.createNicknameLabel(this.playerNickname);
            this.localPlayer.group.add(label);
        }
        
        // Wait for the next frame to ensure everything is initialized
        requestAnimationFrame(() => {
            // Set the initial position
            this.localPlayer.setPosition(startX, startY, startZ);
            
            // Update the camera to look at the new position
            this.camera.position.set(startX, startY + 5, startZ + 10);
            this.camera.lookAt(startX, startY, startZ);
            this.controls.target.set(startX, startY, startZ);

            // If multiplayer is enabled, notify server of player spawn
            if (this.options.enableMultiplayer && this.socket) {
                this.socket.emit('playerSpawned', {
                    position: {
                        x: startX,
                        y: startY,
                        z: startZ
                    },
                    nickname: this.playerNickname
                });
            }
        });
        
        return this.localPlayer;
    }

    spawnBaseplate(color = 0x00ff00, yPos = 0, xSize = 100, zSize = 100) {
        const baseplate = new Part('box', { 
            width: xSize, 
            height: 1, 
            depth: zSize,
            color: color,
            canCollide: true
        });
        baseplate.mesh.position.y = yPos - 0.5; // Position half height down so top surface is at yPos
        return this.addPart(baseplate);
    }

    createFolder(name) {
        const folder = new Folder(name);
        this.workspace.add(folder);
        return folder;
    }

    createGroup(name) {
        const group = new Group(name);
        this.scene.add(group.group);
        // Add all collidable parts from the group to the collision system
        this.addGroupToCollisionSystem(group);
        return group;
    }

    addPart(part) {
        this.scene.add(part.mesh);
        // Automatically add to collision system
        this.addToCollisionSystem(part);
        return part;
    }

    // Collision methods
    checkCollisions() {
        if (!this.localPlayer) return;

        // Reset grounded state at the start of each frame
        // This ensures we only stay grounded if we're actually touching something
        this.localPlayer.properties.isGrounded = false;

        // Update player's bounding box
        this.localPlayer.boundingBox.setFromObject(this.localPlayer.group);

        // Store the initial position in case we need to revert
        const initialPosition = this.localPlayer.group.position.clone();
        
        // Combine all collidable parts into one array for checking
        const allCollidableParts = [...this.collidableParts];
        
        // Add parts from groups
        for (const group of this.groups) {
            // Update collision boxes for the group's parts
            group.updateCollisionBoxes();
            allCollidableParts.push(...group.getCollidableParts());
        }

        // Check collisions with all parts
        for (const part of allCollidableParts) {
            if (part.checkCollision(this.localPlayer)) {
                this.handleCollision(this.localPlayer, part);
            }
        }
    }

    handleCollision(player, part) {
        // Basic collision response - prevent player from passing through
        const playerBox = player.boundingBox;
        const partBox = part.boundingBox;

        // Calculate centers
        const playerCenter = new THREE.Vector3();
        const partCenter = new THREE.Vector3();
        playerBox.getCenter(playerCenter);
        partBox.getCenter(partCenter);

        // Calculate overlap
        const overlapX = Math.min(
            playerBox.max.x - partBox.min.x,
            partBox.max.x - playerBox.min.x
        );
        const overlapY = Math.min(
            playerBox.max.y - partBox.min.y,
            partBox.max.y - playerBox.min.y
        );
        const overlapZ = Math.min(
            playerBox.max.z - partBox.min.z,
            partBox.max.z - playerBox.min.z
        );

        // Calculate direction from part to player
        const direction = new THREE.Vector3().subVectors(playerCenter, partCenter).normalize();
        
        // Calculate the slope angle for Y-axis collisions
        const slopeAngle = Math.abs(Math.atan2(direction.y, Math.sqrt(direction.x * direction.x + direction.z * direction.z)));
        const maxSlopeAngle = Math.PI / 4; // 45 degrees

        // Store the original position for comparison
        const originalPos = player.group.position.clone();
        
        // Calculate all possible resolution axes
        const resolutionAxes = [];
        
        // Determine if player is on top based on both direction and position
        const verticalThreshold = 0.3; // Increased threshold for better top detection
        const isOnTop = (direction.y > 0 && Math.abs(direction.y) > verticalThreshold) || 
                       (Math.abs(playerBox.min.y - partBox.max.y) < 0.5 && player.properties.velocity.y <= 0);

        // Add Y-axis resolution first if we're on top of something
        if (isOnTop) {
            // When on top, push up just enough to rest on the surface
            const surfaceY = partBox.max.y;
            const pushUpAmount = surfaceY - playerBox.min.y + 0.001; // Add tiny buffer to prevent floating point issues
            
            resolutionAxes.push({
                axis: 'y',
                overlap: overlapY,
                priority: 1,
                amount: pushUpAmount
            });

            // Set grounded state immediately when we detect we're on top
            player.properties.isGrounded = true;
            player.properties.isJumping = false;
            player.properties.velocity.y = 0; // Reset vertical velocity when grounded
        }
        // Otherwise, add all valid axes
        else {
            // Check each axis and add valid resolutions
            if (Math.abs(direction.y) > 0.1) {
                resolutionAxes.push({
                    axis: 'y',
                    overlap: overlapY,
                    priority: direction.y > 0 ? 1 : 2,
                    amount: direction.y > 0 ? overlapY : -overlapY
                });
            }
            
            if (Math.abs(direction.x) > 0.1) {
                resolutionAxes.push({
                    axis: 'x',
                    overlap: overlapX,
                    priority: 3,
                    amount: direction.x > 0 ? overlapX : -overlapX
                });
            }
            
            if (Math.abs(direction.z) > 0.1) {
                resolutionAxes.push({
                    axis: 'z',
                    overlap: overlapZ,
                    priority: 3,
                    amount: direction.z > 0 ? overlapZ : -overlapZ
                });
            }

            // If we're not on top, we're not grounded
            player.properties.isGrounded = false;
        }

        // Sort resolutions by priority and overlap (smaller overlap first)
        resolutionAxes.sort((a, b) => {
            if (a.priority !== b.priority) return a.priority - b.priority;
            return a.overlap - b.overlap;
        });

        // If we have a collision and position history, rewind to the last safe position
        if (player.positionHistory && player.positionHistory.length > 0) {
            // Get the last safe position (3 frames ago)
            const lastSafePosition = player.positionHistory[0];
            
            // Only rewind if we're not on top of something (to prevent falling through)
            if (!isOnTop) {
                // Store current velocity before rewind
                const currentVelocity = player.properties.velocity.clone();
                
                // Rewind to the last safe position
                player.group.position.copy(lastSafePosition);
                player.boundingBox.setFromObject(player.group);
                
                // Reset velocity in the direction of collision
                if (Math.abs(direction.x) > 0.1) player.properties.velocity.x = 0;
                if (Math.abs(direction.z) > 0.1) player.properties.velocity.z = 0;
                
                // Keep vertical velocity if we're falling
                if (currentVelocity.y < 0) {
                    player.properties.velocity.y = currentVelocity.y;
                }
                
                // Clear position history to prevent multiple rewinds
                player.positionHistory = [];
                
                // Add the current position to history to prevent immediate rewind
                player.positionHistory.push(player.group.position.clone());
            }
        }

        // Update the player's bounding box one final time
        player.boundingBox.setFromObject(player.group);
    }

    // Add a part to the collision system
    addToCollisionSystem(part) {
        if (part instanceof Part && part.getCanCollide()) {
            part.updateBoundingBox();
            this.collidableParts.add(part);
        }
    }

    // Remove a part from the collision system
    removeFromCollisionSystem(part) {
        this.collidableParts.delete(part);
    }

    // Add a group's parts to the collision system
    addGroupToCollisionSystem(group) {
        if (group instanceof Group) {
            this.groups.add(group);
            // Update collision boxes for all parts in the group
            group.updateCollisionBoxes();
        }
    }

    // Remove a group's parts from the collision system
    removeGroupFromCollisionSystem(group) {
        if (group instanceof Group) {
            this.groups.delete(group);
            // Remove any collidable parts from this group
            for (const part of group.getCollidableParts()) {
                this.collidableParts.delete(part);
            }
        }
    }

    // Part manipulation methods
    setPartColor(part, color) {
        if (part instanceof Part) {
            part.setColor(color);
        } else {
            console.warn('setPartColor: Invalid part provided');
        }
    }

    setPartSize(part, width, height, depth) {
        if (part instanceof Part) {
            // Update the part's properties
            part.properties.width = width;
            part.properties.height = height;
            part.properties.depth = depth;
            
            // Recreate the mesh with new dimensions
            const oldMesh = part.mesh;
            part.mesh = part.createMesh();
            
            // Copy position, rotation, and scale from old mesh
            part.mesh.position.copy(oldMesh.position);
            part.mesh.rotation.copy(oldMesh.rotation);
            part.mesh.scale.copy(oldMesh.scale);
            
            // Replace the old mesh in the scene
            this.scene.remove(oldMesh);
            this.scene.add(part.mesh);
            
            // Update collision box
            part.updateBoundingBox();
        } else {
            console.warn('setPartSize: Invalid part provided');
        }
    }

    setPartTexture(part, textureUrl) {
        if (part instanceof Part) {
            const textureLoader = new THREE.TextureLoader();
            textureLoader.load(textureUrl, (texture) => {
                part.mesh.material.map = texture;
                part.mesh.material.needsUpdate = true;
            }, undefined, (error) => {
                console.error('Error loading texture:', error);
            });
        } else {
            console.warn('setPartTexture: Invalid part provided');
        }
    }

    setPartPosition(part, x, y, z) {
        if (part instanceof Part) {
            // Update the part's properties
            part.properties.position = { x, y, z };
            
            // Update the mesh position
            part.mesh.position.set(x, y, z);
            
            // Update collision box
            part.updateBoundingBox();
        } else {
            console.warn('setPartPosition: Invalid part provided');
        }
    }

    setPartPositionRelative(part, deltaX, deltaY, deltaZ) {
        if (part instanceof Part) {
            // Get current position
            const currentX = part.mesh.position.x;
            const currentY = part.mesh.position.y;
            const currentZ = part.mesh.position.z;
            
            // Calculate new position
            const newX = currentX + deltaX;
            const newY = currentY + deltaY;
            const newZ = currentZ + deltaZ;
            
            // Update position using existing method
            this.setPartPosition(part, newX, newY, newZ);
        } else {
            console.warn('setPartPositionRelative: Invalid part provided');
        }
    }

    setPartSizeRelative(part, deltaWidth, deltaHeight, deltaDepth) {
        if (part instanceof Part) {
            // Get current dimensions
            const currentWidth = part.properties.width || 1;
            const currentHeight = part.properties.height || 1;
            const currentDepth = part.properties.depth || 1;
            
            // Calculate new dimensions
            const newWidth = Math.max(0.1, currentWidth + deltaWidth);  // Minimum size of 0.1
            const newHeight = Math.max(0.1, currentHeight + deltaHeight);
            const newDepth = Math.max(0.1, currentDepth + deltaDepth);
            
            // Update size using existing method
            this.setPartSize(part, newWidth, newHeight, newDepth);
        } else {
            console.warn('setPartSizeRelative: Invalid part provided');
        }
    }

    setSkyColor(color) {
        this.scene.background = new THREE.Color(color);
    }

    setSkyTexture(textureUrl) {
        const textureLoader = new THREE.TextureLoader();
        textureLoader.load(textureUrl, (texture) => {
            this.scene.background = texture;
        }, undefined, (error) => {
            console.error('Error loading sky texture:', error);
        });
    }

    // Utility methods
    rgb(r, g, b) {
        // Ensure values are within valid range (0-255)
        r = Math.max(0, Math.min(255, r));
        g = Math.max(0, Math.min(255, g));
        b = Math.max(0, Math.min(255, b));
        
        // Convert to hex number (not string)
        return (r << 16) | (g << 8) | b;
    }

    setPlaceTitle(title) {
        document.title = `Engineish - ${title}`;
    }

    // ROBLOX XML parsing methods
    loadRobloxPlaceXML(xmlContent) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlContent, 'text/xml');
        this.parseRobloxXML(doc, true);
    }

    loadRobloxModelXML(xmlContent) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlContent, 'text/xml');
        this.parseRobloxXML(doc, false);
    }

    parseRobloxXML(doc, isPlace) {
        // Get the root element (either RobloxPlace or RobloxModel)
        const root = doc.documentElement;
        if (!root) return;

        // Process all Part elements
        const parts = root.getElementsByTagName('Part');
        for (const partElement of parts) {
            this.createPartFromXML(partElement);
        }

        // Process all Model elements recursively
        const models = root.getElementsByTagName('Model');
        for (const modelElement of models) {
            this.processModelElement(modelElement);
        }
    }

    createPartFromXML(partElement) {
        // Get basic properties
        const name = partElement.getAttribute('Name') || 'Part';
        const className = partElement.getAttribute('ClassName') || 'Part';
        
        // Get position
        const position = partElement.getElementsByTagName('Position')[0];
        const x = position ? parseFloat(position.getAttribute('X')) : 0;
        const y = position ? parseFloat(position.getAttribute('Y')) : 0;
        const z = position ? parseFloat(position.getAttribute('Z')) : 0;

        // Get size
        const size = partElement.getElementsByTagName('Size')[0];
        const width = size ? parseFloat(size.getAttribute('X')) : 1;
        const height = size ? parseFloat(size.getAttribute('Y')) : 1;
        const depth = size ? parseFloat(size.getAttribute('Z')) : 1;

        // Get color
        const color = partElement.getElementsByTagName('Color3')[0];
        const r = color ? parseFloat(color.getAttribute('R')) * 255 : 128;
        const g = color ? parseFloat(color.getAttribute('G')) * 255 : 128;
        const b = color ? parseFloat(color.getAttribute('B')) * 255 : 128;

        // Get shape
        const shape = partElement.getElementsByTagName('Shape')[0];
        let partType = 'box';
        if (shape) {
            const shapeValue = shape.getAttribute('Value');
            switch (shapeValue) {
                case 'Ball':
                    partType = 'sphere';
                    break;
                case 'Cylinder':
                    partType = 'cylinder';
                    break;
                case 'Cone':
                    partType = 'cone';
                    break;
                // Add more shape conversions as needed
            }
        }

        // Create the part
        const part = new Part(partType, {
            width: width,
            height: height,
            depth: depth,
            color: this.rgb(r, g, b),
            canCollide: true
        });

        // Set position
        this.setPartPosition(part, x, y, z);

        // Add to scene
        this.addPart(part);

        return part;
    }

    processModelElement(modelElement) {
        const name = modelElement.getAttribute('Name') || 'Model';
        const group = this.createGroup(name);

        // Process all parts in the model
        const parts = modelElement.getElementsByTagName('Part');
        for (const partElement of parts) {
            const part = this.createPartFromXML(partElement);
            if (part) {
                group.add(part);
            }
        }

        // Process nested models recursively
        const nestedModels = modelElement.getElementsByTagName('Model');
        for (const nestedModel of nestedModels) {
            this.processModelElement(nestedModel);
        }

        return group;
    }

    createHealthUI() {
        if (!this.options.enableHealth) return;

        const healthContainer = document.createElement('div');
        healthContainer.style.position = 'absolute';
        healthContainer.style.top = '20px';
        healthContainer.style.left = '20px';
        healthContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        healthContainer.style.padding = '10px';
        healthContainer.style.borderRadius = '5px';
        healthContainer.style.color = 'white';
        healthContainer.style.fontFamily = 'Arial, sans-serif';
        healthContainer.style.zIndex = '1000';

        const healthBar = document.createElement('div');
        healthBar.style.width = '200px';
        healthBar.style.height = '20px';
        healthBar.style.backgroundColor = '#333';
        healthBar.style.borderRadius = '10px';
        healthBar.style.overflow = 'hidden';

        const healthFill = document.createElement('div');
        healthFill.style.width = '100%';
        healthFill.style.height = '100%';
        healthFill.style.backgroundColor = '#00ff00';
        healthFill.style.transition = 'width 0.3s ease-in-out';

        const healthText = document.createElement('div');
        healthText.style.textAlign = 'center';
        healthText.style.marginTop = '5px';
        healthText.style.fontSize = '14px';

        healthBar.appendChild(healthFill);
        healthContainer.appendChild(healthBar);
        healthContainer.appendChild(healthText);
        this.container.appendChild(healthContainer);

        this.healthUI = {
            container: healthContainer,
            bar: healthFill,
            text: healthText
        };
    }

    updateHealthUI() {
        if (!this.options.enableHealth || !this.healthUI || !this.localPlayer) return;

        const health = this.localPlayer.getHealth();
        const maxHealth = this.localPlayer.getMaxHealth();
        const percentage = (health / maxHealth) * 100;

        this.healthUI.bar.style.width = `${percentage}%`;
        this.healthUI.text.textContent = `Health: ${Math.round(health)}/${maxHealth}`;

        // Update health bar color based on health percentage
        if (percentage > 60) {
            this.healthUI.bar.style.backgroundColor = '#00ff00';
        } else if (percentage > 30) {
            this.healthUI.bar.style.backgroundColor = '#ffff00';
        } else {
            this.healthUI.bar.style.backgroundColor = '#ff0000';
        }
    }

    // Spawn point methods
    createSpawnPoint(x, y, z) {
        const spawnPoint = new SpawnPoint();
        spawnPoint.setPosition(x, y, z);
        this.scene.add(spawnPoint.mesh);
        this.spawnPoints.push(spawnPoint);
        return spawnPoint;
    }

    respawnPlayer() {
        if (!this.localPlayer || this.spawnPoints.length === 0) return;

        // Select a random spawn point
        const randomIndex = Math.floor(Math.random() * this.spawnPoints.length);
        const spawnPoint = this.spawnPoints[randomIndex];
        const spawnPos = spawnPoint.getSpawnPosition();

        // Reset player position and health
        this.localPlayer.setPosition(spawnPos.x, spawnPos.y, spawnPos.z);
        this.localPlayer.setHealth(this.localPlayer.getMaxHealth());
        
        // Give brief invulnerability after respawning
        this.localPlayer.setInvulnerable(2000); // 2 seconds of invulnerability

        // Update camera to look at new position
        this.camera.position.set(spawnPos.x, spawnPos.y + 5, spawnPos.z + 10);
        this.camera.lookAt(spawnPos.x, spawnPos.y, spawnPos.z);
        this.controls.target.set(spawnPos.x, spawnPos.y, spawnPos.z);
    }

    // Update spawn points in animation loop
    updateSpawnPoints() {
        this.spawnPoints.forEach(spawnPoint => spawnPoint.update());
    }
} 