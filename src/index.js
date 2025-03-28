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
        enableMultiplayer: false, // Disable multiplayer for now, it's a work in progress.
        websocketUrl: "ws://localhost:3000"
    });

    engine.setPlaceTitle("Engineish Sample Scene");

    // Example usage
    function createExampleScene() {
        engine.setSkyColor(engine.rgb(0, 213, 255))
        // Create a folder for organization
        const myFolder = engine.createFolder('MyFolder');
        engine.spawnBaseplate();

        // Create a group for a house
        const house = engine.createGroup('House');

        // House dimensions
        const playerHeight = 4; // Player is about 4 units tall
        const houseWidth = 24; // 3x player width (8 units)
        const houseDepth = 24; // 3x player depth (8 units)
        const houseHeight = 14; // 3.5x player height
        const wallThickness = 0.5;
        const doorThickness = 3
        const doorWidth = 4;  // Door width (wider)
        const doorHeight = 5; // Door height (taller)

        // Create floor
        const floor = new Part('box', {
            width: houseWidth,
            height: wallThickness,
            depth: houseDepth,
            color: 0xffff00, // Yellow
            canCollide: true
        });
        floor.setupCollision();
        floor.setPosition(0, 0, 0);
        engine.addPart(floor);
        house.add(floor);

        // Create door frame (non-collidable)
        const doorFrame = new Part('box', {
            width: doorWidth,
            height: doorHeight,
            depth: doorThickness,
            color: 0x000000, // Black
            canCollide: false // Door frame doesn't collide
        });
        doorFrame.setupCollision();
        doorFrame.setPosition(0, doorHeight/2, houseDepth/2 + wallThickness/2);
        engine.addPart(doorFrame);
        house.add(doorFrame);

        // Create walls
        // Front wall sections (with door)
        const doorLeftWall = new Part('box', {
            width: (houseWidth - doorWidth) / 1.36,
            height: houseHeight,
            depth: wallThickness,
            color: 0xff0000, // Red
            canCollide: true
        });
        doorLeftWall.setupCollision();
        doorLeftWall.setPosition(-houseWidth/2.6, houseHeight/2, houseDepth/2);
        engine.addPart(doorLeftWall);
        house.add(doorLeftWall);

        const doorRightWall = new Part('box', {
            width: (houseWidth - doorWidth) / 1.36,
            height: houseHeight,
            depth: wallThickness,
            color: 0xff0000, // Red
            canCollide: true
        });
        doorRightWall.setupCollision();
        doorRightWall.setPosition(houseWidth/2.6, houseHeight/2, houseDepth/2);
        engine.addPart(doorRightWall);
        house.add(doorRightWall);

        const doorTopWall = new Part('box', {
            width: doorWidth * 1.25,
            height: houseHeight - doorHeight,
            depth: wallThickness,
            color: 0xff0000, // Red
            canCollide: true
        });
        doorTopWall.setupCollision();
        doorTopWall.setPosition(0, houseHeight - (houseHeight - doorHeight)/2, houseDepth/2);
        engine.addPart(doorTopWall);
        house.add(doorTopWall);

        // Back wall
        const backWall = new Part('box', {
            width: houseWidth,
            height: houseHeight,
            depth: wallThickness,
            color: 0xff0000, // Red
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
            color: 0xff0000, // Red
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
            color: 0xff0000, // Red
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
            color: 0xff0000, // Red
            canCollide: true
        });
        ceiling.setupCollision();
        ceiling.setPosition(0, houseHeight, 0);
        engine.addPart(ceiling);
        house.add(ceiling);

        // Roof (cone)
        const roof = new Part('cone', {
            radius: Math.sqrt(houseWidth * houseWidth + houseDepth * houseDepth) / 2,
            height: 4,
            color: 0x0000ff, // Blue
            canCollide: true
        });
        roof.setupCollision();
        roof.setPosition(0, houseHeight + 2, 0); // Position at top of walls
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