/**
 * Example Plugin: Custom Greeting
 * A simple, complete example plugin showing how to create your own addons
 * 
 * This plugin demonstrates:
 * - Simple single-argument functions
 * - Multi-argument functions
 * - Error handling
 * - Debug logging
 * - Access to interpreter context
 */

const chalk = require('chalk');

module.exports = {
    // Plugin metadata
    name: 'example-plugin',
    version: '1.0.0',
    description: 'Example plugin with greeting and custom add functions',
    author: 'Elios Community',

    // Function implementations
    functions: {
        /**
         * Simple greeting function
         * Usage: §greet[Alice] → "Hello Alice!"
         */
        greet(args) {
            let evaluatedArgs = this.evaluateNestedFunctions(args);
            evaluatedArgs = this.replaceVariables(evaluatedArgs);
            const { cleanQuotes } = require('../lib/utils');
            const name = cleanQuotes(evaluatedArgs);
            
            const result = `Hello ${name}!`;
            
            if (this.debug) {
                console.log(chalk.blue(`[DEBUG GREET] "${name}" → "${result}"`));
            }
            
            return result;
        },

        /**
         * Count properties in a JSON object
         * Usage: §countProperties[{"a":"1","b":"2","c":"3"}] → "3"
         */
        countProperties(args) {
            const { cleanQuotes } = require('../lib/utils');
            
            let evaluatedArgs = this.evaluateNestedFunctions(args);
            evaluatedArgs = this.replaceVariables(evaluatedArgs);
            evaluatedArgs = cleanQuotes(evaluatedArgs);
            
            try {
                const obj = JSON.parse(evaluatedArgs);
                const count = Object.keys(obj).length;
                
                if (this.debug) {
                    console.log(chalk.blue(`[DEBUG COUNTPROPS] Object has ${count} properties`));
                }
                
                return String(count);
            } catch (error) {
                if (this.debug) {
                    console.log(chalk.red(`[DEBUG COUNTPROPS] Invalid JSON: ${error.message}`));
                }
                return '0';
            }
        }
    }
};
