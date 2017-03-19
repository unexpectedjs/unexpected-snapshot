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
        if (text.charCodeAt(0) === 0xFEFF) {
            return text.slice(1);
        }
        return text;
    }

    function parse(text, config, filePath) {
        let parser,
            parserOptions = {
                loc: true,
                range: true,
                raw: true,
                tokens: true,
                comment: true,
                attachComment: true,
                filePath,
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
            const source = (ex.lineNumber) ? SourceCode.splitLines(text)[ex.lineNumber - 1] : null;

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

const topLevelErrors = [];
let afterBlockRegistered = false;
function ensureAfterBlockIsRegistered() {
    if (afterBlockRegistered || typeof after !== 'function') {
        return;
    }
    afterBlockRegistered = true;
    after(function () {
        const fixesByFileName = {};
        let numFixedExpects = 0;
        topLevelErrors.forEach(function (topLevelError) {
            const fileName = topLevelError.fileName;
            const sourceCode = getSourceCode(fileName);
            const expectForRendering = topLevelError.expectForRendering;
            if (!sourceCode) {
                // Probably a parse error, give up.
                return;
            }
            let indentationWidth = 4;
            let detectedIndent = detectIndent(sourceCode.text);
            if (detectedIndent) {
                indentationWidth = detectedIndent.amount;
            }

            function getNodeIndent(node, byLastLine) {
                const token = byLastLine ? sourceCode.getLastToken(node) : sourceCode.getFirstToken(node);
                const srcCharsBeforeNode = sourceCode.getText(token, token.loc.start.column).split('');
                const indentChars = srcCharsBeforeNode.slice(0, srcCharsBeforeNode.findIndex(char => char !== ' ' && char !== '\t'));
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
                    node.parent = parent;
                    if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'expect' && node.loc.start.line === topLevelError.lineNumber && (node.loc.start.column + 1) === topLevelError.columnNumber && node.arguments.length >= 3) {
                        numFixedExpects += 1;
                        Object.keys(topLevelError.fixes).forEach(argNumber => {
                            (fixesByFileName[fileName] = fixesByFileName[fileName] || []).push({
                                fix: ruleFixer.replaceText(node.arguments[parseInt(argNumber, 10) + 2], stringify(topLevelError.fixes[argNumber], indentationWidth, expectForRendering).replace(/\n^/mg, '\n' + getNodeIndent(node)))
                            });
                        });
                    }
                }
            });
        });

        const fixedSourceTextByFileName = {};
        for (const fileName of Object.keys(fixesByFileName)) {
            var fixResult = SourceCodeFixer.applyFixes(getSourceCode(fileName), fixesByFileName[fileName]);
            if (fixResult.fixed) {
                fixedSourceTextByFileName[fileName] = fixResult.output;
            }
        }

        const fileNames = Object.keys(fixedSourceTextByFileName);
        if (fileNames.length > 0) {
            const isUnderVersionControlByFileName = {};
            const hasUncommittedChangesByFileName = {};
            return Promise.map(fileNames, fileName => run('git', ['ls-files', '--error-unmatch', fileName]), {concurrency: 5})
            .then(results => {
                results.forEach((resultEntry, i) => isUnderVersionControlByFileName[fileNames[i]] = resultEntry[0] === 0);
                return run('git', ['diff-index', 'HEAD', '--name-only'], {bufferLines: true});
            })
            .then(([, , dirtyFileNames]) => {
                for (const fileName of dirtyFileNames) {
                    hasUncommittedChangesByFileName[fileName] = true;
                }
                if (process.env.FIXPECT) {
                    return Promise.map(fileNames, fileName => fs.writeFileAsync(fileName, fixedSourceTextByFileName[fileName]), {concurrency: 5});
                } else if (process.stdout.isTTY && fileNames.length > 0) {
                    // Prevent the test runner from forcefully exiting while we're prompting, but save the call args for replaying later:
                    const originalProcessExit = process.exit;
                    let processExitArgs = [];
                    process.exit = function (...args) {
                        processExitArgs.push(args);
                    };
                    // Give the test runner a chance to complete its output before we prompt:
                    setImmediate(function () {
                        console.log(
                            'fixpect was able to patch up ' + numFixedExpects + ' expect call' + (numFixedExpects === 1 ? '' : 's') +
                            ' in ' + fileNames.length + ' source file' + (fileNames.length === 1 ? '' : 's')
                        );

                        // Intentionally not returning this promise as we're past the 'after' hook now:
                        inquirer.prompt([
                            {
                                type: 'checkbox',
                                message: 'Select files to overwrite with fixed versions',
                                name: 'files',
                                choices: fileNames.map(fileName => ({
                                    name: pathModule.relative(process.cwd(), fileName) +
                                        (hasUncommittedChangesByFileName[fileName] ? '(has uncommitted changes)' : '') +
                                        (isUnderVersionControlByFileName[fileName] ? '' : ' (not under version control)'),
                                    value: fileName,
                                    checked: !hasUncommittedChangesByFileName[fileName] && isUnderVersionControlByFileName[fileName]
                                }))
                            }
                        ])
                        .then(answers => Promise.map(answers.files, fileName => fs.writeFileAsync(fileName, fixedSourceTextByFileName[fileName]), {concurrency: 5}))
                        .then(results => {
                            console.log('fixpect: Wrote ' + results.length + ' file' + (results.length === 1 ? '' : 's'));
                            // Replay process.exit calls that happened while we were prompting and writing files:
                            process.exit = originalProcessExit;
                            for (const args of processExitArgs) {
                                process.exit(...args);
                            }
                        });
                    });
                }
            });
        }
    });
}

