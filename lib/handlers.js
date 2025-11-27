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
    },

    handleIsNaN(args) {
    let evaluatedArgs = this.evaluateNestedFunctions(args);
    evaluatedArgs = this.replaceVariables(evaluatedArgs);
    evaluatedArgs = cleanQuotes(evaluatedArgs);
    
    // Vérifie si ce n'est PAS un nombre (isNaN = true si ce n'est pas un nombre)
    const isNotANumber = isNaN(evaluatedArgs) || evaluatedArgs.trim() === '';
    
    if (this.debug) {
        console.log(chalk.blue(`[DEBUG IS_NAN] "${chalk.yellow(evaluatedArgs)}" → ${chalk.green(isNotANumber)}`));
    }
    
    return isNotANumber;
},


    handleIsText(args) {
        return this.handleIsNaN(args);
    },

    handleBreak(args) {
        if (this.debug) {
            console.log(chalk.blue(`[DEBUG BREAK] Breaking out of loop`));
        }
        this.shouldBreak = true;
        return '';
    },

    handleContinue(args) {
        if (this.debug) {
            console.log(chalk.blue(`[DEBUG CONTINUE] Continuing to next iteration`));
        }
        this.shouldContinue = true;
        return '';
    },

    handleIsEven(args) {
    let evaluatedArgs = this.evaluateNestedFunctions(args);
    evaluatedArgs = this.replaceVariables(evaluatedArgs);
    evaluatedArgs = cleanQuotes(evaluatedArgs);
    
    // Convertir en nombre
    const number = parseFloat(evaluatedArgs);
    
    // Vérifier si c'est un nombre valide et pair
    const isEven = !isNaN(number) && number % 2 === 0;
    
    if (this.debug) {
        console.log(chalk.blue(`[DEBUG IS_EVEN] "${chalk.yellow(evaluatedArgs)}" → ${chalk.green(isEven)}`));
    }
    
    return isEven;
},

    handleIsOdd(args) {
    let evaluatedArgs = this.evaluateNestedFunctions(args);
    evaluatedArgs = this.replaceVariables(evaluatedArgs);
    evaluatedArgs = cleanQuotes(evaluatedArgs);
    
    // Convertir en nombre
    const number = parseFloat(evaluatedArgs);
    
    // Vérifier si c'est un nombre valide et impair
    const isOdd = !isNaN(number) && number % 2 !== 0;
    
    if (this.debug) {
        console.log(chalk.blue(`[DEBUG IS_ODD] "${chalk.yellow(evaluatedArgs)}" → ${chalk.green(isOdd)}`));
    }
    
    return isOdd;
},  

handleIsFileExist(args) {
    let evaluatedArgs = this.evaluateNestedFunctions(args);
    evaluatedArgs = this.replaceVariables(evaluatedArgs);
    evaluatedArgs = cleanQuotes(evaluatedArgs);
    
    try {
        const fs = require('fs');
        const exists = fs.existsSync(evaluatedArgs);
        
        if (this.debug) {
            console.log(chalk.blue(`[DEBUG IS_FILE_EXIST] "${chalk.yellow(evaluatedArgs)}" → ${chalk.green(exists)}`));
        }
        
        return exists;
    } catch (error) {
        if (this.debug) {
            console.log(chalk.red(`[DEBUG IS_FILE_EXIST ERROR] ${error.message}`));
        }
        return false;
    }
},

handleCreateFile(args) {
    let evaluatedArgs = this.evaluateNestedFunctions(args);
    evaluatedArgs = this.replaceVariables(evaluatedArgs);
    evaluatedArgs = cleanQuotes(evaluatedArgs);
    
    try {
        const fs = require('fs');
        const path = require('path');
        
        // Créer le dossier parent si nécessaire
        const dir = path.dirname(evaluatedArgs);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        // Créer le fichier vide
        fs.writeFileSync(evaluatedArgs, '');
        
        if (this.debug) {
            console.log(chalk.blue(`[DEBUG CREATE_FILE] Created: "${chalk.yellow(evaluatedArgs)}"`));
        }
        
        return true;
    } catch (error) {
        if (this.debug) {
            console.log(chalk.red(`[DEBUG CREATE_FILE ERROR] ${error.message}`));
        }
        return false;
    }
},

