/**
 * Scripting system for tools in the engine
 */
export class Scripting {
    constructor(engine) {
        this.engine = engine;
        this.scripts = new Map();
        this.activeScripts = new Set();
    }

    /**
     * Register a new script for a tool
     * @param {string} toolName - Name of the tool
     * @param {Function} script - The script function to execute
     * @param {Object} options - Script options
     */
    registerScript(toolName, script, options = {}) {
        this.scripts.set(toolName, {
            execute: script,
            options: {
                requiresSelection: false,
                syncMultiplayer: true, // Default to syncing in multiplayer
                ...options
            }
        });
    }

    /**
     * Execute a tool script
     * @param {string} toolName - Name of the tool to execute
     * @param {Object} context - Context object containing relevant data
     */
    executeScript(toolName, context = {}) {
        const script = this.scripts.get(toolName);
        if (!script) {
            console.warn(`No script found for tool: ${toolName}`);
            return;
        }

        if (script.options.requiresSelection && !context.selectedPart) {
            console.warn(`Tool ${toolName} requires a selected part`);
            return;
        }

        try {
            // Execute the script locally
            script.execute(context);

            // If multiplayer is enabled and the script should be synced
            if (this.engine.options.enableMultiplayer && 
                script.options.syncMultiplayer && 
                this.engine.socket) {
                
                // Prepare the sync data
                const syncData = {
                    toolName,
                    context: {
                        ...context,
                        // Convert selectedPart to a serializable format
                        selectedPart: context.selectedPart ? {
                            id: context.selectedPart.id,
                            type: context.selectedPart.constructor.name
                        } : null
                    }
                };

                // Emit the tool action to other players
                this.engine.socket.emit('toolAction', syncData);
            }

            this.activeScripts.add(toolName);
        } catch (error) {
            console.error(`Error executing script for tool ${toolName}:`, error);
        }
    }

    /**
     * Handle incoming tool action from another player
     * @param {Object} data - The tool action data
     */
    handleRemoteToolAction(data) {
        const { toolName, context } = data;
        const script = this.scripts.get(toolName);
        
        if (!script) {
            console.warn(`Received unknown tool action: ${toolName}`);
            return;
        }

        try {
            // Resolve the selected part reference if it exists
            let resolvedContext = { ...context };
            if (context.selectedPart) {
                resolvedContext.selectedPart = this.resolvePartReference(context.selectedPart);
            }

            // Execute the script with the resolved context
            script.execute(resolvedContext);
        } catch (error) {
            console.error(`Error handling remote tool action ${toolName}:`, error);
        }
    }

    /**
     * Resolve a part reference from network data
     * @param {Object} partRef - The part reference data
     * @returns {Part|Character|null} The resolved part or character
     */
    resolvePartReference(partRef) {
        if (!partRef) return null;

        // Search in the scene for the part
        const searchInObject = (object) => {
            if (object.id === partRef.id) {
                return object;
            }
            for (const child of object.children) {
                const found = searchInObject(child);
                if (found) return found;
            }
            return null;
        };

        // Search in the main scene
        return searchInObject(this.engine.scene);
    }

    /**
     * Stop execution of a tool script
     * @param {string} toolName - Name of the tool to stop
     */
    stopScript(toolName) {
        this.activeScripts.delete(toolName);
    }

    /**
     * Check if a script is currently running
     * @param {string} toolName - Name of the tool to check
     * @returns {boolean} Whether the script is running
     */
    isScriptRunning(toolName) {
        return this.activeScripts.has(toolName);
    }

    /**
     * Get all registered tool scripts
     * @returns {Array} Array of tool names
     */
    getRegisteredTools() {
        return Array.from(this.scripts.keys());
    }
} 