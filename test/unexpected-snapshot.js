/* eslint-disable object-shorthand, mocha/no-nested-tests, mocha/no-identical-title */

describe('with snapshot updating on', function () {
  const expect = require('unexpected').clone();
  const pathModule = require('path');
  const fs = expect.promise.promisifyAll(require('fs'));
  const childProcess = require('child_process');
  const escodegen = require('escodegen');
  const espree = require('espree');
  const preambleByType = {
    unexpected: `var expect = require('${require.resolve(
      'unexpected',
    )}').clone().use(require('${pathModule.resolve(
      __dirname,
      '..',
      'lib',
      'unexpected-snapshot.js',
    )}'));\n// END PREAMBLE\n`,
    unassessed: `var assess = require('${require.resolve(
      'unassessed',
    )}').withUnexpectedPlugins(require('${pathModule.resolve(
      __dirname,
      '..',
      'lib',
      'unexpected-snapshot.js',
    )}'));\n// END PREAMBLE\n`,
  };
  const tmpDir = pathModule.resolve(
    require('os').tmpdir(),
    `unexpected-snapshot-test-${Date.now()}-${process.pid}`,
  );

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
          .expression.body.body,
      };
    } else {
      ast = value;
    }
    return escodegen.generate(ast, { format: { indent: { style: '  ' } } });
  }

  async function writeTestToTemporaryFile(code, type = 'unexpected') {
    const tmpFileName = pathModule.resolve(
      tmpDir,
      `unexpected-snapshot-${Math.round(10000000 * Math.random())}.js`,
    );
    await fs.writeFileAsync(tmpFileName, preambleByType[type] + code, 'utf-8');
    return tmpFileName;
  }

  async function runWithMocha(fileNames, env = {}) {
    if (!Array.isArray(fileNames)) {
      fileNames = [fileNames];
    }
    const testCommand = `${process.argv[0]} ${pathModule.resolve(
      __dirname,
      '..',
      'node_modules',
      '.bin',
      'mocha',
    )} ${fileNames.join(' ')}`;
    const [err, stdout, stderr] = await expect.promise.fromNode((cb) =>
      childProcess.exec(
        testCommand,
        { env: { ...process.env, ...env } },
        cb.bind(null, null),
      ),
    );
    return [err, stdout, stderr];
  }

  expect.addAssertion(
    '<string|function> [with unassessed] to come out unaltered',
    async (expect, subject) => {
      subject = beautifyJavaScript(subject);
      const type = expect.flags['with unassessed']
        ? 'unassessed'
        : 'unexpected';
      const tmpFileName = await writeTestToTemporaryFile(subject, type);
      await runWithMocha(tmpFileName, {
        UNEXPECTED_SNAPSHOT: 'on',
      });
      const preamble =
        preambleByType[
          expect.flags['with unassessed'] ? 'unassessed' : 'unexpected'
        ];
      const output = (await fs.readFileAsync(tmpFileName, 'utf-8')).substr(
        preamble.length,
      );
      expect(beautifyJavaScript(output), 'to equal', subject);
    },
  );

  expect.addAssertion(
    '<string|function> [with prettier enabled] [with unassessed] to come out as [exactly] <string|function>',
    async (expect, subject, value) => {
      if (!expect.flags.exactly) {
        subject = beautifyJavaScript(subject);
        value = beautifyJavaScript(value);
      }
      const type = expect.flags['with unassessed']
        ? 'unassessed'
        : 'unexpected';
      const tmpFileName = await writeTestToTemporaryFile(subject, type);
      expect.errorMode = 'nested';

      const prettier = expect.flags['with prettier enabled'];
      let prettierRcFileName;
      if (prettier) {
        prettierRcFileName = pathModule.join(tmpDir, '.prettierrc');
        await fs.writeFileAsync(prettierRcFileName, '{"singleQuote": true}\n');
      }

      try {
        const [err, stdout, stderr] = await runWithMocha(tmpFileName, {
          UNEXPECTED_SNAPSHOT_PRETTIER: prettier ? 'on' : 'off',
          UNEXPECTED_SNAPSHOT: 'on',
        });
        if (stderr) {
          throw new Error(stderr);
        }

        if (err && err.code === 165) {
          throw new Error(`mocha failed with: ${stdout}`);
        }

        let output = (await fs.readFileAsync(tmpFileName, 'utf-8')).replace(
          /^[\s\S]*?\/\/ END PREAMBLE\n/,
          '',
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
        if (prettierRcFileName) {
          await fs.unlinkAsync(prettierRcFileName);
        }
        await fs.unlinkAsync(tmpFileName);
      }
    },
  );

  describe('inspect as snapshot', () => {
    it('should fill in a missing snapshot', function () {
      return expect(
        () => {
          it('should foo', function () {
            expect(['a', 'b', 'c'], 'to inspect as snapshot');
          });
        },
        'to come out as',
        () => {
          it('should foo', function () {
            expect(
              ['a', 'b', 'c'],
              'to inspect as snapshot',
              "[ 'a', 'b', 'c' ]",
            );
          });
        },
      );
    });

    it('should update incorrect snapshots', function () {
      return expect(
        () => {
          it('should foo', function () {
            expect(
              ['a', 'b', 'c'],
              'to inspect as snapshot',
              "['a', 'b', 'c']",
            );
          });
        },
        'to come out as',
        () => {
          it('should foo', function () {
            expect(
              ['a', 'b', 'c'],
              'to inspect as snapshot',
              "[ 'a', 'b', 'c' ]",
            );
          });
        },
      );
    });

    it('supports inspected snapshots on shifted subjects', () => {
      return expect(
        () => {
          it('should foo', function () {
            expect(
              ['c', 'a', 'b'],
              'when sorted',
              'to inspect as snapshot',
              "['a', 'b', 'c']",
            );
          });
        },
        'to come out as',
        () => {
          it('should foo', function () {
            expect(
              ['c', 'a', 'b'],
              'when sorted',
              'to inspect as snapshot',
              "[ 'a', 'b', 'c' ]",
            );
          });
        },
      );
    });

    it('inspects with infinite depth', () => {
      return expect(
        () => {
          it('should foo', function () {
            expect(
              {
                down: { the: { rabbit: { hole: { you: { find: 'Alice' } } } } },
              },
              'to inspect as snapshot',
              '{ down: { the: { rabbit: { hole: {} } } } }',
            );
          });
        },
        'to come out as',
        () => {
          it('should foo', function () {
            expect(
              {
                down: { the: { rabbit: { hole: { you: { find: 'Alice' } } } } },
              },
              'to inspect as snapshot',
              "{ down: { the: { rabbit: { hole: { you: { find: 'Alice' } } } } } }",
            );
          });
        },
      );
    });

    describe('with unassessed', function () {
      /* global assess */
      it('should fill in a missing snapshot', function () {
        return expect(
          () => {
            it('should foo', function () {
              assess(['a', 'b', 'c']).toInspectAsSnapshot();
            });
          },
          'with unassessed to come out as',
          () => {
            it('should foo', function () {
              assess(['a', 'b', 'c']).toInspectAsSnapshot("[ 'a', 'b', 'c' ]");
            });
          },
        );
      });

      it('should update incorrect snapshots', function () {
        return expect(
          () => {
            it('should foo', function () {
              assess(['a', 'b', 'c']).toInspectAsSnapshot("['a', 'b', 'c']");
            });
          },
          'with unassessed to come out as',
          () => {
            it('should foo', function () {
              assess(['a', 'b', 'c']).toInspectAsSnapshot("[ 'a', 'b', 'c' ]");
            });
          },
        );
      });
    });
  });

  describe('to equal snapshot', function () {
    it('should fill in a missing single line string', function () {
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
      `,
      );
    });

    it('should fill in a missing string with a trailing newline', function () {
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
      `,
      );
    });

    it('should fill in a missing string with a dollar sign', function () {
      return expect(
        `
it('should foo', function() {
  expect('\\\${foo}\\n', 'to equal snapshot');
});
      `,
        'to come out as exactly',
        `
it('should foo', function() {
  expect('\\\${foo}\\n', 'to equal snapshot', expect.unindent\`
    \\\${foo}

  \`);
});
      `,
      );
    });

    it('should opt out of the expect.unindent mode when a multiline string starts with newlines followed by space', function () {
      return expect(
        `
it('should foo', function() {
  expect('\\n foo', 'to equal snapshot');
});
      `,
        'to come out as exactly',
        `
it('should foo', function() {
  expect('\\n foo', 'to equal snapshot', '\\n foo');
});
      `,
      );
    });

    it('should opt out of the expect.unindent mode when a multiline string starts with space', function () {
      return expect(
        `
it('should foo', function() {
  expect(' foo\\n', 'to equal snapshot');
});
      `,
        'to come out as exactly',
        `
it('should foo', function() {
  expect(' foo\\n', 'to equal snapshot', ' foo\\n');
});
      `,
      );
    });

    it('should base the indent on the literal being replaced', function () {
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
      `,
      );
    });

    it('should escape backticks in injected multiline snapshot', function () {
      return expect(
        `
it('should foo', function() {
  expect(
    'foo\`\\nbar\`',
    'to equal snapshot',
    'bar'
  );
});
      `,
        'to come out as exactly',
        `
it('should foo', function() {
  expect(
    'foo\`\\nbar\`',
    'to equal snapshot',
    expect.unindent\`
      foo\\\`
      bar\\\`
    \`
  );
});
      `,
      );
    });

    describe('with a multi line string', function () {
      it('should inject a template string with indentation', function () {
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
        `,
        );
      });

      it('should inject a template string at 3x2 space indent', function () {
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
        `,
        );
      });

      it('should inject a template string at 3x4 space indent', function () {
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
        `,
        );
      });
    });

    it('should update a mismatching string', function () {
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
      `,
      );
    });

    it('should update a mismatching oneline string', function () {
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
      `,
      );
    });

    it('should not precede empty lines with spaces', function () {
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
        `,
      );
    });

    it('should indent whitespace-only lines', function () {
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
        `,
      );
    });

    it('should fill in a missing object', function () {
      return expect(
        () => {
          it('should foo', function () {
            expect({ foo: 'bar' }, 'to equal snapshot');
          });
        },
        'to come out as',
        () => {
          it('should foo', function () {
            expect({ foo: 'bar' }, 'to equal snapshot', { foo: 'bar' });
          });
        },
      );
    });

    it('should fill in a missing array', function () {
      return expect(
        () => {
          it('should foo', function () {
            expect([123, 'abc'], 'to equal snapshot');
          });
        },
        'to come out as',
        () => {
          it('should foo', function () {
            expect([123, 'abc'], 'to equal snapshot', [123, 'abc']);
          });
        },
      );
    });

    describe('when the subject contains a circular reference', function () {
      it('should switch to "to inspect as snapshot"', function () {
        return expect(
          () => {
            it('should foo', function () {
              const foo = { bar: 123 };
              foo.quux = foo;
              expect(foo, 'to equal snapshot');
            });
          },
          'to come out as',
          function () {
            it('should foo', function () {
              const foo = { bar: 123 };
              foo.quux = foo;
              expect(
                foo,
                'to inspect as snapshot',
                '{ bar: 123, quux: [Circular] }',
              );
            });
          },
        );
      });

      describe('with a compound assertion', function () {
        it('should switch to "to inspect as snapshot"', function () {
          return expect(
            () => {
              expect.addAssertion('<any> noop <assertion>', (expect) =>
                expect.shift(),
              );

              it('should foo', function () {
                const foo = { bar: 123 };
                foo.quux = foo;
                expect(foo, 'noop to equal snapshot', { bar: 456 });
              });
            },
            'to come out as',
            function () {
              expect.addAssertion('<any> noop <assertion>', (expect) =>
                expect.shift(),
              );

              it('should foo', function () {
                const foo = { bar: 123 };
                foo.quux = foo;
                expect(
                  foo,
                  'noop to inspect as snapshot',
                  '{ bar: 123, quux: [Circular] }',
                );
              });
            },
          );
        });

        describe('and no current snapshot', function () {
          it('should switch to "to inspect as snapshot"', function () {
            return expect(
              () => {
                expect.addAssertion('<any> noop <assertion>', (expect) =>
                  expect.shift(),
                );

                it('should foo', function () {
                  const foo = { bar: 123 };
                  foo.quux = foo;
                  expect(foo, 'noop to equal snapshot');
                });
              },
              'to come out as',
              function () {
                expect.addAssertion('<any> noop <assertion>', (expect) =>
                  expect.shift(),
                );

                it('should foo', function () {
                  const foo = { bar: 123 };
                  foo.quux = foo;
                  expect(
                    foo,
                    'noop to inspect as snapshot',
                    '{ bar: 123, quux: [Circular] }',
                  );
                });
              },
            );
          });
        });
      });
    });

    it('should switch to "to inspect as snapshot" when the subject contains an object that does not have Object.prototype as its constructor', function () {
      return expect(
        () => {
          it('should foo', function () {
            function Person(name) {
              this.name = name;
            }
            expect(new Person('Eigil'), 'to equal snapshot');
          });
        },
        'to come out as',
        function () {
          it('should foo', function () {
            function Person(name) {
              this.name = name;
            }
            expect(
              new Person('Eigil'),
              'to inspect as snapshot',
              "Person({ name: 'Eigil' })",
            );
          });
        },
      );
    });

    it('should support injecting certain safe built-in types in a literal snapshot', function () {
      return expect(
        () => {
          it('should foo', function () {
            expect(
              {
                date: new Date('2019-05-09T12:34:56.789Z'),
                buffer: Buffer.from([0xde, 0xad, 0xbe, 0xef]),
                undefined: undefined,
                null: null,
                NaN: NaN,
                Infinity: Infinity,
                number: 123.456,
                regexp: /abc(?:)/gim,
              },
              'to equal snapshot',
            );
          });
        },
        'to come out as',
        () => {
          it('should foo', function () {
            expect(
              {
                date: new Date('2019-05-09T12:34:56.789Z'),
                buffer: Buffer.from([0xde, 0xad, 0xbe, 0xef]),
                undefined: undefined,
                null: null,
                NaN: NaN,
                Infinity: Infinity,
                number: 123.456,
                regexp: /abc(?:)/gim,
              },
              'to equal snapshot',
              {
                date: new Date('2019-05-09T12:34:56.789Z'),
                buffer: Buffer.from([0xde, 0xad, 0xbe, 0xef]),
                undefined: undefined,
                null: null,
                NaN: NaN,
                Infinity: Infinity,
                number: 123.456,
                regexp: /abc(?:)/gim,
              },
            );
          });
        },
      );
    });

    it('supports matching snapshots on shifted subjects', () => {
      return expect(
        () => {
          it('should foo', function () {
            expect(['c', 'a', 'b'], 'when sorted', 'to equal snapshot', [
              'a',
              'b',
            ]);
          });
        },
        'to come out as',
        () => {
          it('should foo', function () {
            expect(['c', 'a', 'b'], 'when sorted', 'to equal snapshot', [
              'a',
              'b',
              'c',
            ]);
          });
        },
      );
    });

    it('inspects with infinite depth', () => {
      return expect(
        () => {
          it('should foo', function () {
            expect(
              {
                down: { the: { rabbit: { hole: { you: { find: 'Alice' } } } } },
              },
              'to equal snapshot',
              { down: { the: { rabbit: { hole: {} } } } },
            );
          });
        },
        'to come out as',
        () => {
          it('should foo', function () {
            expect(
              {
                down: { the: { rabbit: { hole: { you: { find: 'Alice' } } } } },
              },
              'to equal snapshot',
              {
                down: { the: { rabbit: { hole: { you: { find: 'Alice' } } } } },
              },
            );
          });
        },
      );
    });

    describe.skip('with expect.it', function () {
      it('should fill in a missing string', function () {
        return expect(
          () => {
            it('should foo', function () {
              expect({ bar: 'foo' }, 'to satisfy', {
                bar: expect.it('to equal snapshot'),
              });
            });
          },
          'to come out as',
          () => {
            it('should foo', function () {
              expect({ bar: 'foo' }, 'to satisfy', {
                bar: expect.it('to equal snapshot', 'foo'),
              });
            });
          },
        );
      });

      it('should fill in a missing object', function () {
        return expect(
          () => {
            it('should foo', function () {
              expect({ foo: { bar: 'quux' } }, 'to satisfy', {
                foo: expect.it('to equal snapshot'),
              });
            });
          },
          'to come out as',
          () => {
            it('should foo', function () {
              expect({ foo: { bar: 'quux' } }, 'to satisfy', {
                foo: expect.it('to equal snapshot', {
                  bar: 'quux',
                }),
              });
            });
          },
        );
      });
    });

    describe('with changes due in multiple test files using different instances of the plugin', function () {
      it('should rewrite both files', async function () {
        const src = `
          it("should foo", function() {
            expect("foo", "to equal snapshot");
          });
        `;
        const tmpFileNames = await Promise.all([
          writeTestToTemporaryFile(src),
          writeTestToTemporaryFile(src),
        ]);

        await runWithMocha(tmpFileNames, {
          UNEXPECTED_SNAPSHOT: 'on',
        });
        const fixedSrcs = await Promise.all(
          tmpFileNames.map((fileName) => fs.readFileAsync(fileName, 'utf-8')),
        );
        expect(
          fixedSrcs,
          'to have items satisfying to contain',
          `expect("foo", "to equal snapshot", "foo");`,
        );
      });
    });

    describe('with prettier', function () {
      it('should not format when there are no updated', function () {
        return expect(
          `
it('should foo', function() {
  expect('foo',
'to equal snapshot', 'foo'
  );
});
`,
          'with prettier enabled to come out as exactly',
          `
it('should foo', function() {
  expect('foo',
'to equal snapshot', 'foo'
  );
});
`,
        );
      });

      it('should format the updated file', function () {
        return expect(
          `
it('should foo', function() {
  expect(
    'foo',
'to equal snapshot'
  );
});
      `,
          'with prettier enabled to come out as exactly',
          `
it('should foo', function () {
  expect('foo', 'to equal snapshot', 'foo');
});
`,
        );
      });
    });
  });

  describe('with unassessed', function () {
    describe('when filling in a missing snapshot', function () {
      it('should fill in a single-line string', function () {
        return expect(
          () => {
            it('should foo', function () {
              assess('foo').toEqualSnapshot();
            });
          },
          'with unassessed to come out as',
          () => {
            it('should foo', function () {
              assess('foo').toEqualSnapshot('foo');
            });
          },
        );
      });

      it('should convert to .toInspectAsSnapshot', function () {
        return expect(
          () => {
            it('should foo', function () {
              const foo = { bar: 123 };
              foo.quux = foo;
              assess(foo).toEqualSnapshot();
            });
          },
          'with unassessed to come out as',
          () => {
            it('should foo', function () {
              const foo = { bar: 123 };
              foo.quux = foo;
              assess(foo).toInspectAsSnapshot('{ bar: 123, quux: [Circular] }');
            });
          },
        );
      });

      it('should fill in a multi-line string', function () {
        return expect(
          `
it('should foo', function() {
  assess('foo\\nbar\\nbaz').toEqualSnapshot();
});
`,
          'with unassessed to come out as exactly',
          `
it('should foo', function() {
  assess('foo\\nbar\\nbaz').toEqualSnapshot(assess.unindent\`
    foo
    bar
    baz
  \`);
});
`,
        );
      });
    });

    describe('when updating an existing snapshot', function () {
      it('should update with a single-line string', function () {
        return expect(
          () => {
            it('should foo', function () {
              assess('foo').toEqualSnapshot('bar');
            });
          },
          'with unassessed to come out as',
          () => {
            it('should foo', function () {
              assess('foo').toEqualSnapshot('foo');
            });
          },
        );
      });
    });
  });
});

