import { Engine } from './Engine';
import { Part } from './Part';
import { Folder } from './Folder';
import { Group } from './Group';

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
    // Get the container
    const container = document.getElementById('engineish-container');
    if (!container) {
        console.error('Engineish container not found');
        return;
    }

    // Initialize the engine
    const engine = new Engine(container, {
        enableMultiplayer: false
    });

    // Example usage
    function createExampleScene() {
        // Create a folder for organization
        const myFolder = engine.createFolder('MyFolder');
        engine.spawnBaseplate();

        // Create a group for a house
        const house = engine.createGroup('House');

        // Create parts for the house
        const walls = new Part('box', {
            width: 4,
            height: 3,
            depth: 4,
            color: 0xcccccc,
            canCollide: true
        });
        walls.setupCollision(); // Ensure collision is set up
        walls.setPosition(0, 1.5, 0); // Half height = 1.5
        engine.addPart(walls);
        house.add(walls);

        const roof = new Part('cone', {
            radius: 2.5,
            height: 2,
            color: 0x8b4513,
            canCollide: true
        });
        roof.setupCollision(); // Ensure collision is set up
        roof.setPosition(0, 4, 0); // walls height (3) + half roof height (1)
        engine.addPart(roof);
        house.add(roof);

        // Add the house to the folder
        myFolder.add(house);

        // Position the house relative to ground level
        house.setPosition(-5, 0, -5);

        // Spawn the player
        const player = engine.spawn();
        player.setPosition(0, 2, 0); // Start slightly above ground
    }

    // Create the example scene
    createExampleScene();
});

// Example of how to use the engine in a script tag
/*
<script>
    // Create a new part
    const part = new Part('box', {
        width: 2,
        height: 1,
        depth: 2,
        color: 0xff0000
    });
    
    // Set its properties
    part.setPosition(0, 1, 0);
    part.setRotation(0, Math.PI / 4, 0);
    part.setScale(1, 1, 1);
    
    // Add it to the workspace
    engine.workspace.add(part);
</script>
*/ 