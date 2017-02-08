const expect = require('unexpected');
const pathModule = require('path');
const fs = expect.promise.promisifyAll(require('fs'));
const childProcess = require('child_process');
const preamble = "var expect = require('" + pathModule.resolve(__dirname, '..', 'lib', 'fixpect.js') + "');\n";

expect.addAssertion('<string> to come out as <string>', (expect, subject, value) => {
    const tmpDir = pathModule.resolve(__dirname, 'tmp');
    const tmpFileName = pathModule.resolve(tmpDir, 'fixpect' + Math.round(10000000 * Math.random()) + '.js');

    return fs.mkdirAsync(tmpDir).catch(() => {}).then(() => {
        return fs.writeFileAsync(tmpFileName, preamble + subject, 'utf-8');
    }).then(() => {
        const command = process.argv[0] + ' ' + pathModule.resolve(__dirname, '..', 'node_modules', '.bin', 'mocha') + ' ' + tmpFileName;
        return expect.promise.fromNode(cb => {
            childProcess.exec(command, cb.bind(null, null));
        });
    }).then((stdout, stderr) => {
        return fs.readFileAsync(tmpFileName, 'utf-8');
    }).then(contents => {
        return expect(contents.substr(preamble.length), 'to equal', value);
    }).finally(() => fs.unlinkAsync(tmpFileName));
});

describe('fixpect', function () {
    describe('to equal', function () {
        it('should fix a failing string comparison', function () {
            return expect(`
                it('should foo', function () {
                    expect('foo', 'to equal', 'bar');
                });
            `, 'to come out as', `
                it('should foo', function () {
                    expect('foo', 'to equal', 'foo');
                });
            `);
        });

        it('should fix a failing multiline string comparison', function () {
            return expect(`
                it('should foo', function () {
                    var str = '';
                    for (var i = 0 ; i < 20 ; i += 1) {
                        str += 'abcdefghijklmnopqrstuvwxyz1234567890\\n';
                    }
                    expect(
                        str,
                        'to equal',
                        ''
                    );
                });
            `, 'to come out as', `
                it('should foo', function () {
                    var str = '';
                    for (var i = 0 ; i < 20 ; i += 1) {
                        str += 'abcdefghijklmnopqrstuvwxyz1234567890\\n';
                    }
                    expect(
                        str,
                        'to equal',
                        'abcdefghijklmnopqrstuvwxyz1234567890\\n' +
                        'abcdefghijklmnopqrstuvwxyz1234567890\\n' +
                        'abcdefghijklmnopqrstuvwxyz1234567890\\n' +
                        'abcdefghijklmnopqrstuvwxyz1234567890\\n' +
                        'abcdefghijklmnopqrstuvwxyz1234567890\\n' +
                        'abcdefghijklmnopqrstuvwxyz1234567890\\n' +
                        'abcdefghijklmnopqrstuvwxyz1234567890\\n' +
                        'abcdefghijklmnopqrstuvwxyz1234567890\\n' +
                        'abcdefghijklmnopqrstuvwxyz1234567890\\n' +
                        'abcdefghijklmnopqrstuvwxyz1234567890\\n' +
                        'abcdefghijklmnopqrstuvwxyz1234567890\\n' +
                        'abcdefghijklmnopqrstuvwxyz1234567890\\n' +
                        'abcdefghijklmnopqrstuvwxyz1234567890\\n' +
                        'abcdefghijklmnopqrstuvwxyz1234567890\\n' +
                        'abcdefghijklmnopqrstuvwxyz1234567890\\n' +
                        'abcdefghijklmnopqrstuvwxyz1234567890\\n' +
                        'abcdefghijklmnopqrstuvwxyz1234567890\\n' +
                        'abcdefghijklmnopqrstuvwxyz1234567890\\n' +
                        'abcdefghijklmnopqrstuvwxyz1234567890\\n' +
                        'abcdefghijklmnopqrstuvwxyz1234567890\\n'
                    );
                });
            `);
        });

        it('should fix a failing number comparison', function () {
            return expect(`
                it('should foo', function () {
                    expect(123, 'to equal', 456);
                });
            `, 'to come out as', `
                it('should foo', function () {
                    expect(123, 'to equal', 123);
                });
            `);
        });

        it('should fix a failing object comparison', function () {
            return expect(`
                it('should foo', function () {
                    expect({a: 456, b: {c: 789}}, 'to equal', 456);
                });
            `, 'to come out as', `
                it('should foo', function () {
                    expect({a: 456, b: {c: 789}}, 'to equal', { a: 456, b: { c: 789 } });
                });
            `);
        });

        it('should leave a failing "not to equal" alone', function () {
            return expect(`
                it('should foo', function () {
                    expect('foo', 'not to equal', 'foo');
                });
            `, 'to come out as', `
                it('should foo', function () {
                    expect('foo', 'not to equal', 'foo');
                });
            `);
        });
    });
});
