import * as THREE from 'three';
import { Part } from './Part';

export class Character {
    constructor() {
        this.group = new THREE.Group();
        this.parts = {};
        this.engine = null; // Will be set when spawned
        this.properties = {
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
            canCollide: true,
            moveSpeed: 0.1,
            jumpForce: 0.3,
            gravity: 0.01,
            isJumping: false,
            isGrounded: false,
            velocity: new THREE.Vector3(),
            maxFallSpeed: 0.5,
            groundCheckDistance: 0.1,
            collisionBuffer: 0.001,
            bounceFactor: 0.5,
            airResistance: 0.95,
            groundFriction: 0.85,
            maxVelocity: 0.5,
            health: 100,
            maxHealth: 100,
            isInvulnerable: false,
            invulnerabilityDuration: 1000, // milliseconds
            lastDamageTime: 0
        };
        // Add position history array to store last 3 positions
        this.positionHistory = [];
        this.maxHistoryLength = 3;
        this.setupCollision();
        this.createDefaultCharacter();
        this.setupControls();
    }

    setupCollision() {
        // Create a bounding box for collision detection
        this.boundingBox = new THREE.Box3();
    }

    createDefaultCharacter() {
        // Create head (sphere)
        this.parts.head = new Part('sphere', {
            radius: 0.5,
            color: 0xff9999
        });
        this.parts.head.mesh.position.y = 2;

        // Create body (box)
        this.parts.body = new Part('box', {
            width: 1,
            height: 1.5,
            depth: 0.5,
            color: 0x4444ff
        });
        this.parts.body.mesh.position.y = 0.75;

        // Create arms
        this.parts.leftArm = new Part('box', {
            width: 0.3,
            height: 1,
            depth: 0.3,
            color: 0xff9999
        });
        this.parts.leftArm.mesh.position.set(-0.65, 1.5, 0);
        this.parts.leftArm.mesh.rotation.z = Math.PI / 6;

        this.parts.rightArm = new Part('box', {
            width: 0.3,
            height: 1,
            depth: 0.3,
            color: 0xff9999
        });
        this.parts.rightArm.mesh.position.set(0.65, 1.5, 0);
        this.parts.rightArm.mesh.rotation.z = -Math.PI / 6;

        // Create legs
        this.parts.leftLeg = new Part('box', {
            width: 0.3,
            height: 1.5,
            depth: 0.3,
            color: 0x4444ff
        });
        this.parts.leftLeg.mesh.position.set(-0.2, -1.25, 0);

        this.parts.rightLeg = new Part('box', {
            width: 0.3,
            height: 1.5,
            depth: 0.3,
            color: 0x4444ff
        });
        this.parts.rightLeg.mesh.position.set(0.2, -1.25, 0);

        // Add all parts to the group
        Object.values(this.parts).forEach(part => {
            this.group.add(part.mesh);
        });

        // Update the bounding box after all parts are added
        this.boundingBox.setFromObject(this.group);
    }

    setupControls() {
        this.keys = {
            w: false,
            a: false,
            s: false,
            d: false,
            control: false
        };

        // Add key listeners
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
        window.addEventListener('keyup', (e) => this.handleKeyUp(e));
    }

    handleKeyDown(e) {
        switch(e.key.toLowerCase()) {
            case 'w': this.keys.w = true; break;
            case 'a': this.keys.a = true; break;
            case 's': this.keys.s = true; break;
            case 'd': this.keys.d = true; break;
            case 'control': this.keys.control = true; break;
        }
    }

    handleKeyUp(e) {
        switch(e.key.toLowerCase()) {
            case 'w': this.keys.w = false; break;
            case 'a': this.keys.a = false; break;
            case 's': this.keys.s = false; break;
            case 'd': this.keys.d = false; break;
            case 'control': this.keys.control = false; break;
        }
    }

