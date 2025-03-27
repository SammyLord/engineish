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

        // Add baseplate by default with gray color
        this.baseplate = this.addBaseplate(0x808080);

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

    addBaseplate(color = 0x808080) {
        const baseplate = new Part('box', { 
            width: 100, 
            height: 1, 
            depth: 100,
            color: color,
            canCollide: true
        });
        baseplate.mesh.position.y = -0.5; // Position slightly below 0 so player stands on top
        this.scene.add(baseplate.mesh);
        
        // Make sure the baseplate is collidable
        baseplate.setupCollision();
        baseplate.boundingBox.setFromObject(baseplate.mesh);
        this.collidableParts.add(baseplate);
        
        return baseplate;
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

        // Find the smallest overlap to determine which axis to resolve
        const minOverlap = Math.min(overlapX, overlapY, overlapZ);
        
        // Calculate direction from part to player
        const direction = new THREE.Vector3().subVectors(playerCenter, partCenter).normalize();
        
        // Calculate the slope angle for Y-axis collisions
        const slopeAngle = Math.abs(Math.atan2(direction.y, Math.sqrt(direction.x * direction.x + direction.z * direction.z)));
        const maxSlopeAngle = Math.PI / 4; // 45 degrees
        
        // Determine primary collision axis based on direction and overlap
        let collisionAxis = '';
        let collisionAmount = 0;
        
        if (minOverlap === overlapY && Math.abs(direction.y) > 0.1) {
            collisionAxis = 'y';
            collisionAmount = direction.y > 0 ? overlapY : -overlapY;
            
            // Handle landing on top of objects
            if (direction.y > 0) {
                player.properties.isJumping = false;
                player.properties.velocity.y = 0;
                
                // If on a slope, slide down if too steep
                if (slopeAngle > maxSlopeAngle) {
                    // Calculate slide direction
                    const slideDir = new THREE.Vector3(direction.x, 0, direction.z).normalize();
                    player.properties.velocity.x = -slideDir.x * 0.1;
                    player.properties.velocity.z = -slideDir.z * 0.1;
                } else {
                    // On a walkable slope or flat surface
                    player.properties.velocity.x = 0;
                    player.properties.velocity.z = 0;
                }
            }
        } else if (minOverlap === overlapX && Math.abs(direction.x) > 0.5) {
            collisionAxis = 'x';
            collisionAmount = direction.x > 0 ? overlapX : -overlapX;
            player.properties.velocity.x = 0;
        } else if (minOverlap === overlapZ && Math.abs(direction.z) > 0.5) {
            collisionAxis = 'z';
            collisionAmount = direction.z > 0 ? overlapZ : -overlapZ;
            player.properties.velocity.z = 0;
        }

        // Apply collision response if we found a valid axis
        if (collisionAxis) {
            const newPos = player.group.position.clone();
            
            // Apply the collision response
            newPos[collisionAxis] += collisionAmount;
            
            // Check if the position change is reasonable
            const maxPositionChange = 2;
            if (newPos.distanceTo(player.group.position) < maxPositionChange) {
                player.setPosition(newPos.x, newPos.y, newPos.z);
            } else {
                // If change is too extreme, try to find a safe position
                const safePos = player.group.position.clone();
                safePos.y = Math.max(safePos.y, 0); // Keep above ground
                player.setPosition(safePos.x, safePos.y, safePos.z);
            }
        }
    }

    // Add a part to the collision system
    addToCollisionSystem(part) {
        if (part instanceof Part && part.getCanCollide()) {
            part.boundingBox.setFromObject(part.mesh);
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