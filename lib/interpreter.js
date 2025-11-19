const chalk = require('chalk');
const { splitArgs, cleanQuotes } = require('./utils');


class EliosInterpreter {
    constructor(debug = false) {
        this.variables = new Map();
        this.functions = {
            'log': this.handleLog.bind(this),
            'var': this.handleVar.bind(this),
            'random': this.handleRandom.bind(this),
            'upper': this.handleUpper.bind(this),
            'len': this.handleLen.bind(this),
            'contains': this.handleContains.bind(this),
            'lower': this.handleLower.bind(this),
            'trim': this.handleTrim.bind(this),
            'add': this.handleAdd.bind(this),
            'sub': this.handleSub.bind(this),
            'mul': this.handleMul.bind(this),
            'div': this.handleDiv.bind(this),
            'round': this.handleRound.bind(this),
            'time': this.handleTime.bind(this),
            'date': this.handleDate.bind(this),
            'sleep': this.handleSleep.bind(this),
            'while': this.processWhile.bind(this),
            'input': this.handleInput.bind(this),
            'clear': this.handleClear.bind(this),
            'equalsIgnoreCase': this.handleEqualsIgnoreCase.bind(this),
            'exit': this.handleExit.bind(this)
        };
        this.debug = debug;
        this.shouldExit = false;
        this.exitCode = 0;
    }

    async execute(code) {
        try {
            if (!code || code.trim() === '') {
                console.error(chalk.red('Execution error: file is empty or contains only whitespace/comments'));
                return false;
            }

            const validationErrors = this.validateCode(code);
            if (validationErrors.length > 0) {
                console.error(chalk.red('Validation errors found:'));
                validationErrors.forEach(err => console.error(chalk.yellow(' - ' + err)));
                return false;
            }

            const lines = code.split('\n').filter(line => {
                const trimmed = line.trim();
                return trimmed !== '' && !trimmed.startsWith('#');
            });

            let i = 0;
            while (i < lines.length && !this.shouldExit) {
                i = await this.processLine(lines, i);
            }

            return true;
        } catch (error) {
            console.error(chalk.red('Execution error:'), error.message);
            return false;
        }
    }

    validateCode(code) {
        const lines = code.split('\n');
        const stack = [];
        const errors = [];

        for (let idx = 0; idx < lines.length; idx++) {
            const raw = lines[idx];
            const line = raw.trim();
            if (line === '' || line.startsWith('#')) continue;

            if (line.startsWith('§if[')) {
                stack.push({ type: 'if', line: idx + 1 });
            } else if (line.startsWith('§while[')) {
                stack.push({ type: 'while', line: idx + 1 });
            } else if (line.startsWith('§endif')) {
                if (stack.length === 0) {
                    errors.push(`Unmatched §endif at line ${idx + 1}`);
                } else {
                    const top = stack[stack.length - 1];
                    if (top.type !== 'if') {
                        errors.push(`Mismatched §endif at line ${idx + 1}, expected end of §${top.type} started at line ${top.line}`);
                    } else {
                        stack.pop();
                    }
                }
            } else if (line.startsWith('§endwhile')) {
                if (stack.length === 0) {
                    errors.push(`Unmatched §endwhile at line ${idx + 1}`);
                } else {
                    const top = stack[stack.length - 1];
                    if (top.type !== 'while') {
                        errors.push(`Mismatched §endwhile at line ${idx + 1}, expected end of §${top.type} started at line ${top.line}`);
                    } else {
                        stack.pop();
                    }
                }
            } else if (line.startsWith('§elseif[') || line.startsWith('§else')) {
                if (stack.length === 0 || stack[stack.length - 1].type !== 'if') {
                    const token = line.startsWith('§elseif[') ? '§elseif' : '§else';
                    errors.push(`${token} at line ${idx + 1} without matching §if`);
                }
            }
        }

        while (stack.length > 0) {
            const top = stack.pop();
            errors.push(`Unclosed §${top.type} starting at line ${top.line}`);
        }

        return errors;
    }

    async processLine(lines, index) {
        const line = lines[index].trim();

        if (line.startsWith('§if[')) {
            return await this.processCondition(lines, index);
        } else if (line.startsWith('§while[')) {
            return await this.processWhile(lines, index);
        } else {
            await this.executeLine(line);
            return index + 1;
        }
    }

