import { Part } from './Part';

export class SpawnPoint extends Part {
    constructor(options = {}) {
        super('cylinder', {
            radius: 0.5,
            height: 0.1,
            color: 0x00ff00,
            canCollide: false,
            ...options
        });
        
        // Add a pulsing effect
        this.pulseSpeed = 0.02;
        this.pulseScale = 0.1;
        this.originalScale = this.mesh.scale.clone();
    }

    update() {
        // Create a pulsing effect
        const time = Date.now() * this.pulseSpeed;
        const scale = 1 + Math.sin(time) * this.pulseScale;
        this.mesh.scale.set(
            this.originalScale.x * scale,
            this.originalScale.y,
            this.originalScale.z * scale
        );
    }

    getSpawnPosition() {
        return {
            x: this.mesh.position.x,
            y: this.mesh.position.y + 2, // 2 units above the spawn point
            z: this.mesh.position.z
        };
    }
} 