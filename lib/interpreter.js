const chalk = require('chalk');
const path = require('path');
const fs = require('fs');
const { splitArgs, cleanQuotes } = require('./utils');
const PluginLoader = require('./plugin-loader');


class EliosInterpreter {
    constructor(debug = false) {
        this.variables = new Map();
        this.pluginLoader = new PluginLoader(debug);
        this.loadedFiles = new Set(); // Track loaded files to prevent infinite loops
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
            'exit': this.handleExit.bind(this),
            'break': this.handleBreak.bind(this),
            'continue': this.handleContinue.bind(this),
            'isNaN': this.handleIsNaN.bind(this),
            'isEven': this.handleIsEven.bind(this),
            'isOdd': this.handleIsOdd.bind(this),
            "isMathExpression": this.isMathExpression.bind(this), // A ajouter
            'isFileExist': this.handleIsFileExist.bind(this),
            'createFile': this.handleCreateFile.bind(this),
            'getPath': this.handleGetPath.bind(this),
            'readFile': this.handleReadFile.bind(this),
            'replace': this.handleReplace.bind(this),
            'writeFile': this.handleWriteFile.bind(this),
            'jsonRead': this.handleJsonRead.bind(this),
            'jsonWrite': this.handleJsonWrite.bind(this),
            'jsonGet': this.handleJsonGet.bind(this),
            'jsonSet': this.handleJsonSet.bind(this),
            'isNumeric': this.handleIsNumeric.bind(this),
            'isText': this.handleIsText.bind(this),
            'isBool': this.handleIsBool.bind(this),
            'isInt': this.handleIsInt.bind(this),
            'isFloat': this.handleIsFloat.bind(this),
            'isJson': this.handleIsJson.bind(this),
            'typeOf': this.handleTypeOf.bind(this),
            'require': this.handleRequire.bind(this),
            'for': this.processFor.bind(this),
            'endfor': this.handleEndFor.bind(this)
        };
        this.debug = debug;
        this.shouldExit = false;
        this.exitCode = 0;
        this.shouldBreak = false;
        this.shouldContinue = false;
        
