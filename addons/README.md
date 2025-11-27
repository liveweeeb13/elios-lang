# Elios Lang Plugin System

## Overview

The plugin system allows you to extend Elios Lang with custom functions. Plugins are automatically discovered and loaded from this directory.

## File Naming Convention

All plugin files must follow the naming pattern: `*-elios-addon.js`

**Examples:**
- `my-math-elios-addon.js` ✓
- `string-helpers-elios-addon.js` ✓
- `custom-plugin-elios-addon.js` ✓
- `myplugin.js` ✗ (Wrong name)
- `addon-helper.js` ✗ (Wrong name)

## Creating Your First Plugin

### 1. Create a Plugin File

Create a file named `your-plugin-name-elios-addon.js` in this directory.

### 2. Implement the Plugin Structure

```javascript
module.exports = {
    // Required: Unique name for your plugin
    name: 'your-plugin-name',
    
    // Optional: Version (default: '1.0.0')
    version: '1.0.0',
    
    // Optional: Description
    description: 'What your plugin does',
    
    // Optional: Author name
    author: 'Your Name',

    // Required: Functions your plugin provides
    functions: {
        yourFunction(args) {
            // Implementation here
        }
    }
};
```

### 3. Implement Functions

Each function receives:
- `args` - The string arguments passed to the function
- `this` - Reference to the interpreter (has access to variables, utils, etc.)

```javascript
functions: {
    toUpper(args) {
        // Evaluate nested functions (e.g., §anotherFunc[...])
        let evaluated = this.evaluateNestedFunctions(args);
        
        // Replace variables (e.g., $variableName)
        evaluated = this.replaceVariables(evaluated);
        
        // Clean quotes if needed
        const { cleanQuotes } = require('../lib/utils');
        const cleaned = cleanQuotes(evaluated);
        
        // Process and return result
        const result = cleaned.toUpperCase();
        
        // Optional: Log for debugging
        if (this.debug) {
            const chalk = require('chalk');
            console.log(chalk.blue(`[DEBUG TOUPPER] "${cleaned}" → "${result}"`));
        }
        
        return result;
    }
}
```

### Create Your Own Plugin

Example: Create `color-utils-elios-addon.js`

```javascript
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
```

Then use it:
```elios
§log[§red[Error occurred]]
§log[§green[Success!]]
```

## Plugin API Reference

### Available in Plugin Context (this)

- `this.variables` - Map of all defined variables
- `this.evaluateNestedFunctions(str)` - Evaluate nested §function[] calls
- `this.replaceVariables(str)` - Replace $variable references
- `this.debug` - Boolean flag for debug mode

### Utilities Available

```javascript
// Import utilities
const { splitArgs, cleanQuotes } = require('../lib/utils');

// splitArgs - Split arguments by semicolon, respecting nested brackets
const parts = splitArgs('arg1;arg2;[1,2,3]');
// → ['arg1', 'arg2', '[1,2,3]']

// cleanQuotes - Remove surrounding quotes
const cleaned = cleanQuotes('"hello"');
// → 'hello'
```

### Chalk for Colored Output

For debug logging and colored output:

```javascript
const chalk = require('chalk');

if (this.debug) {
    console.log(chalk.blue('[DEBUG] Message'));
    console.log(chalk.green('[SUCCESS] Message'));
    console.log(chalk.red('[ERROR] Message'));
    console.log(chalk.yellow('[WARNING] Message'));
}
```

## Best Practices

1. **Always evaluate nested functions first**
   ```javascript
   let args = this.evaluateNestedFunctions(args);
   ```

2. **Replace variables before processing**
   ```javascript
   args = this.replaceVariables(args);
   ```

3. **Handle errors gracefully**
   ```javascript
   if (isNaN(num)) {
       console.warn('Expected a number');
       return args; // Return original if can't process
   }
   ```

4. **Include debug logging**
   ```javascript
   if (this.debug) {
       console.log(chalk.blue(`[DEBUG] Result: ${result}`));
   }
   ```

5. **Return strings from functions**
   ```javascript
   return String(result); // Always return string, not number
   ```

6. **Handle multiple arguments**
   ```javascript
   const { splitArgs } = require('../lib/utils');
   const parts = splitArgs(args); // ['arg1', 'arg2', ...]
   ```

## File Structure

```
addons/
├── string-utils-elios-addon.js      # Built-in plugin
├── list-utils-elios-addon.js        # Built-in plugin
├── math-plus-elios-addon.js         # Built-in plugin
├── example-plugin-elios-addon.js    # Example plugin
├── PLUGIN-TEMPLATE-elios-addon.js   # Template for new plugins
└── your-plugin-elios-addon.js       # Your custom plugin (add here)
```

## Testing Your Plugin

1. **Create a test script**

```elios
# test-my-plugin.elios
§log[Testing my plugin...]
§log[§myFunc[arg]]
§log[Test complete!]
```

2. **Run with debug mode**

```bash
elios test-my-plugin.elios --debug
```

You should see:
```
[PLUGIN] Found X addon(s)
[PLUGIN] ✓ Loaded: your-plugin-name vX.X.X
[PLUGIN] Registered: §myFunc[] from your-plugin-name
```

## Troubleshooting


### Function Not Found

**Problem:** Function appears to load but throws "undefined" error
- Make sure function is defined in the `functions` object
- Check property name matches exactly
- Verify function has correct syntax: `functionName(args) { }`

### Plugin Functions Return Wrong Type

**Problem:** Numbers returned as strings or vice versa
- Always return strings from plugin functions
- Use `String(number)` to convert
- This is required for Elios variable system

### Variable Access Issues

**Problem:** `$variableName` isn't being replaced
- Make sure you call `this.replaceVariables(args)` 
- Call it AFTER `this.evaluateNestedFunctions(args)`
- Variables map is in `this.variables`


## Contributing

Have a useful plugin? Share it with the community!

1. Test thoroughly
2. Include documentation in comments
3. Follow the code style of existing plugins
4. Make sure it works with debug mode

Happy plugin development!
