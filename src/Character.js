import * as THREE from 'three';
import { Part } from './Part';
import { Hopperbin } from './Hopperbin';

export class Character {
    constructor() {
        this.group = new THREE.Group();
        this.parts = {};
        this.engine = null; // Will be set when spawned
        this.colorMenuOpen = false; // Track if color menu is open
        this.nametagMenuOpen = false; // Track if nametag menu is open
        this.nametag = null; // Store the nametag sprite
        this.hopperbins = new Map(); // Store available hopperbins
        this.activeHopperbin = null; // Currently equipped hopperbin
        this.properties = {
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
            canCollide: true,
            moveSpeed: 0.1,
            jumpForce: 0.3,
            gravity: 0.01,
            isJumping: false,
            isGrounded: false,
            velocity: new THREE.Vector3(),
            maxFallSpeed: 0.5,
            groundCheckDistance: 0.1,
            collisionBuffer: 0.001,
            bounceFactor: 0.5,
            airResistance: 0.95,
            groundFriction: 0.85,
            maxVelocity: 0.5,
            health: 100,
            maxHealth: 100,
            isInvulnerable: false,
            invulnerabilityDuration: 1000, // milliseconds
            lastDamageTime: 0
        };
        // Add position history array to store last 3 positions
        this.positionHistory = [];
        this.maxHistoryLength = 3;
        this.setupCollision();
        this.createDefaultCharacter();
        this.setupControls();
    }

    setupCollision() {
        // Create a bounding box for collision detection
        this.boundingBox = new THREE.Box3();
    }

    createDefaultCharacter() {
        // Create head (sphere)
        this.parts.head = new Part('sphere', {
            radius: 0.5,
            color: 0xff9999
        });
        this.parts.head.mesh.position.y = 2;

        // Create body (box)
        this.parts.body = new Part('box', {
            width: 1,
            height: 1.5,
            depth: 0.5,
            color: 0x4444ff
        });
        this.parts.body.mesh.position.y = 0.75;

        // Create arms
        this.parts.leftArm = new Part('box', {
            width: 0.3,
            height: 1,
            depth: 0.3,
            color: 0xff9999
        });
        this.parts.leftArm.mesh.position.set(-0.65, 1.5, 0);
        this.parts.leftArm.mesh.rotation.z = Math.PI / 6;

        this.parts.rightArm = new Part('box', {
            width: 0.3,
            height: 1,
            depth: 0.3,
            color: 0xff9999
        });
        this.parts.rightArm.mesh.position.set(0.65, 1.5, 0);
        this.parts.rightArm.mesh.rotation.z = -Math.PI / 6;

        // Create legs
        this.parts.leftLeg = new Part('box', {
            width: 0.3,
            height: 1.5,
            depth: 0.3,
            color: 0x4444ff
        });
        this.parts.leftLeg.mesh.position.set(-0.2, -1.25, 0);

        this.parts.rightLeg = new Part('box', {
            width: 0.3,
            height: 1.5,
            depth: 0.3,
            color: 0x4444ff
        });
        this.parts.rightLeg.mesh.position.set(0.2, -1.25, 0);

        // Add all parts to the group
        Object.values(this.parts).forEach(part => {
            this.group.add(part.mesh);
        });

        // Update the bounding box after all parts are added
        this.boundingBox.setFromObject(this.group);
    }

    setupControls() {
        this.keys = {
            w: false,
            a: false,
            s: false,
            d: false,
            control: false
        };

        // Bind the event handlers to this instance
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);

