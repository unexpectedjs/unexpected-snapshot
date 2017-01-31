var expect = require('./lib/fixpect');

describe('the test', function () {
    it('should foo', function () {
        expect('foo', 'to equal', 'bar');
    });
});