describe('with snapshot updating off', function () {
  const expect = require('unexpected').clone().use(require('..'));

  describe('to equal snapshot', function () {
    it('fails if a snapshot is not given', () => {
      expect(
        () => {
          expect(42, 'to equal snapshot');
        },
        'to throw',
        'expected 42 to equal snapshot\n' +
          '\n' +
          'Rerun the tests with UNEXPECTED_SNAPSHOT=yes in Node to update the snapshots',
      );
    });

    it('passes if the snapshot matches', () => {
      expect(() => {
        expect(42, 'to equal snapshot', 42);
      }, 'not to throw');
    });

    it("fails if the snapshot doesn't match", () => {
      expect(
        () => {
          expect(42, 'to equal snapshot', 666);
        },
        'to throw',
        'expected 42 to equal snapshot 666\n' +
          '\n' +
          'Rerun the tests with UNEXPECTED_SNAPSHOT=yes in Node to update the snapshots',
      );
    });

    it('inspects with infinite depth', () => {
      expect(() => {
        expect(
          { down: { the: { rabbit: { hole: { you: { find: 'Alice' } } } } } },
          'to equal snapshot',
          { down: { the: { rabbit: { hole: { you: { find: 'Alice' } } } } } },
        );
      }, 'not to throw');
    });
  });

  describe('to inspect as snapshot', function () {
    it('fails if a snapshot is not given', () => {
      expect(
        () => {
          expect(42, 'to inspect as snapshot');
        },
        'to throw',
        'expected 42 to inspect as snapshot\n' +
          '\n' +
          'Rerun the tests with UNEXPECTED_SNAPSHOT=yes in Node to update the snapshots',
      );
    });

    it('passes if the snapshot matches', () => {
      expect(() => {
        expect(42, 'to inspect as snapshot', '42');
      }, 'not to throw');
    });

    it("fails if the snapshot doesn't match", () => {
      expect(
        () => {
          expect(42, 'to inspect as snapshot', '666');
        },
        'to throw',
        "expected 42 to inspect as snapshot '666'\n" +
          '\n' +
          '-42\n' +
          '+666\n' +
          '\n' +
          'Rerun the tests with UNEXPECTED_SNAPSHOT=yes in Node to update the snapshots',
      );
    });

    it('inspects with infinite depth', () => {
      expect(() => {
        expect(
          { down: { the: { rabbit: { hole: { you: { find: 'Alice' } } } } } },
          'to inspect as snapshot',
          "{ down: { the: { rabbit: { hole: { you: { find: 'Alice' } } } } } }",
        );
      }, 'not to throw');
    });
  });
});
