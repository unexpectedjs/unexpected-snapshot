const expect = require('unexpected').clone();
const isSimpleObjectTree = require('../lib/isSimpleObjectTree');

describe('isSimpleObjectTree', () => {
  it('should return true for a plain object', function() {
    expect(isSimpleObjectTree({ foo: 123 }, expect), 'to be true');
  });

  it('should return true for a plain array', function() {
    expect(isSimpleObjectTree(['foo', 123], expect), 'to be true');
  });

  it('should return true for a number', function() {
    expect(isSimpleObjectTree(123, expect), 'to be true');
  });

  it('should return true for a string', function() {
    expect(isSimpleObjectTree('foo', expect), 'to be true');
  });

  it('should return true for NaN', function() {
    expect(isSimpleObjectTree(NaN, expect), 'to be true');
  });

  it('should return true for a Buffer', function() {
    expect(isSimpleObjectTree(Buffer.from('abc'), expect), 'to be true');
  });

  it('should return true for undefined', function() {
    expect(isSimpleObjectTree(undefined, expect), 'to be true');
  });

  it('should return true for null', function() {
    expect(isSimpleObjectTree(null, expect), 'to be true');
  });

  it('should return false for a circular reference', function() {
    const obj = {};
    obj.foo = obj;
    expect(isSimpleObjectTree(obj, expect), 'to be false');
  });

  it('should return false for an non-plain object instance', function() {
    function Person(name) {
      this.name = name;
    }
    expect(isSimpleObjectTree(new Person('Foo'), expect), 'to be false');
  });
});
