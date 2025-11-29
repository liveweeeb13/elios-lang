#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { EliosInterpreter, extractType1Functions, extractType2Functions } = require('./index');
const SyntaxValidator = require('./lib/syntax-validator');
const Tokenizer = require('./lib/tokenizer');
const PluginInstaller = require('./lib/plugin-installer');

// Progress bar utility with real progression
class ProgressBar {
    constructor(label, total = 100) {
        this.label = label;
        this.total = total;
        this.current = 0;
        this.startTime = Date.now();
        this.width = 40;
        this.interval = null;
        this.isFinished = false;
        this.estimatedTime = 3000; // Default estimate
    }

    start(estimatedTime = null, auto = true) {
        this.startTime = Date.now();
        this.current = 0;
        this.isFinished = false;
        if (estimatedTime) this.estimatedTime = estimatedTime;

        // Auto-increment progress based on elapsed time (only if auto is enabled)
        if (auto) {
            this.interval = setInterval(() => {
                if (!this.isFinished) {
                    const elapsed = Date.now() - this.startTime;
                    // Progress up to 95% based on estimated time
                    this.current = Math.min((elapsed / this.estimatedTime) * 100, 95);
                    this.render();
                }
            }, 50);
        }
    }

    finish() {
        this.isFinished = true;
        if (this.interval) clearInterval(this.interval);
        this.current = 100;
        this.render();
    }

    render() {
        const percent = Math.round((this.current / this.total) * 100);
        const filled = Math.round((this.width * this.current) / this.total);
        const empty = this.width - filled;
        
        const bar = '█'.repeat(filled) + (filled < this.width ? '▌' : '') + '░'.repeat(Math.max(0, empty - 1));
        const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
        
        process.stdout.write(`\r${chalk.cyan(this.label)} ${chalk.green(bar)} ${chalk.white(percent.toString().padStart(3) + '%')} ${chalk.gray(`(${elapsed}s)`)}`);
    }
}

function showHelp() {
    console.log(chalk.cyan(`
🚀 Elios Language

${chalk.bold.cyan('Usage:')}
  ${chalk.green('elios')} ${chalk.yellow('<file>')} ${chalk.blue('[options]')}

${chalk.bold.cyan('Options:')}
  ${chalk.green('-d, --debug')}      ${chalk.white('Run in debug mode with detailed information')}
  ${chalk.green('-h, --help')}       ${chalk.white('Show this help message')}
  ${chalk.green('-v, --version')}    ${chalk.white('Show version information')}
  ${chalk.green('--plugins')}        ${chalk.white('List all installed plugins and addons')}
  ${chalk.green('--addons')}         ${chalk.white('List all installed plugins and addons')}
  ${chalk.green('--install')}        ${chalk.white('Install a plugin from registry')}
  ${chalk.green('--uninstall')}      ${chalk.white('Remove an installed plugin')}
  ${chalk.green('--list-remote')}    ${chalk.white('List available plugins from registry')}
  ${chalk.green('--search')}         ${chalk.white('Search plugins in registry')}
  ${chalk.green('--format')}         ${chalk.white('Format Elios code')}
  ${chalk.green('--lint')}           ${chalk.white('Lint Elios code for issues')}
  ${chalk.green('--support')}        ${chalk.white('Get Discord support link')}

${chalk.bold.cyan('Examples:')}
  ${chalk.blue('elios program.elios')}
  ${chalk.blue('elios program.elios --debug')}
  ${chalk.blue('elios --plugins')}

${chalk.bold.cyan('Quick Start:')}
  ${chalk.white('1. Create a file:')} ${chalk.yellow('program.elios')}
  ${chalk.white('2. Write your code:')} ${chalk.green('§log[Hello World!]')}
  ${chalk.white('3. Run it:')} ${chalk.blue('elios program.elios')}

${chalk.bold.cyan('Documentation:')}
  ${chalk.white('📚')} ${chalk.underline.blue('https://liveweeeb13.github.io/elios')}

${chalk.bold.cyan('Need Help?')}
  ${chalk.white('💬 Join our Discord community for support!')}
  ${chalk.white('🔗')} ${chalk.underline.magenta('https://discord.gg/ukJegYrXWR')}

${chalk.yellow('💡 Tip: Use debug mode to see detailed execution info!')}
    `));
}

