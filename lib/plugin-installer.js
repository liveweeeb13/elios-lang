const fs = require('fs');
const path = require('path');
// use built-in fetch (Node 18+). Avoid axios to simplify packaging with pkg.
const chalk = require('chalk');
const os = require('os');

class PluginInstaller {
    constructor(serverUrl = 'http://51.75.25.2:2010') {
        this.serverUrl = serverUrl.replace(/\/$/, '');

        // Determine addons path based on execution context.
        // Priority:
        // 1. If cwd is (or is inside) a `dist` folder, use `dist/addons`.
        // 2. Else if running packaged (process.pkg), use APPDATA/elios/addons.
        // 3. Otherwise use repo `addons` folder.
        let defaultAddonsPath = path.join(__dirname, '..', 'addons');

        try {
            const cwd = process.cwd();
            
            // Check if we're running from a `dist` folder (e.g., C:\path\to\dist or inside it).
            // This handles both `node cli.js` from dist and packaged exe launched from dist.
            if (cwd.includes(path.sep + 'dist') || cwd.endsWith('dist')) {
                // Extract the dist folder path from cwd.
                const distMatch = cwd.match(/^(.+?\\dist)(?:\\|$)/i) || 
                                   cwd.match(/^(.+?\/dist)(?:\/|$)/);
                if (distMatch) {
                    defaultAddonsPath = path.join(distMatch[1], 'addons');
                }
            } else if (process && process.pkg) {
                // Running packaged but NOT from dist: use APPDATA for safety.
                const base = process.env.APPDATA || path.join(os.homedir(), '.elios');
                defaultAddonsPath = path.join(base, 'elios', 'addons');
            }
        } catch (e) {
            // ignore cwd errors; fall back to defaults
        }

        // Respect an explicit environment override if provided (highest precedence)
        if (process.env && process.env.ELIOS_ADDONS_PATH && process.env.ELIOS_ADDONS_PATH.trim()) {
            this.addonsPath = path.resolve(process.env.ELIOS_ADDONS_PATH.trim());
        } else {
            this.addonsPath = defaultAddonsPath;
        }
        // no external http client to ease bundling; use global fetch
        if (typeof fetch !== 'function') {
            throw new Error('Global fetch is required (Node 18+).');
        }
        this.defaultTimeout = 10000;
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
            if (debug) console.log(chalk.cyan(`[INSTALLER] Fetching plugin info...`));

            const url = `${this.serverUrl}/api/plugins/info/${encodeURIComponent(pluginName)}`;
            const resp = await fetch(url, { method: 'GET' });
            if (!resp.ok) {
                if (resp.status === 404) return null;
                throw new Error(`Failed to fetch plugin info: ${resp.status} ${resp.statusText}`);
            }

            const body = await resp.json();
            if (body && body.success && body.plugin) return body.plugin;
            return null;
        } catch (error) {
            if (error && error.code === 'ENOENT') return null;
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

            // Use fetch stream so we can report progress
            const url = `${this.serverUrl}/api${endpoint}`;
            const resp = await fetch(url, { method: 'GET' });
            if (!resp.ok) throw new Error(`Download failed: ${resp.status} ${resp.statusText}`);

            const totalBytesHeader = resp.headers.get('content-length');
            const totalBytes = totalBytesHeader ? Number(totalBytesHeader) : null;

            const stream = resp.body;
            const writer = fs.createWriteStream(outputPath);
            let receivedBytes = 0;

            // Handle WHATWG ReadableStream (fetch in some Node versions) and Node.js Readable
            if (stream && typeof stream.getReader === 'function') {
                // WHATWG stream: read chunks via reader
                const reader = stream.getReader();
                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        // value is Uint8Array
                        const buffer = Buffer.from(value);
                        receivedBytes += buffer.length;
                        // write to file (may buffer internally)
                        writer.write(buffer);
                        if (progressCallback && typeof progressCallback === 'function') {
                            try {
                                const percent = totalBytes ? Math.round((receivedBytes / totalBytes) * 100) : null;
                                progressCallback(receivedBytes, totalBytes, percent);
                            } catch (e) {}
                        }
                    }
                } finally {
                    // close writer
                    writer.end();
                }

                await new Promise((resolve, reject) => {
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                });
            } else {
                // Node.js Readable stream
                await new Promise((resolve, reject) => {
                    stream.on('data', (chunk) => {
                        receivedBytes += chunk.length;
                        if (progressCallback && typeof progressCallback === 'function') {
                            try {
                                const percent = totalBytes ? Math.round((receivedBytes / totalBytes) * 100) : null;
                                progressCallback(receivedBytes, totalBytes, percent);
                            } catch (e) {}
                        }
                    });

                    stream.on('error', (err) => reject(err));
                    writer.on('error', (err) => reject(err));
                    writer.on('finish', resolve);

                    stream.pipe(writer);
                });
            }

            if (debug) console.log(chalk.cyan(`[INSTALLER] Downloaded: ${outputPath}`));

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

            const url = `${this.serverUrl}/api/plugins`;
            const resp = await fetch(url, { method: 'GET' });
            if (!resp.ok) throw new Error(`Failed to fetch plugins: ${resp.status} ${resp.statusText}`);
            const body = await resp.json();
            if (body && body.success && body.plugins) return body.plugins;
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

            const url = `${this.serverUrl}/api/search?q=${encodeURIComponent(query)}`;
            const resp = await fetch(url, { method: 'GET' });
            if (!resp.ok) throw new Error(`Search failed: ${resp.status} ${resp.statusText}`);
            const body = await resp.json();
            if (body && body.success && body.plugins) return body.plugins;
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
