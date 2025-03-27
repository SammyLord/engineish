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
        engine.setSkyColor(engine.rgb(0, 213, 255))
        // Create a folder for organization
        const myFolder = engine.createFolder('MyFolder');
        engine.spawnBaseplate();

        // Create a group for a house
        const house = engine.createGroup('House');

        // House dimensions
        const houseWidth = 8;
        const houseDepth = 8;
        const houseHeight = 4;
        const wallThickness = 0.5;
        const doorWidth = 1.5;  // 1.5x player size
        const doorHeight = 2.5; // Tall enough for player

        // Create walls
        // Front wall (with door)
        const frontWall = new Part('box', {
            width: houseWidth,
            height: houseHeight,
            depth: wallThickness,
            color: 0xcccccc,
            canCollide: true
        });
        frontWall.setupCollision();
        frontWall.setPosition(0, houseHeight/2, houseDepth/2);
        engine.addPart(frontWall);
        house.add(frontWall);

        // Back wall
        const backWall = new Part('box', {
            width: houseWidth,
            height: houseHeight,
            depth: wallThickness,
            color: 0xcccccc,
            canCollide: true
        });
        backWall.setupCollision();
        backWall.setPosition(0, houseHeight/2, -houseDepth/2);
        engine.addPart(backWall);
        house.add(backWall);

        // Left wall
        const leftWall = new Part('box', {
            width: wallThickness,
            height: houseHeight,
            depth: houseDepth,
            color: 0xcccccc,
            canCollide: true
        });
        leftWall.setupCollision();
        leftWall.setPosition(-houseWidth/2, houseHeight/2, 0);
        engine.addPart(leftWall);
        house.add(leftWall);

        // Right wall
        const rightWall = new Part('box', {
            width: wallThickness,
            height: houseHeight,
            depth: houseDepth,
            color: 0xcccccc,
            canCollide: true
        });
        rightWall.setupCollision();
        rightWall.setPosition(houseWidth/2, houseHeight/2, 0);
        engine.addPart(rightWall);
        house.add(rightWall);

        // Ceiling
        const ceiling = new Part('box', {
            width: houseWidth,
            height: wallThickness,
            depth: houseDepth,
            color: 0xcccccc,
            canCollide: true
        });
        ceiling.setupCollision();
        ceiling.setPosition(0, houseHeight, 0);
        engine.addPart(ceiling);
        house.add(ceiling);

        // Roof (cone)
        const roof = new Part('cone', {
            radius: Math.sqrt(houseWidth * houseWidth + houseDepth * houseDepth) / 2,
            height: 3,
            color: 0x8b4513,
            canCollide: true
        });
        roof.setupCollision();
        roof.setPosition(0, houseHeight + 1.5, 0); // Position at top of walls
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