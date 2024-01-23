const expect = require('unexpected');

function isSimpleObjectTree(obj) {
  const seen = new Set();
  return (function isSimple(obj) {
    if (seen.has(obj)) {
      return false; // Circular
    } else {
      const type = expect.findTypeOf(obj);
      if (type.name === 'array') {
        seen.add(obj);
        const result = obj.every(isSimple);
        seen.delete(obj);
        return result;
      } else if (type.name === 'object') {
        seen.add(obj);
        const result =
          obj.constructor === Object &&
          Object.getOwnPropertyNames(obj).every((name) =>
            isSimple(obj[name]),
          ) &&
          Object.getOwnPropertySymbols(obj).length === 0;
        seen.delete(obj);
        return result;
      } else {
        return [
          'any',
          'number',
          'NaN',
          'boolean',
          'regexp',
          'null',
          'undefined',
          'string',
          'Buffer',
          'date',
        ].includes(type.name);
      }
    }
  })(obj);
}

module.exports = isSimpleObjectTree;
