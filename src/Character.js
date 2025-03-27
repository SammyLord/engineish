import * as THREE from 'three';
import { Part } from './Part';

export class Character {
    constructor() {
        this.group = new THREE.Group();
        this.parts = {};
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
            velocity: new THREE.Vector3()
        };
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
        const moveSpeed = this.properties.moveSpeed;
        const moveVector = new THREE.Vector3();

        // Apply movement based on input
        if (this.keys.w) moveVector.z -= moveSpeed;
        if (this.keys.s) moveVector.z += moveSpeed;
        if (this.keys.a) moveVector.x -= moveSpeed;
        if (this.keys.d) moveVector.x += moveSpeed;

        // Handle jumping
        if (this.keys.control && this.properties.isGrounded) {
            this.properties.velocity.y = this.properties.jumpForce;
            this.properties.isJumping = true;
            this.properties.isGrounded = false;
        }

        // Always apply gravity unless we're grounded
        // This ensures we fall when walking off edges
        if (!this.properties.isGrounded) {
            this.properties.velocity.y -= this.properties.gravity;
            // Cap falling speed to prevent tunneling through objects
            this.properties.velocity.y = Math.max(this.properties.velocity.y, -1.0);
        }

        // Apply air resistance and ground friction
        if (!this.properties.isGrounded) {
            // Air resistance (stronger horizontal damping in air)
            this.properties.velocity.x *= 0.95;
            this.properties.velocity.z *= 0.95;
        } else {
            // Ground friction (smoother horizontal damping on ground)
            this.properties.velocity.x *= 0.85;
            this.properties.velocity.z *= 0.85;
            // Reset vertical velocity when grounded
            this.properties.velocity.y = 0;
        }

        // Add velocity to movement vector
        moveVector.add(this.properties.velocity);

        // Apply movement in separate axes to allow for better collision handling
        this.group.position.x += moveVector.x;
        this.group.position.y += moveVector.y;
        this.group.position.z += moveVector.z;

        // Update bounding box for collision detection
        this.boundingBox.setFromObject(this.group);

        // If we're falling very fast, we might be falling through objects
        // Log for debugging
        if (this.properties.velocity.y < -0.5) {
            console.log('Falling speed:', this.properties.velocity.y);
            console.log('Position:', this.group.position.y);
            console.log('Grounded:', this.properties.isGrounded);
        }
    }

    spawn(scene) {
        scene.add(this.group);
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
} 