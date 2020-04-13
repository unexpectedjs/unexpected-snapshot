const ruleFixer = require('eslint/lib/linter/rule-fixer');
const Traverser = require('eslint/lib/shared/traverser');
const isSimpleObjectTree = require('./isSimpleObjectTree');
const detectIndent = require('detect-indent');
const SourceCodeFixer = require('eslint/lib/linter/source-code-fixer');
const indentString = require('./indentString');
const prettyMaybe = require('pretty-maybe');
const camelCase = require('lodash.camelcase');

function stringify(obj, indentationWidth, inspect, expectName = 'expect') {
  if (obj.includes('\n') && !/^\n*[ \t]/.test(obj)) {
    return `${expectName}.unindent\`${indentString(
      obj.replace(/[`$]/g, '\\$&'),
      indentationWidth
    )}\``;
  } else {
    return inspect(obj, indentationWidth);
  }
}

// Only parse each file once, even though multiple fixes have to be applied:
const getSourceCodeMemoized = require('memoizesync')(
  require('./getSourceCode')
);

function getNodeIndent(node, sourceCode, byLastLine) {
  const token = byLastLine
    ? sourceCode.getLastToken(node)
    : sourceCode.getFirstToken(node);
  const srcCharsBeforeNode = sourceCode
    .getText(token, token.loc.start.column)
    .split('');
  const indentChars = srcCharsBeforeNode.slice(
    0,
    srcCharsBeforeNode.findIndex((char) => char !== ' ' && char !== '\t')
  );
  const spaces = indentChars.filter((char) => char === ' ').length;
  const tabs = indentChars.filter((char) => char === '\t').length;

  if (spaces > 0) {
    return ' '.repeat(spaces);
  } else if (tabs > 0) {
    return '\t'.repeat(tabs);
  } else {
    return '';
  }
}

function fixUnexpected(
  node,
  sourceCode,
  indentationWidth,
  { status, subject, inspect, assertionName }
) {
  // Take compound assertions into account:
  const assertionArgument =
    node.arguments[node.arguments.length - (status === 'missing' ? 1 : 2)];
  if (
    assertionArgument.type !== 'Literal' ||
    !assertionArgument.value.endsWith(assertionName) // Allow compound
  ) {
    throw new Error(
      `unexpected-snapshot could not find '${assertionName}' assertion to patch up. Note that expect.it is not supported`
    );
  }
  // Find the indentation of the literal being replaced,
  // falling back to that of 'to equal snapshot'
  let indent;
  if (node.arguments.length >= 3) {
    indent = getNodeIndent(node.arguments[2], sourceCode);
  } else {
    indent = getNodeIndent(node.arguments[1], sourceCode);
  }
  const fixes = [];
  let stringifiedSubject;
  let newAssertionName = assertionName;
  if (typeof subject === 'string' && assertionName === 'to equal snapshot') {
    stringifiedSubject = stringify(subject, indentationWidth, inspect).replace(
      /\n^(?=[^\n])/gm,
      `\n${indent}`
    );
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
  const newAssertionNameWithPrefix = assertionArgument.value.replace(
    assertionName,
    newAssertionName
  );

  if (status === 'missing') {
    if (newAssertionName === assertionName) {
      fixes.unshift(
        ruleFixer.insertTextAfter(assertionArgument, `, ${stringifiedSubject}`)
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
  return fixes;
}

function fixUnassessed(
  node,
  sourceCode,
  indentationWidth,
  { status, subject, inspect, assertionName }
) {
  // Find the indentation of the literal being replaced,
  // falling back to that of assess(...)
  let indent;
  if (node.arguments.length > 0) {
    indent = getNodeIndent(node.arguments[0], sourceCode);
  } else {
    // FIXME: Probably needs to be +1?
    indent = getNodeIndent(node, sourceCode);
  }
  const fixes = [];
  let stringifiedSubject;
  let newAssertionName = assertionName;
  if (typeof subject === 'string' && assertionName === 'to equal snapshot') {
    stringifiedSubject = stringify(
      subject,
      indentationWidth,
      inspect,
      node.callee.object.callee.name
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
      inspect,
      node.callee.object.callee.name
    ).replace(/\n^(?=[^\n])/gm, `\n${indent}`);
  }
  if (newAssertionName !== assertionName) {
    fixes.unshift(
      ruleFixer.replaceText(node.callee.property, camelCase(newAssertionName))
    );
  }

  if (status === 'missing') {
    const endParenToken = sourceCode.getLastToken(node);
    fixes.unshift(
      ruleFixer.insertTextBefore(endParenToken, stringifiedSubject)
    );
  } else if (status === 'mismatch') {
    fixes.unshift(ruleFixer.replaceText(node.arguments[0], stringifiedSubject));
  }
  return fixes;
}

function applyFixes(fixes) {
  const fixesByFileName = {};
  let numFixedExpects = 0;
  for (const fix of fixes) {
    const { fileName, lineNumber, columnNumber } = fix;
    const sourceCode = getSourceCodeMemoized(fileName);
    if (!sourceCode) {
      // Probably a parse error, give up.
      return;
    }
    let indentationWidth = 4;
    const detectedIndent = detectIndent(sourceCode.text);
    if (detectedIndent) {
      indentationWidth = detectedIndent.amount;
    }

    new Traverser().traverse(sourceCode.ast, {
      enter(node) {
        let appliedFixes;
        if (
          node.type === 'CallExpression' &&
          node.callee.type === 'Identifier' &&
          node.callee.name === 'expect' &&
          node.loc.start.line === lineNumber &&
          node.loc.start.column + 1 === columnNumber &&
          node.arguments.length >= 2
        ) {
          numFixedExpects += 1;

          appliedFixes = fixUnexpected(node, sourceCode, indentationWidth, fix);
        } else if (
          node.type === 'CallExpression' &&
          node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'CallExpression' &&
          node.callee.object.callee.type === 'Identifier' &&
          ['expect', 'assess'].includes(node.callee.object.callee.name) &&
          node.callee.property.type === 'Identifier' &&
          ['toEqualSnapshot', 'toInspectAsSnapshot'].includes(
            node.callee.property.name
          ) &&
          node.callee.property.loc.start.line === lineNumber &&
          node.callee.property.loc.start.column + 1 === columnNumber
        ) {
          numFixedExpects += 1;

          appliedFixes = fixUnassessed(node, sourceCode, indentationWidth, fix);
        }

        if (appliedFixes && appliedFixes.length > 0) {
          (fixesByFileName[fileName] = fixesByFileName[fileName] || []).push(
            ...appliedFixes
          );
        }
      },
    });
  }

  const fixedSourceTextByFileName = {};
  for (const fileName of Object.keys(fixesByFileName)) {
    var fixResult = SourceCodeFixer.applyFixes(
      getSourceCodeMemoized(fileName).text,
      fixesByFileName[fileName].map((fix) => ({ fix }))
    );

    if (fixResult.fixed) {
      let fixedCode = fixResult.output;
      if (
        !/^(?:0|false|off|no)$/.test(process.env.UNEXPECTED_SNAPSHOT_PRETTIER)
      ) {
        fixedCode = prettyMaybe.sync(fileName, fixedCode, {
          requireConfig: false,
        });
      }

      fixedSourceTextByFileName[fileName] = fixedCode;
    }
  }

  return { numFixedExpects, fixedSourceTextByFileName };
}

module.exports = applyFixes;
