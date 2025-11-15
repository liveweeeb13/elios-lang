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
                        'input': this.handleInput.bind(this),
            'clear': this.handleClear.bind(this),
            'equalsIgnoreCase': this.handleEqualsIgnoreCase.bind(this),
            'exit': this.handleExit.bind(this)
        };
        this.debug = debug;
    }

    execute(code) {
        try {
            const lines = code.split('\n').filter(line => {
                const trimmed = line.trim();
                return trimmed !== '' && !trimmed.startsWith('#');
            });
            
            let i = 0;
            while (i < lines.length) {
                i = this.processLine(lines, i);
            }
        } catch (error) {
            console.error(chalk.red('Execution error:'), error.message);
        }
    }

    processLine(lines, index) {
        const line = lines[index].trim();
        
        if (line.startsWith('§if[')) {
            return this.processCondition(lines, index);
        } else {
            this.executeLine(line);
            return index + 1;
        }
    }

    processCondition(lines, startIndex) {
        const ifLine = lines[startIndex].trim();
        const ifMatch = ifLine.match(/^§if\[(.*)\]$/);
        if (!ifMatch) return startIndex + 1;

        const mainCondition = ifMatch[1];
        const mainResult = this.evaluateCondition(mainCondition);
        
        let currentIndex = startIndex + 1;
        let blockExecuted = mainResult;

        if (mainResult) {
            while (currentIndex < lines.length) {
                const line = lines[currentIndex].trim();
                if (line.startsWith('§endif')) {
                    return currentIndex + 1;
                } else if (line.startsWith('§elseif[') || line.startsWith('§else')) {
                    while (currentIndex < lines.length && !lines[currentIndex].trim().startsWith('§endif')) {
                        currentIndex++;
                    }
                    return currentIndex < lines.length ? currentIndex + 1 : currentIndex;
                } else if (line.startsWith('§if[')) {
                    currentIndex = this.processCondition(lines, currentIndex);
                } else {
                    this.executeLine(line);
                    currentIndex++;
                }
            }
        } else {
            while (currentIndex < lines.length) {
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
                            while (currentIndex < lines.length) {
                                const innerLine = lines[currentIndex].trim();
                                if (innerLine.startsWith('§endif') || innerLine.startsWith('§elseif[') || innerLine.startsWith('§else')) {
                                    break;
                                } else if (innerLine.startsWith('§if[')) {
                                    currentIndex = this.processCondition(lines, currentIndex);
                                } else {
                                    this.executeLine(innerLine);
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
                        while (currentIndex < lines.length) {
                            const innerLine = lines[currentIndex].trim();
                            if (innerLine.startsWith('§endif')) {
                                break;
                            } else if (innerLine.startsWith('§if[')) {
                                currentIndex = this.processCondition(lines, currentIndex);
                            } else {
                                this.executeLine(innerLine);
                                currentIndex++;
                            }
                        }
                    } else {
                        currentIndex++;
                    }
                } else if (line.startsWith('§if[')) {
                    let depth = 1;
                    currentIndex++;
                    while (currentIndex < lines.length && depth > 0) {
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

    executeLine(line) {
        if (!line.startsWith('§')) {
            return;
        }

        const match = line.match(/^§(\w+)(?:\[(.*)\])?$/);
        if (!match) {
            return;
        }

        const funcName = match[1];
        const args = match[2] || '';

        if (this.functions[funcName]) {
            return this.functions[funcName](args);
        }
    }


        handleInput(args) {
        const prompt = this.replaceVariables(args) || '';
        const cleanedPrompt = cleanQuotes(prompt);

        if (this.debug) {
            console.log(chalk.blue(`[DEBUG INPUT] Prompt: "${cleanedPrompt}"`));
        }

        // pour pkg
        process.stdout.write(cleanedPrompt + ' ');
        
        try {
            const fs = require('fs');
            const buffer = Buffer.alloc(1024);
            const bytesRead = fs.readSync(0, buffer, 0, buffer.length)
            const input = buffer.toString('utf8', 0, bytesRead - 1); // -1 pour enlever le \n
            
            if (this.debug) {
                console.log(chalk.blue(`[DEBUG INPUT] Received: "${input}"`));
            }
            
            return input;
        } catch (error) {
            if (this.debug) {
                console.log(chalk.red(`[DEBUG INPUT ERROR] ${error.message}`));
            }
            return '';
        }
    }

    handleClear(args) {
        if (this.debug) {
            console.log(chalk.blue('[DEBUG CLEAR] Clearing console'));
        }

        try {
            process.stdout.write('\x1Bc');
            console.clear();
        } catch (error) {
            for (let i = 0; i < 50; i++) {
                console.log();
            }
        }

        return 'cleared';
    }

    handleExit(args) {
        const exitCode = parseInt(this.replaceVariables(args)) || 0;
        
        if (this.debug) {
            console.log(chalk.blue(`[DEBUG EXIT] Exiting with code: ${chalk.yellow(exitCode)}`));
        }

        this.shouldExit = true;
        this.exitCode = exitCode;
        
        return exitCode.toString();
    }

    handleLog(args) {
        let text = this.evaluateNestedFunctions(args);
        text = this.replaceVariables(text);
        text = cleanQuotes(text);
        console.log(text);
    }

       handleSleep(args) {
        const ms = parseInt(this.replaceVariables(args)) || 1000;
        if (this.debug) {
            console.log(chalk.blue(`[DEBUG SLEEP] Sleeping for ${chalk.yellow(ms)}ms`));
        }
        
        const start = Date.now();
        while (Date.now() - start < ms) {
        }
        
        return ms.toString();
    }

    handleVar(args) {
        const parts = splitArgs(args);
        if (parts.length >= 2) {
            const name = parts[0].trim();
            let value = parts.slice(1).join(';').trim();
            
            value = this.evaluateNestedFunctions(value);
            value = this.replaceVariables(value);
            
            if (this.isMathExpression(value)) {
                value = this.evaluateMathExpression(value).toString();
            }
            
            value = cleanQuotes(value);
            this.variables.set(name, value);
            
            if (this.debug) {
                console.log(chalk.blue(`[DEBUG VAR] ${chalk.yellow(name)} = ${chalk.green(value)}`));
            }
        }
    }

    handleRandom(args) {
        const parts = splitArgs(args);
        if (parts.length >= 2) {
            const min = parseInt(this.replaceVariables(parts[0]));
            const max = parseInt(this.replaceVariables(parts[1]));
            if (!isNaN(min) && !isNaN(max)) {
                const result = (Math.floor(Math.random() * (max - min + 1)) + min).toString();
                if (this.debug) {
                    console.log(chalk.blue(`[DEBUG RANDOM] ${chalk.yellow(min)}-${chalk.yellow(max)} → ${chalk.green(result)}`));
                }
                return result;
            }
        }
        return '0';
    }

    handleUpper(args) {
        let text = this.evaluateNestedFunctions(args);
        text = this.replaceVariables(text);
        text = cleanQuotes(text);
        const result = text.toUpperCase();
        if (this.debug) {
            console.log(chalk.blue(`[DEBUG UPPER] ${chalk.yellow(text)} → ${chalk.green(result)}`));
        }
        return result;
    }

handleEqualsIgnoreCase(args) {
    let evaluatedArgs = this.evaluateNestedFunctions(args);
    evaluatedArgs = this.replaceVariables(evaluatedArgs);
    evaluatedArgs = cleanQuotes(evaluatedArgs);
    const parts = splitArgs(evaluatedArgs);
    
    if (parts.length >= 2) {
        const str1 = cleanQuotes(parts[0]);
        const str2 = cleanQuotes(parts[1]);
        const result = str1.toLowerCase() === str2.toLowerCase();
        
        if (this.debug) {
            console.log(chalk.blue(`[DEBUG EQUALS_IGNORE_CASE] "${chalk.yellow(str1)}" == "${chalk.yellow(str2)}" → ${chalk.green(result)}`));
        }
        
        return result;
    }
    return false;
}

    handleLower(args) {
        let text = this.evaluateNestedFunctions(args);
        text = this.replaceVariables(text);
        text = cleanQuotes(text);
        const result = text.toLowerCase();
        if (this.debug) {
            console.log(chalk.blue(`[DEBUG LOWER] ${chalk.yellow(text)} → ${chalk.green(result)}`));
        }
        return result;
    }

    handleTrim(args) {
        let text = this.evaluateNestedFunctions(args);
        text = this.replaceVariables(text);
        text = cleanQuotes(text);
        const result = text.trim();
        if (this.debug) {
            console.log(chalk.blue(`[DEBUG TRIM] ${chalk.yellow('"' + text + '"')} → ${chalk.green('"' + result + '"')}`));
        }
        return result;
    }

    handleAdd(args) {
        let evaluatedArgs = this.evaluateNestedFunctions(args);
        evaluatedArgs = this.replaceVariables(evaluatedArgs);
        evaluatedArgs = cleanQuotes(evaluatedArgs);
        const parts = splitArgs(evaluatedArgs);
        if (parts.length >= 2) {
            const a = parseFloat(cleanQuotes(parts[0]));
            const b = parseFloat(cleanQuotes(parts[1]));
            if (!isNaN(a) && !isNaN(b)) {
                const result = (a + b).toString();
                if (this.debug) {
                    console.log(chalk.blue(`[DEBUG ADD] ${chalk.yellow(a)} + ${chalk.yellow(b)} = ${chalk.green(result)}`));
                }
                return result;
            }
        }
        return '0';
    }

    handleSub(args) {
        let evaluatedArgs = this.evaluateNestedFunctions(args);
        evaluatedArgs = this.replaceVariables(evaluatedArgs);
        evaluatedArgs = cleanQuotes(evaluatedArgs);
        const parts = splitArgs(evaluatedArgs);
        if (parts.length >= 2) {
            const a = parseFloat(cleanQuotes(parts[0]));
            const b = parseFloat(cleanQuotes(parts[1]));
            if (!isNaN(a) && !isNaN(b)) {
                const result = (a - b).toString();
                if (this.debug) {
                    console.log(chalk.blue(`[DEBUG SUB] ${chalk.yellow(a)} - ${chalk.yellow(b)} = ${chalk.green(result)}`));
                }
                return result;
            }
        }
        return '0';
    }

    handleMul(args) {
        let evaluatedArgs = this.evaluateNestedFunctions(args);
        evaluatedArgs = this.replaceVariables(evaluatedArgs);
        evaluatedArgs = cleanQuotes(evaluatedArgs);
        const parts = splitArgs(evaluatedArgs);
        if (parts.length >= 2) {
            const a = parseFloat(cleanQuotes(parts[0]));
            const b = parseFloat(cleanQuotes(parts[1]));
            if (!isNaN(a) && !isNaN(b)) {
                const result = (a * b).toString();
                if (this.debug) {
                    console.log(chalk.blue(`[DEBUG MUL] ${chalk.yellow(a)} * ${chalk.yellow(b)} = ${chalk.green(result)}`));
                }
                return result;
            }
        }
        return '0';
    }

    handleDiv(args) {
        let evaluatedArgs = this.evaluateNestedFunctions(args);
        evaluatedArgs = this.replaceVariables(evaluatedArgs);
        evaluatedArgs = cleanQuotes(evaluatedArgs);
        const parts = splitArgs(evaluatedArgs);
        if (parts.length >= 2) {
            const a = parseFloat(cleanQuotes(parts[0]));
            const b = parseFloat(cleanQuotes(parts[1]));
            if (!isNaN(a) && !isNaN(b) && b !== 0) {
                const result = (a / b).toString();
                if (this.debug) {
                    console.log(chalk.blue(`[DEBUG DIV] ${chalk.yellow(a)} / ${chalk.yellow(b)} = ${chalk.green(result)}`));
                }
                return result;
            }
        }
        return '0';
    }

    handleRound(args) {
        let evaluatedArgs = this.evaluateNestedFunctions(args);
        evaluatedArgs = this.replaceVariables(evaluatedArgs);
        evaluatedArgs = cleanQuotes(evaluatedArgs);
        const number = parseFloat(evaluatedArgs);
        if (!isNaN(number)) {
            const result = Math.round(number).toString();
            if (this.debug) {
                console.log(chalk.blue(`[DEBUG ROUND] ${chalk.yellow(number)} → ${chalk.green(result)}`));
            }
            return result;
        }
        return '0';
    }

    handleTime(args) {
        const timestamp = Date.now().toString();
        if (this.debug) {
            console.log(chalk.blue(`[DEBUG TIME] ${chalk.green(timestamp)}`));
        }
        return timestamp;
    }

    handleDate(args) {
        let format = this.evaluateNestedFunctions(args);
        format = this.replaceVariables(format);
        format = cleanQuotes(format) || 'YYYY-MM-DD';
        const now = new Date();
        
        let result = format;
        result = result.replace('YYYY', now.getFullYear());
        result = result.replace('MM', String(now.getMonth() + 1).padStart(2, '0'));
        result = result.replace('DD', String(now.getDate()).padStart(2, '0'));
        result = result.replace('HH', String(now.getHours()).padStart(2, '0'));
        result = result.replace('mm', String(now.getMinutes()).padStart(2, '0'));
        result = result.replace('ss', String(now.getSeconds()).padStart(2, '0'));
        
        if (this.debug) {
            console.log(chalk.blue(`[DEBUG DATE] ${chalk.yellow(format)} → ${chalk.green(result)}`));
        }
        return result;
    }

    evaluateNestedFunctions(text) {
        let result = text;
        
        let changed;
        let iterations = 0;
        const maxIterations = 10;
        
        do {
            changed = false;
            const functionMatch = result.match(/§(\w+)\[([^\[\]]*)\]/);
            
            if (functionMatch && iterations < maxIterations) {
                const fullMatch = functionMatch[0];
                const funcName = functionMatch[1];
                let funcArgs = functionMatch[2];
                
                if (this.functions[funcName]) {
                    funcArgs = cleanQuotes(funcArgs);
                    const functionResult = this.functions[funcName](funcArgs);
                    
                    if (functionResult !== undefined) {
                        result = result.replace(fullMatch, functionResult);
                        changed = true;
                        iterations++;
                    }
                }
            }
        } while (changed && iterations < maxIterations);
        
        return result;
    }

    evaluateCondition(condition) {
        try {
            let evaluatedCondition = this.evaluateNestedFunctions(condition);
            evaluatedCondition = this.replaceVariables(evaluatedCondition);
            
            const context = {};
            
            this.variables.forEach((value, key) => {
                const numValue = parseFloat(value);
                context[key] = isNaN(numValue) ? value : numValue;
            });
            
            const safeEval = (expr, context) => {
                const func = new Function(...Object.keys(context), `return ${expr}`);
                return func(...Object.values(context));
            };
            
            const result = safeEval(evaluatedCondition, context);
            
            if (this.debug) {
                const color = result ? chalk.green : chalk.red;
                console.log(chalk.blue(`[DEBUG CONDITION] ${chalk.yellow(condition)} → ${color(result)}`));
            }
            
            return Boolean(result);
            
        } catch (error) {
            if (this.debug) {
                console.log(chalk.red(`[DEBUG CONDITION ERROR] ${chalk.yellow(condition)}: ${error.message}`));
            }
            return false;
        }
    }

    isMathExpression(expr) {
        return /[\+\-\*\/\(\)]/.test(expr) && !expr.includes('§');
    }

    evaluateMathExpression(expr) {
        try {
            let evaluatedExpr = this.replaceVariables(expr);
            evaluatedExpr = evaluatedExpr.replace(/[^0-9+\-*/().]/g, '');
            const result = eval(evaluatedExpr);
            if (this.debug) {
                console.log(chalk.blue(`[DEBUG MATH] ${chalk.yellow(expr)} → ${chalk.green(result)}`));
            }
            return result;
        } catch (error) {
            if (this.debug) {
                console.log(chalk.red(`[DEBUG MATH ERROR] ${chalk.yellow(expr)}: ${error.message}`));
            }
            return 0;
        }
    }

    replaceVariables(text) {
        let result = text;
        const sortedVars = Array.from(this.variables.entries()).sort((a, b) => b[0].length - a[0].length);
        
        for (const [key, value] of sortedVars) {
            const regex = new RegExp(`\\$${key}`, 'g');
            result = result.replace(regex, value);
        }
        return result;
    }
}

module.exports = EliosInterpreter;