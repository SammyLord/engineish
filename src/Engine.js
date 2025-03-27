import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Character } from './Character';
import { Part } from './Part';
import { Folder } from './Folder';
import { Group } from './Group';

export class Engine {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            enableMultiplayer: false,
            ...options
        };
        
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

        // Start animation loop
        this.animate();

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);
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
        
        // Calculate desired camera position
        const targetCameraPos = new THREE.Vector3(
            playerPos.x + this.cameraOffset.x,
            playerPos.y + this.cameraOffset.y,
            playerPos.z + this.cameraOffset.z
        );

        // Only update camera position if the difference is significant but not too large
        const positionDiff = this.camera.position.distanceTo(targetCameraPos);
        if (positionDiff > 0.01 && positionDiff < maxAllowedDistance) {
            this.camera.position.lerp(targetCameraPos, this.cameraLerpFactor);
        } else if (positionDiff >= maxAllowedDistance) {
            // Reset camera if too far
            this.camera.position.copy(new THREE.Vector3(0, 7, 10));
        } else {
            this.camera.position.copy(targetCameraPos);
        }

        // Calculate look target (slightly above player)
        this.cameraLookAt.set(
            playerPos.x,
            playerPos.y + 1.5,
            playerPos.z
        );

        this.camera.lookAt(this.cameraLookAt);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Update character if it exists
        if (this.localPlayer) {
            this.localPlayer.update();
            this.updateCamera();
        }

        this.checkCollisions();
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // Core API methods
    spawn() {
        this.localPlayer = this.starterCharacter.spawn(this.scene);
        // Start character at a safe height
        this.localPlayer.setPosition(0, 2, 0);
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
        const isOnTop = direction.y > 0 && 
                       Math.abs(direction.y) > 0.5 && // Reduced from 0.7 for more lenient top detection
                       Math.abs(playerBox.min.y - partBox.max.y) < 0.2; // Increased from 0.1 for more forgiving ground detection

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
        }

        // Sort resolutions by priority and overlap (smaller overlap first)
        resolutionAxes.sort((a, b) => {
            if (a.priority !== b.priority) return a.priority - b.priority;
            return a.overlap - b.overlap;
        });

        // Try each resolution axis until we find one that works
        for (const resolution of resolutionAxes) {
            const newPos = player.group.position.clone();
            newPos[resolution.axis] += resolution.amount;

            // Apply special handling for Y-axis
            if (resolution.axis === 'y') {
                // Only reset jumping and velocity if we're actually landing (not just brushing the side)
                if (isOnTop) {
                    player.properties.isJumping = false;
                    player.properties.velocity.y = 0; // Reset Y velocity when grounded

                    if (slopeAngle > maxSlopeAngle) {
                        // Smoother sliding behavior
                        const slideDir = new THREE.Vector3(direction.x, 0, direction.z).normalize();
                        const slideSpeed = 0.05; // Reduced from 0.1 for smoother movement
                        
                        // Apply sliding with reduced speed
                        player.properties.velocity.x = -slideDir.x * slideSpeed;
                        player.properties.velocity.z = -slideDir.z * slideSpeed;
                    } else {
                        // When standing on something, gradually stop horizontal movement
                        player.properties.velocity.x *= 0.8;
                        player.properties.velocity.z *= 0.8;
                    }
                } else if (direction.y < 0) {
                    // If we're hitting something from below, stop upward velocity
                    player.properties.velocity.y = Math.min(0, player.properties.velocity.y);
                }
            }

            // Apply the position change if it's reasonable
            const maxPositionChange = isOnTop ? 0.2 : 0.5; // Slightly increased threshold for top collision
            const positionChange = newPos.distanceTo(originalPos);
            
            if (positionChange <= maxPositionChange) {
                player.group.position.copy(newPos);
                // Update bounding box after position change
                player.boundingBox.setFromObject(player.group);
                return; // Exit after applying the first valid resolution
            }
        }

        // If no valid resolution found, revert to original position
        player.group.position.copy(originalPos);
        // Update bounding box after position revert
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
} 