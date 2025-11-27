#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

/**
 * Advanced linting for Elios code
 * - Unused variables detection
 * - Best practices
 * - Code quality warnings
 */
class EliosLinter {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.variables = new Map();
        this.usedVariables = new Set();
    }

    lint(code) {
        this.errors = [];
        this.warnings = [];
        this.variables = new Map();
        this.usedVariables = new Set();

        const lines = code.split('\n');

        // First pass: collect variable definitions
        lines.forEach((line, idx) => {
            this.collectVariables(line, idx + 1);
        });

        // Second pass: check usage
        lines.forEach((line, idx) => {
            this.checkLine(line, idx + 1);
        });

        // Third pass: find unused variables
        this.checkUnusedVariables();

        return {
            errors: this.errors,
            warnings: this.warnings,
            isValid: this.errors.length === 0
        };
    }

    collectVariables(line, lineNum) {
        const varMatch = line.match(/§var\[([^;]+);/);
        if (varMatch) {
            const varName = varMatch[1].trim();
            this.variables.set(varName, { line: lineNum, used: false });
        }
    }

    checkLine(line, lineNum) {
        // Check for undefined variables
        const varUsageMatch = line.match(/\$([A-Za-z_][A-Za-z0-9_]*)/g);
        if (varUsageMatch) {
            varUsageMatch.forEach(match => {
                const varName = match.substring(1); // Remove $
                if (this.variables.has(varName)) {
                    this.variables.get(varName).used = true;
                    this.usedVariables.add(varName);
                } else if (!['add', 'sub', 'mul', 'div'].includes(varName)) {
                    // Allow some common variable-like names
                    if (!this.isBuiltInVariable(varName)) {
                        this.warnings.push(`Line ${lineNum}: Undefined variable "$${varName}"`);
                    }
                }
            });
        }

        // Check for common mistakes
        this.checkCommonMistakes(line, lineNum);
    }

    checkCommonMistakes(line, lineNum) {
        // Missing arguments check
        if (/§\w+\[\s*\]/.test(line)) {
            const funcName = line.match(/§(\w+)\[\s*\]/)?.[1];
            if (funcName && !['clear', 'endfor', 'endif', 'endwhile'].includes(funcName)) {
                this.warnings.push(`Line ${lineNum}: "${funcName}" may require arguments`);
            }
        }

        // Nested function depth check
        const nestLevel = (line.match(/\[/g) || []).length;
        if (nestLevel > 5) {
            this.warnings.push(`Line ${lineNum}: Deep nesting detected (${nestLevel} levels) - consider refactoring`);
        }

        // Long lines
        if (line.length > 100) {
            this.warnings.push(`Line ${lineNum}: Line is very long (${line.length} chars) - consider breaking it up`);
        }
    }

    checkUnusedVariables() {
        this.variables.forEach((info, varName) => {
            if (!info.used) {
                this.warnings.push(`Line ${info.line}: Unused variable "$${varName}"`);
            }
        });
    }

    isBuiltInVariable(name) {
        const builtIns = ['i', 'j', 'k', 'x', 'y', 'z', 'val', 'result'];
        return builtIns.includes(name);
    }
}

async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
        console.log(chalk.cyan(`
🔍 Elios Code Linter

${chalk.bold('Usage:')}
  ${chalk.green('node tools/lint.js')} ${chalk.yellow('<file>')} ${chalk.blue('[options]')}

${chalk.bold('Options:')}
  ${chalk.green('-s, --strict')}    ${chalk.white('Treat warnings as errors')}
  ${chalk.green('-h, --help')}      ${chalk.white('Show this help message')}

${chalk.bold('Examples:')}
  ${chalk.blue('node tools/lint.js program.elios')}
  ${chalk.blue('node tools/lint.js program.elios --strict')}

${chalk.bold('Checks:')}
  • Unused variables
  • Undefined variables
  • Deep nesting (>5 levels)
  • Long lines (>100 chars)
  • Missing arguments
        `));
        process.exit(0);
    }

    const fileArg = args.find(arg => !arg.startsWith('-'));
    if (!fileArg) {
        console.error(chalk.red('❌ Error: No file specified'));
        process.exit(1);
    }

    const strict = args.includes('-s') || args.includes('--strict');

    try {
        const code = fs.readFileSync(fileArg, 'utf8');
        const linter = new EliosLinter();
        const result = linter.lint(code);

        console.log(chalk.cyan(`
🔍 Linting Results: ${fileArg}
        `));

        if (result.errors.length > 0) {
            console.log(chalk.red(`\n❌ Errors (${result.errors.length}):`));
            result.errors.forEach(err => console.log(chalk.red(`  ✗ ${err}`)));
        }

        if (result.warnings.length > 0) {
            console.log(chalk.yellow(`\n⚠  Warnings (${result.warnings.length}):`));
            result.warnings.forEach(warn => console.log(chalk.yellow(`  ⚠  ${warn}`)));
        }

        if (result.errors.length === 0 && result.warnings.length === 0) {
            console.log(chalk.green(`✅ Code looks good!`));
        }

        const totalIssues = result.errors.length + result.warnings.length;
        if (totalIssues > 0) {
            if (strict && result.warnings.length > 0) {
                process.exit(1);
            } else if (result.errors.length > 0) {
                process.exit(1);
            }
        }
    } catch (error) {
        console.error(chalk.red(`❌ Error: ${error.message}`));
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = EliosLinter;
