#!/usr/bin/env node

/**
 * Elios Syntax Validator CLI
 * Usage: node tools/validate.js <file.elios>
 */

const fs = require('fs');
const path = require('path');
const SyntaxValidator = require('../lib/syntax-validator.js');

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Elios Syntax Validator');
    console.log('Usage: node validate.js <file.elios>');
    process.exit(0);
  }

  const filePath = args[0];

  // Resolve absolute path
  const absolutePath = path.resolve(filePath);

  // Check if file exists
  if (!fs.existsSync(absolutePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  // Read file
  let code;
  try {
    code = fs.readFileSync(absolutePath, 'utf-8');
  } catch (err) {
    console.error(`❌ Error reading file: ${err.message}`);
    process.exit(1);
  }

  // Validate
  const validator = new SyntaxValidator();
  const result = validator.validate(code);

  // Print results
  validator.printResults(result);

  // Exit with appropriate code
  process.exit(result.isValid ? 0 : 1);
}

main();