function showVersion() {
    const packageJson = require('./package.json');
    console.log(chalk.cyan(`
Elios

${chalk.bold('Version:')}    ${chalk.green(packageJson.version)}
${chalk.bold('Author:')}     ${chalk.blue('LiveWeeeb13')}
${chalk.bold('License:')}    ${chalk.yellow('MIT')}

${chalk.gray('A simple and powerful programming language for beginners and experts alike.')}
    `));
}

function showBanner() {
}

function showSupportInfo() {
    console.log(chalk.magenta(`
📞 Need Help?

${chalk.green('🔗 Documentation:')} ${chalk.underline.blue('https://liveweeeb13.github.io/elios')}
${chalk.green('💬 Discord:')}      ${chalk.underline.magenta('https://discord.gg/ukJegYrXWR')}
${chalk.green('🐛 Issues:')}       ${chalk.underline.blue('https://github.com/liveweeeb13/elios')}

${chalk.yellow('✨ Quick support available on Discord!')}
${chalk.gray('Join our community of developers.')}
    `));
}

function listPlugins() {
    const addonsPath = path.join(__dirname, 'addons');
    
    console.log(chalk.cyan(`
🔌 Installed Plugins & Addons
    `));
    
    try {
        if (!fs.existsSync(addonsPath)) {
            console.log(chalk.yellow('No addons directory found'));
            return;
        }
        
        const files = fs.readdirSync(addonsPath).filter(f => f.endsWith('-elios-addon.js'));
        
        if (files.length === 0) {
            console.log(chalk.yellow('No plugins installed'));
            return;
        }
        
        console.log(chalk.white(`Found ${chalk.green(files.length)} plugin(s):\n`));
        
        files.forEach((file) => {
            const pluginName = file.replace('-elios-addon.js', '');
            const filePath = path.join(addonsPath, file);
            const stats = fs.statSync(filePath);
            const sizeKb = (stats.size / 1024).toFixed(2);
            
            console.log(chalk.green(`  ✓ ${pluginName}`));
            console.log(chalk.gray(`    Size: ${sizeKb} KB`));
            console.log(chalk.gray(`    Path: addons/${file}\n`));
        });
        
        console.log(chalk.blue(`${chalk.bold('Total:')} ${files.length} plugin(s) loaded`));
    } catch (error) {
        console.error(chalk.red(`Error reading plugins: ${error.message}`));
    }
}

