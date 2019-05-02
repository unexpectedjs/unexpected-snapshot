const { deindent } = require('@gustavnikolaj/string-utils');

function encode(str, indentationWidth = 2) {
  const indent = ' '.repeat(indentationWidth);
  return `\n${str.replace(/^.*?$/gm, $0 => {
    if ($0) {
      return `${indent}${$0}`;
    } else {
      return '';
    }
  })}\n`;
}

function decode(str) {
  if (!/^\n/.test(str)) {
    throw new Error('Missing leading newline in snapshot');
  }
  if (!/\n[\t\s]*$/.test(str)) {
    throw new Error('Missing trailing newline in snapshot');
  }
  return deindent(str.replace(/^\n|\n[\t\s]*$/g, ''));
}

module.exports = { encode, decode };
