/*global after*/
const expect = require('unexpected');
const fs = require('fs');
const memoizeSync = require('memoizesync');
const detectIndent = require('detect-indent');
const _ = require('lodash');

const eslint = require('eslint');
const { SourceCode } = eslint;
const ruleFixer = require('eslint/lib/util/rule-fixer');
const Traverser = require('eslint/lib/util/traverser');
const SourceCodeFixer = require('eslint/lib/util/source-code-fixer');

var expectForRendering = expect.clone();

expect.getType('string').inspect = function (value, depth, output) {
    if (value.indexOf('\n') !== -1 && value.length > 30) {
        // Render long multiline string as multiple literals
        output.indentLines();
        value.match(/[^\n]*\n/g).forEach((line, i) => {
            if (i > 0) {
                output.sp().text('+').nl().i();
            }
            output.singleQuotedString(line);
        });
        output.outdentLines();
    } else {
        return output.singleQuotedString(value);
    }
};

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

function stringify(obj, indentationWidth) {
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
                filePath
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

after(function () {
    const fixesByFileName = {};
    topLevelErrors.forEach(function (topLevelError) {
        const fileName = topLevelError.fileName;
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
                if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'expect' && node.loc.start.line === topLevelError.lineNumber && node.arguments.length >= 3) {
                    Object.keys(topLevelError.fixes).forEach(argNumber => {
                        (fixesByFileName[fileName] = fixesByFileName[fileName] || []).push({
                            fix: ruleFixer.replaceText(node.arguments[parseInt(argNumber, 10) + 2], stringify(topLevelError.fixes[argNumber], indentationWidth).replace(/\n^/mg, '\n' + getNodeIndent(node)))
                        });
                    });
                }
            }
        });
    });

    Object.keys(fixesByFileName).forEach(fileName => {
        var fixResult = SourceCodeFixer.applyFixes(getSourceCode(fileName), fixesByFileName[fileName]);
        if (fixResult.fixed) {
            fs.writeFileSync(fileName, fixResult.output);
        }
    });
});

let fixpect = function fixpect(subject, ...rest) {
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
            let topFrame = stack.split('\n').slice(2).find(frame => !/(^|\b|\/)node_modules\//.test(frame));
            if (topFrame) {
                const matchTopFrame = topFrame.match(/\(([^:\)]*):(\d+):(\d+)\)$/);
                if (matchTopFrame) {
                    topLevelErrors.push({
                        fileName: matchTopFrame[1],
                        lineNumber: parseInt(matchTopFrame[2], 10),
                        columnNumber: parseInt(matchTopFrame[3], 10),
                        subject,
                        error,
                        fixes
                    });
                }
            }
        }
        throw error;
    }
    try {
        returnValue = expect(subject, ...rest);
    } catch (error) {
        onError(error);
    }
    return returnValue.caught(onError);
};

// Expose a fixpect.use etc.
Object.keys(expect).forEach(key => {
    if (typeof expect[key] === 'function') {
        fixpect[key] = expect[key].bind(expect);
    }
});

module.exports = fixpect;
