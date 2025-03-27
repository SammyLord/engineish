import * as THREE from 'three';

export class Group {
    constructor(name) {
        this.name = name;
        this.group = new THREE.Group();
        this.children = new Map();
        this.collidableParts = new Set();
    }

    add(child) {
        if (child.mesh) {
            this.group.add(child.mesh);
            this.children.set(child.name || 'unnamed', child);
            
            // Add to collidable parts if it can collide
            if (child.getCanCollide && child.getCanCollide()) {
                this.collidableParts.add(child);
                // Update the child's world matrix
                child.mesh.updateMatrixWorld(true);
                // Update the bounding box to world coordinates
                child.boundingBox.setFromObject(child.mesh);
            }
            
            return child;
        }
        console.error('Child must have a mesh property');
        return null;
    }

    remove(child) {
        if (typeof child === 'string') {
            const childObj = this.children.get(child);
            if (childObj && childObj.mesh) {
                this.group.remove(childObj.mesh);
                this.children.delete(child);
                this.collidableParts.delete(childObj);
                return true;
            }
        } else if (child.mesh) {
            this.group.remove(child.mesh);
            this.children.delete(child.name || 'unnamed');
            this.collidableParts.delete(child);
            return true;
        }
        return false;
    }

    get(name) {
        return this.children.get(name);
    }

    clear() {
        this.group.clear();
        this.children.clear();
        this.collidableParts.clear();
    }

    // Property setters
    setPosition(x, y, z) {
        this.group.position.set(x, y, z);
        this.group.updateMatrixWorld(true);
        this.updateCollisionBoxes();
    }

    setRotation(x, y, z) {
        this.group.rotation.set(x, y, z);
        this.group.updateMatrixWorld(true);
        this.updateCollisionBoxes();
    }

    setScale(x, y, z) {
        this.group.scale.set(x, y, z);
        this.group.updateMatrixWorld(true);
        this.updateCollisionBoxes();
    }

    // Update collision boxes for all parts in world space
    updateCollisionBoxes() {
        // Update the group's world matrix
        this.group.updateMatrixWorld(true);
        
        for (const part of this.collidableParts) {
            if (part.boundingBox) {
                // Update the part's world matrix
                part.mesh.updateMatrixWorld(true);
                // Update bounding box to include the group's transformation
                part.boundingBox.setFromObject(part.mesh);
            }
        }
    }

    // Get all children as an array
    getChildren() {
        return Array.from(this.children.values());
    }

    // Get all collidable parts
    getCollidableParts() {
        return Array.from(this.collidableParts);
    }

    // Clone the group
    clone() {
        const newGroup = new Group(this.name);
        this.children.forEach(child => {
            if (child.clone) {
                newGroup.add(child.clone());
            }
        });
        return newGroup;
    }
} 