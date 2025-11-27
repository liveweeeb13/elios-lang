/**
 * Elios Language Tokenizer
 * Breaks Elios code into meaningful tokens
 */

class Token {
  constructor(type, value, line, column) {
    this.type = type;
    this.value = value;
    this.line = line;
    this.column = column;
  }

  toString() {
    return `Token(${this.type}, "${this.value}", L${this.line}:C${this.column})`;
  }
}

class Tokenizer {
  constructor() {
    this.tokens = [];
    this.line = 1;
    this.column = 1;
    this.position = 0;
    this.code = '';
  }

  /**
   * Main tokenization function
   */
  tokenize(code) {
    this.code = code;
    this.tokens = [];
    this.line = 1;
    this.column = 1;
    this.position = 0;

    while (this.position < this.code.length) {
      const char = this.code[this.position];

      // Skip whitespace (except newlines for tracking)
      if (char === ' ' || char === '\t') {
        this.advance();
        continue;
      }

      // Handle newlines
      if (char === '\n') {
        this.line++;
        this.column = 1;
        this.advance();
        continue;
      }

      // Handle comments
      if (char === '#') {
        this.skipComment();
        continue;
      }

      // Handle function calls: §func[args]
      if (char === '§') {
        this.tokenizeFunction();
        continue;
      }

      // Handle strings
      if (char === '"' || char === "'") {
        this.tokenizeString();
        continue;
      }

      // Handle brackets
      if (char === '[') {
        this.addToken('LBRACKET', '[');
        this.advance();
        continue;
      }

      if (char === ']') {
        this.addToken('RBRACKET', ']');
        this.advance();
        continue;
      }

      // Handle semicolons (argument separator)
      if (char === ';') {
        this.addToken('SEMICOLON', ';');
        this.advance();
        continue;
      }

      // Handle variable references: $VAR_NAME
      if (char === '$') {
        this.tokenizeVariable();
        continue;
      }

      // Handle identifiers and keywords
      if (this.isAlphaNumeric(char) || char === '_' || char === '-' || char === '.' || char === '/') {
        this.tokenizeIdentifier();
        continue;
      }

      // Handle numbers
      if (this.isDigit(char)) {
        this.tokenizeNumber();
        continue;
      }

      // Handle other characters
      if (char === '{' || char === '}' || char === '(' || char === ')' || char === ',') {
        this.addToken('OTHER', char);
        this.advance();
        continue;
      }

      // Skip unknown characters with warning
      this.advance();
    }

    this.addToken('EOF', '');
    return this.tokens;
  }

  /**
   * Tokenize function calls: §func[...]
   */
  tokenizeFunction() {
    const startLine = this.line;
    const startColumn = this.column;

    this.advance(); // Skip §

    let name = '';
    while (this.position < this.code.length && (this.isAlphaNumeric(this.code[this.position]) || this.code[this.position] === '_')) {
      name += this.code[this.position];
      this.advance();
    }

    if (name) {
      this.tokens.push(new Token('FUNCTION', name, startLine, startColumn));
    }
  }

  /**
   * Tokenize variable references: $VAR_NAME
   */
  tokenizeVariable() {
    const startLine = this.line;
    const startColumn = this.column;

    this.advance(); // Skip $

    let name = '';
    while (
      this.position < this.code.length &&
      (this.isAlphaNumeric(this.code[this.position]) || this.code[this.position] === '_')
    ) {
      name += this.code[this.position];
      this.advance();
    }

    if (name) {
      this.tokens.push(new Token('VARIABLE', name, startLine, startColumn));
    } else {
      this.tokens.push(new Token('OTHER', '$', startLine, startColumn));
    }
  }

  /**
   * Tokenize strings
   */
  tokenizeString() {
    const startLine = this.line;
    const startColumn = this.column;
    const quote = this.code[this.position];

    this.advance(); // Skip opening quote

    let value = '';
    while (this.position < this.code.length && this.code[this.position] !== quote) {
      if (this.code[this.position] === '\\') {
        this.advance();
        if (this.position < this.code.length) {
          value += this.code[this.position];
          this.advance();
        }
      } else {
        value += this.code[this.position];
        this.advance();
      }
    }

    if (this.position < this.code.length) {
      this.advance(); // Skip closing quote
    }

    this.tokens.push(new Token('STRING', value, startLine, startColumn));
  }

  /**
   * Tokenize identifiers and keywords
   */
  tokenizeIdentifier() {
    const startLine = this.line;
    const startColumn = this.column;

    let value = '';
    while (
      this.position < this.code.length &&
      (this.isAlphaNumeric(this.code[this.position]) || 
       this.code[this.position] === '_' ||
       this.code[this.position] === '-' ||
       this.code[this.position] === '.' ||
       this.code[this.position] === '/')
    ) {
      value += this.code[this.position];
      this.advance();
    }

    // Identify keywords
    if (value === 'true' || value === 'false') {
      this.tokens.push(new Token('BOOLEAN', value, startLine, startColumn));
    } else if (value === 'if' || value === 'endif' || value === 'while' || value === 'endwhile' || value === 'func') {
      this.tokens.push(new Token('KEYWORD', value, startLine, startColumn));
    } else {
      this.tokens.push(new Token('IDENTIFIER', value, startLine, startColumn));
    }
  }

  /**
   * Tokenize numbers
   */
  tokenizeNumber() {
    const startLine = this.line;
    const startColumn = this.column;

    let value = '';
    while (this.position < this.code.length && (this.isDigit(this.code[this.position]) || this.code[this.position] === '.')) {
      value += this.code[this.position];
      this.advance();
    }

    this.tokens.push(new Token('NUMBER', value, startLine, startColumn));
  }

  /**
   * Skip comments
   */
  skipComment() {
    while (this.position < this.code.length && this.code[this.position] !== '\n') {
      this.advance();
    }
  }

  /**
   * Helper: Check if character is alphanumeric
   */
  isAlphaNumeric(char) {
    return /[a-zA-Z0-9]/.test(char);
  }

  /**
   * Helper: Check if character is a digit
   */
  isDigit(char) {
    return /[0-9]/.test(char);
  }

  /**
   * Add token to list
   */
  addToken(type, value) {
    this.tokens.push(new Token(type, value, this.line, this.column));
  }

  /**
   * Advance position
   */
  advance() {
    if (this.position < this.code.length) {
      this.position++;
      this.column++;
    }
  }

  /**
   * Pretty print tokens
   */
  printTokens(tokens) {
    console.log('\n╔══════════════════════════════════════╗');
    console.log('║       TOKENIZATION RESULTS            ║');
    console.log('╚══════════════════════════════════════╝\n');

    console.log(`Total tokens: ${tokens.length - 1}\n`); // -1 for EOF

    const groupedByType = {};
    tokens.forEach((token) => {
      if (token.type !== 'EOF') {
        if (!groupedByType[token.type]) {
          groupedByType[token.type] = [];
        }
        groupedByType[token.type].push(token);
      }
    });

    Object.keys(groupedByType).forEach((type) => {
      console.log(`${type} (${groupedByType[type].length}):`);
      groupedByType[type].forEach((token) => {
        console.log(`  • "${token.value}" @ L${token.line}:C${token.column}`);
      });
      console.log();
    });
  }
}

module.exports = Tokenizer;