async function handlePluginInstall(args) {
    const pluginIndex = args.findIndex(arg => arg === '--install' || arg === '-i');
    const pluginNameRaw = args[pluginIndex + 1];

    if (!pluginNameRaw || pluginNameRaw.startsWith('-')) {
        console.error(chalk.red('❌ Error: Plugin name required'));
        console.log(chalk.yellow('Usage: elios --install <plugin-name> [--version <version>]'));
        console.log(chalk.yellow('Examples: '));
        console.log(chalk.yellow('  elios --install color-utils'));
        console.log(chalk.yellow('  elios --install color-utils@2.1.0'));
        console.log(chalk.yellow('  elios --install color-utils --version 2.1.0'));
        process.exit(1);
    }

    let pluginName = pluginNameRaw;
    let version = null;

    if (pluginNameRaw.includes('@')) {
        [pluginName, version] = pluginNameRaw.split('@');
    }

    const versionIndex = args.findIndex(arg => arg === '--version');
    if (versionIndex !== -1 && args[versionIndex + 1] && !args[versionIndex + 1].startsWith('-')) {
        version = args[versionIndex + 1];
    }

    const installer = new PluginInstaller();
    const force = args.includes('--force') || args.includes('-f');
    const debug = args.includes('--debug') || args.includes('-d');

    // Single progress bar for installer (label includes emoji)
    const progressBar = new ProgressBar('🔌 Installing', 100);
    // Disable internal auto-estimation because we use real download progress
    progressBar.start(null, false);

    // Provide progress callback to installer.downloadPlugin via options
    const progressCallback = (received, total, percent) => {
        if (percent !== null && !Number.isNaN(percent)) {
            // Use the real percent reported by the downloader (clamp to 0..99)
            progressBar.current = Math.min(Math.max(Number(percent), 0), 99);
            progressBar.render();
        } else {
            // When total size is unknown, gently increment up to 90%
            progressBar.current = Math.min(progressBar.current + 1, 90);
            progressBar.render();
        }
    };

    try {
        const installStart = Date.now();
        const success = await installer.installPlugin(pluginName, { force, debug, version, progressCallback });
        const installTime = Math.max(Date.now() - installStart, 1000);

        if (!success) {
            if (progressBar.interval) clearInterval(progressBar.interval);
                // Move to new line then print error
                process.stdout.write('\n');
                console.log(chalk.red('❌ Installation failed'));
            process.exit(1);
        }

        const verified = installer.verifyPlugin(pluginName);

        // Finish the bar (set to 100% but do not append newline)
        progressBar.finish();

        // Nicely formatted summary below the progress bar
        process.stdout.write('\n');
        if (verified) {
            console.log(chalk.bgGreen.black('  SUCCESS  ') + ' ' + chalk.green.bold('Plugin installed successfully'));
            const pluginFile = `${pluginName}-elios-addon.js`;
            const location = `addons/${pluginFile}`;
            const versionLabel = version ? version : 'latest';
            console.log(chalk.gray(`   • Name: `) + chalk.white(pluginName) + chalk.gray(`    • Location: `) + chalk.white(location));
            console.log(chalk.gray(`   • Version: `) + chalk.white(versionLabel));
            console.log();
        } else {
            console.log(chalk.yellow(`⚠️  Plugin installed but verification failed`));
        }

        process.exit(0);
    } catch (error) {
        if (progressBar.interval) clearInterval(progressBar.interval);
        process.stdout.write('\n');
        console.log(chalk.red(`❌ Error: ${error.message}`));
        process.exit(1);
    }
}

async function handlePluginUninstall(args) {
    const pluginIndex = args.findIndex(arg => arg === '--uninstall' || arg === '-u');
    const pluginName = args[pluginIndex + 1];

    if (!pluginName || pluginName.startsWith('-')) {
        console.error(chalk.red('❌ Error: Plugin name required'));
        console.log(chalk.yellow('Usage: elios --uninstall <plugin-name>'));
        process.exit(1);
    }

    const installer = new PluginInstaller();

    // Single progress bar for uninstaller (label includes emoji)
    const progressBar = new ProgressBar('🗑️ Removing', 100);
    progressBar.start(1500);

    try {
        const uninstallStart = Date.now();
        const success = installer.uninstallPlugin(pluginName);
        const uninstallTime = Math.max(Date.now() - uninstallStart, 800);
        
        // Update progress bar with actual time
        progressBar.estimatedTime = uninstallTime;

        if (!success) {
            if (progressBar.interval) clearInterval(progressBar.interval);
            process.stdout.write('\n');
            console.log(chalk.red(`❌ Failed to uninstall plugin: ${pluginName}`));
            process.exit(1);
        }

        // Finish the bar
        progressBar.finish();
        process.stdout.write('\n');
        console.log(chalk.bgGreen.black('  SUCCESS  ') + ' ' + chalk.green.bold('Plugin uninstalled successfully'));
        console.log(chalk.gray('   • Name: ') + chalk.white(pluginName));
        console.log();
        process.exit(0);
    } catch (error) {
        if (progressBar.interval) clearInterval(progressBar.interval);
        process.stdout.write('\n');
        console.log(chalk.red(`❌ Error: ${error.message}`));
        process.exit(1);
    }
}

async function handleListRemotePlugins(args) {
    const installer = new PluginInstaller();
    const debug = args.includes('--debug') || args.includes('-d');

    console.log(chalk.cyan(`
📦 Available Plugins from Registry
    `));

    try {
        const plugins = await installer.listAvailablePlugins(debug);

        if (plugins.length === 0) {
            console.log(chalk.yellow('No plugins available'));
            process.exit(0);
        }

        console.log(chalk.white(`Found ${chalk.green(plugins.length)} plugin(s):\n`));

        plugins.forEach((plugin) => {
            console.log(chalk.green(`  📦 ${plugin.name}`));
            console.log(chalk.white(`     ${plugin.description}`));
            console.log(chalk.gray(`     Version: ${plugin.version} | Downloads: ${plugin.downloads}`));
            console.log(chalk.gray(`     Author: ${plugin.author}\n`));
        });

        console.log(chalk.blue(`Install with: ${chalk.bold('elios --install <name>')}`));
    } catch (error) {
        console.error(chalk.red(`❌ Error: ${error.message}`));
        process.exit(1);
    }
    process.exit(0);
}