module.exports = {
    name: 'fixpect',
    version: require('../package.json').version,
    installInto: function (expect) {
        var expectForRendering = expect.clone();

        expectForRendering.addType({
            name: 'expandedString',
            base: 'string',
            identify: function (obj) {
                return typeof obj === 'string';
            },
            inspect: function (value, depth, output) {
                if (value.indexOf('\n') !== -1 && value.length > 30) {
                    output.indentLines();
                    var initialLinesRegExp = /[^\n]*\n|[^\n]+$/g;
                    value.match(initialLinesRegExp).forEach((line, i) => {
                        if (i > 0) {
                            output.sp().text('+').nl().i();
                        }
                        output.singleQuotedString(line);
                    });
                    output.outdentLines();
                } else {
                    return output.singleQuotedString(value);
                }
            },
            equal: function (a, b) {
                return this.baseType.equal(a, b);
            }
        });

        // Avoid breaking the output of "no assertion found" error messages:
        expectForRendering.getType('expandedString').name = 'string';

        expectForRendering.addType({
            name: 'infiniteBuffer',
            base: 'Buffer',
            identify: function (obj) {
                return Buffer.isBuffer(obj);
            },
            inspect: function (value, depth, output, inspect) {
                if (value.length > 32) {
                    return output.code("new Buffer('" + value.toString('base64') + "', 'base64')", 'javascript');
                } else {
                    // This can be replaced by return this.baseType.inspect.call(this, value, depth, output, inspect)
                    // if https://github.com/unexpectedjs/unexpected/pull/332 lands:
                    this.prefix(output, value);
                    var codeStr = '';
                    for (var i = 0 ; i < value.length ; i += 1) {
                        if (i > 0) {
                            codeStr += ', ';
                        }
                        var octet = value[i];
                        var hex = octet.toString(16).toUpperCase();
                        codeStr += '0x' + (hex.length === 1 ? '0' : '') + hex;
                    }
                    output.code(codeStr, 'javascript');
                    this.suffix(output, value);
                    return output;
                }
            },
            prefix: function (output) {
                return output.code('new Buffer([', 'javascript');
            },
            suffix: function (output) {
                return output.code('])', 'javascript');
            },
            hexDumpWidth: Infinity // Prevents Buffer instances > 16 bytes from being truncated
        });

        expectForRendering.addType({
            base: 'Error',
            name: 'overriddenError',
            identify: function (obj) {
                return this.baseType.identify(obj);
            },
            inspect: function (value, depth, output, inspect) {
                var obj = _.extend({}, value),
                    keys = Object.keys(obj);
                if (keys.length === 0) {
                    output.text('new Error(').append(inspect(value.message || '')).text(')');
                } else {
                    output
                        .text('(function () {')
                        .text('var err = new ' + (value.constructor.name || 'Error') + '(')
                        .append(inspect(value.message || '')).text(');');
                    keys.forEach(function (key, i) {
                        output.sp();
                        if (/^[a-z\$\_][a-z0-9\$\_]*$/i.test(key)) {
                            output.text('err.' + key);
                        } else {
                            output.text('err[').append(inspect(key)).text(']');
                        }
                        output.text(' = ').append(inspect(obj[key])).text(';');
                    });
                    output.sp().text('return err;}())');
                }
            }
        });

        let executing = false;

        expect.hook(function (next) {
            return function fixpect(subject, ...rest) {
                if (executing) {
                    return next(subject, ...rest);
                }
                executing = true;
                let returnValue;
                let stack;
                try {
                    throw new Error();
                } catch (e) {
                    stack = e.stack;
                }
                function onError(error) {
                    let fixes = typeof error.fixes === 'function' ? error.fixes() : error.fixes;
                    if (fixes) {
                        ensureAfterBlockIsRegistered();
                        let topFrame = stack.split('\n').slice(3).find(frame => !/(^|\b|\/)node_modules\//.test(frame));
                        if (topFrame) {
                            // at Context.<anonymous> (/home/andreas/work/fixpect/test/tmp/fixpect8550355.js:4:21)
                            let matchTopFrame = topFrame.match(/\(([^:\)]*):(\d+):(\d+)\)$/);
                            if (!matchTopFrame) {
                                // at /home/andreas/work/fixpect/test/tmp/fixpect5568804.js:5:25
                                matchTopFrame = topFrame.match(/at ([^:\)]*):(\d+):(\d+)$/);
                            }
                            if (matchTopFrame) {
                                topLevelErrors.push({
                                    fileName: matchTopFrame[1],
                                    lineNumber: parseInt(matchTopFrame[2], 10),
                                    columnNumber: parseInt(matchTopFrame[3], 10),
                                    subject,
                                    error,
                                    fixes,
                                    expectForRendering
                                });
                            }
                        }
                    }
                }
                try {
                    returnValue = next(subject, ...rest);
                } catch (error) {
                    onError(error);
                    executing = false;
                    throw error;
                }
                if (returnValue.isPending()) {
                    returnValue.caught(onError).finally(() => executing = false);
                }
                return returnValue;
            };
        });
    }
};