    update() {
        // Store current position in history before any movement
        this.positionHistory.push(this.group.position.clone());
        if (this.positionHistory.length > this.maxHistoryLength) {
            this.positionHistory.shift(); // Remove oldest position
        }

        const moveSpeed = this.properties.moveSpeed;
        const moveVector = new THREE.Vector3();

        // Get camera's forward and right vectors (ignoring vertical rotation)
        const cameraDirection = new THREE.Vector3();
        this.engine.camera.getWorldDirection(cameraDirection);
        cameraDirection.y = 0; // Ignore vertical rotation
        cameraDirection.normalize();

        // Calculate right vector using cross product of up vector and forward vector
        const cameraRight = new THREE.Vector3();
        cameraRight.crossVectors(new THREE.Vector3(0, 1, 0), cameraDirection).normalize();

        // Apply movement based on input, relative to camera direction
        if (this.keys.w) moveVector.add(cameraDirection.multiplyScalar(moveSpeed));
        if (this.keys.s) moveVector.add(cameraDirection.multiplyScalar(-moveSpeed));
        if (this.keys.a) moveVector.add(cameraRight.multiplyScalar(moveSpeed));
        if (this.keys.d) moveVector.add(cameraRight.multiplyScalar(-moveSpeed));

        // Handle jumping - only allow jumping when grounded
        if (this.keys.control && this.properties.isGrounded) {
            this.properties.velocity.y = this.properties.jumpForce;
            this.properties.isJumping = true;
            this.properties.isGrounded = false;
        }

        // Apply gravity when in the air
        if (!this.properties.isGrounded) {
            this.properties.velocity.y -= this.properties.gravity;
            // Cap falling speed to prevent tunneling through objects
            this.properties.velocity.y = Math.max(this.properties.velocity.y, -this.properties.maxFallSpeed);
        }

        // Apply air resistance and ground friction
        if (!this.properties.isGrounded) {
            // Air resistance (stronger horizontal damping in air)
            this.properties.velocity.x *= this.properties.airResistance;
            this.properties.velocity.z *= this.properties.airResistance;
        } else {
            // Ground friction (smoother horizontal damping on ground)
            this.properties.velocity.x *= this.properties.groundFriction;
            this.properties.velocity.z *= this.properties.groundFriction;
        }

        // Cap maximum velocity
        const horizontalVelocity = Math.sqrt(
            this.properties.velocity.x * this.properties.velocity.x + 
            this.properties.velocity.z * this.properties.velocity.z
        );
        if (horizontalVelocity > this.properties.maxVelocity) {
            const scale = this.properties.maxVelocity / horizontalVelocity;
            this.properties.velocity.x *= scale;
            this.properties.velocity.z *= scale;
        }

        // Add velocity to movement vector
        moveVector.add(this.properties.velocity);

        // Apply movement
        this.group.position.x += moveVector.x;
        this.group.position.y += moveVector.y;
        this.group.position.z += moveVector.z;
        this.boundingBox.setFromObject(this.group);
    }

    spawn(scene, engine) {
        this.engine = engine; // Store engine reference
        scene.add(this.group);
        
        // Initialize health if enabled
        if (engine.options.enableHealth) {
            this.properties.health = engine.options.maxHealth;
            this.properties.maxHealth = engine.options.maxHealth;
            engine.createHealthUI();
        }
        
        return this;
    }

    setCharacterModel(model) {
        // Remove existing model
        this.group.clear();
        
        // Add new model
        if (model instanceof THREE.Group) {
            this.group = model;
            this.boundingBox.setFromObject(this.group);
        } else {
            console.error('Invalid model format. Must be a THREE.Group');
        }
    }

    setPosition(x, y, z) {
        this.group.position.set(x, y, z);
        this.boundingBox.setFromObject(this.group);
    }

    setRotation(x, y, z) {
        this.group.rotation.set(x, y, z);
        this.boundingBox.setFromObject(this.group);
    }

    setScale(x, y, z) {
        this.group.scale.set(x, y, z);
        this.boundingBox.setFromObject(this.group);
    }

    setColor(color) {
        Object.values(this.parts).forEach(part => {
            part.setColor(color);
        });
    }

    getCanCollide() {
        return this.properties.canCollide;
    }

    checkCollision(otherPart) {
        if (!this.properties.canCollide || !otherPart.properties.canCollide) {
            return false;
        }
        return this.boundingBox.intersectsBox(otherPart.boundingBox);
    }

    // Add method to restore previous position
    restorePreviousPosition(previousPos) {
        this.group.position.copy(previousPos);
        this.boundingBox.setFromObject(this.group);
    }

    // Health-related methods
    getHealth() {
        return this.properties.health;
    }

    getMaxHealth() {
        return this.properties.maxHealth;
    }

    setHealth(health) {
        this.properties.health = Math.max(0, Math.min(health, this.properties.maxHealth));
    }

    takeDamage(amount) {
        if (this.properties.isInvulnerable) return false;

        const currentTime = Date.now();
        if (currentTime - this.properties.lastDamageTime < this.properties.invulnerabilityDuration) {
            return false;
        }

        this.properties.health = Math.max(0, this.properties.health - amount);
        this.properties.lastDamageTime = currentTime;

        // Flash red when taking damage
        this.flashRed();

        return true;
    }

    heal(amount) {
        this.properties.health = Math.min(this.properties.maxHealth, this.properties.health + amount);
    }

    setInvulnerable(duration = 1000) {
        this.properties.isInvulnerable = true;
        this.properties.invulnerabilityDuration = duration;
        setTimeout(() => {
            this.properties.isInvulnerable = false;
        }, duration);
    }

    flashRed() {
        const originalColors = {};
        Object.values(this.parts).forEach(part => {
            originalColors[part] = part.mesh.material.color.getHex();
            part.mesh.material.color.setHex(0xff0000);
        });

        setTimeout(() => {
            Object.entries(originalColors).forEach(([part, color]) => {
                this.parts[part].mesh.material.color.setHex(color);
            });
        }, 100);
    }

    isDead() {
        return this.properties.health <= 0;
    }
} 