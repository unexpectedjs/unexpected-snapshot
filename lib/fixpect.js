/*global after*/
const expect = require('unexpected');
const callsite = require('callsite');
const fs = require('fs');
const memoizeSync = require('memoizesync');

const eslint = require('eslint');
const { SourceCode } = eslint;
const ruleFixer = require('eslint/lib/util/rule-fixer');
const Traverser = require("eslint/lib/util/traverser");
const SourceCodeFixer = require("eslint/lib/util/source-code-fixer");

const injectionsBySourceFileName = {};

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
            messages.push({
                ruleId: null,
                fatal: true,½
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
            if (typeof parser.parseForESLint === "function") {
                return parser.parseForESLint(text, parserOptions);
            }
            return parser.parse(text, parserOptions);

        } catch (ex) {

            // If the message includes a leading line number, strip it:
            const message = ex.message.replace(/^line \d+:/i, "").trim();
            const source = (ex.lineNumber) ? SourceCode.splitLines(text)[ex.lineNumber - 1] : null;

            messages.push({
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
            shebang = captured;
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

function determineCallsite(stack) {
    // discard the first frame
    stack.shift();

    // find the *next* frame outside a node_modules folder i.e. in user code
    var foundFrame = null;
    stack.some(function (stackFrame) {
        var stackFrameString = stackFrame.toString();

        if (stackFrameString.indexOf('node_modules') === -1) {
            foundFrame = stackFrame;
            return true;
        }
    });

    if (foundFrame) {
        return {
            fileName: foundFrame.getFileName(),
            lineNumber: foundFrame.getLineNumber()
        };
    } else {
        return null;
    }
}

function recordPendingInjection(injectionCallsite, recordedExchanges) {
    var sourceFileName = injectionCallsite.fileName,
        sourceLineNumber = injectionCallsite.lineNumber,
        sourceText = getSourceText(sourceFileName),
        // FIXME: Does not support tabs:
        indentationWidth = 4,
        detectedIndent = detectIndent(sourceText);
    if (detectedIndent) {
        indentationWidth = detectedIndent.amount;
    }
    var searchRegExp = /([ ]*)(.*)(['"])with http recorded and injected(\3,| )/g;
    /*
     * Ensure the search for the for the assertion string occurs from
     * the line number of the callsite until it is found. Since we can
     * only set an index within the source string to search from, we
     * must convert that line number to such an index.
     */
    searchRegExp.lastIndex = lineNumberToIndex(sourceText, sourceLineNumber);
    // NB: Return value of replace not used:
    var matchSearchRegExp = searchRegExp.exec(sourceText);
    if (matchSearchRegExp) {
        var lineIndentation = matchSearchRegExp[1],
            before = matchSearchRegExp[2],
            quote = matchSearchRegExp[3],
            after = matchSearchRegExp[4];

        (injectionsBySourceFileName[sourceFileName] = injectionsBySourceFileName[sourceFileName] || []).push({
            pos: matchSearchRegExp.index,
            length: matchSearchRegExp[0].length,
            replacement: lineIndentation + before + quote + 'with http mocked out' + quote + ', ' + stringify(recordedExchanges, indentationWidth).replace(/\n^/mg, '\n' + lineIndentation) + (after === ' ' ? ', ' + quote : ',')
        });
    } else {
        console.warn('unexpected-mitm: Could not find the right place to inject the recorded exchanges into ' + sourceFileName + ' (around line ' + sourceLineNumber + '): ' + stringify(recordedExchanges, indentationWidth, expect));
    }
}


const topLevelErrors = [];

after(function () {
    const fixesByFileName = {};
    topLevelErrors.forEach(function (topLevelError) {
        const injectionCallsite = topLevelError.callsite;
        const fileName = injectionCallsite.fileName;
        const sourceCode = getSourceCode(fileName);

        const fixes = [];
        new Traverser().traverse(sourceCode.ast, {
            enter(node, parent) {
                node.parent = parent;
                if (node.type === 'Identifier' && node.name === 'expect' && node.loc.start.line === injectionCallsite.lineNumber) {
                    (fixesByFileName[fileName] = fixesByFileName[fileName] || []).push({
                        fix: ruleFixer.insertTextAfter(node, 'foo')
                    });
                }
            },
            leave(node) {
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

let fixpect = function fixpect(...args) {
    let returnValue;
    let stack = callsite();
    try {
        returnValue = expect(...args);
    } catch (error) {
        topLevelErrors.push({callsite: determineCallsite(stack), error});
        throw error;
    }
    return returnValue.caught(function (error) {
        topLevelErrors.push({callsite: determineCallsite(stack), error});
        throw error;
    });
};

// Expose a fixpect.use etc.
Object.keys(expect).forEach(key => {
    if (typeof expect[key] === 'function') {
        fixpect[key] = expect[key].bind(expect);
    }
});

module.exports = fixpect;
