/*global after*/
const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const pathModule = require('path');
const run = require('./run');
const memoizeSync = require('memoizesync');
const detectIndent = require('detect-indent');
const _ = require('lodash');
const inquirer = require('inquirer');

const eslint = require('eslint');
const { SourceCode } = eslint;
const ruleFixer = require('eslint/lib/util/rule-fixer');
const Traverser = require('eslint/lib/util/traverser');
const SourceCodeFixer = require('eslint/lib/util/source-code-fixer');

function stringify(obj, indentationWidth, expectForRendering) {
  expectForRendering.output.indentationWidth = indentationWidth;
  return expectForRendering.inspect(obj, Infinity).toString('text');
}

function extractCallerLocationFromStack(stack) {
  let topFrame = stack
    .split('\n')
    .slice(3)
    .find(frame => !/(^|\b|\/)node_modules\//.test(frame));
  if (topFrame) {
    // at Context.<anonymous> (/home/andreas/work/unexpected-snapshot/test/tmp/unexpected-snapshot-8550355.js:4:21)
    let matchTopFrame = topFrame.match(/\(([^:)]*):(\d+):(\d+)\)$/);
    if (!matchTopFrame) {
      // at /home/andreas/work/unexpected-snapshot/test/tmp/unexpected-snapshot-5568804.js:5:25
      matchTopFrame = topFrame.match(/at ([^:)]*):(\d+):(\d+)$/);
    }
    if (matchTopFrame) {
      return {
        fileName: matchTopFrame[1],
        lineNumber: parseInt(matchTopFrame[2], 10),
        columnNumber: parseInt(matchTopFrame[3], 10)
      };
    }
  }
}

