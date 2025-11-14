#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { EliosInterpreter, extractType1Functions, extractType2Functions } = require('./index');

function showHelp() {
    console.log(chalk.cyan(`
🚀 Elios Language

${chalk.bold.cyan('Usage:')}
  ${chalk.green('npx elios')} ${chalk.yellow('<file>')} ${chalk.blue('[options]')}

${chalk.bold.cyan('Options:')}
  ${chalk.green('-d, --debug')}    ${chalk.white('Run in debug mode with detailed information')}
  ${chalk.green('-h, --help')}     ${chalk.white('Show this help message')}
  ${chalk.green('-v, --version')}  ${chalk.white('Show version information')}
  ${chalk.green('--support')}      ${chalk.white('Get Discord support link')}

${chalk.bold.cyan('Examples:')}
  ${chalk.blue('npx elios program.elios')}
  ${chalk.blue('npx elios program.elios --debug')}
  ${chalk.blue('npx elios program.elios -d')}

${chalk.bold.cyan('Quick Start:')}
  ${chalk.white('1. Create a file:')} ${chalk.yellow('program.elios')}
  ${chalk.white('2. Write your code:')} ${chalk.green('§log[Hello World!]')}
  ${chalk.white('3. Run it:')} ${chalk.blue('npx elios program.elios')}

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

${chalk.white('Error:')} ${error}
        `));
        
        showSupportInfo();
    }
}

function main() {
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

${chalk.blue('Need help? Run:')} ${chalk.green('npx elios --support')}
        `));
        
        process.exit(1);
    }
    
    try {
        const code = fs.readFileSync(filePath, 'utf8');
        
        if (debugMode) {
            showFileAnalysis(code, debugMode);
        }
        
        const interpreter = new EliosInterpreter(debugMode);
        interpreter.execute(code);
        
        showExecutionResult(true);
        
    } catch (error) {
        showExecutionResult(false, error.message);
        process.exit(1);
    }
}

// Execute only if called directly
if (require.main === module) {
    main();
}