        // Add key listeners
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);
    }

    handleKeyDown(e) {
        switch(e.key.toLowerCase()) {
            case 'w': this.keys.w = true; break;
            case 'a': this.keys.a = true; break;
            case 's': this.keys.s = true; break;
            case 'd': this.keys.d = true; break;
            case 'control': this.keys.control = true; break;
            case 'c': // Add color menu shortcut
                // Only open menu if we're not in a text input field and menu isn't already open
                if (!e.target.matches('input[type="text"], textarea') && !e.repeat && !this.colorMenuOpen) {
                    console.log('Opening color menu...'); // Debug log
                    e.preventDefault();
                    e.stopPropagation(); // Stop event from bubbling up
                    try {
                        this.createColorMenu();
                    } catch (error) {
                        console.error('Error creating color menu:', error);
                    }
                }
                break;
            case 'n': // Add nametag menu shortcut
                // Only open menu if we're not in a text input field and menu isn't already open
                if (!e.target.matches('input[type="text"], textarea') && !e.repeat && !this.nametagMenuOpen && this.engine && this.engine.options.enableMultiplayer) {
                    console.log('Opening nametag menu...'); // Debug log
                    e.preventDefault();
                    e.stopPropagation(); // Stop event from bubbling up
                    try {
                        this.createNametagMenu();
                    } catch (error) {
                        console.error('Error creating nametag menu:', error);
                    }
                }
                break;
            case ' ': // Space bar for hopperbin activation
                if (this.activeHopperbin) {
                    e.preventDefault();
                    this.activateHopperbin();
                }
                break;
            case '-': // Minus key for hopperbin deactivation
                if (this.activeHopperbin) {
                    e.preventDefault();
                    this.deactivateHopperbin();
                }
                break;
            case 'escape': // Escape key to unequip hopperbin
                if (this.activeHopperbin) {
                    e.preventDefault();
                    this.unequipHopperbin();
                }
                break;
            case '1': case '2': case '3': case '4': case '5': case '6': case '7': case '8': case '9': case '0':
                // Number keys for quick hopperbin selection
                const index = e.key === '0' ? 9 : parseInt(e.key) - 1;
                const hopperbins = Array.from(this.hopperbins.values());
                if (hopperbins[index]) {
                    this.equipHopperbin(hopperbins[index].name);
                }
                break;
            // Add test key for damage only if debug is enabled
            case 'x':
                if (this.engine && this.engine.options.engineDebug) {
                    console.log('Taking test damage');
                    this.takeDamage(50);
                }
                break;
        }
    }

    handleKeyUp(e) {
        switch(e.key.toLowerCase()) {
            case 'w': this.keys.w = false; break;
            case 'a': this.keys.a = false; break;
            case 's': this.keys.s = false; break;
            case 'd': this.keys.d = false; break;
            case 'control': this.keys.control = false; break;
            case ' ': // Space bar for hopperbin deactivation
                if (this.activeHopperbin) {
                    e.preventDefault();
                    this.deactivateHopperbin();
                }
                break;
        }
    }

    update() {
        // Store current position in history before any movement
        this.positionHistory.push(this.group.position.clone());
        if (this.positionHistory.length > this.maxHistoryLength) {
            this.positionHistory.shift(); // Remove oldest position
        }

        const moveSpeed = this.properties.moveSpeed;
        const moveVector = new THREE.Vector3();

        // Get camera's forward and right vectors (ignoring vertical rotation)
        const cameraDirection = new THREE.Vector3();
        this.engine.camera.getWorldDirection(cameraDirection);
        cameraDirection.y = 0; // Ignore vertical rotation
        cameraDirection.normalize();

        // Calculate right vector using cross product of up vector and forward vector
        const cameraRight = new THREE.Vector3();
        cameraRight.crossVectors(new THREE.Vector3(0, 1, 0), cameraDirection).normalize();

        // Apply movement based on input, relative to camera direction
        if (this.keys.w) moveVector.add(cameraDirection.multiplyScalar(moveSpeed));
        if (this.keys.s) moveVector.add(cameraDirection.multiplyScalar(-moveSpeed));
        if (this.keys.a) moveVector.add(cameraRight.multiplyScalar(moveSpeed));
        if (this.keys.d) moveVector.add(cameraRight.multiplyScalar(-moveSpeed));

        // Handle jumping - only allow jumping when grounded
        if (this.keys.control && this.properties.isGrounded) {
            this.properties.velocity.y = this.properties.jumpForce;
            this.properties.isJumping = true;
            this.properties.isGrounded = false;
        }

        // Apply gravity when in the air
        if (!this.properties.isGrounded) {
            this.properties.velocity.y -= this.properties.gravity;
            // Cap falling speed to prevent tunneling through objects
            this.properties.velocity.y = Math.max(this.properties.velocity.y, -this.properties.maxFallSpeed);
        }

        // Apply air resistance and ground friction
        if (!this.properties.isGrounded) {
            // Air resistance (stronger horizontal damping in air)
            this.properties.velocity.x *= this.properties.airResistance;
            this.properties.velocity.z *= this.properties.airResistance;
        } else {
            // Ground friction (smoother horizontal damping on ground)
            this.properties.velocity.x *= this.properties.groundFriction;
            this.properties.velocity.z *= this.properties.groundFriction;
        }

        // Cap maximum velocity
        const horizontalVelocity = Math.sqrt(
            this.properties.velocity.x * this.properties.velocity.x + 
            this.properties.velocity.z * this.properties.velocity.z
        );
        if (horizontalVelocity > this.properties.maxVelocity) {
            const scale = this.properties.maxVelocity / horizontalVelocity;
            this.properties.velocity.x *= scale;
            this.properties.velocity.z *= scale;
        }

        // Add velocity to movement vector
        moveVector.add(this.properties.velocity);

        // Apply movement
        this.group.position.x += moveVector.x;
        this.group.position.y += moveVector.y;
        this.group.position.z += moveVector.z;
        this.boundingBox.setFromObject(this.group);
    }

    spawn(scene, engine) {
        this.engine = engine; // Store engine reference
        scene.add(this.group);
        
        // Initialize health if enabled
        if (engine.options.enableHealth) {
            this.properties.health = engine.options.maxHealth;
            this.properties.maxHealth = engine.options.maxHealth;
            engine.createHealthUI();
        }
        
        return this;
    }

    setCharacterModel(model) {
        // Remove existing model
        this.group.clear();
        
        // Add new model
        if (model instanceof THREE.Group) {
            this.group = model;
            this.boundingBox.setFromObject(this.group);
        } else {
            console.error('Invalid model format. Must be a THREE.Group');
        }
    }

    setPosition(x, y, z) {
        this.group.position.set(x, y, z);
        this.boundingBox.setFromObject(this.group);
    }

    setRotation(x, y, z) {
        this.group.rotation.set(x, y, z);
        this.boundingBox.setFromObject(this.group);
    }

    setScale(x, y, z) {
        this.group.scale.set(x, y, z);
        this.boundingBox.setFromObject(this.group);
    }

    setColor(color) {
        Object.values(this.parts).forEach(part => {
            part.setColor(color);
        });
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

    // Add method to restore previous position
    restorePreviousPosition(previousPos) {
        this.group.position.copy(previousPos);
        this.boundingBox.setFromObject(this.group);
    }

    // Health-related methods
    getHealth() {
        return this.properties.health;
    }

    getMaxHealth() {
        return this.properties.maxHealth;
    }

    setHealth(health) {
        this.properties.health = Math.max(0, Math.min(health, this.properties.maxHealth));
    }

    takeDamage(amount) {
        if (this.properties.isInvulnerable) return false;

        const currentTime = Date.now();
        if (currentTime - this.properties.lastDamageTime < this.properties.invulnerabilityDuration) {
            return false;
        }

        this.properties.health = Math.max(0, this.properties.health - amount);
        this.properties.lastDamageTime = currentTime;

        if (this.engine && this.engine.options.engineDebug) {
            console.log(`Player took ${amount} damage. Health now: ${this.properties.health}`);
        }

        // Flash red when taking damage
        this.flashRed();

        if (this.isDead() && this.engine && this.engine.options.engineDebug) {
            console.log('Player has died!');
        }

        return true;
    }

    heal(amount) {
        this.properties.health = Math.min(this.properties.maxHealth, this.properties.health + amount);
    }

    setInvulnerable(duration = 1000) {
        this.properties.isInvulnerable = true;
        this.properties.invulnerabilityDuration = duration;
        setTimeout(() => {
            this.properties.isInvulnerable = false;
        }, duration);
    }

    flashRed() {
        const originalColors = new Map();
        Object.entries(this.parts).forEach(([partName, part]) => {
            originalColors.set(partName, part.mesh.material.color.getHex());
            part.mesh.material.color.setHex(0xff0000);
        });

        setTimeout(() => {
            Object.entries(this.parts).forEach(([partName, part]) => {
                part.mesh.material.color.setHex(originalColors.get(partName));
            });
        }, 100);
    }

    isDead() {
        const dead = this.properties.health <= 0;
        if (dead && this.engine && this.engine.options.engineDebug) {
            console.log('isDead check: Player is dead, health is', this.properties.health);
        }
        return dead;
    }

    setPartColor(partName, color) {
        if (this.parts[partName]) {
            this.parts[partName].setColor(color);
        } else if (this.group && this.group.children) {
            // For custom models, try to find the mesh by name
            const mesh = this.group.children.find(child => 
                child.name.toLowerCase().includes(partName.toLowerCase())
            );
            if (mesh && mesh.material) {
                mesh.material.color.setHex(color);
            }
        }

        // Emit color change event if multiplayer is enabled
        if (this.engine && this.engine.options.enableMultiplayer && this.engine.socket) {
            this.engine.socket.emit('characterColorChange', {
                partName: partName,
                color: color
            });
        }
    }

    createColorMenu() {
        if (this.colorMenuOpen) return; // Don't create menu if it's already open
        this.colorMenuOpen = true; // Mark menu as open

        console.log('Starting createColorMenu...'); // Debug log
        // Create menu container
        const menu = document.createElement('div');
        console.log('Created menu container'); // Debug log
        menu.style.position = 'fixed';
        menu.style.top = '20px';
        menu.style.right = '20px';
        menu.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        menu.style.padding = '15px';
        menu.style.borderRadius = '5px';
        menu.style.color = 'white';
        menu.style.fontFamily = 'Arial, sans-serif';
        menu.style.zIndex = '1000'; // Ensure menu appears above other elements

        // Add title
        const title = document.createElement('h3');
        title.textContent = 'Character Colors';
        title.style.margin = '0 0 10px 0';
        menu.appendChild(title);
        console.log('Added title'); // Debug log

        // Determine if we're using a custom model
        const isCustomModel = !this.parts || Object.keys(this.parts).length === 0;
        console.log('Model type:', isCustomModel ? 'custom' : 'default'); // Debug log
        
        if (isCustomModel && this.group && this.group.children) {
            console.log('Processing custom model...'); // Debug log
            // For custom models, create color pickers for each mesh
            this.group.children.forEach((mesh, index) => {
                if (mesh.material) {
                    const partContainer = document.createElement('div');
                    partContainer.style.marginBottom = '10px';

                    const label = document.createElement('label');
                    label.textContent = (mesh.name || `Part ${index + 1}`) + ': ';
                    label.style.display = 'inline-block';
                    label.style.width = '120px';

                    const colorPicker = document.createElement('input');
                    colorPicker.type = 'color';
                    colorPicker.value = '#' + mesh.material.color.getHexString();
                    colorPicker.style.verticalAlign = 'middle';

                    colorPicker.addEventListener('input', (e) => {
                        const color = parseInt(e.target.value.replace('#', ''), 16);
                        const partName = mesh.name || `Part${index + 1}`;
                        this.setPartColor(partName, color);
                    });

                    partContainer.appendChild(label);
                    partContainer.appendChild(colorPicker);
                    menu.appendChild(partContainer);
                }
            });
        } else {
            console.log('Processing default model...'); // Debug log
            // For default character model
            const parts = {
                head: 'Head',
                body: 'Body',
                leftArm: 'Left Arm',
                rightArm: 'Right Arm',
                leftLeg: 'Left Leg',
                rightLeg: 'Right Leg'
            };

            Object.entries(parts).forEach(([partName, displayName]) => {
                const partContainer = document.createElement('div');
                partContainer.style.marginBottom = '10px';

                const label = document.createElement('label');
                label.textContent = displayName + ': ';
                label.style.display = 'inline-block';
                label.style.width = '80px';

                const colorPicker = document.createElement('input');
                colorPicker.type = 'color';
                colorPicker.value = '#' + this.parts[partName].mesh.material.color.getHexString();
                colorPicker.style.verticalAlign = 'middle';

                colorPicker.addEventListener('input', (e) => {
                    const color = parseInt(e.target.value.replace('#', ''), 16);
                    this.setPartColor(partName, color);
                });

                partContainer.appendChild(label);
                partContainer.appendChild(colorPicker);
                menu.appendChild(partContainer);
            });
        }

        // Add close button
        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.style.marginTop = '10px';
        closeButton.style.padding = '5px 10px';
        closeButton.style.backgroundColor = '#444';
        closeButton.style.border = 'none';
        closeButton.style.color = 'white';
        closeButton.style.cursor = 'pointer';
        closeButton.style.borderRadius = '3px';

        closeButton.addEventListener('click', () => {
            menu.remove();
            this.colorMenuOpen = false;
        });

        menu.appendChild(closeButton);
        console.log('Appending menu to document...'); // Debug log
        document.body.appendChild(menu);
        console.log('Menu creation complete'); // Debug log
    }

    // Add method to handle incoming color changes from other players
    handleRemoteColorChange(partName, color) {
        if (this.parts[partName]) {
            this.parts[partName].setColor(color);
        } else if (this.group && this.group.children) {
            const mesh = this.group.children.find(child => 
                child.name.toLowerCase().includes(partName.toLowerCase())
            );
            if (mesh && mesh.material) {
                mesh.material.color.setHex(color);
            }
        }
    }

    createNametagMenu() {
        if (this.nametagMenuOpen) return; // Don't create menu if it's already open
        this.nametagMenuOpen = true; // Mark menu as open

        console.log('Starting createNametagMenu...'); // Debug log
        // Create menu container
        const menu = document.createElement('div');
        console.log('Created menu container'); // Debug log
        menu.style.position = 'fixed';
        menu.style.top = '20px';
        menu.style.right = '20px';
        menu.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        menu.style.padding = '15px';
        menu.style.borderRadius = '5px';
        menu.style.color = 'white';
        menu.style.fontFamily = 'Arial, sans-serif';
        menu.style.zIndex = '1000'; // Ensure menu appears above other elements

        // Add title
        const title = document.createElement('h3');
        title.textContent = 'Change Nickname';
        title.style.margin = '0 0 10px 0';
        menu.appendChild(title);

        // Create input field
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Enter new nickname';
        input.style.width = '200px';
        input.style.padding = '5px';
        input.style.marginBottom = '10px';
        input.style.borderRadius = '3px';
        input.style.border = 'none';
        input.value = this.engine.playerNickname || '';
        menu.appendChild(input);

        // Create submit button
        const submitButton = document.createElement('button');
        submitButton.textContent = 'Update';
        submitButton.style.padding = '5px 10px';
        submitButton.style.marginRight = '5px';
        submitButton.style.backgroundColor = '#4CAF50';
        submitButton.style.border = 'none';
        submitButton.style.color = 'white';
        submitButton.style.cursor = 'pointer';
        submitButton.style.borderRadius = '3px';

        // Create close button
        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.style.padding = '5px 10px';
        closeButton.style.backgroundColor = '#444';
        closeButton.style.border = 'none';
        closeButton.style.color = 'white';
        closeButton.style.cursor = 'pointer';
        closeButton.style.borderRadius = '3px';

        // Add buttons container
        const buttonContainer = document.createElement('div');
        buttonContainer.style.marginTop = '10px';
        buttonContainer.appendChild(submitButton);
        buttonContainer.appendChild(closeButton);
        menu.appendChild(buttonContainer);

        // Handle nickname update
        const updateNickname = () => {
            const newNickname = input.value.trim();
            if (newNickname) {
                this.engine.playerNickname = newNickname;
                this.updateNametag(newNickname);
                
                // Emit nickname change event if multiplayer is enabled
                if (this.engine.options.enableMultiplayer && this.engine.socket) {
                    this.engine.socket.emit('nicknameChange', {
                        nickname: newNickname
                    });
                }
            }
        };

        // Add event listeners
        submitButton.addEventListener('click', updateNickname);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                updateNickname();
            }
        });

        closeButton.addEventListener('click', () => {
            menu.remove();
            this.nametagMenuOpen = false;
        });

        console.log('Appending menu to document...'); // Debug log
        document.body.appendChild(menu);
        console.log('Menu creation complete'); // Debug log
    }

    updateNametag(nickname) {
        // Remove existing nametag if it exists
        if (this.nametag) {
            this.group.remove(this.nametag);
        }

        // Create new nametag
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 64;

        // Draw background
        context.fillStyle = 'rgba(0, 0, 0, 0.5)';
        context.fillRect(0, 0, canvas.width, canvas.height);

        // Draw text
        context.font = 'bold 32px Arial';
        context.fillStyle = 'white';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(nickname, canvas.width / 2, canvas.height / 2);

        // Create texture
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture });
        this.nametag = new THREE.Sprite(material);
        
        // Position the nametag above the character
        this.nametag.position.set(0, 3, 0);
        this.nametag.scale.set(2, 0.5, 1);

        // Add nametag to character group
        this.group.add(this.nametag);
    }

    // Add Hopperbin methods
    addHopperbin(hopperbin) {
        if (hopperbin instanceof Hopperbin) {
            this.hopperbins.set(hopperbin.name, hopperbin);
            return true;
        }
        return false;
    }

    removeHopperbin(name) {
        return this.hopperbins.delete(name);
    }

    getHopperbin(name) {
        return this.hopperbins.get(name);
    }

    equipHopperbin(name) {
        const hopperbin = this.hopperbins.get(name);
        if (hopperbin) {
            // Unequip current hopperbin if any
            if (this.activeHopperbin) {
                this.activeHopperbin.unequip();
            }
            this.activeHopperbin = hopperbin;
            hopperbin.equip();
            return true;
        }
        return false;
    }

    unequipHopperbin() {
        if (this.activeHopperbin) {
            this.activeHopperbin.unequip();
            this.activeHopperbin = null;
            return true;
        }
        return false;
    }

    activateHopperbin() {
        if (this.activeHopperbin) {
            // If the tool is already active, deactivate it
            if (this.activeHopperbin.isActive) {
                this.deactivateHopperbin();
                return;
            }

            // Otherwise, activate it
            if (this.activeHopperbin.activate()) {
                // Execute the hopperbin's script with proper context
                this.activeHopperbin.execute({
                    selectedPart: this.engine.selectedPart,
                    engine: this.engine,
                    character: this
                });
            }
        }
    }

    deactivateHopperbin() {
        if (this.activeHopperbin) {
            this.activeHopperbin.deactivate();
            // Only clear selection if the tool requires it
            if (this.engine && this.activeHopperbin.options.requiresSelection) {
                this.engine.selectPart(null);
            }
        }
    }
} 