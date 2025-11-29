const fs = require('fs');
const path = require('path');
const axios = require('axios');
const chalk = require('chalk');

class PluginInstaller {
    constructor(serverUrl = 'http://51.75.25.2:2010') {
        this.serverUrl = serverUrl;
        this.addonsPath = path.join(__dirname, '..', 'addons');
        this.client = axios.create({
            baseURL: this.serverUrl + '/api',
            timeout: 10000,
            responseType: 'json'
        });
    }

    /**
     * Install a plugin from the server
     * @param {string} pluginName - Plugin name
     * @param {object} options - Options { force: boolean, debug: boolean, version: string }
     * @returns {Promise<boolean>}
     */
    async installPlugin(pluginName, options = {}) {
        let { force = false, debug = false, version = null, progressCallback = null } = options;

        try {
            if (debug) {
                console.log(chalk.cyan(`[INSTALLER] Connecting to ${this.serverUrl}...`));
            }

            // Fetch plugin info
            const pluginData = await this.fetchPluginInfo(pluginName, debug);

            if (!pluginData) {
                console.error(chalk.red(`❌ Plugin "${pluginName}" not found on server`));
                return false;
            }

            if (debug) {
                console.log(chalk.blue(`[INSTALLER] Plugin found: ${pluginData.name}`));
            }

            // Normalize "latest" alias: treat 'latest' as no-version (use plugin.latest)
            if (version === 'latest') {
                if (debug) console.log(chalk.cyan('[INSTALLER] Normalizing version "latest" => using latest available'));
                version = null;
            }

            // Get specific version if requested
            let targetVersion = pluginData.version;
            if (version && pluginData.versions && Array.isArray(pluginData.versions)) {
                const foundVersion = pluginData.versions.find(v => v.version === version);
                if (foundVersion) {
                    targetVersion = version;
                    if (debug) {
                        console.log(chalk.blue(`[INSTALLER] Using specific version: ${targetVersion}`));
                    }
                } else {
                    console.error(chalk.red(`❌ Version "${version}" not found for plugin "${pluginName}"`));
                    if (debug && pluginData.versions) {
                        console.log(chalk.yellow(`Available versions: ${pluginData.versions.map(v => v.version).join(', ')}`));
                    }
                    return false;
                }
            } else if (version) {
                console.warn(chalk.yellow(`⚠️  Version information not available, using latest version`));
            }

            // Check if already installed
            const pluginFile = `${pluginName}-elios-addon.js`;
            const pluginPath = path.join(this.addonsPath, pluginFile);

            if (fs.existsSync(pluginPath) && !force) {
                console.warn(chalk.yellow(`⚠️  Plugin "${pluginName}" already installed`));
                console.log(chalk.gray(`   Use --force to overwrite`));
                return false;
            }

            // Download plugin (support progress callback)
            const success = await this.downloadPlugin(pluginName, pluginPath, debug, targetVersion, progressCallback);

            if (success) {
                // installation finished; CLI will handle user-facing output
                return true;
            }

            return false;
        } catch (error) {
            console.error(chalk.red(`❌ Installation failed: ${error.message}`));
            return false;
        }
    }

    /**
     * Fetch plugin info from server
     * @param {string} pluginName
     * @param {boolean} debug
     * @returns {Promise<object|null>}
     */
    async fetchPluginInfo(pluginName, debug = false) {
        try {
            if (debug) {
                console.log(chalk.cyan(`[INSTALLER] Fetching plugin info...`));
            }

            const response = await this.client.get(`/plugins/info/${pluginName}`);
            
            if (response.data && response.data.success && response.data.plugin) {
                return response.data.plugin;
            }

            return null;
        } catch (error) {
            if (error.response && error.response.status === 404) {
                return null;
            }
            throw error;
        }
    }

