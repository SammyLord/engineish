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

        // Update the bounding box based on the mesh's geometry
        this.updateBoundingBox();
    }

    updateBoundingBox() {
        if (this.mesh && this.mesh.geometry) {
            // Update the mesh's world matrix to ensure transformations are applied
            this.mesh.updateMatrixWorld(true);
            
            // Set the bounding box from the mesh's geometry
            this.boundingBox.setFromObject(this.mesh);
            
            // Adjust the bounding box based on the part type and dimensions
            const halfWidth = this.properties.width ? this.properties.width / 2 : 0.5;
            const halfHeight = this.properties.height ? this.properties.height / 2 : 0.5;
            const halfDepth = this.properties.depth ? this.properties.depth / 2 : 0.5;
            const radius = this.properties.radius || 0.5;

            switch (this.type.toLowerCase()) {
                case 'box':
                    // Box bounding box is already correct from setFromObject
                    break;
                case 'sphere':
                    // For spheres, we need to ensure the bounding box is cubic
                    const center = new THREE.Vector3();
                    this.boundingBox.getCenter(center);
                    this.boundingBox.min.set(
                        center.x - radius,
                        center.y - radius,
                        center.z - radius
                    );
                    this.boundingBox.max.set(
                        center.x + radius,
                        center.y + radius,
                        center.z + radius
                    );
                    break;
                case 'cylinder':
                    // For cylinders, we need to ensure the bounding box matches the radius and height
                    const cylCenter = new THREE.Vector3();
                    this.boundingBox.getCenter(cylCenter);
                    const cylHeight = this.properties.height || 1;
                    this.boundingBox.min.set(
                        cylCenter.x - radius,
                        cylCenter.y - cylHeight / 2,
                        cylCenter.z - radius
                    );
                    this.boundingBox.max.set(
                        cylCenter.x + radius,
                        cylCenter.y + cylHeight / 2,
                        cylCenter.z + radius
                    );
                    break;
            }
        }
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
        this.mesh.position.set(x, y, z);
        this.updateBoundingBox();
    }

    setRotation(x, y, z) {
        this.mesh.rotation.set(x, y, z);
        this.updateBoundingBox();
    }

    setScale(x, y, z) {
        this.mesh.scale.set(x, y, z);
        this.updateBoundingBox();
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