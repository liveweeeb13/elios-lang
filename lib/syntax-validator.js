/**
 * Elios Language Syntax Validator
 * Validates Elios code syntax without executing it
 */

class SyntaxValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Main validation function
   * @param {string} code - The Elios code to validate
   * @returns {Object} - { isValid: boolean, errors: Array, warnings: Array }
   */
  validate(code) {
    this.errors = [];
    this.warnings = [];

    if (!code || typeof code !== 'string') {
      this.errors.push('Code must be a non-empty string');
      return this.getResult();
    }

    const lines = code.split('\n');

    // Validate each line
    lines.forEach((line, index) => {
      this.validateLine(line, index + 1);
    });

    // Check for block matching (if/while/etc)
    this.validateBlockMatching(code);

    // Check for require directives
    this.validateRequires(code);

    return this.getResult();
  }

  /**
   * Validate individual line syntax
   */
  validateLine(line, lineNum) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }

    // Validate all function calls: §func[args]
    this.validateFunctionCalls(trimmed, lineNum);

    // Check for unmatched brackets in general
    this.checkBracketBalance(trimmed, lineNum);

    // Check for valid variable references
    this.validateVariableReferences(trimmed, lineNum);

    // Warn about potential issues
    this.checkForWarnings(trimmed, lineNum);
  }

  /**
   * Validate function calls syntax
   */
  validateFunctionCalls(line, lineNum) {
    // Pattern to match §func[...content...]
    const functionPattern = /§([a-zA-Z_]\w*)\[/g;
    let match;

    while ((match = functionPattern.exec(line)) !== null) {
      const functionName = match[1];
      const startPos = match.index;

      // Find the matching closing bracket for this function
      let bracketCount = 0;
      let foundOpening = false;
      let foundClosing = false;

      for (let i = startPos + 1; i < line.length; i++) {
        const char = line[i];

        if (char === '[' && !foundOpening) {
          foundOpening = true;
          bracketCount = 1;
          continue;
        }

        if (foundOpening) {
          if (char === '[') bracketCount++;
          if (char === ']') {
            bracketCount--;
            if (bracketCount === 0) {
              foundClosing = true;
              break;
            }
          }
        }
      }

      if (!foundClosing) {
        this.errors.push(
          `Line ${lineNum}: Missing closing bracket ']' for function '§${functionName}'`
        );
      }
    }

    // Check for invalid function names (space, special chars)
    const invalidFuncPattern = /§([^a-zA-Z_[\]]+)/g;
    let invalidMatch;
    while ((invalidMatch = invalidFuncPattern.exec(line)) !== null) {
      if (invalidMatch[1] && !invalidMatch[1].startsWith('[')) {
        this.errors.push(
          `Line ${lineNum}: Invalid function name '§${invalidMatch[1]}' - names must start with letter or underscore`
        );
      }
    }
  }

  /**
   * Validate bracket/parenthesis balance
   */
  checkBracketBalance(line, lineNum) {
    const brackets = { '[': ']', '(': ')', '{': '}' };
    const stack = [];

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (brackets[char]) {
        stack.push({ char, index: i });
      } else if (Object.values(brackets).includes(char)) {
        if (stack.length === 0) {
          this.errors.push(
            `Line ${lineNum}: Closing '${char}' without opening bracket at position ${i}`
          );
        } else {
          const last = stack[stack.length - 1];
          if (brackets[last.char] !== char) {
            this.errors.push(
              `Line ${lineNum}: Mismatched brackets '${last.char}' and '${char}'`
            );
          }
          stack.pop();
        }
      }
    }

    if (stack.length > 0) {
      stack.forEach((item) => {
        this.errors.push(
          `Line ${lineNum}: Unclosed bracket '${item.char}' at position ${item.index}`
        );
      });
    }
  }

  /**
   * Validate variable references ($VAR_NAME)
   */
  validateVariableReferences(line, lineNum) {
    const varPattern = /\$[\w]+/g;
    const matches = line.match(varPattern);

    if (matches) {
      matches.forEach((varRef) => {
        // Check if it's a valid variable name (alphanumeric + underscore)
        if (!varRef.match(/^\$[a-zA-Z_]\w*$/)) {
          this.errors.push(
            `Line ${lineNum}: Invalid variable name '${varRef}'`
          );
        }
      });
    }
  }

  /**
   * Validate control block matching (if/endif, while/endwhile)
   */
  validateBlockMatching(code) {
    const lines = code.split('\n');
    const ifStack = [];
    const whileStack = [];

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) {
        return;
      }

      // Check for if blocks
      if (trimmed.match(/§if\[/)) {
        ifStack.push(index + 1);
      }
      if (trimmed.match(/§endif/)) {
        if (ifStack.length === 0) {
          this.errors.push(
            `Line ${index + 1}: §endif without matching §if`
          );
        } else {
          ifStack.pop();
        }
      }

      // Check for while blocks
      if (trimmed.match(/§while\[/)) {
        whileStack.push(index + 1);
      }
      if (trimmed.match(/§endwhile/)) {
        if (whileStack.length === 0) {
          this.errors.push(
            `Line ${index + 1}: §endwhile without matching §while`
          );
        } else {
          whileStack.pop();
        }
      }

      // Check for func blocks
      if (trimmed.match(/§func\[/)) {
        // Function syntax validation
        if (!trimmed.match(/§func\[[^\]]+\]\s*\[\s*$/)) {
          // This is a simplified check
        }
      }
    });

    // Report unclosed blocks
    if (ifStack.length > 0) {
      ifStack.forEach((lineNum) => {
        this.errors.push(`Line ${lineNum}: §if without matching §endif`);
      });
    }

    if (whileStack.length > 0) {
      whileStack.forEach((lineNum) => {
        this.errors.push(`Line ${lineNum}: §while without matching §endwhile`);
      });
    }
  }

  /**
   * Validate require directives
   */
  validateRequires(code) {
    const requirePattern = /§require\[([^\]]+)\]/g;
    let match;

    while ((match = requirePattern.exec(code)) !== null) {
      const path = match[1];

      // Check if path is not empty
      if (!path || path.trim() === '') {
        this.errors.push(
          `Invalid §require: Path cannot be empty. Found: §require[]`
        );
      }

      // Warn about absolute paths (informational)
      if (path.includes(':') || path.startsWith('/')) {
        this.warnings.push(
          `§require uses absolute path: '${path}'. Consider using relative paths.`
        );
      }
    }
  }

  /**
   * Check for common issues and generate warnings
   */
  checkForWarnings(line, lineNum) {
    // Warn about suspicious spacing
    if (line.match(/§\s+\w+\[/)) {
      this.errors.push(
        `Line ${lineNum}: Space between § and function name is not allowed`
      );
    }

    // Warn about missing semicolons in argument lists (common mistake)
    if (line.match(/§\w+\[[^;]*,[^;]*\]/)) {
      this.warnings.push(
        `Line ${lineNum}: Using commas in arguments instead of semicolons. Did you mean to use ';'?`
      );
    }

    // Info about variable references
    const varMatches = line.match(/\$[a-zA-Z_]\w*/g);
    if (varMatches && varMatches.length > 0) {
      // This is fine, just informational
    }
  }

  /**
   * Get validation result
   */
  getResult() {
    return {
      isValid: this.errors.length === 0,
      errorCount: this.errors.length,
      warningCount: this.warnings.length,
      errors: this.errors,
      warnings: this.warnings,
    };
  }

  /**
   * Pretty print validation results
   */
  printResults(result) {
    console.log('\n╔══════════════════════════════════════╗');
    console.log('║       ELIOS SYNTAX VALIDATION         ║');
    console.log('╚══════════════════════════════════════╝\n');

    if (result.isValid) {
      console.log('✅ Code is valid!\n');
    } else {
      console.log(`❌ Found ${result.errorCount} error(s):\n`);
      result.errors.forEach((error) => {
        console.log(`  • ${error}`);
      });
      console.log();
    }

    if (result.warnings.length > 0) {
      console.log(`⚠️  ${result.warningCount} warning(s):\n`);
      result.warnings.forEach((warning) => {
        console.log(`  • ${warning}`);
      });
      console.log();
    }
  }
}

module.exports = SyntaxValidator;
