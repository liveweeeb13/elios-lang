#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

/**
 * Auto-format Elios code
 * - Proper indentation
 * - Spacing consistency
 * - Line breaks
 */
class EliosFormatter {
    constructor() {
        this.indentLevel = 0;
        this.indentSize = 4;
    }

    format(code) {
        const lines = code.split('\n');
        const formattedLines = [];
        let inMultilineString = false;

        for (const line of lines) {
            const trimmed = line.trim();

            // Skip empty lines and comments initially
            if (!trimmed || trimmed.startsWith('#')) {
                formattedLines.push(trimmed);
                continue;
            }

            // Decrease indent for closing tags
            if (this.isClosingTag(trimmed)) {
                this.indentLevel = Math.max(0, this.indentLevel - 1);
            }

            // Add indented line
            const indented = ' '.repeat(this.indentLevel * this.indentSize) + trimmed;
            formattedLines.push(indented);

            // Increase indent for opening tags
            if (this.isOpeningTag(trimmed)) {
                this.indentLevel++;
            }
        }

        return formattedLines.join('\n');
    }

    isOpeningTag(line) {
        return /§(if|while|for)\[/.test(line);
    }

    isClosingTag(line) {
        return /§end(if|while|for)/.test(line);
    }
}

async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
        console.log(chalk.cyan(`
🎨 Elios Code Formatter

${chalk.bold('Usage:')}
  ${chalk.green('node tools/format.js')} ${chalk.yellow('<file>')} ${chalk.blue('[options]')}

${chalk.bold('Options:')}
  ${chalk.green('-o, --output')}    ${chalk.white('Output file (default: overwrite)')}
  ${chalk.green('-h, --help')}      ${chalk.white('Show this help message')}

${chalk.bold('Examples:')}
  ${chalk.blue('node tools/format.js program.elios')}
  ${chalk.blue('node tools/format.js program.elios -o formatted.elios')}
        `));
        process.exit(0);
    }

    const fileArg = args.find(arg => !arg.startsWith('-'));
    if (!fileArg) {
        console.error(chalk.red('❌ Error: No file specified'));
        process.exit(1);
    }

    const outputArg = args.includes('-o') ? args[args.indexOf('-o') + 1] : 
                      args.includes('--output') ? args[args.indexOf('--output') + 1] : 
                      fileArg;

    try {
        const code = fs.readFileSync(fileArg, 'utf8');
        const formatter = new EliosFormatter();
        const formatted = formatter.format(code);

        fs.writeFileSync(outputArg, formatted, 'utf8');

        console.log(chalk.green(`✅ Code formatted successfully!`));
        console.log(chalk.gray(`   Input:  ${fileArg}`));
        console.log(chalk.gray(`   Output: ${outputArg}`));
    } catch (error) {
        console.error(chalk.red(`❌ Error: ${error.message}`));
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = EliosFormatter;