    async processCondition(lines, startIndex) {
        const ifLine = lines[startIndex].trim();
        const ifMatch = ifLine.match(/^§if\[(.*)\]$/);
        if (!ifMatch) return startIndex + 1;

        const mainCondition = ifMatch[1];
        const mainResult = this.evaluateCondition(mainCondition);

        let currentIndex = startIndex + 1;
        let blockExecuted = mainResult;

        if (mainResult) {
            while (currentIndex < lines.length && !this.shouldExit) {
                const line = lines[currentIndex].trim();
                if (line.startsWith('§endif')) {
                    return currentIndex + 1;
                } else if (line.startsWith('§elseif[') || line.startsWith('§else')) {
                    while (currentIndex < lines.length && !lines[currentIndex].trim().startsWith('§endif')) {
                        currentIndex++;
                    }
                    return currentIndex < lines.length ? currentIndex + 1 : currentIndex;
                } else if (line.startsWith('§if[')) {
                    currentIndex = await this.processCondition(lines, currentIndex);
                } else {
                    await this.executeLine(line);
                    currentIndex++;
                }
            }
        } else {
            while (currentIndex < lines.length && !this.shouldExit) {
                const line = lines[currentIndex].trim();

                if (line.startsWith('§endif')) {
                    return currentIndex + 1;
                } else if (line.startsWith('§elseif[')) {
                    const elseifMatch = line.match(/^§elseif\[(.*)\]$/);
                    if (elseifMatch && !blockExecuted) {
                        const elseifCondition = elseifMatch[1];
                        if (this.evaluateCondition(elseifCondition)) {
                            blockExecuted = true;
                            currentIndex++;
                            while (currentIndex < lines.length && !this.shouldExit) {
                                const innerLine = lines[currentIndex].trim();
                                if (innerLine.startsWith('§endif') || innerLine.startsWith('§elseif[') || innerLine.startsWith('§else')) {
                                    break;
                                } else if (innerLine.startsWith('§if[')) {
                                    currentIndex = await this.processCondition(lines, currentIndex);
                                } else {
                                    await this.executeLine(innerLine);
                                    currentIndex++;
                                }
                            }
                            continue;
                        }
                    }
                    currentIndex++;
                } else if (line.startsWith('§else')) {
                    if (!blockExecuted) {
                        blockExecuted = true;
                        currentIndex++;
                        while (currentIndex < lines.length && !this.shouldExit) {
                            const innerLine = lines[currentIndex].trim();
                            if (innerLine.startsWith('§endif')) {
                                break;
                            } else if (innerLine.startsWith('§if[')) {
                                currentIndex = await this.processCondition(lines, currentIndex);
                            } else {
                                await this.executeLine(innerLine);
                                currentIndex++;
                            }
                        }
                    } else {
                        currentIndex++;
                    }
                } else if (line.startsWith('§if[')) {
                    let depth = 1;
                    currentIndex++;
                    while (currentIndex < lines.length && depth > 0 && !this.shouldExit) {
                        const subLine = lines[currentIndex].trim();
                        if (subLine.startsWith('§if[')) depth++;
                        if (subLine.startsWith('§endif')) depth--;
                        currentIndex++;
                    }
                } else {
                    currentIndex++;
                }
            }
        }

        return currentIndex;
    }

    async processWhile(lines, startIndex) {
        const whileLine = lines[startIndex].trim();
        const whileMatch = whileLine.match(/^§while\[(.*)\]$/);
        if (!whileMatch) return startIndex + 1;

        const condition = whileMatch[1];
        let currentIndex = startIndex + 1;

        // Trouve l'index de §endwhile
        let endWhileIndex = -1;
        let tempIndex = currentIndex;
        while (tempIndex < lines.length && endWhileIndex === -1) {
            if (lines[tempIndex].trim().startsWith('§endwhile')) {
                endWhileIndex = tempIndex;
            }
            tempIndex++;
        }

        if (endWhileIndex === -1) {
            console.error(chalk.red('Error: §endwhile not found for §while'));
            return lines.length;
        }

        // Sécurité contre les boucles infinies
        let iterationCount = 0;
        const maxIterations = 1000;

        // Boucle tant que la condition est vraie
        while (this.evaluateCondition(condition) && iterationCount < maxIterations && !this.shouldExit) {
            let blockIndex = currentIndex;

            // Exécute le bloc while
            while (blockIndex < endWhileIndex && !this.shouldExit) {
                const line = lines[blockIndex].trim();

                if (line.startsWith('§if[')) {
                    blockIndex = await this.processCondition(lines, blockIndex);
                } else if (line.startsWith('§while[')) {
                    blockIndex = await this.processWhile(lines, blockIndex);
                } else {
                    await this.executeLine(line);
                    blockIndex++;
                }
            }

            iterationCount++;

            if (this.debug) {
                console.log(chalk.blue(`[DEBUG WHILE] Iteration ${iterationCount}, condition: ${condition}`));
            }
        }

        if (iterationCount >= maxIterations) {
            console.error(chalk.red('Error: While loop exceeded maximum iterations'));
        }

        return endWhileIndex + 1;
    }

    async executeLine(line) {
        if (!line.startsWith('§') || this.shouldExit) {
            return;
        }

        const match = line.match(/^§(\w+)(?:\[(.*)\])?$/);
        if (!match) {
            return;
        }

        const funcName = match[1];
        const args = match[2] || '';

        if (this.functions[funcName]) {
            const result = this.functions[funcName](args);
            if (result instanceof Promise) {
                await result;
            }
            return result;
        }
    }
    // Handlers and helpers (input, log, math, text, nested evaluation, variable replacement, etc.)
    // were moved to `lib/handlers.js` to split the interpreter into multiple files.
}

// Attach moved handlers to the prototype
const handlers = require('./handlers');
Object.assign(EliosInterpreter.prototype, handlers);

module.exports = EliosInterpreter;