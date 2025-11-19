const chalk = require('chalk');
const { splitArgs, cleanQuotes } = require('./utils');

module.exports = {
    handleInput(args) {
        const prompt = this.replaceVariables(args) || '';
        const cleanedPrompt = cleanQuotes(prompt);

        if (this.debug) {
            console.log(chalk.blue(`[DEBUG INPUT] Prompt: "${cleanedPrompt}"`));
        }

        process.stdout.write(cleanedPrompt + ' ');

        try {
            const fs = require('fs');
            const buffer = Buffer.alloc(1024);
            const bytesRead = fs.readSync(0, buffer, 0, buffer.length);
            const input = buffer.toString('utf8', 0, bytesRead - 1);

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
    },

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
    },

    handleExit(args) {
        const exitCode = parseInt(this.replaceVariables(args)) || 0;

        if (this.debug) {
            console.log(chalk.blue(`[DEBUG EXIT] Exiting with code: ${chalk.yellow(exitCode)}`));
        }

        this.shouldExit = true;
        this.exitCode = exitCode;

        return exitCode.toString();
    },

    handleLog(args) {
        let text = this.evaluateNestedFunctions(args);
        text = this.replaceVariables(text);
        text = cleanQuotes(text);
        console.log(text);
    },

    async handleSleep(args) {
        const ms = parseInt(this.replaceVariables(args)) || 1000;
        if (this.debug) {
            console.log(chalk.blue(`[DEBUG SLEEP] Sleeping for ${chalk.yellow(ms)}ms`));
        }

        return new Promise(resolve => {
            setTimeout(resolve, ms);
        });
    },

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
        else {
            console.error(chalk.red(`[ERROR VAR] Invalid §var syntax: expected §var[name; value], got: §var[${args}]`));
            if (this.debug) console.log(chalk.blue(`[DEBUG VAR] Provided args: ${args}`));
        }
    },

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
    },

    handleUpper(args) {
        let text = this.evaluateNestedFunctions(args);
        text = this.replaceVariables(text);
        text = cleanQuotes(text);
        const result = text.toUpperCase();
        if (this.debug) {
            console.log(chalk.blue(`[DEBUG UPPER] ${chalk.yellow(text)} → ${chalk.green(result)}`));
        }
        return result;
    },

    handleLen(args) {
        let text = this.evaluateNestedFunctions(args);
        text = this.replaceVariables(text);
        text = cleanQuotes(text);

        if (text === '') {
            if (this.debug) console.log(chalk.blue(`[DEBUG LEN] empty → ${chalk.green(0)}`));
            return '0';
        }

        if (text.includes(';')) {
            const count = text === '' ? 0 : text.split(';').length;
            if (this.debug) console.log(chalk.blue(`[DEBUG LEN] ${chalk.yellow(text)} → ${chalk.green(count)}`));
            return count.toString();
        }

        const len = text.length;
        if (this.debug) console.log(chalk.blue(`[DEBUG LEN] ${chalk.yellow(text)} → ${chalk.green(len)}`));
        return len.toString();
    },

    handleContains(args) {
        let evaluatedArgs = this.evaluateNestedFunctions(args);
        evaluatedArgs = this.replaceVariables(evaluatedArgs);
        evaluatedArgs = cleanQuotes(evaluatedArgs);
        const parts = splitArgs(evaluatedArgs);

        if (parts.length >= 2) {
            const hay = cleanQuotes(parts[0]);
            const needle = cleanQuotes(parts[1]);
            const result = hay.includes(needle);
            if (this.debug) {
                console.log(chalk.blue(`[DEBUG CONTAINS] "${chalk.yellow(hay)}" contains "${chalk.yellow(needle)}" → ${chalk.green(result)}`));
            }
            return result;
        }

        return false;
    },

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
    },

    handleLower(args) {
        let text = this.evaluateNestedFunctions(args);
        text = this.replaceVariables(text);
        text = cleanQuotes(text);
        const result = text.toLowerCase();
        if (this.debug) {
            console.log(chalk.blue(`[DEBUG LOWER] ${chalk.yellow(text)} → ${chalk.green(result)}`));
        }
        return result;
    },

    handleTrim(args) {
        let text = this.evaluateNestedFunctions(args);
        text = this.replaceVariables(text);
        text = cleanQuotes(text);
        const result = text.replace(/\s+/g, '');
        if (this.debug) {
            console.log(chalk.blue(`[DEBUG TRIM] ${chalk.yellow('"' + text + '"')} → ${chalk.green('"' + result + '"')}`));
        }
        return result;
    },

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
            } else {
                console.error(chalk.red(`[ERROR ADD] Invalid numeric arguments: '${parts[0]}' and '${parts[1]}'`));
                if (this.debug) console.log(chalk.blue(`[DEBUG ADD] evaluatedArgs='${evaluatedArgs}'`));
                return '0';
            }
        }
        return '0';
    },

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
            } else {
                console.error(chalk.red(`[ERROR SUB] Invalid numeric arguments: '${parts[0]}' and '${parts[1]}'`));
                if (this.debug) console.log(chalk.blue(`[DEBUG SUB] evaluatedArgs='${evaluatedArgs}'`));
                return '0';
            }
        }
        return '0';
    },

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
            } else {
                console.error(chalk.red(`[ERROR MUL] Invalid numeric arguments: '${parts[0]}' and '${parts[1]}'`));
                if (this.debug) console.log(chalk.blue(`[DEBUG MUL] evaluatedArgs='${evaluatedArgs}'`));
                return '0';
            }
        }
        return '0';
    },

    handleDiv(args) {
        let evaluatedArgs = this.evaluateNestedFunctions(args);
        evaluatedArgs = this.replaceVariables(evaluatedArgs);
        evaluatedArgs = cleanQuotes(evaluatedArgs);
        const parts = splitArgs(evaluatedArgs);
        if (parts.length >= 2) {
            const a = parseFloat(cleanQuotes(parts[0]));
            const b = parseFloat(cleanQuotes(parts[1]));
            if (isNaN(a) || isNaN(b)) {
                console.error(chalk.red(`[ERROR DIV] Invalid numeric arguments: '${parts[0]}' and '${parts[1]}'`));
                if (this.debug) console.log(chalk.blue(`[DEBUG DIV] evaluatedArgs='${evaluatedArgs}'`));
                return '0';
            }

            if (b === 0) {
                console.error(chalk.red(`[ERROR DIV] Division by zero: ${a} / ${b}`));
                return '0';
            }

            const result = (a / b).toString();
            if (this.debug) {
                console.log(chalk.blue(`[DEBUG DIV] ${chalk.yellow(a)} / ${chalk.yellow(b)} = ${chalk.green(result)}`));
            }
            return result;
        }
        return '0';
    },

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
    },

    handleTime(args) {
        const timestamp = Date.now().toString();
        if (this.debug) {
            console.log(chalk.blue(`[DEBUG TIME] ${chalk.green(timestamp)}`));
        }
        return timestamp;
    },

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
    },

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
    },

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
    },

    isMathExpression(expr) {
        return /[\+\-\*\/\(\)]/.test(expr) && !expr.includes('§');
    },

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
    },

    escapeRegex(text) {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    },

    replaceVariables(text) {
        let result = text;
        const entries = Array.from(this.variables.entries()).sort((a, b) => b[0].length - a[0].length);

        if (entries.length === 0) return result;

        const keys = entries.map(([k]) => this.escapeRegex(k));
        const combined = new RegExp('\\$(' + keys.join('|') + ')', 'g');

        result = result.replace(combined, (match, p1) => {
            const value = this.variables.get(p1);
            return value !== undefined ? value : match;
        });

        return result;
    }
};
