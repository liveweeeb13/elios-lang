const chalk = require('chalk');

function extractType1Functions(code) {
    const regex = /§(\w+)\[\]/g;
    const functions = [];
    let match;
    
    while ((match = regex.exec(code)) !== null) {
        functions.push(match[1]);
    }
    
    return [...new Set(functions)];
}

function extractType2Functions(code) {
    const regex = /§(\w+)\[([^\]]*)\]/g;
    const functions = new Map();
    let match;
    
    while ((match = regex.exec(code)) !== null) {
        const funcName = match[1];
        const args = match[2];
        
        if (!functions.has(funcName)) {
            functions.set(funcName, []);
        }
        functions.get(funcName).push(args);
    }
    
    return functions;
}

function splitArgs(args) {
    const parts = [];
    let current = '';
    let bracketCount = 0;
    let inQuotes = false;
    let quoteChar = '';
    
    for (let i = 0; i < args.length; i++) {
        const char = args[i];
        
        if ((char === '"' || char === "'") && !inQuotes) {
            inQuotes = true;
            quoteChar = char;
        } else if (char === quoteChar && inQuotes) {
            inQuotes = false;
        }
        
        if (!inQuotes) {
            if (char === '[') bracketCount++;
            if (char === ']') bracketCount--;
        }
        
        if (char === ';' && bracketCount === 0 && !inQuotes) {
            parts.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    
    if (current) parts.push(current);
    return parts;
}

function cleanQuotes(text) {
    let result = text.trim();
    if ((result.startsWith('"') && result.endsWith('"')) || 
        (result.startsWith("'") && result.endsWith("'"))) {
        result = result.slice(1, -1);
    }
    return result;
}

module.exports = {
    extractType1Functions,
    extractType2Functions,
    splitArgs,
    cleanQuotes
};