handleGetPath(args) {
    let evaluatedArgs = this.evaluateNestedFunctions(args);
    evaluatedArgs = this.replaceVariables(evaluatedArgs);
    evaluatedArgs = cleanQuotes(evaluatedArgs);
    
    try {
        const path = require('path');
        const currentDir = process.cwd();
        
        let result;
        if (evaluatedArgs) {
            result = path.resolve(currentDir, evaluatedArgs);
        } else {
            result = currentDir;
        }
        
        if (this.debug) {
            console.log(chalk.blue(`[DEBUG GET_PATH] "${chalk.yellow(evaluatedArgs)}" → "${chalk.green(result)}"`));
        }
        
        return result;
    } catch (error) {
        if (this.debug) {
            console.log(chalk.red(`[DEBUG GET_PATH ERROR] ${error.message}`));
        }
        return '';
    }
},

handleReadFile(args) {
    let evaluatedArgs = this.evaluateNestedFunctions(args);
    evaluatedArgs = this.replaceVariables(evaluatedArgs);
    evaluatedArgs = cleanQuotes(evaluatedArgs);
    
    try {
        const fs = require('fs');
        
        if (!fs.existsSync(evaluatedArgs)) {
            if (this.debug) {
                console.log(chalk.red(`[DEBUG READ_FILE] File not found: "${chalk.yellow(evaluatedArgs)}"`));
            }
            return '';
        }
        
        const content = fs.readFileSync(evaluatedArgs, 'utf8');
        
        if (this.debug) {
            console.log(chalk.blue(`[DEBUG READ_FILE] Read ${chalk.yellow(content.length)} chars from "${chalk.yellow(evaluatedArgs)}"`));
        }
        
        return content;
    } catch (error) {
        if (this.debug) {
            console.log(chalk.red(`[DEBUG READ_FILE ERROR] ${error.message}`));
        }
        return '';
    }
},

handleReplace(args) {
    let evaluatedArgs = this.evaluateNestedFunctions(args);
    evaluatedArgs = this.replaceVariables(evaluatedArgs);
    evaluatedArgs = cleanQuotes(evaluatedArgs);
    
    const parts = splitArgs(evaluatedArgs);
    if (parts.length >= 3) {
        const text = cleanQuotes(parts[0]);
        const search = cleanQuotes(parts[1]);
        const replaceWith = cleanQuotes(parts[2]);
        
        const result = text.split(search).join(replaceWith);
        
        if (this.debug) {
            console.log(chalk.blue(`[DEBUG REPLACE] Replaced "${chalk.yellow(search)}" with "${chalk.yellow(replaceWith)}"`));
        }
        
        return result;
    }
    
    return evaluatedArgs;
},

handleWriteFile(args) {
    let evaluatedArgs = this.evaluateNestedFunctions(args);
    evaluatedArgs = this.replaceVariables(evaluatedArgs);
    evaluatedArgs = cleanQuotes(evaluatedArgs);
    
    const parts = splitArgs(evaluatedArgs);
    if (parts.length >= 2) {
        const filePath = cleanQuotes(parts[0]);
        let content = parts.slice(1).join(';');
        content = cleanQuotes(content);
        
        try {
            const fs = require('fs');
            const path = require('path');
            
            // Créer le dossier parent si nécessaire
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            fs.writeFileSync(filePath, content, 'utf8');
            
            if (this.debug) {
                console.log(chalk.blue(`[DEBUG WRITE_FILE] Written ${chalk.yellow(content.length)} chars to "${chalk.yellow(filePath)}"`));
            }
            
            return true;
        } catch (error) {
            if (this.debug) {
                console.log(chalk.red(`[DEBUG WRITE_FILE ERROR] ${error.message}`));
            }
            return false;
        }
    }
    
    return false;
},

handleJsonRead(args) {
    let evaluatedArgs = this.evaluateNestedFunctions(args);
    evaluatedArgs = this.replaceVariables(evaluatedArgs);
    evaluatedArgs = cleanQuotes(evaluatedArgs);
    
    try {
        const fs = require('fs');
        
        if (!fs.existsSync(evaluatedArgs)) {
            if (this.debug) {
                console.log(chalk.red(`[DEBUG JSON_READ] File not found: "${chalk.yellow(evaluatedArgs)}"`));
            }
            return '{}';
        }
        
        const content = fs.readFileSync(evaluatedArgs, 'utf8');
        const jsonData = JSON.parse(content);
        
        if (this.debug) {
            console.log(chalk.blue(`[DEBUG JSON_READ] Read JSON from "${chalk.yellow(evaluatedArgs)}"`));
        }
        
        return JSON.stringify(jsonData);
    } catch (error) {
        if (this.debug) {
            console.log(chalk.red(`[DEBUG JSON_READ ERROR] ${error.message}`));
        }
        return '{}';
    }
},

