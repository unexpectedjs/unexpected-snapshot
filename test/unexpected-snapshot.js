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
    ast = {
      type: 'Program',
      body: espree.parse(`(${value.toString()})`, parserOptions).body[0]
        .expression.body.body
    };
  } else {
    ast = value;
  }
  return escodegen.generate(ast, { format: { indent: { style: '  ' } } });
}

async function writeTestToTemporaryFile(code) {
  const tmpFileName = pathModule.resolve(
    tmpDir,
    `unexpected-snapshot-${Math.round(10000000 * Math.random())}.js`
  );
  await fs.writeFileAsync(tmpFileName, preamble + code, 'utf-8');
  return tmpFileName;
}

async function runWithMocha(fileName, env = {}) {
  const testCommand = `${process.argv[0]} ${pathModule.resolve(
    __dirname,
    '..',
    'node_modules',
    '.bin',
    'mocha'
  )} ${fileName}`;
  const [err, stdout] = await expect.promise.fromNode(cb =>
    childProcess.exec(
      testCommand,
      { env: { ...process.env, ...env } },
      cb.bind(null, null)
    )
  );
  return [err, stdout];
}

expect.addAssertion(
  '<string|function> to come out unaltered',
  async (expect, subject) => {
    subject = beautifyJavaScript(subject);
    const tmpFileName = await writeTestToTemporaryFile(subject);
    await runWithMocha(tmpFileName, {
      UNEXPECTED_SNAPSHOT_UPDATE: 'on'
    });
    const output = (await fs.readFileAsync(tmpFileName, 'utf-8')).substr(
      preamble.length
    );
    expect(beautifyJavaScript(output), 'to equal', subject);
  }
);

expect.addAssertion(
  '<string|function> to come out as [exactly] <string|function>',
  async (expect, subject, value) => {
    if (!expect.flags.exactly) {
      subject = beautifyJavaScript(subject);
      value = beautifyJavaScript(value);
    }
    const tmpFileName = await writeTestToTemporaryFile(subject);

    try {
      const [err, stdout] = await runWithMocha(tmpFileName, {
        UNEXPECTED_SNAPSHOT_UPDATE: 'on'
      });

      if (err && err.code === 165) {
        throw new Error(`mocha failed with: ${stdout}`);
      }

      let output = (await fs.readFileAsync(tmpFileName, 'utf-8')).substr(
        preamble.length
      );
      if (!expect.flags.exactly) {
        output = beautifyJavaScript(output);
      }
      expect(output, 'to equal', value);

      // Execute the test that now has the snapshot injected to
      // assert that it now passes:

      const [err2, stdout2] = await runWithMocha(tmpFileName);

      if (err2) {
        expect.fail(stdout2);
      }
    } finally {
      await fs.unlinkAsync(tmpFileName);
    }
  }
);

