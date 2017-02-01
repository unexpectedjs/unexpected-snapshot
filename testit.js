var expect = require('./lib/fixpect');

describe('the test', function () {
    it('should foo', function () {
        expect('foo', 'to equal', 'bar');
    });

    it('should work with a complex to satisfy', function () {
        expect({foo: 123, bar: 456}, 'to satisfy', {
            foo: 123,
            bar: 789
        });
    });
});
