const expect = require('unexpected').clone();
const pathModule = require('path');
const fs = expect.promise.promisifyAll(require('fs'));
const childProcess = require('child_process');
const escodegen = require('escodegen');
const espree = require('espree');
const preamble = `var expect = require('unexpected').clone().use(require('${pathModule.resolve(
  __dirname,
  '..',
  'lib',
  'unexpected-snapshot.js'
)}'));\n`;

const tmpDir = pathModule.resolve(__dirname, 'tmp');

before(async () => {
  try {
    await fs.mkdirAsync(tmpDir);
  } catch (err) {}
});
after(async () => {
  try {
    await fs.rmdirAsync(tmpDir);
  } catch (err) {}
});

const parserOptions = { ecmaVersion: 9 };
function beautifyJavaScript(value) {
  let ast;
  if (typeof value === 'string') {
    ast = espree.parse(value, parserOptions);
  } else if (typeof value === 'function') {
    ast = espree.parse(`(${value.toString()})`, parserOptions).body[0]
      .expression.body;
  } else {
    ast = value;
  }
  return escodegen.generate(ast);
}

expect.addAssertion(
  '<string|function> to come out as <string|function>',
  async (expect, subject, value) => {
    subject = beautifyJavaScript(subject);
    value = beautifyJavaScript(value);
    const tmpFileName = pathModule.resolve(
      tmpDir,
      `unexpected-snapshot-${Math.round(10000000 * Math.random())}.js`
    );
    const testCommand = `${process.argv[0]} ${pathModule.resolve(
      __dirname,
      '..',
      'node_modules',
      '.bin',
      'mocha'
    )} ${tmpFileName}`;

    await fs.writeFileAsync(tmpFileName, preamble + subject, 'utf-8');
    try {
      const [err, stdout] = await expect.promise.fromNode(cb =>
        childProcess.exec(
          testCommand,
          { env: { ...process.env, UNEXPECTED_SNAPSHOT_UPDATE: 'on' } },
          cb.bind(null, null)
        )
      );

      if (err && err.code === 165) {
        throw new Error(`fixpect failed with: ${stdout}`);
      }

      const contents = await fs.readFileAsync(tmpFileName, 'utf-8');

      expect(
        beautifyJavaScript(contents.substr(preamble.length)),
        'to equal',
        value
      );
    } finally {
      await fs.unlinkAsync(tmpFileName);
    }
  }
);

describe('to match inline snapshot', function() {
  it('should fill in a missing string', function() {
    return expect(
      () => {
        it('should foo', function() {
          expect('foo', 'to match inline snapshot');
        });
      },
      'to come out as',
      () => {
        it('should foo', function() {
          expect('foo', 'to match inline snapshot', 'foo');
        });
      }
    );
  });

  it('should fill in a missing object', function() {
    return expect(
      () => {
        it('should foo', function() {
          expect({ foo: 'bar' }, 'to match inline snapshot');
        });
      },
      'to come out as',
      () => {
        it('should foo', function() {
          expect({ foo: 'bar' }, 'to match inline snapshot', { foo: 'bar' });
        });
      }
    );
  });

  it('should update a mismatching string', function() {
    return expect(
      () => {
        it('should foo', function() {
          expect('foo', 'to match inline snapshot', 'bar');
        });
      },
      'to come out as',
      () => {
        it('should foo', function() {
          expect('foo', 'to match inline snapshot', 'foo');
        });
      }
    );
  });
});
