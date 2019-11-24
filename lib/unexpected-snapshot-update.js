const createInspector = require('./createInspector');
const applyFixes = require('./applyFixes');
const trapMethod = require('./trapMethod');

// Make sure that these are the same instances even if the plugin is installed into different expects
// in different files:
const symbol = Symbol('unexpectedSnapshot');
const topLevelFixes = [];

let afterBlockRegistered = false;
function ensureAfterHookIsRegistered() {
  if (afterBlockRegistered || typeof after !== 'function') {
    return;
  }
  afterBlockRegistered = true;
  after(async function() {
    const { numFixedExpects, fixedSourceTextByFileName } = applyFixes(
      topLevelFixes
    );

    const fileNames = Object.keys(fixedSourceTextByFileName);

    // Prevent the test runner from forcefully exiting while we're prompting, but save the call args for replaying later:
    const replayAndRestoreProcessExit = trapMethod(process, 'exit');

    // Give the test runner a chance to complete its output before we prompt:
    setImmediate(async function() {
      console.log(
        `unexpected-snapshot detected ${numFixedExpects} failing snapshot assertion${
          numFixedExpects === 1 ? '' : 's'
        } in ${fileNames.length} source file${
          fileNames.length === 1 ? '' : 's'
        }`
      );

      const Promise = require('bluebird');
      const fs = Promise.promisifyAll(require('fs'));

      if (fileNames.length > 0) {
        const results = await Promise.map(
          fileNames,
          fileName =>
            fs.writeFileAsync(fileName, fixedSourceTextByFileName[fileName]),
          { concurrency: 5 }
        );

        console.log(
          `unexpected-snapshot: Wrote ${results.length} file${
            results.length === 1 ? '' : 's'
          }`
        );
      }
      // Replay the calls that were made while were writing files:
      replayAndRestoreProcessExit();
    });
  });
}

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

          ensureAfterHookIsRegistered();
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
              ensureAfterHookIsRegistered();
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