async function handleSearchPlugins(args) {
    const searchIndex = args.findIndex(arg => arg === '--search');
    const query = args[searchIndex + 1];

    if (!query || query.startsWith('-')) {
        console.error(chalk.red('❌ Error: Search query required'));
        console.log(chalk.yellow('Usage: elios --search <query>'));
        console.log(chalk.yellow('Example: elios --search color'));
        process.exit(1);
    }

    const installer = new PluginInstaller();
    const debug = args.includes('--debug') || args.includes('-d');

    console.log(chalk.cyan(`
🔍 Searching for "${query}"
    `));

    try {
        const results = await installer.searchPlugins(query, debug);

        if (results.length === 0) {
            console.log(chalk.yellow('No plugins found'));
            process.exit(0);
        }

        console.log(chalk.white(`Found ${chalk.green(results.length)} result(s):\n`));

        results.forEach((plugin) => {
            console.log(chalk.green(`  📦 ${plugin.name}`));
            console.log(chalk.white(`     ${plugin.description}`));
            console.log(chalk.gray(`     Version: ${plugin.version} | Downloads: ${plugin.downloads}`));
            console.log(chalk.gray(`     Author: ${plugin.author}\n`));
        });

        console.log(chalk.blue(`Install with: ${chalk.bold('elios --install <name>')}`));
    } catch (error) {
        console.error(chalk.red(`❌ Error: ${error.message}`));
        process.exit(1);
    }
    process.exit(0);
}

function showFileAnalysis(code, debugMode) {
    if (debugMode) {
        console.log(chalk.cyan(`
🔍 File Analysis
        `));
        
        console.log(chalk.white("Type 1 Functions:"), extractType1Functions(code));
        console.log(chalk.white("Type 2 Functions:"), extractType2Functions(code));
        
        console.log(chalk.cyan(`
⚡ Execution
        `));
    }
}

function showExecutionResult(success = true, error = null) {
    if (success) {
        console.log(chalk.green(`
✅ Program Executed Successfully
        `));
    } else {
        console.log(chalk.red(`
❌ Execution Failed
        `));

        if (error) {
            console.log(chalk.white('Error:') + ' ' + error);
            showSupportInfo();
        }
    }
}

