
// Example scripts for the engine's scripting system
// It is used to test the engine's scripting system.
// It is also licensed under the CC0 license.
// https://creativecommons.org/publicdomain/zero/1.0/

/**
 * Color change tool script
 */
export const colorChangeScript = (context) => {
    const { selectedPart, color } = context;
    if (selectedPart) {
        selectedPart.material.color.setHex(color);
    }
};

/**
 * Size modification tool script
 */
export const sizeModifyScript = (context) => {
    const { selectedPart, scale } = context;
    if (selectedPart) {
        selectedPart.scale.set(scale, scale, scale);
        // Update collision box if it exists
        if (selectedPart.updateBoundingBox) {
            selectedPart.updateBoundingBox();
        }
    }
};

/**
 * Rotation tool script
 */
export const rotationScript = (context) => {
    const { selectedPart, rotation } = context;
    if (selectedPart) {
        selectedPart.rotation.set(
            rotation.x || 0,
            rotation.y || 0,
            rotation.z || 0
        );
    }
};

/**
 * Duplicate tool script
 */
export const duplicateScript = (context) => {
    const { selectedPart, engine } = context;
    if (selectedPart) {
        const newPart = selectedPart.clone();
        newPart.position.x += 1; // Offset the duplicate
        engine.addPart(newPart);
    }
};

/**
 * Delete tool script
 */
export const deleteScript = (context) => {
    const { selectedPart, engine } = context;
    if (selectedPart) {
        engine.removeFromCollisionSystem(selectedPart);
        selectedPart.parent.remove(selectedPart);
    }
};

/**
 * Health modification tool script
 */
export const healthScript = (context) => {
    const { selectedPart, health, engine } = context;
    if (selectedPart) {
        // Check if the selected part is a character
        if (selectedPart instanceof Character) {
            selectedPart.setHealth(health);
        } else {
            // If it's a regular part, we'll add health properties if they don't exist
            if (!selectedPart.properties.health) {
                selectedPart.properties.health = 100;
                selectedPart.properties.maxHealth = 100;
            }
            selectedPart.properties.health = Math.max(0, Math.min(health, selectedPart.properties.maxHealth));
        }
    }
}; 