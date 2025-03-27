import * as THREE from 'three';

export class Group {
    constructor(name) {
        this.name = name;
        this.group = new THREE.Group();
        this.children = new Map();
    }

    add(child) {
        if (child.mesh) {
            this.group.add(child.mesh);
            this.children.set(child.name || 'unnamed', child);
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
                return true;
            }
        } else if (child.mesh) {
            this.group.remove(child.mesh);
            this.children.delete(child.name || 'unnamed');
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
    }

    // Property setters
    setPosition(x, y, z) {
        this.group.position.set(x, y, z);
    }

    setRotation(x, y, z) {
        this.group.rotation.set(x, y, z);
    }

    setScale(x, y, z) {
        this.group.scale.set(x, y, z);
    }

    // Get all children as an array
    getChildren() {
        return Array.from(this.children.values());
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