    /**
     * Download plugin from server
     * @param {string} pluginName
     * @param {string} outputPath
     * @param {boolean} debug
     * @param {string} version - Specific version to download (optional)
     * @returns {Promise<boolean>}
     */
    async downloadPlugin(pluginName, outputPath, debug = false, version = null, progressCallback = null) {
        try {
            // Ensure addons directory exists
            if (!fs.existsSync(this.addonsPath)) {
                fs.mkdirSync(this.addonsPath, { recursive: true });
            }

            if (debug) {
                console.log(chalk.cyan(`[INSTALLER] Downloading plugin${version ? ` v${version}` : ''}...`));
            }

            // Normalize 'latest' alias for download as well
            if (version === 'latest') version = null;

            // Use version-specific endpoint if version is provided
            let endpoint = `/plugins/download/${pluginName}`;
            if (version) {
                endpoint = `/plugins/download/${pluginName}?version=${encodeURIComponent(version)}`;
            }

            // Request as stream so we can track progress
            const response = await this.client.get(endpoint, {
                responseType: 'stream'
            });

            const totalBytes = response.headers && response.headers['content-length'] ? Number(response.headers['content-length']) : null;
            const writer = fs.createWriteStream(outputPath);

            let receivedBytes = 0;

            response.data.on('data', (chunk) => {
                receivedBytes += chunk.length;
                if (progressCallback && typeof progressCallback === 'function') {
                    try {
                        const percent = totalBytes ? Math.round((receivedBytes / totalBytes) * 100) : null;
                        progressCallback(receivedBytes, totalBytes, percent);
                    } catch (e) {
                        // ignore callback errors
                    }
                }
            });

            // Pipe to file and await completion
            await new Promise((resolve, reject) => {
                response.data.pipe(writer);
                writer.on('finish', resolve);
                writer.on('error', reject);
                response.data.on('error', reject);
            });

            if (debug) {
                console.log(chalk.cyan(`[INSTALLER] Downloaded: ${outputPath}`));
            }

            // Final callback to mark 100%
            if (progressCallback && typeof progressCallback === 'function') {
                try { progressCallback(receivedBytes, totalBytes, 100); } catch (e) {}
            }

            return true;
        } catch (error) {
            if (fs.existsSync(outputPath)) {
                fs.unlinkSync(outputPath);
            }
            throw error;
        }
    }

    /**
     * List available plugins from server
     * @param {boolean} debug
     * @returns {Promise<array>}
     */
    async listAvailablePlugins(debug = false) {
        try {
            if (debug) {
                console.log(chalk.cyan(`[INSTALLER] Fetching available plugins...`));
            }

            const response = await this.client.get('/plugins');

            if (response.data && response.data.success && response.data.plugins) {
                return response.data.plugins;
            }

            return [];
        } catch (error) {
            if (debug) {
                console.error(chalk.red(`[ERROR] ${error.message}`));
                if (error.response) {
                    console.error(chalk.red(`[RESPONSE] Status: ${error.response.status}`));
                    console.error(chalk.red(`[RESPONSE] Data: ${JSON.stringify(error.response.data)}`));
                }
            }
            throw new Error(`Failed to fetch plugins: ${error.message}`);
        }
    }

    /**
     * Search plugins on server
     * @param {string} query
     * @param {boolean} debug
     * @returns {Promise<array>}
     */
    async searchPlugins(query, debug = false) {
        try {
            if (debug) {
                console.log(chalk.cyan(`[INSTALLER] Searching for "${query}"...`));
            }

            const response = await this.client.get(`/search?q=${encodeURIComponent(query)}`);

            if (response.data && response.data.success && response.data.plugins) {
                return response.data.plugins;
            }

            return [];
        } catch (error) {
            throw new Error(`Search failed: ${error.message}`);
        }
    }

    /**
     * Verify plugin integrity
     * @param {string} pluginName
     * @returns {boolean}
     */
    verifyPlugin(pluginName) {
        const pluginPath = path.join(this.addonsPath, `${pluginName}-elios-addon.js`);

        if (!fs.existsSync(pluginPath)) {
            return false;
        }

        try {
            const code = fs.readFileSync(pluginPath, 'utf8');
            // Basic validation: check if it's valid JavaScript
            new Function(code);
            return true;
        } catch (error) {
            console.warn(chalk.yellow(`⚠️  Plugin "${pluginName}" failed verification: ${error.message}`));
            return false;
        }
    }

    /**
     * Uninstall a plugin
     * @param {string} pluginName
     * @returns {boolean}
     */
    uninstallPlugin(pluginName) {
        const pluginPath = path.join(this.addonsPath, `${pluginName}-elios-addon.js`);

        if (!fs.existsSync(pluginPath)) {
            console.warn(chalk.yellow(`⚠️  Plugin "${pluginName}" not found`));
            return false;
        }

        try {
            fs.unlinkSync(pluginPath);
            console.log(chalk.green(`✅ Plugin "${pluginName}" uninstalled`));
            return true;
        } catch (error) {
            console.error(chalk.red(`❌ Failed to uninstall: ${error.message}`));
            return false;
        }
    }

    /**
     * Get installed plugins
     * @returns {array}
     */
    getInstalledPlugins() {
        if (!fs.existsSync(this.addonsPath)) {
            return [];
        }

        return fs.readdirSync(this.addonsPath)
            .filter(f => f.endsWith('-elios-addon.js'))
            .map(f => f.replace('-elios-addon.js', ''));
    }
}

module.exports = PluginInstaller;
