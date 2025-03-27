export class Folder {
    constructor(name) {
        this.name = name;
        this.children = new Map();
    }

    add(child) {
        if (child.name) {
            this.children.set(child.name, child);
            return child;
        }
        console.error('Child must have a name property');
        return null;
    }

    remove(child) {
        if (typeof child === 'string') {
            return this.children.delete(child);
        } else if (child.name) {
            return this.children.delete(child.name);
        }
        return false;
    }

    get(name) {
        return this.children.get(name);
    }

    clear() {
        this.children.clear();
    }

    // Get all children as an array
    getChildren() {
        return Array.from(this.children.values());
    }

    // Find a child by name recursively
    find(name) {
        if (this.children.has(name)) {
            return this.children.get(name);
        }
        
        for (const child of this.children.values()) {
            if (child instanceof Folder) {
                const found = child.find(name);
                if (found) return found;
            }
        }
        
        return null;
    }
} 