const getSourceCode = memoizeSync(fileName => {
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

  let text = fs.readFileSync(fileName, 'utf-8');
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

const topLevelFixes = [];
let afterBlockRegistered = false;
function ensureAfterBlockIsRegistered() {
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
      expectForRendering
    } of topLevelFixes) {
      const sourceCode = getSourceCode(fileName);
      if (!sourceCode) {
        // Probably a parse error, give up.
        return;
      }
      let indentationWidth = 4;
      let detectedIndent = detectIndent(sourceCode.text);
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

            const stringifiedSubject = stringify(
              subject,
              indentationWidth,
              expectForRendering
            ).replace(/\n^/gm, `\n${getNodeIndent(node)}`);

            let fix;
            if (status === 'missing') {
              fix = ruleFixer.insertTextAfter(
                node.arguments[node.arguments.length - 1],
                `, ${stringifiedSubject}`
              );
            } else if (status === 'mismatch') {
              fix = ruleFixer.replaceText(
                node.arguments[node.arguments.length - 1],
                stringifiedSubject
              );
            }
            if (fix) {
              (fixesByFileName[fileName] =
                fixesByFileName[fileName] || []).push({
                fix
              });
            }
          }
        }
      });
    }

    const fixedSourceTextByFileName = {};
    for (const fileName of Object.keys(fixesByFileName)) {
      var fixResult = SourceCodeFixer.applyFixes(
        getSourceCode(fileName).text,
        fixesByFileName[fileName]
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
      let processExitArgs = [];
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
          `unexpected-snapshot was able to patch up ${numFixedExpects} expect call${
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

        let fileNamesToWrite = [];
        if (
          /^(?:1|true|on|yes)$/i.test(process.env.UNEXPECTED_SNAPSHOT_UPDATE)
        ) {
          fileNamesToWrite = fileNames;
        } else if (process.stdout.isTTY) {
          // FIXME: Only prompt if interactive mode is explicitly enabled
          // Intentionally not returning this promise as we're past the 'after' hook now:
          const answers = await inquirer.prompt([
            {
              type: 'checkbox',
              message: 'Select files to overwrite with fixed versions',
              name: 'files',
              choices: fileNames.map(fileName => ({
                name:
                  pathModule.relative(process.cwd(), fileName) +
                  (hasUncommittedChangesByFileName[fileName]
                    ? '(has uncommitted changes)'
                    : '') +
                  (isUnderVersionControlByFileName[fileName]
                    ? ''
                    : ' (not under version control)'),
                value: fileName,
                checked:
                  !hasUncommittedChangesByFileName[fileName] &&
                  isUnderVersionControlByFileName[fileName]
              }))
            }
          ]);
          fileNamesToWrite = answers.files;
        } else {
          console.log(
            'UNEXPECTED_SNAPSHOT_UPDATE=yes not given and not running in a TTY'
          );
          replayAndRestoreProcessExit();
        }
        if (fileNamesToWrite.length > 0) {
          const results = await Promise.map(
            fileNamesToWrite,
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

module.exports = {
  name: 'unexpected-snapshot',
  version: require('../package.json').version,
  installInto(expect) {
    const expectForRendering = expect.child();

    expectForRendering.addType({
      name: 'expandedString',
      base: 'string',
      identify(obj) {
        return typeof obj === 'string';
      },
      inspect(value, depth, output) {
        if (value.indexOf('\n') !== -1 && value.length > 30) {
          output.indentLines();
          var initialLinesRegExp = /[^\n]*\n|[^\n]+$/g;
          value.match(initialLinesRegExp).forEach((line, i) => {
            if (i > 0) {
              output
                .sp()
                .text('+')
                .nl()
                .i();
            }
            output.singleQuotedString(line);
          });
          output.outdentLines();
        } else {
          return output.singleQuotedString(value);
        }
      },
      equal(a, b) {
        return this.baseType.equal(a, b);
      }
    });

    // Avoid breaking the output of "no assertion found" error messages:
    expectForRendering.getType('expandedString').name = 'string';

    expectForRendering.addType({
      name: 'infiniteBuffer',
      base: 'Buffer',
      identify(obj) {
        return Buffer.isBuffer(obj);
      },
      inspect(value, depth, output, inspect) {
        if (value.length > 32) {
          return output.code(
            `new Buffer('${value.toString('base64')}', 'base64')`,
            'javascript'
          );
        } else {
          // This can be replaced by return this.baseType.inspect.call(this, value, depth, output, inspect)
          // if https://github.com/unexpectedjs/unexpected/pull/332 lands:
          this.prefix(output, value);
          var codeStr = '';
          for (var i = 0; i < value.length; i += 1) {
            if (i > 0) {
              codeStr += ', ';
            }
            var octet = value[i];
            var hex = octet.toString(16).toUpperCase();
            codeStr += `0x${hex.length === 1 ? '0' : ''}${hex}`;
          }
          output.code(codeStr, 'javascript');
          this.suffix(output, value);
          return output;
        }
      },
      prefix(output) {
        return output.code('new Buffer([', 'javascript');
      },
      suffix(output) {
        return output.code('])', 'javascript');
      },
      hexDumpWidth: Infinity // Prevents Buffer instances > 16 bytes from being truncated
    });

    expectForRendering.addType({
      base: 'Error',
      name: 'overriddenError',
      identify(obj) {
        return this.baseType.identify(obj);
      },
      inspect(value, depth, output, inspect) {
        var obj = _.extend({}, value);

        var keys = Object.keys(obj);
        if (keys.length === 0) {
          output
            .text('new Error(')
            .append(inspect(value.message || ''))
            .text(')');
        } else {
          output
            .text('(function () {')
            .text(`var err = new ${value.constructor.name || 'Error'}(`)
            .append(inspect(value.message || ''))
            .text(');');
          keys.forEach(function(key, i) {
            output.sp();
            if (/^[a-z$_][a-z0-9$_]*$/i.test(key)) {
              output.text(`err.${key}`);
            } else {
              output
                .text('err[')
                .append(inspect(key))
                .text(']');
            }
            output
              .text(' = ')
              .append(inspect(obj[key]))
              .text(';');
          });
          output.sp().text('return err;}())');
        }
      }
    });

    const symbol = Symbol('unexpectedSnapshot');

    expect.addAssertion(
      '<any> to match inline snapshot <any?>',
      (expect, subject, ...args) => {
        if (args.length === 1) {
          return expect.withError(
            () => {
              expect(subject, 'to equal', args[0]);
            },
            err => {
              topLevelFixes.push({
                ...expect.context[symbol],
                subject,
                status: 'mismatch'
              });
              ensureAfterBlockIsRegistered();
              throw err;
            }
          );
        } else {
          if (expect.context[symbol]) {
            topLevelFixes.push({
              ...expect.context[symbol],
              subject,
              status: 'missing'
            });
            ensureAfterBlockIsRegistered();
          } else {
            throw new Error(
              'unexpected-snapshot: Could not figure out the location of the expect() call to patch up'
            );
          }
        }
      }
    );

    expect.hook(function(next) {
      return function unexpectedSnapshot(context, ...rest) {
        if (!context[symbol]) {
          try {
            throw new Error();
          } catch (e) {
            context[symbol] = {
              ...extractCallerLocationFromStack(e.stack),
              expectForRendering
            };
          }
        }
        return next(context, ...rest);
      };
    });
  }
};