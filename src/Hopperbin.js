import * as THREE from 'three';

export class Hopperbin {
    // Static property to track currently equipped hopperbin
    static currentHopperbin = null;

    constructor(name, options = {}) {
        this.name = name;
        this.options = {
            icon: options.icon || '🔧', // Default icon
            description: options.description || 'A tool',
            requiresSelection: options.requiresSelection || false,
            syncMultiplayer: options.syncMultiplayer !== false,
            script: options.script || null,
            ...options
        };
        
        // Create visual representation
        this.mesh = this.createMesh();
        this.mesh.name = name;
        
        // Tool state
        this.isEquipped = false;
        this.isActive = false;
    }

    createMesh() {
        // Create a simple tool model (can be replaced with custom model)
        const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
        const material = new THREE.MeshStandardMaterial({
            color: 0x808080,
            metalness: 0.5,
            roughness: 0.5
        });
        return new THREE.Mesh(geometry, material);
    }

    setIcon(icon) {
        this.options.icon = icon;
    }

    setDescription(description) {
        this.options.description = description;
    }

    setScript(script) {
        this.options.script = script;
    }

    equip() {
        // Unequip current hopperbin if any
        if (Hopperbin.currentHopperbin) {
            Hopperbin.currentHopperbin.unequip();
        }
        this.isEquipped = true;
        this.isActive = false;
        Hopperbin.currentHopperbin = this;
    }

    unequip() {
        this.isEquipped = false;
        this.isActive = false;
        if (Hopperbin.currentHopperbin === this) {
            Hopperbin.currentHopperbin = null;
        }
    }

    activate() {
        if (this.isEquipped && !this.isActive) {
            this.isActive = true;
            return true;
        }
        return false;
    }

    deactivate() {
        if (this.isActive) {
            this.isActive = false;
            return true;
        }
        return false;
    }

    execute(context) {
        if (this.options.script && typeof this.options.script === 'function') {
            return this.options.script(context);
        }
        return false;
    }

    // Serialize the hopperbin for network transmission
    serialize() {
        return {
            name: this.name,
            options: {
                icon: this.options.icon,
                description: this.options.description,
                requiresSelection: this.options.requiresSelection,
                syncMultiplayer: this.options.syncMultiplayer
            }
        };
    }

    // Create a new hopperbin from serialized data
    static deserialize(data) {
        return new Hopperbin(data.name, data.options);
    }
} 