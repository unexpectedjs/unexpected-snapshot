const expect = require('unexpected').clone();
const indentString = require('../lib/indentString');
const { deindent } = require('@gustavnikolaj/string-utils');

expect.addAssertion('<string> to roundtrip', (expect, subject) => {
  expect(deindent(indentString(subject)), 'to equal', subject);
});

describe('stringSnapshot', () => {
  describe('indentString', () => {
    it('should indent a single line string', () => {
      expect(indentString('foo', 2), 'to equal', '\n  foo\n');
    });

    it('should indent an empty string', () => {
      expect(indentString('', 2), 'to equal', '\n\n');
    });

    it('should not indent empty lines', () => {
      expect(indentString('foo\n\nbar', 2), 'to equal', '\n  foo\n\n  bar\n');
    });

    it('should indent a line containing only spaces', () => {
      expect(
        indentString('foo\n  \nbar', 2),
        'to equal',
        '\n  foo\n    \n  bar\n'
      );
    });

    it('should indent a line ending with newline', () => {
      expect(indentString('foo\n', 2), 'to equal', '\n  foo\n\n');
    });
  });

  describe('indentString + deindent', () => {
    it('should roundtrip a single line string', () => {
      expect('foo', 'to roundtrip');
    });

    it('should roundtrip an empty string', () => {
      expect('', 'to roundtrip');
    });

    it('should round trip multiple lines including empty', () => {
      expect('foo\n\nbar', 'to roundtrip');
    });

    it('should round trip trailing whitespace', () => {
      expect('foo  ', 'to roundtrip');
    });

    it('should roundtrip a line ending with newline', () => {
      expect('foo\n', 'to roundtrip');
    });
  });
});
