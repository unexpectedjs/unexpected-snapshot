const expect = require('unexpected').clone();
const { encode, decode } = require('../lib/stringSnapshot');

expect.addAssertion('<string> to roundtrip', (expect, subject) => {
  expect(decode(encode(subject)), 'to equal', subject);
});

describe('stringSnapshot', () => {
  describe('encode', () => {
    it('should indent a single line string', () => {
      expect(encode('foo', 2), 'to equal', '\n  foo\n');
    });

    it('should indent an empty string', () => {
      expect(encode('', 2), 'to equal', '\n\n');
    });

    it('should not indent empty lines', () => {
      expect(encode('foo\n\nbar', 2), 'to equal', '\n  foo\n\n  bar\n');
    });

    it('should indent a line containing only spaces', () => {
      expect(encode('foo\n  \nbar', 2), 'to equal', '\n  foo\n    \n  bar\n');
    });

    it('should indent a line ending with newline', () => {
      expect(encode('foo\n', 2), 'to equal', '\n  foo\n\n');
    });
  });

  describe('decode', () => {
    it('should throw if the newline at the start is missing', () => {
      expect(
        () => decode('blah'),
        'to throw',
        'Missing leading newline in snapshot'
      );
    });

    it('should throw if the newline at the end is missing', () => {
      expect(
        () => decode('\n  foo'),
        'to throw',
        'Missing trailing newline in snapshot'
      );
    });
  });

  describe('encode + decode', () => {
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
  });
});