handleJsonWrite(args) {
    let evaluatedArgs = this.evaluateNestedFunctions(args);
    evaluatedArgs = this.replaceVariables(evaluatedArgs);
    evaluatedArgs = cleanQuotes(evaluatedArgs);
    
    const parts = splitArgs(evaluatedArgs);
    if (parts.length >= 2) {
        const filePath = cleanQuotes(parts[0]);
        let jsonContent = parts.slice(1).join(';');
        jsonContent = cleanQuotes(jsonContent);
        
        try {
            const fs = require('fs');
            const path = require('path');
            
            // Parser pour valider le JSON
            const jsonData = JSON.parse(jsonContent);
            
            // Créer le dossier parent si nécessaire
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2), 'utf8');
            
            if (this.debug) {
                console.log(chalk.blue(`[DEBUG JSON_WRITE] Written JSON to "${chalk.yellow(filePath)}"`));
            }
            
            return true;
        } catch (error) {
            if (this.debug) {
                console.log(chalk.red(`[DEBUG JSON_WRITE ERROR] ${error.message}`));
            }
            return false;
        }
    }
    
    return false;
},

handleJsonGet(args) {
    let evaluatedArgs = this.evaluateNestedFunctions(args);
    evaluatedArgs = this.replaceVariables(evaluatedArgs);
    evaluatedArgs = cleanQuotes(evaluatedArgs);
    
    const parts = splitArgs(evaluatedArgs);
    if (parts.length >= 2) {
        const jsonString = cleanQuotes(parts[0]);
        const keyPath = cleanQuotes(parts[1]);
        
        try {
            const jsonData = JSON.parse(jsonString);
            
            // Gestion des chemins nested (ex: "settings.theme")
            const keys = keyPath.split('.');
            let value = jsonData;
            
            for (const key of keys) {
                if (value && typeof value === 'object' && key in value) {
                    value = value[key];
                } else {
                    value = undefined;
                    break;
                }
            }
            
            // Convertir les objets en JSON string
            let result;
            if (value === undefined) {
                result = '';
            } else if (typeof value === 'object') {
                result = JSON.stringify(value);
            } else {
                result = String(value);
            }
            
            if (this.debug) {
                console.log(chalk.blue(`[DEBUG JSON_GET] "${chalk.yellow(keyPath)}" → "${chalk.yellow(result)}"`));
            }
            
            return result;
        } catch (error) {
            if (this.debug) {
                console.log(chalk.red(`[DEBUG JSON_GET ERROR] ${error.message}`));
            }
            return '';
        }
    }
    
    return '';
},

