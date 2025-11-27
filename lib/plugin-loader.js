const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

class PluginLoader {
    constructor(debug = false) {
        this.debug = debug;
        this.plugins = new Map();
        this.loadedAddons = [];
    }

    /**
     * Load all plugins from the ./addons directory
     * Plugins must be named *-elios-addon.js
     * @param {string} addonsDir - Path to addons directory
     * @returns {boolean} - True if all plugins loaded successfully
     */
    loadPlugins(addonsDir) {
        if (!fs.existsSync(addonsDir)) {
            if (this.debug) {
                console.log(chalk.yellow(`[PLUGIN] Addons directory not found: ${addonsDir}`));
            }
            return true; // Not an error if no addons directory
        }

        try {
            const files = fs.readdirSync(addonsDir);
            const addonFiles = files.filter(f => f.endsWith('-elios-addon.js'));

            if (addonFiles.length === 0) {
                if (this.debug) {
                    console.log(chalk.cyan(`[PLUGIN] No addons found in ${addonsDir}`));
                }
                return true;
            }

            if (this.debug) {
                console.log(chalk.cyan(`[PLUGIN] Found ${addonFiles.length} addon(s)`));
            }

            for (const addonFile of addonFiles) {
                this.loadAddon(path.join(addonsDir, addonFile));
            }

            return true;
        } catch (error) {
            console.error(chalk.red(`[PLUGIN ERROR] Failed to load plugins: ${error.message}`));
            return false;
        }
    }

    /**
     * Load a single addon file
     * @param {string} addonPath - Full path to addon file
     */
    loadAddon(addonPath) {
        try {
            // Clear the require cache to allow reloading
            delete require.cache[require.resolve(addonPath)];

            const addonModule = require(addonPath);
            const addonName = path.basename(addonPath);

            if (!addonModule.name) {
                console.warn(chalk.yellow(`[PLUGIN WARNING] ${addonName} missing 'name' property`));
                return;
            }

            if (!addonModule.version) {
                console.warn(chalk.yellow(`[PLUGIN WARNING] ${addonName} missing 'version' property`));
            }

            if (!addonModule.functions || typeof addonModule.functions !== 'object') {
                console.warn(chalk.yellow(`[PLUGIN WARNING] ${addonName} has no functions to register`));
                return;
            }

            this.plugins.set(addonModule.name, {
                name: addonModule.name,
                version: addonModule.version || '1.0.0',
                description: addonModule.description || '',
                author: addonModule.author || 'Unknown',
                functions: addonModule.functions,
                path: addonPath
            });

            this.loadedAddons.push(addonModule.name);

            if (this.debug) {
                console.log(chalk.green(`[PLUGIN] ✓ Loaded: ${addonModule.name} v${addonModule.version || '1.0.0'}`));
                console.log(chalk.cyan(`  Functions: ${Object.keys(addonModule.functions).join(', ')}`));
            }

        } catch (error) {
            console.error(chalk.red(`[PLUGIN ERROR] Failed to load ${addonPath}:`));
            console.error(chalk.red(`  ${error.message}`));
            if (this.debug) {
                console.error(error.stack);
            }
        }
    }

    /**
     * Register all plugin functions into the interpreter
     * @param {object} functionsMap - The interpreter's functions map
     * @param {object} interpreter - Reference to interpreter for binding context
     */
    registerPlugins(functionsMap, interpreter) {
        let registeredCount = 0;

        for (const [pluginName, plugin] of this.plugins) {
            for (const [funcName, funcHandler] of Object.entries(plugin.functions)) {
                if (typeof funcHandler === 'function') {
                    // Bind the function to interpreter context if it's a method
                    functionsMap[funcName] = funcHandler.bind(interpreter);
                    registeredCount++;

                    if (this.debug) {
                        console.log(chalk.blue(`[PLUGIN] Registered: §${funcName}[] from ${pluginName}`));
                    }
                } else {
                    console.warn(chalk.yellow(`[PLUGIN WARNING] ${pluginName}::${funcName} is not a function`));
                }
            }
        }

        if (this.debug && registeredCount > 0) {
            console.log(chalk.green(`[PLUGIN] ✓ Registered ${registeredCount} plugin function(s)`));
        }

        return registeredCount;
    }

    /**
     * Get information about all loaded plugins
     * @returns {array} - Array of plugin metadata
     */
    getPluginInfo() {
        const info = [];
        for (const [name, plugin] of this.plugins) {
            info.push({
                name: plugin.name,
                version: plugin.version,
                description: plugin.description,
                author: plugin.author,
                functions: Object.keys(plugin.functions),
                path: plugin.path
            });
        }
        return info;
    }

    /**
     * List all loaded addon names
     * @returns {array} - Array of loaded addon names
     */
    getLoadedAddons() {
        return [...this.loadedAddons];
    }
}

module.exports = PluginLoader;
