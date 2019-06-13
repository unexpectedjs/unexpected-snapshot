const _ = require('lodash');

function extractCallerLocationFromStack(stack) {
  let topFrame = stack
    .split('\n')
    .slice(3)
    .find(frame => !/(^|\b|\/)node_modules\//.test(frame));
  if (topFrame) {
    // at Context.<anonymous> (/home/andreas/work/unexpected-snapshot/test/tmp/unexpected-snapshot-8550355.js:4:21)
    let matchTopFrame = topFrame.match(/\(([^:)]*):(\d+):(\d+)\)$/);
    if (!matchTopFrame) {
      // at /home/andreas/work/unexpected-snapshot/test/tmp/unexpected-snapshot-5568804.js:5:25
      matchTopFrame = topFrame.match(/at ([^:)]*):(\d+):(\d+)$/);
    }
    if (matchTopFrame) {
      return {
        fileName: matchTopFrame[1],
        lineNumber: parseInt(matchTopFrame[2], 10),
        columnNumber: parseInt(matchTopFrame[3], 10)
      };
    }
  }
}

module.exports = {
  name: 'unexpected-snapshot',
  version: require('../package.json').version,
  installInto(expect) {
    const expectForRendering = expect.child();

    if (typeof Buffer === 'function') {
      expectForRendering.addType({
        name: 'infiniteBuffer',
        base: 'Buffer',
        identify(obj) {
          return this.baseType.identify(obj);
        },
        inspect(value, depth, output, inspect) {
          if (value.length > 32) {
            return output.code(
              `Buffer.from('${value.toString('base64')}', 'base64')`,
              'javascript'
            );
          } else {
            return this.baseType.inspect.call(
              this,
              value,
              depth,
              output,
              inspect
            );
          }
        },
        prefix(output) {
          return output.code('Buffer.from([', 'javascript');
        },
        suffix(output) {
          return output.code('])', 'javascript');
        },
        hexDumpWidth: Infinity // Prevents Buffer instances > 16 bytes from being truncated
      });
    }

    expectForRendering.addType({
      base: 'Error',
      name: 'overriddenError',
      identify(obj) {
        return this.baseType.identify(obj);
      },
      inspect(value, depth, output, inspect) {
        var obj = _.extend({}, value);

        var keys = Object.keys(obj);
        if (keys.length === 0) {
          output
            .text('new Error(')
            .append(inspect(value.message || ''))
            .text(')');
        } else {
          output
            .text('(function () {')
            .text(`var err = new ${value.constructor.name || 'Error'}(`)
            .append(inspect(value.message || ''))
            .text(');');
          keys.forEach(function(key, i) {
            output.sp();
            if (/^[a-z$_][a-z0-9$_]*$/i.test(key)) {
              output.text(`err.${key}`);
            } else {
              output
                .text('err[')
                .append(inspect(key))
                .text(']');
            }
            output
              .text(' = ')
              .append(inspect(obj[key]))
              .text(';');
          });
          output.sp().text('return err;}())');
        }
      }
    });

    const symbol = Symbol('unexpectedSnapshot');

    const topLevelFixes = [];

    expect.addAssertion(
      ['<any> to equal snapshot', '<any> to inspect as snapshot'],
      (expect, subject, ...args) => {
        if (expect.context[symbol]) {
          topLevelFixes.push({
            ...expect.context[symbol],
            subject,
            assertionName: expect.testDescription,
            status: 'missing'
          });
          require('./ensureAfterHookIsRegistered')(topLevelFixes);
          expect.fail();
        } else {
          throw new Error(
            'unexpected-snapshot: Could not figure out the location of the expect() call to patch up'
          );
        }
      }
    );

    expect.addAssertion(
      [
        '<any> to equal snapshot <any>',
        '<any> to inspect as snapshot <string>'
      ],
      (expect, subject, ...args) => {
        const subjectForAssertion =
          expect.testDescription === 'to inspect as snapshot'
            ? expectForRendering.inspect(subject).toString('text')
            : subject;

        return expect.withError(
          () => {
            expect(subjectForAssertion, 'to equal', args[0]);
          },
          err => {
            topLevelFixes.push({
              ...expect.context[symbol],
              subject,
              assertionName: expect.testDescription,
              status: 'mismatch'
            });
            require('./ensureAfterHookIsRegistered')(topLevelFixes);
            throw err;
          }
        );
      }
    );

    expect.unindent = require('@gustavnikolaj/string-utils').deindent;

    expect.hook(function(next) {
      return function unexpectedSnapshot(context, ...rest) {
        if (!context[symbol]) {
          try {
            throw new Error();
          } catch (e) {
            context[symbol] = {
              ...extractCallerLocationFromStack(e.stack),
              expectForRendering
            };
          }
        }
        return next(context, ...rest);
      };
    });
  }
};
