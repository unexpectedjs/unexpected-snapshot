const eslint = require('eslint');
const fs = require('fs');

function getSourceCode(fileName) {
  const { SourceCode } = eslint;
  /**
   * Strips Unicode BOM from a given text.
   *
   * @param {string} text - A text to strip.
   * @returns {string} The stripped text.
   */
  function stripUnicodeBOM(text) {
    /*
     * Check Unicode BOM.
     * In JavaScript, string data is stored as UTF-16, so BOM is 0xFEFF.
     * http://www.ecma-international.org/ecma-262/6.0/#sec-unicode-format-control-characters
     */
    if (text.charCodeAt(0) === 0xfeff) {
      return text.slice(1);
    }
    return text;
  }

  function parse(text, config, filePath) {
    let parser;

    let parserOptions = {
      loc: true,
      range: true,
      raw: true,
      tokens: true,
      comment: true,
      attachComment: true,
      filePath,
      ecmaVersion: 9,
      ecmaFeatures: {
        jsx: true,
        globalReturn: true,
        experimentalObjectRestSpread: true,
      },
    };

    try {
      parser = require(config.parser);
    } catch (ex) {
      console.error({
        ruleId: null,
        fatal: true,
        severity: 2,
        source: null,
        message: ex.message,
        line: 0,
        column: 0,
      });

      return null;
    }

    // merge in any additional parser options
    if (config.parserOptions) {
      parserOptions = Object.assign({}, config.parserOptions, parserOptions);
    }

    /*
     * Check for parsing errors first. If there's a parsing error, nothing
     * else can happen. However, a parsing error does not throw an error
     * from this method - it's just considered a fatal error message, a
     * problem that ESLint identified just like any other.
     */
    try {
      if (typeof parser.parseForESLint === 'function') {
        return parser.parseForESLint(text, parserOptions);
      }
      return parser.parse(text, parserOptions);
    } catch (ex) {
      // If the message includes a leading line number, strip it:
      const message = ex.message.replace(/^line \d+:/i, '').trim();
      const source = ex.lineNumber
        ? SourceCode.splitLines(text)[ex.lineNumber - 1]
        : null;

      console.error({
        ruleId: null,
        fatal: true,
        severity: 2,
        source,
        message: `Parsing error: ${message}`,

        line: ex.lineNumber,
        column: ex.column,
      });
      return null;
    }
  }

  const text = fs.readFileSync(fileName, 'utf-8');
  let parseResult = parse(
    stripUnicodeBOM(text).replace(/^#!([^\r\n]+)/, (match, captured) => {
      return `//${captured}`;
    }),
    { parser: 'espree' },
    fileName
  );

  var ast;
  if (parseResult && parseResult.ast) {
    ast = parseResult.ast;
  } else {
    ast = parseResult;
    parseResult = null;
  }

  return ast && new SourceCode(text, ast);
}

module.exports = getSourceCode;