describe('to equal snapshot', function() {
  it('should fill in a missing single line string', function() {
    return expect(
      `
it('should foo', function() {
  expect('foo', 'to equal snapshot');
});
      `,
      'to come out as exactly',
      `
it('should foo', function() {
  expect('foo', 'to equal snapshot', 'foo');
});
      `
    );
  });

  it('should fill in a missing string with a trailing newline', function() {
    return expect(
      `
it('should foo', function() {
  expect('foo\\n', 'to equal snapshot');
});
      `,
      'to come out as exactly',
      `
it('should foo', function() {
  expect('foo\\n', 'to equal snapshot', expect.unindent\`
    foo

  \`);
});
      `
    );
  });

  it('should base the indent on the literal being replaced', function() {
    return expect(
      `
it('should foo', function() {
  expect(
    'foo',
    'to equal snapshot',
    'bar'
  );
});
      `,
      'to come out as exactly',
      `
it('should foo', function() {
  expect(
    'foo',
    'to equal snapshot',
    'foo'
  );
});
      `
    );
  });

  describe('with a multi line string', function() {
    it('should inject a template string with indentation', function() {
      return expect(
        `
it('should foo', function() {
  expect('foo\\nbar', 'to equal snapshot');
});
        `,
        'to come out as exactly',
        `
it('should foo', function() {
  expect('foo\\nbar', 'to equal snapshot', expect.unindent\`
    foo
    bar
  \`);
});
        `
      );
    });

    it('should inject a template string at 3x2 space indent', function() {
      return expect(
        `
if (true) {
  it('should foo', function() {
    expect('foo\\nbar', 'to equal snapshot');
  });
}
        `,
        'to come out as exactly',
        `
if (true) {
  it('should foo', function() {
    expect('foo\\nbar', 'to equal snapshot', expect.unindent\`
      foo
      bar
    \`);
  });
}
        `
      );
    });

    it('should inject a template string at 3x4 space indent', function() {
      return expect(
        `
if (true) {
    it('should foo', function() {
        expect('foo\\nbar', 'to equal snapshot');
    });
}
        `,
        'to come out as exactly',
        `
if (true) {
    it('should foo', function() {
        expect('foo\\nbar', 'to equal snapshot', expect.unindent\`
            foo
            bar
        \`);
    });
}
        `
      );
    });
  });

  it('should update a mismatching string', function() {
    return expect(
      `
it('should foo', function() {
  expect('foo', 'to equal snapshot', expect.unindent\`
    bar
  \`);
});
      `,
      'to come out as',
      `
it('should foo', function() {
  expect('foo', 'to equal snapshot', 'foo');
});
      `
    );
  });

  it('should update a mismatching oneline string', function() {
    return expect(
      `
it('should foo', function() {
  expect('foo', 'to equal snapshot', 'bar');
});
      `,
      'to come out as',
      `
it('should foo', function() {
  expect('foo', 'to equal snapshot', 'foo');
});
      `
    );
  });

  it('should not precede empty lines with spaces', function() {
    return expect(
      `
it('should foo', function() {
  expect('foo\\n\\nbar', 'to equal snapshot');
});
        `,
      'to come out as exactly',
      `
it('should foo', function() {
  expect('foo\\n\\nbar', 'to equal snapshot', expect.unindent\`
    foo

    bar
  \`);
});
        `
    );
  });

  it('should indent whitespace-only lines', function() {
    // The last space is escaped as \x20 to avoid being
    // in conflict with .editorconfig
    return expect(
      `
it('should foo', function() {
  expect('foo\\n \\nbar', 'to equal snapshot');
});
        `,
      'to come out as exactly',
      `
it('should foo', function() {
  expect('foo\\n \\nbar', 'to equal snapshot', expect.unindent\`
    foo
    \x20
    bar
  \`);
});
        `
    );
  });

  it('should fill in a missing object', function() {
    return expect(
      () => {
        it('should foo', function() {
          expect({ foo: 'bar' }, 'to equal snapshot');
        });
      },
      'to come out as',
      () => {
        it('should foo', function() {
          expect({ foo: 'bar' }, 'to equal snapshot', { foo: 'bar' });
        });
      }
    );
  });

  it('should fill in a missing array', function() {
    return expect(
      () => {
        it('should foo', function() {
          expect([123, 'abc'], 'to equal snapshot');
        });
      },
      'to come out as',
      () => {
        it('should foo', function() {
          expect([123, 'abc'], 'to equal snapshot', [123, 'abc']);
        });
      }
    );
  });

  it('should switch to "to inspect as snapshot" when the subject contains a circular reference', function() {
    return expect(
      () => {
        it('should foo', function() {
          const foo = { bar: 123 };
          foo.quux = foo;
          expect(foo, 'to equal snapshot');
        });
      },
      'to come out as',
      function() {
        it('should foo', function() {
          const foo = { bar: 123 };
          foo.quux = foo;
          expect(
            foo,
            'to inspect as snapshot',
            '{ bar: 123, quux: [Circular] }'
          );
        });
      }
    );
  });

  it('should switch to "to inspect as snapshot" when the subject contains an object that does not have Object.prototype as its constructor', function() {
    return expect(
      () => {
        it('should foo', function() {
          function Person(name) {
            this.name = name;
          }
          expect(new Person('Eigil'), 'to equal snapshot');
        });
      },
      'to come out as',
      function() {
        it('should foo', function() {
          function Person(name) {
            this.name = name;
          }
          expect(
            new Person('Eigil'),
            'to inspect as snapshot',
            "Person({ name: 'Eigil' })"
          );
        });
      }
    );
  });

  it('should support injecting certain safe built-in types in a literal snapshot', function() {
    return expect(
      () => {
        it('should foo', function() {
          expect(
            {
              date: new Date('2019-05-09T12:34:56.789Z'),
              buffer: Buffer.from([0xde, 0xad, 0xbe, 0xef]),
              undefined: undefined,
              null: null,
              NaN: NaN,
              Infinity: Infinity,
              number: 123.456,
              regexp: /abc(?:)/gim
            },
            'to equal snapshot'
          );
        });
      },
      'to come out as',
      () => {
        it('should foo', function() {
          expect(
            {
              date: new Date('2019-05-09T12:34:56.789Z'),
              buffer: Buffer.from([0xde, 0xad, 0xbe, 0xef]),
              undefined: undefined,
              null: null,
              NaN: NaN,
              Infinity: Infinity,
              number: 123.456,
              regexp: /abc(?:)/gim
            },
            'to equal snapshot',
            {
              date: new Date('Thu, 09 May 2019 12:34:56.789 GMT'),
              buffer: Buffer.from([0xde, 0xad, 0xbe, 0xef]),
              undefined: undefined,
              null: null,
              NaN: NaN,
              Infinity: Infinity,
              number: 123.456,
              regexp: /abc(?:)/gim
            }
          );
        });
      }
    );
  });

  describe.skip('with expect.it', function() {
    it('should fill in a missing string', function() {
      return expect(
        () => {
          it('should foo', function() {
            expect({ bar: 'foo' }, 'to satisfy', {
              bar: expect.it('to equal snapshot')
            });
          });
        },
        'to come out as',
        () => {
          it('should foo', function() {
            expect({ bar: 'foo' }, 'to satisfy', {
              bar: expect.it('to equal snapshot', 'foo')
            });
          });
        }
      );
    });

    it('should fill in a missing object', function() {
      return expect(
        () => {
          it('should foo', function() {
            expect({ foo: { bar: 'quux' } }, 'to satisfy', {
              foo: expect.it('to equal snapshot')
            });
          });
        },
        'to come out as',
        () => {
          it('should foo', function() {
            expect({ foo: { bar: 'quux' } }, 'to satisfy', {
              foo: expect.it('to equal snapshot', {
                bar: 'quux'
              })
            });
          });
        }
      );
    });
  });
});
