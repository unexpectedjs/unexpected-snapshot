const createInspector = require('./createInspector');
const ensureAfterHookIsRegistered = require('./ensureAfterHookIsRegistered');

function extractCallerLocationFromStack(stack) {
  const topFrame = stack
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

// Make sure that these are the same instances even if the plugin is installed into different expects
// in different files:
const symbol = Symbol('unexpectedSnapshot');
const topLevelFixes = [];

module.exports = {
  name: 'unexpected-snapshot',
  version: require('../package.json').version,
  installInto(expect) {
    const inspect = createInspector(expect);

    expect.addAssertion(
      ['<any> to equal snapshot', '<any> to inspect as snapshot'],
      (expect, subject) => {
        if (expect.context[symbol]) {
          topLevelFixes.push({
            ...expect.context[symbol],
            subject,
            assertionName: expect.testDescription,
            status: 'missing'
          });

          ensureAfterHookIsRegistered(topLevelFixes);
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
            ? inspect(subject)
            : subject;

        return expect.withError(
          () => {
            expect(subjectForAssertion, 'to equal', args[0]);
          },
          err => {
            if (err.isUnexpected) {
              topLevelFixes.push({
                ...expect.context[symbol],
                subject,
                assertionName: expect.testDescription,
                status: 'mismatch'
              });
              ensureAfterHookIsRegistered(topLevelFixes);
            } else {
              throw err;
            }
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
              inspect,
              expect
            };
          }
        }
        return next(context, ...rest);
      };
    });
  }
};
