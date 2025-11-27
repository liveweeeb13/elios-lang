#!/usr/bin/env node

/**
 * Elios Tokenizer CLI
 * Usage: node tools/tokenize.js <file.elios>
 */

const fs = require('fs');
const path = require('path');
const Tokenizer = require('../lib/tokenizer.js');

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Elios Tokenizer');
    console.log('Usage: node tokenize.js <file.elios>');
    process.exit(0);
  }

  const filePath = args[0];
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

  // Tokenize
  const tokenizer = new Tokenizer();
  const tokens = tokenizer.tokenize(code);

  // Print results
  tokenizer.printTokens(tokens);

  process.exit(0);
}

main();
