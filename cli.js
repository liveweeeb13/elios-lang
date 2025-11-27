#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { EliosInterpreter, extractType1Functions, extractType2Functions } = require('./index');
const SyntaxValidator = require('./lib/syntax-validator');
const Tokenizer = require('./lib/tokenizer');

function showHelp() {
    console.log(chalk.cyan(`
🚀 Elios Language

${chalk.bold.cyan('Usage:')}
  ${chalk.green('npx elios')} ${chalk.yellow('<file>')} ${chalk.blue('[options]')}

${chalk.bold.cyan('Options:')}
  ${chalk.green('-d, --debug')}      ${chalk.white('Run in debug mode with detailed information')}
  ${chalk.green('-h, --help')}       ${chalk.white('Show this help message')}
  ${chalk.green('-v, --version')}    ${chalk.white('Show version information')}
  ${chalk.green('--plugins')}        ${chalk.white('List all installed plugins and addons')}
  ${chalk.green('--addons')}         ${chalk.white('List all installed plugins and addons')}
  ${chalk.green('--format')}         ${chalk.white('Format Elios code')}
  ${chalk.green('--lint')}           ${chalk.white('Lint Elios code for issues')}
  ${chalk.green('--support')}        ${chalk.white('Get Discord support link')}

${chalk.bold.cyan('Examples:')}
  ${chalk.blue('npx elios program.elios')}
  ${chalk.blue('npx elios program.elios --debug')}
  ${chalk.blue('npx elios --plugins')}

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
     // Need help? Run: npx elios --support`));
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

${chalk.blue('Need help? Run:')} ${chalk.green('npx elios --support')}
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