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

        // Check collisions between player and all collidable parts
        for (const part of this.collidableParts) {
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
        
        // Store current position for safety check
        const originalPos = player.group.position.clone();
        let newPos = originalPos.clone();

        if (minOverlap === overlapX) {
            // Resolve X-axis collision
            if (playerCenter.x > partCenter.x) {
                newPos.x += overlapX * 0.5;
            } else {
                newPos.x -= overlapX * 0.5;
            }
        } else if (minOverlap === overlapY) {
            // Resolve Y-axis collision
            if (playerCenter.y > partCenter.y) {
                newPos.y += overlapY * 0.5;
                // Reset jumping state when landing
                player.properties.isJumping = false;
                player.properties.velocity.y = 0;
            } else {
                newPos.y -= overlapY * 0.5;
            }
        } else {
            // Resolve Z-axis collision
            if (playerCenter.z > partCenter.z) {
                newPos.z += overlapZ * 0.5;
            } else {
                newPos.z -= overlapZ * 0.5;
            }
        }

        // Safety check - don't allow extreme position changes
        const maxPositionChange = 5;
        if (newPos.distanceTo(originalPos) < maxPositionChange) {
            player.setPosition(newPos.x, newPos.y, newPos.z);
        } else {
            // If position change is too extreme, reset to a safe position
            player.setPosition(0, 2, 0);
        }
    }

    // Add a part to the collision system
    addToCollisionSystem(part) {
        if (part instanceof Part && part.getCanCollide()) {
            this.collidableParts.add(part);
        }
    }

    // Remove a part from the collision system
    removeFromCollisionSystem(part) {
        this.collidableParts.delete(part);
    }
} 