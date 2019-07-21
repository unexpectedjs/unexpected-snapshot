const ruleFixer = require('eslint/lib/linter/rule-fixer');
const Traverser = require('eslint/lib/shared/traverser');
const isSimpleObjectTree = require('./isSimpleObjectTree');
const memoizeSync = require('memoizesync');
const detectIndent = require('detect-indent');
const eslint = require('eslint');
const fs = require('fs');
const indentString = require('./indentString');
const SourceCodeFixer = require('eslint/lib/linter/source-code-fixer');
const run = require('./run');
const Promise = require('bluebird');

function stringify(obj, indentationWidth, inspect) {
  if (obj.includes('\n')) {
    return `expect.unindent\`${indentString(
      obj.replace(/`/g, '\\`'),
      indentationWidth
    )}\``;
  } else {
    return inspect(obj, indentationWidth);
  }
}

const getSourceCode = memoizeSync(fileName => {
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
        experimentalObjectRestSpread: true
      }
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
        column: 0
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
        column: ex.column
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
});

let afterBlockRegistered = false;
function ensureAfterBlockIsRegistered(topLevelFixes) {
  if (afterBlockRegistered || typeof after !== 'function') {
    return;
  }
  afterBlockRegistered = true;
  after(async function() {
    const fixesByFileName = {};
    let numFixedExpects = 0;
    for (const {
      fileName,
      lineNumber,
      columnNumber,
      status,
      subject,
      inspect,
      assertionName
    } of topLevelFixes) {
      const sourceCode = getSourceCode(fileName);
      if (!sourceCode) {
        // Probably a parse error, give up.
        return;
      }
      let indentationWidth = 4;
      const detectedIndent = detectIndent(sourceCode.text);
      if (detectedIndent) {
        indentationWidth = detectedIndent.amount;
      }

      // eslint-disable-next-line no-inner-declarations
      function getNodeIndent(node, byLastLine) {
        const token = byLastLine
          ? sourceCode.getLastToken(node)
          : sourceCode.getFirstToken(node);
        const srcCharsBeforeNode = sourceCode
          .getText(token, token.loc.start.column)
          .split('');
        const indentChars = srcCharsBeforeNode.slice(
          0,
          srcCharsBeforeNode.findIndex(char => char !== ' ' && char !== '\t')
        );
        const spaces = indentChars.filter(char => char === ' ').length;
        const tabs = indentChars.filter(char => char === '\t').length;

        if (spaces > 0) {
          return ' '.repeat(spaces);
        } else if (tabs > 0) {
          return '\t'.repeat(tabs);
        } else {
          return '';
        }
      }

      new Traverser().traverse(sourceCode.ast, {
        enter(node, parent) {
          if (
            node.type === 'CallExpression' &&
            node.callee.type === 'Identifier' &&
            node.callee.name === 'expect' &&
            node.loc.start.line === lineNumber &&
            node.loc.start.column + 1 === columnNumber &&
            node.arguments.length >= 2
          ) {
            numFixedExpects += 1;

            // Find the indentation of the literal being replaced,
            // falling back to that of 'to equal snapshot'
            let indent;
            if (node.arguments.length >= 3) {
              indent = getNodeIndent(node.arguments[2]);
            } else {
              indent = getNodeIndent(node.arguments[1]);
            }
            const fixes = [];
            let stringifiedSubject;
            let newAssertionName = assertionName;
            if (
              typeof subject === 'string' &&
              assertionName === 'to equal snapshot'
            ) {
              stringifiedSubject = stringify(
                subject,
                indentationWidth,
                inspect
              ).replace(/\n^(?=[^\n])/gm, `\n${indent}`);
            } else if (
              isSimpleObjectTree(subject) &&
              assertionName === 'to equal snapshot'
            ) {
              stringifiedSubject = inspect(subject, indentationWidth);
            } else {
              newAssertionName = 'to inspect as snapshot';
              stringifiedSubject = stringify(
                inspect(subject, indentationWidth),
                indentationWidth,
                inspect
              ).replace(/\n^(?=[^\n])/gm, `\n${indent}`);
            }
            // Take compound assertions into account:
            const assertionArgument =
              node.arguments[
                node.arguments.length - (status === 'missing' ? 1 : 2)
              ];
            const newAssertionNameWithPrefix = assertionArgument.value.replace(
              assertionName,
              newAssertionName
            );

            if (status === 'missing') {
              if (newAssertionName === assertionName) {
                fixes.unshift(
                  ruleFixer.insertTextAfter(
                    assertionArgument,
                    `, ${stringifiedSubject}`
                  )
                );
              } else {
                fixes.unshift(
                  ruleFixer.replaceText(
                    assertionArgument,
                    `'${newAssertionNameWithPrefix}', ${stringifiedSubject}`
                  )
                );
              }
            } else if (status === 'mismatch') {
              if (newAssertionName !== assertionName) {
                fixes.unshift(
                  ruleFixer.replaceText(
                    assertionArgument,
                    `'${newAssertionNameWithPrefix}'`
                  )
                );
              }
              fixes.unshift(
                ruleFixer.replaceText(
                  node.arguments[node.arguments.length - 1],
                  stringifiedSubject
                )
              );
            }
            if (fixes.length > 0) {
              (fixesByFileName[fileName] =
                fixesByFileName[fileName] || []).push(...fixes);
            }
          }
        }
      });
    }

    const fixedSourceTextByFileName = {};
    for (const fileName of Object.keys(fixesByFileName)) {
      var fixResult = SourceCodeFixer.applyFixes(
        getSourceCode(fileName).text,
        fixesByFileName[fileName].map(fix => ({ fix }))
      );
      if (fixResult.fixed) {
        fixedSourceTextByFileName[fileName] = fixResult.output;
      }
    }

    const fileNames = Object.keys(fixedSourceTextByFileName);
    let firstError;
    if (fileNames.length > 0) {
      const isUnderVersionControlByFileName = {};
      const hasUncommittedChangesByFileName = {};
      const results = await Promise.map(
        fileNames,
        fileName => run('git', ['ls-files', '--error-unmatch', fileName]),
        { concurrency: 5 }
      );

      for (const [i, result] of results.entries()) {
        if (result[1]) {
          firstError = firstError || result[1];
        } else {
          isUnderVersionControlByFileName[fileNames[i]] = result[0] === 0;
        }
      }
      const [, err, dirtyFileNames] = await run(
        'git',
        ['diff-index', 'HEAD', '--name-only'],
        {
          bufferLines: true
        }
      );

      firstError = firstError || err;
      for (const fileName of dirtyFileNames) {
        hasUncommittedChangesByFileName[fileName] = true;
      }

      // Prevent the test runner from forcefully exiting while we're prompting, but save the call args for replaying later:
      const originalProcessExit = process.exit;
      const processExitArgs = [];
      process.exit = function(...args) {
        processExitArgs.push(args);
      };

      // Replay process.exit calls that happened while we were prompting and writing files:
      // eslint-disable-next-line no-inner-declarations
      function replayAndRestoreProcessExit() {
        process.exit = originalProcessExit;
        for (const args of processExitArgs) {
          process.exit(...args);
        }
      }

      // Give the test runner a chance to complete its output before we prompt:
      setImmediate(async function() {
        console.log(
          `unexpected-snapshot detected ${numFixedExpects} failing snapshot assertion${
            numFixedExpects === 1 ? '' : 's'
          } in ${fileNames.length} source file${
            fileNames.length === 1 ? '' : 's'
          }`
        );
        if (firstError) {
          console.log(`Aborting due to error: ${firstError.stack}`);
          processExitArgs.unshift([165]); // Fail with a oddball error code that can be detected by tests
          return replayAndRestoreProcessExit();
        }

        const Promise = require('bluebird');
        const fs = Promise.promisifyAll(require('fs'));

        if (fileNames.length > 0) {
          const results = await Promise.map(
            fileNames,
            fileName =>
              fs.writeFileAsync(fileName, fixedSourceTextByFileName[fileName]),
            { concurrency: 5 }
          );

          console.log(
            `unexpected-snapshot: Wrote ${results.length} file${
              results.length === 1 ? '' : 's'
            }`
          );
        }
        replayAndRestoreProcessExit();
      });
    }
  });
}

module.exports = ensureAfterBlockIsRegistered;
