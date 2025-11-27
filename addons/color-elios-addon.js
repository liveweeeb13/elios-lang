const chalk = require('chalk');

module.exports = {
    name: 'color-utils',
    version: '1.0.0',
    description: 'Color formatting utilities',
    author: 'Your Name',

    functions: {
        red(args) {
            const { cleanQuotes } = require('../lib/utils');
            let text = this.evaluateNestedFunctions(args);
            text = this.replaceVariables(text);
            text = cleanQuotes(text);
            return chalk.red(text);
        },
        
        green(args) {
            const { cleanQuotes } = require('../lib/utils');
            let text = this.evaluateNestedFunctions(args);
            text = this.replaceVariables(text);
            text = cleanQuotes(text);
            return chalk.green(text);
        }
    }
};