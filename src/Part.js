import * as THREE from 'three';

export class Part {
    constructor(type, properties = {}) {
        this.type = type;
        this.properties = {
            color: 0x808080,
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
            canCollide: true,
            ...properties
        };

        this.mesh = this.createMesh();
        this.setupCollision();
        this.applyProperties();
    }

    setupCollision() {
        // Create a bounding box for collision detection
        this.boundingBox = new THREE.Box3();
        
        // Create a raycaster for collision detection
        this.raycaster = new THREE.Raycaster();
    }

    createMesh() {
        let geometry;
        switch (this.type.toLowerCase()) {
            case 'box':
                geometry = new THREE.BoxGeometry(
                    this.properties.width || 1,
                    this.properties.height || 1,
                    this.properties.depth || 1
                );
                break;
            case 'sphere':
                geometry = new THREE.SphereGeometry(
                    this.properties.radius || 0.5,
                    32,
                    32
                );
                break;
            case 'cylinder':
                geometry = new THREE.CylinderGeometry(
                    this.properties.radius || 0.5,
                    this.properties.radius || 0.5,
                    this.properties.height || 1,
                    32
                );
                break;
            case 'cone':
                geometry = new THREE.ConeGeometry(
                    this.properties.radius || 0.5,
                    this.properties.height || 1,
                    32
                );
                break;
            case 'truss':
                geometry = this.createTrussGeometry();
                break;
            default:
                console.warn(`Unknown part type: ${this.type}, defaulting to box`);
                geometry = new THREE.BoxGeometry(1, 1, 1);
        }

        const material = new THREE.MeshStandardMaterial({
            color: this.properties.color,
            metalness: 0.5,
            roughness: 0.5
        });

        return new THREE.Mesh(geometry, material);
    }

    createTrussGeometry() {
        // Create a simple truss structure using multiple cylinders
        const group = new THREE.Group();
        
        // Main vertical supports
        const supportGeometry = new THREE.CylinderGeometry(0.1, 0.1, 2, 8);
        const supportMaterial = new THREE.MeshStandardMaterial({ color: this.properties.color });
        
        const leftSupport = new THREE.Mesh(supportGeometry, supportMaterial);
        leftSupport.position.set(-0.5, 1, 0);
        
        const rightSupport = new THREE.Mesh(supportGeometry, supportMaterial);
        rightSupport.position.set(0.5, 1, 0);
        
        // Cross supports
        const crossGeometry = new THREE.CylinderGeometry(0.1, 0.1, 1, 8);
        crossGeometry.rotateZ(Math.PI / 2);
        const crossMaterial = new THREE.MeshStandardMaterial({ color: this.properties.color });
        
        const topCross = new THREE.Mesh(crossGeometry, crossMaterial);
        topCross.position.set(0, 2, 0);
        
        const bottomCross = new THREE.Mesh(crossGeometry, crossMaterial);
        bottomCross.position.set(0, 0, 0);
        
        group.add(leftSupport, rightSupport, topCross, bottomCross);
        return group;
    }

    applyProperties() {
        // Apply position
        this.mesh.position.set(
            this.properties.position.x,
            this.properties.position.y,
            this.properties.position.z
        );

        // Apply rotation
        this.mesh.rotation.set(
            this.properties.rotation.x,
            this.properties.rotation.y,
            this.properties.rotation.z
        );

        // Apply scale
        this.mesh.scale.set(
            this.properties.scale.x,
            this.properties.scale.y,
            this.properties.scale.z
        );

        // Update bounding box
        this.boundingBox.setFromObject(this.mesh);
    }

    // Property setters
    setPosition(x, y, z) {
        this.properties.position = { x, y, z };
        this.mesh.position.set(x, y, z);
        this.boundingBox.setFromObject(this.mesh);
    }

    setRotation(x, y, z) {
        this.properties.rotation = { x, y, z };
        this.mesh.rotation.set(x, y, z);
        this.boundingBox.setFromObject(this.mesh);
    }

    setScale(x, y, z) {
        this.properties.scale = { x, y, z };
        this.mesh.scale.set(x, y, z);
        this.boundingBox.setFromObject(this.mesh);
    }

    setColor(color) {
        this.properties.color = color;
        if (this.mesh.material) {
            this.mesh.material.color.setHex(color);
        }
    }

    // Collision methods
    setCanCollide(canCollide) {
        this.properties.canCollide = canCollide;
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

    // Clone the part
    clone() {
        return new Part(this.type, { ...this.properties });
    }
} 