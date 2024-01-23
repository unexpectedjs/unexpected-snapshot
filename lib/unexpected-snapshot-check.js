const createInspector = require('./createInspector');

module.exports = {
  name: 'unexpected-snapshot',
  version: require('../package.json').version,
  installInto(expect) {
    const inspect = createInspector(expect);

    expect.unindent = require('@gustavnikolaj/string-utils').deindent;

    const snapshotMessage =
      'Rerun the tests with UNEXPECTED_SNAPSHOT=yes in Node to update the snapshots';

    const withSnapshotMessageAppended = (expect, cb) => {
      expect.withError(cb, (err) => {
        expect.errorMode = 'bubble';
        expect.fail((output) => {
          if (!err.isUnexpected) {
            throw err;
          }

          output.appendErrorMessage(err);
          output.nl(2).jsComment(snapshotMessage);
        });
      });
    };

    expect.addAssertion('<any> to equal snapshot', (expect) => {
      withSnapshotMessageAppended(expect, () => {
        expect.fail();
      });
    });

    expect.addAssertion(
      '<any> to equal snapshot <any>',
      (expect, subject, value) => {
        withSnapshotMessageAppended(expect, () => {
          expect(subject, 'to equal', value);
        });
      },
    );

    expect.addAssertion('<any> to inspect as snapshot', (expect) => {
      withSnapshotMessageAppended(expect, () => {
        expect.fail();
      });
    });

    expect.addAssertion(
      '<any> to inspect as snapshot <string>',
      (expect, subject, value) => {
        withSnapshotMessageAppended(expect, () => {
          expect(inspect(subject), 'to equal', value);
        });
      },
    );
  },
};