handleJsonSet(args) {
    let evaluatedArgs = this.evaluateNestedFunctions(args);
    evaluatedArgs = this.replaceVariables(evaluatedArgs);
    evaluatedArgs = cleanQuotes(evaluatedArgs);
    
    const parts = splitArgs(evaluatedArgs);
    if (parts.length >= 3) {
        const jsonString = cleanQuotes(parts[0]);
        const keyPath = cleanQuotes(parts[1]);
        let value = cleanQuotes(parts[2]);
        
        try {
            const jsonData = jsonString ? JSON.parse(jsonString) : {};
            
            // Conversion intelligente des types
            let finalValue;
            if (value === 'true') finalValue = true;
            else if (value === 'false') finalValue = false;
            else if (value === 'null') finalValue = null;
            else if (!isNaN(value) && value.trim() !== '') finalValue = parseFloat(value);
            else finalValue = value; // Garde comme string
            
            // Gestion des chemins nested
            const keys = keyPath.split('.');
            let current = jsonData;
            
            for (let i = 0; i < keys.length - 1; i++) {
                const key = keys[i];
                if (!(key in current) || typeof current[key] !== 'object') {
                    current[key] = {};
                }
                current = current[key];
            }
            
            // Définir la valeur sur la dernière clé
            current[keys[keys.length - 1]] = finalValue;
            
            const result = JSON.stringify(jsonData);
            
            if (this.debug) {
                console.log(chalk.blue(`[DEBUG JSON_SET] Set "${chalk.yellow(keyPath)}" = "${chalk.yellow(value)}" (type: ${typeof finalValue})`));
            }
            
            return result;
        } catch (error) {
            if (this.debug) {
                console.log(chalk.red(`[DEBUG JSON_SET ERROR] ${error.message}`));
            }
            return jsonString;
        }
    }
    
    return evaluatedArgs;
},

    // Type-checking functions
    handleIsNumeric(args) {
        let evaluatedArgs = this.evaluateNestedFunctions(args);
        evaluatedArgs = this.replaceVariables(evaluatedArgs);
        evaluatedArgs = cleanQuotes(evaluatedArgs);
        const num = parseFloat(evaluatedArgs);
        const result = !isNaN(num) && evaluatedArgs.trim() !== '';
        if (this.debug) {
            console.log(chalk.blue(`[DEBUG ISNUMERIC] "${evaluatedArgs}" → ${result}`));
        }
        return result ? 'true' : 'false';
    },

    handleIsText(args) {
        let evaluatedArgs = this.evaluateNestedFunctions(args);
        evaluatedArgs = this.replaceVariables(evaluatedArgs);
        evaluatedArgs = cleanQuotes(evaluatedArgs);
        // Text is true if it's not numeric and has length > 0
        const isNum = !isNaN(parseFloat(evaluatedArgs)) && evaluatedArgs.trim() !== '';
        const result = !isNum && evaluatedArgs.length > 0;
        if (this.debug) {
            console.log(chalk.blue(`[DEBUG ISTEXT] "${evaluatedArgs}" → ${result}`));
        }
        return result ? 'true' : 'false';
    },

    handleIsBool(args) {
        let evaluatedArgs = this.evaluateNestedFunctions(args);
        evaluatedArgs = this.replaceVariables(evaluatedArgs);
        evaluatedArgs = cleanQuotes(evaluatedArgs).toLowerCase();
        const result = evaluatedArgs === 'true' || evaluatedArgs === 'false';
        if (this.debug) {
            console.log(chalk.blue(`[DEBUG ISBOOL] "${evaluatedArgs}" → ${result}`));
        }
        return result ? 'true' : 'false';
    },

    handleIsInt(args) {
        let evaluatedArgs = this.evaluateNestedFunctions(args);
        evaluatedArgs = this.replaceVariables(evaluatedArgs);
        evaluatedArgs = cleanQuotes(evaluatedArgs);
        const num = parseFloat(evaluatedArgs);
        const result = !isNaN(num) && Number.isInteger(num);
        if (this.debug) {
            console.log(chalk.blue(`[DEBUG ISINT] "${evaluatedArgs}" → ${result}`));
        }
        return result ? 'true' : 'false';
    },

    handleIsFloat(args) {
        let evaluatedArgs = this.evaluateNestedFunctions(args);
        evaluatedArgs = this.replaceVariables(evaluatedArgs);
        evaluatedArgs = cleanQuotes(evaluatedArgs);
        const num = parseFloat(evaluatedArgs);
        const result = !isNaN(num) && !Number.isInteger(num);
        if (this.debug) {
            console.log(chalk.blue(`[DEBUG ISFLOAT] "${evaluatedArgs}" → ${result}`));
        }
        return result ? 'true' : 'false';
    },

    handleIsJson(args) {
        let evaluatedArgs = this.evaluateNestedFunctions(args);
        evaluatedArgs = this.replaceVariables(evaluatedArgs);
        evaluatedArgs = cleanQuotes(evaluatedArgs);
        try {
            JSON.parse(evaluatedArgs);
            if (this.debug) {
                console.log(chalk.blue(`[DEBUG ISJSON] Valid JSON`));
            }
            return 'true';
        } catch (e) {
            if (this.debug) {
                console.log(chalk.blue(`[DEBUG ISJSON] Invalid JSON`));
            }
            return 'false';
        }
    },

    handleTypeOf(args) {
        let evaluatedArgs = this.evaluateNestedFunctions(args);
        evaluatedArgs = this.replaceVariables(evaluatedArgs);
        evaluatedArgs = cleanQuotes(evaluatedArgs);

        // Determine type
        let type = 'string';

        if (evaluatedArgs === 'true' || evaluatedArgs === 'false') {
            type = 'bool';
        } else if (evaluatedArgs.trim() === '') {
            type = 'empty';
        } else if (!isNaN(parseFloat(evaluatedArgs)) && evaluatedArgs.trim() !== '') {
            type = Number.isInteger(parseFloat(evaluatedArgs)) ? 'int' : 'float';
        } else {
            try {
                JSON.parse(evaluatedArgs);
                type = 'json';
            } catch (e) {
                type = 'string';
            }
        }

        if (this.debug) {
            console.log(chalk.blue(`[DEBUG TYPEOF] "${evaluatedArgs}" → ${type}`));
        }
        return type;
    },

    handleRequire(args) {
        // Note: §require is actually processed at compile-time via processRequires()
        // This handler is kept for backwards compatibility and direct calls
        let evaluatedArgs = this.evaluateNestedFunctions(args);
        evaluatedArgs = this.replaceVariables(evaluatedArgs);
        evaluatedArgs = cleanQuotes(evaluatedArgs);
        
        if (this.debug) {
            console.log(chalk.blue(`[DEBUG REQUIRE] Require called at runtime for: ${evaluatedArgs}`));
        }
        
        return 'true';
    },

};