        // Load plugins after core functions are initialized
        this.loadPlugins();
    }

    /**
     * Load and register all plugins from ./addons directory
     */
    loadPlugins() {
        const addonsDir = path.join(process.cwd(), 'addons');
        const success = this.pluginLoader.loadPlugins(addonsDir);
        
        if (success) {
            this.pluginLoader.registerPlugins(this.functions, this);
        } else if (this.debug) {
            console.log(chalk.yellow('[DEBUG] Plugin loading encountered errors'));
        }
    }

    /**
     * Get plugin information (for debugging/listing)
     * @returns {array} - Array of loaded plugin metadata
     */
    getPluginInfo() {
        return this.pluginLoader.getPluginInfo();
    }

    async execute(code) {
        try {
            if (!code || code.trim() === '') {
                console.error(chalk.red('Execution error: file is empty or contains only whitespace/comments'));
                return false;
            }

            const processedCode = this.processRequires(code);

            const validationErrors = this.validateCode(processedCode);
            if (validationErrors.length > 0) {
                console.error(chalk.red('Validation errors found:'));
                validationErrors.forEach(err => console.error(chalk.yellow(' - ' + err)));
                return false;
            }

            const lines = processedCode.split('\n').filter(line => {
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

    /**
     * Process §require[file] directives by loading and inlining file content
     * @param {string} code - The code to process
     * @returns {string} - Code with requires resolved
     */
    processRequires(code) {
        const requireRegex = /§require\[([^\]]+)\]/g;
        let processedCode = code;
        let match;

        while ((match = requireRegex.exec(code)) !== null) {
            const filePath = this.resolveRequirePath(match[1]);

            try {
                // Check for circular dependencies
                if (this.loadedFiles.has(filePath)) {
                    if (this.debug) {
                        console.log(chalk.yellow(`[DEBUG REQUIRE] Circular dependency detected: ${filePath}`));
                    }
                    processedCode = processedCode.replace(match[0], '# Circular require skipped');
                    continue;
                }

                // Check file existence
                if (!fs.existsSync(filePath)) {
                    console.error(chalk.red(`[ERROR] File not found: ${filePath}`));
                    return processedCode;
                }

                // Mark file as loaded
                this.loadedFiles.add(filePath);

                // Read and process the file
                const fileContent = fs.readFileSync(filePath, 'utf8');
                
                if (this.debug) {
                    console.log(chalk.blue(`[DEBUG REQUIRE] Loading: ${filePath}`));
                }

                // Recursively process requires in the loaded file
                const processedContent = this.processRequires(fileContent);

                // Replace the require directive with the file content
                processedCode = processedCode.replace(match[0], processedContent);
            } catch (error) {
                console.error(chalk.red(`[ERROR] Failed to load file: ${error.message}`));
                return processedCode;
            }
        }

        return processedCode;
    }

    /**
     * Resolve a require path to an absolute file path
     * @param {string} filePath - The path provided to §require
     * @returns {string} - Absolute file path
     */
    resolveRequirePath(filePath) {
        filePath = filePath.trim();

        // Add .elios extension if not present
        if (!filePath.endsWith('.elios')) {
            filePath += '.elios';
        }

        // Make absolute path
        if (!path.isAbsolute(filePath)) {
            filePath = path.join(process.cwd(), filePath);
        }

        return filePath;
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
            } else if (line.startsWith('§for[')) {
                stack.push({ type: 'for', line: idx + 1 });
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
            } else if (line.startsWith('§endfor')) {
                if (stack.length === 0) {
                    errors.push(`Unmatched §endfor at line ${idx + 1}`);
                } else {
                    const top = stack[stack.length - 1];
                    if (top.type !== 'for') {
                        errors.push(`Mismatched §endfor at line ${idx + 1}, expected end of §${top.type} started at line ${top.line}`);
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
        } else if (line.startsWith('§for[')) {
            return await this.processFor(lines, index);
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
            while (currentIndex < lines.length && !this.shouldExit && !this.shouldBreak && !this.shouldContinue) {
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

                    // Vérifier break/continue après l'exécution
                    if (this.shouldBreak || this.shouldContinue) {
                        break;
                    }
                }
            }
        } else {
            while (currentIndex < lines.length && !this.shouldExit && !this.shouldBreak && !this.shouldContinue) {
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
                            while (currentIndex < lines.length && !this.shouldExit && !this.shouldBreak && !this.shouldContinue) {
                                const innerLine = lines[currentIndex].trim();
                                if (innerLine.startsWith('§endif') || innerLine.startsWith('§elseif[') || innerLine.startsWith('§else')) {
                                    break;
                                } else if (innerLine.startsWith('§if[')) {
                                    currentIndex = await this.processCondition(lines, currentIndex);
                                } else {
                                    await this.executeLine(innerLine);
                                    currentIndex++;

                                    // Vérifier break/continue après l'exécution
                                    if (this.shouldBreak || this.shouldContinue) {
                                        break;
                                    }
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
                        while (currentIndex < lines.length && !this.shouldExit && !this.shouldBreak && !this.shouldContinue) {
                            const innerLine = lines[currentIndex].trim();
                            if (innerLine.startsWith('§endif')) {
                                break;
                            } else if (innerLine.startsWith('§if[')) {
                                currentIndex = await this.processCondition(lines, currentIndex);
                            } else {
                                await this.executeLine(innerLine);
                                currentIndex++;

                                // Vérifier break/continue après l'exécution
                                if (this.shouldBreak || this.shouldContinue) {
                                    break;
                                }
                            }
                        }
                    } else {
                        currentIndex++;
                    }
                } else if (line.startsWith('§if[')) {
                    let depth = 1;
                    currentIndex++;
                    while (currentIndex < lines.length && depth > 0 && !this.shouldExit && !this.shouldBreak && !this.shouldContinue) {
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

        let iterationCount = 0;
        const maxIterations = 1000;

        while (this.evaluateCondition(condition) && iterationCount < maxIterations && !this.shouldExit) {
            this.shouldBreak = false;
            this.shouldContinue = false;

            let blockIndex = currentIndex;

            while (blockIndex < endWhileIndex && !this.shouldExit && !this.shouldBreak) {
                const line = lines[blockIndex].trim();

                if (this.shouldContinue) {
                    break;
                }

                if (line.startsWith('§if[')) {
                    blockIndex = await this.processCondition(lines, blockIndex);
                } else if (line.startsWith('§while[')) {
                    blockIndex = await this.processWhile(lines, blockIndex);
                } else {
                    await this.executeLine(line);
                    blockIndex++;
                }
                if (this.shouldBreak) {
                    break;
                }
            }

            if (this.shouldBreak) {
                break;
            }

            iterationCount++;

            if (this.debug) {
                console.log(chalk.blue(`[DEBUG WHILE] Iteration ${iterationCount}, condition: ${condition}`));
            }
        }

        this.shouldBreak = false;
        this.shouldContinue = false;

        if (iterationCount >= maxIterations) {
            console.error(chalk.red('Error: While loop exceeded maximum iterations'));
        }

        return endWhileIndex + 1;
    }

    async processFor(lines, startIndex) {
        const forLine = lines[startIndex].trim();
        const forMatch = forLine.match(/^§for\[([^;]+);([^;]+);([^\]]+)\]$/);
        if (!forMatch) return startIndex + 1;

        const varName = forMatch[1].trim();
        const startVal = parseFloat(this.evaluateNestedFunctions(forMatch[2].trim()));
        const endVal = parseFloat(this.evaluateNestedFunctions(forMatch[3].trim()));

        let currentIndex = startIndex + 1;

        // Find §endfor
        let endForIndex = -1;
        let tempIndex = currentIndex;
        while (tempIndex < lines.length && endForIndex === -1) {
            if (lines[tempIndex].trim().startsWith('§endfor')) {
                endForIndex = tempIndex;
            }
            tempIndex++;
        }

        if (endForIndex === -1) {
            console.error(chalk.red('Error: §endfor not found for §for'));
            return lines.length;
        }

        // Execute loop iterations
        let iterationCount = 0;
        const maxIterations = 10000;

        for (let i = startVal; i < endVal && iterationCount < maxIterations && !this.shouldExit; i++) {
            // Set loop variable
            this.variables.set(varName, String(i));

            // Execute loop body
            currentIndex = startIndex + 1;
            while (currentIndex < endForIndex && !this.shouldExit && !this.shouldBreak) {
                const line = lines[currentIndex].trim();
                
                if (line.startsWith('§if[')) {
                    currentIndex = await this.processCondition(lines, currentIndex);
                } else if (line.startsWith('§while[')) {
                    currentIndex = await this.processWhile(lines, currentIndex);
                } else if (line.startsWith('§for[')) {
                    currentIndex = await this.processFor(lines, currentIndex);
                } else if (line !== '' && !line.startsWith('#')) {
                    await this.executeLine(line);
                    currentIndex++;
                } else {
                    currentIndex++;
                }

                if (this.shouldContinue) {
                    this.shouldContinue = false;
                    break;
                }
                if (this.shouldBreak) {
                    break;
                }
            }

            if (this.shouldBreak) {
                this.shouldBreak = false;
                break;
            }

            iterationCount++;

            if (this.debug) {
                console.log(chalk.blue(`[DEBUG FOR] Iteration ${iterationCount}, ${varName}=${i}`));
            }
        }

        if (iterationCount >= maxIterations) {
            console.error(chalk.red('Error: For loop exceeded maximum iterations'));
        }

        return endForIndex + 1;
    }

    handleEndFor(args) {
        // This is a no-op marker, real logic is in processFor
        return;
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

const handlers = require('./handlers');
Object.assign(EliosInterpreter.prototype, handlers);

module.exports = EliosInterpreter;