function showSyntaxValidation(result, debugMode = false) {
    if (result.isValid) {
        if (debugMode) {
            console.log(chalk.green(`✅ Syntax validation passed`));
        }
    } else {
        console.log(chalk.red(`
❌ Syntax Validation Failed

${chalk.bold('Errors found:')}
        `));
        
        result.errors.forEach((error) => {
            console.log(chalk.red(`  ✗ ${error}`));
        });
        
        if (result.warnings.length > 0) {
            console.log(chalk.yellow(`
${chalk.bold('Warnings:')}
            `));
            result.warnings.forEach((warning) => {
                console.log(chalk.yellow(`  ⚠ ${warning}`));
            });
        }
     //   console.log(chalk.red(`Please fix the above errors before execution.
     // Need help? Run: elios --support`));
    }
}

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
        showBanner();
    }
    
    if (args.includes('-h') || args.includes('--help') || args.length === 0) {
        showHelp();
        
        if (args.includes('--help') || args.length === 0) {
            showSupportInfo();
        }
        process.exit(0);
    }
    
    if (args.includes('-v') || args.includes('--version')) {
        showVersion();
        process.exit(0);
    }
    
    if (args.includes('--support') || args.includes('--discord')) {
        showBanner();
        showSupportInfo();
        process.exit(0);
    }
    
    if (args.includes('--plugins') || args.includes('--addons')) {
        listPlugins();
        process.exit(0);
    }
    
    if (args.includes('--install') || args.includes('-i')) {
        await handlePluginInstall(args);
    }
    
    if (args.includes('--uninstall') || args.includes('-u')) {
        await handlePluginUninstall(args);
    }
    
    if (args.includes('--list-remote')) {
        await handleListRemotePlugins(args);
    }
    
    if (args.includes('--search')) {
        await handleSearchPlugins(args);
    }
    
    if (args.includes('--format')) {
        const fileArg = args.find(arg => !arg.startsWith('-'));
        if (!fileArg) {
            console.error(chalk.red('❌ Error: No file specified for formatting'));
            process.exit(1);
        }
        const EliosFormatter = require('./tools/format');
        const formatter = new EliosFormatter();
        try {
            const code = fs.readFileSync(fileArg, 'utf8');
            const formatted = formatter.format(code);
            fs.writeFileSync(fileArg, formatted, 'utf8');
            console.log(chalk.green(`✅ Code formatted successfully: ${fileArg}`));
        } catch (error) {
            console.error(chalk.red(`❌ Error: ${error.message}`));
            process.exit(1);
        }
        process.exit(0);
    }
    
    if (args.includes('--lint')) {
        const fileArg = args.find(arg => !arg.startsWith('-'));
        if (!fileArg) {
            console.error(chalk.red('❌ Error: No file specified for linting'));
            process.exit(1);
        }
        const EliosLinter = require('./tools/lint');
        const linter = new EliosLinter();
        try {
            const code = fs.readFileSync(fileArg, 'utf8');
            const result = linter.lint(code);
            
            console.log(chalk.cyan(`\n🔍 Linting Results: ${fileArg}\n`));
            
            if (result.errors.length > 0) {
                console.log(chalk.red(`❌ Errors (${result.errors.length}):`));
                result.errors.forEach(err => console.log(chalk.red(`  ✗ ${err}`)));
            }
            
            if (result.warnings.length > 0) {
                console.log(chalk.yellow(`\n⚠  Warnings (${result.warnings.length}):`));
                result.warnings.forEach(warn => console.log(chalk.yellow(`  ⚠  ${warn}`)));
            }
            
            if (result.errors.length === 0 && result.warnings.length === 0) {
                console.log(chalk.green(`✅ Code looks good!`));
            }
            
            if (result.errors.length > 0) process.exit(1);
        } catch (error) {
            console.error(chalk.red(`❌ Error: ${error.message}`));
            process.exit(1);
        }
        process.exit(0);
    }
    
    const debugMode = args.includes('--debug') || args.includes('-d');
    
    const fileArg = args.find(arg => !arg.startsWith('-'));
    
    if (!fileArg) {
        console.error(chalk.red(`
❌ Error: No file specified
        `));
        showHelp();
        process.exit(1);
    }
    
    const filePath = path.resolve(fileArg);
    
    if (!fs.existsSync(filePath)) {
        console.error(chalk.red(`
❌ Error: File not found

${chalk.white('File:')} ${filePath}
        `));
        
        console.log(chalk.yellow(`
💡 ${chalk.bold('Quick fix:')}
  1. Check if the file exists
  2. Verify the file path
  3. Make sure you're in the right directory

${chalk.blue('Need help? Run:')} ${chalk.green('elios --support')}
        `));
        
        process.exit(1);
    }
    
    try {
        const code = fs.readFileSync(filePath, 'utf8');
        
        // Step 1: Tokenize the code
        const tokenizer = new Tokenizer();
        const tokens = tokenizer.tokenize(code);
        
        if (debugMode) {
            console.log(chalk.cyan('\n📝 Tokenization Phase'));
            tokenizer.printTokens(tokens);
        }
        
        // Step 2: Validate syntax
        const validator = new SyntaxValidator();
        const validationResult = validator.validate(code);
        
        showSyntaxValidation(validationResult, debugMode);
        
        // Stop execution if syntax is invalid
        if (!validationResult.isValid) {
            process.exit(1);
        }
        
        if (debugMode) {
            showFileAnalysis(code, debugMode);
        }
        
        // Step 3: Execute
        const interpreter = new EliosInterpreter(debugMode);
        const success = await interpreter.execute(code);

        showExecutionResult(Boolean(success));

        if (!success) process.exit(1);
    } catch (error) {
        showExecutionResult(false, error.message);
        process.exit(1);
    }
}

// Execute only if called directly
if (require.main === module) {
    main();
}