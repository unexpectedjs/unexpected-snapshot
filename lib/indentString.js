function indentString(str, indentationWidth = 2) {
  const indent = ' '.repeat(indentationWidth);
  return `\n${str.replace(/^.*?$/gm, $0 => {
    if ($0) {
      return `${indent}${$0}`;
    } else {
      return '';
    }
  })}\n`;
}

module.exports = indentString;
